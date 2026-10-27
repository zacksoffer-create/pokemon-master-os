// Node-only checks of the hitting physics: pitch movement by type, carry by
// exit velocity and launch angle, and what different swings produce.
const load = require('./load');
const { Pitch, Contact, Field, Pitchers } = load(['bat/pitch.js', 'bat/contact.js', 'bat/field.js', 'bat/pitchers.js']);
let seed = 11; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const g = () => Pitch.gauss(rand);

console.log('Pitch movement vs a fastball aimed at the same spot (inches, catcher view: + is right, + is up), flight time:');
const ff = Pitch.make({ type: 'FF', throws: 'R', slot: 'three', aim: [0, 2.5] });
for (const t of Object.keys(Pitch.TYPES)) {
  const p = Pitch.make({ type: t, throws: 'R', slot: 'three', aim: [0, 2.5] });
  // where it was headed out of the hand: the straight line it started on
  const tAt = p.T * 0.3, a = Pitch.at(p, tAt), v = Pitch.vel(p, tAt);
  const k = (Pitch.PLATE_Z - a[2]) / v[2];
  const straight = [a[0] + v[0] * k, a[1] + v[1] * k];
  console.log('  ' + t.padEnd(3), `${p.mph} mph`, 'T', p.T.toFixed(3), 'break from where it looked headed:', ((0 - straight[0]) * 12).toFixed(1).padStart(6), ((2.5 - straight[1]) * 12).toFixed(1).padStart(6));
}

console.log('\nCarry (feet / hang time) by exit velocity and launch angle:');
for (const ev of [90, 100, 105, 110]) console.log('  ' + ev, [10, 15, 20, 25, 30, 35, 45].map(la => { const f = Field.fly(ev, la, 0, Math.max(300, Math.min(3400, la * 95 - 300)), [0, 2.6, 1.42]); return `${la}°:${f.dist}/${f.hang.toFixed(1)}${f.end === 'hr' ? 'HR' : ''}`; }).join('  '));

function run(label, n, mk) {
  const t = {}; let ev = 0, evn = 0, barrels = 0, hits = 0;
  for (let i = 0; i < n; i++) {
    const q = mk();
    const c = Contact.swing(Object.assign({ rand, bats: 'R', window: 0.022 }, q));
    let k;
    if (c.whiff) k = 'whiff'; else if (c.foul) k = 'foul';
    else { const r = Field.play(c, { outs: 0, runners: [0, 0, 0], bats: 'R' }, rand); k = r.kind === 'out' ? r.outType + ' out' : r.kind; ev += c.ev; evn++; if (c.barrel) barrels++; if (!r.out && r.kind !== 'foul') hits++; }
    t[k] = (t[k] || 0) + 1;
  }
  const s = Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / n * 100)}%`).join(', ');
  console.log('  ' + label.padEnd(40), 'EV', evn ? (ev / evn).toFixed(0) : ' -', ' hits', String(Math.round(hits / n * 100)).padStart(3) + '%', ' |', s);
  return { hits: hits / n, t, n };
}
const fb = aim => Pitch.make({ type: 'FF', throws: 'R', slot: 'three', aim: aim || [0, 2.5] });
console.log('\nSwings vs a 94 mph fastball:');
const perfect = run('perfect: on time, barrel on it, uppercut', 400, () => ({ pitch: fb(), e: 0, pci: [0, 2.5], plane: 30, power: 1, kind: 'power' }));
run('perfect timing, level swing', 400, () => ({ pitch: fb(), e: 0, pci: [0, 2.5], plane: 0, power: 1, kind: 'power' }));
run('perfect timing, chopping down', 400, () => ({ pitch: fb(), e: 0, pci: [0, 2.5], plane: -30, power: 1, kind: 'power' }));
const good = run('good: ±20 ms, barrel ±0.12 ft', 600, () => ({ pitch: fb(), e: g() * 0.02, pci: [g() * 0.12, 2.5 + g() * 0.12], plane: 25 + g() * 8, power: 0.7, kind: 'power' }));
run('ok: ±40 ms, barrel ±0.2 ft', 600, () => ({ pitch: fb(), e: g() * 0.04, pci: [g() * 0.2, 2.5 + g() * 0.2], plane: 20 + g() * 15, power: 0.6, kind: 'power' }));
run('short contact swing, ±40 ms', 600, () => ({ pitch: fb(), e: g() * 0.04, pci: [g() * 0.2, 2.5 + g() * 0.2], plane: 10 + g() * 10, power: 0.5, kind: 'contact' }));
const early = run('80 ms early', 300, () => ({ pitch: fb(), e: -0.08 + g() * 0.01, pci: [0, 2.5], plane: 20, power: 0.8, kind: 'power' }));
run('80 ms late', 300, () => ({ pitch: fb(), e: 0.08 + g() * 0.01, pci: [0, 2.5], plane: 20, power: 0.8, kind: 'power' }));
const way = run('140 ms off', 200, () => ({ pitch: fb(), e: (rand() < 0.5 ? -1 : 1) * 0.14, pci: [0, 2.5], plane: 20, power: 0.8, kind: 'power' }));

console.log('\nThe reads:');
const chase = run('chasing high heat (3.95 ft), barrel middle', 300, () => ({ pitch: fb([0, 3.95]), e: g() * 0.02, pci: [0, 2.6], plane: 20, power: 0.8, kind: 'power' }));
const chase2 = run('chasing high heat, barrel up there', 300, () => ({ pitch: fb([0, 3.95]), e: g() * 0.02, pci: [0, 3.95], plane: 20, power: 0.8, kind: 'power' }));
const fooled = run('changeup on fastball timing', 300, () => { const p = Pitch.make({ type: 'CH', throws: 'R', slot: 'three', aim: [0.5, 1.9] }); return { pitch: p, e: -(p.T - ff.T) + g() * 0.02, pci: [0.2, 2.4], plane: 20, power: 0.8, kind: 'power' }; });
const waited = run('changeup, waited on it', 300, () => { const p = Pitch.make({ type: 'CH', throws: 'R', slot: 'three', aim: [0.5, 1.9] }); return { pitch: p, e: g() * 0.02, pci: [0.45, 1.95], plane: 15, power: 0.6, kind: 'power' }; });
const sweepOff = run('sweeper off the plate, barrel middle', 300, () => { const p = Pitch.make({ type: 'SW', throws: 'R', slot: 'low', aim: [1.25, 2.3] }); return { pitch: p, e: g() * 0.02, pci: [0.1, 2.4], plane: 20, power: 0.8, kind: 'power' }; });
const sinkLow = run('sinker at the knees, barrel set up high', 300, () => { const p = Pitch.make({ type: 'SI', throws: 'R', slot: 'three', aim: [0.1, 1.7] }); return { pitch: p, e: g() * 0.02, pci: [0, 2.8], plane: 20, power: 0.8, kind: 'power' }; });

console.log('\nBatted balls into the defense (hit rate by type):');
const bins = { ground: [-30, 10], line: [10, 25], fly: [25, 50], pop: [50, 80] };
for (const [name, [lo, hi]] of Object.entries(bins)) {
  const row = [];
  for (const evc of [75, 90, 102]) {
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const la = lo + rand() * (hi - lo), ev = evc + g() * 4, spray = -42 + rand() * 84;
      const r = Field.play({ ev, la, spray, spin: la > 0 ? Math.max(300, la * 95 - 300) : -600, bx: 0, by: 2.5 }, { outs: 0, runners: [0, 0, 0] }, rand);
      if (!r.out && r.kind !== 'foul') hits++;
    }
    row.push(`${evc} mph ${Math.round(hits / 4)}%`);
  }
  console.log('  ' + name.padEnd(7), row.join('   '));
}

console.log('\nSituations:');
const sac = { n: 0, scored: 0 };
for (let i = 0; i < 400; i++) { const r = Field.play({ ev: 88 + g() * 6, la: 32 + g() * 5, spray: -30 + rand() * 60, spin: 2600, bx: 0, by: 2.5 }, { outs: 1, runners: [0, 0, 1] }, rand); sac.n++; if (r.runs) sac.scored++; }
const gb3 = { n: 0, scored: 0 };
for (let i = 0; i < 400; i++) { const r = Field.play({ ev: 85 + g() * 6, la: -5 + g() * 4, spray: -35 + rand() * 30, spin: -600, bx: 0, by: 2.5 }, { outs: 1, runners: [0, 0, 1] }, rand); gb3.n++; if (r.runs) gb3.scored++; }
const right = { n: 0, moved: 0 }, left = { n: 0, moved: 0 };
for (let i = 0; i < 400; i++) {
  const rr = Field.play({ ev: 82 + g() * 6, la: -4 + g() * 4, spray: 10 + rand() * 30, spin: -600, bx: 0, by: 2.5 }, { outs: 0, runners: [0, 1, 0] }, rand); right.n++; if (rr.runnersAfter[2] || rr.runs) right.moved++;
  const rl = Field.play({ ev: 82 + g() * 6, la: -4 + g() * 4, spray: -40 + rand() * 30, spin: -600, bx: 0, by: 2.5 }, { outs: 0, runners: [0, 1, 0] }, rand); left.n++; if (rl.runnersAfter[2] || rl.runs) left.moved++;
}
const dp = { n: 0, dp: 0 };
for (let i = 0; i < 400; i++) { const r = Field.play({ ev: 95 + g() * 5, la: -6 + g() * 3, spray: -15 + rand() * 30, spin: -600, bx: 0, by: 2.5 }, { outs: 0, runners: [1, 0, 0] }, rand); dp.n++; if (r.dp) dp.dp++; }
console.log(`  runner on 3rd, 1 out, medium fly to the outfield: scores ${Math.round(sac.scored / sac.n * 100)}%`);
console.log(`  runner on 3rd, 1 out, grounder to the left side: scores ${Math.round(gb3.scored / gb3.n * 100)}%`);
console.log(`  runner on 2nd, 0 out, grounder to the right side: moves up ${Math.round(right.moved / right.n * 100)}%; to the left side: ${Math.round(left.moved / left.n * 100)}%`);
console.log(`  runner on 1st, hard grounder up the middle: double play ${Math.round(dp.dp / dp.n * 100)}%`);

console.log('\nPitch selection by count (share of pitches out of the zone):');
for (const id of Pitchers.IDS) {
  const P = Pitchers.PITCHERS[id];
  const row = [];
  for (const [b, s] of [[0, 0], [2, 0], [0, 2], [3, 2]]) {
    let outside = 0;
    for (let i = 0; i < 400; i++) { const n = Pitchers.nextPitch(P, b, s, 'R', rand); const p = Pitch.make({ type: n.typeId, over: n.over, throws: P.throws, slot: P.slot, aim: n.aim }); const x = Pitch.at(p, p.T); if (!Pitch.isStrike(x[0], x[1])) outside++; }
    row.push(`${b}-${s}: ${Math.round(outside / 4)}%`);
  }
  console.log('  ' + P.name.padEnd(24), row.join('  '));
}

const checks = [
  ['perfect swing hits', perfect.hits > 0.85],
  ['good swing hits .300+', good.hits > 0.3],
  ['way off whiffs', (way.t.whiff || 0) / way.n > 0.95],
  ['chase with barrel in the middle whiffs', (chase.t.whiff || 0) / chase.n > 0.9],
  ['chase with barrel up there is weak', chase2.hits < 0.25],
  ['fooled by the changeup', fooled.hits < 0.2],
  ['waiting on the changeup works', waited.hits > fooled.hits + 0.15],
  ['sweeper off the plate is a whiff', (sweepOff.t.whiff || 0) / sweepOff.n > 0.8],
  ['sac fly scores', sac.scored / sac.n > 0.6],
  ['right side moves the runner more than the left', right.moved / right.n > left.moved / left.n + 0.2]
];
console.log('\n' + checks.map(([k, ok]) => `${ok ? 'PASS' : 'FAIL'}  ${k}`).join('\n'));
if (checks.some(c => !c[1])) process.exitCode = 1;
