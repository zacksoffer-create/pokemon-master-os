// Shared test helpers: scripted battles on Showdown's simulator, fixture loading, and log readers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Battle, Teams, Dex } from '@pkmn/sim';
import { omniscientLines, normalizeLog } from '../src/battle.js';
import { battleSeed } from '../src/util.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const loadTeam = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'teams', `${name}.json`), 'utf8'));
export const loadProfiles = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'profiles.json'), 'utf8'));

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** A complete Showdown set from a short one: Lv 100, IVs 31, no EVs, Hardy, male, the species' first ability. */
export function fill(set) {
  const species = Dex.forGen(4).species.get(set.species);
  return {
    name: set.name || set.species, species: set.species, item: set.item || '', ability: set.ability || species.abilities['0'],
    moves: set.moves, nature: set.nature || 'Hardy', gender: set.gender ?? (species.gender || 'M'),
    level: set.level || 100,
    evs: Object.fromEntries(STATS.map((s) => [s, set.evs?.[s] ?? 0])),
    ivs: Object.fromEntries(STATS.map((s) => [s, set.ivs?.[s] ?? 31])),
  };
}

/**
 * A battle played from a script: steps are {p1?: choice, p2?: choice}. Each given choice must be accepted.
 * Returns the battle and its omniscient log (exact HP on both sides), without wall-clock lines.
 */
export function scripted({ p1, p2, steps = [], seed = 1, format = 'gen4anythinggoes', before }) {
  const battle = new Battle({ formatid: format, seed: typeof seed === 'string' ? seed : battleSeed('test', seed) });
  battle.setPlayer('p1', { name: 'P1', team: Teams.pack(p1.map(fill)) });
  battle.setPlayer('p2', { name: 'P2', team: Teams.pack(p2.map(fill)) });
  if (before) before(battle);
  for (const step of steps) {
    if (battle.ended) break;
    for (const id of ['p1', 'p2']) {
      if (step[id] == null) continue;
      if (!battle[id].activeRequest || battle[id].activeRequest.wait) {
        throw new Error(`step ${JSON.stringify(step)}: ${id} has nothing to choose`);
      }
      if (!battle.choose(id, step[id])) throw new Error(`step ${JSON.stringify(step)}: ${id} refused: ${battle[id].choice.error}`);
    }
  }
  return { battle, log: normalizeLog(omniscientLines(battle)) };
}

/** The lines of one turn (from |turn|N, or the start for 0, to the next |turn|). */
export function turnLines(log, n) {
  const start = n === 0 ? 0 : log.indexOf(`|turn|${n}`);
  if (start < 0) return [];
  const end = log.indexOf(`|turn|${n + 1}`, start + 1);
  return log.slice(start, end < 0 ? log.length : end);
}

/** Exact HP after each -damage/-heal line for a Pokémon name on a side: [{hp, max, line}]. */
export function hpTrail(log, ident) {
  return log.filter((l) => (l.startsWith('|-damage|') || l.startsWith('|-heal|')) && l.split('|')[2] === ident)
    .map((l) => {
      const cond = l.split('|')[3];
      if (cond.startsWith('0')) return { hp: 0, max: null, line: l };
      const [hp, max] = cond.split(' ')[0].split('/').map(Number);
      return { hp, max, line: l };
    });
}

export const has = (log, prefix) => log.some((l) => l.startsWith(prefix));
export const indexOf = (log, prefix) => log.findIndex((l) => l.startsWith(prefix));
