# LINEAGE TIMELINE — Dec 15 2025 → Jan 8 2026 (UTC; Zack's local time = UTC−5)

Sources: Drive createdTime and modifiedTime, plus the visible content of each file. "C" = created, "M" = last modified. Inferences are labelled as such.

## Phase 0 — Raw data gathering (Dec 15, 05:56–07:37Z = Dec 15 00:56–02:37 EST)
- 05:56–06:09: three ad-hoc "Untitled spreadsheet" Pokédex lists (they include Mega/Alolan forms, i.e. modern data).
- 06:20:54–06:20:57: Veekun/PokeAPI CSV dump uploaded: pokemon.csv, pokemon_species.csv, pokemon_evolution.csv, pokemon_move_methods.csv, version_groups.csv, moves.csv, **pokemon_moves.csv (8.3 MB)**.
- 06:21–07:37: CSVs imported into sheets ("Untitled spreadsheet" 1.2 MB "Pokemon" tab; two "moves" sheets).

## Phase 1 — Generated roster template (Dec 15, 15:44–16:33Z)
- **15:44** (README "Generated on: 2025-12-15 15:44"): an external generator (the README wording reads like an AI assistant hand-off; inference) builds the first template.
- **16:02 C — Untitled 1zmX6**: 8 tabs. "ROSTER – Template" uses an EN DASH. 12 columns, no base id. Pokemon_Moves_Display is pre-filtered (108k rows). MoveLists = **#N/A** everywhere. README: "Next step: wire Pokémon + move dropdowns…".
- **16:23 (mtime) / 16:29 C — BuildStep2 .xlsx (16.1 MB)**: the "Google Sheets friendly" rebuild ("Tabs are intentionally kept visible…").
- **16:33:05 C — BuildStep2 Google Sheet** (base 16 tabs: all version groups, Abilities, AbilityLists, Species_Base_Pokemon, Pokemon_Species, Base_Species_Map, column M base_pokemon_id).
- **16:33:42 C — Apps Script "Untitled project"** (bound to BuildStep2 by inference). It is the "formula installer": dropdowns plus MoveLists/AbilityLists FILTER formulas, then a series of egg-move attempts — Evolution_Master/Prevo_Map (abandoned; no such tabs exist) → Species_Base_Pokemon (identity, no pre-evo) → **Base_Species_Map walk to the chain root** (final). **Script last modified 19:29:45Z Dec 15.** No triggers or menus.
- 19:27: Pokemon_Species_Core_Gen1_4 (csv + sheet) uploaded. It is the Pokemon_Species tab's source (494 rows).
- BuildStep2 sheet last modified **21:38Z** (test value: Venusaur in slot 1, derived cells blank).

## Phase 2 — "LOCKED ENGINE" snapshots and the first legality output (Dec 15 19:46Z → Dec 16 02:24Z = Dec 15 14:46–21:24 EST)
- **19:46 C — Pokemon Master (LOCKED ENGINE backup)** 1ciPZ. Despite the name it was edited until **Dec 16 02:24:02**. Main header L becomes **"Reason"**.
- **21:57 C — LOCKED ENGINE backup 2** 1aLxb (edited until Dec 16 01:54): Ninetales and Typhlosion test. Row 11 lookups are blank and row 12 works. No legality values yet.
- **Dec 16 00:21–00:29**: breeding reference data uploaded: Pokemon_Egg_Groups_Clean, Egg_Groups_Master, Items_Master, **Breeding_Requirements** (Volt Tackle needs Light Ball, Emerald+).
- **01:43 — TeamDashboard_FeatureSheets.xlsx** uploaded (type chart / move-type map / Crystal team dashboard, all **#REF!**; modern Fairy-era data). Never merged into a Master file (no FEATURE_* tabs anywhere later).
- **01:50 C — "Copy of Pokemon Master (LOCKED ENGINE backup 3)"**: byte-size equal to backup 2. Typhlosion with blank derived cells.
- **02:05 C — Pokemon Master** 1teT (M 02:16). **First visible legality engine output:** Illegal? ✅/⚠️ plus Reason "Incomplete moveset". Egg-move legality accepted Charmeleon Beat Up/Counter and Typhlosion Extrasensory (via base ids 4 and 155).
- **02:11 C — "Pokemon Master - Script Working Properly"** 10Nz: same bytes and content as Pokemon Master at that moment. The title is the only explicit "script works" statement; its bound-script copy is not visible.
- **02:24:44 C — Pokemon Master v1 (LOCKED ENGINE backup)** 1TgBh: clean (empty) engine snapshot.

## Phase 3 — v1 development and side experiments (Dec 16 02:25Z → Dec 17 04:21Z)
- **02:25 C — Pokemon Master Spreadsheet v1** 1W43 (M **Dec 17 04:21**). Becomes the 24-tab "everything" branch.
- **02:58 C — PKMN: Working Additional Roster Sheets**: ROSTER - HeartGold / Crystal / FireRed tabs. This exposes the **shared MoveLists flaw** (one helper per row number, hard-wired to one roster tab) and a **FireRed tab still set to Crystal**.
- **05:35 C — PKMN - Working Egg Move and Ability**: adds N prep_special_move / O prep_non_default_ability (Typhlosion Extrasensory → TRUE/FALSE).
- **06:44 C — v1 (ENGINE WORKING DO NOT TOUCH)**: adds Natures_List and P Nature / Q Preparation Summary. Clean, empty (slot-5 label missing).
- Dec 16 daytime → Dec 17 04:21: v1 receives Veekun species/egg groups/genders/items and an **overlay Breeding Lab** (Cyndaquil + Extrasensory → donor Vulpix). Typhlosion gets Nature Jolly and the Prep Summary "Nature: Jolly. Deliberately prepared through lineage move inher…".
- **18:59 — Breeding_Lab_New_Tabs.xlsx** (overlay template, "No engine references yet.") uploaded.

## Phase 4 — v2 = rebuild from the clean engine and "Option 2" Breeding Lab (Dec 16 20:18Z → Dec 17 21:54Z)
- **20:18 C — Pokemon Master Spreadsheet v2** 1k_q (M **Dec 17 21:54:41**).
- **20:19 C — v2 (ENGINE WORKING DO NOT TOUCH)** 1KFDj: a 17-tab clean engine, identical in set to v1 ENGINE WORKING. **v2 forked from the clean engine, not from v1's 24-tab branch** (inference from tab sets).
- **21:41 — BreedingLab_Option2_Tabs.xlsx** uploaded ("Option 2: Max Egg-Move Bundles" with the bundle_id/bundle_size/egg_moves_in_bundle/best_donor_pokemon/donor_egg_group_overlap/special_requirements schema). Merged into v2 as Breeding_Lab plus Pokemon_Egg_Groups_Clean plus Breeding_Requirements.
- **Dec 17 20:19 C — v2 (WORKING BACKUP DO NOT TOUCH)** 12qWM3: 20 tabs with a working Typhlosion row (✅, Jolly, prep TRUE/FALSE). The Breeding Lab shows Pikachu → **Mime Jr / no-eggs** (logic bug).
- **Dec 17 21:44 / 21:51 — Canon_Builds_Template.xlsx / Canon_Breeding_Stock_Template.xlsx** uploaded. Their tabs appear in v2 by 21:54 (header only).

## Phase 5 — v3 (Dec 17 21:54Z → Jan 8 2026)
- **Dec 17 21:54:59 C — Pokemon Master Spreadsheet v3** (main; other auditor), 18 s after v2's last edit. So v3 = v2-final copy.
- **Dec 19 04:14 C — v3 (BACKUP ENGINE WORKING)** 1MyYT: 22 tabs. Canon Builds now holds **47 rows** (19 columns). The Breeding Lab now accepts **up to 3 required egg moves** (Bulbasaur, Magical Leaf + Leaf Storm → Bellossom/plant).
- **Dec 19 04:48 C — v3 BLANK** 1jZwI: Canon Builds and roster cleared. Breeding Lab output schema becomes "Max Egg Moves | Egg Moves | Parent | Family". **Stale** Machop (66) state with a blank target.
- **2026-01-07 15:41 C — Untitled "Canon Builds" export** 1jMx5: **53 rows × 22 columns** (adds Poke Ball / Encounter Location / Encounter Level): the six protagonist teams + rival teams + **Danny (HeartGold)**.
- **2026-01-08 15:53 M — main v3** last modified. Its tab list adds "Copy of Canon Builds" (Lapras/Snorlax swap draft). The Breeding Lab target is Riolu → bundle size 0. Last viewed 2026-01-12.

## What "the ENGINE" is
1. **In-sheet lookup/legality formulas** produce pokemon_id, types, base_pokemon_id, Illegal? ✅/⚠️, Reason, prep_* flags, Nature and Summary. They are not visible because Drive reads return values only. Their outputs re-appear in copies made minutes apart, which fits live formulas.
2. **A bound Apps Script** (the visible Dec-15 version) that *installs* those formulas and dropdowns: B3 version-group lookup, MoveLists/AbilityLists FILTER formulas, M base_pokemon_id via Base_Species_Map, and data validation on B/F/G–J. It has no triggers; functions are run by hand ("If dropdowns do not appear after import, run the provided Apps Script").
3. **The Breeding Lab** (v1 overlay → v2 Option 2 → v3 multi-move). Its logic is in neither visible source. The stale values in v3 BLANK suggest it is computed by a later, script-driven run (inference). The script copies bound to v2/v3 are not visible.

## Best guess: last known-good engine
- **Full system (roster legality + Breeding Lab v3 + Canon tabs): "Pokemon Master Spreadsheet v3 (BACKUP ENGINE WORKING)" — 1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg (Dec 19 04:14Z).** It is the latest file explicitly labelled as working and has a populated Canon Builds. Caveats: the Breeding Lab baby/No-Eggs donor bug is inherited; roster rows are not visible to this reader.
- **Last known-good before the Canon/v3 changes:** v2 (WORKING BACKUP DO NOT TOUCH) 12qWM3gg… (Dec 17 20:19Z). It has a visible working Typhlosion row (✅) and the Option-2 Lab.
- **Cleanest engine-only baselines (no breeding):** v2 (ENGINE WORKING) 1KFDjj… (Dec 16 20:19Z) ≈ v1 (ENGINE WORKING) 1ujzZG… (Dec 16 06:44Z; slot-5 label missing).
- **Earliest "script working" proof:** "Pokemon Master - Script Working Properly" 10Nz325y… (Dec 16 02:11Z; 16 tabs; ✅/⚠️ output on a 4-mon test roster).
- **Avoid as a template:** v3 BLANK (stale Breeding Lab state); PKMN: Working Additional Roster Sheets (FireRed tab set to Crystal; shared-helper conflict); the 1zmX6 Untitled (#N/A).
