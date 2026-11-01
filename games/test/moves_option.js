// Option Arcade, headless: the runner's moves are counters, not buttons that always work.
// A bot runs the option with right reads and one habit at a time: hurdle a man as he dives, hurdle a man standing up,
// spin off a man coming from the side, or nothing. Diving tacklers should get cleared and upright ones should win;
// spinning should beat side and arm tackles.
//   node games/test/moves_option.js [plays per habit]
const FB = require('../src/football/sim.js');
const N = +(process.argv[2] || 500);

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
function run(seed, habit) {
  const P = FB.create({ seed, look: 'mixed', play: 'triple', side: seed % 2 ? 1 : -1 });
  const L = P.look, pull = L.de === 'crash';
  let t = 0, used = 0, hits = 0;
  while (P.phase !== 'dead' && t < 25) {
    const inp = { hold: !(P.phase === 'mesh' && pull && P.rideU > 0.45) && P.phase !== 'run' };
    const c = P.carrier;
    if (P.phase === 'run' && c && c === P.ctrl) {
      inp.steer = steerBot(P, c);
      if (c === P.by.QB && FB.canPitch(P)) {
        const k = FB.key2Of(P), ol = P.by['OLB' + (P.s > 0 ? 'R' : 'L')];
        if ((L.scrape || L.key2 === 'qb' || ol.commit === 'qb') && FB.dist(k, c) < 2.6) inp.pitch = true;
      }
      for (const d of P.players) {
        if (d.team !== 'D' || d.st === 'down' || d.eng || c.cd > 0) continue;
        const dx = d.x - c.x, dy = d.y - c.y, dd = Math.hypot(dx, dy), front = (Math.cos(c.h) * dx + Math.sin(c.h) * dy) / (dd || 1);
        if (habit === 'hurdleDive' && d.st === 'lunge' && dd < 2.1 && front > 0.2) { inp.hurdle = true; used++; break; }
        if (habit === 'hurdleUp' && d.st !== 'lunge' && dd < 1.5 && front > 0.5) { inp.hurdle = true; used++; break; }
        if (habit === 'spinSide' && dd < 1.9 && front < 0.4 && front > -0.9 && (d.st === 'lunge' || dd < 1.2)) { inp.spin = true; used++; break; }
      }
    }
    FB.step(P, 1 / 60, inp); t += 1 / 60;
  }
  const r = P.result;
  return { y: r.yards, brk: r.stats.broken, hw: r.stats.hurdleWins, sw: r.stats.spinWins, used, fum: r.log.includes('hit in the air') ? 1 : 0 };
}
function habit(h) {
  let y = 0, brk = 0, hw = 0, sw = 0, used = 0, fum = 0;
  for (let i = 0; i < N; i++) { const r = run(3000 + i * 7919, h); y += r.y; brk += r.brk; hw += r.hw; sw += r.sw; used += r.used; fum += r.fum; }
  return { ypp: y / N, brk: brk / N, hw, sw, used, rate: h.startsWith('hurdle') ? hw / Math.max(1, used) : sw / Math.max(1, used), fum };
}
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const res = {};
for (const h of ['none', 'hurdleDive', 'hurdleUp', 'spinSide']) {
  res[h] = habit(h);
  const r = res[h];
  console.log(`${h.padEnd(11)} ${r.ypp.toFixed(1).padStart(5)} ypp  broken ${r.brk.toFixed(2)}  used ${String(r.used).padStart(4)}  worked ${(r.rate * 100).toFixed(0)}%  ball out in the air ${r.fum}`);
}
check(res.hurdleDive.rate > 0.45, `hurdling a man as he dives clears him (${(res.hurdleDive.rate * 100).toFixed(0)}% of the time)`);
check(res.hurdleDive.rate > res.hurdleUp.rate + 0.25, `hurdling a man standing up is a bad idea (${(res.hurdleUp.rate * 100).toFixed(0)}% vs ${(res.hurdleDive.rate * 100).toFixed(0)}%)`);
check(res.hurdleDive.ypp > res.none.ypp, `well-timed hurdles gain yards (${res.hurdleDive.ypp.toFixed(1)} vs ${res.none.ypp.toFixed(1)})`);
check(res.spinSide.brk > res.none.brk, `spinning off side tackles breaks more of them (${res.spinSide.brk.toFixed(2)} vs ${res.none.brk.toFixed(2)} a play)`);
check(res.spinSide.ypp > res.none.ypp - 0.3, `spinning isn't a yardage tax when used right (${res.spinSide.ypp.toFixed(1)} vs ${res.none.ypp.toFixed(1)})`);
console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
