import type { ImportStage } from '../../core/import/importer';
import { navigate } from '../router';
import { cancelImport, closeImports, importStore, pickFiles, type ImportItem } from '../state/importManager';
import { useStore } from '../state/store';
import { Icon } from './Icon';
import { Button, Sheet } from './ui';

const STAGES: { stage: ImportStage[]; label: string }[] = [
  { stage: ['reading'], label: 'Reading file' },
  { stage: ['decoding'], label: 'Decoding audio' },
  { stage: ['spectrum', 'onsets'], label: 'Finding the hits' },
  { stage: ['tempo', 'beats'], label: 'Locking onto the beat' },
  { stage: ['structure'], label: 'Mapping the song’s sections' },
  { stage: ['charts'], label: 'Building note patterns' },
  { stage: ['saving'], label: 'Saving to your library' },
];

function stageIndex(stage?: ImportStage): number {
  if (!stage) return -1;
  if (stage === 'done') return STAGES.length;
  return STAGES.findIndex((s) => s.stage.includes(stage));
}

function Progress({ item }: { item: ImportItem }) {
  const idx = stageIndex(item.stage);
  return (
    <ol class="import-stages">
      {STAGES.map((s, i) => (
        <li class={i < idx ? 'done' : i === idx ? 'active' : ''}>
          <span class="dot">{i < idx ? <Icon name="check" size={14} /> : null}</span>
          <span>{s.label}</span>
          {i === idx && item.fraction !== undefined && item.stage === 'spectrum' && (
            <i class="stage-bar">
              <i style={{ width: `${Math.round(item.fraction * 100)}%` }} />
            </i>
          )}
        </li>
      ))}
    </ol>
  );
}

export function ImportSheet() {
  const { open, items } = useStore(importStore);
  const working = items.find((i) => i.status === 'working');
  const queued = items.filter((i) => i.status === 'queued').length;
  const finished = items.filter((i) => i.status === 'done' || i.status === 'error' || i.status === 'cancelled');
  const busy = !!working || queued > 0;
  return (
    <Sheet open={open} onClose={closeImports} title={busy ? 'Importing' : 'Import finished'}>
      {working && (
        <div class="import-current">
          <p class="import-file">
            <Icon name="music" size={18} /> {working.fileName}
          </p>
          <Progress item={working} />
          <div class="sheet-actions">
            <span class="row-hint">{queued ? `${queued} more waiting` : 'You can keep browsing — this continues in the background.'}</span>
            <Button size="sm" variant="ghost" onClick={() => cancelImport(working.id)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {finished.length > 0 && (
        <ul class="import-results">
          {finished.map((it) => (
            <li class={it.status}>
              {it.status === 'done' && it.outcome ? (
                <>
                  <Icon name="check" size={18} />
                  <span class="import-res-text">
                    <b>{it.outcome.song.title}</b>
                    <small>
                      {it.outcome.kind === 'duplicate'
                        ? 'Already in your library'
                        : it.outcome.kind === 'relinked'
                          ? 'Audio relinked — your charts and scores are back'
                          : `${it.outcome.song.analysisSummary ? Math.round(it.outcome.song.analysisSummary.bpm) + ' BPM · ' : ''}ready to play`}
                    </small>
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="play"
                    onClick={() => {
                      closeImports();
                      navigate({ name: 'song', id: it.outcome!.song.id });
                    }}
                  >
                    Open
                  </Button>
                </>
              ) : (
                <>
                  <Icon name={it.status === 'cancelled' ? 'x' : 'warning'} size={18} />
                  <span class="import-res-text">
                    <b>{it.fileName}</b>
                    <small>{it.error ?? 'Cancelled'}</small>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!busy && (
        <div class="sheet-actions">
          <Button variant="ghost" onClick={closeImports}>
            Close
          </Button>
          <Button icon="plus" onClick={() => pickFiles()}>
            Import more
          </Button>
        </div>
      )}
    </Sheet>
  );
}
