const M = require('./load')(['hoops/court.js', 'hoops/physics.js']);
const { Court3D, HoopPhysics } = M;
const court = Court3D.COURTS.gym;
function trial(spotId, flickRatio, angleDeg, opts) {
  const s = Court3D.spotInfo(court, spotId);
  const K = 2.4;
  const ideal = K * HoopPhysics.idealFlick(s.dist);
  const shot = HoopPhysics.shoot(Object.assign({ shooter: s.pos, flickSpeed: ideal * flickRatio, angle: angleDeg * Math.PI / 180, touchK: K, window: 0.12, aimDead: 4, contest: 0, rating: 60 }, opts || {}));
  const b = HoopPhysics.simulate(shot.release, shot.vel, court);
  return b;
}
for (const spot of ['lbk', 'lane', 'ft', 'le', 'top', 'lc', 'rw', 'deep']) {
  const row = [];
  for (const r of [0.75, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.25]) {
    let made = 0, sw = 0; const N = 200;
    for (let i = 0; i < N; i++) { const b = trial(spot, r, 0); if (b.result === 'made') made++; if (b.swish) sw++; }
    row.push(`${r.toFixed(2)}:${Math.round(made / N * 100)}%`);
  }
  console.log(spot.padEnd(5), Court3D.spotInfo(court, spot).dist.toFixed(1).padStart(5), row.join(' '));
}
console.log('aim sweep at ft (ratio 1):');
console.log([0, 3, 5, 7, 9, 12, 16].map(a => { let m = 0; for (let i = 0; i < 200; i++) if (trial('ft', 1, a).result === 'made') m++; return a + 'deg:' + Math.round(m / 2) + '%'; }).join(' '));
console.log('contest sweep at top (ratio 1):');
console.log([0, 0.3, 0.6, 1].map(c => { let m = 0; for (let i = 0; i < 300; i++) if (trial('top', 1, 0, { contest: c }).result === 'made') m++; return c + ':' + Math.round(m / 3) + '%'; }).join(' '));
console.log('cpu skill at top / le / lc:');
for (const sk of [0.5, 0.65, 0.75, 0.85, 0.95]) {
  const out = ['top', 'le', 'lc', 'lane'].map(spot => {
    const s = Court3D.spotInfo(court, spot);
    let m = 0; for (let i = 0; i < 300; i++) { const sh = HoopPhysics.cpuShot(s.pos, sk); if (HoopPhysics.simulate(sh.release, sh.vel, court).result === 'made') m++; }
    return spot + ':' + Math.round(m / 3) + '%';
  });
  console.log(sk, out.join(' '));
}
