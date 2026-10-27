/* Engine 1 · Gesture, batting version
   A copy of the shared recognizer, changed for a swing: touch and hold to
   load, drag slowly to move your barrel, then swipe through to swing.

   The swing is timed from the moment the fast part of the swipe began, not
   from when the finger lifts, so a long follow-through doesn't make you late.
   A swipe that covers a lot of screen is a full swing; a short, quick one is
   the two-strike contact swing. Speeds are in screen-heights per second so
   a swipe means the same thing on any screen. */
const BatGesture = (() => {
  const TAP_PX = 12;
  const V_START = 0.75;     // a finger moving this fast may be starting a swing
  const V_SWING = 1.25;     // averaged over the swipe, this fast is a swing, not a drag
  const D_MIN = 0.045;      // shortest swipe that counts as a swing
  const D_FULL = 0.15;      // a swipe this long is a full swing

  function attach(el, on) {
    let id = null, start = null, samples = null, fastAt = -1, fired = false, moved = false, held = [0, 0];
    const H = () => Math.max(320, window.innerHeight || 800);
    const pt = e => ({ x: e.clientX, y: e.clientY, t: performance.now() });

    function swingFrom(k, kind) {
      const a = samples[k], b = samples[samples.length - 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) / H();
      const dur = Math.max(10, b.t - a.t) / 1000;
      // the swing plane: how steeply up (or down) the swipe travels across
      const plane = Math.atan2(-dy, Math.abs(dx) + 1e-6) * 180 / Math.PI;
      return { type: 'swing', kind, t0: a.t, speed: dist / dur, dist, plane, dx, dy, x: a.x, y: a.y, held: (a.t - start.t) / 1000 };
    }
    function check(final) {
      if (fired || fastAt < 0) return null;
      const a = samples[fastAt], b = samples[samples.length - 1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) / H();
      const avg = dist / (Math.max(10, b.t - a.t) / 1000);
      if (avg < V_SWING) return null;
      if (dist >= D_FULL) return swingFrom(fastAt, 'power');
      if (final && dist >= D_MIN) return swingFrom(fastAt, 'contact');
      return null;
    }
    function down(e) {
      if (id !== null) return;
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (_) {}
      start = pt(e); samples = [start]; fastAt = -1; fired = false; moved = false; held = [0, 0];
      on.down && on.down(start);
      e.preventDefault();
    }
    function move(e) {
      if (e.pointerId !== id) return;
      const p = pt(e), prev = samples[samples.length - 1];
      samples.push(p);
      if (samples.length > 64) { samples.splice(1, 1); if (fastAt > 1) fastAt--; }
      if (fired) return;
      if (Math.hypot(p.x - start.x, p.y - start.y) > TAP_PX) moved = true;
      const v = Math.hypot(p.x - prev.x, p.y - prev.y) / H() / (Math.max(4, p.t - prev.t) / 1000);
      if (v >= V_START) { if (fastAt < 0) fastAt = samples.length - 2; }
      else if (fastAt >= 0) {
        // it was a quick drag, not a swing: let the barrel catch up
        fastAt = -1;
        if (held[0] || held[1]) { on.drag && on.drag(held[0], held[1], p); held = [0, 0]; }
      }
      const s = check(false);
      if (s) { fired = true; on.swing && on.swing(s); return; }
      if (fastAt < 0) on.drag && on.drag(p.x - prev.x, p.y - prev.y, p);
      else { held[0] += p.x - prev.x; held[1] += p.y - prev.y; }
    }
    function up(e) {
      if (e.pointerId !== id) return;
      samples.push(pt(e));
      const s = check(true);
      id = null;
      if (s) { fired = true; on.swing && on.swing(s); }
      const last = samples[samples.length - 1];
      on.up && on.up({ swung: fired, tap: !moved && last.t - start.t < 350, held: (last.t - start.t) / 1000 });
    }
    function cancel(e) { if (e.pointerId === id) { id = null; on.up && on.up({ swung: fired, cancel: true }); } }
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

  return { attach, V_SWING, D_MIN, D_FULL };
})();
