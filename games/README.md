# Games

Two phone games built on shared engines, as a first test of the "mechanics library" idea: build the mechanic once, then reuse it in very different games.

| Game | What it is | Built from |
|---|---|---|
| **Basketball Playground** (`dist/basketball-playground.html`) | Flick-to-shoot basketball with defenders you have to read. Modes: Read & React, 3-Point Contest, HORSE vs four computer shooters, Shootaround with a shot chart, and a Challenge Builder. | Flick + trajectory, read and react, autonomous defenders, challenge creator |
| **Living School** (`dist/living-school.html`) | An eight-week semester at Hollow Creek High. Nine students with their own schedules, moods, friendships and memories. Conversations are a read-and-react card game, classes are microgames, and basketball tryouts, HORSE and Friday games run on the basketball engine. Ends with a yearbook the characters sign from what they remember. | Relationships + memory, simulation calendar, branching events, persistent records, rapid-fire microgames, and the whole basketball engine |

## How it maps to the five engines

| Engine | Code | Used by |
|---|---|---|
| 1 · Physical interaction | `src/shared/gesture.js` (flick, swipe, tap), `src/hoops/physics.js` (ball, rim, backboard, shot model), `src/school/micro.js` | both |
| 2 · Autonomous behavior | `src/hoops/defense.js`: seven defenders defined as data (closeout speed, foot speed, length, bite rate, which side they give you) | both |
| 3 · World construction | `src/hoops/court.js`: three courts whose dimensions and rims change outcomes (short high school three, double rim at the park) | both |
| 4 · Simulation and progression | `src/school/sim.js`: calendar, stats, grades, NPCs who move around, form couples and break up overnight | Living School |
| 5 · Narrative and social | `src/school/convo.js`, `src/school/events.js`, `src/school/data.js`: conversations, memories that fade unless they matter, gossip, secrets, 24 events | Living School |

Everything a designer would want to change is data: defenders in `defense.js`, courts and spots in `court.js`, the cast, places and lines in `data.js`, events in `events.js`. A basketball challenge is a plain object (`{ kind: 'possessions', count: 8, defenders: ['closer'], shotClock: 4 }`), which is how the Challenge Builder, tryouts and Friday games all drive the same engine.

## Build and test

```
python3 games/build.py                   # inlines src/ into one page per game in dist/
node games/test/physics_mc.js            # make rates by distance, touch error, contest
node games/test/makes_hoops.js           # in-browser: a well-sized flick scores from 6 to 21 ft
node games/test/smoke_hoops.js OUTDIR    # plays every basketball mode, screenshots
node games/test/bot_school.js SEED [PNG] # plays a full semester with random choices
node games/test/tryouts_school.js OUTDIR # tryouts with the real engine
node games/test/shots_school.js OUTDIR   # Living School screens, light and dark
```

Run the browser tests one at a time; several Chromium instances at once can run the container out of memory.

Saves go to the browser and, when the page runs as a claude.ai artifact, to the artifact's private per-player store, so progress follows you between devices.
