// The Shared Simulation Contract (docs/DATA_CONTRACT.md): the objects every simulation is made of, whichever
// device runs it. Each object carries `kind`, a stable `id` and a `version`; nothing is identified by a sheet row.
// check(kind, obj) returns a list of problems (empty when the object is well formed). The checker is deliberately
// small and dependency-free so the browser bundle and the Node runner apply exactly the same rules.

import { CONTRACT_VERSION } from './engine-info.js';
import { STATS } from './util.js';

export { CONTRACT_VERSION };

/** Blackthorn's evidence classes (engine/app/data/library.json → classes), plus `simulated` for results. */
export const EVIDENCE_CLASSES = ['confirmed', 'strongly inferred', 'standardized', 'hypothetical', 'unknown'];
export const RESULT_EVIDENCE_CLASS = 'simulated';

export const MODES = ['historical', 'blackthorn', 'competitive'];
export const LENSES = ['authentic', 'standardized'];

const statTable = (min, max) => ({
  type: 'object',
  fields: Object.fromEntries(STATS.map((s) => [s, { type: 'integer', min, max, required: true }])),
});

const evidenceMap = { type: 'map', of: { type: 'tuple', items: [{ type: 'enum', values: EVIDENCE_CLASSES }, { type: 'string' }] } };

export const SCHEMAS = {
  PokemonBuild: {
    kind: { type: 'const', value: 'PokemonBuild' },
    id: { type: 'string', required: true },
    version: { type: 'integer', min: 1, required: true },
    species: { type: 'string', required: true },
    nickname: { type: 'string' },
    game: { type: 'string' },
    generation: { type: 'integer', min: 1, max: 9, required: true },
    level: { type: 'integer', min: 1, max: 100, required: true },
    gender: { type: 'enum', values: ['M', 'F', 'N', ''] },
    shiny: { type: 'boolean' },
    happiness: { type: 'integer', min: 0, max: 255 },
    nature: { type: 'string', required: true },
    ability: { type: 'string', required: true },
    item: { type: 'string', nullable: true, required: true },
    moves: { type: 'array', of: { type: 'string' }, minItems: 1, maxItems: 4, required: true },
    ivs: { ...statTable(0, 31), required: true },
    evs: { ...statTable(0, 255), required: true },
    evidence: evidenceMap,
    filled: { type: 'array', of: { type: 'string' } },
    source: { type: 'string' },
    parent: { type: 'string', nullable: true },
  },
  TeamVersion: {
    kind: { type: 'const', value: 'TeamVersion' },
    id: { type: 'string', required: true },
    version: { type: 'integer', min: 1, required: true },
    name: { type: 'string', required: true },
    trainer: { type: 'string' },
    game: { type: 'string' },
    generation: { type: 'integer', min: 1, max: 9, required: true },
    members: { type: 'array', of: { type: 'object', schema: 'PokemonBuild' }, minItems: 1, maxItems: 6, required: true },
    lead: { type: 'string', required: true },
    locked: { type: 'array', of: { type: 'string' } },
    lens: { type: 'enum', values: LENSES },
    source: { type: 'object' },
    parent: { type: 'string', nullable: true },
  },
  TrainerProfile: {
    kind: { type: 'const', value: 'TrainerProfile' },
    id: { type: 'string', required: true },
    version: { type: 'integer', min: 1, required: true },
    name: { type: 'string', required: true },
    identity: { type: 'string' },
    source_version: { type: 'string', nullable: true },
    agent: { type: 'string', required: true },
    params: { type: 'object' },
    information: { type: 'enum', values: ['partial', 'cartridge', 'omniscient'], required: true },
    tendencies: { type: 'object' },
    competence: { type: 'object' },
    playbook: { type: 'string', nullable: true },
    ai_flags: { type: 'array', of: { type: 'string' } },
    ai_flags_raw: { type: 'integer', min: 0 },
    reading: { type: 'object' },
    note: { type: 'string' },
  },
  OpponentPool: {
    kind: { type: 'const', value: 'OpponentPool' },
    id: { type: 'string', required: true },
    version: { type: 'integer', min: 1, required: true },
    name: { type: 'string', required: true },
    lens: { type: 'enum', values: LENSES, required: true },
    ev_policy: { type: 'string' },
    members: { type: 'array', of: { type: 'object', schema: 'TeamVersion' }, minItems: 1, required: true },
    source: { type: 'object' },
    ruleset: { type: 'string' },     // the ruleset its members are legal under (anime reconstructions: historical)
    excluded: { type: 'array' },     // members left out, and why
    note: { type: 'string' },
  },
  BattleRuleset: {
    kind: { type: 'const', value: 'BattleRuleset' },
    id: { type: 'string', required: true },
    version: { type: 'integer', min: 1, required: true },
    name: { type: 'string', required: true },
    mode: { type: 'enum', values: MODES, required: true },
    generation: { type: 'integer', min: 1, max: 9, required: true },
    game_type: { type: 'enum', values: ['singles'], required: true },
    team_size: { type: 'integer', min: 1, max: 6, required: true },
    battle_format: { type: 'string', required: true },
    in_battle: { type: 'array', of: { type: 'string' }, required: true },
    legality: { type: 'object', required: true },
    information: { type: 'object', required: true },
    normalization: { type: 'object', required: true },
    turn_limit: { type: 'integer', min: 1, max: 1000, required: true },
    not_modelled: { type: 'array', of: { type: 'string' } },
    note: { type: 'string' },
  },
  SimulationJob: {
    kind: { type: 'const', value: 'SimulationJob' },
    id: { type: 'string', required: true },
    contract: { type: 'string', required: true },
    engine: { type: 'object', required: true },
    ruleset: { type: 'object', schema: 'BattleRuleset', required: true },
    a: { type: 'object', required: true },
    b: { type: 'object', required: true },
    trials: { type: 'object', required: true },
    record: { type: 'object' },
    scenario: { type: 'object' },
    label: { type: 'string' },
  },
  SimulationResult: {
    kind: { type: 'const', value: 'SimulationResult' },
    engine: { type: 'string', required: true },
    format: { type: 'string', required: true },
    a: { type: 'string', required: true },
    b: { type: 'string', required: true },
    lens: { type: 'string', required: true },
    held_constant: { type: 'array', of: { type: 'string' }, required: true },
    varied: { type: 'array', of: { type: 'string' }, required: true },
    seed: { type: 'string', required: true },
    n: { type: 'integer', min: 0, required: true },
    won: { type: 'integer', min: 0, required: true },
    lost: { type: 'integer', min: 0, required: true },
    drew: { type: 'integer', min: 0, required: true },
    battles: { type: 'array', of: { type: 'object' }, required: true },
    made_at: { type: 'string', required: true },
    evidence_class: { type: 'const', value: RESULT_EVIDENCE_CLASS },
    job: { type: 'object', required: true },
    summary: { type: 'object', required: true },
    failures: { type: 'array', of: { type: 'object' }, required: true },
    timing: { type: 'object' },
  },
};

function checkValue(spec, value, path, problems) {
  if (value === undefined) return;
  if (value === null) {
    if (!spec.nullable) problems.push(`${path} is null`);
    return;
  }
  switch (spec.type) {
    case 'const':
      if (value !== spec.value) problems.push(`${path} must be ${JSON.stringify(spec.value)}`);
      return;
    case 'string':
      if (typeof value !== 'string') problems.push(`${path} must be a string`);
      return;
    case 'boolean':
      if (typeof value !== 'boolean') problems.push(`${path} must be true or false`);
      return;
    case 'integer':
      if (!Number.isInteger(value)) { problems.push(`${path} must be a whole number`); return; }
      if (spec.min != null && value < spec.min) problems.push(`${path} is below ${spec.min}`);
      if (spec.max != null && value > spec.max) problems.push(`${path} is above ${spec.max}`);
      return;
    case 'enum':
      if (!spec.values.includes(value)) problems.push(`${path} must be one of ${spec.values.join(', ')}`);
      return;
    case 'array':
      if (!Array.isArray(value)) { problems.push(`${path} must be a list`); return; }
      if (spec.minItems != null && value.length < spec.minItems) problems.push(`${path} needs at least ${spec.minItems}`);
      if (spec.maxItems != null && value.length > spec.maxItems) problems.push(`${path} allows at most ${spec.maxItems}`);
      value.forEach((v, i) => checkValue(spec.of, v, `${path}[${i}]`, problems));
      return;
    case 'tuple':
      if (!Array.isArray(value) || value.length !== spec.items.length) { problems.push(`${path} must be a pair`); return; }
      spec.items.forEach((s, i) => checkValue(s, value[i], `${path}[${i}]`, problems));
      return;
    case 'map':
      if (typeof value !== 'object' || Array.isArray(value)) { problems.push(`${path} must be an object`); return; }
      for (const k of Object.keys(value)) checkValue(spec.of, value[k], `${path}.${k}`, problems);
      return;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) { problems.push(`${path} must be an object`); return; }
      if (spec.schema) problems.push(...check(spec.schema, value, path));
      else if (spec.fields) checkFields(spec.fields, value, path, problems);
      return;
    default:
      problems.push(`${path}: unknown spec type ${spec.type}`);
  }
}

function checkFields(fields, obj, path, problems) {
  for (const [name, spec] of Object.entries(fields)) {
    if (spec.required && obj[name] === undefined) problems.push(`${path}.${name} is missing`);
    checkValue(spec, obj[name], `${path}.${name}`, problems);
  }
}

/** Problems with `obj` as a contract object of `kind` (empty list: well formed). */
export function check(kind, obj, path = kind) {
  const fields = SCHEMAS[kind];
  if (!fields) return [`unknown contract kind ${kind}`];
  if (!obj || typeof obj !== 'object') return [`${path} must be an object`];
  const problems = [];
  if (obj.kind !== undefined && obj.kind !== kind) problems.push(`${path}.kind is ${obj.kind}, expected ${kind}`);
  checkFields(fields, obj, path, problems);
  return problems;
}

/** Throws with every problem listed when `obj` isn't a well-formed `kind`. */
export function assertValid(kind, obj) {
  const problems = check(kind, obj);
  if (problems.length) throw new Error(`${kind} ${obj?.id ?? ''} is not valid:\n  ` + problems.join('\n  '));
  return obj;
}
