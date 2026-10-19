# The Trainer Scouting Report, Part 1 (design, 2026-10-19)

*A scouting report on a trainer's team, the way an MLB pitching report tells a pitcher how to attack a hitter. It is not a battle simulation. The same trainer and team always produce the same report.*

The report answers three questions:
- What's good against this team?
- What's bad against it?
- Who is this trainer?

Part 2 (the role engine and playsheet: how they attack you) will be a separate build. It reads Part 1's structured output, so Part 1 publishes its results as data as well as text.

Everything below runs on the project's existing stack: Python modules in `engine/`, data in `engine/canon/*.json`, and editable settings in a JSON config.

## Data source

Our Gen IV PokeAPI snapshot is the source of truth (`engine/trainers/era.py`). For a generation g, a past row ("through generation G, it was this") applies when G ≥ g, and the earliest such row wins.

| What | Tables |
|---|---|
| Type chart | `type_efficacy` + `type_efficacy_past`, only types that existed then (Steel resists Ghost and Dark through Gen V; no Fairy before Gen VI) |
| Typing | `pokemon_types` + `pokemon_types_past` (Clefairy is Normal in Gen IV; Rotom's forms are Electric/Ghost) |
| Base stats | `pokemon_stats` + `pokemon_stats_past` |
| Abilities | `pokemon_abilities` + `pokemon_abilities_past` (no hidden abilities before Gen V) |
| Learnsets | `pokemon_moves`, per game, with egg, tutor, TM/HM and pre-evolution routes |

Smogon's per-generation tables are a cross-check only. A test compares them for Gen II–IV: the type charts agree everywhere, and typings and base stats agree for every species. The only species the test skips are Smogon's fan-made CAP Pokémon and in-battle forms, which PokeAPI doesn't list.

## Layer 1: Builds

Plain data (`engine/canon/build_library.json`):
- species, nickname, gender, nature, IVs, EVs, moves, held item, ability;
- ball, friendship, ribbons, level;
- tagged with source, generation, tier and status.

**Two kinds of build:**
- **Stock builds:** Sweeper, Earthquake and Outrage Garchomp, to start.
- **Your own builds:** the journey's builds stay in `canon/builds.json` (the canon register) and are read from there, not copied.

**Stats** are always computed from the build: nature, IVs and EVs, at the level in `trainers/config.json` (default 100). The same species is a different row in a different build. A build with an open field gets the configured default, and the report lists which defaults it used:
- IVs 31;
- EVs 85 in every stat;
- a neutral nature;
- the first ability.

**Legality** follows D-024: a move counts if the species can learn it. Moves learnable only in another game of the generation, by transfer, or not at all in that generation are **flagged** in the report, not rejected.

## Layer 2: Trainers

Stored as trainer → version → team in `engine/canon/trainers.json`. A version has:
- its game, which sets the Gen IV lens;
- a team, which is one of:
  - library build ids;
  - a journey lineup;
  - a game's own trainer, read from the cartridge data;
- **four authored sliders**, each 0–100 with a one-line reason. 0 is the left pole, 100 the right:
  - **offense:** defensive ↔ offensive;
  - **rigidity:** flexible ↔ rigid;
  - **bond:** tool ↔ partnership;
  - **risk:** percentage player ↔ gambler;
- role tags (Gym Leader, Champion, Region Champion);
- per-trainer text overrides;
- notes for lore.

Lore (Ash's Light Ball Pikachu, a Pokémon that refuses its ball) is data on a build or a version, never engine logic. A test enforces that.

**Bond tends to cluster high**, so it is read together with rigidity, never alone:
- high bond + rigid → demanding, not cold (Paul's tough love);
- high bond + flexible → partnership;
- low bond → tool.

**Starting trainers:** Me (your six journey lineups; your sliders are yours to author), Ash (Kanto, Sinnoh, all-time), Red, Gary (Silver Conference, plus Blue as the games' counterpart), Paul, Brock, Misty, May, Dawn, Lance, Cynthia, Giovanni.
- **From the cartridge:** Red, Blue, Brock, Misty, Lance, Giovanni (HeartGold) and Cynthia (Platinum), exactly as the games have them.
- **Authored drafts:** the anime teams, from the show and checked against the learnsets. Every authored value is a proposal until you approve it.

## Steps

1. **Data model and trainer storage.** Done: the era layer, builds, trainers, stats from builds, legality flags, lore out of the code.
2. **The matrix and bulk tags.**
   - The matrix has their Pokémon down the side and the 17 attacking types across the top, from that game's chart.
   - Each cell gets a verdict: immune, resists, neutral, weak, very weak. Abilities rewrite the tier before the verdict.
   - Each row gets a bulk lean from its real stats: physically soft or specially soft at a 15% gap (configurable).
   - A team summary of gaps and strengths says which kind of attacker to bring.
3. **Sliders and tags.**
   - Measured signals per slider, with disagreement notes and nature-clash lines.
   - Cohesive, type-dominant and role tags.
   - A test that every slider end and every tag changes at least one sentence.
4. **Report text and output.**
   - Slider-pole fragments and the four hand-written offense × rigidity combinations, plus per-trainer overrides.
   - The three-part plan: what to expect, how to beat them, where their rigidity or recklessness leaves a gap.
   - One structured data file per report for Part 2, plus the readable report.
   - Your workflow: load your HeartGold team, pick a trainer, see where you're exposed.

**Acceptance test:** Paul reads aggressive and rigid, with a bond that reads "demanding, not cold".
