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
Smogon's per-generation tables are a cross-check only (tests compare the two). Where the snapshot is known to miss a
change (Gen V's priority renumbering), trainers/era_corrections.json records the exception and why (E-031).
"""
import json
import os
from functools import lru_cache

from refdb import VG, VG_GEN, Ref, slug

STATS = ("hp", "atk", "def", "spa", "spd", "spe")
SPECIAL_TYPES = {"Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark"}   # before Gen IV
STAT_ID = {1: "hp", 2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe"}
GAME_GEN = {g: VG_GEN[vg] for g, vg in VG.items()}


with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "era_corrections.json"), encoding="utf-8") as _fh:
    _CORRECTIONS = json.load(_fh)
_STAGES = {"one": 1, "two": 2, "three": 3}
_STAT_WORDS = {"attack": "atk", "defense": "def", "special attack": "spa", "special defense": "spd", "speed": "spe"}


def _prose_stat_changes(prose):
    """"Raises the user's Special Attack by one stage." → {"spa": 1}. Only the plain one-clause form."""
    import re
    m = re.match(r"(Raises|Lowers) the user.s ([A-Za-z ]+?) by (one|two|three) stages?\.", prose)
    if not m:
        return {}
    sign = 1 if m.group(1) == "Raises" else -1
    stats = [w.strip().lower() for w in m.group(2).replace(" and ", ", ").split(",") if w.strip()]
    return {_STAT_WORDS[w]: sign * _STAGES[m.group(3)] for w in stats if w in _STAT_WORDS}


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

    @lru_cache(maxsize=None)
    def abilities(self, name, gen):
        return self.ref.abilities(name, gen)

    @lru_cache(maxsize=None)
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

    @lru_cache(maxsize=None)
    def move_info(self, move, gen):
        """A move as the generation had it (PokeAPI move_changelog rolled back): type, damage class, power, accuracy,
        priority, target, drain/recoil, meta category, effect text, stat changes, ailment and hit count."""
        mid = self.ref.move_id(move)
        row = self.ref.q("SELECT m.type_id, m.power, m.accuracy, d.identifier, m.priority, t.identifier FROM moves m "
                         "JOIN move_damage_classes d ON d.id=m.damage_class_id "
                         "LEFT JOIN move_targets t ON t.id=m.target_id WHERE m.id=?", mid)[0]
        type_id, power, acc, dclass = int(row[0]), row[1], row[2], row[3]
        priority, target = int(row[4] or 0), row[5]
        effect_id = int(self.ref.q("SELECT effect_id FROM moves WHERE id=?", mid)[0][0] or 0)
        current_effect = effect_id
        vg_of_gen = max(v for v, g in VG_GEN.items() if g == gen)
        for ch in self.ref.q("SELECT * FROM move_changelog WHERE move_id=? ORDER BY CAST(changed_in_version_group_id AS INT)", mid):
            if int(ch["changed_in_version_group_id"]) > vg_of_gen:   # a row holds the values before that change
                type_id = int(ch["type_id"]) if ch["type_id"] is not None and type_id == int(row[0]) else type_id
                power = ch["power"] if ch["power"] is not None and power == row[1] else power
                acc = ch["accuracy"] if ch["accuracy"] is not None and acc == row[2] else acc
                priority = int(ch["priority"]) if ch["priority"] is not None and priority == int(row[4] or 0) else priority
                effect_id = int(ch["effect_id"]) if ch["effect_id"] is not None and effect_id == current_effect else effect_id
        fix = _CORRECTIONS["priority"].get(move)
        if fix and fix.get("from_gen", 1) <= gen <= fix["through_gen"]:
            priority = fix["priority"]                          # trainers/era_corrections.json (E-031)
        all_names = {int(r[0]): r[1].capitalize() for r in self.ref.q("SELECT id, identifier FROM types")}
        meta = self.ref.q("SELECT mm.drain, c.identifier, mm.min_hits, mm.max_hits FROM move_meta mm LEFT JOIN move_meta_categories c "
                          "ON c.id=mm.meta_category_id WHERE mm.move_id=?", mid)
        effect = self.ref.q("SELECT short_effect FROM move_effect_prose WHERE move_effect_id=? AND local_language_id=9",
                            effect_id)
        words = move.split()
        if len(words) == 3 and words[0].lower() == "hidden" and words[2].capitalize() in all_names.values():
            type_id = next(i for i, n in all_names.items() if n == words[2].capitalize())   # "Hidden Power Fire"
            power = power if power and int(power) > 1 else 70
        if gen < 4 and dclass != "status":   # Gen II-III: physical or special by type
            dclass = "special" if all_names[type_id] in SPECIAL_TYPES else "physical"
        changes = self._stat_changes(mid, effect_id, current_effect, (effect[0][0] if effect else "") or "")
        ail = self.ref.q("SELECT a.identifier FROM move_meta mm JOIN move_meta_ailments a ON a.id=mm.meta_ailment_id "
                         "WHERE mm.move_id=?", mid)
        return {"type": all_names[type_id], "class": dclass, "power": int(power) if power else 0,
                "accuracy": int(acc) if acc else None, "drain": int(meta[0][0] or 0) if meta else 0,
                "meta": (meta[0][1] if meta else None) or "unique", "effect": (effect[0][0] if effect else "") or "",
                "priority": priority, "target": target or "", "stat_changes": changes,
                "ailment": (ail[0][0] if ail else None),
                "hits": (int(meta[0][2]), int(meta[0][3])) if meta and meta[0][2] and meta[0][3] else None}

    def _stat_changes(self, mid, effect_id, current_effect, prose):
        """The stat stages a move changes. PokeAPI keeps only today's (move_meta_stat_changes), so when the move's
        effect was different in this generation (Growth raised only Special Attack before Gen V; Tail Glow raised it
        two stages, not three), read them from another move that still has the old effect, else from its prose."""
        source = mid
        if effect_id != current_effect:
            same = self.ref.q("SELECT id FROM moves WHERE effect_id=? AND id<>? ORDER BY id", effect_id, mid)
            if not same:
                return _prose_stat_changes(prose)
            source = int(same[0][0])
        return {STAT_ID.get(int(sid), "other"): int(ch) for sid, ch in self.ref.q(
            "SELECT stat_id, change FROM move_meta_stat_changes WHERE move_id=?", source)}

    @lru_cache(maxsize=None)
    def item_gen(self, item):
        """The first generation the item exists in (PokeAPI item_game_indices), or None when it never had an index."""
        name = self.item_lookup(item)
        if not name:
            return None
        rows = self.ref.q("SELECT MIN(CAST(g.generation_id AS INT)) FROM item_game_indices g JOIN item_names n "
                          "ON n.item_id=g.item_id AND n.local_language_id=9 WHERE n.name=?", name)
        return int(rows[0][0]) if rows and rows[0][0] is not None else None

    def sketches(self, species):
        return species in _CORRECTIONS["sketch"]["species"]

    @lru_cache(maxsize=None)
    def sketchable(self, gen):
        """Every move Sketch can copy in this generation (era_corrections.json "sketch")."""
        skip = set(_CORRECTIONS["sketch"]["cannot_sketch"])
        return sorted(n for (n,) in self.ref.q("SELECT n.name FROM moves m JOIN move_names n ON n.move_id=m.id AND "
                                               "n.local_language_id=9 WHERE CAST(m.generation_id AS INT)<=? AND "
                                               "CAST(m.id AS INT)<10000", gen) if n not in skip)

    @lru_cache(maxsize=None)
    def learnable(self, species, game):
        """Every move the species can learn in this game (any route, through pre-evolutions), by English name.
        Smeargle adds every move Sketch can copy in the generation."""
        sid = self.ref.species_id(species)
        vg = VG[game]
        out = set(self.sketchable(GAME_GEN[game])) if self.sketches(species) else set()
        for stage in self.ref.line(sid):
            for (name,) in self.ref.q("SELECT n.name FROM pokemon_moves pm JOIN move_names n ON n.move_id=pm.move_id "
                                      "AND n.local_language_id=9 WHERE pm.pokemon_id=? AND pm.version_group_id=?", stage, vg):
                out.add(name)
        return sorted(out)

    @lru_cache(maxsize=None)
    def fully_evolved(self, gen):
        """Every fully evolved species that existed in this generation (default forms)."""
        top = {2: 251, 3: 386, 4: 493}[gen]
        return [r[0] for r in self.ref.q(
            "SELECT s.identifier FROM pokemon_species s WHERE CAST(s.id AS INT)<=? AND NOT EXISTS "
            "(SELECT 1 FROM pokemon_species c WHERE c.evolves_from_species_id=s.id AND CAST(c.id AS INT)<=?)", top, top)]

    @lru_cache(maxsize=None)
    def game_names(self):
        """{version group id: (display name, generation)} for every game in the data."""
        pretty = {"red-blue": "Red/Blue", "gold-silver": "Gold/Silver", "ruby-sapphire": "Ruby/Sapphire",
                  "firered-leafgreen": "FireRed/LeafGreen", "diamond-pearl": "Diamond/Pearl",
                  "heartgold-soulsilver": "HeartGold/SoulSilver", "black-white": "Black/White",
                  "black-2-white-2": "Black 2/White 2", "x-y": "X/Y", "omega-ruby-alpha-sapphire": "Omega Ruby/Alpha Sapphire",
                  "sun-moon": "Sun/Moon", "ultra-sun-ultra-moon": "Ultra Sun/Ultra Moon",
                  "lets-go-pikachu-lets-go-eevee": "Let's Go", "sword-shield": "Sword/Shield",
                  "brilliant-diamond-shining-pearl": "Brilliant Diamond/Shining Pearl", "scarlet-violet": "Scarlet/Violet",
                  "xd": "XD"}
        return {int(i): (pretty.get(ident, ident.replace("-", " ").title()), int(g))
                for i, ident, g in self.ref.q("SELECT id, identifier, generation_id FROM version_groups")}

    def learn_anywhere(self, species, move):
        """Every game where the species (or a pre-evolution) learns the move: [(game, generation, method, level)]."""
        try:
            sid, mid = self.ref.species_id(species), self.ref.move_id(move)
        except KeyError:
            return []
        methods = {int(i): ident for i, ident in self.ref.q("SELECT id, identifier FROM pokemon_move_methods")}
        names = self.game_names()
        out = set()
        for stage in self.ref.line(sid):
            for vg, m, lvl in self.ref.q("SELECT version_group_id, pokemon_move_method_id, level FROM pokemon_moves "
                                         "WHERE pokemon_id=? AND move_id=?", stage, mid):
                game, gen = names[int(vg)]
                out.add((game, gen, methods.get(int(m), str(m)), int(lvl or 0)))
        return sorted(out, key=lambda r: (r[1], r[0], r[2]))

    def learn(self, species, move, game):
        """How a species learns a move in this game: {"in_game": [...routes], "elsewhere": [...], "exists": bool}.
        Routes come from PokeAPI learnsets: level-up, egg, tutor, TM/HM, through any pre-evolution."""
        try:
            res = self.ref.learn(species, move, VG[game])
        except KeyError:
            return {"in_game": [], "elsewhere": [], "exists": False}
        routes = res["routes"]
        native = [r for r in routes if r[0] == "native"]
        if not native and self.sketches(species) and move in self.sketchable(GAME_GEN[game]):
            native = [("native", species, "sketch", 0)]             # era_corrections.json "sketch"
        return {"in_game": native, "elsewhere": [r for r in routes if r[0] != "native"],
                "exists": res["move_exists"]}
