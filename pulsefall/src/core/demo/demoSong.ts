// "Neon Overture": Pulsefall's built-in, rights-clear demo track.
//
// The song exists twice, and the two must agree: as a list of events
// (demoEvents, the score) and as audio (renderDemoSong). The renderer plays
// exactly that list, so every event is audible at its `t` and nothing
// percussive sounds that is not in it. That lets tests and the chart builder
// use the score as ground truth for beats, onsets, holds and sections.
//
// Key of A minor, 116 BPM, Am - F - C - G. Synthesis lives in ./synth.

import {
  PingPongDelay,
  Reverb,
  OnePole,
  addSidechainDuck,
  bassVoice,
  clamp,
  clapVoice,
  crashVoice,
  fillVoice,
  hashSeed,
  hatVoice,
  kickVoice,
  leadVoice,
  midiToHz,
  padChordVoice,
  panGains,
  pluckVoice,
  riserVoice,
  snareVoice,
  softClip,
} from './synth';

export const DEMO_TITLE = 'Neon Overture';
export const DEMO_ARTIST = 'Pulsefall';
export const DEMO_BPM = 116;
export const DEMO_BEATS_PER_BAR = 4;

export type DemoEventKind =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hat'
  | 'openhat'
  | 'crash'
  | 'bass'
  | 'lead'
  | 'pad'
  | 'arp'
  | 'riser'
  | 'fill';

export interface DemoEvent {
  /** Onset time in ms from the start of the audio buffer. */
  t: number;
  kind: DemoEventKind;
  /** Sounding length in ms (gate length for notes, audible length for hits). */
  dur: number;
  midi?: number;
  /** 0..1 */
  vel: number;
  /** Bar index from the first downbeat (0-based, song-global). */
  bar: number;
  /** Beat position within the bar as a float, e.g. 0, 0.5, 2.75. */
  beat: number;
  section: string;
}

export interface DemoSection {
  name: string;
  /** The first section starts at 0 (it owns the lead-in silence); the others start on their downbeat. */
  startMs: number;
  /** Equal to the next section's startMs; the last section ends at demoDurationMs() (it owns the tail). */
  endMs: number;
  startBar: number;
  bars: number;
  /** 0..1 */
  intensity: number;
}

export interface DemoRender {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Time grid
// ---------------------------------------------------------------------------

const BEAT_MS = 60000 / DEMO_BPM;
const BAR_MS = BEAT_MS * DEMO_BEATS_PER_BAR;
/** Bar 0, beat 0. A non-zero first beat keeps beat trackers honest. */
const FIRST_DOWNBEAT_MS = 500;
/** Silence-bound decay after the last bar. */
const TAIL_MS = 1500;

function beatTime(bar: number, beat: number): number {
  return FIRST_DOWNBEAT_MS + (bar * DEMO_BEATS_PER_BAR + beat) * BEAT_MS;
}

function beats(n: number): number {
  return n * BEAT_MS;
}

// ---------------------------------------------------------------------------
// Harmony and arrangement
// ---------------------------------------------------------------------------

type ChordName = 'Am' | 'F' | 'C' | 'G';

interface Chord {
  /** Bass root (octave 1-2). */
  bass: number;
  /** Warm four-note pad voicing around middle C. */
  pad: readonly number[];
  /** Arp tones: triad plus octave, an octave above the pad. */
  arp: readonly number[];
}

const CHORDS: Record<ChordName, Chord> = {
  Am: { bass: 33, pad: [57, 60, 64, 67], arp: [69, 72, 76, 81] }, // Am7
  F: { bass: 29, pad: [53, 57, 60, 64], arp: [65, 69, 72, 77] }, // Fmaj7
  C: { bass: 36, pad: [55, 60, 64, 67], arp: [67, 72, 76, 79] },
  G: { bass: 31, pad: [55, 59, 62, 67], arp: [67, 71, 74, 79] },
};

const LOOP: readonly ChordName[] = ['Am', 'F', 'C', 'G'];

interface SectionPlan {
  name: string;
  bars: number;
  intensity: number;
  /** One chord per bar. */
  chords: readonly ChordName[];
}

const ARRANGEMENT: readonly SectionPlan[] = [
  { name: 'intro', bars: 4, intensity: 0.25, chords: LOOP },
  { name: 'verse', bars: 8, intensity: 0.55, chords: [...LOOP, ...LOOP] },
  { name: 'build', bars: 4, intensity: 0.7, chords: LOOP },
  { name: 'drop', bars: 8, intensity: 1, chords: [...LOOP, ...LOOP] },
  // bVI - bVII lifts back into the tonic for the final chorus.
  { name: 'breakdown', bars: 4, intensity: 0.3, chords: ['F', 'F', 'G', 'G'] },
  { name: 'final-chorus', bars: 4, intensity: 1, chords: LOOP },
  { name: 'outro', bars: 2, intensity: 0.2, chords: ['Am', 'Am'] },
];

const TOTAL_BARS = ARRANGEMENT.reduce((sum, s) => sum + s.bars, 0);

/** Audible length of each one-shot hit, in ms (snare rolls use their spacing instead). */
const HIT_MS = { kick: 420, snare: 260, clap: 420, hat: 70, openhat: 380, crash: 2400 } as const;

// The lead hook. Each phrase is two bars: [beat offset, midi, length in beats].
// Every phrase opens with the same E-D-C-D figure (the motif) in a 3-3-2 rhythm.
type Phrase = ReadonlyArray<readonly [number, number, number]>;

const MOTIF: Phrase = [
  [0, 76, 0.75],
  [0.75, 74, 0.75],
  [1.5, 72, 0.5],
  [2, 74, 0.5],
];

/** Over Am - F: "E D C D E~ | A G E C~~". */
const HOOK_A: Phrase = [...MOTIF, [2.5, 76, 1.5], [4, 81, 0.75], [4.75, 79, 0.75], [5.5, 76, 0.5], [6, 72, 2]];
/** Over C - G: "E D C D G~ | G E D~~~". */
const HOOK_B: Phrase = [...MOTIF, [2.5, 79, 1.5], [4, 79, 0.75], [4.75, 76, 0.75], [5.5, 74, 2.5]];
/** Turnaround that ends the drop on a held A. */
const HOOK_B_TURN: Phrase = [...MOTIF, [2.5, 79, 1.5], [4, 79, 0.75], [4.75, 76, 0.75], [5.5, 79, 0.5], [6, 81, 2]];
/** Final-chorus variation: leaps to high C, then rings a long A into the outro. */
const HOOK_FINALE: Phrase = [...MOTIF, [2.5, 84, 1.5], [4, 83, 0.75], [4.75, 79, 0.75], [5.5, 81, 6.5]];

/** 16th-note arp walk over the chord's four arp tones (8-step cycle). */
const ARP_PATTERN = [0, 1, 2, 3, 1, 2, 3, 2];

/**
 * Verse bass: syncopated 3-3-2 [beat, semitone offset, length in beats, vel].
 * Notes before a kick are staccato so the kick owns the low end on its onset.
 */
const VERSE_BASS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0.5, 0.9],
  [0.75, 0, 0.2, 0.75],
  [1.5, 12, 0.4, 0.78],
  [2, 0, 0.5, 0.85],
  [2.75, 0, 0.2, 0.75],
  [3.5, 12, 0.4, 0.8],
];

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

interface Part {
  sec: DemoSection;
  chords: readonly ChordName[];
  out: DemoEvent[];
}

function add(
  p: Part,
  kind: DemoEventKind,
  barInSection: number,
  beat: number,
  durMs: number,
  vel: number,
  midi?: number,
): void {
  const bar = p.sec.startBar + barInSection;
  const event: DemoEvent = {
    t: beatTime(bar, beat),
    kind,
    dur: durMs,
    vel: clamp(vel, 0, 1),
    bar,
    beat,
    section: p.sec.name,
  };
  if (midi !== undefined) event.midi = midi;
  p.out.push(event);
}

function chordAt(p: Part, barInSection: number): Chord {
  return CHORDS[p.chords[barInSection]];
}

/** Places a phrase starting at `startBar`; phrase beats may run past bar lines. */
function playPhrase(p: Part, kind: DemoEventKind, phrase: Phrase, startBar: number, vel: number): void {
  for (const [offset, midi, len] of phrase) {
    const barOffset = Math.floor(offset / DEMO_BEATS_PER_BAR);
    // Held notes get a touch more weight than passing ones.
    add(p, kind, startBar + barOffset, offset - barOffset * DEMO_BEATS_PER_BAR, beats(len), vel * (len >= 1 ? 1 : 0.9), midi);
  }
}

function fourOnTheFloor(p: Part, bar: number, vel: number, lastBeat = 3): void {
  for (let b = 0; b <= lastBeat; b++) add(p, 'kick', bar, b, HIT_MS.kick, b === 0 ? vel : vel * 0.95);
}

function kickPart(p: Part): void {
  const { name, bars } = p.sec;
  if (name === 'verse' || name === 'drop' || name === 'final-chorus') {
    for (let bar = 0; bar < bars; bar++) fourOnTheFloor(p, bar, name === 'verse' ? 0.92 : 1);
  } else if (name === 'build') {
    // Kick drops out for the last two beats before the drop.
    for (let bar = 0; bar < bars; bar++) fourOnTheFloor(p, bar, 0.95, bar === bars - 1 ? 1 : 3);
  } else if (name === 'breakdown') {
    for (let bar = 0; bar < bars; bar++) add(p, 'kick', bar, 0, HIT_MS.kick, 0.55);
  } else if (name === 'outro') {
    add(p, 'kick', 0, 0, HIT_MS.kick, 0.9);
  }
}

function clapPart(p: Part): void {
  const { name, bars } = p.sec;
  const clapBars = name === 'build' ? 2 : name === 'verse' || name === 'drop' || name === 'final-chorus' ? bars : 0;
  const vel = name === 'verse' || name === 'build' ? 0.82 : 0.92;
  for (let bar = 0; bar < clapBars; bar++) {
    add(p, 'clap', bar, 1, HIT_MS.clap, vel);
    add(p, 'clap', bar, 3, HIT_MS.clap, vel);
  }
}

function snarePart(p: Part): void {
  const { name, bars } = p.sec;
  if (name === 'build') {
    // Accelerating roll: quarters, 8ths, then 16ths; the last beat is left to the fill.
    const steps = [1, 0.5, 0.25, 0.25];
    for (let bar = 0; bar < bars; bar++) {
      const step = steps[bar];
      const end = bar === bars - 1 ? 3 : 4;
      for (let beat = 0; beat < end; beat += step) {
        const progress = (bar * 4 + beat) / (bars * 4);
        add(p, 'snare', bar, beat, beats(step), 0.38 + 0.6 * progress);
      }
    }
  } else if (name === 'drop' || name === 'final-chorus') {
    // Layered under the clap for extra crack.
    for (let bar = 0; bar < bars; bar++) {
      add(p, 'snare', bar, 1, HIT_MS.snare, 0.6);
      add(p, 'snare', bar, 3, HIT_MS.snare, 0.6);
    }
  } else if (name === 'verse') {
    // Little pickup into the build.
    add(p, 'snare', bars - 1, 3.5, beats(0.25), 0.45);
    add(p, 'snare', bars - 1, 3.75, beats(0.25), 0.6);
  }
}

function hatPart(p: Part): void {
  const { name, bars } = p.sec;
  for (let bar = 0; bar < bars; bar++) {
    for (let step = 0; step < 16; step++) {
      const beat = step / 4;
      const sub = step % 4; // 0 = on the beat, 2 = the "and"
      if (name === 'intro') {
        if (bar >= 2 && sub === 2) add(p, 'hat', bar, beat, HIT_MS.hat, 0.4 + 0.1 * (bar - 2));
      } else if (name === 'verse') {
        const sixteenths = bar >= 4;
        if (sub === 2 && step === 14 && bar % 4 === 3) add(p, 'openhat', bar, beat, HIT_MS.openhat, 0.62);
        else if (sub === 2) add(p, 'hat', bar, beat, HIT_MS.hat, 0.75);
        else if (sub === 0) add(p, 'hat', bar, beat, HIT_MS.hat, 0.45);
        else if (sixteenths) add(p, 'hat', bar, beat, HIT_MS.hat, 0.3);
      } else if (name === 'build') {
        if (bar < bars - 1) add(p, 'hat', bar, beat, HIT_MS.hat, (sub === 2 ? 0.6 : 0.38) + 0.08 * bar);
      } else if (name === 'drop' || name === 'final-chorus') {
        if (sub === 2) add(p, 'openhat', bar, beat, HIT_MS.openhat, 0.62);
        else add(p, 'hat', bar, beat, HIT_MS.hat, sub === 0 ? 0.45 : sub === 1 ? 0.3 : 0.38);
      }
    }
  }
}

function crashPart(p: Part): void {
  const { name } = p.sec;
  if (name === 'verse') add(p, 'crash', 0, 0, HIT_MS.crash, 0.55);
  else if (name === 'drop') {
    add(p, 'crash', 0, 0, HIT_MS.crash, 0.9);
    add(p, 'crash', 4, 0, HIT_MS.crash, 0.5);
  } else if (name === 'final-chorus') add(p, 'crash', 0, 0, HIT_MS.crash, 1);
  else if (name === 'outro') add(p, 'crash', 0, 0, HIT_MS.crash, 0.75);
}

function fxPart(p: Part): void {
  const { name, bars } = p.sec;
  if (name === 'build') {
    add(p, 'riser', 0, 0, beats(bars * DEMO_BEATS_PER_BAR), 0.8);
    add(p, 'fill', bars - 1, 3, beats(1), 0.9);
  } else if (name === 'breakdown') {
    add(p, 'riser', bars - 2, 0, beats(2 * DEMO_BEATS_PER_BAR), 0.5);
    add(p, 'fill', bars - 1, 3, beats(1), 0.6);
  }
}

function bassPart(p: Part): void {
  const { name, bars } = p.sec;
  for (let bar = 0; bar < bars; bar++) {
    const root = chordAt(p, bar).bass;
    if (name === 'verse') {
      for (const [beat, octave, len, vel] of VERSE_BASS) add(p, 'bass', bar, beat, beats(len), vel, root + octave);
    } else if (name === 'build') {
      // Driving 8ths; stops halfway through the last bar to leave a gap before the drop.
      const notes = bar === bars - 1 ? 4 : 8;
      for (let k = 0; k < notes; k++) add(p, 'bass', bar, k / 2, beats(0.4), 0.62 + 0.08 * bar, root);
    } else if (name === 'drop' || name === 'final-chorus') {
      // Rolling 16ths around (never on) the kick: root, octave, root.
      for (let beat = 0; beat < 4; beat++) {
        add(p, 'bass', bar, beat + 0.25, beats(0.2), 0.75, root);
        add(p, 'bass', bar, beat + 0.5, beats(0.2), 0.9, root + 12);
        add(p, 'bass', bar, beat + 0.75, beats(0.2), 0.75, root);
      }
    } else if (name === 'breakdown' && bar % 2 === 0) {
      add(p, 'bass', bar, 0, beats(8), 0.42, root);
    } else if (name === 'outro' && bar === 0) {
      add(p, 'bass', bar, 0, beats(6), 0.75, root);
    }
  }
}

function padPart(p: Part): void {
  const { name, bars } = p.sec;
  if (name === 'breakdown' || name === 'outro') {
    // Long chords, two bars each: natural hold notes.
    for (let bar = 0; bar < bars; bar += 2) {
      for (const midi of chordAt(p, bar).pad) add(p, 'pad', bar, 0, beats(8), name === 'outro' ? 0.5 : 0.6, midi);
    }
    return;
  }
  for (let bar = 0; bar < bars; bar++) {
    let vel: number;
    if (name === 'intro') vel = 0.4 + 0.12 * bar; // fading in
    else if (name === 'verse') vel = 0.42;
    else if (name === 'build') vel = 0.48 + 0.05 * bar;
    else vel = 0.6;
    for (const midi of chordAt(p, bar).pad) add(p, 'pad', bar, 0, BAR_MS, vel, midi);
  }
}

function arpPart(p: Part): void {
  const { name, bars } = p.sec;
  if (name === 'breakdown') {
    // The hook's motif, softly, on the pluck.
    playPhrase(p, 'arp', HOOK_A, 0, 0.5);
    playPhrase(p, 'arp', HOOK_B, 2, 0.5);
    return;
  }
  if (name === 'outro') return;
  const eighths = name === 'intro';
  const stepBeats = eighths ? 0.5 : 0.25;
  const stepsPerBar = DEMO_BEATS_PER_BAR / stepBeats;
  for (let bar = 0; bar < bars; bar++) {
    const tones = chordAt(p, bar).arp;
    for (let step = 0; step < stepsPerBar; step++) {
      let vel: number;
      if (name === 'intro') vel = 0.3 + 0.05 * bar;
      else if (name === 'build') vel = 0.5 + 0.06 * bar;
      else if (name === 'verse') vel = 0.58;
      else vel = 0.34;
      const accent = eighths ? 1 : step % 4 === 0 ? 1 : step % 2 === 0 ? 0.82 : 0.68;
      const midi = tones[ARP_PATTERN[step % ARP_PATTERN.length]];
      add(p, 'arp', bar, step * stepBeats, beats(stepBeats), vel * accent, midi);
    }
  }
}

function leadPart(p: Part): void {
  if (p.sec.name === 'drop') {
    playPhrase(p, 'lead', HOOK_A, 0, 0.85);
    playPhrase(p, 'lead', HOOK_B, 2, 0.85);
    playPhrase(p, 'lead', HOOK_A, 4, 0.88);
    playPhrase(p, 'lead', HOOK_B_TURN, 6, 0.88);
  } else if (p.sec.name === 'final-chorus') {
    playPhrase(p, 'lead', HOOK_A, 0, 0.9);
    playPhrase(p, 'lead', HOOK_FINALE, 2, 0.92);
  }
}

const PARTS: ReadonlyArray<(p: Part) => void> = [
  kickPart,
  clapPart,
  snarePart,
  hatPart,
  crashPart,
  fxPart,
  bassPart,
  padPart,
  arpPart,
  leadPart,
];

const KIND_ORDER: readonly DemoEventKind[] = [
  'kick',
  'snare',
  'clap',
  'hat',
  'openhat',
  'crash',
  'riser',
  'fill',
  'bass',
  'pad',
  'arp',
  'lead',
];

function compareEvents(a: DemoEvent, b: DemoEvent): number {
  return (
    a.t - b.t || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.midi ?? -1) - (b.midi ?? -1)
  );
}

export function demoDurationMs(): number {
  return FIRST_DOWNBEAT_MS + TOTAL_BARS * BAR_MS + TAIL_MS;
}

export function demoSections(): DemoSection[] {
  const sections: DemoSection[] = [];
  let bar = 0;
  ARRANGEMENT.forEach((plan, i) => {
    sections.push({
      name: plan.name,
      startMs: i === 0 ? 0 : beatTime(bar, 0),
      endMs: i === ARRANGEMENT.length - 1 ? demoDurationMs() : beatTime(bar + plan.bars, 0),
      startBar: bar,
      bars: plan.bars,
      intensity: plan.intensity,
    });
    bar += plan.bars;
  });
  return sections;
}

export function demoEvents(): DemoEvent[] {
  const out: DemoEvent[] = [];
  demoSections().forEach((sec, i) => {
    const part: Part = { sec, chords: ARRANGEMENT[i].chords, out };
    for (const write of PARTS) write(part);
  });
  return out.sort(compareEvents);
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

interface Channel {
  gain: number;
  pan: number;
  /** How deeply the kick sidechain ducks this part (0..1). */
  duck: number;
  reverb: number;
  delay: number;
}

const MIX: Record<DemoEventKind, Channel> = {
  kick: { gain: 0.72, pan: 0, duck: 0, reverb: 0, delay: 0 },
  snare: { gain: 0.42, pan: 0.04, duck: 0, reverb: 0.16, delay: 0 },
  clap: { gain: 0.58, pan: 0, duck: 0, reverb: 0.2, delay: 0 },
  hat: { gain: 0.46, pan: 0.3, duck: 0, reverb: 0, delay: 0 },
  openhat: { gain: 0.3, pan: -0.28, duck: 0.25, reverb: 0.04, delay: 0 },
  crash: { gain: 0.26, pan: 0, duck: 0, reverb: 0.08, delay: 0 },
  bass: { gain: 0.5, pan: 0, duck: 0.6, reverb: 0, delay: 0 },
  lead: { gain: 0.5, pan: 0, duck: 0.15, reverb: 0.2, delay: 0.14 },
  pad: { gain: 0.08, pan: 0, duck: 0.75, reverb: 0.3, delay: 0 },
  arp: { gain: 0.42, pan: 0.35, duck: 0.35, reverb: 0.14, delay: 0.32 },
  riser: { gain: 0.11, pan: 0, duck: 0, reverb: 0.2, delay: 0 },
  fill: { gain: 0.55, pan: 0, duck: 0, reverb: 0.25, delay: 0 },
};

/** Timbre automation per section: [value at section start, value at section end]. */
interface Timbre {
  padCutoff: readonly [number, number];
  padAttack: number;
  padRelease: number;
  arpBrightness: readonly [number, number];
}

const TIMBRE: Record<string, Timbre> = {
  intro: { padCutoff: [260, 1500], padAttack: 0.5, padRelease: 0.5, arpBrightness: [0.08, 0.35] },
  verse: { padCutoff: [1300, 1400], padAttack: 0.12, padRelease: 0.3, arpBrightness: [0.5, 0.6] },
  build: { padCutoff: [1300, 5000], padAttack: 0.1, padRelease: 0.25, arpBrightness: [0.55, 1] },
  drop: { padCutoff: [3000, 3000], padAttack: 0.03, padRelease: 0.25, arpBrightness: [0.72, 0.72] },
  breakdown: { padCutoff: [800, 2400], padAttack: 0.6, padRelease: 0.6, arpBrightness: [0.4, 0.55] },
  'final-chorus': { padCutoff: [3200, 3200], padAttack: 0.03, padRelease: 0.25, arpBrightness: [0.8, 0.8] },
  outro: { padCutoff: [2400, 450], padAttack: 0.04, padRelease: 1.1, arpBrightness: [0.5, 0.5] },
};

const MASTER_GAIN = 0.84;
const MASTER_KNEE = 0.72;
const MASTER_CEILING = 0.95;
const SIDECHAIN_ATTACK_S = 0.004;
const SIDECHAIN_RELEASE_S = 0.24;
/** Dotted-eighth echoes, the synth-pop staple. */
const DELAY_BEATS = 0.75;

/** Mixes voice scratch buffers into the stereo song, with sidechain duck and effect sends. */
class Mixer {
  readonly left: Float32Array;
  readonly right: Float32Array;
  readonly duckEnv: Float32Array;
  readonly reverbSend: Float32Array;
  readonly delaySend: Float32Array;

  constructor(length: number) {
    this.left = new Float32Array(length);
    this.right = new Float32Array(length);
    this.duckEnv = new Float32Array(length);
    this.reverbSend = new Float32Array(length);
    this.delaySend = new Float32Array(length);
  }

  /** `srcR` null means a mono source, placed with an equal-power pan; stereo sources are balanced. */
  add(srcL: Float32Array, srcR: Float32Array | null, n: number, start: number, ch: Channel, pan: number): void {
    let gl: number;
    let gr: number;
    if (srcR === null) {
      const g = panGains(pan);
      gl = g.left * ch.gain;
      gr = g.right * ch.gain;
    } else {
      gl = ch.gain * (pan > 0 ? 1 - pan : 1);
      gr = ch.gain * (pan < 0 ? 1 + pan : 1);
    }
    const right = srcR ?? srcL;
    const { left: L, right: R, duckEnv, reverbSend, delaySend } = this;
    const end = Math.min(n, L.length - start);
    if (ch.duck === 0 && ch.reverb === 0 && ch.delay === 0) {
      // Dry fast path (kick, hats, crash): half the memory traffic.
      for (let i = 0; i < end; i++) {
        L[start + i] += srcL[i] * gl;
        R[start + i] += right[i] * gr;
      }
      return;
    }
    const depth = ch.duck;
    const rev = ch.reverb * 0.5;
    const del = ch.delay * 0.5;
    for (let i = 0; i < end; i++) {
      const j = start + i;
      const g = 1 - depth * duckEnv[j];
      const l = srcL[i] * gl * g;
      const r = right[i] * gr * g;
      L[j] += l;
      R[j] += r;
      reverbSend[j] += (l + r) * rev;
      delaySend[j] += (l + r) * del;
    }
  }
}

function sectionProgress(sections: readonly DemoSection[], name: string, ms: number): number {
  const sec = sections.find((s) => s.name === name);
  if (!sec) return 0;
  const from = beatTime(sec.startBar, 0);
  return clamp((ms - from) / (sec.bars * BAR_MS), 0, 1);
}

function lerp(range: readonly [number, number], x: number): number {
  return range[0] + (range[1] - range[0]) * x;
}

function expInterp(range: readonly [number, number], x: number): number {
  return range[0] * Math.pow(range[1] / range[0], x);
}

interface RenderState {
  sr: number;
  sections: readonly DemoSection[];
  mixer: Mixer;
  scratchL: Float32Array;
  scratchR: Float32Array;
}

function renderEvent(e: DemoEvent, index: number, s: RenderState): void {
  const { sr, mixer, scratchL, scratchR, sections } = s;
  const start = Math.round((e.t * sr) / 1000);
  const lengthSec = e.dur / 1000;
  const seed = hashSeed(index, KIND_ORDER.indexOf(e.kind));
  const ch = MIX[e.kind];
  const timbre = TIMBRE[e.section];
  const progress = sectionProgress(sections, e.section, e.t);
  let n: number;
  switch (e.kind) {
    case 'kick':
      n = kickVoice(scratchL, sr, e.vel, lengthSec, seed);
      mixer.add(scratchL, null, n, start, ch, ch.pan);
      break;
    case 'snare': {
      const tone = e.section === 'build' ? progress : 0.6;
      n = snareVoice(scratchL, sr, e.vel, lengthSec, tone, seed);
      mixer.add(scratchL, null, n, start, ch, ch.pan);
      break;
    }
    case 'clap':
      n = clapVoice(scratchL, scratchR, sr, e.vel, lengthSec, seed);
      mixer.add(scratchL, scratchR, n, start, ch, ch.pan);
      break;
    case 'hat':
    case 'openhat':
      n = hatVoice(scratchL, sr, e.vel, lengthSec, e.kind === 'openhat', seed);
      mixer.add(scratchL, null, n, start, ch, ch.pan);
      break;
    case 'crash':
      n = crashVoice(scratchL, scratchR, sr, e.vel, lengthSec, seed);
      mixer.add(scratchL, scratchR, n, start, ch, ch.pan);
      break;
    case 'fill':
      n = fillVoice(scratchL, sr, e.vel, lengthSec, seed);
      mixer.add(scratchL, null, n, start, ch, ch.pan);
      break;
    case 'riser':
      n = riserVoice(scratchL, scratchR, sr, e.vel, lengthSec, seed);
      mixer.add(scratchL, scratchR, n, start, ch, ch.pan);
      break;
    case 'bass':
      n = bassVoice(scratchL, sr, midiToHz(e.midi ?? 33), lengthSec, e.vel);
      mixer.add(scratchL, null, n, start, ch, ch.pan);
      break;
    case 'arp': {
      const brightness = lerp(timbre.arpBrightness, progress);
      n = pluckVoice(scratchL, sr, midiToHz(e.midi ?? 69), lengthSec, e.vel, brightness);
      // Alternate 16ths left and right for width.
      const side = Math.round(e.beat * 4) % 2 === 0 ? -1 : 1;
      mixer.add(scratchL, null, n, start, ch, side * ch.pan);
      break;
    }
    case 'lead':
      n = leadVoice(scratchL, scratchR, sr, midiToHz(e.midi ?? 76), lengthSec, e.vel, seed);
      mixer.add(scratchL, scratchR, n, start, ch, ch.pan);
      break;
    case 'pad':
      // Rendered a whole chord at a time by renderPadChord.
      break;
  }
}

/**
 * Pad tones struck together (same onset and gate, adjacent in the sorted
 * score) are rendered as one chord voice: events[from..to).
 */
function renderPadChord(events: readonly DemoEvent[], from: number, to: number, s: RenderState): void {
  const { sr, mixer, scratchL, scratchR, sections } = s;
  const e = events[from];
  const timbre = TIMBRE[e.section];
  const chord = events.slice(from, to);
  const n = padChordVoice(scratchL, scratchR, sr, {
    freqs: chord.map((tone) => midiToHz(tone.midi ?? 57)),
    vels: chord.map((tone) => tone.vel),
    gateSec: e.dur / 1000,
    attackSec: timbre.padAttack,
    releaseSec: timbre.padRelease,
    cutoffFrom: expInterp(timbre.padCutoff, sectionProgress(sections, e.section, e.t)),
    cutoffTo: expInterp(timbre.padCutoff, sectionProgress(sections, e.section, e.t + e.dur)),
    seed: hashSeed(from, KIND_ORDER.indexOf('pad')),
  });
  mixer.add(scratchL, scratchR, n, Math.round((e.t * sr) / 1000), MIX.pad, MIX.pad.pan);
}

/** Gentle master: DC block, gain, knee soft-clip (peak stays below 0.95), and a final fade to silence. */
function master(left: Float32Array, right: Float32Array, sr: number): void {
  const dcL = new OnePole(sr, 12);
  const dcR = new OnePole(sr, 12);
  const n = left.length;
  const fadeLen = Math.round(0.4 * sr);
  const fadeStart = n - fadeLen;
  for (let i = 0; i < n; i++) {
    let fade = 1;
    if (i > fadeStart) {
      const x = (n - i) / fadeLen;
      fade = x * x;
    }
    left[i] = softClip(dcL.highpass(left[i] * MASTER_GAIN) * fade, MASTER_KNEE, MASTER_CEILING);
    right[i] = softClip(dcR.highpass(right[i] * MASTER_GAIN) * fade, MASTER_KNEE, MASTER_CEILING);
  }
}

/**
 * Renders the score from demoEvents() to stereo audio. Deterministic: the same
 * sample rate always yields bit-identical buffers. `onProgress` fires a few
 * times with a fraction in 0..1, ending at 1.
 */
export function renderDemoSong(sampleRate = 44100, onProgress?: (fraction: number) => void): DemoRender {
  return renderEventList(demoEvents(), sampleRate, onProgress);
}

function renderEventList(
  events: readonly DemoEvent[],
  sr: number,
  onProgress?: (fraction: number) => void,
): DemoRender {
  const durationMs = demoDurationMs();
  const length = Math.round((durationMs * sr) / 1000);
  const sections = demoSections();
  const mixer = new Mixer(length);

  // Sidechain first, so every part can read the kick's pump as it is mixed.
  const attack = Math.round(SIDECHAIN_ATTACK_S * sr);
  const release = Math.round(SIDECHAIN_RELEASE_S * sr);
  for (const e of events) {
    if (e.kind === 'kick') addSidechainDuck(mixer.duckEnv, Math.round((e.t * sr) / 1000), e.vel, attack, release);
  }

  // Scratch buffers sized for the longest voice (release tails included).
  let longestMs = 0;
  for (const e of events) longestMs = Math.max(longestMs, e.dur);
  const scratchLen = Math.ceil(((longestMs + 1500) * sr) / 1000);
  const state: RenderState = {
    sr,
    sections,
    mixer,
    scratchL: new Float32Array(scratchLen),
    scratchR: new Float32Array(scratchLen),
  };

  const reportEvery = Math.ceil(events.length / 6);
  let nextReport = reportEvery;
  for (let i = 0; i < events.length; ) {
    if (events[i].kind === 'pad') {
      let j = i + 1;
      while (j < events.length && events[j].kind === 'pad' && events[j].t === events[i].t && events[j].dur === events[i].dur) j++;
      renderPadChord(events, i, j, state);
      i = j;
    } else {
      renderEvent(events[i], i, state);
      i++;
    }
    if (onProgress && i >= nextReport) {
      onProgress(0.75 * (i / events.length));
      nextReport += reportEvery;
    }
  }

  const delay = new PingPongDelay(sr, (DELAY_BEATS * BEAT_MS) / 1000, 0.38);
  delay.process(mixer.delaySend, mixer.left, mixer.right, 1);
  onProgress?.(0.82);
  const reverb = new Reverb(sr);
  reverb.process(mixer.reverbSend, mixer.left, mixer.right, 1);
  onProgress?.(0.94);

  master(mixer.left, mixer.right, sr);
  onProgress?.(1);
  return { sampleRate: sr, left: mixer.left, right: mixer.right, durationMs };
}
