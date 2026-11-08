// Story Studio → Rosters: your real teams, coaches and teachers. Write down what you remember, copy the ChatGPT prompt
// (it carries who's in your game now, so names match), paste the roster sheet ChatGPT writes, Check it (every line: who
// it matched, who's new, what it sets, what won't go in), then Put it in. Sheets are kept for Start over.
import React, { useEffect, useState } from "react";
import { phoneApi, RosterCheck, RosterOverview } from "./api";
import { copyText } from "./DialogueCard";
import { PIcon } from "./icons";
import { cx, errText } from "./kit";
import { usePhone } from "./PhoneContext";
import { pickFile } from "./StoryFiles";

const STATUS: Record<string, string> = { found: "In your game", new: "New", rename: "Renamed", skip: "Won't go in", rule: "Rule" };
const IDEAS = [
  "Football my freshman year: coaches and who played what",
  "Baseball all four years, with numbers",
  "My teachers freshman year, class by class",
  "The basketball coaching staff and what they were like",
];

export function RostersBody() {
  const { toast } = usePhone();
  const [ov, setOv] = useState<RosterOverview | null>(null);
  const [ask, setAsk] = useState("");
  const [paste, setPaste] = useState("");
  const [check, setCheck] = useState<RosterCheck | null>(null);
  const [done, setDone] = useState<{ done: string[]; skipped: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => phoneApi.rosters().then(setOv).catch(() => setOv(null));
  useEffect(() => { load(); }, []);
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
  const copy = () => run("copy", async () => {
    const ok = await copyText((await phoneApi.rostersPrompt(ask)).prompt);
    toast(ok ? "Copied. Paste it into ChatGPT, add your notes, then paste the sheet it writes below." : "Couldn't copy.", ok ? "good" : "bad");
  });
  const doCheck = () => run("check", async () => { setCheck(await phoneApi.rostersCheck(paste)); });
  const doApply = () => run("apply", async () => {
    const r = await phoneApi.rostersApply(paste);
    setDone(r);
    setCheck(null);
    setPaste("");
    load();
    toast(r.skipped.length ? `In. ${r.skipped.length} line${r.skipped.length === 1 ? "" : "s"} didn't go in.` : "In. Your teams are real now.", r.skipped.length ? undefined : "good");
  });
  const fromFile = async () => {
    const f = await pickFile();
    if (f) { setPaste(await f.text()); setCheck(null); }
  };
  const sections = check ? Array.from(new Set(check.rows.map((r) => r.section))) : [];
  return (
    <div className="ed-body ros">
      <p className="ph-dim small ros-intro">Make your teams, coaches and teachers the real ones. Write down who you remember (teams by year,
        who played what, numbers, what people were like), let ChatGPT turn it into a roster sheet, and paste it here. Everyone it names is
        matched to the person already in your story, or added. Rosters are kept by school year, so tryouts put your real teammates there.</p>

      {done ? (
        <div className="bs-done">
          <b>In. {done.done.length} change{done.done.length === 1 ? "" : "s"}.</b>
          <div className="ros-done">{done.done.map((d, i) => <small key={i}>{d}</small>)}</div>
          {done.skipped.length > 0 && (
            <div className="bs-left soft"><b>Didn't go in ({done.skipped.length})</b>{done.skipped.map((s, i) => <small key={i}>{s}</small>)}</div>
          )}
          <button className="ph-btn primary block" onClick={() => setDone(null)}>Add another sheet</button>
        </div>
      ) : (
        <>
          <div className="sch-step"><i>1</i><b>What do you want to set up?</b></div>
          <textarea className="ph-input" rows={3} value={ask} onChange={(e) => setAsk(e.target.value)}
            placeholder="Your notes, or just what they're about (you can paste your notes into ChatGPT instead)." />
          <div className="sch-sugg">{IDEAS.map((s) => <button key={s} onClick={() => setAsk(s)}>{s}</button>)}</div>
          <button className="ph-btn primary block" disabled={!!busy} onClick={copy}>
            {busy === "copy" ? <span className="ph-spinner small light" /> : "Copy the ChatGPT prompt"}
          </button>
          <div className="sch-step"><i>2</i><b>Paste the roster sheet</b></div>
          <textarea className="ph-input mono" rows={7} value={paste} onChange={(e) => { setPaste(e.target.value); setCheck(null); }}
            placeholder={"-- Football 2010-11\ncoach: Tom Bryant | head coach | old-school\nplayer: Arjun Winslow | senior | RB | #22 | varsity | captain\n-- Teachers\nteacher: Mr. Haddad | Honors English 9"} />
          <div className="sch-row2">
            <button className="ph-btn primary block" disabled={!!busy || !paste.trim()} onClick={doCheck}>
              {busy === "check" ? <span className="ph-spinner small light" /> : "Check it"}
            </button>
            <button className="ph-btn soft block" disabled={!!busy} onClick={fromFile}><PIcon name="upload" size={15} /> Or a file</button>
          </div>
          {check && (
            <div className="ros-check">
              <p className="ros-sum">
                <b>{check.counts.found}</b> in your game · <b>{check.counts.new}</b> new{check.counts.rename ? <> · <b>{check.counts.rename}</b> renamed</> : null}
                {check.counts.skip ? <> · <b className="bad">{check.counts.skip}</b> won't go in</> : null}
              </p>
              {sections.map((s) => (
                <div key={s} className="ros-sec">
                  <div className="pp-h">{s}</div>
                  {check.rows.filter((r) => r.section === s).map((r, i) => (
                    <div key={i} className={cx("ros-row", r.status)}>
                      <i className="ros-st">{STATUS[r.status] || r.status}</i>
                      <span>
                        <b>{r.name}</b>{r.kind !== "player" && r.kind !== "only" ? <em> · {r.kind}</em> : null}
                        <small>{r.says}</small>
                        {r.matched && <small className="ros-m">matched to {r.matched}</small>}
                        {r.warn && <small className="ros-w">{r.warn}</small>}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {check.notes.length > 0 && (
                <div className="bs-left soft"><b>Lines it couldn't read</b>{check.notes.map((n, i) => <small key={i}>{n}</small>)}</div>
              )}
              <button className="ph-btn primary block" disabled={!!busy || check.rows.every((r) => r.status === "skip")} onClick={doApply}>
                {busy === "apply" ? <span className="ph-spinner small light" /> : "Put it in"}
              </button>
            </div>
          )}
        </>
      )}

      {ov && (
        <div className="ros-now">
          <div className="pp-h">Your teams now · {ov.year}</div>
          {ov.teams.map((t) => (
            <div key={t.id} className="ros-team">
              <b>{t.name}</b>
              <small>{t.coach || "no coach"}{t.assistants.length ? ` · ${t.assistants.join(", ")}` : ""}</small>
              {t.years.length > 0 && <small className="ros-set">Roster set for {t.years.map((y) => `${2010 + y}-${String(2011 + y).slice(2)}`).join(", ")}
                {t.only ? " (only those players this year)" : ""}</small>}
            </div>
          ))}
          {ov.teachers.length > 0 && (
            <>
              <div className="pp-h ros-h2">Teachers you set</div>
              {ov.teachers.map((t) => <div key={t.name} className="ros-team"><b>{t.name}</b><small>{t.classes.join(", ")}</small></div>)}
            </>
          )}
          {ov.sheets.length > 0 && <p className="ph-dim small">{ov.sheets.length} sheet{ov.sheets.length === 1 ? "" : "s"} put in. Start over puts them back.</p>}
        </div>
      )}
    </div>
  );
}
