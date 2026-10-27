// Pong Night controls and reads: real gestures through the page, against
// chosen racks and opponents. Prints one line per check.
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
  await p.setContent(page('pong-night.html'), { waitUntil: 'load' });
  await p.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99';
    document.body.appendChild(host);
    window.__e = PongEngine.create(host, { touchK: 1.5, L0: 0.3, S0: 2.2, hints: false });
    // the flick that aims a given kind of throw at a live cup
    window.__aim = (pick, kind) => {
      const S = window.__e._S, P = PongPhysics;
      const cups = S.far.filter(c => c.live);
      const c = typeof pick === 'function' ? pick(cups) : cups[Math.min(pick, cups.length - 1)];
      const from = P.RELEASE.near;
      const yaw = Math.atan2(c.x - from[0], c.z - from[2]) * 180 / Math.PI;
      const ang = yaw / P.AIM_GAIN * Math.PI / 180;
      const p = kind === 'fast' ? P.FAST_IDEAL : P.P0[kind] + (c.z - P.Z_REF) / P.DEPTH_PER;
      const h = window.innerHeight, ms = kind === 'fast' ? 45 : 140;
      const len = p * window.__e.settings.touchK * Math.sqrt(ms / 1000) * h / 2;
      return { len, ms, dx: len * Math.tan(ang), id: c.id };
    };
  });
  const G = await require('./gest_pong')(p);
  const run = spec => p.evaluate(s => window.__e.run(s, { onEnd(r) { window.__end = r; }, onQuit() {} }), spec);
  const aimReady = () => p.waitForFunction(() => window.__e._S.phase === 'aim', null, { timeout: 15000 });
  const resolved = n => p.waitForFunction(n => window.__e._S.resolved >= n, n, { timeout: 15000 });
  const pickers = {
    front: 'cups => cups.slice().sort((a, b) => a.z - b.z)[0]',
    middle: 'cups => cups.slice().sort((a, b) => Math.hypot(a.x, a.z - 7.4) - Math.hypot(b.x, b.z - 7.4))[0]',
    back: 'cups => cups.slice().sort((a, b) => b.z - a.z || Math.abs(a.x) - Math.abs(b.x))[0]'
  };
  const throwAt = async (pick, kind, opts) => {
    const o = opts || {};
    const a = await p.evaluate(([pk, k]) => window.__aim(pk.startsWith('cups') ? eval(pk) : +pk, k), [String(pick), kind]);
    const len = a.len * (o.power || 1);
    if (kind === 'bounce') await G.dip(60, len, a.ms, a.dx);
    else await G.flick(len, a.ms, a.dx + (o.dx || 0), o.curl || 0);
  };
  const last = () => p.evaluate(() => { const S = window.__e._S, t = S.lastYou; return t && { kind: t.kind, exp: t.exposure, made: t.made, g: t.g, cups: t.cupsTaken, swatted: t.swatted, blown: t.blown, armsUp: t.armsUp, spun: t.spun, note: t.note, why: t.why }; });
  const results = [];
  const log = (k, v) => { results.push([k, v]); console.log(k.padEnd(38), JSON.stringify(v)); };

  // 1. gesture shapes -> throw types (practice, so every throw counts)
  await run({ kind: 'practice', seed: 1 });
  await aimReady();
  await throwAt(pickers.middle, 'arc'); await resolved(1); log('full flick -> arc', await last());
  await aimReady();
  await throwAt(pickers.front, 'fast'); await resolved(2); log('short snap -> fastball', await last());
  await aimReady();
  await throwAt(pickers.front, 'bounce'); await resolved(3); log('dip then flick -> bounce', await last());
  await aimReady();
  await p.evaluate(() => window.__gest([{ x: 200, y: 600, t: 0 }, { x: 202, y: 640, t: 60 }, { x: 203, y: 700, t: 120 }, { x: 203, y: 700, t: 121 }]));
  log('pull down, no flick -> hint', await p.evaluate(() => document.querySelector('.px-hint').textContent));

  // 2. the rack read, 5 tries each, perfect input
  // an Island drill sets up a fresh rack for every ball
  const tries = async (label, spec, pick, kind, n = 5, opts) => {
    let made = 0, grades = {}, lastR = null;
    await run(Object.assign({ kind: 'shots', balls: n, title: label, seed: 100 }, spec));
    for (let i = 0; i < n; i++) {
      await aimReady();
      await throwAt(pick, kind, opts); await resolved(i + 1);
      lastR = await last();
      if (lastR.made) made++;
      grades[lastR.g] = (grades[lastR.g] || 0) + 1;
    }
    log(label, { made: `${made}/${n}`, grades, exp: lastR.exp, why: lastR.why });
    return lastR;
  };
  await tries('fastball, naked front cup', { form: 'diamond4' }, pickers.front, 'fast');
  await p.screenshot({ path: OUT + '/c-fast.png' });
  await tries('arc, naked front cup', { form: 'diamond4' }, pickers.front, 'arc');
  await tries('arc, buried middle cup', { form: 'tri10' }, pickers.middle, 'arc');
  await tries('fastball, buried back cup', { form: 'tri10' }, pickers.back, 'fast');
  await tries('bounce, island vs Statue', { form: 'island1', opponent: 'statue', bounceTwo: true }, 0, 'bounce');
  await tries('bounce, island vs Swatter', { form: 'island1', opponent: 'swatter' }, 0, 'bounce');
  await p.screenshot({ path: OUT + '/c-swat.png' });
  await tries('arc, island vs Swatter', { form: 'island1', opponent: 'swatter' }, 0, 'arc');
  await tries('spun arc vs Blower', { form: 'pyr6', opponent: 'blower' }, pickers.middle, 'arc', 5, { curl: 0.15 });
  await tries('straight arc vs Blower', { form: 'pyr6', opponent: 'blower' }, pickers.middle, 'arc');

  // 3. the Waver: arms up shrinks the window and is a D; arms down is clean
  const waver = async up => {
    await run({ kind: 'shots', form: 'island1', balls: 1, opponent: 'waver', title: 'Waver', seed: 7 });
    await aimReady();
    await p.waitForFunction(up => { const t = window.__e._S.t; return (Math.sin(t * Math.PI * 2 / 1.9 + 0.4) > 0.12) === up; }, up, { timeout: 5000 });
    if (up) await p.screenshot({ path: OUT + '/c-waver-up.png' });
    await throwAt(0, 'arc'); await resolved(1);
    return last();
  };
  log('Waver, threw with arms up', await waver(true));
  log('Waver, threw with arms down', await waver(false));

  // 4. game flow: re-rack call, balls back, heating up, on fire
  await run({ kind: 'game', opponent: 'statue', rack: 'pyr6', seed: 21 });
  await p.waitForSelector('.px-pick:not([hidden])', { timeout: 15000 });
  await p.screenshot({ path: OUT + '/c-rerack.png' });
  log('re-rack offered at 6', await p.evaluate(() => [...document.querySelectorAll('.px-opt b')].map(b => b.textContent)));
  await p.click('.px-opt[data-form="zip6"]');
  await aimReady();
  log('zipper laid out', await p.evaluate(() => window.__e._S.far.map(c => [+c.x.toFixed(2), +c.z.toFixed(2)])));
  // throw fastballs at the naked front cup until the turn ends; watch balls back and the streak
  await p.evaluate(() => window.__e.setSettings({ feel: 'arcade' }));
  const seen = [];
  for (let n = 1; n <= 8; n++) {
    await throwAt(pickers.front, 'fast'); await resolved(n);
    await p.waitForFunction(() => ['aim', 'card', 'cpu'].includes(window.__e._S.phase), null, { timeout: 15000 });
    const st = await p.evaluate(() => { const S = window.__e._S; return { phase: S.phase, thrown: S.turn.thrown, made: S.turn.made, left: S.turn.left, streak: S.streak, fire: S.fire, chip: document.querySelector('.px-state').hidden ? null : document.querySelector('.px-state').textContent }; });
    seen.push(st);
    if (st.fire && !seen.fired) { seen.fired = true; await p.screenshot({ path: OUT + '/c-fire.png' }); }
    if (st.phase !== 'aim') break;
  }
  const back = seen.find(x => x.thrown === 2 && x.made === 2);
  log('two makes -> balls back', back ? { left: back.left, chip: back.chip } : 'missed one of the first two');
  const fire = seen.find(x => x.fire);
  log('three in a row -> on fire', fire ? { streak: fire.streak, chip: fire.chip } : `best streak ${Math.max(...seen.map(x => x.streak))}`);
  log('turn ended', seen[seen.length - 1]);
  await p.evaluate(() => window.__e.setSettings({ feel: 'normal' }));

  // 5. endings: lose your last cup, make your rebuttal, overtime; then miss one and lose
  await p.evaluate(() => { Pong.OPPONENTS.sniper.skill = 0.99; });
  await run({ kind: 'game', opponent: 'sniper', rack: 'tri3', seed: 4 });
  await p.waitForSelector('.px-pick:not([hidden])', { timeout: 15000 });
  await p.click('.px-opt[data-form="keep"]');
  await aimReady();
  // throw it away every turn until he's taken all three of yours
  for (let k = 0; k < 120; k++) {
    const st = await p.evaluate(() => { const S = window.__e._S; return { phase: S.phase, by: S.turn && S.turn.by, reb: S.turn && S.turn.rebuttal, card: !document.querySelector('.px-card').hidden, pick: !document.querySelector('.px-pick').hidden }; });
    if (st.by === 'you' && st.reb && st.phase === 'aim') break;
    if (st.pick) await p.click('.px-opt[data-form="keep"]');
    else if (st.card) await p.click('.px-card button');
    else if (st.phase === 'aim') await p.evaluate(() => window.__gest([{ x: 200, y: 700, t: 0 }, { x: 330, y: 560, t: 70 }, { x: 330, y: 560, t: 71 }]));
    await p.waitForTimeout(400);
  }
  await aimReady();
  await p.screenshot({ path: OUT + '/c-rebuttal.png' });
  log('he cleared you -> rebuttal', await p.evaluate(() => ({ yours: window.__e._S.near.filter(c => c.live).length, theirs: window.__e._S.far.filter(c => c.live).length, banner: document.querySelector('.px-banner').innerText.replace(/\n/g, ' ') })));
  const r0 = await p.evaluate(() => window.__e._S.resolved);
  for (let n = r0 + 1; ; n++) {
    await aimReady();
    await throwAt(pickers.front, 'fast'); await resolved(n);
    const st = await p.evaluate(() => ({ ot: window.__e._S.overtime, theirs: window.__e._S.far.filter(c => c.live).length, phase: window.__e._S.phase }));
    if (st.theirs === 0 || st.ot || n > 12) break;
  }
  await p.waitForFunction(() => window.__e._S.overtime > 0 || window.__e._S.won != null, null, { timeout: 20000 });
  log('made the rebuttal', await p.evaluate(() => ({ overtime: window.__e._S.overtime, won: window.__e._S.won })));
  await p.evaluate(() => { Pong.OPPONENTS.sniper.skill = 0.86; });

  // 6. calibration reads the flick
  await run({ kind: 'calibrate' });
  for (let i = 0; i < 3; i++) { await aimReady(); await G.flick(230 + i * 10, 150, 0); await resolved(i + 1); }
  await p.waitForFunction(() => window.__end && window.__end.kind === 'calibrate', null, { timeout: 8000 });
  log('calibration', await p.evaluate(() => { const r = window.__end; return { touchK: +r.touchK.toFixed(2), L0: +r.L0.toFixed(3), S0: +r.S0.toFixed(2) }; }));

  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
