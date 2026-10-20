# Levers: what you can edit, and where each change lands

**Built:** 2026-10-20, read-only, on top of `STATE.md`. Nothing in the repo, the Sheet or Drive was changed, and nothing was committed. Every run happened in a scratch copy outside the working tree, with `engine/data` included. No network was used.

**Files in this folder:**
- `LEVERS.json`: 1,831 levers, each with every field you asked for.
- `DEPENDENCIES.json`: has three parts.
  - (a) Every output, the command that rebuilds it, and its direct inputs.
  - (b) Every lever and the outputs it reaches, transitively.
  - (c) The rebuild graph as edges.
  - It also holds the raw Pass 3 results under `measured_pass3`.

**Evidence tags:**
- **[traced]**: found by static analysis. Readers come from grep. Reach is the import graph plus the places one output reads another output's file.
- **[measured]**: I perturbed one value in the copy, re-ran every fast generator, and byte-diffed the outputs.
- **[guess]**: inferred, not checked.

**How far to trust the trace.** It is **complete but coarse**. In all 10 measured runs, nothing changed that the trace hadn't predicted. The trace does over-predict, though, for two reasons:
- Imports are module-level, so it counts a module as a reader whenever it's imported.
- Every Sheet tab hangs off the same `blackthorn.json`.

So treat a lever's `reaches` as "could reach". The measured entries say what *actually* changed.

---

## 1. The ten widest levers, with measured effects

Reach counts output families, with the Sheet counted as one family. All ten were measured, using the perturbation you named. Runs p1–p9 plus an extra p7b.

| # | Lever (id) | Traced reach | What changed when I moved it [measured] | One concrete change |
|---|---|---|---|---|
| 1 | **A journey build**: `builds.heartgold.Tyranitar` (nature: none → Jolly) | 25 families | 7 files: the HeartGold packet, `me-heartgold.json` stats, `battle.json`, `hq.json` party, `scout.json`, `scouting.json`, Journey tab payload. **Also** `advance*.json`, but only after `scouting_report.py --page` (316 s). | Packet "Pace … absorbs first **44**, p7" → "**45**, p9"; Tyranitar Spe 179 → 196, SpA 247 → 222 |
| 2 | **A chapter roster** (`rosters.<game>.roster`) | 25 families | Not perturbed; traced only. It has the same readers as the builds plus the residents, founders and census. [traced] | n/a |
| 3 | **The era / game of a report**: `trainers.paul.sinnoh.game` (platinum → emerald) | 4 (that report, README, scout, scouting) | 5 files, but a large change inside them: legality flags appear, bulk leans flip, role scores move, and the ladder switches from gen4ou to gen3ou | "The one soft spot: **Drapion** (specially soft)" → "**Electivire** (physically soft)"; 12 new "⚑ … doesn't exist yet in Gen 3" lines |
| 4 | **A role weight**: `roles.role.revenge_killer` (`spe` 2 → 0) | 6 | 30 files: 13 trainer reports, `builds.json` (app library role reads), `scout.json`, `scouting.json`. **Paul's derived ace flipped.** | "the data's is **Torterra** …" → "the data's is **Froslass** (… a weather setter)" |
| 5 | **A Part 1 threshold**: `cfg.tags.cohesive.min_members` (3 → 2) | 4 | 34 files: every trainer report (md + json), `scout.json`, `scouting.json` | Brock: "Cohesive (Rock Slide)" → "Cohesive (Rock Slide, Earthquake and Sandstorm)"; Cynthia gains a Cohesive tag |
| 6 | **A trainer slider**: `trainers.paul.sinnoh.slider.offense` (85 → 20) | 4 | 4 files: Paul's md + json, `scout.json`, `scouting.json`. A disagreement flag now appears. | "Paul comes at you with force…" → "Paul takes the first hit and grinds you down…"; the table reads "20 (defensive) \| 72 \| reads offensive" |
| 7 | **A program line**: `ranch.program.Tyranitar` (drop Outrage) | 7 | 7 files: census, `blackthorn.json`, `hq.json`, Sheet tabs Blackthorn, Breeding Program, Studbook, Pedigrees | "stud ♂ knowing **Outrage, Dragon Dance**" → "stud ♂ knowing **Dragon Dance**" |
| 8 | **A hard-coded threshold**: `breeding/studbook.py:78` (`bp >= 60` → 80) | 6 | 4 files: `BREEDING_LAB.md`, `blackthorn.json`, `hq.json`, Fathers tab | Crystal Feraligatr's sire web "Charizard: Ancient Power, Bite, Crunch" → "Charizard: Crunch"; Arcanine drops off the top-fathers list |
| 9 | **The HeartGold lock**: `rosters.heartgold.status` (locked → working) | 7 | 6 files: the HeartGold packet, `battle.json`, `hq.json`, `blackthorn.json`, census, Studbook payload. **The Locks tab and Code.gs guard did NOT change** (both hard-coded). | "*Roster status: **locked** (D-006)…*" → "**working**" |
| 10 | **A phrase rule**: `phrases.report.combo_off_rigid` (+ " [P6]") | 4 | 6 files: the reports of the two trainers whose bands fire it (Paul, Giovanni), `scout.json`, `scouting.json` | "…one plan, executed hard." → "…executed hard. [P6]" |
| + | **Glasshouse lap length**: `ranch.designs.hatchery_greenhouse.loop_steps` (255 → 128) | 7 | 4 files: `blackthorn.json`, `hq.json`, Blackthorn and Glasshouse tabs | Larvitar "40 laps / 20 with Flame Body" → "80 / 40", while steps stayed 10,200. The sparkline's hard-coded `max 40` now overflows |

Two more notes on reach:
- The reference sources (`source.pokeapi`, `source.smogon_calc`) and `refdb.py`'s tables reach even more (every family). They weren't perturbed, because doing so means a network refetch or a calc rebuild. [traced]
- Pass 3 timings, under 4 runs in parallel: trainer reports 8 s, battle packets 160–177 s, census 10 s, dashboard 43 s, sheet payloads 1 s, studbook 1 s, app export 117–131 s, `--page` 316 s. Alone, the packets take 136 s and the export 118 s. Those two (plus `--page`) are over your 2-minute line. **I ran them anyway**, because without them half the outputs couldn't be judged. `film_room.py book`, `sanity.py` and `export.py --breeder` were not run: the first needs the network, and the other two aren't on the fast path.

---

## 2. Levers by area

Totals by kind: table 535, config 491, sentence 317, canon 259, hard-coded 202, source 24, lock 3.

Totals by provenance: claude-proposal 1,093, engine-default 528, yours 112, ingested 98.

### Battle engine (`battle/`)

**Authored levers:**
- **The battle phrase book** (`phrasebook.json`, about 170 rules).
  - It changes the six packets, `battle.json` and the Battle Lab.
  - **The Battle Lab edits its numeric `when` values and on/off live**; the wording isn't editable there.
- **`lineups.json`**: characters, variations, and `coaches`.
  - `coaches` is empty and yours by D-047. **The Battle Lab edits the four coach knobs live**: aggression, patience, heal line, risk tolerance.
- **`species_items.json`.** [traced]

**Ingested:** `trainer_ai.json`. [traced]

**Hard-coded:**
- About 60 module constants and 90 comparison literals, chiefly in `evaluate.py`, `scouting.py` and `trainer_policy.py`.
- `SLEEP_TURNS` and `ERA_FIXES` are marked "believed; verify". [traced]

### Trainer reports (`trainers/`)

**`trainers/config.json`: 282 leaves.**
- **27 of them are live knobs in the Scouting Lab** (`RULE_KNOBS`): slider bands, bulk, team-summary counts, the Cohesive and Type-dominant counts, measured-slider signals, open-field defaults, playsheet thresholds, and 5 role-engine values.

**`roles.json`: 34 roles, 75 signals, 41 move categories, item and ability groups, EV templates, solver settings.**
- Only `confidence.*` and `pool.investment_lean` / `pool.nature_tilt` are live in the lab.
- **Measured: one weight moved an ace (§1 row 4).**

**`phrases.json`: 73 rules.**
- Wording plus `when` thresholds.
- Not editable in the app.

**`trainers.json`:**
- **Era (`game`)**: one per version; live in the Scouting Lab.
- **Sliders**: 56; live.
- **Teams**: live.
- **Career and signature moves**: live.
- **Roles, overrides.ace, notes**: not live.

### Breeding, ranch, wilderness

**`ranch.json`:**
- **Breeding-program lines (10)**: measured.
- **Glasshouse design values**: measured on `loop_steps`.
- **Sites, facilities.**
- **The three policies** (`residents_policy`, `stock_policy`, `staffing_policy`) **change no behaviour**: only their `rule` text is copied into `ranch_census.json`. [traced]
- **`premise` is read by nothing.** [traced]

**`world.json`: 17 records.**
- Approval status is the lever: approved records become "authored" staffing and readiness evidence.

**`scenarios.json`** and **`camp_life.json`**:
- They reach **only `field.json`** (Field readiness).
- They do *not* reach the census, KPIs or the Sheet. [traced]

**`lineage.json`:**
- Empty.
- It would override the planned pedigree.

### Film and ingest

**`film/config.json` and `ingest/config.json` (about 260 leaves).**
- Ingest levers reach canon **only through `intake.py apply` after you approve a card**; their `reaches` list stops at `canon:intake`.
- **Film levers reach:**
  - the playsheet ladder lines, through `usage.cutoff` and the Smogon month;
  - the builds book, which needs the network to rebuild;
  - the app's `builds.json`, **only through the committed `docs/film/builds_book.html`** (a stale copy). [traced]

### Canon and decisions

**`builds.json`: 18 builds.**
- **Measured:** row 1.
- Builds are live **as what-ifs** in the Battle Lab and the Scouting Lab; never saved.

**`rosters.json`:** rosters, statuses (the HeartGold lock), theses.

**`questions.json`:** Your Calls.

**`DECISION_LEDGER.md`:**
- Feeds the Decisions and Evidence tabs and the decision KPI.
- Rows with fewer than 6 cells are dropped silently.

### App and Apps Script (browser-only levers)

**121 JS constants**, e.g. `INCENSE`, `COACH_KNOBS` defaults, `RULE_KNOBS` ranges, `CELL`, `STATUS_CHIP`.
- They change only the screen that holds them.

**`Code.gs` `LOCKED_CHAPTERS`:**
- It governs the live Sheet's edit guard, independently of canon. [traced]

### Sources

| Source | What it controls |
|---|---|
| PokeAPI CSVs (unpinned `master`) | — |
| `@smogon/calc` 0.12.0 (pinned) | — |
| `@smogon/sets` 2.0.0 | — |
| pret (unpinned) | — |
| The Smogon stats month (the newest cached one wins) | — |
| The replay cache | — |
| The sprites URL | — |
| Showdown `learnsets.ts` | Nothing: dead |

---

## 3. Hard-coded levers that are duplicated or should move to config

All [traced]. The `duplicates` field in `LEVERS.json` holds the full lists.

1. **The HeartGold lock lives in three places that don't agree.** **[measured]**
   - The places:
     - `rosters.json` status (the lever);
     - `ranch/dashboard.py:96,159` (hard-coded `== "heartgold"`);
     - `Code.gs LOCKED_CHAPTERS`.
   - Flipping canon changed the packet and Studbook text, but not the Locks tab or the guard.
   - **Move:** read `rosters.json` everywhere.
2. **Steps per egg cycle vs lap length.**
   - `hatchery.py STEPS_PER_CYCLE = 255` is hard-coded; `ranch.json loop_steps` is config.
   - `sheet.py` prints "(255 steps)", and its sparkline has `max 40` hard-coded.
   - **[measured]** changing `loop_steps` doubled the laps but left the steps and the sentence alone.
3. **Species items** sit in 3–4 lists that differ: `battle/species_items.json`, `trainers/config.json species_items`, `roles.json stat_multipliers` / `species_item`.
4. **Game → generation / version-group maps** are defined in at least 5 files: `rules.py`, `refdb.py`, `sanity.py`, `lab.py`, `canon_checks.py`. **Game display names** are defined in 4: `lineage.py`, `dashboard.py`, `export.py`, `sheet.py`.
5. **The level-100 default** appears as `trainers/config.json level_scale` and `roles.json pool.level`. **Default IVs and EVs** appear in `trainers/config.json defaults`, `battle/knowledge.py` and `trainers/era.py:148-149`.
6. **The Smogon cutoff** appears in `film/config.json usage.cutoff` and `trainers/config.json ladder.cutoffs`.
7. **Film callers** appear in `film/log.py CALLERS` and `film/config.json actions.called_from`.
8. **Slider poles** are hard-coded in `sliders.py POLES`, while `config.slider_scale` is unread (dead).
9. **Scenarios** are in `scenarios.json` and again as `DEFAULT_SCENARIOS` in code.
10. **`INCENSE_BABIES`** (Python) is copied as `INCENSE` (JS, `50_breeding.html`).
11. **Thresholds that are only in code and belong in config:**
    - `studbook.py:78` `bp >= 60` (measured, row 8);
    - the 2:1 physical/special split and "half the team is fast" (`report.py`);
    - aggression `<1500` / `>=0.5` (`playsheet.py`);
    - the solver's 4 move slots and 510 EVs, even though `config.validation` has both;
    - distance weights 1 / 0.5;
    - `habitat.py` size classes and zone maps;
    - watering bands 15 / 8;
    - film page size 51 and the 4-standard-deviation check score.
12. **Sentences written in code** (the `code_sentences.*` levers, 26 files, about 500 strings).
    - Most matter where they're output wording: `room_pack.py`, `ranch/sheet.py`, `battle/scouting.py`, `trainers/report.py`, `trainers/playsheet.py` (the film and ladder lines).
    - Also `dashboard.py THESIS_LINE` and the satellite label.
13. **D-028 (Waterfall)** lives only in `specimen.py EXCEPTIONS`; the wilderness engine ignores it.

---

## 4. Levers that reach no output (dead)

All [traced] by grep and the import graph.

- `trainers/config.json`:
  - `slider_scale.*` (4)
  - `defaults.nature`
  - the whole `observations` design block
- `film/config.json`:
  - `actions.locked_tags`
  - `cards.players`, which is empty, so it maps nothing
- `ranch.json`:
  - `premise`
  - the three policy blocks: their rules are text-only, landing in the census only
- Code constants:
  - `ingest/sheet.py TABS`, `VOCAB`
  - `film/log.py SCREENS`, `RESIDUAL`
  - `lab.py GAME_OF_GEN`: CLI stdout only, no stored output
- **Partly dead canon:**
  - **135 of 142 `observations.jsonl` rows** (STATE B5)
  - the 4 Brandon builds: no trainer uses them
- Sources: Showdown `learnsets.ts`
- **[guess]** `roles.json`'s typing weight `"choice": -2` (STATE notes `roles.py` never reads it). It sits inside a table, so the registry doesn't list it as its own lever.

## 5. Outputs no authored lever reaches (orphans)

**[traced]**
- **`data_manifest/canon_checks_*.json`**: its claims are hard-coded in `canon_checks.py` (`MOVE_CLAIMS` still includes Gyarados) instead of reading `builds.json`. Your builds can't reach it.
- **`data_manifest/legacy_canon_builds_audit_*.txt`**: only the legacy CSV reaches it.
- **`data_manifest/soulsilver_playbook_gaps_2026-10-19.txt`**: no generator exists.
- **`app:atlas`**, **`app:learnsets`**: in practice only PokeAPI, the refdb tables and `ranch.planner` group names. Every measured canon/config change left them byte-identical. **[measured]**
- **The Sheet's 10 log tabs** (Eggs … Variants): only you, through the app. No engine output reaches them, and nothing reads them back.

---

## 6. Your draft, checked

| Your row | Verdict | What's right | Evidence |
|---|---|---|---|
| a build → reports, roles, matchups, battle packets, Journey tab, Glasshouse crop plan, breeding plans, app party | **Corrected** | Packets, report data (stats), Journey, app party: yes. The trainer-report *markdown* didn't change for a nature edit (stats show only in the json). **Missing:** `scout.json`, `scouting.json`, `battle.json`, and `advance*.json` (only after `--page`). **Crop plan:** only through the build's *item*. **Breeding plans:** a build's moves reach only founders' moves (Studbook "knows", sire web). The program targets in `ranch.json` are a **hand copy** and don't follow `builds.json`. | p1 [measured]; crop/breeding [traced] |
| the era → every verdict, stat, move datum, legality check | **Corrected** | Legality flags, bulk leans, ability notes, role scores, the physical/special split and the **ladder month/format** all changed. The type-matrix verdicts barely moved (the Gen 3 and 4 charts match), and Gen 3 move data barely moves because of STATE B2 (Gen III isn't rolled back). Reaches that one report, README, scout and scouting; not the app's hq or builds. | p2 [measured] |
| sliders and careers → report sentences, disagreement flags, playsheet aggression | **Confirmed** (sliders) | Band sentence and disagreement flag measured. Aggression comparison: the slider is read [traced], but the line didn't change here. Careers: [traced] only. | p3 [measured] |
| thresholds → verdicts, tags, bulk lean, gaps, combos | **Confirmed** | Tags measured across all 20 reports. Bulk/gaps/combos [traced]. Add: thresholds in **code** behave the same but no lab can reach them. | p4, p9 [measured] |
| roles.json → roles, ace, go-to by state, solver, film reads | **Confirmed, plus one** | Roles and the **ace** measured (Paul's flipped); go-to [traced]. **Missing:** the app's `builds.json` library role reads (measured). Film reads [traced]; the builds book wasn't rebuilt (network). | p5 [measured] |
| phrases → wording only | **Corrected** | The `say` text is wording only (measured). But each rule's **`when` conditions decide whether a sentence appears at all**, so they're logic levers. The *battle* phrase book is a separate file, and its thresholds are live in the Battle Lab. | p6 [measured] |
| reference data → learnsets, legality, eggs, damage | **Confirmed, wider** | Also: past stats, typing, abilities, Pokédex text (field notes), berries (crop plan), habitat (zones), encounters (fathers catchable in-game), sprites. Not perturbed (it needs a refetch). | [traced] |
| ranch/world/camp_life → program, egg schedule, staffing, readiness, KPIs | **Corrected** | Program and egg schedule measured. **camp_life reaches only Field readiness (`field.json`)**, not ranch or KPIs. Policies change no behaviour. World approvals → staffing and readiness [traced]. | p7, p7b [measured] |
| decisions and locks → HeartGold lock, Decisions tab | **Corrected** | Canon lock status → the packet line, `battle.json`, `hq.json`, census, Studbook text. **Not** the Locks tab or the Sheet guard (hard-coded). Ledger → Decisions/Evidence tabs, the decision KPI, the app record page [traced]. | p8 [measured] |

**Levers you didn't list:**
- `lineups.json`: variations and the empty `coaches`, live in the Battle Lab.
- The battle `phrasebook.json`.
- `trainer_ai.json`.
- `era_corrections.json`: legality and priority.
- `build_library.json`: anime teams and stock archetypes. The archetypes drive "closest archetype" and distance.
- `film/config.json usage.cutoff` and the **newest cached Smogon month**. A new month silently changes ladder lines (STATE B35).
- `world.json` approval status.
- `questions.json`.
- `sanity.json`: SANITY.md, which feeds the Engine Room.
- The `ENGINE_VERSION` cache key (profile baselines).
- The trainer id `"me"`.
- `trainers.json` notes and overrides.ace.
- The free-text `status` on each build: printed on Journey, in scout.json and in the packets.
- `Code.gs LOCKED_CHAPTERS`.
- The hard-coded dashboard reset `"status": "planned"` (STATE B24).
- `THESIS_LINE` and the satellite label.
- Browser-only knob ranges.

---

## 7. Mismatches between the static trace and the measurements

**Changed but not traced:** none, in any of the 10 runs.

**Traced but didn't change:**
- **Breeding.** A build's nature doesn't reach breeding: `BREEDING_LAB.md`, the Studbook, Fathers and `blackthorn.json` stayed the same. Only a build's moves or item feed the ranch side. The trace links the whole file.
- **App advance files.** A build change doesn't reach `app:advance` with the normal packet run. `advance_pack.py` reads the committed `docs/scouting/scouting_file.html`. **[measured]**: it changed only after `--page`.
- **Sheet tabs.** The trace says every tab, but only some change:
  - p7 → Blackthorn, Breeding Program, Studbook, Pedigrees
  - p7b → Blackthorn, Glasshouse
  - p9 → Fathers
  - p8 → Studbook
  - p1 → Journey
- **The census.** `ranch_census.json` is traced for loop_steps and the studbook threshold, but didn't change.
- **App files.** `app:atlas`, `app:learnsets`, `app:journal`, `app:room`, `app:field` and `app:builds` are traced for most canon and config levers. They changed only where noted above (`builds.json` for roles.json).
- **Trainer reports and the HeartGold lock.** `docs/trainers` and `scout.json` are traced for the lock but didn't change: trainer reports never print chapter status.

**Couldn't judge** (not regenerated):
- `docs/film/builds_book.html`: network
- `docs/SANITY.md`: not on the fast path
- `app:breeder`: slow `--breeder`
- the trainer-report page
- the live Sheet and the deployed app

---

## 8. What I couldn't check

- **The live Sheet and the deployed app.** Sheet-tab effects are measured on the payload files, not on the Sheet.
- **Reference-data perturbations:** PokeAPI, calc version, pret. They need a refetch, so they're traced only.
- **The builds book and SANITY.md.** Not rebuilt.
- **Per-function reach inside a module.** The trace is module-level; the measured rows are the precise ones.
- **Live-in-app claims.** These come from reading `75_scoutlab.html` (`RULE_KNOBS`, slider, game, member, career and signature editors) and `77_battlelab.html` (members, coach, phrase-book thresholds). I didn't click through them in this pass.
- **The `effect` text** on the ~700 code-level levers is generic ("module constant X"). Their reach is traced, but I didn't read each one.
