// The recorded Lab experiments (results/lab/): each journey team's league as Blackthorn reads the trainers and as the
// game plays them, every lineup variation against its base, the SoulSilver builds × trainer styles matrix, leads,
// what moves the needle, and the anime, Ace and journey pools. Each is written whole (JSON) and as its report
// (Markdown), with an index in results/lab/README.md. Deterministic: the same engine writes the same numbers.
// Run: node cli/lab-record.mjs [--only name,name] [--workers k]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExperiment } from '../src/experiments.js';
import { renderExperiment } from '../src/render.js';
import { nodeRunner } from '../src/runner-node.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'results', 'lab');
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/lab/pack.json'), 'utf8'));
const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const only = flag('only')?.split(',');

const journey = pack.team_list.filter((t) => !t.variation);
const S = { interpretation: 'blackthorn', ours: 'blackthorn' };
const EXPERIMENTS = [
  ...journey.flatMap((t) => ['blackthorn', 'game'].map((it) => ({
    name: `league-${t.game}-${it}`, why: `${t.name.replace('Zack · ', '')} against its league, opponents ${it === 'game' ? 'as the game plays them' : "on Blackthorn's reading"}`,
    spec: { kind: 'league', team: t.key, pool: t.league, n: 20, ...S, interpretation: it } }))),
  ...pack.team_list.filter((t) => t.variation).map((t) => ({
    name: `compare-${t.key}`, why: `${t.variation.title} against ${t.base.split('/')[1]} as it stands`,
    spec: { kind: 'compare', team: t.base, y: t.key, pool: t.league, n: 20, adaptive: { start: 10, max: 40 }, ...S } })),
  { name: 'matrix-soulsilver', why: 'SoulSilver builds × trainer styles',
    spec: { kind: 'matrix', teams: ['me/soulsilver', 'soulsilver-light-ball', 'soulsilver-former-six'], pool: 'heartgold-league', n: 12,
            interpretations: ['game', 'blackthorn', 'aggressive', 'cautious'], ...S } },
  { name: 'leads-heartgold', why: 'each of HeartGold\'s six as the lead', spec: { kind: 'leads', team: 'me/heartgold', pool: 'heartgold-league', n: 12, ...S } },
  { name: 'leads-soulsilver', why: 'each of SoulSilver\'s six as the lead', spec: { kind: 'leads', team: 'me/soulsilver', pool: 'heartgold-league', n: 12, ...S } },
  { name: 'styles-soulsilver', why: 'SoulSilver with your trainer played four ways', spec: { kind: 'styles', team: 'me/soulsilver', pool: 'heartgold-league', n: 12, ...S } },
  { name: 'sensitivity-heartgold', why: 'what moves the needle for HeartGold', spec: { kind: 'sensitivity', team: 'me/heartgold', pool: 'heartgold-league', n: 12, ...S } },
  { name: 'sensitivity-soulsilver', why: 'what moves the needle for SoulSilver', spec: { kind: 'sensitivity', team: 'me/soulsilver', pool: 'heartgold-league', n: 12, ...S } },
  { name: 'league-heartgold-anime', why: 'HeartGold against the anime reconstructions', spec: { kind: 'league', team: 'me/heartgold', pool: 'anime-gen4', n: 20, ...S } },
  { name: 'league-heartgold-ace-champions', why: 'HeartGold against the Ace test champions', spec: { kind: 'league', team: 'me/heartgold', pool: 'ace-champion-gen4', n: 20, ...S } },
  { name: 'league-platinum-ace-elite-four', why: 'Platinum against the Ace test Elite Four', spec: { kind: 'league', team: 'me/platinum', pool: 'ace-elite-four-gen4', n: 20, ...S } },
  { name: 'league-heartgold-journey', why: 'HeartGold against your three journey teams', spec: { kind: 'league', team: 'me/heartgold', pool: 'journey', n: 20, ...S } },
];

fs.mkdirSync(OUT, { recursive: true });
const runner = nodeRunner({ workers: flag('workers') != null ? Number(flag('workers')) : undefined });
const index = fs.existsSync(path.join(OUT, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')) : {};
try {
  for (const e of EXPERIMENTS) {
    if (only && !only.includes(e.name)) continue;
    const t0 = Date.now();
    let last = 0;
    const x = await runExperiment(runner, pack, e.spec, { onProgress: (d, t) => { if (Date.now() - last > 2000) { last = Date.now(); process.stderr.write(`\r  ${e.name}: ${d}/${t}   `); } } });
    const seconds = (Date.now() - t0) / 1000;
    const md = renderExperiment(x);
    fs.writeFileSync(path.join(OUT, `${e.name}.json`), JSON.stringify(x, null, 1) + '\n');
    fs.writeFileSync(path.join(OUT, `${e.name}.md`), md + '\n');
    const battles = x.result?.n ?? (x.comparison ? 2 * x.comparison.pairs.n : (x.cells || x.rows || []).flat().reduce((t, c) => t + (c.n || 0), 0) + (x.base ? x.base.n + x.effects.reduce((t, r) => t + r.n, 0) : 0));
    index[e.name] = { why: e.why, kind: x.type, battles, seconds: Math.round(seconds * 10) / 10, workers: runner.size,
                      headline: (x.report?.headline || x.reading || []).slice(0, 3), fingerprint: x.result?.fingerprint || x.comparison?.fingerprint || null };
    process.stderr.write(`\r  ${e.name}: ${battles} battles in ${seconds.toFixed(1)} s\n`);
  }
} finally { runner.close(); }

const ordered = EXPERIMENTS.map((e) => [e.name, index[e.name]]).filter(([, v]) => v);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(Object.fromEntries(ordered), null, 1) + '\n');
const lines = ['# Recorded Lab experiments', '',
  'Written by `node cli/lab-record.mjs` on the engine in `src/` (Node, worker threads). Each experiment is here whole',
  '(`<name>.json`: its spec, the engine and contract versions, every number and the report) and as its report (`<name>.md`).',
  'The engine is deterministic: rerunning a spec on the same engine, in Node or in the 6v6 Lab page, plays the same',
  'battles (the fingerprint). Opponents are at Lv 100 on 85 EVs (D-072); your teams on their D-074 spreads.', '',
  '| Experiment | What it asks | Battles | Time | What it found |', '|---|---|---:|---:|---|'];
for (const [name, v] of ordered) {
  lines.push(`| [${name}](${name}.md) | ${v.why} | ${v.battles} | ${v.seconds} s | ${v.headline.join(' ').replace(/\|/g, '/').slice(0, 400)} |`);
}
fs.writeFileSync(path.join(OUT, 'README.md'), lines.join('\n') + '\n');
console.log(`wrote ${ordered.length} experiments to results/lab/`);
