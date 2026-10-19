# Pokémon Data Sources: what the engine trusts, and in what order

**Status:** verified reachable from Claude Code on 2026-10-19 (fetch log + SHA-256 in `engine/data_manifest/`).
**Principle:** reference facts come from versioned datasets, never from an LLM's memory. Today's audit caught my own recall being wrong once (Crystal Mareep); the ROM data settled it.

## Source hierarchy (for Gen I–IV)

| Rank | Source | Coverage | License | Role |
|---|---|---|---|---|
| 1 | **pret disassemblies**: `pokecrystal`, `pokefirered`, `pokeemerald` (complete); `pokeplatinum`, `pokeheartgold` (decomps in progress) | The games' own tables: wild encounters, egg moves, level-up learnsets, tutors, TM compatibility, gift/trade NPCs | No formal license (reverse-engineered; fine for personal reference) | **Tie-breaker** for Gen 2–3; Gen 4 where decomp coverage allows |
| 2 | **PKHeX** (`kwsch/PKHeX`, PKHeX.Core) | The most complete legality knowledge in existence: encounter DB incl. gifts/events, PID/IV methods, met locations, ball legality, egg rules per generation | GPLv3 | **The materializer** (D-024): Builds go into saves via Showdown import. Its legality verdict is optional information and never gates canon. Its encounter DB remains the best reference for gift and event facts |
| 3 | **PokeAPI CSV dataset** (`PokeAPI/pokeapi/data/v2/csv`) | Learnsets by *version group* and method, egg groups, gender ratios, encounters, machines, past abilities/types, flavor text, stats | BSD-style (attribution) | **Primary query engine** (`engine/refdb.py`): fast, structured, version-group granular |
| 4 | **Pokémon Showdown** `data/learnsets.ts` | Learnsets by generation with source codes (`4E`, `4T`, `4L28`, `3S0` events) | MIT | **Independent cross-check**, plus the Showdown set format PKHeX imports |

The live `pokeapi.co` REST API is **blocked** by this environment's network policy and isn't needed: the CSV dataset behind it is reachable on raw GitHub and is better for reproducible builds anyway.

## Known gaps (verified today)

| Gap | Example | Mitigation |
|---|---|---|
| Gift/static encounters with special moves aren't in learnset tables | Dragon's Den Dratini + ExtremeSpeed (HGSS) | PKHeX encounter DB; pret data |
| Story-mandatory HM requirements aren't encoded anywhere | "Is Waterfall required to reach the Platinum League?" | Hand-curated `field_requirements.yaml` per game, each row with a cited source |
| PokeAPI's evolution table mixes eras | Magnezone via Thunder Stone, Milotic via Prism Scale (Gen 5+) | Filter evolutions by era in the build |
| Gen 2 has no natures/abilities; Gen 3–4 natures couple to IVs via PID for non-egg encounters | 6×31 + Timid starter may be impossible | Era-specific build schemas; PKHeX verdict for any concrete specimen |
| PokeAPI encounter coverage varies by game | Crystal: 3,183 rows / 170 species | Cross-check with pret wild tables |

## Build pipeline (replaces manual downloading)

```
pinned source manifest (repo URL + path + SHA-256 + fetch time)
   → fetch raw files  (idempotent, cached)
   → build SQLite (dev) + compact JSON per version group (app)  — Gen I–IV only
   → run canon regression checks (engine/canon_checks.py)
   → diff report vs previous build ("what changed in the reference data?")
```

- Gen I–IV learnsets: **194,451 rows** (108,189 for the five version groups the six chapters use). As compact JSON that's a few MB; it loads instantly in a browser. In a Google Sheet it's 1.36M cells, under the 10M cap but slow under FILTER/QUERY formulas, which is the main performance threat in the v3 workbook.
- A refresh **never touches canon**: canon lives in a separate directory, and a test fails if a reference build modifies any canon file.
- Offline: the built data is static. Nothing in the app needs a network call at runtime.

## Sprites and art

PokeAPI's sprite repo and `pokesprite` (MIT code; the images themselves are Nintendo/Game Freak IP) are fine for a private, non-commercial personal app. Keep sprites as *species* art, visually distinct from any portrait or story of an individual companion.
