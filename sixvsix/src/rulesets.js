// Battle Rulesets: the environment a battle runs in, stated in full. Three modes share one engine (master plan §3):
//   historical   a game trainer as the cartridge plays it: no Smogon clauses, no team preview
//   blackthorn   researched trainers on Blackthorn's standardized terms: no Smogon clauses, game-legal builds
//   competitive  Smogon's Gen 4 OU as Showdown defines it, clauses and bans included
// Showdown's own formats mix two kinds of rule: battle-time mods (they change what happens in a battle, e.g. Sleep
// Clause Mod) and validator rules (they only decide which teams are allowed, e.g. Species Clause). describeFormat()
// reads the real rule table so a ruleset can never silently carry a clause it doesn't list.

import { Dex } from '@pkmn/sim';

/** Validator formats behind the three legality verdicts (validate.js). */
export const LEGALITY_FORMATS = {
  structural: 'gen4customgame@@@-Nonexistent,!! Max Team Size = 6,!! Max Move Count = 4,!! Max Level = 100,EV Limit = 510',
  obtainable: 'gen4customgame@@@Obtainable,!! Max Team Size = 6,!! Max Move Count = 4,!! Max Level = 100',
};

const CARTRIDGE_GAPS = [
  "trainer bag items: the cartridge trainer's Full Restores and other items are not used (Showdown has no item action)",
  "the cartridge AI's own move scoring: Phase 1 agents are baselines (Phase 3 adds trainer intelligence)",
  'Shift battle style: Showdown plays Set style (no free switch when the opponent faints); the cartridge default is Shift',
  'DPPt vs HGSS engine differences that Showdown does not separate (it plays one Gen 4)',
];

export const RULESETS = {
  'gen4-historical': {
    kind: 'BattleRuleset', id: 'gen4-historical', version: 1,
    name: 'Gen IV singles, as the cartridge plays it',
    mode: 'historical', generation: 4, game_type: 'singles', team_size: 6,
    battle_format: 'gen4anythinggoes',
    in_battle: ['Endless Battle Clause', 'HP Percentage Mod', 'Cancel Mod', 'Beat Up Nicknames Mod'],
    legality: { require: ['structural'], report: ['obtainable'], format: null },
    information: { team_preview: false, opponent: 'revealed', hp: 'percentage' },
    normalization: { lens_default: 'authentic', standardized_level: 100 },
    turn_limit: 1000,
    not_modelled: CARTRIDGE_GAPS,
    note: "A game trainer's team is legal because the game made it: only the structure is required (it exists in Gen 4 " +
      'and the engine can play it). Whether a player could own the same set is reported, never required.',
  },
  'gen4-blackthorn': {
    kind: 'BattleRuleset', id: 'gen4-blackthorn', version: 1,
    name: "Gen IV singles, Blackthorn's standardized terms",
    mode: 'blackthorn', generation: 4, game_type: 'singles', team_size: 6,
    battle_format: 'gen4anythinggoes',
    in_battle: ['Endless Battle Clause', 'HP Percentage Mod', 'Cancel Mod', 'Beat Up Nicknames Mod'],
    legality: { require: ['structural', 'obtainable'], report: [], format: null },
    information: { team_preview: false, opponent: 'revealed', hp: 'percentage' },
    normalization: { lens_default: 'standardized', standardized_level: 100 },
    turn_limit: 1000,
    not_modelled: CARTRIDGE_GAPS.slice(0, 2),
    note: 'Builds must be obtainable on a Gen 4 cartridge (Showdown\'s Obtainable rules: learnsets including HGSS and Pt ' +
      'tutors, abilities, events, EV limits). No Smogon clauses: Species, Sleep, OHKO and Evasion clauses are off, ' +
      'because the trainers being modelled were never bound by them.',
  },
  'gen4-ou': {
    kind: 'BattleRuleset', id: 'gen4-ou', version: 1,
    name: 'Gen IV OU (Smogon, as Showdown defines it)',
    mode: 'competitive', generation: 4, game_type: 'singles', team_size: 6,
    battle_format: 'gen4ou',
    in_battle: ['Endless Battle Clause', 'HP Percentage Mod', 'Cancel Mod', 'Beat Up Nicknames Mod', 'Freeze Clause Mod'],
    legality: { require: ['structural', 'obtainable', 'format'], report: [], format: 'gen4ou' },
    information: { team_preview: false, opponent: 'revealed', hp: 'percentage' },
    normalization: { lens_default: 'standardized', standardized_level: 100 },
    turn_limit: 1000,
    not_modelled: [],
    note: "Showdown's [Gen 4] OU: its bans and validator clauses (Species, Nickname, OHKO, Evasion Items/Moves/Abilities, " +
      'Sleep Moves, Baton Pass Stat Trap) decide which teams may enter; Freeze Clause Mod changes the battle itself.',
  },
};

export function getRuleset(idOrObject) {
  if (idOrObject && typeof idOrObject === 'object') return idOrObject;
  const r = RULESETS[idOrObject];
  if (!r) throw new Error(`unknown ruleset ${idOrObject} (known: ${Object.keys(RULESETS).join(', ')})`);
  return r;
}

/**
 * What a Showdown format actually contains, read from its rule table: rules that act during the battle, rules that
 * only gate teams, and bans. Values (e.g. "Max Level = 100") are included.
 */
export function describeFormat(formatid) {
  const format = Dex.formats.get(formatid, true);
  if (!format.exists) throw new Error(`Showdown has no format ${formatid}`);
  const table = Dex.formats.getRuleTable(format);
  const inBattle = [], validator = [], bans = [], unbans = [];
  for (const key of table.keys()) {
    if (key.startsWith('-') || key.startsWith('*')) { bans.push(key.slice(1)); continue; }
    if (key.startsWith('+')) { unbans.push(key.slice(1)); continue; }
    const rule = Dex.formats.get(key);
    const value = table.valueRules.get(key);
    const name = (rule.exists ? rule.name : key) + (value ? ` = ${value}` : '');
    if (rule.effectType === 'Rule') inBattle.push(name);
    else validator.push(name);
  }
  return {
    id: format.id, name: format.name, mod: format.mod, team_preview: table.has('teampreview'),
    in_battle: inBattle.sort(), validator: validator.sort(), bans: bans.sort(), unbans: unbans.sort(),
  };
}
