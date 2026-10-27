/* LockdownEngine: the defensive game. First person: you're guarding him, the
   rim behind you. One finger: drag to slide your feet, slice through the ball
   to steal it, flick up to contest or block, hold still in his path to wall up
   or take a charge. When the shot goes up the camera turns to the rim: touch
   and hold to box out, then go get it.

   spec.kind:
     lockdown    possessions vs a mix of scorers: { count, scorers, shotClock }
     pickpocket  steals only: dribblers, slice at the ball
     swat        blocks only: pull-ups, pump fakes, layups, chase-downs
     glass       rebounding only: box out, read the miss, time the jump */
const LockdownEngine = (() => {
  const { V, RIM } = Court3D;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SC = LockdownScorers;

  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
.dfx{position:absolute;inset:0;overflow:hidden;background:#0b0f18;color:#f3f1ea;font-family:"Barlow",system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.dfx canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.dfx-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 22px max(14px,env(safe-area-inset-left,0px));pointer-events:none;background:linear-gradient(rgba(6,8,12,.72),rgba(6,8,12,0))}
.dfx-quit{pointer-events:auto;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,14,22,.55);color:#f3f1ea;font:600 18px/1 "Barlow",sans-serif;cursor:pointer}
.dfx-quit:focus-visible,.dfx-btn:focus-visible{outline:2px solid #ffb547;outline-offset:2px}
.dfx-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.dfx-title b{font:800 20px/1 "Big Shoulders Display",Impact,"Arial Narrow",sans-serif;letter-spacing:.04em;text-transform:uppercase}
.dfx-title span{font:500 13px/1.25 "Barlow",sans-serif;opacity:.82}
.dfx-score{text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.dfx-score-n{display:block;font:800 40px/0.95 "Big Shoulders Display",Impact,sans-serif;font-variant-numeric:tabular-nums}
.dfx-score small{font:600 11px/1.2 "Barlow",sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.dfx-clock{position:absolute;left:50%;top:calc(58px + env(safe-area-inset-top,0px));transform:translateX(-50%);min-width:64px;padding:2px 12px;border-radius:8px;background:rgba(8,10,14,.72);border:1px solid rgba(255,181,71,.35);font:800 30px/1.1 "Big Shoulders Display",Impact,sans-serif;color:#ffb547;text-align:center;font-variant-numeric:tabular-nums;pointer-events:none}
.dfx-clock.low{color:#ff5d4a;border-color:rgba(255,93,74,.6)}
.dfx-chips{position:absolute;left:0;right:0;top:calc(104px + env(safe-area-inset-top,0px));display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:0 14px;pointer-events:none}
.dfx-chip{padding:5px 10px;border-radius:999px;font:600 12px/1.1 "Barlow",sans-serif;letter-spacing:.03em;background:rgba(8,10,14,.72);border:1px solid rgba(255,255,255,.18)}
.dfx-chip b{font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.dfx-chip.man{color:#cfe3ff;border-color:rgba(143,180,255,.45)}
.dfx-banner{position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;padding:0 18px}
.dfx-banner .k{display:block;font:600 13px/1.2 "Barlow",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffb547;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.dfx-banner .h{display:block;font:800 clamp(30px,9vw,52px)/0.95 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.75);text-wrap:balance}
.dfx-banner .s{display:block;margin:6px auto 0;max-width:30ch;font:500 15px/1.3 "Barlow",sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.9);opacity:.94}
.dfx-banner.pop{animation:dfxpop .35s ease-out}
@keyframes dfxpop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
.dfx-hint{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);padding:7px 12px;border-radius:10px;background:rgba(8,10,14,.74);font:500 13px/1.35 "Barlow",sans-serif;text-align:center;pointer-events:none;color:#e8e4da}
.dfx-bal{position:absolute;left:50%;bottom:calc(64px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:9px;background:rgba(8,10,14,.55);font:700 10px/1 "Barlow",sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#cfd3dc;pointer-events:none}
.dfx-bal i{position:relative;display:block;width:96px;height:6px;border-radius:3px;background:rgba(255,255,255,.14)}
.dfx-bal i::before{content:"";position:absolute;left:50%;top:-3px;width:1px;height:12px;background:rgba(255,255,255,.35)}
.dfx-bal i b{position:absolute;top:-3px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#7ee2a8;transition:background .15s}
.dfx-bal.tilt i b{background:#ff9a66}
.dfx-card{position:absolute;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:14px 16px 12px;border-radius:14px;background:rgba(14,18,27,.95);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.5);animation:dfxup .25s ease-out}
@keyframes dfxup{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.dfx-card .k{font:600 11px/1.2 "Barlow",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#ffb547}
.dfx-card .w{margin-top:5px;font:600 16px/1.35 "Barlow",sans-serif}
.dfx-card .r{display:flex;gap:10px;align-items:flex-start;margin-top:9px;font:400 14px/1.4 "Barlow",sans-serif;color:#cfd3dc}
.dfx-grade{flex:none;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;font:800 22px/1 "Big Shoulders Display",Impact,sans-serif;color:#0b0f18;background:#7ee2a8}
.dfx-grade.B{background:#c5e27e}.dfx-grade.C{background:#ffd166}.dfx-grade.D{background:#ff9a66}.dfx-grade.F{background:#ff5d4a}
.dfx-card .row{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap}
.dfx-btn{pointer-events:auto;cursor:pointer;border:0;border-radius:10px;padding:10px 18px;background:#ffb547;color:#1a1206;font:800 15px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:.08em;text-transform:uppercase}
`;
    document.head.appendChild(st);
  }

  // drills: how each rep is set up
  const SWAT_REPS = [
    { scorer: 'shooter', script: ['rise'], gap0: 2.3, d0: 15, label: 'Pull-up in your face' },
    { scorer: 'pump', script: ['pump:rise'], gap0: 2.8, d0: 16, label: 'Pump fake, then the shot' },
    { scorer: 'rim', script: ['attack'], gap0: 7.2, d0: 10.5, label: 'Inside the circle: wall up, then go up' },
    { scorer: 'slasher', script: [], gap0: 3.2, d0: 16, beaten: 1, label: 'Chase-down' },
    { scorer: 'pump', script: ['pump:drive'], gap0: 2.8, d0: 16, label: 'Pump fake, then the drive' },
    { scorer: 'crasher', script: ['rise'], gap0: 2.2, d0: 11, label: 'A big going up' },
    { scorer: 'rim', script: ['attack'], gap0: 7.2, d0: 10.5, label: 'Inside the circle: wall up, then go up' },
    { scorer: 'slasher', script: [], gap0: 3.2, d0: 16, beaten: -1, label: 'Chase-down' }
  ];
  const PICK_REPS = ['loose', 'shooter', 'loose', 'slasher', 'loose', 'stepback', 'loose', 'pump'];
  const GLASS_SPOTS = ['lw', 'rc', 'top', 're', 'lb', 'rw', 'lc', 'le'];

  function create(container, opts) {
    injectCss();
    const settings = Object.assign({ feel: 'normal', hints: true, tags: true, jersey: '#2c5a46', shorts: '#234a39', skin: '#a86b3c', court: 'park' }, opts || {});
    const root = document.createElement('div');
    root.className = 'dfx';
    root.innerHTML = `
      <canvas></canvas>
      <div class="dfx-top"><button class="dfx-quit" type="button" aria-label="Leave this game">&#x2715;</button><div class="dfx-title"><b></b><span></span></div><div class="dfx-score"><span class="dfx-score-n"></span><small></small></div></div>
      <div class="dfx-clock" hidden></div>
      <div class="dfx-chips"><div class="dfx-chip man" hidden></div></div>
      <div class="dfx-banner" hidden></div>
      <div class="dfx-bal" hidden>Balance<i><b></b></i></div>
      <div class="dfx-hint" hidden></div>
      <div class="dfx-card" hidden></div>`;
    container.appendChild(root);
    const $ = s => root.querySelector(s);
    const canvas = $('canvas'), ctx = canvas.getContext('2d');
    const ui = {
      title: $('.dfx-title b'), sub: $('.dfx-title span'), score: $('.dfx-score-n'), scoreSub: $('.dfx-score small'),
      clock: $('.dfx-clock'), man: $('.dfx-chip.man'), banner: $('.dfx-banner'), bal: $('.dfx-bal'), balDot: $('.dfx-bal b'),
      hint: $('.dfx-hint'), card: $('.dfx-card'), quit: $('.dfx-quit')
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
      spec: null, w: null, running: false, raf: 0, last: 0, t: 0, rand: Math.random, court: Court3D.COURTS.park,
      phase: 'idle', i: 0, log: [], popups: [], hints: {}, cardNext: null, onEnd: null, onQuit: null, lastScorer: null,
      endTimer: null, cam: null, camFrom: null, slices: [], handAnim: null, tally: { stops: 0, points: 0, steals: 0, blocks: 0, boards: 0, charges: 0, reaches: 0, offboards: 0 }
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

    // ---------- camera ----------
    /* Guarding him: your eyes a step behind your feet, looking at his hips,
       the floor out to half court behind him. It turns with him a beat late,
       so a drive shows. */
    function duelView(w) {
      const Y = w.you.pos, O = w.off.pos;
      const d = [O[0] - Y[0], 0, O[2] - Y[2]], dl = Math.hypot(d[0], d[2]) || 1;
      const want = Math.atan2(d[0] / dl, d[2] / dl);
      if (S.duelYaw == null) S.duelYaw = want;
      const back = 3.6, eyeH = 6.1;
      const yaw = S.duelYaw;
      const f = [Math.sin(yaw), 0, Math.cos(yaw)];
      const eye = [Y[0] - f[0] * back, eyeH, Y[2] - f[2] * back];
      const horiz = Math.max(3, dl + back);
      // aim so his head clears the scoreboard and his feet sit above your hands
      const fovY = 76 * Math.PI / 180;
      const focal = (CH / 2) / Math.tan(fovY / 2);
      const headY = 6.4 * (w.arch.height || 1);
      const headTop = Math.max(250, CH * 0.31);
      const pitch = Math.atan2(headY - eyeH, horiz) - Math.atan((CH / 2 - headTop) / focal);
      return { eye, yaw, pitch, fovY };
    }
    // the play at the rim: up behind it, looking at the hoop
    function rimView(w) {
      const Y = w.you.pos, O = w.off.pos;
      const glassShooter = w.glass && !w.glass.shot ? w.glass.shooter : null;
      const mid = glassShooter ? V.lerp3(Y, glassShooter, 0.25) : V.lerp3(Y, O, 0.5);
      const d = Court3D.dirToRim(mid);
      // up behind the play and off to the side toward the middle of the floor, so bodies don't stack
      const side = [-d[2], 0, d[0]];
      const sg = mid[0] > 0 ? -1 : 1;
      const eye = [mid[0] - d[0] * 11 + side[0] * sg * 4, 15, mid[2] - d[2] * 11 + side[2] * sg * 4];
      const tgt = V.lerp3(mid, [RIM.x, 0, RIM.z], 0.55);
      const look = [tgt[0], 3.6, tgt[2]];
      const v = V.sub(look, eye), h = Math.hypot(v[0], v[2]);
      return { eye, yaw: Math.atan2(v[0], v[2]), pitch: Math.atan2(v[1], h), fovY: 64 * Math.PI / 180 };
    }
    function viewToCam(v) {
      const f = [Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), Math.cos(v.yaw) * Math.cos(v.pitch)];
      return Court3D.camera(v.eye, f, CW, CH, v.fovY);
    }
    function camera() {
      const w = S.w;
      if (!w) return viewToCam({ eye: [0, 6, 30], yaw: Math.PI, pitch: -0.2, fovY: 1.1 });
      if (w.cam !== 'rim') return viewToCam(duelView(w));
      const to = rimView(w);
      // smooth the follow so it doesn't jitter
      if (!S.rimEye) S.rimEye = to.eye.slice();
      const k = clamp((w.t - w.camAt) / 0.38, 0, 1);
      if (k < 1 && S.camFrom) {
        const e = ease(k);
        let dy = to.yaw - S.camFrom.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        // swing up and over the players on the way around
        const eye = V.add(V.lerp3(S.camFrom.eye, to.eye, e), [0, Math.sin(Math.PI * e) * 9, 0]);
        return viewToCam({ eye, yaw: S.camFrom.yaw + dy * e, pitch: S.camFrom.pitch + (to.pitch - S.camFrom.pitch) * e, fovY: S.camFrom.fovY + (to.fovY - S.camFrom.fovY) * e });
      }
      return viewToCam(to);
    }
    function floorBasis(cam) {
      const r = V.norm([cam.r[0], 0, cam.r[2]]), f = V.norm([cam.f[0], 0, cam.f[2]]);
      return { r, f };
    }

    // ---------- input ----------
    /* One finger. Slow drags slide your feet (like a joystick from where you
       touched). A fast stroke is either a flick up (jump) or a slice: if it
       crosses the ball, that's a swipe at it. A finger down and still is your
       stance: in his path that's a charge, after a shot it's a box-out. */
    const IN = { id: null, start: null, pts: [], mode: null, stillAt: 0, fastFrom: -1, slashDir: 0 };
    const FAST = 1.45;
    function speedOver(ms) {
      const pts = IN.pts, last = pts[pts.length - 1];
      let k = pts.length - 1;
      while (k > 0 && last.t - pts[k - 1].t <= ms) k--;
      const ref = k === pts.length - 1 ? (pts[k - 1] || last) : pts[k];
      const dt = Math.max(8, last.t - ref.t) / 1000;
      return { v: Math.hypot(last.x - ref.x, last.y - ref.y) / CH / dt, i: Math.max(0, k - 1) };
    }
    canvas.addEventListener('pointerdown', e => {
      if (IN.id !== null || !S.running) return;
      Sfx.unlock();
      IN.id = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const p = { x: e.clientX, y: e.clientY, t: performance.now() };
      Object.assign(IN, { start: p, pts: [p], mode: 'pending', stillAt: p.t, fastFrom: -1, slashDir: 0 });
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== IN.id) return;
      const p = { x: e.clientX, y: e.clientY, t: performance.now() };
      const prev = IN.pts[IN.pts.length - 1];
      IN.pts.push(p);
      if (IN.pts.length > 90) IN.pts.splice(1, 1);
      if (Math.hypot(p.x - prev.x, p.y - prev.y) > 2.5) IN.stillAt = p.t;
      if (IN.mode === 'used') return;
      const sp = speedOver(60);
      if (sp.v > FAST) {
        if (IN.fastFrom < 0) IN.fastFrom = Math.max(0, IN.pts.length - 2);
        const a = IN.pts[Math.min(IN.fastFrom, IN.pts.length - 1)];
        const dx = p.x - a.x, dy = p.y - a.y, L = Math.hypot(dx, dy);
        S.slices.push({ x0: prev.x, y0: prev.y, x1: p.x, y1: p.y, t: S.t });
        if (L > 24) {
          if (dy < 0 && -dy > Math.abs(dx) * 1.25) { doJump(a, p, L); IN.mode = 'used'; return; }
          if (trySlice(prev, p, dx)) { IN.mode = 'used'; return; }
          IN.slashDir = Math.sign(dx) || IN.slashDir;
        }
      } else {
        IN.fastFrom = -1;
        if (IN.mode === 'pending' && Math.hypot(p.x - IN.start.x, p.y - IN.start.y) > 12) IN.mode = 'drag';
      }
    });
    function endPointer(e) {
      if (e.pointerId !== IN.id) return;
      IN.id = null;
      const mode = IN.mode;
      IN.mode = null;
      // a fast sideways swipe that never touched the ball
      if (mode !== 'used' && IN.slashDir && S.w && S.w.phase === 'duel' && !S.w.over && S.phase === 'live') {
        const r = LockdownSim.slice(S.w, { hit: false, dir: IN.slashDir });
        if (r) Sfx.play('release');
      }
      IN.slashDir = 0;
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.style.touchAction = 'none';

    function ballScreen(cam) {
      const w = S.w; if (!w) return null;
      const q = Court3D.project(cam, w.ball.p);
      if (!q) return null;
      return { x: q.x, y: q.y, r: Court3D.BALL_R * q.s };
    }
    function segDist(px, py, a, b) {
      const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1;
      const t = clamp(((px - a.x) * vx + (py - a.y) * vy) / l2, 0, 1);
      return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
    }
    function trySlice(a, b, dx) {
      const w = S.w;
      if (!w || S.phase !== 'live' || w.phase !== 'duel' || w.over) return false;
      const B = ballScreen(camera());
      if (!B) return false;
      const tol = B.r + Math.max(24, CW * 0.065);
      const d = segDist(B.x, B.y, a, b);
      if (d > tol) return false;
      const res = LockdownSim.slice(w, { hit: true, acc: 1 - d / tol, dir: Math.sign(dx) || 1 });
      S.handAnim = { kind: 'slice', t0: S.t, from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y }, side: Math.sign(dx) || 1 };
      if (res) Sfx.play(res === 'steal' ? 'block' : 'release');
      return !!res;
    }
    function doJump(a, z, L) {
      const w = S.w;
      if (!w || S.phase !== 'live' || w.over) return;
      const cam = camera();
      // where your hands go: under where you flicked, at his depth
      let reachX = 0;
      if (w.cam !== 'rim') {
        const depth = Math.max(2, Court3D.toCam(cam, V.add(w.off.pos, [0, 5, 0]))[2]);
        reachX = (z.x - cam.cx) / cam.focal * depth;
      }
      const k = clamp(L / (CH * 0.16), 0.5, 1);
      if (LockdownSim.jump(w, { k, reachX })) {
        S.handAnim = { kind: 'jump', t0: S.t };
        Sfx.play('release');
      }
    }
    function joystick() {
      if (IN.id === null || IN.mode !== 'drag') return { jx: 0, jy: 0 };
      const last = IN.pts[IN.pts.length - 1];
      const dx = last.x - IN.start.x, dy = last.y - IN.start.y;
      const dead = 6;
      const ax = Math.abs(dx) < dead ? 0 : dx - Math.sign(dx) * dead, ay = Math.abs(dy) < dead ? 0 : dy - Math.sign(dy) * dead;
      return { jx: clamp(ax / (CW * 0.17), -1, 1), jy: clamp(-ay / (CH * 0.1), -1, 1) };
    }

    ui.quit.addEventListener('click', () => { Sfx.play('ui'); const q = S.onQuit; stop(); q && q(summary(true)); });
    ui.card.addEventListener('click', e => { const b = e.target.closest('button'); if (b && S.cardNext) { const f = S.cardNext; S.cardNext = null; f(b.dataset.act); } });

    // ---------- sessions ----------
    function run(spec, handlers) {
      stop();
      S.spec = Object.assign({}, spec);
      S.court = Court3D.COURTS[spec.court] || Court3D.COURTS[settings.court] || Court3D.COURTS.park;
      S.onEnd = handlers && handlers.onEnd; S.onQuit = handlers && handlers.onQuit;
      S.rand = spec.seed != null ? mulberry(spec.seed) : Math.random;
      Object.assign(S, { t: 0, i: 0, log: [], popups: [], w: null, phase: 'idle', cardNext: null, lastScorer: null, endTimer: null, ended: false, slices: [], handAnim: null });
      S.tally = { stops: 0, points: 0, steals: 0, blocks: 0, boards: 0, charges: 0, reaches: 0, offboards: 0 };
      ['clock', 'man', 'banner', 'bal', 'hint', 'card'].forEach(k => { ui[k].hidden = true; });
      S.running = true;
      S.last = performance.now();
      S.raf = requestAnimationFrame(frame);
      startRep(0);
    }
    function count() { return S.spec.count || 8; }
    function pickScorer() {
      const plan = S.spec.plan && S.spec.plan[S.i];
      if (plan && plan.scorer) return plan.scorer;
      const list = S.spec.scorers && S.spec.scorers.length ? S.spec.scorers : SC.IDS;
      const pool = list.filter(x => x !== S.lastScorer);
      const from = pool.length ? pool : list;
      return from[Math.floor(S.rand() * from.length)];
    }
    function startRep(i) {
      const spec = S.spec, kind = spec.kind || 'lockdown';
      if (i >= count()) return endSession();
      S.i = i;
      let o = { court: S.court, rand: S.rand, kind, clock: spec.shotClock || 11 };
      const plan = spec.plan && spec.plan[i];
      let label = null;
      if (kind === 'lockdown') { o.scorer = pickScorer(); }
      else if (kind === 'pickpocket') { o.scorer = plan && plan.scorer || PICK_REPS[i % PICK_REPS.length]; o.clock = spec.shotClock || 5.5; }
      else if (kind === 'swat') { const r = SWAT_REPS[i % SWAT_REPS.length]; Object.assign(o, { scorer: r.scorer, script: r.script.slice(), gap0: r.gap0, d0: r.d0, firstSize: 0.7, beaten: r.beaten || 0 }); label = r.label; }
      else if (kind === 'glass') { o.scorer = 'crasher'; o.shotSpot = GLASS_SPOTS[i % GLASS_SPOTS.length]; }
      if (plan) Object.assign(o, plan);
      S.lastScorer = o.scorer;
      S.w = LockdownSim.create(o);
      S.duelYaw = null; S.rimEye = null; S.camFrom = null; S.lastCamMode = S.w.cam;
      S.endTimer = null; S.slices = []; S.handAnim = null;
      const A = S.w.arch;
      const titles = { lockdown: spec.title || 'Lockdown', pickpocket: 'Pickpocket', swat: 'Swat', glass: 'Glass' };
      const noun = kind === 'lockdown' ? 'Possession' : 'Rep';
      setTitle(titles[kind], `${noun} ${i + 1} of ${count()}`);
      updateScore();
      if (kind === 'glass') ui.man.innerHTML = `Your man: <b>${esc(A.name)}</b>`;
      else ui.man.innerHTML = settings.tags ? `<b>${esc(A.name)}</b> · ${esc(A.tag)}` : 'Read him yourself';
      ui.man.hidden = false;
      ui.clock.hidden = true;
      S.phase = 'intro';
      const head = kind === 'glass' ? 'Box out' : (settings.tags ? A.name : 'Your man');
      const sub = kind === 'glass' ? 'The shot goes up from the ' + Court3D.SPOTS[o.shotSpot].label.toLowerCase() + '. Find him, hold him off, go get it.' : (label ? label + '. ' : '') + (settings.tags ? A.tell : 'Watch him and figure out what he wants.');
      banner(`${noun} ${i + 1}`, head, sub, 1.7);
      setTimeout(() => {
        if (!S.running || !S.w || S.phase !== 'intro') return;
        S.phase = 'live';
        if (kind === 'lockdown') ui.clock.hidden = false;
        ui.bal.hidden = kind === 'glass';
        if (kind === 'glass') hintOnce('glass', 'When it goes up: touch and hold to box him out. Slide the way he leans. Then drag to the ball and flick up to jump.');
        else if (kind === 'pickpocket') hintOnce('pick', 'Slice through the ball when it comes out in front of you. Reach when it\'s protected and it\'s a foul.');
        else if (kind === 'swat') hintOnce('swat', 'Flick up to jump. Get it on the way up; on the way down it\'s goaltending.');
        else if (i === 0) hintOnce('ld1', 'Drag to slide your feet · Slice through the ball to steal it · Flick up to contest');
        else if (i === 1) hintOnce('ld2', 'Hold your finger still in his path to take a charge · When the shot goes up, touch and hold to box out');
      }, 1550);
    }
    function updateScore() {
      const k = S.spec.kind || 'lockdown', T = S.tally;
      if (k === 'lockdown') setScore(T.stops, `stops · ${T.points} pts`);
      else if (k === 'pickpocket') setScore(T.steals, `steals · ${T.reaches} reaches`);
      else if (k === 'swat') setScore(T.blocks, 'blocks');
      else setScore(T.boards, `boards · ${T.offboards} his`);
    }
    function finishRep() {
      const w = S.w, R = w.result;
      if (!R || S.phase === 'card') return;
      S.phase = 'card';
      const T = S.tally;
      if (R.stop) T.stops++;
      T.points += R.points || 0;
      if (R.kind === 'steal') T.steals++;
      if (R.kind === 'block') T.blocks++;
      if (R.kind === 'board') T.boards++;
      if (R.kind === 'charge') T.charges++;
      if (R.kind === 'offboard' || R.kind === 'putback' || R.kind === 'putbackMiss') T.offboards++;
      if (w.dec.some(d => d.k === 'reach' || d.k === 'swipeDown' || d.k === 'hack')) T.reaches++;
      updateScore();
      const narr = LockdownSim.narrate(w), les = LockdownSim.lesson(w);
      S.log.push({ scorer: w.arch.id, grade: R.grade, points: R.points || 0, kind: R.kind, stop: R.stop, tags: R.tags || [], text: narr });
      ui.clock.hidden = true; ui.bal.hidden = true; hint('');
      const last = S.i + 1 >= count();
      const noun = (S.spec.kind || 'lockdown') === 'lockdown' ? 'Possession' : 'Rep';
      ui.card.innerHTML = `<div class="k">${noun} ${S.i + 1} · ${esc(w.arch.name)}</div><div class="w">${esc(narr)}</div>
        <div class="r"><span class="dfx-grade ${R.grade}">${R.grade}</span><span>${esc(les)}</span></div>
        <div class="row"><button class="dfx-btn" type="button">${last ? 'See results' : (noun === 'Rep' ? 'Next rep' : 'Next possession')}</button></div>`;
      ui.card.hidden = false;
      if (R.grade === 'A') Sfx.play('great'); else if (R.grade === 'B') Sfx.play('good');
      S.cardNext = () => { ui.card.hidden = true; startRep(S.i + 1); };
    }
    function summary(quit) {
      const k = S.spec ? S.spec.kind || 'lockdown' : null;
      const out = Object.assign({ kind: k, quit: !!quit, log: S.log }, S.tally);
      if (S.log.length) {
        const gp = { A: 4, B: 3, C: 2, D: 1, F: 0 };
        out.iq = Math.round(S.log.reduce((s, l) => s + gp[l.grade], 0) / S.log.length * 25);
      } else out.iq = 0;
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
      clearTimeout(S.endTimer);
      ui.banner.hidden = true;
      IN.id = null; IN.mode = null;
    }
    function destroy() { stop(); if (ro) ro.disconnect(); root.remove(); }

    // ---------- update ----------
    function frame(now) {
      if (!S.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - S.last) / 1000));
      S.last = now;
      update(dt);
      if (S.running) render();
      if (S.running) S.raf = requestAnimationFrame(frame);
    }
    function update(dt) {
      S.t += dt;
      S.popups.forEach(p => { p.t += dt; });
      S.popups = S.popups.filter(p => p.t < p.life);
      S.slices = S.slices.filter(s => S.t - s.t < 0.22);
      const w = S.w;
      if (!w) return;
      const cam = camera();
      // remember where the camera was when it starts turning
      if (w.cam !== S.lastCamMode) {
        if (w.cam === 'rim') { const dv = duelView(w); S.camFrom = dv; }
        S.lastCamMode = w.cam;
      }
      if (S.phase === 'live' || S.phase === 'ending' || S.phase === 'card') {
        const js = S.phase === 'live' ? joystick() : { jx: 0, jy: 0 };
        const fb = floorBasis(cam);
        const held = S.phase === 'live' && IN.id !== null && IN.mode !== 'used';
        const still = held && performance.now() - IN.stillAt > 110 && IN.mode !== 'drag';
        LockdownSim.input(w, { jx: js.jx, jy: js.jy, held, still, r: fb.r, f: fb.f });
        if (S.phase === 'live' || w.over) LockdownSim.step(w, dt);
      }
      // the camera turns with him, a beat late
      if (w.cam !== 'rim') {
        const d = [w.off.pos[0] - w.you.pos[0], 0, w.off.pos[2] - w.you.pos[2]], dl = Math.hypot(d[0], d[2]) || 1;
        const want = Math.atan2(d[0] / dl, d[2] / dl);
        if (S.duelYaw == null) S.duelYaw = want;
        let dy = want - S.duelYaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        S.duelYaw += dy * Math.min(1, dt * 5.5);
      }
      w.events.forEach(ev => {
        if (ev.type === 'pop') popup(ev.text, ev.color, ev.at, ev.size);
        else if (ev.type === 'sfx') {
          const n = ev.name;
          if (n === 'cutoff') Sfx.buzz(25);
          else Sfx.play(n, ev.s);
        } else if (ev.type === 'end' && !S.endTimer) {
          S.phase = 'ending';
          S.endTimer = setTimeout(() => { if (S.running) finishRep(); }, w.result && (w.result.kind === 'made' || w.result.kind === 'board' || w.result.kind === 'offboard') ? 1300 : 1000);
        }
      });
      w.events.length = 0;
      // first time the ball goes up
      if (w.phase === 'shot' && S.spec.kind !== 'glass' && S.spec.kind !== 'swat') hintOnce('box', 'Touch and hold to box him out. Watch which way he leans and slide that way, then go get it.');
      // HUD
      if (!ui.clock.hidden) {
        const v = Math.max(0, w.clock);
        ui.clock.textContent = v < 5 ? v.toFixed(1) : Math.ceil(v);
        ui.clock.classList.toggle('low', v < 3);
      }
      if (!ui.bal.hidden) {
        const wt = clamp(w.you.weight, -1, 1);
        ui.balDot.style.left = (50 + wt * 46).toFixed(1) + '%';
        ui.bal.classList.toggle('tilt', Math.abs(wt) > 0.45);
        if (w.phase !== 'duel' || w.you.chasing) ui.bal.hidden = true;
      }
    }

    // ---------- render ----------
    function render() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const w = S.w;
      const cam = camera();
      const court = S.court;
      ctx.fillStyle = '#0b0f18'; ctx.fillRect(0, 0, CW, CH);
      if (court.env === 'park') Court3D.drawPark(ctx, cam, S.t); else { Court3D.drawRoom(ctx, cam, court, S.t); drawFarWall(cam, court); }
      Court3D.drawFloor(ctx, cam, court);
      if (court.env === 'park') { Court3D.drawFence(ctx, cam); drawFarFence(cam); }
      if (!w) return;
      const items = [];
      const depth = p => Court3D.toCam(cam, p)[2];
      items.push({ d: depth([0, 10.5, 3.2]), f: () => { Court3D.drawSupport(ctx, cam, court); Court3D.drawBoard(ctx, cam, court); } });
      const rd = depth([RIM.x, RIM.y, RIM.z]);
      items.push({ d: rd + 0.6, f: () => Court3D.drawNetAndRim(ctx, cam, 'back', null, court) });
      items.push({ d: rd - 0.6, f: () => Court3D.drawNetAndRim(ctx, cam, 'front', null, court) });
      items.push({ d: depth(V.add(w.off.pos, [0, 3, 0])), f: () => drawScorer(cam, w) });
      if (w.cam === 'rim' && w.t - w.camAt > 0.22) items.push({ d: depth(V.add(w.you.pos, [0, 3, 0])), f: () => drawYou(cam, w) });
      if (w.glass) items.push({ d: depth(V.add(w.glass.shooter, [0, 3, 0])), f: () => drawGlassShooter(cam, w) });
      items.push({ d: depth(w.ball.p) - 0.25, f: () => drawBallNow(cam, w) });
      items.sort((a, b) => b.d - a.d).forEach(it => it.f());
      if (w.cam === 'rim' && w.rebound && w.rebound.pred && (w.phase === 'rebound') && !w.over) drawLanding(cam, w);
      drawSliceTrail();
      if (w.cam !== 'rim' || (w.t - w.camAt) < 0.25) drawHands(cam, w);
      drawPopups(cam);
    }
    // the far end of the gym, which the scoring game never looks at
    function drawFarWall(cam, court) {
      const X = 34, Z = 64, HT = court.env === 'arena' ? 46 : 30, dark = court.env === 'arena';
      Court3D.fillPoly(ctx, cam, [[-X, 0, Z], [X, 0, Z], [X, HT, Z], [-X, HT, Z]], dark ? '#0d0f15' : '#d7d2c4');
      if (dark) {
        // a crowd up in the dark
        for (let i = 0; i < 520; i++) {
          const x = -32 + ((i * 37) % 640) / 10, y = 3 + ((i * 53) % 230) / 10;
          const p = Court3D.project(cam, [x, y, Z - 0.1]);
          if (!p || p.x < -4 || p.x > CW + 4) continue;
          ctx.fillStyle = `hsla(${(i * 47) % 360},28%,${24 + (i * 13) % 30}%,0.8)`;
          ctx.fillRect(p.x, p.y, Math.max(1, p.s * 0.6), Math.max(1, p.s * 0.6));
        }
        return;
      }
      Court3D.fillPoly(ctx, cam, [[-X, 0, Z - 0.02], [X, 0, Z - 0.02], [X, 7, Z - 0.02], [-X, 7, Z - 0.02]], '#1e5b47');
      // double doors and a scoreboard
      [-14, 14].forEach(x => Court3D.fillPoly(ctx, cam, [[x - 3, 0, Z - 0.05], [x + 3, 0, Z - 0.05], [x + 3, 8, Z - 0.05], [x - 3, 8, Z - 0.05]], '#8f8a7e'));
      Court3D.fillPoly(ctx, cam, [[-7, 15, Z - 0.05], [7, 15, Z - 0.05], [7, 22, Z - 0.05], [-7, 22, Z - 0.05]], '#1b1d22');
      [[-4.5, 18.5], [4.5, 18.5]].forEach(([x, y]) => Court3D.fillPoly(ctx, cam, [[x - 1.6, y - 1.6, Z - 0.1], [x + 1.6, y - 1.6, Z - 0.1], [x + 1.6, y + 1.6, Z - 0.1], [x - 1.6, y + 1.6, Z - 0.1]], '#e2581f'));
      ['#e3b23c', '#1e5b47', '#f4efe3'].forEach((c, i) => { const x = -26 + i * 6; Court3D.fillPoly(ctx, cam, [[x - 2, 24, Z - 0.05], [x + 2, 24, Z - 0.05], [x + 2, 18, Z - 0.05], [x, 16.8, Z - 0.05], [x - 2, 18, Z - 0.05]], c); });
    }
    function drawFarFence(cam) {
      const a = [-31, 0, 52], b = [31, 0, 52], H = 12;
      Court3D.fillPoly(ctx, cam, [a, b, [b[0], H, b[2]], [a[0], H, a[2]]], 'rgba(120,140,160,0.09)');
      ctx.strokeStyle = 'rgba(150,170,190,0.16)';
      const n = 44;
      for (let i = 0; i <= n; i++) {
        const p = V.lerp3(a, b, i / n), q = V.lerp3(a, b, Math.min(1, (i + 6) / n)), q2 = V.lerp3(a, b, Math.max(0, (i - 6) / n));
        Court3D.seg(ctx, cam, p, [q[0], H, q[2]], 0.03, 0.5);
        Court3D.seg(ctx, cam, p, [q2[0], H, q2[2]], 0.03, 0.5);
      }
      ctx.strokeStyle = 'rgba(170,185,200,0.45)';
      Court3D.seg(ctx, cam, [a[0], H, a[2]], [b[0], H, b[2]], 0.12, 1);
      [[-30, 51], [30, 51]].forEach(([x, z]) => {
        ctx.strokeStyle = '#2b3240';
        Court3D.seg(ctx, cam, [x, 0, z], [x, 24, z], 0.5, 2);
        const p = Court3D.project(cam, [x, 24, z]);
        if (p) {
          const r = Math.min(26, Math.max(6, p.s * 2.2));
          const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
          gl.addColorStop(0, 'rgba(255,236,190,0.9)'); gl.addColorStop(0.15, 'rgba(255,220,160,0.35)'); gl.addColorStop(1, 'rgba(255,220,160,0)');
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2); ctx.fill();
        }
      });
    }
    function drawScorer(cam, w) {
      const O = w.off, A = w.arch;
      // close to the lens he'd fill the screen: fade him a touch
      const z = Court3D.toCam(cam, V.add(O.pos, [0, 3, 0]))[2];
      const alpha = clamp((z - 2.2) / 2.2, 0, 1);
      if (alpha < 0.05) return;
      const back = w.cam === 'rim' ? (O.face[0] * cam.f[0] + O.face[2] * cam.f[2]) > 0.2 : false;
      Court3D.drawFigure(ctx, cam, {
        pos: O.pos, face: O.face, pose: O.pose, lift: O.lift, scale: A.height, reach: A.big ? 1.1 : 1, lean: O.lean * 0.7,
        colors: { skin: O.skin, hair: O.hair, jersey: A.colors.jersey, shorts: A.colors.shorts, shoes: '#f4f4f4', trim: A.colors.trim },
        number: A.number, alpha, back
      });
    }
    function drawYou(cam, w) {
      const Y = w.you;
      const f = Court3D.dirToRim(Y.pos);
      let pose = Court3D.POSES.guard;
      if (Y.air) pose = Court3D.POSES.air;
      else if (w.rebound && w.rebound.boxing && !w.rebound.lost) pose = SC.POSES.box;
      else if (Math.hypot(Y.vel[0], Y.vel[2]) > 4) pose = S.t % 0.3 < 0.15 ? Court3D.POSES.run1 : Court3D.POSES.run2;
      const k = clamp((w.t - Y.airStart) / LockdownSim.YOU.airT, 0, 1);
      const lift = Y.air ? Math.sin(Math.PI * k) * LockdownSim.YOU.jump * Y.jumpK : 0;
      if (!S.youPose) S.youPose = Object.assign({}, pose);
      S.youPose = Court3D.blendPose(S.youPose, pose, 0.3);
      // right at the lens while the camera comes around: leave yourself out
      const z = Court3D.toCam(cam, V.add(Y.pos, [0, 3, 0]))[2];
      const alpha = clamp((z - 3) / 3, 0, 1);
      if (alpha < 0.05) return;
      Court3D.drawFigure(ctx, cam, {
        pos: Y.pos, face: f, pose: S.youPose, lift, scale: 1.02, alpha,
        colors: { skin: settings.skin, hair: '#1b1410', jersey: settings.jersey, shorts: settings.shorts, shoes: '#f4f4f4', trim: '#ffffff' },
        number: 5, back: true
      });
    }
    function drawGlassShooter(cam, w) {
      const G = w.glass;
      const shot = G.shot;
      const k = shot ? clamp((w.t - w.shotInfo.at + 0.2) / 0.5, 0, 1) : 0;
      Court3D.drawFigure(ctx, cam, {
        pos: G.shooter, face: Court3D.dirToRim(G.shooter), pose: shot && k < 1 ? Court3D.POSES.shoot : Court3D.POSES.stand, lift: shot ? Math.sin(Math.PI * k) * 1.6 : 0, scale: 1,
        colors: { skin: '#c68642', hair: '#1b1410', jersey: w.arch.colors.jersey, shorts: w.arch.colors.shorts, shoes: '#f4f4f4', trim: w.arch.colors.trim },
        number: 4
      });
    }
    function drawBallNow(cam, w) {
      const B = w.ball;
      if (B.state === 'away' && w.glass && !w.glass.shot) {
        Court3D.drawBall(ctx, cam, { p: V.add(w.glass.shooter, [0.4, 4.4, 0.6]), rot: 0 });
        return;
      }
      Court3D.drawShadow(ctx, cam, B.p, B.p[1]);
      Court3D.drawBall(ctx, cam, { p: B.p, rot: S.t * 7 });
    }
    // where the miss is coming down: a faint ring once you've had time to read it
    function drawLanding(cam, w) {
      const P = w.rebound.pred;
      if (!P || w.t - w.shotInfo.at < 0.6) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,102,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
      const q = [];
      for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2; q.push(Court3D.project(cam, [P.p[0] + Math.sin(a) * 1.6, 0.03, P.p[2] + Math.cos(a) * 1.6])); }
      if (q.every(Boolean)) { ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
      ctx.restore();
    }
    function drawSliceTrail() {
      if (!S.slices.length) return;
      ctx.save(); ctx.lineCap = 'round';
      S.slices.forEach(s => {
        const a = 1 - (S.t - s.t) / 0.22;
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`; ctx.lineWidth = 7 * a + 1;
        ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
      });
      ctx.restore();
    }
    /* Your hands, at the bottom corners. They lean with your weight, swipe
       with a slice, go up together on a jump, and up high when you wall up. */
    function drawHands(cam, w) {
      const Y = w.you;
      const fade = w.cam === 'rim' ? clamp(1 - (w.t - w.camAt) / 0.25, 0, 1) : 1;
      if (fade <= 0) return;
      const wt = clamp(Y.weight, -1, 1);
      const R = LockdownSim.rel(w);
      const near = clamp((4.5 - R.gap) / 3, -0.4, 1);
      let lx = CW * 0.16 + wt * CW * 0.07, rx = CW * 0.84 + wt * CW * 0.07, y = CH * (0.9 - near * 0.05), sz = Math.min(CW, CH) * 0.05;
      let ly = y, ry = y;
      const k = clamp((w.t - Y.airStart) / LockdownSim.YOU.airT, 0, 1);
      if (Y.air) { const h = Math.sin(Math.PI * k); ly = ry = y - h * CH * 0.42; lx = CW * 0.32 + Y.reachX * CW * 0.05; rx = CW * 0.68 + Y.reachX * CW * 0.05; }
      else if (Y.setT > 0.15) { ly = ry = y - CH * 0.18; lx = CW * 0.24; rx = CW * 0.76; }
      const H = S.handAnim;
      if (H && H.kind === 'slice' && S.t - H.t0 < 0.24) {
        const e = clamp((S.t - H.t0) / 0.14, 0, 1);
        const hx = H.from.x + (H.to.x - H.from.x) * e, hy = H.from.y + (H.to.y - H.from.y) * e;
        if (H.side > 0) { lx = hx; ly = hy; } else { rx = hx; ry = hy; }
      }
      if (Y.offBal > 0) { lx += Y.offDir * CW * 0.08; rx += Y.offDir * CW * 0.08; }
      ctx.save(); ctx.globalAlpha = fade;
      hand(lx, ly, sz, -1);
      hand(rx, ry, sz, 1);
      ctx.restore();
    }
    function hand(x, y, r, side) {
      const skin = settings.skin, edge = 'rgba(40,20,10,0.5)';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const stroke = (pts, wd, col) => { [[wd + 2.5, edge], [wd, col]].forEach(([lw, c]) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(x + px * r * side, y + py * r) : ctx.moveTo(x + px * r * side, y + py * r)); ctx.stroke(); }); };
      // forearm and sleeve coming up from the bottom corner
      stroke([[1.6, 6.5], [0.5, 2.2]], r * 1.5, settings.jersey);
      stroke([[0.55, 2.4], [0.1, 0.9]], r * 1.05, skin);
      // palm and fingers, spread toward him
      ctx.fillStyle = skin; ctx.strokeStyle = edge; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      [[-0.75, -0.55, -1.4, -1.5], [-0.3, -0.85, -0.45, -2.1], [0.15, -0.9, 0.3, -2.15], [0.55, -0.7, 0.95, -1.85], [0.8, 0.2, 1.6, -0.35]].forEach(([x0, y0, x1, y1]) => stroke([[x0, y0], [x1, y1]], r * 0.38, skin));
    }
    function drawPopups(cam) {
      S.popups.forEach(p => {
        const q = Court3D.project(cam, p.world);
        const k = p.t / p.life;
        let x = CW / 2, y = CH * 0.32;
        if (q && q.y > 70 && q.y < CH - 90) { x = q.x; y = q.y; }
        y -= k * 30;
        const a = k < 0.15 ? k / 0.15 : (k > 0.7 ? (1 - k) / 0.3 : 1);
        const sz = Math.round(Math.min(CW, CH) * 0.075 * p.size);
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = `800 ${sz}px "Big Shoulders Display", Impact, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, sz * 0.12); ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        const text = p.text.toUpperCase();
        x = clamp(x, sz * 2.4, CW - sz * 2.4);
        ctx.strokeText(text, x, y); ctx.fillStyle = p.color; ctx.fillText(text, x, y);
        ctx.restore();
      });
    }

    function setSettings(o) { Object.assign(settings, o || {}); }
    return { run, stop, destroy, setSettings, summary, get settings() { return settings; }, _S: S, _camera: camera, _ballScreen: () => ballScreen(camera()), _project: p => Court3D.project(camera(), p) };
  }

  return { create, SWAT_REPS, PICK_REPS };
})();
