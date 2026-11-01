/* Option Arcade: the simulation. One option play at a time: the formation, the mesh, defenders who
   each make their own read, blocks that hold or get shed, the ball carrier you steer, and contact.
   Units are yards and seconds. x runs downfield from the line of scrimmage, y runs across the field
   (+y is the offense's right, the bottom of the screen). No DOM: the page draws a play and feeds it
   input; node tests run plays headless.

   Input each step: { hold, steer: {x, y} | null, juke: -1 | 0 | 1, truck, pitch, give, snap }.
   hold is the GIVE pad held down. juke, truck, pitch, give and snap fire once. */
const FB = (() => {
  const SIDE = 26.65, HASH = 8.9, GRAV = 10.7, TAU = Math.PI * 2, DT = 1 / 120;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());

  // ------------------------------------------------------------------ players
  // spd yd/s, acc yd/s², agi 0-1 (cuts and turns), str, mass (hundreds of lb), blk, tck (tackling), hands
  const KIND = {
    OL: { spd: 5.7, acc: 7.0, agi: 0.40, str: 78, mass: 2.9, blk: 72, tck: 40, hands: 30 },
    QB: { spd: 7.5, acc: 9.5, agi: 0.78, str: 58, mass: 2.1, blk: 30, tck: 30, hands: 80 },
    FB: { spd: 7.1, acc: 9.0, agi: 0.55, str: 84, mass: 2.4, blk: 70, tck: 40, hands: 70 },
    SB: { spd: 8.25, acc: 10.5, agi: 0.92, str: 52, mass: 1.85, blk: 52, tck: 30, hands: 78 },
    RB: { spd: 8.2, acc: 10.0, agi: 0.82, str: 66, mass: 2.05, blk: 50, tck: 30, hands: 74 },
    WR: { spd: 8.8, acc: 10.0, agi: 0.85, str: 48, mass: 1.9, blk: 56, tck: 30, hands: 80 },
    TE: { spd: 6.9, acc: 8.5, agi: 0.50, str: 72, mass: 2.5, blk: 66, tck: 40, hands: 70 },
    DT: { spd: 6.0, acc: 7.5, agi: 0.42, str: 82, mass: 3.0, blk: 0, tck: 70, hands: 30 },
    DE: { spd: 6.9, acc: 8.5, agi: 0.55, str: 74, mass: 2.6, blk: 0, tck: 72, hands: 40 },
    LB: { spd: 7.4, acc: 9.5, agi: 0.66, str: 66, mass: 2.35, blk: 0, tck: 76, hands: 50 },
    CB: { spd: 8.5, acc: 10.5, agi: 0.86, str: 48, mass: 1.9, blk: 0, tck: 60, hands: 70 },
    S: { spd: 8.2, acc: 10.0, agi: 0.76, str: 56, mass: 2.0, blk: 0, tck: 70, hands: 60 },
  };
  const CARRIERS = { QB: 1, FB: 1, SB: 1, RB: 1 };

  // the flexbone triple option, or the shotgun read option (the read option's backs and tight end flip with the side)
  const OLINE = [['LT', -2.6], ['LG', -1.3], ['C', 0], ['RG', 1.3], ['RT', 2.6]];
  function offense(play, s) {
    const out = OLINE.map(([id, y]) => [id, 'OL', -0.6, y]);
    if (play === 'triple') out.push(['QB', 'QB', -0.95, 0], ['FB', 'FB', -4.6, 0], ['SL', 'SB', -1.7, -3.9], ['SR', 'SB', -1.7, 3.9], ['WL', 'WR', -0.5, -13], ['WR', 'WR', -0.5, 13]);
    else out.push(['QB', 'QB', -4.5, 0], ['RB', 'RB', -4.6, 1.3 * s], ['SLOT', 'WR', -1.1, 7.6 * s], ['TE', 'TE', -0.6, -3.9 * s], ['WL', 'WR', -0.5, -13], ['WR', 'WR', -0.5, 13]);
    return out;
  }
  // a 4-3 with two high safeties, the same both ways: the defense doesn't know which way you're going
  const DEFENSE = [['DTL', 'DT', 0.9, -1.3], ['DTR', 'DT', 0.9, 1.3], ['DEL', 'DE', 0.9, -3.8], ['DER', 'DE', 0.9, 3.8], ['MLB', 'LB', 4.6, 0],
    ['OLBL', 'LB', 3.4, -7], ['OLBR', 'LB', 3.4, 7], ['CBL', 'CB', 6.5, -13], ['CBR', 'CB', 6.5, 13], ['SSL', 'S', 10.5, -6], ['SSR', 'S', 10.5, 6]];

  // ------------------------------------------------------------------ defensive looks
  const LOOKS = [
    ['mixed', 'Mixed'], ['crash', 'End crashes'], ['sit', 'End sits'], ['attack', 'End attacks the QB'],
    ['qb', 'Backer takes the QB'], ['pitch', 'Backer plays the pitch'], ['feather', 'Backer slow-plays'],
    ['scrape', 'Scrape exchange'], ['alley', 'Safety fills the alley']];
  function pickW(r, pairs) { let u = r() * pairs.reduce((a, p) => a + p[1], 0); for (const [k, w] of pairs) if ((u -= w) <= 0) return k; return pairs[0][0]; }
  function resolveLook(name, r, dif) {
    const L = { name: name || 'mixed', de: pickW(r, [['crash', 45], ['sit', 30], ['attack', 25]]), key2: pickW(r, [['qb', 40], ['pitch', 35], ['feather', 25]]), scrape: false, alley: false };
    // a look can combine pieces: 'crash+pitch', 'crash+qb+alley'
    for (let n of String(L.name).split('+')) {
      if (n === 'mixed') { const u = r(); n = u < 0.13 ? 'scrape' : u < 0.25 ? 'alley' : 'mixed'; }
      if (n === 'crash' || n === 'sit' || n === 'attack') L.de = n;
      if (n === 'qb' || n === 'pitch' || n === 'feather') L.key2 = n;
      if (n === 'scrape') { L.scrape = true; L.de = 'crash'; L.key2 = 'pitch'; }
      if (n === 'alley') L.alley = true;
    }
    // a well-coached end sits in his stance a beat longer before he shows you
    L.disguise = r() < clamp((dif - 45) / 90, 0, 0.6) ? 0.1 + r() * 0.1 : 0;
    return L;
  }

  // how fast the clock runs through the exchange: the mesh is slowed so a person can read it
  const EXCH = { slow: 0.42, normal: 0.6, quick: 0.82 };
  // the exchange, in game seconds after the snap: approach, then the ride (ball in the back's belly)
  const MESH = { triple: { pre: 0, approach: 0.42, ride: 0.42, cadence: 0.45 }, read: { pre: 0.26, approach: 0.3, ride: 0.42, cadence: 0.12 } };

  // ------------------------------------------------------------------ setup
  function create(o) {
    o = o || {};
    const seed = (o.seed >>> 0) || ((Math.random() * 4294967295) >>> 0) || 1;
    const r = rng(seed);
    const s = o.side === -1 ? -1 : 1;
    const play = o.play === 'read' ? 'read' : 'triple';
    const dif = clamp(o.difficulty == null ? 50 : +o.difficulty, 0, 100);
    const skill = clamp(o.skill == null ? 55 : +o.skill, 0, 100);
    const P = {
      seed, r, s, play, dif, skill, look: resolveLook(o.look, r, dif), C: MESH[play],
      mesh: o.mesh === 'tap' ? 'tap' : 'hold', slow: EXCH[o.exchange] || EXCH.normal, training: !!o.training,
      toGoal: o.toGoal == null ? 65 : +o.toGoal, toOwn: o.toOwn == null ? 35 : +o.toOwn,
      t: 0, phase: 'pre', cT: 0, snapT: null, scale: 1, rideU: -1,
      players: [], by: {},
      ball: { st: 'held', holder: 'C', x: -0.6, y: 0, z: 0.3 },
      carrier: null, ctrl: null, give: null, wantPull: false, tapAt: null, pullT: null, pitch: null,
      dec: { read1: null, read2: null }, stats: { broken: 0, jukes: 0, jukeMiss: 0, trucks: 0, truckWins: 0 },
      fx: [], log: [], result: null, deadT: 0,
    };
    for (const [id, kind, x, y] of offense(play, s)) add(P, id, kind, 'O', x, y);
    for (const [id, kind, x, y] of DEFENSE) add(P, id, kind, 'D', x, y);
    for (const p of P.players) {
      if (p.team === 'D') { p.spd *= 0.94 + dif * 0.0012; p.acc *= 0.95 + dif * 0.001; p.tck += (dif - 50) * 0.25; }
      else if (CARRIERS[p.kind]) { p.spd *= 0.97 + skill * 0.0006; p.agi = Math.min(1, p.agi * (0.94 + skill * 0.0012)); }
    }
    roles(P);
    return P;
  }
  function add(P, id, kind, team, x, y) {
    const k = KIND[kind];
    const p = { id, kind, team, x, y, x0: x, y0: y, vx: 0, vy: 0, v: 0, h: team === 'O' ? 0 : Math.PI, face: team === 'O' ? 0 : Math.PI,
      spd: k.spd, acc: k.acc, agi: k.agi, str: k.str, mass: k.mass, blk: k.blk, tck: k.tck, hands: k.hands,
      st: 'set', stT: 0, role: null, beh: null, keyOn: null, tgt: null, eng: null, tried: null, know: Infinity, anim: 0, pose: null,
      juke: 0, jukeDir: 0, truck: 0, cd: 0, stumble: 0, shedT: 0.2, armT: 0, retT: 0, commit: null, switchAt: null };
    P.players.push(p); P.by[id] = p;
    return p;
  }
  function roles(P) {
    const s = P.s, K = s > 0 ? 'R' : 'L', B = s > 0 ? 'L' : 'R', by = P.by, L = P.look;
    const set = (id, role, extra) => { const p = by[id]; p.role = role; if (extra) Object.assign(p, extra); };
    for (const p of P.players) if (p.team === 'D') p.role = p.kind === 'DT' || p.kind === 'DE' ? 'line' : p.kind === 'LB' ? 'flow' : 'deep';
    set('DE' + K, 'read1', { beh: L.de });
    set('CB' + K, 'corner');
    if (P.play === 'triple') {
      set('OLB' + K, 'read2', { beh: L.key2 });
      set('MLB', L.scrape ? 'scrape' : 'inside');
      if (L.alley) set('SS' + K, 'alley');
      set(K + 'T', 'block', { tgt: 'MLB' });          // the play-side tackle climbs to the middle backer
      set(K + 'G', 'block', { tgt: 'DT' + K });
      set('C', 'block', { tgt: 'DT' + B });
      set(B + 'G', 'block', { tgt: 'OLB' + B });
      set(B + 'T', 'block', { tgt: 'DE' + B });
      set('S' + K, 'block', { tgt: L.scrape ? 'OLB' + K : 'SS' + K });   // the play-side slot arcs to the alley player
      set('W' + K, 'block', { tgt: 'CB' + K });
      set('W' + B, 'block', { tgt: 'SS' + B });
      set('FB', 'dive'); set('QB', 'qb'); set('S' + B, 'pitch');
    } else {
      // the line zones away from the keep side and leaves the keep-side end alone: he's the read
      set('MLB', 'inside');
      set(B + 'T', 'block', { tgt: 'DE' + B }); set(B + 'G', 'block', { tgt: 'DT' + B }); set('C', 'block', { tgt: 'DT' + K });
      set(K + 'G', 'block', { tgt: 'MLB' }); set(K + 'T', 'block', { tgt: 'OLB' + K });
      set('TE', 'block', { tgt: 'OLB' + B }); set('SLOT', 'block', { tgt: 'SS' + K });
      set('W' + K, 'block', { tgt: 'CB' + K }); set('W' + B, 'block', { tgt: 'CB' + B });
      set('RB', 'dive'); set('QB', 'qb');
    }
  }
  const K_ = P => (P.s > 0 ? 'R' : 'L');
  const meshBack = P => (P.play === 'triple' ? P.by.FB : P.by.RB);
  const pitchMan = P => (P.play === 'triple' ? P.by[P.s > 0 ? 'SL' : 'SR'] : null);
  const read1Of = P => P.by['DE' + K_(P)];
  function key2Of(P) {
    if (P.play !== 'triple') return null;
    const m = P.by.MLB;
    return P.look.scrape && m.y * P.s > 3.2 ? m : P.by['OLB' + K_(P)];
  }

  // ------------------------------------------------------------------ motion
  function steer(p, tx, ty, frac, dt, look) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    const vmax = p.spd * frac * (p.st === 'stagger' ? 0.45 : 1);
    let target = Math.min(vmax, d * 3.2);
    if (d > 0.04) {
      const want = Math.atan2(dy, dx), dd = angDiff(p.h, want);
      if (p.v < 0.4) p.h = want;
      else {
        const rate = 2.6 + 6 * p.agi, turn = clamp(dd, -rate * dt, rate * dt);
        p.h += turn;
        p.v *= 1 - Math.min(0.6, Math.abs(turn) * 0.35);
        if (Math.abs(dd) > 1.3) target *= 0.5;
      }
    } else target = 0;
    p.v += clamp(target - p.v, -p.acc * 1.6 * dt, p.acc * dt);
    p.vx = Math.cos(p.h) * p.v; p.vy = Math.sin(p.h) * p.v;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.anim += p.v * dt * 1.7;
    p.face = look != null ? look : p.v > 0.5 ? p.h : p.face;
  }
  function coast(p, dt, k) {
    p.v *= Math.max(0, 1 - (k || 5) * dt);
    p.vx = Math.cos(p.h) * p.v; p.vy = Math.sin(p.h) * p.v;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  function place(p, x, y, dt) {
    const vx = (x - p.x) / dt, vy = (y - p.y) / dt;
    p.vx = vx; p.vy = vy; p.v = Math.hypot(vx, vy);
    if (p.v > 0.3) p.h = p.face = Math.atan2(vy, vx);
    p.x = x; p.y = y; p.anim += p.v * dt * 1.7;
  }
  // where a pursuer meets the carrier if both keep going
  function intercept(d, c, cushion) {
    const sp = d.spd * 0.98;
    for (let t = 0; t <= 1.6; t += 0.05) {
      const px = c.x + c.vx * t, py = c.y + c.vy * t;
      if (Math.hypot(px - d.x, py - d.y) <= sp * t + 0.6) return [px + (cushion || 0), py];
    }
    return [c.x + c.vx * 1.6 + (cushion || 0), c.y + c.vy * 1.6];
  }

  // ------------------------------------------------------------------ the exchange
  function holderChanged(P, base) {
    for (const d of P.players) if (d.team === 'D') {
      let delay = base - (P.dif - 50) * 0.0016 + P.r() * 0.12;
      if (d.role === 'read1' && d.beh === 'crash' && P.carrier === P.by.QB) delay += 0.08;  // eyes on the dive
      if (d.role === 'read1' && d.beh === 'sit' && P.carrier === P.by.QB) delay -= 0.14;    // he was watching the QB all along
      d.know = P.t + Math.max(0.06, delay);
    }
  }
  function judge1(P, choice, u) {
    const beh = P.look.de, want = beh === 'crash' ? 'pull' : 'give';
    return { choice, beh, want, correct: choice === want, u: Math.round(u * 100) / 100 };
  }
  function give(P, u) {
    const b = meshBack(P), s = P.s;
    P.give = true; P.dec.read1 = judge1(P, 'give', u);
    P.carrier = b; P.ctrl = b; P.ball = { st: 'held', holder: b.id };
    const gx = P.play === 'triple' ? 1.2 : 1.0, gy = P.play === 'triple' ? 2.0 * s : -0.9 * s;
    b.h = Math.atan2(gy - b.y, gx - b.x); b.v = Math.max(4.6, b.v); b.st = 'run';
    P.by.QB.st = 'fake'; P.by.QB.fakeT = 0;
    P.phase = 'run';
    holderChanged(P, 0.26);
    P.fx.push({ k: 'give' });
  }
  function pull(P, u) {
    const q = P.by.QB, b = meshBack(P), s = P.s;
    P.give = false; P.wantPull = false; P.dec.read1 = judge1(P, 'pull', u);
    P.pullT = P.t; P.phase = 'run';
    q.h = P.play === 'triple' ? Math.atan2(0.86 * s, 0.5) : Math.atan2(0.8 * s, 0.6);   // down the line, behind the scrum
    q.v = Math.max(q.v, 3.4); q.st = 'run';
    b.st = 'fake'; b.fakeT = 0;
    // pulled with both hands still on it: the ball can come out
    if (P.mesh === 'hold' && u > 0.8 && u < 1 && P.r() < ((u - 0.8) / 0.2) * 0.3) {
      P.ctrl = q;
      loose(P, (q.x + b.x) / 2, (q.y + b.y) / 2, 0.9, (P.r() - 0.5) * 3, (P.r() - 0.5) * 3, 1.5);
      P.log.push('mesh fumble');
    } else {
      P.carrier = q; P.ctrl = q; P.ball = { st: 'held', holder: 'QB' };
    }
    holderChanged(P, 0.26);
    P.fx.push({ k: 'pull' });
  }
  function snap(P) {
    P.phase = 'mesh'; P.snapT = P.t; P.scale = P.slow;
    P.fx.push({ k: 'snap' });
    P.ball = P.play === 'triple' ? { st: 'exchange', x: P.by.QB.x, y: P.by.QB.y, z: 1 } : { st: 'snap', x: -0.6, y: 0, z: 0.3 };
  }
  function choreo(P, tau, dt) {
    const s = P.s, q = P.by.QB, b = meshBack(P), C = P.C;
    if (P.play === 'triple') {
      if (tau < C.approach) {
        const e = ease(tau / C.approach), f = tau / C.approach, g = 0.45 * f + 0.55 * f * f;
        place(q, lerp(-0.95, -1.4, e), lerp(0, 0.95 * s, e), dt);
        place(b, lerp(-4.6, -2.15, g), lerp(0, 1.55 * s, g), dt);
      } else {
        const u = clamp((tau - C.approach) / C.ride, 0, 1.2);
        place(q, lerp(-1.4, -1.3, u), lerp(0.95 * s, 1.65 * s, u), dt);
        place(b, lerp(-2.15, -0.35, u), lerp(1.55 * s, 2.15 * s, u), dt);
      }
    } else {
      const a0 = C.pre, a1 = C.pre + C.approach;
      if (tau < a1) {
        const f = clamp((tau - 0.05) / (a1 - 0.05), 0, 1);
        place(b, lerp(-4.6, -3.85, f), lerp(1.3 * s, 0.55 * s, f), dt);
        place(q, -4.5, lerp(0, 0.05 * s, clamp((tau - a0) / C.approach, 0, 1)), dt);
      } else {
        const u = clamp((tau - a1) / C.ride, 0, 1.2);
        place(b, lerp(-3.85, -2.7, u), lerp(0.55 * s, -1.0 * s, u), dt);
        place(q, lerp(-4.5, -4.35, u), lerp(0.05 * s, 0.18 * s, u), dt);
      }
      q.face = 0;
    }
  }
  function meshStep(P, inp, dt) {
    const C = P.C, tau = P.t - P.snapT, q = P.by.QB, b = meshBack(P);
    const ride0 = C.pre + C.approach, u = (tau - ride0) / C.ride;
    P.rideU = u;
    choreo(P, tau, dt);
    // the ball: snapped back (shotgun), then in the QB's hands, then riding in the back's belly
    if (P.play === 'read' && tau < C.pre) {
      const f = tau / C.pre;
      P.ball = { st: 'snap', x: lerp(-0.6, q.x + 0.2, f), y: lerp(0, q.y, f), z: lerp(0.3, 1.0, f) + Math.sin(f * Math.PI) * 0.3 };
    } else {
      const hx = q.x + Math.cos(angTo(q, b)) * 0.35, hy = q.y + Math.sin(angTo(q, b)) * 0.35;
      const k = u < 0 ? 0 : 0.3 + 0.5 * clamp(u, 0, 1);
      P.ball = { st: 'exchange', x: lerp(hx, b.x, k), y: lerp(hy, b.y, k), z: 1.0 };
    }
    const haveIt = tau >= C.pre;
    if (P.mesh === 'hold') { if (!inp.hold) P.wantPull = true; }
    else if (inp.give && P.tapAt == null) P.tapAt = u;
    if (!haveIt) return;
    if (P.wantPull) return pull(P, u);
    if (u >= 1) {
      if (P.mesh === 'hold' ? inp.hold : P.tapAt != null) give(P, 1);
      else pull(P, 1);
    }
  }

  // ------------------------------------------------------------------ the ball
  function loose(P, x, y, z, vx, vy, vz) {
    P.ball = { st: 'loose', x, y, z, vx, vy, vz, t: P.t };
    P.carrier = null;
    for (const d of P.players) if (d.team === 'D') d.know = Math.min(d.know, P.t + 0.2 + P.r() * 0.15);
    P.fx.push({ k: 'fumble', x, y });
  }
  function ballStep(P, dt) {
    const B = P.ball;
    if (B.st === 'held') {
      const c = P.by[B.holder];
      const side = c.team === 'O' ? 1 : -1;
      B.x = c.x + Math.cos(c.h + 0.9 * side) * 0.32; B.y = c.y + Math.sin(c.h + 0.9 * side) * 0.32; B.z = c.st === 'down' ? 0.25 : c.id === 'C' ? 0.35 : 0.95;
      return;
    }
    if (B.st === 'air') {
      const f = (P.t - B.t0) / B.T;
      B.x = lerp(B.fx, B.tx, f); B.y = lerp(B.fy, B.ty, f);
      B.z = lerp(1.0, 0.9, f) + B.peak * 4 * f * (1 - f);
      // a defender in the lane can get a hand on it
      for (const d of P.players) {
        if (d.team !== 'D' || d.st === 'down' || d.eng || B.tipped) continue;
        if (Math.hypot(d.x - B.x, d.y - B.y) < 0.55 && B.z < 2.1 && f > 0.3) {
          B.tipped = true;
          if (P.r() < 0.45 + d.hands / 300) {
            if (P.r() < 0.18) { P.log.push('pitch picked off'); return dead(P, 'turnover', B.x, d); }
            loose(P, B.x, B.y, B.z, (P.r() - 0.5) * 4, (P.r() - 0.5) * 4, 1.5);
            P.log.push('pitch tipped');
            return;
          }
        }
      }
      const pb = P.by[B.to];
      if (f >= 1) {
        // judged where the ball arrives: in his hands, a fingertip grab, or on the ground
        const miss = Math.hypot(pb.x - B.x, pb.y - B.y), reach = 0.72 + pb.hands * 0.004;
        if (pb.st !== 'down' && miss < reach) return catchIt(P, pb, miss / reach);
        if (miss < reach + 0.45 && pb.st !== 'down' && P.r() < 0.55) return catchIt(P, pb, 1.1, true);
        const dx = B.tx - B.fx, dy = B.ty - B.fy, dl = Math.hypot(dx, dy) || 1;
        P.log.push('pitch on the ground');
        return loose(P, B.x, B.y, 0.6, (dx / dl) * 4, (dy / dl) * 4, -1);
      }
      return;
    }
    if (B.st === 'loose') {
      B.vz -= GRAV * dt;
      B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
      if (B.z <= 0) {
        B.z = 0;
        if (Math.abs(B.vz) > 1.2) {
          // a football never bounces where you think it will
          const a = Math.atan2(B.vy, B.vx) + (P.r() - 0.5) * 2.2, sp = Math.hypot(B.vx, B.vy) * 0.7;
          B.vx = Math.cos(a) * sp; B.vy = Math.sin(a) * sp; B.vz = -B.vz * 0.42;
          P.fx.push({ k: 'bounce', x: B.x, y: B.y });
        } else { B.vz = 0; B.vx *= 1 - 2.4 * dt; B.vy *= 1 - 2.4 * dt; }
      }
      if (Math.abs(B.y) > SIDE) return dead(P, 'oob', B.x);
      if (B.z < 0.55) {
        let best = null, bd = 0.6;
        for (const p of P.players) {
          if (p.st === 'down' || p.eng) continue;
          const d = Math.hypot(p.x - B.x, p.y - B.y);
          if (d < bd) { bd = d; best = p; }
        }
        if (!best && P.t - B.t > 4) best = P.players.reduce((a, p) => (dist(p, B) < dist(a, B) ? p : a));
        if (best) {
          if (best.team === 'D') { P.log.push('defense recovered'); return dead(P, 'turnover', B.x, best); }
          if (!CARRIERS[best.kind]) { P.log.push('offense recovered'); return dead(P, 'tackle', best.x, best); }
          P.carrier = best; P.ctrl = best; P.ball = { st: 'held', holder: best.id }; best.st = 'run';
          holderChanged(P, 0.2);
          P.fx.push({ k: 'scoop' });
        }
      }
    }
  }
  function catchIt(P, pb, q, bobble) {
    P.carrier = pb; P.ctrl = pb; P.ball = { st: 'held', holder: pb.id }; pb.st = 'run';
    if (q > 0.75 || bobble) { pb.v *= 0.55; pb.stumble = 0.22; P.log.push('bobbled pitch'); }
    holderChanged(P, 0.12);
    P.fx.push({ k: 'catch', x: pb.x, y: pb.y });
  }
  function canPitch(P) {
    const q = P.by.QB, pb = pitchMan(P);
    if (!pb || P.phase !== 'run' || P.carrier !== q || P.pitch || q.st === 'down' || P.t - (P.pullT || 0) < 0.12) return false;
    return pb.st !== 'down' && pb.x < q.x + 0.25 && dist(q, pb) < 9;
  }
  function doPitch(P) {
    if (!canPitch(P)) return false;
    const q = P.by.QB, pb = pitchMan(P), r = P.r;
    const dx = pb.x - q.x, dy = pb.y - q.y, dd = Math.hypot(dx, dy);
    const T = 0.1 + dd / 12;
    let err = 0.22;
    let near = 9;
    for (const d of P.players) if (d.team === 'D' && d.st !== 'down' && !d.eng) near = Math.min(near, dist(d, q));
    if (near < 1.3) err += 0.25 + 0.75 * (1.3 - near) / 1.3;                 // pitched as he's hit
    if (dd > 6) err += (dd - 6) * 0.18;                                       // too far
    const away = (q.vx * dx + q.vy * dy) / (dd * Math.max(0.5, q.v));
    if (away < -0.25) err += 0.35;                                            // across his body, running away from the pitch man
    const ux = dx / dd, uy = dy / dd, e1 = gauss(r) * err, e2 = gauss(r) * err * 0.6;
    const tx = pb.x + pb.vx * T + ux * e2 - uy * e1, ty = pb.y + pb.vy * T + uy * e2 + ux * e1;
    P.ball = { st: 'air', fx: q.x, fy: q.y, tx, ty, T, t0: P.t, peak: 0.25 + dd * 0.05, to: pb.id, x: q.x, y: q.y, z: 1 };
    P.pitch = { t: P.t, err: Math.round(err * 100) / 100, dist: Math.round(dd * 10) / 10 };
    P.carrier = null;
    q.st = 'fake'; q.fakeT = 0.6;
    if (!P.dec.read2) P.dec.read2 = judge2(P, 'pitch');
    holderChanged(P, 0.16);
    P.fx.push({ k: 'pitch' });
    return true;
  }
  function judge2(P, choice) {
    const ol = P.by['OLB' + K_(P)], L = P.look;
    const beh = L.scrape ? 'scrape' : L.key2;
    const want = L.scrape || L.key2 === 'qb' ? 'pitch' : L.key2 === 'pitch' ? 'keep' : ol.commit === 'qb' ? 'pitch' : ol.commit === 'pitch' ? 'keep' : 'wait';
    return { choice, beh, commit: ol.commit, want, correct: choice === want };
  }

  // ------------------------------------------------------------------ the ball carrier (you)
  const JUKE_T = 0.26, TRUCK_T = 0.42;
  function carrierStep(P, c, inp, dt) {
    if (c.st === 'down') return;
    c.cd -= dt; c.stumble -= dt;
    if (inp.juke && c.cd <= 0 && P.carrier === c) startJuke(P, c, inp.juke > 0 ? 1 : -1);
    if (inp.truck && c.cd <= 0 && P.carrier === c) { c.truck = TRUCK_T; c.cd = 0.85; P.stats.trucks++; P.fx.push({ k: 'truckGo', x: c.x, y: c.y }); }
    let want = null;
    if (inp.steer && Math.hypot(inp.steer.x, inp.steer.y) > 0.22) want = Math.atan2(inp.steer.y, inp.steer.x);
    if (P.ball.st === 'loose' && P.carrier !== c && !inp.steer) want = Math.atan2(P.ball.y - c.y, P.ball.x - c.x);
    const ratio = c.v / c.spd;
    if (want != null) {
      const d = angDiff(c.h, want);
      const rate = (3.2 + 5.5 * c.agi) * (1.25 - 0.45 * ratio);
      const turn = clamp(d, -rate * dt, rate * dt);
      c.h += turn;
      c.v *= 1 - Math.min(0.9, Math.abs(turn) * (0.62 - 0.25 * c.agi));   // cutting costs speed; the shifty ones lose less
    } else c.h += clamp(angDiff(c.h, 0), -0.55 * dt, 0.55 * dt);         // left alone, he bends upfield
    let vmax = c.spd * (c.truck > 0 ? 0.84 : 1) * (c.stumble > 0 ? 0.6 : 1) * (Math.cos(c.h) < 0 ? 0.82 : 1);
    if (c.juke > 0) vmax *= 0.72;
    c.v += clamp(vmax - c.v, -c.acc * 2 * dt, c.acc * dt);
    let jx = 0, jy = 0;
    if (c.juke > 0) {
      const u = 1 - c.juke / JUKE_T, lat = (4.6 + 3 * c.agi) * Math.sin(Math.PI * u) * c.jukeDir;
      jy = lat * 1.25; c.juke -= dt;
    }
    if (c.truck > 0) { c.truck -= dt; if (c.truck <= 0) c.stumble = Math.max(c.stumble, 0.14); }
    c.vx = Math.cos(c.h) * c.v + jx; c.vy = Math.sin(c.h) * c.v + jy;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.anim += c.v * dt * 1.7;
    c.face = c.h;
  }
  function startJuke(P, c, dir) {
    c.juke = JUKE_T; c.jukeDir = dir; c.cd = 0.45; c.jukeT = P.t; P.stats.jukes++;
    P.fx.push({ k: 'juke', x: c.x, y: c.y, dir });
    // defenders squared up close in front can bite on it
    for (const d of P.players) {
      if (d.team !== 'D' || d.st === 'down' || d.st === 'lunge' || d.eng) continue;
      const dx = d.x - c.x, dy = d.y - c.y, dl = Math.hypot(dx, dy);
      if (dl > 3.2 || (Math.cos(c.h) * dx + Math.sin(c.h) * dy) / (dl || 1) < -0.2) continue;
      const p = clamp(0.38 + (c.agi - d.agi) * 0.5 - (P.dif - 50) / 250, 0.12, 0.7);
      if (P.r() < p) { d.st = 'stagger'; d.stT = 0.45; d.h = Math.atan2(-dir * 0.8, Math.cos(d.h)); d.bit = P.t; P.stats.jukeMiss++; P.fx.push({ k: 'bite', x: d.x, y: d.y }); }
    }
  }

  // ------------------------------------------------------------------ contact
  function tryTackle(P, d, c) {
    if (d.st === 'lunge' || d.st === 'down' || d.eng || c.st === 'down') return;
    if (c.cool > 0 && c.coolBy === d.id) return;
    const dd = dist(d, c);
    if (dd < 0.62) return contact(P, d, c, 0.5);
    const lungeAt = 1.75 + d.tck * 0.003;
    if (dd < lungeAt && d.st !== 'stagger') {
      d.st = 'lunge'; d.stT = 0.2;
      d.ax = c.x + c.vx * 0.2 + (P.r() - 0.5) * 0.25; d.ay = c.y + c.vy * 0.2 + (P.r() - 0.5) * 0.25;
      d.h = Math.atan2(d.ay - d.y, d.ax - d.x); d.face = d.h;
      // the dive covers the gap to where he expects you to be, no farther
      d.lv = Math.min(Math.max(d.v, 5.2) * 1.1, Math.hypot(d.ax - d.x, d.ay - d.y) / 0.2 + 1.5);
    }
  }
  function lungeStep(P, d, dt) {
    const c = P.carrier;
    d.x += Math.cos(d.h) * d.lv * dt; d.y += Math.sin(d.h) * d.lv * dt;
    d.vx = Math.cos(d.h) * d.lv; d.vy = Math.sin(d.h) * d.lv;
    d.stT -= dt;
    if (d.stT > 0) return;
    const reach = 0.95 + d.tck * 0.003;
    const dd = c ? dist(d, c) : 99;
    if (c && dd <= reach) return contact(P, d, c, dd / reach);
    // whiffed
    d.st = dd > reach + 0.6 ? 'down' : 'stagger'; d.stT = d.st === 'down' ? 0.75 : 0.45; d.v *= 0.4;
    if (c && P.t - (c.jukeT || -9) < 0.6) P.stats.jukeMiss++;
    P.fx.push({ k: 'whiff', x: d.x, y: d.y });
  }
  function contact(P, d, c, q) {
    const r = P.r;
    const hx = Math.cos(c.h), hy = Math.sin(c.h), dx = d.x - c.x, dy = d.y - c.y, dl = Math.hypot(dx, dy) || 1;
    const front = (hx * dx + hy * dy) / dl;
    const ang = front > 0.45 ? 'head' : front < -0.3 ? 'behind' : 'side';
    const edge = q > 0.8, squared = d.st !== 'lunge' && front > 0.3;
    const gang = c.lastHit && P.t - c.lastHit.t < 0.3 && c.lastHit.id !== d.id;
    c.lastHit = { t: P.t, id: d.id };
    P.fx.push({ k: 'hit', x: (c.x + d.x) / 2, y: (c.y + d.y) / 2, ang });
    if (c.truck > 0) {
      const cp = c.mass * (0.45 + 0.6 * c.v / c.spd) * (0.7 + c.str / 150);
      const lev = (ang === 'head' ? (squared ? 1.3 : 1.05) : ang === 'side' ? 0.8 : 0.6) * (edge ? 0.75 : 1);
      const dp = d.mass * lev * (0.7 + d.tck / 150) * (gang ? 1.6 : 1);
      const pw = clamp(1 / (1 + Math.exp(-(cp - dp) / 0.33)), 0.06, 0.94);
      if (r() < pw) {
        d.st = 'down'; d.stT = 1.3; d.x += hx * 1.0; d.y += hy * 1.0; d.v = 0;
        c.v *= 0.62; c.stumble = 0.12; c.cool = 0.35; c.coolBy = d.id; c.truck = 0;
        P.stats.truckWins++; P.stats.broken++;
        P.fx.push({ k: 'truck', x: d.x, y: d.y });
        return;
      }
      return tackled(P, c, d, ang, 0.6);
    }
    let hold = (ang === 'head' ? 0.88 : ang === 'side' ? 0.76 : 0.64) + (d.tck - 65) / 220 - (c.str - 60) / 260
      - (edge ? 0.2 : 0) - (c.v > 0.8 * c.spd ? 0.05 : 0) + (c.v < 2 ? 0.12 : 0);
    if (d.arm) hold = 0.22 + (d.tck - 65) / 300;
    if (gang) hold = 1 - (1 - hold) * 0.35;
    hold = clamp(hold, 0.12, 0.97);
    if (r() < hold) return tackled(P, c, d, ang, 0);
    d.st = 'down'; d.stT = 0.7; d.v *= 0.3;
    c.v *= 0.72; c.stumble = 0.18; c.cool = 0.3; c.coolBy = d.id;
    P.stats.broken++;
    P.fx.push({ k: 'broken', x: c.x, y: c.y });
  }
  function tackled(P, c, d, ang, extra) {
    const fwd = Math.max(0, Math.cos(c.h)) * ((ang === 'head' ? 0.15 : ang === 'side' ? 0.55 : 0.9) + extra);
    c.st = 'down'; c.v = 0; d.st = 'down'; d.stT = 9; d.v = 0;
    const x = c.x + fwd;
    dead(P, x < -P.toOwn ? 'safety' : 'tackle', x, d);
  }
  function dead(P, how, x, by) {
    if (P.phase === 'dead') return;
    const c = P.carrier;
    if (c === P.by.QB && !P.dec.read2 && P.play === 'triple' && P.give === false && !P.pitch) P.dec.read2 = judge2(P, 'keep');
    if (how === 'td') x = P.toGoal;
    const yards = how === 'turnover' ? 0 : Math.round(x);
    P.phase = 'dead'; P.deadT = P.t; P.scale = 1;
    P.result = { how, x, yards: how === 'td' ? Math.round(P.toGoal) : yards, carrier: c ? c.id : null, carrierKind: c ? c.kind : null,
      by: by ? by.id : null, reads: P.dec, stats: P.stats, look: P.look, play: P.play, side: P.s, pitch: P.pitch, log: P.log.slice() };
    if (P.ball.st !== 'held') P.ball.st = 'dead';
    P.fx.push({ k: how === 'td' ? 'td' : 'whistle' });
  }

  // ------------------------------------------------------------------ defense
  function pursue(d, c, cushion) { const [x, y] = intercept(d, c, cushion); return [x, y, 1, null]; }
  function job(P, d) {
    const s = P.s, q = P.by.QB, fb = meshBack(P), pb = pitchMan(P), c = P.carrier, by = P.by;
    const tSnap = P.snapT == null ? -1 : P.t - P.snapT;
    const known = P.t >= d.know;
    const hold = [d.x, d.y, 0.2, angTo(d, q)];
    d.keyOn = null;
    if (tSnap < 0) return hold;
    if (P.ball.st === 'loose' && known) return [P.ball.x, P.ball.y, 1, null];
    if (P.ball.st === 'air' && known) { const t = by[P.ball.to]; return pursue(d, t); }
    switch (d.role) {
      case 'read1': {
        if (tSnap < 0.1 + P.look.disguise) return hold;
        if (known && c) return pursue(d, c);
        if (d.beh === 'crash') {
          d.keyOn = fb.id;
          if (P.play === 'read') { if (P.carrier === fb) return pursue(d, fb); return [0.4, clamp(fb.y + fb.vy * 0.5, -1.5, 1.5), 0.95, null]; }
          if (P.carrier === fb) return pursue(d, fb);
          return [0.45, 2.1 * s, 0.95, null];             // squeezes into the dive hole
        }
        d.keyOn = q.id;
        if (d.beh === 'attack') return [q.x, q.y, 1, null];
        // sits: stays home on the line in the C gap, square to the QB, ready for him either way
        return [0.9, s * clamp(q.y * s + 1.5, 2.9, 3.8), 0.42, angTo(d, q)];
      }
      case 'read2': {
        if (tSnap < 0.12) return hold;
        if (known && c && c !== q && c !== pb) return pursue(d, c);
        let b = d.beh;
        if (b === 'feather') {
          if (!d.commit && c === q && known && (dist(d, q) < 2.8 || P.t - P.pullT > 1.1)) { d.commit = P.r() < 0.7 ? 'qb' : 'pitch'; P.log.push('backer committed to the ' + (d.commit === 'qb' ? 'QB' : 'pitch')); }
          b = d.commit || 'feather';
        }
        d.keyOn = q.id;
        if (b === 'feather') return [q.x + 2.2, lerp(q.y, pb.y, 0.62), 0.5, angTo(d, q)];   // hangs between, shaded to the pitch
        if (b === 'qb') return c === q && known ? pursue(d, q) : [q.x + 2.6, q.y + 1.4 * s, 0.65, angTo(d, q)];
        // plays the pitch: stays outside and ahead of the pitch man until the QB gets past him
        d.keyOn = pb.id;
        if (c === pb) return pursue(d, pb);
        if (c === q && known && (q.x > d.x - 0.4 || (Math.abs(q.y - d.y) < 1.5 && q.x > d.x - 2))) {
          if (d.switchAt == null) d.switchAt = P.t + 0.3;
          if (P.t >= d.switchAt) { d.keyOn = q.id; return pursue(d, q); }
        }
        return [pb.x + 1.6, pb.y + 1.1 * s, 1, angTo(d, q)];
      }
      case 'scrape': {
        if (tSnap < 0.08) return hold;
        if (known && c && c !== q) return pursue(d, c);
        d.keyOn = q.id;
        if (!d.scraped) { if (Math.hypot(d.x - 1.6, d.y - 5.2 * s) < 0.9) d.scraped = true; else return [1.6, 5.2 * s, 1, angTo(d, q)]; }
        return c === q ? pursue(d, q) : [q.x + 1.5, q.y + 1.5 * s, 0.8, angTo(d, q)];
      }
      case 'alley': {
        if (known && c) return pursue(d, c);
        return [Math.max(2.5, q.x + 3), 6.5 * s, 1, angTo(d, q)];
      }
      case 'inside':
        if (tSnap < 0.3) return [d.x0 - 0.3, d.y0 + 0.9 * s, 0.3, angTo(d, q)];
        return known && c ? pursue(d, c) : P.play === 'read' ? [1.4, -1.2 * s, 0.75, angTo(d, q)] : [1.6, 1.6 * s, 0.7, angTo(d, q)];
      case 'line':
        return known && c ? pursue(d, c) : [q.x, q.y, 0.55, null];
      case 'flow':
        return known && c ? pursue(d, c) : [3.0, d.y0 + 2.5 * s, 0.5, angTo(d, q)];
      case 'corner':
        if (tSnap < 0.35) return [d.x0 + 1, d.y0, 0.4, angTo(d, q)];
        return known && c ? pursue(d, c) : [4.5, 10.5 * s, 0.8, angTo(d, q)];
      default:  // deep
        if (tSnap < 0.45) return [d.x0 + 1.5, d.y0, 0.45, angTo(d, q)];
        if (known && c) return pursue(d, c, 0.6);
        { const b = c || q; return [Math.max(d.x0 - 0.5, b.x + 8), lerp(d.y0, b.y + 2.5 * s, 0.65), 0.8, angTo(d, b)]; }   // mirror the ball, stay deep
    }
  }
  function defendStep(P, d, dt) {
    if (d.st === 'down') { coast(d, dt, 6); d.stT -= dt; if (d.stT <= 0) { d.st = 'stagger'; d.stT = 0.35; } return; }
    if (d.st === 'stagger') { d.stT -= dt; if (d.stT <= 0) d.st = 'run'; }
    if (d.eng) return;
    if (d.st === 'lunge') return lungeStep(P, d, dt);
    if (P.phase === 'pre' || P.phase === 'cadence') return;
    const [x, y, frac, look] = job(P, d);
    steer(d, x, y, frac, dt, look);
    if (d.st === 'set') d.st = 'run';
    const c = P.carrier;
    if (!c || P.phase !== 'run') return;
    const dd = dist(d, c);
    if (dd > 2.3) return;
    // he tackles who he's keyed on, or anyone once he's seen who has it. Eyes elsewhere, he can only reach out
    // for a runner who brushes right past him: an arm tackle
    if (P.t >= d.know || d.keyOn === c.id) tryTackle(P, d, c);
    else if (dd < 0.75 && d.armT <= P.t) { d.armT = P.t + 0.6; if (P.r() < 0.4) { d.arm = true; contact(P, d, c, 0.9); d.arm = false; } }
  }

  // ------------------------------------------------------------------ offense
  function freeDefenders(P) { return P.players.filter(d => d.team === 'D' && d.st !== 'down' && !d.eng); }
  function retarget(P, b) {
    const c = P.carrier || P.by.QB;
    let best = null, bv = 1e9;
    for (const d of freeDefenders(P)) {
      if (d.id === b.tried) continue;
      const db = dist(b, d), dc = dist(d, c);
      if (db > 7 || dc > 9) continue;
      const v = db + 0.6 * dc;
      if (v < bv) { bv = v; best = d; }
    }
    b.tgt = best ? best.id : null;
  }
  function blockStep(P, b, dt) {
    if (b.st === 'stagger') { b.stT -= dt; coast(b, dt, 4); if (b.stT > 0) return; b.st = 'run'; b.tgt = null; }
    const c = P.carrier || P.by.QB;
    if (b.eng) {
      const d = P.by[b.eng];
      let ux = c.x - d.x, uy = c.y - d.y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const push = clamp(d.spd * 0.16 + (d.str - b.blk) * 0.006, 0.1, 1.6);
      d.x += ux * push * dt; d.y += uy * push * dt;
      d.vx = ux * push; d.vy = uy * push; d.v = push; d.face = angTo(d, b); d.anim += push * dt * 1.7;
      const bx = d.x + ux * 0.8, byy = d.y + uy * 0.8, k = Math.min(1, 8 * dt);
      b.vx = (bx - b.x) * 8; b.vy = (byy - b.y) * 8;
      b.x += (bx - b.x) * k; b.y += (byy - b.y) * k; b.face = angTo(b, d); b.v = push; b.anim += push * dt * 1.7;
      b.shedT -= dt;
      if (b.shedT <= 0) {
        b.shedT = 0.2;
        const near = P.carrier && Math.hypot(c.x - d.x, c.y - d.y) < (d.kind === 'CB' || d.kind === 'S' ? 2.6 : 1.2);
        // backs in space slip blocks; big men in the trenches lean on them
        const space = d.kind === 'CB' || d.kind === 'S' ? 0.07 + (d.agi - b.agi) * 0.25 : 0;
        const p = clamp(0.06 + space + (d.str - b.blk) / 450 + (near ? 0.14 : 0) + (P.dif - 50) / 1200, 0.015, 0.5);
        if (P.t - b.engT > 0.5 && P.r() < p) {
          d.eng = null; b.eng = null; b.st = 'stagger'; b.stT = 0.5; d.know = Math.min(d.know, P.t + 0.1);
          // a back who gets off the block as the runner arrives is ready to tackle; a lineman stumbles out of it
          if ((d.kind === 'CB' || d.kind === 'S') && near) d.st = 'run'; else { d.st = 'stagger'; d.stT = 0.2; }
        }
      }
      // the carrier brushes right past him: he can reach out and grab
      if (P.carrier && P.phase === 'run' && d.armT <= P.t && dist(d, P.carrier) < 0.85) {
        d.armT = P.t + 0.6;
        if (P.r() < 0.3) { d.arm = true; contact(P, d, P.carrier, 0.9); d.arm = false; }
      }
      return;
    }
    if (P.phase === 'pre' || P.phase === 'cadence') return;
    b.retT -= dt;
    let d = b.tgt && P.by[b.tgt];
    if (!d || d.st === 'down' || (d.eng && d.eng !== b.id)) { if (b.retT <= 0) { b.retT = 0.3; retarget(P, b); } d = b.tgt && P.by[b.tgt]; }
    if (!d) { steer(b, b.x + 1, b.y, 0.3, dt); return; }
    // get between him and the ball
    const ux = c.x - d.x, uy = c.y - d.y, ul = Math.hypot(ux, uy) || 1;
    const tx = d.x + d.vx * 0.2 + (ux / ul) * 0.55, ty = d.y + d.vy * 0.2 + (uy / ul) * 0.55;
    steer(b, tx, ty, 1, dt);
    if (dist(b, d) < 0.95 && b.tried !== d.id) {
      b.tried = d.id;
      const lat = Math.abs(d.vy);
      const p = clamp(0.88 + (b.blk - d.str) / 300 - (lat > 4 ? 0.2 : 0) - (d.kind === 'CB' || d.kind === 'S' ? 0.1 : 0) - (d.role === 'alley' ? 0.4 : 0) - (d.role === 'scrape' ? 0.45 : 0), 0.25, 0.97);
      if (P.r() < p) { b.eng = d.id; d.eng = b.id; d.st = 'run'; b.shedT = 0.25 + P.r() * 0.2; b.engT = P.t; }
      else { b.st = 'stagger'; b.stT = 0.45; P.fx.push({ k: 'whiffBlock', x: b.x, y: b.y }); }
    }
  }
  function offenseStep(P, p, dt) {
    const s = P.s, q = P.by.QB;
    if (p.role === 'block') return blockStep(P, p, dt);
    if (p.st === 'down') { coast(p, dt, 6); return; }
    if (P.phase === 'pre') return;
    if (p.role === 'pitch') {
      if (P.phase === 'cadence') return steer(p, -1.9, 4.5 * s, 0.75, dt);
      if (P.ball.st === 'air' && P.ball.to === p.id) return steer(p, P.ball.tx, P.ball.ty, 1, dt);
      if (P.ball.st === 'loose') return steer(p, P.ball.x, P.ball.y, 1, dt);
      if (P.carrier === q || P.phase === 'mesh') {
        const ty = clamp(q.y + 4.4 * s, -SIDE + 1.5, SIDE - 1.5);
        return steer(p, Math.min(q.x - 1.6, q.x + q.vx * 0.15 - 1.4), ty, 1, dt, null);
      }
      return steer(p, p.x + 2, p.y + 1.5 * s, 0.5, dt);   // carries out his fake
    }
    if (P.phase === 'cadence' || (P.phase === 'mesh' && (p === q || p === meshBack(P)))) return;
    if (p.st === 'fake') {
      p.fakeT = (p.fakeT || 0) + dt;
      if (P.ball.st === 'loose' && CARRIERS[p.kind]) return steer(p, P.ball.x, P.ball.y, 1, dt);
      if (p === q) return steer(p, q.x + 3, q.y + 3 * s, p.fakeT < 1 ? 0.7 : 0, dt);
      // the dive back after a pull: he runs his fake right into the end who crashed on it, or through the line to hit somebody
      const de = read1Of(P);
      if (!p.tgt && de.role === 'read1' && de.beh === 'crash' && !de.eng && de.st !== 'down' && dist(p, de) < 1.3) { p.role = 'block'; p.tgt = de.id; p.st = 'run'; p.eng = de.id; de.eng = p.id; p.engT = P.t; p.shedT = 0.3; P.fx.push({ k: 'thud', x: de.x, y: de.y }); return; }
      if (!p.tgt && p.x > 0.6) retargetNear(P, p);
      if (p.tgt) { p.role = 'block'; p.st = 'run'; return; }
      return steer(p, 1.4, (P.play === 'triple' ? 2.1 : -2.4) * s, 0.85, dt);
    }
    steer(p, p.x + 1, p.y, 0.2, dt);
  }
  function retargetNear(P, p) {
    let best = null, bd = 3;
    for (const d of freeDefenders(P)) { const dd = dist(p, d); if (dd < bd) { bd = dd; best = d; } }
    if (best) p.tgt = best.id;
  }

  // ------------------------------------------------------------------ the step
  function tick(P, inp, dt, real) {
    P.t += dt;
    if (P.phase === 'pre') {
      if (P.mesh === 'hold' ? inp.hold : inp.snap || inp.give) { P.phase = 'cadence'; P.cT = 0; P.fx.push({ k: 'hut' }); }
    } else if (P.phase === 'cadence') {
      P.cT += dt;
      if (P.mesh === 'hold' && !inp.hold) P.wantPull = true;
      if (P.mesh === 'tap' && inp.give && P.cT > 0.05) P.tapAt = -1;
      if (P.cT >= P.C.cadence) snap(P);
    } else if (P.phase === 'mesh') meshStep(P, inp, dt);
    else if (P.phase === 'run') {
      P.scale = Math.min(1, P.scale + 2.4 * real);
      const c = P.ctrl;
      if (c && (P.carrier === c || P.ball.st === 'loose')) carrierStep(P, c, inp, dt);
      if (inp.pitch) doPitch(P);
    }
    if (P.phase === 'dead') { for (const p of P.players) if (p.st !== 'down' && !p.eng) coast(p, dt, 3); else if (p.eng) { coast(p, dt, 8); } return; }
    for (const p of P.players) {
      if (p.team !== 'O' || (p === P.ctrl && (p === P.carrier || P.ball.st === 'loose'))) continue;
      if (p === P.carrier) { carrierStep(P, p, {}, dt); continue; }
      offenseStep(P, p, dt);
    }
    for (const p of P.players) if (p.team === 'D') defendStep(P, p, dt);
    for (const p of P.players) if (p.cool > 0) p.cool -= dt;
    ballStep(P, dt);
    if (P.phase !== 'run') return;
    const c = P.carrier;
    if (c) {
      if (Math.abs(c.y) > SIDE) return dead(P, 'oob', c.x);
      if (c.x >= P.toGoal) return dead(P, 'td', P.toGoal);
      // the QB kept: once he's past the pitch key (or well past the line) the second read is made
      if (c === P.by.QB && P.play === 'triple' && P.give === false && !P.dec.read2 && !P.pitch) {
        const k = key2Of(P);
        if (c.x > k.x + 0.3 || c.x > 3.5) P.dec.read2 = judge2(P, 'keep');
      }
    }
    if (P.t - (P.snapT || 0) > 16 && P.snapT != null) dead(P, 'tackle', c ? c.x : P.ball.x);
  }
  function step(P, dtReal, inp) {
    inp = inp || {};
    let left = Math.min(dtReal, 0.1), first = true;
    const once = { juke: 0, truck: false, pitch: false, give: false, snap: false };
    while (left > 1e-6) {
      const h = Math.min(DT, left);
      tick(P, first ? inp : Object.assign({}, inp, once), h * P.scale, h);
      first = false;
      left -= h;
    }
  }

  // training: which defenders to ring
  function keys(P) {
    if (P.play === 'read') return [read1Of(P).id];
    return [read1Of(P).id, key2Of(P).id];
  }

  return { SIDE, HASH, KIND, LOOKS, create, step, keys, canPitch, meshBack, pitchMan, read1Of, key2Of, dist, angDiff, clamp };
})();
if (typeof module !== 'undefined') module.exports = FB;
