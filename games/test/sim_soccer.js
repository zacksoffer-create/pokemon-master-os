// Soccer Playmaker, headless: a bot plays attacks two ways. The playmaker passes into open lanes, plays through balls
// to runners, dribbles into space and shoots from good spots; the careless one forces passes into traffic and shoots
// from anywhere. Reading the field should score more and lose the ball less, and nothing should be a free goal.
//   node games/test/sim_soccer.js [attacks per row]
const SC = require('../src/soccer/sim.js');
const N = +(process.argv[2] || 200);

function openSpace(P, c) {
  // a dribble target: forward, away from defenders
  let best = null, bv = -1e9;
  for (let a = -1.3; a <= 1.3; a += 0.26) {
    const px = c.x + Math.cos(a) * 5, py = c.y + Math.sin(a) * 5;
    let m = 9;
    for (const d of P.away) if (d.st === 'run') m = Math.min(m, Math.hypot(d.x - px, d.y - py));
    const v = Math.min(m, 6) + Math.cos(a) * 1.2 - (Math.abs(py) > SC.HALF - 3 ? 5 : 0);
    if (v > bv) { bv = v; best = { x: px, y: py }; }
  }
  return best;
}
function pressure(P, c) { let m = 99; for (const d of P.away) if (d.st === 'run' && !d.gk) m = Math.min(m, SC.dist(d, c)); return m; }
function decide(P, c, policy, held) {
  const dGoal = Math.hypot(SC.LEN - c.x, c.y);
  const angle = Math.abs(Math.atan2(c.y, SC.LEN - c.x));
  const shootDir = Math.atan2((c.y > 0 ? -2.6 : 2.6) - c.y, SC.LEN - c.x);
  if (policy === 'careless') {
    if (dGoal < 30 && held > 0.6) return { flick: { dir: shootDir, dist: dGoal, zip: 0.7, curl: 0 } };
    if (held > 0.8) {
      // the most covered teammate ahead of the ball: the pass a defender is most likely to get to
      let worst = null, wv = 1e9;
      for (const m of P.home) {
        if (m === c || m.gk || m.x < c.x - 5) continue;
        const far = SC.dist(m, c) > 27, L = SC.leadFor(P, m, c, far, 0.5), o = SC.passRisk(P, c, L, far, 0.5, m);
        if (o < wv) { wv = o; worst = { m, L }; }
      }
      if (worst) return { flick: { dir: Math.atan2(worst.L.y - c.y, worst.L.x - c.x), dist: SC.dist(worst.L, c), zip: 0.5, curl: 0 } };
    }
    return { drag: { x: c.x + 6, y: c.y * 0.9 } };            // head down, straight at goal
  }
  // the playmaker: shoot from a good spot, find a runner, carry it into space when it's there, else find the open man
  const pr = pressure(P, c);
  if (held > 0.15 && ((dGoal < 23 && angle < 0.8) || (c.x > SC.BOX_X && Math.abs(c.y) < 12) || (dGoal < 27 && angle < 0.5 && pr > 3)))
    return { flick: { dir: shootDir, dist: dGoal, zip: 0.75, curl: c.y > 0 ? 0.3 : -0.3 } };
  // room ahead: how far to the nearest defender in front of him
  let ahead = 99;
  for (const d of P.away) { if (d.gk || d.st !== 'run') continue; const a = Math.atan2(d.y - c.y, d.x - c.x); if (Math.abs(SC.angDiff(0, a)) < 0.9) ahead = Math.min(ahead, SC.dist(d, c)); }
  const goalward = { x: Math.min(SC.LEN - 6, c.x + 6), y: c.y * (c.x > 70 ? 0.7 : 0.95) };
  let best = null, bv = -1e9;
  if (held > 0.3) {
    const line = SC.offsideLine(P);
    for (const m of P.home) {
      if (m === c || m.gk) continue;
      // casual assist puts it in the air when he's far; in pro it's the flick's length that does
      let far = SC.dist(m, c) > 27, L = SC.leadFor(P, m, c, far, 0.55);
      if (P.assist === 'pro' && (SC.dist(L, c) > 27) !== far) { far = !far; L = SC.leadFor(P, m, c, far, 0.55); if ((SC.dist(L, c) > 27) !== far) continue; }
      const risk = SC.passRisk(P, c, L, far, 0.55, m);
      const off = m.x > line + 0.3 && m.x > c.x && m.x > 52.5;
      if (off || risk < 0.15) continue;
      let room = 99; for (const d of P.away) if (d.st === 'run') room = Math.min(room, Math.hypot(d.x - L.x, d.y - L.y));
      const shotSpot = L.x > 85 && Math.abs(L.y) < 14 ? 2 : 0;
      const v = (L.x - c.x) * 0.12 + Math.min(room, 6) * 0.35 + Math.min(risk, 0.8) + (m.run ? 2 : 0) + shotSpot - (L.x < c.x - 3 ? 1.5 : 0);
      if (v > bv) { bv = v; best = { m, L }; }
    }
  }
  const play = b => ({ flick: { dir: Math.atan2(b.L.y - c.y, b.L.x - c.x), dist: SC.dist(b.L, c), zip: 0.55, curl: 0 } });
  if (best && (best.m.run || (best.L.x > 85 && Math.abs(best.L.y) < 14)) && best.L.x > c.x + 4) return play(best);
  if (ahead > 6 && held < 3) return { drag: goalward };
  if (best && (pr < 3.5 || held > 1.4 || best.L.x > c.x + 6)) return play(best);
  return { drag: openSpace(P, c) };
}
function attack(seed, policy, dif, assist) {
  const P = SC.create({ seed, difficulty: dif == null ? 50 : dif, assist: assist || 'casual' });
  let t = 0, holder = null, held = 0, looked = false, tickN = 0, last = null, lastC = null, lastBall = null;
  while (P.phase === 'live' && t < 40) {
    const c = P.ctrl;
    let inp = {};
    if (c && P.ball.st === 'held') {
      if (c !== holder || P.ball !== lastBall) { holder = c; held = 0; lastBall = P.ball; }
      held += 1 / 60;
      if (policy === 'smart' && !looked && held > 0.3) { SC.lookUp(P); looked = true; }
      if (++tickN % 6 === 0 || !last || c !== lastC) { inp = decide(P, c, policy, held); last = inp.drag ? { drag: inp.drag } : null; lastC = c; }
      else inp = last;
    }
    SC.step(P, 1 / 60, inp);
    t += 1 / 60;
  }
  return P.result || { how: 'timeout', stats: P.stats, log: [] };
}
function row(policy, dif, assist) {
  const out = { goal: 0, shots: 0, onT: 0, lost: 0, offside: 0, out: 0, time: 0, passes: 0, done: 0, beat: 0, saves: 0 };
  for (let i = 0; i < N; i++) {
    const r = attack(4000 + i * 7919, policy, dif, assist);
    if (r.how === 'goal') out.goal++;
    if (['tackled', 'intercepted', 'claimed'].includes(r.how)) out.lost++;
    if (r.how === 'offside') out.offside++;
    if (r.how === 'out') out.out++;
    if (r.how === 'time') out.time++;
    if (r.how === 'saved' || (r.log || []).includes('parried')) out.saves++;
    out.shots += r.stats.shots; out.onT += r.stats.onTarget; out.passes += r.stats.passes; out.done += r.stats.done; out.beat += r.stats.beat;
  }
  return out;
}
const pct = v => (v * 100).toFixed(0).padStart(3) + '%';
const line = (label, o) => `${label.padEnd(22)} goals ${pct(o.goal / N)}  shots/att ${(o.shots / N).toFixed(2)}  on target ${pct(o.onT / Math.max(1, o.shots))}  lost ${pct(o.lost / N)}  offside ${pct(o.offside / N)}  out ${pct(o.out / N)}  clock ${pct(o.time / N)}  passes ${(o.passes / N).toFixed(1)} done ${pct(o.done / Math.max(1, o.passes))}  beat ${(o.beat / N).toFixed(2)}`;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
// pro assist: the ball goes where you flick it, so reading the field is all on you
const smart = row('smart'), pro = row('smart', 50, 'pro'), careless = row('careless', 50, 'pro'), easy = row('smart', 20), hard = row('smart', 85);
console.log(line('playmaker', smart));
console.log(line('playmaker, pro assist', pro));
console.log(line('careless, pro assist', careless));
console.log(line('playmaker, easy', easy));
console.log(line('playmaker, hard', hard));
check(pro.goal > careless.goal * 1.5, `reading the field scores more (${pct(pro.goal / N)} vs ${pct(careless.goal / N)} of attacks)`);
check(pro.lost < careless.lost, `and loses the ball less (${pct(pro.lost / N)} vs ${pct(careless.lost / N)})`);
check(pro.done / pro.passes > careless.done / careless.passes + 0.05, `open passes get there more often (${pct(pro.done / pro.passes)} vs ${pct(careless.done / careless.passes)})`);
check(smart.goal / N > 0.15 && smart.goal / N < 0.55, `a good attack scores sometimes, not always (${pct(smart.goal / N)})`);
check(smart.saves > 0, `the keeper makes saves (${smart.saves} in ${N})`);
check(hard.goal < easy.goal, `harder defenses give up less (${pct(easy.goal / N)} vs ${pct(hard.goal / N)})`);
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
