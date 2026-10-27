// Plays every Pong Night mode through the real app (calibration, a full game,
// Rack Attack, an Island drill, practice, the book, settings), with a bot that
// makes the right read each throw. Screenshots every screen; checks for errors
// and sideways overflow.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/pong-shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await p.setContent(page('pong-night.html'), { waitUntil: 'load' });
  await p.evaluate(() => {
    const orig = PongEngine.create;
    PongEngine.create = (...a) => (window.__e = orig(...a));
  });
  const G = await require('./gest_pong')(p);
  const shot = async name => { await p.screenshot({ path: `${OUT}/${name}.png` }); };
  const overflow = async name => {
    const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 0) errors.push(`${name}: ${o}px sideways overflow`);
  };
  const S = () => p.evaluate(() => { const S = window.__e._S; return { phase: S.phase, far: S.far.filter(c => c.live).length, near: S.near.filter(c => c.live).length }; });
  // the bot reads the rack: naked front cup -> fastball, island -> bounce (unless he swats), else arc the middle
  const botThrow = async () => {
    const a = await p.evaluate(() => {
      const S = window.__e._S, P = PongPhysics;
      const cups = S.far.filter(c => c.live);
      const ex = cups.map(c => ({ c, e: Pong.exposure(c, S.far, 'far') }));
      const swat = S.opp && S.opp.swat;
      let pick = ex.find(x => x.e === 'island' && !swat), kind = 'bounce';
      if (!pick) { pick = ex.find(x => x.e === 'front'); kind = 'fast'; }
      if (!pick || (ex.length > 3 && Math.random() < 0.5)) { pick = ex.slice().sort((a, b) => Math.hypot(a.c.x, a.c.z - 7.5) - Math.hypot(b.c.x, b.c.z - 7.5))[0]; kind = pick.e === 'buried' ? 'arc' : (pick.e === 'island' && !swat ? 'bounce' : 'fast'); }
      const c = pick.c, from = P.RELEASE.near;
      const yaw = Math.atan2(c.x - from[0], c.z - from[2]) * 180 / Math.PI;
      const ang = yaw / P.AIM_GAIN * Math.PI / 180;
      const pp = kind === 'fast' ? P.FAST_IDEAL : P.P0[kind] + (c.z - P.Z_REF) / P.DEPTH_PER;
      const ms = kind === 'fast' ? 45 : 140;
      const len = pp * window.__e.settings.touchK * Math.sqrt(ms / 1000) * window.innerHeight / 2;
      return { len, ms, dx: len * Math.tan(ang), kind };
    });
    if (a.kind === 'bounce') await G.dip(60, a.len, a.ms, a.dx); else await G.flick(a.len, a.ms, a.dx);
    return a.kind;
  };
  // drive whatever the game is waiting on until it hands back the results screen
  const drive = async (label, maxSteps, opts) => {
    const o = opts || {};
    let throws = 0, shots = 0;
    for (let i = 0; i < maxSteps; i++) {
      const st = await p.evaluate(() => ({
        phase: window.__e && window.__e._S.phase, running: window.__e && window.__e._S.running,
        pick: !document.querySelector('.px-pick').hidden, card: !document.querySelector('.px-card').hidden,
        results: !document.querySelector('#results').hidden
      }));
      if (st.results || !st.running) return throws;
      if (st.pick) { if (shots < 4) { await shot(`${label}-rerack`); shots++; } await p.click('.px-opt >> nth=0'); await p.waitForTimeout(200); continue; }
      if (st.card) {
        if (o.cardShot && !o.cardShotDone) { await shot(`${label}-card`); o.cardShotDone = true; }
        await p.click('.px-card button'); await p.waitForTimeout(250); continue;
      }
      if (st.phase === 'aim') {
        if (o.cpuShot && !o.cpuShotDone && throws > 2) { /* taken below during their turn */ }
        await botThrow(); throws++;
        if (throws === 1) { await p.waitForTimeout(260); await shot(`${label}-flight`); }
        await p.waitForTimeout(400);
        continue;
      }
      if (st.phase === 'cpu' && o.cpuShot && !o.cpuShotDone) {
        const inAir = await p.evaluate(() => window.__e._S.balls.some(b => b.by === 'cpu' && b.t > 0.3));
        if (inAir) { await shot(`${label}-their-turn`); o.cpuShotDone = true; }
      }
      await p.waitForTimeout(250);
    }
    errors.push(`${label}: did not finish in ${maxSteps} steps`);
    return throws;
  };
  const log = (k, v) => console.log(k.padEnd(22), typeof v === 'string' ? v : JSON.stringify(v));

  // home
  await p.waitForTimeout(300);
  await shot('s-home'); await overflow('home');
  await p.click('#moves summary'); await shot('s-home-throws'); await overflow('home throws');

  // a game: opponent list -> calibration -> full game vs the Statue
  await p.click('[data-go="opps"]');
  await shot('s-opps'); await overflow('opponents');
  await p.click('[data-opp="statue"]');
  await p.waitForFunction(() => window.__e && window.__e._S.spec.kind === 'calibrate' && window.__e._S.phase === 'aim', null, { timeout: 10000 });
  await shot('s-calibrate');
  for (let i = 0; i < 3; i++) {
    await p.waitForFunction(() => window.__e._S.phase === 'aim', null, { timeout: 10000 });
    await G.flick(240, 150, 0);
    await p.waitForFunction(n => window.__e._S.resolved >= n, i + 1, { timeout: 10000 });
  }
  await p.waitForFunction(() => window.__e._S.spec.kind === 'game', null, { timeout: 10000 });
  log('touch set', await p.evaluate(() => { const st = window.__e.settings; return { touchK: +st.touchK.toFixed(2), L0: +st.L0.toFixed(3), S0: +st.S0.toFixed(2) }; }));
  await p.waitForTimeout(900);
  await shot('s-game-intro');
  const gThrows = await drive('s-game', 900, { cardShot: true, cpuShot: true });
  await p.waitForTimeout(300);
  await shot('s-game-results'); await overflow('game results');
  log('game', { throws: gThrows, head: await p.evaluate(() => document.querySelector('#results .result-head').innerText.replace(/\n/g, ' ')), stats: await p.evaluate(() => [...document.querySelectorAll('#results .stat')].map(s => s.innerText.replace(/\n/g, ' '))) });

  // Rack Attack
  await p.click('#results [data-go="opps"]').catch(() => {});
  await p.click('#opps [data-go="home"]');
  await p.click('[data-go="attack"]');
  await p.waitForFunction(() => window.__e._S.spec.kind === 'attack', null, { timeout: 8000 });
  const aThrows = await drive('s-attack', 500);
  await p.waitForTimeout(300);
  await shot('s-attack-results'); await overflow('attack results');
  log('rack attack', await p.evaluate(() => document.querySelector('#results .result-head').innerText.replace(/\n/g, ' ')));

  // Island: list, then Island Hopping
  await p.click('#results [data-go="home"]');
  await p.click('[data-go="island"]');
  await shot('s-island'); await overflow('island');
  await p.click('[data-drill="hop"]');
  await p.waitForFunction(() => window.__e._S.spec.kind === 'shots' && window.__e._S.phase === 'aim', null, { timeout: 8000 });
  await shot('s-drill-aim');
  await drive('s-drill', 300);
  await p.waitForTimeout(300);
  await shot('s-drill-results'); await overflow('drill results');
  log('island hopping', await p.evaluate(() => document.querySelector('#results .result-head').innerText.replace(/\n/g, ' ')));

  // Practice: a few throws, change the rack, leave
  await p.click('#results [data-go="island"]');
  await p.click('#island [data-go="home"]');
  await p.click('[data-go="practice"]');
  await p.waitForFunction(() => window.__e._S.spec.kind === 'practice' && window.__e._S.phase === 'aim', null, { timeout: 8000 });
  for (let i = 0; i < 3; i++) { await p.waitForFunction(() => window.__e._S.phase === 'aim', null, { timeout: 8000 }); await botThrow(); await p.waitForTimeout(500); }
  await p.waitForFunction(() => window.__e._S.phase === 'aim', null, { timeout: 8000 });
  await p.click('.px-tool'); await p.click('.px-tool'); await p.click('.px-tool');
  await p.waitForTimeout(300);
  await shot('s-practice');
  log('practice rack', await p.evaluate(() => document.querySelector('.px-tool').innerText));
  await p.click('.px-quit');
  await p.waitForTimeout(300);
  log('practice record', await p.evaluate(() => document.querySelector('#rec-practice').innerText));

  // the book and settings
  await p.click('[data-go="book"]');
  await shot('s-book'); await overflow('book');
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('s-book-racks');
  await p.click('#book [data-go="home"]');
  await p.click('[data-go="settings"]');
  await shot('s-settings'); await overflow('settings');
  await p.click('[data-go="home"] >> nth=0').catch(() => {});
  await p.evaluate(() => document.querySelector('#settings .back').click());
  await shot('s-home-after');
  log('home records', await p.evaluate(() => [...document.querySelectorAll('.mode .rec')].map(r => r.innerText)));

  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
