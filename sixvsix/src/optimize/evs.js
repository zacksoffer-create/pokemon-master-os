// The EV optimizer (D-072): a full 510-EV spread, and a nature where none is on record, chosen for how a Pokémon
// fares one-on-one against the opponents it is built to face. Every damage number comes from Smogon's calculator
// (@smogon/calc 0.12.0, the one-on-one engine's calculator).
//
// The duel model, per opponent Pokémon in the pool:
//   - each side may use any of its damaging moves; we pick ours to do best against their best reply (maximin);
//   - hits to knock out, on two readings: worst case (our lowest roll, their highest) and typical (average rolls).
//     A move that lowers its own attacking stat (Overheat, Draco Meteor, Leaf Storm, Superpower) loses power on
//     each repeat at the game's stage multipliers;
//   - the margin is their hits needed minus ours, ±½ for who acts first (priority, then Speed; a tie counts as
//     acting second). Three entries are scored: a fresh one-on-one (win if margin > 0), switching in on one of
//     their hits (margin > 1), and getting a free hit as they switch in (margin > -1);
//   - weather from a Sand Stream / Drizzle / Drought / Snow Warning user, Intimidate's -1 Attack, items and
//     abilities are applied; setup, recovery, status and accuracy are not (the 6v6 simulator plays those out).
// Score = wins over the three entries and both readings, with a small tie-break for the margin. The search starts
// from Blackthorn's own EV templates (engine/trainers/roles.json) and hill-climbs by moving EVs between stats in
// steps of 252 down to 4, for every nature it may choose: never one that lowers a stat the set attacks with.
// A nature on record is kept; moves, item, ability and IVs are never changed.

import { Dex } from '@pkmn/sim';
import { calculate, Generations, Pokemon, Move, Field } from '@smogon/calc';
import { STATS } from '../util.js';

const gen = Generations.get(4);
const dex = Dex.forGen(4);
const NATURES = dex.natures.all().map((n) => ({ name: n.name, plus: n.plus || null, minus: n.minus || null }));
const WEATHER_ABILITY = { 'Sand Stream': 'Sand', Drizzle: 'Rain', Drought: 'Sun', 'Snow Warning': 'Hail' };
const INTIMIDATE_IMMUNE = new Set(['Clear Body', 'Hyper Cutter', 'White Smoke']);
const MAX_EV = 252, BUDGET = 508, NEVER = 99;

/** Blackthorn's EV templates (engine/trainers/roles.json → ev_templates), 'matching' = the side the set attacks with. */
export const TEMPLATES = {
  fast_physical: { atk: 252, spe: 252, hp: 4 },
  fast_special: { spa: 252, spe: 252, hp: 4 },
  fast_mixed: { atk: 128, spa: 128, spe: 252 },
  bulky_physical: { hp: 252, atk: 252, def: 4 },
  bulky_special: { hp: 252, spa: 252, def: 4 },
  physical_wall: { hp: 252, def: 252, spd: 4 },
  special_wall: { hp: 252, spd: 252, def: 4 },
  mixed_wall: { hp: 252, def: 128, spd: 128 },
  fast_support: { hp: 252, spe: 252, def: 4 },
};

const full = (evs) => Object.fromEntries(STATS.map((s) => [s, evs?.[s] ?? 0]));
const evTotal = (evs) => STATS.reduce((t, s) => t + evs[s], 0);

/** One stat as Gens 3-4 compute it (integer arithmetic, nature applied last). */
export function statValue(base, iv, ev, level, stat, nature) {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === 'hp') return base === 1 ? 1 : core + level + 10;
  const n = NATURES.find((x) => x.name === nature) || NATURES[0];
  const x = core + 5;
  if (n.plus === stat && n.minus !== stat) return Math.floor((x * 110) / 100);
  if (n.minus === stat && n.plus !== stat) return Math.floor((x * 90) / 100);
  return x;
}

export function statsOf(species, { level, ivs, evs, nature }) {
  const base = dex.species.get(species).baseStats;
  return Object.fromEntries(STATS.map((s) => [s, statValue(base[s], ivs[s], evs[s], level, s, nature)]));
}

function speedOf(species, build, stats, weather) {
  let spe = stats.spe;
  if (build.item === 'Choice Scarf') spe = Math.floor((spe * 3) / 2);
  if ((build.ability === 'Swift Swim' && weather === 'Rain') || (build.ability === 'Chlorophyll' && weather === 'Sun')) spe *= 2;
  return spe;
}

function damagingMoves(build) {
  return build.moves.map((name) => dex.moves.get(name)).filter((m) => m.exists && m.category !== 'Status')
    .map((m) => ({ name: m.name, priority: m.priority, cat: m.category,
                   drop: m.self?.boosts?.[m.category === 'Physical' ? 'atk' : 'spa'] || 0 }));
}

const stageMult = (stage) => (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage));

/** Hits to deal `hp` with `dmg` per hit, a self-lowering move losing power at each repeat (stage -6 at most). */
export function hitsToKO(hp, dmg, drop = 0) {
  if (dmg <= 0) return NEVER;
  if (!drop) return Math.ceil(hp / dmg);
  let done = 0;
  for (let k = 1; k < NEVER; k++) {
    done += dmg * stageMult(Math.max(-6, drop * (k - 1)));
    if (done >= hp) return k;
  }
  return NEVER;
}

function rollStats(damage) {
  // calc gives 16 rolls, a single number (fixed damage), or one array per hit for multi-hit moves
  if (typeof damage === 'number') return [damage, damage, damage];
  if (Array.isArray(damage[0])) {
    const lo = damage.reduce((t, h) => t + Math.min(...h), 0), hi = damage.reduce((t, h) => t + Math.max(...h), 0);
    return [lo, (lo + hi) / 2, hi];
  }
  return [Math.min(...damage), damage.reduce((t, d) => t + d, 0) / damage.length, Math.max(...damage)];
}

function damageOf(attacker, defender, moveName, attackerBuild, attackerSpecies, weather) {
  try {
    const move = new Move(gen, moveName, { ability: attackerBuild.ability, item: attackerBuild.item || undefined, species: attackerSpecies });
    return rollStats(calculate(gen, attacker, defender, move, new Field({ weather: weather || undefined })).damage);
  } catch (err) {
    return [0, 0, 0];   // a move the calculator can't price counts as doing nothing (none in the current pools)
  }
}

/** An (EVs, nature) that gives `value` in `stat` at this level, for building a calculator Pokémon with that stat. */
function sourceFor(species, level, ivs, stat, value) {
  const base = dex.species.get(species).baseStats[stat];
  for (const nature of [null, 'plus', 'minus']) {
    for (let ev = 0; ev <= MAX_EV; ev += 4) {
      const nat = nature === null ? 'Hardy' : NATURES.find((n) => (nature === 'plus' ? n.plus === stat : n.minus === stat) && n.plus !== n.minus).name;
      if (statValue(base, ivs[stat], ev, level, stat, nat) === value) return { evs: { [stat]: ev }, nature: nat };
    }
  }
  throw new Error(`no spread gives ${species} ${stat} ${value}`);
}

/**
 * Prepare a pool once for one Pokémon: opponents (deduplicated, weighted by how often they appear), and lazily
 * filled damage tables keyed by our final stat values.
 */
export function prepare(build, pool) {
  const species = build.species, level = build.level, ivs = build.ivs;
  const ours = damagingMoves(build);
  const ourWeather = WEATHER_ABILITY[build.ability] || null;
  const seen = new Map();
  for (const o of pool) {
    const key = JSON.stringify([o.species, o.level, o.nature, o.ability, o.item, o.moves, o.evs, o.ivs]);
    const prev = seen.get(key);
    if (prev) { prev.weight++; prev.from.push(o.from); continue; }
    const weather = ourWeather || WEATHER_ABILITY[o.ability] || null;
    const stats = statsOf(o.species, o);
    seen.set(key, {
      species: o.species, from: [o.from], weight: 1, build: o, weather, hp: stats.hp,
      spe: speedOf(o.species, o, stats, weather),
      moves: damagingMoves(o),
      intimidatesUs: o.ability === 'Intimidate' && !INTIMIDATE_IMMUNE.has(build.ability),
      weIntimidate: build.ability === 'Intimidate' && !INTIMIDATE_IMMUNE.has(o.ability),
      calcMon: new Pokemon(gen, o.species, { level: o.level, nature: o.nature, evs: o.evs, ivs: o.ivs, ability: o.ability, item: o.item || undefined }),
    });
  }
  const opponents = [...seen.values()];
  const cache = new Map();

  // our damage to each opponent with our attacking stat at `value`: [opponent][move] -> [lo, avg] as hits to KO
  function offense(cat, value) {
    const key = `o:${cat}:${value}`;
    if (cache.has(key)) return cache.get(key);
    const stat = cat === 'Physical' ? 'atk' : 'spa';
    const src = sourceFor(species, level, ivs, stat, value);
    const mon = (boosts) => new Pokemon(gen, species, { level, ivs, evs: full(src.evs), nature: src.nature,
      ability: build.ability, item: build.item || undefined, boosts });
    const plain = mon(undefined), intimidated = cat === 'Physical' ? mon({ atk: -1 }) : plain;
    const table = opponents.map((o) => ours.map((m) => {
      if (m.cat !== cat) return null;
      return damageOf(o.intimidatesUs ? intimidated : plain, o.calcMon, m.name, build, species, o.weather);
    }));
    cache.set(key, table);
    return table;
  }

  // each opponent's damage to us with our defending stat at `value`: [opponent][move] -> [lo, avg, hi] in HP
  function defense(cat, value) {
    const key = `d:${cat}:${value}`;
    if (cache.has(key)) return cache.get(key);
    const stat = cat === 'Physical' ? 'def' : 'spd';
    const src = sourceFor(species, level, ivs, stat, value);
    const me = new Pokemon(gen, species, { level, ivs, evs: full(src.evs), nature: src.nature, ability: build.ability, item: build.item || undefined });
    const table = opponents.map((o) => o.moves.map((m) => {
      if (m.cat !== cat) return null;
      const them = o.weIntimidate && cat === 'Physical'
        ? new Pokemon(gen, o.species, { level: o.build.level, nature: o.build.nature, evs: o.build.evs, ivs: o.build.ivs, ability: o.build.ability, item: o.build.item || undefined, boosts: { atk: -1 } })
        : o.calcMon;
      return damageOf(them, me, m.name, o.build, o.species, o.weather);
    }));
    cache.set(key, table);
    return table;
  }

  return { build, species, opponents, ours, offense, defense, ourWeather };
}

/** How a spread does against the prepared pool: wins per entry and reading, margins, and per-opponent rows. */
export function evaluate(ctx, evs, nature, { detail = false } = {}) {
  const { build, opponents, ours } = ctx;
  const stats = statsOf(ctx.species, { level: build.level, ivs: build.ivs, evs, nature });
  const offP = ours.some((m) => m.cat === 'Physical') ? ctx.offense('Physical', stats.atk) : null;
  const offS = ours.some((m) => m.cat === 'Special') ? ctx.offense('Special', stats.spa) : null;
  const defP = ctx.defense('Physical', stats.def), defS = ctx.defense('Special', stats.spd);
  let wins = 0, worst = 0, typical = 0, switchIn = 0, freeHit = 0, margin = 0, total = 0;
  const rows = detail ? [] : null;
  opponents.forEach((o, i) => {
    const mySpe = speedOf(ctx.species, build, stats, o.weather);
    const best = { w: -NEVER, t: -NEVER, move: null };
    for (let a = 0; a < ours.length; a++) {
      const r = (ours[a].cat === 'Physical' ? offP : offS)[i][a];
      const hitsLo = hitsToKO(o.hp, r[0], ours[a].drop), hitsAvg = hitsToKO(o.hp, r[1], ours[a].drop);
      let mw = NEVER, mt = NEVER;
      if (!o.moves.length) { mw = mt = hitsLo < NEVER ? NEVER : 0; }
      for (let b = 0; b < o.moves.length; b++) {
        const t = (o.moves[b].cat === 'Physical' ? defP : defS)[i][b];
        const theirHi = hitsToKO(stats.hp, t[2], o.moves[b].drop), theirAvg = hitsToKO(stats.hp, t[1], o.moves[b].drop);
        const first = ours[a].priority > o.moves[b].priority || (ours[a].priority === o.moves[b].priority && mySpe > o.spe);
        const edge = first ? 0.5 : -0.5;
        mw = Math.min(mw, hitsLo >= NEVER ? -NEVER : theirHi - hitsLo + edge);
        mt = Math.min(mt, hitsAvg >= NEVER ? -NEVER : theirAvg - hitsAvg + edge);
      }
      if (mw > best.w || (mw === best.w && mt > best.t)) { best.w = mw; best.t = mt; best.move = ours[a].name; }
    }
    const k = o.weight;
    const entries = (m) => (m > -1 ? 1 : 0) + (m > 0 ? 1 : 0) + (m > 1 ? 1 : 0);
    wins += (entries(best.w) + entries(best.t)) * k;
    worst += (best.w > 0 ? 1 : 0) * k; typical += (best.t > 0 ? 1 : 0) * k;
    switchIn += (best.t > 1 ? 1 : 0) * k; freeHit += (best.t > -1 ? 1 : 0) * k;
    total += k;
    margin += (Math.max(-3, Math.min(3, best.w)) + Math.max(-3, Math.min(3, best.t))) * k;
    if (rows) rows.push({ opponent: o.species, from: o.from, weight: k, win_worst: best.w > 0, win_typical: best.t > 0,
                          win_switching_in: best.t > 1, move: best.move, our_speed: mySpe, their_speed: o.spe });
  });
  return { score: wins + 0.02 * margin, worst, typical, switch_in: switchIn, free_hit: freeHit, total, margin, stats, rows };
}

const better = (a, b) => a.score > b.score + 1e-9;

function climb(ctx, start, nature, stats) {
  let evs = { ...start };
  let cur = evaluate(ctx, evs, nature);
  for (const step of [252, 128, 64, 32, 16, 8, 4]) {
    let improved = true;
    while (improved) {
      improved = false;
      for (const from of [null, ...stats]) {
        for (const to of stats) {
          if (from === to) continue;
          const next = { ...evs };
          if (from) {
            const moved = Math.min(step, next[from], MAX_EV - next[to]);
            if (moved <= 0) continue;
            next[from] -= moved; next[to] += moved;
          } else {
            const room = Math.min(step, BUDGET - evTotal(next), MAX_EV - next[to]);
            if (room <= 0) continue;
            next[to] += room;
          }
          const r = evaluate(ctx, next, nature);
          if (better(r, cur)) { evs = next; cur = r; improved = true; }
        }
      }
    }
  }
  return { evs, nature, result: cur };
}

/** Natures to try: the one on record, or Hardy plus every nature that doesn't lower a stat the set attacks with. */
function naturesFor(build, ours) {
  if (build.nature_locked) return [build.nature];
  const used = new Set(ours.map((m) => (m.cat === 'Physical' ? 'atk' : 'spa')));
  return ['Hardy', ...NATURES.filter((n) => n.plus && n.plus !== n.minus && !used.has(n.minus)).map((n) => n.name)];
}

function startsFor(ours) {
  const phys = ours.some((m) => m.cat === 'Physical'), spec = ours.some((m) => m.cat === 'Special');
  const keep = Object.entries(TEMPLATES).filter(([k]) => {
    if (k.includes('physical') && !k.includes('wall')) return phys;
    if (k.includes('special') && !k.includes('wall')) return spec;
    if (k === 'fast_mixed') return phys && spec;
    return true;
  });
  return [...keep.map(([id, evs]) => ({ id, evs: full(evs) })), { id: 'even_85', evs: full({ hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 }) }];
}

/** The spread a competitive player would reach for first: 252 in the side most of its attacks use, 252 Speed. */
export function conventionalTemplate(build, ours) {
  const phys = ours.filter((m) => m.cat === 'Physical').length, spec = ours.filter((m) => m.cat === 'Special').length;
  if (!phys && !spec) return 'fast_support';
  if (phys === spec) {
    const b = dex.species.get(build.species).baseStats;
    return b.atk >= b.spa ? 'fast_physical' : 'fast_special';
  }
  return phys > spec ? 'fast_physical' : 'fast_special';
}

/**
 * The optimized spread for one build against a pool of opponent builds. Returns the new EVs and nature, how they
 * score, and the alternatives they beat (Blackthorn's best template, and 85 in every stat).
 */
export function optimizeBuild(build, pool) {
  const ctx = prepare(build, pool);
  const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].filter((s) =>
    !(s === 'atk' && !ctx.ours.some((m) => m.cat === 'Physical')) && !(s === 'spa' && !ctx.ours.some((m) => m.cat === 'Special')));
  const natures = naturesFor(build, ctx.ours);
  let best = null, bestTemplate = null;
  const perTemplate = {};
  for (const nature of natures) {
    for (const start of startsFor(ctx.ours)) {
      const plain = evaluate(ctx, start.evs, nature);
      if (start.id !== 'even_85' && (!bestTemplate || better(plain, bestTemplate.result))) bestTemplate = { id: start.id, evs: start.evs, nature, result: plain };
      if (start.id !== 'even_85' && (!perTemplate[start.id] || better(plain, perTemplate[start.id].result))) perTemplate[start.id] = { evs: start.evs, nature, result: plain };
      const r = climb(ctx, start.evs, nature, stats);
      if (!best || better(r.result, best.result)) best = { ...r, start: start.id };
    }
  }
  const flat = evaluate(ctx, full({ hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 }), build.nature_locked ? build.nature : 'Hardy');
  const detail = evaluate(ctx, best.evs, best.nature, { detail: true });
  const speeds = [...new Set(ctx.opponents.map((o) => o.spe))].sort((a, b) => a - b);
  const mySpe = detail.stats.spe;
  const nextUp = speeds.find((s) => s >= mySpe);
  const conventional = conventionalTemplate(build, ctx.ours);
  const conv = perTemplate[conventional];
  return {
    evs: best.evs, nature: best.nature, nature_chosen: !build.nature_locked, start: best.start,
    conventional: { id: conventional, evs: conv.evs, nature: conv.nature, ...summary(conv.result) },
    stats: detail.stats,
    score: summary(best.result),
    best_template: { id: bestTemplate.id, nature: bestTemplate.nature, evs: bestTemplate.evs, ...summary(bestTemplate.result) },
    flat_85: summary(flat),
    speed: { stat: mySpe, outspeeds: ctx.opponents.filter((o) => mySpe > o.spe).reduce((t, o) => t + o.weight, 0),
             of: best.result.total, next_benchmark: nextUp ?? null },
    rows: detail.rows,
  };
}

function summary(r) {
  return { points: Math.round(r.score * 100) / 100, wins_worst: r.worst, wins_typical: r.typical,
           wins_switching_in: r.switch_in, wins_free_hit: r.free_hit, of: r.total };
}

export const spreadLabel = (evs) => STATS.filter((s) => evs[s]).map((s) => `${evs[s]} ${{ hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' }[s]}`).join(' / ') || 'no EVs';

/** Optimize every member of a team against a pool; returns the new team and one report row per member. */
export function optimizeTeam(team, pool, { poolName = 'the pool' } = {}) {
  const report = [];
  const members = team.members.map((m) => {
    const locked = !(m.filled || []).some((f) => f.startsWith('nature:'));
    const r = optimizeBuild({ ...m, nature_locked: locked }, pool);
    const filled = (m.filled || []).filter((f) => !f.startsWith('EVs:') && !(r.nature_chosen && f.startsWith('nature:')));
    filled.push(`EVs: ${spreadLabel(r.evs)} (D-072: optimized one-on-one against ${poolName})`);
    if (r.nature_chosen) filled.push(`nature: ${r.nature} (chosen by the EV optimizer; none on record)`);
    const evidence = { ...(m.evidence || {}), evs: ['standardized', `optimized against ${poolName} (D-072)`] };
    if (r.nature_chosen) evidence.nature = ['hypothetical', "the EV optimizer's choice; no nature on record"];
    report.push({ species: m.species, nature: r.nature, nature_chosen: r.nature_chosen, evs: r.evs, label: spreadLabel(r.evs),
                  stats: r.stats, score: r.score, best_template: r.best_template, conventional: { ...r.conventional, label: spreadLabel(r.conventional.evs) },
                  flat_85: r.flat_85, speed: r.speed });
    return { ...m, evs: r.evs, nature: r.nature, filled, evidence };
  });
  return { team: { ...team, members }, report };
}
