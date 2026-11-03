// Read a storyline and all its expansions the way they'd play: your seven years forward on a copy, every scene in order
// with its date (or why it won't come), how healthy it is, and the script of each scene laid out to read.
import React, { useEffect, useState } from "react";
import { phoneApi, StorylineRead as SR } from "./api";
import { cx, errText, Sheet } from "./kit";
import { usePhone } from "./PhoneContext";
import { CoverageGrid } from "./Schedule";

const OUT = /^(great|good|miss|yes|no|meh|bad)\s*:\s*(.*)$/i;
const SPEAK = /^([A-Za-z{][\w{}.' -]{0,30}?):\s+(.+)$/;
const CMD = /^(remember|forget)\s+(\S+)$/;

/** {a|b} versions as "a / b", {sis} names as the name. */
function fmt(t: string): React.ReactNode {
  return t.split(/(\{[^{}]*\})/).map((part, i) => {
    const m = /^\{([^{}]*)\}$/.exec(part);
    if (!m) return part;
    return m[1].includes("|") ? <span key={i} className="rd-var">{m[1].split("|").join(" / ")}</span> : <span key={i} className="rd-name">{m[1]}</span>;
  });
}

/** One scene's script, laid out to read: narration, who says what, the choices and what each one does. */
export function ScriptView({ src }: { src: string }) {
  const lines = src.split("\n");
  const body = lines.slice(1).filter((l) => l.trim() && !l.trim().startsWith("//"));
  return (
    <div className="rd-script">
      {body.map((raw, i) => {
        const depth = Math.floor((raw.length - raw.trimStart().length) / 4);
        let t = raw.trim();
        let fx = "";
        const bar = t.indexOf(" | ");
        if (bar > 0 && !/^\{[^}]*\|/.test(t.slice(Math.max(0, bar - 20), bar + 3))) {
          fx = t.slice(bar + 3);
          t = t.slice(0, bar).trim();
        } else if (t.startsWith("|")) {
          fx = t.slice(1).trim();
          t = "";
        }
        const pad = { paddingLeft: depth * 14 };
        const eff = fx ? <em className="rd-fx">{fx}</em> : null;
        if (t.startsWith("*")) {
          return <div key={i} className="rd-choice" style={pad}><span>▸</span><b>{fmt(t.replace(/^\*\s*/, ""))}</b>{eff}</div>;
        }
        const o = OUT.exec(t);
        if (o) return <div key={i} className="rd-out" style={pad}><i>{o[1]}</i>{fmt(o[2])}{eff}</div>;
        const c = CMD.exec(t);
        if (c) return <div key={i} className="rd-cmd" style={pad}>{c[1] === "remember" ? "remembers" : "forgets"} {c[2]}</div>;
        const m = SPEAK.exec(t);
        if (m) return <div key={i} className="rd-say" style={pad}><b>{fmt(m[1])}</b> {fmt(m[2])}{eff}</div>;
        return <div key={i} className="rd-narr" style={pad}>{fmt(t)}{eff}</div>;
      })}
    </div>
  );
}

function tagsOf(src: string): string {
  const m = /\[([^\]]*)\]/.exec(src.split("\n")[0] || "");
  return m ? m[1] : "";
}

export default function StorylineRead({ pack, onClose, onExpand }: { pack: string | null; onClose: () => void; onExpand?: (pack: string) => void }) {
  const { toast } = usePhone();
  const [v, setV] = useState<SR | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  useEffect(() => {
    setV(null);
    setOnly(null);
    if (pack) phoneApi.readStoryline(pack).then(setV).catch((e) => { toast(errText(e), "bad"); onClose(); });
  }, [pack]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = (v?.scenes || []).filter((x) => !only || x.pack === only);
  let lastYear: string | null = "";
  return (
    <Sheet open={!!pack} onClose={onClose} full title={v?.title || "Storyline"}>
      {!v ? (
        <div className="rd-wait"><span className="ph-spinner" /><p className="ph-dim small">Playing your seven years forward on a copy…</p></div>
      ) : (
        <>
          <div className={cx("rd-health", v.plays === v.total ? "ok" : v.plays === 0 ? "bad" : "mid")}>
            <b>{v.plays} of {v.total}</b> scenes play in your seven years
            {v.wont.length > 0 && (
              <div className="rd-wont">
                {v.wont.map((w) => <div key={w.why}><b>{w.count} won't:</b> {w.why} <small>({w.titles.join(", ")}{w.count > w.titles.length ? "…" : ""})</small></div>)}
              </div>
            )}
          </div>
          {v.parts.length > 1 && (
            <div className="rd-parts">
              <button className={cx(!only && "on")} onClick={() => setOnly(null)}>All</button>
              {v.parts.map((p) => (
                <button key={p.pack} className={cx(only === p.pack && "on")} onClick={() => setOnly(p.pack)}>
                  {p.expands ? p.name.replace(`${p.expands}: `, "+ ") : p.name} <small>{p.plays}/{p.scenes}</small>
                </button>
              ))}
            </div>
          )}
          {onExpand && <button className="ph-btn soft block" onClick={() => onExpand(v.pack)}>Add an expansion</button>}
          <CoverageGrid c={v.coverage} />
          {shown.map((x) => {
            const head = x.plays ? x.year : "Won't play";
            const show = head !== lastYear;
            lastYear = head;
            return (
              <React.Fragment key={x.sid}>
                {show && <div className={cx("rd-year", !x.plays && "bad")}>{head}</div>}
                <div className={cx("rd-scene", !x.plays && "off")}>
                  <div className="rd-head">
                    <b>{x.title}</b>
                    <span className={cx("rd-when", !x.plays && "bad")}>{x.plays ? (x.date || "").replace(/, \d{4}$/, "") : "won't play"}</span>
                  </div>
                  <div className="rd-tags">{x.storyline !== v.title && <i>{x.storyline.replace(`${v.title}: `, "+ ")}</i>}{tagsOf(x.src)}</div>
                  {!x.plays && x.why && <div className="rd-why">{x.why}{x.detail && typeof x.detail === "string" ? ` (${x.detail.replace(/_/g, " ")})` : ""}</div>}
                  <ScriptView src={x.src} />
                </div>
              </React.Fragment>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
