# Test report: Phases 0–3

*2026-10-25 · `@pkmn/sim` 0.10.11 · `@smogon/calc` 0.12.0 · contract 0.1.0 · Node v22.22.0 on a 4-core Intel Xeon
2.10 GHz (the cloud container) · Chromium via Playwright. Everything below was run, not inferred, unless it says
**unverified**.*

## The short version

- **Executed:**
  - 132 automated tests, all passing.
  - The whole system end to end: each of your three Gen 4 teams against every member of its league, with trainer
    agents on both sides. That's 1,280 league battles, 1,280 more for the D-072 check, and 7,680 for the 6v6
    check on all 18 optimized spreads.
  - 4 recorded 100-battle jobs.
  - 25 browser runs of 100 battles each. All 25 played exactly the battles Node played.
- **Failed:** nothing in the final run. On the way, the tests and the runs caught real bugs in my code (listed at
  the end), each fixed and covered by a test or a recorded run.
- **Found:**
  - **D-072 works.** Your optimized spreads win more than the same six on 85 in every stat, in all three games:
    - HeartGold: 90% → 95%;
    - SoulSilver: 77% → 85%;
    - Platinum: 89% → 99%.

    Each is significant (McNemar p ≤ 0.0002), and the HP margin rises by 11–14 points.
  - **The league is mostly won, with two real weak spots:** HeartGold against Bruno's rematch (14 of 40) and
    SoulSilver against Lance and his rematch (29 and 5 of 40). Both come from the teams' types, not from a bug
    (below).
  - **Showdown and the one-on-one engine's calculator differ by 1–3 HP** in 5 of 48 damage cases. In each, the
    calculator follows the cartridge's integer arithmetic and Showdown uses its modern rounding.
- **Unverified:**
  - a real iPhone;
  - a real Apps Script deployment;
  - how close the trainer agent plays to the cartridge's own AI (it isn't modelled; the AI flags shape the agent's
    settings instead).

Rerun everything:

```
cd sixvsix && npm ci
npm test                          # 132 tests, about 45 s
node cli/run.mjs all              # the four recorded jobs → results/ (about 30 s)
node cli/league.mjs               # each team against its league + the D-072 check → results/league/ (about 4 min)
node cli/confirm-spreads.mjs      # the 6v6 check on every optimized spread (about 10 min)
npm run build && npm run test:browser   # bundles, bench pages, 25 browser runs → results/browser/perf.json
```

## Against the master plan's acceptance criteria (§7)

| Area | Standard | Status | Evidence |
|---|---|---|---|
| Mechanics | A regression suite covering critical Gen IV interactions passes | **Met** | 20 scripted mechanics cases; 48 damage cases against `@smogon/calc`; stats for every fixture build; 20 mechanics confirmed inside ordinary battles |
| Team legality | All test builds validated against their declared ruleset | **Met** | Three verdicts (structural, obtainable, format) on every fixture, every optimized team and every pool member. One deliberately illegal set per verdict. Jobs refuse illegal teams |
| Battle completion | 100-battle batches finish, failures reported | **Met** | Over 10,000 battles in the recorded and whole-system runs; 0 failures in the league runs. An injected failing agent is reported with its input log while the batch carries on |
| Reproducibility | Identical inputs, seeds, policies and engine version reproduce outcomes | **Met** | Same job twice gives identical battles; every battle replays from its input log; `Math.random` is never called; the trainer agent's choices replay exactly; Node and browser fingerprints match in 25 of 25 runs |
| AI decisions | Curated tactical scenarios show sensible choices | **Met** | 17 decision scenarios (`TRAINER_AI.md`). Beats the max-power baseline 40–0 and the random one 39–1 in a mirror match |
| Trainer identity | Profiles create measurable, interpretable differences | **Met** | A switch-happy profile switches 12.8% of the time against 5.5%. A patient one sets up 2.5% against 0.2%. A competence of 30 wins 2 of 40 where 100 wins 22. Game trainers' settings come from the Trainer Library, each with its source |
| Statistical reports | Confidence and scenario sensitivity accompany win rates | **Met** | Wilson intervals; per-opponent results over whole leagues; paired comparisons with McNemar's exact test, a paired interval on the difference and on the HP margin |
| Browser compatibility | Tested on desktop and mobile browsers | **Partly met** | Desktop Chromium, a phone-like profile (iPhone viewport and user agent, CPU slowed 4× and 6×), an Apps-Script-style frame. **A real phone and real Safari are unverified** |
| Integration | Blackthorn's records stay intact and reversible | **Met** | Nothing integrated. The adapter only reads `library.json`. Outside `sixvsix/`, only docs changed |
| Cost | No paid service | **Met** | Runs in Node or the browser. `@pkmn/sim`, `@smogon/calc` and `esbuild` are MIT-licensed |

## The whole system against each league

Each team on its optimized spreads, against every member of its league on 85 EVs (D-072), all at Lv 100. Trainer
agents on both sides, each opponent's identity read from the Trainer Library. 40 battles per opponent, in mirrored
pairs. The full per-opponent tables are in `results/league/README.md`.

| Team | Won | 95% interval | Below 90% |
|---|---|---|---|
| HeartGold | 414 of 440 (94%) | 92–96% | Bruno's rematch 14/40 |
| SoulSilver | 388 of 440 (88%) | 85–91% | Lance's rematch 5/40; Lance 29/40 |
| Platinum | 391 of 400 (98%) | 96–99% | — |

**The weak spots are the teams, not the simulator.** I read through those battles:

- **Bruno's rematch is six Fighting types.** Four of your HeartGold six take super-effective Fighting damage, Tyranitar
  four times over. The battles are what you'd expect: Close Combat and Low Kick through the middle of the team, Crobat
  and Typhlosion carrying the wins.
- **Lance's rematch beats SoulSilver with Dragon Dance Gyarados, Charizard and Salamence.** Their Waterfall, Air Slash
  and Dragon Claw find the team's weaknesses. SoulSilver's lead, Pikachu, leads every battle (the lead is always the
  first slot). It has no item on record, so no Light Ball, and averages 0.17 knockouts a battle.

## D-072: optimized spreads against 85 in every stat

The same six, the same league and the same seeds, played twice (`comparePool`, 20 battles per opponent per arm):

| Team | 85 each | Optimized | McNemar p | HP margin gained (95%) |
|---|---|---|---|---|
| HeartGold | 197 of 220 (90%) | 210 of 220 (95%) | 0.0002 | +0.108 [0.076, 0.141] |
| SoulSilver | 169 of 220 (77%) | 188 of 220 (85%) | 0.0002 | +0.142 [0.104, 0.180] |
| Platinum | 177 of 200 (89%) | 197 of 200 (99%) | < 0.0001 | +0.112 [0.069, 0.155] |

The biggest gains are in the hardest matchups:

- HeartGold vs Bruno's rematch: 1 → 10 of 20;
- SoulSilver vs Lance: 1 → 9 of 20.

How the spreads were chosen and checked, with every spread listed, is in [EV_OPTIMIZER.md](EV_OPTIMIZER.md).

**The 6v6 check on the optimizer.** Each of the 18 spreads was played against the conventional 252 / 252 spread with
the same seeds. All 18 stayed:

- three were measurably better on HP margin (Lapras, Gengar, Weavile);
- Gengar also won more, 87% against 83% (p = 0.041);
- none was measurably worse.

## The test suite (132 tests)

| File | Tests | What it proves |
|---|---|---|
| `mechanics.test.mjs` | 20 | See the mechanics list below |
| `damage.test.mjs` | 50 | 48 damage cases roll by roll against `@smogon/calc` 0.12.0; immunities on real turns; stats parity for every fixture build |
| `battle.test.mjs` | 9 | Completion, mechanics in natural battles, decisions matter, information, turn limit, trapping, knockout credit |
| `reproducibility.test.mjs` | 7 | Reruns, replays, no `Math.random`, independent trials, mirrored pairs, separate seeds, engine version check |
| `batch.test.mjs` | 4 | The seam's result shape, the Wilson interval, failure reporting, progress and stopping |
| `legality.test.mjs` | 5 | The three verdicts on fixtures and on sets built to fail each one |
| `contract.test.mjs` | 7 | Engine pin, contract checks (Opponent Pool included), rulesets against Showdown's real rule tables. Every fixture, pool, optimizer report and profile still matches the Trainer Library and the optimizer |
| `trainer.test.mjs` | 17 | The decision scenarios ([TRAINER_AI.md](TRAINER_AI.md)) and the library-to-settings mapping |
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
| Node 22 (this container) | — | 10–12 s (101–116) | 2.1 s (21) |
| Chromium desktop, Web Worker | full / battle-only | 7.9–9.4 s (75–91) | 1.5–1.8 s (13–14) |
| Chromium desktop, main thread | full / battle-only | 7.3–9.0 s (71–88) | 1.6 s (14) |
| Phone-like, CPU 4× slower, main thread | battle-only | 42.2 s (417) | 5.6 s (52) |
| Phone-like, CPU 6× slower, main thread | battle-only | 64.8 s (641) | 9.3 s (88) |
| Apps-Script-style frame, worker and main thread | both | 8.3–9.9 s (80–94) | — |

- **The trainer agent is the cost.** It prices every option with the damage calculator, about 6–8× the baseline's
  time per battle. One team's whole league (400–440 battles) takes 27–39 s in Node.
- **Page start:** 0.60 s for the full build and 0.25 s for the battle-only build on desktop; 0.79–1.2 s throttled.
- **Sizes:** full build 6.83 MB, battle-only 2.56 MB, bench page 2.76 MB. The damage calculator added about 0.5 MB.
- **Run to run:** timings move by 10–20% between runs on the same machine; `results/browser/perf.json` has this
  run's numbers.
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
4. **The cartridge's own trainer AI.** Game trainers play the trainer agent with settings read from their AI flags,
   not the cartridge's move-scoring routine. How close that is to the games is unmeasured.

## Limitations (by design or for now)

- **The trainer agent:**
  - doesn't predict switches or double-switch;
  - doesn't plan beyond one turn, except for the value of setting up;
  - gives odd status moves (Trick, Encore, Taunt, Baton Pass, weather moves) no plan.

  `TRAINER_AI.md` has the full list.
- **The lead is always the first member.** Lead choice isn't modelled yet. It matters for SoulSilver, whose first
  slot is Pikachu.
- **The EV optimizer is a duel model.** Setup, status, recovery, hazards and teammates are covered only by the 6v6
  check, at 20 battles per opponent per arm. That's enough to catch a clearly worse spread, not a point or two.
- **Trainer bag items** (Full Restores and the rest) can't be used: Showdown has no item action.
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
