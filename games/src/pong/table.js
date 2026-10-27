/* Table3D: the basement, the table, the cups and the people, drawn with a
   perspective camera on plain canvas 2D. Same idea as the court in
   Basketball Playground: everything lives in feet and gets projected. */
const Table3D = (() => {
  const { V, CUP, R, TABLE, FLOOR } = PongPhysics;
  const NEAR = 0.3;

  // ---------- camera ----------
  function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  // Looking down the table from your end, +x is screen right.
  function makeCam(eye, look, W, H, focal) {
    const f = norm(V.sub(look, eye));
    const r = norm([f[2], 0, -f[0]]);
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    return { eye, f, r, u, focal, W, H, cx: W / 2, cy: H / 2 };
  }
  // Where you stand to throw, and where you watch from when it's their turn.
  const VIEWS = {
    you: { eye: [0, 4.6, -0.4], look: [0, 0.2, 7.4], rackY: 0.66, zoom: [3.4, 1.6] },
    them: { eye: [0, 4.4, -2.2], look: [0, -0.1, 3.6], rackY: 0.5, zoom: [1.55, 0.86] }
  };
  function viewCam(a, b, k, W, H, shake) {
    const A = VIEWS[a], B = VIEWS[b || a];
    const e = k == null ? 0 : k;
    const eye = V.add(A.eye, V.mul(V.sub(B.eye, A.eye), e));
    const look = V.add(A.look, V.mul(V.sub(B.look, A.look), e));
    const fa = Math.min(W * A.zoom[0], H * A.zoom[1]), fb = Math.min(W * B.zoom[0], H * B.zoom[1]);
    const focal = fa + (fb - fa) * e;
    const ry = A.rackY + (B.rackY - A.rackY) * e;
    // pitch the look so the target sits at rackY of the screen
    const cam0 = makeCam(eye, look, W, H, focal);
    const off = Math.atan((0.5 - ry) * H / focal);
    const f = cam0.f;
    const hz = Math.hypot(f[0], f[2]);
    const pitch = Math.atan2(f[1], hz) - off;
    const dir = [f[0] / hz * Math.cos(pitch), Math.sin(pitch), f[2] / hz * Math.cos(pitch)];
    if (shake) { dir[0] += shake[0]; dir[1] += shake[1]; }
    return makeCam(eye, V.add(eye, dir), W, H, focal);
  }
  function toCam(cam, p) { const v = V.sub(p, cam.eye); return [V.dot(v, cam.r), V.dot(v, cam.u), V.dot(v, cam.f)]; }
  function projC(cam, c) { return { x: cam.cx + cam.focal * c[0] / c[2], y: cam.cy - cam.focal * c[1] / c[2], s: cam.focal / c[2], z: c[2] }; }
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
  function pathPoly(ctx, cam, pts) {
    const cs = clipPoly(pts.map(p => toCam(cam, p)));
    if (cs.length < 3) return false;
    ctx.beginPath();
    cs.forEach((c, i) => { const q = projC(cam, c); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath();
    return true;
  }
  function fillPoly(ctx, cam, pts, fill) { if (pathPoly(ctx, cam, pts)) { ctx.fillStyle = fill; ctx.fill(); } }
  function seg(ctx, cam, a, b, widthFt, minW) {
    let ca = toCam(cam, a), cb = toCam(cam, b);
    const N = 0.8;
    if (ca[2] <= N && cb[2] <= N) return;
    if (ca[2] <= N) { const t = (N - ca[2]) / (cb[2] - ca[2]); ca = [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, N]; }
    if (cb[2] <= N) { const t = (N - cb[2]) / (ca[2] - cb[2]); cb = [cb[0] + (ca[0] - cb[0]) * t, cb[1] + (ca[1] - cb[1]) * t, N]; }
    const pa = projC(cam, ca), pb = projC(cam, cb);
    ctx.lineWidth = Math.min(14, Math.max(minW || 1, widthFt * (pa.s + pb.s) / 2));
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }

  // ---------- the basement ----------
  const ROOM = { x: 7, zBack: 12, zFront: -6, top: 5.4 };
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const BULBS = (() => {
    const out = [], r = rng(3);
    // strands of lights draped across the ceiling, a few back to front
    [[-6.5, 11.6, 6.5, 11.6, 0.9], [-6.5, 8.5, 6.5, 6.5, 1.2], [-6.5, 3.5, 6.5, 5.5, 1.1], [-6.6, 11.5, -6.6, -2, 0.7], [6.6, 11.5, 6.6, -2, 0.7]].forEach(([x0, z0, x1, z1, sag], si) => {
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        out.push({ p: [x0 + (x1 - x0) * t, ROOM.top - 0.25 - sag * 4 * t * (1 - t), z0 + (z1 - z0) * t], hue: ['#ffcf6b', '#ff8a5c', '#ffe7a3', '#7fd4ff', '#ff6fa8'][Math.floor(r() * 5)], ph: r() * 6, strand: si, t });
      }
    });
    return out;
  })();

  function drawRoom(ctx, cam, t) {
    const X = ROOM.x, Zb = ROOM.zBack, Zf = ROOM.zFront, T = ROOM.top, F = FLOOR;
    ctx.fillStyle = '#0d0a12'; ctx.fillRect(0, 0, cam.W, cam.H);
    // ceiling, walls, floor
    fillPoly(ctx, cam, [[-X, T, Zf], [X, T, Zf], [X, T, Zb], [-X, T, Zb]], '#120e17');
    fillPoly(ctx, cam, [[-X, F, Zb], [X, F, Zb], [X, T, Zb], [-X, T, Zb]], '#2a1d24');
    fillPoly(ctx, cam, [[-X, F, Zf], [-X, F, Zb], [-X, T, Zb], [-X, T, Zf]], '#22181f');
    fillPoly(ctx, cam, [[X, F, Zf], [X, F, Zb], [X, T, Zb], [X, T, Zf]], '#22181f');
    fillPoly(ctx, cam, [[-X, F, Zf], [X, F, Zf], [X, F, Zb], [-X, F, Zb]], '#1b1820');
    // wood paneling on the back wall
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    for (let x = -X + 0.5; x < X; x += 0.5) seg(ctx, cam, [x, F, Zb - 0.01], [x, T, Zb - 0.01], 0.02, 0.6);
    // a chair rail and a darker lower half
    fillPoly(ctx, cam, [[-X, F, Zb - 0.02], [X, F, Zb - 0.02], [X, F + 2.9, Zb - 0.02], [-X, F + 2.9, Zb - 0.02]], 'rgba(10,6,10,0.35)');
    ctx.strokeStyle = '#3a2830'; seg(ctx, cam, [-X, F + 2.9, Zb - 0.03], [X, F + 2.9, Zb - 0.03], 0.12, 1);
    // posters and a neon sign
    [[-5, 1.4, 2.0, 2.8, '#2f4f8a'], [3.6, 1.0, 1.6, 2.2, '#7c3a34'], [5.4, 0.2, 1.1, 1.5, '#2c5a46']].forEach(([x, y, w, h, c]) => {
      fillPoly(ctx, cam, [[x, y, Zb - 0.04], [x + w, y, Zb - 0.04], [x + w, y + h, Zb - 0.04], [x, y + h, Zb - 0.04]], c);
      fillPoly(ctx, cam, [[x + 0.15, y + 0.15, Zb - 0.05], [x + w - 0.15, y + 0.15, Zb - 0.05], [x + w - 0.15, y + h * 0.55, Zb - 0.05], [x + 0.15, y + h * 0.55, Zb - 0.05]], 'rgba(255,255,255,0.12)');
    });
    drawNeon(ctx, cam, t);
    // floor rug under the table
    fillPoly(ctx, cam, [[-2.6, F + 0.01, -1], [2.6, F + 0.01, -1], [2.6, F + 0.01, 9], [-2.6, F + 0.01, 9]], '#2b2030');
    // string lights
    const strands = {};
    BULBS.forEach(b => { (strands[b.strand] = strands[b.strand] || []).push(b); });
    ctx.strokeStyle = 'rgba(20,16,22,0.9)';
    Object.values(strands).forEach(s => { for (let i = 0; i < s.length - 1; i++) seg(ctx, cam, s[i].p, s[i + 1].p, 0.02, 0.8); });
    BULBS.forEach(b => {
      const q = project(cam, b.p);
      if (!q || q.x < -60 || q.x > cam.W + 60 || q.y < -60 || q.y > cam.H + 60) return;
      const flick = 0.85 + 0.15 * Math.sin(t * 2.1 + b.ph);
      const r = Math.max(1.6, Math.min(9, q.s * 0.07));
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 7);
      g.addColorStop(0, hexA(b.hue, 0.55 * flick)); g.addColorStop(1, hexA(b.hue, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r * 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.hue; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    });
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
  }
  function drawNeon(ctx, cam, t) {
    // a cup and a ball in neon tube, with the word PONG
    const z = ROOM.zBack - 0.06, cx = -2.6, cy = 3.0;
    const pts = (arr) => arr.map(([x, y]) => [cx + x, cy + y, z]);
    const glow = (color, path, w) => {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = color; ctx.shadowBlur = 14;
      for (let i = 0; i < path.length - 1; i++) seg(ctx, cam, path[i], path[i + 1], w, 1.2);
      ctx.restore();
    };
    const on = Math.sin(t * 0.7) > -0.97 ? 1 : 0.4;
    ctx.globalAlpha = on;
    glow('#ff5fa2', pts([[-1.0, 1.1], [-0.8, -0.1], [-0.2, -0.1], [0, 1.1], [-1.0, 1.1]]), 0.06);
    const ring = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2; ring.push([0.55 + 0.17 * Math.cos(a), 1.55 + 0.17 * Math.sin(a)]); }
    glow('#7fe7ff', pts(ring), 0.05);
    ctx.globalAlpha = 1;
    const q = project(cam, [cx + 1.5, cy + 0.45, z]);
    if (q && q.s > 3) {
      ctx.save();
      ctx.font = `400 ${Math.round(q.s * 0.85)}px "Bungee", Impact, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ffcf6b'; ctx.shadowBlur = 16; ctx.fillStyle = on ? '#ffe7a3' : '#8a7a50';
      ctx.fillText('PONG', q.x, q.y);
      ctx.restore();
    }
  }

  // ---------- table ----------
  function drawTable(ctx, cam) {
    const { x0, x1, z0, z1 } = TABLE;
    // legs and apron, then the top
    ctx.strokeStyle = '#151217';
    [[x0 + 0.1, z0 + 0.3], [x1 - 0.1, z0 + 0.3], [x0 + 0.1, z1 - 0.3], [x1 - 0.1, z1 - 0.3]].forEach(([x, z]) => seg(ctx, cam, [x, -0.1, z], [x, FLOOR, z], 0.12, 1));
    fillPoly(ctx, cam, [[x0, 0, z0], [x1, 0, z0], [x1, -0.12, z0], [x0, -0.12, z0]], '#0e1f1a');
    fillPoly(ctx, cam, [[x0, 0, z1], [x1, 0, z1], [x1, -0.12, z1], [x0, -0.12, z1]], '#0e1f1a');
    fillPoly(ctx, cam, [[x0, 0, z0], [x0, 0, z1], [x0, -0.12, z1], [x0, -0.12, z0]], '#0b1916');
    fillPoly(ctx, cam, [[x1, 0, z0], [x1, 0, z1], [x1, -0.12, z1], [x1, -0.12, z0]], '#0b1916');
    // top: deep green with a soft sheen toward the middle
    fillPoly(ctx, cam, [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], '#17463a');
    fillPoly(ctx, cam, [[x0 + 0.25, 0, 2], [x1 - 0.25, 0, 2], [x1 - 0.25, 0, 6], [x0 + 0.25, 0, 6]], 'rgba(255,240,200,0.035)');
    ctx.strokeStyle = 'rgba(243,241,234,0.85)';
    const m = 0.04;
    [[[x0 + m, 0, z0 + m], [x0 + m, 0, z1 - m]], [[x1 - m, 0, z0 + m], [x1 - m, 0, z1 - m]], [[x0 + m, 0, z0 + m], [x1 - m, 0, z0 + m]], [[x0 + m, 0, z1 - m], [x1 - m, 0, z1 - m]]].forEach(([a, b]) => seg(ctx, cam, a, b, 0.035, 0.8));
    ctx.strokeStyle = 'rgba(243,241,234,0.35)';
    seg(ctx, cam, [x0 + m, 0, 4], [x1 - m, 0, 4], 0.025, 0.6);
    seg(ctx, cam, [0, 0, z0 + m], [0, 0, z1 - m], 0.015, 0.5);
  }

  // ---------- cups ----------
  const RING = 18;
  function ringPts(c, y, r) { const out = []; for (let i = 0; i < RING; i++) { const a = i / RING * Math.PI * 2; out.push([c.x + r * Math.cos(a), y, c.z + r * Math.sin(a)]); } return out; }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  /* c: { x, z, lift (ft), alpha, glow, dim }, ball: a sunk ball to draw inside */
  function drawCup(ctx, cam, c, ball, t) {
    const lift = c.lift || 0;
    const top = ringPts(c, CUP.h + lift, CUP.rTop).map(p => project(cam, p));
    const bot = ringPts(c, lift, CUP.rBot).map(p => project(cam, p));
    if (top.some(q => !q) || bot.some(q => !q)) return;
    ctx.save();
    ctx.globalAlpha = c.alpha == null ? 1 : c.alpha;
    // shadow on the table
    if (!lift) {
      const sh = project(cam, [c.x + 0.03, 0.002, c.z + 0.02]);
      if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, CUP.rTop * sh.s * 1.15, CUP.rTop * sh.s * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    if (c.glow) {
      const q = project(cam, [c.x, CUP.h + lift, c.z]);
      const r = CUP.rTop * q.s * 2.4;
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      g.addColorStop(0, 'rgba(255,207,107,0.5)'); g.addColorStop(1, 'rgba(255,207,107,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    }
    // body
    const h = hull(top.concat(bot));
    const xs = top.map(q => q.x), minX = Math.min(...xs), maxX = Math.max(...xs);
    const gr = ctx.createLinearGradient(minX, 0, maxX, 0);
    const base = c.dim ? ['#6e2a2a', '#8a3634', '#4a1c1d'] : ['#ff6a5c', '#d8312d', '#7d1416'];
    gr.addColorStop(0, base[1]); gr.addColorStop(0.28, base[0]); gr.addColorStop(0.6, base[1]); gr.addColorStop(1, base[2]);
    ctx.fillStyle = gr;
    ctx.beginPath(); h.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fill();
    // the ridges a third of the way down
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = Math.max(0.6, top[0].s * 0.006);
    [0.62, 0.78].forEach(k => {
      const rr = ringPts(c, CUP.h * k + lift, CUP.rBot + (CUP.rTop - CUP.rBot) * k).map(p => project(cam, p));
      ctx.beginPath();
      rr.forEach((q, i) => { const a = i / RING * Math.PI * 2; if (Math.sin(a) > 0.05) return; i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.stroke();
    });
    // opening: inner wall, the liquid, and a ball floating in it
    ctx.beginPath(); top.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
    ctx.fillStyle = c.dim ? '#bdb6ab' : '#f2ede4'; ctx.fill();
    ctx.save(); ctx.clip();
    const liq = ringPts(c, CUP.h * 0.42 + lift, CUP.rBot + (CUP.rTop - CUP.rBot) * 0.42).map(p => project(cam, p));
    const lq = project(cam, [c.x, CUP.h * 0.42 + lift, c.z]);
    ctx.fillStyle = 'rgba(190,204,218,0.55)';
    ctx.beginPath(); liq.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fill();
    if (ball && lq) {
      const bob = Math.sin((t || 0) * 5) * 0.004;
      const p = project(cam, [ball.x, CUP.h * 0.42 + R * 0.6 + lift + bob, ball.z]);
      if (p) drawBallAt(ctx, p.x, p.y, R * p.s, false);
    }
    ctx.restore();
    // rolled white lip
    ctx.strokeStyle = c.dim ? '#d8d2c8' : '#fbf8f2';
    ctx.lineWidth = Math.max(1, top[0].s * CUP.lip * 1.8);
    ctx.beginPath(); top.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }

  // ---------- ball ----------
  function drawBallAt(ctx, x, y, r, hot) {
    r = Math.max(1.4, r);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    if (hot) { g.addColorStop(0, '#fff7e0'); g.addColorStop(0.55, '#ffb347'); g.addColorStop(1, '#d9531e'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#f1eee8'); g.addColorStop(1, '#a9a49c'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function drawShadow(ctx, cam, p) {
    // the ball's shadow on the table is how you read depth in flight
    if (p[1] < -0.05 || p[0] < TABLE.x0 || p[0] > TABLE.x1 || p[2] < TABLE.z0 || p[2] > TABLE.z1) return;
    const q = project(cam, [p[0], 0.003, p[2]]);
    if (!q) return;
    const k = Math.max(0.25, 1 - p[1] / 4);
    ctx.fillStyle = `rgba(0,0,0,${(0.42 * k).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, R * q.s * 1.3, R * q.s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- people ----------
  /* A person standing at an end of the table. pose: 'idle' | 'wave' | 'ready'
     (hands over the table) | 'swat' | 'blow' | 'throw' | 'cheer'. side: 'far' or 'near'. */
  function drawPerson(ctx, cam, who, side, pose, k, t) {
    const zf = side === 'far' ? 9.6 : -0.75;
    const fwd = side === 'far' ? -1 : 1;
    const x0 = who.x || 0;
    // everyone leans over the table a little; blowing and swatting lean further
    const lean = 1.1 + (pose === 'blow' ? 0.55 * k : pose === 'ready' || pose === 'swat' ? 0.25 : pose === 'throw' ? 0.2 * k : pose === 'fold' ? -0.2 : 0);
    const drop = pose === 'blow' ? 0.45 * k : pose === 'fold' ? -0.1 : 0;
    const P = (x, y, dz) => [x0 + x, y, zf + fwd * dz];
    const J = {};
    J.hipL = P(-0.33, 0.55, 0); J.hipR = P(0.33, 0.55, 0);
    const shY = 1.7 - drop, shZ = lean;
    J.shL = P(-0.5, shY, shZ); J.shR = P(0.5, shY, shZ);
    J.neck = P(0, shY + 0.12, shZ + 0.08); J.head = P(0, shY + 0.5, shZ + 0.2);
    const arm = (sd, el, ha) => { J['el' + sd] = el; J['ha' + sd] = ha; };
    const s = Math.sin(t * 7.5);
    if (pose === 'wave') {
      const up = k; // 0 down .. 1 up
      arm('L', P(-0.9, shY - 0.45 + up * 1.0, shZ + 0.1 - up * 0.1), P(-0.95 - up * 0.15 + s * 0.15 * up, shY - 0.95 + up * 2.25, shZ + 0.3 - up * 0.2));
      arm('R', P(0.9, shY - 0.45 + up * 1.0, shZ + 0.1 - up * 0.1), P(0.95 + up * 0.15 - s * 0.15 * up, shY - 0.95 + up * 2.25, shZ + 0.3 - up * 0.2));
    } else if (pose === 'ready') {
      arm('L', P(-0.8, shY - 0.45, shZ + 0.45), P(-0.5, 0.95, shZ + 1.15));
      arm('R', P(0.8, shY - 0.45, shZ + 0.45), P(0.5, 0.95, shZ + 1.15));
    } else if (pose === 'swat') {
      arm('L', P(-0.8, shY - 0.45, shZ + 0.45), P(-0.5, 0.95, shZ + 1.15));
      arm('R', P(0.85, shY - 0.6, shZ + 0.55), P(0.35 - k * 1.25, 0.55, shZ + 1.6));
    } else if (pose === 'throw') {
      arm('L', P(-0.7, shY - 0.5, shZ + 0.1), P(-0.6, shY - 1.0, shZ + 0.3));
      arm('R', P(0.7, shY + 0.15, shZ + 0.35 + k * 0.3), P(0.35, shY + 0.05, shZ + 0.75 + k * 0.5));
    } else if (pose === 'cheer') {
      arm('L', P(-0.85, shY + 0.45, shZ), P(-0.9 + s * 0.08, shY + 1.2, shZ));
      arm('R', P(0.85, shY + 0.45, shZ), P(0.9 - s * 0.08, shY + 1.2, shZ));
    } else if (pose === 'fold') {
      arm('L', P(-0.7, shY - 0.65, shZ + 0.2), P(0.3, shY - 0.55, shZ + 0.4));
      arm('R', P(0.7, shY - 0.65, shZ + 0.2), P(-0.3, shY - 0.45, shZ + 0.4));
    } else {
      // arms hanging easy at his sides
      arm('L', P(-0.62, shY - 0.58, shZ + 0.1), P(-0.46, shY - 1.0, shZ + 0.38));
      arm('R', P(0.62, shY - 0.58, shZ + 0.1), P(0.46, shY - 1.0, shZ + 0.38));
    }
    const Q = {};
    for (const key in J) { const q = project(cam, J[key]); if (!q) return; Q[key] = q; }
    ctx.save();
    ctx.filter = 'brightness(0.78) saturate(0.85)';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const limb = (a, b, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, w * (Q[a].s + Q[b].s) / 2); ctx.beginPath(); ctx.moveTo(Q[a].x, Q[a].y); ctx.lineTo(Q[b].x, Q[b].y); ctx.stroke(); };
    // torso
    ctx.fillStyle = who.shirt;
    ctx.beginPath();
    const sw = Q.shL.s * 0.1;
    ctx.moveTo(Q.shL.x - sw, Q.shL.y); ctx.lineTo(Q.shR.x + sw, Q.shR.y); ctx.lineTo(Q.hipR.x + sw, Q.hipR.y); ctx.lineTo(Q.hipL.x - sw, Q.hipL.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.moveTo((Q.shL.x + Q.shR.x) / 2, Q.shL.y); ctx.lineTo(Q.shR.x + sw, Q.shR.y); ctx.lineTo(Q.hipR.x + sw, Q.hipR.y); ctx.lineTo((Q.hipL.x + Q.hipR.x) / 2, Q.hipR.y); ctx.closePath(); ctx.fill();
    // arms
    limb('shL', 'elL', 0.3, who.shirt); limb('elL', 'haL', 0.24, who.skin);
    limb('shR', 'elR', 0.3, who.shirt); limb('elR', 'haR', 0.24, who.skin);
    ctx.fillStyle = who.skin;
    ['haL', 'haR'].forEach(j => { ctx.beginPath(); ctx.arc(Q[j].x, Q[j].y, Q[j].s * 0.15, 0, Math.PI * 2); ctx.fill(); });
    // neck, head, hair
    limb('neck', 'head', 0.26, who.skin);
    const hr = Q.head.s * 0.34;
    ctx.fillStyle = who.skin; ctx.beginPath(); ctx.ellipse(Q.head.x, Q.head.y, hr * 0.86, hr, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = who.hair; ctx.beginPath(); ctx.ellipse(Q.head.x, Q.head.y - hr * 0.42, hr * 0.9, hr * 0.62, 0, Math.PI, Math.PI * 2); ctx.fill();
    if (side === 'far') {
      // face: eyes, and puffed cheeks when blowing
      ctx.fillStyle = '#16110f';
      [-1, 1].forEach(d => { ctx.beginPath(); ctx.arc(Q.head.x + d * hr * 0.3, Q.head.y - hr * 0.05, Math.max(0.8, hr * 0.08), 0, Math.PI * 2); ctx.fill(); });
      if (pose === 'blow' && k > 0.3) { ctx.beginPath(); ctx.arc(Q.head.x, Q.head.y + hr * 0.42, hr * 0.14, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.lineWidth = Math.max(0.8, hr * 0.06); ctx.strokeStyle = '#16110f'; ctx.beginPath(); ctx.arc(Q.head.x, Q.head.y + hr * 0.25, hr * 0.22, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
    }
    ctx.restore();
  }

  return { VIEWS, viewCam, toCam, project, fillPoly, seg, drawRoom, drawTable, drawCup, drawBallAt, drawShadow, drawPerson, NEAR };
})();
