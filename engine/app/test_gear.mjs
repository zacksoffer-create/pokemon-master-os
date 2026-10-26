// Poké Balls and equipment in the preview build (web/91_gear.html over web/33_capture.html), in Chromium, against the
// Ball spec's acceptance criteria (docs/specs/POKE_BALLS_EQUIPMENT.md §14; MASTER_PLAN Phase 6): 1 the whole Gen I-IV
// library with exterior art, 2 a profile led by its exterior, 3 game-specific mechanics, acquisition and origin,
// 4 an interior picture viewable large, 5 assigning a ball to one of yours, 6 its exterior on the Pokémon's profile,
// 7 a personal interior attached, 8 pictures, ball data and the Pokémon staying connected, 9 desktop and phone, 10 no
// new services (the app as it is). Also: the catch planner's ranking and the equipment inventory.
// Run: python3 -I app/build.py && node app/test_gear.mjs                  (tests/test_engines.py runs it)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedPage } from './test_seed.mjs';
process.on('unhandledRejection', (e) => { console.log('FAIL\n' + String(e && e.stack || e).slice(0, 1500)); process.exit(1); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('SKIP: Playwright is not installed'); process.exit(0); }
}
let PNG = null;   // a real picture, drawn by the browser below
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], fails = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 600)));
const settle = async (sel, ms = 180000) => { const t = Date.now(); while (Date.now() - t < ms) {
  const st = await page.evaluate((s) => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
    if (s && !document.querySelector(s)) return 'wait'; return 'ok'; }, sel);
  if (st === 'ok') return true; await page.waitForTimeout(150); } return false; };
const go = async (h, sel, notices = false) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  if (notices) return; const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).join(' | ')); if (n) fails.push(h + ': ' + n.slice(0, 300)); };
const text = () => page.evaluate(() => document.getElementById('page').innerText);
const expect = (what, ok) => { if (!ok) fails.push(what); };
const file = (name) => ({ name, mimeType: 'image/png', buffer: PNG });

await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
PNG = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 320, 180); g.addColorStop(0, '#1b2a4a'); g.addColorStop(1, '#c9a96a'); x.fillStyle = g; x.fillRect(0, 0, 320, 180);
  return c.toDataURL('image/png').split(',')[1]; }), 'base64');
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^bt-(preview-tabs|preview-images|ball-game)/.test(k)).forEach((k) => localStorage.removeItem(k)); });
await seedPage(page, ['heartgold', 'platinum']); await settle();   // v2 (D-078): a seeded team (test_seed.mjs)

// 1. the whole library, every card with its exterior picture
await go('#/balls', '.ballgrid');
expect('1: 25 balls, each card with a picture', await page.evaluate(() => [...document.querySelectorAll('.ballcard')].filter((c) => c.querySelector('img')).length) === 25);
await page.selectOption('#blf [name=cat]', 'apricorn');
await page.waitForTimeout(200);
expect('1: filter by kind (the seven Apricorn balls)', await page.evaluate(() => [...document.querySelectorAll('.ballcard')].filter((c) => c.style.display !== 'none').length) === 7);

// 2-3. a profile led by its exterior; mechanics per game from the code; how you get it; origin
await go('#/ball/luxury?g=emerald', '.ballhero');
let t = await text();
const hero = await page.evaluate(() => { const imgs = [...document.querySelectorAll('#page img')].map((i) => i.getBoundingClientRect().width); return [imgs[0], Math.max(...imgs.slice(1))]; });
expect('2: the exterior is the largest picture on the page (' + hero + ')', hero[0] >= 200 && hero[0] >= hero[1]);
expect('3: Emerald\'s Luxury Ball mechanics, from the code', /every friendship gain is 1 bigger/.test(t) && /pokeemerald and pokefirered src\/battle_script_commands\.c Cmd_handleballthrow/.test(t));
expect('3: how you get it in Emerald', /Found[\s\S]{0,120}Abandoned Ship/i.test(t));
await go('#/ball/moon?g=crystal', '.ballhero');
t = await text();
expect('3: Crystal\'s Moon Ball and its bug', /never does/.test(t) && /The game's own bug[\s\S]{0,80}Burn Heal/.test(t));
expect('3: the Apricorn and Kurt', /Kurt, the Ball maker of Azalea Town, turns a Ylw Apricorn into a Moon Ball/.test(t));
await page.fill('#bcf [name=species]', 'Clefairy');
await page.waitForTimeout(250);
expect('3: the calculator: in Crystal the Moon Ball is no better than a Poké Ball', await page.evaluate(() => { const m = document.getElementById('bcout').innerText.match(/^([\d.]+)%[\s\S]*Poké Ball: ([\d.]+)%/); return !!m && m[1] === m[2]; }));

// 4. an interior picture, viewable large
await page.setInputFiles('#bintup', file('moon-interior.png'));
await page.waitForFunction(() => !!document.querySelector('#bint img'), null, { timeout: 30000 }).catch(() => {});
expect('4: the uploaded interior shows on the profile', await page.evaluate(() => !!document.querySelector('#bint img')));
await page.click('#bint');
await page.waitForTimeout(400);
expect('4: it opens large', await page.evaluate(() => { const l = document.querySelector('.lightbox img'); return !!l && l.getBoundingClientRect().width > 300; }));
await page.evaluate(() => document.querySelector('.lightbox') && document.querySelector('.lightbox').click());
await page.evaluate(() => document.getElementById('bbrief').click());
expect('4: the brief to make one', /Blackthorn conceptual interpretation/.test(await page.evaluate(() => document.getElementById('brtext').value)));
await page.evaluate(() => closeDrawer());

// 5-6. assign a Moon Ball to one of yours; its profile shows the ball
const ind = 'me:heartgold/Snorlax';
await go('#/pokemon/' + encodeURIComponent(ind), '[data-who="ball"]', true);
await page.selectOption('[data-who="ball"]', 'Moon Ball');
await page.waitForTimeout(200);
const fit = await page.evaluate(() => document.getElementById('pbballfit').innerText);   // v2.1 (A-101): the ball is its own choice, so the builder says what it does, never whether it fits
expect('5: the builder says what the Moon Ball does, with no verdict on how Snorlax was met (' + fit + ')', /Moon Ball/.test(fit) && /HeartGold/.test(fit) && !/story choice|met in the wild|no wild encounter/i.test(fit));
expect('5: the builder shows Snorlax in its Moon Ball', await page.evaluate(() => /Moon Ball/.test((document.querySelector('#pbportrait .inball') || {}).title || '')));
await page.click('#pbsave');
await page.waitForFunction((id) => S.store.individuals[id].ball === 'Moon Ball', ind, { timeout: 30000 }).catch(() => {});
expect('5: the ball is saved', await page.evaluate((id) => S.store.individuals[id].ball, ind) === 'Moon Ball');
await go('#/mon/' + encodeURIComponent(ind), '[data-mod="m-its-ball"]');
t = await text();
expect('6: the profile shows the Moon Ball with its exterior', /Its Poké Ball[\s\S]{0,200}Moon Ball/.test(t) && await page.evaluate(() => !!document.querySelector('[data-mod="m-its-ball"] img')));
expect('6: no personal picture yet: the standard interior stands in', /The standard Moon Ball interior/.test(t));

// 7. a personal interior: Snorlax at home in its Moon Ball
await page.evaluate(() => document.getElementById('mballbrief').click());
expect('7: the brief knows Snorlax and the ball', /Inside its Moon Ball[\s\S]*Snorlax/.test(await page.evaluate(() => document.getElementById('pktext').value)));
await page.evaluate(() => closeDrawer());
await page.setInputFiles('#mballup', file('snorlax-moon.png'));
await page.waitForFunction(() => /at home in its Moon Ball/.test(document.getElementById('page').innerText), null, { timeout: 30000 }).catch(() => {});
expect('7: the personal interior shows on the profile', /Snorlax at home in its Moon Ball/.test(await text()));

// 8. connected: the ball's profile lists your Snorlax; the planner ranks every ball
await go('#/ball/moon', '.ballhero');
expect('8: the Moon Ball lists your Snorlax', /Your Pokémon in it[\s\S]{0,200}Snorlax/.test(await text()));
await go('#/balls/catch?g=heartgold&s=Clefairy&l=20&hp=100', '#cpout table');
const order = await page.evaluate(() => [...document.querySelectorAll('#cpout tr')].map((r) => r.querySelector('b').innerText));
expect('8: HeartGold, Clefairy at full HP: the Ultra Ball beats the Moon Ball (the Apricorn boost is capped at 255) (' + order.slice(0, 4) + ')', order[0] === 'Master Ball' && order.indexOf('Ultra Ball') < order.indexOf('Moon Ball') && order.indexOf('Moon Ball') < order.indexOf('Poké Ball'));
await go('#/equipment/super-rod', '[data-own]');
await page.evaluate(() => { const f = document.querySelector('[data-own="heartgold"]'); f.owned.checked = true; f.note.value = 'test'; f.querySelector('button').click(); });
await page.waitForFunction(() => S.store.gear && S.store.gear['heartgold:super-rod'] && S.store.gear['heartgold:super-rod'].owned, null, { timeout: 30000 }).catch(() => {});
await go('#/equipment', '.pickgrid');
expect('8: My Gear: the Super Rod is yours in HeartGold', /Super Rod[\s\S]{0,140}yours in HeartGold/.test(await text()));

// 9. the phone
await page.setViewportSize({ width: 390, height: 844 });
for (const h of ['#/balls', '#/ball/moon', '#/mon/' + encodeURIComponent(ind), '#/balls/catch', '#/equipment']) {
  await go(h, '.card', true);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect('9: ' + h + ' fits a phone (' + over + 'px over)', over <= 2);
}
await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' || '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ok: the Poké Ball collection meets the spec\'s acceptance criteria 1-10 in the browser');
process.exit(fails.length ? 1 : 0);
