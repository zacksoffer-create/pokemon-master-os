/* GolfEmbed: what a finished Fairway session is worth to LIFE OS (see shared/lifeos.js).
   Pure: it reads the engine's own summary of the session (res), the spec that was played and the
   app's context, and returns { score, max, summary, stats } for LifeOS.finish. LIFE OS reads
   score / max as great (80% or more), good (50% or more) or a miss.

   Every planned item counts toward max and an unplayed one scores 0, so walking off early never helps.
     round    a hole: birdie or better 2, par 1.5, bogey 1, double 0.5, worse 0 (or picked up). Max 2 a hole.
              Even par is 75%; two under over nine (or one birdie in three holes) is great; bogey golf is 50%.
     ctp      a shot: 1 - feet / 60, in the water 0. Max 1 a shot. 12 ft average is 80%, 30 ft is 50%.
     putting  a putt: holed 1, a miss left inside 3 ft (the results screen's tap-ins) 0.5. Max 1 a putt.
     updown   a spot: up and down 1, down in three 0.5. Max 1 a spot. */
const GolfEmbed = (() => {
  const r2 = x => Math.round(x * 100) / 100;
  const toPar = n => n === 0 ? 'Even par' : n > 0 ? '+' + n : String(n);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const LIST = { round: 'holes', ctp: 'shots', putting: 'putts', updown: 'spots' };
  const holePts = h => Math.max(0, Math.min(2, 1.5 - 0.5 * (h.strokes - h.par)));
  const shotPts = h => h.ft == null ? 0 : Math.max(0, 1 - h.ft / 60);
  const puttPts = h => h.made ? 1 : h.leave * 3 < 3 ? 0.5 : 0;
  const spotPts = h => h.upDown ? 1 : h.strokes === 3 ? 0.5 : 0;

  function result(res, spec, ctx) {
    res = res || {}; ctx = ctx || {};
    const k = res.kind, holes = res.holes || [];
    const list = spec && LIST[k] && spec[LIST[k]];
    const n = Math.max(1, list ? list.length : 0, holes.length);
    const complete = !res.quit && holes.length >= n;
    const stats = { kind: k, title: ctx.title || (spec && spec.title) || '', played: holes.length, of: n, complete, readIQ: res.readIQ || 0 };
    if (ctx.challenge) stats.challenge = ctx.challenge;
    const partial = complete ? '' : `, ${holes.length} of ${n} played`;
    let score = 0, max = n, summary = '';
    if (k === 'round') {
      max = n * 2;
      score = holes.reduce((a, h) => a + holePts(h), 0);
      const strokes = holes.reduce((a, h) => a + h.strokes, 0), par = holes.reduce((a, h) => a + h.par, 0);
      Object.assign(stats, {
        strokes, par, toPar: strokes - par,
        birdies: holes.filter(h => h.strokes < h.par).length, pars: holes.filter(h => h.strokes === h.par).length,
        bogeys: holes.filter(h => h.strokes === h.par + 1).length, worse: holes.filter(h => h.strokes > h.par + 1).length,
        fairways: holes.filter(h => h.fir).length, fairwayHoles: holes.filter(h => h.fir != null).length,
        greens: holes.filter(h => h.gir).length, putts: holes.reduce((a, h) => a + (h.putts || 0), 0)
      });
      summary = complete ? `${toPar(strokes - par)} over ${n}` : `${toPar(strokes - par)} through ${holes.length} of ${n}`;
    } else if (k === 'ctp') {
      score = holes.reduce((a, h) => a + shotPts(h), 0);
      const total = holes.reduce((a, h) => a + (h.ft == null ? 100 : h.ft), 0);
      const avg = holes.length ? Math.round(total / holes.length) : 0, wet = holes.filter(h => h.ft == null).length;
      Object.assign(stats, { totalFt: total, avgFt: avg, inside30: holes.filter(h => h.ft != null && h.ft <= 30).length, wet, aces: holes.filter(h => h.holed).length });
      summary = holes.length ? `${avg} ft average${wet ? `, ${wet} wet` : ''}${partial}` : 'No shots hit';
    } else if (k === 'putting') {
      score = holes.reduce((a, h) => a + puttPts(h), 0);
      const made = holes.filter(h => h.made).length, tap = holes.filter(h => !h.made && h.leave * 3 < 3).length;
      Object.assign(stats, { made, putts: holes.length, tapIns: tap });
      summary = `${made} of ${plural(holes.length, 'putt', 'putts')}${tap ? `, ${plural(tap, 'tap-in', 'tap-ins')}` : ''}${partial}`;
    } else if (k === 'updown') {
      score = holes.reduce((a, h) => a + spotPts(h), 0);
      const ud = holes.filter(h => h.upDown).length;
      Object.assign(stats, { upDown: ud, spots: holes.length, strokes: holes.reduce((a, h) => a + h.strokes, 0) });
      summary = `${ud} of ${holes.length} up and down${partial}`;
    }
    if (ctx.challenge && stats.title) summary = `${stats.title}: ${summary}`;
    return { score: Math.min(max, r2(score)), max, summary, stats };
  }

  return { result };
})();
