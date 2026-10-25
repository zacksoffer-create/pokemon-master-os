// Experiments: the questions the 6v6 Lab answers, each a permanent record (master plan Improvement F) that keeps its
// spec, the engine and contract versions, every number and the report, and can be rerun under a newer engine.
//
//   league       one of your teams against a pool, and its Strategy Report
//   compare      Build A against Build B (two teams, a lineup variation, an edit): what changed in the builds, which
//                one-on-one matchups and knockout thresholds moved, and what the battles say, paired on the same seeds
//   matrix       builds × trainer styles (the master plan's Scizor × Aggressive/Conservative Lance experiment): where
//                the ranking of builds flips with the opponent's style
//   leads        each of your six as the lead
//   styles       your trainer played different ways (Blackthorn's default, cautious, aggressive...)
//   sensitivity  what moves the needle: one change at a time against the same battles, ranked by effect
//   battle       one battle again, with its full log and every decision's reasons
//   coach        "try from here": a decision point played on many times as it was and with a change, paired
//
// Everything runs on a runner (runner.js: this thread, Node worker threads or browser Web Workers) and gives the same
// numbers on any of them. A spec names teams and pools by their key in the lab pack (fixtures/lab/pack.json) or
// carries a team inline (an edit from the Lab's build editor).

import { CONTRACT_VERSION } from './contract.js';
import { ENGINE_ID } from './engine-info.js';
import { makeJob, prepareJob, runTrial, trialSides, trialPlan } from './batch.js';
import { poolJobs, poolResult, comparePoolWith, comparisonFrom, mcnemar } from './compare.js';
import { resumeBattle } from './battle.js';
import { strategyReport } from './report.js';
import { interpret, INTERPRETATIONS } from './adapters/collections.js';
import { prepare, evaluate, spreadLabel, statsOf } from './optimize/evs.js';
import { replayTurns } from './replay.js';
import { battleSeed, shortHash, stableStringify, now, STATS } from './util.js';
import { wilson } from './stats.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const pct = (x) => `${Math.round(100 * x)}%`;
const signed = (x) => `${x > 0 ? '+' : ''}${Math.round(100 * x)}`;

// ---- the pieces a spec names ------------------------------------------------------------------------------------

export function teamOf(pack, ref) {
  if (ref && typeof ref === 'object') return ref;
  const t = pack.teams[ref];
  if (!t) throw new Error(`the lab pack has no team ${ref} (known: ${Object.keys(pack.teams).join(', ')})`);
  return t;
}

const entryOf = (pack, ref) => (typeof ref === 'string' ? pack.team_list.find((t) => t.key === ref) : null);

/** The pool a spec names, as an Opponent Pool with its teams; `only` keeps just those opponents. */
export function poolOf(pack, key, { only, opponentEvs } = {}) {
  const p = pack.pools[key];
  if (!p) throw new Error(`the lab pack has no pool ${key} (known: ${Object.keys(pack.pools).join(', ')})`);
  let ids = p.members;
  if (only?.length) ids = ids.filter((id) => only.includes(id) || only.includes(pack.opponents[id]?.id));
  let members = ids.map((id) => pack.opponents[id]);
  if (opponentEvs === 0) {
    members = members.map((t) => ({ ...t, id: `${t.id}#ev0`, members: t.members.map((m) => ({ ...m, evs: Object.fromEntries(STATS.map((s) => [s, 0])),
      filled: [...(m.filled || []).filter((f) => !f.startsWith('EVs:')), "EVs: 0 (the cartridge's own: a what-if against D-072's 85)"] })) }));
  }
  return { kind: 'OpponentPool', id: p.id, version: 1, name: p.name, lens: 'standardized', members, ruleset: p.ruleset, keys: ids };
}

/** Your trainer, played a given way (your profile from the Trainer Library; Blackthorn's defaults unless coached). */
export function ourProfile(pack, ref, style = 'blackthorn') {
  const e = entryOf(pack, ref);
  const key = e ? (e.base || e.key) : (ref?.source?.version_id || 'me/heartgold');
  const base = pack.profiles[key] || pack.profiles['me/heartgold'];
  return interpret(base, style);
}

/** How the opponents play: an interpretation, falling back to Blackthorn's reading where it doesn't exist. */
export function opponentProfiles(pack, interpretation = 'blackthorn') {
  const fell = new Set();
  const fn = (opp) => {
    const key = Object.keys(pack.opponents).find((k) => pack.opponents[k] === opp) || opp.source?.version_id;
    const profs = pack.profiles[key?.startsWith('mine:') ? key.slice(5) : key] || pack.profiles[opp.source?.version_id];
    const p = profs ? interpret(profs, interpretation) : null;
    if (p) return p;
    fell.add(opp.name);
    return interpret(profs, 'blackthorn');
  };
  return { fn, fell };
}

const seedOf = (spec, extra = '') => spec.seed || `lab|${spec.kind}|${shortHash(stableStringify({ ...spec, n: undefined, adaptive: undefined }))}${extra}`;
const record = (spec, body) => ({
  kind: 'Experiment', type: spec.kind, spec, engine: ENGINE_ID, contract: CONTRACT_VERSION, made_at: new Date().toISOString(), ...body,
});
const compactBattles = (runs) => runs.flatMap((r, k) => r.rows.map((b) => ({
  opponent: r.key, k, i: b.i, winner: b.winner, turns: b.turns, left: b.left, lead: b.lead,
  kos: (b.kos || []).map((x) => [x.side, x.fainted, x.by, x.turn]),
})));

function contextFor(pack, spec, pool) {
  const vars = pack.team_list.filter((t) => t.variation).map((t) => ({ key: t.key, base: t.base, title: t.variation.title, changed: t.variation.changed }));
  return { pool, poolKey: spec.pool, teamKey: typeof spec.team === 'string' ? spec.team : undefined, interpretation: spec.interpretation || 'blackthorn',
           ourStyle: spec.ours || 'blackthorn', signatureItems: pack.signature_items || {}, variations: vars };
}

/** One team against a pool: the pool's jobs, their battles, and what they add up to. */
async function poolRun(runner, pack, { team, profile, pool, interpretation, n, seed, onProgress }) {
  const opp = opponentProfiles(pack, interpretation);
  const args = { team, profile, pool, ruleset: pool.ruleset, n, seed, opponentProfile: opp.fn };
  const t0 = now();
  const per = await runner.run(poolJobs(args).map((job) => ({ job })), { onProgress });
  const result = poolResult(args, per, { ms: Math.round(now() - t0), platform: runner.kind });
  const runs = per.map((r, k) => ({ opponent: pool.members[k], key: pool.keys?.[k] || pool.members[k].id, rows: r.rows }));
  return { result, runs, fell_back: [...opp.fell] };
}

// ---- league -----------------------------------------------------------------------------------------------------

export async function league(runner, pack, spec, { onProgress } = {}) {
  const team = teamOf(pack, spec.team), pool = poolOf(pack, spec.pool, spec);
  const profile = ourProfile(pack, spec.team, spec.ours);
  const n = spec.n ?? 20, seed = seedOf(spec);
  const { result, runs, fell_back } = await poolRun(runner, pack, { team, profile, pool, interpretation: spec.interpretation, n, seed, onProgress });
  const report = strategyReport(team, runs, contextFor(pack, spec, pool));
  return record(spec, { seed, result, report, battles: compactBattles(runs), fell_back,
                        labels: { team: team.name, pool: pool.name, opponents: INTERPRETATIONS[spec.interpretation || 'blackthorn'].label, ours: INTERPRETATIONS[spec.ours || 'blackthorn'].label } });
}

// ---- compare: Build A vs Build B --------------------------------------------------------------------------------

/** Field by field, what differs between two teams (member by member, matched by position). */
export function buildDiff(x, y) {
  const out = [];
  x.members.forEach((a, i) => {
    const b = y.members[i];
    if (!b) return;
    const ch = [];
    if (a.species !== b.species) ch.push({ field: 'Pokémon', from: a.species, to: b.species });
    for (const f of ['nature', 'ability', 'item', 'level']) if ((a[f] || null) !== (b[f] || null)) ch.push({ field: f, from: a[f] || 'none', to: b[f] || 'none' });
    const am = new Set(a.moves), bm = new Set(b.moves);
    const lost = a.moves.filter((m) => !bm.has(m)), gained = b.moves.filter((m) => !am.has(m));
    if (lost.length || gained.length) ch.push({ field: 'moves', from: lost.join(', ') || '—', to: gained.join(', ') || '—' });
    if (spreadLabel(a.evs) !== spreadLabel(b.evs)) ch.push({ field: 'EVs', from: spreadLabel(a.evs), to: spreadLabel(b.evs) });
    if (STATS.some((s) => a.ivs[s] !== b.ivs[s])) ch.push({ field: 'IVs', from: STATS.map((s) => a.ivs[s]).join('/'), to: STATS.map((s) => b.ivs[s]).join('/') });
    if (ch.length) out.push({ slot: i, from: a.species, to: b.species, changes: ch });
  });
  if ((x.lead || 'first') !== (y.lead || 'first')) out.push({ slot: null, changes: [{ field: 'lead', from: x.lead || x.members[0].species, to: y.lead || y.members[0].species }] });
  return out;
}

/**
 * For each changed member: the one-on-one matchups and knockout thresholds that moved (the duel model, the same one
 * the EV optimizer uses, against every Pokémon in the pool). Exact thresholds are the one-on-one engine's measure.
 */
export function duelChanges(x, y, pool) {
  const mons = pool.members.flatMap((t) => t.members.map((m) => ({ ...m, from: t.source?.version_id || t.id })));
  const out = [];
  for (const d of buildDiff(x, y)) {
    if (d.slot == null) continue;
    const a = x.members[d.slot], b = y.members[d.slot];
    const ra = evaluate(prepare(a, mons), a.evs, a.nature, { detail: true });
    const rb = evaluate(prepare(b, mons), b.evs, b.nature, { detail: true });
    const flips = [], thresholds = [];
    rb.rows.forEach((row, k) => {
      const was = a.species === b.species ? ra.rows[k] : ra.rows.find((r) => r.opponent === row.opponent);
      if (!was) return;
      if (was.win_typical !== row.win_typical) flips.push({ opponent: row.opponent, now: row.win_typical ? 'wins' : 'loses', from: row.from.slice(0, 2) });
      const fmt = (h) => (h >= 99 ? 'never' : `${h}`);
      if (was.our_hits !== row.our_hits) thresholds.push({ opponent: row.opponent, what: `hits to knock it out ${fmt(was.our_hits)} → ${fmt(row.our_hits)}` });
      if (was.their_hits !== row.their_hits) thresholds.push({ opponent: row.opponent, what: `its hits to knock you out ${fmt(was.their_hits)} → ${fmt(row.their_hits)}` });
      if (was.our_speed > was.their_speed !== row.our_speed > row.their_speed) {
        thresholds.push({ opponent: row.opponent, what: row.our_speed > row.their_speed ? `now outspeeds it (${row.our_speed} vs ${row.their_speed})` : `now slower than it (${row.our_speed} vs ${row.their_speed})` });
      }
    });
    const dedupe = (xs) => [...new Map(xs.map((t) => [`${t.opponent}|${t.what || t.now}`, t])).values()];
    out.push({
      slot: d.slot, from: a.species, to: b.species,
      one_on_one: { from: `${ra.typical} of ${ra.total}`, to: `${rb.typical} of ${rb.total}`, switching_in: `${ra.switch_in} → ${rb.switch_in}` },
      stats: { from: statsOf(a.species, a), to: statsOf(b.species, b) },
      flips: dedupe(flips), thresholds: dedupe(thresholds).slice(0, 40),
    });
  }
  return out;
}

export async function compare(runner, pack, spec, { onProgress } = {}) {
  const X = teamOf(pack, spec.team), Y = teamOf(pack, spec.y);
  const pool = poolOf(pack, spec.pool, spec);
  const profile = ourProfile(pack, spec.team, spec.ours);
  const opp = opponentProfiles(pack, spec.interpretation);
  const seed = seedOf(spec);
  const labelOf = (ref, t) => (typeof ref === 'string' ? (entryOf(pack, ref)?.variation?.title || t.name) : t.name);
  const c = await comparePoolWith(runner, {
    x: { team: X, profile, label: labelOf(spec.team, X) }, y: { team: Y, profile, label: labelOf(spec.y, Y) },
    pool, ruleset: pool.ruleset, n: spec.n ?? 20, seed, opponentProfile: opp.fn,
  }, { onProgress, adaptive: spec.adaptive, keepRows: true, platform: runner.kind });
  const runsOf = (rows) => rows.map((r, k) => ({ opponent: pool.members[k], key: pool.keys[k], rows: r }));
  const ctx = contextFor(pack, spec, pool);
  const rx = strategyReport(X, runsOf(c.rows.x), ctx), ry = strategyReport(Y, runsOf(c.rows.y), ctx);
  const diff = buildDiff(X, Y), duel = duelChanges(X, Y, pool);
  const moved = c.per_opponent.map((o) => ({ ...o, change: r3((o.y_won - o.x_won) / o.n) })).filter((o) => o.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const roles = rx.members.map((m, i) => ({ name: m.name, to: ry.members[i]?.name, ko_share: [m.ko_share, ry.members[i]?.ko_share], falls_first: [m.falls_first, ry.members[i]?.falls_first] }))
    .filter((r) => Math.abs((r.ko_share[1] ?? 0) - r.ko_share[0]) >= 0.05);
  const reading = [c.reading];
  if (duel.length) {
    for (const d of duel) {
      reading.push(`${d.to === d.from ? d.to : `${d.from} → ${d.to}`}, one-on-one: beats ${d.one_on_one.from} → ${d.one_on_one.to} of the pool's Pokémon` +
        (d.flips.length ? ` (now ${d.flips.slice(0, 4).map((f) => `${f.now === 'wins' ? 'beats' : 'loses to'} ${f.opponent}`).join(', ')}${d.flips.length > 4 ? '…' : ''})` : '') + '.');
    }
  }
  if (moved.length) reading.push(`Biggest swings: ${moved.slice(0, 3).map((o) => `${o.name} ${o.x_won}→${o.y_won} of ${o.n}`).join(', ')}.`);
  return record(spec, { seed, comparison: c, diff, duel, per_opponent: moved, roles, reports: { x: rx, y: ry }, reading, fell_back: [...opp.fell] });
}

// ---- matrix: builds × trainer styles ----------------------------------------------------------------------------

export async function matrix(runner, pack, spec, { onProgress } = {}) {
  const teams = spec.teams.map((t) => teamOf(pack, t));
  const interps = spec.interpretations || ['blackthorn', 'aggressive', 'cautious'];
  const pool = poolOf(pack, spec.pool, spec);
  const n = spec.n ?? 16, seed = seedOf(spec);
  const tasks = [], index = [];
  for (let r = 0; r < teams.length; r++) {
    for (let c = 0; c < interps.length; c++) {
      const opp = opponentProfiles(pack, interps[c]);
      const jobs = poolJobs({ team: teams[r], profile: ourProfile(pack, spec.teams[r], spec.ours), pool, ruleset: pool.ruleset, n, seed: `${seed}|${interps[c]}`, opponentProfile: opp.fn });
      for (const job of jobs) { tasks.push({ job }); index.push([r, c]); }
    }
  }
  const out = await runner.run(tasks, { onProgress });
  const rows = teams.map(() => interps.map(() => []));
  out.forEach((res, k) => { const [r, c] = index[k]; rows[r][c].push(res.rows); });
  const cells = rows.map((row) => row.map((perOpp) => {
    const flat = perOpp.flat(), won = flat.filter((b) => b.winner === 'a').length;
    const [lo, hi] = wilson(won, flat.length);
    return { won, n: flat.length, rate: r3(won / flat.length), ci95: [r3(lo), r3(hi)] };
  }));
  const names = spec.teams.map((ref, r) => (typeof ref === 'string' ? (entryOf(pack, ref)?.variation?.title || teams[r].name) : teams[r].name));
  const columns = interps.map((it, c) => {
    const order = cells.map((row, r) => [r, row[c].rate]).sort((a, b) => b[1] - a[1]);
    const [b1, b2] = order;
    const tied = order.filter((o) => o[1] === b1[1]).map((o) => names[o[0]]);
    let p = null;
    if (b2) {
      const fa = rows[b1[0]][c].flat(), fb = rows[b2[0]][c].flat();
      let onlyA = 0, onlyB = 0;
      fa.forEach((x, i) => { const y = fb[i]; if (x.winner === 'a' && y.winner !== 'a') onlyA++; else if (y.winner === 'a' && x.winner !== 'a') onlyB++; });
      p = mcnemar(onlyA, onlyB);
    }
    return { interpretation: it, label: INTERPRETATIONS[it].label, best: tied.length > 1 ? null : names[b1[0]], tied: tied.length > 1 ? tied : null,
             ahead_of: b2 ? names[b2[0]] : null, by: b2 ? r3(b1[1] - b2[1]) : null, p: p == null ? null : r3(p), clear: p != null && p < 0.05 && tied.length === 1 };
  });
  const reading = [];
  const clear = columns.filter((c) => c.clear);
  const leaders = new Set(columns.map((c) => c.best).filter(Boolean));
  const say = (c) => (c.best ? `${c.best} against "${c.label}"` : `a tie (${c.tied.join(', ')}) against "${c.label}"`);
  if (new Set(clear.map((c) => c.best)).size > 1) {
    reading.push(`The ranking flips with the opponent's style: ${clear.map(say).join('; ')} (each p < 0.05).`);
  } else if (leaders.size > 1 || columns.some((c) => c.tied)) {
    reading.push(`No clear flip yet. Leaders by column: ${columns.map(say).join('; ')}; none of the gaps that would make a flip is significant. More battles per cell would settle it.`);
  } else {
    reading.push(`${[...leaders][0]} leads against every style tried${clear.length === columns.length ? ', each time by a significant margin' : ', but not always by a margin the battles can confirm'}.`);
  }
  const ranges = cells.map((row, r) => ({ name: names[r], range: r3(Math.max(...row.map((x) => x.rate)) - Math.min(...row.map((x) => x.rate))) }))
    .sort((a, b) => b.range - a.range);
  if (ranges[0]?.range >= 0.05) reading.push(`${ranges[0].name} is the most sensitive to how the opponent plays (its win rate moves ${pct(ranges[0].range)} across styles).`);
  return record(spec, { seed, rows: names, columns: interps.map((i) => INTERPRETATIONS[i].label), interpretations: interps, cells, by_column: columns, sensitivity: ranges, reading });
}

// ---- leads and styles (one variable, paired against the current choice) ----------------------------------------

async function variants(runner, pack, spec, base, list, { onProgress } = {}) {
  const pool = poolOf(pack, spec.pool, spec);
  const n = spec.n ?? 16, seed = seedOf(spec);
  const tasks = [], index = [];
  list.forEach((v, k) => {
    const opp = opponentProfiles(pack, v.interpretation || spec.interpretation);
    const vPool = v.pool || pool;
    for (const job of poolJobs({ team: v.team || base.team, profile: v.profile || base.profile, pool: vPool, ruleset: pool.ruleset, n, seed, opponentProfile: opp.fn })) {
      tasks.push({ job }); index.push(k);
    }
  });
  const out = await runner.run(tasks, { onProgress });
  const per = list.map(() => []);
  out.forEach((res, t) => per[index[t]].push(res.rows));
  const baseRows = per[0];
  return list.map((v, k) => {
    const flat = per[k].flat(), won = flat.filter((b) => b.winner === 'a').length;
    const [lo, hi] = wilson(won, flat.length);
    const row = { label: v.label, change: v.change, won, n: flat.length, rate: r3(won / flat.length), ci95: [r3(lo), r3(hi)] };
    if (k > 0) {
      const c = comparisonFrom({ x: { label: list[0].label, team: base.team, profile: base.profile }, y: { label: v.label, team: v.team || base.team, profile: v.profile || base.profile },
                                 pool, ruleset: pool.ruleset, seed }, baseRows, per[k]);
      Object.assign(row, { difference: c.difference, margin: c.margin, mcnemar_p: c.mcnemar_p, significant: c.significant, reading: c.reading });
    }
    return row;
  });
}

export async function leads(runner, pack, spec, opts = {}) {
  const team = teamOf(pack, spec.team), profile = ourProfile(pack, spec.team, spec.ours);
  const list = team.members.map((m, i) => ({ label: `${m.nickname || m.species} leads`, change: i === 0 ? 'as written' : `lead: ${m.species}`,
                                             team: i === 0 ? team : { ...team, id: `${team.id}#lead${i}`, lead: m.species } }));
  const rows = await variants(runner, pack, spec, { team, profile }, list, opts);
  const best = [...rows].sort((a, b) => b.rate - a.rate || (b.margin?.y_minus_x ?? 0) - (a.margin?.y_minus_x ?? 0))[0];
  const reading = [best.change === 'as written' ? `${best.label} (the current lead) does best.` :
    `${best.label}: ${best.won} of ${best.n} against ${rows[0].won} with the current lead${best.significant ? ` (${best.reading})` : ' (not a significant difference yet)'}.`];
  const unseen = Math.max(...rows.slice(1).map((r) => Math.abs(r.difference.ci95[1] - r.difference.ci95[0]) / 2));
  if (!rows.some((r) => r.significant)) reading.push(`With ${rows[0].n} battles each, a lead change worth less than about ${Math.round(100 * unseen)} points can't be told apart yet.`);
  return record(spec, { seed: seedOf(spec), rows, best: best.label, reading });
}

export async function styles(runner, pack, spec, opts = {}) {
  const team = teamOf(pack, spec.team);
  const list = (spec.styles || spec.ours_list || ['blackthorn', 'cautious', 'aggressive', 'sharp']).map((s) => ({
    label: `your trainer: ${s === 'blackthorn' ? 'as it stands (defaults)' : INTERPRETATIONS[s].label.toLowerCase()}`, change: s, profile: ourProfile(pack, spec.team, s) }));
  const rows = await variants(runner, pack, spec, { team, profile: list[0].profile }, list, opts);
  const best = [...rows].sort((a, b) => b.rate - a.rate)[0];
  return record(spec, { seed: seedOf(spec), rows, best: best.label, reading: [`${best.label} does best: ${best.won} of ${best.n}${best.significant ? ` (${best.reading})` : ''}.`] });
}

/** What moves the needle: one change at a time against the same battles, ranked by how much it moves the result. */
export async function sensitivity(runner, pack, spec, opts = {}) {
  const team = teamOf(pack, spec.team), profile = ourProfile(pack, spec.team, spec.ours);
  const pool = poolOf(pack, spec.pool, spec);
  const even = { ...team, id: `${team.id}#even85`, members: team.members.map((m) => ({ ...m, evs: Object.fromEntries(STATS.map((s) => [s, 85])) })) };
  const list = [
    { label: 'as it stands', change: 'nothing' },
    { label: 'opponents as the game plays them', change: 'opponents: cartridge AI', interpretation: 'game' },
    { label: 'opponents aggressive', change: 'opponents: aggressive', interpretation: 'aggressive' },
    { label: 'opponents cautious', change: 'opponents: cautious', interpretation: 'cautious' },
    { label: 'opponents at their sharpest', change: 'opponents: competence 100', interpretation: 'sharp' },
    { label: "opponents on the cartridge's 0 EVs", change: 'opponent EVs: 0 instead of 85', pool: poolOf(pack, spec.pool, { ...spec, opponentEvs: 0 }) },
    { label: 'your trainer cautious', change: 'your style: cautious', profile: ourProfile(pack, spec.team, 'cautious') },
    { label: 'your trainer aggressive', change: 'your style: aggressive', profile: ourProfile(pack, spec.team, 'aggressive') },
    { label: 'your six on 85 in every stat', change: 'your EVs: 85 each instead of optimized', team: even },
  ];
  for (const t of pack.team_list.filter((x) => x.base && x.base === (entryOf(pack, spec.team)?.key))) {
    list.push({ label: `variation: ${t.variation.title}`, change: `lineup variation ${t.key}`, team: pack.teams[t.key] });
  }
  const rows = await variants(runner, pack, spec, { team, profile }, list, opts);
  const [base, ...effects] = rows;
  // near the ceiling a win rate barely moves, so rank by the HP margin (finer-grained) instead, and say so
  const byMargin = base.rate >= 0.9;
  const size = (e) => Math.abs(byMargin ? e.margin.y_minus_x : e.difference.y_minus_x);
  effects.sort((a, b) => size(b) - size(a));
  const clearOf = (e) => (byMargin ? e.margin.ci95[0] > 0 || e.margin.ci95[1] < 0 : e.significant);
  const reading = [`As it stands: ${base.won} of ${base.n} (${pct(base.rate)}).`];
  if (byMargin) reading.push('Wins are near the ceiling here, so changes are ranked by the HP margin (how much of the team is left at the end), which moves first.');
  reading.push(`What moves the needle most: ${effects.slice(0, 4).map((e) => `${e.label} (${byMargin ? `HP margin ${signed(e.margin.y_minus_x)}` : `${signed(e.difference.y_minus_x)} points`}${clearOf(e) ? '' : ', not yet clear'})`).join('; ')}.`);
  return record(spec, { seed: seedOf(spec), base, effects, ranked_by: byMargin ? 'HP margin' : 'win rate', reading });
}

// ---- one battle, and coaching ------------------------------------------------------------------------------------

function jobFor(pack, spec, opponentKey, { record: rec } = {}) {
  const team = teamOf(pack, spec.team), pool = poolOf(pack, spec.pool, spec);
  const k = pool.keys.indexOf(opponentKey);
  if (k < 0) throw new Error(`${opponentKey} isn't in ${spec.pool}`);
  const profile = ourProfile(pack, spec.team, spec.ours);
  const opp = opponentProfiles(pack, spec.interpretation);
  const [job] = poolJobs({ team, profile, pool: { ...pool, members: [pool.members[k]] }, ruleset: pool.ruleset, n: spec.n ?? 20,
                           seed: spec.seedOverride || seedOf(spec), opponentProfile: opp.fn, record: rec });
  // the pool's job seeds are per opponent: rebuild the same seed the league used
  job.trials.seed = `${spec.seedOverride || seedOf(spec)}|${pool.members[k].id}`;
  return job;
}

/** One battle of a league experiment again, with its full log and every decision's reasons, as turns. */
export function battle(pack, spec, opponentKey, i) {
  const job = jobFor(pack, spec, opponentKey, { record: { logs: 'all', decisions: 'all', input_logs: 'all' } });
  const row = runTrial(prepareJob(job), i);
  return { row, turns: replayTurns(row), job: { id: job.id, seed: job.trials.seed, i } };
}

/**
 * "Try from here": decision `at` (an index into the battle's decision log) played on `n` times as it was, and `n`
 * times with a change, on the same new seeds. The change is {choice} (make this one decision differently) or
 * {style} / {params} (play your trainer differently from here on).
 */
export async function coach(pack, spec, opponentKey, i, at, change, { n = 20, onProgress } = {}) {
  const job = jobFor(pack, spec, opponentKey, { record: { logs: 'all', decisions: 'all', input_logs: 'all' } });
  const prepared = prepareJob(job);
  const row = runTrial(prepared, i);
  const d = row.decision_log[at];
  if (!d) throw new Error(`battle ${i} has ${row.decision_log.length} decisions; no decision ${at}`);
  const plan = trialPlan(job, i);
  const sideId = d.side === 'a' ? plan.aSide : (plan.aSide === 'p1' ? 'p2' : 'p1');
  let changedProfile = null;
  if (change.style) changedProfile = ourProfile(pack, spec.team, change.style);
  if (change.params) changedProfile = { ...ourProfile(pack, spec.team, spec.ours), id: 'profile:coached', params: { ...ourProfile(pack, spec.team, spec.ours).params, ...change.params } };
  const play = (k, withChange) => {
    const seeds = { a: `coach|${k}|a`, b: `coach|${k}|b` };
    const { sides } = trialSides(job, i, { profiles: withChange && changedProfile ? { [d.side]: changedProfile } : {}, seeds });
    return resumeBattle({ inputLog: row.input_log, at, sides, reseed: battleSeed(`coach|${job.trials.seed}|${i}|${at}`, k),
                          override: withChange && change.choice ? { side: sideId, choice: change.choice, label: change.label } : null,
                          record: { log: false, decisions: false, analysis: false } });
  };
  const asPlayed = [], changed = [];
  for (let k = 0; k < n; k++) {
    asPlayed.push(play(k, false)); changed.push(play(k, true));
    if (onProgress) onProgress(k + 1, n);
    await new Promise((r) => setTimeout(r, 0));
  }
  const winOf = (r) => (r.winner === sideId ? 1 : 0);
  const a = asPlayed.reduce((t, r) => t + winOf(r), 0), b = changed.reduce((t, r) => t + winOf(r), 0);
  let onlyA = 0, onlyB = 0;
  asPlayed.forEach((r, k) => { const x = winOf(r), y = winOf(changed[k]); if (x && !y) onlyA++; if (y && !x) onlyB++; });
  const p = mcnemar(onlyA, onlyB);
  const labelOf = (c) => d.labels?.[d.options.indexOf(c)] || c;
  const what = change.choice ? `${change.label || labelOf(change.choice)} instead of ${d.label}` : change.style ? `your trainer ${INTERPRETATIONS[change.style].label.toLowerCase()} from here` : 'your trainer changed from here';
  return {
    kind: 'Coaching', at, turn: d.turn, side: d.side, as_played: { choice: d.label, won: a, n }, changed: { what, won: b, n },
    pairs: { only_as_played: onlyA, only_changed: onlyB }, mcnemar_p: r3(p),
    reading: `From turn ${d.turn}: as played (${d.label}), ${a} of ${n}; with ${what}, ${b} of ${n}` +
      (p < 0.05 ? ` (a real difference, p = ${p.toFixed(3)}).` : ` (not a clear difference over ${n} replays).`),
    decision: { options: d.options, labels: d.labels, scores: d.scores, why: d.why, knew: d.knew, assumed: d.assumed },
  };
}

// ---- dispatch -----------------------------------------------------------------------------------------------------

export const EXPERIMENTS = { league, compare, matrix, leads, styles, sensitivity };

export function runExperiment(runner, pack, spec, opts) {
  const fn = EXPERIMENTS[spec.kind];
  if (!fn) throw new Error(`unknown experiment ${spec.kind} (known: ${Object.keys(EXPERIMENTS).join(', ')})`);
  return fn(runner, pack, spec, opts);
}
