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
- [ ] A1 the sixvsix browser bundle as an app data file, loaded on demand, run in Web Workers where the page allows
- [ ] A2 `#/arena`: side A (your teams, saved teams, team lab, library versions) vs side B (any version or collection), N battles, win rate with its interval, per-Pokémon contributions, threats, every battle watchable with each decision's reasons, both ways a game trainer can play (as the game plays them / Blackthorn's reading)
- [ ] A3 `Library.setTeamEngine`: Benchmarks gets Team vs team; Trainer criteria 5–6 (standardized team comparisons; how tendencies showed in battle)
- [ ] A4 Leagues: round robin, standings, series, leaders, awards, playoffs; eras (one game) or all-time
- [ ] A5 Legends: the all-time teams ranked by a power round robin; best-of-seven against yours
- [ ] A6 Draft: snake draft from an era's pool against GMs with traits; then a mini league
- [ ] A7 Your trainer: philosophy, GM traits, coach tendencies feeding the trainer agent; trainer traits for every library trainer

### B. Field Biology (the natural history and the ecology lab)
- [ ] B1 the archive: every Pokédex entry Gen I–IV (16 versions) per species, de-duplicated, with the data around it (genus, size, shape, colour, habitat, egg groups, life cycle, abilities, encounters by game)
- [ ] B2 claims: each entry split into sourced claims by biological domain (anatomy, diet, habitat, behaviour, social, reproduction, defence, senses, powers, life cycle, folklore, humans, other species)
- [ ] B3 relationships: every other species an entry names, read as a relationship (feeds on, preyed on by, symbiosis, rivalry, mimicry) with its quote
- [ ] B4 the field guide for all 493: a synthesized dossier per species (known / inferred / open questions), labelled as machine-synthesized
- [ ] B5 deep dossiers for a first cohort (your companions, the Ilex Forest community, the Blackthorn highlands, the Glasshouse candidates), drafts for your review, claim by claim
- [ ] B6 habitats: every location of every game reconstructed from its encounter tables (presence, method, time of day, rarity), Johto's landscape as a graph
- [ ] B7 ecosystems: Ilex Forest (flagship, Levels 1–2) and the Blackthorn highlands; a Level-1 reconstruction for every HeartGold location
- [ ] B8 food webs: trophic and non-trophic links with evidence classes; analysis (trophic levels, every consumer fed, missing functional groups, keystones by secondary extinction)
- [ ] B9 dynamics (Level 3, optional): a body-mass-scaled consumer–resource model with stated parameters and perturbation experiments
- [ ] B10 ecotypes: egg moves and whole movesets read as ecological specialisations, combinations included; lineage traditions
- [ ] B11 your review: agree / disagree / note on any claim or link, kept in the Journal tab

### C. Careers and recognition
- [ ] C1 the player card and career tab on every individual: card, timeline, records from Arena runs, achievements, signature
- [ ] C2 names: build names and signature titles widened
- [ ] C3 recognition 2.0: tier names, stat-gated traits, a Hall of Fame and leaderboards
- [ ] C4 the Chronicle: optional story entries beside the automatic timeline

### D. The product around it
- [ ] D1 Home as the main menu (modes first, the HQ dashboard beneath)
- [ ] D2 the menu reorganised around the modes
- [ ] D3 `#/v1`: what's new and why, every call linked to Your calls
- [ ] D4 docs: APP.md, BIOLOGY.md, ECOLOGY.md, ARENA.md, the ledger and the register
- [ ] D5 tests: parity where the browser copies Python, a browser test per area, the full suite and the frame test

## Build log
(newest last; each entry says what was built and which assumption records the calls)
