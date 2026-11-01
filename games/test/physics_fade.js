// Fadeaways: a well-judged flick (sized for the extra distance) should drop as
// often as a set shot does; the cost is a smaller window, set by the engine.
const M = require('./load')(['hoops/court.js', 'hoops/physics.js']);
const { Court3D, HoopPhysics } = M;
const court = Court3D.COURTS.gym;
for (const spot of ['lbk', 'lane', 'le', 'ft', 'top', 'lc']) {
  const s = Court3D.spotInfo(court, spot);
  const row = [];
  for (const fade of [false, true]) {
    const cells = [];
    for (const r of [0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15]) {
      let m = 0; const N = 150;
      for (let i = 0; i < N; i++) {
        const K = 1.75, ideal = K * HoopPhysics.idealFlick(fade ? s.dist + 1.5 : s.dist);
        const sh = HoopPhysics.shoot({ shooter: s.pos, flickSpeed: ideal * r, angle: 0, fade, touchK: K, court, window: 0.12 * (fade ? 0.8 : 1), aimDead: 4.5, contest: 0, rating: 60 });
        if (HoopPhysics.simulate(sh.release, sh.vel, court).result === 'made') m++;
      }
      cells.push(String(Math.round(m / N * 100)).padStart(4));
    }
    row.push((fade ? 'fade ' : 'plain') + cells.join(''));
  }
  console.log(spot.padEnd(5), s.dist.toFixed(1).padStart(5), row.join('  |  '));
}
console.log('columns: flick ratio 0.85 0.9 0.95 1.0 1.05 1.1 1.15');
