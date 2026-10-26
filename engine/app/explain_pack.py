"""explain.json: the builder's explanations (docs/specs/BUILDER_UI_AND_INFORMATION_ARCHITECTURE.md §1-2).

    python3 -I engine/app/explain_pack.py        # app/data/explain.json (export.py runs it)

One information system for every builder, not explanations scattered across pages:
- natures: what each one raises and lowers, and the others that raise the same stat (to compare);
- abilities and held items: each game's own description (the in-game text, by version group: canon) and PokeAPI's
  summary of how it works (today's rules: the app says so, since Gens II-IV can differ);
- the mechanics (EVs, IVs, DVs and stat experience, natures, STAB, priority, Speed ties, Hidden Power): hand-written
  in engine/reference/mechanics.json, checked against the engine's own formulas.
- moves (v2, D-078): each game's own description of every move up to Gen IV (the builder's move dropdowns show it
  beside the battle pack's numbers and effect);
- natures also carry the flavours they like and dislike (the games' Berries, Poffins and Pokéblocks).
"""
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
RAW = os.path.join(ENGINE, "data", "raw")
OUT = os.path.join(HERE, "data", "explain.json")
EN = "9"
GEN_VG = {2: ["4", "3"], 3: ["6", "5", "7"], 4: ["10", "9", "8"]}   # the game whose text is read first, then the others of its generation
STAT_NAME = {"2": "Attack", "3": "Defense", "4": "Special Attack", "5": "Special Defense", "6": "Speed"}
STAT_KEY = {"2": "atk", "3": "def", "4": "spa", "5": "spd", "6": "spe"}


def rows(name):
    with open(os.path.join(RAW, f"{name}.csv"), encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def clean(s):
    s = re.sub(r"\s+", " ", (s or "").replace("­", "").replace("\f", " ")).strip()
    return s.replace("POKéMON", "Pokémon").replace("POKé BALL", "Poké Ball")


def natures():
    names = {r["nature_id"]: r["name"] for r in rows("nature_names") if r["local_language_id"] == EN}
    flavor = {r["contest_type_id"]: r["flavor"] for r in rows("contest_type_names") if r["local_language_id"] == EN}
    out = {}
    for r in rows("natures"):
        n = names[r["id"]]
        up, down = r["increased_stat_id"], r["decreased_stat_id"]
        likes, hates = flavor.get(r["likes_flavor_id"]), flavor.get(r["hates_flavor_id"])
        taste = {} if up == down else {"likes": likes, "dislikes": hates}
        if up == down:
            out[n] = {"up": None, "down": None, "line": "Neutral: changes no stat.", "taste": "No favourite flavour."}
        else:
            out[n] = {"up": STAT_KEY[up], "down": STAT_KEY[down],
                      "line": f"{STAT_NAME[up]} +10%, {STAT_NAME[down]} −10%.", **taste,
                      "taste": f"Likes {likes} food, dislikes {hates} (Berries, Poffins and Pokéblocks)."}
    for n, x in out.items():
        if x["up"]:
            x["same_up"] = sorted(m for m, y in out.items() if y["up"] == x["up"] and m != n)
    return out


def by_gen(table, key, ids):
    """{id: {gen: text}} from a flavor-text table, the generation's own games only."""
    got = {}
    for r in rows(table):
        if r.get("language_id", r.get("local_language_id")) != EN or r[key] not in ids:
            continue
        got.setdefault(r[key], {})[r["version_group_id"]] = clean(r["flavor_text"])
    out = {}
    for i, vg in got.items():
        out[i] = {str(g): next((vg[v] for v in vgs if v in vg), None) for g, vgs in GEN_VG.items()}
        out[i] = {g: t for g, t in out[i].items() if t}
    return out


def summaries(table, key, ids):
    return {r[key]: clean(r["short_effect"]) for r in rows(table) if r["local_language_id"] == EN and r[key] in ids}


def abilities():
    ab = {r["id"]: r for r in rows("abilities") if r["is_main_series"] == "1" and int(r["generation_id"]) <= 4}
    names = {r["ability_id"]: r["name"] for r in rows("ability_names") if r["local_language_id"] == EN and r["ability_id"] in ab}
    text = by_gen("ability_flavor_text", "ability_id", set(ab))
    summ = summaries("ability_prose", "ability_id", set(ab))
    return {names[i]: {"gen": int(ab[i]["generation_id"]), "game_text": text.get(i, {}), "summary": summ.get(i)}
            for i in sorted(ab, key=int) if i in names}


def items():
    gi = {}
    for r in rows("item_game_indices"):
        g = int(r["generation_id"])
        if g <= 4:
            gi.setdefault(r["item_id"], set()).add(g)
    names = {r["item_id"]: r["name"] for r in rows("item_names") if r["local_language_id"] == EN and r["item_id"] in gi}
    cats = {r["id"]: r["identifier"] for r in rows("item_categories")}
    it = {r["id"]: r for r in rows("items") if r["id"] in gi}
    text = by_gen("item_flavor_text", "item_id", set(it))
    summ = summaries("item_prose", "item_id", set(it))
    return {names[i]: {"gens": sorted(gi[i]), "category": cats.get(it[i]["category_id"]), "game_text": text.get(i, {}),
                       "summary": summ.get(i)} for i in sorted(it, key=int) if i in names}


def moves():
    """{move name: {gen: the game's own description}} for every move up to Gen IV."""
    mv = {r["id"]: r for r in rows("moves") if int(r["generation_id"]) <= 4}
    names = {r["move_id"]: r["name"] for r in rows("move_names") if r["local_language_id"] == EN and r["move_id"] in mv}
    text = by_gen("move_flavor_text", "move_id", set(mv))
    return {names[i]: {"game_text": text.get(i, {})} for i in sorted(mv, key=int) if i in names}


def families(mv, ab):
    """trainers/families.json (v2.1): moves and abilities that are one job in several forms (weather, screens, hazards,
    status). Every move and ability it names must be a real one, so a typo can't make a family quietly smaller."""
    with open(os.path.join(ENGINE, "trainers", "families.json"), encoding="utf-8") as fh:
        fam = json.load(fh)
    bad = []
    for fid in fam["order"]:
        for form in fam[fid]["forms"].values():
            bad += [m for m in form.get("moves", []) if m not in mv] + [a for a in form.get("abilities", []) if a not in ab]
            for side in ("thrive", "suffer"):
                bad += [m for m in form.get(side, {}).get("moves", {}) if m not in mv]
                bad += [a for a in form.get(side, {}).get("abilities", {}) if a not in ab]
    if bad:
        raise SystemExit(f"trainers/families.json names moves or abilities that don't exist: {sorted(set(bad))}")
    return fam


def main():
    with open(os.path.join(ENGINE, "reference", "mechanics.json"), encoding="utf-8") as fh:
        mech = json.load(fh)
    mv, ab = moves(), abilities()
    pack = {"_note": "Built by app/explain_pack.py from PokeAPI's CSVs and reference/mechanics.json. game_text is each "
                     "game's own description (canon); summary is PokeAPI's, written for today's rules.",
            "mechanics": mech["concepts"], "natures": natures(), "abilities": ab, "items": items(), "moves": mv,
            "families": families(mv, ab)}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{OUT}: {len(pack['natures'])} natures, {len(pack['abilities'])} abilities, {len(pack['items'])} items, {len(pack['moves'])} moves, "
          f"{len(pack['mechanics'])} mechanics, {len(pack['families']['order'])} move families, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
