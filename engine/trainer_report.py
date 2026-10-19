"""The trainer scouting report, Part 1 (docs/TRAINER_REPORT.md): how to attack a trainer's team.

    python3 -I trainer_report.py list                              # trainers and versions
    python3 -I trainer_report.py report paul [sinnoh] [--json]     # one report
    python3 -I trainer_report.py exposure me/heartgold --vs paul/sinnoh [--json]   # where your team is exposed
    python3 -I trainer_report.py all                               # every report -> docs/trainers/ (markdown + data)
    python3 -I trainer_report.py page                              # the Trainer Scouting Reports page
    python3 -I trainer_report.py roles me/heartgold                # Part 2: each member's roles, and why
    python3 -I trainer_report.py roles stock/skarmory --game platinum   # one library build's roles
    python3 -I trainer_report.py build Garchomp --role physical_setup_sweeper --game platinum \
        [--lock item="Life Orb" --lock moves="Swords Dance,Earthquake"] [--scope any]  # role → build
    python3 -I trainer_report.py reachable Garchomp --game platinum [--lock …]    # which roles the locks allow
    python3 -I trainer_report.py reachable stock/garchomp-sweeper --keep moves,item   # locks from a build
    python3 -I trainer_report.py archetypes Garchomp --game platinum          # species → archetypes
    python3 -I trainer_report.py distance me/heartgold                        # each build vs its closest archetype

Options: --level N reads every row at level N (the config's level scale otherwise).
Deterministic: the same trainer and team always produce the same report. No damage calculations, no simulation.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from trainers.model import Store  # noqa: E402
from trainers.report import build_report, exposure, render, render_exposure  # noqa: E402

DOCS = os.path.join(os.path.dirname(HERE), "docs", "trainers")


def ref(text):
    tid, _, vid = text.partition("/")
    return tid, vid or None


def every(store, level=None):
    out = []
    for tid, t in store.trainers.items():
        for vid in t.versions:
            out.append(build_report(store, tid, vid, level))
    return out


def write_all(store, level=None):
    os.makedirs(os.path.join(DOCS, "data"), exist_ok=True)
    reports = every(store, level)
    index = ["# Trainer scouting reports", "",
             "How to attack each trainer's team (docs/TRAINER_REPORT.md). Each report has a readable page here and "
             "plain data in `data/` for Part 2. Rebuild with `python3 -I engine/trainer_report.py all`.", "",
             "| Trainer | Version | Game | Gaps | Bring |", "|---|---|---|---|---|"]
    for rep in reports:
        name = f"{rep['trainer']}-{rep['version']}"
        with open(os.path.join(DOCS, f"{name}.md"), "w", encoding="utf-8") as fh:
            fh.write(render(rep) + "\n")
        with open(os.path.join(DOCS, "data", f"{name}.json"), "w", encoding="utf-8") as fh:
            json.dump(rep, fh, indent=1, ensure_ascii=False)
            fh.write("\n")
        s = rep["matrix"]["summary"]
        index.append(f"| {rep['trainer_name']} | [{rep['title']}]({name}.md) | {rep['game']} | "
                     f"{', '.join(s['gaps'][:3]) or 'none'} | {s['bring']} |")
    with open(os.path.join(DOCS, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(index) + "\n")
    print(f"wrote {len(reports)} reports to {DOCS}")
    return reports


def write_page(store, path=None, level=None):
    reports = every(store, level)
    mine = [(tid, vid) for tid, t in store.trainers.items() if tid == "me" for vid in t.versions]
    exposures = {}
    for rep in reports:
        if rep["trainer"] == "me":
            continue
        for m in mine:
            exposures[f"{m[0]}/{m[1]}|{rep['trainer']}/{rep['version']}"] = exposure(store, m, (rep["trainer"], rep["version"]), level)
    data = {"reports": reports, "exposures": exposures,
            "mine": [{"id": f"{tid}/{vid}", "title": store.trainers[tid].versions[vid].title} for tid, vid in mine],
            "verdicts": [r["verdict"] for r in store.config["verdicts"]["rules"]]}
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    with open(os.path.join(HERE, "trainers", "page.html"), encoding="utf-8") as fh:
        page = fh.read().replace("/*DATA*/", blob)
    path = path or os.path.join(DOCS, "trainer_reports.html")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(page)
    print("wrote", path)


def roles(store, who, game=None, level=None, as_json=False):
    """Each build's roles: a library build ("stock/skarmory") or every member of a version ("paul/sinnoh")."""
    from trainers.roles import RoleBook
    book = RoleBook(store)
    if who in store.library:
        builds, game = [store.library[who]], game or store.config["lens"]["default_game"]
    else:
        v = store.version(*ref(who))
        builds, game = store.team(v), game or v.game
    out = [book.classify(b, game, level) for b in builds]
    if as_json:
        print(json.dumps(out, indent=1, ensure_ascii=False, default=sorted))
        return
    for b, r in zip(builds, out):
        p, s = r["primary"], r["secondary"]
        head = f"{b.species}: {p['name']} ({p['confidence']}, {p['score']:.2f})"
        if s:
            head += f", then {s['name']} ({s['confidence']}, {s['score']:.2f})"
        if r["also"]:
            head += "; also " + ", ".join(a["name"] for a in r["also"])
        print(head)
        print("   " + book.line(r))


def parse_locks(items, store=None, build=None, keep=None):
    """--lock key=value pairs (and --keep fields from a build) → the solver's locks."""
    locks = {}
    if build is not None and keep:
        for f in keep.split(","):
            v = getattr(build, f.strip())
            if v:
                locks[f.strip()] = list(v) if f.strip() == "moves" else dict(v) if isinstance(v, dict) else v
    for item in items:
        k, _, v = item.partition("=")
        k = k.strip()
        if k == "moves":
            locks[k] = [m.strip() for m in v.split(",") if m.strip()]
        elif k in ("evs", "ivs"):
            locks[k] = {p.split("=")[0].strip(): int(p.split("=")[1]) for p in v.split(",") if "=" in p}
        else:
            locks[k] = v.strip()
    return locks


def role_id(book, text):
    if text in book.roles:
        return text
    for rid, r in book.roles.items():
        if r["name"].lower() == text.lower().replace("_", " "):
            return rid
    raise SystemExit(f"unknown role {text}; roles: {', '.join(book.roles)}")


def solver_cmd(store, a):
    from trainers.roles import RoleBook
    from trainers.solver import Solver, render_archetypes, render_reachable, render_solve
    book = RoleBook(store)
    sv = Solver(book)
    who = a.who[0]
    game = a.game or store.config["lens"]["default_game"]
    if a.cmd == "distance":
        if who in store.library:
            builds = [store.library[who]]
        else:
            v = store.version(*ref(who))
            builds, game = store.team(v), a.game or v.game
        out = [sv.distance(b, game, a.level) for b in builds]
        if a.json:
            print(json.dumps(out, indent=1, ensure_ascii=False))
        else:
            for b, d in zip(builds, out):
                print(f"{b.species}: {d['line']}")
        return
    build = store.library.get(who)
    species = build.species if build else who
    locks = parse_locks(a.lock, store, build, a.keep)
    if a.cmd == "build":
        r = sv.solve(species, role_id(book, a.role), game, locks, a.scope, a.level)
        print(json.dumps(r, indent=1, ensure_ascii=False, default=list) if a.json else render_solve(r))
    elif a.cmd == "reachable":
        rows = sv.reachable(species, game, locks, a.scope, a.level)
        print(json.dumps(rows, indent=1, ensure_ascii=False) if a.json else render_reachable(species, rows))
    elif a.cmd == "archetypes":
        r = sv.archetypes(species, game, a.level)
        print(json.dumps(r, indent=1, ensure_ascii=False) if a.json else render_archetypes(r))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["list", "report", "exposure", "all", "page", "roles", "build", "reachable",
                                    "archetypes", "distance"])
    ap.add_argument("who", nargs="*")
    ap.add_argument("--vs")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--level", type=int)
    ap.add_argument("--game", help="the game to read a library build in (roles)")
    ap.add_argument("--role", help="the role to build for (trainers/roles.json id or name)")
    ap.add_argument("--lock", action="append", default=[], help='pin a field: moves="A,B" item=… nature=… '
                                                                'ability=… evs="atk=252,spe=252" ivs="spe=0"')
    ap.add_argument("--keep", help="with a build id: the fields to lock from it (moves,item,nature,ability,evs,ivs)")
    ap.add_argument("--scope", choices=["game", "any"], help="moves from this game only (default) or any game (D-048)")
    a = ap.parse_args(argv)
    store = Store()
    if a.cmd == "list":
        for tid, t in store.trainers.items():
            for vid, v in t.versions.items():
                print(f"{tid}/{vid:22} {v.title}  [{v.game}, {v.status}]")
    elif a.cmd == "report":
        rep = build_report(store, a.who[0], a.who[1] if len(a.who) > 1 else None, a.level)
        print(json.dumps(rep, indent=1, ensure_ascii=False) if a.json else render(rep))
    elif a.cmd == "exposure":
        exp = exposure(store, ref(a.who[0]), ref(a.vs), a.level)
        print(json.dumps(exp, indent=1, ensure_ascii=False) if a.json else render_exposure(exp, store))
    elif a.cmd == "all":
        write_all(store, a.level)
    elif a.cmd == "page":
        write_page(store, a.who[0] if a.who else None, a.level)
    elif a.cmd == "roles":
        roles(store, a.who[0], a.game, a.level, a.json)
    elif a.cmd in ("build", "reachable", "archetypes", "distance"):
        solver_cmd(store, a)


if __name__ == "__main__":
    main()
