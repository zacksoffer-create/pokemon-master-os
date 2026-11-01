/* Option Arcade: drawing. Two cameras:
   - side: a slightly raised sideline view; the offense runs left to right, the field's width runs down the screen.
   - a22: the All-22 end-zone angle, high behind the offense looking downfield, in perspective, so you can see the routes
     and the safeties: the offense runs up the screen.
   Players are simple stand-up figures whose shoulders and facemask show which way they're facing: that's how you read
   an end crashing in or sitting square. proj() returns [screen x, screen y, pixels per yard at that spot]. */
const FBView = (() => {
  const K = 0.78;            // vertical squash of the field
  const ZK = 0.85;           // how much height lifts things up the screen
  const FIG = 1.3;           // figures are drawn a bit larger than life so they read on a phone
  const COL = {
    O: { jersey: '#1f6f4a', trim: '#f3c74f', pants: '#ece6d6', helmet: '#f3c74f', stripe: '#1f6f4a' },
    D: { jersey: '#8a2438', trim: '#f1f1f1', pants: '#d6d8dd', helmet: '#c8ced8', stripe: '#8a2438' },
  };
  const GRASS = ['#3d8b49', '#378343'];

  function view(W, H, zoom, mode) {
    // side: portrait about 17 yards across the screen; landscape about 21 yards of the field's width top to bottom
    const S = Math.max(11, Math.min(34, Math.min(W / 17, H / 21))) * (zoom || 1);
    const v = { W, H, S, S0: S, zf: 1, cx: 2, cy: 0, ax: 0.5, ay: 0.5, shake: 0, zoom: zoom || 1, mode: mode || 'side' };
    setMode(v, v.mode);
    return v;
  }
  // the All-22 camera: portrait looks down steeply so the depth of the field spreads up the tall screen;
  // landscape sits lower and wider
  function setMode(v, mode) {
    v.mode = mode;
    if (mode !== 'a22') return;
    const portrait = v.H > v.W * 1.15;
    // tuned so the QB sits near the bottom and 30 yards downfield near the top: portrait about 30 yards wide at the line,
    // landscape nearly the whole width of the field
    v.pitch = portrait ? 1.08 : 0.6;
    v.dist = portrait ? 44 : 40;
    v.Sf = Math.max(7, Math.min(30, portrait ? v.W / 34 : v.H / 28)) * v.zoom;
    v.ay = portrait ? 0.58 : 0.42;
    aimCam(v);
  }
  function aimCam(v) {
    const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    v.cam = { cp, sp, px: v.cx - cp * v.dist, py: v.cy, pz: sp * v.dist, f: v.Sf * v.dist };
  }
  function proj(v, x, y, z) {
    z = z || 0;
    if (v.mode === 'a22') {
      const c = v.cam, rx = x - c.px, rz = z - c.pz;
      const depth = Math.max(0.6, rx * c.cp - rz * c.sp), up = rx * c.sp + rz * c.cp;
      return [v.W / 2 + (c.f * (y - c.py)) / depth + (v.shakeX || 0), v.H * v.ay - (c.f * up) / depth + (v.shakeY || 0), c.f / depth];
    }
    return [v.W * v.ax + (x - v.cx) * v.S + (v.shakeX || 0), v.H * v.ay + (y - v.cy) * v.S * K - z * v.S * ZK + (v.shakeY || 0), v.S];
  }
  // a ground-level circle seen from this camera is this much flatter than it is wide
  const squash = v => (v.mode === 'a22' ? Math.sin(v.pitch) * 0.9 : K);
  // the screen direction a field direction points, scaled the way the camera foreshortens it
  function screenDir(v, x, y, a) {
    const [x0, y0, sc] = proj(v, x, y, 0), [x1, y1] = proj(v, x + Math.cos(a) * 0.5, y + Math.sin(a) * 0.5, 0);
    return [(x1 - x0) / (0.5 * sc), (y1 - y0) / (0.5 * sc)];
  }
  // where the camera wants to be: framing the backfield and the reads before the exchange, then riding with the ball
  // pass plays pull the camera back so the whole route tree fits, until somebody has the ball in the open field
  function zoomWant(v, P) {
    const passView = P.play === 'pass' && (P.phase !== 'run' || P.ball.st === 'pass' || (P.carrier === P.by.QB && !P.scramble) || (P.phase === 'dead' && !P.caught && !P.scramble));
    if (!passView) return 1;
    return v.H > v.W * 1.15 ? 0.62 : 0.85;
  }
  function camTargetA22(v, P) {
    // the focus point: downfield of the play so you see what's coming
    let x, y;
    const b = P.carrier || (P.ball.st === 'air' || P.ball.st === 'loose' ? P.ball : null);
    if (P.play === 'pass' && (P.phase !== 'run' || (P.carrier === P.by.QB && !P.scramble))) { x = 9; y = Math.abs(P.by.QB.y) > 5 ? P.by.QB.y * 0.5 : 0; }
    else if (P.play === 'pass' && P.ball.st === 'pass') { x = Math.max(9, P.ball.tx * 0.6 + P.ball.x * 0.4 + 2); y = P.ball.ty * 0.4; }
    else if (P.phase === 'pre' || P.phase === 'cadence' || P.phase === 'mesh' || !b) {
      x = 6; y = P.s * (P.play === 'pass' ? 0 : 2);
      if (P.phase === 'dead' && P.result) { x = Math.max(6, P.result.x + 4); y = ((P.carrier || P.ball).y || 0) * 0.6; }
    } else { x = Math.max(6, b.x + 7); y = b.y * 0.7; }
    const half = v.W / 2 / v.Sf, lim = 26.65 + 2 - half;
    y = lim > 0 ? Math.max(-lim, Math.min(lim, y)) : 0;
    return [x, y];
  }
  function camTarget(v, P) {
    if (v.mode === 'a22') return camTargetA22(v, P);
    const visX = v.W / v.S, visY = v.H / (v.S * K);
    let x, y;
    const b = P.carrier || (P.ball.st === 'air' || P.ball.st === 'loose' ? P.ball : null);
    if (P.play === 'pass' && (P.phase === 'pre' || P.phase === 'cadence' || P.phase === 'mesh' || (P.carrier === P.by.QB && !P.scramble))) {
      // the pocket and the routes: a steady frame with the QB near the left edge; it only slides if he scrambles away
      const wantVis = v.W / (v.S0 * zoomWant(v, P));
      x = Math.max(-6.5, P.by.QB.x + 1) - 1 + wantVis * 0.3;
      y = Math.abs(P.by.QB.y) > 6 ? P.by.QB.y * 0.6 : 0;
    } else if (P.play === 'pass' && P.ball.st === 'pass') {
      x = P.ball.x * 0.45 + P.ball.tx * 0.55 + 1; y = P.ball.y * 0.45 + P.ball.ty * 0.55;
    } else if (P.phase === 'pre' || P.phase === 'cadence' || P.phase === 'mesh' || !b) {
      x = P.play === 'triple' ? 1.2 : P.play === 'jet' ? -0.8 : -0.6;
      y = P.s * (P.play === 'triple' ? 2.6 : P.play === 'jet' ? 2.5 : 1.2);
      if (P.phase === 'dead' && P.result) { x = P.result.x; y = (P.carrier || P.ball).y || 0; }
    } else {
      x = b.x + Math.min(6, visX * 0.17);
      y = b.y * 0.9;
    }
    // portrait: keep the action in the upper middle, above the thumbs
    const portrait = v.H > v.W * 1.15;
    v.ay = portrait ? 0.44 : 0.5;
    const half = visY / 2, lim = 26.65 + 3 - half;
    y = lim > 0 ? Math.max(-lim, Math.min(lim, y)) : 0;
    return [x, y];
  }
  function follow(v, P, dt, snap) {
    const zw = v.mode === 'a22' ? 1 : zoomWant(v, P);
    v.zf = snap ? zw : v.zf + (zw - v.zf) * (1 - Math.exp(-dt * 2.2));
    v.S = v.S0 * v.zf;
    const [tx, ty] = camTarget(v, P);
    const passGlide = P.play === 'pass' && (P.ball.st === 'pass' || P.carrier === P.by.QB);
    const k = snap ? 1 : 1 - Math.exp(-dt * (passGlide ? 2.4 : P.phase === 'run' ? 5 : 3));
    v.cx += (tx - v.cx) * k; v.cy += (ty - v.cy) * k;
    if (v.mode === 'a22') aimCam(v);
    if (v.shake > 0) { v.shake = Math.max(0, v.shake - dt * 2.5); v.shakeX = (Math.random() - 0.5) * v.shake * 10; v.shakeY = (Math.random() - 0.5) * v.shake * 10; }
    else v.shakeX = v.shakeY = 0;
  }

  // ------------------------------------------------------------------ the field
  function fieldA22(g, v, spot, opts) {
    const { W, H } = v, side = 26.65, c = v.cam;
    g.fillStyle = '#1b2a22'; g.fillRect(0, 0, W, H);
    // nothing behind the camera: the nearest x that's still in front of it
    const xNear = c.px + (1.2 - c.pz * c.sp) / c.cp;
    const x0 = Math.max(xNear, v.cx - 40), x1 = v.cx + 75;
    const P = (x, y, z) => proj(v, x, y, z);
    const quad = (xa, ya, xb, yb, fill) => {
      xa = Math.max(xa, x0); xb = Math.min(xb, x1); if (xb <= xa) return;
      const a = P(xa, ya), b = P(xb, ya), cc = P(xb, yb), d = P(xa, yb);
      g.fillStyle = fill; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
    };
    const line = (xa, ya, xb, yb) => {
      if (Math.max(xa, xb) < x0) return;
      if (xa < x0) { ya += (yb - ya) * (x0 - xa) / (xb - xa); xa = x0; }
      if (xb < x0) { yb += (ya - yb) * (x0 - xb) / (xa - xb); xb = x0; }
      const a = P(xa, ya), b = P(xb, yb); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    };
    // around the field: grass, then the track
    quad(-200, -side - 8, 200, side + 8, '#2a3a30');
    quad(-200, -side - 6.5, 200, -side - 5, '#7b4a36'); quad(-200, side + 5, 200, side + 6.5, '#7b4a36');
    for (let X = Math.max(-10, Math.floor((spot + x0) / 5) * 5); X < Math.min(110, spot + x1); X += 5) {
      quad(X - spot, -side, X + 5 - spot, side, X < 0 ? '#1f5f40' : X >= 100 ? '#6a2333' : GRASS[((X / 5) % 2 + 2) % 2]);
    }
    for (const [X0, word, col] of [[-10, opts.home || 'HOME', '#e9d58a'], [100, opts.away || 'OPTION', '#f1d2d8']]) {
      const xm = X0 + 5 - spot; if (xm < x0 || xm > x1) continue;
      const [ex, ey, sc] = P(xm, 0);
      g.save(); g.translate(ex, ey); g.scale(1, squash(v)); g.font = `900 ${sc * 3.4}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = col; g.globalAlpha = 0.5; g.fillText(word, 0, 0); g.restore();
    }
    g.strokeStyle = 'rgba(255,255,255,0.82)';
    for (let X = Math.max(0, Math.ceil((spot + x0) / 5) * 5); X <= Math.min(100, spot + x1); X += 5) {
      g.lineWidth = Math.max(1, P(X - spot, 0)[2] * 0.12); line(X - spot, -side, X - spot, side);
    }
    for (let X = Math.max(1, Math.ceil(spot + x0)); X <= Math.min(99, spot + x1); X++) {
      if (X % 5 === 0) continue;
      g.lineWidth = Math.max(0.8, P(X - spot, 0)[2] * 0.08);
      for (const hy of [-8.9, 8.9, -side + 0.6, side - 0.6]) line(X - spot, hy - 0.3, X - spot, hy + 0.3);
    }
    g.fillStyle = 'rgba(255,255,255,0.78)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let X = 10; X <= 90; X += 10) {
      const xm = X - spot; if (xm < x0 || xm > x1) continue;
      for (const ny of [-side + 8, side - 8]) {
        const [nx, nyy, sc] = P(xm, ny);
        g.save(); g.translate(nx, nyy); g.rotate(ny < 0 ? Math.PI / 2 : -Math.PI / 2); g.scale(1, 1);
        g.font = `800 ${sc * 1.9}px system-ui, sans-serif`; g.fillText(String(X <= 50 ? X : 100 - X).split('').join(' '), 0, 0); g.restore();
      }
    }
    g.strokeStyle = '#ffffff';
    g.lineWidth = Math.max(1.5, P(v.cx, side)[2] * 0.2);
    line(x0, -side, x1, -side); line(x0, side, x1, side);
    for (const X of [0, 100]) line(X - spot, -side, X - spot, side);
    g.strokeStyle = 'rgba(80,160,255,0.85)'; g.lineWidth = Math.max(2, P(0, 0)[2] * 0.16); line(0, -side, 0, side);
    if (opts.firstDown != null && opts.firstDown < 100 - spot) { g.strokeStyle = 'rgba(255,214,74,0.9)'; line(opts.firstDown, -side, opts.firstDown, side); }
  }
  function field(g, v, spot, opts) {
    if (v.mode === 'a22') return fieldA22(g, v, spot, opts);
    const { W, H, S } = v;
    g.fillStyle = '#1b2a22';
    g.fillRect(0, 0, W, H);
    const x0 = v.cx - (W * v.ax) / S - 2, x1 = v.cx + (W * (1 - v.ax)) / S + 2;     // relative to the line of scrimmage
    const side = 26.65, top = proj(v, 0, -side)[1], bot = proj(v, 0, side)[1];
    // the area around the field: a running track and the bench side
    g.fillStyle = '#2a3a30'; g.fillRect(0, top - 4.5 * S * K, W, 4.5 * S * K); g.fillRect(0, bot, W, 4.5 * S * K);
    g.fillStyle = '#7b4a36'; g.fillRect(0, top - 4.5 * S * K, W, 1.4 * S * K); g.fillRect(0, bot + 3.1 * S * K, W, 1.4 * S * K);
    // mowed stripes every five yards
    const a0 = Math.floor((spot + x0) / 5) * 5, a1 = spot + x1;
    for (let X = Math.max(-10, a0); X < Math.min(110, a1); X += 5) {
      const sx0 = proj(v, X - spot, 0)[0], sx1 = proj(v, X + 5 - spot, 0)[0];
      g.fillStyle = X < 0 || X >= 100 ? (X < 0 ? '#1f5f40' : '#6a2333') : GRASS[((X / 5) % 2 + 2) % 2];
      g.fillRect(sx0, top, sx1 - sx0 + 1, bot - top);
    }
    // end zones: a word in each
    g.save();
    for (const [X0, word, col] of [[-10, opts.home || 'HOME', '#e9d58a'], [100, opts.away || 'OPTION', '#f1d2d8']]) {
      const ex = proj(v, X0 + 5 - spot, 0)[0];
      if (ex < -S * 12 || ex > W + S * 12) continue;
      g.save(); g.translate(ex, (top + bot) / 2); g.rotate(X0 < 0 ? -Math.PI / 2 : Math.PI / 2); g.scale(1, K);
      g.font = `900 ${S * 3.6}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = col; g.globalAlpha = 0.5; g.fillText(word, 0, 0); g.restore();
    }
    g.restore();
    // yard lines, hashes, numbers
    g.strokeStyle = 'rgba(255,255,255,0.82)'; g.lineWidth = Math.max(1.2, S * 0.1);
    for (let X = Math.max(0, Math.ceil((spot + x0) / 5) * 5); X <= Math.min(100, a1); X += 5) {
      const sx = proj(v, X - spot, 0)[0];
      g.beginPath(); g.moveTo(sx, top); g.lineTo(sx, bot); g.stroke();
    }
    g.lineWidth = Math.max(1, S * 0.07);
    for (let X = Math.max(1, Math.ceil(spot + x0)); X <= Math.min(99, a1); X++) {
      if (X % 5 === 0) continue;
      const sx = proj(v, X - spot, 0)[0];
      for (const hy of [-8.9, 8.9]) { const yy = proj(v, 0, hy)[1]; g.beginPath(); g.moveTo(sx, yy - S * 0.28 * K); g.lineTo(sx, yy + S * 0.28 * K); g.stroke(); }
      for (const hy of [-side + 0.6, side - 0.6]) { const yy = proj(v, 0, hy)[1]; g.beginPath(); g.moveTo(sx, yy - S * 0.3 * K); g.lineTo(sx, yy + S * 0.3 * K); g.stroke(); }
    }
    g.fillStyle = 'rgba(255,255,255,0.78)';
    g.font = `800 ${S * 1.9}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let X = 10; X <= 90; X += 10) {
      if (X < spot + x0 - 3 || X > a1 + 3) continue;
      const n = X <= 50 ? X : 100 - X, sx = proj(v, X - spot, 0)[0];
      for (const ny of [-side + 8, side - 8]) {
        const yy = proj(v, 0, ny)[1];
        g.save(); g.translate(sx, yy); g.scale(1, K); g.fillText(String(n).split('').join(' '), 0, 0); g.restore();
      }
    }
    // sidelines and goal lines
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2, S * 0.22);
    g.beginPath(); g.moveTo(0, top); g.lineTo(W, top); g.moveTo(0, bot); g.lineTo(W, bot); g.stroke();
    for (const X of [0, 100]) { const sx = proj(v, X - spot, 0)[0]; if (sx > -10 && sx < W + 10) { g.beginPath(); g.moveTo(sx, top); g.lineTo(sx, bot); g.stroke(); } }
    // line of scrimmage (blue) and the line to gain (gold)
    const los = proj(v, 0, 0)[0];
    g.strokeStyle = 'rgba(80,160,255,0.85)'; g.lineWidth = Math.max(2, S * 0.16);
    g.beginPath(); g.moveTo(los, top); g.lineTo(los, bot); g.stroke();
    if (opts.firstDown != null && opts.firstDown < 100 - spot) {
      const fd = proj(v, opts.firstDown, 0)[0];
      g.strokeStyle = 'rgba(255,214,74,0.9)';
      g.beginPath(); g.moveTo(fd, top); g.lineTo(fd, bot); g.stroke();
    }
  }

  // ------------------------------------------------------------------ people
  function ell(g, x, y, rx, ry, rot, fill) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  function player(g, v, p, o) {
    const c = COL[p.team];
    const [sx, sy0, sc] = proj(v, p.x, p.y, 0);
    const u = sc * FIG * 0.62 * (v.mode === 'a22' ? 1.25 : 1);
    const sy = proj(v, p.x, p.y, p.z || 0)[1];
    if (sx < -u * 3 || sx > v.W + u * 3 || sy < -u * 4 || sy > v.H + u * 3) return;
    const f = p.face, [fx, fy] = screenDir(v, p.x, p.y, f);
    const SQ = squash(v);
    // rings: you, and the defenders you're reading
    if (o.ctrl) {
      const pulse = 0.85 + Math.sin(o.t * 7) * 0.1;
      g.strokeStyle = '#ffd84a'; g.lineWidth = Math.max(2, u * 0.16);
      g.beginPath(); g.ellipse(sx, sy0, u * 1.05 * pulse, u * 1.05 * SQ * 0.55 * pulse, 0, 0, Math.PI * 2); g.stroke();
    }
    if (o.key) {
      g.strokeStyle = o.key === 1 ? '#5cc8ff' : '#ff9d4a'; g.lineWidth = Math.max(2, u * 0.14);
      g.setLineDash([u * 0.35, u * 0.25]);
      g.beginPath(); g.ellipse(sx, sy0, u * 1.1, u * 1.1 * SQ * 0.56, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    ell(g, sx, sy0, u * 0.62 * (1 - (p.z || 0) * 0.3), u * 0.24 * (1 - (p.z || 0) * 0.3), 0, 'rgba(0,0,0,0.28)');
    if (p.st === 'down') {
      // on the ground, stretched out the way he was going
      const hd = screenDir(v, p.x, p.y, p.h), rot = Math.atan2(hd[1], hd[0]);
      ell(g, sx, sy - u * 0.12, u * 0.85, u * 0.3, rot, c.jersey);
      ell(g, sx + Math.cos(rot) * u * 0.85, sy - u * 0.15 + Math.sin(rot) * u * 0.85, u * 0.26, u * 0.24, 0, c.helmet);
      return;
    }
    const lean = p.st === 'lunge' ? 0.42 : p.truck > 0 ? 0.3 : p.eng ? 0.22 : Math.min(0.18, p.v * 0.02);
    const bx = sx + fx * u * lean, by = sy;
    // legs
    const run = Math.min(1, p.v / 2.5), sw = Math.sin(p.anim * 2.6) * u * 0.32 * run;
    g.strokeStyle = c.pants; g.lineCap = 'round'; g.lineWidth = u * 0.24;
    for (const k of [-1, 1]) {
      const hx = bx - fy * u * 0.16 * k, hy = by - u * 0.62 + fx * u * 0.06 * k;
      const s = sw * k;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(sx - fy * u * 0.16 * k + fx * s, sy - u * 0.05 + fy * s * 0.6); g.stroke();
    }
    // torso and shoulder pads, turned to where he's facing
    const sd = screenDir(v, p.x, p.y, f + Math.PI / 2), shoulder = Math.atan2(sd[1], sd[0]);
    ell(g, bx + fx * u * 0.05, by - u * 0.82, u * 0.36, u * 0.4, 0, c.jersey);
    ell(g, bx + fx * u * 0.08, by - u * 1.08, u * 0.58, u * 0.25, shoulder, c.jersey);
    g.strokeStyle = c.trim; g.lineWidth = Math.max(1, u * 0.07);
    g.beginPath(); g.ellipse(bx + fx * u * 0.08, by - u * 1.08, u * 0.58, u * 0.25, shoulder, 0, Math.PI * 2); g.stroke();
    // arms: reaching for a tackle, locked on a block, or carrying
    const arms = p.st === 'lunge' || p.eng ? 0.75 : 0;
    if (arms) {
      g.strokeStyle = c.jersey; g.lineWidth = u * 0.2;
      for (const k of [-1, 1]) {
        const ax = bx - fy * u * 0.42 * k, ay = by - u * 1.05 + fx * u * 0.1 * k;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + fx * u * arms, ay + fy * u * arms * 0.7 + u * 0.08); g.stroke();
      }
    }
    // number on the jersey when there's room
    if (u > 13 && o.num) {
      g.fillStyle = c.trim; g.font = `800 ${u * 0.42}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(o.num, bx + fx * u * 0.04, by - u * 0.82);
    }
    // helmet, with the facemask on the side he's looking
    const hx = bx + fx * u * 0.14, hy = by - u * 1.42;
    ell(g, hx, hy, u * 0.29, u * 0.29, 0, c.helmet);
    g.strokeStyle = c.stripe; g.lineWidth = Math.max(1, u * 0.08);
    g.beginPath(); g.moveTo(hx - fx * u * 0.26, hy - u * 0.12); g.quadraticCurveTo(hx, hy - u * 0.32, hx + fx * u * 0.26, hy - u * 0.12); g.stroke();
    if (fy > -0.55) {
      g.strokeStyle = '#59606b'; g.lineWidth = Math.max(1.4, u * 0.11);
      const mx = hx + fx * u * 0.24, my = hy + fy * u * 0.18 + u * 0.06;
      g.beginPath(); g.moveTo(mx - fy * u * 0.16, my + fx * u * 0.1); g.lineTo(mx + fy * u * 0.16, my - fx * u * 0.1); g.stroke();
    }
    if (o.key) {
      g.fillStyle = o.key === 1 ? '#5cc8ff' : '#ff9d4a'; g.font = `900 ${u * 0.55}px system-ui, sans-serif`; g.textAlign = 'center';
      g.fillText(String(o.key), hx, hy - u * 0.62);
    }
  }
  function ball(g, v, B, P, t) {
    if (!B || B.st === 'dead' && !P.carrier) { if (!B || B.x == null) return; }
    const u = proj(v, B.x, B.y, 0)[2] * FIG * 0.62 * (v.mode === 'a22' ? 1.25 : 1);
    const [gx, gy] = proj(v, B.x, B.y, 0);
    if (B.z > 0.4 && B.st !== 'held' && B.st !== 'exchange') ell(g, gx, gy, u * 0.24, u * 0.1, 0, 'rgba(0,0,0,0.3)');
    const [sx, sy] = proj(v, B.x, B.y, B.z == null ? 1 : B.z);
    const spin = B.st === 'air' || B.st === 'loose' ? t * 14 : 0.3;
    ell(g, sx, sy, u * 0.27, u * 0.16, spin, '#7a4320');
    g.strokeStyle = '#f4efe6'; g.lineWidth = Math.max(1, u * 0.05);
    g.beginPath(); g.moveTo(sx - Math.cos(spin) * u * 0.1, sy - Math.sin(spin) * u * 0.1); g.lineTo(sx + Math.cos(spin) * u * 0.1, sy + Math.sin(spin) * u * 0.1); g.stroke();
  }

  // ------------------------------------------------------------------ pass plays: routes and the throw
  function routes(g, v, P, alpha) {
    const list = FB.routeArt(P);
    g.save(); g.globalAlpha = alpha; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of list) {
      g.strokeStyle = r.id === 'RB' ? '#bfe9ff' : '#ffffff'; g.lineWidth = Math.max(2, v.S * 0.13);
      g.beginPath();
      r.pts.forEach(([x, y], i) => { const [px, py] = proj(v, x, y, 0); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
      g.stroke();
      // arrowhead, or a bar where he settles
      const n = r.pts.length, [ax, ay] = proj(v, r.pts[n - 2][0], r.pts[n - 2][1], 0), [bx, by] = proj(v, r.pts[n - 1][0], r.pts[n - 1][1], 0);
      const a = Math.atan2(by - ay, bx - ax), k = v.S * 0.55;
      g.beginPath();
      if (r.sit) { g.moveTo(bx - Math.sin(a) * k, by + Math.cos(a) * k); g.lineTo(bx + Math.sin(a) * k, by - Math.cos(a) * k); }
      else { g.moveTo(bx - Math.cos(a - 0.5) * k, by - Math.sin(a - 0.5) * k); g.lineTo(bx, by); g.lineTo(bx - Math.cos(a + 0.5) * k, by - Math.sin(a + 0.5) * k); }
      g.stroke();
    }
    g.restore();
  }
  function aim(g, v, from, to) {
    const dd = Math.hypot(to.x - from.x, to.y - from.y), peak = 0.35 + dd * 0.075;
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = Math.max(2, v.S * 0.12); g.setLineDash([v.S * 0.35, v.S * 0.3]);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const f = i / 24, [px, py] = proj(v, from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f, 1.9 + (1.3 - 1.9) * f + peak * 4 * f * (1 - f));
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.stroke(); g.setLineDash([]);
    const [lx, ly, ls] = proj(v, to.x, to.y, 0), q = squash(v), r = Math.max(ls * 0.9, 9);
    g.strokeStyle = '#ffd84a'; g.lineWidth = Math.max(2.5, ls * 0.15);
    g.beginPath(); g.ellipse(lx, ly, r, r * q, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(lx, ly, r * 0.28, r * 0.28 * q, 0, 0, Math.PI * 2); g.fillStyle = '#ffd84a'; g.fill();
    g.restore();
  }

  // ------------------------------------------------------------------ effects
  function effects(g, v, list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.t += dt;
      const life = e.life || 0.5, k = e.t / life;
      if (k >= 1) { list.splice(i, 1); continue; }
      const [sx, sy, u] = proj(v, e.x, e.y, e.z || 0.9);
      g.save();
      g.globalAlpha = 1 - k;
      if (e.kind === 'ring') {
        g.strokeStyle = e.color || '#fff'; g.lineWidth = Math.max(2, u * 0.18 * (1 - k));
        g.beginPath(); g.ellipse(sx, sy, u * (0.3 + k * (e.size || 1.4)), u * (0.3 + k * (e.size || 1.4)) * 0.7, 0, 0, Math.PI * 2); g.stroke();
      } else if (e.kind === 'dust') {
        for (let j = 0; j < 5; j++) {
          const a = j * 1.3 + e.seed, r = u * (0.2 + k * 0.9);
          ell(g, sx + Math.cos(a) * r, sy + u * 0.8 + Math.sin(a) * r * 0.4, u * 0.18 * (1 - k * 0.5), u * 0.1, 0, 'rgba(225,215,190,0.8)');
        }
      } else if (e.kind === 'text') {
        g.fillStyle = e.color || '#fff'; g.font = `900 ${Math.max(13, u * 0.95)}px system-ui, sans-serif`; g.textAlign = 'center';
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 4;
        g.strokeText(e.text, sx, sy - u * 1.6 - k * u * 1.2); g.fillText(e.text, sx, sy - u * 1.6 - k * u * 1.2);
      } else if (e.kind === 'confetti') {
        for (let j = 0; j < 26; j++) {
          const a = j * 2.39 + e.seed, r = u * (1 + k * 6) * (0.4 + (j % 5) * 0.15);
          g.fillStyle = ['#ffd84a', '#ffffff', '#1f6f4a', '#5cc8ff'][j % 4];
          g.fillRect(sx + Math.cos(a) * r, sy - u * 2 + Math.sin(a) * r * 0.6 + k * k * u * 4, u * 0.22, u * 0.12);
        }
      }
      g.restore();
    }
  }

  // ------------------------------------------------------------------ one frame
  const NUMS = { QB: '7', FB: '33', SL: '4', SR: '21', RB: '22', LT: '72', LG: '64', C: '55', RG: '66', RT: '78', WL: '11', WR: '81', SLOT: '1', TE: '88', JET: '3',
    DTL: '94', DTR: '99', DEL: '91', DER: '97', MLB: '52', OLBL: '44', OLBR: '41', CBL: '24', CBR: '2', SSL: '31', SSR: '8' };
  function frame(g, v, P, o) {
    field(g, v, o.spot, o);
    if (o.routes) routes(g, v, P, o.routes);
    const keys = o.keys ? FB.keys(P) : [];
    const list = P.players.map(p => [proj(v, p.x, p.y, 0)[1], p]).sort((a, b) => a[0] - b[0]).map(e => e[1]);
    // the ball goes in front of whoever it's drawn with
    for (const p of list) player(g, v, p, { ctrl: p === P.ctrl && P.phase !== 'pre', key: keys[0] === p.id ? 1 : keys[1] === p.id ? 2 : 0, t: o.t, num: NUMS[p.id] });
    ball(g, v, P.ball, P, o.t);
    if (o.aim) aim(g, v, P.by.QB, o.aim);
  }

  return { K, view, setMode, proj, follow, frame, effects, field, routes, aim, COL, NUMS };
})();
