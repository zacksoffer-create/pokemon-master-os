// Option Arcade through its own controls, at three phone sizes: the home screen, the how-to, a give, a pull and a
// pitch with the real buttons, a juke swiped on the canvas, a whole ten-play Lab set, the film room and settings.
// Then the LIFE OS game-day round in an iframe: four downs from the 10, Done, and the score reaches the host.
// Fails on any page error, a screen that scrolls sideways, or a step that doesn't happen.
//   node games/test/smoke_option.js OUTDIR
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/option-shots';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

async function phone(browser, w, h, tag) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setContent(page('option-arcade.html'), { waitUntil: 'load' });
  const wait = ms => p.waitForTimeout(ms);
  const shot = n => p.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  const OA = (f, a) => p.evaluate(f, a);
  const overflow = async () => OA(() => document.documentElement.scrollWidth - window.innerWidth);
  const box = async sel => { const b = await p.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const cardUp = () => p.waitForFunction(() => !document.getElementById('oa-card').hidden || !document.getElementById('oa-sum').hidden, null, { timeout: 30000 });

  await wait(400); await shot('01-home');
  check(await overflow() <= 1, `${tag}: home fits the screen`);
  await p.click('[data-mode="lab"]');
  await wait(250); await shot('02-how');
  check(await OA(() => !document.getElementById('oa-howsheet').hidden), `${tag}: first time in, the how-to shows`);
  await p.click('#oa-how-go');

  // 1. the end sits: hold GIVE all the way through, the fullback gets it
  await OA(() => { OptionArcade.G.look = 'sit'; OptionArcade.newPlay(); });
  await wait(300); await shot('03-presnap');
  let [gx, gy] = await box('#oa-give');
  await p.mouse.move(gx, gy); await p.mouse.down();
  await p.waitForFunction(() => OptionArcade.P.phase === 'mesh' && OptionArcade.P.rideU > 0.2, null, { timeout: 5000 });
  await shot('04-mesh');
  await p.waitForFunction(() => OptionArcade.P.phase === 'run', null, { timeout: 5000 });
  await p.mouse.up();
  check(await OA(() => OptionArcade.P.carrier && OptionArcade.P.carrier.id === 'FB'), `${tag}: holding GIVE through the exchange hands it to the fullback`);
  await p.keyboard.down('ArrowRight'); await wait(500); await shot('05-dive'); await p.keyboard.up('ArrowRight');
  await cardUp(); await wait(200); await shot('06-card');
  const t1 = await OA(() => document.getElementById('oa-reads').textContent);
  check(/giving it was right/.test(t1), `${tag}: the card explains the read ("${t1.slice(0, 60)}...")`);
  await p.click('#oa-next');

  // 2. the end crashes, the backer takes the QB: let go mid-exchange to pull, then tap PITCH
  await OA(() => { OptionArcade.G.look = 'crash+qb'; OptionArcade.seed = 8919; OptionArcade.newPlay(); });
  [gx, gy] = await box('#oa-give');
  await p.mouse.move(gx, gy); await p.mouse.down();
  await p.waitForFunction(() => OptionArcade.P.phase === 'mesh' && OptionArcade.P.rideU > 0.4, null, { timeout: 5000 });
  await p.mouse.up();
  await p.waitForFunction(() => OptionArcade.P.phase === 'run', null, { timeout: 3000 });
  check(await OA(() => OptionArcade.P.carrier && OptionArcade.P.carrier.id === 'QB'), `${tag}: letting go mid-exchange pulls it`);
  await p.waitForFunction(() => { const P = OptionArcade.P; if (P.phase !== 'run') return true; const k = FB.key2Of(P); return !document.getElementById('oa-pitch').hidden && FB.dist(k, P.by.QB) < 3; }, null, { timeout: 5000 }).catch(() => {});
  await shot('07-option');
  const pitchShown = await OA(() => !document.getElementById('oa-pitch').hidden);
  check(pitchShown, `${tag}: the PITCH button shows up with the pitch man trailing`);
  if (pitchShown) { const [px, py] = await box('#oa-pitch'); await p.mouse.click(px, py); }
  await p.waitForFunction(() => OptionArcade.P.pitch || OptionArcade.P.phase === 'dead', null, { timeout: 3000 }).catch(() => {});
  check(await OA(() => !!OptionArcade.P.pitch), `${tag}: tapping PITCH pitches it`);
  await wait(450); await shot('08-pitch');
  // a juke, swiped with a real pointer on the right half of the screen
  await p.waitForFunction(() => OptionArcade.P.carrier && OptionArcade.P.carrier === OptionArcade.P.ctrl || OptionArcade.P.phase === 'dead', null, { timeout: 3000 });
  const before = await OA(() => OptionArcade.P.stats.jukes);
  await OA(({ w, h }) => {
    const cv = document.getElementById('oa-canvas');
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', w * 0.8, h * 0.6); ev('pointermove', w * 0.8, h * 0.6 - 15); ev('pointermove', w * 0.8, h * 0.6 - 40); ev('pointerup', w * 0.8, h * 0.6 - 40);
  }, { w, h });
  await wait(120);
  const live = await OA(() => OptionArcade.P.phase === 'run');
  if (live) check(await OA(() => OptionArcade.P.stats.jukes) > before, `${tag}: an upward swipe on the right half jukes`);
  // and the left-thumb stick steers
  if (live) {
    const h0 = await OA(() => OptionArcade.P.ctrl.h);
    await OA(({ w, h }) => {
      const cv = document.getElementById('oa-canvas');
      const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 9, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
      ev('pointerdown', w * 0.2, h * 0.7); ev('pointermove', w * 0.2 + 10, h * 0.7 + 45);
      window.__up = () => ev('pointerup', w * 0.2 + 10, h * 0.7 + 45);
    }, { w, h });
    await wait(260); await shot('09-steer');
    const h1 = await OA(() => OptionArcade.P.ctrl.h);
    await OA(() => window.__up());
    check(Math.abs(h1 - h0) > 0.15 || !(await OA(() => OptionArcade.P.phase === 'run')), `${tag}: dragging the left thumb steers the runner`);
  }
  await cardUp(); await wait(200); await shot('10-card');

  // 3. the rest of the set on the keyboard: Space to snap and give, the arrows to run
  for (let i = 0; i < 12; i++) {
    const over = await OA(() => !document.getElementById('oa-sum').hidden);
    if (over) break;
    await p.click('#oa-next');
    await p.keyboard.down(' '); await wait(i % 2 ? 1700 : 900); await p.keyboard.up(' ');
    await p.keyboard.down('ArrowRight'); await cardUp(); await p.keyboard.up('ArrowRight');
  }
  if (await OA(() => !document.getElementById('oa-card').hidden)) await p.click('#oa-next');
  await p.waitForFunction(() => !document.getElementById('oa-sum').hidden, null, { timeout: 10000 }).catch(() => {});
  await wait(200); await shot('11-summary');
  check(await OA(() => !document.getElementById('oa-sum').hidden && OptionArcade.G.n === 10), `${tag}: ten plays end the set`);
  await p.click('#oa-sum-home');
  await p.click('#oa-film-btn2'); await wait(200); await shot('12-film');
  check(await OA(() => +document.getElementById('oa-f-plays').textContent >= 10), `${tag}: the film room has the plays`);
  check(await overflow() <= 1, `${tag}: the film room fits`);
  await p.click('#oa-film-close');
  await p.click('#oa-gear2'); await wait(200); await shot('13-settings');
  await p.click('#oa-set-done');
  // Drive mode shows down and distance
  await p.click('[data-mode="drive"]'); await wait(300); await shot('14-drive');
  check(/1st & 10/.test(await OA(() => document.getElementById('oa-status').textContent)), `${tag}: Drive starts 1st & 10`);
  check(errors.length === 0, `${tag}: no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

async function passing(browser, w, h, tag) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setContent(page('option-arcade.html'), { waitUntil: 'load' });
  const wait = ms => p.waitForTimeout(ms);
  const shot = n => p.screenshot({ path: `${OUT}/${tag}-${n}.png` });
  const OA = (f, a) => p.evaluate(f, a);
  const box = async sel => { const b = await p.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const cardUp = () => p.waitForFunction(() => !document.getElementById('oa-card').hidden || !document.getElementById('oa-sum').hidden, null, { timeout: 30000 });
  await wait(300);
  // the jet sweep: hold GIVE and the jet man takes it
  await p.click('[data-mode="lab"]');
  if (await OA(() => !document.getElementById('oa-howsheet').hidden)) { await shot('p01-how'); await p.click('#oa-how-go'); }
  await OA(() => { OptionArcade.G.call = 'jet-d'; OptionArcade.G.look = 'sit'; OptionArcade.newPlay(); });
  let [gx, gy] = await box('#oa-give');
  await p.mouse.move(gx, gy); await p.mouse.down();
  await p.waitForFunction(() => OptionArcade.P.phase === 'mesh', null, { timeout: 5000 });
  await wait(150); await shot('p02-jet-mesh');
  await p.waitForFunction(() => OptionArcade.P.phase === 'run', null, { timeout: 5000 });
  await p.mouse.up();
  check(await OA(() => OptionArcade.P.carrier && OptionArcade.P.carrier.id === 'JET'), `${tag}: the jet man takes the handoff`);
  // spin and hurdle, swiped on the right half
  const swipe = async (dx, id) => OA(({ w, h, dx, id }) => {
    const cv = document.getElementById('oa-canvas');
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', w * 0.75, h * 0.6); ev('pointermove', w * 0.75 + dx / 3, h * 0.6); ev('pointermove', w * 0.75 + dx, h * 0.6); ev('pointerup', w * 0.75 + dx, h * 0.6);
  }, { w, h, dx, id });
  await swipe(-45, 21); await wait(120);
  const sp = await OA(() => OptionArcade.P.stats.spins);
  await wait(800);
  if (await OA(() => OptionArcade.P.phase === 'run')) { await swipe(45, 22); await wait(150); await shot('p03-hurdle'); }
  const hu = await OA(() => OptionArcade.P.stats.hurdles);
  check(sp >= 1, `${tag}: a swipe back spins`);
  check(hu >= 1 || !(await OA(() => OptionArcade.P.phase === 'run')), `${tag}: a swipe forward hurdles`);
  await cardUp();
  await p.click('#oa-exit');
  // Pass Lab: tap SNAP, pull back to aim, let go to throw
  await p.click('[data-mode="pass"]'); await wait(200);
  await OA(() => { OptionArcade.G.cover = 'cover3'; OptionArcade.G.call = 'smash'; OptionArcade.newPlay(); });
  await wait(250); await shot('p04-pass-presnap');
  check(await OA(() => OptionArcade.V.mode === 'a22'), `${tag}: pass plays use the All-22 camera`);
  [gx, gy] = await box('#oa-give');
  await p.mouse.click(gx, gy);
  await p.waitForFunction(() => OptionArcade.P.phase === 'run' && FB.canThrow(OptionArcade.P), null, { timeout: 5000 });
  await wait(900);
  await OA(({ w, h }) => {
    const cv = document.getElementById('oa-canvas');
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 31, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    // All-22: pull down (and a little to the side) on the right half; the throw goes upfield
    ev('pointerdown', w * 0.75, h * 0.45); ev('pointermove', w * 0.74, h * 0.45 + 50); ev('pointermove', w * 0.72, h * 0.45 + 100);
    window.__release = () => ev('pointerup', w * 0.72, h * 0.45 + 100);
  }, { w, h });
  await wait(120); await shot('p05-aiming');
  check(await OA(() => OptionArcade.P.scale < 0.95), `${tag}: lining up a throw slows the world down`);
  await OA(() => window.__release());
  await p.waitForFunction(() => OptionArcade.P.thrown || OptionArcade.P.phase === 'dead', null, { timeout: 3000 }).catch(() => {});
  check(await OA(() => !!OptionArcade.P.thrown), `${tag}: letting go throws it`);
  check(await OA(() => OptionArcade.P.ball.tx > OptionArcade.P.by.QB.x + 8), `${tag}: pulling down throws it downfield`);
  await wait(350); await shot('p06-ball-in-air');
  await cardUp(); await wait(200); await shot('p07-pass-card');
  const t = await OA(() => document.getElementById('oa-reads').textContent + ' | ' + document.getElementById('oa-yds').textContent);
  check(/Cover 3/.test(t), `${tag}: the card names the coverage ("${t.slice(0, 70)}...")`);
  // the keyboard: 3 throws to the right slot, led
  await p.click('#oa-next');
  [gx, gy] = await box('#oa-give');
  await p.mouse.click(gx, gy);
  await p.waitForFunction(() => OptionArcade.P.phase === 'run' && FB.canThrow(OptionArcade.P), null, { timeout: 5000 });
  await wait(1100); await p.keyboard.press('3');
  await p.waitForFunction(() => OptionArcade.P.thrown || OptionArcade.P.phase === 'dead', null, { timeout: 3000 }).catch(() => {});
  check(await OA(() => OptionArcade.P.thrown && OptionArcade.P.thrown.target === 'SR'), `${tag}: the 3 key throws to the right slot`);
  await cardUp();
  // the camera setting: sideline always puts pass plays back on the sideline view
  await OA(() => { OptionArcade.S.cam = 'side'; OptionArcade.newPlay(); });
  check(await OA(() => OptionArcade.V.mode === 'side'), `${tag}: 'Sideline always' keeps passes on the sideline camera`);
  await OA(() => { OptionArcade.S.cam = 'auto'; });
  // the whole playbook in a drive
  await p.click('#oa-exit');
  await p.click('[data-mode="drive"]'); await wait(200);
  await p.keyboard.press(' ');
  await OA(() => { OptionArcade.inp.hold = true; });
  await p.waitForFunction(() => OptionArcade.P.phase === 'run' || OptionArcade.P.phase === 'dead', null, { timeout: 6000 });
  await OA(() => { OptionArcade.inp.hold = false; });
  await cardUp(); await wait(150); await shot('p08-drive-card');
  check(await OA(() => document.querySelectorAll('#oa-plays button').length === 10), `${tag}: Drive offers the whole playbook (option, jet, passes)`);
  await p.click('#oa-film-btn'); await wait(150); await shot('p09-film');
  check(errors.length === 0, `${tag} passing: no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}

async function lifeos(browser) {
  // a stand-in LIFE OS host: the game in an iframe with ?embed=1, game day ("clutch")
  const dir = path.join(OUT, 'host');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', 'dist', 'option-arcade-standalone.html'), path.join(dir, 'football.html'));
  fs.writeFileSync(path.join(dir, 'host.html'), `<!doctype html><body style="margin:0"><iframe id="f" src="football.html?embed=1" style="border:0;width:100vw;height:100vh"></iframe><script>
    window.got = [];
    addEventListener('message', e => { const d = e.data; if (!d || d.type !== 'lifeos:minigame') return; got.push(d);
      if (d.event === 'ready') document.getElementById('f').contentWindow.postMessage({ type: 'lifeos:init', config: { play: 'clutch', mode: 'clutch', difficulty: 55, skill: 62, me: 'Mike', seed: 4242 } }, '*'); });
  </script></body>`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('file://' + path.join(dir, 'host.html'));
  const f = () => p.frames().find(fr => fr.url().includes('football.html'));
  await p.waitForFunction(() => window.got.some(d => d.event === 'ready'), null, { timeout: 8000 });
  await p.waitForTimeout(400);
  const fr = f();
  check(await fr.evaluate(() => OptionArcade.G.mode === 'goal'), 'LIFE OS game day opens straight into Goal Line');
  check(await fr.evaluate(() => /1st & goal/.test(document.getElementById('oa-status').textContent)), 'it starts 1st & goal');
  if (await fr.evaluate(() => !document.getElementById('oa-howsheet').hidden)) await fr.click('#oa-how-go');
  await p.screenshot({ path: `${OUT}/life-01-goalline.png` });
  for (let i = 0; i < 4; i++) {
    if (await fr.evaluate(() => !document.getElementById('oa-sum').hidden)) break;
    await fr.evaluate(() => { OptionArcade.inp.hold = true; });
    await fr.waitForFunction(() => OptionArcade.P.phase === 'run' || OptionArcade.P.phase === 'dead', null, { timeout: 6000 });
    await fr.evaluate(() => { OptionArcade.inp.hold = false; });
    await fr.waitForFunction(() => !document.getElementById('oa-card').hidden, null, { timeout: 20000 });
    await fr.click('#oa-next');
  }
  await fr.waitForFunction(() => !document.getElementById('oa-sum').hidden, null, { timeout: 8000 });
  await p.screenshot({ path: `${OUT}/life-02-done.png` });
  await fr.click('#oa-sum-go');
  await p.waitForFunction(() => window.got.some(d => d.event === 'finish'), null, { timeout: 4000 }).catch(() => {});
  const fin = await p.evaluate(() => window.got.find(d => d.event === 'finish'));
  check(!!fin && fin.result.max === 10 && fin.result.score >= 0 && fin.result.score <= 10, `Done hands LIFE OS the score: ${fin ? JSON.stringify({ score: fin.result.score, max: fin.result.max, summary: fin.result.summary }) : 'nothing'}`);
  check(errors.length === 0, `LIFE OS round: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await phone(browser, 390, 844, 'portrait');
  await phone(browser, 844, 390, 'landscape');
  await phone(browser, 360, 740, 'small');
  await passing(browser, 390, 844, 'portrait');
  await passing(browser, 844, 390, 'landscape');
  await lifeos(browser);
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
