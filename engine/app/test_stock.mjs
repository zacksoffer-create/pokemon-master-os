// The breeding-stock pages in the preview build (web/88_stock.html over web/23_stock.html), in Chromium: the spec's
// four questions answer (what a line can start with, how to make an exact set, what makes two sets different, what a
// set might suggest), a blueprint saves and versions, a hatch is recorded and keeps its moves, the Mamoswine line reads
// Ancient Power's other routes (B27), and Crystal's Swinub has no Mamoswine (B26).
// Run: python3 -I app/build.py && node app/test_stock.mjs                  (tests/test_engines.py runs it)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.on('unhandledRejection', (e) => { console.log('FAIL\n' + String(e && e.stack || e).slice(0, 1500)); process.exit(1); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('SKIP: Playwright is not installed'); process.exit(0); }
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [], fails = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 600)));
const settle = async (sel, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) {
  const st = await page.evaluate((s) => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
    if (s && !document.querySelector(s)) return 'wait'; const r = document.getElementById('stres'); if (r && /^\s*Reading…\s*$/.test(r.innerText)) return 'reading'; return 'ok'; }, sel);
  if (st === 'ok') return true; await page.waitForTimeout(150); } return false; };
const go = async (h, sel, notices = false) => { await page.evaluate((x) => nav(x), h); if (!await settle(sel)) fails.push(h + ': never settled (waiting for ' + sel + ')');
  if (!notices) { const n = await page.evaluate(() => [...document.querySelectorAll('#page .notice')].map((x) => x.innerText).join(' | ')); if (n) fails.push(h + ': ' + n.slice(0, 300)); } };
const text = () => page.evaluate(() => document.getElementById('page').innerText);
const expect = (what, ok) => { if (!ok) fails.push(what); };

await page.goto('file://' + path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html') + '#/');
await settle();
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^bt-(preview-tabs|draft:stock)/.test(k)).forEach((k) => localStorage.removeItem(k)); });

// 1. what can a line's eggs start with?
await go('#/stock', '#stpick');
expect('the stock page lists its four answers', /Possible/.test(await text()) && /Documented/.test(await text()));
await go('#/stock/heartgold/Tyranitar', '.card');                       // the adult reads what hatches
let t = await text();
expect('Tyranitar opens the Larvitar catalogue', /What a Larvitar egg can start with/.test(t));
expect('the catalogue lists Dragon Dance and its fathers', /Dragon Dance/.test(t) && /Carried together by one father/.test(t));
expect('B27: Outrage is also learnable without breeding', /Outrage[\s\S]{0,400}Also learnable without breeding: the move tutor teaches it \(Tyranitar\)/.test(t));
await go('#/stock/heartgold/Swinub', '.card');
expect('Swinub: Piloswine needs Ancient Power to evolve', /Piloswine evolves into Mamoswine only while it knows Ancient Power/.test(await text()));
await go('#/stock/crystal/Swinub', '.card');
expect('B26: Crystal has no Mamoswine', !/Mamoswine/.test(await text()));

// 2. how do I make this exact set?
await go('#/stock/heartgold/Swinub/design?m=' + ['Ancient Power', 'Hail', 'Bite', 'Powder Snow'].map(encodeURIComponent).join('|'), '#stres .card');
t = await text();
expect('the Swinub set is possible and obtainable', /1 · Possible under the hatch rules[^\n]*\n?[^\n]*Yes/.test(t) && /2 · Obtainable in the generation[\s\S]{0,80}Yes/.test(t));
expect('the egg lists four slots', (t.match(/slot \d/g) || []).length === 4);
expect('the father\'s lineage reads as steps', /The father's lineage/.test(t) && /Breed the last father/.test(t));
await page.selectOption('#stform [name=ability]', 'Snow Cloak');
await page.waitForTimeout(500);
t = await text();
expect('what it might suggest: Hail and Snow Cloak, and Ancient Power for Mamoswine', /Hail and Snow Cloak/.test(t) && /Ancient Power is what lets Piloswine become Mamoswine/.test(t));
expect('interpretation is not invented', /draws no conclusion/.test(t));
await page.fill('#stform [name=name]', 'Cold-adapted test');
await page.fill('#stform [name=labels]', 'hail, test');
await page.click('#stform [data-save=new]');
await settle('#sthatch');
const bpId = await page.evaluate(() => decodeURIComponent((NAVI.hash.match(/#\/stock\/bp\/(.+)$/) || [])[1] || ''));
expect('saving opens the blueprint (' + bpId + ')', /^yours:Swinub-/.test(bpId));
// a second version: Bite becomes Take Down (saved moves are in hatch order, so find Bite's slot)
const biteAt = await page.evaluate(() => [...document.querySelectorAll('#stform [data-mv]')].findIndex((x) => x.value === 'Bite'));
await page.selectOption('#stform [data-mv="' + biteAt + '"]', 'Take Down');
await page.waitForTimeout(400);
await page.click('#stform [data-save=next]');
await page.waitForFunction((id) => Records.versions(id).length === 2 && /Save as v3/.test(document.getElementById('page').innerText), bpId, { timeout: 60000 }).catch(() => {});
await settle('#sthatch');
const nv = await page.evaluate((id) => Records.versions(id).length, bpId);
expect('a save adds a version and keeps the old one (' + nv + ')', nv === 2);
// 3. record a hatch: its hatch moves stay
await page.click('#sthatch');
await settle('.mhero');
t = await text();
expect('the hatched Pokémon shows what it hatched with', /Where it came from/.test(t) && /Hatched with/.test(t) && /Bred to the blueprint/.test(t));
await go('#/stock/bp/' + encodeURIComponent(bpId), '#stres .card');
expect('the blueprint is documented now', /4 · Documented in your collection[\s\S]{0,60}Yes/.test(await text()));

// 4. what makes two sets different?
await go('#/stock/heartgold/Swinub/design?m=' + ['Ancient Power', 'Hail'].map(encodeURIComponent).join('|'), '#stres .card');
await page.click('#stform [data-save=new]');
await settle('#sthatch');
const bp2 = await page.evaluate(() => decodeURIComponent((NAVI.hash.match(/#\/stock\/bp\/(.+)$/) || [])[1] || ''));
await go('#/stock/compare/' + encodeURIComponent(bpId) + '/' + encodeURIComponent(bp2), '.card');
t = await text();
expect('compare names the differences', /What makes these two different/.test(t) && /The (first|second) starts with/.test(t));
await go('#/stock', '#stpick');
expect('your blueprints are listed', /Cold-adapted test/.test(await text()));

// possible is not obtainable
await go('#/stock/heartgold/Larvitar/design?m=' + ['Dragon Dance', 'Pursuit'].map(encodeURIComponent).join('|'), '#stres .card', true);
t = await text();
expect('Dragon Dance with Pursuit: possible, not obtainable', /1 · Possible under the hatch rules[\s\S]{0,60}Yes/.test(t) && /2 · Obtainable in the generation[\s\S]{0,60}No/.test(t));

// the breeding lab's Mamoswine line reads through the stock engine (B27 included)
await go('#/lines/mamoswine-ancient-power', '.card');
t = await text();
expect('the Mamoswine line: Ancient Power is an egg move and also the tutor', /Ancient Power[\s\S]{0,200}egg move[\s\S]{0,300}Also learnable without breeding:[^\n]*tutor/.test(t));
expect('the Mamoswine line: Hail comes from the father\'s TM', /Hail[\s\S]{0,80}father's TM/.test(t));
expect('the Mamoswine line: Piloswine needs Ancient Power', /Piloswine evolves into Mamoswine only while it knows Ancient Power/.test(t));

await browser.close();
if (errors.length) fails.push('page errors: ' + errors.join(' || '));
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ok: breeding stock answers the four questions, saves, versions, hatches and compares');
process.exit(fails.length ? 1 : 0);
