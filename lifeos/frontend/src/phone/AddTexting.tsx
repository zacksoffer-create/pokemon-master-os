// Add texting: flirt lines and group chat conversations, written by ChatGPT (or by hand) and pasted in. What you add goes
// live right away, alongside the game's own; it's listed with your storylines, where you can edit or remove it.
import React, { useEffect, useState } from "react";
import { TextingCheck, phoneApi } from "./api";
import { copyText } from "./DialogueCard";
import { PIcon } from "./icons";
import { cx, errText, Sheet } from "./kit";
import { usePhone } from "./PhoneContext";
import { pickFile } from "./StoryFiles";

const WHAT: [string, string][] = [["flirt", "Flirting"], ["group", "Group chats"], ["both", "Both"]];
const SIZES: [string, string][] = [["few", "A few"], ["bunch", "A bunch"], ["lot", "A lot"]];
const IDEAS: Record<string, string[]> = {
  flirt: ["More teasing, less cheesy", "Shy and sweet", "Sarcastic and funny", "Bolder, for once we're already flirty", "Ways to let someone down nicely"],
  group: ["The boys roasting each other", "Fantasy football trash talk", "My team before the rivalry game", "Family chaos at the holidays"],
  both: ["Sarcastic flirting, and the boys roasting each other", "Sweet flirting, and family group chat chaos"],
};
const CHAT: Record<string, string> = { crew: "Crew", team: "Team", family: "Family" };
const WHEN: Record<string, string> = { weekend: "weekend", school_day: "school day", school_night: "school night", winter: "winter",
  has_pet: "pet", pregame: "game tomorrow", win: "after a win", loss: "after a loss" };

async function share(text: string, title: string) {
  try {
    await (navigator as any).share({ title, text });
  } catch { /* cancelled */ }
}

function Breakdown({ c }: { c: TextingCheck["breakdown"] }) {
  return (
    <div className="tx-break">
      {c.flirt_total > 0 && (
        <>
          <b>Flirting: {c.flirt_total} line{c.flirt_total === 1 ? "" : "s"}</b>
          <ul>{c.flirt.map((f) => <li key={f.label}><span>{f.label}</span><i>{f.n}</i></li>)}</ul>
        </>
      )}
      {c.texting > 0 && <b>Other texting lines: {c.texting}</b>}
      {c.group_chats.length > 0 && (
        <>
          <b>Group chats: {c.group_chats.length}</b>
          <ul className="tx-gc">
            {c.group_chats.map((g, i) => (
              <li key={i}>
                <small>{[CHAT[g.chat] || g.chat, ...g.when.map((w) => WHEN[w] || w)].join(" · ")} · {g.replies} ways to jump in</small>
                <span>“{g.first}”</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function AddTexting({ open, onClose, onAdded, inline }: { open: boolean; onClose: () => void; onAdded?: () => void; inline?: boolean }) {
  const { toast } = usePhone();
  const [what, setWhat] = useState("flirt");
  const [ask, setAsk] = useState("");
  const [size, setSize] = useState("bunch");
  const [paste, setPaste] = useState("");
  const [check, setCheck] = useState<TextingCheck | null>(null);
  const [done, setDone] = useState<TextingCheck["breakdown"] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ errors: string[]; fix: string } | null>(null);
  useEffect(() => {
    if (open) {
      setPaste("");
      setCheck(null);
      setDone(null);
    }
  }, [open]);
  const run = async (k: string, fn: () => Promise<void>) => {
    setBusy(k);
    try {
      await fn();
    } catch (e: any) {
      if (e?.data?.fix_prompt) setProblem({ errors: e.errors || [], fix: e.data.fix_prompt });
      toast(e?.errors?.[0] || errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  const copy = () => run("copy", async () => {
    const r = await phoneApi.textingPrompt(what, ask, size);
    const ok = await copyText(r.prompt);
    toast(ok ? "Copied. Paste it into ChatGPT, then paste what it writes below." : "Couldn't copy. Try Share.", ok ? "good" : "bad");
  });
  const fromFile = async () => {
    const f = await pickFile(".txt,.story,.md,text/plain");
    if (f) {
      setPaste(await f.text());
      setCheck(null);
    }
  };
  const doCheck = () => run("check", async () => {
    setProblem(null);
    setCheck(await phoneApi.textingCheck(paste));
  });
  const add = () => run("add", async () => {
    const r = await phoneApi.textingAdd(paste);
    setDone(r.breakdown);
    setPaste("");
    setCheck(null);
    onAdded?.();
    toast("Added. It's live now.", "good");
  });

  const body = (
      <div className="bs">
        {done ? (
          <div className="bs-done">
            <b>Added. It's in the game now.</b>
            <Breakdown c={done} />
            <p className="ph-dim small">Flirt lines show up as options when you flirt (and when someone flirts with you); group chats start up on
              their own, a few nights a week. It's listed with your storylines, where you can edit or remove it.</p>
            <button className="ph-btn primary block" onClick={() => setDone(null)}>Add more</button>
          </div>
        ) : (
          <>
            <div className="sch-step"><i>1</i><b>What do you want to add?</b></div>
            <div className="sch-size">
              {WHAT.map(([k, l]) => <button key={k} className={cx(what === k && "on")} onClick={() => setWhat(k)}>{l}</button>)}
            </div>
            <textarea className="ph-input" rows={3} value={ask} onChange={(e) => setAsk(e.target.value)}
              placeholder={what === "group" ? "Like: the boys roasting each other about fantasy football." : "Like: more teasing, a little sarcastic. Less cheesy."} />
            <div className="sch-sugg">{IDEAS[what].map((s) => <button key={s} onClick={() => setAsk(s)}>{s}</button>)}</div>
            <div className="sch-size"><span>How much</span>
              {SIZES.map(([k, l]) => <button key={k} className={cx(size === k && "on")} onClick={() => setSize(k)}>{l}</button>)}
            </div>
            <div className="sch-row2">
              <button className="ph-btn primary block" disabled={!!busy} onClick={copy}>{busy === "copy" ? <span className="ph-spinner small light" /> : "Copy the ChatGPT prompt"}</button>
              {"share" in navigator && (
                <button className="ph-btn block" disabled={!!busy}
                  onClick={() => run("share", async () => share((await phoneApi.textingPrompt(what, ask, size)).prompt, "LIFE OS: texting"))}>Share</button>
              )}
            </div>
            <p className="ph-dim small">Or write them yourself: the prompt shows the format, and anything you paste in that format works.</p>
            <div className="sch-step"><i>2</i><b>Paste what ChatGPT wrote</b></div>
            <textarea className="ph-input mono" rows={6} value={paste}
              placeholder={what === "group" ? "group chat crew, weekend:\n  A: ...\n  B: ...\n  * what you say | A +\n      A: ..." : "flirt tease:\n  ok who said you could be this funny\nflirt answers tease, lands:\n  oh so we're doing this 😏"}
              onChange={(e) => { setPaste(e.target.value); setCheck(null); setProblem(null); }} />
            <div className="sch-row2">
              <button className="ph-btn block" disabled={!!busy || !paste.trim()} onClick={doCheck}>{busy === "check" ? <span className="ph-spinner small" /> : "Check it"}</button>
              <button className="ph-btn soft block" disabled={!!busy} onClick={fromFile}><PIcon name="upload" size={15} /> Or a file</button>
            </div>
            {problem && (
              <div className="bs-left">
                <b>{problem.errors[0] || "That couldn't go in"}</b>
                {problem.errors.slice(1, 7).map((x, i) => <small key={i}>{x}</small>)}
                <button className="ph-btn soft block" onClick={async () => {
                  const ok = await copyText(problem.fix);
                  toast(ok ? "Copied. Send it to ChatGPT, then paste its new answer here." : "Couldn't copy.", ok ? "good" : "bad");
                }}>Copy a fix-it message for ChatGPT</button>
              </div>
            )}
            {check && (
              <div className="bs-check">
                <Breakdown c={check.breakdown} />
                {check.notes.length > 0 && (
                  <div className="bs-notes">
                    <b>Fixed for you ({check.notes.length})</b>
                    {check.notes.slice(0, 10).map((n, i) => <div key={i}>{n}</div>)}
                    {check.notes.length > 10 && <div>…and {check.notes.length - 10} more</div>}
                  </div>
                )}
                <button className="ph-btn primary block" disabled={!!busy} onClick={add}>
                  {busy === "add" ? <span className="ph-spinner small light" /> : "Add it"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
  );
  return inline ? body : <Sheet open={open} onClose={onClose} full title="Add texting">{body}</Sheet>;
}
