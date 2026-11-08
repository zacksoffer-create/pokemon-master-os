// The Scene tab's People and Yearbook: the world in numbers. People is everyone at your school, sortable and filterable
// by the numbers (rank, how they feel about you, their best sport's rating, GPA), with each person's full card a tap
// away (and Edit from there). The Yearbook is in Yearbook.tsx.
import React, { useEffect, useMemo, useState } from "react";
import { PersonProfile, PersonRow, phoneApi, pgo, RelNums, SceneMini } from "./api";
import { Portrait } from "./art";
import { cx, errText, Sheet } from "./kit";

const YEARS: [string, string, number | null][] = [["all", "Everyone", null], ["9", "Freshmen", 9], ["10", "Sophomores", 10], ["11", "Juniors", 11], ["12", "Seniors", 12]];
const SORTS: [string, string][] = [["rank", "Rank"], ["likes", "Likes you"], ["athlete", "Athlete"], ["gpa", "GPA"], ["name", "Name"]];
const SPORT_SHORT: Record<string, string> = { football: "FB", basketball: "BB", baseball: "BSB", soccer: "SOC", softball: "SB" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Face({ p, size = 40 }: { p: SceneMini; size?: number }) {
  return <Portrait look={p.look} size={size} color={p.color} name={p.first} />;
}

export function PeopleScreen() {
  const [rows, setRows] = useState<PersonRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState("rank");
  const [team, setTeam] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    phoneApi.people().then((r) => setRows(r.rows)).catch((e) => setErr(errText(e)));
  }, []);
  const shown = useMemo(() => {
    if (!rows) return [];
    const g = YEARS.find(([k]) => k === year)?.[2];
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) => (g == null || r.grade === g) && (!team || r.teams.length > 0) && (!needle || r.name.toLowerCase().includes(needle)
      || (r.group || "").toLowerCase().includes(needle)));
    const by: Record<string, (r: PersonRow) => number | string> = {
      rank: (r) => r.rank ?? 999, likes: (r) => -(r.likes_you ?? -999), athlete: (r) => -(r.rating ?? -1), gpa: (r) => -r.gpa, name: (r) => r.name,
    };
    const f = by[sort];
    return [...list].sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : (a.rank ?? 999) - (b.rank ?? 999)));
  }, [rows, year, sort, team, q]);
  if (err) return <p className="ph-dim pp-pad">{err}</p>;
  if (!rows) return <div className="ph-dim pp-pad"><span className="ph-spinner small" /> Counting heads…</div>;
  const metric = (r: PersonRow) => {
    if (sort === "likes") return r.me ? <b>you</b> : <><b className={cx((r.likes_you ?? 0) < 0 && "neg")}>{signed(r.likes_you)}</b><small>likes you</small></>;
    if (sort === "athlete") return r.rating != null ? <><b>{r.rating}</b><small>{r.sport}</small></> : <small>no sport</small>;
    if (sort === "gpa") return <><b>{r.gpa.toFixed(2)}</b><small>GPA</small></>;
    return <><b>#{r.rank}</b><small>pop {r.pop}</small></>;
  };
  return (
    <div className="pp">
      <input className="ph-input pp-search" type="search" placeholder="Search a name or a group" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="pp-chips">
        {YEARS.map(([k, l]) => <button key={k} className={cx("pp-chip", year === k && "on")} onClick={() => setYear(k)}>{l}</button>)}
        <button className={cx("pp-chip", team && "on")} onClick={() => setTeam(!team)}>On a team</button>
      </div>
      <div className="pp-sort">
        <span>Sort</span>
        {SORTS.map(([k, l]) => <button key={k} className={cx(sort === k && "on")} onClick={() => setSort(k)}>{l}</button>)}
      </div>
      <p className="ph-dim small pp-count">{shown.length} of {rows.length}</p>
      <div className="pp-list">
        {shown.map((r) => (
          <button key={r.id} className={cx("pp-row", r.me && "me")} onClick={() => setOpen(r.id)}>
            <Face p={r} size={42} />
            <span className="pp-main">
              <b>{r.name}{r.me ? " (you)" : ""}</b>
              <small>{r.year}{r.group ? ` · ${r.group.replace(/^the /, "")}` : ""}</small>
              <span className="pp-badges">
                {r.teams.map((t) => <i key={t.group} className="pp-team">{SPORT_SHORT[t.sport] || t.sport} {t.level === "jv" ? "JV" : "V"}{t.pos ? ` · ${t.pos}` : ""}</i>)}
                {r.tags.filter((t) => t !== "storyline").slice(0, 2).map((t) => <i key={t} className="pp-tag">{t}</i>)}
              </span>
            </span>
            <span className="pp-metric">{metric(r)}</span>
          </button>
        ))}
      </div>
      <PersonSheet id={open} onClose={() => setOpen(null)} onOpen={setOpen} />
    </div>
  );
}

const signed = (n: number | null | undefined) => (n == null ? "–" : n > 0 ? `+${n}` : String(n));

function Bars({ title, nums, max = 8 }: { title: string; nums: Record<string, number>; max?: number }) {
  const list = Object.entries(nums).slice(0, max);
  if (!list.length) return null;
  return (
    <div className="pp-sec">
      <div className="pp-h">{title}</div>
      {list.map(([k, v]) => (
        <div key={k} className="pp-bar"><span>{cap(k.replace(/_/g, " "))}</span><i><u style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></i><b>{v}</b></div>
      ))}
    </div>
  );
}

function Rel({ who, r }: { who: string; r: RelNums }) {
  if (!r) return <div className="pp-rel"><b>{who}</b><small>They haven't really met.</small></div>;
  return (
    <div className="pp-rel">
      <b>{who}{r.label ? ` · ${r.label}` : ""}{r.crush ? " · crush" : ""}</b>
      <div className="pp-relnums">
        {(["affection", "trust", "respect", "attraction"] as const).map((k) => (
          <span key={k}><b className={cx(r[k] < 0 && "neg")}>{Math.round(r[k])}</b><small>{k}</small></span>
        ))}
      </div>
    </div>
  );
}

export function PersonSheet({ id, onClose, onOpen }: { id: string | null; onClose: () => void; onOpen?: (id: string) => void }) {
  const [p, setP] = useState<PersonProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setP(null);
    setErr(null);
    if (id) phoneApi.person(id).then(setP).catch((e) => setErr(errText(e)));
  }, [id]);
  return (
    <Sheet open={!!id} onClose={onClose} full title={p?.name || ""}>
      {err && <p className="ph-dim">{err}</p>}
      {!p && !err && <div className="ph-dim"><span className="ph-spinner small" /> Looking them up…</div>}
      {p && (
        <div className="pp-card">
          <div className="pp-top">
            <Face p={p} size={84} />
            <div>
              <b>{p.name}</b>
              <small>{p.year} · {p.age} · {p.group || "no group"}</small>
              <div className="pp-topnums">
                <span><b>#{p.rank ?? "–"}</b><small>rank</small></span>
                <span><b>{p.pop}</b><small>popularity</small></span>
                {p.gpa != null && <span><b>{p.gpa.toFixed(2)}</b><small>GPA</small></span>}
                {p.rating != null && <span><b>{p.rating}</b><small>{p.sport}</small></span>}
              </div>
            </div>
          </div>
          {p.superlatives.length > 0 && <div className="pp-holds">{p.superlatives.map((s) => <i key={s}>★ {s}</i>)}</div>}
          {p.bio && <p className="pp-bio">{p.bio}</p>}
          {p.with_you && (
            <div className="pp-sec">
              <div className="pp-h">You two</div>
              <Rel who={`How ${p.first} feels about you`} r={p.with_you.they} />
              <Rel who={`How you feel about ${p.first}`} r={p.with_you.you} />
            </div>
          )}
          {(p.teams.length > 0 || p.season.length > 0) && (
            <div className="pp-sec">
              <div className="pp-h">Teams</div>
              {(p.teams || []).map((t) => <div key={t.group} className="pp-line"><b>{t.team}{t.level === "jv" ? " JV" : ""}</b><small>{[t.pos, p.jersey ? `#${p.jersey}` : null].filter(Boolean).join(" · ")}</small></div>)}
              {p.season.map((s) => <div key={s.team + s.level} className="pp-line"><span>{s.team}{s.level === "jv" ? " JV" : ""} this season: {s.record}, {s.games} games</span><small>{s.line}</small></div>)}
            </div>
          )}
          <Bars title="Skills" nums={p.skills} />
          <Bars title="Personality" nums={p.traits} max={12} />
          <Bars title="Talents" nums={p.aptitudes} />
          {Object.keys(p.interests).length > 0 && (
            <div className="pp-sec"><div className="pp-h">Into</div><div className="pp-chips static">{Object.keys(p.interests).map((k) => <i key={k} className="pp-chip">{k.replace(/_/g, " ")}</i>)}</div></div>
          )}
          {Object.keys(p.reputation).length > 0 && (
            <div className="pp-sec"><div className="pp-h">Known for</div><div className="pp-chips static">{Object.entries(p.reputation).map(([k, v]) => <i key={k} className="pp-chip">{k.replace(/_/g, " ")} {v}</i>)}</div></div>
          )}
          {(p.partner || p.crush || p.people.length > 0) && (
            <div className="pp-sec">
              <div className="pp-h">Their people</div>
              {p.partner && <PersonLink p={p.partner} note="dating" onOpen={onOpen} />}
              {p.crush && <PersonLink p={p.crush} note="has a crush" onOpen={onOpen} />}
              {p.people.map((x) => <PersonLink key={x.id} p={x} note={`likes them ${x.affection}`} onOpen={onOpen} />)}
            </div>
          )}
          {p.rumors.length > 0 && (
            <div className="pp-sec"><div className="pp-h">What you've heard</div>{p.rumors.map((r, i) => <p key={i} className="pp-rumor">“{r}”</p>)}</div>
          )}
          <button className="ph-btn soft block" onClick={() => { onClose(); pgo(`edit/${p.id}`); }}>Edit {p.me ? "yourself" : p.first}</button>
        </div>
      )}
    </Sheet>
  );
}

function PersonLink({ p, note, onOpen }: { p: SceneMini; note: string; onOpen?: (id: string) => void }) {
  return (
    <button className="pp-link" onClick={() => onOpen?.(p.id)}>
      <Face p={p} size={30} />
      <span><b>{p.name}</b><small>{p.year} · {note}</small></span>
    </button>
  );
}

