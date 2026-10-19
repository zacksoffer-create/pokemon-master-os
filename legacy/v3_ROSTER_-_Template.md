# v3 tab extract: ROSTER - Template

- Source: "Pokemon Master Spreadsheet v3" (`1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek`)
- Tab name contains spaces and a hyphen; the file name uses underscores.
- Detected range: `A1:Q26` (17 columns, 26 rows)
- Coverage: PARTIAL. Only rows 1-7 were visible in v3. Rows 8-26, which include the slot table, were NOT visible.
- Cells marked `[merged]` are the tool's notation for merged cells. Columns C-Q are blank in every visible row.

## v3 visible rows (verbatim; columns C-Q blank in rows 1-7)

| Row | A | B | C..Q |
|---|---|---|---|
| 1 | Team Name |  | *(blank)* |
| 2 | Game | HeartGold | *(blank)* |
| 3 | Version Group ID | 10 | *(blank)* |
| 4 |  |  | *(blank)* |
| 5 | Team Identity Notes |  | *(blank)* |
| 6 | [merged] | [merged] | *(blank)* |
| 7 | [merged] | [merged] | *(blank)* |
| 8-26 | NOT VISIBLE | | |

## Structure from another file (NOT v3)
"Pokemon Master Spreadsheet v3 (BACKUP ENGINE WORKING)" (`1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg`, 2025-12-19) has the same range, A1:Q26, and showed 10 rows. Rows 1-7 match v3. The others were:
- Row 8: `[merged] | [merged]` (the notes block continues through A6:B8)
- Row 9: blank
- Row 10, the slot table header (verbatim, with the truncation applied by the tool):

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Slot | Pokémon | pokemon_id | Primary Type | Secondary Type | Ability | Move 1 | Move 2 | Move 3 | Move 4 | Illegal? | Reason | base_pokemon_id | prep_special_move | prep_non_default_... | Nature | Preparation Summary |

Combined with the MoveLists and AbilityLists headers ("for row 11..16, 21..26"), this suggests slot rows 11-16 and a second 6-row block at 21-26. That is inferred, not seen in v3.

## Observations
- The README says: "Set Game in B2. Pick Pokemon in column B. Pick moves in Move 1-4." The default Game is HeartGold.
- B3 = 10 matches Game_Map (HeartGold -> 10). It is probably a lookup formula, but the tool shows values only, so this cannot be confirmed.
- The (backup) columns Illegal?, Reason, prep_special_move, prep_non_default_..., and Preparation Summary point to computed legality and breeding-preparation logic. Those computations were not visible.
