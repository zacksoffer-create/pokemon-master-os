"""The organism pack (v2.8, docs/ORGANISM.md): every Gen I-IV species as an animal, for app/data/organism.json.

Read from what Blackthorn already holds, never re-derived:
- app/data/biology.json: genus, types, size, colour, the Gen 4 Pokédex's body shape, the Gen 3 habitat, egg groups,
  egg cycles, abilities with their game text, and every Pokédex entry (canon);
- app/data/capability.json: the size class the provisions read;
- app/data/estate.json: the habitat engine's climate, water and land;
- app/data/ecology.json: each species' diet guild in the food webs;
- app/data/dossiers.json: the first line of each dossier section that bears on survival (the 127 written so far);
- app/data/breeding.json: the line each species belongs to;
- app/data/wild.json: the windows it's about in the wild (HeartGold and SoulSilver's encounter times);
- data/pokeref.sqlite: the Gen IV characteristics (the text a Pokémon's best IV gives it), each nature's liked and
  disliked flavours, and each game's TMs and HMs with the species that can be taught them (mechanic).
Pokédex lines are picked for each part of the portrait by their words (organism.json → dex_keywords), HeartGold and
SoulSilver first.

    python3 -I engine/app/organism_pack.py
"""
import json
import os
import re
import sqlite3
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
DATA = os.path.join(HERE, "data")
OUT = os.path.join(DATA, "organism.json")
STAT_IDS = {1: "hp", 2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe"}
PREFER = ["HeartGold", "SoulSilver", "Platinum", "Diamond", "Pearl", "Crystal", "Gold", "Silver", "Emerald", "FireRed", "LeafGreen",
          "Ruby", "Sapphire", "Yellow", "Red", "Blue"]
SECTIONS = ("diet", "senses", "behavior", "social", "defense", "habitat")


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as fh:
        return json.load(fh)


def key(name):
    return re.sub(r"[^a-z0-9]", "", name.lower().replace("♀", "f").replace("♂", "m"))


def build():
    rules = json.load(open(os.path.join(ENGINE, "biology", "organism.json"), encoding="utf-8"))
    bio, cap, estate = load("biology.json"), load("capability.json"), load("estate.json")
    eco, dos, breed, wild = load("ecology.json"), load("dossiers.json")["dossiers"], load("breeding.json"), load("wild.json")
    names = {key(n): n for n in cap["facts"]}                    # the capability engine's spelling is the app's
    versions = bio["versions"]
    rank = {v: i for i, v in enumerate(PREFER)}
    guild = {}
    for web in eco["webs"].values():
        for n in web["nodes"]:
            if n.get("kind") == "pokemon" and n.get("guild") and n["name"] not in guild:
                guild[n["name"]] = n["guild"]
    base = {}
    sp_by_id = breed["species"]
    for sid, s in sp_by_id.items():
        root = s
        while root.get("f") is not None and str(root["f"]) in sp_by_id:
            root = sp_by_id[str(root["f"])]
        base[s["n"]] = root["n"]
    kw = {k: v for k, v in rules["dex_keywords"].items() if not k.startswith("_") and k != "class"}
    species = {}
    for s in bio["species"]:
        nm = names.get(key(s["name"]), s["name"])
        entries = []
        seen = set()
        for _, text, vs in sorted(s.get("e") or [], key=lambda e: min([rank.get(versions[i], 99) for i in e[2]] or [99])):
            t = " ".join(text.split())
            if t not in seen:
                seen.add(t)
                entries.append([t, [versions[i] for i in vs]])
        dex = {"about": entries[0] if entries else None}
        for part, words in kw.items():
            pat = re.compile(r"\b(" + "|".join(re.escape(w) for w in words) + r")\b", re.I)
            dex[part] = next((e for e in entries if pat.search(e[0])), None)
        hb = estate["habitat"].get(nm) or estate["habitat"].get(s["name"]) or [[], "any", "none", "medium", None]
        d = dos.get(nm) or dos.get(s["name"])
        dossier = None
        if d:
            dossier = {"summary": d.get("summary"), "status": d.get("status")}
            for sec in SECTIONS:
                lines = (d.get("sections") or {}).get(sec) or []
                first = next((x for x in lines if x.get("class") != "unknown"), None)
                dossier[sec] = [first["text"], first.get("class")] if first else None
        species[nm] = {"n": s["n"], "genus": s.get("genus"), "t": s["t"], "h": s.get("h"), "w": s.get("w"), "color": s.get("color"),
                       "shape": s.get("shape"), "hab": s.get("hab"), "eggs": s.get("eggs") or [], "cyc": s.get("cyc"),
                       "size": (cap["facts"].get(nm) or ["medium"])[0], "climate": hb[1], "water": hb[2], "zones": hb[0],
                       "guild": guild.get(nm), "line": base.get(nm, nm), "activity": wild["activity"].get(nm),
                       "abilities": s.get("ab") or [], "dex": dex, "dossier": dossier}
    line_guild = {}                                               # a species the food webs don't hold takes its line's guild
    for nm, sp in species.items():
        if sp["guild"] and sp["line"] not in line_guild:
            line_guild[sp["line"]] = (sp["guild"], nm)
    for nm, sp in species.items():
        if not sp["guild"] and sp["line"] in line_guild:
            sp["guild"], sp["guild_from"] = line_guild[sp["line"]]
    index = {key(nm): nm for nm in species}
    con = sqlite3.connect(os.path.join(ENGINE, "data", "pokeref.sqlite"))
    chars = {v: [None] * 5 for v in STAT_IDS.values()}
    for stat, mod, msg in con.execute("""SELECT c.stat_id, c.gene_mod_5, t.message FROM characteristics c JOIN characteristic_text t
                                          ON t.characteristic_id = c.id WHERE t.local_language_id = 9"""):
        chars[STAT_IDS[stat]][mod] = msg
    flav = {i: name.lower() for i, name in con.execute("SELECT contest_type_id, flavor FROM contest_type_names WHERE local_language_id = 9")}
    natures = {}
    for ident, up, down, likes, hates in con.execute("SELECT identifier, increased_stat_id, decreased_stat_id, likes_flavor_id, hates_flavor_id FROM natures"):
        natures[ident.capitalize()] = [STAT_IDS[up], STAT_IDS[down], flav[likes], flav[hates]] if up != down else [None, None, None, None]
    machines = {}                                                # each game's TMs and HMs, and which species each can teach (a bit per machine)
    for vg in sorted({v for k, v in rules["vg"].items() if not k.startswith("_")}):
        ms = con.execute("SELECT machine_number, move_id FROM machines WHERE version_group_id = ? ORDER BY machine_number", (vg,)).fetchall()
        pos = {mv: i for i, (_, mv) in enumerate(ms)}
        bits = {}
        for pid, mv in con.execute("SELECT DISTINCT pokemon_id, move_id FROM pokemon_moves WHERE version_group_id = ? AND pokemon_move_method_id = 4 "
                                   "AND pokemon_id <= 493", (vg,)):
            if mv in pos:
                bits.setdefault(pid, set()).add(pos[mv])
        have = {}
        for pid, on in bits.items():
            digits = [0] * ((len(ms) + 3) // 4)
            for i in on:
                digits[i // 4] |= 1 << (i % 4)
            have[str(pid)] = "".join("0123456789abcdef"[d] for d in digits)
        machines[str(vg)] = {"m": [[mv, ("TM%02d" % n) if n <= 100 else ("HM%02d" % (n - 100))] for n, mv in ms], "have": have}
    sys.path.insert(0, ENGINE)
    import rules as battle_rules                                  # the type chart and the defensive abilities, as the battle engine has them
    chart = {str(g): battle_rules.gen_data(g)["types"] for g in (2, 3, 4)}
    defend = {"abilities": {k: [g, t] for k, (g, t) in battle_rules.DEFENSIVE_ABILITIES.items()}, "filters": dict(battle_rules.SUPER_EFFECTIVE_FILTERS),
              "wonder_guard": battle_rules.WONDER_GUARD}
    return {"_note": "The organism pack (app/organism_pack.py): every species as an animal (from biology, dossiers, the food webs, the habitat engine "
                     "and the games' encounter times), the Gen IV characteristics and each nature's flavours, each game's TMs and HMs and who can be "
                     "taught them (machines[vg].have[species id]: a hex digit per four machines, bit i%4 of digit i//4), the type chart and "
                     "defensive abilities (rules.py's, for exposure), and the organism rules. Reference only.",
            "built": time.strftime("%Y-%m-%d"), "rules": rules, "species": species, "index": index, "characteristics": chars, "natures": natures,
            "machines": machines, "chart": chart, "defend": defend}


def main():
    pack = build()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    sp = pack["species"]
    print(f"{OUT}: {len(sp)} species ({sum(1 for s in sp.values() if s['dossier'])} with a dossier, {sum(1 for s in sp.values() if s['guild'])} with a diet guild, "
          f"{sum(1 for s in sp.values() if s['dex']['eats'])} with a Pokédex line on food), {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
