# Test report: Phases 0 and 1

*2026-10-25 · `@pkmn/sim` 0.10.11 · contract 0.1.0 · Node v22.22.0 on a 4-core Intel Xeon 2.10 GHz (the cloud
container) · Chromium via Playwright. Everything below was run, not inferred, unless it says **unverified**.*

## The short version

- **Executed:** 101 automated tests (all pass); 4 recorded 100-battle jobs (400 battles, 0 failures, 0 invalid
  decisions); 25 browser runs of 100 battles each (desktop, a slowed phone-like profile, and an Apps-Script-style
  frame). All 25 played exactly the battles Node played.
- **Failed:** nothing in the final run. On the way, the tests caught one real bug in my code (below) and a dozen
  mistakes in my own test expectations, each settled by the engine being right about Gen 4.
- **Found:** Showdown and the calculator Blackthorn's one-on-one engine uses disagree by 1–3 HP in 5 of 48 damage
  cases. In each, the calculator follows the cartridge's integer arithmetic and Showdown uses its modern rounding.
- **Unverified:** a real iPhone, a real Apps Script deployment, and anything about trainer intelligence (Phase 3).

Rerun everything:

```
cd sixvsix && npm ci
npm test                          # 101 tests, about 9 s
node cli/run.mjs all              # the four recorded jobs → results/
npm run build && npm run test:browser   # bundles, bench pages, 25 browser runs → results/browser/perf.json
```

## Against the master plan's acceptance criteria (§7)

| Area | Standard | Status | Evidence |
|---|---|---|---|
| Mechanics | A regression suite covering critical Gen IV interactions passes | **Met** | 20 scripted mechanics cases; 48 damage cases against `@smogon/calc`; stats for every fixture build; 20 mechanics confirmed inside ordinary battles |
| Team legality | All test builds validated against their declared ruleset | **Met** | Three verdicts (structural, obtainable, format) on every fixture; one deliberately illegal set per verdict; jobs refuse illegal teams |
| Battle completion | 100-battle batches finish, failures reported | **Met** | 400 recorded + 144 test battles, 0 errors; an injected failing agent is reported with its input log while the batch carries on |
| Reproducibility | Identical inputs, seeds, policies and engine version reproduce outcomes | **Met** | Same job twice gives identical battles; every battle replays from its input log; `Math.random` is never called; Node and browser fingerprints match in 25 of 25 runs |
| AI decisions | Curated tactical scenarios show sensible choices | **Not started (Phase 3)** | Phase 1 agents are baselines by design. The plumbing exists: partial-information views, legal options, scored decision traces |
| Trainer identity | Profiles create measurable, interpretable differences | **Not started (Phase 3)** | Profiles carry the library's AI reading as data |
| Statistical reports | Confidence and scenario sensitivity accompany win rates | **Partly met** | Wilson interval, side split and pair agreement on every result. Sensitivity across opponents and policies is Phase 2 |
| Browser compatibility | Tested on desktop and mobile browsers | **Partly met** | Desktop Chromium, a phone-like profile (iPhone viewport and user agent, CPU slowed 4× and 6×), an Apps-Script-style frame. **A real phone and real Safari are unverified** |
| Integration | Blackthorn's records stay intact and reversible | **Met** | Nothing integrated. The adapter only reads `library.json`; outside `sixvsix/` only docs changed |
| Cost | No paid service | **Met** | Runs in Node or the browser. `@pkmn/sim`, `@smogon/calc` and `esbuild` are MIT-licensed |

## The test suite (101 tests)

| File | Tests | What it proves |
|---|---|---|
| `mechanics.test.mjs` | 20 | See the mechanics list below |
| `damage.test.mjs` | 50 | 48 damage cases roll by roll against `@smogon/calc` 0.12.0; immunities on real turns; stats parity for all 30 fixture builds |
| `battle.test.mjs` | 9 | Completion, mechanics in natural battles, decisions matter, information, turn limit, trapping, knockout credit |
| `reproducibility.test.mjs` | 7 | Reruns, replays, no `Math.random`, independent trials, mirrored pairs, separate seeds, engine version check |
| `batch.test.mjs` | 4 | The seam's result shape, the Wilson interval, failure reporting, progress and stopping |
| `legality.test.mjs` | 5 | The three verdicts on fixtures and on sets built to fail each one |
| `contract.test.mjs` | 6 | Engine pin, contract checks, rulesets against Showdown's real rule tables, fixtures still match the Trainer Library |

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

**Inside 144 ordinary battles** (4 matchups × 3 agent pairings × 12), each of these happened at least once:

- Switches: a voluntary switch, a forced replacement, U-turn.
- Status: paralysis or poison, sleep from Rest.
- Weather: Sand Stream and sandstorm damage.
- Items: Leftovers, Life Orb, Black Sludge, a berry eaten.
- Setup and hazards: Dragon Dance boosts, Stealth Rock damage, Spikes damage, Intimidate.
- Hits: a critical hit, a miss, a super-effective hit, an immunity.

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

**What it means.** The gaps are at most a point or two of base power, or a single floor step, which is under 1% of a
hit. That's irrelevant to who wins most battles, but enough to flip an exact knockout threshold. So exact EV thresholds
and knockout benchmarks should stay with the one-on-one engine, which is already the measuring stick (D-069). The
6v6 engine answers team-level questions. The test pins these five: if Showdown changes, the test says so. They could
be reported upstream to Showdown with these cases; that's your call.

## Finding: legality of the fixture teams

| Team | Structural | Obtainable on a Gen 4 cartridge | Gen 4 OU |
|---|---|---|---|
| Zack's HeartGold six (standardized and Lv 62) | ✓ | ✓ (the HGSS tutors, Lapras's Heal Bell and Tyranitar's Dragon Dance + Outrage all check out) | ✗ Mamoswine's Snow Cloak only (Evasion Abilities Clause; Oblivious would pass) |
| Platinum Cynthia (as encountered and Lv 100) | ✓ | ✓ (a player could own every set) | ✗ Garchomp is Uber; Sand Veil; no EVs |
| Gen 4 OU sample (authored for the tests) | ✓ | ✓ | ✓ |

## The recorded jobs (`results/`)

Each folder has the whole result (`result.json`), a summary, the first battle as readable text and its decision trace.

| Job | Result (A's wins, 95% interval) | Turns | Node time |
|---|---|---|---|
| Zack's HeartGold six vs Platinum Cynthia, both Lv 100, max-power baseline | 100–0 (96–100%) | 12.6 | 1.8 s |
| The same at Cynthia's levels (yours at 62) | 100–0 (96–100%) | 12.3 | 1.4 s |
| The same with both sides choosing at random | 77–23 (68–84%) | 47.5 | 5.0 s |
| Gen 4 OU sample mirror: max-power vs random | 97–3 (92–99%) | 26.0 | 3.6 s |

**How to read these, honestly:**

- **Not a strength rating.** Both sides play a baseline that never switches by choice; Cynthia's four Full Restores
  aren't used; her game AI isn't modelled; your six carry Blackthorn's 85-EV fill against her zero EVs. These are
  the pipeline working, not a verdict on the matchup.
- **Policy is a big lever.** The same two teams go from 100% to 77% when both sides play randomly. This is why the plan
  wants trainer intelligence measured before results are trusted.
- **100 battles is a starting point.** The random control read 77% (68–84%) at 100 battles. 800 more put it at
  82–86%: inside the first interval, but at its edge. Its 100-battle side split (45 of 50 as P1, 32 of 50 as P2)
  looked like a side advantage. Four 400-battle mirror matches showed P1 winning 48–54%, so the split was noise. The
  report flags small samples; for close comparisons, run more.

## Performance

| Where | Build | 100 battles, max-power (ms per battle) | 100 battles, random (ms per battle) |
|---|---|---|---|
| Node 22 (this container) | — | 1.4–1.8 s (14–18) | 5.0 s (50) |
| Chromium desktop, Web Worker | full / battle-only | 1.2–1.4 s (10–12) | 3.4 s (31–33) |
| Chromium desktop, main thread | full / battle-only | 1.0–1.5 s (8–12) | 3.1 s (29) |
| Phone-like, CPU 4× slower, main thread | battle-only | 6.1 s (58) | 14.9 s (145) |
| Phone-like, CPU 6× slower, main thread | battle-only | 8.7 s (82) | 21.8 s (213) |
| Apps-Script-style frame, worker and main thread | both | 1.2–1.5 s (10–13) | — |

- **Page start:** 0.42 s for the full build and 0.17 s for the battle-only build on desktop; 0.55–0.82 s throttled.
- **Run to run:** timings move by 10–20% between runs on the same machine; `results/browser/perf.json` has this run's numbers.
- **Sizes:** full build 6.31 MB, battle-only 2.03 MB, bench page 2.11 MB.
- **What the phone-like rows are.** Chromium's CPU throttle slows the page's own thread; a Web Worker runs
  unthrottled. So the phone-like *worker* times in `perf.json` say nothing about a phone, and the main-thread rows are
  the proxy. A recent iPhone's single core is at least as fast as this container's, so these rows are probably
  pessimistic. **A real phone is unverified.**

## Not yet verified

1. **A real iPhone and Safari.** The bench page is built for it, in two forms:
   - **On claude.ai (no setup):** the bench is published privately at
     <https://claude.ai/artifact/P99Ya1tigXw3YnRedKvQNM>. Open it on the phone and the work laptop and run 100
     battles. Each run is saved to the page's own store (collection `runs`), so the devices sit side by side and a
     later session can read them with `ArtifactData`.
   - **In Apps Script:** `appscript/INSTALL.txt` sets up a throwaway Apps Script project. "Copy results" gives the
     numbers back.
2. **A real Apps Script deployment.** The frame test copies Apps Script's structure (sandboxed, cross-origin, the page
   written into an inner frame), but not Google's actual limits. Unknowns: the largest page `createHtmlOutput` accepts
   (the bench page is 2.11 MB), and whether the real sandbox allows Blob Web Workers. The page falls back to the main
   thread on its own if it doesn't.
3. **Cartridge fidelity beyond Showdown.** The mechanics tests pin Showdown's Gen 4 behaviour against Gen 4 facts. The
   damage tests compare it with an independent implementation. Neither is a fresh audit against the games'
   disassembly.

## Limitations (Phase 1, by design or for now)

- **Agents are baselines.** `random` and `maxpower` (base power × STAB × type × accuracy against the foe's public
  types) are not trainers. `maxpower` doesn't know abilities until they show (it still rates Earthquake into Gengar),
  never switches by choice, and would use Explosion if it scored highest.
- **Trainer bag items** (Full Restores and the rest) can't be used: Showdown has no item action.
- **Shift battle style** isn't modelled; Showdown plays Set style.
- **One Gen 4.** Showdown plays one Gen 4; any DPPt-vs-HGSS difference it doesn't separate, we don't either.
- **The lead is always the first member.** Lead strategy is Phase 2/3.
- **Contribution stats are approximate.** Damage taken can pass 100% when a Pokémon healed and was hit again. Damage
  dealt counts only damage that can be credited.
- **Gender** not on record is drawn from the battle seed and listed under `varied`.

## Bugs the tests caught in my code (fixed)

- **`PolicyRNG` collapsed any non-hex seed to the same stream.** Jobs were unaffected (they always pass hex digests),
  but test agents seeded with words shared one sequence. Found by the reproducibility test; any string is now hashed
  first.
- **Test expectations the engine corrected:**
  - Azelf has Levitate;
  - Snorlax's first ability (Immunity) blocks poison;
  - Ice Beam is 95 BP in Gen 4;
  - Metagross is Steel/Psychic, so Crunch is neutral;
  - Rough Skin isn't Garchomp's until Gen 5;
  - a 0-EV Life Orb Garchomp does one-shot Blissey;
  - Gyarados's Intimidate fires at battle start and changed the Light Ball damage case.
