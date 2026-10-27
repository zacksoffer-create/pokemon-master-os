/* LockdownScorers: the men you guard in Lockdown. Like the defenders in the
   scoring game, each one is data: how quick his first step is, how loose his
   handle is, when he rises, how often his shot is a fake, how hard he crashes
   the glass, and the gap you should give him. The simulation reads these
   numbers, so a new scorer is a new row.

   Poses are in his own frame: x is screen right when he faces you, y up,
   z toward you. */
const LockdownScorers = (() => {
  const SCORERS = {
    shooter: {
      id: 'shooter', name: 'The Shooter', tag: 'Rises if you give him space',
      tell: 'Ball stays high, near his shooting pocket. Back off a step and he hops right into it.',
      read: 'Crowd him so he has to put it on the floor, then get a hand up on his release.',
      good: 'You crowded him and got a hand up on the release.',
      skill: 0.86, ft: 0.88, quick: 11.5, fwd: 10.5, tellT: 0.22, range: 25, shootGap: 4.3, stepGap: 0, pump: 0.15,
      handle: { base: 0.26, cross: 0.38, protect: 0.4, high: 0 }, crash: 0.25, height: 1.0,
      gap: [2.2, 3.7], weights: { jab: 1.2, drive: 1.0, cross: 0.7, rise: 1.1, attack: 0 },
      colors: { jersey: '#2f4f8a', shorts: '#243d6b', trim: '#ffffff' }, number: 30
    },
    slasher: {
      id: 'slasher', name: 'The Slasher', tag: 'Attacks your top foot',
      tell: 'Low in his stance, ball on his hip, shoulders pointed at the rim. He wants a straight line.',
      read: 'Give him a step and slide with him. Don\'t reach; his jumper is the shot you want him taking.',
      good: 'You gave him a step and beat him to the spot.',
      skill: 0.5, ft: 0.68, quick: 14.5, fwd: 13.5, tellT: 0.16, range: 21, shootGap: 7.5, stepGap: 0, pump: 0.1,
      handle: { base: 0.26, cross: 0.38, protect: 0.5, high: 0 }, crash: 0.45, height: 1.0,
      gap: [4.4, 6.8], weights: { jab: 0.8, drive: 2.6, cross: 0.6, rise: 0.25, attack: 0 },
      colors: { jersey: '#c4502a', shorts: '#9e3f20', trim: '#ffffff' }, number: 0
    },
    loose: {
      id: 'loose', name: 'The Loose Handle', tag: 'Careless crossovers',
      tell: 'High, lazy dribble, and he crosses it out in front of you. Watch the ball, not his eyes.',
      read: 'Pick his pocket on the crossover out in front. Stay patient while it\'s on his hip.',
      good: 'You waited for the lazy cross and took it.',
      skill: 0.7, ft: 0.75, quick: 12.5, fwd: 11.5, tellT: 0.22, range: 23, shootGap: 5.0, stepGap: 0, pump: 0.1,
      handle: { base: 0.22, cross: 0.92, protect: 0.12, high: 0.55 }, crash: 0.35, height: 0.98,
      gap: [2.4, 4.2], weights: { jab: 0.5, drive: 1.0, cross: 2.8, rise: 0.5, attack: 0 },
      colors: { jersey: '#d9a21b', shorts: '#b4850f', trim: '#1d1f24' }, number: 2
    },
    pump: {
      id: 'pump', name: 'The Pump Faker', tag: 'Shows you the shot',
      tell: 'The ball goes up but his heels stay down. A real shot starts with his legs.',
      read: 'Stay down until the ball leaves his hands, then go up with him.',
      good: 'You stayed down on the fake and went up with the real one.',
      skill: 0.78, ft: 0.85, quick: 12.5, fwd: 11.5, tellT: 0.22, range: 24, shootGap: 3.4, stepGap: 0, pump: 0.62,
      handle: { base: 0.26, cross: 0.38, protect: 0.4, high: 0 }, crash: 0.35, height: 1.0,
      gap: [2.6, 4.4], weights: { jab: 0.6, drive: 0.7, cross: 0.4, rise: 2.2, attack: 0 },
      colors: { jersey: '#6b3fa0', shorts: '#55317f', trim: '#ffffff' }, number: 11
    },
    stepback: {
      id: 'stepback', name: 'The Step-Back Artist', tag: 'Crowd him and he steps back',
      tell: 'He waits for you to close the gap, then rocks back off one foot.',
      read: 'Close out under control. Stay a long arm away and contest after the step-back, not before.',
      good: 'You stayed under control and got a hand up after the step-back.',
      skill: 0.8, ft: 0.86, quick: 12, fwd: 11, tellT: 0.22, range: 26, shootGap: 5.6, stepGap: 3.3, pump: 0.15,
      handle: { base: 0.24, cross: 0.38, protect: 0.5, high: 0 }, crash: 0.25, height: 1.0,
      gap: [3.3, 4.8], weights: { jab: 1.0, drive: 0.8, cross: 0.8, rise: 0.9, attack: 0 },
      colors: { jersey: '#1d1f24', shorts: '#15161a', trim: '#e2581f' }, number: 34
    },
    crasher: {
      id: 'crasher', name: 'The Crasher', tag: 'Crashes the glass',
      tell: 'A big who throws up short shots and follows every one of them.',
      read: 'Contest the shot, then find him and box him out before you go get the ball.',
      good: 'You contested, found him, and boxed him out.',
      skill: 0.48, ft: 0.62, quick: 9.5, fwd: 10, tellT: 0.26, range: 17, shootGap: 2.6, stepGap: 0, pump: 0.15,
      handle: { base: 0.3, cross: 0.38, protect: 0.35, high: 0 }, crash: 0.95, height: 1.1, big: true,
      gap: [2.6, 4.6], weights: { jab: 0.5, drive: 0.8, cross: 0.3, rise: 2.4, attack: 0.4 },
      colors: { jersey: '#e4ded0', shorts: '#cfc7b6', trim: '#2a2f3a' }, number: 50
    },
    rim: {
      id: 'rim', name: 'The Rim Attacker', tag: 'Goes right through you',
      tell: 'Head down, straight line, he wants the contact.',
      read: 'Beat him to the spot and hold still, outside the circle. Don\'t swipe down at him.',
      good: 'You got there first, set your feet and took it.',
      skill: 0.6, ft: 0.7, quick: 11, fwd: 13, tellT: 0.24, range: 18, shootGap: 7.5, stepGap: 0, pump: 0.1,
      handle: { base: 0.22, cross: 0.38, protect: 0.55, high: 0 }, crash: 0.5, height: 1.05,
      gap: [3.0, 6.0], weights: { jab: 0.4, drive: 0.6, cross: 0.3, rise: 0.2, attack: 2.6 },
      colors: { jersey: '#8a2432', shorts: '#6c1b27', trim: '#f2d16b' }, number: 8
    }
  };
  const IDS = ['shooter', 'slasher', 'loose', 'pump', 'stepback', 'crasher', 'rim'];
  const SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#5c3a1e', '#a86b3c'];
  const HAIR = ['#1b1410', '#2b1d14', '#3b2716', '#0f0f10'];

  // ---------- poses ----------
  const P = (o) => o;
  const POSES = {
    // sizing you up: knees bent, ball low on his hip
    set: P({ head: [0, 5.5, 0.25], neck: [0, 4.98, 0.18], lsh: [-0.8, 4.75, 0.1], rsh: [0.8, 4.75, 0.1], lel: [-1.05, 3.8, 0.35], rel: [1.0, 3.7, 0.45], lha: [-1.0, 3.0, 0.7], rha: [1.05, 2.9, 0.75], lhip: [-0.46, 2.95, -0.2], rhip: [0.46, 2.95, -0.2], lkn: [-0.75, 1.6, 0.25], rkn: [0.75, 1.6, 0.25], lft: [-0.95, 0.12, 0.15], rft: [0.95, 0.12, 0.1] }),
    // a jab: right foot out toward you and to the right
    jab: P({ head: [0.25, 5.35, 0.45], neck: [0.2, 4.85, 0.35], lsh: [-0.6, 4.62, 0.25], rsh: [1.0, 4.6, 0.3], lel: [-0.9, 3.7, 0.5], rel: [1.25, 3.6, 0.6], lha: [-0.8, 3.0, 0.8], rha: [1.35, 2.8, 0.9], lhip: [-0.36, 2.85, -0.1], rhip: [0.56, 2.85, 0], lkn: [-0.7, 1.6, 0.1], rkn: [1.35, 1.45, 0.75], lft: [-0.95, 0.12, 0.0], rft: [1.9, 0.12, 0.95] }),
    // the first step of a drive to the right
    go: P({ head: [0.55, 5.1, 0.7], neck: [0.45, 4.6, 0.6], lsh: [-0.35, 4.42, 0.5], rsh: [1.2, 4.36, 0.55], lel: [-0.75, 3.5, 0.6], rel: [1.45, 3.4, 0.9], lha: [-0.6, 2.9, 1.0], rha: [1.55, 2.6, 1.2], lhip: [-0.25, 2.8, 0.0], rhip: [0.65, 2.75, 0.1], lkn: [-0.45, 1.7, -0.3], rkn: [1.55, 1.6, 1.0], lft: [-0.65, 0.45, -0.9], rft: [2.1, 0.12, 1.35] }),
    // gathering into a shot: ball at his chest, knees bent
    gather: P({ head: [0, 5.55, 0.1], neck: [0, 5.0, 0.05], lsh: [-0.76, 4.8, 0], rsh: [0.76, 4.8, 0], lel: [-0.75, 4.1, 0.55], rel: [0.75, 4.1, 0.55], lha: [-0.25, 4.5, 0.75], rha: [0.25, 4.5, 0.75], lhip: [-0.42, 2.9, -0.15], rhip: [0.42, 2.9, -0.15], lkn: [-0.55, 1.5, 0.4], rkn: [0.55, 1.5, 0.4], lft: [-0.6, 0.12, 0.15], rft: [0.6, 0.12, 0.15] }),
    // the ball up over his head, heels still down: a pump fake
    pump: P({ head: [0, 5.65, 0.05], neck: [0, 5.1, 0], lsh: [-0.76, 4.92, 0], rsh: [0.76, 4.92, 0], lel: [-0.62, 6.0, 0.35], rel: [0.62, 6.05, 0.35], lha: [-0.24, 6.9, 0.45], rha: [0.22, 7.0, 0.5], lhip: [-0.42, 3.0, -0.12], rhip: [0.42, 3.0, -0.12], lkn: [-0.55, 1.6, 0.35], rkn: [0.55, 1.6, 0.35], lft: [-0.6, 0.12, 0.15], rft: [0.6, 0.12, 0.15] }),
    shoot: Court3D.POSES.shoot,
    air: Court3D.POSES.air,
    stand: Court3D.POSES.stand,
    run1: Court3D.POSES.run1,
    run2: Court3D.POSES.run2,
    // a step back: weight on the back foot, ball coming up
    back: P({ head: [0, 5.6, -0.45], neck: [0, 5.05, -0.4], lsh: [-0.78, 4.85, -0.4], rsh: [0.78, 4.85, -0.4], lel: [-0.8, 4.0, 0.1], rel: [0.8, 4.0, 0.1], lha: [-0.3, 4.4, 0.35], rha: [0.3, 4.4, 0.35], lhip: [-0.44, 3.0, -0.55], rhip: [0.44, 3.0, -0.55], lkn: [-0.6, 1.7, -0.2], rkn: [0.6, 1.5, -0.9], lft: [-0.65, 0.12, 0.1], rft: [0.65, 0.3, -1.3] }),
    // backing into you for a rebound, arms out wide
    box: P({ head: [0, 5.35, -0.15], neck: [0, 4.85, -0.15], lsh: [-0.8, 4.65, -0.2], rsh: [0.8, 4.65, -0.2], lel: [-1.55, 4.55, 0.1], rel: [1.55, 4.55, 0.1], lha: [-1.95, 5.2, 0.35], rha: [1.95, 5.2, 0.35], lhip: [-0.48, 2.85, -0.45], rhip: [0.48, 2.85, -0.45], lkn: [-0.95, 1.55, -0.1], rkn: [0.95, 1.55, -0.1], lft: [-1.25, 0.12, -0.05], rft: [1.25, 0.12, -0.05] }),
    // your stance, seen from behind in the rebound view
    stance: Court3D.POSES.guard,
    wall: Court3D.POSES.wall
  };
  const SWAP = { lsh: 'rsh', lel: 'rel', lha: 'rha', lhip: 'rhip', lkn: 'rkn', lft: 'rft' };
  Object.keys(SWAP).forEach(k => { SWAP[SWAP[k]] = k; });
  // the same pose to the other side
  function mirror(p) {
    const out = {};
    Object.keys(p).forEach(j => { const q = p[SWAP[j] || j]; out[j] = [-q[0], q[1], q[2]]; });
    return out;
  }
  const MIRRORED = {};
  ['jab', 'go'].forEach(k => { MIRRORED[k] = mirror(POSES[k]); });
  // a pose by name and side (+1 right, -1 left)
  function pose(name, side) {
    if (side < 0 && MIRRORED[name]) return MIRRORED[name];
    return POSES[name] || POSES.set;
  }

  // ---------- lessons ----------
  const LESSONS = {
    bitJab: 'Stay square on the jab. Small slides; let him show you the drive before you go.',
    lean: 'Your weight was already going. Stay balanced so you can go either way.',
    late: 'You were a beat late. Watch his shoulders and the ball; that\'s where the drive starts.',
    tooClose: 'Too close to slide with him. Give a quick guy a step.',
    tooFar: 'You gave him the shot. Close the gap on a shooter.',
    reach: 'Don\'t reach when the ball is protected. Wait for it to come out in front.',
    whiff: 'You swiped at air. Go for the ball only when it\'s out in front of you.',
    hack: 'You hit him on the shot. Hands up, not down.',
    bitPump: 'Stay down until the ball leaves his hands. Heels down means it\'s a fake.',
    early: 'You jumped early and came down before he shot. Go up with him.',
    noHand: 'No hand up. Even without a jump, get a hand in his face on the release.',
    lunged: 'You flew at him and he stepped back. Close out under control.',
    goaltend: 'Once it\'s coming down, leave it. Swat it on the way up or not at all.',
    blocking: 'You were still moving when he hit you. Beat him there and hold still.',
    charge: 'Get there first and hold still outside the circle; that\'s a charge.',
    swipeDown: 'Don\'t swipe down at a man going to the rim. Wall up.',
    lostBox: 'Find him and hold your ground before you look for the ball.',
    noBox: 'Touch and hold to box out the moment the shot goes up.',
    missedBoard: 'Read the miss: long shots come off long, side shots go to the other side.'
  };

  return { SCORERS, IDS, POSES, SKIN, HAIR, pose, mirror, LESSONS };
})();
