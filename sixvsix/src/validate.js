// Team legality, checked before any battle (Showdown's simulator plays whatever it is given and never validates).
// Three verdicts, kept apart because they answer different questions:
//   structural  can the engine play this faithfully as Gen 4? (exists in Gen 4, ≤4 moves, levels, IVs/EVs in range)
//   obtainable  could a player own exactly this on a Gen 4 cartridge? (learnsets incl. tutors, abilities, events)
//   format      may it enter the declared competitive format? (e.g. Gen 4 OU's bans and clauses)
// The ruleset says which verdicts are required; the rest are reported. Encounter legality (could you have it at that
// point in that game?) is not checked by anything here, and the report says so.

import { Dex, TeamValidator } from '@pkmn/sim';
import { ENGINE } from './engine-info.js';
import { LEGALITY_FORMATS, getRuleset } from './rulesets.js';
import { toShowdownSets } from './teams.js';

const validators = new Map();
function validatorFor(formatid) {
  if (!validators.has(formatid)) validators.set(formatid, new TeamValidator(Dex.formats.get(formatid, true)));
  return validators.get(formatid);
}

function verdict(formatid, sets) {
  // The validator may normalise the sets it's given, so it gets its own copy.
  const problems = validatorFor(formatid).validateTeam(JSON.parse(JSON.stringify(sets))) || [];
  return { ok: problems.length === 0, problems, format: formatid };
}

/** Legality of a Team Version under a ruleset: every verdict, which ones are required, and the overall answer. */
export function validateTeam(team, rulesetId) {
  if (!Object.keys(Dex.forGen(4).data.Learnsets).length) {
    throw new Error('this build of the simulator carries no learnset data, so it cannot check legality: check the ' +
      'teams with Node or the full browser build and pass the reports in (prepareJob(job, {legality}))');
  }
  const ruleset = getRuleset(rulesetId);
  const { sets } = toShowdownSets(team);
  const want = new Set([...ruleset.legality.require, ...(ruleset.legality.report || [])]);
  const verdicts = {};
  if (want.has('structural')) verdicts.structural = verdict(LEGALITY_FORMATS.structural, sets);
  if (want.has('obtainable')) verdicts.obtainable = verdict(LEGALITY_FORMATS.obtainable, sets);
  if (want.has('format')) verdicts.format = verdict(ruleset.legality.format, sets);
  const failed = ruleset.legality.require.filter((k) => !verdicts[k].ok);
  return {
    team: team.id,
    team_version: team.version,
    ruleset: ruleset.id,
    ok: failed.length === 0,
    required: [...ruleset.legality.require],
    failed,
    verdicts,
    checked_by: `Showdown TeamValidator (${ENGINE.name} ${ENGINE.version})`,
    not_checked: ['encounter legality: whether this Pokémon could be had at this point in this game'],
  };
}

/** Throws with the problems when a team fails a verdict its ruleset requires. */
export function assertLegal(team, rulesetId) {
  const report = validateTeam(team, rulesetId);
  if (!report.ok) {
    const lines = report.failed.flatMap((k) => report.verdicts[k].problems.map((p) => `${k}: ${p}`));
    const err = new Error(`${team.id} is not legal under ${report.ruleset}:\n  ` + lines.join('\n  '));
    err.report = report;
    throw err;
  }
  return report;
}
