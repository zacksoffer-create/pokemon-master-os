// Screenshots the aiming view from a spread of distances and lies, so the
// camera framing can be checked by eye: tee shots, approaches, a chip, a
// bunker shot and putts.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/golf-views';
require('fs').mkdirSync(OUT, { recursive: true });
// every hole from the tee, every par 4 and 5 from about 150 out, and the short game
const SPOTS = [];
['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'c1', 'c2'].forEach(h => SPOTS.push(['tee-' + h, { hole: h, ball: 'tee' }]));
['h1', 'h3', 'h5', 'h6', 'h8', 'h9'].forEach(h => SPOTS.push(['approach-' + h, { hole: h, ball: 'approach' }]));
SPOTS.push(['chip-h1', { hole: 'h1', ball: [10, 345] }], ['bunker-h4', { hole: 'h4', ball: [-9, 156] }], ['putt-straight-h4', { hole: 'h4', ball: [-7, 178] }], ['putt-downhill-h6', { hole: 'h6', ball: [3, 352] }], ['putt-long-h6', { hole: 'h6', ball: [2, 334] }]);
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(page('fairway.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99';
    document.body.appendChild(host);
    window.__e = GolfEngine.create(host, { swing: { back: 0.16, rate: 14, finish: 0.12 }, hints: false });
  });
  for (const [name, spot] of SPOTS) {
    await p.evaluate(spot => {
      const h = GolfCourse.HOLES[spot.hole];
      let ball = spot.ball;
      if (ball === 'tee') ball = h.line[0];
      if (ball === 'approach') { const tot = GolfCourse.lineInfo(h.line, 0, 0).total, q = GolfCourse.alongLine(h.line, tot - 150); ball = [q.x, q.z]; }
      window.__e.run({ kind: 'updown', seed: 3, spots: [{ hole: spot.hole, ball }] }, { onEnd() {}, onQuit() {} }); window.__e._S.speed = 8;
    }, spot);
    for (let i = 0; i < 40; i++) { const ph = await p.evaluate(() => window.__e._S.phase); if (ph === 'aim') break; await p.waitForTimeout(100); }
    await p.waitForTimeout(1300);
    const info = await p.evaluate(() => { const S = window.__e._S; return { club: S.aim.club, read: S.read && S.read.primary, d: Math.round(Math.hypot(S.pin[0] - S.ball[0], S.pin[1] - S.ball[2])) }; });
    console.log(name.padEnd(24), JSON.stringify(info));
    await p.screenshot({ path: `${OUT}/v-${name}.png` });
  }
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
