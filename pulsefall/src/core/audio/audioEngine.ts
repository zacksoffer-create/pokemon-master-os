import { SongClock, WebAudioTimeSource } from './clock';
import { buildSfx, type SfxBank, type SfxName } from './sfx';

type AudioContextCtor = typeof AudioContext;

interface AudioSessionLike {
  type: string;
}

/**
 * Owns the single AudioContext and the mixing graph:
 *   music ─┐
 *   sfx ───┼─ master ─ destination
 *   ui ────┘
 * Creating/resuming the context must happen inside a user gesture on iOS, so `unlock()`
 * is synchronous up to the point where it calls resume().
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  musicBus!: GainNode;
  private sfxBus!: GainNode;
  private uiBus!: GainNode;
  private sfx: SfxBank | null = null;
  private silentEl: HTMLAudioElement | null = null;
  private listeners = new Set<(state: string) => void>();
  private volumes = { music: 0.9, sfx: 0.45, ui: 0.5 };

  get supported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext);
  }

  /** Call from a click/touch handler. Safe to call repeatedly. */
  unlock(): Promise<void> {
    if (!this.ctx) this.create();
    const ctx = this.ctx!;
    this.preferPlaybackSession();
    // A one-sample silent buffer started inside the gesture unlocks older WebKit.
    try {
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
    const p = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    return p.catch(() => undefined);
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  onStateChange(fn: (state: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setVolumes(v: { music?: number; sfx?: number; ui?: number }): void {
    Object.assign(this.volumes, v);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.volumes.music, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.02);
    this.uiBus.gain.setTargetAtTime(this.volumes.ui, t, 0.02);
  }

  /** Decode a compressed file. Uses a copy because decodeAudioData detaches its input. */
  async decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.ctx) this.create();
    const ctx = this.ctx!;
    const copy = bytes.slice(0);
    return new Promise<AudioBuffer>((resolve, reject) => {
      try {
        const p = ctx.decodeAudioData(copy, resolve, (e) => reject(e ?? new Error('decode failed')));
        if (p && typeof p.then === 'function') p.then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  createClock(): SongClock {
    if (!this.ctx) this.create();
    return new SongClock(new WebAudioTimeSource(this.ctx!));
  }

  play(name: SfxName, opts: { gain?: number; rate?: number; bus?: 'sfx' | 'ui'; when?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.sfx) return;
    const buf = this.sfx[name];
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (opts.rate) src.playbackRate.value = opts.rate;
    let node: AudioNode = src;
    if (opts.gain !== undefined && opts.gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = opts.gain;
      src.connect(g);
      node = g;
    }
    node.connect(opts.bus === 'ui' ? this.uiBus : this.sfxBus);
    src.start(opts.when ?? 0);
  }

  /** Keep the music audible on iPhones with the ringer/silent switch set to silent. */
  private preferPlaybackSession(): void {
    const nav = navigator as Navigator & { audioSession?: AudioSessionLike };
    if (nav.audioSession) {
      try {
        // Safari 17+: play through the ringer/silent switch like a music app.
        nav.audioSession.type = 'playback';
        return;
      } catch {
        /* fall through */
      }
    }
    // Older iOS: a playing media element switches the session to "playback", which also
    // un-mutes Web Audio when the silent switch is on.
    if (isIOS() && !this.silentEl) {
      const el = document.createElement('audio');
      el.src = silentWavUrl();
      el.loop = true;
      el.setAttribute('playsinline', '');
      el.volume = 0.0001;
      el.play().catch(() => undefined);
      this.silentEl = el;
    }
  }

  private create(): void {
    const Ctor: AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.uiBus = ctx.createGain();
    for (const g of [this.musicBus, this.sfxBus, this.uiBus]) g.connect(this.master);
    this.musicBus.gain.value = this.volumes.music;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.uiBus.gain.value = this.volumes.ui;
    this.sfx = buildSfx(ctx);
    ctx.addEventListener('statechange', () => {
      for (const fn of this.listeners) fn(ctx.state);
    });
  }
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

let silentUrl: string | null = null;
function silentWavUrl(): string {
  if (silentUrl) return silentUrl;
  const rate = 8000;
  const samples = rate / 2;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}

export const audio = new AudioEngine();
