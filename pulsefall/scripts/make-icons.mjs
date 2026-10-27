// Renders the app icons (PNG) from inline SVG with the preinstalled Chromium.
// Usage: node scripts/make-icons.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(out, { recursive: true });

function iconSvg(size, { maskable = false } = {}) {
  // Maskable icons keep the art inside the central 80% safe zone.
  const pad = maskable ? 0.14 : 0;
  const s = 512;
  const inner = s * (1 - 2 * pad);
  const k = inner / 64;
  const o = s * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="l" gradientUnits="userSpaceOnUse" x1="7" y1="0" x2="57" y2="0"><stop offset="0" stop-color="#22e6ff"/><stop offset="0.5" stop-color="#a96bff"/><stop offset="1" stop-color="#ff3fb4"/></linearGradient>
    <linearGradient id="hw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a96bff" stop-opacity="0"/><stop offset="1" stop-color="#a96bff" stop-opacity="0.28"/></linearGradient>
    <radialGradient id="bg" cx="0.5" cy="0.15" r="1"><stop offset="0" stop-color="#3a1670"/><stop offset="0.55" stop-color="#120a26"/><stop offset="1" stop-color="#05040c"/></radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <filter id="b" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  <g transform="translate(${o} ${o}) scale(${k})">
    <path d="M27 7L12 49H52L37 7Z" fill="url(#hw)"/>
    <path d="M27 7L12 49M32 7v42M37 7l15 42" stroke="url(#l)" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/>
    <path d="M7 49h50" stroke="url(#l)" stroke-width="5" stroke-linecap="round" filter="url(#b)" opacity="0.9"/>
    <path d="M7 49h50" stroke="url(#l)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="19" cy="31" r="7" fill="#22e6ff" filter="url(#b)" opacity="0.8"/>
    <circle cx="19" cy="31" r="5.2" fill="#22e6ff"/>
    <circle cx="32" cy="18" r="3.8" fill="#a96bff"/>
    <circle cx="46" cy="44" r="8" fill="#ff3fb4" filter="url(#b)" opacity="0.8"/>
    <circle cx="46" cy="44" r="6.2" fill="#ff3fb4"/>
    <circle cx="46" cy="49" r="9" fill="url(#glow)" opacity="0.8"/>
    <circle cx="17.5" cy="29.5" r="1.6" fill="#fff" opacity="0.8"/>
    <circle cx="44.2" cy="42.2" r="1.9" fill="#fff" opacity="0.8"/>
  </g>
</svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
];
for (const [name, size, maskable] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#05040c">${iconSvg(size, { maskable })}</body></html>`);
  await page.screenshot({ path: out + name, omitBackground: false });
  console.log('wrote', name);
}
await browser.close();
