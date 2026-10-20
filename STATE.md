# STATE.md: Pokémon Master OS, full project audit

**As of:** 2026-10-20, commit `0127669` (local repo, 46 commits, **no git remote**).
**Written by:** Claude, read-only. This file is the only thing created. No code, canon data, Sheet or Drive file was changed, and nothing was committed. Everything I ran, I ran in a throwaway copy of the repo in my scratchpad.

---

## 0. How to read this

**How I know each thing.** Every claim that matters carries one of these tags:

| Tag | Meaning |
|---|---|
| **[ran]** | I ran it during this audit, in the scratch copy, and saw the result myself. |
| **[tests]** | The automated suite covers it. I ran the whole suite in the copy: **142 of 142 pass** (419 s). |
| **[live]** | Read from the live Google Sheet through the Sheets connector, read-only. |
| **[read]** | Read only: code, data or generated output, read by me or by one of five read-only audit agents I sent through each area. Not executed. |

**Status words** (your four):
- **Working, tested**: it runs, and the test suite exercises it.
- **Working, untested**: it runs, but no test covers it. I say whether I ran it.
- **Stubbed**: it exists but is a placeholder, empty by design, or wired to nothing.
- **Not started.**

"Working" means it runs and produces output. It does **not** mean the output is right. Bugs are in §8, and rows point to them as (B#).

**Source words** (your three):
- **Ingested**: PokeAPI or another outside source.
- **Authored**: your data or judgment. Where Claude wrote a judgment call that's still waiting on your approval, I say *authored (Claude's proposal)*.
- **Derived**: computed by the code.

For a code file, the source column says what its output is made from, and whether it carries authored tables (game rules, thresholds) written into the code.

**Functions.** Each module row lists its major functions. They share the module's status and source unless the row says otherwise.

---

## 1. The short version

1. **The engines run and they're consistent with themselves.**
   - The full suite passes, 142/142. **[tests]**
   - Every generator I re-ran reproduced its committed output byte for byte, except the decision counts (item 4). **[ran]**
   - The four browser ports (scouting report, specimen, battle, wilderness) match Python in their parity tests. **[tests]**
2. **Consistent isn't correct.** The audit found about 40 bugs. These seven change what a report, the Sheet or the app says *today*:
   - **B1.** Cartridge trainers' second abilities are never applied. Red's Lapras reads Water Absorb and his Snorlax reads Immunity; the game data says "second ability" for both. **[ran]**
   - **B2.** Gen III move data isn't rolled back to Gen III. In FireRed and Emerald, Outrage and Petal Dance read 120 power, Toxic 90% accurate, and Curse is Ghost-type. **[ran]**
   - **B3.** The battle engine's scouting uses *today's* accuracy for 47 damaging moves instead of the era's. The browser port copies it, so the parity tests can't catch it. **[ran]**
   - **B4.** A role that scores 0 still becomes the primary role. Paul's Ninjask (Agility, Fury Cutter, Giga Drain) reads "Baton Pass chain starter (0.00)", and the "data ace" claim in `docs/TRAINER_REPORT.md` rests on that. **[ran]**
   - **B5.** 135 of 142 approved observations are filed under trainer ids that don't exist (`field:gen4ou`, `"Ash"` with a capital A), so no playsheet ever shows them. **[ran]**
   - **B6.** The Sheet's OPEN JOBS tile says **5**; the engine and the app say **3**. **[live][ran]**
   - **B7.** The Glasshouse egg schedule says **Budew**, while the Roserade stud hatches as **Roselia**. It's on the live Sheet. **[ran][live]**
3. **Canon lives in git, not in the Sheet.**
   - D-025 (LOCKED) says canon lives in a Google Sheet that Claude reads and writes. In practice canon is JSON in `engine/canon/`, and the Sheet is *built from* it.
   - No Python code reads the Sheet back. The only things that read it are the Apps Script's own checks and the web app's log tabs. **[read]**
   - The repo has **no remote**, so the only copies outside this container are whatever has been uploaded to Drive. **[ran]** (`git remote -v` is empty)
4. **Everything downstream of the ledger is 2–5 decisions behind.** **[live][ran]**
   - The live Sheet's Decisions tab stops at D-053.
   - The committed `blackthorn.json` and the app's `hq.json` stop at D-056.
   - `docs/DECISION_LEDGER.md` has D-058.
5. **The five briefs.**
   - Part 1: **Done**.
   - Part 2: **Done**, with 3 requirements partial.
   - Breeding_Lab egg-move resolution: **Partial**.
   - PKHeX export from Canon Builds: **Partial**.
   - Dashboard reading Canon Builds: **Partial**.
   - Details in §2.
6. **Rebuilding the Sheet isn't safe**, even though the code says it is. **[read]**
   - Re-sending the payloads to the existing Sheet would fail on the first call (it adds tabs that already exist).
   - If the tabs were deleted first, the rebuild would wipe your Your Calls answers and the Breeding Program statuses.
7. **Reference data isn't actually pinned.** **[read]**
   - PokeAPI, pret and Showdown are fetched from `master`/`main`. Checksums are recorded but never checked.
   - Only Smogon's calculator (npm lockfile) and Smogon sets (version in the URL) are pinned.
8. **Nothing from your actual life at Blackthorn has been logged yet.** **[live][read]**
   - The app's 10 log tabs on the Sheet are header-only.
   - The Studbook holds only the 63 planned individuals.
   - Your Calls has 10 open questions and no answers.
   - `canon/lineage.json` is empty.

---

## 2. The five briefs

**What I judged against.** The two scouting-engine briefs are in this session as written briefs:
- "Trainer Scouting Report Engine, Part 1 of 2" (2026-10-19 21:12)
- "Part 2 of 2 (Playsheet and Role Engine)" (21:35)

The other three (Breeding_Lab egg-move resolution, PKHeX export from Canon Builds, dashboard reading Canon Builds) never came to me as written briefs. I judged them by their names and by what the matching legacy v3 tabs did.

| Brief | Status | In one line |
|---|---|---|
| Scouting engine Part 1 (trainer report) | **Done** | Every requirement is built and tested. Two are only partly met, and four bugs change its output. |
| Scouting engine Part 2 (playsheet, role engine) | **Done, 3 requirements partial** | Roles, solver, archetypes and playsheet all work and are tested. Tiers, archetype distance and "everything in config" fall short. |
| Breeding_Lab egg-move resolution | **Partial** | The engine resolves fathers, chains and one-egg bundles for all six games. Nothing lets you ask it a question; the app covers HGSS only, one move at a time. |
| PKHeX export from Canon Builds | **Partial** | Per-build Showdown sets and PKHeX Batch Editor scripts work. There's no export of your canon builds as a set, no `.pk` files, and your canon builds lack most of the fields PKHeX needs. |
| Dashboard reading Canon Builds | **Partial** | Builds flow one way into the Sheet's Journey tab and the app. There's no Canon Builds tab, nothing reads builds back from any Sheet, and the dashboard tab shows no builds. |

### 2.1 Scouting engine Part 1: Done

Code: `engine/trainers/` plus `engine/trainer_report.py`. Tests: TrainerReportData (15). **[tests]** I ran `list`, `report paul sinnoh`, `report red`, `report me crystal` and `all`; the 20 reports came out identical to the committed ones. **[ran]**

**Done:**
- Deterministic, not a simulation.
- The three layers (build, trainer, report) are kept separate.
- The full build fields.
- Level 100 default, with a scale setting.
- Stock builds (including the three Garchomp sets).
- Stats computed from nature, EVs and IVs.
- Trainer → version → team storage.
- Four authored sliders with reasons, measured against the team data, with disagreement flags.
- A slider changes at least one sentence (tested on Paul).
- A nature-clash line.
- Tags from one config: Cohesive, Type-dominant, role tags.
- The 17-type matrix per generation, with abilities applied.
- Bulk tags, gaps and strengths.
- Structured JSON plus a written report that Part 2 and the app read.

**Partly met:**
1. **"Plus the user's builds."** Your builds only come in through journey lineups.
   - `canon/builds.json` has 18 of 36 companions, and Crystal has none. Emerald has 1 build, and that build has one move.
   - The engine fills the missing movesets with its "strongest set" rule but labels them "canon register" (B9).
   - Lineup builds drop nickname, ball, friendship, ribbons and level.
2. **"Measured from team data" for bond.** Three of the four bond signals can only say yes or nothing, never no. Bond reads "no signal" on 17 of 20 versions (B18).

**Also:** The nature-clash line exists but has never fired. None of the 20 teams carries authored natures it could clash with.

**Bugs in Part 1's output:** B1 (second abilities), B2 (Gen III moves), B8 (the disagreement sentence names the wrong Pokémon), B9 (engine-filled sets shown as canon).

### 2.2 Scouting engine Part 2: Done, 3 requirements partial

Code: `trainers/roles.py`, `roles.json`, `solver.py`, `playsheet.py`. Tests: RoleEngine (6), RoleSolver (8), TrainerPlaysheet (9). **[tests]**

**Done:**
- 34 roles, each defined once in `roles.json`.
- Signal profiles: stat shape, nature, EVs, item, ability, move categories.
- Build → primary and secondary roles with confidence.
- Role → build with locks.
- Ranked alternatives with tradeoffs.
- Legality from PokeAPI.
- Export into the PKHeX path.
- Species → archetypes.
- The round-trip check: a suggested build classifies back to its role. It's tested on 13 species/role pairs, Platinum only.
- The playsheet:
  - derived ace next to authored ace;
  - go-to by game state;
  - type read paired with Part 1;
  - combos to watch (10);
  - signature moves;
  - aggression ratio against the offense slider;
  - career records and career tags.
- The observation storage design.

**Partly met:**
1. **Archetype library "tagged with tier".** Every tier is "unrated" or missing. Three roles have no stock archetype at all (choice-locked attacker, status absorber, Fake Out support).
2. **Distance to the closest archetype.** It only compares against the 37 stock builds and ignores the 52 ingested ones.
3. **"Every list and threshold in config."** Many are still hard-coded (§9). Several sentences live in code rather than `phrases.json`, especially the film and ladder lines.

**Bugs in Part 2's output:**
- B4: a zero-score role becomes primary, which also feeds the ace helpers.
- B5: observations are orphaned.
- B19: default EVs count as evidence.
- B20: ace ties go to the later slot. 4 of 20 versions are tied.
- B21: lead and last come from list order and contradict the film.
- The aggression ratio saturates at 72–100% for all 20 versions, so it barely tells trainers apart. **[read]**
- The observation schema drifted from its own design (§7.4).

**The battle "Scouting Engine" (`docs/SCOUTING_ENGINE.md`)** is a separate thing from these two briefs.
- Its layers 1–5 (moves, evaluation, profiles, play sheets, lab) are working and tested: Engines (15) and ScoutingEngine (14). **[tests]**
- It runs live in the app's Battle Lab (D-057).
- When I built the port I ran the full parity check: 2,365 of 2,365 sections matched. The test suite now re-checks one Gen 4 lineup. **[tests]**
- Its known flaw is B3 (accuracy).

### 2.3 Breeding_Lab egg-move resolution: Partial

**What the legacy tab did** (v3 `Breeding_Lab`; `legacy/v3_Breeding_Lab.md`) **[read]**
- You entered a game, a target and up to 3 required egg moves.
- It showed eligible egg moves, a max bundle size and bundle rows: donor, shared egg group, special requirements.
- The outputs were typed values from a script nobody has seen (E-016).
- It matched egg groups on the *baby*, whose group is No Eggs:
  - Pikachu got Mime Jr. as a "donor".
  - Riolu with Vacuum Wave + Cross Chop got "max bundle size 0".

**What exists now**
- `breeding/engine.py`:
  - `egg_moves` and `feasibility`;
  - `bundle`: one father passing a whole set in one egg;
  - `plan_lineage`: multi-generation chains where one father knows the whole set at once, up to 4 moves;
  - Light Ball eggs, incense babies, timing warnings ("learn before evolving"), transfer routes, and a preference for fathers you can catch in that exact version.
- Works for Crystal, FireRed, Emerald, Platinum, HeartGold and SoulSilver. **[read]**
- The baby bug is fixed and pinned by `test_riolu_bundle_regression`: Riolu with Vacuum Wave + Cross Chop → Machop line. **[tests]**
- `breeding/studbook.py` builds the journey sire web. **[tests]**
- `breeding/lineage.py` plans the 10 program lines and checks them. **[tests]**
- The app's Breeder Lab (`#/breeder`, from `app/data/breeder.json`, 1,767 egg moves across 246 HGSS families) reads precomputed plans. **[read]**

**What's missing**
1. **A query surface.** Nowhere, Sheet or app, lets you type target + game + 2–3 moves and get the one-egg bundle or lineage back. The engine can do it; nothing exposes it.
2. **Multi-move plans in the app.** The Breeder Lab plans one move at a time (`plan_lineage(name, [move], …)`) and HGSS only (`app/breeder_pack.py:19, :47`).
   - The Engine Room says so ("other games and multi-move bundles are next").
   - Its screen list still marks the page LIVE.
3. **The legacy "max bundles" listing**: every set of egg moves one father can pass, ranked.
4. **The spec's "doable in one save" verdict** and a "Copy PKHeX set" button (`docs/APP_PRODUCT_SPEC.md:64`).

**Bugs**
- B12: Nidoran♂ and Volbeat lines are marked as unable to inherit egg moves, so the Breeder Lab skips them.
- B26: families aren't filtered by generation, so a Crystal or Emerald plan can name a Gen 4 father.
- B27: a target's egg move that the line can also learn by tutor isn't flagged.

### 2.4 PKHeX export from Canon Builds: Partial

**Legacy:** there never was one. No legacy file mentions PKHeX or Showdown, and the 2026-01-07 "export" was a copy of the tab. **[read]**

**What exists now**
- `specimen.py`, `derive`, then `showdown()` and `batch_script()`:
  - Works out one individual at PKHeX level: PID → nature, gender, ability slot, shininess; Hidden Power; characteristic; stats.
  - Writes a Showdown set (which PKHeX imports) plus a PKHeX Batch Editor script for what the set can't carry.
  - Working, tested; the browser copy is parity-tested. **[tests]**
- `trainers/solver.py:532 export()`: a solved build → specimen → Showdown set + batch script. **[tests]**
- `lab.py team heartgold` prints your HeartGold six as a Showdown paste with assumed defaults. **[ran]**
- The app's Builds Lab (`80_builds.html`) shows both texts for any build you make. **[tests]** (it loads and clicks without errors in the frame test)

**What's missing**
1. **A one-shot export of `canon/builds.json`** (or of a chapter) as importable sets.
2. **Your canon builds lack the fields PKHeX needs.** `builds.json` has moves, item, nature and ability, and many entries have only moves. It has no EVs, IVs, ball, level, OT/TID/SID, met location or PID. An export today would be mostly defaults.
3. **`.pk` file writing.** Not started (`docs/SPECIMEN_LAB.md` "not yet").
   - Also not started: met-location ids, ribbons, Pokérus, and correlated PID-IV encounter methods.
   - There's no PKHeX round-trip test.
4. **Forms.** The batch script writes `=Species=` but never `.Form=`, so forms can't be made (B15 is related).

Your stance from 2026-10-19 applies: "legal" means learnable (D-024/D-048), not PKHeX-legal. The specimen engine follows that.

### 2.5 Dashboard reading Canon Builds: Partial

**Legacy:** the only dashboard (`TeamDashboard_FeatureSheets.xlsx`) read a roster tab. Every cell was `#REF!`, and it was never merged. **[read]**

**What exists now**
- `canon/builds.json` flows *one way* into:
  - the Canon DB Sheet's **Journey** tab (`ranch/sheet.py:214`);
  - the Glasshouse crop plan (berries your builds hold);
  - the lineage founders' moves;
  - the app (`hq.json` party, the Scouting and Battle Labs). **[ran][live]**
- The **Blackthorn** dashboard tab:
  - shows KPIs, chapters with sprites, the program, facilities, the Glasshouse, your calls and two charts;
  - **shows no builds**;
  - its tiles are live formulas over the other tabs. **[live]**

**What's missing**
1. **A Canon Builds tab** in the Canon DB. There isn't one; the legacy v3 sheet is the only place one exists.
2. **Reading builds back from a Sheet.** Nothing does. `docs/ARCHITECTURE.md` build-order item 4 still lists "the engines reading authored rows back from the Sheet".
3. **A dashboard view of builds.** No KPI, panel or check reads builds: coverage, missing builds (18/36), conflicts.
4. **The legacy Primary / Defining Move concept.** It was never carried forward (`docs/LEGACY_DATA_AUDIT.md:105`).

---

## 3. Module by module

### 3.1 `engine/` root

| File | What it does | Status | Source | Notes |
|---|---|---|---|---|
| `rules.py` (97 lines) | Gen 2–4 lookups for species, moves and types from Smogon's per-gen data, the move's category by era, and type effectiveness with defensive abilities. Key functions: `gen_data`, `species`, `move`, `category`, `effectiveness`, `best_defensive_ability`. | Working, tested (Rules, 5) | Derived, from ingested Smogon + PokeAPI data; mechanics tables authored in code | Generic "Hidden Power" counts as Normal/Physical in Gen 2–3 **[read]** |
| `refdb.py` (351) | Builds `pokeref.sqlite` from the PokeAPI CSVs, then answers per-version-group questions: learnsets, breeding, fathers, chains, abilities, HMs, stats, encounters. Key functions: `build`, `Ref.learn`, `fathers`, `chain`, `abilities`, `family`, `wild_in`. | Working, tested (through every engine). `build` itself untested and not run this audit | Ingested (PokeAPI); legacy spelling aliases authored | Its docstring still says "prototype". B15 (forms get base stats), B30 (`build` deletes the DB before reading) |
| `team.py` (36) | The shared Team and Member structures. | Working, tested | Authored structure | Default level 50 here, 100 elsewhere |
| `fetch_reference.py` (93) | Downloads the PokeAPI CSVs, `@smogon/sets`, Showdown learnsets and the pret trainer files; writes checksums and the fetch time; rebuilds the database. | Working, untested. Not run (network, and it rewrites `data/`). Last run 2026-10-19 | Ingested | Unpinned sources; checksums never verified; truncates files before downloading (B30) |
| `specimen.py` (339) | One Pokémon at PKHeX detail: PID or DVs → nature, gender, shininess, ability slot, Hidden Power, characteristic, stats; learnability gate; Showdown set and PKHeX Batch Editor script. Key functions: `Lab.derive`, `find_pid`, `showdown`, `batch_script`. | Working, tested (plus parity) | Derived; ball and gender tables transcribed from PKHeX and the games (authored); D-028 exception in code | B14 (impossible gender hangs or crashes) **[ran]**; B15 (forms) **[ran]** |
| `sanity.py` (344) | The engine audit: our stats vs Smogon's calc, known facts, legality of every build, protocol rules over every cached replay, our reading of Smogon stats vs theirs. Writes `docs/SANITY.md`. | Working, tested (EngineAudit, 9) | Derived, checked against ingested references and authored `sanity.json` | **[ran]**: 0 problems (9,240 stats, 37 facts, 605 legality, 850 replays, 358 usage lines) |
| `sanity.json` | Known facts the engine must get right: bulk leans, base stats, types, abilities, item and move generations, event moves. | Working, tested | Authored | Every value spot-checked correct **[read]** |
| `canon_checks.py` (94) | One-off checks of the handoff's move, ability and HM claims per game, printed as JSON. | Working, untested. A re-run by an agent differs from the saved output in one entry | Derived; claim lists authored, hard-coded | Still lists SoulSilver Gyarados (gone since D-010). The saved output is wrong on Mamoswine/Ice Shard (B32) |
| `legacy_audit.py` (92) | Checks the legacy Canon Builds rows (from a CSV export) for problems. | Working, untested. Reproduces its saved output exactly (agent re-run) | Derived from your ingested legacy sheet | Gen 2–3 eggs (which hatch at level 5) are audited as wild catches |
| `lab.py` (297) | CLI to build teams (lineups, usage, pret trainers, pastes) and scout or fight them with the battle engine: `lineups`, `team`, `sets`, `profile`, `scout`, `fight`. | Working, tested (one test). **[ran]** `lineups` (11) and `team heartgold` | Derived | B16 (a duplicate species on a trainer collides). Writes a baseline cache to `data/derived` |
| `workbench.py` (66) | Library: runs the battle, wilderness and breeding engines on a team and diffs two teams. `preview_world` gives a "what if approved" view. | Working, tested (through the field parity test) | Derived | Can't run on its own with `python3 -I` (no path setup) **[ran]**; `self.benchmarks` unused |
| `intake.py` (208) | CLI for the intake inbox: 20 commands (video, image, page, paste, research, pokedex, asks, results, approve, apply, doc-prompt, …). | Working, tested (Intake, 10, through the modules). **[ran]** `status`, `list` | Derived cards from ingested sources | `status` reports any HTTP error as "reachable"; probes hosts no code uses |
| `film_room.py` (159) | CLI for the film room: `search`, `box`, `study`, `card`, `usage`, `spreads`, `book`. | Working, tested, **except `box`, which always crashes (B13) [ran]** | Derived from ingested replays and Smogon stats | The saved study file is overwritten by each run regardless of options |
| `trainer_report.py` (216) | CLI for both scouting-report parts: `list`, `report`, `exposure`, `all`, `page`, `roles`, `build`, `reachable`, `archetypes`, `distance`. | Working, untested as a CLI (its engine is tested). **[ran]** `list`, `report`, `roles`, `all` | Derived | `report paul/sinnoh` (slash form) raises KeyError; missing arguments crash |
| `__pycache__/` | Python bytecode. | n/a | Derived | Gitignored |

### 3.2 `engine/battle/`: the battle Scouting Engine (layers 1–5)

All of these are **Working, tested** (Engines 15, ScoutingEngine 14, plus the battle parity test) unless the row says otherwise.

| File | What it does | Source | Notes |
|---|---|---|---|
| `benchmarks.py` (276) | Each game's real opponents (Elite Four, Champion, Red, rival), read from the pret disassemblies, plus a 1v1 grid against them. | Derived from ingested pret data | HGSS trainer ids are hard-coded (e.g. 245, 701–705) |
| `engine.py` (186) | How a team defends, what it hits (with the era's stat), who walls it, speed, the tools its playbook holds, and exact damage through Smogon's calc (node). Holds `ROLES`. | Derived; ROLES authored | |
| `evaluate.py` (1,192) | Plays two Pokémon out as a small deterministic one-on-one (priority, speed, end-of-turn), with plans. Key functions: `Evaluator`, `Fight`, `Plan`, `Matchup`. | Derived | `SLEEP_TURNS` at :39 is marked "believed; verify" |
| `grid.py` (98) | The benchmark grid played out by the evaluator, in the shape the reports read. | Derived | |
| `knowledge.py` (127) | A Combatant (everything a fight needs about one Pokémon) and the usage field from `@smogon/sets`. | Derived from ingested Smogon sets; default IVs 31 / EVs 85 authored | Source label "@smogon/sets 2.0.0" hard-coded |
| `moves.py` (194) | The move book: power, type, category and priority from Smogon; accuracy from PokeAPI rolled back to the era through the changelog, plus `ERA_FIXES`. | Derived; `ERA_FIXES` authored, marked "believed; verify" | It's correct here; `scouting.py` bypasses it (B3) |
| `paste.py` (88) | Showdown text in and out (what PKHeX imports and exports). | Derived | |
| `phrases.py` (82) | The phrase-book rule engine (conditions → sentences), used by both scouting engines. | Derived; rules authored in JSON | |
| `playsheet.py` (113) | Situations (game states) and what each member calls in them. | Derived | Not the same thing as `trainers/playsheet.py` (§7) |
| `profile.py` (159) | A team's sliders as shares of its matchups against a field; caches field baselines. | Derived | The baseline cache is keyed on `ENGINE_VERSION` "eval-3" only (§7) |
| `scouting.py` (660) | Scouting reports and call sheets: tendencies and a philosophy, no grades. Key functions: `member_for`, `strongest_set`, `accuracy`, `out_pitch`. | Derived | **B3**: `Scouting.accuracy()` reads today's accuracy |
| `scouting_report.py` (261) | Writes the six chapter packets (`docs/scouting/*.md`) and the Journey Scouting File page; `export_data` for the app. | Derived | **[ran]** markdown: identical to committed. `--page` not run |
| `trainer_policy.py` (184) | The games' own trainer AI as a move-picking policy (Gen 3–4 scoring flags, Gen 2 layers). | Derived; the AI rules are ingested from pret via `trainer_ai.json` | |
| `phrasebook.json` | Sentence rules: player 63, opponent 25, trainer 16, self 14, plan 12. | Authored | A second phrase book exists at `trainers/phrases.json` (§7) |
| `trainer_ai.json` | Trainer-AI flags and scores per generation, with sources. | Ingested (pret). Platinum and HGSS SHAs pinned; Crystal, FireRed and Emerald "unknown" | |
| `species_items.json` | Signature items (Light Ball, Thick Club, Stick). | Authored | One of 3–4 overlapping species-item lists (§7) |
| `calc_bridge.mjs` (46) | JSON in, JSON out bridge to `@smogon/calc`. | Ingested library | Tested (`test_damage_calc_bridge`) |
| `dump_gen_data.mjs` (28) | Dumps Smogon's per-gen data into `engine/data_battle/`. | Ingested | Working, untested, not run. Default output dir is `data` if you forget the argument |
| `scouting_page.html` | Template for the Journey Scouting File page. | Authored | Working, untested (not run this audit) |
| `package.json`, `package-lock.json` | Pin `@smogon/calc` 0.12.0 with an integrity hash. | Ingested | `node_modules/` is gitignored: a fresh clone needs `npm ci` |

### 3.3 `engine/trainers/`: the Trainer Scouting Report (Parts 1 and 2)

All **Working, tested** (TrainerReportData 15, RoleEngine 6, RoleSolver 8, TrainerPlaysheet 9, plus the scout parity test) unless noted.

| File | What it does | Source | Notes |
|---|---|---|---|
| `era.py` (343) | The generation-aware data layer: type chart, past typing and stats, abilities, natures, the stat formula, item dating, per-gen move data, learnsets, and why a move is legal (D-048). | Derived from ingested PokeAPI, plus authored `era_corrections.json` | **B2** (`:208`, Gen III rollback). Dead duplicate `item_gen` at `:180`. KeyError outside Gen 2–4 |
| `model.py` (315) | Build, Version and Trainer data, plus `Store`: resolves teams from the library, journey lineups or pret cartridge data; fills defaults; validates. | Builds authored; cartridge teams ingested (pret); filled movesets derived | **B1** (`:172`); **B9** (`:133-148`). Cartridge teams are wired for HGSS and Platinum only, although the Crystal, FireRed and Emerald files are on disk |
| `matrix.py` (140) | The type matrix: a verdict per attacking type with abilities applied, the bulk lean against the generation's field, and the team gaps and strengths. | Derived | Rows that are soft on both sides read "soft" rather than "frail" |
| `sliders.py` (155) | Measures the four sliders from team data, flags disagreements, nature clashes and tags. | Derived; thresholds authored in config | **B18** (bond); **B8** (`:118`). The slider poles are hard-coded, duplicating `config.slider_scale` |
| `report.py` (335) | Builds the Part 1 report (schema `trainer-report/2`), `exposure` (your team vs theirs) and the markdown. | Derived; sentences authored in `phrases.json` | **B8** (`:83`). Some sentences are written in code |
| `roles.py` (492) | The role engine: classifies a build against 34 role profiles (signals, gates, weights, priors). | Derived; definitions authored in `roles.json` | **B4** (`:455`); **B19** (`:262-265`) |
| `roles.json` | 41 move categories, 75 signals, 34 roles, EV templates, solver settings, archetype rules. | Authored | Stale note "ingestion comes later"; the typing weight "choice" is never read |
| `solver.py` (749) | Role → build by coordinate ascent with locks; alternatives with tradeoffs; reachable roles; archetypes; distance; Showdown/PKHeX export. | Derived from PokeAPI learnsets and items, plus authored settings | Suggests Gen 2 berries (Lum, Sitrus) that `Store.check` then flags. Distance uses stock builds only |
| `playsheet.py` (475) | Part 2's playsheet: career, team roles, ace, go-to by state, type read, combos, signatures, aggression, film observations, ladder. | Derived; career and signatures authored; observations and ladder ingested | **B5** (`:280`), **B20** (`:118`), **B21** (`:127`), B4 knock-on (`:89-107`) |
| `config.json` | Every Part 1 and playsheet threshold and list (lens, levels, verdicts, abilities, bulk, tags, bands, combos, ladder, observation design). | Authored | The `observations` block (`:711-735`) is design only, and the data doesn't follow it |
| `phrases.json` | 73 sentence rules (report 38, exposure 2, playsheet 33). | Authored | "The one soft spot:" can introduce two Pokémon |
| `era_corrections.json` | Documented exceptions to PokeAPI: 5 Gen V priority renumberings, Sketch, Arceus forms, 4 Gen II event moves. | Authored (from Bulbapedia) | Gen II Protect/Detect/Endure priority not covered (unverified) |
| `page.html` | Template for the trainer-reports page (`docs/trainers/trainer_reports.html`). | Authored | Working, untested (I didn't run `page`) |

### 3.4 `engine/breeding/`

| File | What it does | Status | Source | Notes |
|---|---|---|---|---|
| `engine.py` (219) | Gen 2–4 egg-move inheritance. Key functions: `egg_moves`, `feasibility`, `bundle` (one-step fathers for a whole set), `plan_lineage` (multi-generation chains), `timing`. | Working, tested (`bundle`, `plan_lineage` through lineage). **`plan`, `render`, `stock` have no caller (stubbed)** | Derived from ingested PokeAPI; incense table and rules authored | B12, B26, B27; the memo key omits `visited` |
| `lineage.py` (323) | The studbook as individuals: 36 founders plus the planned crosses (D-038) merged with `lineage.json`, checked against Gen 4 rules. Key functions: `program`, `individuals`, `check`, `pedigree`. | Working, tested (Blackthorn class). **The documented `python3 -I breeding/lineage.py` fails [ran]**; `python3 -m breeding.lineage` from `engine/` works (63 individuals) | Derived; founders' moves authored | Targets planned under each game's rules but checked under HGSS. A Gen 2 (Crystal) Ampharos is used as a Gen 4 sire. Targets with no plan are dropped silently. IDs keyed on species collide |
| `studbook.py` (163) | The journey as a breeding web: who can father which notable egg moves for whom, each companion's roles, two-step chains. | Working, tested | Derived; "notable" filter is engine judgment | "Egg move" means method 2 here but methods 2+6 in `engine.py` |
| `studbook_report.py` (68) | Writes `docs/BREEDING_LAB.md`. | Working, untested. **[ran]**: identical | Derived | |
| `__init__.py` | Empty. | n/a | n/a | |

### 3.5 `engine/ranch/`

| File | What it does | Status | Source | Notes |
|---|---|---|---|---|
| `planner.py` (194) | The ranch census: residents, the land each needs, the fewest satellites to cover HQ's gaps, staffing on evidence, the breeding program's kept product. | Working, tested (Ranch, JourneyLabRanch) | Derived from authored `ranch.json`/`world.json` plus ingested PokeAPI | Staffing uses each companion's chapter game, not the Gen 4 present. A stud with no plan is labelled "Light Ball" |
| `habitat.py` (96) | Each species' land profile: zones, climate, water, size, native region, with evidence. | Working, tested | Derived; zone maps are authored heuristics | Gen 4 evolutions of old lines count as "Sinnoh" natives |
| `hatchery.py` (73) | The Glasshouse: staffing per room, egg cards (cycles, steps, laps), the crop plan. | Working, tested | Ingested game numbers + authored design | **B7** (`:30`, Budew); stale "proposal until approved" docstring; reads `builds.json` from a hard-coded path |
| `report.py` (23) | Writes `data_manifest/ranch_census.json`. | Working, untested. **[ran]**: identical | Derived | |
| `dashboard.py` (198) | Builds `data_manifest/blackthorn.json`, the one export the Sheet and the app are built from (census, Glasshouse, lineage, studbook roles, rosters, world, questions, decisions parsed from the ledger). | Working, tested (`test_the_export_and_the_sheet`). **[ran]** | Derived; `THESIS_LINE` is authored text in code | **B24** (`:148` resets program status). The HeartGold lock is hard-coded (`:96`, `:159`) |
| `sheet.py` (865) | Lays `blackthorn.json` out as Google Sheets API call payloads (`data_manifest/sheet/*.json`, 50 calls) for a Claude session with the Sheets connector to send. | Working, tested (structure only). **[ran]** | Derived | **B22** (not idempotent), **B23** (overwrites your answers), **B6** (OPEN JOBS formula). Payloads carry no spreadsheet ID |

### 3.6 `engine/wilderness/`

| File | What it does | Status | Source | Notes |
|---|---|---|---|---|
| `engine.py` (230) | What a team can do in the lived world (27 capabilities) from tiered evidence that's never blended (authored > cartridge > lore > inference), and which of 7 scenarios it's ready for. | Working, tested (plus field parity) | Field-move and ability tables authored (FireRed abilities "believed"); lore ingested (PokeAPI flavor text) | Egg and transfer routes count as cartridge evidence. **D-028 isn't applied**: Crystal Feraligatr has no Waterfall **[ran]** |
| `world.py` (71) | Your world-record store: propose, approve (needs a decision id), reject. | Working, tested (tests only call `propose`/`decide`) | Authored | In practice `world.json` is hand-edited; `suggest()` has no caller |
| `camp_life.py` (59) | Each game's food systems and who forages, cooks or brings heat. | Working, tested | `camp_life.json` authored ("cartridge" and "believed" tiers) | |
| `camp_life.json` | Food systems per game. | Working, tested | Authored, partly "believed; verify" | |
| `scenarios.json` | The 7 readiness scenarios. | Working, tested | Authored | Duplicated as `DEFAULT_SCENARIOS` in `engine.py` |
| `__init__.py` | Empty. | n/a | n/a | |

### 3.7 `engine/film/`: Showdown replays and Smogon stats

| File | What it does | Status | Source | Notes |
|---|---|---|---|---|
| `log.py` (717) | Parses one Showdown replay into sides, revealed builds and one row per action with a game-state snapshot. | Working, tested (FilmRoom, 7) | Derived from ingested replays | Ghost Curse KO credited to an earlier attacker (B33, mechanic unverified); end-of-turn KOs written onto the move row |
| `replays.py` (105) | Searches Showdown's replay server, filters, fetches and caches replays. | Working, tested (mocked) | Ingested | **Chat is cached** (522 of 850 replays) despite docs saying it never is (B34). Page size 51 hard-coded |
| `usage.py` (243) | Fetches, caches and reads Smogon's monthly stats into per-species lines; fits an EV spread to a build. | Working, tested (SmogonUsage, 4) | Ingested + derived | **B35**: with no `--month` it always hits the network and silently moves to the newest month |
| `study.py` (480) | Turns many parsed battles into one scouting read of a player or a field. | Working, tested | Derived | `self.sacks` never filled; citations repeat the same battle |
| `report.py` (120) | Renders a box score and a study as text. | Working, untested (`box` crashes before reaching it) | Derived | |
| `cards.py` (159) | Turns a study into an intake card (observation tallies, build variants); `spreads_card` adds EV/nature corrections from Smogon. | Working, tested | Derived from ingested | **Root cause of B5** (`:21`, `field:<fmt>` ids). State caps apply per state (9 per card) |
| `buildbook.py` (189) | Builds the per-format builds book: Smogon numbers joined with replay variants, role reads, fitted spreads, pastes. | Working, tested (BuildsBook, 3) | Derived | Fills missing items/abilities from the ladder but still labels the set "seen in N replays" |
| `config.json` | Film room settings. | Working, tested | Authored | `locked_tags` never read; `cards.players` empty |
| `builds_page.html` | Template for `docs/film/builds_book.html`. | Working, untested | Authored | Claims "most real sets are close to it", which is never computed |

### 3.8 `engine/ingest/`: the intake inbox

| File | What it does | Status | Source | Notes |
|---|---|---|---|---|
| `cards.py` (343) | The inbox: cards of claims go propose → approve/reject/edit → apply into canon. | Working, tested (Intake) | Infrastructure; passes provenance through | B36 (`--again` loses data; apply drops `move_reasons` and `trainer`); approve never checks for a source |
| `config.json` | Intake settings: Gemini, downloads, claim kinds, corrections allow-list, prompts, Bulbapedia eras, Pokédex thresholds. | Working, tested | Authored (episode eras are your judgment) | Bulbapedia prompts contain a literal `\n` |
| `media.py` (427) | The Gemini analyzer for videos, images and pages: builds an envelope and turns it into a card. | Working, tested with mocks only. Not run live this audit | Ingested (Gemini on YouTube, TikTok, pages) | B37 (no fallback when a model is retired; FireRed → Gen 1, HeartGold → Gen 2); trainer names not normalised |
| `bulbapedia.py` (678) | Answers the ASK list (movesets, signatures, aces, careers, send-out order) from Bulbapedia wikitext; Gemini fills in prose only. | Working, tested (with a fake wiki) | Ingested (Bulbapedia, CC BY-NC-SA, cited) | One network error aborts the run; cache key omits the model name |
| `pokedex.py` (180) | Reads Pokédex text from PokeAPI, cross-checks field notes and lore against it, makes field-note cards. | Working, tested (PokedexCrosscheck, 3) | Ingested, but labelled "cartridge" (it's PokeAPI) | Re-running `crosscheck` duplicates the note |
| `sheet.py` (195) | The Agent Sheet pattern: makes ASK rows from canon drafts; turns exported RESULTS tabs into cards. | Working, tested (`asks`) | Derived ASK rows; ingested RESULTS | No Sheets API: you export by hand. `TABS`/`VOCAB` constants unused |
| `builds.py` (49) | A Showdown/PKHeX paste → build claims with the role engine's read. | Working, tested | Authored by default, ingested with `--external` | |
| `docprompt.py` (69) | A style card plus a species' field notes → a narration brief and shot list. | Working, tested | Derived | Fan-work notes are used without a marker (Torterra doc) |

### 3.9 `engine/app/`: Blackthorn HQ, the web app

**Python packs** (they write `app/data/*.json`, which the app reads):

| File | What it does | Status | Source |
|---|---|---|---|
| `export.py` (333) | Writes every app data file from the engines and canon (hq, scouting, atlas, builds, learnsets, journal), then calls the packs below. | Working, untested. **[ran]**: identical except decision counts | Derived |
| `scout_pack.py` (313) | The scouting engine pack for the browser (`scout.json`). | Working, tested (scout and specimen parity) | Derived |
| `battle_pack.py` (242) | The battle engine pack (`battle.json`, `calc.json` with Smogon's calc and its MIT notice); `--parity`. | Working, tested (battle parity) | Derived; calc ingested |
| `advance_pack.py` (61) | The battle engine's Journey Scouting File as its last Python run left it, one file per lineup (`advance*.json`). | Working, untested (ran inside `export.py`) | Derived |
| `field_pack.py` (105) | The wilderness evidence for every species and game (`field.json`). | Working, tested (field parity) | Derived |
| `breeder_pack.py` (89) | Every HGSS line's egg moves with lineages (`breeder.json`). | Working, untested; not run (slow; `--breeder`) | Derived |
| `room_pack.py` (168) | The Engine Room (`engines.json`) and the inbox view (`inbox.json`). | Working, untested (ran inside `export.py`) | Authored status text in code + derived inbox |
| `build.py` (140) | Bundles `web/*` + data into `dist/` (the Drive parts, the app zip, a standalone preview, the Apps Script zip). | Working, tested (WebApp class builds it) | Derived |

**Browser tests:**
- `test_scout_parity.mjs`, `test_specimen_parity.mjs`, `test_battle_parity.mjs`, `test_field_parity.mjs`: each port vs Python, number for number. All pass. **[tests]**
- `test_frame.mjs`: opens the app inside an emulated Apps Script frame and clicks every menu item, link and clickable row at 1440 px and 390 px; fails on navigation away, errors or pop-ups. Passes. **[tests]**

**Web parts** (`app/web/`):
- All are working and tested to the level of "they load and click through the frame test without errors".
- Only the four ports are checked for *correct numbers*.
- Source: authored UI; the numbers are derived.

| Part | What it does |
|---|---|
| `00_head` | Page head, design tokens, fonts (loads Google Fonts) |
| `10_art` | Estate scenes drawn as SVG from the data |
| `20_core` | Data loading, the router that works inside Apps Script's frame (D-058), shared pieces |
| `25_scout` | **Port** of the trainer report engine (parity-tested) |
| `26_specimen` | **Port** of `specimen.py` (parity-tested). It caps PID search at 5 million tries and returns null rather than hanging; what the page shows then isn't checked **[read]** |
| `27_battle` | **Port** of the whole battle engine (parity-tested). Inherits B3 |
| `30_home` | The living estate from the Sheet's logs; says "no reading yet" rather than simulating |
| `40_estate` | Estate and Glasshouse pages |
| `50_breeding` | Program, studbook, pedigrees, fathers, hatches. **Its own copy of the cross rules (`crossIssues`) is untested** |
| `60_atlas` | Species atlas, research journal, search |
| `70_battle` | Scouting reports, self-scout, the engine-played matchup board |
| `72_advance` | Advance scouting: index from the stored Python run, each lineup rebuilt live, with a parity badge |
| `75_scoutlab` | Scouting Lab: change anything about a trainer and the report rewrites, showing each sentence's rule |
| `77_battlelab` | Battle Lab: edit lineups, builds, coach settings and phrase rules; every section regenerates |
| `80_builds` | Build library, ladder book, and the one-Pokémon Lab with Showdown + PKHeX output |
| `85_field` | **Port** of field readiness (parity-tested) |
| `90_record` | Your calls, decisions, locks, world records, evidence |
| `92_room` | Engine Room, inbox, Breeder Lab |

**Generated files:**
- `app/data/*.json` (25 files, committed): derived. The decisions in `hq.json` are 2 behind.
- `app/dist/` (gitignored): `Blackthorn-HQ-app.zip`, `Blackthorn-HQ-preview.html`, `blackthorn-apps-script.zip`, `parts/`.
- **The live deployment:** after D-058 you'd need to upload the new zip and redeploy. I can't see the deployed copy, so I don't know whether it's the fixed one.

### 3.10 `engine/appscript/`: the Canon DB Sheet's script and the web-app launcher

| File | What it does | Status | Source | Notes |
|---|---|---|---|---|
| `Code.gs` (319) | The Sheet's menu, lineage tree, record-a-hatch form, Studbook rule checks, and the HeartGold lock guard (`onEdit`). Key functions: `crossIssues`, `studbookIssues`, `pedigree`, `recordHatch`, `checkStudbook`, `onEdit`. | Working, tested **against a fixture built from engine data, not the live Sheet** (`test_rules.mjs`) | Derived rules; authored lock | **B25**: the guard undoes edits to *any* cell in a HeartGold Journey row, including the PROPOSED moves (a roster lock isn't a moveset lock) |
| `WebApp.gs` (207) | Serves the app from the newest zip in Drive; reads tabs; appends to the 10 log tabs and the Studbook; writes Your Calls answers. Key functions: `doGet`, `apiData`, `apiTab`, `apiAppend`, `apiAnswer`. | Working, tested **with fakes for Google's services** (`test_webapp.mjs`) | Derived | |
| `Tree.html`, `Hatch.html` | The lineage-tree dialog and the record-a-hatch form. | Working, untested | Authored UI | |
| `appsscript.json` | Script manifest (web app runs as you, "MYSELF"). | Working | Authored | |
| `INSTALL.txt` | Install steps. | n/a | Authored | |
| `make_fixture.py`, `test_rules.mjs`, `test_webapp.mjs` | The test harnesses. `fixture.json` is gitignored and regenerated. | Working, tested | Derived | |

### 3.11 `engine/canon/`: your canon data

For data files, "tested" means tested code reads the file and checks its contents. For example, sanity's legality check covers every library build.

| File | What it holds | Status | Source | Notes |
|---|---|---|---|---|
| `rosters.json` | The six chapter rosters and the rival's six. | Working, tested | Authored (D-002…D-006, D-010, D-019), transcribed by Claude | D-006 (HeartGold six) is honoured everywhere. The rival's per-chapter milestones (D-019) aren't in any JSON |
| `builds.json` | Your companions' movesets, newest source only. | Working, tested. **Partial: 18 of 36** (HeartGold 6, SoulSilver 5, Platinum 5, FireRed 1, Emerald 1 with one move, Crystal 0) | Authored: a mix of "confirmed by user", "proposed, July 14", and "historical" | Free-text statuses; no EVs, IVs, ball or level. See §7.1 |
| `lineups.json` | 4 historical "characters" and 5 what-if variations for scouting, plus coach settings. | Working, tested. `coaches` empty by design (D-047) | Authored (Claude's scaffolding from your old sheets and the handoff) | Drops the sheet's EVs, items and balls, so "January sheet" variations aren't the sheet builds |
| `build_library.json` | 131 builds: 37 stock archetypes, 42 anime, 52 ingested (48 from Showdown replays, 4 from Bulbapedia). | Working, tested | Stock and anime: authored (Claude's proposals; anime partly confirmed by Bulbapedia). Ingested: Showdown/Bulbapedia | 0 builds of yours (source "mine"); 3 exact duplicate film builds plus 1 duplicate anime build; every tier "unrated" |
| `trainers.json` | 12 trainers, 20 versions: teams, sliders and reasons, roles, ace overrides, signature moves, 28 career records. | Working, tested | Sliders, careers, signatures authored (mostly Claude's proposals, some corrected from Bulbapedia); cartridge teams point at pret | Proposed and approved feed reports identically. Your own version has no sliders or career. SoulSilver is "canon" though its roster is provisional. No Brandon or rival trainer |
| `world.json` | 17 world records (W-001…W-015 approved under D-033; W-016, W-017 proposed). | Working, tested | Authored | |
| `ranch.json` | Ranch design: shape, policies, 4 sites, 9 facilities, the Glasshouse, 10 program lines, 3 questions. | Working, tested | Authored, mixing your decisions (D-035…D-041, D-045) with Claude's proposals | `breeding_program` is a hand copy of parts of `builds.json`; plans studs for sets that are only PROPOSED |
| `lineage.json` | Individuals you've recorded (sexes, names, hatches) to override the plan. | **Stubbed: empty by design** until you record any | Authored | |
| `questions.json` | 10 open questions (Q-RANCH-1…4, Q-BREED-1…2, Q-CH-1…4); "not canon". | Working, tested | Claude-maintained register | One of 4 question registers (§7.4) |
| `field_notes.jsonl` | 680 species field notes. | Working | 668 from PokeAPI Pokédex text (labelled "cartridge"), 12 ingested via Gemini (7 marked fan work) | Includes a Gen 7 species (Morelull) from the fan video |
| `lore.jsonl` | 7 cited lore facts. | Working | Ingested (Bulbapedia, 1 fan video) | |
| `observations.jsonl` | 142 battle observations. | **Working, but 135 rows are never read (B5) [ran]** | Ingested (132 film tallies, 7 Bulbapedia send-outs, 3 Gemini page rows) | Three schemas |
| `video_styles.jsonl` | 1 documentary style card. | Working, tested | Ingested (Gemini on a YouTube video) | |
| `inbox/cards/` (31) and `inbox/raw/` (6) | Intake cards (30 closed, 1 open) and the raw analyses behind them. | Working, tested | Ingested | The open card (Brandon page) has 8 proposed observations, one with trainer "Ash / Brandon". All 1,032 applied claims are dated 2026-10-20 with no reason |

### 3.12 Generated outputs

| File | What it is | Status | Source | Current? |
|---|---|---|---|---|
| `data_manifest/blackthorn.json` | The single export for the Sheet and app. | Working, tested | Derived (plus authored decisions and text) | **Stale: 56 decisions, ledger has 58 [ran]** |
| `data_manifest/ranch_census.json` | The census. | Working | Derived | Current **[ran]** |
| `data_manifest/sheet/` (50, gitignored) | Sheets API payloads. | Working | Derived | 2 of 50 out of date vs `blackthorn.json` (Decisions) |
| `data_manifest/canon_checks_2026-10-19.json` | Output of `canon_checks.py`. | Working | Derived | **Wrong in one entry** (B32) |
| `data_manifest/legacy_canon_builds_audit_2026-10-19.txt` | Output of `legacy_audit.py`. | Working | Derived | Current |
| `data_manifest/soulsilver_playbook_gaps_2026-10-19.txt` | SoulSilver playbook gaps. | **No generator in the repo** | Derived (by code that no longer exists) | Can't be reproduced |
| `data_manifest/SHA256SUMS.txt`, `FETCHED_AT.txt` | Checksums and fetch time. | Working | Derived | Checksums match all 72 files on disk. `FETCHED_AT` is wrong: the files come from three fetches (15:22, 16:21, 18:17); the last two weren't done by `fetch_reference.py` |
| `docs/trainers/` (42) | The 20 trainer reports (md + json), README, page. | Working | Derived (`trainer_report.py all`, `page`) | Current **[ran]** for the md/json |
| `docs/scouting/*.md`, `scouting_file.html` | The six chapter packets and the Journey Scouting File page. `README.md` is hand-written. | Working | Derived | md current **[ran]**; html not re-run |
| `docs/BREEDING_LAB.md` | The journey's breeding web. | Working | Derived (`studbook_report.py`) | Current **[ran]** |
| `docs/SANITY.md` | Engine audit results. | Working | Derived (`sanity.py`) | Current **[ran]** |
| `docs/film/builds_book.html` (466 KB) | The Smogon builds book, 2026-09 at 1630+. | Working | Derived | Has the 2026-09 numbers baked in |
| `docs/documentaries/torterra.md` | A doc-prompt output saved by hand. | Working | Derived | Built partly on fan-work notes, unmarked |

### 3.13 Reference data

| Path | What it is | Status | Source | Notes |
|---|---|---|---|---|
| `engine/data_battle/gen{2,3,4}.json` (committed) | Smogon calc's moves, species and types per generation. | Working, tested | Ingested (`@smogon/calc` 0.12.0, truly pinned) | gen4 includes 24 fan-made CAP species. Tests filter them out; not every reader does |
| `engine/data/pokeref.sqlite` (gitignored, 46 MB) | PokeAPI as a database. | Working, tested | Ingested | A fresh clone must run `fetch_reference.py` |
| `engine/data/raw/` (gitignored, 52 MB) | The 53 PokeAPI CSVs, pret trainer files (15), Smogon sets (3), Smogon monthly stats (15, 2026-09), Showdown replays (850), Bulbapedia pages (47 + 3 model answers), `showdown_learnsets.ts`. | Working | Ingested | **`showdown_learnsets.ts` (3.6 MB) is never read.** The "independent learnset cross-check" in the docs doesn't exist |
| `engine/data/derived/` (gitignored) | Field-profile baselines (keyed on `ENGINE_VERSION`) and film studies and books. | Working | Derived | Cache staleness risk (§7.6) |

### 3.14 `docs/` (hand-written)

| Doc | What it is | Current? |
|---|---|---|
| `PROJECT_CHARTER.md` | Philosophy, chapters, authority rules. | Mostly. The Fly "open collision" note is overtaken by D-026–D-030 |
| `CANON_CURRENT.md` | The canon register (as of 10-19). | Matches `builds.json`; doesn't mention the lineup variations or the D-038 Light Ball |
| `DECISION_LEDGER.md` | D-001…D-058 and E-001…E-040. | Current, but ordered D-001…030, then D-058 down to D-031. E-016 sits at the very end. The source key lacks L and M. The master handoff it cites isn't in the repo |
| `ARCHITECTURE.md` | Engine map, statuses, build order. | **Partly stale:** "134 tests", Blackthorn "proposed", Glasshouse "PROPOSED", "UI not done", no web app, 15 world records (17 now) |
| `POKEMON_DATA_SOURCES.md` | Source hierarchy. | **Stale:** no Bulbapedia, replays, Smogon stats or Gemini. Claims a pinned manifest (it isn't pinned), a `field_requirements.yaml` (doesn't exist), and a test that fails when a reference build changes canon (none found) |
| `LEGACY_DATA_AUDIT.md` | Legacy Drive and Sheets audit and migration plan. | The §5 migration plan (LegacyRow, Primary/Defining Move) wasn't implemented |
| `MECHANICS_FINDINGS_2026-10-19.md` | The first verification pass. | A point-in-time record |
| `APP_PRODUCT_SPEC.md` | App proposal v0.2. | Partly superseded (it assumed a claude.ai page and code in Drive). Many items not built |
| `APP.md` | The Blackthorn HQ web app. | Current |
| `BLACKTHORN.md` | The Sheet, lineage tracker, Apps Script. | Mostly current. Leaves out the Variants log tab. Its rebuild recipe carries the non-idempotence problem (B22) |
| `RANCH.md` | Ranch design v3. | Current, except it lists "Budew" (B7) |
| `FIELD_FUNCTIONS.md` | HM/field coverage by game. | Says "Waterfall is solved", but the engine doesn't apply D-028. Says Bulbapedia is blocked (it isn't, E-034) |
| `SPECIMEN_LAB.md` | PKHeX-parity specimen design. | Current (`.pk` still "not yet") |
| `SCOUTING_ENGINE.md` | Battle scouting engine design. | Current |
| `TRAINER_REPORT.md` | Trainer report design and log. | Mostly. The Paul ace / Baton Pass claim is false (B4). Says ingestion "comes later" (it exists). Default EVs "85" (Gen 2 uses 252 stat exp) |
| `INGEST.md` | Intake design. | Mostly. "Applying twice never duplicates" (careers can); "69 questions" is stale |
| `FILM.md` | Film room design. | "Chat is never stored" (false for the cache); "observations show on the playsheet" (field ones never do) |
| `QUESTIONS_AND_EXPERIMENTS.md` | Q1–Q5 and the research queue. | Mostly; duplicates `questions.json` under other ids |

### 3.15 `legacy/` and repo root

| File | What it is | Status |
|---|---|---|
| `legacy/v3_*.md` (8), `LINEAGE_*.md` (3), `SMALL_FILES.md`, `APPS_SCRIPT_Code_gs_2025-12-15.md` | Read-only snapshots of your Dec 2025 – Jan 2026 Sheets and Apps Script. | Reference only (authored by you, transcribed) |
| `legacy/raw_extracts/` (3 CSVs) | Canon Builds rows 1–7, Copy rows 1–7, and the 54-row proxy. | Reference only. **9 files the legacy docs cite aren't here** (e.g. `v3_Canon_Breeding_Stock.md`, `v3_Natures_List.md`, the `_COMPLETE.csv` extracts). The full Copy of Canon Builds read that E-012 describes isn't saved anywhere |
| `README.md` | Project entry point. | **Stale** ("Engines v1"): says 14 tests, lists 11 of 20 docs, omits most of the engine |
| `blackthorn-apps-script.zip` (untracked) | An older copy (05:52) of `engine/app/dist/blackthorn-apps-script.zip` (13:10). | **Stray.** It differs from the current one. Don't upload it by mistake |

---

## 4. Google Sheets, tab by tab

### 4.1 Canon DB: "Pokémon Master — Blackthorn Canon DB" (`1wl--FXM94a3tfVlDzJ0J83-D2AKmKfuqVHDLtw5qDEg`), 26 tabs [live]

How these tabs are made:
- The 16 main tabs are **derived**, written by `ranch/sheet.py` payloads that Claude sends.
- The 10 log tabs are written by the web app.

Tested means:
- `sheet.py`'s payload structure is tested.
- `Code.gs` is tested against a fixture.
- Nothing is tested against the live Sheet.

| Tab | What it shows | Status | Source | What I saw live |
|---|---|---|---|---|
| Blackthorn | Dashboard: KPI tiles (live formulas over other tabs), the six chapters with sprites, program, facilities, Glasshouse, calls, 2 charts. | Working, tested | Derived | KPIs 45 / 41 / 10 / 63 / 3 / 0 / **5** / 10. **OPEN JOBS is 5; the engine says 3 (B6).** The sprite `IMAGE()` cells read `#REF!` through the API (§10) |
| Journey | Every chapter's companions with moves, item, nature, ability and build status. | Working, tested | Derived from `builds.json` | Lock guard applies to HeartGold rows |
| Residents | The 45 residents and where they live. | Working, tested | Derived | |
| Facilities | 9 facilities, jobs, who holds them, cover. | Working, tested | Derived | |
| Glasshouse | Rooms and jobs, egg schedule, crop plan. | Working, tested | Derived | **"Budew"** in the egg schedule (B7); sprite cells `#REF!` |
| Breeding Program | The 10 lines, fathers, chains, Status and Crosses done. | Working, tested | Derived; Status is meant to be yours | A rebuild resets Status/Crosses (B24) |
| Studbook | 63 individuals (36 companions, 27 planned bred rows). Hatches you record are added below. | Working, tested | Derived + authored (your hatches) | No hatches recorded |
| Pedigrees | Each line's planned pedigree. | Working, tested | Derived | |
| Fathers | The sire web and tinkering menu. | Working, tested | Derived | |
| Your Calls | Open questions with a "Your call" column. | Working, tested | Derived questions; answers authored by you | 10 questions, **all open, none answered**. A rebuild would blank answers (B23) |
| Decisions | The ledger's decisions. | Working, tested | Derived from the ledger | **Stops at D-053** (ledger: D-058) |
| Evidence | Ledger evidence rows. | Working, tested | Derived | |
| Locks | Locks and rules. | Working, tested | Derived (HeartGold hard-coded) | |
| World | World records. | Working, tested | Derived from `world.json` | One way only; not read back |
| Reference (hidden) | Species reference for the Apps Script's checks; chart sources. | Working, tested | Derived from PokeAPI | |
| Setup | How the Sheet works and what's yours to edit. | Working | Derived text | |
| Eggs, Egg Walks, Plantings, Harvests, Readings, Feedings, Journal, Timeline, Specimens, Variants | The app's log tabs (sheetIds 2001–2010). `ranch/sheet.py` doesn't know they exist. | Working, tested (with fakes) | Authored by you through the app | **All header-only: nothing logged yet** |

### 4.2 Legacy v3: "Pokemon Master Spreadsheet v3" (`1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek`), 23 tabs [live tab list; contents read from `legacy/`]

This is **retired**: no code reads it, and per your rule it's read-only. The status column says what replaced each tab.

| Tab | What it did | Replaced by |
|---|---|---|
| README | Import workflow and "run the provided Apps Script". | `README.md`, `docs/` |
| Game_Map | Game → version-group ids (correct). | `rules.GAME_VG`, `refdb.VG` (defined twice) |
| Species_Base_Pokemon, Pokemon_Master, Types_Master, Pokemon_Types_Clean, Moves_Master, Pokemon_Moves_Display, Move_Methods_Master, Abilities_Master, Pokemon_Abilities_Display, Pokemon_Species, Base_Species_Map, Natures_List, Pokemon_Egg_Groups_Clean | A PokeAPI CSV dump from about 2021. Version groups 1–20 and 114 alternate forms leak in, and 6 species were left untyped. | `fetch_reference.py` + `refdb.py` (`pokeref.sqlite`) |
| MoveLists, AbilityLists | Helper lists for the roster dropdowns. | `trainers/era.py`, `specimen.py` |
| Canon Builds | 53 rows × 22 columns: your teams, the rival, Danny (nature, ability, shiny, moves, Primary/Defining move, item, EVs, IVs, ball, location, level). | `canon/builds.json` (a partial transcription with fewer fields) + 2 `lineups.json` characters |
| Copy of Canon Builds | Column A rewritten with the later rosters, so the builds sit under the wrong names (E-012). | Evidence only |
| Canon Breeding Stock | Header only, never filled. | `ranch.json` `breeding_program` + `lineage.json` |
| ROSTER - Template | Live legality per slot. | `trainers/era.py` (D-048), the app's Lab |
| Breeding_Lab | Egg-move bundles and donors (§2.3). | `breeding/engine.py` |
| Breeding_Requirements | One rule: Volt Tackle needs a Light Ball. | `breeding/engine.py` (Light Ball handling) |

The other legacy files in Drive (v3 BLANK, v3 BACKUP ENGINE WORKING, v2 and its backups, v1, the LOCKED ENGINE backups, "Script Working Properly", "Pokemon Master") were only listed, never opened, and nothing was touched. The best known-good backup is "v3 BACKUP ENGINE WORKING" (`1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg`).

### 4.3 Agent Sheet: "Pokémon Master OS - Agent Sheet" (`1nSKFq5ZTXX2vUfMGFMBUXye-PlQaPN5oJLlAfORC6WE`), 11 tabs [live]

| Tab | What it's for | Status | Source |
|---|---|---|---|
| README | How the research agent uses the sheet. | Working | Authored |
| ASK | Research questions for an outside agent. | Working. About 59 rows marked ANSWERED or TO_RESEARCH | Derived (`intake.py asks`, pasted by hand) |
| RESULTS_CAREER, RESULTS_LORE, RESULTS_FIELD_NOTES, RESULTS_BUILDS, RESULTS_OBSERVATIONS, RESULTS_CORRECTIONS | Where the agent writes answers. | **Stubbed: headers only** | Would be ingested |
| SOURCES, JOBS, VOCAB | Supporting lists. | Working | Authored |

- No code talks to this Sheet. The loop is manual: `intake.py asks --json`, paste, the agent fills RESULTS, export to JSON, then `intake.py results tabs.json`.
- The column contract lives only in an unused constant (`ingest/sheet.py` `TABS`) and in the docs.
- The task "Refresh the Agent Sheet ASK tab and resync Drive" was left in progress and is stale. `docs/INGEST.md` still says 69 questions.

---

## 5. Data sources: how each is refreshed and what breaks if it changes

| Source | What it feeds | How it's refreshed | Pinned? | What breaks if it changes |
|---|---|---|---|---|
| **PokeAPI CSVs** (53 tables, GitHub raw, `master`) | `pokeref.sqlite` → learnsets, breeding, abilities, past stats and typing, items, berries, encounters, flavor text, habitat. Nearly every engine | `python3 -I engine/fetch_reference.py` (re-downloads everything) | **No.** Checksums recorded, never checked | Corrected learnsets silently change legality verdicts. Renamed identifiers break aliases, egg-group names, location slugs and item lookups. Renumbered ids break the version-group maps, method ids, language 9, stat ids and the #493 cap. A removed CSV aborts the fetch halfway, leaving `raw/` half-updated (B30). Field notes already in canon are frozen copies and won't update |
| **Smogon calc** `@smogon/calc` 0.12.0 (npm) | `data_battle/gen*.json` (types, moves, species for `rules.py`), runtime damage via `calc_bridge.mjs`, `app/data/calc.json` | `cd engine/battle && npm ci && node dump_gen_data.mjs ../data_battle` | **Yes** (version + lockfile hash) | A version bump changes every damage number, `rules.py`, sanity's stats check, and the app's calc |
| **Smogon sets** `@smogon/sets` 2.0.0 (npm) | `battle/knowledge.py` usage field (lab, profiles, baselines) | `fetch_reference.py` | Yes (version in URL; integrity not checked) | Only changes if the URL is edited. The source label in code would then be wrong, and baselines regenerate |
| **pret disassemblies** (pokecrystal, pokefirered, pokeemerald, pokeheartgold on `master`; pokeplatinum on `main`) | `battle/benchmarks.py`, `trainers/model.py` cartridge teams, `trainer_ai.json` | `fetch_reference.py` | **No** (`trainer_ai.json` notes SHAs for Platinum and HGSS only) | Renamed files or symbols break the regex parsers. Hard-coded HGSS trainer ids would silently pick different trainers |
| **Showdown learnsets** (`learnsets.ts`, `master`) | Nothing | `fetch_reference.py` | No | Nothing: it's never read |
| **Smogon monthly stats** (`smogon.com/stats`, 2026-09, cutoffs 0 and 1630) | Film `usage`, the builds book, spreads corrections (EVs and natures on 36 film builds), the playsheet ladder, `scout.json` ladder | `film_room.py usage`, `book`, `spreads`; `sanity.py usage --fetch` | Cached by month name only, never re-validated | **Without `--month`, it silently moves to the newest month (B35).** A missing 1630 cutoff silently falls back to 0. Schema changes break checks/counters parsing (TypeError if it becomes a list). Canon EVs stay at 2026-09 forever, because builds that have EVs are skipped |
| **Showdown replays** (`replay.pokemonshowdown.com`) | Film studies → observations and builds in canon | `film_room.py study`/`card` (live search, newest first: not reproducible day to day) | Each replay is cached forever (850). The ids used are pinned in the committed card raws | Protocol changes mostly cause silently wrong numbers, not errors (unknown commands are ignored). A search API change silently truncates. A host change orphans existing build sources |
| **Bulbapedia** (raw wikitext) | `intake.py research` → careers, movesets, signatures, send-out order | `intake.py research`; delete the cache files by hand to refresh | Cached forever (47 pages), no revision id or date | Markup or template changes silently give fewer claims. Empty movesets are blocked at approval, which is a good guard |
| **Gemini** (`gemini-3.8-flash`, fallbacks 3.7 / 3.6 / 3.5) | Video, image and page cards; prose in research | Per source, `intake.py video/image/page` | Envelopes committed; model answers cached without the model name | **A retired model (404) crashes `intake.py video` with no fallback; research silently drops the answers (B37).** Key from a network secret |
| **YouTube/TikTok oEmbed + yt-dlp** | Video downloads and metadata | Fresh each run; yt-dlp is upgraded unpinned every session | No | Download behaviour can drift |
| **PokeAPI sprites** (GitHub raw, `master`) | Sheet `IMAGE()` cells, the app | Fetched at view time | No | Moved paths mean broken images |
| **Google Fonts** | App pages, builds book, trainer page | At view time | n/a | Falls back to system fonts |
| **Your canon** (`engine/canon/*.json` + `docs/DECISION_LEDGER.md`) | Everything authored | Hand edits, or `intake.py apply` (only `build_library.json`, `trainers.json` and the jsonl files) | Git (no remote) | See §6 for what to re-run |
| **Canon DB Sheet** | The web app's live logs, Studbook hatches, Your Calls answers | You, through the app or the Sheet | n/a | Nothing in Python reads it, so your edits never reach the engines |
| **Agent Sheet** | Research results | Manual export | n/a | A renamed column leaves claims missing fields |
| **Legacy v3 sheets** | `legacy_audit.py` (one CSV export) | Never: read-only | n/a | Nothing |

---

## 6. What depends on what

```
OUTSIDE DATA                              ENGINES                                  OUTPUTS
PokeAPI CSVs ─► refdb ─► pokeref.sqlite ─┬► rules, era, specimen ───────────────┐
Smogon calc ─► data_battle + node calc ──┤                                      │
Smogon sets ─► knowledge ────────────────┤                                      │
pret ─► benchmarks, trainers.model ──────┼► battle/*  ──► scouting_report ──────┼► docs/scouting, advance*.json, battle.json
                                         ├► trainers/* ─► trainer_report ───────┼► docs/trainers ──► scouting.json, scout.json
replays, Smogon stats ─► film/* ─► ingest cards ─► canon (library, observations)│
Bulbapedia, Gemini, PokeAPI text ─► ingest/* ──► canon (trainers, notes, lore)  │
                                         ├► breeding/* ─────────────────────────┼► BREEDING_LAB.md, breeder.json
                                         ├► wilderness/* ───────────────────────┼► field.json
canon rosters/builds/ranch/world/        └► ranch/planner, hatchery, lineage ──► ranch/dashboard ─► blackthorn.json
questions + DECISION_LEDGER.md ───────────────────────────────────────────────►        │
                                                                                       ├► ranch/sheet ─► sheet/*.json ─► (Claude sends) ─► Canon DB Sheet
                                                                                       └► app/export ─► hq.json …
app/data/*.json + app/web/* ─► app/build ─► dist zip ─► (you upload to Drive) ─► WebApp.gs ─► the app ─► the Sheet's log tabs
```

**Key dependencies:**
- `trainers/model.py` imports `battle/scouting.py` to fill missing moves, and `battle/scouting_report.load_lineups` for your teams. **Battle bugs leak into trainer reports.**
- `film/study.py` and `film/cards.py` use the trainers role engine and playsheet. **Role-engine bugs (B4, B19) leak into film builds and the builds book.**
- `ranch/planner.py` uses the wilderness engine (staffing) and the breeding engine (the program). `ranch/dashboard.py` joins the census, Glasshouse, lineage, studbook, rosters, world, questions and the ledger.
- `app/export.py` reads `blackthorn.json` and `docs/trainers/data/*.json`, but **doesn't rebuild them**.
- The JS ports depend on the packs, which depend on Python. A Python fix doesn't reach the app until the packs are re-exported, the app rebuilt and the zip re-uploaded.

**There's no single "rebuild everything" command.** After changing canon (say `builds.json`), the order is:
1. `python3 -I trainer_report.py all`
2. `python3 -I battle/scouting_report.py`
3. `python3 -I ranch/report.py`
4. `python3 -I ranch/dashboard.py`
5. `python3 -I breeding/studbook_report.py` (if breeding inputs changed)
6. `python3 -I ranch/sheet.py`, and then a Claude session sends the payloads. **This is unsafe on the existing Sheet (B22).**
7. `python3 -I app/export.py [--breeder]`
8. `python3 -I app/build.py`
9. Upload the zip to Drive. WebApp.gs serves the newest one.

---

## 7. Duplication and drift

### 7.1 Your builds live in five places, in five shapes

| Home | Shape |
|---|---|
| `canon/builds.json` | The engines' journey builds: game → species → {moves, free-text status, some nature/ability/item} |
| `canon/lineups.json` `characters` | Historical sheet and handoff builds, only as what-ifs |
| `canon/build_library.json` | Where your pasted builds are *supposed* to land as "mine" (0 today) |
| `canon/ranch.json` `breeding_program` | Hand-copied move subsets |
| `engine/canon_checks.py` `MOVE_CLAIMS` | Hard-coded; still has SoulSilver Gyarados |

Plus the legacy v3 Canon Builds (22 columns), and the derived copies in the Sheet's Journey tab, `hq.json`, `docs/trainers/data/me-*.json` and `advance-*.json`.

**Concrete disagreements:**
- **SoulSilver Pikachu's Light Ball.**
  - Legacy: yes.
  - `builds.json`: no item.
  - `lineups.json`: only as a what-if.
  - D-038 / `ranch.json`: the Volt Tackle line *keeps* a Light Ball.
  - E-026: without one it wins 5 of 32 benchmark matchups, with one 17 of 32.
  - **No decision says whether your Pikachu holds one.**
- **HeartGold Tyranitar.**
  - `builds.json`: DD / Crunch / EQ / Outrage, Lum Berry, no nature.
  - Lineups' "sheet" Tyranitar: Rock Slide, Adamant, Leftovers.
  - CANON_CURRENT also records an earlier "Jolly".
  - The stud route is described three ways: E-027, ARCHITECTURE and the engine's actual Kingdra → Feraligatr.
- **Status labels.**
  - Typhlosion is "confirmed by user" in `builds.json` but "WORKING (moves); nature open" in D-012.
  - Crobat is "every source agrees" but PROPOSED in D-013.
  - `builds.json` merges sheet natures and items into July-proposed movesets under one status (Mamoswine, Crobat). That breaks "conflicting sources shown side by side, never merged".
- **Missing sources.** I couldn't find the source for Lapras's and Snorlax's natures, abilities and items.
- **Engine-filled companions.** SoulSilver Infernape, Platinum Lucario and all of Crystal have no build, so the engines fill them silently (B9).
- **Hidden Power spelling.** It's written three ways: "Hidden Power Grass", "Hidden Power Fire", plain "Hidden Power" (and the legacy "Hidden Power (Grass)").
- **Legacy Canon Builds vs `builds.json`.** Same species, different sets (Typhlosion, Tyranitar, Mamoswine, Infernape, Garchomp, Gengar, Dragonite). These are superseded by decisions, but they sit side by side.
- **The legacy Copy of Canon Builds misalignment (E-012).** Builds sit under the wrong names. The docs disagree on whether columns B–P or B–V were left unchanged, and the full read isn't saved anywhere.

### 7.2 Decisions, locks and canon's home

- **Decisions exist in three copies:** the ledger (58), `blackthorn.json`/`hq.json` (56), and the live Sheet (53).
- **D-025 vs reality.** Canon is in git, and the Sheet is derived and not read back. `world.py` and `rosters.json` notes also call the Sheet "home".
- **D-028 (LOCKED, Feraligatr gets Waterfall in Crystal)** is only in `specimen.py`. The wilderness engine says no Waterfall **[ran]**, and FIELD_FUNCTIONS says it's solved.
- **The HeartGold lock is hard-coded in three places** (`ranch/dashboard.py` twice, `Code.gs`), on top of `rosters.json`. The `Code.gs` guard over-locks the movesets (B25).
- **There are about 30 status words across files.** For example: `rosters.json` "locked" vs the ledger "LOCKED"; `ranch.json` "approved (D-041)" vs the ledger's LOCKED; `trainers.json` SoulSilver "canon" vs PROVISIONAL; sliders with no status at all.

### 7.3 Two of the same engine piece

- **Phrase books:** `battle/phrasebook.json` and `trainers/phrases.json`, both run by `battle/phrases.py`.
- **Playsheets:** `battle/playsheet.py` (situations) and `trainers/playsheet.py` (Part 2). Different things, same name.
- **Type charts:** Smogon's (`rules.py`) and PokeAPI's (`trainers/era.py`).
- **Stat calculators:** `era.py`, `specimen.py` and Smogon's calc. `sanity.py` checks them against each other (9,240 agree).
- **Move data:** `battle/moves.py` (era-correct) vs `battle/scouting.py` reading accuracy directly (B3) vs `trainers/era.py` (its own rollback, broken for Gen III: B2).
- **Team representations:** `team.Member`, `trainers` `Build`, `knowledge.Combatant`, lineup tuples, scout-pack builds.
- **Breeding cross rules, three times:** Python `lineage.check` (tested); `Code.gs crossIssues` (tested on a fixture); `app/web/50_breeding.html crossIssues` (untested).
- **The browser ports** duplicate the Python. They're parity-tested, so they agree, bugs included. JS-side constants (`ABILITY_NOTES`, `ITEM_NOTES`, `INCENSE`) are separate copies.
- **Two "what the ladder runs" datasets:** `@smogon/sets` (the lab) and the monthly chaos stats (film, playsheet). Never reconciled.
- **The battle file twice:** the stored Python run (`advance-*.json`) and the live browser rebuild. The app shows a parity badge.

### 7.4 Two or more schemas for one kind of record

- **Observations, three shapes.**
  - Film tallies: `trainer: field:*`, no version.
  - Bulbapedia send-outs: version and position.
  - Gemini page rows: display-name trainer, no version or gen.
  - None matches the design in `trainers/config.json` (`status`, `source` = provenance).
- **Field notes, two shapes.** Pokédex rows vs ingested rows.
- **A ranch individual, four shapes.** `lineage.json` `_fields`, `lineage.py` `FIELDS`, `Code.gs` `COLS`, and the Sheet's headers. The status vocabularies differ too (planned/hatched/kept/home vs the dropdown's added recorded/working/locked).
- **Open questions, four registers with different ids.**
  - `QUESTIONS_AND_EXPERIMENTS.md` (Q1–Q5)
  - `canon/questions.json` (Q-RANCH-…, Q-CH-…)
  - `ranch.json` `authoring_questions` + `open_proposals`
  - the Agent Sheet's ASK-####
- **Intake card sources.** A different shape per card kind. `app/data/inbox.json` is yet another flattened copy.
- **Trainer ids.** `ash` vs `Ash` vs `Ash / Brandon`; `field:*` ids that don't exist.

### 7.5 Duplicated constants that can drift

- **Game → generation / version-group maps** live in at least 5 files: `rules.py`, `refdb.py`, `sanity.py`, `lab.py`, `canon_checks.py`. The game-name maps live in 4 more: `lineage.py`, `dashboard.py`, `export.py`, `sheet.py`.
- **`refdb.TABLES` and `fetch_reference.CSV_TABLES`** are identical 53-entry lists.
- **Species-item lists** live in 3–4 places, and they differ: `battle/species_items.json`, `trainers/config.json` `species_items`, `roles.json` `stat_multipliers` / `species_item`.
- **Steps per egg cycle (255)** appear in three places: `ranch.json`, `hatchery.py`, and the `sheet.py` text.
- **Scenarios** are in `scenarios.json` and in `DEFAULT_SCENARIOS`.
- **The Smogon cutoff** is set in two configs. The **formats list** is in three places.
- **Replay host and URLs** are in config plus three code sites.
- **Film callers and state defaults** are in `log.py` and in config.
- **The satellite label comes in three forms:** "(Sevii Islands or the Battle Zone)", "(S-KANTO or S-SINNOH)", "(Sevii Islands or Battle Zone)".
- **Two numbers for one KPI:** OPEN JOBS (B6). **Two egg lines for one stud:** Budew / Roselia (B7).

### 7.6 Stale or orphaned copies

- **`blackthorn.json`, `hq.json`, the Sheet payloads and the live Sheet** are each behind the ledger (§1, item 4).
- **The field-profile baseline cache** is keyed only on `ENGINE_VERSION` "eval-3". If the evaluator changes without a version bump, old baselines are reused.
- **Two copies that look like "the gen4ou field study".** `data/derived/film/gen4ou-field.json` holds the last run (400 battles). The committed card raws hold the carded runs (150 and 40). The 40 tournament battles are inside the 150 too, so they were counted twice.
- **The builds book** mixes every cached replay at any rating with Smogon's 1630+ numbers. It changes as the cache grows.
- **`docs/film/builds_book.html` and `app/data/*`** have the 2026-09 Smogon month baked in.
- **The stray root `blackthorn-apps-script.zip`** is older than the dist copy.
- **`README.md` and `ARCHITECTURE.md`** are behind (§3.14). `FETCHED_AT.txt` is wrong. One entry in the saved `canon_checks` output is wrong. `soulsilver_playbook_gaps` has no generator.

---

## 8. Known bugs

Ranked by how much they change what you see. The **How I know** column: **[ran]** means I reproduced it; **[agent-ran]** means an audit agent reproduced it read-only; **[read]** means found by reading only.

| # | Where | What goes wrong | How I know |
|---|---|---|---|
| **B1** | `trainers/model.py:172` | Cartridge "second ability" is never used: the code checks `"_2"`, but pret writes `TRPOKE_ABILITY_OVERRIDE_SECOND` (368 Pokémon in the HGSS data). Red's Lapras shows Water Absorb, and Water reads as immune; his Snorlax shows Immunity. The same is wrong for Misty, Brock, Blue, Lance and Giovanni. | **[ran]** for Red and the 368 count; the others **[read]** |
| **B2** | `trainers/era.py:208` | Gen III move data isn't rolled back past Gen IV: `vg_of_gen` takes the highest Gen III version group (XD), so DP/Pt/BW changes are never undone. 53 moves are affected; e.g. Outrage 120 (was 90), Petal Dance 120 (was 70), Toxic 90% (was 85%), Curse Ghost-type. It hits your FireRed and Emerald reports and Gen III builds. | **[ran]** for the four examples; the 53-move count **[read]** |
| **B3** | `battle/scouting.py` `Scouting.accuracy()` | Uses today's PokeAPI accuracy while `MoveBook` uses era accuracy: 47 damaging moves differ across Gens 2–4. Gen 4 examples (today vs era): Bind 85/75, Fire Spin 85/70, Whirlpool 85/70, Sand Tomb 85/70, Rock Tomb 95/80, Gunk Shot 80/70, Crabhammer 90/85, Tackle 100/95, Future Sight 100/90, Doom Desire 100/85. It changes "shaky" flags, the strongest-set ranking and out-pitches. The browser port copies it. | **[ran]** |
| **B4** | `trainers/roles.py:455` | When every role scores 0, the alphabetically first one becomes primary. Paul's Ninjask becomes a "Baton Pass chain starter (0.00)" and is then counted as a Baton Pass helper for four teammates. Two tests lock this behaviour in. | **[ran]** |
| **B5** | `film/cards.py:21`, `trainers/playsheet.py:280` | 132 film observations are filed under `field:gen2ou`/`gen3ou`/`gen4ou`/`smogtours-gen4ou`, and 3 Bulbapedia rows under `"Ash"`. No trainer has those ids, so 135 of 142 rows never show anywhere. FILM.md says they do. | **[ran]** |
| **B6** | `ranch/sheet.py:582` vs `ranch/dashboard.py:156` | OPEN JOBS: the Sheet's formula counts Facilities + Glasshouse "open" = 5; the export and app say 3. | **[live][ran]** |
| **B7** | `ranch/hatchery.py:30` vs `breeding/lineage.py:73` | The egg card uses the chain root including incense babies (Budew); the lineage skips them (Roselia). The Budew row gets no sprite; RANCH.md lists Budew. | **[ran][live]** |
| **B8** | `trainers/report.py:83`, `sliders.py:118` | The disagreement sentence names the members who *show* the trait, even when the team reads the other way: "Called rigid (85), but this team reads flexible (50): low move-type variety: Ninjask, Froslass and Drapion". Those three are the rigid ones. | **[ran]** |
| **B9** | `trainers/model.py:133-148` | Movesets the engine filled in (Crystal: all 6) are labelled "canon register (rosters.json + builds.json)". The fill note is never printed, so Crystal's "Curse on all six" tag comes from engine-chosen moves. | **[ran]** (label) / **[read]** (fill) |
| **B10** | `ranch/sheet.py` Studbook writes; `Code.gs:250-259`; `WebApp.gs:129-169` | Hatches you record are appended below the 63 planned rows. A rebuild rewrites rows 5…(4+N) and never clears stale ones, so once the planned count grows it overwrites your hatches. Nothing reads hatches back into the engine either. | **[read]** |
| **B11** | `film/` + `canon/build_library.json` | The 40 tournament battles are also inside the 150-battle ladder card, so they're counted twice. 3 duplicate builds (Tyranitar CB/Pursuit, Tyranitar DD, Latias CM). Citations repeat the same battle. | **[read]** (replay-id sets compared) |
| **B12** | `breeding/engine.py:47-49, 129-130`; `app/breeder_pack.py:71` | Nidoran♂ and Volbeat (separate PokeAPI chains, male-only) are marked "Ditto only, no egg moves", but Nidoran♀ and Illumise eggs hatch them. The Breeder Lab skips them. | **[read]** (DB confirmed) |
| **B13** | `film_room.py:112` vs `:131` | `film_room.py box <id>` always crashes (`UnboundLocalError: fetch`). | **[ran]** |
| **B14** | `specimen.py:137-142, 261` | An impossible gender (e.g. female Tauros) hangs forever (non-shiny) or raises TypeError (shiny). The browser copy gives up after 5 million tries and returns null. | **[ran]** |
| **B15** | `specimen.py:81-84`, `refdb.py:330-334` | Alternate forms get the base form's stats: Rotom-Heat reads 50/50/77/95/77/91 (should be 50/65/107/105/107/86); Deoxys-Attack, Shaymin-Sky and Giratina-Origin are wrong the same way. The batch script never writes `.Form=`. | **[ran]** |
| **B16** | `lab.py:86, :208` | A trainer with the same species twice (Lance's 3 Dragonite, Will's 2 Xatu, Clair's 3 Dragonair) collides in `lab.py scout`: rows show the last duplicate's result. | **[agent-ran]** |
| **B17** | `breeding/lineage.py` | The documented `python3 -I breeding/lineage.py` fails (ModuleNotFoundError): the import runs before the path setup. `python3 -m breeding.lineage` works. | **[ran]** |
| **B18** | `trainers/sliders.py:96-100`, `model.py:144-147` | Bond can never read low (three of four signals are yes-or-nothing), and your lineup builds drop the bond fields. It reads "no signal" on 17 of 20 versions. | **[read]** |
| **B19** | `trainers/roles.py:262-265` | Filled-in default EVs (85 each in Gen 3–4; 252 stat exp in Gen 2, which maxes every EV signal) count as evidence for roles. This breaks the "missing data is never evidence" rule. | **[read]** |
| **B20** | `trainers/playsheet.py:118` | A derived-ace tie goes to the later slot. Tied: Paul (Torterra/Electivire 0.703), your HeartGold, FireRed and Emerald. | **[read]** |
| **B21** | `trainers/playsheet.py:127` | Lead and last come from list order. Paul's film puts Electivire last, but the engine calls it the lead; Gary's Golem is 6th on film, 5th in the engine. | **[read]** |
| **B22** | `ranch/sheet.py:5, :834` | "Rebuilding is safe" is false. Call 001's 15 `addSheet` requests fail on an existing Sheet, so the whole batch is rejected. `addBanding` fails on banded ranges. Conditional formats and charts pile up. No delete/clear requests exist. | **[read]** |
| **B23** | `ranch/sheet.py:439-440` | A rebuild writes Your Calls answers as `""` and Status as `open`, wiping anything you answered (including answers made through the app's `apiAnswer`). | **[read]** |
| **B24** | `ranch/dashboard.py:148` | Every program line is reset to "planned" / 0 crosses on each build, though the tab says "Status is yours to move". | **[read]** |
| **B25** | `appscript/Code.gs` `onEdit` | The lock guard undoes edits to *any* cell in a HeartGold Journey row, including PROPOSED moves. Only the roster is locked (D-006). | **[read]** |
| **B26** | `refdb.py:147-151`, `breeding/engine.py:139` | Families aren't filtered by generation, so a Crystal or Emerald plan can name a father that doesn't exist in that game (e.g. a Gen 4 evolution). | **[read]** |
| **B27** | `breeding/engine.py` `plan_lineage` | Every egg move is treated as something to inherit, even if the line can learn it by tutor (Tyranitar Outrage, Infernape Thunder Punch in Pt/HGSS). Nothing flags "also learnable". | **[read]** (DB confirmed) |
| **B28** | `breeding/lineage.py:84, 90, 119` | Targets are planned under their own game's rules (Swampert: Emerald) but checked under HGSS rules. No issues today; latent. | **[read]** |
| **B29** | `breeding/lineage.py:111-112` | Crystal (Gen 2) companions are used as sires and dams in Gen 4 crosses (Platinum Infernape's sire is Crystal's Ampharos). A Gen 2 → 4 transfer is impossible. It may be fine under D-048's "biological" legality; your call. | **[read]** |
| **B30** | `fetch_reference.py:49-50, 76-78`; `refdb.py:42-45, 89` | A failed download leaves a truncated file in place of the last good one. One bad URL aborts with `raw/` half-updated. `build` deletes the DB before reading. A missing DB is silently created empty. | **[read]** |
| **B31** | Sheet sprites | `IMAGE()` cells read `#REF!` through the API (§10). | **[live]**, unconfirmed in the browser |
| **B32** | `data_manifest/canon_checks_2026-10-19.json` | The saved output lists fathers for Mamoswine / Ice Shard in HeartGold. Ice Shard is a level-up move there (Swinub at 28), not an egg move. Current code agrees with the DB. | **[agent-ran]** |
| **B33** | `film/log.py:456-458` | A Ghost that was hit earlier and then Curses itself to 0 is credited as a KO to the earlier attacker. | **[read]**; depends on an unverified Showdown detail |
| **B34** | `film/replays.py:96-99` | The replay cache stores chat lines (3,570 in 522 replays), contrary to FILM.md, the config and `log.py`. Local only (gitignored). | **[agent-ran]** read-only count |
| **B35** | `film/usage.py:52`, `film_room.py:154` | With no `--month`, Smogon commands always hit the network and silently switch months. `Unavailable` is uncaught, so `usage`, `spreads` and `book` crash with a traceback offline. | **[read]** |
| **B36** | `ingest/cards.py:237, 254-258` | `--again` re-runs: changed claims are marked applied but never written, and builds are overwritten under the same id (losing applied EV/nature corrections). Apply drops `move_reasons` and `trainer`. | **[read]** |
| **B37** | `ingest/media.py:104-112, 363-373, 393` | No fallback when the model is retired (404). FireRed maps to Gen 1, HeartGold and SoulSilver to Gen 2. Trainer names aren't normalised ("Ash"). | **[read]** |
| **B38** | `trainers/solver.py:133-148` | For Gen II it suggests Lum Berry, Sitrus Berry and the like, which `Store.check` then flags as not in Gen II. | **[read]** |
| **B39** | `ranch/planner.py:137` | Staffing reads each companion in its chapter's game (Crystal: no abilities; FireRed: Pickup only), though the ranch is present-day Gen 4. | **[read]** |
| **B40** | `rules.py:72-74` | Generic "Hidden Power" is Normal and Physical in Gen 2–3 data; Dawn's Mamoswine's plain "Hidden Power" reads Normal in the matrix. | **[read]** |

Smaller ones (all **[read]**):
- CLI crashes on missing arguments (`trainer_report.py exposure` without `--vs`, `build` without `--role`, `report paul/sinnoh`).
- `canon_checks.py` and `legacy_audit.py` abort on any KeyError.
- `legacy_audit.py` treats Gen 2–3 eggs as wild catches.
- `lab.py fight` allows mixed generations.
- `intake.py status` calls any HTTP error "reachable".
- `pokedex.py crosscheck` duplicates its note on re-run.
- `pokedex.py` writes "Heartgold" via `.title()`.
- Unclosed files in several places.
- `datetime.utcfromtimestamp` is deprecated.

---

## 9. Hardcoded values that should be config

**Game and generation tables**
- Game → gen / version group in 5+ files (§7.5).
- The #493 dex cap (`refdb.py`, `ranch/planner.py`, `breeding/engine.py`).
- `{2: 251, 3: 386, 4: 493}` (`era.py:290`).
- `{2: "crystal", 3: "emerald", 4: "platinum"}` (`solver.py:462`).
- PokeAPI method ids (`breeding/engine.py:32`, `studbook.py:19`).
- English = language 9 (several files).
- `LAB_GAME = "heartgold"` (`lineage.py:27`, `studbook.py:18`).
- Version group `10` written as a literal (`lineage.py:90`).
- Hire game "heartgold" (`hatchery.py:67`).

**Rules and locks**
- The HeartGold lock (`ranch/dashboard.py:96, 159`; `Code.gs LOCKED_CHAPTERS`) instead of reading `rosters.json`.
- `INCENSE_BABIES` (Python) and `INCENSE` (JS).
- `STEPS_PER_CYCLE = 255`.
- `DEFAULT_SCENARIOS`.
- `D-028` `EXCEPTIONS` only in `specimen.py`.

**Thresholds**
- Trainer report:
  - 4 move slots and 510 EVs in `solver.py`, although `config.validation` has both;
  - 2:1 physical/special and "half the team is fast" (`report.py`);
  - `>= 50` pole split;
  - aggression `<1500` and `>=0.5` (`playsheet.py`);
  - the attack-heavy rule (`sliders.py:64`);
  - slider poles (`sliders.py:22`, duplicating `config.slider_scale`);
  - distance weights 1 and 0.5.
- Breeding: notable move `bp >= 60` (`studbook.py:78`); `max_depth=3`, `[:5]` caps.
- Ranch: watering bands 15/8; size classes and zone maps (`habitat.py`).
- Film: page size 51; 4 standard deviations; 3 abilities / top+4 moves; examples cap 5.

**Sentences written in code instead of `phrases.json`**
- `trainers/report.py`: `:119`, `:123`, `:136-137`, `:161-167`.
- `trainers/playsheet.py`: all the film (`:300-337`) and ladder (`:368-380`) lines.

**Sources and endpoints**
- PokeAPI and pret on `master`/`main` (`fetch_reference.py:16, 34-45`).
- The 10 Platinum trainer file names.
- The replay host in three code sites.
- Smogon text URLs (`buildbook.py:167-169`).
- The probed host list (`intake.py:50-52`).
- The sprite URL set (`dashboard.py:29-33`).
- The Gemini model, fallbacks and the `v1beta` API (already in config, but nothing checks they still exist).

**Text, labels and counts**
- `THESIS_LINE` (`dashboard.py:36-38`).
- The satellite label (`dashboard.py:121`).
- "the 9 studs", "9 studs and a Light Ball", "(255 steps)" (`sheet.py`).
- The "Pichu" fallback (`sheet.py:314, 649`).
- The Studbook validation cap of 300 rows; `$A$2:$A$494`.
- The Engine Room's "only Ash, Gary and Paul have film so far" (`room_pack.py:32`) and its status claims.
- The trainer id `"me"` (`trainer_report.py:72`).
- Default `--count 40` (docs use 150); `--game platinum`; fallback gen 4 (several places).
- Defaults that differ between engines: level 50 (`team.py`, `specimen.py`) vs 100 (`knowledge.py`, trainer config).

---

## 10. What I'm unsure about

- **The live Sheet's sprites.** The API reports `#REF!` for every `IMAGE()` cell on Blackthorn and Glasshouse. The screenshot tool was refused ("permission denied"), so I can't tell whether they render in your browser or are actually broken. Worth a look.
- **The deployed web app.** I can't reach your Apps Script deployment, so I don't know whether it's running the D-058 zip. The frame test emulates Apps Script's sandbox; it isn't Google's real one.
- **The three older briefs.** I never saw their text (§2). If they asked for something specific (say, a Canon Builds tab in the new Sheet), my "partial" could be generous.
- **Game mechanics I couldn't check against a source:**
  - Gen II priority for Protect, Detect and Endure;
  - the Gen 4 egg-step formula;
  - FireRed overworld abilities ("believed");
  - whether Showdown's Gen 4 Curse self-damage carries no `[from]` (B33);
  - whether PKHeX's PK3 `.HeldItem` takes the raw Gen 3 item index;
  - the Gemini inline-upload limit.
- **Whether `gemini-3.8-flash` and its fallbacks are still served.**
- **How two partial reference fetches (16:21, 18:17) were made.** They weren't `fetch_reference.py`. Also unknown: what produced `soulsilver_playbook_gaps_2026-10-19.txt`, and why the saved `canon_checks` output differs from today's.
- **Whether you approved the 1,032 applied intake claims one by one or in bulk** ("move forward with all", D-051). The files only carry a date.
- **Sources for some HeartGold details:** Lapras's and Snorlax's natures, abilities and items; Tyranitar's "Jolly". The master handoff isn't in the repo.
- **Whether B19 (defaults counted as EV evidence) and B29 (Crystal companions as Gen 4 parents) are bugs or intended.** Your call.
- **What's on Drive.** Since the repo has no remote, I'm not sure which docs and code have been uploaded to Drive besides the two zips you mentioned.

---

## 11. Verified by running vs only read

### I ran these myself (in the scratch copy, 2026-10-20)

- **The full test suite:** 142/142 pass in 419 s, and no tracked file changed. By class:
  - Rules 5, Engines 15, Ranch 8, JourneyLabRanch 9, ScoutingEngine 14
  - TrainerReportData 15, RoleEngine 6, RoleSolver 8, TrainerPlaysheet 9
  - Intake 10, FilmRoom 7, BulbapediaResearch 4, PokedexCrosscheck 3, SmogonUsage 4, BuildsBook 3
  - EngineAudit 9, Blackthorn 5, WebApp 8
  - This includes:
    - the four browser parity tests (the battle one on one Gen 4 lineup);
    - the Apps Script frame test (every page and menu, 1440 and 390 px);
    - `test_rules.mjs` and `test_webapp.mjs`.
- **`sanity.py`:** 0 problems.
- **Generators**, all identical to committed output except the decision counts in `blackthorn.json` and `hq.json`:
  - `trainer_report.py all` (20 reports)
  - `ranch/report.py`, `ranch/dashboard.py`, `ranch/sheet.py`
  - `breeding/studbook_report.py`
  - `battle/scouting_report.py` (markdown)
  - `app/export.py`
- **CLIs:**
  - `intake.py status`: Gemini key present, research hosts reachable, yt-dlp installed, 31 cards with 1 open.
  - `intake.py list`.
  - `lab.py lineups` (11) and `lab.py team heartgold`.
  - `trainer_report.py list` (20 versions), `report paul sinnoh`, `report red`, `report me crystal`, `roles paul/sinnoh`.
- **Bug reproductions:**
  - B1: pret's Red vs the report.
  - B2: `Era.move_info` in Gen 3 vs 4.
  - B3: the 47-move accuracy comparison.
  - B4: Ninjask's role.
  - B5: observation trainer-id counts.
  - B6: KPI 3 vs the live 5.
  - B7: Budew and Roselia both in the export.
  - B8: the Paul sentence.
  - B9: the Crystal source label.
  - B13: `film_room.py box`.
  - B14: female Tauros, shiny and non-shiny.
  - B15: Rotom-Heat stats.
  - B17: `lineage.py` invocation.
  - D-028: Crystal Feraligatr's field evidence has no Waterfall.
  - `workbench.py` can't run on its own.
- **Git:** no remote (`git remote -v`).

### Agents ran these (read-only modes: no bytecode, SQLite read-only, nothing saved)

- `sha256sum -c` on the 72 reference files: all OK.
- Re-runs of `canon_checks.py` (one entry differs), `legacy_audit.py` (identical), the census (identical).
- The `lab.py scout` duplicate-name collision (B16).
- The specimen hang (B14), independently.
- The replay-cache chat count (B34).
- The overlapping replay-id sets (B11).

### I read the live Google Sheets (read-only)

- The Canon DB: all 26 tabs earlier in this audit; Blackthorn and Glasshouse again today for KPIs, formulas and sprites.
- The legacy v3 tab list.
- The Agent Sheet's tabs.

### Read only: not executed by anyone in this audit

- `fetch_reference.py` and `refdb.build` (network; they rewrite `data/`).
- `battle/dump_gen_data.mjs`.
- `film_room.py study`, `card`, `usage`, `spreads`, `book` (network).
- `intake.py video`, `image`, `page`, `research` (network and Gemini).
- `app/breeder_pack.py` (slow).
- `trainer_report.py page`, `battle/scouting_report.py --page`.
- Everything Apps Script inside real Google: Code.gs on the live Sheet, the deployed WebApp.gs.
- The Sheet payloads being sent.

Every **[read]** bug in §8 was found by reading code and data, and I didn't reproduce it.
