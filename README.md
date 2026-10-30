# Pokémon Master Project

Zack's six-chapter Pokémon journey: canon, companions, breeding, and the app that will hold them.

**Start here:** `docs/PROJECT_CHARTER.md` → `docs/ARCHITECTURE.md` → `docs/CANON_CURRENT.md` → `docs/QUESTIONS_AND_EXPERIMENTS.md`.

| Doc | What it holds |
|---|---|
| `docs/ARCHITECTURE.md` | the engine map: what each engine answers, status, build order |
| `docs/PROJECT_CHARTER.md` | philosophy, the six chapters, authority rules, field-function policy, working agreement |
| `docs/CANON_CURRENT.md` | current rosters, status, move status per member, historical versions |
| `docs/DECISION_LEDGER.md` | append-only decisions (D-###) and recorded evidence (E-###) |
| `docs/MECHANICS_FINDINGS_2026-10-19.md` | verified move/HM/breeding/acquisition facts with sources |
| `docs/LEGACY_DATA_AUDIT.md` | the Drive spreadsheets and Apps Script: what works, what's broken, how to migrate |
| `docs/POKEMON_DATA_SOURCES.md` | pinned datasets, source hierarchy, known gaps |
| `docs/APP_PRODUCT_SPEC.md` | product vision, data model, architecture options, PKHeX bridge, roadmap |
| `docs/FIELD_FUNCTIONS.md` | every game's HM/field coverage, gaps and decisions F1–F4 |
| `docs/SPECIMEN_LAB.md` | the individual-Pokémon lab at PKHeX parity: fields per gen, derived mechanics, exports |
| `docs/QUESTIONS_AND_EXPERIMENTS.md` | open decisions, research queue, SoulSilver pair/trio audit |

`engine/`: the engines (see `docs/ARCHITECTURE.md`).
- `fetch_reference.py` + `refdb.py`: pinned reference data → SQLite
- `rules.py`: generation rules
- `team.py`: the shared team model
- `specimen.py`, `battle/`, `breeding/`, `wilderness/`, `workbench.py`: the engines
- `tests/`: 14 regression tests
- `canon_checks.py`, `legacy_audit.py`: the audit scripts from day one

```
python3 -I engine/fetch_reference.py
cd engine/battle && npm ci && node dump_gen_data.mjs ../data_battle
cd engine && python3 -I -m unittest discover -s tests -v
```

**Never modified:** any original Google Drive file (all legacy access was read-only).

---

**Also in this repo:** `lifeos/`, the LIFE OS Living World Laboratory (a separate project; start at `lifeos/README.md`).
