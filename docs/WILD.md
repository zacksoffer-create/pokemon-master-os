# The Wild (v2.7)

Zack, 2026-11-08: *"Can you give a shot to build out the estate and wilderness side, I'll give you complete creative
control, you know the premise and the intent."*

The premise is the survival and homestead spec's central question: *what does it actually mean to live, travel, survive,
and operate a functioning homestead alongside Pokémon?* The estate (v2.5) answered the homestead half as a set of
jobs. v2.7 answers the travel half with real places, and puts the estate in time. Expeditions join the two: they leave
from Blackthorn's gates, take the team's capabilities with them, eat from the Glasshouse's stores, and leave jobs
uncovered at home while they're away.

## What you can do

| Page | What it is |
|---|---|
| The Wild `#/wild` | The games' own map of Johto and Kanto, 95 places. Each place is coloured by one of your teams' readiness for its critical needs, and listed by region. |
| A place `#/wild/<place>` | Who lives there morning, day and night (HeartGold's or SoulSilver's tables), what its ground calls for and why, the field moves its tables point to, the weather by season, and the way from Blackthorn. |
| The planner `#/expedition` | A team, a place, a season, days there and kit. You get the route, how long it takes, provisions (and whether the stores cover them), the readiness report, cartridge readiness for the field moves, and who'd be missed at home. |
| The run | Optional. A seeded field journal, day by day. Run it again for another seed, run the odds over 24 seeds, or keep it. |
| The field log `#/fieldlog` | The expeditions you kept (Journal rows) and the life list of every wild Pokémon their runs met. |
| The estate in time | A strip on `#/estate`, plus `#/estate/season` (the highlands' weather and how each resident fares outside), `#/estate/stores` (a week of the Glasshouse against a week of rations) and `#/estate/day` (who is about morning, day and night, and what it does). |

## Where every number comes from

Three classes, kept apart on every screen:

- **mechanic.** The games' own data:
  - the map's links, from the HeartGold decomp (path, cave, sea, the Magnet Train and the S.S. Aqua);
  - the encounter tables and their morning (4–10), day (10–20) and night (20–4) windows;
  - each place's encounter methods. Surfing tables mean water to cross, Rock Smash means breakable rocks, rods mean fish;
  - Gen IV berry growth times and best harvests.
- **inferred.** Blackthorn's reading of each place: its biome, elevation and water (biology/johto.json and kanto.json). The capability needs that follow from a biome are listed as such.
- **creative.** Blackthorn-world models, all editable in `engine/wilderness/wild.json`:
  - the seasons;
  - the weather mix;
  - the hazards and how they resolve;
  - the run's constants;
  - the stores' plots and rations;
  - how a season treats a resident outdoors.

The capability engine (`capability/assess.py`, `web/34_capability`) does all the assessing. A place becomes a scenario
of needs, and the existing world report, cartridge report and facility reports read it. Nothing is assessed twice.

## How it works

- **A place's needs.**
  - Three needs come with every night out: camp making, field healing and deterrence.
  - Its biomes and elevation add their needs, for example an ice cave's cold tolerance (critical).
  - The game's encounter methods add more, for example Surf where there are surfing tables.
  - Each need keeps the highest priority among its sources and lists all of its sources.
- **The way there.**
  - A breadth-first route over the map's links from Blackthorn City.
  - Sea links add water travel (critical). Cave links add light.
  - Three legs make a day.
  - A team that can fly (air travel ready) flies to the town nearest the place, if that's shorter.
- **The plan.**
  - The capability engine's world report on the merged needs.
  - Cartridge readiness for the field moves the tables point to.
  - Provisions for the whole trip, there and back.
  - The season's weather.
  - Who'd be missed at home: every facility job that someone on the trip can staff and nobody left at home can (and the land doesn't meet).
- **The run** (`simulate`, seeded mulberry32, identical in Python and the browser).
  - Each day draws its weather from the place's mix. A place that is all cave is sheltered.
  - Every hazard whose weather or ground is present is resolved against the team's best standing on each capability it needs:
    - handled, when every need is covered or equipped;
    - hard going, when one is only teachable, plausible or waiting for your approval;
    - a setback, when one is a gap.
  - One wild Pokémon is drawn per window from that window's table. A team that can travel on water meets the surfing table a third of the time.
  - Food carried is the trip's rations plus a reserve day. Foraging gives back a quarter of a day's rations where the land allows.
  - Three setbacks, or an empty larder, turn the team for home.
- **The odds.** Seeds 1 to 24: how many runs got through, setbacks and hard days per run, what set them back, and the wildlife most seen.
- **The estate in time.**
  - Season card: the weather over Blackthorn City, and each resident outdoors by its type-driven climate.
  - Stores: each crop's harvests in a week of continuous growing (Gen IV hours), times its best harvest, times its plots, against the residents' rations by body size.
  - Day: a resident is up in the windows its kind appears in the wild in HeartGold or SoulSilver (or its line's), and its work is the jobs it can hold.

## Files

| | |
|---|---|
| Rules | `engine/wilderness/wild.json` |
| Pack | `engine/app/wild_pack.py` writes `engine/app/data/wild.json` (and `export.py` runs it) |
| Engine | `engine/wilderness/expedition.py`; the browser's `engine/app/web/41_wild.html` |
| Pages | `engine/app/web/42_wild.html` (the Wild, places, planner, field log), `engine/app/web/43_estate_life.html` (season, stores, day, the strip) |
| Tests | `Wild` in `engine/tests/test_engines.py`; `engine/app/test_wild_parity.mjs` (all 95 places, 8 expeditions with seeded runs and odds, the estate's year: 246/246); `engine/app/test_wild.mjs` (the pages, in Chromium) |

## The calls behind it

D-083 in the ledger, with A-127 to A-136 in `docs/design/ASSUMPTIONS.md` and in Your calls. All of them are reversible.
The ones most worth a look:

- **A-128, the weather model.** The games have no seasons, so every number in it is Blackthorn's.
- **A-129, when a team turns back.** Three setbacks.
- **A-133, the stores.** The Glasshouse out-grows the residents by a wide margin, because Gen IV berries grow fast. That
  makes the surplus the expeditions' larder.

## What's next

- Approving world records from the planner. A plausible cold tolerance (Lapras, Ice type) could become yours with one tap, as it can on a facility page.
- Expedition objectives per place: reach Mt. Silver's summit, find the Dragon Shrine.
- The 6v6 seam for wild battles on the way.
- Time on the estate: the Apricorn trees outside the glass through the seasons, Kurt's Poké Balls from the Workshop.
