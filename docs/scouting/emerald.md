# Scouting packet: Emerald (adaptation)

*Roster status: working (D-004). No grades: every line below is a phrase from the phrase book (engine/battle/phrasebook.json), triggered by numbers the engine measures, the way the games turn a Pokémon's best IV into its characteristic. Speed, power and bulk are measured against every fully evolved Pokémon of the same generation. Opponents' philosophy comes from the game's own trainer AI flags, bag and battle lines. Every one-on-one is played out by the scouting engine (docs/SCOUTING_ENGINE.md): our best plan against their best answer, Smogon's calculator for every hit at the lowest roll, every move landing, the odds kept. Against a game's trainers we meet them at their top level; the coach profile is measured against that generation's Smogon OU usage field at Lv 100.*

## Self-scout

### Coach profile

Against the Gen 3 OU usage field (57 Smogon sets): **straight-up (p1), chips (p8), builds first (p73)**. 99-21-222 in 342 one-on-ones. A slider is a share of those fights; p is the percentile among 2,000 random six-Pokémon teams drawn from the field.

| Slider | ◀ | Value | ▶ | Percentile |
|---|---|---|---|---|
| Pace | absorbs first | 58 | strikes first | p32 |
| Punch | chips | 39 | knocks out | p8 |
| Run / pass | special | 40 | physical | p30 |
| Build-up | hits now | 20 | builds first | p73 |
| Sustain | no healing | 2 | heals and resets | p50 |
| Disruption | straight-up | 0 | disruptive | p1 |
| Risk | safe | 36 | gambler | p72 |
| Script | adaptive | 47 | scripted | p45 |

| Player | W-D-L | Pace | Punch | Run / pass | Build-up | Sustain | Disruption | Risk | Script |
|---|---|---|---|---|---|---|---|---|---|
| Swampert | 23-5-29 | 47 (p25) | 47 (p37) | 69 (p60) | 0 (p31) | 5 (p85) | 0 (p27) | 0 (p3) | 49 (p61) |
| Milotic | 25-5-27 | 65 (p45) | 49 (p39) | 8 (p35) | 0 (p31) | 9 (p88) | 0 (p27) | 77 (p96) | 72 (p90) |
| Altaria | 8-5-44 | 58 (p39) | 23 (p17) | 36 (p42) | 26 (p68) | 0 (p41) | 0 (p27) | 18 (p39) | 30 (p5) |
| Arcanine | 19-2-36 | 75 (p63) | 54 (p46) | 12 (p37) | 32 (p74) | 0 (p41) | 0 (p27) | 72 (p96) | 63 (p82) |
| Absol | 9-0-48 | 53 (p31) | 32 (p23) | 51 (p58) | 30 (p70) | 0 (p41) | 0 (p27) | 19 (p40) | 33 (p14) |
| Meganium | 15-4-38 | 51 (p28) | 28 (p21) | 65 (p60) | 35 (p79) | 0 (p41) | 0 (p27) | 28 (p53) | 35 (p18) |

**Play sheet** (its most common call in each situation, against the field):

| Player | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|
| Swampert | Earthquake (51%) | Earthquake (51%) | Earthquake (51%) | Earthquake (54%) | Earthquake (51%) | Earthquake (51%) | Earthquake (53%) |
| Milotic | Hydro Pump (74%) | Hydro Pump (74%) | Hydro Pump (65%) | Ice Beam (65%) | Hydro Pump (72%) | Hydro Pump (68%) | Ice Beam (47%) |
| Altaria | Dragon Claw (39%) | Dragon Claw (46%) | Dragon Claw (46%) | Dragon Claw (54%) | Dragon Claw (46%) | Dragon Claw (44%) | Dragon Claw (53%) |
| Arcanine | Overheat (63%) | Overheat (84%) | Overheat (77%) | Crunch (58%) | Overheat (84%) | Overheat (82%) | Crunch (47%) |
| Absol | Ice Beam (37%) | Ice Beam (40%) | Ice Beam (46%) | Ice Beam (58%) | Ice Beam (40%) | Rock Slide (47%) | Ice Beam (51%) |
| Meganium | Swords Dance (35%) | Earthquake (40%) | Earthquake (42%) | Earthquake (42%) | Giga Drain (47%) | Earthquake (39%) | Giga Drain (49%) |

*Assumed where nothing is on record: EVs 85 in every stat; IVs 31; ability Intimidate (could be Flash Fire); level 100 (the peak); neutral nature.*

- **What we're trying to do:** Win on momentum: Altaria, Arcanine, Absol and Meganium turn one free turn into a sweep. The anchor: Milotic.
- **What we're good at:** 10 attack types in the repertoire. The main ones: Ice (Absol, Milotic and Swampert), Ground (Altaria, Meganium and Swampert), Steel (Arcanine, Meganium and Milotic) and Fire (Altaria and Arcanine). Nothing is safe: 16 of 17 types take super-effective hits from this club. Arcanine sets the pace; Swampert expects to take the first hit.
- **Where we're soft:** No shared hole: no type hits three of the club super-effectively.

| Attack type | Who throws it |
|---|---|
| Ice | Swampert (Ice Beam), Milotic (Ice Beam), Absol (Ice Beam) |
| Ground | Swampert (Earthquake), Altaria (Earthquake), Meganium (Earthquake) |
| Steel | Milotic (Iron Tail), Arcanine (Iron Tail), Meganium (Iron Tail) |
| Fire | Altaria (Fire Blast), Arcanine (Overheat) |
| Dark | Arcanine (Crunch), Absol (Bite) |
| Water | Milotic (Hydro Pump) |
| Grass | Meganium (Giga Drain) |
| Fighting | Swampert (Brick Break) |
| Rock | Absol (Rock Slide) |
| Dragon | Altaria (Dragon Claw) |

## Depth chart

| Player | Philosophy | 1v1 vs the league | Build |
|---|---|---|---|
| **Milotic** | Win the long game: take the hit, heal with Recover, and make the other side break first. | 31-1 | no build on record: the engine filled in its strongest set |
| **Swampert** | Leave nowhere to hide: it has a super-effective answer for 12 of 17 types. | 29-3 | established example (one move known); slots 2-4 filled in by the engine |
| **Meganium** | Be the wall: absorb what the other side throws and hit back steadily. | 28-4 | no build on record: the engine filled in its strongest set |
| **Absol** | Win on momentum: take one free turn for Swords Dance, then everything goes through. | 24-8 | no build on record: the engine filled in its strongest set |
| **Arcanine** | Win on momentum: take one free turn for Agility, then everything goes through. | 22-10 | no build on record: the engine filled in its strongest set |
| **Altaria** | Straight ahead: the best hit, every turn. | 21-11 | no build on record: the engine filled in its strongest set |

## Scouting reports

### Swampert (Water/Ground), Emerald
*Refresh / Earthquake / Ice Beam / Brick Break · Torrent · build: established example (one move known); slots 2-4 filled in by the engine*

- **Philosophy:** Leave nowhere to hide: it has a super-effective answer for 12 of 17 types.
- **Tendencies:** Expects to take the first hit: only 28% of its generation is slower. Hits from both sides (Earthquake and Brick Break physical, Ice Beam special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Earthquake. Hard to move from either side: top-quarter bulk against physical and special hits.
- **When it's ahead:** Ahead, it keeps throwing Earthquake.
- **When it's behind:** Even behind, it can eat one more hit. Low on HP, Torrent kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Dark, Dragon, Electric, Fire, Flying, Grass, Ground, Ice, Normal, Poison, Rock and Steel. One fatal hole: Grass hits it four times as hard. Look out for Grass (×4). A free switch-in against Electric.
- **Against moves:** It cleans up status for the whole team with Refresh.
- **How you beat it:** Hit it with something it can't hit back: Ludicolo are the classic answers.
- **Production:** Won 29 of 32 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Feraligatr, Poliwrath and Walrein. Pokédex, Emerald: “If it senses the approach of a storm and a tidal wave, it protects its seaside nest by piling up boulders. It swims as fast as a jet ski.”

### Milotic (Water), Emerald
*Hydro Pump / Ice Beam / Iron Tail / Recover · Marvel Scale · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win the long game: take the hit, heal with Recover, and make the other side break first.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Hits from both sides (Iron Tail physical, Hydro Pump and Ice Beam special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Hydro Pump. Shrugs off special attacks far better than physical ones. Can miss when it matters: Hydro Pump (80%) and Iron Tail (75%).
- **When it's ahead:** Ahead, it keeps throwing Hydro Pump.
- **When it's behind:** Behind, it heals with Recover.
- **Against types:** Feeds on Dragon, Fire, Flying, Grass, Ground, Ice and Rock. Struggles to hurt Water. Look out for Electric (×2) and Grass (×2).
- **Against moves:** Marvel Scale: a status condition makes it sturdier.
- **How you beat it:** Hit it with something it can't hit back: Jolteon, Electrode, Manectric and Electabuzz are the classic answers.
- **Production:** Won 31 of 32 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Politoed, Ludicolo and Tentacruel. Pokédex, Emerald: “It is said to live at the bottom of large lakes. Considered to be the most beautiful of all POKéMON, it has been depicted in paintings and statues.”

### Altaria (Dragon/Flying), Emerald
*Dragon Claw / Earthquake / Fire Blast / Dragon Dance · Natural Cure · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Straight ahead: the best hit, every turn.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Hits from both sides (Earthquake physical, Dragon Claw and Fire Blast special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Dragon Claw. A light hitter: its best attacking stat sits in the bottom quarter of its generation. Can miss when it matters: Fire Blast (85%).
- **When it's ahead:** Ahead, it takes the free turn for Dragon Dance.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Bug, Dragon, Electric, Fire, Grass, Ice, Poison, Rock and Steel. One fatal hole: Ice hits it four times as hard. Look out for Ice (×4), Rock (×2) and Dragon (×2). A free switch-in against Ground.
- **Against moves:** Natural Cure: switching out cures its status.
- **How you beat it:** Hit it with something it can't hit back: Cloyster, Walrein, Lapras and Dewgong are the classic answers.
- **Production:** Won 21 of 32 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Meganium, Kingdra and Blastoise. Pokédex, Emerald: “It hums in a beautiful soprano voice. It flies among white clouds in the blue sky. It launches intensely hot fireballs from its mouth.”

### Arcanine (Fire), Emerald
*Overheat / Crunch / Iron Tail / Agility · Intimidate · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Agility, then everything goes through.
- **Tendencies:** Usually swings first: 75% of its generation is slower. Hits from both sides (Iron Tail physical, Overheat and Crunch special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Overheat. Can miss when it matters: Iron Tail (75%).
- **When it's ahead:** Ahead, it takes the free turn for Agility.
- **When it's behind:** Behind, it swings for the KO and hopes it lands first.
- **Against types:** Feeds on Bug, Ghost, Grass, Ice, Psychic, Rock and Steel. Look out for Water (×2), Ground (×2) and Rock (×2).
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How you beat it:** Hit it with something it can't hit back: Sharpedo, Gyarados, Kingler and Dugtrio are the classic answers.
- **Production:** Won 22 of 32 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Blaziken, Entei and Moltres. Pokédex, Emerald: “This fleet-footed POKéMON is said to run over 6,200 miles in a single day and night. The fire that blazes wildly within its body is its source of power.”

### Absol (Dark), Emerald
*Bite / Rock Slide / Ice Beam / Swords Dance · Pressure · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Swords Dance, then everything goes through.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Hits from both sides (Rock Slide physical, Bite and Ice Beam special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Rock Slide. Raw power near the top of its generation. Glass on one side: it can't afford to take many hits there.
- **When it's ahead:** Ahead, it takes the free turn for Swords Dance.
- **When it's behind:** Behind, it has no way back. Get it out before it's caught low.
- **Against types:** Feeds on Bug, Dragon, Fire, Flying, Ghost, Grass, Ground, Ice and Psychic. Struggles to hurt Steel. Look out for Fighting (×2) and Bug (×2). A free switch-in against Psychic.
- **Against moves:** Pressure: your moves burn extra PP.
- **How you beat it:** Hit it with something it can't hit back: Heracross, Hitmonlee, Primeape and Blaziken are the classic answers.
- **Production:** Won 24 of 32 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Banette, Crawdaunt and Breloom. Pokédex, Emerald: “It sharply senses even subtle changes in the sky and the land to predict natural disasters. It is a long-lived POKéMON that has a life-span of 100 years.”

### Meganium (Grass), Emerald
*Giga Drain / Earthquake / Iron Tail / Swords Dance · Overgrow · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Be the wall: absorb what the other side throws and hit back steadily.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Hits from both sides (Earthquake and Iron Tail physical, Giga Drain special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Earthquake. Can miss when it matters: Iron Tail (75%).
- **When it's ahead:** Ahead, it takes the free turn for Swords Dance.
- **When it's behind:** Even behind, it can eat one more hit. Low on HP, Overgrow kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Electric, Fire, Ground, Ice, Poison, Rock, Steel and Water. Look out for Fire (×2), Ice (×2), Poison (×2), Flying (×2) and Bug (×2).
- **How you beat it:** Hit it with something it can't hit back: Ninjask, Gengar, Salamence and Crobat are the classic answers.
- **Production:** Won 28 of 32 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Blastoise, Venusaur and Ludicolo. Pokédex, Emerald: “The fragrance of a MEGANIUM’s flower soothes and calms emotions. In battle, it gives off more of its becalming scent to blunt the foe’s fighting spirit.”

## Call sheets

### Call sheet vs Sidney (Lv 49, pret/pokeemerald src/data/trainer_parties.h sParty_Sidney)

- **Order:** Mightyena (Lv 46), Shiftry (Lv 48), Cacturne (Lv 46), Crawdaunt (Lv 48), Absol (Lv 49). Lead with Meganium: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. It's coded to set up on its first turn. Their best player: Crawdaunt, which beats 1 of your 6. Your last one standing: Swampert.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Mightyena L46 | Roar · Double-Edge · Sand Attack · Crunch | Meganium: Giga Drain 36.6-43.3% | Arcanine: Overheat 97-114.9% | — |
| Shiftry L48 | Torment · Double Team · Swagger · Extrasensory | Arcanine: Overheat 158.9-187.3% | Milotic: Ice Beam 72.8-86.1% | — |
| Cacturne L46 | Leech Seed · Feint Attack · Needle Arm · Cotton Spore | Milotic: Ice Beam 89.6-106% | Absol: Ice Beam 71.6-85.1% | — |
| Crawdaunt L48 | Surf · Swords Dance · Strength · Facade | Swampert: Brick Break 57.6-68.2% | Meganium: Giga Drain 77.3-90.9% | — |
| Absol L49 | Aerial Ace · Rock Slide · Swords Dance · Slash @ Sitrus Berry | Swampert: Earthquake 70.1-83.2% | Meganium: Earthquake 37.2-44.5% | — |

**Mightyena L46**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Double-Edge (its best hit on Swampert, Milotic, Altaria, Arcanine, Absol and Meganium). Hits from both sides (Double-Edge physical, Crunch special): no single wall stops it.
- **Against moves:** Intimidate: your Attack drops the moment it comes in. If you set up, it forces you out with Roar.
- **How to attack it:** Hit it with Fighting. The call: Meganium: Giga Drain 36.6-43.3%. Backup: Arcanine: Overheat 97-114.9%. Its blind spot: Swampert, Milotic, Altaria, Arcanine and Meganium take almost nothing from it.

**Shiftry L48**

- **Tendencies:** You move first, every time. Its go-to: Extrasensory (its best hit on Swampert, Milotic, Altaria, Arcanine and Meganium).
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Fighting, Fire and Ice. The call: Arcanine: Overheat 158.9-187.3%. Backup: Milotic: Ice Beam 72.8-86.1%. Its blind spot: Swampert, Milotic, Altaria, Arcanine, Absol and Meganium take almost nothing from it.

**Cacturne L46**

- **Tendencies:** You move first, every time. Its go-to: Needle Arm (its best hit on Swampert, Milotic and Absol). Otherwise: Feint Attack against Altaria, Arcanine and Meganium.
- **When it's behind:** When it's low, it heals itself with Leech Seed.
- **Against moves:** Sand Veil: harder to hit in a sandstorm.
- **How to attack it:** Hit it with Fighting, Fire and Ice. The call: Milotic: Ice Beam 89.6-106%. Backup: Absol: Ice Beam 71.6-85.1%. Its blind spot: Altaria, Arcanine and Meganium take almost nothing from it.

**Crawdaunt L48**

- **Tendencies:** You move first, every time. Its go-to: Surf (its best hit on Swampert, Arcanine and Absol). Otherwise: Strength against Milotic, Altaria and Meganium. Hits from both sides (Strength and Facade physical, Surf special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Swords Dance.
- **How to attack it:** Hit it with Fighting and Grass. The call: Swampert: Brick Break 57.6-68.2%. Backup: Meganium: Giga Drain 77.3-90.9%. Its blind spot: Swampert, Milotic, Altaria and Meganium take almost nothing from it.

**Absol L49**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Rock Slide (its best hit on Milotic, Altaria, Arcanine and Absol). Otherwise: Slash against Swampert; Aerial Ace against Meganium. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Swords Dance.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** Hit it with Fighting. The call: Swampert: Earthquake 70.1-83.2%. Backup: Meganium: Earthquake 37.2-44.5%. Its blind spot: Swampert and Milotic take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Mightyena | Meganium (W) | Swords Dance / Sand Attack | Giga Drain / Double-Edge | Giga Drain / Double-Edge | Giga Drain / Double-Edge | Giga Drain / Double-Edge | Giga Drain / Double-Edge | Giga Drain / Double-Edge |
| Shiftry | Arcanine (W) | Overheat / Double Team | Overheat / Extrasensory | Overheat / Extrasensory | Overheat / Extrasensory | Overheat / Extrasensory | Overheat / Extrasensory | Overheat / Extrasensory |
| Cacturne | Milotic (W) | Ice Beam / Leech Seed | Ice Beam / Needle Arm | Ice Beam / Needle Arm | Ice Beam / Needle Arm | Ice Beam / Needle Arm | Ice Beam / Needle Arm | Ice Beam / Needle Arm |
| Crawdaunt | Swampert (W) | Brick Break / Swords Dance | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf |
| Absol | Swampert (W) | Brick Break / Swords Dance | Brick Break / Slash | Earthquake / Slash | Earthquake / Slash | Brick Break / Slash | Brick Break / Slash | Earthquake / Slash |

### Call sheet vs Phoebe (Lv 51, pret/pokeemerald src/data/trainer_parties.h sParty_Phoebe)

- **Order:** Dusclops (Lv 48), Banette (Lv 49), Sableye (Lv 50), Banette (Lv 49), Dusclops (Lv 51). Lead with Arcanine: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Dusclops, which beats 1 of your 6. Your last one standing: Swampert.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Dusclops L48 | Shadow Punch · Confuse Ray · Curse · Protect | Arcanine: Overheat 66.4-79.1% | Swampert: Earthquake 50.9-60.9% | — |
| Banette L49 | Shadow Ball · Grudge · Will-O-Wisp · Feint Attack | Arcanine: Overheat 95.6-113.2% | Absol: Bite 68.4-80.9% | — |
| Sableye L50 | Shadow Ball · Double Team · Night Shade · Feint Attack | Swampert: Earthquake 68.8-81.6% | Meganium: Giga Drain 38.4-45.6% | — |
| Banette L49 | Shadow Ball · Psychic · Thunderbolt · Facade | Arcanine: Overheat 95.6-113.2% | Absol: Bite 68.4-80.9% | — |
| Dusclops L51 | Shadow Ball · Ice Beam · Rock Slide · Earthquake @ Sitrus Berry | Swampert: Earthquake 46.2-54.7% | Absol: Bite 43.6-51.3% | — |

**Dusclops L48**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Shadow Punch (its best hit on Swampert, Milotic, Altaria, Arcanine, Absol and Meganium).
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Pressure: your moves burn extra PP. Stalls with Protect.
- **How to attack it:** Hit it with Dark. The call: Arcanine: Overheat 66.4-79.1%. Backup: Swampert: Earthquake 50.9-60.9%. Its blind spot: Swampert, Milotic, Altaria, Arcanine, Absol and Meganium take almost nothing from it.

**Banette L49**

- **Tendencies:** You move first, every time. Its go-to: Shadow Ball (its best hit on Swampert, Milotic, Altaria, Arcanine, Absol and Meganium). Hits from both sides (Shadow Ball physical, Feint Attack special): no single wall stops it.
- **When it's ahead:** Expect Will-O-Wisp early.
- **Against moves:** Insomnia: it can't be put to sleep.
- **How to attack it:** Hit it with Dark. The call: Arcanine: Overheat 95.6-113.2%. Backup: Absol: Bite 68.4-80.9%. Its blind spot: Absol takes almost nothing from it.

**Sableye L50**

- **Tendencies:** You move first, every time. Its go-to: Night Shade (its best hit on Swampert, Milotic, Altaria, Arcanine, Absol and Meganium). Hits from both sides (Shadow Ball physical, Feint Attack special): no single wall stops it.
- **Against moves:** Keen Eye: its accuracy can't be lowered.
- **How to attack it:** The call: Swampert: Earthquake 68.8-81.6%. Backup: Meganium: Giga Drain 38.4-45.6%.

**Banette L49**

- **Tendencies:** You move first, every time. Its go-to: Shadow Ball (its best hit on Swampert, Milotic, Altaria, Arcanine and Meganium). Otherwise: Thunderbolt against Absol. Hits from both sides (Shadow Ball and Facade physical, Psychic and Thunderbolt special): no single wall stops it.
- **Against moves:** Insomnia: it can't be put to sleep.
- **How to attack it:** Hit it with Dark. The call: Arcanine: Overheat 95.6-113.2%. Backup: Absol: Bite 68.4-80.9%. Its blind spot: Absol takes almost nothing from it.

**Dusclops L51**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Shadow Ball (its best hit on Swampert and Milotic). Otherwise: Ice Beam against Altaria and Meganium; Earthquake against Arcanine and Absol. Hits from both sides (Shadow Ball, Rock Slide and Earthquake physical, Ice Beam special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** Hit it with Dark. The call: Swampert: Earthquake 46.2-54.7%. Backup: Absol: Bite 43.6-51.3%. Its blind spot: Swampert and Milotic take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Dusclops | Arcanine (W) | Crunch / Shadow Punch | Crunch / Shadow Punch | Crunch / Shadow Punch | Crunch / Shadow Punch | Crunch / Shadow Punch | Crunch / Shadow Punch | Crunch / Shadow Punch |
| Banette | Arcanine (W) | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball |
| Sableye | Swampert (W) | Earthquake / Night Shade | Earthquake / Night Shade | Earthquake / Night Shade | Earthquake / Night Shade | Earthquake / Night Shade | Earthquake / Night Shade | Earthquake / Night Shade |
| Banette | Arcanine (W) | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball | Crunch / Shadow Ball |
| Dusclops | Swampert (W) | Earthquake / Shadow Ball | Earthquake / Shadow Ball | Earthquake / Shadow Ball | Earthquake / Shadow Ball | Earthquake / Shadow Ball | Earthquake / Shadow Ball | Earthquake / Shadow Ball |

### Call sheet vs Glacia (Lv 53, pret/pokeemerald src/data/trainer_parties.h sParty_Glacia)

- **Order:** Sealeo (Lv 50), Glalie (Lv 50), Sealeo (Lv 52), Glalie (Lv 52), Walrein (Lv 53). Lead with Meganium: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Walrein, which beats 2 of your 6. Your last one standing: Swampert.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Sealeo L50 | Encore · Body Slam · Hail · Ice Ball | Meganium: Giga Drain 58.2-69.1% | Swampert: Brick Break 60.6-71.5% | — |
| Glalie L50 | Light Screen · Crunch · Icy Wind · Ice Beam | Swampert: Brick Break 58.1-68.4% | Arcanine: Overheat 147.7-174.2% | — |
| Sealeo L52 | Attract · Double-Edge · Hail · Blizzard | Swampert: Brick Break 56.1-66.7% | Meganium: Giga Drain 54.4-64.3% | Altaria |
| Glalie L52 | Shadow Ball · Explosion · Hail · Ice Beam | Swampert: Earthquake 53.8-63.8% | Meganium: Iron Tail 58.1-68.8% | Absol |
| Walrein L53 | Surf · Body Slam · Ice Beam · Sheer Cold @ Sitrus Berry | Swampert: Brick Break 39.8-46.9% | Meganium: Giga Drain 38.8-45.9% | Altaria |

**Sealeo L50**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Body Slam (its best hit on Swampert, Milotic, Arcanine and Absol). Otherwise: Ice Ball against Altaria and Meganium. Hits from both sides (Body Slam physical, Ice Ball special): no single wall stops it.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Fighting, Grass and Rock. The call: Meganium: Giga Drain 58.2-69.1%. Backup: Swampert: Brick Break 60.6-71.5%. Its blind spot: Swampert, Milotic, Arcanine, Absol and Meganium take almost nothing from it.

**Glalie L50**

- **Tendencies:** Gets the jump on Swampert. Its go-to: Ice Beam (its best hit on Swampert, Altaria, Absol and Meganium). Otherwise: Crunch against Milotic and Arcanine.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Fighting, Fire, Rock and Steel. The call: Swampert: Brick Break 58.1-68.4%. Backup: Arcanine: Overheat 147.7-174.2%. Its blind spot: Swampert, Milotic and Arcanine take almost nothing from it.

**Sealeo L52**

- **Tendencies:** You move first, every time. Its go-to: Blizzard (its best hit on Swampert, Altaria, Absol and Meganium). Otherwise: Double-Edge against Milotic and Arcanine. Hits from both sides (Double-Edge physical, Blizzard special): no single wall stops it.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Fighting, Grass and Rock. The call: Swampert: Brick Break 56.1-66.7%. Backup: Meganium: Giga Drain 54.4-64.3%. Keep Altaria away from it: one hit and they're gone. Its blind spot: Milotic and Arcanine take almost nothing from it.

**Glalie L52**

- **Tendencies:** Gets the jump on Swampert. Its go-to: Explosion (its best hit on Swampert, Milotic, Arcanine, Absol and Meganium). Otherwise: Ice Beam against Altaria. Hits from both sides (Shadow Ball and Explosion physical, Ice Beam special): no single wall stops it.
- **When it's behind:** Cornered, it can take one of yours down with it (Explosion).
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Fighting, Fire, Rock and Steel. The call: Swampert: Earthquake 53.8-63.8%. Backup: Meganium: Iron Tail 58.1-68.8%. Keep Absol away from it: one hit and they're gone.

**Walrein L53**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Surf (its best hit on Swampert, Arcanine and Absol). Otherwise: Ice Beam against Altaria and Meganium; Body Slam against Milotic. Hits from both sides (Body Slam physical, Surf and Ice Beam special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Fighting, Grass and Rock. The call: Swampert: Brick Break 39.8-46.9%. Backup: Meganium: Giga Drain 38.8-45.9%. Keep Altaria away from it: one hit and they're gone. Its blind spot: Milotic takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Sealeo | Meganium (W) | Giga Drain / Ice Ball | Giga Drain / Ice Ball | Giga Drain / Ice Ball | Giga Drain / Ice Ball | Giga Drain / Ice Ball | Giga Drain / Ice Ball | Giga Drain / Ice Ball |
| Glalie | Swampert (W) | Brick Break / Ice Beam | Brick Break / Ice Beam | Brick Break / Ice Beam | Brick Break / Ice Beam | Brick Break / Ice Beam | Brick Break / Ice Beam | Brick Break / Ice Beam |
| Sealeo | Swampert (W) | Brick Break / Blizzard | Brick Break / Blizzard | Brick Break / Blizzard | Brick Break / Blizzard | Brick Break / Blizzard | Brick Break / Blizzard | Brick Break / Blizzard |
| Glalie | Swampert (W) | Brick Break / Explosion | Brick Break / Explosion | Earthquake / Explosion | Earthquake / Ice Beam | Brick Break / Explosion | Brick Break / Explosion | Earthquake / Explosion |
| Walrein | Swampert (W) | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf | Brick Break / Surf |

### Call sheet vs Drake (Lv 55, pret/pokeemerald src/data/trainer_parties.h sParty_Drake)

- **Order:** Shelgon (Lv 52), Altaria (Lv 54), Kingdra (Lv 53), Flygon (Lv 53), Salamence (Lv 55). Lead with Milotic: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Salamence, which beats 3 of your 6. Your last one standing: Swampert.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Shelgon L52 | Rock Tomb · Dragon Claw · Protect · Double-Edge | Milotic: Ice Beam 107.6-126.9% | Altaria: Dragon Claw 105.5-124.1% | — |
| Altaria L54 | Double-Edge · Dragon Breath · Dragon Dance · Aerial Ace | Milotic: Ice Beam 105.6-124.2% | Swampert: Ice Beam 95-111.8% | — |
| Kingdra L53 | Smokescreen · Dragon Dance · Surf · Body Slam | Altaria: Dragon Claw 57.6-68.4% | Meganium: Earthquake 26.6-31.6% | — |
| Flygon L53 | Flamethrower · Crunch · Dragon Breath · Earthquake | Swampert: Ice Beam 118.4-139.9% | Milotic: Ice Beam 133.1-157.1% | — |
| Salamence L55 | Flamethrower · Dragon Claw · Rock Slide · Crunch @ Sitrus Berry | Milotic: Ice Beam 111.3-131.2% | Swampert: Ice Beam 98.4-116.1% | — |

**Shelgon L52**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Double-Edge (its best hit on Swampert, Milotic, Arcanine, Absol and Meganium). Otherwise: Dragon Claw against Altaria. Hits from both sides (Rock Tomb and Double-Edge physical, Dragon Claw special): no single wall stops it.
- **Against moves:** Rock Head: no recoil damage. Stalls with Protect.
- **How to attack it:** Hit it with Dragon and Ice. The call: Milotic: Ice Beam 107.6-126.9%. Backup: Altaria: Dragon Claw 105.5-124.1%. Its blind spot: Swampert, Milotic, Arcanine and Meganium take almost nothing from it.

**Altaria L54**

- **Tendencies:** Gets the jump on Swampert. Its go-to: Double-Edge (its best hit on Swampert, Milotic, Arcanine and Absol). Otherwise: Dragon Breath against Altaria; Aerial Ace against Meganium. Hits from both sides (Double-Edge and Aerial Ace physical, Dragon Breath special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance.
- **Against moves:** Natural Cure: switching out cures its status.
- **How to attack it:** Hit it with Dragon, Ice and Rock. The call: Milotic: Ice Beam 105.6-124.2%. Backup: Swampert: Ice Beam 95-111.8%. Its blind spot: Swampert, Milotic and Arcanine take almost nothing from it.

**Kingdra L53**

- **Tendencies:** Gets the jump on Swampert. Its go-to: Surf (its best hit on Swampert, Arcanine and Absol). Otherwise: Body Slam against Milotic, Altaria and Meganium. Hits from both sides (Body Slam physical, Surf special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance.
- **Against moves:** Swift Swim: doubles its Speed in rain.
- **How to attack it:** Hit it with Dragon. The call: Altaria: Dragon Claw 57.6-68.4%. Backup: Meganium: Earthquake 26.6-31.6%. Its blind spot: Milotic, Altaria and Meganium take almost nothing from it.

**Flygon L53**

- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Earthquake (its best hit on Swampert, Milotic, Arcanine and Absol). Otherwise: Dragon Breath against Altaria; Flamethrower against Meganium. Hits from both sides (Earthquake physical, Flamethrower, Crunch and Dragon Breath special): no single wall stops it.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dragon and Ice. The call: Swampert: Ice Beam 118.4-139.9%. Backup: Milotic: Ice Beam 133.1-157.1%.

**Salamence L55**

- **Order:** Last in the order.
- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Dragon Claw (its best hit on Swampert, Altaria and Absol). Otherwise: Rock Slide against Milotic and Arcanine; Flamethrower against Meganium. Hits from both sides (Rock Slide physical, Flamethrower, Dragon Claw and Crunch special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Dragon, Ice and Rock. The call: Milotic: Ice Beam 111.3-131.2%. Backup: Swampert: Ice Beam 98.4-116.1%. Its blind spot: Milotic takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Shelgon | Milotic (W) | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge |
| Altaria | Milotic (W) | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge | Ice Beam / Double-Edge |
| Kingdra | Altaria (W) | Dragon Claw / Body Slam | Dragon Claw / Body Slam | Dragon Claw / Body Slam | Dragon Claw / Body Slam | Dragon Claw / Body Slam | Dragon Claw / Body Slam | Dragon Claw / Body Slam |
| Flygon | Swampert (W) | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake | Ice Beam / Earthquake |
| Salamence | Milotic (W) | Ice Beam / Rock Slide | Ice Beam / Rock Slide | Ice Beam / Rock Slide | Ice Beam / Dragon Claw | Ice Beam / Rock Slide | Ice Beam / Rock Slide | Ice Beam / Rock Slide |

### Call sheet vs Champion Wallace (Lv 58, pret/pokeemerald src/data/trainer_parties.h sParty_Wallace)

- **Order:** Wailord (Lv 57), Tentacruel (Lv 55), Ludicolo (Lv 56), Whiscash (Lv 56), Gyarados (Lv 56), Milotic (Lv 58). Lead with Meganium: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Milotic, which beats 4 of your 6. Your last one standing: Meganium.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Wailord L57 | Rain Dance · Water Spout · Double-Edge · Blizzard | Meganium: Giga Drain 50-59% | Swampert: Earthquake 51.1-60.4% | — |
| Tentacruel L55 | Toxic · Hydro Pump · Sludge Bomb · Ice Beam | Swampert: Earthquake 132.9-156.5% | Meganium: Earthquake 70.6-83.5% | — |
| Ludicolo L56 | Giga Drain · Surf · Leech Seed · Double Team | Meganium: Giga Drain 22.7-26.7% | Altaria: Dragon Claw 26.2-31.4% | — |
| Whiscash L56 | Earthquake · Surf · Amnesia · Hyper Beam | Meganium: Giga Drain 99-116.5% | Swampert: Earthquake 48.5-57.3% | — |
| Gyarados L56 | Dragon Dance · Earthquake · Hyper Beam · Surf | Meganium: Giga Drain 20.6-24.3% | Milotic: Ice Beam 23.8-28.6% | — |
| Milotic L58 | Recover · Surf · Ice Beam · Toxic @ Sitrus Berry | Swampert: Earthquake 46.9-55.6% | Meganium: Giga Drain 31.6-37.8% | — |

**Wailord L57**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Water Spout (its best hit on Swampert, Arcanine and Absol). Otherwise: Blizzard against Altaria and Meganium; Double-Edge against Milotic. Hits from both sides (Double-Edge physical, Water Spout and Blizzard special): no single wall stops it.
- **How to attack it:** Hit it with Grass. The call: Meganium: Giga Drain 50-59%. Backup: Swampert: Earthquake 51.1-60.4%. Its blind spot: Milotic takes almost nothing from it.

**Tentacruel L55**

- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Hydro Pump (its best hit on Swampert, Arcanine and Absol). Otherwise: Sludge Bomb against Milotic and Meganium; Ice Beam against Altaria. Hits from both sides (Sludge Bomb physical, Hydro Pump and Ice Beam special): no single wall stops it.
- **When it's ahead:** Expect Toxic early.
- **Against moves:** Clear Body: its stats can't be lowered.
- **How to attack it:** Hit it with Ground. The call: Swampert: Earthquake 132.9-156.5%. Backup: Meganium: Earthquake 70.6-83.5%. Its blind spot: Milotic takes almost nothing from it.

**Ludicolo L56**

- **Tendencies:** You move first, every time. Its go-to: Surf (its best hit on Altaria, Arcanine, Absol and Meganium). Otherwise: Giga Drain against Swampert and Milotic.
- **When it's behind:** When it's low, it heals itself with Leech Seed.
- **Against moves:** Swift Swim: doubles its Speed in rain.
- **How to attack it:** The call: Meganium: Giga Drain 22.7-26.7%. Backup: Altaria: Dragon Claw 26.2-31.4%. Its blind spot: Altaria and Meganium take almost nothing from it.

**Whiscash L56**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Swampert, Milotic, Arcanine and Absol). Otherwise: Hyper Beam against Altaria and Meganium. Hits from both sides (Earthquake and Hyper Beam physical, Surf special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Amnesia.
- **How to attack it:** Hit it with Grass. The call: Meganium: Giga Drain 99-116.5%. Backup: Swampert: Earthquake 48.5-57.3%. Its blind spot: Swampert and Meganium take almost nothing from it.

**Gyarados L56**

- **Tendencies:** Gets the jump on Swampert. Its go-to: Hyper Beam (its best hit on Swampert, Milotic, Altaria, Absol and Meganium). Otherwise: Earthquake against Arcanine. Hits from both sides (Earthquake and Hyper Beam physical, Surf special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Rock. The call: Meganium: Giga Drain 20.6-24.3%. Backup: Milotic: Ice Beam 23.8-28.6%.

**Milotic L58**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Swampert. Its go-to: Surf (its best hit on Swampert, Milotic, Arcanine and Absol). Otherwise: Ice Beam against Altaria and Meganium. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Expect Toxic early.
- **When it's behind:** When it's low, it heals itself with Recover.
- **Against moves:** Marvel Scale: a status condition makes it sturdier.
- **How to attack it:** Hit it with Grass. The call: Swampert: Earthquake 46.9-55.6%. Backup: Meganium: Giga Drain 31.6-37.8%. Its blind spot: Milotic takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Wailord | Meganium (W) | Giga Drain / Blizzard | Giga Drain / Blizzard | Giga Drain / Blizzard | Giga Drain / Water Spout | Giga Drain / Blizzard | Giga Drain / Blizzard | Giga Drain / Blizzard |
| Tentacruel | Swampert (W) | Earthquake / Hydro Pump | Earthquake / Hydro Pump | Earthquake / Hydro Pump | Earthquake / Hydro Pump | Earthquake / Hydro Pump | Earthquake / Hydro Pump | Earthquake / Hydro Pump |
| Ludicolo | Meganium (W) | Giga Drain / Surf | Giga Drain / Surf | Giga Drain / Surf | Giga Drain / Surf | Giga Drain / Surf | Giga Drain / Surf | Giga Drain / Surf |
| Whiscash | Meganium (W) | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam |
| Gyarados | Meganium (W) | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam | Giga Drain / Hyper Beam |
| Milotic | Swampert (W) | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf | Earthquake / Surf |

### Call sheet vs Steven (Lv 78, pret/pokeemerald src/data/trainer_parties.h sParty_Steven)

- **Order:** Skarmory (Lv 77), Claydol (Lv 75), Aggron (Lv 76), Cradily (Lv 76), Armaldo (Lv 76), Metagross (Lv 78). Lead with Swampert: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Cradily, which beats 3 of your 6. Your last one standing: Milotic.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Skarmory L77 | Toxic · Aerial Ace · Spikes · Steel Wing | Swampert: Ice Beam 33.8-40% | Absol: Ice Beam 30.5-36.2% | — |
| Claydol L75 | Reflect · Light Screen · Ancient Power · Earthquake | Meganium: Giga Drain 44.4-52.5% | Swampert: Ice Beam 47-55.6% | — |
| Aggron L76 | Thunder · Earthquake · Solar Beam · Dragon Claw | Swampert: Earthquake 115.3-135.8% | Meganium: Earthquake 61.4-72.6% | — |
| Cradily L76 | Giga Drain · Ancient Power · Ingrain · Confuse Ray | Milotic: Ice Beam 47.1-55.8% | Absol: Ice Beam 38.8-45.8% | — |
| Armaldo L76 | Water Pulse · Ancient Power · Aerial Ace · Slash | Swampert: Earthquake 45.7-53.8% | Milotic: Hydro Pump 123.3-145.3% | — |
| Metagross L78 | Earthquake · Psychic · Meteor Mash · Shadow Ball @ Sitrus Berry | Swampert: Earthquake 69.1-81.4% | Arcanine: Overheat 119.5-140.7% | — |

**Skarmory L77**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Aerial Ace (its best hit on Swampert, Milotic, Arcanine and Meganium). Otherwise: Steel Wing against Altaria and Absol.
- **When it's ahead:** Expect Toxic early.
- **Against moves:** Keen Eye: its accuracy can't be lowered.
- **How to attack it:** Hit it with Fire. The call: Swampert: Ice Beam 33.8-40%. Backup: Absol: Ice Beam 30.5-36.2%. Its blind spot: Swampert, Milotic, Altaria and Arcanine take almost nothing from it.

**Claydol L75**

- **Tendencies:** Gets the jump on Swampert. Its go-to: Earthquake (its best hit on Swampert, Milotic, Arcanine, Absol and Meganium). Otherwise: Ancient Power against Altaria.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark, Grass, Ice and Water. The call: Meganium: Giga Drain 44.4-52.5%. Backup: Swampert: Ice Beam 47-55.6%. Its blind spot: Swampert, Milotic, Altaria and Meganium take almost nothing from it.

**Aggron L76**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Arcanine, Absol and Meganium). Otherwise: Solar Beam against Swampert; Thunder against Milotic; Dragon Claw against Altaria. Hits from both sides (Earthquake physical, Thunder, Solar Beam and Dragon Claw special): no single wall stops it.
- **Against moves:** Sturdy: one-hit KO moves fail.
- **How to attack it:** Hit it with Fighting, Ground and Water. The call: Swampert: Earthquake 115.3-135.8%. Backup: Meganium: Earthquake 61.4-72.6%. Its blind spot: Milotic, Altaria and Meganium take almost nothing from it.

**Cradily L76**

- **Tendencies:** You move first, every time. Its go-to: Giga Drain (its best hit on Swampert, Milotic and Absol). Otherwise: Ancient Power against Altaria, Arcanine and Meganium. Hits from both sides (Ancient Power physical, Giga Drain special): no single wall stops it.
- **When it's ahead:** Expect Confuse Ray early.
- **When it's behind:** When it's low, it heals itself with Ingrain.
- **How to attack it:** Hit it with Fighting, Ice and Steel. The call: Milotic: Ice Beam 47.1-55.8%. Backup: Absol: Ice Beam 38.8-45.8%. Its blind spot: Milotic, Absol and Meganium take almost nothing from it.

**Armaldo L76**

- **Tendencies:** You move first, every time. Its go-to: Ancient Power (its best hit on Milotic, Altaria, Arcanine and Absol). Otherwise: Slash against Swampert; Aerial Ace against Meganium. Hits from both sides (Ancient Power, Aerial Ace and Slash physical, Water Pulse special): no single wall stops it.
- **How to attack it:** Hit it with Rock, Steel and Water. The call: Swampert: Earthquake 45.7-53.8%. Backup: Milotic: Hydro Pump 123.3-145.3%. Its blind spot: Swampert and Milotic take almost nothing from it.

**Metagross L78**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Swampert, Milotic and Arcanine). Otherwise: Meteor Mash against Altaria, Absol and Meganium. Hits from both sides (Earthquake, Meteor Mash and Shadow Ball physical, Psychic special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Clear Body: its stats can't be lowered.
- **How to attack it:** Hit it with Fire and Ground. The call: Swampert: Earthquake 69.1-81.4%. Backup: Arcanine: Overheat 119.5-140.7%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Skarmory | Swampert (W) | Ice Beam / Aerial Ace | Ice Beam / Aerial Ace | Ice Beam / Aerial Ace | Ice Beam / Aerial Ace | Ice Beam / Aerial Ace | Ice Beam / Aerial Ace | Ice Beam / Aerial Ace |
| Claydol | Meganium (W) | Giga Drain / Earthquake | Giga Drain / Earthquake | Giga Drain / Earthquake | Giga Drain / Earthquake | Giga Drain / Earthquake | Giga Drain / Earthquake | Giga Drain / Earthquake |
| Aggron | Swampert (W) | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam |
| Cradily | Milotic (W) | Ice Beam / Giga Drain | Ice Beam / Giga Drain | Ice Beam / Giga Drain | Ice Beam / Giga Drain | Ice Beam / Giga Drain | Ice Beam / Giga Drain | Ice Beam / Giga Drain |
| Armaldo | Swampert (W) | Earthquake / Slash | Earthquake / Slash | Earthquake / Slash | Earthquake / Slash | Earthquake / Slash | Earthquake / Slash | Earthquake / Slash |
| Metagross | Swampert (W) | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake |

