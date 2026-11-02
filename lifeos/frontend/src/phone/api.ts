// Phone app API: typed wrappers around /api/phone/* and the story endpoints the phone uses.
import { api } from "../api";

export type Look = {
  skin: string; hair: string; hair_color: string; eyes: string; facial_hair: string; glasses: boolean; freckles: boolean;
};
export type Mood = "happy" | "neutral" | "sad" | "angry" | "flirty" | "surprised" | "tired";

export type Scene = { art: string; title: string; line: string; phase: string; season: string; weekend: boolean; break: string | null; time: string };
export type FeedItem = { id: number; date: string; slot: string; type: string; outcome: string; text: string; with: string[]; importance: number };
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
  control: { focus: string; ask_invites: boolean; ask_romance: boolean; stop_before_games: boolean; stop_on_big: boolean; auto_lunch?: boolean; class_games?: boolean };
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
  last: { text: string; at: string; from: string } | null; location: string; role: string;
};
export type Contact = ContactRow & {
  bio: string; archetype: string; pronouns: string; teams: string[]; school: string; since: string | null; feel: string; seems: string;
  trust: number; respect: number; familiarity: number; memories: { text: string; date: string; valence: number }[];
  shared: { id: number; date: string; text: string }[]; text_options: { kind: string; label: string }[]; partner_of: string | null; vibe?: Vibe;
};

export type MiniGameRow = { id: string; title: string; label: string; blurb: string; icon: string; ready: boolean; available: boolean; why: string; rewarded_today: boolean; best: number | null };
export type ClassRow = { id: string; name: string; subject: string; teacher: string; honors: boolean; pct: number; letter: string; quizzes: number; quiz_avg: number | null;
  games: number; games_won: number };
export type ClassesView = { gpa: number; year: string; classes: ClassRow[]; upcoming: { name: string; date: string; in_days: number; weight: number }[]; tests_played: number };
export const phoneApi = {
  state: (since?: number): Promise<PhoneState> => api.get(`/api/phone/state${since !== undefined ? `?since=${since}` : ""}`),
  choices: (): Promise<{ ready: boolean; slot?: string; scene?: Scene; options?: Choice[] }> => api.get("/api/phone/choices"),
  choose: (index: number, crew?: string[], act?: string): Promise<{ lines: Line[]; chips: Chip[] }> =>
    api.post("/api/phone/choose", crew ? { index, crew, act } : { index }),
  today: (): Promise<Today> => api.get("/api/phone/today"),
  episodes: (): Promise<EpisodeGuide> => api.get("/api/phone/episodes"),
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
