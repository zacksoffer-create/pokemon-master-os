// Phase 2: a team against a whole pool, and paired comparisons. McNemar's exact test, the same seeds in both arms,
// the allocation written down, and a team compared with itself showing no difference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mcnemar, runPool, comparePool, poolJobs } from '../src/compare.js';
import { baselineProfile } from '../src/index.js';
import { ROOT, loadTeam } from './helpers.mjs';

const pool = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/pools/platinum-league.json'), 'utf8'));
const small = () => { const p = pool(); return { ...p, members: p.members.slice(0, 3) }; };
const mp = baselineProfile('maxpower');

test("McNemar's exact test", () => {
  assert.equal(mcnemar(0, 0), 1);
  assert.ok(Math.abs(mcnemar(2, 8) - 0.109375) < 1e-9);
  assert.ok(Math.abs(mcnemar(0, 10) - 0.001953125) < 1e-9);
  assert.ok(mcnemar(600, 700) > 0 && mcnemar(600, 700) < 0.01, 'thousands of pairs stay finite');
});

test('a pool run plays every opponent the same number of times and adds up', () => {
  const r = runPool({ team: loadTeam('me-platinum.optimized'), profile: mp, pool: small(), ruleset: 'gen4-blackthorn', n: 6, seed: 'pool-test',
                      opponentProfile: () => mp });
  assert.equal(r.per_opponent.length, 3);
  assert.equal(r.n, 18);
  assert.equal(r.won + r.lost + r.drew, 18);
  assert.equal(r.allocation, '3 opponents × 6 battles each');
  assert.equal(r.members.length, 6);
});

test('both arms of a comparison get the same seeds, battle for battle', () => {
  const args = { team: loadTeam('me-platinum.optimized'), profile: mp, pool: small(), ruleset: 'gen4-blackthorn', n: 4, seed: 's', opponentProfile: () => mp };
  const a = poolJobs(args), b = poolJobs({ ...args, team: loadTeam('me-platinum.even85') });
  a.forEach((j, k) => assert.equal(j.trials.seed, b[k].trials.seed));
});

test('a team compared with itself shows no difference', () => {
  const t = loadTeam('me-platinum.optimized');
  const c = comparePool({ x: { team: t, profile: mp, label: 'x' }, y: { team: t, profile: mp, label: 'y' }, pool: small(), ruleset: 'gen4-blackthorn',
                          n: 6, seed: 'self', opponentProfile: () => mp });
  assert.equal(c.pairs.only_x + c.pairs.only_y, 0);
  assert.equal(c.mcnemar_p, 1);
  assert.equal(c.significant, false);
  assert.deepEqual(c.margin.ci95, [0, 0]);
});
