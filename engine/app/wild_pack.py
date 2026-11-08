"""The Wild's pack (v2.7, docs/WILD.md): every place in Johto and Kanto as an expedition can meet it, for
app/data/wild.json.

- the rules (wilderness/wild.json), so the browser evaluates the same ones;
- the places and the links between them (biology/johto.json + kanto.json: the games' own map, class mechanic; biome,
  elevation and water are Blackthorn's reading, class inferred);
- each place's wild Pokémon by HeartGold/SoulSilver's morning, day and night (app/data/ranges.json, the games' own
  encounter tables: class mechanic): the place-level rate is the mean over its areas (floors, sections), with the
  window's rows added to the rows that hold all day. Rows that need a swarm, the radio or a story flag are left out,
  and so are gifts, trades and one-off Pokémon: what's left is what lives there;
- the encounter methods the place has (walking, surfing, the three rods, Headbutt, Rock Smash), which the terrain rules
  read as evidence about its ground;
- every species' active windows in the wild (when it appears in the tables at all), for the estate's day.

    python3 -I engine/app/wild_pack.py
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
OUT = os.path.join(HERE, "data", "wild.json")
METHODS = ("walk", "surf", "old-rod", "good-rod", "super-rod", "headbutt", "rock-smash")


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def build():
    rules = load(os.path.join(ENGINE, "wilderness", "wild.json"))
    johto, kanto = load(os.path.join(ENGINE, "biology", "johto.json")), load(os.path.join(ENGINE, "biology", "kanto.json"))
    ranges = load(os.path.join(HERE, "data", "ranges.json"))
    windows = rules["windows"]["order"]
    areas = ranges["areas"]
    nodes = {**johto["nodes"], **kanto["nodes"]}
    aliases = {k: v for k, v in rules["aliases"].items() if not k.startswith("_")}
    by_area = {}                                  # area index -> game -> [(species, method, rate, lo, hi, time)]
    for sp, games in ranges["species"].items():
        for g in rules["games"]:
            for a, method, rate, lo, hi, tm, cond in games.get(g, []):
                if method not in METHODS or cond:
                    continue
                by_area.setdefault(a, {}).setdefault(g, []).append((sp, method, rate, lo, hi, tm))
    name_of = {i: n for i, n in enumerate(areas)}
    places = {}
    for nid in sorted(nodes):
        n = nodes[nid]
        nm = aliases.get(nid, n["name"])
        mine = [i for i in sorted(by_area) if name_of[i] == nm or name_of[i].startswith(nm + " (")]
        enc, methods = {}, set()
        for g in rules["games"]:
            tables = {w: {} for w in windows}
            counted = [i for i in mine if g in by_area[i]]
            for i in counted:
                for sp, method, rate, lo, hi, tm in by_area[i][g]:
                    methods.add(method)
                    for w in windows:
                        if tm in ("", w):
                            k = (sp, method)
                            x = tables[w].setdefault(k, [0.0, lo, hi])
                            x[0] += rate
                            x[1], x[2] = min(x[1], lo), max(x[2], hi)
            enc[g] = {w: sorted(([sp, round(v[0] / len(counted), 2), v[1], v[2], method] for (sp, method), v in tables[w].items()),
                                key=lambda r: (-r[1], r[0], r[4])) for w in windows} if counted else {w: [] for w in windows}
        places[nid] = {"name": n["name"], "region": n["region"], "biome": n.get("biome", []), "elevation": n.get("elevation", "low"),
                       "water": n.get("water", []), "note": n.get("note"), "xy": n.get("xy"), "areas": [name_of[i] for i in mine],
                       "methods": [m for m in METHODS if m in methods], "enc": enc}
    activity = {}
    for sp, games in ranges["species"].items():
        seen = set()
        for g in rules["games"]:
            for a, method, rate, lo, hi, tm, cond in games.get(g, []):
                if method == "walk" and not cond:
                    seen.update(windows if tm == "" else [tm])
        if seen:
            activity[sp] = [w for w in windows if w in seen]
    edges = [list(e) for e in johto["edges"] + kanto["edges"]]
    return {"_note": "The Wild's pack (app/wild_pack.py): the rules, every Johto and Kanto place with its terrain evidence and wild Pokémon by "
                     "window, the links between places, and each species' active windows. Reference only: your expeditions are Journal rows.",
            "built": time.strftime("%Y-%m-%d"), "rules": rules, "places": places, "edges": edges, "activity": activity}


def main():
    pack = build()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    n_enc = sum(1 for p in pack["places"].values() if any(p["enc"]["heartgold"][w] for w in pack["rules"]["windows"]["order"]))
    print(f"{OUT}: {len(pack['places'])} places ({n_enc} with wild Pokémon in HeartGold), {len(pack['edges'])} links, "
          f"{len(pack['activity'])} species with active windows, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
