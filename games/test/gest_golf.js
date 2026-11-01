// Deterministic golf gestures: a fake clock and dispatched pointer events on the
// golf canvas, so a swing of a given shape and speed reads the same every time.
module.exports = async function install(p) {
  await p.evaluate(() => {
    let now = 1000;
    const realNow = performance.now.bind(performance);
    let offset = 0, frozen = false;
    performance.now = () => frozen ? now : realNow() + offset;
    window.__gest = pts => {
      const cv = document.querySelector('.gx canvas');
      const base = realNow() + offset;
      frozen = true;
      pts.forEach((q, i) => {
        now = base + q.t;
        const type = i === 0 ? 'pointerdown' : (i === pts.length - 1 ? 'pointerup' : 'pointermove');
        cv.dispatchEvent(new PointerEvent(type, { clientX: q.x, clientY: q.y, pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch' }));
      });
      offset += pts[pts.length - 1].t;
      frozen = false;
    };
  });
  return {
    /* A swing: pull down `back` screen heights over backMs, then swing back up to
       the start in downMs and carry on at the same speed to `finish` screen heights
       above it. `bow` bends the downswing (share of its length, + bows right);
       `dx` ends it to the side in px. */
    swing: o => p.evaluate(o => {
      const H = window.innerHeight, x0 = o.x == null ? 195 : o.x, y0 = (o.y == null ? 0.55 : o.y) * H;
      const back = o.back, finish = o.finish == null ? 0.12 : o.finish, backMs = o.backMs || 380, bow = o.bow || 0, dx = o.dx || 0;
      const downMs = o.downMs || 70, upMs = downMs * (back + finish) / back;
      const pts = [{ x: x0, y: y0, t: 0 }];
      for (let i = 1; i <= 10; i++) pts.push({ x: x0, y: y0 + back * H * i / 10, t: backMs * i / 10 });
      const low = y0 + back * H, top = y0 - finish * H, chord = low - top;
      for (let i = 1; i <= 12; i++) {
        const k = i / 12;
        pts.push({ x: x0 + dx * k + Math.sin(Math.PI * k) * bow * chord, y: low - chord * k, t: backMs + upMs * k });
      }
      pts.push({ x: x0 + dx, y: top, t: backMs + upMs + 1 });
      window.__gest(pts);
    }, o),
    aim: dx => p.evaluate(dx => { const pts = []; for (let i = 0; i <= 6; i++) pts.push({ x: 195 + dx * i / 6, y: 420, t: 100 * i / 6 }); pts.push({ x: 195 + dx, y: 420, t: 101 }); window.__gest(pts); }, dx),
    tap: () => p.evaluate(() => window.__gest([{ x: 195, y: 420, t: 0 }, { x: 196, y: 420, t: 80 }]))
  };
};
