/* Playmaker simulation: five on five in the half court, one ball. Moves
   everybody, flies passes, decides tips and picks, and runs catch-and-shoots
   through the same shot model the scoring game uses. No drawing here.

   The on-ball defender is a Defense instance and the man who helps on a drive
   is a Help instance, so drives, cutoffs and help read exactly the way they do
   in the scoring game. */
const PMSim = (() => {
  const { V, RIM } = Court3D;
  const G = HoopPhysics.G;
  const RIMF = [RIM.x, 0, RIM.z];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const flat = p => [p[0], 0, p[2]];
  const gap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const unit = v => { const l = Math.hypot(v[0], v[2]) || 1; return [v[0] / l, 0, v[2] / l]; };
  const dot2 = (a, b) => a[0] * b[0] + a[2] * b[2];
  const rimDist = p => Math.hypot(p[0] - RIM.x, p[2] - RIM.z);
  const sideVec = p => { const d = Court3D.dirToRim(p); return [-d[2], 0, d[0]]; };
  const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#5c3a1e', '#a86b3c'];
  const HAIR = ['#1b1410', '#2b1d14', '#3b2716', '#0f0f10'];
  const gauss = HoopPhysics.gauss;

  // ---------- poses (the shared ones, plus a few for passing) ----------
  const P0 = Court3D.POSES;
  const tweak = (base, ch) => { const o = {}; Object.keys(base).forEach(k => { o[k] = (ch[k] || base[k]).slice(); }); return o; };
  const POSES = Object.assign({}, P0, {
    ready: tweak(P0.stand, { lel: [-0.75, 4.35, 0.55], rel: [0.75, 4.35, 0.55], lha: [-0.45, 4.85, 1.1], rha: [0.45, 4.85, 1.1] }),
    dribble: tweak(P0.guard, { lha: [-1.4, 4.0, 0.9], lel: [-1.2, 4.3, 0.5], rel: [1.15, 3.9, 0.45], rha: [1.2, 2.9, 0.75], head: [0, 5.6, 0.35] }),
    pass: tweak(P0.stand, { lel: [-0.6, 4.5, 0.85], rel: [0.6, 4.5, 0.85], lha: [-0.3, 4.6, 1.7], rha: [0.3, 4.6, 1.7] }),
    denyR: tweak(P0.guard, { rel: [1.3, 4.7, 0.6], rha: [2.1, 4.6, 1.3] }),
    denyL: tweak(P0.guard, { lel: [-1.3, 4.7, 0.6], lha: [-2.1, 4.6, 1.3] }),
    lunge: tweak(P0.guard, { lel: [-0.9, 4.4, 1.2], lha: [-0.6, 4.2, 2.3], rel: [0.9, 4.4, 1.2], rha: [0.6, 4.2, 2.3], head: [0, 5.3, 0.8] })
  });

  // ---------- passes ----------
  /* speed: feet per second along the floor. from/to: hand heights. A lob and
     a skip are thrown overhead and arc; a bounce pass hits the floor about
     sixty percent of the way. */
  const PASS = {
    bullet: { id: 'bullet', label: 'Bullet pass', speed: 46, from: 4.7, to: 4.5 },
    chest: { id: 'chest', label: 'Chest pass', speed: 33, from: 4.7, to: 4.5 },
    bounce: { id: 'bounce', label: 'Bounce pass', speed: 27, from: 3.9, at: 0.6, e: 0.74 },
    lob: { id: 'lob', label: 'Lob', from: 7.4, to: 6.4 },
    skip: { id: 'skip', label: 'Skip pass', from: 7.6, to: 5.4 }
  };

  function makePass(S, E, type, opts) {
    const o = opts || {};
    const T0 = PASS[type] || PASS.chest;
    const D = Math.max(0.5, gap(S, E));
    const y0 = o.overhead ? 7.3 : T0.from, y1 = o.toY != null ? o.toY : (T0.to != null ? T0.to : 2.6);
    const P = { type, label: o.overhead ? 'Overhead pass' : T0.label, S: flat(S), E: flat(E), D, y0, y1, bend: o.bend || 0, overhead: !!o.overhead };
    if (type === 'lob' || type === 'skip') {
      const apex = type === 'lob' ? Math.max(y0 + 1.6 + D * 0.12, y1 + 1.2, 9.4) : Math.max(y0 + 0.9, 9.0 + D * 0.03, y1 + 0.8);
      const tu = Math.sqrt(2 * (apex - y0) / G), td = Math.sqrt(2 * (apex - y1) / G);
      P.T = tu + td; P.vy = G * tu; P.apex = apex;
    } else if (type === 'bounce') {
      P.T = Math.max(0.2, D / T0.speed);
      P.t1 = P.T * T0.at;
      P.vy = (Court3D.BALL_R - y0 + G * P.t1 * P.t1 / 2) / P.t1;
      P.vy2 = -(P.vy - G * P.t1) * T0.e;
    } else {
      P.T = Math.max(0.14, D / T0.speed);
      P.vy = (y1 - y0 + G * P.T * P.T / 2) / P.T;
    }
    // a curled flick bends the pass: the middle of the path is pushed sideways
    const mid = [(P.S[0] + P.E[0]) / 2, 0, (P.S[2] + P.E[2]) / 2];
    const perp = unit([-(P.E[2] - P.S[2]), 0, P.E[0] - P.S[0]]);
    P.C = V.add(mid, V.mul(perp, P.bend * 2));
    return P;
  }
  function passPos(P, t) {
    const u = clamp(t / P.T, 0, 1);
    const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
    const x = P.S[0] * a + P.C[0] * b + P.E[0] * c;
    const z = P.S[2] * a + P.C[2] * b + P.E[2] * c;
    let y;
    const tt = Math.min(t, P.T);
    if (P.type === 'bounce') {
      if (tt <= P.t1) y = P.y0 + P.vy * tt - G * tt * tt / 2;
      else { const t2 = tt - P.t1; y = Court3D.BALL_R + P.vy2 * t2 - G * t2 * t2 / 2; }
    } else y = P.y0 + P.vy * tt - G * tt * tt / 2;
    return [x, Math.max(Court3D.BALL_R, y), z];
  }

  // ---------- spots ----------
  // a shooter's spot: on the arc, a step behind the line, where he'll catch it and shoot it
  function arcSpot(court, aDeg, extra) { return Court3D.polar(aDeg, Court3D.threeDist(court, aDeg) + (extra == null ? 1.0 : extra)); }
  const DUNKER = 68, dunker = side => Court3D.polar(side * DUNKER, 5.4);
  const ARC = { top: 0, lw: -52, rw: 52, lc: -88, rc: 88 };
  function spotPos(court, key, mirror) {
    let p;
    const s = mirror ? -1 : 1;
    if (key === 'top') p = arcSpot(court, 0, 3.6);
    else if (key === 'ldunk' || key === 'rdunk') p = dunker(key === 'ldunk' ? -1 : 1);
    else if (ARC[key] != null) p = arcSpot(court, ARC[key], key === 'lw' || key === 'rw' ? 1.6 : 1.0);
    else p = Court3D.spotInfo(court, key).pos;
    return [p[0] * s, 0, p[2]];
  }
  const PERIM = ['top', 'lw', 'rw', 'lc', 'rc'];
  function clampCourt(p) { return [clamp(p[0], -24.2, 24.2), 0, clamp(p[2], 0.9, 40)]; }

  // ---------- world ----------
  /* o: { court, scheme, rand, mirror, board, clock, window } */
  function create(o) {
    const court = o.court || Court3D.COURTS.park;
    const r = o.rand || Math.random;
    const board = o.board || null;
    const scheme = PMPlays.SCHEMES[o.scheme || (board && board.scheme)] || PMPlays.SCHEMES.packline;
    const W = {
      t: 0, court, scheme, rand: r, board, window: o.window || 1.6, clock: o.clock || (board ? board.clock : 13),
      off: [], def: [], handler: board ? board.holder : 0, phase: 'live', events: [], story: [], tags: {},
      ball: { state: 'held', p: [0, 4, 0], pass: null, hoop: null, dribT: 0 }, drive: null, help: null,
      timers: [], over: false, result: null, lastPass: null, passes: 0, mirror: !!o.mirror, shot: null, lastCatch: null
    };
    const mir = W.mirror ? -1 : 1;
    if (board) {
      board.off.forEach((b, i) => W.off.push(makeOff(W, i, b[2] || 'shooter', [b[0], 0, b[1]], PMPlays.LINEUP[i].number, PMPlays.LINEUP[i].skin)));
    } else {
      PMPlays.LINEUP.forEach((L, i) => W.off.push(makeOff(W, i, L.role, spotPos(court, L.spot, W.mirror), L.number, L.skin, L.spot)));
    }
    W.off.forEach((O, i) => {
      if (board && !board.def[i]) return;
      const D = makeDef(W, i);
      if (board && board.def[i]) {
        const b = board.def[i];
        D.pos = [b[0], 0, b[1]]; D.behavior = b[2] || null;
        if (b[3] === 'small') { D.height = 0.88; D.reachK = 0.85; }
        if (D.behavior === 'jump') { D.jumper = true; D.antic = 1; }
        if (D.behavior === 'watch') D.watch = true;
      }
      W.def.push(D);
    });
    // lane jumpers sit on the wing on your side of the floor
    if (!board && scheme.jumpers) {
      // on the wing away from the big, so his man's back cut has a clear lane
      const bigX = (W.off.find(O => O.role.id === 'big') || { pos: [0] }).pos[0];
      const wings = W.off.map((O, i) => i).filter(i => i !== W.handler && (W.off[i].spot === 'lw' || W.off[i].spot === 'rw') && Math.sign(W.off[i].pos[0]) !== Math.sign(bigX));
      const pick = wings[Math.floor(r() * wings.length)];
      if (pick != null) { W.def[pick].jumper = true; W.def[pick].antic = 1; }
    }
    if (!board) W.def.forEach(D => { D.pos = guardTarget(W, D); });
    if (!board && defOf(W, W.handler)) { const H = W.off[W.handler], D = defOf(W, W.handler); D.pos = V.add(flat(H.pos), V.mul(Court3D.dirToRim(H.pos), scheme.onBall.gap)); }
    setOnBall(W, W.handler, true);
    W.ball.holder = W.handler;
    return W;
  }
  function makeOff(W, i, roleId, pos, number, skin, spot) {
    const role = PMPlays.ROLES[roleId] || PMPlays.ROLES.shooter;
    return {
      i, side: 'off', role, number, skin, hair: HAIR[i % HAIR.length], pos: pos.slice(), vel: [0, 0, 0], home: pos.slice(), spot: spot || nearestSpot(W, pos),
      state: 'spot', route: null, ri: 0, pose: tweak(P0.stand, {}), poseName: 'stand', phase: W.rand() * 6, lift: 0, face: [0, 0, -1],
      catchT: 9, deniedT: 0, cutCool: 0, q: null, autoShot: null, drove: false, jumpT: 9, passT: 9
    };
  }
  function nearestSpot(W, pos) {
    let best = null;
    PERIM.concat(['ldunk', 'rdunk']).forEach(k => { const p = spotPos(W.court, k, false); const d = gap(p, pos); if (!best || d < best.d) best = { k, d }; });
    return best.k;
  }
  function makeDef(W, i) {
    const sc = W.scheme;
    return {
      i, side: 'def', man: i, pos: [0, 0, 0], vel: [0, 0, 0], mode: 'guard', d: null, h: null,
      react: sc.react, antic: sc.antic, quick: 1, height: i === 4 ? 1.1 : 1, reachK: i === 4 ? 1.15 : 1, jumper: false, behavior: null, watch: false,
      gamble: 0, gambleTo: null, trailT: 0, pose: tweak(P0.sag, {}), poseName: 'sag', phase: W.rand() * 6, lift: 0, face: [0, 0, 1],
      skin: SKIN[(i * 3 + 1) % SKIN.length], hair: HAIR[(i + 2) % HAIR.length], number: [5, 12, 21, 30, 50][i]
    };
  }
  const defOf = (W, j) => W.def.find(D => D.man === j);
  const handlerOf = W => W.off[W.handler];
  function ballFloor(W) {
    if (W.ball.state === 'pass' && W.ball.pass) return flat(W.ball.pass.E);
    return flat(handlerOf(W).pos);
  }
  function emit(W, ev) { W.events.push(ev); }
  function pop(W, text, color, at, size) { emit(W, { type: 'pop', text, color: color || '#ffffff', at: at.slice(), size: size || 1 }); }
  function after(W, sec, fn) { W.timers.push({ at: W.t + sec, fn }); }
  function nameOf(W, j) {
    const O = W.off[j];
    if (O.role.id === 'big') return 'your big';
    const p = O.pos, a = Math.abs(Court3D.polarOf(p).angle);
    if (a > 70 && p[2] < 11) return 'the corner';
    if (rimDist(p) < 10) return O.role.id === 'slasher' ? 'the cutter' : 'the cutter';
    if (a < 25) return 'the top';
    return 'the wing';
  }

  // ---------- the on-ball defender ----------
  function setOnBall(W, j, fresh) {
    W.def.forEach(D => { if (D.d && D.man !== j) { D.d = null; D.mode = 'guard'; } });
    const D = defOf(W, j);
    if (!D) return;
    const sc = W.scheme, O = W.off[j];
    const arch = Object.assign({}, Defense.ARCHETYPES.closer, {
      speed: D.flyClose ? 18.5 : sc.close.speed, gap: D.flyClose ? 1.4 : sc.onBall.gap, lateral: sc.onBall.lateral, length: sc.close.length * (D.height || 1),
      bite: D.flyClose ? 0.95 : 0.4, shade: 0, setPose: 'guard', height: D.height || 1, reach: D.reachK || 1
    });
    const d = Defense.create('closer', O.pos, W.rand);
    d.arch = arch; d.gapWanted = arch.gap; d.shadeSide = 0;
    d.pos = D.pos.slice(); d.vel = D.vel.slice();
    d.state = fresh || gap(D.pos, O.pos) < arch.gap + 1.0 ? 'set' : 'closing';
    D.d = d; D.h = null; D.mode = 'onball'; D.gamble = 0; D.flyClose = false;
  }

  // ---------- off-ball defense ----------
  function guardTarget(W, D) {
    const sc = W.scheme, m = W.off[D.man];
    const mp = flat(m.pos), b = ballFloor(W);
    const toBall = V.sub(b, mp), dB = Math.hypot(toBall[0], toBall[2]);
    const toRim = V.sub(RIMF, mp);
    const one = dB < 24;
    const beh = D.behavior;
    if (beh === 'front') return V.add(mp, V.mul(unit(toBall), 2.4));
    if (beh === 'behind') return V.add(mp, V.mul(unit(toRim), 1.8));
    if (m.role.id === 'big' && sc.rimBig) return V.add(RIMF, V.mul(unit([mp[0] * 0.5, 0, Math.max(2, mp[2] - RIM.z)]), 2.8));
    if (beh === 'sunk' || (D.scramble && D.scramble > W.t)) return V.add(mp, V.mul(toRim, 0.72));
    if (D.gamble > 0 && D.gambleTo) return D.gambleTo;
    const deny = beh === 'deny' || (sc.deny > 0 && one && m.role.id !== 'big' && dB > 9);
    D.denying = deny;
    if (deny) return V.add(V.add(mp, V.mul(unit(toBall), 3.2)), V.mul(unit(toRim), 0.5));
    // a gambler sits a third of the way up the lane, a step off it on the rim side
    if (D.jumper) return V.add(V.add(mp, V.mul(toBall, 0.32)), V.mul(unit(toRim), 2.2));
    let fB = one ? 0.14 + sc.gap1 * 0.25 : 0.3, fR = one ? sc.gap1 : 0.2 + sc.sink * 0.42;
    if (m.role.id === 'big') { fB = 0.12; fR = 0.22; }
    if (D.watch) { fB += 0.12; fR += 0.12; }
    if (W.drive && W.drive.deep) fR += 0.1;
    return V.add(mp, V.add(V.mul(toBall, fB), V.mul(toRim, fR)));
  }

  // thru: running through a waypoint on a route, not stopping at it
  function steer(e, target, maxSpeed, acc, dt, thru) {
    const to = V.sub(target, e.pos); to[1] = 0;
    const dist = Math.hypot(to[0], to[2]);
    const want = dist > 1e-4 && maxSpeed > 0 ? V.mul(to, (thru ? maxSpeed : Math.min(maxSpeed, dist * 4.5)) / dist) : [0, 0, 0];
    const dv = V.sub(want, e.vel), dvl = Math.hypot(dv[0], dv[2]), lim = acc * dt;
    e.vel = dvl > lim ? V.add(e.vel, V.mul(dv, lim / dvl)) : want;
    e.pos = V.add(e.pos, V.mul(e.vel, dt)); e.pos[1] = 0;
    return dist;
  }
  function setPose(e, name, dt, rate) {
    e.poseName = name;
    e.pose = Court3D.blendPose(e.pose, POSES[name] || POSES.stand, Math.min(1, dt * (rate || (name.startsWith('run') ? 16 : 10))));
  }
  function runPose(e) { return Math.sin(e.phase * 11) > 0 ? 'run1' : 'run2'; }

  function defenseAI(W, dt) {
    const hdl = handlerOf(W);
    const onBall = W.ball.state === 'held' ? defOf(W, W.handler) : null;
    W.def.forEach(D => {
      D.phase += dt;
      if (D.gamble > 0) D.gamble -= dt;
      const m = W.off[D.man];
      if (D.mode === 'pick' && D.pickAt) {
        const left = Math.max(0.02, D.pickT - W.t);
        const to = V.sub(flat(D.pickAt), D.pos);
        D.vel = V.mul(to, 1 / left); D.pos = V.add(D.pos, V.mul(D.vel, Math.min(dt, left))); D.pos[1] = 0;
        setPose(D, 'lunge', dt, 14);
        D.face = unit(V.sub(flat(D.pickAt), D.pos));
        return;
      }
      if (D.d) {
        Defense.update(D.d, dt, { pos: m.pos }, W.rand);
        D.pos = D.d.pos.slice(); D.vel = D.d.vel.slice(); D.pose = D.d.pose; D.poseName = D.d.poseName; D.lift = D.d.lift;
        D.face = D.d.faced === 'rim' ? unit(V.sub(RIMF, D.pos)) : unit(V.sub(m.pos, D.pos));
        return;
      }
      if (D.h) {
        const to = W.drive && W.drive.dir ? V.add(hdl.pos, V.mul(W.drive.dir, 6)) : null;
        Help.update(D.h, dt, { pos: hdl.pos, to }, onBall && onBall.d ? onBall.d : { state: 'beaten' });
        D.pos = D.h.pos.slice(); D.vel = D.h.vel.slice(); D.pose = D.h.pose; D.poseName = D.h.poseName; D.lift = D.h.lift;
        D.face = unit(V.sub(hdl.pos, D.pos));
        return;
      }
      D.lift = 0;
      let target, speed = 12.5 * D.quick, pose = 'sag';
      if (D.mode === 'close' && W.ball.state === 'pass') {
        // running at the catch before the ball gets there
        if (W.t >= D.closeAt) {
          const E = W.ball.pass.E;
          target = V.add(E, V.mul(Court3D.dirToRim(E), D.flyClose ? 1.2 : W.scheme.close.gap + 0.6));
          speed = D.flyClose ? 20 : W.scheme.close.speed;
          pose = 'run1';
        } else target = D.pos;
      } else {
        if (D.mode === 'close') D.mode = 'guard';
        target = guardTarget(W, D);
        // a cutter: he follows once he sees it, a step behind
        if (m.state === 'cut' || m.state === 'meet') {
          D.trailT += dt;
          const delay = D.behavior === 'watch' || D.watch ? 0.85 : (D.gamble > 0 ? 0.9 : (D.behavior === 'deny' || W.scheme.deny ? 0.45 : 0.22));
          if (D.trailT > delay) { target = V.add(flat(m.pos), V.mul(unit(V.sub(ballFloor(W), m.pos)), 1.4)); speed = 15.5; }
          else target = D.pos;
        } else D.trailT = 0;
        const toBall = V.sub(ballFloor(W), D.pos);
        if (D.denying) {
          const fwd = unit(V.sub(m.pos, D.pos)), sd = [fwd[2], 0, -fwd[0]];
          pose = dot2(sd, toBall) > 0 ? 'denyR' : 'denyL';
        }
        if (D.jumper) pose = 'guard';
        if (D.gamble > 0) { pose = 'lunge'; speed = 17; }
      }
      const dist = steer(D, target, speed, 55, dt);
      if (Math.hypot(D.vel[0], D.vel[2]) > 6 && pose !== 'lunge') pose = runPose(D);
      setPose(D, pose, dt);
      D.face = D.watch || D.jumper || D.mode === 'close' || D.gamble > 0 ? unit(V.sub(ballFloor(W), D.pos)) : unit(V.sub(V.mul(V.add(flat(m.pos), ballFloor(W)), 0.5), D.pos));
      if (D.face[0] === 0 && D.face[2] === 0) D.face = [0, 0, 1];
      void dist;
    });
  }

  // ---------- offense ----------
  function offenseAI(W, dt) {
    W.off.forEach((O, j) => {
      O.phase += dt; O.catchT += dt; O.jumpT += dt; O.passT += dt;
      if (O.cutCool > 0) O.cutCool -= dt;
      if (j === W.handler && (W.ball.state === 'held' || W.ball.state === 'shot')) return handlerMove(W, O, dt);
      let target = O.home, speed = 7, pose = 'stand', thru = false;
      const D = defOf(W, j);
      if (O.state === 'cut' && O.route) {
        target = O.route[O.ri]; speed = O.role.speed; thru = O.ri < O.route.length - 1;
        if (gap(O.pos, target) < 1.4) {
          O.ri++;
          if (O.ri >= O.route.length) { O.route = null; O.state = 'post'; O.postT = 0; }
        }
        pose = 'run1';
      } else if (O.state === 'meet' && O.meet) {
        target = O.meet; speed = O.role.speed + 1;
        pose = 'ready';
      } else if (O.state === 'post') {
        target = O.pos; O.postT += dt;
        pose = 'ready';
        if (O.postT > 0.9 && W.ball.state === 'held') { O.state = 'relocate'; O.home = openSpot(W, O); }
      } else if (O.state === 'dive') {
        target = O.diveTo; speed = O.role.speed;
        if (gap(O.pos, target) < 0.8) { O.state = 'post'; O.postT = -0.6; }
        pose = 'ready';
      } else if (O.state === 'relocate') {
        speed = 12;
        if (gap(O.pos, O.home) < 0.8) O.state = 'spot';
      } else {
        // spotted up: watch for the reads that make a cutter go
        if (W.ball.state === 'held' && !W.board && O.cutCool <= 0 && D && !D.d && !D.h) {
          // denied: his man is close, up the line toward the ball, not sagging to the rim
          const toBall = unit(V.sub(ballFloor(W), O.pos)), rel = V.sub(D.pos, O.pos);
          const overplay = gap(D.pos, O.pos) < 5.5 && dot2(rel, toBall) > 1.8 && dot2(rel, Court3D.dirToRim(O.pos)) < 2.6;
          const wing = O.role.id !== 'big' && rimDist(O.pos) > 15;
          if (wing && (D.gamble > 0.2 || (overplay && gap(ballFloor(W), O.pos) < 26))) O.deniedT += dt; else O.deniedT = Math.max(0, O.deniedT - dt * 2);
          const need = D.gamble > 0.2 ? 0.12 : (O.role.backdoor ? 0.75 : 1.5);
          if (O.deniedT > need) startCut(W, j, 'backdoor');
          else if (wing && D.watch && gap(D.pos, O.pos) > 6 && W.drive) startCut(W, j, 'basket');
        }
        const open = D && gap(D.pos, O.pos) > 8.5 && W.ball.state === 'held';
        pose = open ? 'ready' : 'stand';
      }
      const dist = steer(O, target, speed, 60, dt, thru);
      if (Math.hypot(O.vel[0], O.vel[2]) > 5) pose = runPose(O);
      setPose(O, pose, dt);
      const bf = ballFloor(W);
      O.face = unit(V.sub(bf, O.pos));
      void dist;
    });
  }
  // Nobody stands still for long: every few seconds a shooter shakes a few
  // feet along the arc, and comes back. Lanes open and close.
  function shake(W, dt) {
    if (W.board || W.noShots || W.ball.state !== 'held' || W.drive) return;
    W.shakeT = (W.shakeT == null ? 2.4 + W.rand() * 1.2 : W.shakeT) - dt;
    if (W.shakeT > 0) return;
    W.shakeT = 2.2 + W.rand() * 1.6;
    const pool = W.off.filter((T, j) => j !== W.handler && T.state === 'spot' && T.role.id !== 'big' && rimDist(T.pos) > 15);
    if (!pool.length) return;
    const T = pool[Math.floor(W.rand() * pool.length)];
    const pol = Court3D.polarOf(T.home);
    if (!T.base) T.base = T.home.slice();
    const back = gap(T.home, T.base) > 1;
    let to = back ? T.base : arcSpot(W.court, pol.angle + (W.rand() < 0.5 ? -1 : 1) * (pol.angle > 60 || pol.angle < -60 ? -14 : 12));
    to = clampCourt(to);
    // not out past the wing toward the sideline (and off the side of the screen)
    if (!back && Math.abs(to[0]) > 20.5) return;
    if (W.off.some(X => X !== T && gap(X.pos, to) < 6)) return;
    T.home = to; T.state = 'relocate';
  }
  function openSpot(W, O) {
    // the big lives at the dunker spot, on the side away from the ball
    if (O.role.id === 'big') {
      const bx = ballFloor(W)[0];
      const side = Math.abs(bx) > 3 ? -Math.sign(bx) : (Math.sign(O.pos[0]) || 1);
      return dunker(side);
    }
    let best = null;
    PERIM.forEach(k => {
      // the top as a shooter's spot, not where the point guard brings it up
      const p = k === 'top' ? arcSpot(W.court, 0, 2.6) : spotPos(W.court, k, false);
      const taken = W.off.some(T => T !== O && gap(T.home, p) < 7);
      if (taken) return;
      const d = gap(p, O.pos);
      if (!best || d < best.d) best = { p, d };
    });
    return best ? best.p : O.home;
  }
  function startCut(W, j, kind) {
    const O = W.off[j];
    const a = Court3D.polarOf(O.pos).angle;
    const s = Math.sign(a) || 1;
    // backdoor: hard to the rim along the baseline side; basket cut: behind the ball-watcher
    const mid = kind === 'backdoor' ? Court3D.polar(a * 0.8, Math.max(9, rimDist(O.pos) * 0.5)) : Court3D.polar(a * 0.85, 9);
    const end = Court3D.polar(s * 28, 3.4);
    O.state = 'cut'; O.route = [mid, end]; O.ri = 0; O.cutKind = kind; O.cutCool = 4; O.deniedT = 0;
    clearForCutter(W, j, end);
    W.story.push({ k: 'cut', j, kind, name: nameOf(W, j) });
    emit(W, { type: 'cut', j, kind });
  }

  // A big standing where the cutter is going gets out of his way, to the other block.
  function clearForCutter(W, j, end) {
    W.off.forEach((B, k) => {
      if (k === j || k === W.handler || B.role.id !== 'big' || B.state === 'cut') return;
      const cutSide = Math.sign(W.off[j].pos[0]) || 1;
      if (Math.sign(B.pos[0]) !== cutSide && Math.abs(B.pos[0]) > 2) return;
      B.home = Court3D.polar(-cutSide * 66, 5.4);
      B.state = 'relocate';
    });
  }

  // ---------- the ball handler ----------
  function handlerMove(W, O, dt) {
    const D = defOf(W, W.handler);
    let pose = 'dribble';
    if (W.ball.state === 'shot') {
      O.vel = [0, 0, 0];
      setPose(O, O.jumpT < 0.9 ? 'shoot' : 'stand', dt, 14);
      O.lift = O.jumpT < 0.55 ? Math.sin(Math.PI * O.jumpT / 0.55) * 1.6 : 0;
      return;
    }
    O.lift = 0;
    const dv = W.drive;
    if (dv && dv.dir) {
      const beat = dv.beat, back = dv.retreat;
      const sp = back ? 9 : beat ? O.role.speed * 0.95 : 6.5;
      let target = V.add(O.pos, V.mul(dv.dir, sp * 0.5));
      target = clampCourt(target);
      steer(O, target, sp, 70, dt);
      // you can't run through him: a man in front stays in front
      W.def.forEach(X => {
        const g = gap(X.pos, O.pos);
        const ahead = dot2(V.sub(X.pos, O.pos), Court3D.dirToRim(O.pos)) > -0.4;
        if (g < 1.7 && ahead && !(X.d && X.d.state === 'beaten')) {
          const push = unit(V.sub(O.pos, X.pos));
          O.pos = V.add(X.pos, V.mul(push, 1.7)); O.pos[1] = 0;
        }
      });
      if (rimDist(O.pos) < 2.8) O.pos = V.add(RIMF, V.mul(unit(V.sub(O.pos, RIMF)), 2.8));
      O.pos = clampCourt(O.pos);
      if (rimDist(O.pos) < 13) dv.deep = true;
      if (dv.deep && !W.help && !back) triggerHelp(W);
      if (W.help && W.help.h) {
        const H = W.def[W.help.di];
        if (H.h && Help.charge(H.h, O.pos)) return turnover(W, 'Charge', `ran into ${H.h.type.name}`, H.pos);
        if (H.h && Help.steal(H.h, O.pos, W.rand)) return turnover(W, 'Stripped', `${H.h.type.name} reached in and stripped it`, H.pos);
      }
      // at the rim, you finish
      if (rimDist(O.pos) < 4.3 && !back) return takeShot(W, W.handler, 'layup');
      O.drove = true;
    } else {
      steer(O, O.pos, 0, 40, dt);
    }
    O.face = W.passFace && W.t < W.passFace.until ? W.passFace.dir : Court3D.dirToRim(O.pos);
    if (O.fakeT != null && O.fakeT < 0.3) { O.fakeT += dt; pose = 'pass'; }
    if (Math.hypot(O.vel[0], O.vel[2]) > 6) pose = W.ball.state === 'held' ? 'dribble' : runPose(O);
    setPose(O, pose, dt);
    void D;
  }

  /* dir: the drag direction on the floor (unit), or null when the finger stops. */
  // ago: how long the push had been going before it read as a drive
  function driveInput(W, dir, ago) {
    if (W.over || W.ball.state !== 'held') return;
    const O = handlerOf(W);
    if (!dir) {
      if (W.drive) {
        const near = rimDist(O.pos);
        const going = W.drive.beat || W.drive.deep;
        W.drive = null;
        if (going && near < 8.5) takeShot(W, W.handler, near < 5.5 ? 'layup' : 'floater');
      }
      return;
    }
    O.autoShot = null;
    if (!W.drive) {
      W.drive = { t0: W.t, dir, side: 0, lastRes: -9, beat: false, deep: false, retreat: false };
      resolveDrive(W, dir);
      if (ago && W.drive) W.drive.lastRes -= ago;
      return;
    }
    const sv = sideVec(O.pos);
    const lat = dot2(dir, sv), latOld = dot2(W.drive.dir, sv);
    const fwd = dot2(dir, Court3D.dirToRim(O.pos));
    if (W.drive.retreat && fwd > 0.2) { W.drive.retreat = false; resolveDrive(W, dir); }
    // a hard change of direction the other way is a crossover: read him again
    else if (!W.drive.beat && !W.drive.retreat && Math.sign(lat) !== Math.sign(latOld) && Math.abs(lat) > 0.12 && dot2(dir, W.drive.dir) < 0.8 && W.t - W.drive.lastRes > 0.18) resolveDrive(W, dir);
    W.drive.dir = dir;
  }
  const HANDLE = { guard: 74, slasher: 70, shooter: 58, big: 44 };
  function resolveDrive(W, dir) {
    const j = W.handler, O = W.off[j], D = defOf(W, j);
    const dv = W.drive;
    dv.lastRes = W.t;
    const fwd = dot2(dir, Court3D.dirToRim(O.pos));
    if (fwd < -0.4) { dv.retreat = true; return; }
    const d = D && D.d;
    if (!d || d.state === 'beaten' || d.state === 'air' || d.state === 'recover') { dv.beat = true; triggerHelp(W); return; }
    const lat = dot2(dir, sideVec(O.pos));
    const side = Math.abs(lat) < 0.15 ? ((d.momSide || 0) > 0 ? -1 : 1) : Math.sign(lat);
    const res = Defense.drive(d, side, HANDLE[O.role.id] || 60, W.rand);
    dv.side = side;
    const at = V.add(O.pos, [0, 7.2, 0]);
    if (res.steal) return turnover(W, 'Stolen', 'drove into him and got stripped', D.pos);
    if (res.win) {
      dv.beat = true;
      const crossed = res.why === 'Caught him leaning';
      pop(W, crossed ? 'Crossed him' : 'Blow-by', '#7ee2a8', at, 0.85);
      W.story.push({ k: 'drive', side, win: true, why: res.why, crossed });
      triggerHelp(W);
      relocateOnDrive(W, dir);
    } else {
      pop(W, 'Cut off', '#ff9a66', at, 0.8);
      W.story.push({ k: 'drive', side, win: false, why: res.why });
      emit(W, { type: 'sfx', name: 'cutoff' });
    }
  }
  // Teammates move when you drive: lift behind a middle drive, drift on a baseline one.
  /* Spacing on a drive. Baseline drive: the corner on that side lifts to the
     wing, the big slides to the other block. Middle drive: the shooters hold
     their spots on the arc, where they want it. Nobody drifts further out. */
  function relocateOnDrive(W, dir) {
    const O = handlerOf(W);
    const toward = Math.sign(O.pos[0] + dir[0] * 6) || 1;
    const baseline = dir[2] < -0.5 && Math.abs(O.pos[0]) > 8;
    const taken = (T, p) => W.off.some(X => X !== T && X !== O && gap(X.home, p) < 6);
    W.off.forEach((T, j) => {
      if (j === W.handler || T.state !== 'spot') return;
      if (T.role.id === 'big') {
        const to = dunker(baseline ? -toward : (Math.sign(T.pos[0]) || -toward));
        if (gap(to, T.pos) > 1.5) { T.home = to; T.state = 'relocate'; }
        return;
      }
      const a = Court3D.polarOf(T.pos).angle, same = Math.sign(T.pos[0]) === toward;
      const to = baseline && same && Math.abs(a) > 70 ? arcSpot(W.court, toward * 52) : null;
      if (to && !taken(T, to)) { T.home = to; T.state = 'relocate'; }
    });
  }
  // The man the scheme sends when you get by your man, as a Help type.
  function triggerHelp(W) {
    if (W.help) return;
    const sc = W.scheme, O = handlerOf(W);
    let di = -1;
    // a man lunging into a passing lane is in no spot to help
    const candidates = W.def.filter(D => !D.d && D.man !== W.handler && !(D.gamble > 0));
    if (!candidates.length) return;
    if (sc.helper === 'big') di = (W.def.find(D => W.off[D.man].role.id === 'big' && !D.d) || {}).i;
    else if (sc.helper === 'corner') {
      const c = candidates.filter(D => { const p = W.off[D.man].pos; return Math.abs(Court3D.polarOf(p).angle) > 70 && p[2] < 11; });
      di = c.length ? c.sort((a, b) => gap(a.pos, O.pos) - gap(b.pos, O.pos))[0].i : -1;
    }
    if (di == null || di < 0) {
      const ahead = V.add(O.pos, V.mul(W.drive && W.drive.dir ? W.drive.dir : Court3D.dirToRim(O.pos), 6));
      di = candidates.sort((a, b) => gap(a.pos, ahead) - gap(b.pos, ahead))[0].i;
    }
    const H = W.def[di];
    const h = Help.create(sc.helpType, O.pos, W.rand);
    h.pos = H.pos.slice(); h.home = H.pos.slice(); h.vel = H.vel.slice();
    Help.engage(h);
    H.h = h; H.mode = 'help';
    W.help = { di, man: H.man, t: W.t };
    W.tags.helpFrom = nameOf(W, H.man);
    W.story.push({ k: 'help', di, man: H.man, type: h.type.name, from: nameOf(W, H.man) });
    // a scramble: your own man stays down in the paint with the help, so when
    // you kick it and space back out, the swing back to you is the extra pass
    if (sc.xout === 'fly') {
      const X = defOf(W, W.handler);
      if (X) { X.scramble = W.t + 2.8; W.scrambleMan = W.handler; }
    }
    // weak-side heads turn to watch the drive
    W.def.forEach(D => { if (D !== H && !D.d && W.rand() < sc.watch && gap(W.off[D.man].pos, O.pos) > 16) D.watch = true; });
    // his man is open; a big whose man left dives to the rim
    const M = W.off[H.man];
    if (M.role.id === 'big' && M.state !== 'cut') { M.state = 'dive'; M.diveTo = Court3D.polar((Math.sign(M.pos[0]) || 1) * 66, 4.6); }
  }

  // ---------- passing ----------
  /* Who the flick was meant for: the teammate closest to its line, by angle,
     where he'll be when the ball gets there. tol: how far off the flick can
     point (degrees); distW: how much a flick that's short or long of him counts. */
  function intended(W, S, g, type, assist) {
    let best = null;
    W.off.forEach((T, j) => {
      if (j === W.handler) return;
      let pr = predict(W, j, 0.6);
      for (let k = 0; k < 2; k++) pr = predict(W, j, makePass(S, pr, type === 'bounce' ? 'bounce' : 'chest', {}).T);
      const to = V.sub(pr, S), dd = Math.hypot(to[0], to[2]);
      if (dd < 3) return;
      const ang = Math.acos(clamp(dot2(unit(to), g.dir), -1, 1)) * 180 / Math.PI;
      const score = ang + Math.abs(Math.log(Math.max(2, g.dist) / dd)) * (assist.distW || 10);
      if (ang <= assist.tol && (!best || score < best.score)) best = { j, pr, score };
    });
    return best;
  }
  /* The pass a good passer would throw there: inside, through traffic, the
     bounce or the chest pass, whichever gets by the hands; outside, a chest
     pass, or a bullet on a long one. */
  function smartType(W, S, E, j) {
    const R = W.off[j], D = gap(S, E);
    const inside = rimDist(E) < 14 || R.state === 'cut' || R.state === 'dive' || R.state === 'post';
    if (!inside) {
      // outside: a flat one; over the top when somebody's hands are in it; a
      // skip pass over the whole thing on a long one
      const flat = D > 15 ? 'bullet' : 'chest';
      const r = (t, o) => { const P = makePass(S, E, t, o || {}); P.to = j; return laneMargin(W, P).m; };
      const opts = [[flat, r(flat)], [flat + '+over', r(flat, { overhead: true }) + 0.15]];
      if (D > 18) opts.push(['skip', r('skip') + 0.3]);
      return opts.sort((a, b) => a[1] - b[1])[0][0];
    }
    // each pass led to where he'll be when that pass gets there
    const risk = t => {
      let to = E;
      for (let k = 0; k < 2; k++) to = clampCourt(predict(W, j, makePass(S, to, t, {}).T));
      const P = makePass(S, to, t, {}); P.to = j;
      return laneMargin(W, P).m;
    };
    return risk('bounce') + 0.15 < risk('chest') ? 'bounce' : 'chest';
  }

  /* g: { dir (unit, on the floor), dist (ft), type, bend, assist, forced }
     assist: { tol, distW, auto } aims it at the man you meant; auto picks the
     pass type too, unless the type was forced (a pulled-back bounce pass). */
  function pass(W, g) {
    if (W.over || W.ball.state !== 'held') return null;
    const j0 = W.handler, O = W.off[j0];
    let type = g.type || 'chest';
    const S = V.add(flat(O.pos), V.mul(g.dir, 0.9));
    let E = clampCourt(V.add(flat(O.pos), V.mul(g.dir, g.dist)));
    const lock = g.assist && g.assist.tol > 0 ? intended(W, S, g, type, g.assist) : null;
    if (lock) {
      E = clampCourt(lock.pr);
      if (g.assist.auto && !g.forced) type = smartType(W, S, E, lock.j);
      if (type.endsWith('+over')) { type = type.slice(0, -5); g.over = true; }
      // lead him for the pass that's actually going: a bounce takes longer to get there
      for (let k = 0; k < 2; k++) E = clampCourt(predict(W, lock.j, makePass(S, E, type, {}).T));
    }
    if ((type === 'bullet' || type === 'chest') && gap(S, E) > 27) type = 'skip';
    // a man right in your face, in the lane: you take it over his head
    let overhead = !!g.over;
    if (!overhead && (type === 'bullet' || type === 'chest')) {
      const u = unit(V.sub(E, S));
      overhead = W.def.some(D => gap(D.pos, O.pos) < 6.5 && dot2(u, unit(V.sub(D.pos, O.pos))) > 0.8);
    }
    const est = makePass(S, E, type, { bend: g.bend, overhead });
    // who it's for: where each teammate will be when it gets there
    let best = null;
    W.off.forEach((T, j) => { if (j === j0) return; const pr = predict(W, j, est.T); const e = gap(pr, E); if (!best || e < best.e) best = { j, e, pr }; });
    const win = W.window + est.D * 0.05 + (type === 'bounce' ? 0.9 : 0);
    let q = 'none';
    if (best) q = best.e <= win ? 'money' : best.e <= Math.max(4.4, win + 2.2) ? 'reach' : best.e <= Math.max(7.5, win + 5) ? 'chase' : 'none';
    // inside the window the pass finds his hands, leading him if he's moving
    if (q === 'money') E = V.add(best.pr, V.mul(unit(V.sub(S, best.pr)), 0.6));
    let toY = null, alley = false;
    const R = best ? W.off[best.j] : null;
    if (type === 'lob' && R && rimDist(E) < 7 && (R.role.id === 'big' || R.state === 'cut' || R.state === 'dive' || R.state === 'post')) { toY = 10.2; alley = true; }
    const P = makePass(S, E, type, { bend: g.bend, toY, overhead });
    Object.assign(P, { t0: W.t, from: j0, to: best ? best.j : null, q, err: best ? best.e : 99, alley, cutter: !!(R && R.state === 'cut') });
    P.risk = assess(W, P);
    W.ball.state = 'pass'; W.ball.pass = P; W.drive = null;
    W.passFace = { dir: g.dir, until: W.t + 0.35 };
    O.passT = 0; O.autoShot = null;
    W.passes++;
    // the receiver goes to get it
    if (R && q !== 'none') {
      if (!(R.state === 'cut' && q === 'money')) { R.state = 'meet'; R.meet = E; }
      R.route = R.state === 'cut' ? R.route : null;
    }
    // defense reads it: the receiver's man runs at the catch
    W.def.forEach(D => {
      if (D.h) { D.h = null; D.mode = 'guard'; }
      if (D.d && D.man === j0) { D.d = null; D.mode = 'guard'; }
    });
    if (R) closeoutsFor(W, P, R);
    // the passer spaces out again after a drive
    if (O.drove || rimDist(O.pos) < 14) { O.home = openSpot(W, O); O.state = 'relocate'; } else O.state = 'spot';
    O.drove = false;
    W.lastPass = P;
    const outcome = P.risk.outcome;
    if (outcome === 'pick' || outcome === 'tip') {
      const D = W.def[P.risk.di];
      D.mode = 'pick'; D.pickAt = passPos(P, P.risk.t); D.pickT = W.t + P.risk.t; D.d = null; D.h = null;
    }
    emit(W, { type: 'pass', pass: P });
    return P;
  }
  function closeoutsFor(W, P, R) {
    const sc = W.scheme;
    let D = defOf(W, R.i);
    // scramble: the first kick gets a man flying at it, and the next man over is
    // left while his defender is still down in the paint
    if (sc.xout === 'fly' && W.help && !W.flown && rimDist(P.E) > 15) {
      W.flown = true;
      if (D) D.flyClose = true;
      const N = W.scrambleMan != null && W.scrambleMan !== R.i ? W.scrambleMan : null;
      if (N != null) { const X = defOf(W, N); if (X && !X.d) X.scramble = Math.max(X.scramble || 0, W.t + 1.8); }
      W.story.push({ k: 'fly', man: N });
    }
    if (!D) return;
    D.mode = 'close';
    const r = passReact(W, D, P);
    D.closeAt = W.t + r + (W.help && W.help.di === D.i ? 0.2 : 0);
  }
  function passReact(W, D, P) {
    let r = D.react - D.antic * 0.12;
    const m = W.off[D.man];
    // a man watching the ball has lost his own: a pass to him on the cut
    // catches him flat
    const lost = D.watch || D.behavior === 'watch';
    const cutting = m.state === 'cut' || (P && P.cutter && P.to === D.man);
    if (cutting && !D.d) r += lost ? 0.6 : 0.3;
    else if (lost) r -= 0.04;
    if (D.gamble > 0) r += 0.4;
    if (D.h) r += 0.12;
    if (D.d) r = 0.12;
    if (D.behavior === 'front' && P.type === 'lob') r += 0.5;
    // thrown behind his back: he has to turn to find it. A man sitting in
    // the lane is reading your eyes, not turning
    const f = D.face || [0, 0, 1];
    if (!D.d && !D.jumper && dot2(f, unit(V.sub(P.E, D.pos))) < -0.3) r += 0.22;
    return Math.max(0.03, r);
  }
  function predict(W, j, T) {
    const O = W.off[j];
    if (O.state === 'cut' && O.route) {
      const v0 = Math.hypot(O.vel[0], O.vel[2]), vm = O.role.speed;
      const lag = v0 < vm ? (vm - v0) * (vm - v0) / (2 * 60) : 0;
      let p = flat(O.pos), left = Math.max(0, vm * T - lag), i = O.ri;
      while (left > 0 && i < O.route.length) {
        const q = O.route[i], d = gap(p, q);
        if (d >= left) { p = V.add(p, V.mul(unit(V.sub(q, p)), left)); left = 0; } else { p = q; left -= d; i++; }
      }
      return p;
    }
    if (O.state === 'dive' && O.diveTo) {
      const d = gap(O.pos, O.diveTo), s = O.role.speed * T;
      return d <= s ? O.diveTo : V.add(flat(O.pos), V.mul(unit(V.sub(O.diveTo, O.pos)), s));
    }
    if (O.state === 'relocate') {
      const d = gap(O.pos, O.home), s = 12 * T;
      return d <= s ? O.home : V.add(flat(O.pos), V.mul(unit(V.sub(O.home, O.pos)), s));
    }
    return flat(O.pos);
  }

  /* Can anybody get a hand on it? For each defender: how far he can lunge by
     each moment of the flight, against where the ball is and how high. Clear
     calls go the same way every time; only close ones are a coin flip. */
  function assess(W, P) {
    const worst = laneMargin(W, P);
    const m = worst.m;
    let outcome = 'clean';
    const pickLine = P.type === 'bullet' ? 1.7 : 1.25;
    if (m > pickLine) outcome = 'pick';
    else if (m > 0.35) outcome = W.rand() < (m - 0.35) / (pickLine - 0.35) * 0.6 ? 'pick' : 'tip';
    else if (m > -0.35) outcome = W.rand() < (m + 0.35) / 0.7 * 0.55 ? 'tip' : 'clean';
    // the man on the passer can get a finger on it, not catch it
    if (worst.close && outcome === 'pick') outcome = 'tip';
    return { outcome, di: worst.di, t: worst.t, margin: m };
  }
  function laneMargin(W, P) {
    const rcv = P.to != null ? W.off[P.to] : null;
    let worst = { di: -1, m: -99, t: 0 };
    const pdir = unit(V.sub(P.E, P.S));
    W.def.forEach((D, di) => {
      const r = passReact(W, D, P);
      // a man right on the passer (his own man, or the help that stopped the
      // drive) only gets a hand on it if you throw it at him. The help is
      // busy with the driver from a little further off, too.
      const close = gap(D.pos, P.S) < (D.h ? 6.5 : 4.5);
      const atHim = close ? dot2(pdir, unit(V.sub(D.pos, P.S))) : 1;
      const lunge = (D.jumper || D.gamble > 0 ? 6.8 : 4.4) * D.quick;
      const vmax = (D.jumper ? 15 : 13) * D.quick;
      const H = D.height || 1;
      const top0 = 8.4 * H, jump = 2.1 * H;
      const arm = 2.5 * (D.reachK || 1);
      let best = -99, at = 0;
      const steps = Math.ceil(P.T * 60);
      for (let k = 3; k <= steps; k++) {
        const t = Math.min(P.T, k / 60);
        const B = passPos(P, t);
        const top = top0 + (t > r + 0.22 ? jump : 0);
        if (B[1] > top) continue;
        let hand = B[1] < 1.6 ? 0.75 : B[1] < 3.0 ? 1.45 : B[1] <= top0 ? arm : 1.35;
        // a man jumping the lane is reaching for a chest pass: a bounce goes under him
        const greedy = D.jumper || D.gamble > 0 || D.denying;
        const under = greedy && B[1] < 3.3;
        if (under) hand = 0.3;
        const dd = gap(D.pos, B);
        // a man right on the passer only tips what you throw straight at him
        if (close && t < 0.32 && (P.overhead || !(atHim > 0.95 && (P.type === 'chest' || P.type === 'bullet')))) continue;
        // late in the flight, the receiver is there first if he's between them
        if (rcv && t > P.T * 0.55) {
          const rp = predict(W, P.to, t);
          if (gap(rp, B) + 1.0 < dd) continue;
        }
        // going up for one means gathering first: he can't also cover ground.
        // From a stance it takes a step to get going; a man already leaning
        // into the lane gets there quicker
        const cap = under ? 1.6 : B[1] > top0 ? lunge * 0.5 : lunge;
        const tau = Math.max(0, t - r), acc = (D.jumper || D.gamble > 0 ? 60 : greedy ? 44 : 34) * D.quick, tv = vmax / acc;
        const move = Math.min(cap, tau < tv ? 0.5 * acc * tau * tau : vmax * tau - vmax * tv / 2);
        const m = move + hand - dd + (under ? 0 : D.antic * 0.6);
        if (m > best) { best = m; at = t; }
      }
      if (close && best > 0.6) best = 0.6;
      if (best > worst.m) worst = { di, m: best, t: at, close };
    });
    return worst;
  }

  // ---------- catching ----------
  function resolvePass(W) {
    const P = W.ball.pass;
    const el = W.t - P.t0;
    const risk = P.risk;
    if ((risk.outcome === 'pick' || risk.outcome === 'tip') && el >= risk.t && !P.resolved) {
      P.resolved = true;
      const D = W.def[risk.di];
      D.mode = 'guard'; D.pickAt = null;
      const at = passPos(P, risk.t);
      if (risk.outcome === 'pick') {
        pop(W, 'Picked', '#ff5d4a', V.add(at, [0, 2.5, 0]), 1.2);
        W.story.push({ k: 'pass', P, result: 'pick', by: D.i });
        return turnover(W, 'Picked', null, at, true);
      }
      pop(W, 'Tipped', '#ff9a66', V.add(at, [0, 2.5, 0]), 1.0);
      // a tip either dies or squirts loose to him late
      const R = P.to != null ? W.off[P.to] : null;
      if (R && P.q !== 'none' && W.rand() < 0.42) {
        P.tipped = true;
        P.q = 'chase';
        W.ball.state = 'loose';
        W.ball.loose = { from: at, to: V.add(flat(R.pos), [0, 3, 0]), t0: W.t, T: 0.45, j: R.i };
        W.story.push({ k: 'tip', save: true });
        return;
      }
      W.story.push({ k: 'pass', P, result: 'tip' });
      return turnover(W, 'Tipped', null, at, true);
    }
    if (el < P.T) return;
    if (P.resolved) return;
    P.resolved = true;
    const R = P.to != null ? W.off[P.to] : null;
    const reachD = R ? gap(R.pos, P.E) : 99;
    if (!R || P.q === 'none' || reachD > 6) {
      W.story.push({ k: 'pass', P, result: 'away' });
      pop(W, 'Thrown away', '#ff5d4a', V.add(P.E, [0, 3, 0]), 1.0);
      return turnover(W, 'Thrown away', null, P.E, true);
    }
    let q = P.q;
    if (reachD > (P.type === 'bounce' ? 3.0 : 2.2) && q === 'money') q = 'reach';
    if (reachD > 3.8) q = 'chase';
    // a bounce pass to a shooter comes in low: he has to bring it up
    if (P.type === 'bounce' && q === 'money' && rimDist(R.pos) > 15) q = 'reach';
    if (q === 'chase' && W.rand() < 0.22) {
      pop(W, 'Fumbled', '#ff5d4a', V.add(R.pos, [0, 6, 0]), 1.0);
      W.story.push({ k: 'pass', P, result: 'fumble', q });
      return turnover(W, 'Fumbled', null, R.pos, true);
    }
    catchBall(W, R.i, q, P);
  }
  function catchBall(W, j, q, P) {
    const R = W.off[j];
    const prev = W.lastCatch;
    W.ball.state = 'held'; W.ball.pass = null; W.ball.holder = j;
    const from = W.handler;
    W.handler = j;
    R.q = q; R.catchT = 0; R.drove = false;
    R.state = 'hold'; R.route = null; R.meet = null;
    W.drive = null; W.help = null;
    W.def.forEach(D => { D.watch = false; if (D.h) { D.h = null; D.mode = 'guard'; } });
    setOnBall(W, j);
    // nobody near him and nobody getting there: the catch is a rhythm catch,
    // however you got it to him
    const q0 = q;
    const wide = !W.noShots && predictedContest(W, j, 'reach') < 0.2 && !W.def.some(D => gap(D.pos, R.pos) < 6);
    if (wide && q === 'reach') q = 'money';
    else if (wide && q === 'chase' && !(P && P.tipped)) q = 'reach';
    R.q = q;
    const tags = readTags(W, P, R, from, prev);
    W.lastCatch = { j, t: W.t, P, tags, from };
    const pt = V.add(R.pos, [0, 7.2, 0]);
    const qText = wide && q !== q0 ? 'Wide open' : { money: 'On the money', reach: 'Late', chase: P && P.tipped ? 'Saved it' : 'Behind him' }[q];
    if (qText) pop(W, qText, q === 'money' || wide ? '#7ee2a8' : '#ffd166', pt, 0.8);
    if (tags.includes('extra')) pop(W, 'Extra pass', '#7ee2a8', V.add(pt, [0, 1.3, 0]), 0.75);
    W.story.push({ k: 'pass', P, result: 'catch', q, wide, to: j, tags, name: nameOf(W, j) });
    tags.forEach(t => { W.tags[t] = true; });
    emit(W, { type: 'catch', j, q });
    if (W.noShots) return;
    const near = rimDist(R.pos);
    if (P && P.alley && near < 6.5) { after(W, 0.12, () => takeShot(W, j, 'dunk')); return; }
    if (near < 7.5) { after(W, q === 'money' ? 0.16 : 0.32, () => { if (W.handler === j && W.ball.state === 'held' && !W.drive) takeShot(W, j, near < 5.5 ? 'layup' : 'floater'); }); return; }
    if (near <= R.role.range) {
      // a man still ten feet away on a rhythm catch can't take it away
      const D = defOf(W, j), far = q === 'money' && D && !(D.d && D.d.arch.speed > 17) && gap(D.pos, R.pos) > 8.5;
      const open = far || predictedContest(W, j, q) < 0.42;
      if (open || W.board) R.autoShot = W.t + (q === 'money' ? 0.42 : q === 'reach' ? 0.7 : 0.95) + (open ? 0 : 0.6);
    }
  }
  function predictedContest(W, j, q) {
    const R = W.off[j], D = defOf(W, j);
    if (!D) return 0;
    // a man flying at him: he sees it and won't shoot into it
    if (D.flyClose || (D.d && D.d.arch.speed > 17)) return 1;
    const rel = (q === 'money' ? 0.62 : q === 'reach' ? 0.9 : 1.15);
    const sp = D.flyClose || (D.d && D.d.arch.speed > 17) ? 17 : W.scheme.close.speed;
    const g0 = gap(D.pos, R.pos);
    const g = Math.max(D.d ? D.d.arch.gap : 2, g0 - sp * Math.max(0, rel - 0.1) * 0.85);
    return clamp((7.2 - g) / 5, 0, 1) * (W.scheme.close.length || 1);
  }
  function readTags(W, P, R, from, prev) {
    const tags = [];
    if (!P) return tags;
    const near = rimDist(R.pos);
    const drove = !!(W.story.find(s => s.k === 'drive' && s.win) || W.story.find(s => s.k === 'help'));
    if (near > 15 && (W.tags.helpFrom || drove) && from === P.from) tags.push('kick');
    if (P.D > 27) tags.push('skip');
    if (Math.abs(Court3D.polarOf(R.pos).angle) > 70 && R.pos[2] < 11) tags.push('corner');
    if ((R.cutKind || P.to != null && W.story.some(s => s.k === 'cut' && s.j === R.i)) && near < 10) tags.push('backdoor');
    if (R.role.id === 'big' && near < 8) tags.push('dump');
    if (P.alley) tags.push('lob');
    if (P.type === 'bounce') tags.push('bounce');
    if (prev && prev.j === P.from && W.t - prev.t < P.T + 1.5 && !W.off[P.from].drove) tags.push('extra');
    if (W.tags.fakebit) tags.push('fake');
    return tags;
  }

  // ---------- pass fake ----------
  function fake(W) {
    if (W.over || W.ball.state !== 'held') return false;
    const O = handlerOf(W);
    O.autoShot = null; O.fakeT = 0;
    let bit = false;
    W.def.forEach(D => {
      if (D.d || D.h || D.gamble > 0) return;
      const m = W.off[D.man];
      const greedy = D.jumper || D.behavior === 'jump' || W.scheme.deny > 0 || D.behavior === 'deny';
      if (!greedy || gap(m.pos, O.pos) > 30) return;
      D.gamble = 0.9;
      D.gambleTo = V.add(flat(m.pos), V.mul(V.sub(flat(O.pos), flat(m.pos)), 0.42));
      bit = true;
      pop(W, 'He bit', '#7ee2a8', V.add(D.pos, [0, 7.2, 0]), 0.8);
    });
    if (bit) W.tags.fakebit = true;
    W.story.push({ k: 'fake', bit });
    return bit;
  }

  // ---------- shooting ----------
  function contestFor(W, j, kind) {
    const O = W.off[j], p = flat(O.pos);
    const dist = rimDist(p);
    const hk = kind === 'dunk' || kind === 'layup' ? 'layup' : kind === 'floater' ? 'floater' : 'jumper';
    let c = 0, by = null;
    W.def.forEach(D => {
      let k;
      if (D.d) {
        k = Defense.contest(D.d, p);
        // a little man on a big at the rim: he scores over him
        if (O.role.id === 'big' && hk !== 'jumper' && (D.height || 1) < 1) k *= 0.45;
      } else if (D.h) k = Help.contest(D.h, p, hk);
      else {
        const g = gap(D.pos, p);
        k = clamp((6.8 - g) / 4.8, 0, 1) * (D.height || 1) * (D.reachK || 1);
        const toRim = Court3D.dirToRim(p);
        if (dot2(V.sub(D.pos, p), toRim) < -0.8) k *= 0.35;
        if (dist > 11) k *= 0.85;
      }
      if (k > c) { c = k; by = D; }
    });
    return { c: clamp(c, 0, 1), by };
  }
  function takeShot(W, j, kind) {
    if (W.over || W.ball.state !== 'held') return;
    const O = W.off[j];
    const pos = flat(O.pos);
    const dist = rimDist(pos);
    if (kind === 'jumper' && dist < 11) kind = dist < 5.5 ? 'layup' : 'floater';
    const cf = contestFor(W, j, kind);
    const by = cf.by, c = kind === 'dunk' ? cf.c * 0.6 : cf.c;
    const three = Court3D.isThree(W.court, pos);
    const q = O.q || 'self';
    let b;
    if (kind === 'dunk') {
      const d = unit(V.sub(RIMF, pos));
      b = HoopPhysics.newBall([RIM.x - d[0] * 0.55, 10.9, RIM.z - d[2] * 0.55], [d[0] * 2.2, -7, d[2] * 2.2], { spin: -9 });
      if (c > 0.72 && W.rand() < (c - 0.72) * 1.4) b.blockAt = 0.04;
    } else {
      const R = kind === 'jumper' ? O.role.rating : O.role.finish;
      // a rhythm catch is a shooter's best look; reaching for it, or chasing it, costs touch
      const base = { money: 0.115, reach: 0.16, chase: 0.21, self: 0.1 }[q] || 0.12;
      const sig = base * (1 + Math.max(0, 80 - R) / 40) * (kind === 'jumper' ? 1 : 0.55);
      const e = gauss(W.rand) * sig - (q === 'chase' ? 0.03 : 0);
      const aim = gauss(W.rand) * (q === 'money' || q === 'self' ? 3.0 : 5.0);
      const ideal = HoopPhysics.idealFlick(dist);
      const shot = HoopPhysics.shoot({ shooter: pos, flickSpeed: ideal * (1 + e), angle: aim * Math.PI / 180, curl: kind === 'layup' ? 0.06 : 0, fade: false, touchK: 1, court: W.court, window: 0.12, aimDead: 4.5, contest: c, rating: R, rand: W.rand });
      b = HoopPhysics.newBall(shot.release, shot.vel, { touch: shot.touch || 0, spinOut: shot.spinOut || 0, spin: -9 });
      let bc = 0;
      if (by && by.d) bc = Defense.blockChance(by.d, c, shot.type.id);
      else if (by && by.h) bc = Help.blockChance(by.h, c, kind === 'floater' ? 'floater' : 'layup');
      else if (c > 0.75) bc = (c - 0.75) * (kind === 'jumper' ? 0.7 : 1.2);
      if (W.rand() < bc) b.blockAt = 0.15;
    }
    W.ball.state = 'shot'; W.ball.hoop = b;
    O.jumpT = 0; O.autoShot = null; O.state = 'shoot';
    W.drive = null;
    const assist = W.lastCatch && W.lastCatch.j === j && W.lastCatch.P && !O.drove && W.t - W.lastCatch.t < 3.2 ? W.lastCatch.from : null;
    W.shot = { j, kind, contest: c, three, dist, q, t0: W.t, assist, by: by ? by.i : null };
    // a bucket of your own: nobody passed you into it
    if (assist == null && !W.board) W.tags.score = true;
    W.def.forEach(D => { if (D.d) Defense.reactToShot(D.d, pos); if (D.h) Help.reactToShot(D.h, pos); });
    W.story.push({ k: 'shot', j, kind, contest: c, three, q, name: nameOf(W, j), you: j === 0 && !W.lastCatch });
    emit(W, { type: 'shot', j, kind });
  }
  function shotDone(W, b) {
    const S = W.shot;
    const made = b.result === 'made' && !b.blocked;
    const pts = made ? (S.three ? 3 : 2) : 0;
    const at = [RIM.x, RIM.y + 1.8, RIM.z];
    if (b.blocked) { /* announced */ }
    else if (made) {
      pop(W, S.kind === 'dunk' ? 'Slam' : b.swish ? 'Swish' : 'Good', '#ffffff', at, 1.15);
      pop(W, '+' + pts, S.three ? '#ffb547' : '#7ee2a8', [RIM.x, RIM.y + 3.6, RIM.z], 1.4);
      if (S.assist != null) pop(W, 'Assist', '#7ee2a8', [RIM.x, RIM.y + 5.2, RIM.z], 1.0);
    } else pop(W, b.rimHits || b.boardHits ? 'Rimmed out' : 'Miss', '#ff9a66', at, 1.0);
    W.story.push({ k: 'result', made, blocked: !!b.blocked, pts });
    endPossession(W, { made, points: pts, blocked: !!b.blocked });
  }
  function turnover(W, kind, text, at, quiet) {
    if (W.over) return;
    if (!quiet) pop(W, kind, '#ff5d4a', V.add(at || handlerOf(W).pos, [0, 7, 0]), 1.15);
    W.ball.state = 'dead';
    W.drive = null;
    W.story.push({ k: 'to', kind, text });
    emit(W, { type: 'sfx', name: kind === 'Charge' ? 'whistle' : 'bad' });
    endPossession(W, { turnover: kind, points: 0 });
  }
  function endPossession(W, r) {
    if (W.over) return;
    W.over = true;
    const S = W.shot;
    W.result = Object.assign({
      contest: S ? S.contest : null, q: S ? S.q : null, three: S ? S.three : false, kind: S ? S.kind : null,
      shooter: S ? S.j : null, assist: S && r.made ? S.assist : null, tags: Object.keys(W.tags).filter(k => k !== 'helpFrom' && k !== 'fakebit')
    }, r);
    W.result.grade = grade(W);
    emit(W, { type: 'end' });
  }

  // ---------- grading and the story ----------
  function grade(W) {
    const R = W.result;
    if (R.turnover) return 'F';
    const c = R.contest == null ? 1 : R.contest;
    const k = R.kind === 'dunk' ? c * 0.7 : c;
    let g = k < 0.24 ? 'A' : k < 0.44 ? 'B' : k < 0.68 ? 'C' : 'D';
    const down = { A: 'B', B: 'C', C: 'D', D: 'D' };
    if (R.q === 'reach' && g === 'A') g = 'B';
    if (R.q === 'chase') g = down[g];
    if (R.blocked && g === 'A') g = 'B';
    return g;
  }
  function narrate(W) {
    const parts = [];
    const R = W.result || {};
    let you = true;
    W.story.forEach(s => {
      if (s.k === 'drive') parts.push(s.win ? (s.crossed ? `${you ? 'You' : 'He'} crossed him up.` : `${you ? 'You' : 'He'} drove ${s.side < 0 ? 'left' : 'right'} and got by him.`) : `${you ? 'You' : 'He'} drove ${s.side < 0 ? 'left' : 'right'} and got cut off.`);
      else if (s.k === 'help') parts.push(`Help came off ${s.from}.`);
      else if (s.k === 'fake') parts.push(s.bit ? 'Pass fake, and he jumped the lane.' : 'Pass fake. Nobody bit.');
      else if (s.k === 'cut') { const who = cap(s.name || nameOf(W, s.j)); parts.push(s.kind === 'backdoor' ? `${who} went backdoor.` : `${who} cut behind his man.`); }
      else if (s.k === 'fly') parts.push('They flew out at the catch.');
      else if (s.k === 'tip') parts.push('Tipped, but it squirted through.');
      else if (s.k === 'pass') {
        const lab = s.P.alley ? 'Lob' : s.P.label;
        if (s.result === 'catch') {
          const tg = s.tags || [];
          const how = tg.includes('extra') ? 'Extra pass' : tg.includes('kick') ? 'Kicked it out' : lab;
          parts.push(`${how} to ${s.name}${s.wide ? ', wide open' : s.q === 'money' ? ', on the money' : s.q === 'reach' ? ', a little late' : ', behind him'}.`);
          you = false;
        } else if (s.result === 'pick') parts.push(`${lab}, picked off.`);
        else if (s.result === 'tip') parts.push(`${lab}, tipped away.`);
        else if (s.result === 'fumble') parts.push(`${lab}, behind him, and he fumbled it.`);
        else parts.push(`${lab} to nobody. Thrown away.`);
      } else if (s.k === 'shot') {
        const lab = Defense.contestLabel(s.contest).text.toLowerCase();
        const nm = s.kind === 'dunk' ? 'Alley-oop' : s.kind === 'layup' ? 'Layup' : s.kind === 'floater' ? 'Floater' : s.three ? 'Three' : 'Jumper';
        parts.push(`${nm}, ${lab}:`);
      } else if (s.k === 'result') {
        parts[parts.length - 1] += s.blocked ? ' blocked.' : s.made ? ' made.' : ' missed.';
        if (s.made && R.assist != null) parts.push('Assist.');
      } else if (s.k === 'to') parts.push(s.kind === 'Shot clock' ? 'Shot clock violation.' : s.kind === 'Charge' ? 'Offensive foul.' : s.text ? cap(s.text) + '.' : '');
    });
    parts.push(R.points ? `+${R.points}` : 'No points.');
    return parts.filter(Boolean).join(' ');
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function lesson(W) {
    const R = W.result || {}, sc = W.scheme;
    const hit = (R.tags || []).some(t => sc.answers.includes(t));
    if (R.turnover === 'Picked') {
      if (sc.deny > 0 || sc.jumpers) return `${sc.name} lives in the passing lanes you can see. ${sc.read}`;
      return `That one went right through a defender. Move him first with a drive or a fake, then throw it where the lane is. ${sc.read}`;
    }
    if (R.turnover === 'Shot clock') return `You held it too long. ${sc.read}`;
    if (R.tags && R.tags.includes('score') && R.made && (R.grade === 'A' || R.grade === 'B')) return sc.scoreRead || 'They gave you that one, and you took it.';
    if (hit && (R.grade === 'A' || R.grade === 'B')) return `That's the read against ${sc.name}. ${sc.read}`;
    return sc.read;
  }

  // ---------- update ----------
  function update(W, dt) {
    if (W.over && W.ball.state !== 'shot') { W.t += dt; ballUpdate(W, dt); offenseAI(W, dt); defenseAI(W, dt); return; }
    W.t += dt;
    const due = W.timers.filter(x => x.at <= W.t);
    if (due.length) { W.timers = W.timers.filter(x => x.at > W.t); due.forEach(x => x.fn()); }
    if (!W.over && W.ball.state !== 'shot') {
      W.clock -= dt;
      if (W.clock <= 0) { W.clock = 0; pop(W, 'Shot clock', '#ff5d4a', [RIM.x, RIM.y + 2, RIM.z], 1.2); turnover(W, 'Shot clock', 'ran out the clock', null, true); }
    }
    shake(W, dt);
    offenseAI(W, dt);
    defenseAI(W, dt);
    // the shooter rises if nobody tells him otherwise
    const H = handlerOf(W);
    if (H.autoShot != null && W.t >= H.autoShot && W.ball.state === 'held' && !W.drive) takeShot(W, W.handler, 'jumper');
    ballUpdate(W, dt);
  }
  function ballUpdate(W, dt) {
    const B = W.ball;
    if (B.state === 'held') {
      const O = handlerOf(W);
      B.dribT += dt * (W.drive ? 3.0 : 2.0);
      const f = O.face || [0, 0, -1], s = [f[2], 0, -f[0]];
      const up = Math.abs(Math.cos(B.dribT * Math.PI));
      const hold = O.catchT < 0.5 || O.autoShot != null;
      const hand = V.add(V.add(flat(O.pos), V.mul(s, hold ? 0 : 0.9)), V.mul(f, hold ? 0.9 : 0.7));
      B.p = [hand[0], hold ? 4.3 : Court3D.BALL_R + up * 2.6, hand[2]];
    } else if (B.state === 'pass') {
      B.p = passPos(B.pass, W.t - B.pass.t0);
      resolvePass(W);
    } else if (B.state === 'loose') {
      const L = B.loose, k = clamp((W.t - L.t0) / L.T, 0, 1);
      B.p = V.add(V.lerp3(L.from, L.to, k), [0, Math.sin(Math.PI * k) * 2, 0]);
      if (k >= 1) catchBall(W, L.j, 'chase', W.lastPass);
    } else if (B.state === 'shot' && B.hoop) {
      const b = B.hoop;
      if (b.blockAt && !b.blocked && b.t >= b.blockAt) {
        b.blocked = true;
        const dir = Court3D.dirToRim(W.shot ? W.off[W.shot.j].pos : b.p);
        const sd = W.rand() < 0.5 ? -1 : 1;
        b.v = [-dir[0] * 9 + dir[2] * sd * 7, 4, -dir[2] * 9 - dir[0] * sd * 7];
        pop(W, 'Blocked', '#ff5d4a', V.add(b.p, [0, 1.5, 0]), 1.3);
        emit(W, { type: 'sfx', name: 'block' });
      }
      HoopPhysics.advance(b, dt, W.court);
      b.events.forEach(ev => emit(W, { type: 'sfx', name: ev.type === 'score' ? 'swish' : ev.type, s: ev.s }));
      b.events.length = 0;
      if (b.blocked && !b.result && b.t > 0.9) b.result = 'miss';
      B.p = b.p;
      if (b.result && !b.handled) { b.handled = true; shotDone(W, b); }
    } else if (B.state === 'dead') {
      // stays where it died
    }
  }

  // ---------- Draw It Up ----------
  /* plan: { cut: { j, pts: [[x,z]...] } | null, pass: { to: [x,z], type } } */
  function runBoard(W, plan) {
    W.plan = plan;
    if (plan.cut && plan.cut.pts.length > 1) {
      const O = W.off[plan.cut.j];
      after(W, 0.12, () => {
        O.state = 'cut'; O.route = plan.cut.pts.slice(1).map(p => [p[0], 0, p[1]]); O.ri = 0; O.cutKind = 'drawn';
        W.story.push({ k: 'cut', j: O.i, kind: 'drawn', name: nameOf(W, O.i) });
      });
    }
    if (!plan.pass) return;
    const H = handlerOf(W);
    const to = [plan.pass.to[0], 0, plan.pass.to[1]];
    let release = 0.45;
    if (plan.cut && plan.cut.pts.length > 1) {
      // time it so it gets there when he does
      const pts = plan.cut.pts.map(p => [p[0], 0, p[1]]);
      const O = W.off[plan.cut.j];
      let s = 0, bestS = null, bestD = 99;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], L = gap(a, b);
        for (let k = 0; k <= 10; k++) { const p = V.lerp3(a, b, k / 10), d = gap(p, to); if (d < bestD) { bestD = d; bestS = s + L * k / 10; } }
        s += L;
      }
      if (bestD < 6) {
        const est = makePass(H.pos, to, plan.pass.type === 'chest' && gap(H.pos, to) > 27 ? 'skip' : plan.pass.type, {});
        // he starts the cut 0.12 s in and needs a step to get to full speed
        release = Math.max(0.3, 0.12 + O.role.speed / 120 + bestS / O.role.speed - est.T);
      }
    }
    after(W, release, () => {
      if (W.over || W.ball.state !== 'held') return;
      const v = V.sub(to, flat(H.pos));
      pass(W, { dir: unit(v), dist: Math.hypot(v[0], v[2]), type: plan.pass.type, bend: 0 });
    });
  }

  return { PASS, POSES, create, update, pass, makePass, passPos, assess, driveInput, fake, takeShot, runBoard, narrate, lesson, grade, spotPos, defOf, nameOf, rimDist, predict };
})();
