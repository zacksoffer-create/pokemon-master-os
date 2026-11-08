# The organism (v2.8)

Zack, 2026-11-08: *"I want to do a better job treating the pokemon as real organisms instead of a character with 4
moves especially when it comes to this lens. I think we need to do a better job with each individual pokemon and then
again on the individual level with egg moves and move sets and abilities and what not to paint a better picture of how
surviving is happening."*

v2.7 put teams in real places. v2.8 puts animals in them. It works in two layers, and both feed survival:

1. **The species as an animal.** What it is like to live alongside: its body, how it moves, what it eats, the water
   and climate it needs, its senses, defence, social life, and when it's about.
2. **The individual on top.** What is its own: how it came by each move and what each is for away from battle, its
   ability read as biology, its nature's flavours, its characteristic, and where it grew up.

The expedition reads both. The planner shows each member as an animal at the place, and every day of a run has a camp:
who feels the cold, the heat or the rain, who eases it, who keeps watch, and who found food.

## What you can see

| Where | What |
|---|---|
| An individual in the wild `#/pokemon/<id>/wild` | Linked from the builder's Wilderness card. **The animal**: about, its body, how it moves, what it eats, water, climate, home ground, senses, defence, social life, its day, and what it needs on the trail (rations, water, climate). **Its own story**: where it comes from (and its home ground if met in the wild), its nature's liked and disliked flavours, its characteristic. **Its ability, read as biology.** **Its moves, as it lives with them**: how it came by each one (level-up, inherited, TM or HM, tutor, hatched with it) and what each is for away from battle. **What it brings in the wild**, by standing. **The conditions, on its body.** |
| The planner `#/expedition` | **The team in the wild**: each member at the place this season. Who feels a condition on what share of days and who eases it, who is at home in it, what each eats and drinks, and the night watch. |
| A run's field journal | Each day's camp lines, tagged *camp*, *night* and *food*. A condition nobody can ease makes the day hard going. |

## Where every line comes from

Every line carries its class, and the classes are never blended:

| Class | Comes from |
|---|---|
| **the game** | Pokédex data (height, weight, colour, body shape, the Gen 3 habitat), the habitat engine's water, the games' encounter times, the learnsets, the TMs and HMs, characteristics and natures' flavours. |
| **the Pokédex** | Canon entries, picked for each part by keywords (`dex_keywords`), HeartGold and SoulSilver first. Also dossier lines that restate them. |
| **reading** | Blackthorn's inferences: what a type says about a body, how a body shape moves, the climate from the habitat engine, the food webs' diet guild, abilities as biology, and the type chart as physiology. |
| **dossier draft** | The first line of each survival section of the 127 dossiers written so far, until you approve them. |

Nothing is re-derived. The organism is a lens over what Blackthorn already holds: Field Biology, the dossiers, the food
webs, the habitat engine, the breeding pack's learnsets and the capability engine. A correction made in any of those
shows up here.

## How it works

- **How it came by a move.**
  - The game's learnsets for its version group, through its pre-evolutions:
    - the lowest level-up level, and the stage that learns it;
    - egg moves;
    - tutors;
    - the Light Ball;
    - the game's own TMs and HMs (from `pokeref.sqlite`, packed as a bit per machine).
  - Each move gets the likeliest story for this individual, in this order (A-141):
    1. hatched knowing it, when it's in its hatch moves (and inherited, if it's an egg move);
    2. level-up;
    3. a TM or HM;
    4. a tutor;
    5. an egg move.
- **Its ability as biology.**
  - Fifty abilities have a reading.
  - Those that bear on getting by name capabilities, for example Thick Fat for cold and heat tolerance. They count only for an individual that has the ability, as a new evidence kind, `trait` (B · inferred, plausible).
  - Plausible never counts as ready. You approve a world record to make it count (A-137).
- **Its characteristic.**
  - The Gen IV text for its best IV: the stat, and the IV mod 5.
  - A tie is reported as a tie, because the game breaks it with the personality value, which isn't kept.
- **The conditions.** Read from the type chart, using the type that bites against its types and ability (A-138):

  | Condition | Type | Where and when |
  |---|---|---|
  | The cold | Ice | ice caves, alpine ground, snow and blizzards |
  | The heat | Fire | a heatwave |
  | The rain | Water | rain and storms |

  - Super effective is hard on it. Resisted means it's at home.
  - A teammate or the kit eases a hard condition: heat source for the cold, water supply for the heat, camp making for the rain (A-139).
  - The organism pack carries a copy of the battle engine's chart and defensive abilities, held equal to `rules.py` by a test.
- **The camp, each day of a run.**
  - Exposure, eased (handled) or not (a strain).
  - Who is at home in the conditions.
  - The night watch: the first member about at night in the games' own tables, else Insomnia or Vital Spirit (A-140).
  - Who brought in food when foraging gained some.
  - The camp draws nothing from the seed. The same run with and without it meets the same weather, hazards and wildlife.

## Files

| | |
|---|---|
| Rules | `engine/biology/organism.json`: type and body readings, shape movement, habitat words, Pokédex keywords, ability traits, exposure, learn and origin wording, camp lines |
| Pack | `engine/app/organism_pack.py` writes `engine/app/data/organism.json` (`export.py` runs it after Field Biology) |
| Engine | `engine/biology/organism.py`; the browser's `engine/app/web/44_organism.html`. Ability traits live in `capability/assess.py` and `web/34_capability.html`. The camp in the run lives in `wilderness/expedition.py` and `web/41_wild.html`. |
| Pages | `engine/app/web/45_organism.html` (the individual's page and the planner's team in the wild); the journal's camp lines are in `web/42_wild.html` |
| Tests | `Organism` in `engine/tests/test_engines.py`; `engine/app/test_organism_parity.mjs` (6732/6732: every sheet, 2278 learn origins, portraits, characteristics, exposure, camps); `engine/app/test_wild_parity.mjs` (270/270 with the camp); `engine/app/test_organism.mjs` (the pages, in Chromium) |

## The calls behind it

D-084 in the ledger, with A-137 to A-143 in `docs/design/ASSUMPTIONS.md` and in Your calls. All of them are reversible.
The ones most worth a look:

- **A-137, abilities as biology.** Which abilities count toward what. The list is in `biology/organism.json → traits`.
- **A-139, what exposure costs.** It's a strain, never a setback. The alternative is a setback at 4× with nobody to ease it.
- **A-141, the order of a move's story.** Your records keep hatch moves but not when each move was taught.

## What's next

- A species page in the wild for any Pokémon, not only yours, from the Natural history pages.
- Recording how an individual actually learned a move ("taught by HM03 in Goldenrod"), so the story stops being the likeliest one.
- Food from the sheet in the run: a grazer forages where a predator hunts, and the food webs say who eats whom at the place.
- Approving a plausible trait from the individual's page with one tap, as on a facility page.
