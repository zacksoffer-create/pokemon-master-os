# Scouting (D-043, D-046)

*"These are the teams I could have used on my journey… scouting reports with tendencies, like a Major League Baseball scouting report or an NFL call sheet."* And then: *"I don't want grades. More tendencies. And like philosophies. And how to attack them… certain numbers triggering certain phrases, the same way it happens in the game."*

The journey is over (D-042), so these read like a front office's file on clubs that already played. **There are no grades.** Every line is a phrase from the phrase book, triggered by a number the engine measured. It works the way the games turn a Pokémon's highest IV into "Likes to thrash about", or a champion's last Pokémon at half HP into a line of dialogue.

- **The page:** *Journey Scouting File* (`scouting_file.html`, a private artifact). It has a tab for each chapter plus the what-if league. Switch on **Show the triggers** to see which rule fired each line and the number that fired it. Rebuild it with `python3 -I engine/battle/scouting_report.py --page`.
- **The packets:** one markdown file per chapter, built from the same data: [Crystal](crystal.md) · [FireRed](firered.md) · [Emerald](emerald.md) · [Platinum](platinum.md) · [SoulSilver](soulsilver.md) · [HeartGold](heartgold.md).

## The phrase book: how numbers become sentences

The rules live in `engine/battle/phrasebook.json` as plain data you can edit. Each rule has four parts:
- **an id**, which shows as the trigger;
- **a section**, where the line goes;
- **conditions** on the engine's numbers, for example `speed_pct >= 0.65`;
- **the sentence**, with placeholders such as `{setup_str}`.

Rules fire in order. Some sit in a **group**, like a tier list, and only the first rule in the group that matches fires. That's how the games' own tables work: one characteristic per Pokémon, one speed line per report. A sentence with an empty placeholder never prints. To change how the file talks, edit a sentence. To change when a line appears, edit a threshold. To teach it something new, add a rule.

The numbers it reads:
- **Speed, power and bulk:** each is the share of its own generation's fully evolved Pokémon that it beats, so a Crystal Pokémon and a HeartGold one are read on the same terms.
- **The moveset:** which side its attacks come from (with Gen 3's type-based split, so Bite is special there), its setup, recovery, status, pivot, priority, phazing, recoil, lock-in, charge-up and low-accuracy moves, and its best hit.
- **The type picture:** what it hits super-effectively, what it can't touch, its holes and immunities.
- **Ability and item effects.**
- **Its record against the league.**
- **Its Pokédex entry** for that game.
- **For opponents, the game's own data:** the trainer's AI flags, bag and battle lines, read straight from the games' code.

## A scouting report (one of ours)

- **Philosophy:** how it wins, in one line. "Win on momentum: take one free turn for Dragon Dance, then everything goes through."
- **Tendencies:** its speed against its generation, where its damage comes from (and whether its nature undercuts it), its out pitch, how it holds up against physical and special hits, recoil and lock-ins, its item.
- **When it's ahead / when it's behind:** what it does with a free turn, and what it does when it's low: heal, pivot out, priority, or nothing.
- **Against types / against moves:** what it feeds on, what it can't touch, its holes, and how its ability bends things ("Thick Fat: Fire and Ice moves only do half").
- **How you beat it:** the Pokémon of its generation that hit it hard and take little back.
- **Production:** its 1v1 record against the league, turned into a line ("An anchor").
- **Makeup:** who it plays like, and its own Pokédex entry.

## A call sheet (one opponent)

The layout follows a pitcher's advance report:
- **One row per opposing Pokémon,** in send-out order.
- **Symbols in the margin:**
  - ★ swings first on most of your club
  - — has priority
  - ↑ sets up
  - \+ heals itself
  - P / S / M in a circle: physical, special or mixed attacker
- **Moves first:** how many of your six it beats to the first hit.
- **Holes:** your attack types that hit it super-effectively, circled.
- **Go-to plan,** in pen: the call, the backup, what it throws, what it does ahead and behind, and who to keep away from it.

Above the rows is the trainer:
- **Order:** their party in send-out order, and who to lead with.
- **Philosophy:** their best player and your last one standing, plus how the game's AI flags make them play.
- **The bag:** e.g. "4 × Full Restore".
- **What they say:** their battle lines, with the moment each one fires.

Below the rows, each of their Pokémon gets its own tendencies: order, speed against you, its go-to move against each of yours, ahead/behind, its ability, and how to attack it.

## The what-if league

This is the "what if Ash used everyone at their peak" question. Every journey team meets every other at Lv 100, under the same Gen 4 rules, with builds as recorded. A team's score is how many of the 36 one-on-ones it wins. It's a matchup read, not a simulated battle.
