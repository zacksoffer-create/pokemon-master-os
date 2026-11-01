// Option Arcade, headless: a bot runs the option against every defensive look, reading it right and reading it wrong.
// The right read should gain more than the wrong one against every look, and no look should be a free lunch.
//   node games/test/sim_option.js [plays per cell]
const FB = require('../src/football/sim.js');
const N = +(process.argv[2] || 300);

// steer toward open grass: score each heading by how far the nearest free defender is from where it takes you
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

// policy: 'right' reads the defender correctly, 'wrong' does the opposite; moves: use juke/truck near tacklers
function run(opts, policy, moves) {
  const P = FB.create(opts);
  const L = P.look;
  const want1 = L.de === 'crash' ? 'pull' : 'give';
  const pull = policy === 'wrong' ? want1 !== 'pull' : want1 === 'pull';   // 'wrong2' gets the first read right
  let t = 0;
  while (P.phase !== 'dead' && t < 25) {
    const inp = { hold: true };
    if (P.phase === 'mesh' && pull && P.rideU > 0.45) inp.hold = false;
    if (P.phase === 'run') inp.hold = false;
    const c = P.carrier;
    if (P.phase === 'run' && P.ctrl && (c === P.ctrl || P.ball.st === 'loose')) inp.steer = c ? steerBot(P, c) : null;
    // like a person would: the QB rides the option track at the pitch key's inside shoulder until the second read is made
    if (inp.steer && c === P.by.QB && P.give === false) {
      if (P.play === 'triple' && !P.dec.read2) { const k = FB.key2Of(P); inp.steer = { x: k.x - c.x + 0.5, y: k.y - 1.2 * P.s - c.y }; }
      if (P.play === 'read' && c.x < 0) inp.steer = { x: 0.55, y: 0.85 * P.s };
    }
    // second read
    if (P.phase === 'run' && c === P.by.QB && P.play === 'triple' && FB.canPitch(P)) {
      const k = FB.key2Of(P), ol = P.by['OLB' + (P.s > 0 ? 'R' : 'L')];
      const qbPlayer = L.scrape || L.key2 === 'qb' || ol.commit === 'qb';
      const shouldPitch = policy === 'right' ? qbPlayer && (L.key2 !== 'feather' || ol.commit) : !qbPlayer || (L.key2 === 'feather' && !ol.commit);
      const close = FB.dist(k, c) < 2.6 || c.x > k.x - 1;
      if (shouldPitch && close) inp.pitch = true;
    }
    if (moves && c && P.phase === 'run' && c === P.ctrl) {
      for (const d of P.players) {
        if (d.team !== 'D' || d.st === 'down' || d.eng) continue;
        const dd = FB.dist(d, c);
        if (dd < 2.2 && dd > 1.2 && d.x > c.x) { if (d.mass > c.mass + 0.3) inp.juke = d.y > c.y ? -1 : 1; else inp.truck = true; break; }
      }
    }
    FB.step(P, 1 / 60, inp);
    t += 1 / 60;
  }
  return P.result || { yards: 0, how: 'timeout', reads: P.dec, stats: P.stats, log: P.log };
}

function cell(look, policy, play, moves, dif) {
  const ys = [];
  let td = 0, turn = 0, r1 = 0, r1n = 0, r2 = 0, r2n = 0, broken = 0, fum = 0;
  const carriers = {};
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1;
    const res = run({ seed: 1000 + i * 7919, look, play, side, difficulty: dif == null ? 50 : dif, toGoal: 65 }, policy, moves);
    ys.push(res.yards);
    if (res.how === 'td') td++;
    if (res.how === 'turnover') turn++;
    if ((res.log || []).some(l => /fumble|ground|tipped/.test(l))) fum++;
    if (res.reads && res.reads.read1) { r1n++; if (res.reads.read1.correct) r1++; }
    if (res.reads && res.reads.read2) { r2n++; if (res.reads.read2.correct) r2++; }
    broken += (res.stats && res.stats.broken) || 0;
    carriers[res.carrierKind || 'none'] = (carriers[res.carrierKind || 'none'] || 0) + 1;
  }
  ys.sort((a, b) => a - b);
  const mean = ys.reduce((a, b) => a + b, 0) / N;
  return { mean, med: ys[N >> 1], p10: ys[Math.floor(N * 0.1)], p90: ys[Math.floor(N * 0.9)], neg: ys.filter(y => y < 0).length / N, big: ys.filter(y => y >= 15).length / N,
    td: td / N, turn: turn / N, fum: fum / N, r1: r1n ? r1 / r1n : null, r2: r2n ? r2 / r2n : null, broken: broken / N, carriers };
}

const pct = v => (v == null ? '  - ' : (v * 100).toFixed(0).padStart(3) + '%');
function line(label, c) {
  const car = Object.entries(c.carriers).map(([k, v]) => `${k} ${Math.round(v / N * 100)}`).join(' ');
  return `${label.padEnd(26)} ${c.mean.toFixed(1).padStart(5)} ypp  med ${String(c.med).padStart(3)}  p10 ${String(c.p10).padStart(3)}  p90 ${String(c.p90).padStart(3)}  loss ${pct(c.neg)}  15+ ${pct(c.big)}  td ${pct(c.td)}  TO ${pct(c.turn)}  fum ${pct(c.fum)}  r1 ${pct(c.r1)} r2 ${pct(c.r2)}  brk ${c.broken.toFixed(2)}  [${car}]`;
}

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
console.log(`Triple option, ${N} plays per row (difficulty 50, bot steering, no moves)\n`);
const rows = {};
// the first three rows test the first read (give or pull); the next five hold it right and test the second (keep or pitch)
const SECOND = ['crash+qb', 'crash+pitch', 'crash+feather', 'scrape', 'crash+qb+alley'];
for (const look of ['crash', 'sit', 'attack', ...SECOND, 'mixed']) {
  const right = cell(look, 'right', 'triple', false), wrong = cell(look, SECOND.includes(look) ? 'wrong2' : 'wrong', 'triple', false);
  rows[look] = { right, wrong };
  console.log(line(look + ' / right', right));
  console.log(line(look + ' / wrong', wrong));
}
console.log('\nRead option');
for (const look of ['crash', 'sit', 'attack', 'mixed']) {
  const right = cell(look, 'right', 'read', false), wrong = cell(look, 'wrong', 'read', false);
  rows['read-' + look] = { right, wrong };
  console.log(line('read ' + look + ' / right', right));
  console.log(line('read ' + look + ' / wrong', wrong));
}
console.log('\nMoves (mixed look, right reads)');
const mv = cell('mixed', 'right', 'triple', true);
console.log(line('mixed / right + moves', mv));
console.log('\nDifficulty (mixed look, right reads)');
const easy = cell('mixed', 'right', 'triple', false, 20), hard = cell('mixed', 'right', 'triple', false, 85);
console.log(line('difficulty 20', easy));
console.log(line('difficulty 85', hard));

console.log('');
for (const [k, { right, wrong }] of Object.entries(rows)) if (k !== 'mixed' && k !== 'read-mixed') check(right.mean > wrong.mean + 1, `${k}: right read gains more (${right.mean.toFixed(1)} vs ${wrong.mean.toFixed(1)})`);
check(rows.mixed.right.mean > 3.5 && rows.mixed.right.mean < 9, `mixed, right reads: a believable average (${rows.mixed.right.mean.toFixed(1)} ypp)`);
check(rows.mixed.right.big > 0.05, `mixed, right reads: big plays happen (${pct(rows.mixed.right.big)} go 15+)`);
check(rows.mixed.right.neg < 0.25, `mixed, right reads: losses are not the norm (${pct(rows.mixed.right.neg)})`);
check(rows['crash+qb+alley'].right.mean < rows['crash+qb'].right.mean, `the safety fill makes the right read harder (${rows['crash+qb+alley'].right.mean.toFixed(1)} vs ${rows['crash+qb'].right.mean.toFixed(1)})`);
check(hard.mean < easy.mean, `harder defenses give up less (${easy.mean.toFixed(1)} vs ${hard.mean.toFixed(1)})`);
check(rows.mixed.right.turn < 0.06, `turnovers stay rare with the right reads (${pct(rows.mixed.right.turn)})`);
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
