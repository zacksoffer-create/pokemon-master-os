/* Engine 1 again, small: class microgames. Each takes ten to fifteen
   seconds, uses one gesture, and returns a score from 0 to 1.
   Low energy shortens the clock. */
const Micro = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = (a, r) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

  function frame(el, title, help, seconds) {
    el.innerHTML = `<div class="mg"><div class="mg-head"><b>${esc(title)}</b><span>${esc(help)}</span></div>
      <div class="mg-timer"><i></i></div><div class="mg-body"></div><div class="mg-foot"></div></div>`;
    const bar = el.querySelector('.mg-timer i');
    bar.style.transition = 'none'; bar.style.width = '100%';
    return { body: el.querySelector('.mg-body'), foot: el.querySelector('.mg-foot'), bar, seconds };
  }
  function clock(f, onEnd) {
    const t0 = performance.now();
    let dead = false, raf = 0;
    const tick = () => {
      if (dead) return;
      const k = Math.min(1, (performance.now() - t0) / (f.seconds * 1000));
      f.bar.style.width = ((1 - k) * 100) + '%';
      f.bar.classList.toggle('low', k > 0.75);
      if (k >= 1) { dead = true; onEnd(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { dead = true; cancelAnimationFrame(raf); };
  }
  function flash(f, ok) {
    f.body.classList.remove('ok', 'no'); void f.body.offsetWidth; f.body.classList.add(ok ? 'ok' : 'no');
    try { Sfx.play(ok ? 'good' : 'bad'); } catch (_) {}
  }

  // Algebra: solve for x, pick from three
  function algebra(el, o, done) {
    const r = o.rand, f = frame(el, 'Solve for x', 'Tap the right answer. As many as you can.', o.seconds);
    let right = 0, wrong = 0, over = false;
    function next() {
      const x = 1 + Math.floor(r() * (o.hard ? 12 : 9)), a = 2 + Math.floor(r() * (o.hard ? 8 : 5)), b = Math.floor(r() * 15) - 4;
      const c = a * x + b;
      const opts = shuffle([x, x + 1 + Math.floor(r() * 3), Math.max(0, x - 1 - Math.floor(r() * 3))].filter((v, i, s) => s.indexOf(v) === i), r);
      while (opts.length < 3) opts.push(x + opts.length + 2);
      f.body.innerHTML = `<div class="mg-eq">${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}</div><div class="mg-opts">${opts.map(v => `<button type="button" data-v="${v}">x = ${v}</button>`).join('')}</div>`;
      f.body.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
        if (over) return;
        const ok = Number(btn.dataset.v) === x;
        ok ? right++ : wrong++;
        flash(f, ok);
        f.foot.textContent = `${right} right${wrong ? ` · ${wrong} wrong` : ''}`;
        next();
      }));
    }
    next();
    clock(f, () => { over = true; done(Math.max(0, Math.min(1, (right - wrong * 0.5) / 5)), `${right} solved`); });
  }

  // Titration: hold to pour, let go at the line; the liquid keeps moving a little
  function titration(el, o, done) {
    const r = o.rand, f = frame(el, 'Titration', 'Hold to pour. Let go when it reaches the line. It keeps creeping after you let go.', o.seconds);
    f.bar.parentElement.style.visibility = 'hidden';
    const scores = [];
    let round = 0;
    function beaker() {
      const target = 35 + Math.floor(r() * 45);
      let level = 0, vel = 0, holding = false, settled = false, last = performance.now(), released = false;
      f.body.innerHTML = `<div class="mg-beaker"><svg viewBox="0 0 120 160" aria-label="Beaker"><path d="M20 10 V140 Q20 150 30 150 H90 Q100 150 100 140 V10" fill="none" stroke="currentColor" stroke-width="3"/><rect class="liq" x="22" y="148" width="76" height="0" rx="2"/><line class="tgt" x1="12" x2="108" y1="${148 - target * 1.36}" y2="${148 - target * 1.36}" stroke-dasharray="6 4" stroke-width="2.5"/></svg></div><button type="button" class="mg-hold">Hold to pour</button>`;
      f.foot.textContent = `Beaker ${round + 1} of 3`;
      const liq = f.body.querySelector('.liq'), btn = f.body.querySelector('.mg-hold');
      const press = e => { e.preventDefault(); if (released) return; holding = true; btn.classList.add('on'); };
      const lift = () => { if (!holding) return; holding = false; released = true; btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', press); btn.addEventListener('pointerup', lift); btn.addEventListener('pointerleave', lift); btn.addEventListener('pointercancel', lift);
      const t0 = performance.now();
      function step(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (holding) vel = Math.min(34, vel + 70 * dt); else vel = Math.max(0, vel - 55 * dt);
        level = Math.min(100, level + vel * dt);
        liq.setAttribute('y', 148 - level * 1.36); liq.setAttribute('height', level * 1.36);
        const timeout = now - t0 > 7000;
        if ((released && vel <= 0.01) || level >= 100 || timeout) {
          if (settled) return; settled = true;
          const err = Math.abs(level - target);
          const s = Math.max(0, 1 - err / 14);
          scores.push(s);
          flash(f, s > 0.6);
          f.foot.textContent = err < 2 ? 'Perfect.' : err < 6 ? 'Close.' : level > target ? 'Overshot.' : 'Short.';
          setTimeout(() => { round++; round < 3 ? beaker() : done(scores.reduce((a, b) => a + b, 0) / 3, `${Math.round(scores.reduce((a, b) => a + b, 0) / 3 * 100)}% accurate`); }, 700);
          return;
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    beaker();
  }

  // Timeline: tap events oldest to newest
  function timeline(el, o, done) {
    const r = o.rand, f = frame(el, 'Put them in order', 'Tap the oldest first.', o.seconds);
    let right = 0, wrong = 0, over = false, rounds = 0;
    function round() {
      const evs = shuffle(SchoolData.HISTORY, r).slice(0, 4);
      const order = evs.slice().sort((a, b) => a[1] - b[1]);
      let idx = 0;
      f.body.innerHTML = `<div class="mg-list">${evs.map((e, i) => `<button type="button" data-i="${i}">${esc(e[0])}</button>`).join('')}</div>`;
      f.body.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
        if (over || btn.disabled) return;
        const ev = evs[Number(btn.dataset.i)];
        if (ev === order[idx]) {
          right++; idx++; btn.disabled = true; btn.innerHTML = `<b>${ev[1]}</b> ${esc(ev[0])}`; try { Sfx.play('pop'); } catch (_) {}
          if (idx === 4) { rounds++; flash(f, true); setTimeout(() => { if (!over) round(); }, 350); }
        } else { wrong++; flash(f, false); }
        f.foot.textContent = `${right} in order${wrong ? ` · ${wrong} wrong` : ''}`;
      }));
    }
    round();
    clock(f, () => { over = true; done(Math.max(0, Math.min(1, (right - wrong * 0.6) / 8)), `${right} placed`); });
  }

  // Proofread: tap the misspelled word
  function proofread(el, o, done) {
    const r = o.rand, f = frame(el, 'Proofread', 'Tap the misspelled word.', o.seconds);
    let right = 0, wrong = 0, over = false;
    const deck = shuffle(SchoolData.PROOF, r);
    let i = 0;
    function next() {
      const [sent, bad] = deck[i++ % deck.length];
      const words = sent.split(' ');
      f.body.innerHTML = `<p class="mg-sent">${words.map((w, k) => `<button type="button" data-k="${k}">${esc(w)}</button>`).join(' ')}</p>`;
      f.body.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
        if (over) return;
        const w = words[Number(btn.dataset.k)].replace(/[.,!?]/g, '');
        const ok = w === bad;
        ok ? right++ : wrong++;
        flash(f, ok);
        f.foot.textContent = `${right} caught${wrong ? ` · ${wrong} wrong` : ''}`;
        if (ok) next();
      }));
    }
    next();
    clock(f, () => { over = true; done(Math.max(0, Math.min(1, (right - wrong * 0.5) / 4)), `${right} caught`); });
  }

  // Sketch: draw a circle in one stroke
  function sketch(el, o, done) {
    const f = frame(el, 'Draw a circle', 'One stroke. Freehand. Ms. Okafor is grading.', o.seconds);
    f.body.innerHTML = `<canvas class="mg-canvas" width="600" height="600" aria-label="Drawing area"></canvas>`;
    const cv = f.body.querySelector('canvas'), ctx = cv.getContext('2d');
    const pts = []; let drawing = false, finished = false;
    const ink = getComputedStyle(el).getPropertyValue('--ink').trim() || '#1f2a44';
    const toXY = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / b.width * 600, (e.clientY - b.top) / b.height * 600]; };
    cv.addEventListener('pointerdown', e => { if (finished) return; drawing = true; pts.length = 0; ctx.clearRect(0, 0, 600, 600); pts.push(toXY(e)); try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return; const p = toXY(e); const q = pts[pts.length - 1]; pts.push(p);
      ctx.strokeStyle = ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    });
    const end = () => { if (!drawing) return; drawing = false; if (pts.length > 12) finish(); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    function grade() {
      if (pts.length < 12) return 0;
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const rs = pts.map(p => Math.hypot(p[0] - cx, p[1] - cy));
      const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
      const sd = Math.sqrt(rs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / rs.length);
      const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) / Math.max(1, mean);
      let ang = 0;
      for (let i = 1; i < pts.length; i++) { let d = Math.atan2(pts[i][1] - cy, pts[i][0] - cx) - Math.atan2(pts[i - 1][1] - cy, pts[i - 1][0] - cx); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; ang += d; }
      const coverage = Math.min(1, Math.abs(ang) / (2 * Math.PI));
      const size = Math.min(1, mean / 120);
      return Math.max(0, Math.min(1, (1 - (sd / mean) * 3.2) * coverage * (1 - Math.min(0.5, gap * 0.4)) * (0.6 + 0.4 * size)));
    }
    let stop = null;
    function finish() {
      if (finished) return; finished = true; stop && stop();
      const s = grade();
      flash(f, s > 0.6);
      f.foot.textContent = s > 0.85 ? 'Ms. Okafor holds it up for the class.' : s > 0.6 ? 'Solid circle.' : s > 0.3 ? 'It\'s... circular-ish.' : 'That is a potato.';
      setTimeout(() => done(s, `${Math.round(s * 100)}% round`), 800);
    }
    stop = clock(f, finish);
  }

  const GAMES = { algebra, titration, timeline, proofread, sketch };
  function run(id, el, opts, done) {
    const o = Object.assign({ seconds: 12, rand: Math.random }, opts || {});
    (GAMES[id] || algebra)(el, o, (score, label) => done(Math.max(0, Math.min(1, score)), label));
  }
  return { run, GAMES };
})();
