"""Evidence packs (Field Biology, v1 B5): everything Blackthorn holds about one species, as one readable page.

    python3 -I engine/biology/evidence.py Heracross          # print one pack
    python3 -I engine/biology/evidence.py --cohort           # engine/data_manifest/biology/evidence/<slug>.md for the cohort

A pack is what a curated dossier is written from, and what you read to check one: the species' game data, every Gen
I-IV Pokédex entry with its id and versions, what the machine reading found (feeding guild, habitats, relationships,
open questions), where it lives in every game (area, method, time of day, rarity, levels), its moves in HeartGold and
SoulSilver by how it learns them (level-up moves are what a wild one does; egg moves what a lineage can carry), its
abilities in the games' own words, and what the capability records already say. Nothing in a pack is interpreted
beyond the labelled machine reading.
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

DB = os.path.join(ENGINE, "data", "pokeref.sqlite")
MAN = os.path.join(ENGINE, "data_manifest", "biology")
OUT = os.path.join(MAN, "evidence")
COHORT = {
    "your companions": ["Feraligatr", "Miltank", "Donphan", "Ampharos", "Umbreon", "Espeon", "Charizard", "Blastoise", "Venusaur",
                        "Alakazam", "Jolteon", "Machamp", "Swampert", "Milotic", "Altaria", "Arcanine", "Absol", "Meganium", "Infernape",
                        "Weavile", "Roserade", "Lucario", "Garchomp", "Magnezone", "Pikachu", "Dragonite", "Empoleon", "Gengar", "Scizor",
                        "Typhlosion", "Tyranitar", "Mamoswine", "Crobat", "Lapras", "Snorlax"],
    "Ilex Forest": ["Caterpie", "Metapod", "Butterfree", "Weedle", "Kakuna", "Beedrill", "Oddish", "Paras", "Zubat", "Hoothoot",
                    "Noctowl", "Pineco", "Psyduck", "Golduck", "Poliwag", "Magikarp"],
    "the Blackthorn highlands": ["Dratini", "Dragonair", "Swinub", "Delibird", "Jynx", "Geodude", "Graveler", "Golbat", "Wobbuffet",
                                 "Dunsparce", "Goldeen", "Seaking", "Magcargo"],
}
METHOD = {1: "level-up", 2: "egg", 3: "tutor", 4: "machine"}


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("♀", "-f").replace("♂", "-m")).strip("-")


class Evidence:
    def __init__(self):
        with open(os.path.join(MAN, "archive.json"), encoding="utf-8") as fh:
            self.archive = json.load(fh)
        with open(os.path.join(MAN, "claims.json"), encoding="utf-8") as fh:
            self.claims = json.load(fh)
        self.sp = {s["name"]: s for s in self.archive["species"]}
        self.cl = {s["name"]: s for s in self.claims["species"]}
        self.db = sqlite3.connect(DB)
        self.moves = {r[0]: r[1] for r in self.db.execute("SELECT move_id, name FROM move_names WHERE local_language_id=9")}
        self.ab_ids = {r[1]: r[0] for r in self.db.execute("SELECT ability_id, name FROM ability_names WHERE local_language_id=9")}
        self.ab_text = {}
        with open(os.path.join(ENGINE, "data", "raw", "ability_flavor_text.csv"), encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                if r["language_id"] == "9" and r["version_group_id"] == "10":
                    self.ab_text[int(r["ability_id"])] = " ".join(r["flavor_text"].split())
        cap = os.path.join(ENGINE, "app", "data", "capability.json")
        self.cap = json.load(open(cap, encoding="utf-8")) if os.path.exists(cap) else None

    def learnset(self, sid):
        pid = self.db.execute("SELECT id FROM pokemon WHERE species_id=? AND is_default=1", (sid,)).fetchone()[0]
        out = {}
        for mid, meth, lvl in self.db.execute("SELECT move_id, pokemon_move_method_id, level FROM pokemon_moves WHERE pokemon_id=? "
                                              "AND version_group_id=10 ORDER BY pokemon_move_method_id, level, \"order\"", (pid,)):
            if meth in METHOD:
                name = self.moves.get(mid, str(mid))
                out.setdefault(METHOD[meth], [])
                label = f"{name} (Lv {lvl})" if meth == 1 and lvl else name
                if label not in out[METHOD[meth]]:
                    out[METHOD[meth]].append(label)
        return out

    def capability(self, name):
        if not self.cap:
            return []
        rows = self.cap["games"]["heartgold"]["records"].get(name, [])
        out = []
        for j in rows:
            cap_, kind, s, d, x = self.cap["rows"][j]
            out.append(f"{cap_} ({kind}): {self.cap['sources'][s]}")
        return out

    def pack(self, name):
        s, c = self.sp[name], self.cl[name]
        areas = self.archive["areas"]
        L = [f"# Evidence pack: {name} (#{s['id']:03d})", "",
             "Everything Blackthorn holds about this species. Entry ids (like `214.3`) and claim ids (like `C214.5`) are what a "
             "dossier cites.", "", "## Game data", "",
             f"- Category: {s['genus']} · introduced in Generation {s['gen']} · types (Gen 4): {' / '.join(s['types'])}",
             f"- Height {s['height_m']} m · weight {s['weight_kg']} kg · colour {s['color']} · Gen 4 body shape: {s['shape']} · "
             f"Gen 3 Pokédex habitat: {s['habitat'] or 'none given'}",
             f"- Egg groups: {', '.join(s['egg_groups'])} · gender: {s['gender']} · egg cycles: {s['egg_cycles']} · growth: {s['growth']} · "
             f"catch rate {s['catch_rate']} · base friendship {s['base_friendship']}" + (" · legendary" if s["legendary"] else "") + (" · mythical" if s["mythical"] else "") + (" · a baby Pokémon" if s["baby"] else ""),
             f"- Evolution: line {' → '.join(s['evolution']['chain'])}" + (f"; evolves from {s['evolution']['from']} ({s['evolution']['how']})" if s["evolution"]["from"] else "")
             + (f"; evolves into {', '.join(s['evolution']['into'])}" if s["evolution"]["into"] else ""),
             "- Abilities (Gen 4, the games' own words): " + "; ".join(f"{a}: {self.ab_text.get(self.ab_ids.get(a), '')}" for a in s["abilities"]), "",
             "## Every Pokédex entry, Gen I–IV", ""]
        for e in s["entries"]:
            L.append(f"- `{e['id']}` ({', '.join(e['versions'])}): {e['text']}")
        g = c["guild"]
        L += ["", "## What the machine reading found (pattern-based; yours to correct)", "",
              f"- Feeding guild: **{g['guild']}** ({g['means']}); from {g['basis'] or 'nothing'}; confidence {g['confidence']}; "
              f"diet categories: {', '.join(f'{k} ({', '.join(v)})' for k, v in c['diet'].items()) or 'none stated'}",
              f"- Habitat words: {', '.join(f'{k} ({', '.join(v)})' for k, v in c['habitats'].items()) or 'none'} · activity: {c['activity'] or 'not stated'} · social: {c['social'] or 'not stated'}",
              f"- Other species named: {'; '.join(sorted(set(r['b'] + ' (' + r['kind'] + ', ' + r['claim'] + ')' for r in c['relationships']))) or 'none'}",
              f"- Nothing said about: {', '.join(c['open']) or '—'}", "", "### Claims", ""]
        for cl in c["claims"]:
            L.append(f"- `{cl['id']}` [{', '.join(cl['domains']) or '—'}]{' (folklore)' if cl.get('folklore') else ''} {cl['text']} — {', '.join(cl['src'])}")
        L += ["", "## Where it lives (encounters, every Gen I–IV game)", ""]
        by = {}
        for e in s["encounters"]:
            a = areas[str(e["a"])]
            key = (e["v"], a["area"])
            cond = (("/" + ",".join(e["t"])) if e.get("t") else "") + ((" [" + ",".join(e["c"]) + "]") if e.get("c") else "")
            by.setdefault(key, []).append(f"{e['m']}{cond} {e['r']}% Lv{e['l'][0]}-{e['l'][1]}")
        games = {}
        for (v, area), xs in by.items():
            games.setdefault(v, []).append(f"{area}: {'; '.join(xs)}")
        for v in self.archive["versions"]:
            if v in games:
                L.append(f"- **{self.archive['versions'][v]}**: " + " · ".join(games[v][:14]) + (" · …" if len(games[v]) > 14 else ""))
        if not games:
            L.append("- Not found in the wild in any Gen I–IV game (gift, trade, evolution or event only).")
        ls = self.learnset(s["id"])
        L += ["", "## Moves in HeartGold/SoulSilver (how it learns them)", ""]
        for k in ("level-up", "egg", "tutor", "machine"):
            if ls.get(k):
                L.append(f"- {k}: {', '.join(ls[k])}")
        caps = self.capability(name)
        if caps:
            L += ["", "## What the capability records already say (HeartGold)", ""] + [f"- {x}" for x in caps]
        return "\n".join(L) + "\n"


def main():
    ev = Evidence()
    if "--cohort" in sys.argv:
        os.makedirs(OUT, exist_ok=True)
        n = 0
        for group, names in COHORT.items():
            for nm in names:
                with open(os.path.join(OUT, slug(nm) + ".md"), "w", encoding="utf-8") as fh:
                    fh.write(ev.pack(nm))
                n += 1
        print(f"{OUT}: {n} evidence packs")
        return
    print(ev.pack(sys.argv[1] if len(sys.argv) > 1 else "Heracross"))


if __name__ == "__main__":
    main()
