// Jumps a new Living School game to tryouts and plays them with the real basketball engine.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/school-shots';
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(page('living-school.html'), { waitUntil: 'networkidle' });
  await p.click('[data-act="new"]'); await p.click('[data-act="enroll"]');
  await p.evaluate(() => { const st = window.__school.st; st.day = 8; st.slot = 2; st.phase = 'slot'; st.player.signedUp = true; st.hoops.touchK = 1.77; st.seen.first_day = 0; window.__school.refresh(); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/tryouts-card.png' });
  await p.click('[data-act="beatpick"][data-i="0"]');
  const G = await require('./gest')(p);
  await p.waitForTimeout(1700);
  await p.screenshot({ path: OUT + '/tryouts-gym.png' });
  for (let i = 0; i < 4; i++) {
    const ideal = await p.evaluate(() => { const R = Court3D.RIM; const S = document.querySelector('#hoops'); return 1; });
    await G.flick(260 * 1.33, 120); await p.waitForTimeout(2600);
    if (await p.isVisible('.hx-card .hx-btn')) { if (i === 0) await p.screenshot({ path: OUT + '/tryouts-card1.png' }); await p.click('.hx-card .hx-btn'); await p.waitForTimeout(1700); }
  }
  for (let i = 0; i < 3; i++) { await p.waitForTimeout(300); await G.flick(260, 120); await p.waitForTimeout(2200); }
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/tryouts-result.png', fullPage: true });
  console.log(await p.evaluate(() => ({ team: window.__school.st.player.team, view: window.__school.view.type, journal: window.__school.st.journal.slice(-1) })));
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
