# The social engine: how Blackthorn's residents live together (proposal, 2026-10-26)

**Status: PROPOSAL.** Nothing here is built or decided. Zack, 2026-10-26: *"I want to design a dynamic social
system for the life simulation app I'm designing to plug in."* This page is the design to react to: what it's for,
what it inherits from decisions already made, the model, how it moves, the seam it plugs in through (built
separately, the way the 6v6 engine was, D-069), and the calls that are yours (§9).

Every relationship, temperament and story on this page is an **illustration or an authoring candidate**, never canon
(charter, world rules). Numbers marked *illustration* are made up to show the arithmetic.

## 0. The short version

- **Every engine so far measures what the companions can do. None measures how they live together.** The charter's
  first description of the teams is that they "travel, camp, rescue, cook, carry, warn and live together." This is
  the missing engine.
- **The past stays authored; the present moves.** The journey is over (D-042), so relationships from the journey are
  history you write. The ranch is the present, and that's where the system is dynamic: hatches, arrivals,
  departures, shared work, Day-Care guests, seasons.
- **Two layers, never blended.** *Bonds* are facts other engines already know (kin, teammates, co-workers,
  neighbors). *Ties* are feelings: four numbers in each direction (warmth, trust, respect, familiarity), each one a
  sum of dated, sourced reasons. No number without its receipts.
- **Dynamic, never a chore.** Time moves only when something happens or when you run a season. Nothing fades because
  you didn't open the app.
- **Simulation is evidence, not history.** A season run (seeded, 100 at a time, like the 6v6 batches) gives
  distributions and candidate storylines. You keep the ones you like as Creative Chronicle. Nothing simulated becomes
  recorded history, and nothing is dated inside the journey.
- **Social never touches mechanics.** No battle bonuses, no capability changes, no staffing verdicts. The one social
  number the cartridge itself keeps, friendship, is read as evidence and never written back (§3.6).

```
  OTHER ENGINES (facts)                 THE SOCIAL ENGINE                          THE APP
  lineage · rosters · census    ──►  bonds ───────┐                          a profile: Relationships
  staff plans · specimen        ──►  temperaments ┼──► ties ◄── events        a team: The room
  approved Pokédex claims       ──►  priors ──────┘      │                    the Estate: the social map
  logs · journal · you          ──►  recorded events ────┘                    the inbox ──► the Chronicle
                                     seasons (seeded, ×100) ──► simulated events, reads, storylines
```

## 1. What it answers

| Question | Where you'd ask it |
|---|---|
| Who is close to whom, and why? | a Pokémon's profile → Relationships |
| How does a six hold together as a group, and does its shape look like its chapter's kind of mastery? | a team page → The room |
| What does the ranch look like socially? Six households or one? Who's the hub, who's on the edge? | the Estate → the social map |
| What changes when someone arrives or leaves: a hatch, a new stud, a Day-Care guest, a fate decided (D-037)? | a what-if season |
| Who works well together on a shift? | a facility page: a note beside the staff plan, never a verdict (D-039) |
| What's this individual's story with the others? | the Chronicle (Individual spec §16–17, "expanded relationship history") |

**Why it's interesting here in particular** (design interpretation): the six chapters are six separate journeys.
Blackthorn is the first place their companions live under one roof. Teammates arrive knowing each other; companions
from different chapters arrive as strangers who share a trainer. Whether the ranch stays six households or becomes one
is the most open social question in the project, and because it's in the present tense, it can actually move.

## 2. What it inherits

| Already decided | Source | What it means here |
|---|---|---|
| The journey is past, the ranch is present | D-042, D-043, D-044 | journey-era ties are authored history; the dynamics run only in the ranch's present; no simulated event is ever dated inside the journey |
| Relationships Claude proposes are authoring candidates | charter, world rules | everything the engine makes starts `proposed` |
| One evidence ladder: owner, class, status | MASTER_PLAN §3.2 | every trait, tie and event carries a class and a status; this engine adds `simulated`, as the 6v6 seam did |
| *"Measurements should be backed by real entered or simulated data, never presented as verified live readings without a data source"* | D-055 | every number expands into its reasons; simulated ones say so |
| Recorded, simulated and creative history stay apart | Individual spec §16 | three kinds of event, never converted silently |
| Species ≠ individual | charter, world rules | a species can set a prior; every tie belongs to two individuals |
| Engines don't know canon | ARCHITECTURE, contract 5 | the engine runs on any cast: the ranch, a saved team, a trainer's six, an invented household |
| No relationship or morale mechanics invented to imitate sports games; no stat bonuses for descriptive traits | Trainer spec, "outside the required scope"; Individual spec §14 | social reads never change a battle number, a capability standing or a staffing verdict. The same clause says such features "can be explored separately if desired": this is that, and it stays out of the Trainer Library's core |
| Personality is separate from competence | Trainer spec §5 | a hot-tempered Pokémon isn't a worse one |
| No constant maintenance simulation | Survival spec, optional simulation | no needs bars, no upkeep; time moves only on events or when asked |
| Only a mechanic or an approved record staffs a job | D-039 | social notes sit beside staff plans; they never make one |
| No grades | D-046 | group reads are descriptions in phrases, not scores |
| No outside fathers in the story; the Day-Care is for other great trainers, priced so only the very wealthy come | D-079 (Q-BREED-2, Q-RANCH-4) | departures come from fates and Day-Care guests, not borrowed fathers; guests are short-stay residents with their own trainers |

## 3. The model

Seven records. Everything else is derived.

### 3.1 Agent

Anyone who can hold a tie.

| Kind | Who | Where they come from |
|---|---|---|
| Pokémon | every individual at the ranch: companions who retire there, studs, hatchlings, Day-Care guests | the personal store (`store/personal.py`), the lineage (`breeding/lineage.py`), the census (`ranch/report.py`) |
| Person | you, the rival, ranch staff by role (the facilities already name them: head breeder and so on), family, Day-Care clients | authored; Trainer Library identities by id, never copied |

One id per individual: the spine from MASTER_PLAN X3. The engine never invents its own ids. Planned individuals in
the lineage stay plans (Q13) until a hatch is recorded, except inside a what-if season.

### 3.2 Temperament

Five axes, 0 to 100, from animal-personality research (Réale et al., 2007, *Biological Reviews*: shyness–boldness,
exploration–avoidance, activity, aggressiveness, sociability). A field-biology scheme instead of a human one keeps it
consistent with Field Biology, and five axes that don't overlap is the Trainer spec's own test ("evaluate overlap and
eliminate redundant variables").

| Axis | Low | High |
|---|---|---|
| Boldness | wary of the new and the risky | walks toward it |
| Exploration | sticks to the known | investigates |
| Activity | still, unhurried | always moving |
| Aggressiveness | yields | contests |
| Sociability | keeps its own company | seeks others out |

Each value records where it came from, best first:

1. **Authored** (yours). Always wins.
2. **The game's words.** Nature (Gens 3–4) and Characteristic (Gen 4, from the highest IV; the specimen engine already
   derives it), mapped by an editable table (`social/temperament.json`). Class `inferred`: the word is the game's, the
   reading is ours. A weak prior, moving an axis by at most 15. Crystal has no natures, so the Crystal six start from
   authoring and species alone.
3. **Species prior**, only from Pokédex claims you've approved (§8 says why not the machine reading).
4. **Unknown**: 50, and it says so.

Temperament shapes who meets and what happens between them in a season. It never reaches a battle engine or a
capability.

### 3.3 Bond (facts)

Structural, already known to other engines, never scored.

| Bond | From | Class |
|---|---|---|
| kin: sire, dam, offspring, sibling, half-sibling | `breeding/lineage.py` (62 individuals, 3 generations today) | recorded (a logged hatch); planned ones stay plans |
| mates (bred together) | the Eggs tab, the lineage | recorded |
| teammates (a chapter's six; a saved team) | `canon/rosters.json`, My Teams | authored |
| trainer (you and each of your Pokémon) | ownership | recorded |
| client (a Day-Care guest and its trainer) | authored | authored |
| co-workers (same facility in an approved staff plan) | `capability/facilities.json`, My Teams `kind: staffing` | approved plans only |
| neighbors (same site and habitat zone) | the census (12 zones from `ranch/habitat.py`; Blackthorn HQ and the Sevii Islands, D-079) | derived |

Bonds do two jobs: they set where a tie starts (teammates start familiar; a dam starts warm toward her hatchling), and
they decide who is near whom in a season.

### 3.4 Tie (feelings)

Directed: A→B and B→A are separate, because real relationships aren't symmetric (one admires, the other tolerates).
Four dimensions:

| Dimension | Range | Means | How it moves |
|---|---|---|---|
| Warmth | −100 to 100 | likes ↔ dislikes | moderately, both ways |
| Trust | −100 to 100 | can count on them | slowly up, fast down |
| Respect | −100 to 100 | esteem, standing, deference | through contests, competence shown, seniority |
| Familiarity | 0 to 100 | how well they know each other | up with time together; barely fades; caps the other three |

**The cap:** warmth, trust and respect can't go further from 0 than 20 + 0.8 × familiarity. Strangers can't be best
friends or sworn enemies; it takes time together to get there.

**Every value is a baseline plus its reasons:**

```
value = baseline + Σ (modifier × fade)
```

- **Baseline:** from bonds and temperament fit (two very aggressive Pokémon start cooler; two sociable ones warmer),
  kept small (±20).
- **Modifiers:** one per event, carrying the event it came from, its size and its fade (a half-life in world days).
  A **defining moment** never fades: a rescue, a hatch witnessed, a first meeting, the Champion's win.

So any number on any page opens into its receipts:

> **Snorlax → Lapras · warmth 47** *(illustration)*
> +12 baseline: teammates (HeartGold)
> +6 baseline: both calm (Careful, Calm: the game's words)
> +11 shared the nursery for 30 days (fading, half-life 90 days)
> +20 defining: the storm night at the Glasshouse
> −2 a squabble over the sun spot (fading)

That's the "opinion is a stack of reasons" approach (Crusader Kings, RimWorld) rather than an opaque meter, and it's
what D-055 asks for.

**Labels are read from the numbers** by rules in an editable file (`social/labels.json`), the way roles are read from
builds (`trainers/roles.json`). A pair can carry more than one. Candidate rules, thresholds illustrative:

| Label | Rule |
|---|---|
| strangers | familiarity under 15 |
| acquainted | familiarity 15 or more, nothing stronger |
| friends | warmth 40+ both ways, trust 20+ |
| close | warmth 70+ and trust 60+, both ways |
| rivals | respect 40+ both ways, warmth between −30 and 30, contests in their history |
| mentor → protégé | A→B warmth 30+, B→A respect 50+ and at least 30 above A→B's |
| protector → protected | A→B warmth 40+, B→A trust 60+, A the bolder by 25+ |
| wary | trust −20 or lower |
| at odds | warmth −40 or lower |

### 3.5 Event

| Field | What it is |
|---|---|
| `id`, `type` | the type from the catalog (`social/events.json`) |
| `who` | participants, each with a role (rescuer and rescued, winner and loser, dam and hatchling) |
| `when` | the world date |
| `history` | `recorded`, `simulated` or `creative` (Individual spec §16) |
| `source` | a log row, a journal entry, a season run and its seed, or your hand |
| `status` | `proposed`, `approved`, `rejected` |

Each catalog type says what it does to each role's ties: which dimension, how much, how fast it fades, whether it's
defining. Candidate types: shared work, shared shelter, play, caretaking, food sharing, sparring, squabble, rescue,
protecting another, a hatch witnessed, arrival, departure, reunion, loss.

```json
"rescue": {
  "roles": ["rescuer", "rescued"],
  "effects": [
    {"from": "rescued", "to": "rescuer", "trust": 25, "warmth": 15, "defining": true},
    {"from": "rescuer", "to": "rescued", "warmth": 8, "half_life": 120}
  ],
  "familiarity": 5
}
```

### 3.6 Friendship: the one social number the cartridge keeps

Gens 2–4 keep a friendship value (0 to 255) on every Pokémon. PKHeX shows it, and the specimen engine already carries
the field (`specimen.py`: `friendship`, exported as `CurrentFriendship`, or `OriginalTrainerFriendship` in Gen 3). It's
mechanic-class evidence about one tie only: the Pokémon's tie to its trainer.

From the project's own data (PokeAPI, `app/data/biology.json`), four companions exist only by high friendship (220 in
Gens 2–4), as long as they evolved with you rather than arriving evolved:

| Companion | Chapter | Evolved from | How |
|---|---|---|---|
| Crobat | HeartGold | Golbat | high friendship |
| Espeon | Crystal | Eevee | high friendship, by day |
| Umbreon | Crystal | Eevee | high friendship, by night |
| Lucario | Platinum | Riolu | high friendship, by day |

Three more can come by friendship but don't have to: Pikachu (from Pichu), Snorlax (from Munchlax) and Roserade's line
(Budew → Roselia). Which way each came is a question of how it was met, which the builder's *Who it is* already
records.

The proposal: the tie to you reads friendship as evidence ("this tie reached 220 on the cartridge"), class
`mechanic`. The engine never writes friendship back, and no simulated tie changes Return's power. *(Design
interpretation: two of the Crystal six exist only because of friendship, which fits "first bonds, care before
competence" better than anything we could author.)*

### 3.7 Groups (derived)

Read from the tie graph, class `measured`, and described in phrases from an editable phrase book, like the scouting
reports (no grades, D-046):

| Read | What it measures |
|---|---|
| cohesion | how many warm ties a group has, out of all it could |
| hub | whose ties the most others run through (centrality) |
| bridges | who links two groups that otherwise don't connect, chapter to chapter |
| edge | who has no close tie in the group |
| hierarchy | how unevenly respect is spread, and who defers to whom |
| households | the groups the ties actually form (community detection), set against the chapter lines |

Hierarchy is where the Pokédex has something to say about the journey's species: Houndoom (the rival's) *"choose
their leader by fighting among themselves"* (C229.7, Emerald); Donphan's *"tusks, the higher its rank in its herd"*
(C232.3); Empoleon's *"leader has the biggest horns"* (C395.2, Diamond).

## 4. How it moves

### 4.1 Two clocks, no chores

- **World time moves only when something happens** (an event is recorded) **or when you run a season.** Real time
  does nothing. Three months away from the app changes nothing.
- Fading runs toward the baseline, never to zero. Defining moments never fade. Familiarity barely fades.
- No needs, no hunger bars, no moods that drain. The Survival spec's line applies: what you need to know should come
  "without having to participate in a constant maintenance simulation."

### 4.2 Recorded events: mostly free

Most of what the engine needs is already being logged.

| Already in the app | Becomes |
|---|---|
| a hatch on the Eggs tab | a hatch event (dam, sire, hatchling; whoever works the Glasshouse witnesses it) and kin bonds |
| a journal entry or Personal observation naming two Pokémon | a proposed event card (intake can parse it later, the way it already turns notes into claims) |
| a fate decided (D-037) | an arrival at the ranch, or a departure |
| a Day-Care guest checked in or out | arrival, departure |
| your own one-liner: "Tyranitar and Mamoswine hauled the north fence" *(illustration)* | a shared-work event |
| an approved staff plan | co-worker bonds: who's near whom in a season, not an event |

Plans stay plans (Q13). A staff plan says who would be near whom; nothing happened until you say it did.

### 4.3 Seasons: the simulation

On demand, seeded and deterministic: the same cast, ties and seed always give the same season, like every other
engine here.

**Inputs:** the cast, their ties today, where each lives (site and habitat zone), who works where (an approved staff
plan, or a what-if one), and a deck of incidents: storms, a cold snap, a newcomer, an egg, a Day-Care guest, an
illness. Where they fit, incidents come from the capability engine's scenarios (`capability/scenarios.json`).

**Each simulated day:**

1. **Who's near whom:** co-presence from shared zones and shifts.
2. **Who meets:** the chance rises with co-presence, both sides' sociability and their familiarity.
3. **What happens:** a type from the catalog, weighted by temperaments and the current tie. Friends play and share;
   a tense pair squabbles or avoids each other; a bold one and a shy one, protects.
4. **Ties move:** the event's modifiers apply; fades tick.

**A run is a batch,** like the 6v6 Lab: 100 seasons, different seeds. What comes back is a distribution, not a story.
*Illustration:* "Snorlax ends as the hub in 81 of 100; the Emerald six stay their own household in 64; Absol has no
close tie in 70." Any single seed can be read as a story, and you keep it or don't.

**The result** (the 6v6 seam's shape, adapted):

```json
{
  "engine": "social@0.1",
  "cast": "ranch:hq",
  "held_constant": ["staff plan", "residents at HQ", "temperaments"],
  "varied": ["meetings", "incidents"],
  "days": 90,
  "seed": 1,
  "n": 100,
  "reads": {"hub": {"Snorlax": 81, "Lapras": 12}, "households_match_chapters": 64},
  "storylines": [{"kind": "friendship_formed", "a": "…", "b": "…", "in": 74}],
  "made_at": "2026-11-01T12:00:00Z"
}
```

### 4.4 Storylines: proposals for the Chronicle

Detectors read the event stream and name what happened.

| Storyline | Detected when |
|---|---|
| a friendship formed | warmth passes 40 both ways and holds |
| a rivalry heated | respect and contests climb while warmth stays near 0 |
| the newcomer settled in | an arrival's first close tie, and how long it took |
| a mentor | a respect gap across generations that holds |
| a rift | trust falls by 40 within a season |
| the chapters mixed (or didn't) | households stop matching the chapter lines |

Each one becomes an inbox card with its receipts: approve it into the Chronicle as **creative**, edit it, or reject
it. A simulated storyline is never recorded history.

## 5. The trainer

You're an agent too. Ties to you are ordinary ties with one difference: friendship (§3.6) is mechanic-class evidence
for them. A profile's Relationships card puts the tie to you first.

An optional read (design interpretation, off unless you want it): how each tie to you is *held* (secure, anxious,
avoidant), borrowed from attachment theory. It's the closest frame there is to two chapter theses, Crystal's
*attachment* and HeartGold's *"Nothing you do matters"* (secure, not cruel). Like the scouting reports' identity
reads, it would describe, not grade.

## 6. What it won't do

- No needs bars, chores or upkeep, and no penalty for being away.
- No romance meters. Mates are a breeding fact, not a storyline the engine pushes.
- No battle, capability or staffing effects, and no optional ruleset for them unless you ask for one.
- No backdating into the journey. Journey history is yours to author.
- No auto-canon. Everything generated starts `proposed`.
- No turning the Trainer Library into a relationship game.

## 7. The seam

Built separately, the way the 6v6 engine was (`sixvsix/`, D-069), in `social/`: a Python core and a browser copy held
together by a parity test, the pattern every engine in the app follows. It plugs in by registering itself,
`Social.setEngine(fn)`, the way the Arena registers `Library.setTeamEngine`. Until it's registered, the places below
say it's coming.

### What it gets

| Input | From | Note |
|---|---|---|
| individuals | My Pokémon (`store/personal.py`), the lineage (`breeding/lineage.py`) | one id per individual |
| species, nature, characteristic, friendship | the specimen engine (`specimen.py`) | |
| who lives where | the census (`ranch/report.py` → `data_manifest/ranch_census.json`: site and zone) | |
| who works where | `capability/facilities.json`, My Teams `kind: staffing` | approved plans, unless it's a what-if |
| teams | `canon/rosters.json`, My Teams | |
| Pokédex social claims | `data_manifest/biology/claims.json` | approved claims only |
| people | authored; Trainer Library identities by id | |
| dated events | the Eggs, Journal and Timeline tabs; the Chronicle | |

### What it hands back

Rows in the personal store's append-only pattern (a correction is a new row, never an overwrite):

| Record | Where |
|---|---|
| temperaments | a new Temperaments tab |
| authored ties and events | a new Social Events tab |
| season runs | Experiment records, as the 6v6 Lab keeps them |

The ranch's 45 possible residents make at most 1,980 directed ties: small next to the payload budget (MASTER_PLAN X7).

### Where it shows up

| Place | What |
|---|---|
| a Pokémon's profile | **Relationships:** the tie to you, kin, closest ties, rivals, each opening into its receipts; defining moments |
| a team page | **The room:** the six's cohesion, hub, edge and hierarchy, in phrases |
| the Estate | **The social map:** the ranch's ties as a graph, households against the chapter lines; run a season |
| a facility | a note beside a staff plan (*"these two have been at odds since the storm"*), never a verdict |
| the inbox | storyline cards to approve |
| the Chronicle | approved storylines, labeled creative |
| Your calls | proposed temperaments and ties |

## 8. What exists, and what doesn't

| Piece | State | Note |
|---|---|---|
| individuals with one id | built (Phase 1) | |
| kin | built | `lineage.py`: 62 individuals, 3 generations, no rule issues |
| who lives where | built | the census: 45 possible residents, HQ plus the Sevii Islands |
| who works where | built | facilities as capability networks; staff plans in My Teams |
| nature, characteristic, friendship | built | `specimen.py` carries all three |
| Pokédex social claims | built, thin | **none of the 105 species-to-species mentions in `claims.json` involves a journey species at all,** on either side. What the Pokédex does back is group life and hierarchy: Houndoom, Donphan and Empoleon (above), Weavile (*"groups of four or five that hunt prey with impressive coordination"*), Pikachu and Dragonite (gathering). So the species layer is a light prior. Most of a companion's social life will be authored or earned through events |
| the machine reading of social life | built, not good enough for this | of the nine journey species it reads as group-living or solitary, four are word-match misses: Nidoking (*"packs enormously destructive power"*), Typhlosion (*"rubs its blazing fur together"*), Magnezone (*"a group tried to use scientific means"*: people), Machamp (*"one arm alone can move mountains"*). It also misses Empoleon's leader. The engine should read approved claims, not the word match. Fixing `biology/claims.py` is a separate job, close to A-42's pass over the wilderness engine's patterns (D-079) |
| social capabilities | built | `calming_presence` and `town_fit` stay capabilities; the engine reads them and never changes them |
| the Chronicle | not built | optional in the Individual spec; this would be its first feeder |
| intake for event notes | the pattern is built | notes become proposed cards |
| the event catalog, temperaments, ties, label rules, the engine, the pages | not started | |

## 9. Your calls

Five forks, two or three candidates each, my recommendation first.

**F1. How alive is it?**

| Candidate | For | Against |
|---|---|---|
| **A. Ledger plus seasons** *(recommended)*: ties move with recorded events; seasons on demand, as evidence | dynamic where it can be (the ranch), honest where it has to be (the journey); the pattern you already approved for 6v6 | two kinds of history to keep apart on every page |
| B. Ledger only | simplest; nothing to mistake for canon | not really dynamic: the ranch changes only when you type |
| C. An always-on household sim | the most alive | the maintenance game the Survival spec rules out, writing history you didn't author |

**F2. Where personality comes from**

| Candidate | For | Against |
|---|---|---|
| **A. Authored, with the game's words as a weak prior** *(recommended)* | Nature and Characteristic are the game's own personality words, and a Careful Snorlax, a Calm Lapras and a Jolly Crobat read well (interpretation) | you pick natures for stats, and an Adamant Tyranitar shouldn't turn stubborn unless you say so. Hence weak, labeled, and one tap to turn off |
| B. Authored only | nothing leaks in from min-maxing | 36 or more temperaments to write before anything moves |
| C. Species plus chance | instant | the Pokédex is too thin (§8); it would be invention dressed as evidence |

**F3. The shape of a tie**

| Candidate | For | Against |
|---|---|---|
| **A. Four dimensions plus derived labels** *(recommended)* | rivals, mentors and protectors fall out of the numbers, the way roles fall out of builds | four numbers to explain instead of one |
| B. One opinion number | easy to read | can't tell a rival from an enemy |
| C. Labels only | closest to how you'd author it | nothing to move, so not dynamic |

**F4. Who's in the cast**

| Candidate | For | Against |
|---|---|---|
| **A. Pokémon plus a small human cast** *(recommended)*: you, the rival, ranch staff by role, family, Day-Care clients | the tie to you is the heart of it, and the staff are already in the ranch design | every person is one more thing to author |
| B. Pokémon only | tight | loses the tie to you, the only one the cartridge measures |
| C. Plus the whole Trainer Library | Ash-and-Pikachu reads | the Trainer spec keeps relationship mechanics out of its core |

**F5. Friendship**

| Candidate | For | Against |
|---|---|---|
| **A. Evidence for the tie to you, never written back** *(recommended)* | the only social number the games keep, and four companions prove it | the value is blank unless you enter it; the friendship evolutions are the proof until then |
| B. Ignore it | cleaner separation | throws away the one mechanic-class social fact |
| C. Ties drive it (Return's power and so on), as an optional ruleset | fun | the first social effect on battle; it would need its own decision |

**Smaller calls, with defaults unless you say otherwise:** the page's name (working title **The Commons**, under My
World); a season's length (90 world days); whether the rival's six become agents when they visit; whether the
attachment read (§5) is on.

## 10. Build order (each step ends usable)

| # | Step | Done when |
|---|---|---|
| S0 | **The contract:** this page approved; the catalogs as JSON (temperament axes and the nature and characteristic table, event types, label rules, phrases); tests that pin the arithmetic | a tie worked out by hand and by the code agree |
| S1 | **The ledger:** bonds from the lineage, teams, census and staffing; authored temperaments, ties and events in append-only tabs; the Relationships card | you open Lapras and see her ties, each with its receipts |
| S2 | **The reads:** cohesion, hub, bridges, hierarchy and households, with phrases; The room on team pages; the social map | the HeartGold six read as a group |
| S3 | **Seasons:** the seeded engine, batches of 100, storylines, inbox cards, the Chronicle | a what-if season with a real decision in it (a fate, a hire) |
| S4 | **Later:** intake for event notes; the friendship read; the attachment read if you want it | |
