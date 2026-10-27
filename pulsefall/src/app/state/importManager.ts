import { ImportError, importFile, type ImportOutcome, type ImportStage } from '../../core/import/importer';
import type { SongRecord } from '../../core/types';
import { settingsStore } from './settings';
import { Store } from './store';

export interface ImportItem {
  id: number;
  fileName: string;
  status: 'queued' | 'working' | 'done' | 'error' | 'cancelled';
  stage?: ImportStage;
  fraction?: number;
  outcome?: ImportOutcome;
  error?: string;
  errorCode?: string;
}

export interface ImportState {
  open: boolean;
  items: ImportItem[];
}

export const importStore = new Store<ImportState>({ open: false, items: [] });

let nextId = 1;
let queue: { item: ImportItem; file: File }[] = [];
/** Files of finished items, kept so a failed import can be retried without re-picking. */
const filesById = new Map<number, File>();
let running = false;
let controller: AbortController | null = null;

function patch(id: number, p: Partial<ImportItem>): void {
  importStore.update((s) => ({ ...s, items: s.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }));
}

export const ACCEPT = 'audio/*,.mp3,.m4a,.aac,.mp4,.wav,.flac,.ogg,.opus,.oga';

/** Open the system file picker. Must be called from a click/tap handler. */
export function pickFiles(onPicked?: (songs: SongRecord[]) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT;
  input.multiple = true;
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const files = Array.from(input.files ?? []);
    input.remove();
    if (files.length) enqueue(files, onPicked);
  });
  document.body.appendChild(input);
  input.click();
}

let doneCallbacks: ((songs: SongRecord[]) => void)[] = [];

export function enqueue(files: File[], onDone?: (songs: SongRecord[]) => void): void {
  if (onDone) doneCallbacks.push(onDone);
  const items = files.map((f) => ({ item: { id: nextId++, fileName: f.name, status: 'queued' as const }, file: f }));
  for (const x of items) filesById.set(x.item.id, x.file);
  queue.push(...items);
  importStore.update((s) => ({ open: true, items: [...s.items.filter((i) => i.status === 'working' || i.status === 'queued'), ...items.map((x) => x.item)] }));
  void pump();
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  const finished: SongRecord[] = [];
  while (queue.length) {
    const { item, file } = queue.shift()!;
    if (importStore.get().items.find((i) => i.id === item.id)?.status === 'cancelled') continue;
    controller = new AbortController();
    patch(item.id, { status: 'working', stage: 'reading' });
    try {
      const outcome = await importFile(file, {
        settings: settingsStore.get(),
        signal: controller.signal,
        onProgress: (p) => patch(item.id, { stage: p.stage, fraction: p.fraction }),
      });
      patch(item.id, { status: 'done', outcome, stage: 'done' });
      finished.push(outcome.song);
    } catch (e) {
      const err = e instanceof ImportError ? e : new ImportError('internal', (e as Error).message);
      patch(item.id, { status: err.code === 'cancelled' ? 'cancelled' : 'error', error: err.message, errorCode: err.code });
    }
    controller = null;
  }
  running = false;
  const cbs = doneCallbacks;
  doneCallbacks = [];
  for (const cb of cbs) cb(finished);
}

/** Re-run a failed or cancelled import with the same file. */
export function retryImport(id: number): void {
  const file = filesById.get(id);
  if (!file) return;
  importStore.update((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
  filesById.delete(id);
  enqueue([file]);
}

export function cancelImport(id: number): void {
  const it = importStore.get().items.find((i) => i.id === id);
  if (!it) return;
  if (it.status === 'working') controller?.abort();
  else if (it.status === 'queued') {
    queue = queue.filter((q) => q.item.id !== id);
    patch(id, { status: 'cancelled' });
  }
}

export function closeImports(): void {
  const busy = importStore.get().items.some((i) => i.status === 'working' || i.status === 'queued');
  if (!busy) filesById.clear();
  importStore.update((s) => ({ open: false, items: busy ? s.items : [] }));
}

export function reopenImports(): void {
  importStore.update((s) => ({ ...s, open: true }));
}
