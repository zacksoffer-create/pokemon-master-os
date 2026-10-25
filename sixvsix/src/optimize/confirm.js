// The 6v6 check on the EV optimizer (D-072). The duel model ranks spreads one-on-one; a 6v6 battle also asks a
// Pokémon to switch into hits, revenge-kill and sweep. So for each member the simulator plays the whole team twice
// against the whole league with the same seeds and trainer agents on both sides: once with the duel-optimized spread,
// once with the conventional competitive spread (252 in its attacking side, 252 Speed, the best nature for it). The
// duel spread stays unless the conventional one is measurably better: McNemar p < 0.05 on wins, or a 95% interval
// on the HP margin that sits above zero. Every comparison is kept as evidence.

import { comparePool } from '../compare.js';
import { spreadLabel } from './evs.js';

/** The team with member `i` on its conventional spread (and the nature that goes with it). */
export function withConventional(team, i, r) {
  const conv = r.conventional;
  return {
    ...team,
    members: team.members.map((x, k) => (k !== i ? x : { ...x, evs: conv.evs, nature: conv.nature,
      filled: [...x.filled.filter((f) => !f.startsWith('EVs:') && !f.startsWith('nature:')),
        `EVs: ${spreadLabel(conv.evs)} (D-072: the conventional spread, kept after the 6v6 check)`,
        ...(r.nature_chosen ? [`nature: ${conv.nature} (chosen with the conventional spread; none on record)`] : [])] })),
  };
}

export function confirmSpreads({ team, report, pool, ruleset, profile, opponentProfile, n = 16, seed = 'confirm', onMember }) {
  let current = team;
  const rows = [];
  team.members.forEach((m, i) => {
    const r = report.members[i];
    const conv = r.conventional;
    const same = conv.nature === current.members[i].nature && spreadLabel(conv.evs) === spreadLabel(current.members[i].evs);
    if (same) { rows.push({ species: m.species, kept: 'duel', note: 'the duel spread is the conventional one' }); return; }
    const withConv = { ...withConventional(current, i, r), id: `${team.id}#conv${i}` };
    const c = comparePool({ x: { team: current, profile, label: 'duel spread' }, y: { team: withConv, profile, label: 'conventional spread' },
                            pool, ruleset, n, seed: `${seed}|${i}`, opponentProfile });
    const switchTo = (c.significant && c.y.won > c.x.won) || c.margin.ci95[0] > 0;
    rows.push({
      species: m.species, kept: switchTo ? 'conventional' : 'duel',
      duel: { nature: current.members[i].nature, spread: spreadLabel(current.members[i].evs), win_rate: c.x.win_rate },
      conventional: { nature: conv.nature, spread: spreadLabel(conv.evs), win_rate: c.y.win_rate },
      pairs: c.pairs, mcnemar_p: c.mcnemar_p, margin: c.margin, reading: c.reading,
    });
    if (switchTo) current = { ...withConv, id: team.id };
    if (onMember) onMember(rows[rows.length - 1]);
  });
  return { team: current, rows, n_per_opponent: n, seed, pool: pool.id, ruleset: typeof ruleset === 'string' ? ruleset : ruleset.id };
}
