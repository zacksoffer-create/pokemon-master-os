// Blackthorn HQ inside a frame built the way Apps Script serves a web app: the page is written into a sandboxed inner
// frame on another origin, with <base target="_top">, so a link that tries to navigate does what it does there (the
// whole window lands on a blank page). Then it clicks every menu item, the in-app links on every page and the
// clickable rows and buttons, at desktop and phone width, and fails on any navigation away, page error or pop-up.
// Run: python3 -I app/build.py && node app/test_frame.mjs        (tests/test_engines.py runs it when Chromium is here)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); } catch (e2) { console.log('SKIP: Playwright is not installed'); process.exit(0); }
}
const preview = fs.readFileSync(path.join(HERE, 'dist', 'Blackthorn-HQ-preview.html'), 'utf8')
  .replace('return runner();\n})()}};', 'return runner();\n})(), history: window.__gs.history, url: window.__gs.url}};');
const EXEC = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe id="sandboxFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-downloads"></iframe>
<script>window.addEventListener('message', function (e) { var d = e.data || {}; if (d.gsh) history.replaceState(null, '', '#' + (d.hash || '')); });
document.getElementById('sandboxFrame').src = 'http://127.0.0.1:' + location.port + '/userCodeAppPanel.html?h=' + encodeURIComponent(location.hash.slice(1));</script></body></html>`;
const PANEL = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><script>
if (window.top !== window && window.top === window.parent) {
  var h = new URLSearchParams(location.search).get('h') || '';
  var f = document.createElement('iframe'); f.name = 'userHtmlFrame'; document.body.appendChild(f);
  fetch('app.html').then(function (r) { return r.text(); }).then(function (html) {
    var shim = '<base target="_top"><script>(function(){var handler=null;window.GS_LOG=[];function send(k,hash){window.GS_LOG.push([k,hash]);window.top.postMessage({gsh:k,hash:hash},"*");}' +
      'window.__gs={history:{push:function(s,p,hash){send("push",hash);},replace:function(s,p,hash){send("replace",hash);},setChangeHandler:function(fn){handler=fn;}},' +
      'url:{getLocation:function(cb){setTimeout(function(){cb({hash:' + JSON.stringify(h) + ',parameter:{},parameters:{}});},20);}},back:function(hash){handler&&handler({location:{hash:hash}});}};})();<\\/script>';
    var d = f.contentWindow.document; d.open(); d.write(html.replace('<head>', '<head>' + shim)); d.close();
  });
}</script></body></html>`;
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const body = u === '/exec.html' ? EXEC : u === '/userCodeAppPanel.html' ? PANEL : u === '/app.html' ? preview : null;
  if (body == null) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(body);
});
await new Promise((r) => server.listen(0, '0.0.0.0', r));
const port = server.address().port;
const browser = await chromium.launch();
const failures = [];
let pagesSeen = 0, clicks = 0;
for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('dialog', (d) => { errors.push('a browser dialog (' + d.type() + ') the frame may block'); d.dismiss(); });
  page.on('popup', (p) => { errors.push('popup ' + p.url()); p.close(); });
  const app = () => page.frames().find((f) => f.name() === 'userHtmlFrame');
  const home = `http://localhost:${port}/exec.html`;
  const settled = async () => { const t = Date.now(); while (Date.now() - t < 120000) { const f = app(); if (!f) return 'gone';
    const st = await f.evaluate(() => { const p = document.getElementById('page'); if (!p || /^\s*Opening…\s*$/.test(p.innerText)) return 'opening';
      return document.querySelector('#blprog .notice .bar, #advprog .notice .bar') ? 'building' : 'ok'; }).catch(() => 'err');
    if (st === 'ok') return 'ok'; await page.waitForTimeout(150); } return 'timeout'; };
  await page.goto(home + '#/');
  if (await settled() !== 'ok') { failures.push(`${width}px: the app never opened`); continue; }
  const navs = await app().evaluate(() => [...document.querySelectorAll('.rail a[data-nav]')].map((a) => a.getAttribute('href')));
  for (const h of navs) {
    if (width < 800) { await app().click('.menu-btn'); await page.waitForTimeout(450); }
    const before = errors.length;
    await app().click(`.rail a[href="${h}"]`);
    const st = await settled();
    if (!page.url().startsWith(home) || !app()) { failures.push(`${width}px ${h}: the window left the app (${page.url()})`); await page.goto(home + '#/'); await settled(); continue; }
    if (st !== 'ok') failures.push(`${width}px ${h}: ${st}`);
    pagesSeen++;
    const links = await app().evaluate(() => [...new Set([...document.querySelectorAll('#page a[href^="#/"]')].map((a) => a.getAttribute('href')))].slice(0, 3));
    const nClick = await app().evaluate(() => document.querySelectorAll('#page tr.click, #page [data-place], #page [data-bltab], #page [data-opp], #page summary').length);
    for (let i = 0; i < Math.min(nClick, 3); i++) {
      await app().evaluate((i) => { const el = document.querySelectorAll('#page tr.click, #page [data-place], #page [data-bltab], #page [data-opp], #page summary')[i]; if (el) el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true})); }, i);
      clicks++; await settled();
      if (!page.url().startsWith(home) || !app()) { failures.push(`${width}px ${h}: a click took the window out of the app`); await page.goto(home + '#/'); await settled(); break; }
      await app().evaluate(() => { if (typeof closeDrawer === 'function') closeDrawer(); });
      await app().evaluate((h) => nav(h), h); await settled();
    }
    for (const l of links) {
      const a = await app().$(`#page a[href="${l}"]`); if (!a) continue;
      await a.click(); clicks++; const s2 = await settled(); pagesSeen++;
      if (!page.url().startsWith(home) || !app()) { failures.push(`${width}px ${h} → ${l}: the window left the app`); await page.goto(home + '#/'); await settled(); break; }
      if (s2 !== 'ok') failures.push(`${width}px ${l}: ${s2}`);
      const hash = await app().evaluate(() => NAVI.hash); if (hash.split('?')[0] !== l.split('?')[0] && !/^#\/(scoutlab|battlelab|builds\/lab)/.test(l)) failures.push(`${width}px ${l}: landed on ${hash}`);
      await app().evaluate((h) => nav(h), h); await settled();
    }
    const bad = await app().evaluate(() => { const t = document.getElementById('page').innerText; const m = t.match(/.{0,60}Something went wrong.{0,120}/); return m ? m[0] : null; });
    if (bad) failures.push(`${width}px ${h}: ${bad}`);
    if (errors.length > before) failures.push(`${width}px ${h}: ${errors.slice(before).join(' | ')}`);
  }
  const wide = await app().evaluate(() => document.documentElement.scrollWidth);
  if (wide > width + 1) failures.push(`${width}px: the page is ${wide}px wide`);
  await page.close();
}
await browser.close();
server.close();
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log(`ok: ${pagesSeen} pages and ${clicks} clicks inside an Apps Script-style frame at 1440 and 390 px; the window never left the app`);
