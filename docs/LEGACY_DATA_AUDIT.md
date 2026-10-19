# Legacy Data Audit: Google Drive spreadsheets and Apps Script (2026-10-19)

**Access:** read-only. No Drive file was created, modified, copied, moved, shared or trashed.
**What was actually tested** is listed in §6. Read that section before trusting any claim here.

## 1. Inventory

| Asset | ID | Dates | Role |
|---|---|---|---|
| **Pokemon Master Spreadsheet v3** | `1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek` | created 2025-12-17 · modified **2026-01-08** | latest workbook; 23 tabs |
| "Untitled spreadsheet" (single tab "Canon Builds") | `1jMx5cz-xvKDYoDYrONYn-e6_NAqr5GIz-4DHkXZCwvA` | 2026-01-07 | **not in the handoff.** A 54-row copy of Canon Builds (rows 2–7 match v3 cell for cell). Superseded as a source now that v3 can be read directly |
| **Apps Script project "Untitled project"** | `1ZnAgBDXzd1eP2EP_027u0pFPzo8E3-gaJ4-G-fqWh_rpruDnGmH2v-97` | 2025-12-15 | **not in the handoff.** Standalone copy of the engine script; source recovered → `legacy/APPS_SCRIPT_Code_gs_2025-12-15.md` |
| v3 BLANK, v3 BACKUP ENGINE WORKING, v2 (+2 backups), v1 (+1 backup), 3 LOCKED ENGINE backups, "Script Working Properly", "Pokemon Master", BuildStep2 roster template (Sheet + 16 MB xlsx), PKMN working sheets | see handoff §19.4 | 2025-12-15 → 12-19 | lineage and rollback points. **Keep untouched** |
| Raw PokeAPI CSVs uploaded to Drive (`pokemon_moves.csv` 8.3 MB, `pokemon.csv`, `pokemon_species.csv`, `pokemon_evolution.csv`, `pokemon_move_methods.csv`) | | 2025-12-15 | the manual data-download step this redesign replaces. Snapshot ≈ 2021 (ends at species 898) |
| Templates: `Canon_Builds_Template.xlsx`, `Canon_Breeding_Stock_Template.xlsx`, `BreedingLab_Option2_Tabs.xlsx`, `Breeding_Lab_New_Tabs.xlsx` | | 2025-12-16/17 | schema prototypes |

## 1a. Timeline (full detail: `legacy/LINEAGE_TIMELINE.md`)

| When (UTC) | What happened |
|---|---|
| Dec 15, early | raw PokeAPI/Veekun CSVs downloaded and uploaded by hand |
| Dec 15, afternoon | generated roster template (BuildStep2) + bound Apps Script "formula installer" (last edited 19:29Z) |
| Dec 15 → 16 | "LOCKED ENGINE" snapshots; **first legality output** (✅/⚠️ + "Reason") in "Pokemon Master" / "Script Working Properly" |
| Dec 16 → 17 | v1 "everything" branch (natures, prep summary, overlay Breeding Lab: *Cyndaquil + Extrasensory → donor Vulpix*, correct except that Vulpix is SoulSilver-exclusive); v2 forked from the clean engine; "Option 2: Max Egg-Move Bundles" Breeding Lab |
| Dec 17 21:54 | v3 created as a copy of final v2 |
| Dec 19 | v3 BACKUP ENGINE WORKING (47 Canon Builds rows; Breeding Lab accepts up to 3 required moves); v3 BLANK |
| 2026-01-07 / 08 | Canon Builds grows to 53 rows × 22 columns (balls, locations, levels; Danny added); `Copy of Canon Builds` (Lapras/Snorlax relabel) |

**Best last known-good engine:** `v3 (BACKUP ENGINE WORKING)` `1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg` (inherits the Breeding Lab baby bug). Cleanest engine-only baseline: `v2 (ENGINE WORKING DO NOT TOUCH)`. Also not in the handoff: `TeamDashboard_FeatureSheets.xlsx` (Dec 16, type chart and Crystal dashboard, all `#REF!`, never merged).

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
| 2 | Breeding keyed on the baby form, whose egg group is "No Eggs" | **Observed twice:** v3's Riolu + Vacuum Wave + Cross Chop shows "max bundle size 0" (the real answer is a male Machop-line father, one egg), and v2's backup maps Pikachu to donor "Mime Jr / no-eggs". It likely affects every baby-form line, including Snorlax (Munchlax), Pikachu (Pichu), Roserade (Budew) and Lucario (Riolu) |
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

## 4. `Copy of Canon Builds`: fully read (Sheets connector, 2026-10-19)

**What it is:** a **roster rewrite in column A only.** The species names in column A were replaced for every game with the *later* rosters, while columns B–P (the builds) stayed in their original row order. **Row *n*'s build data belongs to `Canon Builds` row *n*.** Examples: the "Dragonite" row carries Lucario's build, "Gengar" carries Gliscor's, the FireRed rows carry the Platinum builds, and "Arcanine" carries Blastoise's. It is not a shift or a scramble.

**Why it matters (evidence):** v3 hasn't been modified since 2026-01-08, so column A proves that by that date the later rosters already existed in writing:
- Crystal with Ampharos; FireRed with Jolteon; Emerald with Milotic + Absol; Platinum with Lucario
- **HeartGold with Lapras + Snorlax**
- SoulSilver's former six (Pikachu · Dragonite · Gyarados · Gengar · Empoleon · Scizor)
- The rival six (Nidoking · Kingdra · Metagross · Gliscor · Houndoom · Salamence), with chapter assignments that July later revised

The tail is messier: the Danny block is shifted one column and one row, and Gardevoir and Heracross are parked at the end with no game.

**Import rule:** column A = roster evidence. Columns B–P = re-key each row to `Canon Builds` row *n* (its true species). Never import them under the column-A label.

## 4a. The old engine's formulas (now visible)

- **Legality (✅/⚠️):** ⚠️ if any move isn't in that slot's own `MoveLists` column, or there are duplicate moves, an empty move slot, or no ability. Each slot reads its own column (A for slot 1, B for slot 2 … G for slot 7). No shared-column bug.
- **Reason:** "Illegal move(s)" › "Duplicate move(s)" › "Incomplete moveset" › "No ability selected".
- **prep_special_move:** TRUE if any move is an Egg move of the root form in that version group.
- **prep_non_default_ability:** TRUE if the species *has* ≥2 abilities. It doesn't check which one was chosen.
- **Preparation Summary:** "Nature: X. Deliberately prepared through lineage move inheritance [and ability selection]." or "Standard configuration; prepared only for temperament."
- **Breeding_Lab outputs are typed values, not formulas.** They were computed by a script attached to v3 that isn't visible anywhere.
- **Note:** the old legality idea, "the move is in this species' learnset for this game", matches the learnability standard Zack chose in D-024. The redesign keeps the concept and fixes the gaps listed in §2.

## 5. Migration plan

1. **Raw import, read-only:** every legacy row → `LegacyRow {file_id, tab, row, cells, extracted_at, extraction_method}`. Never corrected in place.
2. **Reconcile by reference:** each LegacyRow gets a reconciliation (`matches-canon` · `historical-version` · `label-only-edit` · `invalid: <engine finding>`) linked to the Decision that superseded it.
3. **Carry forward ideas, not cells:** the Primary/Defining Move concept, the Breeding Lab question format, version-group mapping.
4. **Replace the data pipeline:** pinned PokeAPI + Showdown + pret instead of hand-uploaded CSVs.
5. **Finishing the import** no longer needs manual CSV exports: the Sheets connector reads any tab in full.

## 6. What was actually tested vs. not

**Tested:** Drive inventory and metadata; v3 tab structure; verbatim rows 1–7 of each v3 tab; the full 54-row Canon Builds via the Jan 7 copy; the complete reference tabs README, Game_Map, Species_Base_Pokemon, Pokemon_Master, Types_Master, Pokemon_Types_Clean and Moves_Master; the Apps Script source (Dec 15 copy); an engine sweep over all 19 legacy builds.
**Later, via the Sheets connector:** the full `Copy of Canon Builds`; the ROSTER legality, prep and summary formulas; Breeding_Lab cell contents.
**Still not visible:** the script versions attached to v1/v2/v3 (the Breeding Lab logic lives there); Drive version history. Any other v3 tab can now be read in full on request.
