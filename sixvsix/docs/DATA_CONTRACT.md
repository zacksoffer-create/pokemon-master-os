# The Shared Simulation Contract (v0.1.0)

*What every simulation is made of, wherever it runs. `src/contract.js` enforces it; the same checker runs in Node
and in the browser bundle.*

Six objects, each with `kind`, a stable `id` and a `version`. A sheet row number is never an identity. Everything a
job needs is loaded once before the first battle; turns run in memory; results are written after.

```
Pokémon Build ×6 ─► Team Version ─┐
                   Trainer Profile ─┼─► Simulation Job ─► (engine) ─► Simulation Result
                   Battle Ruleset ──┘
```

## Pokémon Build

One individual, complete. Required: `id`, `version`, `species`, `generation`, `level`, `nature`, `ability`, `item`
(may be null), `moves` (1–4), `ivs` and `evs` (all six stats). Optional: `nickname`, `game`, `gender`, `shiny`,
`happiness`, `source`, `parent`.

- `evidence`: per field, `[class, why]` with Blackthorn's five classes: confirmed, strongly inferred,
  standardized, hypothetical, unknown.
- `filled`: one line per value an adapter supplied, e.g. `"EVs: 85 in every stat (D-061, none on record)"`.

## Team Version

`id`, `version`, `name`, `generation`, `members` (1–6 Pokémon Builds), `lead` (`"first"` in Phase 1). Optional:
`trainer`, `game`, `lens` (`authentic` | `standardized`), `locked`, `source`, `parent`. A team from the Trainer
Library carries `source: {kind: "blackthorn-trainer-library", version_id, library_kind, record, read_only: true}`.

## Trainer Profile

`id`, `version`, `name`, `agent` (the policy that decides: `random` or `maxpower` in Phase 1), `params`,
`information` (`partial`, the default; `omniscient` is reserved for a labelled experiment and refused in Phase 1).
Carried for later phases: `identity`, `source_version`, `tendencies` (authored sliders, coach settings),
`competence`, `playbook`, `ai_flags`, `reading`.

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

### Knockout credit (`kos[].how`)

| How | Credited to |
|---|---|
| `direct` | The opposing Pokémon whose move dealt the last hit |
| `hazard` | Whoever set the Stealth Rock or Spikes |
| `status` | Whoever inflicted the poison or burn |
| `weather` | Whoever started the sandstorm or hail, if it was the other side |
| a named effect | The `[of]` source in the log (Rough Skin, Leech Seed, Destiny Bond) |
| `self` | Nobody: recoil, Life Orb, Explosion, its own weather |
