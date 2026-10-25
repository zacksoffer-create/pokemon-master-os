// Prints the optimized spreads as Markdown, straight from fixtures/optimizer/*.json and *.confirm.json (used in
// docs/EV_OPTIMIZER.md, so the numbers there are the recorded ones).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/optimizer', f), 'utf8'));
const pct = (x) => (x == null ? '—' : `${Math.round(1000 * x) / 10}%`);
for (const game of ['heartgold', 'soulsilver', 'platinum']) {
  const rep = read(`${game}.json`);
  const conf = fs.existsSync(path.join(ROOT, 'fixtures/optimizer', `${game}.confirm.json`)) ? read(`${game}.confirm.json`) : null;
  console.log(`\n### ${game[0].toUpperCase() + game.slice(1)} (against ${rep.pool.replace('pool:', '')}, ${rep.members[0].score.of} opponent Pokémon)\n`);
  console.log('| Pokémon | Nature | Spread | Duel score (fresh wins, worst / typical) | Best template · 85 each | 6v6 check: wins, duel vs conventional · HP margin, conventional − duel (95%) | Kept |');
  console.log('|---|---|---|---|---|---|---|');
  rep.members.forEach((m, i) => {
    const c = conf?.rows[i];
    const check = !c ? 'not run' : c.duel ? `${pct(c.duel.win_rate)} vs ${pct(c.conventional.win_rate)} · ${c.margin.y_minus_x > 0 ? '+' : ''}${c.margin.y_minus_x} [${c.margin.ci95.join(', ')}]` : c.note;
    const kept = !c ? 'duel' : c.kept;
    const nat = m.nature + (m.nature_chosen ? ' (chosen)' : '');
    const spread = kept === 'conventional' ? `${m.conventional.label} (${m.conventional.nature})` : m.label;
    console.log(`| ${m.species} | ${kept === 'conventional' ? m.conventional.nature : nat} | ${spread} | ${m.score.points} (${m.score.wins_worst} / ${m.score.wins_typical}) | ` +
      `${m.best_template.points} (${m.best_template.id}) · ${m.flat_85.points} | ${check} | ${kept} |`);
  });
}
