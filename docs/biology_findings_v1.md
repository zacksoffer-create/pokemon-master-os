# Field Biology v1: what the dossier writers found (for Zack's review)

Four writers drafted the 64 cohort dossiers from the evidence packs (engine/data_manifest/biology/evidence/), each
statement labelled and cited, all passing `engine/biology/dossier.py --check`. These are their findings and the
questions they couldn't settle. Each question is also a call in Your calls (A-60 to A-71).

## The game data against the picture
- **Most of your companions can't exist without people.** 13 of the 17 Crystal/FireRed/Emerald companions are never
  wild in any Gen I-IV game. Alakazam and Machamp form only by trade, Espeon and Umbreon need high friendship, and
  Milotic needs a Feebas someone has raised.
- **The highlands, in HeartGold/SoulSilver:**
  - The Dragon's Den holds only Dratini, Dragonair and Magikarp, and Dratini is no longer on Route 45.
  - Delibird is in the Ice Path only in SoulSilver; Zubat holds that slot in HeartGold. Sneasel is in the Ice Path
    only in Crystal, at night.
  - Dunsparce is only at the Violet end of Dark Cave.
  - No game puts Magcargo or Slugma near Blackthorn.
  - Absol's Ice Path and Dark Cave records come from one Hoenn radio slot copied into every cave, so they aren't a
    native population.
- **Ilex Forest is two forests:** HeartGold has Caterpie, Metapod and Butterfree (ending in a pollinator); SoulSilver
  has Weedle, Kakuna and Beedrill in the same slots (ending in a predator).
- **Magnezone can't be made in Johto:** it needs Mt. Coronet's field.

## Contradictions worth a ruling
- **Body and behaviour:**
  - Feraligatr runs on all fours out of water in some games and charges on its hind legs in others.
  - Caterpie has one feeler in some entries and two in others.
  - Zubat's eyes are grown shut, or it has none.
  - Umbreon ambushes from the dark, yet its rings glow at nightfall.
- **Life history:**
  - Goldeen spawns in spring, but the Seaking entries say autumn.
  - Lapras declined from overhunting in some entries and from capture in others.
  - Mamoswine was dug from soil in Platinum and from ice in HeartGold.
  - Larvitar can't see its "parent" in Ruby/Sapphire and its "parents" in Emerald.
  - Munchlax forgets its hidden food in some entries and swallows it in others.
- **Fact or folklore:** several claims are stated as fact in one game and as "it is said" in another. These are
  Dragonite's rescues, Alakazam's IQ of 5,000, Machamp's throws over the horizon, and Charizard's fire getting
  hotter with experience.

## Gaps
- **Diets:** nearly every companion's diet is unstated. Where the line says nothing, the guild was left empty
  (Dragonite, Typhlosion, Lapras and nine others) rather than read from type.
- **Ilex Forest:** no decomposer of any kind, and the pond's whole base is hypothesis. Every link between two
  Pokémon is a hypothesis: no entry names a predator and its prey inside the community.
- **The highlands:** no producer or decomposer inside the caves. The energy base is moss on rock, droppings of
  Pokémon that feed outside, and shed skin (the last canon). Golbat is the only predator anyone can point to.

## Questions only you can settle
1. **Magcargo:** does it stay in the highlands, and do the highlands have geothermal ground (vents or hot springs)?
   Without that it has nowhere to live.
2. **Which Ice Path:** HeartGold's (Zubat in Delibird's slot), SoulSilver's, or both?
3. **Lines filed in different guilds:**
   - Golbat as a predator, but Zubat and Crobat as parasites.
   - Dratini and Dragonair as low-confidence predators, but Dragonite with no guild.
   - Psyduck as an omnivore, but Golduck as a piscivore.
4. **Ilex Forest:** one web holding both bug lines (as the National Park contest does), or one web per version?
5. **Radio-only species** (Budew, Carnivine, Spoink, Numel in Ilex Forest; Absol, Makuhita, Chingling, Bronzor in the
   caves): are they part of the community?
6. **Borrowing from relatives:** how far may a dossier lean on an evolved form's entries and on level-up moves when a
   species says nothing (Zubat's blood-feeding comes from Golbat's entries and Leech Life)?
7. **Breeding:** how does all-female Miltank breed in the wild? Is Tauros the partner?
8. **Sex ratios:** is the 87.5%-male ratio of the starter lines biology, or a game convention?
9. **People:** can Espeon, Umbreon, Milotic, Alakazam or Machamp ever form without them?

## Data fixed along the way
- **Capability records that misread entries:**
  - Weedle, Oddish, Zubat and Noctowl were read as light sources (from "bright-coloured", "moonlight", "avoids light"
    and "faint light").
  - Kakuna was read as a heat source (its shell gets hot as it develops).
  - Pineco was read as capable of air travel ("flying insect prey").
  - Machamp was read as a calming presence ("every kind of martial arts") and as capable of air travel ("knocked
    flying").
  - All are now excluded (`engine/wilderness/engine.py` LORE_EXCLUDE).
- **Still open:**
  - The encounter data has no Crystal records for the Mareep line.
  - Gold and Silver's Route 38 table has a Miltank "swarm" slot that looks like an artifact.
  - Milotic's evolution data lists a Prism Scale trade, an item that doesn't exist in Gen III-IV.
