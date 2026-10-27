// Whole games of Pong Night in Node, with the game's rules (balls back, on
// fire, re-racks, rebuttal, overtime), a bot that makes the right read, and
// each computer opponent. Checks that the opponents line up from easy to hard
// and that a good read beats a bad one.
const load = require('./load');
const { PongPhysics: P, Pong } = load(['pong/physics.js', 'pong/rules.js']);

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = mulberry(77);
const GAMES = +(process.argv[2] || 40);
const SNAP = +(process.env.SNAP || 0.1), FASTW = +(process.env.FASTW || 0.1);
const live = cups => cups.filter(c => c.live);

function pickFor(cups, opp, smart) {
  const ex = live(cups).map(c => ({ c, e: Pong.exposure(c, cups, 'far') }));
  if (!smart) { const x = ex[Math.floor(rand() * ex.length)]; return { cup: x.c, kind: 'arc', e: x.e }; }
  const isl = ex.find(x => x.e === 'island');
  if (isl) return { cup: isl.c, kind: opp && opp.swat ? 'fast' : 'bounce', e: 'island' };
  const front = ex.find(x => x.e === 'front');
  const buried = ex.filter(x => x.e === 'buried');
  if (buried.length >= 3) { const mid = buried.sort((a, b) => Math.hypot(a.c.x, a.c.z - 7.5) - Math.hypot(b.c.x, b.c.z - 7.5))[0]; return { cup: mid.c, kind: 'arc', e: 'buried' }; }
  if (front) return { cup: front.c, kind: 'fast', e: 'front' };
  return { cup: ex[0].c, kind: 'arc', e: ex[0].e };
}
function youThrow(cups, opp, prof, fire) {
  const { cup, kind } = pickFor(cups, opp, prof.smart);
  const from = P.RELEASE.near;
  const yaw = Math.atan2(cup.x - from[0], cup.z - from[2]) * 180 / P.AIM_GAIN / Math.PI;
  const ideal = kind === 'fast' ? P.FAST_IDEAL : P.P0[kind] + (cup.z - P.Z_REF) / P.DEPTH_PER;
  const mult = fire ? 1.25 : 1;
  const shot = P.throwBall({ kind, side: 'near', cups: live(cups), p: ideal * (1 + P.gauss(rand) * prof.sigP), angle: yaw + P.gauss(rand) * prof.sigA, curl: 0, snap: SNAP * mult, fastWindow: FASTW * mult, rand });
  const b = P.simulate(shot.release, shot.vel, cups);
  if (b.result !== 'made') return 0;
  if (b.bounces && opp && opp.swat && rand() < 0.92) return 0;
  const c = cups.find(x => x.id === b.sunk); c.live = false;
  if (b.bounces) { const L = live(cups); if (L.length) { const cx = L.reduce((s, x) => s + x.x, 0) / L.length, cz = L.reduce((s, x) => s + x.z, 0) / L.length; L.sort((a, b2) => Math.hypot(b2.x - cx, b2.z - cz) - Math.hypot(a.x - cx, a.z - cz))[0].live = false; return 2; } }
  return 1;
}
function cpuThrow(cups, opp, fire, rebuttal) {
  // the computer throws from the far end at the near rack; mirror so the same layout code applies
  const ex = live(cups).map(c => ({ c, e: Pong.exposure(c, cups, 'near') }));
  let pick, kind = 'arc';
  if (opp.hot) { pick = ex.find(x => x.e === 'front') || ex.find(x => x.e === 'island') || ex[0]; kind = pick.e === 'front' ? 'fast' : 'arc'; }
  else { pick = ex[Math.floor(rand() * ex.length)]; if (pick.e === 'front' && rand() < 0.45) kind = 'fast'; }
  const skill = Math.min(0.95, opp.skill + (fire ? 0.07 : 0) + (rebuttal ? 0.04 : 0));
  const t = P.cpuThrow('far', pick.c, kind, skill, rand);
  const b = P.simulate(t.release, t.vel, cups);
  if (b.result !== 'made') return 0;
  cups.find(x => x.id === b.sunk).live = false;
  return 1;
}
function rerack(cups, side, used, choose) {
  const n = live(cups).length;
  const th = n <= 6 && n > 3 && !used.six ? 'six' : n <= 3 && n >= 2 && !used.three ? 'three' : null;
  if (!th || !Pong.RERACKS[n]) return cups;
  used[th] = true;
  return Pong.rerack(cups, choose(Pong.RERACKS[n]), side);
}
// one side's turn; returns true if they cleared the other rack
function turn(side, st, rebuttal) {
  let left = rebuttal ? 1 : 2, pair = 0, pairMade = 0;
  while (left > 0) {
    const target = side === 'you' ? st.far : st.near;
    const fire = side === 'you' ? st.fire : st.cpuFire;
    const got = side === 'you' ? youThrow(target, st.opp, st.prof, fire) : cpuThrow(target, st.opp, fire, rebuttal);
    st.throws[side]++; st.cups[side] += got;
    const made = got > 0;
    if (side === 'you') { st.streak = made ? st.streak + 1 : 0; st.fire = st.streak >= 3; } else { st.cpuStreak = made ? st.cpuStreak + 1 : 0; st.cpuFire = st.cpuStreak >= 3; }
    left--; pair++; if (made) pairMade++;
    if (!live(target).length) return true;
    if (rebuttal) { if (!made) return false; left = 1; continue; }
    if (pair >= 2) { if (pairMade >= 2) left += 2; pair = 0; pairMade = 0; }
    if (made && (side === 'you' ? st.fire : st.cpuFire)) left = Math.max(left, 1);
  }
  return false;
}
function game(oppId, prof) {
  const st = { opp: Pong.OPPONENTS[oppId], prof, far: Pong.layout('tri10', 'far'), near: Pong.layout('tri10', 'near'), streak: 0, cpuStreak: 0, fire: false, cpuFire: false, throws: { you: 0, cpu: 0 }, cups: { you: 0, cpu: 0 }, turns: 0 };
  const used = { far: {}, near: {} };
  for (let ot = 0; ot < 4; ot++) {
    for (let guard = 0; guard < 80; guard++) {
      st.turns++;
      if (!ot) st.far = rerack(st.far, 'far', used.far, o => o[0]);
      if (turn('you', st)) { if (!turn('cpu', st, true)) return { won: true, st }; break; }
      if (!ot) st.near = rerack(st.near, 'near', used.near, o => st.opp.hot ? o[0] : o[Math.floor(rand() * o.length)]);
      if (turn('cpu', st)) { if (!turn('you', st, true)) return { won: false, st }; break; }
    }
    st.far = Pong.layout('tri3', 'far'); st.near = Pong.layout('tri3', 'near');
  }
  return { won: false, st };
}
const PROFILES = {
  'decent, right reads': { sigP: 0.06, sigA: 3, smart: true },
  'decent, random arcs': { sigP: 0.06, sigA: 3, smart: false },
  'casual, right reads': { sigP: 0.1, sigA: 5, smart: true },
  'casual, random arcs': { sigP: 0.1, sigA: 5, smart: false }
};
for (const [name, prof] of Object.entries(PROFILES)) {
  console.log(`\n${name}:`);
  for (const id of Pong.OPP_IDS) {
    let w = 0, turns = 0, yp = 0, cp = 0;
    for (let g = 0; g < GAMES; g++) { const r = game(id, prof); if (r.won) w++; turns += r.st.turns; yp += r.st.cups.you / Math.max(1, r.st.throws.you); cp += r.st.cups.cpu / Math.max(1, r.st.throws.cpu); }
    console.log(`  vs ${Pong.OPPONENTS[id].name.padEnd(12)} win ${String(Math.round(w / GAMES * 100)).padStart(3)}% · ${(turns / GAMES).toFixed(1)} turns · you ${(yp / GAMES).toFixed(2)} cups/throw · him ${(cp / GAMES).toFixed(2)}`);
  }
}
