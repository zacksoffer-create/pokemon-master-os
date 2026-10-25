# The trainer agents

*Two ways a trainer can be played. **The trainer agent** (`src/agents/trainer.js`) is Blackthorn's reading: explainable
tactical play with the trainer's identity on top. It decides from what its side can know, prices every option in one
currency, and keeps its reasons with every decision. **The cartridge AI** (`src/agents/cartridge.js`) is the game's
own trainer AI, for playing a game trainer as the cartridge does. Neither stands in for the other: an experiment
names which one played (section "Interpretations" in `HOW_IT_WORKS.md`).*

## What it knows

| Its own side | Everything: its builds (it's its team), current HP, status, boosts, items |
|---|---|
| The foe in front of it | Species, level, HP as a percentage, status, boosts; moves, item and ability **as they are revealed**. A species with only one possible ability is known (Gengar's Levitate) |
| The foe's unknowns | Unrevealed moves are stood in for by a STAB attack of each of its types, physical or special by its higher attacking stat. Unknown EVs are assumed (`foe_evs`, Blackthorn's 85 by default) |
| The foe's real Speed | Learned from turn order: if it moved first with the same priority when it shouldn't have, its Speed estimate goes up (a hidden Choice Scarf gets noticed) |
| The rest of the foe's team | Only what has come out (Gen 4 has no team preview) and how many are left |

It never reads the battle object. Damage comes from `@smogon/calc` 0.12.0, the one-on-one engine's calculator.

## How it decides

Every legal option gets a value in **HP percentage points swung**, against one picture of the turn (the turn model):

- **The hit that's coming:** the foe's best expected attack × its chance to hit (accuracy, evasion stages, No Guard,
  Compound Eyes, Hustle, Sand Veil, Bright Powder, Thunder and Blizzard in weather) × the chance the foe acts at all
  (0 while it recharges; asleep by its sleep counter, Rest exactly two turns; frozen 1 in 5; paralysed 3 in 4;
  confused 1 in 2). A foe locked into Outrage can only Outrage.
- **Whether this side acts:** the same odds for its own Pokémon, and the chance it's knocked out first.
- Every option that doesn't avoid the hit pays for it. A move that does nothing costs 15 more (a wasted turn).


| Option | Value |
|---|---|
| An attack | Damage dealt (capped at the foe's HP, times its chance to hit, times the chance it acts and lands before a KO), plus 45 × the chance it knocks out, minus the hit coming. Recoil, Explosion's cost, self-lowering moves and pivots adjust it. Moves that only work under a condition (Focus Punch, Dream Eater, Snore) are priced as failing when the condition isn't met. Counter and Mirror Coat return twice the hit when it's the right kind and they survive it; Fly and Dig count half (two turns); charge moves take the hit on the charge turn; Hyper Beam pays for the free turn it gives; Outrage pays 6 for locking in |
| A switch | How much better the knockout race is for the incoming Pokémon, minus the hit it takes coming in (the foe aims at what's in front of it) and hazard damage, minus a switching cost |
| Setup (Swords Dance, Dragon Dance...) | Only if it survives to use the boost: how much it shortens the knockout race, plus what the boost is worth against the foe's Pokémon still to come, more the less the current foe can hurt it |
| Recovery | HP healed, on what's left after the hit, more under the heal line; nothing when barely hurt. Protect avoids the hit and buys a turn |
| Status | Sleep, paralysis, burn and poison by value. Worth more against a healthy foe it can't quickly knock out; nothing against an immune or already-statused foe |
| Hazards | Per foe Pokémon still to come (each expected in about 1.5 times); nothing once at the maximum layers |
| After a faint | The Pokémon with the best knockout race against the foe, minus hazards; the ace held back unless its matchup is strong |
| Perish Song at 1 | Staying costs the whole Pokémon; switching out saves it |

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

**28 decision tests** (`test/trainer.test.mjs`): exact battle states where a sensible trainer's choice is clear.

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

Added with the turn model, from reading replays where the agent did something a player wouldn't:

- A recharging foe gives a free turn: it Dragon Dances rather than attacking into nothing.
- Counter against a physical hitter, Mirror Coat against a special one.
- Asleep from Rest, an attack does nothing this turn, and it says so.
- A useless move never beats a real attack, however hard the hit coming.
- No recovery into a faster foe that knocks it out first; no Roost at full HP.
- At Perish Song 1 it switches out rather than faint.
- +2 evasion makes a 100% move hit 60% of the time.
- No Hyper Beam when a near-equal attack doesn't leave it recharging.
- A foe locked into Outrage can only Outrage, so a Steel type comes in on it.
- Low and in range of anything, it takes the priority finisher.

**9 cartridge AI tests** (`test/cartridge.test.mjs`): BASIC reads the real target; EVAL_ATTACK's knockout bonuses;
EXPERT's healing quirk as the code is written; the switch checks (3, 6 and 7); the replacement after a faint; the
one-on-one rule is deterministic and dice depend only on the policy seed.

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

## The cartridge AI

`src/agents/cartridge.js`, ported from Blackthorn's one-on-one engine (`engine/battle/trainer_policy.py` and
`engine/battle/trainer_ai.json`, which cite the pret disassemblies). For playing a game trainer as the cartridge does.

**Move scoring.** Every move starts at 100, and the trainer's AI flags nudge it. The highest score is used, and ties
are broken at random, as in the game.

| Flag | Nudges |
|---|---|
| BASIC | −10 for a move that would fail: status on a statused or immune foe, a hazard already up, a stat already at its limit |
| EVAL_ATTACK | +4 for a knockout (+6 with priority); −1 if it isn't the strongest move; +2 for a 4× hit (69%); −2 for Explosion, Focus Punch and Sucker Punch |
| EXPERT | Healing: −3 at full HP, −8 when faster, −3 at 70% or more, +2 below 70%. Boosts: −1 at +3, −2 at 70% HP or less. Toxic and Leech Seed adjustments |
| SETUP_FIRST_TURN | +2 for set-up on the first turn (69%) |
| CHECK_HP | −2 for some moves at low HP (80%) |
| PRIORITIZE_EXTREMES | +2 for the all-or-nothing moves (61%) |
| RISKY, HARRASSMENT | +2 for their moves (50%) |

**Switching.** Before it moves, the game's switch checks run in order (Gen 4 `ShouldSwitch`, checks 1–7). After a
faint, the replacement is the bench Pokémon with the best super-effective matchup, else the one that does the most
damage.

**What it knows.** It reads what the cartridge reads: the real stats, HP, ability and item of the Pokémon in front of
it. The battle runner hands it that view (`information: 'cartridge'`), and every decision says so.

**Dice.** With dice on (the default), each nudge is rolled at the game's odds from the policy seed. With dice off, a
nudge counts when it happens more often than not and coin flips are left out. That's the one-on-one engine's rule, so
the two engines then agree move for move (`test/cartridge.test.mjs`).

**Not modelled:**
- **Bag items.** Showdown has no item action.
- **AI_FLAG_BATON_PASS.**
- **AI_FLAG_WEATHER's first-turn quirk.** BASIC covers its net effect.

## What it doesn't do yet

- **Predict switches.** It doesn't predict the opponent's switch, and it doesn't double-switch.
- **Use most odd status moves:** Trick, Encore, Taunt, Baton Pass chains and weather moves get no plan and score low.
- **Plan more than one turn ahead,** beyond setup's sweep value.
- **Use trainer bag items** (either agent): Showdown has no item action.
