# Games

Two phone games built on shared engines, as a first test of the "mechanics library" idea: build the mechanic once, then reuse it in very different games.

| Game | What it is | Built from |
|---|---|---|
| **Basketball Playground** (`dist/basketball-playground.html`) | Flick-to-shoot basketball with defenders you have to read. Modes: Read & React, 3-Point Contest, HORSE vs four computer shooters, Shootaround with a shot chart, and a Challenge Builder. | Flick + trajectory, read and react, autonomous defenders, challenge creator |
| **Living School** (`dist/living-school.html`) | An eight-week semester at Hollow Creek High. Nine students with their own schedules, moods, friendships and memories. Conversations are a read-and-react card game, classes are microgames, and basketball tryouts, HORSE and Friday games run on the basketball engine. Ends with a yearbook the characters sign from what they remember. | Relationships + memory, simulation calendar, branching events, persistent records, rapid-fire microgames, and the whole basketball engine |

## Basketball controls

| Gesture | Move |
|---|---|
| Flick up | Shoot. Harder flick, more distance; your free-throw flick sets the scale. |
| Long swipe left/right | Drive. Clear reads resolve the same way every time; only close calls are a coin flip. |
| Short swipe | Jab. Jumpy defenders shift their weight toward it. |
| Swipe the other way mid-drive | Crossover. Going against the way his weight is carried beats him. |
| Swipe down | Step back. Defenders react a beat late, longer for heavy feet. |
| Diagonal swipe down-left/down-right | Side-step. A hop sideways; going away from his lean plants him. |
| Flick during a drive | Pull-up jumper from where you are. |
| Flick right after a step-back or side-step | Step-back or side-step jumper. |
| Pull down, then flick up | Fadeaway. Released from behind your spot with more arc; contest counts about half; smaller window. |
| Tap | Pump fake. |
| Sideways swipe after a blow-by, near the rim | Euro step. Buys a beat before he recovers. |
| Curl the layup flick | Spin. A little curl sits soft on the rim and rolls in; a big hook spins it out. Layups from the side go off the glass. |

Moves made while another is finishing are queued, so you can chain jab, cross, euro, finish.

## Help defense (1 on 2)

Read & React mixes in possessions where a second defender is waiting behind your man. He doesn't double you. He only comes once you beat the first guy, so your dribble and decisions still win the first matchup. After that, the kind of help tells you which shot to take. A pure release still beats a good contest, so shot making stays the last word.

| Help | Where he waits | What beats him | What he punishes |
|---|---|---|---|
| The Wall | Planted at the rim | Floater over him, or a pull-up before you get there | Layups at him (contest and blocks) |
| The Charge Taker | Weak-side lane | Floater before his spot, or a euro around him | Riding the drive into him: charge |
| The Leaper | Ball-side block, steps up | Pump fake to get him in the air, then finish | A straight layup |
| Late Help | Weak-side wing | Any quick finish | Hesitating or faking: he arrives |
| The Digger | Ball-side elbow | Driving away from him, or rising early | Driving past his side: stripped |

Help defenders are data in `src/hoops/help.js`, same as the on-ball defenders. A challenge picks them with `help: 'none' | 'mix' | 'always' | ['wall', ...]`, and the Challenge Builder has the same switch.

Living School keeps a frozen copy of the basketball engine in `src/school/hoops/`, so changes to Basketball Playground don't move its tryouts and Friday games.

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
node games/test/physics_layup.js         # layups by angle, touch error and spin
node games/test/controls_hoops.js OUTDIR # jab, crossover, euro step, queued moves, spun layup
node games/test/jumpers_hoops.js OUTDIR  # pull-up, step-back, side-step, fadeaway; gesture edges
node games/test/physics_fade.js          # fadeaway make rates vs set shots
node games/test/help_hoops.js OUTDIR     # each help type: the shot it gives you and the one it takes away
node games/test/makes_hoops.js           # in-browser: a well-sized flick scores from 6 to 21 ft
node games/test/smoke_hoops.js OUTDIR    # plays every basketball mode, screenshots
node games/test/bot_school.js SEED [PNG] # plays a full semester with random choices
node games/test/tryouts_school.js OUTDIR # tryouts with the real engine
node games/test/shots_school.js OUTDIR   # Living School screens, light and dark
```

Run the browser tests one at a time; several Chromium instances at once can run the container out of memory.

Saves go to the browser and, when the page runs as a claude.ai artifact, to the artifact's private per-player store, so progress follows you between devices.
