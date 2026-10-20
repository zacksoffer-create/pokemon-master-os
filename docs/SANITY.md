# Engine audit (2026-10-20)

*`engine/sanity.py` holds the engine's numbers and rules against outside references: Smogon's damage calculator, the games' data, the Showdown protocol and Smogon's own printed statistics. A check that fails is a bug to fix, not a line to reword. The fixes from the first audit are E-037 in DECISION_LEDGER.md.*

| Check | Compared | Problems |
|---|---|---|
| Stats against Smogon's calc | 9,240 | none |
| Known facts (sanity.json) | 37 | none |
| Legality: library, teams, builds book | 605 | none |
| Film: rules on every cached replay | 850 | none |
| Usage: our reading against Smogon's moveset file | 358 | none |

## Stats against Smogon's calc

9,240 stat lines compared (0 the calc couldn't name).
- Everything holds.

## Known facts (sanity.json)

- Everything holds.

## Legality: library, teams, builds book

- Everything holds.

## Film: rules on every cached replay

What every faint was put down to: by a foe 5409, self: Explosion 595, Sandstorm 180, psn 101, self: Self-Destruct 63, brn 41, Life Orb 31, Recoil 20, self: Healing Wish 13, Hail 13, Leech Seed 9, confusion 3, Black Sludge 3, self: Lunar Dance 3, Curse 1, Perish Song 1, self: Memento 1, self: Curse 1.
- Everything holds.

## Usage: our reading against Smogon's moveset file

Formats: gen2ou 2026-09 1630+, gen3ou 2026-09 1630+, gen4ou 2026-09 1630+.
- Everything holds.
