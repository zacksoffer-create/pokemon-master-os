"""The Breeder Lab's data (docs/APP.md): every breedable line's egg moves in HeartGold/SoulSilver, each with the
breeding engine's shortest lineages (breeding/engine.py plan_lineage), its timing warnings and the line's
feasibility. Gen 4 rules at Blackthorn (D-044); the engine searches up to three generations of fathers.

The search takes about a second per move, so this runs once in parallel and writes engine/app/data/breeder.json;
the app reads it when the Breeder Lab opens. Re-run it after the reference data changes.

    python3 -I app/breeder_pack.py [processes]
"""
import json
import os
import sys
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

GAME = "heartgold"
_engine = None


def _get():
    global _engine
    if _engine is None:
        from breeding.engine import BreedingEngine
        from trainers.model import DB
        _engine = BreedingEngine(DB)
    return _engine


def chain(plan):
    """A plan as its steps, oldest father first: [father, what it learns itself, what it inherits, catchable]."""
    out, node = [], plan
    while node:
        out.append([node["father"], {m: r[0] for m, r in node["learns_itself"].items()}, node["inherits"],
                    bool(node.get("catchable_in_game"))])
        node = node["via"]
    return list(reversed(out))


def one(job):
    sid, move = job
    b = _get()
    name = b.ref.name(sid)
    try:
        p = b.plan_lineage(name, [move], GAME)
    except Exception as e:                          # a move the search can't read: say so, don't stop the run
        return sid, move, {"error": str(e)}
    return sid, move, {"egg": bool(p["egg_moves"]), "item": p["by_held_item"], "later": p["learn_after_hatching"],
                       "timing": p["timing"], "plans": [{"steps": x["steps"], "native": x["native"], "chain": chain(x)}
                                                        for x in p.get("plans", [])[:3]], "note": p.get("note")}


def families():
    b = _get()
    seen, out = set(), []
    for sid in range(1, 494):
        fam = tuple(sorted(b.ref.family(sid)))
        if fam in seen:
            continue
        seen.add(fam)
        base = fam[0]
        out.append({"sid": base, "family": [b.ref.name(s) for s in fam], "moves": b.egg_moves(b.ref.name(base), GAME),
                    "feasibility": b.feasibility(b.ref.name(base), GAME)})
    return out


def main(procs=4):
    fams = families()
    jobs = [(f["sid"], m) for f in fams if f["feasibility"].get("egg_moves_possible") for m in f["moves"]]
    print(f"{len(fams)} families, {len(jobs)} egg moves to plan", flush=True)
    results = {}
    with Pool(procs) as pool:
        for i, (sid, move, res) in enumerate(pool.imap_unordered(one, jobs, chunksize=4), 1):
            results.setdefault(sid, {})[move] = res
            if i % 200 == 0:
                print(f"  {i}/{len(jobs)}", flush=True)
    out = {"game": GAME, "rules": "Gen 4 (HeartGold/SoulSilver), up to three generations of fathers (D-044)", "lines": []}
    for f in fams:
        out["lines"].append({**f, "plans": results.get(f["sid"], {})})
    path = os.path.join(HERE, "data", "breeder.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"breeder.json {os.path.getsize(path) / 1024:.0f} KB", flush=True)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 4)
