// Story schedule (Me → How much story a day → Story schedule): every storyline, what's played, what's ready, what's
// waiting and exactly why, and a dry run of the next seven years you can save as a report.
import React, { useEffect, useState } from "react";
import { phoneApi, ScheduleReport, ScheduleRow, ScheduleView } from "./api";
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
            <button className="ph-btn block" onClick={save}>Save the full report</button>
          </div>
        )}
      </div>
      <div style={{ height: 30 }} />
    </div>
  );
}
