// The story: every storyline in it, files in and out, and whose story it's played on.
import React, { useState } from "react";
import { api } from "../api";
import { bundleOf, download, fileName, newPack, Pack, packsFromText, PALETTE, Project } from "./model";
import { EMPTY, useEd } from "./state";

export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = "none";
    input.onchange = () => {
      resolve(Array.from(input.files || []));
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

/** Add packs to the project: a pack with the same name as one you have replaces it (that's how a new version comes in). */
export function mergePacks(p: Project, incoming: Pack[]): { p: Project; added: number; replaced: number } {
  const packs = [...p.packs];
  let added = 0, replaced = 0;
  for (const pk of incoming) {
    const i = packs.findIndex((x) => x.name && x.name === pk.name);
    if (i >= 0) {
      packs[i] = pk;
      replaced++;
    } else {
      packs.push(pk);
      added++;
    }
  }
  return { p: { ...p, packs }, added, replaced };
}

export default function Home({ onOpen }: { onOpen: (i: number) => void }) {
  const { p, edit, replace, check, run, toast } = useEd();
  const [builtin, setBuiltin] = useState<{ id: string; name: string; pack: Pack }[] | null>(null);
  const [menu, setMenu] = useState(false);

  const open = async () => {
    const files = await pickFiles(".json,.txt,application/json,text/plain");
    if (!files.length) return;
    try {
      const all: Pack[] = [];
      for (const f of files) all.push(...packsFromText(await f.text()));
      let r = { added: 0, replaced: 0 };
      edit((q) => {
        const m = mergePacks(q, all);
        r = m;
        return m.p;
      });
      toast(`${all.length} storyline${all.length === 1 ? "" : "s"} in${r.replaced ? ` (${r.replaced} replaced the ones with the same name)` : ""}.`);
    } catch (e: any) {
      toast(e.message || String(e), true);
    }
  };
  const useBackup = async () => {
    const [f] = await pickFiles(".lifeos,application/octet-stream", false);
    if (!f) return;
    try {
      const res = await fetch("/api/storyeditor/backup", { method: "POST", body: await f.arrayBuffer(), headers: { "Content-Type": "application/octet-stream" } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || res.statusText);
      edit((q) => ({ ...q, spec: j.spec, specName: `${j.name}${j.title ? ` · ${j.title}` : ""}` }));
      toast(`Playing on your story now: ${j.name}, from the first day.`);
    } catch (e: any) {
      toast(e.message || String(e), true);
    }
  };
  const exportAll = () => {
    download(`${fileName(p.name)}.json`, JSON.stringify(bundleOf(p), null, 1));
    toast("Saved one file with every storyline. On the phone: Me > Storylines > Paste a pack > File.");
  };
  const exportEach = () => {
    p.packs.forEach((pk, i) => setTimeout(() => download(`${fileName(pk.name)}.json`, JSON.stringify(pk, null, 1)), i * 250));
  };
  const sendToGame = () => {
    try {
      localStorage.setItem("lifeos.editor.outbox", JSON.stringify({ at: Date.now(), bundle: bundleOf(p) }));
      toast("Sent. Open the game on this device and it'll ask to add them.");
    } catch {
      toast("Too big to hand over directly. Use Download instead.", true);
    }
  };
  const loadBuiltin = async () => setBuiltin((await api.get("/api/storyeditor/builtin")).packs);

  const counts = (i: number) => {
    const c = check?.packs.find((x) => x.index === i);
    const errs = (c?.errors.length || 0) + (check?.cross.filter((x) => x.pack === i).length || 0);
    const pk = p.packs[i];
    const names = new Set((pk.scenes || []).map((s) => s.id));
    const played = run ? run.scenes.filter((s) => names.has(s.sid) && s.state === "played").length : null;
    return { errs, played };
  };

  return (
    <div className="ed-home">
      <div className="ed-home-h">
        <input className="ed-title-in" value={p.name} onChange={(e) => edit((q) => ({ ...q, name: e.target.value }), "name")} aria-label="Story name" />
        <small>{p.packs.length} storylines · {p.packs.reduce((n, pk) => n + (pk.scenes?.length || 0), 0)} scenes</small>
      </div>
      <div className="ed-row wrap">
        <button className="ed-btn primary" onClick={() => {
          const name = `New storyline ${p.packs.length + 1}`;
          edit((q) => ({ ...q, packs: [...q.packs, newPack(name)] }));
          onOpen(p.packs.length);
        }}>+ New storyline</button>
        <button className="ed-btn" onClick={open}>Open files</button>
        <button className="ed-btn" onClick={loadBuiltin}>The game's storylines</button>
        <div className="ed-menu-wrap">
          <button className="ed-btn" onClick={() => setMenu(!menu)} disabled={!p.packs.length}>Export ▾</button>
          {menu && (
            <div className="ed-menu" onClick={() => setMenu(false)}>
              <button onClick={exportAll}><b>One file, every storyline</b><small>What the phone imports in one go</small></button>
              <button onClick={exportEach}><b>Each storyline as its own file</b><small>Same files the game always used</small></button>
              <button onClick={sendToGame}><b>Send to the game on this device</b><small>No file: the game asks to add them next time it opens</small></button>
            </div>
          )}
        </div>
      </div>

      <div className="ed-lines">
        {p.packs.length === 0 && (
          <div className="ed-empty">
            <b>Start your story</b>
            <p>Open the files you already have (your Season plan, your storylines, or one story file from here), borrow the game's own storylines, or start a new one.</p>
          </div>
        )}
        {p.packs.map((pk, i) => {
          const c = counts(i);
          const plan = Object.keys(pk.schedule || {}).length;
          return (
            <button key={i} className="ed-line" onClick={() => onOpen(i)}>
              <i style={{ background: PALETTE[i % PALETTE.length] }} />
              <span>
                <b>{pk.name || "Untitled"}</b>
                <small>
                  {pk.scenes?.length || 0} scenes{plan ? ` · plans ${plan}` : ""}{pk.in_order === false ? " · any order" : ""}
                  {c.played !== null && pk.scenes?.length ? ` · ${c.played} play` : ""}
                </small>
              </span>
              {c.errs > 0 && <em className="bad">{c.errs}</em>}
            </button>
          );
        })}
      </div>

      <div className="ed-world">
        <div className="ed-k">Played on</div>
        <b>{p.spec ? p.specName || "Your story" : "A sample story (Alex Rivera, an older brother, twin sisters)"}</b>
        <p>Checks play your storylines from the first day of freshman year to the end. Use your phone's backup (Me &gt; Back up your story) and they play on your own family and cast.</p>
        <div className="ed-row wrap">
          <button className="ed-btn" onClick={useBackup}>Use my story (backup file)</button>
          {p.spec && <button className="ed-btn ghost" onClick={() => edit((q) => ({ ...q, spec: undefined, specName: undefined }))}>Back to the sample</button>}
        </div>
        <label className="ed-check">
          <input type="checkbox" checked={p.builtin} onChange={(e) => edit((q) => ({ ...q, builtin: e.target.checked }))} />
          Include the game's built-in storylines too
        </label>
      </div>

      <button className="ed-link danger" onClick={() => {
        if (window.confirm("Start over with an empty story? (Export first if you want to keep this one.)")) replace({ ...EMPTY, updated: Date.now() });
      }}>Start over</button>

      {builtin && (
        <div className="ed-sheet" onClick={() => setBuiltin(null)}>
          <div className="ed-sheet-b" onClick={(e) => e.stopPropagation()}>
            <h3>The game's storylines</h3>
            <p className="ed-dim">Copy one into your story to read it, change it, or use it as a model. Your copy replaces the built-in one in the game only if you also turn the built-in one off.</p>
            {builtin.map((b) => (
              <div key={b.id} className="ed-pick">
                <span><b>{b.name}</b><small>{b.pack.scenes?.length || 0} scenes</small></span>
                <button className="ed-btn" onClick={() => {
                  edit((q) => mergePacks(q, [{ ...b.pack, name: `${b.name} (my copy)` }]).p);
                  toast(`Copied ${b.name}.`);
                }}>Copy in</button>
              </div>
            ))}
            <button className="ed-btn primary block" onClick={() => setBuiltin(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

