// Prints the optimized spreads as Markdown, straight from fixtures/optimizer/*.json and *.confirm.json (used in
// docs/EV_OPTIMIZER.md, so the numbers there are the recorded ones).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/optimizer', f), 'utf8'));
const pct = (x) => (x == null ? '—' : `${Math.round(1000 * x) / 10}%`);
const sgn = (x) => `${x > 0 ? '+' : ''}${x}`;
for (const game of ['heartgold', 'soulsilver', 'platinum']) {
  const rep = read(`${game}.json`);
  const conf = fs.existsSync(path.join(ROOT, 'fixtures/optimizer', `${game}.confirm.json`)) ? read(`${game}.confirm.json`) : null;
  console.log(`\n### ${game[0].toUpperCase() + game.slice(1)} (against ${rep.pool.replace('pool:', '')}, ${rep.members[0].score.of} opponent Pokémon)\n`);
  console.log('| Pokémon | Nature | Plays | Duel-model spread | Duel model, fresh wins (worst / typical): duel · conventional | 6v6: wins, duel vs conventional | HP margin, conventional − duel (95%) | p |');
  console.log('|---|---|---|---|---|---|---|---|');
  rep.members.forEach((m, i) => {
    const c = conf?.rows[i];
    const kept = !c ? 'duel' : c.kept;
    const plays = kept === 'conventional' ? `**conventional** (${m.conventional.label})` : `**duel**`;
    const model = `${m.score.wins_worst} / ${m.score.wins_typical} · ${m.conventional.wins_worst} / ${m.conventional.wins_typical}`;
    const wins = !c ? 'not run' : c.duel ? `${pct(c.duel.win_rate)} vs ${pct(c.conventional.win_rate)}` : c.note;
    const margin = c?.margin ? `${sgn(c.margin.y_minus_x)} [${c.margin.ci95.join(', ')}]` : '—';
    console.log(`| ${m.species} | ${m.nature}${m.nature_chosen ? ' (chosen)' : ''} | ${plays} | ${m.label} | ${model} | ${wins} | ${margin} | ${c?.mcnemar_p ?? '—'} |`);
  });
}
