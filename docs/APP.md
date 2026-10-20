# Blackthorn HQ: the web app (2026-10-20, D-055)

*One place for the whole project: the estate and the Glasshouse, the breeding program and every lineage, the biological atlas and the research journal, the trainer scouting engine, the team reports, the build library and the Lab, your open calls and the record. It runs on the Canon DB Sheet (D-025) as an Apps Script web app that only you can open.*

> Luxury in presentation. Science in structure. Pokémon in identity. Life in every environment.

## Pages

| Section | Page | What it does |
|---|---|---|
| **Headquarters** | Home `#/` | The cinematic hero (time of day and season are real), champion identity and the six chapters, the HeartGold party (tap one for its profile), the estate map, the Glasshouse, eggs in the racks, berry timers, environment, nutrition, priorities and quick actions, the living timeline, progress, the research journal. Three layouts: Champion, Breeder, Research. Every module collapses |
| | The Estate `#/estate` | The interactive plate of the Blackthorn grounds (tap a place), the sites and satellite, the facility network with staff and open jobs, land and nursery pens, single points of failure, the resident census with a filter |
| | The Glasshouse `#/glasshouse` | The building in plan (tap any room), rooms and staff; eggs and walking (laps of the hatching loop, Magcargo halving them); berry cultivation; environment; nutrition |
| **Breeder** | Breeding & lineage `#/breeding` | Each target line as a project: egg moves, the fathers used, the chain of crosses to the stud, status |
| | | `#/breeding/studbook`: every individual. `#/breeding/tree/<id>`: a three-generation pedigree and descendants. `#/breeding/fathers`: the best fathers and every companion's tinkering menu. **Record a hatch** checks the cross (sexes, egg groups, the dam's line, generation) before it adds the row |
| | Biological atlas `#/atlas` | All 493 species of Gens I–IV, filtered by type, generation, habitat, egg group and "at Blackthorn". A species page has its Pokédex entry, size, gender, abilities, egg groups, hatch steps and laps, base stats, type defenses, the evolution family, its residents and breeding projects, field notes, ladder usage and library builds |
| | Research journal `#/journal` | 727 entries kept apart by kind: **official** (the Pokédex), **verified mechanic** (checked against PokeAPI, Showdown, Smogon), **personal observation**, **research hypothesis**, **world-building**. Search, filter by aspect, write a new entry |
| **Champion** | Scouting reports `#/scouting` | The advance report for every trainer worth preparing for: who they are, what to expect, how to beat them, where it breaks; the team with roles and real stats; the defensive matrix; gaps and walls; style sliders (authored and measured); **the matchup board** (your six against theirs by type, and the three to bring); the playsheet; ladder notes; film |
| | Team reports `#/teams` | Your six chapters scouted the same way (self-scout), with the board turned around: your team against any rival |
| | Builds & the Lab `#/builds` | The library (stock, anime and ladder-replay builds), the ladder book (Smogon's top 40 for Gen 2–4 OU with the sets real players run and what beats them), and **the Lab**: one Pokémon built and checked (below) |
| **Record** | Your calls `#/calls` | Every open question, world record and proposed decision waiting on you. Tap an option or write your own; it goes into the Your Calls tab |
| | The record `#/record` | Decisions, locks, world records and verified mechanics |

Search (top bar) finds species, trainers, builds, studbook entries, journal notes and decisions.

### The Lab

Species, generation (II–IV), level, nature, ability, item, IVs (DVs in Gen II), EVs (stat experience in Gen II) and four moves. It works out:
- real stats (the engine's formula, E-038; checked against `trainers/era.py` in the tests);
- Hidden Power's type and power, the characteristic (Gen IV), and in Gen II the gender and shininess the DVs give;
- coverage (what the moves hit super-effectively, what walls them) and type defenses;
- each move against what the line can learn in any game up to Gen IV, and whether the move exists yet in that generation. That check is loose on purpose (D-024, D-048); the engine's era check is the strict one;
- a Showdown paste. **Save to Specimens** writes it to the Sheet, and a saved specimen reopens exactly.

## Honesty rules the app keeps

- **Measurements need a source** (D-055, verbatim): *"Measurements should be backed by real entered or simulated data, never presented as verified live readings without a data source."* Environment numbers come from the Readings tab with their source (entered or simulated). With no readings, the app shows a simulation and labels it as one. Targets are labelled "proposed".
- **The matchup board is type matchups only**, and says so: not damage, speed, items or abilities.
- **Proposals aren't canon.** Anime teams show as proposed, cartridge teams as from the cartridge, your teams as canon. An answer in Your calls is recorded, and becomes a decision only when it's written into canon.
- **Locks hold.** The app has no way to edit a locked record; the Sheet's lock guard still guards HeartGold's six (D-006).

## How it's built

```
engine/app/export.py      the engines' outputs as six JSON files in engine/app/data:
                           hq (Blackthorn: party, estate, Glasshouse, program, lineage, the record),
                           atlas, builds (library, moves, natures, type chart, the ladder book),
                           scouting (every report), journal, learnsets
engine/app/web/*.html     the app in parts: 00 head and design system, 10 art (hero, crest, icons,
                           estate plate, Glasshouse plan), 20 core (data, router, stat math),
                           30 home, 40 estate + Glasshouse, 50 breeding, 60 atlas + journal + search,
                           70 scouting + teams, 80 builds + Lab, 90 calls + record
engine/app/build.py       → engine/app/dist:
                           Blackthorn-HQ-app.zip       the parts + the data (goes to Drive)
                           blackthorn-apps-script.zip  Code.gs, WebApp.gs, Tree, Hatch, manifest, INSTALL.txt
                           Blackthorn-HQ-preview.html  the whole app in one file, with a stand-in for the Sheet
engine/appscript/WebApp.gs the launcher: finds the newest Blackthorn-HQ-app*.zip in Drive, unzips it once
                           (kept in the script cache), serves the page, and answers the page's calls
```

The page talks to the Sheet through four calls:

| Call | Does |
|---|---|
| `apiData(name)` | one of the data files from the zip |
| `apiTab(name)` | a tab's rows, keyed by its header row (the first row with three or more filled cells), dates as text |
| `apiAppend(tab, row)` | adds a row to Eggs, Egg Walks, Plantings, Harvests, Readings, Feedings, Journal, Timeline, Specimens or the Studbook (nothing else), plus a Timeline line. Text is never written as a formula |
| `apiAnswer(id, text, status)` | writes "Your call" and "Status" in Your Calls; a call the tab doesn't have yet gets a row |

The app's own tabs (green, after Setup) have their header in row 1; the header names are what the app reads.

Permissions it asks for: this Sheet only (`spreadsheets.currentonly`), reading Drive (`drive.readonly`, to find the zip), and showing windows in the Sheet. Deployed as *Execute as: Me*, *Who has access: Only myself*.

## Install and update

`engine/appscript/INSTALL.txt` (also inside the apps-script zip): upload `Blackthorn-HQ-app.zip` to Drive without unzipping it; paste `WebApp.gs` (and the updated `Code.gs` and manifest) into the Sheet's Apps Script; Deploy → New deployment → Web app.

To update the app: `python3 -I app/export.py` (after canon changes), `python3 -I app/build.py`, upload the new zip. The newest one is served within two minutes; the old one goes to History (Drive versioning rule).

## Testing

- `python3 -I -W ignore -m unittest discover -s tests` includes the `WebApp` tests: every page part is valid JavaScript; the launcher (`appscript/test_webapp.mjs`, with fake Sheets, Drive and cache over the real zip) serves the page, returns each data file exactly, reads and writes only what it should; and the Lab's stats and Hidden Power match `trainers/era.py`.
- `python3 -I app/build.py --shots [page …]` screenshots pages from the preview with the pre-installed Chromium and prints any JavaScript errors.

## Design system

Palette tokens in `00_head.html`: charcoal `#15171C`, gold `#C9A96A`, ivory `#F3EDE2`, forest `#5E8F68`, ice `#9CCBDD`, ember `#DE7C42`; the seventeen Gen IV type colors stay as the games have them. Cormorant Garamond for headings, Inter for text, JetBrains Mono for numbers and ids. Official artwork for portraits; each chapter's own era sprites for teams. Cards with gold hairlines, the ornament divider, ivory specimen plates. It lays out down to phone width (tested at 390 px).
