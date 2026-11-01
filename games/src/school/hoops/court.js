/* Court3D: the basketball world in feet, a perspective camera, and everything
   drawn in it (court, hoop, ball, players). Plain canvas 2D, no libraries.
   World axes: x across the court, y up, z out from the baseline. */
const Court3D = (() => {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const V = { add, sub, mul, dot, len, norm, lerp3 };

  const RIM = { x: 0, y: 10, z: 5.25, r: 0.75 };
  const BOARD = { z: 4, x0: -3, x1: 3, y0: 9, y1: 12.5 };
  const BALL_R = 0.39;
  const NEAR = 0.35;

  // Court types are construction choices with consequences: the arc distance,
  // the lane, and how lively the rim is all change what happens on a shot.
  const COURTS = {
    park: {
      id: 'park', name: 'The Park', blurb: 'Outdoor blacktop under the lights. Double rim, so it rattles.',
      three: 19.75, corner: 19.75, cornerZ: 5.25, lane: 12, rimE: 0.66, rimFr: 0.14, rimLabel: 'Double rim',
      floor: '#2a3442', floorFar: '#1b222c', court: '#2c5a46', key: '#7c3a34', line: '#e8ece6', env: 'park'
    },
    gym: {
      id: 'gym', name: 'Hollow Creek Gym', blurb: 'High school hardwood. Soft rim, short three.',
      three: 19.75, corner: 19.75, cornerZ: 5.25, lane: 12, rimE: 0.5, rimFr: 0.24, rimLabel: 'Soft rim',
      floor: '#c99a62', floorFar: '#9c7247', court: null, key: '#1e5b47', line: '#fbf5e8', env: 'gym'
    },
    arena: {
      id: 'arena', name: 'The Arena', blurb: 'Pro dimensions. The three is a long way out.',
      three: 23.75, corner: 22, cornerZ: 14.2, lane: 16, rimE: 0.46, rimFr: 0.28, rimLabel: 'Breakaway rim',
      floor: '#b88652', floorFar: '#7a5534', court: null, key: '#262a35', line: '#ffffff', env: 'arena'
    }
  };

  const SPOTS = {
    lc: { label: 'Left corner', a: -88, three: true },
    lw: { label: 'Left wing', a: -47, three: true },
    top: { label: 'Top of the key', a: 0, three: true },
    rw: { label: 'Right wing', a: 47, three: true },
    rc: { label: 'Right corner', a: 88, three: true },
    le: { label: 'Left elbow', a: -34, d: 15.5 },
    re: { label: 'Right elbow', a: 34, d: 15.5 },
    ft: { label: 'Free throw line', a: 0, d: 13.75 },
    lb: { label: 'Left baseline', a: -76, d: 13 },
    rb: { label: 'Right baseline', a: 76, d: 13 },
    lbk: { label: 'Left block', a: -62, d: 6.5 },
    rbk: { label: 'Right block', a: 62, d: 6.5 },
    lane: { label: 'Middle of the lane', a: 0, d: 8.5 },
    deep: { label: 'Way downtown', a: 0, three: true, extra: 6 }
  };

  function polar(aDeg, d) {
    const a = aDeg * Math.PI / 180;
    return [RIM.x + d * Math.sin(a), 0, RIM.z + d * Math.cos(a)];
  }
  function threeDist(court, aDeg) {
    const a = aDeg * Math.PI / 180;
    if (RIM.z + court.three * Math.cos(a) >= court.cornerZ) return court.three;
    return court.corner / Math.max(0.2, Math.abs(Math.sin(a)));
  }
  function isThree(court, p) {
    if (p[2] <= court.cornerZ) return Math.abs(p[0]) > court.corner;
    return Math.hypot(p[0] - RIM.x, p[2] - RIM.z) > court.three;
  }
  function spotInfo(court, id) {
    const s = SPOTS[id] || SPOTS.top;
    const d = s.three ? threeDist(court, s.a) + 1.3 + (s.extra || 0) : s.d;
    return { id, label: s.label, angle: s.a, dist: d, pos: polar(s.a, d) };
  }
  function polarOf(p) {
    const dx = p[0] - RIM.x, dz = p[2] - RIM.z;
    return { dist: Math.hypot(dx, dz), angle: Math.atan2(dx, dz) * 180 / Math.PI };
  }
  function zoneOf(court, p) {
    const { dist, angle } = polarOf(p);
    if (dist < 7) return 'rim';
    const three = isThree(court, p);
    if (three) {
      if (angle < -70) return 'lc3'; if (angle > 70) return 'rc3';
      if (angle < -22) return 'lw3'; if (angle > 22) return 'rw3';
      return 'top3';
    }
    if (angle < -35) return 'lmid'; if (angle > 35) return 'rmid';
    return 'cmid';
  }
  const ZONES = {
    rim: 'At the rim', lmid: 'Left mid-range', cmid: 'Middle mid-range', rmid: 'Right mid-range',
    lc3: 'Left corner 3', lw3: 'Left wing 3', top3: 'Top 3', rw3: 'Right wing 3', rc3: 'Right corner 3'
  };

  // ---------- camera ----------
  function dirToRim(p) { return norm([RIM.x - p[0], 0, RIM.z - p[2]]); }

  function camera(eye, fwd, W, H, fovY) {
    const f = norm(fwd);
    const r = norm([-f[2], 0, f[0]]);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const focal = (H / 2) / Math.tan(fovY / 2);
    return { eye, f, r, u, focal, W, H, cx: W / 2, cy: H / 2 };
  }
  // First-person framing: eye just behind the shooter, pitched so the rim sits
  // in the upper third and the ball in your hands sits near the bottom.
  function shooterCamera(shooterPos, W, H, opts) {
    const o = opts || {};
    const d = dirToRim(shooterPos);
    const eyeH = o.eyeH || 6.7;
    const back = o.back == null ? 7.5 : o.back;
    const eye = [shooterPos[0] - d[0] * back, eyeH + (o.lift || 0), shooterPos[2] - d[2] * back];
    const aspect = W / H;
    const hfov = 40 * Math.PI / 180;
    let fovY = 2 * Math.atan(Math.tan(hfov / 2) / aspect);
    fovY = Math.max(44 * Math.PI / 180, Math.min(74 * Math.PI / 180, fovY));
    const dist = Math.hypot(RIM.x - eye[0], RIM.z - eye[2]);
    if (dist > 24) fovY *= Math.max(0.74, 1 - (dist - 24) / 55);
    const focal = (H / 2) / Math.tan(fovY / 2);
    const rimAngle = Math.atan2(RIM.y - eye[1], dist);
    const offset = Math.atan((0.5 - (o.rimY || 0.35)) * H / focal);
    const pitch = rimAngle - offset;
    const fwd = [d[0] * Math.cos(pitch), Math.sin(pitch), d[2] * Math.cos(pitch)];
    if (o.roll) {
      // a small sideways lean during drives, applied by nudging the look direction
      const side = [-d[2], 0, d[0]];
      fwd[0] += side[0] * o.roll; fwd[2] += side[2] * o.roll;
    }
    return camera(eye, fwd, W, H, fovY);
  }
  function toCam(cam, p) {
    const v = sub(p, cam.eye);
    return [dot(v, cam.r), dot(v, cam.u), dot(v, cam.f)];
  }
  function projC(cam, c) {
    const z = c[2];
    return { x: cam.cx + cam.focal * c[0] / z, y: cam.cy - cam.focal * c[1] / z, s: cam.focal / z, z };
  }
  function project(cam, p) { const c = toCam(cam, p); return c[2] > NEAR ? projC(cam, c) : null; }

  function clipPoly(cs) {
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length];
      const ain = a[2] > NEAR, bin = b[2] > NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
      }
    }
    return out;
  }
  function pathPoly(ctx, cam, pts) {
    const cs = clipPoly(pts.map(p => toCam(cam, p)));
    if (cs.length < 3) return false;
    ctx.beginPath();
    cs.forEach((c, i) => { const q = projC(cam, c); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath();
    return true;
  }
  function fillPoly(ctx, cam, pts, fill) { if (pathPoly(ctx, cam, pts)) { ctx.fillStyle = fill; ctx.fill(); } }
  // Lines clip a little further out than polygons, and never get fatter than a
  // stripe of paint would look, so a line passing under the camera stays a line.
  const NEAR_LINE = 2;
  function seg(ctx, cam, a, b, widthFt, minW) {
    let ca = toCam(cam, a), cb = toCam(cam, b);
    if (ca[2] <= NEAR_LINE && cb[2] <= NEAR_LINE) return;
    if (ca[2] <= NEAR_LINE) { const t = (NEAR_LINE - ca[2]) / (cb[2] - ca[2]); ca = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, NEAR_LINE]; }
    if (cb[2] <= NEAR_LINE) { const t = (NEAR_LINE - cb[2]) / (ca[2] - cb[2]); cb = [cb[0] + (ca[0] - cb[0]) * t, cb[1] + (ca[1] - cb[1]) * t, NEAR_LINE]; }
    const pa = projC(cam, ca), pb = projC(cam, cb);
    ctx.lineWidth = Math.min(16, Math.max(minW || 1, widthFt * (pa.s + pb.s) / 2));
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  function strokePath(ctx, cam, pts, widthFt, minW) {
    for (let i = 0; i < pts.length - 1; i++) seg(ctx, cam, pts[i], pts[i + 1], widthFt, minW);
  }

  // ---------- court geometry ----------
  function arcPts(cx, cz, r, a0, a1, n, y) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      pts.push([cx + r * Math.sin(a), y || 0, cz + r * Math.cos(a)]);
    }
    return pts;
  }
  function courtLines(court) {
    const L = [];
    const hw = court.lane / 2;
    L.push([[-25, 0, 0], [25, 0, 0]]);
    L.push([[-25, 0, 0], [-25, 0, 47]]);
    L.push([[25, 0, 0], [25, 0, 47]]);
    L.push([[-25, 0, 47], [25, 0, 47]]);
    L.push([[-hw, 0, 0], [-hw, 0, 19], [hw, 0, 19], [hw, 0, 0]]);
    L.push(arcPts(0, 19, 6, -Math.PI / 2, Math.PI / 2, 18));
    L.push(arcPts(0, 47, 6, Math.PI / 2, 3 * Math.PI / 2, 18));
    L.push(arcPts(RIM.x, RIM.z, 4, -Math.PI / 2, Math.PI / 2, 12));
    const c = court.corner;
    const zc = court.cornerZ;
    const aEdge = Math.asin(Math.min(1, c / court.three));
    let a0 = aEdge;
    if (zc > RIM.z) a0 = Math.atan2(c, zc - RIM.z);
    L.push([[-c, 0, 0], [-c, 0, zc]]);
    L.push([[c, 0, 0], [c, 0, zc]]);
    L.push(arcPts(RIM.x, RIM.z, court.three, -a0, a0, 40));
    // little hash marks along the lane
    [7, 8, 11, 14].forEach(z => { L.push([[-hw, 0, z], [-hw - 0.7, 0, z]]); L.push([[hw, 0, z], [hw + 0.7, 0, z]]); });
    return L;
  }
  function threeRegion(court) {
    const c = court.corner, zc = court.cornerZ;
    let a0 = Math.asin(Math.min(1, c / court.three));
    if (zc > RIM.z) a0 = Math.atan2(c, zc - RIM.z);
    return [[-c, 0, 0], [-c, 0, zc]].concat(arcPts(RIM.x, RIM.z, court.three, -a0, a0, 40)).concat([[c, 0, zc], [c, 0, 0]]);
  }

  // ---------- environment ----------
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const skyline = (() => {
    const r = rng(7), out = [];
    let a = 0;
    while (a < Math.PI * 2) {
      const w = 0.04 + r() * 0.09;
      out.push({ a: a + w / 2, w, h: 0.03 + r() * 0.13 + (r() < 0.12 ? 0.1 : 0), lit: r(), seed: Math.floor(r() * 1e6) });
      a += w + r() * 0.012;
    }
    return out;
  })();
  const crowd = (() => {
    const r = rng(11), out = [];
    for (let i = 0; i < 900; i++) out.push({ x: -40 + r() * 80, y: 3 + r() * 22, c: r() });
    return out;
  })();
  const stars = (() => { const r = rng(5), out = []; for (let i = 0; i < 90; i++) out.push({ a: r() * Math.PI * 2, e: 0.08 + r() * 0.6, b: r() }); return out; })();

  function horizonY(cam) {
    const fh = norm([cam.f[0], 0, cam.f[2]]);
    const p = project(cam, add(cam.eye, mul(fh, 2000)));
    return p ? p.y : cam.H * 0.3;
  }
  function farPoint(cam, ang, elev) {
    const d = [Math.sin(ang) * Math.cos(elev), Math.sin(elev), Math.cos(ang) * Math.cos(elev)];
    return project(cam, add(cam.eye, mul(d, 2000)));
  }

  function drawPark(ctx, cam, t) {
    const hy = horizonY(cam);
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(10, hy));
    g.addColorStop(0, '#070b16'); g.addColorStop(0.6, '#141a33'); g.addColorStop(1, '#3b2c4a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cam.W, Math.max(0, hy) + 2);
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => {
      const p = farPoint(cam, s.a, s.e);
      if (!p || p.y > hy) return;
      ctx.globalAlpha = 0.25 + 0.5 * s.b * (0.7 + 0.3 * Math.sin(t * 1.3 + s.a * 10));
      ctx.fillRect(p.x, p.y, 1.5, 1.5);
    });
    ctx.globalAlpha = 1;
    skyline.forEach(b => {
      const p0 = farPoint(cam, b.a - b.w / 2, 0), p1 = farPoint(cam, b.a + b.w / 2, 0), pt = farPoint(cam, b.a, b.h);
      if (!p0 || !p1 || !pt) return;
      const x0 = Math.min(p0.x, p1.x), x1 = Math.max(p0.x, p1.x);
      if (x1 < 0 || x0 > cam.W || x1 - x0 > cam.W) return;
      const top = pt.y;
      ctx.fillStyle = '#0d1120';
      ctx.fillRect(x0, top, x1 - x0, hy - top + 1);
      const r = rng(b.seed);
      const cols = Math.max(2, Math.floor((x1 - x0) / 7)), rows = Math.max(2, Math.floor((hy - top) / 9));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (r() < 0.22 + b.lit * 0.2) {
          ctx.fillStyle = r() < 0.7 ? 'rgba(255,205,120,0.55)' : 'rgba(170,200,255,0.45)';
          ctx.fillRect(x0 + 2 + i * (x1 - x0 - 4) / cols, top + 3 + j * (hy - top - 4) / rows, 2.2, 2.6);
        }
      }
    });
  }

  function drawFence(ctx, cam) {
    // chain-link fence around the court, rendered as a soft mesh band
    const H = 12;
    const runs = [
      [[-31, 0, -6], [31, 0, -6]], [[-31, 0, -6], [-31, 0, 52]], [[31, 0, -6], [31, 0, 52]]
    ];
    runs.forEach(([a, b]) => {
      fillPoly(ctx, cam, [a, b, [b[0], H, b[2]], [a[0], H, a[2]]], 'rgba(120,140,160,0.09)');
      ctx.strokeStyle = 'rgba(150,170,190,0.16)';
      const n = Math.round(len(sub(b, a)) / 1.4);
      for (let i = 0; i <= n; i++) {
        const p = lerp3(a, b, i / n), q = lerp3(a, b, Math.min(1, (i + 6) / n));
        seg(ctx, cam, p, [q[0], H, q[2]], 0.03, 0.5);
        const q2 = lerp3(a, b, Math.max(0, (i - 6) / n));
        seg(ctx, cam, p, [q2[0], H, q2[2]], 0.03, 0.5);
      }
      ctx.strokeStyle = 'rgba(170,185,200,0.45)';
      seg(ctx, cam, [a[0], H, a[2]], [b[0], H, b[2]], 0.12, 1);
    });
    // light poles
    [[-30, -5], [30, -5]].forEach(([x, z]) => {
      ctx.strokeStyle = '#2b3240';
      seg(ctx, cam, [x, 0, z], [x, 24, z], 0.5, 2);
      const p = project(cam, [x, 24, z]);
      if (p) {
        const r = Math.min(26, Math.max(6, p.s * 2.2));
        const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
        gl.addColorStop(0, 'rgba(255,236,190,0.9)'); gl.addColorStop(0.15, 'rgba(255,220,160,0.35)'); gl.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function drawRoom(ctx, cam, court, t) {
    const X = 34, Z0 = -9, Z1 = 64, HT = court.env === 'arena' ? 46 : 30;
    const dark = court.env === 'arena';
    fillPoly(ctx, cam, [[-X, HT, Z0], [X, HT, Z0], [X, HT, Z1], [-X, HT, Z1]], dark ? '#07080c' : '#2d3036');
    fillPoly(ctx, cam, [[-X, 0, Z0], [X, 0, Z0], [X, HT, Z0], [-X, HT, Z0]], dark ? '#0d0f15' : '#d7d2c4');
    fillPoly(ctx, cam, [[-X, 0, Z0], [-X, 0, Z1], [-X, HT, Z1], [-X, HT, Z0]], dark ? '#0b0d12' : '#cfc9ba');
    fillPoly(ctx, cam, [[X, 0, Z0], [X, 0, Z1], [X, HT, Z1], [X, HT, Z0]], dark ? '#0b0d12' : '#cfc9ba');
    if (!dark) {
      // painted wainscot and bleachers
      fillPoly(ctx, cam, [[-X, 0, Z0], [X, 0, Z0], [X, 7, Z0], [-X, 7, Z0]], '#1e5b47');
      [-1, 1].forEach(sd => {
        for (let i = 0; i < 7; i++) {
          const y = 1 + i * 1.6, xo = sd * (X - 0.01);
          fillPoly(ctx, cam, [[xo, y, 2], [xo, y, 58], [xo, y + 0.7, 58], [xo, y + 0.7, 2]], i % 2 ? '#a9a395' : '#8f8a7e');
        }
      });
      // championship banners on the back wall
      const banners = ['#1e5b47', '#e3b23c', '#1e5b47', '#f4efe3', '#1e5b47'];
      banners.forEach((c, i) => {
        const x = -20 + i * 10;
        fillPoly(ctx, cam, [[x - 3, 22, Z0 + 0.05], [x + 3, 22, Z0 + 0.05], [x + 3, 15, Z0 + 0.05], [x, 13.5, Z0 + 0.05], [x - 3, 15, Z0 + 0.05]], c);
      });
      // ceiling lights
      for (let i = -2; i <= 2; i++) for (let j = 0; j < 4; j++) {
        fillPoly(ctx, cam, [[i * 12 - 2, HT - 0.1, j * 14], [i * 12 + 2, HT - 0.1, j * 14], [i * 12 + 2, HT - 0.1, j * 14 + 3], [i * 12 - 2, HT - 0.1, j * 14 + 3]], 'rgba(255,250,230,0.9)');
      }
    } else {
      // crowd in the dark
      crowd.forEach(c => {
        const p = project(cam, [c.x, c.y, Z0 + 0.1]);
        if (!p || p.x < -5 || p.x > cam.W + 5) return;
        const flash = Math.sin(t * 2 + c.x) > 0.995;
        ctx.fillStyle = flash ? 'rgba(255,255,255,0.9)' : `hsla(${(c.c * 360) | 0},30%,${25 + c.c * 30}%,0.8)`;
        ctx.fillRect(p.x, p.y, Math.max(1, p.s * 0.6), Math.max(1, p.s * 0.6));
      });
      [-1, 1].forEach(sd => crowd.forEach((c, i) => {
        if (i % 2) return;
        const p = project(cam, [sd * (X - 0.1), c.y * 0.9, 4 + (c.x + 40) * 0.7]);
        if (!p) return;
        ctx.fillStyle = `hsla(${(c.c * 360) | 0},25%,${20 + c.c * 25}%,0.7)`;
        ctx.fillRect(p.x, p.y, Math.max(1, p.s * 0.6), Math.max(1, p.s * 0.6));
      }));
      const p = project(cam, [0, 30, Z0]);
      if (p) {
        const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, cam.H * 0.6);
        gl.addColorStop(0, 'rgba(120,150,255,0.10)'); gl.addColorStop(1, 'rgba(120,150,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(0, 0, cam.W, cam.H);
      }
    }
  }

  function drawFloor(ctx, cam, court) {
    const hy = horizonY(cam);
    fillPoly(ctx, cam, [[-60, 0, -12], [60, 0, -12], [60, 0, 90], [-60, 0, 90]], court.floorFar);
    const g = ctx.createLinearGradient(0, hy, 0, cam.H);
    g.addColorStop(0, court.floorFar); g.addColorStop(1, court.floor);
    if (court.env === 'park') {
      fillPoly(ctx, cam, [[-31, 0, -6], [31, 0, -6], [31, 0, 52], [-31, 0, 52]], g);
      if (court.court) fillPoly(ctx, cam, [[-25, 0, 0], [25, 0, 0], [25, 0, 47], [-25, 0, 47]], court.court);
    } else {
      fillPoly(ctx, cam, [[-34, 0, -9], [34, 0, -9], [34, 0, 64], [-34, 0, 64]], g);
      // hardwood boards
      ctx.strokeStyle = 'rgba(80,45,15,0.13)';
      for (let x = -24; x <= 24; x += 1.5) seg(ctx, cam, [x, 0, 0], [x, 0, 47], 0.02, 0.5);
    }
    // three-point region tint and the key
    const tr = threeRegion(court);
    fillPoly(ctx, cam, tr, court.env === 'park' ? 'rgba(255,255,255,0.03)' : 'rgba(255,240,210,0.08)');
    const hw = court.lane / 2;
    fillPoly(ctx, cam, [[-hw, 0, 0], [hw, 0, 0], [hw, 0, 19], [-hw, 0, 19]], court.key);
    if (court.env !== 'park') {
      const c = project(cam, [0, 0, 47]);
      if (c) {
        ctx.save(); ctx.globalAlpha = 0.5;
        fillPoly(ctx, cam, arcPts(0, 47, 6, 0, Math.PI * 2, 24), court.key);
        ctx.restore();
      }
    }
    ctx.strokeStyle = court.line;
    ctx.lineCap = 'round';
    courtLines(court).forEach(pl => strokePath(ctx, cam, pl, 0.17, 1));
    // light pool around the hoop
    const p = project(cam, [0, 0, 9]);
    if (p) {
      const r = Math.max(cam.W, p.s * 30);
      const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      const warm = court.env === 'park' ? 'rgba(255,214,150,' : 'rgba(255,250,235,';
      gl.addColorStop(0, warm + '0.16)'); gl.addColorStop(1, warm + '0)');
      ctx.fillStyle = gl; ctx.fillRect(0, hy, cam.W, cam.H - hy);
    }
  }

  // ---------- hoop ----------
  function rimPoints(n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      pts.push([RIM.x + RIM.r * Math.sin(a), RIM.y, RIM.z + RIM.r * Math.cos(a)]);
    }
    return pts;
  }
  const RIM_PTS = rimPoints(28);

  function drawSupport(ctx, cam, court) {
    ctx.lineCap = 'round';
    if (court.env === 'park') {
      ctx.strokeStyle = '#3c4656';
      seg(ctx, cam, [0, 0, -2.2], [0, 11.6, -2.2], 0.5, 2);
      seg(ctx, cam, [0, 11.2, -2.2], [0, 11, 4], 0.32, 2);
      seg(ctx, cam, [0, 9.8, -2.2], [0, 10.6, 4], 0.22, 1.5);
    } else if (court.env === 'gym') {
      ctx.strokeStyle = '#4a4f58';
      seg(ctx, cam, [0, 30, 1], [0, 12.6, 3.6], 0.25, 1.5);
      seg(ctx, cam, [-2, 30, 3], [0, 12.6, 3.8], 0.15, 1);
      seg(ctx, cam, [2, 30, 3], [0, 12.6, 3.8], 0.15, 1);
    } else {
      fillPoly(ctx, cam, [[-2, 0, -6], [2, 0, -6], [2, 4, -6], [-2, 4, -6]], '#1d2230');
      fillPoly(ctx, cam, [[-2, 4, -6], [2, 4, -6], [2, 4, -2], [-2, 4, -2]], '#262c3d');
      ctx.strokeStyle = '#2b3245';
      seg(ctx, cam, [0, 4, -4], [0, 12, 1], 0.6, 2);
      seg(ctx, cam, [0, 12, 1], [0, 11.5, 4], 0.4, 2);
    }
  }
  function drawBoard(ctx, cam, court) {
    const z = BOARD.z;
    const glass = court.env === 'park' ? 'rgba(235,240,245,0.92)' : 'rgba(220,235,255,0.22)';
    fillPoly(ctx, cam, [[BOARD.x0, BOARD.y0, z], [BOARD.x1, BOARD.y0, z], [BOARD.x1, BOARD.y1, z], [BOARD.x0, BOARD.y1, z]], glass);
    ctx.strokeStyle = court.env === 'park' ? '#c9d0d8' : '#ffffff';
    ctx.lineCap = 'butt';
    strokePath(ctx, cam, [[BOARD.x0, BOARD.y0, z], [BOARD.x1, BOARD.y0, z], [BOARD.x1, BOARD.y1, z], [BOARD.x0, BOARD.y1, z], [BOARD.x0, BOARD.y0, z]], 0.16, 1.5);
    ctx.strokeStyle = court.env === 'park' ? '#d2492e' : '#ffffff';
    strokePath(ctx, cam, [[-1, 10, z], [1, 10, z], [1, 11.5, z], [-1, 11.5, z], [-1, 10, z]], 0.13, 1.2);
    if (court.env !== 'park') fillPoly(ctx, cam, [[BOARD.x0, BOARD.y0 - 0.25, z], [BOARD.x1, BOARD.y0 - 0.25, z], [BOARD.x1, BOARD.y0, z], [BOARD.x0, BOARD.y0, z]], '#1e5b47');
    // rim bracket
    ctx.strokeStyle = '#b8461f';
    seg(ctx, cam, [0, 9.9, z], [0, 10, RIM.z - RIM.r], 0.12, 1.5);
  }

  function netPoints(net) {
    const top = [], bot = [], mid = [];
    const n = 12;
    const sway = net ? net.sway : 0, pull = net ? net.pull : 0, sx = net ? net.sx : 0, sz = net ? net.sz : 0;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      top.push([RIM.x + RIM.r * Math.sin(a), RIM.y, RIM.z + RIM.r * Math.cos(a)]);
      const b = a + 0.26;
      const r2 = 0.42 + pull * 0.08;
      bot.push([RIM.x + r2 * Math.sin(b) + sx * sway, RIM.y - 1.55 - pull * 0.55, RIM.z + r2 * Math.cos(b) + sz * sway]);
      const m = a + 0.13;
      const r1 = 0.6 + pull * 0.04;
      mid.push([RIM.x + r1 * Math.sin(m) + sx * sway * 0.5, RIM.y - 0.8 - pull * 0.25, RIM.z + r1 * Math.cos(m) + sz * sway * 0.5]);
    }
    return { top, mid, bot, n };
  }
  // part: 'back' or 'front' relative to the camera
  function drawNetAndRim(ctx, cam, part, net, court) {
    const center = toCam(cam, [RIM.x, RIM.y, RIM.z])[2];
    const isBack = p => toCam(cam, p)[2] >= center;
    const np = netPoints(net);
    ctx.strokeStyle = court && court.env === 'park' ? 'rgba(200,205,210,0.85)' : 'rgba(255,255,255,0.88)';
    ctx.lineCap = 'round';
    for (let i = 0; i < np.n; i++) {
      const j = (i + 1) % np.n;
      const pairs = [[np.top[i], np.mid[i]], [np.mid[i], np.bot[i]], [np.top[j], np.mid[i]], [np.mid[i], np.bot[j]]];
      pairs.forEach(([a, b]) => {
        const back = isBack(lerp3(a, b, 0.5));
        if ((part === 'back') === back) seg(ctx, cam, a, b, 0.035, 0.8);
      });
    }
    ctx.strokeStyle = '#e2581f';
    for (let i = 0; i < RIM_PTS.length; i++) {
      const a = RIM_PTS[i], b = RIM_PTS[(i + 1) % RIM_PTS.length];
      const back = isBack(lerp3(a, b, 0.5));
      if ((part === 'back') === back) seg(ctx, cam, a, b, 0.09, 2);
    }
  }

  // ---------- ball ----------
  function drawBall(ctx, cam, b) {
    const c = toCam(cam, b.p);
    if (c[2] <= NEAR + 0.2) return;
    const q = projC(cam, c);
    const r = BALL_R * q.s * (b.scale || 1);
    if (r < 0.6) return;
    ctx.save();
    ctx.globalAlpha = b.alpha == null ? 1 : b.alpha;
    const g = ctx.createRadialGradient(q.x - r * 0.35, q.y - r * 0.4, r * 0.1, q.x, q.y, r);
    if (b.money) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#e8eef9'); g.addColorStop(1, '#2a4fb0'); }
    else { g.addColorStop(0, '#f6a35c'); g.addColorStop(0.55, '#e0661f'); g.addColorStop(1, '#8f3509'); }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    if (r > 2.5) {
      ctx.translate(q.x, q.y); ctx.rotate(b.rot || 0);
      ctx.strokeStyle = b.money ? 'rgba(200,30,40,0.85)' : 'rgba(40,15,5,0.75)';
      ctx.lineWidth = Math.max(0.8, r * 0.07);
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    }
    ctx.restore();
  }
  function drawShadow(ctx, cam, p, height) {
    const c = toCam(cam, [p[0], 0.01, p[2]]);
    if (c[2] <= NEAR + 0.2) return;
    const q = projC(cam, c);
    const r = BALL_R * q.s * (1 + height * 0.04);
    const a = Math.max(0, 0.38 - height * 0.025);
    if (a <= 0.01) return;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- players ----------
  const POSES = {
    stand: { head: [0, 6.0, 0], neck: [0, 5.45, 0], lsh: [-0.78, 5.2, 0], rsh: [0.78, 5.2, 0], lel: [-1.0, 4.1, 0.1], rel: [1.0, 4.1, 0.1], lha: [-1.05, 3.15, 0.35], rha: [1.05, 3.15, 0.35], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.5, 1.8, 0.15], rkn: [0.5, 1.8, 0.15], lft: [-0.55, 0.12, 0.2], rft: [0.55, 0.12, 0.2] },
    guard: { head: [0, 5.45, 0.4], neck: [0, 4.95, 0.3], lsh: [-0.82, 4.72, 0.22], rsh: [0.82, 4.72, 0.22], lel: [-1.65, 4.15, 0.65], rel: [1.65, 4.15, 0.65], lha: [-2.3, 3.6, 1.05], rha: [2.3, 3.6, 1.05], lhip: [-0.46, 2.85, -0.2], rhip: [0.46, 2.85, -0.2], lkn: [-1.0, 1.5, 0.45], rkn: [1.0, 1.5, 0.45], lft: [-1.3, 0.12, 0.1], rft: [1.3, 0.12, 0.1] },
    sag: { head: [0, 5.6, 0.3], neck: [0, 5.1, 0.2], lsh: [-0.8, 4.85, 0.15], rsh: [0.8, 4.85, 0.15], lel: [-1.35, 3.9, 0.45], rel: [1.35, 3.9, 0.45], lha: [-1.7, 3.0, 0.75], rha: [1.7, 3.0, 0.75], lhip: [-0.45, 3.0, -0.15], rhip: [0.45, 3.0, -0.15], lkn: [-0.85, 1.6, 0.35], rkn: [0.85, 1.6, 0.35], lft: [-1.1, 0.12, 0.05], rft: [1.1, 0.12, 0.05] },
    contest: { head: [0, 5.75, 0.25], neck: [0, 5.2, 0.15], lsh: [-0.78, 5.0, 0.15], rsh: [0.78, 5.0, 0.15], lel: [-0.75, 6.4, 0.45], rel: [1.55, 4.5, 0.6], lha: [-0.55, 7.8, 0.85], rha: [2.1, 4.1, 1.0], lhip: [-0.44, 3.1, -0.1], rhip: [0.44, 3.1, -0.1], lkn: [-0.8, 1.65, 0.35], rkn: [0.8, 1.65, 0.35], lft: [-1.05, 0.12, 0.1], rft: [1.05, 0.12, 0.1] },
    wall: { head: [0, 5.9, 0.2], neck: [0, 5.35, 0.1], lsh: [-0.75, 5.15, 0.1], rsh: [0.75, 5.15, 0.1], lel: [-0.8, 6.6, 0.35], rel: [0.8, 6.6, 0.35], lha: [-0.6, 8.05, 0.65], rha: [0.6, 8.05, 0.65], lhip: [-0.42, 3.3, 0], rhip: [0.42, 3.3, 0], lkn: [-0.6, 1.75, 0.25], rkn: [0.6, 1.75, 0.25], lft: [-0.75, 0.12, 0.15], rft: [0.75, 0.12, 0.15] },
    air: { head: [0, 6.1, 0.4], neck: [0, 5.55, 0.3], lsh: [-0.75, 5.3, 0.3], rsh: [0.75, 5.3, 0.3], lel: [-0.75, 6.8, 0.6], rel: [0.75, 6.8, 0.6], lha: [-0.55, 8.2, 1.0], rha: [0.55, 8.2, 1.0], lhip: [-0.42, 3.4, 0.1], rhip: [0.42, 3.4, 0.1], lkn: [-0.55, 2.2, 0.7], rkn: [0.55, 2.1, 0.75], lft: [-0.55, 0.9, 0.2], rft: [0.55, 0.85, 0.25] },
    run1: { head: [0, 5.9, 0.5], neck: [0, 5.35, 0.4], lsh: [-0.75, 5.1, 0.35], rsh: [0.75, 5.1, 0.35], lel: [-0.9, 4.3, 1.0], rel: [0.95, 4.2, -0.4], lha: [-0.8, 4.9, 1.6], rha: [0.95, 3.4, -0.7], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.48, 2.2, 1.1], rkn: [0.48, 1.6, -0.6], lft: [-0.5, 0.9, 0.7], rft: [0.5, 0.2, -1.1] },
    run2: { head: [0, 5.9, 0.5], neck: [0, 5.35, 0.4], lsh: [-0.75, 5.1, 0.35], rsh: [0.75, 5.1, 0.35], lel: [-0.95, 4.2, -0.4], rel: [0.9, 4.3, 1.0], lha: [-0.95, 3.4, -0.7], rha: [0.8, 4.9, 1.6], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.48, 1.6, -0.6], rkn: [0.48, 2.2, 1.1], lft: [-0.5, 0.2, -1.1], rft: [0.5, 0.9, 0.7] },
    shoot: { head: [0, 6.05, 0], neck: [0, 5.5, 0], lsh: [-0.75, 5.25, 0], rsh: [0.75, 5.25, 0], lel: [-0.55, 6.5, 0.3], rel: [0.6, 6.6, 0.4], lha: [-0.3, 7.7, 0.4], rha: [0.15, 8.0, 0.6], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.45, 1.8, 0.1], rkn: [0.45, 1.8, 0.1], lft: [-0.5, 0.12, 0.15], rft: [0.5, 0.12, 0.15] },
    celebrate: { head: [0, 6.05, 0], neck: [0, 5.5, 0], lsh: [-0.75, 5.25, 0], rsh: [0.75, 5.25, 0], lel: [-1.3, 6.3, 0], rel: [1.3, 6.3, 0], lha: [-1.6, 7.6, 0], rha: [1.6, 7.6, 0], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.5, 1.8, 0.1], rkn: [0.5, 1.8, 0.1], lft: [-0.55, 0.12, 0.15], rft: [0.55, 0.12, 0.15] }
  };
  const JOINTS = Object.keys(POSES.stand);

  function blendPose(cur, target, k) {
    const out = {};
    JOINTS.forEach(j => {
      const a = cur[j] || target[j], b = target[j];
      out[j] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    });
    return out;
  }
  function mixPoses(a, b, t) { return blendPose(a, b, t); }

  // fig: { pos, face (unit xz dir he faces), pose, lift, scale, reach, colors, number, alpha, lean }
  function drawFigure(ctx, cam, fig) {
    const f = norm([fig.face[0], 0, fig.face[2]]);
    const s = [f[2], 0, -f[0]];
    const sc = fig.scale || 1, reach = fig.reach || 1;
    const W = {};
    JOINTS.forEach(j => {
      const l = fig.pose[j];
      let lx = l[0] * sc, ly = l[1] * sc, lz = l[2] * sc;
      if (j === 'lel' || j === 'rel' || j === 'lha' || j === 'rha') {
        const sh = fig.pose[j[0] + 'sh'];
        lx = (sh[0] + (l[0] - sh[0]) * reach) * sc; ly = (sh[1] + (l[1] - sh[1]) * reach) * sc; lz = (sh[2] + (l[2] - sh[2]) * reach) * sc;
      }
      if (fig.lean) lx += fig.lean * (ly / 6);
      if (fig.fwdLean) lz += fig.fwdLean * (ly / 6);
      W[j] = [fig.pos[0] + s[0] * lx + f[0] * lz, ly + (fig.lift || 0), fig.pos[2] + s[2] * lx + f[2] * lz];
    });
    const P = {};
    for (const j of JOINTS) { const c = toCam(cam, W[j]); if (c[2] <= NEAR + 0.3) return; P[j] = projC(cam, c); }
    const col = fig.colors;
    ctx.save();
    ctx.globalAlpha = fig.alpha == null ? 1 : fig.alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const limb = (a, b, w, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, w * (P[a].s + P[b].s) / 2);
      ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke();
    };
    // shadow
    const sh = project(cam, [fig.pos[0], 0.01, fig.pos[2]]);
    if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, sh.s * 1.6, sh.s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
    // legs
    limb('lhip', 'lkn', 0.46, col.skin); limb('lkn', 'lft', 0.36, col.skin);
    limb('rhip', 'rkn', 0.46, col.skin); limb('rkn', 'rft', 0.36, col.skin);
    ['lft', 'rft'].forEach(ft => { ctx.fillStyle = col.shoes; ctx.beginPath(); ctx.ellipse(P[ft].x, P[ft].y, P[ft].s * 0.32, P[ft].s * 0.18, 0, 0, Math.PI * 2); ctx.fill(); });
    // shorts
    const mid = (a, b, t) => ({ x: P[a].x + (P[b].x - P[a].x) * t, y: P[a].y + (P[b].y - P[a].y) * t });
    const lk = mid('lhip', 'lkn', 0.5), rk = mid('rhip', 'rkn', 0.5);
    ctx.fillStyle = col.shorts;
    ctx.beginPath();
    const hw = P.lhip.s * 0.22;
    ctx.moveTo(P.lhip.x - hw, P.lhip.y); ctx.lineTo(P.rhip.x + hw, P.rhip.y); ctx.lineTo(rk.x + hw, rk.y); ctx.lineTo((P.lhip.x + P.rhip.x) / 2, (P.lhip.y + P.rhip.y) / 2 + P.lhip.s * 0.5); ctx.lineTo(lk.x - hw, lk.y);
    ctx.closePath(); ctx.fill();
    // torso
    ctx.fillStyle = col.jersey;
    ctx.beginPath();
    const tw = P.lsh.s * 0.12;
    ctx.moveTo(P.lsh.x - tw, P.lsh.y); ctx.lineTo(P.rsh.x + tw, P.rsh.y); ctx.lineTo(P.rhip.x + hw, P.rhip.y); ctx.lineTo(P.lhip.x - hw, P.lhip.y);
    ctx.closePath(); ctx.fill();
    if (fig.number != null && P.lsh.s > 6) {
      ctx.fillStyle = col.trim || '#fff';
      ctx.font = `700 ${Math.round(P.lsh.s * 0.75)}px "Big Shoulders Display", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(fig.number), (P.lsh.x + P.rsh.x + P.lhip.x + P.rhip.x) / 4, (P.lsh.y + P.rsh.y) / 2 * 0.55 + (P.lhip.y + P.rhip.y) / 2 * 0.45);
    }
    // arms
    limb('lsh', 'lel', 0.3, col.skin); limb('lel', 'lha', 0.25, col.skin);
    limb('rsh', 'rel', 0.3, col.skin); limb('rel', 'rha', 0.25, col.skin);
    ctx.fillStyle = col.jersey;
    ['lsh', 'rsh'].forEach(j => { ctx.beginPath(); ctx.arc(P[j].x, P[j].y, P[j].s * 0.22, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = col.skin;
    ['lha', 'rha'].forEach(j => { ctx.beginPath(); ctx.arc(P[j].x, P[j].y, P[j].s * 0.17, 0, Math.PI * 2); ctx.fill(); });
    // neck and head
    limb('neck', 'head', 0.28, col.skin);
    const hr = P.head.s * 0.42 * sc;
    ctx.fillStyle = col.skin; ctx.beginPath(); ctx.arc(P.head.x, P.head.y, hr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.hair;
    ctx.beginPath(); ctx.arc(P.head.x, P.head.y - hr * 0.1, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    if (fig.band) { ctx.fillStyle = fig.band; ctx.fillRect(P.head.x - hr, P.head.y - hr * 0.42, hr * 2, hr * 0.26); }
    if (hr > 5 && !fig.back) {
      ctx.fillStyle = 'rgba(20,12,8,0.85)';
      const ey = P.head.y - hr * 0.05;
      ctx.beginPath(); ctx.arc(P.head.x - hr * 0.33, ey, hr * 0.09, 0, Math.PI * 2); ctx.arc(P.head.x + hr * 0.33, ey, hr * 0.09, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return P;
  }

  return {
    V, RIM, BOARD, BALL_R, COURTS, SPOTS, ZONES, POSES,
    polar, polarOf, threeDist, isThree, spotInfo, zoneOf, dirToRim,
    camera, shooterCamera, toCam, project, projC,
    drawPark, drawFence, drawRoom, drawFloor, drawSupport, drawBoard, drawNetAndRim,
    drawBall, drawShadow, drawFigure, blendPose, mixPoses, fillPoly, seg, horizonY
  };
})();
