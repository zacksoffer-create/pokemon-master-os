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

**Legality is biological** (D-048): a move counts if the species can physically learn it, which means any one of these:
- in this game;
- in any other game of any generation (Ash's Charizard "learns Dragon Breath in Crystal (machine)");
- the show;
- a reason the build records.

The report states the reason. Only a move with no reason at all is flagged.

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

1. **Data model and trainer storage.** Done: the era layer, builds, trainers, stats from builds, a stated reason for every move, lore out of the code. You're a Champion in every version.
2. **The matrix and bulk tags.** Done (`trainers/matrix.py`):
   - verdicts from the game's chart, with abilities applied first;
   - bulk leans from real Defense vs Sp. Def;
   - gaps, strengths and which side to attack from.
3. **Sliders and tags.** Done (`trainers/sliders.py`). Each slider is measured as shares of the team from the brief's signals:
   - **offense:** attack-heavy stats, mostly attacks, fast;
   - **rigidity:** Choice items, narrow EVs, few attack types;
   - **bond:** friendship, a partner's ball, ribbons, nicknames;
   - **risk:** low accuracy, one-hit KO, recoil, self-KO, Life Orb.

   Missing data is never evidence: a plain Poké Ball or an unrecorded item counts for nothing either way. A gap of 30 or more between the authored and measured values is noted, naming the signals behind it. Nature-clash rules and the Cohesive, Type-dominant and role tags are in the config.
4. **Report text and output.** Done (`trainers/report.py`, `trainers/phrases.json`, `engine/trainer_report.py`).
   - **Who they are:** the four offense × rigidity combinations, single-pole fragments for the middle, bond read with rigidity, and risk.
   - **The plan:** what to expect, how to beat them, and where their rigidity or recklessness leaves a gap.
   - **Overrides:** per-trainer overrides replace a section.
   - **Outputs:** every report is written to `docs/trainers/` (markdown) and `docs/trainers/data/` (plain data, schema `trainer-report/1`, for Part 2). The page is `docs/trainers/trainer_reports.html`.
   - **Your workflow:** `trainer_report.py exposure me/heartgold --vs paul/sinnoh`, also on the page under "Your team against them".
   - **Tests:** every slider and every tag changes at least one sentence; reports are deterministic.

**Acceptance test (passing):** Paul reads "comes at you with force and runs it the same way every time" and "Close to their Pokémon, and demanding of them: tough love, not coldness." His team's data agrees he's aggressive. On rigidity it disagrees, and the report says so: his rigidity is his system, not his builds.
