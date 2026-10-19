"""The trainer scouting report, Part 1 (docs/TRAINER_REPORT.md): how to attack a trainer's team.

    python3 -I trainer_report.py list                              # trainers and versions
    python3 -I trainer_report.py report paul [sinnoh] [--json]     # one report
    python3 -I trainer_report.py exposure me/heartgold --vs paul/sinnoh [--json]   # where your team is exposed
    python3 -I trainer_report.py all                               # every report -> docs/trainers/ (markdown + data)
    python3 -I trainer_report.py page                              # the Trainer Scouting Reports page

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


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["list", "report", "exposure", "all", "page"])
    ap.add_argument("who", nargs="*")
    ap.add_argument("--vs")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--level", type=int)
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


if __name__ == "__main__":
    main()
