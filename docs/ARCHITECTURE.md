# Architecture: engines first (v4, 2026-10-19)

**Zack's direction:** stay zoomed out; get the most important engines working first, because a strong foundation makes everything after it easy. The three pillars are **breeding**, **battle**, and **wilderness/survival**. The endgame they all feed is **the Champion's breeding ranch** (D-035, `docs/RANCH.md`).

## The frame: three tenses (D-042, D-043, D-044)

The whole project is written in the past tense. The journey is over, every companion is retired, and the present is a retired Champion breeding at a ranch in Blackthorn.

| Tense | What it is | How it reads | Engines |
|---|---|---|---|
| **The journey** (past) | the six teams that could have been used, at the peak of their powers, like asking what Ash could have done with everyone at their best | **scouting reports** (20–80 tools, tendencies, comps) and **call sheets** (the call against every opponent Pokémon). Not simulations | battle, benchmarks, **scouting** |
| **The lab** (present) | a retired Champion tinkering with builds, movesets and breeding stock. Every journey Pokémon is a parent or product of stock, and the lab works for Pokémon outside the journey too | the studbook: who can father what for whom, chains, tinkering menus, lineage plans, PKHeX cards | breeding, **studbook**, specimen |
| **The ranch** (place) | Blackthorn HQ, the Glasshouse (hatchery + greenhouse), the Day-Care preserve, camp life grown up | census, rooms and staff, egg timing, crop plan | habitat, ranch planner, **hatchery**, wilderness, camp life |

## The shape

```
     THE JOURNEY (past)              THE LAB (present)                THE RANCH (place)
  scouting reports · call sheets   studbook · lineages · builds    Blackthorn · Glasshouse · Day-Care
                 │                         │                          │
                          WORKBENCH  (Team Lab / Decision Lab)
            run every engine on a team · swap one member, see what changes everywhere
                 │                         │                          │
         BATTLE ENGINE              BREEDING ENGINE            WILDERNESS ENGINE
     coverage · benchmarks          lineage · stock         field · survival · world
                 │                         │                          │
        ─────────────── SPECIMEN ENGINE (one individual at PKHeX parity) ───────────────
        ─────────────── RULES BY GENERATION (Gen 2 / 3 / 4 mechanics) ──────────────────
        ─────────────── REFERENCE DATA (pinned PokeAPI · Smogon · ROM data) ────────────
   side rails:   CANON STORE (Drive/Sheets: decisions, rosters, builds, authored world, ranch design)
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
| **Benchmarks** (`battle/benchmarks.py`) | each game's real opponents: **38 teams** (Elite Four, Champions, Red, the rival, rematches, Steven) read from the games' own code with their exact moves, levels, items and IVs. A 1v1 grid per opponent: who answers each enemy Pokémon, the threats nobody answers, the team's anchors | pret disassemblies (Crystal, FireRed, Emerald, Platinum, HGSS) + Smogon calc | **running** |
| **Breeding** (`breeding/engine.py`) | egg moves, one-egg bundles, line feasibility (male-only, genderless, incense), ranch stock (one father, many targets), and the **multi-generation lineage planner**: the shortest family tree that hatches a Pokémon knowing a whole set of egg moves at once, with timing rules (e.g. Ice Shard as Swinub before Lv 33), Light Ball eggs, and a preference for fathers catchable in that game | reference + Gen 2–4 inheritance rules | **running** |
| **Wilderness** (`wilderness/engine.py`) | 27 world capabilities in 7 domains (plant care added for the Glasshouse) (movement, environment, sustenance, shelter, safety, labor, social); readiness for the situations in `wilderness/scenarios.json` (editable) | field moves + overworld abilities per game, Pokédex text, size/type/habitat | **running** |
| **Authored world** (`wilderness/world.py`, `canon/world.json`) | your world facts as the top evidence tier: propose → approve (with a decision ID) / reject (with a reason). Includes a "what if approved" preview that saves nothing, and suggestions for what to author next | canon (Drive is the home; this file is the engine's copy) | **running**: 15 HeartGold records from the handoff, all approved (D-033) |
| **Workbench** (`workbench.py`) | run everything on a team; diff two teams engine by engine | all of the above | **running** |
| **Scouting** (`battle/scouting.py`, `battle/scouting_report.py`) | the journey as a front office reads it: per Pokémon, 20–80 tool grades (era-adjusted against that generation's fully evolved Pokémon), present vs peak, OFP, out pitch, pitch mix, approach, splits, comps; per team, a depth chart, a 1v1 record against the league, and a call sheet per opponent | battle + benchmarks + `canon/builds.json` | **running**: six packets in `docs/scouting/` |
| **Studbook** (`breeding/studbook.py`, `studbook_report.py`) | the journey as one family tree: who can father which egg moves for which journey lines, two-step chains that never leave the journey, every companion's role (sire, dam, product, stud line, Ditto line), tinkering menus; works for any species list | breeding engine, Gen 4 lab rules | **running**: `docs/BREEDING_LAB.md` |
| **Hatchery** (`ranch/hatchery.py`) | the Glasshouse: room-by-room staffing, egg timing (cycles, steps, laps, with Magcargo), the crop plan from Gen 4 berry data | planner + PokeAPI hatch counters and berries | **running** (design PROPOSED) |
| **Camp life** (`wilderness/camp_life.py`, `camp_life.json`) | which food systems each game really has (berries by era name, Apricorns and Kurt, Poffins, Pokéblocks, Honey, regional food); who on a team forages, produces, cooks, heats | editable catalog, every item checked against PokeAPI | **running** (D-034, small by design) |
| **Habitat** (`ranch/habitat.py`) | where a species lives: 12 zones (primary first), climate, water, size class, native region | Gen 3 Pokédex habitat (Gen 4 inherits its line's), type, Pokédex lore, height/weight | **running** |
| **Ranch planner** (`ranch/planner.py`, `canon/ranch.json`, `canon/rosters.json`) | the census under the decided shape (D-036 to D-040): possible residents (36 companions with open fates + one stud per canon lineage), HQ first with the fewest satellites for missing land, facilities from `ranch.json` (access, people roles, Pokémon jobs, open jobs, jobs that hang on one species, hire proposals), the breeding program (fathers used → stud kept) | rosters + habitat + wilderness + lineage planner | **running**: 45 possible residents, 41 at HQ, one satellite needed, 1 real gap (hatchery) |

**Verified by 34 regression tests** (`engine/tests/test_engines.py`, ~5 s), each pinned to a fact established today. Examples: Steel resists Ghost/Dark in Gen 2–4; Crunch is Special in Gen 3; Ice Shard is Swinub-only in Gen 4; no Crystal or Platinum member can learn Fly; Milotic can father Refresh; Riolu's two-move bundle; a Gen 2 max-Attack shiny has Hidden Power Dragon 69; Snorlax has both Immunity and Thick Fat in Gen 4; Heracross (same generation) outranks Volbeat (Emerald tutor + transfer) as Scizor's Counter father; every camp-life item exists in the generation it's listed for.

## What each engine already says about the canon (as test fixtures, not decisions)

- **Battle, HeartGold** (July 14 proposed moves): super-effective on 16 of 17 types; 4 of 6 weak to Fighting; 3 weak to Rock with no resist; no hazards, phazing or disruption. That matches its "doesn't need tricks" identity.
- **Wilderness, Crystal:** Miltank's Milk Drink is a real field heal and its Pokédex supplies the milk, so the game itself backs a camp medic and food source. Flash ×3 (Ampharos, Umbreon, Espeon).
- **Wilderness, HeartGold:** caves are fully covered by game facts; warmth, light and comfort are still story-only (waiting on authored canon). By size, no member fits easily in town, which puts numbers on the handoff's question about the big members.
- **Workbench, July 16 swap** (Gyarados → Infernape): Electric and Rock defense improve; Ground, Psychic and Flying get worse; camp loses Intimidate's deterrence.
- **Benchmarks, HeartGold** (July 14 moves, matched levels, simple 1v1 model): at least one winning answer to every Pokémon of Will, Koga, Bruno, Karen, Lance and **Red**. Tyranitar, Mamoswine and Lapras each beat all six of Lance's; Snorlax beats all six of Red's; Red's Blastoise is the narrowest matchup.
- **Authored world, HeartGold (15 records approved, D-033):** the mountain storm, open sea, cave, emergency and night travel are fully covered. Food and cooking stay open on purpose (D-034); town life became the ranch (D-035).
- **Ranch census (shape decided, D-036 to D-040):** 45 possible residents (36 companions with open fates, plus 9 studs and one Light Ball). The headquarters (Blackthorn, proposed) holds 41. It lacks a volcano and the sea, and one satellite covers both: Sevii Islands or the Battle Zone. The only real staffing gap is the hatchery (no Flame Body or Magma Armor; hire Magcargo). Snorlax, Crobat, Typhlosion and Mamoswine each hold jobs nobody else covers.
- **Lineage, Tyranitar DD + Outrage:** two steps, all catchable in HeartGold. Horsea (DD at Lv 38) → a Feraligatr, Charizard or **Lapras** father (Outrage from the tutor) → Larvitar.

## Build order from here (each step ends usable)

| # | Next | Why it's next | Done when |
|---|---|---|---|
| ~~1~~ | ~~Battle v2: benchmarks~~ | **done** (D-032) | 38 opponent teams + 1v1 grid |
| ~~2~~ | ~~Wilderness v2: authored tier~~ | **done** (D-032) | proposals, approval gate, preview, editable scenarios |
| ~~3~~ | ~~Breeding v2: lineage planner~~ | **done** (D-032) | Tyranitar DD + Outrage plan in one call |
| ~~3c~~ | ~~Ranch v1 + camp life~~ | **done** (D-034, D-035) | census, sites, staffing, breeding program |
| 3a | **Deepen the battle model:** natures/abilities/EVs for opponents where the game data has them; status, recovery and switching in the matchup | 1v1 is a map, not a fight | grid notes which wins depend on status or recovery |
| ~~3d~~ | ~~Journey / lab / ranch frame~~ | **done** (D-041 to D-044) | scouting packets, breeding web, Glasshouse |
| 3b | **Ranch authoring loop:** shape decided (D-036 to D-040); next: confirm the HQ, pick the satellite, confirm the stud reading (RANCH.md §6); Day-Care details later | the ranch becomes yours | the census runs on approved sites |
| 4 | **Canon store** (Drive Sheet) holding Specimens, Companions, Decisions, Authored evidence; engines read it | the side rail the engines are waiting for | engines run on the stored canon teams |
| 5 | **Workbench UI** (private page): team view, swap-and-diff, specimen card, export buttons | makes all of the above usable without me | you can swap a member on your phone and read the diff |

**Deliberately not done yet:** filling in canon details, finishing SoulSilver, the UI. Those are specifics, and they come after the foundation proves itself.

## Running it
```
python3 -I engine/fetch_reference.py              # pinned data -> engine/data/ (~15 s)
cd engine/battle && npm ci && node dump_gen_data.mjs ../data_battle
cd engine && python3 -I -m unittest discover -s tests -v
python3 -I ranch/report.py                         # ranch census -> data_manifest/ranch_census.json
python3 -I battle/scouting_report.py               # scouting packets -> docs/scouting/
python3 -I breeding/studbook_report.py             # the journey's family tree -> docs/BREEDING_LAB.md
```
