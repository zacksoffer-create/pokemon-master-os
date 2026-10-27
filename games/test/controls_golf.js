// Drives real swing gestures through the golf engine: the gesture edges, then
// each condition with the shot that beats it and the one it punishes.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/golf-controls';
require('fs').mkdirSync(OUT, { recursive: true });
const CAL = { back: 0.16, rate: 1 / 0.07, finish: 0.12 };

(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(page('fairway.html'), { waitUntil: 'networkidle' });
  await p.evaluate(cal => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99';
    document.body.appendChild(host);
    window.__e = GolfEngine.create(host, { swing: cal, hints: false });
  }, CAL);
  const G = await require('./gest_golf')(p);
  const wait = ms => p.waitForTimeout(ms);

  // 1. gesture edges: what the recognizer makes of each shape
  const shapes = await p.evaluate(() => {
    const H = window.innerHeight;
    const mk = (back, finish, downMs, bow, dx) => {
      const pts = [{ x: 195, y: 0.55 * H, t: 0 }];
      for (let i = 1; i <= 10; i++) pts.push({ x: 195, y: 0.55 * H + back * H * i / 10, t: 38 * i });
      const low = 0.55 * H + back * H, top = 0.55 * H - finish * H, chord = low - top, up = downMs * (back + finish) / back;
      for (let i = 1; i <= 12; i++) { const k = i / 12; pts.push({ x: 195 + (dx || 0) * k + Math.sin(Math.PI * k) * (bow || 0) * chord, y: low - chord * k, t: 380 + up * k }); }
      return pts;
    };
    const c = pts => { const g = Swing.classify(pts[0], pts); return g.type === 'swing' ? { type: g.type, back: +g.back.toFixed(3), rate: +g.rate.toFixed(1), finish: +g.finish.toFixed(3), curl: +g.curl.toFixed(3), angle: +(g.angle * 180 / Math.PI).toFixed(1) } : g; };
    return {
      stock: c(mk(0.16, 0.12, 70)), knock: c(mk(0.16, 0.02, 70)), high: c(mk(0.16, 0.3, 70)),
      quick: c(mk(0.16, 0.12, 45)), decel: c(mk(0.16, 0.12, 110)), halfSwing: c(mk(0.08, 0.06, 70)),
      draw: c(mk(0.16, 0.12, 70, 0.12)), fade: c(mk(0.16, 0.12, 70, -0.12)), pushed: c(mk(0.16, 0.12, 70, 0, 60)),
      aim: c([{ x: 100, y: 400, t: 0 }, { x: 160, y: 404, t: 50 }, { x: 220, y: 402, t: 100 }]),
      noBack: c([{ x: 195, y: 500, t: 0 }, { x: 195, y: 420, t: 60 }, { x: 195, y: 330, t: 120 }]),
      noThrough: c([{ x: 195, y: 400, t: 0 }, { x: 195, y: 480, t: 200 }, { x: 195, y: 520, t: 300 }]),
      tap: c([{ x: 195, y: 400, t: 0 }, { x: 196, y: 401, t: 80 }])
    };
  });
  console.log('gesture shapes');
  Object.entries(shapes).forEach(([k, v]) => console.log('  ' + k.padEnd(10), JSON.stringify(v)));

  // 2. conditions: the right shot and the wrong one
  let play = async function (name, spot, sw, prep) {
    const spec = spot.putt ? { kind: 'putting', putts: [spot.putt] } : { kind: 'updown', spots: [spot] };
    await p.evaluate(spec => { window.__e.run(Object.assign({ seed: 5 }, spec), { onEnd() {}, onQuit() {} }); window.__e._S.speed = 5; }, spec);
    for (let i = 0; i < 60; i++) { if (await p.evaluate(() => window.__e._S.phase) === 'aim') break; await wait(80); }
    if (prep) await prep();
    const a = await p.evaluate(() => { const S = window.__e._S; return { club: S.aim.club, auto: S.aim.auto, marker: S.aim.marker, read: S.read && S.read.primary }; });
    const back = (sw.full ? 1 : a.marker) * CAL.back * (sw.power || 1);
    await G.swing(Object.assign({ finish: CAL.finish }, sw, { back }));
    for (let i = 0; i < 200; i++) { if (await p.evaluate(() => window.__e._S.phase) === 'card') break; await wait(80); }
    const r = await p.evaluate(() => { const S = window.__e._S, l = S.log[S.log.length - 1] || {}; return { clubs: l.clubs, grade: l.grade, why: l.why, prox: l.prox != null ? Math.round(l.prox * 3) + 'ft' : null, note: l.note || (l.holed ? 'holed' : ''), type: l.type, shape: l.shape, text: document.querySelector('.gx-card .w').textContent }; });
    console.log(`  ${name.padEnd(34)} ${a.read.padEnd(8)} ${a.club}${a.club !== a.auto ? '(auto ' + a.auto + ')' : ''}  ${r.grade} ${String(r.prox).padStart(6)} ${r.note.padEnd(5)} | ${r.clubs} ${r.why} | ${r.text.slice(0, 110)}`);
    return r;
  }
  const more = () => p.click('.gx-cr'), less = () => p.click('.gx-cl');
  const aim = dx => G.aim(dx);
  const INTO = { dir: [180, 180], mph: [13, 13] }, GALE = { dir: [180, 180], mph: [18, 18] }, DOWN = { dir: [0, 0], mph: [15, 15] }, CROSS_R = { dir: [90, 90], mph: [15, 15] }, CALM = { dir: [0, 0], mph: [0, 0] };
  console.log('\nconditions');
  if (process.argv[3]) { const only = process.argv[3]; const orig = play; play = (n, ...a) => n.includes(only) ? orig(n, ...a) : Promise.resolve(); }
  await play('water + into: stock, same club', { hole: 'h2', ball: [1, 0], wind: INTO }, {});
  await play('water + into: high, same club', { hole: 'h2', ball: [1, 0], wind: INTO }, { finish: 0.32 });
  await play('water + into: knockdown, one more', { hole: 'h2', ball: [1, 0], wind: INTO }, { finish: 0.02, full: true }, more);
  await p.screenshot({ path: OUT + '/k-knock-card.png' });
  await play('water + gale: knockdown, one more', { hole: 'h2', ball: [1, 0], wind: GALE }, { finish: 0.02, full: true }, more);
  await play('water + gale: knockdown, two more', { hole: 'h2', ball: [1, 0], wind: GALE }, { finish: 0.02, full: true }, async () => { await more(); await wait(150); await more(); });
  await play('downwind: high, two less', { hole: 'c2', ball: [0, 0], wind: DOWN }, { finish: 0.32, full: true }, async () => { await less(); await wait(150); await less(); });
  await play('downwind: knockdown', { hole: 'c2', ball: [0, 0], wind: DOWN }, { finish: 0.02 });
  await play('cross to water: straight', { hole: 'h7', ball: [0, 0], wind: CROSS_R }, {});
  await play('cross to water: draw', { hole: 'h7', ball: [0, 0], wind: CROSS_R }, { bow: 0.12 });
  await play('cross to water: fade', { hole: 'h7', ball: [0, 0], wind: CROSS_R }, { bow: -0.12 });
  await play('tucked: high', { hole: 'h4', ball: [0, 0], wind: CALM }, { finish: 0.32 });
  await play('tucked: knockdown', { hole: 'h4', ball: [0, 0], wind: CALM }, { finish: 0.02 });
  await play('falling away: high', { hole: 'h6', ball: [2, 255], wind: CALM }, { finish: 0.32 });
  await play('falling away: knockdown', { hole: 'h6', ball: [2, 255], wind: CALM }, { finish: 0.02 });
  await play('bunker: high, half again harder', { hole: 'h4', ball: [-9, 156], wind: CALM }, { finish: 0.32, power: 1.5 });
  await p.screenshot({ path: OUT + '/k-bunker-card.png' });
  await play('bunker: high at the number', { hole: 'h4', ball: [-9, 156], wind: CALM }, { finish: 0.32 });
  await play('bunker: knockdown', { hole: 'h4', ball: [-9, 156], wind: CALM }, { finish: 0.02, power: 1.5 });
  await play('flier: one less club', { hole: 'h1', ball: [22, 225], wind: CALM }, { full: true }, less);
  await play('flier: normal club', { hole: 'h1', ball: [22, 225], wind: CALM }, {});
  await play('dogleg left: draw', { hole: 'h3', ball: [0, 0], wind: CALM }, { bow: 0.12 });
  await play('dogleg left: straight', { hole: 'h3', ball: [0, 0], wind: CALM }, {});
  await play('dogleg right: fade', { hole: 'h8', ball: [0, 0], wind: CALM }, { bow: -0.12 });
  await play('dogleg right: straight', { hole: 'h8', ball: [0, 0], wind: CALM }, {});
  await play('quick tempo', { hole: 'h1', ball: [-4, 250], wind: CALM }, { downMs: 42 });
  await play('decelerated', { hole: 'h1', ball: [-4, 250], wind: CALM }, { downMs: 115 });
  console.log('\nputts');
  const BREAK = { d: 4, slope: [0.022, 0], from: 0 }, UP = { d: 3.3, slope: [0, 0.02], from: 0 }, DOWNHILL = { d: 3.3, slope: [0, -0.02], from: 0 };
  await play('breaker: straight at it', { putt: BREAK }, { finish: 0.06 });
  await play('breaker: aimed high side', { putt: BREAK }, { finish: 0.06 }, async () => { await aim(145); await wait(100); });
  await p.screenshot({ path: OUT + '/k-putt-card.png' });
  await play('uphill at flat pace', { putt: UP }, { finish: 0.06 });
  await play('uphill, firm', { putt: UP }, { finish: 0.06, power: 1.12 });
  await play('downhill at flat pace', { putt: DOWNHILL }, { finish: 0.06 });
  await play('downhill, just rolling', { putt: DOWNHILL }, { finish: 0.06, power: 0.9 });
  // aim and clubs move what they should
  await p.evaluate(() => { window.__e.run({ kind: 'updown', seed: 5, spots: [{ hole: 'h1', ball: [0, 200], wind: { dir: [0, 0], mph: [0, 0] } }] }, { onEnd() {}, onQuit() {} }); window.__e._S.speed = 5; });
  for (let i = 0; i < 60; i++) { if (await p.evaluate(() => window.__e._S.phase) === 'aim') break; await wait(80); }
  const before = await p.evaluate(() => ({ club: window.__e._S.aim.club, off: window.__e._S.aim.off, marker: +window.__e._S.aim.marker.toFixed(3) }));
  await aim(120); await wait(100); await more(); await wait(450);
  const after = await p.evaluate(() => ({ club: window.__e._S.aim.club, off: +window.__e._S.aim.off.toFixed(2), marker: +window.__e._S.aim.marker.toFixed(3) }));
  console.log('\naim and club', JSON.stringify(before), '->', JSON.stringify(after));
  await p.screenshot({ path: OUT + '/k-aimed.png' });
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
