/* Contact: a swing meets a pitch. Three things decide what comes off the bat,
   the same three a hitting coach talks about:
     timing    when the bat gets there (early pulls it, late pushes it the other way)
     barrel    where your barrel is vs where the ball is (square, under, over, jammed, off the end)
     path      the swing plane you swiped (up lifts it, level lines it, down chops it)
   Inside a small window on timing and on barrel, the result snaps toward
   pure; outside it, mistakes grow fast. The batted ball then flies for real. */
const Contact = (() => {
  const SWINGS = {
    // lag: how long from the start of your swipe to the bat reaching the plate
    power: { id: 'power', label: 'Full swing', lag: 0.15, cover: [0.82, 0.6], window: 1, bat: [64, 77], whiff: 0.115 },
    contact: { id: 'contact', label: 'Short swing', lag: 0.13, cover: [1.0, 0.76], window: 1.45, bat: [58, 64], whiff: 0.135 }
  };
  const GREEN = 0.28;          // the share of your coverage that counts as the barrel
  const gauss = Pitch.gauss;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // swipe angle (degrees above flat) -> attack angle of the bat
  function attackFrom(plane) { return clamp(plane * 0.5, -14, 24); }

  /* q: { pitch, e (timing error, s; negative is early), pci [x, y], plane (deg),
          power 0..1, kind 'power'|'contact', bats 'R'|'L', window (s), loaded, rand }
     -> { whiff, foul, tip, ev, la, spray, spin, quality, barrel, hard, words, dx, dy } */
  function swing(q) {
    const rand = q.rand || Math.random;
    const K = SWINGS[q.kind] || SWINGS.power;
    const p = q.pitch;
    const bats = q.bats || 'R';
    const hs = bats === 'L' ? -1 : 1;                 // pulling is toward -x for a righty
    const pw = clamp(q.power == null ? 0.6 : q.power, 0, 1);
    const cross = Pitch.at(p, p.T);
    const bx = cross[0], by = cross[1];
    const res = { e: q.e, bx, by, kind: K.id };

    // timing
    const w = (q.window || 0.02) * K.window * (K.id === 'power' ? 1.15 - 0.4 * pw : 1);
    const ae = Math.abs(q.e);
    const whiffT = K.whiff;
    if (ae > whiffT) return Object.assign(res, { whiff: true, words: q.e < 0 ? 'way out in front' : 'way late' });
    const eEff = ae <= w ? q.e * 0.6 : Math.sign(q.e) * (0.6 * w + (ae - w));
    res.eEff = eEff;
    res.onTime = ae <= w;

    // barrel: your coverage shrinks when you chase a ball out of the zone
    const out = Pitch.outside(bx, by);
    const shrink = 1 - Math.min(0.35, out * 0.7);
    const dx = bx - q.pci[0], dy = by - q.pci[1];
    const dAway = dx * hs;                            // + : ball further out than your barrel
    const rx = K.cover[0] * shrink, ry = K.cover[1] * shrink;
    const r = Math.hypot(dx / rx, dy / ry);
    Object.assign(res, { dx, dy, r, out });
    if (r > 1.12) {
      const words = Math.abs(dy) / ry > Math.abs(dx) / rx ? (dy < 0 ? 'swung right over it' : 'swung under it') : (dAway > 0 ? "couldn't reach it" : 'tied up inside');
      return Object.assign(res, { whiff: true, words });
    }
    if (r > 1) return Object.assign(res, { foul: true, tip: true, words: 'just ticked it' });

    const miss = r <= GREEN ? 0 : (r - GREEN) / (1 - GREEN);
    const quality = 1 - 0.62 * Math.pow(miss, 1.3);
    const plateMph = p.mph * 0.92;
    const batMph = (K.bat[0] + (K.bat[1] - K.bat[0]) * pw) * (q.loaded === false ? 0.9 : 1);
    const timingQ = 1 - 0.5 * Math.min(1, Math.pow(Math.abs(eEff) / 0.09, 2));
    const chaseQ = 1 - Math.min(0.5, out * 1.1);
    let jamQ = 1;
    if (dAway < -0.18) jamQ = 1 - Math.min(0.35, (-dAway - 0.18) * 0.9);        // on the hands
    else if (dAway > 0.2) jamQ = 1 - Math.min(0.25, (dAway - 0.2) * 0.7);       // off the end
    let ev = (1.2 * batMph + 0.2 * plateMph) * quality * timingQ * chaseQ * jamQ;
    ev *= 1 + gauss(rand) * 0.015;

    // launch: the swing plane, plus where on the ball you hit it
    const attack = attackFrom(q.plane || 0);
    let dvEff = dy * 0.42;
    if (r <= GREEN) dvEff *= 0.4;
    let la = attack + 8 + dvEff * 115;
    if (eEff < 0) la -= (-eEff / 0.06) * 13;          // out front: rolled over
    else la += (eEff / 0.06) * 9;                     // late: under it, flared the other way
    const over = Math.max(0, by - Pitch.ZONE.y1 - Pitch.BALL_R), under = Math.max(0, Pitch.ZONE.y0 - Pitch.BALL_R - by);
    la += over * 40 - under * 40;
    if (dAway < -0.18) la -= 4;
    la += gauss(rand) * (1.5 + 6 * miss);
    la = clamp(la, -45, 82);

    // direction: early pulls it, late goes the other way, and the pitch's
    // location steers it too (pull the inside pitch, go with the one away)
    let spray = hs * (eEff / 0.06) * 32 - hs * 3 + bx * 22 + gauss(rand) * (6 + 3 * miss);
    if (dAway > 0.2) spray += hs * 6;
    const foul = Math.abs(spray) > 45;

    // backspin grows with launch: a liner barely spins, a high fly spins hard
    const spin = la > 0 ? clamp(la * 95 - 300, 300, 3400) * (1 - 0.2 * miss) : clamp(-400 + la * 30, -1600, -300);
    const hard = ev >= 95;
    const barrel = ev >= 98 && la >= Math.max(8, 26 - (ev - 98)) && la <= Math.min(50, 30 + (ev - 98) * 1.2);
    let words;
    if (barrel) words = 'barreled it';
    else if (dAway < -0.25) words = 'got jammed';
    else if (dAway > 0.28) words = 'off the end of the bat';
    else if (la > 50) words = 'got under it';
    else if (la < -6) words = eEff < -0.03 ? 'rolled over it' : 'topped it';
    else if (hard) words = 'squared it up';
    else if (eEff < -0.045) words = 'out in front';
    else if (eEff > 0.045) words = 'a little late';
    else words = 'put a swing on it';
    return Object.assign(res, { ev, la, spray, spin, quality, hard, barrel, foul, words, attack });
  }

  return { SWINGS, GREEN, swing, attackFrom };
})();
