# Pokédex pattern audit (A-42, 2026-10-26)

The wilderness engine (`engine/wilderness/engine.py`) and the capability records (`engine/capability/records.py`,
`engine/capability/model.json`) read Pokédex entries with patterns. A match says "its Pokédex says X, so it could Y".
The capability pages, the Survival Lab, the Homestead, the profiles and the ranch all show those readings.

Four patterns had already been narrowed in Phase 7 ('not used for flying', 'dangerously', 'can be seen from far
away', a bare mention of the sea). Zack's answer to call A-42: *"Keep: and fix any other pattern that reads too broad
or too narrow, if possible."*

So every pattern was run over every entry the engine reads, and the matches and near misses were read one by one.

## How it was checked

- **The text.** Every English Pokédex entry from Gold to SoulSilver for species 1-493 (PokeAPI's flavor text,
  versions 4-16): 5,148 entries. A species has a capability when any sentence of any of its entries counts. The game
  only decides which entry is quoted.
- **Wrong readings.** Every sentence each pattern matched was read. A reading is wrong when the sentence doesn't say
  the Pokémon can do the thing: a negation ("cannot fly"), a comparison ("as if it were flying"), an idiom ("sends foes
  flying"), a body part named but not the ability ("sharp claws"), another Pokémon or a person doing it, the thing
  happening to it ("if a foe grabs it"), or the opposite ("dislikes cold places").
- **Missed readings.** For each capability, a wider search (synonyms, other verb forms, other wordings across the
  generations) listed the sentences the pattern didn't catch. Those were read too.
- A pattern was changed only where the entries were clear. Where a change would trade one error for another, it was
  left alone (see the end).

## How an entry is read now

Three rules apply to every pattern, in `wilderness/engine.py` (`lore_text`, `lore_reads`). The capability records use
the same function for the eight newer patterns, so both read entries the same way.

| Rule | Why | What it fixed |
|---|---|---|
| **Words broken across lines are joined.** Gen II and III entries split words with a soft hyphen ("drown­ ing", "light­ ning"); some use a hyphen and a space ("snow- white"). Curly apostrophes become straight ones. | The old patterns saw "light" in Pikachu's *light­ ning*, and no rule written "can't" could see *can’t*. | Porygon2 loses air travel ("It can’t fly, however"); Phanpy loses heat tolerance ("the desert­ ed morning hours"). The exclusions now work for Burmy and Cacturne ("When it’s hot", "the desert’s heat"), Cleffa ("me­ teors illuminate"), Glalie ("won’t melt"), Gyarados ("doesn’t calm"), Heracross ("the foe’s grasp"), Hoothoot ("the earth’s rotation") and Vulpix ("snow- white"). |
| **A negated match doesn't count.** "not", "never", "cannot", "unable to", "inability to", "poor", "too … to", "without" up to two words before the match cancel it. "Not only" doesn't. | "Bagon … its inability to fly", "a poor swimmer". | Bagon, Doduo and Porygon2 lose air travel, and Magnemite ("becomes incapable of flight") doesn't gain it; Magikarp, Qwilfish and Spheal lose water travel; Gyarados loses calming presence ("doesn't calm"). |
| **Except for tolerances.** The negation rule is off for cold and heat tolerance. | Spheal: "it never feels the cold" is the evidence. | Spheal keeps cold tolerance. |

## Every rule the engine uses

| Rule | Where | Feeds | Checked here? |
|---|---|---|---|
| 18 field moves (Cut, Fly, Surf, Strength, Flash, Whirlpool, Waterfall, Rock Smash, Headbutt, Dive, Rock Climb, Defog, Dig, Teleport, Soft-Boiled, Milk Drink, Sweet Scent, Secret Power) | `FIELD_MOVES`, per game in `GAME_FIELD_MOVES` | climbing, water travel, underwater, air travel, light, hauling, clearing, foraging, weather, escape, digging, field healing, camp making | Game mechanics, not text. Unchanged. |
| 15 overworld abilities (Pickup, Honey Gather, Flame Body, Magma Armor, Intimidate, Keen Eye, Stench, White Smoke, Sand Veil, Snow Cloak, Illuminate, Suction Cups, Sticky Hold, Static, Magnet Pull) | `FIELD_ABILITIES` | foraging, egg care, deterrence, weather | Game mechanics, not text. Unchanged. |
| 16 Pokédex patterns and their exclusions | `LORE_PATTERNS`, `LORE_EXCLUDE` | rescue, light, air travel, water travel, hauling, digging, heat source, cold tolerance, danger sense, scouting, calming presence, food source, cooking, field healing, night travel, plant care | Yes, below. |
| 8 Pokédex patterns and their exclusions | `capability/model.json` `lore`, `lore_exclude` | manipulation, construction, electricity, tracking, navigation, water supply, cold source, heat tolerance | Yes, below. |
| Type: Fire, Ice | `_inference`, `model.json` `types` | heat source, cold tolerance; heat tolerance, cold source, electricity (Electric) | A type is not text. Unchanged. |
| Size: 1.5 m and 60 kg or more; 1.2 m and 60 kg or less | `_inference` | carrying a rider; town fit | Unchanged. |
| Gen 3 Pokédex habitat | `_inference` | mountain and rough terrain → climbing, sea and water's edge → water travel, forest and grassland → foraging, urban → town fit, **cave → light** | Yes: cave changed, below. |
| Gen 4 Pokédex body shape | `model.json` `shapes` | manipulation (arms, two legs, tentacles), hauling (large four-legged) | Already reads wings as nothing. Unchanged. |
| Equipment rules (layer C) | `model.json` `layer_c` | follow from the readings above | They change only because the readings under them changed. |

## The audit, pattern by pattern

Counts are species (of 493) whose entries the pattern reads, before → after.

| Capability | Read wrongly before (examples) | Missed before (examples) | Change | Species |
|---|---|---|---|---|
| **Rescue** | none | Azumarill: "It makes these air balloons if it spots a drowning POKéMON." Ampharos: "It acts as a beacon for lost people." Delibird: "tales about lost people who were saved by its stored food." Kyogre: "This POKéMON saved people who were suffering from droughts." | Added "saved people", "people who were saved", "spots a drowning", "beacon for lost". | 3 → 7 |
| **Light** | Any "light", "bright" or "shine": Breloom "light and sprightly footwork", Seel "light blue fur", Rhyhorn "not too bright", Meowth "It loves anything that shines", Venonat "attracted by light at night", Latias "refracts light", Steelix "reflect bright light", Illumise "leads a flight of illuminated VOLBEAT", Torchic "glowing with warmth", Celebi "a bright and shining future". 33 species. | Chinchou: "its constantly flashing lights". Flaaffy: "its tail lights up". | "Light" now has to be given off: glows, shines, lights up, emits, gives off, casts, flashes, beams of light, its light. A light-coloured body, light weight, and light that falls on it, attracts it or bounces off it don't count. | 64 → 33 |
| **Air travel** | Azurill "sends its body flying"; Hariyama "send a 10-ton truck flying"; Nidoqueen, Phanpy (the same); Clefable "as if it were flying"; Bagon "In doomed efforts to fly" and "dreaming of one day flying"; Doduo "its poor flying"; Porygon2 "It can’t fly"; Grovyle "flies from branch to branch"; Mankey "flies into an uncontrollable frenzy"; Flareon "its temperature can soar"; Vulpix "making fiery orbs fly"; Pineco "flying-insect prey". | Gliscor: "Its flight is soundless." Noctowl: "make no sound in flight." Illumise: "leads a flight of … VOLBEAT". Shaymin: "confers the power of flight upon it". Azelf, Uxie: "When AZELF flew …". | Added "flight", "flew", "flown". Excluded those idioms and comparisons. Also excluded: Scyther "It very rarely spreads its wings to fly", Dunsparce "It can fly just a little", Vibrava "it can only fly short distances": they say the Pokémon can't fly anyone anywhere. | 65 → 55 |
| **Water travel** | Drifblim: "It carries people and Pokémon when it flies" (that's air). Magikarp "unable to swim against even slow-moving currents", "Its swimming muscles are weak". Qwilfish "a poor swimmer", "finds swimming somewhat challenging". Spheal "poorly shaped for swimming". | none found | Negation rule; excluded "when it flies" and the two Qwilfish and Magikarp phrasings. Lotad keeps it ("serves as a ferry to Pokémon that can't swim": only "swim" is negated). | 50 → 46 |
| **Hauling** | Any "carry" or "lift": Bulbasaur "It carries a seed on its back", Butterfree "carry honey", Hypno "carries a pendulum-like device", Marowak "the bone it carries", Murkrow "It is said to carry misfortune", Raikou "The rain clouds it carries", Lairon "The sound of their collision carries for miles", Kingler "It can hardly lift its massive, overgrown pincer", Snorlax "too lethargic to even lift a finger". 17 species. | Swampert: "It can swim while towing a large ship", "easily drag a boulder weighing more than a ton". Numel: "can transport a 220-pound load". Yanmega: "capable of transporting an adult in flight". Regigigas: "towed continents with ropes". | Carrying, lifting, dragging or transporting now has to name something heavy: boulders, rocks, trucks, cargo, a load, goods, people, an adult, ships, logs, Pokémon. Added "tow", "twice its weight", "lifts and throws". Excluded "in tow" (Honchkrow's followers) and "drags its heavy body". | 31 → 18 |
| **Digging** | The pattern `\bdig` read *digest*: Gulpin, Swalot, Snorlax "Its stomach can digest any kind of food". Heatran: "It digs in with its cross-shaped feet to crawl on ceilings". | Graveler: "by gouging out numerous horizontal holes". Hitmontop: "it may bore its way into the ground". Larvitar: "must eat its way through the soil above". Seaking: "It bores a hole in a boulder". Shuckle: "carves holes in rocks". | Whole words only (dig, digs, digging); added boring, gouging and carving holes; excluded "digs in with". | 32 → 33 |
| **Heat source** | Glaceon: "By controlling its body heat, it can freeze the atmosphere". Rhydon: "protects it from even the heat of lava". Weather and places: Bellsprout "prefers hot and humid environments", Chimecho and Sunflora "the hot season", Cacturne "the desert's heat", Gible "geothermal heat", Swinub "roots out hot springs", Taillow "in search of warmth", Steelix "high pressure and heat", Burmy "When it's hot", Cascoon "It is hot inside its cocoon", Seadra "It became a hot topic". | Fire named as "fire" or "fiery": Arcanine "The fire that blazes wildly within its body", Infernape "Its fire never goes out", Monferno, Ponyta. Torkoal: "It burns coal inside its shell". Manectric: "The sparks sometimes ignite forest fires". | Added "its/the fire", "fiery", "embers", "ignite", "burns coal". Excluded the weather, place and opposite readings. | 41 → 34 |
| **Cold tolerance** | The cold as a problem: Taillow "It dislikes cold seasons", Pinsir "movements turn sluggish in cold places", Magmar "It dislikes cold places", Gible "To avoid the cold", Numel "When it grows cold, the magma hardens", Ledyba "When the weather turns cold … keep each other warm", Burmy "to shelter from the cold", Buneary "On cold nights". Not the cold at all: Vulpix "snow- white tail", Geodude "a snowball fight", Duskull "freeze in utter fear", Sunkern "a cold summer", Jumpluff "encounters cold air", Regigigas "out of clay, ice, and magma". | Prinplup: "It searches for prey in icy seas." | Excluded those; added "icy seas/waters/ground/mountains" and "frigid". | 40 → 24 |
| **Danger sense** | "Sense" as a noun or another sense: Hitmonlee "sense of balance", Hoothoot "a perfect sense of time", Pidgey "sense of direction" (that's navigation), Arcanine "a sense of majesty", Machoke "a sense of strength", Stantler "lose control of their senses". Feelings: Blissey "senses sadness", Shaymin "senses gratitude", Latios "sense their emotions". Being in danger: Kadabra "The more danger it faces", Kakuna "when it is in danger", Gloom, Girafarig, Poliwhirl. | Electrike: "It gives off sparks if a storm approaches." | Excluded "sense of …", plural senses, feelings, and being in danger; added "if a storm approaches". | 61 → 45 |
| **Scouting** | "Distant" in time or reach: Aerodactyl, Bronzor, Magikarp "the distant past"; Hitmonlee "hit a distant foe". Duskull: "passing through walls" (moving, not seeing). | Pidgeot: "Its outstanding vision allows it to spot splashing MAGIKARP, even while flying at 3300 feet." Pidgeotto: "It has outstanding vision", "keeping a sharp lookout". Sentret: "It stands on its tail so it can see a long way". Doduo, Girafarig: "keep watch". Yanma: "It can see 360 degrees". Noctowl: "superior vision". Swampert: "powerful vision". | "Distant" only with sounds or flowers (Clefable, Nidoran♂, Butterfree keep it); added vision words, "see a long way", "lookout", "keep watch", "360 degrees". | 9 → 13 |
| **Calming presence** | Gyarados "its ferociously violent blood doesn't calm"; Tauros and Vigoroth "to calm itself"; Gloom "feeling calm and secure"; Mantine, Pelipper "the waters are calm"; Hoppip "gentle breezes"; Starmie "gentle waves"; Lugia "calm raging storms" (weather). | Chikorita: "becalming the battling POKéMON". Roselia: "Its scent deeply relaxes people." Snorlax: "such a docile POKéMON that there are children who use its big belly as a place to play". Chansey: "A kindly Pokémon". Togekiss: "gifts of kindness". Growlithe: "Very friendly and faithful to people." | Added "becalm", "kindly", "kindness", "relaxes/relaxing", "docile", "friendly". Excluded calm water and wind, calming itself, and "docile-looking". | 24 → 33 |
| **Food source** | Honey it eats, not makes: Heracross "It loves sweet honey", Mothim "it won't gather any itself", Vespiquen "honey collected by COMBEE", Gloom's "horribly noxious honey", Victreebel's honey lure. Nutrition it takes in: Lairon, Roselia "nutritionally rich springwater", Sunflora "converts solar energy into nutrition", Misdreavus. Slowpoke: "Although not nutritious". Azurill: "Its tail … is packed with nutrition". | Tropius: "Children of the southern tropics eat as snacks the fruit that grows in bunches around the neck". Blissey: "the delicious eggs that BLISSEY provides". Shuckle: "The berries eventually ferment to become delicious juices." Snover: "it grows berries". Grotle: "the berries growing on the trees on its back". Cherubi: "it is also tasty". | Honey only when it collects, gathers, makes or secretes it; nutrition only for eggs, fruit or juice; added delicious eggs and fruit, shared eggs, berries and fruit it grows. Miltank's milk, Chansey's eggs, Combee, Butterfree, Teddiursa and Surskit keep it. | 18 → 12 |
| **Cooking** | none | Shuckle: "The berries eventually ferment", "mixed with BERRIES to make a drink". | Added "ferment", "to make a drink". | 1 → 2 |
| **Field healing** | "Heal" read *health*: Charmander "If it is healthy", Magby, Swellow, Turtwig, Roselia, Lunatone. Meganium "It can make them healthy again" (plants). Healing itself: Magmar "It can heal itself by dipping its wound into lava", Moltres. "Restore" for land and wings: Aggron, Skarmory. Gabite: "a long-held belief that medicine made from its scales will heal". | Chansey: "it shares its eggs with injured people". Blissey keeps it ("nurses sick Pokémon to health"), and so do Bayleef ("The aroma acts as a stimulant to restore health") and Miltank ("the ultimate beverage for the sick or weary"). | Whole words (heal, heals, healing); "restore health", "back to health", "nurse", "with injured", "for the sick"; excluded healing itself and the medicine belief. | 15 → 4 |
| **Night travel** | Sleeping at night: Bellossom, Combee, Weepinbell, Sandshrew, Shellder, Slakoth, Pinsir, Pikachu. Stopping: Sunflora "closes its petals and becomes still". The opposite: Torchic "dislikes darkness because it can't see". Light at night, not moving: Charmeleon, Electabuzz, Finneon, Raichu. Other: Corsola "grows it back in just one night", Lugia "seen on the night of a storm", Taillow "cries at night", Starmie. | "Nights" (plural): Darkrai "It is active during nights of the new moon", Clefable "strolls on lakes on quiet, moonlit nights", Wynaut. Delcatty: "It is nocturnal". Huntail: "see clearly even in the murky dark depths". | Added "nights", "nocturnal", "in the … dark". Excluded sleeping (unless it sleeps by day: Dewgong and Lombre keep it), stopping, glowing, and the rest. | 61 → 47 |
| **Plant care** | "Flowers bloom" anywhere: Abomasnow "when the snow flowers bloom", Cacnea "Its yellow flowers bloom once a year", Butterfree "flowers blooming over six miles away". | Celebi: "Grass and trees flourish in the forests in which it has appeared." Sceptile: "carefully grows trees and plants". Aggron: "plant trees". Diglett: "leaves the soil perfectly tilled". Oddish: "sows seeds". Shaymin: "transform ruined land into a lush field of flowers". | Replaced "plants/flowers/trees grow or bloom" with tending, planting, sowing and tilling. | 6 → 9 |
| **Manipulation** | Body parts named, used as weapons or for walking: Zangoose "Its sharp claws are its best weapon", Kabutops, Charmeleon, Toxicroak, Sandslash, Sneasel, Krabby "The pincers break off easily", Infernape "fire on its hands". Other hands: Taillow "On the other hand", Squirtle "prodding fingers will bounce off it", Drifloon "tugs on the hands of children". Being grabbed: Barboach "If a foe grabs it", Persian, Tangela. 38 species. | Marowak: "The bone it holds is its key weapon." Farfetch'd: "The plant stalk it holds". Shiftry: "the fans it holds". Staraptor: "fly while gripping a small Pokémon". Machop: "pick up a GRAVELER". Phanpy: "pick up and carry an adult human". Chimecho, Fearow, Spearow: "pluck". | Needs a gripping or handling verb now (grip, grab, grasp, clutch, hold, pick up, pluck, ensnare, constrict, handle, manipulate, hang on to), or catching with a named body part. Being grabbed, psychic "manipulation", and Heracross "slips beneath the foe's grasp" excluded. Body shape still gives it to two-legged and armed Pokémon. | 65 → 43 |
| **Construction** | "Build" as a physique or as building up: Furret "a very slim build", Dragonite "an impressive build", Machop "build its muscles", Camerupt "If magma builds up", Mareep, Pikachu, Raichu, Snorlax. Corsola "communities that are built on groups of these POKéMON" (people built). Bronzong "a construction site". Toxicroak "weaves its flexible body". Octillery "steals the nest of a fellow OCTILLERY". | Bibarel: "It makes its nest by damming streams with bark and mud". Burmy: "a cloak made of twigs and leaves", "remakes the cloak". Ariados: "It spins string". Swampert: "piles up boulders". Tyranitar: "bring down a whole mountain to make its nest". "Makes its nest": Wingull, Whiscash, Treecko, Seaking, Lairon and others. | Needs something built now: nests, dams, webs, a cloak, a cocoon. Added damming, spinning string or silk, piling boulders, carving or boring a nest. Furret keeps it for the right reason ("It makes a nest to suit its long and skinny body"). | 26 → 23 |
| **Electricity** | none found: every match is an Electric type, Magnemite's own units, or Starmie's "electric waves" | none outside Electric types, which have the type reading anyway | Left alone. | 24 → 24 |
| **Tracking** | Koffing: "constant sniffles". Bayleef: "The scent of spices comes from around its neck", "sniffing it makes you want to fight". Gloom: "It sniffs the noxious fumes". | Ursaring: "With its ability to distinguish any smell, it unfailingly finds all food buried deep underground." Swinub: "If it smells something enticing, it dashes headlong off to find the source of the aroma." Primeape: "it will tenaciously track the target". Ariados: "it tracks the silk to the prey". Sealeo, Piloswine: "a very sensitive nose". | Whole-word sniff; scent of prey; added those. | 9 → 13 |
| **Navigation** | "Compass" read *compassion*: Blissey, Chansey, Latios, Mewtwo, Togepi. Magnetic waves: Beldum "converse with its kind", Magnemite "electromagnetic waves" (floating), Magneton, Magnezone. Suicune "north winds". Omanyte "navigated the sea by adeptly twisting its 10 tentacles" (swimming). | Nosepass: "NOSEPASS's magnetic nose is always pointed to the north", "Travelers check NOSEPASS to get their bearings." Manaphy: "swim great distances to return to its birthplace". Phione: "always returns to where it was born, no matter how far". Dragonite: "leads lost and foundering ships". | Whole-word compass; dropped magnetic waves; added north (not north winds), bearings, returning to its birthplace, leading ships. Onix, Pidgey, Taillow, Corsola keep it. | 18 → 11 |
| **Water supply** | Bonsly: "It leaks water from its eyes". Sharpedo: "jetting water from its rear" (swimming). Corsola: "absorb nutrients from clean water". | Blastoise: "shooting water from the jets on its back". Remoraid: "It squirts water forcefully". Lairon: "makes its nest close to springs of delicious water". | Dropped "water from its" and "stores water"; added shooting or squirting water, water jets and spouts, springs of water. | 7 → 7 |
| **Cold source** | Jumpluff: "it lands when it encounters cold air". | Regice: "Things will freeze solid just by going near this POKéMON", "controls frigid air". Glaceon: "freeze the atmosphere", "lowering the temperature". Shiftry: "create chilly winter winds with the fans it holds". | "Freeze" as well as "freezes"; added freeze solid, frigid air, lowering the temperature, chilly winds; excluded meeting cold air. | 6 → 8 |
| **Heat tolerance** | Clefable "deserted lakes", Phanpy "desert­ ed morning hours" (*deserted*). Swinub "roots out hot springs" (finding them). Salamence "scorching fields" (that's heat source). Regigigas "out of clay, ice, and magma". "Magma" read MAGMAR. | Skorupi: "It lives in arid lands." Bonsly: "It prefers arid environments." | "Desert" but not "deserted"; whole-word magma; dropped "hot springs" and "scorching"; added arid lands and places. Regice keeps it ("it will not melt even if it is immersed in magma"). | 29 → 25 |
| **Cave habitat** (inference) | A cave habitat gave light to 29 species: Zubat ("their eyes gradually grew shut and deprived them of vision"), Golbat, Crobat, Diglett ("If it is exposed to light … it grows weak"), Onix, Gengar, Wobbuffet and others. | Those 29 move in the dark. | Cave now feeds night travel. Light from a cave Pokémon now needs its own Pokédex (Solrock and Sableye keep it that way) or Flash. | light 29 → 0, night travel +29 |

## Left alone, and why

- **"Swim" for water travel.** Water travel means carrying the trainer across water, and most swimmers can't. But
  "swim" is the only Pokédex sign for most water Pokémon. Dropping it would leave Lapras, Floatzel and Lotad and
  nothing else; size already decides who can carry a rider. The negations are out.
- **Flight for small fliers.** Beedrill and Zubat fly but can't fly anyone. The same reasoning as swimming.
- **Floating and hovering** (Claydol "moves about while levitating", Magnemite "floats in the air", Hoppip "drifts on
  winds") were not added to air travel. Floating isn't flying a trainer, and adding it would give air travel to about
  ten levitating Pokémon.
- **"It is said" and legends.** The Pokédex states much of its lore this way (Dragonite "It is said that this POKéMON
  … rescues drowning people"). The lore layer already marks every reading as a candidate, so legends stay.
- **Mind reading in battle** (Gallade, Solrock, Medicham "sense what its foe is thinking"; Espeon "predict … its foe's
  next move") stays danger sense: it is sensing an attack before it lands.
- **"Usually docile, but…"** (Heracross, Wobbuffet) counts as calming. The sentence still says docile.
- **Pollen** (Budew "scatters pollen that induces harsh sneezing", Tropius) stays plant care. The pollen still
  pollinates.
- **Body parts as medicine** (Croagunk's finger fluid "a significant ingredient in remedies", Paras, Seadra's fins and
  bones) were not added to field healing. People make the medicine; the Pokémon doesn't heal anyone.
- **Plusle and Minun's electricity** "promotes circulation and boost vitality". It reads as calming ("relaxes
  muscles") but not as field healing. A therapy claim, not healing a teammate.
- **"Burrow" as a noun** (Furret "lives in narrow burrows", Nidoqueen "its burrow") stays digging. A Pokémon with a
  burrow almost always dug it, and the Pokédex doesn't say otherwise.
- **Sea and water's edge habitats** still give water travel as inference ("native terrain"). It's the weakest layer and
  says only where it lives.
- **Electricity** needed no change.
- **Pidgeotto's talons.** "It immobilizes its prey using well-developed claws, then carries the prey more than 60
  miles" counts as manipulation (holding), not as hauling (the prey isn't heavy).

## Not covered: capabilities with no Pokédex pattern

Climbing, underwater travel, carrying a rider, foraging, camp making, egg care, deterrence, escape, clearing, town fit
and weather handling have no Pokédex pattern at all. They come from field moves, abilities, size, habitat or shape.
The entries say a lot about some of them:

- carrying a rider: Lapras "loves to give people rides"; Phanpy "carry an adult human on its back";
- escape: Abra "senses impending attacks and TELEPORTS away to safety";
- foraging: Swinub "can locate mushrooms, berries, and even hot springs buried under ice";
- clearing: Tauros "will charge at thick trees and knock them down"; Donphan "helps clear rock and mud slides that
  block mountain trails";
- weather: Lugia "an incredible ability to calm raging storms"; Groudon "scatter rain clouds".

Adding patterns for them is a new decision, not a fix, so it's left for a call.

## What changed for species

- **277 species** have a different Pokédex, habitat or equipment reading in at least one game. **221** gained or lost a
  capability outright (counted in HeartGold, or the latest game they appear in).
- **Light** is the biggest change: 33 Pokédex readings and all 29 cave readings were wrong. Zubat, Golbat, Crobat,
  Onix, Steelix, Gengar, Haunter and Diglett no longer count as lights. Chinchou and Flaaffy now do.
- **Air travel**: Bagon, Porygon2, Doduo, Scyther, Clefable and Grovyle no longer fly. Gliscor, Noctowl, Illumise,
  Shaymin, Azelf and Uxie now do.
- **Manipulation**: 38 species whose claws, pincers or tentacles were only weapons lost it. Marowak, Farfetch'd,
  Shiftry, Staraptor, Machop and Phanpy gained it from what they hold or pick up.
- **Construction**: the "build" readings went (Dragonite, Machop, Mareep and others). Bibarel, Burmy, Wingull,
  Tyranitar and the nest-makers came in.
- **Nosepass** is now a navigator. **Swampert** now hauls (towing a large ship) and scouts. **Tropius**, **Shuckle**
  and **Blissey** are food sources. **Chansey** is a field healer from its own entry. **Ampharos** is a rescuer ("a
  beacon for lost people").
- **Gloom** lost five readings (calming, danger sense, food, tracking, and the rescue equipment that followed).
  **Taillow** lost six.

## Tests

`engine/tests/test_engines.py`, class `Capability`:

- `test_pattern_audit_regressions`: 81 cases (species, capability, reads it or not, the entry's words), one per
  misreading fixed, plus three that guard the new rules from going too far (Lotad still ferries, Spheal still never
  feels the cold, Weezing still roams at night).
- `test_a_cave_is_dark_not_light`: Zubat's cave gives night travel, not light.
- `test_the_pokedex_is_no_longer_misread`: the four Phase 7 cases, unchanged.

To check a pattern change: run it over every entry, and read what it gains and loses before keeping it.
