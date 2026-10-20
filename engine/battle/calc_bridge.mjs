// JSON-in / JSON-out bridge to Smogon's damage calculator (gen-accurate, Gen 2-4).
// stdin: [{gen, attacker: {species, level, nature, evs, ivs, ability, item, boosts}, defender: {...},
//          move, field: {weather}}]
//        or {gen, stats: {species, level, ...}} for one Pokémon's finished stats
// stdout: [{desc, damage: [min, max], percent: [min, max], ko, attacker_hp, defender_hp}] or [{stats, hp, types}]
import { calculate, Generations, Pokemon, Move, Field } from '@smogon/calc';

const input = JSON.parse(await new Promise((resolve) => {
  let buf = '';
  process.stdin.on('data', (chunk) => { buf += chunk; });
  process.stdin.on('end', () => resolve(buf));
}));

// Items and abilities by id, so "NeverMeltIce" or "Never-Melt Ice" both resolve to the calculator's name.
const toID = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const named = (table, name) => (name ? (table.get(toID(name))?.name ?? name) : undefined);
const mon = (gen, p) => new Pokemon(gen, p.species, {
  level: p.level ?? 50, nature: p.nature, evs: p.evs, ivs: p.ivs,
  ability: named(gen.abilities, p.ability), item: named(gen.items, p.item), boosts: p.boosts, status: p.status,
  curHP: p.curHP,
});

const results = input.map((req) => {
  try {
    const gen = Generations.get(req.gen);
    if (req.stats) {   // {gen, stats: {...}}: the finished stats of one Pokémon
      const p = mon(gen, req.stats);
      return { stats: p.stats, hp: p.maxHP(), types: p.types, ability: p.ability ?? null, item: p.item ?? null };
    }
    // the attacker's ability and item go on the move too, or the calculator ignores them there (Skill Link's 5 hits)
    const move = new Move(gen, req.move, { ability: named(gen.abilities, req.attacker.ability),
                                           item: named(gen.items, req.attacker.item), species: req.attacker.species });
    const res = calculate(gen, mon(gen, req.attacker), mon(gen, req.defender), move, new Field(req.field ?? {}));
    const hp = res.defender.maxHP();
    let lo = 0, hi = 0;
    try { [lo, hi] = res.range(); } catch (err) {   // the calculator throws on a hit that does nothing (an immunity)
      if (!String(err.message ?? err).includes('=== 0')) throw err;
    }
    const said = (f) => { try { return f(); } catch (err) { return ''; } };   // desc and KO text throw on 0 too
    return { desc: said(() => res.desc()) || `${req.move}: no damage`, damage: [lo, hi],
             percent: [+(100 * lo / hp).toFixed(1), +(100 * hi / hp).toFixed(1)],
             ko: lo > 0 ? said(() => res.kochance().text) : 'no damage', attacker_speed: res.attacker.stats.spe,
             defender_speed: res.defender.stats.spe, attacker_hp: res.attacker.maxHP(), defender_hp: hp };
  } catch (err) {
    return { error: String(err.message ?? err) };
  }
});
process.stdout.write(JSON.stringify(results));
