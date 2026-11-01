// Option Arcade, headless: the passing game. A bot drops back and throws, leading the receiver, to the most open man
// or to the most covered man, against every coverage and every concept; then a bot that holds the ball too long.
// The open man should be completed more and gain more; holding it should get you sacked; nothing should be a free lunch.
//   node games/test/sim_pass.js [plays per cell]
const FB = require('../src/football/sim.js');
const N = +(process.argv[2] || 120);

function steerBot(P, c) {
  let best = 0, bv = -1e9;
  for (let a = -1.25; a <= 1.25; a += 0.125) {
    const px = c.x + Math.cos(a) * 3.2, py = c.y + Math.sin(a) * 3.2;
    let m = 9;
    for (const d of P.players) if (d.team === 'D' && d.st !== 'down') m = Math.min(m, Math.hypot(d.x - px, d.y - py) * (d.eng ? 1.6 : 1));
    const v = Math.min(m, 4.5) + Math.cos(a) * 1.6 - (Math.abs(py) > FB.SIDE - 2 ? 4 : 0);
    if (v > bv) { bv = v; best = a; }
  }
  return { x: Math.cos(best), y: Math.sin(best) };
}
function lead(P, m) {
  const q = P.by.QB;
  let T = 0.6;
  for (let i = 0; i < 3; i++) { const tx = m.x + m.vx * T, ty = m.y + m.vy * T, dd = Math.hypot(tx - q.x, ty - q.y); T = dd / (15 + dd * 0.2); }
  return { x: m.x + m.vx * T, y: m.y + m.vy * T, T };
}
// policy: 'open' | 'covered'; when: seconds after the snap to let it go
function run(opts, policy, when) {
  const P = FB.create(opts);
  let t = 0;
  while (P.phase !== 'dead' && t < 25) {
    const inp = { snap: P.phase === 'pre' };
    const c = P.carrier, q = P.by.QB;
    if (P.phase === 'run' && c === q && FB.canThrow(P) && P.t - P.passT >= when) {
      // like a QB: open enough and as far downfield as possible; 'covered' throws to the tightest man past the sticks
      const rows = FB.ELIGIBLE.map(id => { const m = P.by[id], L = lead(P, m); return { m, L, sep: FB.openness(P, m, L.T) }; }).filter(r => r.L.x - q.x < 42 && r.m.role === 'route');
      if (rows.length) {
        const deep = rows.filter(r => r.L.x > 4);
        // progression: the deepest man who's open; nobody open, the most open
        const openRows = rows.filter(r => r.sep >= 1.7);
        const pick = policy === 'open' ? (openRows.length ? openRows.reduce((a, r) => (r.L.x > a.L.x ? r : a)) : rows.reduce((a, r) => (r.sep > a.sep ? r : a)))
          : (deep.length ? deep : rows).reduce((a, r) => (r.sep < a.sep ? r : a));
        inp.throw = { x: pick.L.x, y: pick.L.y };
      }
    }
    if (P.phase === 'run' && c && c === P.ctrl && c !== q) inp.steer = steerBot(P, c);
    FB.step(P, 1 / 60, inp);
    t += 1 / 60;
  }
  return P.result;
}
function cell(cov, concept, policy, when, dif) {
  let att = 0, comp = 0, yds = 0, int = 0, sack = 0, td = 0, right = 0, judged = 0, big = 0;
  for (let i = 0; i < N; i++) {
    const r = run({ play: 'pass', concept, look: cov, seed: 500 + i * 7919, side: i % 2 ? 1 : -1, difficulty: dif == null ? 50 : dif, toGoal: 70 }, policy, when);
    if (r.how === 'sack') { sack++; yds += r.yards; continue; }
    if (!r.thrown) { yds += r.yards; continue; }
    att++;
    if (r.reads.read1) { judged++; if (r.reads.read1.correct) right++; }
    if (r.how === 'turnover') { int++; continue; }
    if (r.how === 'incomplete') continue;
    comp++; yds += r.yards; if (r.how === 'td') td++; if (r.yards >= 20) big++;
  }
  return { att, comp: att ? comp / att : 0, ypa: yds / N, int: int / N, sack: sack / N, td: td / N, big: big / N, right: judged ? right / judged : 0 };
}
const pct = v => (v * 100).toFixed(0).padStart(3) + '%';
const line = (label, c) => `${label.padEnd(30)} comp ${pct(c.comp)}  ${c.ypa.toFixed(1).padStart(5)} yds/play  20+ ${pct(c.big)}  td ${pct(c.td)}  int ${pct(c.int)}  sack ${pct(c.sack)}  open-read ${pct(c.right)}`;

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const rows = {};
for (const cov of ['cover1', 'cover2', 'cover3', 'blitz']) {
  for (const concept of ['slants', 'smash', 'verts', 'mesh']) {
    const when = concept === 'slants' ? 1.0 : concept === 'verts' ? 1.8 : 1.5;
    const open = cell(cov, concept, 'open', when), cov2 = cell(cov, concept, 'covered', when);
    rows[cov + '/' + concept] = { open, cov: cov2 };
    console.log(line(`${cov} ${concept} / open`, open));
    console.log(line(`${cov} ${concept} / covered`, cov2));
  }
}
console.log('');
const all = cell('mixed', 'mesh', 'open', 1.5), allBad = cell('mixed', 'mesh', 'covered', 1.5);
console.log(line('mixed mesh / open', all));
const hold = cell('mixed', 'verts', 'open', 4.2);
console.log(line('mixed verts / holds it 4.2s', hold));
const quick = cell('mixed', 'verts', 'open', 1.8);
console.log(line('mixed verts / on time 1.8s', quick));
const hard = cell('mixed', 'mesh', 'open', 1.5, 85), easy = cell('mixed', 'mesh', 'open', 1.5, 20);
console.log(line('mixed mesh / open, difficulty 20', easy));
console.log(line('mixed mesh / open, difficulty 85', hard));
console.log('');
const avg = (k, f) => Object.values(rows).reduce((a, r) => a + r[k][f], 0) / 16;
const avgC = avg('open', 'comp'), avgB = avg('cov', 'comp'), yO = avg('open', 'ypa'), yC = avg('cov', 'ypa'), iO = avg('open', 'int'), iC = avg('cov', 'int');
check(avgC > avgB + 0.15, `the open man is completed more often (${pct(avgC)} vs ${pct(avgB)})`);
check(yO > yC + 1, `throwing to the open man gains more over every coverage and concept (${yO.toFixed(1)} vs ${yC.toFixed(1)} a play)`);
check(iC > iO, `forcing it into coverage gets picked more (${pct(iC)} vs ${pct(iO)})`);
check(avgC > 0.55 && avgC < 0.88, `open throws complete at a believable rate (${pct(avgC)})`);
check(yO > 4 && yO < 15, `open throws gain a believable amount (${yO.toFixed(1)} a play)`);
check(hold.sack > quick.sack + 0.1, `holding the ball gets you sacked (${pct(hold.sack)} vs ${pct(quick.sack)})`);
check(hard.ypa < easy.ypa, `harder defenses give up less (${easy.ypa.toFixed(1)} vs ${hard.ypa.toFixed(1)})`);
const bl = rows['blitz/slants'].open, c3v = rows['cover3/verts'].open;
check(bl.sack < 0.15, `quick slants beat the blitz before it gets home (${pct(bl.sack)} sacks)`);
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
