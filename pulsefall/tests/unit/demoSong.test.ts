import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEMO_ARTIST,
  DEMO_BEATS_PER_BAR,
  DEMO_BPM,
  DEMO_TITLE,
  demoDurationMs,
  demoEvents,
  demoSections,
  renderDemoSong,
  type DemoEvent,
  type DemoRender,
} from '../../src/core/demo/demoSong';

const BEAT_MS = 60000 / 116;
const BAR_MS = BEAT_MS * 4;
const FIRST_DOWNBEAT_MS = 500;
const SR = 22050;

function idx(ms: number, sr: number): number {
  return Math.round((ms * sr) / 1000);
}

/** RMS over both channels in dBFS (-Infinity for digital silence). */
function rmsDb(r: DemoRender, fromMs: number, toMs: number): number {
  const a = idx(fromMs, r.sampleRate);
  const b = idx(toMs, r.sampleRate);
  let sum = 0;
  for (let i = a; i < b; i++) sum += r.left[i] * r.left[i] + r.right[i] * r.right[i];
  return 10 * Math.log10(sum / (2 * (b - a)));
}

/** FNV-1a over the raw float bits of both channels. */
function hashRender(r: DemoRender): number {
  let h = 0x811c9dc5;
  for (const ch of [r.left, r.right]) {
    const words = new Uint32Array(ch.buffer, ch.byteOffset, ch.length);
    for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 0x01000193);
  }
  return h >>> 0;
}

/** RBJ biquad, direct form I, applied in place. */
function biquad(x: Float32Array, type: 'lowpass' | 'highpass', f: number, sr: number): void {
  const w = (2 * Math.PI * f) / sr;
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b1 = (type === 'lowpass' ? 1 - cos : -(1 + cos)) / a0;
  const b0 = (type === 'lowpass' ? (1 - cos) / 2 : (1 + cos) / 2) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
}

function energy(x: Float32Array, from: number, to: number): number {
  let e = 0;
  for (let i = from; i < to; i++) e += x[i] * x[i];
  return e;
}

describe('demo song score', () => {
  const sections = demoSections();
  const events = demoEvents();
  const duration = demoDurationMs();
  const section = (name: string) => {
    const s = sections.find((x) => x.name === name);
    if (!s) throw new Error(`missing section ${name}`);
    return s;
  };
  const inSection = (name: string, kind?: DemoEvent['kind']) =>
    events.filter((e) => e.section === name && (kind === undefined || e.kind === kind));

  it('exposes the song metadata', () => {
    expect(DEMO_TITLE).toBe('Neon Overture');
    expect(DEMO_ARTIST).toBe('Pulsefall');
    expect(DEMO_BPM).toBe(116);
    expect(DEMO_BEATS_PER_BAR).toBe(4);
  });

  it('has contiguous sections that cover the whole song', () => {
    expect(sections.map((s) => s.name)).toEqual([
      'intro',
      'verse',
      'build',
      'drop',
      'breakdown',
      'final-chorus',
      'outro',
    ]);
    expect(sections[0].startMs).toBe(0);
    expect(sections[0].startBar).toBe(0);
    expect(sections[sections.length - 1].endMs).toBe(duration);
    let bar = 0;
    sections.forEach((s, i) => {
      expect(s.startBar).toBe(bar);
      expect(s.intensity).toBeGreaterThanOrEqual(0);
      expect(s.intensity).toBeLessThanOrEqual(1);
      expect(s.endMs).toBeGreaterThan(s.startMs);
      if (i > 0) {
        expect(s.startMs).toBe(sections[i - 1].endMs);
        expect(s.startMs).toBeCloseTo(FIRST_DOWNBEAT_MS + s.startBar * BAR_MS, 6);
      }
      bar += s.bars;
    });
    expect(bar).toBe(34);
    expect(duration).toBeCloseTo(FIRST_DOWNBEAT_MS + 34 * BAR_MS + 1500, 6);
    // The chorus sections are the loudest, the breakdown and the bookends quiet.
    expect(section('drop').intensity).toBe(1);
    expect(section('intro').intensity).toBeLessThan(section('verse').intensity);
  });

  it('lists every event sorted, on the beat grid, and inside the song', () => {
    expect(events.length).toBeGreaterThan(1000);
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (i > 0) expect(e.t).toBeGreaterThanOrEqual(events[i - 1].t);
      expect(Math.abs(e.t - (FIRST_DOWNBEAT_MS + (e.bar * 4 + e.beat) * BEAT_MS))).toBeLessThan(0.001);
      expect(e.beat).toBeGreaterThanOrEqual(0);
      expect(e.beat).toBeLessThan(DEMO_BEATS_PER_BAR);
      expect(e.t).toBeGreaterThanOrEqual(FIRST_DOWNBEAT_MS);
      expect(e.dur).toBeGreaterThan(0);
      expect(e.t + e.dur).toBeLessThanOrEqual(duration);
      expect(e.vel).toBeGreaterThan(0);
      expect(e.vel).toBeLessThanOrEqual(1);
      const owner = sections.find((s) => e.bar >= s.startBar && e.bar < s.startBar + s.bars);
      expect(owner?.name).toBe(e.section);
      const pitched = e.kind === 'bass' || e.kind === 'lead' || e.kind === 'pad' || e.kind === 'arp';
      expect(e.midi !== undefined).toBe(pitched);
    }
    expect(events[0].t).toBe(FIRST_DOWNBEAT_MS);
  });

  it('follows the arrangement the chart builder relies on', () => {
    // Four-on-the-floor with claps on 2 and 4 through the verse.
    expect(inSection('verse', 'kick')).toHaveLength(32);
    expect(inSection('verse', 'clap').every((e) => e.beat === 1 || e.beat === 3)).toBe(true);

    // Build: a 4-bar riser from its first downbeat, an accelerating snare roll,
    // no kick in the last two beats, and a fill on the very last beat.
    const build = section('build');
    const riser = inSection('build', 'riser');
    expect(riser).toHaveLength(1);
    expect(riser[0].bar).toBe(build.startBar);
    expect(riser[0].beat).toBe(0);
    expect(riser[0].dur).toBeCloseTo(4 * BAR_MS, 6);
    const lastBar = build.startBar + build.bars - 1;
    expect(inSection('build', 'kick').filter((e) => e.bar === lastBar && e.beat >= 2)).toHaveLength(0);
    const fill = inSection('build', 'fill');
    expect(fill.map((e) => [e.bar, e.beat])).toEqual([[lastBar, 3]]);
    const rollPerBar = [0, 1, 2, 3].map((k) => inSection('build', 'snare').filter((e) => e.bar === build.startBar + k).length);
    expect(rollPerBar).toEqual([4, 8, 16, 12]);

    // Crashes mark both choruses.
    for (const name of ['drop', 'final-chorus']) {
      expect(inSection(name, 'crash').some((e) => e.bar === section(name).startBar && e.beat === 0)).toBe(true);
    }

    // The lead hook has both holds (>= 1 beat) and short syncopated notes.
    const lead = inSection('drop', 'lead');
    expect(lead.filter((e) => e.dur >= BEAT_MS).length).toBeGreaterThanOrEqual(6);
    expect(lead.filter((e) => e.dur < BEAT_MS && e.beat % 1 !== 0).length).toBeGreaterThanOrEqual(6);
    // ...built from a repeating two-bar motif: every odd bar opens identically.
    const opening = (bar: number) =>
      lead.filter((e) => e.bar === bar && e.beat < 2.5).map((e) => [e.beat, e.midi]);
    const drop = section('drop');
    for (const k of [2, 4, 6]) expect(opening(drop.startBar + k)).toEqual(opening(drop.startBar));
    // The final chorus ends on a long note.
    const finalLead = inSection('final-chorus', 'lead');
    expect(finalLead[finalLead.length - 1].dur).toBeGreaterThanOrEqual(4 * BEAT_MS);

    // Breakdown: drums out except a kick on beat 1, pad chords held two bars.
    const breakdownDrums = inSection('breakdown').filter((e) => ['snare', 'clap', 'hat', 'openhat'].includes(e.kind));
    expect(breakdownDrums).toHaveLength(0);
    expect(inSection('breakdown', 'kick').every((e) => e.beat === 0)).toBe(true);
    expect(inSection('breakdown', 'pad').every((e) => Math.abs(e.dur - 2 * BAR_MS) < 1e-6)).toBe(true);
  });
});

describe('demo song audio', () => {
  let render: DemoRender;
  let progress: number[];

  beforeAll(() => {
    progress = [];
    render = renderDemoSong(SR, (f) => progress.push(f));
  });

  it('renders the full duration as finite stereo below the peak ceiling', () => {
    const length = Math.round((demoDurationMs() * SR) / 1000);
    expect(render.sampleRate).toBe(SR);
    expect(render.durationMs).toBe(demoDurationMs());
    expect(render.left.length).toBe(length);
    expect(render.right.length).toBe(length);
    let peak = 0;
    for (const ch of [render.left, render.right]) {
      for (let i = 0; i < ch.length; i++) {
        const v = ch[i];
        if (!Number.isFinite(v)) throw new Error(`non-finite sample at ${i}`);
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
    }
    expect(peak).toBeLessThanOrEqual(0.98);
    expect(peak).toBeGreaterThan(0.5);
  });

  it('reports progress a handful of times, ending at 1', () => {
    expect(progress.length).toBeGreaterThanOrEqual(3);
    expect(progress.length).toBeLessThanOrEqual(20);
    for (let i = 1; i < progress.length; i++) expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('starts silent and has a much louder chorus than intro', () => {
    expect(rmsDb(render, 0, 450)).toBeLessThan(-50);
    const sections = demoSections();
    const intro = sections.find((s) => s.name === 'intro');
    const drop = sections.find((s) => s.name === 'drop');
    if (!intro || !drop) throw new Error('missing sections');
    const introDb = rmsDb(render, FIRST_DOWNBEAT_MS, intro.endMs);
    const dropDb = rmsDb(render, drop.startMs, drop.endMs);
    expect(dropDb - introDb).toBeGreaterThanOrEqual(6);
    // Mixed to a sensible level: chorus RMS roughly -16..-11 dBFS.
    expect(dropDb).toBeGreaterThan(-16);
    expect(dropDb).toBeLessThan(-11);
  });

  it('puts a low-frequency transient at every verse kick event', () => {
    const mono = new Float32Array(render.left.length);
    for (let i = 0; i < mono.length; i++) mono[i] = 0.5 * (render.left[i] + render.right[i]);
    biquad(mono, 'highpass', 30, SR);
    biquad(mono, 'lowpass', 150, SR);
    biquad(mono, 'lowpass', 150, SR);

    const win = idx(10, SR);
    const tol = idx(15, SR);
    const kicks = demoEvents().filter((e) => e.kind === 'kick' && e.section === 'verse');
    expect(kicks.length).toBe(32);
    for (const k of kicks) {
      const s = idx(k.t, SR);
      // Energy in the 10 ms after the onset dwarfs the 10 ms before it.
      expect(energy(mono, s, s + win)).toBeGreaterThan(4 * energy(mono, s - win, s));
      // And the band envelope first reaches half its local peak within +/-15 ms of t.
      let peak = 0;
      for (let i = s - tol; i < s + 2 * tol; i++) peak = Math.max(peak, Math.abs(mono[i]));
      let onset = s - tol;
      while (Math.abs(mono[onset]) < 0.5 * peak) onset++;
      expect(Math.abs(onset - s)).toBeLessThanOrEqual(tol);
    }
  });

  it('is deterministic', () => {
    const again = renderDemoSong(SR);
    expect(hashRender(again)).toBe(hashRender(render));
  });

  it('renders a full song at 44.1 kHz quickly', () => {
    const started = performance.now();
    const full = renderDemoSong(44100);
    const elapsed = performance.now() - started;
    expect(full.left.length).toBe(Math.round((demoDurationMs() * 44100) / 1000));
    expect(elapsed).toBeLessThan(6000);
  });
});
