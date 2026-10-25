// The contract and the rulesets: the engine version a result claims is the one installed, the six objects check
// what they should, each ruleset lists exactly the battle-time rules its Showdown format contains, Gen 4 has no team
// preview, and the committed fixtures are still what the Trainer Library produces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ENGINE, CONTRACT_VERSION, RULESETS, describeFormat, check, makeJob, baselineProfile } from '../src/index.js';
import { makeFixtures, LIBRARY } from '../cli/make-fixtures.mjs';
import { ROOT, loadTeam } from './helpers.mjs';

test('the engine a result claims is the engine installed', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@pkmn/sim/package.json'), 'utf8'));
  assert.equal(ENGINE.version, pkg.version);
  const ours = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(ours.dependencies['@pkmn/sim'], ENGINE.version, 'package.json pins the exact version');
});

test('every committed fixture is a well-formed Team Version, and every member a complete Pokémon Build', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'fixtures/teams'))) {
    const team = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/teams', f), 'utf8'));
    assert.deepEqual(check('TeamVersion', team), [], f);
    assert.equal(team.members.length, 6, `${f} has six`);
  }
});

test('the checker catches what it should', () => {
  const team = loadTeam('me-heartgold.standardized');
  const bad = structuredClone(team);
  delete bad.members[0].nature;
  bad.members[1].evs.atk = 300;
  bad.members[2].moves = ['A', 'B', 'C', 'D', 'E'];
  bad.members[3].evidence.moves = ['certain', 'because'];
  const problems = check('TeamVersion', bad);
  assert.ok(problems.some((p) => p.includes('members[0].nature is missing')));
  assert.ok(problems.some((p) => p.includes('members[1].evs.atk is above 255')));
  assert.ok(problems.some((p) => p.includes('members[2].moves allows at most 4')));
  assert.ok(problems.some((p) => p.includes('evidence.moves[0] must be one of')));
});

test('each ruleset lists exactly the battle-time rules of its Showdown format, with no team preview', () => {
  for (const rs of Object.values(RULESETS)) {
    assert.deepEqual(check('BattleRuleset', rs), [], rs.id);
    const f = describeFormat(rs.battle_format);
    assert.deepEqual([...rs.in_battle].sort(), f.in_battle, `${rs.id}: declared in-battle rules`);
    assert.equal(f.team_preview, false, `${rs.id}: Gen 4 has no team preview`);
    assert.equal(rs.information.team_preview, false);
  }
  const hist = describeFormat(RULESETS['gen4-historical'].battle_format);
  for (const clause of ['Sleep Clause Mod', 'Species Clause', 'OHKO Clause', 'Evasion Moves Clause', 'Freeze Clause Mod']) {
    assert.ok(!hist.in_battle.includes(clause) && !hist.validator.includes(clause), `historical has no ${clause}`);
  }
  const ou = describeFormat('gen4ou');
  for (const clause of ['Species Clause', 'Sleep Moves Clause', 'Evasion Abilities Clause', 'OHKO Clause']) {
    assert.ok(ou.validator.includes(clause), `Gen 4 OU validates ${clause}`);
  }
  assert.ok(ou.in_battle.includes('Freeze Clause Mod'));
});

test('a job writes its defaults out and carries the contract and engine versions', () => {
  const job = makeJob({
    ruleset: 'gen4-blackthorn', seed: 'x', n: 4,
    a: { team: loadTeam('me-heartgold.standardized'), profile: baselineProfile('random') },
    b: { team: loadTeam('platinum-cynthia.standardized'), profile: baselineProfile('random') },
  });
  assert.equal(job.contract, CONTRACT_VERSION);
  assert.deepEqual(job.engine, { name: ENGINE.name, version: ENGINE.version });
  assert.deepEqual(job.trials, { n: 4, seed: 'x', pairing: 'mirrored', turn_limit: 1000 });
  assert.equal(job.scenario.lens, 'standardized');
  assert.deepEqual(check('SimulationJob', job), []);
});

test('the committed fixtures are what the Trainer Library produces today (read-only)', (t) => {
  if (!fs.existsSync(LIBRARY)) { t.skip('engine/app/data/library.json is not here'); return; }
  const library = JSON.parse(fs.readFileSync(LIBRARY, 'utf8'));
  const fx = makeFixtures(library);
  for (const [name, team] of Object.entries(fx)) {
    if (name === 'profiles') continue;
    assert.deepEqual(loadTeam(name), JSON.parse(JSON.stringify(team)), `${name}: rerun node cli/make-fixtures.mjs`);
  }
});
