// Read-only adapter: a Trainer Library version (engine/app/data/library.json → versions[id], the shape
// docs/design/SIXVSIX_SEAM.md documents) becomes a complete Team Version and a Trainer Profile. Nothing is written
// back. Gaps are filled the way the one-on-one engine fills them, and every fill is written on the build
// (`filled`) next to the library's own evidence class for that field:
//   nature   a neutral nature (Hardy) when none is on record (cartridge natures are unknown, fought neutral)
//   ability  the species' first ability when the version doesn't fix it
//   item     none when the record leaves it open
//   IVs      31 in every stat when none are on record
//   EVs      none for a game trainer (the games give trainers none); 85 in every stat for a blank build (D-061)
//   level    100 under the standardized lens; the record's own level under the authentic lens
// Moves are never invented: a member with no moves on record is an error here (the one-on-one engine's
// strongest-set fill is not ported, and the result would otherwise claim a set nobody chose).

import { Dex } from '@pkmn/sim';
import { assertValid } from '../contract.js';
import { canonicalAbility, canonicalItem, canonicalMove, canonicalSpecies } from '../teams.js';
import { STATS } from '../util.js';

const NEUTRAL_NATURE = 'Hardy';
const BLANK_EVS = 85;

function evidenceOf(library, v) {
  if (v.evidence) return v.evidence;
  if (v.kind !== 'cartridge') return v.party.map(() => ({}));
  return v.party.map((p) => {
    const t = { ...(library.cartridge_evidence[`${p.moves_from || 'game'}|${p.ability_set ? 1 : 0}`] || {}) };
    t.item = library.item_evidence[p.item ? 'with' : 'without'];
    return t;
  });
}

/**
 * A Team Version for library version `versionId` under a lens ('standardized' or 'authentic').
 * `level` sets the level under the authentic lens for members without one (e.g. yours at their top level).
 */
export function teamFromLibrary(library, versionId, { lens = 'standardized', level } = {}) {
  const v = library.versions?.[versionId];
  if (!v) throw new Error(`the Trainer Library has no version ${versionId}`);
  if (v.generation !== 4) throw new Error(`${versionId} is Gen ${v.generation}; this engine plays Gen 4 only`);
  const cartridge = v.kind === 'cartridge';
  const evidence = evidenceOf(library, v);
  const dex = Dex.forGen(4);

  const members = v.party.map((p, i) => {
    const filled = [];
    const ev = Object.fromEntries(Object.entries(evidence[i] || {}).map(([k, val]) => [k, [val[0], val[1]]]));
    const species = dex.species.get(canonicalSpecies(p.species));
    if (!p.moves || !p.moves.length) {
      throw new Error(`${versionId} member ${i + 1} (${p.species}) has no moves on record; nothing here invents a set`);
    }

    let lvl;
    if (lens === 'standardized') {
      lvl = 100;
      if (p.level !== 100) { filled.push(`level: 100 (standardized lens; the record says ${p.level ?? 'none'})`); }
      ev.level = ['standardized', 'Lv 100 under the standardized lens'];
    } else {
      lvl = p.level ?? level ?? 100;
      if (p.level == null) filled.push(`level: ${lvl} (authentic lens; ${level ? "the opponent's top level" : 'none on record'})`);
    }

    const nature = p.nature || NEUTRAL_NATURE;
    if (!p.nature) filled.push(`nature: ${NEUTRAL_NATURE} (neutral; ${cartridge ? 'the game sets it from a hidden value' : 'none on record'})`);

    const ability = p.ability ? canonicalAbility(p.ability) : species.abilities['0'];
    if (!p.ability) filled.push(`ability: ${ability} (the species' first ability)`);

    const item = canonicalItem(p.item);
    if (!p.item && !cartridge) filled.push('item: none (left open on the record)');

    const ivs = Object.fromEntries(STATS.map((s) => [s, p.ivs?.[s] ?? 31]));
    if (!p.ivs) filled.push('IVs: 31 in every stat (none on record)');

    let evs;
    if (p.evs) evs = Object.fromEntries(STATS.map((s) => [s, p.evs[s] ?? 0]));
    else if (cartridge) evs = Object.fromEntries(STATS.map((s) => [s, 0]));
    else {
      evs = Object.fromEntries(STATS.map((s) => [s, BLANK_EVS]));
      filled.push(`EVs: ${BLANK_EVS} in every stat (D-061, none on record)`);
    }

    const build = {
      kind: 'PokemonBuild',
      id: `library:${versionId}#${i + 1}`,
      version: 1,
      species: species.name,
      game: v.game,
      generation: 4,
      level: lvl,
      nature, ability, item,
      moves: p.moves.map(canonicalMove),
      ivs, evs,
      evidence: ev,
      filled,
      source: p.source || v.source || 'Trainer Library',
    };
    if (p.nickname) build.nickname = p.nickname;
    return assertValid('PokemonBuild', build);
  });

  return assertValid('TeamVersion', {
    kind: 'TeamVersion',
    id: `library:${versionId}`,
    version: 1,
    name: v.authored_title || [...new Set([v.name, v.title, v.encounter].filter(Boolean))].join(' · '),
    trainer: v.identity,
    game: v.game,
    generation: 4,
    members,
    lead: 'first',
    lens,
    source: {
      kind: 'blackthorn-trainer-library',
      version_id: versionId,
      library_kind: v.kind,
      record: v.source || null,
      read_only: true,
    },
  });
}

/**
 * A Trainer Profile for a library version. Phase 1 plays every trainer with a baseline agent, so the profile carries
 * the library's AI reading (cartridge flags read as tendencies and competence, authored sliders, coach settings) for
 * the record and for Phase 3; the agent named here is what actually decides.
 */
export function profileFromLibrary(library, versionId, { agent = 'maxpower', params = {} } = {}) {
  const v = library.versions?.[versionId];
  if (!v) throw new Error(`the Trainer Library has no version ${versionId}`);
  return assertValid('TrainerProfile', {
    kind: 'TrainerProfile',
    id: `profile:${versionId}:${agent}`,
    version: 1,
    name: v.authored_title || v.name,
    identity: v.identity,
    source_version: versionId,
    agent,
    params,
    information: 'partial',
    tendencies: { sliders: v.sliders || {}, coach: v.coach || {} },
    competence: { reading: v.reading || {} },
    playbook: null,
    ai_flags: v.ai_flags || [],
    reading: v.reading || {},
    note: `Phase 1: decisions come from the ${agent} baseline agent; the library's AI reading is recorded, not yet played.`,
  });
}
