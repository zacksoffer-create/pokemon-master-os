// Builds a copy of Pulsefall that runs inside a sandboxed single-page host (for example a
// claude.ai artifact): no service worker, fonts inlined, and an index page without its own
// <html>/<head>/<body> wrapper. Output: dist-artifact/artifact.html plus dist-artifact/assets/.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist-artifact');

execSync('npx vite build --mode artifact', { cwd: root, stdio: 'inherit' });

const html = readFileSync(join(out, 'index.html'), 'utf8');
const script = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"/)?.[1];
if (!script || !css) throw new Error('Could not find the entry script or stylesheet in index.html');

const page = `<title>Pulsefall</title>
<meta name="description" content="A personal rhythm game: import your own MP3 or M4A songs and play automatically generated three-lane charts." />
<meta name="theme-color" content="#07060f" />
<style>
${readFileSync(join(out, css), 'utf8')}
</style>
<div id="app"></div>
<noscript>Pulsefall needs JavaScript to run.</noscript>
<script type="module" src="./${script}"></script>
`;
writeFileSync(join(out, 'artifact.html'), page);
console.log(`\nartifact page: dist-artifact/artifact.html (entry ${script})`);
