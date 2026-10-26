/* Conversations as read-and-react. Each round you get a hand of approaches.
   How they land depends on who they are (likes, humor, confidence, mood) and
   what they remember about you. Good reads chain into a vibe multiplier;
   what you learn about them goes in your contacts. */
const Convo = (() => {
  const D = SchoolData, Sim = SchoolSim;

  function tierFor(s) {
    if (s >= 1.7) return 'love';
    if (s >= 0.6) return 'like';
    if (s >= -0.4) return 'meh';
    if (s >= -1.4) return 'dislike';
    return 'hate';
  }

  function start(st, id, opts) {
    const o = opts || {};
    const c = D.BY_ID[id], n = st.npcs[id];
    const rounds = (o.mode === 'text' ? 2 : 3) + (st.player.stats.charm >= 70 && o.mode !== 'text' ? 1 : 0);
    const s = { id, mode: o.mode || 'talk', round: 0, rounds, vibe: 1, total: 0, romance: 0, used: {}, log: [], hand: [], done: false, friendBefore: n.friend, tierBefore: Sim.tierOf(n.friend).label, notes: [], repeat: n.talksToday };
    const op = opener(st, id);
    s.line = op.line; s.expr = op.expr;
    s.hand = deal(st, s);
    return s;
  }

  function opener(st, id) {
    const c = D.BY_ID[id], n = st.npcs[id];
    const t = Sim.tierOf(n.friend).key;
    let pool = 'acquaintance', expr = 'neutral';
    if (!n.met) { pool = 'stranger'; expr = 'neutral'; }
    else if (n.friend < -24) { pool = 'cold'; expr = 'annoyed'; }
    else if (n.mood < -0.4) { pool = 'down'; expr = 'sad'; }
    else if (t === 'good' || t === 'best') { pool = 'close'; expr = 'happy'; }
    else if (t === 'friend') { pool = 'friend'; expr = 'happy'; }
    let line = Sim.pickLive(st, D.OPENERS[pool]).replace('{player}', st.player.name);
    // memory callbacks: the thing that makes them feel alive
    const m = Sim.strongest(st, id);
    if (m && m.line && n.met && Sim.live(st) < 0.55 && st.day - m.d >= 1) {
      line = m.line;
      expr = m.v > 0 ? 'happy' : (m.v <= -2 ? 'annoyed' : 'neutral');
    }
    if (n.romance >= 55 && n.friend > 0) expr = 'shy';
    return { line, expr };
  }

  function topicMark(st, id, topic) {
    const k = st.npcs[id].known;
    if (k.likes.includes(topic)) return 'good';
    if (k.dislikes.includes(topic)) return 'bad';
    return 'unknown';
  }

  function deal(st, s) {
    const id = s.id, c = D.BY_ID[id], n = st.npcs[id], P = st.player;
    const pool = [];
    const topics = Object.keys(D.TOPICS).filter(t => !s.used['ask:' + t]);
    const known = topics.filter(t => n.known.likes.includes(t));
    const unknown = topics.filter(t => !n.known.likes.includes(t) && !n.known.dislikes.includes(t));
    const askA = known.length && Sim.live(st) < 0.6 ? Sim.pickLive(st, known) : (unknown.length ? Sim.pickLive(st, unknown) : Sim.pickLive(st, topics));
    pool.push({ kind: 'ask', topic: askA });
    const askB = Sim.pickLive(st, unknown.filter(t => t !== askA).length ? unknown.filter(t => t !== askA) : topics.filter(t => t !== askA));
    if (askB) pool.push({ kind: 'ask', topic: askB });
    const share = P.likes.filter(t => !s.used['share:' + t]);
    if (share.length) pool.push({ kind: 'share', topic: Sim.pickLive(st, share) });
    const humor = n.known.humor && Sim.live(st) < 0.6 ? n.known.humor : Sim.pickLive(st, ['goofy', 'dry']);
    if (!s.used['joke']) pool.push({ kind: 'joke', humor, text: Sim.pickLive(st, D.JOKES[humor]) });
    if (!s.used['compliment']) pool.push({ kind: 'compliment', text: Sim.pickLive(st, D.COMPLIMENTS) });
    if (!s.used['vent']) pool.push({ kind: 'vent', text: Sim.pickLive(st, D.VENTS) });
    pool.push({ kind: 'listen' });
    const gossip = st.gossip.filter(g => !g.used.includes(id) && !(g.about || []).includes(id) || (g.secret && g.owner !== id && !g.used.includes(id)));
    if (gossip.length && !s.used['gossip']) pool.push({ kind: 'gossip', g: Sim.pickLive(st, gossip.slice(-6)).id });
    const good = Sim.memories(st, id).filter(m => m.v >= 1 && !s.used['mem:' + m.id]);
    if (good.length && n.met) { const m = good.sort((a, b) => b.v * b.w - a.v * a.w)[0]; pool.push({ kind: 'remember', mem: m.id }); }
    const bad = Sim.memories(st, id).filter(m => m.v <= -1 && !m.resolved);
    if (bad.length) pool.push({ kind: 'apologize', mem: bad.sort((a, b) => a.v - b.v)[0].id });
    if (st.settings.romance && n.friend >= 12 && !s.used['flirt']) pool.push({ kind: 'flirt' });
    const di = Sim.dayInfo(st.day);
    const hasPlan = st.plans.some(p => p.with === id && p.day >= st.day && p.status === 'set');
    if (n.friend >= 18 && !hasPlan && !s.used['invite'] && s.mode === 'talk') pool.push({ kind: 'invite' });
    if (st.settings.romance && di.week >= 3 && (di.week < 4 || (di.week === 4 && di.dow <= 5)) && !P.date && !st.npcs[id].partner && n.friend >= 15 && !s.used['dance']) pool.push({ kind: 'dance' });
    if (P.team && di.dow <= 4 && di.week >= 3 && !s.used['game'] && n.friend >= 10 && !n.told.includes('game' + di.week)) pool.push({ kind: 'game' });

    // build a hand: always varied, never two of the same kind
    const size = P.stats.charm >= 55 ? 4 : 3;
    const hand = [];
    const priority = ['dance', 'apologize', 'gossip', 'remember', 'game', 'invite'];
    priority.forEach(k => { const x = pool.find(p => p.kind === k); if (x && hand.length < size - 1 && Sim.live(st) < 0.6) hand.push(x); });
    const rest = pool.filter(p => !hand.includes(p));
    while (hand.length < size && rest.length) {
      const i = Math.floor(Sim.live(st) * rest.length);
      const x = rest.splice(i, 1)[0];
      if (hand.some(h => h.kind === x.kind) && x.kind !== 'ask') continue;
      if (x.kind === 'ask' && hand.filter(h => h.kind === 'ask').length >= 2) continue;
      hand.push(x);
    }
    return hand.map(h => decorate(st, s, h));
  }

  function decorate(st, s, h) {
    const id = s.id, n = st.npcs[id], c = D.BY_ID[id];
    const T = t => D.TOPICS[t];
    const out = Object.assign({}, h);
    switch (h.kind) {
      case 'ask': out.label = `Ask about ${T(h.topic)}`; out.mark = topicMark(st, id, h.topic); break;
      case 'share': out.label = `Talk about your ${T(h.topic)} thing`; out.mark = topicMark(st, id, h.topic); break;
      case 'joke': out.label = h.text; out.sub = h.humor === 'goofy' ? 'Goofy joke' : 'Dry joke'; out.mark = n.known.humor ? (n.known.humor === h.humor ? 'good' : 'bad') : 'unknown'; break;
      case 'compliment': out.label = h.text; break;
      case 'vent': out.label = h.text; break;
      case 'listen': out.label = 'Just listen'; out.sub = 'Safe'; break;
      case 'gossip': { const g = st.gossip.find(x => x.id === h.g); out.label = g.secret ? `Tell them ${g.short}` : `Pass on: "${g.text}"`; out.sub = g.secret ? 'Someone\'s secret' : 'Gossip'; out.mark = g.secret ? 'risky' : ''; break; }
      case 'remember': { const m = n.mem.find(x => x.id === h.mem); out.label = `Bring up ${m.recall || 'that time'}`; out.sub = 'Shared memory'; out.mark = 'good'; break; }
      case 'apologize': { const m = n.mem.find(x => x.id === h.mem); out.label = `Apologize for ${m.recall || 'what happened'}`; out.sub = 'Clear the air'; break; }
      case 'flirt': out.label = 'Flirt a little'; out.sub = n.partner ? `They're with ${D.BY_ID[n.partner].first}` : 'Romance'; out.mark = n.partner ? 'risky' : ''; break;
      case 'invite': out.label = 'Hang out this weekend?'; out.sub = 'Make a plan'; break;
      case 'dance': out.label = 'Ask them to the Snow Ball'; out.sub = 'Saturday of week 4'; out.mark = 'risky'; break;
      case 'game': out.label = 'Come to my game Friday?'; out.sub = 'Basketball'; break;
    }
    return out;
  }

  function score(st, s, h) {
    const id = s.id, c = D.BY_ID[id], n = st.npcs[id], T = c.traits;
    const likes = t => c.likes.includes(t), dislikes = t => c.dislikes.includes(t);
    let v = 0, personal = false;
    switch (h.kind) {
      case 'ask': v = likes(h.topic) ? 1.75 + T.warmth * 0.3 : dislikes(h.topic) ? -1.25 : 0.15 + T.confidence * 0.3; break;
      case 'share': v = likes(h.topic) ? 1.45 : dislikes(h.topic) ? -0.9 : -0.1 - T.confidence * 0.45; break;
      case 'joke': v = n.mood < -0.35 ? -1.2 : (T.humor === h.humor ? 1.9 : -0.45); break;
      case 'compliment': v = 0.45 + (1 - T.confidence) * 1.1 + T.warmth * 0.3; break;
      case 'vent': v = T.ambition < 0.6 ? 1.2 + (T.humor === 'dry' ? 0.3 : 0) : -0.85; if (n.mood < -0.3) v += 0.6; break;
      case 'listen': v = 0.45 + (n.mood < -0.2 ? 1.25 : 0); break;
      case 'gossip': {
        const g = st.gossip.find(x => x.id === h.g);
        v = T.drama * 3 - 1.25;
        const about = (g.about || []).concat(g.owner ? [g.owner] : []);
        if (about.includes(id)) { v = -2.6; personal = true; }
        else if (about.some(a => Sim.bond(st, a, id) > 45)) { v -= 1.4; s.why = `${D.BY_ID[about.find(a => Sim.bond(st, a, id) > 45)].first} is close with ${c.first}.`; }
        if (g.secret) v -= T.loyalty * 0.8;
        break;
      }
      case 'remember': { const m = n.mem.find(x => x.id === h.mem); v = 0.9 + (m ? m.v * 0.45 * Math.max(0.4, m.w) : 0); break; }
      case 'apologize': v = 0.9 + T.loyalty * 0.9 + T.warmth * 0.3; break;
      case 'flirt': {
        if (n.partner) { v = -1.6; break; }
        v = T.open * 2.3 - 0.9 + n.romance / 70 + n.friend / 140 + (st.player.stats.charm - 50) / 120;
        break;
      }
      case 'invite': v = n.friend >= 26 ? 1.2 : -0.2; break;
      case 'dance': v = (n.romance >= 28 && T.open >= 0.45) || n.friend >= 58 ? 2.0 : -1.0; break;
      case 'game': v = T.warmth * 1.4 + (c.likes.includes('sports') ? 0.6 : -0.2); break;
    }
    v += n.mood * 0.45 + (st.player.stats.charm - 50) / 150;
    v += (Sim.live(st) - 0.5) * 0.5;
    if (n.friend < -24 && h.kind !== 'apologize') v -= 0.6;
    return { v, personal };
  }

  function react(tier, h, personal) {
    if (h.kind === 'flirt') return { love: 'shy', like: 'smug', meh: 'neutral', dislike: 'annoyed', hate: 'annoyed' }[tier];
    if (tier === 'love') return ['joke', 'gossip', 'remember'].includes(h.kind) ? 'laugh' : 'happy';
    if (tier === 'like') return h.kind === 'compliment' ? 'shy' : 'happy';
    if (tier === 'meh') return 'neutral';
    if (tier === 'dislike') return 'annoyed';
    return personal ? 'hurt' : 'annoyed';
  }

  function lineFor(st, s, h, tier) {
    const c = D.BY_ID[s.id];
    const kindKey = { ask: 'ask', share: 'share', joke: 'joke', compliment: 'compliment', vent: 'vent', listen: 'listen', gossip: 'gossip', remember: 'remember', apologize: 'apologize', flirt: 'flirt' }[h.kind];
    let line = '';
    if (kindKey) line = Sim.pickLive(st, D.LINES[kindKey][tier]);
    const topic = h.topic ? D.TOPICS[h.topic] : '';
    line = line.replace(/\{topic\}/g, topic).replace(/\{Topic\}/g, Sim.cap(topic));
    const voice = c.voice && c.voice[tier === 'hate' ? 'dislike' : tier];
    if (voice && Sim.live(st) < 0.45 && line && !/^[A-Z]{3,}/.test(line)) line = Sim.pickLive(st, voice) + line;
    return line;
  }

  /* Play one card. Returns what happened, for the page to show. */
  function play(st, s, h) {
    const id = s.id, c = D.BY_ID[id], n = st.npcs[id];
    s.used[h.kind === 'ask' || h.kind === 'share' ? h.kind + ':' + h.topic : h.kind] = true;
    if (h.mem) s.used['mem:' + h.mem] = true;
    s.why = null;
    const { v, personal } = score(st, s, h);
    let tier = tierFor(v);
    let line = lineFor(st, s, h, tier);
    let expr = react(tier, h, personal);
    const notes = [];
    // learning about them
    if (h.kind === 'ask' || h.kind === 'share') {
      if (c.likes.includes(h.topic) && Sim.learn(st, id, 'likes', h.topic)) notes.push(`${c.first} likes ${D.TOPICS[h.topic]}.`);
      if (c.dislikes.includes(h.topic) && Sim.learn(st, id, 'dislikes', h.topic)) notes.push(`${c.first} can't stand ${D.TOPICS[h.topic]}.`);
    }
    if (h.kind === 'joke' && !n.known.humor && (tier === 'love' || tier === 'dislike' || tier === 'hate')) {
      Sim.learn(st, id, 'humor', c.traits.humor);
      notes.push(`${c.first} likes ${c.traits.humor === 'goofy' ? 'goofy' : 'dry'} humor.`);
    }
    // special cards with consequences
    if (h.kind === 'gossip') {
      const g = st.gossip.find(x => x.id === h.g);
      g.used.push(id);
      if (g.secret && g.owner) {
        const leak = 0.3 + c.traits.drama * 0.55;
        if (Sim.live(st) < leak) {
          const owner = D.BY_ID[g.owner];
          Sim.adjust(st, g.owner, { friend: -30, mood: -0.4 });
          Sim.remember(st, g.owner, { k: 'betrayed', v: -3, recall: `telling people about ${g.recall || 'my secret'}`, line: `I told you that in confidence. And now ${c.first} knows.`, t: `You told ${c.first} my secret.` });
          Sim.text(st, g.owner, Sim.pickLive(st, [`seriously?? i told you that in private`, `${c.first.toLowerCase()} just asked me about it. thanks a lot`, `wow. ok. good to know who i can trust`]));
          s.leaked = g.owner;
          notes.push(`${owner.first} is going to find out you told.`);
        }
      }
      if (!g.secret && c.traits.drama >= 0.6 && tier !== 'hate') Sim.adjust(st, id, { mood: 0.15 });
    }
    if (s.why && tier !== 'love' && tier !== 'like') notes.push(s.why);
    if (h.kind === 'joke' && st.npcs[id].mood < -0.35) notes.push(`${c.first} isn't in a joking mood.`);
    if (h.kind === 'apologize') {
      const m = n.mem.find(x => x.id === h.mem);
      if (m && (tier === 'love' || tier === 'like')) { m.resolved = true; m.w *= 0.4; notes.push('That cleared the air.'); }
    }
    if (h.kind === 'invite') {
      if (tier === 'love' || tier === 'like') {
        const di = Sim.dayInfo(st.day);
        const sat = st.day + (5 - di.dow + (di.dow >= 5 ? 7 : 0));
        const place = Sim.pickLive(st, c.sched.day ? Object.keys(c.sched.day).filter(p => p !== 'home' && p !== 'job') : ['diner']) || 'diner';
        st.plans.push({ day: sat, slot: 'day', with: id, place: place === 'library' ? 'library_w' : place, status: 'set' });
        line = Sim.pickLive(st, ['Yeah, let\'s do it. Saturday?', 'I\'m in. Text me.', 'Sure. Saturday works.']);
        notes.push(`Plan: Saturday at ${D.PLACES[place === 'library' ? 'library_w' : place].name} with ${c.first}.`);
      } else line = Sim.pickLive(st, ['Maybe some other time.', 'I\'m kind of busy this weekend.', 'Eh, I don\'t think so.']);
    }
    if (h.kind === 'dance') {
      if (tier === 'love' || tier === 'like') {
        st.player.date = id;
        Sim.adjust(st, id, { romance: 10 });
        Sim.remember(st, id, { k: 'dance', v: 2, recall: 'you asking me to the Snow Ball', line: 'Still can\'t believe you asked me to the Snow Ball like that.', t: 'You asked me to the Snow Ball.' });
        line = n.romance >= 28 ? Sim.pickLive(st, ['Yes. Obviously yes.', 'I was hoping you\'d ask.']) : 'As friends? Yeah, let\'s go.';
        expr = n.romance >= 28 ? 'shy' : 'happy';
        notes.push(`You're going to the Snow Ball with ${c.first}.`);
        Sim.log(st, `Asked ${c.first} to the Snow Ball. They said yes.`, 'big');
      } else {
        line = Sim.pickLive(st, ['Oh. Um. I think I\'m going with friends.', 'That\'s sweet, but no.', 'I... wasn\'t expecting that. No, sorry.']);
        expr = 'surprised';
        Sim.remember(st, id, { k: 'awkward', v: -1, recall: 'the dance thing', line: 'So... about the dance thing. We\'re good. It\'s fine.', t: 'You asked me to the dance.' });
      }
    }
    if (h.kind === 'game') {
      n.told.push('game' + Sim.dayInfo(st.day).week);
      if (tier === 'love' || tier === 'like') { line = Sim.pickLive(st, ['I\'ll be there. Front row.', 'Yeah, I\'ll come.', 'Only if you score.']); notes.push(`${c.first} is coming to your game Friday.`); n.coming = Sim.dayInfo(st.day).week; }
      else line = Sim.pickLive(st, ['Basketball? Hard pass.', 'I\'ve got stuff Friday.']);
    }
    if (h.kind === 'flirt') {
      const dr = { love: 9, like: 5, meh: 0, dislike: -2, hate: -4 }[tier];
      s.romance += dr;
      if (n.partner && Sim.live(st) < 0.35) {
        Sim.adjust(st, n.partner, { friend: -12 });
        Sim.remember(st, n.partner, { k: 'flirted', v: -2, recall: 'flirting with ' + c.first, line: `Heard you were flirting with ${c.first}. Classy.`, t: `You flirted with ${c.first}.` });
        notes.push(`${D.BY_ID[n.partner].first} heard about that.`);
      }
    }
    // vibe: good reads chain
    if (tier === 'love') s.vibe = Math.min(2.2, s.vibe + 0.35);
    else if (tier === 'like') s.vibe = Math.min(2.2, s.vibe + 0.15);
    else if (tier === 'meh') s.vibe = Math.max(0.8, s.vibe - 0.1);
    else s.vibe = tier === 'hate' ? 0.6 : 0.8;
    const base = Math.max(-2.6, Math.min(2.6, v));
    const delta = base * 2.6 * (base > 0 ? s.vibe : 1) * (s.repeat ? 0.5 : 1) * (s.mode === 'text' ? 0.75 : 1);
    s.total += delta;
    s.round++;
    s.line = line || s.line; s.expr = expr;
    const rec = { card: h, tier, line, expr, delta, notes, vibe: s.vibe };
    s.log.push(rec);
    if (s.round >= s.rounds) s.done = true;
    else s.hand = deal(st, s);
    return rec;
  }

  function finish(st, s) {
    const id = s.id, c = D.BY_ID[id], n = st.npcs[id];
    // the closer you already are, the harder it is to get closer still
    const room = s.total > 0 ? Math.max(0.25, 1 - Math.max(0, n.friend) / 125) : 1;
    const df = Math.round(Math.max(-24, Math.min(18, s.total * room)));
    const change = Sim.adjust(st, id, { friend: df, romance: s.romance, mood: df > 6 ? 0.15 : df < -6 ? -0.15 : 0 });
    n.lastTalk = st.day; n.talksToday++;
    const best = s.log.slice().sort((a, b) => b.delta - a.delta)[0];
    const worst = s.log.slice().sort((a, b) => a.delta - b.delta)[0];
    if (best && best.tier === 'love' && best.card.kind === 'joke' && !n.mem.some(m => m.k === 'laugh')) {
      Sim.remember(st, id, { k: 'laugh', v: 1.5, recall: 'that joke', line: `You're the one who made me laugh at ${best.card.text.toLowerCase().includes('pizza') ? 'the pizza thing' : 'that dumb joke'}. Still funny.`, t: 'You made me laugh.' });
    }
    if (best && best.tier === 'love' && best.card.kind === 'ask' && !n.mem.some(m => m.k === 'topic' + best.card.topic)) {
      Sim.remember(st, id, { k: 'topic' + best.card.topic, v: 1, recall: `talking ${D.TOPICS[best.card.topic]}`, line: `Okay, I thought of more ${D.TOPICS[best.card.topic]} stuff to tell you.`, t: `You asked about ${D.TOPICS[best.card.topic]}.` });
    }
    if (worst && worst.tier === 'hate' && !n.mem.some(m => m.k === 'rude' && st.day - m.d < 3)) {
      Sim.remember(st, id, { k: 'rude', v: -1.5, recall: `what you said the other day`, line: 'I haven\'t forgotten what you said, by the way.', t: 'You said something that stung.' });
    }
    let number = false;
    if (!n.gaveNumber && n.friend >= 20) { n.gaveNumber = true; number = true; }
    return {
      id, df, romance: s.romance, change, number,
      tier: Sim.relLabel(st, id),
      notes: s.log.flatMap(r => r.notes)
    };
  }

  return { start, play, finish, deal, tierFor };
})();
