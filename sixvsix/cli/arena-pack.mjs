// The Arena's data for the Blackthorn app (v1, D-077): the 6v6 engine in the app.
//
//   node cli/arena-pack.mjs              engine/app/data/sixvsix.json and arena.json (the Legends rankings included)
//   node cli/arena-pack.mjs --quick      the same with a shorter Legends round robin (tests)
//
// sixvsix.json  the battle-only browser build (no learnsets: 2.6 MB rather than 6.9), as text the page loads on demand
// arena.json    what that build can't work out for itself:
//   - legality: every Gen IV team the Arena can field from the Trainer Library (cartridge, anime, all-time, journey,
//     the ecosystem's proposals, and Gen II-III teams converted to Gen IV rules), checked here by Showdown's validator
//     once, so the page can run them (prepareJob's precomputed reports, batch.js);
//   - your journey teams as the 6v6 Lab fights them (fixtures/lab/pack.json: D-072's optimized spreads) and their
//     lineup variations;
//   - the Legends: the all-time field (every Champion and Red, the anime's teams, the all-time team and yours), in a
//     power round robin played here, so the page opens on standings it didn't have to play.
// Opponent teams and trainer profiles aren't stored: the page makes them from the library with the same adapter
// (teamFromLibrary, profileFromLibrary), so a team here is exactly the team the page plays.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENGINE, CONTRACT_VERSION, teamFromLibrary, profileFromLibrary, validateTeam, withGen4, makeJob, finishJob, wilson,
  INTERPRETATIONS,
} from '../src/index.js';
import { nodeRunner } from '../src/runner-node.js';
import { slimPlugin, bundle } from '../browser/slim.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPDATA = path.resolve(ROOT, '../engine/app/data');
const LIBRARY = path.join(APPDATA, 'library.json');
const PACK = path.join(ROOT, 'fixtures/lab/pack.json');
const QUICK = process.argv.includes('--quick');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// ---- the Legends field ------------------------------------------------------------------------------------------
// The all-time teams (the '96 Bulls of the Trainer Library): each game's Champion at their strongest, Red, the
// anime's teams, the all-time team and your six journeys. Cartridge teams play under the standardized lens (Lv 100,
// 85 EVs, D-072); Gen II-III teams under Gen IV rules (gen4:<id>).
const LEGEND_CARTRIDGE = [
  'gen4:crystal/lance', 'gen4:crystal/red', 'gen4:firered/gary-rematch-he-chose-bulbasaur', 'gen4:emerald/wallace',
  'platinum/cynthia-rematch', 'heartgold/lance-rematch', 'heartgold/red',
];
const YOURS = { 'me/heartgold': 'pack', 'me/soulsilver': 'pack', 'me/platinum': 'pack',
                'gen4:me/crystal': 'library', 'gen4:me/firered': 'library', 'gen4:me/emerald': 'library' };

function legendField(lib) {
  const field = [];
  for (const [id, from] of Object.entries(YOURS)) field.push({ id, from, group: 'yours' });
  for (const id of LEGEND_CARTRIDGE) if (lib.versions[id]) field.push({ id, from: 'library', group: 'champions' });
  for (const [id, v] of Object.entries(lib.versions)) {
    if ((v.kind === 'anime' || v.kind === 'all-time') && v.generation === 4) field.push({ id, from: 'library', group: v.kind === 'all-time' ? 'all-time' : 'anime' });
  }
  return field;
}

// ---- legality ---------------------------------------------------------------------------------------------------
function verdicts(team) {
  const r = validateTeam(team, 'gen4-historical');     // structural required, obtainable reported
  const s = r.verdicts.structural, o = r.verdicts.obtainable;
  return [s.ok ? 1 : 0, o.ok ? 1 : 0, [...s.problems, ...o.problems].slice(0, 3)];
}

async function main() {
  const t0 = Date.now();
  const library = read(LIBRARY);
  const lib = withGen4(library);
  const lab = read(PACK);

  // 1. the engine, battle-only
  const tmp = path.join(ROOT, 'dist', 'sixvsix.app.js');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  const build = `${pkg.version}+${new Date().toISOString().slice(0, 10)}`;
  const bytes = await bundle(tmp, { plugins: [slimPlugin], build });
  const code = fs.readFileSync(tmp, 'utf8');

  // 2. legality of every team the page can field
  const legal = {}, excluded = {};
  for (const [id, v] of Object.entries(lib.versions)) {
    if (v.generation !== 4) continue;
    let team;
    try { team = teamFromLibrary(lib, id, { lens: 'standardized' }); }
    catch (e) { excluded[id] = String(e.message).split('\n')[0]; continue; }
    legal[`${team.id}|${team.version}`] = verdicts(team);
  }
  for (const t of Object.values(lab.teams)) legal[`${t.id}|${t.version}`] = verdicts(t);

  // 3. the Legends: a power round robin
  const field = legendField(lib);
  const teamOf = (f) => (f.from === 'pack' ? lab.teams[f.id] : teamFromLibrary(lib, f.id, { lens: 'standardized' }));
  const profileOf = (f) => profileFromLibrary(lib, f.from === 'pack' ? f.id : f.id);
  const entries = field.map((f) => ({ ...f, team: teamOf(f), profile: profileOf(f) }));
  const n = QUICK ? 2 : 8;
  const tasks = [], pairs = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const A = entries[i], B = entries[j];
      const ok = (e) => legal[`${e.team.id}|${e.team.version}`];
      const ruleset = ok(A)?.[1] && ok(B)?.[1] ? 'gen4-blackthorn' : 'gen4-historical';
      const job = makeJob({
        id: `legends:${A.id}:vs:${B.id}`, label: `${A.team.name} vs ${B.team.name}`, ruleset, n, seed: `legends|v1|${A.id}|${B.id}`,
        pairing: 'mirrored', lens: 'standardized', a: { team: A.team, profile: A.profile }, b: { team: B.team, profile: B.profile },
        record: { logs: 'none', decisions: 'none', input_logs: 'none', analysis: true },
      });
      tasks.push({ job });
      pairs.push([i, j]);
    }
  }
  const runner = nodeRunner({});
  let out;
  try {
    let last = 0;
    out = await runner.run(tasks, { onProgress: (d, t) => { if (Date.now() - last > 2000) { last = Date.now(); process.stderr.write(`\r  legends ${d}/${t} battles`); } } });
  } finally { runner.close(); }
  process.stderr.write('\n');
  const table = entries.map(() => ({ w: 0, l: 0, d: 0, sw: 0, sl: 0, kos: 0, n: 0 }));
  const matrix = {};
  const stars = new Map();
  out.forEach(({ prepared, rows }, k) => {
    const [i, j] = pairs[k];
    const r = finishJob(prepared, rows, { total_ms: 0, per_battle_ms: {}, platform: 'node' });
    table[i].w += r.won; table[i].l += r.lost; table[i].d += r.drew; table[i].n += r.n;
    table[j].w += r.lost; table[j].l += r.won; table[j].d += r.drew; table[j].n += r.n;
    if (r.won > r.lost) { table[i].sw++; table[j].sl++; } else if (r.lost > r.won) { table[j].sw++; table[i].sl++; }
    matrix[`${i}-${j}`] = [r.won, r.lost, r.drew];
    for (const [who, e] of [['a', i], ['b', j]]) {
      for (const m of r.summary.members[who]) {
        const key = `${e}|${m.name}`;
        const x = stars.get(key) || { team: e, name: m.name, battles: 0, kos: 0, dealt: 0, fainted: 0 };
        x.battles += r.n; x.kos += m.kos_per_battle * r.n; x.dealt += m.damage_dealt_per_battle * r.n; x.fainted += m.fainted_rate * r.n;
        stars.set(key, x);
      }
    }
  });
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const standings = entries.map((e, i) => {
    const t = table[i], [lo, hi] = wilson(t.w, t.n);
    return { id: e.id, from: e.from, group: e.group, name: e.team.name, trainer: e.team.trainer, game: e.team.game,
             species: e.team.members.map((m) => m.species), won: t.w, lost: t.l, drew: t.d, n: t.n,
             win_rate: r3(t.n ? t.w / t.n : 0), win_rate_95: [r3(lo), r3(hi)], series_won: t.sw, series_lost: t.sl };
  });
  const order = standings.map((s, i) => i).sort((a, b) => standings[b].win_rate - standings[a].win_rate);
  const players = [...stars.values()].map((x) => ({ team: x.team, name: x.name, kos_per_battle: r3(x.kos / x.battles),
    damage_per_battle: Math.round((10 * x.dealt) / x.battles) / 10, fainted_rate: r3(x.fainted / x.battles) }));

  const arena = {
    _note: 'Built by sixvsix/cli/arena-pack.mjs (v1, D-077). The engine itself is sixvsix.json; this is what it cannot work out in the page.',
    kind: 'ArenaPack', contract: CONTRACT_VERSION, engine: ENGINE, build,
    checked_by: `Showdown TeamValidator (${ENGINE.name} ${ENGINE.version})`,
    library_versions: Object.keys(library.versions).length,
    legal, excluded,
    teams: lab.teams, team_list: lab.team_list, signature_items: lab.signature_items, interpretations: INTERPRETATIONS,
    legends: {
      made_at: new Date().toISOString(), n_per_pairing: n, pairing: 'mirrored', interpretation: 'blackthorn', lens: 'standardized',
      rule: `every team played every other ${n} times (${n / 2} mirrored pairs), each trainer as Blackthorn reads them; ranked by win rate`,
      field: standings, order, matrix, players,
    },
  };
  fs.writeFileSync(path.join(APPDATA, 'sixvsix.json'), JSON.stringify({ kind: 'SixVSixBundle', build, engine: ENGINE, bytes, code }));
  fs.writeFileSync(path.join(APPDATA, 'arena.json'), JSON.stringify(arena));
  const kb = (f) => `${Math.round(fs.statSync(path.join(APPDATA, f)).size / 1024)} KB`;
  console.log(`arena pack: ${Object.keys(legal).length} teams checked (${Object.keys(excluded).length} left out), ` +
    `${entries.length} Legends in ${tasks.length * n} battles; sixvsix.json ${kb('sixvsix.json')}, arena.json ${kb('arena.json')}, ` +
    `${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const i of order.slice(0, 8)) console.log(`  ${standings[i].name.padEnd(48)} ${(100 * standings[i].win_rate).toFixed(0)}%`);
}

await main();
