// Legality before battle: the three verdicts (structural, obtainable, format) on the fixtures and on sets built to
// fail one verdict each, and the batch runner refusing a team that fails a verdict its ruleset requires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTeam, teamFromPaste, makeJob, prepareJob, baselineProfile } from '../src/index.js';
import { loadTeam } from './helpers.mjs';

const verdicts = (team, rs) => Object.fromEntries(Object.entries(validateTeam(team, rs).verdicts).map(([k, v]) => [k, v.ok]));

test("Zack's HeartGold six: game-legal; Smogon's Gen 4 OU refuses only Mamoswine's Snow Cloak", () => {
  const team = loadTeam('me-heartgold.optimized');
  assert.deepEqual(verdicts(team, 'gen4-blackthorn'), { structural: true, obtainable: true });
  const ou = validateTeam(team, 'gen4-ou');
  assert.equal(ou.ok, false);
  assert.deepEqual(ou.failed, ['format']);
  assert.deepEqual(ou.verdicts.format.problems, ["Mamoswine's ability Snow Cloak is banned by Evasion Abilities Clause."]);
});

test("Platinum Cynthia: playable as the game has her; a player could own her sets; not Gen 4 OU legal", () => {
  const team = loadTeam('platinum-cynthia.authentic');
  const hist = validateTeam(team, 'gen4-historical');
  assert.equal(hist.ok, true);
  assert.deepEqual(hist.required, ['structural']);
  assert.equal(hist.verdicts.obtainable.ok, true, 'reported, not required');
  const ou = validateTeam(team, 'gen4-ou');
  assert.ok(ou.verdicts.format.problems.includes('Garchomp is tagged Uber, which is banned.'));
});

test('the Gen 4 OU sample team passes all three', () => {
  assert.deepEqual(verdicts(loadTeam('gen4ou-sample.standardized'), 'gen4-ou'), { structural: true, obtainable: true, format: true });
});

const one = (paste) => teamFromPaste(paste, { id: 'test:one', name: 'one' });

test('each verdict fails for its own reason', () => {
  const futureMove = one('Starmie\nAbility: Natural Cure\nEVs: 252 SpA\n- Scald\n- Surf');
  const r1 = validateTeam(futureMove, 'gen4-historical');
  assert.equal(r1.verdicts.structural.ok, false, 'Scald is a Gen 5 move');

  const tooManyEVs = one('Snorlax\nAbility: Thick Fat\nEVs: 252 HP / 252 Atk / 252 Def\n- Body Slam');
  assert.equal(validateTeam(tooManyEVs, 'gen4-historical').verdicts.structural.ok, false, '756 EVs');

  const unlearnable = one('Garchomp\nAbility: Sand Veil\nEVs: 252 Atk\n- Dragon Dance\n- Earthquake');
  const r3 = validateTeam(unlearnable, 'gen4-blackthorn');
  assert.equal(r3.verdicts.structural.ok, true);
  assert.equal(r3.verdicts.obtainable.ok, false, 'Garchomp cannot learn Dragon Dance in Gen 4');

  const wrongHP = one('Heatran\nAbility: Flash Fire\nEVs: 252 SpA\nIVs: 30 SpA / 30 Spe\n- Hidden Power Grass');
  assert.equal(validateTeam(wrongHP, 'gen4-blackthorn').verdicts.obtainable.ok, false, 'those IVs give Hidden Power Water');

  const roughSkin = one('Garchomp\nAbility: Rough Skin\nEVs: 252 Atk\n- Earthquake');
  assert.equal(validateTeam(roughSkin, 'gen4-blackthorn').verdicts.obtainable.ok, false, 'Rough Skin is a Gen 5 ability for Garchomp');

  const uber = one('Garchomp\nAbility: Sand Veil\nEVs: 252 Atk\n- Earthquake');
  const r5 = validateTeam(uber, 'gen4-ou');
  assert.deepEqual([r5.verdicts.structural.ok, r5.verdicts.obtainable.ok, r5.verdicts.format.ok], [true, true, false]);
});

test('a job will not run a team that fails a verdict its ruleset requires', () => {
  const job = makeJob({
    ruleset: 'gen4-ou', seed: 'x', n: 2,
    a: { team: loadTeam('me-heartgold.optimized'), profile: baselineProfile('random') },
    b: { team: loadTeam('gen4ou-sample.standardized'), profile: baselineProfile('random') },
  });
  assert.throws(() => prepareJob(job), /Snow Cloak is banned/);
});
