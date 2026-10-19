# Architecture: engines first (v1, 2026-10-19)

**Zack's direction:** stay zoomed out; get the most important engines working first, because a strong foundation makes everything after it easy. The three pillars are **breeding**, **battle**, and **wilderness/survival**.

## The shape

```
                          WORKBENCH  (Team Lab / Decision Lab)
            run every engine on a team · swap one member, see what changes everywhere
                 │                         │                          │
         BREEDING ENGINE            BATTLE ENGINE              WILDERNESS ENGINE
         lineage · stock         coverage · strategy        field · survival · world
                 │                         │                          │
        ─────────────── SPECIMEN ENGINE (one individual at PKHeX parity) ───────────────
        ─────────────── RULES BY GENERATION (Gen 2 / 3 / 4 mechanics) ──────────────────
        ─────────────── REFERENCE DATA (pinned PokeAPI · Smogon · ROM data) ────────────
   side rails:   CANON STORE (Drive/Sheets: decisions, companions, authored world)
                 PKHeX BRIDGE (Showdown set + Batch Editor script; .pk files later)
```

**Shared contracts every engine obeys:**
1. **One team model** (`team.py`): a `Team` is a game plus `Member`s. A Member is a species plus whatever is known about the individual. Anything left blank is judged from what the species *can* do in that game.
2. **One validity gate:** learnability (D-024), plus exceptions recorded as decisions (D-028).
3. **Era-correct everything:** type chart, physical/special split, abilities and base stats as they were in that game's generation.
4. **Evidence is tiered, never blended:** `authored` (your approved world) > `cartridge` (the game proves it) > `lore` (its Pokédex says so, quoted) > `inference` (type, size, habitat).
5. **Engines don't know canon.** They analyze *any* team, and canon feeds them from the side. A data refresh can never change a decision.

## The engines

| Engine | Question it answers | Built on | Status |
|---|---|---|---|
| **Reference data** (`fetch_reference.py`, `refdb.py`) | species, moves, learnsets, egg groups, encounters, Pokédex text, era stats | PokeAPI CSVs + Smogon learnsets, pinned with SHA-256 | **running**: one command rebuilds everything in ~15 s |
| **Rules** (`rules.py`, `data_battle/`) | how this generation works | Smogon's per-gen data (`@smogon/calc` 0.12.0) | **running** |
| **Specimen** (`specimen.py`) | one individual at PKHeX parity: stats, PID/DV derivations, Hidden Power, characteristic; Showdown + Batch Editor export | PKHeX.Core source, PokeAPI | **running** (Gen 2/3/4) |
| **Battle** (`battle/engine.py`) | how it defends, what it hits (with the right stat for the era), who walls it, speed and priority, which playbook tools it has, exact damage | rules + Smogon damage calculator | **running** |
| **Breeding** (`breeding/engine.py`) | egg moves, shortest chains, one-egg bundles, line feasibility (male-only, genderless, incense), ranch stock (one father, many targets) | reference + Gen 2–4 inheritance rules | **running** |
| **Wilderness** (`wilderness/engine.py`) | 26 world capabilities in 7 domains (movement, environment, sustenance, shelter, safety, labor, social); readiness for 7 situations (mountain storm, open sea, a week at camp, cave expedition, emergency, night travel, town life) | field moves + overworld abilities per game, Pokédex text, size/type/habitat | **running** (framework). It becomes the authored world as you approve things |
| **Workbench** (`workbench.py`) | run everything on a team; diff two teams engine by engine | all of the above | **running** |

**Verified by 14 regression tests** (`engine/tests/test_engines.py`, ~1.5 s), each pinned to a fact established today. Examples: Steel resists Ghost/Dark in Gen 2–4; Crunch is Special in Gen 3; Ice Shard is Swinub-only in Gen 4; no Crystal or Platinum member can learn Fly; Milotic can father Refresh; Riolu's two-move bundle; a Gen 2 max-Attack shiny has Hidden Power Dragon 69.

## What each engine already says about the canon (as test fixtures, not decisions)

- **Battle, HeartGold** (July 14 proposed moves): super-effective on 16 of 17 types; 4 of 6 weak to Fighting; 3 weak to Rock with no resist; no hazards, phazing or disruption. That matches its "doesn't need tricks" identity.
- **Wilderness, Crystal:** Miltank's Milk Drink is a real field heal and its Pokédex supplies the milk, so the game itself backs a camp medic and food source. Flash ×3 (Ampharos, Umbreon, Espeon).
- **Wilderness, HeartGold:** caves are fully covered by game facts; warmth, light and comfort are still story-only (waiting on authored canon). By size, no member fits easily in town, which puts numbers on the handoff's question about the big members.
- **Workbench, July 16 swap** (Gyarados → Infernape): Electric and Rock defense improve; Ground, Psychic and Flying get worse; camp loses Intimidate's deterrence.

## Build order from here (each step ends usable)

| # | Next | Why it's next | Done when |
|---|---|---|---|
| 1 | **Battle v2: benchmarks.** Each game's Elite Four, Champion, Red and the rival as opponent teams (ROM data: `pokecrystal`/`pokeemerald` trainer parties are reachable) | strategy needs opponents, not just type charts | a team's report includes "vs this game's Elite Four" damage and speed matchups |
| 2 | **Wilderness v2: authored tier.** Approved world facts (e.g. "Typhlosion is the camp's fire") flow from the canon store; scenarios become editable | turns the framework into *your* world | a scenario shows authored holders |
| 3 | **Breeding v2:** multi-generation bundles (e.g. a Lapras carrying DD + Outrage), timing rules (Ice Shard before Lv 33), Light Ball/incense in plans | the breeding-stock story | the Lapras → Larvitar plan comes out in one call |
| 4 | **Canon store** (Drive Sheet) holding Specimens, Companions, Decisions, Authored evidence; engines read it | the side rail the engines are waiting for | engines run on the stored canon teams |
| 5 | **Workbench UI** (private page): team view, swap-and-diff, specimen card, export buttons | makes all of the above usable without me | you can swap a member on your phone and read the diff |

**Deliberately not done yet:** filling in canon details, finishing SoulSilver, the UI. Those are specifics, and they come after the foundation proves itself.

## Running it
```
python3 -I engine/fetch_reference.py              # pinned data -> engine/data/ (~15 s)
cd engine/battle && npm ci && node dump_gen_data.mjs ../data_battle
cd engine && python3 -I -m unittest discover -s tests -v
```
