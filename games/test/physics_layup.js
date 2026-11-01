// Layup make rates: by angle (glass vs straight), by touch error, with and without spin.
const M = require('./load')(['hoops/court.js', 'hoops/physics.js']);
const { Court3D, HoopPhysics } = M;
for (const cid of ['gym', 'park']) {
  const court = Court3D.COURTS[cid];
  console.log('court', cid);
  for (const ang of [0, 15, 30, 45, 60, 75]) {
    for (const d of [3.5, 5]) {
      const pos = Court3D.polar(ang, d);
      const row = [];
      for (const [label, curl] of [['plain', 0], ['spin', 0.15], ['over', 0.4]]) {
        const cells = [];
        for (const r of [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3]) {
          let m = 0, bank = false; const N = 120;
          for (let i = 0; i < N; i++) {
            const K = 1.75, ideal = K * HoopPhysics.idealFlick(d);
            const sh = HoopPhysics.shoot({ shooter: pos, flickSpeed: ideal * r, angle: 0, curl, touchK: K, court, window: 0.12 * 1.35, aimDead: 4.5, contest: 0, rating: 60 });
            bank = sh.bank;
            const b = HoopPhysics.newBall(sh.release, sh.vel, { touch: sh.touch, spinOut: sh.spinOut });
            let n = 0; while (!b.result && n++ < 2000) HoopPhysics.advance(b, 1 / 120, court);
            if (b.result === 'made') m++;
          }
          cells.push(String(Math.round(m / N * 100)).padStart(3));
        }
        row.push(label + ':' + cells.join(''));
      }
      console.log(`  ${String(ang).padStart(2)}deg ${d}ft ${HoopPhysics.shoot({ shooter: pos, flickSpeed: 1, angle: 0, touchK: 1, court, window: 0.1, aimDead: 4 }).bank ? 'glass ' : 'direct'} | ` + row.join(' | '));
    }
  }
}
console.log('columns: flick ratio 0.7 0.8 0.9 1.0 1.1 1.2 1.3');
