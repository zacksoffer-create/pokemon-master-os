# Field Biology: the natural history of every Pokémon (v1, D-077)

Zack: *"This one is gonna be my major project. This one I'm gonna want a lot of input in ... I want this to be real."*
The brief and the planning conversations are in `docs/specs/INSPIRATION_2K_BIOLOGY_ECOLOGY.md`. Every call made
building it is an item in `docs/design/ASSUMPTIONS.md` (A-62 to A-72, A-77, A-78). What the dossier writers found,
and the questions they left, are in `docs/biology_findings_v1.md`.

## The pipeline (`engine/biology/`, run in order by `build.py`, the rebuild's `biology` step)

| Step | What it makes |
|---|---|
| `archive.py` | Every Pokédex entry of all 16 Gen I–IV versions per species, de-duplicated and tidied, plus game data, evolution, abilities, and encounters by game, time and condition. Output: `data_manifest/biology/archive.json` (3,639 entries for 493 species). |
| `claims.py` | Each entry split into sentence claims by biological domain (diet, habitat, behaviour, anatomy, social, reproduction, defence, senses, powers, life cycle, people, folklore). Also a machine reading of diet and feeding guild, habitats, activity, social life, named relationships, and what nobody has said. Output: `claims.json` (6,438 claims). |
| `evidence.py --cohort` | An evidence pack per cohort species: everything a dossier may cite, as one page. Output: `evidence/<slug>.md`. |
| `dossier.py --check` | The dossier format and its checker. Every cited entry or claim must exist; every move must be learnable by the line; every ecotype must be built from egg moves and labelled a hypothesis. |
| `ecology.py` | Habitats, communities and food webs (`docs/ECOLOGY.md`). |
| `ecotypes.py` | Egg moves read as ecotypes, for every line with egg moves. |

`app/biology_pack.py` packs it for the app as `biology.json`, `dossiers.json`, `ecology.json`, `ecotypes.json` and
`ranges.json`; each page loads only the packs it needs.

## Evidence classes

Every statement in a dossier is one of:

| Class | Meaning |
|---|---|
| canon | the Pokédex says it; cites entry or claim ids |
| mechanic | the game's data says it (types, size, moves, encounter tables) |
| inferred | a strong biological inference, citing what it rests on |
| hypothesis | plausible but untested, saying why |
| creative | Blackthorn's own invention |
| unknown | what's missing |

Confidence (high, medium, low) is separate. Real-world biology appears only as a labelled **analogy**, never as
evidence.

## The dossiers

There are 64: your companions, the Ilex Forest community and the Blackthorn highlands.
- **Format:** each is in `engine/biology/dossiers/<slug>.json` with a summary and thirteen sections (anatomy to the
  homestead), plus niche, relationships, ecotypes, contradictions, folklore and open questions.
- **Status:** all are drafts.
- **Pineco** is the exemplar.
- **Your review:** agree, disagree or note on any statement is a Journal row (kind `review`). The file stays the
  author's account.

The other 429 species get a **field guide** in the app: their own claims by domain, the machine reading labelled
as machine-made, and no prose invented for them.

## Ecotypes

Egg moves are what a lineage carries through its parents, so they're read as how a lineage lives (Zack's orca
analogy):
- **Functions:** each egg move is read as an ecological function (ambush, pursuit, theft, chemical defence, sedative,
  cold, rock and soil, cooperation and so on), weighted by how much it says about a way of life.
- **Naming:** two functions together make a named ecotype, such as "Frost ice-walker".
- **Places:** each ecotype is fitted to the Johto places in its species' range.
- **Evidence:** the dossiers' curated ecotypes come first; machine ecotypes are hypotheses.
- **Your Pokémon:** `#/ecotypes` reads the egg moves your Pokémon carry against both.
- **Breeding stock:** the same reading of every Gen I–IV move ships with the ecotypes (`moves` in `ecotypes.json`).
  The breeding-stock designer reads a whole starting set with it (A-09, `docs/APP.md`).

## Pages

| Page | Address |
|---|---|
| Natural history (cohort, search, questions) | `#/biology` |
| A species (dossier or field guide, niche, webs, ecotypes, range, every entry) | `#/biology/<name>` |
| Ecosystems | `#/ecosystems` |
| One place | `#/ecosystem/<key>` |
| Ecotypes | `#/ecotypes` |
