/* GolfReads: on a golf course the conditions are the defense. Each one is
   data: how you spot it (the tell), what beats it (the read), and how a choice
   against it grades. The same choice into the same wind grades the same way
   every time; the physics decides how close it finishes. */
const GolfReads = (() => {
  const MPH = GolfPhysics.MPH;

  const READS = {
    calm: {
      id: 'calm', name: 'Light air', tag: 'Nothing to fight',
      tell: 'The flag hangs down and the treetops are still.',
      read: 'Trust your number. Stock swing with the club that carries it.'
    },
    into: {
      id: 'into', name: 'Into the wind', tag: 'Flag blowing at you',
      tell: 'The flag points back at you and the clouds come your way.',
      read: 'Knock it down with a short finish, and take about one more club for every 10 mph. A high ball climbs into the wind and falls out of the sky short.'
    },
    down: {
      id: 'down', name: 'Downwind', tag: 'Flag blowing away',
      tell: 'The flag points at the green and the clouds run away from you.',
      read: 'Hit it high and let it ride: about one less club for every 10 mph. A low one lands hot and runs through.'
    },
    cross: {
      id: 'cross', name: 'Crosswind', tag: 'Flag standing out sideways',
      tell: 'The flag and the treetops lean to one side.',
      read: 'Curve it into the wind so the two cancel out, or aim upwind and let it drift back. Straight at the flag gets blown off line.'
    },
    tucked: {
      id: 'tucked', name: 'Tucked pin', tag: 'Flag hiding behind sand',
      tell: 'A bunker sits between you and a flag cut close behind it.',
      read: 'Long finish: high and soft, so it carries the sand and stops. A low one lands in the bunker or skips past.'
    },
    water: {
      id: 'water', name: 'Water short', tag: 'Carry the hazard',
      tell: 'Water in front of the green, and not much room between it and the flag.',
      read: 'Take enough club to land it past the flag. Long leaves a putt; short is a penalty.'
    },
    fallaway: {
      id: 'fallaway', name: 'Falling-away green', tag: 'Back flag, green runs away',
      tell: 'The flag is in the back and the green gets darker as it runs away from you.',
      read: 'Fly it high and soft to the flag so it stops. A low one lands running and goes off the back.'
    },
    flier: {
      id: 'flier', name: 'Flier lie', tag: 'Sitting down in the rough',
      tell: 'Grass between the club and the ball.',
      read: 'The grass kills the spin, so it jumps out and runs. Take one less club or swing easier than your number.'
    },
    bunker: {
      id: 'bunker', name: 'Greenside bunker', tag: 'In the sand',
      tell: 'You are in the sand near the green.',
      read: 'Long finish to hit it high, and swing about half again harder than the number. A low one catches it thin and flies the green.'
    },
    dogleg: {
      id: 'dogleg', name: 'Dogleg', tag: 'Fairway turns',
      tell: 'The fairway bends, with trees inside the corner.',
      read: 'Aim at the outside of the corner and bend it back around: draw a dogleg left, fade a dogleg right. Straight runs through the corner into the rough.'
    }
  };
  const IDS = Object.keys(READS);

  const PUTTS = {
    flat: {
      id: 'flat', name: 'Straight putt', tag: 'No tilt',
      tell: 'Even shading and nothing drifting across the green.',
      read: 'Firm, center of the cup. Take the break out of play.'
    },
    uphill: {
      id: 'uphill', name: 'Uphill putt', tag: 'Hole sits above you',
      tell: 'The green gets lighter toward the hole and the drift comes back at you.',
      read: 'Hit it firm. Uphill putts hold their line and stop quickly.'
    },
    downhill: {
      id: 'downhill', name: 'Downhill putt', tag: 'Hole sits below you',
      tell: 'The green gets darker toward the hole and the drift runs past it.',
      read: 'Just get it rolling. Downhill putts run out, and they break more as they slow down.'
    },
    breaker: {
      id: 'breaker', name: 'Breaking putt', tag: 'Slopes across your line',
      tell: 'The drift runs across your line.',
      read: 'Aim on the high side and let it fall in. Miss on the low side and it never had a chance.'
    }
  };
  const PUTT_IDS = Object.keys(PUTTS);

  // head > 0: into you. cross > 0: blowing toward your right.
  function windRel(wind, dir) {
    const w = wind || [0, 0, 0];
    const mph = Math.hypot(w[0], w[2]) / MPH;
    const along = (w[0] * dir[0] + w[2] * dir[2]) / MPH;
    const cross = (w[0] * dir[2] - w[2] * dir[0]) / MPH;
    return { mph, head: -along, cross };
  }
  function windWords(w) {
    const m = Math.round(w.mph);
    if (m < 3) return 'no wind to speak of';
    if (Math.abs(w.head) >= Math.abs(w.cross) * 1.2) return w.head > 0 ? `a ${m} mph wind in your face` : `a ${m} mph wind at your back`;
    if (Math.abs(w.cross) >= Math.abs(w.head) * 1.2) return w.cross > 0 ? `a ${m} mph wind blowing left to right` : `a ${m} mph wind blowing right to left`;
    return `a ${m} mph wind ${w.head > 0 ? 'into you' : 'behind you'} and ${w.cross > 0 ? 'off the left' : 'off the right'}`;
  }

  // walk the line from the ball toward the flag and report what's on it
  function along(c, from, to, fn) {
    const dx = c.pin[0] - c.ball[0], dz = c.pin[1] - c.ball[2], L = Math.hypot(dx, dz) || 1;
    for (let d = from; d <= to; d += 1.5) {
      const s = d / L;
      if (s < 0 || s > 1) continue;
      if (fn(c.surfaceAt(c.ball[0] + dx * s, c.ball[2] + dz * s))) return true;
    }
    return false;
  }

  /* c: { ball [x,y,z], pin [x,z], dist, dir [x,0,z], wind, lie, tee, dogleg, green, surfaceAt, putt, slope } */
  function assess(c) {
    const w = windRel(c.wind, c.dir);
    if (c.putt) {
      const sl = c.slope || [0, 0];
      const up = sl[0] * c.dir[0] + sl[1] * c.dir[2];
      const across = sl[0] * c.dir[2] - sl[1] * c.dir[0];
      let id = 'flat';
      if (Math.abs(across) >= 0.01 && c.dist >= 1.2) id = 'breaker';
      else if (up >= 0.01) id = 'uphill';
      else if (up <= -0.01) id = 'downhill';
      // the low side: a ball rolling across a slope falls toward lower ground
      return { primary: id, putt: true, up, across, lowSide: across > 0 ? -1 : 1, w };
    }
    const list = [];
    if (c.lie === 'bunker') list.push(['bunker', 100]);
    if (c.pin && c.dist < 235 && c.dist > 30 && along(c, Math.max(4, c.dist - 55), c.dist - 3, s => s === 'water')) list.push(['water', 90]);
    if (c.pin && c.dist < 210 && c.dist > 14 && along(c, c.dist - 16, c.dist - 2.5, s => s === 'sand')) list.push(['tucked', 85]);
    if (c.green && c.pin && c.dist < 160 && c.dist > 18) {
      const g = c.green, sl = g.slope, fall = sl[0] * c.dir[0] + sl[1] * c.dir[2];
      const back = (c.pin[0] - g.c[0]) * c.dir[0] + (c.pin[1] - g.c[1]) * c.dir[2];
      if (fall <= -0.015 && back > Math.max(g.rx, g.rz) * 0.3) list.push(['fallaway', 80]);
    }
    // wind matters on full shots, not on chips and pitches
    if (w.mph >= 8 && c.dist >= 60) {
      const id = Math.abs(w.head) >= Math.abs(w.cross) ? (w.head > 0 ? 'into' : 'down') : 'cross';
      list.push([id, w.mph >= 12 ? 88 : 60]);
    }
    if (c.lie === 'rough' && c.dist > 70) list.push(['flier', 70]);
    if (c.tee && c.dogleg) list.push(['dogleg', 66]);
    list.push(['calm', 0]);
    list.sort((a, b) => b[1] - a[1]);
    const primary = list[0][0];
    // a strong wind still counts when something else leads
    const strongWind = list.find(x => (x[0] === 'into' || x[0] === 'down' || x[0] === 'cross') && x[1] >= 88);
    return { primary, second: strongWind && strongWind[0] !== primary ? strongWind[0] : null, all: list.map(x => x[0]), w };
  }

  const ORDER = ['A', 'B', 'C', 'D', 'F'];
  const worse = (a, b) => ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))];
  const curveL = s => s === 'draw' || s === 'hook';
  const curveR = s => s === 'fade' || s === 'slice';

  /* s: { type, clubs (how far past the still-air number this swing carries, in clubs of about 8%),
          more, less, shape, aimOff (deg, + right), powerRatio } */
  const plural = n => `${n} ${n > 1 ? 'clubs' : 'club'}`;
  const JUDGE = {
    calm: s => s.type === 'knock' ? ['B', 'Nothing to fight, so the knockdown just gave up distance.'] : ['A', 'Stock swing in still air.'],
    // about a club for every 10 mph: the rule of thumb the read teaches. A
    // knockdown cheats the wind a little, a full swing climbs into it.
    into: (s, a) => {
      const mph = Math.round(a.w.head), need = a.w.head / 11, needStock = a.w.head / 8;
      if (s.type === 'high') return ['D', 'You sent it up into the wind.'];
      if (s.type === 'knock') return s.clubs >= need - 0.3 ? ['A', 'You knocked it down and took enough club.'] : ['B', `Right shot, but into ${mph} mph it needed ${plural(Math.max(1, Math.round(need)))} more.`];
      return s.clubs >= needStock - 0.3 ? ['B', 'Enough club, but a full finish still climbs into the wind.'] : ['C', `A normal swing into ${mph} mph comes up short.`];
    },
    down: (s, a) => {
      const mph = Math.round(-a.w.head), need = -a.w.head / 9;
      if (s.type === 'knock') return ['C', 'You kept it low with the wind behind you.'];
      if (s.type === 'high') return -s.clubs >= need - 0.3 ? ['A', 'You took less club, put it up in the wind and let it ride.'] : ['B', `Right shot, but with ${mph} mph behind you it wanted ${plural(Math.max(1, Math.round(need)))} less.`];
      return -s.clubs >= need - 0.3 ? ['B', 'You took less club downwind.'] : ['C', 'Normal club and a normal swing, downwind.'];
    },
    cross: (s, a) => {
      const pushRight = a.w.cross > 0;
      if (pushRight ? curveL(s.shape) : curveR(s.shape)) return ['A', 'You curved it into the wind.'];
      if (pushRight ? s.aimOff < -1.5 : s.aimOff > 1.5) return ['B', 'You aimed upwind and let it drift.'];
      if (pushRight ? curveR(s.shape) : curveL(s.shape)) return ['D', 'You curved it the same way the wind blows.'];
      if (s.type === 'knock') return ['B', 'You kept it low, under most of the wind.'];
      return ['C', 'Straight at the flag in a crosswind.'];
    },
    tucked: s => s.type === 'high' ? ['A', 'High and soft over the sand.'] : s.type === 'knock' ? ['D', 'Low at a flag tucked behind a bunker.'] : ['B', 'A stock shot at a tucked flag.'],
    water: s => s.clubs >= 0.5 ? ['A', 'You played it past the flag, away from the water.'] : s.clubs >= -0.3 ? ['B', 'Right at your number with water short.'] : ['D', 'Less than your number with water short.'],
    fallaway: s => s.type === 'high' ? ['A', 'High and soft, so it stopped on a green running away.'] : s.type === 'knock' ? ['D', 'Low onto a green running away from you.'] : ['B', 'A stock shot onto a green running away.'],
    flier: s => s.clubs <= -0.2 ? ['A', 'You took less club out of the rough.'] : s.more ? ['D', 'More club out of a flier lie.'] : ['C', 'Your normal club out of the rough.'],
    bunker: s => s.type === 'high' ? (s.powerRatio >= 1.3 ? ['A', 'You opened up and swung through the sand.'] : ['B', 'Opened up, but it needed more swing.']) : s.type === 'knock' ? ['D', 'Low out of a bunker.'] : ['C', 'A stock swing out of the sand.'],
    dogleg: (s, a, c) => {
      const want = c.dogleg === 'left' ? curveL : curveR, against = c.dogleg === 'left' ? curveR : curveL;
      if (want(s.shape)) return ['A', 'You shaped it with the dogleg.'];
      if (against(s.shape)) return ['C', 'You curved it against the dogleg.'];
      return ['B', 'Straight at a dogleg.'];
    }
  };
  function judge(a, s, c) {
    let [grade, why] = JUDGE[a.primary](s, a, c);
    if (a.second) {
      const [g2, w2] = JUDGE[a.second](s, a, c);
      if (ORDER.indexOf(g2) >= ORDER.indexOf(grade) && w2 !== why) { grade = worse(grade, g2); why += ' ' + w2; }
    }
    return { grade, why };
  }

  /* how the putt went: holed, how far it finished, which side it missed on */
  function judgePutt(a, r) {
    if (r.holed) return { grade: 'A', why: 'Drained it.' };
    const ft = r.leave * 3;
    if (r.short) {
      return { grade: ft < 3 ? 'B' : 'C', why: ft < 3 ? 'Left it just short.' : 'Never got it to the hole.' };
    }
    if (a.primary === 'breaker' && r.lowSide) return { grade: ft < 3 ? 'C' : 'D', why: 'Missed it on the low side.' };
    if (ft < 2.5) return { grade: 'B', why: a.primary === 'breaker' ? 'Missed on the high side, the right side to miss.' : 'Good pace; it just slid by.' };
    if (ft < 6) return { grade: 'C', why: 'Left yourself a knee-knocker.' };
    return { grade: 'D', why: 'Long way from the hole.' };
  }

  return { READS, IDS, PUTTS, PUTT_IDS, assess, judge, judgePutt, windRel, windWords };
})();
