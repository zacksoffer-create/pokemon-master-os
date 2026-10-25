// Read-only adapter: a Trainer Library version (engine/app/data/library.json → versions[id], the shape
// docs/design/SIXVSIX_SEAM.md documents) becomes a complete Team Version and a Trainer Profile. Nothing is written
// back. Gaps are filled the way the one-on-one engine fills them, and every fill is written on the build
// (`filled`) next to the library's own evidence class for that field:
//   nature   a neutral nature (Hardy) when none is on record (cartridge natures are unknown, fought neutral)
//   ability  the species' first ability when the version doesn't fix it
//   item     none when the record leaves it open
//   IVs      31 in every stat when none are on record; with Hidden Power, the IVs closest to that which give its
//            type at full power (trainers/solver.py hp_ivs, ported)
//   EVs      85 in every stat when none are on record, game trainers included (D-072: "the opposing teams have 85
//            ev points"); `evs: 'cartridge'` keeps a game trainer's real zero EVs for a strictly authentic run.
//            Your own teams start here and get optimized spreads from src/optimize/evs.js (D-072).
//   level    100 under the standardized lens; the record's own level under the authentic lens
// Moves are never invented: a member with no moves on record is an error here (the one-on-one engine's
// strongest-set fill is not ported, and the result would otherwise claim a set nobody chose).

import { Dex } from '@pkmn/sim';
import { assertValid } from '../contract.js';
import { canonicalAbility, canonicalItem, canonicalMove, canonicalSpecies } from '../teams.js';
import { paramsFromLibrary } from '../agents/trainer.js';
import { STATS } from '../util.js';

const NEUTRAL_NATURE = 'Hardy';
const BLANK_EVS = 85;

const HP_TYPES = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel',
  'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark'];
const IV_ORDER = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'];   // the games' Hidden Power bit order

/** Gen III-IV Hidden Power type and power from IVs (trainers/solver.py hidden_power). */
export function hiddenPower(ivs) {
  const t = Math.floor((IV_ORDER.reduce((a, s, i) => a + ((ivs[s] & 1) << i), 0) * 15) / 63);
  const p = Math.floor((IV_ORDER.reduce((a, s, i) => a + (((ivs[s] >> 1) & 1) << i), 0) * 40) / 63) + 30;
  return [HP_TYPES[t], p];
}

/** The IVs closest to `base` giving Hidden Power `type` at 70 power: each IV moves down by at most one
 * (trainers/solver.py hp_ivs, ported; the same tie-break). */
export function hpIvs(type, base) {
  let best = null;
  for (let mask = 0; mask < 64; mask++) {
    const ivs = {};
    IV_ORDER.forEach((s, i) => { const hi = base[s] >= 2 ? base[s] : 3; ivs[s] = (mask >> i) & 1 ? hi : hi - 1; });
    const [t, p] = hiddenPower(ivs);
    if (t !== type || p < 70) continue;
    const key = [STATS.reduce((a, s) => a + Math.abs(ivs[s] - base[s]), 0), ...STATS.map((s) => ivs[s])];
    const d = best ? key.findIndex((k, i) => k !== best.key[i]) : -1;
    if (!best || (d >= 0 && key[d] < best.key[d])) best = { key, ivs };   // Python's min() over the same tuples
  }
  return best ? best.ivs : null;
}

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
export function teamFromLibrary(library, versionId, { lens = 'standardized', level, evs: evPolicy = 'fill85' } = {}) {
  if (!['fill85', 'cartridge'].includes(evPolicy)) throw new Error(`unknown EV policy ${evPolicy}`);
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

    let ivs = Object.fromEntries(STATS.map((s) => [s, p.ivs?.[s] ?? 31]));
    const hpMove = p.moves.map(canonicalMove).find((m) => m.startsWith('Hidden Power '));
    if (!p.ivs && hpMove) {
      const type = hpMove.replace('Hidden Power ', '');
      ivs = hpIvs(type, ivs) || ivs;
      filled.push(`IVs: ${STATS.filter((s) => ivs[s] !== 31).map((s) => `${ivs[s]} ${s}`).join(', ')}, 31 otherwise (${hpMove} at full power; trainers/solver.py's rule)`);
    } else if (!p.ivs) filled.push('IVs: 31 in every stat (none on record)');

    let evs;
    if (p.evs) evs = Object.fromEntries(STATS.map((s) => [s, p.evs[s] ?? 0]));
    else if (cartridge && evPolicy === 'cartridge') evs = Object.fromEntries(STATS.map((s) => [s, 0]));
    else {
      evs = Object.fromEntries(STATS.map((s) => [s, BLANK_EVS]));
      filled.push(`EVs: ${BLANK_EVS} in every stat (${cartridge ? 'D-072: opposing teams carry 85' : 'none on record'})`);
      ev.evs = ['standardized', `${BLANK_EVS} in every stat (D-072)`];
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
 * A Trainer Profile for a library version. The trainer agent's parameters are read from the library (authored
 * sliders, coach settings, the cartridge AI flags read as competence and tendencies), each with where it came from;
 * anything the library doesn't set stays at the agent's default. A baseline agent can be named instead.
 */
export function profileFromLibrary(library, versionId, { agent = 'trainer', params } = {}) {
  const v = library.versions?.[versionId];
  if (!v) throw new Error(`the Trainer Library has no version ${versionId}`);
  const read = paramsFromLibrary(v);
  return assertValid('TrainerProfile', {
    kind: 'TrainerProfile',
    id: `profile:${versionId}:${agent}`,
    version: 1,
    name: v.authored_title || v.name,
    identity: v.identity,
    source_version: versionId,
    agent,
    params: agent === 'trainer' ? { ...read.params, ...(params || {}) } : (params || {}),
    information: 'partial',
    tendencies: { sliders: v.sliders || {}, coach: v.coach || {}, read_as: read.source },
    competence: { reading: v.reading || {} },
    playbook: null,
    ai_flags: Array.isArray(v.ai_flags) ? v.ai_flags : (v.ai_flag_names || []),   // HGSS stores a bitmask + names
    ...(typeof v.ai_flags === 'number' ? { ai_flags_raw: v.ai_flags } : {}),
    reading: v.reading || {},
    note: agent === 'trainer'
      ? 'Decisions come from the trainer agent (src/agents/trainer.js) with these parameters; tendencies.read_as says where each came from.'
      : `A ${agent} baseline agent; the library's AI reading is carried for the record.`,
  });
}
