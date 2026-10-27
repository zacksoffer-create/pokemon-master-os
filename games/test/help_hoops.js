// 1-on-2: beat the first defender, then each help type against each finish.
// Logs the combined contest at release (or the turnover) so the reads can be checked.
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
  await p.evaluate(() => { const h = document.createElement('div'); h.style.cssText = 'position:fixed;inset:0;z-index:99'; document.body.appendChild(h); window.__e = HoopsEngine.create(h, { touchK: 1.77, hints: false }); });
  const G = await require('./gest')(p);
  const wait = ms => p.waitForTimeout(ms);
  const run = (plan, seed) => p.evaluate(([plan, seed]) => window.__e.run({ kind: 'possessions', court: 'gym', count: 1, shotClock: 0, plan: [plan], seed }, { onEnd() {}, onQuit() {} }), [plan, seed]);
  const flick = async () => {
    const k = await p.evaluate(() => { const S = window.__e._S, R = Court3D.RIM; return HoopPhysics.idealFlick(Math.hypot(S.shooter.pos[0] - R.x, S.shooter.pos[2] - R.z)); });
    await G.flick(260 * k, 110);
  };
  const state = () => p.evaluate(() => { const S = window.__e._S, P = S.poss || {}; return { phase: S.phase, beat: S.def && S.def.state, help: S.help && S.help.state + (S.help.planted ? ':planted' : ''), dist: S.shooter && +Math.hypot(S.shooter.pos[0] - Court3D.RIM.x, S.shooter.pos[2] - Court3D.RIM.z).toFixed(1), shot: P.helpKind, contest: P.contest != null ? +P.contest.toFixed(2) : null, helpC: P.helpC != null ? +P.helpC.toFixed(2) : null, to: P.turnover || null }; });
  // beat the Closer on the catch: swipe as the ball arrives
  const beat = async (side, plan, seed) => {
    await run(plan, seed);
    for (let i = 0; i < 100; i++) { if ((await p.evaluate(() => window.__e._S.phase)) === 'live') break; await wait(20); }
    await G.swipe(side * 160, 0);
  };
  const rows = [];
  const tryIt = async (label, plan, side, actions, seed = 41) => {
    await beat(side, plan, seed);
    for (const a of actions) { if (typeof a === 'number') await wait(a); else if (a === 'flick') await flick(); else if (a === 'tap') await G.tap(); else if (a === 'euroL') await G.swipe(-150, 0); else if (a === 'euroR') await G.swipe(150, 0); }
    await wait(140);
    rows.push([label, await state()]);
    await wait(1800);
  };
  const plan = (help, spot = 'top') => ({ spot, defender: 'closer', help });
  // The Wall: pull-up and floater should be open-ish, layup smothered
  await tryIt('wall: pull-up early', plan('wall'), 1, [90, 'flick']);
  await tryIt('wall: floater midway', plan('wall'), 1, [430, 'flick']);
  await tryIt('wall: layup at the rim', plan('wall'), 1, [760, 'flick']);
  await p.screenshot({ path: OUT + '/h-wall.png' });
  // The Charge Taker: ride it in -> charge; floater before him -> fine; euro around -> fine
  await tryIt('charge: ride it to the rim', plan('charge'), 1, [760, 'flick']);
  await tryIt('charge: floater before him', plan('charge'), 1, [480, 'flick']);
  await tryIt('charge: euro around him', plan('charge'), 1, [420, 'euroL', 300, 'flick']);
  await tryIt('wall: euro into him', plan('wall'), 1, [420, 'euroL', 300, 'flick']);
  // The Leaper: straight layup contested; fake at the rim, then finish -> open
  await tryIt('leaper: straight layup', plan('leaper', 'lw'), 1, [760, 'flick']);
  await tryIt('leaper: fake, then finish', plan('leaper', 'lw'), 1, [500, 'tap', 600, 'flick']);
  // The Digger at the ball-side elbow: drive at him vs away from him (left wing: ball side is left)
  await tryIt('digger: drive toward his side', plan('digger', 'lw'), 1, [760, 'flick']);
  await tryIt('digger: drive away from him', plan('digger', 'lw'), -1, [760, 'flick']);
  await tryIt('digger: rise early', plan('digger', 'lw'), 1, [90, 'flick']);
  // Late help: quick layup vs hesitating with a fake
  await tryIt('late: quick layup', plan('late', 'lw'), -1, [760, 'flick']);
  await tryIt('late: fake, then layup', plan('late', 'lw'), -1, [500, 'tap', 600, 'flick']);
  await tryIt('late: pull-up early', plan('late', 'lw'), -1, [120, 'flick']);
  await tryIt('late: floater midway', plan('late', 'lw'), -1, [450, 'flick']);
  await p.screenshot({ path: OUT + '/h-late.png' });
  // pre-drive view with help visible
  await run(plan('wall', 'lw'), 7); await wait(1500);
  await p.screenshot({ path: OUT + '/h-pre.png' });
  // where you are on a help drive, by time
  await beat(1, plan('wall'), 41);
  const track = [];
  for (const t of [100, 200, 300, 400, 500, 600, 720]) { await wait(t - (track.length ? [100, 200, 300, 400, 500, 600, 720][track.length - 1] : 0)); track.push(t + 'ms:' + (await state()).dist); }
  console.log('drive path', track.join(' '));
  rows.forEach(([k, v]) => console.log(k.padEnd(30), JSON.stringify(v)));
  console.log('errors', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
