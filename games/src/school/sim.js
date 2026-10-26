/* Living School · simulation (Engines 4 and 5)
   Time, places, relationships, memory, gossip, and the lives the other
   students lead when you are not around. Pure state in, state out: the page
   draws it, and it can be run headless for tests. */
const SchoolSim = (() => {
  const D = SchoolData;
  const WEEKS = 8;
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hash() {
    let h = 2166136261 >>> 0;
    for (const x of arguments) {
      const s = String(x);
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      h ^= 0x9e37; h = Math.imul(h, 2654435761) >>> 0;
    }
    return h >>> 0;
  }
  function rnd(st) { return hash.apply(null, [st.seed].concat(Array.from(arguments).slice(1))) / 4294967296; }
  function live(st) { st.rc = (st.rc || 0) + 1; return rnd(st, 'live', st.rc); }
  function pick(st, arr, ...salt) { return arr[Math.floor(rnd(st, ...salt) * arr.length) % arr.length]; }
  function pickLive(st, arr) { return arr[Math.floor(live(st) * arr.length) % arr.length]; }
  function fill(t, o) { return t.replace(/\{(\w+)\}/g, (m, k) => o[k] != null ? o[k] : m).replace(/\{(\w+)\}/g, m => m); }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  // ---------- state ----------
  function newState(player, seed) {
    const st = {
      v: 1, seed: seed || Math.floor(Math.random() * 1e9), rc: 0, semester: 1,
      day: 0, slot: 0, phase: 'slot',
      player: Object.assign({
        name: 'Alex', pro: 'they', look: { skin: '#c68642', hair: '#2b1d14', style: 'short', shirt: '#1e5b47' },
        likes: ['sports', 'music', 'games'], focus: 'athlete',
        stats: { smarts: 40, athletics: 40, charm: 40, creativity: 40 },
        energy: 90, mood: 65, money: 40,
        grades: { math: 78, chem: 78, hist: 78, eng: 78, pe: 85, art: 80 },
        team: null, signedUp: false, date: null, flags: {}
      }, player || {}),
      npcs: {}, bonds: {}, couples: [], gossip: [], inbox: [], plans: [], journal: [],
      season: { w: 0, l: 0, games: [] }, rivalry: {}, sick: {}, seen: {}, hoops: { touchK: null },
      settings: { sound: true, feel: 'normal', romance: true },
      ended: false, savedAt: 0
    };
    D.CAST.forEach(c => {
      st.npcs[c.id] = { friend: 0, romance: 0, rival: 0, met: false, mood: 0.1, known: { likes: [], dislikes: [], humor: null }, mem: [], lastTalk: -9, talksToday: 0, partner: null, gaveNumber: false, told: [] };
    });
    Object.entries(D.BONDS).forEach(([k, v]) => { st.bonds[k] = v; });
    D.COUPLES.forEach(([a, b]) => { st.couples.push([a, b]); st.npcs[a].partner = b; st.npcs[b].partner = a; });
    return st;
  }
  const bondKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  function bond(st, a, b) { return st.bonds[bondKey(a, b)] || 0; }
  function addBond(st, a, b, d) { const k = bondKey(a, b); st.bonds[k] = clamp((st.bonds[k] || 0) + d, -100, 100); return st.bonds[k]; }

  // ---------- calendar ----------
  function dayInfo(day) {
    const week = Math.floor(day / 7) + 1, dow = day % 7;
    return { week, dow, weekend: dow >= 5, name: DAY_NAMES[dow], label: `Week ${week} · ${DAY_NAMES[dow]}` };
  }
  function slots(st) { return dayInfo(st.day).weekend ? D.SLOTS.weekend : D.SLOTS.school; }
  function curSlot(st) { return slots(st)[st.slot]; }
  function classToday(st) {
    const di = dayInfo(st.day);
    if (di.weekend) return null;
    if (di.dow === 4) return di.week % 2 ? D.CLASSES[4] : D.ART_CLASS;
    return D.CLASSES[di.dow];
  }
  function lastDay() { return WEEKS * 7 - 1; }

  // ---------- presence ----------
  function weighted(st, obj, ...salt) {
    const entries = Object.entries(obj);
    const tot = entries.reduce((s, e) => s + e[1], 0);
    let r = rnd(st, ...salt) * tot;
    for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
    return entries[entries.length - 1][0];
  }
  function whereIs(st, id, slotId, day) {
    day = day == null ? st.day : day;
    if (st.sick[id] === day) return 'away';
    const plan = st.plans.find(p => p.day === day && p.slot === slotId && p.with === id && p.status === 'set');
    if (plan) return plan.place;
    const c = D.BY_ID[id];
    if (slotId === 'lunch') {
      if (rnd(st, 'lunch', id, day) < 0.15) return 'lunch_' + pick(st, ['jocks', 'theater', 'brains', 'art'], 'lt', id, day);
      return 'lunch_' + c.sched.lunch;
    }
    if (slotId === 'evening') return 'home';
    const table = c.sched[slotId];
    if (!table) return 'away';
    const p = weighted(st, table, 'where', id, slotId, day);
    if (p === 'practice' && !['marcus', 'tyler', 'hannah'].includes(id)) return 'park';
    if (slotId === 'night' && p === 'party' && !partyTonight(st, day)) return 'home';
    if (p === 'library' && slotId === 'day') return 'library_w';
    return p;
  }
  function partyTonight(st, day) { const di = dayInfo(day == null ? st.day : day); return di.dow === 5 && (di.week % 2 === 0 || di.week === WEEKS); }
  function present(st, place, slotId) {
    return D.CAST.filter(c => whereIs(st, c.id, slotId) === place).map(c => c.id);
  }
  function placeOpen(st, place) {
    const P = D.PLACES[place];
    if (!P) return false;
    if (P.team && !st.player.team) return false;
    if (P.invite && !partyTonight(st)) return false;
    return true;
  }

  // ---------- relationships ----------
  const TIERS = [
    [-100, 'enemy', 'Enemy'], [-55, 'dislikes', 'Can\'t stand you'], [-25, 'cool', 'Cold'], [-8, 'stranger', 'Stranger'],
    [6, 'acq', 'Acquaintance'], [24, 'friend', 'Friend'], [52, 'good', 'Good friend'], [78, 'best', 'Best friend']
  ];
  function tierOf(v) { let t = TIERS[0]; for (const x of TIERS) if (v >= x[0]) t = x; return { key: t[1], label: t[2] }; }
  function relLabel(st, id) {
    const n = st.npcs[id];
    if (!n.met) return 'Haven\'t met';
    const t = tierOf(n.friend).label;
    if (st.player.date === id) return 'Your date · ' + t;
    if (n.romance >= 55) return 'Crush · ' + t;
    if (n.rival >= 40) return 'Rival · ' + t;
    return t;
  }
  function adjust(st, id, d) {
    const n = st.npcs[id];
    const before = tierOf(n.friend).label;
    if (d.friend) n.friend = clamp(n.friend + d.friend, -100, 100);
    if (d.romance) n.romance = clamp(n.romance + d.romance, 0, 100);
    if (d.rival) n.rival = clamp(n.rival + d.rival, 0, 100);
    if (d.mood) n.mood = clamp(n.mood + d.mood, -1, 1);
    n.met = true;
    const after = tierOf(n.friend).label;
    return before !== after ? { from: before, to: after } : null;
  }

  // ---------- memory ----------
  // v: −3..3. Strong memories fade slowly; small ones fade fast.
  function remember(st, id, m) {
    const n = st.npcs[id];
    n.mem.push(Object.assign({ d: st.day, w: 1, id: 'm' + st.day + '-' + n.mem.length + '-' + Math.floor(live(st) * 1e4) }, m));
    if (n.mem.length > 30) { n.mem.sort((a, b) => Math.abs(b.v) * b.w - Math.abs(a.v) * a.w); n.mem.length = 30; }
  }
  function memories(st, id) { return st.npcs[id].mem.filter(m => m.w > 0.15); }
  function strongest(st, id, sign) {
    const ms = memories(st, id).filter(m => !sign || Math.sign(m.v) === sign).filter(m => !m.resolved || m.v > 0);
    ms.sort((a, b) => Math.abs(b.v) * b.w - Math.abs(a.v) * a.w);
    return ms[0] || null;
  }
  function learn(st, id, kind, val) {
    const k = st.npcs[id].known;
    if (kind === 'humor') { k.humor = val; return; }
    if (!k[kind].includes(val)) { k[kind].push(val); return true; }
    return false;
  }

  // ---------- player stats ----------
  function stat(st, k, d) {
    const s = st.player.stats;
    const room = d > 0 ? (1 - s[k] / 130) : 1;
    s[k] = clamp(s[k] + d * room, 0, 100);
  }
  function energy(st, d) { st.player.energy = clamp(st.player.energy + d, 0, 100); }
  function mood(st, d) { st.player.mood = clamp(st.player.mood + d, 0, 100); }
  function gpa(st) {
    const g = st.player.grades;
    const avg = (g.math + g.chem + g.hist + g.eng) / 4;
    return clamp((avg - 55) / 10, 0, 4).toFixed(2);
  }
  function study(st, amount) {
    const g = st.player.grades;
    const k = ['math', 'chem', 'hist', 'eng'].sort((a, b) => g[a] - g[b])[0];
    g[k] = clamp(g[k] + amount, 0, 100);
    return k;
  }

  // ---------- messages, gossip, journal ----------
  function text(st, from, body, extra) {
    const m = Object.assign({ id: 't' + st.day + '-' + st.inbox.length, day: st.day, from, body, read: false }, extra || {});
    st.inbox.push(m);
    if (st.inbox.length > 80) st.inbox.splice(0, st.inbox.length - 80);
    return m;
  }
  function addGossip(st, g) {
    if (st.gossip.find(x => x.key === g.key)) return null;
    const item = Object.assign({ id: 'g' + st.gossip.length, day: st.day, used: [] }, g);
    st.gossip.push(item);
    return item;
  }
  function log(st, body, kind) { st.journal.push({ day: st.day, body, kind: kind || 'note' }); }

  // ---------- the day passes ----------
  function compat(a, b) {
    const A = D.BY_ID[a], B = D.BY_ID[b];
    let c = 0;
    A.likes.forEach(t => { if (B.likes.includes(t)) c += 0.5; if (B.dislikes.includes(t)) c -= 0.35; });
    if (A.traits.humor === B.traits.humor) c += 0.3;
    c += (A.traits.warmth + B.traits.warmth - 1) * 0.4;
    return c;
  }
  function together(st, a, b) {
    const ss = slots(st).map(s => s.id).filter(x => x !== 'evening');
    return ss.some(s => { const p = whereIs(st, a, s); return p !== 'away' && p !== 'home' && p === whereIs(st, b, s); });
  }

  /* Overnight: the other students live their lives. Returns notes for the morning. */
  function simulateNight(st) {
    const notes = [];
    const ids = D.CAST.map(c => c.id);
    // friendships drift when people spend time together
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      if (!together(st, a, b)) { if (Math.abs(bond(st, a, b)) > 20) addBond(st, a, b, -Math.sign(bond(st, a, b)) * 0.3); continue; }
      addBond(st, a, b, compat(a, b) * 1.6 + (live(st) - 0.5) * 3);
    }
    // couples form and fall apart
    st.couples = st.couples.filter(([a, b]) => {
      const v = bond(st, a, b);
      const sofiaPlan = (a === 'sofia' || b === 'sofia') && dayInfo(st.day).week >= 5 && live(st) < 0.12;
      if (v < 30 && live(st) < 0.3 || sofiaPlan) {
        st.npcs[a].partner = null; st.npcs[b].partner = null;
        addBond(st, a, b, -15);
        adjust(st, a, { mood: -0.5 }); adjust(st, b, { mood: -0.5 });
        notes.push({ kind: 'breakup', a, b, text: `${D.BY_ID[a].first} and ${D.BY_ID[b].first} broke up.` });
        return false;
      }
      return true;
    });
    D.SPARKS.forEach(([a, b]) => {
      if (st.npcs[a].partner || st.npcs[b].partner) return;
      if (st.player.date === a || st.player.date === b) return;
      if (st.npcs[a].romance >= 60 || st.npcs[b].romance >= 60) return;
      if (bond(st, a, b) > 52 && live(st) < 0.12) {
        st.npcs[a].partner = b; st.npcs[b].partner = a; st.couples.push([a, b]);
        adjust(st, a, { mood: 0.5 }); adjust(st, b, { mood: 0.5 });
        notes.push({ kind: 'couple', a, b, text: `${D.BY_ID[a].first} and ${D.BY_ID[b].first} are together now.` });
      }
    });
    // feuds flare up
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      if (bond(st, a, b) < -30 && together(st, a, b) && live(st) < 0.18) {
        addBond(st, a, b, -4);
        notes.push({ kind: 'fight', a, b, text: `${D.BY_ID[a].first} and ${D.BY_ID[b].first} got into it in front of everybody.` });
      }
    }
    // small life events
    D.CAST.forEach(c => {
      D.LIFE_EVENTS.forEach(e => {
        if (!e.when(c) || live(st) >= e.p) return;
        const cls = pickLive(st, ['chem', 'history', 'algebra', 'English']);
        adjust(st, c.id, { mood: e.mood });
        if (e.id === 'sick') st.sick[c.id] = st.day + 1;
        notes.push({ kind: 'life', a: c.id, text: fill(e.text, { a: c.first, cls }) });
      });
    });
    // moods settle back toward their nature
    D.CAST.forEach(c => { const n = st.npcs[c.id]; n.mood = clamp(n.mood * 0.7 + (c.traits.warmth - 0.4) * 0.3 + (live(st) - 0.5) * 0.4, -1, 1); n.talksToday = 0; });
    // memories fade; big ones fade slowly
    D.CAST.forEach(c => st.npcs[c.id].mem.forEach(m => { m.w *= Math.abs(m.v) >= 2 ? 0.992 : 0.95; }));
    // news travels: the biggest gossips text you
    notes.forEach(nt => {
      if (nt.kind === 'life' && live(st) > 0.55) return;
      const subjects = [nt.a, nt.b].filter(Boolean);
      const teller = D.CAST.filter(c => !subjects.includes(c.id) && st.npcs[c.id].met && st.npcs[c.id].friend >= 10 && c.traits.drama >= 0.5)
        .sort((x, y) => y.traits.drama - x.traits.drama)[0];
      const g = addGossip(st, { key: nt.kind + subjects.join('') + st.day, text: nt.text, about: subjects, secret: false, from: teller ? teller.id : null });
      if (teller && g) text(st, teller.id, gossipText(teller, nt), { gossip: g.id });
    });
    return notes;
  }
  function gossipText(teller, nt) {
    const o = {
      jordan: ['OKAY so. ', 'you did NOT hear this from me but ', 'news!!! '],
      sofia: ['ok so apparently ', 'um did you hear?? ', 'not to be dramatic but '],
      tyler: ['lol ', 'yo '], darnell: ['YO ', 'bro did you hear '], marcus: ['yo '], hannah: [''], maya: [''], priya: [''], eli: ['um. ']
    }[teller.id] || [''];
    return o[Math.floor(Math.random() * o.length)] + nt.text.charAt(0).toLowerCase() + nt.text.slice(1);
  }

  // NPCs reach out on their own
  function npcInitiative(st) {
    const di = dayInfo(st.day);
    D.CAST.forEach(c => {
      const n = st.npcs[c.id];
      if (!n.met || !n.gaveNumber) return;
      const r = live(st);
      if (n.friend >= 30 && r < 0.07 && !di.weekend) {
        text(st, c.id, pickLive(st, [`diner after school? i need fries`, `you around after school? rosie's?`, `come to rosie's after school, i'm buying (not really)`]), { invite: { place: 'diner', slot: 'after', day: st.day } });
      } else if (n.friend >= 25 && n.mood < -0.35 && r < 0.25) {
        text(st, c.id, pickLive(st, [`today was bad.`, `can i vent for a sec`, `ugh. worst day.`]), { vent: true });
      } else if (n.romance >= 45 && r < 0.12) {
        text(st, c.id, pickLive(st, [`what are you doing right now`, `random but i was thinking about that thing you said`, `are you awake`]), { crush: true });
      }
    });
  }

  function startDay(st) {
    const P = st.player;
    const rested = P.flags.sleptEarly ? 12 : 0;
    P.flags.sleptEarly = false;
    P.energy = clamp(P.energy + 48 + rested, 0, 100);
    P.mood = clamp(P.mood + (65 - P.mood) * 0.2, 0, 100);
  }

  /* Move to the next slot. Returns { newDay, notes } when the day rolls over. */
  function advance(st) {
    st.slot++;
    if (st.slot < slots(st).length) return { newDay: false };
    st.slot = 0;
    const notes = simulateNight(st);
    st.day++;
    if (st.day > lastDay()) { st.ended = true; return { newDay: true, notes, ended: true }; }
    startDay(st);
    npcInitiative(st);
    st.plans = st.plans.filter(p => p.day >= st.day - 1);
    return { newDay: true, notes };
  }

  return {
    WEEKS, DAY_NAMES, hash, rnd, live, pick, pickLive, fill, cap, clamp,
    newState, bond, addBond, dayInfo, slots, curSlot, classToday, lastDay,
    whereIs, present, placeOpen, partyTonight, tierOf, relLabel, adjust,
    remember, memories, strongest, learn, stat, energy, mood, gpa, study,
    text, addGossip, log, simulateNight, advance, startDay, compat
  };
})();
