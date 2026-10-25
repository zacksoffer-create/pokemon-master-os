// Builds the browser side (dist/, not committed):
//   dist/sixvsix.full.js     the whole simulator, legality checking included (Showdown's learnsets)
//   dist/sixvsix.battle.js   battles only: learnsets, legality tables and descriptions left out, so it can't check
//                            legality itself; it runs jobs whose teams were checked by Node or the full build
//   dist/bench.html          the bench page with the full build inside (one file, no network)
//   dist/bench-slim.html     the same page with the battle-only build
//   dist/lab.html            the 6v6 Lab: the full build, the lab pack (fixtures/lab/pack.json) and a recorded Node run
//                            of each journey team's league; dist/lab-artifact.html is the same page for claude.ai
//   dist/appscript/          a separate, throwaway Apps Script project that serves a bench page (see INSTALL.txt)
// The bench page carries the preset jobs as Node built them, their legality reports, and the fingerprints Node gets
// for 10 and 100 battles, so a browser run can say whether it played exactly the same battles.
// Run: node browser/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { runJobSync, fingerprint, validateTeam, ENGINE, runExperiment } from '../src/index.js';
import { nodeRunner } from '../src/runner-node.js';
import { PRESETS } from '../cli/presets.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(path.join(DIST, 'appscript'), { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const BUILD = `${pkg.version}+${new Date().toISOString().slice(0, 10)}`;

/** Data the battle-only build leaves out. Battles never read it; test-browser.mjs proves the battles are identical. */
const slimPlugin = {
  name: 'battle-only',
  setup(build) {
    build.onResolve({ filter: /(learnsets|legality)\.mjs$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    build.onResolve({ filter: /data\/text\/(abilities|items|moves)\.mjs$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => {
      const name = a.path.includes('legality') ? 'Legality' : a.path.includes('learnsets') ? 'Learnsets'
        : a.path.includes('abilities') ? 'AbilitiesText' : a.path.includes('items') ? 'ItemsText' : 'MovesText';
      return { contents: `export const ${name} = {};`, loader: 'js' };
    });
  },
};

async function bundle(outfile, plugins = []) {
  const r = await esbuild.build({
    entryPoints: [path.join(HERE, 'entry.js')], bundle: true, minify: true, format: 'iife', platform: 'browser',
    target: ['es2020', 'safari15'], outfile, plugins, metafile: true, legalComments: 'none',
    define: { __SIXVSIX_BUILD__: JSON.stringify(BUILD) }, logLevel: 'warning',
  });
  return fs.statSync(outfile).size;
}

const fullSize = await bundle(path.join(DIST, 'sixvsix.full.js'));
const slimSize = await bundle(path.join(DIST, 'sixvsix.battle.js'), [slimPlugin]);

// The presets, as Node runs them: the job, its legality reports and the fingerprints for 10 and 100 battles.
const presets = {};
const SHORT = { 'heartgold-vs-cynthia': 'HG vs Cynthia', 'heartgold-vs-cynthia-authentic': 'HG vs Cynthia (Lv 62)',
                'heartgold-vs-cynthia-maxpower': 'HG vs Cynthia (max-power)', 'ou-sample-trainer-vs-maxpower': 'OU mirror' };
for (const [name, make] of Object.entries(PRESETS)) {
  const job = make();
  const fingerprints = {};
  for (const n of [10, 100]) fingerprints[n] = fingerprint(runJobSync({ ...job, trials: { ...job.trials, n } }));
  presets[name] = {
    label: job.label, short: SHORT[name] || name, job, fingerprints,
    legality: { a: validateTeam(job.a.team, job.ruleset), b: validateTeam(job.b.team, job.ruleset) },
  };
}
const bench = { build: BUILD, engine: ENGINE, presets };

const template = fs.readFileSync(path.join(HERE, 'bench.html'), 'utf8');
const page = (engineFile) => template
  .replace('/*__ENGINE__*/', () => fs.readFileSync(path.join(DIST, engineFile), 'utf8').replace(/<\/script/gi, '<\\/script'))
  .replace('/*__BENCH__*/null', () => JSON.stringify(bench).replace(/<\/script/gi, '<\\/script'));
fs.writeFileSync(path.join(DIST, 'bench.html'), page('sixvsix.full.js'));
fs.writeFileSync(path.join(DIST, 'bench-slim.html'), page('sixvsix.battle.js'));
// The claude.ai page: the same bench without its own document skeleton (the host adds one), slim build.
const slim = page('sixvsix.battle.js');
const head = slim.slice(slim.indexOf('<title>'), slim.indexOf('</head>'));
const body = slim.slice(slim.indexOf('<body>') + 6, slim.lastIndexOf('</body>'));
fs.writeFileSync(path.join(DIST, 'bench-artifact.html'),
  head.replace('</title>', '</title>\n<meta name="claude:viewport-fit-sides" content="cover">') + body);
fs.writeFileSync(path.join(DIST, 'bench.json'), JSON.stringify({ build: BUILD, fingerprints: Object.fromEntries(
  Object.entries(presets).map(([k, v]) => [k, v.fingerprints])) }, null, 1));

// The Lab. It opens on a recorded Node run of the chosen team's league; "Run it here" plays the same battles on the
// device and says whether they came out exactly the same (the fingerprint).
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/lab/pack.json'), 'utf8'));
const recorded = {};
const runner = nodeRunner({});
try {
  for (const t of pack.team_list.filter((x) => !x.variation)) {
    recorded[t.key] = await runExperiment(runner, pack, { kind: 'league', team: t.key, pool: t.league, interpretation: 'blackthorn', ours: 'blackthorn', n: 20 });
  }
} finally { runner.close(); }
const inline = (json) => JSON.stringify(json).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\u0021--');
const lab = fs.readFileSync(path.join(HERE, 'lab.html'), 'utf8')
  .replace('/*__ENGINE__*/', () => fs.readFileSync(path.join(DIST, 'sixvsix.full.js'), 'utf8').replace(/<\/script/gi, '<\\/script'))
  .replace('/*__PACK__*/', () => inline(pack))
  .replace('/*__RECORDED__*/', () => inline(recorded));
fs.writeFileSync(path.join(DIST, 'lab-artifact.html'), lab);
fs.writeFileSync(path.join(DIST, 'lab.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + lab + '</body></html>');
fs.writeFileSync(path.join(DIST, 'lab.json'), JSON.stringify({ build: BUILD, fingerprints: Object.fromEntries(
  Object.entries(recorded).map(([k, x]) => [k, { spec: x.spec, fingerprint: x.result.fingerprint, won: x.result.won, n: x.result.n }])) }, null, 1));

for (const f of fs.readdirSync(path.join(ROOT, 'appscript'))) {
  fs.copyFileSync(path.join(ROOT, 'appscript', f), path.join(DIST, 'appscript', f));
}
fs.copyFileSync(path.join(DIST, 'bench-slim.html'), path.join(DIST, 'appscript', 'sixvsix-bench.html'));

const kb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;
console.log(`build ${BUILD}`);
console.log(`  sixvsix.full.js    ${kb(fullSize)}`);
console.log(`  sixvsix.battle.js  ${kb(slimSize)}`);
console.log(`  bench.html         ${kb(fs.statSync(path.join(DIST, 'bench.html')).size)}`);
console.log(`  bench-slim.html    ${kb(fs.statSync(path.join(DIST, 'bench-slim.html')).size)}`);
console.log(`  lab.html           ${kb(fs.statSync(path.join(DIST, 'lab.html')).size)}`);
for (const [k, v] of Object.entries(presets)) console.log(`  ${k}: Node fingerprints ${JSON.stringify(v.fingerprints)}`);
for (const [k, x] of Object.entries(recorded)) console.log(`  lab ${k}: ${x.result.won}/${x.result.n}, fingerprint ${x.result.fingerprint}`);
