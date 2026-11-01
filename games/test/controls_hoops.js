// Exercises the dribble-move controls with deterministic gestures against chosen defenders.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/hoops-shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99';
    document.body.appendChild(host);
    window.__e = HoopsEngine.create(host, { touchK: 1.77, hints: false });
  });
  const G = await require('./gest')(p);
  const S = () => p.evaluate(() => { const S = window.__e._S; return { phase: S.phase, state: S.def && S.def.state, mom: S.def && +S.def.momSide.toFixed(2), acts: S.poss && S.poss.actions.slice(), pts: S.score, pop: S.popups.map(x => x.text) }; });
  const runPoss = (plan, seed) => p.evaluate(([plan, seed]) => window.__e.run({ kind: 'possessions', court: 'gym', count: 1, shotClock: 0, plan: [plan], seed }, { onEnd() {}, onQuit() {} }), [plan, seed]);
  const ideal = () => p.evaluate(() => { const S = window.__e._S; const R = Court3D.RIM; return HoopPhysics.idealFlick(Math.hypot(S.shooter.pos[0] - R.x, S.shooter.pos[2] - R.z)); });
  const flick = async (curl = 0) => {
    const k = await ideal();
    const len = 260 * k;
    // a curled flick: the path bows sideways by curl × length at the middle
    await p.evaluate(([len, curl]) => { const n = 10, pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push({ x: 195 + Math.sin(Math.PI * t) * curl * len, y: 720 - len * t, t: 120 * t }); } pts.push({ x: 195, y: 720 - len, t: 121 }); window.__gest(pts); }, [len, curl]);
  };
  const wait = ms => p.waitForTimeout(ms);
  const results = [];

  // 1. Gambler: jab right, then drive left right away -> should cross him
  await runPoss({ spot: 'top', defender: 'gambler' }, 11); await wait(1700);
  await G.swipe(40, 0); await wait(120); await G.swipe(-160, 0); await wait(260);
  results.push(['jab then cross vs Gambler', await S()]);
  await p.screenshot({ path: OUT + '/c1-cross.png' });
  // 1b. finish with a spun layup after a euro step
  await G.swipe(140, 0); await wait(300);
  results.push(['euro step', await S()]);
  await flick(0.15); await wait(250);
  await p.screenshot({ path: OUT + '/c1b-layup.png' });
  await wait(2200);
  results.push(['spun layup result', await S()]);

  // 2. Sagger: drive -> always cut off (clear read), reason shown
  for (const seed of [3, 4, 5]) {
    await runPoss({ spot: 'lw', defender: 'sagger' }, seed); await wait(2300);
    await G.swipe(-160, 0); await wait(200);
    results.push(['drive vs Sagger (seed ' + seed + ')', await S()]);
  }
  await p.screenshot({ path: OUT + '/c2-sagger.png' });

  // 3. Wingspan (slow feet): drive right gets cut? then snap back left mid-move
  await runPoss({ spot: 'top', defender: 'baseline' }, 8); await wait(2300);
  const side = await p.evaluate(() => window.__e._S.def.shadeSide);
  await G.swipe(side * 160, 0); await wait(150); await G.swipe(-side * 160, 0); await wait(250);
  results.push(['into the shade, snap back', await S()]);

  // 4. Queue: swipe during the catch, executes when live
  await runPoss({ spot: 'rw', defender: 'closer' }, 9); await wait(1250);
  await G.swipe(-160, 0); await wait(500);
  results.push(['swipe during catch (queued)', await S()]);

  // 5. Pest jab: barely moves him
  await runPoss({ spot: 'top', defender: 'pest' }, 10); await wait(2300);
  await G.swipe(40, 0); await wait(100);
  results.push(['jab vs Pest', await S()]);
  await p.screenshot({ path: OUT + '/c5-pest-jab.png' });
  await G.swipe(-160, 0); await wait(250);
  results.push(['cross vs Pest', await S()]);

  results.forEach(([k, v]) => console.log(k.padEnd(30), JSON.stringify(v)));
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
