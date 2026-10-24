"""Blackthorn HQ, built (docs/APP.md).

    python3 -I app/build.py           # dist/parts (what the launcher serves from Drive) and the standalone preview
    python3 -I app/build.py --shots   # also screenshots every page with the pre-installed Chromium

- dist/parts/BH-NN_*.html: the app in order, joined into one page by the launcher.
- dist/Blackthorn-HQ-app.zip: the parts and the data in one file. Upload it to Google Drive; the launcher
  (appscript/WebApp.gs) serves the newest Blackthorn-HQ-app*.zip it finds there.
- dist/blackthorn-apps-script.zip: what goes into the Sheet's Apps Script project, with INSTALL.txt.
- dist/Blackthorn-HQ-preview.html: the whole app in one file with its data inside and a stand-in for the Sheet
  (what you save stays in that browser), so it opens anywhere without Google.
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
WEB, DATA, DIST = os.path.join(HERE, "web"), os.path.join(HERE, "data"), os.path.join(HERE, "dist")
CLOSE = "<script>boot();</script>\n</body>\n</html>\n"
MOCK = """<script>
/* Preview stand-in for google.script.run: the data is inside this file; what you save stays in this browser. */
var PREVIEW_DATA = %s;
var google = {script: {run: (function () {
  function tabs() { try { return JSON.parse(localStorage.getItem('bt-preview-tabs') || '{}'); } catch (e) { return {}; } }
  function save(t) { try { localStorage.setItem('bt-preview-tabs', JSON.stringify(t)); } catch (e) {} }
  var api = {
    apiData: function (name) { return JSON.stringify(PREVIEW_DATA[name] || {}); },
    apiTab: function (name) { return (tabs()[name] || []).slice(); },
    apiAppend: function (tab, obj) { var t = tabs(); (t[tab] = t[tab] || []).push(obj);
      if (obj._timeline) (t.Timeline = t.Timeline || []).push({at: new Date().toISOString(), kind: tab.toLowerCase(), text: obj._timeline});
      save(t); return {ok: true}; },
    apiUpload: function (name, mime, b64) { var m = {}; try { m = JSON.parse(localStorage.getItem('bt-preview-images') || '{}'); } catch (e) {}
      var id = 'preview-' + Date.now().toString(36); m[id] = 'data:' + mime + ';base64,' + b64;
      try { localStorage.setItem('bt-preview-images', JSON.stringify(m)); } catch (e) { throw new Error('this browser has no room left for pictures'); } return {id: id}; },
    apiImage: function (id) { try { return JSON.parse(localStorage.getItem('bt-preview-images') || '{}')[id] || ''; } catch (e) { return ''; } },
    apiAnswer: function (id, text, status) { var t = tabs(), at = new Date().toISOString(); (t.Answers = t.Answers || []).push({id: id, text: text, status: status, at: at});
      if (status === 'answered') (t.Timeline = t.Timeline || []).push({at: at, kind: 'your call', text: id + ': ' + text}); save(t); return {ok: true}; }
  };
  function runner(ok, fail) {
    var r = {withSuccessHandler: function (f) { return runner(f, fail); }, withFailureHandler: function (f) { return runner(ok, f); }};
    Object.keys(api).forEach(function (k) { r[k] = function () { var a = arguments; setTimeout(function () {
      try { ok && ok(api[k].apply(null, a)); } catch (e) { fail && fail(e); } }, 30); }; });
    return r;
  }
  return runner();
})()}};
</script>
"""


def parts():
    return sorted(glob.glob(os.path.join(WEB, "*.html")))


def build():
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(os.path.join(DIST, "parts"))
    names = []
    for p in parts():
        name = "BH-" + os.path.basename(p)
        shutil.copy(p, os.path.join(DIST, "parts", name))
        names.append(name)
    with open(os.path.join(DIST, "parts", "BH-99_close.html"), "w", encoding="utf-8") as fh:
        fh.write(CLOSE)
    names.append("BH-99_close.html")
    data = {}
    for f in glob.glob(os.path.join(DATA, "*.json")):
        with open(f, encoding="utf-8") as fh:
            data[os.path.basename(f)[:-5]] = json.load(fh)
    html = []
    for p in parts():
        with open(p, encoding="utf-8") as fh:
            text = fh.read()
        if os.path.basename(p).startswith("00_"):
            text = text.replace("<body>", "<body>\n" + MOCK % json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"), 1)
        html.append(text)
    html.append(CLOSE)
    with zipfile.ZipFile(os.path.join(DIST, "Blackthorn-HQ-app.zip"), "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in names:
            z.write(os.path.join(DIST, "parts", name), name)
        for f in sorted(glob.glob(os.path.join(DATA, "*.json"))):
            z.write(f, os.path.basename(f))
    script = os.path.join(os.path.dirname(HERE), "appscript")
    with zipfile.ZipFile(os.path.join(DIST, "blackthorn-apps-script.zip"), "w", zipfile.ZIP_DEFLATED) as z:
        for name in ("INSTALL.txt", "Code.gs", "WebApp.gs", "Tree.html", "Hatch.html", "appsscript.json"):
            z.write(os.path.join(script, name), "blackthorn-apps-script/" + name)
    out = os.path.join(DIST, "Blackthorn-HQ-preview.html")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("".join(html))
    return out, names


SHOTS = ["", "estate", "glasshouse", "breeding", "breeding/studbook", "breeding/tree/S-TYRANITAR", "atlas", "atlas/248",
         "journal", "scouting", "scouting/cynthia-champion-platinum", "teams", "teams/me-heartgold", "builds", "builds/lab",
         "builds/ladder", "calls", "record", "scoutlab/cynthia/champion-platinum", "advance", "advance/heartgold", "field",
         "breeder/Tyranitar", "inbox", "engine", "record/evidence", "battlelab/heartgold"]


def shots(preview, pages=None, width=1440):
    js = os.path.join(HERE, "shots.mjs")
    with open(js, "w", encoding="utf-8") as fh:
        fh.write("""
import { chromium } from '%s';
const [file, out, width, ...pages] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
for (const p of pages) {
  await page.goto('file://' + file + '#/' + p);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${(p || 'home').replace(/[\\/]/g, '_')}-${width}.png`, fullPage: true });
}
console.log(JSON.stringify(errors.filter(e => !/ERR_|net::|Failed to load resource/.test(e)).slice(0, 20)));
await browser.close();
""" % _playwright())
    out = os.path.join(DIST, "shots")
    os.makedirs(out, exist_ok=True)
    r = subprocess.run(["node", js, preview, out, str(width)] + (pages or SHOTS), capture_output=True, text=True, timeout=600)
    print(r.stdout.strip() or r.stderr.strip()[-2000:])
    return out


def _playwright():
    for p in ("/usr/lib/node_modules/playwright/index.mjs", "/usr/local/lib/node_modules/playwright/index.mjs",
              "/opt/node22/lib/node_modules/playwright/index.mjs"):
        if os.path.exists(p):
            return p
    found = glob.glob("/**/node_modules/playwright/index.mjs", recursive=True)
    return found[0] if found else "playwright"


if __name__ == "__main__":
    preview, names = build()
    print(f"{len(names)} parts -> {os.path.join(DIST, 'parts')}; preview {os.path.getsize(preview) / 1024:.0f} KB -> {preview}")
    if "--shots" in sys.argv:
        pages = [a for a in sys.argv[1:] if not a.startswith("--")] or None
        print("shots ->", shots(preview, pages))
