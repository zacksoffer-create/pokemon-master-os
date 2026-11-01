/* Ballpark sound: a copy of the shared synth with the noises a hitter hears.
   No audio files; every sound is built from oscillators and noise. Sound
   starts only after the first tap, which is what browsers require. */
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
    const g = c.createGain(); env(g, t, 0.003, vol || 0.3, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const sounds = {
    // the crack: sharper and louder the better you got it
    crack(q) {
      const v = 0.18 + Math.min(1, q || 0.5) * 0.4;
      noise(0.05, 'highpass', 2200, 0.9, v);
      tone(1900 + (q || 0.5) * 600, 0.025, 'square', v * 0.35);
      noise(0.16, 'bandpass', 950, 1.2, v * 0.5, 0.01);
    },
    tick() { noise(0.03, 'highpass', 3200, 1, 0.2); },
    swing() { noise(0.13, 'bandpass', 650, 0.7, 0.12); },
    mitt() { tone(170, 0.09, 'sine', 0.45, 0, 80); noise(0.05, 'lowpass', 1300, 1, 0.4); },
    release() { noise(0.06, 'bandpass', 900, 1.5, 0.1); },
    ump() { tone(210, 0.32, 'sawtooth', 0.07, 0, 150); tone(140, 0.32, 'square', 0.03, 0, 110); },
    organ() { [523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.13, 'triangle', 0.13, i * 0.13); tone(f / 2, 0.13, 'sine', 0.08, i * 0.13); }); },
    charge() { [392, 523, 659, 784].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.12, 'square', 0.06, i * 0.14)); },
    cheer() { noise(1.6, 'bandpass', 1300, 0.6, 0.2); noise(1.2, 'bandpass', 2400, 0.8, 0.09, 0.15); },
    groan() { noise(0.8, 'lowpass', 500, 0.7, 0.14); },
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
