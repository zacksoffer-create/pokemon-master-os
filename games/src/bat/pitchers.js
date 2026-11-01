/* Pitchers and situations, as data. A pitcher is an arm slot, a tempo, a few
   pitches with their own speed and movement, how well he hits his spots, and
   what he likes to throw in each kind of count. That count table is the
   read: where he goes when he's ahead, and what he has to do when he's
   behind. A situation is runners, outs and what the at-bat needs. */
const Pitchers = (() => {
  const PITCHERS = {
    flame: {
      id: 'flame', name: 'The Flamethrower', tag: 'Lives up in the zone', throws: 'R', slot: 'over', tempo: 1.45, command: 0.3,
      tell: 'Huge leg kick and everything is hard. With two strikes he climbs the ladder: heat above your hands.',
      read: 'Be on time for 98 and stay off the high one. Get your barrel up early in the count; with two strikes, shorten up and let the letter-high heater go by.',
      arsenal: { FF: { mph: 98, ivb: 18, hb: 6 }, SL: { mph: 88, ivb: 3, hb: -5 } },
      mix: {
        even: [['FF', 'up', 3], ['FF', 'heart', 2], ['FF', 'away', 2], ['SL', 'lowAway', 2]],
        behind: [['FF', 'heart', 4], ['FF', 'up', 2], ['FF', 'away', 2], ['SL', 'lowAway', 1]],
        two: [['FF', 'upOut', 5], ['SL', 'lowAway', 2], ['FF', 'up', 1]],
        full: [['FF', 'up', 3], ['FF', 'heart', 2], ['SL', 'lowAway', 1]]
      },
      colors: { jersey: '#b9bcc4', trim: '#9b1d2b', cap: '#9b1d2b', pants: '#c9ccd3' }, number: 49
    },
    junk: {
      id: 'junk', name: 'The Junkballer', tag: 'Soft, softer, softest', throws: 'R', slot: 'three', tempo: 1.3, command: 0.27,
      tell: 'Slow arm, slower ball. Changeups and curves, almost always away.',
      read: 'Wait on it. Let the ball travel and drive it the other way. Out front, you roll over into a ground ball.',
      arsenal: { FF: { mph: 86, ivb: 12, hb: 9 }, CH: { mph: 75, ivb: 5, hb: 14 }, CU: { mph: 70, ivb: -15, hb: -7 } },
      mix: {
        even: [['CH', 'lowAway', 3], ['FF', 'away', 2], ['CU', 'low', 2], ['FF', 'in', 1]],
        behind: [['FF', 'away', 3], ['CH', 'away', 3], ['FF', 'heart', 1]],
        two: [['CH', 'lowAway', 3], ['CU', 'dirt', 2], ['CH', 'awayOff', 2]],
        full: [['CH', 'lowAway', 3], ['FF', 'away', 2]]
      },
      colors: { jersey: '#2f5d3a', trim: '#e6d39a', cap: '#1f3f28', pants: '#d8d4c4' }, number: 7
    },
    sinker: {
      id: 'sinker', name: 'The Sinkerballer', tag: 'Lives at the knees', throws: 'R', slot: 'three', tempo: 1.35, command: 0.3,
      tell: 'Heavy ball from a three-quarter arm. The seams spin sideways and it dives in at the knees.',
      read: 'Set your barrel up in the zone and make him come to you. Swing at the knee-high sinker and you beat it into the ground; when he falls behind, he has to bring it up.',
      arsenal: { SI: { mph: 93, ivb: 4, hb: 17 }, SL: { mph: 85, ivb: 2, hb: -6 }, CH: { mph: 85, ivb: 6, hb: 15 } },
      mix: {
        even: [['SI', 'low', 3], ['SI', 'lowIn', 2], ['SL', 'lowAway', 2], ['SI', 'middleIn', 1]],
        behind: [['SI', 'middleIn', 2], ['SI', 'heart', 2], ['SI', 'low', 2], ['SL', 'away', 1]],
        two: [['SI', 'dirt', 2], ['SL', 'lowAway', 3], ['SI', 'lowIn', 2]],
        full: [['SI', 'low', 3], ['SI', 'heart', 1]]
      },
      colors: { jersey: '#1d2c4d', trim: '#f0b429', cap: '#1d2c4d', pants: '#c9ccd3' }, number: 31
    },
    slider: {
      id: 'slider', name: 'The Slider Specialist', tag: 'Sweeps it off the plate', throws: 'R', slot: 'low', tempo: 1.3, command: 0.27,
      tell: 'Low arm slot. The sweeper shows a red dot: it starts at the middle and ends a foot off the plate.',
      read: 'Sit on the fastball in and let the sweeper go. Red dot means it is leaving the plate. Hit the ones that stay on the inner half.',
      arsenal: { SW: { mph: 83, ivb: 1, hb: -18 }, FF: { mph: 93, ivb: 12, hb: 11 } },
      mix: {
        even: [['SW', 'away', 3], ['FF', 'in', 2], ['SW', 'awayOff', 2]],
        behind: [['FF', 'middleIn', 3], ['SW', 'away', 2], ['FF', 'heart', 1]],
        two: [['SW', 'awayOff', 5], ['FF', 'upIn', 1]],
        full: [['SW', 'away', 3], ['FF', 'in', 2]]
      },
      colors: { jersey: '#5b2a86', trim: '#f4f4f4', cap: '#3d1c5b', pants: '#c9ccd3' }, number: 54
    },
    closer: {
      id: 'closer', name: 'The Closer', tag: 'Heat and a splitter', throws: 'R', slot: 'over', tempo: 1.15, command: 0.32,
      tell: 'Quick slide step. Two pitches that look the same out of the hand; the splitter tumbles and dies at your shoe tops.',
      read: 'Hunt the fastball early. With two strikes, if the seams tumble, take it: it ends up in the dirt.',
      arsenal: { FF: { mph: 99, ivb: 17, hb: 7 }, FS: { mph: 89, ivb: 0, hb: 9 } },
      mix: {
        even: [['FF', 'up', 3], ['FF', 'heart', 1], ['FS', 'low', 2]],
        behind: [['FF', 'heart', 3], ['FF', 'up', 2], ['FS', 'low', 1]],
        two: [['FS', 'dirt', 4], ['FF', 'upOut', 2], ['FF', 'up', 1]],
        full: [['FF', 'up', 2], ['FS', 'low', 2]]
      },
      colors: { jersey: '#111318', trim: '#e2581f', cap: '#111318', pants: '#26282e' }, number: 99
    },
    lefty: {
      id: 'lefty', name: 'The Crafty Lefty', tag: 'Nibbles the corners', throws: 'L', slot: 'three', tempo: 1.4, command: 0.22,
      tell: 'A lefty with four pitches who lives on the corners and never gives in.',
      read: "He won't throw you a cookie. Shrink your zone and take the corners; he walks people. Make him come over the plate.",
      arsenal: { FF: { mph: 89, ivb: 14, hb: 9 }, FC: { mph: 86, ivb: 9, hb: -4 }, CH: { mph: 79, ivb: 7, hb: 15 }, CU: { mph: 73, ivb: -14, hb: -8 } },
      mix: {
        even: [['FC', 'blackIn', 2], ['CH', 'blackLowAway', 2], ['CU', 'blackLow', 2], ['FF', 'blackAway', 2]],
        behind: [['FF', 'blackAway', 2], ['CH', 'blackLowAway', 2], ['FC', 'blackIn', 2], ['FF', 'away', 1]],
        two: [['CU', 'dirt', 2], ['CH', 'awayOff', 2], ['FC', 'inOff', 2]],
        full: [['CH', 'blackLowAway', 2], ['FF', 'blackAway', 2], ['CU', 'blackLow', 1]]
      },
      colors: { jersey: '#c8c2b2', trim: '#204a87', cap: '#204a87', pants: '#d6d0c0' }, number: 21
    }
  };
  const IDS = Object.keys(PITCHERS);

  // batting practice: a coach lobbing it in, for the derby and the cage
  const COACH = {
    id: 'coach', name: 'BP Coach', tag: 'Grooving it', throws: 'R', slot: 'three', tempo: 1.1, command: 0.32,
    arsenal: { FF: { mph: 72, ivb: 10, hb: 4 } }, mix: { even: [['FF', 'heart', 3], ['FF', 'up', 1], ['FF', 'middleIn', 1], ['FF', 'middleAway', 1]] },
    colors: { jersey: '#3a3f4a', trim: '#f3f1ea', cap: '#20242c', pants: '#2b2f38' }, number: 0
  };

  const SITUATIONS = {
    empty: { id: 'empty', label: 'Bases empty', runners: [0, 0, 0], outs: 0, goal: null },
    leadoff: { id: 'leadoff', label: 'Leading off', runners: [0, 0, 0], outs: 0, goal: 'onbase', want: 'Get on base, any way you can.', read: 'Leading off, a walk is as good as a single. Make him throw you strikes.' },
    sacfly: { id: 'sacfly', label: 'Runner on third, one out', runners: [0, 0, 1], outs: 1, goal: 'score', want: 'Get him in: a fly ball does it.', read: 'Get the ball in the air to the outfield and he walks in. Look for something up and lift it; a ground ball to the left side keeps him at third.' },
    hitrun: { id: 'hitrun', label: 'Hit-and-run, runner on first', runners: [1, 0, 0], outs: 1, running: true, goal: 'hitrun', want: 'He is running: put the ball in play.', read: "He's running on the pitch. Swing at anything close and put it on the ground, ideally to the right side. A swing and miss hangs him out to dry." },
    move: { id: 'move', label: 'Runner on second, nobody out', runners: [0, 1, 0], outs: 0, goal: 'move', want: 'Move him over to third.', read: 'Get him to third. A ground ball to the right side does it; let the ball travel and go the other way.' },
    twoout: { id: 'twoout', label: 'Runner on second, two outs', runners: [0, 1, 0], outs: 2, goal: 'score', want: 'Two outs: a hit scores him.', read: 'A fly ball does nothing with two outs. Shorten up and find a hole: any hit scores him.' },
    loaded: { id: 'loaded', label: 'Bases loaded, one out', runners: [1, 1, 1], outs: 1, goal: 'score', want: "He can't walk you. Get a run in.", read: "He can't afford a walk, so the pitch is coming. Take the close ones early; when he comes over the plate, don't miss it." }
  };
  const SIT_IDS = Object.keys(SITUATIONS);

  function countGroup(b, s) {
    if (b === 3 && s === 2) return 'full';
    if (s === 2) return 'two';
    if (b >= 2 && b > s) return 'behind';
    return 'even';
  }
  const COUNT_WORDS = { behind: "a hitter's count", two: 'two strikes', even: 'an even count', full: 'a full count' };

  function pick(list, rand) {
    const tot = list.reduce((a, x) => a + x[2], 0);
    let r = rand() * tot;
    for (const x of list) { r -= x[2]; if (r <= 0) return x; }
    return list[list.length - 1];
  }
  // what's coming: the pitch, where he's aiming, and where his command puts it
  function nextPitch(P, b, s, bats, rand, opts) {
    const o = opts || {};
    const g = countGroup(b, s);
    const list = (P.mix[g] || P.mix.even).filter(x => !o.only || o.only.includes(x[0]));
    const [typeId, loc] = pick(list.length ? list : P.mix.even, rand);
    const aim = Pitch.target(loc, bats);
    const sd = P.command * (o.commandScale || 1);
    const at = [aim[0] + Pitch.gauss(rand) * sd, aim[1] + Pitch.gauss(rand) * sd * 0.9];
    return { typeId, loc, aim: at, over: P.arsenal[typeId] || null, group: g };
  }

  /* An at-bat's grade is about the approach, not the luck: swinging at
     strikes, taking balls, hunting in your counts, protecting with two
     strikes, hitting it hard, and doing what the situation needed. */
  function grade(ab) {
    let sc = 0;
    const flags = { chase: null, tookHeart: null, lookingK: false, early: null };
    ab.pitches.forEach(p => {
      const g = countGroup(p.b, p.s);
      if (!p.swung) {
        if (!p.strike) sc += p.out > 0.3 ? 1 : 0.5;
        else if (p.heart) { sc -= g === 'behind' ? 1.5 : 1; if (!flags.tookHeart) flags.tookHeart = p; }
        else if (p.s === 2) sc -= 1.5;
        else sc -= 0.2;
      } else {
        if (!p.strike) { sc -= p.out > 0.35 ? 2 : p.s === 2 ? 0.3 : 1; if (p.out > 0.2 && !flags.chase) flags.chase = p; }
        else if (p.heart) sc += g === 'behind' ? 1.5 : 1;
        else sc += p.s === 2 ? 0.8 : 0.3;
        if (p.timing != null && p.typeOff && p.timing < -0.05 && !flags.early) flags.early = p;
      }
    });
    const r = ab.result || {};
    if (r.contact) { if (r.contact.barrel) sc += 2; else if (r.contact.hard) sc += 1; else if (r.contact.ev < 70) sc -= 0.5; }
    if (r.kind === 'walk' || r.kind === 'hbp') sc += 1;
    if (r.kind === 'k') { sc -= 1; if (r.looking) flags.lookingK = true; }
    if (ab.sitSuccess === true) sc += 2;
    if (ab.sitSuccess === false) sc -= 1;
    const letter = sc >= 3 ? 'A' : sc >= 1.5 ? 'B' : sc >= 0 ? 'C' : sc >= -1.5 ? 'D' : 'F';
    return { letter, score: sc, flags };
  }

  return { PITCHERS, IDS, COACH, SITUATIONS, SIT_IDS, countGroup, COUNT_WORDS, nextPitch, grade };
})();
