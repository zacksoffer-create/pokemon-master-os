import type { SongRecord } from '../../core/types';
import { hashString, mulberry32 } from '../../core/util';
import { useArtwork } from '../state/libraryHooks';

/** The Pulsefall mark: three lanes converging on a glowing hit line. */
export function Emblem({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" class="emblem">
      <defs>
        {/* userSpaceOnUse: a horizontal line has a zero-height bounding box. */}
        <linearGradient id="em-l" gradientUnits="userSpaceOnUse" x1="7" y1="0" x2="57" y2="0">
          <stop offset="0" stop-color="#22e6ff" />
          <stop offset="0.5" stop-color="#a96bff" />
          <stop offset="1" stop-color="#ff3fb4" />
        </linearGradient>
        <linearGradient id="em-hw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#a96bff" stop-opacity="0" />
          <stop offset="1" stop-color="#a96bff" stop-opacity="0.3" />
        </linearGradient>
        <radialGradient id="em-g" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#fff" stop-opacity="0.9" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path d="M27 7L12 49H52L37 7Z" fill="url(#em-hw)" />
      <path d="M27 7L12 49M32 7v42M37 7l15 42" stroke="url(#em-l)" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.6" />
      <path d="M7 49h50" stroke="url(#em-l)" stroke-width="3.2" stroke-linecap="round" />
      <circle cx="19" cy="31" r="5.2" fill="#22e6ff" />
      <circle cx="32" cy="18" r="3.8" fill="#a96bff" />
      <circle cx="46" cy="44" r="6.2" fill="#ff3fb4" />
      <circle cx="46" cy="49" r="9" fill="url(#em-g)" opacity="0.8" />
      <circle cx="17.6" cy="29.5" r="1.5" fill="#fff" opacity="0.8" />
      <circle cx="44.3" cy="42.2" r="1.8" fill="#fff" opacity="0.8" />
    </svg>
  );
}

export function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <div class="wordmark" style={{ fontSize: `${size}px` }}>
      <span>PULSE</span>
      <span class="wordmark-b">FALL</span>
    </div>
  );
}

const PALETTES: [string, string, string][] = [
  ['#22e6ff', '#a96bff', '#ff3fb4'],
  ['#ffb347', '#ff5e7e', '#7b2cff'],
  ['#3dffb0', '#3dc9ff', '#5b4bff'],
  ['#ff3fb4', '#ffd34d', '#ff6a3d'],
  ['#5b8cff', '#22e6ff', '#c8f7ff'],
  ['#c85cff', '#ff5e7e', '#ffb347'],
  ['#00e1a3', '#ffe600', '#ff7ad9'],
];

/** Deterministic generative cover for songs without embedded artwork. */
export function ProceduralCover({ seed, title }: { seed: string; title: string }) {
  const h = hashString(seed);
  const rnd = mulberry32(h);
  const [a, b, c] = PALETTES[h % PALETTES.length];
  const id = `pc${h.toString(36)}`;
  const rings = 3 + Math.floor(rnd() * 4);
  const angle = Math.floor(rnd() * 360);
  const cx = 30 + rnd() * 40;
  const cy = 30 + rnd() * 40;
  // A stylized waveform band.
  const pts: string[] = [];
  const waveY = 62 + rnd() * 18;
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * 100;
    const amp = 3 + rnd() * 9 * Math.sin((i / 40) * Math.PI);
    pts.push(`${x.toFixed(1)},${(waveY - amp).toFixed(1)}`);
  }
  for (let i = 40; i >= 0; i--) {
    const x = (i / 40) * 100;
    const amp = 2 + rnd() * 6 * Math.sin((i / 40) * Math.PI);
    pts.push(`${x.toFixed(1)},${(waveY + amp).toFixed(1)}`);
  }
  const initial = (title.trim()[0] ?? '♪').toUpperCase();
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" class="cover-svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} gradientTransform={`rotate(${angle} 0.5 0.5)`}>
          <stop offset="0" stop-color={a} />
          <stop offset="0.55" stop-color={b} />
          <stop offset="1" stop-color={c} />
        </linearGradient>
        <radialGradient id={`${id}r`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#fff" stop-opacity="0.55" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="#0b0818" />
      <rect width="100" height="100" fill={`url(#${id}g)`} opacity="0.85" />
      {Array.from({ length: rings }, (_, i) => (
        <circle cx={cx} cy={cy} r={10 + i * 11} fill="none" stroke="#fff" stroke-opacity={0.08 + 0.05 * (rings - i) / rings} stroke-width={1 + (i % 2)} />
      ))}
      <circle cx={cx} cy={cy} r="16" fill={`url(#${id}r)`} />
      <polygon points={pts.join(' ')} fill="#0b0818" fill-opacity="0.35" />
      <text x="8" y="92" font-size="26" font-weight="700" fill="#fff" fill-opacity="0.85" font-family="Chakra Petch, system-ui, sans-serif">
        {initial}
      </text>
    </svg>
  );
}

export function Cover({ song, class: cls }: { song: SongRecord; class?: string }) {
  const url = useArtwork(song);
  return (
    <div class={`cover ${cls ?? ''}`}>
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <ProceduralCover seed={song.id} title={song.title} />}
      {!song.hasAudio && !song.isDemo && <span class="cover-badge">No audio</span>}
    </div>
  );
}
