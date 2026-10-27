/* Synthesized sound for the pong table: the click of a ping pong ball on
   wood, the hollow pop of a plastic cup, the plunk when it drops in. Same
   approach as the shared sound module (oscillators and noise, no files),
   tuned for a lighter ball. Starts after the first tap. */
const PongSfx = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (_) { ctx = null; }
    return ctx;
  }
  function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(freq, dur, type, vol, when, slideTo) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.003, vol || 0.3, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, type, freq, q, vol, when) {
    const c = ensure(); if (!c || muted) return;
    const t = c.currentTime + (when || 0);
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain(); env(g, t, 0.002, vol || 0.3, dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const sounds = {
    tock(s) { const v = Math.min(0.5, 0.15 + (s || 0.5) * 0.4); tone(2600 + Math.random() * 300, 0.035, 'triangle', v * 0.6); noise(0.03, 'bandpass', 3800, 2.5, v); },
    cup(s) { const v = Math.min(0.45, 0.12 + (s || 0.5) * 0.35); tone(520 + Math.random() * 80, 0.09, 'sine', v, 0, 380); noise(0.05, 'bandpass', 1500, 2, v * 0.6); },
    sink() { tone(300, 0.16, 'sine', 0.35, 0, 140); noise(0.22, 'lowpass', 900, 0.8, 0.22, 0.03); tone(180, 0.2, 'sine', 0.18, 0.06, 90); },
    release() { noise(0.06, 'bandpass', 1400, 1.4, 0.1); },
    swat() { noise(0.1, 'lowpass', 1600, 1, 0.45); tone(160, 0.12, 'sine', 0.35, 0, 90); },
    blow() { noise(0.45, 'bandpass', 700, 0.6, 0.3); },
    cheer() { noise(1.3, 'bandpass', 1300, 0.6, 0.18); noise(0.9, 'bandpass', 2400, 0.8, 0.08, 0.15); },
    groan() { noise(0.8, 'lowpass', 500, 0.7, 0.14); },
    fire() { noise(0.6, 'bandpass', 600, 0.5, 0.25); tone(220, 0.5, 'sawtooth', 0.06, 0, 440); },
    good() { tone(660, 0.1, 'sine', 0.2); tone(990, 0.16, 'sine', 0.2, 0.08); },
    great() { tone(660, 0.1, 'triangle', 0.2); tone(880, 0.1, 'triangle', 0.2, 0.07); tone(1320, 0.22, 'triangle', 0.2, 0.14); },
    bad() { tone(300, 0.2, 'sine', 0.18, 0, 200); },
    ui() { tone(520, 0.05, 'sine', 0.12); },
    rack() { for (let i = 0; i < 4; i++) tone(480 + i * 40, 0.05, 'sine', 0.12, i * 0.05, 300); }
  };
  function play(name, arg) { try { sounds[name] && sounds[name](arg); } catch (_) {} }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} }
  return { play, buzz, unlock, get muted() { return muted; }, set muted(v) { muted = !!v; } };
})();
