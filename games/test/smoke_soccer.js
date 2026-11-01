// Soccer through its controls.
// Penalty kicks (LIFE OS mini game), portrait and landscape: a flick up from the ball shoots, and five kicks end the round.
// Soccer Playmaker (11 v 11) at three phone sizes, with real finger strokes on the canvas: hold still to look up (it slows
// down and the forwards run), drag to dribble, flick toward a teammate to pass to him, flick at the goal to shoot, tap to
// fake; then a whole match to the summary. Then the LIFE OS game-day round in an iframe: three clutch attacks, Done, and
// the score reaches the host. Fails on any page error, a screen that scrolls sideways, or a step that doesn't happen.
//   node games/test/smoke_soccer.js OUTDIR
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/soccer-shots';
fs.mkdirSync(OUT, { recursive: true });
const PK_FILE = 'file://' + path.join(__dirname, '..', '..', 'lifeos', 'frontend', 'public', 'minigames', 'soccer.html');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

async function penalties(browser, w, h, tag) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(PK_FILE);
  await p.waitForTimeout(300);
  check(await p.evaluate(() => !/Drawback/.test(document.body.innerText)), `PK ${tag}: no drawback, just the flick`);
  await p.click('#go');
  await p.waitForTimeout(150);
  const ev = args => p.evaluate(({ type, x, y, id }) => document.getElementById('c').dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })), args);
  for (let k = 0; k < 5; k++) {
    await p.waitForFunction(() => phase === 'aim' || phase === 'end', null, { timeout: 6000 });
    if (await p.evaluate(() => phase === 'end')) break;
    const b = await p.evaluate(() => ballScreen());
    const side = [-1, 1, 0, -1, 1][k];
    await ev({ type: 'pointerdown', x: b.x, y: b.y - 5, id: k + 1 });
    for (let i = 1; i <= 6; i++) { await ev({ type: 'pointermove', x: b.x + side * i * 7, y: b.y - 5 - i * 28, id: k + 1 }); await p.waitForTimeout(12); }
    await ev({ type: 'pointerup', x: b.x + side * 42, y: b.y - 5 - 170, id: k + 1 });
    await p.waitForTimeout(100);
    if (k === 0) { check(await p.evaluate(() => phase === 'flight'), `PK ${tag}: a flick up from the ball shoots`); await p.screenshot({ path: `${OUT}/pk-${tag}-flight.png` }); }
  }
  await p.waitForFunction(() => phase === 'end', null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/pk-${tag}-end.png` });
  check(await p.evaluate(() => kicks.length === 5 && !document.getElementById('end').hidden), `PK ${tag}: five kicks end the round`);
  check(errors.length === 0, `PK ${tag}: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

async function playmaker(browser, w, h, tag) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setContent(page('soccer-playmaker.html'), { waitUntil: 'load' });
  const wait = ms => p.waitForTimeout(ms);
  const shot = n => p.screenshot({ path: `${OUT}/pm-${tag}-${n}.png` });
  const SP = (f, a) => p.evaluate(f, a);
  const overflow = () => SP(() => document.documentElement.scrollWidth - window.innerWidth);
  const ready = () => p.waitForFunction(() => SoccerPlaymaker.ready <= 0 && SoccerPlaymaker.P.phase === 'live', null, { timeout: 5000 });
  // where a player or a spot on the pitch is on the screen
  const scr = (x, y) => SP(([x, y]) => SCView.proj(SoccerPlaymaker.V, x, y, 0), [x, y]);
  const carrierScr = () => SP(() => { const c = SoccerPlaymaker.P.ctrl; return SCView.proj(SoccerPlaymaker.V, c.x, c.y, 0); });
  async function flickTo(from, to) {
    // a quick stroke: four moves in about 60ms, let go
    const dx = to[0] - from[0], dy = to[1] - from[1], L = Math.hypot(dx, dy), k = Math.min(1, 150 / L);
    await p.mouse.move(from[0], from[1]); await p.mouse.down();
    for (let i = 1; i <= 4; i++) { await p.mouse.move(from[0] + dx * k * i / 4, from[1] + dy * k * i / 4); await wait(14); }
    await p.mouse.up();
  }

  await wait(400); await shot('01-home');
  check(await overflow() <= 1, `${tag}: home fits the screen`);
  await p.click('[data-mode="match"]');
  await wait(200);
  check(await SP(() => !document.getElementById('sp-howsheet').hidden), `${tag}: first time in, the how-to shows`);
  await shot('02-how');
  await p.click('#sp-how-go');
  check(await SP(() => SoccerPlaymaker.P.players.length === 22 && SoccerPlaymaker.P.ctrl.id === 'CM'), `${tag}: eleven a side, your holding midfielder on the ball`);
  await ready(); await wait(150); await shot('03-start');
  check(await SP(() => /0:2\d/.test(document.getElementById('sp-clock').textContent)), `${tag}: the attack clock is running`);

  // 1. hold still: it slows down and the forwards make their runs
  const mid = [w / 2, h * 0.82];
  await p.mouse.move(mid[0], mid[1]); await p.mouse.down();
  await wait(650);
  const sc = await SP(() => SoccerPlaymaker.scale);
  check(sc < 0.6, `${tag}: holding your finger still slows it down (${sc.toFixed(2)}x)`);
  await p.waitForFunction(() => SoccerPlaymaker.P.home.some(m => m.run), null, { timeout: 3000 }).catch(() => {});
  check(await SP(() => SoccerPlaymaker.P.home.some(m => m.run)), `${tag}: and the forwards run in behind`);
  await shot('04-vision');
  await p.mouse.up();
  check(await SP(() => SoccerPlaymaker.P.stats.fakes === 0 && SoccerPlaymaker.P.ball.st === 'held'), `${tag}: letting go of a hold isn't a pass or a fake`);

  // 2. drag up the screen: he dribbles toward their goal
  await SP(() => { SoccerPlaymaker.seed = 4242; SoccerPlaymaker.newAttack(); }); await ready();
  const x0 = await SP(() => SoccerPlaymaker.P.ctrl.x);
  await p.mouse.move(mid[0], mid[1]); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(mid[0], mid[1] - i * 7); await wait(40); }
  await wait(700); await shot('05-dribble');
  const x1 = await SP(() => SoccerPlaymaker.P.ctrl ? SoccerPlaymaker.P.ctrl.x : 0);
  await p.mouse.up();
  check(x1 > x0 + 2.5, `${tag}: dragging up the screen dribbles him forward (${x0.toFixed(1)} -> ${x1.toFixed(1)} m)`);

  // 3. flick toward a teammate: the pass goes to him
  await SP(() => { SoccerPlaymaker.seed = 4242; SoccerPlaymaker.newAttack(); }); await ready();
  // the open man: the teammate within 25 m nobody can get to a pass to first
  const mate = await SP(() => {
    const P = SoccerPlaymaker.P, c = P.ctrl;
    return P.home.filter(m => m !== c && !m.gk && SC.dist(m, c) < 25).map(m => [m.id, SC.passRisk(P, c, SC.leadFor(P, m, c, false, 0.5), false, 0.5, m)]).sort((a, b) => b[1] - a[1])[0][0];
  });
  const mp = await SP(id => { const m = SoccerPlaymaker.P.by[id]; return [m.x, m.y]; }, mate);
  await flickTo(await carrierScr(), await scr(mp[0], mp[1]));
  await wait(60); await shot('06-pass');
  const pass = await SP(() => ({ st: SoccerPlaymaker.P.ball.st, to: SoccerPlaymaker.P.ball.to }));
  check(pass.st === 'pass' && pass.to === mate, `${tag}: a flick toward ${mate} passes to him (${pass.st} to ${pass.to})`);
  await p.waitForFunction(id => { const P = SoccerPlaymaker.P; return P.phase !== 'live' || (P.ball.st === 'held' && P.ctrl && P.ctrl.id === id); }, mate, { timeout: 4000 }).catch(() => {});
  check(await SP(id => SoccerPlaymaker.P.ctrl && SoccerPlaymaker.P.ctrl.id === id, mate), `${tag}: he takes it, and now you're him`);

  // 4. at the top of the box, flick at the goal: a shot
  await SP(() => { SoccerPlaymaker.seed = 99; SoccerPlaymaker.newAttack(); }); await ready();
  await SP(() => { const P = SoccerPlaymaker.P, c = P.ctrl; c.x = 88; c.y = 1.5; c.h = 0; P.ball.x = 88.5; P.ball.y = 1.5; for (const d of P.away) if (!d.gk && SC.dist(d, c) < 7) d.x -= 9; });
  await wait(250);
  await flickTo(await carrierScr(), await scr(105, -2.4));
  await wait(60); await shot('07-shot');
  check(await SP(() => SoccerPlaymaker.P.ball.st === 'shot' || SoccerPlaymaker.P.stats.shots === 1), `${tag}: a flick at the goal from the box is a shot`);
  await p.waitForFunction(() => !document.getElementById('sp-card').hidden, null, { timeout: 8000 }).catch(() => {});
  await wait(150); await shot('08-card');
  const card = await SP(() => document.getElementById('sp-head').textContent + ' | ' + document.getElementById('sp-reads').textContent);
  check(/GOAL|Saved|Wide|Over|post|Keeper/i.test(card), `${tag}: the card says what the shot did ("${card.slice(0, 70)}")`);
  await p.click('#sp-next');

  // 5. a tap is a fake
  await ready();
  await p.mouse.click(mid[0], mid[1]);
  await wait(80);
  check(await SP(() => SoccerPlaymaker.P.stats.fakes === 1), `${tag}: a tap is a fake`);
  check(await overflow() <= 1, `${tag}: nothing scrolls sideways while you play`);

  // 6. the rest of the match: each attack runs out, the card, the next, to the summary
  for (let i = 0; i < 12; i++) {
    if (await SP(() => !document.getElementById('sp-sum').hidden)) break;
    await SP(() => { const P = SoccerPlaymaker.P; if (P.phase === 'live') P.timeLeft = 0.05; });
    await p.waitForFunction(() => !document.getElementById('sp-card').hidden, null, { timeout: 8000 });
    await p.click('#sp-next');
    await wait(60);
  }
  await p.waitForFunction(() => !document.getElementById('sp-sum').hidden, null, { timeout: 5000 }).catch(() => {});
  await wait(150); await shot('09-summary');
  check(await SP(() => !document.getElementById('sp-sum').hidden && SoccerPlaymaker.G.n === 8), `${tag}: eight attacks end the match`);
  await p.click('#sp-sum-home');
  await p.click('#sp-gear2');
  await wait(100); await shot('10-settings');
  await p.click('[data-set="assist"] [data-v="pro"]');
  check(await SP(() => SoccerPlaymaker.S.assist === 'pro'), `${tag}: Pro passing can be picked in settings`);
  await p.click('[data-set="assist"] [data-v="casual"]');
  await p.click('#sp-set-done');
  check(errors.length === 0, `${tag}: no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

async function lifeos(browser) {
  // a stand-in LIFE OS host: the game in an iframe with ?embed=1, game day ("clutch")
  const dir = path.join(OUT, 'host');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', 'dist', 'soccer-playmaker-standalone.html'), path.join(dir, 'soccer11.html'));
  fs.writeFileSync(path.join(dir, 'host.html'), `<!doctype html><body style="margin:0"><iframe id="f" src="soccer11.html?embed=1" style="border:0;width:100vw;height:100vh"></iframe><script>
    window.got = [];
    addEventListener('message', e => { const d = e.data; if (!d || d.type !== 'lifeos:minigame') return; got.push(d);
      if (d.event === 'ready') document.getElementById('f').contentWindow.postMessage({ type: 'lifeos:init', config: { play: 'clutch', mode: 'clutch', difficulty: 55, skill: 62, me: 'Mike', seed: 4242 } }, '*'); });
  </script></body>`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('file://' + path.join(dir, 'host.html'));
  await p.waitForFunction(() => window.got.some(d => d.event === 'ready'), null, { timeout: 8000 });
  await p.waitForTimeout(400);
  const fr = p.frames().find(f => f.url().includes('soccer11.html'));
  check(await fr.evaluate(() => SoccerPlaymaker.G.mode === 'clutch'), 'LIFE OS game day opens straight into Clutch');
  check(await fr.evaluate(() => /Attack 1 of 3/.test(document.getElementById('sp-status').textContent)), 'three attacks to find a goal');
  if (await fr.evaluate(() => !document.getElementById('sp-howsheet').hidden)) await fr.click('#sp-how-go');
  await p.screenshot({ path: `${OUT}/life-01-clutch.png` });
  for (let i = 0; i < 3; i++) {
    await fr.waitForFunction(() => SoccerPlaymaker.ready <= 0, null, { timeout: 4000 });
    await fr.evaluate(() => { const P = SoccerPlaymaker.P; if (P.phase === 'live') P.timeLeft = 0.05; });
    await fr.waitForFunction(() => !document.getElementById('sp-card').hidden, null, { timeout: 8000 });
    await fr.click('#sp-next');
  }
  await fr.waitForFunction(() => !document.getElementById('sp-sum').hidden, null, { timeout: 5000 });
  await p.screenshot({ path: `${OUT}/life-02-done.png` });
  await fr.click('#sp-sum-go');
  await p.waitForFunction(() => window.got.some(d => d.event === 'finish'), null, { timeout: 4000 }).catch(() => {});
  const fin = await p.evaluate(() => window.got.find(d => d.event === 'finish'));
  check(!!fin && fin.result.max === 2 && fin.result.score === 0 && /0 goals from 3 attacks/.test(fin.result.summary), `Done hands LIFE OS the score: ${fin ? JSON.stringify({ score: fin.result.score, max: fin.result.max, summary: fin.result.summary }) : 'nothing'}`);
  check(errors.length === 0, `LIFE OS round: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await penalties(browser, 390, 844, 'portrait');
  await penalties(browser, 844, 390, 'landscape');
  await playmaker(browser, 390, 844, 'portrait');
  await playmaker(browser, 844, 390, 'landscape');
  await playmaker(browser, 360, 740, 'small');
  await lifeos(browser);
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
