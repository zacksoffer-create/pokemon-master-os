# Legacy Data Audit: Google Drive spreadsheets and Apps Script (2026-10-19)

**Access:** read-only. No Drive file was created, modified, copied, moved, shared or trashed.
**What was actually tested** is listed in §6. Read that section before trusting any claim here.

## 1. Inventory

| Asset | ID | Dates | Role |
|---|---|---|---|
| **Pokemon Master Spreadsheet v3** | `1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek` | created 2025-12-17 · modified **2026-01-08** | latest workbook; 23 tabs |
| "Untitled spreadsheet" (single tab "Canon Builds") | `1jMx5cz-xvKDYoDYrONYn-e6_NAqr5GIz-4DHkXZCwvA` | 2026-01-07 | **not in the handoff.** The only complete 54-row view of Canon Builds (rows 2–7 match v3 cell for cell) |
| **Apps Script project "Untitled project"** | `1ZnAgBDXzd1eP2EP_027u0pFPzo8E3-gaJ4-G-fqWh_rpruDnGmH2v-97` | 2025-12-15 | **not in the handoff.** Standalone copy of the engine script; source recovered → `legacy/APPS_SCRIPT_Code_gs_2025-12-15.md` |
| v3 BLANK, v3 BACKUP ENGINE WORKING, v2 (+2 backups), v1 (+1 backup), 3 LOCKED ENGINE backups, "Script Working Properly", "Pokemon Master", BuildStep2 roster template (Sheet + 16 MB xlsx), PKMN working sheets | see handoff §19.4 | 2025-12-15 → 12-19 | lineage and rollback points. **Keep untouched** |
| Raw PokeAPI CSVs uploaded to Drive (`pokemon_moves.csv` 8.3 MB, `pokemon.csv`, `pokemon_species.csv`, `pokemon_evolution.csv`, `pokemon_move_methods.csv`) | | 2025-12-15 | the manual data-download step this redesign replaces. Snapshot ≈ 2021 (ends at species 898) |
| Templates: `Canon_Builds_Template.xlsx`, `Canon_Breeding_Stock_Template.xlsx`, `BreedingLab_Option2_Tabs.xlsx`, `Breeding_Lab_New_Tabs.xlsx` | | 2025-12-16/17 | schema prototypes |

## 2. How the old engine actually works (from recovered source)

It's a **formula installer**. Six functions are run by hand from the script editor. There are no triggers, menus or custom functions. They write data-validation dropdowns and `FILTER/SORT/UNIQUE` formulas, and from then on the sheet's formulas do the live work. The final rule (`rebuildEggMovesUsingPokemonSpecies`) is:

> a move is offered for a roster row if it is in **this Pokémon's own learnset** for the version group, **or** an **egg move of the root (baby) form**.

**What works well (preserve the ideas):**
- Version-group-aware filtering via `Game_Map` (IDs 4/6/7/9/10 are correct).
- Walking `evolves_from_species_id` to the root form, the right instinct for egg moves.
- A `Breeding_Lab` that asks the right question (target + game + required egg moves → bundles, fathers, egg group). Its output schema (bundle #, count, moves covered, father, shared group) is a good UI starting point.
- `Canon Builds` columns are close to the right fields (Primary Move and Defining Move are a lovely touch: identity, not just stats).
- EV spreads all total 508 (legal), and Primary/Defining moves are always among that row's four.

**What's broken or missing (each one verified):**

| # | Defect | Effect on canon |
|---|---|---|
| 1 | Pre-evolution level-up/TM moves are never offered (only own learnset + root egg moves) | **Mamoswine Ice Shard (D-014) can't even be selected.** It's Swinub-only in Gen 4 |
| 2 | Breeding keyed on the baby form, whose egg group is "No Eggs" | **Observed:** v3's Riolu + Vacuum Wave + Cross Chop shows "max bundle size 0", while the real answer is a male Machop-line father (one egg). **Inferred** (the root-form logic is in the script; the Breeding Lab formulas aren't visible): the same failure for every baby-form line. That would include Snorlax (Munchlax), Pikachu (Pichu), Roserade (Budew) and Lucario (Riolu) |
| 3 | No same-generation cross-game routes, no transfers, no timing rules, no gift/encounter constraints | can't tell "legal" from "legal only via HGSS" or "only before evolving" |
| 4 | No co-legality of a full moveset with its encounter | the sheet's starter Typhlosion with Extrasensory, wild Pikachu with Volt Tackle, and wild Roserade with Leaf Storm + Sleep Powder all pass silently |
| 5 | Reference data includes version groups 1–20 and 114 alternate forms (Megas, Alolan…) while claiming Gen I–IV | Gen 4 dropdowns can contain non-Gen-4 content |
| 6 | Removing Fairy type left Clefairy, Clefable, Cleffa, Togepi, Snubbull and Granbull **with no type**; Togekiss is Flying-only | typing is wrong for 8 species |
| 7 | Hard-coded to one tab ("ROSTER - Template") and rows 11–16/21–26; MoveLists/AbilityLists are shared workbook-wide | extra roster tabs can't each have their own lists, so the per-chapter design can't scale |
| 8 | Name keys don't match reference data ("AncientPower" vs "Ancient Power", "Hidden Power (Grass)", "U-Turn", "Gyrados", "Venesaur") | lookups silently fail |
| 9 | One flat schema for every era (Nature/Ability/IV/EV on Crystal rows) | Gen 2 can't be represented correctly |
| 10 | Performance: `Pokemon_Moves_Display` has 485,770 grid rows under FILTER formulas | slow recalculation and a fragile UX |

## 3. Canon Builds: engine sweep of every legacy build row

Ran `engine/legacy_audit.py` over the 2026-01-07 full copy (19 rows with builds). Full output: `engine/data_manifest/legacy_canon_builds_audit_2026-10-19.txt`.

| Finding | Rows |
|---|---|
| **Egg-only move on a Pokémon recorded as caught or gifted (impossible as recorded)** | Typhlosion (Extrasensory, "New Bark Town Lv 5", i.e. the starter) · Tyranitar (Dragon Dance, Mt. Silver) · Pikachu (Volt Tackle, Viridian Forest) · Roserade (Leaf Storm + Sleep Powder, Route 212) |
| Met level outside that location's wild range | Mamoswine Lv 33 vs Ice Path 21–24 · Pikachu 10 vs 4–7 · Gengar 8 vs Sprout Tower 3–6 · Garchomp 15 vs Wayward Cave 17–20 · Roserade 14 vs Route 212 22–24 |
| Location doesn't hold that line in that game | HeartGold Milotic "Mt. Coronet" (a Sinnoh location) · SoulSilver Gliscor "Route 45" (Gligar is HeartGold-exclusive) · SoulSilver Lucario "Iron Island (Egg)" (Platinum's gift egg) |
| Move only reachable in another game of the same generation | Platinum Weavile Low Kick · (Ice Shard on a wild Sneasel: HGSS Lv 49 only) |
| 6×31 IVs on non-egg encounters (PID/IV-coupled in Gen 3–4) | all 18 rows with IV data. These are aspirational placeholders |
| Balls impossible for the encounter (from game knowledge; verify in PKHeX) | Luxury Ball on a starter, Dive Ball on a starter, Moon Ball on a Gen 4 egg, Level/Heavy Ball in Platinum |
| Save-plausibility | two "Starter" rows in Platinum (Infernape + Empoleon); all three Kanto starters on FireRed |
| Data hygiene | "Gyrados", "Venesaur", "Timid " (trailing space), Version Group holding text or a single space, trainer encoded inside the Game field |

**No row had an ability foreign to its species.** The only foreign builds are `Copy of Canon Builds` rows 6–7.

## 4. `Copy of Canon Builds`: what the "misalignment" actually is

Rows 2–5 match `Canon Builds` exactly. In rows 6–7, **only the column-A labels changed** (Milotic → Lapras, Scizor → Snorlax); columns B–V still hold the Milotic and Scizor builds. It isn't a uniform row shift (the proxy positions of Lapras and Snorlax would need two different offsets).
**Best reading:** someone relabeled the HeartGold roster before rewriting its builds. It may be an early trace of the moment the sacred six took shape.
**Import rule (unchanged by that reading):** rows 6–7's B–V data must **never** be imported as Lapras or Snorlax builds. They're preserved as `LegacyRow` with reconciliation = `label-only edit; data belongs to Milotic/Scizor`. Rows 8–57 of this tab aren't visible through the connector.

## 5. Migration plan

1. **Raw import, read-only:** every legacy row → `LegacyRow {file_id, tab, row, cells, extracted_at, extraction_method}`. Never corrected in place.
2. **Reconcile by reference:** each LegacyRow gets a reconciliation (`matches-canon` · `historical-version` · `label-only-edit` · `invalid: <engine finding>`) linked to the Decision that superseded it.
3. **Carry forward ideas, not cells:** the Primary/Defining Move concept, the Breeding Lab question format, version-group mapping.
4. **Replace the data pipeline:** pinned PokeAPI + Showdown + pret instead of hand-uploaded CSVs.
5. **To finish the import:** the Drive connector shows only the first ~7 rows of most v3 tabs. Exporting these tabs to CSV (File → Download → CSV, one tab at a time) would make the audit complete: `Canon Builds`, `Copy of Canon Builds`, `Canon Breeding Stock`, `Breeding_Lab`, `ROSTER - Template`.

## 6. What was actually tested vs. not

**Tested:** Drive inventory and metadata; v3 tab structure; verbatim rows 1–7 of each v3 tab; the full 54-row Canon Builds via the Jan 7 copy; the complete reference tabs README, Game_Map, Species_Base_Pokemon, Pokemon_Master, Types_Master, Pokemon_Types_Clean and Moves_Master; the Apps Script source (Dec 15 copy); an engine sweep over all 19 legacy builds.
**Not visible or not tested:** formulas (Drive reads return values only); data-validation rules; v3 rows beyond ~7 for most tabs; `Copy of Canon Builds` rows 8–57; the script versions bound to v1/v2/v3 (likely edited after Dec 15, e.g. "Script Working Properly"); Drive version history.
