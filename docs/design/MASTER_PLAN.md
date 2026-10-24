# Blackthorn OS — master plan: architecture and gap analysis

Status: **approved and being built** (D-065: *"Okay this is the new plan. Use the old framework but build the new plan. Feel free to change the old plan"*). The four blocking questions got reversible defaults (D-066). Progress is kept in §0 below.

Written 2026-10-24 from Zack's seven specifications (`docs/specs/`), four
read-only audits of the code and data made the same day, and the decision ledger (D-001…D-064). Nothing here has been
built. Every spec asks for this document first; none asks for code from it.

Where a fact below came from an audit, the file it lives in is named so it can be rechecked. The load-bearing ones
(the Ace score, the unused field-EV setting, the Pokémon lab's EV limits, Drive access, ledger statuses) were rechecked
by hand before writing.

## 0. Build status

| Phase | State | What's in |
|---|---|---|
| 0 | done | The Ace score note now matches the code (plain mean; it decides nothing); the unread `field_evs_each` is gone (the field keeps no EVs, D-064); the Pokémon lab's EVs are capped at 252 and 510 with a live count and a "how EVs work" note; engine-filled movesets say so (B9); ingested journal notes are research or world-building, never Personal observation; Crystal Feraligatr's Waterfall (D-028) reaches the field engine; staffing reads every resident in the present-day game (B39); scenarios live only in scenarios.json; report tags aren't called badges; docs/design/DATA_CONTRACT.md |
| 1 | built, waiting on your Apps Script redeploy | Your records: My Pokémon, My Builds, My Teams tabs (append-only), read live and merged in the browser (`21_records.html`) and by the engine (`store/personal.py` → `store/migrate.py` → team roles). The Pokémon lab saves versions (the old one stays), keeps unsaved drafts across navigation, shows the version history and loads any version, edits the individual (nickname, sex, shiny, ball, met), adds new Pokémon (two of a species is fine), and makes anyone's build your own. The team lab saves and opens teams; the Field page offers them |
| 2 | built | Recognition (`trainers/recognition.json`, `recognition.py`, `29_recognition.html`, held together by a parity test): damage evidence from the Ace fights (no new fights), stat tiers and Speed milestones computed from bases (the spec's numbers exactly), least-EVs-to-the-next-tier, tags from the role engine, functional archetypes for every build, proposed signature archetypes (all off), Ace plus two provisional qualifications, a Recognition card in the Pokémon lab, a version keeps its recognition line, the Standards page, a calibration step. Tiers were set from the calibration (each near the 50th/70th/85th/95th percentile, building on each other; walls count four hits), because the Elite Four's and Champions' Pokémon have no EVs and single-hit numbers saturate. Still to come: the solver in the browser for archetypes further away, trying a threshold in the Standards page before changing it, and a competitive-threats collection |
| 3 | built, waiting on your Apps Script redeploy | The five spaces in the menu (My World, Builder & Studio, Labs, Pokédex & Reference, Trainer Library, with the record underneath); owner labels on every build (mine, trainer, reference, variant); one explanation system (`22_explain.html`, `app/explain_pack.py`, `reference/mechanics.json`: each game's own ability and item text, natures with what they raise and their alternatives, moves, EVs, IVs, STAB, category, priority, Speed ties, Hidden Power, learnability) in the Studio and the builds lab; Your Pokémon and the hybrid profile with the showcase view; default art by sex, shininess and form (only the variants that exist); pictures uploaded to a Drive folder with the My Artwork tab, a gallery, a chosen profile picture and back to default; image packets. Changed from the plan: Apps Script's DriveApp needs the full Drive permission to create a file (`drive.file` would need Google's advanced Drive API), so the script asks for `drive` and only writes in its own folder |
| 4 | built | Breeding stock (`breeding/stock.py`, its browser copy `23_stock.html` over `app/data/breeding.json`, held together by `app/test_stock_parity.mjs`; pages in `88_stock.html`, menu Builder & Studio → Breeding stock). The hatch order read from the games' own code (pret decompilations): Gen 2 checks the father's moves one at a time (egg move, then a move both parents know, then a TM, HM or Crystal tutor move); Gens 3–4 add his egg moves, then his TMs, then moves both parents know, then the Light Ball's Volt Tackle (Emerald and Gen 4; FireRed's is cut out); hatch level 5 in Gens 2–3, 1 in Gen 4; a fifth move pushes the oldest out. From that: every move's class at hatch, the parents' movesets that make an exact set (including keeping a default by having both parents know it), the father's lineage for the whole set (egg moves and his TMs together, up to three generations), and the four-state verdict (possible · obtainable, with or without trades or a transfer · PKHeX expected · documented). The line catalogue ("all my Larvitar configurations"): defaults, egg moves with one-step fathers, sets one father carries, TMs, both-parent moves, Light Ball, evolution by a known move. The designer saves blueprints (`kind: blueprint` in My Builds, with purpose and labels) with versions; "Record one hatched" makes one of your Pokémon with its hatch moves kept (`hatch_moves`, `sire`, `dam`, `blueprint` on My Pokémon, X3); compare says what makes two blueprints different; "what it might suggest" shows the evidence by kind and draws no conclusion. Fixed: B26 (families exist in their generation), B27 (other routes to an egg move are shown), B28 (each cross is checked under its own game). One search instead of three copies: `breeding/engine.py` delegates to `stock.py`; the search's order is now total (it was set order), so a few planned chains changed among equally short ones (Tyranitar: Kingdra → Charizard; Infernape's sire FireRed Alakazam; Swampert's Emerald Milotic). Defaults taken: D-067. Still to come: IV and nature planning as a search (the odds are shown), ecology claims per line (Phase 8) |
| 5 | built | The Trainer Library (`trainers/library.py` reads every Gym Leader, Elite Four, Champion, rival meeting, rematch, villain and special battle of the five games from the pret data: 350 encounters; `trainers/catalog.py` joins them with the authored trainers into 79 identities and 363 versions, packed by `app/library_pack.py`). Version kinds (cartridge, anime, all-time, journey, custom), rematches and rival meetings as versions, evidence classes per field, two lenses (as encountered, standardized), 37 collections with rules and version stamps, AI flags read as tendencies and competence with authored sliders as "your reading" (Q9). Pages (`24_library.html`, `89_trainers.html`; menu Trainer Library → Trainers, Benchmarks): directory with filters, trainer profiles (the team field by field, research and assumptions, how they think, career, tools), version compare, the benchmark runner (any of yours against a team, a collection or your own group, the rule and stamp shown, the bar movable; the Ace collections reproduce the Ace test's rates exactly), your own versions (optimized or all-time, saved to My Teams with `kind`, `trainer`, `parent`; the original never changes), "Try a bar" on the standards. Intake: a `trainer_version` claim adds a version with its roster, never overwriting one; a corrected build keeps its old values as an earlier version. Every call made along the way is in the assumptions register (`engine/store/assumptions.json`, docs/design/ASSUMPTIONS.md, Your calls; D-068). Spec criteria 1–4 and 7–10 checked by `app/test_library.mjs` |
| 6 | built, waiting on your Apps Script redeploy (for My Gear) | The Poké Ball collection (`equipment/balls.py`: all 25 balls of Gens 1–4 with PKHeX numbers, which games have each and under what name, kind, tags and related balls). Every effect is read from the game's own catch code at a pinned commit (Red, Crystal, Emerald/FireRed, Platinum, HeartGold) and `balls.check()` re-checks each number against that code on every build; the games' bugs are kept and named (Crystal's Moon Ball never fires, its Love Ball wants the opposite sex, its Fast Ball checks only three species, HeartGold's Heavy Ball takes 20 off everything under 204.8 kg). The catch engine (`equipment/capture.py`, its browser copy `33_capture.html`, held together by `app/test_capture_parity.mjs`: 36,256 throws identical) works out one throw the game's own way from each generation's catch rates (`equipment/species.py`). Pages (`91_gear.html`; menu Pokédex & Reference → Poké Balls, Equipment): the collection with filters, a profile per ball led by its exterior (Dream World art or the game's sprite; yours replaces it), game tabs with the mechanics, the game's own description and how you get it, the formula, a calculator, the interior (direction, brief, upload, opened large), the Apricorn and Kurt, related balls and your Pokémon in it; the catch planner ranks every ball for one throw; the equipment library (28 pieces in the games' words) with My Gear, a new append-only tab. Your Pokémon: the Studio checks a ball against how the species (or what it evolved from) is met in that game; the profile shows its ball with the exterior and its interior, the standard one or your own through the image packet's new 'Inside its Poké Ball' purpose. No pictures were generated: image models aren't open to this project's free Gemini key, so every picture is a brief plus your upload. Calls made: D-070, A-28…A-37. Ball spec criteria 1–10 checked by `app/test_gear.mjs` |
| 7–8 | not started | The 6v6 engine is being built separately (D-069) and plugs in through `docs/design/SIXVSIX_SEAM.md`; Trainer criteria 5–6 wait for it |

---

## 1. The short version

**Most of the machinery the specs ask for already exists.** Blackthorn already has:

- **Battle engines:** a stat formula checked against Smogon's calc, a damage calculator (`@smogon/calc`), a deterministic 1v1 simulator, and the Ace qualification.
- **Builds and roles:** a role engine with 34 roles and 104 signals, and a reverse-building solver.
- **Breeding:** a multi-generation breeding planner and a lineage checker.
- **PKHeX:** a kernel that turns a PID into nature, gender, shininess and ability, and exports to PKHeX.
- **Field and ranch:** a field-capability engine with evidence tiers and a ranch staffing engine with the Glasshouse.
- **Trainers and research:** a trainer model with sliders, and an intake pipeline that approves before anything lands.

Most of it already runs in the browser, held to Python by parity tests.

**What's missing is the spine those specs all hang from.** Four things are missing or broken:

- **One build per individual.** An individual can have only one build, its id is `me:<game>/<species>`, and builds have no versions.
- **No personal store.** Nothing you make in the app is saved as a real personal record. Lab work lives in one browser, or as blobs in Sheet tabs nothing reads back.
- **Clashing labels.** The same individual has five different id schemes. Evidence has four labelling systems that disagree with each other.
- **Default art only.** Art is the default picture by dex number. The app can read Drive but can't write to it.

**Six of the seven specs depend on that spine.** Build history, archetypes per build version and breeding blueprints all need it. So do shared builds across Survival, Battle and Team, the hybrid profile, the ball assignment and personal artwork. Building any of those features first would make each one invent its own storage, which every spec rules out.

**So the recommended order is:**

| Phase | What |
|---|---|
| 0 | Fix the small inconsistencies every spec reads through. |
| 1 | Build the spine: individuals, versioned builds, a personal write store. |
| 2 | Recognition, mostly computation on engines that exist. |
| 3 | The profile, artwork and inline explanations. |
| 4–7 | Breeding stock, the Trainer Library, balls and equipment, then survival and homestead. |
| 8 | The 6v6 simulator and the deeper optional layers, once their specs and decisions exist. |

Each phase leaves the app working, and nothing that works today is rewritten for convenience.

Section 9 has fourteen questions for you. Only the first four block Phase 0–1.

---

## 2. Problems that cut across every spec

These eight findings show up in more than one audit. They're the reason for the order.

| # | Problem | Where | Specs it blocks |
|---|---|---|---|
| X1 | **One build per individual, no versions.** `individual.build` is one id. Ids are `me:<game>/<species>`, so two Larvitar in one game can't exist. Alternatives exist only as unlinked records. Builds have no version numbers, and approved corrections overwrite `build_library` fields in place. | `engine/store/migrate.py`, `store/out/individuals.json` | Recognition §17, Individual §3 §13, Breeding §2, Survival §13, Trainer §8 versioning |
| X2 | **No personal write path that flows back.** Pokémon lab edits live in memory and are lost when you navigate away. The team lab, field page and battle labs keep state in localStorage (one browser). The Variants and Specimens Sheet tabs hold whole-lab JSON blobs. Nothing reads any of it back into the engine. Hatches typed into the Sheet are overwritten on rebuild (B10), and a rebuild blanks Your Calls answers (B22/B23). | `82_labs.html`, `WebApp.gs apiAppend`, STATE.md | every spec's "edit once, see it everywhere" |
| X3 | **Five id schemes for one individual.** Store `me:heartgold/Tyranitar`, lineage `HG-TYRANITAR` / `S-TYRANITAR`, Sheet hatches `H-LARVITAR-n`, Code.gs `COLS`, Specimens rows. Benchmark opponents are keyed by display-name strings. | lineage.py, Code.gs, benchmarks.py | Breeding §9, Individual §3, Trainer §12 |
| X4 | **Evidence labels drift.** The journal uses 5 kinds. The wilderness engine uses 4 tiers, and `authored` outranks `cartridge`, mixing "Zack approved it" with "how certain it is". The store uses 5 provenance values. Statuses are free text ("confirmed by user, July 2026"), and claims carry HIGH/MEDIUM/LOW. Three specs then each ask for a 5–6 class scheme in different words. Ingested non-canon notes show as **Personal observation** (`export.py journal()`). | journal, `wilderness/engine.py TIER_RANK`, store | Breeding §12, Survival §4, Trainer §3B, Individual §4, Balls §7 |
| X5 | **Four builders, four shapes.** `plInputs` (#/pokemon), `labForm` (#/builds/lab), `slEdit`, `blEdit`. Each edits a different build shape, and hand-offs go through localStorage. | `82_labs`, `80_builds`, `75_scoutlab`, `77_battlelab` | Builder UI §1–2, Individual §5, Survival §13 |
| X6 | **Art is the default picture only.** `art(n)` is PokeAPI official artwork by dex number: no shiny, female or form variants, and no `pokemon_forms` table. `has_gender_differences` sits unused in pokeref. Everything is hotlinked from `raw.githubusercontent.com`, which may be blocked on the work laptop (unverified). The script has the `drive.readonly` scope, so nothing can be uploaded. | `20_core.html`, `appsscript.json` | Individual §7–10, Balls §5–6, Trainer §11 |
| X7 | **Payload budget.** The labs page loads about 5.8 MB of packs, and `roles4.json` alone (3.36 MB) goes through `google.script.run`. The launcher caches 30,000-character chunks; an entry too big to cache is silently unzipped on every call. Every new data set has to fit inside this. | `WebApp.gs`, `app/data/` | all, especially Balls and the capability records |
| X8 | **Where canon lives.** D-025 (LOCKED) says canon lives in the Sheet. In reality canon is JSON in git and the Sheet is built from it (STATE §1.3). The record store's switch was never approved: `migrate.py` says canon stays read-only until you approve it. The write-store decision in §3.5 depends on settling this. | D-025, `migrate.py` | every personal record |

---

## 3. The unified architecture

### 3.1 The five spaces, mapped onto today's menu

The Builder UI spec asks for five spaces. Today's menu has five groups with different boundaries: HEADQUARTERS / BREEDER / LABS / CHAMPION / RECORD. The move is a regrouping of existing routes, not a rewrite of pages.

| Space | What it holds | Existing routes that move there | New |
|---|---|---|---|
| **My World** | your Pokémon, teams, breeding projects, homestead, saved work | Home `#/`, The Estate, The Glasshouse, Breeding & lineage (projects, studbook, trees, fathers) | My Pokémon (collection of individuals), My Teams, inventory |
| **Pokédex & Reference** | what exists in the world | Biological atlas, Research journal, the Smogon builds book (`#/builds`, not the lab) | moves, abilities, items, Poké Balls, mechanics pages |
| **Trainer Library** | the other trainers | Scouting reports, Advance scouting, Team reports | trainer directory and profiles, version comparison |
| **Labs** | tools that answer questions | Battle Lab, Trainer lab (`#/scoutlab`), Field readiness (becomes the Survival Lab), Compare, Breeding lab (`#/lines`) | qualification standards, benchmark collections |
| **Builder & Studio** | tools that create | Pokémon lab (becomes Pokémon Studio), Team lab (Team Construction), the builds lab (`#/builds/lab`, folded into the Studio), PKHeX export | breeding-stock blueprint editor |

**Your calls, The inbox, The record and the Engine room** aren't content. They're how decisions and provenance get made, so they become a small utility strip rather than a sixth space.

The spec's rule becomes the test for every page: *you should always know what you're looking at, where it came from, what you can change, and what happens when you change it.* That's already the spirit of D-058. B9 breaks it today: engine-filled movesets are labelled "canon register".

### 3.2 Three axes on every record

The four specs' evidence vocabularies don't collide once three separate questions are kept apart. Today they're folded into one label, which is why `authored` outranks `cartridge`.

1. **Whose record is it? (ownership)**
   - **Reference:** species, moves, mechanics, balls, canonical trainer versions. Supplied by Blackthorn, read-only.
   - **Mine:** individuals, builds, teams, blueprints, assignments, artwork, inventory.
   - **Trainer:** a Pokémon attached to a trainer version.
   - **Variant:** a draft or saved branch of any of the above, never replacing its original.

   This is the Builder UI spec's table. The store's `yours / canonical / stock / ingested / competitive` already map onto it:
   - canonical → Trainer
   - yours → Mine
   - stock, ingested and competitive → Reference build sets
   - Variant is new.
2. **What kind of claim is it? (evidence class)** One ladder for the whole app:

   | Class | Means | Breeding §12 | Survival §4 | Trainer §3B | Individual §4 | Today |
   |---|---|---|---|---|---|---|
   | `canon` | stated by an identifiable Pokémon source (Pokédex text, an episode) | Canonical fact | Directly established | Confirmed | Reference fact | journal *official*; wilderness *lore* (the text itself) |
   | `mechanic` | established by the game's rules or data | Game-mechanical fact | Mechanically demonstrated | Confirmed | Exact calculation | journal *verified mechanic*; wilderness *cartridge* |
   | `measured` | an engine result under stated assumptions | — | — | — | Evaluated result | team-role reads, benchmark results |
   | `inferred` | reasoned from evidence | Supported biological inference | Strong biological inference | Strongly inferred | Interpretation | wilderness *inference*; regex lore → capability mapping |
   | `standardized` | filled by a declared Blackthorn method | — | — | Standardized | — | `defaults_used`, `assumed`, D-061's 85 EVs |
   | `hypothesis` | plausible, needs investigation | Exploratory hypothesis | Plausible interpretation | — | Interpretation | journal *research hypothesis* (0 entries) |
   | `creative` | Blackthorn world-building, never canon | Creative interpretation | Creative extension | Hypothetical | Creative Chronicle | journal *world-building*; most W-records |
   | `unknown` | not enough information | — | — | Unknown | — | blanks |

   A Pokédex-backed capability carries two classes. The text is `canon`; "so it can do X" is `inferred`.
3. **Who stands behind it? (status)** One of:
   - `proposed`
   - `approved` (with a D-number)
   - `rejected`
   - `superseded`

   This is APP_PRODUCT_SPEC's idea → proposal → working → accepted → locked, with approvals pointing at the ledger. Approval never upgrades the class. W-001…W-015 stay `creative` or `inferred` and become `approved D-033`; they stop outranking the cartridge.

### 3.3 The shared entities

These are the data contracts every module reads. They're shapes, not code. Field lists stay short on purpose; the specs list more, and those fields get added when the phase that needs them arrives.

| Entity | Owner | Key fields | Built from |
|---|---|---|---|
| **Species** | Reference | dex, forms, gender rate, gender-visible flag, egg groups, cycles, base stats by era, capture rate | atlas + pokeref (forms and `has_gender_differences` to add) |
| **Individual** | Mine / Trainer | `me:<game>/<Species>` id, with a token for every one made in the app (DATA_CONTRACT §2), species, form, sex, shiny, nickname, game/save, ball, origin (caught/hatched/traded/PKHeX), parents, **hatch moveset (never overwritten)**, active build, build list, hero art, gallery, status | `individuals.json`, lineage, studbook rows |
| **Build** | any | content (species, level, nature, ability, item, IVs, EVs, 4 moves, generation), `content_key` (exists), id, parent build, version n, status draft/active/retired, ownership, class, note | `builds.json` (948) |
| **Blueprint** | Mine | a Build marked as breeding stock, with an acquisition class per starting move (egg/level/TM/tutor/event), a pathway, and the four-state verdict (§4.5) | `lines.json`, `proposed_lines.json` |
| **Team** | Mine / Trainer | slots → builds, game, notes | `teams.json` |
| **Trainer → Version → Roster** | Reference | version kind cartridge/anime/manga/curated/user-variant, encounter, lens authentic/standardized, roster → builds, tendencies, playbook, competence, sources | `canon/trainers.json` (12 / 21), benchmarks |
| **Benchmark collection** | Reference | id@version, members (opponent builds + where they appear), standardization rules, **weighting rule**, hash | `team_roles.json → pools` |
| **Recognition definition** | Reference | tag / badge (tiers) / archetype (functional, signature) / qualification (collection + thresholds), id@version | `roles.json` signals, `team_roles.json` |
| **Evaluation result** | derived | (build `content_key`, definition@version, collection@version, engine version) → evidence | `roles4.json`, `LABS.reads` memo |
| **Qualification record** | Mine | build version, definition@version, earned/not, date; never deleted when the build changes | new |
| **Capability** | Reference / Mine | id, category, layer A/B/C, scope species/individual/build, class, status, games, moves/abilities, conditions, equipment/training needs, limitations | `wilderness/engine.py`, `world.json` |
| **Scenario / Facility / Assignment** | Reference / Mine | needs as capability lists (exists), conditions, staff (optional, never automatic) | `scenarios.json`, `ranch.json` |
| **Equipment / Inventory** | Reference / Mine | ball and gear records by game; owned quantity per save | pokeref items, `Specimen.BALL_ID` |
| **Artwork** | any | id, kind (reference, exterior, interior concept, portrait, personalised interior, scene), subjects (species/individual/ball/facility), Drive file id, class (official reference vs creative), replaces | new |
| **Explanation** | Reference | concept key (`nature:adamant`, `ev:limits`, `ability:snow-cloak`…), generation, one-line text, deeper text, source | `ABILITY_NOTES` (47), `ITEM_NOTES` (17), move text (2,442) |
| **Chronicle event** | Mine | kind recorded/simulation/creative, links, approved text | new, optional |

Image packets aren't stored. They're assembled from these records when asked for, and kept with the artwork they produced.

### 3.4 Derived results and caching

The Individual spec's "enter once, enrich everywhere" already has its key: the store's `content_key`.

- **Cheap results** (stats, speed tiers, damage badges, legality, field capabilities) are computed live in the page from the build. They aren't stored.
- **Benchmark fights** are cached by `(content_key, definition@version, collection@version, engine version)`.
  - `roles4.json` already precomputes 962 reads in Python.
  - The Pokémon lab already re-fights a build live in the page.
  - So a new personal build is read live, and a stored result is reused when nothing in its key changed.
- **A qualification record** pins the exact build version and definition version. A changed moveset makes a new build version. The old record stays true of the old version, and the new one shows "needs a read" until it's run. That's Recognition scenario F.

### 3.5 Where things live (needs your approval, Q3)

| What | Home | Why |
|---|---|---|
| Reference data, definitions, benchmark collections, canonical trainers | **git JSON + pokeref.sqlite**, packed into the app zip | versioned, testable, and the Python/JS parity tests need it there |
| Your records: individuals, builds, teams, blueprints, assignments, qualification records, inventory, artwork records | **append-only Sheet tabs** written by the app (`My Pokémon`, `Builds`, `Teams`, `Artwork`, `Qualifications`…) | the Sheet is your data's home (D-025); every edit is a new row, so build history comes free; nothing a rebuild sends touches these tabs, so B22/B23 can't wipe them |
| Images | **a Drive folder** the app creates; the Artwork row holds the file id | Drive is the spec's suggested home; files never go in cells |
| Heavy runs (full role reads, breeder pack, a future 6v6 worker) | **your home laptop** runs `rebuild.py`, which first pulls the Sheet's personal tabs into the store | keeps the browser light, and the work laptop needs no installs |

What this needs:

- `apiAppend`'s `WRITABLE` list grows by the new tabs. Today the app creates a tab on first use, so the new tabs never come from `ranch/sheet.py`.
- A Python reader for the Sheet's tabs. None exists today.
- The narrower `drive.file` scope, which only touches files the app made.
- One Apps Script redeploy.
- Uploads get resized in the browser first; the size limit for a `google.script.run` upload needs a quick test.
- Showing images from Drive needs a small spike. Thumbnail links can be unreliable inside the sandboxed frame; the fallback is serving the bytes through the script.

What this doesn't change:

- D-063 still holds: labs never write canon. Your records aren't canon.
- Canonical trainer records stay read-only. Changing Cynthia's roster makes a Variant, or a correction card that lands as a new version.
- The standing rule stays: no Sheet payloads to the existing Sheet.

### 3.6 Heavy compute

Everything everyday stays in the browser. That covers building, stat and damage badges, live 1v1 qualification reads, readiness and the breeding plans.

The 6v6 simulator would be an optional worker on the home laptop, using Showdown's engine (free). That's the Technical Architecture spec's call (§8), and nothing in Phases 0–7 waits on it.

---

## 4. Gap analysis, spec by spec

Each block has the same four parts:

- **Retain:** works today; build on it unchanged.
- **Extend:** exists, needs more.
- **Missing:** nothing yet.
- **Watch:** decisions and bugs that constrain the work.

### 4.1 Tags, badges, archetypes & qualifications

**Retain**

- **Stats and damage.**
  - `trainers/era.py Era.stats` handles Gen II DVs and era base stats; the browser copy is checked by `sanity.py`.
  - `battle/calc_bridge.mjs` runs `@smogon/calc`; `evaluate.py DamageTable` batches and caches.
- **The 1v1 simulator, `Evaluator.matchup`.** It's deterministic, and it does **not** use repeated trials:
  - every hit is the lowest roll and every move lands;
  - a speed tie is replayed flipped, and a changed winner is a draw;
  - 100 turns with no knockout is a draw;
  - the 100-simulation win % was cut (FOUR_LABS §3).
- **Speed.** `Fight.speed` handles boosts, paralysis, Scarf, Swift Swim and Chlorophyll; priority comes from `acts_first` with the Gen IV corrections.
- **Ace.** `team_roles.py ace()`:
  - earned = Elite Four rate ≥ 0.8 **and** Champion rate ≥ 0.7 (`team_roles.json`), with `lost_to` kept;
  - browser port `28_teamroles.html`, held to all 962 builds;
  - hand overrides per D-059, the Joker tier off (D-064).
- **The role engine as tag material.** `trainers/roles.py` has 34 roles, 104 signals (binary and 0–1 levelled) and 40 move categories.
- **Reverse building.** `trainers/solver.py` (`solve`, `reachable`, `archetypes`, `distance`, `_alternatives`), Python only.
- **Comparison.** `#/compare/<species>` and the Pokémon lab's before/after with live re-fights.

**Extend**

- **Tags.** Promote the role engine's signals into a tag registry at build level, marked binary or levelled. Today's `sliders.tags()` is team-level only.
- **Functional archetype.** It's the role engine's primary role wrapped in your name ladder.
  - All 162 words are still ⟨placeholders⟩ (`docs/naming/NAMES_NEEDED.md`).
  - 112 of 962 builds score below 0.60 and get no name. The spec says every valid build gets one, so the ladder needs a fallback rung.
- **Qualifications.** Generalize `ace()` into "a definition over a collection with thresholds".
  - Today the thresholds change only by editing JSON and re-running every fight.
  - The app needs a trial knob (the overrides pattern already exists) and saved, versioned definitions.
- **Benchmark collections.** `pools` become versioned collections with a stated weighting. Today duplicates silently merge per unique set:

  | Collection | Team slots | Unique sets after the merge |
  |---|---|---|
  | Gen 4 Elite Four | 84 | 64 |
  | FireRed's Champion | 42 | 24 |

  Red, Steven, Clair and both Silver fights are loaded but sit in no pool.
- **Nearby archetypes.** Port the solver to the browser, with a parity test (D-056).

**Missing**

- **Absolute thresholds:**
  - stat thresholds (328/350/394/438; HP 364/404/444/504) calibrated against the Gen IV population, as the spec asks;
  - Speed milestones (329…395) with outspeed vs tie;
  - Scarf, boost, paralysis and Trick Room as separate concepts (no Trick Room in fights today).
- **The inverse stat formula.** "Least EVs to reach X" plus breakpoint lists.
- **Damage badges:**
  - guaranteed/possible OHKO and 2HKO, with assumptions stated;
  - survival;
  - the Priority Finisher at 100/50/25% HP.

  The calc already returns `ko` text that nothing reads. `playsheet._stage` already sets foes to partial HP.
- **Recognition structure:** a badge registry and tiers; signature archetypes; qualification records and history; collections beyond the Elite Four and Champions.

**Watch**

- **Ace score.** The code takes a plain mean of the two rates (`team_roles.py:132`). The `_score_note` says each rate is divided by its bar and capped at 1. It changes only the score shown, not who earns Ace (Q1).
- **Field EVs.** `field_evs_each: 85` is in `team_roles.json`, but nothing reads it. The Ace field fights on 0 EVs, as D-064 records (Q2).
- **"Ace" means four things:**
  - the team role;
  - the playsheet's derived ace;
  - the story-ace override;
  - the cartridge's marked ace (E-033).

  The recognition system names them apart.
- **"Badges" collision.** `trainers/config.json` calls its career tags "Badges", which collides with recognition badges. Rename one.
- **Decisions:**
  - D-046 (LOCKED, "no grades") is written about scouting reports (Q5);
  - D-058 (the numbers decide);
  - D-059 (you name everything);
  - D-060 / D-061 / D-062 / D-064 (the role rules).

### 4.2 Trainer ecosystem & benchmark database

**Retain**

- **The trainer model.** `trainers/model.py` (`Trainer`, `Version`, `Build`) holds 12 trainers and 20 versions (6 journey, 7 anime including Ash's all-time, 7 cartridge).
- **Benchmarks.** `battle/benchmarks.py` reads the pret disassemblies with source strings, AI flags, bag items and battle lines. `trainer_policy.py` scores moves the way the cartridge AI does (E-028…E-030).
- **The scouting reports and play sheets.**
- **Research intake.** The pipeline: `ingest/cards.py` claim → approve → apply. Its sources:
  - the Bulbapedia researcher
  - film and replays
  - Smogon usage
  - the agent sheet

  31 cards, 1,040 claims.

**Extend**

- **Version kinds.** Versions get a `kind` field instead of free-text `source`, and rematches become versions (today they're only benchmark names).
- **Lenses.** The authentic and standardized lenses both exist as code paths: `EngineGrid` at match level vs `TeamRoles` at 100. Name them and make them selectable.
- **Evidence classes per field,** using §3.2.
- **Tendencies vs competence.** Three slider systems exist:

  | System | What it is | Where |
  |---|---|---|
  | 4 authored | offense, rigidity, bond, risk | `model.SLIDERS` |
  | 8 measured | measured sliders | `battle/profile.py` |
  | 5 coach | aggression, patience, heal line, risk tolerance, tempo | `evaluate.COACH` |

  The coach set already works the way the spec asks: it weights decisions rather than setting action frequencies. Competence exists only as cartridge AI flags (Q9).

**Missing**

- **Coverage:**
  - broad in-game trainers: raw files on disk hold 738 HGSS, 742 FireRed, 854 Emerald and 542 Crystal parties, not imported; Platinum has only its Elite Four and Champion;
  - manga (0);
  - anime versions of Elite Four and Champions.
- **Pages:** trainer directory and profile pages with artwork, and version comparison.
- **Battle behaviour:**
  - trainer knowledge limits (both sides know everything today);
  - playbooks as data.
- **Intake:** claims that create a version or roster.
- **The 6v6 simulator.**

**Watch**

- **D-043 (LOCKED).** Battle means scouting reports and call sheets, not simulations. A 6v6 simulator needs a new decision (Q8).
- **Corrections overwrite.** Approved corrections overwrite `build_library` fields in place, which breaks "never overwrite canonical". Corrections become new versions.
- **Loose links.** Three Brandon observations are filed under Ash with no version.
- **D-049 (LOCKED).** Intake is approved before it lands.

### 4.3 Individual Pokémon experience & visual identity

**Retain**

- **Individual records.** `individuals.json` carries the PKHeX fields: ball, shiny, gender, friendship, met data, `defaults_used`.
- **The specimen kernel.** `specimen.py` / `26_specimen.html` handles PID → nature, gender, shininess and ability, plus Hidden Power, characteristic and the Gen 2 DV rules.
- **The atlas page** `#/atlas/<n>`.
- **`partyProfile`.** The closest thing to the hybrid profile today: hero art, build, life roles, biology, breeding. HeartGold's six only.
- **The labs.** The Pokémon lab, compare, and the PKHeX export.
- **Design.** The Heritage Solarpunk design system and the frame rule (D-058).

**Extend**

- **Ids and builds.** Every individual gets its own id and many versioned builds (X1).
- **Editable fields.** Its own fields become editable: nickname, gender, shiny, ball, met. `#/pkhex` shows them read-only.
- **One builder.** One builder component serves every context (X5).
- **Profiles.** `partyProfile` grows into the hybrid profile for every individual, with a private view and a showcase view drawn from the same data.

**Missing**

- **Artwork variants.**
  - Sex, shiny and form art isn't wired. PokeAPI's sprite repository has shiny and some female and form variants; which sets exist per species needs checking before promising coverage.
  - Female art where the sexes look the same must not be invented: `has_gender_differences` is the guard.
- **Personal art.** Custom upload, gallery, hero choice and revert to default.
- **Image packets.**
- **Records over time.** Build history and decision notes; the optional Chronicle and Hall of Fame.
- **Sharing.** The app is private (`access MYSELF`), so a showcase link is a decision (Q14).

**Watch**

- **Rules:** D-006 (no edit controls on HeartGold's six), D-031 (PKHeX parity), D-024 (learnability).
- **Delivery:** image hosting on GitHub's raw host, and the payload budget (X7).

### 4.4 The self-explanatory builder and the five spaces

**Retain**

- **What the builds lab already explains:** the 510 counter and 252 cap, the ✓/✕ learnability check, and the nature ▲▼ marks.
- **Text that already exists:** `nature_effect` in the specimen kernel, 47 ability notes and 17 item notes (`battle/scouting.py`), and move effect text (484 in builds, 2,442 in the battle pack).

**Extend**

- **One explanation registry** (§3.3), used by every builder: a line always visible, the deeper text one tap away, generation-aware.
- **The Pokémon lab's EVs.** Its inputs allow 0–255 per stat with no total (`82_labs.html:230`). They get the 252 cap, the 510 total, the remaining count and the "last 2 EVs do nothing at level 100" note.
- **Nature menus** show the effect, not just the name.

**Missing**

- **Ability and item text.** pokeref has no ability or item text tables, and items are names only, so these get imported.
- **The five-space menu** (§3.1).
- **Search on phones.** It's hidden below 820 px.
- **Consistent ownership labels** on every record (§3.2), and fixing B9.

### 4.5 Breeding, inheritance & ecological specialization

**Retain**

- **`BreedingEngine`:**
  - `egg_moves` per game;
  - `feasibility`: No Eggs, Ditto-only, incense babies;
  - `bundle`: one father who knows a whole set;
  - `plan_lineage`: multi-generation, depth 3, over 4 egg moves rejected, Light Ball, learn-after-hatching, timing.
- **Lookups.** `refdb.Ref`: `learn`, `chain`, `fathers`, era-correct abilities.
- **The studbook** and the lineage checks: `lineage.check()` covers sexes, egg groups, hatches-as, inherited moves, no self-ancestry, a stud carrying its line's set.
- **The pages.** `breeder_pack`, `#/lines` (how each move gets in, biology, natural selection, the adult's role read), the hatch form.
- **`proposed_lines.json`** (the Mamoswine line).
- **The numbers.** 246 families, 1,789 egg moves, 1,761 with a lineage, 0 errors.

**Extend**

- **Full four-move starting configurations.** The engine's docstring states these rules, but none are implemented:
  - level-up moves at hatch;
  - level-up moves both parents know;
  - the father's TMs;
  - slot order and push-out.
- **Per-generation rules.** Lineage and studbook are hard-wired to HeartGold. Bugs B26, B28, B29.
- **Query the app.** The app plans one move at a time, HeartGold only. `bundle` and `plan` exist and are never called.
- **Per-move origin.** Each starting move carries its acquisition class.
- **The hatch moveset** is kept, not overwritten.
- **Linked ids.** Studbook ids link to individuals (X3).
- **The four-state verdict** the spec asks for:
  1. mechanically possible;
  2. obtainable by legitimate means in that game;
  3. valid in PKHeX;
  4. documented in your collection.

  Today's `native` and `catchable_in_game` flags are partial pieces.
- **Evolution by a known move.** `pokemon_evolution.known_move_id` has 8 rows and nothing uses them. Piloswine needs Ancient Power to become Mamoswine.

**Missing**

- **Stock and planning:** the blueprint entity and stock library, and the reverse planner in the app (desired build → moves → pathway → parents → offspring).
- **Inheritance odds:** IV, nature (Everstone) and ability inheritance, with odds; effort estimates kept apart from speculative time.
- **Ecology claims:** a claim store per individual and per line using the §3.2 classes.

**Watch**

- **D-024 / D-048 (LOCKED).** Learnability is the gate. The four-state verdict is informational only.
- **D-038 (WORKING, reading to confirm).** Keep only the final stud vs a library of many blueprints (Q10).
- **D-044.** The era rule is WORKING, so per-generation rules need it widened.
- **Inherited TMs fail today.** `lineage.check` flags any inherited non-egg move.
- **B27.** Swinub's Ancient Power is also a tutor move and a Piloswine Lv 1 move, so "egg move" in the Mamoswine line's wording is incomplete.
- **The cross rules exist three times:** Python, Code.gs, and `50_breeding` (untested).
- **The journal mislabels** ingested notes as Personal observation.
- **No field notes yet** for Swinub, Cyndaquil or Larvitar (only their evolved forms).

### 4.6 Poké Balls & equipment

**Retain**

- **Ball ids and availability.**
  - `Specimen.BALL_ID` (24 PKHeX ids) and `BALLS_IN_GAME`.
  - The story-note rule for a ball that didn't exist in that game (D-024).
  - Gen 2 stores no ball (E-017).
- **pokeref items:**
  - all 25 Gen I–IV balls, Park Ball included;
  - the 7 Apricorns;
  - rods, bikes, Coin Case, Town Map, dowsing machine, VS Seeker, Poké Radar;
  - breeding items.
- **Art.** Item sprites through `itemSprite()`.
- **Already-written content.**
  - The Apricorn ↔ ball ↔ Kurt prose in `camp_life.json`.
  - Partner balls in the bond slider.

**Extend**

- **Ball tables.** `BALLS_IN_GAME` lacks Diamond/Pearl, Park and Dream. `item_game_indices` is a weak guide to availability.
- **Apricorns.** The Apricorn prose becomes a structured table.
- **Ball values.** All 36 individuals hold the default Poké Ball. About 26 ball values in the v3 archive were never migrated; some were flagged impossible (Q12).

**Missing**

- **Ball reference records:** catch modifiers per generation, from verified sources, never from the mockups; acquisition; Kurt's craft.
- **Mechanics data.** The capture formula: `capture_rate` and `base_happiness` sit unused. Encounter data for Lure, Net and Dive Ball logic was never fetched.
- **Art.** High-resolution exterior art (item sprites are small, so a source is needed). Interior concept art, through the §3.3 artwork pipeline, labelled creative.
- **Gear and ownership.** An equipment library (PokeAPI has no Running Shoes or Pokégear) and personal inventory.

**Watch**

- **FOUR_LABS.md §1 (the record store) says:** "Where the ball shows [yours]: on the team screen only. It's not part of battle or breeding records." The spec puts it on the individual's profile, which isn't a battle or breeding record either (Q11).
- **Luxury Ball.** It isn't an Apricorn ball, and its effect must be stated exactly. The spec says so itself.
- **Delivery.** Ball data and art references must fit the payload budget (X7).

### 4.7 Survival, homestead & world capability

**Retain**

- **The wilderness engine:**
  - 27 capabilities in 7 groups;
  - field moves per game, 15 field abilities and 16 lore patterns;
  - `Evidence` with tiers;
  - `team_report`, which has **no overall score**, already matching "no single opaque score".
- **Situations, records and camp life:**
  - 7 situations;
  - world records W-001…W-017, with the decision gate;
  - camp life;
  - `Workbench.preview_world`, a what-if that saves nothing.
- **The field page.** `85_field.html` with parity on 55 teams.
- **Ranch engines and plans:**
  - `ranch/habitat.py`, `planner.py` (staffing on game-backed or authored evidence only, D-039) and `hatchery.py`;
  - `ranch.json`: 9 facilities, the Glasshouse's 6 rooms with their `needs`, and the Cold vault;
  - the estate, Glasshouse and home pages with their logging forms.

**Extend**

- **The capability record.** Today it's `Evidence(capability, tier, source, detail)` per game and species. It needs:
  - the §3.3 fields;
  - species-level records across games (Typhlosion's heat is HeartGold-only today);
  - layer C (equipment or training), which doesn't exist.
- **Cartridge readiness vs world readiness as two separate reports.**
  - Today `team_report` collapses each capability to its best tier.
  - The field matrix counts "can learn by any route", not "knows it".
  - Readiness reads species only, ignoring the member's actual moves, ability and item.
- **HM readiness:**
  - HM vs TM vs utility flags (Flash is a TM in Gen 4);
  - badge requirements;
  - a recommender for candidates outside the team;
  - moveset slot cost (Surf and Fly do double duty);
  - D-018 rule 3's "temporary move" label.
- **Scenarios** get conditions, terrain, climate, duration, hazards, food and water.
  - Four of the spec's eight have a near match today.
  - Forest, wetland, overland and hazardous research don't.
- **The spec's six readiness areas** map onto the 7 groups. Two gaps: Ecological Awareness has nothing, and Food & Water has no water capability.
- **Missing capabilities:** manipulation, electricity as a utility, heat tolerance, tracking, water finding, navigation and construction.

**Missing**

- **Equipment and resources:** the equipment and trained layer; resources as data (water, materials, Apricorn yields).
- **Progression and optimising:** badges and progression gating; lock-and-optimise ("keep five, find the sixth"); Recommended / Potential Fits / Everything Else for survival.
- **Facilities:** the Research Institute, the Workshop and Dragon's Den operations; an assignment model.
- **Field capabilities on profiles.**
- **The optional expedition simulation,** last.

**Watch**

- **Field and capability decisions:**
  - D-018 (the field rules, WORKING CANON);
  - D-026–D-030 (per-game exceptions);
  - D-033 (the 15 records);
  - D-039 (staff only on game-backed or approved evidence; lore stays a story candidate).
- **Ranch decisions:**
  - D-037 (fates open);
  - D-042 (every companion is retired; Q13);
  - D-045 (the Glasshouse);
  - D-034 (camp life is low priority).
- **D-011 (fenced).** Scizor as an equipment carrier. The spec's Scizor examples are tests, not a decision.
- **Engine gaps:**
  - D-028's Feraligatr Waterfall lives only in `specimen.py EXCEPTIONS`, so the wilderness engine still reports no Waterfall;
  - the engine checks one game's learnset, which contradicts D-048;
  - B6, B7, B39;
  - `DEFAULT_SCENARIOS` duplicates `scenarios.json`.
- **255 steps per cycle.** It's "believed, verify" (E-024).

---

## 5. Conflicts register

Places where a spec and an existing decision or the code disagree. Nothing here is resolved without you; the
proposal column is a recommendation.

| # | Spec says | Existing | Proposal | Q |
|---|---|---|---|---|
| C1 | a 6v6 simulator with ~100-battle batches (Recognition §15, Trainer §7) | D-043 LOCKED: battle = scouting reports, not simulations; 100-sim win % cut | a new decision narrowing D-043: reports stay the product, a 6v6 run becomes one more evidence source, later | Q8 |
| C2 | tiered badges, Bronze/Silver/Gold-style | D-046 LOCKED: scouting reports carry no grades | D-046 governs reports; badges recognise builds; reports stay grade-free | Q5 |
| C3 | generation-specific legality of whole combinations | D-024 / D-048 LOCKED: a move counts if the species can learn it | four-state verdict, informational; D-024 stays the gate | — |
| C4 | many complete four-move blueprints per species | D-038 WORKING: keep only the final stud | blueprints are designs and cost nothing to keep; D-038 still decides which animals live at the ranch | Q10 |
| C5 | per-generation breeding rules | D-044 era rule WORKING (Gen 4) | the engine goes per generation; Gen 4 stays the family tree's default | — |
| C6 | edits in any workspace update one shared record | D-025 LOCKED (Sheet is canon's home) vs canon in git; store switch never approved | §3.5 split; amend D-025's wording | Q3 |
| C7 | canonical trainer records never overwritten | approved corrections overwrite `build_library` fields in place | corrections land as new versions | — |
| C8 | ball on the individual profile | FOUR_LABS: ball on the team screen only, not battle or breeding records | also show it on the profile; still not a battle or breeding record | Q11 |
| C9 | layer B biology can satisfy facility needs | D-039 LOCKED: staff only on game-backed or approved evidence | layer B shows candidates; staffing still needs approval | — |
| C10 | assignments without removing a Pokémon from its team | D-042 all retired, D-037 fates open | assignments are plans, never facts | Q13 |
| C11 | evidence classes kept separate | wilderness `authored` outranks `cartridge` | the three axes (§3.2) | — |
| C12 | explainable, reproducible qualifications | Ace score shown ≠ its own note; `field_evs_each` unread | fix in Phase 0 | Q1, Q2 |
| C13 | explicit benchmark weighting | silent merge per unique set; D-062 "every rematch counts" | weighting becomes a stated collection rule | Q6 |
| C14 | creative interior and portrait art | D-058: what isn't a mechanic is never generated | D-058 is about verdicts and readings; art labelled `creative` and never used as evidence fits it | — |

---

## 6. Implementation sequence

Rules for every phase:

- **One spec's slice at a time.** A phase ships behind the existing routes.
- **Nothing that works is rewritten.**
- **Every browser engine gets a Python parity test** (D-056).
- **Every phase ends with** `rebuild.py`'s before/after diff, tests green, a commit, and a new zip for you to upload.
- **No phase writes canon or touches the existing Sheet's built tabs.**

Size: **S** is about a session, **M** a few, **L** several.

### Phase 0 — clear the ground (S)

No new features. Fix what every later phase would read through:

| Fix | Notes |
|---|---|
| Ace score vs its note | Q1 |
| `field_evs_each` | Q2 |
| The Pokémon lab's EV limits | to the 252 cap, the 510 total and the remaining count |
| B9's "canon register" label | |
| The journal's observation mislabel | |
| D-028 Waterfall in the wilderness engine | |
| The wilderness engine's per-game learnability vs D-048 | |
| B39 | |
| The duplicate `DEFAULT_SCENARIOS` | |
| `hq.json`'s decisions | they stop at D-058 |
| Rename the career "Badges" | |

Then write the contract docs: the §3.2 vocabulary and the id scheme.

**Exit:** tests green, rebuild diff reviewed.

### Phase 1 — the spine (L)

Unlocks everything else.

- **Entities.**
  - Schemas for individual, build (parent, version, status), blueprint and team slot.
  - The existing `me:` ids stay; individuals made in the app get a token, so two of a species in one game work. (Changed from the first draft's new `ind:` ids: no alias layer, nothing to migrate.)
  - Studbook and lineage ids linked (moved to Phase 4, where breeding needs it).
- **The §3.5 personal store:**
  - append-only Sheet tabs;
  - the browser joins them live;
  - `rebuild.py` pulls them before heavy runs.
- **One builder component** for the Pokémon lab and the builds lab. The Scouting and Battle Lab editors read the same build shape through adapters, so they aren't rewritten.
- **Drafts persist.**

**Needs from you:** Q3 and Q4, then one Apps Script redeploy.

**Exit:** a build made in the Pokémon lab opens unchanged in the team lab and the Field page, with no duplicate created. A second version keeps the first. That's Recognition G, Survival Test B and Individual §3.

### Phase 2 — recognition v1 (M–L)

Mostly computation on engines that exist.

- **Definitions as versioned JSON:**
  - tags from the role signals;
  - the functional archetype with a fallback rung;
  - qualifications generalizing Ace.
- **Collections:** versioned benchmark collections with a stated weighting.
- **Thresholds:**
  - stat thresholds calibrated against the Gen IV population;
  - Speed milestones with outspeed vs tie;
  - the inverse stat formula.
- **Damage badges** from the existing calc.
- **Records:**
  - evaluation results cached by key;
  - qualification records with history;
  - "needs a read" when a build changes.
- **Reverse building.** The solver ported to the browser for nearby archetypes.
- **Signature archetypes:** the framework only. Their names are yours (D-059).

**Exit:** Recognition scenarios A–F. Badge tier names wait on Q5.

### Phase 3 — profile, art and explanations (M–L)

- **Profiles.** The hybrid profile for every individual, with private and showcase views.
- **Explanations.** The explanation registry, with the ability and item text imported, used inline in the builder.
- **Artwork:**
  - default art chosen by sex, shiny and form where a verified reference exists;
  - upload to the app's Drive folder (`drive.file`);
  - gallery, hero portrait, revert;
  - artwork records;
  - the image packet as one tap that copies a complete brief.
- **The five-space menu.** A regroup of existing routes.

**Exit:** the Individual spec's "Essential" list.

### Phase 4 — breeding stock (M)

- **The library.** Blueprints on the spine, and the stock library ("all my Larvitar configurations").
- **Validation:** full starting-move validation, per-generation rules, the four-state verdict.
- **Planning.** The reverse planner in the app, by wiring `bundle` and `plan`.
- **History.** The hatch moveset preserved.
- **Evolution by a known move.**

**Exit:** the spec's four example questions answer from the app. The Mamoswine line reads correctly, B27 included.

### Phase 5 — the Trainer Library (M; data-heavy)

It can run alongside Phase 4.

- **Versions.** Version kinds and the two lenses; rematches as versions; corrections as versions.
- **Pages.** Directory, profiles and version comparison.
- **Data.** Import more cartridge parties from the raw files already on disk.
- **Sliders.** Consolidate the three slider systems (Q9).
- **Intake.** Intake that can create versions and rosters.

**Exit:** Trainer success criteria 1–4 and 7–10. Items 5 and 6 need 6v6.

### Phase 6 — balls and equipment (M)

- **Ball records** with verified per-generation mechanics.
- **Pages.** The Poké Ball Collection and ball profile pages (exterior art first).
- **The individual's link:** assignment on the profile, and the personalised interior via Phase 3's pipeline.
- **The rest of the gear:** the Apricorn table, the general equipment library and personal inventory.

**Exit:** Ball spec acceptance 1–10.

### Phase 7 — capability framework, survival and homestead (L)

- **Capability records.** Capability record v2, migrating the 27 capabilities and the W-records onto the three axes.
- **Readiness:**
  - cartridge readiness and world readiness as two reports;
  - build-aware readiness;
  - HM readiness with slot cost.
- **Planning tools:**
  - scenarios v2;
  - lock-and-optimise;
  - Recommended / Potential Fits / Everything Else.
- **Facilities.** The facility requirement model and optional assignments (Q13).

**Exit:** Survival Tests A–H.

### Phase 8 — optional and deeper (when the specs and decisions exist)

- **The 6v6 simulator:** built separately (D-069, Q8 answered); it plugs in through `docs/design/SIXVSIX_SEAM.md`.
- **Ecology.** The ecological synthesis layer, after the Biology spec.
- **Records and legacy.** The Chronicle, Hall of Fame and leaderboards.
- **The expedition simulation.**

### Why this order

**The spine first.** It's the shared dependency.

**Recognition next.** Of what you asked for, it's the most valued in the specs, and it's mostly reuse: the calc, the simulator, the role engine and the solver already exist.

**Then the order of reuse:**
- **Art before balls,** because the ball interiors reuse the artwork pipeline.
- **Breeding before survival,** because breeding's ecology claims become capabilities.
- **The Trainer Library in parallel,** because it's mostly data.
- **Survival and Homestead last among the core,** because they wait on capability records, equipment and the Biology spec. D-034 also rates camp life low.

If you'd rather use something sooner, the order can move. Only Phase 1 is truly fixed in place.

---

## 7. Acceptance tests mapped to phases

| Spec | Test | Phase |
|---|---|---|
| Recognition | A Speed · B Scizor items · C Ace pursuit · D hybrid · E signature · F revision · G consistency | 2 (A–F), 1 (G) |
| Balls | 1–10 | 6 (art pipeline from 3) |
| Survival | A capability consistency · C expedition · D Glasshouse · E canon separation · F comparison · G reference reuse · H access | 7 |
| Survival | B shared builds | 1 |
| Trainer | 1–4, 7–10 | 5 (8 with 2) |
| Trainer | 5–6 | 8 |
| Individual | Essential | 1 + 3 |
| Individual | High priority | 2–3 |
| Individual | Supporting / optional | 8 |
| Builder UI | contextual explanations · five spaces · continuity | 0 + 3 · 3 · 1 |
| Breeding | core requirements 1–7 | 4 (7 via 0) |
| Breeding | deeper layers | 8 |

---

## 8. Specifications still to come

The specs refer to these. Where the plan needed their decision, it says so and treats its own assumption as
provisional.

| Spec | What it would decide | Provisional assumption here |
|---|---|---|
| Team Construction | team fit, role analysis, lock-and-optimise rules for battle teams | the team lab's existing questions and shapes carry on |
| Battle Simulation | the 6v6 engine, trainer AI, normalization policy (Trainer §9 defers to it) | 1v1 stays the measuring stick; lenses use today's two code paths |
| Pokémon Biology | the species biology reference Survival §5 and Breeding §7 consume | the atlas, 680 field notes and the journal, classed per §3.2 |
| Reference Database | provenance, versioning, standardization | §3.2 and §3.3 |
| Technical Architecture | storage, the optional simulation worker | §3.5 and §3.6 |
| Compound design | the homestead's layout beyond ranch.json | ranch.json and the Glasshouse (D-045) stand as they are |

---

## 9. Questions for you

Grouped by the phase that needs them. **Only Q1–Q4 block starting.**

**Before Phase 0–1**

1. **Ace's score.** The Ace score shown is a plain average of the two win rates; its note says each rate is divided by its bar. It changes the number shown, not who earns Ace. Which do you want?
2. **The Elite Four's EVs.** `team_roles.json` says the field gets 85 EVs, but the Elite Four and Champions actually fight on 0 (as D-064 records).
   - **Wire it up:** fewer builds earn Ace.
   - **Delete the setting:** keep 0.
3. **Storage.** Your records go in new append-only tabs on the Sheet. Reference data stays in git. Images go in a Drive folder the app makes. This means approving the record-store switch, rewording D-025, and one Apps Script redeploy with the narrower `drive.file` access. Okay?
4. **Duplicates.** Can you own two of the same species in one game, e.g. several Larvitar? The spec implies yes; today's ids can't.

**Before Phase 2**

5. **Badge tiers.** D-046's "no grades" was about scouting reports. Okay for builds to carry tiered badges, with tier names yours to pick?
6. **Weighting.** Benchmark weighting: per unique set (today, silently), per team slot (closest to "every rematch counts"), or per species?
7. **Draws.** A fight where a speed tie decides the winner counts as a draw today, and a draw isn't a win for Ace. Keep that?

**Before Phase 5**

8. **6v6.** D-043 locks battle as scouting reports, not simulations. Narrow it now so 6v6 can be planned as one more evidence source, or wait for the Battle Simulation spec? **Answered (D-069):** built separately, comes in later; it plugs in as one more evidence source.
9. **Sliders.** There are three slider systems. Proposal: the coach settings become the trainer's tendencies, the measured sliders become evidence about them, and your authored four stay your reading. Okay?

**Before Phase 4**

10. **Blueprints.** Confirm that blueprints are designs you can keep any number of, while D-038 still decides which animals actually live at the ranch.

**Before Phase 6**

11. **Ball placement.** FOUR_LABS says an individual's ball shows on the team screen only. Okay to show it on its profile too? **Taken as a default (A-37):** it shows on the profile with its exterior and interior; say if it should stay team-only.
12. **Legacy balls.** About 26 ball values from the v3 archive were never carried over, some flagged impossible. Bring them in for your review, or start every individual on a fresh choice? **Still yours.** Not brought in. Every individual starts on the ball it has now, and the Studio checks any ball you pick against how the species is met (A-33). The v3 values and their flags are in `legacy/v3_AUDIT_FINDINGS.md` §4.1.

**Before Phase 7**

13. **Assignments.** With every companion retired (D-042) and fates open (D-037), should facility assignments always be plans rather than facts?

**Any time**

14. **Sharing.** The app is private to you. A shareable showcase would need either a public read-only page or exported pages. In scope now, or later?
