import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'library' }
  | { name: 'song'; id: string }
  | { name: 'play'; id: string }
  | { name: 'edit'; id: string; style: string }
  | { name: 'settings' }
  | { name: 'calibrate' }
  | { name: 'help' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent).filter(Boolean);
  switch (parts[0]) {
    case 'library':
      return { name: 'library' };
    case 'song':
      return parts[1] ? { name: 'song', id: parts[1] } : { name: 'library' };
    case 'play':
      return parts[1] ? { name: 'play', id: parts[1] } : { name: 'library' };
    case 'edit':
      return parts[1] ? { name: 'edit', id: parts[1], style: parts[2] ?? 'classic' } : { name: 'library' };
    case 'settings':
      return { name: 'settings' };
    case 'calibrate':
      return { name: 'calibrate' };
    case 'help':
      return { name: 'help' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'song':
    case 'play':
      return `#/${r.name}/${encodeURIComponent(r.id)}`;
    case 'edit':
      return `#/edit/${encodeURIComponent(r.id)}/${r.style}`;
    default:
      return `#/${r.name}`;
  }
}

/** How many in-app pages we can go back through (the first page may be a deep link). */
let depth = 0;

export function navigate(r: Route, replace = false): void {
  const h = href(r);
  if (replace) history.replaceState({ depth }, '', h);
  else {
    depth++;
    history.pushState({ depth }, '', h);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Go back inside the app, or to `fallback` when there is nothing to go back to. */
export function back(fallback: Route = { name: 'home' }): void {
  if (depth > 0) {
    depth--;
    history.back();
  } else navigate(fallback, true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    const pop = (e: PopStateEvent) => {
      depth = typeof e.state?.depth === 'number' ? e.state.depth : 0;
      on();
    };
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', pop);
    };
  }, []);
  return route;
}
