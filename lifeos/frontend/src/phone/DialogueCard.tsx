// Dialogue packs on the phone: copy the prompt for ChatGPT, paste its answer back, turn packs on and off, try a scene.
import React, { useEffect, useState } from "react";
import { api } from "../api";
import { pgo } from "./api";
import { PIcon } from "./icons";
import { cx, errText, Sheet } from "./kit";
import { usePhone } from "./PhoneContext";
import { pickFile } from "./StoryFiles";

type PackRow = {
  id: string; name: string; author?: string; notes?: string; source: "builtin" | "yours"; enabled: boolean; ok: boolean;
  errors: string[]; warnings: string[]; summary: Record<string, number>; scenes: { id: string; title: string; who?: string }[];
};
type Packs = { packs: PackRow[]; scenes: string[]; lines: number };
type Check = { ok: boolean; errors: string[]; warnings: string[]; summary: Record<string, number>; name?: string };

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function addsLine(s: Record<string, number>) {
  const parts: string[] = [];
  if (s.scenes) parts.push(`${s.scenes} scene${s.scenes === 1 ? "" : "s"}`);
  if (s.texts) parts.push(`${s.texts} text${s.texts === 1 ? "" : "s"}`);
  if (s.replies) parts.push(`${s.replies} repl${s.replies === 1 ? "y" : "ies"}`);
  if (s.moment_choices) parts.push(`${s.moment_choices} choice${s.moment_choices === 1 ? "" : "s"}`);
  if (s.narration) parts.push(`${s.narration} story line${s.narration === 1 ? "" : "s"}`);
  if (s.mods) parts.push(`${s.mods} mod${s.mods === 1 ? "" : "s"}`);
  return parts.join(" · ") || "nothing yet";
}

export default function DialogueCard() {
  const { refresh, toast } = usePhone();
  const [data, setData] = useState<Packs | null>(null);
  const [paste, setPaste] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api.get("/api/dialogue/packs").then(setData).catch(() => setData(null));
  useEffect(() => {
    load();
  }, []);

  const copyPrompt = async () => {
    setBusy("copy");
    try {
      const r = await api.get("/api/dialogue/prompt");
      const ok = await copyText(r.prompt);
      toast(ok ? "Copied. Paste it into ChatGPT, say what you want, then paste its answer here." : "Couldn't copy on this phone. Try again.", ok ? "good" : "bad");
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  // the prompt that upgrades a pack you already have (with ?pack= it carries the pack itself); texting: just its people's texting
  const copyUpdate = async (pid?: string, kind: "update" | "texting" = "update") => {
    setBusy(pid ? `${kind === "texting" ? "tx" : "up"}:${pid}` : kind === "texting" ? "tx" : "up");
    try {
      const r = await api.get(`/api/dialogue/${kind === "texting" ? "texting" : "update"}-prompt${pid ? `?pack=${encodeURIComponent(pid)}` : ""}`);
      const ok = await copyText(r.prompt);
      toast(ok ? (pid ? "Copied, with your pack in it. Paste it into ChatGPT, then paste its answer back here: it replaces the old one."
        : "Copied. Paste it into ChatGPT, add your pack where it says, then paste the answer back here.") : "Couldn't copy on this phone. Try again.", ok ? "good" : "bad");
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  const toggle = async (p: PackRow) => {
    setBusy(p.id);
    try {
      setData(await api.post(`/api/dialogue/packs/${encodeURIComponent(p.id)}/enabled`, { enabled: !p.enabled }));
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (p: PackRow) => {
    if (!window.confirm(`Remove "${p.name}" from this phone?`)) return;
    setBusy(p.id);
    try {
      setData(await api.post(`/api/dialogue/packs/${encodeURIComponent(p.id)}/remove`, {}));
      setOpen(null);
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  const tryScene = async (sid: string) => {
    setBusy(sid);
    try {
      await api.post(`/api/dialogue/try/${encodeURIComponent(sid)}`, {});
      await refresh();
      toast("Here it is. It's in your story now.", "good");
      pgo("");
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="ph-section-t">Dialogue packs</div>
      <div className="ph-card dl-card">
        <p className="ph-dim small" style={{ marginTop: 0 }}>
          More texts, reply options and whole new scenes. Have ChatGPT (or Claude) write a pack, then paste it here.
          {data && <> Right now: <b>{data.scenes.length}</b> pack scenes and <b>{data.lines}</b> text lines.</>}
        </p>
        <div className="ph-filebtns">
          <button className="ph-btn primary block" disabled={!!busy} onClick={copyPrompt}>
            {busy === "copy" ? <span className="ph-spinner small light" /> : <PIcon name="chat" size={17} />} Copy the ChatGPT prompt
          </button>
          <button className="ph-btn soft block" disabled={!!busy} onClick={() => setPaste(true)}>
            <PIcon name="plus" size={17} /> Paste a pack
          </button>
        </div>
        <ol className="dl-how">
          <li>Copy the prompt and paste it into ChatGPT.</li>
          <li>Replace the "What I want" line with your idea.</li>
          <li>Copy ChatGPT's whole answer and tap <b>Paste a pack</b>.</li>
        </ol>
        <p className="ph-dim small">
          Made packs before? Open one below and tap <b>Upgrade it</b>: ChatGPT makes it bigger and adds in-person lines, versions
          that don't repeat, and mini games. <button className="ph-link" disabled={!!busy} onClick={() => copyUpdate()}>Pack not on this phone? Copy the upgrade prompt</button>
          {" "}Or tap <b>Upgrade its texting</b> so its people text like themselves. <button className="ph-link" disabled={!!busy} onClick={() => copyUpdate(undefined, "texting")}>Copy the texting prompt</button>
        </p>
        <div className="dl-list">
          {data?.packs.map((p) => (
            <div key={p.id} className={cx("dl-pack", !p.enabled && "off")}>
              <button className="dl-pack-h" onClick={() => setOpen(open === p.id ? null : p.id)}>
                <span className="dl-pack-m">
                  <b>{p.name}</b>
                  <small>{p.source === "builtin" ? "Built in" : "Yours"} · {p.ok ? addsLine(p.summary) : "has problems"}</small>
                </span>
                <span className={cx("ph-switch", p.enabled && "on")} role="switch" aria-checked={p.enabled}
                  onClick={(e) => { e.stopPropagation(); if (p.ok && busy !== p.id) toggle(p); }}><i /></span>
              </button>
              {open === p.id && (
                <div className="dl-pack-b">
                  {p.notes && <p className="ph-dim small">{p.notes}</p>}
                  {!p.ok && <Problems errors={p.errors} warnings={[]} />}
                  {p.scenes.length > 0 && (
                    <>
                      <div className="dl-sub">Scenes</div>
                      {p.scenes.map((sc) => (
                        <div key={sc.id} className="dl-scene">
                          <span><b>{sc.title.replace(/\{(\w+)\}/g, (_, k) => (k === "pet" ? "your pet" : k.replace(/_first$/, "").replace("them", "someone").replace("_", " ")))}</b>
                            {sc.who && <small>{sc.who.replace(/_/g, " ")}</small>}</span>
                          <button className="dl-try" disabled={!p.enabled || !!busy} onClick={() => tryScene(sc.id)}>
                            {busy === sc.id ? <span className="ph-spinner small" /> : "Play now"}
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                  {p.source === "yours" && p.ok && (
                    <button className="ph-btn soft block" disabled={!!busy} onClick={() => copyUpdate(p.id)}>
                      {busy === `up:${p.id}` ? <span className="ph-spinner small" /> : <PIcon name="chat" size={17} />} Upgrade it: copy the prompt for ChatGPT
                    </button>
                  )}
                  {p.source === "yours" && p.ok && (
                    <button className="ph-btn soft block" disabled={!!busy} onClick={() => copyUpdate(p.id, "texting")}>
                      {busy === `tx:${p.id}` ? <span className="ph-spinner small" /> : <PIcon name="chat" size={17} />} Upgrade its texting: copy the prompt
                    </button>
                  )}
                  {p.source === "yours" && <button className="ph-link dl-remove" onClick={() => remove(p)}>Remove this pack</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <PasteSheet open={paste} onClose={() => setPaste(false)} onAdded={(d) => { setData(d); setPaste(false); }} />
    </>
  );
}

function Problems({ errors, warnings }: { errors: string[]; warnings: string[] }) {
  if (!errors.length && !warnings.length) return null;
  return (
    <div className="dl-problems">
      {errors.length > 0 && <b>Needs fixing ({errors.length})</b>}
      {errors.slice(0, 12).map((e, i) => <div key={i} className="dl-err">{e}</div>)}
      {errors.length > 12 && <div className="dl-err">…and {errors.length - 12} more</div>}
      {warnings.slice(0, 6).map((e, i) => <div key={`w${i}`} className="dl-warn">{e}</div>)}
    </div>
  );
}

function PasteSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (d: Packs) => void }) {
  const { toast } = usePhone();
  const [text, setText] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setCheck(null);
  }, [open]);
  const doCheck = async (t = text) => {
    if (!t.trim()) return null;
    setBusy("check");
    try {
      const r: Check = await api.post("/api/dialogue/check", { text: t });
      setCheck(r);
      return r;
    } catch (e) {
      toast(errText(e), "bad");
      return null;
    } finally {
      setBusy(null);
    }
  };
  const add = async () => {
    setBusy("add");
    try {
      const r = await api.post("/api/dialogue/packs", { text });
      toast(`Added. ${addsLine(r.summary)}.`, "good");
      setText("");
      onAdded(r);
    } catch (e: any) {
      setCheck({ ok: false, errors: e?.errors?.length ? e.errors : [errText(e)], warnings: [], summary: {} });
    } finally {
      setBusy(null);
    }
  };
  const fromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setText(t);
        doCheck(t);
      }
    } catch {
      toast("Tap the box and paste instead (press and hold, then Paste).", "bad");
    }
  };
  const fromFile = async () => {
    const f = await pickFile(".json,.txt,application/json,text/plain");
    if (!f) return;
    const t = await f.text();
    setText(t);
    doCheck(t);
  };
  return (
    <Sheet open={open} onClose={onClose} full title="Paste a dialogue pack">
      <p className="ph-dim small" style={{ marginTop: 0 }}>Paste ChatGPT's whole answer. Extra words around the JSON are fine.</p>
      <div className="dl-paste-btns">
        <button className="ph-btn soft" onClick={fromClipboard}>Paste from clipboard</button>
        <button className="ph-btn soft" onClick={fromFile}><PIcon name="upload" size={16} /> File</button>
      </div>
      <textarea className="ph-input dl-text" value={text} placeholder='{"dialogue_pack": 1, "name": "...", ...}'
        onChange={(e) => { setText(e.target.value); setCheck(null); }} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
      {check && (
        check.ok ? (
          <div className="dl-ok">
            <b>{check.name || "This pack"} looks good.</b> It adds {addsLine(check.summary)}.
            {check.warnings.length > 0 && <Problems errors={[]} warnings={check.warnings} />}
          </div>
        ) : (
          <>
            <Problems errors={check.errors} warnings={check.warnings} />
            <button className="ph-link center" onClick={async () => {
              const ok = await copyText("The game found these problems in the dialogue pack. Please fix them and send the whole pack again as one JSON block:\n- " + check.errors.join("\n- "));
              toast(ok ? "Copied. Paste it back to ChatGPT." : "Couldn't copy.", ok ? "good" : "bad");
            }}>Copy the problems for ChatGPT</button>
          </>
        )
      )}
      <div className="dl-paste-foot">
        {!check?.ok ? (
          <button className="ph-btn primary block" disabled={!text.trim() || !!busy} onClick={() => doCheck()}>
            {busy === "check" ? <span className="ph-spinner small light" /> : null} Check it
          </button>
        ) : (
          <button className="ph-btn primary block" disabled={!!busy} onClick={add}>
            {busy === "add" ? <span className="ph-spinner small light" /> : <PIcon name="plus" size={17} />} Add to my game
          </button>
        )}
      </div>
    </Sheet>
  );
}
