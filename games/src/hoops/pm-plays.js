/* Playmaker data: who's on your team, how each defense plays, and the
   whiteboard puzzles. Like the defenders in defense.js, a new defense is a new
   row here, not new code. Positions are court feet (x across, z out from the
   baseline); the rim is at x 0, z 5.25. */
const PMPlays = (() => {
  // Teammates. rating feeds the same shot model the scoring game uses; range
  // is how far out he'll shoot on the catch.
  const ROLES = {
    guard: { id: 'guard', label: 'Guard', rating: 72, range: 27, speed: 15.5, finish: 70 },
    shooter: { id: 'shooter', label: 'Shooter', rating: 84, range: 27.5, speed: 14.5, finish: 62 },
    slasher: { id: 'slasher', label: 'Slasher', rating: 64, range: 25, speed: 17.5, finish: 80, backdoor: true },
    big: { id: 'big', label: 'Big', rating: 46, range: 9, speed: 13.5, finish: 88, roll: true }
  };

  // 4 out, 1 in: you at the top, two wings, a corner, the big at the dunker
  // spot on the side without a corner. Mirrored at random.
  const LINEUP = [
    { role: 'guard', spot: 'top', number: 3, skin: '#c68642' },
    { role: 'shooter', spot: 'lw', number: 11, skin: '#8d5524' },
    { role: 'slasher', spot: 'rw', number: 7, skin: '#e0ac69' },
    { role: 'shooter', spot: 'rc', number: 24, skin: '#5c3a1e' },
    { role: 'big', spot: 'ldunk', number: 44, skin: '#a86b3c' }
  ];

  /* Defensive schemes, one per possession.
     sink: how far the off-ball men sag toward the paint (two passes away most).
     deny: one-pass-away men sit in the passing lane with a hand in it.
     antic: how early they read a pass. jumpers: which spots gamble on lanes.
     helper / helpType: who comes when you get by your man, as a Help type.
     xout: how the next man rotates behind the helper. watch: chance a weak-side
     man turns his head to watch a drive. close: how they close out on a catch.
     answers: the reads that beat it, for the card. */
  const SCHEMES = {
    packline: {
      id: 'packline', name: 'Pack Line', tag: 'Packs the paint',
      tell: 'Everybody but your man is sitting in the paint.',
      read: 'Driving into that is driving into a crowd. Kick it or skip it: they are a long way from the shooters.',
      sink: 0.95, gap1: 0.36, deny: 0, antic: 0.15, react: 0.24, helper: 'nearest', helpType: 'charge', xout: 'slow', watch: 0.2,
      close: { speed: 11.5, gap: 2.4, length: 1.0 }, onBall: { gap: 3.4, lateral: 0.55 },
      answers: ['kick', 'skip', 'corner'], colors: { jersey: '#7b2335', shorts: '#5f1a29', trim: '#f2d16b' }
    },
    denial: {
      id: 'denial', name: 'Denial', tag: 'Overplays the wings',
      tell: 'The wing defenders are up in the passing lanes with a hand in them.',
      read: 'Don\'t throw it into the hand. The wing goes backdoor: bounce it to him at the rim.',
      sink: 0.35, gap1: 0.1, deny: 1, antic: 0.75, react: 0.18, helper: 'big', helpType: 'late', xout: 'none', watch: 0,
      close: { speed: 15, gap: 1.8, length: 1.05 }, onBall: { gap: 2.6, lateral: 0.5 },
      answers: ['backdoor', 'bounce'], colors: { jersey: '#1f4e79', shorts: '#183d5f', trim: '#ffffff' }
    },
    cornerhelp: {
      id: 'cornerhelp', name: 'Corner Help', tag: 'Helps off the corner',
      tell: 'The corner defender is creeping toward the lane.',
      read: 'Get downhill. When he leaves the corner to stop you, the corner three is open.',
      sink: 0.55, gap1: 0.2, deny: 0, antic: 0.25, react: 0.22, helper: 'corner', helpType: 'late', xout: 'none', watch: 0.3,
      close: { speed: 12.5, gap: 2.2, length: 1.0 }, onBall: { gap: 3.0, lateral: 0.45 },
      answers: ['corner', 'kick'], colors: { jersey: '#2f62b8', shorts: '#264f94', trim: '#ffffff' }
    },
    rim: {
      id: 'rim', name: 'Rim Protector', tag: 'Big man at the rim',
      tell: 'Their big is parked under the basket.',
      read: 'Make him step up to you, then dump it off or throw the lob to your big.',
      sink: 0.45, gap1: 0.18, deny: 0, antic: 0.3, react: 0.22, helper: 'big', helpType: 'leaper', xout: 'none', watch: 0.25,
      close: { speed: 13, gap: 2.2, length: 1.0 }, onBall: { gap: 3.0, lateral: 0.4 }, rimBig: true,
      answers: ['dump', 'lob'], colors: { jersey: '#3a3f4b', shorts: '#2c3039', trim: '#ffb547' }
    },
    lanejumper: {
      id: 'lanejumper', name: 'Lane Jumper', tag: 'Gambles on passes',
      tell: 'A wing defender is cheating into the passing lane, watching your eyes.',
      read: 'Bounce it under him, fake him out of the lane, or hit his man on the back cut.',
      sink: 0.4, gap1: 0.16, deny: 0, antic: 0.35, react: 0.2, jumpers: ['wing'], helper: 'nearest', helpType: 'digger', xout: 'none', watch: 0.2,
      close: { speed: 14, gap: 2.0, length: 1.0 }, onBall: { gap: 3.0, lateral: 0.5 },
      answers: ['bounce', 'backdoor', 'fake'], colors: { jersey: '#c4502a', shorts: '#9e3f20', trim: '#ffffff' }
    },
    scramble: {
      id: 'scramble', name: 'Scramble', tag: 'Flies at the first pass',
      tell: 'They help hard and sprint out at whoever catches it first.',
      read: 'Make the extra pass. Drive, kick, and swing it one more time to the guy they left.',
      sink: 0.5, gap1: 0.2, deny: 0, antic: 0.3, react: 0.2, helper: 'nearest', helpType: 'late', xout: 'fly', watch: 0.2,
      close: { speed: 12.5, gap: 2.2, length: 1.0 }, onBall: { gap: 3.0, lateral: 0.5 },
      answers: ['extra'], colors: { jersey: '#6b3fa0', shorts: '#55317f', trim: '#ffffff' }
    }
  };
  const SCHEME_IDS = Object.keys(SCHEMES);

  /* Draw It Up: frozen boards. You trace one teammate's cut (optional) and
     the pass, then it runs on the same simulation. off/def: [x, z]; def
     entries can carry a behavior: watch (eyes on the ball), deny, sunk,
     front (fronting the post), jump (lane gambler), behind (posted up). */
  const BOARDS = [
    {
      id: 'watcher', name: 'Ball-Watcher', situation: 'Weak side, his eyes are on you',
      text: 'The left wing\'s man has turned his head to watch the ball.',
      answer: 'Cut the left wing behind him to the rim and lead him with a bounce or a lob.',
      clock: 6, holder: 0, scheme: 'cornerhelp',
      off: [[9, 25, 'guard'], [-18, 19, 'slasher'], [19, 18, 'shooter'], [21, 4, 'shooter'], [5, 6.5, 'big']],
      def: [[7, 21.5], [-11, 15.5, 'watch'], [14, 15.5], [16, 6.5], [3.4, 8.2]]
    },
    {
      id: 'denied', name: 'Overplayed', situation: 'They won\'t let you swing it',
      text: 'Both wing defenders are sitting in the passing lanes.',
      answer: 'Send the right wing backdoor and bounce it to him at the rim. A pass to the wing gets picked.',
      clock: 7, holder: 0, scheme: 'denial',
      off: [[0, 26, 'guard'], [-18, 19, 'shooter'], [18, 19, 'slasher'], [-21, 4, 'shooter'], [-5, 6.5, 'big']],
      def: [[0, 22.5], [-14.5, 20.5, 'deny'], [14.5, 20.5, 'deny'], [-16, 6], [-3.4, 8.2]]
    },
    {
      id: 'sunk', name: 'Sunk In', situation: 'Their corner man is in the lane',
      text: 'The defender who should be on the left corner is standing in the paint.',
      answer: 'Skip it to the left corner. Nothing fancy: get it there on time and he has a rhythm three.',
      clock: 6, holder: 0, scheme: 'packline',
      off: [[16, 19, 'guard'], [-3, 25, 'shooter'], [21, 5, 'slasher'], [-21, 3.5, 'shooter'], [5, 6.5, 'big']],
      def: [[12.5, 16], [-2, 20], [16.5, 7], [-4, 8, 'sunk'], [3.2, 8.4]]
    },
    {
      id: 'fourseconds', name: 'Four Seconds', situation: 'Down 2 · 4 seconds left',
      text: 'Their big is fronting yours, between him and the ball.',
      answer: 'Throw the lob over the front. Your big goes up and gets it at the rim.',
      clock: 4, holder: 0, scheme: 'rim',
      off: [[0, 25, 'guard'], [-18, 19, 'shooter'], [18, 19, 'shooter'], [21, 4, 'shooter'], [-4.5, 7, 'big']],
      def: [[0, 21.5], [-15, 17], [15, 17], [17, 6], [-4.2, 10, 'front']]
    },
    {
      id: 'switch', name: 'Mismatch', situation: 'They switched a guard onto your big',
      text: 'A small guard is behind your big on the right block.',
      answer: 'Throw it in to the big right away. He scores over the little man before help gets there.',
      clock: 6, holder: 0, scheme: 'cornerhelp',
      off: [[17, 17, 'guard'], [-17, 19, 'shooter'], [0, 26, 'shooter'], [-21, 4, 'shooter'], [6.4, 7.2, 'big']],
      def: [[13.5, 14.5], [-13, 16], [0, 22], [-15, 6.5], [6.0, 4.6, 'behind', 'small']]
    },
    {
      id: 'gambler', name: 'Lane Jumper', situation: 'He\'s guessing on the pass',
      text: 'The right wing defender is cheating into the lane, waiting for the pass.',
      answer: 'Let him guess. Cut the wing behind him and bounce it to the rim, under his hands.',
      clock: 7, holder: 0, scheme: 'lanejumper',
      off: [[0, 26, 'guard'], [-18, 19, 'shooter'], [18, 19, 'slasher'], [-21, 4, 'shooter'], [-5, 6.5, 'big']],
      def: [[0, 22.5], [-14, 16.5], [11.5, 21, 'jump'], [-15.5, 6], [-3.4, 8.2]]
    }
  ];

  return { ROLES, LINEUP, SCHEMES, SCHEME_IDS, BOARDS };
})();
