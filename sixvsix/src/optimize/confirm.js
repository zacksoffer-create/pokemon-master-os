// The 6v6 check on the EV optimizer (D-072, D-074). The duel model ranks spreads one-on-one; a 6v6 battle also asks a
// Pokémon to switch into hits, revenge-kill and sweep. So for each member the simulator plays the whole team twice
// against the whole league with the same seeds and trainer agents on both sides: once with the duel-optimized spread,
// once with the conventional competitive spread (252 in its attacking side, 252 Speed), on the same nature.
// D-074 (Zack): a tie goes to the conventional spread. The duel spread is kept only when the battles show it's
// better: McNemar p < 0.05 with the duel spread winning more, or a 95% interval on the HP margin entirely in its
// favour. The natures stay (D-074: the optimizer's choices where none is on record, the recorded ones otherwise);
// only the EVs are in question. Every comparison is kept as evidence.

import { comparePoolWith } from '../compare.js';
import { syncRunner } from '../runner.js';
import { spreadLabel } from './evs.js';

/** The team with member `i` on its conventional spread, keeping its nature (D-074). */
export function withConventional(team, i, r) {
  const conv = r.conventional;
  return {
    ...team,
    members: team.members.map((x, k) => (k !== i ? x : { ...x, evs: conv.evs,
      filled: [...x.filled.filter((f) => !f.startsWith('EVs:')),
        `EVs: ${spreadLabel(conv.evs)} (D-072, D-074: the conventional spread, kept after the 6v6 check)`] })),
  };
}

/** Did the duel spread (x) beat the conventional one (y) by enough to keep it? */
export const duelWins = (c) => (c.significant && c.x.won > c.y.won) || c.margin.ci95[1] < 0;

/**
 * Check each member's spread in 6v6 battles. `report.members[i]` is the optimizer's report for member i, or null
 * for a member not to check (a variation checks only what it changed). Runs on `runner` (default: this thread).
 */
export async function confirmSpreads({ team, report, pool, ruleset, profile, opponentProfile, n = 16, seed = 'confirm', onMember, runner }) {
  const run = runner || syncRunner({ yieldEvery: 0 });
  let current = team;
  const rows = [];
  for (let i = 0; i < team.members.length; i++) {
    const m = team.members[i], r = report.members[i];
    if (!r) { rows.push(null); continue; }
    const conv = r.conventional;
    const same = spreadLabel(conv.evs) === spreadLabel(current.members[i].evs);
    if (same) { rows.push({ species: m.species, kept: 'duel', note: 'the duel spread is the conventional one' }); continue; }
    const withConv = { ...withConventional(current, i, r), id: `${team.id}#conv${i}` };
    const c = await comparePoolWith(run, { x: { team: current, profile, label: 'duel spread' }, y: { team: withConv, profile, label: 'conventional spread' },
                                           pool, ruleset, n, seed: `${seed}|${i}`, opponentProfile });
    const keepDuel = duelWins(c);
    rows.push({
      species: m.species, kept: keepDuel ? 'duel' : 'conventional',
      duel: { nature: current.members[i].nature, spread: spreadLabel(current.members[i].evs), win_rate: c.x.win_rate },
      conventional: { nature: current.members[i].nature, spread: spreadLabel(conv.evs), win_rate: c.y.win_rate },
      pairs: c.pairs, mcnemar_p: c.mcnemar_p, margin: c.margin, reading: c.reading,
    });
    if (!keepDuel) current = { ...withConv, id: team.id };
    if (onMember) onMember(rows[rows.length - 1]);
  }
  return { team: current, rows, n_per_opponent: n, seed, pool: pool.id, ruleset: typeof ruleset === 'string' ? ruleset : ruleset.id,
           rule: 'D-074: the conventional spread unless the duel spread is measurably better' };
}
