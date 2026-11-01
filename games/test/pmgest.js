// Playmaker gestures: a fake performance.now and dispatched pointer events on
// the Playmaker canvas, so a flick of a given shape reads the same every time.
module.exports = async function install(p) {
  await p.evaluate(() => {
    const realNow = performance.now.bind(performance);
    let offset = 0, frozen = false, now = 0;
    performance.now = () => frozen ? now : realNow() + offset;
    // pts: [{x, y, t}] ; hold: ms to keep the clock running between points (real waits)
    window.__pmg = (pts) => {
      const cv = document.querySelector('.pmx canvas');
      const base = realNow() + offset;
      frozen = true;
      pts.forEach((q, i) => {
        now = base + q.t;
        const type = i === 0 ? 'pointerdown' : (i === pts.length - 1 ? 'pointerup' : 'pointermove');
        cv.dispatchEvent(new PointerEvent(type, { clientX: q.x, clientY: q.y, pointerId: 9, bubbles: true, isPrimary: true, pointerType: 'touch' }));
      });
      offset += pts[pts.length - 1].t;
      frozen = false;
    };
    window.__pmDown = (x, y) => { const cv = document.querySelector('.pmx canvas'); cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 9, bubbles: true, isPrimary: true, pointerType: 'touch' })); };
    window.__pmMove = (x, y) => { const cv = document.querySelector('.pmx canvas'); cv.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 9, bubbles: true, isPrimary: true, pointerType: 'touch' })); };
    window.__pmUp = (x, y) => { const cv = document.querySelector('.pmx canvas'); cv.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 9, bubbles: true, isPrimary: true, pointerType: 'touch' })); };
  });
  // a stroke from (x0,y0) by (dx,dy) over ms. o.dip pulls back first (a bounce
  // pass); o.curl bows the path sideways by that many pixels.
  const stroke = (x0, y0, dx, dy, ms, o) => p.evaluate(([x0, y0, dx, dy, ms, o]) => {
    const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    const pts = [{ x: x0, y: y0, t: 0 }];
    let cx = x0, cy = y0, t = 0;
    if (o.dip) for (let i = 1; i <= 5; i++) { cx = x0 - ux * o.dip * i / 5; cy = y0 - uy * o.dip * i / 5; pts.push({ x: cx, y: cy, t: t += 24 }); }
    const fx = x0 + dx - cx, fy = y0 + dy - cy, fl = Math.hypot(fx, fy) || 1;
    const n = 10;
    for (let i = 1; i <= n; i++) {
      const k = i / n, bow = (o.curl || 0) * Math.sin(Math.PI * k);
      pts.push({ x: cx + fx * k - fy / fl * bow, y: cy + fy * k + fx / fl * bow, t: t + ms * k });
    }
    pts.push({ x: x0 + dx, y: y0 + dy, t: t + ms + 1 });
    window.__pmg(pts);
  }, [x0, y0, dx, dy, ms, o || {}]);
  return {
    stroke,
    tap: (x, y) => p.evaluate(([x, y]) => window.__pmg([{ x, y, t: 0 }, { x: x + 1, y, t: 70 }]), [x || 195, y || 700]),
    down: (x, y) => p.evaluate(([x, y]) => window.__pmDown(x, y), [x, y]),
    move: (x, y) => p.evaluate(([x, y]) => window.__pmMove(x, y), [x, y]),
    up: (x, y) => p.evaluate(([x, y]) => window.__pmUp(x, y), [x, y])
  };
};
