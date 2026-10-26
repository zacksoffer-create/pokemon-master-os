/* Living School · events. Two kinds:
   BEATS happen on the calendar (first day, tryouts, Friday games, the dance,
   exams, the last party). EVENTS can happen wherever you go, when the right
   people are there and the conditions fit. Each choice changes relationships
   and leaves memories the characters bring up later.

   A choice's run() returns { text } and optionally:
     hoops: { spec, done(st, result) -> { text } }   play basketball, then resolve
     exam: n                                          run n class microgames */
const SchoolEvents = (() => {
  const D = SchoolData, Sim = SchoolSim;
  const N = id => D.BY_ID[id];
  const F = id => N(id).first;
  const they = id => ({ he: 'he', she: 'she', they: 'they' }[N(id).pro]);
  const them = id => ({ he: 'him', she: 'her', they: 'them' }[N(id).pro]);
  const their = id => ({ he: 'his', she: 'her', they: 'their' }[N(id).pro]);
  const rel = (st, id) => st.npcs[id];
  const charmCheck = (st, base) => Sim.live(st) < base + (st.player.stats.charm - 50) / 100;

  function hoopsOpponent(st, id) {
    const c = N(id);
    return { name: c.name, short: c.first, skill: c.hoops.skill, favorites: c.hoops.spots, skin: c.look.skin, sleeve: c.look.shirt, lines: c.hoops.trash, blurb: c.bio };
  }
  function horseResult(st, id, res) {
    const r = st.rivalry[id] = st.rivalry[id] || { w: 0, l: 0 };
    if (res.quit) return { text: 'You walked off the court. Nobody\'s keeping score of that one. Well, they are.' };
    if (res.won) {
      r.w++;
      Sim.adjust(st, id, { friend: 4, rival: 8 });
      Sim.remember(st, id, { k: 'horse', v: N(id).traits.confidence > 0.8 ? -1 : 1, recall: 'that HORSE game', line: N(id).traits.confidence > 0.8 ? 'Rematch. I mean it. You got lucky in HORSE.' : 'You owe me a rematch in HORSE.', t: 'You beat me in HORSE.' });
      Sim.stat(st, 'athletics', 1.5);
      Sim.log(st, `Beat ${F(id)} in HORSE. All-time: ${r.w}-${r.l}.`, 'hoops');
      return { text: `You beat ${F(id)}. ${N(id).traits.confidence > 0.8 ? `${F(id)} is already demanding a rematch.` : `${F(id)} laughs and shoves you.`} All-time vs ${F(id)}: ${r.w}-${r.l}.` };
    }
    r.l++;
    Sim.adjust(st, id, { friend: 3, rival: 4 });
    Sim.remember(st, id, { k: 'horse', v: 1, recall: 'when I smoked you in HORSE', line: 'Want another HORSE lesson?', t: 'I beat you in HORSE.' });
    Sim.log(st, `Lost to ${F(id)} in HORSE. All-time: ${r.w}-${r.l}.`, 'hoops');
    return { text: `${F(id)} wins. ${Sim.pickLive(st, N(id).hoops.trash)} All-time vs ${F(id)}: ${r.w}-${r.l}.` };
  }

  // ---------- calendar beats ----------
  const BEATS = [
    {
      id: 'first_day', when: st => st.day === 0 && st.seen.first_day == null && Sim.curSlot(st).id === 'morning',
      faces: () => ['jordan'], title: 'First day at Hollow Creek',
      text: st => `The front office hands you a schedule and a locker combination that doesn't work. A kid with purple hair grabs your arm. "Hi. Jordan. I'm your Student Ambassador, which means I know everything and I'm legally required to tell you some of it."`,
      choices: st => [
        { label: 'Let Jordan give you the full tour', run: st => { Sim.adjust(st, 'jordan', { friend: 10 }); Sim.remember(st, 'jordan', { k: 'tour', v: 1, recall: 'your tour', line: 'Still the best tour I\'ve ever given. You\'re welcome.', t: 'I gave you the tour.' }); Sim.addGossip(st, { key: 'couple-ms', text: 'Marcus and Sofia have been "on and off" since sophomore year. Currently on.', about: ['marcus', 'sofia'] }); return { text: `Jordan talks for twenty straight minutes. You learn where the good bathroom is, that Marcus and Sofia are "currently on," and that you should never, ever sit at the robotics table during a competition week.` }; } },
        { label: 'Ask who to avoid', run: st => { Sim.adjust(st, 'jordan', { friend: 8 }); Sim.learn(st, 'jordan', 'likes', 'movies'); Sim.addGossip(st, { key: 'tyler-cut', text: 'Tyler got a sophomore cut from the team last year for "taking his spot."', about: ['tyler'] }); return { text: `"Oh, I love this question." Jordan lowers their voice. "Tyler Reyes. Not evil, just... a lot. He got a sophomore cut last year for 'taking his spot.' Also never talk to me during a movie."` }; } },
        { label: 'Ask about the basketball team', run: st => { Sim.adjust(st, 'jordan', { friend: 5 }); st.player.flags.knowsTryouts = true; return { text: `"Ugh, sports." But Jordan points you toward the gym anyway. "Marcus Bell is the captain. Tryouts are next Tuesday. Coach Dwyer posts a sign-up sheet in the gym and yells at anyone who reads it too slowly."` }; } }
      ]
    },
    {
      id: 'announcements', when: st => !st.player.signedUp && st.seen.announcements == null && Sim.dayInfo(st.day).week === 1 && Sim.dayInfo(st.day).dow >= 2 && Sim.curSlot(st).id === 'morning',
      faces: () => ['marcus'], title: 'Morning announcements',
      text: () => 'The PA crackles through homeroom. "Basketball tryouts are next Tuesday after school. Sign-up sheet is on the gym door. Coach Dwyer asks that you, quote, show up on time and bring your own water." Marcus, two rows over, turns around and points at you.',
      choices: () => [
        { label: 'Sign up on the way to class', run: st => { st.player.signedUp = true; Sim.adjust(st, 'marcus', { friend: 4 }); Sim.log(st, 'Signed up for basketball tryouts.', 'note'); return { text: 'Your name goes under Marcus\'s on the sheet. Tryouts are Tuesday of week 2, after school. Practice at the gym or the park before then wouldn\'t hurt.' }; } },
        { label: 'Basketball isn\'t my thing', run: () => ({ text: 'Marcus shrugs and turns back around. There are other ways to spend an afternoon at Hollow Creek.' }) }
      ]
    },
    {
      id: 'tryouts', when: st => st.player.signedUp && !st.player.team && !st.player.flags.triedOut && Sim.dayInfo(st.day).week === 2 && Sim.dayInfo(st.day).dow === 1 && Sim.curSlot(st).id === 'after',
      faces: () => ['marcus', 'tyler'], title: 'Tryouts',
      text: st => `The gym smells like floor wax and nerves. Coach Dwyer has a clipboard and no expression. "Four live possessions, then free throws. Show me you can read a defender. I don't need another kid who just jacks it up." Tyler is watching from the bleachers like it's his gym.`,
      choices: st => [
        { label: 'Lace up', sub: 'Four possessions, then free throws', run: st => ({
          text: 'You step onto the floor.',
          hoops: {
            spec: { kind: 'possessions', court: 'gym', count: 4, shotClock: 6, title: 'Tryouts', situation: 'Coach Dwyer is watching', showTags: true, plan: [{ defender: 'sagger' }, { defender: 'closer' }, { defender: 'baseline' }, { defender: 'pest' }] },
            then: { kind: 'shots', court: 'gym', title: 'Tryouts · Free throws', shots: [{ spot: 'ft', label: 'Free throw 1 of 3' }, { spot: 'ft', label: 'Free throw 2 of 3' }, { spot: 'ft', label: 'Free throw 3 of 3' }] },
            done: (st, res, res2) => {
              st.player.flags.triedOut = true;
              const pts = res.points || 0, iq = res.readIQ || 0, ft = res2 ? res2.makes : 0;
              const line = `${pts} points on four live possessions (read IQ ${iq}) and ${ft} of 3 at the line.`;
              const score = pts + ft * 1.5 + iq / 25 + st.player.stats.athletics / 25;
              let team = null;
              if (score >= 11) team = 'varsity'; else if (score >= 5.5) team = 'jv';
              st.player.team = team;
              Sim.log(st, team ? `Made ${team === 'varsity' ? 'varsity' : 'JV'}. ${pts} points and ${ft}/3 at the line in tryouts.` : `Got cut at tryouts.`, 'big');
              if (team) {
                Sim.adjust(st, 'marcus', { friend: 8 });
                Sim.remember(st, 'marcus', { k: 'tryout', v: 1.5, recall: 'tryouts', line: 'Knew you\'d make it the second I saw your tryout.', t: 'You made the team.' });
                if (team === 'varsity') { Sim.adjust(st, 'tyler', { rival: 25, friend: -5 }); Sim.remember(st, 'tyler', { k: 'spot', v: -1.5, recall: 'my spot', line: 'Enjoy MY minutes.', t: 'You took my minutes.' }); }
                return { text: line + ' ' + (team === 'varsity' ? `The list goes up at 4:15. Your name is on it. Varsity. Marcus slaps your back so hard you cough. Tyler reads the list twice and walks out without a word. Practice is after school, games are Friday nights.` : `The list goes up at 4:15. JV. Not the top list, but you're on a team. Coach Dwyer tells you "show me something" and you can move up. Practice is after school, games are Friday nights.`) };
              }
              return { text: line + ` The list goes up at 4:15. Your name isn't on it. Coach Dwyer catches you in the hall: "You've got a decent stroke. Work on your reads and come back next year." Delaney Park still has open runs every afternoon.` };
            }
          }
        }) },
        { label: 'Skip it', run: st => { st.player.flags.triedOut = true; st.player.signedUp = false; Sim.adjust(st, 'marcus', { friend: -3 }); return { text: 'You walk past the gym and keep going. Somewhere inside, a whistle blows.' }; } }
      ]
    },
    {
      id: 'game_night', when: st => !!st.player.team && Sim.dayInfo(st.day).dow === 4 && Sim.dayInfo(st.day).week >= 3 && Sim.curSlot(st).id === 'evening' && !st.season.games.some(g => g.week === Sim.dayInfo(st.day).week),
      faces: st => D.CAST.filter(c => rel(st, c.id).coming === Sim.dayInfo(st.day).week).map(c => c.id).slice(0, 4).concat(['marcus']).slice(0, 4),
      title: st => { const o = D.OPPONENTS.find(x => x.week === Sim.dayInfo(st.day).week); return `Game night · vs ${o.name}`; },
      text: st => {
        const o = D.OPPONENTS.find(x => x.week === Sim.dayInfo(st.day).week);
        const fans = D.CAST.filter(c => rel(st, c.id).coming === Sim.dayInfo(st.day).week).map(c => c.first);
        const rec = `${st.season.w}-${st.season.l}`;
        return `Hollow Creek (${rec}) hosts the ${o.name} ${o.mascot}.${o.rival ? ' The rivalry game. The student section is painted green.' : ''} ${fans.length ? `In the stands: ${fans.join(', ')}.` : 'The bleachers are half full.'} ${st.player.team === 'jv' ? 'JV plays first; Coach says you might get varsity minutes if it\'s close.' : ''} Fourth quarter, and it comes down to the last two possessions.`;
      },
      choices: st => [
        { label: 'Play the fourth quarter', sub: 'Two possessions, game on the line', run: st => {
          const o = D.OPPONENTS.find(x => x.week === Sim.dayInfo(st.day).week);
          const pick = () => Sim.pickLive(st, o.strength > 0.6 ? ['closer', 'long', 'pest', 'gambler'] : ['sagger', 'baseline', 'middle', 'closer', 'gambler']);
          const margin = Math.round((0.5 - o.strength) * 6 + (Sim.live(st) - 0.5) * 4);
          const sit1 = margin < 0 ? `Down ${-margin} · 0:41 left` : margin > 0 ? `Up ${margin} · 0:41 left` : 'Tied · 0:41 left';
          return {
            text: 'Coach Dwyer calls your number.',
            hoops: {
              spec: { kind: 'possessions', court: 'gym', count: 2, shotClock: 6, title: `vs ${o.name}`, plan: [{ defender: pick(), situation: sit1 }, { defender: pick(), situation: 'Last possession · 0:07 left' }], fatigue: Math.max(0, (60 - st.player.energy) / 100) },
              done: (st, res) => gameResult(st, o, margin, res)
            }
          };
        } },
        { label: 'Stay on the bench', sub: 'Let the starters close it', run: st => {
          const o = D.OPPONENTS.find(x => x.week === Sim.dayInfo(st.day).week);
          return gameResult(st, o, 0, null);
        } }
      ]
    },
    {
      id: 'snow_ball', when: st => Sim.dayInfo(st.day).week === 4 && Sim.dayInfo(st.day).dow === 5 && Sim.curSlot(st).id === 'night',
      faces: st => st.player.date ? [st.player.date] : ['jordan', 'sofia'], title: 'The Snow Ball',
      text: st => st.player.date
        ? `The gym is unrecognizable: paper snowflakes, a fog machine that keeps setting off the smoke detector, and ${F(st.player.date)} looking better than anyone has a right to in a gym.`
        : `The gym is unrecognizable: paper snowflakes, a fog machine that keeps setting off the smoke detector. You came solo. Jordan is already on the dance floor, alone, thriving.`,
      choices: st => {
        const d = st.player.date;
        if (d) return [
          { label: `Slow dance with ${F(d)}`, run: st => { Sim.adjust(st, d, { friend: 8, romance: 14 }); Sim.remember(st, d, { k: 'slowdance', v: 3, recall: 'the Snow Ball', line: 'I keep thinking about the Snow Ball.', t: 'We slow danced at the Snow Ball.' }); Sim.mood(st, 15); Sim.log(st, `Slow danced with ${F(d)} at the Snow Ball.`, 'big'); return { text: `The DJ plays something slow. ${F(d)} puts ${their(d)} hands on your shoulders and laughs when you step on ${their(d)} foot. You'll remember this one.` }; } },
          { label: 'Get the whole group dancing', run: st => { Sim.adjust(st, d, { friend: 6, romance: 5 }); ['jordan', 'darnell', 'sofia', 'maya'].forEach(x => Sim.adjust(st, x, { friend: 3 })); Sim.remember(st, d, { k: 'dance', v: 2, recall: 'the Snow Ball', line: 'The Snow Ball was so fun. You dance terribly, by the way.', t: 'We went to the Snow Ball together.' }); Sim.mood(st, 10); return { text: `By the end of the night, half the school is doing the cha-cha slide and Coach Dwyer is pretending not to watch. ${F(d)} can't stop laughing.` }; } }
        ];
        return [
          { label: 'Join Jordan on the floor', run: st => { Sim.adjust(st, 'jordan', { friend: 10 }); Sim.remember(st, 'jordan', { k: 'dance', v: 2, recall: 'the Snow Ball', line: 'Our Snow Ball choreography deserved a Tony.', t: 'You danced with me at the Snow Ball.' }); Sim.mood(st, 10); return { text: 'Jordan teaches you a dance that "will be iconic by Monday." It is not. It is a lot of fun.' }; } },
          { label: 'Hang by the snacks', run: st => { const who = Sim.pickLive(st, ['darnell', 'eli', 'maya']); Sim.adjust(st, who, { friend: 8 }); Sim.remember(st, who, { k: 'snacks', v: 1, recall: 'the snack table', line: 'Snow Ball snack table crew forever.', t: 'We hid by the snacks at the Snow Ball.' }); return { text: `${F(who)} is also hiding by the snacks. You spend the dance rating the cookies out of ten. Mostly sevens.` }; } }
        ];
      }
    },
    {
      id: 'midterms', when: st => Sim.dayInfo(st.day).week === 5 && Sim.dayInfo(st.day).dow === 3 && st.phase === 'class',
      faces: () => ['priya'], title: 'Midterms',
      text: () => 'Three exams in one day. Priya is reviewing flashcards in the hallway at a speed that seems unsafe.',
      choices: () => [{ label: 'Take your exams', sub: 'Three classes back to back', run: () => ({ text: 'Pencils down in three... two...', exam: 3 }) }]
    },
    {
      id: 'finals', when: st => Sim.dayInfo(st.day).week === 8 && Sim.dayInfo(st.day).dow === 3 && st.phase === 'class',
      faces: () => ['priya', 'tyler'], title: 'Finals',
      text: () => 'The last exams of the semester. Tyler is sitting in the front row for the first time all year.',
      choices: () => [{ label: 'Take your finals', sub: 'Three classes back to back', run: () => ({ text: 'Last stretch.', exam: 3 }) }]
    }
  ];

  function gameResult(st, o, margin, res) {
    const week = Sim.dayInfo(st.day).week;
    const yourPts = res ? res.points : 0;
    const team = st.player.team;
    const base = team === 'varsity' ? 0.55 : 0.45;
    const swing = res ? (yourPts - 2.2) * 1.4 + ((res.readIQ || 50) - 55) / 30 : 0;
    const finalMargin = Math.round(margin + swing + (base - o.strength) * 6 + (Sim.live(st) - 0.5) * 3);
    const won = finalMargin > 0 || (finalMargin === 0 && Sim.live(st) < 0.5);
    const us = 48 + Math.round(Sim.live(st) * 16), them2 = us + (won ? -Math.max(1, Math.abs(finalMargin)) : Math.max(1, Math.abs(finalMargin)));
    st.season[won ? 'w' : 'l']++;
    st.season.games.push({ week, opp: o.name, us, them: them2, won, pts: yourPts });
    const clutch = res && res.log && res.log.length >= 2 && res.log[1].points >= 2;
    const fans = D.CAST.filter(c => rel(st, c.id).coming === week).map(c => c.id);
    fans.forEach(id => {
      Sim.adjust(st, id, { friend: won ? 6 : 3 });
      Sim.remember(st, id, { k: 'game' + week, v: clutch ? 2.5 : 1, recall: `the ${o.name} game`, line: clutch ? `I still have the video of your shot against ${o.name}.` : `That ${o.name} game was fun. Loud, but fun.`, t: `I came to your game against ${o.name}.` });
      Sim.text(st, id, clutch ? Sim.pickLive(st, ['YOU HIT THAT SHOT', 'ok that last shot??? i screamed', 'i have it on video. framing it']) : won ? Sim.pickLive(st, ['good game!!', 'we WON', 'fun night']) : Sim.pickLive(st, ['you played good though', 'refs were blind', 'next week']));
    });
    D.CAST.filter(c => ['marcus', 'tyler', 'hannah'].includes(c.id)).forEach(c => {
      Sim.adjust(st, c.id, { friend: won ? 3 : 0 });
      if (clutch && c.id !== 'tyler') Sim.remember(st, c.id, { k: 'clutch' + week, v: 2, recall: `your shot against ${o.name}`, line: `Still thinking about your shot against ${o.name}.`, t: `You hit the big shot against ${o.name}.` });
    });
    if (clutch) { Sim.adjust(st, 'tyler', { rival: 8 }); Sim.mood(st, 15); }
    else Sim.mood(st, won ? 8 : -6);
    Sim.stat(st, 'athletics', 1.5);
    Sim.log(st, `${won ? 'Beat' : 'Lost to'} ${o.name}, ${Math.max(us, them2)}-${Math.min(us, them2)}.${yourPts ? ` You scored ${yourPts} in the fourth.` : ''}${clutch ? ' Hit the last shot.' : ''}`, won ? 'win' : 'loss');
    if (o.final) st.player.flags.finalWon = won;
    const head = won ? `Final: Hollow Creek ${us}, ${o.name} ${them2}.` : `Final: ${o.name} ${them2}, Hollow Creek ${us}.`;
    const body = !res ? 'You watch from the bench.' : clutch ? 'Your last-second bucket is the one everybody will talk about Monday.' : yourPts ? `You put up ${yourPts} in the fourth.` : 'Your looks didn\'t fall tonight.';
    return { text: `${head} ${body} Record: ${st.season.w}-${st.season.l}.${o.final && won ? ' Hollow Creek wins the rivalry, and the gym empties onto the floor.' : ''}` };
  }

  // ---------- events that can happen where you go ----------
  const presentWith = (ctx, f) => ctx.present.filter(f);
  const EVENTS = [
    {
      id: 'signup', slots: ['morning', 'after'], places: ['gym', 'hall', 'practice'], weight: 6, once: true,
      need: (st, ctx) => Sim.dayInfo(st.day).week === 1 && !st.player.signedUp,
      cast: () => ({}), faces: () => ['marcus'], title: 'The sign-up sheet',
      text: st => `There's a sheet taped to the gym door: BOYS & GIRLS BASKETBALL TRYOUTS, TUESDAY WEEK 2, 3:15 SHARP. It has fourteen names on it. Marcus Bell's handwriting is huge.`,
      choices: () => [
        { label: 'Sign up', run: st => { st.player.signedUp = true; Sim.log(st, 'Signed up for basketball tryouts.', 'note'); return { text: 'You write your name under Marcus\'s. Tryouts are next Tuesday after school.' }; } },
        { label: 'Not for me', run: () => ({ text: 'You keep walking. Plenty of other ways to spend an afternoon.' }) }
      ]
    },
    {
      id: 'study_help', slots: ['morning', 'lunch', 'after'], weight: 3, cooldown: 4,
      cast: (st, ctx) => { const xs = presentWith(ctx, id => N(id).traits.ambition < 0.75 && rel(st, id).friend > -20); return xs.length ? { a: Sim.pickLive(st, xs) } : null; },
      faces: x => [x.a], title: 'A favor',
      text: (st, x) => `${F(x.a)} slides over with a crumpled worksheet. "Okay, I'm drowning in this chem stuff. Any chance you could explain it? Like, slowly?"`,
      choices: (st, x) => [
        { label: 'Walk them through it', sub: 'Costs energy', run: st => { Sim.energy(st, -12); Sim.stat(st, 'smarts', 1.5); Sim.adjust(st, x.a, { friend: 12 }); Sim.remember(st, x.a, { k: 'helped', v: 2, recall: 'you helping me with chem', line: 'I passed that chem quiz, by the way. Because of you.', t: 'You helped me with chem.' }); return { text: `It takes forty minutes and two diagrams on a napkin, but it clicks. ${F(x.a)} looks at you like you just performed surgery.` }; } },
        { label: 'Give them your notes', run: st => { Sim.adjust(st, x.a, { friend: 6 }); Sim.remember(st, x.a, { k: 'notes', v: 1, recall: 'your notes', line: 'Your notes are illegible but they saved me.', t: 'You lent me your notes.' }); return { text: `"You're a lifesaver." ${F(x.a)} takes a picture of every page.` }; } },
        { label: 'Sorry, I\'m swamped', run: st => { Sim.adjust(st, x.a, { friend: -3 }); return { text: `"Yeah. No, totally." ${F(x.a)} goes to find someone else.` }; } }
      ]
    },
    {
      id: 'side_pick', slots: ['lunch', 'morning', 'after', 'day'], weight: 3, cooldown: 5,
      cast: (st, ctx) => {
        const ids = ctx.present;
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (Sim.bond(st, ids[i], ids[j]) < -10) return { a: ids[i], b: ids[j] };
        return null;
      },
      faces: x => [x.a, x.b], title: 'Caught in the middle',
      text: (st, x) => `${F(x.a)} and ${F(x.b)} are going at it about something that started as a joke. Then ${F(x.a)} turns to you. "Tell ${them(x.b)} I'm right."`,
      choices: (st, x) => [
        { label: `Back ${F(x.a)}`, run: st => { Sim.adjust(st, x.a, { friend: 9 }); Sim.adjust(st, x.b, { friend: -10 }); Sim.addBond(st, x.a, x.b, -4); Sim.remember(st, x.a, { k: 'backed', v: 2, recall: `when you backed me up against ${F(x.b)}`, line: `You had my back with ${F(x.b)}. I don't forget that.`, t: `You took my side against ${F(x.b)}.` }); Sim.remember(st, x.b, { k: 'sided', v: -2, recall: `siding with ${F(x.a)}`, line: `Didn't love you siding with ${F(x.a)}, just so you know.`, t: `You sided with ${F(x.a)}.` }); return { text: `${F(x.a)} looks vindicated. ${F(x.b)} looks at you like you're a stranger.` }; } },
        { label: `Back ${F(x.b)}`, run: st => { Sim.adjust(st, x.b, { friend: 9 }); Sim.adjust(st, x.a, { friend: -10 }); Sim.addBond(st, x.a, x.b, -4); Sim.remember(st, x.b, { k: 'backed', v: 2, recall: `when you backed me up against ${F(x.a)}`, line: `You had my back with ${F(x.a)}. I don't forget that.`, t: `You took my side against ${F(x.a)}.` }); Sim.remember(st, x.a, { k: 'sided', v: -2, recall: `siding with ${F(x.b)}`, line: `Didn't love you siding with ${F(x.b)}, just so you know.`, t: `You sided with ${F(x.b)}.` }); return { text: `${F(x.b)} grins. ${F(x.a)} goes quiet in a way that feels permanent.` }; } },
        { label: 'Try to cool it down', sub: 'Charm', run: st => { if (charmCheck(st, 0.45)) { Sim.addBond(st, x.a, x.b, 12); Sim.adjust(st, x.a, { friend: 5 }); Sim.adjust(st, x.b, { friend: 5 }); Sim.stat(st, 'charm', 1.5); [x.a, x.b].forEach(id => Sim.remember(st, id, { k: 'peace', v: 1.5, recall: 'when you broke up the fight', line: 'You were weirdly good at breaking up that fight.', t: 'You calmed things down.' })); return { text: `You make a dumb joke at exactly the right moment. They both crack. It's over, for now.` }; } Sim.adjust(st, x.a, { friend: -3 }); Sim.adjust(st, x.b, { friend: -3 }); return { text: '"Stay out of it." They say it at the same time, which is the only thing they agree on today.' }; } },
        { label: 'Stay out of it', run: st => ({ text: 'You suddenly get very interested in your tater tots.' }) }
      ]
    },
    {
      id: 'secret', slots: ['morning', 'lunch', 'after', 'evening', 'day', 'night'], weight: 3, cooldown: 3,
      cast: (st, ctx) => { const xs = presentWith(ctx, id => rel(st, id).friend >= 34 && !st.gossip.some(g => g.secret && g.owner === id)); return xs.length ? { a: Sim.pickLive(st, xs) } : null; },
      faces: x => [x.a], title: 'Between you two',
      text: (st, x) => `${F(x.a)} pulls you aside, checks that nobody's listening, and lowers ${their(x.a)} voice. ${N(x.a).secret.text}`,
      choices: (st, x) => [
        { label: 'Promise to keep it quiet', run: st => { const s = N(x.a).secret; Sim.addGossip(st, { key: 'secret-' + x.a, secret: true, owner: x.a, about: [x.a], text: s.text, short: s.short, recall: s.recall }); Sim.adjust(st, x.a, { friend: 10 }); Sim.remember(st, x.a, { k: 'trust', v: 2.5, recall: 'what I told you', line: 'Thanks for keeping that thing between us. Seriously.', t: 'I told you something real.' }); return { text: `"Thanks. I mean it." ${F(x.a)} looks lighter. You now know something nobody else does. (It's in your phone's notes. So is the temptation.)` }; } },
        { label: 'Tell them it\'s going to be okay', run: st => { const s = N(x.a).secret; Sim.addGossip(st, { key: 'secret-' + x.a, secret: true, owner: x.a, about: [x.a], text: s.text, short: s.short, recall: s.recall }); Sim.adjust(st, x.a, { friend: 8, mood: 0.3 }); Sim.remember(st, x.a, { k: 'trust', v: 2, recall: 'what I told you', line: 'You were right, by the way. It\'s going okay.', t: 'I told you something real.' }); return { text: `${F(x.a)} exhales. "Yeah. Maybe." It helped more than either of you expected.` }; } }
      ]
    },
    {
      id: 'overheard', slots: ['lunch', 'morning'], weight: 2, cooldown: 3,
      cast: st => { const c = st.couples.find(([a, b]) => !st.gossip.some(g => g.key === 'heard' + a + b)); if (c) return { a: c[0], b: c[1] }; const ids = D.CAST.map(x => x.id); const a = Sim.pickLive(st, ids), b = Sim.pickLive(st, ids.filter(x => x !== a)); return Sim.bond(st, a, b) > 40 && !st.gossip.some(g => g.key === 'heard' + a + b) ? { a, b, close: true } : null; },
      faces: x => [x.a, x.b], title: 'Overheard',
      text: (st, x) => x.close ? `Two juniors behind you are convinced that ${F(x.a)} and ${F(x.b)} are "basically a thing." They are very loud about it.` : `Two juniors behind you are convinced ${F(x.a)} and ${F(x.b)} are fighting again. "She's not even sitting with him."`,
      choices: (st, x) => [
        { label: 'File that away', run: st => { Sim.addGossip(st, { key: 'heard' + x.a + x.b, text: x.close ? `${F(x.a)} and ${F(x.b)} are "basically a thing."` : `${F(x.a)} and ${F(x.b)} might be fighting again.`, about: [x.a, x.b] }); return { text: 'Noted. Gossip is currency at Hollow Creek, and you just got paid.' }; } },
        { label: 'Tell them to mind their business', run: st => { Sim.stat(st, 'charm', 0.5); [x.a, x.b].forEach(id => { if (rel(st, id).met) Sim.adjust(st, id, { friend: 2 }); }); return { text: 'They glare at you and switch to talking about a TV show. Somehow, word gets around that you shut it down.' }; } }
      ]
    },
    {
      id: 'horse_challenge', slots: ['after', 'morning', 'day'], places: ['park', 'gym', 'practice'], weight: 4, cooldown: 3,
      cast: (st, ctx) => { const xs = presentWith(ctx, id => N(id).hoops && N(id).hoops.skill >= 0.5); return xs.length ? { a: Sim.pickLive(st, xs) } : null; },
      faces: x => [x.a], title: 'HORSE?',
      text: (st, x) => { const r = st.rivalry[x.a]; return `${F(x.a)} spins a ball on one finger. "HORSE. Loser buys fries at Rosie's."${r ? ` (You're ${r.w}-${r.l} against ${them(x.a)}.)` : ''}`; },
      choices: (st, x) => [
        { label: 'You\'re on', sub: `${F(x.a)} likes the ${N(x.a).hoops.spots.includes('lc') ? 'corners' : N(x.a).hoops.spots.includes('lbk') ? 'blocks' : N(x.a).hoops.spots.includes('deep') ? 'deep threes' : 'elbows'}`, run: st => ({
          text: `${F(x.a)} checks you the ball.`,
          hoops: { spec: { kind: 'horse', court: Sim.curSlot(st).id === 'morning' ? 'gym' : 'park', title: 'HORSE', opponent: hoopsOpponent(st, x.a) }, done: (st, res) => { const out = horseResult(st, x.a, res); if (!res.won && !res.quit) Sim.mood(st, -2); return out; } }
        }) },
        { label: 'Maybe later', run: st => { Sim.adjust(st, x.a, { rival: 2 }); return { text: `"Scared." ${F(x.a)} says it like a fact.` }; } }
      ]
    },
    {
      id: 'rival_trash', slots: ['after', 'morning'], places: ['practice', 'gym'], weight: 3, cooldown: 4,
      need: st => !!st.player.team,
      cast: (st, ctx) => ctx.present.includes('tyler') ? { a: 'tyler' } : null,
      faces: () => ['tyler'], title: 'Tyler has thoughts',
      text: st => `Tyler bumps you on the way to the water fountain. "${st.player.team === 'varsity' ? 'Enjoy it while it lasts. Coach is gonna figure you out.' : 'JV looks good on you.'}"`,
      choices: () => [
        { label: 'Challenge him to HORSE', run: st => ({ text: '"Bet."', hoops: { spec: { kind: 'horse', court: 'gym', title: 'HORSE', opponent: hoopsOpponent(st, 'tyler') }, done: (st, res) => horseResult(st, 'tyler', res) } }) },
        { label: 'Laugh it off', run: st => { Sim.adjust(st, 'tyler', { friend: 2 }); Sim.stat(st, 'charm', 0.5); return { text: 'You laugh. It annoys him more than anything you could have said.' }; } },
        { label: 'Fire back', sub: 'Charm', run: st => { if (charmCheck(st, 0.4)) { Sim.adjust(st, 'tyler', { rival: 6, friend: 3 }); return { text: 'You say something about his free throw percentage that makes Marcus choke on his Gatorade. Even Tyler almost smiles.' }; } Sim.adjust(st, 'tyler', { rival: 6, friend: -6 }); return { text: 'It comes out wrong. Tyler just shakes his head and walks off. You\'ll think of the right thing to say tonight in the shower.' }; } }
      ]
    },
    {
      id: 'diner_short', slots: ['after', 'day'], places: ['diner'], weight: 3, cooldown: 4,
      cast: (st, ctx) => { const xs = ctx.present; return xs.length ? { a: Sim.pickLive(st, xs) } : null; },
      faces: x => [x.a], title: 'The check',
      text: (st, x) => `${F(x.a)} pats every pocket twice. "So this is embarrassing. I'm eight dollars short."`,
      choices: (st, x) => [
        { label: 'Cover it ($8)', run: st => { if (st.player.money < 8) return { text: 'You check your wallet. You\'re short too. You split the shame and a plate of fries.' }; st.player.money -= 8; Sim.adjust(st, x.a, { friend: 8 }); Sim.remember(st, x.a, { k: 'covered', v: 1.5, recall: 'when you covered me at Rosie\'s', line: 'I still owe you eight bucks. I\'m aware.', t: 'You covered me at Rosie\'s.' }); return { text: `"You're a saint." ${F(x.a)} promises to pay you back. You both know that's not happening.` }; } },
        { label: 'Offer to split some fries instead', run: st => { Sim.adjust(st, x.a, { friend: 3 }); return { text: 'Disco fries fix most things.' }; } }
      ]
    },
    {
      id: 'vent_night', slots: ['evening', 'night'], weight: 3, cooldown: 3,
      cast: st => { const xs = D.CAST.filter(c => rel(st, c.id).gaveNumber && rel(st, c.id).mood < -0.25).map(c => c.id); return xs.length ? { a: Sim.pickLive(st, xs) } : null; },
      faces: x => [x.a], title: 'Late text',
      text: (st, x) => `Your phone buzzes at 11:40. ${F(x.a)}: "you up? today was really bad."`,
      choices: (st, x) => [
        { label: 'Call them', sub: 'Costs energy', run: st => { Sim.energy(st, -12); Sim.adjust(st, x.a, { friend: 12, mood: 0.5 }); Sim.remember(st, x.a, { k: 'called', v: 2.5, recall: 'that night you called', line: 'You picked up when I needed it. I won\'t forget that.', t: 'You called when I was having a bad night.' }); return { text: `You talk until one in the morning about nothing, and then about everything. ${F(x.a)} sounds better by the end.` }; } },
        { label: 'Text back something kind', run: st => { Sim.adjust(st, x.a, { friend: 5, mood: 0.2 }); return { text: '"thanks. really." Three dots, then nothing. Then a heart.' }; } },
        { label: 'Pretend you were asleep', run: st => { Sim.adjust(st, x.a, { friend: -4 }); return { text: 'You put the phone face down. It buzzes once more.' }; } }
      ]
    },
    {
      id: 'art_opinion', slots: ['after', 'morning'], places: ['art', 'courtyard'], weight: 3, cooldown: 5,
      cast: (st, ctx) => ctx.present.includes('maya') ? { a: 'maya' } : null,
      faces: () => ['maya'], title: 'Honest opinion',
      text: () => 'Maya turns her canvas around. It\'s a painting of the Newburgh-Beacon Bridge at night, mostly purple. "Be honest. And I will know if you\'re not."',
      choices: () => [
        { label: 'Give a real critique', sub: 'Creativity', run: st => { if (st.player.stats.creativity >= 52 || Sim.live(st) < 0.3) { Sim.adjust(st, 'maya', { friend: 12 }); Sim.remember(st, 'maya', { k: 'critique', v: 2, recall: 'what you said about the bridge painting', line: 'I fixed the water like you said. It\'s better. Don\'t let it go to your head.', t: 'You actually looked at my painting.' }); Sim.stat(st, 'creativity', 1); return { text: 'You say the water is too flat compared to the sky. Maya stares at it for a full minute. "...Yeah. Okay. Yeah."' }; } Sim.adjust(st, 'maya', { friend: -4 }); return { text: 'You say it needs "more pop." Maya looks physically pained.' }; } },
        { label: 'Say you love it', run: st => { Sim.adjust(st, 'maya', { friend: st.npcs.maya.friend > 30 ? 2 : -2 }); return { text: '"You\'re just being nice." She\'s not wrong.' }; } },
        { label: 'Admit you don\'t get art', run: st => { Sim.adjust(st, 'maya', { friend: 4 }); return { text: '"Honestly? Refreshing." She explains it anyway, and you kind of get it.' }; } }
      ]
    },
    {
      id: 'robot_fire', slots: ['after'], places: ['robotics'], weight: 3, cooldown: 5,
      cast: (st, ctx) => ctx.present.includes('eli') || ctx.present.includes('priya') ? { a: ctx.present.includes('priya') ? 'priya' : 'eli' } : null,
      faces: x => ['priya', 'eli'], title: 'Gerald is on fire',
      text: () => 'Gerald, the robot, is smoking. Not on fire. Smoking. Priya is yelling about a regional qualifier on Saturday. Eli is quietly holding a fire extinguisher.',
      choices: () => [
        { label: 'Help rewire the drive motor', sub: 'Smarts', run: st => { if (st.player.stats.smarts >= 50 || Sim.live(st) < 0.35) { ['priya', 'eli'].forEach(id => { Sim.adjust(st, id, { friend: 10 }); Sim.remember(st, id, { k: 'gerald', v: 2, recall: 'saving Gerald', line: 'Gerald says hi. Gerald also says thank you.', t: 'You saved Gerald.' }); }); Sim.stat(st, 'smarts', 2); return { text: 'You find the short. Gerald rolls across the room and knocks over a trash can on purpose. Priya actually hugs you.' }; } Sim.adjust(st, 'priya', { friend: -2 }); return { text: 'You make it worse. Briefly, Gerald is on fire. Eli uses the extinguisher. Nobody is hurt except Gerald.' }; } },
        { label: 'Order everyone pizza', run: st => { if (st.player.money >= 12) { st.player.money -= 12; ['priya', 'eli'].forEach(id => Sim.adjust(st, id, { friend: 6 })); return { text: 'Morale is restored. Gerald remains broken, but morale is restored.' }; } return { text: 'You don\'t have enough cash. You offer moral support instead.' }; } }
      ]
    },
    {
      id: 'run_lines', slots: ['after'], places: ['drama'], weight: 3, cooldown: 5,
      cast: (st, ctx) => ctx.present.includes('jordan') ? { a: 'jordan' } : null,
      faces: () => ['jordan', 'sofia'], title: 'Understudy',
      text: () => 'Jordan grabs both your hands. "Our understudy has mono. You have to read the part of Detective Pruitt for one rehearsal. It\'s nine lines. Four are \'what?\'"',
      choices: () => [
        { label: 'Commit to the bit', sub: 'Creativity', run: st => { Sim.stat(st, 'creativity', 2); Sim.stat(st, 'charm', 1); Sim.adjust(st, 'jordan', { friend: 10 }); Sim.adjust(st, 'sofia', { friend: 4 }); Sim.remember(st, 'jordan', { k: 'pruitt', v: 2, recall: 'Detective Pruitt', line: 'Detective Pruitt could never. You were robbed of a Tony.', t: 'You played Detective Pruitt.' }); return { text: 'You give Detective Pruitt a limp, an accent, and a tragic backstory. Jordan is crying laughing. The director asks if you\'re free in the spring.' }; } },
        { label: 'Read it straight', run: st => { Sim.adjust(st, 'jordan', { friend: 5 }); return { text: '"What?" you say, four times, with feeling. Jordan says you\'re a natural.' }; } }
      ]
    },
    {
      id: 'locker_note', slots: ['morning'], places: ['hall'], weight: 4, cooldown: 6,
      cast: st => { const xs = D.CAST.filter(c => st.settings.romance && rel(st, c.id).romance >= 35 && !rel(st, c.id).partner && !rel(st, c.id).noteSent).map(c => c.id); return xs.length ? { a: Sim.pickLive(st, xs) } : null; },
      faces: () => [], title: 'Something in your locker',
      text: (st, x) => `There's a folded note in the vents of your locker. "${Sim.pickLive(st, ['You looked really good in chem today. Don\'t make it weird.', 'I think about our conversations more than I should.', 'Save me a seat at lunch?'])}" No name. The handwriting looks a lot like ${F(x.a)}'s.`,
      choices: (st, x) => [
        { label: `Find ${F(x.a)} and say hi`, run: st => { rel(st, x.a).noteSent = true; Sim.adjust(st, x.a, { romance: 8, friend: 4 }); Sim.remember(st, x.a, { k: 'note', v: 2, recall: 'the note', line: 'So... you figured out the note was me, huh.', t: 'You figured out the note was me.' }); return { text: `${F(x.a)} goes bright red the second you walk up. Neither of you mentions the note. You both know.` }; } },
        { label: 'Keep it in your notebook', run: st => { rel(st, x.a).noteSent = true; Sim.adjust(st, x.a, { romance: 3 }); return { text: 'You tuck it into the back of your notebook. Some things are better as a mystery for a while.' }; } }
      ]
    },
    {
      id: 'eli_crush', slots: ['after', 'lunch', 'evening'], weight: 4, once: true,
      need: st => rel(st, 'eli').friend >= 30 && !rel(st, 'eli').partner && !rel(st, 'hannah').partner,
      cast: (st, ctx) => ctx.present.includes('eli') || Sim.curSlot(st).id === 'evening' ? { a: 'eli' } : null,
      faces: () => ['eli'], title: 'Eli needs advice',
      text: () => 'Eli has been staring at the same page for ten minutes. Finally: "Hypothetically. If someone wanted to ask Hannah Cole to get boba. Hypothetically. Would that be a catastrophic error?"',
      choices: () => [
        { label: 'Go for it', run: st => { Sim.adjust(st, 'eli', { friend: 8 }); const yes = Sim.bond(st, 'eli', 'hannah') > 15 || Sim.live(st) < 0.45; if (yes) { Sim.addBond(st, 'eli', 'hannah', 40); st.couples.push(['eli', 'hannah']); st.npcs.eli.partner = 'hannah'; st.npcs.hannah.partner = 'eli'; Sim.remember(st, 'eli', { k: 'wingman', v: 3, recall: 'the boba thing', line: 'Hannah and I are getting boba again Saturday. I owe you forever.', t: 'You told me to ask Hannah out.' }); Sim.text(st, 'eli', 'SHE SAID YES'); Sim.log(st, 'Talked Eli into asking Hannah out. She said yes.', 'big'); return { text: 'Eli asks her the next day, in the hallway, in front of everyone. Hannah says "finally." You get a text in all caps.' }; } Sim.remember(st, 'eli', { k: 'wingman', v: 1, recall: 'the boba thing', line: 'Hannah said no to boba. But she said it nicely. Thanks for the push anyway.', t: 'You told me to ask Hannah out.' }); return { text: 'Eli asks. Hannah says she\'s flattered but no. Eli takes it better than you expected. "At least I know."' }; } },
        { label: 'Tell him to wait', run: st => { Sim.adjust(st, 'eli', { friend: 3 }); return { text: '"Yeah. Wait. Waiting is good. I\'m great at waiting."' }; } }
      ]
    },
    {
      id: 'breakup_vent', slots: ['lunch', 'after', 'day', 'evening'], weight: 5, cooldown: 2,
      cast: (st, ctx) => { const g = st.gossip.slice().reverse().find(g => /broke up/.test(g.text) && st.day - g.day <= 3 && !g.vented); if (!g) return null; const a = g.about.find(id => ctx.present.includes(id) || Sim.curSlot(st).id === 'evening'); return a && rel(st, a).friend >= 5 ? { a, g } : null; },
      faces: x => [x.a], title: 'After the breakup',
      text: (st, x) => { const other = x.g.about.find(id => id !== x.a); return `${F(x.a)} looks like ${they(x.a)} haven't slept. "I guess you heard about me and ${F(other)}."`; },
      choices: (st, x) => [
        { label: 'Listen', run: st => { x.g.vented = true; Sim.adjust(st, x.a, { friend: 10, mood: 0.3 }); Sim.remember(st, x.a, { k: 'breakup', v: 2, recall: 'after the breakup', line: 'You were there after the breakup. That meant a lot.', t: 'You listened after my breakup.' }); return { text: `You mostly just listen. By the end, ${F(x.a)} is almost laughing.` }; } },
        { label: 'Talk trash about the ex', run: st => { x.g.vented = true; const other = x.g.about.find(id => id !== x.a); const v = Sim.live(st) < 0.5; Sim.adjust(st, x.a, { friend: v ? 8 : -2 }); Sim.adjust(st, other, { friend: -5 }); return { text: v ? `${F(x.a)} cackles. "Okay, that's mean. Say it again."` : `${F(x.a)} winces. "Don't. I still kind of like ${them(other)}."` }; } }
      ]
    },
    {
      id: 'carpool', slots: ['morning'], places: ['hall', 'gym', 'library', 'courtyard'], weight: 2, cooldown: 6,
      cast: st => { const xs = D.CAST.filter(c => rel(st, c.id).friend >= 20).map(c => c.id); return xs.length ? { a: Sim.pickLive(st, xs) } : null; },
      faces: x => [x.a], title: 'Ride in',
      text: (st, x) => `${F(x.a)}'s mom pulls up while you're walking. "Get in, it's freezing." The car smells like vanilla air freshener and ${F(x.a)}'s playlist is aggressively loud.`,
      choices: (st, x) => [
        { label: 'Take over the aux', run: st => { const likes = N(x.a).likes.includes('music'); Sim.adjust(st, x.a, { friend: likes ? 7 : 3 }); if (likes) Sim.learn(st, x.a, 'likes', 'music'); return { text: likes ? `${F(x.a)} actually knows the song. You scream the chorus together going past the Stewart's.` : `${F(x.a)} tolerates your music. Barely.` }; } },
        { label: 'Talk to the mom', run: st => { Sim.adjust(st, x.a, { friend: 4 }); Sim.stat(st, 'charm', 0.5); return { text: `${F(x.a)}'s mom loves you. ${F(x.a)} is mortified. Both outcomes are good.` }; } }
      ]
    },
    {
      id: 'lost_phone', slots: ['morning', 'lunch'], places: ['hall', 'lunch_jocks', 'lunch_theater', 'lunch_brains', 'lunch_art'], weight: 2, cooldown: 7,
      cast: st => ({ a: Sim.pickLive(st, D.CAST.map(c => c.id)) }),
      faces: () => [], title: 'Somebody\'s phone',
      text: (st, x) => `There's a phone face-down on the bench. The case has ${x.a === 'maya' ? 'paint on it' : x.a === 'eli' ? 'a Gerald sticker' : x.a === 'sofia' ? 'rhinestones' : 'a cracked corner'}. It lights up: a text preview.`,
      choices: (st, x) => [
        { label: 'Return it without looking', run: st => { Sim.adjust(st, x.a, { friend: 8 }); Sim.remember(st, x.a, { k: 'phone', v: 1.5, recall: 'my phone', line: 'You found my phone and didn\'t snoop. Rare.', t: 'You returned my phone.' }); return { text: `It's ${F(x.a)}'s. ${they(x.a)[0].toUpperCase() + they(x.a).slice(1)} grab${N(x.a).pro === 'they' ? '' : 's'} it like it's a newborn. "Did you look?" You didn't. ${F(x.a)} believes you.` }; } },
        { label: 'Read the preview', run: st => { const s = N(x.a).secret; Sim.addGossip(st, { key: 'secret-' + x.a, secret: true, owner: x.a, about: [x.a], text: s.text, short: s.short, recall: s.recall }); if (Sim.live(st) < 0.3) { Sim.adjust(st, x.a, { friend: -12 }); Sim.remember(st, x.a, { k: 'snooped', v: -2, recall: 'going through my phone', line: 'I know you read my phone that day.', t: 'You read my texts.' }); return { text: `You read it. Then ${F(x.a)} walks around the corner and sees you holding it. Bad.` }; } return { text: `You read it. Now you know something about ${F(x.a)} that you probably shouldn't. You leave the phone at the front office.` }; } }
      ]
    },
    {
      id: 'shift_cover', slots: ['after', 'day'], places: ['job'], weight: 3, cooldown: 5,
      cast: (st, ctx) => ctx.present.includes('darnell') ? { a: 'darnell' } : null,
      faces: () => ['darnell'], title: 'Popcorn duty',
      text: () => 'Darnell slides you a bucket of popcorn and lowers his voice. "Manager\'s doing schedules. Could you take my Saturday? I\'ll owe you. I\'ll owe you forever."',
      choices: () => [
        { label: 'Take his shift', run: st => { st.player.money += 20; Sim.energy(st, -8); Sim.adjust(st, 'darnell', { friend: 10 }); Sim.remember(st, 'darnell', { k: 'shift', v: 2, recall: 'that Saturday shift', line: 'You took my shift. I owe you forever. Literally forever.', t: 'You covered my shift.' }); return { text: 'Darnell hugs you over the counter. Popcorn goes everywhere. You get the twenty bucks; he gets his Saturday back.' }; } },
        { label: 'Can\'t this week', run: st => { Sim.adjust(st, 'darnell', { friend: -1 }); return { text: '"All good, all good." He means it. Mostly.' }; } }
      ]
    },
    {
      id: 'dance_ask', slots: ['morning', 'lunch', 'after', 'evening'], weight: 6, cooldown: 2,
      need: st => st.settings.romance && !st.player.date && Sim.dayInfo(st.day).week >= 3 && (Sim.dayInfo(st.day).week < 4 || Sim.dayInfo(st.day).dow <= 4),
      cast: (st, ctx) => { const xs = D.CAST.filter(c => rel(st, c.id).romance >= 40 && !rel(st, c.id).partner && !rel(st, c.id).askedDance && (ctx.present.includes(c.id) || Sim.curSlot(st).id === 'evening')).map(c => c.id); return xs.length ? { a: Sim.pickLive(st, xs) } : null; },
      faces: x => [x.a], title: 'The Snow Ball',
      text: (st, x) => `${F(x.a)} is weirdly fidgety. "So. The Snow Ball. Saturday. Are you... going with anyone?"`,
      choices: (st, x) => [
        { label: 'Go with them', run: st => { rel(st, x.a).askedDance = true; st.player.date = x.a; Sim.adjust(st, x.a, { romance: 12, friend: 5 }); Sim.remember(st, x.a, { k: 'dance', v: 2.5, recall: 'when I asked you to the Snow Ball', line: 'I was so nervous asking you to the Snow Ball. You have no idea.', t: 'You said yes to the Snow Ball.' }); Sim.log(st, `${F(x.a)} asked you to the Snow Ball. You said yes.`, 'big'); return { text: `${F(x.a)} breaks into a huge grin, then tries to play it cool, then gives up. "Okay. Cool. Great. Cool."` }; } },
        { label: 'Go as friends', run: st => { rel(st, x.a).askedDance = true; st.player.date = x.a; Sim.adjust(st, x.a, { friend: 6, romance: -6 }); return { text: `"Friends. Yeah. Totally." ${F(x.a)} recovers fast. It'll still be fun.` }; } },
        { label: 'Let them down easy', run: st => { rel(st, x.a).askedDance = true; Sim.adjust(st, x.a, { romance: -15, friend: -3, mood: -0.4 }); Sim.remember(st, x.a, { k: 'turned', v: -1, recall: 'the Snow Ball thing', line: 'We\'re fine about the Snow Ball thing. Really.', t: 'You turned me down for the Snow Ball.' }); return { text: `"No, yeah, of course." ${F(x.a)} smiles too hard and leaves too fast.` }; } }
      ]
    }
  ];

  // Which event (if any) fires when you arrive somewhere
  function eventFor(st, ctx) {
    const di = Sim.dayInfo(st.day);
    const opts = [];
    EVENTS.forEach(e => {
      if (e.slots && !e.slots.includes(ctx.slot)) return;
      if (e.places && !e.places.includes(ctx.place)) return;
      const last = st.seen[e.id];
      if (e.once && last != null) return;
      if (e.cooldown && last != null && st.day - last < e.cooldown) return;
      if (e.need && !e.need(st, ctx)) return;
      const x = e.cast(st, ctx);
      if (!x) return;
      opts.push({ e, x, w: e.weight || 1 });
    });
    if (!opts.length) return null;
    const chance = opts.some(o => o.e.id === 'signup' || o.e.id === 'dance_ask' || o.e.id === 'eli_crush') ? 0.75 : 0.32;
    if (Sim.live(st) > chance) return null;
    const tot = opts.reduce((s, o) => s + o.w, 0);
    let r = Sim.live(st) * tot;
    for (const o of opts) { r -= o.w; if (r <= 0) return o; }
    return opts[opts.length - 1];
  }
  function beatFor(st) {
    return BEATS.find(b => b.when(st)) || null;
  }

  return { BEATS, EVENTS, eventFor, beatFor, horseResult, hoopsOpponent };
})();
