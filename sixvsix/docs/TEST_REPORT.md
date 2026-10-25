# Test report: Phases 0–3 and the 6v6 Lab

*2026-10-25 · `@pkmn/sim` 0.10.11 · `@smogon/calc` 0.12.0 · contract 0.1.0 · Node v22.22.0 on a 4-core Intel Xeon
2.10 GHz (the cloud container) · Chromium via Playwright. Everything below was run, not inferred, unless it says
**unverified**.*

## The short version

- **Executed:**
  - 161 automated tests, all passing.
  - The whole system end to end: each of your three Gen 4 teams against every member of its league, with trainer
    agents on both sides. That's 1,280 league battles, 1,280 more for the D-072 check (640 pairs), and 9,840 for the
    D-074 check on every optimized spread and variation.
  - 21 recorded Lab experiments, 12,580 battles (`results/lab/`).
  - 4 recorded 100-battle jobs.
  - 25 browser runs of 100 battles each, all playing exactly the battles Node played, and the Lab page in Chromium
    (below).
- **Failed:** nothing in the final run. On the way, the tests, the runs and the browser checks caught real bugs in my
  code (listed at the end), each fixed and covered by a test or a recorded run.
- **Found:**
  - **D-072 works.** Your optimized spreads win more than the same six on 85 in every stat, in all three games:
    - HeartGold: 90% → 95%;
    - SoulSilver: 74% → 88%;
    - Platinum: 89% → 98%.

    Each is significant (McNemar p ≤ 0.004), and the HP margin rises by 9–16 points.
  - **D-074:** the conventional spread is played for 16 of the 18 members. Crobat and Empoleon keep their duel
    spreads, measurably better on HP margin.
  - **The league is mostly won, with two real weak spots:** HeartGold against Bruno's rematch (22 of 40) and
    SoulSilver against Lance and his rematch (25 and 8 of 40). Both come from the teams' types, not from a bug.
  - **Showdown and the one-on-one engine's calculator differ by 1–3 HP** in 5 of 48 damage cases. In each, the
    calculator follows the cartridge's integer arithmetic and Showdown uses its modern rounding.
- **Unverified:**
  - a real iPhone, and the Lab page inside the claude.ai viewer on a phone;
  - a real Apps Script deployment;
  - the cartridge AI against a real cartridge. It's checked against the one-on-one engine's port, which cites the
    disassemblies, not against a cartridge.

Rerun everything:

```
cd sixvsix && npm ci
npm test                          # 161 tests, about 45 s
node cli/run.mjs all              # the four recorded jobs → results/ (about 30 s)
node cli/league.mjs               # each team against its league + the D-072 check → results/league/ (about 35 s)
node cli/confirm-spreads.mjs      # the D-074 check on every spread and variation (about 3 min)
node cli/lab-record.mjs           # the 21 recorded experiments → results/lab/ (about 4 min)
npm run build && npm run test:browser   # bundles, bench and Lab pages, 25 browser runs → results/browser/perf.json
node browser/test-lab.mjs         # the Lab page in Chromium
```

## This round: the 6v6 Lab (D-074, D-075)

**What was built, against what you said decides whether you like it.**

| Your test | What there is now |
|---|---|
| How well it works | The engine answers six questions (a gauntlet, Build A vs B, builds × trainer styles, the best lead, your trainer's style, what moves the needle), each with a Strategy Report that says how far to trust it. Two ways to play a game trainer: the cartridge's own AI, or Blackthorn's reading. The trainer agent's turn model now counts sleep, recharge, freeze, paralysis, confusion, accuracy and evasion |
| How easy it is | The Lab page: pick a question, a team, the opponents and how they play, then press run. Every battle opens turn by turn with each decision's options and reasons. "Try from here" plays any decision on both ways. A build editor checks legality and sets your edit up as Build B. The same questions from `cli/lab.mjs` |
| How fast | A whole league (220 battles) in about 5 s in Chromium on three Web Workers; 33 s for all three leagues plus the D-072 check in Node (3–4 minutes before); 21 experiments, 12,580 battles, in about 4 minutes |
| The logic | `docs/HOW_IT_WORKS.md` is the whole engine in one place: every rule, every constant and where it lives, and what it doesn't do yet |

**The Lab page in Chromium** (`browser/test-lab.mjs`, 14 checks, all passing):

- It opens on the recorded run.
- "Run it here" plays the HeartGold league on 3 Web Workers and lands on the same fingerprint as Node, battle for
  battle.
- A battle opens turn by turn, with options and reasons; "try from here" plays 20 replays each way.
- Build A vs Build B runs.
- The build editor works out both spreads, checks an edit legal and sets it up as Build B.
- "How it works" renders.
- At phone width (390 px, an iPhone profile, light theme) nothing scrolls sideways: the report, a battle, the editor.
- No page errors on either profile.

**What the recorded experiments found** (`results/lab/README.md`; each is a hypothesis with its evidence, not a
verdict):

- **Light Ball Pikachu matters in 6v6 now.** SoulSilver with it wins 90% against 87% over 440 paired battles
  (p = 0.005). One-on-one it goes from beating 10 to 36 of the league's 62 Pokémon. Lance goes from 26 to 33 of 40.
- **The former SoulSilver six beats the current one.** Gyarados in Infernape's place: 94% against 88% (p = 0.004),
  and Lance's rematch goes from 7 to 16 of 30. It's also the leader in three of the four opponent styles in the
  matrix (no flip is significant yet).
- **The current builds beat two of the variations.** HeartGold beats the sheet Tyranitar (95% against 93%,
  p = 0.02; Bruno's rematch 23 → 16 of 40). Platinum's Lucario beats the January Empoleon (98% against 96%,
  p = 0.02; Cynthia 36 → 27 of 40).
- **Typhlosion's January build changes nothing measurable** over 440 paired battles.
- **SoulSilver's losses run through Lance's dragons.** Gyarados is in 71% of them and Dragonite in 50%, and
  SoulSilver wins 66% when its own Dragonite falls in the first two, against 97% otherwise.
- **Pikachu is the right lead for SoulSilver** among its six. For HeartGold, Tyranitar leading wins 131 of 132
  against 126, but that's not significant yet.
- **How the opponents play moves SoulSilver's results more than how you play.**
  - Opponents on the cartridge's 0 EVs: +8 points.
  - Opponents at their sharpest: −7 (p = 0.06).
  - Your trainer cautious or aggressive: +2 at most, not significant.
- **Game trainers as the cartridge plays them are a little easier than Blackthorn's reading:** HeartGold 97% against
  96%, SoulSilver 88% against 87%, Platinum 99% against 97%.
- **Your journey teams against each other:** HeartGold beats Platinum 0 of 20 and SoulSilver 4 of 20, at full EVs
  on both sides.

## Against the master plan's acceptance criteria (§7)

| Area | Standard | Status | Evidence |
|---|---|---|---|
| Mechanics | A regression suite covering critical Gen IV interactions passes | **Met** | 20 scripted mechanics cases; 48 damage cases against `@smogon/calc`; stats for every fixture build; 20 mechanics confirmed inside ordinary battles |
| Team legality | All test builds validated against their declared ruleset | **Met** | Three verdicts (structural, obtainable, format) on every fixture, every optimized team and every pool member. One deliberately illegal set per verdict. Jobs refuse illegal teams |
| Battle completion | 100-battle batches finish, failures reported | **Met** | Over 10,000 battles in the recorded and whole-system runs; 0 failures in the league runs. An injected failing agent is reported with its input log while the batch carries on |
| Reproducibility | Identical inputs, seeds, policies and engine version reproduce outcomes | **Met** | Same job twice gives identical battles; every battle replays from its input log; `Math.random` is never called; the trainer agent's choices replay exactly; Node and browser fingerprints match in 25 of 25 runs |
| AI decisions | Curated tactical scenarios show sensible choices | **Met** | 28 decision tests for the trainer agent and 9 for the cartridge AI (`TRAINER_AI.md`). Beats the max-power baseline 40–0 and the random one 39–1 in a mirror match |
| Trainer identity | Profiles create measurable, interpretable differences | **Met** | A switch-happy profile switches 12.8% of the time against 5.5%. A patient one sets up 2.5% against 0.2%. A competence of 30 wins 2 of 40 where 100 wins 22. Game trainers' settings come from the Trainer Library, each with its source |
| Statistical reports | Confidence and scenario sensitivity accompany win rates | **Met** | Wilson intervals; per-opponent results over whole leagues; paired comparisons with McNemar's exact test, a paired interval on the difference and on the HP margin; adaptive comparisons; the Strategy Report's "how far to trust it" level; `sensitivity` ranks what moves the result |
| Browser compatibility | Tested on desktop and mobile browsers | **Partly met** | Desktop Chromium, a phone-like profile (iPhone viewport and user agent, CPU slowed 4× and 6×), an Apps-Script-style frame; the Lab page on desktop and at phone width. **A real phone and real Safari are unverified** |
| Integration | Blackthorn's records stay intact and reversible | **Met** | Nothing integrated. The adapter only reads `library.json`. Outside `sixvsix/`, only docs changed |
| Cost | No paid service | **Met** | Runs in Node or the browser. `@pkmn/sim`, `@smogon/calc` and `esbuild` are MIT-licensed |

## The whole system against each league

Each team on its optimized spreads, against every member of its league on 85 EVs (D-072), all at Lv 100. Trainer
agents on both sides, each opponent's identity read from the Trainer Library. 40 battles per opponent, in mirrored
pairs. The full per-opponent tables are in `results/league/README.md`.

| Team | Won | 95% interval | Below 90% |
|---|---|---|---|
| HeartGold | 418 of 440 (95%) | 93–97% | Bruno's rematch 22/40 |
| SoulSilver | 385 of 440 (88%) | 84–90% | Lance's rematch 8/40; Lance 25/40; Red 35/40 |
| Platinum | 391 of 400 (98%) | 96–99% | — |

**The weak spots are the teams, not the simulator.** I read through those battles:

- **Bruno's rematch is six Fighting types.** Four of your HeartGold six take super-effective Fighting damage, Tyranitar
  four times over. The battles are what you'd expect: Close Combat and Low Kick through the middle of the team, Crobat
  and Typhlosion carrying the wins.
- **Lance's rematch beats SoulSilver with Dragon Dance Gyarados, Charizard and Salamence.** Their Waterfall, Air Slash
  and Dragon Claw find the team's weaknesses. Pikachu has no item on record, so no Light Ball. The Lab's `leads`
  experiment finds it's still SoulSilver's best lead, and the Light Ball variation wins measurably more.

## D-072: optimized spreads against 85 in every stat

The same six, the same league and the same seeds, played twice (`comparePool`, 20 battles per opponent per arm):

| Team | 85 each | Optimized | McNemar p | HP margin gained (95%) |
|---|---|---|---|---|
| HeartGold | 197 of 220 (90%) | 209 of 220 (95%) | 0.004 | +0.091 [0.052, 0.130] |
| SoulSilver | 163 of 220 (74%) | 193 of 220 (88%) | < 0.0001 | +0.161 [0.113, 0.208] |
| Platinum | 178 of 200 (89%) | 196 of 200 (98%) | 0.0001 | +0.092 [0.045, 0.139] |

The biggest gains are in the hardest matchups:

- HeartGold vs Bruno's rematch: 1 → 10 of 20;
- SoulSilver vs Lance: 3 → 14 of 20.

How the spreads were chosen and checked, with every spread listed, is in [EV_OPTIMIZER.md](EV_OPTIMIZER.md).

**The 6v6 check on the optimizer (D-074).** Each of the 18 spreads was played against the conventional 252 / 252
spread on the same nature, with the same seeds. A tie goes to the conventional spread:

- 16 play the conventional spread. Mamoswine's and Pikachu's conventional spreads won measurably more (p = 0.039 each);
- Crobat and Empoleon keep their duel spreads, measurably better on HP margin.

## The test suite (161 tests)

| File | Tests | What it proves |
|---|---|---|
| `mechanics.test.mjs` | 20 | See the mechanics list below |
| `damage.test.mjs` | 50 | 48 damage cases roll by roll against `@smogon/calc` 0.12.0; immunities on real turns; stats parity for every fixture build |
| `battle.test.mjs` | 9 | Completion, mechanics in natural battles, decisions matter, information, turn limit, trapping, knockout credit |
| `reproducibility.test.mjs` | 7 | Reruns, replays, no `Math.random`, independent trials, mirrored pairs, separate seeds, engine version check |
| `batch.test.mjs` | 4 | The seam's result shape, the Wilson interval, failure reporting, progress and stopping |
| `legality.test.mjs` | 5 | The three verdicts on fixtures and on sets built to fail each one |
| `contract.test.mjs` | 7 | Engine pin, contract checks (Opponent Pool included), rulesets against Showdown's real rule tables. Every fixture, pool, optimizer report and profile still matches the Trainer Library and the optimizer |
| `trainer.test.mjs` | 28 | The decision scenarios ([TRAINER_AI.md](TRAINER_AI.md)), the turn model's odds, and the library-to-settings mapping |
| `cartridge.test.mjs` | 9 | The cartridge AI: its flags' nudges, the switch checks, the replacement after a faint, dice against the one-on-one rule |
| `experiments.test.mjs` | 9 | The lab pack, interpretations, variations, leads; resuming a battle at any decision replays exactly; worker threads play exactly this thread's battles; every experiment runs and says what it found; coaching pairs its arms |
| `trainer-batch.test.mjs` | 3 | Beats both baselines; identity settings change behaviour measurably; lower competence wins less |
| `optimizer.test.mjs` | 6 | The stat formula matches the simulator. Every spread keeps the EV rules and the recorded nature, moves, item and ability. Self-lowering moves weaken on repeats. It finds a Speed benchmark. It never scores below its own starting templates or 85 even. The conventional spread follows the attacks |
| `compare.test.mjs` | 4 | McNemar's exact test. A pool run plays every opponent equally. Both arms get the same seeds. A team compared with itself shows no difference |

**Mechanics (scripted):**

- Turn flow:
  - switching happens before moves;
  - a fainted Pokémon must be replaced while the other side waits;
  - the last faint ends the battle.
- Status:
  - paralysis quarters Speed;
  - Ground is immune to Thunder Wave, while Electric types can still be paralysed (immunity came in Gen 6);
  - sleep lasts 1–4 turns, and every length occurs;
  - Toxic Orb damage is floor(max/16) × n.
- Weather:
  - Sand Stream's sandstorm never ends and does 1/16 to the unprotected;
  - Rain Dance lasts 5 turns, 8 with Damp Rock.
- Items:
  - Life Orb recoil 1/10, Leftovers 1/16, Sitrus Berry 1/4 at half HP, Lum Berry cures;
  - Choice Band locks the user in;
  - Focus Sash survives a knockout blow.
- Setup: Swords Dance is +2, Dragon Dance +1/+1, and boosts clear on switching.
- Hazards:
  - Stealth Rock by type (half to Charizard);
  - Spikes 1/8, 1/6, 1/4 by layers, nothing to Flying types or Levitate;
  - Toxic Spikes: one layer poisons, two badly poison, a grounded Poison type absorbs them;
  - Rapid Spin clears them.
- Other moves: U-turn's mid-turn switch; Struggle with 1/4 recoil.
- Trapping: Magnet Pull holds a Steel type, and the refused switch is reported as unavailable, never as invalid.
- Gen 4 data: the per-move physical/special split, Steel resisting Dark and Ghost, no Fairy type, Gen 5 moves absent.

## Finding: where the 6v6 engine and the one-on-one calculator differ

43 of 48 damage cases match `@smogon/calc` (the calculator Blackthorn's one-on-one engine runs) **roll for roll**,
across all 16 rolls. That includes the per-move physical/special split, STAB, burn, weather, crits (2× in Gen 4) and
screens, plus Explosion halving Defense, Light Ball, Soul Dew, Hidden Power from IVs, and Facade under burn. The
other five differ slightly, and each one is understood:

| Case | Worst roll | Cause |
|---|---|---|
| Fighting into Steel/Flying (neutral by cancellation) | 1 HP | The calculator applies each defending type's multiplier in turn with a floor, in the type chart's order, as the cartridge does. Showdown nets them to ×1 first |
| Ice into Water/Flying (the same) | 1 HP | The same |
| Expert Belt | 1 HP | The calculator does ×1.2 and floors; Showdown uses its 4096-based modifier |
| Dry Skin against Fire | 3 HP | Base power: the calculator gets floor(95 × 1.25) = 118, Showdown 119 |
| Gyro Ball | 2 HP | The calculator's Gen 4 code has no +1; Showdown uses the Gen 5+ formula (the calculator's own Gen 5+ code has the +1) |

**What it means.** The gaps are at most a point or two of base power, or a single floor step, under 1% of a hit.
That's irrelevant to who wins most battles, but enough to flip an exact knockout threshold. So exact thresholds stay
with the one-on-one engine (D-069). The EV optimizer and the trainer agent both use the calculator, so they agree
with the one-on-one engine, and the battles are played by Showdown. The test pins these five: if Showdown changes,
the test says so.

## Finding: legality of the fixture teams

| Team | Structural | Obtainable on a Gen 4 cartridge | Gen 4 OU |
|---|---|---|---|
| Your HeartGold, SoulSilver and Platinum sixes (optimized, duel, 85 even; HeartGold also at Lv 62) | ✓ | ✓ | not required (Blackthorn mode). HeartGold's still fails only on Mamoswine's Snow Cloak |
| Every league opponent (21 teams) and Platinum Cynthia | ✓ | ✓ | not required |
| Gen 4 OU sample (authored for the tests) | ✓ | ✓ | ✓ |

## The recorded jobs (`results/`)

Each folder has the whole result (`result.json`), a summary, the first battle as readable text and its decision
trace. The trainer's decision trace keeps its reasons: every option with its value and a one-line why.

| Job | Result (A's wins, 95% interval) | Turns | Node time |
|---|---|---|---|
| Your HeartGold six vs Platinum Cynthia, both Lv 100, trainer agents | 97–3 (92–99%) | 27.8 | 11.7 s |
| The same at Cynthia's levels (yours at 62) | 99–1 (95–100%) | 23.9 | 10.1 s |
| The same matchup, both sides on the max-power baseline (the control) | 100–0 (96–100%) | 13.7 | 2.1 s |
| Gen 4 OU sample mirror: trainer agent vs max-power | 100–0 (96–100%) | 17.2 | 6.5 s |

**How to read these:**

- **The trainers make battles longer and closer.** With trainers on both sides, Cynthia takes 3 of 100. On the
  baseline she takes none, and battles last half as long. Her switching, setup and status are worth something, but
  not enough against a fully invested six when she's on 85 EVs.
- **The OU mirror is the cleanest test of the agent.** Identical teams, and only the policy differs: 100–0.

## Performance

| Where | Build | 100 battles, trainer agents (ms per battle) | 100 battles, max-power (ms per battle) |
|---|---|---|---|
| Node 22 (this container), one thread | — | 6.9–7.1 s (68–71) | 1.8 s (17) |
| Chromium desktop, Web Worker | full / battle-only | 4.4–4.8 s (42–44) | 1.3–1.4 s (10–11) |
| Chromium desktop, main thread | full / battle-only | 4.2–4.5 s (40–43) | 1.4 s (12) |
| Phone-like, CPU 4× slower, main thread | battle-only | 20.6 s (202) | 4.8 s (44) |
| Phone-like, CPU 6× slower, main thread | battle-only | 30.9 s (303) | 8.4 s (78) |
| Apps-Script-style frame, worker and main thread | both | 4.5–4.7 s (42–44) | — |

*This round's run, after the trainer agent's caches. The previous round's figures were about twice these: 75–91 ms a
battle in Chromium, 417 ms on the 4× phone profile.*

- **The trainer agent is still most of the cost.** It prices every option with the damage calculator, about 4× the
  baseline's time per battle. One team's whole league (400–440 battles) takes 6–10 s on three worker threads.
- **Page start:** 0.60 s for the full build and 0.25 s for the battle-only build on desktop; 0.79–1.2 s throttled.
- **Sizes:** full build 6.90 MB, battle-only 2.62 MB, bench page 2.70 MB. The Lab page is 8.5 MB: the full build
  (legality and learnsets, for the editor), the 1.3 MB lab pack and three recorded runs.
- **Run to run:** timings move by 10–20% between runs on the same machine; `results/browser/perf.json` has this
  run's numbers.
- **Since the caches and the worker pool** (this round), a battle with trainer agents on both sides takes about
  55 ms in one Node thread. The Lab and the CLI spread battles over every core: 220 battles in about 5 s in Chromium
  on three Web Workers, and the three leagues plus the D-072 check in 33 s in Node (3–4 minutes before).
- **What the phone-like rows are.** Chromium's CPU throttle slows the page's own thread; a Web Worker runs
  unthrottled. So the phone-like *worker* times in `perf.json` say nothing about a phone, and the main-thread rows are
  the proxy. A recent iPhone's single core is at least as fast as this container's, so these rows are probably
  pessimistic. **A real phone is unverified.** If a phone does land near the 4× row, 100 trainer battles take about
  40 s, which is fine for a check but slow for a whole league. Those belong in a Web Worker (which the page uses
  when it can) or in Node.

## Not yet verified

1. **A real iPhone and Safari.** The bench page is built for it, in two forms:
   - **On claude.ai (no setup):** the bench is published privately at
     <https://claude.ai/artifact/P99Ya1tigXw3YnRedKvQNM>, now with these presets. Open it on the phone and the work
     laptop and run 100 battles. Each run is saved to the page's own store (collection `runs`), so the devices sit
     side by side and a later session can read them.
   - **In Apps Script:** `appscript/INSTALL.txt` sets up a throwaway Apps Script project.
2. **A real Apps Script deployment.** The frame test copies Apps Script's structure (sandboxed, cross-origin, the page
   written into an inner frame), but not Google's actual limits. Two unknowns: the largest page `createHtmlOutput`
   accepts (the bench page is 2.76 MB), and whether the real sandbox allows Blob Web Workers. The page falls back to
   the main thread on its own if it doesn't.
3. **Cartridge fidelity beyond Showdown.** The mechanics tests pin Showdown's Gen 4 behaviour against Gen 4 facts. The
   damage tests compare it with an independent implementation. Neither is a fresh audit against the games'
   disassembly.
4. **The cartridge AI against a real cartridge.** It's a port of the one-on-one engine's, which cites the pret
   disassemblies line by line, and the tests pin its rules. Nobody has yet compared its choices with a real
   cartridge's in the same positions.
5. **The Lab inside claude.ai on a phone.** It's tested in Chromium at phone width, with Web Workers and the fallback
   to the page itself. The viewer on a real phone, with its memory and an 8.5 MB page, is unverified.

## Limitations (by design or for now)

- **The trainer agent:**
  - doesn't predict switches or double-switch;
  - doesn't plan beyond one turn, except for the value of setting up;
  - gives odd status moves (Trick, Encore, Taunt, Baton Pass, weather moves) no plan.

  `TRAINER_AI.md` has the full list.
- **The lead is your call.** The trainer agent doesn't choose a lead. The `leads` experiment measures each choice, and
  a team can name its lead.
- **The EV optimizer is a duel model.** Setup, status, recovery, hazards and teammates are covered only by the 6v6
  check, at 20 battles per opponent per arm. That's enough to catch a clearly worse spread, not a point or two.
- **Trainer bag items** (Full Restores and the rest) can't be used by either agent: Showdown has no item action.
- **Shift battle style** isn't modelled; Showdown plays Set style.
- **One Gen 4.** Showdown plays one Gen 4; any DPPt-vs-HGSS difference it doesn't separate, we don't either.
- **Contribution stats are approximate.** Damage taken can pass 100% when a Pokémon healed and was hit again. Damage
  dealt counts only damage that can be credited.
- **Gender** not on record is drawn from the battle seed and listed under `varied`.

## Bugs the tests and runs caught in my code (fixed)

**Phases 0–1:**

- **`PolicyRNG` collapsed any non-hex seed to the same stream.** Jobs were unaffected (they always pass hex digests),
  but test agents seeded with words shared one sequence. Any string is now hashed first.
- **Test expectations the engine corrected:**
  - Azelf has Levitate;
  - Snorlax's first ability (Immunity) blocks poison;
  - Ice Beam is 95 BP in Gen 4;
  - Metagross is Steel/Psychic, so Crunch is neutral;
  - Rough Skin isn't Garchomp's until Gen 5;
  - a 0-EV Life Orb Garchomp does one-shot Blissey;
  - Gyarados's Intimidate fires at battle start and changed the Light Ball damage case.

**Phases 2–3:**

- **HGSS stores trainer AI flags as a bitmask,** which the contract wants as names. Profiles now carry the names and
  the raw value.
- **Hidden Power needs IVs.** Platinum's Magnezone had Hidden Power Fire with no IVs on record, so it played as
  Hidden Power Dark. I ported Blackthorn's IV solver (`trainers/solver.py`). Any build with a typed Hidden Power and
  no IVs on record now gets IVs that make that type.
- **The optimizer's first answer was wrong.** It built a Bold, Overheat-reliant Infernape, which led to three fixes:
  - Overheat-style moves now weaken on repeats;
  - natures that lower an attacking stat are never chosen;
  - spreads are scored on three entries, not only fresh one-on-ones.
- **The calculator recomputes stats from EVs,** so stat overrides were silently ignored. The optimizer now finds an
  (EVs, nature) pair that gives each stat value.
- **The trainer agent:**
  - counted Focus Punch as a sure knockout;
  - valued Stealth Rock at one switch-in per foe instead of about one and a half;
  - had no reason to Swords Dance in front of a passive foe.

  The decision scenarios found all three.
- **A comparison's one-line reading swapped its percentages** when the first arm won. Gengar's 6v6 check read "83%
  against 87%" for 87% against 83%. The numbers underneath were right. Found while writing this report; the sentence
  is fixed and the stored readings were re-rendered.

**This round (the Lab):**

- **D-074's natures were first read the wrong way.** The conventional arm brought the nature that suited it best, so
  Typhlosion became Quiet (−Speed) on 252 Speed. Your answer was to keep the optimizer's natures, so the conventional
  spread now plays on the member's own nature. The whole check was rerun.
- **The worker pool added a listener per run** (Node's MaxListeners warning). Now there's one per worker.
- **The report counted Lance's three Dragonite as three threats** in the same battle ("131% of losses"). Threats are
  now grouped by species, once per battle.
- **The report matched members by name prefix,** which could mix up two of a species. It now uses battle names.
- **The matrix claimed a flip on a tie.** A flip now needs a significant gap (paired McNemar).
- **Coaching showed "move 1"** instead of the move's name.
- **The Lab page:**
  - a CSS class shared by the 50% tick and the gold bar colour shifted every gold bar sideways;
  - the report column and the EV inputs overflowed at phone width;
  - re-rendering the editor from a change event threw a DOM error;
  - removing a team's `lead` broke the contract (the lead is required).

  The browser checks caught all four.
- **Data, not code:** Volkner's Electivire has IVs of 303 in the Trainer Library (an IV scale conversion). The adapter
  clamps it to 31 and says so on the build; the library itself is read-only here.

