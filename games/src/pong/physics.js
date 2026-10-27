/* Ball, table and cup physics, and the throw model.
   World in feet: x across the table, y up from the tabletop, z down the table
   from your end (0) to theirs (8). The flick decides intent (which cup, which
   shot, how clean); the physics decides the outcome, so a ball that catches a
   rim rides it, drops in, or pops into the cup next door. */
const PongPhysics = (() => {
  const G = 32.17;
  const R = 0.0656;            // 40 mm ball
  const DRAG = 0.042;          // a ping pong ball slows down fast: drag ~ k·v²
  const TABLE = { x0: -1, x1: 1, z0: 0, z1: 8 };
  const FLOOR = -2.3;
  const CUP = { rTop: 0.154, rBot: 0.098, h: 0.39, lip: 0.012 };
  const SPACING = 0.31;        // cups touching
  const ROW = SPACING * Math.sqrt(3) / 2;
  const E_TABLE = 0.8, E_RIM = 0.62, E_OUT = 0.5, E_IN = 0.22, RIM_FR = 0.12;
  const STEP = 1 / 240;
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: a => Math.hypot(a[0], a[1], a[2])
  };
  // where the ball leaves the hand: about chin height, elbow behind the table edge
  const RELEASE = { near: [0.06, 2.3, -0.5], far: [-0.06, 2.3, 8.5] };

  function newBall(p, v, opts) {
    return Object.assign({
      p: p.slice(), v: v.slice(), t: 0, rot: 0, touch: 0, spinOut: 0, spinDir: 1,
      rimHits: 0, wallHits: 0, bounces: 0, cupHits: [], inCup: null, sunk: null, sunkAt: 0,
      result: null, done: false, rollT: 0, events: []
    }, opts || {});
  }

  function inTable(p) { return p[0] > TABLE.x0 && p[0] < TABLE.x1 && p[2] > TABLE.z0 && p[2] < TABLE.z1; }

  function collideCup(b, c, prevY) {
    const rx = b.p[0] - c.x, rz = b.p[2] - c.z;
    const hd = Math.hypot(rx, rz);
    // dropping through the opening puts it inside the cup
    if (prevY >= CUP.h && b.p[1] < CUP.h && hd < CUP.rTop) b.inCup = c.id;
    if (b.inCup === c.id && b.p[1] > CUP.h + R) b.inCup = null;
    // the rolled lip: a thin ring, same as a rim
    if (hd > 1e-5 && Math.abs(b.p[1] - CUP.h) < R + CUP.lip + 0.02) {
      const qx = c.x + rx / hd * CUP.rTop, qz = c.z + rz / hd * CUP.rTop;
      const dx = b.p[0] - qx, dy = b.p[1] - CUP.h, dz = b.p[2] - qz;
      const dist = Math.hypot(dx, dy, dz), minD = R + CUP.lip;
      if (dist < minD && dist > 1e-6) {
        const n = [dx / dist, dy / dist, dz / dist];
        b.p = [qx + n[0] * minD, CUP.h + n[1] * minD, qz + n[2] * minD];
        const vn = V.dot(b.v, n);
        if (vn < 0) {
          const vt = V.sub(b.v, V.mul(n, vn));
          // spin grabs the rim: less kick off it, and it rolls around and in
          b.v = V.add(V.mul(vt, 1 - RIM_FR), V.mul(n, -vn * E_RIM * (1 - 0.55 * b.touch)));
          const inw = [-rx / hd, 0, -rz / hd], tan = [-rz / hd * b.spinDir, 0, rx / hd * b.spinDir];
          if (b.touch) b.v = V.add(b.v, V.add(V.mul(inw, 2.4 * b.touch), V.mul(tan, 0.9 * b.touch)));
          if (b.spinOut) { b.v = V.add(b.v, V.add(V.mul(inw, -1.4 * b.spinOut), V.mul(tan, 1.1 * b.spinOut))); b.spinOut *= 0.5; }
          b.rimHits++;
          if (!b.cupHits.includes(c.id)) b.cupHits.push(c.id);
          if (-vn > 1.2) b.events.push({ type: 'rim', s: Math.min(1, -vn / 12), cup: c.id });
        }
      }
    }
    // the wall, inside or out
    if (b.p[1] < CUP.h && b.p[1] > -R) {
      const rw = CUP.rBot + (CUP.rTop - CUP.rBot) * Math.max(0, Math.min(1, b.p[1] / CUP.h));
      if (hd < 1e-5) return;
      const nx = rx / hd, nz = rz / hd;
      const vr = b.v[0] * nx + b.v[2] * nz;
      if (b.inCup === c.id) {
        if (hd > rw - R) {
          b.p[0] = c.x + nx * (rw - R); b.p[2] = c.z + nz * (rw - R);
          if (vr > 0) { b.v[0] -= nx * vr * (1 + E_IN); b.v[2] -= nz * vr * (1 + E_IN); b.v[1] *= 0.8; b.wallHits++; }
        }
      } else if (hd < rw + R) {
        b.p[0] = c.x + nx * (rw + R); b.p[2] = c.z + nz * (rw + R);
        if (vr < 0) {
          b.v[0] -= nx * vr * (1 + E_OUT); b.v[2] -= nz * vr * (1 + E_OUT);
          if (!b.cupHits.includes(c.id)) b.cupHits.push(c.id);
          if (-vr > 1) b.events.push({ type: 'cup', s: Math.min(1, -vr / 10), cup: c.id });
        }
      }
    }
    // down in the cup: it's in
    if (b.inCup === c.id && b.p[1] < CUP.h - R - 0.05 && !b.sunk) {
      b.sunk = c.id; b.sunkAt = b.t;
      b.events.push({ type: 'sink', cup: c.id });
    }
  }

  function step(b, dt, cups) {
    const prevY = b.p[1];
    const sp = V.len(b.v);
    b.v[0] -= DRAG * sp * b.v[0] * dt;
    b.v[1] -= (G + DRAG * sp * b.v[1]) * dt;
    b.v[2] -= DRAG * sp * b.v[2] * dt;
    b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt;
    b.rot += dt * (8 + sp);
    b.t += dt;
    // tabletop
    if (b.p[1] < R && prevY >= R - 0.02 && inTable(b.p) && !b.inCup) {
      b.p[1] = R;
      if (b.v[1] < 0) {
        const s = -b.v[1];
        b.v[1] = s > 0.6 ? s * E_TABLE : 0;
        b.v[0] *= 0.92; b.v[2] *= 0.92;
        if (s > 0.6) { b.bounces++; b.events.push({ type: 'bounce', s: Math.min(1, s / 14), at: b.p.slice() }); }
      }
    }
    if (cups) for (const c of cups) {
      if (!c.live) continue;
      if (Math.abs(b.p[0] - c.x) > 0.3 || Math.abs(b.p[2] - c.z) > 0.3 || b.p[1] > CUP.h + 0.2) { if (b.inCup === c.id && b.p[1] > CUP.h + R) b.inCup = null; continue; }
      collideCup(b, c, prevY);
      if (b.sunk) break;
    }
    if (b.p[1] < FLOOR + R) { b.p[1] = FLOOR + R; b.v = [0, 0, 0]; }
  }

  function advance(b, dt, cups) {
    if (b.sunk) {
      // settle into the cup and float there
      b.t += dt;
      if (!b.result) b.result = 'made';
      if (b.t - b.sunkAt > 1.2) b.done = true;
      return;
    }
    let t = dt;
    while (t > 1e-6 && !b.sunk) { const h = Math.min(STEP, t); step(b, h, cups); t -= h; }
    if (b.sunk) { b.result = 'made'; return; }
    if (!b.result) {
      const onTable = b.p[1] <= R + 0.002 && inTable(b.p);
      if (onTable && Math.abs(b.v[1]) < 0.2) b.rollT += dt; else b.rollT = 0;
      if (b.p[1] < -0.6 || b.rollT > 0.35 || b.t > 4.5) b.result = 'miss';
    }
    if (b.result && !b.doneAt) b.doneAt = b.t;
    if (b.doneAt && b.t - b.doneAt > 0.9) b.done = true;
  }

  // Run a ball to the end without drawing (tests, solvers).
  function simulate(p, v, cups, opts) {
    const b = newBall(p, v, opts);
    let n = 0;
    while (!b.result && n++ < 1200) advance(b, 1 / 120, cups);
    return b;
  }

  // ---------- solvers: initial velocity for each kind of throw ----------
  // Fly with drag only (no cups) until stop() says so.
  function fly(p0, v0, stop, bounce) {
    let p = p0.slice(), v = v0.slice(), t = 0, bounced = 0;
    for (let i = 0; i < 1600; i++) {
      const dt = 1 / 240, sp = V.len(v), py = p[1];
      v[0] -= DRAG * sp * v[0] * dt; v[1] -= (G + DRAG * sp * v[1]) * dt; v[2] -= DRAG * sp * v[2] * dt;
      p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt; t += dt;
      if (bounce && p[1] < R && py >= R && v[1] < 0) { p[1] = R; v[1] = -v[1] * E_TABLE; v[0] *= 0.92; v[2] *= 0.92; bounced++; }
      const r = stop(p, v, bounced, py);
      if (r) return { p, v, t, bounced };
      if (p[1] < FLOOR) break;
    }
    return null;
  }
  function launchVec(from, to, speed, pitch) {
    const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz) || 1;
    const c = Math.cos(pitch);
    return [dx / d * speed * c, speed * Math.sin(pitch), dz / d * speed * c];
  }
  // f rises with x; a null means "didn't get there" (counts as short)
  function bisect(f, lo, hi, tol) {
    let flo = f(lo), fhi = f(hi);
    if (flo == null) flo = -1;
    if (fhi == null || fhi < 0 || flo > 0) return null;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      const v = fm == null ? -1 : fm;
      if (Math.abs(v) < tol) return mid;
      if (v < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  const hdist = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);

  // Arc: a lob at a fixed launch angle, coming down through the rim plane at the target.
  const ARC_PITCH = 52 * Math.PI / 180;
  function solveArc(from, to) {
    const D = hdist(from, to);
    const f = s => { const r = fly(from, launchVec(from, to, s, ARC_PITCH), (p, v) => v[1] < 0 && p[1] <= to[1]); return r ? hdist(from, r.p) - D : null; };
    const s = bisect(f, 4, 45, 0.002);
    return s ? launchVec(from, to, s, ARC_PITCH) : null;
  }
  // Fastball: thrown hard; solve the pitch that crosses the aim point's plane at its height.
  const FAST_SPEED = 27;
  function solveFast(from, aim) {
    const D = hdist(from, aim);
    const f = ph => { const r = fly(from, launchVec(from, aim, FAST_SPEED, ph), p => hdist(from, p) >= D); return r ? r.p[1] - aim[1] : null; };
    const ph = bisect(f, -0.7, 0.7, 0.001);
    return ph == null ? null : launchVec(from, aim, FAST_SPEED, ph);
  }
  // Bounce: thrown down at the table so it kicks up and drops into the target.
  const BOUNCE_PITCH = -16 * Math.PI / 180;
  function solveBounce(from, to) {
    const D = hdist(from, to);
    const f = s => { const r = fly(from, launchVec(from, to, s, BOUNCE_PITCH), (p, v, n) => n >= 1 && v[1] < 0 && p[1] <= to[1], true); return r ? hdist(from, r.p) - D : null; };
    const s = bisect(f, 4, 45, 0.002);
    return s ? launchVec(from, to, s, BOUNCE_PITCH) : null;
  }

  // ---------- the throw model ----------
  function gauss(rand) { const r = rand || Math.random; let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* Spin from the flick's curl, same idea as the layup in Basketball
     Playground: a little curl rides the rim and rolls in, a big hook spins out. */
  function spinFromCurl(curl) {
    const c = Math.abs(curl || 0), sgn = Math.sign(curl || 0) || 1;
    if (c < 0.04) return { touch: 0, out: 0, sgn, label: null };
    if (c < 0.1) return { touch: (c - 0.04) / 0.06, out: 0, sgn, label: 'spin' };
    if (c < 0.24) return { touch: 1, out: 0, sgn, label: 'spin' };
    const over = Math.min(1, (c - 0.24) / 0.14);
    return { touch: Math.max(0, 1 - over * 1.5), out: over, sgn, label: 'overspin' };
  }

  // The touch scale. Your calibration throws are arcs at the head cup of a
  // full rack; that flick is 1.0. About 10% harder is one cup deeper.
  const Z_REF = 8 - CUP.rTop - 0.02 - ROW * 3;   // head cup of a full rack
  const DEPTH_PER = 2.4;                          // feet of depth per 1.0 of flick
  const P0 = { arc: 1, bounce: 0.9 };
  const FAST_IDEAL = 0.82;                        // a short snap carries less power than a full flick
  const AIM_GAIN = 0.18;                          // flick angle to throw angle

  /* q: { kind: arc|fast|bounce, side: 'near' (you throw) | 'far', cups (the
          rack you're shooting at, live ones), p (power vs your touch),
          angle (deg), curl, snap (ft), fastWindow, contest, rand } */
  function throwBall(q) {
    const rand = q.rand || Math.random;
    const dir = q.side === 'far' ? -1 : 1;
    const from = RELEASE[q.side === 'far' ? 'far' : 'near'];
    const live = q.cups.filter(c => c.live);
    const zRef = q.side === 'far' ? 8 - Z_REF : Z_REF;
    const yaw = q.angle * AIM_GAIN * Math.PI / 180 * dir;
    const contest = q.contest || 0;
    const sig = 0.012 + contest * 0.06;
    // only an arc carries spin; a fastball and a bounce come off the hand flat
    const spin = q.kind !== 'arc' ? { touch: 0, out: 0, sgn: 1, label: null } : spinFromCurl(q.curl);
    let target = null, intended, ratio, e, green, aim = null, vel = null, ideal;
    const lineX = z => from[0] + (z - from[2]) * Math.tan(yaw) * dir;

    if (q.kind === 'fast') {
      // a flat ball hits the first cup on its line
      const onLine = live.map(c => ({ c, off: c.x - lineX(c.z) })).filter(o => Math.abs(o.off) < SPACING * 0.85).sort((a, b) => dir * (a.c.z - b.c.z));
      target = onLine.length ? onLine[0].c : null;
      ideal = FAST_IDEAL;
      ratio = q.p / ideal; e = ratio - 1;
      const w = q.fastWindow;
      const off = target ? onLine[0].off : 0;
      // a hard throw is harder to keep on line: the lateral window is tighter
      const fsnap = q.snap * 0.7;
      const latOK = Math.abs(off) <= fsnap;
      green = !!target && Math.abs(e) <= w && latOK;
      // inside the window the height wanders a little; past it, the ball clips the front rim or sails
      const hErr = Math.abs(e) <= w ? e / w * 0.045 : Math.sign(e) * (0.045 + (Math.abs(e) - w) * 0.6);
      const lat = latOK ? off * 0.12 : Math.sign(off) * (fsnap * 0.12 + (Math.abs(off) - fsnap) * 1.5);
      const zc = target ? target.z : (q.side === 'far' ? 0.6 : 7.4);
      const xc = target ? target.x - lat : lineX(zc);
      intended = [xc, zc];
      aim = [xc + gauss(rand) * sig * 2, CUP.h + R + 0.02 + hErr + gauss(rand) * (0.008 + contest * 0.03), zc - dir * (CUP.rTop + 0.01)];
      vel = solveFast(from, aim);
    } else {
      const zInt = zRef + dir * (q.p - P0[q.kind]) * DEPTH_PER;
      const xInt = lineX(zInt);
      intended = [xInt, zInt];
      const snapR = q.snap;
      let best = null, bd = 1e9;
      live.forEach(c => { const d = Math.hypot(c.x - xInt, c.z - zInt); if (d < bd) { bd = d; best = c; } });
      target = best;
      let tx = xInt, tz = zInt;
      if (best) {
        const ox = xInt - best.x, oz = zInt - best.z, od = Math.hypot(ox, oz) || 1e-6;
        // inside the window it snaps to the cup; outside, the miss grows fast
        const k = od <= snapR ? 0.12 : (snapR * 0.12 + (od - snapR) * 1.5) / od;
        tx = best.x + ox * k; tz = best.z + oz * k;
        green = od <= snapR;
        ideal = P0[q.kind] + dir * (best.z - zRef) / DEPTH_PER;
      } else { green = false; ideal = P0[q.kind]; }
      ratio = q.p / ideal; e = ratio - 1;
      // a bounce off the table is never quite the same twice
      const sb = sig + (q.kind === 'bounce' ? 0.012 : 0);
      // a bounce comes in flatter than an arc, so it aims a touch past center to clear the front rim
      const to = [tx + gauss(rand) * sb, CUP.h, tz + gauss(rand) * sb + (q.kind === 'bounce' ? dir * 0.035 : 0)];
      vel = q.kind === 'bounce' ? solveBounce(from, to) : solveArc(from, to);
      aim = to;
    }
    if (!vel) vel = launchVec(from, [intended[0], 0, intended[1]], 14, ARC_PITCH);
    return {
      vel, release: from.slice(), kind: q.kind, target: target ? target.id : null, intended, aim, ratio, error: e, green,
      touch: spin.touch, spinOut: spin.out, spinDir: spin.sgn, spinLabel: spin.label, ideal,
      feedback: describe(q.kind, e, green, target, intended, spin, q.snap, q.fastWindow)
    };
  }

  function describe(kind, e, green, target, intended, spin, snap, fw) {
    const parts = [];
    const label = { arc: 'Arc', fast: 'Fastball', bounce: 'Bounce' }[kind];
    if (green) parts.push(Math.abs(e) < (kind === 'fast' ? fw * 0.35 : 0.03) ? 'Pure' : 'Good touch');
    else if (!target) parts.push('Nothing on that line');
    else if (kind === 'fast') parts.push(Math.abs(e) <= fw ? 'Off line' : (e > 0 ? 'Too hot' : 'Too soft'));
    else {
      const dz = intended[1] - target.z, dx = intended[0] - target.x;
      parts.push(Math.abs(dz) >= Math.abs(dx) ? (Math.abs(dz) > snap * 2.2 ? (dz * (target.z > 4 ? 1 : -1) > 0 ? 'Way long' : 'Way short') : (dz * (target.z > 4 ? 1 : -1) > 0 ? 'A bit long' : 'A bit short')) : (dx * (target.z > 4 ? 1 : -1) > 0 ? 'Pulled right' : 'Pulled left'));
    }
    if (spin && spin.label === 'overspin') parts.push('too much spin');
    else if (spin && spin.touch > 0.5) parts.push('spun');
    return label + ' · ' + parts.join(', ');
  }

  /* A computer thrower: picks the cup and the shot, then misses by an amount
     that comes from skill. Physics still decides. */
  function cpuThrow(side, cup, kind, skill, rand) {
    const r = rand || Math.random;
    const dir = side === 'far' ? -1 : 1;
    const from = RELEASE[side];
    const sd = 0.03 + (1 - skill) * 0.2, sl = 0.025 + (1 - skill) * 0.13;
    let vel;
    if (kind === 'fast') {
      const aim = [cup.x + gauss(r) * sl, CUP.h + R + 0.02 + gauss(r) * (0.02 + (1 - skill) * 0.08), cup.z - dir * (CUP.rTop + 0.01)];
      vel = solveFast(from, aim);
    } else {
      const to = [cup.x + gauss(r) * sl, CUP.h, cup.z + gauss(r) * sd];
      vel = kind === 'bounce' ? solveBounce(from, to) : solveArc(from, to);
    }
    if (!vel) vel = launchVec(from, [cup.x, 0, cup.z], 14, ARC_PITCH);
    return { vel, release: from.slice(), kind, target: cup.id, touch: 0, spinOut: 0, spinDir: 1 };
  }

  return { G, R, TABLE, FLOOR, CUP, SPACING, ROW, RELEASE, Z_REF, DEPTH_PER, P0, FAST_IDEAL, AIM_GAIN, V, newBall, advance, simulate, solveArc, solveFast, solveBounce, throwBall, cpuThrow, spinFromCurl, gauss };
})();
