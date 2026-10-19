"""The Gen IV data layer for the trainer scouting report: what a game's data says, from our PokeAPI snapshot.

The source of truth is the PokeAPI tables we already load (engine/data/pokeref.sqlite):
- the type chart is `type_efficacy` plus `type_efficacy_past`, which undoes later changes (Steel stopped resisting
  Ghost and Dark after Gen V), restricted to the types that existed then (no Fairy before Gen VI);
- typing is `pokemon_types` plus `pokemon_types_past` (Clefairy was Normal before Gen VI; Rotom's forms were
  Electric/Ghost in Gen IV);
- base stats are `pokemon_stats` plus `pokemon_stats_past`;
- abilities are `pokemon_abilities` plus `pokemon_abilities_past` (no hidden abilities before Gen V);
- learnsets are `pokemon_moves`, per game (version group), with egg moves, tutors, TMs and pre-evolutions.

A past row says "through generation G, it was this": for a generation g, the earliest past row with G >= g wins.
Smogon's per-generation tables are a cross-check only (tests compare the two).
"""
from functools import lru_cache

from refdb import VG, VG_GEN, Ref, slug

STATS = ("hp", "atk", "def", "spa", "spd", "spe")
STAT_ID = {1: "hp", 2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe"}
GAME_GEN = {g: VG_GEN[vg] for g, vg in VG.items()}


class Era:
    def __init__(self, db_path):
        self.ref = Ref(db_path)

    # --- identity -------------------------------------------------------------------------------------
    @lru_cache(maxsize=None)
    def pokemon_id(self, name):
        """A form's PokeAPI pokemon id ("Rotom-Wash" → rotom-wash), else the species' default form."""
        r = self.ref.q("SELECT id FROM pokemon WHERE identifier=?", slug(name))
        if r:
            return int(r[0][0])
        sid = self.ref.species_id(name)
        return int(self.ref.q("SELECT id FROM pokemon WHERE species_id=? AND is_default=1", sid)[0][0])

    @lru_cache(maxsize=None)
    def species_gen(self, name):
        sid = int(self.ref.q("SELECT species_id FROM pokemon WHERE id=?", self.pokemon_id(name))[0][0])
        return int(self.ref.q("SELECT generation_id FROM pokemon_species WHERE id=?", sid)[0][0])

    # --- types ----------------------------------------------------------------------------------------
    @lru_cache(maxsize=None)
    def type_names(self, gen):
        """{type id: "Fire"} for the types that existed in this generation."""
        return {int(r[0]): r[1].capitalize() for r in self.ref.q(
            "SELECT id, identifier FROM types WHERE CAST(generation_id AS INT)<=? AND CAST(id AS INT)<10000", gen)}

    @lru_cache(maxsize=None)
    def chart(self, gen):
        """{attacking type: {defending type: multiplier}} as that generation had it."""
        names = self.type_names(gen)
        out = {a: {d: 1.0 for d in names.values()} for a in names.values()}
        for a, d, f in self.ref.q("SELECT damage_type_id, target_type_id, damage_factor FROM type_efficacy"):
            if int(a) in names and int(d) in names:
                out[names[int(a)]][names[int(d)]] = int(f) / 100
        past = {}
        for a, d, f, g in self.ref.q("SELECT damage_type_id, target_type_id, damage_factor, generation_id "
                                     "FROM type_efficacy_past ORDER BY CAST(generation_id AS INT) DESC"):
            if int(g) >= gen and int(a) in names and int(d) in names:
                past[(int(a), int(d))] = int(f) / 100          # descending order: the earliest applicable wins
        for (a, d), f in past.items():
            out[names[a]][names[d]] = f
        return out

    @lru_cache(maxsize=None)
    def types(self, name, gen):
        pid = self.pokemon_id(name)
        rows = self.ref.q("SELECT generation_id, type_id, slot FROM pokemon_types_past WHERE pokemon_id=? "
                          "ORDER BY CAST(generation_id AS INT)", pid)
        applicable = sorted({int(r[0]) for r in rows if int(r[0]) >= gen})
        if applicable:
            rows = [r for r in rows if int(r[0]) == applicable[0]]
            ids = [int(r[1]) for r in sorted(rows, key=lambda r: int(r[2]))]
        else:
            ids = [int(r[0]) for r in self.ref.q("SELECT type_id FROM pokemon_types WHERE pokemon_id=? ORDER BY slot", pid)]
        names = self.type_names(max(gen, 1))
        all_names = {int(r[0]): r[1].capitalize() for r in self.ref.q("SELECT id, identifier FROM types")}
        return tuple(names.get(i, all_names[i]) for i in ids)

    def multiplier(self, attack_type, defend_types, gen):
        m = 1.0
        for t in defend_types:
            m *= self.chart(gen)[attack_type].get(t, 1.0)
        return m

    # --- stats and abilities --------------------------------------------------------------------------
    @lru_cache(maxsize=None)
    def base_stats(self, name, gen):
        pid = self.pokemon_id(name)
        base = {STAT_ID[int(s)]: int(v) for s, v in self.ref.q(
            "SELECT stat_id, base_stat FROM pokemon_stats WHERE pokemon_id=? AND CAST(stat_id AS INT)<=6", pid)}
        for g, s, v in self.ref.q("SELECT generation_id, stat_id, base_stat FROM pokemon_stats_past WHERE pokemon_id=? "
                                  "AND CAST(stat_id AS INT)<=6 AND CAST(generation_id AS INT)>=? "
                                  "ORDER BY CAST(generation_id AS INT) DESC", pid, gen):
            base[STAT_ID[int(s)]] = int(v)                     # descending: the earliest applicable row wins
        return base

    def abilities(self, name, gen):
        return self.ref.abilities(name, gen)

    def nature(self, name):
        """(raised stat, lowered stat) or (None, None) for a neutral nature."""
        if not name:
            return None, None
        r = self.ref.q("SELECT increased_stat_id, decreased_stat_id FROM natures WHERE identifier=?", slug(name))
        if not r:
            raise KeyError(f"unknown nature {name!r}")
        up, down = int(r[0][0]), int(r[0][1])
        return (None, None) if up == down else (STAT_ID[up], STAT_ID[down])

    def stats(self, name, gen, level=100, nature=None, ivs=None, evs=None):
        """Real stats at a level, from base stats, nature, IVs and EVs (the Gen III-IV formula)."""
        base = self.base_stats(name, gen)
        ivs = {s: (ivs or {}).get(s, 31) for s in STATS}
        evs = {s: (evs or {}).get(s, 0) for s in STATS}
        up, down = self.nature(nature)
        out = {}
        for s in STATS:
            core = (2 * base[s] + ivs[s] + evs[s] // 4) * level // 100
            if s == "hp":
                out[s] = 1 if name.lower().startswith("shedinja") else core + level + 10
            else:
                out[s] = (core + 5) * (110 if s == up else 90 if s == down else 100) // 100
        return out

    # --- items and moves ------------------------------------------------------------------------------
    @lru_cache(maxsize=None)
    def item_lookup(self, item):
        """Any spelling ("NeverMeltIce", "ITEM_LIGHT_BALL", "light-ball") → the item's English name, or None."""
        key = slug(str(item).replace("ITEM_", "")).replace("-", "")
        for i, ident in self.ref.q("SELECT id, identifier FROM items"):
            if ident.replace("-", "") == key:
                return self.ref.q("SELECT name FROM item_names WHERE item_id=? AND local_language_id=9", i)[0][0]
        return None

    def item_name(self, item):
        return self.item_lookup(item) or str(item)

    def move_info(self, move, gen):
        """(type, damage class, power, accuracy) as the generation had it (PokeAPI move_changelog rolled back)."""
        mid = self.ref.move_id(move)
        row = self.ref.q("SELECT m.type_id, m.power, m.accuracy, d.identifier FROM moves m "
                         "JOIN move_damage_classes d ON d.id=m.damage_class_id WHERE m.id=?", mid)[0]
        type_id, power, acc, dclass = int(row[0]), row[1], row[2], row[3]
        vg_of_gen = max(v for v, g in VG_GEN.items() if g == gen)
        for ch in self.ref.q("SELECT * FROM move_changelog WHERE move_id=? ORDER BY CAST(changed_in_version_group_id AS INT)", mid):
            if int(ch["changed_in_version_group_id"]) > vg_of_gen:   # a row holds the values before that change
                type_id = int(ch["type_id"]) if ch["type_id"] is not None and type_id == int(row[0]) else type_id
                power = ch["power"] if ch["power"] is not None and power == row[1] else power
                acc = ch["accuracy"] if ch["accuracy"] is not None and acc == row[2] else acc
        all_names = {int(r[0]): r[1].capitalize() for r in self.ref.q("SELECT id, identifier FROM types")}
        return {"type": all_names[type_id], "class": dclass, "power": int(power) if power else 0,
                "accuracy": int(acc) if acc else None}

    def learn(self, species, move, game):
        """How a species learns a move in this game: {"in_game": [...routes], "elsewhere": [...], "exists": bool}.
        Routes come from PokeAPI learnsets: level-up, egg, tutor, TM/HM, through any pre-evolution."""
        try:
            res = self.ref.learn(species, move, VG[game])
        except KeyError:
            return {"in_game": [], "elsewhere": [], "exists": False}
        routes = res["routes"]
        return {"in_game": [r for r in routes if r[0] == "native"], "elsewhere": [r for r in routes if r[0] != "native"],
                "exists": res["move_exists"]}
