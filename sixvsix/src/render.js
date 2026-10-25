// Experiments as Markdown: conclusions first, evidence after (the CLI and the recorded results pages). The Lab page
// renders the same records as HTML.
import { INTERPRETATIONS } from './adapters/collections.js';

const pct = (x) => (x == null ? '—' : `${Math.round(100 * x)}%`);
const ci = (c) => (c ? `${pct(c[0])}–${pct(c[1])}` : '');
const signed = (x) => `${x > 0 ? '+' : ''}${Math.round(100 * x)}`;
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

export function renderReport(r) {
  const out = [];
  out.push(...r.headline.map((h) => `- ${h}`), '');
  if (r.patterns.length) {
    out.push('**What the battles suggest** (hypotheses with their evidence; each names the experiment that would test it)', '');
    for (const p of r.patterns) out.push(`- **${p.title}** (${p.strength}). ${p.finding} *Next:* ${p.suggestion.label}.`);
    out.push('');
  }
  out.push('**By opponent**', '', table(['Opponent', 'Won', '95%', 'Turns', 'Left when won'],
    r.outcomes.by_opponent.map((o) => [o.name, `${o.won}/${o.n}`, ci(o.ci95), o.turns, o.left_when_won ?? '—'])), '');
  out.push('**Your six**', '', table(['Pokémon', 'KOs a battle', 'Share of KOs', 'Damage dealt', 'Taken', 'Healed', 'Falls first', 'Closes wins', 'Reading'],
    r.members.map((m) => [m.name, m.kos, pct(m.ko_share), `${Math.round(m.damage_dealt)}%`, `${Math.round(m.damage_taken)}%`, `${Math.round(m.healed)}%`,
                          pct(m.falls_first), pct(m.closes), m.reading])), '');
  const t = r.team_level;
  if (t.threats.length) {
    out.push('**Their most dangerous Pokémon**', '', table(['Pokémon', 'KOs each time it appears', 'In your losses', 'Hardest on'],
      t.threats.slice(0, 6).map((x) => [x.species, x.kos_per_appearance, pct(x.share_of_losses), x.most_against.map((v) => `${v.name} (${v.kos})`).join(', ')])), '');
  }
  const deps = t.dependencies.filter((d) => d.gap != null && d.n_early >= 5);
  if (deps.length) {
    out.push('**Dependencies** (associations, not causes)', '', table(['When this one falls in your first two', 'You win', 'Otherwise', 'Battles'],
      deps.map((d) => [d.name, pct(d.win_if_falls_early), pct(d.win_otherwise), `${d.n_early} / ${d.n_otherwise}`])), '');
  }
  if (t.damage_by_type.length) {
    out.push('**Damage you take, by type**', '', table(['Type', 'Share of damage taken', 'Of yours weak to it'],
      t.damage_by_type.slice(0, 6).map((x) => [x.type, pct(x.share), x.weak.join(', ') || '—'])), '');
  }
  const i = r.interpretation;
  out.push('**How far to trust it**', '');
  for (const s of i.robust) out.push(`- Holds up: ${s}`);
  for (const s of i.opponent_dependent) out.push(`- Depends on the opponent: ${s}`);
  for (const s of i.needs_more_battles) out.push(`- Needs more battles: ${s}`);
  return out.join('\n');
}

export function renderExperiment(x) {
  const s = x.spec, out = [];
  const title = { league: 'League', compare: 'Build comparison', matrix: 'Builds × trainer styles', leads: 'Leads', styles: 'Your trainer\'s style', sensitivity: 'What moves the needle' }[x.type];
  out.push(`## ${title}${x.labels ? `: ${x.labels.team} vs ${x.labels.pool}` : ''}`, '');
  const opp = INTERPRETATIONS[s.interpretation || 'blackthorn'].label.toLowerCase();
  const ours = (s.ours || 'blackthorn') === 'blackthorn' ? 'on its defaults' : INTERPRETATIONS[s.ours].label.toLowerCase();
  const who = x.type === 'matrix' ? `opponents: ${x.columns.join(', ').toLowerCase()}` : x.type === 'sensitivity' ? `opponents (as it stands): ${opp}` : `opponents: ${opp}`;
  out.push(`*${s.pool}${s.only ? ` (only ${s.only.join(', ')})` : ''}; ${who}; your trainer: ${ours}; ${s.n ?? ''} battles per opponent. ${x.engine}, contract ${x.contract}, seed ${x.seed || ''}.*`, '');
  if (x.type === 'league') { out.push(renderReport(x.report)); if (x.fell_back?.length) out.push('', `*No cartridge AI for ${x.fell_back.join(', ')}: played on Blackthorn's reading.*`); }
  if (x.type === 'compare') {
    out.push(...x.reading.map((r) => `- ${r}`), '');
    out.push('**What changed**', '', ...x.diff.flatMap((d) => d.changes.map((c) => `- ${d.to || ''} ${c.field}: ${c.from} → ${c.to}`)), '');
    for (const d of x.duel) {
      out.push(`**${d.to}, one-on-one against the pool** (the duel model): beats ${d.one_on_one.from} → ${d.one_on_one.to}; switching in ${d.one_on_one.switching_in}`, '');
      if (d.flips.length) out.push(`- Flips: ${d.flips.map((f) => `${f.now === 'wins' ? 'now beats' : 'now loses to'} ${f.opponent}`).join(', ')}`);
      if (d.thresholds.length) out.push(`- Thresholds: ${d.thresholds.slice(0, 12).map((t) => `${t.opponent} ${t.what}`).join('; ')}`);
      out.push('');
    }
    if (x.per_opponent.length) out.push(table(['Opponent', 'Before', 'After'], x.per_opponent.slice(0, 8).map((o) => [o.name, `${o.x_won}/${o.n}`, `${o.y_won}/${o.n}`])), '');
  }
  if (x.type === 'matrix') {
    out.push(...x.reading.map((r) => `- ${r}`), '');
    out.push(table(['Build', ...x.columns], x.rows.map((name, r) => [name, ...x.cells[r].map((c) => `${pct(c.rate)} (${c.won}/${c.n})`)])), '');
  }
  if (x.type === 'leads' || x.type === 'styles' || x.type === 'sensitivity') {
    out.push(...x.reading.map((r) => `- ${r}`), '');
    const rows = x.type === 'sensitivity' ? [x.base, ...x.effects] : x.rows;
    out.push(table(['Change', 'Won', 'Win rate change (95%)', 'HP margin change (95%)', 'McNemar p'],
      rows.map((r) => [r.label, `${r.won}/${r.n}`, r.difference ? `${signed(r.difference.y_minus_x)} [${signed(r.difference.ci95[0])}, ${signed(r.difference.ci95[1])}]` : '—',
                       r.margin ? `${signed(r.margin.y_minus_x)} [${signed(r.margin.ci95[0])}, ${signed(r.margin.ci95[1])}]` : '—', r.mcnemar_p ?? '—'])), '');
  }
  return out.join('\n');
}
