// One battle, start to finish, on Showdown's simulator. Both sides decide from their own request and their own view
// of the log (observer.js); every choice is checked by the engine; the input log (Showdown's own record of the
// seed, both teams and every choice) is kept so the battle can be replayed exactly (replayBattle).

import { Battle, extractChannelMessages } from '@pkmn/sim';
import { SideView } from './observer.js';
import { analyzeLog } from './analyze.js';
import { packTeam } from './teams.js';
import { now, shortHash } from './util.js';

const SIDES = ['p1', 'p2'];

/** The log without wall-clock stamps (|t:|), the only part of a Showdown log that differs between identical runs. */
export function normalizeLog(lines) {
  return lines.filter((l) => !l.startsWith('|t:|'));
}

export const logHash = (lines) => shortHash(normalizeLog(lines).join('\n'));

/** The omniscient channel: both sides' private lines (exact HP), no duplicates. */
export function omniscientLines(battle) {
  return extractChannelMessages(battle.log.join('\n'), [-1])[-1];
}

/** The real state of a side's active Pokémon (for the cartridge AI only: it's what the game's AI reads). */
function trueActive(battle, sideId) {
  const p = battle[sideId].active[0];
  if (!p || p.fainted) return null;
  const vol = {};
  for (const k of ['substitute', 'leechseed', 'taunt', 'yawn', 'ingrain', 'confusion']) if (p.volatiles[k]) vol[k] = true;
  if (p.volatiles.perishsong) vol.perish = p.volatiles.perishsong.duration;
  return {
    name: p.name, species: p.species.name, level: p.level, nature: p.set.nature || 'Hardy', evs: { ...p.set.evs }, ivs: { ...p.set.ivs },
    ability: p.getAbility().name, item: p.getItem().name || '', boosts: { ...p.boosts }, status: p.status || '',
    hp: p.hp / p.maxhp, maxhp: p.maxhp, spe: p.getStat('spe'), types: p.getTypes(), volatiles: vol,
    moves: p.moves.map((m) => p.battle.dex.moves.get(m).name), lastMove: p.lastMove?.name || null,
  };
}

function remaining(battle, sideId) {
  const mons = battle[sideId].pokemon;
  const alive = mons.filter((p) => p.hp > 0);
  return {
    left: alive.length,
    hp: Math.round((1000 * mons.reduce((s, p) => s + p.hp / p.maxhp, 0)) / mons.length) / 1000,
  };
}

/**
 * Play one battle.
 *   formatid   the Showdown battle format (from the ruleset)
 *   seed       Showdown PRNG seed ('sodium,<hex>')
 *   sides      {p1: {name, team, agent, rng}, p2: {...}} — team is a complete Team Version
 *   turnLimit  tie when the battle passes this many turns (Showdown's own limit is 1000)
 *   record     {log: bool, decisions: bool, analysis: bool}
 */
export function runBattle({ formatid, seed, sides, turnLimit = 1000, record = {} }) {
  const t0 = now();
  const run = begin(sides, record, seed);
  try {
    run.battle = new Battle({ formatid, seed });
    for (const id of SIDES) run.battle.setPlayer(id, { name: sides[id].name, team: run.packed[id].packed });
    play(run, sides, turnLimit);
  } catch (err) {
    run.out.end = 'error';
    run.out.error = String(err?.stack || err).split('\n').slice(0, 6).join('\n');
  }
  return finish(run, t0);
}

/**
 * Pick a recorded battle up at one of its decisions and play it on: the input log's first `at` choices are replayed
 * exactly (Showdown's own record), then `sides` decide from there. `reseed` gives the rest of the battle a new battle
 * seed (written into the input log, so the continuation replays too); `override` makes the next decision of one side
 * for it ({side: 'p1', choice: 'switch 3'}): the "what if it had switched here?" of the coaching view.
 */
export function resumeBattle({ inputLog, at, sides, reseed, override, turnLimit = 1000, record = {} }) {
  const t0 = now();
  const run = begin(sides, record, null);
  try {
    const start = inputLog.find((l) => l.startsWith('>start '));
    run.battle = new Battle(JSON.parse(start.slice(7)));
    run.out.seed = run.battle.prngSeed;
    for (const line of inputLog) {
      if (!line.startsWith('>player ')) continue;
      const [, id, json] = line.match(/^>player (p\d) (.*)$/);
      run.battle.setPlayer(id, JSON.parse(json));
    }
    let applied = 0;
    for (const line of inputLog) {
      if (applied >= at) break;
      if (/^>p\d /.test(line)) { run.battle.choose(line.slice(1, 3), line.slice(4)); applied++; }
      else if (line.startsWith('>reseed ')) run.battle.resetRNG(line.slice(8));
    }
    if (applied < at) throw new Error(`the battle has only ${applied} choices; can't resume at ${at}`);
    if (reseed) { run.battle.resetRNG(reseed); run.battle.inputLog.push(`>reseed ${reseed}`); }
    run.override = override || null;
    play(run, sides, turnLimit);
  } catch (err) {
    run.out.end = 'error';
    run.out.error = String(err?.stack || err).split('\n').slice(0, 6).join('\n');
  }
  return finish(run, t0);
}

function begin(sides, record, seed) {
  const rec = { log: true, decisions: true, analysis: true, ...record };
  const out = {
    seed, winner: null, end: null, turns: 0, left: {}, hp: {}, decisions: rec.decisions ? [] : undefined,
    counts: { decisions: 0, unavailable: 0, invalid: 0 }, error: null,
  };
  const packed = {};
  for (const id of SIDES) packed[id] = packTeam(sides[id].team);
  return { rec, out, packed, battle: null, override: null };
}

/** The decision loop: each side decides from its own request and view; the engine checks every choice. */
function play(run, sides, turnLimit) {
  const { battle, out, rec } = run;
  const views = { p1: new SideView('p1'), p2: new SideView('p2') };
  let pos = 0;
  const feed = () => {
    if (pos >= battle.log.length) return;
    const ch = extractChannelMessages(battle.log.slice(pos).join('\n'), [1, 2]);
    pos = battle.log.length;
    views.p1.update(ch[1]);
    views.p2.update(ch[2]);
  };
  feed();

  let idle = 0;
  while (!battle.ended) {
    if (battle.turn > turnLimit) {
      out.end = 'turn-limit';
      battle.tie();
      battle.inputLog.push('>forcetie');   // so replayBattle ends it the same way
      break;
    }
    let acted = false;
    for (const id of SIDES) {
      const side = battle[id];
      if (battle.ended || !side.activeRequest || side.activeRequest.wait || side.isChoiceDone()) continue;
      const { agent, rng } = sides[id];
      for (let attempt = 0; attempt < 4; attempt++) {
        const request = side.activeRequest;
        const before = JSON.stringify(request);
        // the cartridge AI reads the real numbers of the Pokémon in front of it, as the game does; nobody else does
        const extra = agent.information === 'cartridge' ? { foe: trueActive(battle, id === 'p1' ? 'p2' : 'p1') } : undefined;
        let d = agent.decide(request, views[id], rng, extra);
        if (run.override && run.override.side === id) {
          d = { ...d, choice: run.override.choice, label: run.override.label || run.override.choice, forcedBy: 'override' };
          run.override = null;
        }
        if (!d) break;
        const snapshot = rec.decisions ? views[id].snapshot() : null;
        if (battle.choose(id, d.choice)) {
          out.counts.decisions++;
          if (rec.decisions) {
            out.decisions.push({
              turn: snapshot.turn, side: id,
              forced: !!request.forceSwitch, choice: d.choice, label: d.label,
              options: d.options, ...(d.labels ? { labels: d.labels } : {}), scores: d.scores, why: d.why, knew: snapshot,
              ...(d.assumed ? { assumed: d.assumed } : {}), ...(d.reasons ? { reasons: d.reasons } : {}),
              ...(d.forcedBy ? { overridden: true } : {}),
            });
          }
          acted = true;
          break;
        }
        if (JSON.stringify(side.activeRequest) !== before) {
          out.counts.unavailable++;   // hidden information revealed (e.g. trapped): the request changed, ask again
          continue;
        }
        out.counts.invalid++;         // the engine refused a choice the agent thought legal: a bug, counted
        battle.choose(id, 'default');
        acted = true;
        break;
      }
      feed();
    }
    if (!acted) {
      if (++idle > 3) { out.end = 'stalled'; out.error = 'no side could act and the battle had not ended'; break; }
    } else idle = 0;
  }
  feed();
  out.turns = battle.turn;
  if (!out.end) out.end = battle.winner ? 'win' : 'tie';
  if (battle.winner) out.winner = SIDES.find((id) => battle[id].name === battle.winner) || null;
  for (const id of SIDES) { const r = remaining(battle, id); out.left[id] = r.left; out.hp[id] = r.hp; }
}

function finish(run, t0) {
  const { battle, out, rec, packed } = run;
  if (battle) {
    out.inputLog = [...battle.inputLog];
    const lines = omniscientLines(battle);
    out.hash = logHash(lines);
    if (rec.log) out.log = normalizeLog(lines);
    if (rec.analysis && out.end !== 'error') {
      try { out.members = analyzeLog(normalizeLog(lines), { p1: packed.p1.names, p2: packed.p2.names }); }
      catch (err) { out.analysisError = String(err?.message || err); }
    }
  }
  out.ms = Math.round((now() - t0) * 10) / 10;
  return out;
}

/** Replay a battle from its input log (Showdown's own record) and return its omniscient log. */
export function replayBattle(inputLog) {
  let battle;
  for (const line of inputLog) {
    if (line.startsWith('>start ')) battle = new Battle(JSON.parse(line.slice(7)));
    else if (line.startsWith('>player ')) {
      const [, id, json] = line.match(/^>player (p\d) (.*)$/);
      battle.setPlayer(id, JSON.parse(json));
    } else if (/^>p\d /.test(line)) battle.choose(line.slice(1, 3), line.slice(4));
    else if (line.startsWith('>reseed ')) battle.resetRNG(line.slice(8));
    else if (line.startsWith('>forcetie')) battle.tie();
  }
  return { log: normalizeLog(omniscientLines(battle)), hash: logHash(omniscientLines(battle)), ended: battle.ended,
           winner: battle.winner, turns: battle.turn };
}
