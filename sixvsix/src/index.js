// The 6v6 simulator's public surface. The same functions run in Node (cli/, test/) and in the browser bundle
// (browser/entry.js), so a job means the same thing wherever it runs.

export { CONTRACT_VERSION, ENGINE, ENGINE_ID, SIMULATOR } from './engine-info.js';
export { SCHEMAS, EVIDENCE_CLASSES, check, assertValid } from './contract.js';
export { RULESETS, LEGALITY_FORMATS, getRuleset, describeFormat } from './rulesets.js';
export { validateTeam, assertLegal } from './validate.js';
export { buildFromSet, teamFromPaste, teamToPaste, toShowdownSets, atLevel, withLead } from './teams.js';
export { teamFromLibrary, profileFromLibrary } from './adapters/blackthorn.js';
export { AGENTS, makeAgent, attackScore } from './agents/baselines.js';
export { TrainerAgent, DEFAULT_PARAMS as TRAINER_DEFAULTS, paramsFromLibrary } from './agents/trainer.js';
export { optimizeBuild, optimizeTeam, statsOf, spreadLabel, TEMPLATES as EV_TEMPLATES } from './optimize/evs.js';

export { runPool, runPoolWith, poolResult, comparePool, comparePoolWith, comparisonFrom, comparisonReading, poolJobs, mcnemar } from './compare.js';
export { legalOptions } from './agents/legal.js';
export { CartridgeAgent, kindOf } from './agents/cartridge.js';
export { SideView } from './observer.js';
export { runBattle, resumeBattle, replayBattle, normalizeLog, logHash } from './battle.js';
export { analyzeLog } from './analyze.js';
export { makeJob, prepareJob, runTrial, trialSides, finishJob, runJob, runJobSync, fingerprint, trialPlan } from './batch.js';
export { summarize, wilson } from './stats.js';
export { battleSeed, policySeed, PolicyRNG, digest, shortHash, stableStringify } from './util.js';

/** A Trainer Profile for a baseline agent, for teams that aren't from the Trainer Library. */
export function baselineProfile(agent, { name, id } = {}) {
  return {
    kind: 'TrainerProfile', id: id || `profile:baseline:${agent}`, version: 1, name: name || `${agent} baseline`,
    agent, params: {}, information: 'partial', tendencies: {}, competence: {}, playbook: null,
    note: 'A Phase 1 baseline agent, not a trainer.',
  };
}

// The Lab: runners, experiments, the Strategy Report and its renderings, replays, the opponent library, the editor.
export { syncRunner, poolRunner, handleChunk, timingFor } from './runner.js';
export { runExperiment, EXPERIMENTS, battle, coach, buildDiff, duelChanges, teamOf, poolOf, ourProfile, opponentProfiles } from './experiments.js';
export { strategyReport } from './report.js';
export { renderReport, renderExperiment } from './render.js';
export { replayTurns, replayText } from './replay.js';
export { INTERPRETATIONS, interpret, poolFromVersions, poolsFromCollections, variationTeams } from './adapters/collections.js';
export { prepare as duelPrepare, evaluate as duelEvaluate } from './optimize/evs.js';
export { learnableMoves, abilitiesOf, natureList, itemList, editTeam } from './editor.js';
export { confirmSpreads, duelWins } from './optimize/confirm.js';
