"""The fresh start (D-078, docs/design/V2_PLAN.md §1): the app's packs without the personal layer.

    python3 -I engine/app/fresh.py          # apply it to engine/app/data/*.json (export.py runs it last)
    python3 -I engine/app/fresh.py --show   # what it would take out, pack by pack, without writing

While engine/store/fresh_start.json says "on", every pack the export writes is passed through here, and the parts
that are your records come out:
- your Pokémon, builds and teams;
- the journey trainer and its versions;
- the party, residents, studbook and program;
- the journey's scouting files.

Nothing is deleted at the source: canon/ and docs/ keep it all, and turning the switch off and rebuilding brings it
back. What's left is the world and its reference: species, moves, trainers, the builds book, facilities, the
record.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
DATA = os.path.join(HERE, "data")
SWITCH = os.path.join(ENGINE, "store", "fresh_start.json")


def config():
    try:
        with open(SWITCH, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return {"on": False}


def on():
    return bool(config().get("on"))


def personal_build(bid, b):
    return b.get("provenance") == "yours" or bid.startswith(("yours:", "me:"))


def store(d):
    out = dict(d)
    out["builds"] = {k: b for k, b in d.get("builds", {}).items() if not personal_build(k, b)}
    out["versions"] = {k: v for k, v in d.get("versions", {}).items() if k in out["builds"]}
    out["aliases"] = {k: v for k, v in d.get("aliases", {}).items() if v in out["builds"]}
    out["individuals"], out["teams"], out["lines"], out["proposed_lines"] = {}, {}, [], []
    return out, {"builds": len(d.get("builds", {})) - len(out["builds"]), "individuals": len(d.get("individuals", {})),
                 "teams": len(d.get("teams", {})), "lines": len(d.get("lines", [])) + len(d.get("proposed_lines", []))}


def mine(vid, v):
    return vid.startswith("me/") or (v or {}).get("identity") == "me"


def library(d):
    out = dict(d)
    out["versions"] = {k: v for k, v in d["versions"].items() if not mine(k, v)}
    out["identities"] = {k: v for k, v in d.get("identities", {}).items() if k != "me"}
    cols = []
    for c in d.get("collections", []):
        members = [m for m in c.get("members", []) if not m.startswith("me/")]
        if members:
            cols.append({**c, "members": members})
    out["collections"] = cols
    return out, {"versions": len(d["versions"]) - len(out["versions"]), "collections": len(d.get("collections", [])) - len(cols)}


def hq(d):
    out = dict(d)
    gone = {k: len(d.get(k) or []) for k in ("chapters", "party", "residents", "program", "lineage", "fathers", "tinker", "world")}
    for k in gone:
        out[k] = []
    out["champion"] = {**d.get("champion", {}), "versions": [], "frame": "A fresh start: every team is yours to build."}
    out["rival"] = {"status": "blank", "roster": []}
    out["pens"] = {g: 0 for g in d.get("pens", {})}
    out["kpis"] = {**{k: 0 for k in d.get("kpis", {})}, **{k: d["kpis"][k] for k in ("decisions", "open_questions") if k in d.get("kpis", {})}}
    out["facilities"] = [{**f, "staff": {}, "evidence": {}, "one": {}, "story": {},
                          "open": sorted(set(f.get("open", [])) | set(f.get("staff", {})))} for f in d.get("facilities", [])]
    g = d.get("glasshouse") or {}
    if g:
        out["glasshouse"] = {**g, "eggs": [], "rooms": {n: {**r, "staff": {}, "one": {}, "open": sorted(set(r.get("open", [])) | set(r.get("staff", {})))}
                                                        for n, r in (g.get("rooms") or {}).items()}}
    out["single_points"], out["open_jobs"], out["staff_hires"] = [], [], []
    out["fresh"] = {"on": True, "since": config().get("since")}
    return out, gone


def roles4(d):
    out = dict(d)
    out["reads"] = {k: r for k, r in d["reads"].items() if not k.startswith(("me:", "yours:"))}
    out["errors"] = {k: r for k, r in d.get("errors", {}).items() if not k.startswith(("me:", "yours:"))}
    return out, {"reads": len(d["reads"]) - len(out["reads"])}


def scouting(d):
    out = dict(d)
    out["reports"] = [r for r in d["reports"] if not r.get("mine")]
    return out, {"reports": len(d["reports"]) - len(out["reports"])}


def battle(d):
    out = dict(d)
    out["lineups"], out["characters"], out["coaches"] = [], {}, {}
    return out, {"lineups": len(d.get("lineups", [])), "characters": len(d.get("characters", {}))}


def scout(d):
    out = dict(d)
    out["trainers"] = {k: v for k, v in d.get("trainers", {}).items() if k != "me"}
    return out, {"trainers": len(d.get("trainers", {})) - len(out["trainers"])}


def advance(d):
    out = dict(d)
    out["lineups"], out["chapters"], out["fresh"] = [], [], True
    return out, {"lineups": len(d.get("lineups", []))}


def advance_one(d):
    return {"id": d.get("id"), "sheets": [], "fresh": True}, {"sheets": len(d.get("sheets", []))}


PACKS = [("store.json", store), ("library.json", library), ("hq.json", hq), ("roles4.json", roles4),
         ("scouting.json", scouting), ("advance.json", advance),
         ("battle.json", battle), ("scout.json", scout)]


def apply(write=True, only=None):
    """Pass every pack (or only the named ones) through its filter. Returns {pack: what came out}."""
    if not on():
        return {}
    report = {}
    jobs = [(name, fn) for name, fn in PACKS] + \
           [(os.path.basename(p), advance_one) for p in sorted(glob.glob(os.path.join(DATA, "advance-*.json")))]
    if only is not None:
        jobs = [(name, fn) for name, fn in jobs if name in only or (fn is advance_one and "advance-*.json" in only)]
    for name, fn in jobs:
        path = os.path.join(DATA, name)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
        out, gone = fn(d)                      # every filter can run twice and change nothing the second time
        report[name] = gone
        if write:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    return report


def after(*names):
    """A pack script run on its own (not through export.py) calls this after it writes, so the fresh start holds
    whichever way a pack is made: after("battle.json"), after("advance.json", "advance-*.json")."""
    for name, gone in apply(only=set(names)).items():
        print(f"fresh start: {name}: " + (", ".join(f"{k} {v}" for k, v in gone.items() if v) or "nothing personal"))


def main(argv):
    if not on():
        print("the fresh start is off (engine/store/fresh_start.json): the packs keep your records")
        return
    report = apply(write="--show" not in argv)
    for name, gone in report.items():
        print(f"  {name:44} " + ", ".join(f"{k} {v}" for k, v in gone.items() if v) or "nothing personal")
    print(f"fresh start since {config().get('since')}: {'would take' if '--show' in argv else 'took'} the personal layer "
          f"out of {len(report)} packs")


if __name__ == "__main__":
    main(sys.argv[1:])
