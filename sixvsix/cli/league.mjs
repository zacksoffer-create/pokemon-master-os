// The whole system, end to end: each of your Gen 4 teams (optimized spreads, D-072) against its whole league (every
// Elite Four member, the Champion, the rematches, and Red for HGSS, all at 85 EVs), trainer agents on both sides with
// each opponent's identity read from the Trainer Library. Then the paired check that answers D-072 itself: the
// optimized team against the same six with 85 in every stat, same seeds.
//   node cli/league.mjs [heartgold soulsilver platinum] [--n 40] [--compare-n 20] [--workers k]
//   node cli/league.mjs --readme      rewrite results/league/README.md from the recorded runs, without running
// Writes results/league/<game>.json and results/league/README.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPoolWith, comparePoolWith } from '../src/compare.js';
import { nodeRunner } from '../src/runner-node.js';
import { JOURNEY } from './make-fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', ...p), 'utf8'));
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? Number(args[args.indexOf(`--${k}`) + 1]) : d);
const n = opt('n', 40), cn = opt('compare-n', 20);
const games = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const readmeOnly = args.includes('--readme');
const profiles = read('profiles.json');
const leagueOf = Object.fromEntries(Object.entries(JOURNEY).map(([id, l]) => [id.split('/')[1], l]));
const platform = `node ${process.version} · ${os.cpus()[0]?.model?.trim()} · ${os.platform()}`;
const OUT = path.join(ROOT, 'results', 'league');
fs.mkdirSync(OUT, { recursive: true });

const pct = (x) => `${Math.round(100 * x)}%`;
const runner = readmeOnly ? null : nodeRunner({ workers: args.includes('--workers') ? opt('workers', undefined) : undefined });
for (const game of readmeOnly ? [] : games.length ? games : Object.keys(leagueOf)) {
  const pool = read('pools', `${leagueOf[game]}.json`);
  const team = read('teams', `me-${game}.optimized.json`), even = read('teams', `me-${game}.even85.json`);
  const profile = profiles[`me/${game}`];
  const opponentProfile = (opp) => profiles[opp.source.version_id];
  const t0 = Date.now();
  const league = await runPoolWith(runner, { team, profile, pool, ruleset: 'gen4-blackthorn', n, seed: `league-${game}`, opponentProfile }, { platform });
  console.log(`\n${game}: ${league.won} of ${league.n} against ${pool.name} (${pct(league.win_rate)}, 95% ${league.win_rate_95.map(pct).join('–')}) in ${Math.round((Date.now() - t0) / 1000)} s`);
  for (const r of league.per_opponent) console.log(`  ${r.opponent.padEnd(34)} ${String(r.won).padStart(3)}/${r.n}  ${pct(r.win_rate)}`);
  const t1 = Date.now();
  const cmp = await comparePoolWith(runner, { x: { team: even, profile, label: '85 in every stat' }, y: { team, profile, label: 'optimized spreads' },
                                              pool, ruleset: 'gen4-blackthorn', n: cn, seed: `d072-${game}`, opponentProfile }, { platform });
  console.log(`  D-072 check: ${cmp.reading} HP margin ${cmp.margin.y_minus_x} [${cmp.margin.ci95}] (${Math.round((Date.now() - t1) / 1000)} s)`);
  fs.writeFileSync(path.join(OUT, `${game}.json`), JSON.stringify({
    game, made_at: new Date().toISOString(), platform, team: team.id, pool: pool.id, agent: 'trainer (both sides)',
    league, d072: cmp,
  }, null, 1) + '\n');
}

runner?.close();

// The README: every recorded game, in one place.
const p = (x, d = 0) => (100 * x).toFixed(d);
const rows = Object.keys(leagueOf).filter((g) => fs.existsSync(path.join(OUT, `${g}.json`)))
  .map((g) => JSON.parse(fs.readFileSync(path.join(OUT, `${g}.json`), 'utf8')));
const lines = [
  '# The whole system against each league',
  '',
  '*Written by `node cli/league.mjs`. Each of your Gen 4 teams on its optimized spreads (D-072) against every member of ' +
    'its league on 85 EVs, all at Lv 100, trainer agents on both sides with each opponent\'s identity read from the ' +
    'Trainer Library. Mirrored pairs: every seed is played from both sides.*',
  '',
  '| Team | League | Won | 95% interval | Weakest | D-072: 85 each → optimized | McNemar p | HP margin gained (95%) | Time |',
  '|---|---|---|---|---|---|---|---|---|',
];
for (const r of rows) {
  const L = r.league, c = r.d072;
  const weak = L.per_opponent.filter((o) => o.win_rate < 0.9).sort((a, b) => a.win_rate - b.win_rate)
    .map((o) => `${o.opponent.replace(/^library:[^/]+\//, '')} ${o.won}/${o.n}`).join(', ') || '—';
  lines.push(`| ${r.game} | ${L.pool.replace('pool:', '')} | ${L.won}/${L.n} (${p(L.win_rate)}%) | ` +
    `${L.win_rate_95.map((x) => p(x)).join('–')}% | ${weak} | ${c.x.won}/${c.pairs.n} → ${c.y.won}/${c.pairs.n} | ` +
    `${c.mcnemar_p < 0.0001 ? '< 0.0001' : c.mcnemar_p} | +${c.margin.y_minus_x} [${c.margin.ci95.join(', ')}] | ` +
    `${Math.round((L.timing.total_ms + c.timing.total_ms) / 1000)} s |`);
}
lines.push('', '## Per opponent', '');
for (const r of rows) {
  const d = Object.fromEntries(r.d072.per_opponent.map((o) => [o.opponent, o]));
  lines.push(`### ${r.game}`, '', '| Opponent | Won | Turns | Pokémon left when won | D-072 wins: 85 each / optimized (of 20) |', '|---|---|---|---|---|');
  for (const o of r.league.per_opponent) {
    const x = d[o.opponent];
    lines.push(`| ${o.name} | ${o.won}/${o.n} | ${o.turns.toFixed(1)} | ${o.left_when_won == null ? '—' : o.left_when_won.toFixed(1)} | ${x ? `${x.x_won} / ${x.y_won}` : '—'} |`);
  }
  lines.push('', `Fingerprint ${r.league.fingerprint} · ${r.platform} · ${r.made_at.slice(0, 10)}`, '');
}
fs.writeFileSync(path.join(OUT, 'README.md'), lines.join('\n') + '\n');
