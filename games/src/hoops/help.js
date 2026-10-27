/* Help defense: the second defender. He waits until you beat your man, then
   does his one job. Where he starts and what that job is decides which
   finish is open; your touch still decides whether it goes in.

   Each help type is data. `vs` scales his contest by the kind of shot you
   take, so the same spot can be wide open for a floater and a wall for a
   layup. */
const Help = (() => {
  const { V, RIM } = Court3D;

  const TYPES = {
    wall: {
      id: 'wall', name: 'The Wall', tag: 'Rim protector',
      tell: 'A big man parked under the rim.',
      read: 'Don\'t take it at him. Float it over him or pull up before you get there.',
      home: 'rim', role: 'drop', react: 0.1, speed: 8, holdAt: 3.2, length: 1.5, height: 1.16, reach: 1.35, bite: 0.1, block: 0.6,
      vs: { layup: 1.25, euro: 1.1, floater: 0.55, pullup: 0.35, jumper: 0.35, fade: 0.3 },
      colors: { jersey: '#3a3f4b', shorts: '#2c3039', trim: '#ffb547' }, number: 50, homePose: 'wall'
    },
    charge: {
      id: 'charge', name: 'The Charge Taker', tag: 'Plants in the lane',
      tell: 'Smaller guy on the weak side of the lane, ready to slide over.',
      read: 'Don\'t run him over. Pull up, float it before you reach him, or euro step around him.',
      home: 'weaklane', role: 'charge', react: 0.04, speed: 19, holdAt: 5.2, length: 0.5, height: 0.94, reach: 0.9, bite: 0.25, block: 0.05,
      vs: { layup: 0.9, euro: 0.3, floater: 0.45, pullup: 0.3, jumper: 0.3, fade: 0.3 },
      colors: { jersey: '#5b6b2f', shorts: '#4a5826', trim: '#ffffff' }, number: 33, homePose: 'stand'
    },
    leaper: {
      id: 'leaper', name: 'The Leaper', tag: 'Jumps at everything',
      tell: 'Bouncing on his toes at the block.',
      read: 'Pump fake when he steps up. Once he flies by, finish.',
      home: 'ballblock', role: 'step', react: 0.08, speed: 14, holdAt: 4.8, length: 1.25, height: 1.04, reach: 1.15, bite: 0.95, block: 0.5,
      vs: { layup: 1.15, euro: 0.95, floater: 1.0, pullup: 0.8, jumper: 0.7, fade: 0.5 },
      colors: { jersey: '#b23a5e', shorts: '#8f2e4b', trim: '#ffffff' }, number: 23, homePose: 'guard'
    },
    late: {
      id: 'late', name: 'Late Help', tag: 'Coming from the far side',
      tell: 'Starts way out on the far wing.',
      read: 'Don\'t wait. Any quick finish beats him there; a hesitation or a fake lets him arrive.',
      home: 'weakwing', role: 'late', react: 0.18, speed: 19, holdAt: 3.4, length: 1.15, height: 1.02, reach: 1.1, bite: 0.5, block: 0.4,
      vs: { layup: 1, euro: 0.85, floater: 1, pullup: 1, jumper: 1, fade: 0.8 },
      colors: { jersey: '#2a6f8a', shorts: '#215a70', trim: '#ffffff' }, number: 11, homePose: 'stand'
    },
    digger: {
      id: 'digger', name: 'The Digger', tag: 'Reaches for the ball',
      tell: 'Crouched at the elbow on one side, hands low.',
      read: 'Drive away from his side, or rise early. Carry the ball past him and he takes it.',
      home: 'ballelbow', role: 'dig', react: 0.12, speed: 12, holdAt: 0, length: 0.8, height: 0.95, reach: 1.0, bite: 0.4, block: 0.1, steal: 0.8,
      vs: { layup: 0.8, euro: 0.45, floater: 0.6, pullup: 0.4, jumper: 0.4, fade: 0.4 },
      colors: { jersey: '#c27a1d', shorts: '#9c6216', trim: '#1d1f24' }, number: 5, homePose: 'guard'
    }
  };
  const IDS = Object.keys(TYPES);
  const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#5c3a1e', '#a86b3c'];
  const HAIR = ['#1b1410', '#2b1d14', '#3b2716', '#0f0f10'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const flat = p => [p[0], 0, p[2]];
  const gap2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

  // Where he waits, in court terms. The ball side is the side of the floor you start on.
  function homePos(type, spotPos, ballSide) {
    const ang = Court3D.polarOf(spotPos).angle;
    switch (type.home) {
      case 'rim': return Court3D.polar(ang * 0.4, 3.0);
      case 'weaklane': return Court3D.polar(-ballSide * 42, 5.6);
      case 'ballblock': return Court3D.polar(ballSide * 62, 7);
      case 'weakwing': return Court3D.polar(-ballSide * 50, 16);
      case 'ballelbow': return Court3D.polar(ballSide * 30, 13.5);
    }
    return Court3D.polar(0, 4);
  }

  function create(id, spotPos, rand) {
    const type = TYPES[id] || TYPES.wall;
    const r = rand || Math.random;
    const ang = Court3D.polarOf(spotPos).angle;
    const ballSide = Math.abs(ang) < 10 ? (r() < 0.5 ? -1 : 1) : Math.sign(ang);
    const home = homePos(type, spotPos, ballSide);
    return {
      type, pos: home.slice(), home, vel: [0, 0, 0], state: 'home', stateT: 0, t: 0, lift: 0,
      pose: Object.assign({}, Court3D.POSES[type.homePose] || Court3D.POSES.stand), poseName: 'stand', phase: r() * 6,
      ballSide, skin: SKIN[Math.floor(r() * SKIN.length)], hair: HAIR[Math.floor(r() * HAIR.length)],
      engaged: false, planted: false, reached: false
    };
  }

  function setState(h, s) { h.state = s; h.stateT = 0; }
  function engage(h) { if (!h.engaged) { h.engaged = true; setState(h, 'react'); } }

  /* shooter: { pos, to } ; onBall: the first defender */
  function update(h, dt, shooter, onBall) {
    const T = h.type;
    h.t += dt; h.stateT += dt; h.phase += dt;
    if (!h.engaged && onBall && onBall.state === 'beaten') engage(h);
    const S = flat(shooter.pos);
    const toRim = Court3D.dirToRim(S);
    const fromRim = [-toRim[0], 0, -toRim[2]];
    const dS = Math.hypot(S[0] - RIM.x, S[2] - RIM.z);
    const rimF = [RIM.x, 0, RIM.z];
    let target = h.home, maxSpeed = 4, poseName = T.homePose || 'stand';

    if (h.state === 'home') {
      if (T.role === 'leaper' || T.id === 'leaper') poseName = Math.sin(h.phase * 6) > 0.3 ? 'guard' : 'stand';
    } else if (h.state === 'react') {
      maxSpeed = 1;
      if (h.stateT >= T.react) setState(h, 'rotate');
    } else if (h.state === 'rotate') {
      maxSpeed = T.speed;
      switch (T.role) {
        case 'drop': {
          const at = Math.max(1.2, Math.min(T.holdAt, dS - 1.6));
          target = V.add(rimF, V.mul(fromRim, at));
          poseName = dS < 10 ? 'wall' : 'contest';
          break;
        }
        case 'charge': {
          if (!h.planted) {
            // slide into the path you're on, a few feet in front of the rim
            const aim = shooter.to ? flat(shooter.to) : S;
            const dir = V.norm(V.sub(aim, rimF));
            const way = Math.hypot(aim[0] - RIM.x, aim[2] - RIM.z) < 1 ? fromRim : dir;
            h.spot = V.add(rimF, V.mul(way, T.holdAt));
            target = h.spot;
            if (gap2(h.pos, h.spot) < 0.45) { h.planted = true; h.vel = [0, 0, 0]; }
            poseName = 'run1';
          } else { target = h.pos; maxSpeed = 0; poseName = 'stand'; }
          break;
        }
        case 'step': {
          // steps up to meet you once you're inside fifteen feet
          if (dS < 15) target = V.add(S, V.mul(toRim, 2.6)); else target = V.add(rimF, V.mul(fromRim, T.holdAt));
          poseName = dS < 11 ? 'wall' : 'guard';
          break;
        }
        case 'late': {
          target = V.add(S, V.mul(toRim, 2.2));
          poseName = gap2(h.pos, S) < 5 ? 'wall' : (Math.sin(h.phase * 11) > 0 ? 'run1' : 'run2');
          break;
        }
        case 'dig': {
          // lunges at the ball, but only around his own area
          const fromHome = gap2(S, h.home);
          target = fromHome < 8 ? V.add(S, V.mul(toRim, 0.8)) : h.home;
          poseName = 'guard';
          break;
        }
      }
    } else if (h.state === 'air') {
      const k = Math.min(1, h.stateT / 0.7);
      h.lift = Math.sin(Math.PI * k) * 2.6;
      maxSpeed = 3; poseName = 'air';
      if (k >= 1) { h.lift = 0; setState(h, 'recover'); }
    } else if (h.state === 'recover') {
      maxSpeed = 0.5; poseName = 'stand';
      if (h.stateT > 0.5) setState(h, 'rotate');
    } else if (h.state === 'contest') {
      maxSpeed = 2;
      const k = Math.min(1, h.stateT / 0.6);
      h.lift = Math.sin(Math.PI * k) * (0.6 + T.length * 1.0);
      poseName = 'wall';
      if (k >= 1) { h.lift = 0; setState(h, 'done'); }
    } else if (h.state === 'done') { maxSpeed = 1; poseName = h.stateT < 0.7 ? 'wall' : 'stand'; }

    // arrive steering, same as the on-ball defender
    const to = V.sub(target, h.pos); to[1] = 0;
    const dist = Math.hypot(to[0], to[2]);
    const want = dist > 1e-4 && maxSpeed > 0 ? V.mul(to, Math.min(maxSpeed, dist * 5) / dist) : [0, 0, 0];
    const dv = V.sub(want, h.vel), dvl = Math.hypot(dv[0], dv[2]), lim = 60 * dt;
    h.vel = dvl > lim ? V.add(h.vel, V.mul(dv, lim / dvl)) : want;
    h.pos = V.add(h.pos, V.mul(h.vel, dt)); h.pos[1] = 0;
    if (Math.hypot(h.vel[0], h.vel[2]) > 5 && h.state === 'rotate' && !h.planted && T.role !== 'drop') poseName = Math.sin(h.phase * 11) > 0 ? 'run1' : 'run2';
    h.poseName = poseName;
    h.pose = Court3D.blendPose(h.pose, Court3D.POSES[poseName], Math.min(1, dt * (poseName.startsWith('run') ? 16 : 10)));
  }

  /* kind: layup | euro | floater | pullup | jumper | fade */
  function contest(h, shooterPos, kind) {
    if (!h || !h.engaged) return 0;
    if (h.state === 'air' || h.state === 'recover' || h.state === 'react') return 0.03;
    const T = h.type;
    const S = flat(shooterPos), g = gap2(h.pos, S);
    const toRim = Court3D.dirToRim(S);
    const ahead = (h.pos[0] - S[0]) * toRim[0] + (h.pos[2] - S[2]) * toRim[2];
    let base = clamp((6.8 - g) / 4.8, 0, 1) * T.length;
    if (ahead < -0.8) base *= 0.35;
    return clamp(base * (T.vs[kind] == null ? 1 : T.vs[kind]), 0, 1);
  }
  function blockChance(h, c, kind) {
    if (!h || !h.engaged || c < 0.6) return 0;
    return (c - 0.6) * h.type.block * (kind === 'layup' || kind === 'euro' ? 1.5 : 0.8);
  }
  function pumpFake(h, shooterPos, rand) {
    if (!h || !h.engaged || h.state === 'air' || h.state === 'recover' || h.state === 'react') return false;
    if (gap2(h.pos, shooterPos) > 9) return false;
    if ((rand || Math.random)() < h.type.bite) { setState(h, 'air'); return true; }
    return false;
  }
  function reactToShot(h, shooterPos) {
    if (!h || !h.engaged) return;
    if ((h.state === 'rotate' || h.state === 'done') && gap2(h.pos, shooterPos) < 7 && !h.planted) setState(h, 'contest');
  }
  // Ran into a planted charge taker?
  function charge(h, shooterPos, reach) {
    return !!h && h.type.role === 'charge' && h.planted && gap2(h.pos, shooterPos) < (reach || 2.1);
  }
  // The digger gets one swipe at the ball as you go by.
  function steal(h, shooterPos, rand) {
    if (!h || h.type.role !== 'dig' || h.state !== 'rotate' || h.reached) return false;
    if (gap2(h.pos, shooterPos) > 2.7) return false;
    h.reached = true;
    return (rand || Math.random)() < h.type.steal;
  }

  function draw(ctx, cam, h) {
    const E = cam.eye;
    const z = Court3D.toCam(cam, V.add(h.pos, [0, 3, 0]))[2];
    const alpha = Math.max(0, Math.min(0.96, (z - 2.5) / 2.5));
    if (alpha < 0.05) return null;
    return Court3D.drawFigure(ctx, cam, {
      pos: h.pos, face: [E[0] - h.pos[0], 0, E[2] - h.pos[2]], pose: h.pose, lift: h.lift, scale: h.type.height, reach: h.type.reach,
      colors: { skin: h.skin, hair: h.hair, jersey: h.type.colors.jersey, shorts: h.type.colors.shorts, shoes: '#f4f4f4', trim: h.type.colors.trim },
      number: h.type.number, alpha
    });
  }

  return { TYPES, IDS, create, update, engage, contest, blockChance, pumpFake, reactToShot, charge, steal, draw };
})();
