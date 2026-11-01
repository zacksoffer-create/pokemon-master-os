// Checks that a flick scaled to the distance scores, in the real page: shootaround from several spots.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/hoops-shots';
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => { const orig = HoopsEngine.create; HoopsEngine.create = (...a) => (window.__eng = orig(...a)); });
  const G = await require('./gest')(p);
  const flick = (len) => G.flick(len, 120);
  // calibrate with a 260px flick
  await p.click('[data-go="free"]'); await p.waitForTimeout(600);
  for (let i = 0; i < 3; i++) { await flick(260); await p.waitForTimeout(2200); }
  await p.waitForTimeout(800);
  const K = await p.evaluate(() => window.__eng.settings.touchK);
  console.log('K', K.toFixed(2));
  let shot = 0;
  for (const move of [null, 'left', 'left', 'down', 'right']) {
    if (move) { await G.swipe(move === 'left' ? -150 : move === 'right' ? 150 : 0, move === 'down' ? 150 : 0); await p.waitForTimeout(600); }
    const info = await p.evaluate(() => { const S = window.__eng._S; const R = Court3D.RIM; const d = Math.hypot(S.shooter.pos[0] - R.x, S.shooter.pos[2] - R.z); return { d, ideal: HoopPhysics.idealFlick(d) }; });
    for (let k = 0; k < 3; k++) {
      await flick(260 * info.ideal); await p.waitForTimeout(200);
      console.log('  shot', await p.evaluate(() => { const m = window.__eng._S.meter; return m ? { ratio: m.shot.ratio.toFixed(2), aim: m.shot.aimDeg.toFixed(1), fb: m.shot.feedback, w: m.shot.window.toFixed(3) } : null; }));
      await p.waitForTimeout(1600);
      shot++;
      if (shot === 2) await p.screenshot({ path: OUT + '/30-free-flight.png' });
    }
    const st = await p.evaluate(() => ({ m: window.__eng._S.makes, a: window.__eng._S.attempts }));
    console.log(`dist ${info.d.toFixed(1)} ft -> ${st.m}/${st.a} so far`);
  }
  await p.screenshot({ path: OUT + '/31-free-after.png' });
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})();
