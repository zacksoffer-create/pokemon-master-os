# Pokemon Master Spreadsheet v3: forensic audit findings (read-only)

- Target: "Pokemon Master Spreadsheet v3", ID `1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek`, owner zacksoffer@yahoo.com, created 2025-12-17T21:54:59Z, modified 2026-01-08T15:53:23Z, Drive fileSize 952,264.
- Audit date: 2026-10-19. Tools used: `read_file_content` (with includeComments=true), `get_file_metadata`, `search_files`. **No Drive file was created, modified, copied, shared, moved or trashed. `download_file_content` was not used.**
- Companion files in this folder: `v3_README.md`, `v3_Game_Map.md`, `v3_Canon_Builds.md`, `v3_Copy_of_Canon_Builds.md`, `v3_Canon_Breeding_Stock.md`, `v3_Breeding_Lab.md`, `v3_ROSTER_-_Template.md`, `v3_Natures_List.md`, `v3_Breeding_Requirements.md`, `v3_MoveLists.md`, `v3_AbilityLists.md`, `v3_REFERENCE_TABS.md`, and `raw/` (CSV extracts).

---

## 1. How the tools represent this spreadsheet

### 1.1 `read_file_content` (includeComments: true)
- The response is one text blob: `Context Type: corpus_document` / `## Table Context` / `### File Name`. **Each tab follows as a block**: `### Sheet Name: <tab>`, then `### Table Range: <A1 range>` (the detected data extent, not the sheet's grid size), then `### Table Sample Data` (a markdown table), then `### Table Columns` (per column, the range plus the same sample values as a comma list).
- Tabs appear in workbook order. All **23 expected tabs are present**, in this order: README, Game_Map, Species_Base_Pokemon, Pokemon_Master, Types_Master, Pokemon_Types_Clean, Moves_Master, Pokemon_Moves_Display, Move_Methods_Master, Abilities_Master, Pokemon_Abilities_Display, MoveLists, Canon Builds, Copy of Canon Builds, Canon Breeding Stock, ROSTER - Template, AbilityLists, Pokemon_Species, Base_Species_Map, Natures_List, Breeding_Lab, Pokemon_Egg_Groups_Clean, Breeding_Requirements. The tool gives no indication of whether any tab is hidden.
- **Truncation (rows):** for this file, every tab shows **only row 1 plus 6 more rows** (7 sheet rows), whatever its size. The markdown table's first line is an empty header; the real sheet row 1 is the first body row. The sample size depends on the overall size of the response, not on the tab. The Dec-19 backup copy, which has one fewer tab, showed 10 rows per tab. A small 1-tab file ("Untitled spreadsheet", 54 rows) was shown in full.
- **Truncation (cells):** any cell longer than about 40 characters is cut and ends with `...`. Examples: "Pokemon Master Spreadsheet - Roster Te...", "[merged] Breeding Lab (Option 2: Max E...", "Parent must hold Light Ball to produce...".
- **Merged cells** appear as `[merged]`. For a merged title, every covered cell is repeated as `[merged] <text>` (Breeding_Lab A1:F1). An empty merged block shows plain `[merged]` (ROSTER - Template A6:B7).
- **Values only.** Formulas are never shown, only their displayed results. Markdown special characters are escaped (`\_`, `\(`, `\[`).
- **Comments:** `### Comment Anchors: No anchored comments`. The file has no anchored comments.

### 1.2 `get_file_metadata` with `snippetVerbosity: MAX_ALLOWED`
- This returns a `contentSnippet` of **1,048,515 characters**. The harness saved it to disk because it exceeded the inline limit. The format is `# <Tab Name>` followed by a fenced CSV block of displayed values per tab, in workbook order.
- **The snippet stops at about 1 MB, partway through `Pokemon_Moves_Display`** (data row 19,853, `28,Sandslash,6,emerald,317,Rock `). As a result, README, Game_Map, Species_Base_Pokemon, Pokemon_Master, Types_Master, Pokemon_Types_Clean and Moves_Master were captured **in full**. Pokemon_Moves_Display was captured for its first 19,852 rows. **None of the remaining 15 tabs appear in the snippet.**
- The CSV rendering **drops blank rows**: README's blank rows are missing. Another file showed that it can also **drop blank cells**: in `Pokemon_Species_Core_Gen1_4`, `1,bulbasaur,1,1,0` is printed under a 6-column header. That would shift columns. For the 7 v3 tabs captured, every row had the full field count (verified), so no shift occurred there.

### 1.3 `search_files`
- Snippets in search results always start at the top of the file and are not centred on the query match.
- **Drive's full-text index covers only the start of this file.** `fullText contains 'Luxury Ball'` (Canon Builds) and `'Eligible Egg Moves'` (Breeding_Lab) do **not** match v3, although both strings are in it. Full-text search therefore cannot be used to probe v3's later tabs, and "v3 not found" for strings such as 'Gyrados' or 'Danny' tells us nothing about whether they are present.

---

## 2. Tab inventory and coverage

| # | Tab | Range (data extent) | Data rows | Coverage achieved |
|---|---|---|---|---|
| 1 | README | A1:A10 | 10 | COMPLETE (snippet) |
| 2 | Game_Map | A1:C8 | 7 | COMPLETE |
| 3 | Species_Base_Pokemon | A1:B494 | 493 | COMPLETE |
| 4 | Pokemon_Master | A1:E608 | 607 | COMPLETE |
| 5 | Types_Master | A1:D20 | 19 | COMPLETE |
| 6 | Pokemon_Types_Clean | A1:C891 | 890 | COMPLETE |
| 7 | Moves_Master | A1:D486 | 485 | COMPLETE |
| 8 | Pokemon_Moves_Display | A1:H485770 | 485,769 | 19,852 rows (4.1%) |
| 9 | Move_Methods_Master | A1:C12 | 11 | 6 rows |
| 10 | Abilities_Master | A1:E124 | 123 | 6 rows |
| 11 | Pokemon_Abilities_Display | A1:E1614 | 1,613 | 6 rows |
| 12 | MoveLists | A1:L73 | up to 72 | 6 rows |
| 13 | Canon Builds | A1:V54 | 53 | 6 rows in v3; 53 via the 2026-01-07 proxy file |
| 14 | Copy of Canon Builds | A1:V57 | 56 | 6 rows |
| 15 | Canon Breeding Stock | A1:H1 | 0 | COMPLETE (header only) |
| 16 | ROSTER - Template | A1:Q26 | - | rows 1-7 |
| 17 | AbilityLists | A1:L3 | 2 | COMPLETE |
| 18 | Pokemon_Species | A1:F494 | 493 | 6 rows |
| 19 | Base_Species_Map | A1:B494 | 493 | 6 rows |
| 20 | Natures_List | A1:A26 | 25 + blank A1 | rows 1-7 |
| 21 | Breeding_Lab | A1:H19 | - | rows 1-7 |
| 22 | Pokemon_Egg_Groups_Clean | A1:H1156 | 1,154 pairs + dup header | 6 rows |
| 23 | Breeding_Requirements | A1:E2 | 1 | COMPLETE, except the note text is cut off |

---

## 3. Related Drive files (context and lineage, all read-only)

| When (UTC) | File | ID | Relevance |
|---|---|---|---|
| 2025-12-15 06:20 | pokemon.csv, pokemon_species.csv, pokemon_moves.csv (8.3 MB), moves.csv, pokemon_move_methods.csv, pokemon_evolution.csv | e.g. `1X6DFuRvuvoVGxul9aH-U1fpumn-znd6J` (pokemon.csv) | Raw PokeAPI CSVs that the reference tabs were built from |
| 2025-12-15 16:29 | Pokemon_Roster_Template_BuildStep2_GSheetsVisible.xlsx (16.1 MB) and its converted Sheet | `1LE48iGney2unNsviY7OR7HatLEVkMxGX` | The "XLSX" the README tells you to import |
| 2025-12-15 to 12-16 | Pokemon Master (LOCKED ENGINE backup / backup 2 / backup 3), "Pokemon Master - Script Working Properly", v1, v1 (ENGINE WORKING DO NOT TOUCH), "PKMN - Working Egg Move and Ability" | various | Iteration history. The titles point to a fragile script or formula "engine" |
| 2025-12-16 to 12-17 | v2, v2 (ENGINE WORKING DO NOT TOUCH), v2 (WORKING BACKUP DO NOT TOUCH) | `1k_qgmd3vqP5RITR87r3yEV_DiVG25VyGRi85njtp34Y` (v2) | v2 was last modified at 21:54:41 on 12-17, and v3 was created 18 s later. v3 is most likely a copy of v2 |
| 2025-12-17 21:44 / 21:51 | Canon_Builds_Template.xlsx, Canon_Breeding_Stock_Template.xlsx | `1RZA5-yP0f3zGXa7Roc2aPkRsV6DJ2BB6`, `190CK2WIltEo_TyzqTzrE0EIRoPuGK5bj` | Header-only templates (19 columns for Canon Builds, ending in "Final Level") |
| 2025-12-19 04:14 | Pokemon Master Spreadsheet v3 (BACKUP ENGINE WORKING) | `1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg` | Earlier v3 state. Its sample showed 10 rows per tab, the ROSTER slot-table header, and Canon Builds at A1:S48 |
| 2025-12-19 04:48 | Pokemon Master Spreadsheet v3 BLANK | `1jZwIrnGQuz6QGyDkKgYil6QGZk_tMsoSF6KKNcvNY5s` | Not opened beyond its search snippet |
| **2026-01-07 15:41** | **"Untitled spreadsheet"**, single tab "Canon Builds", A1:V54 | `1jMx5cz-xvKDYoDYrONYn-e6_NAqr5GIz-4DHkXZCwvA` | **Full 54-row copy of Canon Builds.** Rows 2-7 are identical to v3. Used here as the proxy for v3 rows 8-54 |

---

## 4. Canon Builds and Copy of Canon Builds: data-quality analysis

**Sources:** v3 rows 2-7 are verified directly. Rows 8-54 come from the proxy (Untitled spreadsheet, 2026-01-07), because v3 rows 8-54 could not be seen. Anything changed in v3 after 2026-01-07 15:41 is not reflected.
**Basis of the checks:** (S) means checked against sheet data. (K) means checked against general Pokémon game knowledge only, because the relevant learnset or encounter rows are not visible in the sheet. Treat (K) items as strong leads to confirm, not as proven.

### 4.1 Row-by-row (Canon Builds)

Nickname, Build Status, Gender and Final Level are blank in **every** row. Shiny is blank everywhere except row 10.

| Row | Species (as written) | Game (raw) | Trainer | Src | Nature / Ability | Moves (1-4) / Primary / Defining | Item | EV / IV | Ball / Location / Lv | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Typhlosion | HeartGold | Player | v3 | Timid / Blaze | Flamethrower, Extrasensory, Eruption, Hidden Power (Grass) / Flamethrower / Extrasensory | Charcoal | 4 HP/252 SpA/252 Spe / 31x6 | Luxury Ball / New Bark Town / 5 | VG-text; IV31; HP-typed name not in Moves_Master (S); Luxury Ball impossible for Elm's starter, which comes in a Poké Ball (K); Extrasensory is a Cyndaquil egg move, impossible on a Lv 5 gift starter (K) |
| 3 | Tyranitar | HeartGold | Player | v3 | Adamant / Sand Stream | Earthquake, Dragon Dance, Crunch, Rock Slide / EQ / DD | Leftovers | "252 HP/ 252 Atk/4 Spe" (stray space) / 31x6 | Dusk Ball / Mt. Silver / 45 | VG-text; IV31; formatting; Dragon Dance is a Larvitar egg move, but the row records a wild Mt. Silver catch (K) |
| 4 | Mamoswine | HeartGold | Player | v3 | Adamant / Snow Cloak | Earthquake, AncientPower, Ice Fang, Hail / EQ / AncientPower | NeverMeltIce | 120 HP/252 Atk/136 Spe / 31x6 | Dive Ball / Ice Path / 33 | VG-text; IV31; "AncientPower" does not match Moves_Master "Ancient Power" (S) |
| 5 | Crobat | HeartGold | Player | v3 | Jolly / Inner Focus | Fly, U-Turn, Roost, Toxic / U-Turn / Toxic | Black Sludge | 252 HP/56 Atk/200 Spe / 31x6 | Net Ball / Dark Cave / 6 | VG-text; IV31; "U-Turn" vs "U-turn" is a case difference only (S) |
| 6 | Milotic | HeartGold | Player | v3 | Bold / Marvel Scale | Surf, Recover, Ice Beam, Toxic / Surf / Recover | Leftovers | 252 HP/252 Def/4 SpA / 31x6 | Heal Ball / **Mt. Coronet** / 10 | VG-text; IV31; **Mt. Coronet is in Sinnoh and not in HeartGold. Feebas cannot be caught in HGSS (K)** |
| 7 | Scizor | HeartGold | Player | v3 | Adamant / Technician | Bullet Punch, U-Turn, Bug Bite, Roost / BP / Roost | Life Orb | 248 HP/252 Atk/8 Spe / 31x6 | Fast Ball / National Park / 15 | VG-text; IV31; case-only "U-Turn" |
| 8 | Pikachu | SoulSilver | Player | proxy | Jolly / Static | Thunderbolt, Volt Tackle, Iron Tail, Quick Attack / TB / Volt Tackle | Light Ball | 4 HP/252 Atk/252 Spe / 31x6 | Poke Ball / Viridian Forest / 10 | VG-blank; IV31; **Volt Tackle needs Light Ball breeding in Gen 3-4, so a wild Viridian Forest Pikachu cannot have it.** This is confirmed by the sheet's own Breeding_Requirements row and by the absence of any Pikachu Volt Tackle row in version group 10 (S) |
| 9 | Lucario | SoulSilver | Player | proxy | Mild / Inner Focus | Aura Sphere, Close Combat, ExtremeSpeed, Vacuum Wave / AS / Vacuum Wave | Life Orb | 64 Atk/252 SpA/192 Spe / 31x6 | Moon Ball / **Iron Island (Egg)** / 1 | VG-blank; IV31; "ExtremeSpeed" does not match "Extreme Speed" (S); **Iron Island is a Sinnoh location, not in SoulSilver (K)**; Gen 4 eggs always hatch in a Poké Ball, so Moon Ball is impossible (K) |
| 10 | **Gyrados** | SoulSilver | Player | proxy | Adamant / Intimidate | Dragon Dance, Waterfall, Earthquake, Rest / Waterfall / Rest | Leftovers | 156 HP/108 Atk/100 Def/144 Spe / 31x6 | Lure Ball / Lake of Rage / 30 | **Misspelling of Gyarados**, so it will not match Pokemon_Master (S); VG-blank; IV31. Shiny=YES with Lake of Rage Lv 30 fits the red Gyarados event (K) |
| 11 | Gliscor | SoulSilver | Player | proxy | Impish / Sand Veil | Earthquake, Roost, Taunt, Toxic / EQ / Taunt | Leftovers | 252 HP/40 Atk/216 Spe / 31x6 | Ultra Ball / Route 45 / 22 | VG-blank; IV31; Gligar is believed to be HeartGold-exclusive in HGSS, which would make a SoulSilver Route 45 catch impossible (K, verify) |
| 12 | Gengar | SoulSilver | Player | proxy | Timid / Levitate | Shadow Ball, Focus Blast, Energy Ball, Destiny Bond / SB / Focus Blast | Life Orb | 4 HP/252 SpA/252 Spe / 31x6 | Dusk Ball / Sprout Tower / 8 | VG-blank; IV31; Levitate is correct for Gen 4 but may be missing from Pokemon_Abilities_Display if that tab uses current data (Gengar has had Cursed Body since Gen 7) (unverified) |
| 13 | Dragonite | SoulSilver | Player | proxy | Mild / Inner Focus | Draco Meteor, Fire Punch, Superpower, Roost / DM / Roost | Leftovers | 80 Atk/252 SpA/176 Spe / 31x6 | Premier Ball / Dragon's Den / 15 | VG-blank; IV31; Lv 15 at Dragon's Den matches the gift Dratini, which comes in a Poké Ball (soft flag, K) |
| 14 | Feraligatr | Crystal | Player | proxy | - | - | - | - | - | Stub (all build fields blank) |
| 15 | Miltank | Crystal | Player | proxy | - | - | - | - | - | Stub |
| 16 | Lapras | Crystal | Player | proxy | - | - | - | - | - | Stub |
| 17 | Donphan | Crystal | Player | proxy | - | - | - | - | - | Stub |
| 18 | Espeon | Crystal | Player | proxy | - | - | - | - | - | Stub |
| 19 | Umbreon | Crystal | Player | proxy | - | - | - | - | - | Stub |
| 20 | Charizard | FireRed | Player | proxy | - | - | - | - | - | Stub |
| 21 | Alakazam | FireRed | Player | proxy | - | - | - | - | - | Stub |
| 22 | Machamp | FireRed | Player | proxy | - | - | - | - | - | Stub |
| 23 | Snorlax | FireRed | Player | proxy | - | - | - | - | - | Stub |
| 24 | Blastoise | FireRed | Player | proxy | Bold / Torrent | Surf, Ice Beam, Rapid Spin, Toxic / Surf / Toxic | Leftovers | blank / blank | blank | VG-blank; only partly filled. All 4 moves are legal in FRLG (S: visible Pokemon_Moves_Display rows: Surf, Ice Beam and Toxic by Machine, Rapid Spin by Level Up at 25). No Gen 4 content |
| 25 | **Venesaur** | FireRed | Player | proxy | - | - | - | - | - | **Misspelling of Venusaur**; stub |
| 26 | Infernape | Platinum | Player | proxy | Naive / Blaze | Flamethrower, Close Combat, Grass Knot, U-Turn / FT / CC | Life Orb | 64 Atk/252 SpA/192 Spe / 31x6 | Poke Ball / Starter / 5 | VG-blank; IV31; case-only "U-Turn" |
| 27 | Garchomp | Platinum | Player | proxy | Jolly / Sand Veil | Earthquake, Outrage, Stone Edge, Fire Fang / EQ / Outrage | Life Orb | 4 HP/252 Atk/252 Spe / 31x6 | **Level Ball** / Wayward Cave / 15 | VG-blank; IV31; **Level Ball is an HGSS Apricorn ball and cannot be obtained in Platinum (K)** |
| 28 | Weavile | Platinum | Player | proxy | Jolly / Pressure | Ice Punch, Night Slash, Low Kick, Ice Shard / IP / Night Slash | Life Orb | 4 HP/252 Atk/252 Spe / 31x6 | Premier Ball / Route 217 / 34 | VG-blank; IV31; Ice Shard is a Sneasel egg move, but the row records a wild Route 217 catch (K) |
| 29 | Empoleon | Platinum | Player | proxy | Calm / Torrent | Surf, Ice Beam, Stealth Rock, Roar / Surf / Stealth Rock | Leftovers | 252 HP/4 Def/252 SpD / 31x6 | **Dive Ball** / Starter / 5 | VG-blank; IV31; **a starter comes in a Poké Ball (K); this is also a second Sinnoh starter on the same Platinum team as Infernape (K)** |
| 30 | Magnezone | Platinum | Player | proxy | Modest / Magnet Pull | Thunderbolt, Hidden Power (Fire), Flash Cannon, Substitute / TB / Sub | Leftovers | 36 HP/252 SpA/220 Spe / 31x6 | **Heavy Ball** / Route 222 / 40 | VG-blank; IV31; HP-typed name not in Moves_Master (S); **Heavy Ball is an HGSS Apricorn ball, not obtainable in Platinum (K)** |
| 31 | Roserade | Platinum | Player | proxy | "Timid␠" (trailing space) / Natural Cure | Leaf Storm, Sludge Bomb, Sleep Powder, Toxic Spikes / LS / Toxic Spikes | Focus Sash | 4 HP/252 SpA/252 Spe / 31x6 | Nest Ball / Route 212 / 14 | VG-blank; IV31; trailing whitespace (inferred from the tool's column sample); Leaf Storm and Sleep Powder are Budew/Roselia egg moves, but the row records a wild catch (K, verify) |
| 32 | Swampert | Emerald | Player | proxy | - | - | - | - | - | Stub |
| 33 | Metagross | Emerald | Player | proxy | - | - | - | - | - | Stub |
| 34 | Meganium | Emerald | Player | proxy | - | - | - | - | - | Stub |
| 35 | Altaria | Emerald | Player | proxy | - | - | - | - | - | Stub |
| 36 | Gardevoir | Emerald | Player | proxy | - | - | - | - | - | Stub |
| 37 | Arcanine | Emerald | Player | proxy | - | - | - | - | - | Stub |
| 38 | Nidoking | Crystal (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; Game label not in Game_Map |
| 39 | Kingdra | FireRed (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 40 | Houndoom | Emerald (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 41 | Salamence | Platinum (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label; **Version Group cell D41 contains a single space** (inferred from the tool's column sample) |
| 42 | Aerodactyl | SoulSilver (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 43 | Heracross | HeartGold (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 44 | Kabutops | Crystal (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 45 | Ursaring | Crystal (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 46 | Primeape | Crystal (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 47 | Ninetales | Crystal (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 48 | Sandslash | Crystal (RIVAL) | Rival | proxy | - | - | - | - | - | Stub; label |
| 49 | Raichu | HeartGold (Danny) | Danny | proxy | - | - | - | - | - | Stub; label |
| 50 | Torterra | HeartGold (Danny) | Danny | proxy | - | - | - | - | - | Stub; label |
| 51 | Combusken | HeartGold (Danny) | Danny | proxy | - | - | - | - | - | Stub; label |
| 52 | Breloom | HeartGold (Danny) | Danny | proxy | - | - | - | - | - | Stub; label |
| 53 | Flygon | HeartGold (Danny) | Danny | proxy | - | - | - | - | - | Stub; label |
| 54 | Buizel | HeartGold (Danny) | Danny | proxy | - | - | - | - | - | Stub; label |

Completeness: **19 of 53 rows have build data**. The 18 full builds are HeartGold 6, SoulSilver 6 and Platinum 6; FireRed Blastoise is partial. The remaining **34 rows are stubs** holding only species and game: Crystal 6, FireRed 5, Emerald 6, Rival 11, Danny 6.

### 4.2 Defect checks requested

| Check | Result |
|---|---|
| Ability that doesn't belong to the species | **Canon Builds: none.** All 19 abilities are legal Gen 3-4 abilities for their species (K). **Copy of Canon Builds: 2.** Lapras/Marvel Scale and Snorlax/Technician (rows 6-7). |
| Moves belonging to another species' build | **Canon Builds: none.** Every moveset fits its species. **Copy: rows 6-7 carry the whole Milotic and Scizor builds** under the Lapras and Snorlax labels. Recover, Bullet Punch, U-turn, Bug Bite and Roost are not learnable by Lapras or Snorlax (K). |
| Crystal (Gen 2) rows with Nature, Ability or IV/EV terms | **None in the data.** All 12 Crystal rows (player rows 14-19, rival rows 38 and 44-48) have blank Nature, Ability, EV Spread and IV Notes. Copy rows 8-57 were not visible. **Structural issue:** the schema itself (Nature, Ability, EV Spread, IV Notes, and Gen 3-4 ball types such as Dusk, Heal or Luxury) does not fit Gen 2, which uses DVs and Stat Exp and has no abilities or natures. Any Crystal build entered later would need different fields. The Natures_List dropdown should not apply to Crystal. |
| Gen 3 (FireRed/Emerald) rows with Gen 4-only moves or abilities | **None found.** The only populated Gen 3 row is FireRed Blastoise, whose moves (Surf, Ice Beam, Rapid Spin, Toxic), ability (Torrent) and item (Leftovers) are all Gen 1-3. Verified against the visible FRLG learnset rows. The other 11 player rows and the FireRed/Emerald rival rows are stubs. The Copy's rows 8-57 were not visible and might contain such moves. |
| Gen 4 moves in Gen 4 rows | Not a defect, listed for completeness: Close Combat, Ice Fang, Ice Shard, Roost, U-turn, Bullet Punch, Bug Bite, Stone Edge, Fire Fang, Flash Cannon, Aura Sphere, Vacuum Wave, Draco Meteor, Focus Blast, Energy Ball, Grass Knot, Night Slash, Stealth Rock, Leaf Storm and Toxic Spikes appear only in HeartGold, SoulSilver and Platinum rows. That is correct. |
| Misspellings | **"Gyrados"** (row 10, should be Gyarados) and **"Venesaur"** (row 25, should be Venusaur) break species lookups against Pokemon_Master (S). The Gen 4 in-game spellings **"AncientPower"** and **"ExtremeSpeed"** do not match Moves_Master's "Ancient Power" and "Extreme Speed" (S). **"Hidden Power (Grass)/(Fire)"** has no matching Moves_Master entry; only "Hidden Power" exists (S). **"U-Turn"** differs from "U-turn" by case only. It appears in 4 cells of Canon Builds (Crobat Move 2 and Primary Move, Scizor Move 2, Infernape Move 4) and is carried into the Copy. "Poke Ball" is used for "Poké Ball", including in the column header. Formatting slips: the stray space in "252 HP/ 252 Atk/4 Spe", "Timid␠" with a trailing space, and D41 holding a single space. Historical (Dec-19 backup only): "Wil-O-Wisp". |
| Perfect 31-IV placeholders | **All 18 rows that have an IV value use "31/31/31/31/31/31"** (HG 6, SS 6, Pt 6). For wild or gift Pokémon in Gen 3-4 this is practically impossible, so these are placeholders, not records. |
| Version group vs Game_Map | The "Version Group" column holds **"HeartGold" (a game label, not an ID)** in rows 2-7. Game_Map expects 10 / heartgold-soulsilver. Rows 8-54 are blank, and D41 is a single space. **17 "Game" values are not in Game_Map**: "Crystal (RIVAL)" x6, "FireRed (RIVAL)", "Emerald (RIVAL)", "Platinum (RIVAL)", "SoulSilver (RIVAL)", "HeartGold (RIVAL)", "HeartGold (Danny)" x6. The trainer is encoded inside the Game field. Game_Map's own IDs are correct PokeAPI version_group_ids. ROSTER - Template (B3=10) and Breeding_Lab (E3=10) are consistent with it. |
| EV legality | All 18 EV spreads total **508** and no stat exceeds 252, so all are legal (at most 510 total and 255 per stat). |
| Primary/Defining move coherence | In all 19 populated rows, the Primary and Defining moves are among the row's four moves. |
| Game-lore / obtainability (K) | Ball impossibilities: rows 2, 9, 27, 29, 30. Location not in that game: rows 6, 9. Egg move on a wild or gift Pokémon: rows 2, 3, 8, 28, 31. Multiple starters on one save: FireRed has Charizard, Blastoise and Venusaur; Platinum has Infernape and Empoleon, which needs trades. Possible version exclusive: row 11. |

### 4.3 Copy of Canon Builds: misalignment characterization

Facts (v3, verified):
- The range is `A1:V57`, against Canon Builds `A1:V54`. The Copy has **3 more rows**. The headers are identical.
- **Rows 2-5 are identical** to Canon Builds rows 2-5 in all 22 columns.
- **Rows 6-7: only column A differs.** Columns B-V are unchanged from Canon Builds rows 6-7.
- **Rows 8-57 were not visible.**

Reconstruction (rows that could be seen):

| Copy row | Label in column A | Data in B-V actually belongs to | Evidence |
|---|---|---|---|
| 2 | Typhlosion | Typhlosion | Identical to Canon Builds row 2 |
| 3 | Tyranitar | Tyranitar | Identical to row 3 |
| 4 | Mamoswine | Mamoswine | Identical to row 4 |
| 5 | Crobat | Crobat | Identical to row 5 |
| 6 | **Lapras** | **Milotic** (Canon Builds row 6) | Marvel Scale is Milotic's ability (Lapras has Water Absorb or Shell Armor); Recover is not in Lapras's movepool; Bold, Leftovers, 252 HP/252 Def/4 SpA, Heal Ball, Mt. Coronet and Lv 10 all match Milotic exactly |
| 7 | **Snorlax** | **Scizor** (Canon Builds row 7) | Technician is Scizor's ability (Snorlax has Immunity or Thick Fat); Bullet Punch, U-Turn, Bug Bite and Roost are Scizor moves; Life Orb, 248/252/8, Fast Ball, National Park and Lv 15 match Scizor exactly |
| 8-57 | NOT VISIBLE | unknown | - |

Characterization:
- **It is not a uniform vertical shift of the data block.** A shift of the whole block, or of column A alone from row 2, would misalign rows 2-5 as well, and those rows align exactly.
- **It is not a uniform shift of column A from row 6 either, at least against the proxy's ordering.** In the proxy, Lapras is at row 16 and Snorlax at row 23. Mapping A6 to Lapras needs an offset of 10; mapping A7 to Snorlax needs an offset of 16. No single offset explains both. Lapras is also listed under Crystal and Snorlax under FireRed in Canon Builds, yet in the Copy both carry Game = HeartGold.
- **Best description from the visible evidence: the column-A labels for rows 6 and 7 were replaced while B-V were left alone.** Rows 2-5 are untouched. The pattern fits a deliberate HeartGold roster revision (swapping Milotic and Scizor for Lapras and Snorlax, both of which can be caught in HGSS) in which only the species cell was changed. Milotic's recorded location, Mt. Coronet, cannot be visited in HeartGold, which would be a plausible reason for the swap, but that is speculation. It is equally consistent with a paste or sort applied to column A only. The visible data cannot tell these apart.
- **The offset size for rows 8-57 cannot be determined.** The 3 extra rows must have been inserted, or appended, somewhere in rows 8-57.

### 4.4 Rosters (6-Pokémon lineups)

Source: rows 2-7 come from v3; the rest from the 2026-01-07 proxy. "Player" means rows with no trainer suffix in Game.

| Game | Trainer | Lineup | Build status |
|---|---|---|---|
| HeartGold | Player | Typhlosion, Tyranitar, Mamoswine, Crobat, Milotic, Scizor | 6/6 full builds (v3-verified) |
| HeartGold | Player (Copy of Canon Builds variant) | Typhlosion, Tyranitar, Mamoswine, Crobat, **Lapras**, **Snorlax** | labels only; rows 6-7 still carry the Milotic and Scizor data |
| SoulSilver | Player | Pikachu, Lucario, Gyarados ("Gyrados"), Gliscor, Gengar, Dragonite | 6/6 full builds |
| Crystal | Player | Feraligatr, Miltank, Lapras, Donphan, Espeon, Umbreon | stubs |
| FireRed | Player | Charizard, Alakazam, Machamp, Snorlax, Blastoise, Venusaur ("Venesaur") | Blastoise partial; others stubs |
| Platinum | Player | Infernape, Garchomp, Weavile, Empoleon, Magnezone, Roserade | 6/6 full builds |
| Emerald | Player | Swampert, Metagross, Meganium, Altaria, Gardevoir, Arcanine | stubs |
| Crystal | Rival | Nidoking, Kabutops, Ursaring, Primeape, Ninetales, Sandslash (rows 38, 44-48) | stubs |
| FireRed | Rival | Kingdra (1 only) | stub |
| Emerald | Rival | Houndoom (1 only) | stub |
| Platinum | Rival | Salamence (1 only) | stub |
| SoulSilver | Rival | Aerodactyl (1 only) | stub |
| HeartGold | Rival | Heracross (1 only) | stub |
| HeartGold | Danny | Raichu, Torterra, Combusken, Breloom, Flygon, Buizel | stubs |

Rival structure: rows 38-43 assign **one rival Pokémon to each of 6 games** (Crystal, FireRed, Emerald, Platinum, SoulSilver, HeartGold). Rows 44-48 then add five more Crystal (RIVAL) entries. Only the Crystal rival has a complete 6. The other five games' rivals have one "ace" each. It is unclear whether rows 38-43 were meant as aces per game or are mislabelled. No other trainer names appear in the data besides Player, RIVAL and Danny. Danny's HeartGold team includes non-Johto Pokémon (Torterra, Buizel, Flygon, Breloom, Combusken). In real gameplay those would need trades, migration or Pal Park, which is plausible for a separate trainer.

---

## 5. Apps Script and automation evidence

| Evidence | Where | Strength |
|---|---|---|
| "If dropdowns do not appear after import, run the provided Apps Script to apply them." | README A10 (v3) | **Direct**: an Apps Script was provided to apply data validation |
| Helper tabs **MoveLists** ("Moves for row 11..16, 21..26") and **AbilityLists** ("Abilities for row 11..26") hold per-slot lists that change with the selected Pokémon. In the Dec-19 backup they held Typhlosion's lists; in v3 they hold Spoink/Grumpig lists | MoveLists, AbilityLists | Strong: the classic script pattern of writing per-row lists and pointing data validation at them. Formula-driven generation cannot be ruled out |
| ROSTER - Template computed columns (backup): Illegal?, Reason, prep_special_move, prep_non_default_..., Preparation Summary; Breeding_Lab computed outputs (max bundle size, Eligible Egg Moves, bundle and father rows) | ROSTER (backup file), Breeding_Lab | Strong evidence of an "engine" (formulas and/or script). The mechanism is not visible |
| Drive titles: "Pokemon Master - Script Working Properly", "... (ENGINE WORKING DO NOT TOUCH)", "LOCKED ENGINE backup", "(BACKUP ENGINE WORKING)" | Drive | Circumstantial: the user treated the script or engine as fragile and made snapshots |
| Custom function names, `onEdit`/`onOpen`, menu instructions, named ranges, data-validation rules | - | **Not visible.** None of the tools show formulas, so no custom functions can be seen. Menu items, triggers, named ranges, protected ranges and validation rules are not exposed. No visible cell text mentions onEdit or a custom menu |

**Cross-reference (not my work).** While this audit was running, a file I did not write appeared in this output folder: `DOC_Apps_Script_Untitled_project.md`, presumably from a parallel agent. It reports a Drive Apps Script project, "Untitled project" (ID `1ZnAgBDXzd1eP2EP_027u0pFPzo8E3-gaJ4-G-fqWh_rpruDnGmH2v-97`, created 2025-12-15 16:33:42Z, modified 2025-12-15 19:29:45Z), exported with `download_file_content`. My only check was `get_file_metadata`, which confirmed that the project exists, its MIME type is application/vnd.google-apps.script, the owner is zacksoffer@yahoo.com, and the timestamps are as stated. I did not read the code myself. According to that document:
- the project is a manually-run "formula installer" with no onEdit/onOpen trigger, no custom menu and no custom function;
- it writes data validation to `ROSTER - Template` rows 11-16 and 21-26;
- it writes SORT/UNIQUE/FILTER formulas into MoveLists and AbilityLists, which fits the "Moves for row N" headers seen here;
- it builds Base_Species_Map by walking evolves_from down to the root species (for example Pikachu to Pichu, 172).

The project dates from Dec 15 and was created 37 s after the BuildStep2 sheet, so it predates v3 (created Dec 17). **It is therefore not necessarily the code bound to v3.**

**The Apps Script project bound to v3 itself is not visible through the three tools used here.** Neither `read_file_content`, `get_file_metadata` nor `search_files` exposes container-bound script projects, triggers or project files. Whether a script is still attached to v3, what it does, and whether it uses onEdit triggers cannot be determined here. To inspect it: in Sheets, open Extensions → Apps Script. Check Data → Named ranges and Data → Data validation for the rest.

---

## 6. Reference-data provenance (summary; details in v3_REFERENCE_TABS.md)

- **Source:** the PokeAPI CSV dump (veekun lineage). The ID schemes and column names match exactly, and the raw files are in Zack's Drive (pokemon.csv, pokemon_species.csv, pokemon_moves.csv, moves.csv, pokemon_move_methods.csv, pokemon_evolution.csv, uploaded 2025-12-15).
- **Snapshot:** about 2021. The Drive pokemon.csv ends at species 898 and form 10194, and Pokemon_Moves_Display's highest version group is 20 (sword-shield).
- **Filters:** species ≤ 493, moves and abilities with generation ≤ 4, types with generation ≤ 4. **Version groups were not filtered (1-20)**, but later-gen moves are excluded, so the version group 11-20 learnsets are incomplete.
- **Key defects:**
  - 114 alternate forms, including Megas, Alolan and Galarian forms, carry `introduced_gen` 1-4.
  - Removing Fairy left Clefairy, Clefable, Cleffa, Togepi, Snubbull and Granbull with no type, and Togetic and Togekiss with only "Flying" in slot 2.
  - Rotom forms have Gen 5+ typings.
  - Display names are generated from keys ("Mr Mime", "Ho Oh", "Giratina Altered").
  - Move names are modern, so Canon Builds' Gen 4 spellings do not match.
  - Pokemon_Egg_Groups_Clean repeats its header in row 2, and its columns C-E are blank.
  - Species_Base_Pokemon is a pure identity map, and its "base_pokemon_id" name clashes with the breeding-base meaning used elsewhere.
  - Baby and incense pre-evolutions are generation-insensitive, and there are no incense breeding requirements.
  - Ability data is probably current-gen (hidden abilities, Gengar), but that is unverified.
- **Natures_List** is not from PokeAPI: it follows the in-game nature index order.

---

## 7. What could NOT be seen or verified

1. **v3 Canon Builds rows 8-54.** The analysis uses the proxy file from 2026-01-07, which may differ from v3's final state on 2026-01-08.
2. **v3 Copy of Canon Builds rows 8-57**, which is all of the misaligned region beyond row 7, including the 3 extra rows. No proxy exists.
3. MoveLists rows 8-73 (30 rows were requested), ROSTER - Template rows 8-26, Breeding_Lab rows 8-19 and its full title, Natures_List rows 8-26, and the full Breeding_Requirements note.
4. Reference tabs after the snippet cut-off are known only from 6-row samples: Move_Methods_Master, Abilities_Master, Pokemon_Abilities_Display, Pokemon_Species, Base_Species_Map, Pokemon_Egg_Groups_Clean. Pokemon_Moves_Display rows 19,854-485,770 were not seen, including all of version groups 4/6/7/9/10 for pokemon_id 29 and above, and all form rows.
5. **Formulas** (only values are shown), data validation rules, named ranges, protected ranges, conditional formatting, hidden tab/row/column state, exact merged-cell extents, version history, and **any bound Apps Script code or triggers**.
6. Items marked (K) were checked against general game knowledge, not sheet data, because the relevant learnset and encounter rows were not visible. These are: egg-move sources, version exclusives, ball availability, encounter locations, and starter rules. Only Pikachu/Volt Tackle and Blastoise's FRLG moves were verified against sheet rows.
7. Whether the `Timid␠` and D41-space whitespace findings are exact. They were inferred from the tool's comma-joined column samples.

### How the missing data could be obtained (not attempted)
- **Easiest:** Zack opens v3, makes a tab active, and uses File → Download → CSV (current sheet), for Canon Builds, Copy of Canon Builds, MoveLists, ROSTER - Template, Breeding_Lab, Natures_List and Breeding_Requirements. Alternatively, copy just those tabs into a small separate spreadsheet, which `read_file_content` shows in full, as the 2026-01-07 "Untitled spreadsheet" demonstrates.
- `download_file_content` with an xlsx export was **not used**, as instructed. It would probably also exceed Drive's export size limit: the 485,769-row tab makes the workbook very large, and the predecessor .xlsx is 16.1 MB.
- For the script: Extensions → Apps Script in the v3 file, then copy the project files.
