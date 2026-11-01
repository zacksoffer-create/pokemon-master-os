// Drives At Bat with real gestures: timing calibration, on-time vs early vs
// late, takes, dragging the barrel, the short swing, swing plane, a walk, a
// hit-and-run, and a swing before the pitch.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/at-bat-shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setContent(page('at-bat.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99';
    document.body.appendChild(host);
    window.__e = BatEngine.create(host, { timing: 0, hints: false });
  });
  const G = await require('./batgest')(p);
  const wait = ms => p.waitForTimeout(ms);
  const results = [];
  const check = (name, ok, info) => results.push([ok ? 'PASS' : 'FAIL', name, info]);
  const runSpec = spec => p.evaluate(spec => { window.__done = null; window.__e.run(spec, { onEnd: r => { window.__done = r; }, onQuit: r => { window.__done = r; } }); }, spec);
  const settle = () => p.waitForFunction(() => { const S = window.__e._S; return S.phase === 'after' || S.phase === 'card' || window.__done; }, null, { timeout: 15000 });

  // 1. Calibration: five swings, each 40 ms late on the raw clock -> timing -0.04
  await runSpec({ kind: 'cage', calibrate: true, swings: 5, seed: 1 });
  for (let i = 0; i < 5; i++) {
    await G.swing({ e: 0.04, aim: true });
    await p.waitForFunction(n => window.__e._S.calib.length >= n || window.__done, i + 1, { timeout: 15000 });
    if (i === 2) await p.screenshot({ path: OUT + '/c1-calibrate.png' });
  }
  await p.waitForFunction(() => window.__done, null, { timeout: 15000 });
  const cal = await p.evaluate(() => window.__done);
  check('calibration finds a 40 ms late swinger', Math.abs(cal.timing + 0.04) < 0.004, `timing ${cal.timing}`);
  await p.evaluate(t => window.__e.setSettings({ timing: t }), cal.timing);

  // 2. Timing against a middle fastball
  const fb = n => Array.from({ length: n }, () => ({ type: 'FF', aim: [0, 2.5] }));
  const timingCase = async (label, o) => {
    await runSpec({ kind: 'cage', pitch: 'FF', loc: 'middle', seed: 2, script: fb(1) });
    const sw = await G.swing(o);
    await settle();
    const st = await G.state();
    return st;
  };
  const onTime = await timingCase('on time', { e: 0, aim: true, plane: 28 });
  check('on time and on the barrel: hard contact', onTime.contact && !onTime.contact.whiff && onTime.contact.ev >= 95, JSON.stringify(onTime.contact));
  await p.screenshot({ path: OUT + '/c2-ontime.png' });
  const early = await timingCase('early', { e: -0.09, aim: true, plane: 15 });
  check('90 ms early: pulled hard to the left side or foul', early.contact && !early.contact.whiff && (early.contact.spray < -30 || early.contact.foul), JSON.stringify(early.contact));
  const late = await timingCase('late', { e: 0.09, aim: true, plane: 15 });
  check('90 ms late: pushed the other way', late.contact && !late.contact.whiff && late.contact.spray > 15, JSON.stringify(late.contact));
  const way = await timingCase('way late', { e: 0.2, aim: true });
  check('200 ms late: swing and miss', way.contact && way.contact.whiff, JSON.stringify(way.contact));

  // 3. Swing plane: up-slope lifts it, down chops it
  const up = await timingCase('uppercut', { e: 0, aim: true, plane: 42 });
  const down = await timingCase('chop', { e: 0, aim: true, plane: -30 });
  check('swiping up launches it higher than swiping down', up.contact.la > down.contact.la + 20, `up ${up.contact.la}° vs down ${down.contact.la}°`);

  // 4. The short swing
  const short = await timingCase('short', { e: 0, aim: true, kind: 'contact', plane: 10 });
  check('a short quick swipe is a contact swing', short.contact && short.contact.kind === 'contact', JSON.stringify(short.contact));

  // 5. Dragging the barrel (hold, drag, no swing)
  await runSpec({ kind: 'cage', pitch: 'FF', loc: 'middle', seed: 3, script: fb(2) });
  await G.waitPhase('set');
  const before = await p.evaluate(() => window.__e._S.pci.slice());
  await p.evaluate(() => { const t = window.__realNow(); window.__swing({ downAt: t, drag: [80, -60], hold: 700 }); });
  const after = await p.evaluate(() => window.__e._S.pci.slice());
  check('dragging moves the barrel right and up', after[0] > before[0] + 0.4 && after[1] > before[1] + 0.3, `${before.map(v => v.toFixed(2))} -> ${after.map(v => v.toFixed(2))}`);
  await p.screenshot({ path: OUT + '/c3-drag.png' });

  // 6. A swing before he lets go is ignored
  await runSpec({ kind: 'cage', pitch: 'FF', loc: 'middle', seed: 4, script: fb(1) });
  await G.waitPhase('windup');
  const early2 = await p.evaluate(() => { const S = window.__e._S; const t = (S.releaseAt - 0.3) * 1000; window.__swing({ downAt: t - 300, fastAt: t, dx: -230, dy: -60, dur: 70 }); return !!S.swing; });
  check('swinging before the release does nothing', early2 === false, `swing registered: ${early2}`);

  // 7. Takes: a ball off the plate and a strike down the middle
  await runSpec({ kind: 'abs', count: 1, seed: 5, plan: [{ pitcher: 'flame', situation: 'empty' }], script: [{ type: 'FF', aim: [1.4, 2.4] }, { type: 'FF', aim: [0, 2.5] }, { type: 'FF', aim: [0, 1.0] }, { type: 'FF', aim: [-1.5, 2.6] }, { type: 'FF', aim: [0, 4.3] }] });
  await G.waitPhase('after', 15000);
  let st = await G.state();
  check('taking a pitch off the plate is a ball', st.count.b === 1 && st.count.s === 0, JSON.stringify(st.count));
  await G.waitPhase('set'); await G.waitPhase('after', 15000);
  st = await G.state();
  check('taking one down the middle is a strike', st.count.s === 1, JSON.stringify(st.count));
  await p.screenshot({ path: OUT + '/c4-takes.png' });
  // three more balls: a walk
  await p.waitForFunction(() => !document.querySelector('.ab-card').hidden, null, { timeout: 20000 });
  st = await G.state();
  check('four balls is a walk, and the card says so', /walk/i.test(st.card || ''), st.card);
  await wait(400); await p.screenshot({ path: OUT + '/c5-walk-card.png' });

  // 8. Hit-and-run vs the Closer's quick slide step: take a pitch and the runner is out
  await runSpec({ kind: 'abs', count: 1, seed: 6, plan: [{ pitcher: 'closer', situation: 'hitrun' }], script: [{ type: 'FF', aim: [1.4, 2.4] }, { type: 'FF', aim: [0, 2.5] }] });
  await G.waitPhase('after', 15000);
  st = await G.state();
  check('hit-and-run vs a quick delivery: take it and the runner is thrown out', st.outs === 2 && st.runners[0] === 0, JSON.stringify({ outs: st.outs, runners: st.runners }));
  // ...vs the Flamethrower's big leg kick, he makes it
  await runSpec({ kind: 'abs', count: 1, seed: 6, plan: [{ pitcher: 'flame', situation: 'hitrun' }], script: [{ type: 'FF', aim: [1.4, 2.4] }, { type: 'FF', aim: [0, 2.5] }] });
  await G.waitPhase('after', 15000);
  st = await G.state();
  check('hit-and-run vs a big leg kick: he steals second', st.outs === 1 && st.runners[1] === 1, JSON.stringify({ outs: st.outs, runners: st.runners }));

  // 9. Two strikes: the read changes
  await runSpec({ kind: 'abs', count: 1, seed: 7, startCount: [0, 2], plan: [{ pitcher: 'slider', situation: 'empty' }], script: [{ type: 'SW', aim: [1.3, 2.3] }] });
  await G.waitPhase('flight', 15000); await wait(260);
  await p.screenshot({ path: OUT + '/c6-twostrike-sweeper.png' });
  await p.waitForFunction(() => window.__e._S.phase === 'after' || window.__e._S.phase === 'card', null, { timeout: 15000 });
  st = await G.state();
  check('laying off the two-strike sweeper off the plate is ball one', st.count.b === 1 && st.count.s === 2, JSON.stringify(st.count));

  // 10. The ball in play becomes a real play, then a card
  await runSpec({ kind: 'abs', count: 1, seed: 8, plan: [{ pitcher: 'junk', situation: 'sacfly' }], script: [{ type: 'CH', aim: [0.4, 2.2] }] });
  await G.swing({ e: 0, aim: true, plane: 40, miss: [0, 0.08] });
  await p.waitForFunction(() => window.__e._S.cam === 'field', null, { timeout: 8000 }).catch(() => {});
  await wait(900);
  await p.screenshot({ path: OUT + '/c7-play.png' });
  await p.waitForFunction(() => !document.querySelector('.ab-card').hidden, null, { timeout: 20000 });
  st = await G.state();
  check('contact turns into a play and a graded card', !!st.card && !!st.grade, `${st.grade}: ${st.card}`);
  await wait(400); await p.screenshot({ path: OUT + '/c8-card.png' });

  // 11. Batting left-handed: everything mirrors, and early pulls it to right field
  await p.evaluate(() => window.__e.setSettings({ bats: 'L' }));
  await runSpec({ kind: 'cage', pitch: 'FF', loc: 'middle', seed: 9, script: fb(1) });
  await G.waitPhase('windup'); await wait(500);
  await p.screenshot({ path: OUT + '/c9-lefty.png' });
  await G.swing({ e: -0.05, aim: true, plane: 20 });
  await settle();
  st = await G.state();
  check('a lefty who is out front pulls it to right field', st.contact && !st.contact.whiff && st.contact.spray > 10, JSON.stringify(st.contact));
  await p.evaluate(() => window.__e.setSettings({ bats: 'R' }));

  results.forEach(([r, k, v]) => console.log(r, k.padEnd(64), v || ''));
  console.log('errors', errors.length ? errors : 'none');
  if (errors.length || results.some(r => r[0] === 'FAIL')) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
