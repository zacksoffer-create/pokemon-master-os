"""Rebuild everything the engines write, in dependency order, and say what changed.

    python3 -I engine/rebuild.py                 # every step; prints which output files changed and how
    python3 -I engine/rebuild.py --only reports,ranch     # just those steps (and nothing that depends on them)
    python3 -I engine/rebuild.py --list          # the steps, their commands and what each writes
    python3 -I engine/rebuild.py --breeder       # kept for old habits: the Breeder Lab data is part of app-data now

Before anything runs it fingerprints every output (docs/, engine/data_manifest/, engine/app/data/); afterwards it
compares, and writes the comparison to engine/data_manifest/last_rebuild.json: every file that changed, plus the
first few lines that differ in each, so a change is never invisible. The order is the dependency graph in
docs/levers/DEPENDENCIES.json: a step runs after every step whose files it reads.

Never sends anything to the Google Sheet: ranch/sheet.py only writes the call files (the live Sheet must not be
rebuilt that way; STATE.md B22, B23).
"""
import difflib
import hashlib
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PY = [sys.executable, "-I"]

# name, command (from engine/), what it writes, which steps it reads from
STEPS = [
    ("reports", PY + ["trainer_report.py", "all"], "docs/trainers/*.md, docs/trainers/data/*.json", []),
    ("reports-page", PY + ["trainer_report.py", "page"], "docs/trainers/trainer_reports.html", ["reports"]),
    ("packets", PY + ["battle/scouting_report.py"], "docs/scouting/<game>.md", []),
    ("packets-page", PY + ["battle/scouting_report.py", "--page"], "docs/scouting/scouting_file.html", []),
    ("studbook", PY + ["breeding/studbook_report.py"], "docs/BREEDING_LAB.md", []),
    ("census", PY + ["ranch/report.py"], "engine/data_manifest/ranch_census.json", []),
    ("dashboard", PY + ["ranch/dashboard.py"], "engine/data_manifest/blackthorn.json", []),
    ("sheet-calls", PY + ["ranch/sheet.py"], "engine/data_manifest/sheet/*.json (files only; never sent)", ["dashboard"]),
    ("store", PY + ["store/migrate.py"], "engine/store/out/*.json", []),
    ("trainer-library", PY + ["trainers/library.py"], "engine/data_manifest/trainer_library.json", []),
    ("assumptions", PY + ["store/assumptions.py"], "docs/design/ASSUMPTIONS.md", []),
    ("balls", PY + ["equipment/balls.py"], "engine/data_manifest/balls.json (checked against the games' code)", []),
    ("roles4", PY + ["trainers/team_roles.py", "--pack"], "engine/app/data/roles4.json, docs/roles/*", ["store"]),
    ("naming", PY + ["trainers/naming_list.py"], "docs/naming/ALL_COMBINATIONS.md, all_combinations.csv.gz, proposed_words.json", ["roles4"]),
    ("recognition", PY + ["trainers/recognition.py", "--calibrate"], "docs/recognition/CALIBRATION.md, engine/data_manifest/recognition_calibration.json", ["roles4", "store"]),
    ("biology", PY + ["biology/build.py"], "engine/data_manifest/biology/*.json, evidence/*.md (the archive, claims, webs, ecotypes)", []),
    ("app-data", PY + ["app/export.py"], "engine/app/data/*.json", ["reports", "packets-page", "dashboard", "roles4", "store", "recognition", "trainer-library", "assumptions", "balls", "biology"]),
    ("arena", ["node", os.path.join("..", "sixvsix", "cli", "arena-pack.mjs")], "engine/app/data/sixvsix.json, arena.json (the 6v6 engine and the Legends)", ["app-data"]),
    ("app", PY + ["app/build.py"], "engine/app/dist/ (zip, preview)", ["app-data", "arena"]),
]
WATCH = ["docs", os.path.join("engine", "data_manifest"), os.path.join("engine", "app", "data"),
         os.path.join("engine", "store", "out")]


def fingerprint():
    out = {}
    for top in WATCH:
        for dirpath, _, files in os.walk(os.path.join(ROOT, top)):
            for f in files:
                p = os.path.join(dirpath, f)
                with open(p, "rb") as fh:
                    out[os.path.relpath(p, ROOT)] = (hashlib.sha256(fh.read()).hexdigest(), p)
    return out


def snapshot(paths):
    """Keep the text of every watched file under 3 MB, so the comparison can quote the lines that moved."""
    out = {}
    for rel, (_, p) in paths.items():
        if os.path.getsize(p) < 3_000_000:
            try:
                with open(p, encoding="utf-8") as fh:
                    out[rel] = fh.read()
            except UnicodeDecodeError:
                pass
    return out


def lines_moved(a, b, n=3):
    if "\n" not in a[:20000] and len(a) > 2000:          # one-line JSON: quote around the first difference
        i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
        return {"before": [a[max(0, i - 120):i + 120]], "after": [b[max(0, i - 120):i + 120]]}
    d = [x for x in difflib.unified_diff(a.splitlines(), b.splitlines(), n=0, lineterm="") if x[:3] not in ("---", "+++")]
    old, new = [x[1:] for x in d if x.startswith("-")][:n], [x[1:] for x in d if x.startswith("+")][:n]
    for k in range(max(len(old), len(new))):            # a long line (a page's inline data): quote around where it moved
        p, q = (old[k] if k < len(old) else ""), (new[k] if k < len(new) else "")
        if max(len(p), len(q)) > 400:
            i = next((j for j in range(min(len(p), len(q))) if p[j] != q[j]), min(len(p), len(q)))
            if k < len(old): old[k] = p[max(0, i - 120):i + 120]
            if k < len(new): new[k] = q[max(0, i - 120):i + 120]
    return {"before": old, "after": new}


def order(only=None):
    names = [s[0] for s in STEPS]
    for i, (name, _, _, reads) in enumerate(STEPS):      # steps run in list order, so a step must come after what it reads
        late = [r for r in reads if r not in names[:i]]
        if late:
            raise SystemExit(f"rebuild.py: step {name} is listed before {', '.join(late)}, which it reads")
    if not only:
        return STEPS
    want, grew = set(only), True
    while grew:                                          # a step that reads a rebuilt step is rebuilt too
        grew = False
        for name, _, _, reads in STEPS:
            if name not in want and set(reads) & want:
                want.add(name)
                grew = True
    unknown = set(only) - set(names)
    if unknown:
        raise SystemExit(f"unknown step(s): {', '.join(sorted(unknown))} (see --list)")
    return [s for s in STEPS if s[0] in want]


def main(argv):
    if "--list" in argv:
        for name, cmd, writes, reads in STEPS:
            print(f"{name:13} {' '.join(cmd[2:]):42} -> {writes}" + (f"   (after {', '.join(reads)})" if reads else ""))
        return 0
    only = argv[argv.index("--only") + 1].split(",") if "--only" in argv else None
    steps = order(only)
    before = fingerprint()
    texts = snapshot(before)
    report, failed = {"started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "steps": []}, False
    for name, cmd, writes, _ in steps:
        if name == "app-data" and "--breeder" in argv:
            cmd = cmd + ["--breeder"]
        t = time.time()
        r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
        took = round(time.time() - t, 1)
        ok = r.returncode == 0
        report["steps"].append({"step": name, "command": " ".join(cmd[1:]), "ok": ok, "seconds": took,
                                "error": None if ok else (r.stderr or r.stdout)[-2000:]})
        print(f"{'ok ' if ok else 'FAIL'} {name:13} {took:7.1f} s   {writes}")
        if not ok:
            print((r.stderr or r.stdout)[-2000:])
            failed = True
            break
    after = fingerprint()
    changed = sorted(f for f in set(before) | set(after) if before.get(f, (None,))[0] != after.get(f, (None,))[0])
    report["changed"] = []
    for f in changed:
        entry = {"file": f, "status": "new" if f not in before else "gone" if f not in after else "changed"}
        if entry["status"] == "changed" and f in texts:
            try:
                with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
                    entry.update(lines_moved(texts[f], fh.read()))
            except UnicodeDecodeError:
                pass
        report["changed"].append(entry)
    out = os.path.join(HERE, "data_manifest", "last_rebuild.json")
    report["changed"] = [c for c in report["changed"] if c["file"] != os.path.relpath(out, ROOT)]
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1, ensure_ascii=False)
    print(f"\n{len(report['changed'])} output file(s) changed (details: engine/data_manifest/last_rebuild.json)")
    for c in report["changed"][:60]:
        print(f"  {c['status']:7} {c['file']}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
