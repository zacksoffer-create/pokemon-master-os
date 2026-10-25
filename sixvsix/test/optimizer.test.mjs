// The EV optimizer (D-072): Gen 4's stat formula exactly, the rules a spread must keep, the self-lowering moves, a
// Speed benchmark found when it decides the duel, and never doing worse than the templates it starts from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Battle, Teams } from '@pkmn/sim';
import { statsOf, optimizeBuild, hitsToKO, conventionalTemplate } from '../src/optimize/evs.js';
import { buildFromSet } from '../src/teams.js';
import { battleSeed, STATS } from '../src/util.js';
import { ROOT, loadTeam } from './helpers.mjs';

const build = (set) => buildFromSet({ evs: {}, ivs: {}, ...set }, { id: `t:${set.species}` });

test("the optimizer's stat formula is the simulator's, for every fixture build", () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'fixtures/teams'))) {
    for (const m of JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/teams', f), 'utf8')).members) {
      const b = new Battle({ formatid: 'gen4anythinggoes', seed: battleSeed('stats', m.id) });
      const set = { name: m.species, species: m.species, item: m.item || '', ability: m.ability, moves: m.moves, nature: m.nature, evs: m.evs, ivs: m.ivs, level: m.level, gender: 'M' };
      b.setPlayer('p1', { name: 'a', team: Teams.pack([set]) }); b.setPlayer('p2', { name: 'b', team: Teams.pack([set]) });
      const p = b.p1.pokemon[0], ours = statsOf(m.species, m);
      assert.equal(ours.hp, p.maxhp, `${f} ${m.species} hp`);
      for (const s of ['atk', 'def', 'spa', 'spd', 'spe']) assert.equal(ours[s], p.storedStats[s], `${f} ${m.species} ${s}`);
    }
  }
});

test('every optimized spread keeps the rules: 510 at most, 252 a stat, steps of 4; nature, moves, item, ability as recorded', () => {
  for (const game of ['heartgold', 'soulsilver', 'platinum']) {
    const opt = loadTeam(`me-${game}.optimized`), base = loadTeam(`me-${game}.even85`);
    opt.members.forEach((m, i) => {
      const total = STATS.reduce((t, s) => t + m.evs[s], 0);
      assert.ok(total <= 510 && total >= 500, `${game} ${m.species}: ${total} EVs`);
      for (const s of STATS) assert.ok(m.evs[s] <= 252 && m.evs[s] % 4 === 0, `${game} ${m.species} ${s} ${m.evs[s]}`);
      const b = base.members[i];
      assert.deepEqual([m.species, m.moves, m.item, m.ability, m.ivs, m.level], [b.species, b.moves, b.item, b.ability, b.ivs, b.level]);
      const recorded = !(b.filled || []).some((x) => x.startsWith('nature:'));
      if (recorded) assert.equal(m.nature, b.nature, `${game} ${m.species}: a nature on record is kept`);
    });
  }
});

test('a move that lowers its own attacking stat loses power on each repeat', () => {
  assert.equal(hitsToKO(100, 40), 3);
  assert.equal(hitsToKO(100, 40, -2), 6);      // 40, 20, 13.3, then 10 a time at -6: six Overheats to do 100
  assert.equal(hitsToKO(100, 60, -2), 3);      // 60 + 30 + 20
  assert.equal(hitsToKO(100, 40, -1), 4);      // Superpower: 40 + 26.7 + 20 + 16
  assert.equal(hitsToKO(100, 0), 99);
});

test('finds the Speed benchmark when Speed decides the duel (Alakazam against a faster-by-one Gengar)', () => {
  const zam = build({ species: 'Alakazam', ability: 'Synchronize', item: 'Life Orb', nature: 'Modest', moves: ['Psychic'] });
  const gengar = build({ species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 } });
  const r = optimizeBuild({ ...zam, nature_locked: true }, [{ ...gengar, from: 'test' }]);
  const gengarSpeed = statsOf('Gengar', gengar).spe;
  assert.ok(r.stats.spe > gengarSpeed, `speed ${r.stats.spe} against ${gengarSpeed}`);
  assert.equal(r.score.wins_worst, 1);
  assert.ok(r.score.points >= r.best_template.points);
});

test('never does worse in its own model than the templates it starts from, or than 85 in every stat', () => {
  for (const game of ['heartgold', 'soulsilver', 'platinum']) {
    const rep = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/optimizer', `${game}.json`), 'utf8'));
    for (const m of rep.members) {
      assert.ok(m.score.points >= m.best_template.points, `${game} ${m.species}`);
      assert.ok(m.score.points >= m.flat_85.points, `${game} ${m.species}`);
      assert.ok(m.score.points >= m.conventional.points, `${game} ${m.species}`);
    }
  }
});

test('the conventional spread follows the attacks: physical, special, or the higher attacking stat on a tie', () => {
  const ours = (cats) => cats.map((cat) => ({ cat }));
  assert.equal(conventionalTemplate({ species: 'Garchomp' }, ours(['Physical', 'Physical', 'Special'])), 'fast_physical');
  assert.equal(conventionalTemplate({ species: 'Typhlosion' }, ours(['Special', 'Special', 'Physical', 'Physical'])), 'fast_special');
  assert.equal(conventionalTemplate({ species: 'Snorlax' }, []), 'fast_support');
});
