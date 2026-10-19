# App Product Spec: proposed redesign (v0.2, 2026-10-19)

**Status:** PROPOSAL, except §6 (storage, D-025) and §7 (PKHeX standard, D-024), which are decided. Remaining open choices are flagged with ❓.

## 1. Core purpose

A private atelier for a lifelong Pokémon journey. **Zack talks and chooses; research enriches; the system remembers.** It has to do three jobs the spreadsheet never could:

1. **Protect authorship**: canon can't be overwritten by a data refresh, an old spreadsheet row, or an AI suggestion.
2. **Make facts trustworthy**: every mechanical claim carries a source, a version group and a verdict (legal / illegal / unverified).
3. **Keep the thinking alive**: comparisons, rejected ideas and *why* stay findable forever.

## 2. Three layers that must never blur

| Layer | Contains | Who writes | Changes how |
|---|---|---|---|
| **Reference** | species, moves, learnsets, egg groups, encounters, era rules | build script from pinned datasets | regenerated; never hand-edited |
| **Canon** | chapters, companions, memberships, builds, move decisions, characters, field functions, decision ledger | Claude, *only* after Zack approves | append-only decisions; current state derived |
| **Workbench** | proposals, critiques, comparisons, breeding drafts, research notes | any AI role, freely | proposals graduate to canon only via a Zack decision |

Legacy spreadsheet data is a fourth, **read-only** layer: imported raw with file ID / tab / row provenance, reconciled by reference, never edited.

## 3. Collaborator roles → the records they may create

| Role | May write | Must never write |
|---|---|---|
| Scientist | `Evidence` (sourced fact + version group + date) | canon |
| Breeder | `BreedingPlan` drafts (engine-verified chains) | canon builds |
| Strategist | `Analysis`, `BuildProposal` | locks |
| Worldbuilder | `CompanionProposal` (temperament, life role, relationships) as *authoring candidates* | biographies marked canon |
| Critic | `Critique` attached to any proposal or decision | — |
| Archivist | `LegacyRow`, `Reconciliation` | legacy originals |
| **Zack** | `Decision` (accept / reject / lock / reopen / defer) | — |

Status lattice: `idea → proposal → working → accepted → locked`, plus `rejected`, `deferred`, `superseded`, `archived`. **Only a `Decision` authored by Zack moves anything to `accepted` or `locked`.** A locked entity refuses changes unless a `reopen` decision exists. Automated tests enforce this.

## 4. Data model (refines handoff §22)

```
Chapter ─< Membership >─ Companion ─< Build ─< MoveDecision
   │            │            │          │
   │            │            │          └─ legality → EngineRun / Evidence
   │            │            ├─ BreedingPlan ─< BreedingStep
   │            │            ├─ Instance (PKHeX materialization: .pk file; legality report optional)
   │            │            └─ same_individual_as? (explicit, decided — never inferred from species)
   │            └─ life_role, battle_role, slot_order, status
   ├─ FieldFunction (function → cartridge move? → companion → permanent|temporary|world-only)
   └─ thesis, anchor lines, metaphor, status
Character (protagonist, rival, Danny, …) ─< RivalMilestone (chapter, species, meaning)
Decision (immutable: id, date, subject, before→after, author, rationale, quote, supersedes, evidence[])
Proposal (author role, target, payload, status, decided_by → Decision)
LegacyRow (file_id, tab, row, raw cells, imported_at) ─ Reconciliation (matches | historical | misaligned | invalid)
```

**Era-specific build schemas**: Gen 2 builds have `dvs`, `stat_exp` and no nature or ability. Gen 3–4 builds have `nature`, `ability`, `ivs`, `evs`, plus `encounter_type` (because PID/IV coupling depends on it). The v3 sheet used one flat schema for all eras; that's the source of several defects.

**Build validity (D-024):** valid = every move is learnable by the species. Origin, encounter and PKHeX legality are optional story notes (`performed-in-game` / `PKHeX-made` / `narrative-only`).

## 5. Screens (v1 → later)

1. **Journey**: six chapter cards in story order with each thesis line, lock state and current six. Rival milestones run alongside.
2. **Team**: six members, each showing life role, battle role, moves with status badges (`confirmed` / `working` / `historical` / `verify`) and a field-function strip. HeartGold shows a 🔒 and has no edit affordances. Build history appears side by side: Dec 2025 sheet vs July master prompt vs July 2026 preference.
3. **Decision Lab** (SoulSilver first): pair/trio cards, each covering how the two cover each other's weaknesses, field coverage, lore/world function, breeding knowledge, emotional role, and what the other four must then supply. Rejected options keep their reasons. Nothing becomes canon from this screen without an explicit decision.
4. **Breeder Lab**: target + game + moves → verdict, every route, shortest chains, timing traps (e.g., Ice Shard before Lv 33), whether it's doable in one save, and a **"Copy PKHeX set"** button.
5. **Field Matrix**: per chapter, cartridge HMs vs world function vs who handles it. Gaps and single points of failure highlighted.
6. **Companion**: the individual, not the species — lineage, learned moves, temperament (authoring candidates marked as such), relationships, PKHeX instance.
7. **History & Sources**: decision ledger search ("why did we drop Gyarados?") and the legacy archive with reconciliation flags.

## 6. Architecture: Google Drive + Sheets (decided, D-025)

**Correction to v0.1:** v0.1 recommended a GitHub repo because Claude's Drive connector can't edit an existing file's contents. A **Google Sheets connector** is now available that reads *and writes* cells directly (`get_values`, `update_values`, `append_values`, `batchUpdate`). That removes the constraint, and Drive becomes the natural home.

| Piece | Where it lives | Who writes it |
|---|---|---|
| **Canon DB**: chapters, companions, memberships, builds, move decisions, field functions, characters, decisions, evidence | one new Google Sheet, `Pokémon Master Project — Canon DB`, one tab per entity, stable IDs in column A | Claude via the Sheets connector, **only after Zack approves**; Zack can also edit by hand |
| **Decision ledger** | an append-only tab in the Canon DB | Claude appends; never edits past rows |
| **Docs** (charter, field functions, audits) | Google Docs in the project folder | new version = new Doc; the old one moves to `History/` |
| **Reference data** | not stored by hand. Built on demand from the pinned public datasets by `engine/refdb.py`; a small lookup slice can go into a `Reference` tab if dropdowns need it | build script |
| **Engine code** | `Engine/` folder in Drive (plain files) | Claude |
| **Legacy files** | where they are now, untouched | nobody |
| **App** | a private claude.ai page built from the Canon DB and republished when canon changes | Claude |

Sizing: the personal canon is hundreds of rows (six chapters × six companions × builds × decisions), so Sheets is comfortable. The heavy learnset data (194k rows for Gen 1–4) stays *out* of Sheets; that's the v3 performance trap, not repeated.

Protection without git: (1) Drive keeps version history on the Sheet; (2) the decision tab is append-only by convention, and every canon change cites a decision ID; (3) a `Locks` tab lists locked entities (HeartGold's six), and Claude refuses to write to them without a `reopen` decision; (4) periodic dated exports go to `History/`.

## 7. PKHeX: the materializer, not the judge (D-024)

Zack's standard: **if the species can learn the move, it's valid. PKHeX legality doesn't gate anything.** What that means in practice:
- **The engine's gate is learnability** (species × move × game, any method). Everything else it knows (egg-only moves on a starter, the encounter or ball, version exclusives, breeding chains) becomes *story material*, shown as notes and never as errors. Example: HeartGold's Typhlosion can be Elm's starter and know Extrasensory. The engine can still note that on a real cartridge it would be a bred Cyndaquil, if Zack ever wants that as a story.
- **PKHeX makes the world real.** Each Build exports as a Showdown set; PKHeX imports it (*Import Showdown set from clipboard*) and Zack saves it into the game. PKHeX may mark a Pokémon as not legal. That's expected, and it doesn't matter for this project.
- **Breeding keeps its meaning** as lineage, identity and story. Whether a chain was performed in-game or just narrated is optional metadata, not a requirement.
- **Open edge (Q5):** "can be learned" in *that game* vs by the species in *any* game. Only one case in the project depends on it today (Crystal Feraligatr + Waterfall).
- **Bonus still applies:** the same Showdown export lets chapter teams (and the rival) be battle-tested against each other in gen-specific formats.

## 8. Roadmap (each phase ends usable)

| Phase | Delivers | Acceptance |
|---|---|---|
| **0 (done today)** | audit; reference engine prototype; canon regression checks; docs | checks reproducible from pinned data |
| **1. Foundation** | Drive project folder; Canon DB Sheet for all six chapters (HeartGold locked, SoulSilver provisional); decision ledger seeded with IDs; raw legacy import with provenance; handoff §27's 17 acceptance tests as automated tests | the 17 acceptance tests pass against the Canon DB; a reference refresh can't alter canon |
| **2. Vertical slice** | Journey + HeartGold read-only team (conflicting build history side by side) + SoulSilver Decision Lab + Gen 4 Breeder Lab query + "Copy PKHeX set"; published as a private Artifact | opens on phone; HeartGold uneditable; every SoulSilver surface says *provisional*; Breeder Lab reproduces today's 10 known results |
| **3. PKHeX loop & eras** | Instance records; Gen 3 and Gen 2 schemas; pret ROM data as tie-breaker; Showdown team export for battle tests | a real HeartGold member round-trips: Build → Showdown set → PKHeX → in the save → Instance recorded |
| **4. World & companions** | Field Matrix authoring; companion profiles; relationships; rival timeline; Danny record; proposal queue from conversations | "why was X rejected?" answerable for every past change |
| **5. Polish & automation** | sprites; scheduled data refresh with diff report; dated Drive exports | refresh → diff report → no canon changes |
