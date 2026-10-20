# Scouting packet: FireRed (confidence)

*Roster status: working (D-003). No grades: every line below is a phrase from the phrase book (engine/battle/phrasebook.json), triggered by numbers the engine measures, the way the games turn a Pokémon's best IV into its characteristic. Speed, power and bulk are measured against every fully evolved Pokémon of the same generation. Opponents' philosophy comes from the game's own trainer AI flags, bag and battle lines. Every one-on-one is played out by the scouting engine (docs/SCOUTING_ENGINE.md): our best plan against their best answer, Smogon's calculator for every hit at the lowest roll, every move landing, the odds kept. Against a game's trainers we meet them at their top level; the coach profile is measured against that generation's Smogon OU usage field at Lv 100.*

## Self-scout

### Coach profile

Against the Gen 3 OU usage field (57 Smogon sets): **builds first (p94), no healing (p15), special (p15)**. 127-25-190 in 342 one-on-ones. A slider is a share of those fights; p is the percentile among 2,000 random six-Pokémon teams drawn from the field.

| Slider | ◀ | Value | ▶ | Percentile |
|---|---|---|---|---|
| Pace | absorbs first | 65 | strikes first | p55 |
| Punch | chips | 45 | knocks out | p19 |
| Run / pass | special | 33 | physical | p15 |
| Build-up | hits now | 30 | builds first | p94 |
| Sustain | no healing | 0 | heals and resets | p15 |
| Disruption | straight-up | 5 | disruptive | p16 |
| Risk | safe | 25 | gambler | p30 |
| Script | adaptive | 43 | scripted | p19 |

| Player | W-D-L | Pace | Punch | Run / pass | Build-up | Sustain | Disruption | Risk | Script |
|---|---|---|---|---|---|---|---|---|---|
| Charizard | 20-4-33 | 68 (p52) | 61 (p57) | 24 (p40) | 39 (p80) | 0 (p41) | 0 (p27) | 23 (p45) | 39 (p32) |
| Blastoise | 26-5-26 | 63 (p44) | 37 (p24) | 0 (p17) | 0 (p31) | 0 (p41) | 30 (p85) | 30 (p55) | 54 (p68) |
| Venusaur | 19-6-32 | 54 (p34) | 35 (p23) | 66 (p60) | 28 (p70) | 0 (p41) | 0 (p27) | 32 (p58) | 28 (p4) |
| Alakazam | 17-6-34 | 72 (p56) | 47 (p37) | 0 (p17) | 39 (p80) | 0 (p41) | 0 (p27) | 0 (p3) | 39 (p32) |
| Jolteon | 14-2-41 | 84 (p74) | 28 (p21) | 7 (p35) | 28 (p70) | 0 (p41) | 0 (p27) | 12 (p37) | 53 (p65) |
| Machamp | 31-2-24 | 46 (p24) | 60 (p55) | 100 (p82) | 44 (p84) | 0 (p41) | 0 (p27) | 54 (p79) | 44 (p46) |

**Play sheet** (its most common call in each situation, against the field):

| Player | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|
| Charizard | Overheat (47%) | Overheat (72%) | Overheat (68%) | Earthquake (44%) | Overheat (86%) | Overheat (67%) | Overheat (60%) |
| Blastoise | Surf (56%) | Surf (75%) | Surf (75%) | Surf (75%) | Surf (81%) | Surf (75%) | Surf (81%) |
| Venusaur | Petal Dance (32%) | Sludge Bomb (40%) | Sludge Bomb (40%) | Sludge Bomb (42%) | Petal Dance (46%) | Petal Dance (39%) | Petal Dance (46%) |
| Alakazam | Calm Mind (39%) | Psychic (56%) | Psychic (56%) | Psychic (56%) | Psychic (56%) | Psychic (56%) | Psychic (56%) |
| Jolteon | Thunderbolt (56%) | Thunderbolt (72%) | Thunderbolt (72%) | Thunderbolt (75%) | Thunderbolt (72%) | Thunderbolt (72%) | Thunderbolt (75%) |
| Machamp | Bulk Up (44%) | Cross Chop (40%) | Earthquake (44%) | Earthquake (70%) | Cross Chop (40%) | Cross Chop (40%) | Earthquake (51%) |

*Assumed where nothing is on record: EVs 85 in every stat; IVs 31; ability Synchronize (could be Inner Focus); level 100 (the peak); neutral nature.*

- **What we're trying to do:** Win on momentum: Charizard, Venusaur, Alakazam, Jolteon and Machamp turn one free turn into a sweep. The anchor: Blastoise.
- **What we're good at:** 12 attack types in the repertoire. The main ones: Ground (Charizard, Machamp and Venusaur), Fire (Alakazam and Charizard), Ice (Alakazam and Blastoise) and Dark (Charizard and Jolteon). Nothing is safe: 17 of 17 types take super-effective hits from this club. Jolteon sets the pace; Machamp expects to take the first hit. Status: Blastoise.
- **Where we're soft:** No shared hole: no type hits three of the club super-effectively.

| Attack type | Who throws it |
|---|---|
| Ground | Charizard (Earthquake), Venusaur (Earthquake), Machamp (Earthquake) |
| Fire | Charizard (Overheat), Alakazam (Fire Punch) |
| Ice | Blastoise (Ice Beam), Alakazam (Ice Punch) |
| Dark | Charizard (Bite), Jolteon (Bite) |
| Water | Blastoise (Surf) |
| Electric | Jolteon (Thunderbolt) |
| Grass | Venusaur (Petal Dance) |
| Fighting | Machamp (Cross Chop) |
| Poison | Venusaur (Sludge Bomb) |
| Psychic | Alakazam (Psychic) |
| Rock | Machamp (Rock Slide) |
| Steel | Jolteon (Iron Tail) |

## Depth chart

| Player | Philosophy | 1v1 vs the league | Build |
|---|---|---|---|
| **Blastoise** | Weaken first, win later: Toxic before the real swings. | 73-3 | historical (sheet) |
| **Alakazam** | Win on momentum: take one free turn for Calm Mind, then everything goes through. | 73-3 | no build on record: the engine filled in its strongest set |
| **Machamp** | Win on momentum: take one free turn for Bulk Up, then everything goes through. | 63-13 | no build on record: the engine filled in its strongest set |
| **Jolteon** | Win on momentum: take one free turn for Curse, then everything goes through. | 58-18 | no build on record: the engine filled in its strongest set |
| **Charizard** | Win on momentum: take one free turn for Dragon Dance, then everything goes through. | 52-24 | no build on record: the engine filled in its strongest set |
| **Venusaur** | Straight ahead: the best hit, every turn. | 52-24 | no build on record: the engine filled in its strongest set |

## Scouting reports

### Charizard (Fire/Flying), FireRed
*Overheat / Earthquake / Bite / Dragon Dance · Blaze · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Dragon Dance, then everything goes through.
- **Tendencies:** Usually swings first: 80% of its generation is slower. Hits from both sides (Earthquake physical, Overheat and Bite special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Overheat.
- **When it's ahead:** Ahead, it takes the free turn for Dragon Dance.
- **When it's behind:** Behind, it swings for the KO and hopes it lands first. Low on HP, Blaze kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Bug, Electric, Fire, Ghost, Grass, Ice, Poison, Psychic, Rock and Steel. One fatal hole: Rock hits it four times as hard. Look out for Rock (×4), Water (×2) and Electric (×2). A free switch-in against Ground.
- **How you beat it:** Hit it with something it can't hit back: Aerodactyl, Armaldo, Cradily and Shuckle are the classic answers.
- **Production:** Won 52 of 76 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Typhlosion, Zapdos and Xatu. Pokédex, FireRed: “Its wings can carry this POKéMON close to an altitude of 4,600 feet. It blows out fire at very high temperatures.”

### Blastoise (Water), FireRed
*Surf / Ice Beam / Rapid Spin / Toxic · Bold · Torrent · @ Leftovers · build: historical (sheet)*

- **Philosophy:** Weaken first, win later: Toxic before the real swings.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Every attack runs off its Sp. Atk. Out pitch: Surf. Holds Leftovers: it heals a little every turn.
- **When it's ahead:** Ahead, it spends the lead on Toxic.
- **When it's behind:** Even behind, it can eat one more hit. Low on HP, Torrent kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Dragon, Fire, Flying, Grass, Ground and Rock. Look out for Electric (×2) and Grass (×2).
- **How you beat it:** Hit it with something it can't hit back: Jolteon, Electrode, Manectric and Electabuzz are the classic answers.
- **Production:** Won 73 of 76 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Kingdra, Meganium and Poliwrath. Pokédex, FireRed: “It crushes its foe under its heavy body to cause fainting. In a pinch, it will withdraw inside its shell.”

### Venusaur (Grass/Poison), FireRed
*Sludge Bomb / Earthquake / Petal Dance / Swords Dance · Overgrow · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Straight ahead: the best hit, every turn.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Hits from both sides (Sludge Bomb and Earthquake physical, Petal Dance special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Sludge Bomb. Commits: Petal Dance locks it in for two or three turns.
- **When it's ahead:** Ahead, it takes the free turn for Swords Dance.
- **When it's behind:** Even behind, it can eat one more hit. Low on HP, Overgrow kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Electric, Fire, Grass, Ground, Poison, Rock, Steel and Water. Look out for Fire (×2), Ice (×2), Flying (×2) and Psychic (×2).
- **Against moves:** Toxic and poison do nothing to it.
- **How you beat it:** Hit it with something it can't hit back: Alakazam, Ninjask, Espeon and Aerodactyl are the classic answers.
- **Production:** Won 52 of 76 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Ludicolo, Meganium and Nidoqueen. Pokédex, FireRed: “A bewitching aroma wafts from its flower. The fragrance becalms those engaged in a battle.”

### Alakazam (Psychic), FireRed
*Psychic / Fire Punch / Ice Punch / Calm Mind · Synchronize · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Calm Mind, then everything goes through.
- **Tendencies:** Rarely gets outrun: faster than 95% of the fully evolved Pokémon in its generation. Every attack runs off its Sp. Atk. Out pitch: Psychic. Raw power near the top of its generation. Glass on one side: it can't afford to take many hits there.
- **When it's ahead:** Ahead, it takes the free turn for Calm Mind.
- **When it's behind:** Behind, it has no way back. Get it out before it's caught low.
- **Against types:** Feeds on Bug, Dragon, Fighting, Flying, Grass, Ground, Ice, Poison and Steel. Look out for Bug (×2), Ghost (×2) and Dark (×2).
- **Against moves:** Synchronize: it passes its status back.
- **How you beat it:** Hit it with something it can't hit back: Sharpedo, Houndoom, Absol and Tyranitar are the classic answers.
- **Production:** Won 73 of 76 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Espeon, Jynx and Gengar. Pokédex, FireRed: “It does not like physical attacks very much. Instead, it freely uses extra sensory powers to defeat foes.”

### Jolteon (Electric), FireRed
*Thunderbolt / Bite / Iron Tail / Curse · Volt Absorb · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Curse, then everything goes through.
- **Tendencies:** Rarely gets outrun: faster than 97% of the fully evolved Pokémon in its generation. Hits from both sides (Iron Tail physical, Thunderbolt and Bite special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Thunderbolt. Glass on one side: it can't afford to take many hits there. Can miss when it matters: Iron Tail (75%).
- **When it's ahead:** Ahead, it takes the free turn for Curse.
- **When it's behind:** Behind, it has no way back. Get it out before it's caught low.
- **Against types:** Feeds on Flying, Ghost, Ice, Psychic, Rock and Water. Look out for Ground (×2). A free switch-in against Electric.
- **Against moves:** Volt Absorb: Electric moves heal it instead.
- **How you beat it:** Hit it with something it can't hit back: Dugtrio, Flygon, Nidoking and Donphan are the classic answers.
- **Production:** Won 58 of 76 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Electabuzz, Raikou and Electrode. Pokédex, FireRed: “If it is angered or startled, the fur all over its body bristles like sharp needles that pierce foes.”

### Machamp (Fighting), FireRed
*Cross Chop / Earthquake / Rock Slide / Bulk Up · Guts · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Bulk Up, then everything goes through.
- **Tendencies:** Expects to take the first hit: only 23% of its generation is slower. Every attack runs off its Attack stat. Out pitch: Cross Chop. Raw power near the top of its generation. Can miss when it matters: Cross Chop (80%).
- **When it's ahead:** Ahead, it takes the free turn for Bulk Up.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Bug, Dark, Electric, Fire, Flying, Ice, Normal, Poison, Rock and Steel. Look out for Flying (×2) and Psychic (×2).
- **Against moves:** Guts: a status condition makes it hit harder.
- **How you beat it:** Hit it with something it can't hit back: Alakazam, Espeon, Starmie and Gardevoir are the classic answers.
- **Production:** Won 63 of 76 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Ursaring, Heracross and Breloom. Pokédex, FireRed: “Its four ruggedly developed arms can launch a flurry of 1,000 punches in just two seconds.”

## Call sheets

### Call sheet vs Lorelei (Lv 54, pret/pokefirered src/data/trainer_parties.h sParty_EliteFourLorelei)

- **Order:** Dewgong (Lv 52), Cloyster (Lv 51), Slowbro (Lv 52), Jynx (Lv 54), Lapras (Lv 54). Lead with Blastoise: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Lapras, which beats 2 of your 6. Your last one standing: Blastoise.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Dewgong L52 | Ice Beam · Surf · Hail · Safeguard | Blastoise: Surf 17-20.5% | Jolteon: Thunderbolt 84.2-99.4% | — |
| Cloyster L51 | Spikes · Protect · Hail · Dive | Venusaur: Petal Dance 140.2-165.4% | Alakazam: Psychic 112.6-133.1% | — |
| Slowbro L52 | Ice Beam · Surf · Amnesia · Yawn | Blastoise: Surf 19.3-22.7% | Jolteon: Thunderbolt 95.5-112.5% | — |
| Jynx L54 | Ice Punch · Double Slap · Lovely Kiss · Attract | Blastoise: Surf 38.7-46% | Alakazam: Fire Punch 57.3-68% | — |
| Lapras L54 | Confuse Ray · Ice Beam · Surf · Body Slam @ Sitrus Berry | Jolteon: Thunderbolt 63.2-74.5% | Alakazam: Psychic 35-41.4% | — |

**Dewgong L52**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Ice Beam (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Surf against Charizard.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Electric, Fighting, Grass and Rock. The call: Blastoise: Surf 17-20.5%. Backup: Jolteon: Thunderbolt 84.2-99.4%. Its blind spot: Blastoise, Jolteon and Machamp take almost nothing from it.

**Cloyster L51**

- **Tendencies:** You move first, every time. Its go-to: Dive (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp).
- **Against moves:** Stalls with Protect.
- **How to attack it:** Hit it with Electric, Fighting, Grass and Rock. The call: Venusaur: Petal Dance 140.2-165.4%. Backup: Alakazam: Psychic 112.6-133.1%. Its blind spot: Blastoise, Venusaur, Alakazam, Jolteon and Machamp take almost nothing from it.

**Slowbro L52**

- **Tendencies:** You move first, every time. Its go-to: Surf (its best hit on Charizard, Blastoise, Alakazam, Jolteon and Machamp). Otherwise: Ice Beam against Venusaur.
- **When it's ahead:** Given a free turn, it sets up with Amnesia. Expect Yawn early.
- **How to attack it:** Hit it with Dark, Electric and Grass. The call: Blastoise: Surf 19.3-22.7%. Backup: Jolteon: Thunderbolt 95.5-112.5%. Its blind spot: Blastoise takes almost nothing from it.

**Jynx L54**

- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Ice Punch (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp).
- **When it's ahead:** Expect Lovely Kiss early.
- **How to attack it:** Hit it with Dark, Fire, Rock and Steel. The call: Blastoise: Surf 38.7-46%. Backup: Alakazam: Fire Punch 57.3-68%. Its blind spot: Blastoise takes almost nothing from it.

**Lapras L54**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Ice Beam (its best hit on Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Surf against Charizard; Body Slam against Blastoise. Hits from both sides (Body Slam physical, Ice Beam and Surf special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Water Absorb: Water moves heal it instead.
- **How to attack it:** Hit it with Electric, Fighting, Grass and Rock. The call: Jolteon: Thunderbolt 63.2-74.5%. Backup: Alakazam: Psychic 35-41.4%. Its blind spot: Blastoise takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Dewgong | Blastoise (W) | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam |
| Cloyster | Venusaur (W) | Petal Dance / Dive | Petal Dance / Dive | Petal Dance / Dive | Petal Dance / Dive | Petal Dance / Dive | Petal Dance / Dive | Petal Dance / Dive |
| Slowbro | Blastoise (W) | Surf / Surf | Surf / Surf | Surf / Surf | Surf / Surf | Surf / Surf | Surf / Surf | Surf / Surf |
| Jynx | Blastoise (W) | Surf / Ice Punch | Surf / Ice Punch | Surf / Ice Punch | Surf / Ice Punch | Surf / Ice Punch | Surf / Ice Punch | Surf / Ice Punch |
| Lapras | Jolteon (W) | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam |

### Call sheet vs Bruno (Lv 56, pret/pokefirered src/data/trainer_parties.h sParty_EliteFourBruno)

- **Order:** Onix (Lv 51), Hitmonchan (Lv 53), Hitmonlee (Lv 53), Onix (Lv 54), Machamp (Lv 56). Lead with Blastoise: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Machamp, which beats 2 of your 6. Your last one standing: Blastoise.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Onix L51 | Earthquake · Rock Tomb · Iron Tail · Roar | Blastoise: Surf 412.5-485.7% | Venusaur: Petal Dance 345.5-407.1% | — |
| Hitmonchan L53 | Sky Uppercut · Mach Punch · Rock Tomb · Counter | Alakazam: Psychic 116.8-137.4% | Venusaur: Sludge Bomb 51.1-60.3% | — |
| Hitmonlee L53 | Mega Kick · Foresight · Brick Break · Facade | Alakazam: Psychic 116.8-137.4% | Venusaur: Sludge Bomb 69.5-82.4% | — |
| Onix L54 | Double-Edge · Earthquake · Iron Tail · Sand Tomb | Blastoise: Surf 374.6-440.7% | Venusaur: Petal Dance 313.6-369.5% | — |
| Machamp L56 | Cross Chop · Bulk Up · Scary Face · Rock Tomb @ Sitrus Berry | Alakazam: Psychic 97.3-114.8% | Venusaur: Sludge Bomb 34.4-41% | — |

**Onix L51**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Rock Tomb against Charizard.
- **Against moves:** Rock Head: no recoil damage. If you set up, it forces you out with Roar.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice, Steel and Water. The call: Blastoise: Surf 412.5-485.7%. Backup: Venusaur: Petal Dance 345.5-407.1%. Its blind spot: Blastoise, Venusaur and Machamp take almost nothing from it.

**Hitmonchan L53**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Sky Uppercut (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Rock Tomb against Charizard.
- **When it's ahead:** Once you're low, Mach Punch finishes you.
- **Against moves:** Keen Eye: its accuracy can't be lowered.
- **How to attack it:** Hit it with Psychic. The call: Alakazam: Psychic 116.8-137.4%. Backup: Venusaur: Sludge Bomb 51.1-60.3%. Its blind spot: Blastoise and Venusaur take almost nothing from it.

**Hitmonlee L53**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Mega Kick (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp).
- **Against moves:** Limber: it can't be paralyzed.
- **How to attack it:** Hit it with Psychic. The call: Alakazam: Psychic 116.8-137.4%. Backup: Venusaur: Sludge Bomb 69.5-82.4%. Its blind spot: Blastoise takes almost nothing from it.

**Onix L54**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Earthquake (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Double-Edge against Charizard.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice, Steel and Water. The call: Blastoise: Surf 374.6-440.7%. Backup: Venusaur: Petal Dance 313.6-369.5%. Its blind spot: Charizard, Blastoise, Venusaur and Machamp take almost nothing from it.

**Machamp L56**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Cross Chop (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Rock Tomb against Charizard. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Bulk Up.
- **Against moves:** Guts: a status condition makes it hit harder.
- **How to attack it:** Hit it with Psychic. The call: Alakazam: Psychic 97.3-114.8%. Backup: Venusaur: Sludge Bomb 34.4-41%. Its blind spot: Venusaur takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Onix | Blastoise (W) | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake |
| Hitmonchan | Alakazam (W) | Psychic / Sky Uppercut | Psychic / Sky Uppercut | Psychic / Sky Uppercut | Psychic / Sky Uppercut | Psychic / Sky Uppercut | Psychic / Sky Uppercut | Psychic / Sky Uppercut |
| Hitmonlee | Alakazam (W) | Psychic / Mega Kick | Psychic / Mega Kick | Psychic / Mega Kick | Psychic / Facade | Psychic / Mega Kick | Psychic / Mega Kick | Psychic / Facade |
| Onix | Blastoise (W) | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake |
| Machamp | Alakazam (W) | Psychic / Cross Chop | Psychic / Cross Chop | Psychic / Cross Chop | Psychic / Cross Chop | Psychic / Cross Chop | Psychic / Cross Chop | Psychic / Cross Chop |

### Call sheet vs Agatha (Lv 58, pret/pokefirered src/data/trainer_parties.h sParty_EliteFourAgatha)

- **Order:** Gengar (Lv 54), Golbat (Lv 54), Haunter (Lv 53), Arbok (Lv 56), Gengar (Lv 58). Lead with Alakazam: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Haunter, which beats 1 of your 6. Your last one standing: Charizard.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Gengar L54 | Shadow Punch · Confuse Ray · Toxic · Double Team | Alakazam: Psychic 151-177.9% | Charizard: Overheat 97.9-115.9% | — |
| Golbat L54 | Confuse Ray · Poison Fang · Air Cutter · Bite | Alakazam: Psychic 136-160.2% | Jolteon: Thunderbolt 121.1-142.9% | — |
| Haunter L53 | Hypnosis · Dream Eater · Curse · Mean Look | Alakazam: Psychic 222.2-261.9% | Blastoise: Surf 81-96% | — |
| Arbok L56 | Sludge Bomb · Screech · Iron Tail · Bite | Alakazam: Psychic 136-160% | Venusaur: Earthquake 75.3-89.3% | — |
| Gengar L58 | Shadow Ball · Sludge Bomb · Hypnosis · Nightmare @ Sitrus Berry | Alakazam: Psychic 131.6-154.8% | Blastoise: Surf 47.7-56.8% | — |

**Gengar L54**

- **Order:** Leads off.
- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Shadow Punch (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp).
- **When it's ahead:** Expect Confuse Ray or Toxic early.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark and Psychic. The call: Alakazam: Psychic 151-177.9%. Backup: Charizard: Overheat 97.9-115.9%. Its blind spot: Charizard, Blastoise, Venusaur, Jolteon and Machamp take almost nothing from it.

**Golbat L54**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Air Cutter (its best hit on Charizard, Blastoise, Venusaur, Alakazam and Machamp). Otherwise: Poison Fang against Jolteon. Hits from both sides (Poison Fang and Air Cutter physical, Bite special): no single wall stops it.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Electric, Ice, Psychic and Rock. The call: Alakazam: Psychic 136-160.2%. Backup: Jolteon: Thunderbolt 121.1-142.9%. Its blind spot: Charizard, Blastoise and Jolteon take almost nothing from it.

**Haunter L53**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Dream Eater (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp).
- **When it's ahead:** Expect Hypnosis early.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark and Psychic. The call: Alakazam: Psychic 222.2-261.9%. Backup: Blastoise: Surf 81-96%. Its blind spot: Charizard, Blastoise, Alakazam and Jolteon take almost nothing from it.

**Arbok L56**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Sludge Bomb (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Hits from both sides (Sludge Bomb and Iron Tail physical, Bite special): no single wall stops it.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Ground and Psychic. The call: Alakazam: Psychic 136-160%. Backup: Venusaur: Earthquake 75.3-89.3%. Its blind spot: Blastoise takes almost nothing from it.

**Gengar L58**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Sludge Bomb (its best hit on Charizard, Blastoise, Venusaur, Jolteon and Machamp). Otherwise: Shadow Ball against Alakazam. Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Expect Hypnosis early.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark and Psychic. The call: Alakazam: Psychic 131.6-154.8%. Backup: Blastoise: Surf 47.7-56.8%. Its blind spot: Charizard, Blastoise, Venusaur and Machamp take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Gengar | Alakazam (W) | Psychic / Shadow Punch | Psychic / Shadow Punch | Psychic / Shadow Punch | Psychic / Shadow Punch | Psychic / Shadow Punch | Psychic / Shadow Punch | Psychic / Shadow Punch |
| Golbat | Alakazam (W) | Psychic / Air Cutter | Psychic / Air Cutter | Psychic / Air Cutter | Psychic / Poison Fang | Psychic / Air Cutter | Psychic / Air Cutter | Psychic / Air Cutter |
| Haunter | Alakazam (W) | Psychic / Dream Eater | Psychic / Dream Eater | Psychic / Dream Eater | Psychic / Dream Eater | Psychic / Dream Eater | Psychic / Dream Eater | Psychic / Dream Eater |
| Arbok | Alakazam (W) | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb |
| Gengar | Alakazam (W) | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball |

### Call sheet vs Lance (Lv 60, pret/pokefirered src/data/trainer_parties.h sParty_EliteFourLance)

- **Order:** Gyarados (Lv 56), Dragonair (Lv 54), Dragonair (Lv 54), Aerodactyl (Lv 58), Dragonite (Lv 60). Lead with Jolteon: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Dragonite, which beats 3 of your 6. Your last one standing: Blastoise.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Gyarados L56 | Hyper Beam · Dragon Rage · Twister · Bite | Jolteon: Thunderbolt 172.5-203.2% | Blastoise: Ice Beam 23.3-27.5% | — |
| Dragonair L54 | Hyper Beam · Safeguard · Dragon Rage · Outrage | Blastoise: Ice Beam 84.9-100% | Machamp: Cross Chop 96.6-113.7% | — |
| Dragonair L54 | Hyper Beam · Safeguard · Thunder Wave · Outrage | Blastoise: Ice Beam 84.9-100% | Machamp: Cross Chop 96.6-113.7% | — |
| Aerodactyl L58 | Hyper Beam · Ancient Power · Wing Attack · Scary Face | Jolteon: Thunderbolt 111.2-131.5% | Blastoise: Surf 91.6-107.9% | — |
| Dragonite L60 | Hyper Beam · Safeguard · Outrage · Wing Attack @ Sitrus Berry | Blastoise: Ice Beam 84.3-99.5% | Jolteon: Thunderbolt 38.6-45.7% | — |

**Gyarados L56**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Hyper Beam (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Hits from both sides (Hyper Beam physical, Twister and Bite special): no single wall stops it.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric and Rock. The call: Jolteon: Thunderbolt 172.5-203.2%. Backup: Blastoise: Ice Beam 23.3-27.5%.

**Dragonair L54**

- **Tendencies:** You move first, every time. Its go-to: Hyper Beam (its best hit on Charizard, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Dragon Rage against Blastoise. Hits from both sides (Hyper Beam physical, Outrage special): no single wall stops it.
- **Against moves:** Shed Skin: it can shake off status between turns.
- **How to attack it:** Hit it with Ice. The call: Blastoise: Ice Beam 84.9-100%. Backup: Machamp: Cross Chop 96.6-113.7%. Its blind spot: Blastoise, Venusaur and Machamp take almost nothing from it.

**Dragonair L54**

- **Tendencies:** You move first, every time. Its go-to: Hyper Beam (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Hits from both sides (Hyper Beam physical, Outrage special): no single wall stops it.
- **When it's ahead:** Expect Thunder Wave early.
- **Against moves:** Shed Skin: it can shake off status between turns.
- **How to attack it:** Hit it with Ice. The call: Blastoise: Ice Beam 84.9-100%. Backup: Machamp: Cross Chop 96.6-113.7%. Its blind spot: Blastoise, Venusaur and Machamp take almost nothing from it.

**Aerodactyl L58**

- **Tendencies:** Moves first against Charizard, Blastoise, Venusaur and Machamp. Its go-to: Hyper Beam (its best hit on Blastoise, Alakazam and Jolteon). Otherwise: Wing Attack against Venusaur and Machamp; Ancient Power against Charizard.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Electric, Ice, Rock, Steel and Water. The call: Jolteon: Thunderbolt 111.2-131.5%. Backup: Blastoise: Surf 91.6-107.9%.

**Dragonite L60**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Hyper Beam (its best hit on Charizard, Blastoise, Alakazam and Jolteon). Otherwise: Wing Attack against Venusaur and Machamp. Hits from both sides (Hyper Beam and Wing Attack physical, Outrage special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Ice and Rock. The call: Blastoise: Ice Beam 84.3-99.5%. Backup: Jolteon: Thunderbolt 38.6-45.7%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Gyarados | Jolteon (W) | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Dragon Rage | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam |
| Dragonair | Blastoise (W) | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Dragon Rage | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam |
| Dragonair | Blastoise (W) | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam |
| Aerodactyl | Jolteon (W) | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Ancient Power | Thunderbolt / Hyper Beam | Thunderbolt / Hyper Beam | Thunderbolt / Ancient Power |
| Dragonite | Blastoise (W) | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Outrage | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Outrage |

### Call sheet vs Champion (rival, Squirtle variant) (Lv 63, pret/pokefirered src/data/trainer_parties.h sParty_ChampionFirstSquirtle)

- **Order:** Pidgeot (Lv 59), Alakazam (Lv 57), Rhydon (Lv 59), Arcanine (Lv 59), Exeggutor (Lv 61), Blastoise (Lv 63). Lead with Jolteon: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Alakazam, which beats 2 of your 6. Your last one standing: Blastoise.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Pidgeot L59 | Aerial Ace · Feather Dance · Sand Attack · Whirlwind | Jolteon: Thunderbolt 119.5-140.5% | Blastoise: Ice Beam 65.9-77.8% | — |
| Alakazam L57 | Psychic · Future Sight · Recover · Reflect | Alakazam: Fire Punch 41.5-49% | Charizard: Overheat 97.3-115% | — |
| Rhydon L59 | Take Down · Earthquake · Rock Tomb · Scary Face | Blastoise: Surf 238.4-280.6% | Venusaur: Petal Dance 199.5-235.1% | Jolteon |
| Arcanine L59 | Extreme Speed · Flamethrower · Roar · Bite | Blastoise: Surf 85-100.5% | Jolteon: Thunderbolt 51.8-61.1% | — |
| Exeggutor L61 | Giga Drain · Egg Bomb · Sleep Powder · Light Screen | Venusaur: Sludge Bomb 67.8-80% | Blastoise: Ice Beam 60.5-71.2% | — |
| Blastoise L63 | Hydro Pump · Rain Dance · Skull Bash · Bite @ Sitrus Berry | Venusaur: Petal Dance 53.6-63.5% | Alakazam: Psychic 43.8-51.6% | — |

**Pidgeot L59**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Aerial Ace (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp).
- **Against moves:** Keen Eye: its accuracy can't be lowered. If you set up, it forces you out with Whirlwind.
- **How to attack it:** Hit it with Electric, Ice and Rock. The call: Jolteon: Thunderbolt 119.5-140.5%. Backup: Blastoise: Ice Beam 65.9-77.8%. Its blind spot: Charizard, Blastoise and Jolteon take almost nothing from it.

**Alakazam L57**

- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Psychic (its best hit on Charizard, Blastoise, Venusaur, Jolteon and Machamp). Otherwise: Future Sight against Alakazam.
- **When it's behind:** When it's low, it heals itself with Recover.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Alakazam: Fire Punch 41.5-49%. Backup: Charizard: Overheat 97.3-115%. Its blind spot: Alakazam takes almost nothing from it.

**Rhydon L59**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Rock Tomb against Charizard.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice, Steel and Water. The call: Blastoise: Surf 238.4-280.6%. Backup: Venusaur: Petal Dance 199.5-235.1%. Keep Jolteon away from it: one hit and they're gone.

**Arcanine L59**

- **Tendencies:** Moves first against Charizard, Blastoise and Machamp. Its go-to: Flamethrower (its best hit on Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Extreme Speed against Charizard and Blastoise. Hits from both sides (Extreme Speed physical, Flamethrower and Bite special): no single wall stops it.
- **When it's ahead:** Once you're low, Extreme Speed finishes you.
- **Against moves:** Intimidate: your Attack drops the moment it comes in. If you set up, it forces you out with Roar.
- **How to attack it:** Hit it with Ground, Rock and Water. The call: Blastoise: Surf 85-100.5%. Backup: Jolteon: Thunderbolt 51.8-61.1%. Its blind spot: Charizard and Blastoise take almost nothing from it.

**Exeggutor L61**

- **Tendencies:** You move first, every time. Its go-to: Egg Bomb (its best hit on Charizard, Venusaur, Alakazam and Jolteon). Otherwise: Giga Drain against Blastoise and Machamp. Hits from both sides (Egg Bomb physical, Giga Drain special): no single wall stops it.
- **When it's ahead:** Expect Sleep Powder early.
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Dark, Fire, Ice and Poison. The call: Venusaur: Sludge Bomb 67.8-80%. Backup: Blastoise: Ice Beam 60.5-71.2%. Its blind spot: Charizard, Venusaur and Machamp take almost nothing from it.

**Blastoise L63**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Hydro Pump (its best hit on Charizard, Alakazam, Jolteon and Machamp). Otherwise: Skull Bash against Blastoise and Venusaur. Hits from both sides (Skull Bash physical, Hydro Pump and Bite special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Torrent: Water moves hit harder when it's low.
- **How to attack it:** Hit it with Electric and Grass. The call: Venusaur: Petal Dance 53.6-63.5%. Backup: Alakazam: Psychic 43.8-51.6%. Its blind spot: Blastoise and Venusaur take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Pidgeot | Jolteon (W) | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace |
| Alakazam | Alakazam (W) | Calm Mind / Future Sight | Fire Punch / Future Sight | Fire Punch / Future Sight | Fire Punch / Future Sight | Fire Punch / Recover | Fire Punch / Future Sight | Fire Punch / Future Sight |
| Rhydon | Blastoise (W) | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake |
| Arcanine | Blastoise (W) | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed |
| Exeggutor | Venusaur (W) | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb |
| Blastoise | Venusaur (W) | Petal Dance / Skull Bash | Petal Dance / Skull Bash | Petal Dance / Skull Bash | Petal Dance / Skull Bash | Petal Dance / Hydro Pump | Petal Dance / Skull Bash | Petal Dance / Hydro Pump |

### Call sheet vs Champion (rival, Bulbasaur variant) (Lv 63, pret/pokefirered src/data/trainer_parties.h sParty_ChampionFirstBulbasaur)

- **Order:** Pidgeot (Lv 59), Alakazam (Lv 57), Rhydon (Lv 59), Gyarados (Lv 59), Arcanine (Lv 61), Venusaur (Lv 63). Lead with Jolteon: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Alakazam, which beats 2 of your 6. Your last one standing: Alakazam.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Pidgeot L59 | Aerial Ace · Feather Dance · Sand Attack · Whirlwind | Jolteon: Thunderbolt 119.5-140.5% | Blastoise: Ice Beam 65.9-77.8% | — |
| Alakazam L57 | Psychic · Future Sight · Recover · Reflect | Alakazam: Fire Punch 41.5-49% | Charizard: Overheat 97.3-115% | — |
| Rhydon L59 | Take Down · Earthquake · Rock Tomb · Scary Face | Blastoise: Surf 238.4-280.6% | Venusaur: Petal Dance 199.5-235.1% | Jolteon |
| Gyarados L59 | Hydro Pump · Dragon Rage · Bite · Thrash | Jolteon: Thunderbolt 168.8-199% | Venusaur: Sludge Bomb 38.7-45.7% | — |
| Arcanine L61 | Extreme Speed · Flamethrower · Roar · Bite | Blastoise: Surf 79.9-94.5% | Alakazam: Psychic 53.8-63.8% | — |
| Venusaur L63 | Solar Beam · Synthesis · Sunny Day · Growth @ Sitrus Berry | Alakazam: Psychic 90.7-106.7% | Venusaur: Sludge Bomb 35.8-42.5% | — |

**Pidgeot L59**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Aerial Ace (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp).
- **Against moves:** Keen Eye: its accuracy can't be lowered. If you set up, it forces you out with Whirlwind.
- **How to attack it:** Hit it with Electric, Ice and Rock. The call: Jolteon: Thunderbolt 119.5-140.5%. Backup: Blastoise: Ice Beam 65.9-77.8%. Its blind spot: Charizard, Blastoise and Jolteon take almost nothing from it.

**Alakazam L57**

- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Psychic (its best hit on Charizard, Blastoise, Venusaur, Jolteon and Machamp). Otherwise: Future Sight against Alakazam.
- **When it's behind:** When it's low, it heals itself with Recover.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Alakazam: Fire Punch 41.5-49%. Backup: Charizard: Overheat 97.3-115%. Its blind spot: Alakazam takes almost nothing from it.

**Rhydon L59**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Rock Tomb against Charizard.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice, Steel and Water. The call: Blastoise: Surf 238.4-280.6%. Backup: Venusaur: Petal Dance 199.5-235.1%. Keep Jolteon away from it: one hit and they're gone.

**Gyarados L59**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Thrash (its best hit on Venusaur, Alakazam and Jolteon). Otherwise: Hydro Pump against Charizard and Machamp; Dragon Rage against Blastoise. Hits from both sides (Thrash physical, Hydro Pump and Bite special): no single wall stops it.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric and Rock. The call: Jolteon: Thunderbolt 168.8-199%. Backup: Venusaur: Sludge Bomb 38.7-45.7%. Its blind spot: Blastoise, Venusaur and Machamp take almost nothing from it.

**Arcanine L61**

- **Tendencies:** Moves first against Charizard, Blastoise, Venusaur and Machamp. Its go-to: Flamethrower (its best hit on Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Extreme Speed against Charizard and Blastoise. Hits from both sides (Extreme Speed physical, Flamethrower and Bite special): no single wall stops it.
- **When it's ahead:** Once you're low, Extreme Speed finishes you.
- **Against moves:** Intimidate: your Attack drops the moment it comes in. If you set up, it forces you out with Roar.
- **How to attack it:** Hit it with Ground, Rock and Water. The call: Blastoise: Surf 79.9-94.5%. Backup: Alakazam: Psychic 53.8-63.8%. Its blind spot: Charizard and Blastoise take almost nothing from it.

**Venusaur L63**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Solar Beam (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Holds Sitrus Berry: it heals once when it drops to half.
- **When it's ahead:** Given a free turn, it sets up with Growth.
- **When it's behind:** When it's low, it heals itself with Synthesis.
- **Against moves:** Overgrow: Grass moves hit harder when it's low.
- **How to attack it:** Hit it with Fire, Ice and Psychic. The call: Alakazam: Psychic 90.7-106.7%. Backup: Venusaur: Sludge Bomb 35.8-42.5%. Its blind spot: Charizard and Venusaur take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Pidgeot | Jolteon (W) | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace |
| Alakazam | Alakazam (W) | Calm Mind / Future Sight | Fire Punch / Future Sight | Fire Punch / Future Sight | Fire Punch / Future Sight | Fire Punch / Recover | Fire Punch / Future Sight | Fire Punch / Future Sight |
| Rhydon | Blastoise (W) | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake |
| Gyarados | Jolteon (W) | Thunderbolt / Thrash | Thunderbolt / Thrash | Thunderbolt / Thrash | Thunderbolt / Thrash | Thunderbolt / Thrash | Thunderbolt / Hydro Pump | Thunderbolt / Thrash |
| Arcanine | Blastoise (W) | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed | Surf / Extreme Speed |
| Venusaur | Alakazam (W) | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Synthesis | Psychic / Solar Beam | Psychic / Solar Beam |

### Call sheet vs Champion (rival, Charmander variant) (Lv 63, pret/pokefirered src/data/trainer_parties.h sParty_ChampionFirstCharmander)

- **Order:** Pidgeot (Lv 59), Alakazam (Lv 57), Rhydon (Lv 59), Exeggutor (Lv 59), Gyarados (Lv 61), Charizard (Lv 63). Lead with Jolteon: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Alakazam, which beats 2 of your 6. Your last one standing: Blastoise.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Pidgeot L59 | Aerial Ace · Feather Dance · Sand Attack · Whirlwind | Jolteon: Thunderbolt 119.5-140.5% | Blastoise: Ice Beam 65.9-77.8% | — |
| Alakazam L57 | Psychic · Future Sight · Recover · Reflect | Alakazam: Fire Punch 41.5-49% | Charizard: Overheat 97.3-115% | — |
| Rhydon L59 | Take Down · Earthquake · Rock Tomb · Scary Face | Blastoise: Surf 238.4-280.6% | Venusaur: Petal Dance 199.5-235.1% | Jolteon |
| Exeggutor L59 | Giga Drain · Egg Bomb · Sleep Powder · Light Screen | Venusaur: Sludge Bomb 72.4-85.4% | Jolteon: Bite 50.3-59.3% | — |
| Gyarados L61 | Hydro Pump · Dragon Rage · Bite · Thrash | Jolteon: Thunderbolt 159-187.3% | Venusaur: Sludge Bomb 36.1-42.9% | — |
| Charizard L63 | Fire Blast · Aerial Ace · Slash · Fire Spin @ Sitrus Berry | Blastoise: Surf 77.4-91.6% | Alakazam: Psychic 52.1-61.6% | — |

**Pidgeot L59**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Aerial Ace (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp).
- **Against moves:** Keen Eye: its accuracy can't be lowered. If you set up, it forces you out with Whirlwind.
- **How to attack it:** Hit it with Electric, Ice and Rock. The call: Jolteon: Thunderbolt 119.5-140.5%. Backup: Blastoise: Ice Beam 65.9-77.8%. Its blind spot: Charizard, Blastoise and Jolteon take almost nothing from it.

**Alakazam L57**

- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Psychic (its best hit on Charizard, Blastoise, Venusaur, Jolteon and Machamp). Otherwise: Future Sight against Alakazam.
- **When it's behind:** When it's low, it heals itself with Recover.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Alakazam: Fire Punch 41.5-49%. Backup: Charizard: Overheat 97.3-115%. Its blind spot: Alakazam takes almost nothing from it.

**Rhydon L59**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Rock Tomb against Charizard.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice, Steel and Water. The call: Blastoise: Surf 238.4-280.6%. Backup: Venusaur: Petal Dance 199.5-235.1%. Keep Jolteon away from it: one hit and they're gone.

**Exeggutor L59**

- **Tendencies:** You move first, every time. Its go-to: Egg Bomb (its best hit on Charizard, Venusaur, Alakazam and Jolteon). Otherwise: Giga Drain against Blastoise and Machamp. Hits from both sides (Egg Bomb physical, Giga Drain special): no single wall stops it.
- **When it's ahead:** Expect Sleep Powder early.
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Dark, Fire, Ice and Poison. The call: Venusaur: Sludge Bomb 72.4-85.4%. Backup: Jolteon: Bite 50.3-59.3%. Its blind spot: Charizard, Venusaur and Machamp take almost nothing from it.

**Gyarados L61**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Thrash (its best hit on Venusaur, Alakazam and Jolteon). Otherwise: Hydro Pump against Charizard and Machamp; Dragon Rage against Blastoise. Hits from both sides (Thrash physical, Hydro Pump and Bite special): no single wall stops it.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric and Rock. The call: Jolteon: Thunderbolt 159-187.3%. Backup: Venusaur: Sludge Bomb 36.1-42.9%. Its blind spot: Blastoise and Venusaur take almost nothing from it.

**Charizard L63**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Fire Blast (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Hits from both sides (Aerial Ace and Slash physical, Fire Blast special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Electric, Rock and Water. The call: Blastoise: Surf 77.4-91.6%. Backup: Alakazam: Psychic 52.1-61.6%. Its blind spot: Charizard and Blastoise take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Pidgeot | Jolteon (W) | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace | Thunderbolt / Aerial Ace |
| Alakazam | Alakazam (W) | Calm Mind / Future Sight | Fire Punch / Future Sight | Fire Punch / Future Sight | Fire Punch / Future Sight | Fire Punch / Recover | Fire Punch / Future Sight | Fire Punch / Future Sight |
| Rhydon | Blastoise (W) | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake |
| Exeggutor | Venusaur (W) | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb | Sludge Bomb / Egg Bomb |
| Gyarados | Jolteon (W) | Thunderbolt / Thrash | Thunderbolt / Thrash | Thunderbolt / Thrash | Thunderbolt / Thrash | Thunderbolt / Thrash | Thunderbolt / Hydro Pump | Thunderbolt / Thrash |
| Charizard | Blastoise (W) | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast |

### Call sheet vs Lorelei (rematch) (Lv 66, pret/pokefirered src/data/trainer_parties.h sParty_EliteFourLorelei2)

- **Order:** Dewgong (Lv 64), Cloyster (Lv 63), Piloswine (Lv 63), Jynx (Lv 66), Lapras (Lv 66). Lead with Blastoise: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Lapras, which beats 3 of your 6. Your last one standing: Alakazam.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Dewgong L64 | Ice Beam · Surf · Signal Beam · Double Team | Blastoise: Surf 16.7-20.1% | Jolteon: Thunderbolt 83.7-98.6% | — |
| Cloyster L63 | Ice Beam · Surf · Supersonic · Rain Dance | Venusaur: Petal Dance 138.1-162.6% | Alakazam: Psychic 112.3-132.3% | — |
| Piloswine L63 | Blizzard · Earthquake · Double-Edge · Rock Slide | Blastoise: Surf 95.9-112.8% | Venusaur: Petal Dance 80.3-94.5% | — |
| Jynx L66 | Ice Beam · Psychic · Lovely Kiss · Attract | Alakazam: Fire Punch 57.7-68.1% | Blastoise: Surf 37.9-45.1% | — |
| Lapras L66 | Ice Beam · Surf · Psychic · Thunder @ Cheriberry | Jolteon: Thunderbolt 63.4-74.6% | Alakazam: Psychic 35.1-41.4% | — |

**Dewgong L64**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Ice Beam (its best hit on Blastoise, Venusaur, Jolteon and Machamp). Otherwise: Surf against Charizard; Signal Beam against Alakazam. Hits from both sides (Signal Beam physical, Ice Beam and Surf special): no single wall stops it.
- **Against moves:** Thick Fat: Fire and Ice moves only do half.
- **How to attack it:** Hit it with Electric, Fighting, Grass and Rock. The call: Blastoise: Surf 16.7-20.1%. Backup: Jolteon: Thunderbolt 83.7-98.6%. Its blind spot: Blastoise, Jolteon and Machamp take almost nothing from it.

**Cloyster L63**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Ice Beam (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Surf against Charizard.
- **How to attack it:** Hit it with Electric, Fighting, Grass and Rock. The call: Venusaur: Petal Dance 138.1-162.6%. Backup: Alakazam: Psychic 112.3-132.3%. Its blind spot: Blastoise takes almost nothing from it.

**Piloswine L63**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Blastoise, Alakazam, Jolteon and Machamp). Otherwise: Rock Slide against Charizard; Blizzard against Venusaur. Hits from both sides (Earthquake, Double-Edge and Rock Slide physical, Blizzard special): no single wall stops it.
- **How to attack it:** Hit it with Fighting, Fire, Grass, Steel and Water. The call: Blastoise: Surf 95.9-112.8%. Backup: Venusaur: Petal Dance 80.3-94.5%.

**Jynx L66**

- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Ice Beam (its best hit on Charizard, Venusaur, Alakazam and Jolteon). Otherwise: Psychic against Blastoise and Machamp.
- **When it's ahead:** Expect Lovely Kiss early.
- **How to attack it:** Hit it with Dark, Fire, Rock and Steel. The call: Alakazam: Fire Punch 57.7-68.1%. Backup: Blastoise: Surf 37.9-45.1%.

**Lapras L66**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Ice Beam (its best hit on Venusaur, Alakazam and Jolteon). Otherwise: Surf against Charizard; Thunder against Blastoise; Psychic against Machamp.
- **Against moves:** Water Absorb: Water moves heal it instead.
- **How to attack it:** Hit it with Electric, Fighting, Grass and Rock. The call: Jolteon: Thunderbolt 63.4-74.6%. Backup: Alakazam: Psychic 35.1-41.4%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Dewgong | Blastoise (W) | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam | Surf / Ice Beam |
| Cloyster | Venusaur (W) | Petal Dance / Ice Beam | Petal Dance / Ice Beam | Petal Dance / Ice Beam | Petal Dance / Ice Beam | Petal Dance / Ice Beam | Petal Dance / Ice Beam | Petal Dance / Ice Beam |
| Piloswine | Blastoise (W) | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake |
| Jynx | Alakazam (W) | Fire Punch / Ice Beam | Fire Punch / Ice Beam | Fire Punch / Ice Beam | Fire Punch / Ice Beam | Fire Punch / Ice Beam | Fire Punch / Ice Beam | Fire Punch / Ice Beam |
| Lapras | Jolteon (W) | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam | Thunderbolt / Ice Beam |

### Call sheet vs Bruno (rematch) (Lv 68, pret/pokefirered src/data/trainer_parties.h sParty_EliteFourBruno2)

- **Order:** Steelix (Lv 65), Hitmonchan (Lv 65), Hitmonlee (Lv 65), Steelix (Lv 66), Machamp (Lv 68). Lead with Blastoise: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Steelix, which beats 1 of your 6. Your last one standing: Charizard.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Steelix L65 | Earthquake · Iron Tail · Crunch · Rock Tomb | Blastoise: Surf 106.3-125% | Machamp: Cross Chop 60.9-71.9% | — |
| Hitmonchan L65 | Sky Uppercut · Mach Punch · Rock Slide · Counter | Alakazam: Psychic 112.5-132.5% | Venusaur: Sludge Bomb 50.6-60% | — |
| Hitmonlee L65 | Mega Kick · Foresight · Earthquake · Rock Slide | Alakazam: Psychic 112.5-132.5% | Venusaur: Sludge Bomb 66.9-79.4% | — |
| Steelix L66 | Earthquake · Iron Tail · Crunch · Dragon Breath | Blastoise: Surf 101.5-120% | Machamp: Cross Chop 57.9-68.7% | — |
| Machamp L68 | Cross Chop · Earthquake · Brick Break · Rock Slide @ Persimberry | Alakazam: Psychic 96.8-114% | Machamp: Cross Chop 54.3-64.3% | — |

**Steelix L65**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Rock Tomb against Charizard. Hits from both sides (Earthquake, Iron Tail and Rock Tomb physical, Crunch special): no single wall stops it.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Fighting, Fire, Ground and Water. The call: Blastoise: Surf 106.3-125%. Backup: Machamp: Cross Chop 60.9-71.9%. Its blind spot: Blastoise takes almost nothing from it.

**Hitmonchan L65**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Rock Slide (its best hit on Charizard, Venusaur and Alakazam). Otherwise: Sky Uppercut against Blastoise, Jolteon and Machamp.
- **When it's ahead:** Once you're low, Mach Punch finishes you.
- **Against moves:** Keen Eye: its accuracy can't be lowered.
- **How to attack it:** Hit it with Psychic. The call: Alakazam: Psychic 112.5-132.5%. Backup: Venusaur: Sludge Bomb 50.6-60%. Its blind spot: Blastoise and Venusaur take almost nothing from it.

**Hitmonlee L65**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Mega Kick (its best hit on Blastoise, Venusaur, Alakazam and Machamp). Otherwise: Rock Slide against Charizard; Earthquake against Jolteon.
- **Against moves:** Limber: it can't be paralyzed.
- **How to attack it:** Hit it with Psychic. The call: Alakazam: Psychic 112.5-132.5%. Backup: Venusaur: Sludge Bomb 66.9-79.4%.

**Steelix L66**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Iron Tail against Charizard. Hits from both sides (Earthquake and Iron Tail physical, Crunch and Dragon Breath special): no single wall stops it.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Fighting, Fire, Ground and Water. The call: Blastoise: Surf 101.5-120%. Backup: Machamp: Cross Chop 57.9-68.7%. Its blind spot: Charizard and Blastoise take almost nothing from it.

**Machamp L68**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Venusaur, Alakazam and Jolteon). Otherwise: Cross Chop against Blastoise and Machamp; Rock Slide against Charizard.
- **Against moves:** Guts: a status condition makes it hit harder.
- **How to attack it:** Hit it with Psychic. The call: Alakazam: Psychic 96.8-114%. Backup: Machamp: Cross Chop 54.3-64.3%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Steelix | Blastoise (W) | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake |
| Hitmonchan | Alakazam (W) | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide | Psychic / Rock Slide |
| Hitmonlee | Alakazam (W) | Psychic / Mega Kick | Psychic / Mega Kick | Psychic / Mega Kick | Psychic / Earthquake | Psychic / Mega Kick | Psychic / Mega Kick | Psychic / Earthquake |
| Steelix | Blastoise (W) | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake | Surf / Earthquake |
| Machamp | Alakazam (W) | Psychic / Earthquake | Psychic / Earthquake | Psychic / Earthquake | Psychic / Earthquake | Psychic / Earthquake | Psychic / Earthquake | Psychic / Earthquake |

### Call sheet vs Agatha (rematch) (Lv 70, pret/pokefirered src/data/trainer_parties.h sParty_EliteFourAgatha2)

- **Order:** Gengar (Lv 66), Crobat (Lv 66), Misdreavus (Lv 65), Arbok (Lv 68), Gengar (Lv 70). Lead with Alakazam: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Gengar, which beats 2 of your 6. Your last one standing: Charizard.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Gengar L66 | Shadow Ball · Psychic · Confuse Ray · Hypnosis | Alakazam: Psychic 148.6-174.9% | Charizard: Overheat 96.6-113.7% | — |
| Crobat L66 | Sludge Bomb · Air Cutter · Shadow Ball · Confuse Ray | Alakazam: Psychic 117.3-138.5% | Jolteon: Thunderbolt 105.3-124% | — |
| Misdreavus L65 | Shadow Ball · Psychic · Thunderbolt · Attract | Jolteon: Thunderbolt 61.8-72.8% | Blastoise: Surf 50.3-59.5% | — |
| Arbok L68 | Sludge Bomb · Earthquake · Giga Drain · Double Team | Alakazam: Psychic 133.9-157.8% | Venusaur: Earthquake 75.6-88.9% | — |
| Gengar L70 | Shadow Ball · Psychic · Thunderbolt · Sludge Bomb @ Chestoberry | Alakazam: Psychic 131.9-155.7% | Jolteon: Thunderbolt 58.9-69.7% | — |

**Gengar L66**

- **Order:** Leads off.
- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Psychic (its best hit on Charizard, Blastoise, Venusaur and Machamp). Otherwise: Shadow Ball against Alakazam and Jolteon. Hits from both sides (Shadow Ball physical, Psychic special): no single wall stops it.
- **When it's ahead:** Expect Confuse Ray or Hypnosis early.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark and Psychic. The call: Alakazam: Psychic 148.6-174.9%. Backup: Charizard: Overheat 96.6-113.7%. Its blind spot: Charizard, Blastoise and Jolteon take almost nothing from it.

**Crobat L66**

- **Tendencies:** Moves first against Charizard, Blastoise, Venusaur and Machamp. Its go-to: Sludge Bomb (its best hit on Charizard, Blastoise and Jolteon). Otherwise: Air Cutter against Venusaur and Machamp; Shadow Ball against Alakazam.
- **When it's ahead:** Expect Confuse Ray early.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Electric, Ice, Psychic and Rock. The call: Alakazam: Psychic 117.3-138.5%. Backup: Jolteon: Thunderbolt 105.3-124%. Its blind spot: Blastoise takes almost nothing from it.

**Misdreavus L65**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Thunderbolt (its best hit on Charizard and Blastoise). Otherwise: Psychic against Venusaur and Machamp; Shadow Ball against Alakazam and Jolteon. Hits from both sides (Shadow Ball physical, Psychic and Thunderbolt special): no single wall stops it.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark. The call: Jolteon: Thunderbolt 61.8-72.8%. Backup: Blastoise: Surf 50.3-59.5%. Its blind spot: Jolteon takes almost nothing from it.

**Arbok L68**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Sludge Bomb (its best hit on Charizard, Blastoise, Venusaur, Alakazam and Machamp). Otherwise: Earthquake against Jolteon. Hits from both sides (Sludge Bomb and Earthquake physical, Giga Drain special): no single wall stops it.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Ground and Psychic. The call: Alakazam: Psychic 133.9-157.8%. Backup: Venusaur: Earthquake 75.6-88.9%. Its blind spot: Blastoise takes almost nothing from it.

**Gengar L70**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Thunderbolt (its best hit on Charizard and Blastoise). Otherwise: Psychic against Venusaur and Machamp; Shadow Ball against Alakazam; Sludge Bomb against Jolteon. Hits from both sides (Shadow Ball and Sludge Bomb physical, Psychic and Thunderbolt special): no single wall stops it.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Dark and Psychic. The call: Alakazam: Psychic 131.9-155.7%. Backup: Jolteon: Thunderbolt 58.9-69.7%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Gengar | Alakazam (W) | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball |
| Crobat | Alakazam (W) | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball |
| Misdreavus | Jolteon (W) | Thunderbolt / Shadow Ball | Thunderbolt / Shadow Ball | Thunderbolt / Shadow Ball | Thunderbolt / Shadow Ball | Thunderbolt / Shadow Ball | Thunderbolt / Psychic | Thunderbolt / Shadow Ball |
| Arbok | Alakazam (W) | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Sludge Bomb |
| Gengar | Alakazam (W) | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball | Psychic / Shadow Ball |

### Call sheet vs Lance (rematch) (Lv 72, pret/pokefirered src/data/trainer_parties.h sParty_EliteFourLance2)

- **Order:** Gyarados (Lv 68), Dragonite (Lv 66), Kingdra (Lv 66), Aerodactyl (Lv 70), Dragonite (Lv 72). Lead with Jolteon: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Dragonite, which beats 2 of your 6. Your last one standing: Blastoise.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Gyarados L68 | Hyper Beam · Dragon Dance · Earthquake · Thunder Wave | Jolteon: Thunderbolt 161-189.5% | Blastoise: Ice Beam 21.5-25.4% | — |
| Dragonite L66 | Hyper Beam · Earthquake · Dragon Claw · Flamethrower | Alakazam: Ice Punch 108.3-127.8% | Blastoise: Ice Beam 95.8-113% | — |
| Kingdra L66 | Hyper Beam · Dragon Dance · Surf · Ice Beam | Blastoise: Ice Beam 27.7-32.8% | Jolteon: Thunderbolt 50.8-60% | — |
| Aerodactyl L70 | Hyper Beam · Ancient Power · Aerial Ace · Earthquake | Jolteon: Thunderbolt 106.1-124.9% | Blastoise: Surf 86.9-102.3% | — |
| Dragonite L72 | Hyper Beam · Outrage · Thunderbolt · Ice Beam @ Persimberry | Blastoise: Ice Beam 80.9-95.3% | Jolteon: Thunderbolt 36.6-43.4% | — |

**Gyarados L68**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Hyper Beam (its best hit on Charizard, Blastoise, Venusaur, Alakazam and Machamp). Otherwise: Earthquake against Jolteon.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance. Expect Thunder Wave early.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric and Rock. The call: Jolteon: Thunderbolt 161-189.5%. Backup: Blastoise: Ice Beam 21.5-25.4%.

**Dragonite L66**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Hyper Beam (its best hit on Charizard, Blastoise, Venusaur, Alakazam and Machamp). Otherwise: Earthquake against Jolteon. Hits from both sides (Hyper Beam and Earthquake physical, Dragon Claw and Flamethrower special): no single wall stops it.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Ice and Rock. The call: Alakazam: Ice Punch 108.3-127.8%. Backup: Blastoise: Ice Beam 95.8-113%.

**Kingdra L66**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Hyper Beam (its best hit on Blastoise, Alakazam, Jolteon and Machamp). Otherwise: Surf against Charizard; Ice Beam against Venusaur. Hits from both sides (Hyper Beam physical, Surf and Ice Beam special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance.
- **Against moves:** Swift Swim: doubles its Speed in rain.
- **How to attack it:** The call: Blastoise: Ice Beam 27.7-32.8%. Backup: Jolteon: Thunderbolt 50.8-60%. Its blind spot: Blastoise takes almost nothing from it.

**Aerodactyl L70**

- **Tendencies:** Moves first against Charizard, Blastoise, Venusaur and Machamp. Its go-to: Hyper Beam (its best hit on Blastoise and Alakazam). Otherwise: Aerial Ace against Venusaur and Machamp; Ancient Power against Charizard; Earthquake against Jolteon.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Electric, Ice, Rock, Steel and Water. The call: Jolteon: Thunderbolt 106.1-124.9%. Backup: Blastoise: Surf 86.9-102.3%.

**Dragonite L72**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Hyper Beam (its best hit on Charizard, Venusaur, Alakazam, Jolteon and Machamp). Otherwise: Thunderbolt against Blastoise. Hits from both sides (Hyper Beam physical, Outrage, Thunderbolt and Ice Beam special): no single wall stops it.
- **Against moves:** Inner Focus: it never flinches.
- **How to attack it:** Hit it with Ice and Rock. The call: Blastoise: Ice Beam 80.9-95.3%. Backup: Jolteon: Thunderbolt 36.6-43.4%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Gyarados | Jolteon (W) | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake |
| Dragonite | Alakazam (W) | Ice Punch / Hyper Beam | Ice Punch / Hyper Beam | Ice Punch / Hyper Beam | Ice Punch / Earthquake | Ice Punch / Hyper Beam | Ice Punch / Hyper Beam | Ice Punch / Earthquake |
| Kingdra | Blastoise (W) | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam | Ice Beam / Hyper Beam |
| Aerodactyl | Jolteon (W) | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake |
| Dragonite | Blastoise (W) | Ice Beam / Thunderbolt | Ice Beam / Thunderbolt | Ice Beam / Thunderbolt | Ice Beam / Thunderbolt | Ice Beam / Thunderbolt | Ice Beam / Thunderbolt | Ice Beam / Thunderbolt |

### Call sheet vs Champion (rival, Squirtle variant, rematch) (Lv 75, pret/pokefirered src/data/trainer_parties.h sParty_ChampionRematchSquirtle)

- **Order:** Heracross (Lv 72), Alakazam (Lv 73), Tyranitar (Lv 72), Arcanine (Lv 73), Exeggutor (Lv 73), Blastoise (Lv 75). Lead with Alakazam: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Alakazam, which beats 2 of your 6. Your last one standing: Blastoise.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Heracross L72 | Megahorn · Earthquake · Counter · Rock Tomb | Alakazam: Psychic 102.3-120.5% | Blastoise: Surf 37.4-44.3% | — |
| Alakazam L73 | Psychic · Shadow Ball · Calm Mind · Reflect | Jolteon: Thunderbolt 58.9-69.7% | Alakazam: Fire Punch 36.8-43.2% | — |
| Tyranitar L72 | Crunch · Earthquake · Thunderbolt · Aerial Ace | Blastoise: Surf 63.7-75% | Venusaur: Petal Dance 53.2-62.9% | — |
| Arcanine L73 | Extreme Speed · Overheat · Aerial Ace · Iron Tail | Blastoise: Surf 79.3-93.7% | Alakazam: Psychic 53.6-63.3% | — |
| Exeggutor L73 | Giga Drain · Psychic · Sleep Powder · Light Screen | Alakazam: Fire Punch 68-80.3% | Venusaur: Sludge Bomb 67.2-79.5% | — |
| Blastoise L75 | Hydro Pump · Ice Beam · Earthquake · Rain Dance @ Sitrus Berry | Jolteon: Thunderbolt 78.8-92.9% | Alakazam: Psychic 43.8-51.8% | — |

**Heracross L72**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Megahorn (its best hit on Blastoise, Venusaur and Alakazam). Otherwise: Earthquake against Jolteon and Machamp; Rock Tomb against Charizard.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire and Psychic. The call: Alakazam: Psychic 102.3-120.5%. Backup: Blastoise: Surf 37.4-44.3%. Keep Alakazam away from it: one hit and they're gone.

**Alakazam L73**

- **Tendencies:** Moves first against Charizard, Blastoise, Venusaur and Machamp. Its go-to: Psychic (its best hit on Charizard, Blastoise, Venusaur, Jolteon and Machamp). Otherwise: Shadow Ball against Alakazam. Hits from both sides (Shadow Ball physical, Psychic special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Calm Mind.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Jolteon: Thunderbolt 58.9-69.7%. Backup: Alakazam: Fire Punch 36.8-43.2%.

**Tyranitar L72**

- **Tendencies:** You move first, every time. Its go-to: Thunderbolt (its best hit on Charizard and Blastoise). Otherwise: Aerial Ace against Venusaur and Machamp; Crunch against Alakazam; Earthquake against Jolteon. Hits from both sides (Earthquake and Aerial Ace physical, Crunch and Thunderbolt special): no single wall stops it.
- **Against moves:** Sand Stream: it brings a sandstorm.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Steel and Water. The call: Blastoise: Surf 63.7-75%. Backup: Venusaur: Petal Dance 53.2-62.9%.

**Arcanine L73**

- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Overheat (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Hits from both sides (Extreme Speed, Aerial Ace and Iron Tail physical, Overheat special): no single wall stops it.
- **When it's ahead:** Once you're low, Extreme Speed finishes you.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Ground, Rock and Water. The call: Blastoise: Surf 79.3-93.7%. Backup: Alakazam: Psychic 53.6-63.3%. Its blind spot: Charizard and Blastoise take almost nothing from it.

**Exeggutor L73**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Charizard, Venusaur, Jolteon and Machamp). Otherwise: Giga Drain against Blastoise and Alakazam.
- **When it's ahead:** Expect Sleep Powder early.
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Dark, Fire, Ice and Poison. The call: Alakazam: Fire Punch 68-80.3%. Backup: Venusaur: Sludge Bomb 67.2-79.5%.

**Blastoise L75**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Hydro Pump (its best hit on Charizard, Alakazam and Machamp). Otherwise: Earthquake against Blastoise and Jolteon; Ice Beam against Venusaur. Hits from both sides (Earthquake physical, Hydro Pump and Ice Beam special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Torrent: Water moves hit harder when it's low.
- **How to attack it:** Hit it with Electric and Grass. The call: Jolteon: Thunderbolt 78.8-92.9%. Backup: Alakazam: Psychic 43.8-51.8%. Its blind spot: Blastoise takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Heracross | Alakazam (W) | Psychic / Megahorn | Psychic / Megahorn | Psychic / Megahorn | Psychic / Earthquake | Psychic / Megahorn | Psychic / Megahorn | Psychic / Earthquake |
| Alakazam | Jolteon (W) | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic |
| Tyranitar | Blastoise (W) | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt |
| Arcanine | Blastoise (W) | Surf / Overheat | Surf / Overheat | Surf / Overheat | Surf / Overheat | Surf / Overheat | Surf / Overheat | Surf / Overheat |
| Exeggutor | Alakazam (W) | Calm Mind / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain |
| Blastoise | Jolteon (W) | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Hydro Pump | Thunderbolt / Earthquake |

### Call sheet vs Champion (rival, Bulbasaur variant, rematch) (Lv 75, pret/pokefirered src/data/trainer_parties.h sParty_ChampionRematchBulbasaur)

- **Order:** Heracross (Lv 72), Alakazam (Lv 73), Tyranitar (Lv 72), Gyarados (Lv 73), Arcanine (Lv 73), Venusaur (Lv 75). Lead with Alakazam: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Alakazam, which beats 2 of your 6. Your last one standing: Charizard.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Heracross L72 | Megahorn · Earthquake · Counter · Rock Tomb | Alakazam: Psychic 102.3-120.5% | Blastoise: Surf 37.4-44.3% | — |
| Alakazam L73 | Psychic · Shadow Ball · Calm Mind · Reflect | Jolteon: Thunderbolt 58.9-69.7% | Alakazam: Fire Punch 36.8-43.2% | — |
| Tyranitar L72 | Crunch · Earthquake · Thunderbolt · Aerial Ace | Blastoise: Surf 63.7-75% | Venusaur: Petal Dance 53.2-62.9% | — |
| Gyarados L73 | Hydro Pump · Dragon Dance · Earthquake · Hyper Beam | Jolteon: Thunderbolt 155.7-183.6% | Blastoise: Ice Beam 21.3-25.4% | — |
| Arcanine L73 | Extreme Speed · Overheat · Aerial Ace · Iron Tail | Blastoise: Surf 79.3-93.7% | Alakazam: Psychic 53.6-63.3% | — |
| Venusaur L75 | Solar Beam · Sludge Bomb · Earthquake · Sunny Day @ Sitrus Berry | Alakazam: Psychic 89.9-106.1% | Machamp: Earthquake 37.7-44.7% | — |

**Heracross L72**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Megahorn (its best hit on Blastoise, Venusaur and Alakazam). Otherwise: Earthquake against Jolteon and Machamp; Rock Tomb against Charizard.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire and Psychic. The call: Alakazam: Psychic 102.3-120.5%. Backup: Blastoise: Surf 37.4-44.3%. Keep Alakazam away from it: one hit and they're gone.

**Alakazam L73**

- **Tendencies:** Moves first against Charizard, Blastoise, Venusaur and Machamp. Its go-to: Psychic (its best hit on Charizard, Blastoise, Venusaur, Jolteon and Machamp). Otherwise: Shadow Ball against Alakazam. Hits from both sides (Shadow Ball physical, Psychic special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Calm Mind.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Jolteon: Thunderbolt 58.9-69.7%. Backup: Alakazam: Fire Punch 36.8-43.2%.

**Tyranitar L72**

- **Tendencies:** You move first, every time. Its go-to: Thunderbolt (its best hit on Charizard and Blastoise). Otherwise: Aerial Ace against Venusaur and Machamp; Crunch against Alakazam; Earthquake against Jolteon. Hits from both sides (Earthquake and Aerial Ace physical, Crunch and Thunderbolt special): no single wall stops it.
- **Against moves:** Sand Stream: it brings a sandstorm.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Steel and Water. The call: Blastoise: Surf 63.7-75%. Backup: Venusaur: Petal Dance 53.2-62.9%.

**Gyarados L73**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Hyper Beam (its best hit on Blastoise, Venusaur, Alakazam and Machamp). Otherwise: Hydro Pump against Charizard; Earthquake against Jolteon. Hits from both sides (Earthquake and Hyper Beam physical, Hydro Pump special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric and Rock. The call: Jolteon: Thunderbolt 155.7-183.6%. Backup: Blastoise: Ice Beam 21.3-25.4%.

**Arcanine L73**

- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Overheat (its best hit on Charizard, Blastoise, Venusaur, Alakazam, Jolteon and Machamp). Hits from both sides (Extreme Speed, Aerial Ace and Iron Tail physical, Overheat special): no single wall stops it.
- **When it's ahead:** Once you're low, Extreme Speed finishes you.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Ground, Rock and Water. The call: Blastoise: Surf 79.3-93.7%. Backup: Alakazam: Psychic 53.6-63.3%. Its blind spot: Charizard and Blastoise take almost nothing from it.

**Venusaur L75**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Solar Beam (its best hit on Blastoise, Alakazam and Machamp). Otherwise: Sludge Bomb against Charizard and Venusaur; Earthquake against Jolteon. Hits from both sides (Sludge Bomb and Earthquake physical, Solar Beam special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Overgrow: Grass moves hit harder when it's low.
- **How to attack it:** Hit it with Fire, Ice and Psychic. The call: Alakazam: Psychic 89.9-106.1%. Backup: Machamp: Earthquake 37.7-44.7%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Heracross | Alakazam (W) | Psychic / Megahorn | Psychic / Megahorn | Psychic / Megahorn | Psychic / Earthquake | Psychic / Megahorn | Psychic / Megahorn | Psychic / Earthquake |
| Alakazam | Jolteon (W) | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic |
| Tyranitar | Blastoise (W) | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt |
| Gyarados | Jolteon (W) | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake |
| Arcanine | Blastoise (W) | Surf / Overheat | Surf / Overheat | Surf / Overheat | Surf / Overheat | Surf / Overheat | Surf / Overheat | Surf / Overheat |
| Venusaur | Alakazam (W) | Psychic / Solar Beam | Psychic / Solar Beam | Psychic / Sludge Bomb | Psychic / Sludge Bomb | Psychic / Solar Beam | Psychic / Sludge Bomb | Psychic / Sludge Bomb |

### Call sheet vs Champion (rival, Charmander variant, rematch) (Lv 75, pret/pokefirered src/data/trainer_parties.h sParty_ChampionRematchCharmander)

- **Order:** Heracross (Lv 72), Alakazam (Lv 73), Tyranitar (Lv 72), Exeggutor (Lv 73), Gyarados (Lv 73), Charizard (Lv 75). Lead with Alakazam: it handles their opener. It stays in unless Perish Song is about to end, it can't touch a Wonder Guard, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you. Their best player: Alakazam, which beats 2 of your 6. Your last one standing: Blastoise.

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Heracross L72 | Megahorn · Earthquake · Counter · Rock Tomb | Alakazam: Psychic 102.3-120.5% | Blastoise: Surf 37.4-44.3% | — |
| Alakazam L73 | Psychic · Shadow Ball · Calm Mind · Reflect | Jolteon: Thunderbolt 58.9-69.7% | Alakazam: Fire Punch 36.8-43.2% | — |
| Tyranitar L72 | Crunch · Earthquake · Thunderbolt · Aerial Ace | Blastoise: Surf 63.7-75% | Venusaur: Petal Dance 53.2-62.9% | — |
| Exeggutor L73 | Giga Drain · Psychic · Sleep Powder · Light Screen | Alakazam: Fire Punch 68-80.3% | Venusaur: Sludge Bomb 67.2-79.5% | — |
| Gyarados L73 | Hydro Pump · Dragon Dance · Earthquake · Hyper Beam | Jolteon: Thunderbolt 155.7-183.6% | Blastoise: Ice Beam 21.3-25.4% | — |
| Charizard L75 | Fire Blast · Dragon Claw · Aerial Ace · Earthquake @ Sitrus Berry | Blastoise: Surf 77.8-91.6% | Jolteon: Thunderbolt 93.3-110.2% | — |

**Heracross L72**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Machamp. Its go-to: Megahorn (its best hit on Blastoise, Venusaur and Alakazam). Otherwise: Earthquake against Jolteon and Machamp; Rock Tomb against Charizard.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire and Psychic. The call: Alakazam: Psychic 102.3-120.5%. Backup: Blastoise: Surf 37.4-44.3%. Keep Alakazam away from it: one hit and they're gone.

**Alakazam L73**

- **Tendencies:** Moves first against Charizard, Blastoise, Venusaur and Machamp. Its go-to: Psychic (its best hit on Charizard, Blastoise, Venusaur, Jolteon and Machamp). Otherwise: Shadow Ball against Alakazam. Hits from both sides (Shadow Ball physical, Psychic special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Calm Mind.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Jolteon: Thunderbolt 58.9-69.7%. Backup: Alakazam: Fire Punch 36.8-43.2%.

**Tyranitar L72**

- **Tendencies:** You move first, every time. Its go-to: Thunderbolt (its best hit on Charizard and Blastoise). Otherwise: Aerial Ace against Venusaur and Machamp; Crunch against Alakazam; Earthquake against Jolteon. Hits from both sides (Earthquake and Aerial Ace physical, Crunch and Thunderbolt special): no single wall stops it.
- **Against moves:** Sand Stream: it brings a sandstorm.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Steel and Water. The call: Blastoise: Surf 63.7-75%. Backup: Venusaur: Petal Dance 53.2-62.9%.

**Exeggutor L73**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Charizard, Venusaur, Jolteon and Machamp). Otherwise: Giga Drain against Blastoise and Alakazam.
- **When it's ahead:** Expect Sleep Powder early.
- **Against moves:** Chlorophyll: doubles its Speed in sun.
- **How to attack it:** Hit it with Dark, Fire, Ice and Poison. The call: Alakazam: Fire Punch 68-80.3%. Backup: Venusaur: Sludge Bomb 67.2-79.5%.

**Gyarados L73**

- **Tendencies:** Gets the jump on Machamp. Its go-to: Hyper Beam (its best hit on Blastoise, Venusaur, Alakazam and Machamp). Otherwise: Hydro Pump against Charizard; Earthquake against Jolteon. Hits from both sides (Earthquake and Hyper Beam physical, Hydro Pump special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Dragon Dance.
- **Against moves:** Intimidate: your Attack drops the moment it comes in.
- **How to attack it:** Hit it with Electric and Rock. The call: Jolteon: Thunderbolt 155.7-183.6%. Backup: Blastoise: Ice Beam 21.3-25.4%.

**Charizard L75**

- **Order:** Last in the order.
- **Tendencies:** Moves first against Blastoise, Venusaur and Machamp. Its go-to: Fire Blast (its best hit on Charizard, Blastoise, Venusaur, Alakazam and Machamp). Otherwise: Earthquake against Jolteon. Hits from both sides (Aerial Ace and Earthquake physical, Fire Blast and Dragon Claw special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Electric, Rock and Water. The call: Blastoise: Surf 77.8-91.6%. Backup: Jolteon: Thunderbolt 93.3-110.2%. Its blind spot: Charizard and Blastoise take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Heracross | Alakazam (W) | Psychic / Megahorn | Psychic / Megahorn | Psychic / Megahorn | Psychic / Earthquake | Psychic / Megahorn | Psychic / Megahorn | Psychic / Earthquake |
| Alakazam | Jolteon (W) | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic | Thunderbolt / Psychic |
| Tyranitar | Blastoise (W) | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt | Surf / Thunderbolt |
| Exeggutor | Alakazam (W) | Calm Mind / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain | Fire Punch / Giga Drain |
| Gyarados | Jolteon (W) | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake | Thunderbolt / Earthquake |
| Charizard | Blastoise (W) | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast | Surf / Fire Blast |

