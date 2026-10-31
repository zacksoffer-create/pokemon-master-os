// Story: where you are, what's happening, and what you do next. The heart of the phone app.
import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { Chip, Choice, FeedItem, Line, Moment, phoneApi, pgo } from "./api";
import { Portrait, Scene } from "./art";
import { PIcon } from "./icons";
import { buzz, cx, errText, Face, Lines, money, Sheet, StatChips, useWho } from "./kit";
import { usePhone } from "./PhoneContext";

const KICKER: Record<string, string> = {
  first_day: "New chapter", cut: "Tryouts", injury: "Injury", benched: "Playing time", offer: "Recruiting", college_decision: "The big decision",
  game_day: "Game day", sibling_leaves: "Family", rumor: "People are talking", heartbreak: "Heartbreak", summer: "Summer", graduation: "Graduation",
  college_arrival: "New chapter", year_review: "Looking back", asked_out: "Romance", asked_to_dance: "Romance", mlb_draft: "MLB Draft",
  draft_passed: "MLB Draft", story_end: "The end of the beginning",
};
const CAT: Record<string, string> = {
  social: "Friends", romance: "Romance", academic: "School", conflict: "Drama", leisure: "Downtime", family: "Family", activity: "Getting better",
  obligation: "Commitments", achievement: "Big moves", risk: "Risky", staff: "Mentoring",
};
const ACTION_ICON: Record<string, string> = {
  study: "book", study_at_lunch: "book", practice_skill: "ball", train: "bolt", hobby: "sparkle", rest: "moon", sit_alone: "moon",
  attend_practice: "ball", attend_event: "star", work_shift: "work", sign_up: "star", quit_group: "x", sneak_out: "moon", prank: "warn",
  family_time: "home", pet_time: "paw", pet_walk: "walk", pet_park: "tree", pet_play: "ballplay", pet_train: "wand", throw_party: "sparkle",
  go_to_party: "sparkle", spectate: "trophy", confront: "bolt", spread_rumor: "chat", gossip: "chat", chat_online: "chat",
};
const CAT_ICON: Record<string, string> = { social: "people", romance: "heart", academic: "book", conflict: "bolt", leisure: "moon", family: "home",
  activity: "ball", obligation: "clock", achievement: "star", risk: "warn", staff: "people" };
const PERSON_KEYS = ["other", "sibling", "roommate", "coach", "origin", "best_friend"];

type Outcome = { lines: Line[]; chips: Chip[]; title?: string };

export default function StoryTab() {
  const { state, refresh, toast, setBusy: setGlobalBusy } = usePhone();
  const lab = useStore();
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [choiceKey, setChoiceKey] = useState("");
  const [more, setMore] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [recap, setRecap] = useState<FeedItem[] | null>(null);
  const [skip, setSkip] = useState<{ done: number; days: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showToday, setShowToday] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const key = state ? `${state.day}:${state.scene.phase}:${state.last_event}` : "";
  const wantChoices = !!state && state.decision_ready && state.moments.length === 0;

  useEffect(() => {
    if (!wantChoices || choiceKey === key) return;
    let off = false;
    setChoiceKey(key);
    setChoices(null);
    setMore(false);
    phoneApi.choices().then((r) => {
      if (!off) setChoices(r.ready ? r.options || [] : []);
    }).catch((e) => !off && toast(errText(e), "bad"));
    return () => { off = true; };
  }, [wantChoices, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;
  const s = state;
  const moment = s.moments[0];
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setGlobalBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      if (alive.current) setBusy(false);
      setGlobalBusy(false);
    }
  };

  const choose = (c: Choice) => run(async () => {
    buzz();
    const r = await phoneApi.choose(c.index);
    setChoices(null);
    setOutcome({ lines: r.lines.length ? r.lines : [{ id: -1, type: "none", text: "The time slips by. Nothing much to report." }], chips: r.chips, title: c.text });
    await refresh();
  });

  const pickMoment = (m: Moment, index: number | null) => run(async () => {
    buzz();
    const r = await phoneApi.moment(m.id, index);
    setOutcome({ lines: r.lines, chips: r.chips, title: m.title });
    await refresh();
  });

  const next = () => run(async () => {
    const j = await phoneApi.advance("decision");
    if (j.status === "failed") throw new Error(j.error || "the day didn't load");
    await refresh();
  });

  const skipAhead = () => run(async () => {
    const before = s.last_event;
    let j = await phoneApi.advance("moment");
    setSkip({ done: j.done || 0, days: j.days || 0 });
    while (j.status === "running") {
      await new Promise((r) => setTimeout(r, 600));
      j = await phoneApi.job();
      if (alive.current) setSkip({ done: j.done || 0, days: j.days || 0 });
    }
    setSkip(null);
    if (j.status === "failed") throw new Error(j.error || "something went wrong while time passed");
    const st = await phoneApi.state(before);
    setRecap(st.feed.slice().reverse());
    await refresh();
    lab.refresh();
  });

  const today = s.feed.filter((f) => f.date === s.date);
  const rest = choices ? choices.slice(5) : [];

  return (
    <div className="ph-story">
      <div className={cx("ph-hero", moment && "compact")}>
        <Scene art={s.scene.art} season={s.scene.season} phase={s.scene.phase} className="ph-hero-art" />
        <div className="ph-hero-fade" />
        <TopBar />
        <div className="ph-hero-text" key={key}>
          <div className="ph-kicker">{s.scene.time}{s.scene.break ? ` · ${s.scene.break}` : ""}</div>
          <h1>{s.scene.title}</h1>
          {!moment && <p>{s.scene.line}</p>}
        </div>
      </div>

      <div className="ph-pad ph-story-b">
        {s.queued && (
          <div className="ph-planned"><PIcon name="clock" size={16} /> Planned: {s.queued.label}</div>
        )}

        {skip ? (
          <SkipProgress done={skip.done} />
        ) : moment ? (
          <MomentCard m={moment} more={s.moments.length - 1} busy={busy} onPick={pickMoment} />
        ) : s.decision_ready ? (
          <div className="ph-choices">
            <div className="ph-section-t">What do you do?</div>
            {choices === null ? (
              <div className="ph-choice ghost-load"><span className="ph-spinner small" /> Thinking it over…</div>
            ) : choices.length === 0 ? (
              <button className="ph-btn primary block" onClick={next} disabled={busy}>Keep going</button>
            ) : (
              <>
                {choices.slice(0, 5).map((c, i) => <ChoiceCard key={c.index} c={c} gut={i === 0} busy={busy} onPick={choose} delay={i} />)}
                {rest.length > 0 && !more && (
                  <button className="ph-more" onClick={() => setMore(true)}>More options ({rest.length})</button>
                )}
                {more && rest.map((c, i) => <ChoiceCard key={c.index} c={c} busy={busy} onPick={choose} delay={i} small />)}
                <button className="ph-link center" onClick={next} disabled={busy}>Let it play out</button>
              </>
            )}
          </div>
        ) : (
          <div className="ph-next">
            <button className="ph-btn primary block big" onClick={next} disabled={busy}>
              {busy ? <span className="ph-spinner small light" /> : <>What's next <PIcon name="chevron" size={18} /></>}
            </button>
          </div>
        )}

        {!skip && !moment && (
          <button className="ph-skip" onClick={skipAhead} disabled={busy}>
            <PIcon name="skip" size={16} />
            <span><b>Live until something happens</b><small>Your life plays out on its own until there's something for you.</small></span>
          </button>
        )}

        <div className="ph-today">
          <button className="ph-today-h" onClick={() => setShowToday(!showToday)}>
            <span>{today.length ? "Today so far" : "Recently"}</span>
            <span className="ph-dim">{showToday ? "Hide" : `${(today.length || Math.min(6, s.feed.length))}`}</span>
          </button>
          {showToday && (
            <div className="ph-feed">
              {(today.length ? today : s.feed.slice(0, 6)).map((f) => <FeedRow key={f.id} f={f} />)}
              {!s.feed.length && <div className="ph-dim">Nothing yet. Your story is just starting.</div>}
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!outcome} onClose={() => setOutcome(null)} title={outcome?.title} className="ph-outcome">
        {outcome && (
          <>
            <Lines lines={outcome.lines} />
            <StatChips chips={outcome.chips} />
            <button className="ph-btn primary block" onClick={() => setOutcome(null)}>Continue</button>
          </>
        )}
      </Sheet>

      <Sheet open={!!recap} onClose={() => setRecap(null)} title="While you were living it" className="ph-recap">
        {recap && (
          <>
            {recap.length === 0 ? <p className="ph-dim">A quiet stretch. Nothing worth writing home about.</p> : (
              <div className="ph-feed">
                {recap.slice(-30).map((f) => <FeedRow key={f.id} f={f} showDate />)}
                {recap.length > 30 && <div className="ph-dim ph-center">…and {recap.length - 30} more things before that.</div>}
              </div>
            )}
            <button className="ph-btn primary block" onClick={() => setRecap(null)}>Got it</button>
          </>
        )}
      </Sheet>
    </div>
  );
}

function TopBar() {
  const { state } = usePhone();
  if (!state) return null;
  const me = state.me;
  const energy = me.needs?.energy ?? me.energy ?? 50;
  const moodWord = me.mood >= 75 ? "great" : me.mood >= 58 ? "good" : me.mood >= 42 ? "okay" : me.mood >= 28 ? "low" : "rough";
  return (
    <div className="ph-topbar">
      <div className="ph-glass">
        <b>{state.weekday.slice(0, 3)}</b>
        <span>{state.date.replace(/^\w+,\s*/, "")}</span>
      </div>
      <div className="ph-topbar-r">
        <div className="ph-glass" title={`Energy ${energy}`}>
          <PIcon name="bolt" size={14} />
          <span className="ph-mini"><i style={{ width: `${energy}%` }} className={energy < 30 ? "low" : ""} /></span>
        </div>
        <div className={cx("ph-glass", "mood-" + moodWord)} title="Mood">{moodWord}</div>
        <div className="ph-glass"><PIcon name="cash" size={14} /> {money(me.money)}</div>
      </div>
    </div>
  );
}

function ChoiceCard({ c, gut, busy, onPick, delay = 0, small }: { c: Choice; gut?: boolean; busy: boolean; onPick: (c: Choice) => void; delay?: number; small?: boolean }) {
  return (
    <button className={cx("ph-choice", small && "compact", "cat-" + c.category)} disabled={busy} onClick={() => onPick(c)} style={{ animationDelay: `${delay * 60}ms` }}>
      <span className="ph-choice-i">
        {c.target ? <Face id={c.target} size={small ? 34 : 42} /> : <span className="ph-icon-bubble"><PIcon name={ACTION_ICON[c.action] || CAT_ICON[c.category] || "star"} size={small ? 18 : 21} /></span>}
      </span>
      <span className="ph-choice-m">
        <b>{c.text}</b>
        <span className="ph-choice-s">
          {CAT[c.category] || c.category}
          {c.risk >= 0.3 && <em className="risky">risky</em>}
          {gut && <em className="gut"><PIcon name="sparkle" size={11} /> your gut</em>}
        </span>
      </span>
      <PIcon name="chevron" size={18} className="ph-choice-c" />
    </button>
  );
}

function MomentCard({ m, more, busy, onPick }: { m: Moment; more: number; busy: boolean; onPick: (m: Moment, i: number | null) => void }) {
  const who = useWho();
  const pid = PERSON_KEYS.map((k) => m.ctx?.[k]).find((v) => typeof v === "string" && who(v));
  const person = pid ? who(pid) : null;
  const mood = m.kind === "asked_out" || m.kind === "asked_to_dance" ? "flirty" : m.kind === "heartbreak" || m.kind === "cut" ? "sad" : m.kind === "rumor" ? "surprised" : "neutral";
  return (
    <div className={cx("ph-moment", "k-" + m.kind)}>
      <div className="ph-moment-k">{KICKER[m.kind] || "A moment"}{more > 0 && <span> · {more} more after this</span>}</div>
      {person && (
        <div className="ph-moment-who">
          <Portrait look={person.look} size={88} mood={mood as any} color={person.color} name={person.first} />
          <span>{person.name}</span>
        </div>
      )}
      <h2>{m.title}</h2>
      <p className="ph-moment-t">{m.text}</p>
      <div className="ph-moment-c">
        {m.choices.map((c, i) => (
          <button key={i} className="ph-mchoice" disabled={busy} onClick={() => onPick(m, i)} style={{ animationDelay: `${i * 70}ms` }}>
            <b>{c.label}</b>
            {c.hint && <span>{c.hint}</span>}
          </button>
        ))}
      </div>
      {m.choices.length > 1 && (
        <button className="ph-link center" disabled={busy} onClick={() => onPick(m, null)}>Let it happen</button>
      )}
    </div>
  );
}

function SkipProgress({ done }: { done: number }) {
  return (
    <div className="ph-skipping">
      <div className="ph-skipping-orb"><PIcon name="clock" size={26} /></div>
      <b>Living it out…</b>
      <span className="ph-dim">{done > 0 ? `${done} day${done === 1 ? "" : "s"} so far` : "Here we go"}</span>
      <div className="ph-indeterminate"><i /></div>
    </div>
  );
}

function FeedRow({ f, showDate }: { f: FeedItem; showDate?: boolean }) {
  return (
    <div className="ph-feed-row" onClick={() => f.with[0] && pgo(`phone/contact/${f.with[0]}`)}>
      {f.with[0] ? <Face id={f.with[0]} size={30} /> : <span className="ph-feed-dot" />}
      <div>
        <p>{f.text}</p>
        {showDate && <small className="ph-dim">{f.date}</small>}
      </div>
    </div>
  );
}
