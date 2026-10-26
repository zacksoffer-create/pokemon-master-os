/* Engine 2 · Defenders
   Each defender is data: how far he starts, where he wants to end up, how fast
   he gets there, how quick his feet are, how long his arms are, how often he
   jumps at a fake, and which side he gives you. The behavior below reads
   those numbers, so a new defender is a new row, not new code. */
const Defense = (() => {
  const { V, RIM } = Court3D;

  const ARCHETYPES = {
    closer: {
      id: 'closer', name: 'The Closer', tag: 'Flies at shooters',
      tell: 'Starts deep, sprints at you, hands high.',
      read: 'Make him leave his feet with a pump fake, or drive while he is still running at you.',
      start: 13, gap: 2.1, speed: 17, lateral: 0.55, length: 1.0, bite: 0.85, shade: 0,
      height: 1.0, reach: 1.05, setPose: 'contest', colors: { jersey: '#8a2432', shorts: '#6c1b27', trim: '#f2d16b' }, number: 3
    },
    sagger: {
      id: 'sagger', name: 'The Sagger', tag: 'Gives you space',
      tell: 'Stops short and sits back with his hands low.',
      read: 'He is daring you to shoot and guarding the drive. Take the open jumper right away.',
      start: 12, gap: 7.2, speed: 9, lateral: 0.8, length: 0.9, bite: 0.15, shade: 0,
      height: 1.02, reach: 1.0, setPose: 'sag', colors: { jersey: '#2f4f8a', shorts: '#243d6b', trim: '#ffffff' }, number: 21
    },
    baseline: {
      id: 'baseline', name: 'Shade Baseline', tag: 'Takes away the baseline',
      tell: 'Sits on your baseline side with his outside foot up.',
      read: 'He walls off the baseline. Drive to the middle.',
      start: 10, gap: 3.0, speed: 12, lateral: 0.7, length: 1.0, bite: 0.35, shade: 'baseline',
      height: 1.0, reach: 1.0, setPose: 'guard', colors: { jersey: '#2c6e49', shorts: '#225a3b', trim: '#ffffff' }, number: 12
    },
    middle: {
      id: 'middle', name: 'Force Baseline', tag: 'Takes away the middle',
      tell: 'Cheats toward the middle of the floor.',
      read: 'He keeps you out of the middle. Go baseline.',
      start: 10, gap: 3.0, speed: 12, lateral: 0.7, length: 1.0, bite: 0.35, shade: 'middle',
      height: 1.0, reach: 1.0, setPose: 'guard', colors: { jersey: '#6b3fa0', shorts: '#55317f', trim: '#ffffff' }, number: 8
    },
    long: {
      id: 'long', name: 'The Wingspan', tag: 'Long arms, slow feet',
      tell: 'Tall, arms way out, slow to slide.',
      read: 'Shooting over him is a fight. Put it on the floor, or step back to make space.',
      start: 9, gap: 2.7, speed: 11, lateral: 0.25, length: 1.35, bite: 0.25, shade: 0,
      height: 1.1, reach: 1.3, setPose: 'contest', colors: { jersey: '#1d1f24', shorts: '#15161a', trim: '#e2581f' }, number: 34
    },
    pest: {
      id: 'pest', name: 'The Pest', tag: 'Quick feet, short arms',
      tell: 'Small, right up on you, hands busy.',
      read: 'You will not get by him. Rise up over him; a step-back makes it easy.',
      start: 8, gap: 1.8, speed: 14, lateral: 0.95, length: 0.62, bite: 0.3, shade: 0, steal: 0.35,
      height: 0.9, reach: 0.88, setPose: 'guard', colors: { jersey: '#d9a21b', shorts: '#b4850f', trim: '#1d1f24' }, number: 1
    },
    gambler: {
      id: 'gambler', name: 'The Gambler', tag: 'Jumps at everything',
      tell: 'Bouncing, leaning in, hunting a steal.',
      read: 'He bites on every fake. Pump, then go right by him.',
      start: 9, gap: 2.4, speed: 13, lateral: 0.6, length: 0.95, bite: 0.95, shade: 0, steal: 0.25,
      height: 1.0, reach: 1.05, setPose: 'guard', colors: { jersey: '#c4502a', shorts: '#9e3f20', trim: '#ffffff' }, number: 0
    }
  };
  const IDS = Object.keys(ARCHETYPES);
  const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#5c3a1e', '#a86b3c'];
  const HAIR = ['#1b1410', '#2b1d14', '#3b2716', '#0f0f10'];

  function contestLabel(c) {
    if (c < 0.15) return { text: 'Wide open', tone: 'open' };
    if (c < 0.35) return { text: 'Open', tone: 'open' };
    if (c < 0.6) return { text: 'Contested', tone: 'mid' };
    if (c < 0.85) return { text: 'Tight', tone: 'hot' };
    return { text: 'Smothered', tone: 'hot' };
  }

  function sideVec(shooterPos) { const d = Court3D.dirToRim(shooterPos); return [-d[2], 0, d[0]]; }

  function create(archId, shooterPos, rand) {
    const arch = ARCHETYPES[archId] || ARCHETYPES.closer;
    const r = rand || Math.random;
    const dir = Court3D.dirToRim(shooterPos);
    const toRim = Math.hypot(RIM.x - shooterPos[0], RIM.z - shooterPos[2]);
    const startD = Math.min(arch.start, Math.max(3, toRim - 1));
    const side = sideVec(shooterPos);
    const ang = Court3D.polarOf(shooterPos).angle;
    let shadeSide = 0;
    if (arch.shade) {
      const base = Math.abs(ang) < 12 ? (r() < 0.5 ? -1 : 1) : Math.sign(ang);
      shadeSide = arch.shade === 'baseline' ? base : -base;
    }
    const jitter = (r() - 0.5) * 2.5;
    const pos = V.add(V.add(shooterPos, V.mul(dir, startD)), V.mul(side, jitter));
    pos[1] = 0;
    return {
      arch, pos, vel: [0, 0, 0], state: 'closing', t: 0, stateT: 0, lift: 0, shadeSide,
      pose: Object.assign({}, Court3D.POSES.stand), poseName: 'stand', phase: r() * 6,
      skin: SKIN[Math.floor(r() * SKIN.length)], hair: HAIR[Math.floor(r() * HAIR.length)],
      gapWanted: arch.gap, contestJump: 0, reacting: 0, faced: 'shooter'
    };
  }

  function targetFor(d, shooterPos) {
    const dir = Court3D.dirToRim(shooterPos);
    const side = sideVec(shooterPos);
    const toRim = Math.hypot(RIM.x - shooterPos[0], RIM.z - shooterPos[2]);
    const gap = Math.min(d.gapWanted, Math.max(1.6, toRim - 0.5));
    const t = V.add(V.add(shooterPos, V.mul(dir, gap)), V.mul(side, d.shadeSide * 1.35));
    t[1] = 0;
    return t;
  }

  function setState(d, s) { d.state = s; d.stateT = 0; }

  function update(d, dt, shooter, rand) {
    const arch = d.arch;
    d.t += dt; d.stateT += dt; d.phase += dt;
    const S = shooter.pos;
    let target = targetFor(d, S);
    let maxSpeed = arch.speed;
    let poseName = arch.setPose;
    d.faced = 'shooter';

    if (d.state === 'closing') {
      const to = V.sub(target, d.pos), dist = Math.hypot(to[0], to[2]);
      if (dist < 0.35) setState(d, 'set');
    } else if (d.state === 'set') {
      maxSpeed = 7 + arch.lateral * 11;
    } else if (d.state === 'air') {
      const dur = 0.72;
      const k = Math.min(1, d.stateT / dur);
      d.lift = Math.sin(Math.PI * k) * 2.4;
      // momentum carries him at you and a little past
      const dir = Court3D.dirToRim(S);
      target = V.add(S, V.mul(dir, 0.9 - 1.6 * k));
      target = V.add(target, V.mul(sideVec(S), 1.6 * k * (d.flySide || 1)));
      maxSpeed = 9;
      poseName = 'air';
      if (k >= 1) { d.lift = 0; setState(d, 'recover'); }
    } else if (d.state === 'recover') {
      poseName = 'stand';
      maxSpeed = 0.5;
      if (d.stateT > 0.6 - arch.lateral * 0.3) setState(d, 'closing');
    } else if (d.state === 'beaten') {
      const dir = Court3D.dirToRim(S);
      target = V.add(V.sub(S, V.mul(dir, 0.9)), V.mul(sideVec(S), -d.beatSide * 1.7));
      maxSpeed = 15;
      d.faced = 'rim';
      if (d.stateT > 0.75 + (1 - arch.lateral) * 0.6) { setState(d, 'closing'); d.gapWanted = 2.2; }
    } else if (d.state === 'cutoff') {
      maxSpeed = 16;
      if (d.stateT > 0.35) setState(d, 'set');
    } else if (d.state === 'contest') {
      maxSpeed = 3;
      const k = Math.min(1, d.stateT / 0.6);
      d.lift = Math.sin(Math.PI * k) * (0.6 + arch.length * 0.9);
      poseName = 'wall';
      if (k >= 1) { d.lift = 0; setState(d, 'done'); }
    } else if (d.state === 'done') {
      maxSpeed = 2; poseName = d.stateT < 0.7 ? 'wall' : 'stand';
    }

    // arrive steering on the floor
    const to = V.sub(target, d.pos); to[1] = 0;
    const dist = Math.hypot(to[0], to[2]);
    const want = dist > 1e-4 ? V.mul(to, Math.min(maxSpeed, dist * 5) / dist) : [0, 0, 0];
    const acc = d.state === 'cutoff' || d.state === 'air' ? 80 : 45;
    const dv = V.sub(want, d.vel);
    const dvl = Math.hypot(dv[0], dv[2]);
    const lim = acc * dt;
    d.vel = dvl > lim ? V.add(d.vel, V.mul(dv, lim / dvl)) : want;
    d.pos = V.add(d.pos, V.mul(d.vel, dt)); d.pos[1] = 0;

    const speed = Math.hypot(d.vel[0], d.vel[2]);
    if (d.state === 'closing' || d.state === 'beaten') {
      if (speed > 4) poseName = Math.sin(d.phase * 11) > 0 ? 'run1' : 'run2';
      if (d.state === 'closing' && dist < 4 && arch.setPose === 'contest') poseName = 'wall';
    }
    if (d.state === 'set' && arch.id === 'pest') poseName = Math.sin(d.phase * 7) > 0 ? 'guard' : 'contest';
    if (d.state === 'set' && arch.id === 'gambler' && Math.sin(d.phase * 5) > 0.6) poseName = 'contest';
    d.poseName = poseName;
    const k = Math.min(1, dt * (poseName.startsWith('run') ? 16 : 10));
    d.pose = Court3D.blendPose(d.pose, Court3D.POSES[poseName], k);
  }

  function gapTo(d, shooterPos) { return Math.hypot(d.pos[0] - shooterPos[0], d.pos[2] - shooterPos[2]); }

  function contest(d, shooterPos) {
    if (!d) return 0;
    const arch = d.arch;
    if (d.state === 'air' || d.state === 'recover') return 0.04;
    const dir = Court3D.dirToRim(shooterPos);
    const rel = V.sub(d.pos, shooterPos);
    const ahead = rel[0] * dir[0] + rel[2] * dir[2];
    if (d.state === 'beaten' || ahead < -0.3) return 0.12;
    const gap = gapTo(d, shooterPos);
    const base = Math.max(0, Math.min(1, (7.2 - gap) / 5));
    return Math.max(0, Math.min(1, base * arch.length));
  }

  // Is he flying at you right now? Shooting into him draws a foul.
  function foulable(d, shooterPos) {
    return !!d && d.state === 'air' && d.stateT < 0.6 && gapTo(d, shooterPos) < 3.6;
  }

  function pumpFake(d, shooterPos, rand) {
    const r = rand || Math.random;
    if (!d || d.state === 'air' || d.state === 'recover' || d.state === 'beaten') return false;
    const gap = gapTo(d, shooterPos);
    const closing = d.state === 'closing' && Math.hypot(d.vel[0], d.vel[2]) > 6;
    const p = d.arch.bite * (gap < 5.5 ? 1 : 0.35) + (closing ? 0.1 : 0);
    if (r() < p) { d.flySide = r() < 0.5 ? -1 : 1; setState(d, 'air'); return true; }
    return false;
  }

  /* Drive resolution. side: -1 left, +1 right (screen terms).
     Momentum (attacking a closeout or a defender in the air) and the side he
     gives you matter most; quick feet take drives away. */
  function driveOdds(d, side, handle) {
    const arch = d.arch;
    const speed = Math.hypot(d.vel[0], d.vel[2]);
    let momentum = 0;
    if (d.state === 'air' || d.state === 'recover') momentum = 1.4;
    else if (d.state === 'closing' && speed > 6) momentum = 1;
    else if (d.state === 'beaten') momentum = 1.2;
    let p = 0.4 + momentum * 0.45;
    if (d.shadeSide) p += d.shadeSide === side ? -0.55 : 0.55;
    p -= (arch.lateral - 0.5) * 0.9;
    if (d.gapWanted > 5.5 && momentum === 0) p -= 0.3;
    p += ((handle == null ? 60 : handle) - 60) / 250;
    return Math.max(0.04, Math.min(0.97, p));
  }
  function drive(d, side, handle, rand) {
    const r = rand || Math.random;
    const p = driveOdds(d, side, handle);
    const win = r() < p;
    let steal = false;
    if (!win && d.arch.steal && r() < d.arch.steal * 0.6) steal = true;
    if (win) { d.beatSide = side; setState(d, 'beaten'); }
    else { setState(d, 'cutoff'); d.gapWanted = 1.8; }
    return { win, steal, odds: p };
  }

  function reactToShot(d, shooterPos) {
    if (!d) return;
    if (d.state === 'set' || d.state === 'closing' || d.state === 'cutoff') {
      if (gapTo(d, shooterPos) < 7) setState(d, 'contest');
    }
  }

  function blockChance(d, c, shotTypeId) {
    if (!d || c < 0.75) return 0;
    return (c - 0.75) * 1.1 * d.arch.length * (shotTypeId === 'layup' ? 1.3 : 1);
  }

  // What the right play was, for the after-possession card.
  function grade(entry) {
    if (entry.turnover) return 'F';
    if (entry.fouled) return 'A';
    if (entry.blocked) return 'D';
    const c = entry.contest == null ? 0 : entry.contest;
    if (entry.beatHim && c < 0.35) return 'A';
    if (c < 0.2) return 'A';
    if (c < 0.45) return 'B';
    if (c < 0.7) return 'C';
    return 'D';
  }

  function drawDefender(ctx, cam, d) {
    const S = cam.eye;
    let face = [S[0] - d.pos[0], 0, S[2] - d.pos[2]];
    if (d.faced === 'rim') face = [RIM.x - d.pos[0], 0, RIM.z - d.pos[2]];
    const lean = d.shadeSide && (d.state === 'set' || d.state === 'cutoff') ? d.shadeSide * 0.35 : 0;
    return Court3D.drawFigure(ctx, cam, {
      pos: d.pos, face, pose: d.pose, lift: d.lift, scale: d.arch.height, reach: d.arch.reach, lean,
      colors: { skin: d.skin, hair: d.hair, jersey: d.arch.colors.jersey, shorts: d.arch.colors.shorts, shoes: '#f4f4f4', trim: d.arch.colors.trim },
      number: d.arch.number, alpha: 0.96, back: d.faced === 'rim'
    });
  }

  return { ARCHETYPES, IDS, create, update, contest, contestLabel, foulable, pumpFake, drive, driveOdds, reactToShot, blockChance, grade, gapTo, drawDefender, targetFor };
})();
