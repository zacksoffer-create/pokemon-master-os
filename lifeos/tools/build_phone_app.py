"""Build the phone app (LIFE OS: Story) into docs/play/ at the repository root, ready for GitHub Pages.

    python lifeos/tools/build_phone_app.py

What it does:
  1. builds the phone screens (vite.play.config.ts) into docs/play/
  2. copies the Python-in-the-browser runtime (Pyodide) into docs/play/pyodide/
  3. packs the game engine (backend/lifeos, backend/data, the FastAPI stand-in, openpyxl) into docs/play/engine.zip
  4. stamps the offline cache with a build id
Needs Node (npm install in lifeos/frontend first).
"""
import hashlib
import io
import os
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
LIFEOS = os.path.dirname(HERE)
REPO = os.path.dirname(LIFEOS)
FRONT = os.path.join(LIFEOS, "frontend")
BACK = os.path.join(LIFEOS, "backend")
OUT = os.path.join(REPO, "docs", "play")   # only this folder is replaced; the rest of docs/ is left alone
PYODIDE_FILES = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]


def run(cmd, cwd):
    print("$", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd, check=True, shell=(os.name == "nt"))


def engine_zip() -> bytes:
    """The engine, with its own build stamp inside (lifeos/engine_build.txt: a hash of everything in it), so the phone can
    show which engine it's actually running."""
    raw = io.BytesIO()
    with zipfile.ZipFile(raw, "w", zipfile.ZIP_DEFLATED) as z:
        for sub, exts in (("lifeos", (".py",)), ("data", (".json",))):
            for dirpath, dirs, files in os.walk(os.path.join(BACK, sub)):  # data/ includes data/dialogue/ (built-in packs)
                dirs[:] = sorted(d for d in dirs if d != "__pycache__")
                for f in sorted(files):
                    if f.endswith(exts):
                        full = os.path.join(dirpath, f)
                        z.write(full, f"{sub}/" + os.path.relpath(full, os.path.join(BACK, sub)).replace(os.sep, "/"))
        root = os.path.join(BACK, "standalone")
        for dirpath, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if d not in ("__pycache__", "wheels")]
            for f in sorted(files):
                if f.endswith(".py"):
                    full = os.path.join(dirpath, f)
                    z.write(full, "standalone/" + os.path.relpath(full, root).replace(os.sep, "/"))
        for whl in sorted(os.listdir(os.path.join(root, "wheels"))):
            with zipfile.ZipFile(os.path.join(root, "wheels", whl)) as w:
                for name in w.namelist():
                    if name.endswith(".py") or name.endswith(".typed"):
                        z.writestr("vendor/" + name, w.read(name))
    h = hashlib.sha1()
    with zipfile.ZipFile(io.BytesIO(raw.getvalue())) as z:
        for name in sorted(z.namelist()):
            h.update(name.encode() + b"\0" + z.read(name))
    eid = h.hexdigest()[:10]
    buf = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw.getvalue())) as src, zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for info in src.infolist():
            z.writestr(info, src.read(info.filename))
        z.writestr("lifeos/engine_build.txt", eid)
    return buf.getvalue()


def main():
    run(["npx", "vite", "build", "--config", "vite.play.config.ts"], FRONT)
    os.replace(os.path.join(OUT, "play.html"), os.path.join(OUT, "index.html"))
    pyo_src = os.path.join(FRONT, "node_modules", "pyodide")
    os.makedirs(os.path.join(OUT, "pyodide"), exist_ok=True)
    for f in PYODIDE_FILES:
        shutil.copy2(os.path.join(pyo_src, f), os.path.join(OUT, "pyodide", f))
    # the mini games (standalone HTML pages) live in the lab's public folder; the phone app gets the same files
    mg_src = os.path.join(FRONT, "public", "minigames")
    if os.path.isdir(mg_src):
        os.makedirs(os.path.join(OUT, "minigames"), exist_ok=True)
        for f in sorted(os.listdir(mg_src)):
            if f.endswith((".html", ".js")):
                shutil.copy2(os.path.join(mg_src, f), os.path.join(OUT, "minigames", f))
    data = engine_zip()
    with open(os.path.join(OUT, "engine.zip"), "wb") as f:
        f.write(data)
    build = hashlib.sha1(data + open(os.path.join(OUT, "index.html"), "rb").read()).hexdigest()[:10]
    sw = os.path.join(OUT, "sw.js")
    with open(sw) as f:
        s = f.read().replace("__BUILD__", build)
    with open(sw, "w") as f:
        f.write(s)
    # GitHub Pages serves docs/ as-is (no Jekyll), so the app's files are published exactly as built
    open(os.path.join(REPO, "docs", ".nojekyll"), "a").close()
    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print(f"Phone app built in {OUT}: {total / 1e6:.1f} MB, engine {len(data) / 1e3:.0f} KB, build {build}")


if __name__ == "__main__":
    sys.exit(main())
