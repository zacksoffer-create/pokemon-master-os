# The trainer agent (Phase 3)

*`src/agents/trainer.js`. Explainable tactical play with a trainer's identity on top. It decides from what its side
can know, prices every option in one currency, and keeps its reasons with every decision.*

## What it knows

| Its own side | Everything: its builds (it's its team), current HP, status, boosts, items |
|---|---|
| The foe in front of it | Species, level, HP as a percentage, status, boosts; moves, item and ability **as they are revealed**. A species with only one possible ability is known (Gengar's Levitate) |
| The foe's unknowns | Unrevealed moves are stood in for by a STAB attack of each of its types, physical or special by its higher attacking stat. Unknown EVs are assumed (`foe_evs`, Blackthorn's 85 by default) |
| The foe's real Speed | Learned from turn order: if it moved first with the same priority when it shouldn't have, its Speed estimate goes up (a hidden Choice Scarf gets noticed) |
| The rest of the foe's team | Only what has come out (Gen 4 has no team preview) and how many are left |

It never reads the battle object. Damage comes from `@smogon/calc` 0.12.0, the one-on-one engine's calculator.

## How it decides

Every legal option gets a value in **HP percentage points swung**:

| Option | Value |
|---|---|
| An attack | Damage dealt (capped at the foe's HP, times accuracy, times the chance it lands before a KO), plus 45 × the chance it knocks out, minus damage taken this turn. Recoil, Explosion's cost, self-lowering moves and pivots adjust it. Moves that only work under a condition (Focus Punch, Dream Eater, Snore) are priced as failing when the condition isn't met |
| A switch | How much better the knockout race is for the incoming Pokémon, minus the hit it takes coming in (the foe aims at what's in front of it) and hazard damage, minus a switching cost |
| Setup (Swords Dance, Dragon Dance...) | Only if it survives to use the boost: how much it shortens the knockout race, plus what the boost is worth against the foe's Pokémon still to come, more the less the current foe can hurt it |
| Recovery | HP healed if it outpaces the damage coming back, more under the heal line; nothing when barely hurt |
| Status | Sleep, paralysis, burn and poison by value. Worth more against a healthy foe it can't quickly knock out; nothing against an immune or already-statused foe |
| Hazards | Per foe Pokémon still to come (each expected in about 1.5 times); nothing once at the maximum layers |
| After a faint | The Pokémon with the best knockout race against the foe, minus hazards; the ace held back unless its matchup is strong |

The **race** between two Pokémon is the foe's hits to knock it out minus its hits to knock the foe out, ±½ for who
moves first.

## Identity (0–100 each)

| Setting | What it changes | Default | Read from the Trainer Library |
|---|---|---|---|
| aggression | Weight on damage dealt vs damage taken; how readily it stays in | 50 | authored *offense* slider; coach *aggression* |
| risk | How much an inaccurate move is discounted | 40 | authored *risk* slider; coach *risk tolerance*; AI flag "takes risks" |
| patience | How much HP it will have lost and still set up; the value of setup | 50 | coach *patience* |
| heal_line | Heals at or under this HP % | 40 | coach *heal line* |
| switching | How readily it switches out of a bad matchup | 60 | 100 − 0.6 × authored *rigidity* slider |
| preservation | How much it protects its ace | 50 | authored *bond* slider |
| harassment | Value of status moves | 50 | AI flag "status and harassment" |
| setup_first | A push to set up on the first turn | 0 | AI flag "sets up early" |
| competence | How reliably it takes the best option: 100 always does; lower picks among close options at random | 90 | 55 + 12 per cartridge competence flag (Cynthia and Lance: 91) |
| foe_evs | What it assumes the foe invested | 85 | — |

Every library-derived setting records where it came from (`profile.tendencies.read_as`).

## How it's tested

**17 decision scenarios** (`test/trainer.test.mjs`): exact battle states where a sensible trainer's choice is clear.

- Finishes a faster foe with priority.
- Never Earthquakes a Flying type, and knows Gengar's Levitate.
- Switches Typhlosion out of Swampert into Lapras.
- Swords Dances in front of a passive Skarmory, but not when it would be knocked out first.
- Roosts when healing outpaces the damage, but not at 90%.
- Lays Stealth Rock early, and not twice.
- Spores a healthy Snorlax, but not a sleeping one.
- Sends Lapras in after a faint against Garchomp.
- Switches out when Choice-locked into a resisted move.
- Holds Explosion at full HP.
- Cautious and aggressive trainers diverge on a threatened ace, and the library mapping is correct.

**Batch tests** (`test/trainer-batch.test.mjs`):

- It beats the max-power and random baselines in a mirror match, with the 95% lower bound above 70%. Measured:
  40–0 and 39–1 of 40.
- A switch-happy profile switches measurably more than a stubborn one: 12.8% of its choices against 5.5%.
- A patient profile sets up more: 2.5% against 0.2%.
- A low-competence trainer wins less: at competence 30 it wins 2 of 40 against a default trainer; at 100, 22.

**Whole leagues** (`results/league/`): trainer agents on both sides, each game trainer's settings read from the
Trainer Library, 1,280 battles with no invalid choice and no failure. Results by team are in `TEST_REPORT.md`.

Building the scenarios found three real gaps, now fixed:

- **Focus Punch** fails if the user is hit first.
- **Stealth Rock** was valued at one switch-in per foe instead of about one and a half.
- **The matchup estimate** counted conditional moves as usable.

## What it doesn't do yet

- **Predict switches.** It doesn't predict the opponent's switch, and it doesn't double-switch.
- **Use most odd status moves:** Trick, Encore, Taunt, Baton Pass chains and weather moves get no plan and score low.
- **Plan more than one turn ahead,** beyond setup's sweep value.
- **Model the cartridge's own AI scoring.** For game trainers, the AI flags shape this agent's settings instead.
