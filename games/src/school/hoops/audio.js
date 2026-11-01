/* Synthesized sound. No audio files: every sound is built from oscillators and
   noise, so the games stay one self-contained page. Sound starts only after
   the first tap, which is what browsers require. */
const Sfx = (() => {
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
    env(g, t, 0.005, vol || 0.3, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, filterType, freq, q, vol, when) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain(); env(g, t, 0.004, vol || 0.3, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const sounds = {
    swish() { noise(0.28, 'highpass', 2600, 0.7, 0.32); noise(0.18, 'bandpass', 5200, 2, 0.12, 0.05); },
    rim(strength) {
      const v = Math.min(0.45, 0.12 + (strength || 0.5) * 0.3);
      tone(640 + Math.random() * 60, 0.32, 'triangle', v);
      tone(1310, 0.2, 'sine', v * 0.5);
      noise(0.05, 'bandpass', 2000, 3, v * 0.6);
    },
    board() { tone(140, 0.18, 'sine', 0.4, 0, 90); noise(0.09, 'lowpass', 900, 1, 0.35); },
    bounce(strength) { tone(95, 0.14, 'sine', Math.min(0.5, 0.18 + (strength || 0.5) * 0.3), 0, 60); },
    release() { noise(0.06, 'bandpass', 900, 1.5, 0.12); },
    dribble() { tone(110, 0.1, 'sine', 0.35, 0, 70); noise(0.04, 'lowpass', 700, 1, 0.2); },
    whistle() { tone(2300, 0.35, 'square', 0.08); tone(2380, 0.35, 'square', 0.06); },
    buzzer() { tone(180, 0.7, 'sawtooth', 0.16); tone(183, 0.7, 'square', 0.08); },
    cheer() { noise(1.4, 'bandpass', 1300, 0.6, 0.18); noise(1.0, 'bandpass', 2400, 0.8, 0.08, 0.15); },
    groan() { noise(0.8, 'lowpass', 500, 0.7, 0.14); },
    block() { tone(70, 0.2, 'sine', 0.5, 0, 45); noise(0.12, 'lowpass', 1200, 1, 0.4); },
    tick() { tone(1400, 0.04, 'square', 0.05); },
    good() { tone(660, 0.1, 'sine', 0.2); tone(990, 0.16, 'sine', 0.2, 0.08); },
    great() { tone(660, 0.1, 'triangle', 0.2); tone(880, 0.1, 'triangle', 0.2, 0.07); tone(1320, 0.22, 'triangle', 0.2, 0.14); },
    bad() { tone(300, 0.2, 'sine', 0.18, 0, 200); },
    pop() { tone(880, 0.06, 'sine', 0.18, 0, 1200); },
    ui() { tone(520, 0.05, 'sine', 0.12); },
    page() { noise(0.12, 'bandpass', 3000, 0.9, 0.1); }
  };

  function play(name, arg) { try { sounds[name] && sounds[name](arg); } catch (_) {} }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} }
  return {
    play, buzz, unlock,
    get muted() { return muted; },
    set muted(v) { muted = !!v; }
  };
})();
