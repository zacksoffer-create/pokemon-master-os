/* At Bat inside LIFE OS: what a LIFE OS round launches, and how a finished
   session turns into the score/max LIFE OS reads (great >= 80%, good >= 50%).
   Data and arithmetic only: the swing, the pitches and the pitchers are the
   game's own. Only used when LifeOS.embedded. */
const BatEmbed = (() => {
  // the clutch arm, by difficulty: soft stuff, then the pitchers who live off the plate, then the heat
  const TIERS = { low: ['junk', 'sinker'], mid: ['slider', 'lefty'], high: ['flame', 'closer'] };
  // late and close: get him in from third, ducks on the pond, then two outs and it's on you
  const CLUTCH_SITS = ['sacfly', 'loaded', 'twoout'];
  const HITS = ['single', 'double', 'triple', 'hr'];
  const MODES = { abs: 'abs', atbats: 'abs', situ: 'situ', situational: 'situ', derby: 'derby' };

  function tier(d) { d = Number(d); if (!isFinite(d)) d = 50; return d < 45 ? 'low' : d > 65 ? 'high' : 'mid'; }

  // 'clutch', a home-screen mode id ('abs' | 'situ' | 'derby'), or 'menu'
  function playOf(cfg) {
    const p = String((cfg && cfg.play) || 'menu').toLowerCase();
    if (p === 'clutch' || (p === 'menu' && cfg && cfg.mode === 'clutch')) return 'clutch';
    return MODES[p] || 'menu';
  }

  function clutchSpec(cfg) {
    const pair = TIERS[tier(cfg.difficulty)];
    const seed = Math.abs(Math.floor(Number(cfg.seed) || 0));
    const pitcher = pair[seed ? seed % 2 : Math.random() < 0.5 ? 0 : 1];
    const opp = cfg.opponent ? String(cfg.opponent) : '';
    return { kind: 'abs', count: CLUTCH_SITS.length, title: opp ? `vs ${opp}` : 'Game on the line', plan: CLUTCH_SITS.map(situation => ({ pitcher, situation })) };
  }

  // did the job: a hit, a walk or HBP, or what the situation asked for (the sac fly that scores him)
  const reached = l => HITS.includes(l.kind) || l.kind === 'walk' || l.kind === 'hbp';
  const didJob = l => reached(l) || l.sitSuccess === true;
  // hitting is hard: coming through in a third of your trips is good, two thirds is great
  const parFor = n => Math.max(1, Math.ceil(n * 2 / 3));

  const HIT_NAME = { single: 'single', double: 'double', triple: 'triple' };
  const RANK = { single: 1, double: 2, triple: 3, hr: 4 };
  function hitWords(l) {
    const r = l.rbi || 0;
    if (l.kind === 'hr') return r >= 4 ? 'a grand slam' : r <= 1 ? 'a solo homer' : `a ${r}-run homer`;
    const n = HIT_NAME[l.kind];
    return r === 0 ? `a ${n}` : r === 1 ? `an RBI ${n}` : `a ${r}-run ${n}`;
  }
  function abSummary(res) {
    const log = res.log || [];
    const hits = log.filter(l => HITS.includes(l.kind));
    const ab = res.ab || 0, walks = log.filter(l => l.kind === 'walk').length, hbp = log.filter(l => l.kind === 'hbp').length;
    const parts = [`${hits.length} for ${ab}`];
    let rbiSaid = 0;
    const best = hits.slice().sort((a, b) => (RANK[b.kind] - RANK[a.kind]) || ((b.rbi || 0) - (a.rbi || 0)))[0];
    if (best) { parts.push(hitWords(best)); rbiSaid += best.rbi || 0; }
    if (walks) parts.push(walks === 1 ? 'a walk' : `${walks} walks`);
    if (hbp) parts.push(hbp === 1 ? 'hit by a pitch' : `hit by ${hbp} pitches`);
    log.filter(l => l.sitSuccess === true && !reached(l)).slice(0, 2).forEach(l => {
      const goal = (Pitchers.SITUATIONS[l.situation] || {}).goal;
      if (l.rbi && /fly|line out/i.test(l.label || '')) parts.push('a sac fly');
      else if (l.rbi) parts.push(`an RBI ${String(l.label || 'out').toLowerCase().replace('ground out', 'groundout')}`);
      else parts.push(goal === 'score' ? 'got the run in' : goal === 'move' || goal === 'hitrun' ? 'moved the runner over' : 'came through');
      rbiSaid += l.rbi || 0;
    });
    if ((res.rbi || 0) > rbiSaid) parts.push(`${res.rbi} RBI`);
    if (parts.length === 1 && res.k) parts.push(res.k === 1 ? 'a strikeout' : `${res.k} strikeouts`);
    return parts.join(', ');
  }

  /* The LIFE OS result for a session, or null when it doesn't end the round
     (the batting cage is practice). spec is the session's spec, ctx the app's
     context for it ({ lifeos: 'clutch' } | { rec } | { challenge }). */
  function result(res, spec, ctx) {
    ctx = ctx || {};
    if (!res || res.kind === 'cage') return null;
    if (res.kind === 'derby') {
      const hr = res.hr || 0;
      return {
        score: Math.min(hr, 10), max: 10,
        summary: `${hr} home run${hr === 1 ? '' : 's'}${res.longest ? `, longest ${res.longest} ft` : ''}`,
        stats: { mode: 'derby', hr, longest: res.longest || 0, outs: res.outs || 0 }
      };
    }
    if (res.kind !== 'abs') return null;
    const log = res.log || [];
    const n = Math.max(log.length, (spec && spec.count) || 0, 1);
    const jobs = log.filter(didJob).length;
    const max = parFor(n);
    const mode = ctx.lifeos === 'clutch' ? 'clutch' : ctx.challenge ? 'challenge' : ctx.rec === 'situ' ? 'situational' : 'atbats';
    const pitcher = spec && spec.plan && spec.plan[0] && Pitchers.PITCHERS[spec.plan[0].pitcher];
    return {
      score: Math.min(jobs, max), max,
      summary: abSummary(res),
      stats: {
        mode, challenge: ctx.challenge || undefined, pitcher: mode === 'clutch' && pitcher ? pitcher.name : undefined,
        plateAppearances: log.length, planned: n, cameThrough: jobs, par: max,
        hits: res.hits || 0, ab: res.ab || 0, bb: res.bb || 0, hr: res.hr || 0, rbi: res.rbi || 0, k: res.k || 0,
        points: res.points || 0, readIQ: res.readIQ || 0, quit: !!res.quit
      }
    };
  }

  return { TIERS, CLUTCH_SITS, tier, playOf, clutchSpec, didJob, parFor, result };
})();
