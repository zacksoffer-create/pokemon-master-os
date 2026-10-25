# How the 6v6 engine works, end to end

*Everything the engine does, in the order it does it, with every number you might want to argue with and where it
lives in the code. The point of the engine is insight: how trainers, builds, leads and styles change what a team does,
and how far the battles let you trust each answer. Read this to decide whether you agree with the logic.*

## 1. The questions it answers

| Question | Experiment | What comes back |
|---|---|---|
| How does my team do against a pool, and why? | `league` | The Strategy Report (section 7) and every battle, replayable |
| What does this change do? (a lineup variation, an edit, another team) | `compare` | What changed in the builds, which one-on-one matchups and knockout thresholds moved, and the battles paired seed for seed |
| Does the best build depend on how the opponent plays? | `matrix` | Builds × trainer styles, with a flip claimed only when it's significant |
| Who should lead? | `leads` | Each of the six as the lead, each paired against the current lead |
| How should my trainer play this team? | `styles` | Your trainer at default, cautious, aggressive and sharp, paired |
| What actually moves the result? | `sensitivity` | One change at a time (opponent style, opponent EVs, your style, your EVs, each variation), ranked by effect |
| What if I'd played that turn differently? | `battle` + `coach` | One battle turn by turn with every decision's reasons; "try from here" plays it on many times both ways |

All of these run in the 6v6 Lab page (on your device) and from the command line (`cli/lab.mjs`, every core of the
machine). They give the same numbers in both places.

## 2. The pipeline

```
Trainer Library (read-only)                 the lab pack (fixtures/lab/pack.json)
  versions, parties, AI flags,   ──make──▶    your teams + lineup variations
  coach settings, collections   fixtures      19 opponent pools, 161 opponent teams
                                              each trainer's profiles (Blackthorn's reading, the game's AI)
                                                     │
          spec (question + team + pool + style + n)  ▼
                          experiments.js ── jobs ──▶ runner (this thread · Node workers · Web Workers)
                                                     │  each battle: Showdown's Gen 4 engine,
                                                     │  an agent on each side deciding from its own view
                                                     ▼
                          rows (winner, turns, knockouts, per-Pokémon analysis, the input log)
                                                     │
                     pool results · paired comparisons · the Strategy Report · the experiment record
```

A **spec** is the whole question: which experiment, which team(s), which pool, how the opponents play, how your trainer
plays, how many battles per opponent, and optionally a seed. Two runs of the same spec on the same engine play exactly
the same battles, so a recorded result can always be reproduced. That's the **fingerprint**: a hash of every
battle's seed, winner, turns and log.

## 3. The teams

**Yours.** HeartGold, SoulSilver and Platinum, read from the Trainer Library with every gap fill written down on the
build (`filled`). They carry full 510-EV spreads (D-072):

1. The **EV optimizer** (`src/optimize/evs.js`, `docs/EV_OPTIMIZER.md`) scores spreads by one-on-one duels against
   every Pokémon in the team's league (Smogon's calculator, worst and typical rolls, three entries: fresh, switching
   in on a hit, given a free hit). It starts from Blackthorn's EV templates and climbs. Where no nature is on record
   it picks one that never lowers a stat the set attacks with.
2. Each spread is then **checked in 6v6** (`src/optimize/confirm.js`): the whole team plays the whole league twice on
   the same seeds, once with the duel spread and once with the conventional spread (252 in the attacking stat, 252
   Speed, 4 HP), on the same nature.
3. **D-074:** the conventional spread is played unless the duel spread is measurably better (McNemar p < 0.05 with
   more wins, or a 95% interval on the HP margin entirely in its favour). The natures stay: the recorded ones, and
   the optimizer's picks where none is on record.

**Lineup variations** (`fixtures/teams/variation-*`) are your other recorded lineups and builds (the January
Typhlosion, the sheet Tyranitar, Light Ball Pikachu, the former SoulSilver six, the January Platinum Empoleon). A
changed member keeps its nature unless the variation names one, and its EVs go through the same optimizer and check.

**Opponents.** Every Trainer Library opponent fights at Lv 100 on 85 EVs in every stat (D-072). The cartridge's real
zero EVs stay available as a what-if (`sensitivity` runs it). IVs come from the library; one bad record (Volkner's
Electivire, IVs of 303) is clamped to 31 and flagged on the build.

**Pools.** The two leagues (each game's Elite Four, Champion, rematches, and Red for HG/SS), the library's collections
as pools (Gym Leaders, rematches, rivals, villains, special battles, the Ace test pools, the anime reconstructions),
and your journey teams. Anime teams are reconstructions, so they're checked structurally only (ruleset
`gen4-historical`); their cartridge problems are listed on each team.

**Legality.** Every team is checked before it plays: structural (it's a real set), obtainable (on a Gen 4 cartridge,
learnsets included), and the format's own rules. A team that fails doesn't play.

## 4. Who decides

Both sides are played by an **agent** that sees the battle only through its own side's log (`src/observer.js`), the
way a player does. Three kinds:

### The trainer agent (Blackthorn's reading, and your trainer)

`src/agents/trainer.js`. It prices every legal option in one currency, **HP percentage points swung**, from what it
can know: its own team fully, the foe only as revealed. Unseen moves are stood in for by attacks of the foe's types,
unseen EVs are assumed at 85, and its Speed is learned from turn order.

**The turn model.** Every option is valued against the same picture of the turn:

- **The hit that's coming** is the foe's best expected attack × its chance to hit × the chance the foe acts at all.
  - Chance to hit covers accuracy, evasion and accuracy stages, No Guard, Compound Eyes, Hustle, Sand Veil/Snow
    Cloak, Bright Powder, and Thunder and Blizzard in weather.
  - The foe acts with probability 0 while it recharges; asleep by its sleep counter (Gen 4: 1–4 sleeping turns,
    Rest exactly 2); 1 in 5 frozen; 3 in 4 paralysed; 1 in 2 confused.
  - A foe locked into Outrage can only Outrage.
- **Taken cost** = that hit × a defence weight × the Pokémon's own weight (more for your ace while others remain).
- A Pokémon at 25% or less facing a foe with unseen moves carries a small **unseen-priority risk** (0.15).

**An attack** is worth: damage dealt (capped at the foe's HP) × the chance it hits × the chance it acts before being
knocked out, plus **45 × the knockout chance**, minus the taken cost. Tie-breaks favour priority and accuracy.

**Special cases:**

| Case | How it's handled |
|---|---|
| Counter / Mirror Coat | Twice the incoming hit if it's the right kind and it survives |
| Fly, Dig, Bounce, Dive, Shadow Force | Half value: two turns, out of reach on the first |
| Solar Beam and other charge moves | Half the effect, and the full hit taken on the charge turn (Solar Beam in sun fires at once) |
| Hyper Beam and other recharge moves | Pay for the free turn they give away |
| Outrage / Thrash / Petal Dance | −6 for locking in |
| A wasted turn | A move that does nothing (Roost at full HP, status on a statused foe) costs **15** on top of the hit |
| Perish Song at 1 | Staying costs the whole Pokémon; switching saves it |

**Status moves** subtract the same incoming hit:
- **Set-up** only if it lives to use the boost: how much the boost shortens the knockout race, plus its worth against
  the foes still to come.
- **Recovery** is valued on the HP left after the hit.
- **Protect** sets the hit to zero and buys a turn.
- **Status** is worth more against a healthy foe it can't quickly knock out.
- **Hazards** are valued per foe Pokémon still to come.

**A switch**:
- **Gain:** how much the knockout race improves for the Pokémon coming in, at **14 points a hit**, capped at ±3 hits.
- **Minus** the hit it takes coming in (the foe aims at what's in front of it) and the hazards.
- **Minus** a switching cost of **8 + 22 × (1 − switching / 100)**, plus 10 if it just switched.

**After a faint**, the replacement is the bench Pokémon with the best knockout race, minus hazards. The ace is held back
unless its matchup is strong.

**Identity** (0–100 each) shifts the parts:

| Setting | What it changes |
|---|---|
| aggression | Damage dealt weighs 0.8–1.2, damage taken 1.2–0.8 |
| risk | How much inaccuracy is discounted |
| patience | How much HP it will have lost and still set up |
| heal_line | When it heals |
| switching | Its switching cost |
| preservation | How much it protects the ace |
| harassment | The value of status |
| setup_first | A push to set up on the first turn |
| competence | How reliably it takes the best option (below) |

**Competence** works like this:
- At 99 or more it always takes the best option.
- Below that it picks with weight e^((value − best) / T), where **T = 1 + 0.35 × (100 − competence)**.
  - At 90 (T 4.5), options within a few points of the best get picked sometimes.
  - At 55 (T 16.75), it plays loosely.

**Where each trainer's settings come from.** A game trainer's identity is read from the Trainer Library:
- the authored sliders;
- the coach settings;
- the game's AI flags, read as competence (55 + 12 per competence flag: Cynthia and Lance 91) and as tendencies.

Every setting records where it came from. Your trainer uses the defaults until you set coach settings for a lineup.

Every decision is recorded with:
- every option's value;
- the reasons for the top options;
- what it assumed: the foe's EVs, its Speed, the stand-in moves, the foe's ability and the hit it expected.

That's what the Lab's battle viewer shows.

### The cartridge AI ("as the game plays them")

`src/agents/cartridge.js`, ported from Blackthorn's one-on-one engine (`engine/battle/trainer_policy.py`), which cites
the pret disassemblies line by line.

**Move scoring.** Every move starts at 100 and each of the trainer's AI flags nudges it:
- **BASIC:** −10 for a move that would fail (status on a statused foe, a hazard already up, an immunity).
- **EVAL_ATTACK:** +4 for a knockout (+6 with priority); −1 if it isn't the strongest; +2 for a 4× hit, 69% of
  the time.
- **EXPERT:** the heal and boost rules, with their HP thresholds.
- **SETUP_FIRST_TURN, CHECK_HP, PRIORITIZE_EXTREMES, RISKY, HARRASSMENT:** each at its documented odds.

The highest score is used, and ties are broken at random, as in the game.

**Switching.** The game's switch checks run first, in their order (Gen 4 `ShouldSwitch`, checks 1–7). After a faint,
the replacement is the best super-effective matchup, else the most damage.

**What it knows.** It reads what the cartridge reads: the real stats, HP, ability and item of the Pokémon in front of it.

**Two modes:**
- **Dice (the default):** nudges are rolled at the game's odds.
- **Without dice:** a nudge counts when it happens more often than not. The one-on-one engine uses that rule, so the
  two then agree move for move.

**Not modelled:** bag items, because Showdown has no item action. A trainer without AI flags (anime, your teams)
plays Blackthorn's reading instead, and the experiment says so (`fell_back`).

### Interpretations

The same trainer can be played different ways. An interpretation is a reading of who they are, never a substitute
for one another:

| Interpretation | What it does | Shift |
|---|---|---|
| As the game plays them | The cartridge AI | — |
| Blackthorn's reading | The trainer agent with the library's identity | — |
| Aggressive | Blackthorn's reading, pushed toward attacking | aggression +30, risk +20, switching −25, preservation −25, patience −15 |
| Cautious | Blackthorn's reading, pushed toward safety | aggression −30, risk −20, switching +25, preservation +30, heal line +15 |
| At their sharpest | Blackthorn's reading, always the best option | competence 100 |
| Off their game | Blackthorn's reading, picking loosely among close options | competence 55 |

Your trainer can be played the same ways (the `styles` experiment, the Lab's "your trainer" setting).

## 5. The battles themselves

**Showdown does the rules.** Showdown's Gen 4 simulator (`@pkmn/sim` 0.10.11, pinned) does every mechanic: damage,
accuracy, critical hits, status, weather, items, abilities, hazards and switching. Agents only choose.

**Seeds:**
- Each battle's seed is derived from the experiment's seed, the opponent and the battle's number.
- Each agent has its own policy seed, so a trainer's dice don't move the battle's.

**Mirrored pairs.** Battles come in pairs: the same seed played from both sides (p1 and p2 swapped), so neither team
gets the engine's side advantage.

**Replay.** A battle keeps its input log, so it can be replayed exactly. **"Try from here"** replays the first k
choices, then reseeds and plays on. It plays both arms (as played, and with your change) on the same new seed for each
replay. The difference between the arms is then the call, not the dice.

## 6. The numbers

**Win rates** come with 95% Wilson intervals.

**Comparisons are paired.** Both arms play the same opponents on the same seeds, battle for battle.
- **McNemar's exact test** on the pairs that only one arm won.
- A **paired interval on the win-rate change.**
- A **paired interval on the HP margin**: how much of your team is left at the end, minus theirs. The margin moves
  before wins do, so near the ceiling it's the more sensitive measure. `sensitivity` ranks by it when the base win
  rate is 90% or more.

**Adaptive comparisons** (`--adaptive 10,40`) play 10 battles per opponent, then 10 more at a time up to 40. They stop
early when:
- the difference is already clear at **p < 0.01** (stricter than the final 0.05, because it looks more than once); or
- the interval sits inside **±3 points** (there's no difference worth finding).

The record says how many it played and why it stopped.

**"Not significant" means the battles can't tell yet.** It doesn't mean there's no difference. Every reading says
which.

## 7. The Strategy Report

`src/report.js`. Four levels, as the master plan asks:

1. **Outcomes:** overall and by opponent, with intervals; turns; how many were left in wins; close wins.
2. **Each Pokémon:**
   - knockouts a battle and their share;
   - damage dealt, taken and healed (% of HP a battle);
   - set-up and support use;
   - how often it falls first and how often it closes wins.

   A one-line reading names its role. Members are matched by their battle name, so two of a species stay apart.
3. **The team:**
   - **Threats:** their Pokémon by species, counted once per battle (Lance's three Dragonite are one threat in one
     battle). Each threat lists knockouts each time it appears, its share of your losses, and whom it's hardest on.
   - **Dependencies:** your win rate when a Pokémon is one of the first two to fall, against otherwise. These are
     associations, not causes.
   - **Damage taken by type,** and which of your six are weak to each type.
   - **Sequencing:** who opens and who closes.
4. **How far to trust it:**
   - **Holds up:** the overall interval is within 12 points.
   - **Depends on the opponent:** a weak spot whose interval sits below the pool's, or a member whose share of the
     knockouts swings 40+ points across opponents.
   - **Needs more battles:** matchups between 30% and 70%.

**Patterns** are hypotheses with their evidence. Each one names the experiment that would test it:

| Pattern | When | Next experiment |
|---|---|---|
| A threat runs through the team | ≥ 5 losses, in ≥ 30% of them, ≥ 1.5 knockouts each time (strong at 50%) | Watch the loss it sweeps |
| The team leans on one Pokémon | win-rate gap ≥ 15 points when it falls early (≥ 8 battles each way, ≥ 12% of the knockouts; strong at 30) | Your trainer cautious, compared |
| A type is your biggest cost | ≥ 30% of damage taken, ≥ 3 of six weak (strong at 45%) | A note for team building |
| The lead struggles | falls first in ≥ 40% and below the team's mean knockouts | Best lead |
| Set-up rarely pays | sets up ≥ 0.3 times a battle, < 0.5 knockouts | Your trainer aggressive, compared |
| A species without its own item | e.g. Pikachu without Light Ball (strong) | Its variation, or the editor |
| Too close to call | an opponent between 30% and 70% | 60 battles against just those |

The engine never invents items, moves or natures for your teams. Those are build decisions, so they surface as
patterns for you to test.

## 8. The Lab page

**On the page.** A browser page with the whole engine, the lab pack and a recorded Node run of each journey team's
league inside it. It opens on the recorded run.

**Run it here.** It plays the same battles on your device in Web Workers, falling back to the page itself when
workers aren't allowed. When the spec matches the recorded one, it checks the fingerprint: same battles, battle for
battle.

**Every finished run is saved** in the page's own store as a permanent record. The record keeps:
- the spec;
- the engine, contract and build versions;
- every number and the report.

A later engine can rerun it without erasing the original.

**The build editor:**
- change moves (Gen 4 learnsets), item, ability, nature, EVs and the lead;
- work out the conventional or duel-model spread on that nature;
- check legality;
- compare the edit with the original on the same battles.

Edits never touch Blackthorn's data.

**Speed:**
- about 55 ms a battle in one Node thread;
- 220 battles (a whole league at 20 per opponent) in about 5 s on three Web Workers in Chromium;
- `cli/lab.mjs` uses every core.

## 9. Every constant you might want to change

| Constant | Value | Where | What it does |
|---|---|---|---|
| Knockout bonus | 45 | `trainer.js` `KO_BONUS` | Worth of a knockout beyond its damage |
| Wasted turn | 15 | `trainer.js` `WASTED` | Cost of a move that does nothing |
| Race value | 14 a hit, ±3 hits | `trainer.js` `switchOut`, `sendIn` | How much a better matchup is worth |
| Switch cost | 8 + 22 × (1 − switching/100), +10 after a switch | `trainer.js` `switchOut` | Reluctance to switch |
| Unseen-priority risk | 0.15 at ≤ 25% HP | `trainer.js` `turnModel` | Fear of a move not yet seen |
| Lock-in cost | 6 | `trainer.js` `moveValue` | Outrage and the like |
| Defaults | aggression 50, risk 40, patience 50, heal line 40, switching 60, preservation 50, harassment 50, competence 90 | `trainer.js` `DEFAULT_PARAMS` | Your trainer until coached |
| Assumed foe EVs | 85 | `foe_evs` | What it assumes an unseen spread is |
| Opponent EVs | 85 each | D-072 | Every Trainer Library opponent |
| Interpretation shifts | table in section 4 | `src/adapters/collections.js` `INTERPRETATIONS` | Aggressive, cautious, sharp, off their game |
| Spread rule | conventional unless p < 0.05 or margin interval in favour | `confirm.js` `duelWins` (D-074) | Which spread your teams play |
| Adaptive stop | p < 0.01, or interval inside ±3 points | `compare.js` | When a comparison has its answer |
| Pattern thresholds | table in section 7 | `report.js` `patternsOf` | When the report raises a hypothesis |

All of these are provisional defaults (D-075), each one a line to change.

## 10. What it doesn't do yet

- **Predict the opponent's switch, or plan more than one turn ahead.** Set-up's sweep value is the one exception.
- **Choose a lead by itself.** The lead is your call, and `leads` measures it.
- **Use trainer bag items.** Showdown has no item action, so the cartridge's Full Restores aren't in the game AI.
- **Match the one-on-one engine's exact knockout thresholds.** Showdown and the calculator differ by 1–3 HP in a few
  cases (`TEST_REPORT.md`), so exact thresholds stay with the one-on-one engine.
- **Plug into the app.** It reads the Trainer Library and isn't part of the app yet (`docs/design/SIXVSIX_SEAM.md`).
