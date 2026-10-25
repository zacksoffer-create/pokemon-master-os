// The trainer agent's curated decision scenarios (master plan §5, "How we validate trainer AI"): exact battle
// states where a sensible trainer's choice is clear. Each lists the acceptable choices (or the ones that are not),
// at full competence so the test checks judgment, not luck. Then: identity changes behaviour coherently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrainerAgent, paramsFromLibrary } from '../src/agents/trainer.js';
import { PolicyRNG } from '../src/util.js';
import { state } from './scenario.mjs';

const decide = (s, params = {}) => {
  const agent = new TrainerAgent({ competence: 100, ...params }, { team: s.team });
  return agent.decide(s.request, s.view, new PolicyRNG('scenario'));
};
const SCIZOR = { species: 'Scizor', item: 'Choice Band', ability: 'Technician', nature: 'Adamant', evs: { hp: 200, atk: 252, spe: 56 }, moves: ['Bullet Punch', 'U-turn', 'Superpower', 'Pursuit'] };
const CHOMP = { species: 'Garchomp', ability: 'Sand Veil', nature: 'Jolly', evs: { atk: 252, spe: 252 }, moves: ['Earthquake', 'Dragon Claw', 'Fire Fang', 'Poison Jab'] };
const LAPRAS = { species: 'Lapras', ability: 'Water Absorb', item: 'Leftovers', nature: 'Calm', moves: ['Surf', 'Ice Beam', 'Rest', 'Heal Bell'] };
const LAX = { species: 'Snorlax', ability: 'Thick Fat', item: 'Leftovers', nature: 'Careful', moves: ['Body Slam', 'Rest', 'Thunder Punch', 'Zen Headbutt'] };
const TYPH = { species: 'Typhlosion', ability: 'Blaze', nature: 'Modest', evs: { spa: 252, spe: 252 }, moves: ['Flamethrower', 'Extrasensory', 'Thunder Punch', 'Earthquake'] };
const CROBAT = { species: 'Crobat', ability: 'Inner Focus', item: 'Black Sludge', nature: 'Jolly', evs: { hp: 252, atk: 4, spe: 252 }, moves: ['Fly', 'Roost', 'U-turn', 'Toxic'] };
const LUCARIO = { species: 'Lucario', ability: 'Inner Focus', nature: 'Adamant', evs: { atk: 252, spe: 252 }, moves: ['Swords Dance', 'Close Combat', 'Ice Punch', 'Earthquake'] };

test('finishes a faster foe with priority instead of losing the race', () => {
  const d = decide(state({ mine: [SCIZOR], foe: { species: 'Alakazam', hp: 0.15, moves: ['Focus Blast'] } }));
  assert.equal(d.label, 'Bullet Punch', d.why.join('\n'));
});

test('never throws a Ground move at a Flying type', () => {
  const d = decide(state({ mine: [CHOMP], foe: { species: 'Skarmory', moves: ['Brave Bird'] } }));
  assert.notEqual(d.label, 'Earthquake', d.why.join('\n'));
});

test("knows Gengar's Levitate (its only ability in Gen 4)", () => {
  const d = decide(state({ mine: [CHOMP], foe: { species: 'Gengar', moves: ['Shadow Ball'] } }));
  assert.notEqual(d.label, 'Earthquake', d.why.join('\n'));
});

test('switches out of a losing matchup into the teammate that walls the attack', () => {
  const d = decide(state({ mine: [TYPH, LAPRAS, LAX], foe: { species: 'Swampert', moves: ['Surf'] } }));
  assert.equal(d.label, 'Lapras', d.why.join('\n'));
});

test('a favourable Swords Dance: the foe in front of it can barely touch it, five more to come', () => {
  const d = decide(state({ mine: [LUCARIO, LAX], foe: { species: 'Skarmory', moves: ['Spikes', 'Roost', 'Toxic', 'Protect'] }, turn: 2 }));
  assert.equal(d.label, 'Swords Dance', d.why.join('\n'));
});

test('no Swords Dance when it would be knocked out first', () => {
  const d = decide(state({ mine: [{ ...LUCARIO, hp: 0.3 }, LAX], foe: { species: 'Infernape', moves: ['Close Combat'] } }));
  assert.notEqual(d.label, 'Swords Dance', d.why.join('\n'));
});

test('recovers when healing outpaces the damage coming back', () => {
  const d = decide(state({ mine: [{ ...CROBAT, hp: 0.35 }], foe: { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Rest', 'Curse', 'Sleep Talk'] } }));
  assert.equal(d.label, 'Roost', d.why.join('\n'));
});

test('does not recover when barely hurt', () => {
  const d = decide(state({ mine: [{ ...CROBAT, hp: 0.9 }], foe: { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Rest', 'Curse', 'Sleep Talk'] } }));
  assert.notEqual(d.label, 'Roost', d.why.join('\n'));
});

test('lays Stealth Rock early against a full team', () => {
  const swampert = { species: 'Swampert', ability: 'Torrent', item: 'Leftovers', nature: 'Relaxed', evs: { hp: 240, def: 216 }, moves: ['Stealth Rock', 'Surf', 'Earthquake', 'Roar'] };
  const d = decide(state({ mine: [swampert], foe: { species: 'Blissey', moves: ['Seismic Toss'] }, turn: 1 }));
  assert.equal(d.label, 'Stealth Rock', d.why.join('\n'));
});

test('does not lay Stealth Rock twice', () => {
  const swampert = { species: 'Swampert', ability: 'Torrent', item: 'Leftovers', moves: ['Stealth Rock', 'Surf', 'Earthquake', 'Roar'] };
  const d = decide(state({ mine: [swampert], foe: { species: 'Blissey', moves: ['Seismic Toss'] }, conditions: { them: { stealthrock: 1 } } }));
  assert.notEqual(d.label, 'Stealth Rock', d.why.join('\n'));
});

test('puts a healthy bulky foe to sleep rather than chip it', () => {
  const breloom = { species: 'Breloom', ability: 'Poison Heal', item: 'Toxic Orb', nature: 'Adamant', evs: { atk: 252, spe: 252 }, moves: ['Spore', 'Seed Bomb', 'Mach Punch', 'Focus Punch'] };
  const d = decide(state({ mine: [breloom], foe: { species: 'Snorlax', moves: ['Body Slam'] } }));
  assert.equal(d.label, 'Spore', d.why.join('\n'));
});

test('does not try to put a sleeping foe to sleep', () => {
  const breloom = { species: 'Breloom', ability: 'Poison Heal', moves: ['Spore', 'Seed Bomb', 'Mach Punch', 'Focus Punch'] };
  const d = decide(state({ mine: [breloom], foe: { species: 'Snorlax', status: 'slp', moves: ['Body Slam'] } }));
  assert.notEqual(d.label, 'Spore', d.why.join('\n'));
});

test('sends in the counter after a faint: Lapras for Garchomp', () => {
  const d = decide(state({ mine: [{ ...TYPH, hp: 0 }, LAPRAS, { species: 'Tyranitar', ability: 'Sand Stream', moves: ['Crunch', 'Earthquake', 'Stone Edge', 'Dragon Dance'] }], forced: true,
    foe: { species: 'Garchomp', moves: ['Earthquake', 'Dragon Claw'] } }));
  assert.equal(d.label, 'Lapras', d.why.join('\n'));
});

test('switches out when choice-locked into a move the foe shrugs off', () => {
  const d = decide(state({ mine: [{ ...SCIZOR, locked: 'Bullet Punch' }, LAX, LAPRAS], foe: { species: 'Heatran', moves: ['Fire Blast'] } }));
  assert.notEqual(d.label, 'Bullet Punch', d.why.join('\n'));
});

test('keeps Explosion for when it pays: not at full HP early on', () => {
  const gengar = { species: 'Gengar', ability: 'Levitate', item: 'Life Orb', nature: 'Timid', evs: { spa: 252, spe: 252 }, moves: ['Shadow Ball', 'Focus Blast', 'Thunderbolt', 'Explosion'] };
  const d = decide(state({ mine: [gengar, LAX], foe: { species: 'Snorlax', moves: ['Body Slam'] }, turn: 1 }));
  assert.notEqual(d.label, 'Explosion', d.why.join('\n'));
});

test('identity: a cautious trainer saves a threatened ace that an aggressive one keeps in', () => {
  // Garchomp (the ace, half HP, slower) against a healthy Starmie's Surf, Lapras (Water Absorb) on the bench
  const ace = { species: 'Garchomp', ability: 'Sand Veil', nature: 'Adamant', evs: { hp: 252, atk: 252 }, moves: ['Earthquake', 'Dragon Claw', 'Fire Fang', 'Stone Edge'], hp: 0.5, ace: true };
  const skarm = { species: 'Skarmory', ability: 'Keen Eye', item: 'Leftovers', nature: 'Impish', evs: { hp: 252, def: 252 }, moves: ['Brave Bird', 'Roost', 'Spikes', 'Whirlwind'] };
  const mk = () => { const s = state({ mine: [ace, LAPRAS, skarm], foe: { species: 'Starmie', moves: ['Surf'] } }); s.team.ace = 0; return s; };
  const cautious = decide(mk(), { aggression: 10, switching: 95, preservation: 100 });
  const bold = decide(mk(), { aggression: 95, switching: 5, preservation: 0 });
  assert.equal(cautious.label, 'Lapras', cautious.why.join('\n'));
  assert.equal(bold.label, 'Earthquake', bold.why.join('\n'));
});

test("a trainer's identity is read from the Trainer Library, with where each setting came from", () => {
  const { params, source } = paramsFromLibrary({
    sliders: { offense: { value: 80 }, rigidity: { value: 60 }, bond: { value: 75 }, risk: { value: 55 } },
    reading: { competence: ['avoids moves that would fail', 'weighs damage', 'expert judgment'], tendency: ['sets up early'] },
  });
  assert.deepEqual([params.aggression, params.risk, params.switching, params.preservation, params.competence, params.setup_first],
    [80, 55, 64, 75, 91, 80]);
  assert.match(source.competence, /3 competence flags/);
});
