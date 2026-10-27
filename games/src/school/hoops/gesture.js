/* Engine 1 · Gesture
   One recognizer for every touch game: flicks, swipes, taps.
   Speeds come out in screen-heights per second and lengths in screen-heights,
   so a flick means the same thing on a small phone, a big phone, or a laptop. */
const Gesture = (() => {
  const TAP_PX = 12;
  const FLICK_MIN_PX = 24;
  const RELEASE_WINDOW_MS = 110;

  function classify(start, samples) {
    const last = samples[samples.length - 1];
    const dx = last.x - start.x, dy = last.y - start.y;
    const dist = Math.hypot(dx, dy);
    const dur = Math.max(1, last.t - start.t);
    const h = Math.max(320, window.innerHeight || 800);
    if (dist < TAP_PX) return dur < 380 ? { type: 'tap', x: last.x, y: last.y } : { type: 'hold', dur };

    // Release speed: displacement over the last ~110 ms, the part of a flick that throws.
    let k = samples.length - 1;
    while (k > 0 && last.t - samples[k - 1].t <= RELEASE_WINDOW_MS) k--;
    const ref = k === samples.length - 1 ? start : samples[k];
    const rdt = Math.max(8, last.t - ref.t) / 1000;
    const release = Math.hypot(last.x - ref.x, last.y - ref.y) / h / rdt;
    const avg = dist / h / (dur / 1000);
    const speed = Math.max(release, avg * 0.85);
    // Power blends how fast and how far the finger travelled. Length is easy to
    // repeat; speed is what "flick harder" feels like. Together they jitter less
    // than either alone.
    const power = Math.sqrt(speed * 4 * (dist / h));
    // Curl: how far the finger's path bows away from a straight line, as a
    // share of its length. Positive bows to the right. A layup flick with a
    // little curl puts spin on the ball.
    let bow = 0;
    for (const s of samples) {
      const dev = (dx * (s.y - start.y) - dy * (s.x - start.x)) / dist;
      if (Math.abs(dev) > Math.abs(bow)) bow = dev;
    }
    const curl = bow / dist;

    const base = { dx, dy, dist, dur, speed, power, curl, startX: start.x, startY: start.y };
    if (-dy > Math.abs(dx) * 0.7 && dist >= FLICK_MIN_PX) {
      // Pulling the finger down first, then flicking up, is a fadeaway. The
      // flick is measured from the bottom of the dip, where the shot starts.
      let low = start;
      for (const s of samples) if (s.y > low.y) low = s;
      const dip = low.y - start.y;
      if (dip > Math.max(36, h * 0.045)) {
        const fx = last.x - low.x, fy = last.y - low.y, flen = Math.hypot(fx, fy);
        return Object.assign(base, { type: 'flick', fade: true, dip: dip / h, angle: Math.atan2(fx, -fy), power: Math.sqrt(speed * 4 * (flen / h)) });
      }
      return Object.assign(base, { type: 'flick', angle: Math.atan2(dx, -dy) });
    }
    if (dy > 0) {
      // straight down steps back; down and to the side is a side-step; flatter is a drive
      const fromDown = Math.atan2(Math.abs(dx), dy) * 180 / Math.PI;
      if (fromDown < 28) return Object.assign(base, { type: 'swipe', dir: 'down' });
      if (fromDown <= 60) return Object.assign(base, { type: 'swipe', dir: dx < 0 ? 'downleft' : 'downright' });
      return Object.assign(base, { type: 'swipe', dir: dx < 0 ? 'left' : 'right' });
    }
    if (Math.abs(dx) >= Math.abs(dy)) return Object.assign(base, { type: 'swipe', dir: dx < 0 ? 'left' : 'right' });
    return Object.assign(base, { type: 'flick', angle: Math.atan2(dx, -dy) });
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
      if (samples.length > 48) samples.splice(1, 1);
      on.move && on.move(p, start);
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

  return { attach, classify };
})();
