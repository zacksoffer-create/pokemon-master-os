// Phone app API: typed wrappers around /api/phone/* and the story endpoints the phone uses.
import { api } from "../api";

export type Look = {
  skin: string; hair: string; hair_color: string; eyes: string; facial_hair: string; glasses: boolean; freckles: boolean;
};
export type Mood = "happy" | "neutral" | "sad" | "angry" | "flirty" | "surprised" | "tired";

export type Scene = { art: string; title: string; line: string; phase: string; season: string; weekend: boolean; break: string | null; time: string };
export type FeedItem = { id: number; date: string; slot: string; type: string; outcome: string; text: string; with: string[]; importance: number };
export type EdMini = { id: string; name: string; first: string; color: string; look: Look; year: string; role: string };
export type EdRel = { affection: number; attraction: number; trust: number; respect: number; rivalry: number; familiarity: number; perceived: number;
  label: string; crush: boolean };
export type EdPersonRow = EdMini & { grade: number | null; me: boolean; family: boolean; known: boolean; label: string | null; close: number };
export type EdSchema = { traits: string[]; aptitudes: string[]; motives: string[]; needs: string[]; skills: { id: string; label: string }[];
  interests: { id: string; label: string }[]; rel_fields: { id: string; label: string; min: number; max: number }[]; crush_at: number; friend_at: number };
export type EdPerson = EdMini & { last: string; bio: string; gender: string; grade: number | null; is_me: boolean; look_locked: Partial<Look>;
  traits: Record<string, number>; aptitudes: Record<string, number>; motives: Record<string, number>; skills: Record<string, number>;
  interests: Record<string, number>; needs: Record<string, number>; mood: number; popularity: number; money: number; gpa: number; student: boolean;
  partner: string | null; with_me: { ab: EdRel | null; ba: EdRel | null } | null;
  rels: (EdMini & { roles: string[]; ab: EdRel | null; ba: EdRel | null })[] };
export type EdPair = { a: EdMini; b: EdMini; ab: EdRel | null; ba: EdRel | null; roles: string[]; dating: boolean; presets: { id: string; label: string }[] };
export type SceneMini = { id: string; name: string; first: string; color: string; look: Look; year: string };
export type LadderRow = SceneMini & {
  rank: number | null; scope_rank?: number; move: number | null; pop?: number; grade?: number | null; known_for: string; tags: string[];
  storylines: string[]; label?: string | null; via?: SceneMini | null; why?: string | null;
};
export type LadderPart = { key: string; label: string; score: number; line: string; value?: number; of?: number };
export type Superlative = { key: string; label: string; winner: SceneMini & { you: boolean }; partner?: SceneMini; runners: SceneMini[]; you: number | null };
export type LadderView = {
  you: LadderRow & { of: number; tier: string; grade_rank: number; grade_of: number; grade_label: string;
    history: { day: number; date: string; rank: number; of: number }[]; next_up: (LadderRow & { gap: number }) | null;
    this_week: { text: string; date: string; imp: number }[]; parts: LadderPart[]; tip: string };
  movers: { up: LadderRow[]; down: LadderRow[] }; rows: LadderRow[]; scope: string; of: number; storyline_people: LadderRow[];
  week_of: string | null; superlatives: Superlative[];
};
export type SceneView = {
  me: { rank: number; of: number; grade_rank: number; grade_of: number; tier: string; popularity: number; group: string | null; reputation: string[]; friends: number };
  groups: { id: string; name: string; size: number; mine: boolean; members: (SceneMini & { friend: boolean; me: boolean; family: boolean })[]; friends: number;
    way_in: SceneMini | null; vibe: string; standing: string; since: string }[];
  couples: { a: SceneMini; b: SceneMini; since: string; new: boolean; you: boolean }[];
  breakups: { a: SceneMini; b: SceneMini; when: string }[];
  popular: (SceneMini & { you: boolean })[];
  meet: (SceneMini & { mutual: string[]; n: number; via: SceneMini })[];
  intro_today: boolean;
  talk: Rumor[];
  fights: { a: string; b: string; reason: string; when: string }[];
};
export type Rumor = { id: string; text: string; about_you: boolean; true: boolean | null; about: { id: string; first: string; color: string; look: Look } | null;
  from: string | null; known: number; spread: string; when: string; new: boolean; acted: string | null; origin: string | null };
export type MomentGame = { id: string; title: string; secs?: number | null; icon: string };
export type Moment = { id: string; kind: string; day: number; title: string; text: string; ctx: any; choices: { label: string; hint: string; game?: MomentGame }[]; storyline?: string | null;
  episode_label?: string | null; previously?: string | null };
export type PetDuty = { id: string; label: string; hint: string; when: string; owner: string; today: string; due: boolean; done: boolean; done_by: string | null };
export type Pet = {
  id: string; name: string; species: "dog" | "cat" | "rabbit"; species_label: string; breed: string; coat: string; personality: string; age: number;
  pronoun: string; possessive: string; mood: string; happiness: number; fullness: number; energy: number; health: number; clean: number;
  bond: Record<string, number>; my_bond: number; tricks: { name: string; progress: number }[]; duties: PetDuty[]; setup_needed: boolean;
  streak: number; quick_left: Record<string, number>; activities: { id: string; label: string; quick: boolean }[]; adopted: string;
};
export type PhoneState = {
  active: boolean; day: number; date: string; weekday: string; term: string; scene: Scene; decision_ready: boolean;
  progress: { day: number; total: number; pct: number; year: number; complete: boolean }; title: string;
  me: any; moments: Moment[]; feed: FeedItem[]; last_event: number; unread: number; needs_reply: number;
  committed?: { kind: string; group: string; label: string } | null;
  pets: Pet[]; pet_setup_needed: boolean; pet_approved: { species: string; day: number } | null; queued: { label: string } | null;
  family: { name: string; guardians: { id: string; name: string; full: string }[]; siblings: { id: string; first: string; year_label: string; location: string; look: Look; path: any }[];
    younger?: { key: string; first: string; year_label: string; starts: string; look: Look }[]; style: string; trust: number };
  teams: { id: string; name: string; sport: string; record: { w: number; l: number }; mine?: { w: number; l: number }; level: string; position: string }[];
  squad?: { name: string; members: { id: string; first: string; look: Look }[]; cohesion: number; last: string | null;
    plan: { label: string; when: string; joined: boolean } | null; jokes: string[] } | null;
  control: { focus: string; ask_invites: boolean; ask_romance: boolean; stop_before_games: boolean; stop_on_big: boolean; auto_lunch?: boolean; class_games?: boolean; editor?: boolean;
    pacing?: string; auto_scenes?: boolean; binge?: boolean };
  stories?: { waiting: number; presented_today: number; target: number | null; pacing: string; label: string; played?: number; binge?: boolean };
  setting: { town: string; school: string; short: string; mascot: string };
};
export type Choice = { index: number; action: string; label: string; category: string; target: string | null; target_name: string | null; prob: number; risk: number; text: string; icon: string; why: string;
  group?: "should" | "want" | "could"; reason?: string; later?: string | null; gut?: boolean; key?: string; crew?: string[];
  section?: "people" | "solo" | "out" | "trouble"; act?: string; who?: string };
export type DaySlot = { phase: string; label: string; icon: string; state: "done" | "now" | "later"; note: string; decide: boolean; kind?: string; plan?: string };
export type PlateItem = { id: string; kind: string; icon: string; title: string; sub: string; go?: string; cta?: string };
export type WeekDay = { n: number; dow: string; num: number; date: string; school: boolean; items: { icon: string; label: string; kind: string }[] };
export type Episode = { number: number; title: string; storyline: string; date: string; choices: string[]; said: string | null; who: string | null; premiere: boolean; finale: boolean };
export type EpisodeGuide = { now: { season: number; label: string }; seasons: { n: number; label: string; episodes: Episode[] }[];
  coming_up: { storyline: string; next: string; chapter: number; of: number }[] };
export type Today = { strip: DaySlot[]; plate: PlateItem[]; week: WeekDay[] };
export type Line = { id: number; type: string; outcome?: string; text: string; with?: string[]; calc?: any };
export type Chip = { label: string; delta: number; good: boolean; who?: string; kind?: string };
export type ThreadSummary = { id: string; kind: "dm" | "group"; title: string; members: string[]; unread: number; last: string; last_from: string; at: string; date: string; needs_reply: boolean };
export type Msg = { id: string; from: string; from_name: string; text: string; at: string; day: number; date: string; kind: string; read: boolean; replies: string[] | null; chosen: number | null; fast?: boolean };
export type ChatSuggestion = { text: string; intent: string; tone: string; style?: string; yn?: string };
export type ChatBar = { can_type: boolean; suggestions: ChatSuggestion[]; status: "new" | "open" | "done" | "no_number" | "none"; stage?: string; read?: string; tone?: string; romance?: boolean };
export type Thread = { id: string; kind: "dm" | "group"; title: string; members: string[]; msgs: Msg[]; can_text: boolean; text_options: { kind: string; label: string }[]; chat?: ChatBar };
export type Vibe = { stage: number; stages: string[]; read: string; tone: string; level: number; signals: { text: string; good: boolean | null }[]; tip: string; romance: boolean;
  tastes?: { style: string; label: string; known: boolean; taste: number | null }[] };
export type ContactRow = {
  id: string; name: string; first: string; year_label: string; look: Look; color: string; label: string; crush: boolean; partner: boolean; roles: string[];
  affection: number; hearts: number; attraction: number; rivalry: number; perceived: number; has_number: boolean; unread: number;
  last: { text: string; at: string; from: string } | null; location: string; role: string; glance?: string;
};
export type WhoFact = { k: string; v: string; tone?: string };
export type Who = { level: "everyone" | "know" | "close"; glance: string; sections: { level: string; label: string; facts: WhoFact[] }[];
  hidden: number; unlock: string | null };
export type Contact = ContactRow & {
  bio: string; archetype: string; pronouns: string; teams: string[]; school: string; since: string | null; feel: string; seems: string;
  trust: number; respect: number; familiarity: number; memories: { text: string; date: string; valence: number }[];
  shared: { id: number; date: string; text: string }[]; text_options: { kind: string; label: string }[]; partner_of: string | null; vibe?: Vibe;
  who?: Who;
};

export type MiniGameRow = { id: string; title: string; label: string; blurb: string; icon: string; ready: boolean; available: boolean; why: string; rewarded_today: boolean; best: number | null };
export type ClassRow = { id: string; name: string; subject: string; teacher: string; honors: boolean; pct: number; letter: string; quizzes: number; quiz_avg: number | null;
  games: number; games_won: number };
export type ClassesView = { gpa: number; year: string; classes: ClassRow[]; upcoming: { name: string; date: string; in_days: number; weight: number }[]; tests_played: number };
export type ScheduleRow = { sid: string; pack: string; title: string; importance: string; window: any; window_rule: string | null; window_text: string;
  order: number; state: string; day?: number; date?: string; reason?: string; detail?: any; why: string; last?: any };
export type ScheduleView = { profile: string; profiles: Record<string, { label: string; about: string }>; auto_scenes: boolean; date: string;
  queue: { sid: string; title: string; phase: string; importance: string }[]; presented_today: number; target_today: number | null;
  backlog: number; overdue: number; majors_this_week: number;
  storylines: { pack: string; name: string; in_order: boolean; played: number; queued: number; eligible: number; waiting: number; unreachable: number; expired: number; presented: number }[];
  scenes: ScheduleRow[] };
export type ScheduleReport = { date: string; profile: string; counts: Record<string, number>; warnings: { sid: string; kind: string; text: string }[];
  deadline_misses: any[]; identity: { slot: string; who: string; name: string | null; problems: string[] }[];
  busiest_days: { date: string; scenes: number }[]; days_with_scenes: number; markdown?: string; coverage?: Coverage };
export type Coverage = { years: { label: string; key: string; months: number[]; total: number }[]; months: string[];
  quiet: { from: string; to: string; days: number; year: string }[] };
export type AddPreview = { ok: boolean; errors: string[]; warnings: string[]; name?: string; fix_prompt?: string | null;
  new?: { sid: string; title: string; state: string; date?: string; reason?: string; why?: string; detail?: any }[]; new_played?: number;
  changed?: { sid: string; title: string; state: string; date?: string; why?: string; reason?: string }[]; already_there?: string[];
  played_total?: number; before?: number | null; coverage?: Coverage };
export type UpNextRow = { sid: string; title: string; storyline: string; pack: string; day: number; date: string; in_days: number;
  importance: string; ready: boolean; waits_for: string[] };
export type UpNext = { now: { sid: string; title: string } | null; list: UpNextRow[]; date: string;
  changes: { sid: string; title: string; waits_for: { sid: string; title: string }[] }[]; note?: string | null; undid?: boolean };
export type PlayRead = {
  read: { title: string; text: string; storyline: string; chose: string }; lines: Line[]; moment: Moment | null; chapter_done: boolean;
};
export type PlayStep = {
  moment?: Moment; done?: boolean; chapter?: number; of: number; storyline: string; pack?: string;
  skipped: { sid: string; chapter: number; title: string; why: string }[];
  chapters?: { sid: string; title: string }[]; path?: { sid: string; title: string; picks: string[] }[];
};
export const phoneApi = {
  state: (since?: number): Promise<PhoneState> => api.get(`/api/phone/state${since !== undefined ? `?since=${since}` : ""}`),
  choices: (): Promise<{ ready: boolean; slot?: string; scene?: Scene; options?: Choice[]; busy?: { id: string; first: string; what: string }[] }> =>
    api.get("/api/phone/choices"),
  choose: (index: number, crew?: string[], act?: string): Promise<{ lines: Line[]; chips: Chip[] }> =>
    api.post("/api/phone/choose", crew ? { index, crew, act } : { index }),
  today: (): Promise<Today> => api.get("/api/phone/today"),
  episodes: (): Promise<EpisodeGuide> => api.get("/api/phone/episodes"),
  scene: (): Promise<SceneView> => api.get("/api/phone/scene"),
  ladder: (scope = "school"): Promise<LadderView> => api.get(`/api/phone/ladder?scope=${encodeURIComponent(scope)}`),
  sceneIntro: (via: string, to: string): Promise<{ lines: Line[]; chips: Chip[]; scene: SceneView }> => api.post("/api/phone/scene/intro", { via, to }),
  scenePlan: (id: string): Promise<{ note: string }> => api.post("/api/phone/scene/plan", { with: id }),
  sceneRumor: (id: string, what: string): Promise<{ lines: Line[]; chips: Chip[]; scene: SceneView }> => api.post("/api/phone/scene/rumor", { id, what }),
  // the editor (only while it's on)
  editor: (): Promise<{ schema: EdSchema; people: EdPersonRow[] }> => api.get("/api/phone/editor"),
  editorPerson: (id: string): Promise<EdPerson> => api.get(`/api/phone/editor/person/${encodeURIComponent(id)}`),
  editorSavePerson: (id: string, body: any): Promise<EdPerson> => api.post(`/api/phone/editor/person/${encodeURIComponent(id)}`, body),
  editorPair: (a: string, b: string): Promise<EdPair> => api.get(`/api/phone/editor/pair/${encodeURIComponent(a)}/${encodeURIComponent(b)}`),
  editorSavePair: (a: string, b: string, body: any): Promise<EdPair> =>
    api.post(`/api/phone/editor/pair/${encodeURIComponent(a)}/${encodeURIComponent(b)}`, body),
  later: (index: number): Promise<{ queued: string; note: string }> => api.post("/api/phone/later", { index }),
  moment: (id: string, index: number | null, extra: Record<string, any> = {}): Promise<{ lines: Line[]; chips: Chip[]; minigame?: any }> =>
    api.post(`/api/phone/moment/${id}`, index === null ? { ...extra } : { index, ...extra }),
  minigames: (): Promise<{ games: MiniGameRow[]; recent: any[] }> => api.get("/api/phone/minigames"),
  minigameStart: (game: string): Promise<any> => api.post("/api/phone/minigame/start", { game }),
  minigameFinish: (session: string, score: number, max: number, stats?: any): Promise<{ result: any; rewarded: boolean; lines: Line[]; chips: Chip[] }> =>
    api.post("/api/phone/minigame/finish", { session, score, max, stats }),
  minigameQuit: () => api.post("/api/phone/minigame/quit", {}),
  classes: (): Promise<ClassesView> => api.get("/api/phone/classes"),
  // time: until = "decision" (next choice), "moment" (live until something happens), "day" | "week"
  advance: (until: string): Promise<any> => api.post("/api/story/advance", { until }),
  job: (): Promise<any> => api.get("/api/sim/job"),
  control: (patch: any) => api.post("/api/story/control", patch),
  storyContinue: (): Promise<{ moment: Moment | null; note: string | null }> => api.post("/api/story/schedule/continue", {}),
  // your episode order: what's up next, move one ahead of another, play one next, undo
  order: (): Promise<UpNext> => api.get("/api/story/order"),
  orderMove: (sid: string, before: string): Promise<UpNext> => api.post("/api/story/order/move", { sid, before }),
  orderNext: (sid: string): Promise<{ ok: boolean }> => api.post("/api/story/order/next", { sid }),
  orderClear: (sid?: string): Promise<UpNext> => api.post("/api/story/order/clear", sid ? { sid } : {}),
  schedule: (): Promise<ScheduleView> => api.get("/api/story/schedule"),
  scheduleReport: (days: number): Promise<ScheduleReport> => api.get(`/api/story/schedule/report?days=${days}&fmt=both`),
  addPrompt: (ask: string): Promise<{ prompt: string; chars: number; suggestions: string[]; checked: boolean; last_check: { coverage: Coverage } | null }> =>
    api.get(`/api/story/add/prompt?ask=${encodeURIComponent(ask)}`),
  addPreview: (text: string): Promise<AddPreview> => api.post("/api/story/add/preview", { text }),
  weave: (pack: string, after: string | null, ask: string): Promise<{ prompt: string; chars: number; pack_name: string; where: string; after: string | null; next: string | null }> =>
    api.get(`/api/story/add/weave?pack=${encodeURIComponent(pack)}&after=${encodeURIComponent(after || "")}&ask=${encodeURIComponent(ask)}`),
  // play a storyline start to finish, on a copy of your story
  playStart: (pack: string, from?: string): Promise<PlayStep> => api.post("/api/story/playline/start", { pack, from }),
  playChoose: (index: number | null): Promise<PlayRead> => api.post("/api/story/playline/choose", { index }),
  playNext: (): Promise<PlayStep> => api.post("/api/story/playline/next", {}),
  playStop: () => api.post("/api/story/playline/stop", {}),
  addPack: (text: string) => api.post("/api/dialogue/packs", { text }),
  threads: (): Promise<{ threads: ThreadSummary[] }> => api.get("/api/phone/threads"),
  thread: (tid: string): Promise<Thread> => api.get(`/api/phone/thread/${encodeURIComponent(tid)}`),
  reply: (tid: string, msg: string, index: number): Promise<{ thread: Thread }> => api.post(`/api/phone/thread/${encodeURIComponent(tid)}/reply`, { msg, index }),
  text: (to: string, kind: string): Promise<{ thread: Thread; result: string; plans: boolean }> => api.post("/api/phone/text", { to, kind }),
  say: (tid: string, body: { text?: string; suggestion?: number }): Promise<{ thread: Thread; result: string; why: string | null; plans: boolean }> =>
    api.post(`/api/phone/thread/${encodeURIComponent(tid)}/say`, body),
  flirting: (): Promise<{ guide: { t: string; d: string }[]; stages: string[] }> => api.get("/api/phone/flirting"),
  contacts: (): Promise<{ groups: { name: string; people: ContactRow[] }[]; parents: { id: string; name: string; full: string; parent: boolean }[] }> => api.get("/api/phone/contacts"),
  contact: (cid: string): Promise<Contact> => api.get(`/api/phone/contact/${encodeURIComponent(cid)}`),
  pets: (): Promise<{ pets: Pet[]; kids: { id: string; first: string; me: boolean }[]; approved: any; asked: number | null;
    species: Record<string, { label: string; breeds: string[]; coats: string[]; duties: { id: string; label: string; hint: string; when: string }[] }> }> => api.get("/api/phone/pets"),
  petSetup: (pid: string, duties: Record<string, string>): Promise<Pet> => api.post(`/api/phone/pet/${pid}/setup`, { duties }),
  // quick activities (cuddle, treat, feed, brush) happen now; timed ones (walk, park, play, train) happen now if it's your move ({now:true}), else get planned
  petDo: (pid: string, activity: string, opts: { now?: boolean; trick?: string } = {}): Promise<any> => api.post(`/api/phone/pet/${pid}/do`, { activity, ...opts }),
  petAsk: (species: string): Promise<{ yes: boolean; p: number; reason: string | null; text: string }> => api.post("/api/phone/pet/ask", { species }),
  petAdopt: (species: string, name: string, breed?: string, coat?: string): Promise<Pet> => api.post("/api/phone/pet/adopt", { species, name, breed, coat }),
  net: (): Promise<{ lan: boolean; port: number; urls: string[]; host: string }> => api.get("/api/net"),
};

/** Navigate inside the phone app: pgo("phone/thread/family") -> #/m/phone/thread/family */
export function pgo(path: string) {
  window.location.hash = `#/m${path ? "/" + path : ""}`;
}
