// Me: who you are right now, how you're doing, and how you want to play.
import React, { useState } from "react";
import { phoneApi } from "./api";
import { Portrait } from "./art";
import { PIcon } from "./icons";
import { Bar, cx, errText, money } from "./kit";
import { usePhone } from "./PhoneContext";
import ClassesCard from "./ClassesCard";
import DialogueCard from "./DialogueCard";
import { STANDALONE, StoryFilesCard } from "./StoryFiles";

const FOCUS: [string, string, string, string][] = [
  ["balanced", "Balanced", "star", "No push. You follow your own personality."],
  ["athletics", "Athletics", "ball", "Practice, training, games, tryouts."],
  ["academics", "School", "book", "Studying and homework come first."],
  ["social", "Friends", "people", "Hanging out, parties, meeting people."],
  ["romance", "Romance", "heart", "Flirting, dates, asking someone out."],
  ["family", "Family", "home", "Time at home, the pets, helping out."],
  ["rest", "Downtime", "moon", "Rest, hobbies, recharging."],
  ["work", "Work", "work", "Shifts and picking up hours."],
];
const TOGGLES: [string, string, string][] = [
  ["ask_invites", "Ask me about invitations", "Stop when a close friend invites you somewhere."],
  ["ask_romance", "Ask me when someone asks me out", "Romance is your call, not the dice."],
  ["stop_before_games", "Stop before my games", "Pick how you play on game day."],
  ["stop_on_big", "Stop for big moments", "Tryout results, offers, injuries, the big stuff."],
  ["auto_lunch", "Lunch on autopilot", "Sit with your usual table without stopping. Turn it off to pick every lunch."],
];
const CHAPTERS = ["Fr", "So", "Jr", "Sr", "C1", "C2", "C3"];

export default function MeTab() {
  const { state, refresh, toast } = usePhone();
  const [busy, setBusy] = useState<string | null>(null);
  if (!state) return null;
  const s = state;
  const me = s.me;
  const set = async (patch: any, key: string) => {
    setBusy(key);
    try {
      await phoneApi.control(patch);
      await refresh();
    } catch (e) {
      toast(errText(e), "bad");
    } finally {
      setBusy(null);
    }
  };
  const place = me.path?.kind === "pro" ? `Pro ball · ${me.path.team || "free agent"}` : me.school === "hchs" ? s.setting.school
    : me.school === "college" ? (me.path?.name || "College") : me.location === "hollow_creek" ? s.setting.town : "Away";
  const year = Math.min(7, s.progress.year);
  return (
    <div className="ph-me">
      <div className="ph-me-head">
        <div className="ph-me-bg" />
        <Portrait look={me.look} size={128} mood={me.mood >= 60 ? "happy" : me.mood < 35 ? "sad" : "neutral"} color={me.color} name={me.first} jersey={me.jersey || null} ring="#fff" />
        <h1>{me.name}</h1>
        <div className="ph-me-sub">{me.year_label} · {me.age} · {place}</div>
        {me.injured && <div className="ph-tag bad">Injured</div>}
      </div>

      <div className="ph-pad">
        <div className="ph-stats">
          <Stat icon="grad" label="GPA" value={me.gpa?.toFixed(2)} tone={me.gpa >= 3.3 ? "good" : me.gpa < 2.3 ? "bad" : ""} />
          <Stat icon="cash" label="Money" value={money(me.money)} />
          <Stat icon="people" label="Friends" value={me.friends} />
          <Stat icon="star" label="Popularity" value={Math.round(me.popularity)} />
        </div>

        <div className="ph-card">
          <div className="ph-card-t">How you're doing</div>
          <Bar label="Mood" value={me.mood} />
          <Bar label="Energy" value={me.needs?.energy ?? 0} tone="sky" />
          <Bar label="Stress" value={me.needs?.stress ?? 0} invert />
          <Bar label="Social" value={me.needs?.social ?? 0} tone="grape" />
          <Bar label="Fun" value={me.needs?.fun ?? 0} tone="sun" />
        </div>

        {s.squad && (
          <div className="ph-card ph-squad">
            <div className="ph-card-t row">
              <span>{s.squad.name[0].toUpperCase() + s.squad.name.slice(1)}</span>
              <span className="ph-dim">{s.squad.last ? `together ${s.squad.last}` : "your group"}</span>
            </div>
            <div className="ph-squad-faces">
              {s.squad.members.map((m) => (
                <span key={m.id}><Portrait look={m.look} size={46} name={m.first} /><small>{m.first}</small></span>
              ))}
            </div>
            <Bar label="How tight you are" value={s.squad.cohesion} tone="grape" />
            {s.squad.plan && (
              <p className="ph-squad-plan">{s.squad.plan.joined ? "You went: " : "Today: "}{s.squad.plan.label.toLowerCase()} {s.squad.plan.when}</p>
            )}
            {s.squad.jokes.length > 0 && <p className="ph-dim small">Inside jokes: {s.squad.jokes.join(" · ")}</p>}
            <p className="ph-dim small">Nothing to manage. They show up in your free time, and their group chat never needs an answer.</p>
          </div>
        )}

        {s.teams.length > 0 && (
          <div className="ph-card">
            <div className="ph-card-t">Your teams</div>
            {s.teams.map((t) => (
              <div key={t.id} className="ph-team">
                <span className="ph-icon-bubble"><PIcon name="ball" size={18} /></span>
                <div>
                  <b>{t.name}</b>
                  <small className="ph-dim">{[t.level === "jv" ? "JV" : "Varsity", t.position].filter(Boolean).join(" · ")}</small>
                </div>
                <span className="ph-team-r">
                  {t.record.w}-{t.record.l}
                  {t.mine && (t.mine.w !== t.record.w || t.mine.l !== t.record.l) && (
                    <small title="The games you played in this season">you {t.mine.w}-{t.mine.l}</small>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="ph-card">
          <div className="ph-card-t row"><span>Your seven years</span><span className="ph-dim">Year {year} of 7</span></div>
          <div className="ph-prog"><i style={{ width: `${Math.max(1.5, s.progress.pct)}%` }} /></div>
          <div className="ph-prog-l">
            {CHAPTERS.map((c, i) => <span key={c} className={cx(i + 1 < year && "done", i + 1 === year && "now")}>{c}</span>)}
          </div>
          {s.progress.complete && <p className="ph-dim small">The seven chapters are written. Your world keeps going if you do.</p>}
        </div>

        <div className="ph-section-t">Your focus</div>
        <p className="ph-dim small ph-tight">When you let things play out, your focus pulls you toward these kinds of choices. It nudges; it doesn't force.</p>
        <div className="ph-focus">
          {FOCUS.map(([k, l, icon, d]) => (
            <button key={k} className={cx("ph-focus-o", s.control.focus === k && "on")} disabled={busy === "focus"} onClick={() => set({ focus: k }, "focus")}>
              <PIcon name={icon} size={20} />
              <b>{l}</b>
              <small>{d}</small>
            </button>
          ))}
        </div>

        <ClassesCard />

        <div className="ph-section-t">When should the story stop?</div>
        <div className="ph-card ph-toggles">
          {TOGGLES.map(([k, l, d]) => {
            const on = !!(s.control as any)[k];
            return (
              <button key={k} className="ph-toggle" disabled={busy === k} onClick={() => set({ [k]: !on }, k)}>
                <span><b>{l}</b><small>{d}</small></span>
                <span className={cx("ph-switch", on && "on")}><i /></span>
              </button>
            );
          })}
        </div>

        <StoryFilesCard hasStory={!!state.active} />

        <DialogueCard />

        {!STANDALONE && (
          <div className="ph-links">
            <a className="ph-btn soft block" href="#/story"><PIcon name="laptop" size={17} /> Full dashboard (best on a computer)</a>
            <a className="ph-link center" href="#/overview">Back to the lab</a>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className={cx("ph-stat", tone)}>
      <PIcon name={icon} size={17} />
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}
