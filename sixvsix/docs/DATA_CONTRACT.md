# The Shared Simulation Contract (v0.1.0)

*What every simulation is made of, wherever it runs. `src/contract.js` enforces it; the same checker runs in Node
and in the browser bundle.*

Six objects, each with `kind`, a stable `id` and a `version`, plus the Opponent Pool, added in Phase 2. It's a
named set of Team Versions, so no existing object changed. A sheet row number is never an identity. Everything a job
needs is loaded once before the first battle; turns run in memory; results are written after.

```
Pokémon Build ×6 ─► Team Version ─┐
                   Trainer Profile ─┼─► Simulation Job ─► (engine) ─► Simulation Result
                   Battle Ruleset ──┘
Team Version + Opponent Pool ─► one Simulation Job per opponent ─► Pool Result, or two arms ─► Comparison
```

## Pokémon Build

One individual, complete. Required: `id`, `version`, `species`, `generation`, `level`, `nature`, `ability`, `item`
(may be null), `moves` (1–4), `ivs` and `evs` (all six stats). Optional: `nickname`, `game`, `gender`, `shiny`,
`happiness`, `source`, `parent`.

- `evidence`: per field, `[class, why]` with Blackthorn's five classes: confirmed, strongly inferred,
  standardized, hypothetical, unknown.
- `filled`: one line per value an adapter or the optimizer supplied, for example
  `"EVs: 85 in every stat (D-072: opposing teams carry 85)"` or
  `"EVs: 248 HP / 4 Def / 12 SpD / 244 Spe (D-072: optimized one-on-one against HeartGold/SoulSilver Elite Four, Champion, rematches and Red)"`.
  A nature the optimizer chose is listed too, and its evidence is `hypothetical`.
- **EVs (D-072).** Your Gen 4 teams carry optimized spreads (`docs/EV_OPTIMIZER.md`). Every Trainer Library
  opponent carries 85 in every stat unless the job asks for the cartridge's zeros (`evs: 'cartridge'`).

## Team Version

`id`, `version`, `name`, `generation`, `members` (1–6 Pokémon Builds), `lead` (`"first"` in Phase 1). Optional:
`trainer`, `game`, `lens` (`authentic` | `standardized`), `locked`, `source`, `parent`. A team from the Trainer
Library carries `source: {kind: "blackthorn-trainer-library", version_id, library_kind, record, read_only: true}`.

## Trainer Profile

`id`, `version`, `name`, `agent` (the policy that decides: `trainer`, or the baselines `random` and `maxpower`),
`params`, `information` (`partial`, the default; `omniscient` is reserved for a labelled experiment and refused).
Also: `identity`, `source_version`, `tendencies` (authored sliders, coach settings, and `read_as`: where each trainer
setting came from), `competence`, `playbook`, `ai_flags` (names) and `ai_flags_raw` (the game's bitmask, for HGSS),
`reading`.

**`params` for the trainer agent**, each 0–100 (`docs/TRAINER_AI.md`):

| Param | Default |
|---|---|
| `aggression` | 50 |
| `risk` | 40 |
| `patience` | 50 |
| `heal_line` | 40 |
| `switching` | 60 |
| `preservation` | 50 |
| `harassment` | 50 |
| `setup_first` | 0 |
| `competence` | 90 |
| `foe_evs` | 85 (the EVs it assumes an unseen foe invested) |

A game trainer's profile fills these from the Trainer Library (`paramsFromLibrary`). Anything given in `params`
overrides them.

## Battle Ruleset

`id`, `version`, `name`, `mode` (`historical` | `blackthorn` | `competitive`), `generation`, `game_type`,
`team_size`, `battle_format` (the Showdown format the battle runs on), `in_battle` (every rule that acts during a
battle, checked against Showdown's own rule table by a test), `legality` (`require`, `report`, `format`),
`information` (`team_preview: false`, `opponent: "revealed"`, `hp: "percentage"`), `normalization`, `turn_limit`,
`not_modelled` (what the cartridge does that this ruleset doesn't), `note`.

| Ruleset | Mode | Battles on | Legality required | Not modelled |
|---|---|---|---|---|
| `gen4-historical` | historical | `[Gen 4] Anything Goes` | structural (obtainable reported) | trainer bag items, cartridge AI scoring, Shift style, DPPt/HGSS differences |
| `gen4-blackthorn` | blackthorn | `[Gen 4] Anything Goes` | structural, obtainable | bag items, cartridge AI scoring |
| `gen4-ou` | competitive | `[Gen 4] OU` | structural, obtainable, format (`gen4ou`) | — |

## Simulation Job

```json
{
  "kind": "SimulationJob", "id": "job:heartgold-vs-cynthia:standardized:maxpower", "contract": "0.1.0",
  "engine": {"name": "@pkmn/sim", "version": "0.10.11"},
  "ruleset": { "...": "the whole Battle Ruleset" },
  "a": {"team": { "...": "Team Version" }, "profile": { "...": "Trainer Profile" }},
  "b": {"team": { "...": "Team Version" }, "profile": { "...": "Trainer Profile" }},
  "trials": {"n": 100, "seed": "phase1-heartgold-vs-cynthia", "pairing": "mirrored", "turn_limit": 1000},
  "record": {"logs": "first", "decisions": "first", "input_logs": "all", "analysis": true},
  "scenario": {"lens": "standardized", "note": "..."}
}
```

- **Seeds.** Battle `i` uses `battleSeed(seed, pair)`, where pair = `i >> 1` when mirrored. Each side's policy
  draws from its own `policySeed(seed, i, side)`. Both are pure functions of the job, so they're identical in Node
  and any browser.
- **Pairing.** `mirrored` (the default): battles 2k and 2k+1 share a battle seed with the sides swapped.
  `alternate`: sides swap, seeds don't repeat. `none`: A is always P1.
- **Engine check.** A job written for another engine version is refused rather than rerun silently.

## Simulation Result

The seam's shape (`docs/design/SIXVSIX_SEAM.md`) at the top level, unchanged: `engine` (`showdown-sim@0.10.11`),
`format`, `a`, `b`, `lens`, `held_constant`, `varied`, `seed`, `n`, `won`, `lost`, `drew`, `battles`, `made_at`.
Then the evidence:

| Field | What it holds |
|---|---|
| `evidence_class` | `simulated` |
| `job` | ids and versions of both teams and profiles, the ruleset, the trials, and both teams' **legality reports** |
| `battles[]` | `i`, `pair`, `a_side`, `seed`, `policy_seeds`, `winner` (`a`/`b`/`draw`), `end` (`win`, `tie`, `turn-limit`, `error`, `stalled`), `turns`, `left`, `hp`, `hash` (normalized log), `decisions`, `unavailable`, `invalid`, `input_log`, `members` (per-Pokémon contribution), `kos` (each with who gets credit and how), and for the first battle `log` and `decision_log` |
| `summary` | won/lost/drew, `win_rate`, `score` (a draw counts half), **`win_rate_95`** (Wilson), `margin_95`, `by_side`, `pairs`, turn stats, per-member averages, and a one-line `reading` |
| `failures[]` | every battle that errored, stalled or saw an invalid choice, with its input log |
| `timing` | total and per-battle milliseconds, and the platform (never part of the result's meaning) |

`fingerprint(result)` hashes every battle's seeds, outcome and log hash. Two runs of one job on any device must give
the same fingerprint.

## Opponent Pool (Phase 2)

`id`, `version`, `name`, `lens`, `members` (Team Versions, at least one), and optionally `ev_policy` and `source`. The
committed pools are `fixtures/pools/heartgold-league.json` and `platinum-league.json`:

- **HeartGold/SoulSilver** (11 teams): the Elite Four, Lance, their rematches, and Red.
- **Platinum** (10 teams): the Elite Four, Cynthia, and their rematches.

Every member is at Lv 100 on 85 EVs.

## Pool Result and Comparison (Phase 2)

`runPool()` plays one team against every team of a pool: one Simulation Job per opponent, the same number of battles
each. It returns a **Pool Result**:

| Field | What it holds |
|---|---|
| `kind` | `PoolResult` |
| `team`, `team_version`, `agent` | Who played |
| `pool`, `ruleset`, `seed` | What they played, and how it was seeded |
| `allocation` | How battles were split across opponents |
| `n`, `won`, `lost`, `drew`, `win_rate`, `win_rate_95` | The pooled totals |
| `per_opponent[]` | `opponent`, `name`, `n`, `won`, the Wilson interval, `turns`, `left_when_won`, `failures` |
| `members` | Per-Pokémon contribution over the whole pool |
| `weakest` | The three hardest opponents |
| `failures` | A count over every opponent's job: errors, stalls and invalid choices |
| `timing`, `fingerprint` | As in a Simulation Result: the fingerprint covers every battle against every opponent |

`comparePool()` plays two arms (two spreads, builds or policies of one team) against the same pool with the **same
seeds**, battle for battle. It returns a **Comparison**:

| Field | What it holds |
|---|---|
| `kind` | `Comparison` |
| `x`, `y` | Each arm's label, team, agent, wins and win rate |
| `pairs` | `both_won`, `only_x`, `only_y`, `neither` |
| `mcnemar_p` | McNemar's exact test on the discordant pairs |
| `significant` | `mcnemar_p` < 0.05 |
| `difference` | The win-rate difference, y − x, with its paired 95% interval |
| `margin` | The HP margin, y − x, with its 95% interval: the share of the team's HP left minus the opponent's, at the end of each battle |
| `per_opponent[]` | Each arm's wins against each opponent |
| `reading` | One plain sentence |
| `timing` | As above |

### Knockout credit (`kos[].how`)

| How | Credited to |
|---|---|
| `direct` | The opposing Pokémon whose move dealt the last hit |
| `hazard` | Whoever set the Stealth Rock or Spikes |
| `status` | Whoever inflicted the poison or burn |
| `weather` | Whoever started the sandstorm or hail, if it was the other side |
| a named effect | The `[of]` source in the log (Rough Skin, Leech Seed, Destiny Bond) |
| `self` | Nobody: recoil, Life Orb, Explosion, its own weather |
