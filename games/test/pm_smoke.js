// Plays Playmaker through the app: the pass calibration, a full game, a
// featured challenge, every Draw It Up board with its answer drawn, the
// results and the scouting book. Screenshots; fails on page errors, sideways
// overflow, a lost calibration, or a drawn answer that doesn't grade A or B.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/pm-shots';
require('fs').mkdirSync(OUT, { recursive: true });
const ANSWERS = {
  watcher: { cut: [1, [[-9, 11], [-2.5, 6.6]]], pass: [-2.4, 7.0], type: 'bounce' },
  denied: { cut: [2, [[9, 12], [3, 7]]], pass: [3.2, 7.6], type: 'bounce' },
  sunk: { pass: [-21, 3.6], type: 'chest' },
  fourseconds: { pass: [-3.4, 6.4], type: 'lob' },
  switch: { pass: [6.0, 7.6], type: 'bounce' },
  gambler: { cut: [2, [[10, 11.5], [3.5, 7]]], pass: [3.6, 7.5], type: 'bounce' }
};
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const results = {};
  for (const [vw, vh] of [[390, 844], [430, 932]]) {
    const tag = `${vw}`;
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
    await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' });
    await p.evaluate(() => { const o = PlaymakerEngine.create; PlaymakerEngine.create = (...a) => (window.__pm = o(...a)); });
    const G = await require('./pmgest')(p);
    const wait = ms => p.waitForTimeout(ms);
    const overflow = async where => { const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 1) errors.push(`overflow ${o}px on ${where}`); };
    const S = () => p.evaluate(() => { const S = window.__pm && window.__pm._S, w = S && S.w; return S ? { phase: S.phase, kind: S.spec && S.spec.kind, ball: w && w.ball.state, i: S.i, step: S.calibStep, passes: w && w.passes } : null; });
    const aimStroke = async (to, ms, o) => {
      const v = await p.evaluate(to => { const w = window.__pm._S.w, H = w.off[w.handler].pos; const a = window.__pm._project([H[0], 0, H[2]]), b = window.__pm._project([to[0], 0, to[2]]); return { dx: b.x - a.x, dy: b.y - a.y, L: Math.hypot(to[0] - H[0], to[2] - H[2]) / (window.__pm.settings.passK || 80) * innerHeight }; }, to);
      const l = Math.hypot(v.dx, v.dy) || 1;
      await G.stroke(vw / 2, vh * 0.85, v.dx / l * v.L, v.dy / l * v.L, ms, o);
    };
    const target = (j, ahead) => p.evaluate(([j, ahead]) => { const w = window.__pm._S.w; const T = w.off[j]; return T.state === 'relocate' ? T.home : PMSim.predict(w, j, ahead); }, [j, ahead]);
    const untilPhase = async (ph, ms) => { for (let i = 0; i < (ms || 6000) / 50; i++) { const s = await S(); if (s && s.phase === ph) return true; await wait(50); } return false; };

    await wait(250);
    await p.screenshot({ path: `${OUT}/s01-home-${tag}.png` });
    await p.click('[data-go="pm"]'); await wait(200);
    await overflow('playmaker screen');
    await p.screenshot({ path: `${OUT}/s02-pm-${tag}.png`, fullPage: true });
    // the first game asks for two passes to the corners
    await p.click('[data-pm="play"]'); await wait(900);
    await p.screenshot({ path: `${OUT}/s03-calibrate-${tag}.png` });
    for (const j of [1, 2]) {
      for (let i = 0; i < 80; i++) { const s = await S(); if (s && s.kind === 'calibrate' && s.phase === 'live' && s.passes === 0 && s.step === j - 1) break; await wait(50); }
      const to = await p.evaluate(j => window.__pm._S.w.off[j].pos, j);
      await aimStroke(to, 170);
      await wait(1300);
    }
    for (let i = 0; i < 120; i++) { const s = await S(); if (s && s.kind === 'pm' && s.phase === 'live') break; await wait(50); }
    const cal = await p.evaluate(() => ({ k: window.__pm.settings.passK, dur: window.__pm.settings.passDur }));
    await wait(300);
    await p.screenshot({ path: `${OUT}/s04-possession-${tag}.png` });
    // eight possessions: the read each defense gives you, then a couple of loose ones
    const ax = vw / 2, ay = vh * 0.85;
    const aimV = to => p.evaluate(to => { const w = window.__pm._S.w, H = w.off[w.handler].pos; const a = window.__pm._project([H[0], 0, H[2]]), b = window.__pm._project([to[0], 0, to[2]]); return { dx: b.x - a.x, dy: b.y - a.y }; }, to);
    const idx = r => p.evaluate(r => window.__pm._S.w.off.findIndex(o => o.role.id === r), r);
    const held = () => p.evaluate(() => window.__pm._S.w.ball.state === 'held' && !window.__pm._S.w.over);
    async function driveAt(to, ms) {
      await G.down(ax, ay);
      const v0 = await aimV(to), sx = Math.sign(v0.dx || 1);
      for (let i = 1; i <= 5; i++) { await G.move(ax - sx * i * 9, ay - i * 3); await wait(30); }
      let x = ax, y = ay;
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const v = await aimV(to), l = Math.hypot(v.dx, v.dy) || 1;
        x = ax + v.dx / l * 70; y = ay + v.dy / l * 70;
        await G.move(x, y); await wait(35);
        if (!(await held())) break;
      }
      await G.up(x, y);
    }
    async function rightRead(shot) {
      const sc = await p.evaluate(() => window.__pm._S.w.scheme.id);
      const snap = async () => { if (shot) { await wait(200); await p.screenshot({ path: shot }); } };
      if (sc === 'denial') { await wait(1000); await aimStroke(await target(await idx('slasher'), 0.75), 150, { dip: 45 }); await snap(); }
      else if (sc === 'lanejumper') {
        const jm = await p.evaluate(() => { const d = window.__pm._S.w.def.find(x => x.jumper); return d ? d.man : 2; });
        await G.tap(ax, ay); await wait(600); await aimStroke(await target(jm, 0.75), 150, { dip: 45 }); await snap();
      } else if (sc === 'rim') { await driveAt([-2, 0, 9], 1100); await aimStroke(await target(await idx('big'), 0.6), 330); await snap(); }
      else {
        await driveAt([6, 0, 10], 1100);
        if (!(await held())) { await snap(); return sc; }
        const hm = await p.evaluate(() => { const w = window.__pm._S.w; return w.help ? w.help.man : 1; });
        await aimStroke(await target(hm, 0.3), 100);
        await snap();
        if (sc === 'scramble') {
          for (let i = 0; i < 30 && !(await held()); i++) await wait(40);
          await wait(350);
          const fm = await p.evaluate(() => { const f = window.__pm._S.w.story.find(x => x.k === 'fly'); return f ? f.man : null; });
          if (fm != null && await held()) await aimStroke(await target(fm, 0.5), 120);
        }
      }
      return sc;
    }
    const plays = [
      async () => { await G.down(ax, ay); await wait(600); await p.screenshot({ path: `${OUT}/s05-vision-${tag}.png` }); await G.up(ax, ay); return rightRead(); },
      () => rightRead(`${OUT}/s06-pass-${tag}.png`),
      () => rightRead(), () => rightRead(), () => rightRead(), () => rightRead(),
      async () => { await wait(800); await aimStroke(await target(2, 0.4), 200, { curl: 40 }); return 'curl'; },
      async () => { await wait(13500); return 'clock'; }
    ];
    const playLog = [];
    for (let i = 0; i < 8; i++) {
      await untilPhase('live', 6000);
      await wait(200);
      const what = await plays[i]();
      const ok = await untilPhase('card', 16000);
      playLog.push(`${what}:${await p.evaluate(() => { const r = window.__pm._S.w.result; return r ? r.grade + (r.turnover ? ' ' + r.turnover : ' +' + r.points) : '-'; })}`);
      await wait(350);
      if (i < 2 || i === 7) await p.screenshot({ path: `${OUT}/s07-card${i + 1}-${tag}.png` });
      if (!ok) errors.push(`possession ${i + 1} never reached the card`);
      await p.click('.pmx-card .pmx-btn');
    }
    await wait(500);
    await overflow('results');
    await p.screenshot({ path: `${OUT}/s08-results-${tag}.png`, fullPage: true });
    const res = await p.evaluate(() => document.querySelector('#results .big') && document.querySelector('#results .big').textContent);
    // a featured challenge, read by read
    await p.click('#results [data-go="pm"].cta'); await wait(200);
    await p.click('[data-pmfeat="pf-corner"]');
    for (let i = 0; i < 6; i++) {
      await untilPhase('live', 6000); await wait(150);
      await rightRead();
      await untilPhase('card', 16000); await wait(250);
      await p.click('.pmx-card .pmx-btn');
    }
    await wait(400);
    const featured = await p.evaluate(() => document.querySelector('#results .big') && document.querySelector('#results .big').textContent);
    await p.click('#results [data-go="pm"].cta'); await wait(200);
    // every Draw It Up board, with its answer drawn
    const boards = {};
    for (const id of Object.keys(ANSWERS)) {
      await p.click(`[data-board="${id}"]`); await wait(300);
      const A = ANSWERS[id];
      const geo = await p.evaluate(([cut, pass]) => {
        const S = window.__pm._S, b = S.board, G = window.__pm._boardGeom();
        const P = (x, z) => ({ x: G.cx + x * G.s, y: G.top + z * G.s });
        return { from: cut ? P(b.off[cut[0]][0], b.off[cut[0]][1]) : null, path: cut ? cut[1].map(q => P(q[0], q[1])) : null, ball: P(b.off[b.holder][0], b.off[b.holder][1]), pass: P(pass[0], pass[1]) };
      }, [A.cut || null, A.pass]);
      if (id === 'denied') await p.screenshot({ path: `${OUT}/s09-board-${tag}.png` });
      if (geo.from) {
        await G.down(geo.from.x, geo.from.y);
        let last = geo.from;
        for (const q of geo.path) { for (let k = 1; k <= 6; k++) await G.move(last.x + (q.x - last.x) * k / 6, last.y + (q.y - last.y) * k / 6); last = q; }
        await G.up(last.x, last.y);
      }
      await p.click(`.pmx-board [data-type="${A.type}"]`);
      await G.down(geo.ball.x, geo.ball.y);
      for (let k = 1; k <= 8; k++) await G.move(geo.ball.x + (geo.pass.x - geo.ball.x) * k / 8, geo.ball.y + (geo.pass.y - geo.ball.y) * k / 8);
      await G.up(geo.pass.x, geo.pass.y);
      await wait(120);
      if (id === 'denied') await p.screenshot({ path: `${OUT}/s10-board-drawn-${tag}.png` });
      await p.click('.pmx-board [data-act="run"]');
      if (id === 'denied') { await wait(900); await p.screenshot({ path: `${OUT}/s11-board-run-${tag}.png` }); }
      await untilPhase('card', 12000); await wait(300);
      boards[id] = await p.evaluate(() => { const w = window.__pm._S.w; return w && w.result ? `${w.result.grade}${w.result.turnover ? ' ' + w.result.turnover : ''}${w.result.made ? ' +' + w.result.points : ''}` : 'none'; });
      if (id === 'denied' || id === 'fourseconds') await p.screenshot({ path: `${OUT}/s12-board-card-${id}-${tag}.png` });
      await p.click('.pmx-card [data-act="done"]'); await wait(250);
    }
    await overflow('playmaker screen after boards');
    await p.screenshot({ path: `${OUT}/s13-pm-after-${tag}.png`, fullPage: true });
    await p.click('#pm [data-go="home"]'); await wait(150);
    await p.click('[data-go="scout"]'); await wait(200);
    await overflow('scouting');
    await p.screenshot({ path: `${OUT}/s14-scout-${tag}.png`, fullPage: true });
    if (!cal.k) errors.push('the pass calibration was not saved');
    if (!(+res > 0)) errors.push('a game of right reads scored nothing');
    Object.entries(boards).forEach(([id, g]) => { if (!/^[AB]/.test(g)) errors.push(`whiteboard ${id}: the drawn answer graded ${g}`); });
    results[tag] = { calibration: cal, game: playLog.join(', '), gamePoints: res, featuredPoints: featured, boards, errors };
    await ctx.close();
  }
  console.log(JSON.stringify(results, null, 1));
  const bad = Object.values(results).some(r => r.errors.length);
  console.log(bad ? 'ERRORS' : 'ERRORS none');
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
