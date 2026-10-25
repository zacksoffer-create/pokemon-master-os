// Writes the committed fixture teams. Two come from Blackthorn's Trainer Library, read-only
// (engine/app/data/library.json; nothing there is changed): Zack's HeartGold journey six and Platinum Champion
// Cynthia, each under both lenses. One is a Gen 4 OU sample team written here, for the competitive ruleset.
// Run: node cli/make-fixtures.mjs        (test/fixtures.test.mjs checks the committed files still match)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { teamFromLibrary, profileFromLibrary, teamFromPaste } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const LIBRARY = path.resolve(ROOT, '../engine/app/data/library.json');
const OUT = path.join(ROOT, 'fixtures');

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

export function makeFixtures(library) {
  const out = {};
  for (const lens of ['standardized', 'authentic']) {
    out[`me-heartgold.${lens}`] = teamFromLibrary(library, 'me/heartgold', { lens, level: lens === 'authentic' ? 62 : undefined });
    out[`platinum-cynthia.${lens}`] = teamFromLibrary(library, 'platinum/cynthia', { lens });
  }
  out['gen4ou-sample.standardized'] = teamFromPaste(OU_SAMPLE, {
    id: 'sample:gen4ou-balance', name: 'Gen 4 OU sample (hazards, pivots, Choice items)', game: 'platinum',
    source: { kind: 'authored', note: 'written for the Phase 1 tests: a common DPP OU balance shape' },
    member: { source: 'authored sample' },
  });
  out['gen4ou-sample.standardized'].lens = 'standardized';
  out.profiles = {
    'platinum/cynthia': profileFromLibrary(library, 'platinum/cynthia', { agent: 'maxpower' }),
    'me/heartgold': profileFromLibrary(library, 'me/heartgold', { agent: 'maxpower' }),
  };
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const library = JSON.parse(fs.readFileSync(LIBRARY, 'utf8'));
  const fx = makeFixtures(library);
  fs.mkdirSync(path.join(OUT, 'teams'), { recursive: true });
  for (const [name, team] of Object.entries(fx)) {
    if (name === 'profiles') continue;
    fs.writeFileSync(path.join(OUT, 'teams', `${name}.json`), JSON.stringify(team, null, 1) + '\n');
  }
  fs.writeFileSync(path.join(OUT, 'profiles.json'), JSON.stringify(fx.profiles, null, 1) + '\n');
  console.log('wrote', Object.keys(fx).length - 1, 'teams and the profiles to', path.relative(process.cwd(), OUT));
}
