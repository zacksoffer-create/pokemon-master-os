/* HoopsEngine: runs any basketball "spec" (a challenge described as data)
   inside a container. The Playground app and the School game both drive it.

   spec.kind:
     possessions  live reads vs defenders: { count, spots, defenders, shotClock, situation }
     rack         timed rack shooting:     { racks, perRack, money, time }
     horse        HORSE vs a computer:     { opponent: { name, skill, favorites, skin } }
     free         open shootaround:        { spot }
     shots        a fixed list of shots:   { shots: [{ spot, defender }], calibrate } */
const HoopsEngine = (() => {
  const { V, RIM } = Court3D;
  const FEEL = {
    arcade: { window: 0.17, aim: 6.5, label: 'Arcade' },
    normal: { window: 0.12, aim: 4.5, label: 'Normal' },
    pro: { window: 0.075, aim: 3.0, label: 'Pro' }
  };
  const RINGS = { three: ['lc', 'lw', 'top', 'rw', 'rc'], mid: ['lb', 'le', 'ft', 're', 'rb'], close: ['lbk', 'lane', 'rbk'] };

  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
.hx{position:absolute;inset:0;overflow:hidden;background:#0b0f18;color:#f3f1ea;font-family:"Barlow",system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.hx canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.hx-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 26px max(14px,env(safe-area-inset-left,0px));pointer-events:none;background:linear-gradient(rgba(6,8,12,.62),rgba(6,8,12,0))}
.hx-quit{pointer-events:auto;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,14,22,.55);color:#f3f1ea;font:600 18px/1 "Barlow",sans-serif;cursor:pointer}
.hx-quit:focus-visible,.hx-btn:focus-visible{outline:2px solid #ffb547;outline-offset:2px}
.hx-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.hx-title b{font:800 20px/1 "Big Shoulders Display",Impact,"Arial Narrow",sans-serif;letter-spacing:.04em;text-transform:uppercase}
.hx-title span{font:500 13px/1.25 "Barlow",sans-serif;opacity:.82}
.hx-score{text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.hx-score-n{display:block;font:800 40px/0.95 "Big Shoulders Display",Impact,sans-serif;font-variant-numeric:tabular-nums}
.hx-score small{font:600 11px/1.2 "Barlow",sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.hx-clock{position:absolute;left:50%;top:calc(58px + env(safe-area-inset-top,0px));transform:translateX(-50%);min-width:64px;padding:2px 12px;border-radius:8px;background:rgba(8,10,14,.72);border:1px solid rgba(255,181,71,.35);font:800 30px/1.1 "Big Shoulders Display",Impact,sans-serif;color:#ffb547;text-align:center;font-variant-numeric:tabular-nums;pointer-events:none}
.hx-clock.low{color:#ff5d4a;border-color:rgba(255,93,74,.6)}
.hx-chips{position:absolute;left:0;right:0;top:calc(104px + env(safe-area-inset-top,0px));display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:0 14px;pointer-events:none}
.hx-chip{padding:5px 10px;border-radius:999px;font:600 12px/1.1 "Barlow",sans-serif;letter-spacing:.03em;background:rgba(8,10,14,.7);border:1px solid rgba(255,255,255,.18)}
.hx-chip b{font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.hx-chip.open{color:#7ee2a8;border-color:rgba(126,226,168,.5)} .hx-helpchip{color:#b9c8ff;border-color:rgba(185,200,255,.45)} .hx-chip.mid{color:#ffd166;border-color:rgba(255,209,102,.5)} .hx-chip.hot{color:#ff7a66;border-color:rgba(255,122,102,.6)}
.hx-horse{position:absolute;left:50%;top:calc(58px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:flex;gap:14px;padding:6px 12px;border-radius:10px;background:rgba(8,10,14,.72);font:800 18px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:.12em;pointer-events:none;white-space:nowrap}
.hx-horse i{font-style:normal;opacity:.28} .hx-horse i.on{opacity:1;color:#ff7a66} .hx-horse span{font:600 11px/1 "Barlow",sans-serif;letter-spacing:.06em;opacity:.8;margin-right:6px;text-transform:uppercase}
.hx-banner{position:absolute;left:0;right:0;top:36%;text-align:center;pointer-events:none;padding:0 18px}
.hx-banner .k{display:block;font:600 13px/1.2 "Barlow",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffb547;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.hx-banner .h{display:block;font:800 clamp(30px,9vw,52px)/0.95 "Big Shoulders Display",Impact,sans-serif;text-transform:uppercase;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.75);text-wrap:balance}
.hx-banner .s{display:block;margin-top:6px;font:500 15px/1.3 "Barlow",sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.9);opacity:.92}
.hx-banner.pop{animation:hxpop .35s ease-out}
@keyframes hxpop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
.hx-hint{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);padding:7px 12px;border-radius:10px;background:rgba(8,10,14,.66);font:500 13px/1.35 "Barlow",sans-serif;text-align:center;pointer-events:none;color:#e8e4da}
.hx-card{position:absolute;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:14px 16px 12px;border-radius:14px;background:rgba(14,18,27,.94);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.5);animation:hxup .25s ease-out}
@keyframes hxup{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.hx-card .k{font:600 11px/1.2 "Barlow",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#ffb547}
.hx-card .w{margin-top:5px;font:600 16px/1.35 "Barlow",sans-serif}
.hx-card .r{display:flex;gap:10px;align-items:flex-start;margin-top:9px;font:400 14px/1.4 "Barlow",sans-serif;color:#cfd3dc}
.hx-grade{flex:none;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;font:800 22px/1 "Big Shoulders Display",Impact,sans-serif;color:#0b0f18;background:#7ee2a8}
.hx-grade.B{background:#c5e27e}.hx-grade.C{background:#ffd166}.hx-grade.D{background:#ff9a66}.hx-grade.F{background:#ff5d4a}
.hx-card .row{display:flex;justify-content:flex-end;margin-top:10px}
.hx-btn{pointer-events:auto;cursor:pointer;border:0;border-radius:10px;padding:10px 18px;background:#ffb547;color:#1a1206;font:800 15px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.hx-btn.ghost{background:transparent;color:#f3f1ea;border:1px solid rgba(255,255,255,.3)}
.hx-map{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:calc(70px + env(safe-area-inset-top,0px)) 16px calc(20px + env(safe-area-inset-bottom,0px));background:rgba(6,9,14,.82)}
.hx-map h3{margin:0;font:800 24px/1 "Big Shoulders Display",Impact,sans-serif;letter-spacing:.06em;text-transform:uppercase}
.hx-map p{margin:0;font:500 14px/1.35 "Barlow",sans-serif;opacity:.85;text-align:center;max-width:34ch}
.hx-map svg{width:min(92vw,440px);height:auto;max-height:52vh;touch-action:none;cursor:crosshair}
.hx-map .row{display:flex;gap:10px}
`;
    document.head.appendChild(st);
  }

  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const easeInOut = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function create(container, opts) {
    injectCss();
    const settings = Object.assign({ touchK: 1.75, feel: 'normal', showTags: true, rating: { shooting: 60, handle: 60 }, skin: '#c68642', sleeve: '#1e5b47', hints: true }, opts || {});
    const root = document.createElement('div');
    root.className = 'hx';
    root.innerHTML = `
      <canvas></canvas>
      <div class="hx-top"><button class="hx-quit" type="button" aria-label="Leave this game">&#x2715;</button><div class="hx-title"><b></b><span></span></div><div class="hx-score"><span class="hx-score-n">0</span><small></small></div></div>
      <div class="hx-clock" hidden></div>
      <div class="hx-horse" hidden></div>
      <div class="hx-chips"><div class="hx-chip hx-scout" hidden></div><div class="hx-chip hx-helpchip" hidden></div><div class="hx-chip hx-contest" hidden></div></div>
      <div class="hx-banner" hidden></div>
      <div class="hx-hint" hidden></div>
      <div class="hx-card" hidden></div>
      <div class="hx-map" hidden></div>`;
    container.appendChild(root);
    const $ = s => root.querySelector(s);
    const canvas = $('canvas'), ctx = canvas.getContext('2d');
    const ui = {
      title: $('.hx-title b'), sub: $('.hx-title span'), score: $('.hx-score-n'), scoreSub: $('.hx-score small'),
      clock: $('.hx-clock'), horse: $('.hx-horse'), scout: $('.hx-scout'), helpChip: $('.hx-helpchip'), contest: $('.hx-contest'),
      banner: $('.hx-banner'), hint: $('.hx-hint'), card: $('.hx-card'), map: $('.hx-map'), quit: $('.hx-quit')
    };
    let W = 360, H = 640, DPR = 1;

    const S = {
      spec: null, court: Court3D.COURTS.park, t: 0, running: false, raf: 0, last: 0, phase: 'idle',
      shooter: null, def: null, balls: [], popups: [], timers: [], net: { sway: 0, pull: 0, sx: 0, sz: 0 },
      meter: null, clock: null, gameClock: null, score: 0, makes: 0, attempts: 0, streak: 0, best: 0,
      log: [], zone: {}, poss: null, rack: null, horse: null, list: null, rand: Math.random, onEnd: null, onQuit: null,
      cpuTurn: null, calib: [], hintShown: 0, lastContestText: ''
    };

    function resize() {
      const r = root.getBoundingClientRect();
      W = Math.max(200, r.width); H = Math.max(300, r.height);
      DPR = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(root); else window.addEventListener('resize', resize);
    resize();

    // ---------- helpers ----------
    function after(sec, fn) { S.timers.push({ at: S.t + sec, fn }); }
    function banner(k, h, s, dur) {
      ui.banner.innerHTML = (k ? `<span class="k">${esc(k)}</span>` : '') + `<span class="h">${esc(h)}</span>` + (s ? `<span class="s">${esc(s)}</span>` : '');
      ui.banner.hidden = false;
      ui.banner.classList.remove('pop'); void ui.banner.offsetWidth; ui.banner.classList.add('pop');
      clearTimeout(banner._t);
      if (dur) banner._t = setTimeout(() => { ui.banner.hidden = true; }, dur * 1000);
    }
    function hideBanner() { clearTimeout(banner._t); ui.banner.hidden = true; }
    function hint(text) { ui.hint.textContent = text; ui.hint.hidden = !text; }
    function setTitle(a, b) { ui.title.textContent = a || ''; ui.sub.textContent = b || ''; }
    function setScore(n, sub) { ui.score.textContent = n; if (sub != null) ui.scoreSub.textContent = sub; }
    function popup(text, color, size, opt) {
      S.popups.push(Object.assign({ text, color: color || '#fff', size: size || 1, t: 0, life: 1.3, world: [RIM.x, RIM.y + 1.6, RIM.z] }, opt || {}));
    }
    function ratingFor(kind) { const r = settings.rating || {}; return r[kind] == null ? 60 : r[kind]; }

    function newShooter(pos) {
      return { pos: pos.slice(), from: null, to: null, moveT: 0, moveDur: 0, hasBall: true, reload: 0, jumpT: 9, fakeT: 9, catchT: 9, follow: 9 };
    }
    // ctrl bends the path (a drive goes around him, then to the rim)
    function moveShooter(dest, dur, ctrl) {
      const sh = S.shooter;
      sh.from = sh.pos.slice(); sh.to = dest.slice(); sh.ctrl = ctrl ? ctrl.slice() : null; sh.moveT = 0; sh.moveDur = dur;
    }
    function inBounds(p) { return Math.abs(p[0]) < 24.5 && p[2] > 0.6 && p[2] < 36 && Math.hypot(p[0] - RIM.x, p[2] - RIM.z) > 2.8; }

    // ---------- input ----------
    const detach = Gesture.attach(canvas, {
      down() { Sfx.unlock(); },
      gesture(g) {
        if (!S.running) return;
        if (g.type === 'flick') return onFlick(g);
        if (g.type === 'swipe') return onSwipe(g.dir, g);
        if (g.type === 'tap') return onTap(g);
      }
    });
    ui.quit.addEventListener('click', () => { Sfx.play('ui'); const q = S.onQuit; stop(); q && q(summary(true)); });
    ui.card.addEventListener('click', e => { if (e.target.closest('button') && S.cardNext) { const f = S.cardNext; S.cardNext = null; f(); } });

    function moveProgress() { return S.move ? Math.min(1, (S.t - S.move.t0) / S.move.dur) : 1; }
    function canShoot() {
      const sh = S.shooter;
      if (!sh || !sh.hasBall || sh.reload > 0) return false;
      if (S.phase === 'live' || S.phase === 'faking') return true;
      // you can rise up in stride: a pull-up a step into the drive, a layup at the end of it
      if (S.phase === 'moving') return moveProgress() > (S.move && S.move.kind === 'drive' ? 0.1 : 0.2);
      return false;
    }
    // A move you make while another is still happening isn't dropped: it goes
    // next, as soon as your feet are set.
    function queue(q) { q.at = S.t; S.queued = q; }
    function flushQueue() {
      const q = S.queued; S.queued = null;
      if (!q || S.t - q.at > 0.5 || S.phase !== 'live' || !S.shooter || !S.shooter.hasBall) return;
      if (q.flick) return shoot(q.flick);
      if (q.dir) return dribbleMove(q.dir, q.g);
      if (q.tap) return pumpFake();
    }
    function startMove(kind, side, dur, phase) {
      const id = (S.moveId || 0) + 1;
      S.moveId = id;
      S.move = { kind, side, t0: S.t, dur };
      S.phase = phase || 'moving';
      after(dur, () => {
        if (S.moveId !== id || (S.phase !== 'moving' && S.phase !== 'faking')) return;
        S.lastMove = { kind, side, end: S.t };
        S.phase = 'live'; S.move = null;
        flushQueue();
      });
    }
    function onFlick(g) {
      if (canShoot()) return shoot(g);
      const sh = S.shooter;
      if (sh && ((sh.hasBall && (S.phase === 'moving' || S.phase === 'faking')) || S.phase === 'catch')) queue({ flick: g });
    }
    function onSwipe(dir, g) {
      const k = S.spec && S.spec.kind;
      if (k === 'free' && S.phase === 'live') return freeMove(dir === 'downleft' ? 'left' : dir === 'downright' ? 'right' : dir);
      if (S.def && S.phase === 'catch') return queue({ dir, g });
      if (!S.def || !S.shooter || !S.shooter.hasBall) return;
      if (S.phase === 'live') return dribbleMove(dir, g);
      // snapping back the other way mid-move cancels it: that's the crossover
      const lateral = dir === 'left' || dir === 'right';
      if (S.phase === 'moving' && S.move && lateral && S.move.side && (dir === 'left' ? -1 : 1) !== S.move.side && moveProgress() > 0.3) return dribbleMove(dir, g);
      // on the way to the rim past your man, a sideways swipe euro-steps right away
      if (S.phase === 'moving' && S.move && lateral && S.move.kind === 'drive' && S.def.state === 'beaten' && moveProgress() > 0.15 && Math.hypot(S.shooter.pos[0] - RIM.x, S.shooter.pos[2] - RIM.z) < 10.5) return dribbleMove(dir, g);
      if (S.phase === 'moving' || S.phase === 'faking' || S.phase === 'catch') queue({ dir, g });
    }
    function onTap() {
      const k = S.spec && S.spec.kind;
      if (k === 'free' && S.phase === 'live' && S.shooter.hasBall) return openMap('Move to a new spot', 'Tap anywhere on the half court.', p => { placeShooter(p); S.phase = 'live'; });
      if (S.def && S.phase === 'catch') return queue({ tap: true });
      if (!S.def || !S.shooter || !S.shooter.hasBall) return;
      if (S.phase === 'live') return pumpFake();
      if (S.phase === 'moving') queue({ tap: true });
    }

    // ---------- moves ----------
    // A long swipe drives, a short one jabs, and on the way to the rim after a
    // blow-by a sideways swipe is a euro step.
    function dribbleMove(dir, g) {
      if (dir === 'down') return stepBack();
      if (dir === 'downleft' || dir === 'downright') return sideStep(dir === 'downleft' ? -1 : 1);
      if (dir !== 'left' && dir !== 'right') return;
      const side = dir === 'left' ? -1 : 1;
      const sh = S.shooter;
      const dist = Math.hypot(sh.pos[0] - RIM.x, sh.pos[2] - RIM.z);
      if (dist < 10.5 && S.def.state === 'beaten') return euroStep(side);
      if (g && Math.abs(g.dx) < Math.max(46, W * 0.14)) return jabStep(side);
      return driveMove(side);
    }
    function jabStep(side) {
      const sh = S.shooter;
      const r = Defense.jab(S.def, side, S.rand);
      sh.jabT = 0; sh.jabSide = side;
      Sfx.play('dribble');
      S.poss.actions.push(`jabbed ${side < 0 ? 'left' : 'right'}${r.bit ? ' and he shifted' : ''}`);
      popup(r.bit ? 'He shifted' : 'Jab', r.bit ? '#7ee2a8' : '#f3f1ea', 0.7, { world: V.add(S.def.pos, [0, 7.4, 0]), life: 0.9 });
      startMove('jab', side, 0.24);
    }
    function euroStep(side) {
      const sh = S.shooter, pol = Court3D.polarOf(sh.pos);
      let dest = Court3D.polar(Math.max(-100, Math.min(100, pol.angle + side * 17)), Math.max(2.8, pol.dist - 1.4));
      if (!inBounds(dest)) dest = sh.pos.slice();
      // the long sideways step buys a beat before he can recover
      S.def.stateT = Math.max(0, S.def.stateT - 0.35);
      S.poss.actions.push('euro-stepped');
      Sfx.play('dribble');
      popup('Euro', '#7ee2a8', 0.8, { world: V.add(dest, [0, 7.5, 0]), life: 0.9 });
      moveShooter(dest, 0.26);
      startMove('euro', side, 0.26);
    }
    function driveMove(side) {
      const sh = S.shooter, d = S.def;
      const res = Defense.drive(d, side, ratingFor('handle'), S.rand);
      const pol = Court3D.polarOf(sh.pos);
      Sfx.play('dribble');
      if (res.steal) return turnover('Stolen', 'drove into him and got stripped', V.add(d.pos, [0, 6, 0]));
      let dest;
      if (res.win) {
        // with help behind him you're attacking the rim: when you flick on the
        // way decides the shot (pull-up early, floater midway, layup at the rim)
        const nd = S.help ? 3.4 : Math.max(3.3, Math.min(pol.dist * 0.34, 7));
        let na = pol.angle + side * (S.help ? 14 : 24);
        na = Math.max(-100, Math.min(100, na));
        dest = Court3D.polar(na, nd);
        S.poss.beatHim = true;
        const crossed = res.why === 'Caught him leaning';
        S.poss.actions.push(crossed ? `crossed him going ${side < 0 ? 'left' : 'right'}` : `drove ${side < 0 ? 'left' : 'right'} and beat him`);
        const at = V.add(sh.pos, V.add(V.mul(Court3D.dirToRim(sh.pos), 5), [0, 6.5, 0]));
        popup(crossed ? 'Crossed him' : 'Blow-by', '#7ee2a8', 0.9, { world: at });
        if (res.why && !crossed) popup(res.why, '#cfe9da', 0.5, { world: V.add(at, [0, -1.1, 0]), life: 1.4 });
        if (!S.layupHint && settings.hints) { S.layupHint = true; hint('Flick to finish. Near the rim, swipe sideways to euro step, or curl your flick to put spin on it.'); }
      } else {
        dest = Court3D.polar(Math.max(-100, Math.min(100, pol.angle + side * 7)), Math.max(3.5, pol.dist - 2));
        S.poss.actions.push(`drove ${side < 0 ? 'left' : 'right'} and got cut off`);
        const at = V.add(d.pos, [0, 6.8, 0]);
        popup('Cut off', '#ff9a66', 0.9, { world: at });
        if (res.why) popup(res.why, '#f3d2c4', 0.5, { world: V.add(at, [0, -1.1, 0]), life: 1.4 });
        Sfx.buzz(25);
      }
      if (!inBounds(dest)) dest = sh.pos.slice();
      const dur = res.win ? (S.help ? 0.72 : 0.5) : 0.32;
      let ctrl = null;
      if (res.win && S.help) {
        const dr = Court3D.dirToRim(sh.pos);
        ctrl = V.add(V.add(sh.pos, V.mul([-dr[2], 0, dr[0]], side * 4.2)), V.mul(dr, pol.dist * 0.32));
      }
      moveShooter(dest, dur, ctrl);
      startMove('drive', side, dur);
      S.move.win = res.win;
      if (res.win && S.help) Help.engage(S.help);
    }
    function stepBack() {
      const sh = S.shooter;
      const dir = Court3D.dirToRim(sh.pos);
      const dest = V.sub(sh.pos, V.mul(dir, 3.2));
      if (!inBounds(dest)) return;
      S.poss.actions.push('stepped back');
      Sfx.play('dribble');
      // he has to see it before he can chase it; heavy feet see it late
      if (S.def) S.def.stuck = Math.max(S.def.stuck || 0, 0.1 + (1 - S.def.arch.lateral) * 0.28);
      moveShooter(dest, 0.28);
      startMove('step', 0, 0.28);
    }
    // A hop sideways and a little back. Going away from where his weight is
    // leaves him planted for a beat.
    function sideStep(side) {
      const sh = S.shooter, d = S.def;
      const dir = Court3D.dirToRim(sh.pos), lat = [-dir[2], 0, dir[0]];
      const dest = V.sub(V.add(sh.pos, V.mul(lat, side * 3.4)), V.mul(dir, 0.7));
      if (!inBounds(dest)) return;
      const against = (d.momSide || 0) * side < -0.12;
      if (against) d.stuck = 0.32;
      S.poss.actions.push(`side-stepped ${side < 0 ? 'left' : 'right'}${against ? ' away from his lean' : ''}`);
      Sfx.play('dribble');
      moveShooter(dest, 0.3);
      startMove('side', side, 0.3);
    }
    function pumpFake() {
      const sh = S.shooter;
      sh.fakeT = 0;
      const helpBit = Help.pumpFake(S.help, sh.pos, S.rand);
      const bit = !helpBit && S.def.state !== 'beaten' && Defense.pumpFake(S.def, sh.pos, S.rand);
      S.poss.actions.push(helpBit ? `pump-faked and ${S.help.type.name} flew by` : bit ? 'pump-faked and he bit' : 'pump-faked and nobody bit');
      if (helpBit) popup('He bit', '#7ee2a8', 0.9, { world: V.add(S.help.pos, [0, 8, 0]) });
      else if (bit) popup('He bit', '#7ee2a8', 0.9, { world: V.add(S.def.pos, [0, 7.5, 0]) });
      startMove('fake', 0, 0.34, 'faking');
    }
    function freeMove(dir) {
      const cur = S.freeRing || 'three';
      if (dir === 'down') {
        S.freeRing = cur === 'close' ? 'mid' : cur === 'mid' ? 'three' : 'close';
        S.freeIdx = Math.min(S.freeIdx, RINGS[S.freeRing].length - 1);
      } else {
        const ring = RINGS[cur];
        S.freeIdx = (S.freeIdx + (dir === 'left' ? -1 : 1) + ring.length) % ring.length;
      }
      const sp = Court3D.spotInfo(S.court, RINGS[S.freeRing][S.freeIdx]);
      moveShooter(sp.pos, 0.35);
      S.phase = 'moving';
      setTitle(S.spec.title || 'Shootaround', sp.label);
      after(0.35, () => { if (S.phase === 'moving') S.phase = 'live'; });
    }

    // ---------- shooting ----------
    /* What kind of jumper this is comes from what your feet were doing when
       you flicked: driving (pull-up), stepping back, side-stepping, or a flick
       with a dip in it (fadeaway). Each trades a little touch for space. */
    const JUMPERS = {
      pullup: { label: 'Pull-up', w: 0.9 },
      stepback: { label: 'Step-back', w: 1, moving: 0.9 },
      sidestep: { label: 'Side-step', w: 1, moving: 0.9 },
      fade: { label: 'Fadeaway', w: 0.8, contest: 0.55 }
    };
    function jumperKind(g, dist) {
      if (S.cpuTurn || S.ftMode || (S.list && S.spec.calibrate)) return null;
      if (g.fade && dist >= 6) return 'fade';
      if (dist < 11) return null;
      const m = S.phase === 'moving' ? S.move : null;
      const recent = S.lastMove && S.t - S.lastMove.end < 0.45 ? S.lastMove.kind : null;
      if (m && m.kind === 'drive') return 'pullup';
      if ((m && m.kind === 'step') || (!m && recent === 'step')) return 'stepback';
      if ((m && m.kind === 'side') || (!m && recent === 'side')) return 'sidestep';
      return null;
    }
    function shoot(g) {
      const sh = S.shooter;
      const pos = sh.pos.slice();
      const dist = Math.hypot(pos[0] - RIM.x, pos[2] - RIM.z);
      const kind = jumperKind(g, dist);
      const J = kind ? JUMPERS[kind] : null;
      const moving = S.phase === 'moving';
      const hkind = helpKind(kind, dist);
      if (S.help && hkind === 'layup' && Help.charge(S.help, pos, 2.6)) return turnover('Charge', `went right into ${S.help.type.name}`, V.add(S.help.pos, [0, 7, 0]));
      let onBall = S.def ? Defense.contest(S.def, pos) : 0;
      const fouled = !!(S.def && Defense.foulable(S.def, pos));
      if (fouled) onBall = 0;
      if (J && J.contest) onBall *= J.contest;
      let helpC = S.help ? Help.contest(S.help, pos, hkind) : 0;
      if (J && J.contest) helpC *= J.contest;
      let contest = Math.max(onBall, helpC);
      const feel = FEEL[settings.feel] || FEEL.normal;
      const rating = S.cpuTurn ? 60 : ratingFor('shooting');
      const fatigue = S.spec.fatigue || 0;
      const moveK = J ? (moving && J.moving ? J.moving : J.w) : (moving && dist >= 11 ? 0.82 : 1);
      const spin = dist < 11 && kind !== 'fade' ? HoopPhysics.spinFromCurl(g.curl) : { touch: 0 };
      let w = feel.window * (1 + (rating - 60) / 160) * (dist < 6 ? 1.35 : dist > 22 ? 0.86 : 1) * (1 - 0.5 * contest) * moveK * (1 - fatigue * 0.35) * (1 + 0.3 * spin.touch);
      const calibrating = S.list && S.spec.calibrate;
      const touchK = calibrating ? g.power / HoopPhysics.idealFlick(dist) : settings.touchK;
      if (calibrating) S.calib.push(g.power / HoopPhysics.idealFlick(dist));
      // you rise from where your feet are; the move stops here
      if (moving) { sh.to = null; S.move = null; S.moveId = (S.moveId || 0) + 1; }
      const shot = HoopPhysics.shoot({ shooter: pos, flickSpeed: g.power, angle: g.angle, curl: g.curl, fade: kind === 'fade', touchK, court: S.court, window: w, aimDead: feel.aim, contest, rating, fatigue, rand: S.rand });
      if (J) {
        shot.feedback = J.label + ' · ' + shot.feedback;
        popup(J.label, '#f3f1ea', 0.62, { world: V.add(shot.release, [0, 1.3, 0]), life: 0.9 });
        if (kind === 'fade') sh.fadeT = 0;
      }
      const block = Math.max(S.def && !fouled ? Defense.blockChance(S.def, onBall, shot.type.id) : 0, S.help ? Help.blockChance(S.help, helpC, hkind) : 0);
      if (S.help) Help.reactToShot(S.help, pos);
      launch(shot, { contest, fouled, dist, by: 'you', variant: J ? J.label : null, block, helpC, helpKind: hkind });
      S.meter = { shot, t: 0, calibrating };
    }
    // the kind of finish, as help defense sees it
    function helpKind(kind, dist) {
      if (kind === 'fade') return 'fade';
      if (kind) return 'pullup';
      if (dist < 5.5) return S.lastMove && S.lastMove.kind === 'euro' && S.t - S.lastMove.end < 0.6 ? 'euro' : 'layup';
      if (dist < 11) return 'floater';
      return 'jumper';
    }
    function launch(shot, info) {
      const sh = S.shooter;
      const held = heldBallScreen();
      const three = Court3D.isThree(S.court, sh.pos);
      const kind = S.spec.kind;
      const money = kind === 'rack' && !!S.spec.money && !!S.rack && S.rack.ball === S.spec.perRack - 1;
      const ft = kind === 'possessions' && S.ftMode;
      const ball = HoopPhysics.newBall(shot.release, shot.vel, {
        appear: 0.13, sx: held.x, sy: held.y, sr: held.r, trail: [], money,
        touch: shot.touch || 0, spinOut: shot.spinOut || 0, spin: shot.touch || shot.spinOut ? -(shot.spinDir || 1) * (16 + 14 * (shot.touch || 0)) : -9,
        info: Object.assign({ three, ft, zone: Court3D.zoneOf(S.court, sh.pos), type: shot.type.id, green: shot.green, pos: sh.pos.slice(), poss: S.poss ? S.poss.i : null }, info)
      });
      if (S.def && !info.fouled && info.by === 'you') {
        const bc = info.block != null ? info.block : Defense.blockChance(S.def, info.contest, shot.type.id);
        if (S.rand() < bc) ball.blockAt = 0.15;
      }
      S.balls.push(ball);
      sh.hasBall = false; sh.jumpT = 0; sh.follow = 0; S.queued = null;
      if (S.def) Defense.reactToShot(S.def, sh.pos);
      if (S.poss && !ft) { S.poss.contest = info.contest; S.poss.fouled = info.fouled; S.poss.shotType = shot.type.label; S.poss.variant = info.variant || null; S.poss.three = three; S.poss.dist = shot.dist; S.poss.helpC = info.helpC || 0; S.poss.helpKind = info.helpKind || null; }
      if (info.by === 'you') { S.attempts++; S.zone[ball.info.zone] = S.zone[ball.info.zone] || [0, 0]; S.zone[ball.info.zone][1]++; }
      Sfx.play('release');
      if (kind === 'possessions' || kind === 'shots' || kind === 'horse') S.phase = 'flight';
      if (kind === 'rack') S.rackShot = true;
      hint('');
      return ball;
    }

    function onBallResult(b) {
      const info = b.info;
      const made = b.result === 'made' && !b.blocked;
      const kind = S.spec.kind;
      let pts = 0;
      if (kind === 'rack') pts = made ? (b.money ? 2 : 1) : 0;
      else if (info.ft) pts = made ? 1 : 0;
      else if (kind === 'possessions') pts = made ? (info.three ? 3 : 2) + (info.fouled ? 1 : 0) : 0;
      else pts = made ? 1 : 0;
      if (info.by === 'you') {
        if (made) {
          S.makes++; S.streak++; S.best = Math.max(S.best, S.streak);
          S.zone[info.zone][0]++;
        } else S.streak = 0;
        S.score += kind === 'horse' || kind === 'free' || kind === 'shots' ? (made ? 1 : 0) : pts;
      }
      // feedback
      const at = [RIM.x, RIM.y + 1.7, RIM.z];
      if (b.blocked) { /* already announced */ }
      else if (made) {
        if (b.swish) popup('Swish', '#ffffff', 1.25, { world: at });
        else if (b.rimHits >= 2) popup('Rattled in', '#ffd166', 1.05, { world: at });
        else if (b.boardHits && !b.rimHits) popup('Off the glass', '#ffd166', 1.0, { world: at });
        else popup('Good', '#ffffff', 1.05, { world: at });
        if (kind === 'possessions' || kind === 'rack') popup('+' + pts, info.three || b.money ? '#ffb547' : '#7ee2a8', 1.5, { world: [RIM.x, RIM.y + 3.4, RIM.z], life: 1.1 });
        if (info.fouled) popup('And one', '#ffb547', 1.1, { world: [RIM.x, RIM.y - 1, RIM.z] });
        if (info.by === 'you' && S.streak === 3) popup('Heating up', '#ff9a3c', 1.1, { world: [RIM.x, RIM.y + 5, RIM.z] });
        if (info.by === 'you' && S.streak === 5) popup('On fire', '#ff6a2a', 1.3, { world: [RIM.x, RIM.y + 5, RIM.z] });
        if (info.three || b.swish) Sfx.play('cheer');
        Sfx.buzz(18);
      } else {
        const airball = b.rimHits === 0 && b.boardHits === 0;
        popup(airball ? 'Airball' : (b.rimHits ? 'Rimmed out' : 'Miss'), '#ff9a66', 1.0, { world: at });
        if (airball) Sfx.play('groan');
      }
      updateScoreUi();
      if (kind === 'possessions') possessionBallDone(b, made, pts);
      else if (kind === 'shots') listBallDone(b, made);
      else if (kind === 'horse') horseBallDone(b, made);
      else if (kind === 'rack') { if (S.rackDone && !S.balls.some(x => !x.result)) after(1.0, endSession); }
    }

    function updateScoreUi() {
      const k = S.spec.kind;
      if (k === 'possessions') setScore(S.score, 'points');
      else if (k === 'rack') setScore(S.score, 'points');
      else if (k === 'free') setScore(S.attempts ? Math.round(S.makes / S.attempts * 100) + '%' : '0%', `${S.makes} of ${S.attempts}`);
      else if (k === 'shots') setScore(`${S.makes}/${S.attempts}`, 'made');
      else if (k === 'horse') setScore('', '');
    }

    // ---------- possessions ----------
    function pickFrom(list, prev) {
      const pool = list.filter(x => x !== prev);
      return (pool.length ? pool : list)[Math.floor(S.rand() * (pool.length ? pool.length : list.length))];
    }
    function startPossession(i) {
      const spec = S.spec;
      if (i >= spec.count) return endSession();
      const spots = spec.spots && spec.spots.length ? spec.spots : ['lw', 'rw', 'top', 'lc', 'rc', 'le', 're', 'lb', 'rb'];
      const defs = spec.defenders === 'none' ? [null] : (spec.defenders && spec.defenders.length ? spec.defenders : Defense.IDS);
      const plan = spec.plan && spec.plan[i];
      const spotId = plan && plan.spot ? plan.spot : pickFrom(spots, S.poss && S.poss.spotId);
      const archId = plan && plan.defender !== undefined ? plan.defender : pickFrom(defs, S.poss && S.poss.archId);
      const sp = Court3D.spotInfo(S.court, spotId);
      const helpId = archId ? pickHelp(spec, plan, i) : null;
      S.poss = { i, spotId, spotLabel: sp.label, archId, helpId, actions: [], contest: null, beatHim: false, fouled: false, points: 0, ftLeft: 0, ftMade: 0 };
      S.shooter = newShooter(sp.pos);
      S.shooter.hasBall = false;
      S.def = archId ? Defense.create(archId, sp.pos, S.rand) : null;
      S.help = helpId ? Help.create(helpId, sp.pos, S.rand) : null;
      S.balls = [];
      S.phase = 'intro';
      S.clock = null; ui.clock.hidden = true;
      setTitle(spec.title || 'Read & React', `Possession ${i + 1} of ${spec.count} · ${sp.label}`);
      const a = S.def ? S.def.arch : null;
      const showTag = a && (spec.showTags != null ? spec.showTags : settings.showTags);
      if (showTag) { ui.scout.innerHTML = `<b>${esc(a.name)}</b> · ${esc(a.tag)}`; ui.scout.hidden = false; } else ui.scout.hidden = true;
      const ht = S.help ? S.help.type : null;
      if (ht && showTag) { ui.helpChip.innerHTML = `Help: <b>${esc(ht.name)}</b>`; ui.helpChip.hidden = false; } else ui.helpChip.hidden = true;
      const situation = plan && plan.situation ? plan.situation : spec.situation;
      const sub = a ? (showTag ? a.tell : 'Watch what he gives you.') : sp.label;
      banner(situation || `Possession ${i + 1}`, a ? (showTag ? a.name : 'Read him') : 'Open look', ht ? (showTag ? `${sub} Help behind him: ${ht.name}.` : `${sub} There's help behind him.`) : sub, ht ? 1.6 : 1.25);
      after(S.help ? 1.5 : 1.15, () => {
        S.phase = 'catch';
        S.shooter.catchT = 0;
        Sfx.play('dribble');
        after(0.32, () => {
          S.shooter.hasBall = true;
          S.phase = 'live';
          S.move = null;
          S.clock = spec.shotClock || null;
          if (S.clock) ui.clock.hidden = false;
          if (settings.hints && S.help && !S.helpHint) {
            S.helpHint = true;
            hint('Beat your man and the help comes. Flick early for a pull-up, midway for a floater, at the rim for a layup.');
          } else if (settings.hints && S.hintShown < 2) {
            S.hintShown++;
            hint(S.def ? 'Flick up to shoot · Swipe to drive, a short swipe jabs · Swipe down to step back · Tap to pump fake' : 'Flick up to shoot');
          }
          flushQueue();
        });
      });
    }
    // Help comes in some possessions: spec.help is 'none', 'mix', 'always', or a list of help types.
    function pickHelp(spec, plan, i) {
      if (plan && plan.help !== undefined) return plan.help;
      const mode = spec.help || 'none';
      if (mode === 'none') return null;
      const pool = Array.isArray(mode) ? mode : (spec.helpTypes && spec.helpTypes.length ? spec.helpTypes : Help.IDS);
      if (mode === 'mix' && (i === 0 || S.rand() > (spec.helpRate || 0.5))) return null;
      return pickFrom(pool, S.lastHelpId) || null;
    }
    // Turnovers that end the possession on the spot: steals, charges.
    function turnover(kind, text, at) {
      const sh = S.shooter;
      S.poss.turnover = kind;
      S.poss.actions.push(text);
      sh.hasBall = false; sh.to = null; S.move = null; S.moveId = (S.moveId || 0) + 1; S.queued = null;
      popup(kind, '#ff7a66', 1.2, { world: at });
      Sfx.play(kind === 'Charge' ? 'whistle' : 'bad'); Sfx.buzz(60);
      S.phase = 'resolving';
      after(0.9, finishPossession);
    }
    function possessionBallDone(b, made, pts) {
      const P = S.poss;
      if (!P) return;
      P.points += pts;
      if (b.info.ft) {
        P.ftMade += made ? 1 : 0;
        P.ftLeft--;
        after(1.0, () => P.ftLeft > 0 ? setupFreeThrow() : finishPossession());
        return;
      }
      P.made = made; P.blocked = !!b.blocked; P.swish = !!b.swish;
      P.actions.push(`${P.variant ? P.variant.toLowerCase() + ' ' : ''}${P.three ? 'three' : (P.shotType || 'shot').toLowerCase()}${made ? ' made' : (b.blocked ? ' blocked' : ' missed')}`);
      if (P.fouled) { P.ftLeft = made ? 1 : 2; after(1.0, setupFreeThrow); return; }
      after(0.9, finishPossession);
    }
    function setupFreeThrow() {
      const P = S.poss;
      const sp = Court3D.spotInfo(S.court, 'ft');
      S.shooter = newShooter(sp.pos);
      S.def = null; ui.contest.hidden = true;
      S.phase = 'live';
      banner('Free throw', `${P.ftLeft} to shoot`, '', 1.0);
      S.ftMode = true;
    }
    function narrate(P) {
      const parts = [];
      const acts = P.actions.slice();
      const shotAct = acts.length && /made|missed|blocked/.test(acts[acts.length - 1]) ? acts.pop() : null;
      if (acts.length) parts.push('You ' + acts.join(', then ') + '.');
      if (P.turnover) parts.push(P.turnover === 'Shot clock' ? 'Shot clock violation.' : P.turnover === 'Charge' ? 'Offensive foul. He had his feet set.' : 'Turnover.');
      else if (shotAct) {
        const lab = Defense.contestLabel(P.contest || 0).text.toLowerCase();
        const name = P.variant ? (P.three ? `${P.variant} three` : P.variant === 'Fadeaway' ? 'Fadeaway' : `${P.variant} jumper`) : (P.three ? 'Three' : P.shotType || 'Shot');
        parts.push(`${name}, ${lab}: ${P.blocked ? 'blocked' : (P.made ? 'made' : 'missed')}.`);
      }
      if (P.fouled) parts.push(`Fouled. Free throws ${P.ftMade} of ${P.made ? 1 : 2}.`);
      parts.push(P.points ? `+${P.points}` : 'No points.');
      return parts.join(' ');
    }
    function finishPossession() {
      const P = S.poss;
      if (!P || P.finished) return;
      P.finished = true;
      S.ftMode = false;
      S.clock = null; ui.clock.hidden = true; ui.contest.hidden = true; hint('');
      const grade = Defense.grade({ turnover: P.turnover, fouled: P.fouled, blocked: P.blocked, contest: P.contest, beatHim: P.beatHim });
      P.grade = grade;
      const a = P.archId ? Defense.ARCHETYPES[P.archId] : null;
      const ht = P.helpId ? Help.TYPES[P.helpId] : null;
      const helpRead = ht && (P.helpSeen || P.beatHim);
      S.log.push({ spot: P.spotId, arch: P.archId, help: P.helpId || null, helpSeen: !!helpRead, points: P.points, grade, made: !!P.made, contest: P.contest, actions: P.actions, turnover: P.turnover || null });
      if (P.helpId) S.lastHelpId = P.helpId;
      S.phase = 'card';
      const lesson = helpRead ? `Help: ${ht.name}. ${ht.read}` : a ? a.read + (ht ? ` Then read the help: ${ht.name}.` : '') : 'Nobody on you. Take your time and find your touch.';
      ui.card.innerHTML = `<div class="k">Possession ${P.i + 1} · ${a ? esc(a.name) : 'Open'}${ht ? ` + ${esc(ht.name)}` : ''}</div><div class="w">${esc(narrate(P))}</div>
        <div class="r"><span class="hx-grade ${grade}">${grade}</span><span>${esc(lesson)}</span></div>
        <div class="row"><button class="hx-btn" type="button">${P.i + 1 >= S.spec.count ? 'See results' : 'Next possession'}</button></div>`;
      ui.card.hidden = false;
      ui.scout.hidden = true; ui.helpChip.hidden = true;
      if (grade === 'A') Sfx.play('great'); else if (grade === 'B') Sfx.play('good');
      const next = () => { ui.card.hidden = true; startPossession(P.i + 1); };
      S.cardNext = next;
    }

    // ---------- shot list (free throws, calibration, school drills) ----------
    function startListShot(i) {
      const L = S.list;
      if (i >= L.length) return endSession();
      S.listIdx = i;
      const item = L[i];
      const sp = Court3D.spotInfo(S.court, item.spot || 'ft');
      S.shooter = newShooter(item.pos || sp.pos);
      S.def = item.defender ? Defense.create(item.defender, S.shooter.pos, S.rand) : null;
      S.poss = item.defender ? { i, actions: [], spotId: item.spot } : null;
      S.phase = 'live';
      setTitle(S.spec.title || 'Shooting', item.label || `${sp.label} · ${i + 1} of ${L.length}`);
      if (S.spec.calibrate && i === 0) { banner('Find your touch', 'Three free throws', 'Flick up the way that feels natural. These set your touch.', 2.6); hint('Flick up toward the hoop'); }
      else if (S.spec.calibrate) hint('');
      else if (i === 0 && settings.hints) hint('Flick up to shoot');
    }
    function listBallDone(b, made) {
      after(0.9, () => startListShot(S.listIdx + 1));
    }

    // ---------- rack (3-point contest) ----------
    function startRack() {
      const spec = S.spec;
      S.rack = { idx: 0, ball: 0 };
      const sp = Court3D.spotInfo(S.court, spec.racks[0]);
      S.shooter = newShooter(sp.pos);
      S.def = null;
      S.gameClock = spec.time;
      S.rackDone = false;
      ui.clock.hidden = false;
      setTitle(spec.title || '3-Point Contest', `Rack 1 · ${sp.label}`);
      S.phase = 'intro';
      banner('Rack 1 of ' + spec.racks.length, 'Ready', 'Last ball on each rack is the money ball. Two points.', 1.3);
      after(1.3, () => { S.phase = 'live'; hint(settings.hints ? 'Flick fast. You can let the next one go before the last one lands.' : ''); });
    }
    function rackAfterShot() {
      const spec = S.spec, R = S.rack, sh = S.shooter;
      R.ball++;
      if (R.ball < spec.perRack) { sh.reload = 0.24; after(0.24, () => { sh.hasBall = true; }); return; }
      if (R.idx < spec.racks.length - 1) {
        R.idx++; R.ball = 0;
        const sp = Court3D.spotInfo(S.court, spec.racks[R.idx]);
        moveShooter(sp.pos, 0.55);
        S.phase = 'moving';
        setTitle(spec.title || '3-Point Contest', `Rack ${R.idx + 1} · ${sp.label}`);
        after(0.55, () => { S.phase = 'live'; sh.hasBall = true; });
      } else { S.rackDone = true; S.phase = 'waiting'; if (!S.balls.some(x => !x.result)) after(1.2, endSession); }
    }

    // ---------- HORSE ----------
    function horseUi() {
      const H5 = S.horse, w = S.spec.word || 'HORSE';
      const row = (who, n) => `<div><span>${esc(who)}</span>${w.split('').map((c, i) => `<i class="${i < n ? 'on' : ''}">${c}</i>`).join('')}</div>`;
      ui.horse.innerHTML = row('You', H5.letters.you) + row(S.spec.opponent.short || S.spec.opponent.name.split(' ')[0], H5.letters.cpu);
      ui.horse.hidden = false;
    }
    function startHorse() {
      const opp = S.spec.opponent;
      S.horse = { setter: 'you', stage: 'set', letters: { you: 0, cpu: 0 }, spot: null, shots: 0, history: [] };
      S.def = null;
      setTitle(S.spec.title || 'HORSE', `vs ${opp.name}`);
      horseUi();
      banner('HORSE', `vs ${opp.name}`, opp.blurb || 'Make it, and they have to match it.', 1.8);
      after(1.8, horseTurn);
    }
    function horseTurn() {
      const H5 = S.horse, opp = S.spec.opponent;
      horseUi();
      if (H5.setter === 'you' && H5.stage === 'set') {
        S.cpuTurn = null;
        openMap('Your shot', 'Pick a spot. If you make it, ' + (opp.short || opp.name.split(' ')[0]) + ' has to match.', p => {
          H5.spot = p; placeShooter(p); S.phase = 'live';
          setTitle('Your shot', describeSpot(p));
          hint('Flick up to shoot');
        });
      } else if (H5.setter === 'you' && H5.stage === 'match') {
        cpuShoot('match');
      } else if (H5.setter === 'cpu' && H5.stage === 'set') {
        H5.spot = cpuPickSpot();
        cpuShoot('set');
      } else {
        S.cpuTurn = null;
        placeShooter(H5.spot); S.phase = 'live';
        setTitle('Match it', describeSpot(H5.spot));
        banner('Your turn', 'Match it', describeSpot(H5.spot), 1.4);
        hint('Miss and you take a letter');
      }
    }
    function describeSpot(p) {
      const z = Court3D.zoneOf(S.court, p), d = Math.hypot(p[0] - RIM.x, p[2] - RIM.z);
      return `${Court3D.ZONES[z]} · ${Math.round(d)} ft`;
    }
    function cpuPickSpot() {
      const opp = S.spec.opponent;
      const favs = opp.favorites && opp.favorites.length ? opp.favorites : ['le', 're', 'top', 'lw', 'rw'];
      const id = favs[Math.floor(S.rand() * favs.length)];
      const sp = Court3D.spotInfo(S.court, id);
      const pol = Court3D.polarOf(sp.pos);
      const lead = S.horse.letters.you - S.horse.letters.cpu;
      const nd = pol.dist + (S.rand() - 0.5) * 2 + (lead < 0 ? 1.2 : 0);
      const na = pol.angle + (S.rand() - 0.5) * 12;
      let p = Court3D.polar(na, nd);
      if (!inBounds(p)) p = sp.pos;
      return p;
    }
    function cpuShoot(stage) {
      const opp = S.spec.opponent, H5 = S.horse;
      S.cpuTurn = { stage };
      placeShooter(H5.spot);
      S.shooter.hasBall = true;
      S.phase = 'cpu';
      const first = (opp.short || opp.name.split(' ')[0]);
      setTitle(`${first} shooting`, describeSpot(H5.spot));
      banner(stage === 'set' ? `${first} picks a spot` : `${first} has to match`, describeSpot(H5.spot), opp.lines ? opp.lines[Math.floor(S.rand() * opp.lines.length)] : '', 1.3);
      hint('');
      after(1.45, () => {
        const shot = HoopPhysics.cpuShot(S.shooter.pos, opp.skill, S.rand);
        launch(shot, { contest: 0, fouled: false, dist: shot.dist, by: 'cpu' });
      });
    }
    function horseBallDone(b, made) {
      const H5 = S.horse, opp = S.spec.opponent, first = (opp.short || opp.name.split(' ')[0]);
      const by = b.info.by;
      H5.history.push({ by, made, stage: H5.stage });
      let msg = null;
      if (H5.stage === 'set') {
        if (made) { H5.stage = 'match'; msg = by === 'you' ? [`Good`, `${first} has to match`] : [`${first} hits`, `Your turn to match`]; }
        else { H5.setter = by === 'you' ? 'cpu' : 'you'; msg = by === 'you' ? ['Missed', `${first}'s shot`] : [`${first} misses`, 'Your shot']; }
      } else {
        if (!made) {
          if (by === 'you') H5.letters.you++; else H5.letters.cpu++;
          const w = S.spec.word || 'HORSE';
          const n = by === 'you' ? H5.letters.you : H5.letters.cpu;
          msg = by === 'you' ? ['Letter', `You have ${w.slice(0, n)}`] : ['Letter', `${first} has ${w.slice(0, n)}`];
        } else msg = by === 'you' ? ['Matched', 'Still their shot'] : [`${first} matched`, 'Your shot again'];
        H5.stage = 'set';
      }
      horseUi();
      const w = S.spec.word || 'HORSE';
      S.phase = 'between';
      if (H5.letters.you >= w.length || H5.letters.cpu >= w.length) {
        const won = H5.letters.cpu >= w.length;
        banner(won ? 'You win' : `${first} wins`, won ? `${first} is a ${w}` : `You're a ${w}`, '', 2.2);
        if (won) Sfx.play('great'); else Sfx.play('bad');
        after(2.3, endSession);
        return;
      }
      banner(msg[0], msg[1], '', 1.2);
      after(1.35, horseTurn);
    }

    // ---------- spot picker ----------
    function openMap(title, text, onPick, marks) {
      S.phase = 'map';
      const c = S.court;
      const hw = c.lane / 2;
      const a0 = c.cornerZ > RIM.z ? Math.atan2(c.corner, c.cornerZ - RIM.z) : Math.asin(Math.min(1, c.corner / c.three));
      const arc = [];
      for (let i = 0; i <= 40; i++) { const a = -a0 + 2 * a0 * i / 40; arc.push(`${(RIM.x + c.three * Math.sin(a)).toFixed(2)},${(RIM.z + c.three * Math.cos(a)).toFixed(2)}`); }
      const threePath = `M${-c.corner},0 L${-c.corner},${c.cornerZ} L${arc.join(' L')} L${c.corner},${c.cornerZ} L${c.corner},0`;
      ui.map.innerHTML = `<h3>${esc(title)}</h3><p>${esc(text)}</p>
        <svg viewBox="-26 -2 52 36" role="img" aria-label="Half court. Tap to choose where to shoot from.">
          <rect x="-25" y="0" width="50" height="34" rx="0.6" fill="${c.env === 'park' ? '#2c5a46' : '#c99a62'}" stroke="#f3f1ea" stroke-width="0.25"/>
          <rect x="${-hw}" y="0" width="${c.lane}" height="19" fill="${c.key}" stroke="#f3f1ea" stroke-width="0.25"/>
          <path d="M-6,19 A6,6 0 0 0 6,19" fill="none" stroke="#f3f1ea" stroke-width="0.25"/>
          <path d="${threePath}" fill="none" stroke="#f3f1ea" stroke-width="0.3"/>
          <line x1="-3" y1="4" x2="3" y2="4" stroke="#f3f1ea" stroke-width="0.5"/>
          <circle cx="${RIM.x}" cy="${RIM.z}" r="0.75" fill="none" stroke="#e2581f" stroke-width="0.3"/>
          <g class="marks"></g>
          <circle class="pick" r="0.9" fill="#ffb547" stroke="#1a1206" stroke-width="0.25" visibility="hidden"/>
        </svg>
        <div class="row"><button class="hx-btn" type="button" disabled>Shoot from here</button></div>`;
      ui.map.hidden = false;
      const svg = ui.map.querySelector('svg'), dot = ui.map.querySelector('.pick'), btn = ui.map.querySelector('.hx-btn');
      let chosen = null;
      svg.addEventListener('pointerdown', e => {
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const m = svg.getScreenCTM(); if (!m) return;
        const q = pt.matrixTransform(m.inverse());
        const p = [Math.max(-24, Math.min(24, q.x)), 0, Math.max(0.8, Math.min(33, q.y))];
        if (Math.hypot(p[0] - RIM.x, p[2] - RIM.z) < 3) return;
        chosen = p;
        dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[2]); dot.setAttribute('visibility', 'visible');
        btn.disabled = false;
        btn.textContent = `Shoot from here · ${Math.round(Math.hypot(p[0] - RIM.x, p[2] - RIM.z))} ft${Court3D.isThree(S.court, p) ? ' · three' : ''}`;
        Sfx.play('ui');
      });
      btn.addEventListener('click', () => { if (!chosen) return; ui.map.hidden = true; ui.map.innerHTML = ''; onPick(chosen); });
    }
    function placeShooter(p) {
      S.shooter = newShooter(p);
    }

    // ---------- session ----------
    function run(spec, handlers) {
      stop(true);
      S.spec = Object.assign({}, spec);
      S.court = Court3D.COURTS[spec.court] || Court3D.COURTS.park;
      S.onEnd = handlers && handlers.onEnd; S.onQuit = handlers && handlers.onQuit;
      S.rand = spec.seed != null ? mulberry(spec.seed) : Math.random;
      Object.assign(S, { t: 0, balls: [], popups: [], timers: [], meter: null, clock: null, gameClock: null, score: 0, makes: 0, attempts: 0, streak: 0, best: 0, log: [], zone: {}, poss: null, rack: null, horse: null, list: null, cpuTurn: null, calib: [], hintShown: 0, cardNext: null, ftMode: false, rackDone: false, ended: false, move: null, queued: null, lastMove: null, layupHint: false, dribbleT: 0, help: null });
      ['clock', 'horse', 'scout', 'helpChip', 'contest', 'banner', 'hint', 'card', 'map'].forEach(k => { ui[k].hidden = true; });
      setScore('', '');
      updateScoreUi();
      S.running = true;
      S.last = performance.now();
      S.raf = requestAnimationFrame(frame);
      const k = spec.kind;
      if (k === 'possessions') startPossession(0);
      else if (k === 'rack') startRack();
      else if (k === 'horse') startHorse();
      else if (k === 'shots') { S.list = spec.shots; startListShot(0); }
      else {
        S.freeRing = 'three'; S.freeIdx = Math.max(0, RINGS.three.indexOf(spec.spot || 'top'));
        const sp = Court3D.spotInfo(S.court, spec.spot || 'top');
        S.freeIdx = RINGS.three.indexOf(sp.id) >= 0 ? RINGS.three.indexOf(sp.id) : 2;
        S.shooter = newShooter(sp.pos);
        S.phase = 'live';
        setTitle(spec.title || 'Shootaround', sp.label);
        hint(settings.hints ? 'Flick up to shoot · Swipe left or right to move · Swipe down to change range · Tap to pick any spot' : '');
      }
    }
    function summary(quit) {
      const k = S.spec ? S.spec.kind : null;
      const out = { kind: k, quit: !!quit, points: S.score, makes: S.makes, attempts: S.attempts, bestStreak: S.best, zone: S.zone, log: S.log };
      if (k === 'possessions' && S.log.length) {
        const gp = { A: 4, B: 3, C: 2, D: 1, F: 0 };
        out.readIQ = Math.round(S.log.reduce((s, l) => s + gp[l.grade], 0) / S.log.length * 25);
      }
      if (k === 'horse' && S.horse) { out.letters = S.horse.letters; out.won = S.horse.letters.cpu >= (S.spec.word || 'HORSE').length; }
      if (S.spec && S.spec.calibrate && S.calib.length) {
        const c = S.calib.slice().sort((a, b) => a - b);
        out.touchK = Math.max(0.8, Math.min(4.5, c[Math.floor(c.length / 2)]));
      }
      return out;
    }
    function endSession() {
      if (S.ended) return;
      S.ended = true;
      const res = summary(false);
      const f = S.onEnd;
      stop();
      f && f(res);
    }
    function stop(silent) {
      S.running = false;
      cancelAnimationFrame(S.raf);
      S.timers = [];
      ui.map.hidden = true;
      hideBanner();
    }
    function destroy() { stop(); detach(); if (ro) ro.disconnect(); root.remove(); }

    // ---------- update ----------
    function update(dt) {
      S.t += dt;
      // timers
      const due = S.timers.filter(x => x.at <= S.t);
      if (due.length) { S.timers = S.timers.filter(x => x.at > S.t); due.forEach(x => x.fn()); }
      const sh = S.shooter;
      if (sh) {
        if (sh.to) {
          sh.moveT += dt;
          const k = Math.min(1, sh.moveT / sh.moveDur);
          const e = easeInOut(k);
          sh.pos = sh.ctrl ? V.add(V.add(V.mul(sh.from, (1 - e) * (1 - e)), V.mul(sh.ctrl, 2 * (1 - e) * e)), V.mul(sh.to, e * e)) : V.lerp3(sh.from, sh.to, e);
          if (k >= 1) sh.to = null;
        }
        sh.jumpT += dt; sh.fakeT += dt; sh.catchT += dt; sh.follow += dt;
        if (sh.jabT != null) sh.jabT += dt;
        if (sh.fadeT != null) sh.fadeT += dt;
        if (sh.to && sh.hasBall) { S.dribbleT -= dt; if (S.dribbleT <= 0) { Sfx.play('dribble'); S.dribbleT = 0.17; } }
        if (sh.reload > 0) sh.reload -= dt;
      }
      if (S.def && S.phase !== 'intro' && S.phase !== 'card') Defense.update(S.def, dt, sh, S.rand);
      if (S.help && S.phase !== 'intro' && S.phase !== 'card') {
        Help.update(S.help, dt, sh, S.def);
        if (S.help.engaged && S.poss && !S.poss.helpSeen) S.poss.helpSeen = true;
        if (sh && sh.hasBall && S.phase === 'moving' && S.move && (S.move.kind === 'drive' || S.move.kind === 'euro')) {
          if (Help.charge(S.help, sh.pos)) turnover('Charge', `ran into ${S.help.type.name}`, V.add(S.help.pos, [0, 7, 0]));
          else if (Help.steal(S.help, sh.pos, S.rand)) turnover('Stripped', `carried it past ${S.help.type.name} and got stripped`, V.add(S.help.pos, [0, 6, 0]));
        }
      }
      // clocks
      if (S.clock != null && (S.phase === 'live' || S.phase === 'moving' || S.phase === 'faking')) {
        S.clock -= dt;
        if (S.clock <= 0) {
          S.clock = 0; Sfx.play('buzzer');
          if (S.poss) { S.poss.turnover = 'Shot clock'; S.poss.actions.push('ran out the clock'); }
          sh.hasBall = false;
          popup('Shot clock', '#ff5d4a', 1.2, { world: [RIM.x, RIM.y + 2, RIM.z] });
          S.phase = 'resolving';
          after(0.8, finishPossession);
        }
      }
      if (S.gameClock != null && S.spec.kind === 'rack' && S.phase !== 'intro' && !S.rackDone) {
        S.gameClock -= dt;
        if (S.gameClock <= 0) {
          S.gameClock = 0; S.rackDone = true; sh.hasBall = false; Sfx.play('buzzer');
          banner('', 'Time', '', 1.2);
          if (!S.balls.some(x => !x.result)) after(1.2, endSession);
        }
      }
      // balls
      S.balls.forEach(b => {
        if (b.blockAt && !b.blocked && b.t >= b.blockAt) {
          b.blocked = true;
          const side = S.rand() < 0.5 ? -1 : 1;
          const dir = Court3D.dirToRim(b.info.pos);
          b.v = [-dir[0] * 9 + dir[2] * side * 7, 4, -dir[2] * 9 - dir[0] * side * 7];
          popup('Blocked', '#ff5d4a', 1.4, { world: V.add(b.p, [0, 1.5, 0]) });
          Sfx.play('block'); Sfx.buzz(50);
          if (S.def) S.def.lift = 2.5;
        }
        HoopPhysics.advance(b, dt, S.court);
        b.events.forEach(ev => {
          if (ev.type === 'rim') Sfx.play('rim', ev.s);
          else if (ev.type === 'board') Sfx.play('board');
          else if (ev.type === 'bounce') Sfx.play('bounce', ev.s);
          else if (ev.type === 'score') {
            Sfx.play('swish');
            S.net.pull = 1; S.net.sway = 0.45;
            const hv = Math.hypot(b.v[0], b.v[2]) || 1;
            S.net.sx = b.v[0] / hv; S.net.sz = b.v[2] / hv;
          }
        });
        b.events.length = 0;
        if (b.blocked && !b.result && b.t > 0.9) b.result = 'miss';
        if (b.result && !b.handled) { b.handled = true; onBallResult(b); }
        if (b.trail) { b.trail.push(b.p.slice()); if (b.trail.length > 7) b.trail.shift(); }
      });
      S.balls = S.balls.filter(b => !b.done);
      // shootaround: the next ball comes back to you
      if (sh && !sh.hasBall && S.spec.kind === 'free' && S.phase === 'live' && sh.jumpT > 0.7) { sh.hasBall = true; sh.catchT = 0; }
      // rack: count shots
      if (S.spec.kind === 'rack' && S.rackShot) { S.rackShot = false; rackAfterShot(); }
      // net and popups
      S.net.pull *= Math.exp(-dt * 3.5); S.net.sway *= Math.exp(-dt * 3);
      S.popups.forEach(p => { p.t += dt; });
      S.popups = S.popups.filter(p => p.t < p.life);
      if (S.meter) { S.meter.t += dt; if (S.meter.t > 1.8) S.meter = null; }
      // HUD: clock and contest
      if (S.clock != null && !ui.clock.hidden) {
        const v = S.clock;
        ui.clock.textContent = v < 5 ? v.toFixed(1) : Math.ceil(v);
        ui.clock.classList.toggle('low', v < 2);
      }
      if (S.gameClock != null && !ui.clock.hidden) {
        const v = Math.max(0, S.gameClock);
        ui.clock.textContent = v < 10 ? v.toFixed(1) : Math.ceil(v);
        ui.clock.classList.toggle('low', v < 10);
      }
      if (S.def && sh && (S.phase === 'live' || S.phase === 'moving' || S.phase === 'faking' || S.phase === 'catch')) {
        const d0 = Math.hypot(sh.pos[0] - RIM.x, sh.pos[2] - RIM.z);
        const c0 = Math.max(Defense.contest(S.def, sh.pos), S.help ? Help.contest(S.help, sh.pos, helpKind(S.phase === 'moving' && S.move && S.move.kind === 'drive' && d0 >= 11 ? 'pullup' : null, d0)) : 0);
        const lab = Defense.foulable(S.def, sh.pos) ? { text: 'Draw the foul', tone: 'open' } : Defense.contestLabel(c0);
        const txt = lab.text + lab.tone;
        if (txt !== S.lastContestText) {
          S.lastContestText = txt;
          ui.contest.className = 'hx-chip hx-contest ' + lab.tone;
          ui.contest.innerHTML = `<b>${esc(lab.text)}</b>`;
        }
        ui.contest.hidden = false;
      }
    }

    // ---------- render ----------
    function heldBallScreen() {
      const sh = S.shooter;
      const r = Math.min(W * 0.15, H * 0.085);
      let x = W / 2, y = H - r * 1.75;
      if (!sh) return { x, y, r };
      if (sh.fakeT < 0.34) y -= H * 0.09 * Math.sin(Math.PI * sh.fakeT / 0.34);
      if (sh.catchT < 0.32) { const k = sh.catchT / 0.32; x += (1 - k) * W * 0.7; y -= (1 - k) * H * 0.15; }
      if (sh.reload > 0) y += sh.reload / 0.24 * r * 2.5;
      if (sh.jabT != null && sh.jabT < 0.24) { const k = Math.sin(Math.PI * sh.jabT / 0.24); x += sh.jabSide * r * 0.9 * k; y += r * 0.25 * k; }
      if (sh.to) {
        const k = sh.moveT / sh.moveDur;
        y += Math.abs(Math.sin(k * Math.PI * 2)) * r * 0.5; // dribble bob
      }
      return { x, y, r };
    }
    function drawHands(held, alpha) {
      const skin = S.cpuTurn ? (S.spec.opponent.skin || '#8d5524') : settings.skin;
      const sleeve = S.cpuTurn ? (S.spec.opponent.sleeve || '#333') : settings.sleeve;
      const r = held.r;
      ctx.save();
      ctx.globalAlpha = alpha;
      [-1, 1].forEach(sd => {
        ctx.save();
        ctx.translate(held.x + sd * r * 0.92, held.y + r * 0.35);
        ctx.rotate(sd * -0.35);
        ctx.fillStyle = sleeve;
        ctx.beginPath(); ctx.ellipse(sd * r * 0.55, r * 1.6, r * 0.55, r * 0.9, sd * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin;
        ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.36, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath(); ctx.ellipse(sd * -r * 0.12, -r * 0.2, r * 0.12, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      ctx.restore();
    }
    function frame(now) {
      if (!S.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - S.last) / 1000));
      S.last = now;
      update(dt);
      if (S.running) render();
      if (S.running) S.raf = requestAnimationFrame(frame);
    }
    function render() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const sh = S.shooter;
      let pos = sh ? sh.pos : Court3D.spotInfo(S.court, 'top').pos;
      if (sh && sh.fadeT != null && sh.fadeT < 1.6) {
        // fading away: the camera drifts back as you shoot, then settles
        const dr = Court3D.dirToRim(pos);
        const k = Math.min(1, sh.fadeT / 0.45) * (sh.fadeT > 1.1 ? (1.6 - sh.fadeT) / 0.5 : 1);
        pos = V.sub(pos, V.mul(dr, 1.3 * k));
      }
      if (sh && sh.jabT != null && sh.jabT < 0.24) {
        const dr = Court3D.dirToRim(pos);
        pos = V.add(pos, V.mul([-dr[2], 0, dr[0]], sh.jabSide * Math.sin(Math.PI * sh.jabT / 0.24) * 0.8));
      }
      const lift = sh && sh.jumpT < 0.6 ? Math.sin(Math.PI * sh.jumpT / 0.6) * 0.9 : 0;
      const roll = sh && sh.to ? Math.sin(Math.PI * sh.moveT / sh.moveDur) * 0.05 * (S.move && S.move.side ? S.move.side : Math.sign((sh.to[0] - sh.from[0]) || 0)) : 0;
      const cam = Court3D.shooterCamera(pos, W, H, { lift, roll });
      const court = S.court;
      ctx.fillStyle = '#0b0f18'; ctx.fillRect(0, 0, W, H);
      if (court.env === 'park') Court3D.drawPark(ctx, cam, S.t); else Court3D.drawRoom(ctx, cam, court, S.t);
      Court3D.drawFloor(ctx, cam, court);
      if (court.env === 'park') Court3D.drawFence(ctx, cam);
      S.balls.forEach(b => Court3D.drawShadow(ctx, cam, b.p, b.p[1]));
      // depth-sorted scene
      const items = [];
      const depth = p => Court3D.toCam(cam, p)[2];
      items.push({ d: depth([0, 10.5, 3.2]), f: () => { Court3D.drawSupport(ctx, cam, court); Court3D.drawBoard(ctx, cam, court); } });
      const rd = depth([RIM.x, RIM.y, RIM.z]);
      items.push({ d: rd + 0.6, f: () => Court3D.drawNetAndRim(ctx, cam, 'back', S.net, court) });
      items.push({ d: rd - 0.6, f: () => Court3D.drawNetAndRim(ctx, cam, 'front', S.net, court) });
      if (S.def) items.push({ d: depth(V.add(S.def.pos, [0, 4, 0])), f: () => Defense.drawDefender(ctx, cam, S.def) });
      if (S.help) items.push({ d: depth(V.add(S.help.pos, [0, 4, 0])), f: () => Help.draw(ctx, cam, S.help) });
      S.balls.forEach(b => items.push({ d: depth(b.p), f: () => drawFlightBall(cam, b) }));
      items.sort((a, b) => b.d - a.d).forEach(it => it.f());
      // the defender can hide the rim; draw a faint ring so you never lose it
      if (S.def) {
        ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ff8a4c';
        const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; pts.push([RIM.x + RIM.r * Math.sin(a), RIM.y, RIM.z + RIM.r * Math.cos(a)]); }
        for (let i = 0; i < 24; i++) Court3D.seg(ctx, cam, pts[i], pts[i + 1], 0.05, 1.2);
        ctx.restore();
      }
      // ball in hands
      if (sh && (sh.hasBall || sh.catchT < 0.32 || sh.reload > 0) && S.phase !== 'map') {
        const held = heldBallScreen();
        drawHands(held, 1);
        drawHeldBall(held, S.spec.kind === 'rack' && S.rack && S.rack.ball === S.spec.perRack - 1 && S.spec.money);
      } else if (sh && sh.follow < 0.3) {
        const held = heldBallScreen();
        held.y -= sh.follow / 0.3 * H * 0.25;
        drawHands(held, 1 - sh.follow / 0.3);
      }
      drawPopups(cam);
      if (S.meter) drawMeter();
      if (S.spec.kind === 'rack' && S.rack) drawRackDots();
    }
    function drawHeldBall(held, money) {
      const r = held.r;
      const g = ctx.createRadialGradient(held.x - r * 0.35, held.y - r * 0.4, r * 0.1, held.x, held.y, r);
      if (money) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#e6ecf8'); g.addColorStop(1, '#2a4fb0'); }
      else { g.addColorStop(0, '#f6a35c'); g.addColorStop(0.55, '#e0661f'); g.addColorStop(1, '#8f3509'); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(held.x, held.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = money ? 'rgba(200,30,40,0.8)' : 'rgba(40,15,5,0.7)'; ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath(); ctx.moveTo(held.x - r, held.y + r * 0.05); ctx.quadraticCurveTo(held.x, held.y - r * 0.15, held.x + r, held.y + r * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(held.x, held.y, r * 0.4, r, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(held.x, held.y, r * 0.4, r, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    }
    function drawFlightBall(cam, b) {
      const hot = b.info && b.info.by === 'you' && S.streak >= 3;
      if (b.t > b.appear) {
        // trail
        for (let i = 0; i < b.trail.length - 1; i++) {
          const p = Court3D.project(cam, b.trail[i]);
          if (!p) continue;
          const a = (i + 1) / b.trail.length * (hot ? 0.5 : 0.18);
          ctx.fillStyle = hot ? `rgba(255,120,40,${a})` : `rgba(255,255,255,${a})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, Court3D.BALL_R * p.s * (0.5 + i / b.trail.length * 0.5), 0, Math.PI * 2); ctx.fill();
        }
        Court3D.drawBall(ctx, cam, b);
        return;
      }
      const p = Court3D.project(cam, b.p);
      if (!p) return;
      const k = b.t / b.appear;
      const x = b.sx + (p.x - b.sx) * k, y = b.sy + (p.y - b.sy) * k;
      const r = b.sr + (Court3D.BALL_R * p.s - b.sr) * k;
      drawHeldBall({ x, y, r }, b.money);
    }
    function drawPopups(cam) {
      S.popups.forEach(p => {
        let x, y;
        if (p.world) { const q = Court3D.project(cam, p.world); if (!q) return; x = q.x; y = q.y; } else { x = p.x; y = p.y; }
        const k = p.t / p.life;
        y -= k * 30;
        const a = k < 0.15 ? k / 0.15 : (k > 0.7 ? (1 - k) / 0.3 : 1);
        const sz = Math.round(Math.min(W, H) * 0.075 * p.size * (k < 0.15 ? 0.8 + k / 0.15 * 0.2 : 1));
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = `800 ${sz}px "Big Shoulders Display", Impact, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, sz * 0.12); ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        const text = p.text.toUpperCase();
        ctx.strokeText(text, x, y); ctx.fillStyle = p.color; ctx.fillText(text, x, y);
        ctx.restore();
      });
    }
    function drawMeter() {
      const m = S.meter, shot = m.shot;
      const k = m.t;
      const a = k < 0.15 ? k / 0.15 : (k > 1.4 ? Math.max(0, (1.8 - k) / 0.4) : 1);
      const bw = Math.min(W * 0.7, 300), bh = 10;
      const x0 = (W - bw) / 2, y0 = H - Math.min(W * 0.15, H * 0.085) * 1.75 - 6;
      const lo = 0.6, hi = 1.4;
      const X = v => x0 + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * bw;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,10,14,0.75)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 - 10, y0 - 34, bw + 20, 58, 10) : ctx.rect(x0 - 10, y0 - 34, bw + 20, 58); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x0, y0, bw, bh);
      if (!m.calibrating) {
        ctx.fillStyle = 'rgba(126,226,168,0.75)';
        ctx.fillRect(X(1 - shot.window), y0, X(1 + shot.window) - X(1 - shot.window), bh);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X(1) - 1, y0 - 3, 2, bh + 6);
      const mx = m.calibrating ? X(1) : X(shot.ratio);
      ctx.fillStyle = shot.green || m.calibrating ? '#7ee2a8' : '#ffb547';
      ctx.beginPath(); ctx.moveTo(mx, y0 - 2); ctx.lineTo(mx - 6, y0 - 11); ctx.lineTo(mx + 6, y0 - 11); ctx.closePath(); ctx.fill();
      ctx.fillRect(mx - 1.5, y0, 3, bh);
      ctx.font = '600 11px "Barlow", sans-serif'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(243,241,234,0.7)';
      ctx.textAlign = 'left'; ctx.fillText('SOFT', x0, y0 + bh + 13);
      ctx.textAlign = 'right'; ctx.fillText('HARD', x0 + bw, y0 + bh + 13);
      ctx.textAlign = 'center';
      ctx.font = '700 13px "Barlow", sans-serif'; ctx.fillStyle = '#f3f1ea';
      ctx.fillText(m.calibrating ? 'Touch recorded' : shot.feedback, W / 2, y0 - 17);
      ctx.restore();
    }
    function drawRackDots() {
      const spec = S.spec, R = S.rack;
      const n = spec.perRack, r = 6, gap = 18;
      const x0 = W / 2 - (n - 1) * gap / 2, y = H - Math.min(W * 0.15, H * 0.085) * 3.3;
      for (let i = 0; i < n; i++) {
        const used = i < R.ball || S.rackDone;
        const money = spec.money && i === n - 1;
        ctx.beginPath(); ctx.arc(x0 + i * gap, y, r, 0, Math.PI * 2);
        ctx.fillStyle = used ? 'rgba(255,255,255,0.15)' : (money ? '#e6ecf8' : '#e0661f');
        ctx.fill();
        if (money && !used) { ctx.strokeStyle = '#2a4fb0'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    }

    function setSettings(o) { Object.assign(settings, o || {}); }

    return { run, stop, destroy, setSettings, summary, get settings() { return settings; }, _S: S };
  }

  return { create, FEEL, RINGS };
})();
