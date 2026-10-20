# Scouting packet: HeartGold (completeness)

*Roster status: locked (D-006). No grades: every line below is a phrase from the phrase book (engine/battle/phrasebook.json), triggered by numbers the engine measures, the way the games turn a Pokémon's best IV into its characteristic. Speed, power and bulk are measured against every fully evolved Pokémon of the same generation. Opponents' philosophy comes from the game's own trainer AI flags, bag and battle lines. Every one-on-one is played out by the scouting engine (docs/SCOUTING_ENGINE.md): our best plan against their best answer, Smogon's calculator for every hit at the lowest roll, every move landing, the odds kept. Against a game's trainers we meet them at their top level; the coach profile is measured against that generation's Smogon OU usage field at Lv 100.*

## Self-scout

### Coach profile

Against the Gen 4 OU usage field (73 Smogon sets): **chips (p7), absorbs first (p7), safe (p21)**. 168-15-255 in 438 one-on-ones. A slider is a share of those fights; p is the percentile among 2,000 random six-Pokémon teams drawn from the field.

| Slider | ◀ | Value | ▶ | Percentile |
|---|---|---|---|---|
| Pace | absorbs first | 44 | strikes first | p7 |
| Punch | chips | 40 | knocks out | p7 |
| Run / pass | special | 69 | physical | p70 |
| Build-up | hits now | 4 | builds first | p43 |
| Sustain | no healing | 6 | heals and resets | p77 |
| Disruption | straight-up | 5 | disruptive | p34 |
| Risk | safe | 17 | gambler | p21 |
| Script | adaptive | 48 | scripted | p42 |

| Player | W-D-L | Pace | Punch | Run / pass | Build-up | Sustain | Disruption | Risk | Script |
|---|---|---|---|---|---|---|---|---|---|
| Typhlosion | 27-3-43 | 55 (p47) | 45 (p34) | 16 (p36) | 0 (p41) | 0 (p38) | 0 (p35) | 0 (p3) | 58 (p83) |
| Tyranitar | 28-0-45 | 33 (p18) | 51 (p36) | 100 (p74) | 26 (p88) | 0 (p38) | 0 (p35) | 19 (p51) | 29 (p2) |
| Mamoswine | 26-1-46 | 42 (p25) | 66 (p51) | 99 (p47) | 0 (p41) | 0 (p38) | 0 (p35) | 7 (p40) | 41 (p31) |
| Crobat | 23-2-48 | 71 (p69) | 22 (p12) | 100 (p74) | 0 (p41) | 12 (p87) | 29 (p86) | 59 (p88) | 44 (p41) |
| Lapras | 28-5-40 | 38 (p21) | 34 (p32) | 0 (p16) | 0 (p41) | 6 (p81) | 0 (p35) | 0 (p3) | 74 (p92) |
| Snorlax | 36-4-33 | 27 (p10) | 22 (p12) | 100 (p74) | 0 (p41) | 16 (p90) | 0 (p35) | 16 (p45) | 45 (p42) |

**Play sheet** (its most common call in each situation, against the field):

| Player | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|
| Typhlosion | Flamethrower (60%) | Flamethrower (60%) | Flamethrower (60%) | Flamethrower (60%) | Flamethrower (79%) | Flamethrower (60%) | Flamethrower (79%) |
| Tyranitar | Crunch (37%) | Crunch (53%) | Crunch (53%) | Crunch (53%) | Crunch (53%) | Crunch (55%) | Crunch (53%) |
| Mamoswine | Earthquake (55%) | Earthquake (55%) | Earthquake (55%) | Earthquake (47%) | Earthquake (55%) | Earthquake (55%) | Earthquake (48%) |
| Crobat | U-turn (45%) | U-turn (67%) | U-turn (60%) | U-turn (58%) | U-turn (55%) | U-turn (67%) | U-turn (44%) |
| Lapras | Ice Beam (77%) | Ice Beam (77%) | Ice Beam (68%) | Surf (56%) | Ice Beam (77%) | Ice Beam (77%) | Ice Beam (63%) |
| Snorlax | Body Slam (48%) | Body Slam (48%) | Body Slam (49%) | Body Slam (55%) | Body Slam (41%) | Body Slam (48%) | Body Slam (52%) |

*Assumed where nothing is on record: EVs 85 in every stat; IVs 31; level 100 (the peak); neutral nature.*

- **What we're trying to do:** Outlast them: Crobat, Lapras and Snorlax stay in and make the other side run out first. The anchor: Mamoswine.
- **What we're good at:** 12 attack types in the repertoire. The main ones: Ground (Mamoswine, Typhlosion and Tyranitar), Electric (Snorlax and Typhlosion), Ice (Lapras and Mamoswine) and Psychic (Snorlax and Typhlosion). Nothing is safe: 16 of 17 types take super-effective hits from this club. Crobat sets the pace; Snorlax expects to take the first hit. Closers: Mamoswine. Status: Crobat.
- **Where we're soft:** Shared holes: Water (Typhlosion, Tyranitar and Mamoswine), Grass (Tyranitar, Mamoswine and Lapras), Fighting (Tyranitar, Mamoswine, Lapras and Snorlax) and Rock (Typhlosion, Crobat and Lapras).

| Attack type | Who throws it |
|---|---|
| Ground | Typhlosion (Earthquake), Tyranitar (Earthquake), Mamoswine (Earthquake) |
| Electric | Typhlosion (Thunder Punch), Snorlax (Thunder Punch) |
| Ice | Mamoswine (Ice Fang), Mamoswine (Ice Shard), Lapras (Ice Beam) |
| Psychic | Typhlosion (Extrasensory), Snorlax (Zen Headbutt) |
| Normal | Snorlax (Body Slam) |
| Fire | Typhlosion (Flamethrower) |
| Water | Lapras (Surf) |
| Flying | Crobat (Fly) |
| Bug | Crobat (U-turn) |
| Rock | Mamoswine (Ancient Power) |
| Dragon | Tyranitar (Outrage) |
| Dark | Tyranitar (Crunch) |

## Depth chart

| Player | Philosophy | 1v1 vs the league | Build |
|---|---|---|---|
| **Mamoswine** | Finish what the others start: Ice Shard cleans up after the damage is done. | 58-4 | proposed, July 14 |
| **Tyranitar** | Win on momentum: take one free turn for Dragon Dance, then everything goes through. | 53-9 | proposed, July 14 |
| **Lapras** | Win the long game: take the hit, heal with Rest, and make the other side break first. | 53-9 | proposed, July 14 |
| **Snorlax** | Win the long game: take the hit, heal with Rest, and make the other side break first. | 53-9 | proposed, July 14 |
| **Typhlosion** | Strike first and strike hard. | 51-11 | confirmed by user, July 2026 |
| **Crobat** | Keep the matchups moving: hit with U-turn and hand the turn to the right teammate. | 49-13 | every source agrees |

## Scouting reports

### Typhlosion (Fire), HeartGold
*Flamethrower / Extrasensory / Thunder Punch / Earthquake · Blaze · build: confirmed by user, July 2026*

- **Philosophy:** Strike first and strike hard.
- **Tendencies:** Usually swings first: 78% of its generation is slower. Hits from both sides (Thunder Punch and Earthquake physical, Flamethrower and Extrasensory special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Flamethrower.
- **When it's ahead:** Ahead, it keeps throwing Flamethrower.
- **When it's behind:** Behind, it swings for the KO and hopes it lands first. Low on HP, Blaze kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Bug, Electric, Fighting, Fire, Flying, Grass, Ice, Poison, Rock, Steel and Water. Look out for Water (×2), Ground (×2) and Rock (×2).
- **How you beat it:** Hit it with something it can't hit back: Garchomp, Dugtrio, Flygon and Gliscor are the classic answers.
- **Production:** Won 51 of 62 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Charizard, Infernape and Houndoom. Pokédex, HeartGold: “If its rage peaks, it becomes so hot that anything that touches it will instantly go up in flames.”

### Tyranitar (Rock/Dark), HeartGold
*Dragon Dance / Crunch / Earthquake / Outrage · Sand Stream · @ Lum Berry · build: proposed, July 14*

- **Philosophy:** Win on momentum: take one free turn for Dragon Dance, then everything goes through.
- **Tendencies:** Expects to take the first hit: only 30% of its generation is slower. Every attack runs off its Attack stat. Out pitch: Crunch. Raw power near the top of its generation. Hard to move from either side: top-quarter bulk against physical and special hits. Commits: Outrage locks it in for two or three turns. Holds Lum Berry: it shrugs off the first status.
- **When it's ahead:** Ahead, it takes the free turn for Dragon Dance.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Dragon, Electric, Fire, Ghost, Poison, Psychic, Rock and Steel. One fatal hole: Fighting hits it four times as hard. Look out for Fighting (×4), Water (×2), Grass (×2), Ground (×2), Bug (×2) and Steel (×2). A free switch-in against Psychic.
- **Against moves:** Sand Stream: it brings a sandstorm.
- **How you beat it:** Hit it with something it can't hit back: Heracross, Hitmonlee, Gallade and Primeape are the classic answers.
- **Production:** Won 53 of 62 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Dragonite, Armaldo and Metagross. Pokédex, HeartGold: “Its body can’t be harmed by any sort of attack, so it is very eager to make challenges against enemies.”

### Mamoswine (Ice/Ground), HeartGold
*Earthquake / Ancient Power / Ice Fang / Ice Shard · Adamant · Snow Cloak · @ NeverMeltIce · build: proposed, July 14*

- **Philosophy:** Finish what the others start: Ice Shard cleans up after the damage is done.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Hits from both sides (Earthquake, Ice Fang and Ice Shard physical, Ancient Power special), and its Adamant nature takes something off Ancient Power. Out pitch: Earthquake. Raw power near the top of its generation. Built for contact: it takes physical hits much better than special ones. Holds NeverMeltIce: Ice moves hit harder.
- **When it's ahead:** Ahead, it keeps throwing Earthquake. With the other side low, Ice Shard closes the door before they can answer.
- **When it's behind:** Even behind, it can eat one more hit. Even low, Ice Shard gets one more hit in first.
- **Against types:** Feeds on Dragon, Electric, Fire, Flying, Grass, Ground, Poison, Rock and Steel. Look out for Fire (×2), Water (×2), Grass (×2), Fighting (×2) and Steel (×2). A free switch-in against Electric.
- **Against moves:** Snow Cloak: harder to hit in hail.
- **How you beat it:** Hit it with something it can't hit back: Floatzel, Starmie, Sharpedo and Heracross are the classic answers.
- **Production:** Won 58 of 62 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Garchomp, Swampert and Torterra. Pokédex, HeartGold: “A frozen MAMOSWINE was dug from ice dating back 10,000 years. This Pokémon has been around a long, long, long time.”

### Crobat (Poison/Flying), HeartGold
*Fly / Roost / U-turn / Toxic · Jolly · Inner Focus · @ Black Sludge · build: every source agrees*

- **Philosophy:** Keep the matchups moving: hit with U-turn and hand the turn to the right teammate.
- **Tendencies:** Rarely gets outrun: faster than 97% of the fully evolved Pokémon in its generation. Every attack runs off its Attack stat. Out pitch: Fly. Telegraphs: Fly takes a turn to land. Holds Black Sludge: it heals a little every turn.
- **When it's ahead:** Ahead, it spends the lead on Toxic.
- **When it's behind:** Behind, it heals with Roost.
- **Against types:** Feeds on Bug, Dark, Fighting, Grass and Psychic. Struggles to hurt Steel. Look out for Electric (×2), Ice (×2), Psychic (×2) and Rock (×2). A free switch-in against Ground.
- **Against moves:** Inner Focus: it never flinches. Toxic and poison do nothing to it.
- **How you beat it:** Hit it with something it can't hit back: Jolteon, Aerodactyl, Rampardos and Electrode are the classic answers.
- **Production:** Won 49 of 62 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Aerodactyl, Pidgeot and Fearow. Pokédex, HeartGold: “It flies so silently through the dark on its four wings that it may not be noticed even when nearby.”

### Lapras (Water/Ice), HeartGold
*Surf / Ice Beam / Rest / Heal Bell · Calm · Water Absorb · @ Leftovers · build: proposed, July 14*

- **Philosophy:** Win the long game: take the hit, heal with Rest, and make the other side break first.
- **Tendencies:** Expects to take the first hit: only 26% of its generation is slower. Every attack runs off its Sp. Atk. Out pitch: Surf. Hard to move from either side: top-quarter bulk against physical and special hits. Holds Leftovers: it heals a little every turn.
- **When it's ahead:** Ahead, it keeps throwing Surf.
- **When it's behind:** Behind, it sleeps it off with Rest and comes back at full health.
- **Against types:** Feeds on Dragon, Fire, Flying, Grass, Ground and Rock. Struggles to hurt Water. Look out for Electric (×2), Grass (×2), Fighting (×2) and Rock (×2). A free switch-in against Water.
- **Against moves:** Water Absorb: Water moves heal it instead. Any status it picks up, Rest wipes away. It cleans up status for the whole team with Heal Bell.
- **How you beat it:** Hit it with something it can't hit back: Jolteon, Electrode, Electivire and Heracross are the classic answers.
- **Production:** Won 53 of 62 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Walrein, Whiscash and Gastrodon. Pokédex, HeartGold: “They have gentle hearts. Because they rarely fight, many have been caught. Their number has dwindled.”

### Snorlax (Normal), HeartGold
*Body Slam / Rest / Thunder Punch / Zen Headbutt · Careful · Thick Fat · @ Leftovers · build: proposed, July 14*

- **Philosophy:** Win the long game: take the hit, heal with Rest, and make the other side break first.
- **Tendencies:** Expects to take the first hit: only 1% of its generation is slower. Every attack runs off its Attack stat. Out pitch: Body Slam. Hard to move from either side: top-quarter bulk against physical and special hits. Holds Leftovers: it heals a little every turn.
- **When it's ahead:** Ahead, it keeps throwing Body Slam.
- **When it's behind:** Behind, it sleeps it off with Rest and comes back at full health.
- **Against types:** Feeds on Fighting, Flying, Poison and Water. Look out for Fighting (×2). A free switch-in against Ghost.
- **Against moves:** Thick Fat: Fire and Ice moves only do half. Any status it picks up, Rest wipes away.
- **How you beat it:** Hit it with something it can't hit back: Gallade, Lucario and Medicham are the classic answers.
- **Production:** Won 53 of 62 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Lickilicky, Lapras and Muk. Pokédex, HeartGold: “What sounds like its cry may actually be its snores or the rumblings of its hungry belly.”

## Call sheets

### Call sheet vs Will (Lv 42, pret/pokeheartgold files/poketool/trainer/trainers.json #245)

- **Order:** Xatu (Lv 40), Jynx (Lv 41), Exeggutor (Lv 41), Slowbro (Lv 41), Xatu (Lv 42). Lead with Lapras: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Slowbro, which beats 2 of your 6. Your last one standing: Tyranitar.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “We Psychics don’t give up even when we’re down to the last Pokémon. That’s what makes us so formidable!” Last Pokémon at half HP: “Until we hit zero, our power is limitless. I’m not giving up yet!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Xatu L40 | U-turn · Me First · Confuse Ray · Psychic | Lapras: Ice Beam 101.8-122.8% | Tyranitar: Crunch 122.8-147.4% | — |
| Jynx L41 | Double Slap · Lovely Kiss · Ice Punch · Psychic | Tyranitar: Crunch 193.1-229.3% | Snorlax: Body Slam 87.9-104.3% | — |
| Exeggutor L41 | Reflect · Hypnosis · Egg Bomb · Psychic | Typhlosion: Flamethrower 106.4-124.8% | Tyranitar: Crunch 85.1-102.1% | — |
| Slowbro L41 | Curse · Amnesia · Water Pulse · Psychic | Snorlax: Thunder Punch 38.3-45.4% | Tyranitar: Crunch 69.5-82.3% | — |
| Xatu L42 | Aerial Ace · Ominous Wind · Confuse Ray · Psychic @ Sitrus Berry | Tyranitar: Crunch 112.6-136.1% | Lapras: Ice Beam 97.5-116% | — |

**Xatu L40**

- **Order:** Leads off.
- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Psychic (its best hit on Typhlosion, Mamoswine, Crobat, Lapras and Snorlax). Otherwise: U-turn against Tyranitar. Hits from both sides (U-turn physical, Psychic special): no single wall stops it.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark, Electric, Ice and Rock. The call: Lapras: Ice Beam 101.8-122.8%. Backup: Tyranitar: Crunch 122.8-147.4%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Jynx L41**

- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Psychic (its best hit on Typhlosion, Mamoswine, Crobat, Lapras and Snorlax). Otherwise: Ice Punch against Tyranitar. Hits from both sides (Ice Punch physical, Psychic special): no single wall stops it.
- **When it's ahead:** Expect Lovely Kiss early.
- **How to attack it:** Hit it with Bug, Dark, Fire and Rock. The call: Tyranitar: Crunch 193.1-229.3%. Backup: Snorlax: Body Slam 87.9-104.3%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Exeggutor L41**

- **Tendencies:** Gets the jump on Snorlax. Its go-to: Psychic (its best hit on Typhlosion, Mamoswine, Crobat, Lapras and Snorlax). Otherwise: Egg Bomb against Tyranitar. Hits from both sides (Egg Bomb physical, Psychic special): no single wall stops it.
- **When it's ahead:** Expect Hypnosis early.
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Bug, Dark, Fire, Flying and Ice. The call: Typhlosion: Flamethrower 106.4-124.8%. Backup: Tyranitar: Crunch 85.1-102.1%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Slowbro L41**

- **Tendencies:** You move first, every time. Its go-to: Water Pulse (its best hit on Typhlosion, Tyranitar and Mamoswine). Otherwise: Psychic against Crobat, Lapras and Snorlax.
- **When it's ahead:** Given a free turn, it sets up with Curse or Amnesia.
- **How to attack it:** Hit it with Bug, Dark and Electric. The call: Snorlax: Thunder Punch 38.3-45.4%. Backup: Tyranitar: Crunch 69.5-82.3%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Xatu L42**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Psychic (its best hit on Typhlosion, Mamoswine, Crobat, Lapras and Snorlax). Otherwise: Aerial Ace against Tyranitar. Hits from both sides (Aerial Ace physical, Ominous Wind and Psychic special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark, Electric, Ice and Rock. The call: Tyranitar: Crunch 112.6-136.1%. Backup: Lapras: Ice Beam 97.5-116%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Xatu | Lapras (W) | Ice Beam / Psychic | Ice Beam / Psychic | Ice Beam / Psychic | Ice Beam / Psychic | Ice Beam / Psychic | Ice Beam / Psychic | Ice Beam / Psychic |
| Jynx | Tyranitar (W) | Crunch / Ice Punch | Crunch / Ice Punch | Crunch / Ice Punch | Crunch / Ice Punch | Crunch / Ice Punch | Crunch / Ice Punch | Crunch / Ice Punch |
| Exeggutor | Typhlosion (W) | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic |
| Slowbro | Snorlax (W) | Thunder Punch / Psychic | Thunder Punch / Psychic | Thunder Punch / Psychic | Thunder Punch / Psychic | Thunder Punch / Psychic | Thunder Punch / Psychic | Thunder Punch / Psychic |
| Xatu | Tyranitar (W) | Crunch / Aerial Ace | Crunch / Aerial Ace | Crunch / Aerial Ace | Crunch / Aerial Ace | Crunch / Aerial Ace | Crunch / Aerial Ace | Crunch / Aerial Ace |

### Call sheet vs Koga (Lv 44, pret/pokeheartgold files/poketool/trainer/trainers.json #247)

- **Order:** Ariados (Lv 40), Venomoth (Lv 41), Forretress (Lv 43), Muk (Lv 42), Crobat (Lv 44). Lead with Typhlosion: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Forretress, which beats 1 of your 6. Your last one standing: Typhlosion.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “One Pokémon left? Ha ha ha! I’ve been counting on this one from the very beginning!” Last Pokémon at half HP: “Ooooof...”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Ariados L40 | Poison Jab · Spider Web · Baton Pass · Giga Drain | Typhlosion: Flamethrower 149.2-178% | Tyranitar: Crunch 66.1-78.8% | — |
| Venomoth L41 | Supersonic · Gust · Psychic · Toxic | Typhlosion: Flamethrower 121.7-145% | Tyranitar: Outrage 71.7-85% | — |
| Forretress L43 | Protect · Swift · Explosion · Toxic Spikes | Typhlosion: Flamethrower 258.5-304.6% | Lapras: Surf 53.1-63.1% | Crobat |
| Muk L42 | Minimize · Screech · Gunk Shot · Toxic @ Black Sludge | Mamoswine: Earthquake 126.3-150% | Tyranitar: Earthquake 77.6-92.1% | — |
| Crobat L44 | Double Team · Quick Attack · Wing Attack · Poison Fang @ Sitrus Berry | Tyranitar: Crunch 46.5-54.9% | Lapras: Ice Beam 76.1-90.1% | — |

**Ariados L40**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Poison Jab (its best hit on Typhlosion, Crobat, Lapras and Snorlax). Otherwise: Giga Drain against Tyranitar and Mamoswine. Hits from both sides (Poison Jab physical, Giga Drain special): no single wall stops it.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire, Flying, Psychic and Rock. The call: Typhlosion: Flamethrower 149.2-178%. Backup: Tyranitar: Crunch 66.1-78.8%. Its blind spot: Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax take almost nothing from it.

**Venomoth L41**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Psychic (its best hit on Typhlosion, Mamoswine, Crobat, Lapras and Snorlax). Otherwise: Gust against Tyranitar.
- **When it's ahead:** Expect Toxic early.
- **How to attack it:** Hit it with Fire, Flying, Psychic and Rock. The call: Typhlosion: Flamethrower 121.7-145%. Backup: Tyranitar: Outrage 71.7-85%. Its blind spot: Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax take almost nothing from it.

**Forretress L43**

- **Tendencies:** You move first, every time. Its go-to: Explosion (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax). Hits from both sides (Explosion physical, Swift special): no single wall stops it.
- **When it's behind:** Cornered, it can take one of yours down with it (Explosion).
- **Against moves:** Sturdy: one-hit KO moves fail. Stalls with Protect.
- **How to attack it:** Hit it with Fire. The call: Typhlosion: Flamethrower 258.5-304.6%. Backup: Lapras: Surf 53.1-63.1%. Keep Typhlosion and Crobat away from it: one hit and they're gone.

**Muk L42**

- **Tendencies:** Gets the jump on Snorlax. Its go-to: Gunk Shot (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax). Holds Black Sludge: it heals a little every turn.
- **When it's ahead:** Expect Toxic early.
- **How to attack it:** Hit it with Ground and Psychic. The call: Mamoswine: Earthquake 126.3-150%. Backup: Tyranitar: Earthquake 77.6-92.1%. Its blind spot: Tyranitar, Mamoswine and Crobat take almost nothing from it.

**Crobat L44**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Typhlosion, Tyranitar, Lapras and Snorlax. Its go-to: Wing Attack (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax). Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Electric, Ice, Psychic and Rock. The call: Tyranitar: Crunch 46.5-54.9%. Backup: Lapras: Ice Beam 76.1-90.1%. Its blind spot: Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Ariados | Typhlosion (W) | Flamethrower / Poison Jab | Flamethrower / Poison Jab | Flamethrower / Poison Jab | Flamethrower / Poison Jab | Flamethrower / Poison Jab | Flamethrower / Poison Jab | Flamethrower / Poison Jab |
| Venomoth | Typhlosion (W) | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic |
| Forretress | Typhlosion (W) | Flamethrower / Explosion | Flamethrower / Explosion | Flamethrower / Explosion | Flamethrower / Explosion | Flamethrower / Explosion | Flamethrower / Explosion | Flamethrower / Explosion |
| Muk | Mamoswine (W) | Earthquake / Gunk Shot | Earthquake / Gunk Shot | Earthquake / Gunk Shot | Earthquake / Gunk Shot | Earthquake / Gunk Shot | Earthquake / Gunk Shot | Earthquake / Gunk Shot |
| Crobat | Tyranitar (W) | Dragon Dance / Wing Attack | Crunch / Wing Attack | Crunch / Wing Attack | Crunch / Wing Attack | Crunch / Wing Attack | Crunch / Wing Attack | Crunch / Wing Attack |

### Call sheet vs Bruno (Lv 46, pret/pokeheartgold files/poketool/trainer/trainers.json #418)

- **Order:** Hitmontop (Lv 42), Hitmonlee (Lv 42), Hitmonchan (Lv 42), Onix (Lv 43), Machamp (Lv 46). Lead with Mamoswine: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Machamp, which beats 5 of your 6. Your last one standing: Typhlosion.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “Fight as hard as you can ’til you faint!” Last Pokémon at half HP: “We’re standing firm!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Hitmontop L42 | Counter · Quick Attack · Dig · Triple Kick | Mamoswine: Earthquake 80.2-96.2% | Lapras: Surf 45.3-53.8% | — |
| Hitmonlee L42 | Swagger · Focus Energy · High Jump Kick · Blaze Kick | Mamoswine: Earthquake 127.4-150% | Typhlosion: Extrasensory 62.3-73.6% | Tyranitar |
| Hitmonchan L42 | Thunder Punch · Ice Punch · Fire Punch · Bullet Punch | Typhlosion: Extrasensory 62.3-73.6% | Snorlax: Zen Headbutt 83-98.1% | — |
| Onix L43 | Dragon Breath · Earthquake · Sandstorm · Rock Slide | Mamoswine: Earthquake 112.5-133.3% | Lapras: Surf 387.5-462.5% | — |
| Machamp L46 | Rock Slide · Foresight · Revenge · Cross Chop @ Sitrus Berry | Typhlosion: Extrasensory 48.7-57.9% | — | Tyranitar |

**Hitmontop L42**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Crobat and Snorlax. Its go-to: Triple Kick (its best hit on Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Dig against Typhlosion; Quick Attack against Crobat.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Flying and Psychic. The call: Mamoswine: Earthquake 80.2-96.2%. Backup: Lapras: Surf 45.3-53.8%. Its blind spot: Mamoswine, Crobat, Lapras and Snorlax take almost nothing from it.

**Hitmonlee L42**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: High Jump Kick (its best hit on Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Blaze Kick against Crobat.
- **Against moves:** Limber: it can't be paralyzed.
- **How to attack it:** Hit it with Flying and Psychic. The call: Mamoswine: Earthquake 127.4-150%. Backup: Typhlosion: Extrasensory 62.3-73.6%. Keep Tyranitar away from it: one hit and they're gone. Its blind spot: Crobat takes almost nothing from it.

**Hitmonchan L42**

- **Tendencies:** Gets the jump on Tyranitar and Snorlax. Its go-to: Thunder Punch (its best hit on Typhlosion, Crobat, Lapras and Snorlax). Otherwise: Bullet Punch against Tyranitar; Fire Punch against Mamoswine.
- **When it's ahead:** Once you're low, Bullet Punch finishes you.
- **Against moves:** Keen Eye: its accuracy can't be lowered.
- **How to attack it:** Hit it with Flying and Psychic. The call: Typhlosion: Extrasensory 62.3-73.6%. Backup: Snorlax: Zen Headbutt 83-98.1%. Its blind spot: Typhlosion, Tyranitar and Snorlax take almost nothing from it.

**Onix L43**

- **Tendencies:** Gets the jump on Snorlax. Its go-to: Earthquake (its best hit on Typhlosion, Tyranitar, Mamoswine and Snorlax). Otherwise: Rock Slide against Crobat and Lapras. Hits from both sides (Earthquake and Rock Slide physical, Dragon Breath special): no single wall stops it.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Ground, Ice and Water. The call: Mamoswine: Earthquake 112.5-133.3%. Backup: Lapras: Surf 387.5-462.5%. Its blind spot: Mamoswine, Lapras and Snorlax take almost nothing from it.

**Machamp L46**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Crobat and Snorlax. Its go-to: Cross Chop (its best hit on Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Rock Slide against Typhlosion and Crobat. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Guts: a status condition makes it hit harder.
- **How to attack it:** Hit it with Flying and Psychic. The call: Typhlosion: Extrasensory 48.7-57.9%. Keep Tyranitar away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Hitmontop | Mamoswine (W) | Earthquake / Triple Kick | Earthquake / Triple Kick | Earthquake / Triple Kick | Earthquake / Triple Kick | Earthquake / Triple Kick | Earthquake / Triple Kick | Earthquake / Triple Kick |
| Hitmonlee | Mamoswine (W) | Earthquake / High Jump Kick | Earthquake / High Jump Kick | Earthquake / High Jump Kick | Earthquake / High Jump Kick | Earthquake / High Jump Kick | Earthquake / High Jump Kick | Earthquake / High Jump Kick |
| Hitmonchan | Typhlosion (W) | Extrasensory / Thunder Punch | Extrasensory / Thunder Punch | Extrasensory / Thunder Punch | Extrasensory / Thunder Punch | Flamethrower / Thunder Punch | Extrasensory / Thunder Punch | Flamethrower / Thunder Punch |
| Onix | Mamoswine (W) | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake |
| Machamp | Typhlosion (W) | Extrasensory / Rock Slide | Extrasensory / Rock Slide | Extrasensory / Rock Slide | Extrasensory / Rock Slide | Flamethrower / Rock Slide | Extrasensory / Rock Slide | Flamethrower / Rock Slide |

### Call sheet vs Karen (Lv 47, pret/pokeheartgold files/poketool/trainer/trainers.json #246)

- **Order:** Umbreon (Lv 42), Vileplume (Lv 42), Gengar (Lv 45), Murkrow (Lv 44), Houndoom (Lv 47). Lead with Tyranitar: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Umbreon, which beats 0 of your 6. Your last one standing: Typhlosion.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “This is far from being backed into a corner!” Last Pokémon at half HP: “You’re no ordinary Trainer to have gotten this far.”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Umbreon L42 | Double Team · Confuse Ray · Feint Attack · Payback | Tyranitar: Outrage 40.3-47.9% | Mamoswine: Earthquake 54.2-64.6% | — |
| Vileplume L42 | Stun Spore · Acid · Moonlight · Petal Dance | Typhlosion: Flamethrower 108.7-129.1% | Snorlax: Zen Headbutt 64.6-77.2% | — |
| Gengar L45 | Lick · Spite · Focus Blast · Destiny Bond | Typhlosion: Extrasensory 68.9-82% | Tyranitar: Crunch 144.3-172.1% | — |
| Murkrow L44 | Pluck · Whirlwind · Sucker Punch · Feint Attack | Tyranitar: Outrage 96.7-114.2% | Mamoswine: Ice Fang 201.7-240% | — |
| Houndoom L47 | Nasty Plot · Dark Pulse · Flamethrower · Crunch @ Sitrus Berry | Tyranitar: Earthquake 113.5-134.8% | Typhlosion: Earthquake 79.4-95% | — |

**Umbreon L42**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Snorlax. Its go-to: Payback (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat and Lapras). Otherwise: Feint Attack against Snorlax.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Bug. The call: Tyranitar: Outrage 40.3-47.9%. Backup: Mamoswine: Earthquake 54.2-64.6%. Its blind spot: Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax take almost nothing from it.

**Vileplume L42**

- **Tendencies:** Gets the jump on Snorlax. Its go-to: Petal Dance (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax).
- **When it's ahead:** Expect Stun Spore early.
- **When it's behind:** When it's low, it heals itself with Moonlight.
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Fire, Flying, Ice and Psychic. The call: Typhlosion: Flamethrower 108.7-129.1%. Backup: Snorlax: Zen Headbutt 64.6-77.2%. Its blind spot: Typhlosion, Crobat and Snorlax take almost nothing from it.

**Gengar L45**

- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Focus Blast (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax).
- **When it's behind:** Cornered, it can take one of yours down with it (Destiny Bond).
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark and Psychic. The call: Typhlosion: Extrasensory 68.9-82%. Backup: Tyranitar: Crunch 144.3-172.1%. Its blind spot: Crobat takes almost nothing from it.

**Murkrow L44**

- **Tendencies:** You move first, every time. Its go-to: Sucker Punch (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax).
- **When it's ahead:** Once you're low, Sucker Punch finishes you.
- **Against moves:** Insomnia: it can't be put to sleep. If you set up, it forces you out with Whirlwind.
- **How to attack it:** Hit it with Electric, Ice and Rock. The call: Tyranitar: Outrage 96.7-114.2%. Backup: Mamoswine: Ice Fang 201.7-240%. Its blind spot: Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax take almost nothing from it.

**Houndoom L47**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Flamethrower (its best hit on Tyranitar, Mamoswine, Crobat and Lapras). Otherwise: Dark Pulse against Typhlosion; Crunch against Snorlax. Hits from both sides (Crunch physical, Dark Pulse and Flamethrower special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Nasty Plot.
- **How to attack it:** Hit it with Ground, Rock and Water. The call: Tyranitar: Earthquake 113.5-134.8%. Backup: Typhlosion: Earthquake 79.4-95%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Umbreon | Tyranitar (W) | Outrage / Payback | Outrage / Payback | Outrage / Payback | Outrage / Payback | Outrage / Payback | Outrage / Payback | Outrage / Payback |
| Vileplume | Typhlosion (W) | Flamethrower / Petal Dance | Flamethrower / Petal Dance | Flamethrower / Petal Dance | Flamethrower / Petal Dance | Flamethrower / Moonlight | Flamethrower / Petal Dance | Flamethrower / Moonlight |
| Gengar | Typhlosion (W) | Extrasensory / Focus Blast | Extrasensory / Focus Blast | Extrasensory / Focus Blast | Extrasensory / Focus Blast | Flamethrower / Focus Blast | Extrasensory / Focus Blast | Flamethrower / Focus Blast |
| Murkrow | Tyranitar (W) | Outrage / Whirlwind | Outrage / Whirlwind | Outrage / Whirlwind | Outrage / Whirlwind | Outrage / Whirlwind | Outrage / Whirlwind | Outrage / Whirlwind |
| Houndoom | Tyranitar (W) | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower |

### Call sheet vs Champion Lance (Lv 50, pret/pokeheartgold files/poketool/trainer/trainers.json #244)

- **Order:** Gyarados (Lv 46), Dragonite (Lv 49), Dragonite (Lv 49), Aerodactyl (Lv 48), Charizard (Lv 48), Dragonite (Lv 50). Lead with Lapras: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Aerodactyl, which beats 2 of your 6. Your last one standing: Tyranitar.
- **The bag:** 4 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “All right! I thought this would never happen!” Last Pokémon at half HP: “I never give up, no matter what. You must be the same?”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Gyarados L46 | Flail · Dragon Pulse · Waterfall · Ice Fang | Lapras: Ice Beam 36.9-43.3% | Snorlax: Thunder Punch 114.6-135% | — |
| Dragonite L49 | Thunder Wave · Dragon Rush · Thunder · Hyper Beam | Mamoswine: Ice Fang 172.8-207.4% | Tyranitar: Outrage 82.7-97.5% | — |
| Dragonite L49 | Thunder Wave · Dragon Rush · Blizzard · Hyper Beam | Mamoswine: Ice Fang 172.8-207.4% | Tyranitar: Outrage 82.7-97.5% | — |
| Aerodactyl L48 | Aerial Ace · Crunch · Rock Slide · Thunder Fang | Snorlax: Thunder Punch 67.1-79.2% | Tyranitar: Crunch 62.4-73.2% | — |
| Charizard L48 | Shadow Claw · Air Slash · Dragon Claw · Fire Fang | Snorlax: Thunder Punch 58.5-69.4% | Tyranitar: Crunch 53.7-63.9% | — |
| Dragonite L50 | Fire Blast · Safeguard · Outrage · Hyper Beam @ Sitrus Berry | Mamoswine: Ice Fang 161.4-195.2% | Tyranitar: Outrage 78.3-92.8% | — |

**Gyarados L46**

- **Order:** Leads off.
- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Waterfall (its best hit on Typhlosion, Tyranitar, Mamoswine and Snorlax). Otherwise: Ice Fang against Crobat; Dragon Pulse against Lapras. Hits from both sides (Waterfall and Ice Fang physical, Dragon Pulse special): no single wall stops it.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric and Rock. The call: Lapras: Ice Beam 36.9-43.3%. Backup: Snorlax: Thunder Punch 114.6-135%. Its blind spot: Lapras and Snorlax take almost nothing from it.

**Dragonite L49**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Dragon Rush (its best hit on Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Thunder against Crobat. Hits from both sides (Dragon Rush physical, Thunder and Hyper Beam special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Dragon, Ice and Rock. The call: Mamoswine: Ice Fang 172.8-207.4%. Backup: Tyranitar: Outrage 82.7-97.5%.

**Dragonite L49**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Dragon Rush (its best hit on Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Blizzard against Crobat. Hits from both sides (Dragon Rush physical, Blizzard and Hyper Beam special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Dragon, Ice and Rock. The call: Mamoswine: Ice Fang 172.8-207.4%. Backup: Tyranitar: Outrage 82.7-97.5%.

**Aerodactyl L48**

- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Rock Slide (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax).
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Electric, Ice, Rock and Water. The call: Snorlax: Thunder Punch 67.1-79.2%. Backup: Tyranitar: Crunch 62.4-73.2%. Its blind spot: Tyranitar, Mamoswine and Snorlax take almost nothing from it.

**Charizard L48**

- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Air Slash (its best hit on Typhlosion, Crobat, Lapras and Snorlax). Otherwise: Dragon Claw against Tyranitar; Fire Fang against Mamoswine. Hits from both sides (Shadow Claw, Dragon Claw and Fire Fang physical, Air Slash special): no single wall stops it.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Electric, Rock and Water. The call: Snorlax: Thunder Punch 58.5-69.4%. Backup: Tyranitar: Crunch 53.7-63.9%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Dragonite L50**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Outrage (its best hit on Typhlosion, Tyranitar, Crobat, Lapras and Snorlax). Otherwise: Fire Blast against Mamoswine. Hits from both sides (Outrage physical, Fire Blast and Hyper Beam special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Dragon, Ice and Rock. The call: Mamoswine: Ice Fang 161.4-195.2%. Backup: Tyranitar: Outrage 78.3-92.8%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Gyarados | Lapras (W) | Ice Beam / Dragon Pulse | Ice Beam / Dragon Pulse | Ice Beam / Dragon Pulse | Ice Beam / Dragon Pulse | Ice Beam / Dragon Pulse | Ice Beam / Dragon Pulse | Ice Beam / Dragon Pulse |
| Dragonite | Mamoswine (W) | Ice Shard / Dragon Rush | Ice Shard / Dragon Rush | Ice Shard / Dragon Rush | Ice Shard / Hyper Beam | Ice Shard / Dragon Rush | Ice Shard / Dragon Rush | Ice Shard / Hyper Beam |
| Dragonite | Mamoswine (W) | Ice Shard / Dragon Rush | Ice Shard / Dragon Rush | Ice Shard / Dragon Rush | Ice Shard / Hyper Beam | Ice Shard / Dragon Rush | Ice Shard / Dragon Rush | Ice Shard / Hyper Beam |
| Aerodactyl | Snorlax (W) | Thunder Punch / Rock Slide | Thunder Punch / Rock Slide | Thunder Punch / Rock Slide | Thunder Punch / Rock Slide | Thunder Punch / Rock Slide | Thunder Punch / Rock Slide | Thunder Punch / Rock Slide |
| Charizard | Snorlax (W) | Thunder Punch / Air Slash | Thunder Punch / Air Slash | Thunder Punch / Air Slash | Thunder Punch / Air Slash | Thunder Punch / Air Slash | Thunder Punch / Air Slash | Thunder Punch / Air Slash |
| Dragonite | Mamoswine (W) | Ice Shard / Fire Blast | Ice Shard / Fire Blast | Ice Shard / Fire Blast | Ice Shard / Outrage | Ice Shard / Fire Blast | Ice Shard / Fire Blast | Ice Shard / Outrage |

### Call sheet vs Red (Lv 88, pret/pokeheartgold files/poketool/trainer/trainers.json #260)

- **Order:** Pikachu (Lv 88), Lapras (Lv 80), Snorlax (Lv 82), Venusaur (Lv 84), Charizard (Lv 84), Blastoise (Lv 84). Lead with Typhlosion: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Pikachu, which beats 1 of your 6. Your last one standing: Tyranitar.
- **The bag:** 4 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Pikachu L88 | Volt Tackle · Iron Tail · Quick Attack · Thunderbolt @ Light Ball | Typhlosion: Earthquake 160.2-189.2% | Mamoswine: Earthquake 371-436.6% | Crobat |
| Lapras L80 | Blizzard · Brine · Psychic · Body Slam | Snorlax: Thunder Punch 46-54.7% | Lapras: Surf 15.5-18.3% | — |
| Snorlax L82 | Shadow Ball · Crunch · Blizzard · Giga Impact | Tyranitar: Crunch 42.2-49.9% | Snorlax: Body Slam 38-45.1% | — |
| Venusaur L84 | Sludge Bomb · Giga Drain · Sleep Powder · Frenzy Plant | Typhlosion: Flamethrower 86.2-102.8% | Tyranitar: Crunch 51-60.5% | — |
| Charizard L84 | Flare Blitz · Air Slash · Blast Burn · Dragon Pulse | Tyranitar: Crunch 54-64% | Snorlax: Thunder Punch 58.4-68.8% | Mamoswine |
| Blastoise L84 | Focus Blast · Hydro Cannon · Blizzard · Flash Cannon | Lapras: Surf 17.5-20.7% | Snorlax: Thunder Punch 47-55.8% | — |

**Pikachu L88**

- **Order:** Leads off.
- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Volt Tackle (its best hit on Typhlosion, Crobat, Lapras and Snorlax). Otherwise: Iron Tail against Tyranitar and Mamoswine. Hits from both sides (Volt Tackle, Iron Tail and Quick Attack physical, Thunderbolt special): no single wall stops it. Holds Light Ball: its attacks hit twice as hard.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Static: touching it can paralyze you.
- **How to attack it:** Hit it with Ground. The call: Typhlosion: Earthquake 160.2-189.2%. Backup: Mamoswine: Earthquake 371-436.6%. Keep Crobat away from it: one hit and they're gone.

**Lapras L80**

- **Tendencies:** Gets the jump on Snorlax. Its go-to: Brine (its best hit on Typhlosion, Tyranitar and Mamoswine). Otherwise: Body Slam against Lapras and Snorlax; Blizzard against Crobat. Hits from both sides (Body Slam physical, Blizzard, Brine and Psychic special): no single wall stops it.
- **Against moves:** Water Absorb: Water moves heal it instead.
- **How to attack it:** Hit it with Electric and Rock. The call: Snorlax: Thunder Punch 46-54.7%. Backup: Lapras: Surf 15.5-18.3%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Snorlax L82**

- **Tendencies:** You move first, every time. Its go-to: Giga Impact (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax). Hits from both sides (Crunch and Giga Impact physical, Shadow Ball and Blizzard special): no single wall stops it.
- **Against moves:** Immunity: it can't be poisoned.
- **How to attack it:** The call: Tyranitar: Crunch 42.2-49.9%. Backup: Snorlax: Body Slam 38-45.1%. Its blind spot: Tyranitar takes almost nothing from it.

**Venusaur L84**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Frenzy Plant (its best hit on Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Sludge Bomb against Typhlosion and Crobat.
- **When it's ahead:** Expect Sleep Powder early.
- **Against moves:** Overgrow: Grass moves hit harder when it's low.
- **How to attack it:** Hit it with Fire, Flying, Ice and Psychic. The call: Typhlosion: Flamethrower 86.2-102.8%. Backup: Tyranitar: Crunch 51-60.5%. Keep Mamoswine away from it: one hit and they're gone. Its blind spot: Crobat and Snorlax take almost nothing from it.

**Charizard L84**

- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Blast Burn (its best hit on Tyranitar, Mamoswine, Crobat and Lapras). Otherwise: Air Slash against Typhlosion; Flare Blitz against Snorlax. Hits from both sides (Flare Blitz physical, Air Slash, Blast Burn and Dragon Pulse special): no single wall stops it.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Electric, Rock and Water. The call: Tyranitar: Crunch 54-64%. Backup: Snorlax: Thunder Punch 58.4-68.8%. Keep Mamoswine away from it: one hit and they're gone. Its blind spot: Tyranitar and Snorlax take almost nothing from it.

**Blastoise L84**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Focus Blast (its best hit on Tyranitar, Lapras and Snorlax). Otherwise: Hydro Cannon against Typhlosion and Mamoswine; Blizzard against Crobat.
- **Against moves:** Torrent: Water moves hit harder when it's low.
- **How to attack it:** Hit it with Electric. The call: Lapras: Surf 17.5-20.7%. Backup: Snorlax: Thunder Punch 47-55.8%. Its blind spot: Snorlax takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Pikachu | Typhlosion (W) | Earthquake / Volt Tackle | Earthquake / Volt Tackle | Earthquake / Volt Tackle | Earthquake / Thunderbolt | Flamethrower / Volt Tackle | Earthquake / Volt Tackle | Flamethrower / Thunderbolt |
| Lapras | Snorlax (W) | Thunder Punch / Body Slam | Thunder Punch / Body Slam | Thunder Punch / Body Slam | Thunder Punch / Body Slam | Thunder Punch / Body Slam | Thunder Punch / Body Slam | Thunder Punch / Body Slam |
| Snorlax | Tyranitar (W) | Crunch / Giga Impact | Crunch / Giga Impact | Crunch / Giga Impact | Crunch / Giga Impact | Crunch / Giga Impact | Crunch / Giga Impact | Crunch / Giga Impact |
| Venusaur | Typhlosion (W) | Flamethrower / Sludge Bomb | Flamethrower / Sludge Bomb | Flamethrower / Sludge Bomb | Flamethrower / Sludge Bomb | Flamethrower / Frenzy Plant | Flamethrower / Sludge Bomb | Flamethrower / Sludge Bomb |
| Charizard | Tyranitar (W) | Crunch / Blast Burn | Crunch / Blast Burn | Crunch / Blast Burn | Crunch / Blast Burn | Crunch / Blast Burn | Crunch / Blast Burn | Crunch / Blast Burn |
| Blastoise | Lapras (W) | Ice Beam / Focus Blast | Ice Beam / Focus Blast | Ice Beam / Focus Blast | Ice Beam / Focus Blast | Rest / Focus Blast | Ice Beam / Focus Blast | Ice Beam / Focus Blast |

### Call sheet vs Will (rematch) (Lv 62, pret/pokeheartgold files/poketool/trainer/trainers.json #702)

- **Order:** Bronzong (Lv 58), Jynx (Lv 60), Grumpig (Lv 59), Slowbro (Lv 60), Gardevoir (Lv 61), Xatu (Lv 62). Lead with Mamoswine: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Bronzong, which beats 1 of your 6. Your last one standing: Typhlosion.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “We Psychics don’t give up even when we’re down to the last Pokémon. That’s what makes us so formidable!” Last Pokémon at half HP: “Until we hit zero, our power is limitless. I’m not giving up yet!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Bronzong L58 | Reflect · Payback · Gravity · Psychic | Mamoswine: Earthquake 114.1-136.2% | Tyranitar: Earthquake 71.2-84.7% | — |
| Jynx L60 | Fake Tears · Lovely Kiss · Blizzard · Dream Eater | Tyranitar: Crunch 200-236.1% | Snorlax: Body Slam 91-107.2% | — |
| Grumpig L59 | Confuse Ray · Signal Beam · Power Gem · Psychic | Tyranitar: Crunch 120.4-143.6% | Snorlax: Body Slam 55.2-65.2% | — |
| Slowbro L60 | Curse · Amnesia · Body Slam · Psychic | Tyranitar: Crunch 69.3-83.2% | Snorlax: Thunder Punch 37.6-44.6% | — |
| Gardevoir L61 | Focus Blast · Charge Beam · Calm Mind · Psychic | Snorlax: Body Slam 55.8-66.3% | Crobat: U-turn 52.3-62.8% | — |
| Xatu L62 | Quick Attack · Shadow Ball · Confuse Ray · Psychic @ Sitrus Berry | Tyranitar: Crunch 115.8-136.8% | Lapras: Ice Beam 95.9-113.5% | — |

**Bronzong L58**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Typhlosion, Mamoswine, Crobat and Lapras). Otherwise: Payback against Tyranitar and Snorlax. Hits from both sides (Payback physical, Psychic special): no single wall stops it.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Fire. The call: Mamoswine: Earthquake 114.1-136.2%. Backup: Tyranitar: Earthquake 71.2-84.7%. Its blind spot: Typhlosion, Tyranitar, Lapras and Snorlax take almost nothing from it.

**Jynx L60**

- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Dream Eater (its best hit on Typhlosion, Lapras and Snorlax). Otherwise: Blizzard against Tyranitar, Mamoswine and Crobat.
- **When it's ahead:** Expect Lovely Kiss early.
- **How to attack it:** Hit it with Bug, Dark, Fire and Rock. The call: Tyranitar: Crunch 200-236.1%. Backup: Snorlax: Body Slam 91-107.2%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Grumpig L59**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Psychic (its best hit on Mamoswine, Crobat and Snorlax). Otherwise: Power Gem against Typhlosion and Lapras; Signal Beam against Tyranitar.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Bug and Dark. The call: Tyranitar: Crunch 120.4-143.6%. Backup: Snorlax: Body Slam 55.2-65.2%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Slowbro L60**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Typhlosion, Mamoswine, Crobat, Lapras and Snorlax). Otherwise: Body Slam against Tyranitar. Hits from both sides (Body Slam physical, Psychic special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Curse or Amnesia.
- **How to attack it:** Hit it with Bug, Dark and Electric. The call: Tyranitar: Crunch 69.3-83.2%. Backup: Snorlax: Thunder Punch 37.6-44.6%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Gardevoir L61**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Focus Blast (its best hit on Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Psychic against Typhlosion and Crobat.
- **When it's ahead:** Given a free turn, it sets up with Calm Mind.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Bug and Dark. The call: Snorlax: Body Slam 55.8-66.3%. Backup: Crobat: U-turn 52.3-62.8%.

**Xatu L62**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Psychic (its best hit on Typhlosion, Mamoswine, Crobat, Lapras and Snorlax). Otherwise: Shadow Ball against Tyranitar. Hits from both sides (Quick Attack physical, Shadow Ball and Psychic special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Expect Confuse Ray early. Once you're low, Quick Attack finishes you.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark, Electric, Ice and Rock. The call: Tyranitar: Crunch 115.8-136.8%. Backup: Lapras: Ice Beam 95.9-113.5%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Bronzong | Mamoswine (W) | Earthquake / Psychic | Earthquake / Psychic | Earthquake / Psychic | Earthquake / Psychic | Earthquake / Psychic | Earthquake / Psychic | Earthquake / Psychic |
| Jynx | Tyranitar (W) | Crunch / Blizzard | Crunch / Blizzard | Crunch / Blizzard | Crunch / Blizzard | Crunch / Blizzard | Crunch / Blizzard | Crunch / Blizzard |
| Grumpig | Tyranitar (W) | Crunch / Signal Beam | Crunch / Signal Beam | Crunch / Signal Beam | Crunch / Signal Beam | Crunch / Signal Beam | Crunch / Signal Beam | Crunch / Signal Beam |
| Slowbro | Tyranitar (W) | Crunch / Body Slam | Crunch / Body Slam | Crunch / Body Slam | Crunch / Body Slam | Crunch / Body Slam | Crunch / Body Slam | Crunch / Body Slam |
| Gardevoir | Snorlax (W) | Body Slam / Focus Blast | Body Slam / Focus Blast | Body Slam / Focus Blast | Body Slam / Focus Blast | Body Slam / Focus Blast | Body Slam / Focus Blast | Body Slam / Focus Blast |
| Xatu | Tyranitar (W) | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball |

### Call sheet vs Koga (rematch) (Lv 64, pret/pokeheartgold files/poketool/trainer/trainers.json #703)

- **Order:** Skuntank (Lv 61), Venomoth (Lv 63), Toxicroak (Lv 60), Muk (Lv 62), Crobat (Lv 64), Swalot (Lv 62). Lead with Mamoswine: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Skuntank, which beats 1 of your 6. Your last one standing: Tyranitar.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “One Pokémon left? Ha ha ha! I’ve been counting on this one from the very beginning!” Last Pokémon at half HP: “Ooooof...”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Skuntank L61 | Sucker Punch · Dig · Toxic · Explosion | Mamoswine: Earthquake 138.3-163.6% | Tyranitar: Earthquake 86-101.9% | Typhlosion |
| Venomoth L63 | Double Team · Baton Pass · Psychic · Silver Wind | Typhlosion: Flamethrower 110-130% | Mamoswine: Earthquake 87.2-103.3% | — |
| Toxicroak L60 | Cross Chop · X-Scissor · Swagger · Gunk Shot | Typhlosion: Extrasensory 139-164.7% | Mamoswine: Earthquake 163.6-193.6% | — |
| Muk L62 | Minimize · Screech · Swagger · Toxic @ Black Sludge | Mamoswine: Earthquake 122.7-144.5% | Tyranitar: Earthquake 76.4-90% | — |
| Crobat L64 | Toxic · Mean Look · Fly · Cross Poison | Tyranitar: Crunch 46-54% | Mamoswine: Ice Fang 95-112.9% | — |
| Swalot L62 | Yawn · Amnesia · Pain Split · Sludge Bomb @ Leftovers | Mamoswine: Earthquake 115.9-137.4% | Tyranitar: Earthquake 72-85% | — |

**Skuntank L61**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Explosion (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax).
- **When it's ahead:** Expect Toxic early. Once you're low, Sucker Punch finishes you.
- **When it's behind:** Cornered, it can take one of yours down with it (Explosion).
- **How to attack it:** Hit it with Ground. The call: Mamoswine: Earthquake 138.3-163.6%. Backup: Tyranitar: Earthquake 86-101.9%. Keep Typhlosion away from it: one hit and they're gone.

**Venomoth L63**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Psychic (its best hit on Typhlosion, Crobat and Lapras). Otherwise: Silver Wind against Tyranitar, Mamoswine and Snorlax.
- **How to attack it:** Hit it with Fire, Flying, Psychic and Rock. The call: Typhlosion: Flamethrower 110-130%. Backup: Mamoswine: Earthquake 87.2-103.3%. Its blind spot: Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax take almost nothing from it.

**Toxicroak L60**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Cross Chop (its best hit on Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Gunk Shot against Typhlosion and Crobat.
- **How to attack it:** Hit it with Flying, Ground and Psychic. The call: Typhlosion: Extrasensory 139-164.7%. Backup: Mamoswine: Earthquake 163.6-193.6%. Its blind spot: Crobat takes almost nothing from it.

**Muk L62**

- **Tendencies:** You move first, every time. Holds Black Sludge: it heals a little every turn.
- **When it's ahead:** Expect Toxic early.
- **How to attack it:** Hit it with Ground and Psychic. The call: Mamoswine: Earthquake 122.7-144.5%. Backup: Tyranitar: Earthquake 76.4-90%. Its blind spot: Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax take almost nothing from it.

**Crobat L64**

- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Fly (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax).
- **When it's ahead:** Expect Toxic early.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Electric, Ice, Psychic and Rock. The call: Tyranitar: Crunch 46-54%. Backup: Mamoswine: Ice Fang 95-112.9%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Swalot L62**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Snorlax. Its go-to: Sludge Bomb (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax). Holds Leftovers: it heals a little every turn.
- **When it's ahead:** Given a free turn, it sets up with Amnesia. Expect Yawn early.
- **How to attack it:** Hit it with Ground and Psychic. The call: Mamoswine: Earthquake 115.9-137.4%. Backup: Tyranitar: Earthquake 72-85%. Its blind spot: Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Skuntank | Mamoswine (W) | Earthquake / Explosion | Earthquake / Explosion | Earthquake / Explosion | Ice Shard / Sucker Punch | Earthquake / Explosion | Earthquake / Explosion | Ice Shard / Sucker Punch |
| Venomoth | Typhlosion (W) | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic |
| Toxicroak | Typhlosion (W) | Extrasensory / Gunk Shot | Extrasensory / Gunk Shot | Extrasensory / Gunk Shot | Extrasensory / Cross Chop | Extrasensory / Gunk Shot | Extrasensory / Gunk Shot | Extrasensory / Cross Chop |
| Muk | Mamoswine (W) | Earthquake / Minimize | Earthquake / Minimize | Earthquake / Minimize | Earthquake / Minimize | Earthquake / Screech | Earthquake / Minimize | Earthquake / Screech |
| Crobat | Tyranitar (W) | Dragon Dance / Fly | Crunch / Fly | Crunch / Fly | Crunch / Fly | Crunch / Fly | Crunch / Fly | Crunch / Fly |
| Swalot | Mamoswine (W) | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb | Earthquake / Pain Split | Earthquake / Sludge Bomb | Earthquake / Pain Split |

### Call sheet vs Bruno (rematch) (Lv 64, pret/pokeheartgold files/poketool/trainer/trainers.json #704)

- **Order:** Hitmontop (Lv 62), Hitmonlee (Lv 61), Hitmonchan (Lv 61), Hariyama (Lv 62), Machamp (Lv 64), Lucario (Lv 64). Lead with Typhlosion: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Machamp, which beats 5 of your 6. Your last one standing: Typhlosion.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “Fight as hard as you can ’til you faint!” Last Pokémon at half HP: “We’re standing firm!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Hitmontop L62 | Counter · Quick Attack · Close Combat · Earthquake | Typhlosion: Extrasensory 53.9-64.5% | Lapras: Surf 40.1-48% | Tyranitar |
| Hitmonlee L61 | Swagger · Close Combat · Reversal · Blaze Kick | Mamoswine: Earthquake 118.7-140.7% | Typhlosion: Extrasensory 56-66.7% | Tyranitar |
| Hitmonchan L61 | Substitute · Drain Punch · Close Combat · Bullet Punch | Typhlosion: Extrasensory 56-66.7% | Mamoswine: Earthquake 86.7-102.7% | Tyranitar |
| Hariyama L62 | Low Kick · Payback · Bullet Punch · Bulk Up @ Sitrus Berry | Typhlosion: Extrasensory 50.6-59.5% | Crobat: Fly 72.1-85.5% | Tyranitar |
| Machamp L64 | Bullet Punch · Foresight · Stone Edge · Dynamic Punch | Mamoswine: Earthquake 59.6-70.7% | — | Tyranitar |
| Lucario L64 | Extreme Speed · Close Combat · Counter · Iron Tail | Typhlosion: Flamethrower 113.2-135.2% | Mamoswine: Earthquake 151.6-179.1% | Tyranitar |

**Hitmontop L62**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Crobat and Snorlax. Its go-to: Close Combat (its best hit on Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Earthquake against Typhlosion; Quick Attack against Crobat.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Flying and Psychic. The call: Typhlosion: Extrasensory 53.9-64.5%. Backup: Lapras: Surf 40.1-48%. Keep Tyranitar away from it: one hit and they're gone. Its blind spot: Crobat takes almost nothing from it.

**Hitmonlee L61**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Close Combat (its best hit on Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Blaze Kick against Crobat.
- **Against moves:** Limber: it can't be paralyzed.
- **How to attack it:** Hit it with Flying and Psychic. The call: Mamoswine: Earthquake 118.7-140.7%. Backup: Typhlosion: Extrasensory 56-66.7%. Keep Tyranitar away from it: one hit and they're gone. Its blind spot: Crobat takes almost nothing from it.

**Hitmonchan L61**

- **Tendencies:** Moves first against Crobat, Lapras and Snorlax. Its go-to: Close Combat (its best hit on Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Bullet Punch against Crobat.
- **When it's ahead:** Once you're low, Bullet Punch finishes you.
- **Against moves:** Keen Eye: its accuracy can't be lowered.
- **How to attack it:** Hit it with Flying and Psychic. The call: Typhlosion: Extrasensory 56-66.7%. Backup: Mamoswine: Earthquake 86.7-102.7%. Keep Tyranitar away from it: one hit and they're gone. Its blind spot: Crobat takes almost nothing from it.

**Hariyama L62**

- **Tendencies:** Gets the jump on Snorlax. Its go-to: Low Kick (its best hit on Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Payback against Crobat. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Bulk Up. Once you're low, Bullet Punch finishes you.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Flying and Psychic. The call: Typhlosion: Extrasensory 50.6-59.5%. Backup: Crobat: Fly 72.1-85.5%. Keep Tyranitar away from it: one hit and they're gone.

**Machamp L64**

- **Tendencies:** Gets the jump on Crobat and Snorlax. Its go-to: Dynamic Punch (its best hit on Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Stone Edge against Typhlosion and Crobat.
- **When it's ahead:** Once you're low, Bullet Punch finishes you.
- **Against moves:** Guts: a status condition makes it hit harder.
- **How to attack it:** Hit it with Flying and Psychic. The call: Mamoswine: Earthquake 59.6-70.7%. Keep Tyranitar away from it: one hit and they're gone.

**Lucario L64**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Close Combat (its best hit on Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Iron Tail against Crobat.
- **When it's ahead:** Once you're low, Extreme Speed finishes you.
- **Against moves:** Steadfast: flinching makes it faster.
- **How to attack it:** Hit it with Fire and Ground. The call: Typhlosion: Flamethrower 113.2-135.2%. Backup: Mamoswine: Earthquake 151.6-179.1%. Keep Tyranitar away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Hitmontop | Typhlosion (W) | Extrasensory / Earthquake | Extrasensory / Earthquake | Extrasensory / Earthquake | Extrasensory / Earthquake | Flamethrower / Earthquake | Extrasensory / Earthquake | Flamethrower / Earthquake |
| Hitmonlee | Mamoswine (W) | Earthquake / Close Combat | Earthquake / Close Combat | Earthquake / Close Combat | Earthquake / Close Combat | Earthquake / Close Combat | Earthquake / Close Combat | Earthquake / Close Combat |
| Hitmonchan | Typhlosion (W) | Extrasensory / Close Combat | Extrasensory / Close Combat | Extrasensory / Close Combat | Extrasensory / Drain Punch | Flamethrower / Close Combat | Extrasensory / Close Combat | Flamethrower / Drain Punch |
| Hariyama | Typhlosion (W) | Extrasensory / Low Kick | Extrasensory / Low Kick | Extrasensory / Low Kick | Extrasensory / Low Kick | Extrasensory / Low Kick | Extrasensory / Low Kick | Extrasensory / Low Kick |
| Machamp | Mamoswine (W) | Earthquake / Dynamic Punch | Earthquake / Dynamic Punch | Earthquake / Dynamic Punch | Earthquake / Bullet Punch | Earthquake / Dynamic Punch | Earthquake / Dynamic Punch | Earthquake / Bullet Punch |
| Lucario | Typhlosion (W) | Flamethrower / Close Combat | Flamethrower / Close Combat | Flamethrower / Close Combat | Flamethrower / Extreme Speed | Flamethrower / Close Combat | Flamethrower / Close Combat | Flamethrower / Extreme Speed |

### Call sheet vs Karen (rematch) (Lv 64, pret/pokeheartgold files/poketool/trainer/trainers.json #705)

- **Order:** Weavile (Lv 62), Spiritomb (Lv 62), Absol (Lv 62), Honchkrow (Lv 64), Houndoom (Lv 63), Umbreon (Lv 64). Lead with Typhlosion: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Weavile, which beats 2 of your 6. Your last one standing: Typhlosion.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “This is far from being backed into a corner!” Last Pokémon at half HP: “You’re no ordinary Trainer to have gotten this far.”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Weavile L62 | Ice Shard · Night Slash · Ice Punch · Low Kick | Typhlosion: Flamethrower 102.8-122% | Crobat: U-turn 54.2-64.4% | — |
| Spiritomb L62 | Curse · Confuse Ray · Pain Split · Sucker Punch | Tyranitar: Crunch 49.3-57.9% | Mamoswine: Earthquake 65.8-77.6% | — |
| Absol L62 | Night Slash · Psycho Cut · Detect · Perish Song | Tyranitar: Outrage 69.6-81.9% | Mamoswine: Earthquake 93-109.4% | — |
| Honchkrow L64 | Drill Peck · Whirlwind · Sucker Punch · Thunder Wave | Tyranitar: Outrage 58.4-68.8% | Lapras: Ice Beam 97.7-114.9% | — |
| Houndoom L63 | Nasty Plot · Dark Pulse · Flamethrower · Sludge Bomb | Tyranitar: Earthquake 121.5-143% | Snorlax: Body Slam 66.1-78% | — |
| Umbreon L64 | Curse · Payback · Confuse Ray · Sucker Punch @ Sitrus Berry | Snorlax: Body Slam 29.9-35.5% | Tyranitar: Outrage 33.2-39.3% | — |

**Weavile L62**

- **Order:** Leads off.
- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Low Kick (its best hit on Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Night Slash against Typhlosion; Ice Punch against Crobat.
- **When it's ahead:** Once you're low, Ice Shard finishes you.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** Hit it with Bug, Fire and Rock. The call: Typhlosion: Flamethrower 102.8-122%. Backup: Crobat: U-turn 54.2-64.4%.

**Spiritomb L62**

- **Tendencies:** You move first, every time. Its go-to: Sucker Punch (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax).
- **When it's ahead:** Expect Confuse Ray early. Once you're low, Sucker Punch finishes you.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** The call: Tyranitar: Crunch 49.3-57.9%. Backup: Mamoswine: Earthquake 65.8-77.6%. Its blind spot: Tyranitar, Mamoswine, Crobat, Lapras and Snorlax take almost nothing from it.

**Absol L62**

- **Tendencies:** Gets the jump on Lapras and Snorlax. Its go-to: Night Slash (its best hit on Typhlosion, Tyranitar, Mamoswine, Lapras and Snorlax). Otherwise: Psycho Cut against Crobat.
- **When it's behind:** Cornered, it can take one of yours down with it (Perish Song).
- **Against moves:** Pressure: your moves burn extra PP. Stalls with Detect.
- **How to attack it:** Hit it with Bug. The call: Tyranitar: Outrage 69.6-81.9%. Backup: Mamoswine: Earthquake 93-109.4%. Its blind spot: Tyranitar, Mamoswine, Lapras and Snorlax take almost nothing from it.

**Honchkrow L64**

- **Tendencies:** Gets the jump on Snorlax. Its go-to: Drill Peck (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat, Lapras and Snorlax).
- **When it's ahead:** Expect Thunder Wave early. Once you're low, Sucker Punch finishes you.
- **Against moves:** Insomnia: it can't be put to sleep. If you set up, it forces you out with Whirlwind.
- **How to attack it:** Hit it with Electric, Ice and Rock. The call: Tyranitar: Outrage 58.4-68.8%. Backup: Lapras: Ice Beam 97.7-114.9%. Its blind spot: Tyranitar takes almost nothing from it.

**Houndoom L63**

- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Flamethrower (its best hit on Tyranitar, Mamoswine, Crobat and Lapras). Otherwise: Dark Pulse against Typhlosion and Snorlax.
- **When it's ahead:** Given a free turn, it sets up with Nasty Plot.
- **How to attack it:** Hit it with Ground, Rock and Water. The call: Tyranitar: Earthquake 121.5-143%. Backup: Snorlax: Body Slam 66.1-78%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Umbreon L64**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Payback (its best hit on Typhlosion, Tyranitar, Mamoswine, Crobat and Lapras). Otherwise: Sucker Punch against Snorlax. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Curse. Expect Confuse Ray early. Once you're low, Sucker Punch finishes you.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Bug. The call: Snorlax: Body Slam 29.9-35.5%. Backup: Tyranitar: Outrage 33.2-39.3%. Its blind spot: Tyranitar, Mamoswine, Lapras and Snorlax take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Weavile | Typhlosion (W) | Flamethrower / Night Slash | Flamethrower / Night Slash | Flamethrower / Night Slash | Flamethrower / Night Slash | Flamethrower / Night Slash | Flamethrower / Night Slash | Flamethrower / Night Slash |
| Spiritomb | Tyranitar (W) | Crunch / Curse | Crunch / Curse | Crunch / Curse | Crunch / Curse | Crunch / Pain Split | Crunch / Curse | Crunch / Pain Split |
| Absol | Tyranitar (W) | Outrage / Night Slash | Outrage / Night Slash | Outrage / Night Slash | Outrage / Night Slash | Outrage / Night Slash | Outrage / Night Slash | Outrage / Night Slash |
| Honchkrow | Tyranitar (W) | Outrage / Drill Peck | Outrage / Drill Peck | Outrage / Drill Peck | Outrage / Drill Peck | Outrage / Drill Peck | Outrage / Drill Peck | Outrage / Drill Peck |
| Houndoom | Tyranitar (W) | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower |
| Umbreon | Snorlax (W) | Body Slam / Curse | Body Slam / Curse | Body Slam / Curse | Body Slam / Curse | Body Slam / Confuse Ray | Body Slam / Curse | Body Slam / Confuse Ray |

### Call sheet vs Champion Lance (rematch) (Lv 75, pret/pokeheartgold files/poketool/trainer/trainers.json #701)

- **Order:** Salamence (Lv 72), Gyarados (Lv 68), Garchomp (Lv 72), Altaria (Lv 73), Charizard (Lv 68), Dragonite (Lv 75). Lead with Tyranitar: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Salamence, which beats 2 of your 6. Your last one standing: Tyranitar.
- **The bag:** 4 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “All right! I thought this would never happen!” Last Pokémon at half HP: “I never give up, no matter what. You must be the same?”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Salamence L72 | Flamethrower · Shadow Claw · Dragon Claw · Rest @ Lum Berry | Tyranitar: Outrage 95-112.5% | Lapras: Ice Beam 156.7-186.7% | — |
| Gyarados L68 | Thunder Wave · Ice Fang · Waterfall · Dragon Dance | Lapras: Ice Beam 37-43.2% | Snorlax: Thunder Punch 116.3-137.4% | — |
| Garchomp L72 | Swords Dance · Outrage · Earthquake · Roar | Lapras: Ice Beam 139-163.7% | Mamoswine: Ice Fang 159.1-190% | — |
| Altaria L73 | Perish Song · Dragon Breath · Double Team · Hyper Beam | Mamoswine: Ice Fang 198.1-235.5% | Tyranitar: Outrage 95.3-113.1% | — |
| Charizard L68 | Flamethrower · Air Slash · Dragon Claw · Hyper Beam | Snorlax: Thunder Punch 64.7-76.5% | Lapras: Surf 92.2-109.8% | — |
| Dragonite L75 | Fire Blast · Safeguard · Draco Meteor · Hyper Beam @ Sitrus Berry | Mamoswine: Ice Fang 162.3-191.8% | Tyranitar: Outrage 77.9-91.8% | — |

**Salamence L72**

- **Order:** Leads off.
- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Dragon Claw (its best hit on Typhlosion, Tyranitar, Crobat, Lapras and Snorlax). Otherwise: Flamethrower against Mamoswine. Hits from both sides (Shadow Claw and Dragon Claw physical, Flamethrower special): no single wall stops it. Holds Lum Berry: it shrugs off the first status.
- **When it's behind:** When it's low, it heals itself with Rest.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Dragon, Ice and Rock. The call: Tyranitar: Outrage 95-112.5%. Backup: Lapras: Ice Beam 156.7-186.7%. Its blind spot: Tyranitar takes almost nothing from it.

**Gyarados L68**

- **Tendencies:** Gets the jump on Lapras and Snorlax. Its go-to: Waterfall (its best hit on Typhlosion, Tyranitar, Mamoswine and Snorlax). Otherwise: Ice Fang against Crobat and Lapras.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance. Expect Thunder Wave early.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric and Rock. The call: Lapras: Ice Beam 37-43.2%. Backup: Snorlax: Thunder Punch 116.3-137.4%. Its blind spot: Lapras and Snorlax take almost nothing from it.

**Garchomp L72**

- **Tendencies:** Moves first against Tyranitar, Mamoswine, Lapras and Snorlax. Its go-to: Outrage (its best hit on Mamoswine, Crobat, Lapras and Snorlax). Otherwise: Earthquake against Typhlosion and Tyranitar.
- **When it's ahead:** Given a free turn, it sets up with Swords Dance.
- **Against moves:** Sand Veil: harder to hit in a sandstorm. If you set up, it forces you out with Roar.
- **How to attack it:** Hit it with Dragon and Ice. The call: Lapras: Ice Beam 139-163.7%. Backup: Mamoswine: Ice Fang 159.1-190%.

**Altaria L73**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Hyper Beam (its best hit on Typhlosion, Mamoswine, Crobat, Lapras and Snorlax). Otherwise: Dragon Breath against Tyranitar.
- **When it's behind:** Cornered, it can take one of yours down with it (Perish Song).
- **Against moves:** Natural Cure: switching out cures its status.
- **How to attack it:** Hit it with Dragon, Ice and Rock. The call: Mamoswine: Ice Fang 198.1-235.5%. Backup: Tyranitar: Outrage 95.3-113.1%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Charizard L68**

- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Hyper Beam (its best hit on Typhlosion, Crobat, Lapras and Snorlax). Otherwise: Dragon Claw against Tyranitar; Flamethrower against Mamoswine. Hits from both sides (Dragon Claw physical, Flamethrower, Air Slash and Hyper Beam special): no single wall stops it.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Electric, Rock and Water. The call: Snorlax: Thunder Punch 64.7-76.5%. Backup: Lapras: Surf 92.2-109.8%. Its blind spot: Tyranitar, Lapras and Snorlax take almost nothing from it.

**Dragonite L75**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Tyranitar, Lapras and Snorlax. Its go-to: Draco Meteor (its best hit on Typhlosion, Tyranitar, Crobat, Lapras and Snorlax). Otherwise: Fire Blast against Mamoswine. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Dragon, Ice and Rock. The call: Mamoswine: Ice Fang 162.3-191.8%. Backup: Tyranitar: Outrage 77.9-91.8%. Its blind spot: Snorlax takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Salamence | Tyranitar (W) | Dragon Dance / Dragon Claw | Outrage / Dragon Claw | Outrage / Dragon Claw | Outrage / Dragon Claw | Outrage / Dragon Claw | Outrage / Dragon Claw | Outrage / Dragon Claw |
| Gyarados | Lapras (W) | Ice Beam / Ice Fang | Ice Beam / Ice Fang | Ice Beam / Ice Fang | Ice Beam / Ice Fang | Ice Beam / Ice Fang | Ice Beam / Ice Fang | Ice Beam / Ice Fang |
| Garchomp | Lapras (W) | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage |
| Altaria | Mamoswine (W) | Ice Shard / Hyper Beam | Ice Shard / Hyper Beam | Ice Shard / Hyper Beam | Ice Shard / Hyper Beam | Ice Shard / Hyper Beam | Ice Shard / Hyper Beam | Ice Shard / Hyper Beam |
| Charizard | Snorlax (W) | Thunder Punch / Hyper Beam | Thunder Punch / Hyper Beam | Thunder Punch / Hyper Beam | Thunder Punch / Hyper Beam | Thunder Punch / Hyper Beam | Thunder Punch / Hyper Beam | Thunder Punch / Hyper Beam |
| Dragonite | Mamoswine (W) | Ice Shard / Fire Blast | Ice Shard / Fire Blast | Ice Shard / Draco Meteor | Ice Shard / Hyper Beam | Ice Shard / Fire Blast | Ice Shard / Fire Blast | Ice Shard / Hyper Beam |

