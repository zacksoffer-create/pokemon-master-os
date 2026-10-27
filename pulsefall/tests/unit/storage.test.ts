import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Library, chartId, toStorageError, validateBackup, BackupError } from '../../src/core/storage/library';
import { normalizeSong } from '../../src/core/storage/library';
import type { Chart, PlayResult, SongRecord } from '../../src/core/types';

let n = 0;
const freshName = () => `pf-test-${++n}-${Math.random()}`;

function song(id: string, extra: Partial<SongRecord> = {}): SongRecord {
  return normalizeSong({ id, fingerprint: `fp-${id}`, title: `Song ${id}`, artist: 'Lab', durationMs: 120000, hasAudio: true, ...extra });
}
function chart(songId: string, style: Chart['style'], source: Chart['source']): Chart {
  return {
    id: chartId(songId, style, source === 'auto' ? 'auto' : 'custom'),
    songId,
    style,
    source,
    laneCount: 3,
    offsetMs: 0,
    generatorVersion: 'g1',
    notes: [{ id: 1, t: 1000, lane: 0, type: 'tap' }],
    createdAt: 1,
    updatedAt: 1,
    validation: { ok: true, fixes: 0, warnings: [] },
    stats: { noteCount: 1, judgeCount: 1, holds: 0, swipes: 0, chords: 0, durationMs: 120000, nps: 1, peakNps: 1, level: 1 },
  };
}
function result(songId: string, score: number, extra: Partial<PlayResult> = {}): PlayResult {
  return {
    songId, chartId: chartId(songId, 'classic', 'auto'), style: 'classic', chartSource: 'auto', playedAt: Date.now(), score,
    accuracy: 0.9, maxCombo: 50, counts: { perfect: 40, great: 5, good: 3, miss: 2 }, totalJudgments: 50, fullCombo: false,
    allPerfect: false, stars: 4, meanErrorMs: 3, timingProfile: 'comfortable', offsets: { audio: 0, input: 0, visual: 0 },
    appVersion: '1', autoplay: false, completed: true, ...extra,
  };
}

describe('library persistence', () => {
  it('saves an import atomically and reads it back after a "restart"', async () => {
    const name = freshName();
    const lib = new Library(name);
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    await lib.saveImport({ song: song('a'), audio: { bytes, mime: 'audio/mpeg' }, charts: [chart('a', 'classic', 'auto'), chart('a', 'relaxed', 'auto')] });
    const again = new Library(name); // new instance = app restart
    const list = await again.listSongs();
    expect(list.map((s) => s.id)).toEqual(['a']);
    expect((await again.getCharts('a')).length).toBe(2);
    expect(new Uint8Array((await again.getAudio('a'))!.bytes)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect((await again.findByFingerprint('fp-a'))?.id).toBe('a');
    expect(await again.findByFingerprint('nope')).toBeNull();
  });

  it('records plays, play counts and personal bests (autoplay never counts)', async () => {
    const lib = new Library(freshName());
    await lib.saveImport({ song: song('b'), charts: [] });
    let r = await lib.recordPlay(result('b', 5000));
    expect(r.isNewBest).toBe(true);
    r = await lib.recordPlay(result('b', 4000, { maxCombo: 80, fullCombo: true }));
    expect(r.isNewBest).toBe(false);
    expect(r.previousBest?.score).toBe(5000);
    await lib.recordPlay(result('b', 99999, { autoplay: true }));
    const s = (await lib.getSong('b'))!;
    expect(s.playCount).toBe(3);
    expect(s.best.classic?.score).toBe(5000);
    expect(s.best.classic?.maxCombo).toBe(80);
    expect(s.best.classic?.fullCombo).toBe(true);
    expect((await lib.listResults('b')).length).toBe(3);
  });

  it('regenerating auto charts never touches custom charts', async () => {
    const lib = new Library(freshName());
    await lib.saveImport({ song: song('c'), charts: [chart('c', 'classic', 'auto')] });
    await lib.saveCustomChart({ ...chart('c', 'classic', 'edited'), notes: [{ id: 9, t: 2222, lane: 2, type: 'tap' }] });
    const regen = { ...chart('c', 'classic', 'auto'), notes: [{ id: 1, t: 3333, lane: 1, type: 'tap' as const }] };
    await lib.replaceAutoCharts('c', [regen], { analysisVersion: 'a2' });
    const charts = await lib.getCharts('c');
    expect(charts.find((x) => x.source === 'edited')?.notes[0].t).toBe(2222);
    expect(charts.find((x) => x.source === 'auto')?.notes[0].t).toBe(3333);
    expect((await lib.getSong('c'))?.analysisVersion).toBe('a2');
  });

  it('deleting a song removes everything belonging to it', async () => {
    const lib = new Library(freshName());
    await lib.saveImport({ song: song('d'), audio: { bytes: new ArrayBuffer(8), mime: 'audio/mp4' }, charts: [chart('d', 'classic', 'auto')] });
    await lib.saveImport({ song: song('e'), charts: [chart('e', 'classic', 'auto')] });
    await lib.recordPlay(result('d', 10));
    await lib.deleteSong('d');
    expect((await lib.listSongs()).map((s) => s.id)).toEqual(['e']);
    expect(await lib.getCharts('d')).toEqual([]);
    expect(await lib.getAudio('d')).toBeNull();
    expect(await lib.listResults('d')).toEqual([]);
    expect((await lib.getCharts('e')).length).toBe(1);
  });

  it('can drop audio but keep charts (missing-audio state)', async () => {
    const lib = new Library(freshName());
    await lib.saveImport({ song: song('f'), audio: { bytes: new ArrayBuffer(8), mime: 'audio/mpeg' }, charts: [chart('f', 'classic', 'auto')] });
    await lib.removeAudio('f');
    expect((await lib.getSong('f'))?.hasAudio).toBe(false);
    expect((await lib.getCharts('f')).length).toBe(1);
  });

  it('normalizes damaged records instead of crashing', async () => {
    const s = normalizeSong({ id: 'x', title: '   ', durationMs: NaN } as unknown as SongRecord);
    expect(s.title).toBe('Untitled');
    expect(s.durationMs).toBe(0);
    expect(s.best).toEqual({});
  });

  it('maps quota errors to a helpful message', () => {
    const e = toStorageError(Object.assign(new Error('x'), { name: 'QuotaExceededError' }));
    expect(e.code).toBe('quota');
    expect(e.message).toMatch(/out of space/);
  });
});

describe('backup and restore', () => {
  it('round-trips charts, custom work, scores and settings into a fresh library', async () => {
    const src = new Library(freshName());
    await src.saveImport({ song: song('g', { favorite: true }), audio: { bytes: new ArrayBuffer(16), mime: 'audio/mpeg' }, charts: [chart('g', 'classic', 'auto')] });
    await src.saveCustomChart({ ...chart('g', 'full', 'edited'), notes: [{ id: 5, t: 5000, lane: 1, type: 'hold', end: 6000 }] });
    await src.recordPlay(result('g', 777));
    const backup = JSON.parse(JSON.stringify(await src.exportBackup()));
    const dst = new Library(freshName());
    const counts = await dst.importBackup(backup);
    expect(counts).toMatchObject({ songs: 1, charts: 2, results: 1 });
    const s = (await dst.getSong('g'))!;
    expect(s.hasAudio).toBe(false); // audio is never in backups; re-import relinks it
    expect(s.favorite).toBe(true);
    expect(s.best.classic?.score).toBe(777);
    const custom = (await dst.getCharts('g')).find((c) => c.source === 'edited')!;
    expect(custom.notes[0]).toMatchObject({ type: 'hold', end: 6000 });
  });

  it('merging a backup into an existing library keeps the better scores and local audio', async () => {
    const lib = new Library(freshName());
    await lib.saveImport({ song: song('h'), audio: { bytes: new ArrayBuffer(4), mime: 'audio/mpeg' }, charts: [] });
    await lib.recordPlay(result('h', 100));
    const backup = await lib.exportBackup();
    backup.songs[0].song.best = { classic: { ...backup.songs[0].song.best.classic!, score: 999 } };
    await lib.importBackup(backup);
    const s = (await lib.getSong('h'))!;
    expect(s.hasAudio).toBe(true);
    expect(s.best.classic?.score).toBe(999);
  });

  it('rejects files that are not backups', () => {
    expect(() => validateBackup({ hello: 1 })).toThrow(BackupError);
    expect(() => validateBackup(null)).toThrow(BackupError);
    expect(() => validateBackup({ format: 'pulsefall-backup', version: 99, songs: [] })).toThrow(/newer/);
    const partial = validateBackup({ format: 'pulsefall-backup', version: 1, songs: [{ song: { id: 'ok' }, charts: [] }, { bad: true }] });
    expect(partial.songs.length).toBe(1);
  });
});
