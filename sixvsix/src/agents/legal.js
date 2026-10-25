// Layer A: every decision an agent may submit, read from the side's own Showdown request. An agent picks from this
// list and nothing else, so it can't submit an impossible choice; the battle runner still checks every choice and
// counts any the engine rejects.

/**
 * The legal options for a request: [{choice, kind, label, slot}].
 *   choice  what Showdown is sent ("move 2", "switch 4", "pass")
 *   kind    'move' | 'switch' | 'pass'
 *   label   a readable name ("Earthquake", "Lapras")
 */
export function legalOptions(request) {
  if (!request || request.wait) return [];
  const mons = request.side.pokemon;
  const bench = [];
  mons.forEach((p, i) => {
    if (!p.active && !p.condition.endsWith(' fnt') && p.condition !== '0 fnt') {
      bench.push({ choice: `switch ${i + 1}`, kind: 'switch', label: p.ident.slice(p.ident.indexOf(':') + 1).trim(),
                   slot: i, species: p.details.split(',')[0] });
    }
  });
  if (request.forceSwitch) {
    return bench.length ? bench : [{ choice: 'pass', kind: 'pass', label: 'no one left to send in' }];
  }
  const active = request.active?.[0];
  if (!active) return [{ choice: 'pass', kind: 'pass', label: 'nothing to do' }];
  const moves = active.moves
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => !m.disabled && (m.pp === undefined || m.pp > 0 || m.maxpp === undefined))
    .map(({ m, i }) => ({ choice: `move ${i + 1}`, kind: 'move', label: m.move, id: m.id, slot: i }));
  // A locked or recharging Pokémon gets one move with no PP count (Recharge, Outrage's later turns, Struggle).
  const options = moves.length ? moves : [{ choice: 'move 1', kind: 'move', label: active.moves[0]?.move || 'Struggle',
                                             id: active.moves[0]?.id || 'struggle', slot: 0 }];
  if (!active.trapped) options.push(...bench);
  return options;
}

/** The side's own Pokémon from the request, by option slot. */
export function ownMon(request, slot) {
  return request.side.pokemon[slot];
}
