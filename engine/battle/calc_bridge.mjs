// JSON-in / JSON-out bridge to Smogon's damage calculator (gen-accurate, Gen 2-4).
// stdin: [{gen, attacker: {species, level, nature, evs, ivs, ability, item, boosts}, defender: {...},
//          move, field: {weather}}]
// stdout: [{desc, damage: [min, max], percent: [min, max], ko}]
import { calculate, Generations, Pokemon, Move, Field } from '@smogon/calc';

const input = JSON.parse(await new Promise((resolve) => {
  let buf = '';
  process.stdin.on('data', (chunk) => { buf += chunk; });
  process.stdin.on('end', () => resolve(buf));
}));

const mon = (gen, p) => new Pokemon(gen, p.species, {
  level: p.level ?? 50, nature: p.nature, evs: p.evs, ivs: p.ivs,
  ability: p.ability, item: p.item, boosts: p.boosts,
});

const results = input.map((req) => {
  try {
    const gen = Generations.get(req.gen);
    const res = calculate(gen, mon(gen, req.attacker), mon(gen, req.defender), new Move(gen, req.move),
                          new Field(req.field ?? {}));
    const [lo, hi] = res.range();
    const hp = res.defender.maxHP();
    return { desc: res.desc(), damage: [lo, hi],
             percent: [+(100 * lo / hp).toFixed(1), +(100 * hi / hp).toFixed(1)],
             ko: res.kochance().text, attacker_speed: res.attacker.stats.spe, defender_speed: res.defender.stats.spe };
  } catch (err) {
    return { error: String(err.message ?? err) };
  }
});
process.stdout.write(JSON.stringify(results));
