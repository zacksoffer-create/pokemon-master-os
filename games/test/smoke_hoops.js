// Plays Basketball Playground headlessly: calibration, a few Read & React possessions,
// the 3-point contest, HORSE and the menus. Fails on any page error.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/hoops-shots';
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
  await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/01-home.png' });

  let G = await require('./gest')(p);
  // flick sized for the shooter's current distance (calibrated at 260px)
  async function flick(dx = 0, len = null) {
    const ideal = await p.evaluate(() => { const S = window.__eng && window.__eng._S; if (!S || !S.shooter || S.spec.calibrate) return 1; const R = Court3D.RIM; return HoopPhysics.idealFlick(Math.hypot(S.shooter.pos[0] - R.x, S.shooter.pos[2] - R.z)); });
    await G.flick(len || 260 * ideal, 120, dx);
  }
  const swipe = (dx, dy) => G.swipe(dx, dy);
  const tap = () => G.tap();
  const S = () => p.evaluate(() => { const e = window.__eng; return e ? { phase: e._S.phase, score: e._S.score, att: e._S.attempts, makes: e._S.makes } : null; });

  // expose engine for the test
  await p.evaluate(() => { const orig = HoopsEngine.create; HoopsEngine.create = (...a) => (window.__eng = orig(...a)); });

  await p.click('[data-go="rr"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + '/02-calibrate.png' });
  for (let i = 0; i < 3; i++) { await flick(); await p.waitForTimeout(2300); }
  console.log('after calibration', await S());
  const touchK = await p.evaluate(() => window.__eng.settings.touchK);
  console.log('touchK', touchK);
  await p.waitForTimeout(1700);
  await p.screenshot({ path: OUT + '/03-possession.png' });
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '/04-closeout.png' });
  await flick(); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/05-flight.png' });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/06-card.png' });
  console.log('poss1', await S());
  // possession 2: drive then shoot
  await p.click('.hx-card .hx-btn'); await p.waitForTimeout(1700);
  await swipe(-160, 10); await p.waitForTimeout(250);
  await p.screenshot({ path: OUT + '/07-drive.png' });
  await p.waitForTimeout(300);
  await flick(); await p.waitForTimeout(2800);
  console.log('poss2', await S());
  // possession 3: pump fake then shot
  if (await p.isVisible('.hx-card .hx-btn')) await p.click('.hx-card .hx-btn');
  await p.waitForTimeout(1700);
  await tap(); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/08-fake.png' });
  await p.waitForTimeout(250);
  await flick(); await p.waitForTimeout(2800);
  // possession 4: step back then wait out the clock
  if (await p.isVisible('.hx-card .hx-btn')) await p.click('.hx-card .hx-btn');
  await p.waitForTimeout(1700);
  await swipe(0, 150); await p.waitForTimeout(7000);
  console.log('poss4 clock', await S());
  await p.screenshot({ path: OUT + '/09-clock.png' });
  // quit to results
  await p.click('.hx-quit'); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/10-results.png', fullPage: true });

  // 3-point contest, quick
  await p.click('#results [data-go="home"].cta'); await p.waitForTimeout(200);
  await p.click('[data-go="rack"]'); await p.waitForTimeout(1500);
  for (let i = 0; i < 7; i++) { await flick(); await p.waitForTimeout(260); }
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/11-rack.png' });
  console.log('rack', await S());
  await p.click('.hx-quit'); await p.waitForTimeout(300);

  // HORSE vs Gary
  await p.click('[data-go="horse"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/12-horse-list.png' });
  await p.click('[data-opp="gary"]'); await p.waitForTimeout(2200);
  await p.screenshot({ path: OUT + '/13-horse-map.png' });
  const box = await p.locator('.hx-map svg').boundingBox();
  await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await p.click('.hx-map .hx-btn'); await p.waitForTimeout(300);
  await flick(); await p.waitForTimeout(4000);
  await p.screenshot({ path: OUT + '/14-horse-cpu.png' });
  console.log('horse', await p.evaluate(() => window.__eng._S.horse));
  await p.click('.hx-quit'); await p.waitForTimeout(300);

  // other screens
  for (const [id, f] of [['builder', '15-builder'], ['scout', '16-scout'], ['chart', '17-chart'], ['settings', '18-settings']]) {
    await p.evaluate(() => document.querySelector('[data-go="home"]') && 0);
    await p.goto('about:blank'); await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' }); await p.waitForTimeout(200);
    await p.click(`[data-go="${id}"]`); await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/${f}.png`, fullPage: true });
  }
  // shootaround on the arena
  await p.click('#settings [data-go="home"]'); await p.waitForTimeout(100);
  await p.click('[data-cycle="court"]'); await p.click('[data-cycle="court"]');
  await p.evaluate(() => { const orig = HoopsEngine.create; HoopsEngine.create = (...a) => (window.__eng = orig(...a)); });
  G = await require('./gest')(p);
  await p.click('[data-go="free"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/19-free-arena.png' });
  if (await p.isVisible('.hx-quit')) {
    await flick(); await p.waitForTimeout(400); await swipe(-150, 0); await p.waitForTimeout(600);
    await p.screenshot({ path: OUT + '/20-free-move.png' });
  }
  console.log('ERRORS', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
