// Deterministic throws for Pong Night: a fake clock and dispatched pointer
// events on the game canvas, so a flick of a given shape reads the same every time.
module.exports = async function install(p) {
  await p.evaluate(() => {
    let now = 1000;
    const realNow = performance.now.bind(performance);
    let offset = 0, frozen = false;
    performance.now = () => frozen ? now : realNow() + offset;
    window.__gest = pts => {
      const cv = document.querySelector('.px canvas');
      const base = realNow() + offset;
      frozen = true;
      pts.forEach((q, i) => {
        now = base + q.t;
        cv.dispatchEvent(new PointerEvent(i === 0 ? 'pointerdown' : (i === pts.length - 1 ? 'pointerup' : 'pointermove'), { clientX: q.x, clientY: q.y, pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch' }));
      });
      offset += pts[pts.length - 1].t;
      frozen = false;
    };
  });
  // len in px, ms duration, dx sideways drift (aim), curl as a share of length
  const flick = (len, ms = 140, dx = 0, curl = 0) => p.evaluate(([len, ms, dx, curl]) => {
    const n = 10, pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push({ x: 200 + dx * t + Math.sin(Math.PI * t) * curl * len, y: 700 - len * t, t: ms * t }); }
    pts.push({ x: 200 + dx, y: 700 - len, t: ms + 1 });
    window.__gest(pts);
  }, [len, ms, dx, curl]);
  // pull down first, then flick up from the bottom of the dip
  const dip = (down, len, ms = 140, dx = 0) => p.evaluate(([down, len, ms, dx]) => {
    const pts = [];
    for (let i = 0; i <= 5; i++) pts.push({ x: 200, y: 640 + down * i / 5, t: 60 * i / 5 });
    for (let i = 1; i <= 10; i++) { const t = i / 10; pts.push({ x: 200 + dx * t, y: 640 + down - len * t, t: 60 + ms * t }); }
    pts.push({ x: 200 + dx, y: 640 + down - len, t: 61 + ms });
    window.__gest(pts);
  }, [down, len, ms, dx]);
  return { flick, dip };
};
