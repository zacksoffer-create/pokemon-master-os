/* Faces: every character is drawn from a few numbers (skin, hair, style,
   shirt, accessory), and the expression changes with how they feel about
   what you just said. Reading those faces is half of every conversation. */
const Faces = (() => {
  const HAIR_STYLES = ['short', 'buzz', 'fade', 'curly', 'swoop', 'long', 'bob', 'pony', 'bun', 'locs'];
  const SKINS = ['#f6d3b3', '#f1c27d', '#e0ac69', '#c68642', '#a86b3c', '#8d5524', '#5c3a1e'];
  const HAIRS = ['#0f0b08', '#2b1d14', '#5a3a22', '#8a5a2b', '#c9772f', '#e0c068', '#7a2e8a', '#2f6d8a'];
  const SHIRTS = ['#1e5b47', '#e3b23c', '#2f4f8a', '#b4342d', '#6b3fa0', '#e2581f', '#3f7f6e', '#d94f87', '#2b2f36'];

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * (1 + amt)))); g = Math.max(0, Math.min(255, Math.round(g * (1 + amt)))); b = Math.max(0, Math.min(255, Math.round(b * (1 + amt))));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function hairBack(style, c) {
    switch (style) {
      case 'long': return `<path d="M25 40 C24 18 76 18 75 40 L78 78 C70 84 30 84 22 78 Z" fill="${c}"/>`;
      case 'bob': return `<path d="M25 40 C24 16 76 16 75 40 L76 62 C66 66 34 66 24 62 Z" fill="${c}"/>`;
      case 'pony': return `<path d="M70 30 C86 34 84 58 76 70 C74 56 74 44 68 36 Z" fill="${c}"/>`;
      case 'bun': return `<circle cx="50" cy="15" r="10" fill="${c}"/>`;
      case 'locs': return `<path d="M24 38 C22 14 78 14 76 38 L80 74 L72 70 L70 80 L62 72 L56 82 L50 72 L44 82 L38 72 L30 80 L28 70 L20 74 Z" fill="${c}"/>`;
      default: return '';
    }
  }
  function hairFront(style, c) {
    switch (style) {
      case 'buzz': return `<path d="M28 38 C28 20 72 20 72 38 C66 30 34 30 28 38 Z" fill="${c}" opacity="0.9"/>`;
      case 'fade': return `<path d="M27 40 C26 17 74 17 73 40 C70 30 62 26 50 26 C38 26 30 30 27 40 Z" fill="${c}"/>`;
      case 'short': return `<path d="M26 42 C24 15 76 15 74 42 C72 32 66 27 56 30 C48 24 34 28 26 42 Z" fill="${c}"/>`;
      case 'curly': return `<g fill="${c}"><circle cx="32" cy="30" r="8"/><circle cx="42" cy="23" r="9"/><circle cx="55" cy="22" r="9"/><circle cx="67" cy="28" r="8"/><circle cx="73" cy="38" r="5"/><circle cx="27" cy="39" r="5"/></g>`;
      case 'swoop': return `<path d="M26 40 C25 16 74 14 75 36 C66 26 52 34 40 30 C34 30 29 34 26 40 Z" fill="${c}"/><path d="M40 30 C52 22 68 22 74 30" stroke="${shade(c, 0.35)}" stroke-width="1.5" fill="none"/>`;
      case 'long': return `<path d="M26 42 C24 14 76 14 74 42 C70 26 58 24 50 30 C42 24 30 26 26 42 Z" fill="${c}"/>`;
      case 'bob': return `<path d="M26 44 C24 14 76 14 74 44 C72 30 60 26 50 27 C40 26 28 30 26 44 Z" fill="${c}"/>`;
      case 'pony': return `<path d="M26 42 C24 16 76 16 74 40 C68 28 40 24 26 42 Z" fill="${c}"/>`;
      case 'bun': return `<path d="M27 42 C26 18 74 18 73 42 C68 28 32 28 27 42 Z" fill="${c}"/>`;
      case 'locs': return `<path d="M26 42 C24 14 76 14 74 42 C66 28 34 28 26 42 Z" fill="${c}"/>`;
      default: return '';
    }
  }

  const EYES = {
    neutral: () => `<ellipse cx="41" cy="46" rx="2.3" ry="2.9" fill="#1d1410"/><ellipse cx="59" cy="46" rx="2.3" ry="2.9" fill="#1d1410"/>`,
    happy: () => `<path d="M38 47 Q41 43.5 44 47 M56 47 Q59 43.5 62 47" stroke="#1d1410" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    laugh: () => `<path d="M37.5 46 Q41 42 44.5 46 M55.5 46 Q59 42 62.5 46" stroke="#1d1410" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    annoyed: () => `<ellipse cx="41" cy="47" rx="2.3" ry="2" fill="#1d1410"/><ellipse cx="59" cy="47" rx="2.3" ry="2" fill="#1d1410"/><path d="M37.5 45.5 H44.5 M55.5 45.5 H62.5" stroke="SKIN" stroke-width="2.4"/>`,
    sad: () => `<ellipse cx="41" cy="47" rx="2.2" ry="2.7" fill="#1d1410"/><ellipse cx="59" cy="47" rx="2.2" ry="2.7" fill="#1d1410"/>`,
    hurt: () => `<ellipse cx="41" cy="47.5" rx="2.2" ry="2.3" fill="#1d1410"/><ellipse cx="59" cy="47.5" rx="2.2" ry="2.3" fill="#1d1410"/><path d="M62 50 q1.5 3 0 5" stroke="#7ab6e8" stroke-width="1.4" fill="none"/>`,
    surprised: () => `<circle cx="41" cy="46" r="3.3" fill="#fff"/><circle cx="59" cy="46" r="3.3" fill="#fff"/><circle cx="41" cy="46" r="2.1" fill="#1d1410"/><circle cx="59" cy="46" r="2.1" fill="#1d1410"/>`,
    smug: () => `<path d="M38 46.5 H44" stroke="#1d1410" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="59" cy="46" rx="2.3" ry="2.6" fill="#1d1410"/>`,
    shy: () => `<ellipse cx="40" cy="48" rx="2" ry="2.5" fill="#1d1410"/><ellipse cx="58" cy="48" rx="2" ry="2.5" fill="#1d1410"/>`
  };
  const BROWS = {
    neutral: 'M37 40 L45 39.5 M55 39.5 L63 40',
    happy: 'M37 39 Q41 37 45 38.5 M55 38.5 Q59 37 63 39',
    laugh: 'M37 38.5 Q41 36 45 38 M55 38 Q59 36 63 38.5',
    annoyed: 'M37 39 L45 41.5 M55 41.5 L63 39',
    sad: 'M37 41 L45 38.5 M55 38.5 L63 41',
    hurt: 'M37 41.5 L45 38 M55 38 L63 41.5',
    surprised: 'M37 37 Q41 34.5 45 36.5 M55 36.5 Q59 34.5 63 37',
    smug: 'M37 40.5 L45 40.5 M55 38 Q59 36.5 63 38.5',
    shy: 'M37 40 Q41 38.5 45 40 M55 40 Q59 38.5 63 40'
  };
  const MOUTHS = {
    neutral: `<path d="M44 58.5 Q50 59.5 56 58.5" stroke="#5a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    happy: `<path d="M42 56.5 Q50 63.5 58 56.5" stroke="#5a2a20" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    laugh: `<path d="M41 55.5 Q50 55 59 55.5 Q57.5 66 50 66 Q42.5 66 41 55.5 Z" fill="#5a2a20"/><path d="M45 62.5 Q50 60 55 62.5 Q53 65.5 50 65.5 Q47 65.5 45 62.5 Z" fill="#d9706a"/>`,
    annoyed: `<path d="M44 60 Q50 57.5 56 60" stroke="#5a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    sad: `<path d="M43 61 Q50 55.5 57 61" stroke="#5a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    hurt: `<path d="M44 61 Q47 58.5 50 60 Q53 58.5 56 61" stroke="#5a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    surprised: `<ellipse cx="50" cy="60" rx="3.6" ry="4.4" fill="#5a2a20"/>`,
    smug: `<path d="M43 59 Q51 61.5 57 55.5" stroke="#5a2a20" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    shy: `<path d="M46 58.5 Q50 61 54 58.5" stroke="#5a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>`
  };

  /* look: { skin, hair, style, shirt, acc } ; expr: one of the keys above */
  function svg(look, expr, opts) {
    const o = opts || {};
    const e = EYES[expr] ? expr : 'neutral';
    const skin = look.skin || '#e0ac69', hair = look.hair || '#2b1d14', shirt = look.shirt || '#1e5b47';
    const dark = shade(skin, -0.14);
    const blush = e === 'shy' || e === 'laugh' || o.blush ? `<ellipse cx="35" cy="54" rx="4.5" ry="2.6" fill="#e8737a" opacity="0.38"/><ellipse cx="65" cy="54" rx="4.5" ry="2.6" fill="#e8737a" opacity="0.38"/>` : '';
    const acc = look.acc === 'glasses'
      ? `<g fill="none" stroke="#1d1d22" stroke-width="1.6"><circle cx="41" cy="46.5" r="6"/><circle cx="59" cy="46.5" r="6"/><path d="M47 46 Q50 44.5 53 46"/></g>`
      : look.acc === 'earring' ? `<circle cx="27.5" cy="53" r="1.6" fill="#e3b23c"/><circle cx="72.5" cy="53" r="1.6" fill="#e3b23c"/>`
      : look.acc === 'band' ? `<path d="M26 33 Q50 24 74 33 L74 37 Q50 28 26 37 Z" fill="#f4f4f4"/>` : '';
    const title = o.title ? `<title>${String(o.title).replace(/[<&]/g, '')}</title>` : '';
    return `<svg class="face" viewBox="0 0 100 100" role="img" aria-label="${o.label ? String(o.label).replace(/"/g, '') : 'Portrait'}">${title}
      <circle cx="50" cy="50" r="50" fill="${o.bg || 'var(--face-bg, #e8edf3)'}"/>
      <clipPath id="fc${o.id || ''}"><circle cx="50" cy="50" r="50"/></clipPath>
      <g clip-path="url(#fc${o.id || ''})">
        ${hairBack(look.style, hair)}
        <path d="M8 104 C8 80 28 71 50 71 C72 71 92 80 92 104 Z" fill="${shirt}"/>
        <path d="M40 71 Q50 80 60 71" fill="none" stroke="${shade(shirt, -0.25)}" stroke-width="2"/>
        <rect x="42.5" y="60" width="15" height="14" rx="5" fill="${dark}"/>
        <ellipse cx="27.5" cy="47" rx="4" ry="6" fill="${dark}"/><ellipse cx="72.5" cy="47" rx="4" ry="6" fill="${dark}"/>
        <ellipse cx="50" cy="45" rx="22.5" ry="25" fill="${skin}"/>
        ${hairFront(look.style, hair)}
        <path d="${BROWS[e]}" stroke="${shade(hair, -0.1)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        ${EYES[e]().replace(/SKIN/g, skin)}
        <path d="M50 49 Q48.5 53.5 50.5 54" stroke="${dark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        ${MOUTHS[e]}
        ${blush}${acc}
      </g></svg>`;
  }

  return { svg, HAIR_STYLES, SKINS, HAIRS, SHIRTS, shade };
})();
