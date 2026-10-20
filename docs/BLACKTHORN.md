# Blackthorn: the ranch, the studbook and the Canon DB Sheet (2026-10-20)

*The journey is over and every companion is retired (D-042). The present is a retired Champion's breeding ranch at Blackthorn (D-035, D-041). This is the part of the project that holds it all together: who lives there, what each facility needs, the breeding program, every individual's lineage, and one Google Sheet you can actually live in (D-025).*

## The Sheet

**Pokémon Master — Blackthorn Canon DB**, in the project's Drive folder (`docs.google.com/spreadsheets/d/1wl--FXM94a3tfVlDzJ0J83-D2AKmKfuqVHDLtw5qDEg`).

The Sheet is also the back end of **Blackthorn HQ**, the web app over the whole project (docs/APP.md, D-055). Its log tabs (Eggs, Egg Walks, Plantings, Harvests, Readings, Feedings, Journal, Timeline, Specimens) sit after Setup.

| Tab | What it holds |
|---|---|
| **Blackthorn** | the dashboard: live tiles (residents, lines, studbook, generations, rule issues, open jobs, your calls); the six chapters with their sprites; the breeding program; facilities and who runs them; the Glasshouse egg laps and crop plan; your open calls; charts of the land and the nursery pens |
| Journey | every companion with its build on record, status (HeartGold 🔒), breeding roles and its chapter's mastery |
| Residents | the census: 45 possible residents, where each lives, land, size, climate, water, egg groups, the jobs the games back |
| Facilities | every facility's jobs and who holds them, on evidence only (D-039); open jobs and jobs that hang on one Pokémon |
| Glasshouse | its rooms, the egg schedule in laps of the hatching loop, the crop plan (D-045) |
| Breeding Program | each target line, the chain that builds its stud, what's kept, a status you move and a progress bar |
| **Studbook** | every individual: sire, dam, generation, moves and where they came from, role, fate, status, rule check |
| Pedigrees | each stud's three-generation tree |
| Fathers | the journey's best fathers, and each companion's tinkering menu |
| **Your Calls** | the open questions, with a column for your answer |
| Decisions · Evidence · Locks · World | the ledger, the verified facts, what's locked, the authored world records |
| Setup | how the Sheet works and how to install the menu |
| Reference *(hidden)* | every species of Gens 1–4: egg groups, gender rate, what its eggs hatch as. The script checks hatches against it |

**Derived vs authored.** The engine rebuilds the derived tabs from canon (`python3 -I ranch/dashboard.py`, then `python3 -I ranch/sheet.py`, then the calls go out through the Sheets connector). What you type is authored: a sex, a name, a hatch, a status, an answer in Your Calls. It reaches canon (`canon/lineage.json`, a decision) when you tell Claude.

## The lineage tracker (`breeding/lineage.py`)

The studbook (`breeding/studbook.py`) says what each species can pass on; the lineage follows **individuals**.

- **Founders** (generation 0): the 36 companions. Sex open, fate open (D-037).
- **The planned pedigree**, derived from the breeding program under D-038. For each target line:
  - the father used (a journey companion when one fits, Milotic or Ampharos for example; otherwise a borrowed father who goes home);
  - a female of the line, who could be a companion if she's female;
  - any bred father in between (the Tyranitar line goes Kingdra → a bred Feraligatr → the stud);
  - the **stud** that's kept.
- **Authored records** in `canon/lineage.json` override a planned record field by field, or add new individuals (hatches).

**The rules every bred individual is checked against (Gen 4, the ranch era):**
- the parents exist;
- the sire can be male and the dam female, or one of them is Ditto;
- they share an egg group;
- the egg hatches as the dam's line (an incense baby needs its incense);
- each move inherited from the sire is an egg move of that line, and one the sire can know;
- the generation is one past the older parent;
- nobody is their own ancestor;
- a stud is male-capable and carries his line's whole program set.

Today: **63 individuals, 3 generations, no rule issues.**

## The Apps Script (`engine/appscript/`)

The Sheet works without it. Installed (Setup tab, two minutes), it adds:
- **The Blackthorn menu.** Go to the dashboard. **Show the lineage tree** for the selected Studbook row: the individual, sire and dam, grandparents and great-grandparents with their sprites, and every descendant. **Record a hatch**: pick the sire and dam, and the form works out the species and generation, checks the cross and adds the row; "add it anyway" is there, because it's your world (D-048). **Check the studbook**: writes the rule check into the Studbook.
- **The lock guard.** An edit to a locked row (HeartGold's six, D-006) is undone, with a note why.

The rules in the script are plain functions, tested with node against the Sheet's own data (`appscript/test_rules.mjs`). Egg moves need the learnsets, so the engine checks those.

## Still open (on the Your Calls tab)

The satellite (Sevii Islands or the Battle Zone), the D-038 reading, W-016 and W-017, the Day-Care's details, the companions' genders, which outside fathers become part of the story, Crystal's Fly, Platinum's Waterfall and Defog, Typhlosion's nature, and the SoulSilver six.
