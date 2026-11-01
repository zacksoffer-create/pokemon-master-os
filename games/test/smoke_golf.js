// Plays Fairway headlessly: finding your swing, a few holes of Play 9, Closest to
// the Pin, the putting green, a challenge, the range and the menus. Screenshots
// every stage. Fails on any page error or sideways scroll.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/golf-shots';
const HOLES = +(process.argv[3] || 3);
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')); });
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) { errors.push('console: ' + m.text()); console.log('CONSOLE', m.text()); } });
  await p.setContent(page('fairway.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => { const orig = GolfEngine.create; GolfEngine.create = (...a) => (window.__eng = orig(...a)); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/01-home.png' });
  const overflow = async name => { const o = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); if (o) errors.push('horizontal overflow on ' + name); };
  await overflow('home');

  const G = await require('./gest_golf')(p);
  const wait = ms => p.waitForTimeout(ms);
  const speed = () => p.evaluate(() => { if (window.__eng) window.__eng._S.speed = 4; });
  const S = () => p.evaluate(() => { const S = window.__eng._S; return { phase: S.phase, hole: S.holeId, idx: S.idx, strokes: S.strokes, lie: S.lie, club: S.aim && S.aim.club, marker: S.aim && +S.aim.marker.toFixed(3), number: S.aim && Math.round(S.aim.number), pin: Math.round(Math.hypot(S.pin[0] - S.ball[0], S.pin[1] - S.ball[2]) * 10) / 10, read: S.read && S.read.primary, total: S.total }; });
  const waitPhase = async (ph, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await S(); if (ph.includes(s.phase)) return s; await wait(120); } return S(); };
  // a stock swing that lands on the number
  async function swingAt(o = {}) {
    const st = await S();
    const cal = await p.evaluate(() => window.__eng.settings.swing);
    const pw = o.power != null ? o.power : st.marker;
    const back = pw * cal.back;
    // a natural finish for a swing this size
    await G.swing(Object.assign({ back, finish: cal.finish * Math.pow(Math.max(0.35, Math.min(1, pw)), 0.6) }, o, { back }));
  }

  // 1. Find your swing
  await p.click('[data-go="round"]');
  await wait(400); await speed();
  await p.screenshot({ path: OUT + '/02-calibrate.png' });
  await waitPhase(['aim']);
  for (let i = 0; i < 3; i++) {
    await G.swing({ back: 0.16, finish: 0.12 });
    if (i === 0) { await wait(500); await p.screenshot({ path: OUT + '/03-cal-flight.png' }); }
    await waitPhase(['aim', 'intro', 'idle']);
    await wait(300);
  }
  const swingSet = await p.evaluate(() => window.__eng.settings.swing);
  console.log('swing set', JSON.stringify(swingSet));

  // 2. Play a few holes: every shot at the number, stock
  await wait(500); await speed();
  await p.screenshot({ path: OUT + '/04-hole1-intro.png' });
  let shots = 0;
  for (let h = 0; h < HOLES; h++) {
    let s = await waitPhase(['aim']);
    if (h === 0) await p.screenshot({ path: OUT + '/05-hole1-aim.png' });
    for (let k = 0; k < 9; k++) {
      s = await waitPhase(['aim']);
      if (s.hole !== ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9'][h]) break;
      console.log(`  hole ${h + 1} shot ${s.strokes + 1}`, JSON.stringify(s));
      await swingAt();
      shots++;
      if (h === 0 && k === 0) { await wait(250); await p.screenshot({ path: OUT + '/06-swing-through.png' }); await wait(600); await p.screenshot({ path: OUT + '/07-flight.png' }); }
      const c = await waitPhase(['card']);
      if (c.phase !== 'card') { errors.push(`no card after hole ${h + 1} shot ${k + 1}: ${JSON.stringify(c)}`); break; }
      if (h === 0 && k === 0) await p.screenshot({ path: OUT + '/08-card.png' });
      if (h === 0 && k === 1) await p.screenshot({ path: OUT + '/09-card2.png' });
      const txt = await p.textContent('.gx-card');
      console.log('    card:', txt.replace(/\s+/g, ' ').slice(0, 220));
      const done = /Next hole|See results/.test(txt);
      await p.click('.gx-card .gx-btn');
      if (done) break;
      await wait(300);
      if (h === 0 && k === 0) { await waitPhase(['aim']); await p.screenshot({ path: OUT + '/10-second-shot.png' }); }
      const s2 = await S();
      if (s2.club === 'P' && h === 0) await p.screenshot({ path: OUT + '/11-putt.png' });
    }
  }
  console.log('after holes', JSON.stringify(await S()));
  // a finished round goes straight to results; otherwise leave it now
  if (await p.isVisible('.gx-quit')) await p.click('.gx-quit');
  await wait(400);
  await p.screenshot({ path: OUT + '/12-round-results.png', fullPage: true });
  await overflow('results');

  // 3. Closest to the pin, one shot then quit
  await p.click('#results .cta.ghost'); await wait(200);
  await p.click('[data-go="ctp"]'); await wait(300); await speed();
  await waitPhase(['aim']);
  await p.screenshot({ path: OUT + '/13-ctp-aim.png' });
  await swingAt({ finish: 0.02 });
  await waitPhase(['card']);
  await p.screenshot({ path: OUT + '/14-ctp-card.png' });
  console.log('ctp card:', (await p.textContent('.gx-card')).replace(/\s+/g, ' ').slice(0, 240));
  await p.click('.gx-quit'); await wait(300);

  // 4. Putting green: two putts
  await p.click('#results .cta.ghost'); await wait(200);
  await p.click('[data-go="putting"]'); await wait(300); await speed();
  for (let i = 0; i < 2; i++) {
    await waitPhase(['aim']);
    if (i === 1) await p.screenshot({ path: OUT + '/15-putt-aim.png' });
    await swingAt({ finish: 0.05 });
    await waitPhase(['card']);
    console.log('putt card:', (await p.textContent('.gx-card')).replace(/\s+/g, ' ').slice(0, 200));
    if (i === 1) await p.screenshot({ path: OUT + '/16-putt-card.png' });
    await p.click('.gx-card .gx-btn');
  }
  await p.click('.gx-quit'); await wait(300);

  // 5. Range
  if (await p.isVisible('#results .cta.ghost')) await p.click('#results .cta.ghost'); await wait(200);
  await p.click('[data-go="range"]'); await wait(300); await speed();
  await waitPhase(['aim']);
  await swingAt({ power: 1, bow: 0.12 });
  await waitPhase(['aim'], 20000); await wait(200);
  await p.screenshot({ path: OUT + '/17-range.png' });
  await p.click('.gx-quit'); await wait(300);

  // 6. Menus
  await p.click('[data-go="challenges"]'); await wait(200);
  await p.screenshot({ path: OUT + '/18-challenges.png' });
  await p.click('#challenges [data-go="home"]'); await wait(200);
  await p.click('[data-go="book"]'); await wait(200);
  await p.screenshot({ path: OUT + '/19-book.png', fullPage: true });
  await overflow('book');
  await p.click('#book [data-go="home"]'); await wait(200);
  await p.click('[data-go="settings"]'); await wait(200);
  await p.screenshot({ path: OUT + '/20-settings.png' });
  await overflow('settings');
  await p.click('#settings [data-go="home"]'); await wait(200);
  await p.click('#moves summary'); await wait(150);
  await p.screenshot({ path: OUT + '/21-home-moves.png', fullPage: true });

  console.log('shots', shots);
  console.log('ERRORS', errors.length ? errors : 'none');
  await browser.close();
  if (errors.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
