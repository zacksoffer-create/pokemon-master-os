// One scene, all of it: who it's about, what happens, when it can happen (and what the season plan says on top), the
// choices and what each one does, and how it reads.
import React, { useMemo, useState } from "react";
import { LinesEdit, OpsEdit } from "./Ops";
import {
  allSceneIds, asList, Beat, Choice, displayText, effectiveWhen, factIndex, findScene, MONTH_SHORT, MONTHS, planFor, sampleNames,
  Scene, ScheduleEntry, slug, When, YEAR_LABEL, YEARS,
} from "./model";
import { statusOf } from "./Storyline";
import { clean, renameScene, updPack, updScene, useEd } from "./state";

function Chips({ all, on, label, onChange }: { all: string[]; on: string[]; label?: (s: string) => string; onChange: (v: string[]) => void }) {
  return (
    <div className="ed-chips">
      {all.map((x) => (
        <button key={x} className={on.includes(x) ? "on" : ""} onClick={() => onChange(on.includes(x) ? on.filter((y) => y !== x) : [...on, x])}>
          {label ? label(x) : x}
        </button>
      ))}
    </div>
  );
}

function TagInput({ values, onChange, options, placeholder, render }: {
  values: string[]; onChange: (v: string[]) => void; options: { value: string; label?: string }[]; placeholder: string; render?: (v: string) => string;
}) {
  const [t, setT] = useState("");
  const id = useMemo(() => "dl" + Math.random().toString(36).slice(2), []);
  const add = (v: string) => {
    const s = v.trim();
    if (s && !values.includes(s)) onChange([...values, s]);
    setT("");
  };
  return (
    <div className="ed-tags">
      {values.map((v) => <span key={v} className="ed-tag">{render ? render(v) : v}<button onClick={() => onChange(values.filter((x) => x !== v))}>×</button></span>)}
      <input list={id} value={t} placeholder={placeholder} onChange={(e) => {
        const v = e.target.value;
        if (options.some((o) => o.value === v)) add(v);
        else setT(v);
      }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(t); } }} onBlur={() => t && add(t)} />
      <datalist id={id}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</datalist>
    </div>
  );
}

const HANDLED = ["years", "months", "not_before", "not_after", "after", "gap_days", "importance", "chance", "remembered", "not_remembered", "requires"];

function WhenEdit({ when, onChange, sceneOptions, facts, schema, plan }: {
  when: When; onChange: (w: When) => void; sceneOptions: { value: string; label?: string }[]; facts: string[]; schema: any; plan?: boolean;
}) {
  const set = (k: string, v: any) => onChange(clean({ ...when, [k]: v }));
  const other = Object.fromEntries(Object.entries(when).filter(([k]) => !HANDLED.includes(k) && !(plan && (k === "skip" || k === "replace_after"))));
  const [raw, setRaw] = useState(Object.keys(other).length ? JSON.stringify(other) : "");
  const [rawBad, setRawBad] = useState<string | null>(null);
  const title = (sid: string) => sceneOptions.find((o) => o.value === sid)?.label || sid;
  return (
    <div className="ed-when">
      <div className="ed-f"><span>School years</span>
        <Chips all={YEARS} on={when.years || []} label={(y) => YEAR_LABEL[y].replace("College ", "C. ")} onChange={(v) => set("years", YEARS.filter((y) => v.includes(y)))} /></div>
      <div className="ed-f"><span>Months</span>
        <Chips all={MONTHS.map(String)} on={(when.months || []).map(String)} label={(m) => MONTH_SHORT[Number(m)]}
          onChange={(v) => set("months", MONTHS.filter((m) => v.includes(String(m))))} /></div>
      <div className="ed-f row"><span>Not before</span><input placeholder="MM-DD" value={when.not_before || ""} onChange={(e) => set("not_before", e.target.value || undefined)} />
        <span>Not after</span><input placeholder="MM-DD" value={when.not_after || ""} onChange={(e) => set("not_after", e.target.value || undefined)} /></div>
      <div className="ed-f"><span>Comes after</span>
        <TagInput values={when.after || []} onChange={(v) => set("after", v)} options={sceneOptions} placeholder="a scene (type to search)" render={title} /></div>
      <div className="ed-f row"><span>Days after that</span><input className="ed-num" type="number" min={0} value={when.gap_days ?? ""} onChange={(e) => set("gap_days", e.target.value === "" ? undefined : Number(e.target.value))} />
        <span>How big</span>
        <select value={when.importance || ""} onChange={(e) => set("importance", e.target.value || undefined)}>
          <option value="">from its title</option>
          {(schema?.importance || ["ambient", "regular", "major", "finale"]).map((x: string) => <option key={x} value={x}>{x}</option>)}
        </select>
        {!plan && <><span>Odds a day</span><input className="ed-num" type="number" step={0.01} min={0} max={1} value={when.chance ?? ""} placeholder="auto" onChange={(e) => set("chance", e.target.value === "" ? undefined : Number(e.target.value))} /></>}
      </div>
      {!plan && <>
        <div className="ed-f"><span>Only if remembered</span>
          <TagInput values={when.remembered || []} onChange={(v) => set("remembered", v)} options={facts.map((f) => ({ value: f }))} placeholder="a fact a choice remembers" /></div>
        <div className="ed-f"><span>Not if remembered</span>
          <TagInput values={when.not_remembered || []} onChange={(v) => set("not_remembered", v)} options={facts.map((f) => ({ value: f }))} placeholder="a fact" /></div>
        <div className="ed-f"><span>Only when</span>
          <Chips all={Object.keys(schema?.requires || {})} on={when.requires || []} label={(r) => r.replace(/_/g, " ")} onChange={(v) => set("requires", v)} /></div>
        <div className="ed-f"><span>Other conditions</span>
          <input className={rawBad ? "bad" : ""} value={raw} placeholder='JSON, like {"you_feel": {"affection": [40, 100]}}' onChange={(e) => {
            setRaw(e.target.value);
            try {
              const j = e.target.value.trim() ? JSON.parse(e.target.value) : {};
              setRawBad(null);
              const base = Object.fromEntries(Object.entries(when).filter(([k]) => HANDLED.includes(k)));
              onChange(clean({ ...base, ...j }));
            } catch (err: any) {
              setRawBad(err.message);
            }
          }} /></div>
      </>}
    </div>
  );
}

function ChoiceEdit({ c, onChange, onRemove, depth, ctx }: { c: Choice; onChange: (c: Choice) => void; onRemove: () => void; depth: number; ctx: any }) {
  const set = (k: string, v: any) => onChange(clean({ ...c, [k]: v }) as Choice);
  return (
    <div className="ed-choice">
      <div className="ed-row">
        <input className="ed-choice-l" value={c.label} placeholder="What you do or say" onChange={(e) => set("label", e.target.value)} />
        <button className="ed-x" onClick={onRemove} title="Remove this choice">×</button>
      </div>
      <input className="ed-chint" value={c.hint || ""} placeholder="small print under it (optional)" onChange={(e) => set("hint", e.target.value || undefined)} />
      <OpsEdit ops={c.ops} onChange={(o) => set("ops", o)} schema={ctx.schema} refs={ctx.refs} facts={ctx.facts} />
      {c.then ? (
        <div className="ed-then">
          <div className="ed-then-h"><b>And it keeps going</b><button className="ed-link small danger" onClick={() => set("then", undefined)}>end the scene here instead</button></div>
          <BeatEdit beat={c.then} onChange={(b) => set("then", b)} depth={depth + 1} ctx={ctx} />
        </div>
      ) : depth + 1 < (ctx.schema?.max_beats || 3) && (
        <button className="ed-link small" onClick={() => set("then", { text: [""], choices: [{ label: "", ops: [] }, { label: "", ops: [] }] })}>+ the scene keeps going after this</button>
      )}
    </div>
  );
}

function ChoicesEdit({ choices, onChange, depth, ctx }: { choices: Choice[]; onChange: (c: Choice[]) => void; depth: number; ctx: any }) {
  return (
    <div className="ed-choices">
      {choices.map((c, k) => (
        <ChoiceEdit key={k} c={c} depth={depth} ctx={ctx} onChange={(x) => onChange(choices.map((y, j) => (j === k ? x : y)))}
          onRemove={() => onChange(choices.filter((_, j) => j !== k))} />
      ))}
      {choices.length < 4 && <button className="ed-btn block" onClick={() => onChange([...choices, { label: "", ops: [] }])}>+ Add a choice</button>}
      {(choices.length < 2 || choices.length > 4) && <div className="ed-err small">A scene needs 2 to 4 choices.</div>}
    </div>
  );
}

function BeatEdit({ beat, onChange, depth, ctx }: { beat: Beat; onChange: (b: Beat) => void; depth: number; ctx: any }) {
  return (
    <>
      <LinesEdit value={beat.text} onChange={(v) => onChange({ ...beat, text: v })} rows={3} placeholder="What happens next" />
      <ChoicesEdit choices={beat.choices || []} onChange={(c) => onChange({ ...beat, choices: c })} depth={depth} ctx={ctx} />
    </>
  );
}

function Preview({ sc, names }: { sc: Scene; names: Record<string, string> }) {
  const [path, setPath] = useState<number[]>([]);
  let beat: { text: any; choices: Choice[] } = { text: sc.text, choices: sc.choices };
  let said: string[] = [];
  for (const k of path) {
    const c = beat.choices[k];
    if (!c) break;
    said = (c.ops || []).filter((o) => o[0] === "say").map((o) => displayText(o[1], names));
    if (c.then) beat = { text: c.then.text, choices: c.then.choices || [] };
    else beat = { text: null, choices: [] };
  }
  return (
    <div className="ed-preview">
      <div className="ed-k">How it reads</div>
      <h3>{displayText(sc.title, names)}</h3>
      {said.map((t, k) => <p key={k} className="ed-said">{t}</p>)}
      {beat.text && <p>{displayText(beat.text, names)}</p>}
      {beat.choices.map((c, k) => <button key={k} className="ed-pchoice" onClick={() => setPath([...path, k])}>{c.label || "…"}</button>)}
      {path.length > 0 && <button className="ed-link small" onClick={() => setPath([])}>Start over</button>}
      {!beat.text && !beat.choices.length && <p className="ed-dim small">That's the end of the scene.</p>}
    </div>
  );
}

export default function SceneEditor({ pack, sid, onScene, onBack }: { pack: number; sid: string; onScene: (sid: string) => void; onBack: () => void }) {
  const { p, edit, schema, check, run, toast } = useEd();
  const pk = p.packs[pack];
  const idx = (pk?.scenes || []).findIndex((s) => s.id === sid);
  const sc = idx >= 0 ? pk!.scenes![idx] : null;
  const [idDraft, setIdDraft] = useState<string | null>(null);
  const facts = useMemo(() => Array.from(factIndex(p).keys()).sort(), [p]);
  const sceneOptions = useMemo(() => p.packs.flatMap((x) => (x.scenes || []).map((s) => ({ value: s.id, label: `${s.title} · ${x.name}` }))), [p]);
  if (!pk || !sc) return <div className="ed-pane-b"><p className="ed-dim">Pick a scene.</p></div>;
  const set = (fn: (s: Scene) => Scene, key?: string) => edit((q) => updScene(q, pack, sid, fn), key ? `${sid}:${key}` : undefined);
  const setK = (k: string, v: any, key?: string) => set((s) => clean({ ...s, [k]: v }) as Scene, key || k);
  const castSlots = Object.keys(pk.cast || {});
  const refs = [...(sc.who ? ["them"] : []), ...(schema?.refs || ["best_friend", "sibling", "partner"]).filter((r: string) => r !== "them")];
  const ctx = { schema, refs, facts };
  const names = sampleNames(p.spec);
  const errs = (check?.packs.find((x) => x.index === pack)?.errors || []).filter((e) => e.startsWith(`scenes[${idx}]`))
    .map((e) => e.replace(/^scenes\[\d+\] \([^)]*\)\.?/, ""));
  const cross = (check?.cross || []).filter((x) => x.sid === sid);
  const r = statusOf(run, sid);
  const plan = planFor(p, sid);
  const planPacks = p.packs.map((x, k) => ({ k, x })).filter(({ x }) => x.schedule && Object.keys(x.schedule).length);
  const eff = effectiveWhen(p, sc);
  const taken = allSceneIds(p);

  const commitId = () => {
    if (idDraft === null) return;
    const to = slug(idDraft);
    setIdDraft(null);
    if (!to || to === sid) return;
    if (taken.has(to)) return toast(`“${to}” is already a scene in your story.`, true);
    edit((q) => renameScene(q, sid, to));
    onScene(to);
  };
  const setPlan = (e: ScheduleEntry | null) => {
    const k = plan ? plan.pack : planPacks[0]?.k;
    if (k === undefined) return;
    edit((q) => updPack(q, k, (x) => {
      const s = { ...(x.schedule || {}) };
      if (e === null) delete s[sid];
      else s[sid] = clean(e);
      return { ...x, schedule: s };
    }), `${sid}:plan`);
  };

  return (
    <div className="ed-pane-b ed-scene">
      <div className="ed-crumb"><button className="ed-link" onClick={onBack}>‹ {pk.name}</button><span className="ed-dim"> · chapter {idx + 1} of {pk.scenes!.length}</span></div>
      <input className="ed-title-in" value={sc.title} placeholder="Scene title" onChange={(e) => {
        const t = e.target.value;
        setK("title", t, "title");
      }} />
      <div className="ed-row wrap ed-meta">
        <label className="ed-f inline"><span>Id</span>
          <input value={idDraft ?? sid} onChange={(e) => setIdDraft(e.target.value)} onBlur={commitId} onKeyDown={(e) => e.key === "Enter" && commitId()} />
        </label>
        <label className="ed-f inline"><span>About</span>
          <select value={sc.who || ""} onChange={(e) => setK("who", e.target.value || undefined)}>
            <option value="">nobody in particular</option>
            {castSlots.length > 0 && <optgroup label="This storyline's people">{castSlots.map((c) => <option key={c} value={`cast:${c}`}>{c.replace(/_/g, " ")} ({pk.cast![c].who.replace(/_/g, " ")})</option>)}</optgroup>}
            <optgroup label="A kind of person">{Object.keys(schema?.who || {}).map((w) => <option key={w} value={w}>{w.replace(/_/g, " ")}</option>)}</optgroup>
            {sc.who && !sc.who.startsWith("cast:") && !schema?.who?.[sc.who] && <option value={sc.who}>{sc.who}</option>}
            {sc.who?.startsWith("cast:") && !castSlots.includes(sc.who.slice(5)) && <option value={sc.who}>{sc.who} (not in this storyline)</option>}
          </select>
        </label>
      </div>

      {(errs.length > 0 || cross.length > 0) && (
        <div className="ed-problems">
          {errs.map((e, k) => <div key={k}>{e}</div>)}
          {cross.map((c, k) => <div key={"c" + k}>{c.text}</div>)}
        </div>
      )}
      {r && (
        <div className={`ed-status ${r.state === "played" ? "ok" : "bad"}`}>
          {r.state === "played" ? <>Plays <b>{r.date}</b> in the check.</> : <>
            <b>{r.state === "unreachable" ? "Won't happen" : r.state === "expired" ? "Missed" : "Didn't come up"}</b> in the check: {r.why || r.reason}{r.detail ? ` (${typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail)})` : ""}.
          </>}
        </div>
      )}

      <div className="ed-cols">
        <div className="ed-col-main">
          <div className="ed-sec">
            <div className="ed-sec-h"><b>What happens</b><small>Second person. Write a few versions and the game rotates them. Names: {"{them_first} {me_first} {best_friend_first} {sibling_first} {partner_first} {school} {sport}"}</small></div>
            <LinesEdit value={sc.text} onChange={(v) => setK("text", v, "text")} rows={4} placeholder="{them_first} catches you at your locker…" />
          </div>
          {sc.who && (
            <div className="ed-sec">
              <div className="ed-sec-h"><b>As a text</b><small>Optional: what they'd text you instead. Then it can happen by phone too.</small></div>
              <LinesEdit value={sc.by_text} onChange={(v) => setK("by_text", asList(v).some((x) => x.trim()) ? v : undefined, "by_text")} rows={1} placeholder="u around later?" />
            </div>
          )}

          <div className="ed-sec">
            <div className="ed-sec-h"><b>Choices</b><small>2 to 4. What each one does happens right after it.</small></div>
            <ChoicesEdit choices={sc.choices || []} onChange={(c) => setK("choices", c, "choices")} depth={0} ctx={ctx} />
          </div>

          <div className="ed-sec">
            <div className="ed-sec-h"><b>When it can happen</b><small>Leave it open and the season map places it (tryouts in their season, Homecoming in the fall).</small></div>
            <WhenEdit key={sid} when={sc.when || {}} onChange={(w) => setK("when", w, "when")} sceneOptions={sceneOptions.filter((o) => o.value !== sid)} facts={facts} schema={schema} />
          </div>

          {(plan || planPacks.length > 0) && (
            <div className="ed-sec ed-planbox">
              <div className="ed-sec-h"><b>Season plan</b>
                <small>{plan ? `${p.packs[plan.pack].name} places this scene. Its word goes on top of the scene's own.` : "Your season plan doesn't place this scene yet."}</small></div>
              {plan ? (
                <>
                  <WhenEdit key={sid + ":plan"} when={plan.entry} plan onChange={(w) => setPlan({ ...w, ...(plan.entry.skip ? { skip: true } : {}), ...(plan.entry.replace_after ? { replace_after: true } : {}) })}
                    sceneOptions={sceneOptions.filter((o) => o.value !== sid)} facts={facts} schema={schema} />
                  <label className="ed-check"><input type="checkbox" checked={!!plan.entry.replace_after} onChange={(e) => setPlan({ ...plan.entry, replace_after: e.target.checked || undefined })} /> Its “comes after” replaces the scene's own (instead of adding to it)</label>
                  <label className="ed-check"><input type="checkbox" checked={!!plan.entry.skip} onChange={(e) => setPlan({ ...plan.entry, skip: e.target.checked || undefined })} /> Retire this scene (it never plays)</label>
                  <div className="ed-dim small">All together: {Object.keys(eff).length ? JSON.stringify(clean(eff)) : "any time"}</div>
                  <button className="ed-link small danger" onClick={() => setPlan(null)}>Take it out of the plan</button>
                </>
              ) : <button className="ed-btn" onClick={() => setPlan({ years: sc.when?.years || [] })}>Add it to {planPacks[0].x.name}</button>}
            </div>
          )}

          <div className="ed-sec">
            <div className="ed-sec-h"><b>Notes</b><small>Just for you. The game ignores them.</small></div>
            <textarea rows={2} value={sc.notes || ""} onChange={(e) => setK("notes", e.target.value || undefined, "notes")} />
          </div>
        </div>
        <div className="ed-col-side">
          <Preview key={sid} sc={sc} names={names} />
          <WhereFrom sid={sid} onScene={onScene} />
        </div>
      </div>
    </div>
  );
}

/** What this scene waits on and what waits on it: the links, both ways. */
function WhereFrom({ sid, onScene }: { sid: string; onScene: (s: string) => void }) {
  const { p } = useEd();
  const f = findScene(p, sid);
  if (!f) return null;
  const eff = effectiveWhen(p, f.scene);
  const facts = factIndex(p);
  const needs = [...(eff.after || [])];
  const unlocks: string[] = [];
  const mine = new Set<string>();
  const walk = (x: any) => {
    if (Array.isArray(x)) {
      if (x[0] === "remember" && typeof x[1] === "string") mine.add(x[1]);
      x.forEach(walk);
    } else if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  walk(f.scene.choices);
  p.packs.forEach((pk) => (pk.scenes || []).forEach((s) => {
    const w = effectiveWhen(p, s);
    if ((w.after || []).includes(sid) || (w.remembered || []).some((x) => mine.has(x))) unlocks.push(s.id);
  }));
  const fromFacts = (eff.remembered || []).flatMap((x) => facts.get(x) || []);
  const title = (s: string) => findScene(p, s)?.scene.title || s;
  if (!needs.length && !unlocks.length && !fromFacts.length) return null;
  return (
    <div className="ed-links">
      {(needs.length > 0 || fromFacts.length > 0) && <div className="ed-k">Comes after</div>}
      {[...needs, ...fromFacts.filter((x) => !needs.includes(x))].map((s) => <button key={s} className="ed-link small" onClick={() => findScene(p, s) && onScene(s)}>{title(s)}</button>)}
      {unlocks.length > 0 && <div className="ed-k">Leads to</div>}
      {unlocks.map((s) => <button key={s} className="ed-link small" onClick={() => onScene(s)}>{title(s)}</button>)}
    </div>
  );
}
