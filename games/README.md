# Games

Phone games built on shared engines, as a test of the "mechanics library" idea: build the mechanic once, then reuse it in very different games. Basketball Playground is the template. Fairway, Pong Night and At Bat carry its idea to other sports: one motion that feels like the real thing and is calibrated to you, a touch window, opposition or conditions as data you have to read, and physics deciding what happens.

| Game | What it is | Built from |
|---|---|---|
| **Basketball Playground** (`dist/basketball-playground.html`) | Flick-to-shoot basketball with defenders you have to read. Modes: Read & React, 3-Point Contest, HORSE vs four computer shooters, Shootaround with a shot chart, and a Challenge Builder. | Flick + trajectory, read and react, autonomous defenders, challenge creator |
| **Living School** (`dist/living-school.html`) | An eight-week semester at Hollow Creek High. Nine students with their own schedules, moods, friendships and memories. Conversations are a read-and-react card game, classes are microgames, and basketball tryouts, HORSE and Friday games run on the basketball engine. Ends with a yearbook the characters sign from what they remember. | Relationships + memory, simulation calendar, branching events, persistent records, rapid-fire microgames, and the whole basketball engine |
| **Fairway** (`dist/fairway.html`) | Golf. Pull back and swing through; read the wind, the lie and the pin. Modes: Play 9, Closest to the Pin, Putting Green, Challenges, the Range. | Swing gesture + ball flight, conditions as data |
| **Pong Night** (`dist/pong-night.html`) | Beer pong against opponents with habits. Read the rack and the guy across the table, call your re-racks. Modes: a game, Rack Attack, Island drills, Practice. | Flick + trajectory, opponents as data, cup physics |
| **At Bat** (`dist/at-bat.html`) | Baseball hitting. Read the pitcher, the count and the situation, then put a swing on it. Modes: At-Bats, Situational, Home Run Derby, Batting Cage, Challenges. | Hold-drag-swipe swing, pitchers as data, pitch and batted-ball physics, fielders |
| **Option Arcade** (`dist/option-arcade.html`) | Football, played by hand. The triple option, the read option and the jet sweep: hold to give, let go to pull, read the end and then the next man, pitch or keep. The passing game: four concepts against Cover 1, 2, 3 and the blitz; pull back to aim, let go to throw; scramble when it breaks down. Then steer whoever has the ball: juke, spin, hurdle, truck. Modes: Option Lab, Pass Lab, Drive (the whole playbook), Goal Line, and a film room. | Mesh decision as a hold/release, defenders who each read the play, blocks that hold or get shed, ball-carrier steering and contact |
| **Swing Lab** (`dist/swing-lab.html`) | Batting feel prototype. A big, bright, slower ball; swipe through it as it arrives. Fastball, changeup and curveball differ only in how they move. Training mode, pitcher-facing vs side-offset camera, trail and speed settings, and a stats sheet that answers: can you track it, do you know when to swipe, are you improving. | 3D pitch paths, contact plane, timing and height windows, batted-ball flight and fielders, synthesized sounds |

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

## Playmaker (passing)

A separate mode inside Basketball Playground: five on five, and you're passing. Break your man down, draw the help, find the man they left. Get all the way to the rim and you finish it yourself.

| Gesture | Pass |
|---|---|
| Flick | Pass to a spot. Longer flick, farther; your first passes set the scale. |
| Snap it | Bullet. Flat and fast, beats a rotation. |
| Pull back, then flick | Bounce pass, under the hands. |
| Curl it | Bends the pass around a defender. |
| Drag | Drive. Drag, then flick is drive and kick in one motion. |
| Hold still | Court vision: the floor slows down for about a second each possession. |
| Tap | Pass fake. Lane jumpers jump. |
| Flick while the ball is in the air | The next pass: he catches it and swings it right away. |

Passing has its own setting. Casual (the default): flick toward a man and it finds him, leads him, and picks the pass that gets through traffic (the bounce inside, over the top when hands are in the lane, the skip on a long one). Your reads still decide it: throw into a denial and it's still picked. Normal: a smaller cone, and your flick picks the pass. Pro: you throw it to a spot.

Hit him in the shooting pocket and he gets a rhythm shot; behind him or at his feet, he's late. A man nobody can get to is never late. Control follows the ball: an open man shoots on the catch unless you make the extra pass first, and the man the ball is going to wears your ring while it's in the air.

Spacing: shooters stand a step behind the line where they'll shoot it and hold their spots; on a baseline drive the corner lifts to the wing. The big lives at the dunker spot, and when his man steps up to stop your drive he's right there for the dump-off. Hold for court vision and each man shows what he wants (shooter, cutter, rim).

Defenses are data in `src/hoops/pm-plays.js`, each leaving somebody: Pack Line (kick and skip), Corner Help (the corner three), Rim Protector (dump-off or lob), Denial (backdoor), Lane Jumper (fake him, bounce under him), Scramble (the extra pass). Draw It Up is a whiteboard: draw a cut and a pass, then watch it run on the same simulation. Code: `pm-sim.js` (players, passes, defense), `pm-engine.js` (camera, input, drawing).

## Benchmark

Commit `15912dc` (published as version 4 of the Basketball Playground artifact) is the benchmark for how the game should feel: the offensive read game, jumper variety and 1-on-2 help. New work goes alongside it, not into it. Before anything ships, the tests below should still match what they gave at that commit.

## Fairway (golf)

Pull straight down for the backswing (the gold notch is your number), then swing up through it. Tempo from the top back to the ball is the touch window; a short finish knocks it down, a long one hits it high; bow the swing to draw or fade; swipe sideways to aim. Three range swings set your full swing, tempo and natural finish. Putting is the same motion, smaller.

Conditions are data in `src/golf/reads.js`, each with a tell on screen and an answer: into, down and crosswinds (watch the flag and the treetops), tucked pins, water short, falling-away greens, flier lies, greenside bunkers, doglegs, and four putting reads. Holes are data in `src/golf/course.js`; ball flight, bounce, roll, break and the cup are in `src/golf/physics.js`.

## Pong Night (beer pong)

| Gesture | Throw |
|---|---|
| Flick | Arc. About 10% harder is one cup deeper. |
| Short, sharp flick | Fastball. Forgiving on depth, but it hits the first rim on its line. |
| Pull down, then flick | Bounce. Counts two cups. |
| Curl an arc | Spin rides the rim; too much spins out. |

Three calibration throws set your touch. The read: naked front cup, fastball; buried cup, arc; island with open table, bounce. Re-racks at six and three are your call. Opponents are data in `src/pong/rules.js`: the Statue (never swats), the Swatter (swats bounces), the Blower (blows out spinners), the Waver (throw when his arms are down), the Sniper (makes about 70%). Two balls a turn, both in for balls back, heating up at two, on fire at three, rebuttal, overtime.

## At Bat (baseball hitting)

| Gesture | What it does |
|---|---|
| Touch and hold | Load. A loaded swing has more pop. |
| Drag | Move your barrel (the gold ring) to where you want the ball. |
| Swipe through | Swing. Early pulls it, late pushes it the other way. Your first five swings set your clock. |
| Swipe angle | Up lifts it, flat lines it, down chops it. |
| Swipe speed | Harder swings hit it farther but give you less time to be right. |
| Short, quick swipe | Contact swing: bigger barrel, less power. Your two-strike swing. |
| Don't swipe | Take. The zone is the real one. |

| Pitcher | Tell | The approach |
|---|---|---|
| The Flamethrower | 98 with a big leg kick; heat above your hands with two strikes | Be on time, lay off the high one |
| The Junkballer | Slow arm, changeups and curves away | Wait on it, go the other way |
| The Sinkerballer | Heavy ball at the knees | Set your barrel up, make him come up |
| The Slider Specialist | Low slot; the sweeper shows a red dot and leaves the plate | Sit fastball, let the sweeper go |
| The Closer | Slide step; the splitter tumbles into the dirt | Hunt the heater early, take the tumble with two strikes |
| The Crafty Lefty | Lives on the black | Shrink your zone, take your walk |

The situation picks the swing: runner on third with one out (get it in the air), hit-and-run (put it in play, right side), runner on second with nobody out (right side), two outs (just get a hit). Code is in `src/bat/`: pitches, contact, field and fielders, the park, pitchers and situations.

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
node games/test/pm_passes.js             # Playmaker: picks and tips by lane and pass type, catch quality
node games/test/pm_reads.js              # Playmaker: each defense's right read against the wrong one
node games/test/pm_spacing.js            # Playmaker: shooters on the arc, the big at the rim, dump-offs, Casual aim
node games/test/pm_controls.js OUTDIR    # Playmaker gestures: pass types, drive and kick, vision, extra pass, queued pass, Casual aim
node games/test/pm_smoke.js OUTDIR       # Playmaker and Draw It Up through the app
node games/test/physics_golf.js          # carries by club, wind, shot shape, putts by pace
node games/test/controls_golf.js OUTDIR  # every swing shape and every read through the page
node games/test/views_golf.js OUTDIR     # every tee, approach, chip, bunker and putt view
node games/test/smoke_golf.js OUTDIR     # a full round plus every mode
node games/test/physics_pong.js          # make rates by shot, cup, exposure, touch, spin
node games/test/sim_pong.js              # whole games vs each opponent: right reads vs arcs only
node games/test/controls_pong.js OUTDIR  # throws, each opponent's read, re-racks, fire, rebuttal
node games/test/smoke_pong.js OUTDIR     # every mode through the app
node games/test/physics_bat.js           # pitch movement, outcomes by timing and contact, situations
node games/test/controls_bat.js OUTDIR   # calibration, timing, swing plane, takes, situations
node games/test/smoke_bat.js OUTDIR      # every mode through the app
node games/test/sim_option.js [N]        # Option Arcade, headless: every defensive look, right reads vs wrong reads (triple, read, jet)
node games/test/sim_pass.js [N]          # passing, headless: the open man vs the covered man for every coverage and concept; sacks
node games/test/moves_option.js [N]      # spin and hurdle are counters: a timed hurdle clears a diving man, an early one gets hit
node games/test/smoke_option.js OUTDIR   # Option Arcade through its controls at three phone sizes, plus the LIFE OS round
node games/test/bot_school.js SEED [PNG] # plays a full semester with random choices
node games/test/tryouts_school.js OUTDIR # tryouts with the real engine
node games/test/shots_school.js OUTDIR   # Living School screens, light and dark
```

Run the browser tests one at a time; several Chromium instances at once can run the container out of memory.

## Option Arcade controls

| Gesture | Move |
|---|---|
| Hold GIVE | Snap it. Keep holding through the exchange and the fullback gets it. |
| Let go of GIVE | Pull it back and keep it. Pull too late, with both hands on it, and it can come out. |
| PITCH (shows up once you've pulled it, with the pitch man trailing) | Pitch it. A real toss: pitch under pressure, too far, or across your body and it can hit the ground. |
| Left thumb, drag | Steer whoever has the ball. Let go and he bends upfield. Sharp cuts cost speed. |
| Right thumb, swipe up or down | Juke that way. Time it as he dives and he grabs air; close defenders can bite on it. |
| Right thumb, tap | Truck: lower your shoulder for a moment. Wins against smaller defenders and bad angles, loses to a big man squared up. |
| Right thumb, swipe back | Spin. Hits from the side, from behind and arm tackles slide off; a man squared up in front doesn't. Costs speed. |
| Right thumb, swipe forward | Hurdle. Clears a man diving at your legs from the front or side. A man who stays up meets you in the air (and defenders don't dive at a runner who's already airborne), so hurdle as he dives, not before. |
| Pass plays: tap SNAP | The camera goes up behind the offense (the All-22 end-zone angle) so you can see the routes and the safeties. The QB takes three steps back and sets; the left thumb moves him in the pocket. |
| Throwing: two ways, switched with the Drawback / Flick pill above the field before the snap (or in settings) | **Drawback**: SNAP sits in the middle, 40% up from the bottom, and the camera puts the QB there too, so there's room under him. Put your thumb by the QB and pull down (and to the side to go left or right) like a slingshot: the arc shows where it lands, the farther you pull the farther it goes, the world slows a touch while you aim, and you lead your man. The QB moves with a thumb in the bottom-left corner. **Flick**: SNAP and the QB stay low. Flick on the right side toward a receiver and the ball goes to where he's headed on his route; a harder flick is a faster, flatter throw, a soft one floats it. Flick at open grass and it goes where you flicked it. The left thumb moves the QB. Either way, cross the line of scrimmage and you can't throw: you're a runner. |
| Camera angle (settings) | All-22 on passes (default; runs keep the sideline view), All-22 always, or sideline always. Steering and swipes follow the camera: in All-22, up is downfield, so a juke is a swipe left or right. |

The reads are the game. The first is the end: if he crashes in on the dive, pull it; if he sits or comes at you, give it. The second, once you've pulled it, is the next man out: if he comes for you, pitch it; if he runs with the pitch man, keep it. Defenders show it with their bodies (shoulders and facemask), not labels. Read help rings the two defenders and slows the exchange. Defensive looks (Option Lab): end crashes, end sits, end attacks the QB, backer takes the QB, backer plays the pitch, backer slow-plays, scrape exchange, safety fills the alley, and mixed. Also the read option (shotgun, give or keep). The jet sweep is the same read as the read option with a receiver in full-speed motion. Passing: Slants, Smash, Four Verticals and Mesh against Cover 1 (man), Cover 2, Cover 3 and a five-man blitz. Coverage is decided after the snap from the same two-high look; man defenders trail their receiver and lose a step on hard cuts, zone defenders sit in their landmarks and undercut, deep defenders stay over the top, and everyone breaks on the ball once they see it thrown. The pass rush gets home the longer you hold it. After every throw the card names the coverage and who was open (whether any defender could reach the catch point before the ball). Keys on a keyboard: arrows steer, space snaps and gives, Z/X juke, C truck, V spin, B hurdle, P pitch, 1-5 throw to a receiver. Code is in `src/football/`: `sim.js` (the play: no DOM, runs headless), `render.js`, `app.html`.

## Inside LIFE OS

Every game carries the LIFE OS bridge (`src/shared/lifeos.js`). Opened on its own it plays exactly as before. Inside the
LIFE OS phone app (an iframe with `?embed=1`) it waits for the round's config, opens the mode LIFE OS asks for
(`config.play`: `menu`, `clutch`, or a game's own mode like `playmaker` or `short`), and hands the score back with
`LifeOS.finish({score, max})`. The embed glue lives beside each game (`src/golf/embed.js`, `src/pong/embed.js`,
`src/bat/embed.js`, and in `src/hoops/app.html`) and never touches the mechanics. After changing a game run
`python lifeos/tools/sync_games.py` to copy the built pages into LIFE OS.

## Keep a copy

`python3 games/standalone.py basketball-playground.html` turns the built game into `dist/basketball-playground-standalone.html`: a complete web page that runs on its own, outside Claude. Save it anywhere (Google Drive, a computer, a phone's files) and open it in a web browser. Progress saves to that browser.

Saves go to the browser and, when the page runs as a claude.ai artifact, to the artifact's private per-player store, so progress follows you between devices.
