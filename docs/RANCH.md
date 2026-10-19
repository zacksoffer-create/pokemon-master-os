# The Champion's Ranch (v3, 2026-10-19)

**Decisions:** D-035 (the vision), D-036 to D-040 (its shape), D-041 (Blackthorn) and D-042 (the past-tense frame). *"Think of it more like end game is a breeding ranch… for a Pokémon champion with unlimited money with unlimited land… and obviously with the power of Pokémon… that's kinda a big goal of this too."*
**Related:** camp life (D-034) lives inside it as the kitchen and orchard.

Written in the past tense (D-042): the journey is over, every companion is retired, and the ranch is the centerpiece of the present. It's where the canon's lineages ended up and where the breeding goes on (the lab, D-044). As with the other pillars, **the engine says what the ranch has to hold, and you decide what it looks like.**

---

## 1. The shape (decided)

| | Decision | What it means for the engine |
|---|---|---|
| D-036 | **One headquarters** | Everyone lives at HQ unless HQ lacks their land; satellites exist only to fill that gap |
| D-037 | **Companions' fates stay open**: ranch, family, the wild or the rival | Every companion counts as a *possible* resident, and nobody is assigned. The census flags jobs that depend on one companion choosing the ranch |
| D-038 | **Build the lineage, keep only the final product** | Fathers used along the way aren't kept. The ranch keeps one **stud** per line: a male of the target line who knows the whole egg-move set *(my reading; see §6)* |
| D-039 | **Staff are Pokémon and people** | Each facility lists Pokémon jobs (backed by the games or your approved world records) and people roles (placeholders to author) |
| D-040 | **Private ranch, open Day-Care** | Only the Day-Care preserve is open: exclusive, small, run like a wildlife preserve with a day-care side. The rest is private |

---

## 2. What it looks like now

**The headquarters: Blackthorn highlands, Johto (approved, D-041).** One stretch of road between Blackthorn City and Dark Cave has a mountain road with a river (Route 45), a cave system, a lake (Route 44), real ice (Ice Path) and a sacred site (Dragon's Den). Three chapters are Johto chapters. With one HQ, **41 of the 45 possible residents live there.**

**One satellite, for the two things Johto doesn't have.** The HQ has no volcano and no sea. Lapras needs the sea, and both Infernape (plus the Infernape stud) need volcanic ground. **One satellite covers both, and either of two works:**
- **Sevii Islands (Kanto):** Mt. Ember with the Ember Spa hot spring, the open sea, and Lapras's home region.
- **Battle Zone (Sinnoh):** Stark Mountain and the sea, Infernape's home region, and Platinum's villa for a rich trainer.

**The private ranch** is most of it:
- **Nursery and hatchery.** Pens by egg group; Field is the biggest at 15 species, then Monster 11 and Water 1 at 7.
- **Studbook and archive.** Every individual's full PKHeX card and every lineage tree.
- **Clinic, kitchen and orchard, works, transport, security, climate.**

**The Day-Care preserve is the one open part.** Think of the games' Day-Care, gazillionaire edition. It doesn't take walk-ins: it's exclusive, small and by invitation. Clients' Pokémon don't sit in a pen. They live in real habitat on a protected piece of the land, cared for by keepers and by the ranch's own Pokémon. That's the preserve side; the day-care side is that their trainers come back for them. In the census it's a separate facility with its own staffing, so it can be designed on its own.

---

## 2b. The Glasshouse: hatchery and greenhouse in one building (approved, D-045)

*Asked for in D-041 ("build a hatchery from scratch… interweave a hatchery and a greenhouse") and **approved in D-045**. Two of its jobs are still story-only; they're proposed as world records W-016 (Meganium, gardener) and W-017 (Miltank, the nursery's milk). The design lives in `canon/ranch.json` (designs.hatchery_greenhouse) and the engine is `ranch/hatchery.py`.*

**The idea.** Blackthorn sits against the Ice Path, so eggs and plants both need heat, and at a Champion's ranch the heat comes from Pokémon. A **Magcargo hearth** sits at the core (its Pokédex: *"Its body temperature is roughly 18,000 degrees F"*, and rain on it *"instantly turn[s] into steam, cloaking the area in a thick fog"*, which also makes it a humidifier). The egg racks ring the hearth. The greenhouse rings wrap around the egg racks and live on the same heat. **Ampharos lights everything** through the dark months; its tail has been a beacon *"since ancient times."* In the games eggs hatch by being walked, so **the walk that hatches them runs through the crop rows: the egg walk is the harvest walk.**

| Room | What it is | Staff the games back (or you approved) | Open |
|---|---|---|---|
| **Hearth hall** | incubation core: egg racks around the Magcargo hearth, sorted by line | egg care: **Magcargo** (Magma Armor, hired) · heat: Typhlosion (W-001) · calm: Snorlax (W-015) | — |
| **Glasshouse rings** | berry beds and Apricorn trees around the hearth | light: **Ampharos** (Flash; ten other residents can learn it too) · heat: Typhlosion · harvest: Headbutt crew | **plant care**: story only. **Meganium** is the natural gardener (*"its breath has the power to revive dead grass and plants"*) |
| **Hatching loop** | the path through the rows; eggs are carried around it until they hatch | calm: Snorlax · carrying: Strength crew | — |
| **Nursery yard** | first steps and first meals | healing: Miltank (Milk Drink), Lapras (W-013) · watch: Arcanine (Intimidate), Tyranitar (W-003) | **food source**: story only. Miltank (SoulSilver Pokédex: *"If it is around babies, the milk it produces contains much more nutrition than usual"*) |
| **Cold vault** | cut into the Ice Path rock: seed vault and berry store | cold: Mamoswine (W-004) | — |
| **Studbook office** | pedigrees and full PKHeX cards for every hatch | people: archivist | — |

**The hatching loop, in numbers.** Gen 4 counts hatch time in egg cycles of 255 steps, and Magcargo's Magma Armor makes each cycle pass twice as fast. Proposal: **one lap of the loop = one egg cycle**, so an egg's cycle count is its lap count.

| Stud line | Egg cycles = laps | Steps | With Magcargo |
|---|---|---|---|
| Larvitar | 40 | 10,200 | 20 laps |
| Scyther | 25 | 6,375 | 13 laps |
| Cyndaquil, Gastly, Piplup, Mudkip, Chimchar, Sneasel, Budew | 20 | 5,100 | 10 laps |

**The crop plan (Gen 4 berry data).** Medicine for the clinic and the nursery, plus every berry a canon build holds:

| Berry | Why | Hours to harvest | Per plant | Watering |
|---|---|---|---|---|
| Cheri, Chesto, Pecha, Rawst, Aspear | status cures | 12 | up to 5 | heavy |
| Leppa, Oran, Persim | PP, HP, confusion | 16 | up to 5 | heavy |
| Sitrus | HP | 32 | up to 5 | light |
| Lum | held by HeartGold Tyranitar | 48 | up to 5 | medium |

Apricorns for Kurt's Poké Balls grow outside the glass. That matters to the studbook, because a ball is part of every PKHeX card.

**Single points of failure in the building:** the Magcargo hire (egg care), Typhlosion (heat), Snorlax (calm) and Mamoswine (cold). Each is the only one holding its job.

---

## 3. The breeding program under D-038

Each lineage is built once. The ranch keeps the **final product**: a male of that line who already knows the full egg-move set. He can sire every future egg of that line in **one step**, with no chain to rebuild. The fathers used to build him go home (or wherever the story sends them).

| Target | Egg moves | Built with (not kept) | Kept |
|---|---|---|---|
| HeartGold Typhlosion | Extrasensory | Nuzleaf | **Typhlosion-line stud** ♂ |
| HeartGold Tyranitar | Dragon Dance + Outrage | Kingdra → Feraligatr | **Tyranitar-line stud** ♂ (both moves) |
| SoulSilver Gengar | Disable | Muk | **Gengar-line stud** ♂ |
| SoulSilver Scizor | Counter | Heracross | **Scizor-line stud** ♂ |
| SoulSilver Empoleon | Aqua Ring | Azumarill | **Empoleon-line stud** ♂ |
| SoulSilver Pikachu | Volt Tackle | none | **a Light Ball** (the move comes from the held item, not a father) |
| Emerald Swampert | Refresh | Milotic | **Swampert-line stud** ♂ |
| Platinum Infernape | Thunder Punch | Ampharos | **Infernape-line stud** ♂ |
| Platinum Weavile | Ice Shard | Dewgong | **Weavile-line stud** ♂ |
| Platinum Roserade | Leaf Storm + Sleep Powder | Bellossom (Sleep Powder learned as Gloom, Lv 17) | **Roserade-line stud** ♂ (both moves) |

That's **9 studs and one Light Ball.** Two story notes:
- **A male companion could *be* the stud.** If your HeartGold Tyranitar is male and knows Dragon Dance and Outrage, he's already the final product. That depends on D-037 (does he retire here?) and on his gender, which isn't decided.
- **A stud breeds beyond his own line.** He can pass his moves to any line in his egg group that has them as egg moves. For example, the Tyranitar stud shares the Monster group with ten other resident species.

Magnezone is the one resident that can't pass egg moves at all: it's genderless and breeds only with Ditto.

---

## 4. The census (36 companions + 9 studs = 45 possible residents)

| | |
|---|---|
| Where they live | **HQ 41** · satellite 4 (Lapras; Infernape ×2 + stud) |
| Primary land | meadow 12 · highlands 9 · lakes & rivers 8 · forest 4 · caverns 4 · homestead 4 · volcanic 3 · coast & sea 1 |
| Size | small 6 · medium 29 · **large 8** · **huge 2** (Snorlax, Milotic) |
| Water | sea: Lapras · fresh: Feraligatr, Milotic, Swampert, Blastoise, Empoleon, plus the Empoleon and Swampert studs |
| Climate | warm: Arcanine, Charizard, Typhlosion, both Infernape, and the two Fire studs · cold: Lapras, Mamoswine, Weavile, plus the Weavile stud |
| Nursery pens | **Field 15** · Monster 11 · Water 1 7 · Dragon 5 · Human-Like 4 · Grass 3 · Flying 2 · Fairy 2 · Mineral, Amorphous, Bug 1 each |

## 5. Facilities and staff

| Facility | Access | People (to author) | Pokémon, backed by the games or your world records | Open job |
|---|---|---|---|---|
| Nursery & hatchery | private | head breeder | calm: Snorlax (W-015) | **egg care**: no companion has Flame Body or Magma Armor. Hire **Magcargo** (Johto native, Magma Armor) for the HQ |
| Studbook & archive | private | archivist | — | — |
| **Day-Care preserve** | **open, exclusive** | Day-Care keepers | calm: Snorlax · deterrence: Arcanine (Intimidate), Tyranitar (W-003) · healing: Miltank (Milk Drink), Lapras (W-013) · foraging: 20 | — |
| Clinic | private | Pokémon nurse | Miltank, Lapras, Snorlax | — |
| Kitchen & orchard | private | cook, orchard keeper | foraging 20 · heat: Typhlosion (W-001) | food source, cooking: authored per D-034. Pokédex candidates: Miltank's milk; Pikachu, who *"roasts hard berries with electricity"* |
| Works | private | ranch hands | Strength 26 · Dig 16 · Cut/Rock Smash 30 | — |
| Transport | private | — | air: Charizard, Altaria, Dragonite (Fly) and Crobat (W-008) · Surf 12 · Dig/Teleport 17 | — |
| Security & watch | private | wardens | Arcanine, Tyranitar · scouting and danger sense: Crobat (W-007, W-009) | — |
| Climate | private | — | heat: Typhlosion · cold: Mamoswine (W-004) · weather: Garchomp (Sand Veil), Mamoswine (Snow Cloak) | — |

**Jobs that hang on one companion.** Because fates are open, these jobs need that companion to choose the ranch, or you author a replacement or hire one:

| Companion | Covers |
|---|---|
| **Snorlax** | the calm presence in the nursery, the Day-Care and the clinic |
| **Crobat** | all the scouting and danger sense |
| **Typhlosion** | the only authored heat source, for the kitchen and climate (the other Fire residents would count once you author them) |
| **Mamoswine** | the only authored cold handler |

*Staffing is counted ranch-wide for now. Lapras lives at the satellite, but it is also transport.*

---

## 6. Still open

1. ~~Is Blackthorn the headquarters?~~ **Yes (D-041).**
2. **Which satellite: Sevii Islands or the Battle Zone?** Either one covers the volcano and the sea.
3. **Confirm the D-038 reading** (a stud of each target line, not the last father in the chain).
4. ~~The Glasshouse~~ **approved (D-045).** Next: approve W-016 (Meganium, gardener) and W-017 (Miltank, the nursery's milk) to close its two story-only jobs.
5. **Day-Care details**, later: who gets invited, what the preserve looks like, how long clients' Pokémon stay.

---

## 7. How the engine thinks about it

```
canon/rosters.json ─┐                       ┌─ habitat profile per resident (ranch/habitat.py)
canon/ranch.json ───┼─► RanchPlanner.census ─┼─ home site: HQ first, satellite only for missing land
canon/world.json ───┘   (ranch/planner.py)   ├─ fewest satellites that cover what HQ lacks
                                             ├─ facilities from ranch.json: access, people, Pokémon jobs,
                                             │  open jobs, jobs that hang on one species, hire proposals
                                             └─ breeding program: fathers used → the stud that's kept
```

- **Habitat profile.** Zones (primary first) come from the Gen 3 Pokédex habitat; Gen 4 species inherit their line's, so Mamoswine comes via Piloswine. After that come type, then Pokédex lore. Each profile also has climate, water, size class and native region.
- **Staffing.** Only game-backed or authored evidence makes someone staff. Lore is listed as story candidates, and type alone counts for nothing.
- **Facilities live in `canon/ranch.json`.** Their access, needs and people roles are editable there, not in code.
- Rebuild the census with `python3 -I ranch/report.py`. It writes `data_manifest/ranch_census.json`.

## 8. Camp life (D-034, small, inside the kitchen)

`wilderness/camp_life.py` plus the editable `camp_life.json`. For each game it lists the food systems that really exist, and every item is checked against PokeAPI. That check caught two of my mistakes: Lava Cookie and Old Gateau aren't Gen 2 items.

- **Crystal and HGSS:** berry trees, Apricorns and Kurt, MooMoo Milk, the Rage Candy Bar. HGSS adds Honey and Aprijuice. Crystal's berries keep their own names (Berry, Gold Berry, MiracleBerry…).
- **FireRed:** 43 berries, plus MooMoo Milk and drinks.
- **Emerald:** soft-soil planting, Pokéblocks, the Lava Cookie.
- **Platinum:** soft soil with mulch, Poffins (the closest thing to real cooking), Honey, the Old Gateau.

For any team it lists who forages, who produces food, who cooks and who brings heat, each at its evidence tier. What a team actually eats is authored per team.
