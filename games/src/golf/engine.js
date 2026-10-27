/* GolfEngine: runs any golf "spec" (a challenge described as data) inside a
   container, the way HoopsEngine runs basketball.

   spec.kind:
     round      play holes out:          { holes: ['h1', ...] }
     ctp        closest to the pin:      { shots: [{ hole, wind: { dir: [a, b], mph: [a, b] } }] }
     putting    one putt each:           { putts: [{ d, slope, stimp, from }] }
     updown     get up and down:         { spots: [{ hole, ball: [x, z], wind }] }
     range      hit balls, read numbers: { }
     calibrate  three full swings that set your swing */
const GolfEngine = (() => {
  const P = GolfPhysics, C = GolfCourse, Rd = GolfReads, Sfx = GolfSfx;
  const { V } = C;
  const FEEL = {
    arcade: { window: 0.32, aim: 9, label: 'Arcade' },
    normal: { window: 0.22, aim: 6, label: 'Normal' },
    pro: { window: 0.13, aim: 3.5, label: 'Pro' }
  };
  const DISPLAY = '"Fraunces",Georgia,"Times New Roman",serif', BODY = '"Figtree",system-ui,sans-serif';

  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
.gx{position:absolute;inset:0;overflow:hidden;background:#0f2a1e;color:#f6f1e3;font-family:${BODY};user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.gx canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.gx-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 22px max(14px,env(safe-area-inset-left,0px));pointer-events:none;background:linear-gradient(rgba(8,24,16,.6),rgba(8,24,16,0))}
.gx-quit{pointer-events:auto;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(10,30,20,.5);color:#f6f1e3;font:600 18px/1 ${BODY};cursor:pointer}
.gx button:focus-visible{outline:2px solid #f2c94c;outline-offset:2px}
.gx-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-shadow:0 1px 3px rgba(0,0,0,.55)}
.gx-title b{font:700 21px/1.05 ${DISPLAY};letter-spacing:.005em}
.gx-title span{font:500 13px/1.25 ${BODY};opacity:.88}
.gx-score{text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.55)}
.gx-score-n{display:block;font:800 36px/0.95 ${DISPLAY};font-variant-numeric:tabular-nums}
.gx-score small{font:600 11px/1.2 ${BODY};letter-spacing:.08em;text-transform:uppercase;opacity:.8}
.gx-chips{position:absolute;left:0;right:0;top:calc(62px + env(safe-area-inset-top,0px));display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:0 14px;pointer-events:none}
.gx-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font:600 12px/1.1 ${BODY};background:rgba(8,26,18,.72);border:1px solid rgba(255,255,255,.2)}
.gx-chip b{font-weight:800}
.gx-chip svg{width:16px;height:16px;flex:none}
.gx-read{color:#f2c94c;border-color:rgba(242,201,76,.5)}
.gx-chip.tap{pointer-events:auto;cursor:pointer;border-color:rgba(242,201,76,.6)}
.gx-lie.bad{color:#ffb38a;border-color:rgba(255,179,138,.5)}
.gx-yard{position:absolute;left:max(14px,env(safe-area-inset-left,0px));top:calc(98px + env(safe-area-inset-top,0px));padding:6px 10px 7px;border-radius:10px;background:rgba(8,26,18,.66);pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.gx-yard b{display:block;font:800 26px/1 ${DISPLAY};font-variant-numeric:tabular-nums}
.gx-yard span{font:600 11px/1.2 ${BODY};letter-spacing:.06em;text-transform:uppercase;opacity:.8}
.gx-mapbtn{position:absolute;right:max(14px,env(safe-area-inset-right,0px));top:calc(98px + env(safe-area-inset-top,0px));width:96px;height:128px;padding:0;border-radius:12px;border:1.5px solid rgba(255,255,255,.45);background:#3a6b34;overflow:hidden;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3)}
.gx-mapbtn svg{display:block;width:100%;height:100%}
.gx-mapbtn span{position:absolute;left:0;right:0;bottom:0;padding:2px 0 3px;background:rgba(8,26,18,.7);font:700 10px/1.1 ${BODY};letter-spacing:.08em;text-transform:uppercase;color:#f6f1e3}
.gx-club{position:absolute;right:max(12px,env(safe-area-inset-right,0px));bottom:calc(24% + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:2px;padding:4px;border-radius:14px;background:rgba(8,26,18,.74);border:1px solid rgba(255,255,255,.2)}
.gx-club button{width:36px;height:40px;border:0;border-radius:10px;background:rgba(255,255,255,.08);color:#f6f1e3;font:700 22px/1 ${BODY};cursor:pointer}
.gx-club button:disabled{opacity:.3;cursor:default}
.gx-cname{min-width:66px;text-align:center;padding:0 4px}
.gx-cname b{display:block;font:700 15px/1.1 ${DISPLAY}}
.gx-cname span{font:600 11px/1.2 ${BODY};opacity:.75;font-variant-numeric:tabular-nums}
.gx-stats{position:absolute;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));top:calc(172px + env(safe-area-inset-top,0px));max-width:420px;margin:0 auto;padding:10px 12px;border-radius:12px;background:rgba(8,26,18,.8);border:1px solid rgba(255,255,255,.14);pointer-events:none}
.gx-stats .h{font:700 15px/1.2 ${DISPLAY}}
.gx-stats .g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 10px;margin-top:6px}
.gx-stats .g div{font:500 11px/1.2 ${BODY};letter-spacing:.05em;text-transform:uppercase;opacity:.85}
.gx-stats .g b{display:block;font:800 20px/1.05 ${DISPLAY};letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums}
.gx-banner{position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;padding:0 20px}
.gx-banner .k{display:block;font:700 13px/1.2 ${BODY};letter-spacing:.16em;text-transform:uppercase;color:#f2c94c;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.gx-banner .h{display:block;font:800 clamp(32px,10vw,56px)/1 ${DISPLAY};text-shadow:0 2px 14px rgba(0,0,0,.7);text-wrap:balance}
.gx-banner .s{display:block;margin:8px auto 0;max-width:30ch;font:500 15px/1.35 ${BODY};text-shadow:0 1px 5px rgba(0,0,0,.9)}
.gx-banner.pop{animation:gxpop .35s ease-out}
@keyframes gxpop{from{transform:scale(.88);opacity:0}to{transform:scale(1);opacity:1}}
.gx-hint{position:absolute;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);padding:7px 12px;border-radius:10px;background:rgba(8,26,18,.74);font:500 13px/1.35 ${BODY};text-align:center;pointer-events:none}
.gx-card{position:absolute;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:14px 16px 12px;border-radius:14px;background:rgba(246,241,227,.97);color:#1b2a20;border:1px solid rgba(0,0,0,.1);box-shadow:0 10px 30px rgba(0,0,0,.4);animation:gxup .25s ease-out}
@keyframes gxup{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.gx-card .k{font:700 11px/1.2 ${BODY};letter-spacing:.12em;text-transform:uppercase;color:#2f6b3f}
.gx-card .w{margin-top:5px;font:500 16px/1.38 ${BODY}}
.gx-card .w b{font-weight:700}
.gx-card .r{display:flex;gap:10px;align-items:flex-start;margin-top:9px;font:400 14px/1.4 ${BODY};color:#3d4a40}
.gx-grade{flex:none;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;font:800 21px/1 ${DISPLAY};color:#0f2a1e;background:#7fd19a}
.gx-grade.B{background:#c5e27e}.gx-grade.C{background:#ffd166}.gx-grade.D{background:#ff9a66}.gx-grade.F{background:#ff5d4a}
.gx-card .row{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:10px}
.gx-card .row small{flex:1;font:600 12px/1.2 ${BODY};color:#5d6b60}
.gx-btn{pointer-events:auto;cursor:pointer;border:0;border-radius:10px;padding:10px 18px;background:#0f2a1e;color:#f6f1e3;font:700 15px/1 ${BODY};letter-spacing:.02em}
.gx-map{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:calc(60px + env(safe-area-inset-top,0px)) 16px calc(20px + env(safe-area-inset-bottom,0px));background:rgba(6,20,13,.86)}
.gx-map h3{margin:0;font:700 22px/1.1 ${DISPLAY}}
.gx-map p{margin:0;font:500 14px/1.35 ${BODY};opacity:.88;text-align:center;max-width:36ch}
.gx-map svg{width:auto;height:auto;max-width:min(92vw,440px);max-height:58vh;border-radius:12px}
`;
    document.head.appendChild(st);
  }

  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const smooth = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = C.clamp;
  function distLabel(yd) { return yd < 22 ? `${Math.max(1, Math.round(yd * 3))} ft` : `${Math.round(yd)} yds`; }
  function toPar(n) { return n === 0 ? 'E' : n > 0 ? '+' + n : String(n); }
  function scoreName(diff, strokes) {
    if (strokes === 1) return 'Hole in one';
    return { '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double bogey', 3: 'Triple bogey' }[diff] || (diff > 0 ? `+${diff}` : `${diff}`);
  }
  const TEMPO_WORDS = { pure: 'Pure.', solid: 'Solid.', quick: 'Quick from the top, so it went left.', decel: 'You eased off it and caught it heavy.' };
  const SURF_WORDS = { fairway: 'in the fairway', rough: 'in the rough', sand: 'in the sand', green: 'on the green', fringe: 'on the fringe', tee: 'on the tee box' };

  function create(container, opts) {
    injectCss();
    const settings = Object.assign({ feel: 'normal', showTags: true, swing: null, hints: true, seen: {}, onSeen: null, shirt: '#1f4e79', cap: '#f6f1e3' }, opts || {});
    const root = document.createElement('div');
    root.className = 'gx';
    root.innerHTML = `
      <canvas></canvas>
      <div class="gx-top"><button class="gx-quit" type="button" aria-label="Leave this game">&#x2715;</button><div class="gx-title"><b></b><span></span></div><div class="gx-score"><span class="gx-score-n"></span><small></small></div></div>
      <div class="gx-chips"><div class="gx-chip gx-wind"></div><div class="gx-chip gx-lie"></div><div class="gx-chip gx-read" hidden></div></div>
      <div class="gx-yard" hidden><b></b><span></span></div>
      <button class="gx-mapbtn" type="button" aria-label="Open the hole map" hidden></button>
      <div class="gx-club" hidden><button class="gx-cl" type="button" aria-label="Less club">&#x2039;</button><div class="gx-cname"><b></b><span></span></div><button class="gx-cr" type="button" aria-label="More club">&#x203A;</button></div>
      <div class="gx-stats" hidden></div>
      <div class="gx-banner" hidden></div>
      <div class="gx-hint" hidden></div>
      <div class="gx-card" hidden></div>
      <div class="gx-map" hidden></div>`;
    container.appendChild(root);
    const $ = s => root.querySelector(s);
    const canvas = $('canvas'), ctx = canvas.getContext('2d');
    const ui = {
      title: $('.gx-title b'), sub: $('.gx-title span'), score: $('.gx-score-n'), scoreSub: $('.gx-score small'),
      wind: $('.gx-wind'), lie: $('.gx-lie'), read: $('.gx-read'), yard: $('.gx-yard'), mapBtn: $('.gx-mapbtn'),
      club: $('.gx-club'), clubName: $('.gx-cname b'), clubSub: $('.gx-cname span'), less: $('.gx-cl'), more: $('.gx-cr'),
      stats: $('.gx-stats'), banner: $('.gx-banner'), hint: $('.gx-hint'), card: $('.gx-card'), map: $('.gx-map'), quit: $('.gx-quit')
    };
    let W = 360, H = 640, DPR = 1;

    const S = {
      spec: null, t: 0, running: false, raf: 0, last: 0, phase: 'idle', rand: Math.random,
      holeId: 'h1', hole: null, idx: 0, wind: [0, 0, 0], windMph: 0, windDir: 0, pin: [0, 0], ball: [0, 0, 0], prevBall: null,
      lie: 'tee', lieKind: 'tee', strokes: 0, total: 0, par: 0, aim: null, rig: null, glide: null, shot: null,
      golfer: null, live: null, log: [], holes: [], timers: [], popups: [], flow: [], calib: [], onEnd: null, onQuit: null,
      slope: [0, 0], stimp: 10, putts: 0, cardNext: null, lastShot: null
    };

    function resize() {
      const r = root.getBoundingClientRect();
      W = Math.max(200, r.width); H = Math.max(300, r.height);
      DPR = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      if (S.aim && S.phase === 'aim') S.rig = aimRigNow();
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
    function hint(text) { ui.hint.textContent = text || ''; ui.hint.hidden = !text; }
    function onceHint(key, text) {
      if (!settings.hints || settings.seen[key]) return false;
      settings.seen[key] = 1; settings.onSeen && settings.onSeen(key);
      hint(text);
      return true;
    }
    function setTitle(a, b) { ui.title.textContent = a || ''; ui.sub.textContent = b || ''; }
    function setScore(n, sub) { ui.score.textContent = n; if (sub != null) ui.scoreSub.textContent = sub; }
    function popup(text, color, world, size) { S.popups.push({ text, color: color || '#fff', world: world || null, size: size || 1, t: 0, life: 1.6 }); }
    function swingCal() { return Object.assign({ back: 0.17, rate: 13, finish: 0.12 }, settings.swing || {}); }
    function feel() { return FEEL[settings.feel] || FEEL.normal; }
    const surfAt = (x, z) => C.surfaceAt(S.holeId, x, z);
    const pinDist = () => Math.hypot(S.pin[0] - S.ball[0], S.pin[1] - S.ball[2]);
    const putting = () => S.aim && S.aim.club === 'P';

    // ---------- input ----------
    const detach = Swing.attach(canvas, {
      down() {
        Sfx.unlock();
        if (S.phase === 'card' && S.cardNext) return;
        if (S.phase === 'aim') { S.phase = 'swing'; S.live = { back: 0, through: false }; hint(''); }
      },
      move(l) { if (S.phase === 'swing') S.live = l; },
      cancel() { if (S.phase === 'swing') { S.phase = 'aim'; S.live = null; } },
      gesture(g) {
        if (!S.running) return;
        if (S.phase === 'card') { if (g.type === 'tap' && S.cardNext) { const f = S.cardNext; S.cardNext = null; f(); } return; }
        if (S.phase !== 'swing' && S.phase !== 'aim') return;
        S.phase = 'aim';
        const l = S.live; S.live = null;
        if (g.type === 'aim') return turnAim(g.frac);
        if (g.type === 'swing') return swing(g);
        if (g.type === 'none') {
          if (g.why === 'noBack') hint('Pull back first: drag down from the ball, then swing up through it.');
          else if (g.why === 'noThrough') hint('That was just a backswing. Pull back, then swing up through the ball.');
        }
        void l;
      }
    });
    ui.quit.addEventListener('click', () => { Sfx.play('ui'); const q = S.onQuit; stop(); q && q(summary(true)); });
    ui.card.addEventListener('click', e => { if (e.target.closest('button') && S.cardNext) { const f = S.cardNext; S.cardNext = null; f(); } });
    ui.less.addEventListener('click', () => changeClub(1));
    ui.more.addEventListener('click', () => changeClub(-1));
    ui.mapBtn.addEventListener('click', () => { Sfx.play('ui'); openMap(); });
    // on the range, tap the wind to change it and watch what it does to each club
    const RANGE_WIND = [null, { dir: [0, 360], mph: [8, 12] }, { dir: [0, 360], mph: [15, 20] }];
    ui.wind.addEventListener('click', () => {
      if (!S.hole || !S.hole.range || S.spec.kind !== 'range' || S.phase !== 'aim') return;
      Sfx.play('ui');
      S.rangeWind = ((S.rangeWind || 0) + 1) % RANGE_WIND.length;
      if (RANGE_WIND[S.rangeWind]) setWind(RANGE_WIND[S.rangeWind]); else { S.wind = [0, 0, 0]; S.windMph = 0; }
      updateHud();
      hint(S.rangeWind ? 'Wind on. Try the same club high, stock and knocked down.' : 'Calm again.');
    });
    ui.map.addEventListener('click', () => { ui.map.hidden = true; });

    // ---------- aiming ----------
    function lieKindFor(surf, ball) {
      if (surf === 'sand') {
        const g = S.hole.green;
        if (g && Math.hypot(g.c[0] - ball[0], g.c[1] - ball[2]) < Math.max(g.rx, g.rz) + 32) return 'bunker';
        return 'sand';
      }
      return surf;
    }
    function autoClub(dist, lie, tee) {
      if (lie === 'green' || S.hole.putting) return 'P';
      if (lie === 'fringe' && dist < 18) return 'P';
      if (lie === 'bunker' && dist < 60) return 'SW';
      const irons = P.CLUBS.filter(c => !c.putter);
      if (tee && dist > P.CLUB['3W'].carry * 1.04) return 'D';
      for (let i = irons.length - 1; i >= 0; i--) if (irons[i].carry >= dist * 0.985) return tee || irons[i].id !== 'D' ? irons[i].id : '3W';
      return tee ? 'D' : '3W';
    }
    // where we're aiming with a club: the flag if it's in range, otherwise the fairway that far out
    function targetFor(club) {
      const h = S.hole;
      if (h.range) {
        const cr = club === 'P' ? 50 : P.CLUB[club].carry;
        let best = h.targets[0];
        h.targets.forEach(t => { if (Math.abs(Math.hypot(t[0] - S.ball[0], t[1] - S.ball[2]) - cr) < Math.abs(Math.hypot(best[0] - S.ball[0], best[1] - S.ball[2]) - cr)) best = t; });
        return { pt: [best[0], 0, best[1]], pin: true };
      }
      const d = pinDist();
      if (club === 'P') return { pt: [S.pin[0], 0, S.pin[1]], pin: true };
      // doglegs: off the tee, the default line is the outside of the corner
      if (h.aimTee && S.lie === 'tee' && S.strokes === 0 && P.CLUB[club].carry >= 200) return { pt: [h.aimTee[0], 0, h.aimTee[1]], pin: false };
      // if the green is in range of anything but the driver, you're aiming at the flag
      if (d <= P.CLUB['3W'].carry * 1.08 + 12) return { pt: [S.pin[0], 0, S.pin[1]], pin: true };
      const p = C.pointAhead(h.line, S.ball[0], S.ball[2], P.CLUB[club].carry);
      return p ? { pt: [p[0], 0, p[1]], pin: false } : { pt: [S.pin[0], 0, S.pin[1]], pin: true };
    }
    function setupAim(club, keepOff) {
      const tee = S.lie === 'tee' && S.strokes === 0;
      const d = pinDist();
      const auto = autoClub(d, S.lieKind, tee);
      const c = club || auto;
      const tg = targetFor(c);
      const tdist = Math.hypot(tg.pt[0] - S.ball[0], tg.pt[2] - S.ball[2]);
      const baseH = P.headingOf(tg.pt[0] - S.ball[0], tg.pt[2] - S.ball[2]);
      let number, marker;
      if (c === 'P') {
        number = tdist;
        marker = P.puttPowerFor(tdist, rollFor());
      } else {
        number = Math.min(tdist, P.CLUB[c].carry);
        marker = number >= P.CLUB[c].carry - 0.5 ? 1 : P.powerFor(c, number);
      }
      const off = keepOff && S.aim ? S.aim.off : 0;
      S.aim = { club: c, auto, target: tg.pt, toPin: tg.pin, tdist, baseH, off, number, marker };
      updateClubUi();
      updateHud();
    }
    function rollFor() { return 6 / (S.stimp || 10); }
    function aimHeading() { return S.aim.baseH + S.aim.off; }
    function aimRigNow() {
      const hd = P.heading(aimHeading());
      const tgt = [S.ball[0] + hd[0] * S.aim.tdist, 0, S.ball[2] + hd[2] * S.aim.tdist];
      return putting() ? C.puttRig(S.ball, tgt, W, H) : C.aimRig(S.ball, tgt, W, H);
    }
    function turnAim(frac) {
      const lim = putting() ? 14 : 30;
      const k = putting() ? 16 : 22;
      S.aim.off = clamp(S.aim.off + frac * k, -lim, lim);
      Sfx.play('tick');
      S.rig = aimRigNow();
      updateHud();
    }
    function changeClub(dir) {
      if (!S.aim || (S.phase !== 'aim')) return;
      const list = P.CLUBS.map(c => c.id);
      let i = list.indexOf(S.aim.club) + dir;
      if (i < 0 || i >= list.length) return;
      // the putter only from on or near the green; the driver only off the tee
      if (list[i] === 'P' && !(S.lie === 'green' || S.lie === 'fringe' || pinDist() < 30)) return;
      if (list[i] === 'D' && !(S.lie === 'tee')) i++;
      if (i < 0 || i >= list.length) return;
      Sfx.play('ui');
      const wasPutt = putting();
      setupAim(list[i], true);
      if (wasPutt !== putting()) S.aim.off = 0;
      computeRead(); updateHud();
      glideTo(aimRigNow(), 0.35);
    }
    function updateClubUi() {
      const a = S.aim; if (!a) return;
      const c = P.CLUB[a.club];
      ui.clubName.textContent = c.name.replace('Pitching wedge', 'P wedge').replace('Gap wedge', 'Gap wedge').replace('Sand wedge', 'Sand wedge').replace('Lob wedge', 'Lob wedge');
      ui.clubSub.textContent = c.putter ? 'putting' : (a.club === a.auto ? `${c.carry} carry` : `${c.carry} · ${c.i < P.CLUB[a.auto].i ? 'more' : 'less'} club`);
      const list = P.CLUBS.map(x => x.id), i = list.indexOf(a.club);
      ui.more.disabled = i <= 0 || (list[i - 1] === 'D' && S.lie !== 'tee');
      ui.less.disabled = i >= list.length - 1 || (list[i + 1] === 'P' && !(S.lie === 'green' || S.lie === 'fringe' || pinDist() < 30));
    }
    function updateHud() {
      const a = S.aim;
      const hd = P.heading(a ? aimHeading() : 0);
      const w = Rd.windRel(S.wind, hd);
      // wind arrow: up on screen is blowing away from you
      const rel = (S.windDir - (a ? aimHeading() : 0) + 360) % 360;
      const mph = Math.round(w.mph);
      ui.wind.innerHTML = mph < 1 ? '<b>Calm</b>' : `<svg viewBox="0 0 16 16" aria-hidden="true" style="transform:rotate(${rel.toFixed(0)}deg)"><path d="M8 1 L13 8 H9.6 V15 H6.4 V8 H3 Z" fill="#f6f1e3"/></svg><b>${mph} mph</b>`;
      ui.wind.setAttribute('aria-label', `Wind ${Rd.windWords(w)}`);
      const tapWind = S.hole && S.hole.range && S.spec.kind === 'range';
      ui.wind.classList.toggle('tap', !!tapWind);
      if (tapWind) ui.wind.setAttribute('role', 'button'); else ui.wind.removeAttribute('role');
      if (tapWind) ui.wind.innerHTML += '<span>· tap</span>';
      const lieLabel = S.lieKind === 'bunker' ? 'Greenside bunker' : S.lieKind === 'sand' ? 'Fairway bunker' : (P.SURF[S.lie] || P.SURF.rough).label;
      ui.lie.textContent = lieLabel;
      ui.lie.classList.toggle('bad', S.lie === 'rough' || S.lie === 'sand');
      if (a && !S.hole.range) {
        ui.yard.hidden = false;
        const d = pinDist();
        ui.yard.innerHTML = `<b>${esc(distLabel(d))}</b><span>${a.toPin ? 'to the pin' : `to the pin · ${Math.round(a.tdist)} to target`}</span>`;
      } else if (a && S.hole.range) {
        ui.yard.hidden = false;
        ui.yard.innerHTML = `<b>${Math.round(a.tdist)} yds</b><span>to that flag</span>`;
      } else ui.yard.hidden = true;
      if (a && settings.showTags && S.read && !S.hole.range && S.spec.kind !== 'calibrate') {
        const R = S.read.putt ? Rd.PUTTS[S.read.primary] : Rd.READS[S.read.primary];
        ui.read.textContent = R.name;
        ui.read.hidden = R.name === ui.lie.textContent;
      } else ui.read.hidden = true;
      if (a && !S.hole.range && !S.hole.putting && !putting()) {
        ui.mapBtn.innerHTML = C.shotMapSvg(S.holeId, { ball: S.ball, heading: aimHeading(), D: Math.max(a.tdist, a.number), number: a.number, pin: S.pin }) + '<span>Map</span>';
      }
    }
    function computeRead() {
      if (S.hole.range || !S.aim) { S.read = null; return; }
      const hd = P.heading(S.aim.baseH);
      S.read = Rd.assess({
        ball: S.ball, pin: S.pin, dist: pinDist(), dir: hd, wind: S.wind, lie: S.lieKind, tee: S.lie === 'tee' && S.strokes === 0,
        dogleg: S.hole.dogleg, green: S.hole.green ? { c: S.hole.green.c, rx: S.hole.green.rx, rz: S.hole.green.rz, slope: S.slope } : null,
        surfaceAt: surfAt, putt: putting(), slope: S.slope
      });
    }

    // ---------- camera ----------
    function glideTo(rig, dur) { S.glide = { from: S.rig || rig, to: rig, t: 0, dur: dur || 1 }; }

    // ---------- the swing ----------
    function swing(g) {
      const cal = swingCal(), a = S.aim;
      let power = clamp(g.back / cal.back, 0.03, 1.25);
      // close to your number, the swing settles onto it, the way a green release snaps
      const mag = (a.club === 'P' ? 0.04 : 0.05) * feel().window / 0.22;
      if (a.marker && Math.abs(power / a.marker - 1) < mag) power = a.marker * (1 + (power / a.marker - 1) * 0.3);
      const tempo = g.rate / cal.rate;
      const f = feel();
      S.prevBall = S.ball.slice();
      S.strokes++;
      let sim, launch, info;
      const world = {
        surfaceAt: surfAt, wind: S.wind, slopeAt: () => S.slope, greenRoll: rollFor(),
        cup: S.hole.range ? null : S.pin, trees: C.build(S.holeId).trees, greenFirm: (S.hole.green && S.hole.green.firm) || 0
      };
      if (S.spec.kind === 'calibrate') {
        // the first swings define full: whatever you did is your 100%
        S.calib.push({ back: g.back, rate: g.rate, finish: g.finish });
        launch = P.strike({ club: a.club, power: 1, type: 'stock', tempo: 1, angle: 0, curl: 0, lie: 'fairway', window: f.window, aimDead: f.aim });
      } else if (a.club === 'P') {
        const pt = P.putt({ power, tempo, angle: g.angle, window: f.window, aimDead: f.aim, rand: S.rand });
        const hd = P.heading(aimHeading() + pt.start);
        sim = P.simulate({ pos: [S.ball[0], 0, S.ball[2]], vel: [hd[0] * pt.speed, 0, hd[2] * pt.speed], rolling: true }, world);
        info = { putt: true, power, tempo: pt.tempo, marker: a.marker, start: pt.start };
        Sfx.play('putt');
      }
      if (!sim) {
        // where you finish, against your own natural finish for a swing this size, sets the trajectory
        const fe = cal.finish * Math.pow(Math.max(0.35, Math.min(1, power)), 0.6);
        const type = g.finish < fe * 0.4 ? 'knock' : g.finish > Math.max(fe * 1.6, fe + 0.05) ? 'high' : 'stock';
        if (!launch) launch = P.strike({ club: a.club, power, type, tempo, angle: g.angle, curl: g.curl, lie: S.lieKind, window: f.window, aimDead: f.aim, rand: S.rand });
        const vel = P.launchVel(launch.speed, launch.launch, aimHeading() + launch.start);
        sim = P.simulate({ pos: [S.ball[0], 0, S.ball[2]], vel, spin: launch.spin * P.RPM, tilt: launch.tilt }, world);
        // the same launch in still air: how much the wind did
        const still = P.simulate({ pos: [S.ball[0], 0, S.ball[2]], vel, spin: launch.spin * P.RPM, tilt: launch.tilt }, { noGround: true });
        const intended = g.curl >= 0.05 ? 'draw' : g.curl <= -0.05 ? 'fade' : null;
        info = { putt: false, power, tempo: launch.tempo, type: S.spec.kind === 'calibrate' ? 'stock' : type, shape: launch.shape, intended, marker: a.marker, still, launch };
        Sfx.play('strike', launch.tempo);
        S.golfer = { t: 0, from: S.live ? S.live.back : power * cal.back, finish: type };
      }
      info.club = a.club; info.aimOff = a.off; info.from = S.prevBall; info.read = S.read; info.lie = S.lie; info.lieKind = S.lieKind;
      info.g = g;
      S.shot = { sim, info, t: 0, ev: 0, done: false, startRig: S.rig, putt: info.putt };
      S.phase = 'flight';
      ui.club.hidden = true; ui.mapBtn.hidden = true;
      hint('');
      if (!info.putt && S.spec.kind !== 'calibrate' && !S.hole.range) onceHint('finish', 'Short finish knocks it down. A long, high finish sends it high. Bend your swing to curve it.');
    }

    // ---------- flight ----------
    function ballAt(sim, t) {
      const p = sim.path;
      if (t >= p[p.length - 1].t) return p[p.length - 1].p;
      let lo = 0, hi = p.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].t <= t) lo = m; else hi = m; }
      const a = p[lo], b = p[hi], k = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return V.lerp3(a.p, b.p, k);
    }
    function updateFlight(dt) {
      const sh = S.shot, sim = sh.sim;
      const rolling = sim.landT != null && sh.t > sim.landT;
      sh.t += dt * (sh.putt ? 1.15 : rolling ? 1.5 : 1.12);
      while (sh.ev < sim.events.length && sim.events[sh.ev].t <= sh.t) {
        const e = sim.events[sh.ev++];
        if (e.type === 'bounce') { if (e.surf === 'sand') Sfx.play('sand'); else Sfx.play('land', e.s); }
        else if (e.type === 'tree') { Sfx.play('tree'); popup('Trees', '#ffd166', e.p); }
        else if (e.type === 'water') { Sfx.play('splash'); popup('Splash', '#9fd3ff', e.p, 1.2); }
        else if (e.type === 'ob') { Sfx.play('groan'); popup('Out of bounds', '#ff9a66', e.p); }
        else if (e.type === 'lip') { Sfx.play('lip'); popup('Lipped out', '#ffd166', [S.pin[0], 0.4, S.pin[1]]); }
        else if (e.type === 'cup') { Sfx.play('cup'); after(0.25, () => Sfx.play(S.strokes <= S.par - 1 ? 'cheer' : 'clap')); }
      }
      const b = ballAt(sim, sh.t);
      sh.pos = b;
      // camera: from the aiming view, turn and zoom toward where it will land, then follow the roll
      if (!sh.putt) {
        const air = sim.landT || sim.t;
        const k = smooth(sh.t / Math.max(0.5, air * 0.8));
        const restP = sim.rest || sim.path[sim.path.length - 1].p;
        const land = sim.land || restP;
        let look = [land[0], 0, land[2]];
        if (sh.t > air) {
          const rk = smooth((sh.t - air) / Math.max(0.3, sim.t - air));
          look = V.lerp3(look, [restP[0], 0, restP[2]], rk);
        }
        const span = Math.hypot(land[0] - sh.info.from[0], land[2] - sh.info.from[2]);
        if (span > 35) {
          const watch = C.watchRig(sh.startRig, look, clamp(span * 0.42, 45, 90));
          S.rig = C.blendRig(sh.startRig, watch, k);
        }
      } else {
        // putts: drift with the ball so a long one stays in frame
        const k = smooth(sh.t / 1.5);
        const follow = C.puttRig(b, [S.pin[0], 0, S.pin[1]], W, H);
        if (Math.hypot(b[0] - sh.info.from[0], b[2] - sh.info.from[2]) > 3) S.rig = C.blendRig(S.rig, follow, Math.min(1, dt * 1.2 * k));
      }
      if (sh.t >= sim.t + 0.05 && !sh.done) {
        sh.done = true;
        after(sh.putt ? 0.5 : 0.7, () => resolveShot());
      }
    }

    // ---------- after the ball stops ----------
    function lateral(p, from, headingDeg) {
      const hd = P.heading(headingDeg);
      return (p[0] - from[0]) * hd[2] - (p[2] - from[2]) * hd[0];
    }
    function resolveShot() {
      const sh = S.shot; if (!sh) return;
      const sim = sh.sim, info = sh.info;
      S.shot = null;
      const rest = sim.result === 'rest' ? sim.rest : null;
      let penalty = 0, note = '';
      let newBall = S.ball;
      if (sim.result === 'water') {
        penalty = 1;
        // drop where it went in, back toward where you hit from, out of the water
        const e = sim.events.find(x => x.type === 'water').p;
        const back = V.norm([info.from[0] - e[0], 0, info.from[2] - e[2]]);
        let q = e.slice();
        for (let i = 0; i < 80 && surfAt(q[0], q[2]) === 'water'; i++) q = V.add(q, back);
        newBall = V.add(q, V.mul(back, 2)); newBall[1] = 0;
        note = 'water';
      } else if (sim.result === 'ob') {
        penalty = 1; newBall = info.from.slice(); note = 'ob';
      } else if (sim.result === 'holed') {
        newBall = [S.pin[0], 0, S.pin[1]];
      } else newBall = [rest[0], 0, rest[2]];
      S.strokes += penalty;
      const holed = sim.result === 'holed';
      if (S.spec.kind === 'round' && !info.putt) {
        const surfNow = holed ? 'green' : sim.result === 'rest' ? surfAt(newBall[0], newBall[2]) : 'x';
        if (info.lie === 'tee' && S.par >= 4 && S.fir == null) S.fir = surfNow === 'fairway';
        if ((surfNow === 'green' || holed) && S.strokes <= S.par - 2) S.gir = true;
      }
      const prox = holed ? 0 : Math.hypot(S.pin[0] - newBall[0], S.pin[1] - newBall[2]);
      const kind = S.spec.kind;
      // tap-ins: inside two feet in stroke play, it's in
      let gimme = false;
      if (!holed && (kind === 'round' || kind === 'updown') && sim.result === 'rest' && surfAt(newBall[0], newBall[2]) === 'green' && prox < 0.67) { gimme = true; S.strokes++; }
      if (kind === 'range' || kind === 'calibrate') return rangeAfter(sim, info);
      const entry = gradeShot(sim, info, prox, holed, note, gimme);
      S.log.push(entry);
      if (info.putt) S.putts++;
      // where we are now
      S.ball = newBall;
      const done = holed || gimme || kind === 'ctp' || kind === 'putting' || (kind === 'round' && S.strokes >= S.par + 4 && !holed) || (kind === 'updown' && S.strokes >= 5);
      showCard(entry, done, holed || gimme);
    }
    function gradeShot(sim, info, prox, holed, note, gimme) {
      const a = info.read;
      const club = P.CLUB[info.club];
      const e = { hole: S.holeId, club: info.club, putt: info.putt, read: a ? a.primary : null, prox, holed, note, gimme, strokes: S.strokes };
      if (info.putt) {
        const restP = sim.rest || [S.pin[0], 0, S.pin[1]];
        const dir = P.heading(S.aim.baseH);
        const along = (S.pin[0] - info.from[0]) * dir[0] + (S.pin[1] - info.from[2]) * dir[2];
        const restAlong = (restP[0] - info.from[0]) * dir[0] + (restP[2] - info.from[2]) * dir[2];
        // which side it passed on: find the path point nearest the hole
        let near = null, nd = 1e9;
        sim.path.forEach(q => { const d = Math.hypot(q.p[0] - S.pin[0], q.p[2] - S.pin[1]); if (d < nd) { nd = d; near = q.p; } });
        const side = near ? Math.sign((near[0] - S.pin[0]) * dir[2] - (near[2] - S.pin[1]) * dir[0]) : 0;
        const r = { holed, leave: prox, short: !holed && restAlong < along - 0.05, lowSide: a && a.putt && a.primary === 'breaker' && side === a.lowSide && nd > P.CUP };
        const j = Rd.judgePutt(a, r);
        e.grade = j.grade; e.why = j.why; e.type = 'putt';
        const ft = Math.max(1, Math.round(prox * 3));
        const tempo = info.tempo === 'quick' ? 'You jabbed at it. ' : info.tempo === 'decel' ? 'You decelerated through it. ' : '';
        e.text = holed ? `${tempo}${sim.events.some(x => x.type === 'lip') ? 'Caught the edge and dropped.' : 'Center cut.'} In the hole.` :
          `${tempo}${sim.events.some(x => x.type === 'lip') ? 'Lipped out. ' : ''}${r.short ? 'Came up short' : 'Rolled past'}, ${ft} ft away.${gimme ? ' Tap-in.' : ''}`;
        e.lesson = a ? Rd.PUTTS[a.primary].read : '';
        return e;
      }
      // more club means more distance than the still-air number: a longer club
      // swung full, or the same club swung past the notch. About 8% is a club.
      const powerRatio = info.power / Math.max(0.05, info.marker);
      const bl = P.baseLaunch(info.club, info.power, 'stock', 'fairway');
      const num = S.aim.toPin ? S.aim.tdist : S.aim.number;
      const clubs = (P.carryOf(bl.speed, bl.launch, bl.spin) / Math.max(5, num) - 1) / 0.08;
      const s = { type: info.type, shape: info.intended, aimOff: info.aimOff, powerRatio, clubs, more: clubs >= 0.5, less: clubs <= -0.5 };
      const j = a ? Rd.judge(a, s, { dogleg: S.hole.dogleg }) : { grade: 'A', why: '' };
      e.clubs = Math.round(clubs * 100) / 100;
      e.grade = j.grade; e.why = j.why; e.type = info.type; e.shape = info.shape;
      // what happened, in plain words
      const parts = [];
      const typeWord = info.type === 'knock' ? 'knockdown' : info.type === 'high' ? 'high' : '';
      const shapeWord = info.shape && info.shape !== 'hook' && info.shape !== 'slice' ? info.shape : info.shape;
      parts.push(`<b>${esc(club.name)}${typeWord ? ', ' + typeWord : ''}${shapeWord ? ', ' + shapeWord : ''}.</b> ${TEMPO_WORDS[info.tempo] || ''}`);
      const st = info.still;
      if (st && sim.land && S.windMph >= 3) {
        const long = sim.carry - st.carry;
        const side = lateral(sim.land, info.from, aimHeading()) - lateral(st.land, info.from, aimHeading());
        const bits = [];
        const sideTxt = Math.abs(side) >= 4 ? `pushed it ${Math.round(Math.abs(side))} yards ${side > 0 ? 'right' : 'left'}` : '';
        if (info.type === 'high' && long < -9) parts.push(`It climbed into the wind and lost ${Math.round(-long)} yards${sideTxt ? ', and the wind ' + sideTxt : ''}.`);
        else {
          if (Math.abs(long) >= 4) bits.push(long < 0 ? `knocked ${Math.round(-long)} yards off it` : `carried it ${Math.round(long)} yards further`);
          if (sideTxt) bits.push(sideTxt);
          if (bits.length) parts.push(`The wind ${bits.join(' and ')}.`);
        }
      }
      if (sim.events.some(x => x.type === 'tree')) parts.push('Clipped the trees.');
      if (holed) parts.push(S.strokes === 1 ? 'In the hole for an ace!' : 'In the hole!');
      else if (note === 'water') parts.push('In the water. Penalty stroke; you drop where it went in.');
      else if (note === 'ob') parts.push('Out of bounds. Penalty stroke, and you hit again from the same spot.');
      else {
        const rs = sim.rest;
        const surf = surfAt(rs[0], rs[2]);
        const where = surf === 'sand' ? 'in a bunker' : SURF_WORDS[surf] || 'in the rough';
        parts.push(`Carried ${Math.round(sim.carry)}, finished ${where}, ${distLabel(prox)} from the pin.${gimme ? ' Tap-in.' : ''}`);
      }
      e.text = parts.join(' ');
      e.lesson = a ? Rd.READS[a.primary].read : '';
      return e;
    }
    function showCard(entry, holeDone, holed) {
      const kind = S.spec.kind;
      S.phase = 'card';
      let k = '', btn = 'Next shot', extra = '';
      if (kind === 'round' || kind === 'updown') {
        k = kind === 'round' ? `Hole ${S.idx + 1} · ${S.hole.name} · Shot ${S.strokes}` : `Spot ${S.idx + 1} of ${S.spec.spots.length} · Shot ${S.strokes}`;
        if (holeDone) btn = S.idx + 1 >= listLen() ? 'See results' : (kind === 'round' ? 'Next hole' : 'Next spot');
      } else if (kind === 'ctp') { k = `Shot ${S.idx + 1} of ${S.spec.shots.length} · ${S.hole.name}`; btn = S.idx + 1 >= listLen() ? 'See results' : 'Next shot'; }
      else if (kind === 'putting') { k = `Putt ${S.idx + 1} of ${S.spec.putts.length}`; btn = S.idx + 1 >= listLen() ? 'See results' : 'Next putt'; }
      if (holeDone && (kind === 'round' || kind === 'updown')) {
        const strokes = S.strokes, diff = strokes - S.par;
        if (kind === 'round') {
          const capped = !holed;
          S.holes.push({ id: S.holeId, par: S.par, strokes, putts: S.putts, fir: S.fir, gir: S.gir });
          S.total += diff;
          setScore(toPar(S.total), 'to par');
          extra = capped ? `Picked up. ${strokes} on a par ${S.par}.` : `${scoreName(diff, strokes)}. ${strokes} on a par ${S.par}.`;
          if (holed && diff < 0) Sfx.play('cheer');
          banner(capped ? 'Picked up' : `Hole ${S.idx + 1}`, capped ? `${strokes}` : scoreName(diff, strokes), '', 1.6);
        } else {
          S.holes.push({ id: S.holeId, par: 2, strokes, upDown: holed && strokes <= 2 });
          S.total += strokes;
          setScore(String(S.total), 'strokes');
          extra = holed && strokes <= 2 ? 'Up and down.' : `${strokes} to get in.`;
        }
      }
      if (kind === 'ctp') {
        const ft = entry.note ? null : Math.round(entry.prox * 3);
        S.holes.push({ id: S.holeId, ft, holed: entry.holed });
        S.total += ft == null ? 100 : ft;
        setScore(String(S.total), 'feet total');
        extra = entry.holed ? 'Hole in one!' : ft == null ? 'No score: 100 ft penalty.' : `${ft} ft from the pin.`;
      }
      if (kind === 'putting') {
        S.holes.push({ made: entry.holed, leave: entry.prox });
        S.total += entry.holed ? 1 : 0;
        setScore(String(S.total), `made of ${S.idx + 1}`);
      }
      ui.card.innerHTML = `<div class="k">${esc(k)}</div><div class="w">${entry.text}</div>
        <div class="r"><span class="gx-grade ${entry.grade}">${entry.grade}</span><span><b>${esc(entry.why)}</b> ${esc(entry.lesson)}</span></div>
        <div class="row"><small>${esc(extra)}</small><button class="gx-btn" type="button">${esc(btn)}</button></div>`;
      ui.card.hidden = false;
      hint('');
      if (entry.grade === 'A') Sfx.play('great'); else if (entry.grade === 'B') Sfx.play('good');
      S.cardNext = () => {
        ui.card.hidden = true;
        if (holeDone) return next();
        newLie();
        glideTo(S.rig2 || aimRigNow(), 1.1);
        S.phase = 'settle';
        after(1.1, () => { S.phase = 'aim'; showAimUi(); });
      };
    }
    function listLen() {
      const k = S.spec.kind;
      return k === 'round' ? S.spec.holes.length : k === 'ctp' ? S.spec.shots.length : k === 'putting' ? S.spec.putts.length : k === 'updown' ? S.spec.spots.length : 1;
    }
    function next() {
      S.idx++;
      if (S.idx >= listLen()) return endSession();
      startItem(S.idx);
    }

    // set up the next shot from wherever the ball is now
    function newLie() {
      S.golfer = null;
      S.lie = surfAt(S.ball[0], S.ball[2]);
      if (S.lie === 'water' || S.lie === 'ob') S.lie = 'rough';
      S.lieKind = lieKindFor(S.lie, S.ball);
      setupAim(null);
      computeRead();
      updateHud();
      S.rig2 = aimRigNow();
      if (S.hole.green && pinDist() < 40) seedFlow();
      const k = S.spec.kind;
      if (k === 'round' || k === 'updown') {
        setTitle(k === 'round' ? `Hole ${S.idx + 1} · Par ${S.par}` : S.spec.title || 'Up and Down', `${S.hole.name} · Shot ${S.strokes + 1}`);
      }
    }
    function showAimUi() {
      ui.club.hidden = S.spec.kind === 'calibrate';
      ui.mapBtn.hidden = !!(S.hole.range || S.hole.putting || putting());
      updateClubUi(); updateHud();
      if (putting()) {
        if (!onceHint('putt', 'Pull back for pace, then push through. Lighter green is higher; the drifting specks roll downhill.')) hint('');
      } else if (S.lieKind === 'bunker') {
        if (!onceHint('bunker', 'In the sand: a long finish hits it high, and it needs more swing than the number.')) hint('');
      } else if (!onceHint('swing', 'Touch anywhere, pull straight down for your backswing, then swing up through it.')) {
        if (!onceHint('aim', 'Swipe sideways to aim. The arrows on the club change clubs.')) hint('');
      }
    }

    // ---------- the session ----------
    function setWind(prof) {
      const r = S.rand;
      const w = prof || { dir: [0, 360], mph: [0, 5] };
      const dir = w.dir[0] + (w.dir[1] - w.dir[0]) * r();
      const mph = w.mph[0] + (w.mph[1] - w.mph[0]) * r();
      S.windDir = (dir + 360) % 360; S.windMph = mph;
      const hd = P.heading(S.windDir);
      S.wind = [hd[0] * mph * P.MPH, 0, hd[2] * mph * P.MPH];
    }
    function setHole(id) {
      S.holeId = id; S.hole = C.HOLES[id];
      C.build(id);
      S.pin = S.hole.pin ? S.hole.pin.slice() : [0, 300];
      S.par = S.hole.par;
      S.slope = S.hole.green ? S.hole.green.slope.slice() : [0, 0];
      S.stimp = S.hole.green ? S.hole.green.stimp : 10;
      S.strokes = 0; S.putts = 0; S.fir = null; S.gir = false;
      seedFlow();
    }
    function startItem(i) {
      const k = S.spec.kind;
      ui.stats.hidden = true;
      S.shot = null; S.golfer = null;
      if (k === 'round') {
        setHole(S.spec.holes[i]);
        setWind(S.hole.wind);
        const tee = S.hole.line[0];
        S.ball = [tee[0], 0, tee[1]];
        const len = Math.round(C.lineInfo(S.hole.line, 0, 0).total);
        newLie();
        S.rig = S.rig2;
        setTitle(`Hole ${i + 1} · Par ${S.par}`, `${S.hole.name} · ${len} yds`);
        S.phase = 'intro';
        banner(`Hole ${i + 1} · Par ${S.par} · ${len} yards`, S.hole.name, S.hole.blurb, 2.2);
        after(2.2, () => { S.phase = 'aim'; showAimUi(); });
      } else if (k === 'ctp' || k === 'updown') {
        const item = k === 'ctp' ? S.spec.shots[i] : S.spec.spots[i];
        setHole(item.hole);
        setWind(item.wind || S.hole.wind);
        const b = item.ball || S.hole.line[0];
        S.ball = [b[0], 0, b[1]];
        if (k === 'updown') S.par = 2;
        newLie();
        S.rig = S.rig2;
        const d = Math.round(pinDist());
        setTitle(S.spec.title || (k === 'ctp' ? 'Closest to the Pin' : 'Up and Down'), k === 'ctp' ? `${S.hole.name} · ${d} yds` : `Spot ${i + 1} of ${S.spec.spots.length} · ${distLabel(d)} out`);
        S.phase = 'intro';
        banner(k === 'ctp' ? `Shot ${i + 1} of ${S.spec.shots.length} · ${d} yards` : `Spot ${i + 1} · ${distLabel(d)}`, S.hole.name, item.note || S.hole.blurb, 1.8);
        after(1.8, () => { S.phase = 'aim'; showAimUi(); });
      } else if (k === 'putting') {
        const pt = S.spec.putts[i];
        setHole('practice');
        S.slope = pt.slope.slice(); S.stimp = pt.stimp || 10;
        seedFlow();
        S.wind = [0, 0, 0]; S.windMph = 0;
        const hd = P.heading(pt.from || 0);
        S.pin = [0, 0];
        S.ball = [-hd[0] * pt.d, 0, -hd[2] * pt.d];
        newLie();
        S.rig = S.rig2;
        setTitle(S.spec.title || 'Putting Green', `Putt ${i + 1} of ${S.spec.putts.length} · ${Math.round(pt.d * 3)} ft`);
        S.phase = 'intro';
        const R = Rd.PUTTS[S.read.primary];
        banner(`Putt ${i + 1} of ${S.spec.putts.length}`, `${Math.round(pt.d * 3)} feet`, settings.showTags ? R.name : '', 1.4);
        after(1.4, () => { S.phase = 'aim'; showAimUi(); });
      }
    }
    function startRange() {
      setHole('range');
      S.wind = [0, 0, 0]; S.windMph = 0;
      S.rangeWind = 0;
      S.ball = [0, 0, 0];
      newLie();
      if (S.spec.kind === 'calibrate') setupAim('7i');
      S.rig = aimRigNow();
      if (S.spec.kind === 'calibrate') {
        setTitle('Find your swing', 'Swing 1 of 3');
        banner('Find your swing', 'Three full swings', 'Pull straight down as far as feels natural, then swing up through. Smooth, not hard. These set your full swing.', 3);
        S.phase = 'intro';
        after(2.4, () => { S.phase = 'aim'; showAimUi(); hint('Touch anywhere, pull straight down, then swing up through it'); });
      } else {
        setTitle(S.spec.title || 'The Range', 'Hit balls, read the numbers');
        S.phase = 'aim'; showAimUi();
      }
    }
    function rangeAfter(sim, info) {
      const L = info.launch;
      S.ball = [0, 0, 0];
      S.golfer = null;
      S.strokes = 0;
      if (S.spec.kind === 'calibrate') {
        const n = S.calib.length;
        if (n >= 3) {
          banner('', 'Got it', 'That is your full swing. Pull back less for shorter shots.', 1.6);
          S.phase = 'done';
          after(1.6, endSession);
          return;
        }
        setTitle('Find your swing', `Swing ${n + 1} of 3`);
        glideTo(aimRigNow(), 0.9);
        S.phase = 'settle';
        after(0.9, () => { S.phase = 'aim'; showAimUi(); });
        return;
      }
      const side = lateral(sim.land, info.from, aimHeading());
      const curve = side - Math.tan(L.start * Math.PI / 180) * sim.carry;
      ui.stats.hidden = false;
      ui.stats.innerHTML = `<div class="h">${esc(P.CLUB[info.club].name)} · ${esc(P.TYPES[info.type] ? P.TYPES[info.type].label : '')}${info.shape ? ' · ' + esc(info.shape) : ''} · ${esc(info.tempo)}</div>
        <div class="g"><div><b>${Math.round(sim.carry)}</b>carry</div><div><b>${Math.round(sim.total)}</b>total</div><div><b>${Math.round(sim.apex * 3)} ft</b>height</div>
        <div><b>${Math.abs(curve) < 1 ? 'straight' : Math.round(Math.abs(curve)) + (curve > 0 ? ' R' : ' L')}</b>curve</div><div><b>${Math.round(L.spin / 100) * 100}</b>spin rpm</div><div><b>${L.launch.toFixed(0)}°</b>launch</div></div>`;
      S.rangeCount = (S.rangeCount || 0) + 1;
      S.log.push({ club: info.club, carry: sim.carry, tempo: info.tempo });
      glideTo(aimRigNow(), 0.9);
      S.phase = 'settle';
      after(0.9, () => { S.phase = 'aim'; showAimUi(); });
    }

    function run(spec, handlers) {
      stop(true);
      S.spec = Object.assign({}, spec);
      S.onEnd = handlers && handlers.onEnd; S.onQuit = handlers && handlers.onQuit;
      S.rand = spec.seed != null ? mulberry(spec.seed) : Math.random;
      Object.assign(S, { t: 0, timers: [], popups: [], log: [], holes: [], idx: 0, total: 0, shot: null, golfer: null, live: null, calib: [], cardNext: null, ended: false, rangeCount: 0, glide: null });
      ['banner', 'hint', 'card', 'map', 'stats'].forEach(k => { ui[k].hidden = true; });
      ui.read.hidden = true;
      setScore(spec.kind === 'round' ? 'E' : '', spec.kind === 'round' ? 'to par' : '');
      S.running = true;
      S.last = performance.now();
      S.raf = requestAnimationFrame(frame);
      if (spec.kind === 'range' || spec.kind === 'calibrate') startRange();
      else startItem(0);
    }
    function summary(quit) {
      const k = S.spec ? S.spec.kind : null;
      const out = { kind: k, quit: !!quit, total: S.total, holes: S.holes, log: S.log };
      if (k === 'round') { out.strokes = S.holes.reduce((a, h) => a + h.strokes, 0); out.par = S.holes.reduce((a, h) => a + h.par, 0); }
      if (S.log.length) {
        const gp = { A: 4, B: 3, C: 2, D: 1, F: 0 };
        const graded = S.log.filter(l => l.grade);
        if (graded.length) out.readIQ = Math.round(graded.reduce((s, l) => s + gp[l.grade], 0) / graded.length * 25);
      }
      if (k === 'calibrate' && S.calib.length >= 3) {
        const med = key => { const a = S.calib.map(c => c[key]).sort((x, y) => x - y); return a[1]; };
        out.swing = { back: clamp(med('back'), 0.06, 0.36), rate: clamp(med('rate'), 3, 60), finish: clamp(med('finish'), 0.03, 0.4) };
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
    function stop() {
      S.running = false;
      cancelAnimationFrame(S.raf);
      S.timers = [];
      ui.map.hidden = true;
      hideBanner();
    }
    function destroy() { stop(); detach(); if (ro) ro.disconnect(); root.remove(); }

    function openMap() {
      if (!S.aim) return;
      const hd = P.heading(aimHeading());
      const aimPt = [S.ball[0] + hd[0] * S.aim.tdist, 0, S.ball[2] + hd[2] * S.aim.tdist];
      const w = Rd.windRel(S.wind, P.heading(S.aim.baseH));
      ui.map.innerHTML = `<h3>${esc(S.hole.name)}</h3>${C.mapSvg(S.holeId, { pin: S.pin, ball: S.ball, aim: aimPt })}<p>${esc(distLabel(pinDist()))} to the pin, ${esc(Rd.windWords(w))}. Tap to close.</p>`;
      ui.map.hidden = false;
    }

    // ---------- break specks: they drift downhill on the green ----------
    // the specks live in a box around the line from the ball to the cup
    function flowBox() {
      const b = S.ball, c = S.pin;
      const d = Math.max(2, Math.hypot(c[0] - b[0], c[1] - b[2]));
      const u = [(c[0] - b[0]) / d, (c[1] - b[2]) / d];
      return { b, u, n: [u[1], -u[0]], len: d + 4, wide: Math.max(2.5, d * 0.5) };
    }
    function spawnFlow(f, r) {
      const B = flowBox();
      const a = -1.5 + r() * B.len, w = (r() * 2 - 1) * B.wide;
      f.x = B.b[0] + B.u[0] * a + B.n[0] * w; f.z = B.b[2] + B.u[1] * a + B.n[1] * w; f.a = r();
    }
    function seedFlow() {
      S.flow = [];
      if (!(S.hole && S.hole.green)) return;
      const r = mulberry(7);
      for (let i = 0; i < 110; i++) { const f = {}; spawnFlow(f, r); S.flow.push(f); }
    }
    function updateFlow(dt) {
      if (!(S.hole && S.hole.green)) return;
      const sl = S.slope, m = Math.hypot(sl[0], sl[1]);
      S.flow.forEach(f => {
        f.a += dt * 0.4;
        if (m > 0.002) { const sp = 0.15 + m * 30; f.x -= sl[0] / m * sp * dt; f.z -= sl[1] / m * sp * dt; }
        if (f.a > 1) { spawnFlow(f, S.rand); f.a = 0; }
      });
    }

    // ---------- update ----------
    function update(dt) {
      S.t += dt;
      const due = S.timers.filter(x => x.at <= S.t);
      if (due.length) { S.timers = S.timers.filter(x => x.at > S.t); due.forEach(x => x.fn()); }
      if (S.glide) {
        S.glide.t += dt;
        const k = ease(Math.min(1, S.glide.t / S.glide.dur));
        S.rig = C.blendRig(S.glide.from, S.glide.to, k);
        if (k >= 1) S.glide = null;
      }
      if (S.phase === 'flight' && S.shot) updateFlight(dt);
      if (S.golfer) S.golfer.t += dt;
      S.popups.forEach(p => { p.t += dt; });
      S.popups = S.popups.filter(p => p.t < p.life);
      updateFlow(dt);
    }

    // ---------- render ----------
    function frame(now) {
      if (!S.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - S.last) / 1000)) * (S.speed || 1);
      S.last = now;
      // one bad frame shouldn't freeze the round: report it and keep going
      try { update(dt); if (S.running) render(); } catch (e) { if (!S.frameErr) { S.frameErr = 1; console.error(e); } }
      if (S.running) S.raf = requestAnimationFrame(frame);
    }
    function render() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!S.rig || !S.hole) { ctx.fillStyle = '#0f2a1e'; ctx.fillRect(0, 0, W, H); return; }
      const cam = C.lookCam(S.rig, W, H);
      C.drawSky(ctx, cam, S.t, S.wind);
      C.drawHole(ctx, cam, S.holeId, { t: S.t, slope: S.slope, focus: putting() ? [(S.ball[0] + S.pin[0]) / 2, (S.ball[2] + S.pin[1]) / 2, Math.max(3, pinDist())] : null });
      const showPutt = putting() && (S.phase === 'aim' || S.phase === 'swing' || (S.shot && S.shot.putt) || S.phase === 'intro');
      if (S.hole.green && (showPutt || pinDist() < 45)) drawFlow(cam);
      if ((S.phase === 'aim' || S.phase === 'swing') && S.aim) drawAimLine(cam);
      const items = C.standing(ctx, cam, S.holeId, { t: S.t, pin: S.hole.range ? null : S.pin, wind: S.wind, windMph: S.windMph, windDir: (S.windDir - (S.aim ? aimHeading() : 0)), putting: showPutt });
      // the ball, wherever it is
      const bp = S.shot ? S.shot.pos || S.ball : S.ball;
      const bc = C.toCam(cam, bp);
      const overlayBall = !putting() && !S.shot && (S.phase === 'aim' || S.phase === 'swing' || S.phase === 'intro');
      if (bc[2] > 0.4 && !overlayBall) items.push({ z: bc[2], draw: () => { if (!(S.shot && S.shot.sim.result === 'holed' && S.shot.t > S.shot.sim.t)) C.drawBallAt(ctx, cam, bp, { minR: S.shot && !S.shot.putt ? 2.8 : 2.4 }); } });
      items.sort((a, b) => b.z - a.z).forEach(it => it.draw());
      if (S.shot && !S.shot.putt) drawTracer(cam);
      const showGolfer = !putting() && S.spec && (S.phase === 'aim' || S.phase === 'swing' || S.phase === 'intro' || (S.phase === 'flight' && S.golfer && S.golfer.t < 1.6));
      if (showGolfer) drawGolfer();
      if (showPutt && (S.phase === 'aim' || S.phase === 'swing')) drawPuttMeter(cam);
      drawPopups(cam);
    }
    // little streaks that drift downhill: the slope you have to read
    function drawFlow(cam) {
      const sl = S.slope, m = Math.hypot(sl[0], sl[1]);
      if (m < 0.002) return;
      const d = [-sl[0] / m, -sl[1] / m], L = 0.12 + m * 9;
      ctx.save(); ctx.lineCap = 'round';
      S.flow.forEach(f => {
        if (C.surfaceAt(S.holeId, f.x, f.z) !== 'green') return;
        const q = C.project(cam, [f.x, 0.01, f.z]), q2 = C.project(cam, [f.x + d[0] * L, 0.01, f.z + d[1] * L]);
        if (!q || !q2 || q.y < 0 || q.y > H) return;
        const al = Math.sin(Math.PI * f.a) * 0.7;
        ctx.strokeStyle = `rgba(255,255,255,${al.toFixed(3)})`;
        ctx.lineWidth = Math.max(1, Math.min(2.6, 0.05 * q.s));
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
      });
      ctx.restore();
    }
    function drawAimLine(cam) {
      const a = S.aim;
      const hd = P.heading(aimHeading());
      const len = putting() ? a.tdist : a.number;
      const end = [S.ball[0] + hd[0] * len, 0, S.ball[2] + hd[2] * len];
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.setLineDash([6, 7]);
      const steps = 12;
      const st = putting() ? S.ball : V.lerp3(S.ball, end, Math.min(0.3, 6 / Math.max(6, len)));
      for (let i = 0; i < steps; i++) {
        const p0 = V.lerp3(st, end, i / steps), p1 = V.lerp3(st, end, (i + 1) / steps);
        p0[1] = p1[1] = 0.02;
        C.groundLine(ctx, cam, p0, p1);
      }
      ctx.setLineDash([]);
      if (!putting()) {
        // landing ring at your number
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const ang = i / 24 * Math.PI * 2;
          const rr = clamp(len * 0.022, 0.6, 3);
          const q = C.project(cam, [end[0] + Math.cos(ang) * rr, 0.02, end[2] + Math.sin(ang) * rr]);
          if (!q) continue;
          i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawTracer(cam) {
      const sh = S.shot, sim = sh.sim;
      const air = sim.landT || sim.t;
      const upto = Math.min(sh.t, air);
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const fade = sh.t > air ? Math.max(0, 1 - (sh.t - air) / 2.5) : 1;
      if (fade <= 0) { ctx.restore(); return; }
      const pts = [];
      for (const q of sim.path) { if (q.t > upto) break; const pr = C.project(cam, q.p); if (pr) pts.push(pr); }
      const cur = C.project(cam, ballAt(sim, upto));
      if (cur) pts.push(cur);
      if (pts.length > 1) {
        ctx.strokeStyle = `rgba(255,214,90,${0.35 * fade})`; ctx.lineWidth = 6;
        ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
        ctx.strokeStyle = `rgba(255,248,220,${0.95 * fade})`; ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawPopups(cam) {
      S.popups.forEach(p => {
        const k = p.t / p.life;
        let x = W / 2, y = H * 0.4;
        if (p.world) { const q = C.project(cam, [p.world[0], (p.world[1] || 0) + 3, p.world[2]]); if (q) { x = q.x; y = q.y; } }
        y -= k * 30;
        ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
        ctx.font = `800 ${Math.round(22 * p.size)}px ${DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(p.text, x, y);
        ctx.fillStyle = p.color; ctx.fillText(p.text, x, y);
        ctx.globalAlpha = 1;
      });
    }

    // The golfer, drawn the way TV shows a swing from behind: standing left of
    // the ball, the club swinging up behind on the way back and up over the
    // front shoulder on the way through.
    function golferFrame() {
      const u = Math.min(H * 0.3, W * 0.66);
      const bx = W * 0.5, by = H * 0.865;
      const pt = (x, y) => [bx + x * u, by + y * u];
      return { u, bx, by, pt };
    }
    function drawGolfer() {
      const F = golferFrame(), u = F.u, pt = F.pt;
      const cal = swingCal();
      const SPAN = 190 * Math.PI / 180;
      let back = 0, thru = 0, finishK = 0, alpha = 1;
      if (S.phase === 'swing' && S.live) {
        back = clamp(S.live.back / cal.back, 0, 1.25);
        if (S.live.through) back *= Math.max(0, 1 - S.live.rise / Math.max(0.02, S.live.back));
      } else if (S.golfer) {
        const t = S.golfer.t, fb = clamp(S.golfer.from / cal.back, 0, 1.25);
        if (t < 0.08) back = fb * (1 - t / 0.08);
        else { const ft = { knock: 0.42, stock: 0.85, high: 1.02 }[S.golfer.finish] || 0.85; finishK = ft * smooth((t - 0.08) / 0.32); }
        if (S.phase === 'flight' && t > 1.1) alpha = Math.max(0, 1 - (t - 1.1) / 0.5);
      }
      thru = finishK;
      const shoulder = pt(-0.27 + thru * 0.05, -0.74 - thru * 0.06);
      const ball = [F.bx, F.by];
      const L = Math.hypot(ball[0] - shoulder[0], ball[1] - shoulder[1]);
      const a0 = Math.atan2(F.by - pt(-0.27, -0.74)[1], F.bx - pt(-0.27, -0.74)[0]);
      const ang = a0 + back * SPAN - thru * 170 * Math.PI / 180;
      ctx.save();
      ctx.globalAlpha = alpha;
      // lie under the ball: a patch of whatever you're standing in
      drawLiePatch(F);
      const hip = pt(-0.43 + thru * 0.04, -0.4);
      const head = [shoulder[0] + 0.07 * u + thru * 0.02 * u, shoulder[1] - 0.12 * u - thru * 0.02 * u];
      const fa = pt(-0.52, 0.04), fb2 = pt(-0.36, 0.05);
      const ka = pt(-0.44, -0.18), kb = pt(-0.32, -0.19 + thru * 0.03);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // legs
      ctx.strokeStyle = '#3b3f3a'; ctx.lineWidth = 0.075 * u;
      ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(ka[0], ka[1]); ctx.lineTo(fa[0], fa[1]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hip[0] + 0.03 * u, hip[1]); ctx.lineTo(kb[0], kb[1]); ctx.lineTo(fb2[0], fb2[1] - thru * 0.04 * u); ctx.stroke();
      ctx.fillStyle = '#f4f4f0';
      [fa, fb2].forEach((f, i) => { ctx.beginPath(); ctx.ellipse(f[0] + 0.03 * u, f[1] - (i ? thru * 0.04 * u : 0), 0.06 * u, 0.025 * u, 0, 0, Math.PI * 2); ctx.fill(); });
      // torso
      ctx.strokeStyle = settings.shirt; ctx.lineWidth = 0.14 * u;
      ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(shoulder[0] - 0.02 * u, shoulder[1] + 0.03 * u); ctx.stroke();
      // arms and club: one lever from the shoulders
      const dir = [Math.cos(ang), Math.sin(ang)];
      const hands = [shoulder[0] + dir[0] * L * 0.42, shoulder[1] + dir[1] * L * 0.42];
      const head2 = [shoulder[0] + dir[0] * L, shoulder[1] + dir[1] * L];
      ctx.strokeStyle = '#c99a6e'; ctx.lineWidth = 0.05 * u;
      ctx.beginPath(); ctx.moveTo(shoulder[0], shoulder[1]); ctx.lineTo(hands[0], hands[1]); ctx.stroke();
      ctx.strokeStyle = settings.shirt; ctx.lineWidth = 0.06 * u;
      ctx.beginPath(); ctx.moveTo(shoulder[0], shoulder[1]); ctx.lineTo(shoulder[0] + dir[0] * L * 0.15, shoulder[1] + dir[1] * L * 0.15); ctx.stroke();
      ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = Math.max(1.5, 0.012 * u);
      ctx.beginPath(); ctx.moveTo(hands[0], hands[1]); ctx.lineTo(head2[0], head2[1]); ctx.stroke();
      ctx.fillStyle = '#2b2f36';
      ctx.save(); ctx.translate(head2[0], head2[1]); ctx.rotate(ang + Math.PI / 2); ctx.fillRect(-0.035 * u, -0.012 * u, 0.07 * u, 0.026 * u); ctx.restore();
      ctx.fillStyle = '#f3f2ee';
      ctx.beginPath(); ctx.arc(hands[0], hands[1], 0.028 * u, 0, Math.PI * 2); ctx.fill();
      // head and cap
      ctx.fillStyle = '#c99a6e';
      ctx.beginPath(); ctx.arc(head[0], head[1], 0.06 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = settings.cap;
      ctx.beginPath(); ctx.arc(head[0], head[1] - 0.012 * u, 0.062 * u, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(head[0], head[1] - 0.02 * u, 0.09 * u, 0.018 * u);
      ctx.restore();
      // the ghost arc: how far back you are, with a notch at your number
      if (S.phase === 'aim' || S.phase === 'swing') drawArcMeter(pt(-0.27, -0.74), L * 0.56, a0, SPAN, back, S.spec.kind === 'calibrate');
      // the ball at your feet, until it's gone
      if (S.phase !== 'flight' || (S.golfer && S.golfer.t < 0.09)) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(F.bx, F.by - 0.022 * u, 0.022 * u, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    function drawLiePatch(F) {
      const u = F.u, lie = S.lie;
      const col = lie === 'sand' ? ['#e6d4a0', '#d8c28a'] : lie === 'rough' ? ['#3f7c35', '#356e2d'] : lie === 'tee' ? ['#78bf5a', '#6cb251'] : ['#6fb552', '#64a84a'];
      const g = ctx.createRadialGradient(F.bx - 0.15 * u, F.by + 0.02 * u, 0.05 * u, F.bx - 0.15 * u, F.by + 0.02 * u, 0.7 * u);
      g.addColorStop(0, col[0]); g.addColorStop(0.7, col[1]); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(F.bx - 0.15 * u, F.by + 0.02 * u, 0.75 * u, 0.2 * u, 0, 0, Math.PI * 2); ctx.fill();
      if (lie === 'rough') {
        ctx.strokeStyle = 'rgba(30,70,25,0.8)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 26; i++) {
          const x = F.bx - 0.5 * u + (i / 26) * 0.75 * u, y = F.by + 0.03 * u + Math.sin(i * 7.3) * 0.03 * u;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(i * 3.1) * 4, y - 0.05 * u); ctx.stroke();
        }
      }
      if (lie === 'tee') { ctx.fillStyle = '#ffffff'; ctx.fillRect(F.bx - 1.5, F.by - 0.01 * u, 3, 0.02 * u); }
    }
    function drawArcMeter(sh, L, a0, SPAN, back, noMarker) {
      const a = S.aim;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(sh[0], sh[1], L, a0, a0 + SPAN * 1.18); ctx.stroke();
      if (back > 0.01) {
        ctx.strokeStyle = back > 1.02 ? 'rgba(255,122,92,0.95)' : 'rgba(255,236,170,0.95)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(sh[0], sh[1], L, a0, a0 + SPAN * Math.min(1.18, back)); ctx.stroke();
      }
      // full swing tick
      const tick = (k, len, col, w) => {
        const an = a0 + SPAN * k;
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(sh[0] + Math.cos(an) * (L - len), sh[1] + Math.sin(an) * (L - len)); ctx.lineTo(sh[0] + Math.cos(an) * (L + len), sh[1] + Math.sin(an) * (L + len)); ctx.stroke();
        return an;
      };
      tick(1, 7, 'rgba(255,255,255,0.6)', 2);
      if (!noMarker && a && !putting()) {
        const k = clamp(a.marker, 0, 1.18);
        const an = tick(k, 11, '#f2c94c', 4);
        let lx = sh[0] + Math.cos(an) * (L + 24), ly = sh[1] + Math.sin(an) * (L + 24);
        if (lx < 22) { lx = sh[0] + Math.cos(an) * (L - 24); ly = sh[1] + Math.sin(an) * (L - 24); }
        ctx.font = `800 15px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        const txt = String(Math.round(a.number));
        ctx.strokeText(txt, lx, ly); ctx.fillStyle = '#f2c94c'; ctx.fillText(txt, lx, ly);
        ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    }
    // Putting: a pace rail under the ball, with a notch for this putt's length.
    function drawPuttMeter(cam) {
      const a = S.aim, cal = swingCal();
      const q = C.project(cam, S.ball);
      if (!q) return;
      const pxPer = H * cal.back;
      const back = S.phase === 'swing' && S.live ? S.live.back / cal.back : 0;
      const x = q.x - 46, y0 = Math.min(q.y, H - pxPer * 1.15 - 24);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pxPer * 1.1); ctx.stroke();
      if (back > 0) {
        ctx.strokeStyle = back > 1.02 ? '#ff7a5c' : '#ffecaa';
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + pxPer * Math.min(1.1, back)); ctx.stroke();
      }
      const my = y0 + pxPer * Math.min(1.1, a.marker);
      ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x - 9, my); ctx.lineTo(x + 9, my); ctx.stroke();
      ctx.font = `800 14px ${DISPLAY}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      const txt = `${Math.round(a.tdist * 3)} ft`;
      ctx.strokeText(txt, x - 14, my); ctx.fillStyle = '#f2c94c'; ctx.fillText(txt, x - 14, my);
      // the putter head, drawn back with your stroke
      const ph = q.y + 6 + back * Math.min(pxPer, 120) * 0.35;
      ctx.fillStyle = '#2b2f36';
      ctx.fillRect(q.x - 16, ph, 32, 7);
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(q.x - 2, ph + 7, 4, 40);
      ctx.restore();
    }

    function setSettings(o) { Object.assign(settings, o || {}); }

    return { run, stop, destroy, setSettings, settings, _S: S };
  }

  return { create, FEEL };
})();
