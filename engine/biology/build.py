"""Field Biology, rebuilt in order (v1; rebuild.py's "biology" step).

    python3 -I engine/biology/build.py

archive.py (every Gen I-IV Pokédex entry and encounter) -> claims.py (sentences by domain, diet, guild, relationships)
-> dossier.py --check (the curated dossiers still cite what exists) -> ecology.py (communities, webs, analysis)
-> ecotypes.py (egg moves read as ecotypes) -> evidence.py --cohort (the packs dossiers are written from).
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = [["archive.py"], ["claims.py"], ["dossier.py", "--check"], ["ecology.py"], ["ecotypes.py"], ["evidence.py", "--cohort"]]

for step in STEPS:
    r = subprocess.run([sys.executable, "-I", os.path.join(HERE, step[0])] + step[1:], capture_output=True, text=True)
    last = (r.stdout.strip().splitlines() or [""])[-1]
    print(f"{step[0]:14} {last}")
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-2000:])
        sys.exit(r.returncode)
