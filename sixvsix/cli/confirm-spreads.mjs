// The 6v6 check on your optimized spreads (src/optimize/confirm.js). For each of your Gen 4 teams and each member:
// the duel spread against the conventional one, the whole team against the whole league, trainer agents on both
// sides, the same seeds. Writes fixtures/optimizer/<game>.confirm.json, then rebuilds the fixtures so
// me-<game>.optimized carries the result.
//   node cli/confirm-spreads.mjs [heartgold soulsilver platinum] [--n 16]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirmSpreads } from '../src/optimize/confirm.js';
import { makeFixtures, LIBRARY, JOURNEY } from './make-fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', ...p), 'utf8'));
const args = process.argv.slice(2);
const n = args.includes('--n') ? Number(args[args.indexOf('--n') + 1]) : 16;
const games = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const profiles = read('profiles.json');
const leagueOf = Object.fromEntries(Object.entries(JOURNEY).map(([id, l]) => [id.split('/')[1], l]));

for (const game of games.length ? games : Object.keys(leagueOf)) {
  const t0 = Date.now();
  const pool = read('pools', `${leagueOf[game]}.json`);
  const duel = read('teams', `me-${game}.duel.json`);
  const report = read('optimizer', `${game}.json`);
  console.log(`${game}: checking ${duel.members.length} spreads against ${pool.name} (${n} battles per opponent per arm)`);
  const out = confirmSpreads({
    team: { ...duel, id: `library:me/${game}` }, report, pool, ruleset: 'gen4-blackthorn', n, seed: `confirm-${game}`,
    profile: profiles[`me/${game}`], opponentProfile: (opp) => profiles[opp.source.version_id],
    onMember: (row) => console.log(`  ${row.species.padEnd(11)} keeps ${row.kept.padEnd(12)} duel ${row.duel?.win_rate} · conventional ${row.conventional?.win_rate} · ` +
      `margin ${row.margin?.y_minus_x} [${row.margin?.ci95}] · p ${row.mcnemar_p}`),
  });
  fs.writeFileSync(path.join(ROOT, 'fixtures', 'optimizer', `${game}.confirm.json`), JSON.stringify({
    game, made_at: new Date().toISOString(), platform: `node ${process.version} · ${os.cpus()[0]?.model?.trim()}`,
    seconds: Math.round((Date.now() - t0) / 1000), ...out, team: undefined,
  }, null, 1) + '\n');
  console.log(`  ${Math.round((Date.now() - t0) / 1000)} s`);
}
const fx = makeFixtures(JSON.parse(fs.readFileSync(LIBRARY, 'utf8')));
for (const [name, team] of Object.entries(fx.teams)) {
  if (name.endsWith('.optimized')) fs.writeFileSync(path.join(ROOT, 'fixtures', 'teams', `${name}.json`), JSON.stringify(team, null, 1) + '\n');
}
console.log('rebuilt fixtures/teams/me-*.optimized.json');
