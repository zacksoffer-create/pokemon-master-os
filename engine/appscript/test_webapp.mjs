// Tests for WebApp.gs outside Google: fakes for SpreadsheetApp, DriveApp, Utilities, CacheService, LockService and
// HtmlService, and the real app zip from engine/app/dist. Run: node engine/appscript/test_webapp.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ZIP = path.join(HERE, '..', 'app', 'dist', 'Blackthorn-HQ-app.zip');
const DATA = path.join(HERE, '..', 'app', 'data');

class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, {sh, r, c, nr, nc}); }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.put(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.sh.put(this.r, this.c, x); return this; }
  getValues() { return this.sh.rows.slice(this.r - 1, this.r - 1 + this.nr).map(row => { const out = []; for (let j = 0; j < this.nc; j++) out.push(row[this.c - 1 + j] ?? ''); return out; }); }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
}
class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows.map(r => r.slice()); }
  put(r, c, x) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = x; }
  width() { return Math.max(0, ...this.rows.map(r => r.length)); }
  getLastRow() { for (let i = this.rows.length; i > 0; i--) if (this.rows[i - 1].some(x => x !== '' && x != null)) return i; return 0; }
  getDataRange() { return new Range(this, 1, 1, this.getLastRow(), this.width()); }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  setFrozenRows() {}
  getName() { return this.name; }
}
function world(sheets) {
  const unzips = { n: 0 };
  const drive = { files: {}, n: 0, folders: 0, folder: null, props: {} };
  const cache = new Map();
  const zipFile = { getName: () => 'Blackthorn-HQ-app.zip', getId: () => 'zip1', getLastUpdated: () => new Date('2026-10-20T05:00:00Z'),
    getParents: () => { let i = 0; return { hasNext: () => i < 1, next: () => { i++; return { getId: () => 'root' }; } }; },
    getBlob: () => ({ setContentType() { return this; }, path: ZIP }) };
  const ss = { sheets, getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)) };
  const ctx = {
    console, Date, JSON, Math, String, Number, Object, Array, Error,
    SpreadsheetApp: { getActive: () => ss, getUi: () => ({ showModalDialog() {} }) },
    DriveApp: {
      searchFiles: () => { let i = 0; const list = [zipFile, { getName: () => 'Blackthorn-HQ-app notes.txt' }]; return { hasNext: () => i < list.length, next: () => list[i++] }; },
      getFileById: id => { if (id === 'zip1') return zipFile; if (drive.files[id]) return drive.files[id]; throw new Error('no file'); },
      createFolder: name => { const fidr = 'folder' + (++drive.folders), f = { name, getId: () => fidr, createFile: (blob, text, mime) => { const fid = 'pic' + (++drive.n);
        if (typeof blob === 'string') blob = { name: blob, text, mime };   // createFile(name, content, mimeType)
        const file = { getId: () => fid, getName: () => blob.name, text: blob.text, getUrl: () => 'https://drive.google.com/file/d/' + fid, getBlob: () => ({ getContentType: () => blob.mime, getBytes: () => blob.bytes }), getParents: () => { let i = 0; return { hasNext: () => i < 1, next: () => { i++; return f; } }; } };
        drive.files[fid] = file; return file; } }; (drive.byId = drive.byId || {})[fidr] = f; drive.folder = drive.folder || f; return f; },
      getFolderById: id => { if (drive.byId && drive.byId[id]) return drive.byId[id]; throw new Error('no folder'); },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => drive.props[k] || null, setProperty: (k, v) => { drive.props[k] = v; } }) },
    Utilities: { newBlob: (bytes, mime, name) => ({ bytes, mime, name }), base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b).toString('base64'),
      unzip: blob => { unzips.n++;
      const listing = JSON.parse(execFileSync('python3', ['-I', '-c', 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nprint(json.dumps({n: z.read(n).decode("utf-8") for n in z.namelist()}))', blob.path], { maxBuffer: 1 << 26 }));
      return Object.entries(listing).map(([n, text]) => ({ getName: () => n, getDataAsString: () => text })); } },
    CacheService: { getScriptCache: () => ({
      get: k => cache.get(k) ?? null, put: (k, v) => cache.set(k, v),
      getAll: ks => Object.fromEntries(ks.filter(k => cache.has(k)).map(k => [k, cache.get(k)])),
      putAll: o => { for (const [k, v] of Object.entries(o)) { assert.ok(Buffer.byteLength(v) <= 100 * 1024, 'cache value over 100 KB'); cache.set(k, v); } } }) },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    HtmlService: { createHtmlOutput: html => { const o = { html, title: '', setTitle(t) { o.title = t; return o; }, addMetaTag() { return o; }, setFaviconUrl() { return o; }, getContent: () => html }; return o; } },
    ScriptApp: { getService: () => ({ getUrl: () => null }) },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(HERE, 'WebApp.gs'), 'utf8'), ctx);
  return { ctx, unzips, sheets, drive };
}

let passed = 0;
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));   // values cross the vm realm
function test(name, fn) { fn(); passed++; console.log('ok', name); }

const studbook = new Sheet('Studbook', [
  ['The Studbook'], ['Every individual and where it came from…'], [],
  ['id', '', 'Name', 'Species', 'Hatched as', 'Sex', 'Gen', 'Sire', 'Dam', 'Moves', 'Inherited', 'Role', 'Origin', 'Fate', 'Status', 'Program', 'Rule check', 'Note'],
  ['S-TYRANITAR', '', 'Tyranitar-line stud', 'Tyranitar', 'Larvitar', '♂ male', 2, 'B-FERALIGATR-TYRANITAR', 'D-TYRANITAR', 'Outrage, Dragon Dance', '', 'stud', 'bred at Blackthorn', 'kept', 'planned', 'HeartGold Tyranitar', 'ok', new Date('2026-07-14T00:00:00Z')],
]);
const calls = new Sheet('Your Calls', [
  ['Your Calls'], ['What the ranch… is waiting on'], [],
  ['id', 'Area', 'Question', 'Why it matters', 'Options', 'Blocks', 'Source', 'Your call', 'Status'],
  ['Q-RANCH-1', 'ranch', 'Which satellite?', 'Blackthorn has no volcano', '• Sevii\n• Battle Zone', 'where 4 residents live', 'RANCH.md', '', 'open'],
]);
const W = world({ Studbook: studbook, 'Your Calls': calls });
const api = W.ctx;

test('doGet joins the BH- parts in order into one page', () => {
  const out = api.doGet();
  assert.equal(out.title, 'Blackthorn HQ');
  assert.match(out.html, /^<!doctype html>/i);
  assert.ok(out.html.trimEnd().endsWith('</html>'));
  assert.ok(out.html.indexOf('function shell()') < out.html.indexOf('<script>boot();</script>'));
  assert.ok(!out.html.includes('PREVIEW_DATA'), 'the preview stand-in is not in the parts');
});

test('apiData returns each data file exactly, unzipping once', () => {
  for (const name of ['hq', 'atlas', 'builds', 'scouting', 'journal', 'learnsets', 'scout', 'field', 'advance']) {
    assert.deepEqual(JSON.parse(api.apiData(name)), JSON.parse(fs.readFileSync(path.join(DATA, name + '.json'), 'utf8')));
  }
  assert.equal(W.unzips.n, 1, 'later calls come from the cache, file by file');
  assert.throws(() => api.apiData('nope'), /no nope\.json/);
});

test('apiTab finds the header under the title rows and returns dates as text', () => {
  const rows = api.apiTab('Studbook');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'S-TYRANITAR');
  assert.equal(rows[0].Name, 'Tyranitar-line stud');
  assert.equal(rows[0].Gen, 2);
  assert.equal(rows[0].Note, '2026-07-14T00:00:00.000Z');
  assert.ok('_c1' in rows[0], 'the unnamed sprite column gets a placeholder key');
  same(api.apiTab('Missing tab'), []);
});

test('apiAppend makes an app tab on first use and logs the Timeline', () => {
  const r = api.apiAppend('Eggs', { id: 'EGG-LARVITAR-1', line: 'Larvitar', sire: 'S-TYRANITAR', laid: '2026-10-20T05:00:00Z', cycles: 40, status: 'incubating', _timeline: 'A Larvitar egg went into the racks' });
  same(r, { ok: true, row: 2 });
  same(W.sheets.Eggs.rows[0], ['id', 'line', 'sire', 'laid', 'cycles', 'status']);
  const eggs = api.apiTab('Eggs');
  assert.equal(eggs[0].line, 'Larvitar'); assert.equal(eggs[0].cycles, 40);
  const tl = api.apiTab('Timeline');
  assert.equal(tl.length, 1); assert.equal(tl[0].kind, 'eggs'); assert.equal(tl[0].ref, 'EGG-LARVITAR-1');
});

test('an app tab grows a column for a new field; text is never written as a formula', () => {
  api.apiAppend('Eggs', { id: 'EGG-2', line: 'Cyndaquil', note: '=HYPERLINK("x")' });
  const eggs = api.apiTab('Eggs');
  assert.equal(W.sheets.Eggs.rows[0].at(-1), 'note');
  assert.equal(eggs[1].note, "'=HYPERLINK(\"x\")");
});

test('a hatch lands in the Studbook columns, with the sprite formula in the unnamed column', () => {
  api.apiAppend('Studbook', { id: 'H-LARVITAR-1', _sprite: 246, Name: 'Larvitar (hatched)', Species: 'Larvitar', Sex: '♂ male', Gen: 3, Sire: 'S-TYRANITAR', Dam: 'D-TYRANITAR', 'Rule check': 'ok', extra: 'ignored' });
  const row = W.sheets.Studbook.rows[5];
  assert.equal(row[0], 'H-LARVITAR-1');
  assert.match(row[1], /^=IMAGE\(".*\/246\.png", 1\)$/);
  assert.equal(row[2], 'Larvitar (hatched)'); assert.equal(row[6], 3); assert.equal(row[16], 'ok');
  assert.equal(W.sheets.Studbook.rows[3].length, 18, 'the Studbook never grows columns');
});

test('your records append a row per save and never rewrite one (My Builds keeps every version)', () => {
  api.apiAppend('My Builds', { id: 'yours:heartgold/Tyranitar', v: 2, species: 'Tyranitar', moves: 'Dragon Dance / Stone Edge / Earthquake / Outrage', evs: '0/252/0/0/4/252', _timeline: 'Saved Tyranitar v2' });
  api.apiAppend('My Builds', { id: 'yours:heartgold/Tyranitar', v: 3, species: 'Tyranitar', moves: 'Dragon Dance / Crunch / Earthquake / Outrage', evs: '' });
  const rows = api.apiTab('My Builds');
  assert.equal(rows.length, 2); assert.equal(rows[0].v, 2); assert.equal(rows[1].v, 3); assert.equal(rows[0].evs, '0/252/0/0/4/252');
  api.apiAppend('My Pokémon', { id: 'me:heartgold/Larvitar-abc', species: 'Larvitar', game: 'heartgold', shiny: 'yes' });
  api.apiAppend('My Teams', { id: 'team:abc', game: 'heartgold', slots: [{ species: 'Tyranitar', from: 'me:heartgold/Tyranitar@2' }] });
  assert.equal(api.apiTab('My Pokémon')[0].shiny, 'yes');
  assert.match(api.apiTab('My Teams')[0].slots, /^\[\{"species":"Tyranitar"/, 'objects are stored as JSON text');
});

test('a picture goes into the one artwork folder and comes back as a data URL; nothing else is ever shown', () => {
  const w = world({});
  const png = Buffer.from('fake-picture').toString('base64');
  const a = w.ctx.apiUpload('Tyranitar portrait.jpg', 'image/jpeg', png), b = w.ctx.apiUpload('second', 'image/png', png);
  assert.equal(w.drive.folders, 1, 'one folder, made once and remembered');
  assert.equal(w.ctx.apiImage(a.id), 'data:image/jpeg;base64,' + png);
  assert.ok(b.id !== a.id);
  assert.throws(() => w.ctx.apiImage('zip1'), /only shows pictures it saved/);
  assert.throws(() => w.ctx.apiUpload('x.txt', 'text/plain', png), /Only pictures/);
});

test('apiKeep saves every app tab and the drafts as a new file in its own folder, never overwriting (A-03)', () => {
  const w = world({});
  w.ctx.apiAppend('My Pokémon', { id: 'me:heartgold/Typhlosion-a1', species: 'Typhlosion', game: 'heartgold', at: '2026-10-27T10:00:00Z' });
  w.ctx.apiAppend('Journal', { at: '2026-10-27T10:00:00Z', kind: 'note', text: 'first light' });
  const a = w.ctx.apiKeep(JSON.stringify({ 'me:heartgold/Typhlosion-a1': { build: { moves: ['Eruption'] } } })), b = w.ctx.apiKeep('{}');
  assert.ok(a.id !== b.id, 'a new file each time');
  assert.match(a.name, /^Blackthorn records \d{4}-\d{2}-\d{2} \d{4}\.json$/);
  same(a.counts, { Journal: 1, 'My Pokémon': 1 });   // in APP_TABS order
  const copy = JSON.parse(w.drive.files[a.id].text);
  assert.equal(copy.tabs['My Pokémon'][0].species, 'Typhlosion');
  same(copy.drafts['me:heartgold/Typhlosion-a1'].build.moves, ['Eruption']);
  assert.equal(w.drive.folders, 1, 'one records folder, made once and remembered');
});

test('apiAppend refuses tabs outside the app', () => {
  assert.throws(() => api.apiAppend('Decisions', { id: 'D-999' }), /can't write to Decisions/);
  assert.throws(() => api.apiAppend('Locks', {}), /can't write/);
});

test('apiAnswer fills Your call and Status, and adds a row for a call the tab lacks', () => {
  api.apiAnswer('Q-RANCH-1', 'Sevii Islands', 'answered', {});
  assert.equal(calls.rows[4][7], 'Sevii Islands'); assert.equal(calls.rows[4][8], 'answered');
  api.apiAnswer('W-017', 'Approve', 'answered', { area: 'world record · Miltank', question: "The nursery's milk" });
  same(calls.rows[5].slice(0, 3), ['W-017', 'world record · Miltank', "The nursery's milk"]);
  assert.equal(calls.rows[5][6], 'Blackthorn HQ'); assert.equal(calls.rows[5][7], 'Approve');
  api.apiAnswer('Q-RANCH-1', '', 'deferred', {});
  assert.equal(calls.rows[4][8], 'deferred');
  const tl = api.apiTab('Timeline').filter(t => t.kind === 'your call');
  assert.equal(tl.length, 2, 'answers are logged; deferrals are not');
});

test('doGet explains what to do when no zip is in Drive', () => {
  const empty = world({});
  empty.ctx.DriveApp.searchFiles = () => ({ hasNext: () => false });
  empty.ctx.CacheService.getScriptCache().get = () => null;
  assert.match(empty.ctx.doGet().html, /No Blackthorn-HQ-app\.zip found/);
});

console.log(passed + ' passed');
