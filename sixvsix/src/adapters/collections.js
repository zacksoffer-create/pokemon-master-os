// The opponent library and your variations, from Blackthorn's own records (read-only):
//   - opponent pools from the Trainer Library's collections (Elite Four, rematches, Gym Leaders, rivals, villains,
//     special battles, the Ace test pools, the anime reconstructions, your journey teams), standardized at Lv 100 with
//     85 EVs (D-072); every member checked for legality, anything left out listed with why;
//   - your lineup variations from canon/lineups.json (the scouting engine's own what-ifs: Typhlosion's January build,
//     Pikachu with its Light Ball, the former six...), each a copy of the journey team with only the named change;
//   - trainer interpretations: the same trainer as the game plays them (the cartridge AI), as Blackthorn reads them
//     (the trainer agent with the library's identity), or pushed toward aggressive or cautious play.

import { Dex } from '@pkmn/sim';
import { assertValid } from '../contract.js';
import { teamFromLibrary, profileFromLibrary, hpIvs } from './blackthorn.js';
import { validateTeam } from '../validate.js';
import { DEFAULT_PARAMS } from '../agents/trainer.js';
import { STATS } from '../util.js';

const dex = Dex.forGen(4);

/** An Opponent Pool from library versions (a collection's members, or any list). */
export function poolFromVersions(library, versionIds, { id, name, lens = 'standardized', evs = 'fill85', note, source } = {}) {
  const members = [], excluded = [];
  let structuralOnly = false;
  for (const vid of versionIds) {
    let team;
    try { team = teamFromLibrary(library, vid, { lens, evs }); }
    catch (err) { excluded.push({ id: vid, why: String(err.message).split('\n')[0] }); continue; }
    const strict = validateTeam(team, 'gen4-blackthorn');
    if (strict.ok) { members.push(team); continue; }
    const loose = validateTeam(team, 'gen4-historical');
    if (loose.ok && library.versions[vid]?.kind !== 'cartridge') {
      // a reconstruction (anime, manga): not a cartridge team, so it's checked structurally; what the cartridge
      // couldn't do is reported, not held against it
      structuralOnly = true;
      team.filled_note = strict.failed.flatMap((k) => strict.verdicts[k].problems).join('; ');
      members.push(team);
    } else {
      excluded.push({ id: vid, why: strict.failed.flatMap((k) => strict.verdicts[k].problems).slice(0, 2).join('; ') });
    }
  }
  if (!members.length) throw new Error(`no legal team in ${id}`);
  return assertValid('OpponentPool', {
    kind: 'OpponentPool', id, version: 1, name, lens, ev_policy: evs === 'fill85' ? '85 in every stat (D-072)' : "the cartridge's own",
    members, ruleset: structuralOnly ? 'gen4-historical' : 'gen4-blackthorn',
    ...(excluded.length ? { excluded } : {}),
    ...(note || structuralOnly ? { note: [note, structuralOnly ? 'reconstructions are checked structurally (they are not cartridge teams); their cartridge problems are listed on each team' : null].filter(Boolean).join('; ') } : {}),
    source: source || { kind: 'blackthorn-trainer-library', versions: versionIds },
  });
}

/** Every Gen 4 collection in the Trainer Library as an Opponent Pool. */
export function poolsFromCollections(library, { generation = 4 } = {}) {
  return library.collections.filter((c) => c.generation === generation).map((c) => poolFromVersions(library, c.members, {
    id: `pool:${c.id}`, name: c.name, source: { kind: 'blackthorn-collection', collection: c.id, version: c.version, versions: c.members },
  }));
}

/**
 * Your lineup variations (canon/lineups.json) as Team Versions: the journey team with only the named change. The
 * changed member's EVs are left to the optimizer (D-072); its moves come from the variation, or, where the record has
 * none, from the one-on-one engine's own fallback (its advance scouting files' movesets: the strongest learnable set).
 */
export function variationTeams(base, lineups, { movesets = {} } = {}) {
  const out = [];
  const chars = lineups.characters || {};
  for (const v of lineups.variations || []) {
    const team = base[v.base];
    if (!team) continue;
    const resolve = (b) => (typeof b === 'string' ? { ...chars[b], from: b } : { ...b });
    const changed = [];
    let members = team.members.map((m) => ({ ...m }));
    for (const [sp, b] of Object.entries(v.change || {})) {
      members = members.map((m) => (m.species === sp ? (changed.push(sp), rebuild(m, resolve(b), movesets[v.id], v)) : m));
    }
    for (const [old, b] of Object.entries(v.swap || {})) {
      const nb = resolve(b);
      members = members.map((m) => (m.species === old ? (changed.push(nb.species), rebuild(null, nb, movesets[v.id], v, m)) : m));
    }
    out.push(assertValid('TeamVersion', {
      ...team, id: `${team.id}~${v.id}`, name: `${team.name} · ${v.title}`, members,
      variation: { id: v.id, base: team.id, title: v.title, why: v.why || '', changed, source: 'engine/canon/lineups.json' },
    }));
  }
  return out;
}

function rebuild(old, ch, movesets = {}, v, replaced) {
  const species = dex.species.get(ch.species || old.species);
  const filled = [];
  let moves = ch.moves;
  if (!moves?.length) {
    moves = movesets[species.name];
    if (!moves) throw new Error(`variation ${v.id}: ${species.name} has no moves on record and no fallback set`);
    filled.push(`moves: ${moves.join(', ')} (no build on record; the one-on-one engine's fallback, the strongest learnable set)`);
  }
  const nature = ch.nature || (old ? old.nature : null);   // a changed build keeps the nature unless it names one
  const ability = ch.ability || (old ? old.ability : species.abilities['0']);
  if (!ch.ability && !old) filled.push(`ability: ${ability} (the species' first ability)`);
  const item = ch.item ?? (old ? old.item : null);
  let ivs = Object.fromEntries(STATS.map((s) => [s, 31]));
  const hp = moves.find((m) => m.startsWith('Hidden Power '));
  if (hp) { ivs = hpIvs(hp.replace('Hidden Power ', ''), ivs) || ivs; filled.push(`IVs: for ${hp} at full power`); }
  else filled.push('IVs: 31 in every stat (none on record)');
  if (!nature) filled.push('nature: to be chosen by the EV optimizer (none on record)');
  return {
    kind: 'PokemonBuild', id: `${(old || replaced).id}~${v.id}`, version: 1, species: species.name, game: (old || replaced).game,
    generation: 4, level: (old || replaced).level, nature: nature || 'Hardy', ability, item: item || null, moves, ivs,
    evs: Object.fromEntries(STATS.map((s) => [s, 0])),
    evidence: { moves: ['hypothetical', `a lineup variation (${v.id}): ${ch.source || ch.from || 'canon/lineups.json'}`] },
    filled: [...filled, `the ${v.title} variation (engine/canon/lineups.json)`],
    source: `variation ${v.id}`,
    ...(nature ? {} : { nature_open: true }),
  };
}

// ---- trainer interpretations ------------------------------------------------------------------------------------

/**
 * How a trainer can be played. `game` is the cartridge's own AI (only for trainers the cartridge has AI flags for);
 * `blackthorn` is the trainer agent with the identity the Trainer Library gives them; the others shift that identity
 * along one axis, as the master plan's "aggressive Lance vs conservative Lance" experiment asks.
 */
export const INTERPRETATIONS = {
  game: { label: 'As the game plays them', note: "the cartridge's own AI: its flags, its scoring, its switch checks" },
  blackthorn: { label: "Blackthorn's reading", note: 'the trainer agent with the identity the Trainer Library gives them' },
  aggressive: { label: 'An aggressive version', note: 'their reading, pushed toward attacking', shift: { aggression: 30, risk: 20, switching: -25, preservation: -25, patience: -15 } },
  cautious: { label: 'A cautious version', note: 'their reading, pushed toward safety', shift: { aggression: -30, risk: -20, switching: 25, preservation: 30, heal_line: 15 } },
  sharp: { label: 'At their sharpest', note: 'their reading, always taking the best option', set: { competence: 100 } },
  sloppy: { label: 'Off their game', note: 'their reading, picking among close options loosely', set: { competence: 55 } },
};

const clip = (x) => Math.max(0, Math.min(100, Math.round(x)));

/**
 * A profile played a given way. `profiles` holds a trainer's two library profiles ({trainer, game}); returns null
 * for `game` when the trainer has no cartridge AI (an anime reconstruction, your own teams).
 */
export function interpret(profiles, kind = 'blackthorn') {
  const def = INTERPRETATIONS[kind];
  if (!def) throw new Error(`unknown interpretation ${kind} (known: ${Object.keys(INTERPRETATIONS).join(', ')})`);
  if (kind === 'game') return profiles.game || null;
  const base = profiles.trainer;
  if (kind === 'blackthorn') return base;
  const params = { ...DEFAULT_PARAMS, ...base.params };
  for (const [k, d] of Object.entries(def.shift || {})) params[k] = clip(params[k] + d);
  for (const [k, v] of Object.entries(def.set || {})) params[k] = v;
  return { ...base, id: `${base.id}:${kind}`, params, interpretation: { kind, label: def.label, note: def.note, from: base.id } };
}
