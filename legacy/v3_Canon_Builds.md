# v3 tab extract: Canon Builds

- Source: "Pokemon Master Spreadsheet v3" (`1SE6GsKSrQJlv8uGd9bFZH670e1YTQeLZasKn0W9lPek`, Drive modifiedTime 2026-01-08T15:53:23.790Z)
- Detected range in v3: `A1:V54` (22 columns, 54 rows: 1 header + 53 data rows)
- Coverage in v3: **PARTIAL. Only rows 1-7 (header + 6 data rows) were visible.** read_file_content returns 6 data rows per tab for this file, and the tab comes after the ~1 MB truncation point of the get_file_metadata snippet. Drive's full-text index also stops before this tab: searches for "Luxury Ball" and "Canon Builds" do not match v3.
- **Rows 8-54 of v3 were NOT directly visible.** Section B is a full 54-row copy from a *different* Drive file that is almost certainly a copy of this tab. It is clearly labelled as a proxy.
- All non-empty columns are included. Nickname, Build Status, Gender and Final Level are blank in every visible row, but they are kept so the column positions stay correct.
- `␠` marks significant whitespace that the tool showed (a trailing space, or a cell containing only a space).
- CSV copies: `raw/v3_Canon_Builds_rows1-7.csv` and `raw/PROXY_Untitled_spreadsheet_Canon_Builds_rows1-54.csv`.

## A. v3 Canon Builds, rows 1-7 (verbatim, verified in v3)

| Row | Pokémon | Nickname | Game | Version Group | Build Status | Nature | Ability | Gender | Shiny | Move 1 | Move 2 | Move 3 | Move 4 | Primary Move | Defining Move | Held Item | EV Spread | IV Notes | Poke Ball Type | Encounter Location | Encounter Level | Final Level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Typhlosion |  | HeartGold | HeartGold |  | Timid | Blaze |  |  | Flamethrower | Extrasensory | Eruption | Hidden Power (Grass) | Flamethrower | Extrasensory | Charcoal | 4 HP/252 SpA/252 Spe | 31/31/31/31/31/31 | Luxury Ball | New Bark Town | 5 |  |
| 3 | Tyranitar |  | HeartGold | HeartGold |  | Adamant | Sand Stream |  |  | Earthquake | Dragon Dance | Crunch | Rock Slide | Earthquake | Dragon Dance | Leftovers | 252 HP/ 252 Atk/4 Spe | 31/31/31/31/31/31 | Dusk Ball | Mt. Silver | 45 |  |
| 4 | Mamoswine |  | HeartGold | HeartGold |  | Adamant | Snow Cloak |  |  | Earthquake | AncientPower | Ice Fang | Hail | Earthquake | AncientPower | NeverMeltIce | 120 HP/252 Atk/136 Spe | 31/31/31/31/31/31 | Dive Ball | Ice Path | 33 |  |
| 5 | Crobat |  | HeartGold | HeartGold |  | Jolly | Inner Focus |  |  | Fly | U-Turn | Roost | Toxic | U-Turn | Toxic | Black Sludge | 252 HP/56 Atk/200 Spe | 31/31/31/31/31/31 | Net Ball | Dark Cave | 6 |  |
| 6 | Milotic |  | HeartGold | HeartGold |  | Bold | Marvel Scale |  |  | Surf | Recover | Ice Beam | Toxic | Surf | Recover | Leftovers | 252 HP/252 Def/4 SpA | 31/31/31/31/31/31 | Heal Ball | Mt. Coronet | 10 |  |
| 7 | Scizor |  | HeartGold | HeartGold |  | Adamant | Technician |  |  | Bullet Punch | U-Turn | Bug Bite | Roost | Bullet Punch | Roost | Life Orb | 248 HP/252 Atk/8 Spe | 31/31/31/31/31/31 | Fast Ball | National Park | 15 |  |

Rows 8-54: NOT VISIBLE in v3.

## B. PROXY: full 54-row "Canon Builds" from a different file (NOT v3)

- File: "Untitled spreadsheet", ID `1jMx5cz-xvKDYoDYrONYn-e6_NAqr5GIz-4DHkXZCwvA`, owner zacksoffer@yahoo.com, createdTime 2026-01-07T15:41:55.964Z, modifiedTime 2026-01-07T15:41:57.105Z (created and last modified about 1 second apart, consistent with a one-shot copy or paste). Its only tab is named "Canon Builds".
- Why it is treated as a proxy: the tab name is the same, the detected range is identical (`A1:V54`), the 22 headers are identical, and **rows 2-7 match v3 cell for cell**. It was created one day before v3's last modification (2026-01-08 15:53). Edits made to v3's Canon Builds after 2026-01-07 15:41 would not be reflected here. Rows 8-54 below should therefore be read as "Canon Builds as of 2026-01-07 15:41", not as verified v3 content.
- The two whitespace notes (`Timid␠` in F31, single space in D41) were inferred from the tool's per-column sample listing. Markdown padding hides whitespace, so treat them as likely but not certain.

| Row | Pokémon | Nickname | Game | Version Group | Build Status | Nature | Ability | Gender | Shiny | Move 1 | Move 2 | Move 3 | Move 4 | Primary Move | Defining Move | Held Item | EV Spread | IV Notes | Poke Ball Type | Encounter Location | Encounter Level | Final Level |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Typhlosion |  | HeartGold | HeartGold |  | Timid | Blaze |  |  | Flamethrower | Extrasensory | Eruption | Hidden Power (Grass) | Flamethrower | Extrasensory | Charcoal | 4 HP/252 SpA/252 Spe | 31/31/31/31/31/31 | Luxury Ball | New Bark Town | 5 |  |
| 3 | Tyranitar |  | HeartGold | HeartGold |  | Adamant | Sand Stream |  |  | Earthquake | Dragon Dance | Crunch | Rock Slide | Earthquake | Dragon Dance | Leftovers | 252 HP/ 252 Atk/4 Spe | 31/31/31/31/31/31 | Dusk Ball | Mt. Silver | 45 |  |
| 4 | Mamoswine |  | HeartGold | HeartGold |  | Adamant | Snow Cloak |  |  | Earthquake | AncientPower | Ice Fang | Hail | Earthquake | AncientPower | NeverMeltIce | 120 HP/252 Atk/136 Spe | 31/31/31/31/31/31 | Dive Ball | Ice Path | 33 |  |
| 5 | Crobat |  | HeartGold | HeartGold |  | Jolly | Inner Focus |  |  | Fly | U-Turn | Roost | Toxic | U-Turn | Toxic | Black Sludge | 252 HP/56 Atk/200 Spe | 31/31/31/31/31/31 | Net Ball | Dark Cave | 6 |  |
| 6 | Milotic |  | HeartGold | HeartGold |  | Bold | Marvel Scale |  |  | Surf | Recover | Ice Beam | Toxic | Surf | Recover | Leftovers | 252 HP/252 Def/4 SpA | 31/31/31/31/31/31 | Heal Ball | Mt. Coronet | 10 |  |
| 7 | Scizor |  | HeartGold | HeartGold |  | Adamant | Technician |  |  | Bullet Punch | U-Turn | Bug Bite | Roost | Bullet Punch | Roost | Life Orb | 248 HP/252 Atk/8 Spe | 31/31/31/31/31/31 | Fast Ball | National Park | 15 |  |
| 8 | Pikachu |  | SoulSilver |  |  | Jolly | Static |  |  | Thunderbolt | Volt Tackle | Iron Tail | Quick Attack | Thunderbolt | Volt Tackle | Light Ball | 4 HP/252 Atk/252 Spe | 31/31/31/31/31/31 | Poke Ball | Viridian Forest | 10 |  |
| 9 | Lucario |  | SoulSilver |  |  | Mild | Inner Focus |  |  | Aura Sphere | Close Combat | ExtremeSpeed | Vacuum Wave | Aura Sphere | Vacuum Wave | Life Orb | 64 Atk/252 SpA/192 Spe | 31/31/31/31/31/31 | Moon Ball | Iron Island (Egg) | 1 |  |
| 10 | Gyrados |  | SoulSilver |  |  | Adamant | Intimidate |  | YES | Dragon Dance | Waterfall | Earthquake | Rest | Waterfall | Rest | Leftovers | 156 HP/108 Atk/100 Def/144 Spe | 31/31/31/31/31/31 | Lure Ball | Lake of Rage | 30 |  |
| 11 | Gliscor |  | SoulSilver |  |  | Impish | Sand Veil |  |  | Earthquake | Roost | Taunt | Toxic | Earthquake | Taunt | Leftovers | 252 HP/40 Atk/216 Spe | 31/31/31/31/31/31 | Ultra Ball | Route 45 | 22 |  |
| 12 | Gengar |  | SoulSilver |  |  | Timid | Levitate |  |  | Shadow Ball | Focus Blast | Energy Ball | Destiny Bond | Shadow Ball | Focus Blast | Life Orb | 4 HP/252 SpA/252 Spe | 31/31/31/31/31/31 | Dusk Ball | Sprout Tower | 8 |  |
| 13 | Dragonite |  | SoulSilver |  |  | Mild | Inner Focus |  |  | Draco Meteor | Fire Punch | Superpower | Roost | Draco Meteor | Roost | Leftovers | 80 Atk/252 SpA/176 Spe | 31/31/31/31/31/31 | Premier Ball | Dragon's Den | 15 |  |
| 14 | Feraligatr |  | Crystal |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 15 | Miltank |  | Crystal |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 16 | Lapras |  | Crystal |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 17 | Donphan |  | Crystal |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 18 | Espeon |  | Crystal |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 19 | Umbreon |  | Crystal |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 20 | Charizard |  | FireRed |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 21 | Alakazam |  | FireRed |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 22 | Machamp |  | FireRed |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 23 | Snorlax |  | FireRed |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 24 | Blastoise |  | FireRed |  |  | Bold | Torrent |  |  | Surf | Ice Beam | Rapid Spin | Toxic | Surf | Toxic | Leftovers |  |  |  |  |  |  |
| 25 | Venesaur |  | FireRed |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 26 | Infernape |  | Platinum |  |  | Naive | Blaze |  |  | Flamethrower | Close Combat | Grass Knot | U-Turn | Flamethrower | Close Combat | Life Orb | 64 Atk/252 SpA/192 Spe | 31/31/31/31/31/31 | Poke Ball | Starter | 5 |  |
| 27 | Garchomp |  | Platinum |  |  | Jolly | Sand Veil |  |  | Earthquake | Outrage | Stone Edge | Fire Fang | Earthquake | Outrage | Life Orb | 4 HP/252 Atk/252 Spe | 31/31/31/31/31/31 | Level Ball | Wayward Cave | 15 |  |
| 28 | Weavile |  | Platinum |  |  | Jolly | Pressure |  |  | Ice Punch | Night Slash | Low Kick | Ice Shard | Ice Punch | Night Slash | Life Orb | 4 HP/252 Atk/252 Spe | 31/31/31/31/31/31 | Premier Ball | Route 217 | 34 |  |
| 29 | Empoleon |  | Platinum |  |  | Calm | Torrent |  |  | Surf | Ice Beam | Stealth Rock | Roar | Surf | Stealth Rock | Leftovers | 252 HP/4 Def/252 SpD | 31/31/31/31/31/31 | Dive Ball | Starter | 5 |  |
| 30 | Magnezone |  | Platinum |  |  | Modest | Magnet Pull |  |  | Thunderbolt | Hidden Power (Fire) | Flash Cannon | Substitute | Thunderbolt | Substitute | Leftovers | 36 HP/252 SpA/220 Spe | 31/31/31/31/31/31 | Heavy Ball | Route 222 | 40 |  |
| 31 | Roserade |  | Platinum |  |  | `Timid␠` | Natural Cure |  |  | Leaf Storm | Sludge Bomb | Sleep Powder | Toxic Spikes | Leaf Storm | Toxic Spikes | Focus Sash | 4 HP/252 SpA/252 Spe | 31/31/31/31/31/31 | Nest Ball | Route 212 | 14 |  |
| 32 | Swampert |  | Emerald |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 33 | Metagross |  | Emerald |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 34 | Meganium |  | Emerald |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 35 | Altaria |  | Emerald |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 36 | Gardevoir |  | Emerald |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 37 | Arcanine |  | Emerald |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 38 | Nidoking |  | Crystal (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 39 | Kingdra |  | FireRed (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 40 | Houndoom |  | Emerald (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 41 | Salamence |  | Platinum (RIVAL) | `␠` (single space) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 42 | Aerodactyl |  | SoulSilver (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 43 | Heracross |  | HeartGold (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 44 | Kabutops |  | Crystal (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 45 | Ursaring |  | Crystal (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 46 | Primeape |  | Crystal (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 47 | Ninetales |  | Crystal (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 48 | Sandslash |  | Crystal (RIVAL) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 49 | Raichu |  | HeartGold (Danny) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 50 | Torterra |  | HeartGold (Danny) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 51 | Combusken |  | HeartGold (Danny) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 52 | Breloom |  | HeartGold (Danny) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 53 | Flygon |  | HeartGold (Danny) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 54 | Buizel |  | HeartGold (Danny) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

## C. Earlier history from another file (NOT v3)
"Pokemon Master Spreadsheet v3 (BACKUP ENGINE WORKING)" (`1MyYTRsFkNx2hQlNBL_u16C10BhUJgJWQYN7eMDtW4cg`, created and modified 2025-12-19 04:14) had **Canon Builds `A1:S48`** with only 19 columns. It had no "Poke Ball Type", "Encounter Location" or "Encounter Level" columns, and "Final Level" was column S. Its first 9 data rows (verbatim; Nickname, Build Status, Gender, Shiny, EV Spread, IV Notes and Final Level were blank):

| Row | Pokémon | Game | Version Group | Nature | Ability | Move 1 | Move 2 | Move 3 | Move 4 | Primary Move | Defining Move | Held Item |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Typhlosion | HeartGold | HeartGold | Timid | Blaze | Flamethrower | Extrasensory | **Wil-O-Wisp** | Hidden Power (Grass) | Flamethrower | Extrasensory |  |
| 3 | Tyranitar | HeartGold | HeartGold | Adamant | Sand Stream | Earthquake | Dragon Dance | Crunch | Rock Slide | Earthquake | Dragon Dance |  |
| 4 | Mamoswine | HeartGold | HeartGold | Adamant | Snow Cloak | Earthquake | AncientPower | Ice Fang | Hail | Earthquake | AncientPower |  |
| 5 | Crobat | HeartGold | HeartGold | Jolly | Inner Focus | Fly | U-Turn | Roost | Toxic | U-Turn | Toxic |  |
| 6 | Milotic | HeartGold | HeartGold | Bold | Marvel Scale | Surf | Recover | Ice Beam | Toxic | Surf | Recover |  |
| 7 | Scizor | HeartGold | HeartGold | Adamant | Technician | Bullet Punch | U-Turn | Bug Bite | Roost | Bullet Punch | Roost |  |
| 8 | Pikachu | SoulSilver |  | Jolly | Static | Thunderbolt | Volt Tackle | Iron Tail | Quick Attack | Thunderbolt | Volt Tackle | Light Ball |
| 9 | Lucario | SoulSilver |  | Mild | Inner Focus | Aura Sphere | Close Combat | ExtremeSpeed | Vacuum Wave | Aura Sphere | Vacuum Wave | Life Orb |
| 10 | Gyrados | SoulSilver |  | Adamant | Intimidate | Dragon Dance | Waterfall | **Ice Fang** | Rest | Waterfall | Rest |  |

Differences from the later state: Typhlosion Move 3 Wil-O-Wisp became Eruption, and Gyarados Move 3 Ice Fang became Earthquake. Held items, EVs, IVs, ball, location and level were filled in later, and the tab grew from 48 to 54 rows and from 19 to 22 columns.
