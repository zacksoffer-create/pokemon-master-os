# LIFE OS · Living World Laboratory (v0.1)

A persistent small-town life simulation with a lab built around it. The town is Guilford, Connecticut:
Guilford High School (the Grizzlies, Southern Connecticut Conference), its students, staff and their households. Every person decides for themselves what to do,
twice a day, from a transparent utility model. You can watch, inspect any decision down to the
random roll, change the rules, run controlled experiments, and step into one person's life.

**Story mode** is the playable side: build yourself, your family and the people you want in your life,
let the town fill in around them, and live seven years, from the first day of freshman year through
three years of college and the MLB Draft (or work). It has a full sports career in football, basketball and baseball:
JV and varsity, starting spots, box scores, season stats, awards, injuries, recruiting, offers from real
colleges (UConn, Stanford, UCLA, LSU, UNC, Texas, Oklahoma, Florida State, Miami, Michigan) and the draft.

Everything here runs locally. No paid APIs, and no AI-generated text: the narrative comes from
procedural templates filled in from recorded simulation state.

## Run it

### The easy way (no typing)

1. Install Python from [python.org/downloads](https://www.python.org/downloads/). On Windows, tick **"Add python.exe to PATH"** on the installer's first screen.
2. Unzip the LIFE OS folder (on Windows: right-click the zip, then **Extract All**; don't run it from inside the zip).
3. Double-click **`Start LIFE OS (Windows).bat`** or **`Start LIFE OS (Mac).command`**.
   - Windows may say "Windows protected your PC": click **More info**, then **Run anyway**.
   - Mac may say it's from an unidentified developer: right-click the file, choose **Open**, then **Open** again.
4. The first time, it spends a minute or two setting up (needs internet). After that it starts in a few seconds.
   Your browser opens to the lab. Keep the black window open while you use it; close it to stop.

Don't open the Python app itself and paste commands into it. That window only understands Python code.

### The command-line way

You need **Python 3.10+** (tested on 3.13 and 3.15). Node is only needed if you want to change the interface (the built UI
is committed in `frontend/dist`).

```bash
cd lifeos
python -m pip install -r requirements.txt
python run.py                 # opens http://127.0.0.1:8765
```

Options: `--port 9000`, `--no-browser`, `--fresh` (ignore the autosave and start the demo world over).
The world autosaves to `lifeos/var/lifeos.db` (SQLite). Set `LIFEOS_DB=/path/to/file.db` to use another database.

**Changing the interface:**

```bash
cd lifeos/frontend
npm install
npm run dev      # http://localhost:5173, proxies /api to the Python server on 8765
npm run build    # rebuilds frontend/dist
```

## Your story (start here)

Open **My Story** in the sidebar and click **Start your story**. The setup has six steps:

1. **Welcome.** Name your story.
2. **You.** The character builder. Pick a starting archetype (athlete, brain, artist...) and it fills
   in a believable person, then tweak anything:
   - personality (10 traits), natural talent (5 aptitudes) and what drives them (6 motives);
   - interests and starting skills (a typical freshman is 25–50 in a sport);
   - height and build, jersey number, and a position in each sport you play.
3. **Family.** Your last name, guardians, how they parent, income and a pet (or no pet). Add siblings
   with a grade each; set "twin of" to make twins (same birthday, a twin bond).
   There are one-click buttons for an older brother who's a senior and twin sisters a year older than you.
   **Younger siblings** (6th, 7th or 8th grade) live at home in middle school and start high school as freshmen
   1, 2 or 3 years in.
4. **Your people.** Friends, a crush, a rival, a coach, anyone (up to 120). Each one gets the same builder, plus
   how they feel about you (best friend, crush, rival, teammate...). **Future freshman** makes someone younger,
   like the neighbor kid: pick **Next year**, **In 2 years** or **In 3 years** and they show up with that year's
   freshman class, taking one of its spots.
   Anyone besides you can also get a set path for after high school, like "play basketball at UConn":
   the offer shows up senior spring and they take it. Siblings have a quick dropdown for this on their card.
5. **The town.** How many students per grade (6–40). Generated classmates fill each grade around your people.
   Teams and casts grow with the school (past 12 a grade), so making varsity is about as hard at any size.
   12–20 plays smoothly on a phone; past 30, a day takes a few seconds there.

**Every fall, a new freshman class.** On Sept 1 everyone moves up a grade, the seniors are gone, and a freshman
class about the size of the one that graduated comes in. The people you made for that year come in with it: it's in
your feed ("Your little brother Sam starts at Guilford High School as a freshman."), your family and friends among
them text you, and every relationship you set up for them (your best friend's best friend, your neighbor) starts
that day. Until then, younger siblings show on the Home tab with their grade.
6. **Review & start.** Check catches every problem at once. You can also download your cast as a file
   and load it again later, so you don't have to rebuild your people.

**Playing.** The story page shows where you are in the seven years, how you're doing, your teams and
stats, your family and your people.
- **Live until something happens** runs the world until there's something for you: a story moment
  (tryouts, getting cut, an injury, a scholarship offer, a sibling leaving for college, someone asking
  you out, the college decision), an invitation, or a big event.
- **Next choice** stops at your very next decision so you can pick exactly what you do. You see every
  real option and how likely you'd be to pick it on your own.
- **Focus** (athletics, academics, social, romance, family, rest, work) tilts what you do when you
  let yourself decide. It's a named term in every decision trace, so you can see how much it mattered.
- At any choice, **Let them decide** hands it back to the simulation.

**Your day on the phone.** The Story tab opens on today at a glance:
- **The day strip:** every part of today (morning, class, lunch, after school, evening, night). What you already did
  ("w/ Danny", "studied"), where you are now, and what's coming: practice, a game, a quiz, a plan you saved, or open time.
- **On your plate:** everything that needs you, from every corner of the game, in one list. Texts waiting on an answer,
  your pet chores, a test or game today or tomorrow, tryouts coming up, a dance you don't have a date for, a close
  friend's birthday, friends you haven't talked to in a week or more, and running on empty. Tap one to go handle it.
  When there's nothing, it says **You're all caught up**.
- **This week:** the next seven days with your games, tests, dances, tryouts, breaks and birthdays. Tap a day to see it.
- **What do you do?** is sorted into **Should** (practice, a shift, studying with a test tomorrow, your chore), **Want
  to** (the friend who asked, your partner, someone you're drifting from, a crush) and **Could** (everything else). Each
  choice says why it's there: "Quiz 1 tomorrow", "Coach takes attendance", "10 days since you talked". Choices that can
  wait have **Save for after school** or **Save for evening**: it's picked for you then, unless someone pulls you into
  something else first.
- **Invites never overrule you.** When you've made your own pick and a friend asks you to hang out in that same part of
  the day, the game doesn't answer for you: they text you to try again later ("saw you were busy. later this week?") and
  it's yours to answer. Plans you've said yes to show what and with whom: "Hanging out with Danny, next time you're free".
- **Game day: your game comes first.** In the part of the day your game (or your show) is in, **Play in your game vs
  Branford** sits at the top of Should. Everything else in that slot says **You'd miss your game**. A saved plan or a
  yes to an invite waits for your next free time instead of taking the game slot. If you skip it anyway, the team plays
  without you, and you're told: "You missed the game. Guilford Football lost to Branford, 14-21." On the Me tab, a team
  shows its record, and yours (**you 1-0**) under it when you've missed a game or joined after the season started.
  A game is only ever played once, even if a slot runs again after a reload.

Everyone else lives their own life the whole time. Your brother graduates and leaves, your sisters
go off to college a year later and come home for Thanksgiving, friends drift, rivals show up. Siblings
playing college sports somewhere else still get season stats on their page.

**Grades matter.** GPAs run on a real 4.0 scale (most kids land around 3.0–3.3). Every program has a GPA it
needs from recruits: the NCAA minimum is 2.3, and Stanford wants a 3.4. If your GPA is under it at
senior spring, the offer gets pulled. Regular admission to the big schools is hard (Stanford is a long shot
even with a 4.0). Southern Connecticut State and Gateway Community College are there as local options.

**Recruiting is earned.** Each college has a program strength per sport (LSU baseball, UConn basketball and
Michigan football are the top of the list). The stronger the program, the better you need to be before
they offer. In senior spring you pick your path from the offers and admissions you've earned. On September 1
you arrive at college (teams, a roommate, new classmates, real conference opponents) or start working in town.

**The draft.** If you play college baseball, the Sports tab gets an MLB Draft board with your projected round
and why. The draft is in mid-July after your junior year: 20 rounds, real MLB teams, approximate slot values.
If you're picked, you choose: sign and start pro ball, or go back for senior year. That's the last chapter,
and the story closes with a look back at your seven years.

You can open anyone in **Character Studio** (including yourself) to see their full profile and athlete
page, and **History Explorer** shows the math behind anything that happened.

## Play on your phone

**The lab is your dashboard; your phone is where you play.** The phone app, *LIFE OS: Story*, runs the whole
game on the phone itself: no computer, no server, no monthly bill, and it works offline after the first visit.

**Install it (once):**
1. Open **https://zacksoffer-create.github.io/pokemon-master-os/play/** in Safari on your iPhone (or Chrome on Android).
   The lab's **Play on Your Phone** page shows the same link as a QR code.
2. Tap **Share → Add to Home Screen**. It gets its own icon and opens full screen.
3. The first launch downloads about 12 MB (the game engine). After that it starts in a few seconds.

**Make your story right in the app:** tap **Create my story**. Seven short steps, built for your thumb:
1. **You:** name, who you're into, birthday, your color.
2. **Your look:** every option shown as a portrait.
3. **Who you are:** your type, plus sliders for personality, talent and drives.
4. **Sports:** play, maybe, or not, with position, day-one skill, height, build and jersey.
5. **Your family:** parents, how they parent, money, and a pet (dog, cat or rabbit, with name, breed and coat).
   Siblings are one tap each (older brother, older sister, twin sisters, twin brothers, your twin), and each one's
   after-high-school path can be set (say, UConn basketball).
6. **Your people:** best friend, crush, rival, teammate, coach.
7. **Ready:** look it over and start.

Problems get checked before you start, and tapping one takes you to the fix. Anything you skip gets generated. Your draft
saves on the phone as you go, so you can stop halfway. Siblings left on auto get your skin, hair and eye color
(with natural variation) when you've picked your look. **Save as a cast file** on the last step sends the whole cast to
the lab, and **Load a cast file to edit** brings one back.

**Or bring people from somewhere else:** build them in the lab (My Story → Start your story) and click **Download cast**,
or fill in the Excel worksheet, or use ChatGPT's JSON answer. Send the file to your phone (AirDrop, email, iCloud Drive)
and tap **Load a cast file or backup**. Or tap **Try a sample story**.

**Your story lives on your phone.** It saves by itself. **Me → Back up my story** saves a `.lifeos` file
(to Files, iCloud, AirDrop). To look under the hood, import that file in the lab under **Saves & Worlds**, load it, and
the whole history, every decision and the math behind it are there. A lab save loads on the phone the same way.

**How it works:** the same Python engine, compiled for the browser (Pyodide), runs in a background worker on the phone.
The phone screens talk to it exactly as they talk to the server on a computer. Saves go to the phone's own storage.
To publish an update: `python lifeos/tools/build_phone_app.py`, then commit the `docs/play/` folder (GitHub Pages serves it).

**Turning on the free hosting (one time):** on GitHub, open the repository's **Settings → Pages**, set **Source** to
*Deploy from a branch*, pick the branch with the app and the **/docs** folder, and **Save**. The link works a minute later.

### Or play over your Wi-Fi

If you'd rather keep the story on the computer (one world shared with the lab), double-click
**`Play on Phone (Windows).bat`** / **`Play on Phone (Mac).command`**, scan the QR code with your phone on the same Wi-Fi,
and keep the computer on while you play.

What's in it:
- **Story.** Where you are and what's happening right now, drawn as a scene, and what you do about it. Choices are worded like
  life ("Sit with Danny", "Take Buster to the park"), and outcomes come back in first person with what changed ("Danny +4, Energy −6").
  **Continue** goes to your next choice; **Skip ahead** lives until something happens.
- **Phone.** Your texts and contacts inside the game. Friends text you after a good hangout, the team chat lights up before games,
  your family chat has opinions, people ask you out by text, invitations arrive as messages, and you can answer or text people first.
- **Texting goes back and forth.** In a one-on-one chat you can **type anything**, or tap a suggestion (each has a little
  tone icon: 💬 ask, 😂 joke, 😏 flirt, 📅 plans, 🤝 check on them, 👋 bye). They answer like themselves and often ask you
  something back. What you type is read for what you're doing (hi, a question, a joke, a compliment, flirting, plans,
  checking on them, sorry, dry, rude, bye) and how much effort it shows; it doesn't understand every word like a person
  would. A conversation has energy: more if they like you, they're social or they're into you, less if they're stressed.
  Good messages give a little back, dry or rude ones drain it, and when it runs out they wrap it up ("gtg, ttyl"). Texting
  again right then gets you left on read. Ending it yourself on a good note helps. A typed "yeah i'm down" answers an invite.
  A day of texting one person can only move things so far, so spamming doesn't farm friendship.
- **Flirting you can read.** Every flirt, by text or in person, tells you why it went the way it did ("Landed: they were
  already into you and you'd built up to it." / "Awkward: they barely know you yet. Talk and hang out first."). It comes
  down to five things: **closeness** (do they know and like you), **interest** (are they into you), **the moment** (their
  mood, stress, how the conversation's going), **pace** (talking, joking around, a light flirt, then asking out) and
  **you** (confidence, charm, effort). Asking someone out over text gets "ask me in person 😳" when they're into you.
  Each person's contact page has **You and them**: where you are (strangers, know each other, friendly, flirty, talking
  stage, dating), your read on whether they're into you (once you know them a little), the signals behind it (texted you
  first, asked about you, laughed at your jokes, flirted back, short dry answers, left you on read, flirting in person),
  what to try next, and **How flirting works**. Flirt and ask-out choices say how risky they are ("Seems into you",
  "Risky: you barely know them").
- **Conversations hang together.** When they ask you something ("you going to the game friday?"), the suggestions answer
  that question (yes / no, what you're up to, how your day was), and a typed "yeah" counts. Bring something up (the game, a
  test, music, the weekend, food) and they answer about it; mention a test or a game and they follow up a day or two later
  ("how'd the test go??"). Someone into you answers fast, sometimes double-texts, and the chat header shows where you two
  are ("Flirty · Seems into you").
- **People are different.** Teasing, sweet stuff, being direct, making them laugh and cheesy lines each go over differently
  depending on the person's personality: everyone loves one or two and isn't into a couple. You find out by trying, and
  their contact page keeps track under **What works with them** ("Teasing: they love it", "Cheesy lines: not into it",
  "Being direct: not tried yet"). Flirt suggestions offer a style you know they love, or one you haven't tried. Teasing
  with a 😂 is teasing; the same words without it are rude.
- **From text to in person.** When you ask someone out by text and they say "ask me in person 😳", the game plans it
  ("Asking Sophie out, next time you see them"), and they meant it: they'll say yes when you do.
- **Dating takes showing up.** Go a few days without talking to your partner and it shows: "Feeling distant: 5 days since
  you talked" on their page, "Sophie misses you" on your plate, and they text you about it.
- **Hanging out plays out.** When you pick a hangout, a date or the crew, a quick scene comes up with one choice: Danny
  dares you to jump off the dock, the diner's empty and Kira wants you to rate her placemat art, it starts pouring on the
  walk home, an inside joke is born. Each choice is a style (teasing, sweet, being direct, funny, cheesy, or play it safe),
  and how it goes depends on what that person likes, the same tastes you learn by texting. The choices show what you already
  know ("Teasing · Kira is not into it"), and the result says why ("Kira loves you being direct."). 16 scenes for friends,
  dates and the crew, never the same one twice in three weeks, at most one a day.
- **Hang out with the crew.** One choice, your two or three closest friends at once ("Hang out with Danny, Kira and Theo"):
  everyone gets closer, to you and to each other.
- **No wasted afternoons.** When you make a plan you ask first, so your friends aren't already booked. If your pick passes
  anyway, you hang out with someone else who's free ("Danny passed, so you hung out with Kira instead"); with the crew, the
  rest of the crew steps up. Other people's invites go to your texts instead of cluttering what just happened.
- **Your free time is clear.** A school day is morning, class, lunch, after school, evening, night. If you're on a team
  (or in the show) and it has practice or a game, after school is that: it isn't a choice, you just go (games on
  weekends too). Your free time is lunch and the evening, and the whole day on weekends. Each one says **Free time,
  Tonight: pick one thing**, sorted into **With friends** (the crew, hangouts, a date, lunch tables, family), **On your
  own** (homework, training, hobbies, rest, your pet) and **Go somewhere** (parties, games to watch, sign-ups); the
  drama (pranks, gossip, sneaking out) is under More options. Anything that needs you (homework before a quiz, a chore)
  has a **needs you** tag. **Texting doesn't use up your time**: text anyone, anytime, from the Phone tab, so "Message
  someone" isn't one of your choices anymore. Plans made by text fill your next free time and show at the top.
  Prefer not to pick every lunch? Turn on **Lunch on autopilot** on the Me tab (you sit with your usual table).
- **Your group.** The friends you actually spend your time with become your group on their own: **the boys**, **the
  girls** or **the crew**, from your closest friends, changing as friendships do (it's on the Me tab, with how tight you
  are and when you last hung out). In your free time it's one choice for what you'd really do: **Hop on the game with
  the boys**, **Park with the boys**, **Shoot around**, **Food run**, **Movie night at Danny's**, **Beach day** in the
  summer, **Homework on FaceTime** on school nights. Whoever's free comes (not whoever's at practice), it reads like
  what it was ("Three hours online with the boys. You lost more than you won and it didn't matter at all."), and a scene
  that fits often follows (game nights get their own: the hot mic, the last one alive, the rage quit, the little brother
  who grabs the controller). Some days they make plans themselves ("on at 8?" / "bet"): it's on your plate and first in
  your choices then. Join or skip; skipping now and then costs almost nothing, you just hear what you missed. **Zero
  maintenance:** their group chat is there to read, never needs an answer and never shows as unread.
- **Pets don't use up your time.** Feeding, walks, the park, playing, training, cuddles, treats, brushing and the bath
  (or the litter box, or the cage) are all quick taps on the Home tab, anytime. They're not in your free-time choices
  anymore. Your chores show on your plate with **Do it**; skip one and it usually still gets done (you mostly remember).
- **A mix up front.** The first choices in each section are one of each kind before a second "Sit with someone"; the rest
  are under More options.
- **More to text about.** Vent ("my day honestly sucked") and someone close has your back: your stress comes down, and you
  can thank them (once a day is support; more than that wears on people). Share good news ("i made varsity!!") and friends
  hype you up. Gossip ("did you hear about...") and some people want every detail while others aren't into it. And when
  you two just did something together (a hangout, a date, the boys, a game you won or lost), they bring it up when you
  start talking ("today was actually so fun"), once.
- **Your storylines' people text like themselves.** A pack's chat lines can belong to a kind of person (`older_sibling`,
  `crush`, `coach`, `best_friend`...): those people use their own lines first, so your brother texts like a brother and
  your coach like a coach. Every pack you made has an **Upgrade its texting** button (phone and lab) that copies a prompt
  with the pack in it: ChatGPT gives that storyline's people their own replies, questions, follow-ups, flirts by style and
  more, and the answer replaces the old pack. The prompt is also in `docs/dialogue-texting-prompt.md`.
- **Storylines play as stories.** Every pack you made plays as a storyline: its scenes come as chapters, in the order
  they're written, a few days apart (a chapter that can't happen yet waits, and the story moves on). Scene cards say where
  you are ("Big brother season · Chapter 3 of 8"), and the pack list shows what's next. Turn **Play in order** off on a
  storyline to let its scenes come up in any order. Storylines can now have scenes that keep going (a choice with `then`
  continues the scene right away, up to three decisions deep), choices that matter later (`remember` a fact, and a later
  chapter only happens on that path), and style choices (`vibe`: teasing, sweet, direct, funny, cheesy) that land or miss
  by what that person likes. **Build it out** on each storyline copies a prompt with the storyline in it: ChatGPT turns it
  into a real arc with at least 8 chapters, branches and two endings, scenes that keep going, style choices, mini games and
  its people's texting. Storyline scenes also come more often now (one every couple of days across all your storylines).
- **One big story, in episodes.** Your seven years play like a show. Each school year is a season, and every big thing
  that happens to you is an episode, numbered in the order it aired: your storylines' chapters and the game's own big
  moments (the first day, tryouts, getting asked out, the college decision). Hangouts and quizzes are the days in between.
  Scene cards say "Season 2 · Episode 6" with the storyline under it; the first episode of a year is the premiere and the
  year in review is the finale. When a storyline picks back up, its episode opens with **Previously**: what happened last
  time and what you chose. **Episode guide** (Me tab) lists every season and episode with what you chose, and what's coming
  up in each storyline. **Make it one story** (dialogue packs) copies a prompt with all your storylines in it: ChatGPT sends
  back a **Season plan** pack that schedules every episode across your seven years (`schedule`: years, which episodes from
  other storylines come first, how long after) and adds crossover episodes that tie storylines together. A storyline's
  chapters now come at least 5 days apart (about weekly, like episodes), woven together with the others.
- **Storylines keep their people.** When a storyline is about "an older sibling" and you have more than one, it picks the
  one it's clearly about (a basketball story that says "he" and "his" gets your brother who plays basketball) and keeps
  them for every scene and every text after that. Open a storyline in your dialogue packs and **Who it's about** shows who
  it picked; change it anytime. Packs can also name `brother`, `sister`, `older_brother`, `older_sister`, `younger_brother`
  and `younger_sister`, and the upgrade prompts tell ChatGPT to use those.
- **Packs can add texting lines.** A dialogue pack's `chat` section adds to how people answer, what they ask back,
  follow-ups and flirt lines by style. The pack prompts ask for them, and the checker explains any mistakes.
  People can leave you on read. Contacts show how you feel about everyone and how they *seem* to feel about you (your read, not the truth).
  You only have someone's number once you've actually hung out or gotten close.
- **Home.** Your family and your pets. A pet is a real animal with needs, moods, a bond with each person and tricks to learn.
  The first time, you decide once who handles each chore (breakfast, dinner, walks, baths...): you, a sibling, your parents, or taking turns.
  After that the chores happen every day; forget yours and the pet (and your parents' group texts) let you know. The pet menu:
  cuddle, treats, feeding, brushing, walks, the park (you run into people there), play, teaching tricks. No pet? Ask your parents.
  Their answer depends on how they parent, money at home, your grades and how much they trust you.
- **Me.** Your stats, grades, teams, the seven-year timeline, your focus and when the story should stop to ask you.

## Big nights (parties and dances)

Going to a party, throwing one, or going to Homecoming, the Snow Ball or prom isn't one tap anymore. The night plays out as
four short scenes on the Story tab ("Mike's party · 2 of 4"), built around who actually showed up:

- **The opening:** walking in (find your friend, work the room and meet people, go looking for your crush, people-watch),
  hosting your own (play host, let your friend run the door, guard the furniture), or getting ready for a dance (photos
  with your date and your family, or the whole group crammed into one room).
- **Two things in the middle**, picked from who's there:
  - **Who do you end up with?** your crush, your partner or date, your friend, your rival, or someone new;
  - **Cups on the table** (you play cup pong; beer pong in college);
  - **Your crush alone on the porch** (talk, and maybe kiss, and maybe it turns into dating);
  - **Your rival** looking for trouble (laugh it off, get in their face, walk away);
  - **Two people about to fight** (step in, film it, stay out of it);
  - **A secret:** someone pulls you into the hallway with a real crush ("Jordan has a thing for you. Like, a real
    thing."); keep it, spread it, or dig;
  - **Your partner** talking to someone else a little too long (join them, trust it, pull them aside).
  - At a dance it's always **the dance-off** (you play it: tap on the beat), and with a date or your crush there,
    **the slow song**.
- **The end of the night:** the after-party (sometimes the kitchen light is on when you sneak in), a ride home with your
  friend, walking your crush or your date home. If the cops show up, that's how it ends: run, act normal, or help the host
  hide everything.
- **It does real things:** people you meet get your number, friendships and crushes move, a great moment can become a
  kiss and a kiss can become dating (and a rumor), a bust or a missed curfew means your parents find out.
- **The recap:** "Your night: stuck with Danny, won at cups, laughed off Cole, and hit the after-party." It's saved as a
  memory, and the night is one episode in your episode guide.
- Skipping ahead? Your character plays the night for you.
- Writers: every scene, choice and line is in `backend/data/nights.json`.

## The editor (change anyone, anything)

For setting your world up exactly how you want it, or fixing something later. It's **on when a story starts**, and
**Me → Editor** turns it off (and back on whenever you want).

- **Where:** the Story tab shows **Set your world up** for the first week; the Me tab has an **Editor** card (**Edit
  anyone**, **Edit me**); and every contact page gets an **Edit** button while it's on.
- **Everyone list:** search anyone by name, or filter to your people, your family, your grade, or everyone in the world.
- **A person:** name and bio, look, personality (all ten traits), talents, what drives them, skills, interests, and how
  they're doing right now (mood, energy, social, fun, stress, popularity, GPA, money). Change as much as you want, then
  **Save changes** (or **Undo**). Works on you too.
- **Any two people:** **You and Danny** on a person's page, or tap anyone in their people list, or **Someone else…** to
  pick any pair. Set both sides separately (how Danny feels about you, how you feel about Danny): closeness, attraction,
  trust, respect, rivalry, how well they know each other. Or one tap: strangers, friends, close friends, best friends,
  one-way crush either way, like each other, dating, exes, rivals, can't stand each other, looks up to.
- **Dating is real:** setting two people to dating ends whoever they were with before, and setting them to anything else
  ends it between them. Attraction past 55 is a crush (and they're into that person's gender from then on).
- **Quiet:** edits don't send texts, make news or fill your feed. Labels (friend, best friend, rival) and crushes just
  update to match. Each save is one small entry in the lab's History, so you can see what was changed.
- Everything is checked before anything changes: if one value is off, nothing is saved and it tells you which.

## Plan your characters first

Open **My Story → Start your story**. The first step has a **Want to plan it first?** panel:
- **Excel worksheet**: one column per person, every field explained, dropdowns for every choice, a Reference tab with every type,
  trait, position, college and relationship. Fill in what you know; blanks are generated. Load the filled file with **Load a cast file**.
- **Copy the ChatGPT prompt**: paste it into ChatGPT or Claude and it interviews you about each person, explains the numbers, and gives back
  a cast file. Save its JSON answer as a `.json` or `.txt` file and load it the same way.
- Copies are also in `docs/character-worksheet.xlsx` and `docs/character-worksheet-guide.md`.

## Classes, quizzes and mini games

**Classes:** every school year you get a real schedule: English, math, science, history, a language, PE, and an elective
that follows your interests. Strong students get honors and AP versions (Honors Geometry, AP U.S. History, AP Calculus AB...),
and every class has a teacher. **Me → Classes** shows each class's grade, your GPA and the next quiz or test.

**Quizzes and tests you take yourself:**
- On a quiz day (every two weeks, in one of your classes) and on midterms and finals (all your classes), a moment asks:
  **Take it yourself** or **Let it ride**.
- Take it and you get a timed quiz: 15 seconds a question, questions from that class's subject and your grade level.
- Math is generated by course (Algebra I through Calculus), so it never repeats and the answers are always right.
- Your score counts: the test grade blends your answers (55%) with your character's preparation (45%: studying, academic
  skill, mood, stress), and the class's grade remembers how you did.

**Class games (most school days):** a teacher throws something quick at the class, and it shows up before school as a
card like "Second period · Chemistry: Fill it to the line". Three choices: **go for it** (you play it, a few seconds),
**let the classmate next to you take it**, or **sit it out**. The choice you play has a green **Play** tag.
- The games, all built into the phone:
  - **Hold it**: press and hold, the level rises (faster the longer you hold), let go on the line. It's a beaker in chem,
    one brushstroke in art, a power throw in gym, a held note in band.
  - **Stop it**: a needle swings back and forth; tap to stop it in the zone. It's a real pendulum in physics (stop it at the
    bottom), the beat in band, jumping in on the rope in gym.
  - **Quick math**: five problems, three answers, a few seconds each. Making change in economics, counting atoms in chemistry.
  - **Flash**: squares light up in a pattern; tap it back. Ear training in band, memory span in psychology.
  - **Odd one out**: find the typo in English, the missing accent in Spanish, the mutation in a strand of DNA, the shade
    that's off in art.
  - **In order**: tap the cards in order. Events oldest first in history (with the years shown after), elements by atomic
    number, the planets, the number line, binary, the rainbow, tempos, ABC order with words that all start the same.
  - **Quick hands**: wait for it, then tap. Catch the falling ruler in physics (it tells you how many centimeters it fell),
    first hand up in history, a reaction test in psychology. Jump early and it's a miss.
  - **Lightning round**: three trivia questions from that class, ten seconds each.
- Three tries (or rounds) each, a little harder as you go. Each one gets a call right away ("Perfect!", "A bit over",
  "Too early!"), and the end screen gives your percent. Great is 80%+, good 50%+, like every mini game.
- Difficulty goes up with your grade (college is the hardest). Your academics and talent widen the window a little.
- What it does: a great round is a better mood, less stress, a bit of academics, and the classmate who watched likes you a
  little more. A miss is a laugh (fun goes up). Going for it counts toward that class's grade (a nudge, up to +3 or -2),
  and **Me → Classes** shows your class games won per class.
- Quiz and test days stay quizzes. Skipping ahead lets your character decide, so a week skip doesn't stop for these.
- Don't want them? **Me → Class challenges** turns them off.
- Writers: the setups (what each teacher says, how it lands) are in `backend/data/class_games.json`, and the order and
  odd-one-out cards are in its `banks`. Dialogue packs can use the quick games in any scene too (`hold`, `sweep`,
  `mathdash`, `flash`, `oddone`, `lineup`, `reflex`).

**Mini games:** short rounds whose results feed the story.
- **Free play:** in free time, the Story tab shows **Or play something**: pickup soccer (penalty kicks or an 11 v 11 match), shooting around in the driveway,
  running the offense at the park (Playmaker), running the option at practice (Option Arcade), hitting at the batting cages
  (At Bat), batting practice (Swing Lab), and on
  weekends a round of golf (Fairway) and cup pong in a friend's basement (beer pong at a party once you're in college).
  The first round each day counts as practice (a small skill gain, plus fun), scaled by how you did.
- **Game day:** **Take over late. Play the big moment yourself.** plays your sport's game. A great round adds +7 to your
  game performance, a good one +3, a miss -2. It appears once that sport's game is ready.
- **Scenes:** dialogue packs can put a game in a scene, like the built-in pickup soccer scene.
- **Soccer Playmaker** (soccer, 11 v 11) is soccer's game-day game: whoever has the ball is you. Drag to dribble,
  flick toward a teammate to pass (it leads his run), flick at the goal to shoot, hold still to look up while it slows
  down and your forwards run in behind, tap to fake. Game day is Clutch: three attacks against a tougher defense, and
  two goals is a great round, one a good one. Free play opens its home screen (Match, Clutch, Practice).
- **Penalty kicks** (soccer) stays as its own free play: swipe from the ball toward the goal; a faster swipe hits harder
  and higher, and curving your swipe bends it. The keeper reads you more often at higher difficulty, and your
  character's skill steadies your aim.
- **Option Arcade** (football) is football played by hand. The option: hold GIVE to snap and give it to the fullback,
  let go to pull it, read the next man and PITCH or keep. The jet sweep. The passing game: pull back to aim and let go to
  throw (or flick), against Cover 1, 2, 3 and the blitz, and scramble when it breaks down. Then steer the runner: swipe to juke,
  spin, hurdle, tap to truck. Game day is first and goal from the 10 with the whole playbook, four downs; a touchdown is
  a great round.
- **The games from `games/`** (Basketball Playground, Fairway, Pong Night, At Bat, Swing Lab, Option Arcade, Soccer Playmaker) run inside the app with
  their mechanics untouched. Each opens to its own home screen in free play; on game day basketball, baseball and soccer open
  straight into a short clutch round. Edit them in `games/src/`, then run `python lifeos/tools/sync_games.py` and rebuild.
- **Swing Lab** is the batting prototype: a bigger, brighter, slower ball, a swipe through an invisible contact plane,
  fastball / changeup / curveball told apart only by how they move, a training mode, and two cameras to compare. Its
  stats sheet tracks whether you can follow the ball, time the swipe, and get better with practice.

**Add a game:** every game is one standalone HTML file in `frontend/public/minigames/`, so it can live in Google Drive
too. Paste in `lifeos-bridge.js`, call `LifeOS.finish({score, max})` when the round ends, register it in
`backend/data/minigames.json`, and rebuild. The full contract is in `frontend/public/minigames/README.md`. Paper toss
is registered as "coming" and appears once its file lands.

## Add dialogue (with ChatGPT, Claude, or by hand)

Texts, reply options, story-feed lines, moment choices and **whole new scenes** come from *dialogue packs*: one JSON file each.
A pack only adds. Nothing it does can break the base game.

**On the phone:** Me → **Dialogue packs**.
1. Tap **Copy the ChatGPT prompt** and paste it into ChatGPT. It carries the full format and every list the game accepts.
2. Replace the "What I want" line with your idea ("15 more texts from my older brother", "a scene where my twin sisters fight over
   the car", "make the team group chat funnier").
3. Copy ChatGPT's whole answer, tap **Paste a pack**, then **Check it**. If something's off, the game says exactly what (and **Copy the
   problems for ChatGPT** hands the list back to it). **Add to my game**.
4. Open the pack and tap **Play now** on any scene to see it in your story right away. Packs can be turned off or removed.
5. **Already made packs?** Open one and tap **Upgrade it**. That copies an upgrade prompt with your pack inside it. ChatGPT keeps
   everything and makes it much bigger: talk versions, context tags, mods, scene versions, texted versions, mini game choices and
   new scenes. Paste the answer back and it replaces the old pack (same name). For a pack that isn't on the phone, use **Pack not
   on this phone? Copy the upgrade prompt** and paste the pack in yourself. The same prompt is in `docs/dialogue-update-prompt.md`.

**In the lab:** Content Library → **Dialogue**. Same steps. You can also download the guide (`.md`) and all the current dialogue
(`.json`), so the AI can match what's there.

**Every line two ways, fitted to the moment, never on repeat:**
- **Text and talk:** any line can be texted or said in person. A text line is a string, or `{"text", "talk", "when"}`. `talk` is
  how they'd say it to your face; without it, the game makes one by spelling out the abbreviations and quoting it, then adds
  who's talking and how ("Jake says, with a shoulder bump"). The IN PERSON pools (`hang_talk`, `date_talk`, `chat_talk`,
  `awkward_talk`) show in the story feed when you hang out, go on a date or stop and talk.
- **Context:** `when` tags like `late_night`, `close`, `crush`, `partner`, `stressed` and `you_down` pick the line that fits.
  **Mods** dress a base line: openers ("u up?"), closers ("lol") and ways of saying it ("{them_first} {says}, grinning"), so one
  line becomes many.
- **No repeats:** the game remembers every line it uses and rests it before using it again; bigger pools rest longer. Scene
  text, `say` lines and texts from scenes can be lists of versions it rotates through.
- **Scenes by text:** a scene with a `by_text` version can arrive as a text instead (more often on days off, rarely from
  family). The choices become your replies.

**What a pack can add:**
- **texts:** lines for any of 72 text situations (friend invites, team chat after a win, parents after a report card, siblings,
  and things people say in person).
- **replies:** more reply buttons. Each has a tone that decides what it does: warm, funny, vent, flirt, dry, cold...
- **narration:** story-feed lines.
- **moment_choices:** extra choices on the built-in moments (a rumor, an injury, getting cut...).
- **trivia:** more quiz questions by subject.
- **mods:** openers, closers and ways of saying things, by context.
- **scenes:** brand-new moments. Each scene has:
  - `who` it's about: best friend, crush, partner, rival, teammate, an older sibling, your twin, a coach...
  - `when` it can happen: school year, months, a date like Halloween, weekends, in season, feelings toward that person, your stress
    or GPA.
  - 2 to 4 choices. Their effects can be dialogue lines (`say`), a text they send you later (`text`), relationship changes, plans
    to hang out, a chance roll against your own traits, or a **mini game** you play right there (pickup soccer, HORSE in the
    driveway, cup pong in a basement, a round of golf, a quiz), with its own outcome for great, good and miss.
  - `remember` facts that later scenes can depend on, so scenes chain. A follow-up stays with the same person.

The game starts at most one pack scene every few days, and dated scenes always get their day. A scene or choice that mentions
someone only shows up when that person exists. Built-in starter pack: **Everyday life** (14 scenes, 54 texts, 10 replies, mods, and a pickup match you can play). The
full reference is `docs/dialogue-guide.md`.

**For Claude (or anyone editing the repo):** put the pack in `backend/data/dialogue/<name>.json` and check it with
`python -m lifeos.dialogue check backend/data/dialogue/<name>.json` (run from `backend/`). Then rebuild the phone app
(`python lifeos/tools/build_phone_app.py`) and push. Built-in packs load for everyone; packs loaded in the app are kept in
`var/dialogue/` (lab) or on the phone.

## Tests

```bash
cd lifeos
python -m pytest backend/tests -q      # 59 tests, about a minute
```

They cover every acceptance criterion in the brief. Each name below is a test:
- **Characters and time:** stable identities, consistent time advancement, school-year rollover and graduation (traced and untraced).
- **Behavior:** NPCs initiate interactions on their own; relationships form, change and stay directed; parameters change decisions, both in exact scoring and in behavior; temperature controls determinism.
- **History:** event change logs add up to the actual state change in a slot; the history is internally consistent; important outcomes have traces whose terms add up to the utility and whose probabilities reproduce.
- **Reproducibility:** same seed gives the same outcomes and a different seed diverges; tracing never changes outcomes; a loaded save continues exactly like the original.
- **Configuration:** invalid configuration is rejected without partially applying; every rule parameter is read by the engine.
- **Lab tools:** experiment runs are isolated and reproducible; player choices go through the same resolvers; lab edits are validated and recorded; the workbook round-trips.
- **Demo:** the demo world produces measurably different lives.
- **Phone** (`test_phone.py`): the family dog becomes a real pet with a one-time chore setup; quick and timed pet activities; asking for and adopting a pet; texts come from what happens and replies change relationships; plans made by text happen; second-person text; everyone has a look; the phone API flow; the character worksheet round-trip.
- **Story mode** (`test_story.py`): the spec builds you, your siblings (twins included), your people and the town; validation reports every problem; moment choices change state and are recorded; a football season has rosters, box scores and stats; a senior leaves with a path, arrives at college and comes home for Thanksgiving; the story API flow works end to end. Also: the Guilford setting and the real colleges; a sibling set to play basketball at UConn ends up there; offers get pulled over GPA; the MLB draft after junior year and the finale; offscreen college seasons.

## Demonstration scenario

```bash
python demo.py                # ~1 minute: 180 days of the demo world + the approval experiment
python demo.py --days 365 --seeds 5
```

It prints, from the recorded history, how the featured characters' lives went: who they got close to,
what they tried out for, where it went wrong. It then compares Marcus (athletic aptitude 90,
discipline 26) with Devon (aptitude 60, discipline 92). Last, it runs the social-approval experiment
across paired seeds and prints differences with 95% intervals. In one run the basketball skill went
Marcus 58→64 and Devon 48→73, and raising social approval ×2.5 clearly raised exclusions and rumors
(4 of 4 seeds). The friendship effect was unresolved.

## A tour of the lab

| Section | What you can do |
|---|---|
| **My Story** | Story mode: the setup wizard, then your life. Moments, choices, invitations, focus, your teams, season stats, box scores, awards, recruiting board, family and people. |
| **World Overview** | Clock, population and world statistics, the notable-events feed (filter by social / romance / conflict / school), upcoming calendar, spotlight (most popular, most stressed, loneliest), weekly trend charts, cliques, institutions. |
| **Character Studio** | Every person as a card. Their profile keeps the layers separate: personality, aptitude, learned skills (with the talent ceiling marked), motives, current condition, circumstances (household, money, groups). Also goals, interests, reputation and learned expectations. The relationships table shows both sides: how they see each person, what they *think* that person feels, and what that person actually feels. Then their timeline, recent decisions (each opens its trace) and memories. **Edit** any attribute, validated and logged as a lab edit. **Create a character** with the full character builder (personality, body, positions, relationships). Athletes get an athlete page with season stats, career totals, awards and recruiting. |
| **Social Network** | A force-directed map: mutual friendships, one-sided ones (dashed), couples, crushes, rivalries. Click a person or a line. Below it: cliques, groups and institutions (rosters, captains, records, cut lists), the biggest perception gaps, and households. |
| **Live Any Life** | Pick anyone. At each decision point you see their real options, why each is available, and how likely they would be to pick it on their own. Choose one, or let them decide. The simulation resolves it with the same rules and dice as everyone else's choices. |
| **History Explorer** | Every event, filterable by person, type, importance, date range and text, with a CSV export. Each event shows its calculation (probabilities and rolls), every state change (before, after and why), the memories it created, its causes and its consequences. The **decision trace inspector** shows every option weighed, each term's contribution, the temperature, the random roll and the weights in effect. |
| **Experiment Center** | Presets and a builder: a base world (fresh from a generation seed, the current world, or a save), the number of days, the seeds, and variants with rule overrides. Runs happen in separate processes. Results are labelled honestly: one seed is a *deterministic paired comparison* (including whose lives changed and the day the timelines split); several seeds are a *repeated-run measurement* (means, 95% intervals on paired differences, direction counts, effect sizes). |
| **Engine Workshop** | 78 rule parameters with ranges, defaults and descriptions, applied from the next slot. Changes are validated, logged as lab events and versioned. Per-action coefficients (base, risk, need/motive/trait weights, target terms, on/off). Excel workbook export and import. Change log. |
| **Content Library** | The data catalogs: actions, goals, narrative templates, world and institutions, archetypes and staff, attribute definitions, metrics. |
| **Saves & Worlds** | Save, load, download and upload snapshots. Generate a new world (generation seed, population, with or without the featured cast). Change the simulation seed. |

Time controls are in the top bar: Day / Week / Month / Year, Auto with a speed setting, and quick save.
A simulated day takes roughly 0.03–0.1 s, and a full traced year roughly 25–35 s.

## How it works (short version)

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design and the assumptions behind it.

- **One authoritative world** (`backend/lifeos/model.py`) holds characters, directed relationships,
  bonds, households, groups, cliques, rumors, the calendar, the rules and the history. The server
  holds one instance. Saves are complete compressed snapshots.
- **Time**: each day runs a fixed list of phases. School days are morning → classes → lunch\* → after school\* → night;
  other days are morning → day\* → evening\* → night. \* marks a decision slot. Weekly and yearly processing hangs off night.
- **Decisions** (`decision.py`): every acting character enumerates (action, target) candidates from
  `data/actions.json` and scores each one as a sum of named terms:
  - needs, motives × their global weights, and traits
  - interests, and feelings toward the target
  - goals, memories, learned experience, habit and peer conformity
  - minus risk, plus commitment and situational terms

  An action's possible targets share one slot of probability. The choice is a softmax draw with a personal
  temperature (impulsive people are noisier). Every term is recorded.
- **Resolution** (`actions.py`, `institutions.py`): invitations can be declined by the other person,
  who weighs it against their own plan. Interactions have one true quality, but each side experiences
  it with its own noise, and each forms a *belief* about the other. That is how one-sided friendships
  and misread crushes happen. Collective events (lunch tables with exclusion, practices, tryouts judged
  by each coach's own weights, games, shows, dances, parties, elections) resolve after individual actions.
- **Consequences**: memories, learned expectations, goals (created by failure, rejection, grudges,
  loneliness...), skill growth toward an aptitude ceiling, confidence drift, interest drift,
  popularity and reputation, rumors that spread and can be traced back to whoever started them.
  Some consequences are delayed: tryout results post the next morning, and parents find out the next day.
- **Randomness** (`rng.py`): every draw comes from a stream derived from the seed plus a name and keys
  (for example decision / day / slot / character). Unrelated systems don't share random numbers, and
  there is no hidden RNG state, so a save plus the seed fully determines the future.

## Project layout

```
lifeos/
  run.py                 start the server (+ open the browser)
  demo.py                the demonstration scenario
  requirements.txt
  backend/
    data/                the data catalogs (JSON): rules schema, actions, world, people, templates, goals,
                         sports, colleges, story moments, texts
      dialogue/          built-in dialogue packs (Everyday life)
    lifeos/              the engine and API (Python); dialogue.py loads and checks dialogue packs
      rng.py rules.py catalogs.py model.py history.py calendar.py worldgen.py
      decision.py actions.py social.py institutions.py households.py development.py
      sports.py college.py story.py moments.py
      narrative.py metrics.py engine.py experiments.py storage.py spreadsheet.py api.py
      appearance.py pets.py messages.py pov.py phone_api.py worksheet.py
    tests/test_lifeos.py tests/test_story.py tests/test_phone.py
  frontend/              React + TypeScript + Vite; dist/ is the built app the server serves
  docs/DESIGN.md
```

## Status: what works and what doesn't yet

**Working and tested:**
- The world, time advancement, autonomous agents, social dynamics, institutions and households.
- Persistent history with decision traces and state-change logs.
- Rules and action editing with validation, save/load, experiments, the workbook round-trip, play mode, and all the UI sections.
- Story mode: the spec and builder, siblings and twins, custom relationships, moments, focus, invitations, the three sports, recruiting, the college decision, college life and breaks at home, jobs in town.

**Not implemented or partial in v0.1 (labelled honestly):**
- **Guardians** are household-level actors with a parenting style. They react to grades and trouble, but they aren't autonomous agents.
- **Pets** in your household are full animals with needs, bonds, tricks and chores. Pets in other households are still a simple line (they relieve stress at home).
- **Phone art** is hand-drawn vector illustration (portraits generated from each person's look, scene backdrops per place, season and time of day). Image generation wasn't available, so there are no painted backgrounds.
- **Texts** are written from templates with a per-person voice. You can type anything, but it's read for intent and tone with simple
  rules (no AI), so it catches what you're doing, not every detail of what you said.
- **The phone app** keeps your story on that one phone (back it up). It's slower than a computer on long skips (a few seconds for a week, longer for months) and trims old background history sooner to fit in phone memory. Experiments and the Engine Workshop stay in the lab.
- **Careers and economy** are minimal: two part-time employers, allowance by income level, and costs for outings.
- **After high school**: your own college is fully simulated (teams, classes, roommate, classmates). Everyone else who leaves town lives offscreen: weekly updates, no daily decisions, home for breaks. Graduates who stay in town work full time. The seven chapters end with the MLB Draft after college junior year and a final review. The world keeps running after that, but pro ball is offscreen (no minor league seasons yet), and there's no grad school or later adult life.
- **College sports** are simplified: one varsity team per sport, a short schedule (11 football games, 18 basketball, 14 baseball), and no transfer portal, redshirts or NIL.
- **Real names, simulated numbers.** Guilford, its spots (the Green, Jacobs Beach, Bishop's Orchards), the SCC opponents, the colleges, their conferences and the MLB teams are real. Program strengths, GPA cutoffs, draft projections and slot values are design values for the simulation, not official figures. Every person is generated or made by you.
- **Spreadsheet import** covers Rules, Actions and Characters. Groups, templates and goals are edited in the JSON catalogs; restart the server to reload them.
- **Narrative text** is template-based and functional rather than literary.
- **Balance** is a first pass. The demo produces plausible years, but the numbers are design values meant to be tuned in the Workshop. Known tendencies: moods trend high over a long run, team rosters in a 36-student school are small, and outcomes vary a lot between seeds (which is what the Experiment Center is for).
- **Speed**: a traced year takes 25–35 s in pure Python. In story mode, people far from your life act less often and aren't traced, so a story year runs in about the same time. Experiments run untraced and in parallel.
- **History retention**: routine events older than 60 days are folded into per-person counters. Routine decision traces are kept for 45 days, and traces for important events are kept forever. All of this is configurable in the Workshop.
