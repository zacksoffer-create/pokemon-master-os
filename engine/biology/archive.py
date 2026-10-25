"""The research archive (Field Biology, v1 B1): everything the Gen I-IV games record about each species, in one place.

    python3 -I engine/biology/archive.py            # engine/data_manifest/biology/archive.json
    python3 -I engine/biology/archive.py Heracross  # one species, for a look

Per species: every Pokédex entry from all sixteen Gen I-IV versions (Red, Blue, Yellow, Gold, Silver, Crystal, Ruby,
Sapphire, Emerald, FireRed, LeafGreen, Diamond, Pearl, Platinum, HeartGold, SoulSilver), identical texts merged with
the versions that carry them; the category ("the Seed Pokémon"), height, weight, colour, Gen 4 body shape, the Gen 3
Pokédex habitat, egg groups, gender ratio, egg cycles, growth rate, catch rate, base friendship, legendary or
mythical; its evolution (from what, into what, how); its Gen 4 types and abilities; and every encounter in every game
(location, method, time of day, how often, at what levels). All of it is canon or game data, from the reference
database (PokeAPI's copy of the games' data) and the raw tables fetched beside it (fetch_reference.py --biology).
Nothing here is interpreted; claims.py reads it, and everything that reads it says which entry it read.
"""
import csv
import json
import os
import re
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

import rules  # noqa: E402

DB = os.path.join(ENGINE, "data", "pokeref.sqlite")
RAW = os.path.join(ENGINE, "data", "raw")
OUT = os.path.join(ENGINE, "data_manifest", "biology", "archive.json")
VERSIONS = {1: "red", 2: "blue", 3: "yellow", 4: "gold", 5: "silver", 6: "crystal", 7: "ruby", 8: "sapphire", 9: "emerald",
            10: "firered", 11: "leafgreen", 12: "diamond", 13: "pearl", 14: "platinum", 15: "heartgold", 16: "soulsilver"}
VERSION_GEN = {1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4}
VERSION_NAME = {"red": "Red", "blue": "Blue", "yellow": "Yellow", "gold": "Gold", "silver": "Silver", "crystal": "Crystal",
                "ruby": "Ruby", "sapphire": "Sapphire", "emerald": "Emerald", "firered": "FireRed", "leafgreen": "LeafGreen",
                "diamond": "Diamond", "pearl": "Pearl", "platinum": "Platinum", "heartgold": "HeartGold", "soulsilver": "SoulSilver"}
GROWTH = {1: "slow", 2: "medium", 3: "fast", 4: "medium slow", 5: "slow then very fast (erratic)", 6: "fast then very slow (fluctuating)"}
TRIGGER = {1: "level-up", 2: "trade", 3: "use-item", 4: "shed"}
EGG_NAMES = {"monster": "Monster", "water1": "Water 1", "bug": "Bug", "flying": "Flying", "ground": "Field", "fairy": "Fairy",
             "plant": "Grass", "humanshape": "Human-Like", "water3": "Water 3", "mineral": "Mineral", "indeterminate": "Amorphous",
             "water2": "Water 2", "dragon": "Dragon", "ditto": "Ditto", "no-eggs": "Undiscovered"}


def raw(name):
    with open(os.path.join(RAW, name), encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


CAPS = {}   # SLOWPOKE -> Slowpoke, filled once the names are read (Archive.__init__)


def tidy(text):
    """A Pokédex entry as printed, with the cartridges' line breaks and soft hyphens taken out, and the older games'
    capitals (POKéMON, SLOWPOKE, POKé BALL) in the case the later games print them. No word is changed."""
    t = " ".join(str(text).replace("­", "").replace("\f", " ").split())
    t = re.sub(r"(\w)- (\w)", r"\1-\2", t)
    t = t.replace("POKéMON", "Pokémon").replace("POKé BALL", "Poké Ball").replace("POKéBALL", "Poké Ball").replace("TRAINER", "Trainer")
    if CAPS:
        t = CAPS["_re"].sub(lambda m: CAPS[m.group(0)], t)
    if VOCAB:      # "ordi nary", "draw ing": a word the cartridge broke across two lines, rejoined when the two halves
        t = rejoin(t)   # make a word the entries or the games' other text use, and one half is all but unused alone
    return t


VOCAB = {}            # how often each word appears in the Pokédex entries
WORDS = set()         # every English word in the reference data's prose (moves, items, abilities), to check a join
NEVER_JOIN = {("to", "ward"), ("breast", "stroke")}


SUFFIXES = {"ing", "ed", "ly", "tion", "sion", "ness", "ment", "ments", "able", "ible", "ous", "ful", "less", "est", "er", "ers", "ity"}


def joins(a, b):
    if (a, b) in NEVER_JOIN or not (a.isalpha() and b.isalpha() and a.islower() and b.islower()) or len(a + b) <= 4:
        return False
    word = VOCAB.get(a + b, 0) >= 1 or (a + b) in WORDS
    return word and (min(VOCAB.get(a, 0), VOCAB.get(b, 0)) <= 3 or b in SUFFIXES)


def rejoin(t):
    words, out, i = t.split(" "), [], 0
    while i < len(words):
        w = words[i]
        core = re.match(r"^([a-z]+)(.*)$", words[i + 1]) if i + 1 < len(words) else None
        if core and joins(w, core.group(1)):
            out.append(w + words[i + 1])
            i += 2
            continue
        out.append(w)
        i += 1
    return " ".join(out)


def battle_name(name):
    return {"Nidoran♀": "Nidoran-F", "Nidoran♂": "Nidoran-M"}.get(name, name)


def dedupe_key(text):
    return re.sub(r"[^a-z0-9]+", " ", tidy(text).lower()).strip()


class Archive:
    def __init__(self, db=DB):
        self.db = sqlite3.connect(db)
        self.db.row_factory = sqlite3.Row
        q = self.q
        self.names = {r[0]: r[1] for r in q("SELECT pokemon_species_id, name FROM pokemon_species_names WHERE local_language_id=9")}
        CAPS.update({n.upper(): n for n in self.names.values() if n.upper() != n})
        CAPS.update({"NIDORAN": "Nidoran", "BERRIES": "Berries", "BERRY": "Berry", "APRICORN": "Apricorn", "APRICORNS": "Apricorns"})
        CAPS["_re"] = re.compile(r"(?<![A-Za-z])(" + "|".join(re.escape(k) for k in sorted((k for k in CAPS if k != "_re"), key=len, reverse=True)) + r")(?![a-z])")
        self.genus = {r[0]: r[1] for r in q("SELECT pokemon_species_id, genus FROM pokemon_species_names WHERE local_language_id=9")}
        self.colors = {int(r["id"]): r["identifier"] for r in raw("biology/pokemon_colors.csv")}
        self.shapes = {int(r["id"]): r["identifier"] for r in raw("capability/pokemon_shapes.csv")}
        self.habitats = {r[0]: r[1] for r in q("SELECT id, identifier FROM pokemon_habitats")}
        self.items = {r[0]: r[1] for r in q("SELECT item_id, name FROM item_names WHERE local_language_id=9")}
        self.moves = {r[0]: r[1] for r in q("SELECT move_id, name FROM move_names WHERE local_language_id=9")}
        self.locnames = {r[0]: r[1] for r in q("SELECT location_id, name FROM location_names WHERE local_language_id=9")}
        self._areas = None
        if not VOCAB:       # every word the Gen I-IV entries use, to rejoin the ones a line break split
            for (text,) in q("SELECT flavor_text FROM pokemon_species_flavor_text WHERE language_id=9 AND version_id BETWEEN 1 AND 16"):
                for w in re.findall(r"[a-z]+", " ".join(str(text).replace("\u00ad", "").split()).lower()):
                    VOCAB[w] = VOCAB.get(w, 0) + 1
            for name, col in (("item_prose.csv", "effect"), ("ability_prose.csv", "effect"), ("item_flavor_text.csv", "flavor_text"),
                              ("ability_flavor_text.csv", "flavor_text"), ("move_effect_prose.csv", "effect")):
                path = os.path.join(RAW, name)
                if os.path.exists(path):
                    for r in raw(name):
                        if r.get("local_language_id", r.get("language_id")) == "9":
                            WORDS.update(re.findall(r"[a-z]+", str(r.get(col, "")).lower()))
            for (text,) in q("SELECT effect FROM move_effect_prose WHERE local_language_id=9"):
                WORDS.update(re.findall(r"[a-z]+", str(text).lower()))

    def q(self, sql, *a):
        return self.db.execute(sql, a).fetchall()

    # --- the areas every encounter happens in ----------------------------------------------------------------------
    def areas(self):
        if self._areas is None:
            regions = {int(r["id"]): r["identifier"] for r in raw("biology/regions.csv")}
            locs = {int(r["id"]): (r["identifier"], int(r["region_id"]) if r["region_id"] else None) for r in raw("locations.csv")}
            prose = {int(r["location_area_id"]): r["name"] for r in raw("biology/location_area_prose.csv") if r["local_language_id"] == "9"}
            out = {}
            for r in raw("location_areas.csv"):
                aid, lid = int(r["id"]), int(r["location_id"])
                ident, reg = locs.get(lid, (None, None))
                loc_name = self.locnames.get(lid) or (ident or "").replace("-", " ").title()
                # the area prose sometimes renames the place ("Road 34"); keep the location's name and only the prose's part
                part = re.search(r"\(([^)]*)\)\s*$", prose.get(aid) or "")
                out[aid] = {"area": f"{loc_name} ({part.group(1)})" if part else loc_name, "location": loc_name, "location_id": lid, "loc_key": ident,
                            "sub": r["identifier"] or None, "region": regions.get(reg)}
            self._areas = out
        return self._areas

    def encounters(self):
        """{species id: [{v, a, m, t, r, l}]}: every Gen I-IV encounter, by version, area, method and time of day."""
        slots = {int(r["id"]): (int(r["encounter_method_id"]), int(r["rarity"] or 0)) for r in raw("equipment/encounter_slots.csv")}
        methods = {int(r["id"]): r["identifier"] for r in raw("equipment/encounter_methods.csv")}
        cvals = {int(r["id"]): r["identifier"] for r in raw("biology/encounter_condition_values.csv")}
        cond = {}
        for r in raw("biology/encounter_condition_value_map.csv"):
            cond.setdefault(int(r["encounter_id"]), []).append(cvals[int(r["encounter_condition_value_id"])])
        species_of = {r[0]: r[1] for r in self.q("SELECT id, species_id FROM pokemon")}
        agg = {}
        for r in raw("encounters.csv"):
            v = int(r["version_id"])
            if v not in VERSIONS:
                continue
            sid = species_of.get(int(r["pokemon_id"]))
            if not sid or sid > 493:
                continue
            m, rarity = slots[int(r["encounter_slot_id"])]
            cs = cond.get(int(r["id"]), [])
            times = sorted(c.split("-", 1)[1] for c in cs if c.startswith("time-"))
            other = sorted(c for c in cs if not c.startswith("time-") and not c.endswith("-no") and c not in ("swarm-no", "radio-off", "slot2-none"))
            key = (sid, v, int(r["location_area_id"]), methods[m], tuple(times), tuple(other))
            x = agg.setdefault(key, [0, 999, 0])
            x[0] += rarity
            x[1] = min(x[1], int(r["min_level"]))
            x[2] = max(x[2], int(r["max_level"]))
        out = {}
        for (sid, v, a, m, times, other), (rar, lo, hi) in sorted(agg.items()):
            e = {"v": VERSIONS[v], "a": a, "m": m, "r": rar, "l": [lo, hi]}
            if times:
                e["t"] = list(times)
            if other:
                e["c"] = list(other)
            out.setdefault(sid, []).append(e)
        return out

    # --- one species -----------------------------------------------------------------------------------------------
    def evolution(self, sid):
        row = self.q("SELECT evolves_from_species_id, evolution_chain_id FROM pokemon_species WHERE id=?", sid)[0]
        chain = [r[0] for r in self.q("SELECT id FROM pokemon_species WHERE evolution_chain_id=? AND id<=493 ORDER BY id", row[1])]
        into = [r[0] for r in self.q("SELECT id FROM pokemon_species WHERE evolves_from_species_id=? AND id<=493 ORDER BY id", sid)]
        how = None
        if row[0]:
            ev = self.q("SELECT * FROM pokemon_evolution WHERE evolved_species_id=? ORDER BY id", sid)
            parts = []
            for e in ev[:2]:
                t = TRIGGER.get(e["evolution_trigger_id"], "special")
                bits = []
                if e["minimum_level"]:
                    bits.append(f"level {e['minimum_level']}")
                if e["trigger_item_id"]:
                    bits.append(self.items.get(e["trigger_item_id"], "an item"))
                if e["held_item_id"]:
                    bits.append("holding " + self.items.get(e["held_item_id"], "an item"))
                if e["minimum_happiness"]:
                    bits.append("high friendship")
                if e["minimum_beauty"]:
                    bits.append("high beauty")
                if e["time_of_day"]:
                    bits.append("by " + e["time_of_day"])
                if e["known_move_id"]:
                    bits.append("knowing " + self.moves.get(e["known_move_id"], "a move"))
                if e["location_id"]:
                    bits.append("at " + self.locnames.get(e["location_id"], "a special place"))
                if e["gender_id"]:
                    bits.append({1: "female", 2: "male"}.get(e["gender_id"], ""))
                if e["relative_physical_stats"] is not None:
                    bits.append({1: "Attack above Defense", -1: "Attack below Defense", 0: "Attack equal to Defense"}.get(e["relative_physical_stats"], ""))
                if e["party_species_id"]:
                    bits.append("with " + self.names.get(e["party_species_id"], "a partner") + " in the party")
                if e["trade_species_id"]:
                    bits.append("traded for " + self.names.get(e["trade_species_id"], "a partner"))
                parts.append(t + (": " + ", ".join(b for b in bits if b) if bits else ""))
            how = "; or ".join(dict.fromkeys(parts))
        return {"from": self.names.get(row[0]) if row[0] else None, "into": [self.names[i] for i in into],
                "chain": [self.names[i] for i in chain], "how": how}

    def entries(self, sid):
        rows = self.q("SELECT version_id, flavor_text FROM pokemon_species_flavor_text WHERE species_id=? AND language_id=9 "
                      "AND version_id BETWEEN 1 AND 16 ORDER BY version_id", sid)
        out, by = [], {}
        for v, text in rows:
            k = dedupe_key(text)
            if k not in by:
                by[k] = {"id": f"{sid}.{len(out) + 1}", "text": tidy(text), "versions": [], "gen": VERSION_GEN[v]}
                out.append(by[k])
            if VERSIONS[v] not in by[k]["versions"]:
                by[k]["versions"].append(VERSIONS[v])
        return out

    def species(self, sid, encounters=None):
        s = self.q("SELECT * FROM pokemon_species WHERE id=?", sid)[0]
        p = self.q("SELECT height, weight FROM pokemon WHERE id=?", sid)[0]
        name = self.names[sid]
        try:
            types = rules.species(4, battle_name(name))["types"]
        except KeyError:
            types = []
        eggs = [EGG_NAMES.get(r[0], r[0]) for r in self.q(
            "SELECT e.identifier FROM pokemon_egg_groups p JOIN egg_groups e ON e.id=p.egg_group_id WHERE p.species_id=?", sid)]
        gr = int(s["gender_rate"])
        return {"id": sid, "name": name, "genus": self.genus.get(sid), "gen": int(s["generation_id"]), "types": types,
                "height_m": int(p["height"]) / 10, "weight_kg": int(p["weight"]) / 10,
                "color": self.colors.get(int(s["color_id"])) if s["color_id"] else None,
                "shape": self.shapes.get(int(s["shape_id"])) if s["shape_id"] else None,
                "habitat": self.habitats.get(s["habitat_id"]) if s["habitat_id"] else None,
                "egg_groups": eggs, "gender": "genderless" if gr == -1 else f"{(8 - gr) * 12.5:g}% male",
                "egg_cycles": int(s["hatch_counter"]), "growth": GROWTH.get(int(s["growth_rate_id"])),
                "catch_rate": int(s["capture_rate"]), "base_friendship": int(s["base_happiness"]) if s["base_happiness"] is not None else None,
                "baby": bool(int(s["is_baby"])), "legendary": bool(int(s["is_legendary"])), "mythical": bool(int(s["is_mythical"])),
                "abilities": rules.abilities(4, battle_name(name)), "evolution": self.evolution(sid), "entries": self.entries(sid),
                "encounters": (encounters or {}).get(sid, [])}

    def build(self):
        enc = self.encounters()
        return {"_note": "Built by biology/archive.py: every Gen I-IV Pokédex entry and the species' game data, by species "
                         "(canon and game data only, nothing interpreted).",
                "versions": VERSION_NAME, "areas": {str(k): v for k, v in self.areas().items()},
                "species": [self.species(sid, enc) for sid in range(1, 494)]}


def main():
    a = Archive()
    if len(sys.argv) > 1:
        sid = next(k for k, v in a.names.items() if v.lower() == sys.argv[1].lower())
        enc = a.encounters()
        print(json.dumps(a.species(sid, enc), indent=1, ensure_ascii=False)[:6000])
        return
    data = a.build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(s["entries"]) for s in data["species"])
    e = sum(len(s["encounters"]) for s in data["species"])
    print(f"{OUT}: 493 species, {n} distinct Pokédex entries, {e} encounter rows, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
