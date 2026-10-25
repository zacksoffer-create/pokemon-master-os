# sixvsix: the Blackthorn 6v6 simulator (Phases 0–1)

Showdown's Gen IV battle engine (`@pkmn/sim` 0.10.11) behind a shared simulation contract, with baseline agents, a
seeded batch runner and a browser build. It is the 6v6 engine from D-069, built separately; it reads the Trainer
Library and plugs into nothing yet (`docs/design/SIXVSIX_SEAM.md` is where it will).

**Read first:** [docs/TEST_REPORT.md](docs/TEST_REPORT.md) (what ran, passed, failed, unverified) ·
[docs/PHASE0_AUDIT.md](docs/PHASE0_AUDIT.md) (engine choice, findings, the calls I made) ·
[docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md) (the six objects).

## Install and run

Node 20 or later.

```
cd sixvsix
npm ci
npm test                                   # 101 tests, about 9 s
node cli/battle.mjs heartgold-vs-cynthia 0 # one battle in full: log, decisions, knockouts, replay check
node cli/run.mjs heartgold-vs-cynthia      # a 100-battle job → results/heartgold-vs-cynthia/
node cli/run.mjs all                       # every preset (cli/presets.mjs)
npm run build                              # dist/: bundles, bench pages, the Apps Script test package
npm run test:browser                       # 25 browser runs in Chromium → results/browser/perf.json
node cli/make-fixtures.mjs                 # rebuild fixtures/ from the Trainer Library (read-only)
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
| `src/agents/` | Layer A (legal options) and the two baselines, `random` and `maxpower` |
| `src/battle.js` | One battle: agents decide, the engine checks, the input log is kept; `replayBattle()` |
| `src/analyze.js` | Per-Pokémon contribution and knockout credit |
| `src/batch.js`, `src/stats.js` | Jobs → results: seeds, mirrored pairs, the Wilson interval, failures, timing |
| `cli/` | `run.mjs`, `battle.mjs`, `make-fixtures.mjs`, the presets and a readable log printer |
| `browser/` | The bundle entry, the bench page (standalone, Apps Script and claude.ai variants come out of one template), the build and the Playwright test |
| `appscript/` | A throwaway Apps Script project that serves the bench page (`INSTALL.txt`), separate from the Canon DB script |
| `fixtures/` | Zack's HeartGold six and Platinum Cynthia (from the library, both lenses), a Gen 4 OU sample team, profiles |
| `results/` | Four recorded 100-battle jobs and the browser performance run |

## Next (from the master plan)

Phase 2 makes comparison a first-class action (build A vs build B, paired, with enough trials to separate them).
Phase 3 replaces the baselines with an explainable tactical agent and its curated decision tests, then trainer
tendencies. Phases 4 and 5 handle real devices and plugging into the Battle Lab through `Library.setTeamEngine`.
