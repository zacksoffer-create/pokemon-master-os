# LINEAGE INVENTORY — Zack's Pokémon Master Spreadsheet lineage (READ-ONLY audit, 2026-10-19)

**Scope and method.** Read-only. The tools used were Drive `search_files`, `get_file_metadata` and `read_file_content`, plus one `download_file_content` of the small Apps Script project export. **No Drive file was created, modified, copied, shared, moved or trashed.**
All times are **UTC**. Zack's local time is America/New_York, which is UTC−5 in December (the script manifest's timeZone).

**Important reader limitation.** For Google Sheets, `read_file_content` returns, per tab, the **Table Range** (true extent) plus a **sample of only the first ~9–46 rows**. The sample depth varies by file: it gets shallower when a file has more tabs. Long cell text is cut with "...". Everything below marked *(sample)* covers only the visible rows. Cells are returned as **values only**: no formulas, data validation, colours, hidden state or notes. For XLSX files the reader returns flattened text.

**Shared "base 16" tab set.** Every lineage file from BuildStep2 onward contains these 16 tabs, with the same Table Ranges unless noted:
`README` (A1:A10), `Game_Map` (A1:C8), `Species_Base_Pokemon` (A1:B494), `Pokemon_Master` (A1:E608), `Types_Master` (A1:D20), `Pokemon_Types_Clean` (A1:C891), `Moves_Master` (A1:D486), `Pokemon_Moves_Display` (A1:H485770 — every version group from red-blue on), `Move_Methods_Master` (A1:C12), `Abilities_Master` (A1:E124), `Pokemon_Abilities_Display` (A1:E1614), `MoveLists` (A1:L2..L73), `ROSTER - Template` (A1:M26 → A1:O26 → A1:Q26), `AbilityLists` (A1:L2/L3), `Pokemon_Species` (A1:F494), `Base_Species_Map` (A1:B494).
The bulky reference tabs looked identical in every file sampled: same ranges and same first rows. Only the differences are recorded below.

**Canonical README text** (identical in all base-16 files; some files' samples truncate it):
> Pokemon Master Spreadsheet - Roster Template (Google Sheets friendly) / Tabs are intentionally kept visible so Google Sheets import keeps them. / Workflow: / 1) Import this XLSX into Google Sheets. / 2) Duplicate 'ROSTER - Template' for each run. / 3) Set Game in B2. Pick Pokemon in column B. Pick moves in Move 1-4. / If dropdowns do not appear after import, run the provided Apps Script to apply them.

**Game_Map** (all base-16 files): Crystal 4 crystal; FireRed 7 firered-leafgreen; LeafGreen 7 firered-leafgreen; Emerald 6 emerald; Platinum 9 platinum; HeartGold 10 heartgold-soulsilver; SoulSilver 10 heartgold-soulsilver.

**ROSTER - Template layout** (all versions): A1 Team Name; A2 Game (B2); A3 Version Group ID (B3); A5 Team Identity Notes (merged block rows 6–8); row 10 header; rows 11–16 = main slots 1–6; row 20 header; rows 21–26 = bench B1–B6.
Column headers: A Slot | B Pokémon | C pokemon_id | D Primary Type | E Secondary Type | F Ability | G–J Move 1–4 | K Illegal? | L Reason (main) / Notes (bench) | M base_pokemon_id | (from 05:35Z Dec 16) N prep_special_move | O prep_non_default_ability | (from ≤06:44Z Dec 16) P Nature | Q Preparation Summary.

---

## 0. Raw-data stage (Dec 15 05:56–07:37Z) — metadata/snippets only (not part of the requested list)
| ID | Title | Created / Modified | Size | What it is (from search snippet) |
|---|---|---|---|---|
| 1muAyc0CO_Qj3vokHS8J6pHPmg-veFM6RzuYySSycPLE | Untitled spreadsheet | 05:56:02 / 05:57:57 | 24,392 | Sheet1: dex#, name, types, abilities, egg groups, species, base stats (includes Mega forms) |
| 19iP306_VfGljTcY0vC6AfeOHfT-Iqd3qwp-D4Bmw0QE | Untitled spreadsheet | 06:03:07 / 06:03:21 | 10,902 | Sheet1: Num, Name, Type, Species (includes Mega/Alolan) |
| 18qp21JEHd6LfXkVA0_Twn6eeJodCAJd1NvCSsH1BwE0 | Untitled spreadsheet | 06:04:27 / 06:09:49 | 4,576 | National Dex Number, Name, Primary/Secondary Type, Species, Generation Introduced |
| 1X6DFuRvuvoVGxul9aH-U1fpumn-znd6J | pokemon.csv | 06:20:54 (file mtime 06:18:20) | 37,295 | Veekun/PokeAPI pokemon table |
| 1lmA9LXmKFvHEoPt5qIePla8uaTcN0dWH | pokemon_species.csv | 06:20:54 | 49,667 | Veekun species table |
| 17kqEQyBZBQbjlmKfRxlB6j1n2e4sxmkf | pokemon_evolution.csv | 06:20:54 | 14,500 | (metadata only) |
| 1k73i3zaxJZ3SHnxHUi-Mdi6lxZ-v1wRq | pokemon_move_methods.csv | 06:20:54 | 178 | (metadata only) |
| 1Y7h297TnhD9b9G9OWICwQ3F5l4d6oLbd | version_groups.csv | 06:20:54 | 440 | ids 1 red-blue … 20 sword-shield |
| 1U4JLJlODFD9yWyuKJnshDkg73Ns0VA8v | moves.csv | 06:20:54 | 38,162 | (metadata only) |
| 1Mt1CwZkwO-7SsR9A6oZe4egLKoPhglvR | pokemon_moves.csv | 06:20:57 | 8,298,079 | (metadata only — not read) |
| 1NHTqZIQ8SBG7DMfivNvOPeI9hmxuXlwof5r_lEeKQdE | Untitled spreadsheet | 06:21:30 / 07:37:31 | 1,199,497 | tab "Pokemon" = pokemon.csv import |
| 1V3LF_gRuYf7UH-9WOyxd3nt37AMHr7y6sztPydLqcQU / 1kAiJ8eRIvdZrb1br1s-E7SsqWevWavb002PmYaNFqNw | moves (x2) | 06:22:33 / 06:23:12 | ~19,000 each | moves.csv imports (duplicate) |

## 1. Untitled spreadsheet — 1zmX6wNefQoNSjbik1ERY-mn8O029ANLs-4cBE5pNVRA (FIRST TEMPLATE; not in requested list)
- Created 2025-12-15T16:02:42Z, modified 16:03:07Z, 272,712 B.
- **Tabs (8):** README (A1:B22), Game_Map (A1:E8: game_label, version_identifier, version_group_id, version_group_key, version_group_name; **HeartGold listed first**), **"ROSTER – Template" (EN DASH)** (A1:L26, 12 columns, no base_pokemon_id; merged banners "Main Roster" and "Bench / Candidates"), Pokemon_Master (A1:E608), Types_Master, Pokemon_Types_Clean, **Pokemon_Moves_Display (A1:H108190 — pre-filtered to the target version groups; sample starts with crystal vg4, then emerald vg6, and includes Egg rows)**, MoveLists (A1:L2, headers "Moves for 1"…"Moves for 6", "Moves for B1"…"Moves for B6").
- README text (verbatim): "Pokémon Master Spreadsheet — Roster Template / What's in this file / • ROSTER – Template: main 6 + bench 6 layout (game locked per team). / • Game_Map: HeartGold and SoulSilver separated (same underlying version group). / Next step: wire Pokémon + move dropdowns to the cleaned data tables. / Generated on: 2025-12-15 15:44 / … / Next step added: / Pokemon dropdowns and move dropdown plumbing are included. If importing to Google Sheets and dropdowns don't carry over, re-apply data va… [reader-truncated] / Pokemon column uses Pokemon_Master!E2:E; Move columns use MoveLists helper columns (A-L)."
- **Errors:** MoveLists row 2 = **#N/A in all 12 cells**. Roster empty; Game blank.

## 2. Pokemon_Roster_Template_BuildStep2_GSheetsVisible.xlsx — 1LE48iGney2unNsviY7OR7HatLEVkMxGX (metadata + search snippet only)
- Uploaded 2025-12-15T16:29:42Z (file mtime 16:23:11Z), **16,110,373 B**. Not read in full (too large). The snippet shows the canonical README, Game_Map and Pokemon_Master. This is the source XLSX of item 3.

## 3. Pokemon_Roster_Template_BuildStep2_GSheetsVisible (Google Sheet) — 1y6QZcM5bO1SZFrL589vtk91PDMqdep-iGjVLh-FaQqw
- Created 2025-12-15T16:33:05Z, modified 21:38:45Z, 931,803 B.
- **Tabs (16 = base set, first appearance).** Pokemon_Moves_Display now holds all version groups (485,770 rows).
- ROSTER - Template: Game HeartGold, VG 10; slot 1 **Venusaur with every derived cell blank** (pokemon_id/types/ability empty); header L = "Notes". MoveLists/AbilityLists rows empty.
- **Apps Script "Untitled project"** (1ZnAgBDXzd1eP2EP_027u0pFPzo8E3-gaJ4-G-fqWh_rpruDnGmH2v-97) was created at 16:33:42Z, 37 s later, and last modified 19:29:45Z. It is very probably this sheet's bound script. Full source: DOC_Apps_Script_Untitled_project.md.

## 4. Pokemon_Species_Core_Gen1_4 — 1mi4Gv7GH6atpz97CBuP91oOaepyyaHP5lBYQipYXN0c (+ CSV 19dwiJDZxkXLxLq1blMzbGHcygx-jd5QH)
- Sheet created 2025-12-15T19:27:27Z / modified 19:27:46Z, 7,106 B; CSV uploaded 19:27:04Z, 11,383 B. One tab, Pokemon_Species, A1:F494 (493 species). Full content: SMALL_FILES.md.

## 5. Pokemon Master (LOCKED ENGINE backup) — 1ciPZDZOv670SQoJNbwtJ9d-QeqOJDTJdNRC1vwHzPvY
- Created 2025-12-15T19:46:50Z, **modified 2025-12-16T02:24:02Z** (it kept being edited after it was named a backup), 934,953 B.
- Tabs: base 16. ROSTER main header L is now **"Reason"** (bench keeps "Notes"). Roster empty (HeartGold/10). Helper lists empty.

## 6. Pokemon Master (LOCKED ENGINE backup 2) — 1aLxbYuDLJUr9XGO64JXuoHoe6J2_4b7AGpQ6ghr4dNQ
- Created 2025-12-15T21:57:35Z, modified 2025-12-16T01:54:07Z, 932,642 B.
- Tabs: base 16. Header L "Notes". Roster: slot 1 **Ninetales (derived cells blank)**; slot 2 **Typhlosion | 157 | Fire | — | Blaze | Extrasensory | … | base 155**. MoveLists A1:L72: column B ("row 12") holds Typhlosion's HGSS list (Aerial Ace, Attract, Blast Burn, Brick Break, Captivate, Covet, Crush Claw, Cut, Defense Curl, Dig, Double Kick, Double Team, Double-Edge, Earthquake, Ember, Endure, Eruption, Extrasensory …); column A (row 11) is empty. AbilityLists B2 = Blaze.
- Reading: row 11's lookup chain (C11 → MoveLists A → AbilityLists A) produced nothing while row 12 worked. The MoveLists/AbilityLists formulas in the script all start `IF('ROSTER - Template'!$C{r}="","",…)`, so a blank C11 explains the empty helper column. **Why C11 is blank is not visible**; the row-11 lookup formula was probably missing or overwritten.

## 7. Pokemon_Egg_Groups_Clean / Egg_Groups_Master / Items_Master / Breeding_Requirements (Dec 16 00:21–00:29Z)
- Pokemon_Egg_Groups_Clean.csv 1K01CIzEVIMxfIg3n2oXulGxlMr4yCvwf (00:21:17Z, 11,637 B) → sheet **1RUTpEYRp-_DSw7omSRJICNdN4NUMaO_UfRfpOtVdDEM** (00:22:59Z, 6,629 B, A1:C1155 = 1,154 rows, species 1–898).
- Egg_Groups_Master.csv 104g60IY6Wt8YJKJF5cvz59VNPrBBLqSO → sheet 14kXF572CgkBSz5re5U6WA74VSFbGKjvEDnKh9WRA1XQ (00:21:39Z, A1:C16, 15 egg groups).
- Items_Master.csv 1Rlkktf2KsIC23hL4-fN6XaeUWsad-j_H (24,627 B) → sheet 1_AnoAxvXExg48mmEbtFqs7mgzByg60BWf_AR5ETmygA (00:24:00Z, 13,698 B; item_id,item_name; snippet only).
- Breeding_Requirements.csv 1E3opKW3NIowRiawKLVgGp0eKXjsu4a70 → sheet **1ocJLSAdun15vfYqQuouq75kpUhPQ6T1aH5YfsvDAVE8** (00:29:44Z): a single Volt Tackle/Light Ball rule. Full content: SMALL_FILES.md.

## 8. TeamDashboard_FeatureSheets.xlsx — 1d-QltmyE2gjlWHQULcao0e3932BRyTp1 (not in requested list; project file)
- Uploaded 2025-12-16T01:43:59Z (mtime 01:43:40Z), 40,024 B. **Tabs:** FEATURE_TypeChart (attacking × defending multipliers, **18 types including Fairy**), FEATURE_MoveTypeMap (move_name_display, move_key, identifier, type_name, generation_id, power, pp, accuracy, priority; Gen 1–4 moves), FEATURE_TeamDashboard (Game **Crystal**, roster sheet "**ROSTER - Crystal**", 12 slots × Pokemon/Type1/Type2/Ability/Move1–4; Defensive Matchups 18 types × S1–S12 + Weak/Resist/Immune/Alerts; Offensive Coverage section).
- **Errors:** every slot cell and every matchup cell is **#REF!**, because the referenced roster tab isn't in the XLSX. Weak/Resist/Immune are all 0; every Alert reads "<Type>: no resists | <Type>: no immunities".
- **Data-era issue (Pokémon-rules inference):** the type chart includes Fairy (Gen 6+), and the move map uses modern data: Charm, Moonlight and Sweet Kiss are typed **Fairy**, though they were Normal in Gen 2–5; powers are current-gen values (e.g. Thunderbolt/Flamethrower/Ice Beam/Surf 90, which were 95 in Gen 1–5; Leech Life 80). That is inaccurate for Crystal/HGSS/Platinum. No evidence this dashboard was ever merged into a Master file: no later file has a FEATURE_* tab.

## 9. Copy of Pokemon Master (LOCKED ENGINE backup 3) — 19Q5u7g0mvp1KvlJ2xu0FDj1s69ffdJ60hJceqLu9D5U
- Created 2025-12-16T01:50:27Z, modified 01:50:33Z, **932,642 B (byte-identical size to backup 2 at the time)**.
- Tabs: base 16. Roster slot 1 **Typhlosion, derived cells blank**; MoveLists A1:L2 empty. README column displays truncated (reader artifact).

## 10. Pokemon Master — 1teT2G572sM3W21RugDTBgm85hNbrTqzT0Gjf8C2uRWk
- Created 2025-12-16T02:05:47Z, modified 02:16:33Z, 936,454 B.
## 11. Pokemon Master - Script Working Properly — 10Nz325yAna1UtemXybfZ0qmGn00Forc4OLYLiCSTCwc
- Created 2025-12-16T02:11:40Z, modified 02:11:44Z, **936,454 B (same size as item 10)**. Visible content is **identical to item 10**: a copy taken at 02:11 while item 10 stayed open until 02:16.
- Both: base 16; header L **"Reason"**. **First appearance of legality output** (✅ / ⚠️ + Reason). Roster rows (verbatim, HeartGold/10):
  - 1 Typhlosion | 157 | Fire | — | Blaze | Flamethrower | Extrasensory | Will-O-Wisp | Hidden Power | ✅ | — | 155
  - 2 Charmeleon | 5 | Fire | — | Blaze | Beat Up | Counter | Fire Fang | Dig | ✅ | — | 4
  - 3 Pikachu | 25 | Electric | — | Static | Thunderbolt | Iron Tail | Brick Break | Thunder Punch | ✅ | — | 172
  - 4 Smoochum | 238 | Ice | Psychic | Forewarn | — | — | — | — | ⚠️ | Incomplete moveset | 238
  - MoveLists A–D populated (rows 11–14); AbilityLists: Blaze / Blaze / Static / Forewarn+Oblivious.
- The title "Script Working Properly" is the only explicit statement that a script worked. The bound-script copy in this file is **not visible**.

## 12. Pokemon Master v1 (LOCKED ENGINE backup) — 1TgBhOC7Zy7FwAjrSgFkk85lxCqellykDCy7CUg80eeQ
- Created 2025-12-16T02:24:44Z, modified 02:24:49Z, 934,620 B. Base 16, header L "Reason", **roster cleared**, helpers empty. The reader showed every cell truncated to ~4 characters ("Poke…", "Hear…"); this is a display artifact, not data.
- This is the clean v1 engine snapshot, taken 42 s after item 5's last edit and 64 s before item 13 was created.

## 13. Pokemon Master Spreadsheet v1 — 1W43aIbAy8YjYmu9OGN1ZKOyZ2eKGi2WIjErSzhgao8w
- Created 2025-12-16T02:25:48Z, **modified 2025-12-17T04:21:42Z** (worked in for ~26 h), **984,233 B (largest file)**.
- **Tabs (24):** base 16 + **Natures_List** (A1:A26) + **Pokemon_Egg_Groups** (A1:C1155) + **Egg_Groups** (A1:C16) + **Pokemon_Species_Veekun** (A1:T899, 898 species, 20 Veekun columns) + **Genders** (A1:B4) + **Breeding_Requirements** (A1:G2, rule_id schema) + **Items_Master** (A1:B1608) + **Breeding_Lab** (A1:H15).
- ROSTER A1:**Q26**: N prep_special_move, O prep_non_default_ability, P Nature, Q Preparation Summary. Row: **Typhlosion | 157 | Fire | — | Blaze | Flamethrower | Extrasensory | Will-O-Wisp | Hidden Power | ✅ | — | 155 | TRUE | FALSE | Jolly | "Nature: Jolly. Deliberately prepared through lineage move inher…" (reader-truncated)**. Slots 2–6 empty.
- **Breeding_Lab ("BREEDING LAB (Overlay)") verbatim:** Game HeartGold; Target Pokémon **Cyndaquil**; Required Egg Move **Extrasensory**; version_group_id (auto) 10; required_egg_move (blank); Max bundle size 2; output header "Bundle (egg moves) | Donor species (example) | Donor count | Notes | Required move"; output row **"Extrasensory | Quick Attack" | Vulpix | 1 | — | Extrasensory**. Column H "EggMoves_Helper": Covet, Crush Claw, Double Kick, Double-Edge, Extrasensory, Flare Blitz, Foresight, Fury Swipes, Howl, Quick Attack, Reversal, Thrash.
- **Layout defects:** the column-C "Notes" strings sit 1–2 rows away from the labels they describe. They were pasted from the Breeding_Lab_New_Tabs template: "Numeric ID used by your engine" is next to *Required Egg Move*, "Base form or any evo; tool resolves to base" is next to *version_group_id*, and "Must be an egg move for the target line" is next to a leftover duplicate row "required_egg_move".
- **v1 is a side branch.** v2 does *not* carry v1's Veekun/Genders/Items_Master/Egg_Groups tabs (see items 18/20).

## 14. PKMN: Working Additional Roster Sheets — 1JwgOKYnsgIS6cuPoWnlL_h_nHDHUvJGEEakNPCY6ZKA
- Created 2025-12-16T02:58:10Z, modified 02:58:16Z, 938,801 B.
- **Tabs (19):** base 16 + **"ROSTER - HeartGold", "ROSTER - Crystal", "ROSTER - FireRed"** (each A1:M26). The sample shows **only rows 1–12** of each roster tab, so slots 3–6 and the bench are NOT visible.
  - ROSTER - Template: empty (HeartGold/10).
  - ROSTER - HeartGold (HeartGold/10): 1 **Typhlosion** | 157 | Fire | — | Blaze | (no moves) | ⚠️ | Incomplete moveset | 155.
  - ROSTER - Crystal (Crystal/4): 1 **Feraligatr** | 160 | Water | — | Torrent | ⚠️ | Incomplete moveset | 158.
  - ROSTER - FireRed: **Game cell = "Crystal", VG = 4 (BUG: the FireRed tab is still set to Crystal)**; 1 **Charizard** | 6 | Fire | Flying | Blaze | ⚠️ | Incomplete moveset | 4.
- MoveLists A1:L52: only column A (row 11) is populated: Ancient Power, Attract, Beat Up, Belly Drum, Bite, Curse, Cut, Defense Curl, Dig, Double Team, Dragon Breath … This looks like Charizard's **Crystal** list (Charmander-line Crystal egg moves plus Gen-2 TMs), not HeartGold Typhlosion's. It confirms that the single shared helper follows only one roster tab. The script hard-codes "ROSTER - Template", so a duplicated or renamed roster tab redirects or shares the helper. AbilityLists A2 = Blaze.

## 15. PKMN - Working Egg Move and Ability — 1vhz-gKdJnLiYPmiZMZsGRrEFhx0VbkWjsmQvxHfUjb0
- Created 2025-12-16T05:35:50Z, modified 05:35:54Z, 937,029 B. Base 16 only. ROSTER A1:**O26** (adds N prep_special_move, O prep_non_default_ability).
- Row: **Typhlosion | 157 | Fire | — | Blaze | Extrasensory | — | — | — | ⚠️ | Incomplete moveset | 155 | TRUE | FALSE**. This is a proof snapshot: the egg move (Extrasensory) is flagged prep_special_move = TRUE, and the default ability gives FALSE.

## 16. Pokemon Master Spreadsheet v1 (ENGINE WORKING DO NOT TOUCH) — 1ujzZG_Ml1zVbitE6UO2maHLMZX99alJFb8mW9Msdzj4
- Created 2025-12-16T06:44:56Z, modified 06:44:59Z, 937,352 B. **Tabs (17):** base 16 + Natures_List. ROSTER A1:Q26 (N–Q present), **empty**. Helpers empty.
- **Anomaly:** the main-roster slot label "**5**" is missing (A15 blank; labels read 1,2,3,4,(blank),6).

## 17. Breeding_Lab_New_Tabs.xlsx — 1l6QWAXeKaNZwwgmGfGwfJsVhhzOKOpM6
- Uploaded 2025-12-16T18:59:08Z, modified 19:28:01Z, 146,859 B. **Tabs:** Pokemon_Egg_Groups (species 1–898), Egg_Groups (15), Pokemon_Species_Veekun (1–898), Genders (3), Breeding_Requirements (rule_id schema), Items_Master (1–1658 … "Reins of Unity"), **Breeding_Lab (Template)**. Full text: SMALL_FILES.md and the appendix file.
- Breeding_Lab template text (verbatim): "Breeding Lab (Template) / Inputs / Field | Notes / version_group_id | Numeric ID used by your engine / target | Base form or any evo; tool resolves to base / required_egg_move | Must be an egg move for the target line / Outputs (generated later) / bundle_size, egg_move_bundle, donor_species, donor_pokemon_example, notes / (This sheet is an overlay template. No engine references yet.)"

## 18. Pokemon Master Spreadsheet v2 — 1k_qgmd3vqP5RITR87r3yEV_DiVG25VyGRi85njtp34Y
- Created 2025-12-16T20:18:09Z, **modified 2025-12-17T21:54:41Z**, 950,438 B. The last edit came 18 s before v3 was created, so **v3 = a copy of v2's final state**.
- **Tabs (22, in order):** README, Game_Map, Species_Base_Pokemon, Pokemon_Master, Types_Master, Pokemon_Types_Clean, Moves_Master, Pokemon_Moves_Display, Move_Methods_Master, Abilities_Master, Pokemon_Abilities_Display, MoveLists (A1:L72), **Canon Builds (A1:S1, header only)**, **Canon Breeding Stock (A1:H1, header only)**, ROSTER - Template (A1:Q26), AbilityLists, Pokemon_Species, Base_Species_Map, Natures_List, **Breeding_Lab (A1:H16, "Option 2")**, **Pokemon_Egg_Groups_Clean (A1:H1156)**, **Breeding_Requirements (A1:E2, Option-2 schema)**.
- This file's sample stops at row ~10, so **ROSTER rows 11+ are NOT visible**. Indirect evidence: MoveLists column A = a Typhlosion-style HGSS list and AbilityLists A2 = Blaze.
- Canon Builds header (19 cols): Pokémon | Nickname | Game | Version Group | Build Status | Nature | Ability | Gender | Shiny | Move 1–4 | Primary Move | Defining Move | Held Item | EV Spread | IV Notes | Final Level.
- Canon Breeding Stock header: Base Species | Egg Move | **Source Species | Beginning Moveset** | Game / Version Group | Method Notes | Canon Status | Notes. *(The uploaded template uses a different order and wording: "Egg Move, **Starting Moveset, Source Species**".)*
- **Breeding_Lab (Option 2: Max Egg-Move Bundles) verbatim:** Game HeartGold | version_group_id 10; Target **Pikachu** | base_pokemon_id **172**; Required Egg Move **Double Slap** | max bundle size **3**; Outputs header bundle_id | bundle_size | egg_moves_in_bundle | best_donor_pokemon | donor_egg_group_overlap | special_requirements; output row **1 | 3 | "Double Slap, Encore, Tickle" | Mime Jr | no-eggs | —**; H "Eligible Egg Moves": Bide, Charge, Double Slap, Encore, Fake Out …
- **LOGIC BUG (Pokémon rules, high confidence):** Pikachu is resolved to its baby, Pichu (172, egg group *No Eggs*). The donor search then matched the "no-eggs" group and proposed **Mime Jr.**, another No-Eggs baby that can never breed. Donor egg groups must come from the breedable adult (Pikachu: Field + Fairy). The script's `rebuildEggMovesUsingPokemonSpecies` deliberately maps to the chain root (the baby), which is right for egg-move *lists* but wrong for egg-group *compatibility*.
- **Pokemon_Egg_Groups_Clean defect:** row 2 repeats the header ("species_id | egg_group_id"), a paste artifact matching the template note "(paste pokemon_egg_groups.csv here …)". Columns C–E (egg_group_name, example_pokemon_id/name) are blank in the visible sample. The lookup in G:H lists 1 monster … 15 no-eggs.

## 19. Pokemon Master Spreadsheet v2 (ENGINE WORKING DO NOT TOUCH) — 1KFDjjbCruCR48EwygUq_CKOh7caEMpxpcZzUxRofmy0
- Created 2025-12-16T20:19:19Z (70 s after v2), modified 20:19:24Z, 937,461 B. **Tabs (17):** identical set to v1 ENGINE WORKING. ROSTER A1:Q26 empty (slot-5 label present). It is effectively the v1-ENGINE-WORKING engine re-saved as v2's day-zero rollback. It has **no** Breeding Lab or Canon tabs.

## 20. BreedingLab_Option2_Tabs.xlsx — 1aVBR8Fb3vmPsA-oT69LpRs3y2mg4_lDT
- Uploaded 2025-12-16T21:41:09Z (mtime 21:40:51Z), 6,858 B. Tabs: Breeding_Lab ("Breeding Lab (Option 2: Max Egg-Move Bundles)"), Pokemon_Egg_Groups_Clean (paste placeholders), Breeding_Requirements (base_pokemon_id/requirement_type schema). This is the overlay that produced v2's Option-2 tabs. Full content: SMALL_FILES.md.

## 21. Pokemon Master Spreadsheet v2 (WORKING BACKUP DO NOT TOUCH) — 12qWM3gg_H3mYobq3cXb2tgxNiJn2Ge13ERPJTRBoc7k
- Created 2025-12-17T20:19:26Z, modified 20:19:30Z, 951,432 B. **Tabs (20):** base 16 + Natures_List, Breeding_Lab (A1:H16), Pokemon_Egg_Groups_Clean (A1:H1156), Breeding_Requirements (A1:E2). **No Canon tabs yet.**
- ROSTER row 1 (verbatim): **Typhlosion | 157 | Fire | — | Blaze | Flamethrower | Extrasensory | Will-O-Wisp | Hidden Power | ✅ | — | 155 | TRUE | FALSE | Jolly | "Nature: Jolly. Deliberately prepared through li…" (truncated)**. Rows 12+ are not in the sample.
- Breeding_Lab is identical to v2 (Pikachu → Mime Jr / no-eggs bug). Eligible list … Fake Out, Flail.

## 22. Canon_Builds_Template.xlsx — 1RZA5-yP0f3zGXa7Roc2aPkRsV6DJ2BB6 / Canon_Breeding_Stock_Template.xlsx — 190CK2WIltEo_TyzqTzrE0EIRoPuGK5bj
- Uploaded 2025-12-17T21:44:47Z (6,713 B) and 21:51:25Z (modified 21:53:50Z, 11,354 B). Header-only templates; full content in SMALL_FILES.md. Ten minutes later the Canon tabs exist in v2 (last edit 21:54:41Z).

## 23. Pokemon Master Spreadsheet v3 (MAIN — other auditor; tab list only) — 1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek
- Created 2025-12-17T21:54:59Z, modified **2026-01-08T15:53:23Z**, 952,264 B.
- **Tabs (23):** v3-backup set + **"Copy of Canon Builds" (A1:V57)**. Canon Builds is A1:**V54** (22 cols, adding Poke Ball Type / Encounter Location / Encounter Level). Breeding_Lab A1:H19, last target **Riolu (447)**, Vacuum Wave + Cross Chop, **max bundle size 0**. That is consistent with the baby/No-Eggs bug: Riolu is a No-Eggs baby. Not audited further here.

## 24. Pokemon Master Spreadsheet v3 (BACKUP ENGINE WORKING) — 1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg
- Created 2025-12-19T04:14:35Z, modified 04:14:39Z, 953,629 B. **Tabs (22):** same set and order as v2 final. Canon Builds **A1:S48** (47 data rows; only the first 9 visible). Canon Breeding Stock header only. Breeding_Lab grew to **A1:H19**.
- ROSTER: only the header row is visible. AbilityLists A2 = Blaze and MoveLists A = a Typhlosion-style list, so slot 1 probably holds Typhlosion (UNVERIFIED).
- **Breeding_Lab (v3 form) verbatim (reader-truncated labels):** Game HeartGold | version_group_id 10; Target **Bulbasaur** | base_pokemon_id 1; "Required Egg Move…" **Magical Leaf** | max bundle size 3; "Required Egg Move…" **Leaf Storm**; "Required Egg Move…" (blank); Outputs; row **1 | 3 | "Leaf Storm, Magic…" | Bellossom | plant**; Eligible Egg Moves: Amnesia, Charm, Curse, Grass Whistle, Ingrain … The Lab now takes **up to 3 required egg moves**.
- Canon Builds content: see LINEAGE_ROSTERS.md §2. Typos visible: "**Wil-O-Wisp**" and "**Gyrados**".

## 25. Pokemon Master Spreadsheet v3 BLANK — 1jZwIrnGQuz6QGyDkKgYil6QGZk_tMsoSF6KKNcvNY5s
- Created 2025-12-19T04:48:06Z, modified 04:49:07Z, 953,938 B. **Tabs (22):** same as item 24.
- Canon Builds cleared to its header; Canon Breeding Stock header; ROSTER fully empty (all 12 slot rows visible and blank); MoveLists/AbilityLists empty.
- **Breeding_Lab (A1:H18) STALE STATE:** Target Pokémon **blank**, yet base_pokemon_id = **66 (Machop)**, max bundle size **7**, and Eligible Egg Moves still lists Machop's HGSS egg moves (Bullet Punch, Close Combat, Counter, Encore, Fire Punch, Ice Punch, Light Screen, Meditate, Power Trick, Rock Slide, Rolling Kick, Smelling Salts, Thunder Punch). The labels now read "Required Egg Move 1/2/3 (optional)". The output header changed to **"Outputs | Max Egg Moves | Egg Moves | Parent | Family"**.
- *Inference:* these Lab values do not react to the blank input. They are therefore stored values or point at another cell, which suggests the Breeding Lab is computed by a later script run (not in the visible Dec-15 script) rather than by live formulas. "BLANK" is not fully blank.

## 26. Untitled spreadsheet (Canon Builds export) — 1jMx5cz-xvKDYoDYrONYn-e6_NAqr5GIz-4DHkXZCwvA
- Created **2026-01-07T15:41:55Z**, modified 15:41:57Z, 3,666 B. One tab, **Canon Builds, A1:V54** (53 rows, 22 columns). **Fully visible.** This is the most complete roster document found: six protagonist teams, rival teams and **Danny's HeartGold team**. Verbatim copy in LINEAGE_ROSTERS.md §1. Its first 6 data rows are identical to main v3's Canon Builds, so it is evidently a Jan-7 copy/export of v3's Canon Builds tab.

---

## Other project-related items found
- **Apps Script "Untitled project"** — see DOC_Apps_Script_Untitled_project.md (full source).
- No Google Docs, PDFs, text/markdown files, "master prompt" or notes documents relating to the project exist in Drive. The only Pokémon Google Doc is "Pokemon League Bylaws" (owner allen.babb@gmail.com, 2020, fantasy-football league — ignored). Also ignored: "Open Roster" (dsanders877, 2019), "Moneyball Open Teams", "2024-Jan-02 Pokemon Go.png" (jmkelly0519). "Danny" full-text hits were all baseball files (not relevant); the only Pokémon "Danny" is in Canon Builds.

## Error / broken-state catalogue
| File | Location | Error |
|---|---|---|
| Untitled 1zmX6 (Dec 15 16:02) | MoveLists A2:L2 | #N/A ×12 |
| TeamDashboard_FeatureSheets.xlsx | FEATURE_TeamDashboard slots 1–12 + Defensive Matchups | #REF! everywhere (missing 'ROSTER - Crystal') |
| BuildStep2, LOCKED backup 2, backup 3 | ROSTER row 11 | Pokémon name present but pokemon_id/types/ability blank (lookup missing in that row) |
| PKMN: Working Additional Roster Sheets | ROSTER - FireRed B2/B3 | Game = Crystal / VG 4 on the FireRed tab |
| same | MoveLists | single shared helper shows the Crystal/Charizard list for every tab |
| v1 ENGINE WORKING | ROSTER A15 | slot label "5" missing |
| v1 | Breeding_Lab | notes misaligned; duplicate "required_egg_move" row |
| v2, v2 WORKING BACKUP, v3 backup, v3 BLANK, v3 | Pokemon_Egg_Groups_Clean row 2 | duplicated header row; C–E blank |
| v2, v2 WORKING BACKUP | Breeding_Lab | Pikachu→Pichu/no-eggs → Mime Jr donor (impossible) |
| v3 BLANK | Breeding_Lab | stale base_pokemon_id 66 + Machop egg list with blank target |
| v3 main | Breeding_Lab | Riolu target → max bundle size 0 |
| Canon Builds (Dec 19 and Jan 7) | names | "Wil-O-Wisp" (Dec 19), "Gyrados", "Venesaur" (Jan 7); Gen-4 spellings "AncientPower"/"ExtremeSpeed"/"U-Turn" differ from dataset names ("Ancient Power" seen in MoveLists) and would fail any exact-match legality check |
| No "Loading..." or #ERROR! values were seen in any visible sample. | | |
