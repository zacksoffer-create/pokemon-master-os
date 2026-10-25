// Gen IV mechanics regression suite. Each case scripts a battle on Showdown's simulator and checks what Gen 4 does:
// switching, fainting and forced replacement, termination, status, weather, held items, setup, entry hazards,
// trapping, U-turn, Struggle, and Gen 4's own rules (the per-move physical/special split, Steel resisting Dark and
// Ghost, Electric types not immune to paralysis, 1-4 turns of sleep). These pin Showdown's Gen 4 behaviour so an
// engine update that changes it fails loudly; damage itself is checked against Smogon's calculator in damage.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dex } from '@pkmn/sim';
import { legalOptions } from '../src/agents/legal.js';
import { scripted, turnLines, hpTrail, has, indexOf } from './helpers.mjs';

const dex4 = Dex.forGen(4);

test('switching happens before moves, and the move hits the Pokémon that came in', () => {
  const { log } = scripted({
    p1: [{ species: 'Snorlax', moves: ['Body Slam'] }, { species: 'Lapras', moves: ['Surf'] }],
    p2: [{ species: 'Aerodactyl', moves: ['Aerial Ace'] }],
    steps: [{ p1: 'switch 2', p2: 'move 1' }],
  });
  const t1 = turnLines(log, 1);
  const sw = indexOf(t1, '|switch|p1a: Lapras');
  const mv = indexOf(t1, '|move|p2a: Aerodactyl|Aerial Ace|p1a: Lapras');
  assert.ok(sw >= 0 && mv > sw, t1.join('\n'));
});

test('a fainted Pokémon must be replaced, the other side waits, and the last faint ends the battle', () => {
  const { battle, log } = scripted({
    p1: [{ species: 'Mewtwo', moves: ['Swift'] }],
    p2: [{ species: 'Magikarp', name: 'Karp A', level: 1, moves: ['Splash'] }, { species: 'Magikarp', name: 'Karp B', level: 1, moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }],
  });
  assert.ok(has(log, '|faint|p2a: Karp A'));
  assert.deepEqual(battle.p2.activeRequest.forceSwitch, [true]);
  assert.equal(battle.p1.activeRequest.wait, true);
  assert.deepEqual(legalOptions(battle.p2.activeRequest).map((o) => o.choice), ['switch 2']);
  assert.ok(battle.choose('p2', 'switch 2'));
  assert.ok(battle.choose('p1', 'move 1') && battle.choose('p2', 'move 1'));
  assert.equal(battle.ended, true);
  assert.equal(battle.winner, 'P1');
  assert.ok(battle.log.includes('|win|P1'));
});

test('paralysis quarters Speed in Gen 4: a paralysed faster Pokémon now moves after a slower one', () => {
  const { battle, log } = scripted({
    p1: [{ species: 'Snorlax', moves: ['Thunder Wave', 'Body Slam'] }],
    p2: [{ species: 'Aerodactyl', moves: ['Aerial Ace'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 2', p2: 'move 1' }],
  });
  const t1 = turnLines(log, 1), t2 = turnLines(log, 2);
  assert.ok(indexOf(t1, '|move|p2a: Aerodactyl') < indexOf(t1, '|move|p1a: Snorlax'), 'Aerodactyl is faster unparalysed');
  assert.ok(has(t1, '|-status|p2a: Aerodactyl|par'));
  const aero = battle.p2.active[0];
  assert.equal(aero.getActionSpeed(), Math.floor(aero.getStat('spe', true, true) * 0.25));
  assert.equal(indexOf(t2, '|move|'), indexOf(t2, '|move|p1a: Snorlax'), 'Snorlax acts first on turn 2');
});

test('Gen 4 status immunities: Ground ignores Thunder Wave, an Electric type can still be paralysed', () => {
  const { log } = scripted({
    p1: [{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['Thunder Wave'] }],
    p2: [{ species: 'Garchomp', moves: ['Splash'] }, { species: 'Raichu', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 1', p2: 'switch 2' }],
  });
  assert.ok(has(log, '|-immune|p2a: Garchomp'));
  assert.ok(has(log, '|-status|p2a: Raichu|par'), 'Electric types gained paralysis immunity only in Gen 6');
});

test('Gen 4 sleep lasts 1 to 4 turns, and every length occurs', () => {
  const lengths = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const { log } = scripted({
      seed,
      p1: [{ species: 'Breloom', moves: ['Spore', 'Splash'] }],
      p2: [{ species: 'Blissey', moves: ['Splash'] }],
      steps: [{ p1: 'move 1', p2: 'move 1' }, ...Array.from({ length: 7 }, () => ({ p1: 'move 2', p2: 'move 1' }))],
    });
    if (!has(log, '|-status|p2a: Blissey|slp')) continue;
    const cant = log.filter((l) => l.startsWith('|cant|p2a: Blissey|slp')).length;
    assert.ok(has(log, '|-curestatus|p2a: Blissey|slp'), `seed ${seed}: never woke up`);
    lengths.add(cant);
  }
  assert.deepEqual([...lengths].sort(), [1, 2, 3, 4]);
});

test('Toxic Orb: badly poisoned at the end of the turn, then 1/16, 2/16, 3/16 of max HP (floor(max/16) × n)', () => {
  const { battle, log } = scripted({
    p1: [{ species: 'Snorlax', ability: 'Thick Fat', item: 'Toxic Orb', moves: ['Splash'] }],   // not Immunity
    p2: [{ species: 'Blissey', moves: ['Splash'] }],
    steps: Array.from({ length: 4 }, () => ({ p1: 'move 1', p2: 'move 1' })),
  });
  assert.ok(has(turnLines(log, 1), '|-status|p1a: Snorlax|tox|[from] item: Toxic Orb'));
  const max = battle.p1.active[0].maxhp;
  const trail = hpTrail(log, 'p1a: Snorlax').filter((t) => t.line.includes('[from] psn'));
  let hp = max;
  trail.slice(0, 3).forEach((t, k) => { hp -= Math.floor(max / 16) * (k + 1); assert.equal(t.hp, hp, t.line); });
});

test('Sand Stream: sandstorm for good, 1/16 to the unprotected, nothing to Rock, Ground or Steel', () => {
  const { battle, log } = scripted({
    p1: [{ species: 'Tyranitar', moves: ['Splash'] }],
    p2: [{ species: 'Blissey', moves: ['Splash'] }, { species: 'Skarmory', moves: ['Splash'] }],
    steps: [...Array.from({ length: 7 }, () => ({ p1: 'move 1', p2: 'move 1' })), { p1: 'move 1', p2: 'switch 2' },
            { p1: 'move 1', p2: 'move 1' }],
  });
  assert.ok(has(log, '|-weather|Sandstorm|[from] ability: Sand Stream|[of] p1a: Tyranitar'));
  assert.ok(!has(log, '|-weather|none'), 'ability weather has no duration in Gen 4');
  const blissey = battle.p2.pokemon.find((p) => p.name === 'Blissey');
  const first = hpTrail(log, 'p2a: Blissey').find((t) => t.line.includes('[from] Sandstorm'));
  assert.equal(first.hp, blissey.maxhp - Math.floor(blissey.maxhp / 16));
  assert.ok(!log.some((l) => /^\|-damage\|p(1a: Tyranitar|2a: Skarmory)\|.*Sandstorm/.test(l)));
});

test('Rain Dance lasts five turns, Damp Rock eight', () => {
  for (const [item, turns] of [['', 5], ['Damp Rock', 8]]) {
    const { log } = scripted({
      p1: [{ species: 'Kingdra', item, moves: ['Rain Dance', 'Splash'] }],
      p2: [{ species: 'Blissey', moves: ['Splash'] }],
      steps: [{ p1: 'move 1', p2: 'move 1' }, ...Array.from({ length: 9 }, () => ({ p1: 'move 2', p2: 'move 1' }))],
    });
    const end = log.findIndex((l) => l === '|-weather|none');
    assert.ok(end > 0, `${item || 'no item'}: the rain never ended`);
    const turnAtEnd = log.slice(0, end).filter((l) => l.startsWith('|turn|')).length;
    assert.equal(turnAtEnd, turns, item || 'no item');
  }
});

test('held items: Life Orb recoil 1/10, Leftovers 1/16, Sitrus Berry 1/4 at half HP, Lum Berry cures', () => {
  const { battle, log } = scripted({
    p1: [{ species: 'Garchomp', item: 'Life Orb', moves: ['Dragon Claw'] }],
    p2: [{ species: 'Skarmory', item: 'Leftovers', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }],
  });
  const chomp = battle.p1.active[0], skarm = battle.p2.active[0];
  const lo = hpTrail(log, 'p1a: Garchomp').find((t) => t.line.endsWith('[from] item: Life Orb'));
  assert.equal(lo.hp, chomp.maxhp - Math.floor(chomp.maxhp / 10));
  const trail = hpTrail(log, 'p2a: Skarmory');
  const heal = trail.find((t) => t.line.endsWith('[from] item: Leftovers'));
  assert.equal(heal.hp - trail[trail.indexOf(heal) - 1].hp, Math.floor(skarm.maxhp / 16));

  const sitrus = scripted({
    p1: [{ species: 'Blissey', moves: ['Seismic Toss'] }],
    p2: [{ species: 'Azelf', item: 'Sitrus Berry', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 1', p2: 'move 1' }],
  });
  const azelf = sitrus.battle.p2.active[0];
  const aTrail = hpTrail(sitrus.log, 'p2a: Azelf');
  const eat = aTrail.find((t) => t.line.includes('[from] item: Sitrus Berry'));
  assert.ok(eat, 'Sitrus Berry activated');
  assert.ok(aTrail[aTrail.indexOf(eat) - 1].hp <= azelf.maxhp / 2, 'at or under half HP');
  assert.equal(eat.hp - aTrail[aTrail.indexOf(eat) - 1].hp, Math.floor(azelf.maxhp / 4));

  const lum = scripted({
    p1: [{ species: 'Breloom', moves: ['Spore'] }],
    p2: [{ species: 'Tyranitar', item: 'Lum Berry', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }],
  });
  assert.ok(has(lum.log, '|-curestatus|p2a: Tyranitar|slp|[msg]'));
  assert.ok(has(lum.log, '|-enditem|p2a: Tyranitar|Lum Berry|[eat]'));
});

test('Choice Band locks the user into its first move until it switches', () => {
  const { battle } = scripted({
    p1: [{ species: 'Scizor', item: 'Choice Band', moves: ['Bullet Punch', 'U-turn', 'Superpower', 'Pursuit'] },
         { species: 'Blissey', moves: ['Splash'] }],
    p2: [{ species: 'Snorlax', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }],
  });
  const opts = legalOptions(battle.p1.activeRequest);
  assert.deepEqual(opts.filter((o) => o.kind === 'move').map((o) => o.label), ['Bullet Punch']);
  assert.ok(opts.some((o) => o.kind === 'switch'));
});

test('Focus Sash: a full-HP Pokémon survives a knockout blow on 1 HP and the Sash is used up', () => {
  const { log } = scripted({
    p1: [{ species: 'Mewtwo', moves: ['Swift'] }],
    p2: [{ species: 'Magikarp', level: 5, item: 'Focus Sash', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }],
  });
  assert.ok(log.some((l) => /^\|-damage\|p2a: Magikarp\|1\//.test(l)), log.join('\n'));
  assert.ok(has(log, '|-enditem|p2a: Magikarp|Focus Sash'));
});

test('setup: Swords Dance is +2 Attack, Dragon Dance +1 Attack and Speed, and boosts are lost on switching', () => {
  const { battle, log } = scripted({
    p1: [{ species: 'Gyarados', moves: ['Dragon Dance', 'Swords Dance'] }, { species: 'Blissey', moves: ['Splash'] }],
    p2: [{ species: 'Blissey', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 2', p2: 'move 1' }],
  });
  assert.ok(has(log, '|-boost|p1a: Gyarados|atk|1') && has(log, '|-boost|p1a: Gyarados|spe|1'));
  assert.ok(has(log, '|-boost|p1a: Gyarados|atk|2'));
  const gyara = battle.p1.active[0];
  assert.deepEqual([gyara.boosts.atk, gyara.boosts.spe], [3, 1]);
  battle.choose('p1', 'switch 2'); battle.choose('p2', 'move 1');
  assert.deepEqual([gyara.boosts.atk, gyara.boosts.spe], [0, 0]);
});

test('Stealth Rock: 1/8 neutral, 1/2 to a 4× weak Pokémon (Charizard), by type on every switch-in', () => {
  const { battle, log } = scripted({
    p1: [{ species: 'Swampert', moves: ['Stealth Rock'] }],
    p2: [{ species: 'Blissey', moves: ['Splash'] }, { species: 'Charizard', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 1', p2: 'switch 2' }],
  });
  assert.ok(has(log, '|-sidestart|p2: P2|move: Stealth Rock'));
  const zard = battle.p2.pokemon.find((p) => p.name === 'Charizard');
  const hit = hpTrail(log, 'p2a: Charizard').find((t) => t.line.includes('[from] Stealth Rock'));
  assert.equal(hit.hp, zard.maxhp - Math.floor(zard.maxhp / 2));
});

test('Spikes: 1/8, 1/6, 1/4 by layers; Flying types and Levitate are unaffected', () => {
  const frac = { 1: 8, 2: 6, 3: 4 };
  for (const layers of [1, 2, 3]) {
    const { battle, log } = scripted({
      p1: [{ species: 'Skarmory', moves: ['Spikes'] }],
      p2: [{ species: 'Blissey', moves: ['Splash'] }, { species: 'Snorlax', moves: ['Splash'] },
           { species: 'Gengar', moves: ['Splash'] }, { species: 'Crobat', moves: ['Splash'] }],
      steps: [...Array.from({ length: layers }, () => ({ p1: 'move 1', p2: 'move 1' })),
              { p1: 'move 1', p2: 'switch 2' }, { p1: 'move 1', p2: 'switch 3' }, { p1: 'move 1', p2: 'switch 4' }],
    });
    const lax = battle.p2.pokemon.find((p) => p.name === 'Snorlax');
    const hit = hpTrail(log, 'p2a: Snorlax').find((t) => t.line.includes('[from] Spikes'));
    assert.equal(hit.hp, lax.maxhp - Math.floor(lax.maxhp / frac[layers]), `${layers} layer(s)`);
    assert.ok(!log.some((l) => /^\|-damage\|p2a: (Gengar|Crobat)\|.*Spikes/.test(l)));
  }
});

test('Toxic Spikes: one layer poisons, two badly poison, a grounded Poison type absorbs them', () => {
  const setter = { species: 'Roserade', moves: ['Toxic Spikes', 'Splash'] };
  const lead = { species: 'Blissey', moves: ['Splash'] };
  const one = scripted({
    p1: [setter], p2: [lead, { species: 'Snorlax', ability: 'Thick Fat', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 2', p2: 'switch 2' }],
  });
  assert.ok(has(one.log, '|-status|p2a: Snorlax|psn'), 'one layer: poison');
  const two = scripted({
    p1: [setter], p2: [lead, { species: 'Lapras', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 1', p2: 'move 1' }, { p1: 'move 2', p2: 'switch 2' }],
  });
  assert.ok(has(two.log, '|-status|p2a: Lapras|tox'), 'two layers: badly poisoned');
  const absorb = scripted({
    p1: [setter], p2: [lead, { species: 'Muk', moves: ['Splash'] }, { species: 'Lapras', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 2', p2: 'switch 2' }, { p1: 'move 2', p2: 'switch 3' }],
  });
  assert.ok(has(absorb.log, '|-sideend|p2: P2|move: Toxic Spikes|[of] p2a: Muk'), 'Muk absorbs them');
  assert.ok(!has(absorb.log, '|-status|p2a: Lapras'), 'nothing left for Lapras');
});

test('Rapid Spin clears the spinner\'s own side', () => {
  const { log } = scripted({
    p1: [{ species: 'Starmie', moves: ['Rapid Spin'] }],
    p2: [{ species: 'Swampert', moves: ['Stealth Rock'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }, { p1: 'move 1', p2: 'move 1' }],
  });
  assert.ok(log.some((l) => l.startsWith('|-sideend|p1: P1|Stealth Rock|[from] move: Rapid Spin')), log.join('\n'));
});

test('U-turn asks for a switch in the middle of the turn', () => {
  const { battle } = scripted({
    p1: [{ species: 'Scizor', moves: ['U-turn'] }, { species: 'Blissey', moves: ['Splash'] }],
    p2: [{ species: 'Snorlax', moves: ['Splash'] }],
    steps: [{ p1: 'move 1', p2: 'move 1' }],
  });
  assert.deepEqual(battle.p1.activeRequest.forceSwitch, [true]);
  assert.equal(battle.turn, 1, 'still turn 1');
  assert.ok(battle.choose('p1', 'switch 2'));
  assert.equal(battle.p1.active[0].name, 'Blissey');
});

test('Struggle: with no PP left the only move is Struggle, recoil is 1/4 of max HP (Gen 4)', () => {
  const { battle, log } = scripted({
    p1: [{ species: 'Snorlax', moves: ['Body Slam'] }],
    p2: [{ species: 'Blissey', moves: ['Splash'] }],
    before: (b) => { b.p1.active[0].moveSlots[0].pp = 0; b.makeRequest(); },   // test-only: spend its PP
  });
  const opts = legalOptions(battle.p1.activeRequest);
  assert.equal(opts.filter((o) => o.kind === 'move').length, 1);
  battle.choose('p1', 'move 1'); battle.choose('p2', 'move 1');
  const lax = battle.p1.active[0];
  const recoil = battle.log.find((l) => l.startsWith('|-damage|p1a: Snorlax|') && l.endsWith('[from] recoil'));
  assert.ok(battle.log.some((l) => l.startsWith('|move|p1a: Snorlax|Struggle')), log.join('\n'));
  assert.ok(recoil);
  assert.equal(lax.hp, lax.maxhp - Math.floor(lax.maxhp / 4));
});

test('trapping: Magnet Pull holds Skarmory; the switch is refused as unavailable and the request updates', () => {
  const { battle } = scripted({
    p1: [{ species: 'Skarmory', moves: ['Brave Bird'] }, { species: 'Blissey', moves: ['Splash'] }],
    p2: [{ species: 'Magnezone', ability: 'Magnet Pull', moves: ['Thunderbolt'] }],
  });
  const req = battle.p1.activeRequest;
  assert.ok(req.active[0].maybeTrapped || req.active[0].trapped);
  if (!req.active[0].trapped) {
    assert.equal(battle.choose('p1', 'switch 2'), false);
    assert.equal(battle.p1.activeRequest.active[0].trapped, true);
  }
  assert.equal(legalOptions(battle.p1.activeRequest).some((o) => o.kind === 'switch'), false);
});

test('Gen 4 data: each move has its own category, Steel resists Dark and Ghost, no Fairy type', () => {
  assert.equal(dex4.moves.get('Shadow Ball').category, 'Special');
  assert.equal(dex4.moves.get('Crunch').category, 'Physical');
  assert.equal(dex4.moves.get('Fire Punch').category, 'Physical');
  assert.equal(Dex.forGen(3).moves.get('Shadow Ball').category, 'Physical', 'Gen 3 still splits by type');
  assert.equal(dex4.getEffectiveness('Dark', 'Steel'), -1);
  assert.equal(dex4.getEffectiveness('Ghost', 'Steel'), -1);
  assert.deepEqual(dex4.species.get('Clefable').types, ['Normal']);
  assert.deepEqual(Object.values(dex4.species.get('Snorlax').abilities), ['Immunity', 'Thick Fat']);
  assert.equal(dex4.moves.get('Scald').isNonstandard, 'Future');
});
