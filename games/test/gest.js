// Deterministic gestures: a fake performance.now and dispatched pointer events,
// so a flick of a given length and duration reads the same every time.
module.exports = async function install(p) {
  await p.evaluate(() => {
    let now = 1000;
    const realNow = performance.now.bind(performance);
    let offset = 0, frozen = false;
    performance.now = () => frozen ? now : realNow() + offset;
    window.__gest = (pts, type) => {
      const cv = document.querySelector('.hx canvas');
      const base = realNow() + offset;
      frozen = true;
      pts.forEach((q, i) => {
        now = base + q.t;
        const ev = new PointerEvent(i === 0 ? 'pointerdown' : (i === pts.length - 1 ? 'pointerup' : 'pointermove'), { clientX: q.x, clientY: q.y, pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch' });
        cv.dispatchEvent(ev);
      });
      offset += pts[pts.length - 1].t;
      frozen = false;
    };
  });
  return {
    flick: (len, ms = 120, dx = 0) => p.evaluate(([len, ms, dx]) => { const n = 8, pts = []; for (let i = 0; i <= n; i++) pts.push({ x: 195 + dx * i / n, y: 720 - len * i / n, t: ms * i / n }); pts.push({ x: 195 + dx, y: 720 - len, t: ms + 1 }); window.__gest(pts); }, [len, ms, dx]),
    swipe: (dx, dy) => p.evaluate(([dx, dy]) => { const pts = []; for (let i = 0; i <= 6; i++) pts.push({ x: 195 + dx * i / 6, y: 600 + dy * i / 6, t: 100 * i / 6 }); pts.push({ x: 195 + dx, y: 600 + dy, t: 101 }); window.__gest(pts); }, [dx, dy]),
    tap: () => p.evaluate(() => window.__gest([{ x: 195, y: 500, t: 0 }, { x: 196, y: 500, t: 80 }]))
  };
};
