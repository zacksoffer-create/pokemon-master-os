import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { gridFromTempo } from '../../core/analysis/beats';
import { audio } from '../../core/audio/audioEngine';
import { SongPlayer } from '../../core/audio/songPlayer';
import { chartStats } from '../../core/chart/stats';
import { STYLES } from '../../core/chart/styles';
import { validateChart } from '../../core/chart/validate';
import { chartId, library } from '../../core/storage/library';
import { CHART_STYLES, GENERATOR_VERSION, type AnalysisResult, type Chart, type ChartStyle, type Note, type NoteType, type SongRecord } from '../../core/types';
import { lowerBound } from '../../core/util';
import { Grid, History, addNote, cycleSwipeDir, moveNotes, removeNotes, setHoldEnd, setType, type Snap } from '../editor/editorModel';
import { EditorView, type ViewState } from '../editor/editorView';
import { Icon } from '../components/Icon';
import { Button, IconButton, MenuItem, Segmented, Sheet, Stepper, TopBar, confirmDialog } from '../components/ui';
import { back, navigate } from '../router';
import { loadSongBuffer, setLaunch } from '../state/launch';
import { settingsStore } from '../state/settings';
import { toast } from '../state/toast';
import { downloadJson, pickJson } from './Settings';

type Tool = 'select' | 'tap' | 'hold' | 'swipe';

interface Draft {
  notes: Note[];
  offsetMs: number;
  t: number;
}
/** Unsaved work survives a trip to the game screen for a preview. */
const drafts = new Map<string, Draft>();

interface Loaded {
  song: SongRecord;
  analysis: AnalysisResult | null;
  base: Chart;
  hasCustom: boolean;
}

export function Editor({ id, style: styleParam }: { id: string; style: string }) {
  const style = (CHART_STYLES.includes(styleParam as ChartStyle) ? styleParam : 'classic') as ChartStyle;
  const key = `${id}:${style}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotesState] = useState<Note[]>([]);
  const [offsetMs, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tool, setTool] = useState<Tool>('tap');
  const [snap, setSnap] = useState<Snap>(4);
  const [zoom, setZoom] = useState(0.22);
  const [dirty, setDirty] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [menu, setMenu] = useState(false);
  const [, force] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const tRef = useRef(0);
  const history = useRef(new History<{ notes: Note[]; offsetMs: number }>());
  const playerRef = useRef<SongPlayer | null>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({ notes, selected, snap, zoom, playing, offset: offsetMs, ghost: null as ViewState['ghost'] });
  stateRef.current = { ...stateRef.current, notes, selected, snap, zoom, playing, offset: offsetMs };

  // Load song, analysis and the chart to start from (your edit if there is one).
  useEffect(() => {
    let alive = true;
    (async () => {
      const song = await library.getSong(id);
      if (!song) throw new Error('Song not found.');
      const [charts, analysis] = await Promise.all([library.getCharts(id), library.getAnalysis(id)]);
      const custom = charts.find((c) => c.style === style && c.source !== 'auto');
      const auto = charts.find((c) => c.style === style && c.source === 'auto');
      const base = custom ?? auto;
      if (!base) throw new Error('There is no chart for this style yet.');
      if (!alive) return;
      const draft = drafts.get(key);
      setLoaded({ song, analysis, base, hasCustom: !!custom });
      setNotesState(draft?.notes ?? base.notes);
      setOffset(draft?.offsetMs ?? base.offsetMs ?? 0);
      tRef.current = draft?.t ?? Math.max(0, (base.notes[0]?.t ?? 0) - 1000);
      setDirty(!!draft);
    })().catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
      stopPlayback();
    };
  }, [id, style]);

  const grid = useMemo(() => {
    if (!loaded) return new Grid([], 4, 0);
    const a = loaded.analysis;
    const ov = loaded.song.overrides;
    const dur = loaded.song.durationMs;
    if (ov?.bpm) return new Grid(gridFromTempo(ov.bpm, ov.firstBeatMs ?? a?.beats[0] ?? 0, dur), a?.meter.beatsPerBar ?? 4, 0);
    if (a && a.beats.length >= 8) return new Grid(a.beats, a.meter.beatsPerBar, a.meter.firstDownbeat);
    const bpm = a?.tempo.bpm ?? 120;
    return new Grid(gridFromTempo(bpm, a?.onsets[0]?.t ?? 0, dur), 4, 0);
  }, [loaded]);

  // View setup and redraw loop.
  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const v = new EditorView(canvasRef.current, loaded.analysis?.peaks ?? null, loaded.analysis?.fps ?? 100, grid, settingsStore.get().theme, loaded.base.laneCount);
    viewRef.current = v;
    v.resize(loaded.base.laneCount);
    const onResize = () => {
      v.resize(loaded.base.laneCount);
      redraw();
    };
    window.addEventListener('resize', onResize);
    redraw();
    return () => window.removeEventListener('resize', onResize);
  }, [loaded, grid]);

  useEffect(() => redraw(), [notes, selected, snap, zoom, playing, offsetMs]);

  /** Audio time on screen -> chart time, snapped so the note *sounds* on the grid. */
  function toChart(audioT: number): number {
    return grid.snap(audioT, snap) - offsetMs;
  }

  function redraw() {
    const v = viewRef.current;
    if (!v || !loaded) return;
    const s = stateRef.current;
    v.draw({ t: tRef.current, zoom: s.zoom, notes: s.notes, selected: s.selected, snap: s.snap, laneCount: loaded.base.laneCount, playing: s.playing, ghost: s.ghost, offset: s.offset });
  }

  function commit(next: Note[], nextOffset = offsetMs) {
    history.current.push({ notes, offsetMs });
    setNotesState(next);
    setOffset(nextOffset);
    setDirty(true);
    drafts.set(key, { notes: next, offsetMs: nextOffset, t: tRef.current });
  }

  function undo() {
    const prev = history.current.undo({ notes, offsetMs });
    if (prev) {
      setNotesState(prev.notes);
      setOffset(prev.offsetMs);
      setDirty(true);
    }
  }
  function redo() {
    const next = history.current.redo({ notes, offsetMs });
    if (next) {
      setNotesState(next.notes);
      setOffset(next.offsetMs);
      setDirty(true);
    }
  }

  // --- playback ---------------------------------------------------------------
  async function togglePlay() {
    if (playerRef.current) return stopPlayback();
    if (!loaded) return;
    void audio.unlock();
    try {
      const buffer = await loadSongBuffer(loaded.song);
      const p = new SongPlayer(audio, buffer);
      playerRef.current = p;
      const start = Math.max(0, tRef.current);
      p.play(start);
      setPlaying(true);
      let last = start;
      const loop = () => {
        if (!playerRef.current) return;
        const t = p.tick(performance.now());
        tRef.current = t;
        // Click on every note that just crossed the playhead (chart timing check by ear).
        const ns = stateRef.current.notes;
        for (let i = lowerBound(ns.map((n) => n.t + offsetMs), last); i < ns.length && ns[i].t + offsetMs <= t; i++) {
          if (ns[i].t + offsetMs > last) audio.play('tick', { gain: 0.9 });
        }
        last = t;
        redraw();
        if (t > p.durationMs) return stopPlayback();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  function stopPlayback() {
    cancelAnimationFrame(rafRef.current);
    playerRef.current?.stop();
    playerRef.current = null;
    setPlaying(false);
  }

  // --- pointer editing ----------------------------------------------------------
  const drag = useRef<
    | { mode: 'scroll'; y0: number; t0: number; moved: boolean; placeLane?: number; placeT?: number }
    | { mode: 'move'; id: number; x0: number; y0: number; startT: number; startLane: number; moved: boolean; base: Note[] }
    | { mode: 'tail'; id: number; base: Note[] }
    | { mode: 'hold'; lane: number; t: number }
    | null
  >(null);

  function local(e: PointerEvent): { x: number; y: number } {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function viewState(): ViewState {
    const s = stateRef.current;
    return { t: tRef.current, zoom: s.zoom, notes: s.notes, selected: s.selected, snap: s.snap, laneCount: loaded!.base.laneCount, playing: s.playing, offset: s.offset };
  }

  function onPointerDown(e: PointerEvent) {
    const v = viewRef.current;
    if (!v || !loaded) return;
    canvasRef.current!.setPointerCapture(e.pointerId);
    const { x, y } = local(e);
    const hit = v.hitTest(x, y, viewState());
    if (hit.kind === 'tail') {
      drag.current = { mode: 'tail', id: hit.note.id, base: notes };
      setSelected(new Set([hit.note.id]));
      return;
    }
    if (hit.kind === 'note') {
      const next = new Set(e.shiftKey ? selected : []);
      if (e.shiftKey && next.has(hit.note.id)) next.delete(hit.note.id);
      else next.add(hit.note.id);
      setSelected(next);
      drag.current = { mode: 'move', id: hit.note.id, x0: x, y0: y, startT: hit.note.t, startLane: hit.note.lane, moved: false, base: notes };
      return;
    }
    if (hit.kind === 'lane' && tool === 'hold') {
      const t = toChart(hit.t);
      drag.current = { mode: 'hold', lane: hit.lane, t };
      stateRef.current.ghost = { t, lane: hit.lane, end: t + 300, type: 'hold' };
      redraw();
      return;
    }
    drag.current = {
      mode: 'scroll',
      y0: y,
      t0: tRef.current,
      moved: false,
      placeLane: hit.kind === 'lane' && tool !== 'select' ? hit.lane : undefined,
      placeT: hit.kind === 'lane' ? hit.t : undefined,
    };
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag.current;
    const v = viewRef.current;
    if (!d || !v || !loaded) return;
    const { x, y } = local(e);
    if (d.mode === 'scroll') {
      if (Math.abs(y - d.y0) > 6) d.moved = true;
      if (d.moved && !playerRef.current) {
        tRef.current = Math.max(-2000, d.t0 + (y - d.y0) / zoom);
        redraw();
      }
    } else if (d.mode === 'move') {
      const vs = viewState();
      const tNow = grid.snap(v.timeAtY(y, vs), snap);
      const tStart = grid.snap(v.timeAtY(d.y0, vs), snap);
      const dLane = v.laneAtX(x, loaded.base.laneCount) - v.laneAtX(d.x0, loaded.base.laneCount);
      if (Math.abs(y - d.y0) > 4 || dLane !== 0) d.moved = true;
      if (!d.moved) return;
      const ids = selected.has(d.id) ? selected : new Set([d.id]);
      stateRef.current.notes = moveNotes(d.base, ids, tNow - tStart, dLane, loaded.base.laneCount);
      redraw();
    } else if (d.mode === 'tail') {
      const end = toChart(v.timeAtY(y, viewState()));
      stateRef.current.notes = setHoldEnd(d.base, d.id, end);
      redraw();
    } else if (d.mode === 'hold') {
      const end = toChart(v.timeAtY(y, viewState()));
      stateRef.current.ghost = { t: d.t, lane: d.lane, end: Math.max(d.t + 150, end), type: 'hold' };
      redraw();
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || !loaded) return;
    if (d.mode === 'scroll') {
      if (!d.moved && d.placeLane !== undefined && d.placeT !== undefined) {
        const t = toChart(d.placeT);
        if (t < 0 || t > loaded.song.durationMs) return;
        const type: NoteType = tool === 'swipe' ? 'swipe' : 'tap';
        const { notes: next, id: nid } = addNote(notes, t, d.placeLane, type);
        commit(next);
        setSelected(new Set([nid]));
        audio.play('tick', { gain: 0.6 });
      } else if (!d.moved) setSelected(new Set());
      drafts.set(key, { notes, offsetMs, t: tRef.current });
    } else if (d.mode === 'move' || d.mode === 'tail') {
      if (stateRef.current.notes !== d.base) commit(stateRef.current.notes);
    } else if (d.mode === 'hold') {
      const g = stateRef.current.ghost;
      stateRef.current.ghost = null;
      if (g && g.end !== undefined) {
        const { notes: next, id: nid } = addNote(notes, g.t, g.lane, 'hold', g.end);
        commit(next);
        setSelected(new Set([nid]));
      }
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setZoom((z) => Math.max(0.05, Math.min(1.2, z * (e.deltaY > 0 ? 0.9 : 1.1))));
      return;
    }
    if (playerRef.current) return;
    tRef.current = Math.max(-2000, tRef.current + e.deltaY / zoom / 2);
    redraw();
  }

  // --- keyboard -------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === 'Space') {
        e.preventDefault();
        void togglePlay();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) {
        e.preventDefault();
        commit(removeNotes(notes, selected));
        setSelected(new Set());
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (/^Digit[1-4]$/.test(e.code) && loaded) {
        const lane = Number(e.code.slice(5)) - 1;
        if (lane < loaded.base.laneCount) {
          const t = toChart(tRef.current);
          commit(addNote(notes, t, lane, tool === 'swipe' ? 'swipe' : 'tap').notes);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? 2000 : 250;
        tRef.current += e.key === 'ArrowUp' ? step : -step;
        redraw();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- actions -----------------------------------------------------------------
  function buildChart(): Chart | null {
    if (!loaded) return null;
    const report = validateChart(notes, { laneCount: loaded.base.laneCount, durationMs: loaded.song.durationMs, sameLaneGapMs: 60 });
    const now = Date.now();
    return {
      ...loaded.base,
      id: chartId(loaded.song.id, style, 'custom'),
      source: loaded.base.source === 'authored' ? 'authored' : 'edited',
      notes: report.notes,
      offsetMs,
      generatorVersion: GENERATOR_VERSION,
      updatedAt: now,
      createdAt: loaded.hasCustom ? loaded.base.createdAt : now,
      validation: { ok: report.ok, fixes: report.fixes.length, warnings: report.warnings },
      stats: chartStats(report.notes, loaded.song.durationMs),
    };
  }

  async function save() {
    const c = buildChart();
    if (!c || !loaded) return;
    try {
      await library.saveCustomChart(c);
      setNotesState(c.notes);
      setDirty(false);
      drafts.delete(key);
      setLoaded({ ...loaded, base: c, hasCustom: true });
      toast(c.validation.fixes ? `Saved (${c.validation.fixes} small fixes applied)` : 'Chart saved', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  function preview() {
    const c = buildChart();
    if (!c || !loaded) return;
    stopPlayback();
    drafts.set(key, { notes, offsetMs, t: tRef.current });
    void audio.unlock();
    setLaunch({ songId: loaded.song.id, chartId: c.id, chart: c, startAtMs: Math.max(0, tRef.current), returnTo: { name: 'edit', id: loaded.song.id, style } });
    navigate({ name: 'play', id: loaded.song.id });
  }

  async function leave() {
    if (dirty && !(await confirmDialog({ title: 'Leave without saving?', body: 'Your unsaved changes to this chart will be lost.', confirm: 'Discard', danger: true }))) return;
    drafts.delete(key);
    stopPlayback();
    back({ name: 'song', id });
  }

  async function restoreAuto() {
    setMenu(false);
    if (!loaded) return;
    const ok = await confirmDialog({ title: 'Restore the automatic chart?', body: 'Your edited version of this style will be deleted.', confirm: 'Restore', danger: true });
    if (!ok) return;
    await library.deleteChart(chartId(loaded.song.id, style, 'custom'));
    const auto = (await library.getCharts(id)).find((c) => c.style === style && c.source === 'auto');
    drafts.delete(key);
    if (auto) {
      setLoaded({ ...loaded, base: auto, hasCustom: false });
      setNotesState(auto.notes);
      setOffset(0);
      setDirty(false);
    }
    toast('Automatic chart restored');
  }

  function exportChart() {
    setMenu(false);
    if (!loaded) return;
    const c = buildChart()!;
    downloadJson(`${loaded.song.title.replace(/[^\w\- ]+/g, '').trim() || 'chart'}-${style}.pulsefall-chart.json`, {
      format: 'pulsefall-chart',
      version: 1,
      title: loaded.song.title,
      artist: loaded.song.artist,
      fingerprint: loaded.song.fingerprint,
      style,
      laneCount: c.laneCount,
      offsetMs: c.offsetMs,
      notes: c.notes,
    });
  }

  async function importChart() {
    setMenu(false);
    if (!loaded) return;
    try {
      const data = (await pickJson()) as { format?: string; notes?: Note[]; laneCount?: number; offsetMs?: number; fingerprint?: string };
      if (data?.format !== 'pulsefall-chart' || !Array.isArray(data.notes)) throw new Error('That file is not a Pulsefall chart.');
      if (data.laneCount && data.laneCount !== loaded.base.laneCount) throw new Error(`That chart uses ${data.laneCount} lanes; this one uses ${loaded.base.laneCount}.`);
      if (data.fingerprint && data.fingerprint !== loaded.song.fingerprint) {
        const go = await confirmDialog({ title: 'Different song?', body: 'This chart was made for a different audio file. Load it anyway?', confirm: 'Load' });
        if (!go) return;
      }
      const report = validateChart(data.notes, { laneCount: loaded.base.laneCount, durationMs: loaded.song.durationMs, sameLaneGapMs: 60 });
      commit(report.notes, typeof data.offsetMs === 'number' ? data.offsetMs : offsetMs);
      toast(`Loaded ${report.notes.length} notes — Save to keep them`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  if (error)
    return (
      <div class="screen">
        <TopBar title="Editor" backTo={{ name: 'song', id }} />
        <p class="empty">{error}</p>
      </div>
    );
  if (!loaded)
    return (
      <div class="screen center">
        <div class="spinner" />
      </div>
    );

  const sel = selected.size;
  return (
    <div class="editor">
      <header class="editor-top">
        <button class="icon-btn" aria-label="Back" onClick={() => void leave()}>
          <Icon name="back" />
        </button>
        <div class="editor-title">
          <b>{loaded.song.title}</b>
          <span>
            {STYLES[style].label} · {notes.length} notes{dirty ? ' · unsaved' : ''}
          </span>
        </div>
        <IconButton icon="undo" label="Undo" onClick={undo} />
        <IconButton icon="redo" label="Redo" onClick={redo} />
        <Button size="sm" variant={dirty ? 'primary' : 'secondary'} icon="check" onClick={() => void save()}>
          Save
        </Button>
      </header>
      <div class="editor-tools">
        <Button size="sm" variant={playing ? 'primary' : 'secondary'} icon={playing ? 'pause' : 'play'} onClick={() => void togglePlay()} label="Play from playhead" />
        <Segmented<Tool>
          label="Tool"
          value={tool}
          onChange={setTool}
          options={[
            { value: 'tap', label: 'Tap' },
            { value: 'hold', label: 'Hold' },
            { value: 'swipe', label: 'Swipe' },
            { value: 'select', label: 'Select' },
          ]}
        />
        <Segmented<Snap>
          label="Snap"
          value={snap}
          onChange={setSnap}
          options={[
            { value: 1, label: '1/1' },
            { value: 2, label: '1/2' },
            { value: 4, label: '1/4' },
            { value: 3, label: '1/3' },
            { value: 0, label: 'Free' },
          ]}
        />
        <IconButton icon="zoomOut" label="Zoom out" onClick={() => setZoom((z) => Math.max(0.05, z / 1.4))} />
        <IconButton icon="zoomIn" label="Zoom in" onClick={() => setZoom((z) => Math.min(1.2, z * 1.4))} />
        <Button size="sm" icon="play" onClick={preview}>
          Test here
        </Button>
        <IconButton icon="more" label="More" onClick={() => setMenu(true)} />
      </div>
      {sel > 0 && (
        <div class="editor-selection">
          <span>{sel} selected</span>
          <button onClick={() => commit(setType(notes, selected, 'tap'))}>Tap</button>
          <button onClick={() => commit(setType(notes, selected, 'hold'))}>Hold</button>
          <button onClick={() => commit(setType(notes, selected, 'swipe'))}>Swipe</button>
          <button onClick={() => commit(cycleSwipeDir(notes, selected))}>Arrow ↻</button>
          <button
            class="danger"
            onClick={() => {
              commit(removeNotes(notes, selected));
              setSelected(new Set());
            }}
          >
            <Icon name="trash" size={16} /> Delete
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        class="editor-canvas"
        onPointerDown={(e) => onPointerDown(e as unknown as PointerEvent)}
        onPointerMove={(e) => onPointerMove(e as unknown as PointerEvent)}
        onPointerUp={() => onPointerUp()}
        onPointerCancel={() => onPointerUp()}
        onWheel={(e) => onWheel(e as unknown as WheelEvent)}
      />
      <p class="editor-hint">Drag to scroll · tap a lane to add · drag notes to move · drag a hold's end to resize</p>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Chart tools">
        <Stepper label="Chart offset" hint="Shift every note. Positive = later." value={offsetMs} min={-500} max={500} onChange={(v) => commit(notes, v)} />
        <MenuItem icon="download" label="Export chart file" hint="Share or back up this chart (no audio)" onClick={exportChart} />
        <MenuItem icon="upload" label="Import chart file" onClick={() => void importChart()} />
        {loaded.hasCustom && <MenuItem icon="refresh" label="Restore automatic chart" danger onClick={() => void restoreAuto()} />}
        <MenuItem
          icon="x"
          label="Clear selection"
          onClick={() => {
            setSelected(new Set());
            setMenu(false);
            force((n) => n + 1);
          }}
        />
      </Sheet>
    </div>
  );
}
