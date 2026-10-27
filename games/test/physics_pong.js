// Monte Carlo for Pong Night: make rates by shot type, cup row and exposure,
// and how fast they fall off outside the window. Node only.
const load = require('./load');
const { PongPhysics: P, Pong } = load(['pong/physics.js', 'pong/rules.js']);

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = mulberry(42);
const N = +(process.argv[2] || 120);
const SNAP = +(process.env.SNAP || 0.1), FASTW = +(process.env.FASTW || 0.1);

// flick inputs that aim at a cup: power for depth, angle for line
function aimFor(cup, kind) {
  const from = P.RELEASE.near;
  const yawDeg = Math.atan2(cup.x - from[0], cup.z - from[2]) * 180 / Math.PI;
  const angle = yawDeg / P.AIM_GAIN;
  const p = kind === 'fast' ? P.FAST_IDEAL : P.P0[kind] + (cup.z - P.Z_REF) / P.DEPTH_PER;
  return { p, angle };
}
function rate(cups, cup, kind, opts) {
  const o = opts || {};
  let made = 0, inTarget = 0, rims = 0, two = 0;
  for (let i = 0; i < N; i++) {
    const fresh = cups.map(c => Object.assign({}, c));
    const a = aimFor(cup, kind);
    const p = a.p * (o.ratio || 1) * (1 + P.gauss(rand) * (o.sigP || 0));
    const angle = a.angle + (o.dAng || 0) + P.gauss(rand) * (o.sigA || 0);
    const shot = P.throwBall({ kind, side: 'near', cups: fresh, p, angle, curl: o.curl || 0, snap: SNAP, fastWindow: FASTW, contest: o.contest || 0, rand });
    const b = P.simulate(shot.release, shot.vel, fresh, { touch: shot.touch, spinOut: shot.spinOut, spinDir: shot.spinDir });
    if (b.result === 'made') { made++; if (b.sunk === cup.id) inTarget++; if (b.bounces) two++; }
    if (b.rimHits) rims++;
  }
  return { made: Math.round(made / N * 100), target: Math.round(inTarget / N * 100), rims: Math.round(rims / N * 100), bounce: Math.round(two / N * 100) };
}
const fmt = r => `${String(r.made).padStart(3)}% (in target ${String(r.target).padStart(3)}%, rim ${String(r.rims).padStart(3)}%${r.bounce ? ', bounced ' + r.bounce + '%' : ''})`;

const full = Pong.layout('tri10', 'far');
const head = full[9], mid = full[5], backC = full[1], backE = full[0];
console.log('Full rack. Exposure: head', Pong.exposure(head, full, 'far'), '· middle', Pong.exposure(mid, full, 'far'), '· back', Pong.exposure(backC, full, 'far'));
console.log('\nGreen throws (perfect input), full rack:');
for (const [name, c] of [['head', head], ['middle', mid], ['back center', backC], ['back edge', backE]]) {
  for (const k of ['arc', 'fast', 'bounce']) console.log(`  ${k.padEnd(6)} at ${name.padEnd(11)} ${fmt(rate(full, c, k))}`);
}

console.log('\nHuman-ish touch (6% power sd, 3° aim sd):');
for (const [name, c] of [['head', head], ['middle', mid], ['back center', backC]]) {
  for (const k of ['arc', 'fast', 'bounce']) console.log(`  ${k.padEnd(6)} at ${name.padEnd(11)} ${fmt(rate(full, c, k, { sigP: 0.06, sigA: 3 }))}`);
}

console.log('\nIsland cup (one cup left, back center), decent (6%, 3°) / casual (10%, 5°):');
const isl = Pong.layout('island1', 'far');
for (const k of ['arc', 'fast', 'bounce']) console.log(`  ${k.padEnd(6)} ${fmt(rate(isl, isl[0], k, { sigP: 0.06, sigA: 3 }))}  |  ${fmt(rate(isl, isl[0], k, { sigP: 0.1, sigA: 5 }))}`);
console.log('\nFull rack, casual (10%, 5°), aiming at the middle:');
for (const k of ['arc', 'bounce']) console.log(`  ${k.padEnd(6)} ${fmt(rate(full, mid, k, { sigP: 0.1, sigA: 5 }))}`);
console.log('  fast   at head ' + fmt(rate(full, head, 'fast', { sigP: 0.1, sigA: 5 })));

console.log('\nStoplight (3 in a line), human-ish touch, aiming at the front:');
const st = Pong.layout('line3', 'far');
for (const k of ['arc', 'fast']) console.log(`  ${k.padEnd(6)} ${fmt(rate(st, st[2], k, { sigP: 0.06, sigA: 3 }))}`);

console.log('\nPower sweep at the island (no aim error):');
for (const k of ['arc', 'fast', 'bounce']) {
  const row = [0.85, 0.92, 0.96, 1, 1.04, 1.08, 1.15, 1.3].map(r => `${r.toFixed(2)}:${rate(isl, isl[0], k, { ratio: r }).made}%`).join(' ');
  console.log(`  ${k.padEnd(6)} ${row}`);
}
console.log('\nAim sweep at the island, arc (flick degrees off):');
console.log('  ' + [0, 2, 4, 6, 8, 12].map(d => `${d}°:${rate(isl, isl[0], 'arc', { dAng: d }).made}%`).join(' '));

console.log('\nSpin at the island, arc, right at the edges of the window (short 0.96 / long 1.055):');
for (const r of [0.96, 1.055]) console.log(`  ${r}: ` + [0, 0.07, 0.15, 0.4].map(c => { const x = rate(isl, isl[0], 'arc', { ratio: r, curl: c }); return `curl ${c}: ${x.made}%`; }).join(' · '));

console.log('\nContest (Waver arms up) at the island, arc, perfect input:');
console.log('  ' + [0, 0.5, 1].map(c => `${c}:${rate(isl, isl[0], 'arc', { contest: c }).made}%`).join(' '));

console.log('\nComputer throwers (arc at a full rack middle / fastball head / island arc):');
for (const s of [0.55, 0.6, 0.7, 0.84]) {
  const res = [['arc', mid, full], ['fast', head, full], ['arc', isl[0], isl]].map(([k, c, cups]) => {
    let m = 0;
    for (let i = 0; i < N; i++) { const fr = cups.map(x => Object.assign({}, x)); const t = P.cpuThrow('far', Object.assign({}, c, { z: 8 - c.z, x: -c.x }), k, s, rand); const cc = fr.map(x => Object.assign(x, { z: 8 - x.z, x: -x.x })); const b = P.simulate(t.release, t.vel, cc); if (b.result === 'made') m++; }
    return Math.round(m / N * 100) + '%';
  });
  console.log(`  skill ${s}: ${res.join(' / ')}`);
}
