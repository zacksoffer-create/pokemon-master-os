# Blackthorn OS v1: the whole first version

Zack, 2026-10-25: *"i want a finished version of the entire project ... incorporating everything and then i want you
to execute the best possible product given all of this ... you can improve and change anything, just keep track of
why and what decisions so i can make sense of it or make a decision on it."* Inputs: the seven specs (`docs/specs/`),
the 6v6 engine (`sixvsix/`, D-071–D-075), and the 2K inspiration, biology and ecology conversations (recorded in
`docs/specs/INSPIRATION_2K_BIOLOGY_ECOLOGY.md`).

Every call made while building is an assumption in the register (`engine/store/assumptions.json` → Your calls, with
Keep / Change / Reject) under decision **D-077**, and the in-app page *What's new in v1* (`#/v1`) walks through them.
Nothing in canon is changed without a decision; the reference world is built as data, versioned, and labelled by
evidence class.

## The shape of v1: one world, many ways to play in it

The organising idea from the 2K conversation: **build the reference world once (species, biology, ecosystems,
trainers, mechanics, equipment) and let your Pokémon, teams, trainer and decisions play in it in different modes.**

| 2K | Blackthorn v1 | Where |
|---|---|---|
| MyCAREER / MyPLAYER | **Careers**: each of your Pokémon as a player, with its card, build, badges, records, career timeline, signature | `#/mon/<id>` (career tab), `#/careers` |
| MyNBA / MyLEAGUE / MyERA | **Leagues**: seasons and playoffs played by the 6v6 engine, any teams, any era | `#/leagues` |
| "vs the '96 Bulls" | **Legends**: the greatest teams of the Trainer Library, best-of-seven series against yours | `#/legends` |
| MyTEAM | **Draft**: a snake draft from an era's best Pokémon against GMs with their own traits | `#/draft` |
| MyGM / coach tendencies | **Your trainer**: philosophy, GM traits and coach tendencies that the 6v6 trainer agent plays by | `#/trainer` |
| Badges & attributes | **Recognition 2.0**: tiered tags and badges with names, stat-gated traits (descriptive only) | `#/standards`, cards |
| Play Now | **The Arena**: any team against any team, 6v6, watched turn by turn | `#/arena` |
| — | **Field Biology**: the natural history of every Gen I–IV species, ecosystems and food webs, ecotypes | `#/biology`, `#/ecosystems`, `#/ecotypes` |
| — | Survival, Homestead, Breeding, Balls & Equipment, the Trainer Library (built in Phases 0–7) | as before |

## Workstreams and status

### A. The Arena and the competitive modes (the 6v6 engine in the app)
- [x] A1 the sixvsix browser bundle as an app data file, loaded on demand, run in Web Workers where the page allows
- [x] A2 `#/arena`: side A (your teams, saved teams, team lab, library versions) vs side B (any version or collection), N battles, win rate with its interval, per-Pokémon contributions, threats, every battle watchable with each decision's reasons, both ways a game trainer can play (as the game plays them / Blackthorn's reading)
- [x] A3 `Library.setTeamEngine`: Benchmarks gets Team vs team; Trainer criteria 5–6 (standardized team comparisons; how tendencies showed in battle)
- [x] A4 Leagues: round robin, standings, series, leaders, awards, playoffs; eras (one game) or all-time
- [x] A5 Legends: the all-time teams ranked by a power round robin; best-of-seven against yours
- [x] A6 Draft: snake draft from an era's pool against GMs with traits; then a mini league
- [x] A7 Your trainer: philosophy, GM traits, coach tendencies feeding the trainer agent; trainer traits for every library trainer

### B. Field Biology (the natural history and the ecology lab)
- [x] B1 the archive: every Pokédex entry Gen I–IV (16 versions) per species, de-duplicated, with the data around it (genus, size, shape, colour, habitat, egg groups, life cycle, abilities, encounters by game)
- [x] B2 claims: each entry split into sourced claims by biological domain (anatomy, diet, habitat, behaviour, social, reproduction, defence, senses, powers, life cycle, folklore, humans, other species)
- [x] B3 relationships: every other species an entry names, read as a relationship (feeds on, preyed on by, symbiosis, rivalry, mimicry) with its quote
- [x] B4 the field guide for all 493: a synthesized dossier per species (known / inferred / open questions), labelled as machine-synthesized
- [x] B5 deep dossiers for a first cohort (your companions, the Ilex Forest community, the Blackthorn highlands, the Glasshouse candidates), drafts for your review, claim by claim
- [x] B6 habitats: every location of every game reconstructed from its encounter tables (presence, method, time of day, rarity), Johto's landscape as a graph
- [x] B7 ecosystems: Ilex Forest (flagship, Levels 1–2) and the Blackthorn highlands; a Level-1 reconstruction for every HeartGold location
- [x] B8 food webs: trophic and non-trophic links with evidence classes; analysis (trophic levels, every consumer fed, missing functional groups, keystones by secondary extinction)
- [x] B9 dynamics (Level 3, optional): a body-mass-scaled consumer–resource model with stated parameters and perturbation experiments
- [x] B10 ecotypes: egg moves and whole movesets read as ecological specialisations, combinations included; lineage traditions
- [x] B11 your review: agree / disagree / note on any claim or link, kept in the Journal tab

### C. Careers and recognition
- [x] C1 the player card and career tab on every individual: card, timeline, records from Arena runs, achievements, signature
- [x] C2 names: build names and signature titles widened
- [x] C3 recognition 2.0: tier names, stat-gated traits, a Hall of Fame and leaderboards
- [x] C4 the Chronicle: optional story entries beside the automatic timeline

### D. The product around it
- [x] D1 Home as the main menu (modes first, the HQ dashboard beneath)
- [x] D2 the menu reorganised around the modes
- [x] D3 `#/v1`: what's new and why, every call linked to Your calls
- [x] D4 docs: APP.md, BIOLOGY.md, ECOLOGY.md, ARENA.md, the ledger and the register
- [x] D5 tests: parity where the browser copies Python, a browser test per area, the full suite and the frame test

## Build log
(newest last; each entry says what was built and which assumption records the calls)
- **The biology foundation** (B1–B3): the archive (3,639 entries, 493 species), claims (6,438) and 64 evidence packs. Area names follow the location's own name, not the area prose ("Road 34" was a translation artefact).
- **Dossiers** (B5): the format and checker (biology/dossier.py), Pineco written by hand as the standard, the other 63 by four writers in parallel from the evidence packs only; all pass the checker. Their findings and questions: docs/biology_findings_v1.md (A-62, A-77, A-78).
- **The Arena** (A1–A7): the arena pack, the Arena module and five pages, criterion 6 on trainer profiles, Team vs team from Benchmarks, Gen II–III conversion, the Legends round robin (45 teams, 7,920 battles), the trainer ecosystem (25 proposed anime versions, trainers/ecosystem.json) (A-53 to A-61).
- **Ecology** (B6–B9): Johto's landscape, communities, 50 webs with their analysis (Python and the browser agree on every web), the Level 3 model (A-63 to A-68).
- **Ecotypes** (B10, A-69) and **review** (B11, A-70), the **field guide** for all 493 (B4, A-71); capability misreadings found by the writers excluded (A-72).
- **Careers and recognition 2.0** (C1–C4): the player card, achievements, signature titles, tier names, the Chronicle, the Hall of Fame (A-55, A-73 to A-75).
- **The product** (D1–D5): Home as the main menu, the menu reorganised, `#/v1`, the docs (ARENA.md, BIOLOGY.md, ECOLOGY.md, APP.md, the ledger's D-077, the register's A-53 to A-78), and the tests (test_arena, test_biology, test_career, FieldBiology in the suite) (A-76).

