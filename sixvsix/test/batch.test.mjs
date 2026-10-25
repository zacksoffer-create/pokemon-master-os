// The batch runner: a 100-battle job completes and its result has the 6v6 seam's shape; the counts and the interval
// add up; a battle that fails is reported (with its input log) and the batch carries on; the async runner reports
// progress and can be stopped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeJob, runJobSync, runJob, check, wilson, AGENTS, baselineProfile } from '../src/index.js';
import { loadTeam, loadProfiles } from './helpers.mjs';

const profiles = loadProfiles();
const job = (over = {}) => makeJob({
  id: 'job:batch', ruleset: 'gen4-historical', seed: 'batch-1', n: 100, lens: 'standardized',
  a: { team: loadTeam('me-heartgold.standardized'), profile: profiles['me/heartgold'] },
  b: { team: loadTeam('platinum-cynthia.standardized'), profile: { ...profiles['platinum/cynthia'], agent: 'random' } },
  ...over,
});

test('a 100-battle job completes, with the seam\'s result shape and no failures', () => {
  const r = runJobSync(job());
  assert.deepEqual(check('SimulationResult', r), []);
  for (const k of ['engine', 'format', 'a', 'b', 'lens', 'held_constant', 'varied', 'seed', 'n', 'won', 'lost', 'drew', 'battles', 'made_at']) {
    assert.ok(k in r, `seam field ${k}`);
  }
  assert.equal(r.engine, 'showdown-sim@0.10.11');
  assert.equal(r.n, 100);
  assert.equal(r.won + r.lost + r.drew, 100);
  assert.deepEqual(r.failures, []);
  assert.equal(r.battles.length, 100);
  assert.deepEqual(r.summary.by_side, { a_as_p1: { n: 50, won: r.battles.filter((b) => b.a_side === 'p1' && b.winner === 'a').length },
                                         a_as_p2: { n: 50, won: r.battles.filter((b) => b.a_side === 'p2' && b.winner === 'a').length } });
  assert.equal(r.summary.pairs.n, 50);
  for (const b of r.battles) {
    assert.ok(b.seed.startsWith('sodium,') && b.policy_seeds.a && b.policy_seeds.b && b.hash && b.input_log);
    assert.ok(Number.isInteger(b.turns) && b.left.a >= 0 && b.left.b >= 0);
  }
  assert.ok(r.battles[0].log && r.battles[0].decision_log, 'the first battle keeps its log and decisions');
  assert.ok(!r.battles[1].log && !r.battles[1].decision_log, 'the rest keep their input log only');
  assert.equal(r.summary.members.a.length, 6);
  assert.match(r.summary.reading, /of 100 won/);
});

test('the Wilson interval: 50 of 100 is about ±10 points, 100 of 100 still leaves room', () => {
  const [lo, hi] = wilson(50, 100);
  assert.ok(Math.abs(lo - 0.4038) < 1e-3 && Math.abs(hi - 0.5962) < 1e-3);
  const [lo2, hi2] = wilson(100, 100);
  assert.ok(Math.abs(lo2 - 0.963) < 1e-3 && hi2 === 1);
});

test('a battle that breaks is reported with its input log, and the batch carries on', () => {
  class Flaky {
    constructor() { this.n = 0; }
    decide(request, view, rng) {
      if (++this.n === 3 && view.side && rng.next() < 0.5) throw new Error('flaky agent');
      return new AGENTS.random().decide(request, view, rng);
    }
  }
  AGENTS.flaky = Flaky;
  try {
    const r = runJobSync(job({ n: 20, a: { team: loadTeam('me-heartgold.standardized'), profile: baselineProfile('flaky') } }));
    assert.ok(r.failures.length > 0 && r.failures.length < 20, `${r.failures.length} failures`);
    for (const f of r.failures) {
      assert.equal(f.end, 'error');
      assert.match(f.error, /flaky agent/);
      assert.ok(f.input_log.length > 2);
    }
    assert.equal(r.summary.n, 20 - r.failures.length, 'failed battles are not counted as results');
    assert.equal(r.summary.ends.error, r.failures.length);
  } finally { delete AGENTS.flaky; }
});

test('the async runner reports progress and can be stopped', async () => {
  const seen = [];
  const r = await runJob(job({ n: 10 }), { onProgress: (done, total) => seen.push([done, total]), shouldStop: () => seen.length >= 4 });
  assert.deepEqual(seen, [[1, 10], [2, 10], [3, 10], [4, 10]]);
  assert.equal(r.n, 4);
});
