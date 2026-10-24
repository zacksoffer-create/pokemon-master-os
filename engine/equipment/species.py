"""Each generation's own numbers for the catch calculator: catch rate, base HP and Speed, types, and the weights the
Heavy Ball reads.

    python3 -I engine/equipment/species.py [PRET_DIR]     # engine/data_manifest/catch_species.json

Read from the games' data (sparse clones of the pret decompilations under PRET_DIR, the commits recorded in the
output): Crystal's data/pokemon/base_stats/*.asm (Gen 2), Emerald's src/data/pokemon/species_info.h (Gen 3; FireRed
shares it), Platinum's res/pokemon/*/data.json (Gen 4; HeartGold shares it), which also has each Pokédex weight in
pounds. The modern reference data differs for a few legendaries (Kyogre and Groudon 5 in Gens 3-4, Rayquaza 3, Dialga
and Palkia 30 in Gen 4), which is why these come from the games. Gender ratios and kilogram weights come from the
reference database (they didn't change across Gens 2-4).
"""
import json
import os
import re
import sqlite3
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
PRET = "/tmp/claude-0/-home-user/ec141e37-3c55-55e4-88d6-8cd37fdd0b67/scratchpad/pret"
OUT = os.path.join(ENGINE, "data_manifest", "catch_species.json")
DB = os.path.join(ENGINE, "data", "pokeref.sqlite")


def key(name):
    return re.sub(r"[^a-z0-9]", "", name.lower().replace("♀", "f").replace("♂", "m"))


def tname(t):
    t = t.replace("TYPE_", "").replace("_TYPE", "").replace("PSYCHIC", "PSYCHIC")
    return t.capitalize()


def gen2(root):
    out = {}
    folder = os.path.join(root, "pokecrystal", "data", "pokemon", "base_stats")
    for f in sorted(os.listdir(folder)):
        text = open(os.path.join(folder, f), encoding="utf-8").read()
        stats = [int(x) for x in re.search(r"db\s+([\d, ]+)\n\s*;\s*hp", text).group(1).split(",")]
        types = re.search(r"db (\w+), (\w+) ; type", text).groups()
        out[key(f[:-4])] = {"rate": int(re.search(r"db (\d+) ; catch rate", text).group(1)), "hp": stats[0], "spe": stats[3],
                            "types": sorted({tname(t) for t in types})}
    return out


def gen3(root):
    text = subprocess.run(["git", "-C", os.path.join(root, "pokeemerald"), "show", "HEAD:src/data/pokemon/species_info.h"],
                          capture_output=True, text=True, check=True).stdout
    out, parts = {}, re.split(r"\n\s*\[SPECIES_(\w+)\]\s*=", text)   # each entry is the text up to the next one
    for name, body in zip(parts[1::2], parts[2::2]):
        rate = re.search(r"\.catchRate\s*=\s*(\d+)", body)
        if not rate or name.startswith("OLD_UNOWN") or name == "NONE":
            continue
        types = re.search(r"\.types\s*=\s*\{\s*(\w+),\s*(\w+)\s*\}", body).groups()
        out[key(name)] = {"rate": int(rate.group(1)), "hp": int(re.search(r"\.baseHP\s*=\s*(\d+)", body).group(1)),
                                "spe": int(re.search(r"\.baseSpeed\s*=\s*(\d+)", body).group(1)), "types": sorted({tname(t) for t in types})}
    return out


def gen4(root):
    out, lbs = {}, {}
    folder = os.path.join(root, "pokeplatinum", "res", "pokemon")
    for f in sorted(os.listdir(folder)):
        path = os.path.join(folder, f, "data.json")
        if not os.path.exists(path):
            continue
        d = json.load(open(path, encoding="utf-8"))
        if "catch_rate" not in d:
            continue
        out[key(f)] = {"rate": d["catch_rate"], "hp": d["base_stats"]["hp"], "spe": d["base_stats"]["speed"],
                       "types": sorted({tname(t) for t in d["types"]})}
        w = (d.get("pokedex_data") or {}).get("weight_pounds")
        if w is not None:
            lbs[key(f)] = round(w * 10)
    return out, lbs


def build(root=PRET):
    db = sqlite3.connect(DB)
    names = {sid: n for sid, n in db.execute("select pokemon_species_id, name from pokemon_species_names where local_language_id=9 and pokemon_species_id<=493")}
    rows = db.execute("select s.id, s.gender_rate, p.weight from pokemon_species s join pokemon p on p.species_id=s.id and p.is_default=1 where s.id<=493")
    g2, g3 = gen2(root), gen3(root)
    g4, lbs = gen4(root)
    out = {}
    for sid, gr, w in rows:
        name, k = names[sid], key(names[sid])
        rec = {"n": sid, "gender_rate": gr, "weight": w, "lbs10": lbs.get(k)}
        for g, src in ((2, g2), (3, g3), (4, g4)):
            if k in src and sid <= {2: 251, 3: 386, 4: 493}[g]:
                rec[f"gen{g}"] = src[k]
        out[name] = rec
    missing = [n for n, r in out.items() if not all(f"gen{g}" in r for g in (2, 3, 4) if r["n"] <= {2: 251, 3: 386, 4: 493}[g])]
    commits = {r: subprocess.run(["git", "-C", os.path.join(root, r), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
               for r in ("pokecrystal", "pokeemerald", "pokeplatinum")}
    return {"_note": "Each generation's own catch rate, base HP and Speed and types (equipment/species.py), with weights for the Heavy Ball.",
            "commits": commits, "species": out, "missing": missing}


def main():
    data = build(sys.argv[1] if len(sys.argv) > 1 else PRET)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{OUT}: {len(data['species'])} species; missing a generation: {data['missing'] or 'none'}")


if __name__ == "__main__":
    sys.exit(main())
