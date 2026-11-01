// Serves a dist page wrapped the way the artifact viewer wraps it, for Playwright.
const fs = require('fs'), path = require('path');
module.exports = function page(name) {
  const body = fs.readFileSync(path.join(__dirname, '..', 'dist', name), 'utf8');
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>';
};
