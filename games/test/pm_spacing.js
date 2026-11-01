// Playmaker spacing and help, no browser: shooters stand on the arc where
// they'll shoot it, the big lives at the dunker spot, and Casual passing
// finds the man you meant (and still punishes the wrong read).
const M = require('./pm_load')();
const { PMSim, Court3D } = M;
function mul(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const unitTo = (a, b) => { const v = [b[0] - a[0], 0, b[2] - a[2]]; const l = Math.hypot(v[0], v[2]) || 1; return [v[0] / l, 0, v[2] / l]; };
const H = W => W.off[W.handler];
const step = (W, sec, f) => { for (let i = 0; i < Math.round(sec * 60); i++) { if (f) f(); PMSim.update(W, 1 / 60); } };
const rimD = p => Math.hypot(p[0], p[2] - 5.25);
const behindLine = (W, p) => rimD(p) - Court3D.threeDist(W.court, Court3D.polarOf(p).angle);
const CASUAL = { tol: 30, distW: 22, auto: true };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
function cross(W, pt) {
  const h = H(W).pos, d = Court3D.dirToRim(h), sv = [-d[2], 0, d[0]];
  const want = Math.sign((pt[0] - h[0]) * sv[0] + (pt[2] - h[2]) * sv[2]) || 1;
  const lat = [h[0] - want * sv[0] * 8 + d[0] * 3, 0, h[2] - want * sv[2] * 8 + d[2] * 3];
  step(W, 0.22, () => PMSim.driveInput(W, unitTo(H(W).pos, lat)));
}
function driveToHelp(W, pt, sec) {
  cross(W, pt);
  for (let i = 0; i < (sec || 1.6) * 60; i++) {
    if (W.over || W.ball.state !== 'held') return;
    PMSim.driveInput(W, unitTo(H(W).pos, pt)); PMSim.update(W, 1 / 60);
    if (W.help) { const D = W.def[W.help.di]; if (Math.hypot(D.pos[0] - H(W).pos[0], D.pos[2] - H(W).pos[2]) < 5.5) break; }
  }
}
// a flick toward a man, off by `off` degrees, at the right length or not
function flickAt(W, j, off, lenK, assist, type) {
  PMSim.driveInput(W, null);
  const h = H(W).pos, t = PMSim.predict(W, j, 0.5);
  const a = Math.atan2(t[0] - h[0], t[2] - h[2]) + off * Math.PI / 180, d = Math.hypot(t[0] - h[0], t[2] - h[2]) * (lenK || 1);
  return PMSim.pass(W, { dir: [Math.sin(a), 0, Math.cos(a)], dist: d, type: type || 'chest', bend: 0, assist });
}
let fails = 0;
const check = (ok, label, extra) => { if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (extra ? '  ' + extra : '')); };

// 1. after drive after drive, the shooters are still on the arc and the big is still at the rim
let worstDeep = 0, bigFar = 0, bigCorner = 0;
SEEDS.forEach(seed => {
  const W = PMSim.create({ court: Court3D.COURTS.gym, scheme: 'rim', rand: mul(seed) });
  W.clock = 60;
  step(W, 0.4);
  for (let k = 0; k < 4 && !W.over; k++) {
    const side = k % 2 ? 1 : -1;
    driveToHelp(W, [side * 5, 0, 12], 0.8);
    if (W.over) break;
    PMSim.driveInput(W, null);
    // back it out to the top and go again
    step(W, 1.0, () => { if (!W.over && W.ball.state === 'held') PMSim.driveInput(W, unitTo(H(W).pos, [0, 0, 28]), 0, 0.7); });
    PMSim.driveInput(W, null);
    step(W, 1.2, () => {
      W.off.forEach((T, j) => {
        if (j === W.handler) return;
        if (T.role.id === 'big') { const r = rimD(T.pos); if (r > 9) bigFar = Math.max(bigFar, r); if (Math.abs(Court3D.polarOf(T.pos).angle) > 75 && r > 12) bigCorner++; }
        else if (T.state === 'spot' && rimD(T.pos) > 15) worstDeep = Math.max(worstDeep, behindLine(W, T.pos));
      });
    });
  }
});
check(worstDeep < 2.6, 'shooters stand a step behind the line, not way out', `deepest ${worstDeep.toFixed(1)} ft behind`);
check(bigCorner === 0 && bigFar < 9.5, 'the big lives at the rim: never out to the corner', `farthest ${bigFar.toFixed(1)} ft`);

// 2. the rim protector: when his man steps up to you, your big is right there for the dump-off
const g = { A: 0, B: 0, C: 0, D: 0, F: 0, none: 0 };
let bigNear = 0, drew = 0;
const SEEDS2 = SEEDS.concat([11, 12, 13, 14, 15, 16, 17, 18]);
SEEDS2.forEach(seed => {
  const W = PMSim.create({ court: Court3D.COURTS.gym, scheme: 'rim', rand: mul(seed) });
  step(W, 0.4);
  driveToHelp(W, [-2, 0, 9]);
  // only when the drive actually brought his man up: that's when it's there
  if (!W.help || W.over) return;
  drew++;
  const bj = W.off.findIndex(O => O.role.id === 'big');
  if (rimD(W.off[bj].pos) < 8) bigNear++;
  flickAt(W, bj, 14, 0.8, CASUAL);
  step(W, 5);
  if (!W.result) g.none++; else g[W.result.grade]++;
});
console.log(`rim protector, casual dump-off after drawing him (flick 14 deg off, a little short), ${drew} trips: A${g.A} B${g.B} C${g.C} D${g.D} F${g.F}`);
check(drew >= 6 && bigNear >= drew * 0.8, 'when you draw his man, your big is near the rim', `${bigNear}/${drew}`);
check((g.A + g.B) / drew >= 0.7, 'and the dump-off is there');

// 3. Casual finds the man you meant; Pro throws it where you said
let lockCasual = 0, moneyCasual = 0, lockPro = 0;
SEEDS.forEach(seed => {
  [1, 2].forEach(j => {
    let W = PMSim.create({ court: Court3D.COURTS.gym, scheme: 'packline', rand: mul(seed * 7 + j) });
    step(W, 0.6);
    let P = flickAt(W, j, j === 1 ? 15 : -15, 0.8, CASUAL);
    if (P && P.to === j) lockCasual++;
    if (P && P.to === j && P.q === 'money') moneyCasual++;
    W = PMSim.create({ court: Court3D.COURTS.gym, scheme: 'packline', rand: mul(seed * 7 + j) });
    step(W, 0.6);
    P = flickAt(W, j, j === 1 ? 15 : -15, 0.8, null);
    if (P && P.to === j && P.q === 'money') lockPro++;
  });
});
const n = SEEDS.length * 2;
check(lockCasual === n && moneyCasual >= n * 0.9, 'Casual: a flick 15 degrees off and a bit short still finds him, on the money', `${moneyCasual}/${n}`);
check(lockPro < n * 0.3, 'Pro: the same flick is your spot, and it is off', `${lockPro}/${n} on the money`);

// 4. Casual picks the pass: through traffic inside, it gets the right one
let picked = 0, inside = 0;
SEEDS.forEach(seed => {
  const W = PMSim.create({ court: Court3D.COURTS.gym, scheme: 'denial', rand: mul(seed) });
  // he's gone backdoor and he's past his man: that's when you see it
  step(W, 1.2);
  const sl = W.off.findIndex(O => O.role.id === 'slasher');
  const P = flickAt(W, sl, 0, 1, CASUAL, 'chest');
  if (P && P.type === 'bounce') inside++;
  step(W, 4);
  if (W.result && W.result.turnover === 'Picked') picked++;
});
check(inside >= SEEDS.length * 0.6, 'Casual: the backdoor gets the bounce pass without asking', `${inside}/${SEEDS.length}`);
check(picked <= SEEDS.length * 0.3, 'and it gets there when you see him go', `${picked}/${SEEDS.length} picked`);

// 4b. Casual still punishes the wrong read: the swing into the denial, the chest pass into the lane jumper
let wrongPicked = 0;
SEEDS.forEach(seed => {
  let W = PMSim.create({ court: Court3D.COURTS.gym, scheme: 'denial', rand: mul(seed) });
  step(W, 0.4);
  flickAt(W, W.off.findIndex(O => O.role.id === 'slasher'), 0, 1, CASUAL);
  step(W, 3);
  if (W.result && W.result.turnover) wrongPicked++;
  W = PMSim.create({ court: Court3D.COURTS.gym, scheme: 'lanejumper', rand: mul(seed) });
  step(W, 0.4);
  const jm = (W.def.find(x => x.jumper) || { man: 2 }).man;
  flickAt(W, jm, 0, 1, CASUAL);
  step(W, 3);
  if (W.result && W.result.turnover) wrongPicked++;
});
check(wrongPicked >= SEEDS.length * 2 * 0.75, 'Casual still punishes the wrong read: throwing into the denial or the lane jumper', `${wrongPicked}/${SEEDS.length * 2} turned over`);

console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
process.exit(fails ? 1 : 0);
