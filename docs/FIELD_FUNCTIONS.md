# Field Functions: every game, worked through honestly (v2, 2026-10-19)

**Zack's direction (D-026):** keep the HM rule as the ideal, address every game explicitly, and allow a principled exception where there's a real reason. HeartGold was designed with this in mind; the other games weren't fully thought through for it.

Each function is looked at through three lenses:
- **World:** can this team do it in the lived world? (backed by Pokédex text where possible)
- **Cartridge:** does the game *force* it to finish the story? (verified, or *believed* with a confidence)
- **Learnable:** can a member learn the move (the D-024 standard)?

## Summary

| Game | Verdict | Gaps | Single points of failure (fine, just worth knowing) |
|---|---|---|---|
| HeartGold | **complete**: all 8 HMs | none (TM70 Flash: nobody; optional, and not an HM in Gen 4) | Fly = Crobat · Waterfall = Lapras |
| SoulSilver (provisional) | **complete** | none | **Fly = Dragonite** |
| FireRed | **complete** | none | Fly = Charizard · Surf/Waterfall = Blastoise |
| Emerald | **complete** (incl. Dive, Flash) | none | Fly = Altaria |
| Platinum | **3 gaps** | Fly · Defog · Waterfall | — |
| Crystal | **2 gaps** | Fly · Waterfall | Whirlpool = Feraligatr |

**Surf, the other universal minimum, is covered in every game.**

**No move can close these gaps, under any reading.** No Crystal, Platinum or HeartGold member can learn the missing move in *any* game, ever. The single exception is Feraligatr and Waterfall (learnable from Ruby/Sapphire onward, but not in Gen 2). So these gaps have to be answered by the world, by the cartridge playthrough, or by the roster. PKHeX can't fix them without breaking your "can be learned" rule.

---

## Crystal: 2 gaps, present from the start

The January roster (with Lapras) had the same two gaps; Lapras can't learn Waterfall in Gen 2 either.

### Fly
- **Learnable:** no member, in any game ever.
- **Cartridge:** not required (certain).
- **World options:**
  - **A. The walked chapter.** Crystal is the first journey, made on foot and by water on Feraligatr's back. Flight enters the story with FireRed's Charizard. This fits "attachment before competence, imperfect beginnings" without faking a capability.
  - **B.** Treat it as a genuine hole, which becomes a roster question. Not being proposed.
- **Recommendation:** A, if it feels true to you.

### Waterfall
- **Learnable:** Feraligatr can't in Gen 2, but can in every later game.
- **Cartridge:** *believed* required to reach the League through Tohjo Falls (~75% confidence; verify). The game's own code only checks whether a party member *knows* Waterfall (`pokecrystal` `CheckPartyMove`), so a Feraligatr given Waterfall through PKHeX **would actually work** on the cartridge.
- **World:** Feraligatr climbs waterfalls. The Gen 2 cartridge is the only place it can't.
- **Options:**
  - **A.** Read "can be learned" at the species level for this one case: PKHeX gives Feraligatr Waterfall as a *temporary* field move.
  - **B.** World-only; on the cartridge, a non-member helper handles the one crossing.
- **Recommendation:** A, marked as a temporary field move. It's honest to the creature.

### Covered
Surf (Feraligatr, and Miltank, a Gen 2 quirk) · Whirlpool (Feraligatr) · **Flash (Ampharos, which is literally the team's light)** · Strength · Cut · Rock Smash (TM08) · Headbutt (TM02).

---

## Platinum: 3 gaps. Two were opened by the Empoleon → Lucario swap

In the January roster, **Empoleon was the team's Waterfall and Defog user**. Fly was missing in both versions.

### Fly
- **Learnable:** no member, ever.
- **Cartridge:** not required (certain).
- **World:** Garchomp's own Pokédex: *"It flies at sonic speed"* (Diamond); *"It flies at speeds equal to a jet fighter plane"* (Pearl).
- **Reading:** **Garchomp is the team's flight; the cartridge just can't express it.** This is probably the "if you have a certain Pokémon, you don't need it" reason you half-remembered.

### Defog
- **Learnable:** no member, ever.
- **Cartridge:** *believed* optional (~80%).
- **World:** Platinum's own entry says Garchomp's wings *"create blades of wind that can fell nearby trees."* Clearing fog with that wind is a short step. That last part is my interpretation, not dex text.

### Waterfall
- **Learnable:** no member, ever.
- **Cartridge:** *believed* required on Route 223, the way to the League (~85%; verify).
- **World:** Garchomp flies the trainer over the falls (interpretation).
- **Options:**
  - **A.** On the cartridge, a non-member helper makes that crossing, framed in-world as a ferry or guide. Never a team member.
  - **B.** Revisit Lucario vs Empoleon. That's a roster question. I'm *not* proposing it, only stating the trade-off the swap made.
  - **C.** PKHeX-give Waterfall to a member who can never learn it. That's outside your rule as currently read.
- **Recommendation:** A, with Garchomp as the world answer.

> Connection, not a proposal: the Empoleon that Platinum let go is in the provisional SoulSilver six.

### Covered
Cut · Surf (Weavile, Garchomp) · Strength · Rock Smash · Rock Climb (Infernape, Lucario, Garchomp) · Flash TM (Roserade, Magnezone).

---

## HeartGold
Complete. The only uncovered field move is **TM70 Flash**, which is optional and not an HM in Gen 4, so it's outside the rule's letter. Typhlosion's fire lighting a cave is a world-function interpretation; its dex entries talk about heat haze, not light.

## An interpretive thread (offered, not a rule)
**A history of flight across the journey:**

| Chapter | Flight | That chapter's own Pokédex (VERIFIED, PokeAPI flavor text) |
|---|---|---|
| Crystal | none: the walked journey | Feraligatr: *"its powerful hind legs enable it to move quickly, even on the ground."* Ampharos: *"the light from its bright, shiny tail can be seen from far away on the ocean's surface."* |
| FireRed | Charizard: first flight, heroic | *"Its wings can carry this POKéMON close to an altitude of 4,600 feet."* |
| Emerald | Altaria: flight as part of living out here | *"It hums in a beautiful soprano voice. It flies among white clouds in the blue sky."* |
| Platinum | Garchomp: jet speed the cartridge never catalogued | *"…its wings create blades of wind that can fell nearby trees"* (Platinum); *"It flies at sonic speed"* (Diamond) |
| SoulSilver | Dragonite: rescue over the sea | *"…lets it freely fly over raging seas without trouble."* (HeartGold: *"rescues drowning people"*) |
| HeartGold | Crobat: quiet, everyday mobility | *"It flies so silently through the dark on its four wings that it may not be noticed even when nearby."* |

Each one fits its chapter's thesis.

## Decisions this needs (per game, Zack's call)

| # | Decision | Options |
|---|---|---|
| F1 | Crystal Fly | walked chapter (A) / roster question (B) |
| F2 | Crystal Waterfall | PKHeX temporary move on Feraligatr (A) / helper (B) |
| F3 | Platinum Fly + Defog | Garchomp's world flight covers them? |
| F4 | Platinum Waterfall | helper as ferry (A) / Lucario–Empoleon question (B) |

## Confidence notes
"Required to finish" isn't in any dataset I can reach. Bulbapedia is blocked from this environment, and Emerald is the only one of these games with machine-readable randomizer logic. Crystal Waterfall (~75%), Platinum Waterfall (~85%) and Platinum Defog-optional (~80%) still need a source or your memory of the playthrough.
