# The 6v6 seam

**D-069 (Zack, 2026-10-24):** *"We're going to build the 6v6 engine separately. Keep building without it but it's
coming in later."* The rest of Blackthorn keeps building without it. This page is what the 6v6 engine gets from the
app, what it hands back, and where its results show up, so it can plug in without rework on either side.

**Status (D-071 to D-075, 2026-10-25):** Phases 0–3 and the 6v6 Lab are built in `sixvsix/`, still separate.
That's the contract, the engine, the batch runner, the trainer agent and the cartridge AI, whole-league runs, paired
comparisons, the D-072/D-074 EV optimizer, and the Lab's experiments, with a result in the shape below. The Lab reads
the Trainer Library's collections as opponent pools and keeps every run as an Experiment record
(`sixvsix/docs/DATA_CONTRACT.md`). It is not registered with `Library.setTeamEngine` yet (that's Phase 5). See
`sixvsix/docs/HOW_IT_WORKS.md` and `sixvsix/docs/TEST_REPORT.md`.

**Plugged in (v1, D-077, 2026-10-25):** the engine runs in the app (`docs/ARENA.md`): the battle-only build loads on
demand, `Library.setTeamEngine` is registered and returns this page's result shape, Benchmarks links to Team vs team
in the Arena, and every trainer profile shows how its tendencies played out in 6v6 (criterion 6). The browser plays
exactly Node's battles (`app/test_arena.mjs`).

It answers master plan Q8 and narrows D-043: the scouting reports and call sheets stay the product, and the 6v6 engine
is one more source of evidence beside the one-on-one engine, which stays the measuring stick (Trainer spec §7: "preserve
the existing 1v1 simulator as an established working foundation").

## What it gets: a version, ready to simulate

Every trainer version in the Trainer Library has one shape, whatever its kind (cartridge, anime, all-time, journey,
custom, or a version you made):

| Where | How |
|---|---|
| Python | `trainers.catalog.Catalog().build()["versions"][id]` |
| The app's data | `engine/app/data/library.json` → `versions[id]` |
| In the page | `Library.version(id)` (your own versions from My Teams included) |

| Field | What it is |
|---|---|
| `id`, `identity`, `name`, `kind`, `game`, `generation` | who and which version (ids: `<game>/<identity>[-<encounter>]` for cartridge teams, `<identity>/<version>` for authored ones, `team:…` for yours) |
| `party[]` | `species`, `level` (absent: Lv 100), `moves`, `item`, `ability` (`ability_set` true when the game fixes the slot; otherwise the species' first, standardized), `nature` (absent: unknown, fought neutral), `ivs`, `evs` (absent on cartridge teams: the games give trainers none) |
| evidence | `Library.evidenceOf(v)`: each field's class (confirmed, strongly inferred, standardized, hypothetical, unknown) and why |
| AI | `ai_flags` (Gen 4 HGSS: a bitmask, with `ai_flag_names`), and `reading`: the flags as **tendencies** and **competence** (`library.json` → `flags` has what each flag does, `flag_read` the mapping) |
| your reading | `sliders`: authored offense, rigidity, bond, risk (an interpretation, never a measurement) |
| coach | the five coach settings (`library.json` → `coach`): none are set yet; the 6v6 engine should read them as tendencies |
| lens | `as encountered` (their levels) or `standardized` (Lv 100), `library.json` → `lenses` |

The engine should fill gaps the same way the one-on-one engine does (the strongest set for missing moves, D-061's 85
EVs for blank builds, neutral natures), and say so in the result.

## What it hands back: one result shape

```json
{
  "engine": "showdown-sim@<version>",
  "format": "gen4 singles, 6v6, level 100",
  "a": "team:abc123 or a library version id",
  "b": "platinum/cynthia",
  "lens": "standardized",
  "held_constant": ["both builds", "Cynthia's AI flags", "lead order"],
  "varied": ["random rolls", "speed ties"],
  "seed": 1,
  "n": 100,
  "won": 61, "lost": 37, "drew": 2,
  "battles": [{"winner": "a", "turns": 34, "left": {"a": 2, "b": 0}, "log": "<file or link>"}],
  "made_at": "2026-11-01T12:00:00Z"
}
```

A result is evidence of its own class (**simulated**), recorded with what was held constant (Trainer spec §7). Trainers
don't see hidden information unless the scenario says so (public, revealed, species knowledge, scouting, prediction,
unknown).

## Where it shows up

| Trainer spec criterion | Today (1v1) | With the 6v6 engine |
|---|---|---|
| 4 · a team as a benchmark | Benchmarks `#/bench`: one of yours one-on-one against a team | a **Team vs team** mode on the same page, your saved team against any version |
| 5 · standardized team comparisons | the standardized lens, one-on-one | the same lens for 6v6, batches of about 100 |
| 6 · how tendencies affect modeled behavior | the AI flags read as tendencies and competence on each profile | "how it showed in the battles": the decisions the engine logged, by tendency |

In the page the engine registers itself with `Library.setTeamEngine(fn)`, where `fn(a, b, opts)` returns a promise of
the result above; until one is registered, those places say the 6v6 engine is coming. If it runs as a worker on the
home laptop instead (master plan §3), its results come back as data in the same shape.
