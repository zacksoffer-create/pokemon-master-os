// The trainer agent over whole battles: it beats both baselines by a margin the interval can see, it never makes an
// invalid choice, and its identity settings change what it does in measurable, interpretable ways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeJob, runJobSync, baselineProfile, wilson } from '../src/index.js';
import { loadTeam } from './helpers.mjs';

const trainer = (params = {}, id = 'profile:test-trainer') => ({ ...baselineProfile('trainer'), id, params });
const ou = () => loadTeam('gen4ou-sample.standardized');
const run = (a, b, n, seed, record) => runJobSync(makeJob({ ruleset: 'gen4-ou', n, seed,
  a: { team: ou(), profile: a }, b: { team: ou(), profile: b }, record }));

test('the trainer beats the max-power and random baselines in a mirror match, by a clear margin', () => {
  for (const [name, opp] of [['maxpower', baselineProfile('maxpower')], ['random', baselineProfile('random')]]) {
    const r = run(trainer(), opp, 40, `vs-${name}`);
    const [lo] = wilson(r.won, r.n - r.drew);
    assert.ok(lo > 0.7, `against ${name}: ${r.won} of ${r.n} (lower bound ${lo.toFixed(2)})`);
    assert.equal(r.failures.length, 0);
    assert.equal(r.battles.reduce((t, b) => t + b.invalid, 0), 0);
  }
});

function behaviour(result) {
  const ds = result.battles.flatMap((b) => b.decision_log.filter((d) => d.side === 'a' && !d.forced && d.options.length > 1));
  const setup = ['Dragon Dance', 'Swords Dance'];
  return {
    decisions: ds.length,
    switches: ds.filter((d) => d.choice.startsWith('switch')).length / ds.length,
    setup: ds.filter((d) => setup.includes(d.label)).length / ds.length,
  };
}

test('identity is measurable: a switch-happy trainer switches more, a patient one sets up more', () => {
  const rec = { decisions: 'all' };
  const opp = trainer({}, 'profile:opp');
  const hop = behaviour(run(trainer({ switching: 100, aggression: 10, preservation: 90 }, 'profile:hop'), opp, 24, 'identity', rec));
  const stay = behaviour(run(trainer({ switching: 0, aggression: 90, preservation: 0 }, 'profile:stay'), opp, 24, 'identity', rec));
  assert.ok(hop.switches > stay.switches * 1.5 && hop.switches - stay.switches > 0.05,
    `switch rate ${hop.switches.toFixed(3)} vs ${stay.switches.toFixed(3)}`);
  const patient = behaviour(run(trainer({ patience: 100, setup_first: 100 }, 'profile:patient'), opp, 24, 'setup', rec));
  const hasty = behaviour(run(trainer({ patience: 0 }, 'profile:hasty'), opp, 24, 'setup', rec));
  assert.ok(patient.setup > hasty.setup, `setup rate ${patient.setup.toFixed(3)} vs ${hasty.setup.toFixed(3)}`);
});

test('a less competent trainer plays measurably worse against the same opponent', () => {
  const opp = trainer({}, 'profile:opp');
  const sharp = run(trainer({ competence: 100 }, 'profile:sharp'), opp, 40, 'competence');
  const sloppy = run(trainer({ competence: 30 }, 'profile:sloppy'), opp, 40, 'competence');
  assert.ok(sharp.won > sloppy.won, `${sharp.won} vs ${sloppy.won} of 40`);
});
