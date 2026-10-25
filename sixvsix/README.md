# sixvsix: the Blackthorn 6v6 simulator (Phases 0–3)

Showdown's Gen IV battle engine (`@pkmn/sim` 0.10.11) behind a shared simulation contract. It has:

- an explainable trainer agent for both sides, each game trainer's identity read from the Trainer Library;
- an EV optimizer for your teams (D-072: yours fully optimized, every opponent on 85);
- whole-league runs and paired comparisons;
- a seeded batch runner and a browser build that plays the same battles as Node.

It is the 6v6 engine from D-069, built separately. It reads the Trainer Library and plugs into nothing yet
(`docs/design/SIXVSIX_SEAM.md` is where it will).

**Read first:**

- [docs/TEST_REPORT.md](docs/TEST_REPORT.md): what ran, passed, failed, and is unverified, plus the league results.
- [docs/EV_OPTIMIZER.md](docs/EV_OPTIMIZER.md): every optimized spread, how it was chosen and checked, and what D-072
  does in battle.
- [docs/TRAINER_AI.md](docs/TRAINER_AI.md): how the trainer agent decides, and its identity settings.
- [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md): the contract objects.
- [docs/PHASE0_AUDIT.md](docs/PHASE0_AUDIT.md): engine choice, findings, and the calls I made.

## Install and run

Node 20 or later.

```
cd sixvsix
npm ci
npm test                                   # 132 tests, about 45 s
node cli/battle.mjs heartgold-vs-cynthia 0 # one battle in full: log, decisions with reasons, knockouts, replay check
node cli/run.mjs heartgold-vs-cynthia      # a 100-battle job → results/heartgold-vs-cynthia/
node cli/run.mjs all                       # every preset (cli/presets.mjs)
node cli/league.mjs                        # each of your teams against its whole league, plus the D-072 check
node cli/make-fixtures.mjs                 # rebuild fixtures/ from the Trainer Library (read-only), EV optimizer included
node cli/confirm-spreads.mjs               # the 6v6 check on every optimized spread (about 10 min)
npm run build                              # dist/: bundles, bench pages, the Apps Script test package
npm run test:browser                       # 25 browser runs in Chromium → results/browser/perf.json
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
| `src/agents/` | Layer A (legal options), the trainer agent (`trainer.js`), and the two baselines, `random` and `maxpower` |
| `src/optimize/` | The EV optimizer (`evs.js`) and its 6v6 check (`confirm.js`) |
| `src/compare.js` | A team against a whole opponent pool; two versions of a team compared with the same seeds |
| `src/battle.js` | One battle: agents decide, the engine checks, the input log is kept; `replayBattle()` |
| `src/analyze.js` | Per-Pokémon contribution and knockout credit |
| `src/batch.js`, `src/stats.js` | Jobs → results: seeds, mirrored pairs, the Wilson interval, failures, timing |
| `cli/` | `run.mjs`, `battle.mjs`, `league.mjs`, `make-fixtures.mjs`, `confirm-spreads.mjs`, `optimizer-table.mjs`, the presets and a readable log printer |
| `browser/` | The bundle entry, the bench page (standalone, Apps Script and claude.ai variants come out of one template), the build and the Playwright test |
| `appscript/` | A throwaway Apps Script project that serves the bench page (`INSTALL.txt`), separate from the Canon DB script |
| `fixtures/` | From the library:<br>• your HeartGold, SoulSilver and Platinum sixes (optimized; the duel spreads; 85 even as the control)<br>• the two league pools (`pools/`)<br>• Platinum Cynthia<br>• the optimizer's reports (`optimizer/`)<br>• every trainer's profile<br>Also a Gen 4 OU sample team |
| `results/` | Four recorded 100-battle jobs, the league runs (`league/`) and the browser performance run |

## Next (from the master plan)

- **Phase 4: real devices.** Run the bench on a phone and the work laptop, and the Apps Script deployment.
- **Phase 5: plug into the Battle Lab** through `Library.setTeamEngine`.
- **The trainer agent's next steps:** lead choice, switch prediction, and the odd status moves
  (`docs/TRAINER_AI.md`).
