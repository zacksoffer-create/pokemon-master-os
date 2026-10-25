// The recorded example jobs (results/). Each is a complete Simulation Job built from the committed fixtures.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeJob, baselineProfile } from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const team = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/teams', `${name}.json`), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/profiles.json'), 'utf8'));

export const PRESETS = {
  'heartgold-vs-cynthia': () => makeJob({
    id: 'job:heartgold-vs-cynthia:standardized:maxpower', label: "Zack's HeartGold six vs Platinum Cynthia, both Lv 100",
    ruleset: 'gen4-historical', lens: 'standardized', n: 100, seed: 'phase1-heartgold-vs-cynthia',
    a: { team: team('me-heartgold.standardized'), profile: profiles['me/heartgold'] },
    b: { team: team('platinum-cynthia.standardized'), profile: profiles['platinum/cynthia'] },
    note: 'Historical mode under the standardized lens: Cynthia as the game has her (no EVs, IVs 30, neutral natures) at Lv 100; ' +
      "Zack's six with Blackthorn's blank-build fill (85 EVs, IVs 31). Both sides play the max-power baseline.",
  }),
  'heartgold-vs-cynthia-authentic': () => makeJob({
    id: 'job:heartgold-vs-cynthia:authentic:maxpower', label: "Zack's HeartGold six at Lv 62 vs Platinum Cynthia as encountered",
    ruleset: 'gen4-historical', lens: 'authentic', n: 100, seed: 'phase1-heartgold-vs-cynthia-authentic',
    a: { team: team('me-heartgold.authentic'), profile: profiles['me/heartgold'] },
    b: { team: team('platinum-cynthia.authentic'), profile: profiles['platinum/cynthia'] },
    note: "The authentic lens: Cynthia's own levels (58-62), Zack's six at her top level (62).",
  }),
  'heartgold-vs-cynthia-random': () => makeJob({
    id: 'job:heartgold-vs-cynthia:standardized:random', label: 'The same matchup with both sides choosing at random',
    ruleset: 'gen4-historical', lens: 'standardized', n: 100, seed: 'phase1-heartgold-vs-cynthia-random',
    a: { team: team('me-heartgold.standardized'), profile: { ...profiles['me/heartgold'], id: 'profile:me/heartgold:random', agent: 'random' } },
    b: { team: team('platinum-cynthia.standardized'), profile: { ...profiles['platinum/cynthia'], id: 'profile:platinum/cynthia:random', agent: 'random' } },
    note: 'A control: the same teams with random legal choices, to show how much the result depends on the policy.',
  }),
  'ou-sample-maxpower-vs-random': () => makeJob({
    id: 'job:gen4ou-sample:maxpower-vs-random', label: 'Gen 4 OU sample mirror: max-power baseline vs random',
    ruleset: 'gen4-ou', lens: 'standardized', n: 100, seed: 'phase1-ou-mirror',
    a: { team: team('gen4ou-sample.standardized'), profile: baselineProfile('maxpower') },
    b: { team: team('gen4ou-sample.standardized'), profile: baselineProfile('random') },
    note: 'Competitive mode, a mirror match: the only difference between the sides is the policy.',
  }),
};
