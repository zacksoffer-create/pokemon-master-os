// The browser side, measured in Chromium (Playwright): every preset, 100 battles, in a Web Worker and on the main
// thread, with the full build and the battle-only build; each run must play exactly the battles Node played (the
// fingerprint). Then a phone-like profile (iPhone viewport and user agent, the CPU slowed 4× and 6×), and the page
// inside a frame built the way Apps Script serves a web app (a sandboxed frame on another origin, the page written
// into an inner frame). Writes results/browser/perf.json and screenshots. Not a real iPhone: see TEST_REPORT.md.
// Run: node browser/build.mjs && node browser/test-browser.mjs [--quick]
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'results', 'browser');
const QUICK = process.argv.includes('--quick');
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch (e) {
  console.log('SKIP: Playwright is not installed'); process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

const EXEC = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body>
<iframe id="sandboxFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-downloads"></iframe>
<script>document.getElementById('sandboxFrame').src = 'http://127.0.0.1:' + location.port + '/userCodeAppPanel.html' + location.search;</script></body></html>`;
const PANEL = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><script>
var f = document.createElement('iframe'); f.name = 'userHtmlFrame'; document.body.appendChild(f);
var page = new URLSearchParams(location.search).get('page') || 'bench-slim.html';
fetch(page).then(function (r) { return r.text(); }).then(function (html) {
  var d = f.contentWindow.document; d.open(); d.write(html.replace('<head>', '<head><base target="_top">')); d.close();
});</script></body></html>`;

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/exec.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(EXEC); return; }
  if (u === '/userCodeAppPanel.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PANEL); return; }
  const file = path.join(DIST, path.basename(u));
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const bench = JSON.parse(fs.readFileSync(path.join(DIST, 'bench.json'), 'utf8'));
const PRESETS = Object.keys(bench.fingerprints);
const browser = await chromium.launch();
const rows = [], failures = [];

async function open(context, url) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('dialog', (d) => { errors.push(`a dialog (${d.type()})`); d.dismiss(); });
  const t0 = Date.now();
  await page.goto(url);
  return { page, errors, t0 };
}

async function runIn(frame, opts) {
  return frame.evaluate((o) => window.SixVSixBench.run(o), opts);
}

function record(where, build, opts, row, extra = {}) {
  const r = { where, build, preset: opts.preset, n: opts.n, mode: opts.mode, wall_ms: row.wall_ms,
              per_battle_ms: row.per_battle_ms, same_as_node: row.same_as_node, failures: row.failures, ...extra };
  rows.push(r);
  if (!row.same_as_node) failures.push(`${where} ${build} ${opts.preset} ${opts.mode}: not the battles Node played`);
  if (row.failures) failures.push(`${where} ${build} ${opts.preset}: ${row.failures} failed battles`);
  console.log(`${where.padEnd(22)} ${build.padEnd(6)} ${opts.preset.padEnd(32)} ${opts.mode.padEnd(6)} n=${opts.n} ` +
    `${(row.wall_ms / 1000).toFixed(2)} s  ${row.per_battle_ms} ms/battle  ${row.same_as_node ? 'same as Node' : 'DIFFERENT'}`);
}

// 1. Desktop: both builds, every preset, worker and main thread.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const [build, file] of [['full', 'bench.html'], ['slim', 'bench-slim.html']]) {
    const { page, errors, t0 } = await open(context, `http://127.0.0.1:${port}/${file}`);
    const load_ms = await page.evaluate(() => Math.round(performance.now()));
    rows.push({ where: 'desktop', build, load_ms, note: 'page ready (parse + engine start)' });
    for (const preset of QUICK ? PRESETS.slice(0, 1) : PRESETS) {
      for (const mode of ['worker', 'main']) {
        if (mode === 'main' && build === 'slim' && preset !== PRESETS[0]) continue;
        const opts = { preset, n: 100, mode };
        record('desktop', build, opts, await runIn(page, opts));
      }
    }
    if (build === 'full') await page.screenshot({ path: path.join(OUT, 'bench-desktop.png'), fullPage: true });
    if (errors.length) failures.push(`desktop ${build}: ${errors.join(' | ')}`);
    await page.close();
    void t0;
  }
  await context.close();
}

// 2. Phone-like: iPhone viewport and user agent, CPU slowed 4× and 6× (Chromium's CPU throttling, on the page).
for (const rate of QUICK ? [4] : [4, 6]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const { page, errors } = await open(context, `http://127.0.0.1:${port}/bench-slim.html`);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const reload = Date.now();
  await page.reload();
  await page.waitForFunction(() => !!window.SixVSixBench);
  rows.push({ where: `phone-like ${rate}× CPU`, build: 'slim', load_ms: Date.now() - reload, note: 'reload until ready, throttled' });
  for (const preset of QUICK ? PRESETS.slice(0, 1) : [PRESETS[0], PRESETS[2]]) {
    for (const mode of ['main', 'worker']) {
      const opts = { preset, n: 100, mode };
      record(`phone-like ${rate}× CPU`, 'slim', opts, await runIn(page, opts),
        mode === 'worker' ? { note: 'Chromium throttles the page thread; a worker may run unthrottled' } : {});
    }
  }
  if (rate === 4) await page.screenshot({ path: path.join(OUT, 'bench-phone.png'), fullPage: true });
  if (errors.length) failures.push(`phone ${rate}×: ${errors.join(' | ')}`);
  await context.close();
}

// 3. Inside a frame built the way Apps Script serves a web app.
for (const file of ['bench-slim.html', 'bench.html']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const { page, errors } = await open(context, `http://localhost:${port}/exec.html?page=${file}`);
  let frame = null;
  for (let i = 0; i < 200 && !frame; i++) {
    frame = page.frames().find((f) => f.name() === 'userHtmlFrame');
    if (frame && !(await frame.evaluate(() => !!window.SixVSixBench).catch(() => false))) frame = null;
    if (!frame) await page.waitForTimeout(100);
  }
  if (!frame) { failures.push(`apps-script frame ${file}: the page never started`); await context.close(); continue; }
  for (const mode of ['worker', 'main']) {
    const opts = { preset: PRESETS[0], n: 100, mode };
    try { record(`apps-script-style frame`, file === 'bench.html' ? 'full' : 'slim', opts, await runIn(frame, opts)); }
    catch (e) { failures.push(`apps-script frame ${file} ${mode}: ${String(e).slice(0, 200)}`); }
  }
  if (errors.length) failures.push(`apps-script frame ${file}: ${errors.join(' | ')}`);
  await context.close();
}

await browser.close();
server.close();
const report = {
  build: bench.build, chromium: browser.version?.() || 'chromium (Playwright)', host: `${os.cpus()[0]?.model?.trim()} · ${os.cpus().length} cores`,
  ran_at: new Date().toISOString(), rows, failures,
};
fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(report, null, 1) + '\n');
console.log(failures.length ? `\nFAIL\n  ${failures.join('\n  ')}` : '\nall browser runs played the same battles as Node');
process.exit(failures.length ? 1 : 0);
