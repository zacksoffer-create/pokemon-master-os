# Four Labs: design (draft for Zack's review)

**Status:** built, 2026-10-21, after Zack's answers to §8 (D-059 to D-063). What was built, and where:

| Part | Where | State |
|---|---|---|
| Engine fixes (B4, B19, B1, B2, B3, Skill Link, every rematch team) | engine/trainers, engine/battle, with their browser ports | done, tests pass |
| The four team roles and the name ladder | engine/trainers/team_roles.py + .json; app/web/28_teamroles.html | done; 962 builds read; browser matches Python (app/test_roles4_parity.mjs) |
| Everything still to be named | docs/naming/NAMES_NEEDED.md | 162 names waiting on Zack |
| The record store (three tiers) | engine/store/migrate.py → engine/store/out; app/data/store.json | done; canon untouched |
| Pokémon lab, build compare, PKHeX export | app/web/82_labs.html (#/pokemon, #/compare, #/pkhex) | done |
| Team lab | app/web/84_teamlab.html (#/team) | done |
| Breeding lab (offspring first) | app/web/86_breedlines.html (#/lines) | done |
| Trainer lab | the Scouting Lab (#/scoutlab), under Labs in the menu | unchanged |
| One rebuild command with before/after | engine/rebuild.py → engine/data_manifest/last_rebuild.json | done |
| Hand overrides for team-role tags | team_roles.json → overrides (approved, both engines); the Pokémon lab's per-role menu (trial, this browser) | done |
| Joker (the tier above Ace) | team_roles.json roles.ace.top_tier | named; off until it has a rule |

The rest of this document is the proposal as it was approved; §8's questions are answered in the ledger.

**Tags.** [ran] means I ran it in this session. [read] means I read code or data only. [yours] means you said it. [proposal] means it's my suggestion, waiting on you.

## 0. What the labs are for

**The four pillars [yours]:**
- the individual Pokémon,
- the trainer,
- the team,
- breeding.

**What each lab does [yours]:**
- Each pillar gets a lab built around the values you want to change.
- A change updates everything downstream, live.
- The page shows before and after, and highlights what moved.
- The current art and page style stay.
- Scouting reports are the end product. Roles and team composition are the middle layer.

## 1. The record store: three tiers

| Tier | Holds | Where it comes from | Stored? |
|---|---|---|---|
| **Species** | base stats, types, abilities on offer, sprite, height, weight, move pool by game, Pokédex text, egg groups | PokeAPI and Smogon data (ingested) | **No.** It's derived on the fly from `pokeref.sqlite` and `data_battle`, as today |
| **Build** (the variant) | moveset (up to 4), nature, IVs, EVs, held item, **ability** [proposal: your call], game/generation, name, provenance, status, notes | Authored or ingested | **Yes**, in one file: `canon/store/builds.json` [proposal] |
| **Individual** (your specific Pokémon) | build id, nickname, ball, met location, caught level, friendship, shiny, gender, chapter, ribbons | Yours | **Yes**: `canon/store/individuals.json` [proposal] |

**Defaults [yours]:**
- Ball: Poké Ball.
- Met location and caught level: the species' normal location and level range in that game, read from PokeAPI encounters.
- Shiny: no.
- Gender: male, for species that can be male.
- **EVs default blank, meaning untouched**, and are shown as blank.
- **IVs: the max-IV box is checked by default.**

**Open question.** You need to decide how blank EVs behave in fights:
- Today the engines fill 85 in every stat in Gen 3–4, and max stat experience in Gen 2.
- My proposal is to keep that for fights but label it "assumed".
- The role engine must not count it as evidence. That's bug B19.

**Where the ball shows [yours]:** on the team screen only. It's not part of battle or breeding records.

**PKHeX export [yours]:** a separate sidebar screen, which reads an individual and its build.

**Provenance** is one field, with one of these values [proposal]:
- `canonical`: from the show or the games, tied to a trainer.
- `stock`: an archetype.
- `ingested`: Showdown replays or Bulbapedia.
- `competitive`: Smogon sets.
- `yours`.

**Where each group lives in the labs [yours]:**
- Canonical builds sit with trainers.
- Ingested and competitive builds sit with the battle side.
- Your builds sit in breeding.

All of them live in one store, so the compare screen can line them up side by side.

## 2. Migrating from the five places builds live today [read]

| Today | What happens [proposal] |
|---|---|
| `canon/builds.json` (18 companions) | Each one becomes an **individual** of yours plus a **build** with provenance `yours`. The free-text `status` is kept as a note. Companions without a build get an individual with no build, and the page shows "no build on record", not a silent engine fill (bug B9). |
| `canon/lineups.json` characters | Become builds (`yours`, tagged historical). The variations become saved team drafts. |
| `canon/build_library.json` (131) | 37 stock builds → `stock`. 42 anime builds → `canonical`, linked to their trainer. 52 ingested → `ingested`. The 3 duplicate film builds are merged. |
| `canon/ranch.json` breeding_program | Points at a target build id plus its egg moves, instead of keeping a hand-copied move list. |
| `canon_checks.py` MOVE_CLAIMS | Reads the store instead of its own hard-coded copy, which still includes the old SoulSilver Gyarados. |

**How the migration runs:**
- One migration script writes the new store **next to** the old files.
- The old files stay as they are, and canon stays read-only until you approve.
- **The switch counts as done only when** every generated report and app file comes out byte-identical when the engines read the new store. The one expected exception is the B9 label fix.

## 3. Roles and names

**Two layers [yours]:**
- On top, **four roles: Ace, Support, Sweeper, Wall.** Each is earned by a written rule. Pivot is out.
- Underneath, the existing 34-role engine (`roles.json`) stays as the second layer.

**Ace [yours]:**
- It has two tiers: ace and top-tier ace.
- Both sit well below Ash's Pikachu.
- It's tied to named pools.
- It can be nobody, or several Pokémon at once.
- It never fills other roles automatically.

**Proposals for Ace:**
- It requires a win with odds above a floor.
- It needs more qualifying paths beyond that one. You haven't listed them yet.

**Support [yours]:** needs more than one status move.

**Wall:** the criteria are still open.

**Tags:**
- They're computed from the build's fixed values, and you can override them by hand [proposal: my reading of what you said; please confirm].
- Every tag shows the rule and numbers that produced it.

**Build names follow your ladder [yours]:**

| Best role match | The name uses |
|---|---|
| 0.90 or higher | type |
| 0.80 or higher | type + moveset |
| 0.70 or higher | type + moveset + team role |
| 0.60 or higher | type + moveset + team role + base stat total |

If two or three roles score above 0.80, the build gets a hybrid name from a lookup table that grows over time.

**Proposals for names:**
- A name depends on the build only, never on its spot in a team.
- The naming rules live in JSON with a small evaluator, so the browser copy stays small.
- You approve a sample of names before the vocabulary is locked in.

**Cut for now [yours]:** the 100-simulation win percentage.

**What to fix before setting the name thresholds:**
- **B4:** a role that scores 0 still becomes the primary role.
- **B19:** default EVs count as role evidence.

Then I report the real distribution of role scores, and propose thresholds from that data.

## 4. The four lab layouts

Every lab has two blocks: **fixed information** (species facts) grouped in one, and **changeable information** grouped in the other. Each also gets a "show your work" panel on every number.

### Pokémon lab

- **Top:** the build name, then the ranked role scores (for example "Aquatic Armor · Wall 0.91 · Sweeper 0.78 · Status 0.42").
- **Below it:** the stat-based build list.
- **On every change** (for example, swapping Tyranitar's Earthquake for Aerial Ace), it shows before and after for:
  - the role scores,
  - the build name,
  - the scouting-report lines that change,
  - how the build fits the current team and the trainer's identity.
- What moved is highlighted.

### Build compare

Opens when you pick a species in the team builder:
- Every build of that species, side by side.
- Every changeable field is a column.
- Covers stock, ingested, canonical, competitive and your own builds.

### Team lab

**Six slots.** You can swap a Pokémon or a build: your custom build, a competitive build, Ash's Tyranitar, Brock's Golem.

**Live composition reads:**
- type coverage,
- move balance,
- role balance,
- an extensible list of scenario questions, each kept as a data entry.

**Finding a member:**
- An overlay of eligible builds, with filters for type, a known move (for example Surf), region or game, and role.
- It works both ways: from criteria to candidates, or from a chosen Pokémon to its numbers.
- **Suggestions,** for example a nature swap, each shown with its before and after.

**The win estimate [proposal]:**
- An honestly labelled lean, with its factors visible.
- It would come from a 6×6 grid of one-on-one results.
- **Feasible [ran]:** `Evaluator` plays build against build with no cartridge AI. I ran one fight, Tyranitar vs Choice Scarf Garchomp:
  - Garchomp won in 2 turns, with 40.2% HP left.
  - Tyranitar's odds were 0.8, Garchomp's 1.0.
  - The calls were: Tyranitar Outrage; Garchomp Earthquake, Earthquake.
- **Not yet checked:** whether the existing matchup board accepts any two lineups.

### Trainer lab

- The existing Scouting Lab framework: sliders and traits stay editable.
- Intake keeps accepting movies, episodes and game notes.
- **Open question:** what the "8 traits" are. My guess is the two ends of the four sliders.

### Breeding lab

The current page mostly stays. **Breeding stock is organized around the offspring and the final product, not the lineage.**

**Boutique lines.** Each line has a signature and a story, told through:
- biology and natural selection,
- Pokédex text,
- show and game canon,
- moves.

**Examples [yours]:**
- Mamoswine with Ancient Power, Hail and Snow Cloak.
- A Cyndaquil line with inherited Extrasensory.

**Lineage** becomes the "how to get there" view underneath each line.

## 5. Engine limits the labs must show or fix [read unless marked]

**Already known:**
- Every hit uses the minimum damage roll.
- Crits are not modelled.
- Every move lands; the chance that all of a side's moves land is kept as its odds.
- Frozen Pokémon keep acting (a bug).
- Confusion and full paralysis are not modelled.
- Hazards and switching are left out of one-on-ones by design.
- The grid ignores abilities, and cartridge opponents get 0 EVs.
- The coach knobs never reach the grid or the cartridge AI.

**Found in this session:**
- **[ran]** The damage-calculator bridge (`calc_bridge.mjs`) never passes an ability to a move. So **Skill Link is ignored**: Icicle Spear is counted as 3 hits with or without it. The calculator assumes 3 hits for any 2–5-hit move.
- **[read]** The bridge also never passes the calculator's move `overrides` (for example, a type override) or a set hit count, although the calculator supports both. **Proposal:** add both. The damage battery should then record both the minimum and maximum roll.
- **[read]** There are three different rules for filling empty move slots:
  - `scouting.strongest_set` is used for your lineups, the trainer report's journey teams, and the Battle Lab. It inherits the B3 accuracy bug.
  - The benchmarks fill a species-only member with its four strongest attacks, one per type.
  - Cartridge parties with no moves get their last four level-up moves.
- **[read]** The benchmarks miss rematch teams that are already on disk:
  - all four Platinum Elite Four rematches;
  - FireRed's Elite Four rematch teams (`…2`) and all three Champion rematch variants.
  - Crystal and Emerald have no Elite Four rematches in the data.
  - The full list of parties is in §6.
- **[read]** Where the cartridge data stores ability and nature:
  - Only HeartGold/SoulSilver store an ability slot (`abilityOverride`: OFF or SECOND) and a `genderOverride`.
  - Platinum stores `form`, `iv_scale` and `ball_seal`, with no ability.
  - Gen 3 stores only `iv`, `lvl`, `species`, `heldItem` and `moves`.
  - Crystal stores level, species, item and moves, with DVs set per trainer class.
  - **No game stores a nature.** In Gen 3–4 the nature comes from the generated PID; I believe that's seeded from the trainer and difficulty, but I haven't verified it.

## 6. Every Elite Four and Champion party on disk [ran: parsed with the engine's own readers]

**Crystal** (no rematches):

| Trainer | Party |
|---|---|
| Will | Xatu 40, Jynx 41, Exeggutor 41, Slowbro 41, Xatu 42 |
| Koga | Ariados 40, Venomoth 41, Forretress 43, Muk 42, Crobat 44 |
| Bruno | Hitmontop 42, Hitmonlee 42, Hitmonchan 42, Onix 43, Machamp 46 |
| Karen | Umbreon 42, Vileplume 42, Gengar 45, Murkrow 44, Houndoom 47 |
| Lance | Gyarados 44, Dragonite 47, Dragonite 47, Aerodactyl 46, Charizard 46, Dragonite 50 |
| Red | Pikachu 81, Espeon 73, Snorlax 75, Venusaur 77, Charizard 77, Blastoise 77 |
| Rival | 6 teams on disk; the benchmark uses the strongest |

**FireRed:**

| Trainer | First run | Rematch (on disk, not used) |
|---|---|---|
| Lorelei | Dewgong 52, Cloyster 51, Slowbro 52, Jynx 54, Lapras 54 | Dewgong 64, Cloyster 63, Piloswine 63, Jynx 66, Lapras 66 |
| Bruno | Onix 51, Hitmonchan 53, Hitmonlee 53, Onix 54, Machamp 56 | Steelix 65, Hitmonchan 65, Hitmonlee 65, Steelix 66, Machamp 68 |
| Agatha | Gengar 54, Golbat 54, Haunter 53, Arbok 56, Gengar 58 | Gengar 66, Crobat 66, Misdreavus 65, Arbok 68, Gengar 70 |
| Lance | Gyarados 56, Dragonair 54, Dragonair 54, Aerodactyl 58, Dragonite 60 | Gyarados 68, Dragonite 66, Kingdra 66, Aerodactyl 70, Dragonite 72 |
| Champion | Pidgeot 59, Alakazam 57, Rhydon 59, two of Arcanine / Exeggutor / Gyarados, and the starter at 63 | Heracross 72, Alakazam 73, Tyranitar 72, two of Arcanine / Exeggutor / Gyarados, and the starter at 75 |

**Emerald** (no rematches):

| Trainer | Party |
|---|---|
| Sidney | Mightyena 46, Shiftry 48, Cacturne 46, Crawdaunt 48, Absol 49 |
| Phoebe | Dusclops 48, Banette 49, Sableye 50, Banette 49, Dusclops 51 |
| Glacia | Sealeo 50, Glalie 50, Sealeo 52, Glalie 52, Walrein 53 |
| Drake | Shelgon 52, Altaria 54, Kingdra 53, Flygon 53, Salamence 55 |
| Wallace | Wailord 57, Tentacruel 55, Ludicolo 56, Whiscash 56, Gyarados 56, Milotic 58 |
| Steven | Skarmory 77, Claydol 75, Aggron 76, Cradily 76, Armaldo 76, Metagross 78 |

**Platinum** (the benchmark uses Cynthia's rematch, but not the Elite Four rematches):

| Trainer | First run | Rematch |
|---|---|---|
| Aaron | Yanmega 49, Scizor 49, Vespiquen 50, Heracross 51, Drapion 53 | +16 levels |
| Bertha | Whiscash 50, Gliscor 53, Hippowdon 52, Golem 52, Rhyperior 55 | +16 levels |
| Flint | Houndoom 52, Flareon 55, Rapidash 53, Infernape 55, Magmortar 57 | +16 levels |
| Lucian | Mr. Mime 53, Espeon 55, Bronzong 54, Alakazam 56, Gallade 59 | +16 levels |
| Cynthia | Spiritomb 58, Roserade 58, Togekiss 60, Lucario 60, Milotic 58, Garchomp 62 | +16 levels |

The Platinum rematch teams have the same Pokémon, 16 levels higher.

**HeartGold/SoulSilver** (all used, rematches included):

| Trainer | First run | Rematch |
|---|---|---|
| Will | Xatu 40, Jynx 41, Exeggutor 41, Slowbro 41, Xatu 42 | Bronzong 58, Jynx 60, Grumpig 59, Slowbro 60, Gardevoir 61, Xatu 62 |
| Koga | Ariados 40, Venomoth 41, Forretress 43, Muk 42, Crobat 44 | Skuntank 61, Venomoth 63, Toxicroak 60, Muk 62, Crobat 64, Swalot 62 |
| Bruno | Hitmontop 42, Hitmonlee 42, Hitmonchan 42, Onix 43, Machamp 46 | Hitmontop 62, Hitmonlee 61, Hitmonchan 61, Hariyama 62, Machamp 64, Lucario 64 |
| Karen | Umbreon 42, Vileplume 42, Gengar 45, Murkrow 44, Houndoom 47 | Weavile 62, Spiritomb 62, Absol 62, Honchkrow 64, Houndoom 63, Umbreon 64 |
| Lance | Gyarados 46, Dragonite 49, Dragonite 49, Aerodactyl 48, Charizard 48, Dragonite 50 | Salamence 72, Gyarados 68, Garchomp 72, Altaria 73, Charizard 68, Dragonite 75 |
| Red | Pikachu 88, Lapras 80, Snorlax 82, Venusaur 84, Charizard 84, Blastoise 84 | — |

## 7. Order of work after approval

1. Fix B4 and B19. Report the role-score distribution, and propose name thresholds from it.
2. Build the record store and the migration, with canon read-only until you approve.
3. Move roles and naming into JSON data. Get your approval on a sample of names.
4. Build the Pokémon lab and the build compare screen.
5. Build the team lab.
6. Rework breeding stock around offspring.

**Throughout:**
- one rebuild-everything command,
- automatic before-and-after capture,
- a show-your-work panel on every number,
- a browser copy and a matching parity test for every Python change,
- **never** sending updates to the existing Sheet (bugs B22 and B23 would wipe your answers).

## 8. Questions for you

1. Does ability belong in the build? That's my assumption.
2. Are tags computed and then hand-overridable?
3. The Support, Wall and extra Ace criteria.
4. The vocabulary behind the name ladder.
5. What the 8 traits are.
6. The EVs the comparison field gets, and whether it's one pooled field or one per game.
7. How blank EVs behave in fights.
8. What counts as "neutral".
