// Deterministic swings for At Bat: pointer events stamped with exact times on
// the page's clock, so a swing can be placed to the millisecond against a pitch.
module.exports = async function install(p) {
  await p.evaluate(() => {
    const realNow = performance.now.bind(performance);
    let frozen = null;
    performance.now = () => frozen != null ? frozen : realNow();
    window.__realNow = realNow;
    /* o: { downAt, fastAt (ms), dx, dy, dur (ms of the fast part), drag: [dx, dy], x, y, noUp } */
    window.__swing = o => {
      const cv = document.querySelector('.ab canvas');
      const x0 = o.x || 200, y0 = o.y || 720;
      const pts = [{ x: x0, y: y0, t: o.downAt, type: 'pointerdown' }];
      let sx = x0, sy = y0;
      if (o.drag) {
        const n = 8, span = Math.max(40, o.fastAt - o.downAt - 60);
        for (let i = 1; i <= n; i++) pts.push({ x: x0 + o.drag[0] * i / n, y: y0 + o.drag[1] * i / n, t: o.downAt + span * i / n, type: 'pointermove' });
        sx += o.drag[0]; sy += o.drag[1];
      }
      if (o.fastAt != null) {
        pts.push({ x: sx, y: sy, t: o.fastAt, type: 'pointermove' });
        const n = 6;
        for (let i = 1; i <= n; i++) pts.push({ x: sx + o.dx * i / n, y: sy + o.dy * i / n, t: o.fastAt + o.dur * i / n, type: 'pointermove' });
        sx += o.dx; sy += o.dy;
      }
      const tEnd = o.fastAt != null ? o.fastAt + o.dur + 1 : o.downAt + (o.hold || 300);
      if (!o.noUp) pts.push({ x: sx, y: sy, t: tEnd, type: 'pointerup' });
      pts.forEach(q => { frozen = q.t; cv.dispatchEvent(new PointerEvent(q.type, { clientX: q.x, clientY: q.y, pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch' })); });
      frozen = null;
    };
  });
  const S = expr => p.evaluate(expr);
  const waitPhase = (ph, ms = 12000) => p.waitForFunction(ph => window.__e && window.__e._S.phase === ph, ph, { timeout: ms });
  return {
    waitPhase,
    /* Swing at the pitch now in the air (or winding up): e is the timing error you
       want (s, negative early), aim moves your barrel to the pitch first. */
    swing: async (o = {}) => {
      await p.waitForFunction(() => window.__e._S.phase === 'windup' && window.__e._S.arriveAt, null, { timeout: 15000 });
      return p.evaluate(o => {
        const E = window.__e, St = E._S;
        const lag = o.kind === 'contact' ? 0.13 : 0.15;
        const t0 = (St.arriveAt - lag - E.settings.timing + (o.e || 0)) * 1000;
        if (o.aim) {
          const c = Pitch.at(St.pitch, St.pitch.T);
          const tgt = [c[0] + (o.miss ? o.miss[0] : 0), c[1] + (o.miss ? o.miss[1] : 0)];
          St.pci = tgt.slice(); St.pciHist = [{ t: 0, p: tgt.slice() }];
        }
        const len = o.kind === 'contact' ? 70 : 230;
        const ang = (o.plane == null ? 25 : o.plane) * Math.PI / 180;
        const dx = -Math.cos(ang) * len * (E.settings.bats === 'L' ? -1 : 1), dy = -Math.sin(ang) * len;
        window.__swing({ downAt: t0 - (o.hold == null ? 450 : o.hold), fastAt: t0, dx, dy, dur: o.dur || (o.kind === 'contact' ? 45 : 70), drag: o.drag || null });
        return { t0, arrive: St.arriveAt * 1000, type: St.pitch.typeId, mph: St.pitch.mph };
      }, o);
    },
    state: () => S(() => { const St = window.__e._S; return { phase: St.phase, cam: St.cam, count: Object.assign({}, St.count), outs: St.outs, runners: St.runners.slice(), score: St.score, contact: St.contact && { whiff: !!St.contact.whiff, foul: !!St.contact.foul, ev: St.contact.ev && Math.round(St.contact.ev), la: St.contact.la && Math.round(St.contact.la), spray: St.contact.spray && Math.round(St.contact.spray), e: St.contact.e && Math.round(St.contact.e * 1000), words: St.contact.words, kind: St.contact.kind }, res: St.res && { kind: St.res.kind, label: St.res.label, where: St.res.where, dist: St.res.dist }, card: !document.querySelector('.ab-card').hidden ? document.querySelector('.ab-card .w').textContent : null, grade: (document.querySelector('.ab-card .ab-grade') || {}).textContent || null }; })
  };
};
