// Phase 1 baseline agents. These are measuring sticks, not trainers: they exist so the battle loop, the batch
// runner and the reports can be tested before any trainer intelligence is built (master plan §4, Phase 3).
//
//   random    uniform over every legal option (moves and switches)
//   maxpower  the strongest-looking attack by base power × STAB × type effectiveness × accuracy against the foe it
//             can see; never switches by choice; when it must send someone in, it sends whoever has the strongest
//             such attack on the foe. (The usual "max base power" benchmark player from the research literature.)
// Both read only their own request and their own side's view (observer.js). Every decision returns the options
// it had and, for maxpower, the score of each, so a replay can show what the agent was weighing.

import { Dex } from '@pkmn/sim';
import { legalOptions } from './legal.js';
import { TrainerAgent } from './trainer.js';

const dex = Dex.forGen(4);

/** Base power × STAB × effectiveness × accuracy, using only public type information about the target. */
export function attackScore(moveId, attackerSpecies, targetSpecies) {
  const move = dex.moves.get(String(moveId).replace(/\d+$/, ''));   // requests write Hidden Power as hiddenpowerfire60
  if (!move.exists || move.category === 'Status') return 0;
  let type = move.type;
  if (move.id.startsWith('hiddenpower')) type = move.name.replace('Hidden Power ', '') || type;
  const bp = move.basePower || (move.damage ? 60 : 0);   // fixed-damage moves (Seismic Toss) read as 60
  if (!bp) return 0;
  const attacker = dex.species.get(attackerSpecies);
  const stab = attacker.types.includes(type) ? 1.5 : 1;
  let eff = 1;
  if (targetSpecies) {
    const target = dex.species.get(targetSpecies);
    if (!dex.getImmunity(type, target)) eff = 0;
    else eff = 2 ** dex.getEffectiveness(type, target);
  }
  const acc = move.accuracy === true ? 1 : move.accuracy / 100;
  return bp * stab * eff * acc;
}

export class RandomAgent {
  constructor(params = {}) { this.name = 'random'; this.params = params; }
  decide(request, view, rng) {
    const options = legalOptions(request);
    if (!options.length) return null;
    const pick = rng.pick(options);
    return { choice: pick.choice, kind: pick.kind, label: pick.label, options: options.map((o) => o.choice) };
  }
}

export class MaxPowerAgent {
  constructor(params = {}) { this.name = 'maxpower'; this.params = params; }
  decide(request, view, rng) {
    const options = legalOptions(request);
    if (!options.length) return null;
    const foe = view.foeActive()?.species || null;
    const mons = request.side.pokemon;
    let scored;
    if (options[0].kind === 'switch' && options.every((o) => o.kind === 'switch')) {
      // Forced replacement: whoever hits the visible foe hardest.
      scored = options.map((o) => {
        const p = mons[o.slot];
        const best = Math.max(0, ...p.moves.map((m) => attackScore(m, o.species, foe)));
        return { ...o, score: best };
      });
    } else {
      const active = mons.find((p) => p.active);
      const species = active.details.split(',')[0];
      scored = options.filter((o) => o.kind === 'move').map((o) => ({ ...o, score: attackScore(o.id, species, foe) }));
      if (!scored.length) scored = options.map((o) => ({ ...o, score: 0 }));
    }
    const top = Math.max(...scored.map((o) => o.score));
    const best = scored.filter((o) => o.score === top);
    const pick = best.length === 1 ? best[0] : rng.pick(best);   // ties (incl. all-status sets) broken at random
    return {
      choice: pick.choice, kind: pick.kind, label: pick.label,
      options: scored.map((o) => o.choice),
      scores: scored.map((o) => Math.round(o.score * 10) / 10),
    };
  }
}

export const AGENTS = { random: RandomAgent, maxpower: MaxPowerAgent, trainer: TrainerAgent };

/** An agent for a profile. `context.team` is the agent's own Team Version (the trainer agent needs it). */
export function makeAgent(policy, context = {}) {
  const Agent = AGENTS[policy.agent];
  if (!Agent) throw new Error(`unknown agent ${policy.agent} (known: ${Object.keys(AGENTS).join(', ')})`);
  return new Agent(policy.params || {}, context);
}
