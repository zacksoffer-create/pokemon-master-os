// Pokémon Builds and Team Versions <-> Showdown sets. A build is always complete here (every field explicit) so the
// engine never fills a gap silently; gaps are filled earlier, by an adapter that writes down what it filled.

import { Dex, Teams } from '@pkmn/sim';
import { assertValid } from './contract.js';
import { STATS, toID } from './util.js';

const gen4 = () => Dex.forGen(4);

/** Canonical Showdown names, so "NeverMeltIce", "Never-Melt Ice" and "nevermeltice" are one item. */
export function canonicalItem(name) {
  if (!name) return null;
  const item = gen4().items.get(toID(name));
  if (!item.exists) throw new Error(`no Gen 4 item called ${name}`);
  return item.name;
}
export function canonicalMove(name) {
  const move = gen4().moves.get(toID(name));
  if (!move.exists) throw new Error(`no move called ${name}`);
  return move.name;
}
export function canonicalSpecies(name) {
  const species = gen4().species.get(toID(name));
  if (!species.exists) throw new Error(`no species called ${name}`);
  return species.name;
}
export function canonicalAbility(name) {
  const ability = gen4().abilities.get(toID(name));
  if (!ability.exists) throw new Error(`no ability called ${name}`);
  return ability.name;
}

/**
 * Showdown sets for a team, with a unique in-battle name per member (the battle log identifies a Pokémon by its
 * name, so two of one species would otherwise be indistinguishable). Returns the sets and name -> member index.
 */
export function toShowdownSets(team) {
  assertValid('TeamVersion', team);
  const used = new Map();
  const names = [];
  const sets = team.members.map((b) => {
    const base = (b.nickname || b.species).slice(0, 16);
    const k = (used.get(base) || 0) + 1;
    used.set(base, k);
    const name = k === 1 ? base : `${base} ${k}`;
    names.push(name);
    return {
      name, species: b.species, item: b.item || '', ability: b.ability, moves: [...b.moves], nature: b.nature,
      gender: b.gender || '', evs: { ...b.evs }, ivs: { ...b.ivs }, level: b.level, shiny: !!b.shiny,
      happiness: b.happiness ?? 255,
    };
  });
  return { sets, names };
}

export function packTeam(team) {
  const { sets, names } = toShowdownSets(team);
  return { packed: Teams.pack(sets), sets, names };
}

const fullStats = (table, fallback) => Object.fromEntries(STATS.map((s) => [s, table?.[s] ?? fallback]));

/** A complete Pokémon Build from a Showdown set (a paste, or a set the adapters assembled). */
export function buildFromSet(set, meta = {}) {
  const species = gen4().species.get(set.species || set.name);
  if (!species.exists) throw new Error(`no species called ${set.species}`);
  const build = {
    kind: 'PokemonBuild',
    id: meta.id || `build:${toID(species.name)}`,
    version: meta.version || 1,
    species: species.name,
    generation: 4,
    level: set.level || 100,
    nature: set.nature || 'Hardy',
    ability: set.ability ? canonicalAbility(set.ability) : species.abilities['0'],
    item: canonicalItem(set.item),
    moves: set.moves.map(canonicalMove),
    ivs: fullStats(set.ivs, 31),
    evs: fullStats(set.evs, 0),
  };
  if (set.name && set.name !== set.species && set.name !== species.name) build.nickname = set.name;
  if (set.gender) build.gender = set.gender;
  if (set.shiny) build.shiny = true;
  if (set.happiness != null && set.happiness !== 255) build.happiness = set.happiness;
  for (const k of ['game', 'evidence', 'filled', 'source', 'parent']) if (meta[k] !== undefined) build[k] = meta[k];
  return assertValid('PokemonBuild', build);
}

/** A Team Version from a Showdown/PKHeX paste. */
export function teamFromPaste(text, meta) {
  const sets = Teams.import(text);
  if (!sets || !sets.length) throw new Error('the paste has no Pokémon in it');
  const members = sets.map((s, i) => buildFromSet(s, { id: `${meta.id}#${i + 1}`, ...meta.member }));
  return assertValid('TeamVersion', {
    kind: 'TeamVersion', id: meta.id, version: meta.version || 1, name: meta.name, generation: 4,
    members, lead: 'first', ...(meta.game ? { game: meta.game } : {}), source: meta.source || { kind: 'paste' },
  });
}

/** The team as a Showdown paste (what PKHeX and Showdown import). */
export function teamToPaste(team) {
  return Teams.export(toShowdownSets(team).sets);
}

/** A copy of the team with every member at one level (the standardized lens). */
export function atLevel(team, level, why) {
  return {
    ...team,
    members: team.members.map((m) => (m.level === level ? m : {
      ...m, level, filled: [...(m.filled || []), `level: ${level} (${why})`],
    })),
  };
}
