/* GolfPhysics: the ball in yards and seconds.
   Flight has drag, lift from backspin, sidespin that bends it, and wind that
   gets stronger the higher the ball climbs. On the ground it bounces, checks
   up with spin, rolls, and breaks on a sloped green. Every shot is simulated
   once at impact and played back, so what you watch is what the physics did.
   World axes: x right (looking from the tee), y up, z toward the green. */
const GolfPhysics = (() => {
  const G = 10.73;            // gravity, yd/s²
  const R = 0.02334;          // ball radius, yd
  const K = 0.01745;          // ½·ρ·A/m for a golf ball, per yard
  const CUP = 0.059;          // cup radius, yd
  const RPM = Math.PI / 30;   // rpm to rad/s
  const DT = 1 / 240;
  const MPH = 0.4889;         // mph to yd/s
  const PUTT_V = 4.9;         // a full putting stroke starts the ball at this, yd/s

  // Stock still-air carry in yards. Launch speed is solved at load so each club
  // carries its number; everything else (wind, lie, trajectory) is physics.
  const CLUBS = [
    { id: 'D', name: 'Driver', short: 'Dr', carry: 245, launch: 12, spin: 2700 },
    { id: '3W', name: '3 wood', short: '3w', carry: 222, launch: 11.5, spin: 3500 },
    { id: '4H', name: '4 hybrid', short: '4h', carry: 202, launch: 13, spin: 4300 },
    { id: '5i', name: '5 iron', short: '5i', carry: 188, launch: 14, spin: 5100 },
    { id: '6i', name: '6 iron', short: '6i', carry: 176, launch: 15.5, spin: 5900 },
    { id: '7i', name: '7 iron', short: '7i', carry: 164, launch: 17, spin: 6700 },
    { id: '8i', name: '8 iron', short: '8i', carry: 152, launch: 19, spin: 7500 },
    { id: '9i', name: '9 iron', short: '9i', carry: 140, launch: 21.5, spin: 8300 },
    { id: 'PW', name: 'Pitching wedge', short: 'PW', carry: 127, launch: 24.5, spin: 9000 },
    { id: 'GW', name: 'Gap wedge', short: 'GW', carry: 112, launch: 28, spin: 9500 },
    { id: 'SW', name: 'Sand wedge', short: 'SW', carry: 94, launch: 32, spin: 9900 },
    { id: 'LW', name: 'Lob wedge', short: 'LW', carry: 74, launch: 37, spin: 10200 },
    { id: 'P', name: 'Putter', short: 'Pt', putter: true }
  ];
  const CLUB = {};
  CLUBS.forEach((c, i) => { c.i = i; CLUB[c.id] = c; });

  // What each surface does to a landing ball and a rolling one.
  // e: bounce. keep and bite: how much forward speed survives the landing; a
  // steep landing on soft turf loses most of it. check: how hard backspin
  // grabs. roll: rolling drag, yd/s².
  const SURF = {
    tee: { e: 0.3, keep: 0.62, bite: 0.8, check: 0.05, roll: 2.6, label: 'Tee box' },
    fairway: { e: 0.3, keep: 0.62, bite: 0.8, check: 0.05, roll: 2.6, label: 'Fairway' },
    fringe: { e: 0.24, keep: 0.75, bite: 2.2, check: 0.08, roll: 1.6, label: 'Fringe' },
    green: { e: 0.2, keep: 0.95, bite: 2.7, check: 0.15, roll: 0.6, label: 'Green' },
    rough: { e: 0.14, keep: 0.3, bite: 1.5, check: 0, roll: 5, label: 'Rough' },
    sand: { e: 0.03, keep: 0.05, bite: 1, check: 0, roll: 16, label: 'Sand' },
    water: { hazard: true, label: 'Water' },
    ob: { hazard: true, label: 'Out of bounds' }
  };

  // Trajectory: a short finish knocks it down, a long one sends it high.
  const TYPES = {
    knock: { label: 'Knockdown', launch: 0.64, add: 0, spin: 0.74, speed: 0.935 },
    stock: { label: 'Stock', launch: 1, add: 0, spin: 1, speed: 1 },
    high: { label: 'High', launch: 1.18, add: 2, spin: 1.06, speed: 0.995 }
  };

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function heading(dirDeg) { const a = dirDeg * Math.PI / 180; return [Math.sin(a), 0, Math.cos(a)]; }
  function headingOf(dx, dz) { return Math.atan2(dx, dz) * 180 / Math.PI; }

  // ---------- flight ----------
  function windAt(wind, y) {
    if (!wind) return null;
    const f = 0.55 + 0.55 * clamp(y / 30, 0, 1);
    return [wind[0] * f, 0, wind[2] * f];
  }
  function airAccel(v, spin, tilt, wind) {
    const rel = wind ? [v[0] - wind[0], v[1], v[2] - wind[2]] : v;
    const s = Math.hypot(rel[0], rel[1], rel[2]) || 1e-6;
    const S = Math.min(0.5, R * Math.max(0, spin) / s);
    const cd = 0.21 + 0.3 * S;
    const cl = spin > 0 ? Math.min(0.36, 0.56 * Math.pow(S, 0.45)) : 0;
    const vh = [rel[0] / s, rel[1] / s, rel[2] / s];
    // right of the ball's path is up × v; lift is v × right, tilted by the spin axis
    let rx = vh[2], rz = -vh[0];
    const rl = Math.hypot(rx, rz) || 1e-6; rx /= rl; rz /= rl;
    const lu = [vh[1] * rz, vh[2] * rx - vh[0] * rz, -vh[1] * rx];
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const L = [lu[0] * ct + rx * st, lu[1] * ct, lu[2] * ct + rz * st];
    const kd = K * cd * s, kl = K * cl * s * s;
    return [-kd * rel[0] + kl * L[0], -kd * rel[1] + kl * L[1] - G, -kd * rel[2] + kl * L[2]];
  }

  /* The full shot: air, bounces, roll. world = { surfaceAt(x,z), wind [x,0,z] yd/s,
     slopeAt(x,z) -> [gx,gz] rise per yard, greenRoll, cup [x,z], trees [{x,z,r,h}], noGround } */
  function simulate(shot, world) {
    const st = { p: shot.pos.slice(), v: shot.vel.slice(), spin: shot.spin || 0, tilt: shot.tilt || 0 };
    const w = world || {};
    const out = { path: [], events: [], result: 'rest', carry: 0, apex: st.p[1], land: null, firstSurf: null, t: 0, holed: false };
    const start = shot.pos.slice();
    let t = 0, k = 0, phase = shot.rolling ? 'roll' : 'air', bounces = 0;
    const treesHit = new Set();
    const surf = (x, z) => (w.surfaceAt ? w.surfaceAt(x, z) : 'fairway');
    const rec = () => out.path.push({ t, p: st.p.slice() });
    rec();
    let lipped = false, overCup = false;
    while (t < 24) {
      t += DT; k++;
      if (phase === 'air') {
        const a = airAccel(st.v, st.spin, st.tilt, windAt(w.wind, st.p[1]));
        st.v = add(st.v, mul(a, DT));
        st.p = add(st.p, mul(st.v, DT));
        st.spin *= Math.exp(-DT / 22);
        if (st.p[1] > out.apex) out.apex = st.p[1];
        // trees: the canopy swallows the ball's speed, the trunk knocks it back
        if (w.trees) {
          for (let i = 0; i < w.trees.length; i++) {
            const tr = w.trees[i];
            if (treesHit.has(i)) continue;
            const dx = st.p[0] - tr.x, dz = st.p[2] - tr.z, dy = st.p[1] - tr.h;
            if (dx * dx + dy * dy * 0.7 + dz * dz < tr.r * tr.r) {
              treesHit.add(i);
              const ang = ((i * 2654435761) % 360) * Math.PI / 180;
              const sp = Math.hypot(st.v[0], st.v[2]) * 0.16;
              st.v = [Math.sin(ang) * sp, Math.min(0, st.v[1]) * 0.3, Math.cos(ang) * sp - st.v[2] * 0.05];
              st.spin *= 0.2; st.tilt = 0;
              out.events.push({ t, type: 'tree', p: st.p.slice() });
            }
          }
        }
        if (w.noGround && st.v[1] < 0 && st.p[1] <= 0) {
          // carry only: interpolate to the ground and stop
          const prevY = st.p[1] - st.v[1] * DT, f = prevY / (prevY - st.p[1]);
          const pl = add(add(st.p, mul(st.v, -DT)), mul(st.v, DT * f));
          out.land = [pl[0], 0, pl[2]];
          out.carry = Math.hypot(pl[0] - start[0], pl[2] - start[2]);
          out.t = t; out.landV = st.v.slice();
          return out;
        }
        if (st.p[1] <= 0 && st.v[1] < 0) {
          st.p[1] = 0;
          const s = surf(st.p[0], st.p[2]);
          if (!out.land) {
            out.land = st.p.slice(); out.firstSurf = s; out.landT = t;
            out.carry = Math.hypot(st.p[0] - start[0], st.p[2] - start[2]);
            out.landAngle = Math.atan2(-st.v[1], Math.hypot(st.v[0], st.v[2])) * 180 / Math.PI;
          }
          if (s === 'water' || s === 'ob') { out.result = s; out.events.push({ t, type: s, p: st.p.slice() }); rec(); break; }
          if (w.cup && Math.hypot(st.p[0] - w.cup[0], st.p[2] - w.cup[1]) < CUP + R * 0.5 && -st.v[1] < 9) {
            out.result = 'holed'; out.holed = true; out.events.push({ t, type: 'cup', dunk: true, p: st.p.slice() }); st.p[1] = -0.05; rec(); break;
          }
          const sf = SURF[s] || SURF.rough;
          const vy = -st.v[1];
          const vh = Math.hypot(st.v[0], st.v[2]);
          const dir = vh > 1e-6 ? [st.v[0] / vh, st.v[2] / vh] : [0, 0];
          const steep = vy / (Math.hypot(vy, vh) || 1);
          // a firm green doesn't grab a landing ball the way a soft one does
          const bite = s === 'green' && w.greenFirm ? sf.bite * (1 - 0.45 * w.greenFirm) : sf.bite;
          let keep = sf.keep * Math.exp(-bite * steep);
          if (bounces > 0) keep = Math.sqrt(keep);
          // backspin on a steep landing grabs; enough of it pulls the ball back
          const nvh = vh * keep - (bounces ? 0 : Math.max(0, st.spin * R - 14) * sf.check);
          st.spin *= 0.3;
          st.tilt *= 0.3;
          st.v = [dir[0] * nvh, sf.e * vy, dir[1] * nvh];
          bounces++;
          out.events.push({ t, type: 'bounce', s: clamp(vy / 25, 0, 1), surf: s, p: st.p.slice() });
          if (st.v[1] < 2.5 || bounces > 5) { st.v[1] = 0; phase = 'roll'; }
        }
      } else {
        // rolling: drag from the surface, gravity along the slope
        const s = surf(st.p[0], st.p[2]);
        if (s === 'water' || s === 'ob') { out.result = s; out.events.push({ t, type: s, p: st.p.slice() }); rec(); break; }
        const sf = SURF[s] || SURF.rough;
        const roll = s === 'green' ? (w.greenRoll || sf.roll) : sf.roll;
        let ax = 0, az = 0;
        if ((s === 'green' || s === 'fringe') && w.slopeAt) {
          const g = w.slopeAt(st.p[0], st.p[2]);
          ax = -(5 / 7) * G * g[0]; az = -(5 / 7) * G * g[1];
        }
        const sp = Math.hypot(st.v[0], st.v[2]);
        const slopeA = Math.hypot(ax, az);
        if (sp < roll * DT * 1.5 && slopeA < roll * 0.85) { st.v = [0, 0, 0]; rec(); break; }
        if (sp > 1e-6) { ax -= roll * st.v[0] / sp; az -= roll * st.v[2] / sp; }
        st.v[0] += ax * DT; st.v[2] += az * DT;
        st.p[0] += st.v[0] * DT; st.p[2] += st.v[2] * DT;
        // the cup: slow enough and it drops; a bit too fast near the edge and it lips out
        if (w.cup) {
          const dx = st.p[0] - w.cup[0], dz = st.p[2] - w.cup[1];
          const d = Math.hypot(dx, dz), v = Math.hypot(st.v[0], st.v[2]);
          if (d >= CUP) overCup = false;
          else if (v < 0.25) {
            out.result = 'holed'; out.holed = true;
            out.events.push({ t, type: 'cup', p: st.p.slice() });
            st.p = [w.cup[0], -0.05, w.cup[1]]; rec(); break;
          } else if (!overCup) {
            // decide once per pass, on how close to the middle its line runs
            overCup = true;
            const off = Math.min(1, Math.abs(dx * st.v[2] - dz * st.v[0]) / Math.max(1e-6, v) / CUP);
            const vmax = 0.3 + 1.6 * Math.sqrt(Math.max(0, 1 - off * off));
            if (v <= vmax) {
              out.result = 'holed'; out.holed = true;
              out.events.push({ t, type: 'cup', p: st.p.slice() });
              st.p = [w.cup[0], -0.05, w.cup[1]]; rec(); break;
            } else if (!lipped && off > 0.3 && v < vmax * 2.2) {
              lipped = true;
              // swing it around the edge: the side it caught decides the way it spins off
              const side = Math.sign(st.v[0] * dz - st.v[2] * dx) || 1;
              const ang = side * (0.5 + 0.6 * off);
              const c = Math.cos(ang), sn = Math.sin(ang);
              const vx = st.v[0] * c - st.v[2] * sn, vz = st.v[0] * sn + st.v[2] * c;
              st.v[0] = vx * 0.55; st.v[2] = vz * 0.55;
              out.events.push({ t, type: 'lip', p: st.p.slice() });
            }
          }
        }
      }
      if (k % 4 === 0) rec();
    }
    rec();
    out.t = t;
    out.rest = st.p.slice();
    out.restSurf = out.result === 'rest' ? surf(st.p[0], st.p[2]) : out.result;
    if (!out.land) { out.land = st.p.slice(); out.carry = Math.hypot(st.p[0] - start[0], st.p[2] - start[2]); out.firstSurf = out.restSurf; }
    out.total = Math.hypot(st.p[0] - start[0], st.p[2] - start[2]);
    return out;
  }

  // ---------- launch ----------
  function launchVel(speed, launchDeg, dirDeg) {
    const la = launchDeg * Math.PI / 180;
    const h = heading(dirDeg);
    return [h[0] * speed * Math.cos(la), speed * Math.sin(la), h[2] * speed * Math.cos(la)];
  }
  function carryOf(speed, launchDeg, spinRpm, tilt, wind) {
    return simulate({ pos: [0, 0, 0], vel: launchVel(speed, launchDeg, 0), spin: spinRpm * RPM, tilt: tilt || 0 }, { noGround: true, wind }).carry;
  }
  // solve each club's launch speed so its stock shot carries its number
  CLUBS.forEach(c => {
    if (c.putter) return;
    let lo = 15, hi = 130;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (carryOf(m, c.launch, c.spin) < c.carry) lo = m; else hi = m; }
    c.speed = (lo + hi) / 2;
  });

  // Bunker shots out of greenside sand: an open, high swing explodes it out
  // soft; anything flatter digs or catches it thin.
  const SAND = {
    high: { speed: 0.7, spin: 0.55, add: 7 },
    stock: { speed: 0.74, spin: 0.45, add: 2 },
    knock: { speed: 0.97, spin: 0.22, launch: 0.5, add: 0 }
  };
  function lieMods(lie, type) {
    if (lie === 'rough') return { speed: 0.985, spin: 0.55, add: 1 };
    if (lie === 'bunker') return SAND[type];
    if (lie === 'sand') return { speed: 0.92, spin: 0.8, add: 0 };
    return null;
  }

  // The deterministic part: club, how far back, which finish, the lie.
  function baseLaunch(clubId, power, type, lie) {
    const c = CLUB[clubId] || CLUB['7i'];
    const T = TYPES[type] || TYPES.stock;
    const p = clamp(power, 0.04, 1.2);
    let speed = c.speed * p * T.speed;
    let launch = c.launch * T.launch + T.add + (1 - Math.min(1, p)) * 3;
    let spin = c.spin * T.spin * (0.5 + 0.5 * Math.min(1, p));
    const m = lieMods(lie, type);
    if (m) { speed *= m.speed; spin *= m.spin; launch = launch * (m.launch || 1) + (m.add || 0); }
    return { speed, launch, spin };
  }
  // power that carries `yards` with a stock swing in still air from a clean lie
  const powerCache = {};
  function powerFor(clubId, yards) {
    const key = clubId + ':' + Math.round(yards);
    if (powerCache[key] != null) return powerCache[key];
    let lo = 0.04, hi = 1.2;
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) / 2;
      const b = baseLaunch(clubId, m, 'stock', 'fairway');
      if (carryOf(b.speed, b.launch, b.spin) < yards) lo = m; else hi = m;
    }
    return (powerCache[key] = (lo + hi) / 2);
  }

  /* Turn a swing into a launch.
     q: { club, power, type, tempo (1 = your tempo), angle (rad), curl, lie, window, aimDead (deg), rand } */
  function strike(q) {
    const b = baseLaunch(q.club, q.power, q.type, q.lie);
    let { speed, launch, spin } = b;
    let tilt = 0, start = 0;
    const w = q.window;
    const err = (q.tempo == null ? 1 : q.tempo) - 1;
    // swinging past full makes your tempo window smaller
    const ww = q.power > 1.02 ? w * Math.max(0.45, 1 - (q.power - 1.02) * 4) : w;
    let tempo;
    if (Math.abs(err) <= ww) {
      tempo = Math.abs(err) < ww * 0.4 ? 'pure' : 'solid';
      speed *= 1 + err * 0.015 / Math.max(0.01, ww);
    } else if (err > 0) {
      const e = Math.min(1.2, err - ww);
      tempo = 'quick';
      start -= 1.5 + 8 * e; tilt -= 0.05 + 0.22 * e; speed *= 1 + 0.025 * e;
    } else {
      const e = Math.min(1, -err - ww);
      tempo = 'decel';
      speed *= 0.96 - 0.5 * e; spin *= 1 - 0.3 * e; start += 1 + 6 * e; launch -= 2 * e;
    }
    // start line: inside the dead zone the swing path snaps nearly straight
    const deg = (q.angle || 0) * 180 / Math.PI, dead = q.aimDead || 5;
    start += Math.abs(deg) <= dead ? deg * 0.08 : Math.sign(deg) * (dead * 0.08 + (Math.abs(deg) - dead) * 0.5);
    // shape: the ball bends the way your swing bent. A path bowed right finishes
    // heading left, so it draws; bowed left, it fades.
    const c = q.curl || 0;
    let shape = null;
    if (Math.abs(c) >= 0.035 && !q.putt) {
      tilt += clamp(-c * 1.5, -0.45, 0.45);
      shape = c > 0 ? 'draw' : 'fade';
    }
    if (q.rand && tempo !== 'pure') { start += (q.rand() - 0.5) * 0.8; speed *= 1 + (q.rand() - 0.5) * 0.01; }
    if (Math.abs(tilt) > 0.3) shape = tilt < 0 ? 'hook' : 'slice';
    else if (Math.abs(tilt) > 0.035 && !shape) shape = tilt < 0 ? 'draw' : 'fade';
    return { speed, launch, spin, tilt, start, tempo, shape, type: q.type };
  }

  // ---------- putting ----------
  function puttSpeedFor(yards, roll) { return Math.sqrt(2 * roll * (yards + 0.45)); }
  function puttPowerFor(yards, roll) { return puttSpeedFor(yards, roll) / PUTT_V; }
  function putt(q) {
    let speed = clamp(q.power, 0.02, 1.6) * PUTT_V, start = 0, tempo;
    const err = (q.tempo == null ? 1 : q.tempo) - 1, w = q.window * 1.6;
    if (Math.abs(err) <= w) { tempo = Math.abs(err) < w * 0.4 ? 'pure' : 'solid'; speed *= 1 + err * 0.02 / w; }
    else if (err > 0) { const e = Math.min(1, err - w); tempo = 'quick'; speed *= 1 + 0.16 * e; start -= 0.6 + 2.2 * e; }
    else { const e = Math.min(1, -err - w); tempo = 'decel'; speed *= 0.95 - 0.3 * e; start += 0.6 + 2 * e; }
    const deg = (q.angle || 0) * 180 / Math.PI, dead = (q.aimDead || 5) * 1.2;
    start += Math.abs(deg) <= dead ? deg * 0.03 : Math.sign(deg) * (dead * 0.03 + (Math.abs(deg) - dead) * 0.22);
    if (q.rand && tempo !== 'pure') start += (q.rand() - 0.5) * 0.25;
    return { speed, start, tempo };
  }

  return { CLUBS, CLUB, SURF, TYPES, CUP, RPM, MPH, PUTT_V, G, simulate, strike, putt, baseLaunch, powerFor, puttPowerFor, puttSpeedFor, launchVel, carryOf, heading, headingOf, windAt };
})();
