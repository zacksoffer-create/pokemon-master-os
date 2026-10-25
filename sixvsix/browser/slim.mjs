// The browser bundles, shared by build.mjs (dist/) and cli/arena-pack.mjs (the app's copy).
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Data the battle-only build leaves out. Battles never read it; test-browser.mjs proves the battles are identical. */
export const slimPlugin = {
  name: 'battle-only',
  setup(build) {
    build.onResolve({ filter: /(learnsets|legality)\.mjs$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    build.onResolve({ filter: /data\/text\/(abilities|items|moves)\.mjs$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => {
      const name = a.path.includes('legality') ? 'Legality' : a.path.includes('learnsets') ? 'Learnsets'
        : a.path.includes('abilities') ? 'AbilitiesText' : a.path.includes('items') ? 'ItemsText' : 'MovesText';
      return { contents: `export const ${name} = {};`, loader: 'js' };
    });
  },
};

/** One bundle of browser/entry.js (the SixVSix global; a Web Worker when loaded as one). Returns its size. */
export async function bundle(outfile, { plugins = [], build = 'dev' } = {}) {
  await esbuild.build({
    entryPoints: [path.join(HERE, 'entry.js')], bundle: true, minify: true, format: 'iife', platform: 'browser',
    target: ['es2020', 'safari15'], outfile, plugins, metafile: true, legalComments: 'none',
    define: { __SIXVSIX_BUILD__: JSON.stringify(build) }, logLevel: 'warning',
  });
  return fs.statSync(outfile).size;
}
