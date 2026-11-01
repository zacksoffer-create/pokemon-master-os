/* Pitches: what leaves the pitcher's hand. Every pitch type is data (speed,
   how much it rides or drops, how much it runs or sweeps), the way a
   ballpark tracking system describes it. A pitch is solved backwards from
   where he's aiming, so a slider aimed off the plate starts at the middle and
   breaks there: tunneling falls out of the physics, nobody scripts it.

   Coordinates, in feet: x to the catcher's right (first-base side), y up,
   z out toward the mound. The back point of home plate is the origin. */
const Pitch = (() => {
  const G = 32.174;
  const MPH = 1.46667;
  const PLATE_Z = 1.42;          // front edge of the plate: where pitches are called and met
  const RELEASE_Z = 54.2;        // 60'6" less about six feet of extension
  const BALL_R = 0.121;
  const ZONE = { half: 0.708, y0: 1.55, y1: 3.45 };   // the plate and knees-to-letters

  // ivb: inches of ride (+) or drop (-) compared with a ball thrown with no spin
  // hb: inches of run toward his arm side (+) or sweep to his glove side (-)
  const TYPES = {
    FF: { id: 'FF', name: 'Fastball', short: 'Heater', mph: 94, ivb: 16, hb: 7, spin: 'back' },
    SI: { id: 'SI', name: 'Sinker', short: 'Sinker', mph: 92, ivb: 6, hb: 15, spin: 'tilt' },
    FC: { id: 'FC', name: 'Cutter', short: 'Cutter', mph: 89, ivb: 9, hb: -4, spin: 'dot' },
    SL: { id: 'SL', name: 'Slider', short: 'Slider', mph: 85, ivb: 2, hb: -6, spin: 'dot' },
    SW: { id: 'SW', name: 'Sweeper', short: 'Sweeper', mph: 82, ivb: 1, hb: -16, spin: 'dot' },
    CU: { id: 'CU', name: 'Curveball', short: 'Curve', mph: 78, ivb: -13, hb: -8, spin: 'top' },
    CH: { id: 'CH', name: 'Changeup', short: 'Change', mph: 84, ivb: 7, hb: 14, spin: 'fade' },
    FS: { id: 'FS', name: 'Splitter', short: 'Splitter', mph: 87, ivb: 1, hb: 8, spin: 'tumble' }
  };
  const OFFSPEED = { CU: 1, CH: 1, FS: 1, SL: 1, SW: 1 };

  // where he aims, in feet: x is toward the batter's far side (away), y is height
  const LOCS = {
    heart: [0, 2.5], up: [0.1, 3.3], upOut: [0.05, 3.95], upIn: [-0.5, 3.25], upAway: [0.55, 3.3],
    low: [0.1, 1.75], dirt: [0.15, 1.0], lowAway: [0.6, 1.75], lowIn: [-0.55, 1.8],
    away: [0.62, 2.45], awayOff: [1.25, 2.3], in: [-0.6, 2.6], inOff: [-1.2, 2.8],
    middleIn: [-0.3, 2.5], middleAway: [0.3, 2.5],
    // the black: right on the edge, as likely a ball as a strike
    blackAway: [0.86, 2.35], blackIn: [-0.86, 2.6], blackLow: [0.35, 1.42], blackLowAway: [0.8, 1.55]
  };
  // where his hand is at release, by arm slot: [toward his arm side, height]
  const SLOTS = { over: [1.3, 6.3], three: [1.95, 5.8], low: [2.5, 5.15], side: [3.0, 4.4] };

  function gauss(rand) { const r = rand || Math.random; let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const awaySign = bats => bats === 'L' ? -1 : 1;

  function target(locId, bats) {
    const l = LOCS[locId] || LOCS.heart;
    return [l[0] * awaySign(bats), l[1]];
  }

  /* make({ type, over, throws, slot, aim: [x, y], speed }) -> a pitch in flight.
     Movement is a constant push for the whole flight, so the ball's path is a
     parabola and its arrival time is exact. */
  function make(o) {
    const base = TYPES[o.type] || TYPES.FF;
    const T = Object.assign({}, base, o.over || {});
    const arm = o.throws === 'L' ? 1 : -1;            // a righty's arm side is the catcher's left
    const slot = SLOTS[o.slot] || SLOTS.three;
    const p0 = [arm * slot[0], slot[1], RELEASE_Z];
    const mph = T.mph * (o.speed || 1);
    const v = mph * MPH;
    const dz = PLATE_Z - p0[2];
    const time = -dz / (v * 0.96);                    // it loses about 8% on the way in
    const t2 = time * time;
    const a = [2 * (T.hb / 12) * arm / t2, -G + 2 * (T.ivb / 12) / t2, 0.08 * v / time];
    const aim = o.aim || [0, 2.5];
    const v0 = [(aim[0] - p0[0] - 0.5 * a[0] * t2) / time, (aim[1] - p0[1] - 0.5 * a[1] * t2) / time, (dz - 0.5 * a[2] * t2) / time];
    return { type: T, typeId: T.id, mph: Math.round(mph), p0, v0, a, T: time, aim: aim.slice(), throws: o.throws || 'R' };
  }
  function at(p, t) {
    return [p.p0[0] + p.v0[0] * t + 0.5 * p.a[0] * t * t, p.p0[1] + p.v0[1] * t + 0.5 * p.a[1] * t * t, p.p0[2] + p.v0[2] * t + 0.5 * p.a[2] * t * t];
  }
  function vel(p, t) { return [p.v0[0] + p.a[0] * t, p.v0[1] + p.a[1] * t, p.v0[2] + p.a[2] * t]; }

  // balls and strikes: any part of the ball over the plate between the knees and the letters
  function isStrike(x, y) {
    return Math.abs(x) <= ZONE.half + BALL_R && y >= ZONE.y0 - BALL_R && y <= ZONE.y1 + BALL_R;
  }
  // how far outside the zone, in feet (0 if it's a strike)
  function outside(x, y) {
    const ox = Math.max(0, Math.abs(x) - ZONE.half - BALL_R);
    const oy = Math.max(0, ZONE.y0 - BALL_R - y, y - ZONE.y1 - BALL_R);
    return Math.hypot(ox, oy);
  }
  // the middle of the plate, belt high: the pitch a hitter waits for
  function isHeart(x, y) { return Math.abs(x) < 0.45 && y > 2.0 && y < 3.05; }

  // plain words for where it crossed, from the batter's point of view
  function describe(x, y, bats) {
    const ax = x * awaySign(bats);
    const out = outside(x, y);
    let v = y > ZONE.y1 + 0.35 ? 'above the letters' : y > ZONE.y1 - 0.25 ? 'up' : y < ZONE.y0 - 0.4 ? 'in the dirt' : y < ZONE.y0 + 0.25 ? 'at the knees' : '';
    let h = ax > ZONE.half + 0.3 ? 'off the plate away' : ax > 0.45 ? 'away' : ax < -(ZONE.half + 0.3) ? 'off the plate inside' : ax < -0.45 ? 'in' : '';
    if (!v && !h) return out > 0 ? 'just off the plate' : 'right down the middle';
    if (v === 'up' && h) return `up and ${h === 'in' ? 'in' : h === 'away' ? 'away' : h}`;
    if (v === 'at the knees' && (h === 'away' || h === 'in')) return `at the knees, ${h}`;
    return [v, h].filter(Boolean).join(', ');
  }

  return { G, MPH, PLATE_Z, RELEASE_Z, BALL_R, ZONE, TYPES, OFFSPEED, LOCS, SLOTS, gauss, target, make, at, vel, isStrike, outside, isHeart, describe, awaySign };
})();
