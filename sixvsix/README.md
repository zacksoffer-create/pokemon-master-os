# sixvsix: the Blackthorn 6v6 simulator and Lab

Showdown's Gen IV battle engine (`@pkmn/sim` 0.10.11) behind a shared simulation contract. It's built to show how
trainers, builds, leads and styles change what a team does, and how far the battles let you trust each answer. It has:

- **two ways to play a trainer:** an explainable trainer agent (Blackthorn's reading, each trainer's identity read
  from the Trainer Library) and the cartridge's own AI (as the game plays them);
- **an EV optimizer** for your teams (D-072: yours fully optimized, every opponent on 85; D-074: the conventional
  spread unless the battles prove the duel spread better, natures kept);
- **the Lab:** experiments that answer questions (a gauntlet, Build A vs B, builds × trainer styles, the best lead,
  your trainer's style, what moves the needle), a Strategy Report, every battle replayable with each decision's
  reasons, and "try from here";
- **runs that stay reproducible:** a seeded batch runner, parallel in Node and in the browser, that plays the same
  battles everywhere.

It is the 6v6 engine from D-069, built separately. It reads the Trainer Library and plugs into nothing yet
(`docs/design/SIXVSIX_SEAM.md` is where it will).

**The 6v6 Lab, on any device:** <https://claude.ai/artifact/Rhhb2uUa6dgTC1sm182RoX> (private). The whole engine runs in
the page. It opens on a recorded run, plays the same battles on your device, and keeps every run you finish.

**Read first:**

- [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md): the whole engine, end to end, with every number you might want to
  change.
- [results/lab/README.md](results/lab/README.md): the recorded experiments and what they found.
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md): what ran, passed, failed, and is unverified, plus the league results.
- [docs/EV_OPTIMIZER.md](docs/EV_OPTIMIZER.md): every optimized spread, how it was chosen and checked, and what D-072
  does in battle.
- [docs/TRAINER_AI.md](docs/TRAINER_AI.md): how the trainer agent and the cartridge AI decide.
- [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md): the contract objects.
- [docs/PHASE0_AUDIT.md](docs/PHASE0_AUDIT.md): engine choice, findings, and the calls I made.

## Install and run

Node 20 or later.

```
cd sixvsix
npm ci
npm test                                   # 161 tests, about 45 s
node cli/lab.mjs list                      # the Lab from the command line: your teams, the pools, the readings
node cli/lab.mjs league me/heartgold heartgold-league --opponents game   # any Lab question, on every core
node cli/lab.mjs battle me/heartgold heartgold-league heartgold/bruno-rematch 1   # one battle, every decision's reasons
node cli/lab-record.mjs                    # the recorded experiments → results/lab/ (about 6 minutes)
node cli/battle.mjs heartgold-vs-cynthia 0 # one battle in full: log, decisions with reasons, knockouts, replay check
node cli/run.mjs heartgold-vs-cynthia      # a 100-battle job → results/heartgold-vs-cynthia/
node cli/run.mjs all                       # every preset (cli/presets.mjs)
node cli/league.mjs                        # each of your teams against its whole league, plus the D-072 check
node cli/make-fixtures.mjs                 # rebuild fixtures/ from the Trainer Library (read-only), EV optimizer included
node cli/confirm-spreads.mjs               # the 6v6 check on every optimized spread (about 10 min)
npm run build                              # dist/: bundles, the bench and Lab pages, the Apps Script test package
npm run test:browser                       # 25 browser runs in Chromium → results/browser/perf.json
node browser/test-lab.mjs                  # the Lab page in Chromium: same battles as Node, every view, phone width
```

A job can also be a JSON file in the contract's shape: `node cli/run.mjs my-job.json`.

**On a phone, with no setup:** the bench page is published privately at
<https://claude.ai/artifact/P99Ya1tigXw3YnRedKvQNM>. Every run is saved there, from any device, and checked against
Node's battles.

## What's where

| Path | What it is |
|---|---|
| `src/contract.js` | The six contract objects and the checker (Node and browser) |
| `src/rulesets.js` | Historical, Blackthorn and competitive rulesets; `describeFormat()` reads Showdown's real rule tables |
| `src/validate.js` | Legality before battle: structural, obtainable, format |
| `src/teams.js` | Builds and Team Versions ↔ Showdown sets and pastes |
| `src/adapters/blackthorn.js` | Read-only: a Trainer Library version → Team Version and Trainer Profile, every gap fill written down |
| `src/observer.js` | One side's view of the battle (its own log channel only) |
| `src/agents/` | Layer A (legal options), the trainer agent (`trainer.js`), the cartridge AI (`cartridge.js`), and the two baselines, `random` and `maxpower` |
| `src/optimize/` | The EV optimizer (`evs.js`) and its 6v6 check (`confirm.js`) |
| `src/compare.js` | A team against a whole opponent pool; two versions of a team compared with the same seeds |
| `src/battle.js` | One battle: agents decide, the engine checks, the input log is kept; `replayBattle()` |
| `src/analyze.js` | Per-Pokémon contribution and knockout credit |
| `src/runner.js`, `src/runner-node.js` | Runners: this thread, Node worker threads, browser Web Workers (same numbers on all) |
| `src/experiments.js` | The Lab's questions, each a permanent record; one battle again; "try from here" |
| `src/report.js`, `src/render.js` | The Strategy Report (four levels, patterns with their next experiment) and its Markdown |
| `src/replay.js` | A battle as turns: positions, each decision's options and reasons, events |
| `src/editor.js` | What the build editor offers (Gen 4 learnsets, items, natures, abilities) |
| `src/adapters/collections.js` | The library's collections as pools, lineup variations, the interpretations |
| `src/batch.js`, `src/stats.js` | Jobs → results: seeds, mirrored pairs, the Wilson interval, failures, timing |
| `cli/` | `lab.mjs`, `lab-record.mjs`, `run.mjs`, `battle.mjs`, `league.mjs`, `make-fixtures.mjs`, `confirm-spreads.mjs`, `optimizer-table.mjs`, the presets and a readable log printer |
| `browser/` | The bundle entry, the bench page and the Lab page (`lab.html`), the build and the Playwright tests |
| `appscript/` | A throwaway Apps Script project that serves the bench page (`INSTALL.txt`), separate from the Canon DB script |
| `fixtures/` | From the library:<br>• your HeartGold, SoulSilver and Platinum sixes (optimized; the duel spreads; 85 even as the control)<br>• the two league pools (`pools/`)<br>• Platinum Cynthia<br>• the optimizer's reports and 6v6 checks (`optimizer/`)<br>• the lineup variations (`teams/variation-*`)<br>• every trainer's profile<br>• the lab pack (`lab/pack.json`): your teams, 19 pools, 161 opponent teams, both readings of each trainer<br>Also a Gen 4 OU sample team |
| `results/` | The recorded Lab experiments (`lab/`), four recorded 100-battle jobs, the league runs (`league/`), the browser runs and screenshots |

## Next (from the master plan)

- **Phase 4: real devices.** Run the bench on a phone and the work laptop, and the Apps Script deployment.
- **Phase 5: plug into the Battle Lab** through `Library.setTeamEngine`.
- **The trainer agent's next steps:** switch prediction, planning past one turn, and the odd status moves
  (`docs/TRAINER_AI.md`).
- **Coach settings for your lineups,** so your trainer plays as you'd play rather than on the defaults.
