# The EV optimizer (D-072)

*`src/optimize/evs.js` and `src/optimize/confirm.js`. Your Gen 4 teams carry full, optimized 510-EV spreads; every
opponent carries 85 in every stat. This page says how the spreads were chosen, how they were checked, and what the
battles say about the policy itself.*

## The policy

| Who | EVs | Where it's set |
|---|---|---|
| Your HeartGold, SoulSilver and Platinum sixes | A full spread from the optimizer, against that game's league | `fixtures/teams/me-<game>.optimized.json` |
| Every Trainer Library opponent (Elite Four, Champions, rematches, Red, Cynthia) | 85 in every stat, game trainers included | `teamFromLibrary(..., { evs: 'fill85' })`, the default |
| Strictly authentic runs | The cartridge's real zeros, only when asked for | `teamFromLibrary(..., { evs: 'cartridge' })` |
| The control | Your same six on 85 in every stat | `fixtures/teams/me-<game>.even85.json` (only for the D-072 check below) |

Moves, items, abilities and IVs are never changed. A nature on record is kept. Where none is on record, the optimizer
chooses one, and the build says so (`evidence.nature: hypothetical`). The Gen 4 OU sample team keeps its authored
spreads. This is the 6v6 engine only: the one-on-one engine's fight settings (D-061, D-066) are untouched.

## How a spread is chosen: the duel model

For each of your Pokémon, against every Pokémon in its league (62 for HeartGold and SoulSilver, 52 for Platinum,
duplicates weighted), using Smogon's calculator (`@smogon/calc` 0.12.0, the one-on-one engine's):

- **Moves.** Each side can use any of its damaging moves. Ours is picked to do best against their best reply
  (maximin).
- **Hits to knock out, on two readings.** Worst case is our lowest roll against their highest; typical is average
  rolls. A move that lowers its own attacking stat (Overheat, Draco Meteor, Leaf Storm, Superpower) loses power on
  each repeat at the game's stage multipliers.
- **The race.** Their hits needed minus ours, ±½ for who acts first (priority, then Speed; a tie counts as acting
  second).
- **Three entries, each scored:**
  - a fresh one-on-one (a win if the race is above 0);
  - switching in on one of their hits (above 1);
  - getting a free hit as they come in (above −1).
- **What's applied:** weather from Sand Stream, Drizzle, Drought and Snow Warning; Intimidate; items; abilities.
- **What's left to the battles:** setup, recovery, status and accuracy. The 6v6 simulator plays those out.

The score is the wins over the three entries and both readings, with a small tie-break for the size of the margin.

**The search** starts from each of Blackthorn's own EV templates (`engine/trainers/roles.json`) and from 85 even. It
hill-climbs by moving EVs between stats in steps of 252 down to 4, for every nature it may choose. That's Hardy plus
every nature that doesn't lower a stat the set attacks with. The rules every spread keeps (tested): 508 at most (510
less the 2 that do nothing), 252 a stat, steps of 4.

## How each spread was checked: the 6v6 confirmation

The duel model ranks spreads one-on-one, but a 6v6 battle also asks a Pokémon to switch into hits, revenge-kill and
sweep. So each member was played both ways:

- **The two arms.** The whole team, once with the duel spread and once with the *conventional* spread (252 in its
  attacking side, 252 Speed, the best nature for it).
- **The battles.** Against the whole league, with the same seeds, trainer agents on both sides, and 20 battles per
  opponent per arm.
- **The rule.** The duel spread stays unless the conventional one is measurably better: McNemar p < 0.05 on wins, or a
  95% HP-margin interval entirely above zero.

**All 18 duel spreads stayed.** In the last column of the tables, a negative HP margin means the duel spread finished
with more of its team's HP than the conventional one did. Three were measurably better on HP margin:

- Lapras (HeartGold);
- Gengar (SoulSilver), which also won more battles: 87% against 83%, p = 0.041;
- Weavile (Platinum).

None was measurably worse.

### HeartGold (against heartgold-league, 62 opponent Pokémon)

| Pokémon | Nature | Spread | Duel score (fresh wins, worst / typical) | Best template · 85 each | 6v6 check: wins, duel vs conventional · HP margin, conventional − duel (95%) | Kept |
|---|---|---|---|---|---|---|
| Typhlosion | Mild (chosen) | 236 HP / 8 Atk / 16 Def / 156 SpA / 8 SpD / 84 Spe | 234.04 (39 / 43) | 225.8 (bulky_special) · 207.29 | 95.5% vs 93.2% · -0.017 [-0.039, 0.004] | duel |
| Tyranitar | Jolly (chosen) | 48 HP / 172 Atk / 48 Def / 4 SpD / 236 Spe | 285.69 (44 / 46) | 281.57 (fast_support) · 250.92 | 95% vs 95% · +0.004 [-0.011, 0.019] | duel |
| Mamoswine | Adamant | 248 HP / 4 Def / 12 SpD / 244 Spe | 278.54 (45 / 49) | 275.45 (fast_support) · 257.93 | 94.1% vs 95.5% · +0.008 [-0.014, 0.029] | duel |
| Crobat | Jolly | 168 HP / 240 Atk / 84 Def / 16 SpD | 221.36 (35 / 42) | 219.29 (bulky_physical) · 184.43 | 94.5% vs 94.1% · -0.015 [-0.031, 0] | duel |
| Lapras | Calm | 172 HP / 160 Def / 132 SpA / 44 Spe | 234.65 (38 / 39) | 224.43 (bulky_special) · 208.91 | 92.3% vs 90.5% · -0.04 [-0.072, -0.007] | duel |
| Snorlax | Careful | 112 HP / 236 Atk / 144 Def / 16 SpD | 274.8 (43 / 45) | 260.36 (bulky_physical) · 231.6 | 93.6% vs 94.1% · -0.012 [-0.029, 0.005] | duel |

### SoulSilver (against heartgold-league, 62 opponent Pokémon)

| Pokémon | Nature | Spread | Duel score (fresh wins, worst / typical) | Best template · 85 each | 6v6 check: wins, duel vs conventional · HP margin, conventional − duel (95%) | Kept |
|---|---|---|---|---|---|---|
| Pikachu | Naughty (chosen) | 48 HP / 252 Atk / 84 Def / 124 Spe | 100.02 (12 / 14) | 90.76 (fast_physical) · 49.45 | 88.6% vs 90% · -0.004 [-0.015, 0.007] | duel |
| Dragonite | Adamant (chosen) | 188 HP / 68 Atk / 252 Spe | 290.16 (47 / 49) | 282.71 (fast_physical) · 259.08 | 87.3% vs 86.8% · +0.011 [-0.014, 0.035] | duel |
| Infernape | Lonely (chosen) | 76 HP / 228 Atk / 32 SpA / 148 SpD / 24 Spe | 221.9 (38 / 40) | 216.69 (physical_wall) · 201.39 | 87.7% vs 85.5% · -0.007 [-0.023, 0.009] | duel |
| Empoleon | Quiet (chosen) | 164 HP / 92 Def / 252 SpA | 262.96 (44 / 45) | 260.63 (fast_special) · 218.74 | 84.5% vs 86.8% · -0.014 [-0.049, 0.021] | duel |
| Gengar | Modest (chosen) | 244 HP / 60 Def / 68 SpA / 116 SpD / 20 Spe | 222.02 (35 / 38) | 207.81 (bulky_special) · 185.18 | 87.3% vs 82.7% · -0.047 [-0.081, -0.014] | duel |
| Scizor | Adamant (chosen) | 224 HP / 248 Atk / 32 Def / 4 Spe | 218.46 (35 / 37) | 215.38 (bulky_physical) · 189.26 | 88.6% vs 89.1% · +0.011 [-0.006, 0.029] | duel |

### Platinum (against platinum-league, 52 opponent Pokémon)

| Pokémon | Nature | Spread | Duel score (fresh wins, worst / typical) | Best template · 85 each | 6v6 check: wins, duel vs conventional · HP margin, conventional − duel (95%) | Kept |
|---|---|---|---|---|---|---|
| Infernape | Lax (chosen) | 252 HP / 168 Def / 84 Spe | 180.64 (30 / 30) | 178.68 (physical_wall) · 154.16 | 98.5% vs 97.5% · -0.014 [-0.036, 0.009] | duel |
| Weavile | Jolly | 252 HP / 220 Atk / 32 Def / 4 Spe | 150.04 (26 / 30) | 145.92 (bulky_physical) · 125.38 | 99.5% vs 99% · -0.03 [-0.048, -0.012] | duel |
| Roserade | Timid | 188 HP / 12 Def / 160 SpA / 148 Spe | 137.3 (20 / 24) | 125.12 (fast_special) · 110.6 | 99.5% vs 98% · -0.02 [-0.039, 0] | duel |
| Lucario | Careful (chosen) | 76 Atk / 180 SpD / 252 Spe | 170.5 (20 / 26) | 162.44 (fast_physical) · 123.52 | 98% vs 98% · +0.012 [-0.002, 0.025] | duel |
| Garchomp | Adamant (chosen) | 100 HP / 220 Atk / 80 SpD / 108 Spe | 283.46 (50 / 50) | 277.32 (bulky_physical) · 256.76 | 99% vs 100% · +0.015 [-0.004, 0.034] | duel |
| Magnezone | Modest | 252 HP / 252 SpA / 4 SpD | 159.72 (22 / 26) | 157.68 (bulky_special) · 143.1 | 98% vs 99% · +0.001 [-0.018, 0.019] | duel |

*Printed by `node cli/optimizer-table.mjs` from `fixtures/optimizer/<game>.json` and `<game>.confirm.json`.
"Duel score" is the model's points; "85 each" is the same Pokémon on 85 in every stat, in the same model.*

## What the battles say about D-072

Each team against its whole league, twice, with the same seeds: once on the optimized spreads and once on 85 in
every stat (`node cli/league.mjs`, `results/league/`):

| Team | Wins on 85 each | Wins optimized | McNemar p | HP margin gained (95%) |
|---|---|---|---|---|
| HeartGold | 197 of 220 (90%) | 210 of 220 (95%) | 0.0002 | +0.108 [0.076, 0.141] |
| SoulSilver | 169 of 220 (77%) | 188 of 220 (85%) | 0.0002 | +0.142 [0.104, 0.180] |
| Platinum | 177 of 200 (89%) | 197 of 200 (99%) | < 0.0001 | +0.112 [0.069, 0.155] |

The optimized spreads win more in all three games, by margins the pairing can see. Most of the gain is in the
hardest matchups:

- **HeartGold vs Bruno's rematch:** from 1 of 20 to 10 of 20.
- **SoulSilver vs Lance:** from 1 of 20 to 9 of 20.

The HP margin is the share of your team's HP left minus the opponent's at the end of each battle. It's finer-grained
than win or loss, and it moves by 11–14 points in every game.

## What to look at before you trust a spread

- **Some spreads put little or nothing in Attack.** HeartGold's Mamoswine is 248 HP / 244 Spe with no Attack EVs, and
  Platinum's Infernape is 252 HP / 168 Def / 84 Spe, Lax, with no attacking EVs. This isn't a bug: the damage tables
  respond to Attack (Mamoswine's Attack goes 325 → 394 with 252 in it, and the damage moves with it). Against
  opponents on 85 EVs, Mamoswine already hits its knockout numbers on most of the league, so bulk wins more duels than
  power. Moving its HP into Attack drops it from 45 to 41 fresh wins of 62. In the 6v6 check these spreads tie the
  conventional ones (Mamoswine 94.1% vs 95.5%, Infernape 98.5% vs 97.5%, neither significant), so the rule keeps the duel
  spread. **If you'd rather a tie go to the conventional spread, that's a one-line change to the rule.**
- **Natures where none was on record are the optimizer's choice,** marked hypothetical on the build. For example:
  Typhlosion Mild, Tyranitar Jolly, all six SoulSilver natures, and Platinum's Infernape, Lucario and Garchomp.
- **SoulSilver's Pikachu has no item on record,** so it fights without a Light Ball, and its spread is the weakest in
  the tables. With a Light Ball its numbers would change completely.
- **The model is a duel model.** It doesn't see setup, status, recovery, hazards or teammates. The 6v6 check is what
  covers those, at 20 battles per opponent per arm. That's enough to catch a spread that's clearly worse, not one
  that's a point or two worse.
- **Exact thresholds stay with the one-on-one engine.** Showdown and the calculator differ by 1–3 HP in a few
  damage cases (`TEST_REPORT.md`). The optimizer uses the calculator, as the one-on-one engine does.

## Rerun

```
node cli/make-fixtures.mjs        # the optimizer, every team and pool, from the Trainer Library (about 16 s)
node cli/confirm-spreads.mjs      # the 6v6 check, every member of the three teams (several minutes)
node cli/league.mjs               # each team against its league, plus the D-072 check (about 3–4 minutes)
node cli/optimizer-table.mjs      # the tables on this page
```
