/* Swing: the golf gesture, built on the same idea as the shared flick.
   Put a finger on the ball and pull it straight back: that's the backswing,
   and how far you pull is the power. Then swing up through it. How fast you
   come through, against your own tempo, is the strike. The direction is the
   start line, a bend in the path is the shape, and how far past the ball you
   finish is the trajectory. Lengths are in screen heights, so it reads the
   same on any phone. A sideways swipe without a backswing turns your aim. */
const Swing = (() => {
  const TAP_PX = 12;

  function lowIndex(samples) {
    let k = 0;
    for (let i = 1; i < samples.length; i++) if (samples[i].y > samples[k].y) k = i;
    return k;
  }
  function screenH() { return Math.max(320, window.innerHeight || 800); }

  function classify(start, samples) {
    const h = screenH();
    const last = samples[samples.length - 1];
    const dx = last.x - start.x, dy = last.y - start.y;
    const dur = Math.max(1, last.t - start.t);
    let maxD = 0;
    for (const s of samples) maxD = Math.max(maxD, Math.hypot(s.x - start.x, s.y - start.y));
    if (maxD < TAP_PX) return dur < 380 ? { type: 'tap', x: last.x, y: last.y } : { type: 'none', why: 'hold' };
    const li = lowIndex(samples), low = samples[li];
    const back = Math.max(0, (low.y - start.y) / h);
    const upPx = low.y - last.y;
    if (back < 0.03 && Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy) * 1.2) return { type: 'aim', dx, frac: dx / Math.max(320, window.innerWidth || 400) };
    if (back < 0.022) return { type: 'none', why: upPx > 24 ? 'noBack' : 'tiny' };
    if (upPx < Math.max(22, back * h * 0.55)) return { type: 'none', why: 'noThrough', back };
    // the downswing: everything after the top of the backswing. Tempo is the
    // time from the top back to the ball (where you started); the finish after
    // that doesn't change it.
    const up = samples.slice(li);
    let impactT = null;
    for (let i = 1; i < up.length; i++) {
      if (up[i].y <= start.y) {
        const a = up[i - 1], b = up[i], f = (a.y - start.y) / Math.max(1e-6, a.y - b.y);
        impactT = a.t + (b.t - a.t) * f;
        break;
      }
    }
    // never got back to the ball: treat the end of the stroke as impact
    const downDist = impactT == null ? (low.y - last.y) / h : back;
    if (impactT == null) impactT = last.t;
    const down = Math.max(12, impactT - low.t) / 1000;
    const speed = downDist / down;
    const cx = last.x - low.x, cy = last.y - low.y, chord = Math.hypot(cx, cy) || 1;
    // bow of the downswing path, as a share of its length; positive bows right
    let bow = 0;
    for (const s of up) {
      const dev = (cx * (s.y - low.y) - cy * (s.x - low.x)) / chord;
      if (Math.abs(dev) > Math.abs(bow)) bow = dev;
    }
    return {
      type: 'swing', back, speed, rate: 1 / down, down,
      angle: Math.atan2(cx, -cy), curl: bow / chord,
      finish: (start.y - last.y) / h, dur
    };
  }

  // what the finger is doing right now, for drawing the club and the meter
  function live(start, samples) {
    const h = screenH();
    const li = lowIndex(samples), low = samples[li], cur = samples[samples.length - 1];
    const back = Math.max(0, (low.y - start.y) / h);
    const through = low.y - cur.y > 10;
    return { back, through, rise: (low.y - cur.y) / h, dx: cur.x - start.x };
  }

  function attach(el, on) {
    let id = null, start = null, samples = null;
    const pt = e => ({ x: e.clientX, y: e.clientY, t: performance.now() });
    function down(e) {
      if (id !== null) return;
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (_) {}
      start = pt(e); samples = [start];
      on.down && on.down(start);
      e.preventDefault();
    }
    function move(e) {
      if (e.pointerId !== id) return;
      const p = pt(e);
      samples.push(p);
      if (samples.length > 400) samples.splice(1, 1);
      on.move && on.move(live(start, samples), p, start);
    }
    function up(e) {
      if (e.pointerId !== id) return;
      samples.push(pt(e));
      const g = classify(start, samples);
      id = null;
      on.gesture && on.gesture(g);
    }
    function cancel(e) { if (e.pointerId === id) { id = null; on.cancel && on.cancel(); } }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.style.touchAction = 'none';
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }

  return { attach, classify, live };
})();
