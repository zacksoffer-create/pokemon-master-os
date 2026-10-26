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
//   fixtures/teams/variation-<id>        your lineup variations (engine/canon/lineups.json): the optimized journey six
//                                        with only the named change, the changed member optimized and checked the same way
//   fixtures/lab/pack.json               everything the Lab and cli/lab.mjs need: your teams and variations, every
//                                        Gen 4 Trainer Library collection as an opponent pool, every trainer's two
//                                        profiles (the trainer agent's reading, the cartridge AI) and the interpretations
// Run: node cli/make-fixtures.mjs        (test/contract.test.mjs checks the committed files still match)
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { teamFromLibrary, profileFromLibrary, teamFromPaste, CONTRACT_VERSION, ENGINE } from '../src/index.js';
import { optimizeTeam } from '../src/optimize/evs.js';
import { withConventional } from '../src/optimize/confirm.js';
import { poolsFromCollections, variationTeams, INTERPRETATIONS } from '../src/adapters/collections.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const LIBRARY = path.resolve(ROOT, '../engine/app/data/library.json');
// The fixtures are the journey teams as the Trainer Library has them. While Blackthorn's fresh start is on (D-078) the
// app's library.json leaves the journey out, so the whole library is read from its source instead (read-only).
export function readLibrary() {
  const lib = JSON.parse(fs.readFileSync(LIBRARY, 'utf8'));
  if (lib.versions['me/heartgold']) return lib;
  const out = path.join(os.tmpdir(), `blackthorn-library-${process.pid}.json`);
  const r = spawnSync('python3', ['-I', path.resolve(ROOT, '../engine/app/library_pack.py'), '--out', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('library_pack.py --out failed: ' + (r.stderr || '').slice(-500));
  const full = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); return full;
}
export const LINEUPS = path.resolve(ROOT, '../engine/canon/lineups.json');
const ADVANCE = (id) => path.resolve(ROOT, `../engine/app/data/advance-${id}.json`);
const SPECIES_ITEMS = path.resolve(ROOT, '../engine/battle/species_items.json');
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
const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const confirmed = (key) => {
  const f = path.join(OUT, 'optimizer', `${key}.confirm.json`);
  return fs.existsSync(f) ? readJSON(f) : null;
};

/** The one-on-one engine's own fallback movesets for a lineup (its advance scouting file), for builds with none. */
function fallbackMovesets(id) {
  const f = ADVANCE(id);
  const app = fs.existsSync(f) ? readJSON(f) : null;
  if (app && !app.fresh) return app.sheets?.[0]?.movesets || {};
  // the fresh start (D-078) empties the app's copy; the scouting file it came from is unchanged
  const r = spawnSync('python3', ['-I', path.resolve(ROOT, '../engine/app/advance_pack.py'), '--movesets', id], { encoding: 'utf8' });
  return r.status === 0 ? JSON.parse(r.stdout) : {};
}

export function makeFixtures(library, lineups = readJSON(LINEUPS)) {
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
    const confirm = confirmed(game);
    if (confirm) confirm.rows.forEach((row, i) => { if (row?.kept === 'conventional') final = withConventional(final, i, report[i]); });
    teams[`me-${game}.optimized`] = final;
  }
  // your lineup variations: only the changed member is optimized (and checked), the rest keep the journey spreads
  const bases = Object.fromEntries(Object.keys(JOURNEY).map((id) => [id.split('/')[1], teams[`me-${id.split('/')[1]}.optimized`]]));
  const movesets = Object.fromEntries((lineups.variations || []).map((v) => [v.id, fallbackMovesets(v.id)]));
  for (const v of variationTeams(bases, lineups, { movesets })) {
    const vid = v.variation.id, game = v.variation.base.split('/')[1], league = JOURNEY[`me/${game}`];
    const idx = v.members.map((m, i) => (m.id.endsWith(`~${vid}`) ? i : -1)).filter((i) => i >= 0);
    const { team: opt, report } = optimizeTeam({ ...v, members: idx.map((i) => v.members[i]) }, poolMons(pools[league]), { poolName: pools[league].name });
    let duel = { ...v, members: v.members.map((m, i) => (idx.includes(i) ? opt.members[idx.indexOf(i)] : m)) };
    const aligned = v.members.map((_, i) => (idx.includes(i) ? report[idx.indexOf(i)] : null));
    teams[`variation-${vid}.duel`] = { ...duel, id: `${v.id}#duel` };
    optimizer[vid] = { team: v.id, pool: pools[league].id, variation: vid, members: aligned };
    const confirm = confirmed(vid);
    if (confirm) confirm.rows.forEach((row, i) => { if (row?.kept === 'conventional') duel = withConventional(duel, i, aligned[i]); });
    teams[`variation-${vid}`] = duel;
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
  return { teams, pools, optimizer, profiles, pack: labPack(library, { teams, pools }) };
}

/**
 * The Lab's data: your teams and variations, every Gen 4 collection as a pool (each opponent team stored once),
 * your journey sixes as a pool of their own, every trainer's two profiles, and the interpretations.
 */
export function labPack(library, { teams, pools }) {
  const opponents = {}, poolIndex = {}, profiles = {};
  const add = (team) => { opponents[team.source?.version_id || team.id] = team; return team.source?.version_id || team.id; };
  const putPool = (key, p, kind) => {
    poolIndex[key] = { id: p.id, name: p.name, kind, ruleset: p.ruleset || 'gen4-blackthorn', members: p.members.map(add),
                       ...(p.excluded ? { excluded: p.excluded } : {}), ...(p.note ? { note: p.note } : {}) };
  };
  for (const [key, p] of Object.entries(pools)) putPool(key, p, 'league');
  for (const p of poolsFromCollections(library)) {
    if (p.source.collection === 'journey') continue;   // your teams play as themselves (below), not on 85 EVs
    putPool(p.source.collection, p, 'collection');
  }
  const mine = Object.keys(JOURNEY).map((id) => teams[`me-${id.split('/')[1]}.optimized`]);
  poolIndex.journey = { id: 'pool:journey', name: 'Your journey teams (as they fight: optimized spreads)', kind: 'yours', ruleset: 'gen4-blackthorn',
                        members: mine.map((t) => { opponents[`mine:${t.source.version_id}`] = t; return `mine:${t.source.version_id}`; }) };
  for (const vid of Object.keys(opponents)) {
    const libId = vid.startsWith('mine:') ? vid.slice(5) : vid;
    if (!library.versions[libId]) continue;
    const v = library.versions[libId];
    const flags = Array.isArray(v.ai_flags) ? v.ai_flags : (v.ai_flag_names || []);
    profiles[vid] = { trainer: profileFromLibrary(library, libId), game: v.kind === 'cartridge' && flags.length ? profileFromLibrary(library, libId, { agent: 'game' }) : null };
  }
  const yours = Object.fromEntries(Object.keys(JOURNEY).map((id) => [id, { trainer: profileFromLibrary(library, id), game: null }]));
  const teamList = [];
  for (const id of Object.keys(JOURNEY)) {
    const game = id.split('/')[1];
    teamList.push({ key: id, team: `me-${game}.optimized`, name: teams[`me-${game}.optimized`].name, game, league: JOURNEY[id], variation: null });
  }
  for (const [name, t] of Object.entries(teams)) {
    if (!name.startsWith('variation-') || name.endsWith('.duel')) continue;
    const game = t.variation.base.split('/')[1];
    teamList.push({ key: t.variation.id, team: name, name: t.name, game, league: JOURNEY[`me/${game}`], base: `me/${game}`,
                    variation: { title: t.variation.title, why: t.variation.why, changed: t.variation.changed } });
  }
  return {
    kind: 'LabPack', contract: CONTRACT_VERSION, engine: ENGINE,
    teams: Object.fromEntries(teamList.map((t) => [t.key, teams[t.team]])), team_list: teamList,
    opponents, pools: poolIndex, profiles: { ...profiles, ...yours }, interpretations: INTERPRETATIONS,
    signature_items: fs.existsSync(SPECIES_ITEMS) ? readJSON(SPECIES_ITEMS).items : {},
    sources: { library: 'engine/app/data/library.json', lineups: 'engine/canon/lineups.json', signature_items: 'engine/battle/species_items.json', read_only: true },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const library = readLibrary();
  const fx = makeFixtures(library);
  for (const dir of ['teams', 'pools', 'optimizer', 'lab']) fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, 'teams'))) fs.unlinkSync(path.join(OUT, 'teams', f));
  for (const [name, team] of Object.entries(fx.teams)) fs.writeFileSync(path.join(OUT, 'teams', `${name}.json`), JSON.stringify(team, null, 1) + '\n');
  for (const [name, pool] of Object.entries(fx.pools)) fs.writeFileSync(path.join(OUT, 'pools', `${name}.json`), JSON.stringify(pool) + '\n');
  for (const [name, rep] of Object.entries(fx.optimizer)) fs.writeFileSync(path.join(OUT, 'optimizer', `${name}.json`), JSON.stringify(rep, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'profiles.json'), JSON.stringify(fx.profiles, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT, 'lab', 'pack.json'), JSON.stringify(fx.pack) + '\n');
  console.log(`lab pack: ${fx.pack.team_list.length} of your teams, ${Object.keys(fx.pack.pools).length} pools, ` +
    `${Object.keys(fx.pack.opponents).length} opponent teams, ${(fs.statSync(path.join(OUT, 'lab', 'pack.json')).size / 1e6).toFixed(2)} MB`);
  console.log(`wrote ${Object.keys(fx.teams).length} teams, ${Object.keys(fx.pools).length} pools, ${Object.keys(fx.profiles).length} profiles`);
  for (const [game, rep] of Object.entries(fx.optimizer)) {
    console.log(`\n${game} (against ${rep.pool})`);
    for (const m of rep.members) {
      if (!m) continue;
      console.log(`  ${m.species.padEnd(11)} ${m.nature.padEnd(8)}${m.nature_chosen ? '*' : ' '} ${m.label.padEnd(34)} ` +
        `points ${m.score.points} (fresh ${m.score.wins_worst}/${m.score.wins_typical} of ${m.score.of}, switching in ${m.score.wins_switching_in}) · ` +
        `best template ${m.best_template.points} (${m.best_template.id}) · 85s ${m.flat_85.points}`);
    }
  }
}
