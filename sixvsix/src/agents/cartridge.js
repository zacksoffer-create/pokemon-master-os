// The games' own trainer AI (Gen 4: Platinum, HeartGold, SoulSilver), for Historical mode: a game trainer as the
// cartridge plays it, not as a skilled trainer would (the trainer agent). Ported from Blackthorn's one-on-one engine
// (engine/battle/trainer_policy.py) and the rules it reads (engine/battle/trainer_ai.json), which cite the pret
// disassemblies line by line (pokeplatinum src/battle/trainer_ai; pokeheartgold overlay_10_trainer_ai.s).
//
// Every move starts at 100 and each AI flag nudges it; the highest score is used (ties broken at random, as the game
// does). Before moving, the game's switch checks run in their order (Gen 4 ShouldSwitch); after a faint, the
// replacement is the bench Pokémon with the best super-effective type matchup, else the one that would do the most
// damage.
//
// Many nudges are dice rolls in the game (a 4× hit's +2 is 69%, CHECK_HP's -2 is 80%, RISKY's +2 is 50%...). With
// `dice` on (the default) they're rolled at the game's odds from the policy seed; with `dice: false` a nudge counts
// when it happens more often than not and coin flips are left out, which is the one-on-one engine's rule, so the two
// engines then agree move for move.
//
// What the cartridge AI knows is what the cartridge reads: the real stats, HP, ability and item of the Pokémon in
// front of it (it computes damage from the battle's own numbers), the move that last hit it, and nothing about the
// rest of the opposing team. So this agent's information is 'cartridge', given to it by the battle runner, and every
// decision says so. Not modelled: bag items (Showdown has no item action), AI_FLAG_BATON_PASS and AI_FLAG_WEATHER's
// first-turn quirk (its net effect is a weather move whose weather is already up loses out, which BASIC covers).

import { Dex } from '@pkmn/sim';
import { TrainerAgent } from './trainer.js';
import { legalOptions } from './legal.js';
import { toID } from '../util.js';

const dex = Dex.forGen(4);
const EXTREMES = new Set(['Explosion', 'Self-Destruct', 'Dream Eater', 'Focus Punch', 'Sucker Punch', 'Superpower', 'Eruption',
  'Water Spout', 'Spit Up', 'Head Smash', 'Double-Edge']);
const FLAILS = new Set(['Flail', 'Reversal']);
const ENDURES = new Set(['Endure', 'Destiny Bond', 'Memento']);
const SETUP_KINDS = new Set(['boost', 'debuff', 'screen', 'protect-sub', 'status', 'weather']);
const RISKY_MOVES = new Set(['Explosion', 'Self-Destruct', 'Sheer Cold', 'Fissure', 'Guillotine', 'Horn Drill', 'Metronome',
  'Counter', 'Mirror Coat', 'Metal Burst', 'Destiny Bond', 'Swagger', 'Attract', 'Belly Drum', 'Focus Punch', 'Sucker Punch',
  'Confuse Ray', 'Supersonic', 'Sweet Kiss', 'Teeter Dance', 'Flatter']);
const HARASS_MOVES = new Set(['Leech Seed', 'Encore', 'Spite', 'Spikes', 'Toxic Spikes', 'Attract', 'Torment', 'Embargo',
  'Knock Off', 'Captivate', 'Confuse Ray', 'Supersonic', 'Swagger', 'Flatter', 'Sweet Kiss', 'Teeter Dance']);
const STATUS_OF = { slp: 'sleep', par: 'paralysis', brn: 'burn', psn: 'poison', tox: 'toxic', frz: 'freeze' };
const SAFE_TYPES = { poison: ['Poison', 'Steel'], toxic: ['Poison', 'Steel'], burn: ['Fire'], freeze: ['Ice'] };
const SAFE_ABILITIES = { poison: ['Immunity'], toxic: ['Immunity'], paralysis: ['Limber'], sleep: ['Insomnia', 'Vital Spirit'],
  burn: ['Water Veil'], freeze: ['Magma Armor'] };
const WEATHER_OF = { raindance: 'RainDance', sunnyday: 'SunnyDay', sandstorm: 'Sandstorm', hail: 'Hail' };
const ABSORBS = { Fire: ['Flash Fire'], Water: ['Water Absorb', 'Dry Skin'], Electric: ['Volt Absorb', 'Motor Drive'] };
const flagsOf = (list) => new Set((list || []).map((f) => String(f).toUpperCase().replace(/^AI_FLAG_|^AI_SCRIPT_|^AI_/, '')));
const nameOf = (ident) => ident.slice(ident.indexOf(':') + 1).trim();

/** What a move is for, in the one-on-one engine's terms (battle/evaluate.py kind()). */
export function kindOf(m, types = []) {
  if (m.category !== 'Status') return 'hit';
  if (['protect', 'detect', 'endure'].includes(m.id)) return 'protect';
  if (m.id === 'substitute') return 'protect-sub';
  if (m.id === 'reflect' || m.id === 'lightscreen') return 'screen';
  if (WEATHER_OF[m.id]) return 'weather';
  if (m.id === 'curse') return types.includes('Ghost') ? 'utility' : 'boost';
  if (m.boosts && m.target === 'self' && Object.values(m.boosts).some((v) => v > 0)) return 'boost';
  if (m.flags?.heal || m.id === 'rest' || m.id === 'wish') return 'heal';
  if (['refresh', 'healbell', 'aromatherapy'].includes(m.id)) return 'cure';
  if (m.id === 'taunt') return 'taunt';
  if (m.id === 'encore') return 'encore';
  if (m.id === 'sleeptalk') return 'sleep-talk';
  if (m.id === 'roar' || m.id === 'whirlwind') return 'phaze';
  if (m.id === 'haze') return 'haze';
  if (m.status || m.id === 'leechseed' || m.id === 'yawn') return 'status';
  if (m.boosts && m.target !== 'self' && Object.values(m.boosts).some((v) => v < 0)) return 'debuff';
  return 'utility';
}

export class CartridgeAgent extends TrainerAgent {
  constructor(params = {}, context = {}) {
    super({ competence: 100 }, context);
    this.name = 'game';
    this.information = 'cartridge';
    this.flags = flagsOf(params.flags);
    this.dice = params.dice !== false;
  }

  /** A nudge the game rolls for: at its odds with dice, else only when it happens more often than not. */
  rolls(rng, p) {
    return this.dice ? rng.next() < p : p > 0.5;
  }

  /** The Pokémon in front of the AI, as the cartridge reads it (its real numbers, given by the battle runner). */
  target(extra) {
    const t = extra?.foe;
    if (!t) return null;
    return { side: 'them', name: t.name, species: t.species, level: t.level, nature: t.nature, evs: t.evs, ivs: t.ivs,
             ability: t.ability, item: t.item || '', boosts: { ...t.boosts }, status: t.status || '', hp: t.hp, maxhp: t.maxhp,
             spe: t.spe, types: t.types, volatiles: { ...(t.volatiles || {}) }, sleep: null, moves: t.moves, lastMove: t.lastMove };
  }

  hi(u, t, name, view) {
    const d = this.damage(u, t, name, this.field(view, view.side));
    return d ? d.hi : 0;
  }

  effectiveness(type, t) {
    if (!dex.getImmunity(type, t.types)) return 0;
    return 2 ** dex.getEffectiveness(type, t.types);
  }

  /** BASIC / CHECK_BAD_MOVE: would this move fail or do nothing right now? (trainer_policy.useless) */
  useless(u, t, m, kind, view, side) {
    if (kind === 'hit') {
      if (m.id === 'dreameater' && t.status !== 'slp') return true;
      return this.hi(u, t, m.name, view) <= 0;
    }
    if (kind === 'status') {
      if (t.volatiles.substitute && !m.flags?.bypasssub) return true;
      if (m.id === 'leechseed') return !!t.volatiles.leechseed || t.types.includes('Grass');
      if (m.id === 'yawn') return !!t.status || !!t.volatiles.yawn;
      if (t.status) return true;
      const ail = STATUS_OF[m.status] || '';
      if (t.types.some((x) => (SAFE_TYPES[ail] || []).includes(x)) || (SAFE_ABILITIES[ail] || []).includes(t.ability)) return true;
      if (m.id === 'thunderwave') return !dex.getImmunity('Electric', t.types) || ['Volt Absorb', 'Motor Drive'].includes(t.ability);
      return false;
    }
    if (kind === 'boost') {
      const up = m.id === 'curse' ? { atk: 1, def: 1 } : Object.fromEntries(Object.entries(m.boosts || {}).filter(([, v]) => v > 0));
      return !Object.keys(up).some((s) => (u.boosts[s] || 0) < 6);
    }
    if (kind === 'debuff') return !!t.volatiles.substitute || !Object.keys(m.boosts || {}).some((s) => (t.boosts[s] || 0) > -6);
    if (kind === 'protect-sub') return !!u.volatiles.substitute || u.hp <= 0.25;
    if (kind === 'screen') return !!(view.conditions[view.side] || {})[m.id];
    if (kind === 'weather') return view.weather === WEATHER_OF[m.id];
    if (kind === 'heal') return u.hp >= 1 && m.id !== 'wish';
    if (kind === 'taunt') return !!t.volatiles.taunt;
    if (kind === 'sleep-talk') return u.status !== 'slp';
    if (kind === 'cure') return m.id === 'refresh' ? !u.status : !side.some((p) => / (slp|par|brn|psn|tox|frz)$/.test(p.condition));
    const hz = (view.conditions[view.foe] || {});
    if (m.id === 'spikes') return (hz.spikes || 0) >= 3;
    if (m.id === 'toxicspikes') return (hz.toxicspikes || 0) >= 2;
    if (m.id === 'stealthrock') return !!hz.stealthrock;
    return false;
  }

  /** Every usable move's score under the game's AI flags, with the nudges that made it. */
  scores(u, t, moves, view, side, rng) {
    const fl = this.flags;
    const hi = new Map();
    for (const m of moves) if (m.category !== 'Status') hi.set(m.id, this.hi(u, t, m.name, view));
    const strongest = Math.max(0, ...hi.values());
    const first = view.turn <= 1;
    const faster = u.spe >= t.spe;
    const out = [];
    for (const m of moves) {
      const kind = kindOf(m, u.types);
      const selfko = m.selfdestruct === 'always';
      let s = 100;
      const why = [];
      const nudge = (d, reason) => { s += d; why.push(`${d > 0 ? '+' : ''}${d} ${reason}`); };
      if ((fl.has('BASIC') || fl.has('CHECK_BAD_MOVE')) && this.useless(u, t, m, kind, view, side)) nudge(-10, 'would fail or do nothing (BASIC)');
      if ((fl.has('EVAL_ATTACK') || fl.has('TRY_TO_FAINT')) && kind === 'hit' && hi.get(m.id) > 0) {
        const h = hi.get(m.id);
        if (h >= t.hp) nudge(m.priority > 0 ? 6 : 4, `knocks out on its best roll${m.priority > 0 ? ', first' : ''} (EVAL_ATTACK)`);
        else if (h < strongest) nudge(-1, 'not its strongest (EVAL_ATTACK)');
        if (this.effectiveness(m.type, t) >= 4 && this.rolls(rng, 0.69)) nudge(2, '4× effective (EVAL_ATTACK, 69%)');
        if (selfko || m.id === 'focuspunch' || m.id === 'suckerpunch') nudge(-2, 'a gamble it marks down (EVAL_ATTACK)');
      }
      if (fl.has('EXPERT') || fl.has('CHECK_VIABILITY')) {
        if (kind === 'heal') {
          if (u.hp >= 1) nudge(-3, 'heal at full HP (EXPERT)');
          else if (faster) nudge(-8, 'heal while faster, as the code is written (EXPERT)');
          else if (u.hp >= 0.7) nudge(-3, 'heal at 70% or more (EXPERT)');
          else nudge(2, 'heal under 70% (EXPERT)');
        }
        if (kind === 'boost') {
          const raised = m.id === 'curse' ? ['atk', 'def'] : Object.entries(m.boosts || {}).filter(([, v]) => v > 0).map(([k]) => k);
          if (raised.some((k) => (u.boosts[k] || 0) >= 3)) nudge(-1, 'already +3 (EXPERT)');
          if (u.hp <= 0.7) nudge(-2, 'setting up at 70% HP or less (EXPERT)');
          else if (u.hp >= 1 && this.dice && rng.next() < 0.5) nudge(2, 'setting up at full HP (EXPERT, 50%)');
        }
        if ((m.id === 'toxic' || m.id === 'leechseed') && hi.size) {
          if (u.hp <= 0.5) nudge(-3, 'Toxic or Leech Seed at half HP or less (EXPERT)');
          if (t.hp <= 0.5) nudge(-3, 'Toxic or Leech Seed on a target at half or less (EXPERT)');
        }
      }
      if (fl.has('SETUP_FIRST_TURN') && first && SETUP_KINDS.has(kind) && this.rolls(rng, 0.69)) nudge(2, 'first turn of the battle (SETUP_FIRST_TURN, 69%)');
      if (fl.has('CHECK_HP') || fl.has('HP_AWARE')) {
        const p = 0.8;
        if (u.hp > 0.7 && (selfko || kind === 'heal' || FLAILS.has(m.name) || ENDURES.has(m.name))) { if (this.rolls(rng, p)) nudge(-2, 'too healthy for it (CHECK_HP, 80%)'); }
        else if (u.hp <= 0.7 && (kind === 'boost' || kind === 'debuff')) { if (this.rolls(rng, p)) nudge(-2, 'too hurt to set up (CHECK_HP, 80%)'); }
        if (t.hp <= 0.3 && ['status', 'boost', 'debuff'].includes(kind) && this.rolls(rng, p)) nudge(-2, 'the target is nearly down (CHECK_HP, 80%)');
      }
      if (['PRIORITIZE_EXTREMES', 'PREFER_POWER_EXTREMES', 'PREFER_STRONGEST_MOVE'].some((f) => fl.has(f))) {
        const extreme = kind !== 'hit' || EXTREMES.has(m.name) || m.flags?.charge || m.flags?.recharge || m.self?.volatileStatus === 'mustrecharge';
        if (extreme && this.rolls(rng, 0.61)) nudge(2, 'a move it doesn\'t compare (PRIORITIZE_EXTREMES, 61%)');
      }
      if (fl.has('RISKY') && (RISKY_MOVES.has(m.name) || m.status === 'slp' || m.ohko || m.critRatio > 1) && this.rolls(rng, 0.5)) nudge(2, 'a gamble (RISKY, 50%)');
      if (fl.has('HARRASSMENT') && (HARASS_MOVES.has(m.name) || (m.status && kind === 'status') ||
          (m.boosts && m.target !== 'self' && Object.values(m.boosts).some((v) => v < 0))) && this.rolls(rng, 0.5)) nudge(2, 'harassment (HARRASSMENT, 50%)');
      out.push({ move: m, kind, score: s, why });
    }
    return out;
  }

  /** The bench Pokémon the game sends in: best super-effective type matchup, else the most damage. */
  replacement(options, side, t, view) {
    const cands = options.filter((o) => o.kind === 'switch').map((o) => ({ o, mon: this.ownMon(side[o.slot], view, false) }));
    if (!cands.length || !t) return null;
    const best = (mon) => Math.max(0, ...mon.moves.map((n) => dex.moves.get(n)).filter((m) => m.category !== 'Status')
      .map((m) => this.effectiveness(m.type, t)));
    const withSE = cands.filter((c) => best(c.mon) >= 2);
    if (withSE.length) return { pick: withSE.reduce((a, b) => (best(b.mon) > best(a.mon) ? b : a)), why: 'the best super-effective matchup' };
    const dmg = (mon) => Math.max(0, ...mon.moves.map((n) => this.hi(mon, t, n, view)));
    return { pick: cands.reduce((a, b) => (dmg(b.mon) > dmg(a.mon) ? b : a)), why: 'the most damage (none hits it super-effectively)' };
  }

  /** Gen 4's switch checks in their order (trainer_ai.json switching.4). Returns {o, why} or null to stay in. */
  shouldSwitch(options, side, u, t, view, rng, request) {
    const switches = options.filter((o) => o.kind === 'switch');
    if (!switches.length || request.active?.[0]?.trapped || u.volatiles.ingrain) return null;
    const bench = switches.map((o) => ({ o, mon: this.ownMon(side[o.slot], view, false) }));
    const damaging = (mon) => mon.moves.map((n) => dex.moves.get(n)).filter((m) => m.category !== 'Status');
    const seMoves = (mon) => damaging(mon).filter((m) => this.effectiveness(m.type, t) >= 2);
    const perMove = (cands, p) => {
      for (const c of cands) for (let k = 0; k < c.n; k++) if (this.rolls(rng, p)) return c;
      return null;
    };
    if (u.volatiles.perish === 1) {
      const r = this.replacement(options, side, t, view);
      return r && { o: r.pick.o, why: `Perish Song is about to finish (switch check 1); sends ${r.why}` };
    }
    if (t.ability === 'Wonder Guard' && !seMoves(u).length) {
      const c = perMove(bench.map((b) => ({ ...b, n: seMoves(b.mon).length })).filter((b) => b.n), 2 / 3);
      if (c) return { o: c.o, why: 'nothing it has gets past Wonder Guard (switch check 2, 2/3 per move)' };
    }
    const mine = damaging(u);
    if (mine.length >= 2 && mine.every((m) => this.effectiveness(m.type, t) === 0 || this.hi(u, t, m.name, view) <= 0)) {
      const c = perMove(bench.map((b) => ({ ...b, n: seMoves(b.mon).length })).filter((b) => b.n), 2 / 3) ||
        perMove(bench.map((b) => ({ ...b, n: damaging(b.mon).filter((m) => this.effectiveness(m.type, t) === 1).length })).filter((b) => b.n), 1 / 2);
      if (c) return { o: c.o, why: 'none of its attacks can touch you (switch check 3)' };
    }
    const last = t.lastMove ? dex.moves.get(t.lastMove) : null;
    if (last?.exists && last.category !== 'Status' && ABSORBS[last.type]) {
      const c = bench.find((b) => ABSORBS[last.type].includes(b.mon.ability));
      if (c && this.rolls(rng, 0.5)) return { o: c.o, why: `${c.mon.name}'s ${c.mon.ability} takes ${last.type} moves (switch check 4, 50%)` };
    }
    if (u.status === 'slp' && u.ability === 'Natural Cure' && u.hp >= 0.5 && this.rolls(rng, 0.5)) {
      const r = this.replacement(options, side, t, view);
      if (r) return { o: r.pick.o, why: 'asleep with Natural Cure (switch check 5)' };
    }
    const se = seMoves(u).length;
    const boosts = Object.values(u.boosts).filter((v) => v > 0).reduce((a, b) => a + b, 0);
    for (let k = 0; k < se; k++) if (this.rolls(rng, 0.9)) return null;   // it stays in with a super-effective move (90% per move)
    if (boosts >= 4) return null;
    if (last?.exists && last.category !== 'Status') {
      const immune = bench.filter((b) => !dex.getImmunity(last.type, b.mon.types)).map((b) => ({ ...b, n: seMoves(b.mon).length })).filter((b) => b.n);
      const c6 = perMove(immune, 1 / 2);
      if (c6) return { o: c6.o, why: `${c6.mon.name} is immune to ${last.name} and hits back super-effectively (switch check 6)` };
      const resist = bench.filter((b) => dex.getImmunity(last.type, b.mon.types) && dex.getEffectiveness(last.type, b.mon.types) < 0)
        .map((b) => ({ ...b, n: seMoves(b.mon).length })).filter((b) => b.n);
      const c7 = perMove(resist, 1 / 3);
      if (c7) return { o: c7.o, why: `${c7.mon.name} resists ${last.name} and hits back super-effectively (switch check 7)` };
    }
    return null;
  }

  decide(request, view, rng, extra) {
    const options = legalOptions(request);
    if (!options.length) return null;
    const note = 'the cartridge AI: it reads the real stats, HP, ability and item of the Pokémon in front of it';
    const done = (pick, scored, why) => ({ ...this.pack(pick, scored, rng), why, assumed: { information: note } });
    if (options.length === 1) return done(options[0], [{ ...options[0], value: 0, why: 'the only option' }], ['the only option']);
    const side = request.side.pokemon;
    const t = this.target(extra);
    if (request.forceSwitch) {
      const r = this.replacement(options, side, t, view);
      const pick = r ? r.pick.o : options[0];
      return done(pick, options.map((o) => ({ ...o, value: o === pick ? 1 : 0, why: o === pick ? (r?.why || 'first in line') : '' })),
        [`${pick.label}: ${r?.why || 'first in line'}`]);
    }
    const u = this.ownMon(side.find((p) => p.active), view, true);
    if (!t) return done(options[0], [{ ...options[0], value: 0, why: 'nothing in front of it' }], ['nothing in front of it']);
    const sw = this.shouldSwitch(options, side, u, t, view, rng, request);
    if (sw) return done(sw.o, options.map((o) => ({ ...o, value: o === sw.o ? 1 : 0, why: o === sw.o ? sw.why : '' })), [`${sw.o.label}: ${sw.why}`]);
    const moveOpts = options.filter((o) => o.kind === 'move');
    const moves = moveOpts.map((o) => dex.moves.get(this.moveName(o, u)));
    const sc = this.scores(u, t, moves, view, side, rng);
    const top = Math.max(...sc.map((x) => x.score));
    const tied = sc.map((x, k) => ({ ...x, o: moveOpts[k] })).filter((x) => x.score === top);
    let pick;
    if (tied.length > 1 && this.dice) pick = tied[Math.floor(rng.next() * tied.length)];
    else {
      // without dice: among tied attacks, the one with the fewest expected turns (the one-on-one engine's tie-break)
      const exp = (x) => (x.kind === 'hit' ? (this.damage(u, t, x.move.name, this.field(view, view.side))?.avg || 0) * this.hitChance(u, t, x.move, view) : -1);
      pick = tied.reduce((a, b) => (exp(b) > exp(a) ? b : a));
    }
    const scored = moveOpts.map((o, k) => ({ ...o, value: sc[k].score, why: sc[k].why.join(', ') || 'no nudges' }))
      .concat(options.filter((o) => o.kind !== 'move').map((o) => ({ ...o, value: 0, why: 'the switch checks said stay in' })));
    const order = [...sc].sort((a, b) => b.score - a.score);
    const why = order.slice(0, 3).map((x) => `${x.move.name}: ${x.score} (${x.why.join(', ') || 'no nudges'})`);
    if (tied.length > 1) why.push(this.dice ? `${tied.length} tied at ${top}: the game picks at random` : `${tied.length} tied: the engine's tie-break`);
    return done(pick.o, scored, why);
  }
}
