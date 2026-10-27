// Screenshots the aiming view from a spread of distances and lies, so the
// camera framing can be checked by eye: tee shots, approaches, a chip, a
// bunker shot and putts.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/golf-views';
require('fs').mkdirSync(OUT, { recursive: true });
const SPOTS = [
  ['tee-h1', { hole: 'h1', ball: [0, 0] }],
  ['tee-h3-dogleg', { hole: 'h3', ball: [0, 0] }],
  ['tee-h2-water', { hole: 'h2', ball: [1, 0] }],
  ['tee-h4-tucked', { hole: 'h4', ball: [0, 0] }],
  ['approach-h6-fallaway', { hole: 'h6', ball: [2, 225] }],
  ['approach-h9-water-left', { hole: 'h9', ball: [5, 260] }],
  ['chip-h1', { hole: 'h1', ball: [10, 345] }],
  ['bunker-h4', { hole: 'h4', ball: [-9, 156] }],
  ['putt-short', { hole: 'h6', ball: [3, 352] }],
  ['putt-long', { hole: 'h6', ball: [2, 334] }]
];
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
    await p.evaluate(spot => { window.__e.run({ kind: 'updown', seed: 3, spots: [spot] }, { onEnd() {}, onQuit() {} }); window.__e._S.speed = 8; }, spot);
    for (let i = 0; i < 40; i++) { const ph = await p.evaluate(() => window.__e._S.phase); if (ph === 'aim') break; await p.waitForTimeout(100); }
    await p.waitForTimeout(150);
    const info = await p.evaluate(() => { const S = window.__e._S; return { club: S.aim.club, read: S.read && S.read.primary, d: Math.round(Math.hypot(S.pin[0] - S.ball[0], S.pin[1] - S.ball[2])) }; });
    console.log(name.padEnd(24), JSON.stringify(info));
    await p.screenshot({ path: `${OUT}/v-${name}.png` });
  }
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
