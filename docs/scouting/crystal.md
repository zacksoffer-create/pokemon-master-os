# Scouting packet: Crystal (attachment)

*Roster status: working (D-002). No grades: every line below is a phrase from the phrase book (engine/battle/phrasebook.json), triggered by numbers the engine measures, the way the games turn a Pokémon's best IV into its characteristic. Speed, power and bulk are measured against every fully evolved Pokémon of the same generation. Opponents' philosophy comes from the game's own trainer AI flags, bag and battle lines. Every one-on-one is played out by the scouting engine (docs/SCOUTING_ENGINE.md): our best plan against their best answer, Smogon's calculator for every hit at the lowest roll, every move landing, the odds kept. Against a game's trainers we meet them at their top level; the coach profile is measured against that generation's Smogon OU usage field at Lv 100.*

## Self-scout

### Coach profile

Against the Gen 2 OU usage field (48 Smogon sets): **builds first (p99), straight-up (p2), chips (p18)**. 109-24-155 in 288 one-on-ones. A slider is a share of those fights; p is the percentile among 2,000 random six-Pokémon teams drawn from the field.

| Slider | ◀ | Value | ▶ | Percentile |
|---|---|---|---|---|
| Pace | absorbs first | 60 | strikes first | p37 |
| Punch | chips | 26 | knocks out | p18 |
| Run / pass | special | 50 | physical | p56 |
| Build-up | hits now | 36 | builds first | p99 |
| Sustain | no healing | 9 | heals and resets | p47 |
| Disruption | straight-up | 0 | disruptive | p2 |
| Risk | safe | 41 | gambler | p67 |
| Script | adaptive | 59 | scripted | p59 |

| Player | W-D-L | Pace | Punch | Run / pass | Build-up | Sustain | Disruption | Risk | Script |
|---|---|---|---|---|---|---|---|---|---|
| Feraligatr | 23-2-23 | 56 (p43) | 33 (p54) | 18 (p40) | 33 (p77) | 0 (p28) | 0 (p29) | 85 (p94) | 50 (p42) |
| Miltank | 12-4-32 | 85 (p81) | 12 (p17) | 100 (p85) | 52 (p91) | 0 (p28) | 0 (p29) | 15 (p40) | 52 (p44) |
| Donphan | 27-2-19 | 40 (p17) | 42 (p75) | 100 (p85) | 27 (p75) | 0 (p28) | 0 (p29) | 10 (p39) | 60 (p54) |
| Ampharos | 18-4-26 | 38 (p15) | 31 (p51) | 11 (p33) | 25 (p75) | 0 (p28) | 0 (p29) | 21 (p42) | 50 (p42) |
| Umbreon | 17-5-26 | 52 (p33) | 4 (p14) | 70 (p62) | 71 (p98) | 52 (p98) | 0 (p29) | 100 (p99) | 69 (p75) |
| Espeon | 12-7-29 | 88 (p84) | 31 (p51) | 0 (p17) | 8 (p67) | 0 (p28) | 0 (p29) | 17 (p41) | 75 (p81) |

**Play sheet** (its most common call in each situation, against the field):

| Player | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|
| Feraligatr | Hydro Pump (52%) | Hydro Pump (77%) | Hydro Pump (83%) | Hydro Pump (50%) | Hydro Pump (77%) | Hydro Pump (79%) | Hydro Pump (67%) |
| Miltank | Curse (52%) | Body Slam (62%) | Body Slam (62%) | Body Slam (54%) | Body Slam (62%) | Body Slam (62%) | Body Slam (52%) |
| Donphan | Earthquake (60%) | Earthquake (79%) | Earthquake (81%) | Earthquake (83%) | Earthquake (79%) | Earthquake (79%) | Earthquake (81%) |
| Ampharos | Thunderbolt (52%) | Thunderbolt (62%) | Thunderbolt (60%) | Thunderbolt (62%) | Thunderbolt (62%) | Thunderbolt (62%) | Thunderbolt (58%) |
| Umbreon | Curse (69%) | Iron Tail (62%) | Iron Tail (62%) | Iron Tail (79%) | Iron Tail (46%) | Iron Tail (58%) | Iron Tail (50%) |
| Espeon | Psychic (75%) | Psychic (81%) | Psychic (73%) | Psychic (81%) | Psychic (81%) | Psychic (81%) | Psychic (77%) |

*Assumed where nothing is on record: DVs 15; level 100 (the peak).*

- **What we're trying to do:** Win on momentum: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon turn one free turn into a sweep. The anchor: Feraligatr.
- **What we're good at:** 11 attack types in the repertoire. The main ones: Electric (Ampharos, Espeon and Umbreon), Fighting (Ampharos, Feraligatr and Miltank), Normal (Donphan and Miltank) and Ground (Donphan and Miltank). Nothing is safe: 17 of 17 types take super-effective hits from this club. Espeon sets the pace; Donphan expects to take the first hit.
- **Where we're soft:** Shared holes: Grass (Feraligatr and Donphan) and Bug (Umbreon and Espeon).

| Attack type | Who throws it |
|---|---|
| Electric | Ampharos (Thunderbolt), Umbreon (Zap Cannon), Espeon (Zap Cannon) |
| Fighting | Feraligatr (Dynamic Punch), Miltank (Dynamic Punch), Ampharos (Dynamic Punch) |
| Normal | Miltank (Body Slam), Donphan (Double-Edge) |
| Ground | Miltank (Earthquake), Donphan (Earthquake) |
| Fire | Ampharos (Fire Punch) |
| Water | Feraligatr (Hydro Pump) |
| Ice | Feraligatr (Ice Beam) |
| Psychic | Espeon (Psychic) |
| Rock | Donphan (Ancient Power) |
| Dark | Espeon (Bite) |
| Steel | Umbreon (Iron Tail) |

## Depth chart

| Player | Philosophy | 1v1 vs the league | Build |
|---|---|---|---|
| **Feraligatr** | Win on momentum: take one free turn for Curse, then everything goes through. | 42-0 | no build on record: the engine filled in its strongest set |
| **Miltank** | Be the wall: absorb what the other side throws and hit back steadily. | 42-0 | no build on record: the engine filled in its strongest set |
| **Ampharos** | Win on momentum: take one free turn for Curse, then everything goes through. | 42-0 | no build on record: the engine filled in its strongest set |
| **Umbreon** | Win the long game: take the hit, heal with Moonlight, and make the other side break first. | 42-0 | no build on record: the engine filled in its strongest set |
| **Espeon** | Win on momentum: take one free turn for Curse, then everything goes through. | 42-0 | no build on record: the engine filled in its strongest set |
| **Donphan** | Win on momentum: take one free turn for Curse, then everything goes through. | 40-2 | no build on record: the engine filled in its strongest set |

## Scouting reports

### Feraligatr (Water), Crystal
*Hydro Pump / Dynamic Punch / Ice Beam / Curse · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Curse, then everything goes through.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Hits from both sides: Dynamic Punch physical, Hydro Pump and Ice Beam special. Out pitch: Hydro Pump. Can miss when it matters: Hydro Pump (80%) and Dynamic Punch (50%).
- **When it's ahead:** Ahead, it takes the free turn for Curse.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Dark, Dragon, Fire, Flying, Grass, Ground, Ice, Normal, Rock and Steel. Look out for Electric (×2) and Grass (×2).
- **How you beat it:** Hit it with something it can't hit back: Jolteon, Electrode, Electabuzz and Raichu are the classic answers.
- **Production:** Won 42 of 42 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Poliwrath, Kingdra and Blastoise. Pokédex, Crystal: “Although it has a massive body, its powerful hind legs enable it to move quickly, even on the ground.”

### Miltank (Normal), Crystal
*Body Slam / Earthquake / Dynamic Punch / Curse · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Be the wall: absorb what the other side throws and hit back steadily.
- **Tendencies:** Usually swings first: 78% of its generation is slower. Every attack runs off its Attack stat. Out pitch: Body Slam. A light hitter: its best attacking stat sits in the bottom quarter of its generation. Built for contact: it takes physical hits much better than special ones. Can miss when it matters: Dynamic Punch (50%).
- **When it's ahead:** Ahead, it takes the free turn for Curse.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Dark, Electric, Fire, Ice, Normal, Poison, Rock and Steel. Look out for Fighting (×2). A free switch-in against Ghost.
- **How you beat it:** Hit it with something it can't hit back: Heracross, Hitmonlee, Primeape and Machamp are the classic answers.
- **Production:** Won 42 of 42 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Tauros, Kangaskhan and Pidgeot. Pokédex, Crystal: “In order to milk a MILTANK, one must have a knack for rhythmically pull ing up and down on its udders.”

### Donphan (Ground), Crystal
*Earthquake / Ancient Power / Double-Edge / Curse · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Curse, then everything goes through.
- **Tendencies:** Expects to take the first hit: only 18% of its generation is slower. Every attack runs off its Attack stat. Out pitch: Earthquake. Built for contact: it takes physical hits much better than special ones. Pays for its power: Double-Edge costs it HP.
- **When it's ahead:** Ahead, it takes the free turn for Curse.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Bug, Electric, Fire, Flying, Ice, Poison, Rock and Steel. Look out for Water (×2), Grass (×2) and Ice (×2). A free switch-in against Electric.
- **How you beat it:** Hit it with something it can't hit back: Starmie, Kingler, Feraligatr and Exeggutor are the classic answers.
- **Production:** Won 40 of 42 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Golem, Rhydon and Sandslash. Pokédex, Crystal: “Because this POKéMON's skin is so tough, a normal attack won't even leave a scratch on it.”

### Ampharos (Electric), Crystal
*Thunderbolt / Dynamic Punch / Fire Punch / Curse · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Curse, then everything goes through.
- **Tendencies:** Expects to take the first hit: only 22% of its generation is slower. Hits from both sides: Dynamic Punch physical, Thunderbolt and Fire Punch special. Out pitch: Thunderbolt. Shrugs off special attacks far better than physical ones. Can miss when it matters: Dynamic Punch (50%).
- **When it's ahead:** Ahead, it takes the free turn for Curse.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Bug, Dark, Flying, Grass, Ice, Normal, Rock, Steel and Water. Look out for Ground (×2).
- **How you beat it:** Hit it with something it can't hit back: Dugtrio, Nidoking, Donphan and Sandslash are the classic answers.
- **Production:** Won 42 of 42 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Porygon2, Vileplume and Politoed. Pokédex, Crystal: “When it gets dark, the light from its bright, shiny tail can be seen from far away on the ocean's surface.”

### Umbreon (Dark), Crystal
*Iron Tail / Zap Cannon / Curse / Moonlight · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win the long game: take the hit, heal with Moonlight, and make the other side break first.
- **Tendencies:** Expects to take the first hit: only 32% of its generation is slower. Hits from both sides: Iron Tail physical, Zap Cannon special. Out pitch: Iron Tail. A light hitter: its best attacking stat sits in the bottom quarter of its generation. Hard to move from either side: top-quarter bulk against physical and special hits. Can miss when it matters: Iron Tail (75%) and Zap Cannon (50%).
- **When it's ahead:** Ahead, it takes the free turn for Curse.
- **When it's behind:** Behind, it heals with Moonlight.
- **Against types:** Feeds on Flying, Ice, Rock and Water. Struggles to hurt Electric. Look out for Fighting (×2) and Bug (×2). A free switch-in against Psychic.
- **How you beat it:** Hit it with something it can't hit back: Pinsir, Heracross, Hitmonlee and Primeape are the classic answers.
- **Production:** Won 42 of 42 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Suicune, Blastoise and Hypno. Pokédex, Crystal: “On the night of a full moon, or when it gets excited, the ring patterns on its body glow yellow.”

### Espeon (Psychic), Crystal
*Psychic / Bite / Zap Cannon / Curse · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Curse, then everything goes through.
- **Tendencies:** Usually swings first: 88% of its generation is slower. Every attack runs off its Sp. Atk. Out pitch: Psychic. Raw power near the top of its generation. Glass on one side: it can't afford to take many hits there. Can miss when it matters: Zap Cannon (50%).
- **When it's ahead:** Ahead, it takes the free turn for Curse.
- **When it's behind:** Behind, it has no way back. Get it out before it's caught low.
- **Against types:** Feeds on Fighting, Flying, Ghost, Poison, Psychic and Water. Look out for Bug (×2), Ghost (×2) and Dark (×2).
- **How you beat it:** Hit it with something it can't hit back: Pinsir, Sneasel, Houndoom and Scizor are the classic answers.
- **Production:** Won 42 of 42 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Alakazam, Gengar and Jynx. Pokédex, Crystal: “The tip of its forked tail quivers when it is predicting its opponent's next move.”

## Call sheets

### Call sheet vs Will (Lv 42, pret/pokecrystal data/trainers/parties.asm WillGroup (1))

- **Order:** Xatu (Lv 40), Jynx (Lv 41), Exeggutor (Lv 41), Slowbro (Lv 41), Xatu (Lv 42). Lead with Ampharos: it handles their opener. It rarely switches: only when the matchup looks bad and its bench has something immune to your last attack that hits you super-effectively.
- **Philosophy:** Its AI jumps on any knockout, otherwise throws its strongest hit, heals only under a quarter of its HP, and stops setting up after its first turn. Their best player: Xatu, which beats 0 of your 6. Your last one standing: Feraligatr.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Xatu L40 | Quick Attack · Future Sight · Confuse Ray · Psychic | Ampharos: Thunderbolt 159.1-187.3% | Feraligatr: Ice Beam 82.7-98.2% | — |
| Jynx L41 | Double Slap · Lovely Kiss · Ice Punch · Psychic | Espeon: Bite 54.9-65.5% | Miltank: Body Slam 90.3-106.2% | — |
| Exeggutor L41 | Reflect · Leech Seed · Egg Bomb · Psychic | Espeon: Bite 62-73% | Ampharos: Fire Punch 70.8-83.2% | — |
| Slowbro L41 | Curse · Amnesia · Body Slam · Psychic | Ampharos: Thunderbolt 112.4-132.8% | Espeon: Zap Cannon 86.9-102.2% | — |
| Xatu L42 | Quick Attack · Future Sight · Confuse Ray · Psychic | Ampharos: Thunderbolt 146.1-172.2% | Feraligatr: Ice Beam 76.5-90.4% | — |

**Xatu L40**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Psychic (its best hit on Feraligatr, Miltank, Donphan and Ampharos). Otherwise: Future Sight against Umbreon and Espeon. Hits from both sides (Quick Attack physical, Future Sight and Psychic special): no single wall stops it.
- **When it's ahead:** Expect Confuse Ray early. Once you're low, Quick Attack finishes you.
- **How to attack it:** Hit it with Dark, Electric, Ice and Rock. The call: Ampharos: Thunderbolt 159.1-187.3%. Backup: Feraligatr: Ice Beam 82.7-98.2%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Jynx L41**

- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Psychic (its best hit on Feraligatr, Miltank and Ampharos). Otherwise: Ice Punch against Donphan, Umbreon and Espeon.
- **When it's ahead:** Expect Lovely Kiss early.
- **How to attack it:** Hit it with Dark, Fire, Rock and Steel. The call: Espeon: Bite 54.9-65.5%. Backup: Miltank: Body Slam 90.3-106.2%. Its blind spot: Ampharos, Umbreon and Espeon take almost nothing from it.

**Exeggutor L41**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Feraligatr, Miltank, Donphan and Ampharos). Otherwise: Egg Bomb against Umbreon and Espeon. Hits from both sides (Egg Bomb physical, Psychic special): no single wall stops it.
- **When it's behind:** When it's low, it heals itself with Leech Seed.
- **How to attack it:** Hit it with Dark, Fire and Ice. The call: Espeon: Bite 62-73%. Backup: Ampharos: Fire Punch 70.8-83.2%. Its blind spot: Umbreon and Espeon take almost nothing from it.

**Slowbro L41**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Feraligatr, Miltank, Donphan and Ampharos). Otherwise: Body Slam against Umbreon and Espeon. Hits from both sides (Body Slam physical, Psychic special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Curse or Amnesia.
- **How to attack it:** Hit it with Dark and Electric. The call: Ampharos: Thunderbolt 112.4-132.8%. Backup: Espeon: Zap Cannon 86.9-102.2%. Its blind spot: Feraligatr, Miltank, Ampharos, Umbreon and Espeon take almost nothing from it.

**Xatu L42**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Psychic (its best hit on Feraligatr, Miltank, Donphan and Ampharos). Otherwise: Future Sight against Umbreon and Espeon. Hits from both sides (Quick Attack physical, Future Sight and Psychic special): no single wall stops it.
- **When it's ahead:** Expect Confuse Ray early. Once you're low, Quick Attack finishes you.
- **How to attack it:** Hit it with Dark, Electric, Ice and Rock. The call: Ampharos: Thunderbolt 146.1-172.2%. Backup: Feraligatr: Ice Beam 76.5-90.4%. Its blind spot: Feraligatr, Miltank, Ampharos, Umbreon and Espeon take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Xatu | Ampharos (W) | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic |
| Jynx | Espeon (W) | Bite / Ice Punch | Bite / Ice Punch | Bite / Ice Punch | Bite / Ice Punch | Bite / Ice Punch | Bite / Ice Punch | Bite / Ice Punch |
| Exeggutor | Espeon (W) | Bite / Egg Bomb | Bite / Egg Bomb | Bite / Egg Bomb | Bite / Egg Bomb | Bite / Egg Bomb | Bite / Psychic | Bite / Egg Bomb |
| Slowbro | Ampharos (W) | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic |
| Xatu | Ampharos (W) | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic |

### Call sheet vs Koga (Lv 44, pret/pokecrystal data/trainers/parties.asm KogaGroup (1))

- **Order:** Ariados (Lv 40), Venomoth (Lv 41), Forretress (Lv 43), Muk (Lv 42), Crobat (Lv 44). Lead with Ampharos: it handles their opener. It rarely switches: only when the matchup looks bad and its bench has something immune to your last attack that hits you super-effectively.
- **Philosophy:** Its AI jumps on any knockout, otherwise throws its strongest hit, heals only under a quarter of its HP, and stops setting up after its first turn. Their best player: Ariados, which beats 0 of your 6. Your last one standing: Feraligatr.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Ariados L40 | Double Team · Spider Web · Baton Pass · Giga Drain | Ampharos: Fire Punch 100.9-119.3% | Espeon: Psychic 196.5-231.6% | — |
| Venomoth L41 | Supersonic · Gust · Psychic · Toxic | Espeon: Psychic 158.1-186.3% | Ampharos: Fire Punch 81.2-95.7% | — |
| Forretress L43 | Protect · Swift · Explosion · Spikes | Ampharos: Fire Punch 172.2-203.2% | Donphan: Earthquake 44.4-52.4% | — |
| Muk L42 | Minimize · Acid Armor · Sludge Bomb · Toxic | Donphan: Earthquake 127.5-150.3% | Miltank: Earthquake 65.8-77.9% | — |
| Crobat L44 | Double Team · Quick Attack · Wing Attack · Toxic | Espeon: Psychic 119.6-140.6% | Ampharos: Thunderbolt 115.2-136.2% | — |

**Ariados L40**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Giga Drain (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **How to attack it:** Hit it with Fire, Psychic and Rock. The call: Ampharos: Fire Punch 100.9-119.3%. Backup: Espeon: Psychic 196.5-231.6%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Venomoth L41**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Feraligatr, Miltank, Donphan, Ampharos and Espeon). Otherwise: Gust against Umbreon. Hits from both sides (Gust physical, Psychic special): no single wall stops it.
- **When it's ahead:** Expect Toxic early.
- **How to attack it:** Hit it with Fire, Psychic and Rock. The call: Espeon: Psychic 158.1-186.3%. Backup: Ampharos: Fire Punch 81.2-95.7%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Forretress L43**

- **Tendencies:** You move first, every time. Its go-to: Explosion (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **When it's behind:** Cornered, it can take one of yours down with it (Explosion).
- **Against moves:** Stalls with Protect.
- **How to attack it:** Hit it with Fire. The call: Ampharos: Fire Punch 172.2-203.2%. Backup: Donphan: Earthquake 44.4-52.4%. Keep Espeon away from it: one hit and they're gone.

**Muk L42**

- **Tendencies:** You move first, every time. Its go-to: Sludge Bomb (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **When it's ahead:** Expect Toxic early.
- **How to attack it:** Hit it with Ground and Psychic. The call: Donphan: Earthquake 127.5-150.3%. Backup: Miltank: Earthquake 65.8-77.9%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos and Umbreon take almost nothing from it.

**Crobat L44**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Feraligatr, Donphan, Ampharos and Umbreon. Its go-to: Wing Attack (its best hit on Feraligatr, Miltank, Donphan, Umbreon and Espeon). Otherwise: Quick Attack against Ampharos.
- **When it's ahead:** Expect Toxic early. Once you're low, Quick Attack finishes you.
- **How to attack it:** Hit it with Electric, Ice, Psychic and Rock. The call: Espeon: Psychic 119.6-140.6%. Backup: Ampharos: Thunderbolt 115.2-136.2%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Ariados | Ampharos (W) | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain |
| Venomoth | Espeon (W) | Psychic / Psychic | Psychic / Psychic | Psychic / Psychic | Psychic / Psychic | Psychic / Psychic | Psychic / Psychic | Psychic / Psychic |
| Forretress | Ampharos (W) | Fire Punch / Explosion | Fire Punch / Explosion | Fire Punch / Explosion | Fire Punch / Explosion | Fire Punch / Explosion | Fire Punch / Explosion | Fire Punch / Explosion |
| Muk | Donphan (W) | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb | Earthquake / Sludge Bomb |
| Crobat | Espeon (W) | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Wing Attack |

### Call sheet vs Bruno (Lv 46, pret/pokecrystal data/trainers/parties.asm BrunoGroup (1))

- **Order:** Hitmontop (Lv 42), Hitmonlee (Lv 42), Hitmonchan (Lv 42), Onix (Lv 43), Machamp (Lv 46). Lead with Espeon: it handles their opener. It rarely switches: only when the matchup looks bad and its bench has something immune to your last attack that hits you super-effectively.
- **Philosophy:** Its AI jumps on any knockout, otherwise throws its strongest hit, heals only under a quarter of its HP, and stops setting up after its first turn. Their best player: Hitmontop, which beats 0 of your 6. Your last one standing: Feraligatr.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Hitmontop L42 | Pursuit · Quick Attack · Dig · Detect | Espeon: Psychic 139.8-165% | Donphan: Earthquake 84.5-100% | — |
| Hitmonlee L42 | Swagger · Double Kick · High Jump Kick · Foresight | Donphan: Earthquake 134-158.3% | Espeon: Psychic 139.8-165% | — |
| Hitmonchan L42 | Thunder Punch · Ice Punch · Fire Punch · Mach Punch | Espeon: Psychic 139.8-165% | Donphan: Earthquake 99-116.5% | — |
| Onix L43 | Bind · Earthquake · Sandstorm · Rock Slide | Feraligatr: Hydro Pump 598.9-704.3% | Donphan: Earthquake 117.4-139.1% | — |
| Machamp L46 | Rock Slide · Foresight · Vital Throw · Cross Chop | Espeon: Psychic 111.5-131.1% | Donphan: Earthquake 62.2-73.6% | — |

**Hitmontop L42**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Dig (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon). Hits from both sides (Quick Attack and Dig physical, Pursuit special): no single wall stops it.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Stalls with Detect.
- **How to attack it:** Hit it with Psychic. The call: Espeon: Psychic 139.8-165%. Backup: Donphan: Earthquake 84.5-100%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Hitmonlee L42**

- **Tendencies:** You move first, every time. Its go-to: High Jump Kick (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **How to attack it:** Hit it with Psychic. The call: Donphan: Earthquake 134-158.3%. Backup: Espeon: Psychic 139.8-165%. Its blind spot: Feraligatr, Donphan, Ampharos and Espeon take almost nothing from it.

**Hitmonchan L42**

- **Tendencies:** Moves first against Miltank, Ampharos, Umbreon and Espeon. Its go-to: Mach Punch (its best hit on Miltank, Ampharos, Umbreon and Espeon). Otherwise: Thunder Punch against Feraligatr; Ice Punch against Donphan. Hits from both sides (Mach Punch physical, Thunder Punch, Ice Punch and Fire Punch special): no single wall stops it.
- **When it's ahead:** Once you're low, Mach Punch finishes you.
- **How to attack it:** Hit it with Psychic. The call: Espeon: Psychic 139.8-165%. Backup: Donphan: Earthquake 99-116.5%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Onix L43**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **How to attack it:** Hit it with Fighting, Ground, Ice, Steel and Water. The call: Feraligatr: Hydro Pump 598.9-704.3%. Backup: Donphan: Earthquake 117.4-139.1%. Its blind spot: Feraligatr, Miltank, Donphan, Umbreon and Espeon take almost nothing from it.

**Machamp L46**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Cross Chop (its best hit on Feraligatr, Miltank, Donphan, Ampharos and Umbreon). Otherwise: Rock Slide against Espeon.
- **How to attack it:** Hit it with Psychic. The call: Espeon: Psychic 111.5-131.1%. Backup: Donphan: Earthquake 62.2-73.6%. Its blind spot: Donphan and Espeon take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Hitmontop | Espeon (W) | Psychic / Dig | Psychic / Dig | Psychic / Dig | Psychic / Dig | Psychic / Dig | Psychic / Pursuit | Psychic / Dig |
| Hitmonlee | Donphan (W) | Earthquake / High Jump Kick | Earthquake / High Jump Kick | Earthquake / High Jump Kick | Earthquake / Double Kick | Earthquake / High Jump Kick | Earthquake / High Jump Kick | Earthquake / High Jump Kick |
| Hitmonchan | Espeon (W) | Psychic / Mach Punch | Psychic / Mach Punch | Psychic / Mach Punch | Psychic / Mach Punch | Psychic / Mach Punch | Psychic / Thunder Punch | Psychic / Mach Punch |
| Onix | Feraligatr (W) | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake |
| Machamp | Espeon (W) | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide |

### Call sheet vs Karen (Lv 47, pret/pokecrystal data/trainers/parties.asm KarenGroup (1))

- **Order:** Umbreon (Lv 42), Vileplume (Lv 42), Gengar (Lv 45), Murkrow (Lv 44), Houndoom (Lv 47). Lead with Donphan: it handles their opener. It rarely switches: only when the matchup looks bad and its bench has something immune to your last attack that hits you super-effectively.
- **Philosophy:** Its AI jumps on any knockout, otherwise throws its strongest hit, heals only under a quarter of its HP, and stops setting up after its first turn. Their best player: Umbreon, which beats 0 of your 6. Your last one standing: Feraligatr.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Umbreon L42 | Sand Attack · Confuse Ray · Feint Attack · Mean Look | Donphan: Earthquake 52.8-62.5% | Ampharos: Dynamic Punch 52.8-62.5% | — |
| Vileplume L42 | Stun Spore · Acid · Moonlight · Petal Dance | Espeon: Psychic 133.9-157.5% | Ampharos: Fire Punch 69.3-81.9% | — |
| Gengar L45 | Lick · Spite · Curse · Destiny Bond | Espeon: Psychic 151.6-178.7% | Miltank: Earthquake 97.5-114.8% | — |
| Murkrow L44 | Quick Attack · Whirlwind · Pursuit · Feint Attack | Feraligatr: Ice Beam 121.7-143.3% | Ampharos: Thunderbolt 230.8-271.7% | — |
| Houndoom L47 | Roar · Pursuit · Flamethrower · Crunch | Miltank: Earthquake 91.5-107.8% | Donphan: Earthquake 178-209.9% | — |

**Umbreon L42**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Feint Attack (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **When it's ahead:** Expect Confuse Ray early.
- **How to attack it:** Hit it with Fighting. The call: Donphan: Earthquake 52.8-62.5%. Backup: Ampharos: Dynamic Punch 52.8-62.5%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Vileplume L42**

- **Tendencies:** You move first, every time. Its go-to: Petal Dance (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon). Hits from both sides (Acid physical, Petal Dance special): no single wall stops it.
- **When it's ahead:** Expect Stun Spore early.
- **When it's behind:** When it's low, it heals itself with Moonlight.
- **How to attack it:** Hit it with Fire, Ice and Psychic. The call: Espeon: Psychic 133.9-157.5%. Backup: Ampharos: Fire Punch 69.3-81.9%. Its blind spot: Miltank, Ampharos, Umbreon and Espeon take almost nothing from it.

**Gengar L45**

- **Tendencies:** Moves first against Donphan, Ampharos and Umbreon. Its go-to: Lick (its best hit on Feraligatr, Donphan, Ampharos, Umbreon and Espeon).
- **When it's behind:** Cornered, it can take one of yours down with it (Destiny Bond).
- **How to attack it:** Hit it with Dark, Ground and Psychic. The call: Espeon: Psychic 151.6-178.7%. Backup: Miltank: Earthquake 97.5-114.8%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Murkrow L44**

- **Tendencies:** Gets the jump on Donphan and Umbreon. Its go-to: Feint Attack (its best hit on Feraligatr, Miltank, Donphan, Ampharos and Espeon). Otherwise: Quick Attack against Umbreon. Hits from both sides (Quick Attack physical, Pursuit and Feint Attack special): no single wall stops it.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** If you set up, it forces you out with Whirlwind.
- **How to attack it:** Hit it with Electric, Ice and Rock. The call: Feraligatr: Ice Beam 121.7-143.3%. Backup: Ampharos: Thunderbolt 230.8-271.7%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos and Umbreon take almost nothing from it.

**Houndoom L47**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Flamethrower (its best hit on Miltank, Donphan, Ampharos and Umbreon). Otherwise: Crunch against Feraligatr and Espeon.
- **Against moves:** If you set up, it forces you out with Roar.
- **How to attack it:** Hit it with Fighting, Ground, Rock and Water. The call: Miltank: Earthquake 91.5-107.8%. Backup: Donphan: Earthquake 178-209.9%. Its blind spot: Feraligatr, Ampharos and Umbreon take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Umbreon | Donphan (W) | Earthquake / Feint Attack | Earthquake / Feint Attack | Earthquake / Feint Attack | Earthquake / Feint Attack | Earthquake / Feint Attack | Earthquake / Feint Attack | Earthquake / Feint Attack |
| Vileplume | Espeon (W) | Psychic / Petal Dance | Psychic / Petal Dance | Psychic / Petal Dance | Psychic / Petal Dance | Psychic / Petal Dance | Psychic / Petal Dance | Psychic / Petal Dance |
| Gengar | Espeon (W) | Psychic / Lick | Psychic / Lick | Psychic / Lick | Psychic / Lick | Psychic / Lick | Psychic / Lick | Psychic / Lick |
| Murkrow | Feraligatr (W) | Ice Beam / Feint Attack | Ice Beam / Feint Attack | Ice Beam / Feint Attack | Ice Beam / Feint Attack | Ice Beam / Feint Attack | Ice Beam / Feint Attack | Ice Beam / Feint Attack |
| Houndoom | Miltank (W) | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower | Earthquake / Flamethrower |

### Call sheet vs Champion Lance (Lv 50, pret/pokecrystal data/trainers/parties.asm ChampionGroup (1))

- **Order:** Gyarados (Lv 44), Dragonite (Lv 47), Dragonite (Lv 47), Aerodactyl (Lv 46), Charizard (Lv 46), Dragonite (Lv 50). Lead with Ampharos: it handles their opener. It rarely switches: only when the matchup looks bad and its bench has something immune to your last attack that hits you super-effectively.
- **Philosophy:** Its AI jumps on any knockout, otherwise throws its strongest hit, heals only under a quarter of its HP, and stops setting up after its first turn. Their best player: Gyarados, which beats 0 of your 6. Your last one standing: Feraligatr.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Gyarados L44 | Flail · Rain Dance · Surf · Hyper Beam | Ampharos: Thunderbolt 236.1-277.6% | Miltank: Body Slam 50.3-59.9% | — |
| Dragonite L47 | Thunder Wave · Twister · Thunder · Hyper Beam | Feraligatr: Ice Beam 111.8-131.6% | Donphan: Ancient Power 48.7-57.9% | — |
| Dragonite L47 | Thunder Wave · Twister · Blizzard · Hyper Beam | Feraligatr: Ice Beam 111.8-131.6% | Miltank: Body Slam 40.1-47.4% | — |
| Aerodactyl L46 | Wing Attack · Ancient Power · Rock Slide · Hyper Beam | Donphan: Ancient Power 75.5-89.2% | Miltank: Dynamic Punch 47.5-56.1% | — |
| Charizard L46 | Flamethrower · Wing Attack · Slash · Hyper Beam | Ampharos: Thunderbolt 138.7-163.5% | Miltank: Body Slam 54-63.5% | — |
| Dragonite L50 | Fire Blast · Safeguard · Outrage · Hyper Beam | Feraligatr: Ice Beam 100.6-118.5% | Donphan: Ancient Power 43.8-51.9% | — |

**Gyarados L44**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Hyper Beam (its best hit on Feraligatr, Miltank, Ampharos, Umbreon and Espeon). Otherwise: Surf against Donphan. Hits from both sides (Hyper Beam physical, Surf special): no single wall stops it.
- **How to attack it:** Hit it with Electric and Rock. The call: Ampharos: Thunderbolt 236.1-277.6%. Backup: Miltank: Body Slam 50.3-59.9%. Its blind spot: Feraligatr, Miltank and Umbreon take almost nothing from it.

**Dragonite L47**

- **Tendencies:** You move first, every time. Its go-to: Hyper Beam (its best hit on Miltank, Donphan, Ampharos, Umbreon and Espeon). Otherwise: Thunder against Feraligatr. Hits from both sides (Hyper Beam physical, Twister and Thunder special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **How to attack it:** Hit it with Ice and Rock. The call: Feraligatr: Ice Beam 111.8-131.6%. Backup: Donphan: Ancient Power 48.7-57.9%. Its blind spot: Miltank, Donphan and Umbreon take almost nothing from it.

**Dragonite L47**

- **Tendencies:** You move first, every time. Its go-to: Hyper Beam (its best hit on Feraligatr, Miltank, Ampharos, Umbreon and Espeon). Otherwise: Blizzard against Donphan. Hits from both sides (Hyper Beam physical, Twister and Blizzard special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **How to attack it:** Hit it with Ice and Rock. The call: Feraligatr: Ice Beam 111.8-131.6%. Backup: Miltank: Body Slam 40.1-47.4%. Its blind spot: Miltank and Umbreon take almost nothing from it.

**Aerodactyl L46**

- **Tendencies:** Moves first against Feraligatr, Donphan, Ampharos and Umbreon. Its go-to: Hyper Beam (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **How to attack it:** Hit it with Electric, Ice, Rock, Steel and Water. The call: Donphan: Ancient Power 75.5-89.2%. Backup: Miltank: Dynamic Punch 47.5-56.1%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos and Umbreon take almost nothing from it.

**Charizard L46**

- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Flamethrower (its best hit on Miltank, Donphan, Ampharos and Umbreon). Otherwise: Hyper Beam against Feraligatr and Espeon. Hits from both sides (Wing Attack, Slash and Hyper Beam physical, Flamethrower special): no single wall stops it.
- **How to attack it:** Hit it with Electric, Rock and Water. The call: Ampharos: Thunderbolt 138.7-163.5%. Backup: Miltank: Body Slam 54-63.5%. Its blind spot: Feraligatr, Miltank, Ampharos and Umbreon take almost nothing from it.

**Dragonite L50**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Hyper Beam (its best hit on Feraligatr, Miltank, Ampharos, Umbreon and Espeon). Otherwise: Outrage against Donphan. Hits from both sides (Hyper Beam physical, Fire Blast and Outrage special): no single wall stops it.
- **How to attack it:** Hit it with Ice and Rock. The call: Feraligatr: Ice Beam 100.6-118.5%. Backup: Donphan: Ancient Power 43.8-51.9%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Gyarados | Ampharos (W) | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam |
| Dragonite | Feraligatr (W) | Ice Beam / Thunder | Ice Beam / Thunder | Ice Beam / Thunder | Ice Beam / Thunder | Ice Beam / Thunder | Ice Beam / Thunder | Ice Beam / Thunder |
| Dragonite | Feraligatr (W) | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam |
| Aerodactyl | Donphan (W) | Ancient Power / Hyper Beam | Ancient Power / Hyper Beam | Ancient Power / Hyper Beam | Ancient Power / Hyper Beam | Ancient Power / Hyper Beam | Ancient Power / Hyper Beam | Ancient Power / Hyper Beam |
| Charizard | Ampharos (W) | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower |
| Dragonite | Feraligatr (W) | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Outrage | Ice Beam / Hyper Beam |

### Call sheet vs Red (Lv 81, pret/pokecrystal data/trainers/parties.asm RedGroup (1))

- **Order:** Pikachu (Lv 81), Espeon (Lv 73), Snorlax (Lv 75), Venusaur (Lv 77), Charizard (Lv 77), Blastoise (Lv 77). Lead with Miltank: it handles their opener. It rarely switches: only when the matchup looks bad and its bench has something immune to your last attack that hits you super-effectively.
- **Philosophy:** Its AI jumps on any knockout, otherwise throws its strongest hit, heals only under a quarter of its HP, and stops setting up after its first turn. Their best player: Pikachu, which beats 0 of your 6. Your last one standing: Feraligatr.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Pikachu L81 | Charm · Quick Attack · Thunderbolt · Thunder | Miltank: Earthquake 194.1-228.2% | Espeon: Psychic 144.1-170% | — |
| Espeon L73 | Mud-Slap · Reflect · Swift · Psychic | Espeon: Bite 62.6-73.7% | Miltank: Body Slam 70.7-83.3% | — |
| Snorlax L75 | Amnesia · Snore · Rest · Body Slam | Donphan: Earthquake 57.5-67.6% | Miltank: Dynamic Punch 57.8-68.2% | — |
| Venusaur L77 | Sunny Day · Giga Drain · Synthesis · Solar Beam | Espeon: Psychic 108.7-128.1% | Feraligatr: Ice Beam 55.8-65.8% | — |
| Charizard L77 | Flamethrower · Wing Attack · Slash · Fire Spin | Ampharos: Thunderbolt 123.7-145.6% | Espeon: Zap Cannon 94.7-111.4% | — |
| Blastoise L77 | Rain Dance · Surf · Blizzard · Whirlpool | Ampharos: Thunderbolt 101.7-120% | Espeon: Zap Cannon 78.3-92.2% | — |

**Pikachu L81**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Thunder (its best hit on Feraligatr, Miltank, Ampharos, Umbreon and Espeon). Otherwise: Quick Attack against Donphan. Hits from both sides (Quick Attack physical, Thunderbolt and Thunder special): no single wall stops it.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **How to attack it:** Hit it with Ground. The call: Miltank: Earthquake 194.1-228.2%. Backup: Espeon: Psychic 144.1-170%. Its blind spot: Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Espeon L73**

- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Psychic (its best hit on Feraligatr, Miltank, Donphan, Ampharos and Espeon). Otherwise: Swift against Umbreon. Hits from both sides (Swift physical, Psychic special): no single wall stops it.
- **How to attack it:** Hit it with Dark. The call: Espeon: Bite 62.6-73.7%. Backup: Miltank: Body Slam 70.7-83.3%. Its blind spot: Feraligatr, Ampharos, Umbreon and Espeon take almost nothing from it.

**Snorlax L75**

- **Tendencies:** You move first, every time. Its go-to: Body Slam (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **When it's ahead:** Given a free turn, it sets up with Amnesia.
- **When it's behind:** When it's low, it heals itself with Rest.
- **How to attack it:** Hit it with Fighting. The call: Donphan: Earthquake 57.5-67.6%. Backup: Miltank: Dynamic Punch 57.8-68.2%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos and Umbreon take almost nothing from it.

**Venusaur L77**

- **Tendencies:** You move first, every time. Its go-to: Solar Beam (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **When it's behind:** When it's low, it heals itself with Synthesis.
- **How to attack it:** Hit it with Fire, Ice and Psychic. The call: Espeon: Psychic 108.7-128.1%. Backup: Feraligatr: Ice Beam 55.8-65.8%. Its blind spot: Umbreon takes almost nothing from it.

**Charizard L77**

- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Flamethrower (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon). Hits from both sides (Wing Attack and Slash physical, Flamethrower special): no single wall stops it.
- **How to attack it:** Hit it with Electric, Rock and Water. The call: Ampharos: Thunderbolt 123.7-145.6%. Backup: Espeon: Zap Cannon 94.7-111.4%. Its blind spot: Feraligatr, Miltank, Ampharos, Umbreon and Espeon take almost nothing from it.

**Blastoise L77**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Surf (its best hit on Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon).
- **How to attack it:** Hit it with Electric. The call: Ampharos: Thunderbolt 101.7-120%. Backup: Espeon: Zap Cannon 78.3-92.2%. Its blind spot: Feraligatr, Miltank, Ampharos, Umbreon and Espeon take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Pikachu | Miltank (W) | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder |
| Espeon | Espeon (W) | Bite / Psychic | Bite / Psychic | Bite / Psychic | Bite / Psychic | Bite / Psychic | Bite / Psychic | Bite / Psychic |
| Snorlax | Donphan (W) | Earthquake / Body Slam | Earthquake / Body Slam | Earthquake / Body Slam | Earthquake / Body Slam | Earthquake / Body Slam | Earthquake / Body Slam | Earthquake / Body Slam |
| Venusaur | Espeon (W) | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Solar Beam |
| Charizard | Ampharos (W) | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower | Thunderbolt / Flamethrower |
| Blastoise | Ampharos (W) | Thunderbolt / Surf | Thunderbolt / Surf | Thunderbolt / Surf | Thunderbolt / Surf | Thunderbolt / Surf | Thunderbolt / Surf | Thunderbolt / Surf |

### Call sheet vs Clair (Lv 40, pret/pokecrystal data/trainers/parties.asm ClairGroup (1))

- **Order:** Dragonair (Lv 37), Dragonair (Lv 37), Dragonair (Lv 37), Kingdra (Lv 40). Lead with Donphan: it handles their opener. It rarely switches: only when the matchup looks bad and its bench has something immune to your last attack that hits you super-effectively.
- **Philosophy:** Its AI jumps on any knockout, otherwise throws its strongest hit, heals only under a quarter of its HP, and stops setting up after its first turn. Their best player: Kingdra, which beats 1 of your 6. Your last one standing: Feraligatr.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Dragonair L37 | Thunder Wave · Surf · Slam · Dragon Breath | Donphan: Earthquake 105-124% | Feraligatr: Ice Beam 95-112% | — |
| Dragonair L37 | Thunder Wave · Thunderbolt · Slam · Dragon Breath | Donphan: Earthquake 105-124% | Miltank: Body Slam 69-82% | — |
| Dragonair L37 | Thunder Wave · Ice Beam · Slam · Dragon Breath | Donphan: Earthquake 105-124% | Feraligatr: Ice Beam 95-112% | — |
| Kingdra L40 | Smokescreen · Surf · Hyper Beam · Dragon Breath | Ampharos: Thunderbolt 55.9-66.1% | Espeon: Psychic 56.8-66.9% | — |

**Dragonair L37**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Slam (its best hit on Ampharos, Umbreon and Espeon). Otherwise: Surf against Miltank and Donphan; Dragon Breath against Feraligatr. Hits from both sides (Slam physical, Surf and Dragon Breath special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **How to attack it:** Hit it with Ice. The call: Donphan: Earthquake 105-124%. Backup: Feraligatr: Ice Beam 95-112%. Its blind spot: Feraligatr, Miltank, Ampharos, Umbreon and Espeon take almost nothing from it.

**Dragonair L37**

- **Tendencies:** You move first, every time. Its go-to: Slam (its best hit on Ampharos, Umbreon and Espeon). Otherwise: Thunderbolt against Feraligatr and Miltank; Dragon Breath against Donphan. Hits from both sides (Slam physical, Thunderbolt and Dragon Breath special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **How to attack it:** Hit it with Ice. The call: Donphan: Earthquake 105-124%. Backup: Miltank: Body Slam 69-82%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Dragonair L37**

- **Tendencies:** You move first, every time. Its go-to: Slam (its best hit on Ampharos, Umbreon and Espeon). Otherwise: Ice Beam against Miltank and Donphan; Dragon Breath against Feraligatr. Hits from both sides (Slam physical, Ice Beam and Dragon Breath special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **How to attack it:** Hit it with Ice. The call: Donphan: Earthquake 105-124%. Backup: Feraligatr: Ice Beam 95-112%. Its blind spot: Feraligatr, Miltank, Ampharos, Umbreon and Espeon take almost nothing from it.

**Kingdra L40**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Donphan. Its go-to: Hyper Beam (its best hit on Feraligatr, Ampharos, Umbreon and Espeon). Otherwise: Surf against Miltank and Donphan. Hits from both sides (Hyper Beam physical, Surf and Dragon Breath special): no single wall stops it.
- **How to attack it:** The call: Ampharos: Thunderbolt 55.9-66.1%. Backup: Espeon: Psychic 56.8-66.9%. Its blind spot: Feraligatr, Ampharos and Umbreon take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Dragonair | Donphan (W) | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf |
| Dragonair | Donphan (W) | Earthquake / Dragon Breath | Earthquake / Dragon Breath | Earthquake / Dragon Breath | Earthquake / Dragon Breath | Earthquake / Dragon Breath | Earthquake / Dragon Breath | Earthquake / Dragon Breath |
| Dragonair | Donphan (W) | Earthquake / Ice Beam | Earthquake / Ice Beam | Earthquake / Ice Beam | Earthquake / Ice Beam | Earthquake / Ice Beam | Earthquake / Ice Beam | Earthquake / Ice Beam |
| Kingdra | Ampharos (W) | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Surf | Thunderbolt / Hyper Beam |

### Call sheet vs Rival Silver (strongest team) (Lv 50, pret/pokecrystal Rival2Group)

- **Order:** Sneasel (Lv 45), Crobat (Lv 48), Magneton (Lv 45), Gengar (Lv 46), Alakazam (Lv 46), Meganium (Lv 50). Lead with Ampharos: it handles their opener. It rarely switches: only when the matchup looks bad and its bench has something immune to your last attack that hits you super-effectively.
- **Philosophy:** Its AI jumps on any knockout, otherwise throws its strongest hit, heals only under a quarter of its HP, and stops setting up after its first turn. Their best player: Meganium, which beats 1 of your 6. Your last one standing: Feraligatr.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Sneasel L45 | Quick Attack · Screech · Feint Attack · Fury Cutter | Ampharos: Dynamic Punch 282-331.5% | Donphan: Earthquake 143.2-168.5% | — |
| Crobat L48 | Toxic · Bite · Confuse Ray · Wing Attack | Espeon: Psychic 142.2-167.3% | Ampharos: Thunderbolt 136.1-160.5% | — |
| Magneton L45 | Thunder · Sonic Boom · Thunder Wave · Swift | Miltank: Earthquake 193.5-228% | Donphan: Earthquake 374.8-441.1% | — |
| Gengar L46 | Mean Look · Curse · Shadow Ball · Confuse Ray | Miltank: Earthquake 126.3-149.2% | Espeon: Psychic 194.1-228.8% | — |
| Alakazam L46 | Recover · Future Sight · Psychic · Reflect | Miltank: Body Slam 105.3-124.8% | Espeon: Bite 82.3-97.3% | — |
| Meganium L50 | Giga Drain · Body Slam · Light Screen · Safeguard | Ampharos: Fire Punch 57.4-67.6% | Espeon: Psychic 55.4-65.5% | — |

**Sneasel L45**

- **Order:** Leads off.
- **Tendencies:** Moves first against Donphan, Ampharos and Umbreon. Its go-to: Feint Attack (its best hit on Feraligatr, Miltank, Donphan and Espeon). Otherwise: Quick Attack against Ampharos and Umbreon. Hits from both sides (Quick Attack physical, Feint Attack special): no single wall stops it.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **How to attack it:** Hit it with Fighting, Fire, Rock and Steel. The call: Ampharos: Dynamic Punch 282-331.5%. Backup: Donphan: Earthquake 143.2-168.5%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Crobat L48**

- **Tendencies:** Moves first against Feraligatr, Donphan, Ampharos and Umbreon. Its go-to: Wing Attack (its best hit on Feraligatr, Miltank, Donphan, Umbreon and Espeon). Otherwise: Bite against Ampharos. Hits from both sides (Wing Attack physical, Bite special): no single wall stops it.
- **When it's ahead:** Expect Toxic or Confuse Ray early.
- **How to attack it:** Hit it with Electric, Ice, Psychic and Rock. The call: Espeon: Psychic 142.2-167.3%. Backup: Ampharos: Thunderbolt 136.1-160.5%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos, Umbreon and Espeon take almost nothing from it.

**Magneton L45**

- **Tendencies:** You move first, every time. Its go-to: Thunder (its best hit on Feraligatr, Miltank, Ampharos, Umbreon and Espeon). Otherwise: Sonic Boom against Donphan. Hits from both sides (Swift physical, Thunder special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **How to attack it:** Hit it with Fighting, Fire and Ground. The call: Miltank: Earthquake 193.5-228%. Backup: Donphan: Earthquake 374.8-441.1%. Its blind spot: Donphan, Ampharos and Umbreon take almost nothing from it.

**Gengar L46**

- **Tendencies:** Gets the jump on Donphan and Ampharos. Its go-to: Shadow Ball (its best hit on Feraligatr, Donphan, Ampharos, Umbreon and Espeon).
- **When it's ahead:** Expect Confuse Ray early.
- **How to attack it:** Hit it with Dark, Ground and Psychic. The call: Miltank: Earthquake 126.3-149.2%. Backup: Espeon: Psychic 194.1-228.8%. Its blind spot: Feraligatr, Miltank, Donphan, Ampharos and Umbreon take almost nothing from it.

**Alakazam L46**

- **Tendencies:** Moves first against Donphan, Ampharos and Umbreon. Its go-to: Psychic (its best hit on Feraligatr, Miltank, Donphan and Ampharos). Otherwise: Future Sight against Umbreon and Espeon.
- **When it's behind:** When it's low, it heals itself with Recover.
- **How to attack it:** Hit it with Dark. The call: Miltank: Body Slam 105.3-124.8%. Backup: Espeon: Bite 82.3-97.3%. Its blind spot: Ampharos, Umbreon and Espeon take almost nothing from it.

**Meganium L50**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Giga Drain (its best hit on Feraligatr, Miltank, Donphan and Umbreon). Otherwise: Body Slam against Ampharos and Espeon. Hits from both sides (Body Slam physical, Giga Drain special): no single wall stops it.
- **How to attack it:** Hit it with Fire and Ice. The call: Ampharos: Fire Punch 57.4-67.6%. Backup: Espeon: Psychic 55.4-65.5%. Its blind spot: Miltank, Ampharos, Umbreon and Espeon take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Sneasel | Ampharos (W) | Fire Punch / Quick Attack | Fire Punch / Quick Attack | Fire Punch / Quick Attack | Fire Punch / Quick Attack | Fire Punch / Quick Attack | Fire Punch / Feint Attack | Fire Punch / Quick Attack |
| Crobat | Espeon (W) | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Wing Attack | Psychic / Bite | Psychic / Wing Attack |
| Magneton | Miltank (W) | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder | Earthquake / Thunder |
| Gengar | Miltank (W) | Earthquake / Mean Look | Earthquake / Mean Look | Earthquake / Mean Look | Earthquake / Mean Look | Earthquake / Mean Look | Earthquake / Mean Look | Earthquake / Mean Look |
| Alakazam | Miltank (W) | Body Slam / Psychic | Body Slam / Psychic | Body Slam / Psychic | Body Slam / Psychic | Body Slam / Psychic | Body Slam / Psychic | Body Slam / Psychic |
| Meganium | Ampharos (W) | Fire Punch / Body Slam | Fire Punch / Body Slam | Fire Punch / Body Slam | Fire Punch / Body Slam | Fire Punch / Body Slam | Fire Punch / Giga Drain | Fire Punch / Body Slam |

