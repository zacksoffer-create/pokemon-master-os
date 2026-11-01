/* BatEngine: runs any hitting "spec" (a challenge described as data) inside a
   container.

   spec.kind:
     abs     at-bats vs pitchers:  { count, pitchers, situations ('mix'|'none'|[ids]), startCount: [b, s], plan: [{ pitcher, situation }] }
     derby   home run derby:       { outs }
     cage    batting cage:         { pitch ('FF'|...|'mix'), speed, loc ('middle'|'any'), throws, calibrate, swings }

   Pitch timing runs on the real clock (performance.now), the same clock the
   swipe is stamped with, so a swing is judged to the millisecond no matter
   how the frames fall. */
const BatEngine = (() => {
  const { V } = Park3D;
  const FEEL = {
    arcade: { window: 0.032, label: 'Arcade' },
    normal: { window: 0.022, label: 'Normal' },
    pro: { window: 0.014, label: 'Pro' }
  };
  const HOME = { jersey: '#f1ede2', trim: '#0f3b5f', cap: '#0f3b5f', pants: '#ece7da', socks: '#0f3b5f', shoes: '#14161b', glove: '#7a4a22' };
  const TYPE_COLOR = { FF: '#ff6b5a', SI: '#ff9a66', FC: '#ffb547', SL: '#6fa8ff', SW: '#8fb4ff', CU: '#b48cff', CH: '#7ee2a8', FS: '#5fd6c2' };
  const POINTS = { single: 1, double: 2, triple: 3, hr: 4, walk: 1, hbp: 1 };
  const BASE_PTS = [Field.BASES.home, Field.BASES.first, Field.BASES.second, Field.BASES.third, Field.BASES.home];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const clock = () => performance.now() / 1000;

  let cssDone = false;
  function injectCss() {
    if (cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = `
.ab{position:absolute;inset:0;overflow:hidden;background:#05080f;color:#f4f1e8;font-family:"Barlow",system-ui,sans-serif;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.ab canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.ab-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:flex-start;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 22px max(14px,env(safe-area-inset-left,0px));pointer-events:none;background:linear-gradient(rgba(3,5,10,.7),rgba(3,5,10,0))}
.ab-quit{pointer-events:auto;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(8,12,20,.55);color:#f4f1e8;font:600 18px/1 "Barlow",sans-serif;cursor:pointer}
.ab-quit:focus-visible,.ab-btn:focus-visible{outline:2px solid #ffd166;outline-offset:2px}
.ab-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;text-shadow:0 1px 3px rgba(0,0,0,.7)}
.ab-title b{font:600 19px/1.05 "Oswald",Impact,"Arial Narrow",sans-serif;letter-spacing:.05em;text-transform:uppercase}
.ab-title span{font:500 13px/1.25 "Barlow",sans-serif;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ab-score{text-align:right;text-shadow:0 1px 3px rgba(0,0,0,.7)}
.ab-score-n{display:block;font:600 36px/1 "Oswald",Impact,sans-serif;font-variant-numeric:tabular-nums}
.ab-score small{font:600 11px/1.2 "Barlow",sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.ab-bug{position:absolute;left:max(14px,env(safe-area-inset-left,0px));top:calc(60px + env(safe-area-inset-top,0px));display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:9px;background:rgba(6,9,16,.78);border:1px solid rgba(255,255,255,.12);pointer-events:none;font:600 12px/1 "Oswald",sans-serif;letter-spacing:.06em}
.ab-bug .rows{display:grid;grid-template-columns:auto auto;gap:3px 6px;align-items:center}
.ab-bug .lab{opacity:.7}
.ab-bug .dots{display:flex;gap:3px}
.ab-bug .dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.18)}
.ab-bug .dots.b i.on{background:#7ee2a8}.ab-bug .dots.s i.on{background:#ffd166}.ab-bug .dots.o i.on{background:#ff6b5a}
.ab-bug svg{width:34px;height:34px}
.ab-radar{position:absolute;right:max(14px,env(safe-area-inset-right,0px));top:calc(62px + env(safe-area-inset-top,0px));text-align:right;padding:5px 9px;border-radius:9px;background:rgba(6,9,16,.78);border:1px solid rgba(255,209,102,.3);pointer-events:none}
.ab-radar b{display:block;font:600 22px/1 "Oswald",sans-serif;color:#ffd166;font-variant-numeric:tabular-nums}
.ab-radar span{font:600 10px/1.2 "Barlow",sans-serif;letter-spacing:.1em;text-transform:uppercase;opacity:.85}
.ab-chips{position:absolute;left:0;right:0;top:calc(112px + env(safe-area-inset-top,0px));display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:0 14px;pointer-events:none}
.ab-chip{max-width:100%;box-sizing:border-box;padding:5px 10px;border-radius:999px;font:600 12px/1.15 "Barlow",sans-serif;background:rgba(6,9,16,.74);border:1px solid rgba(255,255,255,.18);text-align:center}
.ab-chip b{font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.ab-chip.sit{color:#ffd166;border-color:rgba(255,209,102,.45)}
.ab-banner{position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;padding:0 18px}
.ab-banner .k{display:block;font:600 13px/1.2 "Barlow",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#ffd166;text-shadow:0 1px 4px rgba(0,0,0,.85)}
.ab-banner .h{display:block;font:700 clamp(30px,9vw,54px)/1 "Oswald",Impact,sans-serif;text-transform:uppercase;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.8);text-wrap:balance}
.ab-banner .s{display:block;margin:6px auto 0;max-width:34ch;font:500 15px/1.3 "Barlow",sans-serif;text-shadow:0 1px 4px rgba(0,0,0,.95)}
.ab-banner.pop{animation:abpop .35s ease-out}
@keyframes abpop{from{transform:scale(.86);opacity:0}to{transform:scale(1);opacity:1}}
.ab-stat{position:absolute;left:50%;top:calc(150px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:flex;gap:12px;padding:7px 12px;border-radius:10px;background:rgba(6,9,16,.82);border:1px solid rgba(255,255,255,.14);pointer-events:none;white-space:nowrap}
.ab-stat div{text-align:center}.ab-stat b{display:block;font:600 20px/1 "Oswald",sans-serif;font-variant-numeric:tabular-nums}.ab-stat span{font:600 9px/1 "Barlow",sans-serif;letter-spacing:.1em;text-transform:uppercase;opacity:.75}
.ab-hint{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);box-sizing:border-box;padding:7px 12px;border-radius:10px;background:rgba(6,9,16,.72);font:500 13px/1.35 "Barlow",sans-serif;text-align:center;pointer-events:none;color:#ece8dc}
.ab-card{position:absolute;left:max(12px,env(safe-area-inset-left,0px));right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;padding:14px 16px 12px;border-radius:14px;background:rgba(10,14,24,.95);border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.55);animation:abup .25s ease-out}
@keyframes abup{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.ab-card .k{font:600 11px/1.3 "Barlow",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#ffd166}
.ab-card .w{margin-top:5px;font:600 16px/1.35 "Barlow",sans-serif}
.ab-card .r{display:flex;gap:10px;align-items:flex-start;margin-top:9px;font:400 14px/1.4 "Barlow",sans-serif;color:#cfd3dc}
.ab-grade{flex:none;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;font:700 21px/1 "Oswald",Impact,sans-serif;color:#0b0f18;background:#7ee2a8}
.ab-grade.B{background:#c5e27e}.ab-grade.C{background:#ffd166}.ab-grade.D{background:#ff9a66}.ab-grade.F{background:#ff5d4a}
.ab-card .row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px}
.ab-card .pts{font:600 15px/1 "Oswald",sans-serif;letter-spacing:.06em;color:#ffd166}
.ab-btn{pointer-events:auto;cursor:pointer;border:0;border-radius:10px;padding:10px 18px;background:#ffd166;color:#1a1206;font:600 15px/1 "Oswald",Impact,sans-serif;letter-spacing:.08em;text-transform:uppercase}
`;
    document.head.appendChild(st);
  }

  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(list, rand) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function create(container, opts) {
    injectCss();
    const settings = Object.assign({ timing: -0.12, feel: 'normal', bats: 'R', showTags: true, zone: true, hints: true }, opts || {});
    const root = document.createElement('div');
    root.className = 'ab';
    root.innerHTML = `
      <canvas></canvas>
      <div class="ab-top"><button class="ab-quit" type="button" aria-label="Leave this game">&#x2715;</button><div class="ab-title"><b></b><span></span></div><div class="ab-score"><span class="ab-score-n">0</span><small></small></div></div>
      <div class="ab-bug" hidden><div class="rows"><span class="lab">B</span><span class="dots b"><i></i><i></i><i></i></span><span class="lab">S</span><span class="dots s"><i></i><i></i></span><span class="lab">O</span><span class="dots o"><i></i><i></i></span></div>
        <svg viewBox="0 0 34 34" aria-hidden="true"><rect x="12" y="2" width="10" height="10" transform="rotate(45 17 7)" class="b2"/><rect x="23" y="13" width="10" height="10" transform="rotate(45 28 18)" class="b1"/><rect x="1" y="13" width="10" height="10" transform="rotate(45 6 18)" class="b3"/></svg></div>
      <div class="ab-radar" hidden><b></b><span></span></div>
      <div class="ab-chips"><div class="ab-chip ab-pitcher" hidden></div><div class="ab-chip sit ab-sit" hidden></div></div>
      <div class="ab-stat" hidden></div>
      <div class="ab-banner" hidden></div>
      <div class="ab-hint" hidden></div>
      <div class="ab-card" hidden></div>`;
    container.appendChild(root);
    const $ = s => root.querySelector(s);
    const canvas = $('canvas'), ctx = canvas.getContext('2d');
    const ui = {
      title: $('.ab-title b'), sub: $('.ab-title span'), score: $('.ab-score-n'), scoreSub: $('.ab-score small'),
      bug: $('.ab-bug'), radar: $('.ab-radar'), pitcher: $('.ab-pitcher'), sit: $('.ab-sit'), stat: $('.ab-stat'),
      banner: $('.ab-banner'), hint: $('.ab-hint'), card: $('.ab-card'), quit: $('.ab-quit')
    };
    let W = 360, H = 640, DPR = 1;

    const S = {
      spec: null, t: 0, running: false, raf: 0, last: 0, phase: 'idle', rand: Math.random, timers: [], popups: [],
      P: null, pitch: null, releaseAt: null, arriveAt: null, windAt: null, swing: null, contact: null,
      pci: [0, 2.5], pciHist: [], hold: false, holdAt: 0, count: { b: 0, s: 0 }, outs: 0, runners: [0, 0, 0], running0: false,
      ab: null, abIdx: 0, plan: null, log: [], score: 0, cam: 'bat', play: null, trail: [], kzone: [],
      derby: null, cage: null, calib: [], hintsShown: {}, onEnd: null, onQuit: null, ended: false, focus: [0, 0, 60]
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
    function hint(text) { ui.hint.textContent = text || ''; ui.hint.hidden = !text; }
    function hintOnce(key, text) { if (!settings.hints || S.hintsShown[key]) return false; S.hintsShown[key] = 1; hint(text); return true; }
    function setTitle(a, b) { ui.title.textContent = a || ''; ui.sub.textContent = b || ''; }
    function setScore(n, sub) { ui.score.textContent = n; if (sub != null) ui.scoreSub.textContent = sub; }
    function popup(text, color, size, life) { S.popups.push({ text, color: color || '#fff', size: size || 1, t: 0, life: life || 1.4 }); }
    function feel() { return FEEL[settings.feel] || FEEL.normal; }
    const bats = () => settings.bats === 'L' ? 'L' : 'R';
    const hs = () => bats() === 'L' ? -1 : 1;

    function statLine(items) {
      if (!items) { ui.stat.hidden = true; return; }
      ui.stat.innerHTML = items.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
      ui.stat.hidden = false;
    }
    function updateBug() {
      const show = S.spec && S.spec.kind === 'abs';
      ui.bug.hidden = !show;
      if (!show) return;
      const set = (cls, n) => ui.bug.querySelectorAll(`.dots.${cls} i`).forEach((el, i) => el.classList.toggle('on', i < n));
      set('b', S.count.b); set('s', S.count.s); set('o', S.outs);
      ['b1', 'b2', 'b3'].forEach((c, i) => { const el = ui.bug.querySelector('.' + c); el.setAttribute('fill', S.runners[i] ? '#ffd166' : 'rgba(255,255,255,0.14)'); el.setAttribute('stroke', 'rgba(255,255,255,0.5)'); });
    }
    function radar(p) {
      if (!p) { ui.radar.hidden = true; return; }
      ui.radar.innerHTML = `<b>${p.mph}</b><span>mph${settings.showTags || S.spec.kind !== 'abs' ? ' · ' + esc(p.type.name) : ''}</span>`;
      ui.radar.hidden = false;
    }

    // ---------- input ----------
    function plateScale() {
      const cam = Park3D.batterCam(W, H, bats());
      const q = Park3D.project(cam, [0, 2.5, Pitch.PLATE_Z]);
      return q ? q.s : 60;
    }
    function movePci(dx, dy) {
      const s = plateScale();
      S.pci = [clamp(S.pci[0] + dx / s, -1.7, 1.7), clamp(S.pci[1] - dy / s, 0.7, 4.5)];
      S.pciHist.push({ t: clock(), p: S.pci.slice() });
      if (S.pciHist.length > 60) S.pciHist.shift();
    }
    function pciAt(t) {
      for (let i = S.pciHist.length - 1; i >= 0; i--) if (S.pciHist[i].t <= t) return S.pciHist[i].p.slice();
      return S.pciHist.length ? S.pciHist[0].p.slice() : S.pci.slice();
    }
    const detach = BatGesture.attach(canvas, {
      down() { Sfx.unlock(); S.hold = true; S.holdAt = clock(); },
      drag(dx, dy) { if (S.running && S.cam === 'bat' && S.phase !== 'card') movePci(dx, dy); },
      swing(g) { onSwing(g); },
      up(r) { S.hold = false; if (r && r.tap) onTap(); }
    });
    ui.quit.addEventListener('click', () => { Sfx.play('ui'); const q = S.onQuit; stop(); q && q(summary(true)); });
    ui.card.addEventListener('click', e => { if (e.target.closest('button') && S.cardNext) { const f = S.cardNext; S.cardNext = null; f(); } });

    function onTap() {
      if (!S.running) return;
      if (S.cam === 'field' && S.play) { S.play.skip = true; return; }
      if (S.phase === 'set' || S.phase === 'intro' || S.phase === 'after') { S.pci = [0, 2.5]; S.pciHist = [{ t: clock(), p: S.pci.slice() }]; }
    }
    function onSwing(g) {
      if (!S.running || S.swing || S.cam !== 'bat') return;
      if (!['windup', 'flight', 'set'].includes(S.phase)) return;
      const K = Contact.SWINGS[g.kind];
      const t0 = g.t0 / 1000;
      const offset = S.calibrating ? 0 : settings.timing;
      const tc = t0 + K.lag + offset;
      if (S.releaseAt == null || tc < S.releaseAt + 0.12) { hintOnce('wait', 'Too soon. Load as he winds up, and swing once the ball is on its way.'); return; }
      if (tc > S.arriveAt + 0.3) return;
      S.swing = { g, tc, kind: g.kind, raw: t0 + K.lag - S.arriveAt, resolveAt: Math.max(clock(), tc), animStart: tc - 0.14 };
      Sfx.play('swing');
    }

    // ---------- the pitcher ----------
    function pitcherDef() { return S.P; }
    function pickNext() {
      const sp = S.spec;
      if (sp.script && sp.script.length) {
        const o = sp.script.shift();
        return { typeId: o.type, aim: o.aim ? o.aim.slice() : Pitch.target(o.loc || 'heart', bats()), over: o.over || (S.P.arsenal && S.P.arsenal[o.type]) || null, speed: o.speed };
      }
      if (sp.kind === 'cage') return cagePitch();
      if (sp.kind === 'derby') {
        const n = Pitchers.nextPitch(Pitchers.COACH, 0, 0, bats(), S.rand);
        return n;
      }
      return Pitchers.nextPitch(S.P, S.count.b, S.count.s, bats(), S.rand, sp.only ? { only: sp.only } : null);
    }
    function cagePitch() {
      const c = S.spec;
      const types = c.pitch && c.pitch !== 'mix' ? [c.pitch] : ['FF', 'SI', 'SL', 'CU', 'CH', 'FS'];
      const typeId = types[Math.floor(S.rand() * types.length)];
      let aim;
      if (c.calibrate || c.loc !== 'any') aim = [S.rand() * 0.3 - 0.15, 2.5 + S.rand() * 0.3 - 0.15];
      else { const locs = ['heart', 'up', 'low', 'away', 'in', 'lowAway', 'upIn', 'awayOff', 'dirt', 'upOut']; aim = Pitch.target(locs[Math.floor(S.rand() * locs.length)], bats()); aim = [aim[0] + Pitch.gauss(S.rand) * 0.15, aim[1] + Pitch.gauss(S.rand) * 0.15]; }
      return { typeId, aim, over: c.calibrate ? { mph: 88 } : null, speed: c.calibrate ? 1 : (c.speed || 1) };
    }
    function startPitch() {
      if (!S.running) return;
      S.cam = 'bat'; S.play = null; S.swing = null; S.contact = null; S.pitch = null; S.releaseAt = null; S.arriveAt = null; S.trail = [];
      S.phase = 'set';
      statLine(null);
      const P = S.P;
      const n = pickNext();
      S.next = n;
      const wait = S.spec.kind === 'derby' ? 0.55 : 0.75 + S.rand() * 0.6;
      after(wait, () => {
        if (!S.running) return;
        const p = Pitch.make({ type: n.typeId, over: n.over, throws: P.throws, slot: P.slot, aim: n.aim, speed: n.speed });
        S.pitch = p; S.pitchN = n;
        const wind = Math.max(0.55, (P.tempo || 1.3) - p.T);
        const now = clock();
        S.windAt = now; S.releaseAt = now + wind; S.arriveAt = S.releaseAt + p.T;
        S.phase = 'windup';
      });
    }

    // ---------- swing and pitch results ----------
    function resolveSwing() {
      const sw = S.swing; if (!sw || sw.done) return;
      sw.done = true;
      const g = sw.g;
      const e = sw.tc - S.arriveAt;
      const K = Contact.SWINGS[g.kind];
      const power = clamp((g.speed - 1.25) / (g.kind === 'power' ? 3.0 : 2.4), 0, 1);
      const pci = pciAt(g.t0 / 1000);
      sw.pci = pci;
      if (S.calibrating) {
        S.calib.push(sw.raw);
        const n = S.calib.length, need = S.spec.swings || 5;
        popup(`Swing ${n} of ${need}`, '#ffd166', 1);
      }
      const c = Contact.swing({ pitch: S.pitch, e: S.calibrating ? clamp(e, -0.05, 0.05) * 0.4 : e, pci, plane: g.plane, power, kind: g.kind, bats: bats(), window: feel().window, loaded: g.held >= 0.18, rand: S.rand });
      c.e = e; c.kind = K.id;
      S.contact = c;
      if (!S.calibrating) timingPopup(e, c);
      if (c.whiff) { Sfx.play('mitt'); return pitchDone('whiff'); }
      if (c.tip) { Sfx.play('tick'); return pitchDone('foul'); }
      Sfx.play('crack', c.quality * (c.ev / 105));
      const res = Field.play(c, { outs: S.outs, runners: S.runners, running: S.running0, bats: bats() }, S.rand);
      S.res = res;
      if (res.kind === 'foul') { S.foulBall = { res, t0: clock() }; after(0.9, () => pitchDone('foul')); return; }
      startPlay(res, c);
    }
    function timingPopup(e, c) {
      const ms = Math.round(Math.abs(e) * 1000);
      const t = c.onTime ? 'On time' : (e < 0 ? `${ms} ms early` : `${ms} ms late`);
      popup(t, c.onTime ? '#7ee2a8' : Math.abs(e) > 0.06 ? '#ff7a66' : '#ffd166', 1);
      if (c.whiff && c.words) popup(cap(c.words), '#ff9a66', 0.85);
      else if (!c.whiff && c.words && !c.tip) popup(cap(c.words), c.barrel ? '#7ee2a8' : '#e8e4da', 0.85);
    }
    function crossing() { return Pitch.at(S.pitch, S.pitch.T); }
    function hitBatter(x, y) { const bx = -2.75 * hs(); return Math.abs(x - bx) < 0.85 && y > 0.6 && y < 5.4; }

    // a pitch is over: what it did to the count, the runners and the at-bat
    function pitchDone(kind) {
      if (!S.running || S.phase === 'card') return;
      const p = S.pitch, x = crossing();
      const k = S.spec.kind;
      const rec = { b: S.count.b, s: S.count.s, typeId: p.typeId, mph: p.mph, x: x[0], y: x[1], strike: Pitch.isStrike(x[0], x[1]), heart: Pitch.isHeart(x[0], x[1]), out: Pitch.outside(x[0], x[1]), swung: !!S.swing, call: kind, timing: S.contact ? S.contact.e : null, typeOff: !!Pitch.OFFSPEED[p.typeId], contact: S.contact };
      S.kzone.push(rec);
      if (S.ab) S.ab.pitches.push(rec);
      S.phase = 'after';
      if (k === 'cage') return cageAfter(kind, rec);
      if (k === 'derby') return derbyAfter(kind, rec);
      // at-bats
      const ab = S.ab;
      let end = null;
      const steal = S.running0 && (kind === 'ball' || kind === 'strike' || kind === 'whiff');
      if (kind === 'ball') { popup(S.count.b === 3 ? 'Ball four' : 'Ball', '#7ee2a8', 1.2); S.count.b++; if (S.count.b >= 4) end = { kind: 'walk' }; }
      else if (kind === 'strike') { Sfx.play('ump'); popup(S.count.s === 2 ? 'Strike three' : 'Strike', '#ffd166', 1.2); S.count.s++; if (S.count.s >= 3) end = { kind: 'k', looking: true }; }
      else if (kind === 'whiff') { popup(S.count.s === 2 ? 'Strike three' : 'Swing and a miss', '#ffd166', 1.1); S.count.s++; if (S.count.s >= 3) end = { kind: 'k', looking: false }; }
      else if (kind === 'foul') { popup('Foul', '#e8e4da', 1.1); if (S.count.s < 2) S.count.s++; if (S.running0) { S.running0 = false; } }
      else if (kind === 'hbp') { popup('Hit by pitch', '#ff9a66', 1.2); end = { kind: 'hbp' }; }
      else if (kind === 'inplay') end = { kind: 'inplay', res: S.res, contact: S.contact };
      if (steal && !end) stealAttempt(ab);
      else if (steal && end && end.kind === 'k') stealAttempt(ab);
      else if (steal && end && end.kind === 'walk') S.running0 = false;
      updateBug();
      if (end) { after(kind === 'inplay' ? 0.2 : 1.0, () => endAB(end)); return; }
      if (S.outs >= 3) { after(1.0, () => endAB({ kind: 'inning' })); return; }
      if (S.count.s === 2 && S.count.b < 3) hintOnce('two', 'Two strikes: a short, quick swipe is a contact swing. A bigger barrel, less power.');
      after(1.15, startPitch);
    }
    // the runner was going on the pitch: catcher's throw vs his legs
    function stealAttempt(ab) {
      S.running0 = false;
      const P = S.P;
      const throwT = (P.tempo || 1.3) + 1.95 + Pitch.gauss(S.rand) * 0.06;
      const runT = 3.35;
      const safe = throwT - runT > 0.08 ? true : throwT - runT < -0.08 ? false : S.rand() < 0.5 + (throwT - runT) * 4;
      S.runners[0] = 0;
      if (safe) { S.runners[1] = 1; popup('He stole second', '#7ee2a8', 1); ab.stole = true; }
      else { S.outs++; popup('Thrown out at second', '#ff7a66', 1); ab.caught = true; }
    }

    // ---------- the ball in play ----------
    function runnerPlan(res) {
      const before = S.runners.slice();
      const after = res.runnersAfter || [0, 0, 0];
      const claimed = [0, 0, 0];
      let runsLeft = res.runs || 0;
      const plans = [];
      const hr = res.kind === 'hr';
      for (let b = 3; b >= 1; b--) {
        if (!before[b - 1]) continue;
        let dest = null, out = false;
        if (hr || runsLeft > 0) { dest = 4; if (!hr) runsLeft--; }
        else { for (let k = 3; k >= b; k--) if (after[k - 1] && !claimed[k - 1]) { dest = k; claimed[k - 1] = 1; break; } }
        if (dest == null) { dest = Math.min(4, b + 1); out = true; }
        plans.push({ from: b, to: dest, out, delay: S.outs === 2 || S.running0 ? 0 : 0.35 });
      }
      let bDest = null, bOut = false;
      if (hr) bDest = 4;
      else if (res.out && !res.fc && !res.infieldHit) { bDest = 1; bOut = true; }
      else {
        const start = Math.max(1, res.bases || 1);
        for (let k = start; k >= 1; k--) if (after[k - 1] && !claimed[k - 1]) { bDest = k; claimed[k - 1] = 1; break; }
        if (bDest == null) { bDest = 1; bOut = true; }
      }
      if (res.kind === 'out' && res.outType !== 'ground') bOut = true;
      plans.push({ from: 0, to: bDest, out: bOut, delay: 0.3, batter: true });
      return plans;
    }
    function startPlay(res, c) {
      S.cam = 'field';
      S.phase = 'play';
      ui.pitcher.hidden = true; ui.sit.hidden = true; hint('');
      const fl = res.flight;
      const last = fl.path[fl.path.length - 1];
      const stopT = res.catchT != null ? res.catchT : res.fieldT != null ? res.fieldT : last.t;
      const throws = [];
      const F = res.fielder ? Field.POSITIONS[res.fielder] : null;
      if (F && res.fieldP && res.outType === 'ground') {
        let from = res.fieldP, t = stopT + (F.inf ? 0.45 : 0.7);
        (res.throwTo || ['first']).forEach(b => { const to = Field.BASES[b]; const d = Math.hypot(to[0] - from[0], to[2] - from[2]); const dur = d / (F.arm || 110); throws.push({ from: from.slice(), to: to.slice(), t0: t, t1: t + dur }); t += dur + 0.5; from = to; });
      } else if (F && res.fieldP && !res.out && res.kind !== 'hr') {
        // a hit: the outfielder fires it back to the infield
        const to = [0, 0, 120];
        const d = Math.hypot(to[0] - res.fieldP[0], to[2] - res.fieldP[2]);
        throws.push({ from: res.fieldP.slice(), to, t0: stopT + 0.7, t1: stopT + 0.7 + d / 105 });
      }
      const runs = runnerPlan(res);
      const runEnd = Math.max(...runs.map(r => r.delay + Math.max(0, (r.to - r.from)) * 4.0));
      const ballEnd = throws.length ? throws[throws.length - 1].t1 : stopT;
      const end = res.kind === 'hr' ? last.t + 1.4 : Math.min(9, Math.max(ballEnd + 0.5, Math.min(runEnd, ballEnd + 2.5), 1.6));
      S.play = { res, c, t0: clock(), stopT, throws, runs, end, skip: false, done: false };
      S.focus = [0, 0, 30];
      const big = res.kind === 'hr' || res.kind === 'triple' || res.kind === 'double';
      if (res.kind === 'hr') { after(Math.min(2.2, fl.hang * 0.6), () => { Sfx.play('cheer'); }); }
      else if (big) after(Math.min(2, stopT), () => Sfx.play('cheer'));
      statLine([[Math.round(c.ev), 'Exit velo'], [Math.round(c.la) + '°', 'Launch'], [res.dist + ' ft', 'Distance']]);
    }
    function finishPlay() {
      const pl = S.play; if (!pl || pl.done) return;
      pl.done = true;
      const res = pl.res;
      const k = S.spec.kind;
      if (k === 'abs') {
        const big = res.kind === 'hr' ? `${res.label} · ${res.dist} ft` : res.label;
        banner(res.where ? cap(res.where) : '', big, null, 1.6);
        if (res.kind === 'hr') { Sfx.play('organ'); Sfx.buzz(60); }
        else if (!res.out) Sfx.play('good');
        else Sfx.play('groan');
        S.outs += res.outs || 0;
        S.runners = res.runnersAfter.slice();
        S.runsThisAB = (S.runsThisAB || 0) + (res.runs || 0);
        updateBug();
        after(1.4, () => { S.cam = 'bat'; pitchDone('inplay'); });
      } else if (k === 'derby') {
        after(res.kind === 'hr' ? 0.9 : 0.2, () => { S.cam = 'bat'; pitchDone('inplay'); });
      } else {
        after(0.6, () => { S.cam = 'bat'; pitchDone('inplay'); });
      }
    }

    // ---------- at-bats ----------
    function planFor(i) {
      const sp = S.spec;
      if (sp.plan && sp.plan[i]) return sp.plan[i];
      if (!S.order) {
        const ids = sp.pitchers && sp.pitchers.length ? sp.pitchers : Pitchers.IDS;
        S.order = [];
        while (S.order.length < sp.count) S.order = S.order.concat(shuffle(ids, S.rand));
        const sits = sp.situations === 'none' ? null : Array.isArray(sp.situations) ? sp.situations : ['leadoff', 'sacfly', 'empty', 'hitrun', 'move', 'empty', 'twoout', 'loaded', 'empty'];
        S.sitOrder = sits ? (Array.isArray(sp.situations) ? shuffle(sits, S.rand) : sits) : null;
      }
      return { pitcher: S.order[i], situation: S.sitOrder ? S.sitOrder[i % S.sitOrder.length] : 'empty' };
    }
    function startAB(i) {
      if (i >= S.spec.count) return endSession();
      const plan = planFor(i);
      const P = Pitchers.PITCHERS[plan.pitcher] || Pitchers.PITCHERS.flame;
      const sit = Pitchers.SITUATIONS[plan.situation] || Pitchers.SITUATIONS.empty;
      S.P = P; S.sit = sit;
      S.count = { b: (S.spec.startCount || [0, 0])[0], s: (S.spec.startCount || [0, 0])[1] };
      S.outs = sit.outs; S.runners = sit.runners.slice(); S.running0 = !!sit.running;
      S.runsThisAB = 0;
      S.kzone = [];
      S.pci = [0, 2.5]; S.pciHist = [{ t: clock(), p: S.pci.slice() }];
      S.ab = { i, pitcher: P.id, situation: sit.id, pitches: [], startCount: [S.count.b, S.count.s] };
      S.phase = 'intro'; S.cam = 'bat';
      setTitle(S.spec.title || 'At-Bats', `At-bat ${i + 1} of ${S.spec.count}`);
      ui.pitcher.innerHTML = settings.showTags ? `<b>${esc(P.name)}</b> · ${esc(P.tag)}` : `<b>${P.throws === 'L' ? 'Lefty' : 'Righty'}</b> on the mound`;
      ui.pitcher.hidden = false;
      ui.sit.innerHTML = sit.goal ? `${esc(sit.label)}: ${esc(sit.want)}` : '';
      ui.sit.hidden = !sit.goal;
      radar(null); updateBug(); statLine(null);
      const k = `At-bat ${i + 1}${S.count.b || S.count.s ? ` · count ${S.count.b}-${S.count.s}` : ''}`;
      banner(k, settings.showTags ? P.name : 'New pitcher', settings.showTags ? P.tell : 'Read him yourself: his arm slot, his speed, his spin.', 2.1);
      if (i === 0) hintOnce('swing', 'Touch and hold as he winds up. Drag to move your barrel. Swipe through to swing.');
      after(2.2, startPitch);
    }
    function sitOutcome(end) {
      const sit = S.sit; if (!sit || !sit.goal) return null;
      const runs = S.runsThisAB || 0;
      const r = end.res;
      if (sit.goal === 'score') return runs > 0;
      if (sit.goal === 'onbase') return ['walk', 'hbp'].includes(end.kind) || (r && !r.out);
      if (sit.goal === 'move') return runs > 0 || !!S.runners[2];
      if (sit.goal === 'hitrun') {
        if (S.ab.caught) return false;
        if (end.kind === 'inplay') return !!r && !r.dp && !r.doubledOff;
        return end.kind === 'walk' || end.kind === 'hbp' ? true : S.ab.stole ? null : false;
      }
      return null;
    }
    function endAB(end) {
      if (S.phase === 'card' || !S.ab) return;
      const ab = S.ab, P = S.P, sit = S.sit;
      // walks push everyone up a base
      if (end.kind === 'walk' || end.kind === 'hbp') {
        const r = S.runners;
        if (r[0] && r[1] && r[2]) S.runsThisAB = (S.runsThisAB || 0) + 1;
        S.runners = [1, r[0] ? 1 : r[1], r[0] && r[1] ? 1 : r[2]];
      }
      const runs = S.runsThisAB || 0;
      ab.result = { kind: end.kind === 'inplay' ? end.res.kind : end.kind, looking: !!end.looking, contact: end.contact || null, res: end.res || null, runs };
      ab.sitSuccess = sitOutcome(end);
      const g = Pitchers.grade(ab);
      ab.grade = g.letter;
      const rk = ab.result.kind;
      const rbi = end.res ? (end.res.rbi || 0) : (end.kind === 'walk' || end.kind === 'hbp') ? runs : 0;
      ab.points = (POINTS[rk] || 0) + rbi + (ab.sitSuccess ? 1 : 0);
      ab.rbi = rbi;
      S.score += ab.points;
      S.log.push({ i: ab.i, pitcher: ab.pitcher, situation: ab.situation, kind: rk, label: end.res ? end.res.label : rk === 'walk' ? 'Walk' : rk === 'hbp' ? 'Hit by pitch' : rk === 'k' ? (ab.result.looking ? 'Strikeout looking' : 'Strikeout swinging') : 'Inning over', grade: g.letter, points: ab.points, rbi, sitSuccess: ab.sitSuccess, ev: end.contact && !end.contact.whiff ? Math.round(end.contact.ev) : null, dist: end.res && end.res.dist, pitches: ab.pitches.length, chased: ab.pitches.filter(p => p.swung && !p.strike && p.out > 0.2).length });
      setScore(S.score, 'points');
      S.phase = 'card';
      ui.pitcher.hidden = true; ui.sit.hidden = true; hint('');
      const lesson = lessonFor(ab, g);
      ui.card.innerHTML = `<div class="k">At-bat ${ab.i + 1} · ${esc(P.name)}${sit.goal ? ` · ${esc(sit.label)}` : ''}</div><div class="w">${esc(narrate(ab))}</div>
        <div class="r"><span class="ab-grade ${g.letter}">${g.letter}</span><span>${esc(lesson)}</span></div>
        <div class="row"><span class="pts">${ab.points ? '+' + ab.points + ' pts' : 'No points'}</span><button class="ab-btn" type="button">${ab.i + 1 >= S.spec.count ? 'See results' : 'Next at-bat'}</button></div>`;
      ui.card.hidden = false;
      if (g.letter === 'A') Sfx.play('great'); else if (g.letter === 'B') Sfx.play('good');
      S.cardNext = () => { ui.card.hidden = true; startAB(ab.i + 1); };
    }

    const NAMES = { FF: 'fastball', SI: 'sinker', FC: 'cutter', SL: 'slider', SW: 'sweeper', CU: 'curveball', CH: 'changeup', FS: 'splitter' };
    function narrate(ab) {
      const ps = ab.pitches, last = ps[ps.length - 1];
      const r = ab.result;
      const tail = [];
      if (ab.caught) tail.push('The runner was thrown out at second.');
      if (ab.stole && r.kind !== 'k') tail.push('He stole second on the way.');
      if (S.sit.goal === 'score' || S.sit.goal === 'move' || S.sit.goal === 'hitrun' || r.runs) {
        if (r.runs) tail.push(r.runs === 1 ? 'A run scored.' : `${r.runs} runs scored.`);
        else if (S.sit.goal === 'move' && S.runners[2]) tail.push('The runner moved up to third.');
      }
      if (!last) return ['Inning over before you got a pitch to hit.'].concat(tail).join(' ');
      const count = `${last.b}-${last.s}`;
      const name = NAMES[last.typeId] || 'pitch';
      const where = Pitch.describe(last.x, last.y, bats());
      const behind = Pitchers.countGroup(last.b, last.s) === 'behind';
      const chased = last.swung && !last.strike && last.out > 0.2;
      let lead;
      if (chased) lead = `${count}, you chased a ${name} ${where}`;
      else if (last.heart && behind && last.swung) lead = `${count}, you sat on your pitch and he gave you a ${name} ${where}`;
      else lead = `${count}, a ${last.mph} mph ${name} ${where}`;
      let body;
      if (r.kind === 'walk') body = `Ball four, a ${name} ${where}. You took your walk.`;
      else if (r.kind === 'hbp') body = `He hit you with a ${name}. Take your base.`;
      else if (r.kind === 'k') body = r.looking ? `${count}, a ${name} ${where}, and you watched it. Strike three looking.` : `${lead}. Strike three swinging.`;
      else if (r.kind === 'inning') body = 'The inning ended on the bases.';
      else {
        const res = r.res, c = r.contact;
        const lab = res.kind === 'hr' ? `${res.label.toLowerCase()} ${res.where}, ${res.dist} feet` : `${res.label.toLowerCase()} ${res.where || ''}`.trim();
        body = `${lead}. ${cap(c.words)}: ${lab}.`;
      }
      return [body].concat(tail).join(' ');
    }
    function lessonFor(ab, g) {
      const P = S.P, sit = S.sit, f = g.flags;
      const r = ab.result;
      if (ab.sitSuccess === false) return sit.read;
      if (f.chase) return `${r.kind === 'walk' || (r.res && !r.res.out) ? 'It worked out, but that' : 'That'} ${NAMES[f.chase.typeId] || 'pitch'} ${Pitch.describe(f.chase.x, f.chase.y, bats())} was never a strike. ${P.read}`;
      if (f.tookHeart) return `${cap(Pitchers.COUNT_WORDS[Pitchers.countGroup(f.tookHeart.b, f.tookHeart.s)])} and he gave you one middle-middle. That is the pitch you are hunting: let it fly.`;
      if (f.lookingK) return 'With two strikes the edges are yours to protect. A short, quick swipe gives you a bigger barrel to spoil it.';
      if (f.early) return `You were out front on the ${NAMES[f.early.typeId]}. Against him, let it travel.`;
      if (ab.sitSuccess === true) return `You did what the moment asked. ${g.letter === 'A' ? 'That is a professional at-bat.' : ''}`.trim();
      if (r.kind === 'walk') return 'You made him come to you. Laying off the close ones is a skill.';
      if (r.contact && (r.contact.barrel || r.contact.hard)) return r.res && r.res.out ? 'Hit it hard, right at somebody. Good offense beats good pitching more often than not; keep doing that.' : 'You squared it up. That is the swing.';
      return P.read;
    }

    // ---------- derby ----------
    function derbyAfter(kind, rec) {
      const D = S.derby;
      if (S.swing) {
        if (kind === 'inplay' && S.res && S.res.kind === 'hr') { D.hr++; D.longest = Math.max(D.longest, S.res.dist); D.dists.push(S.res.dist); popup(`${S.res.dist} ft`, '#7ee2a8', 1.3); }
        else { D.outs++; popup(`Out ${D.outs}`, '#ff9a66', 1); }
      }
      setScore(D.hr, `HR · ${Math.max(0, D.outs0 - D.outs)} outs left`);
      if (D.outs >= D.outs0) { after(1.0, endSession); return; }
      after(0.7, startPitch);
    }
    // ---------- cage ----------
    function cageAfter(kind, rec) {
      const C = S.cage;
      if (S.calibrating) {
        const need = S.spec.swings || 5;
        if (S.calib.length >= need) { after(0.9, endSession); return; }
        if (!S.swing && kind !== 'inplay') popup('Swing at this one', '#ffd166', 1);
        after(0.9, startPitch);
        return;
      }
      if (S.swing) {
        C.swings++;
        const c = S.contact;
        if (c && !c.whiff && !c.tip) {
          C.contact++; C.evs.push(c.ev);
          if (S.res) { C.best = Math.max(C.best, c.ev); if (S.res.kind !== 'foul' && S.res.kind !== 'foulout') C.longest = Math.max(C.longest, S.res.dist || 0); if (S.res.kind === 'hr') C.hr++; }
        }
      } else popup(rec.strike ? 'Strike' : 'Ball', rec.strike ? '#ffd166' : '#7ee2a8', 1);
      setScore(C.contact ? Math.round(C.evs.reduce((a, b) => a + b, 0) / C.evs.length) : '–', 'avg exit velo');
      after(0.9, startPitch);
    }

    // ---------- run / end ----------
    function run(spec, handlers) {
      stop(true);
      S.spec = JSON.parse(JSON.stringify(spec));
      S.onEnd = handlers && handlers.onEnd; S.onQuit = handlers && handlers.onQuit;
      S.rand = spec.seed != null ? mulberry(spec.seed) : Math.random;
      Object.assign(S, { t: 0, timers: [], popups: [], log: [], score: 0, ended: false, phase: 'idle', cam: 'bat', play: null, swing: null, contact: null, pitch: null, releaseAt: null, arriveAt: null, order: null, sitOrder: null, ab: null, kzone: [], calib: [], calibrating: false, derby: null, cage: null, running0: false, outs: 0, runners: [0, 0, 0], count: { b: 0, s: 0 }, foulBall: null, res: null, cardNext: null });
      S.pci = [0, 2.5]; S.pciHist = [{ t: clock(), p: S.pci.slice() }];
      ['bug', 'radar', 'pitcher', 'sit', 'stat', 'banner', 'hint', 'card'].forEach(k => { ui[k].hidden = true; });
      setScore('', '');
      S.running = true;
      S.last = performance.now();
      S.raf = requestAnimationFrame(frame);
      const k = spec.kind;
      if (k === 'abs') { setScore(0, 'points'); startAB(0); }
      else if (k === 'derby') {
        S.P = Pitchers.COACH;
        S.derby = { outs0: spec.outs || 10, outs: 0, hr: 0, longest: 0, dists: [] };
        setTitle(spec.title || 'Home Run Derby', `${S.derby.outs0} outs · homers only`);
        setScore(0, `HR · ${S.derby.outs0} outs left`);
        banner('Home Run Derby', 'Let it fly', 'Batting practice fastballs. Lift it: a steeper swipe launches it.', 2);
        hintOnce('derby', 'Swipe up and across for loft, and get out front a hair to pull it: it\'s 330 down the lines, 400 to center. Takes are free.');
        after(2.1, startPitch);
      } else {
        S.P = Object.assign({}, Pitchers.COACH, { throws: spec.throws || 'R', tempo: 1.25, arsenal: {} });
        S.cage = { swings: 0, contact: 0, evs: [], best: 0, longest: 0, hr: 0 };
        S.calibrating = !!spec.calibrate;
        if (S.calibrating) {
          setTitle(spec.title || 'Find your timing', `${spec.swings || 5} fastballs down the middle`);
          banner('Find your timing', 'Swing at five', 'Just be yourself: swipe when it feels on time. Your rhythm sets the clock for every pitch after.', 2.6);
          hintOnce('calib', 'Touch and hold as he winds up, then swipe through when the ball gets to you.');
          after(2.7, startPitch);
        } else {
          const label = spec.pitch && spec.pitch !== 'mix' ? Pitch.TYPES[spec.pitch].name : 'Mixed pitches';
          setTitle(spec.title || 'Batting Cage', `${label} · ${spec.speed && spec.speed < 1 ? 'slowed down' : 'game speed'}${spec.loc === 'any' ? ' · anywhere' : ' · middle'}`);
          setScore('–', 'avg exit velo');
          after(0.6, startPitch);
        }
      }
    }
    function summary(quit) {
      const k = S.spec ? S.spec.kind : null;
      const out = { kind: k, quit: !!quit, points: S.score, log: S.log };
      if (k === 'abs' && S.log.length) {
        const gp = { A: 4, B: 3, C: 2, D: 1, F: 0 };
        out.readIQ = Math.round(S.log.reduce((s, l) => s + gp[l.grade], 0) / S.log.length * 25);
        const hits = S.log.filter(l => ['single', 'double', 'triple', 'hr'].includes(l.kind)).length;
        const bb = S.log.filter(l => l.kind === 'walk' || l.kind === 'hbp').length;
        out.hits = hits; out.ab = S.log.length - bb; out.bb = bb;
        out.hr = S.log.filter(l => l.kind === 'hr').length;
        out.rbi = S.log.reduce((a, l) => a + (l.rbi || 0), 0);
        out.k = S.log.filter(l => l.kind === 'k').length;
        out.sits = S.log.filter(l => l.sitSuccess !== null && l.sitSuccess !== undefined);
      }
      if (k === 'derby' && S.derby) Object.assign(out, { hr: S.derby.hr, longest: S.derby.longest, outs: S.derby.outs });
      if (k === 'cage' && S.cage) Object.assign(out, { swings: S.cage.swings, contact: S.cage.contact, best: Math.round(S.cage.best), longest: S.cage.longest, avg: S.cage.evs.length ? Math.round(S.cage.evs.reduce((a, b) => a + b, 0) / S.cage.evs.length) : 0, hr: S.cage.hr });
      if (S.spec && S.spec.calibrate && S.calib.length) {
        const c = S.calib.slice().sort((a, b) => a - b);
        out.timing = clamp(-c[Math.floor(c.length / 2)], -0.3, 0.2);
        out.spread = Math.round((c[Math.floor(c.length * 0.75)] - c[Math.floor(c.length * 0.25)]) * 1000);
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
      hideBanner();
    }
    function destroy() { stop(); detach(); if (ro) ro.disconnect(); root.remove(); }

    // ---------- update ----------
    function update(dt) {
      S.t += dt;
      const due = S.timers.filter(x => x.at <= S.t);
      if (due.length) { S.timers = S.timers.filter(x => x.at > S.t); due.forEach(x => x.fn()); }
      if (!S.running) return;
      const now = clock();
      if (S.phase === 'windup' && now >= S.releaseAt) {
        S.phase = 'flight';
        Sfx.play('release');
        radar(S.pitch);
      }
      if (S.phase === 'flight' || S.phase === 'windup') {
        if (S.swing && !S.swing.done && now >= S.swing.resolveAt) resolveSwing();
        else if (!S.swing && S.phase === 'flight' && now >= S.arriveAt + 0.16) {
          const x = crossing();
          Sfx.play('mitt');
          pitchDone(hitBatter(x[0], x[1]) ? 'hbp' : Pitch.isStrike(x[0], x[1]) ? 'strike' : 'ball');
        }
      }
      if (S.phase === 'play' && S.play && !S.play.done) {
        const el = now - S.play.t0;
        if (el >= S.play.end || (S.play.skip && el > 0.4)) finishPlay();
      }
      S.popups.forEach(p => { p.t += dt; });
      S.popups = S.popups.filter(p => p.t < p.life);
    }

    // ---------- render ----------
    function frame(now) {
      if (!S.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - S.last) / 1000));
      S.last = now;
      update(dt);
      if (S.running) render();
      if (S.running) S.raf = requestAnimationFrame(frame);
    }
    function pitcherPose(now) {
      const P = S.P;
      const base = { pos: [0, 0, 60], lift: 0.83 };
      let pose = Park3D.POSES.pset, z = 60;
      if (S.phase === 'windup' || S.phase === 'flight' || (S.phase === 'after' && S.cam === 'bat')) {
        const wd = S.releaseAt - S.windAt;
        const k = S.releaseAt ? (now - S.windAt) / wd : 0;
        const rel = Park3D.releasePose(P.slot);
        if (k < 0.5) pose = Park3D.blend(Park3D.POSES.pset, Park3D.POSES.kick, ease(Math.max(0, k) / 0.5));
        else if (k < 0.82) pose = Park3D.blend(Park3D.POSES.kick, Park3D.POSES.stride, ease((k - 0.5) / 0.32));
        else if (k < 1) pose = Park3D.blend(Park3D.POSES.stride, rel, ease((k - 0.82) / 0.18));
        else { const f = Math.min(1, (now - S.releaseAt) / 0.35); pose = Park3D.blend(rel, Park3D.POSES.follow, ease(f)); }
        z = 60 - 3.6 * ease(clamp((k - 0.5) / 0.5, 0, 1));
      }
      if (P.throws === 'L') pose = Park3D.mirror(pose);
      return Object.assign(base, { pos: [0, 0, z], face: [0, 0, -1], pose, colors: Object.assign({ skin: '#d29a6a', socks: P.colors.trim, shoes: '#14161b', glove: '#5a3416' }, P.colors), number: P.number, glove: P.throws === 'L' ? 'r' : 'l', back: false });
    }
    // a swing stays on screen through the follow-through, then he settles back in
    function swingLive(now) { return S.swing && now - S.swing.animStart < 1.3; }
    // the bat: where your hands and barrel are through the swing
    function batNow(now) {
      const s = hs();
      const bx = -2.75 * s;
      const H0 = [bx + 0.45 * s, 4.75, -0.05];
      const load = S.hold && !S.swing ? clamp((now - S.holdAt) / 0.25, 0, 1) : 0;
      let hands = [H0[0], H0[1] + load * 0.1, H0[2] - load * 0.3];
      let phi = 100, elev = 58;
      const sw = swingLive(now) ? S.swing : null;
      if (sw) {
        const target = sw.pci || pciAt(sw.g.t0 / 1000);
        const sweet = [target[0], target[1], Pitch.PLATE_Z + 0.4];
        const elevC = -18;
        const dirC = [Math.cos(elevC * Math.PI / 180) * s, Math.sin(elevC * Math.PI / 180), 0];
        const Hc = V.sub(sweet, V.mul(dirC, 2.05));
        const Hf = [bx + 0.15 * s, 5.4, 1.3];
        const u = clamp((now - sw.animStart) / 0.233, 0, 1);
        if (u < 0.6) { const k = ease(u / 0.6); hands = V.lerp3(hands, Hc, k); phi = 100 - 100 * k; elev = 58 + (elevC - 58) * k; }
        else { const k = (u - 0.6) / 0.4; hands = V.lerp3(Hc, Hf, k); phi = -170 * k; elev = elevC + (40 - elevC) * k; }
      }
      const pr = phi * Math.PI / 180, er = elev * Math.PI / 180;
      const dir = [Math.cos(er) * Math.cos(pr) * s, Math.sin(er), -Math.cos(er) * Math.sin(pr)];
      return { hands, dir, knob: V.sub(hands, V.mul(dir, 0.3)), tip: V.add(hands, V.mul(dir, 2.55)) };
    }
    function batterFig(now, bat) {
      const s = hs();
      const pos = [-2.75 * s, 0, 0.75];
      const st = JSON.parse(JSON.stringify(Park3D.POSES.stand));
      // a batting stance: wide base, knees flexed, front foot toward the pitcher
      st.lft = [-1.35, 0.12, 0.1]; st.rft = [1.2, 0.12, 0.05]; st.lkn = [-1.0, 1.75, 0.35]; st.rkn = [0.9, 1.75, 0.3];
      st.lhip = [-0.45, 3.2, 0]; st.rhip = [0.45, 3.2, 0]; st.head = [-0.15, 5.85, 0.15];
      let pose = st, turn = -35;
      if (swingLive(now)) {
        const u = clamp((now - S.swing.animStart) / 0.233, 0, 1);
        const sw = JSON.parse(JSON.stringify(st));
        sw.lft = [-1.75, 0.12, 0.25]; sw.lkn = [-1.35, 1.8, 0.4]; sw.rkn = [0.7, 1.5, 0.6]; sw.rft = [1.1, 0.25, 0.35];
        sw.head = [-0.3, 5.8, 0.25];
        pose = Park3D.blend(st, sw, ease(Math.min(1, u / 0.6)));
        // the hips and shoulders open up through the swing
        turn = -35 + 95 * ease(u);
      } else if (S.hold) {
        const k = clamp((now - S.holdAt) / 0.25, 0, 1);
        const ld = JSON.parse(JSON.stringify(st));
        ld.lft = [-1.0, 0.55, 0.05]; ld.lkn = [-0.75, 2.2, 0.45];
        pose = Park3D.blend(st, ld, k);
        turn = -35 - 6 * k;
      }
      if (s < 0) pose = Park3D.mirror(pose);
      const a = turn * Math.PI / 180;
      // closed in the stance, so from behind the plate you see his back
      const face = [s * Math.cos(a), 0, Math.sin(a)];
      // backlit: the lights are out in front of him, so from here he's mostly shadow
      const fig = { pos, face, pose, colors: { skin: '#5e4128', jersey: '#6f6c66', pants: '#615e58', cap: '#0c2034', trim: '#0c2034', socks: '#0b1b2b', shoes: '#0a0c10' }, helmet: true, back: true, alpha: 0.78, noShadow: true };
      // hands on the bat: top hand at the hands, bottom hand toward the knob
      const pz = JSON.parse(JSON.stringify(pose));
      const top = Park3D.toLocal(fig, bat.hands), bot = Park3D.toLocal(fig, V.sub(bat.hands, V.mul(bat.dir, 0.28)));
      const [th, bh] = s > 0 ? ['rha', 'lha'] : ['lha', 'rha'];
      pz[th] = top; pz[bh] = bot;
      const elbow = (sh, ha, side) => [(pz[sh][0] + pz[ha][0]) / 2 + side * 0.25, (pz[sh][1] + pz[ha][1]) / 2 - 0.35, (pz[sh][2] + pz[ha][2]) / 2];
      pz.rel = elbow('rsh', 'rha', 1); pz.lel = elbow('lsh', 'lha', -1);
      fig.pose = pz;
      return fig;
    }
    function ballInFlight(now) {
      if (!S.pitch || S.releaseAt == null || now < S.releaseAt) return null;
      let t = now - S.releaseAt;
      if (S.swing && S.contact && !S.contact.whiff && !S.contact.tip && S.res) return null;
      // past the plate it carries on into the catcher's mitt
      const tEnd = S.pitch.T + 0.035;
      if (t > tEnd) t = tEnd;
      return Pitch.at(S.pitch, t);
    }
    function render() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const now = clock();
      if (S.cam === 'field' && S.play) return renderField(now);
      const cam = Park3D.batterCam(W, H, bats(), {});
      Park3D.drawPark(ctx, cam, S.t);
      // fielders out in the field, then the pitcher
      drawFielders(cam, null);
      const pf = pitcherPose(now);
      Park3D.drawFigure(ctx, cam, pf);
      // the ball in his hand before release
      if ((S.phase === 'windup' || S.phase === 'set') && S.P) {
        const Wj = Park3D.figureWorld(pf);
        const hand = S.P.throws === 'L' ? Wj.lha : Wj.rha;
        if (S.phase === 'windup') Park3D.drawBall(ctx, cam, hand, { min: 1.6 });
      }
      drawZone(cam);
      // the pitch, with a faint streak behind it
      const b = ballInFlight(now);
      if (b) {
        S.trail.push(b); if (S.trail.length > 7) S.trail.shift();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineCap = 'round';
        for (let i = 1; i < S.trail.length; i++) { const a = Park3D.project(cam, S.trail[i - 1]), c = Park3D.project(cam, S.trail[i]); if (a && c) { ctx.lineWidth = Math.max(1, Pitch.BALL_R * c.s * 1.2 * i / S.trail.length); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); } }
        Park3D.drawBall(ctx, cam, b, { tell: S.pitch.type.spin, phase: (now - S.releaseAt) * 40 });
      }
      // a foul ball leaving the picture
      if (S.foulBall) {
        const fb = S.foulBall, el = now - fb.t0, path = fb.res.flight.path;
        const smp = path.find(p => p.t >= el) || path[path.length - 1];
        if (el < 1.2) Park3D.drawBall(ctx, cam, smp.p, {}); else S.foulBall = null;
      }
      const bat = batNow(now);
      Park3D.drawFigure(ctx, cam, batterFig(now, bat));
      Park3D.drawBat(ctx, cam, bat.knob, bat.tip);
      drawKZone();
      drawPopups();
    }
    function drawFielders(cam, play) {
      const P = S.P || Pitchers.COACH;
      const colors = Object.assign({ skin: '#c68642', socks: P.colors.trim, shoes: '#14161b', glove: '#6b3d1a' }, P.colors);
      const list = [];
      Field.IDS.forEach(id => {
        if (id === 'P' && !play) return;
        if (id === 'C' && !play) return;
        const F = Field.POSITIONS[id];
        const st = play ? fielderAt(id, play) : { pos: F.pos, pose: Park3D.POSES.ready, face: [-F.pos[0], 0, -F.pos[2]] };
        list.push({ id, st, z: Park3D.toCam(cam, st.pos)[2] });
      });
      list.sort((a, b) => b.z - a.z).forEach(o => Park3D.drawFigure(ctx, cam, { pos: o.st.pos, face: o.st.face, pose: o.st.pose, colors, number: null, glove: 'l' }));
    }
    function drawZone(cam) {
      const Z = Pitch.ZONE, z = Pitch.PLATE_Z;
      if (settings.zone && S.phase !== 'card') {
        const pts = [[-Z.half, Z.y0, z], [Z.half, Z.y0, z], [Z.half, Z.y1, z], [-Z.half, Z.y1, z]].map(p => Park3D.project(cam, p));
        if (pts.every(Boolean)) {
          ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
          ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      // your barrel: where you're looking to hit it, and how much plate you cover
      if (S.spec.kind === 'derby' && S.phase === 'card') return;
      const c = Park3D.project(cam, [S.pci[0], S.pci[1], z]);
      if (!c) return;
      const two = S.spec.kind === 'abs' && S.count.s === 2;
      const P = Contact.SWINGS.power.cover, Cc = Contact.SWINGS.contact.cover;
      const on = S.hold ? 1 : 0.6;
      ctx.lineWidth = S.hold ? 2 : 1.4;
      ctx.strokeStyle = `rgba(255,209,102,${0.55 * on})`;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, P[0] * c.s, P[1] * c.s, 0, 0, Math.PI * 2); ctx.stroke();
      if (two) { ctx.setLineDash([3, 4]); ctx.strokeStyle = `rgba(126,226,168,${0.55 * on})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, Cc[0] * c.s, Cc[1] * c.s, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      // the sweet spot
      ctx.fillStyle = `rgba(255,209,102,${0.22 * on})`;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, P[0] * Contact.GREEN * c.s, P[1] * Contact.GREEN * c.s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,209,102,${0.9 * on})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    // the pitch tracker: every pitch of this at-bat, where it crossed
    function drawKZone() {
      if (!S.kzone.length && S.spec.kind !== 'abs') return;
      const w = 66, h = 84, x0 = Math.round(W - 14 - w - 6), y0 = Math.round(Math.max(170, H * 0.2));
      const sc = w / 3.4;
      const zx = v => x0 + w / 2 + v * sc, zy = v => y0 + h - (v - 0.6) * sc;
      ctx.fillStyle = 'rgba(6,9,16,0.7)'; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      roundRect(x0 - 6, y0 - 6, w + 12, h + 12, 8); ctx.fill(); ctx.stroke();
      const Z = Pitch.ZONE;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      ctx.strokeRect(zx(-Z.half), zy(Z.y1), Z.half * 2 * sc, (Z.y1 - Z.y0) * sc);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(zx(-Z.half + i * Z.half * 2 / 3), zy(Z.y1)); ctx.lineTo(zx(-Z.half + i * Z.half * 2 / 3), zy(Z.y0)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(zx(-Z.half), zy(Z.y0 + i * (Z.y1 - Z.y0) / 3)); ctx.lineTo(zx(Z.half), zy(Z.y0 + i * (Z.y1 - Z.y0) / 3)); ctx.stroke();
      }
      S.kzone.slice(-8).forEach((p, i, arr) => {
        const px = clamp(zx(p.x), x0 - 2, x0 + w + 2), py = clamp(zy(p.y), y0 - 2, y0 + h + 2);
        const col = TYPE_COLOR[p.typeId] || '#fff';
        ctx.fillStyle = p.swung ? 'rgba(0,0,0,0.6)' : col;
        ctx.strokeStyle = col; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = p.swung ? col : '#0b0f18';
        ctx.font = '700 8px "Oswald", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(S.kzone.length - arr.length + i + 1), px, py + 0.5);
      });
    }
    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function drawPopups() {
      let y = H * 0.47;
      S.popups.forEach(p => {
        const k = p.t / p.life;
        ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
        ctx.fillStyle = p.color;
        ctx.font = `700 ${Math.round(24 * p.size)}px "Oswald", Impact, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
        ctx.fillText(p.text.toUpperCase(), W / 2, y - k * 14);
        ctx.shadowBlur = 0;
        y += 30 * p.size;
        ctx.globalAlpha = 1;
      });
    }

    // ---------- the play, from the field camera ----------
    function ballAt(pl, el) {
      const path = pl.res.flight.path;
      if (el <= pl.stopT) {
        let i = 1; while (i < path.length && path[i].t < el) i++;
        const a = path[i - 1], b = path[Math.min(i, path.length - 1)];
        const k = b.t > a.t ? (el - a.t) / (b.t - a.t) : 0;
        return V.lerp3(a.p, b.p, clamp(k, 0, 1));
      }
      for (const th of pl.throws) {
        if (el < th.t0) return [th.from[0], 4, th.from[2]];
        if (el <= th.t1) { const k = (el - th.t0) / (th.t1 - th.t0); const p = V.lerp3(th.from, th.to, k); p[1] = 5 + Math.sin(Math.PI * k) * Math.min(25, Math.hypot(th.to[0] - th.from[0], th.to[2] - th.from[2]) * 0.08); return p; }
      }
      const th = pl.throws[pl.throws.length - 1];
      if (th) return [th.to[0], 4, th.to[2]];
      const last = path[path.length - 1];
      return pl.res.fieldP ? [pl.res.fieldP[0], 4, pl.res.fieldP[2]] : last.p;
    }
    function fielderAt(id, pl) {
      const F = Field.POSITIONS[id];
      const el = clock() - pl.t0;
      const res = pl.res;
      let pos = F.pos.slice(), pose = Park3D.POSES.ready;
      let face = [-F.pos[0], 0, -F.pos[2]];
      const runTo = (target, arrive, speed) => {
        const d = Math.hypot(target[0] - F.pos[0], target[2] - F.pos[2]);
        const t = clamp((el - F.react) / Math.max(0.2, arrive - F.react), 0, 1);
        const lim = speed ? Math.min(1, (Math.max(0, el - F.react) * speed) / Math.max(1, d)) : t;
        const k = Math.min(t, lim);
        pos = [F.pos[0] + (target[0] - F.pos[0]) * k, 0, F.pos[2] + (target[2] - F.pos[2]) * k];
        if (k > 0 && k < 1) { pose = Math.floor(el * 7) % 2 ? Park3D.POSES.run1 : Park3D.POSES.run2; face = [target[0] - F.pos[0], 0, target[2] - F.pos[2]]; }
      };
      if (res.fielder === id && res.fieldP) {
        runTo(res.fieldP, pl.stopT);
        if (el >= pl.stopT - 0.15) { pose = res.outType === 'ground' ? Park3D.POSES.scoop : Park3D.POSES.reach; face = [-pos[0], 0, -pos[2]]; }
        const th = pl.throws[0];
        if (th && el >= th.t0 - 0.25 && el < th.t0 + 0.3) { pose = Park3D.POSES.throw; face = [th.to[0] - pos[0], 0, th.to[2] - pos[2]]; }
      } else {
        // everybody else: outfielders back up the ball, infielders cover a bag
        const land = res.flight.land;
        if (!F.inf && land) runTo([land[0] * 0.8 + F.pos[0] * 0.2, 0, land[2] * 0.8 + F.pos[2] * 0.2], 9, F.speed * 0.6);
        else if (id === '1B') runTo([62, 0, 66], 2.5, 18);
        else if (id === 'SS' && res.throwTo && res.throwTo[0] === 'second') runTo([-4, 0, 124], 1.6, 20);
        else if (id === '2B' && res.throwTo && res.throwTo.includes('second')) runTo([3, 0, 125], 1.6, 20);
      }
      return { pos, pose, face };
    }
    function runnerAt(r, pl) {
      const el = clock() - pl.t0 - r.delay;
      const per = 4.0;
      const legs = Math.max(0, r.to - r.from);
      const k = clamp(el / (per * Math.max(1, legs)), 0, 1);
      const along = r.from + legs * k;
      const i = Math.min(3, Math.floor(along)), f = along - i;
      const a = BASE_PTS[i], b = BASE_PTS[Math.min(4, i + 1)];
      const pos = [a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f];
      const moving = k > 0 && k < 1;
      const face = [b[0] - a[0], 0, b[2] - a[2]];
      const fade = r.out && k >= 1 ? Math.max(0, 1 - (el - per * Math.max(1, legs)) / 0.8) : 1;
      return { pos, pose: moving ? (Math.floor(el * 7) % 2 ? Park3D.POSES.run1 : Park3D.POSES.run2) : Park3D.POSES.stand, face, alpha: fade };
    }
    function renderField(now) {
      const pl = S.play;
      const el = now - pl.t0;
      const b = ballAt(pl, el);
      // ease the camera after the ball, rising with it
      const k = 1 - Math.exp(-Math.min(0.05, 1 / 60) * 3.2);
      const tgt = [b[0], Math.min(b[1], 90), b[2]];
      S.focus = [S.focus[0] + (tgt[0] - S.focus[0]) * k * 1.4, S.focus[1] + (tgt[1] - S.focus[1]) * k, S.focus[2] + (tgt[2] - S.focus[2]) * k * 1.4];
      const cam = Park3D.followCam(W, H, S.focus, clamp(S.focus[1] / 90, 0, 1));
      Park3D.drawPark(ctx, cam, S.t);
      const items = [];
      const P = S.P || Pitchers.COACH;
      const oppC = Object.assign({ skin: '#c68642', socks: P.colors.trim, shoes: '#14161b', glove: '#6b3d1a' }, P.colors);
      const homeC = Object.assign({ skin: '#c68642' }, HOME);
      Field.IDS.forEach(id => { const st = fielderAt(id, pl); items.push({ z: Park3D.toCam(cam, st.pos)[2], draw: () => Park3D.drawFigure(ctx, cam, { pos: st.pos, face: st.face, pose: st.pose, colors: oppC, glove: 'l' }) }); });
      pl.runs.forEach(r => { const st = runnerAt(r, pl); if (st.alpha <= 0.02) return; items.push({ z: Park3D.toCam(cam, st.pos)[2], draw: () => Park3D.drawFigure(ctx, cam, { pos: st.pos, face: st.face, pose: st.pose, colors: homeC, helmet: true, alpha: st.alpha }) }); });
      items.push({ z: Park3D.toCam(cam, b)[2], draw: () => { Park3D.drawShadow(ctx, cam, b); Park3D.drawBall(ctx, cam, b, { min: 2.6, glow: true }); } });
      items.sort((a, c) => c.z - a.z).forEach(it => it.draw());
      drawPopups();
    }

    function setSettings(o) { Object.assign(settings, o || {}); }
    return { run, stop, destroy, setSettings, summary, get settings() { return settings; }, _S: S };
  }

  return { create, FEEL, TYPE_COLOR };
})();
