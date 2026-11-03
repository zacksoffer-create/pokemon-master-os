<!-- Generated from lifeos/script.py (python -m lifeos.dialogue guide). Don't edit by hand. -->

# LIFE OS story scripts

Everything you add to LIFE OS (storylines, one-off scenes, texting lines) is a story script: plain text, like a screenplay. The game reads it, checks every line, and tells you what to fix by line number.

## The shape

```
=== Same Team
cast: bro = older brother, plays basketball, 3 years older, close
about: You and your brother on the same team for one season.
when: freshman-junior

--- The tryout list  [freshman · November · weekday]
The list goes up outside the gym. {bro} is already there.
bro: You're actually trying out? Coach'll eat you alive.
* "Watch me."               | confidence +, bro respect +
    bro: ...Alright. Don't embarrass me.
* "Help me get ready?"      | bro affection ++, basketball +
    bro: Driveway. Six a.m. Don't be late.
    remember bro_trains_you
* Shrug.                    | bro affection -

--- Six a.m.  [next day · if bro_trains_you]
bro: You're late. {Again.|Shocker.|Unbelievable.}
* Run the drill             | play basketball
    great: You hit nine straight. | bro respect ++
    good: Not bad.               | bro respect +
    miss: You airball the last one.
* "Five more minutes..."    | bro respect -
    bro: I'm telling Coach.

--- Cut day  [a week later · big]
The roster's on the gym door.
* Look for your name        | 60% +athletic
    yes: It's there. Second line from the bottom. | mood ++, remember made_jv
    no: It isn't.                                 | mood --, stress +
* Wait for {bro}
    bro: Come on. We'll look together.
    * "I can't."            | bro affection +, fits -confidence
        bro: Then I will.
    * "Okay."
        bro texts: proud of u either way
```

## Storylines

- `=== Title` starts a storyline. Its scenes play in the order they're written, each one waiting for the one before (as soon as it's ready: tags hold it to its season). `order: any` under the title lets them come in any order (good for a bag of one-off moments).
- `cast: <name> = <who they are>`: a specific person the storyline is about, the same person for the whole story (across storylines too: the same cast name means the same person). Who: brother, classmate, coach, ex, friend, older brother, older sibling, older sister, sibling, sister, teammate, twin, younger brother, younger sibling, younger sister. Then any of: `plays <sport>` (baseball, basketball, football, soccer, softball), `3 years older` / `2 years younger`, `girl` / `guy`, `close` (you start close), `from the start` (picked on day one, not at their first scene), and any words that describe them ("the one who got away").
- `when: <tags>`: tags every scene in the storyline gets (like `freshman-junior`).
- `about: <notes>`: what the storyline is about, for you and for ChatGPT.
- A scene in another storyline: `after Same Team: Cut day`.

## Scenes

`--- Title  [tags]` starts a scene. Tags (separate with · or commas):

- School year: freshman, sophomore, junior, senior, college freshman ... college senior, ranges like `freshman-junior`, or `high school` / `college`.
- Month or season: `November`, `Nov`, `fall`, `winter`, `spring`, `summer`. A day: `Oct 31`, `Halloween`, `Christmas`, `Valentine's Day`, `July 4th`. `after Nov 15` / `before Dec 20` for a window.
- Day: `weekday`, `weekend`, `school day`, `summer break`, or a weekday (`friday`).
- How likely on a day it can happen (one-off scenes): `rare`, `uncommon`, `sometimes`, `often`, `likely`, `always`, or `10%`. Storyline scenes don't need one.
- Repeats: scenes happen once; `repeats every 30 days` lets one come back.
- Order and gaps: `after <scene title>` (or `after <Storyline>: <title>`), `same day`, `next day`, `a week later`, `3 days later`, `a month later`.
- Facts: `if <fact>` / `unless <fact>` (a fact a choice remembered). Situations: `if dating`, `if single`, `if has pet`, `if has sibling`, `if plays sport`, `if in season`, `if injured`, `if grounded`, `if school day`, `if weekend`, `if summer`, `if in high school`, `if in college`.
- Feelings and stats: `if bro trust 40+` (how the scene's person feels about you), `if my affection 60+` (how you feel about them), `if stress 60+`, `if mood 20-`, `if gpa 3.5+`.
- The sports world: `if pro:<condition>`, like `if pro:my_team_in_playoffs` (your MLB team: baseball_season, october, my_team_winning, my_team_losing, my_team_in_playoffs, my_team_alive, my_team_missed, my_team_champs), `if pro:<league>:<condition>` with league nfl, nba, cfb, mbb, wbb, epl, laliga, seriea, bund, ligue1, ucl, cbase, msoc, wsoc and condition in_season, my_team_winning, my_team_losing, my_team_in_postseason, my_team_alive, my_team_champs, my_team_ranked (college). A what-if world: `if pro:whatif:harper_2019`.
- Who it's with: `with best friend`, `with crush`, `with older sister`, `with coach`, or a cast name. Without it, the first person who talks is who the scene is about. Kinds of people: best friend, brother, classmate, coach, crush, ex, friend, older brother, older sibling, older sister, partner, rival, sibling, sister, teammate, twin, younger brother, younger sibling, younger sister.
- How big: `small`, `regular`, `big` (a turning point), `finale`.

## People and lines

- A plain line is narration, in second person ("You...").
- `name: line` is someone talking: a cast name, `you`, `best friend`, `sibling`, `partner`, or the kind of person the scene is with (`friend:`, `coach:`). A capitalized name (`Mom:`, `Coach Reyes:`) is just a label.
- `{bro}` says a cast member's name; `{best friend}`, `{sibling}`, `{partner}`, `{me}` too. The game also fills in {ballon_dor}, {cfb_champ}, {epl_champ}, {mbb_champ}, {mlb_champ}, {my_cfb_record}, {my_club}, {my_college}, {my_mbb_record}, {my_nba_record}, {my_nba_team}, {my_nfl_record}, {my_nfl_team}, {my_team}, {my_team_record}, {my_team_star}, {my_wbb_record}, {nba_champ}, {nfl_champ}, {pet}, {school}, {sport}, {town}, {ucl_champ}, {wbb_champ}.
- `{a|b|c}` gives a line versions; the game rotates them so nothing repeats.
- A scene can involve your best friend, sibling, partner and anyone in the storyline's cast, plus the one person it's with.

## Choices

- `* <what you say or do>  | <effects>`. 1 to 4 per scene (none at all makes a "Continue"). Quotes for things you say.
- Lines indented under a choice play after you pick it. `remember <fact>` / `forget <fact>` on their own line work too, and `bro texts: <line>` sends you a text later that day. A line can end in effects too: `bro: Fine. | bro respect +`. (The scene's opening lines can't: effects only happen when you choose.)
- Choices indented under a choice keep the scene going: the lines right before them are the next beat. Up to five deep.
- Outcomes, indented under the choice: after `play <game>` write `great:`, `good:`, `miss:`; after a chance like `60% +athletic` write `yes:` and `no:`; after `vibe <style>` write `good:`, `meh:`, `bad:`. Each is a line, then | effects.
- `memory: <text> (good)` gives you a memory (good, great, bad, awful).

## Effects

Separate with commas. `+` small, `++` medium, `+++` big, `-` `--` `---` down, or a number like `+5`.

- How someone feels about you: `<person> affection +` (or trust, respect, attraction, rivalry, familiarity). `both` at the end for both ways; `my <person> affection +` for how you feel about them.
- You: `mood +`, `energy -`, `fun -`, `social -`, `stress -` (energy, social = not lonely, fun, stress).
- Traits: ambition, competitiveness, confidence, curiosity, discipline, empathy, impulsivity, loyalty, sociability, volatility (also confident, loyal, disciplined...).
- Skills: academics, art, baseball, basketball, drama, fitness, football, music, soccer, softball, sport, tech, writing (`sport` = your main sport). Interests: `into <x> +` with academics, art, baseball, basketball, batting_cage, coding, cooking, drama, fashion, fitness, football, gaming, guitar, journaling, music, outdoors, pickup_games, reading, shows, sketching, soccer, softball, sport, tech, writing.
- Reputation: `rep <tag> +` with athlete, embarrassed, flaky, gossip, host, legend, mean, performer, star, tough, troublemaker. Family: `family affection +` (you and every sibling).
- `play <game>`: `baseball` (a big at-bat, batting practice, a home run derby with friends); `basketball` (shooting around in the driveway, HORSE with a sibling, open gym, a dare from half court); `cup_pong` (a friend's basement, a party (beer pong in college)); `flash` (remembering a pattern, ear training in band, a memory bet); `football` (a goal-line stand at practice, a backyard game, a bet on one play); `golf` (a round with a parent, a golf outing, a bet on one hole); `hold` (a steady pour in chem lab, one brushstroke, a power throw in gym, holding a note (press, hold, let go on the line)); `lineup` (a timeline review, ranking things with friends, putting cards in order); `mathdash` (mental math with a friend, splitting a check, making change at a register job, counting atoms); `oddone` (proofreading a friend's essay, spot the difference, a typo on a sign); `paper_toss` (bored in class, the trash can across the room); `playmaker` (running the offense at the park, a pickup run where you have to find the open man); `reflex` (catching something falling, a reaction test, first hand up, a quick-draw bet); `soccer_11` (a pickup match, gym class, a game where your team needs a goal); `soccer_pk` (penalties at the park, settling an argument, a gym-class shootout); `sweep` (stopping a pendulum, hitting the beat, timing a jump rope, any "tap at the right moment"); `swing_lab` (the batting cages, a hitting lesson); `trivia` (a pop quiz, a study session, trivia night at a restaurant, a bet over who knows more); `sport` = your sport's game.
- `60% +charisma -impulsivity`: a roll on your talents (academic, athletic, charisma, creativity, technical) and traits.
- `vibe <style>`: bold, funny, sweet, cheesy, chill, tease (lands or misses by what they like).
- `focus <mode>` (academics, athletics, balanced, family, rest, romance, social), `hang out with <person>`, `text <person> "<line>"`, `fits loyalty` / `fits -discipline` (who'd pick this when the game picks for you; trait effects count too).

## Lines for the game's pools

A block is a header line and then one entry per line under it (until a blank line or the next header).

- `texts <pool>:` text messages. Pools: `invite` (A friend asks you to hang out); `invite_later` (A friend who asked while you were busy, texting to try again later); `invite_date` (Someone you're dating or into asks you somewhere, just the two of you); `after_good` (A friend, after a good hangout); `after_good_date` (After a good date); `after_awkward` (After a hangout that went badly); `u_ok` (A friend checks on you after something bad happened with {other}); `they_apologize` (Someone apologizes after a fight); `congrats_team` (A friend congratulates you on making {team}); `consolation_cut` (A friend, after you got cut); `congrats_award` (A friend, after you won {event}); `rumor` (A friend tells you people are talking about you); `chatter_partner` (Your boyfriend or girlfriend, a random sweet text); `flirt_in` (Someone with a crush on you flirts); `asked_out` (Someone asks you out (you answer yes or no)); `asked_to_dance` (Someone asks you to {event} (a dance)); `park_followup` (Someone you met at the dog park, about your dog {pet}); `team_pregame` (Team group chat the night before a game); `team_win` (Team group chat after a win); `team_loss` (Team group chat after a loss); `parent_pregame` (Mom or Dad in the family chat before your game); `parent_win` (Mom or Dad after your team won); `parent_loss` (Mom or Dad after a loss); `parent_made_team` (Mom or Dad after you made {team}); `parent_cut` (Mom or Dad after you got cut); `parent_award` (Mom or Dad after you won {event}); `parent_offer` (Mom or Dad after a scholarship offer from {college}); `parent_report_proud` (Mom or Dad after a good report card); `parent_report_worried` (Mom or Dad after a bad report card); `parent_grounded` (Mom or Dad grounding you); `parent_drafted` (Mom or Dad after you got drafted by {team}); `pet_adopted` (Family chat the day a new pet comes home); `pet_chores_set` (A parent confirming your pet chores ({chores})); `pet_you_forgot` (A parent: you forgot a pet chore ({chore_a})); `pet_you_forgot_strict` (A strict parent: you forgot a pet chore); `pet_sibling_forgot` (A parent: a sibling ({who}) forgot a pet chore); `pet_streak` (A parent: the pet's been happy because you've been on it); `pet_sad` (A parent: the pet's been moping); `pet_vet` (A parent: the pet went to the vet); `pet_reminder` (A parent reminding you about a pet chore); `sibling_home` (A brother or sister away at college, coming home); `sibling_leaving` (A brother or sister leaving for college); `sibling_chatter` (A brother or sister, random texts); `coach_starting` (Your coach: you're starting); `coach_bench` (Your coach: you're coming off the bench); `react_warm` (How someone answers your warm reply); `react_funny` (How someone answers your funny reply); `react_dry` (How someone answers your dry reply); `react_flirt_yes` (Someone who's into you, answering your flirt); `react_flirt_no` (Someone who isn't into you, answering your flirt); `react_plans_yes` (Someone saying yes to plans); `react_plans_no` (Someone saying no to plans); `react_parent` (Mom or Dad answering your nice reply); `react_parent_annoyed` (Mom or Dad answering an attitude reply); `reply_hey` (Someone answering your 'hey' (they're glad you texted)); `reply_hey_dry` (Someone answering your 'hey' (meh)); `first_hey` (YOU, texting someone first: just saying hey); `first_hang` (YOU, asking someone to hang out ({place} available)); `first_flirt` (YOU, flirting first); `first_good_luck` (YOU, wishing someone luck before their game); `first_congrats` (YOU, congratulating someone); `first_sorry` (YOU, apologizing); `chatter_plans` (A friend, random text about plans (reply set: chatter_plans)); `chatter_school` (A friend, random text about school (reply set: chatter_school)); `chatter_vent` (A friend venting (reply set: chatter_vent)); `chatter_funny` (A friend texting something funny (reply set: chatter_funny)); `chatter_game` (A friend texting about a game (reply set: chatter_game)); `parent_first_day` (Mom or Dad, the first morning of high school); `friend_first_day` (A friend, the first morning of high school); `hang_talk` (IN PERSON: something they say while you're hanging out at {place} (shows in the story feed)); `date_talk` (IN PERSON: something they say on a date at {place}); `chat_talk` (IN PERSON: something they say when you stop and talk (hallway, lunch, practice)); `awkward_talk` (IN PERSON: something they say when a hangout or date is going badly).
- `replies <set>:` buttons you can answer with, each ending in its tone: `on it (warm)`. Sets: `warm`, `awkward`, `support`, `apology`, `thanks`, `rumor`, `chatter_plans`, `chatter_school`, `chatter_vent`, `chatter_funny`, `chatter_game`, `partner`, `flirt`, `sibling`, `generic`. Tones: `warm` (friendly); `funny` (makes them laugh); `vent` (honest about how you feel); `thanks` (grateful); `forgive` (you let something go); `flirt` (flirty); `dry` (short and flat); `cold` (shuts them down); `sibling_warm` (brother or sister only: affectionate); `sibling_tease` (brother or sister only: teasing).
- `narration <key>:` story-feed lines, like `narration study.focused:` (keys: study, practice_skill, hobby, rest, hang_out and more, each `.focused` / `.distracted`).
- `mods <open|close|talk> <tag>:` openers ("ok so"), closers ("lol") and ways of saying things ("{them_first} {says}, grinning"), for a context: morning, afternoon, evening, late_night, school_day, weekend, summer, high_school, college, new, friend, close, crush, partner, ex, rival, family, parent, sibling, coach, teammate, happy, down, stressed, tired, hurt, you_happy, you_down, you_stressed, from_guy, from_girl, to_guy, to_girl, guys, girls, same_year, older, younger (join with +: close+guys).
- `chat <path>:` texting conversation lines, like `chat reply.greet.warm:`, `chat topic.school:`, `chat people.older_brother.reply.greet.warm:` (lines for one kind of person), `chat ask.general:` (each ends with what it asks: (yesno), (doing), (day), (weekend), (open) or (flirty)).
- `trivia <subject>:` `Question? = right answer | wrong | wrong | wrong (grade 10)`. Subjects: english, biology, chemistry, physics, us_history, world_history, government, spanish, health, art, music, tech, psychology, economics, general.
- `choices <moment>:` more `*` choices on one of the game's own moments (like `choices rumor:`).

## Retiming scenes

`schedule:` (a line on its own inside a storyline) and then one line per scene to retime, from any storyline: `Same Team: Cut day [sophomore · March · after Prom night]`; `[replace]` replaces its after-links, `[skip]` retires it.

## Writing well

- Real people, real voices: short lines, specific details, how teenagers actually talk. PG-13.
- Every choice should feel different and matter a little. Use `remember` and `if` so later scenes answer earlier choices.
- Let scenes breathe: a couple of lines of setup, talk that goes back and forth, a beat or two deep where it matters.
- Use versions `{a|b}` on lines that come back, and the mini games where they fit.
- `//` starts a comment the game ignores.
