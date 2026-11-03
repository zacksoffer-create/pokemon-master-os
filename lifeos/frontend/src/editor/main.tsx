// LIFE OS Story Editor, the app. On the phone site the game engine runs in a worker in the browser; on a computer with
// the lab running, it talks to the lab's server instead.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ready, startEngine } from "../standalone/bridge";
import EditorApp from "./EditorApp";

const STANDALONE = (window as any).__LIFEOS_STANDALONE__ === true;

function Boot() {
  const [msg, setMsg] = useState("Getting ready…");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(!STANDALONE);
  useEffect(() => {
    if (!STANDALONE) return;
    startEngine(setMsg, "edit-worker.js");
    ready.then(() => setOk(true)).catch((e) => setErr(e.message || String(e)));
  }, []);
  if (ok) return <EditorApp />;
  return (
    <div className="ed-boot">
      <h1>LIFE OS <span>Story Editor</span></h1>
      {err ? <><p className="ed-err">{err}</p><button onClick={() => window.location.reload()}>Try again</button></> : <><div className="ed-spin" /><p>{msg}</p>
        <small>It uses the game's own engine, so what you write is checked and played by the same rules. The first time, this downloads about 12 MB (shared with the game).</small></>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Boot />);
