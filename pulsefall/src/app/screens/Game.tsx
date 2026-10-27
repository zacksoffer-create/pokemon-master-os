import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../../core/audio/audioEngine';
import { STYLES } from '../../core/chart/styles';
import { TIMING_PROFILES, starLabel } from '../../core/engine/timing';
import { GameSession, type SessionResult } from '../../core/game/session';
import type { Insets } from '../../core/render/renderer';
import { library } from '../../core/storage/library';
import { APP_VERSION, type Chart, type PlayResult, type SongRecord } from '../../core/types';
import { formatScore } from '../../core/util';
import { keyLabels } from '../../core/input/inputController';
import { Icon } from '../components/Icon';
import { Button, Slider, Stars } from '../components/ui';
import { back, navigate } from '../router';
import { clearLaunch, loadSongBuffer, takeLaunch, type Launch } from '../state/launch';
import { settingsStore, updateSettings, useSettings } from '../state/settings';
import { toast } from '../state/toast';

export function readSafeInsets(): Insets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  probe.remove();
  return out;
}

type Phase =
  | { kind: 'loading'; text: string }
  | { kind: 'ready' }
  | { kind: 'playing' }
  | { kind: 'paused'; reason: string | null }
  | { kind: 'results'; result: SessionResult; record: PlayResult; isNewBest: boolean; previousBest: number | null }
  | { kind: 'error'; text: string };

interface Loaded {
  song: SongRecord;
  chart: Chart;
  buffer: AudioBuffer;
  visuals?: { energy: Float32Array; fps: number; beats: number[] };
  launch: Launch;
}

export function Game({ id }: { id: string }) {
  const settings = useSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const loadedRef = useRef<Loaded | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', text: 'Loading song…' });
  const [outro, setOutro] = useState(false);
  const [quickSettings, setQuickSettings] = useState(false);

  // Load everything, then start (audio was unlocked by the Play tap that brought us here).
  useEffect(() => {
    const launch = takeLaunch(id);
    if (!launch) {
      navigate({ name: 'song', id }, true);
      return;
    }
    let alive = true;
    (async () => {
      const song = await library.getSong(id);
      if (!song) throw new Error('Song not found.');
      const chart = launch.chart ?? (await library.getChart(launch.chartId));
      if (!chart) throw new Error('Chart not found.');
      setPhase({ kind: 'loading', text: song.isDemo ? 'Warming up the demo…' : 'Loading audio…' });
      const [buffer, analysis] = await Promise.all([loadSongBuffer(song), library.getAnalysis(song.id)]);
      if (!alive) return;
      loadedRef.current = {
        song,
        chart,
        buffer,
        launch,
        visuals: analysis ? { energy: analysis.energy, fps: analysis.fps, beats: analysis.beats } : undefined,
      };
      if (audio.running) start();
      else setPhase({ kind: 'ready' });
    })().catch((e: Error) => alive && setPhase({ kind: 'error', text: e.message }));
    return () => {
      alive = false;
      sessionRef.current?.destroy();
      sessionRef.current = null;
      clearLaunch();
    };
  }, [id]);

  useEffect(() => {
    const onResize = () => sessionRef.current?.resize(readSafeInsets());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  function start() {
    const L = loadedRef.current;
    if (!L || !canvasRef.current || !rootRef.current) return;
    sessionRef.current?.destroy();
    setOutro(false);
    const s = settingsStore.get();
    const session = new GameSession({
      canvas: canvasRef.current,
      inputEl: rootRef.current,
      audio,
      buffer: L.buffer,
      chart: L.chart,
      title: L.song.title,
      subtitle: `${L.song.artist} · ${STYLES[L.chart.style].label}`,
      settings: s,
      songOffsetMs: L.song.overrides?.offsetMs ?? 0,
      visuals: L.visuals,
      autoplay: L.launch.autoplay,
      startAtMs: L.launch.startAtMs,
      insets: readSafeInsets(),
      onPauseChange: (paused, reason) => setPhase(paused ? { kind: 'paused', reason } : { kind: 'playing' }),
      onOutro: () => setOutro(true),
      onFinish: (result) => void finish(result),
    });
    sessionRef.current = session;
    setPhase({ kind: 'playing' });
    session.start();
  }

  async function finish(result: SessionResult) {
    const L = loadedRef.current!;
    const s = settingsStore.get();
    const e = result.engine;
    const record: PlayResult = {
      songId: L.song.id,
      chartId: L.chart.id,
      style: L.chart.style,
      chartSource: L.chart.source,
      playedAt: Date.now(),
      score: e.score,
      accuracy: e.accuracy,
      maxCombo: e.maxCombo,
      counts: e.counts,
      totalJudgments: e.totalJudgments,
      fullCombo: e.fullCombo,
      allPerfect: e.allPerfect,
      stars: e.stars,
      meanErrorMs: e.meanErrorMs,
      timingProfile: s.timingProfile,
      offsets: { audio: s.audioOffsetMs, input: s.inputOffsetMs, visual: s.visualOffsetMs },
      appVersion: APP_VERSION,
      autoplay: !!L.launch.autoplay,
      completed: result.completed,
    };
    let isNewBest = false;
    let previousBest: number | null = null;
    // Practice runs (editor previews, partial starts) are not recorded.
    if (!L.launch.chart && !L.launch.startAtMs) {
      try {
        const r = await library.recordPlay(record);
        isNewBest = r.isNewBest;
        previousBest = r.previousBest?.score ?? null;
      } catch (err) {
        toast(`Couldn't save this score: ${(err as Error).message}`, 'error');
      }
    }
    if (!record.autoplay && settingsStore.get().sfxVolume > 0) audio.play('fanfare', { gain: 0.9 });
    setPhase({ kind: 'results', result, record, isNewBest, previousBest });
  }

  function exit() {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    const L = loadedRef.current;
    if (L?.launch.returnTo) navigate(L.launch.returnTo, true);
    else back({ name: 'song', id });
  }

  const keys = loadedRef.current ? keyLabels(loadedRef.current.chart.laneCount) : [];

  return (
    <div class="game" ref={rootRef}>
      <canvas ref={canvasRef} class="game-canvas" />
      {phase.kind === 'playing' && (
        <button class="pause-btn" aria-label="Pause" onPointerDown={(e) => e.stopPropagation()} onClick={() => sessionRef.current?.pause('user')}>
          <Icon name="pause" size={20} />
        </button>
      )}
      {phase.kind === 'playing' && outro && (
        <button class="outro-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => sessionRef.current?.skipOutro()}>
          Skip outro <Icon name="play" size={14} />
        </button>
      )}

      {phase.kind === 'loading' && (
        <div class="overlay">
          <div class="spinner" />
          <p>{phase.text}</p>
        </div>
      )}
      {phase.kind === 'error' && (
        <div class="overlay">
          <Icon name="warning" size={36} />
          <p>{phase.text}</p>
          <Button onClick={exit}>Back</Button>
        </div>
      )}
      {phase.kind === 'ready' && (
        <div
          class="overlay tap-start"
          onPointerDown={(e) => {
            e.stopPropagation();
            void audio.unlock();
            start();
          }}
        >
          <Icon name="play" size={48} />
          <p>Tap to start</p>
          <small>Tap the lanes as notes cross the line{keys.length ? ` · keys ${keys.join(' / ')}` : ''}</small>
        </div>
      )}
      {phase.kind === 'paused' && (
        <div class="overlay pause-menu" onPointerDown={(e) => e.stopPropagation()}>
          <h2>{phase.reason === 'user' ? 'Paused' : 'Paused — the song was interrupted'}</h2>
          <Button variant="primary" size="lg" icon="play" onClick={() => sessionRef.current?.resume()}>
            Resume
          </Button>
          <Button icon="refresh" onClick={() => start()}>
            Restart
          </Button>
          <Button icon="settings" onClick={() => setQuickSettings(!quickSettings)}>
            Sound & speed
          </Button>
          {quickSettings && (
            <div class="quick-settings">
              <Slider label="Music" value={Math.round(settings.musicVolume * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => updateSettings({ musicVolume: v / 100 })} />
              <Slider label="Hit sounds" value={Math.round(settings.sfxVolume * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => updateSettings({ sfxVolume: v / 100 })} />
              <p class="row-hint">Note speed and timing changes apply when you restart.</p>
              <Slider label="Note speed" value={settings.noteSpeed} min={1} max={10} onChange={(v) => updateSettings({ noteSpeed: v })} />
            </div>
          )}
          <Button variant="ghost" icon="back" onClick={exit}>
            Exit
          </Button>
        </div>
      )}
      {phase.kind === 'results' && (
        <Results
          phase={phase}
          song={loadedRef.current!.song}
          chart={loadedRef.current!.chart}
          practice={!!loadedRef.current!.launch.chart || !!loadedRef.current!.launch.startAtMs}
          onRetry={() => {
            if (loadedRef.current) loadedRef.current.launch = { ...loadedRef.current.launch, autoplay: false };
            void audio.unlock();
            start();
          }}
          onExit={exit}
        />
      )}
    </div>
  );
}

function CountUp({ value, ms = 1100 }: { value: number; ms?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const step = () => {
      const f = Math.min(1, (performance.now() - t0) / ms);
      setShown(Math.round(value * (1 - Math.pow(1 - f, 3))));
      if (f < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{formatScore(shown)}</>;
}

function Results({
  phase,
  song,
  chart,
  practice,
  onRetry,
  onExit,
}: {
  phase: Extract<Phase, { kind: 'results' }>;
  song: SongRecord;
  chart: Chart;
  practice: boolean;
  onRetry: () => void;
  onExit: () => void;
}) {
  const settings = useSettings();
  const { record: r, isNewBest, previousBest } = phase;
  const e = phase.result.engine;
  const total = Math.max(1, e.judged);
  const label = starLabel(r.stars, r.fullCombo, r.allPerfect);
  const hits = e.errors.length;
  const lean = Math.round(e.meanErrorMs);
  const showHint = !r.autoplay && hits >= 30 && Math.abs(lean) >= 22;
  const bars: [string, number, string][] = [
    ['Perfect', r.counts.perfect, 'perfect'],
    ['Great', r.counts.great, 'great'],
    ['Good', r.counts.good, 'good'],
    ['Miss', r.counts.miss, 'miss'],
  ];
  return (
    <div class="overlay results" onPointerDown={(ev) => ev.stopPropagation()}>
      {(r.fullCombo || isNewBest) && !r.autoplay && (
        <div class="confetti" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <i style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.12}s`, background: ['#22e6ff', '#a96bff', '#ff3fb4', '#ffd34d'][i % 4] }} />
          ))}
        </div>
      )}
      <p class="results-song">
        {song.title} · {STYLES[chart.style].label}
        {r.autoplay ? ' · autoplay' : practice ? ' · practice' : ''}
      </p>
      <h2 class={`results-label ${r.fullCombo ? 'gold' : ''}`}>{label}</h2>
      <Stars count={r.stars} size={30} />
      <div class="results-score">
        <CountUp value={r.score} />
      </div>
      {isNewBest && (
        <p class="new-best">
          <Icon name="sparkle" size={16} /> New personal best{previousBest !== null ? ` (+${formatScore(r.score - previousBest)})` : ''}
        </p>
      )}
      <div class="results-stats">
        <div>
          <b>{(r.accuracy * 100).toFixed(1)}%</b>
          <span>Accuracy</span>
        </div>
        <div>
          <b>{r.maxCombo}</b>
          <span>Max combo</span>
        </div>
        <div>
          <b>
            {e.judged - r.counts.miss}/{e.judged}
          </b>
          <span>Notes hit</span>
        </div>
      </div>
      <div class="judgment-bars">
        {bars.map(([name, n, cls]) => (
          <div class={`jbar ${cls}`}>
            <span>{name}</span>
            <i style={{ width: `${(n / total) * 100}%` }} />
            <b>{n}</b>
          </div>
        ))}
      </div>
      {showHint && (
        <div class="timing-hint">
          <p>
            Your hits landed about <b>{Math.abs(lean)} ms {lean > 0 ? 'late' : 'early'}</b> on average.
            {settings.timingProfile !== 'strict' ? ' That still scores fine, but a small adjustment can make it feel tighter.' : ''}
          </p>
          <Button
            size="sm"
            onClick={() => {
              updateSettings({ inputOffsetMs: settings.inputOffsetMs + lean });
              toast(`Input timing adjusted by ${lean > 0 ? '+' : ''}${lean} ms`, 'success');
            }}
          >
            Adjust input timing
          </Button>
        </div>
      )}
      <p class="results-foot">
        {TIMING_PROFILES[r.timingProfile].label} timing · {chart.source === 'auto' ? 'auto chart' : chart.source === 'authored' ? 'showcase chart' : 'your edit'}
      </p>
      <div class="results-actions">
        <Button variant="primary" size="lg" icon="refresh" onClick={onRetry}>
          Play again
        </Button>
        <Button icon="back" onClick={onExit}>
          Done
        </Button>
      </div>
    </div>
  );
}
