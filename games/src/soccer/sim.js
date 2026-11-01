/* Soccer Playmaker: the simulation. Eleven on eleven, and you're the playmaker: whoever on your team has the ball is
   you. You dribble where you draw, and flick to pass or shoot. Teammates give you angles and make runs in behind; the
   defense holds a shape, presses the ball, covers, steps into passing lanes, plays offside, and the keeper reads shots.
   One attack at a time: it ends in a goal, a save, a miss, a turnover, the ball going out, offside, or the clock.

   Units are meters and seconds. x runs toward the goal you attack (0 is your goal line, 105 theirs), y across the pitch
   (+y is your right going forward, the right of the screen). No DOM: the page draws it and feeds it input; node tests
   run attacks headless.

   Input each step: { drag: {x, y} | null (the point on the pitch you're drawing toward), flick: {dir, dist, zip, curl}
   | null (dir in radians on the pitch, dist in meters, zip 0-1 for pace, curl -1..1), fake } */
const SC = (() => {
  const LEN = 105, HALF = 34, GOAL_HW = 3.66, GOAL_H = 2.44, BOX_X = LEN - 16.5, BOX_HW = 20.16, GRAV = 9.8, ROLL = 1.8, DT = 1 / 120;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const TAU = Math.PI * 2;
  function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());

  // ------------------------------------------------------------------ players
  // spd sprint m/s, ctl first touch and dribbling, pas, sho, tck tackling, agi turning
  const ROLE = {
    GK: { spd: 6.6, ctl: 55, pas: 55, sho: 20, tck: 40, agi: 0.6 },
    CB: { spd: 7.6, ctl: 56, pas: 60, sho: 35, tck: 78, agi: 0.55 },
    FB: { spd: 8.4, ctl: 62, pas: 62, sho: 40, tck: 70, agi: 0.7 },
    DM: { spd: 7.9, ctl: 70, pas: 76, sho: 52, tck: 72, agi: 0.68 },
    CM: { spd: 8.1, ctl: 72, pas: 76, sho: 58, tck: 64, agi: 0.72 },
    M: { spd: 8.1, ctl: 68, pas: 70, sho: 52, tck: 66, agi: 0.7 },
    W: { spd: 8.8, ctl: 75, pas: 66, sho: 64, tck: 45, agi: 0.85 },
    ST: { spd: 8.5, ctl: 70, pas: 60, sho: 76, tck: 40, agi: 0.75 },
    S: { spd: 8.3, ctl: 66, pas: 60, sho: 60, tck: 55, agi: 0.72 },
  };
  // you: a 4-3-3 in possession (spots for the ball around midfield; the shape slides with the ball)
  const HOME = [['GK', 'GK', 8, 0, 1], ['LB', 'FB', 38, -26, 3], ['LCB', 'CB', 32, -9, 4], ['RCB', 'CB', 32, 9, 5], ['RB', 'FB', 38, 26, 2],
    ['LCM', 'CM', 52, -14, 8], ['CM', 'DM', 46, 0, 6], ['RCM', 'CM', 52, 14, 10], ['LW', 'W', 68, -25, 11], ['ST', 'ST', 72, 0, 9], ['RW', 'W', 68, 25, 7]];
  // them: a 4-4-2 block defending the goal at x = 105 (spots relative to their back line)
  const AWAY = [['aGK', 'GK', 0, 0, 1], ['aRB', 'FB', 0, -21, 2], ['aRCB', 'CB', 1, -7, 5], ['aLCB', 'CB', 1, 7, 4], ['aLB', 'FB', 0, 21, 3],
    ['aRM', 'M', -13, -22, 7], ['aRCM', 'M', -12, -7, 8], ['aLCM', 'M', -12, 7, 6], ['aLM', 'M', -13, 22, 11], ['aRS', 'S', -26, -6, 9], ['aLS', 'S', -26, 6, 10]];
  const ATTACK_T = 26;

  function create(o) {
    o = o || {};
    const seed = (o.seed >>> 0) || ((Math.random() * 4294967295) >>> 0) || 1;
    const r = rng(seed);
    const dif = clamp(o.difficulty == null ? 50 : +o.difficulty, 0, 100), skill = clamp(o.skill == null ? 55 : +o.skill, 0, 100);
    const P = { seed, r, dif, skill, t: 0, phase: 'live', players: [], by: {}, home: [], away: [], ball: null, ctrl: null,
      offside: o.offside !== false, assist: o.assist === 'pro' ? 'pro' : 'casual', timeLeft: o.time || ATTACK_T,
      pass: null, shot: null, fx: [], log: [], stats: { passes: 0, done: 0, shots: 0, onTarget: 0, beat: 0, tackled: 0, fakes: 0 }, result: null, lineX: 90 };
    // where the attack starts: your holding midfielder on the ball, a few meters into your half or around midfield
    const startX = o.startX == null ? 44 + r() * 8 : +o.startX;
    for (const [id, role, x, y, num] of HOME) add(P, id, role, 'H', x + (startX - 46) * (role === 'GK' ? 0.3 : 0.85), y, num);
    const line = clamp(startX + 30, 72, 92);
    for (const [id, role, dx, y, num] of AWAY) add(P, id, role, 'A', role === 'GK' ? 103 : line + dx, y, num);
    for (const p of P.away) { p.spd *= 0.94 + dif * 0.0012; p.tck += (dif - 50) * 0.3; p.pos = 0.6 + dif * 0.004; p.react = 0.32 - dif * 0.0016; }
    for (const p of P.home) { p.spd *= 0.97 + skill * 0.0006; p.ctl += (skill - 55) * 0.3; p.pas += (skill - 55) * 0.3; p.sho += (skill - 55) * 0.3; }
    const c = P.by.CM;
    c.x = startX; c.y = 0; c.h = 0;
    P.ctrl = c; P.ball = { st: 'held', holder: c.id, x: c.x + 0.5, y: c.y, z: 0.11 };
    for (const p of P.home) if (p !== c && p.role !== 'GK') p.runT = 0.8 + r() * 2.4;
    return P;
  }
  function add(P, id, role, team, x, y, num) {
    const k = ROLE[role];
    const p = { id, role, team, num, x, y, bx: x, by: y, vx: 0, vy: 0, v: 0, h: team === 'H' ? 0 : Math.PI, face: team === 'H' ? 0 : Math.PI,
      spd: k.spd, ctl: k.ctl, pas: k.pas, sho: k.sho, tck: k.tck, agi: k.agi, st: 'run', stT: 0, anim: Math.random() * 6, run: null, runT: 0, pos: 0.7, react: 0.25,
      tackleT: 0, cutT: -9, watchT: 0, gk: role === 'GK' };
    P.players.push(p); P.by[id] = p; (team === 'H' ? P.home : P.away).push(p);
    return p;
  }

  // ------------------------------------------------------------------ motion
  function steer(p, tx, ty, frac, dt, look) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    const vmax = p.spd * frac * (p.st === 'beaten' ? 0.35 : 1);
    let target = Math.min(vmax, d * 2.6);
    if (d > 0.05) {
      const want = Math.atan2(dy, dx), dd = angDiff(p.h, want);
      if (p.v < 0.5) p.h = want;
      else { const rate = 3 + 6 * p.agi, turn = clamp(dd, -rate * dt, rate * dt); p.h += turn; p.v *= 1 - Math.min(0.5, Math.abs(turn) * 0.3); if (Math.abs(dd) > 1.4) target *= 0.5; }
    } else target = 0;
    p.v += clamp(target - p.v, -10 * dt, 7.5 * dt);
    p.vx = Math.cos(p.h) * p.v; p.vy = Math.sin(p.h) * p.v;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.anim += p.v * dt * 1.5;
    p.face = look != null ? look : p.v > 0.6 ? p.h : p.face;
  }
  const toward = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  // ------------------------------------------------------------------ lines and shape
  // the offside line: the second-last defender (the keeper is usually the last)
  function offsideLine(P) {
    const xs = P.away.map(p => p.x).sort((a, b) => b - a);
    return Math.max(xs[1], 52.5);
  }
  function lineHeight(P) {
    const b = P.ball;
    return clamp(Math.max(b.x, carrierX(P)) + 19, 70, 95);
  }
  const carrierX = P => (P.ctrl && P.ball.st === 'held' ? P.ctrl.x : P.ball.x);

  // ------------------------------------------------------------------ your teammates off the ball
  function laneOpen(P, from, to) {
    // how far the closest defender is from the line a pass would travel
    let m = 99;
    const dx = to.x - from.x, dy = to.y - from.y, L2 = dx * dx + dy * dy || 1;
    for (const d of P.away) {
      if (d.st === 'down') continue;
      const t = clamp(((d.x - from.x) * dx + (d.y - from.y) * dy) / L2, 0.08, 1);
      m = Math.min(m, Math.hypot(from.x + dx * t - d.x, from.y + dy * t - d.y));
    }
    return m;
  }
  function homeStep(P, p, dt) {
    const b = P.ball, c = P.ctrl, line = P.lineX;
    if (p.st === 'beaten' || p.st === 'down') { p.stT -= dt; if (p.stT <= 0) p.st = 'run'; }
    // the intended receiver goes to meet the ball
    if ((b.st === 'pass' || b.st === 'free') && b.to === p.id) {
      let tx = b.st === 'pass' ? b.tx : b.x + b.vx * 0.3, ty = b.st === 'pass' ? b.ty : b.y + b.vy * 0.3;
      if (b.st === 'pass') {
        // come to meet it: the earliest spot on its path (in the back half) he can get to before it does
        const uNow = (P.t - b.t0) / b.T;
        for (let k = 10; k <= 20; k++) {
          const u = k / 20;
          if (u < uNow + 0.05) continue;
          const pt = pathAt(b, u);
          if (pt.z > 1.4) continue;
          if (Math.max(0, Math.hypot(p.x - pt.x, p.y - pt.y) - 0.4) / p.spd < b.T * (u - uNow)) { tx = pt.x; ty = pt.y; break; }
        }
      }
      return steer(p, tx, ty, 1, dt);
    }
    if (b.st === 'free' && !b.to) {
      // a loose ball: the nearest two go for it
      const near = P.home.filter(q => !q.gk).sort((q1, q2) => dist(q1, b) - dist(q2, b)).slice(0, 2);
      if (near.includes(p)) return steer(p, b.x, b.y, 1, dt);
    }
    if (p.gk) return steer(p, clamp(b.x * 0.3, 4, 30), b.y * 0.12, 0.6, dt);
    const shift = clamp(carrierX(P) - 50, -15, 32);
    let sx = p.bx + shift * (p.role === 'ST' || p.role === 'W' ? 0.6 : 0.85), sy = p.by * 0.92 + b.y * 0.18;
    // running in behind: go until the ball's played or the run dies
    if (p.run) {
      p.run.t -= dt;
      if (p.run.t <= 0 || P.ball.st !== 'held') { if (P.ball.st === 'held' || p.run.t <= -1) p.run = null; }
      if (p.run) return steer(p, p.run.x, p.run.y, 1, dt);
    }
    const isFwd = p.role === 'ST' || p.role === 'W', off = offsideLine(P);
    // the front three live on the last defender's shoulder, ready to go; the midfielders stay a step under them
    if (isFwd) sx = carrierX(P) > 30 ? off - 0.6 : Math.min(sx, off - 0.6);
    else if (p.role === 'CM') sx = Math.min(sx, off - 4);
    // the two nearest find an angle: an open lane between you and them
    if (c && b.st === 'held' && c !== p) {
      const near = P.home.filter(q => q !== c && !q.gk && !q.run).sort((q1, q2) => dist(q1, c) - dist(q2, c)).slice(0, 2);
      if (near.includes(p)) {
        let best = null, bv = -1e9;
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU, cand = { x: clamp(sx + Math.cos(a) * 6, 4, LEN - 4), y: clamp(sy + Math.sin(a) * 6, -HALF + 2, HALF - 2) };
          if (isFwd || p.role === 'CM') cand.x = Math.min(cand.x, off - 0.6);
          const d = dist(cand, c);
          if (d < 8 || d > 24) continue;
          const v = Math.min(laneOpen(P, c, cand), 6) * 1.4 + (cand.x - c.x) * 0.06 - Math.abs(d - 14) * 0.08;
          if (v > bv) { bv = v; best = cand; }
        }
        if (best) { sx = best.x; sy = best.y; }
      }
      // forwards and wingers make runs in behind when you have time on the ball
      p.runT -= dt;
      const pressed = P.away.some(d => d.st === 'run' && dist(d, c) < 2.2);
      if ((isFwd || (p.role === 'CM' && P.r() < 0.004)) && p.runT <= 0 && !pressed && p.x > off - 4 && c.x > 35) {
        const lane = p.role === 'ST' ? sy * 0.5 : sy * 0.75;
        p.run = { x: Math.min(LEN - 6, line + 13 + P.r() * 6), y: clamp(lane + (P.r() - 0.5) * 8, -HALF + 4, HALF - 4), t: 2.6 };
        p.runT = 2.5 + P.r() * 3;
        P.fx.push({ k: 'run', id: p.id });
        // the man on him is watching the ball sometimes, and gives up a step (less often against a good defense)
        let mk = null, mkd = 12;
        for (const d of P.away) { if (d.gk || d.st !== 'run') continue; const k = dist(d, p); if (k < mkd) { mkd = k; mk = d; } }
        if (mk && P.r() < 0.65 - P.dif * 0.0045) mk.watchT = 0.35 + P.r() * 0.45;
      }
    }
    steer(p, sx, sy, p.run ? 1 : 0.75, dt, c ? toward(p, c) : null);
  }
  function lookUp(P) {
    // you held still to look: the forwards go now
    const line = P.lineX;
    for (const p of P.home) if ((p.role === 'ST' || p.role === 'W') && !p.run && p.x > offsideLine(P) - 6) { p.runT = Math.min(p.runT, P.r() * 0.4); }
  }

  // ------------------------------------------------------------------ the defense
  function awayStep(P, d, dt) {
    const b = P.ball, c = P.ctrl;
    if (d.st === 'beaten' || d.st === 'down') { d.stT -= dt; if (d.stT <= 0) d.st = 'run'; }
    if (d.watchT > 0) d.watchT -= dt;
    const goal = { x: LEN, y: 0 };
    if (d.gk) return keeperStep(P, d, dt);
    // a pass in the air: step into the lane if you can get there first
    if (b.st === 'pass' && d.st === 'run' && d.lane) return steer(d, d.lane.x, d.lane.y, 1, dt);
    if (b.st === 'free') {
      const near = P.away.filter(q => !q.gk).sort((q1, q2) => dist(q1, b) - dist(q2, b)).slice(0, 2);
      if (near.includes(d)) return steer(d, b.x, b.y, 1, dt);
    }
    const line = P.lineX, ref = b.st === 'held' && c ? c : b;
    // the block: the back four on the line, the midfield four 12 meters in front, the two strikers in front of the ball
    let tx = d.role === 'CB' ? line + 1 : d.role === 'FB' ? line : d.role === 'M' ? line - 12 : Math.max(ref.x + 4, line - 26);
    let ty = d.by * 0.75 + ref.y * 0.35;
    // the presser and the cover
    if (c && b.st === 'held') {
      const order = P.away.filter(q => !q.gk && q.st !== 'down').sort((q1, q2) => dist(q1, c) / q1.spd - dist(q2, c) / q2.spd);
      if (order[0] === d) {
        const u = toward(c, goal), px = c.x + Math.cos(u) * 1.1, py = c.y + Math.sin(u) * 1.1;
        steer(d, px, py, 0.97, dt, toward(d, c));
        d.tackleT -= dt;
        if (dist(d, c) < 1.6 && d.tackleT <= 0 && d.st === 'run') tackle(P, d, c);
        return;
      }
      if (order[1] === d) { const u = toward(c, goal); return steer(d, c.x + Math.cos(u) * 6, c.y + Math.sin(u) * 6 * 0.6, 0.9, dt, toward(d, c)); }
    }
    // mark the attacker in your zone, goal side; track a runner going in behind
    let mark = null, md = 9;
    for (const a of P.home) {
      if (a.gk || a === c) continue;
      const k = Math.hypot(a.x - tx, a.y - ty) * (a.run ? 0.6 : 1);
      if (k < md) { md = k; mark = a; }
    }
    if (mark && (mark.run ? dist(d, mark) < 12 : md < 7)) {
      const u = toward(mark, goal);
      const lag = mark.run ? Math.max(0, d.react) + (mark.x > d.x + 0.5 ? 0.25 : 0) : 0;
      tx = mark.x - mark.vx * lag + Math.cos(u) * 1.6; ty = mark.y - mark.vy * lag + Math.sin(u) * 1.2;
      if (!mark.run && (d.role === 'CB' || d.role === 'FB')) tx = Math.min(tx, Math.max(line, mark.x + 1));
    }
    steer(d, clamp(tx, 30, LEN - 2), clamp(ty, -HALF + 1, HALF - 1), d.watchT > 0 ? 0.35 : mark && mark.run ? 1 : 0.8, dt, toward(d, ref));
  }
  function tackle(P, d, c) {
    d.tackleT = 0.35;
    const cut = P.t - c.cutT < 0.35;
    // running straight into him is easy to take off you; going past him at an angle, or cutting as he comes, isn't
    const into = Math.abs(angDiff(c.h, toward(c, d))) < 0.55 && c.v > 1.5;
    const p = clamp(0.3 + (d.tck - c.ctl) / 200 + (c.v < 2 ? 0.1 : 0) + (into ? 0.18 : 0) - (cut ? 0.28 : 0) + (P.dif - 50) / 400, 0.04, 0.85);
    if (P.r() < p) {
      P.stats.tackled++;
      P.fx.push({ k: 'tackle', x: c.x, y: c.y });
      return end(P, 'tackled', d);
    }
    // he went for it and missed: you're past him
    d.st = 'beaten'; d.stT = 0.6; d.v *= 0.3;
    P.stats.beat++;
    P.fx.push({ k: 'beat', x: d.x, y: d.y });
  }
  function keeperStep(P, k, dt) {
    const b = P.ball;
    // a shot: he's set until he reads it, then he dives
    if (P.shot) { if (P.t - P.shot.t0 >= P.shot.keeper.react) return diveStep(P, k, dt); k.v = 0; return; }
    // come for a through ball he can get to first
    if (b.st === 'pass' && b.tx > BOX_X && Math.abs(b.ty) < BOX_HW) {
      const tBall = b.t0 + b.T - P.t, tMe = 0.25 + Math.hypot(k.x - b.tx, k.y - b.ty) / k.spd;
      if (tMe < tBall + 0.15) return steer(k, b.tx, b.ty, 1, dt);
    }
    if (b.st === 'free' && b.x > BOX_X + 4 && Math.abs(b.y) < BOX_HW - 4) return steer(k, b.x, b.y, 1, dt);
    // on the line between the ball and the goal, a few meters off his line
    const ref = b.st === 'held' && P.ctrl ? P.ctrl : b;
    const dd = Math.hypot(LEN - ref.x, ref.y);
    const off = clamp(dd * 0.09, 0.8, 4.5), u = Math.atan2(ref.y, ref.x - LEN);
    steer(k, LEN + Math.cos(u) * off, Math.sin(u) * off, 0.6, dt, toward(k, ref));
  }

  // ------------------------------------------------------------------ the ball
  function bez(a, c, b, u) { return (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b; }
  // where a pass is at a fraction u of its flight time: a ground pass is quick off the foot and slows as it rolls
  const ease = (b, u) => (b.lofted ? u : 1 - Math.pow(1 - u, 1.35));
  function pathAt(b, u) { const e = ease(b, u); return { x: bez(b.fx, b.cx, b.tx, e), y: bez(b.fy, b.cy, b.ty, e), z: b.lofted ? 4 * b.peak * u * (1 - u) : 0 }; }
  function launch(P, kind, tx, ty, opts) {
    const c = P.ctrl, b = P.ball;
    const fx = b.x, fy = b.y, d = Math.max(2, Math.hypot(tx - fx, ty - fy));
    const ux = (tx - fx) / d, uy = (ty - fy) / d;
    const curl = clamp(opts.curl || 0, -1, 1);
    const cx = (fx + tx) / 2 - uy * curl * d * 0.22, cy = (fy + ty) / 2 + ux * curl * d * 0.22;
    let T, peak = 0, vEnd;
    if (kind === 'shot') { T = d / (17 + 11 * opts.zip); peak = opts.z * 0.5 + 0.3; vEnd = 17 + 11 * opts.zip; }
    else if (opts.lofted) { T = 0.5 + d / (18 + 8 * opts.zip); peak = clamp(2.5 + d * 0.09, 3, 11); vEnd = 7; }
    else {
      vEnd = 5 + 8 * opts.zip;
      const v0 = clamp(Math.sqrt(vEnd * vEnd + 2 * ROLL * d), 8, 28);
      vEnd = Math.sqrt(Math.max(0, v0 * v0 - 2 * ROLL * d));
      T = (v0 - vEnd) / ROLL;
    }
    P.ball = { st: kind === 'shot' ? 'shot' : 'pass', fx, fy, cx, cy, tx, ty, tz: kind === 'shot' ? opts.z : 0, T, t0: P.t, peak, vEnd, to: opts.to || null, from: c.id,
      offside: !!opts.offside, x: fx, y: fy, z: 0.11, touched: {}, lofted: !!opts.lofted, curl };
    c.v *= 0.6;
    // the defense reads the pass: anybody who can beat the ball to a point on its path goes for it
    if (kind === 'pass') {
      const m = opts.to ? P.by[opts.to] : null, b2 = P.ball;
      for (const d of P.away) {
        d.lane = null;
        if (d.gk || d.st !== 'run') continue;
        for (let k = 1; k <= 10; k++) {
          const u = k / 10, pt = pathAt(b2, u);
          if (pt.z > 2.2) continue;
          const tBall = T * u, tMe = Math.max(0, d.react) + Math.max(0, Math.hypot(d.x - pt.x, d.y - pt.y) - 0.9) / d.spd;
          const tHim = m ? Math.max(0, Math.hypot(m.x - pt.x, m.y - pt.y) - 0.4) / m.spd : 9;
          if (tMe < tBall && tMe < tHim) { d.lane = { x: pt.x, y: pt.y }; break; }
        }
      }
    }
  }
  function ballStep(P, dt) {
    const b = P.ball;
    if (b.st === 'held') {
      const c = P.by[b.holder];
      b.x = c.x + Math.cos(c.h) * 0.55; b.y = c.y + Math.sin(c.h) * 0.55; b.z = 0.11;
      return;
    }
    if (b.st === 'pass' || b.st === 'shot') {
      const u = Math.min(1, (P.t - b.t0) / b.T);
      // a ground pass slows as it rolls: ease the travel so it's fast off the foot and slower at the end
      const e = b.st === 'pass' && !b.lofted ? 1 - Math.pow(1 - u, 1.35) : u;
      b.x = bez(b.fx, b.cx, b.tx, e); b.y = bez(b.fy, b.cy, b.ty, e);
      b.z = b.st === 'shot' ? lerp(0.11, b.tz, u) + b.peak * 4 * u * (1 - u) * 0.6 : b.lofted ? 0.11 + 4 * b.peak * u * (1 - u) : 0.11;
      if (b.st === 'shot') return shotStep(P, u);
      touches(P);
      if (P.ball !== b || b.st !== 'pass') return;
      if (u >= 1) {
        // nobody got to it: it rolls on
        const ex = b.tx - b.cx, ey = b.ty - b.cy, el = Math.hypot(ex, ey) || 1;
        P.ball = { st: 'free', x: b.x, y: b.y, z: 0.11, vx: (ex / el) * Math.max(2, b.vEnd), vy: (ey / el) * Math.max(2, b.vEnd), vz: 0, to: b.to, touched: b.touched, offside: b.offside, from: b.from };
      }
      return;
    }
    if (b.st === 'free') {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - ROLL * 1.3 * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
      if (b.z > 0.11 || b.vz) { b.vz -= GRAV * dt; b.z += b.vz * dt; if (b.z < 0.11) { b.z = 0.11; b.vz = Math.abs(b.vz) > 1.5 ? -b.vz * 0.45 : 0; } }
      b.x += b.vx * dt; b.y += b.vy * dt;
      touches(P);
      if (P.phase !== 'live') return;
      if (Math.abs(b.y) > HALF || b.x > LEN || b.x < 0) return end(P, 'out');
      if (sp < 0.3 && P.t - (b.t || 0) > 3) b.to = null;
    }
  }
  // who gets to a moving ball: your man controls it (or takes a heavy touch), theirs cuts it out (or deflects it)
  function touches(P) {
    const b = P.ball;
    if (b.z > 1.7) return;
    const sp = b.st === 'pass' ? passSpeed(P, b) : Math.hypot(b.vx, b.vy);
    let best = null, bd = 99;
    for (const p of P.players) {
      if (p.st === 'down' || b.touched[p.id] || (b.st === 'pass' && p.id === b.from && P.t - b.t0 < 0.35) || (b.st === 'free' && p.id === b.from && P.t - (b.t || 0) < 0.4)) continue;
      if (b.st === 'pass' && p.team === 'A' && P.t - b.t0 < 0.25) {
        const ux = b.tx - b.fx, uy = b.ty - b.fy, L = Math.hypot(ux, uy) || 1;
        if (((p.x - b.fx) * ux + (p.y - b.fy) * uy) / L < 0.25) continue;
      }
      const reach = (p.gk ? 1.4 : 0.85) + p.ctl * 0.003;
      const k = Math.hypot(p.x - b.x, p.y - b.y);
      if (k < reach && k < bd) { bd = k; best = p; }
    }
    if (!best) return;
    const p = best;
    b.touched[p.id] = true;
    if (p.team === 'A') {
      const pc = p.gk ? 0.9 : clamp(0.78 - (sp - 13) * 0.035 + (p.tck - 60) / 200, 0.25, 0.95);
      if (P.r() < pc) { P.log.push(p.gk ? 'keeper claimed it' : 'intercepted'); P.fx.push({ k: 'steal', x: p.x, y: p.y }); return end(P, p.gk ? 'claimed' : 'intercepted', p); }
      // a toe on it: the ball squirts off somewhere
      const a = Math.atan2(b.st === 'pass' ? b.ty - b.y : b.vy, b.st === 'pass' ? b.tx - b.x : b.vx) + (P.r() - 0.5) * 2.4, s = sp * 0.4;
      P.ball = { st: 'free', x: b.x, y: b.y, z: 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 1.5, to: null, touched: { [p.id]: true }, t: P.t };
      P.log.push('deflected'); P.fx.push({ k: 'deflect', x: b.x, y: b.y });
      return;
    }
    // yours: offside if he was off when it was played
    if (b.offside && b.to === p.id) { P.log.push('offside'); P.fx.push({ k: 'flag', x: p.x, y: p.y }); return end(P, 'offside', p); }
    const clean = clamp(0.95 - Math.max(0, sp - 14) * 0.05 + (p.ctl - 70) / 220, 0.35, 0.99);
    if (P.r() < clean || p.gk) {
      receive(P, p, b.st === 'pass' && b.from !== p.id);
    } else {
      // a heavy first touch: it gets away from him a few meters
      const a = p.h + (P.r() - 0.5) * 1.2;
      P.ball = { st: 'free', x: b.x, y: b.y, z: 0.11, vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5, vz: 0, to: p.id, touched: {}, t: P.t };
      P.log.push('heavy touch'); P.fx.push({ k: 'heavy', x: p.x, y: p.y });
    }
  }
  // can anybody cut this pass out? the smallest head start the ball has on a defender getting to its path (negative: he
  // gets there first). Same timing the defense uses when the ball is played.
  function passRisk(P, from, to, lofted, zip, m) {
    zip = zip == null ? 0.5 : zip;
    const d = Math.max(2, Math.hypot(to.x - from.x, to.y - from.y));
    let T;
    if (lofted) T = 0.5 + d / (18 + 8 * zip);
    else { let vEnd = 5 + 8 * zip; const v0 = clamp(Math.sqrt(vEnd * vEnd + 2 * ROLL * d), 8, 28); vEnd = Math.sqrt(Math.max(0, v0 * v0 - 2 * ROLL * d)); T = (v0 - vEnd) / ROLL; }
    const peak = clamp(2.5 + d * 0.09, 3, 11);
    let margin = 9;
    const ux = (to.x - from.x) / d, uy = (to.y - from.y) / d;
    for (const df of P.away) {
      if (df.st !== 'run') continue;
      const along = (df.x - from.x) * ux + (df.y - from.y) * uy, side = Math.abs(-(df.x - from.x) * uy + (df.y - from.y) * ux);
      if (!df.gk && along > 0.25 && along < 3 && side < 1.1) margin = Math.min(margin, -0.5);
      for (let k = 1; k <= 10; k++) {
        const u = k / 10, z = lofted ? 4 * peak * u * (1 - u) : 0;
        if (z > 2.2 && !(df.gk && u > 0.85)) continue;
        const e = lofted ? u : 1 - Math.pow(1 - u, 1.35);
        const px = lerp(from.x, to.x, e), py = lerp(from.y, to.y, e);
        const tMe = Math.max(0, df.react) + Math.max(0, Math.hypot(df.x - px, df.y - py) - 0.9) / df.spd;
        const tHim = m ? Math.max(0, Math.hypot(m.x - px, m.y - py) - 0.4) / m.spd : 9;
        margin = Math.min(margin, tMe - Math.min(T * u, tHim));
      }
    }
    return margin;
  }
  function passSpeed(P, b) {
    const u = Math.min(1, (P.t - b.t0) / b.T);
    const L = Math.hypot(b.tx - b.fx, b.ty - b.fy);
    return b.lofted ? L / b.T : Math.max(b.vEnd, (L / b.T) * 1.35 * Math.pow(1 - u, 0.35));
  }
  function receive(P, p, completed) {
    P.ball = { st: 'held', holder: p.id, x: p.x, y: p.y, z: 0.11 };
    if (completed) { P.stats.done++; P.fx.push({ k: 'receive', id: p.id, x: p.x, y: p.y }); }
    P.ctrl = p; p.run = null; p.st = 'run';
    // his first touch: nobody gets to dive in on the same instant he takes it
    for (const d of P.away) { d.lane = null; d.tackleT = Math.max(d.tackleT, 0.45); }
  }

  // ------------------------------------------------------------------ you on the ball
  function carrierStep(P, c, inp, dt) {
    if (c.st === 'beaten') c.st = 'run';
    const top = c.spd * 0.8;
    if (inp.drag) {
      const tx = clamp(inp.drag.x, 0.5, LEN - 0.5), ty = clamp(inp.drag.y, -HALF + 0.5, HALF - 0.5);
      const want = Math.atan2(ty - c.y, tx - c.x), dd = Math.hypot(tx - c.x, ty - c.y);
      if (dd > 0.4) {
        const diff = angDiff(c.h, want), rate = 3.4 + 5.5 * c.agi, turn = clamp(diff, -rate * dt, rate * dt);
        if (Math.abs(diff) > 0.9 && c.v > 2.5) c.cutT = P.t;                 // a sharp cut: a defender diving in now misses
        c.h += turn; c.v *= 1 - Math.min(0.5, Math.abs(turn) * (0.45 - 0.2 * c.agi));
        c.v += clamp(Math.min(top, dd * 2.2) - c.v, -9 * dt, 6.5 * dt);
      } else c.v = Math.max(0, c.v - 8 * dt);
    } else c.v = Math.max(0, c.v - 7 * dt);                                     // nothing drawn: he slows and shields it
    c.vx = Math.cos(c.h) * c.v; c.vy = Math.sin(c.h) * c.v;
    c.x += c.vx * dt; c.y += c.vy * dt; c.anim += c.v * dt * 1.5; c.face = c.h;
    if (inp.fake) fake(P, c);
    if (inp.flick) kick(P, c, inp.flick);
  }
  function fake(P, c) {
    P.stats.fakes++;
    P.fx.push({ k: 'fake', x: c.x, y: c.y });
    for (const d of P.away) {
      if (d.gk || d.st !== 'run' || dist(d, c) > 3.2) continue;
      if (P.r() < 0.42 + (c.ctl - d.tck) / 300) { d.st = 'beaten'; d.stT = 0.55; P.stats.beat++; P.fx.push({ k: 'bite', x: d.x, y: d.y }); }
      d.lane = null;
    }
  }
  // the spot to play it so he meets it in stride: on his run if he's making one
  function leadFor(P, m, from, lofted, zip) {
    let T = 0.6, px = m.x, py = m.y;
    for (let i = 0; i < 5; i++) {
      if (m.run) {
        // along his run, and a few meters past the end of it (he keeps going if it's played ahead of him)
        const rl = Math.hypot(m.run.x - m.x, m.run.y - m.y) || 0.1, go = Math.min(m.spd * T, rl + 4);
        px = m.x + ((m.run.x - m.x) / rl) * go; py = m.y + ((m.run.y - m.y) / rl) * go;
      } else {
        // where he's drifting, not too far: nobody keeps the same line for two seconds
        const k = Math.min(T, 0.8);
        px = m.x + m.vx * k; py = m.y + m.vy * k;
      }
      const d = Math.hypot(px - from.x, py - from.y);
      T = lofted ? 0.5 + d / (18 + 8 * zip) : d / (9 + 7 * zip);
    }
    return { x: clamp(px, 1, LEN - 1), y: clamp(py, -HALF + 1, HALF - 1), T };
  }
  // a flick: at the goal from in range, it's a shot; otherwise a pass, to the teammate you flicked toward (casual) or
  // to the spot (pro); long ones go in the air
  function kick(P, c, f) {
    const zip = clamp(f.zip == null ? 0.5 : f.zip, 0, 1), curl = clamp(f.curl || 0, -1, 1), dir = f.dir;
    const toPostL = Math.atan2(-GOAL_HW - c.y, LEN - c.x), toPostR = Math.atan2(GOAL_HW - c.y, LEN - c.x), dGoal = Math.hypot(LEN - c.x, c.y);
    const lo = Math.min(toPostL, toPostR) - 0.12, hi = Math.max(toPostL, toPostR) + 0.12;
    if (dGoal < 34 && dir > lo && dir < hi && c.x < LEN) return shoot(P, c, dir, zip, curl);
    let target = null;
    if (P.assist === 'casual') {
      let bd = 0.42;
      for (const m of P.home) {
        if (m === c || m.gk || m.st === 'down') continue;
        const far = dist(m, c) > 27;
        const L = leadFor(P, m, c, far, zip), a = Math.atan2(L.y - c.y, L.x - c.x), dd = Math.abs(angDiff(dir, a));
        // closer to the flick's direction wins; the flick's length breaks ties between two in line
        const score = dd + Math.abs(Math.hypot(L.x - c.x, L.y - c.y) - (f.dist || 15)) * 0.004;
        if (score < bd) { bd = score; target = { m, L, lofted: far }; }
      }
      // over the top or along the floor, whichever one gets there
      if (target && dist(target.m, c) > 16) {
        const m = target.m, other = !target.lofted, L2 = leadFor(P, m, c, other, zip);
        if (passRisk(P, c, L2, other, zip, m) > passRisk(P, c, target.L, target.lofted, zip, m) + 0.1) target = { m, L: L2, lofted: other };
      }
    }
    P.stats.passes++;
    const line = offsideLine(P);
    if (target) {
      const m = target.m;
      const off = P.offside && m.x > line + 0.3 && m.x > c.x && m.x > 52.5;
      launch(P, 'pass', target.L.x, target.L.y, { zip, curl, to: m.id, lofted: target.lofted, offside: off });
      P.fx.push({ k: 'pass', from: c.id, to: m.id, x: c.x, y: c.y });
      P.lastPass = { to: m.id, open: laneOpen(P, c, target.L), run: !!m.run };
    } else {
      const dd = clamp(f.dist || 15, 5, 50), tx = clamp(c.x + Math.cos(dir) * dd, 1, LEN + 2), ty = clamp(c.y + Math.sin(dir) * dd, -HALF - 1, HALF + 1);
      // it's for whoever can get on the end of it first: a runner going that way, or the man nearest the spot
      const lofted = dd > 27, T = lofted ? 0.5 + dd / (18 + 8 * zip) : dd / (9 + 7 * zip);
      let to = null, bd = 1.2;
      for (const m of P.home) {
        if (m === c || m.gk) continue;
        const k = Math.max(0, Math.hypot(m.x - tx, m.y - ty) - 1) / m.spd - T + (P.offside && m.x > line + 0.3 && m.x > c.x ? 0.6 : 0);
        if (k < bd) { bd = k; to = m; }
      }
      const off = !!to && P.offside && to.x > line + 0.3 && to.x > c.x && to.x > 52.5;
      launch(P, 'pass', tx, ty, { zip, curl, to: to ? to.id : null, lofted, offside: off });
      P.fx.push({ k: 'pass', from: c.id, to: to ? to.id : null, x: c.x, y: c.y });
      P.lastPass = { to: to ? to.id : null, open: laneOpen(P, c, { x: tx, y: ty }), run: !!(to && to.run) };
    }
    P.ctrl = null;
    // after he plays it, he goes
    if (P.r() < 0.5 && c.x > 30) c.run = { x: Math.min(LEN - 10, c.x + 12), y: clamp(c.y * 0.7, -HALF + 4, HALF - 4), t: 1.6 };
  }
  function shoot(P, c, dir, zip, curl) {
    const r = P.r, d = Math.hypot(LEN - c.x, c.y);
    let pressed = 0;
    for (const df of P.away) if (!df.gk && df.st === 'run') pressed = Math.max(pressed, clamp(1 - (dist(df, c) - 0.8) / 2.5, 0, 1));
    // harder is higher: a placed finish stays low, a full blast can fly over
    let y = c.y + Math.tan(dir) * (LEN - c.x), z = 0.15 + zip * zip * 2.4;
    const sd = (0.35 + d * 0.03) * (1.25 - (c.sho - 40) / 120) * (1 + pressed * 0.6);
    y += gauss(r) * sd + curl * 0.6; z = Math.max(0.1, z + gauss(r) * sd * 0.5);
    P.stats.shots++;
    P.shot = { y, z, d, zip, t0: P.t, res: null, by: c.id, aimY: c.y + Math.tan(dir) * (LEN - c.x) };
    launch(P, 'shot', LEN, y, { zip, curl, z });
    P.ctrl = null;
    P.fx.push({ k: 'shot', id: c.id, x: c.x, y: c.y });
    // the keeper picks a side after his reaction
    const k = P.by.aGK, react = clamp(0.2 + d * 0.004 - (P.dif - 50) * 0.002, 0.1, 0.4);
    P.shot.keeper = { react, x0: k.x, y0: k.y };
  }
  function shotStep(P, u) {
    const b = P.ball, s = P.shot, k = P.by.aGK;
    // blocks: a defender in the lane early on
    if (u < 0.75 && b.z < 1.8 && !s.blockTried) {
      for (const d of P.away) {
        if (d.gk || d.st !== 'run' || b.touched[d.id]) continue;
        if (Math.hypot(d.x - b.x, d.y - b.y) < 0.75) {
          b.touched[d.id] = true;
          if (P.r() < 0.65) {
            P.log.push('blocked'); P.fx.push({ k: 'block', x: b.x, y: b.y });
            const a = Math.PI + (P.r() - 0.5) * 2;
            P.ball = { st: 'free', x: b.x, y: b.y, z: 0.4, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, vz: 2, to: null, touched: { [d.id]: true }, t: P.t, from: b.from };
            P.shot = null;
            return;
          }
        }
      }
    }
    if (u >= 1) return finishShot(P);
  }
  function diveStep(P, k, dt) {
    const s = P.shot;
    const ty = clamp(s.y, -GOAL_HW - 0.5, GOAL_HW + 0.5);
    // a dive covers a couple of meters at most, quick off the mark
    const sp = 4 + P.dif * 0.012, maxDive = 2.1 + P.dif * 0.008;
    const dy = clamp(ty, s.keeper.y0 - maxDive, s.keeper.y0 + maxDive) - k.y, mv = sp * dt;
    k.y += clamp(dy, -mv, mv);
    k.face = Math.PI; k.dive = clamp((k.y - s.keeper.y0) / maxDive, -1, 1);
  }
  function finishShot(P) {
    const s = P.shot, k = P.by.aGK, b = P.ball;
    P.lastShot = { y: s.y, z: s.z, d: s.d, by: s.by, keeperY: k.y };
    const y = s.y, z = s.z;
    const inGoal = Math.abs(y) < GOAL_HW - 0.11 && z < GOAL_H - 0.11;
    const post = !inGoal && Math.abs(Math.abs(y) - GOAL_HW) < 0.2 && z < GOAL_H + 0.1;
    P.shot = null;
    if (!inGoal && !post) { P.log.push(z >= GOAL_H ? 'over' : 'wide'); return end(P, z >= GOAL_H ? 'over' : 'wide'); }
    P.stats.onTarget++;
    // could he get to it: as far as his dive took him plus a hand; up high he has to stretch
    const reach = 0.55 - Math.max(0, z - 1.8) * 0.5 + P.dif * 0.002;
    const gap = Math.abs(k.y - y);
    if (gap < reach || post) {
      if (post && gap >= reach) { P.log.push('post'); P.fx.push({ k: 'post', x: LEN, y }); return end(P, 'post'); }
      // saved: held, or parried out for somebody to follow up
      const hold = s.zip < 0.55 && gap < reach * 0.6;
      P.fx.push({ k: 'save', x: k.x, y: k.y });
      if (hold) { P.log.push('saved and held'); return end(P, 'saved', k); }
      P.log.push('parried');
      const a = Math.PI + (P.r() - 0.5) * 1.6;
      P.ball = { st: 'free', x: LEN - 1.2, y: k.y, z: 0.5, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, vz: 2.5, to: null, touched: { [k.id]: true }, t: P.t };
      return;
    }
    P.fx.push({ k: 'goal', x: LEN, y });
    end(P, 'goal');
  }

  // ------------------------------------------------------------------ the end of an attack
  function end(P, how, by) {
    if (P.phase !== 'live') return;
    P.phase = 'over';
    const b = P.ball;
    if (b.st === 'held' && how !== 'goal') { const c = P.by[b.holder]; P.ball = { st: 'dead', x: b.x, y: b.y, z: 0.11 }; c.v = 0; }
    else if (how !== 'goal') P.ball = Object.assign({}, b, { st: 'dead' });
    P.result = { how, by: by ? by.id : null, stats: Object.assign({}, P.stats), lastPass: P.lastPass || null, lastShot: P.lastShot || null, log: P.log.slice(), x: b.x, y: b.y, t: P.t };
    P.fx.push({ k: how === 'goal' ? 'goalFx' : 'whistle' });
  }

  // ------------------------------------------------------------------ the step
  function tick(P, inp, dt) {
    P.t += dt;
    if (P.phase !== 'live') {
      for (const p of P.players) { p.v *= 1 - 3 * dt; p.x += Math.cos(p.h) * p.v * dt; p.y += Math.sin(p.h) * p.v * dt; }
      if (P.result && P.result.how === 'goal' && (P.ball.st === 'shot')) { const b = P.ball; b.x = Math.min(LEN + 1.6, b.x + 8 * dt); b.z = Math.max(0.11, b.z - 1.5 * dt); }
      return;
    }
    P.timeLeft -= dt;
    if (P.timeLeft <= 0) return end(P, 'time');
    P.lineX = lineHeight(P);
    const c = P.ctrl;
    if (c && P.ball.st === 'held') carrierStep(P, c, inp, dt);
    if (P.phase !== 'live') return;
    for (const p of P.home) if (p !== c || P.ball.st !== 'held') homeStep(P, p, dt);
    for (const d of P.away) awayStep(P, d, dt);
    if (P.phase !== 'live') return;
    ballStep(P, dt);
    // a loose ball that one of yours ends up on becomes your ball
    if (P.phase === 'live' && P.ball.st === 'held' && P.ctrl == null) P.ctrl = P.by[P.ball.holder];
  }
  function step(P, dtReal, inp, scale) {
    inp = inp || {};
    let left = Math.min(dtReal, 0.1) * (scale || 1), first = true;
    while (left > 1e-6) {
      const h = Math.min(DT, left);
      tick(P, first ? inp : { drag: inp.drag }, h);
      first = false; left -= h;
    }
  }

  return { LEN, HALF, GOAL_HW, GOAL_H, BOX_X, BOX_HW, create, step, lookUp, offsideLine, laneOpen, passRisk, leadFor, pathAt, dist, angDiff, clamp };
})();
if (typeof module !== 'undefined') module.exports = SC;
