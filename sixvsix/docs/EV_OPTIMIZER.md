# The EV optimizer (D-072, D-074)

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
chooses one, and the build says so (`evidence.nature: hypothetical`); D-074 keeps those choices. The Gen 4 OU sample team keeps its authored
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

## How each spread was checked: the 6v6 confirmation (D-074)

The duel model ranks spreads one-on-one, but a 6v6 battle also asks a Pokémon to switch into hits, revenge-kill and
sweep. So each member was played both ways:

- **The two arms.** The whole team, once with the duel spread and once with the *conventional* spread (252 in its
  attacking stat, 252 Speed, 4 HP), **on the same nature**.
- **The battles.** Against the whole league, with the same seeds, trainer agents on both sides, and 20 battles per
  opponent per arm.
- **The rule (D-074, Zack):** *"Tie goes to the conventional spread, keep the natures."* The conventional spread is
  played unless the duel spread is measurably better: McNemar p < 0.05 with more wins, or a 95% HP-margin interval
  entirely in its favour. The natures stay whichever spread is played: the recorded ones, and the optimizer's picks
  where none is on record.

**What the battles chose for your three sixes: 16 of 18 conventional, 2 duel.**

| Outcome | Members |
|---|---|
| Duel spread, measurably better | **Crobat** (HeartGold) and **Empoleon** (SoulSilver), both on HP margin. The sheet build of **Tyranitar** too (a variation) |
| Conventional, measurably better | **Mamoswine** (HeartGold, 96.8% vs 93.6%, p = 0.039) and **Pikachu** (SoulSilver, 89.1% vs 85.9%, p = 0.039). Light Ball Pikachu too, on HP margin |
| Conventional, a tie | The other fourteen, and the January Typhlosion, January Empoleon and former-six Gyarados variations |

So the bulky duel spreads that looked odd (Mamoswine with no Attack, Platinum's Infernape with no attacking EVs) are
gone. Mamoswine's was measurably worse in battle. In the tables, a negative HP margin means the duel spread finished
with more of its team's HP than the conventional one did.

### HeartGold (against heartgold-league, 62 opponent Pokémon)

| Pokémon | Nature | Plays | Duel-model spread | Duel model, fresh wins (worst / typical): duel · conventional | 6v6: wins, duel vs conventional | HP margin, conventional − duel (95%) | p |
|---|---|---|---|---|---|---|---|
| Typhlosion | Mild (chosen) | **conventional** (4 HP / 252 SpA / 252 Spe) | 236 HP / 8 Atk / 16 Def / 156 SpA / 8 SpD / 84 Spe | 39 / 43 · 35 / 40 | 95% vs 94.1% | -0.01 [-0.03, 0.01] | 0.726563 |
| Tyranitar | Jolly (chosen) | **conventional** (4 HP / 252 Atk / 252 Spe) | 48 HP / 172 Atk / 48 Def / 4 SpD / 236 Spe | 44 / 46 · 44 / 46 | 92.7% vs 92.7% | -0.005 [-0.019, 0.01] | 1 |
| Mamoswine | Adamant | **conventional** (4 HP / 252 Atk / 252 Spe) | 248 HP / 4 Def / 12 SpD / 244 Spe | 45 / 49 · 41 / 48 | 93.6% vs 96.8% | +0.023 [0.005, 0.041] | 0.039062 |
| Crobat | Jolly | **duel** | 168 HP / 240 Atk / 84 Def / 16 SpD | 35 / 42 · 27 / 34 | 95.9% vs 93.6% | -0.02 [-0.036, -0.004] | 0.0625 |
| Lapras | Calm | **conventional** (4 HP / 252 SpA / 252 Spe) | 172 HP / 160 Def / 132 SpA / 44 Spe | 38 / 39 · 36 / 39 | 96.4% vs 96.4% | -0.008 [-0.031, 0.015] | 1 |
| Snorlax | Careful | **conventional** (4 HP / 252 Atk / 252 Spe) | 112 HP / 236 Atk / 144 Def / 16 SpD | 43 / 45 · 41 / 43 | 95.9% vs 96.8% | +0.01 [-0.01, 0.029] | 0.6875 |

### SoulSilver (against heartgold-league, 62 opponent Pokémon)

| Pokémon | Nature | Plays | Duel-model spread | Duel model, fresh wins (worst / typical): duel · conventional | 6v6: wins, duel vs conventional | HP margin, conventional − duel (95%) | p |
|---|---|---|---|---|---|---|---|
| Pikachu | Naughty (chosen) | **conventional** (4 HP / 252 Atk / 252 Spe) | 48 HP / 252 Atk / 84 Def / 124 Spe | 12 / 14 · 10 / 10 | 85.9% vs 89.1% | +0.01 [-0.004, 0.024] | 0.039062 |
| Dragonite | Adamant (chosen) | **conventional** (4 HP / 252 Atk / 252 Spe) | 188 HP / 68 Atk / 252 Spe | 47 / 49 · 47 / 47 | 86.4% vs 85% | -0.019 [-0.047, 0.01] | 0.607239 |
| Infernape | Lonely (chosen) | **conventional** (4 HP / 252 Atk / 252 Spe) | 76 HP / 228 Atk / 32 SpA / 148 SpD / 24 Spe | 38 / 40 · 35 / 40 | 86.8% vs 85.9% | +0.003 [-0.013, 0.018] | 0.625 |
| Empoleon | Quiet (chosen) | **duel** | 164 HP / 92 Def / 252 SpA | 44 / 45 · 38 / 39 | 87.3% vs 83.6% | -0.043 [-0.071, -0.015] | 0.096252 |
| Gengar | Modest (chosen) | **conventional** (4 HP / 252 SpA / 252 Spe) | 244 HP / 60 Def / 68 SpA / 116 SpD / 20 Spe | 35 / 38 · 29 / 34 | 87.7% vs 86.8% | -0.022 [-0.05, 0.006] | 0.823803 |
| Scizor | Adamant (chosen) | **conventional** (4 HP / 252 Atk / 252 Spe) | 224 HP / 248 Atk / 32 Def / 4 Spe | 35 / 37 · 31 / 34 | 88.2% vs 86.4% | -0.015 [-0.04, 0.009] | 0.387695 |

### Platinum (against platinum-league, 52 opponent Pokémon)

| Pokémon | Nature | Plays | Duel-model spread | Duel model, fresh wins (worst / typical): duel · conventional | 6v6: wins, duel vs conventional | HP margin, conventional − duel (95%) | p |
|---|---|---|---|---|---|---|---|
| Infernape | Lax (chosen) | **conventional** (4 HP / 252 Atk / 252 Spe) | 252 HP / 168 Def / 84 Spe | 30 / 30 · 22 / 26 | 96.5% vs 97% | -0.008 [-0.031, 0.015] | 1 |
| Weavile | Jolly | **conventional** (4 HP / 252 Atk / 252 Spe) | 252 HP / 220 Atk / 32 Def / 4 Spe | 26 / 30 · 16 / 24 | 98% vs 99.5% | -0.017 [-0.039, 0.005] | 0.375 |
| Roserade | Timid | **conventional** (4 HP / 252 SpA / 252 Spe) | 188 HP / 12 Def / 160 SpA / 148 Spe | 20 / 24 · 18 / 22 | 95.5% vs 96% | -0.004 [-0.02, 0.012] | 1 |
| Lucario | Careful (chosen) | **conventional** (4 HP / 252 Atk / 252 Spe) | 76 Atk / 180 SpD / 252 Spe | 20 / 26 · 20 / 26 | 98% vs 96.5% | -0.004 [-0.017, 0.009] | 0.453125 |
| Garchomp | Adamant (chosen) | **conventional** (4 HP / 252 Atk / 252 Spe) | 100 HP / 220 Atk / 80 SpD / 108 Spe | 50 / 50 · 48 / 48 | 98% vs 98% | +0.007 [-0.018, 0.031] | 1 |
| Magnezone | Modest | **conventional** (4 HP / 252 SpA / 252 Spe) | 252 HP / 252 SpA / 4 SpD | 22 / 26 · 22 / 28 | 97.5% vs 96.5% | -0.006 [-0.028, 0.016] | 0.6875 |

*Printed by `node cli/optimizer-table.mjs` from `fixtures/optimizer/<game>.json` and `<game>.confirm.json`. "Duel
model" is the one-on-one model's fresh wins, worst case / typical, for each spread on the same nature.*

## What the battles say about D-072

Each team against its whole league, twice, with the same seeds: once on the optimized spreads (as D-074 settled them)
and once on 85 in every stat (`node cli/league.mjs`, `results/league/`):

| Team | Wins on 85 each | Wins optimized | McNemar p | HP margin gained (95%) |
|---|---|---|---|---|
| HeartGold | 197 of 220 (90%) | 209 of 220 (95%) | 0.004 | +0.091 [0.052, 0.130] |
| SoulSilver | 163 of 220 (74%) | 193 of 220 (88%) | < 0.0001 | +0.161 [0.113, 0.208] |
| Platinum | 178 of 200 (89%) | 196 of 200 (98%) | 0.0001 | +0.092 [0.045, 0.139] |

The optimized spreads win more in all three games, by margins the pairing can see. Most of the gain is in the
hardest matchups:

- **HeartGold vs Bruno's rematch:** from 1 of 20 to 10 of 20.
- **SoulSilver vs Lance:** from 3 of 20 to 14 of 20.

The HP margin is the share of your team's HP left minus the opponent's at the end of each battle. It's finer-grained
than win or loss, and it moves by 9–16 points in every game.

## What to look at before you trust a spread

- **Three chosen natures don't suit the spread the battles picked.** The optimizer chose them for the bulky duel
  spreads, and D-074 keeps them:
  - Platinum's Infernape is Lax (+Def), now on 252 Atk / 252 Spe;
  - Lucario is Careful (+SpD), on 252 Atk / 252 Spe;
  - the January Empoleon variation is Quiet (−Spe), on 252 SpA / 252 Spe.

  If you'd rather a chosen nature follow the spread that's played, that's a small change to `withConventional`.
  Recorded natures (Lapras Calm, Snorlax Careful) are yours and stay regardless.
- **Natures where none was on record are the optimizer's choice,** marked hypothetical on the build: Typhlosion Mild,
  Tyranitar Jolly, all six SoulSilver natures, and Platinum's Infernape, Lucario and Garchomp.
- **The model is a duel model.** It doesn't see setup, status, recovery, hazards or teammates. The 6v6 check covers
  those, at 20 battles per opponent per arm. That's enough to catch a spread that's clearly worse, not one that's a
  point or two worse.
- **Exact thresholds stay with the one-on-one engine.** Showdown and the calculator differ by 1–3 HP in a few
  damage cases (`TEST_REPORT.md`). The optimizer uses the calculator, as the one-on-one engine does.

## Rerun

```
node cli/make-fixtures.mjs        # the optimizer, every team and pool, from the Trainer Library (about 16 s)
node cli/confirm-spreads.mjs      # the 6v6 check, every member and every variation (about 3 minutes on 3 workers)
node cli/league.mjs               # each team against its league, plus the D-072 check (about a minute on 3 workers)
node cli/optimizer-table.mjs      # the tables on this page
```
