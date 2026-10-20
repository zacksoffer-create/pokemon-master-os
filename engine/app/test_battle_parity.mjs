// The browser's battle engine (web/27_battle.html, with @smogon/calc in the page) against Python's
// battle/scouting_report.py export_data(): every lineup and every section of the Journey Scouting File, plus the
// what-if league, number for number and sentence for sentence.
// Run: python3 -I app/battle_pack.py --parity py.json && node app/test_battle_parity.mjs py.json [--only id,id] [--no-league]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const py = JSON.parse(fs.readFileSync(args[0], 'utf8'));
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const noLeague = args.includes('--no-league') || !!only;

export function loadBattle() {
  const pack = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'battle.json'), 'utf8'));
  const calc = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'calc.json'), 'utf8'));
  const code = fs.readFileSync(path.join(HERE, 'web', '27_battle.html'), 'utf8').replace(/^<script>/, '').replace(/<\/script>\s*$/, '');
  const ctx = { console, Buffer };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(calc.code, ctx);
  vm.runInContext(code + '\nthis.Battle = Battle;', ctx);
  ctx.Battle.init(pack, ctx.calc);
  return ctx.Battle;
}

const strip = (v) => Array.isArray(v) ? v.map(strip) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('_')).map(([k, x]) => [k, strip(x)])) : v;
let bad = 0, checked = 0;
function diff(where, a, b, out) {
  if (out.length > 6) return;
  if (Array.isArray(b) || Array.isArray(a)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) { out.push([where, a, b]); return; }
    b.forEach((x, i) => diff(`${where}[${i}]`, a[i], x, out)); return;
  }
  if (b && typeof b === 'object' && a && typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    for (const k of new Set([...ka, ...kb])) diff(`${where}.${k}`, a[k], b[k], out);
    return;
  }
  if (!(a === b || (a == null && b == null))) out.push([where, a, b]);
}
function same(where, a, b) {
  checked++;
  const out = []; diff(where, strip(a), b, out);
  if (out.length) {
    bad++;
    if (bad <= 30) for (const [w, x, y] of out.slice(0, 6)) console.log('DIFF', w, '\n  py:', JSON.stringify(y)?.slice(0, 400), '\n  js:', JSON.stringify(x)?.slice(0, 400));
  }
}

const Battle = loadBattle();
const eng = Battle.engine();
const t0 = Date.now();
const lineups = py.inputs.lineups.filter((lu) => !only || only.includes(lu.id));
const coaches = py.inputs.coaches;
const got = {};
for (const lu of lineups) {
  const t = Date.now();
  const d = eng.chapter(lu, coaches[lu.id]);
  got[lu.id] = d;
  const p = py.lineups.find((x) => x.id === lu.id);
  for (const f of ['id', 'chapter', 'game', 'title', 'thesis', 'status', 'decision', 'variation']) same(`${lu.id} ${f}`, d[f], p[f]);
  d.cards.forEach((c, i) => same(`${lu.id} card ${c.species}`, c, p.cards[i]));
  same(`${lu.id} sheets`, d.sheets.length, p.sheets.length);
  d.sheets.forEach((s, i) => {
    const q = p.sheets[i];
    for (const f of ['opponent', 'game', 'source', 'level', 'lead', 'anchors', 'no_answer', 'record', 'movesets']) same(`${lu.id} vs ${s.opponent} ${f}`, s[f], q[f]);
    same(`${lu.id} vs ${s.opponent} trainer_phrases`, s.trainer_phrases, q.trainer_phrases);
    s.calls.forEach((r, j) => same(`${lu.id} vs ${s.opponent} call ${j} ${r.species}`, r, q.calls[j]));
    same(`${lu.id} vs ${s.opponent} advance`, s.advance, q.advance);
    same(`${lu.id} vs ${s.opponent} plan`, s.plan, q.plan);
    (s.situations || []).forEach((r, j) => same(`${lu.id} vs ${s.opponent} situation ${j} ${r.theirs}`, r, q.situations[j]));
  });
  same(`${lu.id} self_scout`, d.self_scout, p.self_scout);
  if (d.profile) {
    for (const f of ['gen', 'field_n', 'sliders', 'percentiles', 'philosophy', 'record', 'coach']) same(`${lu.id} profile ${f}`, d.profile[f], p.profile[f]);
    for (const [name, m] of Object.entries(d.profile.members)) same(`${lu.id} profile member ${name}`, m, p.profile.members[name]);
    same(`${lu.id} profile members`, Object.keys(d.profile.members), Object.keys(p.profile.members));
  }
  console.log(`${lu.id}: ${((Date.now() - t) / 1000).toFixed(1)} s`, JSON.stringify(eng.stats()));
}
if (!noLeague) {
  const t = Date.now();
  const teams = Object.fromEntries(lineups.map((lu) => [lu.id, got[lu.id].members]));
  const league = eng.league(teams);
  same('league', league, py.league);
  console.log(`league: ${((Date.now() - t) / 1000).toFixed(1)} s`);
}
console.log(`${checked - bad}/${checked} sections match Python; ${((Date.now() - t0) / 1000).toFixed(1)} s in all`, JSON.stringify(eng.stats()));
process.exit(bad ? 1 : 0);
