"""The trainer ecosystem's proposals (v1, D-077): checks trainers/ecosystem.json before the library reads it.

    python3 -I engine/trainers/ecosystem.py --check      # every proposed version and build
    python3 -I engine/trainers/ecosystem.py --list       # what the file adds, by trainer

The file adds versions beside canon/trainers.json (the 2K idea of many versions of one character: Ash at each
League, Gary as a rival and as a researcher, Paul before and after Lake Acuity, the anime's champions and rivals).
Everything in it is a proposal (status "proposed") until you approve it, and canon wins any id clash. A version here
must be playable in the 6v6 engine: a Gen IV game, six Pokémon from the first 493, and builds that pass the same
check every authored build passes (trainers/model.py Store.check, D-048: a move needs a game that teaches it, the
show, or a reason on record).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

from trainers.model import ECOSYSTEM, SLIDERS, Store  # noqa: E402

GEN4 = {"heartgold", "soulsilver", "platinum"}
KINDS = {"anime", "all-time", "custom"}
CAREER_KINDS = {"league", "gym", "frontier", "contest", "title", "rivalry", "milestone"}


def check(store=None):
    store = store or Store()
    with open(ECOSYSTEM, encoding="utf-8") as fh:
        eco = json.load(fh)
    errs, warns = [], []
    used = set()
    for tid, t in eco.get("trainers", {}).items():
        if not t.get("name"):
            errs.append(f"{tid}: no name")
        for vid, v in t.get("versions", {}).items():
            key = f"{tid}/{vid}"
            if key not in store.proposed:
                warns.append(f"{key}: canon already has this id, so the file's version is ignored")
                continue
            ver = store.trainers[tid].versions[vid]
            if v.get("game") not in GEN4:
                errs.append(f"{key}: game {v.get('game')!r} isn't Gen IV (the 6v6 engine plays Gen IV)")
            if v.get("kind", ver.kind) not in KINDS:
                errs.append(f"{key}: kind {v.get('kind')!r}")
            for s in SLIDERS:
                sl = (v.get("sliders") or {}).get(s)
                if not sl or not isinstance(sl.get("value"), int) or not 0 <= sl["value"] <= 100 or not sl.get("why"):
                    errs.append(f"{key}: slider {s} needs a value 0-100 and a why")
            if not v.get("era"):
                warns.append(f"{key}: no era (when in the show this version is)")
            try:
                team = store.team(ver)
            except KeyError as e:
                errs.append(f"{key}: build {e} isn't in the file")
                continue
            if len(team) != 6:
                errs.append(f"{key}: {len(team)} Pokémon (a 6v6 version needs six)")
            for b in team:
                used.add(b.id)
                if not b.moves or len(b.moves) > 4:
                    errs.append(f"{key} {b.species}: {len(b.moves or [])} moves")
                for f in store.check(b, v.get("game", "platinum")):
                    errs.append(f"{key} {b.species}: {f}")
                for m in store.move_basis(b, v.get("game", "platinum")):
                    if m["basis"] == "the show":
                        warns.append(f"{key} {b.species}: {m['move']} only from the show (no game teaches it)")
        for i, r in enumerate(t.get("career", [])):
            if r.get("kind") not in CAREER_KINDS:
                errs.append(f"{tid} career[{i}]: kind {r.get('kind')!r} (one of {', '.join(sorted(CAREER_KINDS))})")
            for vid in r.get("versions", []):
                if vid not in store.trainers.get(tid).versions:
                    errs.append(f"{tid} career[{i}]: unknown version {vid}")
    for i in eco.get("builds", {}):
        if i not in used:
            warns.append(f"build {i} isn't on any team")
    return errs, warns, eco


def main():
    if not os.path.exists(ECOSYSTEM):
        print(f"no {ECOSYSTEM} yet")
        return
    errs, warns, eco = check()
    if "--list" in sys.argv:
        for tid, t in eco["trainers"].items():
            print(f"{t['name']}: " + "; ".join(f"{vid} ({v['title']})" for vid, v in t["versions"].items()))
    for e in errs:
        print("ERROR", e)
    for w in warns:
        print("warn ", w)
    n = sum(len(t["versions"]) for t in eco["trainers"].values())
    print(f"{len(eco['trainers'])} trainers, {n} versions, {len(eco.get('builds', {}))} builds: {len(errs)} error(s), {len(warns)} warning(s)")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
