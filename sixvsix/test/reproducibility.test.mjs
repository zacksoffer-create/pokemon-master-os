// Reproducibility: identical inputs, seeds, policy settings and engine version give identical battles; every battle
// replays from its input log; nothing reads Math.random; trials are independent of each other (so a job can be split
// across a phone, a worker and the laptop and still be one job); and a job written for another engine is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeJob, runJobSync, prepareJob, runTrial, replayBattle, fingerprint, runBattle, makeAgent, PolicyRNG,
         battleSeed, trialPlan } from '../src/index.js';
import { loadTeam, loadProfiles } from './helpers.mjs';

const profiles = loadProfiles();
const job = (over = {}) => makeJob({
  id: 'job:repro', ruleset: 'gen4-historical', seed: 'repro-1', n: 24, lens: 'standardized',
  a: { team: loadTeam('me-heartgold.optimized'), profile: { ...profiles['me/heartgold'], agent: 'random' } },
  b: { team: loadTeam('platinum-cynthia.standardized'), profile: profiles['platinum/cynthia'] },
  record: { logs: 'all', decisions: 'all' },
  ...over,
});
const strip = (r) => r.battles.map(({ ms, ...b }) => b);

test('the same job twice gives the same battles, decision for decision', () => {
  const r1 = runJobSync(job()), r2 = runJobSync(job());
  assert.equal(fingerprint(r1), fingerprint(r2));
  assert.deepEqual(strip(r1), strip(r2));
  assert.deepEqual(r1.summary, r2.summary);
});

test('every battle replays from its input log to the same log', () => {
  const r = runJobSync(job({ n: 12 }));
  for (const b of r.battles) {
    const again = replayBattle(b.input_log);
    assert.equal(again.hash, b.hash, `battle ${b.i}`);
    assert.deepEqual(again.log, b.log);
  }
});

test('nothing in a job draws on Math.random', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('Math.random was called'); };
  try { runJobSync(job({ n: 6 })); } finally { Math.random = original; }
});

test('trials are independent: any one trial run alone equals the same trial inside the batch', () => {
  const j = job({ n: 10 });
  const all = runJobSync(j);
  const prepared = prepareJob(j);
  for (const i of [9, 3, 6]) {
    const { ms, ...alone } = runTrial(prepared, i);
    const { ms: _, ...inBatch } = all.battles[i];
    assert.deepEqual(alone, inBatch, `trial ${i}`);
  }
});

test('mirrored pairs share a battle seed with the sides swapped; a different job seed changes the battles', () => {
  const j = job();
  for (let k = 0; k < 5; k++) {
    const x = trialPlan(j, 2 * k), y = trialPlan(j, 2 * k + 1);
    assert.equal(x.seed, y.seed);
    assert.deepEqual([x.aSide, y.aSide], ['p1', 'p2']);
  }
  assert.notEqual(trialPlan(j, 0).seed, trialPlan(j, 2).seed);
  assert.notEqual(fingerprint(runJobSync(job({ n: 6 }))), fingerprint(runJobSync(job({ n: 6, seed: 'repro-2' }))));
});

test('the battle seed and the policy seeds are separate: same battle seed, different policy seed, different choices', () => {
  const play = (policy) => runBattle({
    formatid: 'gen4anythinggoes', seed: battleSeed('sep', 1),
    sides: {
      p1: { name: 'P1', team: loadTeam('me-heartgold.optimized'), agent: makeAgent({ agent: 'random' }), rng: new PolicyRNG(policy) },
      p2: { name: 'P2', team: loadTeam('platinum-cynthia.standardized'), agent: makeAgent({ agent: 'random' }), rng: new PolicyRNG('fixed') },
    },
  });
  assert.equal(play('one').hash, play('one').hash);
  assert.notEqual(play('one').hash, play('two').hash);
});

test('a job written for another engine version is refused rather than silently rerun', () => {
  const j = job();
  j.engine = { ...j.engine, version: '0.9.0' };
  assert.throws(() => prepareJob(j), /written for @pkmn\/sim 0\.9\.0/);
});
