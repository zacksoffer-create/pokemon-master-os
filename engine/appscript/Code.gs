/**
 * Blackthorn: the Apps Script for the Pokémon Master Canon DB Sheet (docs/BLACKTHORN.md).
 *
 * The Sheet itself is built by the engine (engine/ranch/sheet.py) and works without this script. The script adds:
 *   - the Blackthorn menu: go to the dashboard, the lineage tree, record a hatch, check the studbook;
 *   - a guard on locked rows (HeartGold's six, D-006): an edit there is undone, with a note why.
 *
 * The rules (studbookIssues, crossIssues) are plain functions with no Sheets calls in them, so they're tested with
 * node outside Google (engine/appscript/test_rules.mjs). They mirror engine/breeding/lineage.py: parents exist; the
 * sire can be male and the dam female (or one is Ditto); they share an egg group; the egg hatches as the dam's line;
 * the generation is one past the older parent; nobody is their own ancestor; four moves at most. Egg moves need the
 * learnsets, so the engine checks those.
 */

var STUDBOOK = 'Studbook', REFERENCE = 'Reference', DASHBOARD = 'Blackthorn', JOURNEY = 'Journey';
var FIRST_ROW = 5;                         // row 4 is the header; data starts on row 5
var COLS = ['id', 'sprite', 'name', 'species', 'hatched_as', 'sex', 'generation', 'sire', 'dam', 'moves',
            'inherited', 'role', 'origin', 'fate', 'status', 'program', 'check', 'note'];
var SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iv/heartgold-soulsilver/';
var LOCKED_CHAPTERS = ['HeartGold'];

// --- the menu -------------------------------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Blackthorn')
    .addItem('Go to the dashboard', 'goToDashboard')
    .addItem('Open Blackthorn HQ (the web app)', 'showWebApp')
    .addSeparator()
    .addItem('Show the lineage tree (selected Studbook row)', 'showTree')
    .addItem('Record a hatch…', 'showHatchForm')
    .addItem('Check the studbook', 'checkStudbook')
    .addSeparator()
    .addItem('About this Sheet', 'showAbout')
    .addToUi();
}

function goToDashboard() {
  var ss = SpreadsheetApp.getActive();
  ss.setActiveSheet(ss.getSheetByName(DASHBOARD)).setActiveSelection('B1');
}

// --- reading the Sheet ------------------------------------------------------------------------------------------
function readStudbook_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(STUDBOOK);
  var last = sh.getLastRow();
  if (last < FIRST_ROW) return [];
  var vals = sh.getRange(FIRST_ROW, 1, last - FIRST_ROW + 1, COLS.length).getValues();
  return rowsToRecords(vals, FIRST_ROW);
}

function readReference_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(REFERENCE);
  return referenceIndex(sh.getRange(2, 1, 493, 5).getValues());
}

// --- the rules (no Sheets calls below this line until the UI section) -------------------------------------------
function rowsToRecords(vals, firstRow) {
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i];
    if (!v[0]) continue;
    var r = {row: firstRow + i};
    for (var j = 0; j < COLS.length; j++) r[COLS[j]] = v[j];
    r.sex = parseSex(r.sex);
    r.generation = r.generation === '' || r.generation === null ? null : Number(r.generation);
    r.moves = String(r.moves || '').split(',').map(function (m) { return m.trim(); }).filter(String);
    out.push(r);
  }
  return out;
}

function referenceIndex(rows) {
  var ref = {};
  rows.forEach(function (r) {
    if (!r[0]) return;
    ref[r[0]] = {dex: Number(r[1]), groups: String(r[2]).split(',').map(function (g) { return g.trim(); })
      .filter(function (g) { return g && g !== 'No Eggs'; }), rate: Number(r[3]), hatchesAs: r[4]};
  });
  return ref;
}

function parseSex(s) {
  s = String(s || '').toLowerCase();
  if (s.indexOf('female') >= 0 || s.indexOf('♀') >= 0) return 'female';
  if (s.indexOf('genderless') >= 0) return 'genderless';
  if (s.indexOf('male') >= 0 || s.indexOf('♂') >= 0) return 'male';
  return 'open';
}

function canBe(ref, species, sex) {
  var s = ref[species];
  if (!s) return true;                       // a species the Reference doesn't know isn't judged here
  if (species === 'Ditto') return sex === 'genderless';
  if (sex === 'male') return s.rate !== -1 && s.rate !== 8;
  if (sex === 'female') return s.rate !== -1 && s.rate !== 0;
  if (sex === 'genderless') return s.rate === -1;
  return true;
}

function shareGroup(ref, a, b) {
  var ga = (ref[a] || {}).groups || [], gb = (ref[b] || {}).groups || [];
  return ga.some(function (g) { return gb.indexOf(g) >= 0; });
}

/** What's wrong with one cross: a sire, a dam and the child they'd make. Records are {species, sex, generation}. */
function crossIssues(ref, sire, dam, child) {
  var bad = [];
  if (!sire) bad.push('no sire'); if (!dam) bad.push('no dam');
  if (!sire || !dam) return bad;
  var ditto = sire.species === 'Ditto' || dam.species === 'Ditto';
  if (sire.species === 'Ditto' && dam.species === 'Ditto') bad.push('two Ditto make no egg');
  if (!ditto) {
    if (!canBe(ref, sire.species, 'male')) bad.push('the sire (' + sire.species + ') can\'t be male');
    if (!canBe(ref, dam.species, 'female')) bad.push('the dam (' + dam.species + ') can\'t be female');
    if (sire.sex === 'female') bad.push('the sire is recorded female');
    if (dam.sex === 'male') bad.push('the dam is recorded male');
    if (!shareGroup(ref, sire.species, dam.species)) bad.push(sire.species + ' and ' + dam.species + ' share no egg group');
  }
  [sire, dam].forEach(function (p) {
    if (ref[p.species] && !(ref[p.species].groups || []).length) bad.push(p.species + ' can\'t breed (No Eggs)');
  });
  if (child && child.species) {
    var mother = dam.species === 'Ditto' ? sire.species : dam.species;
    var want = (ref[mother] || {}).hatchesAs, got = (ref[child.species] || {}).hatchesAs;
    if (want && got && want !== got) bad.push('an egg from a ' + mother + ' hatches as ' + want + ', not ' + got);
    var gen = Math.max(sire.generation || 0, dam.generation || 0) + 1;
    if (child.generation !== null && child.generation !== undefined && child.generation !== gen) {
      bad.push('generation ' + child.generation + ', should be ' + gen + ' (one past the older parent)');
    }
    if (child.sex && child.sex !== 'open' && !canBe(ref, child.species, child.sex)) {
      bad.push(child.species + ' can\'t be ' + child.sex);
    }
  }
  return bad;
}

/** Every record's problems: {id: [why, …]}. */
function studbookIssues(records, ref) {
  var by = {}, out = {};
  records.forEach(function (r) { by[r.id] = r; });
  records.forEach(function (r) {
    var bad = [];
    if (r.sex !== 'open' && !canBe(ref, r.species, r.sex)) bad.push(r.species + ' can\'t be ' + r.sex);
    if (r.moves.length > 4) bad.push(r.moves.length + ' moves, over 4');
    if (r.sire && !by[r.sire]) bad.push('sire ' + r.sire + ' isn\'t in the studbook');
    if (r.dam && !by[r.dam]) bad.push('dam ' + r.dam + ' isn\'t in the studbook');
    if (by[r.sire] && by[r.dam]) bad = bad.concat(crossIssues(ref, by[r.sire], by[r.dam], r));
    var seen = {}, stack = [r.sire, r.dam];
    while (stack.length) {
      var p = stack.pop();
      if (!p || seen[p]) continue;
      if (p === r.id) { bad.push('is its own ancestor'); break; }
      seen[p] = true;
      if (by[p]) stack.push(by[p].sire, by[p].dam);
    }
    out[r.id] = bad;
  });
  return out;
}

/** The ancestors of one record as a nested object, `depth` levels up. */
function pedigree(records, id, depth) {
  var by = {};
  records.forEach(function (r) { by[r.id] = r; });
  function up(i, d) {
    var r = by[i];
    if (!r) return null;
    var node = {id: r.id, name: r.name, species: r.species, hatched_as: r.hatched_as, sex: r.sex,
                generation: r.generation, moves: r.moves, fate: r.fate, status: r.status};
    if (d > 0) { node.sire = up(r.sire, d - 1); node.dam = up(r.dam, d - 1); }
    return node;
  }
  return up(id, depth === undefined ? 4 : depth);
}

function descendants(records, id) {
  var out = [], frontier = [id], seen = {};
  while (frontier.length) {
    var next = [];
    records.forEach(function (r) {
      if (!seen[r.id] && (frontier.indexOf(r.sire) >= 0 || frontier.indexOf(r.dam) >= 0)) {
        seen[r.id] = true; out.push(r); next.push(r.id);
      }
    });
    frontier = next;
  }
  return out;
}

/** The next free id for a hatch of a line: H-<LINE>-<n>. */
function nextHatchId(records, line) {
  var key = String(line).toUpperCase().replace(/[^A-Z0-9]/g, ''), n = 1;
  records.forEach(function (r) {
    var m = String(r.id).match(new RegExp('^H-' + key + '-(\\d+)$'));
    if (m) n = Math.max(n, Number(m[1]) + 1);
  });
  return 'H-' + key + '-' + n;
}

/** The Studbook row for a new hatch, as cell values in COLS order. */
function hatchRow(records, ref, form) {
  var by = {};
  records.forEach(function (r) { by[r.id] = r; });
  var sire = by[form.sire], dam = by[form.dam];
  var mother = dam && dam.species === 'Ditto' ? (sire || {}).species : (dam || {}).species;
  var species = form.species || (ref[mother] || {}).hatchesAs || mother;
  var line = (ref[species] || {}).hatchesAs || species;
  var gen = Math.max((sire || {}).generation || 0, (dam || {}).generation || 0) + 1;
  var child = {species: species, sex: parseSex(form.sex), generation: gen};
  var issues = crossIssues(ref, sire, dam, child);
  var inherited = String(form.inherited || '').split(',').map(function (m) { return m.trim(); }).filter(String);
  var dex = (ref[line] || {}).dex;
  var sexLabel = {male: '♂ male', female: '♀ female', genderless: 'genderless', open: 'open'}[child.sex];
  return {issues: issues, id: nextHatchId(records, line), values: [
    nextHatchId(records, line), dex ? '=IMAGE("' + SPRITE + dex + '.png", 1)' : '',
    form.name || (line + ' (hatched)'), species, line, sexLabel, gen, form.sire, form.dam, inherited.join(', '),
    inherited.map(function (m) { return m + ' (from ' + ((sire || {}).name || form.sire) + ')'; }).join('; '),
    'hatchling', 'bred at Blackthorn', form.fate || 'open', 'hatched', (sire || {}).program || (dam || {}).program || '',
    issues.length ? issues.join('; ') : 'ok', form.note || '']};
}

// --- UI (Sheets calls) --------------------------------------------------------------------------------------------
function showTree() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet();
  var records = readStudbook_(), id = null;
  if (sh.getName() === STUDBOOK && sh.getActiveRange().getRow() >= FIRST_ROW) {
    id = sh.getRange(sh.getActiveRange().getRow(), 1).getValue();
  }
  if (!id) {
    var stud = records.filter(function (r) { return r.role === 'stud'; })[0];
    id = stud ? stud.id : (records[0] || {}).id;
  }
  var ref = readReference_();
  var t = HtmlService.createTemplateFromFile('Tree');
  t.data = JSON.stringify({tree: pedigree(records, id, 3), children: descendants(records, id).map(function (r) {
    return {id: r.id, name: r.name, generation: r.generation}; }), sprite: SPRITE,
    dex: Object.keys(ref).reduce(function (o, k) { o[k] = ref[k].dex; return o; }, {})});
  SpreadsheetApp.getUi().showModelessDialog(t.evaluate().setWidth(980).setHeight(560), 'Lineage: ' + id);
}

function showHatchForm() {
  var records = readStudbook_();
  var t = HtmlService.createTemplateFromFile('Hatch');
  t.data = JSON.stringify({
    parents: records.map(function (r) { return {id: r.id, name: r.name, species: r.species, sex: r.sex}; }),
    species: Object.keys(readReference_()).sort()});
  SpreadsheetApp.getUi().showModalDialog(t.evaluate().setWidth(560).setHeight(640), 'Record a hatch');
}

/** Called from Hatch.html. Checks the cross, appends the row, returns what happened. */
function recordHatch(form) {
  var records = readStudbook_(), ref = readReference_();
  var out = hatchRow(records, ref, form);
  if (out.issues.length && !form.anyway) return {ok: false, issues: out.issues};
  var sh = SpreadsheetApp.getActive().getSheetByName(STUDBOOK);
  var row = Math.max(sh.getLastRow() + 1, FIRST_ROW);
  sh.getRange(row, 1, 1, out.values.length).setValues([out.values]);
  sh.setRowHeight(row, 56);
  return {ok: true, id: out.id, row: row, issues: out.issues};
}

function checkStudbook() {
  var records = readStudbook_(), ref = readReference_();
  var issues = studbookIssues(records, ref), sh = SpreadsheetApp.getActive().getSheetByName(STUDBOOK);
  var col = COLS.indexOf('check') + 1, bad = 0;
  records.forEach(function (r) {
    var why = issues[r.id] || [];
    var engine = String(r.check || '');
    // keep the engine's egg-move findings; replace only what this script can judge
    var text = why.length ? why.join('; ') : (engine && engine !== 'ok' && engine.indexOf('egg move') >= 0 ? engine : 'ok');
    if (text !== 'ok') bad++;
    sh.getRange(r.row, col).setValue(text);
  });
  SpreadsheetApp.getActive().toast(records.length + ' individuals checked; ' + bad + ' with something to fix.',
                                   'Studbook', 8);
}

function showAbout() {
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:Lexend,Arial,sans-serif;font-size:13px;line-height:1.5;color:#1B2230">' +
    '<p><b>Blackthorn</b> is the Canon DB for the Pokémon Master project (D-025). The engine builds the derived ' +
    'tabs from canon; what you add or change is authored, and reaches canon when you tell Claude.</p>' +
    '<p>Locked: HeartGold\'s six (D-006). Edits there are undone.</p>' +
    '<p>Also published: the Trainer Scouting Reports and the Ladder Builds Book (links in the project docs).</p>' +
    '</div>').setWidth(420).setHeight(220);
  SpreadsheetApp.getUi().showModalDialog(html, 'About this Sheet');
}

// --- the lock guard -------------------------------------------------------------------------------------------------
/** A simple trigger: an edit to a locked row is undone (single-cell edits; a paste over many cells gets a warning). */
function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet(), row = e.range.getRow();
  if (row < FIRST_ROW) return;
  var locked = false;
  if (sh.getName() === JOURNEY) {
    locked = LOCKED_CHAPTERS.indexOf(String(sh.getRange(row, 2).getValue())) >= 0;
  } else if (sh.getName() === STUDBOOK) {
    locked = String(sh.getRange(row, COLS.indexOf('status') + 1).getValue()) === 'locked';
  }
  if (!locked) return;
  if (e.range.getNumRows() === 1 && e.range.getNumColumns() === 1) {
    e.range.setValue(e.oldValue === undefined ? '' : e.oldValue);
    SpreadsheetApp.getActive().toast('That row is locked (HeartGold\'s six, D-006). It needs a reopen decision first.',
                                     'Locked', 8);
  } else {
    SpreadsheetApp.getActive().toast('You changed several cells in a locked row. Undo (Ctrl+Z) unless a reopen ' +
                                     'decision exists.', 'Locked', 10);
  }
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

if (typeof module !== 'undefined') {           // node tests (engine/appscript/test_rules.mjs)
  module.exports = {rowsToRecords: rowsToRecords, referenceIndex: referenceIndex, parseSex: parseSex, canBe: canBe,
                    crossIssues: crossIssues, studbookIssues: studbookIssues, pedigree: pedigree,
                    descendants: descendants, nextHatchId: nextHatchId, hatchRow: hatchRow, COLS: COLS};
}
