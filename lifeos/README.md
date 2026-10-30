# LIFE OS · Living World Laboratory (v0.1)

A persistent small-town life simulation with a lab built around it. Hollow Creek has one high school,
36 students, 8 staff and their households. Every person decides for themselves what to do,
twice a day, from a transparent utility model. You can watch, inspect any decision down to the
random roll, change the rules, run controlled experiments, and step into one person's life.

Everything here runs locally. No paid APIs, and no AI-generated text: the narrative comes from
procedural templates filled in from recorded simulation state.

## Run it

You need **Python 3.10+**. Node is only needed if you want to change the interface (the built UI
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

## Tests

```bash
cd lifeos
python -m pytest backend/tests -q      # 21 tests, about 15 seconds
```

They cover every acceptance criterion in the brief. Each name below is a test:
- **Characters and time:** stable identities, consistent time advancement, school-year rollover and graduation (traced and untraced).
- **Behavior:** NPCs initiate interactions on their own; relationships form, change and stay directed; parameters change decisions, both in exact scoring and in behavior; temperature controls determinism.
- **History:** event change logs add up to the actual state change in a slot; the history is internally consistent; important outcomes have traces whose terms add up to the utility and whose probabilities reproduce.
- **Reproducibility:** same seed gives the same outcomes and a different seed diverges; tracing never changes outcomes; a loaded save continues exactly like the original.
- **Configuration:** invalid configuration is rejected without partially applying; every rule parameter is read by the engine.
- **Lab tools:** experiment runs are isolated and reproducible; player choices go through the same resolvers; lab edits are validated and recorded; the workbook round-trips.
- **Demo:** the demo world produces measurably different lives.

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
| **World Overview** | Clock, population and world statistics, the notable-events feed (filter by social / romance / conflict / school), upcoming calendar, spotlight (most popular, most stressed, loneliest), weekly trend charts, cliques, institutions. |
| **Character Studio** | Every person as a card. Their profile keeps the layers separate: personality, aptitude, learned skills (with the talent ceiling marked), motives, current condition, circumstances (household, money, groups). Also goals, interests, reputation and learned expectations. The relationships table shows both sides: how they see each person, what they *think* that person feels, and what that person actually feels. Then their timeline, recent decisions (each opens its trace) and memories. **Edit** any attribute, validated and logged as a lab edit. **Create a character** from an archetype. |
| **Social Network** | A force-directed map: mutual friendships, one-sided ones (dashed), couples, crushes, rivalries. Click a person or a line. Below it: cliques, groups and institutions (rosters, captains, records, cut lists), the biggest perception gaps, and households. |
| **Live a Life** | Pick a student. At each decision point you see their real options, why each is available, and how likely they would be to pick it on their own. Choose one, or let them decide. The simulation resolves it with the same rules and dice as everyone else's choices. |
| **History Explorer** | Every event, filterable by person, type, importance, date range and text, with a CSV export. Each event shows its calculation (probabilities and rolls), every state change (before, after and why), the memories it created, its causes and its consequences. The **decision trace inspector** shows every option weighed, each term's contribution, the temperature, the random roll and the weights in effect. |
| **Experiment Center** | Presets and a builder: a base world (fresh from a generation seed, the current world, or a save), the number of days, the seeds, and variants with rule overrides. Runs happen in separate processes. Results are labelled honestly: one seed is a *deterministic paired comparison* (including whose lives changed and the day the timelines split); several seeds are a *repeated-run measurement* (means, 95% intervals on paired differences, direction counts, effect sizes). |
| **Engine Workshop** | 76 rule parameters with ranges, defaults and descriptions, applied from the next slot. Changes are validated, logged as lab events and versioned. Per-action coefficients (base, risk, need/motive/trait weights, target terms, on/off). Excel workbook export and import. Change log. |
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
    data/                the data catalogs (JSON): rules schema, actions, world, people, templates, goals
    lifeos/              the engine and API (Python)
      rng.py rules.py catalogs.py model.py history.py calendar.py worldgen.py
      decision.py actions.py social.py institutions.py households.py development.py
      narrative.py metrics.py engine.py experiments.py storage.py spreadsheet.py api.py
    tests/test_lifeos.py
  frontend/              React + TypeScript + Vite; dist/ is the built app the server serves
  docs/DESIGN.md
```

## Status: what works and what doesn't yet

**Working and tested:**
- The world, time advancement, autonomous agents, social dynamics, institutions and households.
- Persistent history with decision traces and state-change logs.
- Rules and action editing with validation, save/load, experiments, the workbook round-trip, play mode, and all nine UI sections.

**Not implemented or partial in v0.1 (labelled honestly):**
- **Guardians** are household-level actors with a parenting style. They react to grades and trouble, but they aren't autonomous agents.
- **Pets** affect household members (pet time relieves stress). They have no needs or behavior of their own.
- **Careers and economy** are minimal: two part-time employers, allowance by income level, and costs for outings.
- **Alumni** stay in the world and keep relationships, but have a reduced action set. There is no college or adult life yet.
- **Spreadsheet import** covers Rules, Actions and Characters. Groups, templates and goals are edited in the JSON catalogs; restart the server to reload them.
- **Narrative text** is template-based and functional rather than literary.
- **Balance** is a first pass. The demo produces plausible years, but the numbers are design values meant to be tuned in the Workshop. Known tendencies: moods trend high over a long run, team rosters in a 36-student school are small, and outcomes vary a lot between seeds (which is what the Experiment Center is for).
- **Speed**: a traced year takes 25–35 s in pure Python. Experiments run untraced and in parallel.
- **History retention**: routine events older than 60 days are folded into per-person counters. Routine decision traces are kept for 45 days, and traces for important events are kept forever. All of this is configurable in the Workshop.
