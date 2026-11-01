/* Soccer Playmaker: drawing. One camera, high behind the attack and looking down the pitch toward the goal you're
   attacking, in perspective, so you see the runs and the back line in front of you: the attack goes up the screen.
   proj() returns [screen x, screen y, pixels per meter at that spot]. */
const SCView = (() => {
  const FIG = 1.55;          // figures are drawn bigger than life so they read on a phone
  const COL = {
    H: { shirt: '#ffd23f', trim: '#1d2433', shorts: '#1d2433', socks: '#ffd23f', num: '#1d2433' },
    A: { shirt: '#c8384a', trim: '#ffffff', shorts: '#f3f1ea', socks: '#c8384a', num: '#ffffff' },
    HG: { shirt: '#57d9c3', trim: '#0f3d36', shorts: '#0f3d36', socks: '#57d9c3', num: '#0f3d36' },
    AG: { shirt: '#2a2f3a', trim: '#c9f27a', shorts: '#2a2f3a', socks: '#2a2f3a', num: '#c9f27a' },
  };
  const SKIN = ['#e0a77a', '#c68a5a', '#8d5a3a', '#f1c7a1', '#a8714a', '#6e4429'];
  const HAIR = ['#2b1d14', '#4a3020', '#1b1b1b', '#8a5a2b', '#d7b06a', '#141414'];
  const GRASS = ['#3f8e4a', '#398545'];

  function view(W, H, zoom) {
    const v = { W, H, zoom: zoom || 1, cx: 60, cy: 0, shake: 0, shakeX: 0, shakeY: 0 };
    setCam(v);
    return v;
  }
  // portrait looks down steeply so the length of the pitch spreads up the tall screen; landscape sits lower and wider
  function setCam(v) {
    const portrait = v.H > v.W * 1.15;
    v.portrait = portrait;
    v.pitch = portrait ? 0.76 : 0.66;
    v.dist = portrait ? 46 : 64;
    v.Sf = Math.max(5, Math.min(26, portrait ? v.W / 34 : v.H / 30)) * v.zoom;
    v.ay = portrait ? 0.4 : 0.36;
    v.ahead = 14;
    aim(v);
  }
  function aim(v) {
    const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    v.cam = { cp, sp, px: v.cx - cp * v.dist, py: v.cy, pz: sp * v.dist, f: v.Sf * v.dist };
  }
  function proj(v, x, y, z) {
    const c = v.cam, rx = x - c.px, rz = (z || 0) - c.pz;
    const depth = Math.max(0.6, rx * c.cp - rz * c.sp), up = rx * c.sp + rz * c.cp;
    return [v.W / 2 + (c.f * (y - c.py)) / depth + v.shakeX, v.H * v.ay - (c.f * up) / depth + v.shakeY, c.f / depth];
  }
  // a motion on the screen near a spot on the pitch, as a motion on the pitch (meters): undo the camera locally
  function toPitch(v, at, dx, dy) {
    const [x0, y0] = proj(v, at.x, at.y, 0), [x1, y1] = proj(v, at.x + 1, at.y, 0), [x2, y2] = proj(v, at.x, at.y + 1, 0);
    const a = x1 - x0, b = x2 - x0, c = y1 - y0, d = y2 - y0, det = a * d - b * c || 1e-6;
    return { x: (d * dx - b * dy) / det, y: (-c * dx + a * dy) / det };
  }
  // the screen direction a pitch direction points, scaled the way the camera foreshortens it
  function screenDir(v, x, y, a) {
    const [x0, y0, sc] = proj(v, x, y, 0), [x1, y1] = proj(v, x + Math.cos(a) * 0.5, y + Math.sin(a) * 0.5, 0);
    return [(x1 - x0) / (0.5 * sc), (y1 - y0) / (0.5 * sc)];
  }
  // where the camera wants to be: up the pitch from the ball, so you see what's in front of you
  function camTarget(v, P) {
    const b = P.ball;
    let x = b.x, y = b.y;
    if (b.st === 'pass') { x = b.x * 0.5 + b.tx * 0.5; y = b.y * 0.5 + b.ty * 0.5; }
    if (b.st === 'shot' || (P.phase !== 'live' && P.result && /goal|saved|wide|over|post|claimed/.test(P.result.how))) x = Math.max(x, 92);
    x = Math.max(30, Math.min(SC.LEN - 13, x + v.ahead));
    const half = v.W / 2 / v.Sf, lim = SC.HALF + 3 - half * 0.9;
    y = lim > 0 ? Math.max(-lim, Math.min(lim, y * 0.6)) : 0;
    return [x, y];
  }
  function follow(v, P, dt, snap) {
    const [tx, ty] = camTarget(v, P);
    const k = snap ? 1 : 1 - Math.exp(-dt * (P.ball.st === 'pass' ? 2.2 : 3.2));
    v.cx += (tx - v.cx) * k; v.cy += (ty - v.cy) * k;
    if (v.shake > 0) { v.shake = Math.max(0, v.shake - dt * 2.5); v.shakeX = (Math.random() - 0.5) * v.shake * 10; v.shakeY = (Math.random() - 0.5) * v.shake * 10; }
    else v.shakeX = v.shakeY = 0;
    aim(v);
  }

  // ------------------------------------------------------------------ the pitch
  function pitch(g, v) {
    const { W, H } = v, c = v.cam, L = SC.LEN, HW = SC.HALF;
    g.fillStyle = '#16301f'; g.fillRect(0, 0, W, H);
    // nothing behind the camera: the nearest x that's still in front of it
    const xNear = c.px + (1.4 - c.pz * c.sp) / c.cp;
    const x0 = Math.max(xNear, -6), x1 = L + 12;
    const quad = (xa, ya, xb, yb, fill) => {
      xa = Math.max(xa, x0); xb = Math.min(xb, x1); if (xb <= xa) return;
      const a = proj(v, xa, ya), b = proj(v, xb, ya), cc = proj(v, xb, yb), d = proj(v, xa, yb);
      g.fillStyle = fill; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
    };
    // the run-off around the pitch, then mowing stripes across it
    quad(-6, -HW - 6, L + 12, HW + 6, '#2f6e3b');
    const band = L / 18;
    for (let i = 0; i < 18; i++) quad(i * band, -HW, (i + 1) * band, HW, GRASS[i % 2]);
    // the lines
    const lw = s => Math.max(1, s * 0.12);
    g.strokeStyle = 'rgba(255,255,255,0.86)'; g.lineCap = 'round'; g.lineJoin = 'round';
    const seg = (pts, close) => {
      // a polyline on the ground, cut where it goes behind the camera
      let open = false;
      g.beginPath();
      const list = close ? pts.concat([pts[0]]) : pts;
      for (let i = 0; i < list.length; i++) {
        let [x, y] = list[i];
        if (x < x0) {
          const prev = list[i - 1], next = list[i + 1];
          const other = prev && prev[0] >= x0 ? prev : next && next[0] >= x0 ? next : null;
          if (!other) { open = false; continue; }
          const t = (x0 - x) / (other[0] - x); x = x0; y = y + (other[1] - y) * t;
          const p = proj(v, x, y);
          if (open) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
          open = other === next;
          continue;
        }
        const p = proj(v, x, y);
        if (open) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
        open = true;
      }
      g.stroke();
    };
    const arc = (cx, cy, r, a0, a1, n) => { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; };
    const mid = proj(v, Math.max(x0, L / 2), 0)[2];
    g.lineWidth = lw(mid);
    seg([[0, -HW], [L, -HW], [L, HW], [0, HW]], true);
    seg([[L / 2, -HW], [L / 2, HW]]);
    seg(arc(L / 2, 0, 9.15, 0, Math.PI * 2, 48), false);
    for (const [gx, s] of [[L, -1], [0, 1]]) {
      const bx = gx + s * 16.5, sx = gx + s * 5.5, spot = gx + s * 11;
      g.lineWidth = lw(proj(v, Math.max(x0, gx + s * 8), 0)[2]);
      seg([[gx, -SC.BOX_HW], [bx, -SC.BOX_HW], [bx, SC.BOX_HW], [gx, SC.BOX_HW]]);
      seg([[gx, -9.16], [sx, -9.16], [sx, 9.16], [gx, 9.16]]);
      // the arc at the top of the box: the part of the circle around the spot that's outside the box
      const a = Math.acos(5.5 / 9.15);
      seg(s < 0 ? arc(spot, 0, 9.15, Math.PI - a, Math.PI + a, 16) : arc(spot, 0, 9.15, -a, a, 16));
      const sp = proj(v, spot, 0); if (spot >= x0) { g.fillStyle = 'rgba(255,255,255,0.86)'; g.beginPath(); g.ellipse(sp[0], sp[1], Math.max(1.5, sp[2] * 0.22), Math.max(1, sp[2] * 0.14), 0, 0, Math.PI * 2); g.fill(); }
    }
    const cs = proj(v, Math.max(x0, L / 2), 0); if (L / 2 >= x0) { g.fillStyle = 'rgba(255,255,255,0.86)'; g.beginPath(); g.ellipse(cs[0], cs[1], Math.max(1.5, cs[2] * 0.2), Math.max(1, cs[2] * 0.13), 0, 0, Math.PI * 2); g.fill(); }
    for (const [cx, cy, a0] of [[L, -HW, Math.PI / 2], [L, HW, Math.PI], [0, -HW, 0], [0, HW, -Math.PI / 2]]) seg(arc(cx, cy, 1, a0, a0 + Math.PI / 2, 6));
    // the stand behind the goal: tiers rising away, a crowd in them
    const wall = (xa, za, xb, zb, fill) => {
      const a = proj(v, xa, -70, za), b = proj(v, xa, 70, za), cc = proj(v, xb, 70, zb), d = proj(v, xb, -70, zb);
      g.fillStyle = fill; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
    };
    for (let i = 0; i < 6; i++) wall(L + 7 + i * 2.2, i * 1.6, L + 9.2 + i * 2.2, (i + 1) * 1.6, i % 2 ? '#1c2836' : '#223144');
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const crowd = ['#ffd23f', '#e8eef7', '#c8384a', '#57d9c3', '#9ab0d6', '#ff9459'];
    for (let i = 0; i < 260; i++) {
      const t = rnd(), y = -66 + rnd() * 132, k = rnd(), col = crowd[(rnd() * crowd.length) | 0];
      const p = proj(v, L + 7.6 + t * 13, y, t * 9.6 + 0.5);
      if (p[1] < -4 || p[1] > H) continue;
      g.fillStyle = col; g.globalAlpha = 0.55 + k * 0.35; g.fillRect(p[0], p[1], Math.max(1.2, p[2] * 0.45), Math.max(1.2, p[2] * 0.55));
    }
    g.globalAlpha = 1;
    // advertising boards behind the goal line and along the far side
    for (let i = -6; i < 6; i++) {
      const ya = i * 6.2, yb = ya + 6;
      const a = proj(v, L + 4, ya, 0), b = proj(v, L + 4, yb, 0), cc = proj(v, L + 4, yb, 0.9), d = proj(v, L + 4, ya, 0.9);
      g.fillStyle = i % 2 ? '#1d2433' : '#24314a'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
    }
  }
  // the goal you're attacking: the net behind, then the frame
  function goalBack(g, v) {
    const L = SC.LEN, hw = SC.GOAL_HW, h = SC.GOAL_H, dpt = 2.1;
    const P = (x, y, z) => proj(v, x, y, z);
    const s = P(L, 0, 0)[2];
    g.save();
    g.strokeStyle = 'rgba(240,244,250,0.38)'; g.lineWidth = Math.max(0.6, s * 0.035);
    const line = (a, b) => { const p = P(...a), q = P(...b); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); };
    // back panel, roof and sides as a grid
    for (let i = 0; i <= 12; i++) { const y = -hw + (2 * hw * i) / 12; line([L + dpt, y, 0], [L + dpt, y, h * 0.85]); line([L, y, h], [L + dpt, y, h * 0.85]); }
    for (let j = 0; j <= 4; j++) { const z = (h * 0.85 * j) / 4; line([L + dpt, -hw, z], [L + dpt, hw, z]); }
    for (const y of [-hw, hw]) for (let j = 0; j <= 4; j++) { const z = (h * j) / 4; line([L, y, z], [L + dpt, y, z * 0.85]); }
    line([L + dpt, -hw, 0], [L, -hw, 0]); line([L + dpt, hw, 0], [L, hw, 0]);
    g.restore();
  }
  function goalFrame(g, v) {
    const L = SC.LEN, hw = SC.GOAL_HW, h = SC.GOAL_H;
    const a = proj(v, L, -hw, 0), b = proj(v, L, -hw, h), c = proj(v, L, hw, h), d = proj(v, L, hw, 0);
    g.strokeStyle = '#f7f7f2'; g.lineWidth = Math.max(2, a[2] * 0.14); g.lineCap = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke();
  }

  // ------------------------------------------------------------------ people
  function ell(g, x, y, rx, ry, rot, fill) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function player(g, v, p, o) {
    const c = COL[p.team === 'H' ? (p.gk ? 'HG' : 'H') : p.gk ? 'AG' : 'A'];
    const [sx, sy, sc] = proj(v, p.x, p.y, 0);
    const u = sc * FIG * 0.6;
    if (sx < -u * 3 || sx > v.W + u * 3 || sy < -u * 4 || sy > v.H + u * 4) return;
    const [fx, fy] = screenDir(v, p.x, p.y, p.face);
    const flat = Math.sin(v.pitch) * 0.9;
    const hh = hash(p.id), skin = SKIN[hh % SKIN.length], hair = HAIR[(hh >> 3) % HAIR.length];
    // rings on the ground: you on the ball, who the pass is for, a runner
    if (o.ctrl) {
      const pulse = 0.88 + Math.sin(o.t * 7) * 0.08;
      g.strokeStyle = '#ffe14d'; g.lineWidth = Math.max(2, u * 0.16);
      g.beginPath(); g.ellipse(sx, sy, u * 1.05 * pulse, u * 1.05 * flat * 0.6 * pulse, 0, 0, Math.PI * 2); g.stroke();
    } else if (o.target) {
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(1.5, u * 0.12);
      g.beginPath(); g.ellipse(sx, sy, u * 0.95, u * 0.95 * flat * 0.6, 0, 0, Math.PI * 2); g.stroke();
    }
    ell(g, sx + u * 0.12, sy, u * 0.55, u * 0.2, 0, 'rgba(0,0,0,0.26)');
    if (p.st === 'down') { ell(g, sx, sy - u * 0.15, u * 0.8, u * 0.28, 0, c.shirt); ell(g, sx + u * 0.75, sy - u * 0.18, u * 0.22, u * 0.2, 0, skin); return; }
    const dive = p.gk && p.dive ? p.dive : 0;
    const lean = Math.min(0.2, p.v * 0.022) + (p.st === 'beaten' ? 0.15 : 0);
    const bx = sx + fx * u * lean + dive * u * 0.9, by = sy - Math.abs(dive) * u * 0.25;
    // legs: shorts, socks, a stride when he's running
    const run = Math.min(1, p.v / 2.2), sw = Math.sin(p.anim * 2.4) * u * 0.34 * run;
    g.lineCap = 'round';
    for (const k of [-1, 1]) {
      const hx = bx - fy * u * 0.13 * k, hy = by - u * 0.6;
      const s = sw * k, fxp = sx - fy * u * 0.13 * k + fx * s + dive * u * 0.4, fyp = sy - u * 0.04 + fy * s * 0.5;
      g.strokeStyle = c.socks; g.lineWidth = u * 0.17;
      g.beginPath(); g.moveTo((hx + fxp) / 2, (hy + fyp) / 2); g.lineTo(fxp, fyp); g.stroke();
      g.strokeStyle = skin; g.lineWidth = u * 0.17;
      g.beginPath(); g.moveTo(hx, hy + u * 0.12); g.lineTo((hx + fxp) / 2, (hy + fyp) / 2); g.stroke();
      ell(g, fxp + fx * u * 0.06, fyp, u * 0.11, u * 0.07, 0, '#151515');
    }
    ell(g, bx, by - u * 0.6, u * 0.27, u * 0.17, 0, c.shorts);
    // shirt, turned to where he's facing
    const sd = screenDir(v, p.x, p.y, p.face + Math.PI / 2), shoulder = Math.atan2(sd[1], sd[0]);
    ell(g, bx + fx * u * 0.03, by - u * 0.9, u * 0.3, u * 0.36, 0, c.shirt);
    ell(g, bx + fx * u * 0.05, by - u * 1.12, u * 0.44, u * 0.18, shoulder, c.shirt);
    // arms swing with the stride; a keeper's go up when he dives
    g.strokeStyle = c.shirt; g.lineWidth = u * 0.14;
    for (const k of [-1, 1]) {
      const ax = bx - fy * u * 0.4 * k, ay = by - u * 1.1 + fx * u * 0.08 * k;
      const up = p.gk && (dive || o.saving) ? -0.75 : 0;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax - fx * sw * 0.6 * k + dive * u * 0.6, ay + u * (0.5 + up) - fy * sw * 0.3 * k); g.stroke();
    }
    if (u > 12 && o.num && fy < 0.2) {
      // you see his number from behind
      g.fillStyle = c.num; g.font = `800 ${u * 0.36}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(o.num, bx, by - u * 0.88);
    }
    // head: hair on the back of it, so you can tell which way he's looking
    const hx = bx + fx * u * 0.06, hy = by - u * 1.38;
    ell(g, hx, hy, u * 0.21, u * 0.22, 0, skin);
    g.fillStyle = hair; g.beginPath(); g.ellipse(hx - fx * u * 0.06, hy - u * 0.06 - fy * u * 0.04, u * 0.21, u * 0.17, 0, 0, Math.PI * 2); g.fill();
    if (o.label) {
      g.font = `800 ${Math.max(10, u * 0.42)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(o.label, hx, hy - u * 0.42); g.fillStyle = '#fff'; g.fillText(o.label, hx, hy - u * 0.42);
    }
  }
  function ball(g, v, b, t) {
    if (!b || b.x == null) return;
    const [gx, gy, s] = proj(v, b.x, b.y, 0);
    const r = Math.max(2.6, s * 0.11 * FIG * 1.6);
    const z = b.z || 0.11;
    ell(g, gx + r * 0.3, gy, r * (1 - Math.min(0.5, z * 0.05)), r * 0.42, 0, `rgba(0,0,0,${z > 0.5 ? 0.22 : 0.32})`);
    const [bx, by] = proj(v, b.x, b.y, z + 0.11);
    ell(g, bx, by, r, r, 0, '#fbfbf8');
    const spin = b.st === 'held' ? 0 : t * 12;
    g.fillStyle = '#1b1b1b';
    g.beginPath(); g.arc(bx + Math.cos(spin) * r * 0.35, by + Math.sin(spin) * r * 0.35, r * 0.32, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.stroke();
  }

  // ------------------------------------------------------------------ what the playmaker sees
  // runs in behind: a dashed arrow from the runner to where he's going
  function runs(g, v, P, alpha) {
    if (alpha <= 0) return;
    g.save(); g.globalAlpha = alpha; g.lineCap = 'round';
    for (const p of P.home) {
      if (!p.run || p === P.ctrl) continue;
      const a = proj(v, p.x, p.y, 0), b = proj(v, p.run.x, p.run.y, 0);
      g.strokeStyle = '#ffe14d'; g.lineWidth = Math.max(2, a[2] * 0.22); g.setLineDash([a[2] * 0.7, a[2] * 0.5]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), hs = Math.max(6, b[2] * 0.9);
      g.fillStyle = '#ffe14d'; g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - Math.cos(ang - 0.5) * hs, b[1] - Math.sin(ang - 0.5) * hs); g.lineTo(b[0] - Math.cos(ang + 0.5) * hs, b[1] - Math.sin(ang + 0.5) * hs); g.closePath(); g.fill();
    }
    g.restore();
  }
  // the offside line: level with their second-last man
  function offside(g, v, P, alpha) {
    if (alpha <= 0 || !P.offside) return;
    const x = SC.offsideLine(P);
    const a = proj(v, x, -SC.HALF, 0), b = proj(v, x, SC.HALF, 0);
    g.save(); g.globalAlpha = alpha; g.strokeStyle = '#7fd4ff'; g.lineWidth = Math.max(1.5, a[2] * 0.12);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.restore();
  }
  // where a pass is going
  function passMark(g, v, b) {
    if (!b || b.st !== 'pass') return;
    const [sx, sy, s] = proj(v, b.tx, b.ty, 0);
    const k = Math.min(1, (performance.now() / 1000) % 1);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(sx, sy, s * (0.6 + k * 0.3), s * (0.6 + k * 0.3) * Math.sin(v.pitch) * 0.6, 0, 0, Math.PI * 2); g.stroke();
  }
  function effects(g, v, list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.t += dt;
      const life = e.life || 0.5, k = e.t / life;
      if (k >= 1) { list.splice(i, 1); continue; }
      const [sx, sy, u0] = proj(v, e.x, e.y, e.z || 1);
      const u = u0 * FIG * 0.6;
      g.save();
      g.globalAlpha = 1 - k;
      if (e.kind === 'ring') {
        g.strokeStyle = e.color || '#fff'; g.lineWidth = Math.max(2, u * 0.18 * (1 - k));
        g.beginPath(); g.ellipse(sx, sy, u * (0.3 + k * (e.size || 1.4)), u * (0.3 + k * (e.size || 1.4)) * 0.6, 0, 0, Math.PI * 2); g.stroke();
      } else if (e.kind === 'text') {
        g.fillStyle = e.color || '#fff'; g.font = `900 ${Math.max(13, u * 0.85)}px system-ui, sans-serif`; g.textAlign = 'center';
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 4;
        g.strokeText(e.text, sx, sy - u * 1.9 - k * u * 1.2); g.fillText(e.text, sx, sy - u * 1.9 - k * u * 1.2);
      } else if (e.kind === 'dust') {
        for (let j = 0; j < 5; j++) {
          const a = j * 1.3 + (e.seed || 0), r = u * (0.2 + k * 0.9);
          ell(g, sx + Math.cos(a) * r, sy + u * 0.9 + Math.sin(a) * r * 0.4, u * 0.16 * (1 - k * 0.5), u * 0.09, 0, 'rgba(225,235,210,0.7)');
        }
      } else if (e.kind === 'confetti') {
        for (let j = 0; j < 30; j++) {
          const a = j * 2.39 + (e.seed || 0), r = u * (1 + k * 7) * (0.4 + (j % 5) * 0.15);
          g.fillStyle = ['#ffd23f', '#ffffff', '#1d2433', '#57d9c3'][j % 4];
          g.fillRect(sx + Math.cos(a) * r, sy - u * 2 + Math.sin(a) * r * 0.6 + k * k * u * 4, u * 0.22, u * 0.12);
        }
      }
      g.restore();
    }
  }

  // ------------------------------------------------------------------ one frame
  function frame(g, v, P, o) {
    pitch(g, v);
    offside(g, v, P, o.offside || 0);
    runs(g, v, P, o.runs || 0);
    goalBack(g, v);
    const b = P.ball, inNet = b && b.x > SC.LEN;
    if (inNet) ball(g, v, b, o.t);
    goalFrame(g, v);
    passMark(g, v, b);
    const list = P.players.slice().sort((p, q) => proj(v, p.x, p.y, 0)[1] - proj(v, q.x, q.y, 0)[1]);
    const target = b && (b.st === 'pass' || b.st === 'free') && b.to ? b.to : null;
    for (const p of list) player(g, v, p, { ctrl: p === P.ctrl && b.st === 'held' && P.phase === 'live', target: p.id === target, t: o.t, num: String(p.num), label: o.labels && o.labels[p.id], saving: !!P.shot });
    if (!inNet) ball(g, v, b, o.t);
  }

  return { view, setCam, proj, toPitch, follow, frame, effects, COL };
})();
if (typeof module !== 'undefined') module.exports = SCView;
