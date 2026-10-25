// Individual contributions, read from a finished battle's omniscient log (exact HP on both sides): switch-ins, turns
// active, moves used, damage dealt and taken as % of the target's max HP, knockouts with how they happened, and
// status inflicted. Credit rules (each knockout records which one applied, so a reader can disagree):
//   direct      the last hit was a move from the other side's Pokémon
//   [of]        the log names the source (Rough Skin, Leech Seed, Destiny Bond, Sand Stream's sandstorm...)
//   hazard      Stealth Rock / Spikes: credited to whoever set it
//   status      poison or burn damage: credited to whoever inflicted the status
//   weather     sandstorm or hail: credited to whoever started it, when that was the other side
//   self        recoil, Life Orb, Explosion, its own Curse or weather: no one on the other side gets the knockout
// Also, per Pokémon: HP recovered, set-up and support moves used, voluntary switches in, and the order and turn it
// fainted; per side: the lead, and direct damage taken by the attacking move's type.

import { Dex } from '@pkmn/sim';

const dex = Dex.forGen(4);
const SUPPORT = new Set(['stealthrock', 'spikes', 'toxicspikes', 'reflect', 'lightscreen', 'healbell', 'aromatherapy', 'roar',
  'whirlwind', 'haze', 'wish', 'rapidspin', 'batonpass', 'safeguard', 'tailwind', 'trickroom', 'raindance', 'sunnyday',
  'sandstorm', 'hail', 'taunt', 'encore', 'trick', 'knockoff']);
const isSetup = (m) => m.exists && m.category === 'Status' && ((m.boosts && m.target === 'self' && Object.values(m.boosts).some((v) => v > 0)) ||
  ['curse', 'bellydrum', 'acupressure'].includes(m.id));

const sideOf = (ident) => ident.slice(0, 2);
const nameOf = (ident) => ident.slice(ident.indexOf(':') + 1).trim();
const other = (s) => (s === 'p1' ? 'p2' : 'p1');

function hpOf(cond) {
  const [hpPart, status] = String(cond).split(' ');
  if (status === 'fnt' || hpPart === '0') return { hp: 0, max: null };
  const [hp, max] = hpPart.split('/').map(Number);
  return { hp, max };
}

export function analyzeLog(lines, names) {
  const mons = { p1: new Map(), p2: new Map() };
  for (const s of ['p1', 'p2']) {
    names[s].forEach((n, i) => mons[s].set(n, {
      name: n, side: s, slot: i, species: null, switch_ins: 0, turns_active: 0, moves_used: 0, damage_dealt: 0, damage_taken: 0,
      kos: 0, fainted: false, hp_end: 100, status_inflicted: 0, hp: null, max: null, lastHit: null, status: null,
      healed: 0, setup_used: 0, support_used: 0, switched_in_by_choice: 0, faint_order: null, faint_turn: null,
    }));
  }
  const lead = { p1: null, p2: null };
  const faints = { p1: 0, p2: 0 };
  const takenByType = { p1: {}, p2: {} };
  const get = (ident) => mons[sideOf(ident)].get(nameOf(ident));
  const active = { p1: null, p2: null };
  const hazardSetter = { p1: {}, p2: {} };   // hazards on side X, set by a Pokémon of the other side
  let weatherSetter = null;
  let lastMove = null;
  let turn = 0;
  const kos = [];

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const parts = line.slice(1).split('|');
    const cmd = parts[0];
    const from = parts.find((p) => p.startsWith('[from]'))?.slice(7).trim();
    const of = parts.find((p) => p.startsWith('[of]'))?.slice(5).trim();
    switch (cmd) {
      case 'turn':
        turn = Number(parts[1]);
        for (const s of ['p1', 'p2']) if (active[s]) active[s].turns_active++;
        break;
      case 'switch': case 'drag': {
        const m = get(parts[1]);
        if (!m) break;
        m.species = parts[2].split(',')[0];
        const { hp, max } = hpOf(parts[3]);
        m.hp = hp; if (max) m.max = max;
        m.switch_ins++;
        const s = sideOf(parts[1]);
        if (!lead[s]) lead[s] = m.name;
        else if (cmd === 'switch' && active[s] && !active[s].fainted) m.switched_in_by_choice++;
        active[s] = m;
        lastMove = null;
        break;
      }
      case 'move': {
        const user = get(parts[1]);
        if (!user) break;
        if (!from) {
          user.moves_used++;
          const mv = dex.moves.get(parts[2]);
          if (isSetup(mv)) user.setup_used++;
          if (SUPPORT.has(mv.id)) user.support_used++;
        }
        lastMove = { side: sideOf(parts[1]), user, move: parts[2] };
        if (parts[2] === 'Stealth Rock' || parts[2] === 'Spikes' || parts[2] === 'Toxic Spikes') {
          hazardSetter[other(lastMove.side)][parts[2]] = user;
        }
        break;
      }
      case '-weather':
        if (parts[1] !== 'none' && !parts.includes('[upkeep]')) {
          weatherSetter = of ? get(of) : (lastMove ? lastMove.user : null);
        }
        break;
      case '-status': {
        const m = get(parts[1]);
        if (!m) break;
        const side = sideOf(parts[1]);
        let by = null;
        if (of) by = get(of);
        else if (from && from.startsWith('item:')) by = m;
        else if (lastMove && lastMove.side !== side) by = lastMove.user;
        else if (!lastMove) by = hazardSetter[side]['Toxic Spikes'] || null;   // poisoned on switch-in
        m.status = { kind: parts[2], by };
        if (by && by.side !== side) by.status_inflicted++;
        break;
      }
      case '-curestatus': { const m = get(parts[1]); if (m) m.status = null; break; }
      case '-damage': case '-heal': case '-sethp': {
        const m = get(parts[1]);
        if (!m) break;
        const side = sideOf(parts[1]);
        const { hp, max } = hpOf(parts[2]);
        if (max) m.max = max;
        const lost = m.hp != null && m.max ? Math.max(0, m.hp - hp) : 0;
        if (cmd === '-heal' && m.hp != null && m.max && hp > m.hp) m.healed += (100 * (hp - m.hp)) / m.max;
        m.hp = hp;
        if (cmd !== '-damage' || !lost) break;
        const pct = (100 * lost) / m.max;
        m.damage_taken += pct;
        let src = null, how = 'self';
        if (of && get(of) && sideOf(of) !== side) { src = get(of); how = from || 'effect'; }
        else if (from === 'Stealth Rock' || from === 'Spikes') { src = hazardSetter[side][from] || null; how = 'hazard'; }
        else if (from === 'psn' || from === 'tox' || from === 'brn') {
          src = m.status?.by && m.status.by !== m ? m.status.by : null; how = 'status';
        } else if (from === 'Sandstorm' || from === 'Hail') {
          src = weatherSetter && weatherSetter.side !== side ? weatherSetter : null;
          how = 'weather';
        } else if (!from && lastMove && lastMove.side !== side) { src = lastMove.user; how = 'direct'; }
        if (src && src.side === side) src = null;
        if (src) src.damage_dealt += pct;
        if (how === 'direct' && src) {
          const type = dex.moves.get(lastMove.move).type;
          takenByType[side][type] = (takenByType[side][type] || 0) + pct;
        }
        m.lastHit = { src, how: src ? how : 'self', move: how === 'direct' ? lastMove.move : from };
        break;
      }
      case '-activate':
        if (parts[2] === 'move: Destiny Bond') {
          const holder = get(parts[1]);
          const victim = active[other(sideOf(parts[1]))];
          if (victim && holder) victim.lastHit = { src: holder, how: 'Destiny Bond', move: 'Destiny Bond' };
        }
        break;
      case 'faint': {
        const m = get(parts[1]);
        if (!m) break;
        m.fainted = true; m.hp = 0;
        m.faint_order = ++faints[sideOf(parts[1])]; m.faint_turn = turn;
        const hit = m.lastHit || { src: null, how: 'self' };
        if (hit.src) hit.src.kos++;
        kos.push({ turn, side: sideOf(parts[1]), fainted: m.name, by: hit.src ? hit.src.name : null, how: hit.how,
                   move: hit.move || undefined });
        if (active[sideOf(parts[1])] === m) active[sideOf(parts[1])] = null;
        break;
      }
      default: break;
    }
  }

  const round = (x) => Math.round(x * 10) / 10;
  const out = {};
  for (const s of ['p1', 'p2']) {
    out[s] = [...mons[s].values()].map((m) => ({
      name: m.name, species: m.species, slot: m.slot, switch_ins: m.switch_ins, turns_active: m.turns_active, moves_used: m.moves_used,
      damage_dealt: round(m.damage_dealt), damage_taken: round(m.damage_taken), kos: m.kos,
      status_inflicted: m.status_inflicted, fainted: m.fainted,
      hp_end: m.max ? round((100 * (m.hp ?? m.max)) / m.max) : 100,
      healed: round(m.healed), setup_used: m.setup_used, support_used: m.support_used,
      switched_in_by_choice: m.switched_in_by_choice, faint_order: m.faint_order, faint_turn: m.faint_turn,
    }));
  }
  out.kos = kos;
  out.lead = lead;
  out.taken_by_type = { p1: Object.fromEntries(Object.entries(takenByType.p1).map(([k, v]) => [k, round(v)])),
                        p2: Object.fromEntries(Object.entries(takenByType.p2).map(([k, v]) => [k, round(v)])) };
  return out;
}
