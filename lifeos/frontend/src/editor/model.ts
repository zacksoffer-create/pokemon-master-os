// The Story Editor's model: a project is your whole story as the game's own pack files (storylines, the season plan,
// cast slots). Everything the editor doesn't edit (texting lines, trivia...) rides along untouched.

export type Lines = string | string[];
export type Op = any[];
export type Beat = { text: Lines; choices: Choice[]; [k: string]: any };
export type Choice = { label: string; hint?: string; fits?: Record<string, number>; ops?: Op[]; then?: Beat; [k: string]: any };
export type When = {
  years?: string[]; months?: number[]; not_before?: string; not_after?: string; after?: string[]; gap_days?: number;
  importance?: string; remembered?: string[]; not_remembered?: string[]; requires?: string[]; chance?: number; [k: string]: any;
};
export type ScheduleEntry = When & { skip?: boolean; replace_after?: boolean };
export type Scene = { id: string; title: string; text: Lines; by_text?: Lines; who?: string; when?: When; choices: Choice[]; notes?: string; [k: string]: any };
export type CastSlot = { who: string; sport?: string; grade_offset?: number; bind?: string; label?: string; [k: string]: any };
export type Pack = {
  dialogue_pack?: number; name: string; author?: string; in_order?: boolean; cast?: Record<string, CastSlot>; scenes?: Scene[];
  schedule?: Record<string, ScheduleEntry>; [k: string]: any;
};
export type Project = { name: string; packs: Pack[]; spec?: any; specName?: string; builtin: boolean; updated: number };

export type Schema = {
  who: Record<string, string>; years: { key: string; label: string }[]; requires: Record<string, string>; rel_fields: Record<string, string>;
  needs: string[]; focus: string[]; rep: string[]; refs: string[]; names: string[]; vibes: string[]; importance: string[];
  traits: string[]; talents: string[]; skills: string[]; minigames: Record<string, string>; max_beats: number; cast_who: string[]; sports: string[];
  ops: Record<string, { args: number; example: string; about: string }>; me_stats: Record<string, string>;
};

export const YEARS = ["freshman", "sophomore", "junior", "senior", "college_freshman", "college_sophomore", "college_junior"];
export const YEAR_SHORT: Record<string, string> = {
  freshman: "Fr", sophomore: "So", junior: "Jr", senior: "Sr", college_freshman: "C1", college_sophomore: "C2", college_junior: "C3",
  college_senior: "C4", high_school: "HS", college: "College",
};
export const YEAR_LABEL: Record<string, string> = {
  freshman: "Freshman", sophomore: "Sophomore", junior: "Junior", senior: "Senior", college_freshman: "College freshman",
  college_sophomore: "College sophomore", college_junior: "College junior", college_senior: "College senior",
  high_school: "Any high school year", college: "Any college year",
};
export const MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
export const MONTH_SHORT: Record<number, string> = { 1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun", 7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec" };
export const PALETTE = ["#ff6b4a", "#7c5cff", "#16a37f", "#f4a10b", "#2f8fe0", "#e0457b", "#5b8c2a", "#a2552b", "#0f9aa8", "#8a4fd8", "#c9831a", "#4a5bd1"];

export const asList = (x: Lines | undefined): string[] => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
export const fromList = (xs: string[]): Lines => (xs.length === 1 ? xs[0] : xs);
export const slug = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "s_$1").slice(0, 60) || "scene";

export function uniqueId(base: string, taken: Set<string>): string {
  let id = slug(base);
  if (!taken.has(id)) return id;
  for (let n = 2; ; n++) if (!taken.has(`${id}_${n}`)) return `${id}_${n}`;
}

export function allSceneIds(p: Project): Set<string> {
  const s = new Set<string>();
  p.packs.forEach((pk) => (pk.scenes || []).forEach((sc) => s.add(sc.id)));
  return s;
}

export function newScene(taken: Set<string>, title = "A new scene"): Scene {
  return {
    id: uniqueId(title, taken), title, text: [""],
    choices: [{ label: "", ops: [["say", [""]]] }, { label: "", ops: [["say", [""]]] }],
  };
}

export function newPack(name: string): Pack {
  return { dialogue_pack: 1, name, in_order: true, scenes: [] };
}

/** Where a scene lives: storyline index and position. */
export function findScene(p: Project, sid: string): { pack: number; index: number; scene: Scene } | null {
  for (let i = 0; i < p.packs.length; i++) {
    const j = (p.packs[i].scenes || []).findIndex((s) => s.id === sid);
    if (j >= 0) return { pack: i, index: j, scene: p.packs[i].scenes![j] };
  }
  return null;
}

/** A season plan's word on a scene (the last pack that schedules it wins, like the game), and which pack that is. */
export function planFor(p: Project, sid: string): { pack: number; entry: ScheduleEntry } | null {
  let out: { pack: number; entry: ScheduleEntry } | null = null;
  p.packs.forEach((pk, i) => {
    const e = pk.schedule?.[sid];
    if (e) out = { pack: i, entry: e };
  });
  return out;
}

/** The timing that actually applies: the scene's own, with the season plan on top (after links add up). */
export function effectiveWhen(p: Project, sc: Scene): When {
  const w: When = { ...(sc.when || {}) };
  p.packs.forEach((pk) => {
    const e = pk.schedule?.[sc.id];
    if (!e) return;
    for (const [k, v] of Object.entries(e)) {
      if (k === "after") {
        const add = Array.isArray(v) ? v : [v];
        w.after = Array.from(new Set(e.replace_after ? add : [...(w.after || []), ...add])).sort();
      } else if (k !== "replace_after") (w as any)[k] = v;
    }
  });
  return w;
}

/** Facts any choice remembers (for the branch pickers), and which scenes remember each. */
export function factIndex(p: Project): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const walk = (x: any, sid: string) => {
    if (Array.isArray(x)) {
      if (x[0] === "remember" && typeof x[1] === "string") out.set(x[1], [...(out.get(x[1]) || []), sid]);
      x.forEach((y) => walk(y, sid));
    } else if (x && typeof x === "object") Object.values(x).forEach((y) => walk(y, sid));
  };
  p.packs.forEach((pk) => (pk.scenes || []).forEach((sc) => walk(sc.choices, sc.id)));
  return out;
}

export function timingText(w: When): string {
  const bits: string[] = [];
  if (w.skip) return "retired by the season plan";
  if (w.years?.length) bits.push(w.years.map((y) => YEAR_SHORT[y] || y).join(" "));
  if (w.months?.length) bits.push(w.months.map((m) => MONTH_SHORT[m]).join(" "));
  if (w.not_before || w.not_after) bits.push(`${w.not_before || "…"} to ${w.not_after || "…"}`);
  if (w.after?.length) bits.push(`after ${w.after.length}`);
  if (w.gap_days) bits.push(`+${w.gap_days}d`);
  return bits.join(" · ") || "any time";
}

export function displayText(lines: Lines | undefined, names: Record<string, string>): string {
  const t = asList(lines)[0] || "";
  return t.replace(/\{(\w+)\}/g, (_, k) => names[k] || k.replace(/_/g, " "));
}

export function sampleNames(spec: any): Record<string, string> {
  const me = spec?.protagonist?.first || "Alex";
  const sib = spec?.siblings?.[0]?.first || "Marcus";
  const bf = (spec?.cast || []).find((c: any) => (c.relationships || []).some((r: any) => r.type === "best_friend"))?.first || "Danny";
  return {
    me_first: me, them: "Jordan Lee", them_first: "Jordan", best_friend: bf, best_friend_first: bf, sibling: sib, sibling_first: sib,
    partner: "Riley", partner_first: "Riley", school: "Guilford High", town: "Guilford", sport: "baseball", pet: "Buster",
  };
}

// --- persistence: the project lives in this browser (IndexedDB), saved as you type ---------------------------------

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("lifeos-story-editor", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function loadProject(): Promise<Project | null> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const g = d.transaction("kv").objectStore("kv").get("project");
      g.onsuccess = () => resolve((g.result as Project) || null);
      g.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveProject(p: Project): Promise<boolean> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const t = d.transaction("kv", "readwrite");
      t.objectStore("kv").put(p, "project");
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// --- files in and out ---------------------------------------------------------------------------------------------

/** Packs in a file: a bundle's packs, one pack, or ChatGPT's answer with the JSON inside it. */
export function packsFromText(text: string): Pack[] {
  let t = text.trim().replace(/^﻿/, "");
  const fence = t.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (fence) t = fence[1];
  else {
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("There's no story file in that (it should be JSON that starts with { and ends with }).");
    t = t.slice(a, b + 1);
  }
  const d = JSON.parse(t);
  if (d && Array.isArray(d.packs) && !d.scenes && !d.schedule) return d.packs.filter((x: any) => x && typeof x === "object");
  if (d && typeof d === "object") return [d];
  throw new Error("That isn't a story file.");
}

export function bundleOf(p: Project) {
  return { dialogue_bundle: 1, name: p.name, packs: p.packs };
}

export function download(name: string, data: string) {
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export const fileName = (s: string) => (s || "story").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, " ") || "story";
