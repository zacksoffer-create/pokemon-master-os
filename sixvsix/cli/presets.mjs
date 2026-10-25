// The recorded example jobs (results/). Each is a complete Simulation Job built from the committed fixtures: your
// teams on their optimized spreads, opponents on 85 EVs (D-072), trainer agents unless the preset says otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeJob, baselineProfile } from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const team = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/teams', `${name}.json`), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/profiles.json'), 'utf8'));
const asBaseline = (p, agent) => ({ ...p, id: `${p.id.replace(/:trainer$/, '')}:${agent}`, agent, params: {} });

export const PRESETS = {
  'heartgold-vs-cynthia': () => makeJob({
    id: 'job:heartgold-vs-cynthia:standardized:trainer', label: "Zack's HeartGold six vs Platinum Cynthia, both Lv 100",
    ruleset: 'gen4-blackthorn', lens: 'standardized', n: 100, seed: 'phase3-heartgold-vs-cynthia',
    a: { team: team('me-heartgold.optimized'), profile: profiles['me/heartgold'] },
    b: { team: team('platinum-cynthia.standardized'), profile: profiles['platinum/cynthia'] },
    note: "Your six on their optimized spreads; Cynthia's own team on 85 EVs (D-072); trainer agents on both sides, " +
      "Cynthia's identity read from the Trainer Library (her sliders and her game's AI flags).",
  }),
  'heartgold-vs-cynthia-authentic': () => makeJob({
    id: 'job:heartgold-vs-cynthia:authentic:trainer', label: "Zack's HeartGold six at Lv 62 vs Platinum Cynthia at her own levels",
    ruleset: 'gen4-blackthorn', lens: 'authentic', n: 100, seed: 'phase3-heartgold-vs-cynthia-authentic',
    a: { team: team('me-heartgold.authentic'), profile: profiles['me/heartgold'] },
    b: { team: team('platinum-cynthia.authentic'), profile: profiles['platinum/cynthia'] },
    note: "The authentic lens: Cynthia's levels (58-62), your six at her top level (62); spreads and EVs as above.",
  }),
  'heartgold-vs-cynthia-maxpower': () => makeJob({
    id: 'job:heartgold-vs-cynthia:standardized:maxpower', label: 'The same matchup with both sides on the max-power baseline',
    ruleset: 'gen4-blackthorn', lens: 'standardized', n: 100, seed: 'phase3-heartgold-vs-cynthia',
    a: { team: team('me-heartgold.optimized'), profile: asBaseline(profiles['me/heartgold'], 'maxpower') },
    b: { team: team('platinum-cynthia.standardized'), profile: asBaseline(profiles['platinum/cynthia'], 'maxpower') },
    note: 'A control with the same seeds: how much of the result is the trainers rather than the teams.',
  }),
  'ou-sample-trainer-vs-maxpower': () => makeJob({
    id: 'job:gen4ou-sample:trainer-vs-maxpower', label: 'Gen 4 OU sample mirror: trainer agent vs max-power baseline',
    ruleset: 'gen4-ou', lens: 'standardized', n: 100, seed: 'phase3-ou-mirror',
    a: { team: team('gen4ou-sample.standardized'), profile: { ...baselineProfile('trainer'), params: {} } },
    b: { team: team('gen4ou-sample.standardized'), profile: baselineProfile('maxpower') },
    note: 'Competitive mode, a mirror match: the only difference between the sides is the policy.',
  }),
};
