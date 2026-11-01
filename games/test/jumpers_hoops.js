// Each jumper variant with real gestures: label, spot, contest. Plus gesture classification edges.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/hoops-shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' });

  // gesture classification edges (straight from the recognizer)
  const cls = await p.evaluate(() => {
    const mk = pts => Gesture.classify(pts[0], pts);
    const line = (dx, dy, n = 8, ms = 120) => Array.from({ length: n + 1 }, (_, i) => ({ x: 200 + dx * i / n, y: 500 + dy * i / n, t: ms * i / n }));
    const dipFlick = (dip, up) => { const pts = []; for (let i = 0; i <= 4; i++) pts.push({ x: 200, y: 600 + dip * i / 4, t: 20 * i }); for (let i = 1; i <= 8; i++) pts.push({ x: 200, y: 600 + dip - (dip + up) * i / 8, t: 80 + 15 * i }); return pts; };
    const c = g => g.type + (g.dir ? ':' + g.dir : '') + (g.fade ? ':fade' : '');
    return {
      straightDown: c(mk(line(0, 160))), tilted20: c(mk(line(58, 160))), diag45: c(mk(line(-140, 140))), diag58: c(mk(line(150, 94))),
      flat70: c(mk(line(170, 60))), flick: c(mk(line(0, -260))), wobble15: c(mk(dipFlick(15, 260))), dip60: c(mk(dipFlick(60, 260)))
    };
  });
  console.log('classify', JSON.stringify(cls));

  await p.evaluate(() => {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:99'; document.body.appendChild(host);
    window.__e = HoopsEngine.create(host, { touchK: 1.77, hints: false });
  });
  const G = await require('./gest')(p);
  const wait = ms => p.waitForTimeout(ms);
  const runPoss = (plan, seed) => p.evaluate(([plan, seed]) => window.__e.run({ kind: 'possessions', court: 'gym', count: 1, shotClock: 0, plan: [plan], seed }, { onEnd() {}, onQuit() {} }), [plan, seed]);
  const dist = () => p.evaluate(() => { const S = window.__e._S; const R = Court3D.RIM; return Math.hypot(S.shooter.pos[0] - R.x, S.shooter.pos[2] - R.z); });
  // a flick sized for this spot (fadeaways play 1.5 ft longer)
  const flick = async (fade = false) => {
    const d = await dist();
    const k = await p.evaluate(([d, f]) => HoopPhysics.idealFlick(f ? d + 1.5 : d), [d, fade]);
    const len = 260 * k;
    if (!fade) return G.flick(len, 120);
    // dip 60px, then flick up `len` from the bottom of the dip
    await p.evaluate(len => { const pts = []; for (let i = 0; i <= 4; i++) pts.push({ x: 195, y: 660 + 60 * i / 4, t: 20 * i }); for (let i = 1; i <= 8; i++) pts.push({ x: 195, y: 720 - len * i / 8, t: 80 + 15 * i }); pts.push({ x: 195, y: 720 - len, t: 202 }); window.__gest(pts); }, len);
  };
  const diag = side => p.evaluate(side => { const pts = []; for (let i = 0; i <= 6; i++) pts.push({ x: 195 + side * 130 * i / 6, y: 560 + 130 * i / 6, t: 100 * i / 6 }); pts.push({ x: 195 + side * 130, y: 690, t: 101 }); window.__gest(pts); }, side);
  const snap = () => p.evaluate(() => { const S = window.__e._S; const m = S.meter; return { phase: S.phase, variant: S.poss && S.poss.variant, contest: S.poss && S.poss.contest != null ? +S.poss.contest.toFixed(2) : null, fb: m && m.shot.feedback, dist: S.shooter && +Math.hypot(S.shooter.pos[0] - Court3D.RIM.x, S.shooter.pos[2] - Court3D.RIM.z).toFixed(1), acts: S.poss && S.poss.actions.slice() }; });
  const result = () => p.evaluate(() => { const S = window.__e._S; return { made: S.poss && S.poss.made, card: !document.querySelector('.hx-card').hidden && document.querySelector('.hx-card .w').textContent }; });
  const out = [];

  // 1. pull-up off a drive into a sagger, early in the drive
  await runPoss({ spot: 'top', defender: 'sagger' }, 21); await wait(2300);
  await G.swipe(-160, 0); await wait(70); await flick(); await wait(120);
  out.push(['pull-up vs Sagger', await snap()]);
  await p.screenshot({ path: OUT + '/j1-pullup.png' });
  await wait(2400); out.push(['  result', await result()]);

  // 2. pull-up after beating a closeout (drive on the catch)
  await runPoss({ spot: 'lw', defender: 'closer' }, 22); await wait(1250);
  await G.swipe(160, 0); await wait(420); await flick(); await wait(120);
  out.push(['pull-up past the Closer', await snap()]);
  await wait(2400); out.push(['  result', await result()]);

  // 3. step-back jumper vs the Wingspan
  await runPoss({ spot: 'le', defender: 'long' }, 23); await wait(2300);
  await G.swipe(0, 150); await wait(330); await flick(); await wait(120);
  out.push(['step-back vs Wingspan', await snap()]);
  await wait(2400); out.push(['  result', await result()]);

  // 4. side-step: jab one way to get him leaning, then side-step the other way
  await runPoss({ spot: 'top', defender: 'gambler' }, 24); await wait(2300);
  await G.swipe(40, 0); await wait(260); await diag(-1); await wait(320); await flick(); await wait(120);
  out.push(['jab, side-step vs Gambler', await snap()]);
  await p.screenshot({ path: OUT + '/j4-sidestep.png' });
  await wait(2400); out.push(['  result', await result()]);

  // 5. fadeaway over the Wingspan from the elbow
  await runPoss({ spot: 're', defender: 'long' }, 25); await wait(2300);
  await flick(true); await wait(250);
  out.push(['fadeaway vs Wingspan', await snap()]);
  await p.screenshot({ path: OUT + '/j5-fade.png' });
  await wait(2400); out.push(['  result', await result()]);

  // 6. same spot, same defender, plain jumper, for comparison
  await runPoss({ spot: 're', defender: 'long' }, 25); await wait(2300);
  await flick(false); await wait(150);
  out.push(['plain jumper vs Wingspan', await snap()]);
  await wait(2400); out.push(['  result', await result()]);

  out.forEach(([k, v]) => console.log(k.padEnd(28), JSON.stringify(v)));
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
