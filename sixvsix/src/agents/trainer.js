// Phase 3: the trainer agent. Explainable tactical play with a trainer's identity on top.
//
//   Layer A  legal options only (legal.js)
//   Layer B  every option priced in one currency, HP percentage points swung: damage dealt and its knockout
//            chance, damage taken, who moves first; for a switch, the hit the new Pokémon takes plus hazards
//            against how much better its matchup is; setup only if the boost changes the knockout race and the
//            Pokémon survives to use it; recovery only when it outpaces what comes back; status and hazards worth
//            more against a healthy foe with Pokémon left to come
//   Layer C  identity: aggression, risk, patience, heal line, switching, preservation, harassment, competence
//            (0-100 each), read from Blackthorn's coach settings, authored sliders and the cartridge AI flags
//   Layer D  adaptation: the foe's moves, item and ability as they're revealed; its real Speed learned from turn order
//
// It never reads the battle object. It knows its own team fully (it's theirs) and the foe only as revealed:
// species, level, HP as a percentage, status, boosts, revealed moves, item and ability. Unrevealed moves are stood in
// for by STAB attacks of the foe's types; unknown EVs by an assumption (foe_evs, Blackthorn's 85 by default).
// Damage comes from @smogon/calc, the one-on-one engine's calculator. Each decision keeps every option's value and
// the reasons for the top ones, so a replay shows what the trainer was weighing.

import { Dex } from '@pkmn/sim';
import { calculate, Generations, Pokemon, Move, Field } from '@smogon/calc';
import { legalOptions } from './legal.js';
import { toShowdownSets } from '../teams.js';
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
const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const nameOf = (ident) => ident.slice(ident.indexOf(':') + 1).trim();

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
  }

  // ---- what this side knows ------------------------------------------------------------------------------------

  ownMon(entry, view, active) {
    const name = nameOf(entry.ident);
    const b = this.builds.get(name);
    const [hpPart, status] = entry.condition.split(' ');
    const [hp, max] = hpPart.split('/').map(Number);
    const boosts = active ? { ...(view.mons[view.side].get(name)?.boosts || {}) } : {};
    const item = entry.item ? dex.items.get(entry.item).name : '';
    const mon = new Pokemon(gen, b.species, { level: b.level, nature: b.nature, evs: b.evs, ivs: b.ivs, ability: b.ability,
      item: item || undefined, boosts, status: status === 'fnt' ? '' : (status || ''), curHP: hp });
    let spe = entry.stats.spe * stageMult(boosts.spe || 0);
    if (status === 'par') spe *= 0.25;
    if (item === 'Choice Scarf') spe *= 1.5;
    return { side: 'us', name, build: b, mon, hp: max ? hp / max : 0, status: status || '', spe, boosts, item,
             moves: b.moves, types: dex.species.get(b.species).types, isAce: name === this.ace };
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
    const mon = new Pokemon(gen, species.name, { level: f.level, nature: 'Hardy', evs, ability, item: item || undefined,
      boosts: { ...f.boosts }, status: f.status || '' });
    mon.originalCurHP = Math.max(1, Math.round((mon.maxHP() * f.pct) / 100));
    let spe = mon.rawStats.spe * stageMult(f.boosts.spe || 0);
    if (f.status === 'par') spe *= 0.25;
    if (item === 'Choice Scarf') spe *= 1.5;
    const seen = this.speedSeen.get(f.name);
    if (seen?.above != null && spe <= seen.above) spe = seen.above + 1;
    if (seen?.below != null && spe >= seen.below) spe = seen.below - 1;
    const revealed = [...f.moves].filter((m) => dex.moves.get(m).exists);
    let moves = revealed;
    if (revealed.length < 4) {
      const special = species.baseStats.spa > species.baseStats.atk;
      const standins = species.types.map((t) => STANDINS[t]?.[special ? 1 : 0]).filter(Boolean);
      moves = [...new Set([...revealed, ...standins])];
    }
    return { side: 'them', name: f.name, species: species.name, mon, hp: f.pct / 100, status: f.status || '', spe, item,
             moves, revealed, types: species.types, boosts: f.boosts, ability };
  }

  field(view, attackerSide) {
    const defSide = attackerSide === view.side ? view.foe : view.side;
    const cond = view.conditions[defSide] || {};
    return new Field({ weather: WEATHER[view.weather] || undefined,
                       defenderSide: { isReflect: !!cond.reflect, isLightScreen: !!cond.lightscreen } });
  }

  /** Damage of one move as fractions of the defender's max HP: {lo, avg, hi, rolls}. */
  damage(att, def, moveName, field) {
    const m = dex.moves.get(moveName);
    if (!m.exists || m.category === 'Status') return null;
    const key = `d|${att.side}|${att.name}|${att.hp}|${JSON.stringify(att.mon.boosts)}|${def.side}|${def.name}|${def.hp}|` +
      `${JSON.stringify(def.mon.boosts)}|${m.id}|${field.weather}|${field.defenderSide.isReflect}|${field.defenderSide.isLightScreen}`;
    if (this.memo?.has(key)) return this.memo.get(key);
    const out = this.damageUncached(att, def, m, field);
    this.memo?.set(key, out);
    return out;
  }

  damageUncached(att, def, m, field) {
    try {
      const res = calculate(gen, att.mon, def.mon, new Move(gen, m.name, { ability: att.mon.ability, item: att.mon.item, species: att.mon.name }), field);
      const max = def.mon.maxHP();
      const r = rolls(res.damage).map((d) => d / max);
      return { lo: Math.min(...r), avg: r.reduce((t, d) => t + d, 0) / r.length, hi: Math.max(...r), rolls: r,
               priority: m.priority, acc: m.accuracy === true ? 1 : m.accuracy / 100, move: m };
    } catch (err) {
      return { lo: 0, avg: 0, hi: 0, rolls: [0], priority: m.priority, acc: 1, move: m };
    }
  }

  /** The foe's strongest expected attack on `target`. */
  threat(foe, target, view) {
    const key = `t|${target.name}|${target.hp}|${JSON.stringify(target.mon.boosts)}`;
    if (this.memo?.has(key)) return this.memo.get(key);
    let best = { avg: 0, hi: 0, lo: 0, rolls: [0], priority: 0, name: null };
    for (const m of foe.moves) {
      const d = this.damage(foe, target, m, this.field(view, view.foe));
      if (d && d.avg > best.avg) best = { ...d, name: m };
    }
    this.memo?.set(key, best);
    return best;
  }

  /** The knockout race between one of ours and the foe: their hits needed minus ours, ±½ for who acts first. */
  matchup(ours, foe, view, threat) {
    const t = threat || this.threat(foe, ours, view);
    let best = null;
    for (const m of ours.moves) {
      const d = this.damage(ours, foe, m, this.field(view, view.side));
      if (d && usable(d.move, ours, foe, t) && (!best || d.avg * d.acc > best.avg * best.acc)) best = d;
    }
    const ourHits = best && best.avg > 0 ? Math.ceil(foe.hp / best.avg) : 9;
    const theirHits = t.avg > 0 ? Math.ceil(ours.hp / t.avg) : 9;
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
    this.memo = new Map();
    if (options.length === 1) return this.pack(options[0], options.map((o) => ({ ...o, value: 0, why: 'the only option' })), rng);
    const side = request.side.pokemon;
    const foe = this.foeMon(view);
    const forced = !!request.forceSwitch;
    const activeEntry = side.find((p) => p.active);
    const me = !forced && activeEntry ? this.ownMon(activeEntry, view, true) : null;
    if (me) this.learnSpeed(view, me);
    const f2 = this.foeMon(view);   // again, with anything just learned about its Speed
    const scored = options.map((o) => ({ ...o, ...this.value(o, { me, foe: f2 || foe, side, view, forced, request }) }));
    return this.pack(this.choose(scored, rng), scored, rng);
  }

  value(o, ctx) {
    const { me, foe, view, forced } = ctx;
    if (o.kind === 'pass') return { value: 0, why: 'pass' };
    if (!foe) return { value: o.kind === 'move' ? 1 : 0, why: 'no foe in view' };
    if (o.kind === 'switch') return forced ? this.sendIn(o, ctx) : this.switchOut(o, ctx);
    return this.moveValue(o, ctx);
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
      (hz ? `, hazards ${Math.round(hz * 100)}%` : '') + (t.isAce ? ', the ace' : '') };
  }

  switchOut(o, { me, foe, side, view }) {
    const entry = side[o.slot];
    const t = this.ownMon(entry, view, false);
    const threatMe = this.threat(foe, me, view);
    const now = this.matchup(me, foe, view, threatMe);
    // the foe aims at the Pokémon in front of it: the incoming Pokémon takes that move
    const aimed = threatMe.name ? this.damage(foe, t, threatMe.name, this.field(view, view.foe)) : null;
    const incoming = (aimed?.avg || 0) + this.hazardCost(entry, view);
    const after = { ...t, hp: Math.max(0.01, t.hp - incoming) };
    const then = this.matchup(after, foe, view);
    const alive = side.filter((p) => !p.condition.endsWith(' fnt')).length;
    const { def } = this.weights();
    const gain = (clip(then.margin, -3, 3) - clip(now.margin, -3, 3)) * 14;
    const penalty = 8 + 22 * (1 - this.p.switching / 100) + (this.lastChoice?.startsWith('switch') ? 10 : 0);
    const keepMe = me.isAce && now.margin < 0 ? this.p.preservation / 5 : 0;
    const value = gain - incoming * 100 * def * this.monWeight(t, alive) * 0.6 - penalty + keepMe;
    return { value, why: `matchup ${now.margin} → ${then.margin} for ${t.name}, takes ~${Math.round(incoming * 100)}% coming in` };
  }

  moveValue(o, { me, foe, side, view, request }) {
    const { off, def } = this.weights();
    const alive = side.filter((p) => !p.condition.endsWith(' fnt')).length;
    const myW = this.monWeight(me, alive);
    const moveName = this.moveName(o, me);
    const m = dex.moves.get(moveName);
    const threat = this.threat(foe, me, view);
    const foeFirstVs = (prio) => threat.priority > prio || (threat.priority === prio && foe.spe >= me.spe);
    const takenAvg = Math.min(threat.avg, me.hp);
    const pFaint = threat.rolls.filter((d) => d >= me.hp).length / threat.rolls.length;

    if (m.category !== 'Status') {
      const d = this.damage(me, foe, moveName, this.field(view, view.side));
      if (!d || d.hi === 0) return { value: -40, why: `${moveName} does nothing to ${foe.species}` };
      const first = !foeFirstVs(d.priority);
      const pKO = (d.rolls.filter((x) => x >= foe.hp).length / d.rolls.length) * d.acc;
      let lands = first ? 1 : 1 - pFaint;
      const works = usable(m, me, foe, threat);   // e.g. Focus Punch fails if the user is hit first
      if (!works) lands = 0;
      const dealt = Math.min(d.avg, foe.hp) * d.acc * lands;
      const taken = takenAvg * (first ? 1 - pKO : 1);
      let value = off * dealt * 100 + KO_BONUS * pKO * lands - def * taken * 100 * myW;
      value -= (1 - d.acc) * 30 * (1 - this.p.risk / 100);
      const reasons = [`~${Math.round(dealt * 100)}% to ${foe.species}`];
      if (pKO > 0) reasons.push(`KO ${Math.round(pKO * 100)}%`);
      if (!works) reasons.push(m.id === 'focuspunch' ? 'fails if hit first' : 'would fail now');
      if (!first) reasons.push(`moves second${pFaint > 0 ? `, ${Math.round(pFaint * 100)}% chance it's KO'd first` : ''}`);
      if (m.recoil) value -= dealt * (m.recoil[0] / m.recoil[1]) * 100 * def * myW;
      if (m.selfdestruct === 'always') { value -= me.hp * 100 * myW * (alive > 1 ? 1 : 3); reasons.push('faints'); }
      if (m.self?.boosts && Object.values(m.self.boosts).some((x) => x < 0)) value -= 4;
      if (m.selfSwitch && alive > 1) { value += 6; reasons.push('pivots'); }
      if (m.id === 'rapidspin') {
        const cond = view.conditions[view.side] || {};
        const layers = (cond.stealthrock ? 1 : 0) + (cond.spikes || 0) + (cond.toxicspikes || 0);
        value += layers * 6 * (alive - 1);
        if (layers) reasons.push('clears hazards');
      }
      return { value, why: reasons.join(', ') };
    }
    return this.statusValue(m, { me, foe, view, threat, takenAvg, def, myW, alive, request });
  }

  statusValue(m, { me, foe, view, threat, takenAvg, def, myW, alive }) {
    const taken = def * takenAvg * 100 * myW;
    const foeLeft = view.teamSize[view.foe] - [...view.mons[view.foe].values()].filter((x) => x.fainted).length;
    const acc = m.accuracy === true ? 1 : m.accuracy / 100;
    // setup: only if the boost shortens the knockout race (or wins the Speed race) and it lives to use it
    if (m.boosts && m.target === 'self') {
      const after = { ...me, boosts: { ...me.boosts } };
      for (const [k, v] of Object.entries(m.boosts)) after.boosts[k] = clip((after.boosts[k] || 0) + v, -6, 6);
      if (Object.keys(m.boosts).every((k) => (me.boosts[k] || 0) >= 4)) return { value: -30, why: 'already boosted' };
      after.mon = new Pokemon(gen, me.build.species, { level: me.build.level, nature: me.build.nature, evs: me.build.evs, ivs: me.build.ivs,
        ability: me.build.ability, item: me.item || undefined, boosts: after.boosts, status: me.status, curHP: me.mon.curHP() });
      after.spe = me.spe * stageMult(after.boosts.spe || 0) / stageMult(me.boosts.spe || 0);
      const now = this.matchup(me, foe, view, threat), then = this.matchup(after, foe, view);
      const survives = me.hp - threat.avg > threat.hi;
      const gain = (now.ourHits - then.ourHits) + (!now.first && then.first ? 1 : 0) + (then.theirHits - now.theirHits);
      // boosts last: what they're worth against the foes still to come, more the less this one can hurt it
      const cats = new Set(me.moves.map((n) => dex.moves.get(n).category));
      const useful = Object.entries(m.boosts).filter(([k]) => k === 'spe' || (k === 'atk' && cats.has('Physical')) ||
        (k === 'spa' && cats.has('Special'))).reduce((t, [k, v]) => t + Math.max(0, Math.min(v, 6 - (me.boosts[k] || 0))), 0);
      const sweep = Math.max(0, foeLeft - 1) * 8 * useful * Math.max(0, 1 - 2 * threat.avg);
      let value = survives ? (gain * 22 + sweep) * (0.5 + this.p.patience / 100) - taken : -20 - taken;
      if ((1 - me.hp) * 100 > this.p.patience) value -= 25;
      if (threat.hi < 0.15) value += 15;
      if (view.turn <= 1) value += this.p.setup_first / 10;
      return { value, why: `${m.name}: race ${now.margin} → ${then.margin}${survives ? `, +${Math.round(sweep)} for the ${Math.max(0, foeLeft - 1)} still to come` : ", but it won't survive to use it"}` };
    }
    // recovery
    const heal = m.heal ? m.heal[0] / m.heal[1] : HEALS[m.id];
    if (heal) {
      const healed = Math.min(heal, 1 - me.hp);
      if (me.hp > 0.85) return { value: -15, why: 'barely hurt' };
      let value = healed * 100 * def * myW - taken;
      if (threat.avg >= healed) value -= 25;   // it can't outpace the damage
      if (me.hp * 100 <= this.p.heal_line) value += 15;
      if (m.id === 'rest') value -= 2 * threat.avg * 100 * 0.5 + (healed < 0.5 ? 20 : 0);
      return { value, why: `${m.name}: heals ~${Math.round(healed * 100)}%, takes ~${Math.round(takenAvg * 100)}%` };
    }
    // a major status condition
    if (m.status) {
      if (foe.status) return { value: -35, why: `${foe.species} already has a status` };
      const immune = (m.status === 'tox' || m.status === 'psn') ? foe.types.some((t) => t === 'Poison' || t === 'Steel')
        : m.status === 'brn' ? foe.types.includes('Fire')
          : m.id === 'thunderwave' ? !dex.getImmunity('Electric', foe.types) : false;
      if (immune) return { value: -40, why: `${foe.species} can't get ${m.status}` };
      const mine = this.matchup(me, foe, view, threat);
      let base = STATUS_VALUE[m.status] || 10;
      if (m.status === 'brn' && foe.mon.species.baseStats.atk > foe.mon.species.baseStats.spa) base *= 1.5;
      if (m.status === 'par' && foe.spe > me.spe) base *= 1.3;
      const value = base * (0.5 + this.p.harassment / 100) * foe.hp * (mine.ourHits >= 3 ? 1 : 0.5) * acc - taken;
      return { value, why: `${m.name} on a ${Math.round(foe.hp * 100)}% ${foe.species}` };
    }
    // entry hazards
    const cond = view.conditions[view.foe] || {};
    // per foe Pokémon still to come, each expected to come in about 1.5 times over a battle
    const layers = { stealthrock: [1, [14]], spikes: [3, [9, 6, 5]], toxicspikes: [2, [7, 4]] }[m.id];
    if (layers) {
      const have = cond[m.id] || 0;
      if (have >= layers[0] || foeLeft <= 1) return { value: -25, why: have >= layers[0] ? 'already up' : 'nothing left to hurt' };
      const value = layers[1][have] * (foeLeft - 1) - taken;
      return { value, why: `${m.name}: ${foeLeft - 1} of theirs still to come in` };
    }
    if (m.id === 'reflect' || m.id === 'lightscreen') {
      const cat = threat.name ? dex.moves.get(threat.name).category : null;
      const mineCond = view.conditions[view.side] || {};
      const fits = (m.id === 'reflect' && cat === 'Physical') || (m.id === 'lightscreen' && cat === 'Special');
      return { value: !mineCond[m.id] && fits ? 12 - taken * 0.5 : -15, why: m.name };
    }
    if (m.id === 'healbell' || m.id === 'aromatherapy') {
      const sick = [...view.mons[view.side].values()].filter((x) => x.status && !x.fainted).length;
      return { value: sick * 15 - taken, why: `${sick} of ours with a status` };
    }
    if (m.id === 'roar' || m.id === 'whirlwind' || m.id === 'haze') {
      const up = Object.values(foe.boosts).filter((x) => x > 0).reduce((t, x) => t + x, 0);
      const hz = (view.conditions[view.foe]?.stealthrock ? 1 : 0) + (view.conditions[view.foe]?.spikes || 0);
      return { value: up * 12 + (m.id !== 'haze' ? hz * 5 : 0) - taken - (up ? 0 : 10), why: `${m.name} against +${up}` };
    }
    if (m.id === 'substitute') return { value: me.hp > 0.5 && threat.avg < 0.25 ? 12 : -15, why: 'Substitute' };
    if (m.id === 'protect' || m.id === 'detect') return { value: this.lastChoice === `move:${m.id}` ? -40 : 3, why: m.name };
    if (m.id === 'leechseed') return { value: foe.types.includes('Grass') ? -40 : 14 * foe.hp - taken, why: 'Leech Seed' };
    if (m.volatileStatus === 'confusion') return { value: 8 * foe.hp - taken, why: m.name };
    return { value: -12 - taken, why: `${m.name} (no plan for it)` };
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
      scores: scored.map((s) => Math.round((s.value ?? 0) * 10) / 10),
      why: order.slice(0, 3).map((s) => `${s.label}: ${Math.round((s.value ?? 0) * 10) / 10} (${s.why})`),
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
