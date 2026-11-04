// Write more, the way that holds up: (1) ChatGPT plans an outline (one line per scene) and the app turns it into the
// storyline; (2) ChatGPT writes the scenes a few at a time, each batch dropped into its place. The game owns the order,
// the timing and the branches, and anything fixable in what ChatGPT wrote is fixed (with a note), never refused.
import React, { useEffect, useState } from "react";
import { BatchPrompt, OutlineCheck, OutlineEntry, phoneApi } from "./api";
import { copyText } from "./DialogueCard";
import { PIcon } from "./icons";
import { cx, errText, Sheet } from "./kit";
import { usePhone } from "./PhoneContext";
import { pickFile } from "./StoryFiles";

const SIZES: [string, string, string][] = [["few", "A few", "6 to 8 scenes"], ["bunch", "A bunch", "12 to 18"], ["lot", "A lot", "30 to 45"]];
const IDEAS_NEW = ["My sister and her friends at the house", "A season with my brother on the same team", "Scenes in biology class all year",
  "Holidays with my family, every year", "My best friend and me getting into trouble"];
const IDEAS_EXP = ["Holidays with them", "Their friends coming around", "A season of their sport", "Summers", "A fight, a secret, making up"];

export type BuildStart = { expand?: string; expandName?: string; pack?: string } | null;

async function share(text: string, title: string) {
  try {
    await (navigator as any).share({ title, text });
  } catch { /* cancelled */ }
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div className="bs-notes">
      <b>Fixed for you ({notes.length})</b>
      {notes.slice(0, 12).map((n, i) => <div key={i}>{n}</div>)}
      {notes.length > 12 && <div>…and {notes.length - 12} more</div>}
    </div>
  );
}

function OutlineList({ entries, now }: { entries: OutlineEntry[]; now?: number[] }) {
  return (
    <ol className="bs-outline">
      {entries.map((e) => (
        <li key={e.n} className={cx(e.written && "done", now?.includes(e.n) && "now")}>
          <span className="bs-n">{e.written ? "✓" : e.n}</span>
          <span className="bs-t"><b>{e.title}</b>{e.when && <i>{e.when}</i>}{e.summary && <small>{e.summary}</small>}
            {e.if && <em>{e.if}</em>}</span>
        </li>
      ))}
    </ol>
  );
}

export default function BuildStoryline({ start, onClose, onChanged, onRead }: {
  start: BuildStart; onClose: () => void; onChanged: () => void; onRead: (pack: string) => void;
}) {
  const { toast } = usePhone();
  const [pack, setPack] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [size, setSize] = useState("bunch");
  const [paste, setPaste] = useState("");
  const [check, setCheck] = useState<OutlineCheck | null>(null);
  const [batch, setBatch] = useState<BatchPrompt | null>(null);
  const [entries, setEntries] = useState<OutlineEntry[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [count, setCount] = useState(6);
  useEffect(() => {
    setPack(start?.pack || null);
    setAsk("");
    setPaste("");
    setCheck(null);
    setBatch(null);
    setNotes([]);
    setEntries([]);
    if (start?.pack) loadBatch(start.pack, count);
  }, [start]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try {
      await fn();
    } catch (e: any) {
      toast(e?.errors?.[0] || errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  async function loadBatch(pid: string, n: number) {
    const b = await phoneApi.batchPrompt(pid, n);
    setBatch(b);
  }
  const fromFile = async () => {
    const f = await pickFile(".txt,.story,.md,text/plain");
    if (f) setPaste(await f.text());
  };

  // step 1: the outline
  const copyOutline = () => run("copy", async () => {
    const r = await phoneApi.outlinePrompt(ask, size, start?.expand);
    const ok = await copyText(r.prompt);
    toast(ok ? "Copied. Paste it into ChatGPT, then paste its outline below." : "Couldn't copy. Try Share.", ok ? "good" : "bad");
  });
  const shareOutline = () => run("share", async () => share((await phoneApi.outlinePrompt(ask, size, start?.expand)).prompt, "LIFE OS: plan a storyline"));
  const checkOutline = () => run("check", async () => setCheck(await phoneApi.outline(paste, false, start?.expand)));
  const create = () => run("create", async () => {
    const r = await phoneApi.outline(paste, true, start?.expand);
    setPack(r.pack!);
    setPaste("");
    setCheck(null);
    setNotes(r.notes);
    onChanged();
    await loadBatch(r.pack!, count);
    toast(`${r.title}: ${r.outline.length} scenes planned. Now the scenes, a few at a time.`, "good");
  });

  // step 2: scenes, a batch at a time
  const copyBatch = () => run("copy", async () => {
    if (!batch?.prompt) return;
    const ok = await copyText(batch.prompt);
    toast(ok ? `Copied: scenes ${batch.first} to ${batch.last}. Paste ChatGPT's answer below.` : "Couldn't copy. Try Share.", ok ? "good" : "bad");
  });
  const addBatch = () => run("add", async () => {
    if (!pack) return;
    const r = await phoneApi.addScenes(pack, paste);
    setNotes(r.notes);
    setEntries(r.outline);
    setPaste("");
    onChanged();
    await loadBatch(pack, count);
    toast(r.got.length ? `Added scene${r.got.length === 1 ? "" : "s"} ${r.got.join(", ")}. ${r.written} of ${r.total} written.` : "Added.", "good");
  });

  const title = pack ? "Write the scenes" : start?.expand ? `More of ${start.expandName || "it"}` : "Write more";
  return (
    <Sheet open={!!start} onClose={onClose} full title={title}>
      {!pack ? (
        <div className="bs">
          <div className="bs-steps"><span className="on">1 Plan it</span><span>2 Write the scenes</span></div>
          <div className="sch-step"><i>1</i><b>{start?.expand ? "What should this part be?" : "What's it about?"}</b></div>
          <textarea className="ph-input" rows={3} value={ask} onChange={(e) => setAsk(e.target.value)}
            placeholder={start?.expand ? "Like: holidays with them. Their friends coming around." : "Like: my sister's friends hanging out at the house. A bunch of scenes in biology class."} />
          <div className="sch-sugg">{(start?.expand ? IDEAS_EXP : IDEAS_NEW).map((s) => <button key={s} onClick={() => setAsk(s)}>{s}</button>)}</div>
          <div className="sch-size"><span>How many scenes</span>
            {SIZES.map(([k, l, d]) => <button key={k} className={cx(size === k && "on")} onClick={() => setSize(k)} title={d}>{l}</button>)}
          </div>
          <div className="sch-row2">
            <button className="ph-btn primary block" disabled={!!busy} onClick={copyOutline}>{busy === "copy" ? <span className="ph-spinner small light" /> : "Copy the outline prompt"}</button>
            {"share" in navigator && <button className="ph-btn block" disabled={!!busy} onClick={shareOutline}>Share</button>}
          </div>
          <p className="ph-dim small">ChatGPT plans it as one line per scene (short, so nothing gets cut off). You'll see it before anything is made.</p>
          <div className="sch-step"><i>2</i><b>Paste ChatGPT's outline</b></div>
          <textarea className="ph-input mono" rows={5} value={paste} placeholder={"=== Title\ncast: mike = Mike Soffer\nyears: freshman\n\noutline:\n1. ... | September | ..."}
            onChange={(e) => { setPaste(e.target.value); setCheck(null); }} />
          <div className="sch-row2">
            <button className="ph-btn block" disabled={!!busy || !paste.trim()} onClick={checkOutline}>{busy === "check" ? <span className="ph-spinner small" /> : "Check it"}</button>
            <button className="ph-btn soft block" disabled={!!busy} onClick={fromFile}><PIcon name="upload" size={15} /> Or a file</button>
          </div>
          {check && (
            <div className="bs-check">
              <b className="bs-title">{check.title}</b>
              {check.expands && <small className="ph-dim">More of {check.expands}</small>}
              {check.about && <p className="ph-dim small">{check.about}</p>}
              {check.cast.length > 0 && <p className="ph-dim small">People: {check.cast.map((c) => `${c.name} (${c.label})`).join(", ")}</p>}
              <OutlineList entries={check.outline} />
              <Notes notes={[...check.notes, ...check.warnings]} />
              <button className="ph-btn primary block" disabled={!!busy} onClick={create}>
                {busy === "create" ? <span className="ph-spinner small light" /> : `Make it: ${check.outline.length} scenes`}
              </button>
              <p className="ph-dim small">The game puts them in order and spaces them through the year (holidays and school days on their day). Nothing plays until its scene is written.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bs">
          <div className="bs-steps"><span>1 Plan it</span><span className="on">2 Write the scenes</span></div>
          {batch && (
            <div className="bs-progress">
              <div className="bs-bar"><i style={{ width: `${(100 * batch.written) / Math.max(1, batch.total)}%` }} /></div>
              <b>{batch.written} of {batch.total} scenes written</b>
            </div>
          )}
          {batch && !batch.done ? (
            <>
              <div className="sch-step"><i>1</i><b>Copy the prompt for scenes {batch.first} to {batch.last}</b></div>
              <p className="ph-dim small">{(batch.titles || []).join(" · ")}</p>
              <div className="sch-size"><span>Scenes per prompt</span>
                {[3, 6, 10].map((n) => <button key={n} className={cx(count === n && "on")} onClick={() => { setCount(n); if (pack) run("load", () => loadBatch(pack, n)); }}>{n}</button>)}
              </div>
              <div className="sch-row2">
                <button className="ph-btn primary block" disabled={!!busy} onClick={copyBatch}>{busy === "copy" ? <span className="ph-spinner small light" /> : "Copy the prompt"}</button>
                {"share" in navigator && <button className="ph-btn block" disabled={!!busy} onClick={() => batch.prompt && share(batch.prompt, "LIFE OS: write scenes")}>Share</button>}
              </div>
              <div className="sch-step"><i>2</i><b>Paste the scenes ChatGPT wrote</b></div>
              <textarea className="ph-input mono" rows={6} value={paste} placeholder={`--- ${batch.first}. ${(batch.titles || [""])[0]}\n...`} onChange={(e) => setPaste(e.target.value)} />
              <div className="sch-row2">
                <button className="ph-btn primary block" disabled={!!busy || !paste.trim()} onClick={addBatch}>{busy === "add" ? <span className="ph-spinner small light" /> : "Add these scenes"}</button>
                <button className="ph-btn soft block" disabled={!!busy} onClick={fromFile}><PIcon name="upload" size={15} /> Or a file</button>
              </div>
            </>
          ) : batch?.done ? (
            <div className="bs-done">
              <b>All {batch.total} scenes are written.</b>
              <button className="ph-btn primary block" onClick={() => pack && onRead(pack)}>Read it</button>
            </div>
          ) : <div className="pm-empty"><span className="ph-spinner" /></div>}
          <Notes notes={notes} />
          {entries.length > 0 && <OutlineList entries={entries} now={batch && !batch.done ? Array.from({ length: (batch.last || 0) - (batch.first || 0) + 1 }, (_, i) => (batch.first || 0) + i) : []} />}
          {pack && <button className="ph-link center" onClick={() => onRead(pack)}>Read it so far</button>}
        </div>
      )}
    </Sheet>
  );
}
