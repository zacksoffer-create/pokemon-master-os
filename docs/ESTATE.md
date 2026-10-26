# The Estate (v2.5)

Zack, 2026-10-26: *"I think I want you to try to figure out the estate/homestead/glasshouse vision. It's all a part of
it so just you know kinda how it's been described, take the reins and build it."*

The estate is one compound you drill into: the estate, then a facility, then its jobs and who could hold them. It's
built from what you've already decided (the decision numbers are in the ledger) and from your teams. Nothing on it is
generated: if nobody of yours holds a job, the page says so.

## What it is, in your words

- A breeding ranch for a retired champion with unlimited money and land, run with the power of Pokémon (D-035).
- Written in the past tense: the Pokémon are retired, and the ranch is the centrepiece (D-042).
- *"It's all about the breeding stock. It's not really about the parent."* (D-079)
- A hatchery and a greenhouse woven into one building: the Glasshouse (D-041, D-045).
- *"The compound should feel like a real place inhabited and operated by Pokémon, not a generic menu of buildings that
  passively generate points."* (the homestead spec)
- The one open part is the Day-Care, *"the day care center gazillionaire edition… more wildlife preserve with daycare
  aspect"* (D-040), for *"other amazing trainers"* (D-079).
- One headquarters in the Blackthorn highlands (D-041) and one satellite: *"Oh, definitely Sevii Islands."* (D-079)

## The pieces

| Piece | Where | What it reads |
|---|---|---|
| The estate | `#/estate` (`#/homestead` opens it too) | The map, both sites, the 14 facilities, the residents' land, the nursery pens, the world records and the resident table. |
| A facility | `#/facility/<id>` | Its jobs. Each job shows who of yours can hold it (a game mechanic or your record), the land if it meets the job, candidates on other evidence (each with an Approve button), and what could be built. It also has Suggest a staff plan, Save, and plan B to compare. |
| The Glasshouse | `#/glasshouse` | Six tabs: the building in plan, eggs and walking, berry cultivation, environment, nutrition, and the studbook. |
| The Day-Care preserve | `#/preserve` | The design, its jobs against your residents, what isn't decided, and who could be a client. |
| The Sevii Islands | `#/sevii` | The satellite's game facts, who lives there, and the wild Pokémon in every Sevii place. |
| A place | `#/estate/blackthorn-city`, `#/estate/geothermal` | The headquarters' game facts and land; the geothermal ground, with the jobs it meets. |

## How it's computed

`engine/app/estate_pack.py` writes `app/data/estate.json`, which holds only reference and design, never your records:
- the two sites and what land each offers;
- every Gen I–IV species' habitat (`ranch/habitat.py`);
- each line's egg cycles, egg groups and gender rate;
- Gen 4's 64 berries;
- the Glasshouse design, with each room's jobs;
- the preserve, and the Sevii Islands' wild Pokémon from FireRed's encounter tables;
- your words.

`web/39_estate.html` (the `Estate` engine) builds everything else in the browser on each visit:
- **Residents (A-109).** The Pokémon on your six teams; a toggle adds your others. Nobody is assigned (D-037).
- **Placement.** A resident lives at Blackthorn if Blackthorn offers its primary land. Otherwise it lives on the
  satellite that does, its home region's first. This is `ranch/planner.py` `home_site`, ported; a Python test holds
  them to the same answers. The geothermal ground counts as volcanic land at Blackthorn (A-110).
- **Staffing.** `Cap.facilityReport` over the residents, read in HeartGold. A Pokémon staffs a job on a game mechanic
  it has or a world record you approved (D-039). The land meets a few jobs on its own: the Glasshouse's heat and water,
  the cold vault's cold, and the Climate facility's heat and cold. Built things don't count until they're built (A-112).
  Suggest a staff plan fills a plan for you to save (A-113).
- **World records (A-111).** W-001 to W-017 follow your Pokémon of that species in that game. Approving or withdrawing
  one appends a Journal row of kind `world-record`, and the newest row per record wins. `Cap.setWorld` hands them to
  every assessment: the Survival Lab, facilities, and the builder's homestead tags.

## What's still open

- The preserve: how long clients' Pokémon stay, its land and where it sits, and how an invitation works (A-114).
- The stud reading (RANCH.md §6).
- People are roles to author (D-039): head breeder, orchard keeper, keepers and so on.
- 255 steps per egg cycle is believed, not yet checked against the game (E-024).

## Tests

- `tests/test_engines.py` `Estate`: the sites, placement against the planner, eggs and berries, the Glasshouse rooms,
  the land meeting jobs, and the Sevii wild Pokémon.
- `app/test_estate.mjs` (in Chromium) covers the pages:
  - residents placed by their land, and the D-033 records following new Pokémon;
  - the land meeting heat and water;
  - a suggested plan;
  - W-016 approved and withdrawn as Journal rows;
  - the Glasshouse tabs, the Sevii Islands, the preserve, and the old Homestead link.
