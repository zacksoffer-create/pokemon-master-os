// The Apps Script's rules, run with node against the data the Sheet holds (make_fixture.py writes fixture.json).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = new URL('.', import.meta.url).pathname;
const code = fs.readFileSync(here + 'Code.gs', 'utf8');
const sandbox = {module: {exports: {}}};
vm.runInNewContext(code, sandbox);
const R = sandbox.module.exports;
const fx = JSON.parse(fs.readFileSync(here + 'fixture.json', 'utf8'));
const ref = R.referenceIndex(fx.reference);
const records = R.rowsToRecords(fx.studbook, 5);
let n = 0;
const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));   // arrays from the script's own realm
const test = (name, fn) => { fn(); n++; console.log('ok', name); };

test('the studbook as built has no problems the script can see', () => {
  const issues = R.studbookIssues(records, ref);
  const bad = Object.entries(issues).filter(([, v]) => v.length);
  same(bad, []);
});

test('sexes are read from the Sheet labels', () => {
  assert.equal(R.parseSex('♂ male'), 'male');
  assert.equal(R.parseSex('♀ female'), 'female');
  assert.equal(R.parseSex('open'), 'open');
});

test('a broken studbook is caught', () => {
  const broken = records.map(r => ({...r, moves: [...r.moves]}));
  const by = Object.fromEntries(broken.map(r => [r.id, r]));
  by['S-TYRANITAR'].generation = 7;                                   // wrong generation
  by['HG-SNORLAX'].sex = 'genderless';                                // impossible sex
  by['S-GENGAR'].sire = 'NOBODY';                                     // missing parent
  by['F-NUZLEAF-TYPHLOSION'].sire = 'S-TYPHLOSION';                   // a loop
  by['F-NUZLEAF-TYPHLOSION'].dam = 'D-TYPHLOSION';
  by['S-SCIZOR'].dam = 'HG-CROBAT';                                   // Bug x Flying: shares Bug? no: Scizor is Bug
  const issues = R.studbookIssues(broken, ref);
  assert.match(issues['S-TYRANITAR'].join(), /generation 7, should be 2/);
  assert.match(issues['HG-SNORLAX'].join(), /can't be genderless/);
  assert.match(issues['S-GENGAR'].join(), /isn't in the studbook/);
  assert.match(issues['S-TYPHLOSION'].join(), /its own ancestor/);
  assert.match(issues['S-SCIZOR'].join(), /hatches as Zubat|share no egg group/);
});

test('the cross rules: sexes, Ditto, groups, the dam\'s line', () => {
  const sire = {species: 'Kingdra', sex: 'male', generation: 0}, dam = {species: 'Feraligatr', sex: 'female', generation: 0};
  same(R.crossIssues(ref, sire, dam, {species: 'Feraligatr', sex: 'male', generation: 1}), []);
  assert.match(R.crossIssues(ref, {species: 'Miltank', generation: 0}, dam, null).join(), /can't be male/);
  assert.match(R.crossIssues(ref, sire, {species: 'Tauros', generation: 0}, null).join(), /can't be female/);
  assert.match(R.crossIssues(ref, {species: 'Pikachu', generation: 0}, {species: 'Crobat', generation: 0}, null).join(),
               /share no egg group/);
  assert.match(R.crossIssues(ref, sire, dam, {species: 'Horsea', generation: 1}).join(), /hatches as Totodile/);
  same(R.crossIssues(ref, {species: 'Ditto', generation: 0}, {species: 'Magnezone', generation: 0},
                                 {species: 'Magnemite', generation: 1}), []);              // Ditto breeds the genderless
  assert.match(R.crossIssues(ref, {species: 'Mewtwo', generation: 0}, {species: 'Ditto', generation: 0}, null).join(),
               /No Eggs/);
});

test('a hatch row: id, line, generation and sprite', () => {
  const form = {sire: 'S-TYRANITAR', dam: 'D-TYRANITAR', sex: 'female', inherited: 'Dragon Dance, Outrage'};
  const out = R.hatchRow(records, ref, form);
  same(out.issues, []);
  const v = Object.fromEntries(R.COLS.map((c, i) => [c, out.values[i]]));
  assert.equal(v.id, 'H-LARVITAR-1');
  assert.equal(v.species, 'Larvitar');
  assert.equal(v.generation, 3);
  assert.match(v.sprite, /246\.png/);
  assert.equal(v.check, 'ok');
  assert.match(v.inherited, /Dragon Dance \(from Tyranitar-line stud\)/);
});

test('the pedigree goes three generations up from the Tyranitar stud', () => {
  const t = R.pedigree(records, 'S-TYRANITAR', 3);   // the bridge father is the FireRed Charizard: a companion who reaches HeartGold by Pal Park (D-067 d)
  assert.equal(t.sire.id, 'B-CHARIZARD-TYRANITAR');
  assert.equal(t.sire.sire.id, 'F-KINGDRA-TYRANITAR');
  assert.equal(t.dam.id, 'D-TYRANITAR');
  same(R.descendants(records, 'F-KINGDRA-TYRANITAR').map(r => r.id), ['B-CHARIZARD-TYRANITAR', 'S-TYRANITAR']);
});

console.log(`${n} tests passed`);
