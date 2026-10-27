import { useEffect, useState } from 'preact/hooks';
import { library } from '../../core/storage/library';
import type { Chart, PlayResult, SongRecord } from '../../core/types';

/** Re-run a library query whenever the library changes. */
export function useLibraryQuery<T>(query: () => Promise<T>, deps: unknown[], initial: T): { data: T; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ data: T; loading: boolean; error: string | null }>({ data: initial, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    const run = () =>
      query()
        .then((data) => alive && setState({ data, loading: false, error: null }))
        .catch((e: Error) => alive && setState((s) => ({ ...s, loading: false, error: e.message })));
    void run();
    const off = library.subscribe(() => void run());
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useSongs() {
  return useLibraryQuery<SongRecord[]>(() => library.listSongs(), [], []);
}

export function useSong(id: string) {
  return useLibraryQuery<SongRecord | null>(() => library.getSong(id), [id], null);
}

export function useCharts(id: string) {
  return useLibraryQuery<Chart[]>(() => library.getCharts(id), [id], []);
}

export function useResults(id: string, limit = 8) {
  return useLibraryQuery<PlayResult[]>(() => library.listResults(id, limit), [id, limit], []);
}

export function useArtwork(song: SongRecord | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (song?.hasArtwork) void library.artworkUrl(song.id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [song?.id, song?.hasArtwork]);
  return url;
}
