# v3 reference tabs: structure, provenance and anomalies

Source: "Pokemon Master Spreadsheet v3" (`1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek`). Read-only audit, 2026-10-19.

**How each tab was seen**
- **COMPLETE (snippet):** Species_Base_Pokemon, Pokemon_Master, Types_Master, Pokemon_Types_Clean and Moves_Master were captured in full from the `get_file_metadata` MAX_ALLOWED content snippet, which renders each tab as CSV. Full CSVs are in `raw/v3_<Tab>_COMPLETE.csv`.
- **PARTIAL (snippet):** Pokemon_Moves_Display was captured for its first 19,852 data rows only (pokemon_id 1 to 28, ending mid-row inside Sandslash/Emerald). The snippet hits its ~1,048,515-character cap at that point. File: `raw/v3_Pokemon_Moves_Display_PARTIAL_first19852rows.csv`.
- **SAMPLE ONLY (header + 6 rows):** Move_Methods_Master, Abilities_Master, Pokemon_Abilities_Display, Pokemon_Species, Base_Species_Map and Pokemon_Egg_Groups_Clean come after the snippet cut-off. For these, only `read_file_content`'s 6-row sample is available, with cells truncated at about 40 characters. Where noted, extra rows come from a *different* file, "Pokemon Master Spreadsheet v3 (BACKUP ENGINE WORKING)" (`1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg`, 2025-12-19), whose sample showed 9 rows. Those rows are labelled as backup rows.
- Row counts are taken from the tool's detected "Table Range" (data extent) minus 1 header row, unless stated otherwise.

## Provenance summary

**The reference data is PokeAPI's CSV dump (`pokeapi/data/v2/csv/`, which descends from veekun's pokedex), filtered and joined.** The evidence:
1. Column names and ID schemes match PokeAPI exactly: `version_group_id`, the `pokemon_move_method` ids 1-11, `species_id`, `evolution_chain_id`, `is_baby`, `egg_group_id`, `ability_id`/`main_series`, and type ids 10001 `unknown` and 10002 `shadow`. Move ids 10001-10018 are the Shadow moves, and form ids are 10001+ (deoxys-attack, ...).
2. Zack's Drive holds the raw PokeAPI files, uploaded 2025-12-15 06:20 UTC, two days before v3 was created:
   - `pokemon_moves.csv`: 8.3 MB, header `pokemon_id,version_group_id,move_id,pokemon_move_method_id,level,order`
   - `pokemon_move_methods.csv`: `id,identifier`, 11 rows from level-up to zygarde-cube
   - `pokemon_species.csv`: the full PokeAPI header (`id,identifier,generation_id,evolves_from_species_id,evolution_chain_id,color_id,...,is_baby,...,conquest_order`)
   - `pokemon.csv`: `id,identifier,species_id,height,weight,base_experience,order,is_default`
   - `pokemon_evolution.csv`, `moves.csv`, `Pokemon_Egg_Groups_Clean.csv`, and a `Pokemon_Species_Core_Gen1_4` sheet
3. **Snapshot age:** the `pokemon.csv` in Drive stops at species 898 (Calyrex) and form 10194 (calyrex-shadow). It has no Gigantamax, Hisuian, Paldean or Gen 9 entries. That points to a PokeAPI snapshot from about 2021, before Legends: Arceus. It also explains why Pokemon_Moves_Display tops out at version group 20 (sword-shield).
4. Filtering rule inferred from the data: Pokemon have `species_id <= 493`, moves and abilities have `generation_id <= 4`, and types have `generation_id <= 4`. Version groups were **not** filtered.
5. Display names were generated from the identifiers by replacing "-" with a space and title-casing (e.g. "Nidoran F", "Mr Mime", "Ho Oh", "Mime Jr", "Porygon Z", "Farfetchd", "Deoxys Normal", "Pikachu Phd", "Xd Shadow"). They were **not** taken from PokeAPI's `*_names.csv` files. Move names are the modern ones from `move_names` ("Ancient Power", "Extreme Speed", "U-turn"), not the Gen 4 in-game spellings.

**Is the data limited to Gen 1-4?** Mostly, with several important leaks:
- Species: yes (1-493).
- Pokemon forms: **no**. There are 114 alternate forms, including Gen 6-8 Megas, Alolan and Galarian forms, Pikachu caps and cosplay forms, Totems and Let's Go starters. Their `introduced_gen` is copied from the base species, so "Charizard Mega X" is listed with `introduced_gen` 1.
- Moves: yes (1-467), **plus 18 Colosseum/XD Shadow moves**.
- Abilities: yes (Gen 3-4, 123 abilities).
- Types: yes. Fairy (18) was dropped, but the **pre-Gen-6 typings were not restored**, so six Pokemon have no type at all.
- Learnsets (Pokemon_Moves_Display): **no**. It covers **version groups 1-20** (Red/Blue through Sword/Shield, including Colosseum, XD and Let's Go). Because moves are limited to id 467 or below, the learnsets for version groups 11-20 are silently incomplete.

---

## Species_Base_Pokemon (COMPLETE)
- Range `A1:B494`: 493 data rows. Columns: `species_id`, `base_pokemon_id`.
- First 10 rows:

| species_id | base_pokemon_id |
|---|---|
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |
| 6 | 6 |
| 7 | 7 |
| 8 | 8 |
| 9 | 9 |
| 10 | 10 |

- **Anomaly / redundancy:** every row is an identity mapping (species_id = base_pokemon_id for all 493 rows; verified). For Gen 1-4, a species' default `pokemon_id` always equals its `species_id`, so the tab carries no information.
- **Naming collision:** here "base_pokemon_id" means the *default form*. In Breeding_Requirements (172 = Pichu for Volt Tackle) and Breeding_Lab (Riolu = 447), "base_pokemon_id" appears to mean the *first stage of the evolution line*. Base_Species_Map holds that second concept. Downstream logic could easily confuse the two.
- Resembles: a derivation from PokeAPI `pokemon.csv` (`species_id`, `is_default`).

## Pokemon_Master (COMPLETE)
- Range `A1:E608`: 607 data rows (493 default Pokemon + 114 alternate forms). Columns: `pokemon_id`, `pokemon_key`, `species_id`, `introduced_gen`, `pokemon_name`.
- First 10 rows:

| pokemon_id | pokemon_key | species_id | introduced_gen | pokemon_name |
|---|---|---|---|---|
| 1 | bulbasaur | 1 | 1 | Bulbasaur |
| 2 | ivysaur | 2 | 1 | Ivysaur |
| 3 | venusaur | 3 | 1 | Venusaur |
| 4 | charmander | 4 | 1 | Charmander |
| 5 | charmeleon | 5 | 1 | Charmeleon |
| 6 | charizard | 6 | 1 | Charizard |
| 7 | squirtle | 7 | 1 | Squirtle |
| 8 | wartortle | 8 | 1 | Wartortle |
| 9 | blastoise | 9 | 1 | Blastoise |
| 10 | caterpie | 10 | 1 | Caterpie |

- Key columns: `pokemon_id` (PK), `species_id` (FK to Pokemon_Species). There are no duplicate ids, no duplicate keys and no blank cells (verified). For default rows `pokemon_id` = `species_id`, and `introduced_gen` matches the species' generation for all 493 (verified).
- Resembles: PokeAPI `pokemon.csv` (id, identifier, species_id), joined to `pokemon_species.generation_id`. It matches the Drive copy of `pokemon.csv` row for row for `species_id <= 493`: 114 forms = 10001-10015, 10033-10060, 10062-10068, 10070-10074, 10076-10085, 10087-10115, 10148-10149, 10158-10175.
- **Anomalies:**
  - The 114 forms include many that did not exist in Gen 2-4, for example 10033-10079 Megas and Primals, 10091-10115 Alolan forms, 10161-10175 Galarian forms, 10080-10099/10148/10160 Pikachu cosplay and cap forms, 10093/10149 Totems, and 10158-10159 Let's Go starters. If the roster's Pokemon dropdown draws on this tab, they will show up as choices.
  - `introduced_gen` for forms is the species' generation, not the form's.
  - Display names are generated, not official: "Nidoran F", "Nidoran M", "Farfetchd", "Mr Mime", "Ho Oh", "Mime Jr", "Porygon Z". Default rows also carry form suffixes ("Deoxys Normal", "Wormadam Plant", "Giratina Altered", "Shaymin Land"), so a user typing "Giratina" or "Mr. Mime" would get no match.
  - Rotom appliance forms (10008-10012) and Gen 4 forms (Wormadam, Shaymin-Sky, Giratina-Origin, Deoxys) are correctly present.

## Types_Master (COMPLETE)
- Range `A1:D20`: 19 data rows (all shown). Columns: `type_id`, `type_key`, `introduced_gen`, `type_name`.

| type_id | type_key | introduced_gen | type_name |
|---|---|---|---|
| 1 | normal | 1 | Normal |
| 2 | fighting | 1 | Fighting |
| 3 | flying | 1 | Flying |
| 4 | poison | 1 | Poison |
| 5 | ground | 1 | Ground |
| 6 | rock | 1 | Rock |
| 7 | bug | 1 | Bug |
| 8 | ghost | 1 | Ghost |
| 9 | steel | 2 | Steel |
| 10 | fire | 1 | Fire |
| 11 | water | 1 | Water |
| 12 | grass | 1 | Grass |
| 13 | electric | 1 | Electric |
| 14 | psychic | 1 | Psychic |
| 15 | ice | 1 | Ice |
| 16 | dragon | 1 | Dragon |
| 17 | dark | 2 | Dark |
| 10001 | unknown | 2 | Unknown |
| 10002 | shadow | 3 | Shadow |

- Resembles: PokeAPI `types.csv` filtered to `generation_id <= 4`. Fairy (id 18, gen 6) is excluded. `unknown` (10001, gen 2) and `shadow` (10002, gen 3) passed the filter.
- **Anomaly:** PokeAPI's `damage_class_id` was dropped. In Gen 1-3 that column decides whether a type's moves are physical or special (in Crystal, FireRed and Emerald all Fire moves are special, for example). Without it there is no category information for the Gen 2-3 rows.

## Pokemon_Types_Clean (COMPLETE)
- Range `A1:C891`: 890 data rows. Columns: `pokemon_id`, `type_id`, `slot`.
- First 10 rows:

| pokemon_id | type_id | slot |
|---|---|---|
| 1 | 12 | 1 |
| 1 | 4 | 2 |
| 2 | 12 | 1 |
| 2 | 4 | 2 |
| 3 | 12 | 1 |
| 3 | 4 | 2 |
| 4 | 10 | 1 |
| 5 | 10 | 1 |
| 6 | 10 | 1 |
| 6 | 3 | 2 |

- Resembles: PokeAPI `pokemon_types.csv`, which holds **current** (Gen 6+) typings, with Fairy rows removed.
- Joins (verified): every `pokemon_id` exists in Pokemon_Master, and there are no duplicate (pokemon_id, slot) pairs. 601 of 607 Pokemon have types. Only type ids 1-17 are used.
- **Anomalies (verified):**
  - **6 Pokemon have no type rows at all:** 35 Clefairy, 36 Clefable, 173 Cleffa, 175 Togepi, 209 Snubbull, 210 Granbull. These were pure Fairy in current data. In Gen 2-5 they were Normal.
  - **2 Pokemon have a slot-2 type but no slot 1:** 176 Togetic and 468 Togekiss, each with only Flying in slot 2. Their Gen 4 typing was Normal/Flying.
  - Some Pokemon came out correct only by luck, because the dropped Fairy happened to be a secondary type that did not exist then: Jigglypuff, Wigglytuff and Igglybuff (Normal), Mr. Mime and Mime Jr. (Psychic), Marill and Azumarill (Water), Azurill (Normal), the Ralts line (Psychic), Mawile (Steel).
  - **Rotom forms use Gen 5+ typings:** Heat is Electric/Fire, Wash Electric/Water, Frost Electric/Ice, Fan Electric/Flying, Mow Electric/Grass. In Platinum and HGSS every Rotom form was Electric/Ghost.
  - The correct fix is PokeAPI `pokemon_types_past.csv`, which was not used. That file may not exist in a 2021-era snapshot.

## Moves_Master (COMPLETE)
- Range `A1:D486`: 485 data rows. Columns: `move_id`, `move_key`, `introduced_gen`, `move_name`.
- First 10 rows:

| move_id | move_key | introduced_gen | move_name |
|---|---|---|---|
| 1 | pound | 1 | Pound |
| 2 | karate-chop | 1 | Karate Chop |
| 3 | double-slap | 1 | Double Slap |
| 4 | comet-punch | 1 | Comet Punch |
| 5 | mega-punch | 1 | Mega Punch |
| 6 | pay-day | 1 | Pay Day |
| 7 | fire-punch | 1 | Fire Punch |
| 8 | ice-punch | 1 | Ice Punch |
| 9 | thunder-punch | 1 | Thunder Punch |
| 10 | scratch | 1 | Scratch |

- Counts by `introduced_gen` (verified): gen 1 = 165 (ids 1-165), gen 2 = 86 (166-251), gen 3 = 121 (103 regular moves, ids 252-354, plus the 18 Shadow moves, which PokeAPI tags as gen 3), gen 4 = 113 (355-467). Ids 1-467 are all present with no gaps, plus **10001-10018 Shadow moves** (Shadow Rush ... Shadow Sky, marked gen 3). There are no duplicate names.
- Resembles: PokeAPI `moves.csv` (id, identifier, generation_id) plus `move_names.csv` (English). Type, power, PP, accuracy, priority and damage class were all dropped.
- **Anomalies / join hazards:**
  - Names are modern spellings. The Gen 4 in-game spellings used in Canon Builds do not match: "AncientPower" vs "Ancient Power", "ExtremeSpeed" vs "Extreme Speed", and "Hidden Power (Grass)/(Fire)" vs "Hidden Power" (no typed variants exist). "U-Turn" vs "U-turn" differs only in case, so it matches case-insensitive Sheets lookups but not strict comparisons. Other legacy spellings would also miss: ThunderPunch, SolarBeam, Faint Attack, ViceGrip, Hi Jump Kick, Selfdestruct, Softboiled, DynamicPunch, DragonBreath, ThunderShock, SmellingSalt, Conversion2, Sand-Attack.
  - The 18 Shadow moves are not usable in any game in Game_Map.

## Pokemon_Moves_Display (PARTIAL: 19,852 of 485,769 rows seen)
- Range `A1:H485770`: **485,769 data rows**. Columns: `pokemon_id`, `pokemon_name`, `version_group_id`, `version_group_name`, `move_id`, `move_name`, `method_name`, `level`.
- First 10 rows:

| pokemon_id | pokemon_name | version_group_id | version_group_name | move_id | move_name | method_name | level |
|---|---|---|---|---|---|---|---|
| 1 | Bulbasaur | 1 | red-blue | 14 | Swords Dance | Machine | 0 |
| 1 | Bulbasaur | 1 | red-blue | 15 | Cut | Machine | 0 |
| 1 | Bulbasaur | 1 | red-blue | 22 | Vine Whip | Level Up | 13 |
| 1 | Bulbasaur | 1 | red-blue | 33 | Tackle | Level Up | 1 |
| 1 | Bulbasaur | 1 | red-blue | 34 | Body Slam | Machine | 0 |
| 1 | Bulbasaur | 1 | red-blue | 36 | Take Down | Machine | 0 |
| 1 | Bulbasaur | 1 | red-blue | 38 | Double-Edge | Machine | 0 |
| 1 | Bulbasaur | 1 | red-blue | 45 | Growl | Level Up | 1 |
| 1 | Bulbasaur | 1 | red-blue | 72 | Mega Drain | Machine | 0 |
| 1 | Bulbasaur | 1 | red-blue | 73 | Leech Seed | Level Up | 7 |

- Resembles: PokeAPI `pokemon_moves.csv`, joined to Pokemon_Master names, version group identifiers, Moves_Master names and `pokemon_move_methods` names. The `order` column was dropped.
- Sort order (visible): pokemon_id, then version_group_id, then move_id, then method.
- **What the visible 19,852 rows show (pokemon_id 1-28 only):**
  - Version groups present: **1-20**, i.e. red-blue, yellow, gold-silver, crystal, ruby-sapphire, emerald, firered-leafgreen, diamond-pearl, platinum, heartgold-soulsilver, black-white, colosseum, xd, black-2-white-2, x-y, omega-ruby-alpha-sapphire, sun-moon, ultra-sun-ultra-moon, lets-go-pikachu-lets-go-eevee and sword-shield. Bulbasaur and Pikachu appear in all 20.
  - Only about 29% of visible rows (5,814 of 19,852) belong to the five version groups that Game_Map uses (4, 6, 7, 9, 10). That is an extrapolation from a biased sample, but it means roughly 340k of the ~486k rows are likely out of scope.
  - **The highest move_id is 466. No move above 467 appears even in version groups 11-20**, so learnsets for Gen 5-8 games are truncated to Gen 1-4 moves.
  - Methods seen: Machine 11,378; Level Up 5,731; Tutor 1,650; Egg 1,091; Stadium Surfing Pikachu 2.
  - Joins (verified on the visible rows): move_name matches Moves_Master for every row, and pokemon_name matches Pokemon_Master for every row. There are no exact duplicate rows.
  - **548 (pokemon, version group, move, method) keys repeat with different levels.** Example: Ivysaur red-blue Leech Seed at levels 1 and 7; Bulbasaur sun-moon Vine Whip at levels 7 and 9. This is faithful to PokeAPI but produces duplicate dropdown entries unless de-duplicated (MoveLists does appear to de-duplicate).
  - 29 "Level Up" rows have level 0. These are Gen 7+ evolution moves (e.g. Venusaur Petal Dance in sun-moon) and are harmless for Gen 2-4.
  - Pikachu has **no Volt Tackle row in any Gen 3-4 version group**, only Tutor rows in version groups 17-18. Gen 3-4 Volt Tackle sits on Pichu (172) under method `light-ball-egg`; those rows were not visible. Breeding_Requirements covers this case.
- Not verifiable: whether Pokemon forms (10001+) have rows, and whether any rows use methods 6-11 (light-ball-egg, colosseum-purification, xd-shadow, xd-purification, form-change, zygarde-cube).

## Move_Methods_Master (SAMPLE ONLY)
- Range `A1:C12`: 11 data rows. Columns: `method_id`, `method_key`, `method_name`.
- v3 rows 1-7 (verbatim):

| method_id | method_key | method_name |
|---|---|---|
| 1 | level-up | Level Up |
| 2 | egg | Egg |
| 3 | tutor | Tutor |
| 4 | machine | Machine |
| 5 | stadium-surfing-pikachu | Stadium Surfing Pikachu |
| 6 | light-ball-egg | Light Ball Egg |

- Backup file rows 8-10 (NOT v3; values truncated by the tool): 7 colosseum-purific... / Colosseum Purific...; 8 xd-shadow / Xd Shadow; 9 xd-purification / Xd Purification.
- Resembles: PokeAPI `pokemon_move_methods.csv`. The Drive copy lists 1 level-up, 2 egg, 3 tutor, 4 machine, 5 stadium-surfing-pikachu, 6 light-ball-egg, 7 colosseum-purification, 8 xd-shadow, 9 xd-purification, 10 form-change, 11 zygarde-cube. All 11 ids fit the range.
- Anomalies: methods 7-11 are irrelevant to the mapped games. The generated name "Xd Shadow" is awkward. Rows 8-12 were not visible in v3.

## Abilities_Master (SAMPLE ONLY)
- Range `A1:E124`: 123 data rows. Columns: `ability_id`, `ability_key`, `introduced_gen`, `main_series`, `ability_name`.
- v3 rows 1-7 (verbatim):

| ability_id | ability_key | introduced_gen | main_series | ability_name |
|---|---|---|---|---|
| 1 | stench | 3 | 1 | Stench |
| 2 | drizzle | 3 | 1 | Drizzle |
| 3 | speed-boost | 3 | 1 | Speed Boost |
| 4 | battle-armor | 3 | 1 | Battle Armor |
| 5 | sturdy | 3 | 1 | Sturdy |
| 6 | damp | 3 | 1 | Damp |

- Backup rows 8-10 (NOT v3): 7 limber, 8 sand-veil, 9 static, all gen 3 and main_series 1.
- Resembles: PokeAPI `abilities.csv` (id, identifier, generation_id, is_main_series) plus English names. 123 is exactly the Gen 3 + Gen 4 ability count (76 + 47), which fits a `generation_id <= 4` filter on ids 1-123.
- Anomalies: none visible. Rows 8-124 were not visible in v3.

## Pokemon_Abilities_Display (SAMPLE ONLY)
- Range `A1:E1614`: 1,613 data rows. Columns: `pokemon_id`, `pokemon_name`, `ability_id`, `ability_name`, `ability_slot`.
- v3 rows 1-7 (verbatim):

| pokemon_id | pokemon_name | ability_id | ability_name | ability_slot |
|---|---|---|---|---|
| 1 | Bulbasaur | 65 | Overgrow | Ability 1 |
| 2 | Ivysaur | 65 | Overgrow | Ability 1 |
| 3 | Venusaur | 65 | Overgrow | Ability 1 |
| 4 | Charmander | 66 | Blaze | Ability 1 |
| 5 | Charmeleon | 66 | Blaze | Ability 1 |
| 6 | Charizard | 66 | Blaze | Ability 1 |

- Backup rows 8-10 (NOT v3): Squirtle, Wartortle, Blastoise, each 67 Torrent, Ability 1.
- Resembles: PokeAPI `pokemon_abilities.csv` (pokemon_id, ability_id, is_hidden, slot), which holds **current-generation** ability assignments.
- Sort order: the first rows are all "Ability 1" for consecutive pokemon_ids, which suggests sorting by slot first and then pokemon.
- **Risks (not verifiable from visible rows):**
  - 1,613 rows for 607 Pokemon is about 2.66 per Pokemon. That is consistent with hidden abilities (a Gen 5 mechanic) being included.
  - Current data reflects post-Gen-4 ability changes. Gengar, for example, has had Cursed Body instead of Levitate since Gen 7. Canon Builds uses Gengar/Levitate. If the tab was built from current data and filtered to Gen 3-4 abilities, Gengar may have no slot-1 ability, or a wrong one. This cannot be confirmed.
  - The AbilityLists helper appears to exclude hidden abilities (Typhlosion showed only Blaze, Spoink/Grumpig only Own Tempo and Thick Fat).

## Pokemon_Species (SAMPLE ONLY)
- Range `A1:F494`: 493 data rows. Columns: `species_id`, `species_key`, `introduced_gen`, `evolves_from_species_id`, `evolution_chain_id`, `is_baby`.
- v3 rows 1-7 (verbatim; blank cells as shown):

| species_id | species_key | introduced_gen | evolves_from_species_id | evolution_chain_id | is_baby |
|---|---|---|---|---|---|
| 1 | bulbasaur | 1 |  | 1 | 0 |
| 2 | ivysaur | 1 | 1 | 1 | 0 |
| 3 | venusaur | 1 | 2 | 1 | 0 |
| 4 | charmander | 1 |  | 2 | 0 |
| 5 | charmeleon | 1 | 4 | 2 | 0 |
| 6 | charizard | 1 | 5 | 2 | 0 |

- Backup rows 8-10 (NOT v3): 7 squirtle 1 (blank) 3 0; 8 wartortle 1 7 3 0; 9 blastoise 1 8 3 0.
- Resembles: PokeAPI `pokemon_species.csv`, keeping 6 of its 20 columns. The standalone sheet `Pokemon_Species_Core_Gen1_4` (`1mi4Gv7GH6atpz97CBuP91oOaepyyaHP5lBYQipYXN0c`) has the same header and shows, for example, `25,pikachu,1,172,10,0`.
- **Risk:** `evolves_from_species_id` reflects current data, including baby Pokemon introduced *later* than the games they would be applied to: Azurill and Wynaut (Gen 3) and Budew, Munchlax, Happiny, Mime Jr., Bonsly, Mantyke and Chingling (Gen 4). For Crystal, Snorlax had no pre-evolution and Marill did not breed into Azurill. In Gen 3-4, several babies need an incense to be bred. Breeding_Requirements contains only the Light Ball row; **no incense requirements are present.**

## Base_Species_Map (SAMPLE ONLY)
- Range `A1:B494`: 493 data rows. Columns: `species_id`, `base_species_id`.
- v3 rows 1-7 (verbatim):

| species_id | base_species_id |
|---|---|
| 1 | 1 |
| 2 | 1 |
| 3 | 1 |
| 4 | 4 |
| 5 | 4 |
| 6 | 4 |

- Backup rows 8-10 (NOT v3): 7→7, 8→7, 9→7.
- Resembles: derived from Pokemon_Species (`evolves_from_species_id` walked to the root of the chain).
- Risk: the same generation-insensitivity as above. Snorlax would map to Munchlax (446) even for Crystal, FireRed or Emerald, and Marill to Azurill (298) even for Crystal. It is also unclear whether gender- or item-dependent bases (Nidoran, incense babies) are handled. Rows 8-494 were not visible in v3.

## Pokemon_Egg_Groups_Clean (SAMPLE ONLY)
- Range `A1:H1156`. Columns: `species_id`, `egg_group_id`, `egg_group_name`, `example_pokemon_id`, `example_pokemon_name`, (blank F), `egg_group_id`, `egg_group_name`.
- v3 rows 1-7 (verbatim):

| species_id | egg_group_id | egg_group_name | example_pokemon_id | example_pokemon_name |  | egg_group_id | egg_group_name |
|---|---|---|---|---|---|---|---|
| species_id | egg_group_id |  |  |  |  | 1 | monster |
| 1 | 1 |  |  |  |  | 2 | water1 |
| 1 | 7 |  |  |  |  | 3 | bug |
| 2 | 1 |  |  |  |  | 4 | flying |
| 2 | 7 |  |  |  |  | 5 | ground |
| 3 | 1 |  |  |  |  | 6 | fairy |

- Backup rows 8-10 (NOT v3): (3,7 / 7 plant), (4,1 / 8 humanshape), (4,14 / 9 water3).
- Resembles: PokeAPI `pokemon_egg_groups.csv` (species_id, egg_group_id) in A:B, plus a lookup table of PokeAPI `egg_groups.csv` identifiers (monster, water1, bug, flying, ground, fairy, plant, humanshape, water3, ...) in G:H.
- **Anomalies (visible):**
  - **Row 2 repeats the header** ("species_id, egg_group_id"), which looks like a CSV pasted below an existing header row. Lookups or numeric checks on column A will hit a text value there.
  - Columns C-E (`egg_group_name`, `example_pokemon_id`, `example_pokemon_name`) are **blank in all visible rows**. They may be unfilled helper columns, or formulas whose results come out blank; which one cannot be determined.
  - The G:H lookup table shares the tab with the 1,154-row fact table. Its row count is presumably 15, the PokeAPI egg-group count, but that was not visible.
- Row count: range 1,156 minus 1 header minus 1 duplicated header gives **1,154 species/egg-group pairs**. That matches the standalone Drive sheet `Pokemon_Egg_Groups_Clean` (`1RUTpEYRp-_DSw7omSRJICNdN4NUMaO_UfRfpOtVdDEM`, range A1:C1155 = 1,154 pairs, columns species_id, egg_group_id, default_pokemon_id). The first 194 species in that sheet match PokeAPI egg-group assignments, for example 25 Pikachu → 5 ground and 6 fairy, and 172 Pichu → 15 no-eggs.
