/* PongEmbed: Pong Night inside LIFE OS (see shared/lifeos.js). Labels, the opponent for a launched game, and what a
   finished session is worth. Pure: it reads LIFE OS's config and the engine's own summary of the session; it never
   touches the game. LIFE OS reads score / max as great (80% or more), good (50% or more) or a miss.

   Labels: before college (cfg.college !== true) the page is Cup Pong, water in the cups: the sign reads Cup Pong and the
   line above it ("Beer pong") reads Ten cups a side. In college it reads as written.
   Opponent by difficulty: under 40 the Statue; 40-59 the Waver or the Blower (the seed picks); 60-75 the Swatter; over 75 the Sniper.
   Score:
     game      cups you made out of 10. A win is 10/10; a loss caps at 9 (an overtime loss is 9).
     attack    throws to clear the rack: 10 or fewer is 20/20, one point off for each throw over 10, 30 or more is 0.
               14 throws is great (80%), 20 is good (50%). Fixed, so the same rack scores the same every time.
     shots     an Island drill: makes out of throws (a bounce in is one make).
     practice  makes out of throws, out of at least 10, so one lucky throw and quitting isn't great. */
const PongEmbed = (() => {
  const CUP_PONG = { doc: 'Cup Pong', eyebrow: 'Ten cups a side', sign: ['Cup', 'Pong'], game: 'Cup Pong' };
  function labels(cfg) { return cfg && cfg.college === true ? null : CUP_PONG; }

  function opponent(cfg) {
    cfg = cfg || {};
    const ask = String(cfg.opponent || '').toLowerCase().replace(/^the\s+/, '').trim();
    if (Pong.OPPONENTS[ask]) return ask;
    const n = Number(cfg.difficulty), d = isFinite(n) ? n : 50;
    if (d < 40) return 'statue';
    if (d < 60) { const s = Math.abs(Math.floor(Number(cfg.seed) || 0)); return (s ? s % 2 === 1 : d >= 50) ? 'blower' : 'waver'; }
    if (d <= 75) return 'swatter';
    return 'sniper';
  }
  // "the Swatter" mid-sentence, or the friend's name
  const who = (o, them) => them || o.name.replace(/^The /, 'the ');
  const ots = n => n > 1 ? `${n} overtimes` : 'overtime';

  // res: the engine's summary. ctx: { title, them, drill, newBest, best }
  function result(res, ctx) {
    res = res || {}; ctx = ctx || {};
    const k = res.kind, st = res.stats || {};
    const makes = res.makes || 0, throws = res.throws || 0;
    const stats = { kind: k, title: ctx.title || '', makes, throws, cupsMade: res.cupsMade || 0, readIQ: res.readIQ || 0,
                    arcs: st.arc, fastballs: st.fast, bounces: st.bounce };
    let score = 0, max = 1, summary = '';
    if (k === 'game') {
      const o = Pong.OPPONENTS[res.opponent] || { name: 'The other side' };
      const won = !!res.won, ot = res.overtime || 0;
      const mine = won ? 10 : Math.min(9, res.cupsMade || 0);
      const theirs = ot ? 10 : 10 - (res.yoursLeft || 0);
      max = 10; score = mine;
      Object.assign(stats, { opponent: res.opponent, them: ctx.them || null, won, overtime: ot, theirs });
      const vs = who(o, ctx.them);
      summary = won ? (ot ? `You beat ${vs} in ${ots(ot)}` : `You beat ${vs} 10-${theirs}`)
                    : (ot ? `You lost to ${vs} in ${ots(ot)}` : `You lost 10-${mine} to ${vs}`);
    } else if (k === 'attack') {
      max = 20; score = Math.max(0, Math.min(20, 30 - throws));
      Object.assign(stats, { best: ctx.best || throws, newBest: !!ctx.newBest });
      summary = `Cleared ten cups in ${throws} throws${ctx.newBest ? ', a new best' : ''}`;
    } else if (k === 'shots') {
      max = Math.max(1, throws); score = makes;
      stats.drill = ctx.drill || null;
      summary = `${ctx.title ? ctx.title + ': ' : ''}${makes} of ${throws}${res.cupsMade !== makes ? ` (${res.cupsMade} cups)` : ''}`;
    } else if (k === 'practice') {
      max = Math.max(10, throws); score = makes;
      summary = `${makes} of ${throws} in practice${throws < 10 ? ', counted out of 10 throws' : ''}`;
    }
    return { score: Math.max(0, Math.min(max, score)), max, summary, stats };
  }

  return { labels, opponent, result };
})();
