// Sports records you control. In the editor: anyone's seasons in a school year (stat line, games, starts, record,
// captain, awards, Players of the Week); what you set replaces what the simulation made. On the Ladder: how much each
// part of a sports year counts toward popularity, with a reset.
import React, { useEffect, useState } from "react";
import { phoneApi, SeasonRec, SportsRecord, SportsWeights } from "./api";
import { Fold } from "./CreateStory";
import { cx, errText } from "./kit";
import { usePhone } from "./PhoneContext";

export function SportsRecordFold({ cid, whose }: { cid: string; whose: string }) {
  const [rec, setRec] = useState<SportsRecord | null>(null);
  const [year, setYear] = useState<number | undefined>(undefined);
  useEffect(() => {
    phoneApi.sportsRecord(cid, year).then(setRec).catch(() => setRec(null));
  }, [cid, year]);
  if (!rec) return null;
  return (
    <Fold title="Sports record" sub={rec.seasons.length ? `${rec.label}: ${rec.seasons.map((s) => s.name.replace("Guilford ", "")).join(", ")}` : `${rec.label}: no seasons`}>
      <p className="ph-dim small sr-intro">{whose} seasons, awards and stats. What you set here replaces what the game simulated, and the Ladder,
        yearbook and Sports tab all use it.</p>
      {rec.years.length > 1 && (
        <div className="ed-chips">
          {rec.years.map((y) => <button key={y.year} className={cx(y.year === rec.year && "on")} onClick={() => setYear(y.year)}>{y.label}</button>)}
        </div>
      )}
      {rec.seasons.length === 0 && <p className="ph-dim small">Not on a team this year. Put them on one under Teams first.</p>}
      {rec.seasons.map((s) => <SeasonCard key={`${rec.year}:${s.team}`} cid={cid} year={rec.year} s={s} onSaved={setRec} />)}
    </Fold>
  );
}

function SeasonCard({ cid, year, s, onSaved }: { cid: string; year: number; s: SeasonRec; onSaved: (r: SportsRecord) => void }) {
  const { toast, refresh } = usePhone();
  const [d, setD] = useState<SeasonRec>(s);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setD(s), [s]);
  const changed = JSON.stringify(d) !== JSON.stringify(s);
  const n = (v: string) => (v === "" ? 0 : Math.max(0, Math.floor(Number(v) || 0)));
  const toggleAward = (a: string) => setD({ ...d, awards: d.awards.includes(a) ? d.awards.filter((x) => x !== a) : [...d.awards, a] });
  const save = async () => {
    setBusy(true);
    try {
      const r = await phoneApi.saveSportsRecord(cid, { year, team: s.team, games: d.games, starts: d.starts, wins: d.wins, losses: d.losses,
        line: d.line, captain: d.captain, awards: d.awards, potw: d.potw });
      onSaved(r);
      toast("Saved. The Ladder already knows.", "good");
      refresh();
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(false);
    }
  };
  const awards = Array.from(new Set([...s.options, ...d.awards]));
  return (
    <div className="sr-card">
      <div className="sr-h"><b>{s.name.replace("Guilford ", "")}</b><small>{s.level === "jv" ? "JV" : "Varsity"}{s.edited ? " · edited by you" : ""}</small></div>
      <div className="sr-grid four">
        {([["games", "Games"], ["starts", "Starts"], ["wins", "Wins"], ["losses", "Losses"]] as const).map(([k, l]) => (
          <label key={k}><span>{l}</span>
            <input className="ph-input" type="number" inputMode="numeric" min={0} value={d[k]} onChange={(e) => setD({ ...d, [k]: n(e.target.value) })} />
          </label>
        ))}
      </div>
      <div className="sr-sub">Season stats</div>
      <div className="sr-grid">
        {s.fields.map(([k, l]) => (
          <label key={k}><span>{l}</span>
            <input className="ph-input" type="number" inputMode="numeric" min={0} value={d.line[k] ?? 0}
              onChange={(e) => setD({ ...d, line: { ...d.line, [k]: n(e.target.value) } })} />
          </label>
        ))}
      </div>
      <label className="sr-toggle">
        <input type="checkbox" checked={d.captain} onChange={(e) => setD({ ...d, captain: e.target.checked })} /> Captain
      </label>
      <div className="sr-sub">Awards</div>
      <div className="ed-chips">
        {awards.map((a) => <button key={a} className={cx(d.awards.includes(a) && "on")} onClick={() => toggleAward(a)}>{a}</button>)}
      </div>
      <div className="sr-custom">
        <input className="ph-input" placeholder="Another award (like SCC Offensive Player of the Year)" value={custom} maxLength={60}
          onChange={(e) => setCustom(e.target.value)} />
        <button className="ph-btn soft" disabled={!custom.trim()} onClick={() => { setD({ ...d, awards: [...d.awards, custom.trim()] }); setCustom(""); }}>Add</button>
      </div>
      <div className="sr-potw">
        <span>Players of the Week</span>
        <button className="ph-btn soft" onClick={() => setD({ ...d, potw: Math.max(0, d.potw - 1) })} aria-label="One fewer">−</button>
        <b>{d.potw}</b>
        <button className="ph-btn soft" onClick={() => setD({ ...d, potw: d.potw + 1 })} aria-label="One more">+</button>
      </div>
      {changed && (
        <div className="sr-actions">
          <button className="ph-btn" disabled={busy} onClick={() => setD(s)}>Undo</button>
          <button className="ph-btn primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save season"}</button>
        </div>
      )}
    </div>
  );
}

/** How much each part of a sports year counts toward popularity. */
export function SportsWeightsEditor({ onDone }: { onDone?: () => void }) {
  const { toast, refresh } = usePhone();
  const [v, setV] = useState<SportsWeights | null>(null);
  const [d, setD] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    phoneApi.sportsWeights().then(setV).catch((e) => toast(errText(e), "bad"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return <div className="ph-dim"><span className="ph-spinner small" /> Loading…</div>;
  const run = async (body: { weights?: Record<string, number>; reset?: boolean }, msg: string) => {
    setBusy(true);
    try {
      setV(await phoneApi.setSportsWeights(body));
      setD({});
      toast(msg, "good");
      refresh();
      onDone?.();
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(false);
    }
  };
  const step = (kind: string) => (kind === "x" ? 0.05 : kind === "n" ? 1 : 10);
  return (
    <div className="sw">
      <p className="ph-dim small">What each part of a sports year is worth on the Ladder. Points are on the same scale as everything else
        (the middle of the school sits around 480); "x" values multiply. Changes re-rank everyone right away.</p>
      {v.rows.map((r) => {
        const cur = d[r.key] ?? r.value;
        return (
          <div key={r.key} className={cx("sw-row", cur !== r.default && "changed")}>
            <span><b>{r.label}</b><small>default {r.kind === "x" ? `${r.default}x` : r.default}</small></span>
            <button className="ph-btn soft" onClick={() => setD({ ...d, [r.key]: Math.max(r.min, +(cur - step(r.kind)).toFixed(2)) })}>−</button>
            <input className="ph-input" type="number" inputMode="decimal" step={step(r.kind)} min={r.min} max={r.max} value={cur}
              onChange={(e) => setD({ ...d, [r.key]: Number(e.target.value) })} />
            <button className="ph-btn soft" onClick={() => setD({ ...d, [r.key]: Math.min(r.max, +(cur + step(r.kind)).toFixed(2)) })}>+</button>
          </div>
        );
      })}
      <div className="sr-actions">
        <button className="ph-btn" disabled={busy || !v.changed} onClick={() => run({ reset: true }, "Back to the defaults")}>Reset to defaults</button>
        <button className="ph-btn primary" disabled={busy || !Object.keys(d).length} onClick={() => run({ weights: d }, "Saved. Everyone's re-ranked.")}>Save</button>
      </div>
    </div>
  );
}
