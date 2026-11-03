// Story schedule (Me → How much story a day → Story schedule): every storyline, what's played, what's ready, what's
// waiting and exactly why, and a dry run of the next seven years you can save as a report.
import React, { useEffect, useState } from "react";
import { AddPreview, Coverage, phoneApi, ScheduleReport, ScheduleRow, ScheduleView } from "./api";
import { copyText } from "./DialogueCard";
import { PIcon } from "./icons";
import { cx, errText } from "./kit";
import { usePhone } from "./PhoneContext";

const STATE_LABEL: Record<string, string> = {
  played: "Played", presented: "On now", queued: "Today", eligible: "Ready", waiting: "Not yet", unreachable: "Won't happen", expired: "Missed",
};
const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function why(r: ScheduleRow): string {
  const d = r.detail;
  const extra = d === null || d === undefined ? "" : Array.isArray(d) ? ` (${d.map((m: number) => MONTHS[m] || m).join(", ")})` : ` (${String(d).replace(/_/g, " ")})`;
  return r.why ? r.why + extra : "";
}

export function ScheduleScreen() {
  const { toast } = usePhone();
  const [v, setV] = useState<ScheduleView | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [rep, setRep] = useState<ScheduleReport | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    phoneApi.schedule().then(setV).catch((e) => toast(errText(e), "bad"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => (window.history.length > 1 ? window.history.back() : (window.location.hash = "#/m/me"));
  if (!v) return <div className="sch"><button className="sch-back" onClick={back}><PIcon name="chevron" size={18} /> Back</button><div className="pm-empty"><span className="ph-spinner" /></div></div>;

  const runReport = async () => {
    setRunning(true);
    try {
      setRep(await phoneApi.scheduleReport(7 * 365));
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setRunning(false);
    }
  };
  const save = () => {
    if (!rep?.markdown) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rep.markdown], { type: "text/markdown" }));
    a.download = "story-schedule-report.md";
    a.click();
  };
  const prof = v.profiles[v.profile];
  return (
    <div className="sch">
      <button className="sch-back" onClick={back}><PIcon name="chevron" size={18} /> Back</button>
      <h2>Story schedule</h2>
      <div className="sch-top">
        <div><b>{prof?.label || v.profile}</b><small>{prof?.about}</small></div>
        <div className="sch-today"><b>{v.presented_today}</b><small>scene{v.presented_today === 1 ? "" : "s"} today{v.queue.length ? ` · ${v.queue.length} more coming` : ""}</small></div>
      </div>
      {v.queue.length > 0 && (
        <div className="sch-queue">
          {v.queue.map((q) => <span key={q.sid} className={cx("sch-q", "imp-" + q.importance)}>{q.title || q.sid}<i>{q.phase.replace("_", " ")}</i></span>)}
        </div>
      )}
      <div className="sch-h">Storylines</div>
      {v.storylines.map((s) => {
        const rows = v.scenes.filter((r) => r.pack === s.pack);
        return (
          <div key={s.pack} className={cx("sch-line", open === s.pack && "open")}>
            <button className="sch-line-top" onClick={() => setOpen(open === s.pack ? null : s.pack)}>
              <span className="sch-line-m"><b>{s.name}</b><small>{s.in_order ? "In order" : "Any order"} · {rows.length} scenes</small></span>
              <span className="sch-chips">
                <i className="c-played">{s.played}</i>
                {(s.eligible + s.queued) > 0 && <i className="c-ready">{s.eligible + s.queued}</i>}
                {s.waiting > 0 && <i className="c-wait">{s.waiting}</i>}
                {(s.unreachable + s.expired) > 0 && <i className="c-no">{s.unreachable + s.expired}</i>}
              </span>
            </button>
            {open === s.pack && (
              <div className="sch-rows">
                {rows.map((r) => (
                  <div key={r.sid} className={cx("sch-row", "st-" + r.state)}>
                    <span className="sch-st">{STATE_LABEL[r.state] || r.state}</span>
                    <span className="sch-row-m">
                      <b>{r.title}</b>
                      <small>
                        {r.state === "played" ? r.date : why(r)}
                        {r.window_text && r.state !== "played" ? ` · season: ${r.window_text}` : ""}
                        {r.importance === "major" || r.importance === "finale" ? ` · ${r.importance}` : ""}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="sch-legend"><i className="c-played" /> played <i className="c-ready" /> ready <i className="c-wait" /> not yet <i className="c-no" /> won't happen</div>

      <div className="sch-h">Check the next seven years</div>
      <div className="sch-card">
        <p>Plays your stories forward on a copy (your real story doesn't change), with your character answering every scene, and lists every scene: when it would play or why it can't, anything out of season or out of order, and who each storyline's people are.</p>
        <button className="ph-btn primary block" onClick={runReport} disabled={running}>{running ? <span className="ph-spinner small light" /> : "Run the check"}</button>
        {rep && (
          <div className="sch-rep">
            <div className="sch-rep-counts">
              {Object.entries(rep.counts).map(([k, n]) => <span key={k}><b>{n}</b><small>{STATE_LABEL[k] || k}</small></span>)}
            </div>
            <div className="sch-rep-h">Who's who</div>
            {rep.identity.map((r) => <div key={r.slot} className={cx("sch-rep-l", r.problems.length > 0 && "bad")}>{r.slot}: {r.name || "nobody"}{r.problems.length ? ` — ${r.problems.join("; ")}` : ""}</div>)}
            <div className="sch-rep-h">Contradictions</div>
            {rep.warnings.length ? rep.warnings.map((x, i) => <div key={i} className="sch-rep-l bad">{x.text}</div>) : <div className="sch-rep-l ok">None: everything in season and in order.</div>}
            {rep.deadline_misses.length > 0 && <div className="sch-rep-l bad">{rep.deadline_misses.length} scene{rep.deadline_misses.length === 1 ? "" : "s"} missed their window</div>}
            {rep.busiest_days.length > 0 && <div className="sch-rep-l">Busiest days: {rep.busiest_days.map((b) => `${b.date} (${b.scenes})`).join(", ")}</div>}
            {rep.coverage && <CoverageGrid c={rep.coverage} />}
            <button className="ph-btn block" onClick={save}>Save the full report</button>
          </div>
        )}
      </div>
      <div className="sch-h">Add to your story</div>
      <AddToStory onAdded={() => phoneApi.schedule().then(setV)} />
      <div style={{ height: 30 }} />
    </div>
  );
}

/** Scenes per month for each of the seven years: where the story is full and where it's thin. */
function CoverageGrid({ c }: { c: Coverage }) {
  const max = Math.max(1, ...c.years.flatMap((y) => y.months));
  return (
    <div className="sch-cov">
      <div className="sch-rep-h">Your seven years, month by month</div>
      <div className="sch-cov-g">
        <span />
        {c.months.map((m) => <i key={m}>{m[0]}</i>)}
        {c.years.map((y) => (
          <React.Fragment key={y.key}>
            <b title={`${y.total} scenes`}>{y.label.replace("College ", "C. ")}</b>
            {y.months.map((n, i) => <span key={i} className="sch-cov-c" style={{ opacity: n ? 0.25 + 0.75 * (n / max) : 1 }} data-n={n || ""} title={`${c.months[i]}: ${n}`} />)}
          </React.Fragment>
        ))}
      </div>
      {c.quiet.length > 0 && <div className="sch-rep-l">Quiet stretches: {c.quiet.slice(0, 4).map((q) => `${q.from.replace(/^\w+, /, "")} to ${q.to.replace(/^\w+, /, "")}`).join(" · ")}</div>}
    </div>
  );
}

/** Ask ChatGPT for more story with a prompt that knows yours, then check what it wrote on a copy before adding it. */
function AddToStory({ onAdded }: { onAdded: () => void }) {
  const { toast, refresh } = usePhone();
  const [ask, setAsk] = useState("");
  const [sugg, setSugg] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<{ text: string; checked: boolean } | null>(null);
  const [paste, setPaste] = useState("");
  const [pv, setPv] = useState<AddPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    phoneApi.addPrompt("").then((r) => setSugg(r.suggestions)).catch(() => undefined);
  }, []);
  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try {
      await fn();
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  const make = () => run("make", async () => {
    const r = await phoneApi.addPrompt(ask);
    setPrompt({ text: r.prompt, checked: r.checked });
  });
  const copy = async () => {
    if (!prompt) return;
    toast((await copyText(prompt.text)) ? "Copied. Paste it into ChatGPT." : "Couldn't copy. Try Share.", "good");
  };
  const share = async () => {
    if (!prompt) return;
    try {
      await (navigator as any).share({ title: "LIFE OS: add to my story", text: prompt.text });
    } catch { /* cancelled */ }
  };
  const check = () => run("check", async () => setPv(await phoneApi.addPreview(paste)));
  const add = () => run("add", async () => {
    await phoneApi.addPack(paste);
    toast(`Added: ${pv?.name || "your new scenes"}.`, "good");
    setPv(null);
    setPaste("");
    setPrompt(null);
    onAdded();
    refresh();
  });
  const playedNew = (pv?.new || []).filter((x) => x.state === "played");
  const notNew = (pv?.new || []).filter((x) => x.state !== "played");
  return (
    <div className="sch-card sch-add">
      <div className="sch-step"><i>1</i><b>What do you want more of?</b></div>
      <textarea className="ph-input" rows={3} value={ask} placeholder="Like: more sophomore year with the twins, a storyline about my brother's college team, fill the quiet weeks"
        onChange={(e) => setAsk(e.target.value)} />
      <div className="sch-sugg">{sugg.map((s) => <button key={s} onClick={() => setAsk(s)}>{s}</button>)}</div>
      <button className="ph-btn primary block" disabled={!!busy} onClick={make}>{busy === "make" ? <span className="ph-spinner small light" /> : "Make my ChatGPT prompt"}</button>
      {prompt && (
        <div className="sch-prompt">
          <p className="ph-dim small">Ready: it has your family and cast, every storyline and its scene ids, {prompt.checked ? "how your seven years play right now (from your last check), " : ""}and the rules for an answer the game can load.
            {!prompt.checked && " Run the check above first and the prompt will know where your story is thin."}</p>
          <div className="sch-row2">
            <button className="ph-btn block" onClick={copy}>Copy</button>
            {"share" in navigator && <button className="ph-btn block" onClick={share}>Share to ChatGPT</button>}
          </div>
        </div>
      )}
      <div className="sch-step"><i>2</i><b>Paste what ChatGPT gives you</b></div>
      <textarea className="ph-input mono" rows={4} value={paste} placeholder="Paste the whole answer. The game finds the pack inside it." onChange={(e) => { setPaste(e.target.value); setPv(null); }} />
      <button className="ph-btn block" disabled={!!busy || !paste.trim()} onClick={check}>{busy === "check" ? <span className="ph-spinner small" /> : "Check it (nothing is saved yet)"}</button>
      {pv && !pv.ok && (
        <div className="sch-pv bad">
          <b>It needs a fix before it can load</b>
          {pv.errors.slice(0, 6).map((e, i) => <div key={i} className="sch-rep-l bad">{e}</div>)}
          {pv.errors.length > 6 && <div className="sch-rep-l">…and {pv.errors.length - 6} more</div>}
          {pv.fix_prompt && <button className="ph-btn block" onClick={async () => toast((await copyText(pv.fix_prompt!)) ? "Copied. Paste it back to ChatGPT." : "Couldn't copy.", "good")}>Copy a fix-it message for ChatGPT</button>}
        </div>
      )}
      {pv && pv.ok && (
        <div className="sch-pv">
          <b>{pv.name}</b>
          <div className="sch-rep-l ok">{pv.new?.length || 0} new scene{pv.new?.length === 1 ? "" : "s"}: {playedNew.length} play in your seven years
            {playedNew.length ? ` (${playedNew[0].date} to ${playedNew[playedNew.length - 1].date})` : ""}.</div>
          {pv.before !== null && pv.before !== undefined && <div className="sch-rep-l">Your story: {pv.before} scenes play now, {pv.played_total} with this.</div>}
          {notNew.length > 0 && <>
            <div className="sch-rep-h">Won't play</div>
            {notNew.slice(0, 6).map((x) => <div key={x.sid} className="sch-rep-l bad">{x.title}: {x.why || x.reason}{x.detail ? ` (${x.detail})` : ""}</div>)}
          </>}
          {(pv.changed || []).length > 0 && <>
            <div className="sch-rep-h">Changes to scenes you have</div>
            {pv.changed!.slice(0, 8).map((x) => <div key={x.sid} className="sch-rep-l">{x.title}: {x.state === "played" ? `plays ${x.date}` : x.why || x.reason}</div>)}
          </>}
          {pv.warnings.length > 0 && <>
            <div className="sch-rep-h">Heads up (it still loads)</div>
            {pv.warnings.slice(0, 3).map((x, i) => <div key={i} className="sch-rep-l">{x}</div>)}
          </>}
          {(pv.already_there || []).length > 0 && <div className="sch-rep-l bad">Already in your story (skipped): {pv.already_there!.join(", ")}</div>}
          {pv.coverage && <CoverageGrid c={pv.coverage} />}
          <button className="ph-btn primary block" disabled={!!busy} onClick={add}>{busy === "add" ? <span className="ph-spinner small light" /> : "Add it to my story"}</button>
          <p className="ph-dim small">It goes in as its own pack: on or off any time under Me &gt; Storylines, and your other files don't change.</p>
        </div>
      )}
    </div>
  );
}
