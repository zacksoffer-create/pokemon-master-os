// Summary statistics for a batch: win rates with an honest interval, side balance, battle length, and each
// member's contribution averaged over the battles it was in.

const Z95 = 1.959963984540054;

/** Wilson score interval for k successes in n trials (95%). */
export function wilson(k, n, z = Z95) {
  if (!n) return [0, 1];
  const p = k / n, z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const r3 = (x) => Math.round(x * 1000) / 1000;
const r1 = (x) => Math.round(x * 10) / 10;
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The summary of a batch, from A's point of view. `battles` are the mapped per-battle rows (winner 'a'|'b'|'draw'). */
export function summarize(battles) {
  const done = battles.filter((b) => b.end !== 'error' && b.end !== 'stalled');
  const n = done.length;
  const won = done.filter((b) => b.winner === 'a').length;
  const lost = done.filter((b) => b.winner === 'b').length;
  const drew = n - won - lost;
  const [lo, hi] = wilson(won, n);
  const side = (s) => {
    const xs = done.filter((b) => b.a_side === s);
    return { n: xs.length, won: xs.filter((b) => b.winner === 'a').length };
  };
  const pairs = new Map();
  for (const b of done) if (b.pair != null) pairs.set(b.pair, [...(pairs.get(b.pair) || []), b.winner]);
  const pairRows = [...pairs.values()].filter((w) => w.length === 2);
  const turns = done.map((b) => b.turns);
  const ends = {};
  for (const b of battles) ends[b.end] = (ends[b.end] || 0) + 1;

  const members = {};
  for (const who of ['a', 'b']) {
    const rows = new Map();
    for (const b of done) {
      for (const m of b.members?.[who] || []) {
        const r = rows.get(m.name) || { name: m.name, slot: m.slot, battles: 0, appeared: 0, kos: 0, fainted: 0,
                                         damage_dealt: 0, damage_taken: 0, switch_ins: 0, turns_active: 0 };
        r.battles++;
        if (m.switch_ins > 0) r.appeared++;
        r.kos += m.kos; r.fainted += m.fainted ? 1 : 0; r.damage_dealt += m.damage_dealt;
        r.damage_taken += m.damage_taken; r.switch_ins += m.switch_ins; r.turns_active += m.turns_active;
        rows.set(m.name, r);
      }
    }
    members[who] = [...rows.values()].sort((x, y) => x.slot - y.slot).map((r) => ({
      name: r.name, slot: r.slot,
      appeared: r3(r.appeared / (r.battles || 1)),
      kos_per_battle: r3(r.kos / (r.battles || 1)),
      fainted_rate: r3(r.fainted / (r.battles || 1)),
      damage_dealt_per_battle: r1(r.damage_dealt / (r.battles || 1)),
      damage_taken_per_battle: r1(r.damage_taken / (r.battles || 1)),
      switch_ins_per_battle: r3(r.switch_ins / (r.battles || 1)),
      turns_active_per_battle: r1(r.turns_active / (r.battles || 1)),
    }));
  }

  return {
    n, won, lost, drew,
    win_rate: r3(n ? won / n : 0),
    score: r3(n ? (won + drew / 2) / n : 0),
    win_rate_95: [r3(lo), r3(hi)],
    margin_95: r3((hi - lo) / 2),
    by_side: { a_as_p1: side('p1'), a_as_p2: side('p2') },
    pairs: {
      n: pairRows.length,
      a_won_both: pairRows.filter((w) => w[0] === 'a' && w[1] === 'a').length,
      b_won_both: pairRows.filter((w) => w[0] === 'b' && w[1] === 'b').length,
      split: pairRows.filter((w) => w[0] !== w[1]).length,
    },
    turns: { mean: r1(mean(turns)), median: median(turns), min: n ? Math.min(...turns) : 0, max: n ? Math.max(...turns) : 0 },
    left_a_when_won: r3(mean(done.filter((b) => b.winner === 'a').map((b) => b.left.a))),
    left_b_when_won: r3(mean(done.filter((b) => b.winner === 'b').map((b) => b.left.b))),
    ends,
    members,
    reading: n
      ? `${won} of ${n} won (${Math.round((100 * won) / n)}%); the 95% interval is ${Math.round(100 * lo)}–${Math.round(100 * hi)}%. ` +
        (hi - lo > 0.1 ? 'A difference smaller than that interval between two builds needs more battles before it means anything.' : '')
      : 'no completed battles',
  };
}
