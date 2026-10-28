// Playmaker, scoring it yourself, no browser: the pull-up against a big who
// stays home, the shot fake that brings him out, the lane a gambler leaves,
// and the touch rules (a wide-open man is never "late"; bounce passes get a
// little more room).
const M = require('./pm_load')();
const { PMSim, Court3D, HoopPhysics } = M;
function mul(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const unitTo = (a, b) => { const v = [b[0] - a[0], 0, b[2] - a[2]]; const l = Math.hypot(v[0], v[2]) || 1; return [v[0] / l, 0, v[2] / l]; };
const H = W => W.off[W.handler];
const step = (W, sec, f) => { for (let i = 0; i < Math.round(sec * 60); i++) { if (f) f(); PMSim.update(W, 1 / 60); } };
const rimD = p => Math.hypot(p[0], p[2] - 5.25);
function passTo(W, t, type) {
  PMSim.driveInput(W, null);
  const h = H(W).pos, v = [t[0] - h[0], 0, t[2] - h[2]], d = Math.hypot(v[0], v[2]);
  return PMSim.pass(W, { dir: [v[0] / d, 0, v[2] / d], dist: d, type, bend: 0 });
}
function cross(W, pt) {
  const h = H(W).pos, d = Court3D.dirToRim(h), sv = [-d[2], 0, d[0]];
  const want = Math.sign((pt[0] - h[0]) * sv[0] + (pt[2] - h[2]) * sv[2]) || 1;
  const lat = [h[0] - want * sv[0] * 8 + d[0] * 3, 0, h[2] - want * sv[2] * 8 + d[2] * 3];
  step(W, 0.22, () => PMSim.driveInput(W, unitTo(H(W).pos, lat)));
}
// get a step, then stop short at about `stop` feet from the rim
function getToMidRange(W, pt, stop) {
  cross(W, pt);
  for (let i = 0; i < 90; i++) {
    if (W.over || W.ball.state !== 'held' || rimD(H(W).pos) < stop) break;
    PMSim.driveInput(W, unitTo(H(W).pos, pt)); PMSim.update(W, 1 / 60);
  }
  if (!W.over) PMSim.driveInput(W, null);
}
// a pure flick from your own touch
const TOUCH = 1.75;
const pure = W => ({ power: TOUCH * HoopPhysics.idealFlick(rimD(H(W).pos)), angle: 0, touchK: TOUCH, window: 0.15, aimDead: 6 });
const bigIdx = W => W.off.findIndex(O => O.role.id === 'big');
const jumperMan = W => { const d = W.def.find(x => x.jumper); return d ? d.man : 2; };

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const out = {};
function scenario(name, scheme, play) {
  const g = { A: 0, B: 0, C: 0, D: 0, F: 0, none: 0 }, tags = {};
  let pts = 0, cSum = 0, cN = 0, lessons = new Set();
  SEEDS.forEach(seed => {
    const W = PMSim.create({ court: Court3D.COURTS.gym, scheme, rand: mul(seed) });
    step(W, 0.4);
    play(W);
    step(W, 6);
    const R = W.result;
    if (!R) { g.none++; return; }
    g[R.grade]++; pts += R.points || 0;
    if (R.contest != null) { cSum += R.contest; cN++; }
    (R.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; });
    if (R.made) lessons.add(PMSim.lesson(W));
  });
  const n = SEEDS.length;
  out[name] = { good: (g.A + g.B) / n, ppp: pts / n, contest: cN ? cSum / cN : null, tags, lessons: [...lessons] };
  console.log(`${name.padEnd(46)} A${g.A} B${g.B} C${g.C} D${g.D} F${g.F}${g.none ? ' held' + g.none : ''}  ${(pts / n).toFixed(2)} pts/trip  contest ${cN ? (cSum / cN).toFixed(2) : '-'}`);
}

scenario('rim protector: get a step, pull up', 'rim', W => { getToMidRange(W, [-6, 0, 14], 15); PMSim.takeShot(W, W.handler, 'jumper', pure(W)); });
scenario('rim protector: no step, pull up in his face', 'rim', W => { PMSim.takeShot(W, W.handler, 'jumper', pure(W)); });
let bigOut = 0;
scenario('rim protector: show it, he steps up, feed the big', 'rim', W => {
  getToMidRange(W, [-6, 0, 14], 15);
  if (W.over) return;
  PMSim.shotFake(W);
  step(W, 0.45);
  const B = W.def.find(D => W.off[D.man].role.id === 'big');
  if (B && rimD(B.pos) > 6) bigOut++;
  const bj = bigIdx(W);
  passTo(W, PMSim.predict(W, bj, 0.6), 'lob');
});
let stepped2 = 0;
scenario('rim protector: show it at the elbow, then dump it off', 'rim', W => {
  // no step on your man: he's at the elbow with his man in front of him
  const h = H(W), d = PMSim.defOf(W, W.handler);
  h.pos = [-7, 0, 18.5];
  if (d && d.d) d.d.pos = [h.pos[0] + 0.45 * 3, 0, h.pos[2] - 0.89 * 3];
  step(W, 0.3);
  if (W.over) return;
  PMSim.shotFake(W);
  // give him a beat to commit, then dump it off behind him
  step(W, 0.8);
  const B = W.def.find(D => W.off[D.man].role.id === 'big');
  if (B && rimD(B.pos) > 6) stepped2++;
  const bj = bigIdx(W);
  passTo(W, PMSim.predict(W, bj, 0.4), 'bounce');
});
scenario('rim protector: show it, then shoot over him', 'rim', W => {
  getToMidRange(W, [-6, 0, 14], 15);
  if (W.over) return;
  PMSim.shotFake(W); step(W, 0.7);
  if (!W.over && W.ball.state === 'held') PMSim.takeShot(W, W.handler, 'jumper', pure(W));
});
scenario('lane jumper: get a step and take it to the rim', 'lanejumper', W => {
  cross(W, [1, 0, 6]);
  step(W, 1.6, () => { if (W.ball.state === 'held' && !W.over) PMSim.driveInput(W, unitTo(H(W).pos, [0.5, 0, 6])); });
  PMSim.driveInput(W, null);
});
scenario('lane jumper: fake him, then take it to the rim', 'lanejumper', W => {
  PMSim.fake(W); step(W, 0.3);
  cross(W, [1, 0, 6]);
  step(W, 1.6, () => { if (W.ball.state === 'held' && !W.over) PMSim.driveInput(W, unitTo(H(W).pos, [0.5, 0, 6])); });
  PMSim.driveInput(W, null);
});
scenario('pack line: get a step, pull-up three', 'packline', W => {
  // they're sitting in the paint: a hard jab, then rise from where you are
  cross(W, [-6, 0, 18]); step(W, 0.15, () => PMSim.driveInput(W, null));
  if (!W.over && W.ball.state === 'held') PMSim.takeShot(W, W.handler, 'jumper', pure(W));
});

// the touch rules, straight from the pass
function catchQ(scheme, seed, jPick, off, type, clear) {
  const W = PMSim.create({ court: Court3D.COURTS.gym, scheme, rand: mul(seed) });
  step(W, 0.4);
  const j = jPick(W);
  if (clear) W.def.forEach(D => { if (D.man === j) { D.pos = [0, 0, 6]; D.react = 3; D.quick = 0.2; } });
  const tgt = PMSim.predict(W, j, 0.5);
  const away = unitTo(H(W).pos, tgt);
  const t = [tgt[0] + away[0] * off, 0, tgt[2] + away[2] * off];
  const P = passTo(W, t, type);
  step(W, (P ? P.T : 0) + 0.05);
  const c = W.story.find(s => s.k === 'pass' && s.result === 'catch');
  return { q0: P ? P.q : null, q: c ? c.q : null, wide: c ? !!c.wide : false, handler: W.handler };
}
const wing = W => 1;
const wideRows = SEEDS.map(s => catchQ('packline', s, wing, 3.4, 'chest', true));
const guardedRows = SEEDS.map(s => catchQ('cornerhelp', s, wing, 3.4, 'chest', false));
const wideLate = wideRows.filter(r => r.q === 'reach').length, wideMoney = wideRows.filter(r => r.q === 'money').length;
const guardedLate = guardedRows.filter(r => r.q === 'reach').length;
console.log(`\na pass 3.4 ft off: wide open -> money ${wideMoney}, late ${wideLate} (of ${wideRows.filter(r => r.q).length} caught); guarded -> late ${guardedLate}`);
const bounceQ = [], chestQ = [];
SEEDS.forEach(s => { bounceQ.push(catchQ('cornerhelp', s, W => 4, 3.2, 'bounce', false).q0); chestQ.push(catchQ('cornerhelp', s, W => 4, 3.2, 'chest', false).q0); });
const bm = bounceQ.filter(q => q === 'money').length, cm = chestQ.filter(q => q === 'money').length;
console.log(`a pass 3.2 ft off to the big: bounce on the money ${bm}/${SEEDS.length}, chest ${cm}/${SEEDS.length}`);

let fails = 0;
const check = (ok, label) => { if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label); };
console.log('');
check(out['rim protector: get a step, pull up'].good >= 0.6, 'rim protector: the pull-up is there when he stays home');
check(out['rim protector: get a step, pull up'].contest < out['rim protector: no step, pull up in his face'].contest, 'rim protector: getting a step first makes it a cleaner look');
check(stepped2 >= SEEDS.length * 0.8, `rim protector: at the elbow, the big has to come out to you (${stepped2}/${SEEDS.length})`);
check(out['rim protector: show it at the elbow, then dump it off'].good >= 0.6, 'rim protector: and the dump-off behind him is there');
check(bigOut >= SEEDS.length * 0.7, `rim protector: and he actually leaves the rim (${bigOut}/${SEEDS.length})`);
check(out['rim protector: show it, he steps up, feed the big'].good >= 0.6, 'rim protector: then the big is open behind him');
check(out['rim protector: show it, he steps up, feed the big'].ppp > out['rim protector: show it, then shoot over him'].ppp, 'rim protector: once he steps up, pass it, don\'t shoot over him');
check(out['rim protector: get a step, pull up'].lessons.some(l => /pull-up was yours/i.test(l)), 'the card says scoring it yourself was the read');
check((out['rim protector: get a step, pull up'].tags.score || 0) >= SEEDS.length * 0.8, 'your own bucket is tagged as yours');
check(wideLate === 0 && wideMoney >= 6, 'a wide-open man is never called late');
check(guardedLate >= 4, 'a guarded man still is');
check(bm > cm, 'a bounce pass gets a little more room than a chest pass');
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
process.exit(fails ? 1 : 0);
