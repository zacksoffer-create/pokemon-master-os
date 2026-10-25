# Phase 0: architecture audit and technical spike

*2026-10-25. The 6v6 Simulator Master Plan's Phase 0, done in an isolated project (`sixvsix/`). Nothing in
`engine/` or the deployed app was changed; the Trainer Library was only read.*

**Exit gate:** one verified engine choice, a documented data contract, and no changes to the production application.
**Met.** The engine is pinned and verified (below and in [TEST_REPORT.md](TEST_REPORT.md)), the contract is in
[DATA_CONTRACT.md](DATA_CONTRACT.md) with code that enforces it (`src/contract.js`), and `git diff` outside `sixvsix/`
is docs only (the decision ledger row, the README row and a status line on the seam page).

## 1. The engine: what I checked, what I chose

| Question | Answer | How I know |
|---|---|---|
| Which package? | **`@pkmn/sim` 0.10.11** (2026-06-18), exact pin | `package.json`; `test/contract.test.mjs` fails if a result claims a different version than the one installed |
| Why not `pokemon-showdown` itself? | Same simulator; `@pkmn/sim` is the packaging built for bundling into a browser, with ESM and types | It bundled with esbuild on the first try (below) |
| Why not `@pkmn/engine`? | Its repository warns of heavy development and breaking changes; Gen 4 fidelity matters more than raw speed | The plan's own call; nothing found to overturn it |
| Gen 4 singles, 6v6? | Yes: `[Gen 4] OU`, `[Gen 4] Anything Goes`, `[Gen 4] Custom Game` and the rest | `describeFormat()` reads the real rule tables |
| Team preview in Gen 4? | **None**, which is cartridge-accurate | Showdown's Gen 4 `Standard AG` drops `Team Preview`; test asserts it for every ruleset |
| Seeds | Showdown's own PRNG, `sodium,<32 hex>` (ChaCha20). Battles are reproducible from seed + choices | Every battle replayed from its input log in the tests is identical (`test/reproducibility.test.mjs`, `cli/battle.mjs`) |
| Does the battle engine validate teams? | **No**, as the plan warned. Validation is a separate step (`src/validate.js`), run before every job | `prepareJob` refuses illegal teams; tested |
| Browser bundling | Works. Full build 6.31 MB (1.05 MB gzipped); battle-only build 2.03 MB. Phases 2–3 add the damage calculator the trainer agent uses: 6.83 MB and 2.56 MB | `browser/build.mjs` |
| Inside Apps Script's frame | Works in a frame built the way Apps Script serves a web app (sandboxed, cross-origin, document-written), Web Worker included | `browser/test-browser.mjs`; **not yet on a real Apps Script deployment** |

### What a Showdown log contains that matters to us

- **Wall-clock stamps** (`|t:|`). The only part of a log that differs between identical runs. `normalizeLog()` drops
  them before hashing.
- **Split lines.** Each side's channel gets exact HP for its own Pokémon and percentages for the opponent's. Agents
  read only their own channel; the analysis reads the omniscient one.
- **The input log.** Showdown records the start options, both teams and every choice. That alone replays a battle
  exactly, so every result keeps it (`replayBattle()`).

### Showdown's Gen 4 formats mix two kinds of rules

| Kind | Examples | Effect |
|---|---|---|
| In-battle | Sleep Clause Mod, Freeze Clause Mod, Endless Battle Clause, HP Percentage Mod | Change what happens during a battle |
| Validator only | Species, Nickname, OHKO, Evasion Items/Moves/Abilities, **Sleep Moves Clause** | Decide which teams may enter |

Current `[Gen 4] OU` bans sleep-inducing moves outright, plus Yawn, Sand Veil and Snow Cloak. None of that is
cartridge behaviour. So **Historical and Blackthorn modes battle on `[Gen 4] Anything Goes`**, which has no Smogon
clauses. Legality is checked separately with explicitly stated rule lists. Competitive mode uses `[Gen 4] OU` as
Showdown defines it.

## 2. Blackthorn's existing structures, and how they map

| Plan object | What Blackthorn already has | Gap | What the contract does |
|---|---|---|---|
| Pokémon Build | Library `party[]` members (species, level, moves, item, ability, IVs, EVs, nature) with per-field evidence classes; My Builds rows | Fields are often blank and filled differently by each engine | A build is **always complete**. The adapter fills gaps with the one-on-one engine's rules and writes each fill on the build (`filled`) next to the library's evidence class |
| Team Version | Library versions (`<game>/<identity>`, `<identity>/<version>`, `team:…`); My Teams rows | No version numbers on library versions; ids are reused across lenses | `TeamVersion` has `id` + `version` + `lens`; the lens is part of what a job holds constant |
| Trainer Profile | `ai_flags`, `reading` (tendencies, competence), authored `sliders`, coach settings | Nothing executes them yet | Carried on the profile as data; Phase 1 decides with a named baseline agent and says so |
| Battle Ruleset | None (the one-on-one engine has fight settings in code and D-061) | — | Three rulesets with every in-battle rule listed and checked against Showdown's tables |
| Simulation Job | None | — | One JSON object holds everything held constant and how the trials vary |
| Simulation Result | `SIXVSIX_SEAM.md` result shape | The seam shape has no place for failures, legality or per-battle seeds | Seam fields unchanged at the top level; evidence added beside them |

The adapter (`src/adapters/blackthorn.js`) reads `engine/app/data/library.json` and nothing else. It produced the
fixtures for Zack's HeartGold six (`me/heartgold`) and Platinum Champion Cynthia (`platinum/cynthia`).
`test/contract.test.mjs` re-derives them from the live library file on every run, so drift shows up as a failure.

## 3. Calls I made that you can overturn

Each is a default I needed to build the foundation. None decides anything about your canon.

| # | Call | Why | Alternatives |
|---|---|---|---|
| S-1 | Historical and Blackthorn modes battle on `[Gen 4] Anything Goes` (no Smogon clauses), with Endless Battle Clause and HP Percentage Mod kept | The cartridge has no clauses. The two kept rules only act on an unwinnable loop and on how the opponent's HP is shown | A custom format with Sleep Clause for Blackthorn mode |
| S-2 | A neutral nature is **Hardy** | Any neutral nature gives the same stats; Hardy is the first | Serious, Docile, Bashful, Quirky (no difference in battle) |
| S-3 | Gender not on record is left to Showdown, drawn from the battle seed | No record exists; inventing one is worse. Results list it under `varied` | Fix each species' most common gender |
| S-4 | Historical mode requires only *structural* legality and reports *obtainable* | A game trainer's team is legal because the game made it | Require obtainable too (would reject cartridge oddities) |
| S-5 | Battles run in **mirrored pairs**: same battle seed, sides swapped | Cancels any side advantage, and the record shows it (`by_side`) | Independent seeds, side alternating (`pairing: 'alternate'`) |
| S-6 | Every trainer plays the **max-power baseline** in Phase 1, with the library's AI reading carried as data. **Superseded in Phase 3:** every trainer now plays the trainer agent, its identity read from the library (D-073 (d), [TRAINER_AI.md](TRAINER_AI.md)) | The plan says to build competent agents only after the measuring tools exist | — |
| S-7 | Results keep every battle's input log and the first battle's full log and decision trace | Any battle can be replayed and inspected; about 0.5 MB per 100 battles | Keep logs for all (5×), or none |
| S-8 | The browser page ships the **battle-only build** (2 MB) and accepts legality reports made by Node or the full build, if they match the team version, ruleset and engine | 3× smaller, half the start-up time, identical battles | Ship the full 6.3 MB build and validate in the browser |
