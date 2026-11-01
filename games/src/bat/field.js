/* Field: the ball comes off the bat and the park decides what it is. The
   batted ball flies with drag and backspin lift, bounces and rolls, and nine
   fielders try to get to it in time. Outs, hits and runs come from who gets
   where first, the same race you see from the stands: the fielder vs the
   ball, then the throw vs the runner. A play that's close either way is a
   bang-bang call; everything else goes the same way every time. */
const Field = (() => {
  const MPH = 1.46667, G = 32.174, R = 0.121;
  const DEG = Math.PI / 180;
  const BASES = { home: [0, 0, 0], first: [63.64, 0, 63.64], second: [0, 0, 127.28], third: [-63.64, 0, 63.64] };
  const MOUND = [0, 0, 59.5];
  const FENCE = { line: 330, gap: 375, center: 400, h: 10 };
  const CATCH_H = 8;

  function polar(deg, d) { return [d * Math.sin(deg * DEG), 0, d * Math.cos(deg * DEG)]; }
  function sprayOf(p) { return Math.atan2(p[0], p[2]) / DEG; }
  function distOf(p) { return Math.hypot(p[0], p[2]); }
  function flat(a, b) { return Math.hypot(a[0] - b[0], a[2] - b[2]); }
  function fenceDist(spray) {
    const a = Math.min(45, Math.abs(spray));
    return a <= 22.5 ? FENCE.center + (FENCE.gap - FENCE.center) * Math.pow(a / 22.5, 1.4) : FENCE.gap + (FENCE.line - FENCE.gap) * ((a - 22.5) / 22.5);
  }

  // where everyone stands, how fast they get going, and how far they reach
  const POSITIONS = {
    P: { id: 'P', name: 'pitcher', pos: [0, 0, 56], speed: 17, react: 0.45, reach: 2.6, dive: 1.0, arm: 100, inf: true },
    C: { id: 'C', name: 'catcher', pos: [0, 0, -3.2], speed: 17, react: 0.35, reach: 3.0, dive: 2.0, arm: 110, inf: true },
    '1B': { id: '1B', name: 'first', pos: polar(38.5, 106), speed: 18.5, react: 0.2, reach: 3.2, dive: 3.4, arm: 105, inf: true },
    '2B': { id: '2B', name: 'second', pos: polar(15, 147), speed: 19.5, react: 0.2, reach: 3.2, dive: 3.6, arm: 112, inf: true },
    SS: { id: 'SS', name: 'short', pos: polar(-14, 149), speed: 20, react: 0.2, reach: 3.2, dive: 3.6, arm: 126, inf: true },
    '3B': { id: '3B', name: 'third', pos: polar(-37.5, 113), speed: 18.5, react: 0.18, reach: 3.2, dive: 3.4, arm: 124, inf: true },
    LF: { id: 'LF', name: 'left', pos: polar(-28, 290), speed: 21.5, react: 0.5, reach: 3.2, dive: 3.6, arm: 102 },
    CF: { id: 'CF', name: 'center', pos: polar(0, 318), speed: 23, react: 0.48, reach: 3.2, dive: 3.8, arm: 106 },
    RF: { id: 'RF', name: 'right', pos: polar(28, 290), speed: 21.5, react: 0.5, reach: 3.2, dive: 3.6, arm: 112 }
  };
  const IDS = Object.keys(POSITIONS);

  /* The batted ball: drag plus backspin lift (Magnus), then bounces and a roll.
     Returns samples every 1/60 s: { t, p, air } and how it ended. */
  function fly(ev, la, spray, spin, from) {
    const v0 = ev * MPH;
    let p = (from || [0, 3, 1.4]).slice();
    let v = [v0 * Math.cos(la * DEG) * Math.sin(spray * DEG), v0 * Math.sin(la * DEG), v0 * Math.cos(la * DEG) * Math.cos(spray * DEG)];
    const kD = 0.5 * 0.00233 * 0.39 * 0.04585 / 0.00995;   // drag per foot of travel
    const kL = 0.5 * 0.00233 * 0.04585 / 0.00995;
    const omega = Math.abs(spin) * 2 * Math.PI / 60, sgn = spin >= 0 ? 1 : -1;
    const dt = 1 / 240;
    const out = [{ t: 0, p: p.slice(), air: true }];
    let t = 0, air = true, rolling = false, end = 'stop', land = null, hang = null, wall = false, apex = p[1];
    const fair = Math.abs(spray) <= 45;
    for (let step = 1; step < 240 * 14; step++) {
      t += dt;
      const s = Math.hypot(v[0], v[1], v[2]);
      if (air) {
        const a = [-kD * s * v[0], -G - kD * s * v[1], -kD * s * v[2]];
        const hz = Math.hypot(v[0], v[2]);
        if (hz > 1 && omega > 0) {
          // backspin axis is flat and square to the ball's path; lift is spin x velocity
          const u = [-v[2] / hz * sgn, 0, v[0] / hz * sgn];
          const S = R * omega / Math.max(20, s);
          const cl = 0.85 * S / (2.32 * S + 0.4);
          const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          const cm = Math.hypot(c[0], c[1], c[2]) || 1;
          const L = kL * cl * s * s;
          a[0] += L * c[0] / cm; a[1] += L * c[1] / cm; a[2] += L * c[2] / cm;
        }
        v = [v[0] + a[0] * dt, v[1] + a[1] * dt, v[2] + a[2] * dt];
      } else if (rolling) {
        const hz = Math.hypot(v[0], v[2]);
        const dec = (distOf(p) < 150 ? 7.5 : 9.5) * dt;
        if (hz <= dec) { v = [0, 0, 0]; } else { v[0] *= (hz - dec) / hz; v[2] *= (hz - dec) / hz; }
      } else {
        v[1] -= G * dt;
      }
      p = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt];
      apex = Math.max(apex, p[1]);
      // the wall
      const d = distOf(p), sp = sprayOf(p);
      if (fair && Math.abs(sp) <= 45 && d >= fenceDist(sp)) {
        if (p[1] > FENCE.h + R && air) { end = 'hr'; land = p.slice(); if (hang == null) hang = t; out.push({ t, p: p.slice(), air: true }); break; }
        if (!wall || d > fenceDist(sp) + 0.5) {
          // off the wall: the radial part comes back soft
          const rx = p[0] / d, rz = p[2] / d;
          const vr = v[0] * rx + v[2] * rz;
          v[0] -= 1.35 * vr * rx; v[2] -= 1.35 * vr * rz;
          v[0] *= 0.7; v[2] *= 0.7;
          const back = fenceDist(sp) - 0.6;
          p[0] = rx * back; p[2] = rz * back;
          wall = true;
          if (hang == null) hang = t;
          if (!land) land = p.slice();
        }
      }
      // out of play in foul ground: into the seats or the backstop
      if (!fair) {
        const perp = Math.abs(p[0]) * Math.SQRT1_2 - p[2] * Math.SQRT1_2;
        if (p[2] < -58 || perp > 50 || d > 360) { end = 'seats'; if (!land) land = p.slice(); out.push({ t, p: p.slice(), air }); break; }
      }
      // the ground
      if (p[1] <= R && v[1] < 0) {
        p[1] = R;
        if (air) { air = false; if (!land) land = p.slice(); if (hang == null) hang = t; }
        const infield = d < 155;
        const e = infield ? 0.48 : 0.4;
        const steep = Math.min(1, Math.abs(v[1]) / (Math.hypot(v[0], v[2]) + 1));
        v[1] = -v[1] * e;
        const f = (infield ? 0.86 : 0.74) - steep * 0.12;
        v[0] *= f; v[2] *= f;
        if (Math.abs(v[1]) < 3.5) { v[1] = 0; rolling = true; }
      }
      if (step % 4 === 0) out.push({ t, p: p.slice(), air });
      if (rolling && v[0] === 0 && v[2] === 0) break;
    }
    if (!land) land = p.slice();
    if (hang == null) hang = t;
    const landD = end === 'hr' ? Math.round(projectHr(land, v)) : Math.round(distOf(land));
    return { path: out, end, land, hang, dist: landD, apex, wall, fair, spray, ev, la };
  }
  // a home run's distance is where it would have landed if the seats weren't there
  function projectHr(p, v) {
    let q = p.slice(), w = v.slice();
    const dt = 1 / 120;
    for (let i = 0; i < 1200 && q[1] > 0; i++) { w[1] -= G * dt * 0.85; q = [q[0] + w[0] * dt, q[1] + w[1] * dt, q[2] + w[2] * dt]; }
    return distOf(q);
  }

  // When could this fielder get to the ball? The earliest moment the ball is
  // low enough to catch (or field on the ground) and he's had time to run there.
  function intercept(path, F, opts) {
    const o = opts || {};
    let best = null, dive = null;
    for (let i = 1; i < path.length; i++) {
      const s = path[i];
      if (s.out) break;
      const okH = s.air ? s.p[1] <= CATCH_H : s.p[1] <= 3.5;
      if (!okH) continue;
      if (o.foulOnly && Math.abs(sprayOf(s.p)) <= 45 && distOf(s.p) > 20) continue;
      const d = flat(F.pos, s.p);
      // outfielders lose a step going back over their heads
      let sp = F.speed;
      if (!F.inf && d > 1) {
        const fl = Math.hypot(F.pos[0], F.pos[2]);
        const back = ((s.p[0] - F.pos[0]) * F.pos[0] + (s.p[2] - F.pos[2]) * F.pos[2]) / (d * fl);
        if (back > 0) sp *= 1 - 0.28 * back;
      }
      const react = F.react + (o.liner && !F.inf ? 0.25 : 0);
      const need = react + Math.max(0, d - F.reach) / sp;
      if (need <= s.t) { best = { i, t: s.t, p: s.p.slice(), air: s.air, dive: false, margin: s.t - need, run: need }; break; }
      if (!dive) {
        const needD = react + Math.max(0, d - F.reach - F.dive) / sp;
        if (needD <= s.t) dive = { i, t: s.t, p: s.p.slice(), air: s.air, dive: true, margin: s.t - needD, run: needD };
      }
    }
    // a diving play only counts if he couldn't simply get there a moment later
    if (dive && (!best || best.t - dive.t > (dive.air ? 0 : 0.5) || (dive.air && !best.air))) return dive;
    return best;
  }

  const RUN = {
    batter: [0, 4.3, 8.1, 11.9, 15.7],
    fromFirst: { second: 3.5, third: 7.2, home: 10.9 },
    fromSecond: { third: 3.3, home: 7.0 },
    fromThird: { home: 3.5 }
  };
  function throwTime(F, from, to, dove) {
    const d = flat(from, to);
    const arm = d > 190 ? F.arm * 0.88 : F.arm;
    return (F.inf ? 0.48 : 0.72) + (dove ? 0.3 : 0) + d / arm;
  }
  // does the runner beat the ball? Close plays, within a tenth of a second, go either way.
  function safe(runner, ball, rand) {
    const m = ball - runner;
    if (m > 0.1) return true;
    if (m < -0.1) return false;
    return rand() < 0.5 + m * 4;
  }

  function whereWords(res) {
    const sp = res.spray, d = res.dist;
    if (res.kind === 'hr') return sp < -30 ? 'to left' : sp < -10 ? 'to left-center' : sp <= 10 ? 'to center' : sp <= 30 ? 'to right-center' : 'to right';
    if (res.fielder && res.out) return 'to ' + POSITIONS[res.fielder].name;
    if (res.outType === 'ground' || d < 150) {
      if (res.fielder && POSITIONS[res.fielder].inf) return 'to ' + POSITIONS[res.fielder].name;
      return sp < -8 ? 'through the left side' : sp > 8 ? 'through the right side' : 'up the middle';
    }
    if (sp < -36) return 'down the left-field line';
    if (sp < -20) return 'to left';
    if (sp < -7) return d > 300 ? 'into the left-center gap' : 'to left-center';
    if (sp <= 7) return 'to center';
    if (sp <= 20) return d > 300 ? 'into the right-center gap' : 'to right-center';
    if (sp <= 36) return 'to right';
    return 'down the right-field line';
  }

  /* play(contact, state, rand) -> what happened.
     state: { outs, runners: [on1st, on2nd, on3rd], running (hit-and-run), bats } */
  function play(c, state, rand) {
    rand = rand || Math.random;
    const st = { outs: state.outs || 0, runners: (state.runners || [0, 0, 0]).slice(), running: !!state.running };
    const flight = fly(c.ev, c.la, c.spray, c.spin, [c.bx || 0, Math.max(1, c.by || 2.5), Pitch.PLATE_Z]);
    const res = { flight, ev: c.ev, la: c.la, spray: c.spray, dist: flight.dist, hang: flight.hang, runs: 0, rbi: 0, outs: 0, events: [], runnersAfter: [0, 0, 0] };
    const hitType = c.la > 50 ? 'pop' : c.la >= 25 ? 'fly' : c.la >= 10 ? 'line' : 'ground';
    res.hitType = hitType;

    // foul ball: still catchable if someone gets under it
    if (!flight.fair) {
      let catcher = null;
      for (const id of ['C', '1B', '3B', 'LF', 'RF']) {
        const F = POSITIONS[id];
        const x = intercept(flight.path, F, { foulOnly: true });
        if (x && x.air && (!catcher || x.t < catcher.x.t)) catcher = { id, x };
      }
      if (catcher && (!catcher.x.dive || rand() < 0.4)) {
        Object.assign(res, { kind: 'foulout', out: true, outs: 1, fielder: catcher.id, outType: hitType === 'ground' ? 'pop' : hitType, catchT: catcher.x.t, catchP: catcher.x.p, dove: catcher.x.dive });
        res.runnersAfter = st.runners.slice();
        res.label = 'Foul out';
        res.where = 'to ' + POSITIONS[catcher.id].name + ' in foul ground';
        return res;
      }
      Object.assign(res, { kind: 'foul', label: 'Foul ball' });
      res.runnersAfter = st.runners.slice();
      return res;
    }

    if (flight.end === 'hr') {
      const on = st.runners.reduce((a, b) => a + b, 0);
      Object.assign(res, { kind: 'hr', label: on === 3 ? 'Grand slam' : 'Home run', runs: on + 1, rbi: on + 1, bases: 4 });
      res.where = whereWords(res);
      return res;
    }

    // who gets there first: a clean catch in the air, then a diving try, then whoever fields it on the ground
    // a line drive freezes an outfielder for a beat: in or back?
    const liner = c.la >= 8 && c.la < 22;
    let all = IDS.map(id => ({ id, x: intercept(flight.path, POSITIONS[id], { liner }) })).filter(o => o.x);
    const first = list => list.reduce((a, b) => (!a || b.x.t < a.x.t ? b : a), null);
    let best = first(all.filter(o => o.x.air && !o.x.dive));
    // a diving try is a close play: it goes either way, and if it comes up
    // empty the ball keeps going to whoever is next
    const tried = [];
    for (let guard = 0; !best && guard < 4; guard++) {
      const clean = first(all.filter(o => !o.x.air && !o.x.dive));
      const dive = first(all.filter(o => o.x.dive && (!clean || o.x.t < clean.x.t - 0.25)));
      if (!dive) { best = clean || first(all); break; }
      if (rand() < 0.3 + 0.5 * Math.min(1, dive.x.margin / 0.25)) { best = dive; break; }
      tried.push(dive.id); res.missedDive = dive.id;
      const after = flight.path.filter(s => s.t > dive.x.t + 0.05);
      all = IDS.filter(id => !tried.includes(id)).map(id => ({ id, x: intercept([flight.path[0]].concat(after), POSITIONS[id], { liner }) })).filter(o => o.x);
      best = first(all.filter(o => o.x.air && !o.x.dive));
    }

    const F = best ? POSITIONS[best.id] : POSITIONS.CF;
    const x = best ? best.x : { t: flight.path[flight.path.length - 1].t, p: flight.path[flight.path.length - 1].p, air: false, dive: false, margin: 0 };
    res.fielder = F.id; res.fieldT = x.t; res.fieldP = x.p; res.dove = x.dive;
    const caught = x.air;
    const r = st.runners;
    const after = r.slice();
    let runs = 0;

    if (caught) {
      res.kind = 'out'; res.out = true; res.outs = 1;
      res.outType = hitType === 'ground' ? 'line' : hitType;
      if (F.inf && hitType === 'fly') res.outType = c.la > 40 ? 'pop' : 'fly';
      const outsNow = st.outs + 1;
      res.label = res.outType === 'pop' ? 'Pop out' : res.outType === 'line' ? 'Line out' : 'Fly out';
      if (outsNow < 3) {
        // hit-and-run runner caught off the bag
        if (r[0] && st.running) {
          const away = Math.min(85, 12 + 25 * Math.max(0, x.t + 1.1 - 0.3));
          const back = x.t + 0.35 + away / 25;
          const thr = x.t + throwTime(F, x.p, BASES.first, x.dive);
          if (thr < back) { res.outs = 2; after[0] = 0; res.doubledOff = true; res.label = res.outType === 'line' ? 'Line-drive double play' : 'Double play'; }
        }
        if (res.outs === 1 || outsNow + 1 < 3) {
          if (r[2] && !F.inf) {
            const runT = x.t + RUN.fromThird.home;
            const thr = x.t + throwTime(F, x.p, BASES.home, x.dive);
            if (thr - runT > 0.35) { after[2] = 0; runs++; res.sacFly = true; }
            else if (thr - runT > -0.25) {
              if (safe(runT, thr, rand)) { after[2] = 0; runs++; res.sacFly = true; } else { after[2] = 0; res.outs++; res.outAtHome = true; }
            }
          }
          if (r[1] && !after[2] && !F.inf && (F.id === 'CF' || F.id === 'RF')) {
            const runT = x.t + RUN.fromSecond.third;
            const thr = x.t + throwTime(F, x.p, BASES.third, x.dive);
            if (thr - runT > 0.3) { after[1] = 0; after[2] = 1; res.tagged = true; }
          }
        }
      }
      res.runs = runs; res.rbi = res.sacFly ? runs : 0;
      res.runnersAfter = after;
      res.where = whereWords(Object.assign({}, res, { out: true }));
      res.catchT = x.t; res.catchP = x.p;
      return res;
    }

    // on the ground (or it dropped in)
    const ground = !x.air && F.inf && hitType !== 'fly';
    const tf = x.t;
    if (ground || (F.inf && !x.air)) {
      res.outType = 'ground';
      const forced = [r[0], r[0] && r[1], r[0] && r[1] && r[2]];
      const h = st.running && r[0];
      const run1 = h ? 1.9 : RUN.fromFirst.second;
      const nearBag = (bag, ids) => ids.includes(F.id) && flat(x.p, BASES[bag]) < 14;
      const toBag = (bag) => nearBag(bag, ['SS', '2B', '1B', '3B']) ? tf + 0.2 + flat(x.p, BASES[bag]) / F.speed : tf + throwTime(F, x.p, BASES[bag], x.dive);
      const at1 = F.id === '1B' && flat(x.p, BASES.first) < 30 ? tf + 0.15 + flat(x.p, BASES.first) / F.speed : toBag('first');
      const batter1 = RUN.batter[1] * (state.bats === 'L' ? 0.97 : 1);
      let outs = 0;
      const outFirst = !safe(batter1, at1, rand);
      // lead runner first when there's a force at second and time to turn two
      if (r[0] && !h && st.outs < 2 && F.id !== 'C' && F.id !== '1B') {
        const at2 = toBag('second');
        if (!safe(run1, at2, rand)) {
          outs = 1; after[0] = 0;
          const relay = at2 + 0.5 + 90 / 125;
          if (!safe(batter1, relay, rand)) { outs = 2; res.dp = true; }
          else after[0] = 1;   // batter safe at first on the fielder's choice
          if (!res.dp) res.fc = true;
        } else if (outFirst) { outs = 1; after[0] = 0; after[1] = 1; }
        else { after[0] = 1; after[1] = 1; res.infieldHit = true; }
      } else {
        if (outFirst) { outs = 1; if (forced[0]) { after[1] = 1; after[0] = 0; } }
        else { res.infieldHit = true; if (r[0]) { after[1] = 1; } after[0] = 1; }
      }
      const outsNow = st.outs + outs;
      // runners who weren't forced
      if (outsNow < 3) {
        const rightSide = F.id === '1B' || F.id === '2B';
        if (r[2] && !forced[2]) {
          if ((st.outs < 2 && F.id !== '3B' && F.id !== 'P' && F.id !== 'C') || tf > 1.4) { after[2] = 0; runs++; }
        } else if (r[2] && forced[2] && outs < 2) { runs++; }
        if (r[1] && !forced[1]) {
          if ((rightSide || tf > 1.5 || h) && !after[2]) { after[1] = 0; after[2] = 1; res.moved = true; }
        } else if (r[1] && forced[1]) { after[2] = 1; after[1] = r[0] ? 1 : 0; }
        if (h && r[0] && !res.dp) { after[0] = res.infieldHit ? 1 : 0; after[1] = 1; if (rightSide && !after[2]) { after[1] = 0; after[2] = 1; } res.moved = true; }
      }
      if (res.infieldHit && !outs) {
        res.kind = 'single'; res.label = 'Infield single'; res.bases = 1;
      } else {
        res.kind = res.dp ? 'dp' : res.fc ? 'fc' : 'out'; res.out = true;
        res.label = res.dp ? 'Double play' : res.fc ? "Fielder's choice" : 'Ground out';
      }
      res.outs = outs;
      res.runs = outsNow >= 3 ? 0 : runs;
      res.rbi = res.dp ? 0 : res.runs;
      res.runnersAfter = outsNow >= 3 ? [0, 0, 0] : after;
      res.throwTo = res.dp ? ['second', 'first'] : res.fc ? ['second'] : ['first'];
      res.where = whereWords(Object.assign({}, res, { out: res.out }));
      return res;
    }

    // a hit to the outfield: the batter runs until the throw would beat him
    const arr = b => tf + throwTime(F, x.p, BASES[b], x.dive);
    let bases = 1;
    if (RUN.batter[2] < arr('second') - 0.3) bases = 2;
    if (bases === 2 && RUN.batter[3] < arr('third') - 0.3) bases = 3;
    if (bases === 3 && RUN.batter[4] < arr('home') - 0.4) bases = 4;
    const two = st.outs === 2;
    const nr = [0, 0, 0];
    // lead runners first; nobody passes anybody
    if (r[2]) runs++;
    if (r[1]) {
      if (bases >= 2 || RUN.fromSecond.home - (two ? 0.35 : 0) < arr('home') - 0.15) runs++;
      else nr[2] = 1;
    }
    if (r[0]) {
      if (bases >= 3) runs++;
      else if (bases === 2) { if (RUN.fromFirst.home - (two ? 0.4 : 0) - (st.running ? 1.6 : 0) < arr('home') - 0.15) runs++; else nr[2] = 1; }
      else if (!nr[2] && RUN.fromFirst.third - (st.running ? 1.6 : 0) < arr('third') - 0.15) nr[2] = 1;
      else nr[1] = 1;
    }
    if (bases < 4) nr[bases - 1] = 1;
    else runs++;
    res.kind = ['single', 'double', 'triple', 'hr'][bases - 1];
    res.label = bases === 4 ? 'Inside-the-park home run' : ['Single', 'Double', 'Triple'][bases - 1];
    res.bases = bases; res.runs = runs; res.rbi = runs; res.runnersAfter = nr;
    res.where = whereWords(res);
    return res;
  }

  return { BASES, MOUND, FENCE, POSITIONS, IDS, polar, sprayOf, distOf, fenceDist, fly, intercept, play, RUN };
})();
