// The season break: when the School Year (Sept to May) or the Summer (June to August) ends, the story stops here, like a
// career mode's end-of-season loading screen. It closes the books on the season (what played, what didn't and why, your
// teams, the big moments), clears out what the game only kept to explain the past (so your save stays small and quick),
// and checks every storyline in the season ahead. Then you go on.
import React, { useEffect, useState } from "react";
import { phoneApi, SeasonBreakState, SeasonReport } from "./api";
import { PIcon } from "./icons";
import { cx, errText } from "./kit";
import { usePhone } from "./PhoneContext";

const MIN_MS = 6500;  // the loading screen shows its steps even when the work is quick

export default function SeasonBreak({ sb }: { sb: SeasonBreakState }) {
  const { refresh } = usePhone();
  const [report, setReport] = useState<SeasonReport | null>(sb.report);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const steps = [
    `Closing the books on ${sb.from_label.toLowerCase()}`,
    "Wrapping up your storylines",
    "Clearing out what the game doesn't need anymore",
    `Setting up ${sb.to_label.toLowerCase()}`,
    "Checking every storyline for the season ahead",
  ];
  useEffect(() => {
    if (report) return undefined;
    let alive = true;
    const t0 = Date.now();
    const tick = window.setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), MIN_MS / steps.length);
    phoneApi.seasonBreak().then(async (r) => {
      await new Promise((res) => window.setTimeout(res, Math.max(0, MIN_MS - (Date.now() - t0))));
      if (!alive) return;
      setStep(steps.length);
      setReport(r.report);
    }).catch((e) => alive && setErr(errText(e))).finally(() => window.clearInterval(tick));
    return () => {
      alive = false;
      window.clearInterval(tick);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = async () => {
    setBusy(true);
    try {
      await phoneApi.seasonSeen();
      await refresh();
    } catch (e) {
      setErr(errText(e));
      setBusy(false);
    }
  };

  if (!report) {
    return (
      <div className="sb-load">
        <div className="sb-kicker">End of the season</div>
        <h1>{sb.from_label}</h1>
        <div className="sb-bar"><i style={{ width: `${Math.round((Math.min(step + 1, steps.length) / steps.length) * 100)}%` }} /></div>
        <ul className="sb-steps">
          {steps.map((s, i) => (
            <li key={s} className={cx(i < step && "done", i === step && "now")}>
              {i < step ? <PIcon name="check" size={15} /> : i === step ? <span className="ph-spinner small" /> : <span className="sb-dot" />}
              {s}
            </li>
          ))}
        </ul>
        {err ? (
          <div className="sb-err">
            <p>{err}</p>
            <button className="ph-btn primary" onClick={() => window.location.reload()}>Try again</button>
          </div>
        ) : <p className="sb-note">Your story's saved. This takes a moment, twice a year.</p>}
      </div>
    );
  }
  const r = report;
  return (
    <div className="sb-report">
      <div className="sb-kicker">That's a wrap</div>
      <h1>{r.label}</h1>
      <p className="sb-sub">{r.played} storyline scene{r.played === 1 ? "" : "s"} played{r.missed ? ` · ${r.missed} didn't get to play` : ""}</p>

      {r.teams.length > 0 && (
        <section className="sb-card">
          <h3>Your teams</h3>
          {r.teams.map((t) => (
            <div key={t.team + t.level} className="sb-team">
              <b>{t.team}{t.level === "jv" ? " JV" : ""}</b>
              <span className="sb-rec">{t.record}</span>
              <small>{t.games} game{t.games === 1 ? "" : "s"}, {t.starts} start{t.starts === 1 ? "" : "s"}{t.line ? ` · ${t.line}` : ""}</small>
            </div>
          ))}
        </section>
      )}

      {r.moments.length > 0 && (
        <section className="sb-card">
          <h3>The big moments</h3>
          {r.moments.map((m, i) => <p key={i} className="sb-moment"><small>{m.date}</small>{m.text}</p>)}
        </section>
      )}

      <section className="sb-card">
        <h3>Your storylines this season</h3>
        {r.storylines.length === 0 && <p className="ph-dim small">None had scenes this season.</p>}
        {r.storylines.map((s) => <StoryRow key={s.pack} s={s} />)}
      </section>

      <section className="sb-card sb-ahead">
        <h3>{r.next_label}</h3>
        <p className="ph-dim small">
          {r.ahead.storylines.length
            ? `${r.ahead.scenes} scene${r.ahead.scenes === 1 ? "" : "s"} in ${r.ahead.storylines.length} storyline${r.ahead.storylines.length === 1 ? "" : "s"}. ${r.ahead.need ? `${r.ahead.need} need${r.ahead.need === 1 ? "s" : ""} you first:` : "All set."}`
            : "No storyline scenes are set for this season yet. Story Studio is where to add some."}
        </p>
        {r.ahead.storylines.filter((s) => s.issues.length).map((s) => (
          <div key={s.pack} className="sb-issue">
            <b>{s.name}</b>
            {s.issues.map((x) => <small key={x}>{x}</small>)}
          </div>
        ))}
      </section>

      <p className="sb-clean">
        Cleared out {r.cleaned.traces.toLocaleString()} old decision notes and the working behind {r.cleaned.events_trimmed.toLocaleString()} past
        events, so your save stays light. Everything that happened is still there.
      </p>
      {err && <p className="sb-err">{err}</p>}
      <button className="ph-btn primary block big" disabled={busy} onClick={go}>
        {busy ? <span className="ph-spinner small light" /> : <>On to {r.next_label.toLowerCase()} <PIcon name="chevron" size={18} /></>}
      </button>
    </div>
  );
}

function StoryRow({ s }: { s: SeasonReport["storylines"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sb-story">
      <button className="sb-story-h" onClick={() => setOpen(!open)} disabled={!s.missed.length}>
        <b>{s.name}</b>
        <span>{s.played} played{s.missed.length ? ` · ${s.missed.length} didn't` : ""}</span>
      </button>
      {open && s.missed.map((m, i) => <small key={i} className="sb-miss"><b>{m.title}</b>: {m.why}</small>)}
    </div>
  );
}
