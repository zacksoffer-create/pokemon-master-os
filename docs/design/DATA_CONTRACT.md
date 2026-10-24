# Data contract

The shared vocabulary and record shapes every Blackthorn module reads and writes. It's the master plan's §3
(`MASTER_PLAN.md`) turned into rules the code follows. When code and this file disagree, one of them is a bug.

## 1. Three questions every record answers

Every record answers three separate questions. A record never folds them into one label.

### 1.1 Whose record is it? (`owner`)

| Value | Means | Today's store provenance |
|---|---|---|
| `reference` | supplied by Blackthorn: species, moves, mechanics, balls, ladder and stock build sets | `stock`, `ingested`, `competitive` |
| `mine` | yours: your individuals, builds, teams, blueprints, assignments, artwork, inventory | `yours` |
| `trainer` | belongs to a trainer version (game, anime, manga, curated) | `canonical` |
| `variant` | a draft or saved branch of any of the above; it never replaces its original | new |

The store keeps its `provenance` field for compatibility. `owner` is derived from it, plus `variant` when a build has a `parent`.

### 1.2 What kind of claim is it? (`class`)

| Class | Means | Examples |
|---|---|---|
| `canon` | stated by an identifiable Pokémon source | a Pokédex entry, an episode, a game's text |
| `mechanic` | established by the game's rules or data | learnsets, stats, the damage formula, HM rules, egg groups |
| `measured` | an engine result under stated assumptions | a 1v1 read, a team-role score, a benchmark result |
| `inferred` | reasoned from evidence | "a Fire type can make heat", "this Pokédex line means it can carry a rider" |
| `standardized` | filled in by a declared Blackthorn method | 85 EVs for a blank build (D-061), the defaults in `defaults_used` |
| `hypothesis` | plausible, needs investigation | a research hypothesis in the journal |
| `creative` | Blackthorn world-building or a fan work, never canon | most world records, generated artwork, the Chronicle |
| `unknown` | not enough information | a blank |

A capability drawn from a Pokédex line carries both classes: the text is `canon`, and "so it can do X" is `inferred`.

**How the current labels map:**

- **Journal kinds:**

  | Kind | Class |
  |---|---|
  | official | `canon` |
  | verified mechanic | `mechanic` |
  | research | as the source states (`canon` when it reports a show or game, otherwise `inferred`) |
  | observation | yours: `canon` when it's something you saw in a game or show |
  | hypothesis | `hypothesis` |
  | world-building | `creative` |

  Ingested notes are filed as **research**, or **world-building** when they come from a fan work; never as Personal observation.
- **Wilderness tiers:**

  | Tier | Class |
  |---|---|
  | cartridge | `mechanic` |
  | lore | `canon` for the text, `inferred` for the capability |
  | inference | `inferred` |
  | authored | the record's own class (most are `creative` or `inferred`), with status `approved` |

  Phase 7 moves the engine onto these classes. Until then the four tiers stay as they are.

### 1.3 Who stands behind it? (`status`)

| Value | Means |
|---|---|
| `proposed` | suggested, not accepted |
| `approved` | accepted, with a decision id (D-…) where one exists |
| `rejected` | turned down |
| `superseded` | replaced by a newer record or version |

For builds there are also `draft` (unsaved work, kept in this browser) and `saved` (a committed version).

Approval never changes a record's class. An approved `creative` record is still `creative`.

## 2. Ids

Ids are opaque strings; nothing parses meaning out of them except the prefix.

| Record | Form | Notes |
|---|---|---|
| Individual | `me:<game>/<Species>` for the 36 journey companions; `me:<game>/<Species>-<token>` for every one made in the app | the token makes two of the same species in one game possible (Q4) |
| Build | `yours:<game>/<Species>`, `yours:lineup/<id>`, library ids, `competitive:<format>/<species>-<hash>`; `yours:<Species>-<token>` for builds made in the app | unchanged for everything that exists |
| Team | existing team ids; `team:<token>` for teams made in the app | |
| Token | `Date.now().toString(36)` plus 2 random base-36 characters | short, sortable, unique enough for one person |

## 3. Versions

- **A build has versions.**
  - A build from canon or the library is version 1.
  - Every save from the app adds a version: a new row in **My Builds** with the same `id` and `v` one higher.
  - The highest `v` is the build's current state, and earlier versions stay readable forever.
- **A version never changes once saved.**
  - Results pinned to it (team-role reads, qualifications) stay true of it.
  - A changed moveset makes a new version, and the new version reads "needs a read" until it's run.
- **A variant is a new build with a `parent`** (`<id>@<v>`). It's how you branch Cynthia's Garchomp, or try a second Larvitar spread, without touching the original.
- **Drafts aren't versions.** Unsaved edits live in this browser (`localStorage`, key `bt-draft:<build id>`), survive navigation and reloads, and are dropped on Save or Discard.

## 4. Where records live

| What | Home | Written by |
|---|---|---|
| Reference data, definitions, canonical trainers, the journey's starting records | git (`engine/canon`, `engine/data`), packed into the app zip | Claude, after approval |
| Your individuals, builds and teams made or changed in the app | the Sheet's **My Pokémon**, **My Builds** and **My Teams** tabs (append-only) | the app (`apiAppend`) |
| Your pictures | the Drive folder **Blackthorn HQ artwork** (the files) and the **My Artwork** tab (one row per picture: `id`, `subject`, `kind`, `file` or `url`, `title`, `class` creative or reference, `status`, `note`, `at`); an individual's `hero` names its profile picture | the app (`apiUpload`, `apiAppend`) |
| A snapshot of those tabs for engine runs | `engine/store/personal.json` | `store/personal.py`, from the tabs' rows |

**Append-only rules for the three tabs:**

- **Rows only get added.** Each row is a whole record at that moment: an individual, one build version, or a team.
- **The newest row wins.** For an individual or team, that's the latest row per `id`. For a build, it's the latest row per `id` and `v`.
- **Nothing rewrites these tabs.** A rebuild never touches them: `ranch/sheet.py` doesn't know they exist, and the app creates them on first use.
- **Retiring is a row too.** A record is retired by a row with `status` `retired`; nothing is deleted.

**The columns.** They're readable in the Sheet as well as by the app:

| Column | Format | Example / note |
|---|---|---|
| `moves` | moves joined with `" / "` | |
| `ivs`, `evs` | six numbers in HP/Atk/Def/SpA/SpD/Spe order, joined with `/` | `0/252/0/0/4/252` |
| blank `ivs` / `evs` | none recorded | |
| `hatch_moves` (My Pokémon) | written like `moves` | the moves it hatched with, kept whatever it learns later |
| other fields | a plain value | |

**Trainer Library (Phase 5).** A team in My Teams can be a version of a trainer: `kind` (`custom` for optimized or what-if, `all-time`), `trainer` (the identity id, e.g. `cynthia`) and `parent` (the library version it came from, e.g. `platinum/cynthia`). Its `slots` are the usual `{species, from, prov, build}` with `prov` `variant`; a kept member keeps the game's IVs. Saving it again keeps the three fields. The library reads it as a version of that trainer; the original is never written. Library version ids are `<game>/<identity>[-<encounter>]` for cartridge teams and `<identity>/<version>` for authored ones. In `canon/build_library.json` a corrected build carries `v` and `history` (its earlier versions, each with `v`, `until` and `changed_by`); `canon/trainers.json` versions may carry `kind` and `parent` (ingest's `trainer_version` claim).

**Breeding stock (Phase 4).** A blueprint is a build with `kind` `blueprint`, plus `purpose` (competitive, environment, versatility, personal, other) and `labels` (comma-separated). Its `moves` are the whole starting set in hatch slot order, the order PKHeX checks. An individual made from one has `blueprint` (the build id), `hatch_moves`, `origin` "hatched (blueprint …)", and its own build: a variant whose `parent` is the blueprint's `<id>@<v>`, so editing the Pokémon never changes the design. `sire` and `dam` name its parents by id: a studbook id (`S-TYRANITAR`, `D-TYRANITAR`) or one of yours. This is how studbook ids link to individuals (X3).

The browser (`20_core.html` `Records`) and Python (`store/personal.py`) share these formats, held together by a test.

**How the store is built:**

1. The starting records come from `store/migrate.py`.
2. `personal.json` (your saved versions and new records) is merged on top.
3. Both the app and the engine read the result: the app joins the live tabs in the page, and `rebuild.py` reads the snapshot.

## 5. Locks that stay in force

- **D-006.** HeartGold's six can't be retired or swapped. Their builds can get new versions, because the roster is what's locked, not the movesets (B25).
- **D-063.** Labs never write canon. Your records aren't canon; canon changes only through approval, by Claude, in git.
- **D-024 / D-048.** Learnability is the gate. Any stricter legality shows as information, never as a block.
- **The existing Sheet's built tabs.** No payloads are ever sent to them (B22/B23).
