/* Golf sounds, synthesized the same way as the shared audio: oscillators and
   noise only, so the game stays one page. Sound starts after the first touch. */
const GolfSfx = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (_) { ctx = null; }
    return ctx;
  }
  function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.004, vol || 0.3, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, filterType, freq, q, vol, when) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain(); env(g, t, 0.003, vol || 0.3, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const sounds = {
    // pure contact is a crisp click with a little body under it; a mishit is duller
    strike(q) {
      const pure = q === 'pure' || q === 'solid';
      noise(0.05, 'highpass', pure ? 3200 : 1400, 0.8, pure ? 0.42 : 0.3);
      tone(pure ? 1900 : 900, 0.05, 'triangle', pure ? 0.16 : 0.1);
      tone(170, 0.12, 'sine', 0.22, 0, 110);
    },
    whoosh() { noise(0.22, 'bandpass', 900, 0.7, 0.12); },
    putt() { tone(980, 0.05, 'triangle', 0.16); noise(0.03, 'bandpass', 2400, 2, 0.12); },
    land(s) { tone(80, 0.12, 'sine', Math.min(0.3, 0.08 + (s || 0.3) * 0.3), 0, 55); noise(0.05, 'lowpass', 500, 1, 0.08); },
    cup() { [0, 0.07, 0.13].forEach((w, i) => tone(720 - i * 90, 0.08, 'triangle', 0.2, w)); tone(140, 0.2, 'sine', 0.3, 0.2, 80); },
    lip() { tone(760, 0.06, 'triangle', 0.18); tone(640, 0.08, 'triangle', 0.14, 0.06); },
    splash() { noise(0.5, 'lowpass', 1400, 0.6, 0.3); noise(0.25, 'bandpass', 3000, 1.2, 0.1, 0.05); },
    tree() { noise(0.4, 'bandpass', 2600, 0.5, 0.2); tone(300, 0.06, 'square', 0.04, 0.1); },
    sand() { noise(0.18, 'bandpass', 1800, 0.6, 0.25); },
    clap() { for (let i = 0; i < 14; i++) noise(0.04, 'bandpass', 1500 + Math.random() * 1200, 1.5, 0.08, i * 0.06 + Math.random() * 0.03); },
    cheer() { noise(1.3, 'bandpass', 1200, 0.6, 0.16); noise(0.9, 'bandpass', 2300, 0.8, 0.07, 0.15); },
    groan() { noise(0.8, 'lowpass', 500, 0.7, 0.12); },
    tick() { tone(1400, 0.04, 'square', 0.05); },
    good() { tone(660, 0.1, 'sine', 0.2); tone(990, 0.16, 'sine', 0.2, 0.08); },
    great() { tone(660, 0.1, 'triangle', 0.2); tone(880, 0.1, 'triangle', 0.2, 0.07); tone(1320, 0.22, 'triangle', 0.2, 0.14); },
    bad() { tone(300, 0.2, 'sine', 0.18, 0, 200); },
    ui() { tone(520, 0.05, 'sine', 0.12); }
  };

  function play(name, arg) { try { sounds[name] && sounds[name](arg); } catch (_) {} }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} }
  return {
    play, buzz, unlock,
    get muted() { return muted; },
    set muted(v) { muted = !!v; }
  };
})();
