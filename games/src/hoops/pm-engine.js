/* PlaymakerEngine: the passing game. Same court, same figures and the same
   shot model as the scoring game; a high camera so you can see all ten men,
   and one finger: flick to pass to a spot, drag to drive, hold still to slow
   the floor down and read it.

   spec.kind:
     pm         possessions vs a defense:  { count, schemes, shotClock }
     board      a whiteboard puzzle:       { board }
     calibrate  "throw it to the corner": sets how far a swipe throws */
const PlaymakerEngine = (() => {
  const { V, RIM } = Court3D;
  /* How much the game helps your passes. Casual: flick toward a man and it
     finds him, leading him, and picks the pass that gets through traffic.
     Normal: a smaller cone, and your flick picks the pass. Pro: you throw it
     to a spot, and the spot is on you. */
  const FEEL = {
    casual: { window: 2.4, assist: { tol: 30, distW: 22, auto: true } },
    normal: { window: 1.9, assist: { tol: 16, distW: 16, auto: false } },
    pro: { window: 1.2, assist: null }
  };
  const feelOf = k => FEEL[k] || FEEL.casual;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
.pmx{position:absolute;inset:0;overflow:hidden;background:#0b0f18;color:#f3f1ea;font-family:"Barlow",system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.pmx canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.pmx-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 22px max(14px,env(safe-area-inset-left,0px));pointer-events:none;background:linear-gradient(rgba(6,8,12,.7),rgba(6,8,12,0))}
.pmx-quit{pointer-events:auto;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,14,22,.55);color:#f3f1ea;font:600 18px/1 "Barlow",sans-serif;cursor:pointer}
.pmx-quit:focus-visible,.pmx-btn:focus-visible,.pmx-chipbtn:focus-visible{outline:2px solid #ffb547;outline-offset:2px}
.pmx-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.pmx-title b{font:800 20px/1 "Big Shoulders Display",Impact,"Arial Narrow",sans-serif;letter-spacing:.04em;text-transform:uppercase}
.pmx-title span{font:500 13px/1.25 "Barlow",sans-serif;opacity:.82}
.pmx-score{text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.pmx-score-n{display:block;font:800 40px/0.95 "Big Shoulders Display",Impact,sans-serif;font-variant-numeric:tabular-nums}
.pmx-score small{font:600 11px/1.2 "Barlow",sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.pmx-clock{position:absolute;left:50%;top:calc(58px + env(safe-area-inset-top,0px));transform:translateX(-50%);min-width:64px;padding:2px 12px;border-radius:8px;background:rgba(8,10,14,.72);border:1px solid rgba(255,181,71,.35);font:800 30px/1.1 "Big Shoulders Display",Impact,sans-serif;color:#ffb547;text-align:center;font-variant-numeric:tabular-nums;pointer-events:none}
.pmx-clock.low{color:#ff5d4a;border-color:rgba(255,93,74,.6)}
.pmx-chips{position:absolute;left:0;right:0;top:calc(104px + env(safe-area-inset-top,0px));display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:0 14px;pointer-events:none}
.pmx-chip{padding:5px 10px;border-radius:999px;font:600 12px/1.1 "Barlow",sans-serif;letter-spacing:.03em;background:rgba(8,10,14,.72);border:1px solid rgba(255,255,255,.18)}
.pmx-chip b{font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.pmx-chip.def{color:#ffcfb8;border-color:rgba(255,154,102,.5)}
.pmx-banner{position:absolute;left:0;right:0;top:34%;text-align:center;pointer-events:none;padding:0 18px}
.pmx-banner .k{display:block;font:600 13px/1.2 "Barlow",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffb547;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.pmx-banner .h{display:block;font:800 clamp(30px,9vw,52px)/0.95 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.75);text-wrap:balance}
.pmx-banner .s{display:block;margin:6px auto 0;max-width:30ch;font:500 15px/1.3 "Barlow",sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.9);opacity:.94}
.pmx-banner.pop{animation:pmxpop .35s ease-out}
@keyframes pmxpop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
.pmx-hint{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);padding:7px 12px;border-radius:10px;background:rgba(8,10,14,.72);font:500 13px/1.35 "Barlow",sans-serif;text-align:center;pointer-events:none;color:#e8e4da}
.pmx-vision{position:absolute;left:max(14px,env(safe-area-inset-left,0px));bottom:calc(62px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:7px;padding:5px 9px;border-radius:9px;background:rgba(8,10,14,.62);font:700 10px/1 "Barlow",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#cfe3ff;pointer-events:none}
.pmx-vision i{display:block;width:56px;height:5px;border-radius:3px;background:rgba(255,255,255,.16);overflow:hidden}
.pmx-vision i b{display:block;height:100%;background:#8fb4ff;border-radius:3px}
.pmx-card{position:absolute;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:14px 16px 12px;border-radius:14px;background:rgba(14,18,27,.95);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.5);animation:pmxup .25s ease-out}
@keyframes pmxup{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.pmx-card .k{font:600 11px/1.2 "Barlow",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#ffb547}
.pmx-card .w{margin-top:5px;font:600 16px/1.35 "Barlow",sans-serif}
.pmx-card .r{display:flex;gap:10px;align-items:flex-start;margin-top:9px;font:400 14px/1.4 "Barlow",sans-serif;color:#cfd3dc}
.pmx-grade{flex:none;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;font:800 22px/1 "Big Shoulders Display",Impact,sans-serif;color:#0b0f18;background:#7ee2a8}
.pmx-grade.B{background:#c5e27e}.pmx-grade.C{background:#ffd166}.pmx-grade.D{background:#ff9a66}.pmx-grade.F{background:#ff5d4a}
.pmx-card .row{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap}
.pmx-btn{pointer-events:auto;cursor:pointer;border:0;border-radius:10px;padding:10px 18px;background:#ffb547;color:#1a1206;font:800 15px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.pmx-btn.ghost{background:transparent;color:#f3f1ea;border:1px solid rgba(255,255,255,.3)}
.pmx-btn[disabled]{opacity:.4;cursor:default}
.pmx-board{position:absolute;left:0;right:0;bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 14px;pointer-events:none}
.pmx-board .t{max-width:34ch;text-align:center;font:500 14px/1.35 "Barlow",sans-serif;color:#2a2f3a}
.pmx-board .row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.pmx-chipbtn{pointer-events:auto;cursor:pointer;padding:8px 13px;border-radius:999px;border:1.5px solid #2f4b78;background:#fff;color:#2f4b78;font:700 14px/1 "Barlow",sans-serif}
.pmx-chipbtn[aria-pressed="true"]{background:#2f4b78;color:#fff}
.pmx-board .pmx-btn.ghost{color:#2f4b78;border-color:#2f4b78}
`;
    document.head.appendChild(st);
  }

  function create(container, opts) {
    injectCss();
    const settings = Object.assign({ feel: 'normal', pmFeel: 'casual', passK: null, passL0: null, passDur: null, hints: true, jersey: '#2c5a46', shorts: '#234a39', court: 'park' }, opts || {});
    const root = document.createElement('div');
    root.className = 'pmx';
    root.innerHTML = `
      <canvas></canvas>
      <div class="pmx-top"><button class="pmx-quit" type="button" aria-label="Leave this game">&#x2715;</button><div class="pmx-title"><b></b><span></span></div><div class="pmx-score"><span class="pmx-score-n"></span><small></small></div></div>
      <div class="pmx-clock" hidden></div>
      <div class="pmx-chips"><div class="pmx-chip def" hidden></div></div>
      <div class="pmx-banner" hidden></div>
      <div class="pmx-vision" hidden>Court vision<i><b></b></i></div>
      <div class="pmx-hint" hidden></div>
      <div class="pmx-board" hidden></div>
      <div class="pmx-card" hidden></div>`;
    container.appendChild(root);
    const $ = s => root.querySelector(s);
    const canvas = $('canvas'), ctx = canvas.getContext('2d');
    const ui = {
      title: $('.pmx-title b'), sub: $('.pmx-title span'), score: $('.pmx-score-n'), scoreSub: $('.pmx-score small'),
      clock: $('.pmx-clock'), def: $('.pmx-chip.def'), banner: $('.pmx-banner'), vision: $('.pmx-vision'), visionBar: $('.pmx-vision b'),
      hint: $('.pmx-hint'), board: $('.pmx-board'), card: $('.pmx-card'), quit: $('.pmx-quit')
    };
    let CW = 360, CH = 640, DPR = 1;
    function resize() {
      const r = root.getBoundingClientRect();
      CW = Math.max(200, r.width); CH = Math.max(300, r.height);
      DPR = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(root); else window.addEventListener('resize', resize);
    resize();

    const S = {
      spec: null, w: null, running: false, raf: 0, last: 0, t: 0, scale: 1, rand: Math.random, court: Court3D.COURTS.park,
      phase: 'idle', i: 0, score: 0, assists: 0, tos: 0, log: [], popups: [], focus: null, vision: { left: 1.2, on: false, k: 0 },
      board: null, plan: { cut: null, pass: null, type: 'chest' }, draw: null, calib: [], hints: {}, cardNext: null, onEnd: null, onQuit: null,
      lastScheme: null, endTimer: null, trail: []
    };

    // ---------- helpers ----------
    function banner(k, h, s, dur) {
      ui.banner.innerHTML = (k ? `<span class="k">${esc(k)}</span>` : '') + `<span class="h">${esc(h)}</span>` + (s ? `<span class="s">${esc(s)}</span>` : '');
      ui.banner.hidden = false;
      ui.banner.classList.remove('pop'); void ui.banner.offsetWidth; ui.banner.classList.add('pop');
      clearTimeout(banner._t);
      if (dur) banner._t = setTimeout(() => { ui.banner.hidden = true; }, dur * 1000);
    }
    function hint(text) { ui.hint.textContent = text || ''; ui.hint.hidden = !text; }
    function hintOnce(key, text) { if (!settings.hints || S.hints[key]) return; S.hints[key] = true; hint(text); }
    function setTitle(a, b) { ui.title.textContent = a || ''; ui.sub.textContent = b || ''; }
    function setScore(n, sub) { ui.score.textContent = n; ui.scoreSub.textContent = sub || ''; }
    function popup(text, color, at, size) { S.popups.push({ text, color: color || '#fff', world: at, size: size || 1, t: 0, life: 1.3 }); }
    function passK() { return settings.passK || 80; }
    function passDur() { return settings.passDur || (settings.passL0 || 0.35) / (settings.passSpd || 1.9); }

    // ---------- camera ----------
    /* High and behind the ball, looking down toward the paint: wide enough
       for the whole half court on a phone held upright. It eases in and out
       with the ball but doesn't slide sideways, so both corners stay on
       screen (ex/lx put the slide back, for tuning). */
    function camera() {
      const f = S.focus || [0, 0, 24];
      const T = Object.assign({ h: 42, ez: 46, lz: 4, hfov: 51, ex: 0, lx: 0, ezk: 0.1, lzk: 0.06, top: 0.255 }, settings.camTune || {});
      const fx = clamp(f[0], -18, 18), fz = clamp(f[2], 4, 32);
      const eye = [fx * T.ex, T.h, T.ez + (fz - 26) * T.ezk];
      const look = [fx * T.lx, 0, T.lz + (fz - 26) * T.lzk];
      const fwd = V.norm(V.sub(look, eye));
      let fovY = 2 * Math.atan(Math.tan(T.hfov / 2 * Math.PI / 180) / (CW / CH));
      fovY = Math.min(fovY, 150 * Math.PI / 180);
      const cam = Court3D.camera(eye, fwd, CW, CH, fovY);
      // frame it high: the baseline sits under the chips, the floor below the play is where your finger goes
      const ref = Court3D.project(cam, [0, 0, 0]);
      if (ref) cam.cy += (Math.max(150, CH * T.top) + 20) - ref.y;
      return cam;
    }
    function floorPoint(cam, sx, sy, y0) {
      const dx = (sx - cam.cx) / cam.focal, dy = (cam.cy - sy) / cam.focal;
      const d = [cam.f[0] + cam.r[0] * dx + cam.u[0] * dy, cam.f[1] + cam.r[1] * dx + cam.u[1] * dy, cam.f[2] + cam.r[2] * dx + cam.u[2] * dy];
      if (d[1] >= -1e-4) return null;
      const t = ((y0 || 0) - cam.eye[1]) / d[1];
      return [cam.eye[0] + d[0] * t, y0 || 0, cam.eye[2] + d[2] * t];
    }
    // a direction on screen, from the ball, as a direction on the floor
    function courtDir(cam, from, dx, dy) {
      const p0 = Court3D.project(cam, [from[0], 0, from[2]]);
      const l = Math.hypot(dx, dy) || 1;
      if (!p0) return null;
      const p1 = floorPoint(cam, p0.x + dx / l * 40, p0.y + dy / l * 40, 0);
      if (!p1) return null;
      const v = [p1[0] - from[0], 0, p1[2] - from[2]], vl = Math.hypot(v[0], v[2]) || 1;
      return [v[0] / vl, 0, v[2] / vl];
    }

    // ---------- input ----------
    /* One finger. A quick stroke is a pass. Hold and drag moves him, steered
       like a joystick from where you touched: a soft or sideways drag is a
       dribble around, a hard one at the rim is an attack. A burst at the end
       of a drag is a pass on the move. Holding still slows the floor down. A
       flick while the ball is in the air is the next pass, thrown on the catch. */
    const IN = { id: null, start: null, pts: [], mode: null, moveStart: null, burst: null, jab: null, stillAt: 0 };
    const FLICK_SPEED = 1.35;      // screen heights per second
    function speedOver(ms) {
      const pts = IN.pts, last = pts[pts.length - 1];
      let k = pts.length - 1;
      while (k > 0 && last.t - pts[k - 1].t <= ms) k--;
      const ref = k === pts.length - 1 ? (pts[k - 1] || last) : pts[k];
      const dt = Math.max(8, last.t - ref.t) / 1000;
      return { v: Math.hypot(last.x - ref.x, last.y - ref.y) / CH / dt, i: k };
    }
    canvas.addEventListener('pointerdown', e => {
      if (IN.id !== null || !S.running) return;
      Sfx.unlock();
      IN.id = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const p = { x: e.clientX, y: e.clientY, t: performance.now() };
      Object.assign(IN, { start: p, pts: [p], mode: 'pending', moveStart: null, burst: null, jab: null, jabUntil: 0, stillAt: p.t });
      if (S.phase === 'board') boardDown(p);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== IN.id) return;
      const p = { x: e.clientX, y: e.clientY, t: performance.now() };
      const prev = IN.pts[IN.pts.length - 1];
      IN.pts.push(p);
      if (IN.pts.length > 90) IN.pts.splice(1, 1);
      if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2.5) IN.stillAt = p.t;
      if (S.phase === 'board') return boardMove(p);
      const d = Math.hypot(p.x - IN.start.x, p.y - IN.start.y);
      if (IN.mode === 'pending' || IN.mode === 'vision') {
        if (d > 9 && !IN.moveStart) {
          // after holding still the last sample is old: the stroke starts now,
          // not when the finger came down
          if (p.t - prev.t > 60) { IN.moveStart = { x: prev.x, y: prev.y, t: p.t - 16 }; IN.pts.splice(IN.pts.length - 1, 0, IN.moveStart); }
          else IN.moveStart = prev;
        }
        // a push that keeps going is a drive (a quick stroke let go is still a pass)
        if (IN.moveStart && p.t - IN.moveStart.t > 150 && speedOver(70).v < FLICK_SPEED && d > 16) { IN.mode = 'drag'; IN.jab = jabOf(); }
      } else if (IN.mode === 'drag') {
        const sp = speedOver(60);
        if (sp.v > FLICK_SPEED * 1.15) { if (!IN.burst) IN.burst = IN.pts[Math.max(0, sp.i - 1)]; }
        else if (IN.burst && p.t - IN.burst.t > 320) IN.burst = null;
      }
    });
    function endPointer(e, cancel) {
      if (e.pointerId !== IN.id) return;
      const p = { x: e.clientX, y: e.clientY, t: performance.now() };
      IN.pts.push(p);
      IN.id = null;
      const mode = IN.mode;
      IN.mode = null;
      if (cancel) return;
      if (S.phase === 'board') return boardUp(p);
      if (!S.w || S.phase !== 'live') return;
      const d = Math.hypot(p.x - IN.start.x, p.y - IN.start.y);
      if (mode === 'blocked') return;
      if (mode === 'drag') {
        // short and straight and let go: that was a soft pass, not a drive
        const k0 = IN.moveStart ? Math.max(0, IN.pts.indexOf(IN.moveStart)) : 0;
        if (IN.moveStart && p.t - IN.moveStart.t < 340 && d >= 22 && straight(k0)) return throwFrom(k0);
        if (IN.burst && p.t - IN.burst.t < 280) {
          // pulled back and let it go: that was a bounce pass, not a drive and a pass
          const st = IN.moveStart && p.t - IN.moveStart.t < 480 ? readStroke(k0) : null;
          return throwFrom(st && st.dip ? k0 : IN.pts.indexOf(IN.burst));
        }
        return;
      }
      if (d < 12 && p.t - IN.start.t < 320 && mode !== 'vision') return passFake();
      if (mode === 'blocked') return;
      if (d >= 22) {
        // in vision mode, the throw starts where the finger started moving
        const k = IN.moveStart ? Math.max(0, IN.pts.indexOf(IN.moveStart)) : 0;
        return throwFrom(k);
      }
    }
    canvas.addEventListener('pointerup', e => endPointer(e, false));
    canvas.addEventListener('pointercancel', e => endPointer(e, true));
    canvas.style.touchAction = 'none';

    // a stroke that mostly went one way (a joystick hold wanders)
    function straight(k0) {
      const pts = IN.pts.slice(k0), a = pts[0], z = pts[pts.length - 1];
      const L = Math.hypot(z.x - a.x, z.y - a.y);
      let path = 0;
      for (let i = 1; i < pts.length; i++) path += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      return path < L * 1.35 + 12;
    }
    /* Read the stroke from sample k0 to the end: where it points, how long it
       is, how fast it was let go, whether it dipped back first (bounce pass)
       and whether it bowed (bend). */
    function readStroke(k0) {
      const pts = IN.pts.slice(Math.max(0, k0));
      if (pts.length < 2) return null;
      const a = pts[0], z = pts[pts.length - 1];
      let ux = z.x - a.x, uy = z.y - a.y;
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul; uy /= ul;
      // a dip: the finger pulled back the other way before it threw
      let dipPt = a, dip = 0;
      pts.forEach(q => { const pr = (q.x - a.x) * ux + (q.y - a.y) * uy; if (-pr > dip) { dip = -pr; dipPt = q; } });
      const from = dip > Math.max(26, CH * 0.03) ? dipPt : a;
      const vx = z.x - from.x, vy = z.y - from.y, len = Math.hypot(vx, vy);
      // release speed over the last ~90ms
      let k = pts.length - 1;
      while (k > 0 && z.t - pts[k - 1].t <= 90) k--;
      const ref = k === pts.length - 1 ? pts[Math.max(0, k - 1)] : pts[k];
      const rel = Math.hypot(z.x - ref.x, z.y - ref.y) / CH / (Math.max(8, z.t - ref.t) / 1000);
      const avg = len / CH / (Math.max(16, z.t - from.t) / 1000);
      const speed = Math.max(rel, avg * 0.85);
      let bow = 0;
      const fromI = pts.indexOf(from);
      pts.slice(Math.max(0, fromI)).forEach(q => { const dev = (vx * (q.y - from.y) - vy * (q.x - from.x)) / (len || 1); if (Math.abs(dev) > Math.abs(bow)) bow = dev; });
      return { dx: vx, dy: vy, len: len / CH, speed, dur: Math.max(16, z.t - from.t), dip: dip > Math.max(26, CH * 0.03), curl: bow / (len || 1) };
    }
    /* How long the flick took against how long your natural pass of that
       length takes (from calibration): a snap is a bullet, a dip first is a
       bounce pass, anything else is a chest pass. */
    function passType(st) {
      if (st.dip) return 'bounce';
      const L0 = settings.passL0 || 0.35;
      const expect = passDur() * 1000 * Math.pow(Math.max(0.05, st.len) / L0, 0.4);
      return st.dur / expect <= 0.66 ? 'bullet' : 'chest';
    }
    function throwFrom(k0) {
      const w = S.w;
      if (!w || w.over) return;
      const st = readStroke(k0);
      if (!st || st.len * CH < 18) return;
      // the ball's still in the air: that's the next pass, thrown on the catch
      if (w.ball.state === 'pass' && S.spec.kind === 'pm') { S.queued = { st, t: performance.now() }; return; }
      throwStroke(st);
    }
    function throwStroke(st) {
      const w = S.w;
      if (!w || w.ball.state !== 'held' || w.over) return;
      const cam = camera();
      const H = w.off[w.handler];
      const dir = courtDir(cam, H.pos, st.dx, st.dy);
      if (!dir) return;
      const type = passType(st);
      const dist = clamp(st.len * passK(), 4, 47);
      const bend = Math.abs(st.curl) > 0.1 ? clamp(st.curl * dist * 0.45, -5, 5) : 0;
      if (S.spec.kind === 'calibrate') S.calib.push({ len: st.len, speed: st.speed, dur: st.dur / 1000 });
      PMSim.driveInput(w, null);
      const fl = feelOf(settings.pmFeel);
      const assist = S.spec.kind === 'pm' ? fl.assist : null;
      const P = PMSim.pass(w, { dir, dist, type, bend: -bend, assist, forced: st.dip });
      if (P) {
        S.lastStroke = { type, dist, speed: st.speed, len: st.len };
        Sfx.play('release');
        hint('');
      }
    }
    function passFake() {
      const w = S.w;
      if (!w || w.ball.state !== 'held') return;
      const bit = PMSim.fake(w);
      Sfx.play(bit ? 'good' : 'dribble');
    }
    // a jab one way and back before the push read as a drive: he still bit on it
    function jabOf() {
      const last = IN.pts[IN.pts.length - 1];
      const first = IN.pts.find(q => Math.hypot(q.x - IN.start.x, q.y - IN.start.y) >= 18);
      if (!first || first === last) return null;
      const v1 = [first.x - IN.start.x, first.y - IN.start.y], v2 = [last.x - IN.start.x, last.y - IN.start.y];
      const c = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(v1[0], v1[1]) * (Math.hypot(v2[0], v2[1]) || 1));
      return c < 0.5 ? v1 : null;
    }
    // how hard the drag is: a little push is a dribble, a long one is all he's got
    function dragMag() {
      if (IN.mode !== 'drag' || !IN.pts.length) return 0;
      const last = IN.pts[IN.pts.length - 1];
      return clamp((Math.hypot(last.x - IN.start.x, last.y - IN.start.y) - 18) / (CH * 0.085), 0.15, 1);
    }
    // the drag, as a drive direction on the floor (or null)
    function dragDir(cam) {
      if (IN.mode !== 'drag' || !S.w) return null;
      // play the jab out for a beat so he has something to bite on
      if (IN.jab) {
        if (!IN.jabUntil) IN.jabUntil = performance.now() + 150;
        if (performance.now() < IN.jabUntil) return courtDir(cam, S.w.off[S.w.handler].pos, IN.jab[0], IN.jab[1]);
        IN.jab = null;
      }
      const last = IN.pts[IN.pts.length - 1];
      const dx = last.x - IN.start.x, dy = last.y - IN.start.y;
      if (Math.hypot(dx, dy) < 18) return null;
      return courtDir(cam, S.w.off[S.w.handler].pos, dx, dy);
    }

    ui.quit.addEventListener('click', () => { Sfx.play('ui'); const q = S.onQuit; stop(); q && q(summary(true)); });
    ui.card.addEventListener('click', e => { const b = e.target.closest('button'); if (b && S.cardNext) { const f = S.cardNext; S.cardNext = null; f(b.dataset.act); } });

    // ---------- sessions ----------
    function run(spec, handlers) {
      stop(true);
      S.spec = Object.assign({}, spec);
      S.court = Court3D.COURTS[spec.court] || Court3D.COURTS[settings.court] || Court3D.COURTS.park;
      S.onEnd = handlers && handlers.onEnd; S.onQuit = handlers && handlers.onQuit;
      S.rand = spec.seed != null ? mulberry(spec.seed) : Math.random;
      Object.assign(S, { t: 0, i: 0, score: 0, assists: 0, tos: 0, log: [], popups: [], w: null, phase: 'idle', board: null, calib: [], cardNext: null, lastScheme: null, endTimer: null, ended: false, trail: [] });
      S.vision = { left: 1.2, on: false, k: 0 };
      ['clock', 'def', 'banner', 'vision', 'hint', 'board', 'card'].forEach(k => { ui[k].hidden = true; });
      S.running = true;
      S.last = performance.now();
      S.raf = requestAnimationFrame(frame);
      if (spec.kind === 'board') startBoard(PMPlays.BOARDS.find(b => b.id === spec.board) || PMPlays.BOARDS[0]);
      else if (spec.kind === 'calibrate') startCalibration();
      else startPossession(0);
    }
    function newWorld(o) {
      return PMSim.create(Object.assign({ court: S.court, rand: S.rand, window: feelOf(settings.pmFeel).window }, o));
    }
    function pickScheme() {
      const list = S.spec.schemes && S.spec.schemes.length ? S.spec.schemes : PMPlays.SCHEME_IDS;
      const plan = S.spec.plan && S.spec.plan[S.i];
      if (plan && plan.scheme) return plan.scheme;
      const pool = list.filter(x => x !== S.lastScheme);
      const from = pool.length ? pool : list;
      return from[Math.floor(S.rand() * from.length)];
    }
    function startPossession(i) {
      const spec = S.spec;
      const count = spec.count || 8;
      if (i >= count) return endSession();
      S.i = i;
      const sid = pickScheme();
      S.lastScheme = sid;
      const plan = spec.plan && spec.plan[i];
      const mirror = plan && plan.mirror != null ? plan.mirror : S.rand() < 0.5;
      S.w = newWorld({ scheme: sid, mirror, clock: spec.shotClock || 13 });
      S.focus = S.w.off[S.w.handler].pos.slice();
      S.vision = { left: 1.2, on: false, k: 0 };
      S.endTimer = null; S.trail = []; S.queued = null;
      const sc = S.w.scheme;
      setTitle(spec.title || 'Playmaker', `Possession ${i + 1} of ${count}`);
      updateScore();
      ui.def.innerHTML = `Defense: <b>${esc(sc.name)}</b>`; ui.def.hidden = false;
      ui.clock.hidden = true;
      S.phase = 'intro';
      banner(`Possession ${i + 1}`, sc.name, sc.tell, 1.7);
      setTimeout(() => {
        if (!S.running || S.w === null || S.phase !== 'intro') return;
        S.phase = 'live';
        ui.clock.hidden = false;
        ui.vision.hidden = false;
        if (i === 0) hintOnce('pm1', 'Flick toward a spot to pass · Drag to drive · Hold your finger still to slow it down and read the floor');
        else if (i === 1) hintOnce('pm2', 'A soft or sideways drag dribbles him around · Push hard at the rim, or snap it back the other way, to attack');
        else if (i === 2) hintOnce('pm3', 'Flick again while the ball is in the air and he swings it on the catch · Tap: pass fake');
      }, 1550);
    }
    function updateScore() {
      if (S.spec.kind === 'pm') setScore(S.score, `pts · ${S.assists} ast`);
      else setScore('', '');
    }
    function finishPossession() {
      const w = S.w, R = w.result;
      if (!R || S.phase === 'card') return;
      S.phase = 'card';
      S.score += R.points || 0;
      if (R.assist != null) S.assists++;
      if (R.turnover) S.tos++;
      updateScore();
      const narr = PMSim.narrate(w), les = PMSim.lesson(w);
      S.log.push({ scheme: w.scheme.id, grade: R.grade, points: R.points || 0, assist: R.assist != null, turnover: R.turnover || null, tags: R.tags || [], made: !!R.made, contest: R.contest, text: narr });
      ui.clock.hidden = true; ui.vision.hidden = true; hint('');
      const last = S.i + 1 >= (S.spec.count || 8);
      ui.card.innerHTML = `<div class="k">Possession ${S.i + 1} · ${esc(w.scheme.name)}</div><div class="w">${esc(narr)}</div>
        <div class="r"><span class="pmx-grade ${R.grade}">${R.grade}</span><span>${esc(les)}</span></div>
        <div class="row"><button class="pmx-btn" type="button">${last ? 'See results' : 'Next possession'}</button></div>`;
      ui.card.hidden = false;
      if (R.grade === 'A') Sfx.play('great'); else if (R.grade === 'B') Sfx.play('good');
      S.cardNext = () => { ui.card.hidden = true; startPossession(S.i + 1); };
    }

    // ---------- calibration ----------
    function startCalibration() {
      const corner = side => { const p = Court3D.spotInfo(S.court, side < 0 ? 'lc' : 'rc').pos; return [p[0], p[2], 'shooter']; };
      const top = Court3D.spotInfo(S.court, 'top').pos;
      const board = { id: 'calib', off: [[0, top[2] + 2, 'guard'], corner(-1), corner(1)], def: [], holder: 0, scheme: 'packline', clock: 99 };
      S.calibBoard = board;
      S.calibStep = 0;
      calibThrow();
    }
    function calibThrow() {
      const step = S.calibStep;
      S.w = newWorld({ board: S.calibBoard });
      S.w.noShots = true;
      S.focus = [0, 0, 22];
      setTitle('Find your pass', `Throw ${step + 1} of 2`);
      setScore('', '');
      S.phase = 'live';
      if (step === 0) banner('Find your pass', 'Throw it to the corner', 'Flick toward the left corner the way a crisp pass feels. This sets how far a swipe throws.', 2.6);
      hint(step === 0 ? 'Flick toward the left corner' : 'Now the right corner');
    }

    // ---------- Draw It Up ----------
    function startBoard(b) {
      S.board = b;
      S.plan = { cut: null, pass: null, type: S.plan && S.plan.type || 'chest' };
      showBoard();
    }
    function showBoard() {
      const b = S.board;
      S.phase = 'board'; S.w = null;
      ui.clock.hidden = true; ui.def.hidden = true; ui.vision.hidden = true; ui.card.hidden = true; hint('');
      setTitle('Draw It Up', b.name);
      setScore('', '');
      renderBoardUi();
      if (!S.hints.board && settings.hints) { S.hints.board = true; }
    }
    function renderBoardUi() {
      const b = S.board, P = S.plan;
      ui.board.innerHTML = `<div class="t"><b>${esc(b.situation)}.</b> ${esc(b.text)} ${P.pass ? '' : 'Drag from a teammate to draw his cut, then from the ball to draw the pass.'}</div>
        <div class="row">${[['chest', 'Chest'], ['bounce', 'Bounce'], ['lob', 'Lob']].map(([v, l]) => `<button class="pmx-chipbtn" type="button" data-type="${v}" aria-pressed="${P.type === v}">${l}</button>`).join('')}</div>
        <div class="row"><button class="pmx-btn ghost" type="button" data-act="clear">Clear</button><button class="pmx-btn" type="button" data-act="run" ${P.pass ? '' : 'disabled'}>Run it</button></div>`;
      ui.board.hidden = false;
    }
    ui.board.addEventListener('click', e => {
      const t = e.target.closest('[data-type]');
      if (t) { S.plan.type = t.dataset.type; Sfx.play('ui'); return renderBoardUi(); }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      Sfx.play('ui');
      if (a.dataset.act === 'clear') { S.plan.cut = null; S.plan.pass = null; return renderBoardUi(); }
      if (a.dataset.act === 'run' && S.plan.pass) runBoard();
    });
    function boardGeom() {
      const s = Math.min((CW - 28) / 50, (CH * 0.6) / 34);
      // centered between the title and the panel at the bottom
      const top = Math.max(108, (108 + CH - 170 - 34 * s) / 2);
      return { s, cx: CW / 2, top };
    }
    const bxy = (G, x, z) => ({ x: G.cx + x * G.s, y: G.top + z * G.s });
    const bcourt = (G, p) => [(p.x - G.cx) / G.s, (p.y - G.top) / G.s];
    function boardDown(p) {
      const b = S.board, G = boardGeom();
      let best = null;
      b.off.forEach((o, i) => { const q = bxy(G, o[0], o[1]); const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 30 && (!best || d < best.d)) best = { i, d }; });
      if (!best) { S.draw = null; return; }
      S.draw = { i: best.i, pass: best.i === b.holder, pts: [bcourt(G, p)] };
    }
    function boardMove(p) {
      if (!S.draw) return;
      const G = boardGeom(), c = bcourt(G, p);
      const last = S.draw.pts[S.draw.pts.length - 1];
      if (Math.hypot(c[0] - last[0], c[1] - last[1]) * G.s > 7) S.draw.pts.push([clamp(c[0], -24.5, 24.5), clamp(c[1], 0.5, 33)]);
    }
    function boardUp() {
      const D = S.draw; S.draw = null;
      if (!D || D.pts.length < 2) return;
      const b = S.board;
      if (D.pass) S.plan.pass = { to: D.pts[D.pts.length - 1], type: S.plan.type };
      else S.plan.cut = { j: D.i, pts: [[b.off[D.i][0], b.off[D.i][1]]].concat(simplify(D.pts.slice(1))) };
      Sfx.play('pop');
      renderBoardUi();
    }
    function simplify(pts) {
      const out = [];
      pts.forEach(p => { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 2.4) out.push(p); });
      const last = pts[pts.length - 1];
      if (out[out.length - 1] !== last) out.push(last);
      return out;
    }
    function runBoard() {
      const b = S.board;
      ui.board.hidden = true;
      S.w = newWorld({ board: b });
      S.w.board = b;
      S.focus = S.w.off[S.w.handler].pos.slice();
      S.endTimer = null; S.trail = [];
      S.phase = 'live';
      ui.clock.hidden = false;
      S.plan.pass.type = S.plan.type;
      PMSim.runBoard(S.w, { cut: S.plan.cut, pass: S.plan.pass });
      setTitle('Draw It Up', b.name);
    }
    function finishBoard() {
      const w = S.w, R = w.result, b = S.board;
      if (!R || S.phase === 'card') return;
      S.phase = 'card';
      const narr = PMSim.narrate(w);
      S.log = [{ board: b.id, grade: R.grade, points: R.points || 0, text: narr }];
      ui.clock.hidden = true;
      const good = R.grade === 'A' || R.grade === 'B';
      ui.card.innerHTML = `<div class="k">Draw It Up · ${esc(b.name)}</div><div class="w">${esc(narr)}</div>
        <div class="r"><span class="pmx-grade ${R.grade}">${R.grade}</span><span>${esc(good ? 'That works. ' + b.answer : b.answer)}</span></div>
        <div class="row"><button class="pmx-btn ghost" type="button" data-act="again">Draw it again</button><button class="pmx-btn" type="button" data-act="done">Done</button></div>`;
      ui.card.hidden = false;
      if (R.grade === 'A') Sfx.play('great'); else if (R.grade === 'B') Sfx.play('good');
      S.cardNext = act => { ui.card.hidden = true; if (act === 'again') showBoard(); else endSession(); };
    }

    function summary(quit) {
      const k = S.spec ? S.spec.kind : null;
      const out = { kind: k, quit: !!quit, points: S.score, assists: S.assists, turnovers: S.tos, log: S.log };
      if (k === 'pm' && S.log.length) {
        const gp = { A: 4, B: 3, C: 2, D: 1, F: 0 };
        out.readIQ = Math.round(S.log.reduce((s, l) => s + gp[l.grade], 0) / S.log.length * 25);
      }
      if (k === 'board' && S.board) { out.board = S.board.id; out.grade = S.log.length ? S.log[0].grade : null; }
      if (k === 'calibrate' && S.calib.length >= 2) {
        const corner = Math.hypot(S.calibBoard.off[1][0] - S.calibBoard.off[0][0], S.calibBoard.off[1][1] - S.calibBoard.off[0][1]);
        const lens = S.calib.map(c => c.len).sort((a, b) => a - b), durs = S.calib.map(c => c.dur);
        const L0 = lens[Math.floor(lens.length / 2)];
        out.passK = clamp(corner / L0, 35, 220);
        out.passL0 = clamp(L0, 0.08, 0.9);
        out.passDur = clamp(durs.reduce((a, b) => a + b, 0) / durs.length, 0.06, 0.6);
      }
      return out;
    }
    function endSession() {
      if (S.ended) return;
      S.ended = true;
      const res = summary(false), f = S.onEnd;
      stop();
      f && f(res);
    }
    function stop() {
      S.running = false;
      cancelAnimationFrame(S.raf);
      clearTimeout(banner._t);
      ui.banner.hidden = true;
      IN.id = null; IN.mode = null;
    }
    function destroy() { stop(); if (ro) ro.disconnect(); root.remove(); }

    // ---------- update ----------
    function frame(now) {
      if (!S.running) return;
      const rdt = Math.min(0.05, Math.max(0, (now - S.last) / 1000));
      S.last = now;
      visionTick(rdt);
      update(rdt * S.scale, rdt);
      if (S.running) render();
      if (S.running) S.raf = requestAnimationFrame(frame);
    }
    function visionTick(rdt) {
      const V0 = S.vision;
      const held = IN.id !== null && (IN.mode === 'vision' || (IN.mode === 'pending' && performance.now() - IN.stillAt > 170));
      const can = S.phase === 'live' && S.w && S.w.ball.state === 'held' && !S.w.over && V0.left > 0 && S.spec.kind === 'pm';
      V0.on = held && can;
      if (V0.on) { IN.mode = 'vision'; V0.left = Math.max(0, V0.left - rdt); }
      V0.k += ((V0.on ? 1 : 0) - V0.k) * Math.min(1, rdt * (V0.on ? 7 : 4.5));
      S.scale = 1 - 0.55 * V0.k * V0.k * (3 - 2 * V0.k);
      ui.visionBar.style.width = (V0.left / 1.2 * 100).toFixed(0) + '%';
      if (V0.on) hintOnce('vision', 'Court vision: the floor slows down while you hold. Watch for the gap, then flick.');
    }
    function update(dt, rdt) {
      S.t += rdt;
      S.popups.forEach(p => { p.t += rdt; });
      S.popups = S.popups.filter(p => p.t < p.life);
      const w = S.w;
      if (!w || S.phase === 'board') return;
      const cam = camera();
      if (S.phase === 'live' && !w.over) PMSim.driveInput(w, dragDir(cam), IN.moveStart ? Math.min(0.25, (performance.now() - IN.moveStart.t) / 1000) : 0, dragMag());
      if (S.phase === 'live' || S.phase === 'card' || S.phase === 'ending') PMSim.update(w, dt);
      // events
      w.events.forEach(ev => {
        if (ev.type === 'pop') popup(ev.text, ev.color, ev.at, ev.size);
        else if (ev.type === 'sfx') {
          const n = ev.name;
          if (n === 'rim' || n === 'board' || n === 'swish' || n === 'block' || n === 'whistle' || n === 'bad') Sfx.play(n, ev.s);
          else if (n === 'bounce') Sfx.play('bounce', ev.s);
          else if (n === 'cutoff') Sfx.buzz(25);
        } else if (ev.type === 'catch') {
          Sfx.play('dribble');
          // a finger still down from the pass doesn't steer the new man
          if (IN.id !== null) IN.mode = 'blocked';
          // the next pass, already called while the ball was in the air
          const Q = S.queued; S.queued = null;
          if (Q && performance.now() - Q.t < 1100 && S.spec.kind === 'pm') throwStroke(Q.st);
          if (S.spec.kind === 'calibrate') calibCaught();
          else if (S.spec.kind === 'pm') hintOnce('catch', 'Control follows the ball. If he is open he shoots; act first to swing it or drive the closeout.');
        } else if (ev.type === 'pass') { /* release sound already played */ }
        else if (ev.type === 'shot') Sfx.play('release');
        else if (ev.type === 'end' && !S.endTimer) {
          S.phase = 'ending';
          S.endTimer = setTimeout(() => { if (!S.running) return; if (S.spec.kind === 'board') finishBoard(); else finishPossession(); }, w.result && w.result.turnover ? 1100 : 1500);
        }
      });
      w.events.length = 0;
      // the camera eases toward the ball
      const target = w.ball.state === 'pass' ? w.ball.pass.E : w.ball.state === 'shot' ? [RIM.x, 0, RIM.z + 10] : w.off[w.handler].pos;
      const k = Math.min(1, rdt * 2.2);
      S.focus = S.focus ? [S.focus[0] + (target[0] - S.focus[0]) * k, 0, S.focus[2] + (target[2] - S.focus[2]) * k] : target.slice();
      // HUD
      if (!ui.clock.hidden) {
        const v = Math.max(0, w.clock);
        ui.clock.textContent = v < 5 ? v.toFixed(1) : Math.ceil(v);
        ui.clock.classList.toggle('low', v < 3);
      }
      if (w.ball.state === 'pass') { S.trail.push(w.ball.p.slice()); if (S.trail.length > 9) S.trail.shift(); } else S.trail.length = 0;
    }
    function calibCaught() {
      S.calibStep++;
      if (S.calibStep >= 2) { setTimeout(() => endSession(), 700); banner('', 'Got it', 'Every pass you throw scales from that.', 1.0); }
      else setTimeout(() => { if (S.running) calibThrow(); }, 600);
    }

    // ---------- render ----------
    function render() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (S.phase === 'board') return renderBoard();
      const w = S.w;
      const cam = camera();
      const court = S.court;
      ctx.fillStyle = '#0b0f18'; ctx.fillRect(0, 0, CW, CH);
      if (court.env === 'park') Court3D.drawPark(ctx, cam, S.t); else Court3D.drawRoom(ctx, cam, court, S.t);
      Court3D.drawFloor(ctx, cam, court);
      if (court.env === 'park') Court3D.drawFence(ctx, cam);
      if (!w) return;
      // floor marks: your guys' rings, the ball handler's spotlight, what court vision shows you
      const vk = S.vision.k;
      if (vk > 0.02) drawVisionFloor(cam, w, vk);
      const next = w.ball.state === 'pass' && w.ball.pass ? w.ball.pass.to : null;
      w.off.forEach((O, j) => {
        const mine = j === w.handler && w.ball.state === 'held';
        if (mine) return ring(cam, O.pos, 1.9, 'rgba(255,181,71,0.9)', 0.24);
        if (j === next) { const k = 0.55 + 0.35 * Math.sin(S.t * 18); return ring(cam, O.pos, 1.8, `rgba(255,181,71,${k.toFixed(2)})`, 0.18); }
        ring(cam, O.pos, 1.3, 'rgba(126,226,168,0.45)', 0.12);
      });
      // depth-sorted scene
      const items = [];
      const depth = p => Court3D.toCam(cam, p)[2];
      items.push({ d: depth([0, 10.5, 3.2]), f: () => { Court3D.drawSupport(ctx, cam, court); Court3D.drawBoard(ctx, cam, court); } });
      const rd = depth([RIM.x, RIM.y, RIM.z]);
      items.push({ d: rd + 0.6, f: () => Court3D.drawNetAndRim(ctx, cam, 'back', null, court) });
      items.push({ d: rd - 0.6, f: () => Court3D.drawNetAndRim(ctx, cam, 'front', null, court) });
      w.off.forEach((O, j) => items.push({ d: depth(V.add(O.pos, [0, 3, 0])), f: () => drawMan(cam, O, true, j === w.handler) }));
      w.def.forEach(D => items.push({ d: depth(V.add(D.pos, [0, 3, 0])), f: () => drawMan(cam, D, false) }));
      const B = w.ball;
      items.push({ d: depth(B.p) - 0.2, f: () => drawBallNow(cam, B) });
      items.sort((a, b) => b.d - a.d).forEach(it => it.f());
      drawPopups(cam);
      if (vk > 0.02) {
        const g = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.35, CW / 2, CH / 2, Math.max(CW, CH) * 0.75);
        g.addColorStop(0, 'rgba(10,18,40,0)'); g.addColorStop(1, `rgba(10,18,40,${0.55 * vk})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
      }
    }
    function ring(cam, p, r, color, fill) {
      const pts = [];
      for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; pts.push([p[0] + Math.sin(a) * r, 0.02, p[2] + Math.cos(a) * r]); }
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      const q = pts.map(x => Court3D.project(cam, x));
      if (q.some(x => !x)) { ctx.restore(); return; }
      ctx.beginPath(); q.forEach((x, i) => i ? ctx.lineTo(x.x, x.y) : ctx.moveTo(x.x, x.y)); ctx.closePath();
      if (fill) { ctx.fillStyle = color.replace(/[\d.]+\)$/, fill + ')'); ctx.fill(); }
      ctx.stroke();
      ctx.restore();
    }
    function drawVisionFloor(cam, w, k) {
      ctx.save();
      ctx.globalAlpha = k;
      // how far each defender can reach: the gaps are what's left
      w.def.forEach(D => {
        const pts = [];
        const r = 2.6 * (D.reachK || 1) + (D.jumper ? 1.2 : 0);
        for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; pts.push([D.pos[0] + Math.sin(a) * r, 0.02, D.pos[2] + Math.cos(a) * r]); }
        Court3D.fillPoly(ctx, cam, pts, D.jumper ? 'rgba(255,93,74,0.30)' : 'rgba(255,122,102,0.18)');
      });
      // where your guys are going
      ctx.strokeStyle = 'rgba(200,225,255,0.85)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
      w.off.forEach((O, j) => {
        if (j === w.handler) return;
        const to = PMSim.predict(w, j, 0.9);
        if (Math.hypot(to[0] - O.pos[0], to[2] - O.pos[2]) < 2) return;
        const a = Court3D.project(cam, [O.pos[0], 0.05, O.pos[2]]), b = Court3D.project(cam, [to[0], 0.05, to[2]]);
        if (!a || !b) return;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 9 * Math.cos(ang - 0.45), b.y - 9 * Math.sin(ang - 0.45)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 9 * Math.cos(ang + 0.45), b.y - 9 * Math.sin(ang + 0.45)); ctx.stroke();
        ctx.setLineDash([6, 6]);
      });
      ctx.setLineDash([]);
      ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      w.off.forEach((O, j) => {
        if (j === w.handler) return;
        const a = Court3D.project(cam, [O.pos[0], 0, O.pos[2]]);
        if (!a) return;
        const tag = ROLE_TAG[O.role.id] || '';
        const tw = ctx.measureText(tag).width + 10;
        ctx.fillStyle = 'rgba(12,16,24,0.78)'; ctx.fillRect(a.x - tw / 2, a.y + 10, tw, 16);
        ctx.fillStyle = '#e8f0ff'; ctx.fillText(tag, a.x, a.y + 22);
      });
      ctx.restore();
    }
    // what each of your guys wants: where he'll score it
    const ROLE_TAG = { shooter: 'SHOOTER', guard: 'GUARD', slasher: 'CUTTER', big: 'RIM' };
    function drawMan(cam, M, offense, handler) {
      const sc = S.w.scheme;
      const camF = [cam.f[0], 0, cam.f[2]];
      const back = (M.face[0] * camF[0] + M.face[2] * camF[2]) > 0.2;
      const colors = offense
        ? { skin: M.skin, hair: M.hair, jersey: settings.jersey, shorts: settings.shorts, shoes: '#f4f4f4', trim: '#ffffff' }
        : { skin: M.skin, hair: M.hair, jersey: sc.colors.jersey, shorts: sc.colors.shorts, shoes: '#1d1f24', trim: sc.colors.trim };
      Court3D.drawFigure(ctx, cam, { pos: M.pos, face: M.face, pose: M.pose, lift: M.lift || 0, scale: (offense ? 1 : (M.height || 1)) * (settings.figScale || 1.3), reach: M.reachK || 1, colors, number: M.number, back });
    }
    function drawBallNow(cam, B) {
      if (!S.w) return;
      const p = B.p;
      if (B.state === 'pass') {
        S.trail.forEach((q, i) => {
          const pp = Court3D.project(cam, q); if (!pp) return;
          ctx.fillStyle = `rgba(255,255,255,${(i + 1) / S.trail.length * 0.22})`;
          ctx.beginPath(); ctx.arc(pp.x, pp.y, Court3D.BALL_R * pp.s * (0.5 + i / S.trail.length * 0.5), 0, Math.PI * 2); ctx.fill();
        });
      }
      Court3D.drawShadow(ctx, cam, p, p[1]);
      Court3D.drawBall(ctx, cam, { p, rot: S.t * 8, scale: 1.25 });
    }
    function drawPopups(cam) {
      S.popups.forEach(p => {
        const q = Court3D.project(cam, p.world); if (!q) return;
        const k = p.t / p.life;
        const y = q.y - k * 30;
        const a = k < 0.15 ? k / 0.15 : (k > 0.7 ? (1 - k) / 0.3 : 1);
        const sz = Math.round(Math.min(CW, CH) * 0.062 * p.size);
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = `800 ${sz}px "Big Shoulders Display", Impact, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, sz * 0.12); ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        const text = p.text.toUpperCase();
        const x = clamp(q.x, sz * 2.2, CW - sz * 2.2);
        ctx.strokeText(text, x, y); ctx.fillStyle = p.color; ctx.fillText(text, x, y);
        ctx.restore();
      });
    }

    // the whiteboard
    function renderBoard() {
      const b = S.board, G = boardGeom();
      ctx.fillStyle = '#e9e6dc'; ctx.fillRect(0, 0, CW, CH);
      const P = (x, z) => bxy(G, x, z);
      const tl = P(-25, 0), br = P(25, 34);
      ctx.fillStyle = '#fbfaf6';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeStyle = 'rgba(47,75,120,0.55)'; ctx.lineWidth = 2;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      const c = S.court, hw = c.lane / 2;
      const k1 = P(-hw, 0), k2 = P(hw, 19);
      ctx.strokeRect(k1.x, k1.y, k2.x - k1.x, k2.y - k1.y);
      ctx.beginPath(); const ft = P(0, 19); ctx.arc(ft.x, ft.y, 6 * G.s, 0, Math.PI); ctx.stroke();
      // the arc
      const a0 = c.cornerZ > RIM.z ? Math.atan2(c.corner, c.cornerZ - RIM.z) : Math.asin(Math.min(1, c.corner / c.three));
      ctx.beginPath();
      let q = P(-c.corner, 0); ctx.moveTo(q.x, q.y); q = P(-c.corner, c.cornerZ); ctx.lineTo(q.x, q.y);
      for (let i = 0; i <= 40; i++) { const a = -a0 + 2 * a0 * i / 40; q = P(RIM.x + c.three * Math.sin(a), RIM.z + c.three * Math.cos(a)); ctx.lineTo(q.x, q.y); }
      q = P(c.corner, 0); ctx.lineTo(q.x, q.y); ctx.stroke();
      // rim
      const r = P(RIM.x, RIM.z);
      ctx.strokeStyle = '#d4602a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, 0.75 * G.s + 1, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3a3f4b'; ctx.beginPath(); const b1 = P(-3, 4), b2 = P(3, 4); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      // the lines you drew
      const plan = S.plan;
      if (plan.cut) drawRoute(G, plan.cut.pts, '#2f6fd1', true);
      if (S.draw && !S.draw.pass) drawRoute(G, [[b.off[S.draw.i][0], b.off[S.draw.i][1]]].concat(S.draw.pts.slice(1)), '#2f6fd1', true);
      const passLine = S.draw && S.draw.pass ? S.draw.pts[S.draw.pts.length - 1] : plan.pass ? plan.pass.to : null;
      if (passLine) drawPassLine(G, b.off[b.holder], passLine, S.draw && S.draw.pass ? plan.type : plan.pass.type || plan.type);
      // X's and O's
      b.def.forEach(d => {
        const p = P(d[0], d[1]), s = Math.max(7, G.s * 0.95);
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s); ctx.moveTo(p.x + s, p.y - s); ctx.lineTo(p.x - s, p.y + s); ctx.stroke();
        if (d[2]) { ctx.fillStyle = '#c0392b'; ctx.font = '700 10px "Barlow", sans-serif'; ctx.textAlign = 'center'; ctx.fillText({ watch: 'eyes on ball', deny: 'denying', sunk: 'in the lane', front: 'fronting', behind: 'behind', jump: 'cheating' }[d[2]] || '', p.x, p.y + s + 12); }
      });
      b.off.forEach((o, i) => {
        const p = P(o[0], o[1]), rr = Math.max(9, G.s * 1.05);
        ctx.fillStyle = i === b.holder ? '#2f4b78' : '#fbfaf6';
        ctx.strokeStyle = '#2f4b78'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = i === b.holder ? '#fff' : '#2f4b78'; ctx.font = `800 ${Math.round(rr * 1.05)}px "Big Shoulders Display", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), p.x, p.y + 1);
        ctx.textBaseline = 'alphabetic';
        if (i === b.holder) { ctx.fillStyle = '#e0661f'; ctx.beginPath(); ctx.arc(p.x + rr * 0.9, p.y - rr * 0.9, rr * 0.45, 0, Math.PI * 2); ctx.fill(); }
        // the role over his head, or under him when his man is standing there
        const role = PMPlays.ROLES[o[2]];
        const crowded = b.def.some(d => d[1] < o[1] && Math.hypot(d[0] - o[0], d[1] - o[1]) < 5.5);
        if (role) { ctx.fillStyle = 'rgba(47,75,120,0.8)'; ctx.font = '600 11px "Barlow", sans-serif'; ctx.fillText(role.label, p.x, crowded ? p.y + rr + 13 : p.y - rr - 5); }
      });
    }
    function drawRoute(G, pts, color, dashed) {
      if (pts.length < 2) return;
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (dashed) ctx.setLineDash([9, 7]);
      ctx.beginPath();
      pts.forEach((p, i) => { const q = bxy(G, p[0], p[1]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.stroke(); ctx.setLineDash([]);
      const a = bxy(G, pts[pts.length - 2][0], pts[pts.length - 2][1]), b = bxy(G, pts[pts.length - 1][0], pts[pts.length - 1][1]);
      arrowHead(a, b, color);
      ctx.restore();
    }
    function drawPassLine(G, from, to, type) {
      const a = bxy(G, from[0], from[1]), b = bxy(G, to[0], to[1]);
      ctx.save(); ctx.strokeStyle = '#1d2433'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      if (type === 'lob') { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1; ctx.quadraticCurveTo(mx + nx / nl * 26, my + ny / nl * 26, b.x, b.y); }
      else if (type === 'bounce') { const m = { x: a.x + (b.x - a.x) * 0.6, y: a.y + (b.y - a.y) * 0.6 }; ctx.lineTo(m.x, m.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, Math.PI * 2); ctx.fillStyle = '#1d2433'; ctx.fill(); ctx.beginPath(); ctx.moveTo(b.x, b.y); }
      else ctx.lineTo(b.x, b.y);
      ctx.stroke();
      arrowHead(type === 'lob' ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a, b, '#1d2433');
      ctx.restore();
    }
    function arrowHead(a, b, color) {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 12 * Math.cos(ang - 0.42), b.y - 12 * Math.sin(ang - 0.42)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 12 * Math.cos(ang + 0.42), b.y - 12 * Math.sin(ang + 0.42)); ctx.stroke();
    }

    function setSettings(o) { Object.assign(settings, o || {}); }
    return { run, stop, destroy, setSettings, summary, get settings() { return settings; }, _S: S, _camera: camera, _boardGeom: () => boardGeom(), _project: p => Court3D.project(camera(), p) };
  }

  return { create, FEEL };
})();
