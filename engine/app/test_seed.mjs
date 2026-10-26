// A test fixture for the browser tests (v2, D-078): the fresh start leaves the preview with no Pokémon of yours, so
// tests that need a team seed one into the preview's stand-in Sheet (localStorage 'bt-preview-tabs'), as the app would
// have saved it. The fixture is the journey teams from engine/canon (rosters.json and builds.json), with the ids they
// always had (me:<game>/<Species>, yours:<game>/<Species>), each game a v2 team (journey:<game>) with its own trainer.
// A member with no moves in canon takes the engine's own fallback set (its advance scouting file, as v1 filled it).
// It lives only in the test browser; the app's data and your Sheet are untouched.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN = { crystal: 2, firered: 3, emerald: 3, platinum: 4, heartgold: 4, soulsilver: 4 };
const read = (f) => JSON.parse(fs.readFileSync(path.join(ENGINE, 'canon', f), 'utf8'));
const FALLBACK = {};
function fallback(game) {   // advance_pack.py --movesets: the sets the one-on-one engine fills in for builds with none
  if (!(game in FALLBACK)) {
    const r = spawnSync('python3', ['-I', path.join(ENGINE, 'app', 'advance_pack.py'), '--movesets', game], { encoding: 'utf8' });
    FALLBACK[game] = r.status === 0 ? JSON.parse(r.stdout || '{}') : {};
  }
  return FALLBACK[game];
}

export function seedRows(games = ['heartgold', 'platinum'], profiles = {}) {
  const rosters = read('rosters.json').chapters, builds = read('builds.json'), at = new Date().toISOString();
  const rows = { 'My Pokémon': [], 'My Builds': [], 'My Teams': [] };
  for (const game of games) {
    const ch = rosters.find((c) => c.game === game); if (!ch) continue;
    const slots = [];
    for (const sp of ch.roster.slice(0, 6)) {
      const b = (builds[game] || {})[sp] || {}, moves = (b.moves || []).length ? b.moves : (fallback(game)[sp] || []), iid = `me:${game}/${sp}`, bid = `yours:${game}/${sp}`;
      rows['My Builds'].push({ id: bid, v: 1, status: 'saved', species: sp, generation: GEN[game], game, level: '', nature: b.nature || '', ability: b.ability || '', item: b.item || '',
        moves: moves.join(' / '), ivs: '', evs: '', name: '', note: 'test fixture', parent: '', individual: iid, at });
      rows['My Pokémon'].push({ id: iid, status: 'working', species: sp, game, nickname: '', gender: 'M', shiny: 'no', ball: 'Poké Ball', build: bid, hatch_moves: '', at });
      slots.push({ ind: iid, species: sp });
    }
    rows['My Teams'].push({ id: `journey:${game}`, game, kind: 'journey', title: `${game} team`, status: 'saved', note: '', at, slots: JSON.stringify(slots),
      profile: JSON.stringify(Object.assign({ name: 'Zack', style: 'default', philosophy: '', params: {} }, profiles[game] || {})), members: slots.map((s) => s.species).join(' · ') });
  }
  return rows;
}

export async function seedPage(page, games, profiles) {   // writes the fixture into the preview's Sheet and reopens the app on it
  const rows = seedRows(games, profiles);
  await page.evaluate((r) => { localStorage.setItem('bt-preview-tabs', JSON.stringify(r)); }, rows);
  await page.reload();
  return rows;
}
