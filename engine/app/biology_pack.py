"""Field Biology for the app (v1, D-077; docs/BIOLOGY.md, docs/ECOLOGY.md): five packs, each loaded only by the pages
that need it (web/36_ecology.html, 95_biology.html).

    python3 -I app/biology_pack.py        # engine/app/data/{biology,dossiers,ecology,ecotypes,ranges}.json (export.py runs it)

- biology.json   every Gen I-IV species' natural history: game data, every Pokédex entry (all 16 versions, with ids),
                 the claims they split into, and the machine reading (diet, guild, habitats, activity, relationships,
                 what nobody has said): the field guide's source for all 493
- dossiers.json  the curated dossiers (biology/dossiers/), each statement with its evidence class and citations
- ecology.json   Johto as a landscape, every place's community, and the food webs with their analysis (biology/ecology.py)
- ecotypes.json  egg moves read as ecotypes, curated and machine (biology/ecotypes.py), compact, with the reading of
                 every Gen I-IV move by the same rules (the breeding-stock page reads whole starting sets with it)
- ranges.json    where each species lives in every Gen I-IV game (area, method, rate, levels, time, conditions)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

from biology import claims as C  # noqa: E402
from biology.evidence import Evidence  # noqa: E402

MAN = os.path.join(ENGINE, "data_manifest", "biology")
OUT = os.path.join(HERE, "data")
DOS = os.path.join(ENGINE, "biology", "dossiers")


def load(name):
    with open(os.path.join(MAN, name), encoding="utf-8") as fh:
        return json.load(fh)


def dump(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


def main():
    archive, claims = load("archive.json"), {s["name"]: s for s in load("claims.json")["species"]}
    ev = Evidence()
    vcode = {v: i for i, v in enumerate(archive["versions"])}
    sp = []
    for s in archive["species"]:
        c = claims[s["name"]]
        sp.append({
            "n": s["id"], "name": s["name"], "genus": s["genus"], "gen": s["gen"], "t": s["types"], "h": s["height_m"], "w": s["weight_kg"],
            "color": s["color"], "shape": s["shape"], "hab": s["habitat"], "eggs": s["egg_groups"], "gender": s["gender"], "cyc": s["egg_cycles"],
            "growth": s["growth"], "catch": s["catch_rate"], "fr": s["base_friendship"],
            "flags": [k for k in ("legendary", "mythical", "baby") if s.get(k)], "evo": s["evolution"],
            "ab": [[a, ev.ab_text.get(ev.ab_ids.get(a), "")] for a in s["abilities"]],
            "e": [[e["id"], e["text"], [vcode[v] for v in e["versions"]]] for e in s["entries"]],
            "c": [[x["id"], x["text"], x["src"], x["domains"], 1 if x.get("folklore") else 0] for x in c["claims"]],
            "diet": c["diet"], "guild": c["guild"], "hw": c["habitats"], "act": c["activity"], "soc": c["social"],
            "rel": [[r["b"], r["kind"], r["claim"]] for r in c["relationships"]], "open": c["open"],
        })
    sizes = {"biology.json": dump("biology.json", {"_note": "app/biology_pack.py from engine/biology/ (archive.py, claims.py)", "versions": list(archive["versions"].values()),
                                                   "domains": list(C.DOMAINS), "guilds": {k: list(v) for k, v in C.GUILDS.items()}, "species": sp})}
    dos = {}
    if os.path.isdir(DOS):
        for f in sorted(os.listdir(DOS)):
            if f.endswith(".json"):
                with open(os.path.join(DOS, f), encoding="utf-8") as fh:
                    d = json.load(fh)
                dos[d["species"]] = d
    sizes["dossiers.json"] = dump("dossiers.json", {"_note": "the curated dossiers (engine/biology/dossiers/), drafts until approved", "dossiers": dos})
    eco = load("ecology.json")
    sizes["ecology.json"] = dump("ecology.json", eco)
    et = load("ecotypes.json")
    sizes["ecotypes.json"] = dump("ecotypes.json", {"functions": et["functions"], "type_fn": et["type_fn"], "moves": et["moves"], "species": {k: {
        "e": v["egg_moves"], "f": v["functions"], "cur": v["curated"],
        "m": [[m["name"], m["functions"], m["moves"], m["where"], m["fits"]] for m in v["machine"]]} for k, v in et["species"].items() if v["egg_moves"] or v["curated"]}})
    areas = archive["areas"]
    names = sorted({a["area"] for a in areas.values()})
    idx = {n: i for i, n in enumerate(names)}
    rng = {}
    for s in archive["species"]:
        g = {}
        for e in s["encounters"]:
            g.setdefault(e["v"], []).append([idx[areas[str(e["a"])]["area"]], e["m"], e["r"], e["l"][0], e["l"][1], ",".join(e.get("t", [])), ",".join(e.get("c", []))])
        if g:
            rng[s["name"]] = g
    sizes["ranges.json"] = dump("ranges.json", {"areas": names, "species": rng})
    for k, v in sizes.items():
        print(f"{k:16} {v / 1024:7.1f} KB")


if __name__ == "__main__":
    main()
