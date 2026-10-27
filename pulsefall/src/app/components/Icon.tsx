import type { JSX } from 'preact';

export type IconName =
  | 'play'
  | 'pause'
  | 'plus'
  | 'library'
  | 'settings'
  | 'back'
  | 'heart'
  | 'heartFill'
  | 'search'
  | 'trash'
  | 'edit'
  | 'refresh'
  | 'more'
  | 'star'
  | 'music'
  | 'sparkle'
  | 'check'
  | 'x'
  | 'download'
  | 'upload'
  | 'info'
  | 'home'
  | 'sync'
  | 'robot'
  | 'volume'
  | 'stop'
  | 'undo'
  | 'redo'
  | 'magnet'
  | 'zoomIn'
  | 'zoomOut'
  | 'share'
  | 'warning';

const PATHS: Record<IconName, JSX.Element> = {
  play: <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <g fill="currentColor" stroke="none">
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
    </g>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  library: <path d="M4 5v14M8.5 5v14M13 5.5l4.5 13.5M19.5 18.5" />,
  settings: (
    <g>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </g>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  heart: <path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.6 12 20 12 20z" />,
  heartFill: <path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.6 12 20 12 20z" fill="currentColor" />,
  search: (
    <g>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </g>
  ),
  trash: <path d="M5 7h14M9.5 7V4.8h5V7M7 7l1 12.5h8L17 7M10.5 10.5v6M13.5 10.5v6" />,
  edit: <path d="M4.5 19.5l1-4.2L16 4.8a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L8.7 18.5zM14 6.8l3.2 3.2" />,
  refresh: <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5v4h-4" />,
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="5.5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18.5" cy="12" r="1.8" />
    </g>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" stroke="none" />,
  music: <path d="M9 18.5V6.5l10-2v12M9 18.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 18.5zM19 16.5a2.5 2.5 0 1 1-2.5-2.5 2.5 2.5 0 0 1 2.5 2.5z" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />,
  upload: <path d="M12 20V9M7 13.5l5-5 5 5M5 4.5h14" />,
  info: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </g>
  ),
  home: <path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5" />,
  sync: (
    <g>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </g>
  ),
  robot: (
    <g>
      <rect x="5" y="8" width="14" height="10" rx="3" />
      <path d="M12 4.5V8M9.5 12.5v.5M14.5 12.5v.5M9.5 15.5h5" />
    </g>
  ),
  volume: <path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  undo: <path d="M9 7.5L5 11.5l4 4M5.5 11.5h8a5 5 0 0 1 0 10h-2" />,
  redo: <path d="M15 7.5l4 4-4 4M18.5 11.5h-8a5 5 0 0 0 0 10h2" />,
  magnet: <path d="M6 4.5v7a6 6 0 0 0 12 0v-7M6 8.5h3.5M14.5 8.5H18M9.5 4.5v7a2.5 2.5 0 0 0 5 0v-7" />,
  zoomIn: (
    <g>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5M8 10.5h5M10.5 8v5" />
    </g>
  ),
  zoomOut: (
    <g>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5M8 10.5h5" />
    </g>
  ),
  share: <path d="M12 3.5v11M8 7.5l4-4 4 4M6 11v8.5h12V11" />,
  warning: <path d="M12 4l9 15.5H3zM12 10v4.5M12 17v.1" />,
};

export function Icon({ name, size = 22, class: cls }: { name: IconName; size?: number; class?: string }) {
  return (
    <svg
      class={`icon ${cls ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
