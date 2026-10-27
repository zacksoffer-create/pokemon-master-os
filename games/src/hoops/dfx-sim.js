/* LockdownSim: the defensive game's world. You guard one scorer (data in
   dfx-scorers.js) who sizes you up, jabs, crosses, drives, pump fakes, steps
   back and shoots. You slide, slice at the ball, jump, hold still to wall up
   and box out. The ball is the scoring game's physics, so misses come off
   the real rim.

   Everything here is feet and seconds and knows nothing about the screen.
   The engine turns gestures into input(), slice() and jump().

   Frames: u points from him to the rim, s is screen right when you face him
   (you stand between him and the rim). gap is how far in front of him you
   are along u, lat how far to the side along s. */
const LockdownSim = (() => {
  const { V, RIM } = Court3D;
  const SC = LockdownScorers;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const GP = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const letter = x => x >= 3.5 ? 'A' : x >= 2.5 ? 'B' : x >= 1.5 ? 'C' : x >= 0.5 ? 'D' : 'F';
  // you: slide speed, how fast you get there, standing reach, jump, time in the air
  const YOU = { vLat: 11, vDep: 7.5, acc: 60, reach: 8.6, jump: 2.3, airT: 0.62, chase: 13.5 };
  const DRIBBLE_T = 0.27;   // one trip hand to floor

  const sideWord = s => s > 0 ? 'right' : 'left';
  const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const rimDist = p => Math.hypot(p[0] - RIM.x, p[2] - RIM.z);
  function frame(p) { const u = Court3D.dirToRim(p); return { u, s: [u[2], 0, -u[0]] }; }
  function rotY(vec, ang) { const c = Math.cos(ang), s = Math.sin(ang); return [vec[0] * c + vec[2] * s, vec[1], -vec[0] * s + vec[2] * c]; }

  // ---------- setup ----------
  const START_SPOTS = { lockdown: ['top', 'lw', 'rw', 'le', 're'], pickpocket: ['top', 'lw', 'rw'], swat: ['le', 're', 'ft'], glass: ['top'] };
  function create(o) {
    const arch = SC.SCORERS[o.scorer] || SC.SCORERS.shooter;
    const rand = o.rand || Math.random;
    const court = o.court || Court3D.COURTS.park;
    const kind = o.kind || 'lockdown';
    const spots = START_SPOTS[kind] || START_SPOTS.lockdown;
    const spotId = o.spot || spots[Math.floor(rand() * spots.length)];
    const sp = Court3D.spotInfo(court, spotId);
    let d0 = sp.dist;
    if (kind === 'lockdown' || kind === 'pickpocket') d0 = Math.max(Math.min(sp.dist, arch.big ? 16 : 23.5), arch.big ? 14 : 20);
    if (kind === 'swat') d0 = o.d0 || 14;
    if (kind === 'glass') d0 = 9;
    const start = Court3D.polar(sp.angle, d0);
    const { u, s } = frame(start);
    const gap0 = o.gap0 != null ? o.gap0 : (kind === 'glass' ? 2.2 : 4.0);
    const youPos = V.add(start, V.mul(u, gap0)); youPos[1] = 0;
    const w = {
      kind, arch, court, rand, t: 0, clock: o.clock || 11, phase: 'duel', over: false, cam: kind === 'glass' ? 'rim' : 'duel', camAt: 0,
      off: {
        pos: start.slice(), vel: [0, 0, 0], face: u.slice(), pose: Object.assign({}, SC.POSES.set), poseName: 'set', poseSide: 1,
        lean: 0, lift: 0, hand: rand() < 0.5 ? 1 : -1, act: null, skin: SC.SKIN[Math.floor(rand() * SC.SKIN.length)], hair: SC.HAIR[Math.floor(rand() * SC.HAIR.length)],
        dribbleT: rand() * DRIBBLE_T * 2, crash: arch.crash
      },
      you: {
        pos: youPos, vel: [0, 0, 0], weight: 0, jx: 0, jy: 0, held: false, still: 0, setT: 0, air: false, airStart: -9, jumpK: 1, reachX: 0,
        offBal: 0, offDir: 0, stuck: 0, chasing: false, slideAt: null, box: null, lastSlice: -9
      },
      ball: { state: 'dribble', p: start.slice(), ph: null, by: null },
      events: [], story: [], dec: [], result: null, script: (o.script || []).slice(), noShots: kind === 'pickpocket',
      shotInfo: null, rebound: null, gaps: [], fts: null, putbacks: 0, tags: []
    };
    w.off.act = { k: 'size', t: 0, dur: o.firstSize != null ? o.firstSize : 0.8 + rand() * 0.4 };
    if (kind === 'glass') startGlass(w, o);
    if (o.beaten) {
      // already a step past you: chase him down
      const sd = o.beaten > 0 ? 1 : -1;
      w.off.pos = V.add(V.add(youPos, V.mul(s, sd * 1.6)), V.mul(u, 0.6)); w.off.pos[1] = 0;
      w.off.act = { k: 'finish', side: sd, t: 0 };
      w.you.chasing = true; w.cam = 'rim'; w.camAt = -1;
      w.clock = 99;
    }
    placeBall(w);
    return w;
  }

  // ---------- story, decisions, events ----------
  function say(w, k, text, extra) { w.story.push(Object.assign({ k, t: w.t, text }, extra || {})); }
  function decide(w, k, g, extra) { w.dec.push(Object.assign({ k, g, t: w.t }, extra || {})); }
  function pop(w, text, color, at, size) { w.events.push({ type: 'pop', text, color, at: at || V.add(w.off.pos, [0, 7.2, 0]), size: size || 1 }); }
  function sfx(w, name, s) { w.events.push({ type: 'sfx', name, s }); }
  const GOOD = '#7ee2a8', BAD = '#ff7a66', WARN = '#ffd166';

  // ---------- geometry ----------
  function rel(w) {
    const { u, s } = frame(w.off.pos);
    const d = V.sub(w.you.pos, w.off.pos);
    return { u, s, gap: d[0] * u[0] + d[2] * u[2], lat: d[0] * s[0] + d[2] * s[2], dist: Math.hypot(d[0], d[2]) };
  }

  // ---------- the scorer's mind ----------
  function weightedPick(w, opts) {
    const tot = opts.reduce((a, o) => a + o[1], 0);
    let r = w.rand() * tot;
    for (const o of opts) { r -= o[1]; if (r <= 0) return o[0]; }
    return opts[opts.length - 1][0];
  }
  function parse(str) {
    const [k, a] = String(str).split(':');
    if (k === 'size') return { k: 'size', dur: +a || 0.6 };
    if (k === 'jab') return { k: 'jab', side: +a || 1 };
    if (k === 'drive') return { k: 'drive', side: +a || 1 };
    if (k === 'cross') return { k: 'cross', kind: a || 'front', go: false };
    if (k === 'crossgo') return { k: 'cross', kind: a || 'front', go: true };
    if (k === 'attack') return { k: 'attack' };
    if (k === 'rise') return { k: 'rise' };
    if (k === 'pump') return { k: 'pump', then: a || null };
    if (k === 'step') return { k: 'step' };
    if (k === 'hold') return { k: 'size', dur: 99 };
    return { k: 'size', dur: 0.6 };
  }
  function choose(w) {
    const O = w.off, A = w.arch, Y = w.you, R = rel(w);
    if (w.script.length) return parse(w.script.shift());
    if (w.kind === 'pickpocket') return w.rand() < 0.55 ? { k: 'cross', kind: w.rand() < A.handle.protect ? (w.rand() < 0.5 ? 'legs' : 'back') : 'front' } : { k: 'size', dur: 0.4 + w.rand() * 0.5 };
    if (w.kind === 'swat') return w.rand() < A.pump ? { k: 'pump' } : (A.id === 'rim' ? { k: 'attack' } : { k: 'rise' });
    // your weight is going one way: he goes the other
    if (Math.abs(Y.weight) > 0.55 && A.weights.drive > 0) return { k: 'drive', side: -Math.sign(Y.weight), counter: true };
    const far = rimDist(O.pos);
    // late clock: he has to get one up
    if (w.clock < 1.7) return far <= A.range + 2 ? { k: 'rise', forced: true } : { k: 'drive', side: R.lat > 0 ? -1 : 1 };
    // open: shooters rise
    if (far <= A.range && R.gap >= A.shootGap && w.rand() < 0.85) return w.rand() < A.pump ? { k: 'pump' } : { k: 'rise' };
    // crowd the step-back artist and he steps back
    if (A.stepGap && R.gap < A.stepGap && far <= A.range + 1) return { k: 'step' };
    // if you're shading one side, he takes the other
    const open = Math.abs(R.lat) > 0.7 ? -Math.sign(R.lat) : (w.rand() < 0.5 ? -1 : 1);
    const k = weightedPick(w, [['jab', A.weights.jab], ['drive', A.weights.drive], ['cross', A.weights.cross], ['rise', far <= A.range ? A.weights.rise : 0], ['attack', A.weights.attack], ['size', 0.6]]);
    if (k === 'jab') return { k, side: w.rand() < 0.5 ? -1 : 1 };
    if (k === 'drive') return { k, side: open };
    if (k === 'cross') return { k, kind: w.rand() < A.handle.protect ? (w.rand() < 0.5 ? 'legs' : 'back') : 'front', go: w.rand() < 0.45 };
    if (k === 'rise') return w.rand() < A.pump ? { k: 'pump' } : { k: 'rise' };
    if (k === 'attack') return { k };
    return { k: 'size', dur: 0.4 + w.rand() * 0.5 };
  }
  function setAct(w, a) {
    a.t = 0; w.off.act = a;
    if (a.k === 'drive') { a.ph = 'tell'; a.tell = a.tell != null ? a.tell : (a.counter ? 0.08 : w.arch.tellT); }
    if (a.k === 'cross') a.T = a.kind === 'front' ? 0.4 : 0.34;
    if (a.k === 'jab') a.T = 0.44;
  }

  // ---------- the ball in his hands ----------
  // where the ball is, in his frame: x screen right, y up, z toward you
  function ballLocal(w) {
    const O = w.off, a = O.act, A = w.arch, H = A.handle;
    const high = H.high || 0;
    const top = 3.0 + high * 0.9, out = 0.75 + high * 0.6;
    const bounce = ph => { const k = (ph % (2 * DRIBBLE_T)) / (2 * DRIBBLE_T); return 0.4 + (top - 0.4) * Math.abs(Math.cos(Math.PI * k)); };
    if (!a) return [O.hand * 1.05, bounce(O.dribbleT), out];
    switch (a.k) {
      case 'cross': {
        const k = clamp(a.t / a.T, 0, 1), x = O.hand * (1.05 - 2.1 * k);
        if (a.kind === 'front') return [x, 0.9 + 1.4 * Math.abs(k - 0.5), out + 0.55 * Math.sin(Math.PI * k)];
        if (a.kind === 'legs') return [x, 0.7 + 1.0 * Math.abs(k - 0.5), -0.1];
        return [x, 1.6, -0.9 * Math.sin(Math.PI * k) - 0.2];
      }
      case 'gather': case 'rise': case 'pump': case 'step': {
        if (a.k === 'pump' && a.ph === 'up') return [0.05, 6.75, 0.45];
        if (a.k === 'rise' && a.ph === 'up') return [0.1, 7.6 + O.lift, 0.55];
        if (a.k === 'step') return [0.2, 4.2, 0.35];
        return [0.15, 4.4, 0.75];
      }
      case 'drive': case 'attack': case 'finish':
        if (a.ph === 'tell' || a.k === 'attack' || a.ph === 'go' || a.ph === 'by') return [(a.side || O.hand) * 1.1, bounce(O.dribbleT), out + 0.3];
        return [O.hand * 1.05, bounce(O.dribbleT), out];
      default: return [O.hand * 1.05, bounce(O.dribbleT), out];
    }
  }
  function placeBall(w) {
    const B = w.ball;
    if (B.state === 'dribble' || B.state === 'held') {
      const { u, s } = frame(w.off.pos), l = ballLocal(w);
      B.p = [w.off.pos[0] + s[0] * l[0] + u[0] * l[2], l[1], w.off.pos[2] + s[2] * l[0] + u[2] * l[2]];
    } else if (B.state === 'yours') B.p = V.add(w.you.pos, [0, 5.2, 0]);
    else if (B.state === 'his') B.p = V.add(w.off.pos, [0, 5.0, 0]);
  }
  /* How much of the ball you can get to right now (0..1). Out in front on a
     lazy crossover is the most; between the legs, behind the back, or up in
     two hands is almost none. */
  function exposure(w) {
    const O = w.off, a = O.act, H = w.arch.handle;
    if (w.ball.state !== 'dribble') return w.ball.state === 'held' ? 0.03 : 0;
    if (!a) return H.base;
    if (a.k === 'cross') {
      if (a.kind !== 'front') return 0.06;
      const k = a.t / a.T;
      return k > 0.18 && k < 0.82 ? H.cross : H.base;
    }
    if (a.k === 'drive' && (a.ph === 'go' || a.ph === 'by')) return Math.max(0.3, H.base + (H.high || 0) * 0.3);
    if (a.k === 'jab') return H.base * 0.75;
    if (a.k === 'attack') return 0.12;
    return H.base;
  }

  // ---------- input ----------
  /* jx, jy: the joystick (-1..1; jy up is into the screen). r, f: the camera's
     right and forward on the floor, so a drag means the same thing in the
     duel and in the rebound view. held: a finger is down; still: and not moving. */
  function input(w, o) {
    const Y = w.you;
    Y.jx = clamp(o.jx || 0, -1, 1); Y.jy = clamp(o.jy || 0, -1, 1);
    Y.camR = o.r || null; Y.camF = o.f || null;
    Y.held = !!o.held; Y.stillIn = !!o.still;
  }

  // ---------- update ----------
  function update(w, dt) {
    w.t += dt;
    if (w.over) { tickBall(w, dt); return; }
    if (w.phase === 'duel') w.clock -= dt;
    updateYou(w, dt);
    updateOff(w, dt);
    tickBall(w, dt);
    if (!w.over && w.phase === 'duel' && w.clock <= 0 && (w.ball.state === 'dribble' || w.ball.state === 'held') && !(w.off.act && (w.off.act.k === 'rise' && w.off.act.ph === 'up'))) {
      if (w.kind === 'pickpocket') {
        say(w, 'clock', 'He kept his dribble.');
        decide(w, 'kept', 'C');
        end(w, 'kept', 0);
      } else {
        say(w, 'clock', 'Shot clock violation.');
        pop(w, 'Shot clock', GOOD);
        decide(w, 'clock', 'A');
        sfx(w, 'buzzer');
        end(w, 'violation', 0);
      }
    }
  }

  function updateYou(w, dt) {
    const Y = w.you, R = rel(w);
    if (Y.offBal > 0) Y.offBal -= dt;
    if (Y.stuck > 0) Y.stuck -= dt;
    const tAir = w.t - Y.airStart;
    if (Y.air && tAir >= YOU.airT) { Y.air = false; Y.landAt = w.t; }
    // where you want to go
    let want = [0, 0, 0];
    if (Y.chasing && w.phase !== 'rebound') {
      // beaten: you chase him down on your own; you can still go up
      const tgt = V.add(w.off.pos, V.mul(Court3D.dirToRim(w.off.pos), -1.25));
      const d = V.sub(tgt, Y.pos), l = Math.hypot(d[0], d[2]);
      want = l > 0.05 ? V.mul(d, Math.min(YOU.chase, l * 6) / l) : [0, 0, 0];
    } else if (Y.camR && Y.camF) {
      const vx = Y.jx * YOU.vLat, vy = Y.jy * (w.phase === 'duel' ? YOU.vDep : YOU.vLat);
      want = [Y.camR[0] * vx + Y.camF[0] * vy, 0, Y.camR[2] * vx + Y.camF[2] * vy];
    }
    let acc = YOU.acc;
    if (Y.offBal > 0) acc *= 0.2;
    if (Y.stuck > 0) { acc *= 0.15; }
    if (Y.air) acc = 0;
    const dv = V.sub(want, Y.vel); dv[1] = 0;
    const dl = Math.hypot(dv[0], dv[2]), lim = acc * dt;
    if (dl > 0) Y.vel = dl > lim ? V.add(Y.vel, V.mul(dv, lim / dl)) : want.slice();
    if (Y.stuck > 0 && Y.lungeV) Y.vel = V.add(Y.vel, V.mul(Y.lungeV, dt * 4));
    Y.pos = V.add(Y.pos, V.mul(Y.vel, dt)); Y.pos[1] = 0;
    // you can't walk through him
    if (w.phase === 'duel' && !Y.chasing) {
      const d = V.sub(Y.pos, w.off.pos), l = Math.hypot(d[0], d[2]);
      if (l < 1.5 && l > 1e-4) Y.pos = V.add(w.off.pos, V.mul(d, 1.5 / l));
    }
    // your weight: which way you're carrying it (screen right +)
    const latV = Y.vel[0] * R.s[0] + Y.vel[2] * R.s[2];
    const lean = clamp(latV / YOU.vLat + (Y.offBal > 0 ? Y.offDir * 0.7 : 0), -1, 1);
    Y.weight += (lean - Y.weight) * Math.min(1, dt * 12);
    // a slide toward his drive: when it started
    const a = w.off.act;
    if (a && a.k === 'drive' && Y.slideAt == null && latV * a.side > 3.2) Y.slideAt = w.t;
    // set: a finger down and still, your feet planted
    const sp = Math.hypot(Y.vel[0], Y.vel[2]);
    if (Y.held && Y.stillIn && sp < 1.6 && !Y.air) Y.setT += dt; else Y.setT = 0;
    if (w.phase === 'duel') w.gaps.push(R.gap);
  }

  function updateOff(w, dt) {
    const O = w.off, A = w.arch, Y = w.you;
    O.dribbleT += dt;
    if (w.phase === 'rebound' || w.phase === 'shot') { updateCrash(w, dt); return; }
    let a = O.act;
    if (!a) a = O.act = { k: 'size', t: 0, dur: 0.5 };
    a.t += dt;
    const R = rel(w);
    let vel = [0, 0, 0], poseName = 'set', side = 1, lean = 0;
    O.lift = 0;
    switch (a.k) {
      case 'size': {
        // a little sway while he looks you over
        const sw = Math.sin(w.t * 2.3 + 1) * 0.9;
        vel = V.mul(R.s, sw);
        lean = Math.sin(w.t * 2.3) * 0.12;
        if (a.t >= a.dur) { const n = choose(w); setAct(w, n); }
        break;
      }
      case 'jab': {
        a.T = a.T || 0.44;
        side = a.side;
        poseName = a.t > 0.1 && a.t < 0.34 ? 'jab' : 'set';
        lean = a.t < 0.34 ? a.side * 0.45 : 0;
        // did you bite? leaning or moving hard toward his jab
        if (!a.bit && a.t > 0.06 && Y.weight * a.side > 0.45) {
          a.bit = true;
          say(w, 'jab', `He jabbed ${sideWord(a.side)} and you bit.`);
          decide(w, 'bitJab', 'D');
          pop(w, 'You bit', BAD);
          setAct(w, { k: 'drive', side: -a.side, counter: true, fromJab: true });
          break;
        }
        if (a.t >= a.T) {
          w.jabs = (w.jabs || 0) + 1;
          if (!a.bit && w.jabs <= 2) { say(w, 'jab', `He jabbed ${sideWord(a.side)} and you stayed home.`); decide(w, 'stayedHome', 'A'); }
          const r = w.rand();
          if (w.script.length) setAct(w, choose(w));
          else if (r < 0.4) setAct(w, { k: 'drive', side: a.side });
          else if (r < 0.62) setAct(w, { k: 'drive', side: -a.side });
          else setAct(w, { k: 'size', dur: 0.35 + w.rand() * 0.3 });
        }
        break;
      }
      case 'cross': {
        a.T = a.T || (a.kind === 'front' ? 0.4 : 0.34);
        poseName = 'set';
        lean = 0;
        if (a.t >= a.T) {
          O.hand = -O.hand;
          if (a.go && !w.noShots) setAct(w, { k: 'drive', side: O.hand, tell: 0.12 });
          else setAct(w, w.script.length ? choose(w) : { k: 'size', dur: 0.3 + w.rand() * 0.4 });
        }
        break;
      }
      case 'drive': updateDrive(w, a, R, dt); return;
      case 'attack': updateAttack(w, a, R, dt); return;
      case 'finish': updateFinish(w, a, dt); return;
      case 'retreat': {
        vel = V.mul(R.u, -3.2);
        if (a.t >= 0.45) setAct(w, { k: 'size', dur: 0.3 + w.rand() * 0.3 });
        break;
      }
      case 'rise': updateRise(w, a, R, dt); return;
      case 'pump': updatePump(w, a, R, dt); return;
      case 'step': {
        a.T = 0.34;
        poseName = 'back';
        w.ball.state = 'held';
        if (!a.started) {
          a.started = true;
          const closing = -(Y.vel[0] * R.u[0] + Y.vel[2] * R.u[2]);
          a.lunged = R.gap < 2.9 || closing > 4.5;
          if (a.lunged) { Y.stuck = 0.5; Y.lungeV = V.mul(R.u, -2.5); }
          say(w, 'step', a.lunged ? 'He stepped back as you flew at him.' : 'He stepped back.');
          decide(w, a.lunged ? 'lunged' : 'underControl', a.lunged ? 'D' : 'A');
          if (a.lunged) pop(w, 'Stepped back', BAD);
        }
        vel = V.mul(R.u, -8.5);
        if (a.t >= a.T) setAct(w, { k: 'rise', quick: true, afterStep: true });
        break;
      }
    }
    moveOff(w, vel, dt, 40);
    O.poseName = poseName; O.poseSide = side;
    O.lean += (lean - O.lean) * Math.min(1, dt * 10);
    blendPose(w, poseName, side, dt, 12);
  }
  function moveOff(w, want, dt, acc) {
    const O = w.off;
    const dv = V.sub(want, O.vel), l = Math.hypot(dv[0], dv[2]), lim = acc * dt;
    if (l > 0) O.vel = l > lim ? V.add(O.vel, V.mul(dv, lim / l)) : want.slice();
    O.pos = V.add(O.pos, V.mul(O.vel, dt)); O.pos[1] = 0;
    O.face = w.phase === 'duel' && O.act && O.act.k !== 'finish' ? Court3D.dirToRim(O.pos) : O.face;
  }
  function blendPose(w, name, side, dt, rate) {
    const O = w.off;
    const tgt = SC.pose(name, side);
    O.pose = Court3D.blendPose(O.pose, tgt, Math.min(1, dt * rate));
  }

  /* The drive. A tell (shoulders dip, ball goes to that side), then the first
     step at your shoulder. When he gets to your hip it's decided by where you
     are: chest still in front of him and you cut him off; he's past your
     shoulder and he's by. In between is a coin flip. */
  function updateDrive(w, a, R, dt) {
    const O = w.off, Y = w.you, A = w.arch;
    if (a.ph === 'tell') {
      O.lean += (a.side * 0.55 - O.lean) * Math.min(1, dt * 14);
      blendPose(w, 'jab', a.side, dt, 10);
      moveOff(w, V.mul(R.s, a.side * 1.5), dt, 40);
      if (a.t >= a.tell) {
        a.ph = 'go'; a.goAt = w.t; a.t = 0;
        a.gap0 = R.gap; a.weight0 = Y.weight; a.slide0 = Y.slideAt;
        a.from = O.pos.slice(); a.youAt = Y.pos.slice();
        a.pass = V.add(V.add(Y.pos, V.mul(R.s, a.side * 2.6)), V.mul(R.u, 0.4));
      }
      return;
    }
    if (a.ph === 'go') {
      // aim just past your shoulder (where you were when he went; he adjusts a little), then turn for the rim
      const pass = V.add(a.pass, V.mul(V.sub(Y.pos, a.youAt), 0.25));
      const d = V.sub(pass, O.pos), l = Math.hypot(d[0], d[2]) || 1;
      const sp = Math.min(Math.hypot(A.quick, A.fwd), 6 + a.t * 60);
      moveOff(w, V.mul(d, sp / l), dt, 90);
      O.lean += (a.side * 0.5 - O.lean) * Math.min(1, dt * 10);
      blendPose(w, a.t % 0.3 < 0.15 ? 'go' : 'jab', a.side, dt, 12);
      const R2 = rel(w);
      if (R2.gap < 1.25 || a.t > 0.75) {
        const relLat = -R2.lat * a.side;      // how far past your shoulder he is, toward his drive
        let cut;
        if (relLat < 0.85) cut = true; else if (relLat > 1.45) cut = false;
        else { cut = w.rand() < (1.45 - relLat) / 0.6; a.close = true; }
        // set your feet in his path and he's going full speed: a charge (outside the circle)
        if (cut && Y.setT >= 0.25 && rimDist(Y.pos) > 4 && A.weights.attack > 0) return charge(w);
        if (cut) cutoff(w, a, R2); else beaten(w, a, R2);
      }
      return;
    }
  }
  function driveReason(w, a) {
    const Y = w.you, A = w.arch;
    if (a.fromJab) return { k: 'bitJab', text: 'You bit on the jab', g: null };
    if (a.counter || a.weight0 * a.side < -0.3) return { k: 'lean', text: 'Your weight was going the other way', g: 'D' };
    if (a.gap0 < 3.0 && A.quick >= 13) return { k: 'tooClose', text: 'Too close to slide with him', g: 'D' };
    const react = a.slide0 != null ? a.slide0 - a.goAt : (Y.slideAt != null ? Y.slideAt - a.goAt : 9);
    if (react > 1) return { k: 'late', text: 'You never moved your feet', g: 'D' };
    if (react > 0.05) return { k: 'late', text: 'A beat late', g: 'C' };
    return { k: 'quick', text: 'Quick first step', g: 'B' };
  }
  function cutoff(w, a, R) {
    const O = w.off, A = w.arch;
    O.vel = V.mul(O.vel, 0.15);
    const gave = a.gap0 >= A.gap[0];
    say(w, 'drive', `He drove ${sideWord(a.side)} and you beat him to the spot.`, { cut: true });
    decide(w, 'cutoff', a.close ? 'B' : 'A');
    pop(w, 'Cut off', GOOD);
    sfx(w, 'cutoff');
    const far = rimDist(O.pos);
    if (w.kind === 'pickpocket') { setAct(w, { k: 'retreat' }); return; }
    if (w.script.length) { setAct(w, choose(w)); return; }
    if (far <= A.range && w.rand() < 0.45) setAct(w, { k: 'rise', quick: true, pullup: true });
    else setAct(w, { k: 'retreat' });
  }
  function beaten(w, a, R) {
    const O = w.off, Y = w.you;
    const why = driveReason(w, a);
    say(w, 'drive', `He drove ${sideWord(a.side)} and got by you. ${why.text}.`, { cut: false, why: why.k });
    if (why.g) decide(w, why.k, why.g);
    pop(w, 'Blow-by', BAD);
    Y.chasing = true;
    setAct(w, { k: 'finish', side: a.side });
    camRim(w);
  }
  function camRim(w) { if (w.cam !== 'rim') { w.cam = 'rim'; w.camAt = w.t; } }

  // straight at you: hold still outside the circle and it's a charge
  function updateAttack(w, a, R, dt) {
    const O = w.off, Y = w.you, A = w.arch;
    if (!a.ph) { a.ph = 'tell'; }
    if (a.ph === 'tell') {
      O.lean += (0 - O.lean) * Math.min(1, dt * 10);
      blendPose(w, 'go', 1, dt, 8);
      if (a.t >= A.tellT) { a.ph = 'go'; a.t = 0; }
      return;
    }
    const sp = Math.min(A.fwd, 5 + a.t * 50);
    moveOff(w, V.mul(R.u, sp), dt, 80);
    blendPose(w, a.t % 0.3 < 0.15 ? 'run1' : 'run2', 1, dt, 14);
    const R2 = rel(w);
    if (Math.abs(R2.lat) < 1.45 && R2.gap < 1.55 && R2.gap > -0.5) {
      // contact
      const outside = rimDist(Y.pos) > 4;
      if (Y.setT >= 0.25 && outside) return charge(w);
      const sp2 = Math.hypot(Y.vel[0], Y.vel[2]);
      if (Y.setT < 0.25 && sp2 > 2.2) {
        say(w, 'contact', 'You were still moving when he hit you. Blocking foul.');
        decide(w, 'blocking', 'D');
        pop(w, 'Blocking foul', BAD);
        sfx(w, 'whistle');
        return freeThrows(w, 2, 'foul');
      }
      // set inside the circle: verticality. Flat-footed: he goes up over you
      if (Y.setT >= 0.25) {
        say(w, 'contact', 'You walled up inside the circle.');
        decide(w, 'wall', 'A');
        Y.walled = true;
      } else {
        say(w, 'contact', 'You were flat-footed and he went up through you.');
        decide(w, 'charge', 'C');
      }
      setAct(w, { k: 'finish', side: 0, overYou: true });
      O.pos = V.add(O.pos, V.mul(R.u, 0.2));
      camRim(w);
      return;
    }
    if (R2.gap < -0.5) {
      // he's past you
      say(w, 'attack', 'He went right past you to the rim.');
      decide(w, Math.abs(R2.lat) >= 1.45 ? 'late' : 'late', 'C');
      pop(w, 'Blow-by', BAD);
      Y.chasing = true;
      setAct(w, { k: 'finish', side: Math.sign(R2.lat) || 1 });
      camRim(w);
    }
  }
  function charge(w) {
    say(w, 'charge', 'You were set outside the circle. Charge.');
    decide(w, 'charge', 'A');
    pop(w, 'Charge', GOOD, null, 1.2);
    sfx(w, 'whistle');
    w.tags.push('charge');
    end(w, 'charge', 0);
  }

  // after a blow-by: to the rim and up
  function updateFinish(w, a, dt) {
    const O = w.off, Y = w.you;
    const toRim = V.sub([RIM.x, 0, RIM.z], O.pos), l = Math.hypot(toRim[0], toRim[2]);
    if (!a.ph) a.ph = 'run';
    O.face = Court3D.dirToRim(O.pos);
    if (a.ph === 'run') {
      if (l > 3.4 && !a.overYou) {
        moveOff(w, V.mul(toRim, 13 / l), dt, 70);
        blendPose(w, a.t % 0.3 < 0.15 ? 'run1' : 'run2', 1, dt, 14);
        w.ball.state = 'dribble';
        return;
      }
      a.ph = 'gather'; a.t = 0; w.ball.state = 'held';
    }
    if (a.ph === 'gather') {
      O.vel = V.mul(O.vel, 0.85);
      blendPose(w, 'gather', 1, dt, 16);
      if (a.t >= 0.12) { a.ph = 'up'; a.t = 0; release(w, { layup: true }); }
    }
  }

  // ---------- shots ----------
  /* A shot: gather (ball to his chest, knees bend), then he leaves the floor
     and lets it go near the top. Jump with him and your hand is in his face;
     jump early and you're coming down when he shoots. */
  function updateRise(w, a, R, dt) {
    const O = w.off;
    w.ball.state = 'held';
    const gT = a.quick ? 0.12 : 0.2;
    if (!a.ph) a.ph = 'gather';
    if (a.ph === 'gather') {
      O.vel = V.mul(O.vel, Math.max(0, 1 - dt * 10));
      O.pos = V.add(O.pos, V.mul(O.vel, dt));
      blendPose(w, 'gather', 1, dt, 16);
      if (a.t >= gT) { a.ph = 'up'; a.t = 0; a.leaveAt = w.t; }
      return;
    }
    if (a.ph === 'up') {
      O.lift = Math.sin(Math.PI * Math.min(1, a.t / 0.5)) * 1.7;
      blendPose(w, 'shoot', 1, dt, 18);
      if (a.t >= 0.17 && !a.released) { a.released = true; release(w, { pullup: a.pullup, afterStep: a.afterStep, forced: a.forced }); }
    }
  }
  function updatePump(w, a, R, dt) {
    const O = w.off, Y = w.you, A = w.arch;
    w.ball.state = 'held';
    if (!a.ph) a.ph = 'gather';
    if (a.ph === 'gather') {
      blendPose(w, 'gather', 1, dt, 16);
      if (a.t >= 0.16) { a.ph = 'up'; a.t = 0; }
      return;
    }
    if (a.ph === 'up') {
      blendPose(w, 'pump', 1, dt, 18);
      // you left your feet on the fake
      if (!a.bit && Y.air && Y.airStart > w.t - a.t - 0.3) {
        a.bit = true; a.bitAt = w.t;
        say(w, 'pump', 'He pump faked and you left your feet.');
        decide(w, 'bitPump', 'D');
        pop(w, 'You bit', BAD);
      }
      if (a.bit && w.t - a.bitAt > 0.1) {
        if (R.dist < 2.6) {
          say(w, 'foul', 'You came down on him. Foul on the shot.');
          pop(w, 'And he drew it', BAD);
          sfx(w, 'whistle');
          return freeThrows(w, Court3D.isThree(w.court, O.pos) ? 3 : 2, 'foul');
        }
        w.ball.state = 'dribble';
        Y.chasing = true;
        say(w, 'drive', 'He put it on the floor and went right by you.');
        setAct(w, { k: 'finish', side: R.lat > 0 ? -1 : 1 });
        camRim(w);
        return;
      }
      if (a.t >= 0.36) {
        if (!a.bit) { say(w, 'pump', 'He pump faked and you stayed down.'); decide(w, 'stayedDown', 'A'); }
        w.ball.state = 'dribble';
        const then = a.then || (w.rand() < 0.6 ? 'rise' : 'drive');
        if (then === 'rise') setAct(w, { k: 'rise', quick: true });
        else setAct(w, { k: 'drive', side: R.lat > 0 ? -1 : 1, tell: 0.14 });
      }
    }
  }
  // how much your hands are bothering him right now
  function contestNow(w) {
    const Y = w.you, R = rel(w);
    if (Y.chasing) {
      // trailing: a little if you're right on his hip
      return clamp((3.2 - R.dist) / 3.2, 0, 1) * (Y.air ? 0.45 : 0.18);
    }
    const close = clamp((7.0 - R.dist) / 4.6, 0, 1) * clamp(1.35 - Math.abs(R.lat) / 2.2, 0, 1) * (R.gap > -0.3 ? 1 : 0.3);
    let hand = 0.42, how = 'stand';
    if (Y.air) {
      const k = (w.t - Y.airStart) / YOU.airT;
      const h = Math.sin(Math.PI * clamp(k, 0, 1));
      hand = h > 0.55 ? 1.0 : 0.72; how = 'air';
    } else if (Y.landAt != null && w.t - Y.landAt < 0.35) { hand = 0.38; how = 'early'; }
    else if (Y.setT > 0.2 || Y.walled) { hand = 0.62; how = 'wall'; }
    if (Y.offBal > 0) { hand *= 0.4; how = 'off'; }
    if (Y.stuck > 0) { hand *= 0.45; how = 'stuck'; }
    return { c: clamp(close * hand, 0, 1), how, close };
  }
  function release(w, o) {
    const O = w.off, Y = w.you, A = w.arch;
    const pos = O.pos.slice();
    const layup = !!o.layup;
    const skill = clamp(A.skill + (layup ? 0.18 : 0) - (o.forced ? 0.1 : 0), 0.2, 0.97);
    const cq = contestNow(w);
    const contest = typeof cq === 'number' ? cq : cq.c;
    const how = typeof cq === 'number' ? (Y.air ? 'air' : 'trail') : cq.how;
    const shot = HoopPhysics.cpuShot(pos, skill, w.rand);
    // the same extra noise a contest puts on your own shot in the scoring game
    let vec = V.mul(shot.vel, 1 + HoopPhysics.gauss(w.rand) * contest * 0.0065);
    vec = rotY(vec, HoopPhysics.gauss(w.rand) * contest * 1.1 * Math.PI / 180);
    const ph = HoopPhysics.newBall(shot.release, vec);
    w.ball.state = 'shot'; w.ball.ph = ph; w.ball.p = ph.p; w.ball.by = 'him';
    const three = Court3D.isThree(w.court, pos);
    w.shotInfo = { at: w.t, pos, dist: shot.dist, type: shot.type, contest, how, three, layup, apex: false, touched: false };
    w.phase = 'shot';
    sfx(w, 'release');
    // what you did about it
    if (!layup) {
      const R = rel(w);
      if (how === 'air') decide(w, 'contest', contest >= 0.55 ? 'A' : 'B');
      else if (how === 'early') decide(w, 'early', 'C');
      else if (how === 'stuck') { /* already graded as a lunge */ }
      else if (A.skill >= 0.7 && R.gap >= A.shootGap - 0.4 && contest < 0.3) decide(w, 'tooFar', 'D');
      else if (A.skill < 0.6 && !o.forced) decide(w, 'gaveJumper', 'A');
      else decide(w, 'noHand', contest >= 0.35 ? 'B' : 'C');
    } else if (Y.walled) { /* graded at contact */ }
    camRim(w);
    w.rebound = { boxing: null, sideAt: null, side: 0, sealed: false, lost: false, pred: null, findBy: w.t + 0.6, man: 'off', crashing: A.crash >= 0.4 };
  }
  function contestWord(c) { return c < 0.15 ? 'wide open' : c < 0.35 ? 'open' : c < 0.6 ? 'contested' : c < 0.85 ? 'a hand right in his face' : 'smothered'; }

  // ---------- your gestures ----------
  /* A slice through the ball. o: { hit (crossed the ball), acc (0..1, how
     close to the middle), dir (screen side the swipe went) } */
  function slice(w, o) {
    const Y = w.you, O = w.off, a = O.act;
    if (w.over || w.phase !== 'duel' || Y.air || w.t - Y.lastSlice < 0.25) return null;
    Y.lastSlice = w.t;
    w.events.push({ type: 'slice', hit: !!o.hit });
    const R = rel(w);
    const shooting = w.ball.state === 'held' && a && (a.k === 'rise' || a.k === 'pump' || (a.k === 'finish' && a.ph !== 'run'));
    if (o.hit && shooting) {
      say(w, 'hack', 'You hit him on the shot. Foul.');
      decide(w, 'hack', 'F');
      pop(w, 'Foul', BAD);
      sfx(w, 'whistle');
      freeThrows(w, Court3D.isThree(w.court, O.pos) ? 3 : 2, 'foul');
      return 'foul';
    }
    if (a && a.k === 'attack' && R.dist < 4.5) {
      say(w, 'swipe', 'You swiped down at him on his way to the rim. Foul.');
      decide(w, 'swipeDown', 'F');
      pop(w, 'Reach', BAD);
      sfx(w, 'whistle');
      freeThrows(w, 2, 'foul');
      return 'foul';
    }
    if (!o.hit) {
      Y.offBal = 0.32; Y.offDir = o.dir || 0;
      pop(w, 'Missed', WARN, null, 0.8);
      if (!w.dec.some(d => d.k === 'whiff')) decide(w, 'whiff', 'C');
      if (a && a.k === 'size' && w.kind !== 'pickpocket' && w.rand() < 0.6) setAct(w, { k: 'drive', side: -(o.dir || 1), counter: true });
      return 'whiff';
    }
    const e = exposure(w);
    const p = e * (0.55 + 0.45 * clamp(o.acc, 0, 1));
    let res;
    if (p >= 0.5) res = 'steal';
    else if (p <= 0.2) res = 'reach';
    else res = w.rand() < (p - 0.2) / 0.3 ? 'steal' : 'tip';
    if (res === 'steal') {
      const onCross = a && a.k === 'cross' && a.kind === 'front';
      say(w, 'steal', onCross ? 'You picked his pocket on the crossover.' : 'You swiped it right off his dribble.');
      decide(w, 'steal', p >= 0.5 ? 'A' : 'B');
      pop(w, 'Stripped', GOOD, null, 1.2);
      sfx(w, 'great');
      w.ball.state = 'loose';
      const dir = V.add(V.mul(R.u, 9), V.mul(R.s, (o.dir || 1) * 4));
      w.ball.ph = HoopPhysics.newBall(w.ball.p, [dir[0], 2, dir[2]]);
      w.tags.push('steal');
      end(w, 'steal', 0);
      return res;
    }
    if (res === 'tip') {
      pop(w, 'Tipped', WARN);
      decide(w, 'tip', 'B');
      O.dribbleT += DRIBBLE_T * 0.6;
      if (a && a.k === 'cross') a.t = Math.min(a.T, a.t + 0.15);
      return res;
    }
    // a reach on a protected ball
    const foul = R.dist < 2.8 || e < 0.1;
    if (foul) {
      say(w, 'reach', 'You reached on a protected dribble. Foul.');
      decide(w, 'reach', 'F');
      pop(w, 'Reach', BAD);
      sfx(w, 'whistle');
      if (w.kind === 'pickpocket') { end(w, 'foul', 1); return 'foul'; }
      freeThrows(w, 2, 'foul');
      return 'foul';
    }
    say(w, 'reach', 'You reached and he went by you.');
    decide(w, 'reach', 'D');
    pop(w, 'Reach', BAD);
    Y.offBal = 0.4; Y.offDir = o.dir || 0;
    if (w.kind !== 'pickpocket') setAct(w, { k: 'drive', side: -(o.dir || 1), counter: true });
    return 'reach';
  }

  /* A jump. o: { k (0..1 how hard), reachX (feet, screen right +) } */
  function jump(w, o) {
    const Y = w.you;
    if (w.over || Y.air) return false;
    if (Y.landAt != null && w.t - Y.landAt < 0.12) return false;
    Y.air = true; Y.airStart = w.t; Y.jumpK = 0.7 + 0.3 * clamp(o.k == null ? 1 : o.k, 0, 1); Y.reachX = clamp(o.reachX || 0, -2.4, 2.4);
    w.events.push({ type: 'jump' });
    return true;
  }
  // where your hands are (between them), and how high
  function hands(w) {
    const Y = w.you;
    const k = clamp((w.t - Y.airStart) / YOU.airT, 0, 1);
    const lift = Y.air ? Math.sin(Math.PI * k) * YOU.jump * Y.jumpK : 0;
    let fwd, side;
    if (w.phase === 'duel' && !Y.chasing) { const R = rel(w); fwd = V.mul(R.u, -1); side = R.s; }
    else { const f = Court3D.dirToRim(Y.pos); fwd = f; side = [-f[2], 0, f[0]]; }
    const ahead = Y.chasing ? 1.7 : 0.75;
    const p = V.add(V.add(Y.pos, V.mul(fwd, ahead)), V.mul(side, Y.reachX * (Y.chasing ? 0.4 : 1)));
    p[1] = YOU.reach + lift + (Y.walled && !Y.air ? 0.2 : 0);
    return p;
  }

  // ---------- the ball in the air ----------
  function tickBall(w, dt) {
    const B = w.ball;
    if (B.state === 'dribble' || B.state === 'held' || B.state === 'yours' || B.state === 'his') { placeBall(w); return; }
    if (!B.ph) return;
    const ph = B.ph;
    const before = { rim: ph.rimHits, board: ph.boardHits, vy: ph.v[1] };
    HoopPhysics.advance(ph, dt, w.court);
    B.p = ph.p;
    ph.events.forEach(ev => { if (ev.type === 'rim' || ev.type === 'board' || ev.type === 'bounce') sfx(w, ev.type, ev.s); if (ev.type === 'score') sfx(w, 'swish'); });
    ph.events.length = 0;
    if (w.over || B.state !== 'shot') return;
    const S = w.shotInfo;
    if (!S.apex && before.vy > 0 && ph.v[1] <= 0) S.apex = true;
    // your hands on it
    const Y = w.you;
    if (Y.air || Y.walled) {
      const h = hands(w);
      // a jump shot leaves his hands up over his head (the ball flies from set-shot height, the
      // way it does in the scoring game, so count it that much higher here)
      const lift = S.layup ? 0 : S.dist < 11 ? 1.0 : 1.6;
      const d = Math.hypot(ph.p[0] - h[0], ph.p[1] + lift - h[1], ph.p[2] - h[2]);
      const reach = S.layup ? (Y.air ? 0.95 : 0.75) : 0.62;
      const touch = d < reach && ph.rimHits + ph.boardHits === 0;
      if (touch) {
        const near = rimDist(ph.p) < 6.5 && ph.p[1] > RIM.y - 0.2;
        if (ph.v[1] < 0 && near) {
          say(w, 'goaltend', 'You touched it on the way down. Goaltending.');
          decide(w, 'goaltend', 'D');
          pop(w, 'Goaltending', BAD, null, 1.1);
          sfx(w, 'whistle');
          B.ph.v = V.mul(B.ph.v, -0.3);
          end(w, 'goaltend', S.three ? 3 : 2);
          return;
        }
        if (ph.v[1] > -2) {
          say(w, 'block', 'Swatted it on the way up.');
          decide(w, 'block', 'A');
          pop(w, 'Swatted', GOOD, null, 1.3);
          sfx(w, 'block');
          const out = V.sub(ph.p, h); out[1] = 0;
          const ol = Math.hypot(out[0], out[2]) || 1;
          ph.v = [out[0] / ol * 9 + (w.rand() - 0.5) * 4, -6, out[2] / ol * 9];
          B.state = 'loose';
          w.tags.push('block');
          end(w, 'block', 0);
          return;
        }
      }
    }
    if (ph.result === 'made') {
      const pts = S.three ? 3 : 2;
      say(w, 'shot', `${shotWord(S)}, ${contestWord(S.contest)}: made.`);
      end(w, 'made', pts);
      return;
    }
    // off the rim: the rebound is on
    if (w.phase === 'shot' && (ph.rimHits + ph.boardHits > 0 || ph.result === 'miss') && !ph.scored) {
      if (!S.missSaid) { S.missSaid = true; say(w, 'shot', `${shotWord(S)}, ${contestWord(S.contest)}: missed.`); }
      if (ph.rimHits + ph.boardHits > before.rim + before.board || !w.rebound.pred) w.rebound.pred = predictLanding(w);
      w.phase = 'rebound';
    }
    if (w.phase === 'rebound') {
      if (ph.rimHits + ph.boardHits > before.rim + before.board) w.rebound.pred = predictLanding(w);
      secure(w);
    }
  }
  function shotWord(S) {
    if (S.layup) return 'Layup';
    const ft = Math.round(S.dist);
    if (S.three) return `Three from ${ft} feet`;
    return `${S.dist < 11 ? 'Floater' : 'Pull-up'} from ${ft} feet`;
  }
  // where the miss will be catchable: first time it comes down through 9 feet away from the rim, or the floor
  function predictLanding(w) {
    const src = w.ball.ph;
    const b = HoopPhysics.newBall(src.p, src.v, { rimHits: src.rimHits, boardHits: src.boardHits, scored: src.scored });
    for (let i = 0; i < 480; i++) {
      HoopPhysics.advance(b, 1 / 120, w.court);
      if (b.scored) return null;
      const away = rimDist(b.p) > 1.2;
      if ((b.v[1] < 0 && b.p[1] < 9.2 && away) || b.bounces > 0) return { p: [b.p[0], 0, b.p[2]], t: i / 120, h: b.p[1] };
    }
    return { p: [b.p[0], 0, b.p[2]], t: 4, h: b.p[1] };
  }

  /* After the shot: you find him and box out (touch and hold), he tries to
     get around one side (watch which way he leans), then you go get it. */
  function updateCrash(w, dt) {
    const O = w.off, Y = w.you, RB = w.rebound, A = w.arch;
    if (!RB) return;
    const S = w.shotInfo;
    // he comes down from his shot first
    const since = w.t - S.at;
    O.lift = S.layup || S.glass ? 0 : Math.max(0, Math.sin(Math.PI * Math.min(1, (since + 0.17) / 0.5)) * 1.7);
    if (since < 0.35 && !S.glass) { blendPose(w, 'shoot', 1, dt, 10); return; }
    const toRim = Court3D.dirToRim(Y.pos), side = [-toRim[2], 0, toRim[0]];
    // did you find him?
    if (RB.boxing == null && Y.held && !Y.air && w.t <= RB.findBy + 0.4) {
      const near = dist2(Y.pos, O.pos) < 5 && rimDist(Y.pos) < rimDist(O.pos) + 0.5;
      RB.boxing = near ? w.t : false;
      if (near) { pop(w, 'Found him', GOOD, null, 0.8); }
    }
    if (RB.boxing == null && w.t > RB.findBy + 0.4) RB.boxing = false;
    const target = RB.pred ? RB.pred.p : [RIM.x, 0, RIM.z + 5];
    if (!RB.crashing) {
      // he doesn't crash: he gets back
      const back = V.add(O.pos, V.mul(Court3D.dirToRim(O.pos), -1));
      const d = V.sub(back, O.pos), l = Math.hypot(d[0], d[2]) || 1;
      moveOff(w, V.mul(d, 4 / l), dt, 30);
      blendPose(w, 'stand', 1, dt, 8);
      return;
    }
    if (RB.boxing && !RB.sealed && !RB.lost) {
      // he leans one way, then tries to go around
      if (RB.sideAt == null) { RB.sideAt = w.t + 0.12; RB.side = w.rand() < 0.5 ? -1 : 1; }
      const into = w.t - RB.sideAt;
      blendPose(w, 'box', 1, dt, 12);
      O.lean += (RB.side * 0.45 - O.lean) * Math.min(1, dt * 8);
      // stay attached behind you
      const want = V.add(V.add(Y.pos, V.mul(toRim, -1.7)), V.mul(side, RB.side * Math.min(1.6, Math.max(0, into) * 4)));
      const d = V.sub(want, O.pos), l = Math.hypot(d[0], d[2]);
      moveOff(w, l > 0.05 ? V.mul(d, Math.min(9, l * 8) / l) : [0, 0, 0], dt, 60);
      const latV = Y.vel[0] * side[0] + Y.vel[2] * side[2];
      if (into > 0 && latV * RB.side > 2.6) {
        RB.sealed = true;
        say(w, 'box', 'Boxed him out.');
        decide(w, 'boxed', 'A');
        pop(w, 'Boxed out', GOOD);
      } else if (into > 0.42 + (1 - A.crash) * 0.5) {
        RB.lost = true;
        say(w, 'box', 'He spun around you.');
        decide(w, 'lostBox', 'D');
        pop(w, 'He got around', BAD);
      }
      return;
    }
    if (RB.sealed) {
      // pinned behind you until the ball comes down past you
      const want = V.add(Y.pos, V.mul(toRim, -1.6));
      const d = V.sub(want, O.pos), l = Math.hypot(d[0], d[2]);
      moveOff(w, l > 0.05 ? V.mul(d, Math.min(10, l * 8) / l) : [0, 0, 0], dt, 60);
      blendPose(w, 'box', 1, dt, 10);
      // a long one over both of you is his to chase
      if (RB.pred && dist2(RB.pred.p, Y.pos) > 6 && dist2(RB.pred.p, O.pos) < dist2(RB.pred.p, Y.pos)) RB.sealed = false, RB.lost = true;
      return;
    }
    // loose: he goes and gets it
    if (RB.boxing === false && !RB.noBoxSaid && since > 0.6) {
      RB.noBoxSaid = true;
      say(w, 'box', 'You never found him.');
      decide(w, 'noBox', 'D');
    }
    // nobody on him: he's already moving while you turn around
    const d = V.sub(target, O.pos), l = Math.hypot(d[0], d[2]);
    moveOff(w, l > 0.1 ? V.mul(d, Math.min(RB.lost || !RB.boxing ? 15 : 12.5, l * 6) / l) : [0, 0, 0], dt, 80);
    O.face = Court3D.dirToRim(O.pos);
    blendPose(w, l > 0.6 ? (w.t % 0.3 < 0.15 ? 'run1' : 'run2') : 'stand', 1, dt, 14);
  }

  function secure(w) {
    const B = w.ball, ph = B.ph, Y = w.you, O = w.off, RB = w.rebound;
    const p = ph.p;
    if (ph.v[1] > 0 && p[1] > RIM.y - 1) return;
    const dY = dist2(p, Y.pos), dM = dist2(p, O.pos);
    let you = false, him = false;
    if (Y.air) { const h = hands(w); you = Math.hypot(p[0] - h[0], p[2] - h[2]) < 2.1 && Math.abs(p[1] - h[1]) < 1.15; }
    else you = dY < 1.9 && p[1] < YOU.reach - 0.2;
    // inside position: a man you didn't box out gets there with more reach and wins the ties
    const inside = RB.lost || !RB.boxing;
    const hisReach = 8.3 + (w.arch.big ? 1.6 : 0.9) + (inside ? 0.4 : 0);
    him = RB.crashing && !RB.sealed && dM < (inside ? 2.4 : 1.9) && p[1] < hisReach && (inside || dM < dY);
    if (p[1] < 1.2 && ph.bounces > 0) {
      // on the floor: whoever's closer (and if it rolls away, whoever gets there first)
      const long = ph.bounces > 1 || w.t - w.shotInfo.at > 3.2;
      if (dY < 6 || dM < 6 || long) { if (dY <= dM || !RB.crashing) you = true; else him = true; }
    }
    if (you && him) { if (dY <= dM - (inside ? 0.9 : 0)) him = false; else you = false; }
    if (you) {
      B.state = 'yours';
      say(w, 'board', Y.air ? 'Went up and got it. Your board.' : 'Your board.');
      decide(w, 'board', 'A');
      pop(w, 'Board', GOOD, null, 1.1);
      sfx(w, 'good');
      w.tags.push('board');
      end(w, 'board', 0);
      return;
    }
    if (him) {
      B.state = 'his';
      if (!RB.boxing && RB.boxing !== null && !RB.noBoxSaid) { decide(w, 'noBox', 'D'); }
      pop(w, 'His board', BAD);
      w.putbacks++;
      if (w.kind === 'glass') { say(w, 'board', 'His board.'); end(w, 'offboard', 0); return; }
      putback(w);
    }
  }
  function putback(w) {
    const O = w.off, Y = w.you;
    const close = rimDist(O.pos) < 9;
    const skill = clamp(w.arch.skill + 0.2, 0.3, 0.95);
    const R = dist2(Y.pos, O.pos);
    const contest = clamp((5 - R) / 5, 0, 0.7);
    if (!close || w.putbacks > 2) { say(w, 'board', 'His board. He kicked it back out.'); end(w, 'offboard', 0); return; }
    const shot = HoopPhysics.cpuShot(O.pos, skill, w.rand);
    let vec = V.mul(shot.vel, 1 + HoopPhysics.gauss(w.rand) * contest * 0.0065);
    vec = rotY(vec, HoopPhysics.gauss(w.rand) * contest * 1.1 * Math.PI / 180);
    const b = HoopPhysics.simulate(shot.release, vec, w.court);
    const made = b.result === 'made';
    say(w, 'board', `His board, putback: ${made ? 'made' : 'missed'}.`);
    if (!made) { decide(w, 'survived', 'C'); }
    w.ball.state = 'shot';
    w.ball.ph = HoopPhysics.newBall(shot.release, vec);
    end(w, made ? 'putback' : 'putbackMiss', made ? 2 : 0);
  }

  function freeThrows(w, n, kind) {
    const pct = w.arch.ft;
    let m = 0;
    for (let i = 0; i < n; i++) if (w.rand() < pct) m++;
    w.fts = { n, m };
    say(w, 'fts', `He made ${m} of ${n} at the line.`);
    end(w, kind || 'foul', m);
  }

  // ---------- glass drill ----------
  // a teammate of his shoots from a spot; your man is a big on the block
  function startGlass(w, o) {
    const spots = ['lw', 'rw', 'top', 'le', 're', 'lc', 'rc', 'lb', 'rb'];
    const sid = o.shotSpot || spots[Math.floor(w.rand() * spots.length)];
    const sp = Court3D.spotInfo(w.court, sid);
    const shooterPos = sp.pos;
    const side = Math.sign(sp.angle) || (w.rand() < 0.5 ? 1 : -1);
    // your man on the weak-side block; you between him and the rim
    const manPos = Court3D.polar(-side * 50, 8.5);
    const toRim = Court3D.dirToRim(manPos);
    w.off.pos = manPos;
    w.off.face = Court3D.dirToRim(manPos);
    w.you.pos = V.add(manPos, V.mul(toRim, 1.9)); w.you.pos[1] = 0;
    w.glass = { shooter: shooterPos, spot: sid, at: 0.9 + w.rand() * 0.5, shot: false, skill: o.shotSkill || 0.4 };
    w.off.act = { k: 'size', t: 0, dur: 99 };
    w.ball.state = 'away';
    w.ball.p = V.add(shooterPos, [0, 4.5, 0]);
    w.clock = 99;
  }
  function updateGlass(w, dt) {
    const G = w.glass;
    if (G.shot || w.t < G.at) return;
    G.shot = true;
    const shot = HoopPhysics.cpuShot(G.shooter, G.skill, w.rand);
    const ph = HoopPhysics.newBall(shot.release, shot.vel);
    w.ball.state = 'shot'; w.ball.ph = ph; w.ball.p = ph.p;
    w.shotInfo = { at: w.t, pos: G.shooter, dist: shot.dist, type: shot.type, contest: 0, how: 'none', three: Court3D.isThree(w.court, G.shooter), layup: false, apex: false, glass: true };
    w.phase = 'shot';
    sfx(w, 'release');
    w.rebound = { boxing: null, sideAt: null, side: 0, sealed: false, lost: false, pred: null, findBy: w.t + 0.6, crashing: true };
    w.off.act = null;
  }

  // ---------- the end ----------
  function end(w, kind, points) {
    if (w.over) return;
    w.over = true;
    w.result = { kind, points, stop: points === 0 && kind !== 'offboard' && kind !== 'kept' };
    const g = grade(w);
    w.result.grade = g.grade; w.result.worst = g.worst;
    w.result.tags = w.tags.slice();
    w.events.push({ type: 'end' });
  }
  /* The grade is on what you did, not whether he made it: the average of your
     decisions, capped one letter above the worst one. */
  function grade(w) {
    const ds = w.dec;
    if (!ds.length) {
      const R = w.result;
      const g = R.kind === 'made' ? 'C' : R.kind === 'violation' ? 'A' : 'B';
      return { grade: g, worst: null };
    }
    const avg = ds.reduce((s, d) => s + GP[d.g], 0) / ds.length;
    const worst = ds.slice().sort((a, b) => GP[a.g] - GP[b.g])[0];
    const g = letter(Math.min(avg, GP[worst.g] + 1));
    return { grade: g, worst };
  }
  function narrate(w) {
    const parts = w.story.map(s => s.text);
    const R = w.result;
    if (R) {
      if (R.points) parts.push(`+${R.points} for him.`);
      else if (R.kind !== 'offboard' || w.kind !== 'glass') parts.push('Stop.');
    }
    return parts.join(' ').replace(/\s+/g, ' ');
  }
  function lesson(w) {
    const R = w.result, A = w.arch;
    if (!R) return '';
    if (R.grade === 'A' || R.grade === 'B') {
      if (R.kind === 'made') return `${A.good} He made a tough one; live with that.`;
      return `${A.good}`;
    }
    const worst = R.worst;
    return (worst && SC.LESSONS[worst.k]) || A.read;
  }

  function step(w, dt) {
    if (w.kind === 'glass' && !w.over) updateGlass(w, dt);
    update(w, dt);
  }

  return { create, step, input, slice, jump, exposure, contestNow, hands, rel, narrate, lesson, YOU, frame, predictLanding, DRIBBLE_T };
})();
