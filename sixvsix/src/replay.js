// A battle as turns you can read: for each turn, who was in, what each trainer chose and what else it weighed (every
// option's value and its reasons, as the agent recorded them when it decided), and what happened. Built from a
// battle row with its log and decision trace (record logs and decisions). Used by the Lab's battle viewer and the CLI.

const nameOf = (ident) => ident.slice(ident.indexOf(':') + 1).trim();
const sideOf = (ident) => ident.slice(0, 2);
const STATUS = { par: 'paralysed', brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', slp: 'asleep', frz: 'frozen' };

/** Parse one omniscient log line into an event, or null. `who` maps p1/p2 to a/b. */
function eventOf(line, who, maxHP) {
  const p = line.slice(1).split('|');
  const from = p.find((x) => x.startsWith('[from]'))?.slice(7);
  const pct = (ident, cond) => {
    if (String(cond).startsWith('0')) return 0;
    const [hp, m] = String(cond).split(' ')[0].split('/').map(Number);
    const key = sideOf(ident) + nameOf(ident);
    if (m) maxHP.set(key, m);
    return Math.round((100 * hp) / (m || maxHP.get(key) || 100));
  };
  const s = (ident) => who[sideOf(ident)];
  switch (p[0]) {
    case 'switch': case 'drag': return { kind: 'switch', side: s(p[1]), mon: nameOf(p[1]), pct: pct(p[1], p[3]), dragged: p[0] === 'drag' };
    case 'move': return { kind: 'move', side: s(p[1]), mon: nameOf(p[1]), move: p[2], missed: p.includes('[miss]'), from };
    case '-damage': return { kind: 'damage', side: s(p[1]), mon: nameOf(p[1]), pct: pct(p[1], p[2]), from };
    case '-heal': return { kind: 'heal', side: s(p[1]), mon: nameOf(p[1]), pct: pct(p[1], p[2]), from };
    case '-supereffective': return { kind: 'note', text: 'super effective' };
    case '-resisted': return { kind: 'note', text: 'not very effective' };
    case '-immune': return { kind: 'note', side: s(p[1]), mon: nameOf(p[1]), text: `unaffected${from ? ` (${from})` : ''}` };
    case '-crit': return { kind: 'note', text: 'a critical hit' };
    case '-miss': return { kind: 'note', text: 'missed' };
    case '-status': return { kind: 'status', side: s(p[1]), mon: nameOf(p[1]), status: p[2], text: STATUS[p[2]] || p[2], from };
    case '-curestatus': return { kind: 'note', side: s(p[1]), mon: nameOf(p[1]), text: `cured of ${STATUS[p[2]] || p[2]}` };
    case '-boost': return { kind: 'boost', side: s(p[1]), mon: nameOf(p[1]), stat: p[2], by: Number(p[3]) };
    case '-unboost': return { kind: 'boost', side: s(p[1]), mon: nameOf(p[1]), stat: p[2], by: -Number(p[3]) };
    case '-weather': return p.includes('[upkeep]') ? null : { kind: 'field', text: `weather: ${p[1] === 'none' ? 'clear' : p[1]}${from ? ` (${from})` : ''}` };
    case '-sidestart': return { kind: 'field', side: who[p[1].slice(0, 2)], text: `${p[2].replace('move: ', '')} set` };
    case '-sideend': return { kind: 'field', side: who[p[1].slice(0, 2)], text: `${p[2].replace('move: ', '')} gone` };
    case '-enditem': return { kind: 'note', side: s(p[1]), mon: nameOf(p[1]), text: `${p[2]} ${p.includes('[eat]') ? 'eaten' : 'used up'}` };
    case '-item': return { kind: 'note', side: s(p[1]), mon: nameOf(p[1]), text: `holds ${p[2]}` };
    case '-ability': return { kind: 'note', side: s(p[1]), mon: nameOf(p[1]), text: p[2] };
    case 'cant': return { kind: 'note', side: s(p[1]), mon: nameOf(p[1]), text: `can't move (${p[2]})` };
    case 'faint': return { kind: 'faint', side: s(p[1]), mon: nameOf(p[1]) };
    case 'win': return { kind: 'end', text: `${p[1]} wins` };
    case 'tie': return { kind: 'end', text: 'a draw' };
    default: return null;
  }
}

/** One decision as the trainer saw it: the pick and every option, best first. */
function decisionOf(d, at) {
  const options = d.options.map((choice, k) => {
    const label = d.labels?.[k] || choice;
    return { choice, label, value: d.scores?.[k] ?? null, why: d.reasons?.[label] ?? null, picked: choice === d.choice };
  });
  const why = new Map((d.why || []).map((w) => [w.slice(0, w.indexOf(':')), w.slice(w.indexOf(':') + 1).trim()]));
  return {
    at, side: d.side, forced: d.forced, pick: d.label, choice: d.choice,
    options: options.sort((x, y) => (y.value ?? -1e9) - (x.value ?? -1e9)),
    why: d.why || [], reasons: Object.fromEntries(why), knew: d.knew, assumed: d.assumed || null, overridden: !!d.overridden,
  };
}

/** The battle as turns. Needs row.log and row.decision_log. */
export function replayTurns(row) {
  if (!row.log) throw new Error('this battle was run without its log; rerun it with record.logs');
  const who = row.a_side === 'p1' ? { p1: 'a', p2: 'b' } : { p1: 'b', p2: 'a' };
  const maxHP = new Map();
  const turns = [{ turn: 0, events: [], decisions: [] }];
  const state = { a: { mon: null, pct: 100 }, b: { mon: null, pct: 100 } };
  for (const line of row.log) {
    if (line.startsWith('|turn|')) {
      turns.push({ turn: Number(line.split('|')[2]), events: [], decisions: [],
                   start: { a: { ...state.a }, b: { ...state.b } } });
      continue;
    }
    const e = eventOf(line, who, maxHP);
    if (!e) continue;
    turns[turns.length - 1].events.push(e);
    if (e.kind === 'switch') state[e.side] = { mon: e.mon, pct: e.pct };
    if ((e.kind === 'damage' || e.kind === 'heal') && state[e.side].mon === e.mon) state[e.side].pct = e.pct;
    if (e.kind === 'faint' && state[e.side].mon === e.mon) state[e.side].pct = 0;
  }
  (row.decision_log || []).forEach((d, at) => {
    const t = turns.find((x) => x.turn === d.turn) || turns[turns.length - 1];
    t.decisions.push(decisionOf(d, at));
  });
  return turns;
}

const fmtEvent = (e, label) => {
  const w = e.side ? `${label[e.side]}'s ${e.mon || ''}`.trim() : '';
  switch (e.kind) {
    case 'switch': return `${label[e.side]} ${e.dragged ? 'is dragged to' : 'sends out'} ${e.mon} (${e.pct}%)`;
    case 'move': return `${w} used ${e.move}${e.missed ? ' (missed)' : ''}`;
    case 'damage': return `   ${w} → ${e.pct}%${e.from ? ` (${e.from})` : ''}`;
    case 'heal': return `   ${w} healed to ${e.pct}%${e.from ? ` (${e.from})` : ''}`;
    case 'status': return `   ${w} is ${e.text}`;
    case 'boost': return `   ${w} ${e.stat} ${e.by > 0 ? '+' : '−'}${Math.abs(e.by)}`;
    case 'faint': return `   ${w} fainted`;
    case 'field': return `   ${e.text}${e.side ? ` on ${label[e.side]}'s side` : ''}`;
    case 'end': return `\n${e.text}.`;
    default: return `   ${w ? `${w}: ` : ''}${e.text}`;
  }
};

/** The battle as text: each turn's position, both decisions with their top options, then what happened. */
export function replayText(row, { label = { a: 'A', b: 'B' }, options = 3 } = {}) {
  const out = [];
  for (const t of replayTurns(row)) {
    if (t.turn > 0) {
      const s = t.start;
      out.push('', `── Turn ${t.turn} ── ${label.a}: ${s.a.mon} ${s.a.pct}%   ${label.b}: ${s.b.mon} ${s.b.pct}%`);
    }
    const say = (d) => out.push(`  [${label[d.side]}${d.forced ? ', replacing' : ''}] ${d.pick}` +
      `${d.options.length > 1 ? `  ← ${d.why.slice(0, options).join(' | ')}` : ''}`);
    // a replacement is decided after the faint, so it's shown just before its switch-in
    const forced = { a: t.decisions.filter((d) => d.forced && d.side === 'a'), b: t.decisions.filter((d) => d.forced && d.side === 'b') };
    t.decisions.filter((d) => !d.forced).forEach(say);
    const fainted = { a: false, b: false };
    for (const e of t.events) {
      if (e.kind === 'faint') fainted[e.side] = true;
      if (e.kind === 'switch' && fainted[e.side] && forced[e.side].length) { say(forced[e.side].shift()); fainted[e.side] = false; }
      out.push(fmtEvent(e, label));
    }
    for (const s of ['a', 'b']) forced[s].forEach(say);
  }
  return out.join('\n');
}
