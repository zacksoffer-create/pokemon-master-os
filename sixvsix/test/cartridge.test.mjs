// The games' own trainer AI (src/agents/cartridge.js), against the rules Blackthorn read from the disassemblies
// (engine/battle/trainer_ai.json): BASIC, EVAL_ATTACK, EXPERT's heal quirk, the Gen 4 switch checks in order, the
// replacement after a faint, and the one-on-one engine's "more often than not" mode being deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dex } from '@pkmn/sim';
import { CartridgeAgent, kindOf } from '../src/agents/cartridge.js';
import { statsOf } from '../src/optimize/evs.js';
import { PolicyRNG } from '../src/util.js';
import { state } from './scenario.mjs';

const dex = Dex.forGen(4);
const ALL = ['AI_FLAG_BASIC', 'AI_FLAG_EVAL_ATTACK', 'AI_FLAG_EXPERT'];
const ev85 = { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 };
const iv31 = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

/** The real state of the Pokémon in front of the AI, as the battle runner gives it. */
function truth({ species, ability, item = '', hp = 1, status = '', boosts = {}, evs = ev85, nature = 'Hardy', level = 100, lastMove = null, volatiles = {} }) {
  const sp = dex.species.get(species);
  const st = statsOf(sp.name, { level, ivs: iv31, evs, nature });
  return { name: sp.name, species: sp.name, level, nature, evs, ivs: iv31, ability: ability || sp.abilities[0], item, boosts, status,
           hp, maxhp: st.hp, spe: st.spe, types: sp.types, volatiles, moves: [], lastMove };
}

const decide = (s, foe, { flags = ALL, dice = false, seed = 'cartridge' } = {}) => {
  const agent = new CartridgeAgent({ flags, dice }, { team: s.team });
  return agent.decide(s.request, s.view, new PolicyRNG(seed), { foe: truth(foe) });
};
const CHOMP = { species: 'Garchomp', ability: 'Sand Veil', nature: 'Jolly', evs: { atk: 252, spe: 252 }, moves: ['Earthquake', 'Dragon Claw', 'Fire Fang', 'Poison Jab'] };
const SCIZOR = { species: 'Scizor', ability: 'Technician', nature: 'Adamant', evs: { hp: 200, atk: 252, spe: 56 }, moves: ['Bullet Punch', 'X-Scissor', 'Superpower', 'Pursuit'] };

test('what a move is for, in the one-on-one engine\'s terms', () => {
  const k = (n) => kindOf(dex.moves.get(n), ['Normal']);
  assert.deepEqual(['Earthquake', 'Swords Dance', 'Roost', 'Rest', 'Toxic', 'Thunder Wave', 'Screech', 'Reflect', 'Substitute', 'Rain Dance', 'Roar', 'Curse'].map(k),
    ['hit', 'boost', 'heal', 'heal', 'status', 'status', 'debuff', 'screen', 'protect-sub', 'weather', 'phaze', 'boost']);
  assert.equal(kindOf(dex.moves.get('Curse'), ['Ghost']), 'utility');
});

test('BASIC: never a move the target is immune to (it reads the real target)', () => {
  const d = decide(state({ mine: [CHOMP], foe: { species: 'Skarmory' } }), { species: 'Skarmory', ability: 'Keen Eye' });
  assert.notEqual(d.label, 'Earthquake', d.why.join('\n'));
  assert.match(d.why.join(' '), /Earthquake: 90 \(-10 would fail or do nothing/);
});

test('EVAL_ATTACK: a knockout gets +4, a first-strike knockout +6', () => {
  const d = decide(state({ mine: [SCIZOR], foe: { species: 'Alakazam', hp: 0.15 } }), { species: 'Alakazam', hp: 0.15 });
  assert.equal(d.label, 'Bullet Punch', d.why.join('\n'));
  assert.match(d.why[0], /\+6 knocks out on its best roll, first/);
});

test("EXPERT's heal quirk: -8 to healing while it's faster (as the code is written), +2 when slower and under 70%", () => {
  const crobat = { species: 'Crobat', ability: 'Inner Focus', nature: 'Jolly', evs: { hp: 252, spe: 252 }, moves: ['Roost', 'Cross Poison'] };
  const fast = decide(state({ mine: [{ ...crobat, hp: 0.35 }], foe: { species: 'Snorlax' } }), { species: 'Snorlax', ability: 'Thick Fat' });
  assert.notEqual(fast.label, 'Roost', fast.why.join('\n'));
  const lax = { species: 'Snorlax', ability: 'Thick Fat', nature: 'Careful', moves: ['Rest', 'Body Slam'] };
  const slow = decide(state({ mine: [{ ...lax, hp: 0.5 }], foe: { species: 'Crobat' } }), { species: 'Crobat', ability: 'Inner Focus', evs: { hp: 252, spe: 252 } });
  assert.equal(slow.label, 'Rest', slow.why.join('\n'));
});

test('switch check 3: when none of its attacks can touch the target, it switches to one that hits it super-effectively', () => {
  const dug = { species: 'Dugtrio', ability: 'Arena Trap', moves: ['Earthquake', 'Dig'] };
  const jolt = { species: 'Jolteon', ability: 'Volt Absorb', moves: ['Thunderbolt', 'Shadow Ball'] };
  const d = decide(state({ mine: [dug, jolt], foe: { species: 'Skarmory' } }), { species: 'Skarmory', ability: 'Keen Eye' });
  assert.equal(d.label, 'Jolteon', d.why.join('\n'));
  assert.match(d.why[0], /switch check 3/);
});

test('it stays in when it has a super-effective move (90% per move)', () => {
  const s = state({ mine: [CHOMP, SCIZOR], foe: { species: 'Heatran' } });
  const d = decide(s, { species: 'Heatran', ability: 'Flash Fire', lastMove: 'Earth Power' });
  assert.equal(d.kind, 'move', d.why.join('\n'));
});

test('switch checks 6 and 7 are coin flips per move: never with the one-on-one rule, about half the time with dice', () => {
  // Alakazam has nothing that hurts Tyranitar; the bench only resists Crunch (check 7, 1/3 per move): it stays in
  const mine = [{ species: 'Alakazam', ability: 'Synchronize', moves: ['Psychic', 'Shadow Ball'] },
                { species: 'Gengar', ability: 'Levitate', moves: ['Focus Blast', 'Shadow Ball'] }];
  const det = decide(state({ mine, foe: { species: 'Tyranitar' } }), { species: 'Tyranitar', ability: 'Sand Stream', lastMove: 'Crunch' });
  assert.equal(det.kind, 'move', det.why.join('\n'));
  // after Close Combat, Gengar is immune to it and has Focus Blast (super-effective): check 6, 1/2 per move
  const bench = [{ species: 'Alakazam', ability: 'Synchronize', moves: ['Psychic', 'Shadow Ball'] },
                 { species: 'Spiritomb', ability: 'Pressure', moves: ['Shadow Sneak', 'Sucker Punch'] },
                 { species: 'Gengar', ability: 'Levitate', moves: ['Focus Blast', 'Thunderbolt'] }];
  const cc = { species: 'Tyranitar', ability: 'Sand Stream', lastMove: 'Close Combat' };
  const s6 = () => state({ mine: bench, foe: { species: 'Tyranitar' } });
  assert.equal(decide(s6(), cc).kind, 'move');   // one-on-one rule: a 1/2 chance is not "more often than not"
  let switched = 0;
  for (let i = 0; i < 60; i++) switched += decide(s6(), cc, { dice: true, seed: `c6-${i}` }).label === 'Gengar';
  assert.ok(switched > 15 && switched < 45, `switched ${switched} of 60`);
});

test('after a faint: the bench Pokémon with the best super-effective matchup', () => {
  const s = state({ mine: [{ ...CHOMP, hp: 0 }, { species: 'Blissey', ability: 'Natural Cure', moves: ['Seismic Toss', 'Soft-Boiled'] },
                           { species: 'Magnezone', ability: 'Magnet Pull', moves: ['Thunderbolt', 'Flash Cannon'] }],
                    foe: { species: 'Gyarados' }, forced: true });
  const d = decide(s, { species: 'Gyarados', ability: 'Intimidate' });
  assert.equal(d.label, 'Magnezone', d.why.join('\n'));
});

test('the one-on-one rule is deterministic; dice depend only on the policy seed', () => {
  const mk = () => state({ mine: [CHOMP, SCIZOR], foe: { species: 'Gyarados' } });
  const g = { species: 'Gyarados', ability: 'Intimidate' };
  const a = decide(mk(), g, { seed: 'one' }), b = decide(mk(), g, { seed: 'two' });
  assert.equal(a.choice, b.choice);
  assert.deepEqual(decide(mk(), g, { dice: true, seed: 'x' }).choice, decide(mk(), g, { dice: true, seed: 'x' }).choice);
});
