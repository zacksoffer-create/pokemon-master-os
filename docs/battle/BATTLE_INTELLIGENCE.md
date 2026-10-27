# Battle intelligence

The master battle-intelligence handoff (uploaded 2026-10-27: `CLAUDE_MASTER_HANDOFF.md`, with the V3 competitive vocabulary and the V4 design contract) asks for one system that measures what a build does, names it, recognises it, scouts it and reads it in a team, all from evidence. This page is the integration map and the record of what's built. Decision D-082; the calls behind it are A-119 to A-126 in `docs/design/ASSUMPTIONS.md` (and in Your calls).

## The vertical slice (built)

Open any Pokémon or build in the builder. Under its name you now see its **battle identity**: a name earned from its own fights against the League, the job underneath it, how much of the set the name explains, three things it does (each with its numbers), the one catch, the other names it also earns, the names it nearly earned and how close it came, and the names that can't be measured yet. Change a move, the item or the EVs and the name re-reads. The **Archetype Atlas** (`#/archetypes`) lists every name the 1,076 library builds earn, filters them by job, earned word and generation, and gives each name a page: what each word means, who holds it, who nearly does and what they lack.

| | |
|---|---|
| Engine | `engine/trainers/identity.py`, `engine/trainers/identity.json` (every rule and word) |
| Browser | `engine/app/web/37_identity.html` (the engine, line for line), `engine/app/web/79_archetypes.html` (the card and the Atlas) |
| Parity | `engine/app/test_identity_parity.mjs`: 1,638 / 1,638 checks on the 18 pilot sets and 60 library builds (one per name and generation) |
| Pack | `engine/app/data/identity4.json` (every library build's identity), written by `team_roles.py --pack` from the same fights |
| Tests | `BattleIdentity` in `engine/tests/test_engines.py` (journeys 1-11 and 14), `engine/app/test_identity.mjs` (the builder and the Atlas) |
| Generated | `docs/battle/PILOT.md` (the pilot, named), `docs/battle/CENSUS.md` (every name in the library) |

## Phase 0: the integration map

| What the handoff needs | What Blackthorn already has | How identity uses it |
|---|---|---|
| Build schema | `trainers/model.py` `Build` (species, moves, item, ability, nature, IVs, EVs, level); records in `store.json` (individuals, versioned builds) | Read as is; nothing new is stored |
| Legality | `trainers/era.py` `learnable(species, game)` (strict in-game learnset), `Store.check` | The pilot sets are checked against it; Bug Bite Scizor moved to HeartGold (it's a HeartGold tutor), Blissey's Wish and Seismic Toss replaced (transfer-only from Gen III) |
| Calculator | `battle/evaluate.py` `Evaluator.versus` → `Matchup`: our damage per move and theirs on us (roll range in %, no boosts, from full), Speeds with items | Untouched |
| 1v1 engine | `trainers/team_roles.py` `TeamRoles.read`: every Elite Four and Champion Pokémon of the generation, one-on-one at L100, our best plan against their game AI | The read now also carries `lens`: those fights row by row (name, moves, Speeds, damage both ways). It stays in memory: `roles4.json` leaves it out (it's already 5.7 MB) |
| Roles and bars | Ace, Sweeper, Support, Wall, Tank, Pivot (`team_roles.json`, calibrated over 1,076 builds) | Every identity bar is one of these; Ace is untouched |
| Badges | `trainers/recognition.py`: stat tiers, the Speed badge (strict outspeed: a milestone is the max-Speed value + 1, a tie is recorded apart), damage badges | The Speed part is read into the identity's facts; no badge logic changed |
| 6v6 | `sixvsix/` (@pkmn/sim, seeded runs, the Lab); plugs into nothing yet (`docs/design/SIXVSIX_SEAM.md`) | The third tier (observed) says "not yet" everywhere until slice 5 |
| UI | Builder (`83_builder`: `#pbname`, roles, badges, scouting), `82_labs liveRead` (cached reads), profile (`87_profile`) | `#pbname` shows the identity; a new card sits above the team roles; `#/archetypes` is new |
| Caching | `liveRead` per build and game; the packs | The identity is pure on the read: it costs nothing extra |

The Phase 0 gate (one real build round-trips through the adapter without loss) holds by construction: the lens rows are the fights themselves, and the browser's rows match Python's exactly (`test_roles4_parity.mjs` now compares them too).

## How a build is read

**The fingerprint.** Its six commitments: four moves (each tagged by job: attack, priority, setup, recovery, support, pivot, hazard, screens, weather, Trick Room, cleric, self-KO, trap), its item (offense, Choice, speed, sustain, setup, field, weather, slow) and its spread (offensive, defensive, fast or slow: 252 EVs in that side, or a nature that raises it). Then its numbers in the **League lens**: moves first against how many; 2HKOs and OHKOs with attacks it can repeat (Explosion is left out), with no boosts and after one setup; its priority move's reach; three, four and two hits survived (the team roles' reads); and labelled scenarios: in its own rain or sun, under its own Trick Room, in a low-HP window, Eruption after Stealth Rock.

**Fourteen functions, three tiers.** Setup Sweeper, Sweeper, Wallbreaker, Cleaner, Revenge Killer, Tank, Wall, Pivot, Support, Disruptor, Field Controller, Trapper, Stallbreaker, Setup Enabler (plus Attacker, the offensive fallback). Each says whether the set *can* (its moves, item, ability), whether the League lens *shows* it does (a team-role bar), and whether 6v6 has *observed* it (not yet). Seven are **pending**: the evaluator exists but the bar or pool doesn't (Wallbreaker needs a pool of walls; Trapper needs something that switches). Pending never names a build; it shows under "can't be measured yet".

**The name.** A job it earns plus at most two earned words:

1. **Hard gates.** Every word earned in the lens (a pending word makes it a near miss); the job accounts for something the set invests in; Fast, Offensive, Defensive, Bulky and the like must explain a choice nothing else in the name does; four words at most.
2. **Centrality:** the name that explains most of the six commitments.
3. **Information:** the more specific job, then the most specific word (condition > method > measure > generic), then how many non-generic words.
4. **Adequacy:** the one that states its conditions (rain, Trick Room, a window).
5. **Plain English:** fewer words. **Stable:** a fixed order, then the letters.

No weighted score anywhere. The decision keeps every step: the accounted commitments, the ranks, the alternates, the near misses with how close they came (value over bar), and the reason a pending name can't be measured.

## Calibration v0

Bars reused (A-120): the Sweeper's 80% first / 80% 2HKO / 30% OHKO (Sweeper, Setup Sweeper, Fast, Rain, Room-Setting); the Tank's three hits from 75% of the 100 hardest attacks (Bulky; Setup Sweeper's bulk path) and its 60% 2HKO (Attacker, Offensive, Priority, Sacrificial); the Wall's four hits from 80% of one side's 50 hardest, with sustain (Specially / Physically Defensive); Support's "lasts to use it" (two hits from 80%, or first against 60%) for every field job. The only exact numbers of our own are mechanics: Gen IV Speed milestones (329 / 351 / 362 / 373 / 395, ties apart), Trick Room's five turns, weather's five (eight with the rock), Stealth Rock's eighth times Rock effectiveness, the pinch thresholds, Eruption's power ratio.

The pilot (the V3 contrast cases as exact legal sets, `docs/battle/PILOT.md`): the three Scizors read **Offensive Priority Pivot**, **Bulky Setup Sweeper** and **Priority Setup Sweeper**; the Starmies **Defensive Spinner** and **Offensive Spinner**; the Bronzongs **Room-Setting Tank** and **Bulky Field Controller**; the Kingdras **Physical Setup Sweeper** and **Rain Sweeper**; Blissey **Specially Defensive Cleric**; Scarf Typhlosion **Choice Scarf Attacker** with Eruption's HP catch. Where the literature's name needs a pool we don't have (Choice Band Tyranitar's *Wallbreaker*, Choice Band Scizor's *Trapping*, Empoleon's *Torrent window*), the engine says so instead of guessing.

The library (`docs/battle/CENSUS.md`): 1,076 builds, 107 distinct names, no nonsense names found on review. 258 builds clear no bar and get a plain description (Offensive / Defensive / Fast / Unproven Set, A-125); most are anime-era sets with no EVs recorded.

## Compatibility issues, and what I did

| Issue | Resolution (reversible) |
|---|---|
| The League lens is one-on-one: nothing switches, so trapping, Pursuit, pivot execution and leads can't be measured there | Those claims are pending (never in a name) until 6v6 evidence plugs in (slice 5) |
| The old type-and-noun ladder is the naming pattern the handoff rejects | The identity takes the headline; the ladder is still read and kept (A-126) |
| Some V3 set families aren't in-game legal in one Gen IV game | Rebuilt in the game where they are, or swapped and labelled in `identity_pilot.json` |
| Gen IV Defog clears the target's side only | Not hazard removal; the card says so |
| Ability weather (Sand Stream) is a species fact, not a choice | Not a field job for naming (A-122) |
| The handoff's default lens is `BT_GEN4_REFERENCE_V1`; Blackthorn's lens covers Gens 2-4 | The lens id is `league-1v1-l100`, with each generation's pools from `team_roles.json` |
| Thresholds the handoff wants calibrated (windows, Disruptor targets) | Computed and shown; no bar until Zack sets one (A-123) |

## What's next, in order

1. **Slice 2, the defensive reference pool.** The 73 Gen 4 OU usage sets in the record store, the defensive ones by the role engine's family: Wallbreaker and Stallbreaker become measurable (Choice Band Tyranitar should earn its Wallbreaker there or show why not).
2. **The windows bar** (A-123) once Zack answers, then the Revenge Killer's threat pool (the League's dangerous attackers).
3. **Pinning a display name** among the ones a build already earns, saved with the build version, flagged when a later edit invalidates it.
4. **Badges (Phase 3)** as qualification groups with versioned standards; **scouting findings (Phase 4)** from the same facts (the takeaways and the catch are already structured findings); **teams and the film room (Phase 5)** with 6v6 telemetry feeding the observed tier; **reverse search (Phase 6)**: the Atlas's "Nearly" lists are its first piece.
