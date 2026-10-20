/**
 * Blackthorn HQ: the web app (docs/APP.md). A second script file in the same Apps Script project as Code.gs.
 *
 * The app itself lives in one zip on your Google Drive (Blackthorn-HQ-app.zip, built by engine/app/build.py): the
 * page in parts (BH-*.html) and the engine's data (hq, atlas, builds, scouting, journal, learnsets .json). This file:
 *   - doGet: finds the newest Blackthorn-HQ-app*.zip in your Drive, joins its BH- parts in order, serves the page;
 *   - apiData(name): one of the data files, as JSON text;
 *   - apiTab(name): the rows of a tab of this Sheet, as objects keyed by its header row;
 *   - apiAppend(tab, obj): adds a row to one of the app's tabs (made on first use), and a line to the Timeline;
 *   - apiAnswer(id, text, status, meta): writes your call into the Your Calls tab.
 *
 * To update the app, upload a newer zip to Drive. The newest one wins; older ones can stay (or go to History).
 * Deploy: Deploy → New deployment → Web app → Execute as: Me · Who has access: Only myself.
 */

var APP_ZIP = 'Blackthorn-HQ-app';            // the zip's name starts with this; the newest one is used
var APP_TABS = ['Eggs', 'Egg Walks', 'Plantings', 'Harvests', 'Readings', 'Feedings', 'Journal', 'Timeline', 'Specimens'];
var WRITABLE = APP_TABS.concat(['Studbook']);
var CALLS = 'Your Calls';
var CHUNK = 30000;                            // characters per cache entry (100 KB per value, even if every one is 3 bytes)

// --- serving the page ---------------------------------------------------------------------------------------------
function doGet() {
  var files = appFiles_();
  var names = Object.keys(files).filter(function (n) { return /^BH-.*\.html$/.test(n); }).sort();
  if (!names.length) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">No ' + APP_ZIP + '.zip found in your Google ' +
      'Drive. Upload the zip from the project (engine/app/dist) to Drive, then reload this page.</p>');
  }
  return HtmlService.createHtmlOutput(names.map(function (n) { return files[n]; }).join(''))
    .setTitle('Blackthorn HQ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dragon-fang.png');
}

/** Every file in the newest app zip, name → text. Unzipped once per zip and kept in the script cache. */
function appFiles_() {
  var zip = newestZip_();
  if (!zip) return {};
  var key = 'z' + zip.getId() + zip.getLastUpdated().getTime();
  var hit = cacheGet_(key);
  if (hit) return JSON.parse(hit);
  var out = {};
  Utilities.unzip(zip.getBlob().setContentType('application/zip')).forEach(function (b) {
    var name = b.getName().split('/').pop();
    if (name && name.charAt(0) !== '.') out[name] = b.getDataAsString('UTF-8');
  });
  cachePut_(key, JSON.stringify(out));
  return out;
}

function newestZip_() {
  var c = CacheService.getScriptCache(), id = c.get('zipid');
  if (id) { try { return DriveApp.getFileById(id); } catch (e) {} }
  var it = DriveApp.searchFiles("title contains '" + APP_ZIP + "' and trashed = false"), best = null;
  while (it.hasNext()) {
    var f = it.next();
    if (!/\.zip$/i.test(f.getName())) continue;
    if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f;
  }
  if (best) c.put('zipid', best.getId(), 120);   // look again after two minutes, so a new upload is picked up
  return best;
}

function cacheGet_(key) {
  var c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(key + ':' + i);
  var got = c.getAll(keys), parts = [];
  for (var j = 0; j < n; j++) { if (got[keys[j]] == null) return null; parts.push(got[keys[j]]); }
  return parts.join('');
}

function cachePut_(key, text) {
  var o = {}, n = Math.ceil(text.length / CHUNK);
  for (var i = 0; i < n; i++) o[key + ':' + i] = text.substr(i * CHUNK, CHUNK);
  o[key] = String(n);
  try { CacheService.getScriptCache().putAll(o, 21600); } catch (e) { /* too big to cache: read the zip each time */ }
}

// --- the data API (called from the page with google.script.run) ---------------------------------------------------
/** One of the engine's data files (hq, atlas, builds, scouting, journal, learnsets), as JSON text. */
function apiData(name) {
  var text = appFiles_()[String(name) + '.json'];
  if (text == null) throw new Error('The app zip has no ' + name + '.json. Rebuild it with engine/app/build.py.');
  return text;
}

/** The rows of a tab as objects keyed by its header row (the first row with 3+ filled cells in its first six). */
function apiTab(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(String(name));
  if (!sh || sh.getLastRow() < 1) return [];
  var vals = sh.getDataRange().getValues(), h = headerRow_(vals);
  if (h < 0) return [];
  var head = vals[h].map(function (x, i) { return String(x).trim() || '_c' + i; }), out = [];
  for (var r = h + 1; r < vals.length; r++) {
    if (!vals[r].some(function (x) { return x !== '' && x !== null; })) continue;
    var o = {};
    head.forEach(function (k, i) { var v = vals[r][i]; o[k] = v instanceof Date ? v.toISOString() : v; });
    out.push(o);
  }
  return out;
}

function headerRow_(vals) {
  for (var r = 0; r < Math.min(vals.length, 12); r++) {
    var filled = vals[r].slice(0, 6).filter(function (x) { return String(x).trim() !== ''; }).length;
    if (filled >= 3) return r;
  }
  return -1;
}

/** Adds a row to one of the app's tabs. Keys that start with _ aren't columns (_timeline, _sprite). */
function apiAppend(tab, obj) {
  tab = String(tab);
  if (WRITABLE.indexOf(tab) < 0) throw new Error('The app can\'t write to ' + tab + '.');
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    var row = appendRow_(tab, obj || {});
    if (obj && obj._timeline && tab !== 'Timeline') {
      appendRow_('Timeline', {at: new Date().toISOString(), kind: tab.toLowerCase(), text: obj._timeline, ref: obj.id || ''});
    }
    return {ok: true, row: row};
  } finally {
    lock.releaseLock();
  }
}

function appendRow_(tab, obj) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(tab);
  var keys = Object.keys(obj).filter(function (k) { return k.charAt(0) !== '_'; });
  if (!sh) {                                   // an app tab, made on first use with these columns
    sh = ss.insertSheet(tab);
    sh.getRange(1, 1, 1, keys.length).setValues([keys]).setFontWeight('bold').setBackground('#15171C').setFontColor('#C9A96A');
    sh.setFrozenRows(1);
  }
  var vals = sh.getDataRange().getValues(), h = headerRow_(vals);
  if (h < 0) { sh.getRange(1, 1, 1, keys.length).setValues([keys]); vals = [keys]; h = 0; }
  var head = vals[h].map(function (x) { return String(x).trim(); });
  if (APP_TABS.indexOf(tab) >= 0) {             // the app's own tabs grow a column for a new field
    keys.forEach(function (k) { if (head.indexOf(k) < 0) { head.push(k); sh.getRange(h + 1, head.length).setValue(k).setFontWeight('bold'); } });
  }
  var line = head.map(function (k, i) {
    if (k === '' && obj._sprite) return '=IMAGE("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver/' + Number(obj._sprite) + '.png", 1)';
    var v = obj[k];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') v = JSON.stringify(v);
    return typeof v === 'string' && /^[=+]/.test(v) ? "'" + v : v;   // text, never a formula
  });
  var at = Math.max(sh.getLastRow() + 1, h + 2);
  sh.getRange(at, 1, 1, line.length).setValues([line]);
  return at;
}

/** Writes your call (and its status) into the Your Calls tab; a call that isn't there yet gets a row. */
function apiAnswer(id, text, status, meta) {
  meta = meta || {};
  var sh = SpreadsheetApp.getActive().getSheetByName(CALLS);
  if (!sh) throw new Error('This Sheet has no ' + CALLS + ' tab.');
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    var vals = sh.getDataRange().getValues(), h = headerRow_(vals);
    var head = vals[h].map(function (x) { return String(x).trim(); });
    var cId = head.indexOf('id'), cCall = head.indexOf('Your call'), cStatus = head.indexOf('Status');
    var safe = /^[=+]/.test(String(text)) ? "'" + text : String(text || '');
    var row = -1;
    for (var r = h + 1; r < vals.length; r++) if (String(vals[r][cId]) === String(id)) { row = r + 1; break; }
    if (row < 0) {
      var line = head.map(function (k) { return {id: id, Area: meta.area || 'from the app', Question: meta.question || '', Source: 'Blackthorn HQ'}[k] || ''; });
      row = Math.max(sh.getLastRow() + 1, h + 2);
      sh.getRange(row, 1, 1, line.length).setValues([line]);
    }
    sh.getRange(row, cCall + 1).setValue(safe);
    sh.getRange(row, cStatus + 1).setValue(status || 'answered');
    if (status === 'answered') appendRow_('Timeline', {at: new Date().toISOString(), kind: 'your call', text: id + ': ' + text, ref: id});
    return {ok: true, row: row};
  } finally {
    lock.releaseLock();
  }
}

/** Menu helper (Code.gs): the deployed web app's address, or how to deploy it. */
function showWebApp() {
  var url = null;
  try { url = ScriptApp.getService().getUrl(); } catch (e) {}
  var html = url ? '<p>Open <a href="' + url + '" target="_blank">Blackthorn HQ</a> (bookmark it).</p>'
                 : '<p>Not deployed yet: Deploy → New deployment → Web app → Execute as Me, access Only myself.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<div style="font-family:Arial,sans-serif;font-size:14px">' + html + '</div>')
    .setWidth(360).setHeight(120), 'Blackthorn HQ');
}
