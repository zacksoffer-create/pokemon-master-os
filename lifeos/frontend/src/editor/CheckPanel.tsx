// What the game engine says about your story: what would stop a storyline from loading, what's wrong across them, and
// the seven years played from the first day (what plays when, what never happens and why).
import React from "react";
import { findScene, PALETTE } from "./model";
import { useEd } from "./state";

const REASONS: Record<string, string> = {
  year_passed: "its school years ended first", chapter_order: "stuck behind an earlier chapter", never_picked: "ready, but never got picked",
  missing_cast: "nobody in your story fits who it's about", branch_closed: "the other branch happened", missing_fact: "needs something that never happened",
  waiting_for_scene: "waiting for a scene that never came", after_unreachable: "comes after a scene that can't happen", wrong_season: "its season never came",
  window_passed: "its window closed", exclusive_branch: "the other branch happened", skipped_by_plan: "retired by the season plan",
  too_early: "not yet when the story ended", mood: "the mood it needs never came",
};

export default function CheckPanel({ onScene }: { onScene: (sid: string) => void }) {
  const { p, check, run, runCheck, runStory, busy } = useEd();
  const goError = (pack: number, e: string) => {
    const m = e.match(/^scenes\[(\d+)\]/);
    const sc = m ? p.packs[pack]?.scenes?.[Number(m[1])] : null;
    if (sc) onScene(sc.id);
  };
  const missing = run ? run.scenes.filter((s) => s.state !== "played") : [];
  const groups = new Map<string, typeof missing>();
  missing.forEach((s) => {
    const k = s.reason || s.state;
    groups.set(k, [...(groups.get(k) || []), s]);
  });
  const max = run ? Math.max(1, ...run.coverage.years.flatMap((y) => y.months)) : 1;
  const errCount = check ? check.packs.reduce((n, x) => n + x.errors.length, 0) : 0;
  return (
    <div className="ed-checkp">
      <div className="ed-row wrap">
        <button className="ed-btn" onClick={runCheck} disabled={!!busy}>{busy === "check" ? "Checking…" : "Check the files"}</button>
        <button className="ed-btn primary" onClick={runStory} disabled={!!busy}>{busy === "run" ? "Playing seven years…" : "Play it through"}</button>
        <span className="ed-dim small">Check: will every storyline load. Play it through: the whole story from the first day, your character answering, on {p.spec ? p.specName || "your story" : "the sample story"}.</span>
      </div>

      {check && (
        <div className="ed-sec">
          <div className="ed-sec-h"><b>{check.ok && !check.cross.length ? "Every storyline loads" : `${errCount} to fix${check.cross.length ? `, ${check.cross.length} across storylines` : ""}`}</b>
            <small>{check.storylines} storylines, {check.scenes} scenes.</small></div>
          {check.packs.filter((x) => x.errors.length || x.warnings.length).map((x) => (
            <div key={x.index} className="ed-prob-g">
              <b style={{ color: PALETTE[x.index % PALETTE.length] }}>{x.name}</b>{!x.ok && <span className="ed-badge bad">won't load</span>}
              {x.errors.map((e, k) => <button key={k} className="ed-prob bad" onClick={() => goError(x.index, e)}>{e}</button>)}
              {x.warnings.slice(0, 8).map((e, k) => <button key={"w" + k} className="ed-prob" onClick={() => goError(x.index, e)}>{e}</button>)}
            </div>
          ))}
          {check.cross.length > 0 && (
            <div className="ed-prob-g">
              <b>Across storylines</b>
              {check.cross.map((c, k) => <button key={k} className="ed-prob" onClick={() => findScene(p, c.sid) && onScene(c.sid)}>{c.text}</button>)}
            </div>
          )}
        </div>
      )}

      {run && (
        <>
          <div className="ed-sec">
            <div className="ed-sec-h"><b>{run.counts.played || 0} of {run.scenes.length} scenes play</b>
              <small>On {run.who.name}{run.who.sample ? " (the sample story)" : ""}, from the first day, in {run.seconds}s.</small></div>
            {run.skipped.length > 0 && <div className="ed-problems">{run.skipped.map((s) => <div key={s.name}>{s.name} didn't load, so its scenes aren't in this: {s.errors[0]}</div>)}</div>}
            <div className="ed-cov">
              <span />{run.coverage.months.map((m) => <i key={m}>{m[0]}</i>)}
              {run.coverage.years.map((y) => (
                <React.Fragment key={y.key}>
                  <b>{y.label.replace("College ", "C. ")}</b>
                  {y.months.map((n, k) => <span key={k} className="c" style={{ opacity: n ? 0.25 + 0.75 * (n / max) : 1 }} data-n={n || ""} title={`${run.coverage.months[k]}: ${n}`} />)}
                </React.Fragment>
              ))}
            </div>
            {run.coverage.quiet.length > 0 && <p className="ed-dim small">Quiet stretches: {run.coverage.quiet.slice(0, 5).map((q) => `${q.from} to ${q.to}`).join(" · ")}</p>}
          </div>
          {missing.length > 0 && (
            <div className="ed-sec">
              <div className="ed-sec-h"><b>{missing.length} never happen</b><small>Grouped by why. Open one to fix it.</small></div>
              {Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length).map(([k, xs]) => (
                <div key={k} className="ed-prob-g">
                  <b>{REASONS[k] || xs[0].why || k.replace(/_/g, " ")} <span className="ed-dim">({xs.length})</span></b>
                  {xs.slice(0, 40).map((s) => (
                    <button key={s.sid} className="ed-prob" onClick={() => onScene(s.sid)}>
                      <span>{s.title}</span><small> · {s.pack}{s.detail ? ` · ${typeof s.detail === "string" ? s.detail : JSON.stringify(s.detail)}` : ""}</small>
                    </button>
                  ))}
                  {xs.length > 40 && <p className="ed-dim small">…and {xs.length - 40} more</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {!check && !run && <p className="ed-dim">Nothing checked yet. Check the files any time; play it through to see how the seven years come out.</p>}
    </div>
  );
}
