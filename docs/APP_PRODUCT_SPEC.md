# App Product Spec: proposed redesign (v0.1, 2026-10-19)

**Status:** PROPOSAL. Nothing here is user-approved; decisions needed are flagged with ❓.

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
   │            │            ├─ Instance (PKHeX materialization: .pk file, legality report)
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

**Build provenance tiers** (❓ Zack decides which are allowed — see §7):
`performed-in-game` · `materialized-legal` (PKHeX-made, passes legality, with a documented plausible origin) · `beyond-cartridge` (illegal on purpose, always labeled).

## 5. Screens (v1 → later)

1. **Journey**: six chapter cards in story order with each thesis line, lock state and current six. Rival milestones run alongside.
2. **Team**: six members, each showing life role, battle role, moves with status badges (`confirmed` / `working` / `historical` / `verify`) and a field-function strip. HeartGold shows a 🔒 and has no edit affordances. Build history appears side by side: Dec 2025 sheet vs July master prompt vs July 2026 preference.
3. **Decision Lab** (SoulSilver first): pair/trio cards, each covering how the two cover each other's weaknesses, field coverage, lore/world function, breeding knowledge, emotional role, and what the other four must then supply. Rejected options keep their reasons. Nothing becomes canon from this screen without an explicit decision.
4. **Breeder Lab**: target + game + moves → verdict, every route, shortest chains, timing traps (e.g., Ice Shard before Lv 33), whether it's doable in one save, and a **"Copy PKHeX set"** button.
5. **Field Matrix**: per chapter, cartridge HMs vs world function vs who handles it. Gaps and single points of failure highlighted.
6. **Companion**: the individual, not the species — lineage, learned moves, temperament (authoring candidates marked as such), relationships, PKHeX instance.
7. **History & Sources**: decision ledger search ("why did we drop Gyarados?") and the legacy archive with reconciliation flags.

## 6. Architecture options (❓ Zack chooses)

Constraints measured today:
- Claude's Drive connector can **create** files but **cannot edit an existing file's contents** (metadata only). A Google Sheet therefore can't be the live store Claude writes into.
- Gen I–IV learnsets are ~194k rows. As static JSON that's trivial in a browser; under Sheets formulas it's slow.
- This container is ephemeral. Work persists only if pushed to GitHub, published as an Artifact, or saved to Drive.

| | **A. Repo + static app (recommended)** | B. All-Google (Sheets + Apps Script) | C. Artifact-native |
|---|---|---|---|
| Canon store | YAML/JSON files in a private GitHub repo; every change is a commit linked to a Decision | New canon Google Sheet | the app's own built-in database |
| Who edits | Claude Code (precise, diffable, tested) | Zack in Sheets; Claude only via a deployed Apps Script endpoint | Claude via the artifact data tool; Zack in-page |
| History | git: complete, free | Drive version history (coarse) | must be designed (append-only rows) |
| Reference data | built JSON, bundled | heavy tabs again | built JSON, bundled |
| App | static page published as a **private claude.ai Artifact** (phone-friendly, no hosting) | Apps Script web app | same as A |
| Drive's role | archive (legacy untouched) + dated read-only exports for browsing and for chat sessions | everything | archive + exports |
| Risks | needs a GitHub account (free private repo) | Apps Script quotas, clasp/OAuth setup, slower UI, the v3 performance problem returns | newer platform; export discipline needed |

**Recommendation: A**, with C's in-page database as a later add-on if one-tap approvals from the phone become worth it. The reasons are practical: precise edits, real history, automated tests guarding HeartGold, and no servers or subscriptions. B is viable only if staying in Sheets matters more than reliability. That's a fair preference, but it should be chosen knowingly.

## 7. PKHeX: what it changes

PKHeX turns "can this exist?" from a grinding problem into a **choice about provenance**. That changes the app in four ways:

1. **Legality has a final authority.** The engine here answers design questions ("can these four moves coexist, by what chain, in one save?"). PKHeX's legality checker answers "is this exact specimen legal?" (PID/IV method, met location, ball, egg data, gift-encounter moves). Don't rebuild PKHeX. Hand off to it.
2. **Interchange via Showdown sets.** Every Build exports Showdown text → PKHeX *Import Showdown set from clipboard* → set met data / ball / OT → run the Legality check → paste the report back into the app as `Evidence` → save the `.pk` file to Drive, linked to an `Instance`. (If the PKHeX-Plugins **Auto-Legality Mod** is installed, it can generate the legal PID/IVs from a Showdown set automatically. Worth confirming what's installed.)
3. **"Legal" ≠ "earned in this save."** PKHeX will happily approve a hatched Bulbasaur in a FireRed save that never had a parent to breed one. The app tracks both `pkhex_legal` and `save_plausible`, which is exactly the handoff's starter warning, made enforceable.
4. **Battle testing becomes possible.** The same Showdown export lets chapter teams (and the rival's) be played against each other in gen-specific custom formats. That's a way to *test* "Every turn you survive is a mistake" rather than only describe it.

**The philosophical fork (❓ Zack's decision):** the project's soul is *earned* mastery, and PKHeX makes everything free. Options:
- **Legal-by-construction (recommended default):** PKHeX materializes a story that could have happened. Every companion passes legality *and* has a documented, save-plausible origin, so the breeding lineage still exists as story and plan; PKHeX just skips the 200 eggs. Each plan records whether it was `performed-in-game` or `materialized`.
- **Legal-only:** pass PKHeX legality and nothing more is required.
- **Canon-over-cartridge:** illegal-but-meaningful builds allowed, always labeled `beyond-cartridge`, never silent.
- A hybrid is natural: legal-by-construction by default, with a few rituals actually performed in-game because they *mean* something (e.g., breeding HeartGold's Extrasensory Cyndaquil yourself).

## 8. Roadmap (each phase ends usable)

| Phase | Delivers | Acceptance |
|---|---|---|
| **0 (done today)** | audit; reference engine prototype; canon regression checks; docs | checks reproducible from pinned data |
| **1. Foundation** | repo; canon YAML for all six chapters (HeartGold locked, SoulSilver provisional); decision ledger seeded with IDs; raw legacy import with provenance; handoff §27's 17 acceptance tests as automated tests | `make test` green; a reference refresh can't alter canon (test proves it) |
| **2. Vertical slice** | Journey + HeartGold read-only team (conflicting build history side by side) + SoulSilver Decision Lab + Gen 4 Breeder Lab query + "Copy PKHeX set"; published as a private Artifact | opens on phone; HeartGold uneditable; every SoulSilver surface says *provisional*; Breeder Lab reproduces today's 10 known results |
| **3. PKHeX loop & eras** | Instance records; PKHeX report ingestion; Gen 3 and Gen 2 schemas; pret ROM data as tie-breaker; Showdown team export for battle tests | a real HeartGold member round-trips: set → PKHeX → legal → recorded |
| **4. World & companions** | Field Matrix authoring; companion profiles; relationships; rival timeline; Danny record; proposal queue from conversations | "why was X rejected?" answerable for every past change |
| **5. Polish & automation** | sprites; scheduled data refresh with diff report; dated Drive exports | refresh → diff report → no canon changes |
