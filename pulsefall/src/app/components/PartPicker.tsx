import { useMemo, useRef, useState } from 'preact/hooks';
import { MIN_PART_MS, clampRange, isWholeSong, sectionNames, type PlayRange } from '../../core/game/part';
import type { Chart, Segment, SongRecord } from '../../core/types';
import { clamp, formatDuration } from '../../core/util';
import { Button } from './ui';

const DENSITY_BINS = 100;
/** Edges snap to a section boundary this close (fraction of the song). */
const SNAP = 0.015;

/** The loudest section: usually the chorus or drop, the part people most want to play. */
function defaultRange(segments: Segment[], durationMs: number): PlayRange {
  if (segments.length === 0) return { startMs: 0, endMs: durationMs };
  const top = segments.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  return clampRange({ startMs: top.startMs, endMs: top.endMs }, durationMs);
}

/** Notes per stretch of the song, as an SVG area path in a 100 x 20 box. */
function densityPath(chart: Chart, durationMs: number, offsetMs: number): string {
  const bins = new Array<number>(DENSITY_BINS).fill(0);
  for (const n of chart.notes) {
    const b = Math.floor(((n.t + offsetMs) / durationMs) * DENSITY_BINS);
    if (b >= 0 && b < DENSITY_BINS) bins[b]++;
  }
  const max = Math.max(1, ...bins);
  let d = 'M0 20';
  bins.forEach((c, i) => {
    const y = (20 - (c / max) * 17).toFixed(1);
    d += ` L${i} ${y} L${i + 1} ${y}`;
  });
  return `${d} L100 20 Z`;
}

/**
 * Pick a stretch of a song: tap a section (tap another to join them), or drag either edge,
 * which snaps to section boundaries. Then listen, play it once, or keep it for every play.
 */
export function PartPicker({
  song,
  chart,
  segments,
  listening,
  onListen,
  onPlay,
  onSaveTrim,
}: {
  song: SongRecord;
  chart: Chart;
  segments: Segment[];
  listening: boolean;
  onListen(range: PlayRange): void;
  onPlay(range: PlayRange): void;
  onSaveTrim(range: PlayRange | null): void;
}) {
  const dur = song.durationMs;
  const offset = (chart.offsetMs || 0) + (song.overrides?.offsetMs || 0);
  const names = useMemo(() => sectionNames(segments), [segments]);
  const density = useMemo(() => densityPath(chart, dur, offset), [chart, dur, offset]);
  const [range, setRange] = useState<PlayRange>(() => song.trim ?? defaultRange(segments, dur));
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<'start' | 'end' | null>(null);

  const noteCount = chart.notes.filter((n) => n.t + offset >= range.startMs && n.t + offset <= range.endMs).length;
  const whole = isWholeSong(range, dur);
  const trimmed = !!song.trim && song.trim.startMs === range.startMs && song.trim.endMs === range.endMs;
  const pct = (ms: number) => `${(ms / dur) * 100}%`;

  function msAt(clientX: number): number {
    const r = trackRef.current!.getBoundingClientRect();
    const ms = clamp((clientX - r.left) / r.width, 0, 1) * dur;
    let best = ms;
    let bestDist = dur * SNAP;
    for (const s of segments) {
      for (const b of [s.startMs, s.endMs]) {
        if (Math.abs(b - ms) < bestDist) {
          bestDist = Math.abs(b - ms);
          best = b;
        }
      }
    }
    return Math.round(best);
  }

  function moveEdge(which: 'start' | 'end', ms: number) {
    setRange((r) =>
      which === 'start'
        ? { startMs: Math.max(0, Math.min(ms, r.endMs - MIN_PART_MS)), endMs: r.endMs }
        : { startMs: r.startMs, endMs: Math.min(dur, Math.max(ms, r.startMs + MIN_PART_MS)) },
    );
  }

  function tapSection(s: Segment) {
    setRange((r) => {
      const single = segments.find((x) => x.startMs === r.startMs && x.endMs === r.endMs);
      // One section selected and another tapped: join them (and everything in between).
      if (single && single !== s) return clampRange({ startMs: Math.min(single.startMs, s.startMs), endMs: Math.max(single.endMs, s.endMs) }, dur);
      return clampRange({ startMs: s.startMs, endMs: s.endMs }, dur);
    });
  }

  const handle = (which: 'start' | 'end') => ({
    class: `part-handle ${which}`,
    style: { left: pct(which === 'start' ? range.startMs : range.endMs) },
    role: 'slider' as const,
    tabIndex: 0,
    'aria-label': which === 'start' ? 'Part start' : 'Part end',
    'aria-valuetext': formatDuration(which === 'start' ? range.startMs : range.endMs),
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      drag.current = which;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (drag.current === which) moveEdge(which, msAt(e.clientX));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    onKeyDown: (e: KeyboardEvent) => {
      const step = e.key === 'ArrowLeft' ? -1000 : e.key === 'ArrowRight' ? 1000 : 0;
      if (!step) return;
      e.preventDefault();
      moveEdge(which, (which === 'start' ? range.startMs : range.endMs) + step);
    },
  });

  return (
    <div class="part">
      <p class="part-hint">Tap a section — tap another to join them — or drag the edges.</p>
      <div class="part-track" ref={trackRef}>
        {segments.map((s, i) => (
          <button
            class={`part-sec ${s.startMs >= range.startMs && s.endMs <= range.endMs ? 'on' : ''}`}
            style={{ left: pct(s.startMs), width: pct(s.endMs - s.startMs), '--energy': (0.25 + 0.75 * s.intensity).toFixed(2) }}
            aria-label={`Section ${names[i]} at ${formatDuration(s.startMs)}`}
            onClick={() => tapSection(s)}
          >
            <span>{names[i]}</span>
          </button>
        ))}
        <svg class="part-density" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
          <path d={density} />
        </svg>
        <div class="part-dim" style={{ left: 0, width: pct(range.startMs) }} />
        <div class="part-dim" style={{ left: pct(range.endMs), right: 0 }} />
        <div class="part-sel" style={{ left: pct(range.startMs), width: pct(range.endMs - range.startMs) }} />
        <div {...handle('start')} />
        <div {...handle('end')} />
      </div>
      <div class="part-scale" aria-hidden="true">
        <span>0:00</span>
        <span>{formatDuration(dur)}</span>
      </div>
      <div class="part-times">
        <b>
          {formatDuration(range.startMs)} – {formatDuration(range.endMs)}
        </b>
        <span>
          {formatDuration(range.endMs - range.startMs)} · {noteCount} notes
        </span>
      </div>
      <div class="button-row">
        <Button icon={listening ? 'stop' : 'volume'} onClick={() => onListen(range)}>
          {listening ? 'Stop' : 'Listen'}
        </Button>
        <Button variant="primary" icon="play" onClick={() => onPlay(range)}>
          Play this part
        </Button>
      </div>
      {song.trim && (trimmed || whole) ? (
        <Button variant="ghost" icon="refresh" onClick={() => onSaveTrim(null)}>
          Play the whole song again
        </Button>
      ) : (
        <Button variant="ghost" icon="cut" disabled={whole} onClick={() => onSaveTrim(range)}>
          Always play just this part
        </Button>
      )}
      <p class="row-hint">
        A part is practice, so its score isn't saved. “Always play just this part” trims the song for every play, with its own best scores.
      </p>
    </div>
  );
}
