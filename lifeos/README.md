# LIFE OS · Living World Laboratory (v0.1)

A persistent small-town life simulation with a lab built around it. The town is Guilford, Connecticut:
Guilford High School (the Grizzlies, Southern Connecticut Conference), its students, staff and their households. Every person decides for themselves what to do,
twice a day, from a transparent utility model. You can watch, inspect any decision down to the
random roll, change the rules, run controlled experiments, and step into one person's life.

**Story mode** is the playable side: build yourself, your family and the people you want in your life,
let the town fill in around them, and live seven years, from the first day of freshman year through
three years of college and the MLB Draft (or work). It has a full sports career in football, basketball and baseball:
JV and varsity, starting spots, box scores, season stats, awards, injuries, recruiting, offers from real
colleges (UConn, Stanford, UCLA, LSU, UNC, Texas, Oklahoma, Florida State, Miami, Michigan) and the draft.

Everything here runs locally. No paid APIs, and no AI-generated text: the narrative comes from
procedural templates filled in from recorded simulation state.

## Run it

### The easy way (no typing)

1. Install Python from [python.org/downloads](https://www.python.org/downloads/). On Windows, tick **"Add python.exe to PATH"** on the installer's first screen.
2. Unzip the LIFE OS folder (on Windows: right-click the zip, then **Extract All**; don't run it from inside the zip).
3. Double-click **`Start LIFE OS (Windows).bat`** or **`Start LIFE OS (Mac).command`**.
   - Windows may say "Windows protected your PC": click **More info**, then **Run anyway**.
   - Mac may say it's from an unidentified developer: right-click the file, choose **Open**, then **Open** again.
4. The first time, it spends a minute or two setting up (needs internet). After that it starts in a few seconds.
   Your browser opens to the lab. Keep the black window open while you use it; close it to stop.

Don't open the Python app itself and paste commands into it. That window only understands Python code.

### The command-line way

You need **Python 3.10+** (tested on 3.13 and 3.15). Node is only needed if you want to change the interface (the built UI
is committed in `frontend/dist`).

```bash
cd lifeos
python -m pip install -r requirements.txt
python run.py                 # opens http://127.0.0.1:8765
```

Options: `--port 9000`, `--no-browser`, `--fresh` (ignore the autosave and start the demo world over).
The world autosaves to `lifeos/var/lifeos.db` (SQLite). Set `LIFEOS_DB=/path/to/file.db` to use another database.

**Changing the interface:**

```bash
cd lifeos/frontend
npm install
npm run dev      # http://localhost:5173, proxies /api to the Python server on 8765
npm run build    # rebuilds frontend/dist
```

## Your story (start here)

Open **My Story** in the sidebar and click **Start your story**. The setup has six steps:

1. **Welcome.** Name your story.
2. **You.** The character builder. Pick a starting archetype (athlete, brain, artist...) and it fills
   in a believable person, then tweak anything:
   - personality (10 traits), natural talent (5 aptitudes) and what drives them (6 motives);
   - interests and starting skills (a typical freshman is 25–50 in a sport);
   - height and build, jersey number, and a position in each sport you play.
3. **Family.** Your last name, guardians, how they parent, income and a pet (or no pet). Add siblings
   with a grade each; set "twin of" to make twins (same birthday, a twin bond).
   There are one-click buttons for an older brother who's a senior and twin sisters a year older than you.
4. **Your people.** Friends, a crush, a rival, a coach, anyone. Each one gets the same builder, plus
   how they feel about you (best friend, crush, rival, teammate...).
   Anyone besides you can also get a set path for after high school, like "play basketball at UConn":
   the offer shows up senior spring and they take it. Siblings have a quick dropdown for this on their card.
5. **The town.** How many students per grade (6–20). Generated classmates fill each grade around your people.
6. **Review & start.** Check catches every problem at once. You can also download your cast as a file
   and load it again later, so you don't have to rebuild your people.

**Playing.** The story page shows where you are in the seven years, how you're doing, your teams and
stats, your family and your people.
- **Live until something happens** runs the world until there's something for you: a story moment
  (tryouts, getting cut, an injury, a scholarship offer, a sibling leaving for college, someone asking
  you out, the college decision), an invitation, or a big event.
- **Next choice** stops at your very next decision so you can pick exactly what you do. You see every
  real option and how likely you'd be to pick it on your own.
- **Focus** (athletics, academics, social, romance, family, rest, work) tilts what you do when you
  let yourself decide. It's a named term in every decision trace, so you can see how much it mattered.
- At any choice, **Let them decide** hands it back to the simulation.

Everyone else lives their own life the whole time. Your brother graduates and leaves, your sisters
go off to college a year later and come home for Thanksgiving, friends drift, rivals show up. Siblings
playing college sports somewhere else still get season stats on their page.

**Grades matter.** GPAs run on a real 4.0 scale (most kids land around 3.0–3.3). Every program has a GPA it
needs from recruits: the NCAA minimum is 2.3, and Stanford wants a 3.4. If your GPA is under it at
senior spring, the offer gets pulled. Regular admission to the big schools is hard (Stanford is a long shot
even with a 4.0). Southern Connecticut State and Gateway Community College are there as local options.

**Recruiting is earned.** Each college has a program strength per sport (LSU baseball, UConn basketball and
Michigan football are the top of the list). The stronger the program, the better you need to be before
they offer. In senior spring you pick your path from the offers and admissions you've earned. On September 1
you arrive at college (teams, a roommate, new classmates, real conference opponents) or start working in town.

**The draft.** If you play college baseball, the Sports tab gets an MLB Draft board with your projected round
and why. The draft is in mid-July after your junior year: 20 rounds, real MLB teams, approximate slot values.
If you're picked, you choose: sign and start pro ball, or go back for senior year. That's the last chapter,
and the story closes with a look back at your seven years.

You can open anyone in **Character Studio** (including yourself) to see their full profile and athlete
page, and **History Explorer** shows the math behind anything that happened.

## Tests

```bash
cd lifeos
python -m pytest backend/tests -q      # 34 tests, about 40 seconds
```

They cover every acceptance criterion in the brief. Each name below is a test:
- **Characters and time:** stable identities, consistent time advancement, school-year rollover and graduation (traced and untraced).
- **Behavior:** NPCs initiate interactions on their own; relationships form, change and stay directed; parameters change decisions, both in exact scoring and in behavior; temperature controls determinism.
- **History:** event change logs add up to the actual state change in a slot; the history is internally consistent; important outcomes have traces whose terms add up to the utility and whose probabilities reproduce.
- **Reproducibility:** same seed gives the same outcomes and a different seed diverges; tracing never changes outcomes; a loaded save continues exactly like the original.
- **Configuration:** invalid configuration is rejected without partially applying; every rule parameter is read by the engine.
- **Lab tools:** experiment runs are isolated and reproducible; player choices go through the same resolvers; lab edits are validated and recorded; the workbook round-trips.
- **Demo:** the demo world produces measurably different lives.
- **Story mode** (`test_story.py`): the spec builds you, your siblings (twins included), your people and the town; validation reports every problem; moment choices change state and are recorded; a football season has rosters, box scores and stats; a senior leaves with a path, arrives at college and comes home for Thanksgiving; the story API flow works end to end. Also: the Guilford setting and the real colleges; a sibling set to play basketball at UConn ends up there; offers get pulled over GPA; the MLB draft after junior year and the finale; offscreen college seasons.

## Demonstration scenario

```bash
python demo.py                # ~1 minute: 180 days of the demo world + the approval experiment
python demo.py --days 365 --seeds 5
```

It prints, from the recorded history, how the featured characters' lives went: who they got close to,
what they tried out for, where it went wrong. It then compares Marcus (athletic aptitude 90,
discipline 26) with Devon (aptitude 60, discipline 92). Last, it runs the social-approval experiment
across paired seeds and prints differences with 95% intervals. In one run the basketball skill went
Marcus 58→64 and Devon 48→73, and raising social approval ×2.5 clearly raised exclusions and rumors
(4 of 4 seeds). The friendship effect was unresolved.

## A tour of the lab

| Section | What you can do |
|---|---|
| **My Story** | Story mode: the setup wizard, then your life. Moments, choices, invitations, focus, your teams, season stats, box scores, awards, recruiting board, family and people. |
| **World Overview** | Clock, population and world statistics, the notable-events feed (filter by social / romance / conflict / school), upcoming calendar, spotlight (most popular, most stressed, loneliest), weekly trend charts, cliques, institutions. |
| **Character Studio** | Every person as a card. Their profile keeps the layers separate: personality, aptitude, learned skills (with the talent ceiling marked), motives, current condition, circumstances (household, money, groups). Also goals, interests, reputation and learned expectations. The relationships table shows both sides: how they see each person, what they *think* that person feels, and what that person actually feels. Then their timeline, recent decisions (each opens its trace) and memories. **Edit** any attribute, validated and logged as a lab edit. **Create a character** with the full character builder (personality, body, positions, relationships). Athletes get an athlete page with season stats, career totals, awards and recruiting. |
| **Social Network** | A force-directed map: mutual friendships, one-sided ones (dashed), couples, crushes, rivalries. Click a person or a line. Below it: cliques, groups and institutions (rosters, captains, records, cut lists), the biggest perception gaps, and households. |
| **Live Any Life** | Pick anyone. At each decision point you see their real options, why each is available, and how likely they would be to pick it on their own. Choose one, or let them decide. The simulation resolves it with the same rules and dice as everyone else's choices. |
| **History Explorer** | Every event, filterable by person, type, importance, date range and text, with a CSV export. Each event shows its calculation (probabilities and rolls), every state change (before, after and why), the memories it created, its causes and its consequences. The **decision trace inspector** shows every option weighed, each term's contribution, the temperature, the random roll and the weights in effect. |
| **Experiment Center** | Presets and a builder: a base world (fresh from a generation seed, the current world, or a save), the number of days, the seeds, and variants with rule overrides. Runs happen in separate processes. Results are labelled honestly: one seed is a *deterministic paired comparison* (including whose lives changed and the day the timelines split); several seeds are a *repeated-run measurement* (means, 95% intervals on paired differences, direction counts, effect sizes). |
| **Engine Workshop** | 78 rule parameters with ranges, defaults and descriptions, applied from the next slot. Changes are validated, logged as lab events and versioned. Per-action coefficients (base, risk, need/motive/trait weights, target terms, on/off). Excel workbook export and import. Change log. |
| **Content Library** | The data catalogs: actions, goals, narrative templates, world and institutions, archetypes and staff, attribute definitions, metrics. |
| **Saves & Worlds** | Save, load, download and upload snapshots. Generate a new world (generation seed, population, with or without the featured cast). Change the simulation seed. |

Time controls are in the top bar: Day / Week / Month / Year, Auto with a speed setting, and quick save.
A simulated day takes roughly 0.03–0.1 s, and a full traced year roughly 25–35 s.

## How it works (short version)

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design and the assumptions behind it.

- **One authoritative world** (`backend/lifeos/model.py`) holds characters, directed relationships,
  bonds, households, groups, cliques, rumors, the calendar, the rules and the history. The server
  holds one instance. Saves are complete compressed snapshots.
- **Time**: each day runs a fixed list of phases. School days are morning → classes → lunch\* → after school\* → night;
  other days are morning → day\* → evening\* → night. \* marks a decision slot. Weekly and yearly processing hangs off night.
- **Decisions** (`decision.py`): every acting character enumerates (action, target) candidates from
  `data/actions.json` and scores each one as a sum of named terms:
  - needs, motives × their global weights, and traits
  - interests, and feelings toward the target
  - goals, memories, learned experience, habit and peer conformity
  - minus risk, plus commitment and situational terms

  An action's possible targets share one slot of probability. The choice is a softmax draw with a personal
  temperature (impulsive people are noisier). Every term is recorded.
- **Resolution** (`actions.py`, `institutions.py`): invitations can be declined by the other person,
  who weighs it against their own plan. Interactions have one true quality, but each side experiences
  it with its own noise, and each forms a *belief* about the other. That is how one-sided friendships
  and misread crushes happen. Collective events (lunch tables with exclusion, practices, tryouts judged
  by each coach's own weights, games, shows, dances, parties, elections) resolve after individual actions.
- **Consequences**: memories, learned expectations, goals (created by failure, rejection, grudges,
  loneliness...), skill growth toward an aptitude ceiling, confidence drift, interest drift,
  popularity and reputation, rumors that spread and can be traced back to whoever started them.
  Some consequences are delayed: tryout results post the next morning, and parents find out the next day.
- **Randomness** (`rng.py`): every draw comes from a stream derived from the seed plus a name and keys
  (for example decision / day / slot / character). Unrelated systems don't share random numbers, and
  there is no hidden RNG state, so a save plus the seed fully determines the future.

## Project layout

```
lifeos/
  run.py                 start the server (+ open the browser)
  demo.py                the demonstration scenario
  requirements.txt
  backend/
    data/                the data catalogs (JSON): rules schema, actions, world, people, templates, goals,
                         sports, colleges, story moments
    lifeos/              the engine and API (Python)
      rng.py rules.py catalogs.py model.py history.py calendar.py worldgen.py
      decision.py actions.py social.py institutions.py households.py development.py
      sports.py college.py story.py moments.py
      narrative.py metrics.py engine.py experiments.py storage.py spreadsheet.py api.py
    tests/test_lifeos.py tests/test_story.py
  frontend/              React + TypeScript + Vite; dist/ is the built app the server serves
  docs/DESIGN.md
```

## Status: what works and what doesn't yet

**Working and tested:**
- The world, time advancement, autonomous agents, social dynamics, institutions and households.
- Persistent history with decision traces and state-change logs.
- Rules and action editing with validation, save/load, experiments, the workbook round-trip, play mode, and all the UI sections.
- Story mode: the spec and builder, siblings and twins, custom relationships, moments, focus, invitations, the three sports, recruiting, the college decision, college life and breaks at home, jobs in town.

**Not implemented or partial in v0.1 (labelled honestly):**
- **Guardians** are household-level actors with a parenting style. They react to grades and trouble, but they aren't autonomous agents.
- **Pets** affect household members (pet time relieves stress). They have no needs or behavior of their own.
- **Careers and economy** are minimal: two part-time employers, allowance by income level, and costs for outings.
- **After high school**: your own college is fully simulated (teams, classes, roommate, classmates). Everyone else who leaves town lives offscreen: weekly updates, no daily decisions, home for breaks. Graduates who stay in town work full time. The seven chapters end with the MLB Draft after college junior year and a final review. The world keeps running after that, but pro ball is offscreen (no minor league seasons yet), and there's no grad school or later adult life.
- **College sports** are simplified: one varsity team per sport, a short schedule (11 football games, 18 basketball, 14 baseball), and no transfer portal, redshirts or NIL.
- **Real names, simulated numbers.** Guilford, its spots (the Green, Jacobs Beach, Bishop's Orchards), the SCC opponents, the colleges, their conferences and the MLB teams are real. Program strengths, GPA cutoffs, draft projections and slot values are design values for the simulation, not official figures. Every person is generated or made by you.
- **Spreadsheet import** covers Rules, Actions and Characters. Groups, templates and goals are edited in the JSON catalogs; restart the server to reload them.
- **Narrative text** is template-based and functional rather than literary.
- **Balance** is a first pass. The demo produces plausible years, but the numbers are design values meant to be tuned in the Workshop. Known tendencies: moods trend high over a long run, team rosters in a 36-student school are small, and outcomes vary a lot between seeds (which is what the Experiment Center is for).
- **Speed**: a traced year takes 25–35 s in pure Python. In story mode, people far from your life act less often and aren't traced, so a story year runs in about the same time. Experiments run untraced and in parallel.
- **History retention**: routine events older than 60 days are folded into per-person counters. Routine decision traces are kept for 45 days, and traces for important events are kept forever. All of this is configurable in the Workshop.
