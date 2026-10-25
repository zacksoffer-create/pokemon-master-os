// Phase 3: the trainer agent. Explainable tactical play with a trainer's identity on top.
//
//   Layer A  legal options only (legal.js)
//   Layer B  every option priced in one currency, HP percentage points swung, by one turn model: what the option does
//            this turn, if this side gets to act (asleep, frozen, paralysed, confused or knocked out first, it doesn't),
//            minus the hit that's coming (the foe's best expected attack, times its accuracy, times the chance the foe
//            acts at all: nothing while it recharges, by its sleep count while asleep). For a switch, the hit lands on
//            the Pokémon coming in, against how much better its knockout race is. Setup only if the boost changes the
//            race and it lives to use it; recovery by what it actually heals after the hit; status and hazards worth
//            more against a healthy foe with Pokémon left to come
//   Layer C  identity: aggression, risk, patience, heal line, switching, preservation, harassment, competence
//            (0-100 each), read from Blackthorn's coach settings, authored sliders and the cartridge AI flags
//   Layer D  adaptation: the foe's moves, item and ability as they're revealed; its real Speed learned from turn order;
//            sleep, recharge, confusion, Substitute and Perish Song as the log shows them
//
// It never reads the battle object. It knows its own team fully (it's theirs) and the foe only as revealed:
// species, level, HP as a percentage, status, boosts, revealed moves, item and ability. Unrevealed moves are stood in
// for by STAB attacks of the foe's types; unknown EVs by an assumption (foe_evs, Blackthorn's 85 by default).
// Damage comes from @smogon/calc, the one-on-one engine's calculator. Each decision keeps every option's value and
// the reasons for the top ones, and what it assumed about the foe, so a replay shows what the trainer was weighing.

import { Dex } from '@pkmn/sim';
import { calculate, Generations, Pokemon, Move, Field } from '@smogon/calc';
import { legalOptions } from './legal.js';
import { toShowdownSets } from '../teams.js';
import { statsOf } from '../optimize/evs.js';
import { toID } from '../util.js';

const gen = Generations.get(4);
const dex = Dex.forGen(4);

export const DEFAULT_PARAMS = {
  aggression: 50, risk: 40, patience: 50, heal_line: 40, switching: 60, preservation: 50,
  harassment: 50, setup_first: 0, competence: 90, foe_evs: 85,
};

const STANDINS = {
  Normal: ['Body Slam', 'Hyper Voice'], Fire: ['Fire Punch', 'Flamethrower'], Water: ['Waterfall', 'Surf'],
  Electric: ['Thunder Punch', 'Thunderbolt'], Grass: ['Seed Bomb', 'Energy Ball'], Ice: ['Ice Punch', 'Ice Beam'],
  Fighting: ['Brick Break', 'Aura Sphere'], Poison: ['Poison Jab', 'Sludge Bomb'], Ground: ['Earthquake', 'Earth Power'],
  Flying: ['Drill Peck', 'Air Slash'], Psychic: ['Zen Headbutt', 'Psychic'], Bug: ['X-Scissor', 'Bug Buzz'],
  Rock: ['Rock Slide', 'Power Gem'], Ghost: ['Shadow Claw', 'Shadow Ball'], Dragon: ['Dragon Claw', 'Dragon Pulse'],
  Dark: ['Crunch', 'Dark Pulse'], Steel: ['Iron Head', 'Flash Cannon'],
};
const WEATHER = { SunnyDay: 'Sun', RainDance: 'Rain', Sandstorm: 'Sand', Hail: 'Hail' };
const STATUS_VALUE = { slp: 55, par: 30, brn: 26, tox: 30, psn: 14 };
const HEALS = { rest: 1, wish: 0.5 };
const KO_BONUS = 45;
const WASTED = 15;   // a turn that does nothing: the hit still comes, and the turn is gone
// What a damage number depends on besides the two Pokémon's builds, boosts, status, item and ability: HP, but only
// for these moves and for the pinch abilities (a third of max HP or less).
const HP_ATTACKER = new Set(['eruption', 'waterspout', 'flail', 'reversal']);
const HP_DEFENDER = new Set(['wringout', 'crushgrip', 'brine']);
const PINCH = new Set(['Blaze', 'Torrent', 'Overgrow', 'Swarm']);
// Moves that take two turns: the first in the air or underground (no hit lands on the user), or charging in the open
const DODGE = new Set(['fly', 'bounce', 'dig', 'dive', 'shadowforce']);
const CHARGE = new Set(['solarbeam', 'skullbash', 'skyattack', 'razorwind']);
const COUNTERS = { counter: 'Physical', mirrorcoat: 'Special' };
const THAWS = new Set(['flamewheel', 'sacredfire']);
const IVS31 = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const boostKey = (b) => Object.entries(b || {}).filter(([, v]) => v).map(([k, v]) => k + v).join('');
const stateKey = (x) => `${x.side}|${x.name}|${x.species}|${x.ability}|${x.item}|${x.status}|${boostKey(x.boosts)}`;
const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const accStage = (s) => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));   // accuracy and evasion stages, Gens 3-4
const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const nameOf = (ident) => ident.slice(ident.indexOf(':') + 1).trim();
const pct = (x) => Math.round(x * 100);

function rolls(damage) {
  if (typeof damage === 'number') return [damage];
  if (Array.isArray(damage[0])) return damage[0].map((_, i) => damage.reduce((t, h) => t + (h[i] ?? h[h.length - 1]), 0));
  return damage;
}

/** Moves that only work under a condition: can `att` use `move` on `def` right now? */
function usable(move, att, def, threat) {
  const id = move.id;
  if (id === 'focuspunch') return def.status === 'slp' || def.status === 'frz' || (threat && threat.avg === 0);
  if (id === 'dreameater') return def.status === 'slp';
  if (id === 'snore' || id === 'sleeptalk') return att.status === 'slp';
  return true;
}

/**
 * The chance a Pokémon gets to act this turn: nothing while it recharges; asleep, by its count (Rest is exactly two
 * attempts, other sleep one to four, Gen 4); frozen, a 1-in-5 thaw; paralysed, 3 in 4; confused, 1 in 2.
 */
export function actChance(x, moveId) {
  if (x.volatiles?.mustrecharge) return 0;
  let p = 1;
  if (x.status === 'slp' && moveId !== 'sleeptalk' && moveId !== 'snore') {
    const k = (x.sleep?.cant ?? 1) * (x.ability === 'Early Bird' ? 2 : 1);
    p *= x.sleep?.rest ? (k >= 2 ? 1 : 0) : k <= 0 ? 0 : k >= 4 ? 1 : 1 / (5 - k);
  }
  if (x.status === 'frz' && !THAWS.has(moveId)) p *= 0.2;
  if (x.status === 'par') p *= 0.75;
  if (x.volatiles?.confusion) p *= 0.5;
  return p;
}

/** Turns a Pokémon still loses before it can act normally (for the knockout race). */
function lostTurns(x) {
  if (x.status === 'slp') {
    const k = x.sleep?.cant ?? 1;
    if (x.sleep?.rest) return Math.max(0, 2 - k);
    return [2.5, 1.5, 1, 0.5, 0][clip(k, 0, 4)];
  }
  if (x.status === 'frz') return 4;
  return 0;
}

export class TrainerAgent {
  constructor(params = {}, { team } = {}) {
    if (!team) throw new Error('the trainer agent needs its own team');
    this.name = 'trainer';
    this.p = { ...DEFAULT_PARAMS, ...params };
    this.team = team;
    const { names } = toShowdownSets(team);
    this.builds = new Map(names.map((n, i) => [n, team.members[i]]));
    this.ace = names[team.ace != null ? team.ace : names.length - 1];
    this.speedSeen = new Map();   // foe name -> {above, below}: Speed bounds learned from turn order
    this.lastChoice = null;
    // One agent plays one battle, so its caches live for the battle: damage by everything damage depends on, and the
    // calculator's Pokémon and Move objects (building those is most of the calculator's cost).
    this.memo = new Map();
    this.calcMons = new Map();
    this.calcMoves = new Map();
    this.fields = new Map();
  }

  // ---- what this side knows ------------------------------------------------------------------------------------

  ownMon(entry, view, active) {
    const name = nameOf(entry.ident);
    const b = this.builds.get(name);
    const [hpPart, status] = entry.condition.split(' ');
    const [hp, max] = hpPart.split('/').map(Number);
    const seen = view.mons[view.side].get(name);
    const boosts = active ? { ...(seen?.boosts || {}) } : {};
    const item = entry.item ? dex.items.get(entry.item).name : '';
    let spe = entry.stats.spe * stageMult(boosts.spe || 0);
    if (status === 'par') spe *= 0.25;
    if (item === 'Choice Scarf') spe *= 1.5;
    return { side: 'us', name, build: b, species: b.species, level: b.level, nature: b.nature, evs: b.evs, ivs: b.ivs,
             ability: b.ability, hp: max ? hp / max : 0, maxhp: max, status: status === 'fnt' ? '' : (status || ''), spe,
             boosts, item, moves: b.moves, types: dex.species.get(b.species).types, isAce: name === this.ace,
             volatiles: active ? { ...(seen?.volatiles || {}) } : {}, sleep: seen?.sleep || null };
  }

  foeMon(view) {
    const f = view.foeActive();
    if (!f) return null;
    const species = dex.species.get(f.species);
    const abilities = Object.values(species.abilities);
    const ability = f.ability || (abilities.length === 1 ? abilities[0] : abilities[0]);
    const ev = this.p.foe_evs;
    const evs = { hp: ev, atk: ev, def: ev, spa: ev, spd: ev, spe: ev };
    const item = f.item === null ? '' : (f.item || '');
    const stats = statsOf(species.name, { level: f.level, ivs: IVS31, evs, nature: 'Hardy' });
    let spe = stats.spe * stageMult(f.boosts.spe || 0);
    if (f.status === 'par') spe *= 0.25;
    if (item === 'Choice Scarf') spe *= 1.5;
    const seen = this.speedSeen.get(f.name);
    if (seen?.above != null && spe <= seen.above) spe = seen.above + 1;
    if (seen?.below != null && spe >= seen.below) spe = seen.below - 1;
    const revealed = [...f.moves].filter((m) => dex.moves.get(m).exists);
    let moves = revealed, standins = [];
    if (f.volatiles?.lockedmove) moves = [f.volatiles.lockedmove];   // locked in: it can only repeat the move
    else if (revealed.length < 4) {
      const special = species.baseStats.spa > species.baseStats.atk;
      standins = species.types.map((t) => STANDINS[t]?.[special ? 1 : 0]).filter(Boolean).filter((m) => !revealed.includes(m));
      moves = [...new Set([...revealed, ...standins])];
    }
    return { side: 'them', name: f.name, species: species.name, level: f.level, nature: 'Hardy', evs, ivs: IVS31,
             hp: f.pct / 100, maxhp: stats.hp, status: f.status || '', spe, item, moves, revealed, standins,
             types: species.types, boosts: f.boosts, ability, volatiles: { ...(f.volatiles || {}) }, sleep: f.sleep || null };
  }

  /** The calculator's Pokémon for one of the combatants above, built once per state. */
  calcMon(x) {
    const key = `${stateKey(x)}|${Math.round(x.hp * 1000)}`;
    let mon = this.calcMons.get(key);
    if (!mon) {
      mon = new Pokemon(gen, x.species, { level: x.level, nature: x.nature, evs: x.evs, ivs: x.ivs, ability: x.ability,
        item: x.item || undefined, boosts: { ...x.boosts }, status: x.status || '' });
      mon.originalCurHP = Math.max(1, Math.round(mon.maxHP() * x.hp));
      this.calcMons.set(key, mon);
    }
    return mon;
  }

  field(view, attackerSide) {
    const defSide = attackerSide === view.side ? view.foe : view.side;
    const cond = view.conditions[defSide] || {};
    const weather = WEATHER[view.weather] || undefined, reflect = !!cond.reflect, screen = !!cond.lightscreen;
    const key = `${weather}|${reflect}|${screen}`;
    let f = this.fields.get(key);
    if (!f) {
      f = new Field({ weather, defenderSide: { isReflect: reflect, isLightScreen: screen } });
      f.key = key;
      this.fields.set(key, f);
    }
    return f;
  }

  /** Damage of one move as fractions of the defender's max HP: {lo, avg, hi, rolls}. */
  damage(att, def, moveName, field) {
    const m = dex.moves.get(moveName);
    if (!m.exists || m.category === 'Status') return null;
    const hpA = HP_ATTACKER.has(m.id) ? `h${Math.round(att.hp * 1000)}` : PINCH.has(att.ability) ? `p${att.hp <= 1 / 3 ? 1 : 0}` : '';
    const hpD = HP_DEFENDER.has(m.id) ? `h${Math.round(def.hp * 1000)}` : '';
    const key = `${m.id}|${stateKey(att)}${hpA}|${stateKey(def)}${hpD}|${field.key}`;
    let out = this.memo.get(key);
    if (!out) {
      out = this.damageUncached(att, def, m, field);
      this.memo.set(key, out);
    }
    return out;
  }

  damageUncached(att, def, m, field) {
    try {
      const A = this.calcMon(att), D = this.calcMon(def);
      const mk = `${m.id}|${att.species}|${att.ability}|${att.item}`;
      let move = this.calcMoves.get(mk);
      if (!move) this.calcMoves.set(mk, (move = new Move(gen, m.name, { ability: A.ability, item: A.item, species: A.name })));
      const res = calculate(gen, A, D, move, field);
      const max = D.maxHP();
      const r = rolls(res.damage).map((d) => d / max);
      return { lo: Math.min(...r), avg: r.reduce((t, d) => t + d, 0) / r.length, hi: Math.max(...r), rolls: r,
               priority: m.priority, acc: m.accuracy === true ? 1 : m.accuracy / 100, move: m };
    } catch (err) {
      return { lo: 0, avg: 0, hi: 0, rolls: [0], priority: m.priority, acc: 1, move: m };
    }
  }

  /** The chance a move hits: its accuracy, accuracy and evasion stages, abilities, items and weather (Gens 3-4). */
  hitChance(att, def, m, view) {
    if (m.accuracy === true) return 1;
    if (att.ability === 'No Guard' || def.ability === 'No Guard') return 1;
    const w = view.weather;
    if (m.id === 'thunder' && w === 'RainDance') return 1;
    if (m.id === 'blizzard' && w === 'Hail') return 1;
    let acc = m.accuracy / 100;
    if (m.id === 'thunder' && w === 'SunnyDay') acc = 0.5;
    if (m.ohko) return acc;
    acc *= accStage(clip((att.boosts?.accuracy || 0) - (def.boosts?.evasion || 0), -6, 6));
    if (att.ability === 'Compound Eyes') acc *= 1.3;
    if (att.ability === 'Hustle' && m.category === 'Physical') acc *= 0.8;
    if ((def.ability === 'Sand Veil' && w === 'Sandstorm') || (def.ability === 'Snow Cloak' && w === 'Hail')) acc *= 0.8;
    if (def.item === 'Bright Powder' || def.item === 'Lax Incense') acc *= 0.9;
    return Math.min(1, acc);
  }

  /** The foe's best expected attack on `target`: by damage times its chance to hit. */
  threat(foe, target, view) {
    let best = { avg: 0, hi: 0, lo: 0, rolls: [0], priority: 0, name: null, hit: 1, cat: null };
    const field = this.field(view, view.foe);
    for (const name of foe.moves) {
      const d = this.damage(foe, target, name, field);
      if (!d) continue;
      const hit = this.hitChance(foe, target, d.move, view);
      if (d.avg * hit > best.avg * best.hit) best = { ...d, name, hit, cat: d.move.category };
    }
    return best;
  }

  /** The knockout race between one of ours and the foe: their hits needed minus ours, ±½ for who acts first. */
  matchup(ours, foe, view, threat) {
    const t = threat || this.threat(foe, ours, view);
    let best = null;
    for (const m of ours.moves) {
      const d = this.damage(ours, foe, m, this.field(view, view.side));
      if (!d || !usable(d.move, ours, foe, t) || DODGE.has(d.move.id) || CHARGE.has(d.move.id)) continue;
      const e = d.avg * this.hitChance(ours, foe, d.move, view);
      if (!best || e > best.e) best = { ...d, e };
    }
    // two-turn moves count at half speed in the race
    if (!best) {
      for (const m of ours.moves) {
        const d = this.damage(ours, foe, m, this.field(view, view.side));
        if (d && d.avg > 0) { const e = (d.avg * this.hitChance(ours, foe, d.move, view)) / 2; if (!best || e > best.e) best = { ...d, e }; }
      }
    }
    const ourHits = (best && best.e > 0 ? Math.ceil(foe.hp / best.e) : 9) + lostTurns(ours);
    const theirE = t.avg * t.hit;
    const theirHits = (theirE > 0 ? Math.ceil(ours.hp / theirE) : 9) + lostTurns(foe);
    const first = (best?.priority || 0) > t.priority || ((best?.priority || 0) === t.priority && ours.spe > foe.spe);
    return { margin: theirHits - ourHits + (first ? 0.5 : -0.5), ourHits, theirHits, first, best, threat: t };
  }

  learnSpeed(view, me) {
    const order = view.lastOrder;
    if (order.length !== 2 || order[0].side === order[1].side) return;
    const pm = (o) => dex.moves.get(o.move).priority || 0;
    if (pm(order[0]) !== pm(order[1])) return;
    const foeFirst = order[0].side === view.foe;
    const foeName = (foeFirst ? order[0] : order[1]).name, ourName = (foeFirst ? order[1] : order[0]).name;
    if (ourName !== me.name) return;
    const s = this.speedSeen.get(foeName) || {};
    if (foeFirst) s.above = Math.max(s.above ?? 0, me.spe); else s.below = Math.min(s.below ?? 1e9, me.spe);
    this.speedSeen.set(foeName, s);
  }

  // ---- the decision --------------------------------------------------------------------------------------------

  decide(request, view, rng) {
    const options = legalOptions(request);
    if (!options.length) return null;
    if (options.length === 1) return this.pack(options[0], options.map((o) => ({ ...o, value: 0, why: 'the only option' })), rng);
    const side = request.side.pokemon;
    const forced = !!request.forceSwitch;
    const activeEntry = side.find((p) => p.active);
    const me = !forced && activeEntry ? this.ownMon(activeEntry, view, true) : null;
    if (me) this.learnSpeed(view, me);
    const foe = this.foeMon(view);   // after anything just learned about its Speed
    const ctx = { me, foe, side, view, forced, request };
    if (me && foe) ctx.turn = this.turnModel(me, foe, view, side);
    const scored = options.map((o) => ({ ...o, ...this.value(o, ctx) }));
    const out = this.pack(this.choose(scored, rng), scored, rng);
    if (foe) {
      out.assumed = { foe_evs: this.p.foe_evs, foe_speed: Math.round(foe.spe), stand_ins: foe.standins.length ? foe.standins : undefined,
                      foe_ability: foe.ability };
      if (ctx.turn) out.assumed.coming = ctx.turn.threat.name ? `${ctx.turn.threat.name}, ~${pct(ctx.turn.takenAvg)}%` +
        `${ctx.turn.foeActs < 1 ? ` (acts ${pct(ctx.turn.foeActs)}%)` : ''}` : 'nothing';
    }
    return out;
  }

  /** What's coming this turn if we stay in: the foe's attack, the chance it acts, and what that does to us. */
  turnModel(me, foe, view, side) {
    const threat = this.threat(foe, me, view);
    const foeActs = actChance(foe, threat.name ? toID(threat.name) : '');
    const hitP = threat.hit * foeActs;
    const takenAvg = Math.min(threat.avg, me.hp) * hitP;
    const pFaint = (threat.rolls.filter((d) => d >= me.hp).length / threat.rolls.length) * hitP;
    // a foe with moves we haven't seen may have priority: a little risk to a low Pokémon that acts first without it
    const unseen = foe.revealed.length < 4 && me.hp <= 0.25 ? 0.15 : 0;
    const alive = side.filter((p) => !p.condition.endsWith(' fnt')).length;
    const { off, def } = this.weights();
    const myW = this.monWeight(me, alive);
    return { threat, foeActs, takenAvg, pFaint, unseen, alive, off, def, myW,
             takenCost: def * takenAvg * 100 * myW,
             foeFirstVs: (prio) => threat.priority > prio || (threat.priority === prio && foe.spe >= me.spe) };
  }

  value(o, ctx) {
    const { me, foe, forced } = ctx;
    if (o.kind === 'pass') return { value: 0, why: 'pass' };
    if (!foe) return { value: o.kind === 'move' ? 1 : 0, why: 'no foe in view' };
    if (o.kind === 'switch') return forced ? this.sendIn(o, ctx) : this.switchOut(o, ctx);
    if (!me) return { value: 0, why: '' };
    const v = this.moveValue(o, ctx);
    // Perish Song at 1: whatever it does, this Pokémon faints at the end of the turn unless it leaves
    if (me.volatiles.perish === 1) { v.value -= me.hp * 100 * ctx.turn.myW; v.why += ', faints to Perish Song this turn'; }
    return v;
  }

  weights() {
    const a = this.p.aggression / 100;
    return { off: 0.8 + 0.4 * a, def: 1.2 - 0.4 * a };
  }

  monWeight(mon, alive) {
    return 1 + (mon.isAce && alive > 1 ? this.p.preservation / 100 : 0);
  }

  hazardCost(entry, view) {
    const cond = view.conditions[view.side] || {};
    const types = dex.species.get(this.builds.get(nameOf(entry.ident)).species).types;
    let cost = 0;
    if (cond.stealthrock) cost += 0.125 * 2 ** dex.getEffectiveness('Rock', types) * (dex.getImmunity('Rock', types) ? 1 : 0);
    const grounded = !types.includes('Flying') && this.builds.get(nameOf(entry.ident)).ability !== 'Levitate';
    if (cond.spikes && grounded) cost += [0, 1 / 8, 1 / 6, 1 / 4][Math.min(3, cond.spikes)];
    return cost;
  }

  sendIn(o, { foe, side, view }) {
    const entry = side[o.slot];
    const t = this.ownMon(entry, view, false);
    const m = this.matchup(t, foe, view);
    const alive = side.filter((p) => !p.condition.endsWith(' fnt')).length;
    const hz = this.hazardCost(entry, view);
    let value = clip(m.margin, -3, 3) * 14 + t.hp * 10 - hz * 100;
    if (t.isAce && alive > 2 && m.margin < 2) value -= this.p.preservation / 4;
    return { value, why: `race ${m.margin > 0 ? '+' : ''}${m.margin} (needs ${m.ourHits}, they need ${m.theirHits}${m.first ? ', moves first' : ''})` +
      (hz ? `, hazards ${pct(hz)}%` : '') + (t.isAce ? ', the ace' : '') + (t.status === 'slp' ? ', asleep' : '') };
  }

  switchOut(o, { me, foe, side, view, turn }) {
    const entry = side[o.slot];
    const t = this.ownMon(entry, view, false);
    const now = this.matchup(me, foe, view, turn.threat);
    // the foe aims at the Pokémon in front of it: the incoming Pokémon takes that move (if the foe acts)
    const aimed = turn.threat.name ? this.damage(foe, t, turn.threat.name, this.field(view, view.foe)) : null;
    const aimedHit = aimed ? this.hitChance(foe, t, aimed.move, view) * turn.foeActs : 0;
    const incoming = Math.min(t.hp, (aimed?.avg || 0) * aimedHit) + this.hazardCost(entry, view);
    const after = { ...t, hp: Math.max(0.01, t.hp - incoming) };
    const then = this.matchup(after, foe, view);
    const gain = (clip(then.margin, -3, 3) - clip(now.margin, -3, 3)) * 14;
    const penalty = 8 + 22 * (1 - this.p.switching / 100) + (this.lastChoice?.startsWith('switch') ? 10 : 0);
    const keepMe = me.isAce && now.margin < 0 ? this.p.preservation / 5 : 0;
    let value = gain - incoming * 100 * turn.def * this.monWeight(t, turn.alive) * 0.6 - penalty + keepMe;
    const why = [`matchup ${now.margin} → ${then.margin} for ${t.name}, takes ~${pct(incoming)}% coming in`];
    if (me.volatiles.perish === 1) { value += me.hp * 100 * turn.myW; why.push(`saves ${me.name} from Perish Song`); }
    if (me.status === 'slp' && actChance(me, '') < 1) why.push(`${me.name} is asleep`);
    return { value, why: why.join(', ') };
  }

  moveValue(o, ctx) {
    const { me, foe, view, turn } = ctx;
    const moveName = this.moveName(o, me);
    const m = dex.moves.get(moveName);
    const act = actChance(me, m.id);
    // the chance we're knocked out before this move goes off
    const before = (prio) => (turn.foeFirstVs(prio) ? turn.pFaint : prio > 0 ? 0 : turn.unseen);
    const lands = (prio) => act * (1 - before(prio));
    const sleepy = act < 1 && me.status === 'slp' ? `, asleep (acts ${pct(act)}%)` : act < 1 ? `, acts ${pct(act)}%` : '';
    if (m.category === 'Status') return this.statusValue(m, { ...ctx, act, lands: lands(m.priority), sleepy });

    if (COUNTERS[m.id]) {
      // moves last; returns twice the hit taken if that hit was the matching kind and it lives through it
      const ok = turn.threat.cat === COUNTERS[m.id];
      const back = ok ? Math.min(foe.hp, (2 * turn.takenAvg * (me.maxhp || 1)) / (foe.maxhp || 1)) * act * (1 - turn.pFaint) : 0;
      const value = turn.off * back * 100 + (back >= foe.hp ? KO_BONUS * act * (1 - turn.pFaint) : 0) - turn.takenCost - (ok ? 0 : WASTED);
      return { value, why: ok ? `returns ~${pct(back)}% if ${turn.threat.name} comes${sleepy}` : `${m.name} fails against ${turn.threat.name || 'that'}` };
    }
    const d = this.damage(me, foe, moveName, this.field(view, view.side));
    if (!d || d.hi === 0) return { value: -turn.takenCost - WASTED, why: `${moveName} does nothing to ${foe.species}` };
    const hit = this.hitChance(me, foe, m, view);
    const works = usable(m, me, foe, turn.threat);   // e.g. Focus Punch fails if the user is hit first
    const first = !turn.foeFirstVs(d.priority);
    const p = works ? lands(d.priority) * hit : 0;
    // a Substitute takes the hit instead: breaking it is worth something, but nothing reaches the foe
    const sub = !!foe.volatiles.substitute && !m.flags?.sound;
    const pKO = sub ? 0 : (d.rolls.filter((x) => x >= foe.hp).length / d.rolls.length) * p;
    const dealt = (sub ? Math.min(d.avg, 0.25) * 0.5 : Math.min(d.avg, foe.hp)) * p;
    const taken = first ? turn.takenAvg * (1 - pKO) : turn.takenAvg;
    let value = turn.off * dealt * 100 + KO_BONUS * pKO - turn.def * taken * 100 * turn.myW;
    value -= (1 - hit) * 30 * (1 - this.p.risk / 100);
    value += 0.3 * d.priority + 0.5 * hit;   // between equal options: the surer, faster one
    const reasons = [`~${pct(dealt)}% to ${foe.species}${sub ? "'s Substitute" : ''}`];
    if (pKO > 0) reasons.push(`KO ${pct(pKO)}%`);
    if (hit < 1) reasons.push(`hits ${pct(hit)}%`);
    if (!works) reasons.push(m.id === 'focuspunch' ? 'fails if hit first' : 'would fail now');
    if (!first) reasons.push(`moves second${turn.pFaint > 0 ? `, ${pct(turn.pFaint)}% chance it's KO'd first` : ''}`);
    else if (turn.unseen && d.priority <= 0) reasons.push('no priority against unseen moves');
    if (m.recoil) value -= dealt * (m.recoil[0] / m.recoil[1]) * 100 * turn.def * turn.myW;
    if (m.selfdestruct === 'always') { value -= me.hp * 100 * turn.myW * (turn.alive > 1 ? 1 : 3); reasons.push('faints'); }
    if (m.self?.boosts && Object.values(m.self.boosts).some((x) => x < 0)) value -= 4;
    if (m.selfSwitch && turn.alive > 1) { value += 6; reasons.push('pivots'); }
    if (DODGE.has(m.id)) {
      // over two turns: one hit dealt, one taken (the first turn it's out of reach)
      value = value / 2; reasons.push('two turns, out of reach on the first');
    } else if (CHARGE.has(m.id) && !(m.id === 'solarbeam' && view.weather === 'SunnyDay')) {
      value = (value + turn.def * taken * 100 * turn.myW) / 2 - turn.takenCost; reasons.push('charges a turn first');
    }
    if (m.self?.volatileStatus === 'mustrecharge') {
      // the next turn is the foe's for free: its hit again, or the next Pokémon's free turn
      value -= turn.def * 100 * turn.myW * (pKO * 0.2 + (1 - pKO) * turn.takenAvg); reasons.push('recharges');
    }
    if (m.self?.volatileStatus === 'lockedmove') { value -= 6; reasons.push('locks in'); }
    if (m.id === 'rapidspin') {
      const cond = view.conditions[view.side] || {};
      const layers = (cond.stealthrock ? 1 : 0) + (cond.spikes || 0) + (cond.toxicspikes || 0);
      value += layers * 6 * (turn.alive - 1);
      if (layers) reasons.push('clears hazards');
    }
    return { value, why: reasons.join(', ') + sleepy };
  }

  statusValue(m, ctx) {
    const { turn, act, lands, sleepy } = ctx;
    const r = this.statusEffect(m, ctx);
    // the hit still comes; Protect stops it, a Substitute set up first takes it
    let taken = turn.takenCost;
    if ((m.id === 'protect' || m.id === 'detect') && r.effect > -30) taken = 0;
    if (m.id === 'substitute' && !turn.foeFirstVs(m.priority) && turn.threat.avg < 0.25) taken = 0;
    const effect = r.effect > 0 ? r.effect * lands : r.effect;
    return { value: effect - taken, why: r.why + (lands < 1 && r.effect > 0 && act === 1 ? `, ${pct(1 - lands)}% chance it's KO'd first` : '') + sleepy };
  }

  /** What a status move does if it goes off, before the hit coming this turn is taken off. */
  statusEffect(m, { me, foe, view, turn }) {
    const foeLeft = view.teamSize[view.foe] - [...view.mons[view.foe].values()].filter((x) => x.fainted).length;
    const threat = turn.threat;
    const sub = !!foe.volatiles.substitute;
    // setup: only if the boost shortens the knockout race (or wins the Speed race) and it lives to use it
    if (m.boosts && m.target === 'self') {
      const after = { ...me, boosts: { ...me.boosts } };
      for (const [k, v] of Object.entries(m.boosts)) after.boosts[k] = clip((after.boosts[k] || 0) + v, -6, 6);
      if (Object.keys(m.boosts).every((k) => (me.boosts[k] || 0) >= 4)) return { effect: -WASTED, why: 'already boosted' };
      if (m.boosts.evasion) {
        // evasion: the foe's hits land less often from here on
        const was = accStage(-(me.boosts.evasion || 0)), will = accStage(-(after.boosts.evasion || 0));
        return { effect: threat.avg * 100 * turn.def * (1 - will / was) * 2 * turn.foeActs, why: `${m.name}: their hits land ${pct(will)}% as often` };
      }
      after.spe = me.spe * stageMult(after.boosts.spe || 0) / stageMult(me.boosts.spe || 0);
      const now = this.matchup(me, foe, view, threat), then = this.matchup(after, foe, view);
      const survives = me.hp - turn.takenAvg > threat.hi * threat.hit * 0.9;
      const gain = (now.ourHits - then.ourHits) + (!now.first && then.first ? 1 : 0) + (then.theirHits - now.theirHits);
      // boosts last: what they're worth against the foes still to come, more the less this one can hurt it
      const cats = new Set(me.moves.map((n) => dex.moves.get(n).category));
      const useful = Object.entries(m.boosts).filter(([k]) => k === 'spe' || (k === 'atk' && cats.has('Physical')) ||
        (k === 'spa' && cats.has('Special'))).reduce((t, [k, v]) => t + Math.max(0, Math.min(v, 6 - (me.boosts[k] || 0))), 0);
      const sweep = Math.max(0, foeLeft - 1) * 8 * useful * Math.max(0, 1 - 2 * threat.avg * turn.foeActs);
      let effect = survives ? (gain * 22 + sweep) * (0.5 + this.p.patience / 100) : -20;
      if ((1 - me.hp) * 100 > this.p.patience) effect -= 25;
      if (threat.hi * turn.foeActs < 0.15) effect += 15;
      if (view.turn <= 1) effect += this.p.setup_first / 10;
      const free = turn.foeActs < 0.5 ? `, a free turn (${foe.species} ${foe.volatiles.mustrecharge ? 'recharges' : 'is unlikely to act'})` : '';
      return { effect, why: `${m.name}: race ${now.margin} → ${then.margin}${survives ? `, +${Math.round(sweep)} for the ${Math.max(0, foeLeft - 1)} still to come` : ", but it won't survive to use it"}${free}` };
    }
    // recovery: what it heals after this turn's hit (if the foe is first), more under the heal line
    const heal = m.heal ? m.heal[0] / m.heal[1] : HEALS[m.id];
    if (heal) {
      const hpThen = turn.foeFirstVs(m.priority) ? me.hp - turn.takenAvg : me.hp;
      const healed = Math.max(0, Math.min(heal, 1 - hpThen));
      if (healed < 0.1) return { effect: -WASTED, why: 'barely hurt' };
      let effect = healed * 100 * turn.def * turn.myW;
      if (threat.avg * threat.hit * turn.foeActs >= healed) effect -= 25;   // it can't outpace the damage
      if (me.hp * 100 <= this.p.heal_line) effect += 15;
      if (m.id === 'rest') effect -= 2 * threat.avg * 100 * 0.5 + (healed < 0.5 ? 20 : 0);
      return { effect, why: `${m.name}: heals ~${pct(healed)}%, takes ~${pct(turn.takenAvg)}%` };
    }
    // a major status condition
    if (m.status) {
      if (foe.status) return { effect: -WASTED, why: `${foe.species} already has a status` };
      if (sub) return { effect: -WASTED, why: `${foe.species} is behind a Substitute` };
      const immune = (m.status === 'tox' || m.status === 'psn') ? foe.types.some((t) => t === 'Poison' || t === 'Steel')
        : m.status === 'brn' ? foe.types.includes('Fire')
          : m.id === 'thunderwave' ? !dex.getImmunity('Electric', foe.types) : false;
      if (immune) return { effect: -WASTED, why: `${foe.species} can't get ${m.status}` };
      const mine = this.matchup(me, foe, view, threat);
      let base = STATUS_VALUE[m.status] || 10;
      const fb = dex.species.get(foe.species).baseStats;
      if (m.status === 'brn' && fb.atk > fb.spa) base *= 1.5;
      if (m.status === 'par' && foe.spe > me.spe) base *= 1.3;
      const hit = this.hitChance(me, foe, m, view);
      return { effect: base * (0.5 + this.p.harassment / 100) * foe.hp * (mine.ourHits >= 3 ? 1 : 0.5) * hit,
               why: `${m.name} on a ${pct(foe.hp)}% ${foe.species}${hit < 1 ? ` (hits ${pct(hit)}%)` : ''}` };
    }
    // entry hazards
    const cond = view.conditions[view.foe] || {};
    // per foe Pokémon still to come, each expected to come in about 1.5 times over a battle
    const layers = { stealthrock: [1, [14]], spikes: [3, [9, 6, 5]], toxicspikes: [2, [7, 4]] }[m.id];
    if (layers) {
      const have = cond[m.id] || 0;
      if (have >= layers[0] || foeLeft <= 1) return { effect: -WASTED, why: have >= layers[0] ? 'already up' : 'nothing left to hurt' };
      return { effect: layers[1][have] * (foeLeft - 1), why: `${m.name}: ${foeLeft - 1} of theirs still to come in` };
    }
    if (m.id === 'reflect' || m.id === 'lightscreen') {
      const mineCond = view.conditions[view.side] || {};
      const fits = (m.id === 'reflect' && threat.cat === 'Physical') || (m.id === 'lightscreen' && threat.cat === 'Special');
      return { effect: !mineCond[m.id] && fits ? 12 + threat.avg * 50 : -WASTED, why: m.name };
    }
    if (m.id === 'healbell' || m.id === 'aromatherapy') {
      const sick = [...view.mons[view.side].values()].filter((x) => x.status && !x.fainted).length;
      return { effect: sick ? sick * 15 : -WASTED, why: `${sick} of ours with a status` };
    }
    if (m.id === 'roar' || m.id === 'whirlwind' || m.id === 'haze') {
      const up = Object.values(foe.boosts).filter((x) => x > 0).reduce((t, x) => t + x, 0);
      const hz = (cond.stealthrock ? 1 : 0) + (cond.spikes || 0);
      const effect = up * 12 + (m.id !== 'haze' && foeLeft > 1 ? hz * 5 : 0);
      return { effect: effect || -WASTED, why: `${m.name} against +${up}` };
    }
    if (m.id === 'substitute') return { effect: me.hp > 0.5 && threat.avg < 0.25 ? 12 : -WASTED, why: 'Substitute' };
    if (m.id === 'protect' || m.id === 'detect') {
      if (this.lastChoice === `move:${m.id}`) return { effect: -40, why: `${m.name} twice in a row usually fails` };
      // it only buys a turn: worth it when the turn hurts them (poison, burn, weather) or runs out a lock
      const chip = (['psn', 'tox', 'brn'].includes(foe.status) ? 8 : 0) + (foe.volatiles.lockedmove ? 6 : 0);
      return { effect: -4 + chip, why: `${m.name}: blocks the hit, buys a turn` };
    }
    if (m.id === 'leechseed') return { effect: foe.types.includes('Grass') || foe.volatiles.leechseed || sub ? -WASTED : 14 * foe.hp, why: 'Leech Seed' };
    if (m.volatileStatus === 'confusion') return { effect: foe.volatiles.confusion || sub ? -WASTED : 8 * foe.hp, why: m.name };
    return { effect: -12, why: `${m.name} (no plan for it)` };
  }

  moveName(o, me) {
    const id = o.id || toID(o.label);
    if (id === 'recharge' || id === 'struggle') return o.label;
    const own = me.moves.find((n) => toID(n) === id || (id.startsWith('hiddenpower') && toID(n).startsWith('hiddenpower')));
    return own || o.label;
  }

  choose(scored, rng) {
    const comp = this.p.competence;
    if (comp >= 99) return scored.reduce((a, b) => (b.value > a.value ? b : a));
    const T = 1 + (100 - comp) * 0.35;   // competence 90 → 4.5 (near-best), 55 → 16.75 (loose)
    const top = Math.max(...scored.map((s) => s.value));
    const w = scored.map((s) => Math.exp((s.value - top) / T));
    let r = rng.next() * w.reduce((t, x) => t + x, 0);
    for (let i = 0; i < scored.length; i++) { r -= w[i]; if (r <= 0) return scored[i]; }
    return scored[scored.length - 1];
  }

  pack(pick, scored, rng) {
    this.lastChoice = pick.kind === 'move' ? `move:${toID(pick.label)}` : pick.choice;
    const order = [...scored].sort((a, b) => b.value - a.value);
    return {
      choice: pick.choice, kind: pick.kind, label: pick.label,
      options: scored.map((s) => s.choice),
      labels: scored.map((s) => s.label),
      scores: scored.map((s) => Math.round((s.value ?? 0) * 10) / 10),
      why: order.slice(0, 3).map((s) => `${s.label}: ${Math.round((s.value ?? 0) * 10) / 10} (${s.why})`),
      reasons: Object.fromEntries(scored.map((s) => [s.label, s.why])),
    };
  }
}

/**
 * A trainer's identity from Blackthorn's records: authored sliders (offense, rigidity, bond, risk), coach settings
 * (aggression, patience, heal_line, risk_tolerance) and the cartridge AI flags read as competence and tendencies.
 * Returns the agent's parameters and, for each one, where it came from.
 */
export function paramsFromLibrary(v = {}) {
  const p = { ...DEFAULT_PARAMS }, source = {};
  const set = (k, val, why) => { p[k] = Math.round(clip(val, 0, 100)); source[k] = why; };
  const s = v.sliders || {};
  if (s.offense?.value != null) set('aggression', s.offense.value, `authored offense slider ${s.offense.value}`);
  if (s.risk?.value != null) set('risk', s.risk.value, `authored risk slider ${s.risk.value}`);
  if (s.rigidity?.value != null) set('switching', 100 - s.rigidity.value * 0.6, `authored rigidity slider ${s.rigidity.value}`);
  if (s.bond?.value != null) set('preservation', s.bond.value, `authored bond slider ${s.bond.value}`);
  const words = [...(v.reading?.competence || []), ...(v.reading?.tendency || [])];
  const comp = (v.reading?.competence || []).length;
  if (v.reading) set('competence', 55 + comp * 12, `${comp} competence flag${comp === 1 ? '' : 's'} in the game's AI (${(v.reading.competence || []).join(', ') || 'none'})`);
  if (words.includes('sets up early')) set('setup_first', 80, 'the AI flag "sets up early"');
  if (words.includes('takes risks')) set('risk', Math.max(p.risk, 75), 'the AI flag "takes risks"');
  if (words.includes('status and harassment')) set('harassment', 85, 'the AI flag "status and harassment"');
  const c = v.coach || {};
  if (c.aggression != null) set('aggression', c.aggression, `coach setting aggression ${c.aggression}`);
  if (c.patience != null) set('patience', c.patience, `coach setting patience ${c.patience}`);
  if (c.heal_line != null) set('heal_line', c.heal_line, `coach setting heal line ${c.heal_line}`);
  if (c.risk_tolerance != null) set('risk', c.risk_tolerance, `coach setting risk tolerance ${c.risk_tolerance}`);
  return { params: p, source };
}
