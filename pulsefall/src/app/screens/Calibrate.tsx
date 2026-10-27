import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../../core/audio/audioEngine';
import { eventPerfTime, type SongClock } from '../../core/audio/clock';
import { calibrate, renderTime } from '../../core/game/offsets';
import { Icon } from '../components/Icon';
import { Button, Stepper, TopBar } from '../components/ui';
import { back } from '../router';
import { settingsStore, updateSettings, useSettings } from '../state/settings';
import { toast } from '../state/toast';

const BEAT_MS = 600;
const COUNT_IN = 4;
const AUDIO_TAPS = 16;
const VISUAL_TAPS = 12;

type Step = 'intro' | 'audio' | 'visual' | 'result';

/**
 * Two short tap-along tests on a generated metronome (no music needed):
 * clicks you hear measure audio + input latency; flashes you see measure display + input
 * latency. The difference separates audio latency from input latency.
 */
export function Calibrate() {
  const settings = useSettings();
  const [step, setStep] = useState<Step>('intro');
  const [taps, setTaps] = useState<number[]>([]);
  const [audioDeltas, setAudioDeltas] = useState<number[]>([]);
  const [visualDeltas, setVisualDeltas] = useState<number[]>([]);
  const [preview, setPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const clockRef = useRef<SongClock | null>(null);
  const groupRef = useRef<GainNode | null>(null);
  const genRef = useRef(0);
  const rafRef = useRef(0);
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const tapsRef = useRef<number[]>([]);
  const stepRef = useRef<Step>('intro');
  stepRef.current = step;

  useEffect(() => {
    // Lets the e2e bot read the metronome clock (only with ?debug).
    if (sessionStorage.getItem('pf-debug') === '1') (window as unknown as { __pfCal?: () => SongClock | null }).__pfCal = () => clockRef.current;
    return () => stopAll();
  }, []);

  /** Stops the frame loop and silences every click already scheduled. */
  function stopAll() {
    genRef.current++;
    cancelAnimationFrame(rafRef.current);
    clockRef.current = null;
    groupRef.current?.disconnect();
    groupRef.current = null;
    setPreview(false);
    setRunning(false);
  }

  /**
   * Start a click track (or a silent one) whose beat k is at song time k * BEAT_MS.
   * Clicks are scheduled a little ahead from `schedule()`, called every frame, so stopping
   * never leaves a long train of queued clicks. Resolves to null if it was superseded or the
   * audio clock couldn't start.
   */
  async function startTrack(withSound: boolean, beats: number): Promise<{ clock: SongClock; schedule: () => void } | null> {
    stopAll();
    const gen = genRef.current;
    await audio.unlock(); // resume() is still requested synchronously inside the tap
    if (gen !== genRef.current) return null;
    const ctx = audio.ctx!;
    if (ctx.state !== 'running') {
      toast("Sound didn't start. Check the volume, then try again.", 'error');
      return null;
    }
    const clock = audio.createClock();
    const t0 = ctx.currentTime + 0.5;
    clock.start(t0, 0);
    clockRef.current = clock;
    setRunning(true);
    const group = audio.createGroup();
    groupRef.current = group;
    let next = 0;
    const schedule = () => {
      if (!withSound) return;
      const horizon = ctx.currentTime + 0.3;
      for (; next < beats && t0 + (next * BEAT_MS) / 1000 < horizon; next++) {
        audio.play(next < COUNT_IN ? 'count' : 'tick', { when: t0 + (next * BEAT_MS) / 1000, gain: next < COUNT_IN ? 0.7 : 1.4, dest: group });
      }
    };
    schedule();
    return { clock, schedule };
  }

  async function begin(which: 'audio' | 'visual') {
    tapsRef.current = [];
    setTaps([]);
    setStep(which);
    const total = (which === 'audio' ? AUDIO_TAPS : VISUAL_TAPS) + COUNT_IN + 4;
    const track = await startTrack(which === 'audio', total);
    if (!track) {
      if (which === 'audio' && stepRef.current === 'audio') setStep('intro');
      return;
    }
    const { clock, schedule } = track;
    const loop = () => {
      const now = performance.now();
      const t = clock.update(now);
      schedule();
      if (which === 'visual' && ringRef.current) {
        const k = Math.floor(t / BEAT_MS);
        const since = t - k * BEAT_MS;
        const on = k >= 0 && k < total;
        ringRef.current.style.opacity = on ? String(Math.max(0.12, Math.exp(-since / 90))) : '0.12';
        ringRef.current.style.transform = `scale(${on ? 1 + 0.25 * Math.exp(-since / 90) : 1})`;
      }
      if (t > total * BEAT_MS + 400) {
        finishStep(which);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function finishStep(which: 'audio' | 'visual') {
    const deltas = tapsRef.current.slice();
    stopAll();
    if (deltas.length < 6) {
      toast('Not enough taps — try again, tapping along with every beat.', 'error');
      setStep(which === 'audio' ? 'intro' : 'visual');
      tapsRef.current = [];
      setTaps([]);
      return;
    }
    if (which === 'audio') {
      setAudioDeltas(deltas);
      setStep('visual');
      tapsRef.current = [];
      setTaps([]);
    } else {
      setVisualDeltas(deltas);
      setStep('result');
    }
  }

  function onTap(e: Event) {
    const s = stepRef.current;
    const clock = clockRef.current;
    if ((s !== 'audio' && s !== 'visual') || !clock) return;
    e.preventDefault();
    const t = clock.at(eventPerfTime(e as PointerEvent));
    const k = Math.round(t / BEAT_MS);
    if (k < COUNT_IN) return;
    const delta = t - k * BEAT_MS;
    if (Math.abs(delta) > 250) return;
    tapsRef.current.push(delta);
    setTaps(tapsRef.current.slice());
    if (ringRef.current && s === 'audio') {
      ringRef.current.animate?.([{ transform: 'scale(1.2)', opacity: 1 }, { transform: 'scale(1)', opacity: 0.4 }], { duration: 160 });
    }
    const need = s === 'audio' ? AUDIO_TAPS : VISUAL_TAPS;
    if (tapsRef.current.length >= need) finishStep(s);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') onTap(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = { audio: settings.audioOffsetMs, input: settings.inputOffsetMs, visual: settings.visualOffsetMs };
  const result = step === 'result' ? calibrate(audioDeltas, visualDeltas, current) : null;

  // Live check: a dot falls onto the line on every click, using the saved offsets.
  async function startPreview() {
    setPreview(true);
    const track = await startTrack(true, 400);
    if (!track) return;
    setPreview(true); // startTrack's stopAll() cleared it
    const { clock, schedule } = track;
    const loop = () => {
      const s = settingsStore.get();
      const raw = clock.update(performance.now());
      schedule();
      const t = renderTime(raw, { audio: s.audioOffsetMs, input: s.inputOffsetMs, visual: s.visualOffsetMs });
      const k = Math.ceil(t / BEAT_MS);
      const until = k * BEAT_MS - t; // ms until the next beat reaches the line
      if (dotRef.current) dotRef.current.style.transform = `translateY(${-Math.min(1, until / BEAT_MS) * 160}px)`;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  return (
    <div class="screen calibrate">
      <TopBar title="Sync check" backTo={{ name: 'settings' }} />
      {step === 'intro' && (
        <div class="cal-body">
          <Icon name="sync" size={44} />
          <h2>Line up the beat with your device</h2>
          <p>Every phone, speaker and pair of headphones adds a little delay. Two quick tests measure it so notes land exactly on the music.</p>
          <ol class="cal-steps">
            <li>
              <b>Listen & tap</b> — tap anywhere in time with {AUDIO_TAPS} clicks (after a 4-click count-in).
            </li>
            <li>
              <b>Watch & tap</b> — tap in time with a flashing ring, no sound.
            </li>
          </ol>
          <p class="row-hint">Use the headphones or speaker you normally play with. Current offsets: audio {current.audio} ms, input {current.input} ms.</p>
          <Button variant="primary" size="lg" icon="play" onClick={() => void begin('audio')}>
            Start
          </Button>
        </div>
      )}

      {(step === 'audio' || step === 'visual') && (
        <div class="cal-pad" onPointerDown={(e) => onTap(e)} role="button" aria-label="Tap here in time">
          <p class="cal-instruction">{step === 'audio' ? 'Tap with every click you hear' : 'Tap every time the ring flashes'}</p>
          <div class={`cal-ring ${step}`} ref={ringRef} />
          <div class="cal-progress">
            {Array.from({ length: step === 'audio' ? AUDIO_TAPS : VISUAL_TAPS }, (_, i) => (
              <i class={i < taps.length ? 'on' : ''} />
            ))}
          </div>
          {step === 'visual' && taps.length === 0 && !running && (
            <Button variant="primary" onClick={() => void begin('visual')}>
              Start part 2
            </Button>
          )}
          <p class="row-hint">{step === 'audio' ? 'The first four clicks are a count-in.' : 'Ignore the urge to anticipate — just react to the flash.'}</p>
        </div>
      )}

      {step === 'result' && result && (
        <div class="cal-body">
          <h2>Your device</h2>
          <div class="cal-results">
            <div>
              <b>{result.offsets.audio} ms</b>
              <span>audio offset</span>
            </div>
            <div>
              <b>{result.offsets.input} ms</b>
              <span>input offset</span>
            </div>
            <div>
              <b>{Math.round(result.consistency * 100)}%</b>
              <span>tap consistency</span>
            </div>
          </div>
          {result.consistency < 0.45 && <p class="row-hint">Your taps were a bit scattered — the result may be rough. You can run the test again.</p>}
          <div class="button-row">
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                updateSettings({ audioOffsetMs: result.offsets.audio, inputOffsetMs: result.offsets.input, calibrated: true });
                toast('Sync saved', 'success');
                void startPreview();
              }}
            >
              Save
            </Button>
            <Button icon="refresh" onClick={() => void begin('audio')}>
              Run again
            </Button>
          </div>
          <div class="cal-preview">
            <p>
              <b>Check it:</b> the dot should hit the line exactly on each click. Nudge the audio offset if it doesn't.
            </p>
            <div class="cal-lane">
              <div class="cal-dot" ref={dotRef} />
              <div class="cal-line" />
            </div>
            {preview ? (
              <Button size="sm" icon="stop" onClick={stopAll}>
                Stop
              </Button>
            ) : (
              <Button size="sm" icon="play" onClick={() => void startPreview()}>
                Play check
              </Button>
            )}
            <Stepper label="Audio offset" value={settings.audioOffsetMs} onChange={(v) => updateSettings({ audioOffsetMs: v, calibrated: true })} />
          </div>
          <Button variant="ghost" onClick={() => back({ name: 'settings' })}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
