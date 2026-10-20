# Scouting packet: Platinum (initiative)

*Roster status: working (D-005). No grades: every line below is a phrase from the phrase book (engine/battle/phrasebook.json), triggered by numbers the engine measures, the way the games turn a Pokémon's best IV into its characteristic. Speed, power and bulk are measured against every fully evolved Pokémon of the same generation. Opponents' philosophy comes from the game's own trainer AI flags, bag and battle lines. Every one-on-one is played out by the scouting engine (docs/SCOUTING_ENGINE.md): our best plan against their best answer, Smogon's calculator for every hit at the lowest roll, every move landing, the odds kept. Against a game's trainers we meet them at their top level; the coach profile is measured against that generation's Smogon OU usage field at Lv 100.*

## Self-scout

### Coach profile

Against the Gen 4 OU usage field (73 Smogon sets): **adaptive (p5), no healing (p9), safe (p9)**. 143-15-280 in 438 one-on-ones. A slider is a share of those fights; p is the percentile among 2,000 random six-Pokémon teams drawn from the field.

| Slider | ◀ | Value | ▶ | Percentile |
|---|---|---|---|---|
| Pace | absorbs first | 55 | strikes first | p40 |
| Punch | chips | 53 | knocks out | p36 |
| Run / pass | special | 59 | physical | p44 |
| Build-up | hits now | 10 | builds first | p80 |
| Sustain | no healing | 0 | heals and resets | p9 |
| Disruption | straight-up | 10 | disruptive | p65 |
| Risk | safe | 11 | gambler | p9 |
| Script | adaptive | 41 | scripted | p5 |

| Player | W-D-L | Pace | Punch | Run / pass | Build-up | Sustain | Disruption | Risk | Script |
|---|---|---|---|---|---|---|---|---|---|
| Infernape | 25-3-45 | 59 (p55) | 62 (p44) | 55 (p38) | 0 (p41) | 0 (p38) | 0 (p35) | 0 (p3) | 44 (p41) |
| Weavile | 18-5-50 | 77 (p75) | 45 (p34) | 100 (p74) | 0 (p41) | 0 (p38) | 0 (p35) | 0 (p3) | 38 (p17) |
| Roserade | 42-1-30 | 55 (p47) | 64 (p51) | 0 (p16) | 0 (p41) | 0 (p38) | 58 (p99) | 67 (p90) | 56 (p78) |
| Lucario | 15-0-58 | 44 (p29) | 45 (p34) | 100 (p74) | 27 (p90) | 0 (p38) | 0 (p35) | 0 (p3) | 27 (p1) |
| Garchomp | 21-5-47 | 60 (p57) | 49 (p34) | 100 (p74) | 0 (p41) | 0 (p38) | 0 (p35) | 1 (p20) | 51 (p56) |
| Magnezone | 22-1-50 | 36 (p21) | 55 (p37) | 0 (p16) | 30 (p90) | 0 (p38) | 0 (p35) | 0 (p3) | 32 (p5) |

**Play sheet** (its most common call in each situation, against the field):

| Player | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|
| Infernape | Flamethrower (52%) | Flamethrower (52%) | Flamethrower (51%) | Flamethrower (48%) | Flamethrower (63%) | Flamethrower (53%) | Flamethrower (62%) |
| Weavile | Ice Punch (45%) | Ice Punch (45%) | Ice Punch (42%) | Ice Punch (36%) | Ice Punch (45%) | Ice Punch (45%) | Ice Punch (37%) |
| Roserade | Sleep Powder (56%) | Leaf Storm (68%) | Leaf Storm (64%) | Sludge Bomb (67%) | Leaf Storm (68%) | Leaf Storm (68%) | Sludge Bomb (59%) |
| Lucario | Close Combat (32%) | Close Combat (48%) | Close Combat (42%) | Close Combat (45%) | Close Combat (48%) | Close Combat (48%) | Close Combat (34%) |
| Garchomp | Earthquake (56%) | Earthquake (56%) | Earthquake (56%) | Earthquake (59%) | Earthquake (56%) | Earthquake (56%) | Earthquake (58%) |
| Magnezone | Thunderbolt (52%) | Thunderbolt (68%) | Thunderbolt (68%) | Thunderbolt (68%) | Thunderbolt (68%) | Thunderbolt (68%) | Thunderbolt (68%) |

*Assumed where nothing is on record: EVs 85 in every stat; IVs 31; ability Magnet Pull (could be Sturdy); ability Natural Cure (could be Poison Point); ability Steadfast (could be Inner Focus); level 100 (the peak); neutral nature.*

- **What we're trying to do:** Hit hard every turn and trade well. The anchor: Garchomp.
- **What we're good at:** 10 attack types in the repertoire. The main ones: Fire (Garchomp, Infernape and Magnezone), Electric (Infernape and Magnezone), Ice (Lucario and Weavile) and Fighting (Infernape and Lucario). Nothing is safe: 16 of 17 types take super-effective hits from this club. Weavile sets the pace; Magnezone expects to take the first hit. Closers: Infernape and Weavile. Status: Roserade.
- **Where we're soft:** Shared holes: Fire (Weavile, Roserade, Lucario and Magnezone), Fighting (Weavile, Lucario and Magnezone) and Ground (Infernape, Lucario and Magnezone).

| Attack type | Who throws it |
|---|---|
| Fire | Infernape (Flamethrower), Garchomp (Fire Fang), Magnezone (Hidden Power Fire) |
| Electric | Infernape (Thunder Punch), Magnezone (Thunderbolt) |
| Ice | Weavile (Ice Punch), Weavile (Ice Shard), Lucario (Ice Punch) |
| Fighting | Infernape (Close Combat), Infernape (Mach Punch), Lucario (Close Combat) |
| Poison | Roserade (Sludge Bomb), Garchomp (Poison Jab) |
| Ground | Lucario (Earthquake), Garchomp (Earthquake) |
| Grass | Roserade (Leaf Storm) |
| Dragon | Garchomp (Dragon Claw) |
| Dark | Weavile (Night Slash) |
| Steel | Magnezone (Flash Cannon) |

## Depth chart

| Player | Philosophy | 1v1 vs the league | Build |
|---|---|---|---|
| **Garchomp** | Strike first and strike hard. | 52-0 | accepted working direction (D-016); 4th slot evaluative |
| **Infernape** | Finish what the others start: Mach Punch cleans up after the damage is done. | 40-12 | accepted working direction (D-015) |
| **Roserade** | Weaken first, win later: Sleep Powder before the real swings. | 39-13 | historical (sheet), not reaffirmed |
| **Lucario** | Win on momentum: take one free turn for Swords Dance, then everything goes through. | 38-14 | no build on record: the engine filled in its strongest set |
| **Weavile** | Strike first and strike hard. | 31-21 | historical (sheet), not reaffirmed |
| **Magnezone** | Straight ahead: the best hit, every turn. | 31-21 | historical (sheet), not reaffirmed |

## Scouting reports

### Infernape (Fire/Fighting), Platinum
*Close Combat / Flamethrower / Mach Punch / Thunder Punch · Blaze · build: accepted working direction (D-015)*

- **Philosophy:** Finish what the others start: Mach Punch cleans up after the damage is done.
- **Tendencies:** Usually swings first: 89% of its generation is slower. Hits from both sides (Close Combat, Mach Punch and Thunder Punch physical, Flamethrower special). Its nature isn't set yet, and the wrong one blunts half the set. Out pitch: Close Combat.
- **When it's ahead:** Ahead, it keeps throwing Close Combat. With the other side low, Mach Punch closes the door before they can answer.
- **When it's behind:** Behind, it swings for the KO and hopes it lands first. Even low, Mach Punch gets one more hit in first. Low on HP, Blaze kicks in and its same-type hits get stronger.
- **Against types:** Feeds on Bug, Dark, Flying, Grass, Ice, Normal, Rock, Steel and Water. Look out for Water (×2), Ground (×2), Flying (×2) and Psychic (×2).
- **How you beat it:** Hit it with something it can't hit back: Alakazam, Espeon, Salamence and Garchomp are the classic answers.
- **Production:** Won 40 of 52 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Lucario, Arcanine and Charizard. Pokédex, Platinum: “It uses unique fighting moves with fire on its hands and feet. It will take on any opponent.”

### Weavile (Dark/Ice), Platinum
*Ice Punch / Night Slash / Low Kick / Ice Shard · Jolly · Pressure · build: historical (sheet), not reaffirmed*

- **Philosophy:** Strike first and strike hard.
- **Tendencies:** Rarely gets outrun: faster than 96% of the fully evolved Pokémon in its generation. Every attack runs off its Attack stat. Out pitch: Ice Punch. Glass on one side: it can't afford to take many hits there.
- **When it's ahead:** Ahead, it keeps throwing Ice Punch. With the other side low, Ice Shard closes the door before they can answer.
- **When it's behind:** Behind, it has no way back. Get it out before it's caught low. Even low, Ice Shard gets one more hit in first.
- **Against types:** Feeds on Dragon, Flying, Ghost, Grass, Ground and Psychic. Struggles to hurt Steel. One fatal hole: Fighting hits it four times as hard. Look out for Fighting (×4), Fire (×2), Bug (×2), Rock (×2) and Steel (×2). A free switch-in against Psychic.
- **Against moves:** Pressure: your moves burn extra PP.
- **How you beat it:** Hit it with something it can't hit back: Infernape, Heracross, Hitmonlee and Gallade are the classic answers.
- **Production:** Broke about even against the league (31-21).
- **Makeup:** Plays like Aerodactyl, Ambipom and Primeape. Pokédex, Platinum: “Evolution made it even more devious. It communicates by clawing signs in boulders.”

### Roserade (Grass/Poison), Platinum
*Leaf Storm / Sludge Bomb / Sleep Powder / Toxic Spikes · Timid · Natural Cure · @ Focus Sash · build: historical (sheet), not reaffirmed*

- **Philosophy:** Weaken first, win later: Sleep Powder before the real swings.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Every attack runs off its Sp. Atk. Out pitch: Leaf Storm. Glass on one side: it can't afford to take many hits there. Holds Focus Sash: from full health it survives any single hit.
- **When it's ahead:** Ahead, it spends the lead on Sleep Powder.
- **When it's behind:** Behind, it has no way back. Get it out before it's caught low.
- **Against types:** Feeds on Grass, Ground, Rock and Water. Struggles to hurt Poison and Steel. Look out for Fire (×2), Ice (×2), Flying (×2) and Psychic (×2).
- **Against moves:** Natural Cure: switching out cures its status. Toxic and poison do nothing to it.
- **How you beat it:** Hit it with something it can't hit back: Alakazam, Ninjask, Weavile and Espeon are the classic answers.
- **Production:** Won 39 of 52 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Gardevoir, Gengar and Espeon. Pokédex, Platinum: “Each of its hands contains different toxins, but both hands can jab with near-fatal power.”

### Lucario (Fighting/Steel), Platinum
*Close Combat / Ice Punch / Earthquake / Swords Dance · Steadfast · build: no build on record: the engine filled in its strongest set*

- **Philosophy:** Win on momentum: take one free turn for Swords Dance, then everything goes through.
- **Tendencies:** Middle of the pack on speed: who hits first depends on the matchup. Every attack runs off its Attack stat. Out pitch: Close Combat.
- **When it's ahead:** Ahead, it takes the free turn for Swords Dance.
- **When it's behind:** Behind, it swings for the KO and hopes it lands first.
- **Against types:** Feeds on Dark, Dragon, Electric, Fire, Flying, Grass, Ground, Ice, Normal, Poison, Rock and Steel. Look out for Fire (×2), Fighting (×2) and Ground (×2). A free switch-in against Poison.
- **Against moves:** Steadfast: flinching makes it faster. Toxic and poison do nothing to it.
- **How you beat it:** Hit it with something it can't hit back: Heracross, Charizard, Hitmonlee and Gallade are the classic answers.
- **Production:** Won 38 of 52 one-on-ones against the league. A reliable starter.
- **Makeup:** Plays like Blaziken, Infernape and Toxicroak. Pokédex, Platinum: “A well-trained one can sense auras to identify and take in the feelings of creatures over half a mile away.”

### Garchomp (Dragon/Ground), Platinum
*Earthquake / Dragon Claw / Fire Fang / Poison Jab · Sand Veil · build: accepted working direction (D-016); 4th slot evaluative*

- **Philosophy:** Strike first and strike hard.
- **Tendencies:** Usually swings first: 87% of its generation is slower. Every attack runs off its Attack stat. Out pitch: Earthquake. Raw power near the top of its generation. Hard to move from either side: top-quarter bulk against physical and special hits.
- **When it's ahead:** Ahead, it keeps throwing Earthquake.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Bug, Dragon, Electric, Fire, Grass, Ice, Poison, Rock and Steel. One fatal hole: Ice hits it four times as hard. Look out for Ice (×4) and Dragon (×2). A free switch-in against Electric.
- **Against moves:** Sand Veil: harder to hit in a sandstorm.
- **How you beat it:** Hit it with something it can't hit back: Cloyster, Walrein, Lapras and Dewgong are the classic answers.
- **Production:** Won 52 of 52 one-on-ones against the league. An anchor.
- **Makeup:** Plays like Salamence, Dragonite and Mamoswine. Pokédex, Platinum: “It is said that when one runs at high speed, its wings create blades of wind that can fell nearby trees.”

### Magnezone (Electric/Steel), Platinum
*Thunderbolt / Hidden Power Fire / Flash Cannon / Substitute · Modest · Magnet Pull · build: historical (sheet), not reaffirmed*

- **Philosophy:** Straight ahead: the best hit, every turn.
- **Tendencies:** Expects to take the first hit: only 26% of its generation is slower. Every attack runs off its Sp. Atk. Out pitch: Thunderbolt. Raw power near the top of its generation. Built for contact: it takes physical hits much better than special ones.
- **When it's ahead:** Ahead, it keeps throwing Thunderbolt.
- **When it's behind:** Even behind, it can eat one more hit.
- **Against types:** Feeds on Bug, Flying, Grass, Ice, Rock, Steel and Water. One fatal hole: Ground hits it four times as hard. Look out for Ground (×4), Fire (×2) and Fighting (×2). A free switch-in against Poison.
- **Against moves:** Magnet Pull: Steel types can't escape it. Toxic and poison do nothing to it.
- **How you beat it:** Hit it with something it can't hit back: Garchomp, Dugtrio, Flygon and Gliscor are the classic answers.
- **Production:** Broke about even against the league (31-21).
- **Makeup:** Plays like Glaceon, Heatran and Empoleon. Pokédex, Platinum: “A group tried to use scientific means to make MAGNEZONE evolve, but their efforts ended in failure.”

## Call sheets

### Call sheet vs Aaron (Lv 53, pret/pokeplatinum res/trainers/data/elite_four_aaron.json)

- **Order:** Yanmega (Lv 49), Scizor (Lv 49), Vespiquen (Lv 50), Heracross (Lv 51), Drapion (Lv 53). Lead with Infernape: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Heracross, which beats 3 of your 6. Your last one standing: Infernape.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Last Pokémon at half HP: “It’s not over yet! A League Elite Four cannot give up!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Yanmega L49 | Air Slash · Bug Buzz · U-turn · Double Team | Infernape: Flamethrower 137.6-161.8% | Magnezone: Thunderbolt 180.9-214% | — |
| Scizor L49 | Iron Head · X-Scissor · Night Slash · Quick Attack | Infernape: Flamethrower 231-273.2% | Magnezone: Hidden Power Fire 149.3-177.5% | — |
| Vespiquen L50 | Attack Order · Defend Order · Heal Order · Power Gem | Magnezone: Thunderbolt 117.2-140.7% | Lucario: Ice Punch 51-60.7% | — |
| Heracross L51 | Megahorn · Close Combat · Night Slash · Stone Edge | Garchomp: Fire Fang 57.3-68.8% | Infernape: Flamethrower 87.9-104.5% | Weavile, Lucario |
| Drapion L53 | X-Scissor · Cross Poison · Ice Fang · Aerial Ace @ Sitrus Berry | Magnezone: Thunderbolt 68.6-81% | Lucario: Earthquake 57.5-68% | — |

**Yanmega L49**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Air Slash (its best hit on Infernape, Roserade and Lucario). Otherwise: Bug Buzz against Weavile, Garchomp and Magnezone. Hits from both sides (U-turn physical, Air Slash and Bug Buzz special): no single wall stops it.
- **How to attack it:** Hit it with Electric, Fire and Ice. The call: Infernape: Flamethrower 137.6-161.8%. Backup: Magnezone: Thunderbolt 180.9-214%. Its blind spot: Magnezone takes almost nothing from it.

**Scizor L49**

- **Tendencies:** You move first, every time. Its go-to: Iron Head (its best hit on Infernape, Weavile, Roserade, Lucario and Garchomp). Otherwise: X-Scissor against Magnezone.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire. The call: Infernape: Flamethrower 231-273.2%. Backup: Magnezone: Hidden Power Fire 149.3-177.5%. Its blind spot: Infernape, Lucario, Garchomp and Magnezone take almost nothing from it.

**Vespiquen L50**

- **Tendencies:** You move first, every time. Its go-to: Attack Order (its best hit on Weavile, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Power Gem against Infernape. Hits from both sides (Attack Order physical, Power Gem special): no single wall stops it.
- **When it's behind:** When it's low, it heals itself with Heal Order.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** Hit it with Electric, Fire and Ice. The call: Magnezone: Thunderbolt 117.2-140.7%. Backup: Lucario: Ice Punch 51-60.7%. Its blind spot: Infernape, Lucario, Garchomp and Magnezone take almost nothing from it.

**Heracross L51**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Close Combat (its best hit on Infernape, Weavile, Lucario and Magnezone). Otherwise: Megahorn against Roserade and Garchomp.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire. The call: Garchomp: Fire Fang 57.3-68.8%. Backup: Infernape: Flamethrower 87.9-104.5%. Keep Weavile and Lucario away from it: one hit and they're gone.

**Drapion L53**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Aerial Ace (its best hit on Infernape and Lucario). Otherwise: X-Scissor against Weavile and Magnezone; Ice Fang against Roserade and Garchomp. Holds Sitrus Berry: it heals once when it drops to half.
- **How to attack it:** Hit it with Ground. The call: Magnezone: Thunderbolt 68.6-81%. Backup: Lucario: Earthquake 57.5-68%. Its blind spot: Lucario and Magnezone take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Yanmega | Infernape (W) | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash |
| Scizor | Infernape (W) | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head |
| Vespiquen | Magnezone (W) | Thunderbolt / Attack Order | Thunderbolt / Attack Order | Thunderbolt / Attack Order | Thunderbolt / Attack Order | Thunderbolt / Heal Order | Thunderbolt / Attack Order | Thunderbolt / Heal Order |
| Heracross | Garchomp (W) | Dragon Claw / Close Combat | Dragon Claw / Close Combat | Dragon Claw / Close Combat | Dragon Claw / Close Combat | Dragon Claw / Megahorn | Dragon Claw / Close Combat | Dragon Claw / Close Combat |
| Drapion | Magnezone (W) | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor |

### Call sheet vs Bertha (Lv 55, pret/pokeplatinum res/trainers/data/elite_four_bertha.json)

- **Order:** Whiscash (Lv 50), Gliscor (Lv 53), Hippowdon (Lv 52), Golem (Lv 52), Rhyperior (Lv 55). Lead with Garchomp: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Rhyperior, which beats 3 of your 6. Your last one standing: Roserade.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Last Pokémon at half HP: “Dear child, don’t assume for an instant that you’ve won.”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Whiscash L50 | Earth Power · Aqua Tail · Zen Headbutt · Sandstorm | Garchomp: Earthquake 63.2-74.6% | Lucario: Close Combat 66.5-78.4% | — |
| Gliscor L53 | Earthquake · Ice Fang · Fire Fang · Thunder Fang | Weavile: Ice Punch 129.1-151.9% | Infernape: Flamethrower 55.1-65.2% | Magnezone |
| Hippowdon L52 | Earthquake · Stone Edge · Crunch · Yawn | Garchomp: Earthquake 40.2-48.1% | Weavile: Ice Punch 57.1-67.7% | Magnezone |
| Golem L52 | Earthquake · Fire Punch · Thunder Punch · Sandstorm | Magnezone: Flash Cannon 136.3-161.3% | Garchomp: Earthquake 87.5-105% | — |
| Rhyperior L55 | Earthquake · Rock Wrecker · Megahorn · Avalanche @ Sitrus Berry | Magnezone: Flash Cannon 112.5-132.7% | Garchomp: Earthquake 64.4-76% | Weavile, Lucario, Infernape |

**Whiscash L50**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Earth Power (its best hit on Infernape, Lucario, Garchomp and Magnezone). Otherwise: Aqua Tail against Weavile; Zen Headbutt against Roserade. Hits from both sides (Aqua Tail and Zen Headbutt physical, Earth Power special): no single wall stops it.
- **How to attack it:** Hit it with Grass. The call: Garchomp: Earthquake 63.2-74.6%. Backup: Lucario: Close Combat 66.5-78.4%. Its blind spot: Garchomp takes almost nothing from it.

**Gliscor L53**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Earthquake (its best hit on Infernape, Weavile, Roserade, Lucario and Magnezone). Otherwise: Ice Fang against Garchomp.
- **How to attack it:** Hit it with Ice. The call: Weavile: Ice Punch 129.1-151.9%. Backup: Infernape: Flamethrower 55.1-65.2%. Keep Magnezone away from it: one hit and they're gone.

**Hippowdon L52**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Infernape, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Stone Edge against Weavile.
- **When it's ahead:** Expect Yawn early.
- **Against moves:** Sand Stream: it brings a sandstorm.
- **How to attack it:** Hit it with Grass and Ice. The call: Garchomp: Earthquake 40.2-48.1%. Backup: Weavile: Ice Punch 57.1-67.7%. Keep Magnezone away from it: one hit and they're gone.

**Golem L52**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Infernape, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Fire Punch against Weavile.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice and Steel. The call: Magnezone: Flash Cannon 136.3-161.3%. Backup: Garchomp: Earthquake 87.5-105%. Keep Magnezone away from it: one hit and they're gone.

**Rhyperior L55**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Infernape, Lucario and Magnezone). Otherwise: Rock Wrecker against Weavile and Roserade; Avalanche against Garchomp. Holds Sitrus Berry: it heals once when it drops to half.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice and Steel. The call: Magnezone: Flash Cannon 112.5-132.7%. Backup: Garchomp: Earthquake 64.4-76%. Keep Infernape, Weavile, Roserade, Lucario and Magnezone away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Whiscash | Garchomp (W) | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power |
| Gliscor | Weavile (W) | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake |
| Hippowdon | Garchomp (W) | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake |
| Golem | Magnezone (W) | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake |
| Rhyperior | Magnezone (W) | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake |

### Call sheet vs Flint (Lv 57, pret/pokeplatinum res/trainers/data/elite_four_flint.json)

- **Order:** Houndoom (Lv 52), Flareon (Lv 55), Rapidash (Lv 53), Infernape (Lv 55), Magmortar (Lv 57). Lead with Infernape: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Infernape, which beats 4 of your 6. Your last one standing: Garchomp.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “I can feel your determination. Your will is overpowering me!” Last Pokémon at half HP: “This situation... This is heating up! I’m blazing now!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Houndoom L52 | Flamethrower · Sludge Bomb · Dark Pulse · Sunny Day | Infernape: Close Combat 202.6-240% | Lucario: Close Combat 212.9-251.6% | — |
| Flareon L55 | Overheat · Giga Impact · Quick Attack · Will-O-Wisp | Garchomp: Earthquake 168.6-200% | Magnezone: Thunderbolt 54.9-64.7% | Lucario |
| Rapidash L53 | Flare Blitz · Solar Beam · Bounce · Sunny Day | Garchomp: Earthquake 160.5-189.1% | Infernape: Close Combat 80.3-95.9% | — |
| Infernape L55 | Flare Blitz · Thunder Punch · Mach Punch · Earthquake | Garchomp: Earthquake 138.2-163.6% | Roserade: Sludge Bomb 60.6-71.5% | Weavile, Lucario |
| Magmortar L57 | Flamethrower · Thunderbolt · Solar Beam · Hyper Beam @ Sitrus Berry | Garchomp: Earthquake 136.1-160.9% | Infernape: Close Combat 68-80.5% | — |

**Houndoom L52**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Flamethrower (its best hit on Weavile, Roserade, Lucario and Magnezone). Otherwise: Sludge Bomb against Infernape; Dark Pulse against Garchomp.
- **How to attack it:** Hit it with Fighting and Ground. The call: Infernape: Close Combat 202.6-240%. Backup: Lucario: Close Combat 212.9-251.6%. Its blind spot: Infernape and Garchomp take almost nothing from it.

**Flareon L55**

- **Tendencies:** You move first, every time. Its go-to: Overheat (its best hit on Weavile, Roserade, Lucario and Magnezone). Otherwise: Giga Impact against Infernape and Garchomp. Hits from both sides (Giga Impact and Quick Attack physical, Overheat special): no single wall stops it.
- **When it's ahead:** Expect Will-O-Wisp early. Once you're low, Quick Attack finishes you.
- **Against moves:** Flash Fire: Fire moves power it up instead.
- **How to attack it:** Hit it with Ground. The call: Garchomp: Earthquake 168.6-200%. Backup: Magnezone: Thunderbolt 54.9-64.7%. Keep Lucario away from it: one hit and they're gone.

**Rapidash L53**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Flare Blitz (its best hit on Weavile, Roserade, Lucario and Magnezone). Otherwise: Bounce against Infernape; Solar Beam against Garchomp. Hits from both sides (Flare Blitz and Bounce physical, Solar Beam special): no single wall stops it.
- **How to attack it:** Hit it with Ground. The call: Garchomp: Earthquake 160.5-189.1%. Backup: Infernape: Close Combat 80.3-95.9%. Keep Roserade away from it: one hit and they're gone. Its blind spot: Garchomp takes almost nothing from it.

**Infernape L55**

- **Tendencies:** Gets the jump on Lucario and Magnezone. Its go-to: Earthquake (its best hit on Infernape, Garchomp and Magnezone). Otherwise: Flare Blitz against Weavile, Roserade and Lucario.
- **When it's ahead:** Once you're low, Mach Punch finishes you.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Ground. The call: Garchomp: Earthquake 138.2-163.6%. Backup: Roserade: Sludge Bomb 60.6-71.5%. Keep Weavile, Roserade and Lucario away from it: one hit and they're gone. Its blind spot: Garchomp takes almost nothing from it.

**Magmortar L57**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Flamethrower (its best hit on Weavile, Roserade, Lucario and Magnezone). Otherwise: Hyper Beam against Infernape and Garchomp. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Flame Body: touching it can burn you.
- **How to attack it:** Hit it with Ground. The call: Garchomp: Earthquake 136.1-160.9%. Backup: Infernape: Close Combat 68-80.5%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Houndoom | Infernape (W) | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb |
| Flareon | Garchomp (W) | Earthquake / Giga Impact | Earthquake / Giga Impact | Earthquake / Giga Impact | Earthquake / Giga Impact | Earthquake / Giga Impact | Earthquake / Giga Impact | Earthquake / Giga Impact |
| Rapidash | Garchomp (W) | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam |
| Infernape | Garchomp (W) | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Flare Blitz | Earthquake / Earthquake | Earthquake / Flare Blitz |
| Magmortar | Garchomp (W) | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam |

### Call sheet vs Lucian (Lv 59, pret/pokeplatinum res/trainers/data/elite_four_lucian.json)

- **Order:** Mr. Mime (Lv 53), Espeon (Lv 55), Bronzong (Lv 54), Alakazam (Lv 56), Gallade (Lv 59). Lead with Weavile: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. It's coded to set up on its first turn. Their best player: Gallade, which beats 5 of your 6. Your last one standing: Garchomp.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “Hmm... Now what should I do...”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Mr. Mime L53 | Psychic · Thunderbolt · Reflect · Light Screen | Weavile: Night Slash 148.8-175.2% | Garchomp: Earthquake 112.4-133.9% | — |
| Espeon L55 | Psychic · Shadow Ball · Quick Attack · Signal Beam | Weavile: Night Slash 121.6-142.5% | Garchomp: Earthquake 90.8-107.8% | — |
| Bronzong L54 | Psychic · Gyro Ball · Earthquake · Calm Mind | Infernape: Flamethrower 88.2-103.9% | Lucario: Close Combat 56.6-67.1% | — |
| Alakazam L56 | Psychic · Energy Ball · Focus Blast · Recover | Weavile: Night Slash 154.2-183.3% | Garchomp: Earthquake 117.4-138.2% | — |
| Gallade L59 | Drain Punch · Psycho Cut · Leaf Blade · Stone Edge @ Sitrus Berry | Garchomp: Earthquake 74.1-87.3% | — | Weavile |

**Mr. Mime L53**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Infernape, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Thunderbolt against Weavile.
- **How to attack it:** Hit it with Dark. The call: Weavile: Night Slash 148.8-175.2%. Backup: Garchomp: Earthquake 112.4-133.9%. Its blind spot: Weavile, Garchomp and Magnezone take almost nothing from it.

**Espeon L55**

- **Tendencies:** Gets the jump on Lucario and Magnezone. Its go-to: Psychic (its best hit on Infernape, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Signal Beam against Weavile. Hits from both sides (Quick Attack physical, Psychic, Shadow Ball and Signal Beam special): no single wall stops it.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Weavile: Night Slash 121.6-142.5%. Backup: Garchomp: Earthquake 90.8-107.8%. Its blind spot: Magnezone takes almost nothing from it.

**Bronzong L54**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Infernape, Roserade and Garchomp). Otherwise: Earthquake against Lucario and Magnezone; Gyro Ball against Weavile. Hits from both sides (Earthquake physical, Psychic special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Calm Mind.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Fire. The call: Infernape: Flamethrower 88.2-103.9%. Backup: Lucario: Close Combat 56.6-67.1%. Its blind spot: Garchomp takes almost nothing from it.

**Alakazam L56**

- **Tendencies:** Moves first against Roserade, Lucario and Magnezone. Its go-to: Psychic (its best hit on Infernape, Roserade and Garchomp). Otherwise: Focus Blast against Weavile, Lucario and Magnezone.
- **When it's behind:** When it's low, it heals itself with Recover.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Weavile: Night Slash 154.2-183.3%. Backup: Garchomp: Earthquake 117.4-138.2%. Keep Weavile away from it: one hit and they're gone.

**Gallade L59**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Psycho Cut (its best hit on Infernape, Roserade and Garchomp). Otherwise: Drain Punch against Weavile, Lucario and Magnezone. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Steadfast: flinching makes it faster.
- **How to attack it:** The call: Garchomp: Earthquake 74.1-87.3%. Keep Weavile away from it: one hit and they're gone. Its blind spot: Garchomp takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Mr. Mime | Weavile (W) | Night Slash / Reflect | Night Slash / Thunderbolt | Night Slash / Thunderbolt | Night Slash / Thunderbolt | Night Slash / Thunderbolt | Night Slash / Thunderbolt | Night Slash / Thunderbolt |
| Espeon | Weavile (W) | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam |
| Bronzong | Infernape (W) | Flamethrower / Calm Mind | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Close Combat / Psychic | Flamethrower / Psychic |
| Alakazam | Weavile (W) | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast |
| Gallade | Garchomp (W) | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut |

### Call sheet vs Champion Cynthia (Lv 62, pret/pokeplatinum res/trainers/data/champion_cynthia.json)

- **Order:** Spiritomb (Lv 58), Roserade (Lv 58), Togekiss (Lv 60), Lucario (Lv 60), Milotic (Lv 58), Garchomp (Lv 62). Lead with Magnezone: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Garchomp, which beats 4 of your 6. Your last one standing: Garchomp.
- **The bag:** 4 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “I can’t remember the last time I was put in a corner like this!” Last Pokémon at half HP: “I won’t let this end yet! This match is too fun to let it end this easily!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Spiritomb L58 | Dark Pulse · Psychic · Silver Wind · Shadow Ball | Magnezone: Thunderbolt 65-77.6% | Garchomp: Earthquake 63.6-75.5% | — |
| Roserade L58 | Energy Ball · Sludge Bomb · Toxic · Extrasensory | Weavile: Ice Punch 140.6-166.5% | Lucario: Ice Punch 87.7-103.2% | — |
| Togekiss L60 | Air Slash · Aura Sphere · Water Pulse · Shock Wave | Garchomp: Dragon Claw 41.1-48.9% | Lucario: Close Combat 53.7-63.2% | Weavile |
| Lucario L60 | Aura Sphere · Extreme Speed · Shadow Ball · Stone Edge | Infernape: Close Combat 144.2-170.9% | Lucario: Close Combat 150-177.9% | Weavile |
| Milotic L58 | Surf · Ice Beam · Mirror Coat · Dragon Pulse | Lucario: Close Combat 62.1-73.8% | Magnezone: Thunderbolt 86.2-101.5% | — |
| Garchomp L62 | Dragon Rush · Earthquake · Flamethrower · Giga Impact @ Sitrus Berry | Weavile: Ice Punch 119.6-141.1% | Garchomp: Dragon Claw 67.9-80.4% | Infernape, Lucario, Magnezone |

**Spiritomb L58**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Infernape, Roserade and Lucario). Otherwise: Dark Pulse against Garchomp and Magnezone; Silver Wind against Weavile.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** The call: Magnezone: Thunderbolt 65-77.6%. Backup: Garchomp: Earthquake 63.6-75.5%. Its blind spot: Lucario, Garchomp and Magnezone take almost nothing from it.

**Roserade L58**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Extrasensory (its best hit on Infernape, Roserade and Lucario). Otherwise: Energy Ball against Garchomp and Magnezone; Sludge Bomb against Weavile.
- **When it's ahead:** Expect Toxic early.
- **Against moves:** Natural Cure: switching out cures its status.
- **How to attack it:** Hit it with Fire and Ice. The call: Weavile: Ice Punch 140.6-166.5%. Backup: Lucario: Ice Punch 87.7-103.2%. Its blind spot: Lucario and Magnezone take almost nothing from it.

**Togekiss L60**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Air Slash (its best hit on Infernape, Roserade and Garchomp). Otherwise: Aura Sphere against Weavile, Lucario and Magnezone.
- **Against moves:** Hustle: hits harder but misses more.
- **How to attack it:** Hit it with Electric and Ice. The call: Garchomp: Dragon Claw 41.1-48.9%. Backup: Lucario: Close Combat 53.7-63.2%. Keep Weavile away from it: one hit and they're gone. Its blind spot: Garchomp takes almost nothing from it.

**Lucario L60**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Aura Sphere (its best hit on Infernape, Weavile, Lucario, Garchomp and Magnezone). Otherwise: Stone Edge against Roserade. Hits from both sides (Extreme Speed and Stone Edge physical, Aura Sphere and Shadow Ball special): no single wall stops it.
- **When it's ahead:** Once you're low, Extreme Speed finishes you.
- **Against moves:** Steadfast: flinching makes it faster.
- **How to attack it:** Hit it with Fighting, Fire and Ground. The call: Infernape: Close Combat 144.2-170.9%. Backup: Lucario: Close Combat 150-177.9%. Keep Weavile away from it: one hit and they're gone.

**Milotic L58**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Surf (its best hit on Infernape, Weavile, Lucario and Magnezone). Otherwise: Ice Beam against Roserade and Garchomp.
- **Against moves:** Marvel Scale: a status condition makes it sturdier.
- **How to attack it:** Hit it with Electric and Grass. The call: Lucario: Close Combat 62.1-73.8%. Backup: Magnezone: Thunderbolt 86.2-101.5%.

**Garchomp L62**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Lucario and Magnezone. Its go-to: Earthquake (its best hit on Infernape, Lucario and Magnezone). Otherwise: Dragon Rush against Weavile, Roserade and Garchomp. Hits from both sides (Dragon Rush, Earthquake and Giga Impact physical, Flamethrower special): no single wall stops it. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Sand Veil: harder to hit in a sandstorm.
- **How to attack it:** Hit it with Dragon and Ice. The call: Weavile: Ice Punch 119.6-141.1%. Backup: Garchomp: Dragon Claw 67.9-80.4%. Keep Infernape, Lucario and Magnezone away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Spiritomb | Magnezone (W) | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse |
| Roserade | Weavile (W) | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb |
| Togekiss | Garchomp (W) | Dragon Claw / Air Slash | Dragon Claw / Air Slash | Dragon Claw / Air Slash | Dragon Claw / Aura Sphere | Dragon Claw / Air Slash | Dragon Claw / Air Slash | Dragon Claw / Air Slash |
| Lucario | Infernape (W) | Close Combat / Aura Sphere | Close Combat / Aura Sphere | Close Combat / Aura Sphere | Close Combat / Extreme Speed | Flamethrower / Aura Sphere | Close Combat / Aura Sphere | Flamethrower / Extreme Speed |
| Milotic | Lucario (W) | Swords Dance / Surf | Close Combat / Surf | Close Combat / Surf | Close Combat / Surf | Close Combat / Surf | Close Combat / Surf | Close Combat / Surf |
| Garchomp | Weavile (W) | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake |

### Call sheet vs Aaron (rematch) (Lv 69, pret/pokeplatinum res/trainers/data/elite_four_aaron_rematch.json)

- **Order:** Yanmega (Lv 65), Scizor (Lv 65), Vespiquen (Lv 66), Heracross (Lv 67), Drapion (Lv 69). Lead with Infernape: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Heracross, which beats 3 of your 6. Your last one standing: Infernape.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Last Pokémon at half HP: “It’s not over yet! A League Elite Four can’t give up!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Yanmega L65 | Air Slash · Bug Buzz · U-turn · Double Team | Infernape: Flamethrower 131.1-154.4% | Magnezone: Thunderbolt 171.8-201.9% | — |
| Scizor L65 | Iron Head · X-Scissor · Night Slash · Quick Attack | Infernape: Flamethrower 220.5-261.6% | Magnezone: Hidden Power Fire 142.7-168.6% | — |
| Vespiquen L66 | Attack Order · Defend Order · Heal Order · Power Gem | Magnezone: Thunderbolt 114.9-135.1% | Lucario: Ice Punch 47.9-57.4% | — |
| Heracross L67 | Megahorn · Close Combat · Night Slash · Stone Edge | Garchomp: Fire Fang 55.9-66.7% | Infernape: Flamethrower 83.3-100% | Weavile, Lucario |
| Drapion L69 | X-Scissor · Cross Poison · Ice Fang · Aerial Ace @ Sitrus Berry | Magnezone: Thunderbolt 67.9-80.1% | Lucario: Earthquake 55.1-65.3% | — |

**Yanmega L65**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Air Slash (its best hit on Infernape, Roserade and Lucario). Otherwise: Bug Buzz against Weavile, Garchomp and Magnezone. Hits from both sides (U-turn physical, Air Slash and Bug Buzz special): no single wall stops it.
- **How to attack it:** Hit it with Electric, Fire and Ice. The call: Infernape: Flamethrower 131.1-154.4%. Backup: Magnezone: Thunderbolt 171.8-201.9%. Its blind spot: Magnezone takes almost nothing from it.

**Scizor L65**

- **Tendencies:** You move first, every time. Its go-to: Iron Head (its best hit on Infernape, Weavile, Roserade, Lucario and Garchomp). Otherwise: X-Scissor against Magnezone.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire. The call: Infernape: Flamethrower 220.5-261.6%. Backup: Magnezone: Hidden Power Fire 142.7-168.6%. Its blind spot: Infernape, Lucario and Magnezone take almost nothing from it.

**Vespiquen L66**

- **Tendencies:** You move first, every time. Its go-to: Attack Order (its best hit on Weavile, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Power Gem against Infernape. Hits from both sides (Attack Order physical, Power Gem special): no single wall stops it.
- **When it's behind:** When it's low, it heals itself with Heal Order.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** Hit it with Electric, Fire and Ice. The call: Magnezone: Thunderbolt 114.9-135.1%. Backup: Lucario: Ice Punch 47.9-57.4%. Its blind spot: Infernape, Lucario, Garchomp and Magnezone take almost nothing from it.

**Heracross L67**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Close Combat (its best hit on Infernape, Weavile, Lucario and Magnezone). Otherwise: Megahorn against Roserade and Garchomp.
- **Against moves:** Swarm: Bug moves hit harder when it's low.
- **How to attack it:** Hit it with Fire. The call: Garchomp: Fire Fang 55.9-66.7%. Backup: Infernape: Flamethrower 83.3-100%. Keep Weavile and Lucario away from it: one hit and they're gone.

**Drapion L69**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Aerial Ace (its best hit on Infernape and Lucario). Otherwise: X-Scissor against Weavile and Magnezone; Ice Fang against Roserade and Garchomp. Holds Sitrus Berry: it heals once when it drops to half.
- **How to attack it:** Hit it with Ground. The call: Magnezone: Thunderbolt 67.9-80.1%. Backup: Lucario: Earthquake 55.1-65.3%. Its blind spot: Lucario and Magnezone take almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Yanmega | Infernape (W) | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash | Flamethrower / Air Slash |
| Scizor | Infernape (W) | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head | Flamethrower / Iron Head |
| Vespiquen | Magnezone (W) | Thunderbolt / Attack Order | Thunderbolt / Attack Order | Thunderbolt / Attack Order | Thunderbolt / Attack Order | Thunderbolt / Heal Order | Thunderbolt / Attack Order | Thunderbolt / Heal Order |
| Heracross | Garchomp (W) | Dragon Claw / Close Combat | Dragon Claw / Close Combat | Dragon Claw / Close Combat | Dragon Claw / Close Combat | Dragon Claw / Megahorn | Dragon Claw / Close Combat | Dragon Claw / Close Combat |
| Drapion | Magnezone (W) | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor | Thunderbolt / X-Scissor |

### Call sheet vs Bertha (rematch) (Lv 71, pret/pokeplatinum res/trainers/data/elite_four_bertha_rematch.json)

- **Order:** Whiscash (Lv 66), Gliscor (Lv 69), Hippowdon (Lv 68), Golem (Lv 68), Rhyperior (Lv 71). Lead with Garchomp: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Rhyperior, which beats 3 of your 6. Your last one standing: Roserade.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Last Pokémon at half HP: “Dear child, don’t assume for an instant that you’ve won.”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Whiscash L66 | Earth Power · Aqua Tail · Zen Headbutt · Sandstorm | Garchomp: Earthquake 59.8-71% | Lucario: Close Combat 62.7-73.9% | — |
| Gliscor L69 | Earthquake · Ice Fang · Fire Fang · Thunder Fang | Weavile: Ice Punch 124.1-147.8% | Infernape: Flamethrower 53.2-62.6% | Magnezone |
| Hippowdon L68 | Earthquake · Stone Edge · Crunch · Yawn | Garchomp: Earthquake 38.4-45.7% | Weavile: Ice Punch 54.7-64.5% | Magnezone |
| Golem L68 | Earthquake · Fire Punch · Thunder Punch · Sandstorm | Magnezone: Flash Cannon 130.4-154.6% | Garchomp: Earthquake 84.1-99.5% | — |
| Rhyperior L71 | Earthquake · Rock Wrecker · Megahorn · Avalanche @ Sitrus Berry | Magnezone: Flash Cannon 110.9-131.3% | Garchomp: Earthquake 63.4-74.7% | Weavile, Lucario, Infernape |

**Whiscash L66**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Earth Power (its best hit on Infernape, Lucario, Garchomp and Magnezone). Otherwise: Aqua Tail against Weavile; Zen Headbutt against Roserade. Hits from both sides (Aqua Tail and Zen Headbutt physical, Earth Power special): no single wall stops it.
- **How to attack it:** Hit it with Grass. The call: Garchomp: Earthquake 59.8-71%. Backup: Lucario: Close Combat 62.7-73.9%. Its blind spot: Garchomp takes almost nothing from it.

**Gliscor L69**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Earthquake (its best hit on Infernape, Weavile, Roserade, Lucario and Magnezone). Otherwise: Ice Fang against Garchomp.
- **How to attack it:** Hit it with Ice. The call: Weavile: Ice Punch 124.1-147.8%. Backup: Infernape: Flamethrower 53.2-62.6%. Keep Magnezone away from it: one hit and they're gone.

**Hippowdon L68**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Infernape, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Stone Edge against Weavile.
- **When it's ahead:** Expect Yawn early.
- **Against moves:** Sand Stream: it brings a sandstorm.
- **How to attack it:** Hit it with Grass and Ice. The call: Garchomp: Earthquake 38.4-45.7%. Backup: Weavile: Ice Punch 54.7-64.5%. Keep Magnezone away from it: one hit and they're gone.

**Golem L68**

- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Infernape, Lucario, Garchomp and Magnezone). Otherwise: Fire Punch against Weavile and Roserade.
- **Against moves:** Rock Head: no recoil damage.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice and Steel. The call: Magnezone: Flash Cannon 130.4-154.6%. Backup: Garchomp: Earthquake 84.1-99.5%. Keep Magnezone away from it: one hit and they're gone.

**Rhyperior L71**

- **Order:** Last in the order.
- **Tendencies:** You move first, every time. Its go-to: Earthquake (its best hit on Infernape, Lucario and Magnezone). Otherwise: Rock Wrecker against Weavile and Roserade; Avalanche against Garchomp. Holds Sitrus Berry: it heals once when it drops to half.
- **How to attack it:** Hit it with Fighting, Grass, Ground, Ice and Steel. The call: Magnezone: Flash Cannon 110.9-131.3%. Backup: Garchomp: Earthquake 63.4-74.7%. Keep Infernape, Weavile, Roserade, Lucario and Magnezone away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Whiscash | Garchomp (W) | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power | Earthquake / Earth Power |
| Gliscor | Weavile (W) | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake | Ice Punch / Earthquake |
| Hippowdon | Garchomp (W) | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake |
| Golem | Magnezone (W) | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake |
| Rhyperior | Magnezone (W) | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake | Flash Cannon / Earthquake |

### Call sheet vs Flint (rematch) (Lv 73, pret/pokeplatinum res/trainers/data/elite_four_flint_rematch.json)

- **Order:** Houndoom (Lv 68), Flareon (Lv 71), Rapidash (Lv 69), Infernape (Lv 71), Magmortar (Lv 73). Lead with Infernape: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Infernape, which beats 3 of your 6. Your last one standing: Lucario.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “I can feel your determination. Your will is overpowering me!” Last Pokémon at half HP: “This situation... This is heating up! I’m blazing now!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Houndoom L68 | Flamethrower · Sludge Bomb · Dark Pulse · Sunny Day | Infernape: Close Combat 199-235% | Lucario: Close Combat 208-246% | — |
| Flareon L71 | Overheat · Giga Impact · Quick Attack · Will-O-Wisp | Lucario: Earthquake 100-118.6% | Garchomp: Earthquake 171.1-202.1% | — |
| Rapidash L69 | Flare Blitz · Solar Beam · Bounce · Sunny Day | Garchomp: Earthquake 159.8-188.4% | Infernape: Close Combat 81-95.2% | — |
| Infernape L71 | Flare Blitz · Thunder Punch · Mach Punch · Earthquake | Garchomp: Earthquake 138.1-163.8% | Lucario: Earthquake 81-96.2% | Weavile |
| Magmortar L73 | Flamethrower · Thunderbolt · Solar Beam · Hyper Beam @ Sitrus Berry | Garchomp: Earthquake 140.2-165.4% | Infernape: Close Combat 70.1-82.7% | — |

**Houndoom L68**

- **Order:** Leads off.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Flamethrower (its best hit on Weavile, Roserade, Lucario and Magnezone). Otherwise: Sludge Bomb against Infernape; Dark Pulse against Garchomp.
- **How to attack it:** Hit it with Fighting and Ground. The call: Infernape: Close Combat 199-235%. Backup: Lucario: Close Combat 208-246%. Its blind spot: Infernape and Garchomp take almost nothing from it.

**Flareon L71**

- **Tendencies:** You move first, every time. Its go-to: Overheat (its best hit on Weavile, Roserade, Lucario and Magnezone). Otherwise: Giga Impact against Infernape and Garchomp. Hits from both sides (Giga Impact and Quick Attack physical, Overheat special): no single wall stops it.
- **When it's ahead:** Expect Will-O-Wisp early. Once you're low, Quick Attack finishes you.
- **Against moves:** Flash Fire: Fire moves power it up instead.
- **How to attack it:** Hit it with Ground. The call: Lucario: Earthquake 100-118.6%. Backup: Garchomp: Earthquake 171.1-202.1%. Keep Lucario away from it: one hit and they're gone.

**Rapidash L69**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Flare Blitz (its best hit on Weavile, Roserade, Lucario and Magnezone). Otherwise: Bounce against Infernape; Solar Beam against Garchomp. Hits from both sides (Flare Blitz and Bounce physical, Solar Beam special): no single wall stops it.
- **How to attack it:** Hit it with Ground. The call: Garchomp: Earthquake 159.8-188.4%. Backup: Infernape: Close Combat 81-95.2%. Keep Roserade away from it: one hit and they're gone. Its blind spot: Garchomp takes almost nothing from it.

**Infernape L71**

- **Tendencies:** Gets the jump on Lucario and Magnezone. Its go-to: Earthquake (its best hit on Infernape, Garchomp and Magnezone). Otherwise: Flare Blitz against Weavile, Roserade and Lucario.
- **When it's ahead:** Once you're low, Mach Punch finishes you.
- **Against moves:** Blaze: Fire moves hit harder when it's low.
- **How to attack it:** Hit it with Ground. The call: Garchomp: Earthquake 138.1-163.8%. Backup: Lucario: Earthquake 81-96.2%. Keep Weavile and Roserade away from it: one hit and they're gone. Its blind spot: Garchomp takes almost nothing from it.

**Magmortar L73**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Flamethrower (its best hit on Weavile, Roserade, Lucario and Magnezone). Otherwise: Hyper Beam against Infernape and Garchomp. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Flame Body: touching it can burn you.
- **How to attack it:** Hit it with Ground. The call: Garchomp: Earthquake 140.2-165.4%. Backup: Infernape: Close Combat 70.1-82.7%.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Houndoom | Infernape (W) | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb | Close Combat / Sludge Bomb |
| Flareon | Lucario (W) | Earthquake / Overheat | Earthquake / Overheat | Earthquake / Overheat | Earthquake / Giga Impact | Earthquake / Overheat | Earthquake / Overheat | Earthquake / Giga Impact |
| Rapidash | Garchomp (W) | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam | Earthquake / Solar Beam |
| Infernape | Garchomp (W) | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Earthquake | Earthquake / Flare Blitz | Earthquake / Earthquake | Earthquake / Flare Blitz |
| Magmortar | Garchomp (W) | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam | Earthquake / Hyper Beam |

### Call sheet vs Lucian (rematch) (Lv 75, pret/pokeplatinum res/trainers/data/elite_four_lucian_rematch.json)

- **Order:** Mr. Mime (Lv 69), Espeon (Lv 71), Bronzong (Lv 70), Alakazam (Lv 72), Gallade (Lv 75). Lead with Weavile: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. It's coded to set up on its first turn. Their best player: Gallade, which beats 5 of your 6. Your last one standing: Garchomp.
- **The bag:** 2 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “Hmm... Now what should I do...”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Mr. Mime L69 | Psychic · Thunderbolt · Reflect · Light Screen | Weavile: Night Slash 145.5-172.7% | Garchomp: Earthquake 111-131.2% | — |
| Espeon L71 | Psychic · Shadow Ball · Quick Attack · Signal Beam | Weavile: Night Slash 120.6-142.3% | Garchomp: Earthquake 91.2-107.2% | — |
| Bronzong L70 | Psychic · Gyro Ball · Earthquake · Calm Mind | Infernape: Flamethrower 86.6-102.1% | Lucario: Close Combat 55.7-67% | — |
| Alakazam L72 | Psychic · Energy Ball · Focus Blast · Recover | Weavile: Night Slash 156-184.6% | Garchomp: Earthquake 118.7-140.1% | — |
| Gallade L75 | Drain Punch · Psycho Cut · Leaf Blade · Stone Edge @ Sitrus Berry | Garchomp: Earthquake 75.1-89% | — | Weavile |

**Mr. Mime L69**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Infernape, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Thunderbolt against Weavile.
- **How to attack it:** Hit it with Dark. The call: Weavile: Night Slash 145.5-172.7%. Backup: Garchomp: Earthquake 111-131.2%. Its blind spot: Weavile, Garchomp and Magnezone take almost nothing from it.

**Espeon L71**

- **Tendencies:** Gets the jump on Lucario and Magnezone. Its go-to: Psychic (its best hit on Infernape, Roserade, Lucario, Garchomp and Magnezone). Otherwise: Signal Beam against Weavile. Hits from both sides (Quick Attack physical, Psychic, Shadow Ball and Signal Beam special): no single wall stops it.
- **When it's ahead:** Once you're low, Quick Attack finishes you.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Weavile: Night Slash 120.6-142.3%. Backup: Garchomp: Earthquake 91.2-107.2%. Its blind spot: Magnezone takes almost nothing from it.

**Bronzong L70**

- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Infernape, Roserade and Garchomp). Otherwise: Earthquake against Lucario and Magnezone; Gyro Ball against Weavile. Hits from both sides (Earthquake physical, Psychic special): no single wall stops it.
- **When it's ahead:** Given a free turn, it sets up with Calm Mind.
- **Against moves:** Levitate: Ground moves miss it entirely.
- **How to attack it:** Hit it with Fire. The call: Infernape: Flamethrower 86.6-102.1%. Backup: Lucario: Close Combat 55.7-67%. Its blind spot: Garchomp takes almost nothing from it.

**Alakazam L72**

- **Tendencies:** Moves first against Roserade, Lucario, Garchomp and Magnezone. Its go-to: Psychic (its best hit on Infernape, Roserade and Garchomp). Otherwise: Focus Blast against Weavile, Lucario and Magnezone.
- **When it's behind:** When it's low, it heals itself with Recover.
- **Against moves:** Synchronize: it passes its status back.
- **How to attack it:** Hit it with Dark. The call: Weavile: Night Slash 156-184.6%. Backup: Garchomp: Earthquake 118.7-140.1%. Keep Weavile away from it: one hit and they're gone.

**Gallade L75**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Magnezone. Its go-to: Psycho Cut (its best hit on Infernape, Roserade and Garchomp). Otherwise: Drain Punch against Weavile, Lucario and Magnezone. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Steadfast: flinching makes it faster.
- **How to attack it:** The call: Garchomp: Earthquake 75.1-89%. Keep Weavile away from it: one hit and they're gone. Its blind spot: Garchomp takes almost nothing from it.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Mr. Mime | Weavile (W) | Night Slash / Reflect | Night Slash / Thunderbolt | Night Slash / Thunderbolt | Night Slash / Thunderbolt | Night Slash / Thunderbolt | Night Slash / Thunderbolt | Night Slash / Thunderbolt |
| Espeon | Weavile (W) | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam | Night Slash / Signal Beam |
| Bronzong | Infernape (W) | Flamethrower / Calm Mind | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Flamethrower / Psychic | Close Combat / Psychic | Flamethrower / Psychic |
| Alakazam | Weavile (W) | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast | Night Slash / Focus Blast |
| Gallade | Garchomp (W) | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut | Earthquake / Psycho Cut |

### Call sheet vs Cynthia (rematch) (Lv 78, pret/pokeplatinum res/trainers/data/champion_cynthia_rematch.json)

- **Order:** Spiritomb (Lv 74), Roserade (Lv 74), Togekiss (Lv 76), Lucario (Lv 76), Milotic (Lv 74), Garchomp (Lv 78). Lead with Magnezone: it handles their opener. It stays in unless Perish Song is about to end, nothing it has can touch you, or a bench Pokémon absorbs or resists what just hit it and hits back super-effectively.
- **Philosophy:** Its AI scores every move: a knockout first (priority if it has one), otherwise its hardest hit; it won't heal while it's faster than you, and it rarely sets up below 70% HP. Their best player: Garchomp, which beats 4 of your 6. Your last one standing: Garchomp.
- **The bag:** 4 × Full Restore in the bag. It uses a Full Restore the moment a Pokémon drops below a quarter of its HP; more items unlock as its party shrinks.
- **What they say:** Down to the last Pokémon: “I can’t remember the last time I was put in a corner like this!” Last Pokémon at half HP: “I won’t let this end yet! This match is too fun to let it end this easily!”

| They send | Their moves | The call | Backup | Don't send |
|---|---|---|---|---|
| Spiritomb L74 | Dark Pulse · Psychic · Silver Wind · Ominous Wind | Magnezone: Thunderbolt 65.6-77.2% | Garchomp: Earthquake 62.2-73.9% | — |
| Roserade L74 | Energy Ball · Sludge Bomb · Shadow Ball · Extrasensory | Weavile: Ice Punch 139.5-166.2% | Lucario: Ice Punch 87.2-103.6% | — |
| Togekiss L76 | Air Slash · Aura Sphere · Water Pulse · Psychic | Garchomp: Dragon Claw 41.6-49.2% | Lucario: Close Combat 53.4-63.4% | — |
| Lucario L76 | Aura Sphere · Dragon Pulse · Psychic · Earthquake | Infernape: Close Combat 146-173% | Lucario: Close Combat 153.5-181.4% | Weavile |
| Milotic L74 | Surf · Ice Beam · Mirror Coat · Aqua Ring | Lucario: Close Combat 62.2-73.6% | Magnezone: Thunderbolt 83.7-100% | — |
| Garchomp L78 | Dragon Rush · Earthquake · Brick Break · Giga Impact @ Sitrus Berry | Weavile: Ice Punch 120.4-143.4% | Garchomp: Dragon Claw 68.8-81.7% | Infernape, Lucario, Magnezone |

**Spiritomb L74**

- **Order:** Leads off.
- **Tendencies:** You move first, every time. Its go-to: Psychic (its best hit on Infernape, Roserade and Lucario). Otherwise: Dark Pulse against Garchomp and Magnezone; Silver Wind against Weavile.
- **Against moves:** Pressure: your moves burn extra PP.
- **How to attack it:** The call: Magnezone: Thunderbolt 65.6-77.2%. Backup: Garchomp: Earthquake 62.2-73.9%. Its blind spot: Lucario, Garchomp and Magnezone take almost nothing from it.

**Roserade L74**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Extrasensory (its best hit on Infernape, Roserade and Lucario). Otherwise: Energy Ball against Garchomp and Magnezone; Sludge Bomb against Weavile.
- **Against moves:** Natural Cure: switching out cures its status.
- **How to attack it:** Hit it with Fire and Ice. The call: Weavile: Ice Punch 139.5-166.2%. Backup: Lucario: Ice Punch 87.2-103.6%. Its blind spot: Lucario and Magnezone take almost nothing from it.

**Togekiss L76**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Air Slash (its best hit on Infernape, Roserade and Garchomp). Otherwise: Aura Sphere against Weavile, Lucario and Magnezone.
- **Against moves:** Hustle: hits harder but misses more.
- **How to attack it:** Hit it with Electric and Ice. The call: Garchomp: Dragon Claw 41.6-49.2%. Backup: Lucario: Close Combat 53.4-63.4%. Its blind spot: Garchomp takes almost nothing from it.

**Lucario L76**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Earthquake (its best hit on Infernape and Magnezone). Otherwise: Aura Sphere against Weavile and Lucario; Psychic against Roserade; Dragon Pulse against Garchomp. Hits from both sides (Earthquake physical, Aura Sphere, Dragon Pulse and Psychic special): no single wall stops it.
- **Against moves:** Steadfast: flinching makes it faster.
- **How to attack it:** Hit it with Fighting, Fire and Ground. The call: Infernape: Close Combat 146-173%. Backup: Lucario: Close Combat 153.5-181.4%. Keep Weavile away from it: one hit and they're gone.

**Milotic L74**

- **Tendencies:** Gets the jump on Magnezone. Its go-to: Surf (its best hit on Infernape, Weavile, Lucario and Magnezone). Otherwise: Ice Beam against Roserade and Garchomp.
- **When it's behind:** When it's low, it heals itself with Aqua Ring.
- **Against moves:** Marvel Scale: a status condition makes it sturdier.
- **How to attack it:** Hit it with Electric and Grass. The call: Lucario: Close Combat 62.2-73.6%. Backup: Magnezone: Thunderbolt 83.7-100%.

**Garchomp L78**

- **Order:** Last in the order.
- **Tendencies:** Gets the jump on Lucario and Magnezone. Its go-to: Earthquake (its best hit on Infernape, Lucario and Magnezone). Otherwise: Dragon Rush against Roserade and Garchomp; Brick Break against Weavile. Holds Sitrus Berry: it heals once when it drops to half.
- **Against moves:** Sand Veil: harder to hit in a sandstorm.
- **How to attack it:** Hit it with Dragon and Ice. The call: Weavile: Ice Punch 120.4-143.4%. Backup: Garchomp: Dragon Claw 68.8-81.7%. Keep Infernape, Weavile, Lucario and Magnezone away from it: one hit and they're gone.

**Game plan by situation** (our call / theirs):

| Their player | We send | Opening script | 1st and 10 | Short yardage | Goal line | 3rd and long | Blitz | Two-minute drill |
|---|---|---|---|---|---|---|---|---|
| Spiritomb | Magnezone (W) | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse | Thunderbolt / Dark Pulse |
| Roserade | Weavile (W) | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb | Ice Punch / Sludge Bomb |
| Togekiss | Garchomp (W) | Dragon Claw / Air Slash | Dragon Claw / Air Slash | Dragon Claw / Air Slash | Dragon Claw / Air Slash | Dragon Claw / Air Slash | Dragon Claw / Air Slash | Dragon Claw / Air Slash |
| Lucario | Infernape (W) | Close Combat / Earthquake | Close Combat / Earthquake | Close Combat / Earthquake | Close Combat / Earthquake | Flamethrower / Earthquake | Close Combat / Earthquake | Flamethrower / Earthquake |
| Milotic | Lucario (W) | Swords Dance / Surf | Close Combat / Surf | Close Combat / Surf | Close Combat / Surf | Close Combat / Aqua Ring | Close Combat / Surf | Close Combat / Surf |
| Garchomp | Weavile (W) | Ice Punch / Brick Break | Ice Punch / Brick Break | Ice Punch / Brick Break | Ice Punch / Brick Break | Ice Punch / Brick Break | Ice Punch / Brick Break | Ice Punch / Brick Break |

