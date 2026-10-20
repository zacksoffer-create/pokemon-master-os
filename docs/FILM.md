# The film room: Showdown replays, turn by turn (2026-10-20)

*Public Pokémon Showdown replays are game film: complete logs of real battles, every switch and every move, in order. The film room reads them exactly, with no model and no cost. It studies one player or a whole field, and turns what it can stand behind into cards for the intake inbox. Nothing reaches canon until it's approved (D-049, D-050).*

## What it reads from one battle (`film/log.py`)

**Each side keeps:**
- its members in the order they came in (the lead first);
- how many were never seen.

**Each member keeps:**
- **its build as revealed:**
  - moves in the order it first showed them, and how often it chose each;
  - the item it started with. A Trick reveals both starting items in the same action; a Knock Off, a berry or Leftovers reveals an item when it shows. The item it ends up holding is kept apart from the one it started with;
  - its ability, whenever a `[from] ability:` tag names it.
- **its stints:**
  - how it came in: lead, chosen switch, forced after a faint, pivot (U-turn), Baton Pass, or dragged (Roar);
  - the moves it used, in order;
  - how it left.
- **its record:**
  - knockouts, damage dealt and taken, and the turn it fell;
  - what it fell to. An Explosion is a self-KO, and the knockout it scores is credited to the exploder. A hazard knockout goes to whoever set the hazard; a Destiny Bond knockout to its user.

**Every chosen action is a row.** A move, or a switch the player picked, is recorded with the state just before it:
- Pokémon and HP left on each side;
- the game state: even, ahead or behind;
- who's on the field, the weather, hazards on each side, active boosts;
- what it did: damage, a knockout, a status, a boost, a hazard set or cleared, a miss, a crit, or the item it took.

**Game state** is read from the side about to act:
- ahead or behind by Pokémon left, first;
- when the count is level, a lead of a full Pokémon's worth of HP (unseen members counted healthy) decides it (`film/config.json` state).

**Chat is never stored.**

## What a study reads from many battles (`film/study.py`)

| Part | What it shows |
|---|---|
| Who plays | Each Pokémon's share of teams, win rate, leads, average slot, how often it's held back, closes, and knockouts per battle |
| Leads | Who leads, its win rate, its first move, and its opening sequence |
| Order | Who's held back (first in after half the battle), who closes (the last knockout, and with what), who's still standing, who's sent in last |
| Move order | Each Pokémon's first move each time it comes in |
| Builds | Revealed sets clustered into **variants** by what they share (moves, and the item). Each variant is read through the role engine and compared with the closest archetype in the library |
| Game state | Even, ahead and behind: the choices, switch rate, action mix (attack, hazard, setup, status, recovery, pivot…), top plays (counted once per battle) and aggression |
| Aggression | The playsheet's own finisher and attrition lists, applied to the moves actually chosen, so the measured ratio and a moveset's ratio mean the same thing |
| Under pressure | Who comes in after a faint and what it opens with; who they switch to facing what |
| Teams | Cores (two together, with win rate), the playsheet's combos seen on revealed teams, roles, team shapes |
| Habits | First hazard turn, how often hazards go up, self-KOs by game state, forfeits |

## Commands

```
python3 -I engine/film_room.py search --format gen4ou [--user NAME] [--tournaments] [--min-rating 1300]
python3 -I engine/film_room.py box gen4ou-2701283736          # one battle: teams in order, builds, how it went
python3 -I engine/film_room.py study --format gen4ou --count 150 [--tournaments] [--min-rating 1300]
python3 -I engine/film_room.py study --user NAME --format gen4ou   # one player's scouting read
python3 -I engine/intake.py film --format gen4ou --count 150 [--user NAME] [--trainer me]   # → a card
```

Smogon tournament games come back in the same search (ids start `smogtours-`). They have no ladder rating, but they're the highest level of play, so they pass any rating floor. `--tournaments` keeps only them.

## What a card proposes (`film/cards.py`)

- **Observations** in the Part 2 schema, as tallies:
  - `sample_size` is how many battles (or times) it was seen;
  - each cites up to three of the battles it happened in;
  - kinds: leads, held back, closers, after a faint, top plays per game state, switches facing a threat, the measured aggression ratio. Each kind is capped (`cards.per_kind`).
- **Builds:** variants seen in enough battles, with their generation, role read and an example replay. Moves no battle showed stay open.
- **Who it files under:**
  - your own Showdown name maps to `me` in `film/config.json` cards.players (or pass `--trainer me`);
  - other players file as `showdown:<name>`;
  - a field study files as `field:<format>`.

## Where it shows

Approved observations reach the playsheet's **On film** section, for the trainer and generation they belong to:
- the lead;
- who they turn to when even, ahead or behind, beside the team read's pick;
- the closer, beside the derived ace;
- who's held back, and who comes in after a faint;
- the measured aggression ratio. It's pinned on the aggression meter next to the offense slider and the moveset's own ratio.

## Limits

- **Recent battles only:** the search only reaches what Showdown keeps.
- **Spreads stay unknown:** a replay never shows EVs, IVs or natures. Smogon's monthly stats have those; see Later.
- **Short games tell less:** forfeits and short games show leads and builds but little game state.
- **Thin sets aren't read:** a set that showed fewer than two moves isn't read through the role engine; it's counted as too little seen.

## Later

- **Smogon's monthly usage stats** (smogon.com/stats, public data: spreads, natures, items, teammates, checks and counters) would fill exactly what replays can't show.
- **The same rows from anime battles:** the order a trainer sends Pokémon out, and what each did, read from episode pages. That's what the Bulbapedia batch is for.
