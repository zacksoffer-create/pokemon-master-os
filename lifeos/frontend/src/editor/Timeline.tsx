// The seven years at a glance: every scene in its year and month, as planned (its timing and the season plan) or as it
// actually played in the last check. Click one to open it.
import React, { useMemo, useState } from "react";
import { effectiveWhen, MONTH_SHORT, MONTHS, PALETTE, YEAR_LABEL, YEARS } from "./model";
import { useEd } from "./state";

type Chip = { sid: string; title: string; pack: number; imp?: string; state?: string };
const EXPAND: Record<string, string[]> = { high_school: YEARS.slice(0, 4), college: YEARS.slice(4) };

export default function Timeline({ onScene }: { onScene: (sid: string) => void }) {
  const { p, run, runStory, busy } = useEd();
  const [as, setAs] = useState<"plan" | "played">(run ? "played" : "plan");
  const [only, setOnly] = useState<number | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const packOf = useMemo(() => {
    const m = new Map<string, number>();
    p.packs.forEach((pk, i) => (pk.scenes || []).forEach((s) => m.set(s.id, i)));
    return m;
  }, [p]);

  const grid = useMemo(() => {
    // rows: "any" (no school year) + the seven years; columns: the twelve months + "any" (no month)
    const g: Record<string, Record<string, Chip[]>> = {};
    const put = (y: string, m: string, c: Chip) => {
      g[y] = g[y] || {};
      (g[y][m] = g[y][m] || []).push(c);
    };
    if (as === "played" && run) {
      run.scenes.forEach((r: any) => {
        const i = packOf.get(r.sid);
        if (i === undefined || (only !== "all" && i !== only)) return;
        if (r.state === "played" && r.yi !== undefined) put(YEARS[r.yi] || "after", String(r.month), { sid: r.sid, title: r.title, pack: i, imp: r.importance });
        else put("never", "x", { sid: r.sid, title: r.title, pack: i, state: r.state });
      });
    } else {
      p.packs.forEach((pk, i) => {
        if (only !== "all" && i !== only) return;
        (pk.scenes || []).forEach((s) => {
          const w = effectiveWhen(p, s);
          if (w.skip) return;
          const ys = (w.years || []).flatMap((y) => EXPAND[y] || [y]);
          const ms = (w.months || []).map(String);
          const c = { sid: s.id, title: s.title, pack: i, imp: w.importance };
          for (const y of ys.length ? [ys[0]] : ["any"]) {
            if (ms.length) put(y, ms[0], c);
            else put(y, "any", c);
          }
        });
      });
    }
    return g;
  }, [p, run, as, only, packOf]);

  const rows = as === "played" ? [...YEARS, "after"] : ["any", ...YEARS];
  const cols = as === "played" ? MONTHS.map(String) : [...MONTHS.map(String), "any"];
  const never = grid.never?.x || [];
  return (
    <div className="ed-timeline">
      <div className="ed-row wrap ed-tl-bar">
        <div className="ed-seg">
          <button className={as === "plan" ? "on" : ""} onClick={() => setAs("plan")}>As planned</button>
          <button className={as === "played" ? "on" : ""} onClick={() => (run ? setAs("played") : runStory().then(() => setAs("played")))} disabled={busy === "run"}>
            {busy === "run" ? "Playing…" : "As it played"}
          </button>
        </div>
        <select value={String(only)} onChange={(e) => setOnly(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">Every storyline</option>
          {p.packs.map((pk, i) => <option key={i} value={i}>{pk.name}</option>)}
        </select>
        <span className="ed-dim small">{as === "plan" ? "Where each scene's timing puts it (first year it can happen). Scenes with no month sit in “any”." : `Played on ${run?.who.name}, from the first day. ${run?.counts.played || 0} scenes played.`}</span>
      </div>
      <div className="ed-tl-scroll">
        <table className="ed-tl">
          <thead><tr><th />{cols.map((m) => <th key={m}>{m === "any" ? "any" : MONTH_SHORT[Number(m)]}</th>)}</tr></thead>
          <tbody>
            {rows.map((y) => (
              <tr key={y}>
                <th>{y === "any" ? "Any year" : y === "after" ? "After" : YEAR_LABEL[y].replace("College ", "C. ")}</th>
                {cols.map((m) => {
                  const cs = grid[y]?.[m] || [];
                  const key = `${y}:${m}`;
                  const show = open === key ? cs : cs.slice(0, 6);
                  return (
                    <td key={m} className={cs.length ? "" : "empty"}>
                      {show.map((c) => (
                        <button key={c.sid} className={`ed-tl-chip ${c.imp === "major" || c.imp === "finale" ? "big" : ""}`} title={`${c.title} · ${p.packs[c.pack].name}`} onClick={() => onScene(c.sid)}>
                          <i style={{ background: PALETTE[c.pack % PALETTE.length] }} />{c.title}
                        </button>
                      ))}
                      {cs.length > show.length && <button className="ed-link small" onClick={() => setOpen(key)}>+{cs.length - show.length} more</button>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {as === "played" && never.length > 0 && (
        <div className="ed-sec">
          <div className="ed-sec-h"><b>Never came up ({never.length})</b><small>Open one to see why. The Check panel groups them by reason.</small></div>
          <div className="ed-chips">{never.slice(0, 120).map((c) => <button key={c.sid} onClick={() => onScene(c.sid)}><i className="dot" style={{ background: PALETTE[c.pack % PALETTE.length] }} />{c.title}</button>)}</div>
        </div>
      )}
    </div>
  );
}
