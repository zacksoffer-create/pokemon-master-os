// The Yearbook: one book a school year, like the real one. A cover, then chapters: you, the superlatives, the classes
// (everyone's portrait; the seniors' quotes and where they're going), the teams, clubs and the play, student life
// (homecoming court, the dances, the couples, the parties, the crowds), the year month by month, honors, and the
// signatures in the back. This year's book is live; past years are kept as they were. Anyone's name opens their card.
import React, { useEffect, useMemo, useState } from "react";
import { phoneApi, YbMini, YbSuper, YbTeam, YearbookPage, YearbookView, YearbookVolume } from "./api";
import { Portrait } from "./art";
import { cx, errText } from "./kit";
import { PersonSheet } from "./People";

const CHAPTERS: [string, string][] = [
  ["you", "You"], ["super", "Superlatives"], ["classes", "Classes"], ["sports", "Sports"], ["clubs", "Clubs"], ["life", "Student life"],
  ["year", "The year"], ["honors", "Honors"], ["sign", "Signatures"], ["recaps", "Season recaps"],
];
type Open = (id: string) => void;

function Face({ p, size = 40 }: { p: YbMini; size?: number }) {
  return <Portrait look={p.look} size={size} color={p.color} name={p.first} />;
}
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

export function YearbookScreen() {
  const [d, setD] = useState<YearbookView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [ch, setCh] = useState("you");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    setD(null);
    phoneApi.yearbook(year).then(setD).catch((e) => setErr(errText(e)));
  }, [year]);
  if (err) return <p className="ph-dim pp-pad">{err}</p>;
  if (!d) return <div className="ph-dim pp-pad"><span className="ph-spinner small" /> Opening the yearbook…</div>;
  const v = d.volume as YearbookVolume;
  const has = !!v && "title" in v;
  return (
    <div className="pp yb">
      {d.volumes.length > 1 && (
        <div className="pp-chips yb-vols">
          {d.volumes.map((x) => (
            <button key={x.year} className={cx("pp-chip", (year ?? d.volumes[0].year) === x.year && "on")} onClick={() => setYear(x.year)}>
              {x.title.replace("The Grizzly ", "")}{x.live ? " · now" : ""}
            </button>
          ))}
        </div>
      )}
      {has ? (
        <>
          <Cover v={v} small={ch !== "you"} />
          <div className="yb-chapters" role="tablist">
            {CHAPTERS.filter(([k]) => k !== "recaps" || d.recaps.length > 0).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={ch === k} className={cx("yb-ch", ch === k && "on")} onClick={() => setCh(k)}>{l}</button>
            ))}
          </div>
          {ch === "you" && <YouCh v={v} onOpen={setOpen} />}
          {ch === "super" && <SuperCh v={v} onOpen={setOpen} />}
          {ch === "classes" && <ClassesCh v={v} onOpen={setOpen} />}
          {ch === "sports" && <SportsCh v={v} onOpen={setOpen} />}
          {ch === "clubs" && <ClubsCh v={v} onOpen={setOpen} />}
          {ch === "life" && <LifeCh v={v} onOpen={setOpen} />}
          {ch === "year" && <YearCh v={v} />}
          {ch === "honors" && <HonorsCh v={v} onOpen={setOpen} />}
          {ch === "sign" && <SignCh v={v} onOpen={setOpen} />}
          {ch === "recaps" && d.recaps.map((p) => <Recap key={p.id} p={p} onOpen={setOpen} />)}
        </>
      ) : (
        <p className="ph-dim pp-pad">There's no yearbook for this year.</p>
      )}
      <PersonSheet id={open} onClose={() => setOpen(null)} onOpen={setOpen} />
    </div>
  );
}

function Cover({ v, small }: { v: YearbookVolume; small?: boolean }) {
  return (
    <section className={cx("yb-cover", small && "small")}>
      <div className="yb-cover-school">{v.school}</div>
      <h1>{v.title}</h1>
      <div className="yb-cover-sub">{v.label}</div>
      <div className="yb-cover-note">{v.live ? `Still being written · as of ${v.as_of.split(",").slice(1).join(",").trim()}` : "Closed when the next school year began"}
        {" · "}{v.students} students</div>
    </section>
  );
}

function Who({ p, note, onOpen, size = 30 }: { p: YbMini; note?: React.ReactNode; onOpen: Open; size?: number }) {
  return (
    <button className="yb-who" onClick={() => onOpen(p.id)}>
      <Face p={p} size={size} />
      <span><b>{p.name}</b>{note !== undefined ? <small>{note}</small> : <small>{p.year}</small>}</span>
    </button>
  );
}

function Faces({ ps, onOpen, size = 34, max = 30 }: { ps: YbMini[]; onOpen: Open; size?: number; max?: number }) {
  return (
    <div className="yb-faces">
      {ps.slice(0, max).map((p) => (
        <button key={p.id} className="yb-face" onClick={() => onOpen(p.id)} title={p.name}>
          <Face p={p} size={size} />
          <small>{p.first}</small>
        </button>
      ))}
    </div>
  );
}

function Sec({ h, children, sub }: { h: string; children: React.ReactNode; sub?: string }) {
  return (
    <section className="yb-page">
      <div className="yb-kicker">{h}</div>
      {sub && <p className="yb-sub">{sub}</p>}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------- you
function Spark({ h }: { h: { rank: number; of: number }[] }) {
  if (h.length < 2) return null;
  const W = 300, H = 60, n = h.length;
  const max = Math.max(...h.map((x) => x.of));
  const pts = h.map((x, i) => `${(i / (n - 1)) * W},${((x.rank - 1) / Math.max(1, max - 1)) * (H - 8) + 4}`).join(" ");
  return (
    <svg className="yb-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Your rank this year">
      <line x1="0" y1="4" x2={W} y2="4" className="yb-spark-top" />
      <polyline points={pts} />
    </svg>
  );
}

function YouCh({ v, onOpen }: { v: YearbookVolume; onOpen: Open }) {
  const y = v.you;
  const stats: [string, React.ReactNode, string?][] = [
    ["At school", y.rank ? `#${y.rank}` : "–", `of ${y.of}${y.best_rank && y.best_rank !== y.rank ? ` · best #${y.best_rank}` : ""}`],
    ["In your class", y.grade_rank ? `#${y.grade_rank}` : "–", `of ${y.grade_of}`],
    ["GPA", y.gpa.toFixed(2)],
    ["Friends", y.friends, y.new_friends.length ? `${y.new_friends.length} new` : undefined],
    ["Games", y.games, y.games ? `${y.wins} wins` : undefined],
    ["Scenes", y.scenes, "played"],
  ];
  return (
    <>
      <section className="yb-page yb-me">
        <div className="yb-me-top">
          <Face p={y} size={86} />
          <div>
            <div className="yb-kicker">{y.year}</div>
            <h2>{y.name}</h2>
            {y.known_for && <p className="yb-sub">{y.known_for}</p>}
            {y.partner && <p className="yb-sub">With {y.partner.first}</p>}
          </div>
        </div>
        <div className="yb-stats">
          {stats.map(([k, n, s]) => <div key={k} className="yb-stat"><b>{n}</b><span>{k}</span>{s && <small>{s}</small>}</div>)}
        </div>
        {y.history.length > 1 && (
          <div>
            <div className="pp-h">Your year on the ladder</div>
            {y.history.every((x) => x.rank === y.history[0].rank) ? (
              <p className="yb-steady">#{y.history[0].rank} every week from {y.history[0].date} to {y.history[y.history.length - 1].date}.</p>
            ) : (
              <>
                <Spark h={y.history} />
                <div className="yb-spark-l"><small>{y.history[0].date} · #{y.history[0].rank}</small><small>#{y.history[y.history.length - 1].rank} · {y.history[y.history.length - 1].date}</small></div>
              </>
            )}
          </div>
        )}
      </section>
      {(y.won.length > 0 || y.close.length > 0) && (
        <Sec h="Your superlatives">
          {y.won.length > 0 && <div className="yb-ribbons">{y.won.map((s) => <span key={s} className="yb-ribbon">★ {s}</span>)}</div>}
          {y.close.length > 0 && <p className="yb-sub">So close: {y.close.map((c) => `${ord(c.you)} for ${c.label}`).join(" · ")}</p>}
        </Sec>
      )}
      {y.teams.length > 0 && (
        <Sec h="Your seasons">
          {y.teams.map((t) => (
            <div key={t.team + t.level} className="pp-line"><b>{t.team}{t.level === "jv" ? " JV" : ""} · {t.record}</b><small>{t.games} games · {t.line}</small></div>
          ))}
        </Sec>
      )}
      {y.awards.length > 0 && (
        <Sec h="Your awards">
          <div className="yb-ribbons">{y.awards.map((a) => <span key={a.label} className="yb-ribbon blue">{a.label}{a.count > 1 ? ` ×${a.count}` : ""}</span>)}</div>
        </Sec>
      )}
      {y.dates.length > 0 && (
        <Sec h="Your dances">
          {y.dates.map((d) => <Who key={d.dance} p={d.with} note={d.dance} onOpen={onOpen} />)}
        </Sec>
      )}
      {y.new_friends.length > 0 && (
        <Sec h="Friends you made this year">
          <Faces ps={y.new_friends} onOpen={onOpen} size={44} />
        </Sec>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------- superlatives
function SupCard({ s, onOpen }: { s: YbSuper; onOpen: Open }) {
  return (
    <div className={cx("yb-sup2", s.yours && "mine")}>
      <small>{s.label}</small>
      <div className="yb-sup2-faces">
        <button onClick={() => onOpen(s.winner.id)}><Face p={s.winner} size={s.partner ? 46 : 58} /></button>
        {s.partner && <button onClick={() => onOpen(s.partner!.id)}><Face p={s.partner} size={46} /></button>}
      </div>
      <b>{s.winner.first}{s.partner ? ` & ${s.partner.first}` : ` ${s.winner.name.split(" ").slice(1).join(" ")}`}</b>
      <span className="yb-sup2-y">{s.partner ? "" : s.winner.year}</span>
      {s.yours ? <i className="win">that's you</i> : s.capped ? <i>you were #1 · two to a person</i> : s.you ? <i>you: {ord(s.you)}</i> : null}
      {s.runners.length > 0 && <em>then {s.runners.map((r) => r.first).join(", ")}</em>}
    </div>
  );
}

function SuperCh({ v, onOpen }: { v: YearbookVolume; onOpen: Open }) {
  return (
    <>
      <Sec h="The whole school" sub="Picked by the numbers. Nobody takes more than two.">
        <div className="yb-sup2-grid">{v.superlatives.map((s) => <SupCard key={s.key} s={s} onOpen={onOpen} />)}</div>
      </Sec>
      {v.classes.map((c) => (
        <Sec key={c.grade} h={`The ${c.label.toLowerCase()}' picks`}>
          {c.superlatives.map((s) => <Who key={s.key} p={s.winner} note={s.label + (s.yours ? " · you" : "")} onOpen={onOpen} />)}
        </Sec>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------- classes
function ClassesCh({ v, onOpen }: { v: YearbookVolume; onOpen: Open }) {
  const mine = v.classes.find((c) => c.students.some((s) => s.me));
  const [g, setG] = useState<number>(mine?.grade ?? v.classes[0]?.grade ?? 9);
  const [q, setQ] = useState("");
  const c = v.classes.find((x) => x.grade === g) ?? v.classes[0];
  const shown = useMemo(() => (c?.students || []).filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase())), [c, q]);
  if (!c) return null;
  return (
    <>
      <div className="pp-chips">
        {v.classes.map((x) => <button key={x.grade} className={cx("pp-chip", x.grade === g && "on")} onClick={() => setG(x.grade)}>{x.label} · {x.count}</button>)}
      </div>
      <input className="ph-input pp-search" type="search" placeholder="Find someone" value={q} onChange={(e) => setQ(e.target.value)} />
      {c.grade === 12 ? (
        <div className="yb-seniors">
          {shown.map((s) => (
            <button key={s.id} className={cx("yb-senior", s.me && "me")} onClick={() => onOpen(s.id)}>
              <Face p={s} size={64} />
              <span>
                <b>{s.name}</b>
                {s.badge && <i className="yb-badge">★ {s.badge}</i>}
                {s.line && <small>{s.line}</small>}
                {s.quote && <q>{s.quote}</q>}
                {s.next && <em>Next: {s.next}</em>}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="yb-grid">
          {shown.map((s) => (
            <button key={s.id} className={cx("yb-tile", s.me && "me")} onClick={() => onOpen(s.id)}>
              <Face p={s} size={62} />
              <b>{s.name}</b>
              {s.badge && <i className="yb-badge">★ {s.badge}</i>}
              {s.line && <small>{s.line}</small>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------- sports
function TeamPage({ t, onOpen }: { t: YbTeam; onOpen: Open }) {
  return (
    <section className="yb-page">
      <div className="yb-team-top">
        <div>
          <div className="yb-kicker">{t.live ? "This season" : "Final"}</div>
          <h2>{t.name}</h2>
          {t.coach && <p className="yb-sub">{t.coach}</p>}
        </div>
        <div className="yb-record">{t.record}</div>
      </div>
      {(t.post || t.hand) && (
        <div className="yb-ribbons">
          {t.hand && <span className={cx("yb-ribbon", t.hand.startsWith("Beat") ? "" : "gray")}>{t.hand}</span>}
          {t.post && <span className="yb-ribbon blue">{t.post.charAt(0).toUpperCase() + t.post.slice(1)}</span>}
        </div>
      )}
      {t.you_line && <p className="yb-sub"><b>You:</b> {t.you_line}</p>}
      {t.captains.length > 0 && <><div className="pp-h">Captains</div><Faces ps={t.captains} onOpen={onOpen} size={40} /></>}
      {t.leaders.length > 0 && (
        <>
          <div className="pp-h">Leaders</div>
          {t.leaders.map((l) => <Who key={l.who.id} p={l.who} note={`${l.line} · ${l.games} games`} onOpen={onOpen} />)}
        </>
      )}
      {t.awards.length > 0 && (
        <>
          <div className="pp-h">Awards</div>
          {Object.values(t.awards.reduce((m: Record<string, { who: YbMini; labels: string[] }>, a) => {
            (m[a.who.id] = m[a.who.id] || { who: a.who, labels: [] }).labels.push(a.label.replace(`${t.name} `, "Team "));
            return m;
          }, {})).map((x) => <Who key={x.who.id} p={x.who} note={x.labels.join(" · ")} onOpen={onOpen} size={26} />)}
        </>
      )}
      {t.games.length > 0 && (
        <>
          <div className="pp-h">The scoreboard</div>
          <div className="yb-board">
            {t.games.map((g, i) => (
              <div key={i} className={cx("yb-game", g.win ? "w" : "l", g.rival && "rival")}>
                <small>{g.date}</small>
                <span>{g.round ? <i>{g.round} · </i> : null}{g.rival ? "vs rival " : "vs "}{g.opp}</span>
                <b>{g.win ? "W" : "L"} {g.score}</b>
              </div>
            ))}
          </div>
        </>
      )}
      {t.roster.length > 0 && (
        <>
          <div className="pp-h">Varsity roster{t.jv ? ` · and ${t.jv} on JV` : ""}</div>
          <Faces ps={t.roster} onOpen={onOpen} size={34} />
        </>
      )}
    </section>
  );
}

function SportsCh({ v, onOpen }: { v: YearbookVolume; onOpen: Open }) {
  const first = v.sports.find((t) => t.you) ?? v.sports[0];
  const [id, setId] = useState(first?.id);
  const t = v.sports.find((x) => x.id === id) ?? first;
  if (!t) return <p className="ph-dim pp-pad">No seasons played yet this year.</p>;
  return (
    <>
      <div className="pp-chips">
        {v.sports.map((x) => (
          <button key={x.id} className={cx("pp-chip", x.id === t.id && "on")} onClick={() => setId(x.id)}>
            {x.name.replace("Guilford ", "")}{x.you ? " ★" : ""}
          </button>
        ))}
      </div>
      <TeamPage t={t} onOpen={onOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------- clubs
function ClubsCh({ v, onOpen }: { v: YearbookVolume; onOpen: Open }) {
  if (!v.clubs.length) return <p className="ph-dim pp-pad">No clubs yet.</p>;
  return (
    <>
      {v.clubs.map((c) => (
        <section key={c.id} className={cx("yb-page", c.you && "yb-mine")}>
          <div className="yb-kicker">{c.note || (c.kind === "club" ? "Club" : c.kind)}{c.you ? " · you're in it" : ""}</div>
          <h3 className="yb-h3">{c.name}</h3>
          {c.advisor && <p className="yb-sub">Advisor: {c.advisor}</p>}
          {c.highlights.length > 0 && <div className="yb-ribbons">{c.highlights.map((h) => <span key={h} className="yb-ribbon">{h}</span>)}</div>}
          <Faces ps={c.members} onOpen={onOpen} size={32} />
          {c.count > c.members.length && <small className="ph-dim">and {c.count - c.members.length} more</small>}
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------- student life
function Pair({ a, b, onOpen, note }: { a: YbMini; b: YbMini; onOpen: Open; note?: string }) {
  return (
    <div className="yb-pair">
      <button onClick={() => onOpen(a.id)}><Face p={a} size={34} /></button>
      <button onClick={() => onOpen(b.id)}><Face p={b} size={34} /></button>
      <span><b>{a.first} & {b.first}</b>{note && <small>{note}</small>}</span>
    </div>
  );
}

function LifeCh({ v, onOpen }: { v: YearbookVolume; onOpen: Open }) {
  const L = v.life;
  return (
    <>
      {(L.court.king || L.court.queen) && (
        <Sec h="Homecoming court" sub={`Crowned from the ${L.court_class.toLowerCase()}.`}>
          <div className="yb-court">
            {L.court.king && <button onClick={() => onOpen(L.court.king!.id)}><Face p={L.court.king} size={70} /><b>{L.court.king.name}</b><small>King</small></button>}
            {L.court.queen && <button onClick={() => onOpen(L.court.queen!.id)}><Face p={L.court.queen} size={70} /><b>{L.court.queen.name}</b><small>Queen</small></button>}
          </div>
          {((L.court.king_court?.length ?? 0) + (L.court.queen_court?.length ?? 0)) > 0 && (
            <>
              <div className="pp-h">The court</div>
              <Faces ps={[...(L.court.king_court || []), ...(L.court.queen_court || [])]} onOpen={onOpen} size={34} />
            </>
          )}
        </Sec>
      )}
      {L.dances.map((d) => (
        <Sec key={d.name} h={d.name} sub={`${d.couples} couple${d.couples === 1 ? "" : "s"}${d.you_with ? ` · you went with ${d.you_with.first}` : ""}`}>
          {d.pairs.map(([a, b]) => <Pair key={a.id + b.id} a={a} b={b} onOpen={onOpen} />)}
        </Sec>
      ))}
      {L.couples.length > 0 && (
        <Sec h="Together right now">
          {L.couples.map(([a, b]) => <Pair key={a.id + b.id} a={a} b={b} onOpen={onOpen} />)}
        </Sec>
      )}
      {L.parties > 0 && (
        <Sec h="The parties">
          <div className="yb-stats">
            <div className="yb-stat"><b>{L.parties}</b><span>parties</span></div>
            <div className="yb-stat"><b>{L.you_went}</b><span>you went to</span></div>
          </div>
          {L.host && <Who p={L.host.who} note={`threw the most: ${L.host.count}`} onOpen={onOpen} />}
          {L.biggest && <Who p={L.biggest.who} note={`the biggest: ${L.biggest.n} people, ${L.biggest.date}`} onOpen={onOpen} />}
        </Sec>
      )}
      {L.crowds.length > 0 && (
        <Sec h="The crowds">
          {L.crowds.map((q) => (
            <div key={q.name} className={cx("yb-crowd", q.you && "mine")}>
              <b>{q.name.charAt(0).toUpperCase() + q.name.slice(1)}</b><small>{q.count} people{q.you ? " · yours" : ""}</small>
              <Faces ps={q.members} onOpen={onOpen} size={28} max={10} />
            </div>
          ))}
        </Sec>
      )}
      {L.talked_about.length > 0 && (
        <Sec h="Most talked about" sub="Who the rumors were about.">
          {L.talked_about.map((t) => <Who key={t.who.id} p={t.who} note={`${t.count} rumor${t.count === 1 ? "" : "s"}`} onOpen={onOpen} />)}
        </Sec>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------- the year
function YearCh({ v }: { v: YearbookVolume }) {
  if (!v.timeline.length) return <p className="ph-dim pp-pad">The year's just getting started.</p>;
  return (
    <div className="yb-timeline">
      {v.timeline.map((m) => (
        <section key={m.month} className="yb-month">
          <div className="yb-month-h"><b>{m.month}</b>{m.scenes > 0 && <small>{m.scenes} scene{m.scenes === 1 ? "" : "s"}</small>}</div>
          {m.items.map((it, i) => <p key={i} className="yb-m"><small>{it.date}</small>{it.text}</p>)}
          {m.story.length > 0 && (
            <div className="yb-story">
              {m.story.map((s) => <span key={s.name} className="yb-story-c" title={s.name}><span>{s.name}</span><i>{s.scenes}</i></span>)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------- honors
function HonorsCh({ v, onOpen }: { v: YearbookVolume; onOpen: Open }) {
  const H = v.honors;
  const names = (ps: (YbMini & { gpa: number })[]) => (
    <div className="yb-names">{ps.map((p) => <button key={p.id} onClick={() => onOpen(p.id)}>{p.name}<small>{p.gpa.toFixed(2)}</small></button>)}</div>
  );
  return (
    <>
      {H.high.length > 0 && <Sec h="High honors" sub="3.70 and up">{names(H.high)}</Sec>}
      {H.honors.length > 0 && <Sec h="Honor roll" sub="3.30 to 3.69">{names(H.honors)}</Sec>}
      {H.athletic.length > 0 && (
        <Sec h="Athletic honors">
          {H.athletic.map((a, i) => <Who key={i} p={a.who} note={a.label} onOpen={onOpen} size={26} />)}
        </Sec>
      )}
      {H.offers.length > 0 && (
        <Sec h="The offers">
          {H.offers.map((o, i) => <p key={i} className="yb-m">{o.text}</p>)}
        </Sec>
      )}
      {H.commitments.length > 0 && (
        <Sec h="Where the seniors are going">
          {H.commitments.map((c) => <Who key={c.who.id} p={c.who} note={c.where} onOpen={onOpen} size={28} />)}
        </Sec>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------- signatures
function SignCh({ v, onOpen }: { v: YearbookVolume; onOpen: Open }) {
  if (!v.signatures.length) return <p className="ph-dim pp-pad">Nobody's signed yet. Make some friends.</p>;
  return (
    <section className="yb-signs">
      <div className="yb-kicker">Signed</div>
      <div className="yb-sign-wall">
        {v.signatures.map((s, i) => (
          <button key={s.from.id} className={cx("yb-sign", `st${s.style}`, `ink${(i + s.style) % 4}`)} onClick={() => onOpen(s.from.id)}
            style={{ transform: `rotate(${((i * 37 + s.style * 11) % 9) - 4}deg)` }}>
            {s.text}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------- recaps
function Recap({ p, onOpen }: { p: YearbookPage; onOpen: Open }) {
  return (
    <section className="yb-page">
      <div className="yb-kicker">Season recap</div>
      <h3 className="yb-h3">{p.label}</h3>
      {p.you?.rank && <p className="yb-sub">You were <b>#{p.you.rank}</b> of {p.you.of} at school.</p>}
      {p.teams.length > 0 && p.teams.map((t) => (
        <div key={t.team + t.level} className="pp-line"><b>{t.team}{t.level === "jv" ? " JV" : ""} · {t.record}</b><small>{t.line}</small></div>
      ))}
      {p.moments.slice(-6).map((m, i) => <p key={i} className="yb-m"><small>{m.date}</small>{m.text}</p>)}
      {p.superlatives && p.superlatives.length > 0 && (
        <p className="ph-dim small">{p.superlatives.filter((s) => s.winner).slice(0, 4).map((s) => `${s.label}: ${s.winner}`).join(" · ")}</p>
      )}
      <p className="ph-dim small">{p.played} storyline scene{p.played === 1 ? "" : "s"}.{" "}
        {p.top && p.top[0] ? <button className="yb-link" onClick={() => onOpen(p.top![0].id)}>#1 was {p.top[0].name}</button> : null}</p>
    </section>
  );
}
