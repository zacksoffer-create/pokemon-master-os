// Playmaker pass model, no browser: how often a pass gets tipped or picked by
// how close a defender is to its line and what kind of pass it is, how the
// placement of a pass decides the catch, and what each catch is worth.
const M = require('./pm_load')();
const { PMSim, Court3D, HoopPhysics } = M;
function mul(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const court = Court3D.COURTS.gym;
const pct = (n, N) => String(Math.round(n / N * 100)).padStart(3) + '%';
let fails = 0;
const check = (ok, label) => { if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label); };

// A pass from the top to a man D feet away down the left side, one defender
// standing `lane` feet off the middle of its line (on the rim side).
function lanePass(type, D, lane, beh, seed) {
  const S = [0, 26], dir = [-0.6, -0.8];
  const R = [S[0] + dir[0] * D, S[1] + dir[1] * D];
  const mid = [(S[0] + R[0]) / 2, (S[1] + R[1]) / 2], nrm = [0.8, -0.6];
  const dpos = [mid[0] + nrm[0] * lane, mid[1] + nrm[1] * lane];
  const board = { id: 't', scheme: 'packline', clock: 99, holder: 0,
    off: [[S[0], S[1], 'guard'], [R[0], R[1], 'shooter'], [22, 30, 'shooter'], [24, 3, 'shooter'], [-24, 33, 'big']],
    def: [null, null, [dpos[0], dpos[1], beh || null]] };
  const W = PMSim.create({ court, board, rand: mul(seed) });
  W.def.forEach(d => { d.face = [-nrm[0], 0, -nrm[1]]; });
  const v = [R[0] - S[0], 0, R[1] - S[1]], l = Math.hypot(v[0], v[2]);
  const P = PMSim.pass(W, { dir: [v[0] / l, 0, v[2] / l], dist: l, type, bend: 0 });
  return P.risk.outcome;
}
console.log('Tipped / picked by a defender standing off the middle of a 20 ft pass:');
console.log('  lane ft      ' + [0.5, 1.5, 2.5, 3.5, 4.5, 6].map(x => String(x).padStart(11)).join(''));
const table = {};
for (const type of ['bullet', 'chest', 'bounce', 'lob']) {
  for (const beh of [null, 'jump']) {
    const row = [];
    for (const lane of [0.5, 1.5, 2.5, 3.5, 4.5, 6]) {
      let tip = 0, pick = 0; const N = 200;
      for (let s = 0; s < N; s++) { const o = lanePass(type, 20, lane, beh, s + 1); if (o === 'tip') tip++; if (o === 'pick') pick++; }
      row.push(`${pct(tip, N)}/${pct(pick, N)}`);
      table[`${type}${beh ? '-jump' : ''}@${lane}`] = { tip: tip / N, pick: pick / N };
    }
    console.log(`  ${(type + (beh ? ' vs gambler' : '')).padEnd(18)}` + row.map(x => x.padStart(11)).join(''));
  }
}
const lost = k => table[k].tip + table[k].pick;
check(lost('chest@0.5') > 0.9, 'a chest pass right through a man gets picked');
check(lost('chest@6') < 0.05, 'six feet off the line, a chest pass is clean');
// a lob's job: over a man fronting the receiver
function frontPass(type, seed) {
  const board = { id: 't', scheme: 'packline', clock: 99, holder: 0,
    off: [[0, 26, 'guard'], [-4.5, 7.2, 'big'], [22, 30, 'shooter'], [24, 3, 'shooter'], [-24, 33, 'shooter']],
    def: [null, [-4.3, 10.2, 'front']] };
  const W = PMSim.create({ court, board, rand: mul(seed) });
  const v = [-4.5, 0, 7.2 - 26], l = Math.hypot(v[0], v[2]);
  return PMSim.pass(W, { dir: [v[0] / l, 0, v[2] / l], dist: l, type, bend: 0 }).risk.outcome;
}
const fr = t => { let n = 0; for (let s = 1; s <= 100; s++) if (frontPass(t, s) !== 'clean') n++; return n / 100; };
const frontLob = fr('lob'), frontChest = fr('chest'), frontBounce = fr('bounce');
console.log(`  over a fronting big: lob lost ${Math.round(frontLob * 100)}%, chest ${Math.round(frontChest * 100)}%, bounce ${Math.round(frontBounce * 100)}%`);
check(frontLob < 0.2 && frontChest > 0.8, 'a lob gets over a man fronting the post; a chest pass does not');
check(lost('bounce-jump@2.5') < lost('chest-jump@2.5'), 'a bounce gets under a gambler reaching for the chest pass');
check(lost('bullet@3.5') <= lost('chest@3.5'), 'a bullet beats the hand a slower pass would find');
const close = ['chest@2.5', 'chest@3.5', 'bounce@1.5'].some(k => lost(k) > 0.05 && lost(k) < 0.95);
check(close, 'close calls are a coin flip, clear ones are not');

// Placement: aim at a spot N feet from where a cutter will be when it gets there.
console.log('\nWhere the pass lands vs where he will be (cutter at speed):');
const qrow = [];
for (const off of [0, 1, 2, 3, 4, 5.5, 7, 9]) {
  const board = { id: 't', scheme: 'packline', clock: 99, holder: 0, off: [[0, 26, 'guard'], [18, 19, 'slasher'], [-22, 30, 'shooter'], [-24, 3, 'shooter'], [-24, 33, 'big']], def: [] };
  const W = PMSim.create({ court, board, rand: mul(3) });
  const O = W.off[1];
  O.state = 'cut'; O.route = [[9, 0, 12], [2, 0, 7.5]]; O.ri = 0; O.vel = [-12, 0, -9];
  const est = PMSim.makePass([0, 0, 26], [4, 0, 9], 'bounce', {});
  const at = PMSim.predict(W, 1, est.T);
  const tgt = [at[0] + off, 0, at[2] + off * 0.3];
  const v = [tgt[0], 0, tgt[2] - 26], l = Math.hypot(v[0], v[2]);
  const P = PMSim.pass(W, { dir: [v[0] / l, 0, v[2] / l], dist: l, type: 'bounce', bend: 0 });
  qrow.push(`${off}ft:${P.q}`);
}
console.log('  ' + qrow.join('  '));
check(qrow[0].endsWith('money') && qrow[1].endsWith('money'), 'leading him within about a foot and a half finds his hands');
check(qrow[4].endsWith('reach') || qrow[3].endsWith('reach'), 'a few feet off, he has to reach for it');
check(qrow[7].endsWith('none'), 'way off, it is nobody\'s pass');

// What a catch is worth: catch-and-shoot by catch quality and contest.
console.log('\nCatch-and-shoot makes (shooter, 300 each):');
const spots = { corner: Court3D.spotInfo(court, 'rc').pos, wing: Court3D.spotInfo(court, 'rw').pos };
const make = {};
for (const [name, pos] of Object.entries(spots)) {
  const row = [];
  for (const q of ['money', 'reach', 'chase']) for (const c of [0, 0.3, 0.6]) {
    let m = 0; const N = 300;
    for (let s = 0; s < N; s++) {
      const board = { id: 't', scheme: 'packline', clock: 99, holder: 0, off: [[pos[0], pos[2], 'shooter'], [0, 26, 'guard'], [-18, 19, 'shooter'], [-22, 4, 'shooter'], [-5, 7, 'big']], def: c ? [[pos[0] - 3 * Math.sign(pos[0]), pos[2] + 0.5]] : [] };
      const W = PMSim.create({ court, board, rand: mul(s + 7) });
      if (c && W.def[0]) { W.def[0].d = null; W.def[0].height = 1; W.def[0].reachK = 1; W.def[0].pos = [pos[0] - Math.sign(pos[0]) * (6.8 - c * 4.8), 0, pos[2] + 0.4]; }
      W.off[0].q = q;
      PMSim.takeShot(W, 0, 'jumper');
      for (let i = 0; i < 400 && !W.over; i++) PMSim.update(W, 1 / 60);
      if (W.result && W.result.made) m++;
    }
    row.push(`${q[0]}${c}:${pct(m, N)}`);
    make[`${name}-${q}-${c}`] = m / N;
  }
  console.log('  ' + name.padEnd(7) + row.join(' '));
}
check(make['corner-money-0'] > 0.55 && make['corner-money-0'] < 0.82, 'a rhythm corner three goes in a lot, not always');
check(make['corner-money-0'] > make['corner-reach-0'] + 0.08, 'on the money beats a late catch');
check(make['corner-money-0'] > make['corner-money-0.6'] + 0.15, 'an open look beats a contested one');
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
process.exit(fails ? 1 : 0);
