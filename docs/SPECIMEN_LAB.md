# Specimen Lab & Team Workbench (v1, 2026-10-19)

**Zack's direction (D-031):** the project is a lab and workbench for building these teams, and for building each individual Pokémon, both as a battler and as breeding stock. *"Whatever values and levers we can change in [PKHeX], I want to be able to do that in this project… everything is known for Gen 1–4… you can see how it would affect stuff, like what IVs and EVs and natures lead to what descriptions… and everything then goes into PKHeX so it's real."*

**Design rule:** **PKHeX parity per generation.** Every field PKHeX can edit for that generation's Pokémon is a field in the Specimen record. Every field the game *derives* is computed and explained, never typed in. Validity is learnability (D-024) plus recorded exceptions (e.g. D-028).

## 1. What PKHeX can edit, per generation (from PKHeX.Core source)

| Gen | PKHeX class | Settable fields | Highlights |
|---|---|---|---|
| 4 (Platinum, HGSS) | `PK4` + `G4PKM` | 191 | PID, TID/SID, nature (from PID), ability, IVs, EVs, moves + PP + PP Ups, held item, friendship, **ball** (DPPt + HGSS fields), met/egg location + date + level, OT name/gender, language, contest stats + sheen, ~80 ribbons, markings, Pokérus, form, **HGSS Shiny Leaves**, walking mood, ball capsule, fateful encounter |
| 3 (FireRed, Emerald) | `PK3` | 91 | PID, TID/SID, **ability bit**, IVs, EVs, moves + PP Ups, held item, friendship, ball, met location + level, OT, contest stats + sheen, ribbons, markings, Pokérus, mail |
| 2 (Crystal) | `PK2` + `GBPKM` | 67 listed: 8 are placeholders that store nothing, 4 are aliases for the single Special stat | species, held item, moves + PP Ups, **DVs** (one 16-bit value), **Stat Exp**, friendship, Pokérus, Crystal caught data (time of day, met level, location, OT gender), OT name, nickname |

**Gen 2 traps (PKHeX source confirms):** `Ball`, `Nature`, `Ability`, `PID`, `SID` are placeholders (`get => 0; set { }`). **A Crystal Pokémon has no stored Poké Ball**, so its ball is story-only. Gender isn't stored: *"derived via IVs"*. Shininess comes from the DVs.

## 2. What the game derives, and the lab explains

| Mechanic | Gen 2 | Gen 3 | Gen 4 |
|---|---|---|---|
| Nature | — | PID % 25 | PID % 25 |
| Gender | Attack DV vs ratio (e.g. 87.5%-male species: female only if Atk DV ≤ 1) | PID low byte vs ratio | PID low byte vs ratio |
| Ability slot | — | ability bit (= PID & 1 for wild) | PID & 1 |
| Shiny | DVs: Def = Spe = Spc = 10, Atk ∈ {2,3,6,7,10,11,14,15} | (TID ⊕ SID ⊕ PID halves) < 8 | same |
| HP DV / IV | from the low bits of the other four DVs | stored | stored |
| Hidden Power | from DVs (shinies are always Grass or Dragon) | from IV low bits | same |
| Summary text: characteristic | — | — | highest IV × (IV mod 5), ties broken from PID % 6, e.g. "Proud of its power" |
| Nature flavor | — | likes/dislikes (Pokéblocks) | likes/dislikes (Poffins) |
| Stats | (Base + DV)·2 + √StatExp/4 | (2·Base + IV + EV/4) × nature | same |
| Base stats | **era values** (e.g. Ampharos Def 75, not 85) | era values (Alakazam SpD 85) | era values (Roserade Def 55) |

**Interactions this surfaces (all verified in the demo run):**
- A shiny Gen 2 Feraligatr can't have perfect DVs and can never be female.
- In Gen 3–4, nature, gender, ability and shininess are **one choice, not four**. The lab finds a PID satisfying all of them at once.
- Typhlosion with Timid has 93 Atk vs 161 SpA at Lv 50, which is the Q4 nature question in numbers.

## 3. Into PKHeX: two exports per Specimen

1. **Showdown set** → PKHeX *Import Showdown set from clipboard*. Carries species, nickname, gender, item, ability, level, shiny, friendship, EVs, nature, IVs, moves.
2. **PKHeX Batch Editor script** (Tools → Batch Editor). Carries everything else using PKHeX's own property names: `=Species=157` targets the Pokémon, and `.PID=…`, `.Ball=11`, `.MetLevel=5`, `.OriginalTrainerName=ZACK`, `.ContestBeauty=…`, `.DV16=…` (Gen 2), `.HeldItem=<gen-specific index>` set fields. Syntax verified against `StringInstruction.cs`; ball IDs from PKHeX's `Ball` enum; item indices from PokeAPI's per-generation table.

**Later (Phase 3):** write `.pk2/.pk3/.pk4` files directly, so a Specimen becomes one file you drag into PKHeX. The formats are fully documented in PKHeX.Core.

## 4. Records (adds to `APP_PRODUCT_SPEC` §4)

- **Specimen**: one individual at PKHeX parity, with a gen-specific schema. Links: Companion (the story) · Build (the battle plan) · BreedingPlan (where its moves came from) · Instance (the copy in a save).
- **Breeding stock**: Specimens kept as parents (e.g. the father that teaches Extrasensory), with the moves, gender, IVs and nature that matter for passing things on.
- **Team workbench**: a team = six Specimens + its field-function matrix + the type pairing table + the playbook (which tool each member holds) + open questions.

## 5. Status

- `engine/specimen.py`: **working kernel** for Gen 2/3/4 derivations, PID search, learnability gate with exceptions, Showdown + Batch Editor export.
- **Not yet:** met-location IDs, ribbons and contest UI, Pokérus rules, `.pk` file writing, the 30 characteristic phrases shown as a picker, the Gen 3/4 PID-IV encounter methods (story notes only, under D-024), and a check in PKHeX itself (needs a round trip on your machine).
