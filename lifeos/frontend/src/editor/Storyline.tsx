// One storyline: its name, whether it plays in order, who it's about (cast slots), and its chapters in order.
import React, { useState } from "react";
import { allSceneIds, CastSlot, effectiveWhen, findScene, newScene, Pack, PALETTE, slug, timingText } from "./model";
import { clean, updPack, useEd } from "./state";

export function statusOf(run: any, sid: string) {
  return run?.scenes.find((s: any) => s.sid === sid) || null;
}

export function Badge({ r }: { r: any }) {
  if (!r) return null;
  if (r.state === "played") return <span className="ed-badge ok" title={`Plays ${r.date}`}>{(r.date || "").replace(/^\w+, /, "").replace(/, \d\d(\d\d)$/, " ’$1")}</span>;
  return <span className={`ed-badge ${r.state === "unreachable" || r.state === "expired" ? "bad" : "warn"}`} title={r.why || r.reason}>{r.state === "unreachable" ? "won't happen" : r.state === "expired" ? "missed" : r.state}</span>;
}

export default function Storyline({ i, onScene, onBack }: { i: number; onScene: (sid: string) => void; onBack: () => void }) {
  const { p, edit, schema, sel, run, check, toast } = useEd();
  const pk: Pack | undefined = p.packs[i];
  const [moveTo, setMoveTo] = useState<string | null>(null);
  if (!pk) return null;
  const scenes = pk.scenes || [];
  const set = (fn: (pk: Pack) => Pack, key?: string) => edit((q) => updPack(q, i, fn), key);
  const move = (from: number, to: number) => set((x) => {
    const s = [...(x.scenes || [])];
    const [it] = s.splice(from, 1);
    s.splice(to, 0, it);
    return { ...x, scenes: s };
  });
  const add = (at: number) => {
    const sc = newScene(allSceneIds(p), "A new scene");
    if (pk.cast && Object.keys(pk.cast).length === 1) sc.who = `cast:${Object.keys(pk.cast)[0]}`;
    set((x) => {
      const s = [...(x.scenes || [])];
      s.splice(at, 0, sc);
      return { ...x, scenes: s };
    });
    onScene(sc.id);
  };
  const problems = (check?.packs.find((x) => x.index === i)?.errors.length || 0) + (check?.cross.filter((x) => x.pack === i).length || 0);
  const plan = Object.entries(pk.schedule || {});
  const others = Object.keys(pk).filter((k) => !["dialogue_pack", "name", "author", "in_order", "cast", "scenes", "schedule", "notes"].includes(k));

  return (
    <div className="ed-pane-b">
      <div className="ed-crumb"><button className="ed-link" onClick={onBack}>‹ Story</button></div>
      <div className="ed-line-h" style={{ borderColor: PALETTE[i % PALETTE.length] }}>
        <input className="ed-title-in" value={pk.name} onChange={(e) => set((x) => ({ ...x, name: e.target.value }), `pack-name-${i}`)} aria-label="Storyline name" />
        <div className="ed-row wrap">
          <label className="ed-check"><input type="checkbox" checked={pk.in_order !== false} onChange={(e) => set((x) => ({ ...x, in_order: e.target.checked }))} /> Chapters play in order</label>
          {problems > 0 && <span className="ed-badge bad">{problems} to fix</span>}
        </div>
      </div>

      <div className="ed-sec">
        <div className="ed-sec-h"><b>Who it's about</b><small>A cast slot is one specific person, the same in every chapter (and every storyline that uses the same slot name).</small></div>
        {Object.entries(pk.cast || {}).map(([name, c]) => (
          <CastRow key={name} name={name} c={c} schema={schema}
            onChange={(nn, nc) => set((x) => {
              const cast = { ...(x.cast || {}) };
              delete cast[name];
              cast[nn] = nc;
              const scenesFix = nn !== name ? (x.scenes || []).map((s) => (s.who === `cast:${name}` ? { ...s, who: `cast:${nn}` } : s)) : x.scenes;
              return { ...x, cast, scenes: scenesFix };
            }, `cast-${i}-${name}`)}
            onRemove={() => set((x) => {
              const cast = { ...(x.cast || {}) };
              delete cast[name];
              return clean({ ...x, cast }) as Pack;
            })} />
        ))}
        <button className="ed-link" onClick={() => set((x) => ({ ...x, cast: { ...(x.cast || {}), [`person_${Object.keys(x.cast || {}).length + 1}`]: { who: "older_brother", bind: "first_scene" } } }))}>+ A specific person</button>
      </div>

      <div className="ed-sec">
        <div className="ed-sec-h"><b>Chapters</b><small>{pk.in_order === false ? "Any order: each comes when its timing fits." : "In this order: each waits for the one before it."}</small></div>
        <div className="ed-chapters">
          {scenes.map((s, j) => {
            const r = statusOf(run, s.id);
            const errs = check?.packs.find((x) => x.index === i)?.errors.filter((e) => e.startsWith(`scenes[${j}]`)).length || 0;
            return (
              <div key={s.id} className={`ed-ch${sel.sid === s.id ? " on" : ""}`}>
                <button className="ed-ch-main" onClick={() => onScene(s.id)}>
                  <span className="ed-ch-n">{j + 1}</span>
                  <span className="ed-ch-t">
                    <b>{s.title || "Untitled"}</b>
                    <small>{s.who ? `${s.who.replace("cast:", "")} · ` : ""}{timingText(effectiveWhen(p, s))}{s.when?.importance ? ` · ${s.when.importance}` : ""}</small>
                  </span>
                  {errs > 0 && <span className="ed-badge bad">{errs}</span>}
                  <Badge r={r} />
                </button>
                <div className="ed-ch-tools">
                  <button title="Move up" disabled={j === 0} onClick={() => move(j, j - 1)}>▲</button>
                  <button title="Move down" disabled={j === scenes.length - 1} onClick={() => move(j, j + 1)}>▼</button>
                  <button title="More" onClick={() => setMoveTo(moveTo === s.id ? null : s.id)}>⋯</button>
                </div>
                {moveTo === s.id && (
                  <div className="ed-ch-menu">
                    <button onClick={() => { add(j + 1); setMoveTo(null); }}>Add a scene after this</button>
                    <button onClick={() => {
                      const copy = { ...JSON.parse(JSON.stringify(s)), id: newScene(allSceneIds(p), `${s.id}_copy`).id, title: `${s.title} (copy)` };
                      set((x) => {
                        const ss = [...(x.scenes || [])];
                        ss.splice(j + 1, 0, copy);
                        return { ...x, scenes: ss };
                      });
                      setMoveTo(null);
                    }}>Duplicate</button>
                    {p.packs.length > 1 && (
                      <select defaultValue="" onChange={(e) => {
                        const to = Number(e.target.value);
                        edit((q) => {
                          const a = updPack(q, i, (x) => ({ ...x, scenes: (x.scenes || []).filter((y) => y.id !== s.id) }));
                          return updPack(a, to, (x) => ({ ...x, scenes: [...(x.scenes || []), s] }));
                        });
                        setMoveTo(null);
                        toast(`Moved to ${p.packs[to].name}.`);
                      }}>
                        <option value="" disabled>Move to another storyline…</option>
                        {p.packs.map((o, k) => k !== i && <option key={k} value={k}>{o.name}</option>)}
                      </select>
                    )}
                    <button className="danger" onClick={() => {
                      if (!window.confirm(`Delete “${s.title}”?`)) return;
                      set((x) => ({ ...x, scenes: (x.scenes || []).filter((y) => y.id !== s.id) }));
                      setMoveTo(null);
                    }}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="ed-btn block" onClick={() => add(scenes.length)}>+ Add a scene</button>
      </div>

      {plan.length > 0 && (
        <div className="ed-sec">
          <div className="ed-sec-h"><b>Season plan</b><small>This storyline places {plan.length} scenes across the seven years (from any storyline). Open a scene to change where it sits.</small></div>
          <div className="ed-plan">
            {plan.slice(0, 400).map(([sid, e]) => {
              const f = findScene(p, sid);
              return (
                <button key={sid} className={`ed-plan-r${f ? "" : " missing"}`} onClick={() => f && onScene(sid)} disabled={!f}>
                  <span>{f ? f.scene.title : sid}</span>
                  <small>{f ? timingText(e) : "not in your story"}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {others.length > 0 && <p className="ed-dim small">Also in this file (kept as is): {others.join(", ")}.</p>}
      <button className="ed-link danger" onClick={() => {
        if (!window.confirm(`Remove the storyline “${pk.name}” and its ${scenes.length} scenes from this story?`)) return;
        edit((q) => ({ ...q, packs: q.packs.filter((_, k) => k !== i) }));
        onBack();
      }}>Remove this storyline</button>
    </div>
  );
}

function CastRow({ name, c, schema, onChange, onRemove }: {
  name: string; c: CastSlot; schema: any; onChange: (name: string, c: CastSlot) => void; onRemove: () => void;
}) {
  const upd = (k: string, v: any) => onChange(name, clean({ ...c, [k]: v }) as CastSlot);
  return (
    <div className="ed-cast">
      <label><span>Slot name</span><input value={name} onChange={(e) => onChange(slug(e.target.value) || name, c)} /></label>
      <label><span>Who</span>
        <select value={c.who} onChange={(e) => upd("who", e.target.value)}>
          {(schema?.cast_who || [c.who]).map((w: string) => <option key={w} value={w}>{w.replace(/_/g, " ")}</option>)}
        </select>
      </label>
      <label><span>Plays</span>
        <select value={c.sport || ""} onChange={(e) => upd("sport", e.target.value || undefined)}>
          <option value="">any sport / none</option>
          {(schema?.sports || []).map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label><span>Grades ahead</span><input type="number" value={c.grade_offset ?? ""} onChange={(e) => upd("grade_offset", e.target.value === "" ? undefined : Number(e.target.value))} /></label>
      <label><span>Picked</span>
        <select value={c.bind || "first_scene"} onChange={(e) => upd("bind", e.target.value)}>
          <option value="first_scene">at their first scene</option>
          <option value="start">at the start</option>
        </select>
      </label>
      <label className="wide"><span>Described as</span><input value={c.label || ""} placeholder="Your older brother, the basketball star" onChange={(e) => upd("label", e.target.value || undefined)} /></label>
      <button className="ed-link danger" onClick={onRemove}>Remove</button>
    </div>
  );
}
