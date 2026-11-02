You're upgrading a dialogue pack (one of my storylines) for LIFE OS, a life-simulation game: you play one person from
the first day of high school (Guilford High School in Guilford, Connecticut) through college. Texting in the game just got a
lot deeper, and I want the people in this storyline to text like themselves. Add a big "chat" section to the pack.

How texting works now:
- I can type anything to anyone, or tap a suggestion. The game reads what I did: say hi, ask something, chat, joke, compliment,
  flirt (in a style: tease, sweet, bold, funny or cheesy), make plans, check on them, apologize, vent about my day, share good
  news, gossip, say thanks, go dry, be rude, say bye, or ask them out.
- They answer from lines picked by what I did and how it went (a joke can land or not, a flirt can land, be playful, get
  awkward or get shut down, venting gets comfort or a shrug). They often ask me something back, and the game offers fitting
  answers. A conversation runs until they wrap it up. Someone into me answers fast and sometimes double-texts.
- Everyone has a taste: some love teasing, some love sweet stuff, some hate cheesy lines. Each style can land or miss.
- They remember: if I mention a test or a game they follow up later, and when we just did something together (a hangout, a
  date, the boys, a game we won or lost) they bring it up when we start talking.
- Lines can belong to a kind of person (older_sibling, crush, coach...): those people use their own lines first, so a brother
  texts like a brother and a coach like a coach.

Do all of this:
1. Keep the "name" exactly the same (so it replaces the old pack when I paste it in), and keep everything already in the pack.
2. Add a "chat" section. For every person this storyline is about, add their own lines under "chat": {"people": {"<kind>": {...}}},
   using the kinds of people listed below, the most specific one that fits (older_brother, not older_sibling, when it's about
   my brother). If the pack's scenes use a general kind for someone specific, change their "who" to the specific kind too.
   Write the lines so you could tell who's texting without a name.
3. For each of those people, fill at least:
   - reply.greet (warm, ok, cold), reply.chat (warm, ok, cold), reply.ask (warm, ok, cold), reply.joke (laugh, meh),
     reply.compliment (warm, weird), reply.vent (comfort, meh), reply.news (hype, meh), reply.plans (yes, no, already),
     reply.apology (accept, cold), reply.support (thanks, fine), reply.thanks (warm, ok), reply.dry (dry, check)
   - ask.general: questions they'd text back, each {"q": "...", "a": "yesno" | "doing" | "day" | "weekend" | "open" | "flirty"}
   - topic (game, school, music, weekend, food), follow (school, game, weekend), recent (hangout, date, group, game_win, game_loss)
   - close (nice, tired, cold)
   - suggest: things I'd text THEM (greet, ask, joke, plans, support, apology, vent, news, thanks, bye)
   For a crush, partner or ex, also: reply.flirt (landed, playful, awkward, shut), reply.style (loves, hates), reply.ask_out
   (yes, no), reply.love (back), ask.flirty, double, and suggest.flirt_tease, flirt_sweet, flirt_bold, flirt_funny, flirt_cheesy.
   For a sibling, also reply.family (sib_flirt, sib_ok, sib_warm) and reply.love (fam).
4. At least 6 lines in every list, more for the ones that come up most (greet, chat, ask, close). Short, like real texts (under
   120 characters). Vary them: openers, lengths, moods. Don't repeat an idea.
5. Add general lines too (top level of "chat", same shape) for anyone in the storyline's world: at least 6 more for each of
   reply.vent, reply.news, reply.gossip (spill, shut), reply.thanks and recent.
6. Use {me} for my first name if you need it; no other names or placeholders in chat lines. Keep it PG-13.

Reply with the COMPLETE upgraded pack as ONE JSON code block and nothing after it: valid JSON, no comments, no trailing commas.
The game checks every line and will tell me exactly what to fix.

Here's my pack:

[paste your pack's JSON here]

## The "chat" section

Every list is short text lines. The same shape works at the top level (anyone) and under people.<kind> (just them).

Their answers, `reply.<what you did>.<how it went>`:
- reply.greet: warm, ok, cold
- reply.chat: warm, ok, cold
- reply.ask: warm, ok, cold
- reply.joke: laugh, meh
- reply.compliment: warm, weird
- reply.flirt: landed, playful, awkward, shut
- reply.plans: yes, no, cold, already
- reply.support: thanks, fine
- reply.apology: accept, cold
- reply.dry: dry, check
- reply.rude: hurt
- reply.love: back, fam
- reply.ask_out: yes, no
- reply.family: sib_flirt, sib_ok, sib_warm
- reply.answered: yes, no
- reply.style: loves, hates
- reply.partner: miss
- reply.vent: comfort, meh
- reply.news: hype, meh
- reply.gossip: spill, shut
- reply.thanks: warm, ok

Questions they ask back, `ask.general` / `ask.flirty`: each {"q": "...", "a": kind}; a is one of yesno, doing, day, weekend, open, flirty.
Answers I can tap, `answer.<kind>`: doing, day, weekend, yes, no, open, flirty.
What I brought up, `topic.<topic>`: game, school, music, weekend, food.
Following up later, `follow.<topic>`: school, game, weekend.
Something we just did together, `recent.<kind>`: hangout, date, group, game_win, game_loss.
Wrapping up, `close.<tone>`: nice, tired, cold. Extra texts from someone into me: `double`.
Things I'd text them, `suggest.<kind>`: greet, ask, answer, joke, compliment, flirt, flirt_strong, plans, support, good_luck, congrats, apology, love, bye, flirt_tease, flirt_sweet, flirt_bold, flirt_funny, flirt_cheesy, ask_out, vent, news, thanks.

## Kinds of people (for chat.people)

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
- `brother`: A brother.
- `sister`: A sister.
- `older_brother`: An older brother.
- `older_sister`: An older sister.
- `younger_brother`: A younger brother.
- `younger_sister`: A younger sister.
- `twin`: Your twin.
- `coach`: A coach of one of your teams.

## Example

```json
{
 "name": "My storyline",
 "chat": {
  "people": {
   "older_sibling": {
    "reply": {
     "greet": {
      "warm": [
       "what do you want",
       "oh look who remembered i exist"
      ]
     },
     "vent": {
      "comfort": [
       "who do i need to fight",
       "come to my room, we'll figure it out"
      ]
     }
    },
    "ask": {
     "general": [
      {
       "q": "did you take my charger",
       "a": "yesno"
      }
     ]
    },
    "suggest": {
     "ask": [
      "can you drive me later",
      "is mom mad at me or"
     ]
    }
   },
   "coach": {
    "reply": {
     "greet": {
      "warm": [
       "Hey. What's up.",
       "Talk to me."
      ]
     }
    },
    "recent": {
     "game_win": [
      "Good game tonight. Film at 3.",
      "Proud of that effort. Don't get comfortable."
     ]
    }
   }
  },
  "reply": {
   "gossip": {
    "spill": [
     "no WAY. who told you"
    ]
   }
  }
 }
}
```

