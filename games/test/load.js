// Loads the browser modules into one Node context for tests.
const fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function load(files) {
  const ctx = { window: { innerHeight: 800 }, performance: { now: () => Date.now() }, console, Math, navigator: {} };
  vm.createContext(ctx);
  const src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n');
  const names = src.match(/^const (\w+) = \(/gm).map(s => s.slice(6, -4).trim());
  vm.runInContext(src + '\n;({' + names.join(',') + '})', ctx);
  return vm.runInContext('({' + names.join(',') + '})', ctx);
};
