# v3 tab extract: Breeding_Lab

- Source: "Pokemon Master Spreadsheet v3" (`1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek`)
- Detected range: `A1:H19` (8 columns, 19 rows)
- Coverage: PARTIAL. Only rows 1-7 were visible. The tool also cut off the merged title in A1:F1 at about 40 characters. Rows 8-19 were NOT visible in v3.

## v3 visible rows (verbatim)

| Row | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| 1 | [merged] Breeding Lab (Option 2: Max E... | [merged] Breeding Lab (Option 2: Max E... | [merged] Breeding Lab (Option 2: Max E... | [merged] Breeding Lab (Option 2: Max E... | [merged] Breeding Lab (Option 2: Max E... | [merged] Breeding Lab (Option 2: Max E... |  |  |
| 2 |  |  |  |  |  |  |  |  |
| 3 | Game | HeartGold |  | version_group_id | 10 |  |  |  |
| 4 | Target Pokémon | Riolu |  | base_pokemon_id | 447 |  |  |  |
| 5 | Required Egg Move 1 (optional) | Vacuum Wave |  | max bundle size | 0 |  |  | Eligible Egg Moves |
| 6 | Required Egg Move 2 (optional) | Cross Chop |  |  |  |  |  | Agility |
| 7 | Required Egg Move 3 (optional) |  |  |  |  |  |  | Bite |
| 8-19 | NOT VISIBLE | | | | | | | |

The title text after "Option 2: Max E" was cut off by the tool and is unknown. It is not guessed here.

## Earlier state, from another file (NOT v3)
"Pokemon Master Spreadsheet v3 (BACKUP ENGINE WORKING)" (`1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg`, 2025-12-19), rows 1-10 (with the tool's own truncations):

| Row | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| 3 | Game | HeartGold |  | version_group_id | 10 |  |  |  |
| 4 | Target Pokémon | Bulbasaur |  | base_pokemon_id | 1 |  |  |  |
| 5 | Required Egg Move... | Magical Leaf |  | max bundle size | 3 |  |  | Eligible Egg Moves |
| 6 | Required Egg Move... | Leaf Storm |  |  |  |  |  | Amnesia |
| 7 | Required Egg Move... |  |  |  |  |  |  | Charm |
| 8 | Outputs |  |  |  |  |  |  | Curse |
| 9 | 1 | 3 | Leaf Storm, Magic... | Bellossom | plant |  |  | Grass Whistle |
| 10 |  |  |  |  |  |  |  | Ingrain |

From this, the outputs area (row 8 onward in the backup) lists, for each "bundle", a number, a count, the egg moves covered, a candidate father species, and the shared egg group.

## Observations
- base_pokemon_id 447 = Riolu and version_group_id 10 = HGSS are both consistent with the reference tabs.
- Vacuum Wave and Cross Chop are Riolu egg moves in Gen 4 (general game knowledge). This ties in with the SoulSilver Lucario build in Canon Builds, which has Vacuum Wave and an "Iron Island (Egg)" origin.
- "max bundle size = 0" in v3, against 3 in the backup. It is a computed value; its exact meaning was not visible. One plausible reading is that no single father species can pass both required moves at once (no common father for Vacuum Wave and Cross Chop), but that is not verified.
- E3, E4, E5 and the column-H "Eligible Egg Moves" list are almost certainly computed by formulas or a script. Only values are visible.
