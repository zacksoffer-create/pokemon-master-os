/* PongEngine: runs any pong "spec" (a game described as data) inside a container.

   spec.kind:
     game       you vs a computer opponent: { opponent }
     attack     clear a rack in as few throws as you can (Rack Attack)
     shots      a drill: { form, targets, balls, opponent, island, bounceTwo } (Island mode)
     practice   free throwing at a rack you can change
     calibrate  three easy arcs at the head cup to find your touch */
const PongEngine = (() => {
  const { V, CUP, R } = PongPhysics;
  const FEEL = {
    arcade: { snap: 0.14, fast: 0.14, label: 'Arcade' },
    normal: { snap: 0.1, fast: 0.1, label: 'Normal' },
    pro: { snap: 0.07, fast: 0.07, label: 'Pro' }
  };
  const SHOT = { arc: 'Arc', fast: 'Fastball', bounce: 'Bounce' };

  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
.px{position:absolute;inset:0;overflow:hidden;background:#0d0a12;color:#f6efe4;font-family:"Work Sans",system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.px canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.px-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 24px max(14px,env(safe-area-inset-left,0px));pointer-events:none;background:linear-gradient(rgba(8,5,12,.7),rgba(8,5,12,0))}
.px-quit{pointer-events:auto;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(14,9,18,.6);color:#f6efe4;font:600 18px/1 "Work Sans",sans-serif;cursor:pointer}
.px-quit:focus-visible,.px-btn:focus-visible,.px-opt:focus-visible,.px-tool:focus-visible{outline:2px solid #ffcf6b;outline-offset:2px}
.px-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.px-title b{font:400 17px/1.05 "Bungee",Impact,sans-serif;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.px-title span{font:500 13px/1.25 "Work Sans",sans-serif;opacity:.85}
.px-score{text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.6);flex:none}
.px-score-n{display:block;font:400 36px/0.95 "Bungee",Impact,sans-serif;font-variant-numeric:tabular-nums;color:#ffcf6b}
.px-score small{font:600 11px/1.2 "Work Sans",sans-serif;letter-spacing:.06em;text-transform:uppercase;opacity:.8}
.px-cups{display:flex;gap:6px}
.px-cups span{display:flex;flex-direction:column;align-items:center;min-width:44px;padding:5px 7px 4px;border-radius:9px;background:rgba(14,9,18,.72);border:1px solid rgba(255,255,255,.16)}
.px-cups b{font:400 22px/1 "Bungee",Impact,sans-serif;font-variant-numeric:tabular-nums}
.px-cups i{font:700 10px/1.2 "Work Sans",sans-serif;font-style:normal;letter-spacing:.08em;text-transform:uppercase;opacity:.8;margin-top:2px}
.px-cups .him b{color:#ff9a7a} .px-cups .you b{color:#ffcf6b}
.px-chips{position:absolute;left:max(14px,env(safe-area-inset-left,0px));right:40%;top:calc(98px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;align-items:flex-start;gap:6px;pointer-events:none}
.px.modal .px-chips{display:none}
.px-chip{padding:5px 10px;border-radius:999px;font:600 12px/1.1 "Work Sans",sans-serif;letter-spacing:.02em;background:rgba(14,9,18,.72);border:1px solid rgba(255,255,255,.18)}
.px-chip b{font-weight:800;text-transform:uppercase;letter-spacing:.05em}
.px-chip.open{color:#7ee2a8;border-color:rgba(126,226,168,.5)} .px-chip.hot{color:#ff8a5c;border-color:rgba(255,138,92,.6)} .px-chip.warm{color:#ffcf6b;border-color:rgba(255,207,107,.5)}
.px-tool{pointer-events:auto;cursor:pointer;color:#f6efe4}
.px-banner{position:absolute;left:0;right:0;top:17%;text-align:center;pointer-events:none;padding:0 18px}
.px-banner .k{display:block;font:600 13px/1.2 "Work Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffcf6b;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.px-banner .h{display:block;margin-top:4px;font:400 clamp(28px,8.5vw,46px)/1 "Bungee",Impact,sans-serif;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.8);text-wrap:balance}
.px-banner .s{display:block;margin:8px auto 0;max-width:30ch;font:500 15px/1.35 "Work Sans",sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.95)}
.px-banner.pop{animation:pxpop .35s ease-out}
@keyframes pxpop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
.px-hint{position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);padding:7px 12px;border-radius:10px;background:rgba(14,9,18,.72);font:500 13px/1.35 "Work Sans",sans-serif;text-align:center;pointer-events:none;color:#efe6d8}
.px-card{position:absolute;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:14px 16px 12px;border-radius:14px;background:rgba(22,15,26,.95);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.5);animation:pxup .25s ease-out}
@keyframes pxup{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.px-card .k{font:600 11px/1.2 "Work Sans",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#ffcf6b}
.px-card .w{margin-top:5px;font:600 16px/1.35 "Work Sans",sans-serif}
.px-card .r{display:flex;gap:10px;align-items:flex-start;margin-top:9px;font:400 14px/1.4 "Work Sans",sans-serif;color:#d9cfdf}
.px-grade{flex:none;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;font:400 20px/1 "Bungee",Impact,sans-serif;color:#120d18;background:#7ee2a8}
.px-grade.B{background:#c5e27e}.px-grade.C{background:#ffd166}.px-grade.D{background:#ff9a66}.px-grade.F{background:#ff5d4a}
.px-card .row{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
.px-btn{pointer-events:auto;cursor:pointer;border:0;border-radius:10px;padding:11px 18px;background:#ffcf6b;color:#1d1206;font:400 14px/1 "Bungee",Impact,sans-serif;letter-spacing:.04em;text-transform:uppercase}
.px-btn.ghost{background:transparent;color:#f6efe4;border:1px solid rgba(255,255,255,.3)}
.px-pick{position:absolute;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:14px 14px 12px;border-radius:14px;background:rgba(22,15,26,.96);border:1px solid rgba(255,207,107,.35);box-shadow:0 10px 30px rgba(0,0,0,.5);animation:pxup .25s ease-out}
.px-pick h3{margin:0;font:400 20px/1 "Bungee",Impact,sans-serif;text-transform:uppercase;color:#ffcf6b}
.px-pick p{margin:6px 0 10px;font:500 14px/1.35 "Work Sans",sans-serif;color:#d9cfdf}
.px-opts{display:grid;gap:8px}
.px-opt{pointer-events:auto;cursor:pointer;display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;text-align:left;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:#f6efe4;font:inherit}
.px-opt:hover{background:rgba(255,255,255,.08)}
.px-opt svg{width:56px;height:56px}
.px-opt b{display:block;font:400 15px/1.1 "Bungee",Impact,sans-serif;text-transform:uppercase}
.px-opt small{display:block;margin-top:3px;font:400 13px/1.3 "Work Sans",sans-serif;color:#cbbfd2}
`;
    document.head.appendChild(st);
  }

  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;

  // a formation as a little diagram, for the re-rack picker
  function formSvg(id) {
    const F = Pong.FORMATIONS[id];
    const xs = F.cups.map(c => c[0]), ds = F.cups.map(c => c[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cd = (Math.min(...ds) + Math.max(...ds)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ds) - Math.min(...ds)) + 1;
    const k = 44 / span;
    return `<svg viewBox="0 0 56 56" aria-hidden="true"><rect x="2" y="2" width="52" height="52" rx="8" fill="#17463a"/>${F.cups.map(([x, d]) => `<circle cx="${(28 + (x - cx) * k).toFixed(1)}" cy="${(28 + (d - cd) * k).toFixed(1)}" r="${(k * 0.46).toFixed(1)}" fill="#d8312d" stroke="#fbf8f2" stroke-width="1.5"/>`).join('')}</svg>`;
  }

  function create(container, opts) {
    injectCss();
    const settings = Object.assign({ touchK: 1.5, L0: 0.3, S0: 2.2, feel: 'normal', showTags: true, hints: true, seen: {} }, opts || {});
    const root = document.createElement('div');
    root.className = 'px';
    root.innerHTML = `
      <canvas></canvas>
      <div class="px-top"><button class="px-quit" type="button" aria-label="Leave this game">&#x2715;</button><div class="px-title"><b></b><span></span></div><div class="px-score"><span class="px-score-n"></span><small></small><div class="px-cups" hidden><span class="him"><b></b><i>Him</i></span><span class="you"><b></b><i>You</i></span></div></div></div>
      <div class="px-chips"><button class="px-chip px-tool" type="button" hidden></button><div class="px-chip px-state" hidden></div><div class="px-chip px-arms" hidden></div></div>
      <div class="px-banner" hidden></div>
      <div class="px-hint" hidden></div>
      <div class="px-card" hidden></div>
      <div class="px-pick" hidden></div>`;
    container.appendChild(root);
    const $ = s => root.querySelector(s);
    const canvas = $('canvas'), ctx = canvas.getContext('2d');
    const ui = {
      title: $('.px-title b'), sub: $('.px-title span'), score: $('.px-score-n'), scoreSub: $('.px-score small'), cups: $('.px-cups'), cupsHim: $('.px-cups .him b'), cupsYou: $('.px-cups .you b'),
      tool: $('.px-tool'), state: $('.px-state'), arms: $('.px-arms'),
      banner: $('.px-banner'), hint: $('.px-hint'), card: $('.px-card'), pick: $('.px-pick'), quit: $('.px-quit')
    };
    let W = 360, H = 640, DPR = 1;
    const S = { running: false, t: 0, balls: [], popups: [], timers: [], far: [], near: [], phase: 'idle', camK: 0, camTo: 0 };

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
    function showCard(html, next) { ui.card.innerHTML = html; ui.card.hidden = false; root.classList.add('modal'); S.cardNext = next; }
    function hint(text, dur) {
      ui.hint.textContent = text || ''; ui.hint.hidden = !text;
      clearTimeout(hint._t);
      if (text && dur) hint._t = setTimeout(() => { ui.hint.hidden = true; }, dur * 1000);
    }
    function setTitle(a, b) { ui.title.textContent = a || ''; ui.sub.textContent = b || ''; }
    function popup(text, color, size, world, life) { S.popups.push({ text, color: color || '#fff', size: size || 1, t: 0, life: life || 1.3, world }); }
    const live = cups => cups.filter(c => c.live);
    function oneTimeHint(key, text) {
      if (!settings.hints || settings.seen[key]) return false;
      settings.seen[key] = 1;
      hint(text, 6);
      return true;
    }

    // ---------- input ----------
    const detach = Gesture.attach(canvas, {
      down() { PongSfx.unlock(); },
      gesture(g) {
        if (!S.running) return;
        if (g.type === 'flick') return onFlick(g);
        if (g.type === 'swipe' && g.dir === 'down' && S.phase === 'aim') hint('Pull down, then flick up, to bounce it.', 3);
      }
    });
    ui.quit.addEventListener('click', () => { PongSfx.play('ui'); const q = S.onQuit; stop(); q && q(summary(true)); });
    ui.card.addEventListener('click', e => { if (e.target.closest('button') && S.cardNext) { const f = S.cardNext; S.cardNext = null; ui.card.hidden = true; root.classList.remove('modal'); PongSfx.play('ui'); f(); } });
    ui.pick.addEventListener('click', e => {
      const b = e.target.closest('[data-form]');
      if (!b || !S.pickNext) return;
      const f = S.pickNext; S.pickNext = null; ui.pick.hidden = true; root.classList.remove('modal'); PongSfx.play('ui');
      f(b.dataset.form);
    });
    ui.tool.addEventListener('click', () => {
      if (S.spec.kind !== 'practice' || S.phase !== 'aim') return;
      PongSfx.play('rack');
      const order = ['tri10', 'pyr6', 'zip6', 'diamond4', 'line4', 'tri3', 'line3', 'stack2', 'wall2', 'island1'];
      S.practiceForm = order[(order.indexOf(S.practiceForm) + 1) % order.length];
      S.far = Pong.layout(S.practiceForm, 'far');
      updateTool();
    });
    function updateTool() { ui.tool.innerHTML = `Rack: <b>${esc(Pong.FORMATIONS[S.practiceForm].name)}</b> &#x25B8;`; }

    // ---------- the throw ----------
    function shotKind(g) {
      if (g.fade) return 'bounce';
      if (S.spec.kind === 'calibrate') return 'arc';
      const h = Math.max(320, window.innerHeight || 800);
      // a short, sharp flick is a fastball; a full flick is an arc
      const len = g.dist / h;
      if (len >= Math.max(0.07, settings.L0 * 0.6)) return 'arc';
      return g.speed >= settings.S0 * 0.6 ? 'fast' : 'softsnap';
    }
    function armsUp() { return S.opp && S.opp.wave ? Math.sin(S.t * Math.PI * 2 / 1.9 + 0.4) > 0.12 : false; }
    function onFlick(g) {
      if (S.phase !== 'aim') return;
      // short but not quick: it goes as a weak arc, and the meter says why
      const softSnap = shotKind(g) === 'softsnap';
      const kind = softSnap ? 'arc' : shotKind(g);
      const feel = FEEL[settings.feel] || FEEL.normal;
      const calibrating = S.spec.kind === 'calibrate';
      const up = armsUp();
      const contest = up ? 1 : 0;
      const heat = S.fire ? 1.25 : S.streak === 2 ? 1.1 : 1;
      const mult = heat * (1 - 0.5 * contest);
      const h = Math.max(320, window.innerHeight || 800);
      let p = g.power / settings.touchK;
      if (calibrating) {
        S.calib.push({ power: g.power, len: g.dist / h, speed: g.speed });
        p = 1;
      }
      const cups = live(S.far);
      const shot = PongPhysics.throwBall({ kind, side: 'near', cups, p, angle: calibrating ? 0 : g.angle * 180 / Math.PI, curl: calibrating ? 0 : g.curl, snap: feel.snap * mult, fastWindow: feel.fast * mult, contest, rand: S.rand });
      const tcup = cups.find(c => c.id === shot.target) || null;
      const exp = tcup ? Pong.exposure(tcup, S.far, 'far') : null;
      const wild = !tcup || Math.hypot(shot.intended[0] - tcup.x, shot.intended[1] - tcup.z) > 0.55;
      const spun = shot.touch >= 0.3 || shot.spinOut > 0;
      const info = { kind, target: shot.target, exposure: exp, spun, armsUp: up, wild, green: shot.green, row: tcup ? cupLabel(tcup, S.far) : null };
      const held = heldBallScreen();
      const b = PongPhysics.newBall(shot.release, shot.vel, { touch: shot.touch, spinOut: shot.spinOut, spinDir: shot.spinDir, by: 'you', info, appear: 0.12, sx: held.x, sy: held.y, sr: held.r, trail: [] });
      S.balls.push(b);
      if (softSnap) shot.feedback = 'Arc · Too soft for a fastball';
      S.meter = { shot, t: 0, calibrating, kind };
      S.phase = 'flight';
      S.hasBall = false; S.follow = 0;
      S.throwsUsed++;
      PongSfx.play('release');
      hint('');
      if (up) popup('Into his arms', '#ff9a66', 0.8, [0, 1.6, 7.6], 1.1);
    }
    function cupLabel(c, cups) {
      const L = live(cups);
      if (L.length === 1) return 'the last cup';
      const exp = Pong.exposure(c, cups, c.side);
      const zs = L.map(x => x.z);
      const front = c.side === 'far' ? Math.min(...zs) : Math.max(...zs), back = c.side === 'far' ? Math.max(...zs) : Math.min(...zs);
      if (exp === 'island') return 'the island';
      if (Math.abs(c.z - front) < 0.05) return exp === 'front' ? 'the front cup' : 'a front cup';
      if (Math.abs(c.z - back) < 0.05) return 'a back cup';
      return exp === 'front' ? 'a naked cup' : 'a buried cup';
    }

    // ---------- balls ----------
    function cupsFor(b) { return b.cupsOff ? [] : (b.by === 'cpu' ? S.near : S.far); }
    function updateBalls(dt) {
      S.balls.forEach(b => {
        if (b.swatAt && S.t >= b.swatAt && !b.swatted) {
          b.swatted = true; b.cupsOff = true; b.inCup = null;
          b.v = [(S.rand() - 0.5) * 7, 4.5, -8];
          popup('Swatted', '#ff7a66', 1.2, V.add(b.p, [0, 0.8, 0]));
          PongSfx.play('swat'); PongSfx.buzz(30);
        }
        if (b.hold && S.t >= b.hold && !b.blown) {
          // house rules: it was spinning, so he blows it out
          b.blown = true; b.hold = null; b.cupsOff = true;
          const c = S.far.find(x => x.id === b.sunk);
          if (c) { c.ballIn = null; c.live = true; }
          b.sunk = null; b.inCup = null; b.result = null; b.doneAt = null;
          b.p[1] = CUP.h + 0.06; b.v = [(S.rand() - 0.5) * 2.5, 6.5, -3];
          popup('Blown out', '#ff7a66', 1.15, V.add(b.p, [0, 0.7, 0]));
          PongSfx.play('blow');
        }
        PongPhysics.advance(b, dt, cupsFor(b));
        b.events.forEach(ev => {
          if (ev.type === 'bounce') {
            PongSfx.play('tock', ev.s);
            if (b.by === 'you' && b.bounces === 1 && S.opp && S.opp.swat && !b.swatDecided && !b.cupsOff) {
              b.swatDecided = true;
              // he gets almost all of them; a pure bounce sometimes beats his hands
              if (S.rand() < (b.info.green ? 0.7 : 0.92)) { b.swatAt = S.t + 0.1; pose('swat', 0.6); }
              else b.beatSwat = true;
            }
          } else if (ev.type === 'rim' || ev.type === 'cup') PongSfx.play('cup', ev.s);
          else if (ev.type === 'sink') {
            const blowable = b.by === 'you' && S.opp && S.opp.blow && b.info && b.info.spun && !b.blown;
            if (blowable) { b.hold = S.t + 0.55; pose('blow', 1.0); }
            const c = cupsFor(b).find(x => x.id === ev.cup);
            if (c) c.ballIn = { x: b.p[0], z: b.p[2] };
            PongSfx.play('sink');
          }
        });
        b.events.length = 0;
        if (b.trail) { b.trail.push(b.p.slice()); if (b.trail.length > 8) b.trail.shift(); }
        if (b.result && !b.handled && !(b.hold && S.t < b.hold)) { b.handled = true; onBallResult(b); }
      });
      S.balls = S.balls.filter(b => !b.done);
    }

    function removeCup(c, delay) {
      c.live = false;
      c.removeAt = S.t + (delay == null ? 0.55 : delay);
    }
    // a bounce is two cups: they pull the stray one (farthest from the rest)
    function pullExtra(cups) {
      const L = live(cups);
      if (!L.length) return null;
      const cx = L.reduce((s, c) => s + c.x, 0) / L.length, cz = L.reduce((s, c) => s + c.z, 0) / L.length;
      const c = L.slice().sort((a, b) => Math.hypot(b.x - cx, b.z - cz) - Math.hypot(a.x - cx, a.z - cz))[0];
      removeCup(c, 0.9);
      return c;
    }

    function onBallResult(b) {
      const yours = b.by === 'you';
      const cups = yours ? S.far : S.near;
      let made = b.result === 'made' && !b.blown;
      let sunkCup = made ? cups.find(c => c.id === b.sunk) : null;
      if (made && !sunkCup) made = false;
      const bounce = made && b.bounces > 0;
      let cupsTaken = 0, note = null;
      if (S.spec.kind === 'calibrate') {
        if (sunkCup) { sunkCup.live = true; sunkCup.ballIn = null; }
        popup('Touch recorded', '#7ee2a8', 0.85, [0, 1.2, 7.2], 1.2);
        S.resolved++;
        return calibAfter();
      }
      if (made) {
        const target = S.spec.kind === 'shots' ? isTarget(sunkCup) : true;
        removeCup(sunkCup);
        cupsTaken = 1;
        const countsTwo = bounce && (S.spec.kind !== 'shots' || S.spec.bounceTwo);
        if (countsTwo && target) {
          const extra = S.spec.kind === 'shots' ? null : pullExtra(cups);
          cupsTaken = extra || S.spec.kind === 'shots' ? 2 : 1;
          if (extra) popup('+1 cup', '#ffcf6b', 0.9, [extra.x, 1.0, extra.z]);
        }
        const at = [sunkCup.x, 0.9, sunkCup.z];
        if (S.spec.kind === 'shots' && !target) { popup('Wrong cup', '#ff9a66', 1.0, at); cupsTaken = 0; note = 'wrong'; }
        else if (bounce) popup(countsTwo ? 'Bounce · two cups' : 'Bounce', '#ffcf6b', 1.1, at);
        else if (b.info && b.info.kind === 'fast') popup('Laser', '#ffffff', 1.1, at);
        else if (b.rimHits >= 2) popup('Rim roll', '#ffd166', 1.0, at);
        else if (b.rimHits === 0 && b.wallHits === 0) popup('Splash', '#ffffff', 1.15, at);
        else popup('Sunk', '#ffffff', 1.05, at);
        if (yours && b.info && b.info.target && b.info.target !== sunkCup.id && note !== 'wrong') note = 'neighbor';
        PongSfx.buzz(16);
      } else {
        const at = b.p[1] > -0.3 ? [b.p[0], 0.8, Math.min(8, Math.max(0, b.p[2]))] : (yours ? [0, 0.8, 7.4] : [0, 0.8, 0.6]);
        if (!b.swatted && !b.blown) popup(b.rimHits ? 'Rimmed out' : 'Miss', '#ff9a66', 0.95, at, 1.0);
      }
      if (yours) {
        const st = S.stats[b.info.kind];
        st[1]++; if (made && note !== 'wrong') st[0]++;
        if (made && note !== 'wrong') S.makes++;
        S.cupsMade += cupsTaken;
        const g = Pong.gradeThrow(b.info, S.opp);
        S.lastYou = Object.assign({}, b.info, { made: made && note !== 'wrong', bounce, swatted: !!b.swatted, blown: !!b.blown, rim: b.rimHits > 0, note, cupsTaken, g: g.g, why: g.why, short: b.result === 'miss' ? missWord(b) : null });
        S.turn.throws.push(S.lastYou);
        S.resolved++;
        if (S.spec.kind !== 'game' && g.g !== 'A' && settings.hints) hint(g.why, 3.2);
        afterBall('you', made && note !== 'wrong');
      } else {
        afterBall('cpu', made);
      }
      updateScore();
    }
    function missWord(b) {
      if (b.swatted) return 'swatted';
      if (b.blown) return 'blown out';
      if (b.rimHits) return 'rimmed out';
      return 'missed';
    }

    // ---------- turns ----------
    function streakAfter(side, made) {
      if (side === 'you') {
        if (made) {
          S.streak++;
          if (S.streak === 2) { popup('Heating up', '#ffb347', 1.0, [0, 1.8, 7.3]); }
          if (S.streak === 3) { S.fire = true; popup('On fire', '#ff6a2a', 1.3, [0, 2.2, 7.3]); PongSfx.play('fire'); }
        } else { if (S.fire) popup('Fire\'s out', '#cbbfd2', 0.8, [0, 1.8, 7.3]); S.streak = 0; S.fire = false; }
      } else {
        if (made) { S.cpuStreak++; if (S.cpuStreak === 3) { S.cpuFire = true; popup('He\'s on fire', '#ff6a2a', 1.1, [0, 1.6, 1.4]); } }
        else { S.cpuStreak = 0; S.cpuFire = false; }
      }
      updateChips();
    }
    function afterBall(side, made) {
      const T = S.turn;
      T.thrown++; T.pair++; T.left--;
      if (made) { T.made++; T.pairMade++; }
      streakAfter(side, made);
      const kind = S.spec.kind;
      // cleared the rack?
      const target = side === 'you' ? S.far : S.near;
      if (made && !live(target).length) return after(1.1, () => rackCleared(side));
      if (kind === 'shots') return after(0.9, nextDrillBall);
      if (kind === 'practice') return after(0.7, () => { S.phase = 'aim'; S.hasBall = true; S.catchT = 0; });
      // Rack Attack is one long turn; the re-rack calls come up as the rack shrinks
      if (kind === 'attack') return after(0.75, () => offerRerack(nextYourBall));
      if (T.rebuttal) {
        if (!made) return after(1.0, () => rebuttalFailed(side));
        T.left = Math.max(T.left, 1);
      } else {
        if (T.pair >= 2) {
          if (T.pairMade >= 2) { T.left += 2; popup('Balls back', '#7ee2a8', 1.1, side === 'you' ? [0, 1.5, 7.2] : [0, 1.4, 1.2]); }
          T.pair = 0; T.pairMade = 0;
        }
        const fire = side === 'you' ? S.fire : S.cpuFire;
        if (made && fire) T.left = Math.max(T.left, 1);
      }
      if (T.left > 0) return after(side === 'you' ? 0.75 : 0.55, () => side === 'you' ? nextYourBall() : cpuNext());
      after(side === 'you' ? 0.9 : 0.6, () => side === 'you' ? endYourTurn() : endCpuTurn());
    }

    function newTurn(by, rebuttal) { S.turn = { by, left: rebuttal ? 1 : (S.spec.kind === 'attack' ? 1 : 2), pair: 0, pairMade: 0, made: 0, thrown: 0, throws: [], rebuttal: !!rebuttal }; }

    function startYourTurn(rebuttal) {
      newTurn('you', rebuttal);
      S.camTo = 0; S.turnNo++;
      updateScore();
      const go = () => {
        if (rebuttal) banner('Rebuttal', 'Make them all', `${live(S.far).length} cup${live(S.far).length > 1 ? 's' : ''} left. Shoot until you miss.`, 2.2);
        nextYourBall();
      };
      if (!rebuttal && S.spec.kind !== 'practice' && S.spec.kind !== 'shots') offerRerack(go); else go();
    }
    function nextYourBall() {
      S.phase = 'aim'; S.hasBall = true; S.catchT = 0;
      S.pose = null;
      updateChips();
      const L = live(S.far);
      if (S.spec.kind === 'calibrate') return;
      if (oneTimeHint('arc', 'Flick up to throw an arc. A harder flick goes deeper.')) return;
      if (S.throwsUsed < 2) return;
      const exps = L.map(c => Pong.exposure(c, S.far, 'far'));
      if (exps.includes('island') && !(S.opp && S.opp.swat) && oneTimeHint('bounce', 'Open table in front of a lone cup? Pull down, then flick up: a bounce shot is two cups.')) return;
      if (exps.includes('front') && oneTimeHint('fast', 'Short, sharp flick: fastball. It flies flat and hard, made for a naked front cup.')) return;
      if (S.throwsUsed >= 6) oneTimeHint('spin', 'Curl your flick a little to put spin on it. Spin rides the rim and rolls in.');
    }
    function closeTurn() {
      const T = S.turn;
      if (!T || T.by !== 'you' || !T.throws.length || T.logged) return null;
      T.logged = true;
      const g = Pong.gradeTurn(T.throws);
      S.log.push({ turn: S.turnNo, throws: T.throws.map(t => ({ kind: t.kind, made: t.made, g: t.g })), made: T.made, grade: g.g, why: g.why });
      return g;
    }
    function endYourTurn() {
      S.phase = 'card';
      const T = S.turn;
      const g = closeTurn() || { g: 'C', why: '' };
      if (S.spec.kind !== 'game') return nextYourBall();
      const narr = T.throws.map(t => `${SHOT[t.kind]}${t.row ? ' at ' + t.row : ''}: ${t.made ? (t.cupsTaken === 2 ? 'in, two cups' : t.note === 'neighbor' ? 'sank the one next to it' : 'sank it') : t.short}.`).join(' ');
      showCard(`<div class="k">Turn ${S.turnNo} · vs ${esc(S.opp.name)}</div><div class="w">${esc(narr)} ${T.made} of ${T.thrown}.</div>
        <div class="r"><span class="px-grade ${g.g}">${g.g}</span><span>${esc(g.why)}</span></div>
        <div class="row"><button class="px-btn" type="button">Their turn</button></div>`, () => startCpuTurn());
      if (g.g === 'A') PongSfx.play('great'); else if (g.g === 'B') PongSfx.play('good');
    }

    // ---------- the computer's turn ----------
    function startCpuTurn(rebuttal) {
      newTurn('cpu', rebuttal);
      S.phase = 'cpu'; S.camTo = 1;
      ui.arms.hidden = true;
      updateChips();
      hint('');
      const go = () => {
        banner(rebuttal ? 'Rebuttal' : 'Their turn', S.opp.name, rebuttal ? 'He shoots until he misses.' : (S.opp.lines[S.turnNo % S.opp.lines.length]), 1.3);
        after(0.9, cpuNext);
      };
      if (!rebuttal) cpuRerack(go); else after(0.4, go);
    }
    function cpuChoose() {
      const L = live(S.near);
      const scored = L.map(c => ({ c, e: Pong.exposure(c, S.near, 'near') }));
      const o = S.opp, r = S.rand;
      let pick;
      if (o.hot) {
        // the sniper takes the best percentage look on the table
        pick = scored.find(x => x.e === 'front') || scored.find(x => x.e === 'island') || scored[Math.floor(r() * scored.length)];
        return { cup: pick.c, kind: pick.e === 'front' ? 'fast' : 'arc' };
      }
      pick = scored[Math.floor(r() * scored.length)];
      let kind = 'arc';
      if (pick.e === 'front' && r() < 0.45) kind = 'fast';
      if (pick.e === 'island' && o.id === 'statue' && r() < 0.3) kind = 'bounce';
      return { cup: pick.c, kind };
    }
    function cpuNext() {
      if (!S.running) return;
      S.phase = 'cpu';
      const { cup, kind } = cpuChoose();
      pose('throw', 0.6);
      after(0.32, () => {
        const skill = Math.min(0.95, S.opp.skill + (S.cpuFire ? 0.07 : 0) + (S.turn.rebuttal ? 0.04 : 0));
        const shot = PongPhysics.cpuThrow('far', cup, kind, skill, S.rand);
        const b = PongPhysics.newBall(shot.release, shot.vel, { by: 'cpu', info: { kind, target: cup.id }, trail: [] });
        S.balls.push(b);
        PongSfx.play('release');
      });
    }
    function endCpuTurn() {
      const T = S.turn;
      banner('', T.made ? `He sank ${T.made}` : 'He missed', T.made > 1 ? 'Got the balls back.' : '', 1.1);
      after(1.15, () => { hideBanner(); startYourTurn(); });
    }

    // ---------- racks ----------
    function thresholdFor(n, side) {
      const used = S.rr[side];
      if (n <= 6 && n > 3 && !used.six && Pong.RERACKS[n]) return 'six';
      if (n <= 3 && n >= 2 && !used.three && Pong.RERACKS[n]) return 'three';
      return null;
    }
    function offerRerack(then) {
      const n = live(S.far).length;
      const th = thresholdFor(n, 'far');
      if (!th || S.overtime) return then();
      S.rr.far[th] = true;
      S.phase = 'pick';
      const opts = Pong.RERACKS[n];
      ui.pick.innerHTML = `<h3>Re-rack?</h3><p>${n} cups left. House rules: you call the shape.</p><div class="px-opts">${opts.map(id => `<button class="px-opt" type="button" data-form="${id}">${formSvg(id)}<span><b>${esc(Pong.FORMATIONS[id].name)}</b><small>${esc(Pong.FORMATIONS[id].read)}</small></span></button>`).join('')}
        <button class="px-opt" type="button" data-form="keep"><svg viewBox="0 0 56 56" aria-hidden="true"><rect x="2" y="2" width="52" height="52" rx="8" fill="none" stroke="rgba(255,255,255,.3)" stroke-dasharray="4 4"/><path d="M18 28h20M30 20l8 8-8 8" stroke="#f6efe4" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg><span><b>Keep it</b><small>Shoot at the rack the way it is.</small></span></button></div>`;
      ui.pick.hidden = false; root.classList.add('modal');
      S.pickNext = id => {
        if (id !== 'keep') { applyRerack('far', id); S.rerackCalls.push(id); banner('Re-rack', Pong.FORMATIONS[id].name, '', 1.0); }
        after(id !== 'keep' ? 0.8 : 0.1, then);
      };
    }
    function cpuRerack(then) {
      const n = live(S.near).length;
      const th = thresholdFor(n, 'near');
      if (!th || S.overtime) return then();
      S.rr.near[th] = true;
      const opts = Pong.RERACKS[n];
      const id = S.opp.hot ? opts[0] : opts[Math.floor(S.rand() * opts.length)];
      applyRerack('near', id);
      banner('He calls a re-rack', Pong.FORMATIONS[id].name, '', 1.2);
      after(1.3, then);
    }
    function applyRerack(side, id) {
      const cur = live(side === 'far' ? S.far : S.near);
      const fresh = Pong.layout(id, side);
      // slide the cups that are left into the new shape
      cur.sort((a, b) => a.z - b.z || a.x - b.x);
      fresh.forEach((f, i) => { const c = cur[i]; if (!c) return; f.from = [c.x, c.z]; f.moveT = S.t; });
      if (side === 'far') S.far = fresh.slice(0, cur.length); else S.near = fresh.slice(0, cur.length);
      PongSfx.play('rack');
    }

    // ---------- endings ----------
    function rackCleared(side) {
      const kind = S.spec.kind;
      if (side === 'you' && kind !== 'practice') closeTurn();
      if (kind === 'attack') return finishSession({ title: 'Rack cleared', text: `${S.throwsUsed} throws.` });
      if (kind === 'practice') { banner('', 'Rack cleared', 'Fresh rack.', 1.2); S.far = Pong.layout(S.practiceForm, 'far'); return after(0.6, () => { S.phase = 'aim'; S.hasBall = true; S.catchT = 0; }); }
      if (kind === 'shots') return nextDrillBall();
      const T = S.turn;
      if (side === 'you') {
        if (T.rebuttal) return startOvertime();
        banner('Last cup', 'Rebuttal', 'He shoots until he misses. If he clears yours, it goes to overtime.', 2.2);
        return after(2.3, () => { hideBanner(); startCpuTurn(true); });
      }
      if (T.rebuttal) return startOvertime();
      PongSfx.play('groan');
      after(0.2, () => startYourTurn(true));
    }
    function rebuttalFailed(side) {
      if (side === 'you') return gameOver(false);
      return gameOver(true);
    }
    function startOvertime() {
      S.overtime++;
      S.far = Pong.layout('tri3', 'far'); S.near = Pong.layout('tri3', 'near');
      S.fire = false; S.cpuFire = false; S.streak = 0; S.cpuStreak = 0;
      banner('Overtime', 'Three cups each', 'Same rules. You shoot first.', 2.2);
      after(2.3, () => { hideBanner(); startYourTurn(); });
    }
    function gameOver(won) {
      closeTurn();
      S.won = won;
      S.phase = 'card';
      S.camTo = 0;
      pose(won ? (S.opp.id === 'statue' ? 'fold' : 'idle') : 'cheer', 3);
      if (won) PongSfx.play('cheer'); else PongSfx.play('groan');
      const left = live(S.near).length;
      showCard(`<div class="k">${won ? 'You win' : 'You lose'} · vs ${esc(S.opp.name)}</div><div class="w">${won ? `He missed the rebuttal. You finished with ${left} cup${left === 1 ? '' : 's'} standing.` : 'Missed the rebuttal. He takes it.'}</div>
        <div class="r"><span>${esc(S.opp.read)}</span></div>
        <div class="row"><button class="px-btn" type="button">See results</button></div>`, endSession);
    }
    function finishSession(msg) {
      S.phase = 'card';
      closeTurn();
      showCard(`<div class="k">${esc(S.spec.title || '')}</div><div class="w">${esc(msg.title)}. ${esc(msg.text)}</div><div class="row"><button class="px-btn" type="button">See results</button></div>`, endSession);
      PongSfx.play('great');
    }

    // ---------- drills (Island mode) ----------
    function isTarget(c) { return !S.targets || S.targets.includes(c.id); }
    function setupDrill() {
      const sp = S.spec;
      const isl = sp.island ? { x: (S.rand() - 0.5) * 0.9, d: S.rand() * 4 } : {};
      S.far = Pong.layout(sp.form, 'far', isl);
      const F = S.far;
      let t = null;
      if (sp.targets === 'front') { const zmin = Math.min(...F.map(c => c.z)); t = F.filter(c => Math.abs(c.z - zmin) < 0.05); }
      else if (sp.targets === 'back') { const zmax = Math.max(...F.map(c => c.z)); t = F.filter(c => Math.abs(c.z - zmax) < 0.05); }
      S.targets = t ? t.map(c => c.id) : null;
      F.forEach(c => { c.glow = !!S.targets && S.targets.includes(c.id); c.dim = !!S.targets && !c.glow; });
    }
    function nextDrillBall() {
      if (S.ballsLeft <= 0) return finishSession({ title: `${S.cupsMade} cups`, text: `Out of a possible ${S.spec.balls * (S.spec.bounceTwo ? 2 : 1)}.` });
      S.ballsLeft--;
      closeTurn();
      setupDrill();
      setTitle(S.spec.title, `Ball ${S.spec.balls - S.ballsLeft} of ${S.spec.balls}`);
      S.turn = { by: 'you', left: 1, pair: 0, pairMade: 0, made: 0, thrown: 0, throws: [] };
      S.phase = 'aim'; S.hasBall = true; S.catchT = 0;
      updateScore();
    }

    // ---------- calibration ----------
    function calibAfter() {
      if (S.calib.length >= 3) return after(0.9, endSession);
      setTitle('Find your touch', `Throw ${S.calib.length + 1} of 3`);
      after(0.8, () => { S.phase = 'aim'; S.hasBall = true; S.catchT = 0; });
    }

    // ---------- HUD ----------
    function updateScore() {
      const k = S.spec && S.spec.kind;
      const far = live(S.far).length, near = live(S.near).length;
      ui.cups.hidden = k !== 'game';
      if (k === 'game') { ui.score.textContent = ''; ui.scoreSub.textContent = ''; ui.cupsHim.textContent = far; ui.cupsYou.textContent = near; }
      else if (k === 'attack') { ui.score.textContent = S.throwsUsed; ui.scoreSub.textContent = `throws · ${far} left`; }
      else if (k === 'shots') { ui.score.textContent = S.cupsMade; ui.scoreSub.textContent = 'cups'; }
      else if (k === 'practice') { ui.score.textContent = S.makes; ui.scoreSub.textContent = `made · ${S.throwsUsed} thrown`; }
      else { ui.score.textContent = ''; ui.scoreSub.textContent = ''; }
    }
    function updateChips() {
      const his = S.turn && S.turn.by === 'cpu';
      const fire = his ? S.cpuFire : S.fire, warm = his ? S.cpuStreak === 2 : S.streak === 2;
      const who = his ? 'He\'s' : 'You\'re';
      if (fire) { ui.state.className = 'px-chip px-state hot'; ui.state.innerHTML = `<b>${who} on fire</b>` + (his ? '' : S.spec.kind === 'game' ? ' · shoot till you miss' : ' · bigger window'); ui.state.hidden = false; }
      else if (warm) { ui.state.className = 'px-chip px-state warm'; ui.state.innerHTML = `<b>${who} heating up</b>`; ui.state.hidden = false; }
      else ui.state.hidden = true;
    }
    let lastArms = null;
    function updateArms() {
      if (!S.opp || !S.opp.wave || S.phase !== 'aim' || !settings.showTags) { ui.arms.hidden = true; lastArms = null; return; }
      const up = armsUp();
      if (up !== lastArms) {
        lastArms = up;
        ui.arms.className = 'px-chip px-arms ' + (up ? 'hot' : 'open');
        ui.arms.innerHTML = up ? '<b>Arms up</b> · wait' : '<b>Arms down</b> · clean look';
      }
      ui.arms.hidden = false;
    }
    function pose(name, dur) { S.pose = { name, t0: S.t, dur }; }

    // ---------- session ----------
    function run(spec, handlers) {
      stop(true);
      S.spec = Object.assign({}, spec);
      S.onEnd = handlers && handlers.onEnd; S.onQuit = handlers && handlers.onQuit;
      S.rand = spec.seed != null ? mulberry(spec.seed) : Math.random;
      Object.assign(S, {
        t: 0, balls: [], popups: [], timers: [], meter: null, phase: 'intro', camK: 0, camTo: 0, turn: null, turnNo: 0,
        streak: 0, cpuStreak: 0, fire: false, cpuFire: false, rr: { far: {}, near: {} }, overtime: 0, won: null,
        log: [], stats: { arc: [0, 0], fast: [0, 0], bounce: [0, 0] }, makes: 0, cupsMade: 0, throwsUsed: 0, calib: [], rerackCalls: [], resolved: 0, lastYou: null,
        hasBall: false, follow: 9, catchT: 9, pose: null, cardNext: null, pickNext: null, ended: false, targets: null, ballsLeft: 0,
        opp: spec.opponent ? Pong.OPPONENTS[spec.opponent] : null
      });
      ['banner', 'hint', 'card', 'pick', 'tool', 'state', 'arms'].forEach(k => { ui[k].hidden = true; });
      root.classList.remove('modal');
      S.far = Pong.layout(spec.rack || 'tri10', 'far');
      S.near = spec.kind === 'game' ? Pong.layout(spec.rack || 'tri10', 'near') : [];
      S.running = true;
      S.last = performance.now();
      S.raf = requestAnimationFrame(frame);
      const k = spec.kind;
      if (k === 'game') {
        setTitle(S.opp.name, S.opp.tag);
        banner(S.opp.tag, S.opp.name, S.opp.tell, 2.6);
        pose(S.opp.wave ? 'wave' : 'idle', 2.6);
        after(2.7, () => { hideBanner(); startYourTurn(); });
      } else if (k === 'attack') {
        setTitle(spec.title || 'Rack Attack', 'Clear ten cups');
        banner('Rack Attack', 'Ten cups', 'As few throws as you can. Re-racks at six and three.', 2.0);
        after(2.0, () => { hideBanner(); startYourTurn(); });
      } else if (k === 'shots') {
        S.ballsLeft = spec.balls;
        setTitle(spec.title, spec.note || '');
        banner('Island', spec.title, spec.note, 1.6);
        after(1.6, () => { hideBanner(); nextDrillBall(); });
        setupDrill();
      } else if (k === 'practice') {
        S.practiceForm = 'tri10';
        setTitle(spec.title || 'Practice', 'Tap the rack chip to change the shape');
        updateTool(); ui.tool.hidden = false;
        S.turn = { by: 'you', left: 99, pair: 0, pairMade: 0, made: 0, thrown: 0, throws: [] };
        S.phase = 'aim'; S.hasBall = true; S.catchT = 0;
        if (settings.hints) hint('Flick up: arc · Short snap: fastball · Pull down, then flick: bounce', 5);
      } else if (k === 'calibrate') {
        setTitle('Find your touch', 'Throw 1 of 3');
        banner('Find your touch', 'Three easy throws', 'Flick up at the front cup the way that feels natural. These set your touch.', 2.6);
        S.turn = { by: 'you', left: 3, pair: 0, pairMade: 0, made: 0, thrown: 0, throws: [] };
        after(1.2, () => { S.phase = 'aim'; S.hasBall = true; S.catchT = 0; hint('Flick up toward the front cup'); });
      }
      updateScore(); updateChips();
    }
    function summary(quit) {
      const k = S.spec ? S.spec.kind : null;
      const out = { kind: k, quit: !!quit, won: S.won, cupsMade: S.cupsMade, makes: S.makes, throws: S.throwsUsed, stats: S.stats, log: S.log, overtime: S.overtime, opponent: S.opp ? S.opp.id : null, theirsLeft: live(S.far).length, yoursLeft: live(S.near).length, rerackCalls: S.rerackCalls };
      if (S.log.length) {
        out.readIQ = Math.round(S.log.reduce((s, l) => s + Pong.GP[l.grade], 0) / S.log.length * 25);
      }
      if (k === 'calibrate' && S.calib.length) {
        const med = key => { const a = S.calib.map(c => c[key]).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
        out.touchK = Math.max(0.5, Math.min(5, med('power')));
        out.L0 = Math.max(0.06, Math.min(0.8, med('len')));
        out.S0 = Math.max(0.4, Math.min(12, med('speed')));
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
      hideBanner(); hint('');
      ui.pick.hidden = true;
    }
    function destroy() { stop(); detach(); if (ro) ro.disconnect(); root.remove(); }

    // ---------- loop ----------
    function update(dt) {
      S.t += dt;
      const due = S.timers.filter(x => x.at <= S.t);
      if (due.length) { S.timers = S.timers.filter(x => x.at > S.t); due.forEach(x => x.fn()); }
      S.camK += (S.camTo - S.camK) * Math.min(1, dt * 3.2);
      S.follow += dt; S.catchT += dt;
      updateBalls(dt);
      S.popups.forEach(p => { p.t += dt; });
      S.popups = S.popups.filter(p => p.t < p.life);
      if (S.meter) { S.meter.t += dt; if (S.meter.t > 1.9) S.meter = null; }
      [S.far, S.near].forEach(arr => arr.forEach(c => {
        if (c.removeAt && S.t >= c.removeAt) { const k = (S.t - c.removeAt) / 0.6; c.lift = ease(Math.min(1, k)) * 1.4; c.alpha = Math.max(0, 1 - k); }
      }));
      S.far = S.far.filter(c => !(c.removeAt && S.t - c.removeAt > 0.6));
      S.near = S.near.filter(c => !(c.removeAt && S.t - c.removeAt > 0.6));
      updateArms();
    }
    function frame(now) {
      if (!S.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - S.last) / 1000));
      S.last = now;
      update(dt);
      if (S.running) render();
      if (S.running) S.raf = requestAnimationFrame(frame);
    }

    // ---------- render ----------
    function heldBallScreen() {
      const r = Math.max(9, Math.min(W, H) * 0.036);
      let x = W * 0.54, y = H - r * 5.2;
      if (S.catchT < 0.3) { const k = S.catchT / 0.3; y += (1 - ease(k)) * r * 6; }
      return { x, y, r };
    }
    function drawHand(held, alpha, empty) {
      const r = held.r, skin = settings.skin || '#c68642', edge = 'rgba(60,30,15,0.55)';
      const { x, y } = held;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const stroke = (pts, w, col) => {
        [[w + Math.max(2, r * 0.16), edge], [w, col]].forEach(([lw, c]) => {
          ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath();
          pts.forEach(([px, py], i) => i ? ctx.lineTo(x + px * r, y + py * r) : ctx.moveTo(x + px * r, y + py * r));
          ctx.stroke();
        });
      };
      // sleeve and the back of the hand, coming up from the bottom right
      stroke([[3.2, 9], [2.1, 4.4]], r * 3.0, '#2a2140');
      stroke([[2.0, 4.2], [1.25, 2.1]], r * 2.3, skin);
      // curled fingers behind the ball
      stroke([[1.9, 2.6], [1.7, 1.5], [1.15, 1.25]], r * 0.7, skin);
      if (!empty) Table3D.drawBallAt(ctx, x, y, r, S.fire);
      // thumb on the lower left of the ball, index finger over the top right
      stroke([[1.0, 2.5], [0.05, 1.55], [-0.62, 0.62]], r * 0.78, skin);
      stroke([[1.55, 1.6], [1.25, 0.2], empty ? [0.9, -0.2] : [0.62, -0.62]], r * 0.66, skin);
      ctx.restore();
    }
    function render() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const cam = Table3D.viewCam('you', 'them', ease(Math.max(0, Math.min(1, S.camK))), W, H);
      Table3D.drawRoom(ctx, cam, S.t);
      Table3D.drawTable(ctx, cam);
      S.balls.forEach(b => { if (b.t > (b.appear || 0)) Table3D.drawShadow(ctx, cam, b.p); });
      const items = [];
      const depth = p => Table3D.toCam(cam, p)[2];
      // the opponent stands behind his cups
      if (S.opp && S.spec.kind !== 'calibrate') {
        let pname = S.opp.wave ? 'wave' : S.opp.swat ? 'ready' : S.opp.id === 'statue' ? 'fold' : 'idle', pk = 1;
        if (S.opp.wave) { const a = Math.sin(S.t * Math.PI * 2 / 1.9 + 0.4); pk = Math.max(0, Math.min(1, (a + 0.25) / 0.6)); }
        if (S.pose && S.t - S.pose.t0 < S.pose.dur) { pname = S.pose.name; pk = Math.min(1, (S.t - S.pose.t0) / 0.25); }
        items.push({ d: depth([0, 1.5, 8.75]) + 0.5, f: () => Table3D.drawPerson(ctx, cam, S.opp, 'far', pname, pk, S.t) });
      }
      const inCupBalls = {};
      S.balls.forEach(b => { if ((b.inCup || b.sunk) && b.p[1] < CUP.h && !b.cupsOff) inCupBalls[b.sunk || b.inCup] = b; });
      [S.far, S.near].forEach(arr => arr.forEach(c => {
        let c2 = c;
        if (c.from && c.moveT != null) {
          const k = Math.min(1, (S.t - c.moveT) / 0.55);
          if (k < 1) { const e = ease(k); c2 = Object.assign({}, c, { x: c.from[0] + (c.x - c.from[0]) * e, z: c.from[1] + (c.z - c.from[1]) * e, lift: Math.sin(Math.PI * k) * 0.25 }); }
        }
        const b = inCupBalls[c.id];
        const inside = b ? { x: b.p[0], z: b.p[2] } : c.ballIn;
        items.push({ d: depth([c2.x, CUP.h / 2, c2.z]), f: () => Table3D.drawCup(ctx, cam, c2, inside, S.t) });
      }));
      S.balls.forEach(b => {
        if ((b.inCup || b.sunk) && b.p[1] < CUP.h && !b.cupsOff) return;
        items.push({ d: depth(b.p), f: () => drawFlightBall(cam, b) });
      });
      items.sort((a, b) => b.d - a.d).forEach(it => it.f());
      drawPopups(cam);
      if (S.hasBall && (S.phase === 'aim' || S.phase === 'intro' || S.phase === 'pick') && S.camK < 0.3) {
        drawHand(heldBallScreen(), 1);
      } else if (S.follow < 0.35 && S.camK < 0.3) {
        const held = heldBallScreen();
        held.y -= S.follow / 0.35 * H * 0.12;
        drawHand(held, 1 - S.follow / 0.35, true);
      }
      if (S.meter) drawMeter();
      drawBallsLeft();
    }
    function drawFlightBall(cam, b) {
      const hot = b.by === 'you' && S.fire;
      const p = Table3D.project(cam, b.p);
      if (!p) return;
      if (b.appear && b.t < b.appear) {
        const k = b.t / b.appear;
        Table3D.drawBallAt(ctx, b.sx + (p.x - b.sx) * k, b.sy + (p.y - b.sy) * k, b.sr + (R * p.s - b.sr) * k, hot);
        return;
      }
      if (b.trail) for (let i = 0; i < b.trail.length - 1; i++) {
        const q = Table3D.project(cam, b.trail[i]);
        if (!q) continue;
        const a = (i + 1) / b.trail.length * (hot ? 0.55 : 0.2);
        ctx.fillStyle = hot ? `rgba(255,120,40,${a})` : `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, R * q.s * (0.5 + i / b.trail.length * 0.5)), 0, Math.PI * 2); ctx.fill();
      }
      Table3D.drawBallAt(ctx, p.x, p.y, R * p.s, hot);
    }
    function drawPopups(cam) {
      S.popups.forEach(p => {
        const q = Table3D.project(cam, p.world);
        if (!q) return;
        const k = p.t / p.life;
        const y = q.y - k * 28;
        const a = k < 0.15 ? k / 0.15 : (k > 0.7 ? (1 - k) / 0.3 : 1);
        const sz = Math.round(Math.min(W, H) * 0.062 * p.size);
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = `400 ${sz}px "Bungee", Impact, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, sz * 0.14); ctx.strokeStyle = 'rgba(10,6,14,0.75)';
        const text = p.text.toUpperCase();
        const x = Math.max(sz * 2, Math.min(W - sz * 2, q.x));
        ctx.strokeText(text, x, y); ctx.fillStyle = p.color; ctx.fillText(text, x, y);
        ctx.restore();
      });
    }
    function drawMeter() {
      const m = S.meter, shot = m.shot;
      const k = m.t;
      const a = k < 0.15 ? k / 0.15 : (k > 1.5 ? Math.max(0, (1.9 - k) / 0.4) : 1);
      const bw = Math.min(W * 0.7, 300), bh = 10;
      const x0 = (W - bw) / 2, y0 = H - Math.max(9, Math.min(W, H) * 0.034) * 8.4;
      const lo = 0.7, hi = 1.3;
      const X = v => x0 + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * bw;
      const feel = FEEL[settings.feel] || FEEL.normal;
      const w = m.kind === 'fast' ? feel.fast : feel.snap / PongPhysics.DEPTH_PER / Math.max(0.5, shot.ideal || 1) * (m.kind === 'bounce' ? 0.9 : 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(14,9,18,0.78)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 - 10, y0 - 34, bw + 20, 58, 10) : ctx.rect(x0 - 10, y0 - 34, bw + 20, 58); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x0, y0, bw, bh);
      if (!m.calibrating) { ctx.fillStyle = 'rgba(126,226,168,0.75)'; ctx.fillRect(X(1 - w), y0, X(1 + w) - X(1 - w), bh); }
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(X(1) - 1, y0 - 3, 2, bh + 6);
      const mx = m.calibrating ? X(1) : X(shot.ratio);
      ctx.fillStyle = shot.green || m.calibrating ? '#7ee2a8' : '#ffcf6b';
      ctx.beginPath(); ctx.moveTo(mx, y0 - 2); ctx.lineTo(mx - 6, y0 - 11); ctx.lineTo(mx + 6, y0 - 11); ctx.closePath(); ctx.fill();
      ctx.fillRect(mx - 1.5, y0, 3, bh);
      ctx.font = '600 11px "Work Sans", sans-serif'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(246,239,228,0.7)';
      ctx.textAlign = 'left'; ctx.fillText(m.kind === 'fast' ? 'LOW' : 'SHORT', x0, y0 + bh + 13);
      ctx.textAlign = 'right'; ctx.fillText(m.kind === 'fast' ? 'HIGH' : 'LONG', x0 + bw, y0 + bh + 13);
      ctx.textAlign = 'center';
      ctx.font = '700 13px "Work Sans", sans-serif'; ctx.fillStyle = '#f6efe4';
      ctx.fillText(m.calibrating ? 'Touch recorded' : shot.feedback, W / 2, y0 - 17);
      ctx.restore();
    }
    function drawBallsLeft() {
      const T = S.turn;
      if (!T || T.by !== 'you' || S.camK > 0.3 || !['game', 'attack'].includes(S.spec.kind) || T.rebuttal) return;
      const n = Math.min(6, Math.max(0, T.left));
      const r = 5, gap = 15, y = H - Math.max(9, Math.min(W, H) * 0.034) * 1.6;
      const x0 = W * 0.2;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x0 + i * gap, y, r, 0, Math.PI * 2); ctx.fillStyle = S.fire ? '#ffb347' : '#f6efe4'; ctx.fill(); }
    }

    function setSettings(o) { Object.assign(settings, o || {}); }
    return { run, stop, destroy, setSettings, summary, get settings() { return settings; }, _S: S };
  }

  return { create, FEEL };
})();
