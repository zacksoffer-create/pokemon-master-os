# Blackthorn v2.0: built around your inputs (D-078)

Zack, 2026-10-25, after using v1:
- *"The main focus should be on my inputs ... this needs to be built around my inputs, not around anything else."*
- *"remove all of my inputs ... anything that is Zach version, whatever, take all of that out and then allow me to
  start with heart gold and then let's build it from the process up."*

This is the first update of that: the flow from a team to one Pokémon and back, and the navigation around it. The
other systems (the Arena, Field Biology, the Trainer Library, the labs) stay. They're re-housed in the menu, and each
one reads your teams once you've built them.

Every call made here is an item A-79 onward in `docs/design/ASSUMPTIONS.md`, and in Your calls with Keep / Change /
Reject.

## 1. The fresh start

| What | How |
|---|---|
| The switch | `engine/store/fresh_start.json`: `on`, `since`, why, and what it hides. Set `on` to `false` and rebuild to bring the old records back. |
| The archive | Nothing is deleted. `canon/` keeps the six journeys, the builds, the lineups, the studbook and the lineage exactly as they were, and `docs/` keeps their reports. |
| The app's packs | `engine/app/fresh.py` runs at the end of the export (and after any pack script run on its own) and takes the personal layer out of every pack: <ul><li>your Pokémon, builds and teams</li><li>the journey trainer `me` and its versions</li><li>the party, residents, studbook, lineage and program</li><li>the journey's scouting files</li><li>your teams in the Arena and the Legends</li></ul> |
| The Sheet | Rows in My Pokémon, My Builds, My Teams, My Gear, Arena and Journal dated before `since` aren't read. They stay in the Sheet. |
| Browser-only settings | The old team lab's slots and the single coach profile in this browser are no longer read. v2 uses new keys. |

## 2. One team per game, and each team is its own trainer

> *"I don't want different journeys. Like, I don't want different versions ... think of it as separate trainers, as
> separate journeys."*

- **Six teams**, one each for HeartGold, SoulSilver, Platinum, Emerald, FireRed and Crystal. A team is a My Teams row
  with id `journey:<game>` and `kind` journey. The newest row wins, so every earlier lineup stays in the Sheet.
  - **Its slots:** an ordered list of up to six of your Pokémon.
  - **Its trainer:** name, philosophy and the coach dials. The Arena uses the team's own trainer whenever it plays
    that team.
- **The old team lab, the "journey six" and journey versions** are folded into this one record.

## 3. The team homepage (`#/team/<game>`)

The dashboard for one team:
- a strip of links to every section;
- six clickable tiles, each showing the Pokémon in its ball, reorderable by dragging or with the arrows;
- empty slots open the species picker.

| Section | What it does |
|---|---|
| Your six | The tiles. Click one to build it. |
| This team's trainer | Name, philosophy, the nine dials, the traits they earn |
| Scouting report | Strengths, weaknesses and tendencies, in place of the old scenario questions |
| Shapes & roles | Each member on the five roles, the team's shape among nine competitive archetypes with how close it is to each, and what's missing |
| Coverage | Offensive and defensive type grids (kept) |
| Swap | Small: try a different nature, move, item, ability or whole build on one member, and see the team read change |
| Candidates | Who could join or replace (kept, at the bottom) |
| Achievements | The region's badges, the League, the National Pokédex and the post-game, all counted as done (*"assume ... I've beat the region"*), plus what the team has earned in the engine and the Arena |
| Battle | Play this team against any trainer in the Arena, with this team's trainer making the calls. Every member needs its moves first: the Arena never invents a set, so the button names any member without one and links to its builder. |

## 4. One Pokémon (`#/pokemon/<id>`)

Left column, your inputs:
- species;
- nickname, gender and shiny;
- the ball, with the Pokémon shown in it;
- ability and nature, each with its description;
- held item;
- four move dropdowns of every legal move, grouped by how it's learned. Each shows type, category, power, accuracy,
  PP, what a status move does, and the move's description;
- IVs with a Max button, EVs with per-stat Max and the 510 cap;
- the final stats.

Right column, in Zack's order:
1. The species: base stats, types, abilities and every Gen I–IV Pokédex entry in one block.
2. The five team roles (Ace, Sweeper, Support, Wall, Tank). Each has a one-line explainer, its result and the
   numbers behind it.
3. Badges.
4. Its scouting report: strengths, weaknesses and tendencies.
5. Wilderness tags, each with why.
6. Homestead tags, each with why.

The before-and-after ("what moved") is gone: the page shows the build as it now is.

## 5. The five team roles, rebuilt on competitive terms

Every number comes from the same one-on-ones against the generation's Elite Four and Champions, both sides at level
100 (`trainers/team_roles.py`). Each role answers one competitive question.

| Role | The question | Rule (calibrated) | Builds earning it |
|---|---|---|---|
| Ace | Can you build the run around it? | Wins at least 80% of one-on-ones against the Elite Four's Pokémon and 70% against the Champions' (kept, D-064). | 448 |
| Sweeper | Once it gets going, does it take several down in a row? | Moves first against at least 80% of them, and its best attack is a guaranteed 2HKO on at least 80% and an OHKO on at least 30%. A setup move counts with one use applied (the stage multiplier, a stated estimate). | 246 |
| Support | Does it spend its turns making the team better? | At least two support moves (hazards, removal, status, screens, healing the team, phazing, speed control, Baton Pass and so on), and it survives two hits from 80% of the 100 hardest attacks or moves first against 60%. | 181 |
| Wall | Does it take hit after hit from one side, and heal it off? | Four or more hits from at least 80% of the 50 hardest physical attacks, or of the 50 hardest special ones, plus reliable recovery, Rest, Wish or Leftovers. | 226 |
| Tank | Does it take hits from both sides, and hit back? (new) | Three or more hits from at least 75% of the 100 hardest attacks, and a guaranteed 2HKO on at least 60%. | 195 |

The counts are out of 1,076 builds: the library, the trainer ecosystem and Smogon's sets. The first bars (60/60) let
about twice as many through. The League's Pokémon carry no EVs, so most invested builds outspeed and 2HKO them; what
separates a sweeper is the OHKO share. Scores are 0 to 1 and shown, never used to decide. Sweeper and Tank use the
geometric mean of their two shares, so a build strong in one half and hopeless in the other scores low.

The 34 roles of the role engine stay underneath, for the build name and the archetype.

## 6. Badges, reworked

Six families, each measured the way competitive players measure it:

| Family | Measured by |
|---|---|
| Speed | Stat milestones named by the Pokémon they outrun, and how often it moves first against the League |
| Power | Attack and Special Attack tiers; 2HKO and OHKO shares (the breakers) |
| Bulk | HP, Defense and Special Defense tiers; hits taken (the walls) |
| Finishing | Priority |
| Sustain (new) | Recovery, Rest, Wish, Leftovers and draining moves |
| Utility (new) | How many distinct support jobs it does |

## 7. The naming list

`docs/naming/ALL_COMBINATIONS.md` (+ `.json`) is the massive list Zack asked for:
- every combination of the ladder's slots: type, role noun or hybrid, moveset, team role and BST band;
- for each, a generated name to react to.

Words become real only when Zack approves them into `naming.words`.

## 8. The menu

| Group | Pages |
|---|---|
| Your teams | The six games |
| Build | Your Pokémon, Breeding stock, PKHeX |
| Play | The Arena, Legends, Leagues, the Draft, Hall of Fame |
| Explore | Natural history, Ecosystems, the Trainer Library, the builds book, Balls, Equipment, Capabilities |
| Labs | Battle, Trainer, Survival, Breeding, Standards, Benchmarks, scouting files |
| World | Estate, Homestead, Glasshouse, Breeding & lineage, Journal |
| Record | What's new, Your calls, Inbox, Record, Engine room |

Groups below Play start folded. Home leads with your six teams and what to do next.

## 9. v2.1: Zack's notes on the builder, the team and the calls (2026-10-26)

| Note | What changed |
|---|---|
| *"Where it came from ... can only come from a few places, so let's make where it comes from realistic."* | **Where it came from** is a dropdown of the real ways the species reaches you in that game: your starter, gifts, gift eggs, in-game trades, one-time encounters, and every wild area with its method and levels. It covers the species and its earlier stages ("your starter as Cyndaquil, then evolved"). Hatched is offered when the line can breed, plus a trade or the Pal Park, and "something else". Picking one fills Met at and Level met, and both stay editable. The source is Field Biology's encounter tables (`app/data/ranges.json`). Saved as `met_how`, `met_as`, `met_location` and `caught_level`. (A-100) |
| *"Treat the ball as independent."* | The builder says what the ball does in the game, never whether it fits how the Pokémon was met. (A-101) |
| *"A section in between that says like, you know, previous build ... then all of the rest of it fills in"*, and ability first in Moves | **Start from a build** sits between Who it is and Moves. It lists your earlier versions of the build and the known sets for the species under the game's rules. **Moves** opens with Ability; **Nature and item** have their own card. (A-102) |
| *"Sunny Day and Sandstorm and Hail and Rain Dance are all the same move ... I want that factored in."* | **Move families** (`engine/trainers/families.json`, shipped in `explain.json`): Weather in four forms by move or ability, Screens, Entry hazards and Status. The team page's Shapes & roles has a families card showing who sets each form, who thrives or suffers in it, and the sand and hail chip. The scouting report reads them as one job, and the Weather shape counts any form. Candidates say how they play into your families, and each Pokémon's scouting report names teammates doing the same job in another form. (A-103) |
| The shiny version under the image | The species card shows the shiny artwork under the usual one. |
| *"Easily researchable, and easily enrichable through research"* | Every natural-history page has **Research it**:<ul><li>what's still open;</li><li>links to Bulbapedia, Serebii, Pokémon Database and Smogon;</li><li>a research brief to copy;</li><li>a form, or a paste of several lines (`topic \| finding \| source \| link`), for your findings.</li></ul>A finding is a Journal row marked proposed, shown on the page as yours. (A-104) |
| *"I can't find the your calls list ... that needs to be better presented to me."* | **Your calls** is second in the menu, with a count. The top bar and Start here show the newest batch. The page opens with that batch. Each call is one tap (Keep, Change, Reject, Later) and updates in place, with a progress bar. (A-105) |

## 10. v2.2: the team bug, and your answers (2026-10-26)

| What | Done |
|---|---|
| **The bug: six Pokémon wouldn't go on a team.** Every visit to the species picker (and to the team page, and a Homestead facility) added another click handler to the page, and none were ever removed. On the nth visit, one tap on a species ran the add n times: 36 Pokémon for 8 tries, and the copies overwrote each other's slots. | **Fixed:** each page now gets a fresh page element, so the last page's handlers go with it. Changes to a team also now run one at a time, each starting from the team as the last save left it, so two quick changes can't undo each other. `app/test_teamflow.mjs` taps six tiles and six species, and checks for six Pokémon in six slots and one move per arrow tap. |
| The extra copies | Your Pokémon offers to **set aside** the ones that were never built and aren't on the team. Setting aside is reversible (Bring back), and nothing is deleted. The builder's More menu has "Set it aside" too. |
| Your answers to the calls (in chat) | Recorded in `engine/store/answers.json` (D-079). The app shows them as answered; answering again in the app wins. Four calls you didn't follow (A-06, A-40, A-49, A-53) are rewritten in plain words. |
| Geothermal ground in the highlands (A-64) | The six highland places have geothermal heat (`biology/ecology.py`), shown in their webs. |
| The ball animation (A-30) | The builder's portrait and the team's six now play it: the ball rocks, flashes, and the Pokémon pops out. |

**Asked for, still to do** (your answers in D-079):

| Call | What's asked |
|---|---|
| A-03 | Everything in git. The app can only write to the Sheet, so the plan is a snapshot of your Sheet records into the project on each rebuild. To discuss first. |
| A-09 | Let "what a set might suggest" propose an interpretation, marked hypothetical. |
| A-35 | Every key item in the equipment library. |
| A-42 | A pass over the wilderness engine's Pokédex patterns, for others that read too broad or too narrow. |
| A-62 | More dossiers. Your teams' species first. |
| A-66 | Add Kanto to the landscape, since HeartGold covers both regions. |

## 11. v2.3: the lost moves, Pivot, and each ball's own opening (2026-10-26)

| Zack | Done |
|---|---|
| *"The move sets didn't save when I was done creating the Pokémon, or they like went away."* | Two causes, both repaired from the team page.<ul><li>**Copies.** The v2.2 bug made extra copies of each Pokémon. A slot can hold a copy that was never built while the one you built sits off the team, so the team showed no moves. The team page now names each case, and **Put the ones you built in their slots** swaps them back. The spare copies can then be set aside from Your Pokémon.</li><li>**Unsaved changes.** A build left without pressing Save is kept only in that browser. Leaving the builder with unsaved changes now says so. The team page marks those Pokémon *unsaved*, with **Save them now**, and the builder has **Save now** on its unsaved line. Both use the builder's own save.</li></ul> |
| *"Pivot needs to be added to the list of team roles."* | **Pivot** is the sixth team role (`trainers/team_roles.json`, read the same way in the app and the engines). A Pivot carries a way to switch out on its own terms (U-turn, Baton Pass) and either takes the hardest hits well or moves first. Intimidate or Natural Cure counts towards it. 130 of the League's 1,076 Pokémon earn it (12%). The naming list's word for it is proposed as *Tactical*, giving 257,006 combinations. (A-107) |
| *"The animation specific to the ball in question."* | *(Replaced in v2.4 by the games' own openings, §12.)* **Each ball has its own opening**: hearts for the Love Ball, bubbles for the Dive Ball, a net for the Net Ball, moons and stars for the Moon Ball, a clock for the Timer Ball, smoke for the Dusk Ball, a purple ring for the Master Ball, and so on for all 25. These are Blackthorn's designs after each ball's colours and purpose, not copies of the games' frames. The opening plays on the builder's portrait (tap it to replay) and on the team's six. (A-106) |

## 12. v2.4: ball openings as the games play them (2026-10-26)

Zack: *"I want all of the ball to have the animation from the game, not a custom one."*

**Every ball now opens the way its own game sends a Pokémon out.** Each generation is rebuilt from that game's
disassembly, number for number, at the commits the ball mechanics already use (A-30). The player is
`engine/app/web/31_ballopen.html`; the sources are cited file by file in `docs/design/BALL_OPENINGS.md`.

| Games | What plays |
|---|---|
| HeartGold, SoulSilver, Platinum | **Each ball's own particle file**, read and simulated as the game's particle library runs it, at 30 frames a second. The Pokémon grows from its feet as a silhouette in the ball's colour, then its colours come back. HeartGold and SoulSilver give the seven Apricorn balls and the Sport Ball a copy of the Poké Ball's burst, so that's what they play. |
| FireRed, Emerald | **Each ball's particle routine**: the count, path, speed and life of its particles, the ball's own open frames, the white background flash, and the Pokémon growing out in the ball's colour. |
| Crystal | **A grey smoke poof with no ball**, the same for every ball, while the picture builds in from its own tiles. A shiny gets the inverted flash and ring of sparkles. |

- The game's pictures are loaded from the disassemblies when an opening plays. None are copied into the project.
- It plays on the builder's portrait (tap to replay) and on the team's six. Each ball's page has a new **How it opens**
  card for the chosen game.
- A-106 is rewritten to match. A-108 lists the few places the portrait differs from the game, such as the throw being
  left out and the Apricorn balls' item picture standing in before the burst.

## 13. v2.5: the estate, the opening where you create a Pokémon, and everything in git (2026-10-26)

Zack: *"Yes to all and add the animation to the page where you're creating the individual. ... I think I want you to try
to figure out the estate/homestead/glasshouse vision. It's all a part of it so just you know kinda how it's been
described, take the reins and build it."*

**The estate is built from your teams.** The whole design is in `docs/ESTATE.md`.
- **One compound (A-117).** The estate, then a facility, then its jobs. The old Homestead link opens the estate.
- **The map.** It has a pin for every facility, coloured by how well your residents cover it, plus the geothermal
  ground and the Sevii Islands.
- **Residents (A-109).** Every Pokémon on your six teams could retire here, and nobody is assigned. Each is placed
  where its own land is, Blackthorn or the Sevii Islands. Geothermal ground keeps the fire Pokémon at Blackthorn (A-110).
- **Facilities.** Each job says who of yours can hold it on a game mechanic or your world record (D-039). The land
  meets a few on its own (A-112). Suggest a staff plan fills a plan that you save (A-113).
- **World records (A-111).** W-001 to W-017 follow your Pokémon of that species in that game. New ones are approved
  from a job's candidate line and saved as Journal rows; you can withdraw them the same way.
- **The Glasshouse (A-116).** Its six tabs read your records: your lines' egg schedule, the medicine crop plus your
  builds' berries, each room's jobs, a studbook of your bred Pokémon, and the residents' rations.
- **The Day-Care preserve (A-114) and the Sevii Islands (A-115).** Each has its own page. The preserve lists who could
  be a client, and the islands list FireRed's wild Pokémon.

**Also in v2.5:**
- **The opening where you create a Pokémon.** It plays beside the ball you pick, and again when the ball, shiny or
  species changes. A new nickname doesn't replay it.
- **Everything in git (A-03).** Record → Keep it in git makes a copy of every tab in your Drive (a download in the
  preview). Say "snapshot my records" and it goes into the project.
- **The builder's Homestead tags** are read in HeartGold, the estate's game, with your world records.

## 14. Not reworked yet (the next updates)

This update rebuilt the path from a team to one Pokémon and back. The rest still works, but some of it was built
around the old journey.

| Area | Where it stands |
|---|---|
| Battle Lab | Reads your six teams as its lineups (an example six until you've built one). |
| Trainer lab, scouting reports, advance scouting, team reports | Precomputed by the Python engines from the old journey, so they're hidden while the fresh start is on. They show the library's trainers. |
| Estate, Homestead, Glasshouse | Rebuilt in v2.5 from your teams (§13). The people roles are still to author. |
| Breeding & lineage | Blank: the studbook is hidden. |
| Careers and the Hall of Fame | Built from Arena results kept after the fresh start. |
| Pokémon profile (`#/mon/<id>`) | Still the v1 player card and gallery. The builder is now the main page for one Pokémon. |

Zack: "let's kind of start with this as the first update ... and then we'll move on."
