// LIFE OS Story Editor: write storylines, choices, dialogue and their order in one place; check them and play the seven
// years with the game's own engine; export the same files the game loads.
import React, { useState } from "react";
import CheckPanel from "./CheckPanel";
import Home from "./Home";
import { findScene } from "./model";
import SceneEditor from "./SceneEditor";
import { EditorProvider, useEd } from "./state";
import Storyline from "./Storyline";
import Timeline from "./Timeline";
import "./editor.css";

export default function EditorApp() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  );
}

function Shell() {
  const { p, sel, setSel, mode, setMode, undo, redo, canUndo, canRedo, saved, busy, runStory, note, check, run } = useEd();
  const [pane, setPane] = useState<"story" | "line" | "scene">(sel.sid ? "scene" : sel.pack !== null ? "line" : "story");
  const openLine = (i: number) => {
    setSel({ pack: i, sid: null });
    setPane("line");
    setMode("write");
  };
  const openScene = (sid: string) => {
    const f = findScene(p, sid);
    if (!f) return;
    setSel({ pack: f.pack, sid });
    setPane("scene");
    setMode("write");
  };
  const problems = check ? check.packs.reduce((n, x) => n + x.errors.length, 0) + check.cross.length : 0;
  return (
    <div className="ed">
      <header className="ed-top">
        <a className="ed-logo" href="../" title="Open the game">LIFE OS <span>Story Editor</span></a>
        <nav className="ed-modes">
          <button className={mode === "write" ? "on" : ""} onClick={() => setMode("write")}>Write</button>
          <button className={mode === "timeline" ? "on" : ""} onClick={() => setMode("timeline")}>Timeline</button>
          <button className={mode === "check" ? "on" : ""} onClick={() => setMode("check")}>
            Check{problems > 0 && <em>{problems}</em>}{run && !problems && <em className="ok">{run.counts.played || 0}</em>}
          </button>
        </nav>
        <div className="ed-top-r">
          <button className="ed-ic" onClick={undo} disabled={!canUndo} title="Undo">↶</button>
          <button className="ed-ic" onClick={redo} disabled={!canRedo} title="Redo">↷</button>
          <span className={`ed-saved ${saved ? "" : "dirty"}`}>{saved ? "Saved" : "Saving…"}</span>
          <button className="ed-btn primary sm" onClick={() => { runStory(); setMode("check"); }} disabled={!!busy || !p.packs.length}>
            {busy === "run" ? "Playing…" : "Play it through"}
          </button>
        </div>
      </header>

      {mode === "write" && (
        <div className={`ed-write show-${pane}`}>
          <aside className="ed-p1"><Home onOpen={openLine} /></aside>
          <section className="ed-p2">
            {sel.pack !== null && p.packs[sel.pack] ? <Storyline key={sel.pack} i={sel.pack} onScene={openScene} onBack={() => setPane("story")} />
              : <div className="ed-pane-b ed-hint"><b>Pick a storyline</b><p>Or start a new one. Its chapters show here in order.</p></div>}
          </section>
          <main className="ed-p3">
            {sel.sid && sel.pack !== null ? <SceneEditor key={sel.sid} pack={sel.pack} sid={sel.sid} onScene={openScene} onBack={() => setPane("line")} />
              : <div className="ed-pane-b ed-hint"><b>Pick a scene</b><p>Everything about it opens here: what happens, who it's about, the choices and what each does, when it can happen, and how it reads.</p></div>}
          </main>
        </div>
      )}
      {mode === "timeline" && <div className="ed-full"><Timeline onScene={openScene} /></div>}
      {mode === "check" && <div className="ed-full"><CheckPanel onScene={openScene} /></div>}

      {note && <div className={`ed-toast ${note.bad ? "bad" : ""}`}>{note.t}</div>}
    </div>
  );
}
