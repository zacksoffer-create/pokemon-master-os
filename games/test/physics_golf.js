// Golf physics by the numbers: carry and roll by club, what wind does to each
// trajectory, how much a bent swing curves it, lies, and putts by pace and line.
const load = require('./load');
const { GolfPhysics: P } = load(['golf/physics.js']);
const MPH = P.MPH;
const r1 = v => Math.round(v);
function shot(club, type, power, opt) {
  const o = opt || {};
  const s = P.strike({ club, power, type, tempo: o.tempo == null ? 1 : o.tempo, angle: 0, curl: o.curl || 0, lie: o.lie || 'fairway', window: 0.22, aimDead: 6 });
  const vel = P.launchVel(s.speed, s.launch, s.start);
  const r = P.simulate({ pos: [0, 0, 0], vel, spin: s.spin * P.RPM, tilt: s.tilt }, { wind: o.wind, surfaceAt: () => o.surf || 'fairway' });
  return { carry: r.carry, total: r.total, apex: r.apex * 3, side: r.land[0], rest: r.rest[0], la: r.landAngle || 0, tempo: s.tempo };
}
const into = m => [0, 0, -m * MPH], down = m => [0, 0, m * MPH], cross = m => [m * MPH, 0, 0];

console.log('stock carry / total / apex ft (fairway), and roll on a green');
for (const c of P.CLUBS) {
  if (c.putter) continue;
  const f = shot(c.id, 'stock', 1), g = shot(c.id, 'stock', 1, { surf: 'green' });
  console.log(`  ${c.id.padEnd(3)} ${String(r1(f.carry)).padStart(3)} / ${String(r1(f.total)).padStart(3)} / ${String(r1(f.apex)).padStart(3)} ft   green roll ${r1(g.total - g.carry)}`);
}

console.log('\n7 iron by trajectory and wind: carry (total on a green)');
const winds = [['calm', null], ['into 10', into(10)], ['into 18', into(18)], ['down 15', down(15)]];
for (const [n, w] of winds) {
  const row = ['knock', 'stock', 'high'].map(t => { const s = shot('7i', t, 1, { wind: w, surf: 'green' }); return `${t} ${r1(s.carry)} (${r1(s.total)})`; });
  console.log(`  ${n.padEnd(8)} ${row.join('   ')}`);
}

console.log('\nCrosswind 15 mph left to right, 7 iron: where it lands sideways (yds, + right)');
for (const [n, c] of [['straight', 0], ['draw', 0.12], ['big draw', 0.22], ['fade', -0.12]]) {
  const s = shot('7i', 'stock', 1, { wind: cross(15), curl: c }), k = shot('7i', 'knock', 1, { wind: cross(15), curl: c }), calm = shot('7i', 'stock', 1, { curl: c });
  console.log(`  ${n.padEnd(9)} stock ${s.side.toFixed(1).padStart(5)}   knockdown ${k.side.toFixed(1).padStart(5)}   no wind ${calm.side.toFixed(1).padStart(5)}`);
}

console.log('\nLies');
const rough = shot('7i', 'stock', 1, { lie: 'rough', surf: 'green' }), clean = shot('7i', 'stock', 1, { surf: 'green' });
console.log(`  7 iron from the rough: carry ${r1(rough.carry)} vs ${r1(clean.carry)} clean, rolls ${r1(rough.total - rough.carry)} vs ${r1(clean.total - clean.carry)} on the green`);
const n15 = P.powerFor('SW', 15);
for (const [t, pw] of [['high', n15 * 1.5], ['stock', n15 * 1.5], ['knock', n15 * 1.5], ['high at the number', n15]]) {
  const s = shot('SW', t.split(' ')[0], pw, { lie: 'bunker', surf: 'green' });
  console.log(`  bunker, 15 yds out, ${t.padEnd(18)} carry ${r1(s.carry)} total ${r1(s.total)}`);
}

console.log('\nTempo: 7 iron stock carry and start line by tempo (1 = yours)');
for (const t of [0.6, 0.8, 0.9, 1, 1.1, 1.2, 1.4]) {
  const s = P.strike({ club: '7i', power: 1, type: 'stock', tempo: t, angle: 0, curl: 0, lie: 'fairway', window: 0.22, aimDead: 6 });
  const r = P.simulate({ pos: [0, 0, 0], vel: P.launchVel(s.speed, s.launch, s.start), spin: s.spin * P.RPM, tilt: s.tilt }, { noGround: true });
  console.log(`  ${t.toFixed(1)} ${s.tempo.padEnd(6)} carry ${r1(r.carry)}  lands ${r.land[0].toFixed(1)} yds ${r.land[0] < 0 ? 'left' : 'right'}`);
}

// putts: rolls on a sloped green; makes by pace for a few reads
function putt(d, slope, ratio, aimDeg, stimp) {
  const roll = 6 / (stimp || 10);
  const v = P.puttSpeedFor(d, roll) * ratio;
  const h = P.heading(aimDeg || 0);
  const r = P.simulate({ pos: [0, 0, -d], vel: [h[0] * v, 0, h[2] * v], rolling: true }, { surfaceAt: () => 'green', slopeAt: () => slope, greenRoll: roll, cup: [0, 0] });
  return r;
}
console.log('\nPutts: made out of 21 aims (-2 to +2 degrees) at each pace');
const reads = [['6 ft flat', 2, [0, 0]], ['10 ft uphill', 3.3, [0, 0.02]], ['10 ft downhill', 3.3, [0, -0.02]], ['12 ft breaker', 4, [0.022, 0]]];
for (const [n, d, sl] of reads) {
  const row = [0.8, 0.9, 1, 1.15, 1.35].map(k => {
    let made = 0, lips = 0, best = null;
    for (let a = -2; a <= 2.001; a += 0.2) { const r = putt(d, sl, k, a); if (r.holed) made++; if (r.events.some(e => e.type === 'lip')) lips++; }
    return `${k.toFixed(2)}x ${String(made).padStart(2)}${lips ? ' (' + lips + ' lip)' : ''}`;
  });
  console.log(`  ${n.padEnd(15)} ${row.join('  ')}`);
}
// where a breaker has to be aimed
let bestAim = null;
for (let a = -12; a <= 12; a += 0.25) { const r = putt(4, [0.022, 0], 1, a); if (r.holed && bestAim == null) bestAim = a; }
console.log(`  12 ft breaker rising to the right: first holing aim ${bestAim} degrees (right is +)`);
