/* Engine 3 · World: a minor league ballpark at night, drawn in perspective on
   a plain canvas. The same projection the basketball court uses: a camera,
   near-plane clipping, and polygons on the ground. Two cameras: one behind
   the plate for the pitch, one that follows the ball once it's in play. */
const Park3D = (() => {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const V = { add, sub, mul, dot, len, norm, lerp3 };
  const NEAR = 0.4;
  const DEG = Math.PI / 180;

  const C = {
    sky0: '#03060d', sky1: '#0a1324', sky2: '#1b2944', glow: 'rgba(255,236,190,0.16)',
    stands: '#1d2537', standsHi: '#252f45', wall: '#173a29', wallTop: '#f2c94c', pad: '#1d4532',
    grass: '#2d6a39', grass2: '#337741', foul: '#2a6235', dirt: '#a7663d', dirt2: '#94582f', track: '#7a4f33',
    chalk: '#f3f1ea', pole: '#f2c94c', eye: '#0c1712'
  };

  function camera(eye, look, W, H, fovY) {
    const f = norm(sub(look, eye));
    const r = norm([f[2], 0, -f[0]]);
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    const focal = (H / 2) / Math.tan(fovY / 2);
    return { eye, f, r, u, focal, W, H, cx: W / 2, cy: H / 2 };
  }
  function toCam(cam, p) { const v = sub(p, cam.eye); return [dot(v, cam.r), dot(v, cam.u), dot(v, cam.f)]; }
  function projC(cam, c) { return { x: cam.cx + cam.focal * c[0] / c[2], y: cam.cy - cam.focal * c[1] / c[2], s: cam.focal / c[2], z: c[2] }; }
  function project(cam, p) { const c = toCam(cam, p); return c[2] > NEAR ? projC(cam, c) : null; }

  /* Behind the plate, up a little and over the batter's shoulder: him at the
     left, the pitcher in the upper third, the zone just below the middle, the
     horizon high so the field fills the screen. Wide screens get a wider view. */
  function batterCam(W, H, bats, opt) {
    const o = opt || {};
    const side = bats === 'L' ? 1 : -1;
    const eye = [side * 1.4 + (o.dx || 0), 6.0 + (o.dy || 0), -13];
    const look = [-side * 0.8, 6.0 - Math.tan(8 * DEG) * 60, 47];
    // fit the zone to the screen: about a quarter of the width on a phone
    const aspect = W / H;
    const hfov = 20 * DEG;
    let fovY = 2 * Math.atan(Math.tan(hfov / 2) / aspect);
    fovY = Math.max(14 * DEG, Math.min(44 * DEG, fovY));
    return camera(eye, look, W, H, fovY);
  }
  // Following the ball: behind and above it, looking out the way it's going.
  function followCam(W, H, focus, k) {
    const d = Math.hypot(focus[0], focus[2]) || 1;
    const dir = [focus[0] / d, 0, focus[2] / d];
    const back = 70 + 40 * (k || 0), up = 46 + 30 * (k || 0) + focus[1] * 0.35;
    const eye = [focus[0] - dir[0] * back, up, focus[2] - dir[2] * back];
    const look = [focus[0] + dir[0] * 25, Math.max(0, focus[1] * 0.6), focus[2] + dir[2] * 25];
    const aspect = W / H;
    let fovY = 2 * Math.atan(Math.tan(36 * DEG) / aspect);
    fovY = Math.max(40 * DEG, Math.min(70 * DEG, fovY));
    return camera(eye, look, W, H, fovY);
  }

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
  function pathPoly(ctx, cam, pts) {
    const cs = clipPoly(pts.map(p => toCam(cam, p)));
    if (cs.length < 3) return false;
    ctx.beginPath();
    cs.forEach((c, i) => { const q = projC(cam, c); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath();
    return true;
  }
  function fillPoly(ctx, cam, pts, fill) { if (pathPoly(ctx, cam, pts)) { ctx.fillStyle = fill; ctx.fill(); } }
  function seg(ctx, cam, a, b, widthFt, minW, maxW) {
    let ca = toCam(cam, a), cb = toCam(cam, b);
    const N = 1;
    if (ca[2] <= N && cb[2] <= N) return;
    if (ca[2] <= N) { const t = (N - ca[2]) / (cb[2] - ca[2]); ca = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, N]; }
    if (cb[2] <= N) { const t = (N - cb[2]) / (ca[2] - cb[2]); cb = [cb[0] + (ca[0] - cb[0]) * t, cb[1] + (ca[1] - cb[1]) * t, N]; }
    const pa = projC(cam, ca), pb = projC(cam, cb);
    ctx.lineWidth = Math.min(maxW || 14, Math.max(minW || 1, widthFt * (pa.s + pb.s) / 2));
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }

  // ---------- the park, built once ----------
  const polar = (deg, d, y) => [d * Math.sin(deg * DEG), y || 0, d * Math.cos(deg * DEG)];
  const fence = a => Field.fenceDist(a);
  function arc(r, a0, a1, n, cx, cz, y) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * DEG; out.push([(cx || 0) + r * Math.sin(a), y || 0, (cz || 0) + r * Math.cos(a)]); }
    return out;
  }
  const GEO = (() => {
    const fenceArc = []; for (let i = 0; i <= 36; i++) { const a = -45 + i * 2.5; fenceArc.push(polar(a, fence(a))); }
    const field = fenceArc.slice().reverse().concat([[-268, 0, 205], [-62, 0, -28], [-36, 0, -56], [36, 0, -56], [62, 0, -28], [268, 0, 205]]);
    const track = []; for (let i = 0; i <= 36; i++) { const a = -45 + i * 2.5; track.push(polar(a, fence(a) - 14)); }
    const stripes = [];
    for (let r = 160, k = 0; r < 400; r += 16, k++) {
      if (k % 2) continue;
      const inner = [], outer = [];
      for (let i = 0; i <= 24; i++) {
        const a = -45 + i * 3.75;
        const lim = fence(a) - 14;
        inner.push(polar(a, Math.min(r, lim))); outer.push(polar(a, Math.min(r + 16, lim)));
      }
      stripes.push(inner.concat(outer.reverse()));
    }
    // infield dirt: everything within 95 ft of the rubber, inside the foul lines
    const dirt = [[0, 0, 0]];
    for (let i = 0; i <= 30; i++) {
      const a = -45 + i * 3;
      // where a ray from home at angle a meets the circle around the rubber
      const ux = Math.sin(a * DEG), uz = Math.cos(a * DEG), cz = 60.5;
      const b = uz * cz, c = cz * cz - 95 * 95;
      dirt.push(polar(a, b + Math.sqrt(b * b - c)));
    }
    const grassIn = [[0, 0, 13.5], [57, 0, 64.5], [0, 0, 119], [-57, 0, 64.5]];
    const mound = arc(9, 0, 360, 24, 0, 59.5);
    const homeDirt = arc(13, 0, 360, 28, 0, 0.7);
    const plate = [[-0.708, 0.02, 1.42], [0.708, 0.02, 1.42], [0.708, 0.02, 0.708], [0, 0.02, 0], [-0.708, 0.02, 0.708]];
    const boxes = [-1, 1].map(s => [[s * 1.2, 0.02, -2.3], [s * 5.2, 0.02, -2.3], [s * 5.2, 0.02, 3.7], [s * 1.2, 0.02, 3.7]]);
    const bag = (p, r) => [[p[0] - r, 0.12, p[2]], [p[0], 0.12, p[2] + r], [p[0] + r, 0.12, p[2]], [p[0], 0.12, p[2] - r]];
    const bags = [bag([62.5, 0, 63.6], 1.05), bag([0, 0, 127.3], 1.05), bag([-62.5, 0, 63.6], 1.05)];
    const cutouts = [[63.6, 63.6], [0, 127.3], [-63.6, 63.6]].map(([x, z]) => arc(13, 0, 360, 20, x, z));
    // the stands: tiers rising behind the outfield wall, and a seating bowl down the lines
    const tiers = [];
    for (let i = 0; i < 36; i++) {
      const a0 = -45 + i * 2.5, a1 = a0 + 2.5;
      if (a0 >= -10 && a1 <= 10) continue;   // the batter's eye in center
      tiers.push([polar(a0, fence(a0) + 4, 10), polar(a1, fence(a1) + 4, 10), polar(a1, fence(a1) + 70, 46), polar(a0, fence(a0) + 70, 46)]);
    }
    const eye = [polar(-10, fence(-10) + 4, 0), polar(10, fence(10) + 4, 0), polar(10, fence(10) + 4, 24), polar(-10, fence(-10) + 4, 24)];
    const lineStands = [-1, 1].map(s => [[s * 268, 0, 205], [s * 62, 0, -28], [s * 80, 26, -46], [s * 300, 26, 222]]);
    const towers = [-62, -30, -13, 13, 30, 62, -105, 105].map(a => ({ base: polar(a, Math.abs(a) > 90 ? 210 : 480, 0), top: polar(a, Math.abs(a) > 90 ? 210 : 480, 125) }));
    return { fenceArc, field, track, stripes, dirt, grassIn, mound, homeDirt, plate, boxes, bags, cutouts, tiers, eye, lineStands, towers };
  })();

  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const STARS = (() => { const r = rng(9), out = []; for (let i = 0; i < 70; i++) out.push({ x: r(), y: r() * 0.42, b: r() }); return out; })();
  const CROWD = (() => { const r = rng(4), out = []; for (let i = 0; i < 520; i++) out.push({ a: -44 + r() * 88, d: 6 + r() * 60, c: r() }); return out; })();

  function drawSky(ctx, cam) {
    const W = cam.W, H = cam.H;
    // where the horizon lands on screen
    const hz = project(cam, add(cam.eye, [cam.f[0] * 1000, 0, cam.f[2] * 1000]));
    const hy = hz ? hz.y : H * 0.4;
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(10, hy));
    g.addColorStop(0, C.sky0); g.addColorStop(0.65, C.sky1); g.addColorStop(1, C.sky2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.max(0, hy) + 2);
    ctx.fillStyle = C.stands; ctx.fillRect(0, Math.max(0, hy), W, H);
    STARS.forEach(s => { const y = s.y * hy; if (y < hy - 30) { ctx.fillStyle = `rgba(255,255,255,${0.25 + s.b * 0.5})`; ctx.fillRect(s.x * W, y, 1.3, 1.3); } });
    // the glow the lights throw up over the park
    const gl = ctx.createLinearGradient(0, hy - H * 0.22, 0, hy);
    gl.addColorStop(0, 'rgba(255,230,180,0)'); gl.addColorStop(1, 'rgba(255,230,180,0.13)');
    ctx.fillStyle = gl; ctx.fillRect(0, hy - H * 0.22, W, H * 0.22);
  }
  function drawTowers(ctx, cam, t) {
    GEO.towers.forEach(tw => {
      const b = project(cam, tw.base), tp = project(cam, tw.top);
      if (!b || !tp) return;
      ctx.strokeStyle = '#2a3142'; ctx.lineWidth = Math.max(1, 3 * tp.s);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
      const r = Math.max(10, 70 * tp.s);
      const gl = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, r * 3.2);
      gl.addColorStop(0, 'rgba(255,246,214,0.55)'); gl.addColorStop(0.3, 'rgba(255,236,190,0.16)'); gl.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(tp.x, tp.y, r * 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff8e2';
      const bw = Math.max(4, 22 * tp.s), bh = Math.max(3, 10 * tp.s);
      ctx.fillRect(tp.x - bw / 2, tp.y - bh / 2, bw, bh);
    });
  }
  function drawStands(ctx, cam) {
    GEO.tiers.forEach((q, i) => fillPoly(ctx, cam, q, i % 2 ? C.stands : C.standsHi));
    GEO.lineStands.forEach(q => fillPoly(ctx, cam, q, C.standsHi));
    // the crowd: a speckle of shirts in the seats
    CROWD.forEach(c => {
      const a = c.a; if (Math.abs(a) < 10) return;
      const f = fence(a) + 4 + c.d;
      const p = project(cam, polar(a, f, 10 + (c.d / 66) * 36 + 1));
      if (!p || p.s < 0.02) return;
      ctx.fillStyle = c.c < 0.3 ? 'rgba(230,220,200,0.55)' : c.c < 0.55 ? 'rgba(180,60,60,0.5)' : c.c < 0.75 ? 'rgba(70,110,180,0.5)' : 'rgba(240,200,90,0.45)';
      const r = Math.min(2.2, Math.max(0.8, 1.4 * p.s));
      ctx.fillRect(p.x - r, p.y - r * 1.6, r * 2, r * 2.2);
    });
    fillPoly(ctx, cam, GEO.eye, C.eye);
    // scoreboard in right-center
    const sb = [polar(16, fence(16) + 40, 46), polar(30, fence(30) + 40, 46), polar(30, fence(30) + 40, 80), polar(16, fence(16) + 40, 80)];
    fillPoly(ctx, cam, sb, '#0d1118');
    const sbi = [polar(17, fence(17) + 39, 50), polar(29, fence(29) + 39, 50), polar(29, fence(29) + 39, 76), polar(17, fence(17) + 39, 76)];
    fillPoly(ctx, cam, sbi, '#16301f');
  }
  function drawGround(ctx, cam) {
    fillPoly(ctx, cam, GEO.field, C.foul);
    // fair grass, then stripes from the mower
    fillPoly(ctx, cam, [[0, 0, 0]].concat(GEO.fenceArc), C.grass);
    GEO.stripes.forEach(s => fillPoly(ctx, cam, s, C.grass2));
    // warning track
    fillPoly(ctx, cam, GEO.fenceArc.concat(GEO.track.slice().reverse()), C.track);
    fillPoly(ctx, cam, GEO.dirt, C.dirt);
    fillPoly(ctx, cam, GEO.grassIn, C.grass);
    GEO.cutouts.forEach(c => fillPoly(ctx, cam, c, C.dirt));
    fillPoly(ctx, cam, GEO.mound, C.dirt2);
    fillPoly(ctx, cam, GEO.homeDirt, C.dirt);
    fillPoly(ctx, cam, [[-0.3, 0.05, 60.3], [0.3, 0.05, 60.3], [0.3, 0.05, 60.8], [-0.3, 0.05, 60.8]].map(p => [p[0] * 4, p[1], p[2]]), C.chalk);
    // chalk
    ctx.strokeStyle = 'rgba(243,241,234,0.9)';
    [-1, 1].forEach(s => { seg(ctx, cam, [s * 0.9, 0.02, 0.9], polar(s * 45, fence(45)), 0.3, 1); });
    GEO.boxes.forEach(b => { ctx.strokeStyle = 'rgba(243,241,234,0.5)'; for (let i = 0; i < 4; i++) seg(ctx, cam, b[i], b[(i + 1) % 4], 0.22, 0.8, 4); });
    fillPoly(ctx, cam, GEO.plate, '#f4f2ea');
    GEO.bags.forEach(b => fillPoly(ctx, cam, b, '#f4f2ea'));
  }
  function drawWall(ctx, cam) {
    const A = GEO.fenceArc;
    for (let i = 0; i < A.length - 1; i++) {
      const a = A[i], b = A[i + 1];
      fillPoly(ctx, cam, [a, b, [b[0], 10, b[2]], [a[0], 10, a[2]]], i % 2 ? C.wall : C.pad);
    }
    ctx.strokeStyle = C.wallTop;
    for (let i = 0; i < A.length - 1; i++) seg(ctx, cam, [A[i][0], 10, A[i][2]], [A[i + 1][0], 10, A[i + 1][2]], 0.8, 1);
    ctx.strokeStyle = C.pole;
    [-45, 45].forEach(a => { const p = polar(a, fence(a)); seg(ctx, cam, p, [p[0], 70, p[2]], 1.0, 1.5); });
    // distances painted on the wall
    [[-44, '330'], [-22.5, '375'], [0, '400'], [22.5, '375'], [44, '330']].forEach(([a, txt]) => {
      const p = project(cam, polar(a, fence(a) - 0.5, 5));
      if (!p || p.s < 0.25) return;
      ctx.fillStyle = 'rgba(243,241,234,0.85)';
      ctx.font = `700 ${Math.round(Math.min(40, 5.2 * p.s))}px "Oswald", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, p.x, p.y);
    });
  }
  // the whole backdrop: sky, lights, stands, wall, field
  function drawPark(ctx, cam, t) {
    drawSky(ctx, cam);
    drawTowers(ctx, cam, t);
    drawStands(ctx, cam);
    drawGround(ctx, cam);
    drawWall(ctx, cam);
  }

  // ---------- people ----------
  const POSES = {
    stand: { head: [0, 6.0, 0], neck: [0, 5.45, 0], lsh: [-0.78, 5.2, 0], rsh: [0.78, 5.2, 0], lel: [-1.0, 4.1, 0.1], rel: [1.0, 4.1, 0.1], lha: [-1.05, 3.15, 0.35], rha: [1.05, 3.15, 0.35], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.5, 1.8, 0.15], rkn: [0.5, 1.8, 0.15], lft: [-0.55, 0.12, 0.2], rft: [0.55, 0.12, 0.2] },
    ready: { head: [0, 5.2, 0.6], neck: [0, 4.75, 0.45], lsh: [-0.8, 4.5, 0.35], rsh: [0.8, 4.5, 0.35], lel: [-1.0, 3.5, 0.9], rel: [1.0, 3.5, 0.9], lha: [-0.6, 2.6, 1.35], rha: [0.6, 2.6, 1.35], lhip: [-0.46, 2.9, -0.2], rhip: [0.46, 2.9, -0.2], lkn: [-1.0, 1.5, 0.5], rkn: [1.0, 1.5, 0.5], lft: [-1.3, 0.12, 0.1], rft: [1.3, 0.12, 0.1] },
    run1: { head: [0, 5.9, 0.5], neck: [0, 5.35, 0.4], lsh: [-0.75, 5.1, 0.35], rsh: [0.75, 5.1, 0.35], lel: [-0.9, 4.3, 1.0], rel: [0.95, 4.2, -0.4], lha: [-0.8, 4.9, 1.6], rha: [0.95, 3.4, -0.7], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.48, 2.2, 1.1], rkn: [0.48, 1.6, -0.6], lft: [-0.5, 0.9, 0.7], rft: [0.5, 0.2, -1.1] },
    run2: { head: [0, 5.9, 0.5], neck: [0, 5.35, 0.4], lsh: [-0.75, 5.1, 0.35], rsh: [0.75, 5.1, 0.35], lel: [-0.95, 4.2, -0.4], rel: [0.9, 4.3, 1.0], lha: [-0.95, 3.4, -0.7], rha: [0.8, 4.9, 1.6], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.48, 1.6, -0.6], rkn: [0.48, 2.2, 1.1], lft: [-0.5, 0.2, -1.1], rft: [0.5, 0.9, 0.7] },
    reach: { head: [0, 6.0, 0.2], neck: [0, 5.45, 0.15], lsh: [-0.78, 5.2, 0.1], rsh: [0.78, 5.2, 0.1], lel: [-0.9, 6.4, 0.5], rel: [1.0, 4.2, 0.2], lha: [-0.8, 7.6, 0.9], rha: [1.1, 3.4, 0.4], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.5, 1.9, 0.3], rkn: [0.5, 1.7, -0.1], lft: [-0.55, 0.12, 0.4], rft: [0.55, 0.12, -0.3] },
    scoop: { head: [0, 4.4, 1.1], neck: [0, 4.0, 0.9], lsh: [-0.8, 3.8, 0.8], rsh: [0.8, 3.8, 0.8], lel: [-0.9, 2.6, 1.4], rel: [0.9, 2.6, 1.4], lha: [-0.4, 1.0, 1.9], rha: [0.4, 1.2, 1.9], lhip: [-0.46, 2.5, -0.3], rhip: [0.46, 2.5, -0.3], lkn: [-1.1, 1.3, 0.5], rkn: [1.1, 1.3, 0.5], lft: [-1.4, 0.12, 0.2], rft: [1.4, 0.12, 0.2] },
    throw: { head: [0, 5.9, 0.3], neck: [0, 5.35, 0.2], lsh: [-0.75, 5.15, 0.3], rsh: [0.75, 5.15, -0.2], lel: [-1.3, 5.0, 1.0], rel: [1.4, 5.6, -0.8], lha: [-1.6, 4.6, 1.6], rha: [1.5, 6.6, -1.4], lhip: [-0.42, 3.35, 0.1], rhip: [0.42, 3.35, -0.1], lkn: [-0.5, 1.9, 0.8], rkn: [0.5, 1.7, -0.6], lft: [-0.55, 0.12, 1.4], rft: [0.55, 0.12, -1.2] },
    // the pitcher's delivery
    pset: { head: [0, 6.05, 0], neck: [0, 5.5, 0], lsh: [-0.75, 5.25, 0], rsh: [0.75, 5.25, 0], lel: [-0.75, 4.4, 0.45], rel: [0.75, 4.4, 0.45], lha: [-0.15, 4.6, 0.7], rha: [0.15, 4.6, 0.7], lhip: [-0.42, 3.35, 0], rhip: [0.42, 3.35, 0], lkn: [-0.45, 1.8, 0.1], rkn: [0.45, 1.8, 0.1], lft: [-0.5, 0.12, 0.1], rft: [0.5, 0.12, 0.1] },
    kick: { head: [0.2, 6.1, -0.2], neck: [0.2, 5.55, -0.2], lsh: [-0.55, 5.3, 0.2], rsh: [0.85, 5.3, -0.4], lel: [-0.5, 4.5, 0.6], rel: [0.7, 4.5, 0.2], lha: [0.0, 4.8, 0.5], rha: [0.2, 4.8, 0.5], lhip: [-0.3, 3.4, 0.2], rhip: [0.5, 3.4, -0.2], lkn: [-0.6, 4.3, 0.9], rkn: [0.45, 1.85, 0], lft: [-0.4, 2.9, 0.6], rft: [0.5, 0.12, 0] },
    stride: { head: [0, 5.4, 0.6], neck: [0, 4.95, 0.5], lsh: [-0.75, 4.75, 0.6], rsh: [0.8, 4.85, -0.2], lel: [-1.4, 4.6, 1.3], rel: [1.6, 5.2, -0.9], lha: [-1.3, 4.1, 1.9], rha: [1.5, 6.0, -1.7], lhip: [-0.42, 3.0, 0.5], rhip: [0.42, 3.0, -0.3], lkn: [-0.6, 1.9, 2.3], rkn: [0.5, 1.4, -1.0], lft: [-0.6, 0.12, 3.1], rft: [0.5, 0.25, -1.6] },
    follow: { head: [-0.2, 4.4, 2.0], neck: [-0.2, 4.0, 1.7], lsh: [-0.9, 3.9, 1.4], rsh: [0.6, 4.0, 1.9], lel: [-1.5, 3.4, 0.9], rel: [-0.2, 3.0, 2.6], lha: [-1.5, 2.8, 0.5], rha: [-0.9, 2.0, 2.4], lhip: [-0.42, 2.8, 0.9], rhip: [0.42, 3.0, 0.2], lkn: [-0.6, 1.6, 2.4], rkn: [0.5, 1.6, 0.4], lft: [-0.6, 0.12, 3.1], rft: [0.6, 0.6, 0.8] }
  };
  // where the throwing hand is at release, by arm slot (pitcher's right, up, forward)
  const RELEASE_HAND = { over: [0.55, 7.2, 1.6], three: [1.5, 6.5, 1.5], low: [2.2, 5.6, 1.4], side: [2.8, 4.7, 1.2] };
  const JOINTS = Object.keys(POSES.stand);
  function blend(a, b, k) {
    const out = {};
    JOINTS.forEach(j => { const p = a[j], q = b[j]; out[j] = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k]; });
    return out;
  }
  function mirror(pose) {
    const out = {};
    JOINTS.forEach(j => { const sw = j[0] === 'l' ? 'r' + j.slice(1) : j[0] === 'r' ? 'l' + j.slice(1) : j; const p = pose[sw]; out[j] = [-p[0], p[1], p[2]]; });
    return out;
  }
  function releasePose(slot) {
    const p = JSON.parse(JSON.stringify(POSES.stride));
    const h = RELEASE_HAND[slot] || RELEASE_HAND.three;
    p.rha = h.slice(); p.rel = [(0.8 + h[0]) / 2 + 0.2, (4.85 + h[1]) / 2, (h[2] - 0.2) / 2];
    p.head = [0, 5.3, 1.1]; p.neck = [0, 4.85, 0.95]; p.rsh = [0.7, 4.85, 0.6]; p.lsh = [-0.8, 4.7, 0.9];
    p.lha = [-1.1, 3.6, 0.6]; p.lel = [-1.3, 4.2, 1.0];
    return p;
  }
  function figureWorld(fig) {
    const f = norm([fig.face[0], 0, fig.face[2]]);
    const s = [f[2], 0, -f[0]];
    const sc = fig.scale || 1;
    const W = {};
    JOINTS.forEach(j => { const l = fig.pose[j]; W[j] = [fig.pos[0] + s[0] * l[0] * sc + f[0] * l[2] * sc, l[1] * sc + (fig.lift || 0), fig.pos[2] + s[2] * l[0] * sc + f[2] * l[2] * sc]; });
    return W;
  }
  // world point -> a figure's own frame, for placing hands on a bat
  function toLocal(fig, p) {
    const f = norm([fig.face[0], 0, fig.face[2]]);
    const s = [f[2], 0, -f[0]];
    const d = [p[0] - fig.pos[0], p[1] - (fig.lift || 0), p[2] - fig.pos[2]];
    return [d[0] * s[0] + d[2] * s[2], d[1], d[0] * f[0] + d[2] * f[2]];
  }

  /* fig: { pos, face, pose, colors: { skin, jersey, pants, cap, trim, socks, shoes, glove },
            number, glove ('l'|'r'), scale, alpha, helmet, back } */
  function drawFigure(ctx, cam, fig) {
    const W = figureWorld(fig);
    const P = {};
    for (const j of JOINTS) { const c = toCam(cam, W[j]); if (c[2] <= NEAR + 0.2) return null; P[j] = projC(cam, c); }
    const col = fig.colors;
    ctx.save();
    ctx.globalAlpha = fig.alpha == null ? 1 : fig.alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const limb = (a, b, w, color) => { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, w * (P[a].s + P[b].s) / 2); ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke(); };
    const mid = (a, b, t) => ({ x: P[a].x + (P[b].x - P[a].x) * t, y: P[a].y + (P[b].y - P[a].y) * t, s: P[a].s + (P[b].s - P[a].s) * t });
    if (!fig.noShadow) {
      const sh = project(cam, [fig.pos[0], 0.02, fig.pos[2]]);
      if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, sh.s * 1.5, sh.s * 0.42, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // legs: pants to the knee, socks below
    limb('lhip', 'lkn', 0.5, col.pants); limb('rhip', 'rkn', 0.5, col.pants);
    limb('lkn', 'lft', 0.36, col.socks || col.trim); limb('rkn', 'rft', 0.36, col.socks || col.trim);
    ['lft', 'rft'].forEach(ft => { ctx.fillStyle = col.shoes || '#111'; ctx.beginPath(); ctx.ellipse(P[ft].x, P[ft].y, P[ft].s * 0.32, P[ft].s * 0.17, 0, 0, Math.PI * 2); ctx.fill(); });
    // torso
    ctx.fillStyle = col.jersey;
    const hw = P.lhip.s * 0.24, tw = P.lsh.s * 0.14;
    ctx.beginPath();
    ctx.moveTo(P.lsh.x - tw, P.lsh.y); ctx.lineTo(P.rsh.x + tw, P.rsh.y); ctx.lineTo(P.rhip.x + hw, P.rhip.y); ctx.lineTo(P.lhip.x - hw, P.lhip.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = col.pants;
    const bl = mid('lhip', 'lkn', 0.12), br = mid('rhip', 'rkn', 0.12);
    ctx.beginPath(); ctx.moveTo(P.lhip.x - hw, P.lhip.y); ctx.lineTo(P.rhip.x + hw, P.rhip.y); ctx.lineTo(br.x + hw, br.y); ctx.lineTo(bl.x - hw, bl.y); ctx.closePath(); ctx.fill();
    if (fig.number != null && P.lsh.s > 7) {
      ctx.fillStyle = col.trim;
      ctx.font = `700 ${Math.round(P.lsh.s * 0.78)}px "Oswald", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(fig.number), (P.lsh.x + P.rsh.x + P.lhip.x + P.rhip.x) / 4, (P.lsh.y + P.rsh.y) / 2 * 0.55 + (P.lhip.y + P.rhip.y) / 2 * 0.45);
    }
    // arms, glove
    limb('lsh', 'lel', 0.32, col.jersey); limb('lel', 'lha', 0.26, col.skin);
    limb('rsh', 'rel', 0.32, col.jersey); limb('rel', 'rha', 0.26, col.skin);
    ['lha', 'rha'].forEach(j => {
      const gl = fig.glove && j[0] === fig.glove;
      ctx.fillStyle = gl ? (col.glove || '#7a4a22') : col.skin;
      ctx.beginPath(); ctx.arc(P[j].x, P[j].y, P[j].s * (gl ? 0.34 : 0.17), 0, Math.PI * 2); ctx.fill();
    });
    // head and cap (or helmet)
    limb('neck', 'head', 0.28, col.skin);
    const hr = P.head.s * 0.42 * (fig.scale || 1);
    ctx.fillStyle = col.skin; ctx.beginPath(); ctx.arc(P.head.x, P.head.y, hr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.cap;
    ctx.beginPath(); ctx.arc(P.head.x, P.head.y - hr * 0.08, hr * (fig.helmet ? 1.12 : 1.03), Math.PI * 0.98, Math.PI * 2.02); ctx.fill();
    if (fig.helmet) { ctx.fillRect(P.head.x - hr * 1.12, P.head.y - hr * 0.2, hr * 2.24, hr * 0.5); }
    if (!fig.back) {
      // brim toward where he's facing
      const fwd = toCam(cam, add(W.head, mul(norm([fig.face[0], 0, fig.face[2]]), 0.6)));
      if (fwd[2] > NEAR) { const q = projC(cam, fwd); ctx.beginPath(); ctx.ellipse((P.head.x + q.x) / 2, P.head.y - hr * 0.12, Math.max(hr * 0.5, Math.abs(q.x - P.head.x) * 0.9), hr * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    return P;
  }
  function drawBat(ctx, cam, knob, tip, alpha) {
    const a = project(cam, knob), b = project(cam, tip);
    if (!a || !b) return;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.lineCap = 'round';
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, '#3a2414'); g.addColorStop(0.35, '#c99a5b'); g.addColorStop(1, '#e2bb7d');
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(2, 0.12 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y);
    const m = { x: a.x + (b.x - a.x) * 0.45, y: a.y + (b.y - a.y) * 0.45 };
    ctx.lineTo(m.x, m.y); ctx.stroke();
    ctx.lineWidth = Math.max(3, 0.22 * (a.s + b.s) / 2); ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }

  /* The ball, with its spin tell drawn on it once it's close enough to see:
     backspin (gray blur), a red dot (slider, sweeper, cutter), a tumbling
     seam (splitter), red seams rolling forward (curve), tilted seams (sinker,
     changeup). */
  function drawBall(ctx, cam, p, o) {
    const q = project(cam, p);
    if (!q) return null;
    const opt = o || {};
    const r = Math.max(opt.min || 2.2, Pitch.BALL_R * q.s);
    if (opt.glow) {
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3.2);
      g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r * 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f7f5ee'; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    const tell = opt.tell, ph = opt.phase || 0;
    if (tell && r >= 2.6) {
      ctx.save(); ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.clip();
      ctx.lineWidth = Math.max(0.8, r * 0.22);
      if (tell === 'dot') {
        ctx.fillStyle = '#d4232b'; ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.42, 0, Math.PI * 2); ctx.fill();
      } else if (tell === 'back') {
        ctx.strokeStyle = 'rgba(150,150,150,0.55)';
        ctx.beginPath(); ctx.moveTo(q.x - r, q.y - r * 0.35); ctx.lineTo(q.x + r, q.y - r * 0.35); ctx.moveTo(q.x - r, q.y + r * 0.35); ctx.lineTo(q.x + r, q.y + r * 0.35); ctx.stroke();
      } else if (tell === 'top') {
        ctx.strokeStyle = '#c8252c';
        const k = Math.sin(ph * 2.3) * r * 0.8;
        ctx.beginPath(); ctx.moveTo(q.x - r, q.y + k); ctx.quadraticCurveTo(q.x, q.y + k - r * 0.6, q.x + r, q.y + k); ctx.stroke();
      } else if (tell === 'tumble') {
        ctx.strokeStyle = '#c8252c';
        const a = ph * 0.9;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, r * 0.95, r * 0.5, a, 0, Math.PI * 2); ctx.stroke();
      } else if (tell === 'tilt' || tell === 'fade') {
        ctx.strokeStyle = 'rgba(200,60,60,0.7)';
        const a = tell === 'tilt' ? -0.6 : -0.9;
        ctx.beginPath(); ctx.moveTo(q.x - r * Math.cos(a), q.y - r * Math.sin(a) - r * 0.3); ctx.lineTo(q.x + r * Math.cos(a), q.y + r * Math.sin(a) - r * 0.3);
        ctx.moveTo(q.x - r * Math.cos(a), q.y - r * Math.sin(a) + r * 0.3); ctx.lineTo(q.x + r * Math.cos(a), q.y + r * Math.sin(a) + r * 0.3); ctx.stroke();
      }
      ctx.restore();
    }
    return q;
  }
  function drawShadow(ctx, cam, p) {
    const q = project(cam, [p[0], 0.02, p[2]]);
    if (!q) return;
    const a = Math.max(0.08, 0.4 - p[1] * 0.004);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(1.5, 0.22 * q.s), Math.max(0.8, 0.08 * q.s), 0, 0, Math.PI * 2); ctx.fill();
  }

  return { V, C, camera, batterCam, followCam, toCam, project, projC, fillPoly, seg, polar, drawPark, drawSky, drawGround, drawWall, drawStands, drawTowers, POSES, JOINTS, blend, mirror, releasePose, figureWorld, toLocal, drawFigure, drawBat, drawBall, drawShadow, GEO };
})();
