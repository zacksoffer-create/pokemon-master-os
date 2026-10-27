// Playmaker reads, no browser: for every defense, the read that beats it and
// the one it takes away, over several seeds. Prints grade mixes and checks
// that the right read is clearly better.
const M = require('./pm_load')();
const { PMSim, Court3D } = M;
function mul(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const unitTo = (a, b) => { const v = [b[0] - a[0], 0, b[2] - a[2]]; const l = Math.hypot(v[0], v[2]) || 1; return [v[0] / l, 0, v[2] / l]; };
const H = W => W.off[W.handler];
const step = (W, sec, f) => { for (let i = 0; i < Math.round(sec * 60); i++) { if (f) f(); PMSim.update(W, 1 / 60); } };
function passTo(W, t, type) {
  PMSim.driveInput(W, null);
  const h = H(W).pos, v = [t[0] - h[0], 0, t[2] - h[2]], d = Math.hypot(v[0], v[2]);
  return PMSim.pass(W, { dir: [v[0] / d, 0, v[2] / d], dist: d, type, bend: 0 });
}
const toMan = (W, j, type, ahead) => passTo(W, PMSim.predict(W, j, ahead == null ? 0.55 : ahead), type);
// get by him: start one way, snap back toward pt
function cross(W, pt) {
  const h = H(W).pos, d = Court3D.dirToRim(h), sv = [-d[2], 0, d[0]];
  const want = Math.sign((pt[0] - h[0]) * sv[0] + (pt[2] - h[2]) * sv[2]) || 1;
  const lat = [h[0] - want * sv[0] * 8 + d[0] * 3, 0, h[2] - want * sv[2] * 8 + d[2] * 3];
  step(W, 0.22, () => PMSim.driveInput(W, unitTo(H(W).pos, lat)));
}
// drive at pt until the help is on you
function driveToHelp(W, pt, sec) {
  cross(W, pt);
  for (let i = 0; i < (sec || 1.6) * 60; i++) {
    if (W.over || W.ball.state !== 'held') return;
    PMSim.driveInput(W, unitTo(H(W).pos, pt)); PMSim.update(W, 1 / 60);
    if (W.help) { const D = W.def[W.help.di]; if (Math.hypot(D.pos[0] - H(W).pos[0], D.pos[2] - H(W).pos[2]) < 5.5) break; }
  }
}
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const out = {};
function scenario(name, scheme, play, mirror) {
  const g = { A: 0, B: 0, C: 0, D: 0, F: 0, none: 0 }, tos = {};
  let pts = 0;
  SEEDS.forEach(seed => {
    const W = PMSim.create({ court: Court3D.COURTS.gym, scheme, rand: mul(seed), mirror: !!mirror });
    step(W, 0.4);
    play(W);
    step(W, 5);
    const R = W.result;
    if (!R) { g.none++; return; }
    g[R.grade]++; pts += R.points || 0;
    if (R.turnover) tos[R.turnover] = (tos[R.turnover] || 0) + 1;
  });
  const n = SEEDS.length;
  out[name] = { good: (g.A + g.B) / n, bad: (g.D + g.F) / n, to: Object.values(tos).reduce((a, b) => a + b, 0) / n, none: g.none / n, ppp: pts / n };
  console.log(`${name.padEnd(44)} A${g.A} B${g.B} C${g.C} D${g.D} F${g.F}${g.none ? ' held' + g.none : ''}  ${(pts / n).toFixed(2)} pts/trip ${Object.entries(tos).map(([k, v]) => k + ':' + v).join(' ')}`);
}
const bigIdx = W => W.off.findIndex(O => O.role.id === 'big');
const helpMan = W => (W.help ? W.help.man : 3);
const jumperMan = W => { const d = W.def.find(x => x.jumper); return d ? d.man : 2; };
const deniedWing = W => W.off.findIndex(O => O.role.id === 'slasher');

scenario('pack line: drive, kick to the man they left', 'packline', W => { driveToHelp(W, [5, 0, 11]); toMan(W, helpMan(W), 'bullet'); });
scenario('pack line: drive into the crowd and finish', 'packline', W => { cross(W, [2, 0, 6]); step(W, 1.6, () => { if (W.ball.state === 'held' && !W.over) PMSim.driveInput(W, unitTo(H(W).pos, [1, 0, 6])); }); PMSim.driveInput(W, null); });
scenario('corner help: drive, kick to the corner', 'cornerhelp', W => { driveToHelp(W, [7, 0, 10]); toMan(W, helpMan(W), 'bullet'); });
scenario('corner help: drive and finish anyway', 'cornerhelp', W => { cross(W, [3, 0, 7]); step(W, 1.6, () => { if (W.ball.state === 'held' && !W.over) PMSim.driveInput(W, unitTo(H(W).pos, [2, 0, 6])); }); PMSim.driveInput(W, null); });
scenario('rim protector: drive, dump it to the big', 'rim', W => { driveToHelp(W, [-2, 0, 9]); toMan(W, bigIdx(W), 'chest', 0.35); });
scenario('rim protector: drive, lob to the big', 'rim', W => { driveToHelp(W, [-2, 0, 9]); toMan(W, bigIdx(W), 'lob', 0.6); });
scenario('rim protector: drive and finish over him', 'rim', W => { cross(W, [-1, 0, 6]); step(W, 1.6, () => { if (W.ball.state === 'held' && !W.over) PMSim.driveInput(W, unitTo(H(W).pos, [0, 0, 6])); }); PMSim.driveInput(W, null); });
scenario('denial: throw it to the denied wing', 'denial', W => toMan(W, deniedWing(W), 'chest', 0.3));
scenario('denial: wait for the backdoor, bounce it', 'denial', W => { step(W, 1.0); toMan(W, deniedWing(W), 'bounce', 0.75); });
scenario('denial: wait for the backdoor, lob it', 'denial', W => { step(W, 1.0); toMan(W, deniedWing(W), 'lob', 1.0); });
scenario('lane jumper: chest pass into his lane', 'lanejumper', W => toMan(W, jumperMan(W), 'chest', 0.3));
scenario('lane jumper: bounce it under him', 'lanejumper', W => toMan(W, jumperMan(W), 'bounce', 0.3));
scenario('lane jumper: fake, then hit the back cut', 'lanejumper', W => { const m = jumperMan(W); PMSim.fake(W); step(W, 0.6); toMan(W, m, 'bounce', 0.75); });
scenario('scramble: drive, kick, let him shoot', 'scramble', W => { driveToHelp(W, [6, 0, 11]); toMan(W, helpMan(W), 'bullet'); });
scenario('scramble: drive, kick, extra pass', 'scramble', W => {
  driveToHelp(W, [6, 0, 11]); const P = toMan(W, helpMan(W), 'bullet');
  // let the man flying at the catch commit, then swing it
  if (!P) return; step(W, P.T + 0.35);
  if (W.ball.state !== 'held' || W.over) return;
  const fl = W.story.find(x => x.k === 'fly');
  if (!fl || fl.man == null) return;
  const T = W.off[fl.man];
  passTo(W, T.state === 'relocate' ? T.home : PMSim.predict(W, fl.man, 0.5), 'chest');
});

let fails = 0;
const check = (ok, label) => { if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label); };
console.log('');
check(out['pack line: drive, kick to the man they left'].good >= 0.6, 'pack line: the kick-out is open');
check(out['pack line: drive, kick to the man they left'].ppp > out['pack line: drive into the crowd and finish'].ppp, 'pack line: kicking beats driving into the crowd');
check(out['corner help: drive, kick to the corner'].good >= 0.6, 'corner help: the corner three is there');
check(out['corner help: drive, kick to the corner'].good > out['corner help: drive and finish anyway'].good, 'corner help: the kick beats finishing over the help');
check(Math.max(out['rim protector: drive, dump it to the big'].good, out['rim protector: drive, lob to the big'].good) >= 0.6, 'rim protector: the big is open when his man steps up');
check(out['rim protector: drive and finish over him'].good < 0.5, 'rim protector: finishing over him is a fight');
check(out['denial: throw it to the denied wing'].to >= 0.75, 'denial: throwing into the hand gets picked');
check(out['denial: wait for the backdoor, bounce it'].good >= 0.6, 'denial: the backdoor bounce works');
check(out['lane jumper: chest pass into his lane'].to >= 0.75, 'lane jumper: a chest pass into his lane gets picked');
check(out['lane jumper: bounce it under him'].to < out['lane jumper: chest pass into his lane'].to, 'lane jumper: the bounce gets under him more often');
check(out['lane jumper: fake, then hit the back cut'].good >= 0.5, 'lane jumper: fake him and hit the back cut');
check(out['scramble: drive, kick, extra pass'].good > out['scramble: drive, kick, let him shoot'].good, 'scramble: the extra pass beats the first open look');
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
process.exit(fails ? 1 : 0);
