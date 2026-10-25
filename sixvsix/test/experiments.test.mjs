// The Lab's layer: the lab pack, interpretations, variations, lead strategy, resuming a battle, the worker pool,
// every experiment kind, the Strategy Report, replays and coaching. Small trial counts: these check the machinery,
// not the matchups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';
import { runExperiment, battle, coach, buildDiff, poolOf, opponentProfiles, ourProfile } from '../src/experiments.js';
import { interpret } from '../src/adapters/collections.js';
import { syncRunner } from '../src/runner.js';
import { nodeRunner } from '../src/runner-node.js';
import { withLead } from '../src/teams.js';
import { resumeBattle } from '../src/battle.js';
import { makeJob, prepareJob, runTrial, trialSides } from '../src/batch.js';

const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/lab/pack.json'), 'utf8'));
const small = { pool: 'heartgold-elite-four', n: 2 };

test('the lab pack: your teams and variations, every Gen 4 collection, both profiles per trainer', () => {
  assert.ok(pack.team_list.length >= 8);
  for (const key of ['heartgold-league', 'platinum-league', 'anime-gen4', 'ace-champion-gen4', 'journey']) assert.ok(pack.pools[key], key);
  for (const p of Object.values(pack.pools)) for (const id of p.members) assert.ok(pack.opponents[id], `${p.id}: ${id}`);
  assert.ok(pack.profiles['platinum/cynthia'].game, 'Cynthia has the cartridge AI');
  assert.equal(pack.profiles['ash/sinnoh'].game, null, 'an anime trainer has no cartridge AI');
  assert.equal(pack.pools['anime-gen4'].ruleset, 'gen4-historical', 'reconstructions are checked structurally');
});

test('interpretations shift the library reading within 0-100, and fall back where the game AI does not exist', () => {
  const profs = pack.profiles['heartgold/lance'];
  const agg = interpret(profs, 'aggressive'), cau = interpret(profs, 'cautious');
  assert.ok(agg.params.aggression > profs.trainer.params.aggression && cau.params.aggression < profs.trainer.params.aggression);
  for (const p of [agg, cau]) for (const v of Object.values(p.params)) if (typeof v === 'number') assert.ok(v >= 0 && v <= 100);
  assert.equal(interpret(profs, 'game').agent, 'game');
  const opp = opponentProfiles(pack, 'game');
  const anime = poolOf(pack, 'anime-gen4');
  assert.equal(opp.fn(anime.members[0]).agent, 'trainer');
  assert.ok(opp.fell.size > 0);
});

test('each lineup variation changes only what it names', () => {
  for (const t of pack.team_list.filter((x) => x.variation)) {
    const d = buildDiff(pack.teams[t.base], pack.teams[t.key]);
    assert.equal(d.length, 1, `${t.key}: ${JSON.stringify(d)}`);
    assert.ok(t.variation.changed.includes(d[0].to), t.key);
  }
});

test('a named lead goes first and the ace keeps its identity', () => {
  const t = pack.teams['me/heartgold'];
  const led = withLead({ ...t, lead: 'Crobat' });
  assert.equal(led.members[0].species, 'Crobat');
  assert.equal(led.members[led.ace].species, t.members[t.members.length - 1].species);
  assert.equal(led.members.length, 6);
});

test('a battle resumed at any decision with the same choices replays exactly', () => {
  const job = makeJob({ ruleset: 'gen4-blackthorn', n: 2, seed: 'resume', a: { team: pack.teams['me/platinum'], profile: ourProfile(pack, 'me/platinum') },
    b: { team: pack.opponents['platinum/cynthia'], profile: pack.profiles['platinum/cynthia'].trainer }, record: { logs: 'all', decisions: 'all', input_logs: 'all' } });
  const row = runTrial(prepareJob(job), 0);
  const choices = row.input_log.filter((l) => /^>p\d /.test(l));
  const at = Math.floor(choices.length / 2);
  const scripted = (side) => {
    const mine = choices.map((l, k) => [k, l]).filter(([k, l]) => k >= at && l.startsWith(`>${side} `)).map(([, l]) => l.slice(4));
    return { decide: () => ({ choice: mine.shift(), label: 'scripted', options: [] }) };
  };
  const { sides } = trialSides(job, 0);
  for (const s of ['p1', 'p2']) sides[s].agent = scripted(s);
  const again = resumeBattle({ inputLog: row.input_log, at, sides, record: { log: true, decisions: false, analysis: false } });
  assert.equal(again.hash, row.hash);
  assert.equal(again.winner === null ? 'draw' : again.winner, row.a_side === again.winner ? 'p1' : again.winner);
});

test('the worker pool plays exactly the battles this thread plays', async () => {
  const spec = { kind: 'league', team: 'me/soulsilver', ...small };
  const a = await runExperiment(syncRunner({ yieldEvery: 0 }), pack, spec);
  const pool = nodeRunner({ workers: 2 });
  try {
    const b = await runExperiment(pool, pack, spec);
    assert.equal(b.result.fingerprint, a.result.fingerprint);
  } finally { pool.close(); }
});

test('a league experiment: the result, the four report levels, patterns with evidence and a replay of any battle', async () => {
  const spec = { kind: 'league', team: 'me/soulsilver', ...small };
  const x = await runExperiment(syncRunner({ yieldEvery: 0 }), pack, spec);
  const r = x.report;
  assert.equal(r.outcomes.won, x.result.won);
  assert.equal(r.outcomes.n, x.result.n);
  assert.equal(r.members.length, 6);
  assert.ok(r.headline.length >= 3);
  for (const k of ['threats', 'dependencies', 'damage_by_type', 'sequencing']) assert.ok(r.team_level[k], k);
  for (const k of ['robust', 'opponent_dependent', 'needs_more_battles']) assert.ok(Array.isArray(r.interpretation[k]), k);
  for (const p of r.patterns) assert.ok(p.finding && p.evidence && p.suggestion && p.strength, p.id);
  const b0 = x.battles[0];
  const one = battle(pack, spec, b0.opponent, b0.i);
  assert.equal(one.row.winner, b0.winner);
  assert.equal(one.row.turns, b0.turns);
  assert.ok(one.turns.length > 1 && one.turns.some((t) => t.decisions.length));
});

test('coaching: the same choice changes nothing; a different one is played on the same seeds', async () => {
  const spec = { kind: 'league', team: 'me/soulsilver', ...small };
  const x = await runExperiment(syncRunner({ yieldEvery: 0 }), pack, spec);
  const b0 = x.battles[0];
  const one = battle(pack, spec, b0.opponent, b0.i);
  const at = one.row.decision_log.findIndex((d) => d.side === 'a' && !d.forced && d.options.length > 1);
  const d = one.row.decision_log[at];
  const same = await coach(pack, spec, b0.opponent, b0.i, at, { choice: d.choice }, { n: 4 });
  assert.equal(same.pairs.only_as_played + same.pairs.only_changed, 0, same.reading);
  const other = d.options.find((o) => o !== d.choice);
  const diff = await coach(pack, spec, b0.opponent, b0.i, at, { choice: other }, { n: 4 });
  assert.equal(diff.as_played.n, 4);
  assert.match(diff.reading, /instead of/);
});

test('compare, matrix, leads, styles and sensitivity all run and say what they found', async () => {
  const run = syncRunner({ yieldEvery: 0 });
  const c = await runExperiment(run, pack, { kind: 'compare', team: 'me/soulsilver', y: 'soulsilver-light-ball', ...small });
  assert.deepEqual(c.diff[0].changes.map((x) => x.field), ['item']);
  assert.ok(c.duel[0].flips.length > 0 && c.reading.length >= 2);
  const m = await runExperiment(run, pack, { kind: 'matrix', teams: ['me/soulsilver', 'soulsilver-light-ball'], interpretations: ['blackthorn', 'aggressive'], pool: 'heartgold-elite-four', n: 2 });
  assert.equal(m.cells.length, 2); assert.equal(m.cells[0].length, 2); assert.ok(m.reading[0]);
  const l = await runExperiment(run, pack, { kind: 'leads', team: 'me/platinum', pool: 'platinum-elite-four', n: 2 });
  assert.equal(l.rows.length, 6);
  const s = await runExperiment(run, pack, { kind: 'styles', team: 'me/platinum', pool: 'platinum-elite-four', n: 2, styles: ['blackthorn', 'cautious'] });
  assert.equal(s.rows.length, 2);
  const v = await runExperiment(run, pack, { kind: 'sensitivity', team: 'me/platinum', pool: 'platinum-elite-four', n: 2 });
  assert.ok(v.effects.length >= 8 && v.reading.length >= 2);
});
