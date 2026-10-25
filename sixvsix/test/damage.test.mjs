// Damage parity: Showdown's simulator against Smogon's damage calculator (@smogon/calc 0.12.0, the calculator
// Blackthorn's one-on-one engine runs), in Gen 4. Two separate implementations of the damage formula must give the
// same set of damage rolls for each case: physical/special by move, STAB, type effectiveness and immunities, items,
// abilities, burn, weather, stat stages, critical hits (2× in Gen 4), screens, Explosion halving Defense, variable
// base power. Showdown's 16 damage rolls are read exactly (its random roll pinned to each of 0..15 in turn) and compared
// roll by roll with the calculator's 16. Every case must match exactly, except the few in KNOWN_DIFFERENCES: places
// where the calculator's Gen 4 code follows the cartridge's integer arithmetic and Showdown uses its modern rounding.
// Those must stay within 1 HP per roll, and a known difference that starts matching fails too (so the list stays
// true). Immunities that only act inside a real move (Flash Fire, Volt Absorb...) are checked on real battle turns.
// Also: every fixture build's stats match the calculator's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, Teams } from '@pkmn/sim';
import { calculate, Generations, Pokemon, Move, Field } from '@smogon/calc';
import { fill, loadTeam, scripted } from './helpers.mjs';
import { battleSeed } from '../src/util.js';

const gen = Generations.get(4);
const WEATHER = { Sun: 'sunnyday', Rain: 'raindance', Sand: 'sandstorm', Hail: 'hail' };

function simRolls(c) {
  const A = fill(c.attacker), D = fill(c.defender);
  A.moves = [c.move]; D.moves = ['Splash'];
  const battle = new Battle({ formatid: 'gen4anythinggoes', seed: battleSeed('damage', c.name) });
  battle.setPlayer('p1', { name: 'a', team: Teams.pack([A]) });
  battle.setPlayer('p2', { name: 'b', team: Teams.pack([D]) });
  const atk = battle.p1.active[0], def = battle.p2.active[0];
  atk.clearBoosts(); def.clearBoosts();   // undo entry abilities (Intimidate) the calculator doesn't see
  if (c.weather) battle.field.setWeather(WEATHER[c.weather], def);
  else if (battle.field.weather) battle.field.clearWeather();
  if (c.attacker.boosts) Object.assign(atk.boosts, c.attacker.boosts);
  if (c.defender.boosts) Object.assign(def.boosts, c.defender.boosts);
  if (c.attacker.status) atk.setStatus(c.attacker.status, def);
  if (c.defender.status) def.setStatus(c.defender.status, atk);
  if (c.attacker.hpFraction) atk.hp = Math.floor(atk.maxhp * c.attacker.hpFraction);
  if (c.defender.hpFraction) def.hp = Math.floor(def.maxhp * c.defender.hpFraction);
  if (c.reflect) battle.p2.addSideCondition('reflect', atk);
  if (c.lightScreen) battle.p2.addSideCondition('lightscreen', atk);
  const rolls = [];
  const random = battle.random;
  for (let pct = 85; pct <= 100; pct++) {
    battle.random = (m, n) => { if (m === 16 && n === undefined) return 100 - pct; throw new Error(`unexpected random(${m}, ${n})`); };
    const move = battle.dex.getActiveMove(c.move);
    move.willCrit = !!c.crit;
    const d = battle.actions.getDamage(atk, def, move);
    rolls.push(typeof d === 'number' ? d : 0);
  }
  battle.random = random;
  return rolls;
}

function calcRolls(c) {
  const mon = (s, other) => {
    const f = fill(s);
    return new Pokemon(gen, s.species, {
      level: f.level, nature: f.nature, evs: f.evs, ivs: f.ivs, ability: f.ability, item: f.item || undefined,
      boosts: s.boosts, status: s.status || '',
      curHP: s.hpFraction ? Math.floor(new Pokemon(gen, s.species, { level: f.level, evs: f.evs, ivs: f.ivs, nature: f.nature }).maxHP() * s.hpFraction) : undefined,
    });
  };
  const A = fill(c.attacker);
  const field = new Field({ weather: c.weather, defenderSide: { isReflect: !!c.reflect, isLightScreen: !!c.lightScreen } });
  const res = calculate(gen, mon(c.attacker), mon(c.defender), new Move(gen, c.move, { isCrit: !!c.crit, ability: A.ability, item: A.item || undefined, species: A.species }), field);
  return Array.isArray(res.damage) ? [...res.damage] : Array(16).fill(res.damage);
}

const P = (species, extra = {}) => ({ species, ...extra });
const CASES = [
  { name: 'physical STAB, Choice Band, super effective in sand', attacker: P('Garchomp', { item: 'Choice Band', nature: 'Jolly', evs: { atk: 252, spe: 252 } }), defender: P('Tyranitar', { nature: 'Careful', evs: { hp: 252, spd: 252 } }), move: 'Earthquake', weather: 'Sand' },
  { name: 'special Fighting 4× (Aura Sphere into Tyranitar)', attacker: P('Lucario', { nature: 'Timid', evs: { spa: 252 } }), defender: P('Tyranitar'), move: 'Aura Sphere' },
  { name: 'Shadow Ball is special in Gen 4 (Gengar, Life Orb)', attacker: P('Gengar', { item: 'Life Orb', nature: 'Timid', evs: { spa: 252 } }), defender: P('Alakazam'), move: 'Shadow Ball' },
  { name: 'Technician Bullet Punch, Choice Band', attacker: P('Scizor', { ability: 'Technician', item: 'Choice Band', nature: 'Adamant', evs: { atk: 252 } }), defender: P('Tyranitar'), move: 'Bullet Punch' },
  { name: 'burn halves a physical hit', attacker: P('Garchomp', { status: 'brn', evs: { atk: 252 } }), defender: P('Heatran'), move: 'Earthquake' },
  { name: 'critical hit (2× in Gen 4)', attacker: P('Garchomp', { evs: { atk: 252 } }), defender: P('Salamence'), move: 'Outrage', crit: true },
  { name: 'critical hit ignores the defender\'s +2 Defense', attacker: P('Lucario', { nature: 'Adamant', evs: { atk: 252 } }), defender: P('Snorlax', { ability: 'Thick Fat', boosts: { def: 2 } }), move: 'Close Combat', crit: true },
  { name: 'neutral by cancellation: Fighting into Steel/Flying', attacker: P('Machamp', { ability: 'No Guard' }), defender: P('Skarmory'), move: 'Cross Chop' },
  { name: 'neutral by cancellation: Ice into Water/Flying', attacker: P('Lapras'), defender: P('Gyarados'), move: 'Ice Beam' },
  { name: '+2 Attack (Swords Dance) Close Combat', attacker: P('Lucario', { boosts: { atk: 2 }, nature: 'Adamant', evs: { atk: 252 } }), defender: P('Blissey'), move: 'Close Combat' },
  { name: '-1 Attack (Intimidated) U-turn', attacker: P('Scizor', { boosts: { atk: -1 } }), defender: P('Celebi'), move: 'U-turn' },
  { name: 'Thick Fat halves Fire', attacker: P('Heatran', { nature: 'Modest', evs: { spa: 252 } }), defender: P('Snorlax', { ability: 'Thick Fat' }), move: 'Fire Blast' },
  { name: 'Levitate: Ground does nothing', attacker: P('Garchomp'), defender: P('Gengar'), move: 'Earthquake' },
  { name: 'Ghost into Normal does nothing', attacker: P('Gengar'), defender: P('Snorlax', { ability: 'Thick Fat' }), move: 'Shadow Ball' },
  { name: 'Solid Rock cuts super-effective damage', attacker: P('Swampert'), defender: P('Rhyperior', { ability: 'Solid Rock' }), move: 'Surf' },
  { name: 'sun boosts Fire', attacker: P('Charizard', { nature: 'Timid', evs: { spa: 252 } }), defender: P('Blissey'), move: 'Flamethrower', weather: 'Sun' },
  { name: 'sun weakens Water', attacker: P('Starmie'), defender: P('Blissey'), move: 'Surf', weather: 'Sun' },
  { name: 'rain boosts Water', attacker: P('Kingdra', { nature: 'Modest', evs: { spa: 252 } }), defender: P('Heatran'), move: 'Surf', weather: 'Rain' },
  { name: 'sand raises a Rock type\'s Special Defense (new in Gen 4)', attacker: P('Lapras'), defender: P('Tyranitar'), move: 'Ice Beam', weather: 'Sand' },
  { name: 'Reflect halves physical damage', attacker: P('Metagross'), defender: P('Celebi'), move: 'Meteor Mash', reflect: true },
  { name: 'Light Screen halves special damage', attacker: P('Latios'), defender: P('Tyranitar'), move: 'Draco Meteor', lightScreen: true },
  { name: 'Explosion halves Defense in Gen 4', attacker: P('Metagross', { nature: 'Adamant', evs: { atk: 252 } }), defender: P('Blissey'), move: 'Explosion' },
  { name: 'Expert Belt on a super-effective hit', attacker: P('Lucario', { item: 'Expert Belt' }), defender: P('Tyranitar'), move: 'Close Combat' },
  { name: 'Muscle Band', attacker: P('Infernape', { item: 'Muscle Band' }), defender: P('Celebi'), move: 'Close Combat' },
  { name: 'Wise Glasses', attacker: P('Starmie', { item: 'Wise Glasses' }), defender: P('Heatran'), move: 'Surf' },
  { name: 'Never-Melt Ice Ice Shard into Garchomp (4×)', attacker: P('Mamoswine', { item: 'Never-Melt Ice', nature: 'Adamant', evs: { atk: 252 } }), defender: P('Garchomp'), move: 'Ice Shard' },
  { name: 'Choice Specs Draco Meteor', attacker: P('Latios', { item: 'Choice Specs', nature: 'Timid', evs: { spa: 252 } }), defender: P('Skarmory'), move: 'Draco Meteor' },
  { name: 'Adaptability doubles STAB', attacker: P('Porygon-Z', { ability: 'Adaptability' }), defender: P('Blissey'), move: 'Tri Attack' },
  { name: 'Huge Power', attacker: P('Azumarill', { ability: 'Huge Power' }), defender: P('Heatran'), move: 'Waterfall' },
  { name: 'Blaze at a third of HP', attacker: P('Typhlosion', { ability: 'Blaze', hpFraction: 0.3 }), defender: P('Blissey'), move: 'Flamethrower' },
  { name: 'Hustle boosts physical moves only (Cynthia\'s Togekiss): Air Slash', attacker: P('Togekiss', { ability: 'Hustle' }), defender: P('Lucario'), move: 'Air Slash' },
  { name: 'Hustle on a physical move', attacker: P('Togekiss', { ability: 'Hustle' }), defender: P('Snorlax', { ability: 'Thick Fat' }), move: 'Body Slam' },
  { name: 'Iron Fist', attacker: P('Hitmonchan', { ability: 'Iron Fist' }), defender: P('Garchomp'), move: 'Ice Punch' },
  { name: 'Dry Skin takes more from Fire', attacker: P('Heatran'), defender: P('Toxicroak', { ability: 'Dry Skin' }), move: 'Flamethrower' },
  { name: 'Heatproof halves Fire', attacker: P('Heatran'), defender: P('Bronzong', { ability: 'Heatproof' }), move: 'Flamethrower' },
  { name: 'Marvel Scale raises Defense when statused (Cynthia\'s Milotic)', attacker: P('Garchomp'), defender: P('Milotic', { ability: 'Marvel Scale', status: 'par' }), move: 'Dragon Claw' },
  { name: 'Guts: burned and boosted, no burn halving', attacker: P('Heracross', { ability: 'Guts', status: 'brn' }), defender: P('Blissey'), move: 'Megahorn' },
  { name: 'Tinted Lens doubles a resisted hit', attacker: P('Yanmega', { ability: 'Tinted Lens' }), defender: P('Heatran'), move: 'Bug Buzz' },
  { name: 'Gyro Ball (power from Speed)', attacker: P('Bronzong', { nature: 'Brave' }), defender: P('Gengar'), move: 'Gyro Ball' },
  { name: 'Low Kick (power from weight)', attacker: P('Lucario'), defender: P('Snorlax'), move: 'Low Kick' },
  { name: 'Eruption at full HP', attacker: P('Typhlosion'), defender: P('Blissey'), move: 'Eruption' },
  { name: 'Facade when burned (Gen 4: doubled, and the burn still halves it)', attacker: P('Snorlax', { status: 'brn' }), defender: P('Blissey'), move: 'Facade' },
  { name: 'Seismic Toss: the level in damage', attacker: P('Blissey'), defender: P('Garchomp'), move: 'Seismic Toss' },
  { name: 'Light Ball doubles Pikachu\'s Attack and Special Attack (Gen 4)', attacker: P('Pikachu', { item: 'Light Ball' }), defender: P('Gyarados'), move: 'Volt Tackle' },
  { name: 'Light Ball, special', attacker: P('Pikachu', { item: 'Light Ball' }), defender: P('Gyarados'), move: 'Thunderbolt' },
  { name: 'Soul Dew raises Latias\' Special Attack (Gen 4)', attacker: P('Latias', { item: 'Soul Dew' }), defender: P('Tyranitar'), move: 'Dragon Pulse' },
  { name: 'Hidden Power Grass, power from IVs (Gen 4)', attacker: P('Heatran', { ivs: { atk: 30, spa: 30 } }), defender: P('Swampert'), move: 'Hidden Power Grass' },
  { name: 'Spiritomb\'s Dark Pulse into Typhlosion (the fixture battle)', attacker: P('Spiritomb', { level: 100, ivs: { hp: 30, atk: 30, def: 30, spa: 30, spd: 30, spe: 30 } }), defender: P('Typhlosion', { evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 } }), move: 'Dark Pulse' },
];

/**
 * Where Showdown and the calculator differ, and why. In each, the calculator's Gen 4 code does the cartridge's integer
 * arithmetic (multiply, then divide and drop the remainder, one step at a time) and Showdown doesn't:
 */
const KNOWN_DIFFERENCES = {
  'neutral by cancellation: Fighting into Steel/Flying': { max_hp: 1, why: 'type effectiveness: the calculator applies ' +
    "each defending type's multiplier in turn with a floor (×½ then ×2, in the type chart's order); Showdown nets them to ×1 first" },
  'neutral by cancellation: Ice into Water/Flying': { max_hp: 1, why: 'the same: ×½ for Water and ×2 for Flying, floored ' +
    'in turn by the calculator, netted by Showdown' },
  'Expert Belt on a super-effective hit': { max_hp: 1, why: 'the calculator multiplies by 1.2 and floors; Showdown uses ' +
    'its 4096-based modifier (4915/4096), which rounds some rolls up by 1' },
  'Dry Skin takes more from Fire': { max_hp: 3, why: 'base power: the calculator raises it to floor(95 × 1.25) = 118; ' +
    "Showdown's 4096-based modifier gives 119, about 0.85% more on every roll" },
  'Gyro Ball (power from Speed)': { max_hp: 2, why: "base power: the calculator's Gen 4 code uses floor(25 × target Speed / " +
    "user Speed) = 70 here; Showdown adds 1 (the Gen 5+ formula, which the calculator's own Gen 5+ code also uses) for 71" },
};

for (const c of CASES) {
  test(`damage parity: ${c.name}`, () => {
    const sim = simRolls(c), calc = calcRolls(c);
    const label = `${c.attacker.species} ${c.move} → ${c.defender.species}`;
    if (!KNOWN_DIFFERENCES[c.name]) {
      assert.deepEqual(sim, calc, label);
      return;
    }
    const worst = Math.max(...sim.map((d, i) => Math.abs(d - calc[i])));
    assert.notEqual(worst, 0, `${label} now matches exactly: take it off KNOWN_DIFFERENCES`);
    const allowed = KNOWN_DIFFERENCES[c.name].max_hp;
    assert.ok(worst <= allowed, `${label}: a roll differs by ${worst} HP (allowed: ${allowed})\n sim  ${sim}\n calc ${calc}`);
  });
}

test('immunities that act inside a real move: Flash Fire, Volt Absorb, Water Absorb, Levitate, Wonder Guard', () => {
  const cases = [
    ['Infernape', 'Flamethrower', 'Heatran', 'Flash Fire', '|-start|p2a: Heatran|ability: Flash Fire'],
    ['Raichu', 'Thunderbolt', 'Jolteon', 'Volt Absorb', '|-immune|p2a: Jolteon|[from] ability: Volt Absorb'],
    ['Starmie', 'Surf', 'Lapras', 'Water Absorb', '|-immune|p2a: Lapras|[from] ability: Water Absorb'],
    ['Garchomp', 'Earthquake', 'Gengar', 'Levitate', '|-immune|p2a: Gengar|[from] ability: Levitate'],
    ['Garchomp', 'Dragon Claw', 'Shedinja', 'Wonder Guard', '|-immune|p2a: Shedinja|[from] ability: Wonder Guard'],
  ];
  for (const [atk, move, def, ability, line] of cases) {
    const { log } = scripted({ p1: [{ species: atk, moves: [move] }], p2: [{ species: def, ability, moves: ['Splash'] }],
                               steps: [{ p1: 'move 1', p2: 'move 1' }] });
    assert.ok(log.includes(line), `${atk} ${move} → ${def}:\n${log.join('\n')}`);
    assert.ok(!log.some((l) => l.startsWith(`|-damage|p2a: ${def}|`)), `${def} took damage`);
    const res = calculate(gen, new Pokemon(gen, atk), new Pokemon(gen, def, { ability }), new Move(gen, move), new Field());
    assert.deepEqual([...new Set([res.damage].flat())], [0], `the calculator agrees ${def} takes nothing`);
  }
});

test('stats parity: every fixture build has the calculator\'s stats', () => {
  for (const name of ['me-heartgold.optimized', 'me-heartgold.authentic', 'platinum-cynthia.standardized',
                      'platinum-cynthia.authentic', 'gen4ou-sample.standardized']) {
    const team = loadTeam(name);
    for (const m of team.members) {
      const battle = new Battle({ formatid: 'gen4anythinggoes', seed: battleSeed('stats', m.id) });
      const set = { name: m.species, species: m.species, item: m.item || '', ability: m.ability, moves: m.moves,
                    nature: m.nature, evs: m.evs, ivs: m.ivs, level: m.level, gender: 'M' };
      battle.setPlayer('p1', { name: 'a', team: Teams.pack([set]) });
      battle.setPlayer('p2', { name: 'b', team: Teams.pack([set]) });
      const sim = battle.p1.pokemon[0];
      const calc = new Pokemon(gen, m.species, { level: m.level, nature: m.nature, evs: m.evs, ivs: m.ivs });
      assert.equal(sim.maxhp, calc.maxHP(), `${name} ${m.species} HP`);
      for (const s of ['atk', 'def', 'spa', 'spd', 'spe']) assert.equal(sim.storedStats[s], calc.rawStats[s], `${name} ${m.species} ${s}`);
    }
  }
});
