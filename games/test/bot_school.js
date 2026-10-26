// Plays a whole Living School semester with random choices. Basketball and class
// microgames are stubbed so it runs fast. Fails on any page error or a stuck screen.
const { chromium } = require('playwright');
const page = require('./harness');
const SEED = Number(process.argv[2] || 1);
(async () => {
  const proxy = process.env.HTTPS_PROXY;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  await p.setContent(page('living-school.html'));
  await p.evaluate(seed => {
    let s = seed;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    HoopsEngine.create = () => ({
      setSettings() {}, stop() {},
      run(spec, h) {
        setTimeout(() => {
          const n = spec.kind === 'possessions' ? spec.count : spec.kind === 'shots' ? spec.shots.length : 5;
          const makes = Math.floor(Math.random() * (n + 1));
          const log = Array.from({ length: spec.count || 0 }, () => ({ points: Math.random() < 0.5 ? 2 : 0, grade: 'B' }));
          h.onEnd({ kind: spec.kind, points: log.reduce((a, b) => a + b.points, 0), makes, attempts: n, readIQ: 60, log, won: Math.random() < 0.5, letters: { you: 2, cpu: 5 }, touchK: spec.calibrate ? 1.7 : undefined });
        }, 5);
      }
    });
    Micro.run = (id, el, o, done) => setTimeout(() => done(Math.random(), 'stub'), 5);
  }, SEED);
  const stats = { steps: 0, acts: {} };
  let lastSig = '', same = 0;
  for (let i = 0; i < 4000; i++) {
    const info = await p.evaluate(() => {
      const S = window.__school;
      const st = S.st, v = S.view;
      const btns = Array.from(document.querySelectorAll('#app [data-act], #app [data-pick]')).filter(b => !b.disabled && b.offsetParent !== null).map((b, i) => ({ i, act: b.dataset.act || 'pick:' + b.dataset.pick }));
      const wide = document.documentElement.scrollWidth > window.innerWidth + 1 ? (v && v.type) : null;
      return { wide, type: v && v.type, day: st ? st.day : -1, slot: st ? st.slot : -1, ended: st ? st.ended : false, btns, sig: (v && v.type) + '|' + (st ? st.day + '.' + st.slot + '.' + st.phase : '') + '|' + document.querySelector('#app').textContent.length };
    });
    if (info.wide) { stats.wide = stats.wide || {}; stats.wide[info.wide] = (stats.wide[info.wide] || 0) + 1; }
    if (info.type === 'yearbook') { stats.done = true; if (process.argv[3]) await p.screenshot({ path: process.argv[3], fullPage: true }); break; }
    if (!info.btns.length) { await p.waitForTimeout(30); same++; if (same > 50) { stats.stuck = info; break; } continue; }
    if (info.sig === lastSig) same++; else { same = 0; lastSig = info.sig; }
    if (same > 40) { stats.stuck = info; break; }
    let choices = info.btns.filter(b => !['new', 'back', 'quit-title'].includes(b.act));
    if (info.type === 'title') choices = info.btns.filter(b => b.act === 'continue' || b.act === 'new').slice(0, 1);
    if (info.type === 'create') choices = info.btns.filter(b => b.act === 'enroll');
    if (!choices.length) choices = info.btns;
    // lean toward talking so relationships move
    if (info.type === 'beat' && Math.random() < 0.9) choices = choices.slice(0, 1);
    const talk = choices.filter(b => b.act === 'talk' || b.act === 'card');
    const pickFrom = talk.length && Math.random() < 0.55 ? talk : choices;
    const c = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    stats.acts[c.act] = (stats.acts[c.act] || 0) + 1;
    await p.evaluate(i => { const bs = Array.from(document.querySelectorAll('#app [data-act], #app [data-pick]')).filter(b => !b.disabled && b.offsetParent !== null); bs[i] && bs[i].click(); }, c.i);
    stats.steps++;
    // sometimes check the phone and accept invites
    if (Math.random() < 0.04) {
      await p.click('#phone-btn').catch(() => {});
      for (const t of ['people', 'cal', 'me', 'msgs']) await p.click(`[data-t="${t}"]`).catch(() => {});
      const inv = await p.$('[data-act="inv-yes"]'); if (inv && Math.random() < 0.6) await inv.click(); else await p.click('[data-act="phone-close"]').catch(() => {});
    }
    await p.waitForTimeout(8);
  }
  const summary = await p.evaluate(() => {
    const st = window.__school.st;
    return {
      day: st.day, ended: st.ended, team: st.player.team, season: st.season.w + '-' + st.season.l, date: st.player.date, gpa: SchoolSim.gpa(st),
      stats: Object.fromEntries(Object.entries(st.player.stats).map(([k, v]) => [k, Math.round(v)])),
      friends: Object.fromEntries(Object.entries(st.npcs).map(([k, n]) => [k, Math.round(n.friend) + (n.romance ? '/r' + Math.round(n.romance) : '') + ' m' + n.mem.length])),
      couples: st.couples.map(c => c.join('+')), gossip: st.gossip.length, inbox: st.inbox.length, seen: Object.keys(st.seen), journal: st.journal.length
    };
  });
  console.log(JSON.stringify(stats.done ? 'COMPLETED' : 'NOT COMPLETED'), stats.steps, 'steps');
  if (stats.stuck) console.log('STUCK', JSON.stringify(stats.stuck));
  console.log('OVERFLOW', stats.wide ? JSON.stringify(stats.wide) : 'none');
  console.log(JSON.stringify(summary, null, 1));
  console.log('acts', JSON.stringify(stats.acts));
  console.log('ERRORS', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
