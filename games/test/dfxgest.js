// Lockdown gestures: a fake performance.now and dispatched pointer events on
// the Lockdown canvas, so a slide, slice or flick of a given shape reads the
// same every time.
module.exports = async function install(p) {
  await p.evaluate(() => {
    const realNow = performance.now.bind(performance);
    let offset = 0, frozen = false, now = 0;
    performance.now = () => frozen ? now : realNow() + offset;
    const cv = () => document.querySelector('.dfx canvas');
    const ev = (type, x, y) => cv().dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    // pts: [{x, y, t}] played instantly against a frozen clock
    window.__dfg = (pts) => {
      const base = realNow() + offset;
      frozen = true;
      pts.forEach((q, i) => { now = base + q.t; ev(i === 0 ? 'pointerdown' : (i === pts.length - 1 ? 'pointerup' : 'pointermove'), q.x, q.y); });
      offset += pts[pts.length - 1].t;
      frozen = false;
    };
    window.__dfDown = (x, y) => ev('pointerdown', x, y);
    window.__dfMove = (x, y) => ev('pointermove', x, y);
    window.__dfUp = (x, y) => ev('pointerup', x, y);
  });
  // a quick stroke from (x0,y0) by (dx,dy) over ms
  const stroke = (x0, y0, dx, dy, ms) => p.evaluate(([x0, y0, dx, dy, ms]) => {
    const pts = [{ x: x0, y: y0, t: 0 }];
    const n = 8;
    for (let i = 1; i <= n; i++) pts.push({ x: x0 + dx * i / n, y: y0 + dy * i / n, t: ms * i / n });
    pts.push({ x: x0 + dx, y: y0 + dy, t: ms + 1 });
    window.__dfg(pts);
  }, [x0, y0, dx, dy, ms]);
  return {
    stroke,
    down: (x, y) => p.evaluate(([x, y]) => window.__dfDown(x, y), [x, y]),
    move: (x, y) => p.evaluate(([x, y]) => window.__dfMove(x, y), [x, y]),
    up: (x, y) => p.evaluate(([x, y]) => window.__dfUp(x, y), [x, y])
  };
};
