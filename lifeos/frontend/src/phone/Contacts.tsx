// The Contacts app: everyone you know, grouped the way you'd think about them, and a profile for each.
import React, { useEffect, useState } from "react";
import { Contact, ContactRow, phoneApi, pgo } from "./api";
import { usePhone } from "./PhoneContext";
import { Portrait } from "./art";
import { Chevron, Hearts, LabelBadge, ParentAvatar, labelTone, moodFor, pendingCompose } from "./MessagesUtil";

type Book = Awaited<ReturnType<typeof phoneApi.contacts>>;

export function ContactsList() {
  const [book, setBook] = useState<Book | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    phoneApi.contacts().then(setBook).catch((e) => setErr(e.message));
  }, []);
  if (err) return <div className="pm-empty">{err}</div>;
  if (!book) return <div className="pm-list"><div className="pm-thread-loading"><span /><span /><span /></div></div>;
  const groups = book.groups.slice();
  if (!groups.some((g) => g.name === "Family") && book.parents.length) groups.unshift({ name: "Family", people: [] });
  const total = groups.reduce((n, g) => n + g.people.length, 0);
  return (
    <div className="pm-contacts">
      <div className="pm-contacts-count">{total} people you know</div>
      {groups.map((g) => (
        <section key={g.name} className="pm-section">
          <h3 className="pm-section-h">{g.name}</h3>
          <div className="pm-card-list">
            {g.name === "Family" && book.parents.map((p) => (
              <button key={p.id} className="pm-crow" onClick={() => pgo("phone/thread/family")}>
                <ParentAvatar id={p.id} name={p.name} size={44} />
                <span className="pm-crow-main">
                  <b>{p.name}</b>
                  <small>{p.full} · family chat</small>
                </span>
                <span className="pm-crow-go"><Chevron dir="right" /></span>
              </button>
            ))}
            {g.people.map((c) => <ContactLine key={c.id} c={c} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function ContactLine({ c }: { c: ContactRow }) {
  const label = c.label === "stranger" ? "acquaintance" : c.label;
  return (
    <button className="pm-crow" onClick={() => pgo(`phone/contact/${c.id}`)}>
      <span className="pm-crow-av">
        <Portrait look={c.look} name={c.first} color={c.color} size={44} mood={moodFor(c)} />
        {c.unread > 0 && <span className="pm-crow-unread">{c.unread}</span>}
      </span>
      <span className="pm-crow-main">
        <b>{c.name}</b>
        <small>
          <LabelBadge label={label} crush={c.crush} partner={c.partner} />
          <span className="pm-crow-year">{c.year_label}</span>
        </small>
      </span>
      <span className="pm-crow-side">
        <Hearts n={c.hearts} />
        {!c.has_number && <span className="pm-nonum" title="You don't have their number">no number</span>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------------------- profile

export function ContactProfile({ cid }: { cid: string }) {
  const { state } = usePhone();
  const [c, setC] = useState<Contact | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setC(null);
    phoneApi.contact(cid).then(setC).catch((e) => setErr(e.message));
  }, [cid]);
  const back = () => (window.history.length > 1 ? window.history.back() : pgo("phone/contacts"));
  if (err) return <div className="pm-profile"><TopBar onBack={back} /><div className="pm-empty">{err}</div></div>;
  if (!c) return <div className="pm-profile"><TopBar onBack={back} /><div className="pm-thread-loading"><span /><span /><span /></div></div>;
  const tone = labelTone(c.label, c.crush, c.partner);
  // texts live in the conversation; "Recently" is for things that happened between you
  const recent = c.shared.filter((s) => !/^You texted /.test(s.text));
  const label = c.label === "stranger" ? "acquaintance" : c.label;
  const myFirst = state?.me?.first;
  const dating = c.partner ? "You're dating" : c.partner_of ? (c.partner_of === myFirst ? "You're dating" : `Dating ${c.partner_of}`) : null;
  const message = (kind?: string) => {
    if (kind) {
      pendingCompose.tid = `dm:${c.id}`;
      pendingCompose.kind = kind;
    }
    pgo(`phone/thread/dm:${c.id}`);
  };
  return (
    <div className={`pm-profile pt-${tone}`}>
      <TopBar onBack={back} />
      <div className="pm-hero">
        <div className="pm-hero-glow" />
        <Portrait look={c.look} name={c.first} color={c.color} size={128} mood={moodFor(c)} />
        <h2>{c.name}</h2>
        <div className="pm-hero-sub">
          {c.year_label}{c.pronouns ? ` · ${c.pronouns}` : ""}
        </div>
        <div className="pm-hero-badges">
          <LabelBadge label={label} crush={c.crush} partner={c.partner} />
          {dating && !c.partner && <span className="pm-badge plain">{dating}</span>}
        </div>
        {c.has_number ? (
          <div className="pm-hero-actions">
            <button className="pm-act primary" onClick={() => message()}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 3 13.5z" fill="currentColor" /></svg>
              Message
            </button>
          </div>
        ) : (
          <div className="pm-nonum-card">You don't have {c.first}'s number yet. Hang out, sit together at lunch or get closer and you'll swap numbers.</div>
        )}
      </div>

      {c.has_number && c.text_options.length > 0 && (
        <div className="pm-card">
          <div className="pm-card-h">Text {c.first}</div>
          <div className="pm-chips wrap">
            {c.text_options.map((o) => (
              <button key={o.kind} className="pm-chip" onClick={() => message(o.kind)}>{o.label}</button>
            ))}
          </div>
        </div>
      )}

      <div className="pm-card">
        <div className="pm-read">
          <div><span>How you feel</span><b>{c.feel}</b></div>
          <div><span>How they seem</span><b>{c.seems}</b></div>
        </div>
        <div className="pm-meters">
          <Meter label="Friendship" value={c.affection} min={-100} max={100} tone="friend" />
          <Meter label="Trust" value={c.trust} min={-100} max={100} tone="trust" />
          <Meter label="Respect" value={c.respect} min={-100} max={100} tone="respect" />
          {c.attraction > 5 && <Meter label="Attraction" value={c.attraction} min={0} max={100} tone="love" />}
          {c.rivalry > 5 && <Meter label="Rivalry" value={c.rivalry} min={0} max={100} tone="rival" />}
        </div>
        <div className="pm-fineprint">This is your read on {c.first}. You can't see inside anyone's head.</div>
      </div>

      <div className="pm-card pm-facts">
        {c.since && <Fact k="Known since" v={monthYear(c.since)} />}
        <Fact k="School" v={c.year_label} />
        {c.teams.length > 0 && <Fact k="Teams & clubs" v={c.teams.join(", ")} />}
        {c.bio && <p className="pm-bio">{c.bio}</p>}
      </div>

      {c.memories.length > 0 && (
        <div className="pm-card">
          <div className="pm-card-h">Moments together</div>
          <ul className="pm-memories">
            {c.memories.map((m, i) => (
              <li key={i} className={m.valence > 0.15 ? "good" : m.valence < -0.15 ? "bad" : ""}>
                <span>{m.text}</span>
                <small>{m.date}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recent.length > 0 && (
        <div className="pm-card">
          <div className="pm-card-h">Recently</div>
          <ul className="pm-recent">
            {recent.map((s) => (
              <li key={s.id}>
                <span>{s.text}</span>
                <small>{s.date}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}

const MONTH_FULL: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July",
  Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
function monthYear(date: string) {
  const m = /(\w{3}) \d{1,2}, (\d{4})/.exec(date);
  return m ? `${MONTH_FULL[m[1]] || m[1]} ${m[2]}` : date;
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <header className="pm-profile-top">
      <button className="pm-back" onClick={onBack} aria-label="Back"><Chevron /><span>Back</span></button>
    </header>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="pm-fact">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

function Meter({ label, value, min, max, tone }: { label: string; value: number; min: number; max: number; tone: string }) {
  const v = Math.max(min, Math.min(max, value));
  const diverging = min < 0;
  const pct = ((v - min) / (max - min)) * 100;
  const zero = diverging ? ((0 - min) / (max - min)) * 100 : 0;
  const left = diverging ? Math.min(zero, pct) : 0;
  const width = diverging ? Math.abs(pct - zero) : pct;
  return (
    <div className={`pm-meter tone-${tone}${v < 0 ? " neg" : ""}`}>
      <div className="pm-meter-top">
        <span>{label}</span>
        <b>{Math.round(v)}</b>
      </div>
      <div className="pm-meter-track">
        {diverging && <i className="pm-meter-zero" style={{ left: `${zero}%` }} />}
        <div className="pm-meter-fill" style={{ left: `${left}%`, width: `${Math.max(width, v === 0 ? 0 : 1.5)}%` }} />
      </div>
    </div>
  );
}
