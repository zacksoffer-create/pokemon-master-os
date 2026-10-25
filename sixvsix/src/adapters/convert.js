// Gen II and Gen III teams under Gen IV rules (v1, D-077). The engine plays Gen IV only; the Arena's Legends and
// all-time leagues want Crystal, FireRed and Emerald teams too (your Crystal, FireRed and Emerald sixes, Lance in
// Crystal, Steven in Emerald). A conversion is a copy of the library version with the same Pokémon, moves, items and
// levels, played under Gen IV's rules: the physical/special split by move, Gen IV abilities (Gen II's Pokémon have
// none, so the species' first, as for any build without one), Gen IV's damage and stat formulas. It is a what-if and
// says so: the original record is untouched, and the converted id (gen4:<original id>) can't be mistaken for it.

const GAME4 = { crystal: 'heartgold', gold: 'heartgold', silver: 'heartgold', firered: 'heartgold', leafgreen: 'heartgold',
                emerald: 'platinum', ruby: 'platinum', sapphire: 'platinum' };

/** The id a converted version goes by. */
export const gen4Id = (versionId) => `gen4:${versionId}`;

/** A Gen II or III library version as a Gen IV one (null for a version that's already Gen IV or has no game). */
export function asGen4(version, versionId) {
  if (!version || version.generation >= 4 || !GAME4[version.game]) return null;
  const was = `Gen ${version.generation === 2 ? 'II' : 'III'}`;
  return {
    ...version,
    id: gen4Id(versionId),
    generation: 4,
    game: GAME4[version.game],
    converted_from: { id: versionId, game: version.game, generation: version.generation },
    party: version.party.map((p) => ({
      ...p,
      moves: (p.moves || []).filter((m) => m && !/^\(?no move\)?$/i.test(String(m).trim())),
      // Gen II has no abilities; a Gen III ability carries over (the adapter checks it against Gen IV's list)
      ...(version.generation === 2 ? { ability: undefined } : {}),
    })),
    notes: [...(version.notes || []), `Played under Gen IV rules (converted from ${was}): the same Pokémon, moves, items and levels; Gen IV's physical/special split, abilities and formulas.`],
  };
}

/** The library with a Gen IV conversion of every Gen II and III version added beside the originals. */
export function withGen4(library) {
  const versions = { ...library.versions };
  for (const [id, v] of Object.entries(library.versions || {})) {
    const c = asGen4(v, id);
    if (c) versions[c.id] = c;
  }
  return { ...library, versions };
}
