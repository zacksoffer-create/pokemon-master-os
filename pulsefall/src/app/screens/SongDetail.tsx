import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { audio } from '../../core/audio/audioEngine';
import { SongPlayer } from '../../core/audio/songPlayer';
import { STYLES } from '../../core/chart/styles';
import { DEMO_ID, ensureDemo } from '../../core/demo/demoSetup';
import { regenerateCharts } from '../../core/import/importer';
import { library } from '../../core/storage/library';
import { CHART_STYLES, type Chart, type ChartOverrides, type ChartStyle, type PatternStyle, type SongRecord } from '../../core/types';
import { formatDuration, formatScore } from '../../core/util';
import { Cover } from '../components/Art';
import { Icon } from '../components/Icon';
import { Button, IconButton, LevelMeter, MenuItem, Segmented, Sheet, Slider, Stars, TopBar, confirmDialog } from '../components/ui';
import { navigate } from '../router';
import { pickFiles } from '../state/importManager';
import { AudioMissingError, forgetBuffer, loadSongBuffer, setLaunch } from '../state/launch';
import { useCharts, useResults, useSong } from '../state/libraryHooks';
import { settingsStore, uiSound, updateSettings, useSettings } from '../state/settings';
import { toast } from '../state/toast';

type Variant = 'auto' | 'custom';

export function pickChart(charts: Chart[], style: ChartStyle, variant: Variant): Chart | undefined {
  const auto = charts.find((c) => c.style === style && c.source === 'auto');
  const custom = charts.find((c) => c.style === style && c.source !== 'auto');
  return variant === 'custom' ? custom ?? auto : auto ?? custom;
}

export function SongDetail({ id }: { id: string }) {
  const settings = useSettings();
  const { data: song, loading } = useSong(id);
  const { data: charts } = useCharts(id);
  const { data: results } = useResults(id, 6);
  const [style, setStyle] = useState<ChartStyle>(settings.lastStyle);
  const [variant, setVariant] = useState<Variant>('custom');
  const [preparing, setPreparing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const preview = useRef<{ player: SongPlayer; timer: number } | null>(null);

  // The demo is generated on first visit (and after app updates change the generator).
  useEffect(() => {
    if (id !== DEMO_ID) return;
    let alive = true;
    setPreparing(true);
    ensureDemo(settingsStore.get())
      .catch((e: Error) => toast(`Demo setup failed: ${e.message}`, 'error'))
      .finally(() => alive && setPreparing(false));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => () => stopPreview(), []);

  const chart = useMemo(() => pickChart(charts, style, variant), [charts, style, variant]);
  const hasCustom = charts.some((c) => c.style === style && c.source !== 'auto');

  function stopPreview() {
    const p = preview.current;
    if (!p) return;
    clearTimeout(p.timer);
    p.player.fadeOut(350);
    preview.current = null;
    setPreviewing(false);
  }

  async function togglePreview(s: SongRecord) {
    if (preview.current) return stopPreview();
    void audio.unlock();
    setPreviewing(true);
    try {
      const buffer = await loadSongBuffer(s);
      const player = new SongPlayer(audio, buffer);
      const start = Math.min(s.previewStartMs, Math.max(0, buffer.duration * 1000 - 15000));
      player.play(start, 0, 600);
      const timer = window.setTimeout(() => stopPreview(), 15000);
      preview.current = { player, timer };
    } catch (e) {
      setPreviewing(false);
      toast(e instanceof AudioMissingError ? e.message : `Couldn't play this file: ${(e as Error).message}`, 'error');
    }
  }

  function play(s: SongRecord, c: Chart, autoplay = false) {
    stopPreview();
    // Unlock audio inside this tap: iOS only allows it during a user gesture.
    void audio.unlock();
    updateSettings({ lastStyle: c.style });
    setLaunch({ songId: s.id, chartId: c.id, autoplay });
    navigate({ name: 'play', id: s.id });
  }

  async function regenerate(s: SongRecord) {
    setBusy('Rebuilding charts…');
    try {
      const { errors } = await regenerateCharts(s, settingsStore.get());
      toast(errors.length ? `Charts rebuilt (${errors.length} style${errors.length > 1 ? 's' : ''} skipped)` : 'Charts rebuilt', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: SongRecord) {
    const ok = await confirmDialog({
      title: `Delete “${s.title}”?`,
      body: 'This removes the song, its charts (including edits) and its scores from this device. Your original file is not affected.',
      confirm: 'Delete',
      danger: true,
    });
    if (!ok) return;
    stopPreview();
    forgetBuffer(s.id);
    await library.deleteSong(s.id);
    toast('Song deleted');
    navigate({ name: 'library' }, true);
  }

  if (loading && !song) return <div class="screen center"><div class="spinner" /></div>;
  if (!song) {
    if (preparing) return <div class="screen center"><div class="spinner" /><p>Preparing the demo…</p></div>;
    return (
      <div class="screen">
        <TopBar title="Song" backTo={{ name: 'library' }} />
        <div class="empty">
          <p>This song isn't in your library.</p>
          <Button onClick={() => navigate({ name: 'library' })}>Go to library</Button>
        </div>
      </div>
    );
  }

  const summary = song.analysisSummary;
  const best = song.best[style];
  const missingAudio = !song.hasAudio && !song.isDemo;

  return (
    <div class="screen detail">
      <TopBar
        title=""
        backTo={{ name: 'library' }}
        right={
          <>
            <IconButton
              icon={song.favorite ? 'heartFill' : 'heart'}
              label={song.favorite ? 'Unfavorite' : 'Favorite'}
              active={song.favorite}
              onClick={() => void library.updateSong(song.id, { favorite: !song.favorite })}
            />
            <IconButton icon="more" label="More" onClick={() => setMenu(true)} />
          </>
        }
      />
      <div class="detail-head">
        <Cover song={song} class="detail-cover" />
        <div class="detail-meta">
          <h1>{song.title}</h1>
          <p class="artist">{song.artist}</p>
          {song.album && <p class="album">{song.album}{song.year ? ` · ${song.year}` : ''}</p>}
          <p class="facts">
            <span>{formatDuration(song.durationMs)}</span>
            {summary && <span>{Math.round(summary.bpm)} BPM</span>}
            {summary && summary.beatsPerBar === 3 && <span>3/4</span>}
            {summary?.subdivision === 'ternary' && <span>swing</span>}
            {summary && <span>{summary.sections} sections</span>}
          </p>
          {summary?.approximate && (
            <p class="badge-approx">
              <Icon name="info" size={14} /> Loose tempo — notes follow the hits rather than a strict grid.
            </p>
          )}
        </div>
      </div>

      {missingAudio && (
        <div class="notice">
          <Icon name="warning" />
          <span>
            <b>Audio not on this device.</b> Your charts and scores are safe — re-import the same file to play again.
          </span>
          <Button size="sm" variant="primary" onClick={() => pickFiles()}>
            Re-import
          </Button>
        </div>
      )}

      <div class="styles" role="radiogroup" aria-label="Chart style">
        {CHART_STYLES.map((st) => {
          const c = pickChart(charts, st, variant);
          const b = song.best[st];
          return (
            <button
              role="radio"
              aria-checked={st === style}
              class={`style-card ${st === style ? 'on' : ''} ${c ? '' : 'disabled'}`}
              onClick={() => {
                uiSound();
                setStyle(st);
              }}
            >
              <span class="style-name">{STYLES[st].label}</span>
              {c ? <LevelMeter level={c.stats.level} /> : <span class="style-missing">{preparing ? '…' : 'n/a'}</span>}
              <span class="style-sub">{b ? <Stars count={b.stars} size={11} /> : c ? `${c.stats.noteCount} notes` : ''}</span>
            </button>
          );
        })}
      </div>

      <div class="style-info">
        <p>{STYLES[style].tagline}</p>
        {hasCustom && (
          <Segmented<Variant>
            label="Chart version"
            value={variant}
            onChange={setVariant}
            options={[
              { value: 'custom', label: charts.find((c) => c.style === style && c.source === 'authored') ? 'Showcase' : 'My edit' },
              { value: 'auto', label: 'Auto' },
            ]}
          />
        )}
      </div>

      <div class="detail-play">
        <Button variant="primary" size="lg" icon="play" class="play-cta" disabled={!chart || missingAudio || preparing} onClick={() => chart && play(song, chart)}>
          {preparing ? 'Preparing…' : 'Play'}
        </Button>
        <Button icon={previewing ? 'stop' : 'volume'} disabled={missingAudio} onClick={() => void togglePreview(song)} label="Preview">
          {previewing ? 'Stop' : 'Preview'}
        </Button>
      </div>

      {chart && (
        <div class="chart-facts">
          <span>
            <b>{chart.stats.noteCount}</b> notes
          </span>
          <span>
            <b>{chart.stats.holds}</b> holds
          </span>
          <span>
            <b>{chart.stats.chords}</b> doubles
          </span>
          <span>
            <b>{chart.stats.swipes}</b> swipes
          </span>
          <span>
            <b>{chart.laneCount}</b> lanes
          </span>
        </div>
      )}

      {best && (
        <div class="best">
          <span class="best-label">Personal best</span>
          <span class="best-score">{formatScore(best.score)}</span>
          <span>{(best.accuracy * 100).toFixed(1)}%</span>
          <span>{best.maxCombo} max combo</span>
          {best.allPerfect ? <span class="tag gold">Flawless</span> : best.fullCombo ? <span class="tag gold">Full Combo</span> : null}
        </div>
      )}

      {results.length > 0 && (
        <section class="results-list">
          <h2>Recent plays</h2>
          {results.map((r) => (
            <div class="result-row">
              <span class="result-style">{STYLES[r.style].label}</span>
              <span class="result-score">{formatScore(r.score)}</span>
              <span>{(r.accuracy * 100).toFixed(1)}%</span>
              <Stars count={r.stars} size={10} />
              {r.autoplay && <span class="tag">auto</span>}
            </div>
          ))}
        </section>
      )}

      {busy && (
        <div class="busy-overlay">
          <div class="spinner" />
          <p>{busy}</p>
        </div>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={song.title}>
        {chart && (
          <MenuItem
            icon="edit"
            label="Edit chart"
            hint="Move, add or remove notes; your edit is saved separately"
            onClick={() => {
              setMenu(false);
              stopPreview();
              navigate({ name: 'edit', id: song.id, style });
            }}
          />
        )}
        {chart && !missingAudio && (
          <MenuItem
            icon="robot"
            label="Watch autoplay"
            hint="See the chart played perfectly"
            onClick={() => {
              setMenu(false);
              play(song, chart, true);
            }}
          />
        )}
        <MenuItem
          icon="sparkle"
          label="Chart options"
          hint="Density, lanes, pattern style, tempo fixes"
          onClick={() => {
            setMenu(false);
            setOptionsOpen(true);
          }}
        />
        {!song.isDemo && (
          <MenuItem
            icon="refresh"
            label="Rebuild auto charts"
            hint="Your edited charts are kept"
            onClick={() => {
              setMenu(false);
              void regenerate(song);
            }}
          />
        )}
        {!song.isDemo && (
          <MenuItem
            icon="edit"
            label="Edit song info"
            onClick={() => {
              setMenu(false);
              setInfoOpen(true);
            }}
          />
        )}
        {!song.isDemo && (
          <MenuItem
            icon="upload"
            label={missingAudio ? 'Re-import audio file' : 'Replace audio file'}
            hint="Choose the same file to relink it"
            onClick={() => {
              setMenu(false);
              pickFiles();
            }}
          />
        )}
        {!song.isDemo && (
          <MenuItem
            icon="trash"
            label="Delete song"
            danger
            onClick={() => {
              setMenu(false);
              void remove(song);
            }}
          />
        )}
      </Sheet>

      <ChartOptions
        open={optionsOpen}
        song={song}
        onClose={() => setOptionsOpen(false)}
        onApply={async (ov) => {
          setOptionsOpen(false);
          const next = await library.updateSong(song.id, { overrides: ov });
          if (next) {
            if (next.isDemo) {
              setBusy('Rebuilding charts…');
              await library.updateSong(song.id, { analysisVersion: '' });
              await ensureDemo(settingsStore.get()).finally(() => setBusy(null));
            } else await regenerate(next);
          }
        }}
      />
      <SongInfo open={infoOpen} song={song} onClose={() => setInfoOpen(false)} />
    </div>
  );
}

function ChartOptions({ open, song, onClose, onApply }: { open: boolean; song: SongRecord; onClose: () => void; onApply: (o: ChartOverrides) => void }) {
  const [ov, setOv] = useState<ChartOverrides>(song.overrides ?? {});
  const [bpmText, setBpmText] = useState(song.overrides?.bpm ? String(song.overrides.bpm) : '');
  const [firstText, setFirstText] = useState(song.overrides?.firstBeatMs !== undefined ? String(song.overrides.firstBeatMs) : '');
  useEffect(() => {
    if (open) {
      setOv(song.overrides ?? {});
      setBpmText(song.overrides?.bpm ? String(song.overrides.bpm) : '');
      setFirstText(song.overrides?.firstBeatMs !== undefined ? String(song.overrides.firstBeatMs) : '');
    }
  }, [open, song.id]);
  const detected = song.analysisSummary?.bpm;
  return (
    <Sheet open={open} onClose={onClose} title="Chart options">
      <Slider
        label="Note density"
        value={ov.densityAdjust ?? 0}
        min={-2}
        max={2}
        step={1}
        format={(v) => ['Much less', 'Less', 'Normal', 'More', 'Much more'][v + 2]}
        onChange={(v) => setOv({ ...ov, densityAdjust: v })}
      />
      <div class="row">
        <span class="row-text">
          <span class="row-label">Pattern style</span>
          <span class="row-hint">Flow follows the music; Alternate favours left–right; Melodic follows pitch more closely.</span>
        </span>
      </div>
      <Segmented<PatternStyle>
        value={ov.patternStyle ?? 'flow'}
        onChange={(v) => setOv({ ...ov, patternStyle: v })}
        options={[
          { value: 'flow', label: 'Flow' },
          { value: 'alternate', label: 'Alternate' },
          { value: 'melodic', label: 'Melodic' },
        ]}
      />
      <div class="row">
        <span class="row-text">
          <span class="row-label">Lanes</span>
          <span class="row-hint">Applies to every style of this song.</span>
        </span>
        <Segmented<number>
          value={ov.laneCount ?? 0}
          onChange={(v) => setOv({ ...ov, laneCount: v || undefined })}
          options={[
            { value: 0, label: 'Default' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
          ]}
        />
      </div>
      <div class="row">
        <span class="row-text">
          <span class="row-label">Variation</span>
          <span class="row-hint">Same rhythm, different lane patterns.</span>
        </span>
        <div class="stepper">
          <button onClick={() => setOv({ ...ov, variation: Math.max(0, (ov.variation ?? 0) - 1) })}>−</button>
          <output>{ov.variation ?? 0}</output>
          <button onClick={() => setOv({ ...ov, variation: (ov.variation ?? 0) + 1 })}>+</button>
        </div>
      </div>
      <details class="advanced">
        <summary>Tempo fix (advanced)</summary>
        <p class="row-hint">Only if the beat grid is wrong. Detected: {detected ? `${detected} BPM` : 'unknown'}. Leave empty for automatic.</p>
        <div class="field-row">
          <label>
            BPM
            <input inputMode="decimal" value={bpmText} placeholder={detected ? String(detected) : 'auto'} onInput={(e) => setBpmText((e.target as HTMLInputElement).value)} />
          </label>
          <label>
            First beat (ms)
            <input inputMode="numeric" value={firstText} placeholder="auto" onInput={(e) => setFirstText((e.target as HTMLInputElement).value)} />
          </label>
        </div>
        {detected && (
          <div class="field-row">
            <Button size="sm" onClick={() => setBpmText(String(Math.round(detected * 2 * 10) / 10))}>
              Double ({Math.round(detected * 2)})
            </Button>
            <Button size="sm" onClick={() => setBpmText(String(Math.round((detected / 2) * 10) / 10))}>
              Half ({Math.round(detected / 2)})
            </Button>
          </div>
        )}
      </details>
      <Slider
        label="Song timing offset"
        hint="Shifts every chart of this song. Positive = notes later."
        value={ov.offsetMs ?? 0}
        min={-200}
        max={200}
        step={5}
        format={(v) => `${v > 0 ? '+' : ''}${v} ms`}
        onChange={(v) => setOv({ ...ov, offsetMs: v })}
      />
      <div class="sheet-actions">
        <Button
          variant="ghost"
          onClick={() => {
            setOv({});
            setBpmText('');
            setFirstText('');
          }}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            const bpm = parseFloat(bpmText);
            const first = parseFloat(firstText);
            onApply({
              ...ov,
              bpm: isFinite(bpm) && bpm >= 40 && bpm <= 300 ? bpm : undefined,
              firstBeatMs: isFinite(first) && first >= 0 ? first : undefined,
            });
          }}
        >
          Apply & rebuild
        </Button>
      </div>
    </Sheet>
  );
}

function SongInfo({ open, song, onClose }: { open: boolean; song: SongRecord; onClose: () => void }) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [album, setAlbum] = useState(song.album ?? '');
  useEffect(() => {
    if (open) {
      setTitle(song.title);
      setArtist(song.artist);
      setAlbum(song.album ?? '');
    }
  }, [open, song.id]);
  return (
    <Sheet open={open} onClose={onClose} title="Song info">
      <form
        class="form"
        onSubmit={async (e) => {
          e.preventDefault();
          await library.updateSong(song.id, { title: title.trim() || song.title, artist: artist.trim() || song.artist, album: album.trim() || undefined, metadataEdited: true });
          toast('Saved', 'success');
          onClose();
        }}
      >
        <label>
          Title
          <input value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        </label>
        <label>
          Artist
          <input value={artist} onInput={(e) => setArtist((e.target as HTMLInputElement).value)} />
        </label>
        <label>
          Album
          <input value={album} onInput={(e) => setAlbum((e.target as HTMLInputElement).value)} />
        </label>
        <p class="row-hint">
          File: {song.fileName} · {(song.fileSize / 1048576).toFixed(1)} MB · imported {new Date(song.importedAt).toLocaleDateString()}
        </p>
        <div class="sheet-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
