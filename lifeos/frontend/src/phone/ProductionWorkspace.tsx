// Story Studio production workspace: a storyline as a production project. Paste the outline once; copy one
// self-contained writing prompt per batch (6 scenes each by default) into as many outside chats as you like; paste the
// replies back in any order; fix only the scenes with problems (a focused repair prompt each); preview; import.
// Everything here is checked by the game's own compiler (the same one an import runs); nothing goes into your
// storylines until you confirm the import, and the project stays for later revisions.
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { copyText } from "./DialogueCard";
import { PIcon } from "./icons";
import { cx, errText, Sheet } from "./kit";
import { usePhone } from "./PhoneContext";

type Diag = { severity: "error" | "warning" | "info"; code: string; scene: number | null; message: string; line?: number;
  actual?: number; limit?: number; action?: string; storyline?: string };
type SceneRow = { uid: string; n: number; title: string; when: string; summary: string; if: string | null; meta: Record<string, any>;
  status: string; has_text: boolean; chars: number; diag: Diag[]; versions: number };
type BatchRow = { i: number; from: number; to: number; ns: number[]; status: string; received: number; errors: number;
  copied_snapshot: number | null; stale: boolean };
type Ctx = { brief: string; time_period: string; tone: string; instructions: string; canon: string; primary: string[]; supporting: string[] };
type Project = { id: string; title: string; batch_size: number; snapshot: number; context: Ctx; header: string[]; scenes: SceneRow[];
  batches: BatchRow[]; next: number | null; target: string | null; imported: { pack: string; at: number; mode: string } | null;
  outline_issues: Diag[]; summary: ProjectSummary; removed: number; statuses: Record<string, string>;
  unplaced: { k: number; n: number | null; title: string; why: string; at: number; text: string }[] };
type ProjectSummary = { id: string; title: string; scenes: number; received: number; errors: number; validated: number; imported: boolean;
  updated?: number; batches: number };
type PasteReport = { got: number[]; same: number[]; changed: number[]; unexpected: { n: number | null; title: string }[]; duplicates: number[];
  not_asked: number[]; notes: string[]; set_aside: string[]; truncated: boolean; tidied: Record<string, string[]>; diffs?: Record<string, string[]> };
type Preview = { title: string; scenes: number; of: number; range: [number, number] | null; cast: string[]; validation: Record<string, number>;
  diagnostics: Diag[]; missing: number[]; mode: "new" | "update" | "copy" | "unchanged"; existing: string | null; replaced: number[];
  new: number[]; removed: number[]; played: number[]; played_renamed: number[]; acknowledge: string[]; diff: string[]; can_import: boolean;
  blockers: Diag[]; chars: number };
type SceneDetail = { n: number; title: string; text: string; diag: Diag[]; history: { k: number; at: number; chars: number; text: string }[]; paste: string | null };
type Shared = { characters: Record<string, any>; events: Record<string, any> };

export type ProductionStart = { project?: string; from?: string } | null;

const STEPS = [["outline", "Outline"], ["batches", "Batches"], ["scenes", "Scenes"], ["import", "Import"], ["context", "Context"]] as const;
type Step = typeof STEPS[number][0];
const LABEL: Record<string, string> = { planned: "Planned", prompt_copied: "Prompt copied", received: "Output received",
  needs_correction: "Needs correction", validated: "Validated", ready: "Ready to import", imported: "Imported" };
const BLUEPRINT: [string, string][] = [["purpose", "Why it matters"], ["subject", "Whose story it is (the narrative subject)"],
  ["relationship", "Relationship focus"], ["agency", "What I get to decide"], ["history", "Already happened"],
  ["constraints", "Keep to"], ["choice_design", "The choices"], ["event", "Shared event (key)"]];

const base = (pid: string) => `/api/story/production/${encodeURIComponent(pid)}`;
const ranges = (ns: number[]) => {
  const out: string[] = [];
  let a: number | null = null, b: number | null = null;
  for (const n of [...ns].sort((x, y) => x - y)) {
    if (a === null) { a = b = n; continue; }
    if (n === (b as number) + 1) { b = n; continue; }
    out.push(a === b ? `${a}` : `${a}–${b}`);
    a = b = n;
  }
  if (a !== null) out.push(a === b ? `${a}` : `${a}–${b}`);
  return out.join(", ");
};

async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

async function saveText(name: string, text: string): Promise<string> {
  const blob = new Blob([text], { type: "text/plain" });
  const file = new File([blob], name, { type: "text/plain" });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return "Saved.";
    } catch (e: any) {
      if (e?.name === "AbortError") return "Canceled.";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return `Downloaded ${name}.`;
}

function Pill({ status }: { status: string }) {
  return <span className={cx("pw-pill", `st-${status}`)}>{LABEL[status] || status}</span>;
}

function DiagLine({ d, onScene }: { d: Diag; onScene?: (n: number) => void }) {
  return (
    <div className={cx("pw-diag", d.severity)}>
      <div className="pw-diag-h">
        <b>{d.severity === "error" ? "Error" : d.severity === "warning" ? "Warning" : "Note"}</b>
        <code>{d.code}</code>
        {d.scene != null && onScene && <button className="ph-link" onClick={() => onScene(d.scene as number)}>scene {d.scene}</button>}
        {d.line != null && <span>line {d.line}</span>}
      </div>
      <div>{d.message}</div>
      {d.actual != null && d.limit != null && <div className="pw-num">Actual: {d.actual.toLocaleString()} characters · Maximum: {d.limit.toLocaleString()}</div>}
      {d.action && <div className="pw-act">{d.action}</div>}
    </div>
  );
}

/** Paste a chat's reply (or one corrected scene). */
function PasteBox({ title, hint, busy, onSubmit, onClose }: { title: string; hint: string; busy: boolean; onSubmit: (t: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const { toast } = usePhone();
  return (
    <div className="pw-paste">
      <div className="pw-paste-h"><b>{title}</b><button className="ph-x" onClick={onClose} aria-label="Close"><PIcon name="x" size={16} /></button></div>
      <p className="ph-dim small">{hint}</p>
      <textarea className="dl-ta" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="--- 19. Title&#10;…" />
      <div className="dl-paste-btns">
        <button className="ph-btn soft" onClick={async () => {
          const t = await readClipboard();
          if (t) setText(t); else toast("Couldn't read the clipboard here: long-press the box and paste.", "bad");
        }}>Paste from clipboard</button>
        <button className="ph-btn primary" disabled={busy || !text.trim()} onClick={() => onSubmit(text)}>
          {busy ? <span className="ph-spinner small" /> : "Add"}
        </button>
      </div>
    </div>
  );
}

function Report({ r, onScene }: { r: PasteReport; onScene: (n: number) => void }) {
  return (
    <div className="pw-report">
      {r.got.length > 0 && <div className="good">In: scenes {ranges(r.got)}{r.changed.length ? ` (${ranges(r.changed)} replaced an earlier version, kept under Versions)` : ""}</div>}
      {r.same.length > 0 && <div>Already had: {ranges(r.same)} (the same text: nothing changed)</div>}
      {r.duplicates.length > 0 && <div className="warn">Two copies of scene {ranges(r.duplicates)} in that paste: the first went in, the other is kept under Unplaced.</div>}
      {r.unexpected.length > 0 && <div className="warn">Not in the outline: {r.unexpected.map((u) => u.n ?? `“${u.title}”`).join(", ")} (kept under Unplaced).</div>}
      {r.not_asked.length > 0 && <div>Also in that paste, not taken (only the scene you're replacing goes in): {ranges(r.not_asked)}</div>}
      {r.truncated && <div className="bad">The reply looks cut off (its code block never closed): its last scene is flagged.</div>}
      {r.notes.map((n, i) => <div key={i} className="dim">{n}</div>)}
      {Object.keys(r.tidied || {}).length > 0 && <div className="dim">Format tidied (nothing reworded or dropped) in scene {Object.keys(r.tidied).join(", ")}.</div>}
      {r.set_aside.length > 0 && (
        <details><summary>Set aside: chat commentary around the scenes</summary><pre className="pw-pre">{r.set_aside.join("\n\n")}</pre></details>
      )}
      {r.diffs && Object.entries(r.diffs).map(([n, d]) => (
        <details key={n}><summary>What changed in scene {n}</summary><pre className="pw-pre">{d.join("\n")}</pre></details>
      ))}
      {r.got.length > 0 && <button className="ph-link" onClick={() => onScene(r.got[0])}>See the scenes</button>}
    </div>
  );
}

export default function ProductionWorkspace({ start, onClose, onImported }: { start: ProductionStart; onClose: () => void; onImported: () => void }) {
  const { toast } = usePhone();
  const [list, setList] = useState<{ projects: ProjectSummary[]; storylines: { id: string; title: string; scenes: number; written: number }[] } | null>(null);
  const [p, setP] = useState<Project | null>(null);
  const [step, setStep] = useState<Step>("outline");
  const [busy, setBusy] = useState<string | null>(null);
  const open = start !== null;

  const loadList = () => api.get("/api/story/production").then(setList).catch(() => setList({ projects: [], storylines: [] }));
  const openProject = async (pid: string) => {
    setBusy("open");
    try {
      const v: Project = await api.get(base(pid));
      setP(v);
      setStep(v.imported ? "import" : v.summary.received ? "scenes" : "batches");
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  useEffect(() => {
    if (!open) { setP(null); return; }
    loadList();
    if (start?.project) openProject(start.project);
    else if (start?.from) createFrom(start.from);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async <T,>(key: string, fn: () => Promise<T>, ok?: (r: T) => void) => {
    setBusy(key);
    try {
      const r = await fn();
      ok?.(r);
      return r;
    } catch (e) {
      toast(errText(e), "bad");
      return null;
    } finally {
      setBusy(null);
    }
  };
  const createFrom = (pid: string) => run("create", () => api.post("/api/story/production", { from: pid }), (v: Project) => { setP(v); setStep("batches"); });

  return (
    <Sheet open={open} onClose={onClose} full title={p ? p.title : "Production workspace"} className="pw-sheet">
      {!p ? (
        <Start list={list} busy={busy} onOpen={openProject} onFrom={createFrom}
          onCreate={(v) => { setP(v); setStep("outline"); loadList(); }} />
      ) : (
        <>
          <div className="pw-top">
            <button className="ph-link" onClick={() => { setP(null); loadList(); }}>‹ All projects</button>
            <span className="ph-dim small">{p.summary.received} of {p.summary.scenes} scenes in · {p.summary.validated} validated
              {p.summary.errors ? ` · ${p.summary.errors} to fix` : ""}{p.imported ? " · imported" : ""}</span>
          </div>
          <div className="ph-seg pw-steps">
            {STEPS.map(([k, label]) => (
              <button key={k} className={cx(step === k && "on")} onClick={() => setStep(k)}>{label}</button>
            ))}
          </div>
          {step === "outline" && <OutlineStep p={p} setP={setP} run={run} busy={busy} onDone={() => setStep("batches")} />}
          {step === "batches" && <BatchesStep p={p} setP={setP} run={run} busy={busy} onScene={() => setStep("scenes")} />}
          {step === "scenes" && <ScenesStep p={p} setP={setP} run={run} busy={busy} />}
          {step === "import" && <ImportStep p={p} setP={setP} run={run} busy={busy} onImported={onImported} onScene={() => setStep("scenes")} />}
          {step === "context" && <ContextStep p={p} setP={setP} run={run} busy={busy} onAway={() => { setP(null); loadList(); }} />}
        </>
      )}
    </Sheet>
  );
}

type StepProps = { p: Project; setP: (p: Project) => void; busy: string | null;
  run: <T>(key: string, fn: () => Promise<T>, ok?: (r: T) => void) => Promise<T | null> };

function Start({ list, busy, onOpen, onFrom, onCreate }: { list: any; busy: string | null; onOpen: (pid: string) => void;
  onFrom: (pid: string) => void; onCreate: (v: Project) => void }) {
  const { toast } = usePhone();
  const [text, setText] = useState("");
  const [size, setSize] = useState(6);
  const [check, setCheck] = useState<{ title: string; entries: any[]; issues: Diag[]; has_scenes: boolean } | null>(null);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!text.trim()) { setCheck(null); return; }
    const t = setTimeout(() => api.post("/api/story/production/outline-check", { text }).then(setCheck).catch(() => setCheck(null)), 350);
    return () => clearTimeout(t);
  }, [text]);
  const create = async () => {
    setWorking(true);
    try {
      onCreate(await api.post("/api/story/production", { text, batch_size: size }));
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setWorking(false);
    }
  };
  const batches = check ? Math.ceil(check.entries.length / Math.max(1, size)) : 0;
  return (
    <div className="pw-start">
      <p className="ph-dim small" style={{ marginTop: 0 }}>
        Paste a numbered outline (or a whole storyline with an <code>outline:</code>). You get one self-contained writing prompt per
        batch to run in as many chats as you like at once, then paste the replies back in any order. Nothing goes into your
        storylines until you import.
      </p>
      <div className="pw-box">
        <b>New from an outline</b>
        <textarea className="dl-ta" rows={7} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"=== Watch Hill, Summer 2012\ncast: nikki = Nikki\nyears: sophomore\n\noutline:\n1. The First Morning | June | ...\n2. ..."} />
        <div className="pw-row">
          <button className="ph-btn soft" onClick={async () => { const t = await readClipboard(); if (t) setText(t); }}>Paste from clipboard</button>
          <label className="pw-num-in">Batch size <input type="number" min={1} max={20} value={size} onChange={(e) => setSize(Number(e.target.value) || 6)} /></label>
        </div>
        {check && (
          <div className="pw-check">
            <div><b>{check.title}</b>: {check.entries.length} scenes{check.entries.length ? ` → ${batches} batch${batches === 1 ? "" : "es"} of up to ${size}` : ""}
              {check.has_scenes ? " · its written scenes come along" : ""}</div>
            {check.issues.map((d, i) => <DiagLine key={i} d={d} />)}
            {check.entries.length > 0 && (
              <ol className="pw-mini">{check.entries.slice(0, 60).map((e: any) => <li key={e.n}><b>{e.n}.</b> {e.title}{e.when ? <i> · {e.when}</i> : null}</li>)}</ol>
            )}
          </div>
        )}
        <button className="ph-btn primary block" disabled={working || !check?.entries.length} onClick={create}>
          {working ? <span className="ph-spinner small" /> : "Make the project"}
        </button>
      </div>
      {list?.projects?.length > 0 && (
        <div className="pw-box">
          <b>Your projects</b>
          {list.projects.map((r: ProjectSummary) => (
            <button key={r.id} className="pw-proj" disabled={!!busy} onClick={() => onOpen(r.id)}>
              <span><b>{r.title}</b><small>{r.received}/{r.scenes} in · {r.validated} validated{r.errors ? ` · ${r.errors} to fix` : ""}</small></span>
              {r.imported ? <span className="pw-pill st-imported">Imported</span> : <PIcon name="chevron" size={16} />}
            </button>
          ))}
        </div>
      )}
      {list?.storylines?.length > 0 && (
        <details className="pw-box">
          <summary><b>From a storyline you have</b> <small className="ph-dim">(finish or revise it here; it isn't changed until you import)</small></summary>
          {list.storylines.map((s: any) => (
            <button key={s.id} className="pw-proj" disabled={!!busy} onClick={() => onFrom(s.id)}>
              <span><b>{s.title}</b><small>{s.written} of {s.scenes} written</small></span><PIcon name="plus" size={16} />
            </button>
          ))}
        </details>
      )}
    </div>
  );
}

function OutlineStep({ p, setP, run, busy, onDone }: StepProps & { onDone: () => void }) {
  const [rows, setRows] = useState(p.scenes.map((s) => ({ uid: s.uid, n: s.n, title: s.title, when: s.when, summary: s.summary, if: s.if || "", meta: s.meta || {} })));
  const [dirty, setDirty] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  useEffect(() => { setRows(p.scenes.map((s) => ({ uid: s.uid, n: s.n, title: s.title, when: s.when, summary: s.summary, if: s.if || "", meta: s.meta || {} }))); setDirty(false); }, [p.snapshot]); // eslint-disable-line
  const edit = (k: number, patch: any) => { setRows(rows.map((r, i) => (i === k ? { ...r, ...patch } : r))); setDirty(true); };
  const move = (k: number, by: number) => {
    const j = k + by;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[k], next[j]] = [next[j], next[k]];
    setRows(next.map((r, i) => ({ ...r, n: i + 1 })));  // (renumbered in order: written scenes move with their row)
    setDirty(true);
  };
  const save = () => run("outline", () => api.post(`${base(p.id)}/outline`, { entries: rows }), (v: Project) => setP(v));
  const status: Record<number, string> = Object.fromEntries(p.scenes.map((s) => [s.n, s.status]));
  return (
    <div className="pw-step">
      {p.outline_issues.length > 0 && <div className="pw-box">{p.outline_issues.map((d, i) => <DiagLine key={i} d={d} />)}</div>}
      <p className="ph-dim small">{rows.length} scenes → {p.batches.length} batches of up to {p.batch_size}. Edit anything; reordering renumbers (a written scene moves with its row).</p>
      <ol className="pw-outline">
        {rows.map((r, k) => (
          <li key={r.uid}>
            <div className="pw-orow">
              <span className="bs-n">{r.n}</span>
              <input className="pw-in t" value={r.title} onChange={(e) => edit(k, { title: e.target.value })} aria-label="Title" />
              <Pill status={status[r.n] || "planned"} />
              <span className="pw-mv">
                <button onClick={() => move(k, -1)} aria-label="Move up">↑</button>
                <button onClick={() => move(k, 1)} aria-label="Move down">↓</button>
              </span>
            </div>
            <div className="pw-orow2">
              <input className="pw-in w" value={r.when} placeholder="when (June, July 4, game day…)" onChange={(e) => edit(k, { when: e.target.value })} />
              <input className="pw-in s" value={r.summary} placeholder="what happens" onChange={(e) => edit(k, { summary: e.target.value })} />
            </div>
            <button className="ph-link small" onClick={() => setOpenRow(openRow === r.uid ? null : r.uid)}>{openRow === r.uid ? "Less" : "Blueprint, conditions"}</button>
            {openRow === r.uid && (
              <div className="pw-bp">
                <label>Only if / game (as the outline writes it)<input className="pw-in" value={r.if} placeholder={'only if you picked "Swim out" in 4'} onChange={(e) => edit(k, { if: e.target.value })} /></label>
                {BLUEPRINT.map(([key, label]) => (
                  <label key={key}>{label}<input className="pw-in" value={r.meta[key] || ""} onChange={(e) => edit(k, { meta: { ...r.meta, [key]: e.target.value } })} /></label>
                ))}
                <label>Builds on scenes (numbers)<input className="pw-in" value={(r.meta.depends || []).join(", ")}
                  onChange={(e) => edit(k, { meta: { ...r.meta, depends: (e.target.value.match(/\d+/g) || []).map(Number) } })} /></label>
                <label>In it (names, comma separated)<input className="pw-in" value={(r.meta.primary || []).join(", ")}
                  onChange={(e) => edit(k, { meta: { ...r.meta, primary: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} /></label>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="pw-row">
        <button className="ph-btn soft" onClick={() => { setRows([...rows, { uid: "", n: rows.length + 1, title: "", when: "", summary: "", if: "", meta: {} }]); setDirty(true); }}>
          <PIcon name="plus" size={15} /> Add a scene
        </button>
        {dirty
          ? <button className="ph-btn primary" disabled={!!busy} onClick={save}>{busy === "outline" ? <span className="ph-spinner small" /> : "Save the outline"}</button>
          : <button className="ph-btn primary" onClick={onDone}>Looks right: to the batches</button>}
      </div>
    </div>
  );
}

function BatchesStep({ p, setP, run, busy, onScene }: StepProps & { onScene: () => void }) {
  const { toast } = usePhone();
  const [pasting, setPasting] = useState<number | "any" | null>(null);
  const [report, setReport] = useState<PasteReport | null>(null);
  const copy = async (i: number | null) => {
    const r: any = await run(`copy:${i ?? "next"}`, () => api.get(`${base(p.id)}/batch?i=${i ?? 0}`));
    if (!r) return;
    const ok = await copyText(r.prompt);
    if (!ok) { toast("Couldn't copy on this device.", "bad"); return; }
    const v: Project | null = await run("mark", () => api.post(`${base(p.id)}/copied`, { i: r.i }));
    if (v) setP(v);
    toast(`Copied batch ${r.i} (scenes ${r.from}–${r.to}). Paste it into a new chat; paste the reply back here.`, "good");
  };
  const paste = async (text: string) => {
    const r: any = await run("paste", () => api.post(`${base(p.id)}/paste`, { text }));
    if (r) { setP(r.project); setReport(r.report); setPasting(null); }
  };
  return (
    <div className="pw-step">
      <div className="pw-row">
        <button className="ph-btn primary" disabled={!!busy || p.next == null} onClick={() => copy(null)}>
          {busy === "copy:next" ? <span className="ph-spinner small" /> : <PIcon name="chat" size={16} />} {p.next == null ? "Every batch is in" : `Copy next unfinished (batch ${p.next})`}
        </button>
        <button className="ph-btn soft" onClick={() => { setPasting("any"); setReport(null); }}><PIcon name="plus" size={16} /> Paste a reply</button>
      </div>
      {pasting !== null && (
        <PasteBox title={pasting === "any" ? "Paste a chat's reply" : `Paste batch ${pasting}'s reply`} busy={busy === "paste"}
          hint="Any batch, any order, several at once: each scene goes to its number. Code fences and chat commentary are set aside (kept)."
          onSubmit={paste} onClose={() => setPasting(null)} />
      )}
      {report && <Report r={report} onScene={onScene} />}
      {p.unplaced.length > 0 && (
        <details className="pw-box">
          <summary><b>Unplaced</b> ({p.unplaced.length}) <small className="ph-dim">scenes from a paste that didn't go in: kept, not lost</small></summary>
          {p.unplaced.map((u) => (
            <div key={u.k} className="pw-unplaced">
              <div><b>{u.n != null ? `Scene ${u.n}` : "No number"}</b> · {u.title} <small className="ph-dim">({u.why})</small></div>
              <pre className="pw-pre">{u.text}</pre>
              <div className="pw-row">
                {u.n != null && p.scenes.some((s) => s.n === u.n) && (
                  <button className="ph-btn soft" disabled={!!busy} onClick={async () => {
                    const r: any = await run("use", () => api.post(`${base(p.id)}/paste`, { text: u.text, scene: u.n }));
                    if (r) { const v: Project | null = await run("drop", () => api.post(`${base(p.id)}/unplaced/drop`, { k: u.k })); if (v) setP(v); }
                  }}>Use this one as scene {u.n}</button>
                )}
                <button className="ph-btn soft" disabled={!!busy} onClick={() => run("drop", () => api.post(`${base(p.id)}/unplaced/drop`, { k: u.k }), (v: Project) => setP(v))}>Let it go</button>
              </div>
            </div>
          ))}
        </details>
      )}
      <div className="pw-batches">
        {p.batches.map((b) => (
          <div key={b.i} className={cx("pw-batch", `st-${b.status}`)}>
            <div className="pw-batch-h">
              <b>Batch {b.i}</b><span>scenes {b.from}–{b.to} · {b.ns.length}</span><Pill status={b.status} />
            </div>
            <small className="ph-dim">{b.received}/{b.ns.length} in{b.errors ? ` · ${b.errors} need fixing` : ""}
              {b.stale ? ` · copied from context v${b.copied_snapshot} (now v${p.snapshot}: copy again if the outline or context changed what it should say)` : ""}</small>
            <div className="pw-row">
              <button className="ph-btn soft" disabled={!!busy} onClick={() => copy(b.i)}>{busy === `copy:${b.i}` ? <span className="ph-spinner small" /> : "Copy prompt"}</button>
              <button className="ph-btn soft" onClick={() => { setPasting(b.i); setReport(null); }}>Paste output</button>
              {b.errors > 0 && <button className="ph-btn soft" onClick={onScene}>Show issues</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenesStep({ p, setP, run, busy }: StepProps) {
  const { toast } = usePhone();
  const [sev, setSev] = useState<"all" | "error" | "warning" | "info">("all");
  const [openN, setOpenN] = useState<number | null>(null);
  const [detail, setDetail] = useState<SceneDetail | null>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [whole, setWhole] = useState<Diag[] | null>(null);
  const [memory, setMemory] = useState<any>(null);
  const validate = () => run("validate", () => api.post(`${base(p.id)}/validate`), (r: any) => {
    setP(r.project);
    setWhole(r.diagnostics.filter((d: Diag) => d.scene == null || !r.project.scenes.find((s: SceneRow) => s.n === d.scene)?.diag.some((x: Diag) => x.message === d.message)));
    setMemory(r.memory);
    toast(r.blockers ? `${r.blockers} error${r.blockers === 1 ? "" : "s"} to fix before importing.` : "No errors: ready to preview.", r.blockers ? "bad" : "good");
  });
  const repair = async (ns: number[]) => {
    const r: any = await run("repair", () => api.get(`${base(p.id)}/repair?ns=${ns.join(",")}`));
    if (!r) return;
    const ok = await copyText(r.prompt);
    toast(ok ? `Copied a repair prompt for scene${ns.length > 1 ? "s" : ""} ${ranges(ns)}. Paste the fixed scene back with Replace.` : "Couldn't copy.", ok ? "good" : "bad");
  };
  const show = (n: number) => run("detail", () => api.get(`${base(p.id)}/scene?n=${n}`), (d: SceneDetail) => setDetail(d));
  const replace = async (n: number, text: string) => {
    const r: any = await run("replace", () => api.post(`${base(p.id)}/paste`, { text, scene: n }));
    if (r) { setP(r.project); setReplacing(null); toast(r.report.got.length ? `Scene ${n} replaced (the old one is kept under Versions).` : "That's the same text: nothing changed.", "good"); }
  };
  const restore = (n: number, k: number) => run("restore", () => api.post(`${base(p.id)}/restore`, { n, k }), (v: Project) => { setP(v); setDetail(null); });
  useEffect(() => {
    if (openN != null) document.getElementById(`pw-sc-${openN}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openN]);
  const bad = p.scenes.filter((s) => s.status === "needs_correction").map((s) => s.n);
  const shown = useMemo(() => p.scenes.filter((s) => s.has_text || s.diag.length).map((s) => ({
    ...s, diag: s.diag.filter((d) => sev === "all" || d.severity === sev) })).filter((s) => sev === "all" || s.diag.length), [p, sev]);
  return (
    <div className="pw-step">
      <div className="pw-row">
        <button className="ph-btn primary" disabled={!!busy} onClick={validate}>{busy === "validate" ? <span className="ph-spinner small" /> : <PIcon name="check" size={16} />} Validate all</button>
        {bad.length > 0 && <button className="ph-btn soft" disabled={!!busy} onClick={() => repair(bad)}>Copy repair prompt ({bad.length})</button>}
      </div>
      <div className="ph-seg pw-filter">
        {(["all", "error", "warning", "info"] as const).map((k) => (
          <button key={k} className={cx(sev === k && "on")} onClick={() => setSev(k)}>{k === "all" ? "All" : k === "error" ? "Errors" : k === "warning" ? "Warnings" : "Notes"}</button>
        ))}
      </div>
      {whole && whole.length > 0 && (
        <details className="pw-box" open={whole.some((d) => d.severity === "error")}>
          <summary><b>The storyline as a whole</b> ({whole.length})</summary>
          {whole.filter((d) => sev === "all" || d.severity === sev).map((d, i) => <DiagLine key={i} d={d} onScene={setOpenN} />)}
        </details>
      )}
      {memory && Object.keys(memory.writes || {}).length > 0 && (
        <details className="pw-box">
          <summary><b>Memory keys</b> this storyline writes</summary>
          {Object.entries(memory.writes).map(([k, ns]: any) => (
            <div key={k} className="pw-mem"><code>{k}</code> scene {ns.join(", ")}{memory.waits?.[k] ? ` · waited on by ${memory.waits[k].join(", ")}` : ""}{memory.elsewhere?.[k] ? ` · also written by ${memory.elsewhere[k].join(", ")}` : ""}</div>
          ))}
        </details>
      )}
      {shown.length === 0 && <p className="ph-dim small">{p.summary.received ? "Nothing to show with this filter." : "No scenes in yet: paste a batch's reply under Batches."}</p>}
      {shown.map((s) => (
        <div key={s.n} className={cx("pw-scene", openN === s.n && "open")} id={`pw-sc-${s.n}`}>
          <button className="pw-scene-h" onClick={() => setOpenN(openN === s.n ? null : s.n)}>
            <span className="bs-n">{s.n}</span><b>{s.title}</b><Pill status={s.status} />
            {s.diag.length > 0 && <small>{s.diag.filter((d) => d.severity === "error").length || ""}{s.diag.some((d) => d.severity === "error") ? " ⛔" : s.diag.some((d) => d.severity === "warning") ? " ⚠" : ""}</small>}
          </button>
          {(openN === s.n || s.diag.some((d) => d.severity === "error")) && (
            <div className="pw-scene-b">
              {s.diag.map((d, i) => <DiagLine key={i} d={d} />)}
              <div className="pw-row">
                {s.diag.some((d) => d.severity !== "info") && <button className="ph-btn soft" disabled={!!busy} onClick={() => repair([s.n])}>Copy repair prompt</button>}
                <button className="ph-btn soft" onClick={() => setReplacing(s.n)}>Replace scene</button>
                <button className="ph-btn soft" disabled={!!busy} onClick={() => show(s.n)}>Text{s.versions ? ` · ${s.versions} earlier` : ""}</button>
              </div>
              {replacing === s.n && (
                <PasteBox title={`Replace scene ${s.n}`} busy={busy === "replace"} onClose={() => setReplacing(null)} onSubmit={(t) => replace(s.n, t)}
                  hint="The corrected scene (its --- header line can be left off). Only this scene changes; the version it replaces is kept." />
              )}
            </div>
          )}
        </div>
      ))}
      <Sheet open={!!detail} onClose={() => setDetail(null)} full title={detail ? `Scene ${detail.n}: ${detail.title}` : ""}>
        {detail && (
          <div className="pw-detail">
            <div className="pw-row"><button className="ph-btn soft" onClick={async () => toast((await copyText(detail.text)) ? "Copied the scene." : "Couldn't copy.", "good")}>Copy</button></div>
            <pre className="pw-pre big">{detail.text}</pre>
            {detail.history.length > 0 && <b>Earlier versions</b>}
            {detail.history.map((h) => (
              <details key={h.k}><summary>{new Date((h.at || 0) * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {h.chars} characters
                <button className="ph-link" onClick={(e) => { e.preventDefault(); restore(detail.n, h.k); }}>Put this one back</button></summary>
                <pre className="pw-pre">{h.text}</pre></details>
            ))}
            {detail.paste && <details><summary>The whole paste it came from (as pasted)</summary><pre className="pw-pre">{detail.paste}</pre></details>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function ImportStep({ p, setP, run, busy, onImported, onScene }: StepProps & { onImported: () => void; onScene: () => void }) {
  const { toast } = usePhone();
  const [pv, setPv] = useState<Preview | null>(null);
  const [partial, setPartial] = useState(false);
  const [ack, setAck] = useState(false);
  const load = () => run("preview", () => api.get(`${base(p.id)}/preview?partial=${partial}`), (r: Preview) => { setPv(r); setAck(false); });
  useEffect(() => { load(); }, [partial, p.summary.received, p.summary.errors]); // eslint-disable-line react-hooks/exhaustive-deps
  const doImport = async () => {
    if (!window.confirm(pv?.mode === "update" ? `Update “${p.title}” in your storylines? The version it replaces is kept under Older versions.` : `Add “${p.title}” to your storylines?`)) return;
    const r: any = await run("import", () => api.post(`${base(p.id)}/import`, { confirm: true, partial, acknowledge: ack }));
    if (!r) return;
    setP(r.project);
    onImported();
    toast(r.unchanged ? "Nothing changed: it's already in, exactly like this." : `${r.mode === "update" ? "Updated" : "Added"}: ${p.title}.${r.undo ? " " + r.undo : ""}`, "good");
    load();
  };
  const exportIt = async (how: "copy" | "save") => {
    const r: any = await run("export", () => api.get(`${base(p.id)}/export`));
    if (!r) return;
    if (how === "copy") toast((await copyText(r.text)) ? "Copied the whole script." : "Couldn't copy.", "good");
    else toast(await saveText(`${p.title.replace(/[^\w\- ]+/g, "").trim() || "storyline"}.txt`, r.text), "good");
  };
  const adopt = () => run("adopt", () => api.post(`${base(p.id)}/adopt`), (r: any) => { setP(r.project); toast(r.got.length ? `Brought in scenes ${ranges(r.got)}.` : "Nothing to bring in.", "good"); load(); });
  if (!pv) return <div className="pw-step"><span className="ph-spinner" /></div>;
  const modeLine = { new: "A new storyline.", update: `Updates your storyline “${pv.title}”.`, copy: `Goes in alongside your “${pv.title}” (a different storyline with the same name).`,
    unchanged: "Already in, exactly like this." }[pv.mode];
  return (
    <div className="pw-step">
      <div className="pw-box">
        <b>{pv.title}</b>
        <div className="ph-dim small">{modeLine} {pv.scenes} of {pv.of} scenes{pv.range ? ` (${pv.range[0]}–${pv.range[1]})` : ""} · {pv.chars.toLocaleString()} characters</div>
        {pv.cast.length > 0 && <div className="ph-dim small">Cast: {pv.cast.join(" · ")}</div>}
        <div className="pw-counts">
          <span className={cx(pv.validation.error && "bad")}>{pv.validation.error || 0} errors</span>
          <span>{pv.validation.warning || 0} warnings</span><span>{pv.validation.info || 0} notes</span>
          {pv.validation.tidied ? <span className="ph-dim">{pv.validation.tidied} scenes format-tidied</span> : null}
        </div>
        {pv.new.length > 0 && <div className="small">Adds scenes {ranges(pv.new)}</div>}
        {pv.replaced.length > 0 && <div className="small">Replaces scenes {ranges(pv.replaced)}{pv.played.length ? ` (you've played ${ranges(pv.played.filter((n) => pv.replaced.includes(n)))}: what you chose stays)` : ""}</div>}
        {pv.missing.length > 0 && <div className="small warn">Not written yet: {ranges(pv.missing)}</div>}
        {pv.removed.length > 0 && pv.mode !== "copy" && <div className="small bad">Your storyline has scenes {ranges(pv.removed)} that this project doesn't.</div>}
      </div>
      {pv.blockers.length > 0 && (
        <div className="pw-box">
          <b>Before it can go in</b>
          {pv.blockers.slice(0, 12).map((d, i) => <DiagLine key={i} d={d} onScene={onScene} />)}
          {pv.blockers.length > 12 && <small className="ph-dim">…and {pv.blockers.length - 12} more under Scenes</small>}
        </div>
      )}
      {pv.removed.length > 0 && <button className="ph-btn soft block" disabled={!!busy} onClick={adopt}>Keep the scenes you have ({ranges(pv.removed)})</button>}
      {pv.missing.length > 0 && (
        <label className="pw-check-row"><input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} /> Import what's written (the rest stay in the outline, unwritten)</label>
      )}
      {pv.acknowledge.map((a, i) => <p key={i} className="pw-ack">{a}</p>)}
      {pv.acknowledge.length > 0 && <label className="pw-check-row"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand: go ahead</label>}
      {pv.diff.length > 0 && <details className="pw-box"><summary><b>What changes</b> (against the version you have)</summary><pre className="pw-pre">{pv.diff.join("\n")}</pre></details>}
      <button className="ph-btn primary block" disabled={!!busy || !pv.can_import || (pv.acknowledge.length > 0 && !ack)} onClick={doImport}>
        {busy === "import" ? <span className="ph-spinner small" /> : pv.mode === "unchanged" ? "Imported" : pv.mode === "update" ? "Import (update the storyline)" : "Import storyline"}
      </button>
      {p.imported && <p className="ph-dim small">Imported {new Date(p.imported.at * 1000).toLocaleString()}. The project stays here for revisions.</p>}
      <div className="pw-row">
        <button className="ph-btn soft" disabled={!!busy} onClick={() => exportIt("copy")}>Copy the script</button>
        <button className="ph-btn soft" disabled={!!busy} onClick={() => exportIt("save")}><PIcon name="download" size={15} /> Save as a file</button>
      </div>
    </div>
  );
}

function ContextStep({ p, setP, run, busy, onAway }: StepProps & { onAway: () => void }) {
  const { toast } = usePhone();
  const [c, setC] = useState({ title: p.title, batch_size: p.batch_size, ...p.context, primary: p.context.primary.join(", "), supporting: p.context.supporting.join(", ") });
  const [shared, setShared] = useState<Shared | null>(null);
  const [brief, setBrief] = useState<any>({ name: "", aliases: "", relationships: "", personality: "", history: "", goals: "", boundaries: "", status: "canon" });
  const [ev, setEv] = useState<any>({ name: "", key: "", when: "", notes: "", owner: false });
  useEffect(() => { api.get("/api/story/production/shared").then(setShared).catch(() => setShared(null)); }, []);
  const save = () => run("ctx", () => api.post(`${base(p.id)}/context`, { ...c, primary: c.primary.split(",").map((x) => x.trim()).filter(Boolean),
    supporting: c.supporting.split(",").map((x) => x.trim()).filter(Boolean) }), (v: Project) => { setP(v); toast(`Saved (context v${v.snapshot}): prompts copied from now on carry it.`, "good"); });
  const saveBrief = () => run("brief", () => api.post("/api/story/production/shared/character", { ...brief, aliases: brief.aliases.split(",").map((x: string) => x.trim()).filter(Boolean) }),
    (d: Shared) => { setShared(d); setBrief({ name: "", aliases: "", relationships: "", personality: "", history: "", goals: "", boundaries: "", status: "canon" }); });
  const saveEvent = () => run("event", () => api.post("/api/story/production/shared/event", { name: ev.name, key: ev.key || undefined, when: ev.when, notes: ev.notes,
    ...(ev.owner ? { owner: { project: p.id, title: p.title } } : {}) }), (d: Shared) => { setShared(d); setEv({ name: "", key: "", when: "", notes: "", owner: false }); });
  const field = (k: string, label: string, rows = 0) => (
    <label key={k}>{label}{rows
      ? <textarea className="dl-ta" rows={rows} value={(c as any)[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
      : <input className="pw-in" value={(c as any)[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />}</label>
  );
  return (
    <div className="pw-step pw-form">
      <div className="pw-box">
        <b>This storyline</b>
        {field("title", "Title")}
        {field("brief", "What it's about", 2)}
        {field("time_period", "Time period")}
        {field("tone", "Tone")}
        {field("primary", "Focus characters (comma separated)")}
        {field("supporting", "Also around")}
        {field("canon", "What's already true (canon, relationships, history)", 4)}
        {field("instructions", "How you want it written", 3)}
        <label>Batch size<input className="pw-in" type="number" min={1} max={20} value={c.batch_size} onChange={(e) => setC({ ...c, batch_size: Number(e.target.value) || 6 })} /></label>
        <button className="ph-btn primary block" disabled={!!busy} onClick={save}>{busy === "ctx" ? <span className="ph-spinner small" /> : "Save"}</button>
        <small className="ph-dim">Every batch prompt carries this, in the same version (v{p.snapshot}). The header (cast, years) comes from your outline.</small>
      </div>
      <details className="pw-box">
        <summary><b>Shared character briefs</b> ({Object.keys(shared?.characters || {}).length}) <small className="ph-dim">notes for prompts; your world's characters aren't changed</small></summary>
        {Object.entries(shared?.characters || {}).map(([k, b]: any) => (
          <div key={k} className="pw-brief"><b>{b.name}</b>{b.status && b.status !== "canon" ? <i> · {b.status}</i> : null}<small>{[b.relationships, b.personality].filter(Boolean).join(" · ")}</small>
            <button className="ph-link" onClick={() => setBrief({ ...brief, ...b, aliases: (b.aliases || []).join(", ") })}>Edit</button></div>
        ))}
        {(["name", "aliases", "relationships", "personality", "history", "goals", "boundaries"] as const).map((k) => (
          <label key={k}>{k === "aliases" ? "Aliases (cast names, comma separated)" : k[0].toUpperCase() + k.slice(1)}
            <input className="pw-in" value={brief[k]} onChange={(e) => setBrief({ ...brief, [k]: e.target.value })} /></label>
        ))}
        <label>Status<select className="pw-in" value={brief.status} onChange={(e) => setBrief({ ...brief, status: e.target.value })}>
          <option value="canon">Approved canon</option><option value="simulated">From the simulation</option>
          <option value="proposed">Proposed direction</option><option value="unresolved">Unresolved</option></select></label>
        <button className="ph-btn soft block" disabled={!!busy || !brief.name.trim()} onClick={saveBrief}>Save brief</button>
      </details>
      <details className="pw-box">
        <summary><b>Shared events</b> ({Object.keys(shared?.events || {}).length}) <small className="ph-dim">occasions several storylines can point at (scene blueprint: Shared event)</small></summary>
        {Object.entries(shared?.events || {}).map(([k, e]: any) => (
          <div key={k} className="pw-brief"><b>{e.name || k}</b> <code>{k}</code><small>{[e.when, e.notes, e.owner?.title ? `belongs to ${e.owner.title}` : ""].filter(Boolean).join(" · ")}</small></div>
        ))}
        <label>Name<input className="pw-in" value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} /></label>
        <label>Key (what scenes point at; blank: from the name)<input className="pw-in" value={ev.key} onChange={(e) => setEv({ ...ev, key: e.target.value })} /></label>
        <label>When<input className="pw-in" value={ev.when} onChange={(e) => setEv({ ...ev, when: e.target.value })} /></label>
        <label>Notes<input className="pw-in" value={ev.notes} onChange={(e) => setEv({ ...ev, notes: e.target.value })} /></label>
        <label className="pw-check-row"><input type="checkbox" checked={ev.owner} onChange={(e) => setEv({ ...ev, owner: e.target.checked })} /> This storyline defines it</label>
        <button className="ph-btn soft block" disabled={!!busy || !ev.name.trim()} onClick={saveEvent}>Save event</button>
      </details>
      <button className="ph-link dl-remove" onClick={async () => {
        if (!window.confirm(`Put “${p.title}” away? Your storylines aren't touched.`)) return;
        if (await run("del", () => api.post(`${base(p.id)}/delete`))) {
          toast("Put away.", "good");
          onAway();
        }
      }}>Put this project away</button>
    </div>
  );
}
