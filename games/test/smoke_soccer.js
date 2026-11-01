// Penalty kicks (LIFE OS mini game) through its controls, portrait and landscape: the Drawback / Flick switch, a drawback
// shot (pull down from the ball, the ring and power meter show, let go), a flick, and a full five-kick round to the end.
//   node games/test/smoke_soccer.js OUTDIR
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2] || '/tmp/soccer-shots';
require('fs').mkdirSync(OUT, { recursive: true });
const FILE = 'file://' + path.join(__dirname, '..', '..', 'lifeos', 'frontend', 'public', 'minigames', 'soccer.html');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

async function run(browser, w, h, tag) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(FILE);
  await p.waitForTimeout(300);
  await p.click('#go');
  await p.waitForTimeout(200);
  check(await p.evaluate(() => !document.getElementById('sw').hidden), `${tag}: the Drawback / Flick switch shows before the kick`);
  await p.click('#sw [data-m="draw"]');
  const ev = (args) => p.evaluate(({ type, x, y, id }) => document.getElementById('c').dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })), args);
  const b = await p.evaluate(() => PK.ballScreen());
  check(Math.abs(b.y / h - 0.6) < 0.05, `${tag}: drawback raises the ball 40% up the screen (${(1 - b.y / h).toFixed(2)})`);
  // drawback: pull down and a bit left from the ball, aim right
  await ev({ type: 'pointerdown', x: b.x, y: b.y + 10, id: 1 });
  await ev({ type: 'pointermove', x: b.x - 20, y: b.y + 80, id: 1 });
  await ev({ type: 'pointermove', x: b.x - 40, y: b.y + 150, id: 1 });
  await p.waitForTimeout(120);
  await p.screenshot({ path: `${OUT}/${tag}-1-draw-aim.png` });
  const aim = await p.evaluate(() => PK.aimFromPull());
  check(aim && aim.x > 0.5 && aim.p > 0.3, `${tag}: pulling down-left aims right (${aim ? aim.x.toFixed(1) : '-'} m, power ${aim ? aim.p.toFixed(2) : '-'})`);
  await ev({ type: 'pointerup', x: b.x - 40, y: b.y + 150, id: 1 });
  await p.waitForTimeout(150);
  check(await p.evaluate(() => PK.phase === 'flight' && PK.shot.xEnd > 0), `${tag}: letting go shoots it where the ring was`);
  await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${tag}-2-draw-flight.png` });
  await p.waitForFunction(() => PK.phase === 'aim' || PK.phase === 'end', null, { timeout: 6000 });
  // flick: switch, swipe up from the ball
  await p.click('#sw [data-m="flick"]');
  const b2 = await p.evaluate(() => PK.ballScreen());
  check(b2.y / h > 0.78, `${tag}: flick keeps the ball low`);
  await ev({ type: 'pointerdown', x: b2.x, y: b2.y - 5, id: 2 });
  for (let i = 1; i <= 6; i++) { await ev({ type: 'pointermove', x: b2.x + i * 6, y: b2.y - 5 - i * 28, id: 2 }); await p.waitForTimeout(12); }
  await ev({ type: 'pointerup', x: b2.x + 36, y: b2.y - 5 - 170, id: 2 });
  await p.waitForTimeout(120);
  check(await p.evaluate(() => PK.phase === 'flight'), `${tag}: a flick up from the ball shoots`);
  await p.screenshot({ path: `${OUT}/${tag}-3-flick-flight.png` });
  // the rest of the round with the drawback
  await p.waitForFunction(() => PK.phase === 'aim' || PK.phase === 'end', null, { timeout: 6000 });
  await p.click('#sw [data-m="draw"]').catch(() => {});
  for (let k = 0; k < 4; k++) {
    if (await p.evaluate(() => PK.phase === 'end')) break;
    const bb = await p.evaluate(() => PK.ballScreen());
    await ev({ type: 'pointerdown', x: bb.x, y: bb.y + 10, id: 3 + k });
    await ev({ type: 'pointermove', x: bb.x + (k % 2 ? 35 : -35), y: bb.y + 140, id: 3 + k });
    await p.waitForTimeout(80);
    await ev({ type: 'pointerup', x: bb.x + (k % 2 ? 35 : -35), y: bb.y + 140, id: 3 + k });
    await p.waitForFunction(() => PK.phase === 'aim' || PK.phase === 'end', null, { timeout: 6000 });
  }
  await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${tag}-4-end.png` });
  check(await p.evaluate(() => PK.kicks.length === 5 && !document.getElementById('end').hidden), `${tag}: five kicks end the round`);
  check(errors.length === 0, `${tag}: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  await run(browser, 390, 844, 'portrait');
  await run(browser, 844, 390, 'landscape');
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
