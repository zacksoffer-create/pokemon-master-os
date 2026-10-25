// A battle log as readable lines: turns, moves, damage as % of max HP, status, weather, hazards, faints, the result.

const nameOf = (ident) => ident.slice(ident.indexOf(':') + 1).trim();
const sideOf = (ident) => ident.slice(0, 2);

export function prettyLog(lines, labels = { p1: 'P1', p2: 'P2' }) {
  const out = [];
  const max = new Map();
  const who = (ident) => `${labels[sideOf(ident)]}'s ${nameOf(ident)}`;
  const pct = (ident, cond) => {
    const [hp, m] = cond.split(' ')[0].split('/').map(Number);
    if (cond.startsWith('0')) return '0%';
    if (m) max.set(ident.slice(0, 2) + nameOf(ident), m);
    return `${Math.round((100 * hp) / (m || max.get(ident.slice(0, 2) + nameOf(ident)) || 100))}%`;
  };
  for (const line of lines) {
    const p = line.slice(1).split('|');
    const from = p.find((x) => x.startsWith('[from]'))?.slice(7);
    switch (p[0]) {
      case 'turn': out.push('', `── Turn ${p[1]} ──`); break;
      case 'switch': case 'drag': out.push(`${labels[sideOf(p[1])]} sends out ${nameOf(p[1])} (${pct(p[1], p[3])})`); break;
      case 'move': out.push(`${who(p[1])} used ${p[2]}${p.includes('[miss]') ? ' (missed)' : ''}`); break;
      case '-damage': out.push(`   ${who(p[1])} → ${pct(p[1], p[2])}${from ? ` (${from})` : ''}`); break;
      case '-heal': out.push(`   ${who(p[1])} healed to ${pct(p[1], p[2])}${from ? ` (${from})` : ''}`); break;
      case '-supereffective': out.push('   super effective'); break;
      case '-resisted': out.push('   not very effective'); break;
      case '-immune': out.push(`   ${who(p[1])} is unaffected${from ? ` (${from})` : ''}`); break;
      case '-crit': out.push('   a critical hit'); break;
      case '-miss': out.push(`   it missed ${who(p[2] || p[1])}`); break;
      case '-status': out.push(`   ${who(p[1])} is now ${{ par: 'paralysed', brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', slp: 'asleep', frz: 'frozen' }[p[2]] || p[2]}${from ? ` (${from})` : ''}`); break;
      case '-curestatus': out.push(`   ${who(p[1])} is cured of ${p[2]}`); break;
      case '-boost': out.push(`   ${who(p[1])} ${p[2]} +${p[3]}`); break;
      case '-unboost': out.push(`   ${who(p[1])} ${p[2]} −${p[3]}`); break;
      case '-weather': if (!p.includes('[upkeep]')) out.push(`   weather: ${p[1] === 'none' ? 'clear' : p[1]}${from ? ` (${from})` : ''}`); break;
      case '-sidestart': out.push(`   ${p[2].replace('move: ', '')} on ${labels[p[1].slice(0, 2)]}'s side`); break;
      case '-sideend': out.push(`   ${p[2].replace('move: ', '')} gone from ${labels[p[1].slice(0, 2)]}'s side`); break;
      case '-enditem': out.push(`   ${who(p[1])}'s ${p[2]} ${p.includes('[eat]') ? 'eaten' : 'used up'}`); break;
      case '-item': out.push(`   ${who(p[1])} has ${p[2]}`); break;
      case '-ability': out.push(`   ${who(p[1])}'s ${p[2]}`); break;
      case 'cant': out.push(`${who(p[1])} can't move (${p[2]})`); break;
      case 'faint': out.push(`   ${who(p[1])} fainted`); break;
      case 'win': out.push('', `${p[1]} wins.`); break;
      case 'tie': out.push('', 'A draw.'); break;
      default: break;
    }
  }
  return out.join('\n');
}
