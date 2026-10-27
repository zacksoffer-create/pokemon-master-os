// Plays every Lockdown mode through the real app (home card, mode screen,
// drills, featured, results, scouting book) with a defender bot driving real
// pointer events, at 390x844 and 430x932. Screenshots, page errors and any
// sideways overflow.
const { chromium } = require('playwright');
const page = require('./harness');
const OUT = process.argv[2] || '/tmp/dfx-smoke';
require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, label, extra) => { if (!ok) fails++; console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (extra ? '  ' + extra : '')); };

// a decent defender, as fingers on glass: slide on the tell, swipe the lazy cross,
// stay down on fakes, go up with the shot, hold still on a rim attack, box out
const BOT = `(() => {
  const st = window.__bs = { on: true, down: false, slid: 0, jumped: 0, sliced: 0, lastW: null, x: 195, y: 700 };
  const down = () => { if (!st.down) { window.__dfDown(195, 700); st.down = true; st.x = 195; st.y = 700; } };
  const up = () => { if (st.down) { window.__dfUp(st.x, st.y); st.down = false; } };
  const move = (x, y) => { st.x = x; st.y = y; window.__dfMove(x, y); };
  const flick = () => { up(); const x = 195; window.__dfg([{ x, y: 720, t: 0 }, { x, y: 680, t: 15 }, { x, y: 620, t: 30 }, { x, y: 540, t: 50 }, { x, y: 539, t: 51 }]); };
  function tick() {
    if (!st.on) return;
    const E = window.__engine && window.__engine();
    const S = E && E._S, w = S && S.w;
    if (w && w !== st.lastW) { up(); st.lastW = w; st.slid = st.jumped = st.sliced = 0; }
    if (S && S.phase === 'card') { const b = document.querySelector('.dfx-card .dfx-btn'); if (b && !st.clicked) { st.clicked = true; setTimeout(() => { b.click(); st.clicked = false; }, 450); } }
    if (S && S.phase === 'live' && w && !w.over) {
      const a = w.off.act, RB = w.rebound;
      if (w.phase === 'duel' && !w.you.chasing) {
        if (a && a.k === 'drive' && !st.slid) { st.slid = a.side; down(); }
        if (st.slid && st.down) { const k = Math.min(1, (st.x - 195) / 110 * st.slid + 0.12); move(195 + st.slid * 110 * k, 700); if (!a || a.k !== 'drive') { up(); st.slid = 0; } }
        if (a && a.k === 'cross' && a.kind === 'front' && a.t > a.T * 0.42 && !st.sliced && w.arch.id === 'loose') { st.sliced = 1; const b = E._ballScreen(); if (b) window.__dfg([{ x: b.x - 90, y: b.y, t: 0 }, { x: b.x - 30, y: b.y, t: 15 }, { x: b.x + 30, y: b.y, t: 30 }, { x: b.x + 90, y: b.y, t: 45 }, { x: b.x + 91, y: b.y, t: 46 }]); }
        if (a && a.k === 'rise' && a.ph === 'gather' && !st.jumped && w.arch.id !== 'pump') { st.jumped = 1; flick(); }
        if (a && a.k === 'rise' && a.ph === 'up' && !st.jumped) { st.jumped = 1; flick(); }
        if (a && a.k === 'attack') down();
      } else if (RB && !w.over) {
        down();
        if (RB.boxing && !RB.sealed && !RB.lost && RB.sideAt != null && w.t > RB.sideAt + 0.06) move(195 + RB.side * 100, 700);
        else if ((RB.sealed || RB.lost) && RB.pred) {
          const Y = w.you.pos, f = E._fingerFor(RB.pred.p);
          if (f) move(f.x, f.y);
          const B = w.ball; if (B.ph && B.ph.v[1] < 0 && B.p[1] < 11.3 && B.p[1] > 9 && Math.hypot(B.p[0] - Y[0], B.p[2] - Y[2]) < 2.6 && !st.jumped) { st.jumped = 1; flick(); }
        }
      } else if (w.you.chasing && w.shotInfo == null && a && a.k === 'finish' && a.ph === 'gather' && !st.jumped) { st.jumped = 1; flick(); }
    }
    requestAnimationFrame(tick);
  }
  tick();
})()`;

async function pass(W, H, full) {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, ignoreHTTPSErrors: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.setContent(page('basketball-playground.html'), { waitUntil: 'networkidle' });
  await require('./dfxgest')(p);
  const tag = `${W}`;
  const shot = name => p.screenshot({ path: `${OUT}/s-${tag}-${name}.png` });
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  const wait = ms => p.waitForTimeout(ms);
  // the engine the app created (it lives in a closure; find it through its canvas owner)
  await p.evaluate(() => { window.__engine = () => window.__dfxE; });
  await shot('home');
  check(!(await overflow()), `${tag}: home fits`);
  await p.click('[data-go="dfx"]'); await wait(250);
  await shot('mode');
  check(!(await overflow()), `${tag}: Lockdown screen fits`);
  // grab the engine as soon as the app makes it
  async function play(selector, label, maxMs) {
    await p.click(selector);
    await wait(100);
    await p.evaluate(() => {
      // the app's engine is the only LockdownEngine in the page: wrap create once to keep a handle
      if (!window.__dfxE) { const S = document.querySelector('.dfx'); window.__dfxE = S && S.__engine; }
    });
    const t0 = Date.now();
    let seenCard = false, shots = 0;
    while (Date.now() - t0 < maxMs) {
      const s = await p.evaluate(() => { const r = document.querySelector('#results'); const g = document.querySelector('#dfxgame'); return { results: r && !r.hidden, game: g && !g.hidden, card: !!document.querySelector('.dfx-card:not([hidden])') }; });
      if (s.card && !seenCard && shots < 1) { seenCard = true; shots++; await shot(`${label}-card`); }
      if (s.results && !s.game) break;
      await wait(250);
    }
    const res = await p.evaluate(() => { const r = document.querySelector('#results'); return r && !r.hidden ? { big: r.querySelector('.big') && r.querySelector('.big').textContent, rows: r.querySelectorAll('.prow').length } : null; });
    await shot(`${label}-results`);
    check(!!res, `${tag}: ${label} played to the results screen`, res ? `${res.big} · ${res.rows} rows` : '');
    check(!(await overflow()), `${tag}: ${label} results fit`);
    await p.click('#results [data-go="dfx"].cta, #results .cta.ghost'); await wait(200);
    return res;
  }
  // keep a handle on the engine: patch LockdownEngine.create before the first game
  await p.evaluate(() => { const orig = LockdownEngine.create; LockdownEngine.create = (...a) => { const e = orig(...a); window.__dfxE = e; return e; }; });
  await p.evaluate(BOT => { eval(BOT); }, BOT);
  if (full) {
    // the main mode, mid-possession shots along the way
    await p.click('[data-dfx="play"]');
    await wait(900); await shot('intro');
    await wait(1200); await shot('live');
    const t0 = Date.now(); let gotShot = false, gotRim = false;
    while (Date.now() - t0 < 150000) {
      const s = await p.evaluate(() => { const E = window.__dfxE, S = E && E._S, w = S && S.w; const r = document.querySelector('#results'); return { results: r && !r.hidden && document.querySelector('#dfxgame').hidden, cam: w && w.cam, wph: w && w.phase }; });
      if (!gotShot && s.wph === 'shot') { gotShot = true; await wait(250); await shot('shot'); }
      if (!gotRim && s.wph === 'rebound') { gotRim = true; await shot('rebound'); }
      if (s.results) break;
      await wait(200);
    }
    const res = await p.evaluate(() => { const r = document.querySelector('#results'); return r && !r.hidden ? { big: r.querySelector('.big').textContent, rows: r.querySelectorAll('.prow').length, iq: r.querySelector('.stat b').textContent } : null; });
    await shot('lockdown-results');
    check(!!res && res.rows === 8, `${tag}: Lockdown, 8 possessions to the results`, res ? `${res.big} stops · IQ ${res.iq}` : '');
    check(!(await overflow()), `${tag}: results fit`);
    await p.click('#results .cta.ghost'); await wait(200);
    await play('[data-dfxdrill="pickpocket"]', 'pickpocket', 120000);
    await play('[data-dfxdrill="swat"]', 'swat', 120000);
    await play('[data-dfxdrill="glass"]', 'glass', 120000);
    await play('[data-dfxfeat="df-glass"]', 'featured', 120000);
    await shot('mode-after');
    const rec = await p.evaluate(() => document.querySelector('#dfx-drills').textContent);
    check(/best/.test(rec), `${tag}: drill bests recorded`);
  } else {
    // one possession, then out through the X
    await p.click('[data-dfx="play"]');
    await wait(2600); await shot('live');
    for (let i = 0; i < 60; i++) { const c = await p.evaluate(() => !!document.querySelector('.dfx-card:not([hidden])')); if (c) break; await wait(250); }
    await shot('card');
    await p.click('.dfx-quit'); await wait(300);
    await shot('quit-results');
    check(await p.evaluate(() => !document.querySelector('#results').hidden), `${tag}: quitting after a possession shows its results`);
    check(!(await overflow()), `${tag}: results fit`);
    await p.click('#results .cta.ghost'); await wait(200);
  }
  await p.evaluate(() => { window.__bs.on = false; });
  await p.click('#dfx [data-go="home"]'); await wait(150);
  await p.click('[data-go="scout"]'); await wait(200);
  await p.evaluate(() => document.querySelector('#scorer-list').scrollIntoView());
  await shot('scout');
  check(await p.evaluate(() => document.querySelectorAll('#scorer-list .scard').length === LockdownScorers.IDS.length), `${tag}: scouting book lists every scorer`);
  check(!(await overflow()), `${tag}: scouting book fits`);
  console.log(`${tag} errors`, errors.length ? errors.slice(0, 5) : 'none');
  if (errors.length) fails++;
  await browser.close();
}
(async () => {
  await pass(390, 844, true);
  await pass(430, 932, false);
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exitCode = fails ? 1 : 0;
})();
