# Pokémon Master Project

Zack's six-chapter Pokémon journey: canon, companions, breeding, and the app that will hold them.

**Start here:** `docs/PROJECT_CHARTER.md` → `docs/CANON_CURRENT.md` → `docs/QUESTIONS_AND_EXPERIMENTS.md`.

| Doc | What it holds |
|---|---|
| `docs/PROJECT_CHARTER.md` | philosophy, the six chapters, authority rules, field-function policy, working agreement |
| `docs/CANON_CURRENT.md` | current rosters, status, move status per member, historical versions |
| `docs/DECISION_LEDGER.md` | append-only decisions (D-###) and recorded evidence (E-###) |
| `docs/MECHANICS_FINDINGS_2026-10-19.md` | verified move/HM/breeding/acquisition facts with sources |
| `docs/LEGACY_DATA_AUDIT.md` | the Drive spreadsheets and Apps Script: what works, what's broken, how to migrate |
| `docs/POKEMON_DATA_SOURCES.md` | pinned datasets, source hierarchy, known gaps |
| `docs/APP_PRODUCT_SPEC.md` | product vision, data model, architecture options, PKHeX bridge, roadmap |
| `docs/QUESTIONS_AND_EXPERIMENTS.md` | open decisions (Q1–Q4), research queue, SoulSilver pair/trio audit |

`engine/`: reference-data prototype. `refdb.py` builds a SQLite DB from pinned PokeAPI CSVs and answers learnset, breeding-chain, ability, HM and encounter queries per version group. `canon_checks.py` is the first regression suite over canon claims.

```
python3 -I engine/refdb.py <raw_csv_dir> <db.sqlite>
python3 -I engine/canon_checks.py engine <db.sqlite>
```

**Never modified:** any original Google Drive file (all legacy access was read-only).
