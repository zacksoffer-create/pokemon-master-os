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

There are 127. The first 64 were your companions, the Ilex Forest community and the Blackthorn highlands. Zack asked
for more ("Want more of it", A-62), so 63 more followed, in the groups the Natural history page shows them in:
- **The canon sixes' lines:** the earlier stages of the HeartGold and SoulSilver teams and the other journeys' sixes
  (Cyndaquil, Larvitar, Piloswine, Munchlax, Pichu, Chimchar, Piplup, Gastly, Scyther, Gyarados and their lines).
- **The rival's six:** Nidoking, Kingdra, Houndoom, Metagross, Gliscor and Salamence.
- **Kanto's communities (A-66):** Viridian Forest, Mt. Moon, the Seafoam Islands, Cerulean Cave, the routes around
  Fuchsia, Cinnabar and its seas, and Rock Tunnel and Diglett's Cave.
- **More of the Blackthorn highlands:** Spearow, Heracross, Aipom, Gligar, Teddiursa, Phanpy, Skarmory, Bellsprout,
  Weepinbell and Tangela.

The groups live in `COHORT` in `engine/biology/evidence.py`, which also decides which species get an evidence pack;
the app reads them from `dossiers.json`.
- **Format:** each is in `engine/biology/dossiers/<slug>.json` with a summary and thirteen sections (anatomy to the
  homestead), plus niche, relationships, ecotypes, contradictions, folklore and open questions.
- **Status:** all are drafts.
- **Pineco** is the exemplar.
- **Your review:** agree, disagree or note on any statement is a Journal row (kind `review`). The file stays the
  author's account.

Where a dossier has no evidence for a guild (what Cyndaquil or Skarmory eats, say), the guild is left empty
rather than guessed from a type, and the page says "no guild yet". Where stages of one line are filed differently
(Bellsprout eats insects, Weepinbell swallows anything that moves), the home page lists the line under "Questions
for you".

The other 366 species get a **field guide** in the app: their own claims by domain, the machine reading labelled
as machine-made, and no prose invented for them.

## Ecotypes

Egg moves are what a lineage carries through its parents, so they're read as how a lineage lives (Zack's orca
analogy):
- **Functions:** each egg move is read as an ecological function (ambush, pursuit, theft, chemical defence, sedative,
  cold, rock and soil, cooperation and so on), weighted by how much it says about a way of life.
- **Naming:** two functions together make a named ecotype, such as "Frost ice-walker".
- **Places:** each ecotype is fitted to the Johto and Kanto places in its species' range.
- **Evidence:** the dossiers' curated ecotypes come first; machine ecotypes are hypotheses.
- **Your Pokémon:** `#/ecotypes` reads the egg moves your Pokémon carry against both.

## Pages

| Page | Address |
|---|---|
| Natural history (cohort, search, questions) | `#/biology` |
| A species (dossier or field guide, niche, webs, ecotypes, range, every entry) | `#/biology/<name>` |
| Ecosystems (both regions; `?region=johto` or `?region=kanto` for one) | `#/ecosystems` |
| One place | `#/ecosystem/<key>` |
| Ecotypes | `#/ecotypes` |
