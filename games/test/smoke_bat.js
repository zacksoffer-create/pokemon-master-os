// Plays At Bat through its own menus: timing calibration, a full run of
// at-bats, situational hitting, the derby, the cage, a challenge, and the
// scouting report and settings. Screenshots along the way; fails on any page
// error or a screen that scrolls sideways.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/at-bat-shots';
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
  await p.setContent(page('at-bat.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => { const orig = BatEngine.create; BatEngine.create = (...a) => (window.__e = orig(...a)); });
  const G = await require('./batgest')(p);
  const wait = ms => p.waitForTimeout(ms);
  const shot = async name => { await wait(350); await p.screenshot({ path: `${OUT}/${name}.png` }); };
  const overflow = [];
  const checkOverflow = async where => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 1) overflow.push(`${where}: ${o}px`); };
  const cardUp = () => p.waitForFunction(() => { const c = document.querySelector('.ab-card'); return (c && !c.hidden) || !document.querySelector('#game') || document.querySelector('#game').hidden; }, null, { timeout: 30000 });
  const inGame = () => p.evaluate(() => !document.querySelector('#game').hidden);

  await wait(300);
  await shot('s01-home');
  await checkOverflow('home');
  await p.click('#guide summary');
  await p.screenshot({ path: `${OUT}/s02-home-guide.png`, fullPage: true });

  // At-Bats: the first time, five swings set your timing
  await p.click('[data-go="abs"]');
  await wait(900);
  await shot('s03-calibrate');
  for (let i = 0; i < 5; i++) { await G.swing({ e: 0, aim: true }); await p.waitForFunction(n => window.__e._S.calib.length >= n || window.__e._S.spec.kind === 'abs', i + 1, { timeout: 20000 }); }
  await p.waitForFunction(() => window.__e._S.spec.kind === 'abs' && window.__e._S.phase !== 'idle', null, { timeout: 20000 });
  const timing = await p.evaluate(() => window.__e.settings.timing);
  console.log('timing after calibration', timing);
  await wait(900);
  await shot('s04-ab-intro');

  // a full run: swing at the first pitch every time (barrel on it, a little lift)
  const swings = [];
  for (let ab = 0; ab < 9; ab++) {
    for (let k = 0; k < 8; k++) {
      await G.swing({ e: (k % 3 - 1) * 0.012, aim: true, plane: 22 + (ab % 3) * 8 });
      if (ab === 0 && k === 0) { await G.waitPhase('flight'); await wait(200); await shot('s05-pitch'); }
      await p.waitForFunction(() => ['after', 'card', 'play'].includes(window.__e._S.phase), null, { timeout: 20000 });
      if (ab === 0 && (await p.evaluate(() => window.__e._S.cam)) === 'field') { await wait(800); await shot('s06-play'); }
      await p.waitForFunction(() => ['after', 'card'].includes(window.__e._S.phase), null, { timeout: 20000 });
      if (await p.evaluate(() => !document.querySelector('.ab-card').hidden)) break;
      await p.waitForFunction(() => window.__e._S.phase === 'card' || window.__e._S.phase === 'set' || window.__e._S.phase === 'windup', null, { timeout: 20000 });
      if (await p.evaluate(() => window.__e._S.phase === 'card')) break;
    }
    await cardUp();
    const st = await G.state();
    swings.push(`${st.grade} ${st.card}`);
    if (ab === 0) await shot('s07-card');
    await p.click('.ab-card .ab-btn');
  }
  await p.waitForSelector('#results:not([hidden])', { timeout: 20000 });
  await wait(300);
  await p.screenshot({ path: `${OUT}/s08-results.png`, fullPage: true });
  await checkOverflow('results');
  console.log(swings.map((s, i) => `  AB ${i + 1}: ${s}`).join('\n'));

  // Situational: two trips, then leave
  await p.click('#results .cta.ghost');
  await p.click('[data-go="situ"]');
  await wait(1200);
  await shot('s09-situ-intro');
  for (let ab = 0; ab < 2; ab++) {
    for (let k = 0; k < 8; k++) {
      await G.swing({ e: 0, aim: true, plane: ab === 0 ? 38 : 5 });
      await p.waitForFunction(() => ['after', 'card'].includes(window.__e._S.phase), null, { timeout: 25000 });
      if (await p.evaluate(() => !document.querySelector('.ab-card').hidden)) break;
      await p.waitForFunction(() => ['card', 'set', 'windup'].includes(window.__e._S.phase), null, { timeout: 20000 });
      if (await p.evaluate(() => window.__e._S.phase === 'card')) break;
    }
    await cardUp();
    console.log('  situational', ab + 1, (await G.state()).card);
    if (ab === 0) await shot('s10-situ-card');
    await p.click('.ab-card .ab-btn');
  }
  await p.click('.ab-quit');
  await p.waitForSelector('#results:not([hidden])', { timeout: 10000 });
  await p.screenshot({ path: `${OUT}/s11-situ-results.png`, fullPage: true });

  // Derby: swing for the fences until ten outs
  await p.click('#results .cta.ghost');
  await p.click('[data-go="derby"]');
  await wait(1000);
  await shot('s12-derby');
  let derbyShot = false;
  for (let i = 0; i < 40 && await inGame(); i++) {
    await G.swing({ e: (i % 5 - 2) * 0.01, aim: true, plane: 40, miss: [0, 0.06] }).catch(() => {});
    await p.waitForFunction(() => document.querySelector('#game').hidden || ['after', 'play'].includes(window.__e._S.phase), null, { timeout: 20000 }).catch(() => {});
    if (!derbyShot && await inGame() && await p.evaluate(() => window.__e._S.cam === 'field' && window.__e._S.res && window.__e._S.res.kind === 'hr')) { await wait(1500); await shot('s13-derby-hr'); derbyShot = true; }
    // a tap skips the rest of the play
    else if (await inGame() && await p.evaluate(() => window.__e._S.phase === 'play')) { await wait(500); await p.evaluate(() => { const t = window.__realNow(); window.__swing({ downAt: t, hold: 60 }); }); }
    await p.waitForFunction(() => document.querySelector('#game').hidden || window.__e._S.phase === 'set' || window.__e._S.phase === 'windup', null, { timeout: 20000 }).catch(() => {});
  }
  await p.waitForSelector('#results:not([hidden])', { timeout: 20000 });
  await p.screenshot({ path: `${OUT}/s14-derby-results.png`, fullPage: true });
  console.log('  derby', await p.evaluate(() => document.querySelector('#results .big').textContent + ' HR'));

  // Cage: mixed pitches anywhere, three swings
  await p.click('#results .cta.ghost');
  await p.click('[data-go="cage"]');
  await p.click('[data-cage="pitch"] [data-v="mix"]');
  await p.click('[data-cage="loc"] [data-v="any"]');
  await shot('s15-cage-setup');
  await checkOverflow('cage');
  await p.click('#cage-go');
  for (let i = 0; i < 3; i++) {
    await G.swing({ e: 0, aim: true, plane: 25 });
    await p.waitForFunction(() => ['after', 'play'].includes(window.__e._S.phase), null, { timeout: 20000 });
    if (i === 1) { await wait(700); await shot('s16-cage-swing'); }
    await p.waitForFunction(() => ['set', 'windup'].includes(window.__e._S.phase), null, { timeout: 20000 });
  }
  await p.click('.ab-quit');
  await p.waitForSelector('#results:not([hidden])', { timeout: 10000 });
  await shot('s17-cage-results');

  // A challenge, one at-bat, then out
  await p.click('#results .cta.ghost');
  await p.click('[data-go="home"]').catch(() => {});
  await p.click('[data-go="chal"]');
  await shot('s18-challenges');
  await checkOverflow('challenges');
  await p.click('[data-feat="f-twostrike"]');
  await wait(2600);
  await shot('s19-twostrike');
  await p.click('.ab-quit');
  await wait(400);

  // Scouting report and settings
  await p.evaluate(() => { document.querySelectorAll('#app > .screen').forEach(s => { s.hidden = s.id !== 'home'; }); });
  await p.click('[data-go="scout"]');
  await wait(300);
  await p.screenshot({ path: `${OUT}/s20-scout.png`, fullPage: true });
  await checkOverflow('scout');
  await p.click('#scout .back');
  await p.click('[data-go="settings"]');
  await shot('s21-settings');
  await checkOverflow('settings');

  console.log('overflow', overflow.length ? overflow : 'none');
  console.log('errors', errors.length ? errors : 'none');
  if (errors.length || overflow.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
