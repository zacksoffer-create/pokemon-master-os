// Whole battles: every pairing of fixture teams and agents plays to a finish with no invalid decision, the mechanics
// the plan lists all happen inside ordinary battles, a side never sees what it shouldn't, the turn limit ends a
// battle as a draw, and knockouts are credited the way analyze.js says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBattle, makeAgent, PolicyRNG, battleSeed, SideView, analyzeLog, attackScore } from '../src/index.js';
import { loadTeam } from './helpers.mjs';
import { Battle, Teams, extractChannelMessages } from '@pkmn/sim';
import { fill } from './helpers.mjs';

const MATCHUPS = [
  ['gen4anythinggoes', 'me-heartgold.standardized', 'platinum-cynthia.standardized'],
  ['gen4anythinggoes', 'me-heartgold.authentic', 'platinum-cynthia.authentic'],
  ['gen4ou', 'gen4ou-sample.standardized', 'gen4ou-sample.standardized'],
  ['gen4anythinggoes', 'gen4ou-sample.standardized', 'me-heartgold.standardized'],
];
const PAIRINGS = [['random', 'random'], ['maxpower', 'random'], ['maxpower', 'maxpower']];

function play(formatid, t1, t2, a1, a2, i, extra = {}) {
  return runBattle({
    formatid, seed: battleSeed('battle-test', `${t1}|${t2}|${a1}|${a2}|${i}`),
    sides: {
      p1: { name: 'P1', team: loadTeam(t1), agent: makeAgent({ agent: a1 }), rng: new PolicyRNG(`a${i}`) },
      p2: { name: 'P2', team: loadTeam(t2), agent: makeAgent({ agent: a2 }), rng: new PolicyRNG(`b${i}`) },
    },
    ...extra,
  });
}

const all = [];
for (const [formatid, t1, t2] of MATCHUPS) {
  for (const [a1, a2] of PAIRINGS) {
    for (let i = 0; i < 12; i++) all.push({ formatid, t1, t2, a1, a2, r: play(formatid, t1, t2, a1, a2, i) });
  }
}

test(`${MATCHUPS.length * PAIRINGS.length * 12} complete battles: each ends, with no invalid decision and no engine error`, () => {
  for (const { t1, t2, a1, a2, r } of all) {
    const label = `${t1} (${a1}) vs ${t2} (${a2}) seed ${r.seed}`;
    assert.equal(r.error, null, label);
    assert.ok(['win', 'tie'].includes(r.end), `${label}: ended ${r.end}`);
    assert.equal(r.counts.invalid, 0, `${label}: invalid choices`);
    assert.ok(r.turns > 0);
    if (r.end === 'win') {
      const loser = r.winner === 'p1' ? 'p2' : 'p1';
      assert.equal(r.left[loser], 0, `${label}: the loser has nobody left`);
      assert.ok(r.left[r.winner] > 0);
    }
  }
});

test('inside ordinary battles: switches, forced replacements, status, weather, items, setup, hazards, U-turn, crits, misses', () => {
  const lines = all.flatMap(({ r }) => r.log);
  const decisions = all.flatMap(({ r }) => r.decisions);
  const seen = {
    'a voluntary switch': decisions.some((d) => !d.forced && d.choice.startsWith('switch')),
    'a forced replacement': decisions.some((d) => d.forced),
    'a faint': lines.some((l) => l.startsWith('|faint|')),
    'paralysis or poison': lines.some((l) => /^\|-status\|.*\|(par|psn|tox)/.test(l)),
    'sleep (Rest)': lines.some((l) => /^\|-status\|.*\|slp/.test(l)),
    'Sand Stream': lines.some((l) => l.startsWith('|-weather|Sandstorm|[from] ability: Sand Stream')),
    'sandstorm damage': lines.some((l) => l.includes('[from] Sandstorm')),
    Leftovers: lines.some((l) => l.endsWith('[from] item: Leftovers')),
    'Life Orb recoil': lines.some((l) => l.endsWith('[from] item: Life Orb')),
    'Black Sludge': lines.some((l) => l.endsWith('[from] item: Black Sludge')),
    'a berry eaten': lines.some((l) => /^\|-enditem\|.*Berry\|\[eat\]/.test(l)),
    'Dragon Dance boosts': lines.some((l) => l.startsWith('|-boost|') && l.includes('|spe|')),
    'Stealth Rock damage': lines.some((l) => l.includes('[from] Stealth Rock')),
    'Spikes damage': lines.some((l) => l.includes('[from] Spikes')),
    'U-turn': lines.some((l) => l.includes('|U-turn|')),
    Intimidate: lines.some((l) => l.startsWith('|-ability|') && l.includes('|Intimidate|')),
    'a critical hit': lines.some((l) => l.startsWith('|-crit|')),
    'a miss': lines.some((l) => l.startsWith('|-miss|')),
    'a super-effective hit': lines.some((l) => l.startsWith('|-supereffective|')),
    'an immunity': lines.some((l) => l.startsWith('|-immune|')),
  };
  const missing = Object.entries(seen).filter(([, v]) => !v).map(([k]) => k);
  assert.deepEqual(missing, []);
});

test('the max-power baseline beats the random one, so decisions matter to the result', () => {
  const rows = all.filter((x) => x.a1 === 'maxpower' && x.a2 === 'random');
  const won = rows.filter((x) => x.r.winner === 'p1').length;
  assert.ok(won / rows.length >= 0.75, `${won} of ${rows.length}`);
});

test('a side sees only its own channel: no team preview, the foe\'s HP as a percentage, its bench only as it arrives', () => {
  const b = new Battle({ formatid: 'gen4ou', seed: battleSeed('info', 1) });
  const team = loadTeam('gen4ou-sample.standardized');
  const sets = team.members.map((m) => ({ ...fill({ species: m.species, moves: m.moves }), item: m.item, ability: m.ability }));
  b.setPlayer('p1', { name: 'P1', team: Teams.pack(sets) });
  b.setPlayer('p2', { name: 'P2', team: Teams.pack(sets) });
  b.choose('p1', 'move 2'); b.choose('p2', 'move 1');   // p1 Surf, p2 Stealth Rock
  const p1 = extractChannelMessages(b.log.join('\n'), [1])[1];
  assert.ok(!p1.some((l) => l.startsWith('|poke|') || l.startsWith('|teampreview')));
  for (const species of ['Skarmory', 'Scizor', 'Gengar', 'Heatran', 'Gyarados']) {
    assert.ok(!p1.some((l) => l.startsWith('|switch|p2a') && l.includes(species)), `p1 never saw p2's ${species}`);
  }
  const foeHp = p1.filter((l) => /^\|-damage\|p2a/.test(l));
  assert.ok(foeHp.length && foeHp.every((l) => /\|\d+\/100/.test(l) || /\|0 fnt/.test(l)), foeHp.join('\n'));
  const view = new SideView('p1');
  view.update(p1);
  assert.deepEqual(view.snapshot().foe.known_moves, ['Stealth Rock'], 'only the move it has used');
  assert.equal(view.snapshot().foe_seen, 1);
});

test('the turn limit ends a battle as a draw, and the replay ends the same way', async () => {
  const r = play('gen4anythinggoes', 'me-heartgold.standardized', 'platinum-cynthia.standardized', 'random', 'random', 0, { turnLimit: 3 });
  assert.equal(r.end, 'turn-limit');
  assert.equal(r.winner, null);
  const { replayBattle } = await import('../src/index.js');
  const again = replayBattle(r.inputLog);
  assert.equal(again.hash, r.hash);
});

test('trapping in a real battle: an unrevealed Magnet Pull makes a switch unavailable, never invalid', () => {
  let unavailable = 0;
  for (let i = 0; i < 20; i++) {
    const mk = (species, ability, moves) => ({ kind: 'PokemonBuild', id: species, version: 1, species, generation: 4, level: 100,
      nature: 'Hardy', ability, item: null, moves, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } });
    const team = (id, members) => ({ kind: 'TeamVersion', id, version: 1, name: id, generation: 4, members, lead: 'first' });
    const r = runBattle({
      formatid: 'gen4anythinggoes', seed: battleSeed('trap', i),
      sides: {
        p1: { name: 'P1', team: team('steel', [mk('Skarmory', 'Keen Eye', ['Brave Bird', 'Roost']), mk('Blissey', 'Natural Cure', ['Seismic Toss'])]),
              agent: makeAgent({ agent: 'random' }), rng: new PolicyRNG(`t${i}`) },
        p2: { name: 'P2', team: team('magnet', [mk('Magnezone', 'Magnet Pull', ['Flash Cannon', 'Mirror Shot'])]),
              agent: makeAgent({ agent: 'random' }), rng: new PolicyRNG(`u${i}`) },
      },
    });
    assert.equal(r.counts.invalid, 0);
    unavailable += r.counts.unavailable;
  }
  assert.ok(unavailable > 0);
});

test('knockout credit: direct, hazard, status and self knockouts', () => {
  const names = { p1: ['Skarmory', 'Gengar'], p2: ['Blissey', 'Charizard', 'Metagross'] };
  const log = [
    '|switch|p1a: Skarmory|Skarmory, M|334/334', '|switch|p2a: Charizard|Charizard, M|297/297', '|turn|1',
    '|move|p1a: Skarmory|Stealth Rock|p2a: Charizard', '|-sidestart|p2: P2|move: Stealth Rock',
    '|move|p2a: Charizard|Flamethrower|p1a: Skarmory', '|-damage|p1a: Skarmory|200/334', '|turn|2',
    '|move|p1a: Skarmory|Brave Bird|p2a: Charizard', '|-damage|p2a: Charizard|100/297',
    '|-damage|p1a: Skarmory|180/334|[from] Recoil', '|turn|3',
    '|switch|p2a: Blissey|Blissey, F|651/651', '|move|p1a: Skarmory|Toxic|p2a: Blissey', '|-status|p2a: Blissey|tox',
    '|-damage|p2a: Blissey|10/651 tox|[from] psn', '|turn|4',
    '|switch|p2a: Charizard|Charizard, M|100/297', '|-damage|p2a: Charizard|0 fnt|[from] Stealth Rock', '|faint|p2a: Charizard',
    '|switch|p2a: Blissey|Blissey, F|10/651 tox', '|turn|5',
    '|move|p1a: Skarmory|Roost|p1a: Skarmory', '|-damage|p2a: Blissey|0 fnt|[from] psn', '|faint|p2a: Blissey',
    '|switch|p2a: Metagross|Metagross|364/364', '|turn|6', '|switch|p1a: Gengar|Gengar, M|261/261',
    '|move|p2a: Metagross|Explosion|p1a: Gengar|[miss]', '|faint|p2a: Metagross', '|win|P1',
  ];
  const a = analyzeLog(log, names);
  assert.deepEqual(a.kos.map((k) => [k.fainted, k.by, k.how]), [
    ['Charizard', 'Skarmory', 'hazard'], ['Blissey', 'Skarmory', 'status'], ['Metagross', null, 'self']]);
  const skarm = a.p1.find((m) => m.name === 'Skarmory');
  assert.equal(skarm.kos, 2);
  assert.equal(skarm.status_inflicted, 1);
  assert.ok(Math.abs(skarm.damage_dealt - (100 * 197 / 297 + 100 * 100 / 297 + 100 * 641 / 651 + 100 * 10 / 651)) < 0.2);
});

test('on real battles, every faint is in the knockout list once and credited knockouts add up', () => {
  for (const { r } of all) {
    const faints = r.log.filter((l) => l.startsWith('|faint|')).length;
    assert.equal(r.members.kos.length, faints);
    const credited = r.members.kos.filter((k) => k.by).length;
    const summed = [...r.members.p1, ...r.members.p2].reduce((s, m) => s + m.kos, 0);
    assert.equal(summed, credited);
  }
});

test('max-power scoring reads only public types, as Gen 4 has them', () => {
  assert.equal(attackScore('icebeam', 'Lapras', 'Garchomp'), 95 * 1.5 * 4, 'Ice Beam is 95 BP until Gen 6');
  assert.equal(attackScore('earthquake', 'Garchomp', 'Skarmory'), 0, 'Flying is immune to Ground');
  assert.equal(attackScore('shadowball', 'Gengar', 'Snorlax'), 0, 'Normal is immune to Ghost');
  assert.equal(attackScore('crunch', 'Tyranitar', 'Skarmory'), 80 * 1.5 * 0.5, 'Steel resists Dark in Gen 4');
  assert.equal(attackScore('crunch', 'Tyranitar', 'Metagross'), 80 * 1.5, 'Steel/Psychic: ×½ and ×2 cancel');
  // Levitate is an ability, unknown until it shows, so the baseline still rates Earthquake into Gengar at 2×.
  assert.equal(attackScore('earthquake', 'Garchomp', 'Gengar'), 100 * 1.5 * 2);
  assert.equal(attackScore('swordsdance', 'Garchomp', 'Gengar'), 0, 'status moves score nothing');
});
