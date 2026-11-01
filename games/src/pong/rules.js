/* The read: racks and opponents as data, and what the right throw is.
   A rack's shape decides the shot (naked front cup: fastball; buried cup:
   arc; island with open table: bounce). The opponent decides what's off the
   menu (he swats bounces, he blows out spinners, he waves you off). */
const Pong = (() => {
  const { SPACING: S, CUP } = PongPhysics;
  const BACK = 8 - CUP.rTop - 0.02;  // back line of the far rack
  const R3 = Math.sqrt(3) / 2;

  // Formations: [x across, d forward from the back line], in cup widths.
  const FORMATIONS = {
    tri10: { name: 'Full rack', n: 10, cups: [[-1.5, 0], [-0.5, 0], [0.5, 0], [1.5, 0], [-1, R3], [0, R3], [1, R3], [-0.5, 2 * R3], [0.5, 2 * R3], [0, 3 * R3]] },
    pyr6: { name: 'Pyramid', n: 6, read: 'Tight. Arcs into the middle forgive you; misses roll into neighbors.', cups: [[-1, 0], [0, 0], [1, 0], [-0.5, R3], [0.5, R3], [0, 2 * R3]] },
    zip6: { name: 'Zipper', n: 6, read: 'Two staggered columns. A fastball that runs hot drops into the cup behind.', cups: [[-R3 / 2, 0], [R3 / 2, 0.5], [-R3 / 2, 1], [R3 / 2, 1.5], [-R3 / 2, 2], [R3 / 2, 2.5]] },
    house5: { name: 'House', n: 5, read: 'Three in back, two in front. Arc at the middle.', cups: [[-1, 0], [0, 0], [1, 0], [-0.5, R3], [0.5, R3]] },
    zip5: { name: 'Zipper', n: 5, read: 'Two staggered columns. A hot fastball drops into the cup behind.', cups: [[-R3 / 2, 0], [R3 / 2, 0.5], [-R3 / 2, 1], [R3 / 2, 1.5], [-R3 / 2, 2]] },
    diamond4: { name: 'Diamond', n: 4, read: 'One cup up front for the fastball, one buried in the middle for the arc.', cups: [[0, 0], [-0.5, R3], [0.5, R3], [0, 2 * R3]] },
    line4: { name: 'Stoplight', n: 4, read: 'Single file. Fastball the front; if it runs hot it finds the next one.', cups: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    tri3: { name: 'Triangle', n: 3, read: 'Small and tight. Arc it at the middle.', cups: [[-0.5, 0], [0.5, 0], [0, R3]] },
    line3: { name: 'Stoplight', n: 3, read: 'Single file. Fastball the front; if it runs hot it finds the next one.', cups: [[0, 0], [0, 1], [0, 2]] },
    wall2: { name: 'Side by side', n: 2, read: 'Both cups face you. Fastball either one.', cups: [[-0.5, 0], [0.5, 0]] },
    stack2: { name: 'Stack', n: 2, read: 'One behind the other. Fastball the front; hot ones find the back.', cups: [[0, 0], [0, 1]] },
    island1: { name: 'Island', n: 1, read: 'One cup, open table in front. Bounce it if he won\'t swat.', cups: [[0, 0]] }
  };
  // what you can call when the rack gets down to this many
  const RERACKS = { 6: ['pyr6', 'zip6'], 5: ['house5', 'zip5'], 4: ['diamond4', 'line4'], 3: ['tri3', 'line3'], 2: ['wall2', 'stack2'] };

  // Lay out cups on a side. 'far' is the rack you shoot at (point toward you).
  let cupSeq = 0;
  function layout(formId, side, opts) {
    const F = FORMATIONS[formId];
    const o = opts || {};
    const dx = (o.x || 0);
    return F.cups.map(([x, d]) => {
      const z = side === 'far' ? BACK - (d + (o.d || 0)) * S : (8 - BACK) + (d + (o.d || 0)) * S;
      return { id: 'c' + (++cupSeq), x: (side === 'far' ? x : -x) * S + dx, z, live: true, side };
    });
  }
  // Re-lay an existing rack into a new formation, keeping the same number of cups.
  function rerack(cups, formId, side) {
    const fresh = layout(formId, side);
    const live = cups.filter(c => c.live);
    return fresh.slice(0, live.length);
  }

  // How a cup sits in the rack, from the shooter's side.
  function exposure(cup, cups, side) {
    const toward = side === 'far' ? -1 : 1;  // shooter is toward -z for the far rack
    const live = cups.filter(c => c.live && c.id !== cup.id);
    const blockers = live.filter(c => (c.z - cup.z) * toward > 0.05 && Math.abs(c.x - cup.x) < S * 0.85);
    const neighbors = live.filter(c => Math.hypot(c.x - cup.x, c.z - cup.z) < S * 1.12);
    if (!blockers.length && !neighbors.length) return 'island';
    if (!blockers.length) return 'front';
    return 'buried';
  }

  // Opponents. Each one takes something off the menu; the tell is visible.
  const OPPONENTS = {
    statue: {
      id: 'statue', name: 'The Statue', tag: 'Never moves', skill: 0.58, shirt: '#3d7bd9', skin: '#e0ac69', hair: '#3a2a1c',
      tell: 'Arms folded, feet planted. He will not reach across that table for anything.',
      read: 'Bounce shots are free. Anything with open table in front of it is two cups.',
      lines: ['I don\'t swat. Too much effort.', 'Go ahead, bounce it.', 'Just tell me when it\'s my turn.']
    },
    swatter: {
      id: 'swatter', name: 'The Swatter', tag: 'Hands like a goalie', skill: 0.64, swat: true, shirt: '#e2552f', skin: '#8d5524', hair: '#1b1410',
      tell: 'Hands hovering over the table, eyes on your wrist. Waiting for a bounce.',
      read: 'He swats bounces. Keep it in the air: fastball the naked cups (islands too), arc the buried ones.',
      lines: ['Bounce it. I dare you.', 'Got hands.', 'Table\'s mine.']
    },
    blower: {
      id: 'blower', name: 'The Blower', tag: 'House rules guy', skill: 0.64, blow: true, shirt: '#2c9c6a', skin: '#f1c27d', hair: '#7a4a1e',
      tell: 'Leans over his cups, cheeks ready. House rules: if it\'s spinning in the cup, he blows it out.',
      read: 'No spin. Throw it straight so it drops dead; a fastball into the back wall is safe.',
      lines: ['Spinners are mine.', 'House rules, buddy.', 'Is it spinning? It\'s spinning.']
    },
    waver: {
      id: 'waver', name: 'The Waver', tag: 'Loud and distracting', skill: 0.62, wave: true, shirt: '#9a4fd6', skin: '#c68642', hair: '#2b1d14',
      tell: 'Arms go up and down on a beat. Throw into his arms and your line goes with them.',
      read: 'Wait for the arms to drop, then throw. He can\'t keep them up forever.',
      lines: ['Woo! WOO!', 'Look at me, not the cups.', 'Can\'t hear you!']
    },
    sniper: {
      id: 'sniper', name: 'The Sniper', tag: 'Never misses twice', skill: 0.86, hot: true, shirt: '#22252e', skin: '#5c3a1e', hair: '#0e0a08',
      tell: 'Quiet. Lines it up, lets it go, sinks two out of three.',
      read: 'You won\'t win a slow game. Take the high-percentage cup every time, get balls back, and use your re-racks to keep his cups tight.',
      lines: ['…', 'Your shot.', 'Balls back.']
    }
  };
  const OPP_IDS = Object.keys(OPPONENTS);

  // The right throw for a cup, given the opponent.
  function rightShot(exp, opp) {
    // an island is a naked cup with open table: two cups off the bounce, unless he swats
    if (exp === 'island') return opp && opp.swat ? 'fast' : 'bounce';
    if (exp === 'front') return 'fast';
    return 'arc';
  }
  const SHOT_NAMES = { arc: 'Arc', fast: 'Fastball', bounce: 'Bounce' };
  const GP = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const FROM = ['F', 'D', 'C', 'B', 'A'];

  /* Grade one throw on the decision, not the result.
     t: { kind, exposure, spun, armsUp, wild } */
  function gradeThrow(t, opp) {
    if (opp && opp.wave && t.armsUp) return { g: 'D', why: 'You threw into his arms. Wait for them to drop.' };
    if (opp && opp.swat && t.kind === 'bounce') return { g: 'D', why: 'He swats bounces. Keep it in the air.' };
    if (opp && opp.blow && t.spun) return { g: 'D', why: 'He blows out anything spinning. Throw it straight.' };
    if (t.wild) return { g: 'C', why: 'That one wasn\'t near a cup. Settle your touch: your free flick is an arc at the head cup.' };
    const right = rightShot(t.exposure, opp);
    const e = t.exposure;
    if (t.kind === right) {
      if (right === 'fast') return { g: 'A', why: e === 'island' ? 'He swats bounces, so the naked island gets the fastball. Right call.' : 'Front cup was naked. A fastball doesn\'t need perfect depth.' };
      if (right === 'bounce') return { g: 'A', why: 'Island cup, open table in front, and he won\'t swat. Bounce it: two cups.' };
      return { g: 'A', why: 'Buried cup, so you went over the top. That\'s the shot.' };
    }
    if (t.kind === 'fast' && e === 'buried') return { g: 'C', why: 'A cup was in the way. A flat ball hits the first rim it meets; arc it over.' };
    if (t.kind === 'bounce' && e !== 'island') return { g: 'C', why: 'Bounces need open table in front of the cup. Other cups were in the way.' };
    if (t.kind === 'arc' && e === 'front') return { g: 'B', why: 'Arc works, but a naked front cup is a fastball. It forgives your depth.' };
    if (t.kind === 'arc' && e === 'island') return { g: 'B', why: opp && opp.swat ? 'An island is a small target from the air. It\'s naked, so fastball it.' : 'An island is a small target from the air. With open table in front, bounce it for two.' };
    if (t.kind === 'fast' && e === 'island') return { g: 'B', why: 'Fastball at an island works. A bounce is worth two.' };
    return { g: 'B', why: 'Fine look.' };
  }
  function gradeTurn(throws) {
    if (!throws.length) return { g: 'C', why: '' };
    const avg = throws.reduce((s, t) => s + GP[t.g], 0) / throws.length;
    const worst = throws.slice().sort((a, b) => GP[a.g] - GP[b.g])[0];
    // one bad read caps the turn a grade above it
    return { g: FROM[Math.min(Math.round(avg), GP[worst.g] + 1)], why: worst.why };
  }

  return { FORMATIONS, RERACKS, OPPONENTS, OPP_IDS, BACK, layout, rerack, exposure, rightShot, gradeThrow, gradeTurn, SHOT_NAMES, GP };
})();
