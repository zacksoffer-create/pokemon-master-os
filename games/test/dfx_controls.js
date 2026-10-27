// Lockdown controls with real gestures through the page: a slide in time vs
// late vs biting on the jab, a slice on an exposed cross vs a protected
// dribble, a flick with the release vs on the pump fake vs after the apex,
// walling up vs taking the charge, boxing out then timing the jump, and a few
// scorers' right answers against the wrong ones.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/dfx-shots';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra) => { if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (extra ? '  ' + extra : '')); };
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => { const h = document.createElement('div'); h.style.cssText = 'position:fixed;inset:0;z-index:99'; document.body.appendChild(h); window.__d = LockdownEngine.create(h, { court: 'gym', hints: false }); });
  const G = await require('./dfxgest')(p);
  const wait = ms => p.waitForTimeout(ms);
  // page-side helpers: a per-frame bot, a slow drag, a slice through the ball, a flick up
  await p.evaluate(() => {
    window.__bot = src => { const fn = eval(src); const E = window.__d; return new Promise(res => { function tick() { const r = fn(E._S, E._S.w); if (r === 'done') return res(); if (!E._S.running) return res(); requestAnimationFrame(tick); } tick(); }); };
    window.__drag = (dx, dy) => new Promise(res => { let i = 0; __dfDown(195, 700); function tick() { i++; __dfMove(195 + dx * i / 10, 700 + dy * i / 10); if (i < 10) requestAnimationFrame(tick); else res(); } requestAnimationFrame(tick); });
    window.__slice = () => { const b = window.__d._ballScreen(); if (!b) return false; window.__dfg([{ x: b.x - 90, y: b.y + 6, t: 0 }, { x: b.x - 30, y: b.y + 2, t: 15 }, { x: b.x + 30, y: b.y - 2, t: 30 }, { x: b.x + 90, y: b.y - 6, t: 45 }, { x: b.x + 91, y: b.y - 6, t: 46 }]); return true; };
    window.__flick = (x) => { window.__dfg([{ x: x || 195, y: 720, t: 0 }, { x: x || 195, y: 680, t: 15 }, { x: x || 195, y: 620, t: 30 }, { x: x || 195, y: 540, t: 50 }, { x: x || 195, y: 539, t: 51 }]); };
  });
  const S = () => p.evaluate(() => { const S = window.__d._S, w = S.w; return { phase: S.phase, wph: w && w.phase, act: w && w.off.act && w.off.act.k, over: w && w.over, res: w && w.result && { kind: w.result.kind, g: w.result.grade, pts: w.result.points }, dec: w && w.dec.map(d => d.k + ':' + d.g), story: w && w.story.map(s => s.text).join(' '), contest: w && w.shotInfo ? +w.shotInfo.contest.toFixed(2) : null, cut: w && (w.story.find(s => s.k === 'drive') || {}).cut }; });
  async function start(plan, kind, extra) {
    await p.evaluate(([plan, kind, extra]) => window.__d.run(Object.assign({ kind: kind || 'lockdown', count: 1, court: 'gym', seed: 5, plan: [plan] }, extra || {}), { onEnd() {}, onQuit() {} }), [plan, kind, extra]);
    for (let i = 0; i < 100 && (await S()).phase !== 'live'; i++) await wait(30);
  }
  async function settle(ms) { for (let i = 0; i < (ms || 6000) / 50; i++) { const s = await S(); if (s.over) break; await wait(50); } await wait(100); await p.evaluate(() => window.__dfUp(195, 700)); return S(); }
  const show = (label, s) => console.log(label.padEnd(34), JSON.stringify({ res: s.res, dec: s.dec, contest: s.contest }));

  // ---- sliding ----
  await start({ scorer: 'slasher', script: ['drive:1'], firstSize: 0.5, gap0: 5.2 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'drive') { window.__drag(110, 0); return 'done'; } }`));
  let s = await settle(); show('slide right on his tell', s);
  check(s.cut === true, 'slide with his tell and you beat him to the spot');
  await start({ scorer: 'slasher', script: ['drive:1'], firstSize: 0.5, gap0: 5.2 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'drive' && a.ph === 'go' && a.t > 0.25) { window.__drag(110, 0); return 'done'; } }`));
  s = await settle(); show('slide late', s);
  check(s.cut === false, 'slide a beat late and he is by you');
  await p.screenshot({ path: OUT + '/c1-blowby.png' });
  await start({ scorer: 'shooter', script: ['jab:1', 'hold'], firstSize: 0.5 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'jab' && a.t > 0.04) { window.__drag(140, 0); return 'done'; } }`));
  s = await settle(); show('lunge at his jab', s);
  check(s.dec.includes('bitJab:D') && s.cut === false, 'lunge at the jab and he goes the other way');

  // ---- slicing ----
  await start({ scorer: 'loose', script: ['cross:front', 'hold'], firstSize: 0.5 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'cross' && a.t > a.T * 0.42) { window.__slice(); return 'done'; } }`));
  s = await settle(2500); show('slice the lazy crossover', s);
  check(s.res && s.res.kind === 'steal', 'a slice through the crossover out in front is a steal');
  await p.screenshot({ path: OUT + '/c2-steal.png' });
  await start({ scorer: 'shooter', script: ['cross:legs', 'hold'], firstSize: 0.5, gap0: 2.6 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'cross' && a.t > a.T * 0.45) { window.__slice(); return 'done'; } }`));
  s = await settle(2500); show('slice between the legs', s);
  check(s.dec.some(d => d.startsWith('reach')), 'a slice at a protected dribble is a reach');

  // ---- flicks ----
  await start({ scorer: 'shooter', script: ['rise'], firstSize: 0.5, gap0: 3.0 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'rise' && a.ph === 'gather') { window.__flick(); return 'done'; } }`));
  s = await settle(); show('go up with his shot', s);
  check(s.contest >= 0.7, 'go up with his gather and it\'s a hand in his face', 'contest ' + s.contest);
  await start({ scorer: 'shooter', script: ['rise'], firstSize: 0.5, gap0: 3.0 });
  s = await settle(); show('stay down on his shot', s);
  check(s.contest < 0.45, 'no jump, a weak contest', 'contest ' + s.contest);
  await start({ scorer: 'pump', script: ['pump:rise'], firstSize: 0.5, gap0: 3.3 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'pump' && a.ph === 'up') { window.__flick(); return 'done'; } }`));
  s = await settle(); show('jump on the pump fake', s);
  check(s.dec.includes('bitPump:D'), 'flick on the pump fake and you bit');
  await start({ scorer: 'pump', script: ['pump:rise'], firstSize: 0.5, gap0: 3.3 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'rise' && a.ph === 'up') { window.__flick(); return 'done'; } }`));
  s = await settle(); show('wait for his legs', s);
  check(s.dec.includes('stayedDown:A') && !s.dec.includes('bitPump:D'), 'stay down on the fake, go up with the real one');
  // at the rim: wall up inside the circle, then jump with him (block) or late (goaltending)
  await start({ scorer: 'rim', script: ['attack'], firstSize: 0.5, gap0: 7.2, d0: 10.5 }, 'swat');
  await p.evaluate(() => window.__dfDown(195, 700));
  await p.evaluate(() => window.__bot(`(S, w) => { if (w.shotInfo) { window.__dfUp(195, 700); window.__flick(); return 'done'; } }`));
  s = await settle(); show('wall up, jump with his release', s);
  check(s.dec.includes('wall:A') && s.res && s.res.kind === 'block', 'wall up, then go up with him: swatted');
  await p.screenshot({ path: OUT + '/c3-swat.png' });
  await start({ scorer: 'rim', script: ['attack'], firstSize: 0.5, gap0: 7.2, d0: 10.5 }, 'swat');
  await p.evaluate(() => window.__dfDown(195, 700));
  await p.evaluate(() => window.__bot(`(S, w) => { if (w.shotInfo && w.t - w.shotInfo.at > 0.3) { window.__dfUp(195, 700); window.__flick(); return 'done'; } }`));
  s = await settle(); show('jump after the apex', s);
  check(s.res && s.res.kind === 'goaltend', 'late, on the way down: goaltending');

  // ---- charge vs blocking foul ----
  await start({ scorer: 'rim', script: ['attack'], firstSize: 0.5 });
  await p.evaluate(() => window.__dfDown(195, 700));
  s = await settle(); show('set your feet in his path', s);
  check(s.res && s.res.kind === 'charge', 'set outside the circle: charge');
  await p.screenshot({ path: OUT + '/c4-charge.png' });
  await start({ scorer: 'rim', script: ['attack'], firstSize: 0.5 });
  await p.evaluate(() => window.__bot(`(S, w) => { const a = w.off.act; if (a && a.k === 'attack' && a.ph === 'go') { window.__drag(0, -90); return 'done'; } }`));
  s = await settle(); show('step into him', s);
  check(s.dec.includes('blocking:D'), 'still moving into him: blocking foul');

  // ---- box out, then the board ----
  await start({ scorer: 'crasher', shotSpot: 'lw', seed: 3 }, 'glass');
  await p.evaluate(() => window.__bot(`(S, w) => {
    const RB = w.rebound; if (!RB) return;
    if (!window.__held) { window.__held = 1; window.__dfDown(195, 700); }
    if (RB.boxing && !RB.sealed && !RB.lost && RB.sideAt != null && w.t > RB.sideAt + 0.06 && !window.__slid) { window.__slid = 1; let i = 0; (function mv() { i++; window.__dfMove(195 + RB.side * 9 * i, 700); if (i < 12) requestAnimationFrame(mv); })(); }
    if (RB.sealed || RB.lost) return 'done';
  }`));
  await wait(150);
  // then steer toward where it's coming down and go up for it
  await p.evaluate(() => window.__bot(`(S, w) => {
    const RB = w.rebound; if (!RB || w.over) return 'done';
    const Y = w.you.pos;
    if (RB.pred) { const f = window.__d._fingerFor(RB.pred.p); if (f) window.__dfMove(f.x, f.y); }
    const B = w.ball; if (B.ph && B.ph.v[1] < 0 && B.p[1] < 11.3 && B.p[1] > 9 && Math.hypot(B.p[0] - Y[0], B.p[2] - Y[2]) < 2.6 && !window.__jumped) { window.__jumped = 1; window.__dfUp(195, 700); window.__flick(); }
  }`));
  s = await settle(5000); show('box out, then go get it', s);
  await p.evaluate(() => { window.__held = window.__slid = window.__jumped = 0; });
  check(s.dec.includes('boxed:A') && (s.res.kind === 'board' || s.res.kind === 'made'), 'hold to box out, slide with him, then it\'s your board');
  await p.screenshot({ path: OUT + '/c5-board.png' });
  await start({ scorer: 'crasher', shotSpot: 'lw', seed: 3 }, 'glass');
  s = await settle(5000); show('watch the ball', s);
  check(s.dec.includes('noBox:D') || (s.res && s.res.kind === 'made'), 'never touch, never find him');

  // ---- right vs wrong, by grade ----
  const gp = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const g = x => x && x.res ? gp[x.res.g] : -1;
  await start({ scorer: 'loose', script: ['hold'], firstSize: 0.5 });
  await wait(500); await p.evaluate(() => window.__slice());
  const reach = await settle(4000); show('Loose Handle: reach on his hip', reach);
  check(g(reach) <= 1, 'reaching on the Loose Handle\'s hip dribble grades low');

  console.log('errors', errors.length ? errors : 'none');
  if (errors.length) fails++;
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await browser.close();
  process.exitCode = fails ? 1 : 0;
})();
