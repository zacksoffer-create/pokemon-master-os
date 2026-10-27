// Playmaker controls with real gestures through the page: pass types from the
// shape of the flick, drive-and-kick in one motion, court vision, control
// following the ball, and each defense's right pass against its wrong one.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/pm-shots';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra) => { if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (extra ? '  ' + extra : '')); };
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => { const h = document.createElement('div'); h.style.cssText = 'position:fixed;inset:0;z-index:99'; document.body.appendChild(h); window.__pm = PlaymakerEngine.create(h, { passK: 80, passSpd: 1.9, court: 'gym', hints: false }); });
  const G = await require('./pmgest')(p);
  const wait = ms => p.waitForTimeout(ms);
  const S = () => p.evaluate(() => { const S = window.__pm._S, w = S.w; return { phase: S.phase, ball: w && w.ball.state, handler: w && w.handler, passes: w && w.passes, over: w && w.over, scale: S.scale, vis: S.vision.left, lastType: w && w.lastPass && w.lastPass.type, bend: w && w.lastPass && w.lastPass.bend, q: w && w.lastPass && w.lastPass.q, story: w && w.story.map(s => s.k + (s.result ? ':' + s.result : '') + (s.win != null ? ':' + s.win : '')), res: w && w.result && { g: w.result.grade, to: w.result.turnover, pts: w.result.points, tags: w.result.tags, kind: w.result.kind, c: w.result.contest != null ? +w.result.contest.toFixed(2) : null } }; });
  async function start(scheme, seed, mirror) {
    await p.evaluate(([scheme, seed, mirror]) => window.__pm.run({ kind: 'pm', count: 3, court: 'gym', seed, plan: [{ scheme, mirror }, { scheme, mirror }, { scheme, mirror }] }, { onEnd() {}, onQuit() {} }), [scheme, seed, !!mirror]);
    for (let i = 0; i < 80 && (await S()).phase !== 'live'; i++) await wait(40);
    await wait(150);
  }
  // screen vector from the ball handler toward a floor point, and its length for that distance
  const aim = to => p.evaluate(to => {
    const w = window.__pm._S.w, H = w.off[w.handler].pos;
    const a = window.__pm._project([H[0], 0, H[2]]), b = window.__pm._project([to[0], 0, to[2]]);
    const d = Math.hypot(to[0] - H[0], to[2] - H[2]);
    return { dx: b.x - a.x, dy: b.y - a.y, d, L: d / window.__pm.settings.passK * innerHeight };
  }, to);
  const target = (j, ahead) => p.evaluate(([j, ahead]) => { const w = window.__pm._S.w; const T = w.off[j]; return T.state === 'relocate' ? T.home : PMSim.predict(w, j, ahead); }, [j, ahead == null ? 0.55 : ahead]);
  async function flick(to, ms, o) {
    const v = await aim(to), l = Math.hypot(v.dx, v.dy) || 1;
    await G.stroke(195, 720, v.dx / l * v.L, v.dy / l * v.L, ms, o);
  }
  // hold and drag like a joystick toward a floor point; a snap the other way first crosses him
  async function drive(to, ms, crossFirst) {
    await G.down(195, 720);
    let x = 195, y = 720;
    if (crossFirst) {
      const v = await aim(to), l = Math.hypot(v.dx, v.dy) || 1;
      const sx = v.dx / l, sy = v.dy / l;
      for (let i = 1; i <= 5; i++) { await G.move(195 - sy * 0 - Math.sign(sx || 1) * i * 9, 720 - i * 3); await wait(30); }
      x = 195 - Math.sign(sx || 1) * 45; y = 705;
    }
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const v = await aim(to), l = Math.hypot(v.dx, v.dy) || 1;
      x = 195 + v.dx / l * 70; y = 720 + v.dy / l * 70;
      await G.move(x, y); await wait(35);
      const st = await S(); if (st.ball !== 'held' || st.over) break;
    }
    return { x, y };
  }
  async function release(at) { await G.up(at.x, at.y); }
  async function settle(ms) { for (let i = 0; i < (ms || 5000) / 60; i++) { const st = await S(); if (st.phase === 'card' || st.phase === 'ending') break; await wait(60); } await wait(200); return S(); }
  const idx = (role) => p.evaluate(r => window.__pm._S.w.off.findIndex(o => o.role.id === r), role);

  // ---- pass types from the shape of the flick ----
  const wing = async () => target(1, 0.4);
  await start('cornerhelp', 11);
  await flick(await wing(), 90); await wait(60);
  let st = await S(); check(st.lastType === 'bullet', 'quick flick throws a bullet', st.lastType);
  await start('cornerhelp', 11);
  await flick(await wing(), 230); await wait(60);
  st = await S(); check(st.lastType === 'chest', 'an ordinary flick is a chest pass', st.lastType);
  await start('cornerhelp', 11);
  { const v = await aim(await wing()), l = Math.hypot(v.dx, v.dy); await G.stroke(195, 720, v.dx / l * v.L * 0.92, v.dy / l * v.L * 0.92, 330); }
  await wait(60); st = await S(); check(st.lastType === 'lob', 'a soft, slow flick is a lob (not a drive)', st.lastType);
  await start('cornerhelp', 11);
  await flick(await wing(), 150, { dip: 45 }); await wait(60);
  st = await S(); check(st.lastType === 'bounce', 'pull back, then flick: bounce pass', st.lastType);
  await start('cornerhelp', 11);
  await flick(await wing(), 200, { curl: 46 }); await wait(60);
  st = await S(); check(Math.abs(st.bend || 0) > 0.8, 'curling the flick bends the pass', 'bend ' + (st.bend || 0).toFixed(2));
  await p.screenshot({ path: OUT + '/c1-bend.png' });

  // ---- court vision ----
  await start('packline', 12);
  await G.down(195, 720); await wait(650);
  st = await S(); check(st.scale < 0.6 && st.vis < 1.0, 'holding still slows the floor and drains court vision', `scale ${st.scale.toFixed(2)} left ${st.vis.toFixed(2)}`);
  await p.screenshot({ path: OUT + '/c2-vision.png' });
  await G.up(195, 720); await wait(400);
  st = await S(); check(st.scale > 0.9, 'letting go brings the floor back to speed', `scale ${st.scale.toFixed(2)}`);

  // ---- drive and kick in one motion ----
  await start('cornerhelp', 13);
  const corner = await idx('shooter').then(() => p.evaluate(() => { const w = window.__pm._S.w; return w.off.findIndex(o => Math.abs(Court3D.polarOf(o.pos).angle) > 70 && o.pos[2] < 11); }));
  const at = await drive([6, 0, 10], 900, true);
  st = await S();
  const drove = st.story.some(s => s.startsWith('drive:true'));
  const cpt = await target(corner, 0.3);
  { const v = await aim(cpt), l = Math.hypot(v.dx, v.dy); const pts = []; for (let i = 1; i <= 5; i++) pts.push([at.x + v.dx / l * v.L * i / 5, at.y + v.dy / l * v.L * i / 5]); for (const q of pts) { await G.move(q[0], q[1]); await wait(16); } await release({ x: pts[4][0], y: pts[4][1] }); }
  await wait(80); st = await S();
  check(drove && st.passes === 1, 'drag to drive, flick at the end: pass on the move', JSON.stringify(st.story));
  await p.screenshot({ path: OUT + '/c3-kick.png' });
  st = await settle();
  check(st.res && !st.res.to, 'the kick from the drive is caught', JSON.stringify(st.res));

  // ---- control follows the ball, and the extra pass ----
  await start('packline', 14);
  const w1 = await target(1, 0.35);
  await flick(w1, 120);
  for (let i = 0; i < 40 && (await S()).ball !== 'held'; i++) await wait(40);
  st = await S(); check(st.handler === 1, 'the catch hands you the next man', 'handler ' + st.handler);
  await wait(60);
  const back = await target(0, 0.4);
  await flick(back, 120);
  await wait(80); st = await S();
  check(st.passes === 2, 'and you can swing it again before he shoots', 'passes ' + st.passes);
  await settle();

  // ---- the reads, with real gestures ----
  const rows = [];
  // denial: the pass into the hand vs the backdoor bounce
  await start('denial', 21);
  let sl = await idx('slasher');
  await flick(await target(sl, 0.3), 200);
  st = await settle(); rows.push(['denial: pass to the denied wing', st.res]);
  check(st.res && st.res.to === 'Picked', 'denial: throwing it into his hand gets picked', JSON.stringify(st.res));
  await start('denial', 21);
  await wait(1100);
  await flick(await target(sl, 0.75), 150, { dip: 45 });
  st = await settle(); rows.push(['denial: backdoor bounce', st.res]);
  check(st.res && !st.res.to && (st.res.g === 'A' || st.res.g === 'B'), 'denial: the backdoor bounce gets a layup', JSON.stringify(st.res));
  await p.screenshot({ path: OUT + '/c4-backdoor.png' });
  // lane jumper: the chest pass into his lane vs fake and back cut
  await start('lanejumper', 22);
  const jm = await p.evaluate(() => { const d = window.__pm._S.w.def.find(x => x.jumper); return d ? d.man : 2; });
  await flick(await target(jm, 0.3), 200);
  st = await settle(); rows.push(['lane jumper: chest into his lane', st.res]);
  check(st.res && st.res.to === 'Picked', 'lane jumper: a chest pass into his lane gets picked', JSON.stringify(st.res));
  await start('lanejumper', 22);
  await G.tap(195, 720); await wait(600);
  await flick(await target(jm, 0.75), 150, { dip: 45 });
  st = await settle(); rows.push(['lane jumper: fake, back cut, bounce', st.res]);
  check(st.res && !st.res.to, 'lane jumper: fake him, hit the back cut', JSON.stringify(st.res));
  // corner help: drive, kick to the corner
  await start('cornerhelp', 23);
  { const a = await drive([7, 0, 10], 1100, true); await release(a); }
  { const hm = await p.evaluate(() => { const w = window.__pm._S.w; return w.help ? w.help.man : 3; }); await flick(await target(hm, 0.3), 100); }
  st = await settle(); rows.push(['corner help: drive and kick', st.res]);
  check(st.res && !st.res.to && (st.res.g === 'A' || st.res.g === 'B'), 'corner help: the corner is open on the kick', JSON.stringify(st.res));
  // rim protector: drive, lob to the big
  await start('rim', 24);
  { const a = await drive([-2, 0, 9], 1100, true); await release(a); }
  { const bj = await idx('big'); await flick(await target(bj, 0.6), 330); }
  st = await settle(); rows.push(['rim protector: drive, lob the big', st.res]);
  check(st.res && !st.res.to && st.res.kind === 'dunk', 'rim protector: the lob over him is a dunk', JSON.stringify(st.res));
  await p.screenshot({ path: OUT + '/c5-oop.png' });
  // pack line: drive, kick to the man they left
  await start('packline', 25);
  { const a = await drive([5, 0, 11], 1100, true); await release(a); }
  { const hm = await p.evaluate(() => { const w = window.__pm._S.w; return w.help ? w.help.man : 1; }); await flick(await target(hm, 0.3), 100); }
  st = await settle(); rows.push(['pack line: drive and kick', st.res]);
  check(st.res && !st.res.to && (st.res.g === 'A' || st.res.g === 'B'), 'pack line: the kick-out is open', JSON.stringify(st.res));

  console.log('\nreads:');
  rows.forEach(([k, v]) => console.log('  ' + k.padEnd(38) + JSON.stringify(v)));
  check(!errors.length, 'no page errors', errors.join(' | '));
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
