// What a choice does: the game's ops as forms (a line of dialogue, how someone feels, a fact to remember...), and as
// raw JSON for the ones with branches inside (mini games, chance).
import React, { useState } from "react";
import { asList, fromList, Lines, Op, Schema } from "./model";

/** One line or several versions of it (the game rotates through them so nothing repeats word for word). */
export function LinesEdit({ value, onChange, placeholder, rows = 2, max }: {
  value: Lines | undefined; onChange: (v: Lines) => void; placeholder?: string; rows?: number; max?: number;
}) {
  const xs = asList(value).length ? asList(value) : [""];
  const set = (k: number, t: string) => onChange(fromList(xs.map((x, j) => (j === k ? t : x))));
  return (
    <div className="ed-lines-ed">
      {xs.map((x, k) => (
        <div key={k} className="ed-version">
          {xs.length > 1 && <span className="ed-vn">{k + 1}</span>}
          <textarea rows={rows} value={x} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} maxLength={max} />
          {xs.length > 1 && <button className="ed-x" title="Remove this version" onClick={() => onChange(fromList(xs.filter((_, j) => j !== k)))}>×</button>}
        </div>
      ))}
      <button className="ed-link small" onClick={() => onChange([...xs, ""])}>+ another version</button>
    </div>
  );
}

const DEFAULTS: Record<string, Op> = {
  say: ["say", [""]], text: ["text", "them", [""]], rel: ["rel", "them", "affection", 3], rel_back: ["rel_back", "them", "affection", 3],
  mood: ["mood", 3], need: ["need", "stress", -4], trait: ["trait", "confidence", 1], skill: ["skill", "sport", 1], interest: ["interest", "sport", 3],
  rep: ["rep", "tough", 2], memory: ["memory", "", 0.4, 40, ["them"]], family: ["family", "affection", 3], focus: ["focus", "social"],
  hang_out: ["hang_out", "them"], remember: ["remember", ""], forget: ["forget", ""],
  vibe: ["vibe", "chill", { good: [""], meh: [""], bad: [""] }],
  minigame: ["minigame", "basketball", { great: [["say", ""]], good: [["say", ""]], miss: [["say", ""]] }, { base: 0.5, athletic: 0.3 }],
  chance: ["chance", { base: 0.5, charisma: 0.3 }, [["say", "It works."]], [["say", "It doesn't."]]],
};
const LABEL: Record<string, string> = {
  say: "Someone says / what happens", text: "They text you later", rel: "How you feel about them", rel_back: "How they feel about you",
  mood: "Your mood", need: "A need (energy, stress...)", trait: "A personality trait", skill: "A skill", interest: "An interest", rep: "Your reputation",
  memory: "A memory", family: "You and your siblings", focus: "What you focus on next", hang_out: "Make plans with them",
  remember: "Remember a fact", forget: "Forget a fact", vibe: "A style that lands or misses", minigame: "Play a mini game", chance: "A roll of the dice",
};

function Num({ v, onChange, min, max, step = 1 }: { v: any; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return <input className="ed-num" type="number" value={v ?? 0} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />;
}
function Sel({ v, opts, onChange }: { v: string; opts: string[]; onChange: (s: string) => void }) {
  const list = opts.includes(v) ? opts : [v, ...opts];
  return <select value={v} onChange={(e) => onChange(e.target.value)}>{list.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}</select>;
}

function JsonEdit({ op, onChange }: { op: Op; onChange: (o: Op) => void }) {
  const [t, setT] = useState(JSON.stringify(op, null, 1));
  const [bad, setBad] = useState<string | null>(null);
  return (
    <div>
      <textarea className="ed-json" rows={Math.min(14, t.split("\n").length + 1)} value={t} spellCheck={false}
        onChange={(e) => {
          setT(e.target.value);
          try {
            const j = JSON.parse(e.target.value);
            if (!Array.isArray(j) || typeof j[0] !== "string") throw new Error("an op is a list that starts with its name");
            setBad(null);
            onChange(j);
          } catch (err: any) {
            setBad(err.message);
          }
        }} />
      {bad && <div className="ed-err small">{bad}</div>}
    </div>
  );
}

export function OpRow({ op, onChange, onRemove, onUp, onDown, schema, refs, facts }: {
  op: Op; onChange: (o: Op) => void; onRemove: () => void; onUp?: () => void; onDown?: () => void; schema: Schema | null; refs: string[]; facts: string[];
}) {
  const kind = op[0];
  const set = (k: number, v: any) => onChange(op.map((x, j) => (j === k ? v : x)));
  const S = schema;
  const fields = S?.rel_fields ? Object.keys(S.rel_fields) : ["affection", "trust", "respect", "attraction", "rivalry", "familiarity"];
  let body: React.ReactNode;
  switch (kind) {
    case "say": body = <LinesEdit value={op[1]} onChange={(v) => set(1, v)} placeholder={'{them_first} grins. "Owe you one."'} />; break;
    case "text": body = <><div className="ed-row"><span>From</span><Sel v={op[1]} opts={refs} onChange={(v) => set(1, v)} /></div>
      <LinesEdit value={op[2]} onChange={(v) => set(2, v)} placeholder="thanks for today fr" rows={1} /></>; break;
    case "rel": case "rel_back": body = <div className="ed-row wrap"><Sel v={op[1]} opts={refs} onChange={(v) => set(1, v)} />
      <Sel v={op[2]} opts={fields} onChange={(v) => set(2, v)} /><Num v={op[3]} min={-30} max={30} onChange={(v) => set(3, v)} /></div>; break;
    case "mood": body = <div className="ed-row"><Num v={op[1]} min={-20} max={20} onChange={(v) => set(1, v)} /></div>; break;
    case "need": body = <div className="ed-row"><Sel v={op[1]} opts={S?.needs || ["energy", "social", "fun", "stress"]} onChange={(v) => set(1, v)} /><Num v={op[2]} min={-30} max={30} onChange={(v) => set(2, v)} /></div>; break;
    case "trait": body = <div className="ed-row"><Sel v={op[1]} opts={S?.traits || []} onChange={(v) => set(1, v)} /><Num v={op[2]} min={-10} max={10} onChange={(v) => set(2, v)} /></div>; break;
    case "skill": body = <div className="ed-row"><Sel v={op[1]} opts={["sport", ...(S?.skills || [])]} onChange={(v) => set(1, v)} /><Num v={op[2]} min={-10} max={10} onChange={(v) => set(2, v)} /></div>; break;
    case "interest": body = <div className="ed-row"><input value={op[1]} onChange={(e) => set(1, e.target.value)} placeholder="guitar, or sport" /><Num v={op[2]} min={-30} max={30} onChange={(v) => set(2, v)} /></div>; break;
    case "rep": body = <div className="ed-row"><Sel v={op[1]} opts={S?.rep || []} onChange={(v) => set(1, v)} /><Num v={op[2]} min={-20} max={20} onChange={(v) => set(2, v)} /></div>; break;
    case "family": body = <div className="ed-row"><Sel v={op[1]} opts={fields} onChange={(v) => set(1, v)} /><Num v={op[2]} min={-30} max={30} onChange={(v) => set(2, v)} /></div>; break;
    case "focus": body = <div className="ed-row"><Sel v={op[1]} opts={S?.focus || []} onChange={(v) => set(1, v)} /></div>; break;
    case "hang_out": body = <div className="ed-row"><Sel v={op[1]} opts={refs} onChange={(v) => set(1, v)} /></div>; break;
    case "remember": case "forget": body = <div className="ed-row"><input list="ed-facts" value={op[1]} placeholder="a_fact_name" onChange={(e) => set(1, e.target.value.replace(/\s+/g, "_").toLowerCase())} /></div>; break;
    case "memory": body = <><input className="ed-wide" value={op[1]} placeholder="Covered for {them_first}" onChange={(e) => set(1, e.target.value)} />
      <div className="ed-row wrap"><span>Feeling</span><Num v={op[2]} min={-1} max={1} step={0.1} onChange={(v) => set(2, v)} />
        <span>How big</span><Num v={op[3]} min={0} max={100} step={5} onChange={(v) => set(3, v)} /></div></>; break;
    case "vibe": {
      const b = op[2] || {};
      const setB = (k: string, v: Lines) => set(2, { ...b, [k]: v });
      body = <><div className="ed-row"><span>Style</span><Sel v={op[1]} opts={S?.vibes || ["tease", "sweet", "bold", "funny", "cheesy", "chill"]} onChange={(v) => set(1, v)} /></div>
        {(["good", "meh", "bad"] as const).map((k) => <div key={k} className="ed-vibe"><span>{k === "good" ? "If it lands" : k === "meh" ? "So-so" : "If it misses"}</span>
          <LinesEdit value={b[k]} onChange={(v) => setB(k, v)} rows={1} /></div>)}</>;
      break;
    }
    default: body = <JsonEdit op={op} onChange={onChange} />;
  }
  return (
    <div className="ed-op">
      <div className="ed-op-h">
        <select value={kind} onChange={(e) => onChange(JSON.parse(JSON.stringify(DEFAULTS[e.target.value] || [e.target.value])))}>
          {Object.keys(DEFAULTS).map((k) => <option key={k} value={k}>{LABEL[k] || k}</option>)}
          {!DEFAULTS[kind] && <option value={kind}>{kind}</option>}
        </select>
        <span className="ed-op-tools">
          {onUp && <button onClick={onUp} title="Earlier">▲</button>}
          {onDown && <button onClick={onDown} title="Later">▼</button>}
          <button onClick={onRemove} title="Remove">×</button>
        </span>
      </div>
      {S?.ops[kind] && <div className="ed-op-about">{S.ops[kind].about}</div>}
      {body}
      <datalist id="ed-facts">{facts.map((f) => <option key={f} value={f} />)}</datalist>
    </div>
  );
}

export function OpsEdit({ ops, onChange, schema, refs, facts }: { ops: Op[] | undefined; onChange: (o: Op[]) => void; schema: Schema | null; refs: string[]; facts: string[] }) {
  const xs = ops || [];
  const [adding, setAdding] = useState(false);
  const mv = (a: number, b: number) => {
    const c = [...xs];
    const [it] = c.splice(a, 1);
    c.splice(b, 0, it);
    onChange(c);
  };
  return (
    <div className="ed-ops">
      {xs.map((op, k) => (
        <OpRow key={k} op={op} schema={schema} refs={refs} facts={facts}
          onChange={(o) => onChange(xs.map((x, j) => (j === k ? o : x)))} onRemove={() => onChange(xs.filter((_, j) => j !== k))}
          onUp={k > 0 ? () => mv(k, k - 1) : undefined} onDown={k < xs.length - 1 ? () => mv(k, k + 1) : undefined} />
      ))}
      {adding ? (
        <div className="ed-op-add">
          {Object.keys(DEFAULTS).map((k) => (
            <button key={k} onClick={() => { onChange([...xs, JSON.parse(JSON.stringify(DEFAULTS[k]))]); setAdding(false); }}>{LABEL[k]}</button>
          ))}
        </div>
      ) : <button className="ed-link small" onClick={() => setAdding(true)}>+ what else happens</button>}
    </div>
  );
}
