// Lockdown in Node, no browser: steal odds by exposure and accuracy, block vs
// goaltend vs contest by when you jump, where misses come off the rim, how a
// contest moves his make rate, drives by reaction time and cushion, and each
// scorer's right answer against the wrong one.
const L = require('./load')(['hoops/court.js', 'hoops/physics.js', 'hoops/dfx-scorers.js', 'hoops/dfx-sim.js']);
const { LockdownSim: S, Court3D: C, HoopPhysics: H } = L;
function mul(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let fails = 0;
const check = (ok, label, extra) => { if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (extra ? '  ' + extra : '')); };
const pct = x => Math.round(x * 100) + '%';

// a defender run by a function of the world each frame
function run(o) {
  const w = S.create(Object.assign({ court: C.COURTS.gym, rand: mul(o.seed || 1) }, o));
  const dt = 1 / 60; let n = 0;
  while (!w.over && n++ < 60 * 25) {
    const R = S.rel(w);
    let r, f;
    if (w.phase === 'duel' && !w.you.chasing) { r = R.s; f = [-R.u[0], 0, -R.u[2]]; }
    else { const tr = C.dirToRim(w.you.pos); r = [-tr[2], 0, tr[0]]; f = tr; }
    const b = o.bot ? (o.bot(w, R, w.off.act) || {}) : {};
    if (b.jump) S.jump(w, b.jump);
    if (b.slice) S.slice(w, b.slice);
    S.input(w, { jx: b.jx || 0, jy: b.jy || 0, held: !!b.held, still: !!b.still, r, f });
    S.step(w, dt);
    w.events.length = 0;
  }
  return w;
}
const rate = (n, f) => { let c = 0; for (let s = 1; s <= n; s++) if (f(s)) c++; return c / n; };

console.log('-- steals: slice through the middle of a crossover out in front --');
const steal = (sc, kind, acc) => rate(30, s => {
  let done = false;
  const w = run({ scorer: sc, seed: s, script: ['cross:' + kind, 'hold'], firstSize: 0.3, bot(w, R, a) { if (!done && a && a.k === 'cross' && a.t > a.T * 0.45) { done = true; return { slice: { hit: true, acc, dir: 1 } }; } } });
  return w.result && w.result.kind === 'steal';
});
const loose = steal('loose', 'front', 0.9), looseEdge = steal('loose', 'front', 0.2), tight = steal('slasher', 'front', 0.9), legs = steal('shooter', 'legs', 0.9);
console.log(`  loose handle, clean ${pct(loose)} · loose, edge of the ball ${pct(looseEdge)} · normal handle ${pct(tight)} · between the legs ${pct(legs)}`);
check(loose >= 0.95, 'a lazy crossover out in front is a steal');
check(tight > 0.2 && tight < 0.85, 'a normal handle is a gamble even on a clean swipe');
check(legs === 0, 'between the legs is never a steal (it\'s a reach)');

console.log('-- drives: slide toward his drive this long after his tell starts --');
const drive = (sc, gap, react) => rate(20, s => {
  let tellAt = null;
  const w = run({ scorer: sc, seed: s, gap0: gap, script: ['drive:' + (s % 2 ? 1 : -1)], firstSize: 0.4, bot(w, R, a) { if (a && a.k === 'drive') { if (tellAt == null) tellAt = w.t; if (w.t - tellAt >= react) return { jx: a.side }; } } });
  const d = w.story.find(x => x.k === 'drive'); return d && d.cut;
});
const rows = [];
for (const sc of ['shooter', 'slasher']) for (const gap of [2.6, 4, 5.5]) rows.push(`${sc} gap ${gap}: ` + [0.18, 0.3, 0.42].map(t => `${t}s ${pct(drive(sc, gap, t))}`).join(' '));
rows.forEach(r => console.log('  ' + r));
check(drive('shooter', 4, 0.18) >= 0.9, 'react to the tell and you beat a normal scorer to the spot');
check(drive('shooter', 4, 0.6) <= 0.1, 'react late and he is by you');
check(drive('slasher', 5.5, 0.3) > drive('slasher', 2.6, 0.3) + 0.3, 'giving the Slasher a step buys time to slide');

console.log('-- jabs --');
const bite = rate(20, s => run({ scorer: 'shooter', seed: s, script: ['jab:1', 'hold'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'jab') return { jx: 1 }; } }).dec.some(d => d.k === 'bitJab'));
const home = rate(20, s => run({ scorer: 'shooter', seed: s, script: ['jab:1', 'hold'], firstSize: 0.3 }).dec.some(d => d.k === 'bitJab'));
console.log(`  slide hard at the jab: bit ${pct(bite)} · stay square: bit ${pct(home)}`);
check(bite === 1 && home === 0, 'lunging at a jab is a bite every time; staying square never is');

console.log('-- pump fakes --');
const onFake = rate(30, s => run({ scorer: 'pump', seed: s, gap0: 3.4, script: ['pump:rise'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'pump' && a.ph === 'up') return { jump: { k: 1 } }; } }).result.points > 0);
const onLegs = rate(30, s => run({ scorer: 'pump', seed: s, gap0: 3.4, script: ['pump:rise'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'rise' && a.ph === 'up') return { jump: { k: 1 } }; } }).result.points > 0);
console.log(`  jump on the fake: he scores ${pct(onFake)} · wait for his legs: he scores ${pct(onLegs)}`);
check(onFake >= 0.9 && onLegs <= 0.5, 'jumping on the fake gives it up; waiting for his legs doesn\'t');

console.log('-- contest by when you jump (The Shooter, 3 ft away) --');
function contestRun(when, s) {
  let jumped = false;
  return run({ scorer: 'shooter', seed: s, gap0: 3.0, script: ['rise'], firstSize: 0.3, bot(w, R, a) {
    if (jumped || !a || a.k !== 'rise') return;
    const hit = (when === 'gather' && a.ph === 'gather' && a.t > 0.05) || (when === 'leave' && a.ph === 'up' && a.t < 0.03) || (when === 'release' && a.ph === 'up' && a.t > 0.15) || (when === 'early' && a.ph === 'gather' && a.t < 0.02);
    if (hit) { jumped = true; return { jump: { k: 1 } }; }
  } });
}
const cont = {};
for (const when of ['early', 'gather', 'leave', 'release', 'never']) {
  let c = 0, made = 0, blk = 0; const n = 40;
  for (let s = 1; s <= n; s++) { const w = contestRun(when, s); c += w.shotInfo ? w.shotInfo.contest : 0; if (w.result.kind === 'made') made++; if (w.result.kind === 'block') blk++; }
  cont[when] = { c: c / n, made: made / n, blk };
  console.log(`  ${when.padEnd(8)} contest ${(c / n).toFixed(2)} · made ${pct(made / n)} · blocks ${blk}`);
}
check(cont.gather.c > cont.never.c + 0.3, 'going up with him puts a real hand in his face');
check(cont.gather.c > cont.release.c, 'jumping with his gather beats jumping at the release');

console.log('-- a contest and his make rate (same noise the scoring game uses) --');
const court = C.COURTS.gym;
function makeRate(c, skill, d) {
  const r = mul(7); let m = 0; const n = 400;
  for (let i = 0; i < n; i++) {
    const pos = C.polar((i % 5 - 2) * 25, d), sh = H.cpuShot(pos, skill, r);
    let v = sh.vel.map(x => x * (1 + H.gauss(r) * c * 0.0065));
    const a = H.gauss(r) * c * 1.1 * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    v = [v[0] * cs + v[2] * sn, v[1], -v[0] * sn + v[2] * cs];
    if (H.simulate(sh.release, v, court).result === 'made') m++;
  }
  return m / n;
}
const open = makeRate(0, 0.86, 20), smother = makeRate(0.87, 0.86, 20);
console.log(`  The Shooter from 20 ft: open ${pct(open)} · hand in his face ${pct(smother)}`);
check(open - smother > 0.12, 'a real contest takes a lot off a great shooter');

console.log('-- blocks and goaltending at the rim (wall up inside the circle, then jump) --');
function rimRun(delay, s) {
  let up = null;
  return run({ scorer: 'rim', seed: s, kind: 'swat', gap0: 7.2, d0: 10.5, script: ['attack'], firstSize: 0.3, bot(w, R, a) {
    const out = { held: true, still: true };
    if (w.shotInfo && up == null) up = w.t;
    if (up != null && w.t - up >= delay && !w.you.air && !w.jumped) { w.jumped = true; out.jump = { k: 1 }; }
    return out;
  } });
}
const tally = {};
for (const delay of [-0.1, 0, 0.12, 0.3, 0.5]) {
  const o = {};
  for (let s = 1; s <= 20; s++) { const k = rimRun(delay, s).result.kind; o[k] = (o[k] || 0) + 1; }
  tally[delay] = o;
  console.log(`  jump ${delay}s after his release: ${JSON.stringify(o)}`);
}
const blocksEarly = (tally[0].block || 0) + (tally[0.12].block || 0);
const goalLate = (tally[0.3].goaltend || 0) + (tally[0.5].goaltend || 0);
check(blocksEarly > 0, 'up with him at the rim gets blocks');
check(goalLate > (tally[0].goaltend || 0), 'late, on the way down, it\'s goaltending');

console.log('-- charges --');
const chg = rate(10, s => run({ scorer: 'rim', seed: s, script: ['attack'], firstSize: 0.4, bot() { return { held: true, still: true }; } }).result.kind === 'charge');
const blk = rate(10, s => run({ scorer: 'rim', seed: s, script: ['attack'], firstSize: 0.4, bot(w, R, a) { if (a && a.k === 'attack' && a.ph === 'go') return { held: true, jy: 1 }; } }).dec.some(d => d.k === 'blocking'));
console.log(`  set and still outside the circle: charge ${pct(chg)} · stepping into him: blocking foul ${pct(blk)}`);
check(chg === 1, 'set outside the circle is a charge');
check(blk >= 0.8, 'still moving when he hits you is a blocking foul');

console.log('-- where misses come off the rim (shots from the left side) --');
for (const [id, label] of [['lc', 'corner three'], ['lw', 'wing three'], ['le', 'elbow'], ['lbk', 'block']]) {
  const r = mul(11), sp = C.spotInfo(court, id); let n = 0, weak = 0, long = 0, sum = 0;
  for (let i = 0; i < 300; i++) {
    const sh = H.cpuShot(sp.pos, 0.4, r), b = H.newBall(sh.release, sh.vel);
    let k = 0; while (!b.result && k++ < 1200) H.advance(b, 1 / 120, court);
    if (b.result !== 'miss' || b.rimHits + b.boardHits === 0) continue;
    let j = 0; while (j++ < 600 && !(b.v[1] < 0 && b.p[1] < 9 && Math.hypot(b.p[0], b.p[2] - 5.25) > 1.2) && b.bounces < 2) H.advance(b, 1 / 120, court);
    n++; const d = Math.hypot(b.p[0], b.p[2] - 5.25); sum += d; if (d > 7) long++; if (b.p[0] > 1) weak++;
  }
  console.log(`  ${label.padEnd(13)} ${sp.dist.toFixed(0)} ft: comes down ${(sum / n).toFixed(1)} ft out, long ${pct(long / n)}, weak side ${pct(weak / n)}`);
  if (id === 'lw') check(weak / n > 0.5, 'side shots go long to the weak side more often than not');
  if (id === 'lbk') check(sum / n < 3, 'short shots stay short');
}

console.log('-- box out --');
function glass(mode, s) {
  return run({ scorer: 'crasher', seed: s, kind: 'glass', bot(w) {
    const RB = w.rebound; if (!RB) return;
    const Y = w.you, out = {};
    const toRim = C.dirToRim(Y.pos), side = [-toRim[2], 0, toRim[0]];
    if (mode === 'box') { out.held = true; if (RB.boxing && !RB.sealed && !RB.lost && RB.sideAt != null && w.t > RB.sideAt + 0.1) out.jx = RB.side; }
    if ((mode === 'box' && (RB.sealed || RB.lost)) || mode === 'nobox') {
      if (RB.pred) {
        const d = [RB.pred.p[0] - Y.pos[0], 0, RB.pred.p[2] - Y.pos[2]], l = Math.hypot(d[0], d[2]);
        if (l > 0.5) { const k = Math.min(1, l / 3); out.jx = (d[0] * side[0] + d[2] * side[2]) / l * k; out.jy = (d[0] * toRim[0] + d[2] * toRim[2]) / l * k; }
        const b = w.ball.p;
        if (b[1] < 11.5 && b[1] > 9 && w.ball.ph && w.ball.ph.v[1] < 0 && Math.hypot(b[0] - Y.pos[0], b[2] - Y.pos[2]) < 3) out.jump = { k: 1 };
      }
    }
    return out;
  } });
}
const tallyBox = m => { const o = { board: 0, his: 0 }; for (let s = 1; s <= 60; s++) { const k = glass(m, s).result.kind; if (k === 'board') o.board++; else if (k !== 'made') o.his++; } return o; };
const bx = tallyBox('box'), nb = tallyBox('nobox');
console.log(`  box out, then go get it: yours ${bx.board}, his ${bx.his} · just chase the ball: yours ${nb.board}, his ${nb.his}`);
check(bx.his * 3 <= nb.his, 'boxing out the Crasher takes away most of his boards');

console.log('-- each scorer: the right answer against the wrong one --');
const gp = { A: 4, B: 3, C: 2, D: 1, F: 0 };
function avgGrade(o, n) { let g = 0, pts = 0; for (let s = 1; s <= n; s++) { const w = run(Object.assign({ seed: s }, o)); g += gp[w.result.grade]; pts += w.result.points; } return { g: g / n, pts: pts / n }; }
const pairs = [
  ['shooter', 'crowd and go up with him', { scorer: 'shooter', gap0: 3.0, script: ['rise'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'rise' && a.ph === 'gather') return { jump: { k: 1 } }; } },
    'sag off him', { scorer: 'shooter', gap0: 6.0, script: ['rise'], firstSize: 0.3 }],
  ['slasher', 'give a step, slide on the tell', { scorer: 'slasher', gap0: 5.5, script: ['drive:1'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'drive' && a.t > 0.12) return { jx: a.side }; } },
    'crowd him, slide late', { scorer: 'slasher', gap0: 2.6, script: ['drive:1'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'drive' && a.ph === 'go' && a.t > 0.12) return { jx: a.side }; } }],
  ['loose', 'swipe the lazy cross', { scorer: 'loose', script: ['cross:front', 'hold'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'cross' && a.t > a.T * 0.45 && !w.sl) { w.sl = 1; return { slice: { hit: true, acc: 0.85, dir: 1 } }; } } },
    'reach while it\'s on his hip', { scorer: 'loose', script: ['hold'], firstSize: 0.3, bot(w, R, a) { if (w.t > 0.6 && !w.sl) { w.sl = 1; return { slice: { hit: true, acc: 0.6, dir: 1 } }; } } }],
  ['pump', 'stay down, go up with the real one', { scorer: 'pump', gap0: 3.2, script: ['pump:rise'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'rise' && a.ph === 'up') return { jump: { k: 1 } }; } },
    'jump on the fake', { scorer: 'pump', gap0: 3.2, script: ['pump:rise'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'pump' && a.ph === 'up') return { jump: { k: 1 } }; } }],
  ['stepback', 'close out under control, contest after', { scorer: 'stepback', gap0: 3.2, script: ['step'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'rise' && a.ph === 'up' && a.t < 0.05) return { jump: { k: 1 } }; } },
    'fly at him', { scorer: 'stepback', gap0: 4.4, script: ['size:0.5', 'step'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'size') return { jy: 1 }; if (a && a.k === 'rise' && a.ph === 'up' && a.t < 0.05) return { jump: { k: 1 } }; } }],
  ['crasher', 'contest, then box out', { scorer: 'crasher', gap0: 3.0, script: ['rise'], firstSize: 0.3, bot(w, R, a) {
      if (a && a.k === 'rise' && a.ph === 'gather') return { jump: { k: 1 } };
      const RB = w.rebound; if (!RB) return; const out = { held: true }; if (RB.boxing && !RB.sealed && !RB.lost && RB.sideAt != null && w.t > RB.sideAt + 0.1) out.jx = RB.side;
      if ((RB.sealed || RB.lost) && RB.pred) { const Y = w.you, tr = C.dirToRim(Y.pos), sd = [-tr[2], 0, tr[0]]; const d = [RB.pred.p[0] - Y.pos[0], 0, RB.pred.p[2] - Y.pos[2]], l = Math.hypot(d[0], d[2]); if (l > 0.5) { const k = Math.min(1, l / 3); out.jx = (d[0] * sd[0] + d[2] * sd[2]) / l * k; out.jy = (d[0] * tr[0] + d[2] * tr[2]) / l * k; } }
      return out; } },
    'contest, then watch the ball', { scorer: 'crasher', gap0: 3.0, script: ['rise'], firstSize: 0.3, bot(w, R, a) { if (a && a.k === 'rise' && a.ph === 'gather') return { jump: { k: 1 } }; } }],
  ['rim', 'beat him there and hold still', { scorer: 'rim', script: ['attack'], firstSize: 0.4, bot() { return { held: true, still: true }; } },
    'step into him', { scorer: 'rim', script: ['attack'], firstSize: 0.4, bot(w, R, a) { if (a && a.k === 'attack' && a.ph === 'go') return { held: true, jy: 1 }; } }]
];
for (const [sc, rl, ro, wl, wo] of pairs) {
  const n = sc === 'shooter' || sc === 'crasher' ? 48 : 16;
  const r = avgGrade(ro, n), x = avgGrade(wo, n);
  console.log(`  ${sc.padEnd(9)} ${rl}: grade ${r.g.toFixed(1)}, ${r.pts.toFixed(2)} pts · ${wl}: grade ${x.g.toFixed(1)}, ${x.pts.toFixed(2)} pts`);
  check(r.g > x.g + 0.8, `${sc}: the right answer grades clearly better`);
  check(r.pts <= x.pts, `${sc}: and gives up no more points`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exitCode = fails ? 1 : 0;
