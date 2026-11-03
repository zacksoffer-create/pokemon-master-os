// The editor's shared state: the project with undo/redo, what's selected, the game's vocabulary, and the last check and
// play-through (so every screen can show what the engine said about a scene).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api } from "../api";
import { loadProject, Pack, Project, saveProject, Scene, Schema } from "./model";

export type CheckResult = {
  ok: boolean; scenes: number; storylines: number;
  packs: { index: number; name: string; ok: boolean; errors: string[]; warnings: string[]; summary: Record<string, number> }[];
  cross: { kind: string; pack: number | null; name: string | null; sid: string; text: string }[];
};
export type RunScene = { sid: string; pack: string; title: string; state: string; day?: number; date?: string; reason?: string; why?: string; detail?: any; importance: string };
export type RunResult = {
  scenes: RunScene[]; counts: Record<string, number>; seconds: number; skipped: { name: string; errors: string[] }[];
  who: { name: string; title: string; sample: boolean };
  coverage: { years: { label: string; key: string; months: number[]; total: number }[]; months: string[]; quiet: { from: string; to: string; days: number; year: string }[] };
};
export type Sel = { pack: number | null; sid: string | null };
export type Mode = "write" | "timeline" | "check";

type Hist = { past: Project[]; present: Project; future: Project[]; key: string | null; at: number };
type Act = { t: "edit"; fn: (p: Project) => Project; key?: string } | { t: "undo" } | { t: "redo" } | { t: "replace"; p: Project };

function reducer(h: Hist, a: Act): Hist {
  if (a.t === "replace") return { past: [], present: a.p, future: [], key: null, at: 0 };
  if (a.t === "undo") {
    if (!h.past.length) return h;
    return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: null, at: 0 };
  }
  if (a.t === "redo") {
    if (!h.future.length) return h;
    return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), key: null, at: 0 };
  }
  const next = { ...a.fn(h.present), updated: Date.now() };
  const now = Date.now();
  // typing in one field is one step to undo, not one per letter
  const same = a.key && a.key === h.key && now - h.at < 1500;
  return { past: same ? h.past : [...h.past.slice(-80), h.present], present: next, future: [], key: a.key || null, at: now };
}

export const EMPTY: Project = { name: "My story", packs: [], builtin: true, updated: 0 };

type Ctx = {
  p: Project; edit: (fn: (p: Project) => Project, key?: string) => void; undo: () => void; redo: () => void; replace: (p: Project) => void;
  canUndo: boolean; canRedo: boolean; saved: boolean; schema: Schema | null;
  sel: Sel; setSel: (s: Sel) => void; mode: Mode; setMode: (m: Mode) => void;
  check: CheckResult | null; runCheck: () => Promise<void>; run: RunResult | null; runStory: () => Promise<void>; busy: string | null;
  toast: (t: string, bad?: boolean) => void; note: { t: string; bad?: boolean } | null;
};
const C = createContext<Ctx | null>(null);
export const useEd = () => useContext(C)!;

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [h, dispatch] = useReducer(reducer, { past: [], present: EMPTY, future: [], key: null, at: 0 });
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(true);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [sel, setSel] = useState<Sel>({ pack: null, sid: null });
  const [mode, setMode] = useState<Mode>("write");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ t: string; bad?: boolean } | null>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    loadProject().then((p) => {
      if (p) dispatch({ t: "replace", p: { ...EMPTY, ...p } });
      setLoaded(true);
    });
    api.get("/api/storyeditor/schema").then(setSchema).catch(() => setSchema(null));
  }, []);
  useEffect(() => {  // saved as you type
    if (!loaded) return;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveProject(h.present).then(setSaved), 600);
  }, [h.present, loaded]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;  // a field undoes its own typing; the toolbar undoes the rest
      e.preventDefault();
      dispatch({ t: e.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const toast = useCallback((t: string, bad?: boolean) => {
    setNote({ t, bad });
    setTimeout(() => setNote((n) => (n && n.t === t ? null : n)), 4200);
  }, []);
  const runCheck = useCallback(async () => {
    setBusy("check");
    try {
      setCheck(await api.post("/api/storyeditor/check", { packs: h.present.packs }));
    } catch (e: any) {
      toast(e.message || String(e), true);
    } finally {
      setBusy(null);
    }
  }, [h.present.packs, toast]);
  const runStory = useCallback(async () => {
    setBusy("run");
    try {
      const [c, r] = [await api.post("/api/storyeditor/check", { packs: h.present.packs }),
        await api.post("/api/storyeditor/run", { packs: h.present.packs, spec: h.present.spec || null, builtin: h.present.builtin })];
      setCheck(c);
      setRun(r);
    } catch (e: any) {
      toast(e.message || String(e), true);
    } finally {
      setBusy(null);
    }
  }, [h.present, toast]);

  const v: Ctx = useMemo(() => ({
    p: h.present, edit: (fn, key) => dispatch({ t: "edit", fn, key }), undo: () => dispatch({ t: "undo" }), redo: () => dispatch({ t: "redo" }),
    replace: (p) => dispatch({ t: "replace", p }), canUndo: h.past.length > 0, canRedo: h.future.length > 0, saved, schema,
    sel, setSel, mode, setMode, check, runCheck, run, runStory, busy, toast, note,
  }), [h, saved, schema, sel, mode, check, run, busy, runCheck, runStory, toast, note]);
  if (!loaded) return <div className="ed-boot">Opening your story…</div>;
  return <C.Provider value={v}>{children}</C.Provider>;
}

// --- immutable edits ---------------------------------------------------------------------------------------------

export const updPack = (p: Project, i: number, fn: (pk: Pack) => Pack): Project => ({ ...p, packs: p.packs.map((pk, j) => (j === i ? fn(pk) : pk)) });

export const updScene = (p: Project, i: number, sid: string, fn: (s: Scene) => Scene): Project =>
  updPack(p, i, (pk) => ({ ...pk, scenes: (pk.scenes || []).map((s) => (s.id === sid ? fn(s) : s)) }));

/** A new id for a scene, and every link to it (after, the season plan) follows. */
export function renameScene(p: Project, from: string, to: string): Project {
  const fix = (a?: string[]) => (a ? a.map((x) => (x === from ? to : x)) : a);
  return {
    ...p,
    packs: p.packs.map((pk) => ({
      ...pk,
      scenes: (pk.scenes || []).map((s) => ({
        ...(s.id === from ? { ...s, id: to } : s),
        ...(s.when?.after?.includes(from) ? { when: { ...s.when, after: fix(s.when.after) } } : {}),
      })),
      ...(pk.schedule ? {
        schedule: Object.fromEntries(Object.entries(pk.schedule).map(([k, e]) => [k === from ? to : k, e.after?.includes(from) ? { ...e, after: fix(e.after) } : e])),
      } : {}),
    })),
  };
}

/** Drop empty bits so the file stays as clean as one written by hand. */
export function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
}
