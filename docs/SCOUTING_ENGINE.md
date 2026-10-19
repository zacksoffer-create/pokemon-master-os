# The Scouting Engine (v1 design, 2026-10-19)

*"Design the engine… then have the lab so that we can use that engine and develop something I'm proud of… combine moves and what they do and damage and how movesets and type coverage and Smogon suggested movesets work… we have the PKHeX fields and all the data behind it."*

The rule for this engine: **it isn't tuned to any answer.** Every number comes from a definition written here, measured the same way for every team. The results are whatever the definitions produce, and the definitions are what we argue about.

## The two halves, and the join

| | NFL side: the **self-scout** | MLB side: the **advance report** |
|---|---|---|
| Question | What are we good at, and what are we trying to do? | How do we attack each of their Pokémon? |
| Unit | our moves as **plays**, each with a goal | their Pokémon as **hitters** |
| Organized by | **situations** (down and distance) | **our attack types** (pitch types) |
| Shape | play sheet + coach profile | one row per Pokémon |

**The game plan is the join:** their Pokémon down the side (MLB), situations across the top (NFL), and our call in every cell. Each call is chosen by our coach profile against what their Pokémon is likely to do.

## Layer 1: Knowledge (what things are)

- **Moves → plays.** Every move's goal comes from data, not a hand-made list. PokeAPI's move meta gives:
  - a category: damage, ailment, net-good-stats, heal, damage+ailment, damage+lower, damage+raise, damage+heal, OHKO, field effects, force-switch, unique;
  - its ailment and chance, stat changes, drain and healing %, flinch and crit chance, multi-hit, flags (contact, charge, recharge, punch, sound…) and target.

  Power, type, category and priority come from Smogon's per-generation data, so they're era-correct (Gen 2–3 physical/special by type). From these the engine derives each move's **plays**:

  | Play | Meaning |
  |---|---|
  | hit | damage |
  | boost | raise own stats |
  | debuff | lower the foe's |
  | status | poison, burn, paralysis, sleep, confusion… |
  | heal | restore HP |
  | drain | heal by hitting |
  | protect | block a hit |
  | pivot | hit, then switch |
  | phaze | force a switch |
  | field | hazards, screens, weather |
  | priority | moves first |
  | lock-in, charge, recharge | commits for more than one turn |
  | recoil | costs the user HP |
  | OHKO | one-hit knockout move |
  | self-KO | the user faints |
  | cure, taunt, encore, reset, sleep-talk, clear | Heal Bell/Refresh, Taunt, Encore, Haze, Sleep Talk, Rapid Spin/Defog |
- **Characters** are full specimens at PKHeX parity: species, level, nature, ability, item, IVs, EVs and moves, plus everything else PKHeX stores. The battle engine uses the battle-relevant fields exactly. Whatever a build leaves open gets a documented "peak of its powers" default (`battle/knowledge.py`), and the Combatant lists which defaults it used, so a report can say "assumed":
  - Lv 100;
  - IVs 31;
  - EVs 85 in every stat in Gen 3–4, maxed stat experience in Gen 2;
  - a neutral nature;
  - the first ability;
  - no item;
  - the engine's strongest set in any open move slot.
- **The field** is what a generation's players actually ran: the Smogon usage-stats sets for that generation's OU (48 Pokémon in Gen 2, 57 in Gen 3, 73 in Gen 4). Each set has moves, item, nature and EVs, at Lv 100. Teams are measured against this field, so the scales don't depend on the journey's own teams.

## Layer 2: Evaluation (what happens)

`battle/evaluate.py`. A matchup is played out as a small, deterministic one-on-one, not a full battle simulator:
- **Turn order:** each turn both sides pick a move, and higher priority, then the faster side, goes first. Speed counts paralysis, boosts, Choice Scarf, Macho Brace and Swift Swim/Chlorophyll.
- **Damage:** every hit comes from Smogon's calculator at the exact state of that hit (boosts, burn, weather, a pinch ability like Blaze), so the calculator's own effects all apply.
- **End of turn:** weather, Wish, Leftovers/Black Sludge, Leech Seed, poison, Toxic, burn, Speed Boost, the Orbs and Yawn.
- **Two rules keep it deterministic:**
  - every hit uses the **lowest damage roll**;
  - every move **lands**, and the chance that all of a side's moves land is kept as its **odds**.

**Plans.** Each side plays a plan: an *opening* (the moves it uses first) plus three *habits* it can have switched on.

| Part | What it does |
|---|---|
| Opening | a boost (once or twice), Substitute (alone or before a boost), a status move (alone or before its first boost), a stat drop, a screen, a weather move, Taunt |
| build | boosts on a free turn: when the foe can't hurt it |
| disrupt | phazes or Hazes a boosted foe; Encores a foe that just used a non-attacking move |
| sustain | heals when the next hit would knock it out, if the heal outpaces the hit; Rests when that comes out ahead; Protects to let poison or burn tick; cures its own damaging status |

Outside the plan, every side attacks the same way:
- it finishes the foe when it can, with priority if it must;
- otherwise it uses the attack with the **fewest expected turns to a KO** (hits needed ÷ accuracy);
- it turns to Explosion only when the race is lost anyway.

**The result is the maximin:** our best plan, judged against the foe's best answer from its own plans. Neither side is given a script.

**Credit.** A family (build, disrupt, sustain) gets credit when taking it out of the best plan makes the result worse. Results rank:
1. who wins;
2. then the odds;
3. then the HP margin;
4. then the length of the fight.

When removing a family changes the winner, the credit is **decisive**.

**Counted, noted, left out.**
- **Counted:** everything listed above.
- **Turned into fixed rules:** sleep (the floor of the mean of each generation's range: 3 turns in Gen 2, 2 in Gen 3–4), Rest (2 turns), Outrage-style locks (2 turns), and Encore and Taunt (the shortest of each range).
- **Noted, not counted:** secondary effects under 100% (Body Slam's paralysis, flinches), full paralysis, crits, confusion.
- **Left out of a one-on-one, because they're team plays:** hazards, Baton Pass, U-turn's switch, Trick, trapping, Perish Song.

Each report says which of these touched a fight.

## Layer 3: Profiles (who we are)

`battle/profile.py`.

### The coach profile (descriptive, 0–100 sliders)

Each slider is a share of a member's fights against the field. It describes style, not quality: a slider is a tendency, not a grade.

| Slider | Left ◀ ▶ Right | Measured as |
|---|---|---|
| **Pace** | absorbs first ◀ ▶ strikes first | share of fights where its first hit lands before theirs (attacking only) |
| **Punch** | chips ◀ ▶ knocks out | share of the field it knocks out in two hits or fewer from full, unboosted, lowest roll |
| **Run / pass** | special ◀ ▶ physical | physical share of the damage its calls deal (each call at its unboosted damage) |
| **Build-up** | hits now ◀ ▶ builds first | share of fights that a boost, Substitute, screen or weather play makes better |
| **Sustain** | no healing ◀ ▶ heals and resets | share that healing, Rest, Protect-stalling or curing itself makes better |
| **Disruption** | straight-up ◀ ▶ disruptive | share that status, a stat drop, Taunt, Encore or phazing makes better |
| **Risk** | safe ◀ ▶ gambler | share where its plan needs a move under 90% accuracy, or takes recoil, a lock-in, a charge turn or a faint |
| **Script** | adaptive ◀ ▶ scripted | share where its first call is its single most common first call |

"Makes better" counts any improvement. The share where it changes the winner ("decisive") is kept next to each slider. One-on-one, type matchups settle most fights, so the decisive share is small: it's reported, not used as the scale.

**Against the field.** The field gets the same treatment: every field member fights the whole field, and the result is cached in `engine/data/derived`. That turns each slider into a percentile:
- a member's against the field's players, one by one;
- a team's against 2,000 random six-Pokémon teams drawn from the field, with a fixed seed, because an average of six is smoother than any single player.

The **philosophy line** names the sliders furthest from the middle (at least 20 points away), each as its pole: for example "chips (p7), absorbs first (p7)".

### The coach settings (prescriptive, editable per lineup)

These are how the team wants to be called. They change the play sheet; they don't change the profile.

- **Aggression:** prefer the fastest knockout over a longer, safer plan.
- **Patience:** how much damage it accepts while setting up.
- **Heal line:** the HP% at which it heals instead of attacking.
- **Risk tolerance:** the lowest accuracy it will call in a normal situation.
- **Tempo:** when to spend priority (only to finish, or any time it wins the race).

## Layer 4: Situations and play sheets (what we call)

| Situation | Football | Pokémon state |
|---|---|---|
| Opening script | the first scripted plays | both at full HP, first turn |
| 1st and 10 | neutral down | both healthy |
| Short yardage | needs a little | target at about half: one solid hit finishes it |
| Goal line | at the goal | target under 25% |
| 3rd and long | behind the sticks | we're under the heal line, they're healthy |
| Blitz | they bring pressure | target has boosted (+1 or +2) |
| Two-minute drill | end of game | the last Pokémon on either side |

The **policy** picks the call in each situation from the race results and the coach settings. A member's **play sheet** is its call per situation against the field (the most common call) and against a specific opponent (that matchup's call).

**Opponents' policy** comes from the game's own AI flags, bag and battle lines. It predicts what each of their Pokémon calls in each situation: their play sheet, which is the MLB report's "tendencies".

## Layer 5: Reports and the lab

- **Self-scout:** the coach profile (sliders + philosophy), the play sheet, the repertoire (attack types and who throws them).
- **Advance report (MLB form):** their Pokémon × our attack types, plus their predicted plays by situation.
- **Game plan:** their Pokémon × situations → our calls, plus the keys to the game.
- **Phrase book:** every line in every report is a rule in `battle/phrasebook.json`: conditions on these numbers, then a sentence. You edit sentences and thresholds; the engine never hard-codes a verdict.
- **The lab:**
  - Create characters and teams as Showdown text, the format PKHeX exports and imports and Smogon publishes sets in, or as lineups in `canon/lineups.json` with coach settings.
  - Run `lab.py` to scout any team against a game's league, another lineup or a pasted team, or to pull the usage sets for a species.
  - Every lineup lands on the Journey Scouting File page.

## Sources and licenses

- Smogon's damage calculator (MIT) and per-generation data.
- PokeAPI move meta and effects.
- The games' own trainer data via the pret disassemblies.
- **Smogon usage-stats sets** from `@smogon/sets` 2.0.0. The `stats` source is MIT.
- The same package's `dex` sets (Smogon's written analyses) are copyrighted by Smogon and need their permission for use in an application. The engine doesn't load them.
