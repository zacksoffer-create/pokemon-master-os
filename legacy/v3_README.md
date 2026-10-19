# v3 tab extract: README

- Source file: "Pokemon Master Spreadsheet v3", ID `1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek` (Drive modifiedTime 2026-01-08T15:53:23.790Z)
- Extracted: 2026-10-19, read-only.
- Detected range (read_file_content): `A1:A10`
- Coverage: COMPLETE. The full text came from `get_file_metadata` (snippetVerbosity=MAX_ALLOWED), which renders each tab as CSV. `read_file_content` truncates each cell at about 40 characters.
- The CSV snippet drops blank rows. Row positions below come from `read_file_content` (and from the Dec-19 backup copy, which showed all 10 rows). A2, A4 and A9 are blank.

## Verbatim cell text (snippet rendering, complete)

| Row | A |
|---|---|
| 1 | Pokemon Master Spreadsheet - Roster Template (Google Sheets friendly) |
| 2 | *(blank)* |
| 3 | Tabs are intentionally kept visible so Google Sheets import keeps them. |
| 4 | *(blank)* |
| 5 | Workflow: |
| 6 | 1) Import this XLSX into Google Sheets. |
| 7 | 2) Duplicate 'ROSTER - Template' for each run. |
| 8 | 3) Set Game in B2. Pick Pokemon in column B. Pick moves in Move 1-4. |
| 9 | *(blank)* |
| 10 | If dropdowns do not appear after import, run the provided Apps Script to apply them. |

Raw snippet block, exactly as returned:

```
Pokemon Master Spreadsheet - Roster Template (Google Sheets friendly)
Tabs are intentionally kept visible so Google Sheets import keeps them.
Workflow:
1) Import this XLSX into Google Sheets.
2) Duplicate 'ROSTER - Template' for each run.
3) Set Game in B2. Pick Pokemon in column B. Pick moves in Move 1-4.
If dropdowns do not appear after import, run the provided Apps Script to apply them.
```

## read_file_content rendering (cells truncated by the tool)

| A |
|---|
| Pokemon Master Spreadsheet - Roster Te... |
|  |
| Tabs are intentionally kept visible so... |
|  |
| Workflow: |
| 1) Import this XLSX into Google Sheets. |
| 2) Duplicate 'ROSTER - Template' for e... |

## Notes
- Row 10 is direct evidence that an Apps Script was used to apply the dropdowns. The script code cannot be seen with these tools.
- "Import this XLSX" means the workbook started as an .xlsx file that was generated outside Sheets and then imported.
