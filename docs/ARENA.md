# The Arena: the 6v6 engine in the app (v1, D-077)

The 2K modes on Blackthorn's 6v6 engine (`sixvsix/`, D-071 to D-075): Showdown's Gen IV engine behind Blackthorn's
contract, with each trainer played as the Trainer Library reads them. Every call made building it is an item in
`docs/design/ASSUMPTIONS.md` (A-53 to A-61, A-73 to A-75), in Your calls, and on `#/v1`.

| 2K | Blackthorn | Where |
|---|---|---|
| Play Now | Any team against any team, 10 to 100 battles in mirrored pairs; win rate with its 95% interval; what each Pokémon did; every battle watchable, played again from its seed, with each decision's options and reasons | `#/arena` |
| "vs the '96 Bulls" | **Legends.** 45 all-time teams played against each other 8 times each (7,920 battles, made by the arena pack). The field is every Champion at their strongest, Red, the anime's teams, the all-time team and your six. There's a best of seven against any of them, played in order until one side has won. | `#/legends` |
| MyLEAGUE / MyERA | **Leagues.** Any teams in a round robin, with standings (pairings won, then win rate), head-to-head, league leaders, awards (MVP, the wall, the heavy hitter) and best-of-seven playoffs for the top four. | `#/leagues` |
| MyTEAM | **The Draft.** An era's Pokémon on the board, each with the build its strongest trainer used. You draft against five GMs whose two traits shape both their picks and how they battle, then the six teams play a league. | `#/draft` |
| MyGM / coach settings | **Your trainer.** The nine dials every library trainer is read onto, six coaching philosophies, and traits that name your style. They apply to your teams in every mode. | `#/trainer` |
| MyCAREER | The player card on every Pokémon of yours (`#/mon/<id>`) and the Hall of Fame | `#/halloffame` |

## How it runs

- `node sixvsix/cli/arena-pack.mjs` (the rebuild's `arena` step, after `app-data`) writes two files into
  `engine/app/data/`:
  - `sixvsix.json`: the battle-only browser build, as text the page loads on demand (2.8 MB; the full build with
    learnsets is 6.9 MB).
  - `arena.json`:
    - the legality of every team the page can field, checked by Showdown's validator in Node (393 teams);
    - your journey teams as the 6v6 Lab fights them (D-072's optimized spreads) and their lineup variations;
    - the Legends round robin.
- `engine/app/web/35_arena.html` (the `Arena` module) loads the engine and makes every side from the Trainer Library
  with the engine's own adapter (`teamFromLibrary`, `profileFromLibrary`), so a team in the page is exactly the team
  the pack checked.
  - A side is `pack:<key>` (your teams), `lib:<version id>` (any Gen IV version; `gen4:<id>` is a Gen II-III team
    under Gen IV rules, `sixvsix/src/adapters/convert.js`) or `mine:<team id>` (a team saved in My Teams).
  - A saved team is checked by the app's builder, which its result says.
- Battles run in Web Workers when the page allows them, and in the page when it doesn't (Apps Script's frame may
  refuse workers). A battle depends only on its job and its index, so the numbers are the same either way:
  `app/test_arena.mjs` plays the same job in the browser and in Node and requires the same fingerprint.
- `Library.setTeamEngine` is registered, so the Trainer Library's Benchmarks link to Team vs team, and each trainer
  profile has **Watch them decide** (criterion 6). That plays six battles against your HeartGold team with every
  decision logged, then counts their choices by kind (attack, switch, status, set-up, heal) and how often they took
  the option they rated best.

## What it records

Results you keep go to the **Arena** tab (append-only; turn it off on Play now). There is one row per match, series,
league, playoff or draft, with each of your Pokémon's numbers as `members` (team, battles, knockouts, damage, faint
rate). Careers and the Hall of Fame read it.

## The trainer ecosystem

`engine/trainers/ecosystem.json` holds 25 proposed anime versions outside canon. `trainers/model.py` reads them
beside `canon/trainers.json`, and canon wins any clash. They are:
- Ash at eleven moments in all;
- Gary and Paul at four each;
- Harrison, Tyson, Brandon, Barry, Nando, Zoey, Drake and Wallace;
- the anime's Cynthia, Lance, Brock and Misty.

Each has career records that give it its tags. Check it with `python3 -I engine/trainers/ecosystem.py --check`.

## Known limits

- The Legends field plays your teams on D-072's optimized spreads and everyone else on 85 EVs. That is part of why
  yours rank 1 to 3 (A-56); "even footing" is the alternative offered.
- The engine plays Gen IV. Gen II-III teams are converted (A-54).
- The cartridge's trainer items (Full Restores) and the Shift battle style aren't modelled
  (`sixvsix/src/rulesets.js`, CARTRIDGE_GAPS).
