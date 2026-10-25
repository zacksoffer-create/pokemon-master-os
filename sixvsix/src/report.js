// The Strategy Report (master plan §6 and Improvement B): what a set of battles says about a team, in four levels,
// conclusions first and the evidence one step away.
//   1 Outcomes          wins with their interval, by opponent, how long and how close
//   2 Contributions     each of your Pokémon: knockouts, damage, hits taken, healing, status, set-up, support,
//                       switching, how often it falls first, and who closes battles
//   3 Team              the threats (their Pokémon that do the damage), dependencies (how the result moves when one of
//                       yours falls early), the damage you take by type against how many of yours are weak to it,
//                       and offensive sequencing (who opens and who closes)
//   4 Interpretation    which findings hold across the pool, which depend on the opponent, which need more battles
// Then patterns: each a finding with its numbers, how sure it is, and an experiment that would test it. They're
// hypotheses backed by evidence, not conclusions: the suggestion is the next experiment, never an answer.
//
// Dependencies are associations, not causes: "when Tyranitar falls in the first two, you win 61% (otherwise 97%)"
// says the two go together, not that one causes the other. The report says so where it reports them.

import { Dex } from '@pkmn/sim';
import { wilson } from './stats.js';
import { toShowdownSets } from './teams.js';

const dex = Dex.forGen(4);
const r1 = (x) => Math.round(x * 10) / 10;
const r3 = (x) => Math.round(x * 1000) / 1000;
const pct = (x) => `${Math.round(100 * x)}%`;
const per = (x, n) => (n ? x / n : 0);

/**
 * `runs`: [{opponent: TeamVersion, rows: [battle rows]}], one per opponent, the rows as runTrial returns them
 * (with analysis). `team` is your Team Version. `context` = {pool, interpretation, ourStyle, signatureItems, variations}
 * for the suggestions.
 */
export function strategyReport(team, runs, context = {}) {
  const all = runs.flatMap((r) => r.rows.map((b) => ({ ...b, opp: r.opponent })));
  const N = all.length;
  const won = all.filter((b) => b.winner === 'a').length;
  const outcomes = outcomesOf(runs, all, won);
  const members = membersOf(team, all);
  const threats = threatsOf(all);
  const deps = dependenciesOf(team, all, won);
  const types = typesOf(team, all);
  const sequencing = sequencingOf(all);
  const interpretation = interpretationOf(outcomes, members, runs);
  const patterns = patternsOf({ team, outcomes, members, threats, deps, types, sequencing, all, context });
  return {
    kind: 'StrategyReport', team: team.id, team_name: team.name, n: N,
    pool: context.pool ? { id: context.pool.id, name: context.pool.name } : undefined,
    interpretation_of_opponents: context.interpretation, our_style: context.ourStyle,
    headline: headlineOf({ team, outcomes, members, threats, patterns }),
    outcomes, members, team_level: { threats, dependencies: deps, damage_by_type: types, sequencing },
    interpretation, patterns,
    note: 'Dependencies are associations, not causes. Patterns are hypotheses with their evidence; each suggests an experiment.',
  };
}

// ---- level 1 -------------------------------------------------------------------------------------------------

function outcomesOf(runs, all, won) {
  const N = all.length;
  const [lo, hi] = wilson(won, N);
  const byOpp = runs.map((r) => {
    const w = r.rows.filter((b) => b.winner === 'a').length, n = r.rows.length;
    const wins = r.rows.filter((b) => b.winner === 'a');
    const [a, b] = wilson(w, n);
    return { opponent: r.opponent.source?.version_id || r.opponent.id, name: r.opponent.name, n, won: w, rate: r3(per(w, n)), ci95: [r3(a), r3(b)],
             turns: r1(per(r.rows.reduce((t, x) => t + x.turns, 0), n)),
             left_when_won: wins.length ? r1(per(wins.reduce((t, x) => t + x.left.a, 0), wins.length)) : null };
  }).sort((x, y) => x.rate - y.rate);
  const wins = all.filter((b) => b.winner === 'a');
  return {
    n: N, won, rate: r3(per(won, N)), ci95: [r3(lo), r3(hi)], drew: all.filter((b) => b.winner === 'draw').length,
    by_opponent: byOpp,
    turns: r1(per(all.reduce((t, b) => t + b.turns, 0), N)),
    left_when_won: wins.length ? r1(per(wins.reduce((t, b) => t + b.left.a, 0), wins.length)) : null,
    close_wins: wins.length ? r3(per(wins.filter((b) => b.left.a <= 1).length, wins.length)) : 0,
  };
}

// ---- level 2 -------------------------------------------------------------------------------------------------

/** Each member's name in battle (the battle log's own, unique even for two of a species). */
const battleNames = (team) => toShowdownSets(team).names;

function membersOf(team, all) {
  const N = all.length;
  const names = battleNames(team);
  const totalKOs = all.reduce((t, b) => t + (b.members?.a || []).reduce((s, m) => s + m.kos, 0), 0) || 1;
  const wins = all.filter((b) => b.winner === 'a');
  const out = team.members.map((build, i) => {
    const name = names[i];
    const rows = all.map((b) => (b.members?.a || []).find((m) => m.name === name)).filter(Boolean);
    const sum = (k) => rows.reduce((t, m) => t + (m[k] || 0), 0);
    const appeared = rows.filter((m) => m.switch_ins > 0).length;
    const closes = wins.filter((b) => { const last = [...(b.kos || [])].reverse().find((k) => k.side === 'b'); return last && last.by === name; }).length;
    const opens = all.filter((b) => { const first = (b.kos || []).find((k) => k.side === 'b'); return first && first.by === name; }).length;
    const kosInWins = wins.reduce((t, b) => t + ((b.members?.a || []).find((m) => m.name === name)?.kos || 0), 0);
    const winKOs = wins.reduce((t, b) => t + (b.members?.a || []).reduce((s, m) => s + m.kos, 0), 0) || 1;
    return {
      name, species: build.species,
      appeared: r3(per(appeared, N)),
      kos: r3(per(sum('kos'), N)), ko_share: r3(sum('kos') / totalKOs), ko_share_in_wins: r3(kosInWins / winKOs),
      damage_dealt: r1(per(sum('damage_dealt'), N)), damage_taken: r1(per(sum('damage_taken'), N)),
      healed: r1(per(sum('healed'), N)), status_inflicted: r3(per(sum('status_inflicted'), N)),
      setup_used: r3(per(sum('setup_used'), N)), support_used: r3(per(sum('support_used'), N)),
      switched_in_by_choice: r3(per(sum('switched_in_by_choice'), N)),
      fainted: r3(per(rows.filter((m) => m.fainted).length, N)),
      falls_first: r3(per(rows.filter((m) => m.faint_order === 1).length, N)),
      opens: r3(per(opens, N)), closes: r3(per(closes, wins.length)),
    };
  });
  for (const m of out) m.reading = readingOf(m, out);
  return out;
}

function readingOf(m, all) {
  const top = (k) => all.every((o) => o === m || o[k] <= m[k]);
  const bits = [];
  if (top('ko_share') && m.ko_share >= 0.2) bits.push(`your main finisher (${pct(m.ko_share)} of your knockouts)`);
  else if (m.ko_share >= 0.2) bits.push(`a main finisher (${pct(m.ko_share)} of your knockouts)`);
  if (top('damage_taken') && m.damage_taken > 0) bits.push(`takes the most hits (${Math.round(m.damage_taken)}% of its HP a battle)`);
  if (top('closes') && m.closes >= 0.25) bits.push(`closes ${pct(m.closes)} of your wins`);
  if (m.falls_first >= 0.35) bits.push(`falls first in ${pct(m.falls_first)} of battles`);
  if (m.appeared < 0.45) bits.push(`sees play in only ${pct(m.appeared)} of battles`);
  if (m.support_used >= 0.5) bits.push('does your support work');
  if (m.setup_used >= 0.4) bits.push(`sets up ${r1(m.setup_used)} times a battle`);
  if (m.healed >= 25) bits.push(`heals ${Math.round(m.healed)}% a battle`);
  return bits.length ? bits.join('; ') : 'a steady contributor';
}

// ---- level 3 -------------------------------------------------------------------------------------------------

function threatsOf(all) {
  const by = new Map();
  const losses = all.filter((b) => b.winner !== 'a');
  for (const b of all) {
    // by species, each battle counted once: Lance's three Dragonite are one threat in one battle
    const groups = new Map(), speciesOf = new Map();
    for (const m of b.members?.b || []) {
      if (!m.switch_ins) continue;
      const key = m.species || m.name;
      speciesOf.set(m.name, key);
      const g = groups.get(key) || { kos: 0, n: 0, fainted: 0 };
      g.kos += m.kos; g.n++; g.fainted += m.fainted ? 1 : 0;
      groups.set(key, g);
    }
    for (const [key, g] of groups) {
      const t = by.get(key) || { species: key, appeared: 0, individuals: 0, kos: 0, fainted: 0, from: new Set(), victims: {}, in_losses: 0, kos_in_losses: 0, sweeps: 0 };
      t.appeared++; t.individuals += g.n; t.kos += g.kos; t.fainted += g.fainted; t.from.add(b.opp.name);
      for (const k of b.kos || []) if (k.side === 'a' && speciesOf.get(k.by) === key) t.victims[k.fainted] = (t.victims[k.fainted] || 0) + 1;
      if (b.winner !== 'a') { t.in_losses++; t.kos_in_losses += g.kos; if (g.kos >= 2) t.sweeps++; }
      by.set(key, t);
    }
  }
  return [...by.values()].map((t) => ({
    species: t.species, from: [...t.from].slice(0, 4), appeared: t.appeared,
    kos_per_appearance: r3(per(t.kos, t.appeared)), survives: r3(1 - per(t.fainted, t.individuals)),
    most_against: Object.entries(t.victims).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => ({ name: n, kos: c })),
    in_losses: t.in_losses, share_of_losses: r3(per(t.in_losses, losses.length)), kos_in_losses: r3(per(t.kos_in_losses, t.in_losses)),
    sweeps: t.sweeps,
  })).filter((t) => t.kos_per_appearance > 0).sort((a, b) => (b.kos_per_appearance * Math.sqrt(b.appeared)) - (a.kos_per_appearance * Math.sqrt(a.appeared))).slice(0, 8);
}

function dependenciesOf(team, all, won) {
  const N = all.length;
  const names = battleNames(team);
  return team.members.map((build, i) => {
    const name = names[i];
    const early = all.filter((b) => { const m = (b.members?.a || []).find((x) => x.name === name); return m && m.faint_order != null && m.faint_order <= 2; });
    const rest = all.filter((b) => !early.includes(b));
    const survived = all.filter((b) => { const m = (b.members?.a || []).find((x) => x.name === name); return m && !m.fainted; });
    const w = (xs) => xs.filter((b) => b.winner === 'a').length;
    const re = per(w(early), early.length), rr = per(w(rest), rest.length);
    return {
      name, falls_early: r3(per(early.length, N)), win_if_falls_early: early.length ? r3(re) : null,
      win_otherwise: rest.length ? r3(rr) : null, gap: early.length && rest.length ? r3(rr - re) : null,
      n_early: early.length, n_otherwise: rest.length,
      win_if_survives: survived.length ? r3(per(w(survived), survived.length)) : null, n_survives: survived.length,
    };
  }).sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1));
}

function typesOf(team, all) {
  const N = all.length || 1;
  const sum = {};
  for (const b of all) for (const [t, v] of Object.entries(b.taken_by_type?.a || {})) sum[t] = (sum[t] || 0) + v;
  const total = Object.values(sum).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(sum).map(([type, v]) => {
    const weak = team.members.filter((m) => {
      const types = dex.species.get(m.species).types;
      return dex.getImmunity(type, types) && dex.getEffectiveness(type, types) > 0;
    }).map((m) => m.nickname || m.species);
    return { type, per_battle: r1(v / N), share: r3(v / total), weak };
  }).sort((a, b) => b.share - a.share).slice(0, 8);
}

function sequencingOf(all) {
  const first = {}, last = {};
  for (const b of all) {
    const ours = (b.kos || []).filter((k) => k.side === 'b' && k.by);
    if (ours[0]) first[ours[0].by] = (first[ours[0].by] || 0) + 1;
    if (b.winner === 'a' && ours.length) last[ours[ours.length - 1].by] = (last[ours[ours.length - 1].by] || 0) + 1;
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([name, c]) => ({ name, battles: c }));
  const leads = {};
  for (const b of all) if (b.lead?.a) { const L = (leads[b.lead.a] ||= { name: b.lead.a, n: 0, won: 0 }); L.n++; L.won += b.winner === 'a' ? 1 : 0; }
  return { first_knockout: top(first), last_knockout_in_wins: top(last), leads: Object.values(leads).map((l) => ({ ...l, rate: r3(per(l.won, l.n)) })) };
}

// ---- level 4 -------------------------------------------------------------------------------------------------

function interpretationOf(outcomes, members, runs) {
  const robust = [], depends = [], more = [];
  const [lo, hi] = outcomes.ci95;
  if (hi - lo <= 0.12) robust.push(`The overall result is pinned down: ${pct(outcomes.rate)} (95% ${pct(lo)}–${pct(hi)}) over ${outcomes.n} battles.`);
  else more.push(`The overall result is still loose: ${pct(outcomes.rate)} (95% ${pct(lo)}–${pct(hi)}). More battles would narrow it.`);
  for (const o of outcomes.by_opponent) {
    if (o.ci95[1] < lo) depends.push(`${o.name} is a real weak spot: ${o.won} of ${o.n} (95% up to ${pct(o.ci95[1])}), below the pool's interval.`);
    else if (o.rate > 0.3 && o.rate < 0.7) more.push(`${o.name} is too close to call at ${o.won} of ${o.n}: run more battles against them.`);
  }
  // a member whose share of knockouts swings by opponent (the two biggest swings)
  const swings = [];
  for (const m of members) {
    const shares = runs.map((r) => {
      const tot = r.rows.reduce((t, b) => t + (b.members?.a || []).reduce((s, x) => s + x.kos, 0), 0) || 1;
      return r.rows.reduce((t, b) => t + ((b.members?.a || []).find((x) => x.name === m.name)?.kos || 0), 0) / tot;
    });
    const maxS = Math.max(...shares), minS = Math.min(...shares);
    if (maxS - minS >= 0.4 && runs.length >= 3) {
      const iMax = shares.indexOf(maxS), iMin = shares.indexOf(minS);
      swings.push({ by: maxS - minS, text: `${m.name}'s role depends on the opponent: ${pct(maxS)} of your knockouts against ${runs[iMax].opponent.name}, ${pct(minS)} against ${runs[iMin].opponent.name}.` });
    }
  }
  depends.push(...swings.sort((a, b) => b.by - a.by).slice(0, 2).map((x) => x.text));
  const ko = members.filter((m) => m.ko_share >= 0.2);
  if (ko.length) robust.push(`Your knockouts come mostly from ${ko.map((m) => `${m.name} (${pct(m.ko_share)})`).join(' and ')}.`);
  return { robust, opponent_dependent: depends, needs_more_battles: more };
}

// ---- patterns and suggestions ---------------------------------------------------------------------------------

function patternsOf({ team, outcomes, members, threats, deps, types, sequencing, all, context }) {
  const out = [];
  const losses = all.filter((b) => b.winner !== 'a').length;
  const base = { team: context.teamKey || team.id, pool: context.poolKey, interpretation: context.interpretation };
  // a threat that runs through the team
  for (const t of threats.slice(0, 4)) {
    if (losses >= 5 && t.share_of_losses >= 0.3 && t.kos_in_losses >= 1.5) {
      out.push({
        id: `threat:${t.species}`, kind: 'threat', strength: t.share_of_losses >= 0.5 ? 'strong' : 'suggestive',
        title: `${t.species} runs through the team`,
        finding: `${t.species} is in ${pct(t.share_of_losses)} of your losses and takes ${r1(t.kos_in_losses)} of yours each time; it's hardest on ${t.most_against.map((x) => x.name).join(', ')}.`,
        evidence: t,
        suggestion: { label: `Watch a loss where ${t.species} sweeps, then test an answer`, experiment: { kind: 'battles', ...base, filter: { lost: true, threat: t.species } } },
      });
    }
  }
  // falls early and the team follows
  for (const d of deps) {
    const m = members.find((x) => x.name === d.name);
    if (d.gap != null && d.gap >= 0.15 && d.n_early >= 8 && d.n_otherwise >= 8 && m.ko_share >= 0.12) {
      out.push({
        id: `depends:${d.name}`, kind: 'dependency', strength: d.gap >= 0.3 ? 'strong' : 'suggestive',
        title: `The team leans on ${d.name}`,
        finding: `When ${d.name} is one of the first two of yours to fall, you win ${pct(d.win_if_falls_early)} (${d.n_early} battles); otherwise ${pct(d.win_otherwise)} (${d.n_otherwise}). That goes together with losing; it isn't proof it causes it.`,
        evidence: d,
        suggestion: { label: `Play your trainer more cautiously (protects ${d.name} more) and compare`, experiment: { kind: 'styles', ...base, ours: ['blackthorn', 'cautious'] } },
      });
    }
  }
  // a shared weakness
  for (const t of types.slice(0, 3)) {
    if (t.share >= 0.3 && t.weak.length >= 3) {
      out.push({
        id: `type:${t.type}`, kind: 'weakness', strength: t.share >= 0.45 ? 'strong' : 'suggestive',
        title: `${t.type} hits are your biggest cost`,
        finding: `${pct(t.share)} of the damage you take is ${t.type} (${Math.round(t.per_battle)}% of a Pokémon's HP a battle), and ${t.weak.length} of your six are weak to it: ${t.weak.join(', ')}.`,
        evidence: t,
        suggestion: { label: 'A note for team building: a variation with a resist would test it', experiment: null },
      });
    }
  }
  // the lead
  const leadName = sequencing.leads[0]?.name;
  const lead = members.find((m) => m.name === leadName);
  if (lead) {
    const meanKOs = members.reduce((t, m) => t + m.kos, 0) / members.length;
    if (lead.falls_first >= 0.4 && lead.kos < meanKOs) {
      out.push({
        id: `lead:${lead.name}`, kind: 'lead', strength: 'suggestive', title: `${lead.name} struggles as the lead`,
        finding: `${lead.name} leads every battle, falls first in ${pct(lead.falls_first)} of them and makes ${r1(lead.kos)} knockouts a battle (the team's average is ${r1(meanKOs)}).`,
        evidence: { lead: lead.name, falls_first: lead.falls_first, kos: lead.kos, team_mean_kos: r3(meanKOs) },
        suggestion: { label: 'Try each of your six as the lead', experiment: { kind: 'leads', ...base } },
      });
    }
  }
  // set-up that doesn't pay
  for (const m of members) {
    if (m.setup_used >= 0.3 && m.kos < 0.5) {
      out.push({
        id: `setup:${m.name}`, kind: 'setup', strength: 'suggestive', title: `${m.name}'s set-up rarely pays`,
        finding: `${m.name} sets up ${r1(m.setup_used)} times a battle but makes only ${r1(m.kos)} knockouts.`,
        evidence: { name: m.name, setup_used: m.setup_used, kos: m.kos },
        suggestion: { label: 'Play your trainer more aggressively (less set-up) and compare', experiment: { kind: 'styles', ...base, ours: ['blackthorn', 'aggressive'] } },
      });
    }
  }
  // held items: a species' own item missing is a strong lead; the rest is one note
  const bare = team.members.filter((b) => !b.item);
  for (const b of bare) {
    const sig = context.signatureItems?.[b.species];
    if (!sig) continue;
    const variation = (context.variations || []).find((v) => v.base === base.team && v.changed?.includes(b.species));
    out.push({
      id: `item:${b.species}`, kind: 'item', strength: 'strong', title: `${b.nickname || b.species} without its ${sig}`,
      finding: `${b.nickname || b.species} has no item on record; ${sig} is the item made for it.`,
      evidence: { species: b.species, signature_item: sig },
      suggestion: variation
        ? { label: `Compare with the variation "${variation.title}"`, experiment: { kind: 'compare', ...base, y: variation.key } }
        : { label: `Give it ${sig} in the build editor and compare`, experiment: null },
    });
  }
  const plain = bare.filter((b) => !context.signatureItems?.[b.species]);
  if (plain.length >= 2) {
    out.push({
      id: 'items', kind: 'item', strength: 'suggestive', title: `${plain.length} of your six hold nothing`,
      finding: `No item on record for ${plain.map((b) => b.nickname || b.species).join(', ')}. Items are build decisions; the engine doesn't invent them.`,
      evidence: { species: plain.map((b) => b.species) },
      suggestion: { label: 'Try an item in the build editor and compare', experiment: null },
    });
  }
  // too close to call
  const close = outcomes.by_opponent.filter((o) => o.rate > 0.3 && o.rate < 0.7);
  if (close.length) {
    out.push({
      id: 'close', kind: 'uncertain', strength: 'suggestive', title: 'Some matchups are too close to call',
      finding: `${close.map((o) => `${o.name} (${o.won}/${o.n})`).join(', ')}: their intervals still cross 50%.`,
      evidence: close,
      suggestion: { label: 'Run more battles against just these', experiment: { kind: 'league', ...base, only: close.map((o) => o.opponent), n: 60 } },
    });
  }
  const rank = { strong: 0, suggestive: 1 };
  return out.sort((a, b) => rank[a.strength] - rank[b.strength]);
}

function headlineOf({ team, outcomes, members, threats, patterns }) {
  const lines = [];
  lines.push(`${team.name} won ${outcomes.won} of ${outcomes.n} (${pct(outcomes.rate)}; 95% ${pct(outcomes.ci95[0])}–${pct(outcomes.ci95[1])}).`);
  const weak = outcomes.by_opponent.filter((o) => o.rate < 0.75).slice(0, 2);
  if (weak.length) lines.push(`Hardest: ${weak.map((o) => `${o.name} (${o.won}/${o.n})`).join(', ')}.`);
  else lines.push(`No opponent held you under 75%.`);
  const mvp = [...members].sort((a, b) => b.ko_share - a.ko_share)[0];
  if (mvp) lines.push(`${mvp.name} makes ${pct(mvp.ko_share)} of your knockouts.`);
  const p = patterns.find((x) => x.strength === 'strong' && x.kind !== 'item') || patterns.find((x) => x.kind !== 'item');
  if (p) lines.push(p.finding);
  else if (threats[0]) lines.push(`Their most dangerous Pokémon: ${threats[0].species} (${r1(threats[0].kos_per_appearance)} knockouts each time it comes in).`);
  return lines;
}
