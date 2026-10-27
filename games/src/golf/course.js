/* GolfCourse: the holes as data, what's under the ball anywhere on them, and
   the camera and painter that draw them. Plain canvas 2D, no libraries.
   World in yards: x right (looking from the tee), y up, z toward the green. */
const GolfCourse = (() => {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const V = { add, sub, mul, dot, len, norm, lerp3 };
  const NEAR = 0.4;

  // ---------- holes ----------
  // Shapes: ellipses are [x, z, rx, rz, rot]. Fairways are ribbons of
  // [x, z, half-width] points. Trees are [x, z, canopy radius, canopy height].
  // wind.dir is where the wind blows toward, as a heading (0 = toward the green).
  const HOLES = {
    h1: {
      name: 'Front Door', par: 4, blurb: 'Wide open and straight. Find your swing.',
      line: [[0, 0], [0, 190], [-6, 374]],
      fairway: [[[0, 25, 14], [0, 90, 18], [0, 160, 20], [-2, 230, 19], [-4, 290, 17], [-5, 345, 14]]],
      green: { c: [-6, 375], rx: 14, rz: 16, rot: 0, slope: [0.01, -0.006], stimp: 10 },
      pin: [-3, 378],
      bunkers: [[16, 238, 5.5, 11, 0.1], [-21, 367, 4.5, 8, 0]],
      water: [], trees: [], ob: 55,
      wind: { dir: [0, 360], mph: [2, 7] }
    },
    h2: {
      name: 'Wet Feet', par: 3, blurb: 'Water short, flag up front, wind in your face.',
      line: [[0, 0], [1, 157]],
      fairway: [[[2, 143, 8], [2, 149, 10]]],
      green: { c: [2, 162], rx: 15, rz: 12, rot: 0, slope: [0, 0.012], stimp: 10 },
      pin: [0, 155],
      bunkers: [[-15, 172, 6, 4, 0.3]],
      water: [[2, 126, 34, 15, 0]], trees: [], ob: 60,
      wind: { dir: [170, 190], mph: [10, 15] }
    },
    h3: {
      name: 'The Bend', par: 4, dogleg: 'left', aimTee: [12, 245], blurb: 'Dogleg left. Trees guard the inside of the corner.',
      line: [[0, 0], [0, 225], [-38, 315], [-90, 396]],
      fairway: [[[0, 30, 14], [0, 120, 17], [0, 200, 18], [-4, 245, 18], [-22, 285, 17], [-45, 320, 16], [-68, 355, 15]]],
      green: { c: [-90, 396], rx: 14, rz: 15, rot: 0.6, slope: [-0.008, 0.01], stimp: 10 },
      pin: [-92, 399],
      bunkers: [[-73, 386, 4.5, 4, 0.5], [-104, 410, 4, 6, 0.4]],
      water: [],
      trees: [[-18, 205, 6, 10], [-26, 222, 6, 11], [-35, 240, 7, 11], [-44, 258, 6, 10], [-28, 188, 6, 10], [-52, 278, 6, 10], [28, 262, 7, 11], [20, 284, 6, 10], [12, 304, 6, 10]],
      ob: 55, wind: { dir: [0, 360], mph: [3, 9] }
    },
    h4: {
      name: 'Short Side', par: 3, blurb: 'The flag is tucked behind the front-left bunker.',
      line: [[0, 0], [-7, 168]],
      fairway: [[[0, 146, 9], [0, 152, 11]]],
      green: { c: [0, 175], rx: 16, rz: 13, rot: 0, slope: [0.008, 0.006], stimp: 10.5 },
      pin: [-8, 168],
      bunkers: [[-9, 157, 9, 4.2, 0], [15, 183, 4, 6, 0]],
      water: [], trees: [], ob: 60,
      wind: { dir: [0, 360], mph: [0, 4] }
    },
    h5: {
      name: 'Long Haul', par: 5, blurb: 'A long one with the wind at your back. A creek crosses short of the green.',
      line: [[0, 0], [6, 250], [0, 430], [-5, 533]],
      fairway: [[[0, 30, 16], [4, 140, 20], [6, 250, 21], [3, 340, 19], [0, 420, 16], [-1, 444, 11]], [[-3, 466, 10], [-4, 505, 12]]],
      green: { c: [-4, 530], rx: 15, rz: 16, rot: 0, slope: [0.006, -0.008], stimp: 10 },
      pin: [-5, 533],
      bunkers: [[20, 268, 6, 10, 0], [-19, 300, 6, 9, 0], [12, 521, 4, 7, 0]],
      water: [[0, 456, 50, 6, 0]], trees: [], ob: 60,
      wind: { dir: [-15, 15], mph: [10, 16] }
    },
    h6: {
      name: 'Runway', par: 4, blurb: 'Back flag on a green that runs away from you.',
      line: [[0, 0], [0, 200], [5, 357]],
      fairway: [[[0, 30, 14], [0, 110, 17], [1, 200, 18], [3, 280, 16], [4, 318, 12]]],
      green: { c: [4, 347], rx: 12, rz: 19, rot: 0, slope: [0, -0.028], stimp: 11.5, firm: 0.5 },
      pin: [5, 362],
      bunkers: [[-15, 225, 6, 10, 0], [16, 342, 4, 7, 0]],
      water: [], trees: [], ob: 55,
      wind: { dir: [0, 360], mph: [2, 7] }
    },
    h7: {
      name: 'Crosswind', par: 3, blurb: 'Water right of the green and the wind blowing toward it.',
      line: [[0, 0], [4, 148]],
      fairway: [[[0, 128, 8], [0, 134, 10]]],
      green: { c: [0, 148], rx: 14, rz: 12, rot: 0, slope: [-0.008, 0.008], stimp: 10 },
      pin: [4, 148],
      bunkers: [[-17, 150, 4, 7, 0]],
      water: [[27, 146, 9, 22, 0]], trees: [], ob: 60,
      wind: { dir: [80, 100], mph: [12, 18] }
    },
    h8: {
      name: 'Fade Away', par: 4, dogleg: 'right', aimTee: [-12, 240], blurb: 'Dogleg right around a stand of trees.',
      line: [[0, 0], [0, 215], [38, 300], [84, 386]],
      fairway: [[[0, 30, 14], [0, 120, 17], [1, 200, 18], [8, 245, 18], [24, 280, 17], [45, 315, 16], [64, 348, 14]]],
      green: { c: [82, 383], rx: 13, rz: 15, rot: -0.5, slope: [0.01, 0.006], stimp: 10 },
      pin: [84, 386],
      bunkers: [[68, 368, 4, 4, -0.5], [96, 396, 4, 6, -0.5]],
      water: [],
      trees: [[18, 195, 6, 10], [25, 212, 6, 11], [34, 230, 7, 11], [44, 248, 6, 10], [28, 180, 6, 10], [52, 266, 6, 10], [-26, 258, 7, 11], [-18, 278, 6, 10], [-8, 296, 6, 10]],
      ob: 55, wind: { dir: [0, 360], mph: [4, 9] }
    },
    h9: {
      name: 'Home', par: 4, blurb: 'Water all the way down the left, and the wind blowing toward it.',
      line: [[0, 0], [3, 200], [-4, 424]],
      fairway: [[[0, 30, 14], [2, 120, 17], [3, 200, 18], [3, 300, 17], [2, 380, 14]]],
      green: { c: [2, 422], rx: 14, rz: 15, rot: 0, slope: [-0.01, 0.006], stimp: 10.5 },
      pin: [-4, 424],
      bunkers: [[17, 414, 4, 8, 0]],
      water: [[-40, 270, 13, 130, 0]], trees: [], ob: 55,
      wind: { dir: [255, 285], mph: [9, 14] }
    },
    // closest-to-the-pin extras
    c1: {
      name: 'The Island', par: 3, blurb: 'An island green. Nothing but water around it.',
      line: [[0, 0], [2, 136]],
      fairway: [],
      green: { c: [0, 134], rx: 13, rz: 11, rot: 0, slope: [0.006, 0.008], stimp: 10 },
      pin: [2, 136],
      bunkers: [], water: [[0, 134, 32, 28, 0]], trees: [], ob: 60,
      wind: { dir: [0, 360], mph: [6, 12] }
    },
    c2: {
      name: 'Back Shelf', par: 3, blurb: 'A back flag on a green that falls away.',
      line: [[0, 0], [0, 130]],
      fairway: [[[0, 96, 8], [0, 103, 10]]],
      green: { c: [0, 120], rx: 13, rz: 16, rot: 0, slope: [0, -0.026], stimp: 11.5, firm: 0.5 },
      pin: [0, 133],
      bunkers: [[-14, 116, 4, 7, 0]], water: [], trees: [], ob: 60,
      wind: { dir: [-20, 20], mph: [8, 12] }
    },
    range: {
      name: 'The Range', par: 0, range: true, blurb: 'Hit balls. Watch what they do.',
      line: [[0, 0], [0, 300]],
      fairway: [[[0, 10, 30], [0, 150, 42], [0, 290, 46]]],
      targets: [[0, 50], [-10, 100], [10, 150], [-6, 200], [8, 250]],
      green: null, pin: null, bunkers: [], water: [], trees: [], ob: 95,
      wind: { dir: [0, 360], mph: [0, 0] }
    },
    practice: {
      name: 'Practice Green', par: 0, putting: true, blurb: 'Read it, roll it.',
      line: [[0, -4], [0, 0]], fairway: [],
      green: { c: [0, 0], rx: 22, rz: 22, rot: 0, slope: [0, 0], stimp: 10 },
      pin: [0, 0], bunkers: [], water: [], trees: [], ob: 80,
      wind: { dir: [0, 360], mph: [0, 3] }
    }
  };
  const ROUND = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9'];

  // ---------- shapes ----------
  function ellPts(e, n) {
    const [cx, cz, rx, rz, rot] = e, pts = [], c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, u = Math.cos(a) * rx, v = Math.sin(a) * rz;
      pts.push([cx + u * c - v * s, cz + u * s + v * c]);
    }
    return pts;
  }
  function inEll(e, x, z, grow) {
    const [cx, cz, rx, rz, rot] = e, g = grow || 0;
    const dx = x - cx, dz = z - cz, c = Math.cos(-(rot || 0)), s = Math.sin(-(rot || 0));
    const u = dx * c - dz * s, v = dx * s + dz * c;
    return (u * u) / ((rx + g) * (rx + g)) + (v * v) / ((rz + g) * (rz + g)) <= 1;
  }
  function inPoly(poly, x, z) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  }
  // smooth a ribbon of [x, z, halfWidth] points into an outline
  function ribbon(pts) {
    const sm = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 6; k++) {
        const t = k / 6, t2 = t * t, t3 = t2 * t;
        const f = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        sm.push([f(0), f(1), f(2)]);
      }
    }
    sm.push(pts[pts.length - 1]);
    const L = [], Rr = [];
    sm.forEach((p, i) => {
      const a = sm[Math.max(0, i - 1)], b = sm[Math.min(sm.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      // round the ends a little
      const end = i === 0 || i === sm.length - 1 ? 0.75 : 1;
      L.push([p[0] - dz * p[2] * end, p[1] + dx * p[2] * end]);
      Rr.push([p[0] + dz * p[2] * end, p[1] - dx * p[2] * end]);
    });
    // rounded caps
    const capF = [], capB = [];
    const first = sm[0], last = sm[sm.length - 1];
    const d0 = [sm[1][0] - first[0], sm[1][1] - first[1]], l0 = Math.hypot(d0[0], d0[1]) || 1;
    const d1 = [last[0] - sm[sm.length - 2][0], last[1] - sm[sm.length - 2][1]], l1 = Math.hypot(d1[0], d1[1]) || 1;
    for (let k = 1; k < 6; k++) {
      const a = Math.PI * k / 6;
      // back cap: from right edge around behind the start to the left edge
      const bx = -d0[0] / l0, bz = -d0[1] / l0, rx = d0[1] / l0, rz = -d0[0] / l0;
      capB.push([first[0] + (rx * Math.cos(a) + bx * Math.sin(a)) * first[2] * 0.75, first[1] + (rz * Math.cos(a) + bz * Math.sin(a)) * first[2] * 0.75]);
      const fx = d1[0] / l1, fz = d1[1] / l1, lx = -d1[1] / l1, lz = d1[0] / l1;
      capF.push([last[0] + (lx * Math.cos(a) + fx * Math.sin(a)) * last[2] * 0.75, last[1] + (lz * Math.cos(a) + fz * Math.sin(a)) * last[2] * 0.75]);
    }
    return L.concat(capF).concat(Rr.reverse()).concat(capB);
  }
  // nearest point on the hole's centerline: distance off it and how far along
  function lineInfo(line, x, z) {
    let best = { d: 1e9, along: 0 }, acc = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (L * L), 0, 1);
      const px = a[0] + dx * t, pz = a[1] + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { d, along: acc + L * t, seg: i };
      acc += L;
    }
    best.total = acc;
    return best;
  }
  // the point on the centerline `dist` yards from (x, z), furthest along the hole
  function pointAhead(line, x, z, dist) {
    let found = null;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const fx = a[0] - x, fz = a[1] - z;
      const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - dist * dist;
      const disc = B * B - 4 * A * C;
      if (disc < 0) continue;
      const t = (-B + Math.sqrt(disc)) / (2 * A);
      if (t >= 0 && t <= 1) found = [a[0] + dx * t, a[1] + dz * t];
    }
    return found;
  }

  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // Precompute outlines, tree lines and bounds once per hole.
  const built = {};
  function build(id) {
    if (built[id]) return built[id];
    const h = HOLES[id];
    const B = { id, h, fair: (h.fairway || []).map(ribbon), bunk: h.bunkers.map(e => ellPts(e, 26)), water: h.water.map(e => ellPts(e, 36)) };
    const g = h.green;
    if (g) {
      const e = [g.c[0], g.c[1], g.rx, g.rz, g.rot];
      B.greenE = e; B.green = ellPts(e, 40);
      B.fringeE = [g.c[0], g.c[1], g.rx + 1.8, g.rz + 1.8, g.rot]; B.fringe = ellPts(B.fringeE, 40);
    }
    if (h.targets) {
      B.targets = h.targets.map(t => { const e = [t[0], t[1], 6, 6, 0]; return { e, pts: ellPts(e, 24), pin: t }; });
    }
    const tee = h.line[0], t1 = h.line[1];
    const td = norm([t1[0] - tee[0], 0, t1[1] - tee[1]]);
    B.teeDir = td;
    B.tee = [[-4, -4], [4, -4], [4, 6], [-4, 6]].map(([u, v]) => [tee[0] + td[2] * u + td[0] * v, tee[1] - td[0] * u + td[2] * v]);
    // tree lines along both sides, just inside the out-of-bounds stakes
    const r = rng(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const trees = h.trees.map(t => ({ x: t[0], z: t[1], r: t[2], h: t[3], tone: r(), ph: r() * 6 }));
    if (!h.putting) {
      const info = lineInfo(h.line, 0, 0);
      const total = info.total;
      for (let s = -20; s < total + 40; s += 9 + r() * 7) {
        const p = alongLine(h.line, s);
        [-1, 1].forEach(side => {
          const off = h.ob - 3 + r() * 10;
          const x = p.x + p.nx * off * side, z = p.z + p.nz * off * side;
          trees.push({ x, z, r: 5 + r() * 3, h: 9 + r() * 4, tone: r(), ph: r() * 6, edge: true });
        });
      }
    }
    B.trees = trees;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    h.line.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); });
    B.bounds = { minX: minX - h.ob, maxX: maxX + h.ob, minZ: minZ - 20, maxZ: maxZ + 35 };
    // mowing stripes run across the hole's main direction
    built[id] = B;
    return B;
  }
  function alongLine(line, s) {
    let acc = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if (s <= acc + L || i === line.length - 2) {
        const t = (s - acc) / L, nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
        return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, nx, nz, dx: (b[0] - a[0]) / L, dz: (b[1] - a[1]) / L };
      }
      acc += L;
    }
    return { x: 0, z: 0, nx: 1, nz: 0, dx: 0, dz: 1 };
  }

  // What's under the ball. Order matters: the green sits on top of everything.
  function surfaceAt(id, x, z) {
    const B = build(id), h = B.h;
    if (B.greenE && inEll(B.greenE, x, z)) return 'green';
    if (B.targets) for (const t of B.targets) if (inEll(t.e, x, z)) return 'green';
    if (B.fringeE && inEll(B.fringeE, x, z)) return 'fringe';
    for (const e of h.bunkers) if (inEll(e, x, z)) return 'sand';
    for (const e of h.water) if (inEll(e, x, z)) return 'water';
    if (inPoly(B.tee, x, z)) return 'tee';
    for (const f of B.fair) if (inPoly(f, x, z)) return 'fairway';
    if (h.putting) return Math.hypot(x, z) < 30 ? 'fringe' : 'rough';
    const li = lineInfo(h.line, x, z);
    if (li.d > h.ob || li.along > li.total + 32 || li.along < -15) return 'ob';
    return 'rough';
  }
  function slopeAt(id, x, z, override) {
    const B = build(id);
    const g = override || (B.h.green && B.h.green.slope);
    return g ? [g[0], g[1]] : [0, 0];
  }
  // green height relative to its center, for shading
  function greenHeight(slope, c, x, z) { return slope[0] * (x - c[0]) + slope[1] * (z - c[1]); }

  // ---------- camera ----------
  function camera(eye, fwd, W, H, fovY) {
    const f = norm(fwd);
    const r = norm([f[2], 0, -f[0]]);
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    const focal = (H / 2) / Math.tan(fovY / 2);
    return { eye, f, r, u, focal, W, H, cx: W / 2, cy: H / 2, fovY };
  }
  // a camera described by where it sits, what it looks at, and its field of view; easy to blend
  function lookCam(rig, W, H) { return camera(rig.eye, sub(rig.look, rig.eye), W, H, rig.fov); }
  function blendRig(a, b, t) { return { eye: lerp3(a.eye, b.eye, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t) }; }
  // The aiming view: up behind the ball looking down the line, framed so the
  // target sits in the upper half and the ground near you runs under the golfer.
  function aimRig(ball, target, W, H) {
    const dx = target[0] - ball[0], dz = target[2] - ball[2];
    const D = Math.max(28, Math.hypot(dx, dz));
    const d = norm([dx, 0, dz]);
    const back = 6 + 0.2 * D, high = 4 + 0.2 * D;
    const eye = [ball[0] - d[0] * back, high, ball[2] - d[2] * back];
    const aspect = W / H;
    let fov = clamp(40 - D * 0.09, 16, 36) * Math.PI / 180;
    if (aspect > 0.75) fov *= 0.85;
    // aim a little below the target so it sits above the middle of the screen
    const tgt = [ball[0] + d[0] * D, 0, ball[2] + d[2] * D];
    const toT = sub(tgt, eye), dist = Math.hypot(toT[0], toT[2]);
    const dep = Math.atan2(high, dist) + Math.atan(0.1 * Math.tan(fov / 2) / 0.5);
    const look = [eye[0] + d[0] * 100 * Math.cos(dep), eye[1] - 100 * Math.sin(dep), eye[2] + d[2] * 100 * Math.cos(dep)];
    return { eye, look, fov, dir: d, D };
  }
  // The putting view: low behind the ball, the cup in the upper middle.
  function puttRig(ball, cup, W, H) {
    const dx = cup[0] - ball[0], dz = cup[2] - ball[2];
    const D = Math.max(1, Math.hypot(dx, dz));
    const d = norm([dx, 0, dz]);
    const back = 2.6 + 0.38 * D, high = 1.35 + 0.2 * D;
    const eye = [ball[0] - d[0] * back, high, ball[2] - d[2] * back];
    const fov = clamp(46 - D * 0.4, 32, 46) * Math.PI / 180;
    const tgt = [cup[0] + d[0] * D * 0.08, 0, cup[2] + d[2] * D * 0.08];
    const dist = Math.hypot(tgt[0] - eye[0], tgt[2] - eye[2]);
    const dep = Math.atan2(high, dist) + Math.atan(0.12 * Math.tan(fov / 2) / 0.5);
    const look = [eye[0] + d[0] * 50 * Math.cos(dep), eye[1] - 50 * Math.sin(dep), eye[2] + d[2] * 50 * Math.cos(dep)];
    return { eye, look, fov, dir: d, D };
  }
  // Watching it land: same spot, turned and zoomed toward a point on the ground.
  function watchRig(from, at, widthYd) {
    const dist = len(sub(at, from.eye));
    const fov = clamp(2 * Math.atan((widthYd || 60) / 2 / Math.max(1, dist)), 8 * Math.PI / 180, from.fov);
    return { eye: from.eye.slice(), look: at.slice(), fov };
  }

  function toCam(cam, p) { const v = sub(p, cam.eye); return [dot(v, cam.r), dot(v, cam.u), dot(v, cam.f)]; }
  function projC(cam, c) { const z = c[2]; return { x: cam.cx + cam.focal * c[0] / z, y: cam.cy - cam.focal * c[1] / z, s: cam.focal / z, z }; }
  function project(cam, p) { const c = toCam(cam, p); return c[2] > NEAR ? projC(cam, c) : null; }
  function clipPoly(cs) {
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length];
      const ain = a[2] > NEAR, bin = b[2] > NEAR;
      if (ain) out.push(a);
      if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
    }
    return out;
  }
  function pathGround(ctx, cam, pts2, y) {
    const cs = clipPoly(pts2.map(p => toCam(cam, [p[0], y || 0, p[1]])));
    if (cs.length < 3) return false;
    ctx.beginPath();
    cs.forEach((c, i) => { const q = projC(cam, c); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath();
    return true;
  }
  function fillGround(ctx, cam, pts2, fill) { if (pathGround(ctx, cam, pts2)) { ctx.fillStyle = fill; ctx.fill(); return true; } return false; }
  function horizonY(cam) {
    const fh = norm([cam.f[0], 0, cam.f[2]]);
    const p = project(cam, add(cam.eye, mul(fh, 5000)));
    return p ? p.y : -10;
  }
  function farPoint(cam, ang, elev) {
    const d = [Math.sin(ang) * Math.cos(elev), Math.sin(elev), Math.cos(ang) * Math.cos(elev)];
    return project(cam, add(cam.eye, mul(d, 5000)));
  }
  // a ground segment drawn as a dashed or solid line
  function groundLine(ctx, cam, a, b) {
    let ca = toCam(cam, a), cb = toCam(cam, b);
    if (ca[2] <= 1 && cb[2] <= 1) return false;
    if (ca[2] <= 1) { const t = (1 - ca[2]) / (cb[2] - ca[2]); ca = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, 1]; }
    if (cb[2] <= 1) { const t = (1 - cb[2]) / (ca[2] - cb[2]); cb = [cb[0] + (ca[0] - cb[0]) * t, cb[1] + (ca[1] - cb[1]) * t, 1]; }
    const pa = projC(cam, ca), pb = projC(cam, cb);
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    return true;
  }

  // ---------- scenery ----------
  const hills = (() => {
    const r = rng(19), far = [], near = [];
    for (let i = 0; i <= 120; i++) far.push(0.012 + 0.02 * Math.sin(i * 0.21) * Math.sin(i * 0.053 + 1) + r() * 0.006);
    for (let i = 0; i <= 160; i++) near.push(0.006 + 0.01 * Math.abs(Math.sin(i * 0.37) + 0.5 * Math.sin(i * 0.11)) + r() * 0.004);
    return { far, near };
  })();
  const clouds = (() => { const r = rng(23), out = []; for (let i = 0; i < 14; i++) out.push({ a: r() * Math.PI * 2, e: 0.05 + r() * 0.2, w: 0.08 + r() * 0.12, h: 0.02 + r() * 0.02 }); return out; })();

  function drawSky(ctx, cam, t, wind) {
    const hy = horizonY(cam);
    if (hy > 0) {
      const g = ctx.createLinearGradient(0, Math.min(0, hy - cam.H), 0, hy);
      g.addColorStop(0, '#5b9fd6'); g.addColorStop(0.75, '#a9d1ec'); g.addColorStop(1, '#e4efe6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cam.W, hy + 1);
      // clouds drift with the wind: one more tell
      const wx = wind ? wind[0] : 0, wz = wind ? wind[2] : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      clouds.forEach(c => {
        const ang = c.a + t * wx * 0.0012;
        let e = c.e - t * wz * 0.0012;
        e = 0.03 + (((e - 0.03) % 0.24) + 0.24) % 0.24;
        const p = farPoint(cam, ang, e);
        if (!p || p.y > hy) return;
        const w = c.w * cam.focal * 0.6, h = c.h * cam.focal * 0.6;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, w, h, 0, 0, Math.PI * 2); ctx.ellipse(p.x + w * 0.4, p.y - h * 0.5, w * 0.6, h * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      });
      // hills on the horizon
      const drawRidge = (arr, col, scale) => {
        ctx.fillStyle = col; ctx.beginPath();
        let started = false;
        for (let i = 0; i < arr.length; i++) {
          const ang = i / (arr.length - 1) * Math.PI * 2;
          const p = farPoint(cam, ang, arr[i] * scale);
          if (!p) { started = false; continue; }
          if (!started) { ctx.moveTo(p.x, hy + 2); ctx.lineTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(cam.W + 50, hy + 2); ctx.lineTo(-50, hy + 2); ctx.closePath(); ctx.fill();
      };
      drawRidge(hills.far, '#9db8b0', 1);
      drawRidge(hills.near, '#5f8f63', 1);
    }
    // ground: the rough runs to the horizon and fades into haze
    const top = Math.max(0, hy);
    const g2 = ctx.createLinearGradient(0, top, 0, cam.H);
    g2.addColorStop(0, '#7e9f6c'); g2.addColorStop(0.15, '#4f8a3f'); g2.addColorStop(1, '#3f7a33');
    ctx.fillStyle = g2; ctx.fillRect(0, top, cam.W, cam.H - top);
  }

  // ---------- the hole ----------
  const COL = {
    rough: '#4a8a3c', ob: '#3a6b34', fair: '#6fb552', fair2: '#7cc25d', fringe: '#76bb58', green: '#8fd36b', tee: '#7cc25d',
    sand: '#ecdcaa', sandEdge: '#c9b47c', water: '#3c8dc4', water2: '#62acd8', line: 'rgba(255,255,255,0.85)'
  };
  function drawHole(ctx, cam, id, opts) {
    const B = build(id), h = B.h, o = opts || {};
    // fairways with mowing stripes
    B.fair.forEach(f => {
      if (!pathGround(ctx, cam, f)) return;
      ctx.save();
      ctx.fillStyle = COL.fair; ctx.fill();
      ctx.clip();
      ctx.fillStyle = COL.fair2;
      const d = B.teeDir, nx = d[2], nz = -d[0];
      const bz = B.bounds;
      for (let s = -40; s < bz.maxZ + 60; s += 24) {
        const a = [d[0] * s, d[2] * s], b = [d[0] * (s + 12), d[2] * (s + 12)];
        const quad = [[a[0] - nx * 300, a[1] - nz * 300], [a[0] + nx * 300, a[1] + nz * 300], [b[0] + nx * 300, b[1] + nz * 300], [b[0] - nx * 300, b[1] - nz * 300]];
        fillGround(ctx, cam, quad, COL.fair2);
      }
      ctx.restore();
    });
    fillGround(ctx, cam, B.tee, COL.tee);
    if (B.targets) B.targets.forEach(t => fillGround(ctx, cam, t.pts, COL.green));
    if (B.green) {
      fillGround(ctx, cam, B.fringe, COL.fringe);
      // the green is shaded by height: lighter is higher, so slope shows at a glance
      if (pathGround(ctx, cam, B.green)) {
        const g = h.green, sl = o.slope || g.slope, m = Math.hypot(sl[0], sl[1]);
        let fill = COL.green;
        if (m > 0.002) {
          // shade around what you're looking at, so the tilt shows up close
          const fc = o.focus ? [o.focus[0], o.focus[1]] : g.c, R = o.focus ? o.focus[2] : Math.max(g.rx, g.rz);
          const u = [sl[0] / m, sl[1] / m];
          let hi = null, lo = null, RR = R;
          for (let i = 0; i < 4 && !(hi && lo); i++, RR *= 0.5) {
            hi = project(cam, [fc[0] + u[0] * RR, 0, fc[1] + u[1] * RR]); lo = project(cam, [fc[0] - u[0] * RR, 0, fc[1] - u[1] * RR]);
          }
          if (hi && lo && Math.hypot(hi.x - lo.x, hi.y - lo.y) > 2) {
            const k = clamp(m / 0.022, 0, 1) * (o.focus ? 1.5 : 1);
            const gr = ctx.createLinearGradient(lo.x, lo.y, hi.x, hi.y);
            gr.addColorStop(0, shade('#8fd36b', -0.16 * k)); gr.addColorStop(1, shade('#8fd36b', 0.14 * k));
            fill = gr;
          }
        }
        ctx.fillStyle = fill; ctx.fill();
      }
    }
    h.bunkers.forEach((e, i) => {
      if (pathGround(ctx, cam, B.bunk[i])) { ctx.fillStyle = COL.sand; ctx.fill(); ctx.strokeStyle = COL.sandEdge; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
    h.water.forEach((e, i) => {
      if (pathGround(ctx, cam, B.water[i])) {
        ctx.fillStyle = COL.water; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
        const t = o.t || 0;
        for (let k = 0; k < 10; k++) {
          const z = e[1] - e[3] + (k + 0.5) / 10 * e[3] * 2 + Math.sin(t * 0.6 + k) * 1.2;
          groundLine(ctx, cam, [e[0] - e[2], 0, z], [e[0] + e[2], 0, z]);
        }
        ctx.restore();
      }
    });
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  // Things that stand up: trees, flags, the ball. Returned as depth-sorted draw calls.
  function standing(ctx, cam, id, opts) {
    const B = build(id), o = opts || {}, items = [];
    const t = o.t || 0, ws = o.windMph || 0;
    B.trees.forEach(tr => {
      const base = toCam(cam, [tr.x, 0, tr.z]);
      if (base[2] < 1) return;
      items.push({ z: base[2], draw: () => drawTree(ctx, cam, tr, t, ws, o.windDir || 0) });
    });
    const flags = [];
    if (o.pin) flags.push(o.pin);
    if (B.targets) B.targets.forEach(tg => flags.push(tg.pin));
    flags.forEach((p, i) => {
      const c = toCam(cam, [p[0], 0, p[1]]);
      if (c[2] < 0.5) return;
      if (o.putting && i === 0 && o.pin) items.push({ z: c[2], draw: () => drawCup(ctx, cam, p) });
      else items.push({ z: c[2], draw: () => drawFlag(ctx, cam, p, t, o.wind, i > 0 || !o.pin ? '#f2c94c' : '#e8453c', false) });
    });
    return items;
  }
  function drawTree(ctx, cam, tr, t, ws, wdir) {
    const base = project(cam, [tr.x, 0, tr.z]);
    const top = project(cam, [tr.x, tr.h, tr.z]);
    if (!base || !top) return;
    const r = tr.r * top.s;
    if (r < 0.6) return;
    // treetops lean and sway with the wind
    const lean = Math.sin(wdir * Math.PI / 180) * Math.min(1, ws / 20);
    const sway = (Math.sin(t * (1.2 + ws * 0.08) + tr.ph) * 0.35 + 0.65) * lean * r * 0.22;
    ctx.fillStyle = 'rgba(20,40,20,0.25)';
    ctx.beginPath(); ctx.ellipse(base.x, base.y, r * 0.9, Math.max(1, r * 0.22), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5b4632'; ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x + sway * 0.5, top.y + r * 0.4); ctx.stroke();
    const dark = tr.tone < 0.5 ? '#2f5d2e' : '#2a5530', mid = tr.tone < 0.5 ? '#3d7a3a' : '#3f7240';
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(top.x + sway, top.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mid;
    ctx.beginPath(); ctx.arc(top.x + sway * 1.2 - r * 0.25, top.y - r * 0.3, r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(top.x + sway * 1.1 + r * 0.35, top.y - r * 0.05, r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // on the green the flag comes out: just the cup
  function drawCup(ctx, cam, p) {
    const q = project(cam, [p[0], 0, p[1]]);
    if (!q) return;
    const r = Math.max(2, 0.059 * q.s);
    const ry = Math.max(1, r * Math.min(0.5, Math.abs(cam.f[1]) * 1.4 + 0.12));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 1.12, ry * 1.12 + 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16210f';
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  // The flag is the wind gauge: it hangs in still air and stands out stiff in a gale.
  function drawFlag(ctx, cam, p, t, wind, color, putting) {
    const base = project(cam, [p[0], 0, p[1]]);
    if (!base) return;
    const H0 = 2.6;
    const topP = project(cam, [p[0], H0, p[1]]);
    if (!topP) return;
    let k = 1;
    const px = base.y - topP.y;
    const minPx = putting ? 0 : 30;
    if (px < minPx) k = Math.min(8, minPx / Math.max(1, px));
    const H = H0 * k;
    const top = project(cam, [p[0], H, p[1]]);
    if (!top) return;
    // cup
    if (putting || base.s > 6) {
      ctx.fillStyle = '#1d2a1a';
      ctx.beginPath(); ctx.ellipse(base.x, base.y, Math.max(1.5, 0.059 * base.s), Math.max(0.8, 0.059 * base.s * 0.35), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#f4f1e8'; ctx.lineWidth = Math.max(1.5, 0.03 * base.s * k);
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    const w = wind || [0, 0, 0];
    const sp = Math.hypot(w[0], w[2]);
    const str = clamp(sp / 9, 0, 1);
    const dir = sp > 0.01 ? [w[0] / sp, 0, w[2] / sp] : [0.7, 0, 0.7];
    const L = 0.9 * k, Hf = 0.6 * k;
    const pts = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const flap = Math.sin(t * (4 + str * 8) - f * 4) * 0.12 * L * f * (0.3 + str);
      const droop = (1 - str) * f * L * 0.85;
      pts.push([p[0] + dir[0] * f * L * (0.25 + 0.75 * str) - dir[2] * flap, H - droop, p[1] + dir[2] * f * L * (0.25 + 0.75 * str) + dir[0] * flap]);
    }
    const poly = pts.concat(pts.slice().reverse().map(q => [q[0], q[1] - Hf, q[2]]));
    const pp = poly.map(q => project(cam, q));
    if (pp.some(q => !q)) return;
    ctx.fillStyle = color;
    ctx.beginPath(); pp.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fill();
  }

  function drawBallAt(ctx, cam, p, opt) {
    const o = opt || {};
    const q = project(cam, p);
    if (!q) return null;
    const r = Math.max(o.minR || 2.4, 0.034 * q.s);
    if (p[1] > 0.05) {
      const sh = project(cam, [p[0], 0, p[2]]);
      if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(q.x, q.y - (p[1] <= 0.05 ? r * 0.6 : 0), r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    return q;
  }

  // ---------- map ----------
  // the hole drawn from above, in map units (x, -z); cached per hole
  const content = {};
  function holeContent(id) {
    if (content[id]) return content[id];
    const B = build(id), h = B.h;
    const pts = arr => arr.map(p => `${p[0].toFixed(1)},${(-p[1]).toFixed(1)}`).join(' ');
    let s = '';
    // the playable corridor
    const corridor = [];
    const tot = lineInfo(h.line, 0, 0).total;
    const L = [], Rr = [];
    for (let d = -15; d <= tot + 30; d += 8) { const p = alongLine(h.line, d); L.push([p.x - p.nx * h.ob, p.z - p.nz * h.ob]); Rr.push([p.x + p.nx * h.ob, p.z + p.nz * h.ob]); }
    corridor.push(...L, ...Rr.reverse());
    s += `<polygon points="${pts(corridor)}" fill="${COL.rough}"/>`;
    B.fair.forEach(f => { s += `<polygon points="${pts(f)}" fill="${COL.fair}"/>`; });
    s += `<polygon points="${pts(B.tee)}" fill="${COL.tee}"/>`;
    if (B.targets) B.targets.forEach(t => { s += `<polygon points="${pts(t.pts)}" fill="${COL.green}"/>`; });
    if (B.green) { s += `<polygon points="${pts(B.fringe)}" fill="${COL.fringe}"/><polygon points="${pts(B.green)}" fill="${COL.green}"/>`; }
    B.bunk.forEach(p => { s += `<polygon points="${pts(p)}" fill="${COL.sand}" stroke="${COL.sandEdge}" stroke-width="0.6"/>`; });
    B.water.forEach(p => { s += `<polygon points="${pts(p)}" fill="${COL.water}"/>`; });
    B.trees.forEach(t => { s += `<circle cx="${t.x.toFixed(1)}" cy="${(-t.z).toFixed(1)}" r="${(t.r * 0.8).toFixed(1)}" fill="#2a5530"/>`; });
    return (content[id] = s);
  }
  function mapSvg(id, opts) {
    const B = build(id), h = B.h, o = opts || {};
    const b = B.bounds;
    const pad = 6;
    const vb = [b.minX - pad, -(b.maxZ + pad), b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2];
    let s = `<svg viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of ${h.name}">`;
    s += `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#3a6b34"/>` + holeContent(id);
    if (o.pin) s += `<circle cx="${o.pin[0]}" cy="${-o.pin[1]}" r="2.2" fill="#e8453c" stroke="#fff" stroke-width="0.8"/>`;
    if (o.ball && o.aim) s += `<line x1="${o.ball[0]}" y1="${-o.ball[2]}" x2="${o.aim[0]}" y2="${-o.aim[2]}" stroke="#fff" stroke-width="1" stroke-dasharray="3 3"/>`;
    if (o.ball) s += `<circle cx="${o.ball[0]}" cy="${-o.ball[2]}" r="2.6" fill="#fff" stroke="#111" stroke-width="0.7"/>`;
    s += '</svg>';
    return s;
  }

  // A small plan of this shot, turned so your aim points up: what's beside you
  // that the view down the line can't show.
  function shotMapSvg(id, o) {
    const b = o.ball, th = o.heading, D = Math.max(18, o.D);
    const Hh = D * 1.32 + 16, Ww = Hh * 0.75;
    const vb = [b[0] - Ww / 2, -b[2] - D * 1.17 - 8, Ww, Hh];
    const a = th * Math.PI / 180, end = [b[0] + Math.sin(a) * o.number, b[2] + Math.cos(a) * o.number];
    const u = Hh / 100;
    let s = `<svg viewBox="${vb.map(v => v.toFixed(1)).join(' ')}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">`;
    s += `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#3a6b34"/>`;
    s += `<g transform="rotate(${(-th).toFixed(2)} ${b[0].toFixed(2)} ${(-b[2]).toFixed(2)})">` + holeContent(id);
    s += `<line x1="${b[0]}" y1="${-b[2]}" x2="${end[0].toFixed(2)}" y2="${(-end[1]).toFixed(2)}" stroke="#fff" stroke-width="${(u * 0.9).toFixed(2)}" stroke-dasharray="${(u * 2.5).toFixed(2)} ${(u * 2).toFixed(2)}"/>`;
    s += `<circle cx="${end[0].toFixed(2)}" cy="${(-end[1]).toFixed(2)}" r="${(u * 3).toFixed(2)}" fill="none" stroke="#fff" stroke-width="${(u * 0.8).toFixed(2)}"/>`;
    if (o.pin) s += `<circle cx="${o.pin[0]}" cy="${-o.pin[1]}" r="${(u * 2.4).toFixed(2)}" fill="#e8453c" stroke="#fff" stroke-width="${(u * 0.7).toFixed(2)}"/>`;
    s += `<circle cx="${b[0]}" cy="${-b[2]}" r="${(u * 2.6).toFixed(2)}" fill="#fff" stroke="#111" stroke-width="${(u * 0.6).toFixed(2)}"/>`;
    s += '</g></svg>';
    return s;
  }

  return {
    HOLES, ROUND, V, build, surfaceAt, slopeAt, greenHeight, lineInfo, pointAhead, alongLine, inEll,
    camera, lookCam, blendRig, aimRig, puttRig, watchRig, project, toCam, projC, horizonY, groundLine, fillGround, pathGround,
    drawSky, drawHole, standing, drawBallAt, drawFlag, mapSvg, shotMapSvg, shade, clamp, lerp
  };
})();
