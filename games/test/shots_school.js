// Screenshots of Living School's main screens at phone size, light and dark.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/school-shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true, colorScheme: scheme });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.setContent(page('living-school.html'), { waitUntil: 'networkidle' });
    const shot = async name => { await p.waitForTimeout(150); await p.screenshot({ path: `${OUT}/${scheme}-${name}.png`, fullPage: true }); };
    const click = async sel => { await p.click(sel); await p.waitForTimeout(120); };
    await shot('01-title');
    await click('[data-act="new"]');
    await p.fill('#c-name', 'Zack');
    await click('[data-pick="style"][data-v="curly"]');
    await click('[data-pick="likes"][data-v="games"]');
    await shot('02-create');
    await click('[data-act="enroll"]');
    await shot('03-firstday');
    await click('[data-act="beatpick"][data-i="0"]');
    await shot('04-result');
    await click('[data-act="done"]');
    await shot('05-class');
    if (scheme === 'light') {
      await click('[data-act="classplay"]');
      await p.waitForTimeout(1200);
      await shot('06-algebra');
      await p.click('.mg-opts button'); await p.waitForTimeout(300);
      await p.waitForTimeout(13500);
      await shot('07-classresult');
    } else await click('[data-act="classskip"]');
    await click('[data-act="done"]');
    await shot('08-lunch');
    await click('[data-p="lunch_theater"]');
    await shot('09-scene');
    const talk = await p.$('[data-act="talk"]');
    if (talk) {
      await talk.click(); await p.waitForTimeout(150);
      await shot('10-convo');
      await click('[data-act="card"][data-i="0"]');
      await shot('11-convo-react');
      while (await p.$('[data-act="card"]')) await click('[data-act="card"][data-i="0"]');
      await click('[data-act="endconvo"]');
      await shot('12-convo-end');
    } else {
      const ev = await p.$('[data-act="evpick"]'); if (ev) { await ev.click(); }
    }
    await click('[data-act="done"]');
    await shot('13-after');
    await click('#phone-btn'); await click('[data-t="people"]');
    await p.screenshot({ path: `${OUT}/${scheme}-14-phone-people.png` });
    await click('[data-t="me"]');
    await p.screenshot({ path: `${OUT}/${scheme}-15-phone-me.png` });
    await click('[data-act="phone-close"]');
    console.log(scheme, 'errors', errors.length ? errors : 'none');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
