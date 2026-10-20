# Scouting packet: SoulSilver (experience)

*Roster status: provisional (D-010). No grades: every line below is a phrase from the phrase book (engine/battle/phrasebook.json), triggered by numbers the engine measures, the way the games turn a Pokémon's best IV into its characteristic. Speed, power and bulk are measured against every fully evolved Pokémon of the same generation. Opponents' philosophy comes from the game's own trainer AI flags, bag and battle lines. Every one-on-one is played out by the scouting engine (docs/SCOUTING_ENGINE.md): our best plan against their best answer, Smogon's calculator for every hit at the lowest roll, every move landing, the odds kept. Against a game's trainers we meet them at their top level; the coach profile is measured against that generation's Smogon OU usage field at Lv 100.*

## Self-scout

### Coach profile

Against the Gen 4 OU usage field (73 Smogon sets): **chips (p4), straight-up (p5), scripted (p94)**. 123-11-304 in 438 one-on-ones. A slider is a share of those fights; p is the percentile among 2,000 random six-Pokémon teams drawn from the field.

| Slider | ◀ | Value | ▶ | Percentile |
|---|---|---|---|---|
| Pace | absorbs first | 50 | strikes first | p19 |
| Punch | chips | 38 | knocks out | p4 |
| Run / pass | special | 54 | physical | p41 |
| Build-up | hits now | 2 | builds first | p36 |
| Sustain | no healing | 5 | heals and resets | p70 |
| Disruption | straight-up | 0 | disruptive | p5 |
| Risk | safe | 12 | gambler | p10 |
| Script | adaptive | 60 | scripted | p94 |

| Player | W-D-L | Pace | Punch | Run / pass | Build-up | Sustain | Disruption | Risk | Script |
|---|---|---|---|---|---|---|---|---|---|
| Pikachu | 2-2-69 | 45 (p32) | 22 (p12) | 67 (p42) | 0 (p41) | 0 (p38) | 0 (p35) | 44 (p77) | 34 (p10) |
| Dragonite | 21-5-47 | 41 (p23) | 41 (p34) | 100 (p74) | 0 (p41) | 11 (p86) | 0 (p35) | 16 (p45) | 84 (p95) |
| Infernape | 27-2-44 | 60 (p57) | 74 (p66) | 53 (p38) | 14 (p84) | 0 (p38) | 0 (p35) | 10 (p40) | 38 (p17) |
| Empoleon | 36-0-37 | 37 (p21) | 34 (p32) | 4 (p34) | 0 (p41) | 12 (p87) | 0 (p35) | 0 (p3) | 74 (p92) |
| Gengar | 12-0-61 | 56 (p51) | 34 (p32) | 0 (p16) | 0 (p41) | 0 (p38) | 0 (p35) | 1 (p20) | 62 (p86) |
| Scizor | 25-2-46 | 58 (p54) | 20 (p12) | 100 (p74) | 0 (p41) | 7 (p82) | 0 (p35) | 0 (p3) | 66 (p88) |

**Play sheet** (its most common call in each situation, against the field):

| Player | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|
| Pikachu | Volt Tackle (53%) | Volt Tackle (53%) | Thunderbolt (42%) | Thunderbolt (66%) | Volt Tackle (53%) | Volt Tackle (55%) | Thunderbolt (56%) |
| Dragonite | Dragon Claw (95%) | Dragon Claw (95%) | Dragon Claw (86%) | Dragon Claw (56%) | Dragon Claw (93%) | Dragon Claw (96%) | Dragon Claw (55%) |
| Infernape | Overheat (45%) | Overheat (53%) | Overheat (48%) | Close Combat (55%) | Overheat (60%) | Overheat (53%) | Close Combat (45%) |
| Empoleon | Surf (84%) | Surf (84%) | Surf (84%) | Surf (66%) | Surf (78%) | Surf (84%) | Surf (51%) |
| Gengar | Shadow Ball (74%) | Shadow Ball (74%) | Shadow Ball (74%) | Shadow Ball (74%) | Shadow Ball (74%) | Shadow Ball (74%) | Shadow Ball (74%) |
| Scizor | U-turn (77%) | U-turn (77%) | U-turn (74%) | U-turn (58%) | U-turn (93%) | U-turn (77%) | U-turn (77%) |

*Assumed where nothing is on record: EVs 85 in every stat; IVs 31; ability Swarm (could be Technician); level 100 (the peak); neutral nature.*

- **What we're trying to do:** Outlast them: Dragonite, Empoleon and Scizor stay in and make the other side run out first. The anchor: Empoleon.
- **What we're good at:** 13 attack types in the repertoire. The main ones: Steel (Empoleon, Pikachu and Scizor), Normal (Dragonite and Pikachu), Fire (Infernape) and Water (Empoleon). Nothing is safe: 17 of 17 types take super-effective hits from this club. Gengar sets the pace; Empoleon expects to take the first hit. Closers: Pikachu, Dragonite, Empoleon and Scizor.
- **Where we're soft:** Shared holes: Ground (Pikachu, Infernape and Empoleon).

| Attack type | Who throws it |
|---|---|
| Steel | Pikachu (Iron Tail), Empoleon (Flash Cannon), Scizor (Bullet Punch) |
| Normal | Pikachu (Quick Attack), Dragonite (Extreme Speed) |
| Fire | Infernape (Overheat) |
| Water | Empoleon (Surf), Empoleon (Aqua Jet) |
| Electric | Pikachu (Volt Tackle), Pikachu (Thunderbolt) |
| Fighting | Infernape (Close Combat) |
| Ground | Infernape (Earthquake) |
| Flying | Dragonite (Fly) |
| Psychic | Gengar (Psychic) |
| Bug | Scizor (U-turn) |
| Ghost | Gengar (Shadow Ball) |
| Dragon | Dragonite (Dragon Claw) |
| Dark | Gengar (Dark Pulse) |

## Depth chart

| Player | Philosophy | 1v1 vs the league | Build |
|---|---|---|---|
| **Empoleon** | Win the long game: take the hit, heal with Aqua Ring, and make the other side break first. | 54-8 | historical (former six) |
| **Dragonite** | Win the long game: take the hit, heal with Roost, and make the other side break first. | 53-9 | historical (former six) |
| **Scizor** | Keep the matchups moving: hit with U-turn and hand the turn to the right teammate. | 48-14 | historical (former six) |
| **Infernape** | Leave nowhere to hide: it has a super-effective answer for 10 of 17 types. | 44-18 | no build on record: the engine filled in its strongest set |
| **Gengar** | Strike first and strike hard. | 43-19 | historical (former six) |
| **Pikachu** | Finish what the others start: Quick Attack cleans up after the damage is done. | 16-46 | historical (former six) |

## Scouting reports

### Pikachu (Electric), SoulSilver
*Volt Tackle / Quick Attack / Thunderbolt / Iron Tail · Static · build: historical (former six)*

- **Philosophy:** Finish what the others start: Quick Attack cleans up after the damage is done.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Hits from both sides (Volt Tackle, Quick Attack and Iron Tail physical, Thunderbolt special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Volt Tackle. A light hitter: its best attacking stat sits in the bottom quarter of its generation. Glass on one side: it can't afford to take many hits there. Pays for its power: Volt Tackle costs it HP. Can miss when it matters: Iron Tail (75%). Plays without its Light Ball. With it, it's a different player.
- **When it's ahead:** Ahead, it keeps throwing Volt Tackle. With the other side low, Quick Attack closes the door before they can answer.
- **When it's behind:** Behind, it has no way back. Get it out before it's caught low. Even low, Quick Attack gets one more hit in first.
- **Against types:** Feeds on Flying and Water. Look out for Ground (×2).
- **Against moves:** Static: touching it can paralyze you.
- **How you beat it:** Hit it with something it can't hit back: Garchomp, Dugtrio, Flygon and Gliscor are the classic answers.
- **Production:** Struggled against the league (16-46). Pick its spots.
- **Makeup:** Plays like Delibird, Plusle and Luvdisc. Pokédex, SoulSilver: “It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.”

### Dragonite (Dragon/Flying), SoulSilver
*Fly / Roost / Extreme Speed / Dragon Claw · Inner Focus · build: historical (former six)*

- **Philosophy:** Win the long game: take the hit, heal with Roost, and make the other side break first.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Every attack runs off its Attack stat. Out pitch: Fly. Raw power near the top of its generation. Hard to move from either side: top-quarter bulk against physical and special hits. Telegraphs: Fly takes a turn to land.
- **When it's ahead:** Ahead, it keeps throwing Fly. With the other side low, Extreme Speed closes the door before they can answer.
- **When it's behind:** Behind, it heals with Roost. Even low, Extreme Speed gets one more hit in first.
- **Against types:** Feeds on Bug, Dragon, Fighting and Grass. Struggles to hurt Steel. One fatal hole: Ice hits it four times as hard. Look out for Ice (×4), Rock (×2) and Dragon (×2). A free switch-in against Ground.
- **Against moves:** Inner Focus: it never flinches.
- **How you beat it:** Hit it with something it can't hit back: Weavile, Jynx, Mamoswine and Glaceon are the classic answers.
- **Production:** Won 53 of 62 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Salamence, Garchomp and Tyranitar. Pokédex, SoulSilver: “This marine Pokémon has an impressive build that lets it freely fly over raging seas without trouble.”

### Infernape (Fire/Fighting), SoulSilver
*Overheat / Earthquake / Close Combat / Swords Dance · Blaze · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Leave nowhere to hide: it has a super-effective answer for 10 of 17 types.
- **Tendencies:** Usually swings first: 89% of its generation is slower. Hits from both sides (Earthquake and Close Combat physical, Overheat special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Overheat.
- **When it's ahead:** Ahead, it takes the free turn for Swords Dance.
- **When it's behind:** Behind, it swings for the KO and hopes it lands first. Low on HP, Blaze kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Bug, Dark, Electric, Fire, Grass, Ice, Normal, Poison, Rock and Steel. Look out for Water (×2), Ground (×2), Flying (×2) and Psychic (×2).
- **How you beat it:** Hit it with something it can't hit back: Alakazam, Espeon, Aerodactyl and Salamence are the classic answers.
- **Production:** Won 44 of 62 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Lucario, Arcanine and Charizard. Pokédex, SoulSilver: “It tosses its enemies around with agility. It uses all its limbs to fight in its own unique style.”

### Empoleon (Water/Steel), SoulSilver
*Surf / Flash Cannon / Aqua Jet / Aqua Ring · Torrent · build: historical (former six)*

- **Philosophy:** Win the long game: take the hit, heal with Aqua Ring, and make the other side break first.
- **Tendencies:** Expects to take the first hit: only 26% of its generation is slower. Hits from both sides (Aqua Jet physical, Surf and Flash Cannon special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Surf.
- **When it's ahead:** Ahead, it keeps throwing Surf. With the other side low, Aqua Jet closes the door before they can answer.
- **When it's behind:** Behind, it heals with Aqua Ring. Even low, Aqua Jet gets one more hit in first. Low on HP, Torrent kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Fire, Ground, Ice and Rock. Struggles to hurt Water. Look out for Electric (×2), Fighting (×2) and Ground (×2). A free switch-in against Poison.
- **Against moves:** Toxic and poison do nothing to it.
- **How you beat it:** Hit it with something it can't hit back: Jolteon, Garchomp, Electrode and Electivire are the classic answers.
- **Production:** Won 54 of 62 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Politoed, Heatran and Walrein. Pokédex, SoulSilver: “It avoids unnecessary disputes, but it will decimate anything that threatens its pride.”

### Gengar (Ghost/Poison), SoulSilver
*Shadow Ball / Disable / Dark Pulse / Psychic · Levitate · build: historical (former six)*

- **Philosophy:** Strike first and strike hard.
- **Tendencies:** Usually swings first: 89% of its generation is slower. Every attack runs off its Sp. Atk. Out pitch: Shadow Ball. Raw power near the top of its generation. Glass on one side: it can't afford to take many hits there.
- **When it's ahead:** Ahead, it keeps throwing Shadow Ball.
- **When it's behind:** Behind, it has no way back. Get it out before it's caught low.
- **Against types:** Feeds on Fighting, Ghost, Poison and Psychic. Struggles to hurt Dark and Steel. Look out for Psychic (×2), Ghost (×2) and Dark (×2). A free switch-in against Normal, Fighting and Ground.
- **Against moves:** Levitate: Ground moves miss it entirely. Toxic and poison do nothing to it.
- **How you beat it:** Hit it with something it can't hit back: Weavile, Sharpedo, Houndoom and Absol are the classic answers.
- **Production:** Won 43 of 62 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Espeon, Roserade and Mismagius. Pokédex, SoulSilver: “To steal the life of its target, it slips into the prey’s shadow and silently waits for an opportunity.”

### Scizor (Bug/Steel), SoulSilver
*Bullet Punch / U-turn / Counter / Roost · Swarm · build: historical (former six)*

- **Philosophy:** Keep the matchups moving: hit with U-turn and hand the turn to the right teammate.
- **Tendencies:** Expects to take the first hit: only 31% of its generation is slower. Every attack runs off its Attack stat. Out pitch: U-turn. Raw power near the top of its generation.
- **When it's ahead:** Ahead, it keeps throwing U-turn. With the other side low, Bullet Punch closes the door before they can answer.
- **When it's behind:** Behind, it heals with Roost. Even low, Bullet Punch gets one more hit in first. Low on HP, Swarm kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Dark, Grass, Ice, Psychic and Rock. Struggles to hurt Fire and Steel. One fatal hole: Fire hits it four times as hard. Look out for Fire (×4). A free switch-in against Poison.
- **Against moves:** Toxic and poison do nothing to it.
- **How you beat it:** Hit it with something it can't hit back: Infernape, Charizard, Typhlosion and Magmortar are the classic answers.
- **Production:** Won 48 of 62 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Pinsir, Armaldo and Heracross. Pokédex, SoulSilver: “Its wings are not used for flying. They are flapped at high speed to adjust its body temperature.”

## Call sheets

### Call sheet vs Will (Lv 42, pret/pokeheartgold files/poketool/trainer/trainers.json #245)

- **Order:** Xatu (Lv 40), Jynx (Lv 41), Exeggutor (Lv 41), Slowbro (Lv 41), Xatu (Lv 42). Lead with Gengar: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Jynx, which beats 1 of your 6. Your last one standing: Dragonite.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “We Psychics don’t give up even when we’re down to the last Pokémon. That’s what makes us so formidable!” Last Pokémon at half HP: “Until we hit zero, our power is limitless. I’m not giving up yet!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Xatu L40 | U-turn · Me First · Confuse Ray · Psychic | Gengar: Shadow Ball 121.1-143.9% | Dragonite: Fly 69.3-82.5% | — |
| Jynx L41 | Double Slap · Lovely Kiss · Ice Punch · Psychic | Infernape: Overheat 134.5-160.3% | Empoleon: Flash Cannon 82.8-98.3% | — |
| Exeggutor L41 | Reflect · Hypnosis · Egg Bomb · Psychic | Gengar: Shadow Ball 102.1-120.6% | Scizor: U-turn 144.7-173% | — |
| Slowbro L41 | Curse · Amnesia · Water Pulse · Psychic | Scizor: U-turn 59.6-72.3% | Empoleon: Surf 23.4-27.7% | — |
| Xatu L42 | Aerial Ace · Ominous Wind · Confuse Ray · Psychic @ Sitrus Berry | Gengar: Shadow Ball 112.6-132.8% | Empoleon: Surf 58.8-70.6% | — |

**Xatu L40**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Empoleon and Scizor. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor). Hits from both sides (U-turn physical, Psychic special): no single wall stops it.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark, Electric and Ghost. The call: Gengar: Shadow Ball 121.1-143.9%. Backup: Dragonite: Fly 69.3-82.5%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Jynx L41**

- **Tendencies:** Moves first against Dragonite, Empoleon and Scizor. Its go-to: Psychic (its best hit on Pikachu, Infernape, Empoleon, Gengar and Scizor). Otherwise: Ice Punch against Dragonite. Hits from both sides (Ice Punch physical, Psychic special): no single wall stops it.
- **When it's ahead:** Expect Lovely Kiss early.
- **How to attack it:** Hit it with Bug, Dark, Fire, Ghost and Steel. The call: Infernape: Overheat 134.5-160.3%. Backup: Empoleon: Flash Cannon 82.8-98.3%. Its blind spot: Empoleon and Scizor take almost nothing from it.

**Exeggutor L41**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor). Hits from both sides (Egg Bomb physical, Psychic special): no single wall stops it.
- **When it's ahead:** Expect Hypnosis early.
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Bug, Dark, Fire, Flying and Ghost. The call: Gengar: Shadow Ball 102.1-120.6%. Backup: Scizor: U-turn 144.7-173%. Its blind spot: Empoleon and Scizor take almost nothing from it.

**Slowbro L41**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon and Gengar). Otherwise: Water Pulse against Scizor.
- **When it's ahead:** Given a free turn, it sets up with Curse or Amnesia.
- **How to attack it:** Hit it with Bug, Dark, Electric and Ghost. The call: Scizor: U-turn 59.6-72.3%. Backup: Empoleon: Surf 23.4-27.7%. Its blind spot: Empoleon and Scizor take almost nothing from it.

**Xatu L42**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Dragonite, Empoleon and Scizor. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon and Gengar). Otherwise: Aerial Ace against Scizor. Hits from both sides (Aerial Ace physical, Ominous Wind and Psychic special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark, Electric and Ghost. The call: Gengar: Shadow Ball 112.6-132.8%. Backup: Empoleon: Surf 58.8-70.6%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Xatu | Gengar (W) | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic |
| Jynx | Infernape (W) | Close Combat / Psychic | Close Combat / Psychic | Close Combat / Psychic | Close Combat / Psychic | Close Combat / Psychic | Close Combat / Psychic | Close Combat / Psychic |
| Exeggutor | Gengar (W) | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic |
| Slowbro | Scizor (W) | U-turn / Water Pulse | U-turn / Water Pulse | U-turn / Water Pulse | U-turn / Water Pulse | U-turn / Water Pulse | U-turn / Water Pulse | U-turn / Water Pulse |
| Xatu | Gengar (W) | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic |

### Call sheet vs Koga (Lv 44, pret/pokeheartgold files/poketool/trainer/trainers.json #247)

- **Order:** Ariados (Lv 40), Venomoth (Lv 41), Forretress (Lv 43), Muk (Lv 42), Crobat (Lv 44). Lead with Gengar: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Crobat, which beats 2 of your 6. Your last one standing: Dragonite.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “One Pokémon left? Ha ha ha! I’ve been counting on this one from the very beginning!” Last Pokémon at half HP: “Ooooof...”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Ariados L40 | Poison Jab · Spider Web · Baton Pass · Giga Drain | Gengar: Psychic 108.5-128.8% | Scizor: Bullet Punch 33.1-39% | — |
| Venomoth L41 | Supersonic · Gust · Psychic · Toxic | Empoleon: Surf 62.5-73.3% | Scizor: Bullet Punch 35-42.5% | — |
| Forretress L43 | Protect · Swift · Explosion · Toxic Spikes | Empoleon: Surf 64.6-76.9% | Gengar: Shadow Ball 30.8-36.9% | Pikachu |
| Muk L42 | Minimize · Screech · Gunk Shot · Toxic @ Black Sludge | Gengar: Psychic 55.3-65.8% | Infernape: Earthquake 64.5-76.3% | Pikachu |
| Crobat L44 | Double Team · Quick Attack · Wing Attack · Poison Fang @ Sitrus Berry | Empoleon: Surf 47.2-55.6% | Dragonite: Fly 51.4-61.3% | — |

**Ariados L40**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Poison Jab (its best hit on Pikachu, Dragonite, Infernape and Gengar). Otherwise: Giga Drain against Empoleon and Scizor. Hits from both sides (Poison Jab physical, Giga Drain special): no single wall stops it.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire, Flying and Psychic. The call: Gengar: Psychic 108.5-128.8%. Backup: Scizor: Bullet Punch 33.1-39%. Its blind spot: Dragonite, Empoleon, Gengar and Scizor take almost nothing from it.

**Venomoth L41**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor).
- **When it's ahead:** Expect Toxic early.
- **How to attack it:** Hit it with Fire, Flying and Psychic. The call: Empoleon: Surf 62.5-73.3%. Backup: Scizor: Bullet Punch 35-42.5%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Forretress L43**

- **Tendencies:** You move first, every time. Its go-to: Explosion (its best hit on Pikachu, Dragonite, Infernape, Empoleon and Scizor). Hits from both sides (Explosion physical, Swift special): no single wall stops it.
- **When it's behind:** Cornered, it can take one of yours down with it (Explosion).
- **Against moves:** Sturdy: one-hit KO moves fail. Stalls with Protect.
- **How to attack it:** Hit it with Fire. The call: Empoleon: Surf 64.6-76.9%. Backup: Gengar: Shadow Ball 30.8-36.9%. Keep Pikachu and Infernape away from it: one hit and they're gone. Its blind spot: Gengar takes almost nothing from it.

**Muk L42**

- **Tendencies:** You move first, every time. Its go-to: Gunk Shot (its best hit on Pikachu, Dragonite, Infernape and Gengar). Holds Black Sludge: it heals a little every turn.
- **When it's ahead:** Expect Toxic early.
- **How to attack it:** Hit it with Ground and Psychic. The call: Gengar: Psychic 55.3-65.8%. Backup: Infernape: Earthquake 64.5-76.3%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Empoleon, Gengar and Scizor take almost nothing from it.

**Crobat L44**

- **Order:** Last in the order.
- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Wing Attack (its best hit on Dragonite, Infernape, Empoleon, Gengar and Scizor). Otherwise: Poison Fang against Pikachu. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Electric and Psychic. The call: Empoleon: Surf 47.2-55.6%. Backup: Dragonite: Fly 51.4-61.3%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Ariados | Gengar (W) | Psychic / Poison Jab | Psychic / Poison Jab | Psychic / Poison Jab | Psychic / Poison Jab | Psychic / Poison Jab | Psychic / Poison Jab | Psychic / Poison Jab |
| Venomoth | Empoleon (W) | Surf / Psychic | Surf / Psychic | Surf / Psychic | Aqua Jet / Psychic | Surf / Psychic | Surf / Psychic | Aqua Jet / Psychic |
| Forretress | Empoleon (W) | Surf / Protect | Surf / Protect | Surf / Explosion | Surf / Explosion | Surf / Protect | Surf / Protect | Surf / Explosion |
| Muk | Gengar (W) | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot |
| Crobat | Empoleon (W) | Surf / Wing Attack | Surf / Wing Attack | Surf / Wing Attack | Surf / Wing Attack | Surf / Wing Attack | Surf / Wing Attack | Surf / Wing Attack |

### Call sheet vs Bruno (Lv 46, pret/pokeheartgold files/poketool/trainer/trainers.json #418)

- **Order:** Hitmontop (Lv 42), Hitmonlee (Lv 42), Hitmonchan (Lv 42), Onix (Lv 43), Machamp (Lv 46). Lead with Gengar: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Hitmonlee, which beats 2 of your 6. Your last one standing: Dragonite.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “Fight as hard as you can ’til you faint!” Last Pokémon at half HP: “We’re standing firm!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Hitmontop L42 | Counter · Quick Attack · Dig · Triple Kick | Gengar: Psychic 79.2-94.3% | Empoleon: Surf 54.7-66% | — |
| Hitmonlee L42 | Swagger · Focus Energy · High Jump Kick · Blaze Kick | Infernape: Close Combat 117-138.7% | Gengar: Psychic 79.2-94.3% | Pikachu |
| Hitmonchan L42 | Thunder Punch · Ice Punch · Fire Punch · Bullet Punch | Infernape: Close Combat 87.7-102.8% | Gengar: Psychic 79.2-94.3% | — |
| Onix L43 | Dragon Breath · Earthquake · Sandstorm · Rock Slide | Infernape: Close Combat 106.3-125% | Empoleon: Surf 475-562.5% | — |
| Machamp L46 | Rock Slide · Foresight · Revenge · Cross Chop @ Sitrus Berry | Dragonite: Fly 100-119.7% | Infernape: Overheat 61.2-71.7% | Pikachu |

**Hitmontop L42**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Dragonite. Its go-to: Dig (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Quick Attack against Dragonite.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Flying and Psychic. The call: Gengar: Psychic 79.2-94.3%. Backup: Empoleon: Surf 54.7-66%. Its blind spot: Dragonite, Gengar and Scizor take almost nothing from it.

**Hitmonlee L42**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: High Jump Kick (its best hit on Pikachu, Dragonite, Infernape and Empoleon). Otherwise: Blaze Kick against Gengar and Scizor.
- **Against moves:** Limber: it can't be paralyzed.
- **How to attack it:** Hit it with Flying and Psychic. The call: Infernape: Close Combat 117-138.7%. Backup: Gengar: Psychic 79.2-94.3%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Dragonite takes almost nothing from it.

**Hitmonchan L42**

- **Tendencies:** You move first, every time. Its go-to: Thunder Punch (its best hit on Infernape, Empoleon and Gengar). Otherwise: Ice Punch against Pikachu and Dragonite; Fire Punch against Scizor.
- **When it's ahead:** Once you're low, Bullet Punch finishes you.
- **Against moves:** Keen Eye: its accuracy can't be lowered.
- **How to attack it:** Hit it with Flying and Psychic. The call: Infernape: Close Combat 87.7-102.8%. Backup: Gengar: Psychic 79.2-94.3%. Its blind spot: Infernape takes almost nothing from it.

**Onix L43**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Rock Slide against Dragonite and Gengar. Hits from both sides (Earthquake and Rock Slide physical, Dragon Breath special): no single wall stops it.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Fighting, Ground, Steel and Water. The call: Infernape: Close Combat 106.3-125%. Backup: Empoleon: Surf 475-562.5%. Its blind spot: Dragonite, Gengar and Scizor take almost nothing from it.

**Machamp L46**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Dragonite. Its go-to: Cross Chop (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Rock Slide against Dragonite and Gengar. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Guts: a status condition makes it hit harder.
- **How to attack it:** Hit it with Flying and Psychic. The call: Dragonite: Fly 100-119.7%. Backup: Infernape: Overheat 61.2-71.7%. Keep Pikachu away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Hitmontop | Gengar (W) | Psychic / Counter | Psychic / Counter | Psychic / Counter | Psychic / Counter | Psychic / Counter | Psychic / Counter | Psychic / Counter |
| Hitmonlee | Infernape (W) | Close Combat / High Jump Kick | Close Combat / High Jump Kick | Close Combat / High Jump Kick | Close Combat / High Jump Kick | Close Combat / High Jump Kick | Close Combat / High Jump Kick | Close Combat / High Jump Kick |
| Hitmonchan | Infernape (W) | Swords Dance / Thunder Punch | Close Combat / Thunder Punch | Close Combat / Thunder Punch | Close Combat / Thunder Punch | Overheat / Thunder Punch | Close Combat / Thunder Punch | Close Combat / Thunder Punch |
| Onix | Infernape (W) | Close Combat / Earthquake | Close Combat / Earthquake | Close Combat / Earthquake | Close Combat / Earthquake | Close Combat / Earthquake | Close Combat / Earthquake | Close Combat / Earthquake |
| Machamp | Dragonite (W) | Fly / Rock Slide | Fly / Rock Slide | Fly / Rock Slide | Fly / Rock Slide | Fly / Rock Slide | Fly / Rock Slide | Fly / Rock Slide |

### Call sheet vs Karen (Lv 47, pret/pokeheartgold files/poketool/trainer/trainers.json #246)

- **Order:** Umbreon (Lv 42), Vileplume (Lv 42), Gengar (Lv 45), Murkrow (Lv 44), Houndoom (Lv 47). Lead with Infernape: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Houndoom, which beats 3 of your 6. Your last one standing: Dragonite.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “This is far from being backed into a corner!” Last Pokémon at half HP: “You’re no ordinary Trainer to have gotten this far.”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Umbreon L42 | Double Team · Confuse Ray · Feint Attack · Payback | Infernape: Close Combat 100-118.1% | Scizor: U-turn 70.8-83.3% | — |
| Vileplume L42 | Stun Spore · Acid · Moonlight · Petal Dance | Scizor: U-turn 48-57.5% | Gengar: Psychic 80.3-94.5% | — |
| Gengar L45 | Lick · Spite · Focus Blast · Destiny Bond | Gengar: Shadow Ball 119.7-142.6% | Dragonite: Fly 82-96.7% | — |
| Murkrow L44 | Pluck · Whirlwind · Sucker Punch · Feint Attack | Pikachu: Volt Tackle 151.7-180% | Infernape: Overheat 138.3-163.3% | — |
| Houndoom L47 | Nasty Plot · Dark Pulse · Flamethrower · Crunch @ Sitrus Berry | Infernape: Close Combat 167.4-200% | Empoleon: Surf 97.9-116.3% | Scizor |

**Umbreon L42**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Payback (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor).
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Bug and Fighting. The call: Infernape: Close Combat 100-118.1%. Backup: Scizor: U-turn 70.8-83.3%. Its blind spot: Dragonite, Infernape, Empoleon and Scizor take almost nothing from it.

**Vileplume L42**

- **Tendencies:** You move first, every time. Its go-to: Petal Dance (its best hit on Pikachu, Infernape, Empoleon, Gengar and Scizor). Otherwise: Acid against Dragonite.
- **When it's ahead:** Expect Stun Spore early.
- **When it's behind:** When it's low, it heals itself with Moonlight.
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Fire, Flying and Psychic. The call: Scizor: U-turn 48-57.5%. Backup: Gengar: Psychic 80.3-94.5%. Its blind spot: Dragonite, Infernape, Empoleon, Gengar and Scizor take almost nothing from it.

**Gengar L45**

- **Tendencies:** Moves first against Pikachu, Dragonite and Empoleon. Its go-to: Focus Blast (its best hit on Pikachu, Dragonite, Infernape, Empoleon and Scizor). Otherwise: Lick against Gengar.
- **When it's behind:** Cornered, it can take one of yours down with it (Destiny Bond).
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark, Ghost and Psychic. The call: Gengar: Shadow Ball 119.7-142.6%. Backup: Dragonite: Fly 82-96.7%. Its blind spot: Dragonite and Gengar take almost nothing from it.

**Murkrow L44**

- **Tendencies:** Gets the jump on Scizor. Its go-to: Sucker Punch (its best hit on Pikachu, Dragonite, Empoleon and Gengar). Otherwise: Pluck against Infernape and Scizor.
- **When it's ahead:** Once you're low, Sucker Punch finishes you.
- **Against moves:** Insomnia: it can't be put to sleep. If you set up, it forces you out with Whirlwind.
- **How to attack it:** Hit it with Electric. The call: Pikachu: Volt Tackle 151.7-180%. Backup: Infernape: Overheat 138.3-163.3%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Houndoom L47**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Dragonite, Empoleon and Scizor. Its go-to: Flamethrower (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Dark Pulse against Dragonite and Gengar. Hits from both sides (Crunch physical, Dark Pulse and Flamethrower special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Nasty Plot.
- **How to attack it:** Hit it with Fighting, Ground and Water. The call: Infernape: Close Combat 167.4-200%. Backup: Empoleon: Surf 97.9-116.3%. Keep Scizor away from it: one hit and they're gone. Its blind spot: Infernape takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Umbreon | Infernape (W) | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback |
| Vileplume | Scizor (W) | U-turn / Petal Dance | U-turn / Petal Dance | U-turn / Petal Dance | U-turn / Petal Dance | U-turn / Moonlight | U-turn / Petal Dance | U-turn / Moonlight |
| Gengar | Gengar (W) | Shadow Ball / Lick | Shadow Ball / Lick | Shadow Ball / Lick | Shadow Ball / Lick | Shadow Ball / Lick | Shadow Ball / Lick | Shadow Ball / Lick |
| Murkrow | Pikachu (W) | Thunderbolt / Whirlwind | Thunderbolt / Whirlwind | Thunderbolt / Sucker Punch | Thunderbolt / Sucker Punch | Thunderbolt / Whirlwind | Thunderbolt / Whirlwind | Thunderbolt / Sucker Punch |
| Houndoom | Infernape (W) | Close Combat / Flamethrower | Close Combat / Flamethrower | Close Combat / Flamethrower | Close Combat / Flamethrower | Close Combat / Flamethrower | Close Combat / Flamethrower | Close Combat / Flamethrower |

### Call sheet vs Champion Lance (Lv 50, pret/pokeheartgold files/poketool/trainer/trainers.json #244)

- **Order:** Gyarados (Lv 46), Dragonite (Lv 49), Dragonite (Lv 49), Aerodactyl (Lv 48), Charizard (Lv 48), Dragonite (Lv 50). Lead with Pikachu: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Dragonite, which beats 4 of your 6. Your last one standing: Dragonite.
- **The bag:** 4 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “All right! I thought this would never happen!” Last Pokémon at half HP: “I never give up, no matter what. You must be the same?”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Gyarados L46 | Flail · Dragon Pulse · Waterfall · Ice Fang | Pikachu: Volt Tackle 163.1-193.6% | Empoleon: Surf 21.7-26.1% | — |
| Dragonite L49 | Thunder Wave · Dragon Rush · Thunder · Hyper Beam | Scizor: Bullet Punch 20.4-24.7% | Dragonite: Dragon Claw 82.7-97.5% | Pikachu |
| Dragonite L49 | Thunder Wave · Dragon Rush · Blizzard · Hyper Beam | Empoleon: Flash Cannon 34-40.7% | Scizor: Bullet Punch 20.4-24.7% | Pikachu |
| Aerodactyl L48 | Aerial Ace · Crunch · Rock Slide · Thunder Fang | Scizor: Bullet Punch 60.4-72.5% | Empoleon: Surf 112.8-134.2% | — |
| Charizard L48 | Shadow Claw · Air Slash · Dragon Claw · Fire Fang | Empoleon: Surf 103.4-122.4% | Pikachu: Volt Tackle 85.7-102% | — |
| Dragonite L50 | Fire Blast · Safeguard · Outrage · Hyper Beam @ Sitrus Berry | Empoleon: Flash Cannon 32.5-38.6% | Dragonite: Dragon Claw 79.5-94% | Scizor, Pikachu |

**Gyarados L46**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Empoleon. Its go-to: Waterfall (its best hit on Pikachu, Infernape, Empoleon, Gengar and Scizor). Otherwise: Ice Fang against Dragonite. Hits from both sides (Waterfall and Ice Fang physical, Dragon Pulse special): no single wall stops it.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric. The call: Pikachu: Volt Tackle 163.1-193.6%. Backup: Empoleon: Surf 21.7-26.1%. Its blind spot: Empoleon takes almost nothing from it.

**Dragonite L49**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Dragon Rush (its best hit on Pikachu, Dragonite, Infernape and Gengar). Otherwise: Thunder against Empoleon and Scizor. Hits from both sides (Dragon Rush physical, Thunder and Hyper Beam special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Dragon. The call: Scizor: Bullet Punch 20.4-24.7%. Backup: Dragonite: Dragon Claw 82.7-97.5%. Keep Pikachu away from it: one hit and they're gone.

**Dragonite L49**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Dragon Rush (its best hit on Pikachu, Infernape, Empoleon, Gengar and Scizor). Otherwise: Blizzard against Dragonite. Hits from both sides (Dragon Rush physical, Blizzard and Hyper Beam special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Dragon. The call: Empoleon: Flash Cannon 34-40.7%. Backup: Scizor: Bullet Punch 20.4-24.7%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Empoleon and Scizor take almost nothing from it.

**Aerodactyl L48**

- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Rock Slide (its best hit on Pikachu, Dragonite and Scizor). Otherwise: Aerial Ace against Infernape; Thunder Fang against Empoleon; Crunch against Gengar.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Electric, Steel and Water. The call: Scizor: Bullet Punch 60.4-72.5%. Backup: Empoleon: Surf 112.8-134.2%. Its blind spot: Scizor takes almost nothing from it.

**Charizard L48**

- **Tendencies:** Gets the jump on Dragonite and Empoleon. Its go-to: Fire Fang (its best hit on Pikachu, Empoleon and Scizor). Otherwise: Dragon Claw against Dragonite; Air Slash against Infernape; Shadow Claw against Gengar. Hits from both sides (Shadow Claw, Dragon Claw and Fire Fang physical, Air Slash special): no single wall stops it.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Electric and Water. The call: Empoleon: Surf 103.4-122.4%. Backup: Pikachu: Volt Tackle 85.7-102%. Its blind spot: Empoleon takes almost nothing from it.

**Dragonite L50**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Empoleon. Its go-to: Outrage (its best hit on Pikachu, Dragonite, Infernape, Empoleon and Gengar). Otherwise: Fire Blast against Scizor. Hits from both sides (Outrage physical, Fire Blast and Hyper Beam special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Dragon. The call: Empoleon: Flash Cannon 32.5-38.6%. Backup: Dragonite: Dragon Claw 79.5-94%. Keep Pikachu and Scizor away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Gyarados | Pikachu (W) | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall |
| Dragonite | Scizor (W) | Bullet Punch / Thunder | Bullet Punch / Thunder | Bullet Punch / Thunder | Bullet Punch / Thunder | Roost / Thunder | Bullet Punch / Thunder | U-turn / Thunder |
| Dragonite | Empoleon (W) | Flash Cannon / Dragon Rush | Flash Cannon / Dragon Rush | Flash Cannon / Dragon Rush | Flash Cannon / Dragon Rush | Flash Cannon / Dragon Rush | Flash Cannon / Dragon Rush | Flash Cannon / Dragon Rush |
| Aerodactyl | Scizor (W) | Bullet Punch / Rock Slide | Bullet Punch / Rock Slide | Bullet Punch / Rock Slide | Bullet Punch / Rock Slide | Bullet Punch / Rock Slide | Bullet Punch / Rock Slide | Bullet Punch / Rock Slide |
| Charizard | Empoleon (W) | Surf / Fire Fang | Surf / Fire Fang | Surf / Fire Fang | Aqua Jet / Fire Fang | Surf / Fire Fang | Surf / Fire Fang | Aqua Jet / Fire Fang |
| Dragonite | Empoleon (W) | Flash Cannon / Outrage | Flash Cannon / Outrage | Flash Cannon / Outrage | Flash Cannon / Outrage | Aqua Ring / Outrage | Flash Cannon / Outrage | Flash Cannon / Outrage |

### Call sheet vs Red (Lv 88, pret/pokeheartgold files/poketool/trainer/trainers.json #260)

- **Order:** Pikachu (Lv 88), Lapras (Lv 80), Snorlax (Lv 82), Venusaur (Lv 84), Charizard (Lv 84), Blastoise (Lv 84). Lead with Dragonite: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Snorlax, which beats 3 of your 6. Your last one standing: Infernape.
- **The bag:** 4 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Pikachu L88 | Volt Tackle · Iron Tail · Quick Attack · Thunderbolt @ Light Ball | Dragonite: Dragon Claw 138.7-163.4% | Infernape: Earthquake 188.2-222.6% | — |
| Lapras L80 | Blizzard · Brine · Psychic · Body Slam | Infernape: Close Combat 105-123.6% | Empoleon: Flash Cannon 31.7-37.9% | Dragonite |
| Snorlax L82 | Shadow Ball · Crunch · Blizzard · Giga Impact | Infernape: Close Combat 102.9-121.9% | Scizor: U-turn 35.9-42.7% | Pikachu |
| Venusaur L84 | Sludge Bomb · Giga Drain · Sleep Powder · Frenzy Plant | Scizor: U-turn 43.1-51.4% | Gengar: Psychic 63.2-75.1% | Pikachu |
| Charizard L84 | Flare Blitz · Air Slash · Blast Burn · Dragon Pulse | Empoleon: Surf 101.6-120.8% | Gengar: Shadow Ball 49.2-58% | Pikachu, Scizor |
| Blastoise L84 | Focus Blast · Hydro Cannon · Blizzard · Flash Cannon | Scizor: U-turn 37.1-44.2% | Gengar: Shadow Ball 41-49% | — |

**Pikachu L88**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Empoleon and Scizor. Its go-to: Volt Tackle (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor). Hits from both sides (Volt Tackle, Iron Tail and Quick Attack physical, Thunderbolt special): no single wall stops it. Holds Light Ball: its attacks hit twice as hard.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Static: touching it can paralyze you.
- **How to attack it:** Hit it with Ground. The call: Dragonite: Dragon Claw 138.7-163.4%. Backup: Infernape: Earthquake 188.2-222.6%.

**Lapras L80**

- **Tendencies:** You move first, every time. Its go-to: Brine (its best hit on Infernape, Empoleon and Scizor). Otherwise: Blizzard against Pikachu and Dragonite; Psychic against Gengar. Hits from both sides (Body Slam physical, Blizzard, Brine and Psychic special): no single wall stops it.
- **Against moves:** Water Absorb: Water moves heal it instead.
- **How to attack it:** Hit it with Electric and Fighting. The call: Infernape: Close Combat 105-123.6%. Backup: Empoleon: Flash Cannon 31.7-37.9%. Keep Dragonite away from it: one hit and they're gone. Its blind spot: Empoleon and Scizor take almost nothing from it.

**Snorlax L82**

- **Tendencies:** You move first, every time. Its go-to: Giga Impact (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Blizzard against Dragonite; Crunch against Gengar. Hits from both sides (Crunch and Giga Impact physical, Shadow Ball and Blizzard special): no single wall stops it.
- **Against moves:** Immunity: it can't be poisoned.
- **How to attack it:** Hit it with Fighting. The call: Infernape: Close Combat 102.9-121.9%. Backup: Scizor: U-turn 35.9-42.7%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Empoleon and Scizor take almost nothing from it.

**Venusaur L84**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Frenzy Plant (its best hit on Pikachu, Empoleon, Gengar and Scizor). Otherwise: Sludge Bomb against Dragonite and Infernape.
- **When it's ahead:** Expect Sleep Powder early.
- **Against moves:** Overgrow: Grass moves hit harder when it's low.
- **How to attack it:** Hit it with Fire, Flying and Psychic. The call: Scizor: U-turn 43.1-51.4%. Backup: Gengar: Psychic 63.2-75.1%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Dragonite and Scizor take almost nothing from it.

**Charizard L84**

- **Tendencies:** Gets the jump on Dragonite and Empoleon. Its go-to: Blast Burn (its best hit on Pikachu, Empoleon, Gengar and Scizor). Otherwise: Dragon Pulse against Dragonite; Air Slash against Infernape. Hits from both sides (Flare Blitz physical, Air Slash, Blast Burn and Dragon Pulse special): no single wall stops it.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Electric and Water. The call: Empoleon: Surf 101.6-120.8%. Backup: Gengar: Shadow Ball 49.2-58%. Keep Pikachu and Scizor away from it: one hit and they're gone.

**Blastoise L84**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Empoleon. Its go-to: Hydro Cannon (its best hit on Pikachu, Infernape, Gengar and Scizor). Otherwise: Blizzard against Dragonite; Focus Blast against Empoleon.
- **Against moves:** Torrent: Water moves hit harder when it's low.
- **How to attack it:** Hit it with Electric. The call: Scizor: U-turn 37.1-44.2%. Backup: Gengar: Shadow Ball 41-49%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Pikachu | Dragonite (W) | Dragon Claw / Volt Tackle | Dragon Claw / Volt Tackle | Dragon Claw / Volt Tackle | Dragon Claw / Thunderbolt | Dragon Claw / Volt Tackle | Dragon Claw / Volt Tackle | Dragon Claw / Thunderbolt |
| Lapras | Infernape (W) | Close Combat / Brine | Close Combat / Brine | Close Combat / Brine | Close Combat / Brine | Close Combat / Brine | Close Combat / Brine | Close Combat / Brine |
| Snorlax | Infernape (W) | Close Combat / Giga Impact | Close Combat / Giga Impact | Close Combat / Giga Impact | Close Combat / Giga Impact | Close Combat / Giga Impact | Close Combat / Giga Impact | Close Combat / Giga Impact |
| Venusaur | Scizor (W) | U-turn / Frenzy Plant | U-turn / Frenzy Plant | U-turn / Frenzy Plant | U-turn / Frenzy Plant | U-turn / Frenzy Plant | U-turn / Frenzy Plant | U-turn / Frenzy Plant |
| Charizard | Empoleon (W) | Surf / Blast Burn | Surf / Blast Burn | Surf / Blast Burn | Aqua Jet / Flare Blitz | Surf / Blast Burn | Surf / Blast Burn | Aqua Jet / Flare Blitz |
| Blastoise | Scizor (W) | U-turn / Hydro Cannon | U-turn / Hydro Cannon | U-turn / Hydro Cannon | U-turn / Hydro Cannon | U-turn / Hydro Cannon | U-turn / Hydro Cannon | U-turn / Hydro Cannon |

### Call sheet vs Will (rematch) (Lv 62, pret/pokeheartgold files/poketool/trainer/trainers.json #702)

- **Order:** Bronzong (Lv 58), Jynx (Lv 60), Grumpig (Lv 59), Slowbro (Lv 60), Gardevoir (Lv 61), Xatu (Lv 62). Lead with Empoleon: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Gardevoir, which beats 3 of your 6. Your last one standing: Scizor.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “We Psychics don’t give up even when we’re down to the last Pokémon. That’s what makes us so formidable!” Last Pokémon at half HP: “Until we hit zero, our power is limitless. I’m not giving up yet!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Bronzong L58 | Reflect · Payback · Gravity · Psychic | Empoleon: Surf 44.2-52.1% | Scizor: U-turn 36.8-44.2% | — |
| Jynx L60 | Fake Tears · Lovely Kiss · Blizzard · Dream Eater | Infernape: Overheat 137.3-162.7% | Empoleon: Flash Cannon 80.7-97.6% | Pikachu, Dragonite |
| Grumpig L59 | Confuse Ray · Signal Beam · Power Gem · Psychic | Scizor: U-turn 102.8-122.7% | Dragonite: Fly 68-80.1% | — |
| Slowbro L60 | Curse · Amnesia · Body Slam · Psychic | Scizor: U-turn 59.4-71.3% | Dragonite: Fly 39.1-46.5% | — |
| Gardevoir L61 | Focus Blast · Charge Beam · Calm Mind · Psychic | Dragonite: Fly 69.8-82.6% | Scizor: U-turn 105.8-125.6% | — |
| Xatu L62 | Quick Attack · Shadow Ball · Confuse Ray · Psychic @ Sitrus Berry | Gengar: Shadow Ball 112.3-133.3% | Empoleon: Surf 59.6-70.2% | — |

**Bronzong L58**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor). Hits from both sides (Payback physical, Psychic special): no single wall stops it.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Fire. The call: Empoleon: Surf 44.2-52.1%. Backup: Scizor: U-turn 36.8-44.2%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Jynx L60**

- **Tendencies:** Moves first against Dragonite, Empoleon and Scizor. Its go-to: Blizzard (its best hit on Pikachu, Dragonite and Scizor). Otherwise: Dream Eater against Infernape, Empoleon and Gengar.
- **When it's ahead:** Expect Lovely Kiss early.
- **How to attack it:** Hit it with Bug, Dark, Fire, Ghost and Steel. The call: Infernape: Overheat 137.3-162.7%. Backup: Empoleon: Flash Cannon 80.7-97.6%. Keep Pikachu and Dragonite away from it: one hit and they're gone. Its blind spot: Empoleon and Scizor take almost nothing from it.

**Grumpig L59**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Psychic (its best hit on Pikachu, Infernape, Empoleon and Gengar). Otherwise: Power Gem against Dragonite and Scizor.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Bug, Dark and Ghost. The call: Scizor: U-turn 102.8-122.7%. Backup: Dragonite: Fly 68-80.1%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Slowbro L60**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor). Hits from both sides (Body Slam physical, Psychic special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Curse or Amnesia.
- **How to attack it:** Hit it with Bug, Dark, Electric and Ghost. The call: Scizor: U-turn 59.4-71.3%. Backup: Dragonite: Fly 39.1-46.5%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Gardevoir L61**

- **Tendencies:** Gets the jump on Empoleon and Scizor. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape and Gengar). Otherwise: Focus Blast against Empoleon and Scizor.
- **When it's ahead:** Given a free turn, it sets up with Calm Mind.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Bug, Dark and Ghost. The call: Dragonite: Fly 69.8-82.6%. Backup: Scizor: U-turn 105.8-125.6%.

**Xatu L62**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Dragonite, Empoleon and Scizor. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor). Hits from both sides (Quick Attack physical, Shadow Ball and Psychic special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Expect Confuse Ray early. Once you're low, Quick Attack finishes you.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark, Electric and Ghost. The call: Gengar: Shadow Ball 112.3-133.3%. Backup: Empoleon: Surf 59.6-70.2%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Bronzong | Empoleon (W) | Surf / Psychic | Surf / Psychic | Surf / Psychic | Surf / Psychic | Surf / Psychic | Surf / Psychic | Surf / Psychic |
| Jynx | Infernape (W) | Close Combat / Dream Eater | Close Combat / Dream Eater | Close Combat / Dream Eater | Close Combat / Dream Eater | Close Combat / Dream Eater | Close Combat / Dream Eater | Close Combat / Dream Eater |
| Grumpig | Scizor (W) | U-turn / Power Gem | U-turn / Power Gem | U-turn / Power Gem | U-turn / Power Gem | U-turn / Power Gem | U-turn / Power Gem | U-turn / Power Gem |
| Slowbro | Scizor (W) | U-turn / Psychic | U-turn / Psychic | U-turn / Psychic | U-turn / Psychic | U-turn / Psychic | U-turn / Psychic | U-turn / Psychic |
| Gardevoir | Dragonite (W) | Dragon Claw / Psychic | Dragon Claw / Psychic | Dragon Claw / Psychic | Dragon Claw / Psychic | Dragon Claw / Psychic | Dragon Claw / Psychic | Dragon Claw / Psychic |
| Xatu | Gengar (W) | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic | Shadow Ball / Psychic |

### Call sheet vs Koga (rematch) (Lv 64, pret/pokeheartgold files/poketool/trainer/trainers.json #703)

- **Order:** Skuntank (Lv 61), Venomoth (Lv 63), Toxicroak (Lv 60), Muk (Lv 62), Crobat (Lv 64), Swalot (Lv 62). Lead with Scizor: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Skuntank, which beats 3 of your 6. Your last one standing: Dragonite.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “One Pokémon left? Ha ha ha! I’ve been counting on this one from the very beginning!” Last Pokémon at half HP: “Ooooof...”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Skuntank L61 | Sucker Punch · Dig · Toxic · Explosion | Scizor: U-turn 43.9-52.3% | Empoleon: Surf 57.5-67.8% | Infernape, Pikachu |
| Venomoth L63 | Double Team · Baton Pass · Psychic · Silver Wind | Empoleon: Surf 56.7-66.7% | Gengar: Psychic 81.1-95.6% | — |
| Toxicroak L60 | Cross Chop · X-Scissor · Swagger · Gunk Shot | Gengar: Psychic 181.8-213.9% | Scizor: Bullet Punch 30.5-35.8% | Pikachu |
| Muk L62 | Minimize · Screech · Swagger · Toxic @ Black Sludge | Infernape: Earthquake 61.8-73.6% | Dragonite: Fly 50.9-60.5% | — |
| Crobat L64 | Toxic · Mean Look · Fly · Cross Poison | Empoleon: Surf 46.5-55.4% | Dragonite: Fly 51-60.9% | — |
| Swalot L62 | Yawn · Amnesia · Pain Split · Sludge Bomb @ Leftovers | Gengar: Psychic 63.6-74.8% | Infernape: Overheat 61.7-72.9% | — |

**Skuntank L61**

- **Order:** Leads off.
- **Tendencies:** Moves first against Empoleon, Gengar and Scizor. Its go-to: Explosion (its best hit on Pikachu, Dragonite, Infernape, Empoleon and Scizor). Otherwise: Sucker Punch against Gengar.
- **When it's ahead:** Expect Toxic early. Once you're low, Sucker Punch finishes you.
- **When it's behind:** Cornered, it can take one of yours down with it (Explosion).
- **How to attack it:** Hit it with Ground. The call: Scizor: U-turn 43.9-52.3%. Backup: Empoleon: Surf 57.5-67.8%. Keep Pikachu and Infernape away from it: one hit and they're gone.

**Venomoth L63**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Psychic (its best hit on Pikachu, Dragonite, Infernape, Empoleon and Gengar). Otherwise: Silver Wind against Scizor.
- **How to attack it:** Hit it with Fire, Flying and Psychic. The call: Empoleon: Surf 56.7-66.7%. Backup: Gengar: Psychic 81.1-95.6%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Toxicroak L60**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Gunk Shot (its best hit on Pikachu, Dragonite, Infernape and Gengar). Otherwise: Cross Chop against Empoleon and Scizor.
- **How to attack it:** Hit it with Flying, Ground and Psychic. The call: Gengar: Psychic 181.8-213.9%. Backup: Scizor: Bullet Punch 30.5-35.8%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Gengar takes almost nothing from it.

**Muk L62**

- **Tendencies:** You move first, every time. Holds Black Sludge: it heals a little every turn.
- **When it's ahead:** Expect Toxic early.
- **How to attack it:** Hit it with Ground and Psychic. The call: Infernape: Earthquake 61.8-73.6%. Backup: Dragonite: Fly 50.9-60.5%. Its blind spot: Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor take almost nothing from it.

**Crobat L64**

- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Fly (its best hit on Dragonite, Infernape, Empoleon, Gengar and Scizor). Otherwise: Cross Poison against Pikachu.
- **When it's ahead:** Expect Toxic early.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Electric and Psychic. The call: Empoleon: Surf 46.5-55.4%. Backup: Dragonite: Fly 51-60.9%. Its blind spot: Dragonite and Empoleon take almost nothing from it.

**Swalot L62**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Sludge Bomb (its best hit on Pikachu, Dragonite, Infernape and Gengar). Holds Leftovers: it heals a little every turn.
- **When it's ahead:** Given a free turn, it sets up with Amnesia. Expect Yawn early.
- **How to attack it:** Hit it with Ground and Psychic. The call: Gengar: Psychic 63.6-74.8%. Backup: Infernape: Overheat 61.7-72.9%. Its blind spot: Dragonite, Empoleon, Gengar and Scizor take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Skuntank | Scizor (W) | U-turn / Dig | U-turn / Dig | U-turn / Explosion | Bullet Punch / Explosion | U-turn / Dig | U-turn / Dig | Bullet Punch / Explosion |
| Venomoth | Empoleon (W) | Surf / Silver Wind | Surf / Silver Wind | Surf / Silver Wind | Aqua Jet / Silver Wind | Surf / Silver Wind | Surf / Silver Wind | Aqua Jet / Silver Wind |
| Toxicroak | Gengar (W) | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot | Psychic / Gunk Shot |
| Muk | Infernape (W) | Earthquake / Minimize | Earthquake / Minimize | Earthquake / Minimize | Earthquake / Minimize | Earthquake / Screech | Earthquake / Minimize | Earthquake / Screech |
| Crobat | Empoleon (W) | Surf / Fly | Surf / Fly | Surf / Fly | Surf / Fly | Surf / Fly | Surf / Fly | Aqua Jet / Fly |
| Swalot | Gengar (W) | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Pain Split | Psychic / Sludge Bomb | Psychic / Pain Split |

### Call sheet vs Bruno (rematch) (Lv 64, pret/pokeheartgold files/poketool/trainer/trainers.json #704)

- **Order:** Hitmontop (Lv 62), Hitmonlee (Lv 61), Hitmonchan (Lv 61), Hariyama (Lv 62), Machamp (Lv 64), Lucario (Lv 64). Lead with Gengar: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Hariyama, which beats 3 of your 6. Your last one standing: Infernape.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “Fight as hard as you can ’til you faint!” Last Pokémon at half HP: “We’re standing firm!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Hitmontop L62 | Counter · Quick Attack · Close Combat · Earthquake | Gengar: Psychic 69.7-82.9% | Infernape: Overheat 67.8-80.9% | Pikachu |
| Hitmonlee L61 | Swagger · Close Combat · Reversal · Blaze Kick | Infernape: Close Combat 108.7-128.7% | Gengar: Psychic 73.3-86.7% | Pikachu |
| Hitmonchan L61 | Substitute · Drain Punch · Close Combat · Bullet Punch | Gengar: Psychic 73.3-86.7% | Infernape: Close Combat 80-94.7% | Pikachu |
| Hariyama L62 | Low Kick · Payback · Bullet Punch · Bulk Up @ Sitrus Berry | Infernape: Close Combat 53.9-63.9% | Gengar: Psychic 64.7-76.6% | — |
| Machamp L64 | Bullet Punch · Foresight · Stone Edge · Dynamic Punch | Gengar: Psychic 61.5-73.1% | Infernape: Overheat 60.6-71.2% | Pikachu |
| Lucario L64 | Extreme Speed · Close Combat · Counter · Iron Tail | Infernape: Overheat 161.5-191.2% | Empoleon: Surf 57.7-68.1% | Pikachu |

**Hitmontop L62**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Close Combat (its best hit on Dragonite, Empoleon and Scizor). Otherwise: Earthquake against Pikachu and Infernape.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Flying and Psychic. The call: Gengar: Psychic 69.7-82.9%. Backup: Infernape: Overheat 67.8-80.9%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Dragonite and Gengar take almost nothing from it.

**Hitmonlee L61**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Close Combat (its best hit on Pikachu, Dragonite, Infernape and Empoleon). Otherwise: Blaze Kick against Gengar and Scizor.
- **Against moves:** Limber: it can't be paralyzed.
- **How to attack it:** Hit it with Flying and Psychic. The call: Infernape: Close Combat 108.7-128.7%. Backup: Gengar: Psychic 73.3-86.7%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Dragonite takes almost nothing from it.

**Hitmonchan L61**

- **Tendencies:** Gets the jump on Empoleon and Gengar. Its go-to: Close Combat (its best hit on Pikachu, Dragonite, Infernape, Empoleon and Scizor). Otherwise: Bullet Punch against Gengar.
- **When it's ahead:** Once you're low, Bullet Punch finishes you.
- **Against moves:** Keen Eye: its accuracy can't be lowered.
- **How to attack it:** Hit it with Flying and Psychic. The call: Gengar: Psychic 73.3-86.7%. Backup: Infernape: Close Combat 80-94.7%. Keep Pikachu away from it: one hit and they're gone. Its blind spot: Dragonite and Gengar take almost nothing from it.

**Hariyama L62**

- **Tendencies:** You move first, every time. Its go-to: Payback (its best hit on Pikachu, Dragonite and Gengar). Otherwise: Low Kick against Infernape, Empoleon and Scizor. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Bulk Up. Once you're low, Bullet Punch finishes you.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Flying and Psychic. The call: Infernape: Close Combat 53.9-63.9%. Backup: Gengar: Psychic 64.7-76.6%. Its blind spot: Dragonite takes almost nothing from it.

**Machamp L64**

- **Tendencies:** You move first, every time. Its go-to: Dynamic Punch (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Stone Edge against Dragonite and Gengar.
- **When it's ahead:** Once you're low, Bullet Punch finishes you.
- **Against moves:** Guts: a status condition makes it hit harder.
- **How to attack it:** Hit it with Flying and Psychic. The call: Gengar: Psychic 61.5-73.1%. Backup: Infernape: Overheat 60.6-71.2%. Keep Pikachu away from it: one hit and they're gone.

**Lucario L64**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Empoleon. Its go-to: Close Combat (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Iron Tail against Dragonite and Gengar.
- **When it's ahead:** Once you're low, Extreme Speed finishes you.
- **Against moves:** Steadfast: flinching makes it faster.
- **How to attack it:** Hit it with Fighting, Fire and Ground. The call: Infernape: Overheat 161.5-191.2%. Backup: Empoleon: Surf 57.7-68.1%. Keep Pikachu away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Hitmontop | Gengar (W) | Psychic / Counter | Psychic / Counter | Psychic / Counter | Psychic / Counter | Psychic / Counter | Psychic / Counter | Psychic / Counter |
| Hitmonlee | Infernape (W) | Close Combat / Close Combat | Close Combat / Close Combat | Close Combat / Close Combat | Close Combat / Close Combat | Close Combat / Close Combat | Close Combat / Close Combat | Close Combat / Close Combat |
| Hitmonchan | Gengar (W) | Psychic / Bullet Punch | Psychic / Bullet Punch | Psychic / Bullet Punch | Psychic / Bullet Punch | Psychic / Bullet Punch | Psychic / Bullet Punch | Psychic / Bullet Punch |
| Hariyama | Infernape (W) | Swords Dance / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick |
| Machamp | Gengar (W) | Psychic / Stone Edge | Psychic / Stone Edge | Psychic / Stone Edge | Psychic / Bullet Punch | Psychic / Stone Edge | Psychic / Stone Edge | Psychic / Stone Edge |
| Lucario | Infernape (W) | Close Combat / Close Combat | Close Combat / Close Combat | Close Combat / Close Combat | Close Combat / Extreme Speed | Close Combat / Close Combat | Close Combat / Close Combat | Close Combat / Extreme Speed |

### Call sheet vs Karen (rematch) (Lv 64, pret/pokeheartgold files/poketool/trainer/trainers.json #705)

- **Order:** Weavile (Lv 62), Spiritomb (Lv 62), Absol (Lv 62), Honchkrow (Lv 64), Houndoom (Lv 63), Umbreon (Lv 64). Lead with Infernape: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Weavile, which beats 3 of your 6. Your last one standing: Infernape.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “This is far from being backed into a corner!” Last Pokémon at half HP: “You’re no ordinary Trainer to have gotten this far.”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Weavile L62 | Ice Shard · Night Slash · Ice Punch · Low Kick | Infernape: Close Combat 307.3-366.1% | Scizor: U-turn 108.5-128.8% | — |
| Spiritomb L62 | Curse · Confuse Ray · Pain Split · Sucker Punch | Empoleon: Surf 50-59.2% | Infernape: Overheat 69.7-82.9% | — |
| Absol L62 | Night Slash · Psycho Cut · Detect · Perish Song | Infernape: Close Combat 169.6-201.2% | Scizor: U-turn 119.3-140.4% | — |
| Honchkrow L64 | Drill Peck · Whirlwind · Sucker Punch · Thunder Wave | Empoleon: Surf 59.7-70.6% | Dragonite: Fly 65.2-77.4% | — |
| Houndoom L63 | Nasty Plot · Dark Pulse · Flamethrower · Sludge Bomb | Infernape: Close Combat 177.4-209.7% | Dragonite: Fly 82.3-96.8% | Scizor |
| Umbreon L64 | Curse · Payback · Confuse Ray · Sucker Punch @ Sitrus Berry | Infernape: Close Combat 81.3-96.3% | Scizor: U-turn 56.1-67.3% | — |

**Weavile L62**

- **Order:** Leads off.
- **Tendencies:** Swings first against almost everyone you have (5 of 6). Its go-to: Low Kick (its best hit on Infernape, Empoleon and Scizor). Otherwise: Ice Punch against Pikachu and Dragonite; Night Slash against Gengar.
- **When it's ahead:** Once you're low, Ice Shard finishes you.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** Hit it with Bug, Fighting, Fire and Steel. The call: Infernape: Close Combat 307.3-366.1%. Backup: Scizor: U-turn 108.5-128.8%. Its blind spot: Infernape and Scizor take almost nothing from it.

**Spiritomb L62**

- **Tendencies:** You move first, every time. Its go-to: Sucker Punch (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor).
- **When it's ahead:** Expect Confuse Ray early. Once you're low, Sucker Punch finishes you.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** The call: Empoleon: Surf 50-59.2%. Backup: Infernape: Overheat 69.7-82.9%. Its blind spot: Dragonite, Infernape, Empoleon and Scizor take almost nothing from it.

**Absol L62**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Night Slash (its best hit on Pikachu, Dragonite, Empoleon, Gengar and Scizor). Otherwise: Psycho Cut against Infernape.
- **When it's behind:** Cornered, it can take one of yours down with it (Perish Song).
- **Against moves:** Pressure: your moves burn extra PP. Stalls with Detect.
- **How to attack it:** Hit it with Bug and Fighting. The call: Infernape: Close Combat 169.6-201.2%. Backup: Scizor: U-turn 119.3-140.4%. Its blind spot: Dragonite, Empoleon and Scizor take almost nothing from it.

**Honchkrow L64**

- **Tendencies:** Gets the jump on Pikachu and Gengar. Its go-to: Drill Peck (its best hit on Dragonite, Infernape, Empoleon and Scizor). Otherwise: Sucker Punch against Pikachu and Gengar.
- **When it's ahead:** Expect Thunder Wave early. Once you're low, Sucker Punch finishes you.
- **Against moves:** Insomnia: it can't be put to sleep. If you set up, it forces you out with Whirlwind.
- **How to attack it:** Hit it with Electric. The call: Empoleon: Surf 59.7-70.6%. Backup: Dragonite: Fly 65.2-77.4%. Its blind spot: Empoleon takes almost nothing from it.

**Houndoom L63**

- **Tendencies:** Moves first against Dragonite, Empoleon and Scizor. Its go-to: Flamethrower (its best hit on Pikachu, Empoleon and Scizor). Otherwise: Dark Pulse against Dragonite and Gengar; Sludge Bomb against Infernape.
- **When it's ahead:** Given a free turn, it sets up with Nasty Plot.
- **How to attack it:** Hit it with Fighting, Ground and Water. The call: Infernape: Close Combat 177.4-209.7%. Backup: Dragonite: Fly 82.3-96.8%. Keep Scizor away from it: one hit and they're gone. Its blind spot: Dragonite takes almost nothing from it.

**Umbreon L64**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Payback (its best hit on Pikachu, Dragonite, Infernape, Empoleon, Gengar and Scizor). Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Curse. Expect Confuse Ray early. Once you're low, Sucker Punch finishes you.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Bug and Fighting. The call: Infernape: Close Combat 81.3-96.3%. Backup: Scizor: U-turn 56.1-67.3%. Its blind spot: Dragonite, Infernape, Empoleon and Scizor take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Weavile | Infernape (W) | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick | Close Combat / Low Kick |
| Spiritomb | Empoleon (W) | Surf / Curse | Surf / Curse | Surf / Curse | Surf / Curse | Surf / Pain Split | Surf / Curse | Aqua Jet / Pain Split |
| Absol | Infernape (W) | Close Combat / Psycho Cut | Close Combat / Psycho Cut | Close Combat / Psycho Cut | Close Combat / Psycho Cut | Close Combat / Psycho Cut | Close Combat / Psycho Cut | Close Combat / Psycho Cut |
| Honchkrow | Empoleon (W) | Surf / Drill Peck | Surf / Drill Peck | Surf / Drill Peck | Surf / Drill Peck | Surf / Drill Peck | Surf / Drill Peck | Surf / Drill Peck |
| Houndoom | Infernape (W) | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb |
| Umbreon | Infernape (W) | Swords Dance / Payback | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback | Close Combat / Payback |

### Call sheet vs Champion Lance (rematch) (Lv 75, pret/pokeheartgold files/poketool/trainer/trainers.json #701)

- **Order:** Salamence (Lv 72), Gyarados (Lv 68), Garchomp (Lv 72), Altaria (Lv 73), Charizard (Lv 68), Dragonite (Lv 75). Lead with Empoleon: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Salamence, which beats 5 of your 6. Your last one standing: Empoleon.
- **The bag:** 4 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “All right! I thought this would never happen!” Last Pokémon at half HP: “I never give up, no matter what. You must be the same?”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Salamence L72 | Flamethrower · Shadow Claw · Dragon Claw · Rest @ Lum Berry | Empoleon: Flash Cannon 41.3-48.8% | — | — |
| Gyarados L68 | Thunder Wave · Ice Fang · Waterfall · Dragon Dance | Pikachu: Volt Tackle 165.6-197.4% | Empoleon: Surf 22.5-26.4% | — |
| Garchomp L72 | Swords Dance · Outrage · Earthquake · Roar | Scizor: U-turn 32.4-38.6% | Dragonite: Dragon Claw 76.4-90.3% | Pikachu |
| Altaria L73 | Perish Song · Dragon Breath · Double Team · Hyper Beam | Empoleon: Flash Cannon 35.5-42.5% | Dragonite: Dragon Claw 95.3-113.1% | — |
| Charizard L68 | Flamethrower · Air Slash · Dragon Claw · Hyper Beam | Empoleon: Surf 114.7-135.3% | Dragonite: Fly 67.6-79.9% | Scizor |
| Dragonite L75 | Fire Blast · Safeguard · Draco Meteor · Hyper Beam @ Sitrus Berry | Dragonite: Dragon Claw 77-91.8% | Empoleon: Flash Cannon 32-38.1% | Scizor, Pikachu |

**Salamence L72**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Dragonite and Empoleon. Its go-to: Dragon Claw (its best hit on Pikachu, Dragonite and Infernape). Otherwise: Flamethrower against Empoleon and Scizor; Shadow Claw against Gengar. Hits from both sides (Shadow Claw and Dragon Claw physical, Flamethrower special): no single wall stops it. Holds Lum Berry: it shrugs off the first status.
- **When it's behind:** When it's low, it heals itself with Rest.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Dragon. The call: Empoleon: Flash Cannon 41.3-48.8%. Its blind spot: Empoleon takes almost nothing from it.

**Gyarados L68**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Waterfall (its best hit on Pikachu, Infernape, Empoleon, Gengar and Scizor). Otherwise: Ice Fang against Dragonite.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance. Expect Thunder Wave early.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric. The call: Pikachu: Volt Tackle 165.6-197.4%. Backup: Empoleon: Surf 22.5-26.4%. Its blind spot: Empoleon takes almost nothing from it.

**Garchomp L72**

- **Tendencies:** Moves first against Dragonite, Empoleon and Scizor. Its go-to: Earthquake (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Outrage against Dragonite and Gengar.
- **When it's ahead:** Given a free turn, it sets up with Swords Dance.
- **Against moves:** Sand Veil: harder to hit in a sandstorm. If you set up, it forces you out with Roar.
- **How to attack it:** Hit it with Dragon. The call: Scizor: U-turn 32.4-38.6%. Backup: Dragonite: Dragon Claw 76.4-90.3%. Keep Pikachu away from it: one hit and they're gone.

**Altaria L73**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Hyper Beam (its best hit on Pikachu, Infernape, Empoleon and Scizor). Otherwise: Dragon Breath against Dragonite and Gengar.
- **When it's behind:** Cornered, it can take one of yours down with it (Perish Song).
- **Against moves:** Natural Cure: switching out cures its status.
- **How to attack it:** Hit it with Dragon. The call: Empoleon: Flash Cannon 35.5-42.5%. Backup: Dragonite: Dragon Claw 95.3-113.1%. Its blind spot: Empoleon, Gengar and Scizor take almost nothing from it.

**Charizard L68**

- **Tendencies:** Gets the jump on Empoleon. Its go-to: Flamethrower (its best hit on Empoleon, Gengar and Scizor). Otherwise: Hyper Beam against Pikachu and Dragonite; Air Slash against Infernape. Hits from both sides (Dragon Claw physical, Flamethrower, Air Slash and Hyper Beam special): no single wall stops it.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Electric and Water. The call: Empoleon: Surf 114.7-135.3%. Backup: Dragonite: Fly 67.6-79.9%. Keep Scizor away from it: one hit and they're gone. Its blind spot: Empoleon takes almost nothing from it.

**Dragonite L75**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Empoleon. Its go-to: Draco Meteor (its best hit on Pikachu, Dragonite, Infernape and Gengar). Otherwise: Fire Blast against Empoleon and Scizor. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Dragon. The call: Dragonite: Dragon Claw 77-91.8%. Backup: Empoleon: Flash Cannon 32-38.1%. Keep Pikachu and Scizor away from it: one hit and they're gone. Its blind spot: Empoleon takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Salamence | Empoleon (W) | Flash Cannon / Flamethrower | Flash Cannon / Flamethrower | Flash Cannon / Flamethrower | Flash Cannon / Flamethrower | Flash Cannon / Flamethrower | Flash Cannon / Flamethrower | Flash Cannon / Flamethrower |
| Gyarados | Pikachu (W) | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall | Thunderbolt / Waterfall |
| Garchomp | Scizor (W) | U-turn / Earthquake | U-turn / Earthquake | U-turn / Earthquake | U-turn / Earthquake | U-turn / Earthquake | U-turn / Earthquake | U-turn / Earthquake |
| Altaria | Empoleon (W) | Flash Cannon / Hyper Beam | Flash Cannon / Hyper Beam | Flash Cannon / Hyper Beam | Flash Cannon / Hyper Beam | Flash Cannon / Hyper Beam | Flash Cannon / Hyper Beam | Flash Cannon / Hyper Beam |
| Charizard | Empoleon (W) | Surf / Flamethrower | Surf / Flamethrower | Surf / Flamethrower | Aqua Jet / Flamethrower | Surf / Flamethrower | Surf / Flamethrower | Aqua Jet / Flamethrower |
| Dragonite | Dragonite (W) | Dragon Claw / Draco Meteor | Dragon Claw / Draco Meteor | Dragon Claw / Draco Meteor | Dragon Claw / Hyper Beam | Dragon Claw / Draco Meteor | Dragon Claw / Draco Meteor | Dragon Claw / Hyper Beam |

