# The Champion's Ranch (v1, 2026-10-19)

**Decision:** D-035. *"Think of it more like end game is a breeding ranch… for a Pokémon champion with unlimited money with unlimited land in as many places, regions 1–4, and obviously with the power of Pokémon… that's kinda a big goal of this too."*
**Related:** camp life (D-034) lives inside it as the kitchen and orchard.

This is the endgame of the whole saga. Every chapter's companions retire somewhere, and every lineage the canon used (Extrasensory Cyndaquil, Dragon Dance Larvitar, Refresh Mudkip) had real fathers behind it. The ranch is where all of them live, and where the breeding keeps going.

Like the other pillars, it's built engine-first: **the engine says what the ranch has to hold; you decide what it looks like.** Sites, scale and story are authored. Nothing below is canon until you approve it.

---

## 1. What it could look like

Unlimited money and land, four regions, and Pokémon doing the work. Each part below is tied to something real: a game mechanic, a Pokédex line, or one of your approved world records.

**Four estates, one ranch.** Each region gets a site picked for its terrain, not its scenery. They're linked the way a Champion would travel: Charizard, Dragonite, Altaria and Crobat fly people between them (Fly, plus your record W-008), and Lapras carries the heavy and the precious across the sea (W-010). Alakazam's Teleport is the emergency exit back to base.

**The nursery is the heart of it.** Pens are laid out by egg group, because that's who can breed with whom. The census says the Field pen is the biggest by far (17 of 43 residents), then Monster (11) and Water 1 (10). The hatchery runs on Flame Body or Magma Armor, which in the games makes eggs hatch in half the time. **None of your 36 companions has either ability**, so the hatchery is the one job that needs outside staff (§4).

**The land builds itself.** 31 residents can use Strength, 21 can dig and 36 can clear land with Cut or Rock Smash. Tyranitar does the excavation (W-002), Mamoswine hauls (W-005), and the works crew is never short of hands.

**Climate is a Pokémon job.** The Ice residents (Lapras, Mamoswine, Weavile and Dewgong from the stock) hold the snowfields and the cold cellars. The hatchery and hot springs sit on volcanic ground with the Fire residents. Magmar's own HeartGold Pokédex entry is basically a climate-control job description: *"It dislikes cold places, so it blows scorching flames to make the environment suitable for itself."*

**The orchard and kitchen (camp life, grown up).** Every berry Gen 4 has (64 of them, from the data), an Apricorn grove for Kurt's seven Poké Balls, a dairy around Miltank (Milk Drink is a real field heal) and honey trees. The best kitchen hire is already on the roster: Pikachu's HeartGold Pokédex says *"This intelligent Pokémon roasts hard berries with electricity to make them tender enough to eat."*

**The clinic and the watch.** Miltank and Lapras heal (Milk Drink, plus W-013) and Snorlax is the calm presence in the room (W-015). Arcanine's Intimidate and Tyranitar (W-003) keep wild Pokémon away, and Crobat scouts and senses danger (W-007, W-009).

**The archive.** Every individual's full PKHeX card (the Specimen engine) and every lineage tree, kept as a studbook. The project already does this; at the ranch it becomes a building.

---

## 2. How the engine thinks about it

```
canon/rosters.json ─┐                       ┌─ habitat profile per resident (ranch/habitat.py)
canon/ranch.json ───┼─► RanchPlanner.census ─┼─ home site per resident
canon/world.json ───┘   (ranch/planner.py)   ├─ staffing per facility (wilderness evidence, cartridge/authored only)
                                             ├─ staff proposals for gaps (game-backed abilities)
                                             └─ breeding program (lineage planner, fathers become residents)
```

- **Habitat profile** (`ranch/habitat.py`). Each species gets:
  - **zones**, primary first. They come from the Gen 3 Pokédex habitat; Gen 4 species inherit their line's (Mamoswine comes via Piloswine). Then type, then Pokédex lore. The 12 zones are meadow, forest, highlands, caverns, volcanic, snowfield, wetland, lakes & rivers, coast & sea, skies, sanctuary and homestead.
  - **climate** (warm or cold) and **water** (fresh or sea).
  - **size class**, from height and weight.
  - **native region**, from the species' generation.
- **Home site.** A resident lives at its native region's site if that site offers its primary zone. If not, it goes to any site that does.
- **Staffing.** Each facility needs certain capabilities. Only game-backed (cartridge) or authored evidence counts as staff. Lore is listed separately as story candidates, and type-based guesses don't count at all.
- **Breeding program.** For each lineage the canon calls for, the lineage planner finds the shortest chain of fathers. A father who isn't already a companion joins the ranch as breeding stock.
- The output goes to `data_manifest/ranch_census.json`. Rebuild it with `python3 -I ranch/report.py`.

**Planner fix made while building this:** fathers who learn the move in the game's own generation now rank ahead of fathers who need a cross-generation transfer. Scizor's Counter father in SoulSilver was Volbeat, who only learns it from Emerald's tutor. Now it's **Heracross, who learns it at Lv 25 in HGSS** and lives on Route 33.

---

## 3. The census (all 36 companions + 7 breeding stock = 43 residents)

### Proposed sites and who lives there

| Site (proposed) | Why this land | Residents |
|---|---|---|
| **Johto: Blackthorn highlands (HQ)**: Route 45/44, Dark Cave, Ice Path, Dragon's Den | home of three chapters; mountains, caves, river, ice and a shrine on one stretch of road | **17**: the Crystal six, Typhlosion, Tyranitar, Crobat, Scizor, Meganium, Dragonite, Blastoise, Empoleon + Heracross, Azumarill, Bellossom |
| **Kanto: Sevii Islands estate**: Mt. Ember + Ember Spa, Berry Forest, Icefall Cave, Four Island Day-Care | almost every terrain, a volcano with a hot spring, a berry forest and its own Day-Care | **13**: Charizard, Venusaur, Alakazam, Jolteon, Machamp, Arcanine, Pikachu, Gengar, Lapras, Snorlax + Kingdra, Muk, Dewgong |
| **Hoenn: Route 117 gardens + Lavaridge springs** | Hoenn's Day-Care among flower beds; geothermal ground | **5**: Swampert, Milotic, Altaria, Absol + Nuzleaf |
| **Sinnoh: Resort Area villa + Battle Zone** | the game's own house for a rich trainer (bought in Platinum; the 50,000,000 price is believed, not checked); Stark Mountain volcano | **8**: the Platinum six, SoulSilver's Infernape, Mamoswine |

**Four residents don't fit their home region's proposed site.** Blastoise and Dragonite (Kanto) and Empoleon (Sinnoh) need fresh water, which the Sevii and Battle Zone proposals don't have, so they move to Johto. Kingdra (Johto) needs the sea, so it moves to Sevii. Either that's fine, or the Kanto and Sinnoh sites want a lake (Lake Acuity is already listed as a Sinnoh alternative).

### What the land has to provide

| | |
|---|---|
| Primary zones | meadow 10 · highlands 8 · lakes & rivers 7 · forest 5 · homestead 5 · caverns 3 · coast & sea 3 · volcanic 2 |
| Size | small 8 · medium 25 · **large 8** (Feraligatr, Arcanine, Lapras, Mamoswine, Tyranitar, Magnezone, Dragonite, Kingdra) · **huge 2** (Snorlax, Milotic) |
| Water | sea: Lapras, Dewgong, Kingdra · fresh: Feraligatr, Milotic, Swampert, Blastoise, Empoleon, Azumarill |
| Climate | warm: Arcanine, Charizard, Typhlosion, both Infernape · cold: Lapras, Mamoswine, Weavile, Dewgong |
| Nursery pens (egg group) | **Field 17** · Monster 11 · Water 1 10 · Dragon 6 · Grass 5 · Human-Like 4 · Fairy 3 · Flying 2 · Amorphous 2 · Bug 2 · Mineral 1 |
| Can't pass egg moves | Magnezone (genderless: it breeds only with Ditto) |

### Breeding program (lineages the canon already uses)

| Target | Egg moves | Fathers, oldest first | Already a companion? |
|---|---|---|---|
| HeartGold Typhlosion | Extrasensory | Nuzleaf (Lv 49; Johto Safari Zone) | no |
| HeartGold Tyranitar | Dragon Dance + Outrage | Kingdra (DD) → **Feraligatr** (Outrage tutor) | **Feraligatr** |
| SoulSilver Gengar | Disable | Muk (Lv 12) | no |
| SoulSilver Scizor | Counter | Heracross (Lv 25) | no |
| SoulSilver Empoleon | Aqua Ring | Azumarill (Lv 27) | no |
| SoulSilver Pikachu | Volt Tackle | none: a parent holds a Light Ball | — |
| Emerald Swampert | Refresh | **Milotic** (Lv 15) | **Milotic** |
| Platinum Infernape | Thunder Punch | **Ampharos** (tutor) | **Ampharos** |
| Platinum Weavile | Ice Shard | Dewgong (Lv 17) | no |
| Platinum Roserade | Leaf Storm + Sleep Powder | Bellossom (Leaf Storm Lv 53; Sleep Powder must be learned as Gloom at Lv 17, before the Sun Stone) | no |

Three companions are also fathers of other chapters' Pokémon: Feraligatr, Milotic and Ampharos. At the ranch that stops being a coincidence and becomes family history.

---

## 4. Gaps and staff proposals

| Facility | Covered by game or authored canon | Gap | Proposal |
|---|---|---|---|
| Nursery & hatchery | calm: Snorlax (W-015) | **egg care**: no companion has Flame Body or Magma Armor | **Magcargo** (Johto, Magma Armor) for the HQ · **Camerupt** (Hoenn, Magma Armor; lives in volcano craters) for Lavaridge · **Magmortar** (Sinnoh, Flame Body) for Stark Mountain |
| Kitchen & orchard | foraging: 26 residents (Headbutt, Sweet Scent, overworld abilities) · heat: Typhlosion (W-001) | **food source, cooking**: no game mechanic exists for these | authored, per D-034. Pokédex candidates: Miltank (milk), Pikachu (roasts berries) |
| Climate | Typhlosion heat (W-001), Mamoswine cold (W-004) + Snow Cloak, Garchomp Sand Veil | — | Charizard, Arcanine and both Infernape are Fire-types but only count as heat once authored |
| Clinic | Miltank (Milk Drink), Lapras (W-013), Snorlax (W-015) | — | |
| Works | Strength 31 · Dig 21 · Cut/Rock Smash 36 | — | |
| Transport | air ×4 (Fly: Charizard, Altaria, Dragonite; Crobat W-008) · Surf ×15 · Dig/Teleport ×22 | — | |
| Security & watch | Arcanine (Intimidate), Tyranitar (W-003), Muk (Stench), Crobat (W-007, W-009) | — | |

---

## 5. Questions only you can answer

1. **Sites:** one HQ plus satellites, or a full estate in every region? The four above are proposals, each with alternatives listed in `canon/ranch.json`.
2. **Who retires there:** do all 36 companions end up at the ranch, or do some stay with family, go back to the wild, or go with the rival?
3. **Breeding stock:** named residents with stories (Nuzleaf as the father of your Typhlosion line), or working animals who come and go?
4. **Who runs it:** Pokémon staff, people, or both? The hatchery needs at least one Flame Body or Magma Armor resident either way.
5. **Open or private:** does the ranch take visitors, train new trainers, or run a public Day-Care?

## 6. Camp life (D-034, small, inside the kitchen)

`wilderness/camp_life.py` plus the editable `camp_life.json`. For each game it lists what food systems actually exist, and every item is checked against PokeAPI. That check already caught two of my mistakes: Lava Cookie and Old Gateau aren't Gen 2 items.

- **Crystal and HGSS:** berry trees, Apricorns and Kurt, MooMoo Milk and the Rage Candy Bar. HGSS adds Honey and Aprijuice. Crystal's berries keep their own names (Berry, Gold Berry, MiracleBerry…).
- **FireRed:** 43 berries, plus MooMoo Milk and drinks.
- **Emerald:** soft-soil planting, Pokéblocks and the Lava Cookie.
- **Platinum:** soft soil with mulch, Poffins (the closest thing to real cooking), Honey and the Old Gateau.

For any team it lists who forages, who produces food, who cooks and who brings heat, each at its evidence tier. What a team actually eats is authored per team, because, in your words, it depends on the team.
