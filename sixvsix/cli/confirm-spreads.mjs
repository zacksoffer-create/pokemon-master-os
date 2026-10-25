// The 6v6 check on your optimized spreads (src/optimize/confirm.js, D-074: a tie goes to the conventional spread). For
// each of your Gen 4 teams and each member, and for each lineup variation's changed member: the duel spread against
// the conventional one, the whole team against the whole league, trainer agents on both sides, the same seeds.
// Writes fixtures/optimizer/<key>.confirm.json, then rebuilds the fixtures so the optimized teams carry the result.
//   node cli/confirm-spreads.mjs [heartgold soulsilver platinum <variation id>...] [--n 20] [--workers k]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirmSpreads } from '../src/optimize/confirm.js';
import { nodeRunner } from '../src/runner-node.js';
import { makeFixtures, LIBRARY, JOURNEY } from './make-fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', ...p), 'utf8'));
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? Number(args[args.indexOf(`--${k}`) + 1]) : d);
const n = opt('n', 20);
const keys = args.filter((a, i) => !a.startsWith('--') && !/^\d+$/.test(a) && !args[i - 1]?.startsWith('--'));
const profiles = read('profiles.json');
const leagueOf = Object.fromEntries(Object.entries(JOURNEY).map(([id, l]) => [id.split('/')[1], l]));
const variations = fs.readdirSync(path.join(ROOT, 'fixtures/teams')).filter((f) => f.startsWith('variation-') && f.endsWith('.duel.json'))
  .map((f) => f.slice('variation-'.length, -'.duel.json'.length));
const runner = nodeRunner({ workers: opt('workers', undefined) });
const platform = `node ${process.version} · ${os.cpus()[0]?.model?.trim()} · ${runner.size} ${runner.kind}`;

const todo = keys.length ? keys : [...Object.keys(leagueOf), ...variations];
for (const key of todo) {
  const t0 = Date.now();
  const isGame = !!leagueOf[key];
  const duel = isGame ? read('teams', `me-${key}.duel.json`) : read('teams', `variation-${key}.duel.json`);
  const report = read('optimizer', `${key}.json`);
  const game = isGame ? key : duel.variation.base.split('/')[1];
  const pool = read('pools', `${leagueOf[game]}.json`);
  const checking = report.members.filter(Boolean).length;
  console.log(`${key}: checking ${checking} spread${checking === 1 ? '' : 's'} against ${pool.name} (${n} battles per opponent per arm)`);
  const out = await confirmSpreads({
    team: { ...duel, id: isGame ? `library:me/${key}` : duel.id.replace(/#duel$/, '') }, report, pool, ruleset: 'gen4-blackthorn', n,
    seed: `confirm-${key}`, profile: profiles[`me/${game}`], opponentProfile: (opp) => profiles[opp.source.version_id], runner,
    onMember: (row) => console.log(`  ${row.species.padEnd(11)} keeps ${row.kept.padEnd(12)} duel ${row.duel?.win_rate} · conventional ${row.conventional?.win_rate} · ` +
      `margin ${row.margin?.y_minus_x} [${row.margin?.ci95}] · p ${row.mcnemar_p}`),
  });
  fs.writeFileSync(path.join(ROOT, 'fixtures', 'optimizer', `${key}.confirm.json`), JSON.stringify({
    key, made_at: new Date().toISOString(), platform, seconds: Math.round((Date.now() - t0) / 1000), ...out, team: undefined,
  }, null, 1) + '\n');
  console.log(`  ${Math.round((Date.now() - t0) / 1000)} s`);
}
runner.close();
const fx = makeFixtures(JSON.parse(fs.readFileSync(LIBRARY, 'utf8')));
for (const [name, team] of Object.entries(fx.teams)) {
  if (name.endsWith('.optimized') || (name.startsWith('variation-') && !name.endsWith('.duel'))) {
    fs.writeFileSync(path.join(ROOT, 'fixtures', 'teams', `${name}.json`), JSON.stringify(team, null, 1) + '\n');
  }
}
fs.writeFileSync(path.join(ROOT, 'fixtures', 'lab', 'pack.json'), JSON.stringify(fx.pack) + '\n');
console.log('rebuilt the optimized teams, the variations and the lab pack');
