// What the Lab's build editor offers a Pokémon in Gen 4: the moves it can learn (any source up to Gen 4, through its
// pre-evolutions), its abilities, the natures and the items of Gen 4. Offering is loose on purpose; the legality
// check (validate.js, the same three verdicts as every job) is the gate before an edited team plays.

import { Dex } from '@pkmn/sim';
import { STATS } from './util.js';

const dex = Dex.forGen(4);

export function learnableMoves(species) {
  const out = new Set();
  let s = dex.species.get(species);
  for (let guard = 0; s?.exists && guard < 4; guard++) {
    const ls = dex.species.getLearnsetData(s.id)?.learnset || {};
    for (const [id, sources] of Object.entries(ls)) if (sources.some((src) => Number(src[0]) <= 4)) out.add(dex.moves.get(id).name);
    s = s.prevo ? dex.species.get(s.prevo) : null;
  }
  return [...out].filter((m) => dex.moves.get(m).exists && dex.moves.get(m).gen <= 4).sort();
}

export const abilitiesOf = (species) => [...new Set(Object.values(dex.species.get(species).abilities))];
export const natureList = () => dex.natures.all().map((n) => ({ name: n.name, plus: n.plus || null, minus: n.minus || null }));
export const itemList = () => dex.items.all().filter((i) => i.gen <= 4 && !i.isNonstandard).map((i) => i.name).sort();

/** A copy of a team with one member's build changed, every change written down as your edit. */
export function editTeam(team, slot, changes, { label } = {}) {
  const m = team.members[slot];
  const next = { ...m, ...changes, id: `${m.id}~edit`, filled: [...(m.filled || [])], evidence: { ...(m.evidence || {}) } };
  for (const k of Object.keys(changes)) {
    next.evidence[k] = ['hypothetical', 'your edit in the 6v6 Lab'];
    next.filled = next.filled.filter((f) => !f.toLowerCase().startsWith(`${k === 'evs' ? 'EVs' : k}:`.toLowerCase()));
    const v = changes[k];
    next.filled.push(`${k === 'evs' ? 'EVs' : k}: ${k === 'evs' ? STATS.filter((s) => v[s]).map((s) => `${v[s]} ${s}`).join(' / ') : Array.isArray(v) ? v.join(', ') : v} (your edit)`);
  }
  const members = team.members.map((x, i) => (i === slot ? next : x));
  return { ...team, id: `${team.id}~edit`, name: label || `${team.name} · edited`, members, edited: true };
}
