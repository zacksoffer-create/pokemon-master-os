# The Trainer Scouting Report, Parts 1 and 2 (design, 2026-10-19)

*A scouting report on a trainer's team, the way an MLB pitching report tells a pitcher how to attack a hitter. It is not a battle simulation. The same trainer and team always produce the same report.*

The report answers three questions:
- What's good against this team?
- What's bad against it?
- Who is this trainer?

Part 2 (the role engine and the playsheet: how they play) reads Part 1's structured output and joins it, so the result stays one film-room report. Part 2 is described [below](#part-2-the-role-engine-and-the-playsheet).

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
   - **Outputs:** every report is written to `docs/trainers/` (markdown) and `docs/trainers/data/` (plain data, schema `trainer-report/2` since Part 2 joined it). The page is `docs/trainers/trainer_reports.html`.
   - **Your workflow:** `trainer_report.py exposure me/heartgold --vs paul/sinnoh`, also on the page under "Your team against them".
   - **Tests:** every slider and every tag changes at least one sentence; reports are deterministic.

**Acceptance test (passing):** Paul reads "comes at you with force and runs it the same way every time" and "Close to their Pokémon, and demanding of them: tough love, not coldness." His team's data agrees he's aggressive. On rigidity it disagrees, and the report says so: his rigidity is his system, not his builds.

## Part 2: the role engine and the playsheet

Same stack, same storage, same config approach: Python in `engine/trainers/`, data in `engine/canon/`, every list and threshold in JSON. Gen IV data from PokeAPI is the source of truth for legality and suggestions. Deterministic; no simulation.

### One source of truth for roles (`trainers/roles.json`, `trainers/roles.py`)

34 roles in four families, each defined once as a profile of signals:
- **Offense:** physical, special and mixed setup sweeper; wallbreaker; revenge killer; late-game cleaner; lead attacker; bulky attacker; Choice-locked attacker; weather sweeper.
- **Defense:** physical wall; special wall; tank; bulky setup; sponge / status absorber; check / counter.
- **Support:** hazard setter; hazard remover; cleric; screens setter; weather setter; phazer; status spreader; staller; stallbreaker; trapper; Trick Room setter; Tailwind setter; Fake Out support; spinblocker.
- **Utility:** pivot; Baton Pass chain starter; lure; suicide lead.

**Signals** are 0-1 values read from the build:
- stat percentiles against the generation's fully evolved field at the same level and the default spread, so investment shows;
- nature, EV spread, item group, ability group, typing;
- move categories, read from the game's move data (stat changes, targets, priority, ailments, meta categories) rolled back to the generation, plus named lists where the data has no clean field.

**Scoring:**
- A role's fit is the weighted mean of its signals; groups like `a|b` (any one) and `a&b` (both) keep alternatives from diluting it.
- A gate (`requires`) says what the role can't do without, and a small `prior` lets a specific move or item outrank a broad, stat-shaped role in a tie.
- `classify(build, game)` gives the ranked roles with the signals that fired, a primary and secondary with a confidence, and "also" for multi-role Pokémon (a Hippowdon is a hazard setter, a physical wall, a phazer and a sand setter).

**Data corrections** (E-031): Growth and Tail Glow are read from their rolled-back effects. Gen V's priority renumbering and Smeargle's Sketch are documented exceptions in `trainers/era_corrections.json`.

**Checked against 37 stock archetypes** (the archetype library): 33 read their intended role in the top two, and every one in the top three or "also".

### The loop (`trainers/solver.py`)

- **Build → roles:** `RoleBook.classify`.
- **Role → build:** `Solver.solve(species, role, game, locks)` fills every open field so the role is the primary.
  - **Search:** coordinate ascent over natures, items, abilities, EV templates and one move slot at a time, from each attacking side.
  - **Tie-breaker:** a small, documented quality term (attack power with the stat it uses, coverage, stats it uses, an item the role's family carries).
  - **Every move earns its slot.** A move that does nothing for the role, kept only to pull another role down, disqualifies the build.
  - **Alternatives:** ranked for every field, with what each trades (Jolly against Adamant: Attack 359 → 394, Speed 333 → 303; a move's power and coverage; an item's boost).
  - **Unreachable roles** say what they'd need ("Gengar can't be a special setup sweeper in Platinum: it would need Special Attack setup or Speed setup").
- **Species → archetypes:** `archetypes(species, game)` lists the library's sets, each classified, plus a derived build for every role the species reaches.
- **Locks** pin any field. `reachable(species, game, locks)` says which roles the locked build can still become; `solve` fills the rest.
- **Legality:** suggestions use moves learnable in the selected game (scope `any` widens to D-048's any-game reasons), items that exist in the generation, and the era's abilities. Every suggestion exports through the Specimen Lab to a Showdown set and a PKHeX batch script, with its legality check.
- **Round-trip test:** every suggested build that reaches its role classifies back to it, with no dead move, legal in the game.

### The archetype library (`canon/build_library.json`)

An archetype is a build (nature, moves, EVs/IVs, item, ability) with a name, the role it's built for, a source, a generation and a tier. Authored stock sets read tier "unrated" until a source rates them. An external set counts only with its source and generation on record. Ingestion comes later.

`distance(build)` compares a build with the closest stock archetype of its species, only on the fields the build records, e.g. "Swords Dance sweeper, differs on item (Choice Band → Life Orb)". When there's no stock set, or it's far off, it also gives the closest derived build for the build's own primary role.

### The playsheet (`trainers/playsheet.py`, joined to the report)

Per version:
- **Career and career tags.** Records live in `canon/trainers.json`, each limited to the versions that have lived it. Tags are Multi-Region Traveler (3+ regions), a Champion title, and Elite Four Beaten; they sit in the same tag config as Part 1's badges, and each changes a line.
- **The ace.** Derived from investment (EVs, level against the team's top, friendship), support (teammates whose roles set it up), coverage and role. The authored ace sits next to it when they differ: Paul's story ace is Electivire, his data's is Torterra, set up by Ninjask's Baton Pass.
- **Go-to by game state:** the workhorse when even, the cleaner when ahead, the gambit when behind, plus the last resorts (Explosion, Destiny Bond, Endeavor, Flail, Focus Sash).
- **Roles:** primary and secondary for every Pokémon, read as a team (a Swift Swim member counts its teammates' rain).
- **Type-advantage read:** each type's best super-effective answer at decent power, the coverage count and the holes. It's paired with Part 1's weakness count to name the type to bring (Brock: Fighting, which he can't hit super-effectively and five of his team are weak to).
- **Combos to watch:** a config list flagged where present. Dragon Dance with priority or Outrage, Trick Room with slow hitters, Toxic + Protect + recovery, hazards with a phazer, Focus Sash with Endeavor/Reversal, a Choice lock with U-turn, rain + Swift Swim + Thunder, a Baton Pass chain, Rest + Sleep Talk, Substitute + Focus Punch.
- **Signature moves:** authored per version (proposed), checked against the moveset.
- **Aggression ratio:** finishing and setup moves against attrition moves, compared with Part 1's offense slider. It's flagged when they're 30 or more apart, and referred to (not flagged twice) when Part 1 already flags the same lean.

### Observation storage (design only; Part 3 builds ingestion)

One observation per line in `canon/observations.jsonl`, fields as listed in `trainers/config.json` `observations`:
- **What happened:** trainer, version, battle, turn, situation (game state and field), Pokémon, move, outcome.
- **Where it came from:** `source` (authored, cartridge, lore, derived, ingested), `source_ref` and `sample_size`.
- **Approval:** ingested and derived facts land as `proposed` and count only once approved.

### Commands

```
python3 -I trainer_report.py roles paul/sinnoh                       # every member's roles, and why
python3 -I trainer_report.py build Garchomp --role physical_setup_sweeper --game platinum \
    [--lock item="Life Orb" --lock moves="Swords Dance"] [--scope any]
python3 -I trainer_report.py reachable Garchomp --game platinum [--lock …]
python3 -I trainer_report.py reachable stock/garchomp-sweeper --keep moves,item
python3 -I trainer_report.py archetypes Garchomp --game platinum
python3 -I trainer_report.py distance me/heartgold
python3 -I trainer_report.py report paul sinnoh                      # the unified report, playsheet included
```

### Open for you
- **Drafts to confirm:** career records marked draft (Paul's Battle Pyramid, Gary's Indigo round, May's Kanto and Johto festivals), the signature moves, and the story aces (Paul: Electivire, Red: Pikachu, Cynthia: Garchomp, Lance: Dragonite).
- **Your own career** and sliders, whenever you want to author them.

