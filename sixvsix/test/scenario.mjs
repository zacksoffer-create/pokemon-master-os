// Exact battle states for the trainer agent's decision tests: a request and a side's view built directly, so each
// test asks one tactical question with nothing left to chance.
import { Dex } from '@pkmn/sim';
import { SideView } from '../src/observer.js';
import { buildFromSet, toShowdownSets } from '../src/teams.js';
import { statsOf } from '../src/optimize/evs.js';
import { toID } from '../src/util.js';

const dex = Dex.forGen(4);

/**
 * mine: [{species, moves, item, ability, nature, evs, hp (fraction), status, boosts, volatiles, sleep}] — the first is
 *       active unless `forced` (then nobody is, as after a faint);
 * foe:  {species, level, hp (fraction), moves (revealed), status, boosts, item, ability, volatiles, sleep, size (team
 *       size), fainted}
 * volatiles as the side view keeps them ({mustrecharge, confusion, substitute, perish: n}); sleep {rest, cant}.
 */
export function state({ mine, foe, conditions = {}, weather = '', turn = 3, forced = false, lastOrder = [] }) {
  const builds = mine.map((m, i) => buildFromSet({
    species: m.species, moves: m.moves, item: m.item || '', ability: m.ability, nature: m.nature || 'Hardy',
    evs: m.evs || { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 }, level: m.level || 100,
  }, { id: `test#${i}` }));
  const team = { kind: 'TeamVersion', id: 'test:mine', version: 1, name: 'mine', generation: 4, members: builds, lead: 'first',
                 ...(mine.findIndex((m) => m.ace) >= 0 ? { ace: mine.findIndex((m) => m.ace) } : {}) };
  const { names } = toShowdownSets(team);
  const pokemon = builds.map((b, i) => {
    const st = statsOf(b.species, b);
    const hp = Math.max(0, Math.round(st.hp * (mine[i].hp ?? 1)));
    const cond = hp === 0 ? '0 fnt' : `${hp}/${st.hp}${mine[i].status ? ' ' + mine[i].status : ''}`;
    return { ident: `p1: ${names[i]}`, details: `${b.species}, M`, condition: cond, active: !forced && i === 0,
             stats: { atk: st.atk, def: st.def, spa: st.spa, spd: st.spd, spe: st.spe }, moves: b.moves.map(toID),
             baseAbility: toID(b.ability), item: toID(b.item || ''), ability: toID(b.ability) };
  });
  const request = { side: { name: 'P1', id: 'p1', pokemon } };
  if (forced) request.forceSwitch = [true];
  else request.active = [{ moves: builds[0].moves.map((n) => ({ move: n, id: toID(n), pp: 16, maxpp: 16, target: 'normal', disabled: false })) }];
  if (mine[0].locked && !forced) request.active[0].moves = request.active[0].moves.map((m) => ({ ...m, disabled: toID(mine[0].locked) !== m.id }));
  if (mine[0].trapped) request.active[0].trapped = true;

  const view = new SideView('p1');
  view.turn = turn; view.weather = weather; view.lastOrder = lastOrder;
  view.teamSize = { p1: builds.length, p2: foe.size || 6 };
  view.conditions = { p1: conditions.us || {}, p2: conditions.them || {} };
  builds.forEach((b, i) => {
    const m = view.mon('p1', names[i]);
    Object.assign(m, { species: b.species, pct: Math.round((mine[i].hp ?? 1) * 100), status: mine[i].status || '',
                       boosts: { ...(mine[i].boosts || {}) }, fainted: (mine[i].hp ?? 1) === 0, seen: i === 0,
                       volatiles: { ...(mine[i].volatiles || {}) }, sleep: mine[i].sleep || null });
  });
  if (!forced) view.active.p1 = names[0];
  const f = view.mon('p2', foe.species);
  Object.assign(f, { species: foe.species, level: foe.level || 100, pct: Math.round((foe.hp ?? 1) * 100), status: foe.status || '',
                     boosts: { ...(foe.boosts || {}) }, moves: new Set(foe.moves || []), item: foe.item, ability: foe.ability, seen: true,
                     volatiles: { ...(foe.volatiles || {}) }, sleep: foe.sleep || null });
  for (let k = 0; k < (foe.fainted || 0); k++) Object.assign(view.mon('p2', `Fainted${k}`), { fainted: true, pct: 0 });
  view.active.p2 = foe.species;
  return { request, view, team, names };
}
