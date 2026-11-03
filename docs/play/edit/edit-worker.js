// The Story Editor's copy of the game engine: Python (Pyodide) in a web worker, using the game's own engine files from
// the folder above (../pyodide, ../engine.zip). It keeps nothing: your project is saved by the editor itself, and the
// story you're playing in the game is never touched.
/* global loadPyodide */
importScripts("../pyodide/pyodide.js");

let py = null;
let api = null;
const queue = [];
let busy = false;

function progress(text) { postMessage({ type: "progress", text }); }

async function boot() {
  try {
    progress("Loading the game engine…");
    py = await loadPyodide({ indexURL: new URL("../pyodide/", self.location.href).href });
    progress("Unpacking the game's rules…");
    const res = await fetch("../engine.zip", { cache: "no-cache" });
    if (!res.ok) throw new Error("Couldn't download the game files (" + res.status + ").");
    py.unpackArchive(await res.arrayBuffer(), "zip", { extractDir: "/app" });
    py.runPython('import sys; sys.path[:0] = ["/app/standalone", "/app/vendor", "/app"]');
    progress("Almost ready…");
    py.FS.mkdirTree("/editor");
    const info = JSON.parse(py.runPython('from lifeos import local_api; import json; json.dumps(local_api.boot("/editor/saves", tiny=True))'));
    api = py.globals.get("local_api");
    postMessage({ type: "ready", info });
  } catch (e) {
    postMessage({ type: "fatal", message: String(e && e.message ? e.message : e).slice(-600) });
  }
}

async function handleOne(m) {
  const bytes = m.body ? new Uint8Array(m.body) : null;
  let out;
  try {
    const r = await api.handle(m.method, m.path, m.query || "", bytes);
    out = r.toJs({ dict_converter: Object.fromEntries });
    r.destroy && r.destroy();
  } catch (e) {
    out = { status: 500, headers: { "content-type": "application/json" }, body: new TextEncoder().encode(JSON.stringify({ detail: String(e).slice(-500) })) };
  }
  const body = out.body instanceof Uint8Array ? out.body : new Uint8Array(out.body || []);
  const copy = body.slice().buffer;
  postMessage({ type: "res", id: m.id, status: out.status, headers: out.headers, body: copy }, [copy]);
}

async function drain() {
  if (busy) return;
  busy = true;
  while (queue.length) await handleOne(queue.shift());
  busy = false;
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === "req") {
    queue.push(m);
    if (api) drain();
  }
};

boot().then(() => drain());
