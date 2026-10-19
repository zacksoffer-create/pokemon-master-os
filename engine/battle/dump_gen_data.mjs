// Exports Smogon's per-generation battle data (moves, species, type chart) to pinned JSON.
// Usage: node dump_gen_data.mjs <out_dir>
import { Generations } from '@smogon/calc';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const out = process.argv[2] ?? 'data';
mkdirSync(out, { recursive: true });
const version = createRequire(import.meta.url)('@smogon/calc/package.json').version;

for (const num of [2, 3, 4]) {
  const gen = Generations.get(num);
  const moves = {};
  for (const m of gen.moves) {
    moves[m.id] = { name: m.name, type: m.type, category: m.category, bp: m.basePower,
                    priority: m.priority ?? 0, multihit: m.multihit ?? null, recoil: m.recoil ?? null,
                    drain: m.drain ?? null, flags: m.flags ?? {} };
  }
  const species = {};
  for (const s of gen.species) {
    species[s.id] = { name: s.name, types: s.types, bs: s.baseStats,
                      abilities: s.abilities ?? {}, weightkg: s.weightkg, baseSpecies: s.baseSpecies ?? null };
  }
  const types = {};
  for (const t of gen.types) types[t.name] = t.effectiveness;
  writeFileSync(`${out}/gen${num}.json`, JSON.stringify({ source: `@smogon/calc@${version}`, gen: num, moves, species, types }));
  console.log(`gen${num}: ${Object.keys(moves).length} moves, ${Object.keys(species).length} species, ${Object.keys(types).length} types`);
}
