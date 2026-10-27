/* Ball physics and the shot model.
   The flick decides intent (aim and touch); the physics decides the outcome,
   so a near-miss rattles around the rim instead of being a coin flip. */
const HoopPhysics = (() => {
  const { RIM, BOARD, BALL_R, V } = Court3D;
  const G = 32.17;
  const RIM_TUBE = 0.035;
  const STEP = 1 / 240;

  function newBall(p, v, opts) {
    return Object.assign({
      p: p.slice(), v: v.slice(), rot: 0, spin: -9, prevY: p[1], t: 0, touch: 0, spinOut: 0,
      rimHits: 0, boardHits: 0, bounces: 0, scored: false, done: false, result: null, events: []
    }, opts || {});
  }

  function step(b, dt, court) {
    // a spun layup sits softer on the rim
    const e = court.rimE * (1 - 0.25 * b.touch), fr = court.rimFr;
    b.prevY = b.p[1];
    b.v[1] -= G * dt;
    b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
    b.rot += b.spin * dt;
    b.t += dt;

    // rim: a thin ring; collide with the closest point on it
    const rx = b.p[0] - RIM.x, rz = b.p[2] - RIM.z;
    const hd = Math.hypot(rx, rz);
    if (hd > 1e-5 && Math.abs(b.p[1] - RIM.y) < 1) {
      const qx = RIM.x + rx / hd * RIM.r, qz = RIM.z + rz / hd * RIM.r, qy = RIM.y;
      const dx = b.p[0] - qx, dy = b.p[1] - qy, dz = b.p[2] - qz;
      const dist = Math.hypot(dx, dy, dz), minD = BALL_R + RIM_TUBE;
      if (dist < minD && dist > 1e-6) {
        const n = [dx / dist, dy / dist, dz / dist];
        b.p = [qx + n[0] * minD, qy + n[1] * minD, qz + n[2] * minD];
        const vn = V.dot(b.v, n);
        if (vn < 0) {
          const vt = V.sub(b.v, V.mul(n, vn));
          b.v = V.add(V.mul(vt, 1 - fr), V.mul(n, -vn * e));
          if (b.touch) {
            // shooter's roll: spin carries a ball sitting on the rim toward the middle
            b.v = V.add(b.v, [-rx / hd * 1.1 * b.touch, 0, -rz / hd * 1.1 * b.touch]);
          }
          if (b.spinOut) {
            // too much spin grabs the rim and throws the ball off it
            const out = [rx / hd, 0, rz / hd], tan = [-rz / hd, 0, rx / hd];
            b.v = V.add(b.v, V.add(V.mul(out, Math.abs(b.spinOut) * 1.6), V.mul(tan, b.spinOut * 1.2)));
            b.spinOut *= 0.5;
          }
          b.rimHits++;
          b.spin *= -0.6;
          if (-vn > 2) b.events.push({ type: 'rim', s: Math.min(1, -vn / 14) });
        }
      }
    }
    // backboard face (and the back of it, for shots from behind)
    const inBoard = b.p[0] > BOARD.x0 - BALL_R * 0.5 && b.p[0] < BOARD.x1 + BALL_R * 0.5 && b.p[1] > BOARD.y0 - BALL_R * 0.5 && b.p[1] < BOARD.y1 + BALL_R * 0.5;
    if (inBoard && b.v[2] < 0 && b.p[2] - BALL_R < BOARD.z && b.p[2] > BOARD.z - 0.4) {
      b.p[2] = BOARD.z + BALL_R;
      b.v[2] = -b.v[2] * 0.6; b.v[0] *= 0.88; b.v[1] *= 0.88;
      b.boardHits++;
      b.events.push({ type: 'board' });
    }
    // floor
    if (b.p[1] < BALL_R) {
      b.p[1] = BALL_R;
      if (b.v[1] < 0) {
        const s = -b.v[1];
        b.v[1] = s * 0.66; b.v[0] *= 0.82; b.v[2] *= 0.82;
        b.bounces++;
        if (s > 3) b.events.push({ type: 'bounce', s: Math.min(1, s / 25) });
      }
    }
    // through the hoop
    if (!b.scored && b.prevY >= RIM.y && b.p[1] < RIM.y && b.v[1] < 0 && hd < RIM.r) {
      b.scored = true;
      b.swish = b.rimHits === 0 && b.boardHits === 0;
      b.events.push({ type: 'score', swish: b.swish });
    }
    // net drag pulls a made ball straight down
    if (b.scored && b.p[1] < RIM.y && b.p[1] > RIM.y - 1.7) {
      const k = Math.min(1, 7 * dt);
      b.v[0] *= 1 - k; b.v[2] *= 1 - k; b.v[1] *= 1 - k * 0.5;
      b.p[0] += (RIM.x - b.p[0]) * k; b.p[2] += (RIM.z - b.p[2]) * k;
    }
  }

  function advance(b, dt, court) {
    let t = dt;
    while (t > 1e-6) { const h = Math.min(STEP, t); step(b, h, court); t -= h; }
    if (!b.result) {
      if (b.scored && b.p[1] < RIM.y - 2.2) b.result = 'made';
      else if (!b.scored && (b.bounces > 0 || b.t > 4.5 || b.p[2] < -8)) b.result = 'miss';
      else if (!b.scored && b.p[1] < RIM.y - 1.5 && Math.hypot(b.p[0] - RIM.x, b.p[2] - RIM.z) > RIM.r + 0.3 && b.v[1] < 0 && b.rimHits + b.boardHits > 0) b.result = 'miss';
    }
    if (b.result && !b.doneAt) b.doneAt = b.t;
    if (b.doneAt && b.t - b.doneAt > 1.6) b.done = true;
  }

  // Initial velocity that carries the ball from `from` to `to` at launch angle theta (radians).
  function solve(from, to, theta) {
    const dx = to[0] - from[0], dz = to[2] - from[2];
    const D = Math.hypot(dx, dz), h = to[1] - from[1];
    const c = Math.cos(theta), tn = Math.tan(theta);
    const den = 2 * c * c * (D * tn - h);
    if (den <= 0) return null;
    const v = Math.sqrt(G * D * D / den);
    const hx = dx / D, hz = dz / D;
    return { v, vec: [hx * v * c, v * Math.sin(theta), hz * v * c], D };
  }
  function rotateY(vec, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return [vec[0] * c + vec[2] * s, vec[1], -vec[0] * s + vec[2] * c];
  }

  /* Spin from a layup flick's curl. A little curl (about a tenth of the
     flick's length) puts touch on it: it sits soft on the rim. A big hook
     spins it out. Straight flicks are plain layups. */
  function spinFromCurl(curl) {
    const c = Math.abs(curl || 0), sgn = Math.sign(curl || 0) || 1;
    if (c < 0.035) return { touch: 0, out: 0, label: null };
    if (c < 0.1) return { touch: (c - 0.035) / 0.065, out: 0, label: 'spin', sgn };
    if (c < 0.26) return { touch: 1, out: 0, label: 'spin', sgn };
    const over = Math.min(1, (c - 0.26) / 0.14);
    return { touch: Math.max(0, 1 - over * 1.5), out: over * sgn, label: 'overspin', sgn };
  }

  /* From the side, layups go off the glass. Search the board for the spot that
     drops it in, then check the best few with the real physics. */
  const bankCache = new Map();
  function solveBank(release, court) {
    const key = release.map(v => v.toFixed(2)).join(',') + court.id;
    if (bankCache.has(key)) return bankCache.get(key);
    const bz = BOARD.z + BALL_R;
    const cands = [];
    for (const by of [10.7, 11.0, 11.3]) for (const th of [50, 56, 62, 68]) for (let i = 0; i <= 64; i++) {
      const bx = -1.6 + i * 0.05;
      const sol = solve(release, [bx, by, bz], th * Math.PI / 180);
      if (!sol) continue;
      const t1 = sol.D / Math.hypot(sol.vec[0], sol.vec[2]);
      const vin = [sol.vec[0], sol.vec[1] - G * t1, sol.vec[2]];
      if (vin[2] >= -0.5) continue;
      const v2 = [vin[0] * 0.88, vin[1] * 0.88, -vin[2] * 0.6];
      const disc = v2[1] * v2[1] + 2 * G * (by - RIM.y);
      if (disc < 0) continue;
      const t2 = (v2[1] + Math.sqrt(disc)) / G;
      cands.push({ err: Math.hypot(bx + v2[0] * t2 - RIM.x, bz + v2[2] * t2 - (RIM.z + 0.02)), vec: sol.vec });
    }
    cands.sort((a, b) => a.err - b.err);
    let best = null;
    for (const c of cands.slice(0, 10)) {
      const b = simulate(release, c.vec, court);
      if (b.result === 'made' && b.boardHits > 0 && b.rimHits === 0) { best = c; break; }
      if (!best && b.result === 'made' && b.boardHits > 0) best = c;
    }
    if (bankCache.size > 300) bankCache.clear();
    bankCache.set(key, best);
    return best;
  }

  // Where the ball leaves the hand: up at the top of the jump, a step toward the rim.
  function releasePoint(shooter, type) {
    const dir = Court3D.dirToRim(shooter);
    return [shooter[0] + dir[0] * 0.6, type.from, shooter[2] + dir[2] * 0.6];
  }

  // Shot types by distance from the rim.
  function shotType(dist) {
    // in close, a layup is lofted higher so it comes down over the front rim
    if (dist < 5.5) return { id: 'layup', label: 'Layup', theta: Math.min(78, 58 + Math.max(0, 5.5 - dist) * 7), from: 8.4 + Math.max(0, 4.5 - dist) * 0.3, aimBack: 0.08 };
    if (dist < 11) return { id: 'floater', label: 'Floater', theta: 56, from: 7.8, aimBack: 0.12 };
    return { id: 'jumper', label: 'Jumper', theta: 50, from: 7.5, aimBack: 0.14 };
  }

  // The touch curve: how hard you flick, relative to your free throw, for each distance.
  const FT_DIST = 13.75;
  function idealFlick(dist) { return 0.5 + 0.5 * (dist / FT_DIST); }

  // gauss
  function gauss(rand) { const r = rand || Math.random; let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // A fadeaway leaves the hand from behind your spot, a little higher and with
  // more arc, so it plays about a foot and a half longer than a set shot.
  const FADE_BACK = 0.9, FADE_EXTRA = 1.5;
  function fadeType(dist) {
    const t = dist < 11 ? { id: 'jumper', label: 'Jumper', theta: 50, from: 7.5, aimBack: 0.14 } : shotType(dist);
    return Object.assign({}, t, { theta: t.theta + 3, from: t.from + 0.3 });
  }

  /* Turn a flick into a launched ball.
     q: { shooter, flickSpeed, angle (rad), curl, fade, touchK, court,
          window, aimDead, contest, rating (0..100), fatigue (0..1), rand } */
  function shoot(q) {
    const { RIM } = Court3D;
    const dist = Math.hypot(q.shooter[0] - RIM.x, q.shooter[2] - RIM.z);
    const type = q.fade ? fadeType(dist) : shotType(dist);
    const dir = Court3D.dirToRim(q.shooter);
    const release = q.fade ? [q.shooter[0] - dir[0] * FADE_BACK, type.from, q.shooter[2] - dir[2] * FADE_BACK] : releasePoint(q.shooter, type);
    const target = [RIM.x + dir[0] * type.aimBack, RIM.y, RIM.z + dir[2] * type.aimBack];
    let sol = solve(release, target, type.theta * Math.PI / 180);
    let bank = false;
    const side = Math.abs(Court3D.polarOf(q.shooter).angle);
    if (type.id === 'layup' && side >= 25 && side <= 85 && q.court) {
      const b = solveBank(release, q.court);
      if (b) { sol = { vec: b.vec }; bank = true; }
    }
    const spin = type.id === 'jumper' || q.fade ? { touch: 0, out: 0, label: null } : spinFromCurl(q.curl);
    const ideal = q.touchK * idealFlick(q.fade ? dist + FADE_EXTRA : dist);
    const ratio = q.flickSpeed / ideal;
    const e = ratio - 1;
    const w = q.window;
    // inside the window the flick snaps toward perfect; outside it, error grows quickly
    // close shots have more room for error in the arc, so the slope is steeper there
    // layups are tighter still, so touch (and spin) matters at the rim
    const closeK = type.id === 'layup' ? Math.pow(FT_DIST / Math.max(3, dist), 1.6) : Math.max(1, FT_DIST / Math.max(4, dist));
    const slope = 0.11 * closeK * (e > 0 ? 1.25 : 1);
    let ve;
    if (Math.abs(e) <= w) ve = e * 0.0045 / w;
    else ve = Math.sign(e) * (0.0045 + (Math.abs(e) - w) * slope);
    const angDeg = q.angle * 180 / Math.PI;
    const dead = q.aimDead;
    let yawDeg = Math.abs(angDeg) <= dead ? angDeg * 0.08 : Math.sign(angDeg) * (dead * 0.08 + (Math.abs(angDeg) - dead) * 0.42);
    const contest = q.contest || 0;
    const skill = Math.max(0, Math.min(1, (q.rating == null ? 60 : q.rating) / 100));
    const sigV = 0.0012 + contest * 0.0065 + (1 - skill) * 0.0025 + (q.fatigue || 0) * 0.004;
    const sigYaw = 0.12 + contest * 1.1 + (1 - skill) * 0.5 + (q.fatigue || 0) * 0.6;
    const rand = q.rand || Math.random;
    ve += gauss(rand) * sigV;
    yawDeg += gauss(rand) * sigYaw;
    let vec = V.mul(sol.vec, 1 + ve);
    // yaw: positive flick angle (right) sends the ball right on screen
    vec = rotateY(vec, -yawDeg * Math.PI / 180);
    const green = Math.abs(e) <= w && Math.abs(angDeg) <= dead;
    return {
      vel: vec, release, type, dist, ratio, error: e, green, bank,
      touch: spin.touch, spinOut: spin.out, spinDir: spin.sgn || 0,
      aimDeg: angDeg, yawDeg, window: w, idealSpeed: ideal,
      feedback: describe(e, w, angDeg, dead, spin, bank)
    };
  }

  function describe(e, w, ang, dead, spin, bank) {
    const parts = [];
    if (Math.abs(e) <= w) parts.push(Math.abs(e) < w * 0.35 ? 'Pure touch' : 'Good touch');
    else if (e > 0) parts.push(e > w + 0.2 ? 'Way too hard' : 'A bit strong');
    else parts.push(e < -w - 0.2 ? 'Way too soft' : 'A bit short');
    if (Math.abs(ang) > dead) parts.push(ang > 0 ? 'pulled right' : 'pulled left');
    if (spin && spin.label === 'overspin') parts.push('too much spin');
    else if (spin && spin.touch > 0.5) parts.push(bank ? 'spun off the glass' : 'spun it soft');
    else if (bank) parts.push('off the glass');
    return parts.join(', ');
  }

  /* A computer shooter's version of the same shot. Errors come straight from
     skill and distance; physics still decides make or miss. */
  function cpuShot(shooter, skill, rand) {
    const dist = Math.hypot(shooter[0] - RIM.x, shooter[2] - RIM.z);
    const type = shotType(dist);
    const dir = Court3D.dirToRim(shooter);
    const release = releasePoint(shooter, type);
    const target = [RIM.x + dir[0] * type.aimBack, RIM.y, RIM.z + dir[2] * type.aimBack];
    const sol = solve(release, target, type.theta * Math.PI / 180);
    const r = rand || Math.random;
    const sigV = 0.002 + (1 - skill) * 0.016 + Math.max(0, dist - 8) * 0.00028;
    const sigY = 0.25 + (1 - skill) * 1.6 + Math.max(0, dist - 8) * 0.02;
    let vec = V.mul(sol.vec, 1 + gauss(r) * sigV);
    vec = rotateY(vec, gauss(r) * sigY * Math.PI / 180);
    return { vel: vec, release, type, dist };
  }

  // Run a ball to completion without drawing (used for tests and quick sims).
  function simulate(release, vel, court) {
    const b = newBall(release, vel);
    let n = 0;
    while (!b.result && n++ < 2000) advance(b, 1 / 120, court);
    return b;
  }

  return { G, newBall, advance, solve, shoot, cpuShot, simulate, shotType, releasePoint, idealFlick, spinFromCurl, solveBank, FT_DIST, gauss };
})();
