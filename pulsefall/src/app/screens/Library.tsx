import { useMemo, useState } from 'preact/hooks';
import { CHART_STYLES, type SongRecord } from '../../core/types';
import { formatDuration } from '../../core/util';
import { Cover } from '../components/Art';
import { Icon } from '../components/Icon';
import { Button, Segmented, Stars, TopBar } from '../components/ui';
import { navigate } from '../router';
import { pickFiles } from '../state/importManager';
import { useSongs } from '../state/libraryHooks';
import { uiSound } from '../state/settings';

type Sort = 'recent' | 'title' | 'artist' | 'plays';

function bestStars(s: SongRecord): number {
  return Math.max(0, ...CHART_STYLES.map((st) => s.best[st]?.stars ?? 0));
}

export function Library() {
  const { data: songs, loading, error } = useSongs();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [favOnly, setFavOnly] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = songs.filter((s) => !q || `${s.title} ${s.artist} ${s.album ?? ''}`.toLowerCase().includes(q));
    if (favOnly) out = out.filter((s) => s.favorite);
    const by: Record<Sort, (a: SongRecord, b: SongRecord) => number> = {
      recent: (a, b) => Math.max(b.lastPlayedAt ?? 0, b.importedAt) - Math.max(a.lastPlayedAt ?? 0, a.importedAt),
      title: (a, b) => a.title.localeCompare(b.title),
      artist: (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
      plays: (a, b) => b.playCount - a.playCount,
    };
    return out.sort(by[sort]);
  }, [songs, query, sort, favOnly]);

  const importBtn = (
    <Button icon="plus" variant="primary" size="sm" onClick={() => pickFiles((s) => s.length === 1 && navigate({ name: 'song', id: s[0].id }))}>
      Import
    </Button>
  );

  return (
    <div class="screen library">
      <TopBar title="Library" backTo={{ name: 'home' }} right={importBtn} />
      <div class="library-tools">
        <label class="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Search songs, artists, albums"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            aria-label="Search library"
          />
        </label>
        <div class="library-filters">
          <Segmented<Sort>
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'recent', label: 'Recent' },
              { value: 'title', label: 'A–Z' },
              { value: 'artist', label: 'Artist' },
              { value: 'plays', label: 'Plays' },
            ]}
          />
          <button
            class={`chip ${favOnly ? 'on' : ''}`}
            aria-pressed={favOnly}
            onClick={() => {
              uiSound();
              setFavOnly(!favOnly);
            }}
          >
            <Icon name={favOnly ? 'heartFill' : 'heart'} size={16} /> Favorites
          </button>
        </div>
      </div>

      {error && <p class="empty">Couldn't open your library: {error}</p>}
      {!loading && !error && list.length === 0 && (
        <div class="empty">
          {songs.length <= 1 && !query && !favOnly ? (
            <>
              <Icon name="music" size={40} />
              <h2>Your library is waiting</h2>
              <p>Import an MP3, M4A or video from your Files app or Photo Library. Pulsefall listens to it and builds a chart automatically — no setup needed.</p>
              <Button variant="primary" icon="plus" onClick={() => pickFiles((s) => s.length === 1 && navigate({ name: 'song', id: s[0].id }))}>
                Import a song
              </Button>
            </>
          ) : (
            <p>No songs match.</p>
          )}
        </div>
      )}

      <div class="song-grid">
        {list.map((s) => (
          <button
            class="song-card"
            onClick={() => {
              uiSound();
              navigate({ name: 'song', id: s.id });
            }}
          >
            <Cover song={s} />
            <div class="song-card-text">
              <span class="song-title">
                {s.favorite && <Icon name="heartFill" size={13} class="fav" />}
                {s.title}
              </span>
              <span class="song-artist">{s.artist}</span>
              <span class="song-meta">
                <span>{formatDuration(s.durationMs)}</span>
                {bestStars(s) > 0 ? <Stars count={bestStars(s)} size={11} /> : <span class="new">{s.playCount ? '' : 'NEW'}</span>}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
