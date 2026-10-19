"""Reference engine prototype: loads a pinned PokeAPI CSV snapshot into SQLite and
answers version-group-aware learnset, breeding, ability and HM questions.

Usage:  python3 -I refdb.py <raw_csv_dir> <sqlite_path>   (builds the DB)
Import: from refdb import Ref; r = Ref(sqlite_path)
"""
import csv
import os
import sqlite3
import sys

TABLES = [
    "pokemon_moves", "moves", "move_names", "pokemon", "pokemon_species",
    "pokemon_species_names", "pokemon_egg_groups", "egg_groups", "version_groups",
    "versions", "generations", "pokemon_abilities", "pokemon_abilities_past",
    "abilities", "ability_names", "pokemon_move_methods", "machines", "items",
    "pokemon_types", "pokemon_types_past", "types", "encounters", "location_areas",
    "locations", "location_names", "pokemon_evolution", "evolution_triggers",
    "pokemon_stats", "stats", "move_damage_classes",
    # specimen-level data
    "pokemon_stats_past", "natures", "nature_names", "characteristics", "characteristic_text",
    "contest_types", "contest_type_names", "item_game_indices", "item_names",
    # wilderness / lore data
    "pokemon_species_flavor_text", "pokemon_habitats", "type_efficacy", "type_efficacy_past",
    # ranch: greenhouse crops
    "berries",
    # scouting: what every move does
    "move_meta", "move_meta_stat_changes", "move_meta_categories", "move_meta_ailments", "move_flag_map",
    "move_flags", "move_effect_prose", "move_changelog", "move_targets",
]

# Version groups this project cares about (PokeAPI ids).
VG = {"crystal": 4, "firered": 7, "emerald": 6, "platinum": 9, "heartgold": 10, "soulsilver": 10}
VG_GEN = {1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 12: 3, 13: 3, 8: 4, 9: 4, 10: 4}
# Ways moves can travel between games: Gen 1<->2 (Time Capsule), Gen 3 -> 4 (Pal Park).
# Gen 2 -> Gen 3 is impossible on cartridge.
TRANSFER_FROM = {2: [1], 3: [], 4: [3]}
LEARNABLE_METHODS = {1: "level-up", 2: "egg", 3: "tutor", 4: "machine", 6: "light-ball-egg"}
MALE_IMPOSSIBLE = {-1, 8}  # genderless, female-only


def build(raw_dir, db_path):
    if os.path.exists(db_path):
        os.remove(db_path)
    con = sqlite3.connect(db_path)
    for t in TABLES:
        with open(os.path.join(raw_dir, f"{t}.csv"), newline="", encoding="utf-8") as fh:
            rows = list(csv.reader(fh))
        cols = rows[0]
        # NUMERIC affinity stores "9" as 9 so integer parameters compare correctly.
        con.execute(f'CREATE TABLE {t} ({", ".join(f"{c!r} NUMERIC" for c in cols)})')
        con.executemany(
            f'INSERT INTO {t} VALUES ({", ".join("?" * len(cols))})',
            [[None if v == "" else v for v in r] for r in rows[1:]],
        )
    con.executescript("""
        CREATE INDEX pm_idx ON pokemon_moves(pokemon_id, version_group_id, move_id);
        CREATE INDEX pm_move ON pokemon_moves(move_id, version_group_id);
        CREATE INDEX peg ON pokemon_egg_groups(species_id);
    """)
    con.commit()
    con.close()


# Gen 1-4 spellings (as written in the legacy sheets and the old games) -> PokeAPI identifiers.
LEGACY_MOVE_ALIASES = {
    "ancientpower": "ancient-power", "extremespeed": "extreme-speed", "solarbeam": "solar-beam",
    "dragonbreath": "dragon-breath", "thunderpunch": "thunder-punch", "thundershock": "thunder-shock",
    "firepunch": "fire-punch", "icepunch": "ice-punch", "smokescreen": "smokescreen",
    "dynamicpunch": "dynamic-punch", "bubblebeam": "bubble-beam", "sonicboom": "sonic-boom",
    "doubleslap": "double-slap", "softboiled": "soft-boiled", "selfdestruct": "self-destruct",
    "faint-attack": "feint-attack", "hi-jump-kick": "high-jump-kick", "sand-attack": "sand-attack",
    "vicegrip": "vise-grip", "featherdance": "feather-dance", "grasswhistle": "grass-whistle",
    "poisonpowder": "poison-powder", "slackoff": "slack-off", "wil-o-wisp": "will-o-wisp",
}
LEGACY_SPECIES_ALIASES = {"venesaur": "venusaur", "gyrados": "gyarados"}


def slug(name):
    s = (name.strip().lower().replace("’", "").replace("'", "").replace(".", "")
         .replace(" ", "-").replace("é", "e").replace("♂", "-m").replace("♀", "-f"))
    if s.startswith("hidden-power"):
        return "hidden-power"
    return LEGACY_MOVE_ALIASES.get(s.replace("-", ""), LEGACY_MOVE_ALIASES.get(s, s))


class Ref:
    def __init__(self, db_path):
        self.con = sqlite3.connect(db_path)
        self.con.row_factory = sqlite3.Row

    def q(self, sql, *args):
        return self.con.execute(sql, args).fetchall()

    # --- identity -------------------------------------------------------
    def species_id(self, name):
        s = slug(name)
        r = self.q("SELECT id FROM pokemon_species WHERE identifier=?", LEGACY_SPECIES_ALIASES.get(s, s))
        if not r:
            raise KeyError(name)
        return int(r[0]["id"])

    def move_id(self, name):
        r = self.q("SELECT id FROM moves WHERE identifier=?", slug(name))
        if not r:
            raise KeyError(name)
        return int(r[0]["id"])

    def name(self, species_id):
        return self.q("SELECT name FROM pokemon_species_names WHERE pokemon_species_id=? "
                      "AND local_language_id=9", species_id)[0]["name"]

    def move_name(self, move_id):
        return self.q("SELECT name FROM move_names WHERE move_id=? AND local_language_id=9",
                      move_id)[0]["name"]

    def move_gen(self, move_id):
        return int(self.q("SELECT generation_id FROM moves WHERE id=?", move_id)[0]["generation_id"])

    def line(self, species_id):
        """Species and all its pre-evolutions, newest first."""
        out, cur = [], species_id
        while cur:
            out.append(cur)
            r = self.q("SELECT evolves_from_species_id FROM pokemon_species WHERE id=?", cur)
            cur = int(r[0][0]) if r and r[0][0] else None
        return out

    def family(self, species_id):
        """Whole evolution family (for egg-group and egg-move lookup)."""
        chain = self.q("SELECT evolution_chain_id FROM pokemon_species WHERE id=?", species_id)[0][0]
        return [int(r["id"]) for r in self.q(
            "SELECT id FROM pokemon_species WHERE evolution_chain_id=? AND CAST(id AS INT)<=493", chain)]

    def gen_of_species(self, sid):
        return int(self.q("SELECT generation_id FROM pokemon_species WHERE id=?", sid)[0][0])

    # --- learnsets ------------------------------------------------------
    def methods(self, sid, mid, vg):
        return [(LEARNABLE_METHODS.get(int(r["pokemon_move_method_id"]), r["pokemon_move_method_id"]),
                 int(r["level"] or 0))
                for r in self.q("SELECT pokemon_move_method_id, level FROM pokemon_moves "
                                "WHERE pokemon_id=? AND version_group_id=? AND move_id=?", sid, vg, mid)]

    def learn(self, species, move, vg):
        """Every way `species` (or a pre-evolution it passed through) gets `move` in `vg`,
        plus same-generation other-version and transfer routes, labeled."""
        sid, mid = self.species_id(species), self.move_id(move)
        gen = VG_GEN[vg]
        same_gen_vgs = [v for v, g in VG_GEN.items() if g == gen and v != vg]
        earlier = [v for v, g in VG_GEN.items() if g in TRANSFER_FROM.get(gen, [])]
        found = []
        for stage in self.line(sid):
            for m, lvl in self.methods(stage, mid, vg):
                found.append(("native", self.name(stage), m, lvl, vg))
            for v in same_gen_vgs:
                for m, lvl in self.methods(stage, mid, v):
                    found.append(("same-gen trade", self.name(stage), m, lvl, v))
            for v in earlier:
                for m, lvl in self.methods(stage, mid, v):
                    found.append(("transfer", self.name(stage), m, lvl, v))
        return {"species": species, "move": self.move_name(mid), "vg": vg,
                "move_exists": self.move_gen(mid) <= gen, "routes": found}

    # --- breeding -------------------------------------------------------
    def egg_groups(self, sid):
        return [r["identifier"] for r in self.q(
            "SELECT e.identifier FROM pokemon_egg_groups p JOIN egg_groups e ON e.id=p.egg_group_id "
            "WHERE p.species_id=?", sid)]

    def breeding_groups(self, species):
        """Egg groups of the breedable adults in the family (babies are 'no-eggs')."""
        groups = set()
        for s in self.family(self.species_id(species)):
            groups |= {g for g in self.egg_groups(s) if g not in ("no-eggs", "ditto")}
        return sorted(groups)

    def egg_move_of(self, species, move, vg):
        """Is `move` an egg move for this family in this version group?"""
        mid = self.move_id(move)
        return any(m == "egg" for s in self.family(self.species_id(species))
                   for m, _ in self.methods(s, mid, vg))

    def fathers(self, species, move, vg, include_transfer=True):
        """Male-capable species sharing an egg group that know `move` via a non-egg route
        (level/TM/tutor) in this generation (or by transfer). Egg-route fathers are listed too,
        flagged as chain links. Returns no fathers when the move isn't an egg move here."""
        mid = self.move_id(move)
        if not self.egg_move_of(species, move, vg):
            return {"target": species, "move": self.move_name(mid), "groups": [],
                    "fathers": [], "note": "not an egg move for this family in this version group"}
        groups = self.breeding_groups(species)
        gen = VG_GEN[vg]
        vgs = [v for v, g in VG_GEN.items() if g == gen]
        if include_transfer:
            vgs += [v for v, g in VG_GEN.items() if g in TRANSFER_FROM.get(gen, [])]
        placeholders = ",".join("?" * len(groups))
        cands = self.q(f"""
            SELECT DISTINCT s.id, s.gender_rate FROM pokemon_species s
            JOIN pokemon_egg_groups p ON p.species_id=s.id
            JOIN egg_groups e ON e.id=p.egg_group_id
            WHERE e.identifier IN ({placeholders}) AND CAST(s.id AS INT)<=493""", *groups)
        out = []
        for c in cands:
            if int(c["gender_rate"]) in MALE_IMPOSSIBLE:
                continue
            ways = []
            for v in vgs:
                for m, lvl in self.methods(int(c["id"]), mid, v):
                    ways.append(f"{m}{'@'+str(lvl) if m == 'level-up' else ''} (vg{v})")
            if ways:
                out.append((self.name(int(c["id"])), sorted(set(ways))))
        return {"target": species, "move": self.move_name(mid), "groups": groups, "fathers": out}

    def gender_rate(self, sid):
        return int(self.q("SELECT gender_rate FROM pokemon_species WHERE id=?", sid)[0][0])

    def chain(self, species, move, vg, max_hops=3):
        """Shortest breeding chains that end with `species` hatching knowing `move`.
        Each hop: a male father who knows the move x a female of the child's family.
        The first father must know it by level-up/TM/tutor (any same-gen game, or transfer);
        intermediate links must have it as an egg move in some same-generation game."""
        mid = self.move_id(move)
        gen = VG_GEN[vg]
        gen_vgs = [v for v, g in VG_GEN.items() if g == gen]
        src_vgs = gen_vgs + [v for v, g in VG_GEN.items() if g in TRANSFER_FROM.get(gen, [])]

        def non_egg_source(sid):
            return sorted({f"{self.name(sid)} {m}{'@'+str(l) if m == 'level-up' else ''} (vg{v})"
                           for v in src_vgs for m, l in self.methods(sid, mid, v)
                           if m in ("level-up", "tutor", "machine")})

        def egg_in(fam, vgs):
            return [v for v in vgs if any(m == "egg" for s in fam for m, _ in self.methods(s, mid, v))]

        def groups_of(fam):
            return {g for s in fam for g in self.egg_groups(s) if g not in ("no-eggs", "ditto")}

        target_fam = self.family(self.species_id(species))
        if not egg_in(target_fam, [vg]):
            return {"target": species, "move": self.move_name(mid), "chains": [],
                    "note": "not an egg move for this family in this version group"}
        members = {}
        for g in ("monster", "water1", "water2", "water3", "bug", "flying", "ground", "fairy",
                  "plant", "humanshape", "mineral", "indeterminate", "dragon"):
            members[g] = [int(r["species_id"]) for r in self.q(
                "SELECT p.species_id FROM pokemon_egg_groups p JOIN egg_groups e ON e.id=p.egg_group_id "
                "WHERE e.identifier=? AND CAST(p.species_id AS INT)<=493", g)]
        frontier, seen, done = [(target_fam, [])], set(target_fam), []
        for _ in range(max_hops):
            nxt = []
            for fam, path in frontier:
                for g in groups_of(fam):
                    for c in members.get(g, []):
                        if self.gender_rate(c) in MALE_IMPOSSIBLE:
                            continue
                        src = non_egg_source(c)
                        link = (self.name(c), self.name(fam[0]) if len(fam) == 1 else
                                self.name(min(fam)), g)
                        if src:
                            done.append({"path": [link] + path, "source": src[:3]})
                        elif c not in seen:
                            cfam = self.family(c)
                            if any(self.gender_rate(s) not in (-1, 0) for s in cfam) and egg_in(cfam, gen_vgs):
                                seen.update(cfam)
                                nxt.append((cfam, [link] + path))
            if done:
                break
            frontier = nxt
        return {"target": species, "move": self.move_name(mid), "chains": done}

    # --- abilities ------------------------------------------------------
    def abilities(self, species, gen):
        sid = self.species_id(species)
        past = self.q("SELECT generation_id, ability_id, is_hidden, slot FROM pokemon_abilities_past "
                      "WHERE pokemon_id=? ORDER BY CAST(generation_id AS INT)", sid)
        cur = {int(r["slot"]): r["ability_id"] for r in
               self.q("SELECT ability_id, slot FROM pokemon_abilities WHERE pokemon_id=?", sid)}
        # A past row says: "through generation G, slot S held ability A (or nothing)".
        for r in past:
            if gen <= int(r["generation_id"]):
                cur[int(r["slot"])] = r["ability_id"]
                # earliest matching past row wins for this slot
        out = []
        for slot in sorted(cur):
            aid = cur[slot]
            if aid is None or slot == 3:  # hidden abilities don't exist before Gen 5
                continue
            a = self.q("SELECT a.generation_id, n.name FROM abilities a JOIN ability_names n "
                       "ON n.ability_id=a.id AND n.local_language_id=9 WHERE a.id=?", aid)[0]
            if int(a["generation_id"]) <= gen:
                out.append(a["name"])
        return out if gen >= 3 else []

    # --- field moves ----------------------------------------------------
    def hms(self, vg):
        return [(int(r["machine_number"]) - 100, int(r["move_id"])) for r in self.q(
            "SELECT machine_number, move_id FROM machines WHERE version_group_id=? "
            "AND CAST(machine_number AS INT)>100 ORDER BY CAST(machine_number AS INT)", vg)]

    def machine_no(self, move, vg):
        r = self.q("SELECT machine_number FROM machines WHERE version_group_id=? AND move_id=?",
                   vg, self.move_id(move))
        if not r:
            return None
        n = int(r[0][0])
        return f"HM{n-100:02d}" if n > 100 else f"TM{n:02d}"

    # --- stats ----------------------------------------------------------
    def base_stats(self, species):
        sid = self.species_id(species)
        return {r["identifier"]: int(r["base_stat"]) for r in self.q(
            "SELECT s.identifier, p.base_stat FROM pokemon_stats p JOIN stats s ON s.id=p.stat_id "
            "WHERE p.pokemon_id=?", sid)}

    # --- encounters -----------------------------------------------------
    def wild_in(self, species, version_identifier):
        sid = self.species_id(species)
        return sorted({r["identifier"] for r in self.q("""
            SELECT DISTINCT l.identifier || COALESCE('/' || la.identifier, '') AS identifier
            FROM encounters e
            JOIN versions v ON v.id=e.version_id
            JOIN location_areas la ON la.id=e.location_area_id
            JOIN locations l ON l.id=la.location_id
            WHERE e.pokemon_id IN (%s) AND v.identifier=?""" %
            ",".join(str(s) for s in self.family(sid)), version_identifier)})


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
    print("built", sys.argv[2])
