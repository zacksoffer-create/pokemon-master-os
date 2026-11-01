# LIFE OS dialogue packs

A dialogue pack adds lines, reply options, narration, choices and whole new scenes to the game. It's one JSON file. Load it on the phone (Me, then Dialogue packs) or in the lab (Content Library, then Dialogue). The game checks it and says exactly what to fix.

## The format

Every section is optional; use the ones you need.

```json
{
  "dialogue_pack": 1,
  "name": "Cover for me",
  "author": "ChatGPT",
  "texts": {
    "sibling_chatter": [
      "did you take my charger again",
      "mom's asking where you are. i said practice"
    ]
  },
  "replies": {
    "sibling": [
      [
        "absolutely not",
        "sibling_tease"
      ]
    ]
  },
  "scenes": [
    {
      "id": "cover_for_me",
      "who": "older_sibling",
      "when": {
        "years": [
          "freshman",
          "sophomore"
        ],
        "requires": [
          "school_day"
        ],
        "chance": 0.05
      },
      "title": "{them_first} needs a favor",
      "text": "{them_first} leans into your doorway, already whispering. \"If anyone asks, I was at the library till eleven. Deal?\"",
      "choices": [
        {
          "label": "Deal. You owe me.",
          "fits": {
            "loyalty": 1
          },
          "ops": [
            [
              "rel_back",
              "them",
              "affection",
              6
            ],
            [
              "remember",
              "covered_for_sibling"
            ],
            [
              "say",
              "{them_first} points at you on the way out. \"Legend.\""
            ]
          ]
        },
        {
          "label": "No way. I'm not lying for you.",
          "fits": {
            "discipline": 1,
            "loyalty": -0.5
          },
          "ops": [
            [
              "rel_back",
              "them",
              "affection",
              -4
            ],
            [
              "say",
              "\"Wow. Okay. Remember this.\""
            ]
          ]
        },
        {
          "label": "Only if you drive me to practice all week.",
          "fits": {
            "ambition": 0.5,
            "confidence": 0.5
          },
          "ops": [
            [
              "chance",
              {
                "base": 0.5,
                "charisma": 0.4
              },
              [
                [
                  "rel_back",
                  "them",
                  "respect",
                  4
                ],
                [
                  "say",
                  "\"...Fine. Seven sharp, I'm not waiting.\""
                ]
              ],
              [
                [
                  "rel_back",
                  "them",
                  "affection",
                  -2
                ],
                [
                  "say",
                  "\"Forget it. I'll figure it out.\""
                ]
              ]
            ]
          ]
        }
      ]
    }
  ]
}
```

- `texts`: more lines for a text-message pool (the list is below). Use only that pool's placeholders.
- `replies`: more reply buttons for a reply set. Each option is `["what you say", "tone"]`. The tone decides the effect.
- `narration`: more lines for the story feed, keyed `event.outcome`.
- `moment_choices`: extra choices on an existing story moment.
- `scenes`: brand-new story moments. The game decides when they happen from `who` and `when`.

## Voice

- Texts sound like real texts. Teens: mostly lowercase, short, abbreviations sometimes, an emoji now and then, never
  a paragraph. Parents: full sentences, proper capitals, a heart emoji is fine. Coaches: short and direct.
- The game already roughs up spelling and adds emoji based on each person's personality, so write the plain version.
- Nobody talks like an ad or a guidance counselor. No "absolutely!", no life lessons.
- Scene text is second person, present tense ("You", "your"), one or two short paragraphs at most.
- Choices are what YOU do or say, in your own words, under about 12 words each.
- Use the {placeholders} listed for each spot and only those. Never write a specific person's name: use {them_first} and friends.
- Keep it PG-13: crushes, drama, parties, trouble at home are all fine; nothing graphic.

## Text pools (`texts`)

| pool | when it shows up | placeholders | sounds like |
|---|---|---|---|
| `invite` | A friend asks you to hang out. | {place} | "wanna hang after school?" / "u free later? thinking {place}" |
| `invite_date` | Someone you're dating or into asks you somewhere, just the two of you. | {place} | "so... {place} tonight? just us?" / "want to get food later? my treat" |
| `after_good` | A friend, after a good hangout. | none | "that was fun today" / "had a really good time today" |
| `after_good_date` | After a good date. | none | "i had a really nice time tonight" / "home. tonight was really fun" |
| `after_awkward` | After a hangout that went badly. | none | "today was kinda weird huh" / "sorry if i was off today" |
| `u_ok` | A friend checks on you after something bad happened with {other}. | {other} | "hey heard what happened w {other}. u ok?" / "{other} was so out of line today" |
| `they_apologize` | Someone apologizes after a fight. | none | "hey. i'm sorry about earlier" / "i was a jerk today. sorry" |
| `congrats_team` | A friend congratulates you on making {team}. | {team} | "YOOO congrats on making {team}!!" / "told you you'd make it" |
| `consolation_cut` | A friend, after you got cut. | none | "that's messed up. you deserved a spot" / "their loss honestly" |
| `congrats_award` | A friend, after you won {event}. | {event} | "{event}!! that's huge" / "congrats on {event}, so deserved" |
| `rumor` | A friend tells you people are talking about you. | none | "ok so people are saying something about you... want to know?" / "have you heard what people are saying??" |
| `chatter_partner` | Your boyfriend or girlfriend, a random sweet text. | none | "thinking about you" / "goodnight 🌙" |
| `flirt_in` | Someone with a crush on you flirts. | none | "random but you're really funny" / "saw you at the game 👀" |
| `asked_out` | Someone asks you out (you answer yes or no). | none | "ok i'm just going to say it. want to go out sometime?" / "this is scary but. would you want to go on a date with me?" |
| `asked_to_dance` | Someone asks you to {event} (a dance). | {event} | "would you want to go to {event} with me?" / "ok so {event}... want to go together?" |
| `park_followup` | Someone you met at the dog park, about your dog {pet}. | {pet} | "{pet} is the best dog ever btw" / "tell {pet} i said hi lol" |
| `team_pregame` | Team group chat the night before a game. | {opp} | "big one tomorrow 🔥" / "everyone get sleep tonight" |
| `team_win` | Team group chat after a win. | {opp} | "LETS GOOOO" / "what a game" |
| `team_loss` | Team group chat after a loss. | none | "we'll get em next week" / "rough one. heads up" |
| `parent_pregame` | Mom or Dad in the family chat before your game. | none | "Good luck tonight! We'll be in the stands." / "Big game today! Eat something real at lunch please." |
| `parent_win` | Mom or Dad after your team won. | none | "What a game!! So proud of you ❤️" / "Great game tonight! Dinner's in the oven." |
| `parent_loss` | Mom or Dad after a loss. | none | "Tough one tonight. Proud of how you played." / "Can't win them all. Proud of you." |
| `parent_made_team` | Mom or Dad after you made {team}. | {team} | "{team}!! So proud of you ❤️" / "Making {team}... we're celebrating this weekend. Pick the restaurant." |
| `parent_cut` | Mom or Dad after you got cut. | none | "We're proud of you for putting yourself out there." / "Their loss. Love you." |
| `parent_award` | Mom or Dad after you won {event}. | {event} | "{event}!!! We're so proud of you!" / "Grandma wants to know if it'll be in the paper 😂" |
| `parent_offer` | Mom or Dad after a scholarship offer from {college}. | {college} | "{college}!!! Can't believe it. So proud!" / "Your dad is already looking up flights to visit {college}." |
| `parent_report_proud` | Mom or Dad after a good report card. | none | "Saw your report card. Really proud of you." / "Great grades this quarter! Keep it up." |
| `parent_report_worried` | Mom or Dad after a bad report card. | none | "We need to talk about your grades tonight." / "Report card came. Let's sit down after dinner." |
| `parent_grounded` | Mom or Dad grounding you. | none | "You know why. Phone stays downstairs this week." / "We're disappointed. We'll talk at home." |
| `parent_drafted` | Mom or Dad after you got drafted by {team}. | {team} | "THE {team}!!!! I'm crying" / "We are SO proud of you. Call us when you can!!" |
| `pet_adopted` | Family chat the day a new pet comes home. | {pet} | "Welcome home {pet}!! ❤️" / "{pet} already found the couch." |
| `pet_chores_set` | A parent confirming your pet chores ({chores}). | {chores}, {pet} | "Okay, official: you're on {chores} for {pet}. We're trusting you!" / "From now on you handle {chores} for {pet}. {pet} is counting on you." |
| `pet_you_forgot` | A parent: you forgot a pet chore ({chore_a}). | {chore}, {chore_a}, {me}, {pet} | "{me}. {pet} never got {chore_a} today." / "Did you forget about {pet}'s {chore}?" |
| `pet_you_forgot_strict` | A strict parent: you forgot a pet chore. | {chore}, {chore_a}, {pet} | "{pet} never got {chore_a} today. That's your job. Don't let it happen again." / "We talked about this. {pet}'s {chore} is on you." |
| `pet_sibling_forgot` | A parent: a sibling ({who}) forgot a pet chore. | {chore}, {chore_a}, {pet}, {who} | "Somebody (cough {who}) forgot {pet}'s {chore}." / "{who}, {pet} is still waiting on {chore_a}." |
| `pet_streak` | A parent: the pet's been happy because you've been on it. | {n}, {pet} | "{pet} has been so happy lately. Thank you for taking care of {pet} ❤️" / "{n} days in a row taking care of {pet}. We noticed. Thank you." |
| `pet_sad` | A parent: the pet's been moping. | {pet} | "{pet} has been moping around. Maybe some extra attention this week?" / "Has anyone played with {pet} lately? Looking a little sad." |
| `pet_vet` | A parent: the pet went to the vet. | {pet} | "{pet} had to go to the vet. All okay, just needs rest." / "Vet says {pet} will be fine. Extra gentle this week please." |
| `pet_reminder` | A parent reminding you about a pet chore. | {chore}, {chore_a}, {pet} | "Don't forget {pet}'s {chore} tonight!" / "{pet} needs {chore_a}. You're up today." |
| `sibling_home` | A brother or sister away at college, coming home. | none | "home friday!! 🎉" / "coming home this weekend. you better be around" |
| `sibling_leaving` | A brother or sister leaving for college. | none | "gonna miss you. don't touch my room" / "you're the oldest one at home now. good luck lol" |
| `sibling_chatter` | A brother or sister, random texts. | none | "can you cover for me tonight" / "mom is in a MOOD" |
| `coach_starting` | Your coach: you're starting. | none | "You're starting Friday. Be ready." / "Earned the start. Don't waste it." |
| `coach_bench` | Your coach: you're coming off the bench. | none | "Keep working. Your time is coming." / "Come see me before practice. Let's talk about minutes." |
| `react_warm` | How someone answers your warm reply. | none | "haha" / "❤️" |
| `react_funny` | How someone answers your funny reply. | none | "LMAO" / "stoppp" |
| `react_dry` | How someone answers your dry reply. | none | "k" / "ok" |
| `react_flirt_yes` | Someone who's into you, answering your flirt. | none | "oh?? 😳" / "stop it 😊" |
| `react_flirt_no` | Someone who isn't into you, answering your flirt. | none | "haha… ok" / "lol thanks?" |
| `react_plans_yes` | Someone saying yes to plans. | none | "bet, see you then" / "yes!!" |
| `react_plans_no` | Someone saying no to plans. | none | "can't today, sorry" / "ugh i have stuff. another time?" |
| `react_parent` | Mom or Dad answering your nice reply. | none | "Thank you ❤️" / "Love you." |
| `react_parent_annoyed` | Mom or Dad answering an attitude reply. | none | "Watch the attitude." / "We'll talk later." |
| `reply_hey` | Someone answering your 'hey' (they're glad you texted). | none | "hey" / "what's up" |
| `reply_hey_dry` | Someone answering your 'hey' (meh). | none | "hey" / "hi" |
| `first_hey` | YOU, texting someone first: just saying hey. | none | "hey what's up" / "yo" |
| `first_hang` | YOU, asking someone to hang out ({place} available). | {place} | "wanna hang later?" / "you free after school?" |
| `first_flirt` | YOU, flirting first. | none | "random but i like talking to you" / "you looked good today" |
| `first_good_luck` | YOU, wishing someone luck before their game. | none | "good luck today!!" / "go kill it today" |
| `first_congrats` | YOU, congratulating someone. | none | "congrats!! so happy for you" / "you deserve it fr" |
| `first_sorry` | YOU, apologizing. | none | "hey. i'm sorry about everything" / "can we talk? i feel bad" |
| `chatter_plans` | A friend, random text about plans (reply set: chatter_plans). | none | "what are you doing this weekend" / "what's the move tonight" |
| `chatter_school` | A friend, random text about school (reply set: chatter_school). | none | "did you do the chem hw" / "do you have notes from today" |
| `chatter_vent` | A friend venting (reply set: chatter_vent). | none | "i'm so tired. how is it only tuesday" / "today was so long" |
| `chatter_funny` | A friend texting something funny (reply set: chatter_funny). | none | "lmao did you see what happened in the hall today" / "random but i just remembered that thing from freshman year and i'm crying" |
| `chatter_game` | A friend texting about a game (reply set: chatter_game). | none | "watching the game?" / "did you see that score last night??" |
| `parent_first_day` | Mom or Dad, the first morning of high school. | none | "Have a great first day! We're proud of you ❤️" / "First day of high school!! Don't forget your lunch." |
| `friend_first_day` | A friend, the first morning of high school. | none | "first day. you ready?" / "meet at the front steps before first period?" |

## Reply sets (`replies`)

| set | when you get to reply | current options |
|---|---|---|
| `warm` | After a good hangout ('that was fun today'). | "same!! we need to do it again" (warm) / "haha yeah it was fun" (warm) / "👍" (dry) |
| `awkward` | After a hangout that went badly. | "no we're good! i was just tired" (warm) / "yeah it was kinda weird" (dry) |
| `support` | When a friend checks on you after something bad (got cut, a fight). | "thanks. i'm ok" (warm) / "honestly it sucked" (vent) / "whatever, don't care" (dry) |
| `apology` | When someone apologizes to you. | "it's ok. thanks for saying that" (forgive) / "i need some time" (dry) / "whatever" (cold) |
| `thanks` | When someone congratulates you. | "thank you!! 🙏" (warm) / "lol thanks" (warm) |
| `rumor` | When a friend says people are talking about you. | "ugh. what are they saying" (vent) / "don't care honestly" (dry) |
| `chatter_plans` | A friend's random text about plans. | "i'm down. what's the plan?" (warm) / "maybe, depends what time" (warm) / "can't this time" (dry) |
| `chatter_school` | A friend's random text about school or homework. | "yeah, i'll send it to you" (warm) / "nope lol we're both cooked" (funny) / "ask someone else" (dry) |
| `chatter_vent` | A friend venting (tired, stressed). | "same honestly" (warm) / "hang in there lol" (warm) / "lol" (dry) |
| `chatter_funny` | A friend texting something funny. | "LMAO tell me everything" (funny) / "stop i'm crying" (funny) / "lol what" (dry) |
| `chatter_game` | A friend texting about a game. | "yeah!! what a game" (warm) / "nah, what happened?" (warm) / "not really my thing" (dry) |
| `partner` | Your boyfriend or girlfriend texting something sweet. | "❤️" (warm) / "miss you too" (warm) / "lol goodnight" (dry) |
| `flirt` | Someone flirting with you. | "you're not so bad yourself 😏" (flirt) / "haha thanks" (warm) / "lol ok" (dry) |
| `sibling` | A brother or sister texting. | "lol" (sibling_warm) / "miss you too" (sibling_warm) / "go away" (sibling_tease) |
| `generic` | Anything else. | "haha" (warm) / "ok" (dry) |

Tones and what they do:

- `warm`: Friendly. They like you a little more and feel you care.
- `funny`: Makes them laugh. They like you more and you have a bit more fun.
- `vent`: Honest about how you feel. Your stress drops and they feel closer.
- `thanks`: Grateful. Same effect as warm.
- `forgive`: You let something go. Less rivalry, more trust.
- `flirt`: Flirty. If they're into you, attraction goes up both ways. If not, it's a little awkward.
- `dry`: Short and flat. They feel a bit less liked.
- `cold`: Shuts them down. They feel a lot less liked.
- `sibling_warm`: Brother or sister only: affectionate.
- `sibling_tease`: Brother or sister only: teasing. Barely moves anything, it's just how siblings talk.

Reply labels can't use placeholders. When a set has more than 3 options, the game shows 3 at a time and keeps a mix of tones.

## Narration (`narration`)

Story-feed lines, keyed `event.outcome`. `{a}` is the person doing it (you, on the phone, becomes "You"). One line per entry.

- `study.focused`: {a}, {where}
- `study.distracted`: {a}
- `study_at_lunch.focused`: {a}
- `study_at_lunch.distracted`: {a}
- `practice_skill.focused`: {a}, {skill}
- `practice_skill.distracted`: {a}, {skill}
- `hobby.focused`: {a}, {verb}
- `hobby.distracted`: {a}, {verb}
- `rest.focused`: {a}
- `rest.distracted`: {a}
- `sit_alone.focused`: {a}
- `sit_alone.distracted`: {a}
- `pet_time.focused`: {a}, {pet}
- `pet_time.distracted`: {a}, {pet}
- `interact.introduce.great`: {a}, {b}
- `interact.introduce.good`: {a}, {b}
- `interact.introduce.awkward`: {a}, {b}
- `interact.introduce.bad`: {a}, {b}
- `interact.chat.great`: {a}, {b}
- `interact.chat.good`: {a}, {b}
- `interact.chat.awkward`: {a}, {b}
- `interact.chat.bad`: {a}, {b}
- `interact.hang_out.great`: {a}, {b}, {place}
- `interact.hang_out.good`: {a}, {b}, {place}
- `interact.hang_out.awkward`: {a}, {b}, {place}
- `interact.hang_out.bad`: {a}, {b}, {place}
- `interact.hang_out.declined`: {a}, {b}, {place}
- `interact.hang_out.busy`: {a}, {b}
- `interact.support.great`: {a}, {b}
- `interact.support.good`: {a}, {b}
- `interact.support.awkward`: {a}, {b}
- `interact.support.bad`: {a}, {b}
- `interact.flirt.great`: {a}, {b}
- `interact.flirt.good`: {a}, {b}
- `interact.flirt.awkward`: {a}, {b}
- `interact.flirt.bad`: {a}, {b}
- `interact.date.great`: {a}, {b}, {place}
- `interact.date.good`: {a}, {b}, {place}
- `interact.date.awkward`: {a}, {b}, {place}
- `interact.date.bad`: {a}, {b}, {place}
- `interact.date.declined`: {a}, {b}
- `interact.date.busy`: {a}, {b}
- `interact.family.great`: {a}, {b}
- `interact.family.good`: {a}, {b}
- `interact.family.awkward`: {a}, {b}
- `interact.family.bad`: {a}, {b}
- `interact.chat.declined`: {a}, {b}
- `lunch_table.good`: {a}, {members}
- `lunch_table.great`: {a}, {members}
- `lunch_table.flat`: {a}, {members}
- `exclusion.excluded`: {a}, {b}
- `ask_out.yes`: {a}, {b}
- `ask_out.no`: {a}, {b}
- `ask_out.no_harsh`: {a}, {b}
- `ask_to_dance.yes`: {a}, {b}, {event}
- `ask_to_dance.no`: {a}, {b}, {event}
- `break_up.mutual`: {a}, {b}
- `break_up.messy`: {a}, {b}
- `confront.cleared_air`: {a}, {b}
- `confront.argument`: {a}, {b}, {place}
- `confront.falling_out`: {a}, {b}
- `apologize.forgiven`: {a}, {b}
- `apologize.partial`: {a}, {b}
- `apologize.rebuffed`: {a}, {b}
- `gossip.spread`: {a}, {about}, {b}
- `gossip.known`: {a}, {about}, {b}
- `gossip.doubted`: {a}, {about}, {b}
- `spread_rumor.started`: {a}, {about}, {b}
- `rumor_reached.hurt`: {a}, {about}
- `rumor_reached.source`: {a}, {b}
- `tease.landed`: {a}, {b}
- `tease.backfired`: {a}, {b}
- `prank.legend`: {a}
- `prank.caught`: {a}
- `prank.dud`: {a}
- `sneak_out.fine`: {a}
- `sneak_out.caught`: {a}
- `practice.session`: {a}, {group}, {n}
- `practice.dropped`: {a}, {group}
- `practice.called_up`: {a}, {group}
- `practice.drifted`: {a}, {group}
- `tryout.held`: {a}, {group}, {n}
- `tryout.made`: {a}, {group}
- `tryout.cut`: {a}, {group}
- `tryout.no_show`: {a}, {group}
- `audition.made`: {a}, {event}
- `audition.lead`: {a}, {event}
- `audition.cut`: {a}, {event}
- `game.win`: {a}, {group}, {score}
- `game.loss`: {a}, {group}, {score}
- `game.star`: {a}, {group}
- `show.performed`: {a}, {event}, {group}, {label}
- `show.star`: {a}, {event}
- `election.result`: {a}, {members}
- `election.won`: {a}
- `election.president`: {a}
- `election.lost`: {a}
- `dance.held`: {a}, {event}, {n}
- `dance.moment`: {a}, {b}, {event}
- `dance.alone`: {a}, {event}
- `party.thrown`: {a}, {n}
- `party.flop`: {a}
- `party.kiss`: {a}, {b}
- `party.fight`: {a}, {b}
- `party.busted`: {a}
- `party.not_invited`: {a}, {b}
- `exam.result`: {a}, {event}, {score}
- `exam.aced`: {a}, {event}, {score}
- `exam.bombed`: {a}, {event}, {score}
- `household.support`: {a}, {label}
- `household.pressure`: {a}, {label}
- `household.grounded`: {a}, {label}, {n}
- `household.argument`: {a}, {label}
- `household.proud`: {a}, {label}
- `job.hired`: {a}, {group}
- `job.rejected`: {a}, {group}
- `job.fired`: {a}, {group}
- `job.shift`: {a}, {group}
- `job.missed`: {a}, {group}
- `sign_up.club`: {a}, {group}
- `sign_up.tryout`: {a}, {group}
- `sign_up.audition`: {a}, {event}
- `sign_up.election`: {a}
- `sign_up.job`: {a}, {group}
- `quit_group.quit`: {a}, {group}
- `mentor.great`: {a}, {b}
- `mentor.good`: {a}, {b}
- `mentor.awkward`: {a}, {b}
- `mentor.bad`: {a}, {b}
- `milestone.friends`: {a}, {b}
- `milestone.close_friends`: {a}, {b}
- `milestone.best_friends`: {a}, {b}
- `milestone.rivals`: {a}, {b}
- `milestone.dislike`: {a}, {b}
- `milestone.crush`: {a}, {b}
- `milestone.drifted`: {a}, {b}
- `milestone.dating`: {a}, {b}
- `clique.formed`: {a}, {label}, {members}
- `clique.dissolved`: {a}, {label}
- `clique.joined`: {a}, {label}
- `clique.left`: {a}, {label}
- `goal.created`: {a}, {label}
- `goal.achieved`: {a}, {label}
- `goal.failed`: {a}, {label}
- `goal.abandoned`: {a}, {label}
- `graduation.graduated`: {a}, {school}
- `new_year.arrived`: {a}, {school}
- `lab.edit`: {a}, {label}
- `lab.rules`: {a}, {label}
- `lab.created`: {a}
- `birthday.birthday`: {a}, {n}
- `interact.hang_out.invited`: {a}, {b}
- `interact.date.invited`: {a}, {b}
- `ask_out.pending`: {a}, {b}
- `ask_to_dance.pending`: {a}, {b}, {event}

## Story moments (`moment_choices`)

Add up to 5 choices in all to an existing moment. Choices use the same ops as scenes, with the people and placeholders listed here.

| moment | title | placeholders | people ops can refer to |
|---|---|---|---|
| `first_day` | First day at {school} | {best_friend}, {school}, {siblings_line}, {town} | best_friend |
| `cut` | Cut from {group} | {best_friend}, {coach}, {group}, {school}, {town} | best_friend, coach |
| `injury` | Hurt: {injury} | {best_friend}, {injury}, {school}, {town}, {weeks} | best_friend |
| `benched` | Riding the bench | {best_friend}, {coach}, {games}, {group}, {school}, {town} | best_friend, coach |
| `offer` | {college_name} wants you | {best_friend}, {college}, {college_name}, {school}, {sport}, {tier}, {town} | best_friend |
| `game_day` | Game day: {group} vs {opponent} | {best_friend}, {group}, {opponent}, {school}, {town} | best_friend |
| `sibling_leaves` | {sibling} is leaving | {best_friend}, {place}, {school}, {sibling}, {town} | best_friend, sibling |
| `rumor` | People are talking about you | {about}, {best_friend}, {school}, {town} | best_friend |
| `heartbreak` | {other} ended it | {best_friend}, {other}, {school}, {town} | best_friend, other |
| `summer` | Summer break | {best_friend}, {school}, {summer_line}, {town} | best_friend |
| `graduation` | Graduation day | {best_friend}, {path_line}, {school}, {town} | best_friend |
| `college_arrival` | First day at {college_name} | {best_friend}, {college_name}, {roommate}, {school}, {team_line}, {town} | best_friend, coach, roommate |
| `year_review` | {year_label} is in the books | {best_friend}, {review}, {school}, {town}, {year_label} | best_friend |
| `asked_out` | {other} asked you out | {best_friend}, {extra}, {other}, {school}, {town} | best_friend, other |
| `asked_to_dance` | {other} asked you to {event} | {best_friend}, {event}, {other}, {school}, {town} | best_friend, other |
| `mlb_draft` | Draft day: the {team} took you | {best_friend}, {bonus}, {college_name}, {level}, {pick}, {return_line}, {round}, {school}, {team}, {town} | best_friend |
| `draft_passed` | The draft came and went | {best_friend}, {college_name}, {school}, {town}, {udfa_line} | best_friend |
| `story_end` | Seven years | {best_friend}, {review}, {school}, {town} | best_friend |

## Scenes (`scenes`)

A scene is a new story moment: a title, a short scene, and 2 to 4 choices. Each morning the game may start one scene whose conditions fit (at most one every few days; scenes on a specific date always get their day).

```json
{
  "id": "cover_for_me",
  "who": "older_sibling",
  "when": {
    "years": [
      "freshman",
      "sophomore"
    ],
    "requires": [
      "school_day"
    ],
    "chance": 0.05
  },
  "title": "{them_first} needs a favor",
  "text": "{them_first} leans into your doorway, already whispering. \"If anyone asks, I was at the library till eleven. Deal?\"",
  "choices": [
    {
      "label": "Deal. You owe me.",
      "fits": {
        "loyalty": 1
      },
      "ops": [
        [
          "rel_back",
          "them",
          "affection",
          6
        ],
        [
          "remember",
          "covered_for_sibling"
        ],
        [
          "say",
          "{them_first} points at you on the way out. \"Legend.\""
        ]
      ]
    },
    {
      "label": "No way. I'm not lying for you.",
      "fits": {
        "discipline": 1,
        "loyalty": -0.5
      },
      "ops": [
        [
          "rel_back",
          "them",
          "affection",
          -4
        ],
        [
          "say",
          "\"Wow. Okay. Remember this.\""
        ]
      ]
    },
    {
      "label": "Only if you drive me to practice all week.",
      "fits": {
        "ambition": 0.5,
        "confidence": 0.5
      },
      "ops": [
        [
          "chance",
          {
            "base": 0.5,
            "charisma": 0.4
          },
          [
            [
              "rel_back",
              "them",
              "respect",
              4
            ],
            [
              "say",
              "\"...Fine. Seven sharp, I'm not waiting.\""
            ]
          ],
          [
            [
              "rel_back",
              "them",
              "affection",
              -2
            ],
            [
              "say",
              "\"Forget it. I'll figure it out.\""
            ]
          ]
        ]
      ]
    }
  ]
}
```

**id**: lowercase with underscores, unique.  **title**: under 80 characters.  **text**: the scene, second person.

**who** (optional): who the scene is about. They become `{them}` / `{them_first}` and the ref `them` in ops.

- `best_friend`: The person you like most (not family, not a coach).
- `friend`: A random friend.
- `crush`: The person you're most attracted to who isn't your partner.
- `partner`: Your boyfriend or girlfriend.
- `ex`: An ex.
- `rival`: Your biggest rival.
- `teammate`: A random teammate on one of your teams.
- `classmate`: Someone in your grade you barely know.
- `sibling`: A random brother or sister.
- `older_sibling`: An older brother or sister.
- `younger_sibling`: A younger brother or sister.
- `twin`: Your twin.
- `coach`: A coach of one of your teams.

**when** (all optional):

- `chance`: odds per day when everything else fits (default 0.04; 1 for date scenes). 0.02 rare, 0.05 normal, 0.15 likely.
- `years`: any of freshman, sophomore, junior, senior, high_school, college_freshman, college_sophomore, college_junior, college_senior, college.
- `months`: numbers 1-12. `dates`: like "10-31". `weekdays`: mon, tue, wed, thu, fri, sat, sun.
- `requires`: any of `dating` (you're dating someone); `single` (you're not dating anyone); `has_pet` (your family has a pet); `has_sibling` (you have a brother or sister); `plays_sport` (you're on a team); `in_season` (one of your teams has a game within a week); `injured` (you're hurt); `grounded` (you're grounded); `school_day` (it's a school day); `weekend` (it's saturday or sunday); `summer` (it's summer break); `in_high_school` (you're in high school); `in_college` (you're in college).
- `you_feel` / `they_feel`: ranges on how you feel about them / they feel about you, e.g. `{"affection": [40, 100]}`. Fields: familiarity, affection, attraction, trust, respect, rivalry, perceived.
- `me`: ranges on your own stats: stress (0-100), energy (0-100), social (0-100 (low = lonely)), fun (0-100 (low = bored)), mood (-100 to 100), gpa (0.0-4.0).
- `remembered` / `not_remembered`: facts set by `remember` ops in other scenes, to chain scenes together. A fact remembers who the scene was about, so a follow-up scene with the same `who` is about the same person.
- `once`: true by default (a scene happens once per story). Set false and add `cooldown_days` for things that can recur.

**Placeholders** in scenes: {best_friend}, {best_friend_first}, {me_first}, {partner}, {partner_first}, {pet}, {school}, {sibling}, {sibling_first}, {sport}, {them}, {them_first}, {town}. `{them}` is a full name and `{them_first}` a first name; `{sport}` is your main sport; `{pet}` your pet's name.

**People** ops can refer to in scenes: `them` (needs who), `best_friend`, `sibling`, `partner`. A scene whose title or text mentions someone (like `{sibling_first}` or `{pet}`) only happens when they exist; a choice that mentions someone only shows when they exist. Keep at least two choices that work for anybody.

**Choices**: `label` (what you do or say), optional `hint`, `fits` (which personalities lean this way when the game picks for you, trait: -1..1), and `ops`.

## Ops

| op | how to write it | what it does |
|---|---|---|
| `say` | `["say", "{them_first} grins. \"owe you one.\""]` | A line of dialogue or narration shown right after the choice. |
| `text` | `["text", "them", "thanks for today fr"]` | Someone (them, best_friend, sibling, partner) texts you this later today. |
| `rel` | `["rel", "them", "affection", 6]` | Change how YOU feel about someone (field, amount -30..30). |
| `rel_back` | `["rel_back", "them", "trust", 5]` | Change how THEY feel about you. |
| `mood` | `["mood", 4]` | Your mood, -20..20. |
| `need` | `["need", "stress", -6]` | energy, social, fun or stress, -30..30. |
| `trait` | `["trait", "confidence", 2]` | A personality trait, -10..10 (use sparingly). |
| `skill` | `["skill", "sport", 1]` | A skill, -10..10. "sport" means your main sport. |
| `interest` | `["interest", "guitar", 5]` | How into something you are, -30..30. "sport" works here too. |
| `rep` | `["rep", "tough", 3]` | Your reputation for something, -20..20. |
| `memory` | `["memory", "Covered for {them_first}", 0.4, 40, ["them"]]` | A memory: text, feeling (-1..1), how big (0..100), who was there. |
| `family` | `["family", "affection", 3]` | You and every sibling, both directions. |
| `focus` | `["focus", "social"]` | What you focus on next: balanced, athletics, academics, social, romance, family, rest. |
| `hang_out` | `["hang_out", "them"]` | Makes plans: you'll hang out with them at your next free time. |
| `remember` | `["remember", "covered_for_sibling"]` | Remember a fact so a later scene can depend on it. |
| `forget` | `["forget", "covered_for_sibling"]` | Forget a remembered fact. |
| `chance` | `["chance", {"base": 0.5, "charisma": 0.3}, [ops if it works], [ops if it doesn't]]` | Roll against your own traits and talents. base 0..1, then +coef x (stat - 50)/100 for each stat. |

Traits: sociability, confidence, discipline, ambition, impulsivity, empathy, competitiveness, curiosity, volatility, loyalty.  Talents: athletic, academic, creativity, technical, charisma.  Skills: academics, art, baseball, basketball, drama, fitness, football, music, tech, writing.

Keep effects small and believable: most relationship changes are 2 to 8; 10+ is a big moment. Good choices aren't free: the kind option can cost stress or energy, the bold one can backfire through `chance`.

## Checklist

- One JSON object, valid JSON, with a `name`.
- Pool, set, moment and op names exactly as listed.
- Only the placeholders listed for that spot.
- Scenes have 2 to 4 choices and unique ids.

