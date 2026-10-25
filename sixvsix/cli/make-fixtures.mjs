// Writes the committed fixtures, read-only from Blackthorn's Trainer Library (engine/app/data/library.json; nothing
// there changes). D-072: your teams carry full EV spreads optimized against the opponents they face; opposing teams
// carry 85 EVs in every stat.
//   fixtures/pools/<league>.json         each game's Elite Four, Champion and rematches (+ Red for HGSS), Lv 100, 85 EVs
//   fixtures/teams/me-<game>.duel        your HeartGold, SoulSilver and Platinum sixes, each spread optimized one-on-one
//                                        against their league (src/optimize/evs.js)
//   fixtures/teams/me-<game>.optimized   the same, after the 6v6 check (fixtures/optimizer/<game>.confirm.json, written by
//                                        cli/confirm-spreads.mjs): a member keeps its duel spread unless the battles say
//                                        the conventional one is better
//   fixtures/teams/me-<game>.even85      the same sixes with 85 in every stat (the comparison baseline)
//   fixtures/teams/me-heartgold.authentic  the optimized HeartGold six at Lv 62 (Cynthia's top level)
//   fixtures/teams/platinum-cynthia.*    Cynthia under both lenses, 85 EVs
//   fixtures/teams/gen4ou-sample.*       an authored Gen 4 OU team for the competitive ruleset
//   fixtures/optimizer/<game>.json       what the optimizer chose for each member, and what it beat
// Run: node cli/make-fixtures.mjs        (test/fixtures.test.mjs checks the committed files still match)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { teamFromLibrary, profileFromLibrary, teamFromPaste } from '../src/index.js';
import { optimizeTeam } from '../src/optimize/evs.js';
import { withConventional } from '../src/optimize/confirm.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const LIBRARY = path.resolve(ROOT, '../engine/app/data/library.json');
const OUT = path.join(ROOT, 'fixtures');

export const LEAGUES = {
  'heartgold-league': { name: 'HeartGold/SoulSilver Elite Four, Champion, rematches and Red',
                        collections: ['heartgold-elite-four', 'heartgold-elite-four-rematch'], extra: ['heartgold/red'] },
  'platinum-league': { name: 'Platinum Elite Four, Champion and rematches',
                       collections: ['platinum-elite-four', 'platinum-elite-four-rematch'], extra: [] },
};
export const JOURNEY = { 'me/heartgold': 'heartgold-league', 'me/soulsilver': 'heartgold-league', 'me/platinum': 'platinum-league' };

export const OU_SAMPLE = `Swampert @ Leftovers
Ability: Torrent
EVs: 240 HP / 216 Def / 52 SpD
Relaxed Nature
- Stealth Rock
- Surf
- Earthquake
- Roar

Skarmory @ Leftovers
Ability: Keen Eye
EVs: 252 HP / 224 Def / 32 Spe
Impish Nature
- Spikes
- Roost
- Whirlwind
- Brave Bird

Scizor @ Choice Band
Ability: Technician
EVs: 200 HP / 252 Atk / 56 Spe
Adamant Nature
- Bullet Punch
- U-turn
- Superpower
- Pursuit

Gengar @ Life Orb
Ability: Levitate
EVs: 4 Atk / 252 SpA / 252 Spe
Hasty Nature
- Shadow Ball
- Focus Blast
- Thunderbolt
- Explosion

Heatran @ Choice Scarf
Ability: Flash Fire
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
- Fire Blast
- Earth Power
- Dragon Pulse
- Hidden Power Grass
IVs: 30 Atk / 30 SpA

Gyarados @ Leftovers
Ability: Intimidate
EVs: 4 HP / 252 Atk / 252 Spe
Adamant Nature
- Dragon Dance
- Waterfall
- Earthquake
- Stone Edge
`;

/** A league's opponent teams as Team Versions (standardized lens, 85 EVs). */
export function leagueTeams(library, league) {
  const L = LEAGUES[league];
  const ids = [...L.collections.flatMap((c) => library.collections.find((x) => x.id === c).members), ...L.extra];
  return ids.map((id) => teamFromLibrary(library, id, { lens: 'standardized' }));
}

export function leaguePool(library, league) {
  return {
    kind: 'OpponentPool', id: `pool:${league}`, version: 1, name: LEAGUES[league].name, lens: 'standardized',
    ev_policy: '85 in every stat (D-072)', members: leagueTeams(library, league),
    source: { kind: 'blackthorn-trainer-library', collections: LEAGUES[league].collections, extra: LEAGUES[league].extra, read_only: true },
  };
}

const poolMons = (pool) => pool.members.flatMap((t) => t.members.map((m) => ({ ...m, from: t.source.version_id })));

export function makeFixtures(library) {
  const teams = {}, pools = {}, optimizer = {};
  for (const league of Object.keys(LEAGUES)) pools[league] = leaguePool(library, league);
  for (const [id, league] of Object.entries(JOURNEY)) {
    const game = id.split('/')[1];
    const base = teamFromLibrary(library, id, { lens: 'standardized' });
    teams[`me-${game}.even85`] = { ...base, id: `${base.id}#even85` };
    const { team, report } = optimizeTeam(base, poolMons(pools[league]), { poolName: pools[league].name });
    teams[`me-${game}.duel`] = { ...team, id: `${base.id}#duel` };
    optimizer[game] = { team: team.id, pool: pools[league].id, members: report };
    let final = team;
    const confirmFile = path.join(OUT, 'optimizer', `${game}.confirm.json`);
    if (fs.existsSync(confirmFile)) {
      const confirm = JSON.parse(fs.readFileSync(confirmFile, 'utf8'));
      confirm.rows.forEach((row, i) => { if (row.kept === 'conventional') final = withConventional(final, i, report[i]); });
    }
    teams[`me-${game}.optimized`] = final;
  }
  const hg = teams['me-heartgold.optimized'];
  teams['me-heartgold.authentic'] = {
    ...hg, lens: 'authentic',
    members: hg.members.map((m) => ({ ...m, level: 62, filled: [...m.filled.filter((f) => !f.startsWith('level:')),
      "level: 62 (authentic lens: Cynthia's top level)"] })),
  };
  teams['platinum-cynthia.standardized'] = teamFromLibrary(library, 'platinum/cynthia', { lens: 'standardized' });
  teams['platinum-cynthia.authentic'] = teamFromLibrary(library, 'platinum/cynthia', { lens: 'authentic' });
  teams['gen4ou-sample.standardized'] = {
    ...teamFromPaste(OU_SAMPLE, {
      id: 'sample:gen4ou-balance', name: 'Gen 4 OU sample (hazards, pivots, Choice items)', game: 'platinum',
      source: { kind: 'authored', note: 'written for the tests: a common DPP OU balance shape' }, member: { source: 'authored sample' },
    }),
    lens: 'standardized',
  };
  const profiles = {};
  for (const id of [...Object.keys(JOURNEY), ...Object.values(pools).flatMap((p) => p.members.map((t) => t.source.version_id))]) {
    profiles[id] = profileFromLibrary(library, id);
  }
  return { teams, pools, optimizer, profiles };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const library = JSON.parse(fs.readFileSync(LIBRARY, 'utf8'));
  const fx = makeFixtures(library);
  for (const dir of ['teams', 'pools', 'optimizer']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, 'teams'))) fs.unlinkSync(path.join(OUT, 'teams', f));
  for (const [name, team] of Object.entries(fx.teams)) fs.writeFileSync(path.join(OUT, 'teams', `${name}.json`), JSON.stringify(team, null, 1) + '\n');
  for (const [name, pool] of Object.entries(fx.pools)) fs.writeFileSync(path.join(OUT, 'pools', `${name}.json`), JSON.stringify(pool) + '\n');
  for (const [name, rep] of Object.entries(fx.optimizer)) fs.writeFileSync(path.join(OUT, 'optimizer', `${name}.json`), JSON.stringify(rep, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'profiles.json'), JSON.stringify(fx.profiles, null, 1) + '\n');
  console.log(`wrote ${Object.keys(fx.teams).length} teams, ${Object.keys(fx.pools).length} pools, ${Object.keys(fx.profiles).length} profiles`);
  for (const [game, rep] of Object.entries(fx.optimizer)) {
    console.log(`\n${game} (against ${rep.pool})`);
    for (const m of rep.members) {
      console.log(`  ${m.species.padEnd(11)} ${m.nature.padEnd(8)}${m.nature_chosen ? '*' : ' '} ${m.label.padEnd(34)} ` +
        `points ${m.score.points} (fresh ${m.score.wins_worst}/${m.score.wins_typical} of ${m.score.of}, switching in ${m.score.wins_switching_in}) · ` +
        `best template ${m.best_template.points} (${m.best_template.id}) · 85s ${m.flat_85.points}`);
    }
  }
}
