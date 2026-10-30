# LIFE OS v0.1: design notes and assumptions

This document records the decisions made while building v0.1: what each engine does, the
mechanics as implemented, the assumptions behind them, and where to extend. All numbers are
experimental design values meant to be tuned in the Engine Workshop, not claims about real life.

## 1. Architecture

A modular monolith in Python with a React lab on top.

| Layer | Module | Responsibility |
|---|---|---|
| Foundation | `rng.py` | Seeded random streams derived from (seed, stream name, keys); softmax pick with a recorded roll |
| | `rules.py` | Rules schema (`data/rules_schema.json`): types, ranges, defaults, validation, cross-checks, version hashes |
| | `catalogs.py` | Data catalogs (actions, world, people, templates, goals) plus per-world action overrides and their validation |
| | `model.py` | The world: characters, directed relationships, bonds, households, groups, cliques, rumors, calendar, schedule |
| | `history.py` | Events, decision traces, the `Effects` change recorder, retention and compaction |
| | `calendar.py` | Dates, phases of the day, breaks, and the yearly institutional calendar |
| | `storage.py` | SQLite saves (compressed full snapshots) and experiment records |
| Intelligence | `decision.py` | Candidate generation, named utility terms, softmax choice, traces |
| | `development.py` | Goals (generation, priority, closure), skill decay, interest drift toward friends, habit decay |
| Domains | `actions.py` | Resolvers for individual actions: solo activities, interactions, romance, conflict, information, risk, sign-ups, jobs, parties, mentoring |
| | `social.py` | Interaction quality and perception, relationship labels and milestones, popularity, clique detection, rumors |
| | `institutions.py` | The school day, exams, lunch tables and exclusion, practices, tryouts and auditions, games, shows, dances, parties, elections, jobs, graduation, the new year |
| | `households.py` | Guardian reactions, allowance, weekends away, support |
| | `narrative.py` | Template rendering from structured events (presentation-only randomness) |
| Lab | `metrics.py`, `experiments.py`, `spreadsheet.py`, `api.py` | World statistics, isolated multi-process experiments, the Excel round-trip, and the HTTP API |
| Orchestration | `engine.py` | `Simulation`: phases, slots, invitations and responses, fallbacks, nightly and weekly processing, player mode, lab edits |

## 2. Characters: separated layers

| Layer | Fields | Changes how |
|---|---|---|
| Stable tendencies | 10 traits: sociability, confidence, discipline, ambition, impulsivity, empathy, competitiveness, curiosity, volatility, loyalty | Very slowly. Confidence drifts with success and failure, scaled by volatility, and settles back toward its own baseline. |
| Natural aptitude | athletic, academic, creativity, technical, charisma | Fixed. Sets each skill's growth rate and ceiling. |
| Learned capability | 9 skills | Practice, team practice, classes and mentoring raise them; they fade when unused. |
| Motivations | achievement, approval, belonging, pleasure, altruism, mastery | Fixed per person. Global multipliers in the Workshop. |
| Condition | energy, social, fun, stress, mood | Daily drain and recovery; events. |
| Circumstances | household (style, income, pet), money, memberships, grounded/pressure flags, partner | Institutions, households, choices. |
| Experience | memories, learned expectations per action, habits, reputation tags | Every outcome. |

**Talent vs. discipline**, the case named in the brief. A practice session gains
`base x 0.55 x skill_rate x (0.4 + 1.2 x aptitude/100) x ceiling_factor`, scaled by session quality.
- **Session quality** depends on discipline, energy and stress.
- **The ceiling** is `(1 - w) x 100 + w x aptitude`, where `w` is the talent-ceiling weight.
- **How often someone practices** comes from discipline in the utility model.

So a talented, undisciplined athlete grows fast per session but practices rarely and gets dropped
by coaches for missing practice. A modestly talented, disciplined one practices constantly, impresses
effort-minded coaches, and rises to a lower ceiling.

## 3. Relationships

Directed: `rels[(a, b)]` is how `a` sees `b`.

**Fields:**
- familiarity
- affection (−100..100)
- respect
- attraction
- trust
- rivalry
- `perceived`: a's belief about b's affection for a

**Labels** (stranger, acquaintance, friend, close friend, best friend, rival, dislikes) are derived per
side from thresholds in the rules. Crushes are a separate flag. **Formal roles** (sibling, partner, ex,
teammate) live in undirected bonds.

**Perception.** An interaction has one true quality. Each participant experiences it with their own
noise. Each then updates `perceived` from a noisy reading of the other: the noise is reduced by
empathy, and confidence adds an optimistic bias. That is how one person comes to believe they are
close friends while the other sees an acquaintance. The Social Network's *Perception gaps* tab shows
the largest disagreements.

**Milestones** fire when a label crosses a threshold; repeats within 90 days are ignored. Affection
fades toward neutral without contact (4% a week by default; half that for partners and siblings).

## 4. Decisions

For each decision slot, every acting character:
1. **Enumerates candidates** from `data/actions.json`: role and slot eligibility, requirements (money,
   grounded, romance on/off, weekend, a household that allows parties...) and a target selector.
   Selectors include known people, strangers, crushes, partner, grudges, falling-outs, struggling
   friends, listeners with a rumor to share, opportunities, memberships, scheduled events, parties and
   siblings. Attention is bounded: at most `shortlist_size` people are considered per action, the
   strongest relationships plus one at random.
2. **Scores each candidate** as a sum of named terms:
   - base
   - needs (urgency^1.5)
   - motives × global motive weights, and traits
   - interest
   - target terms (affection, attraction, rivalry, popularity × approval, grudge...)
   - memories with the target (capped; reversed for conflict actions)
   - learned experience (negative experience amplified by low confidence), habit, and friends' recent behavior × belonging
   - risk × personal risk aversion, and commitment × discipline/loyalty
   - goal contributions and situational terms (homework, tryouts today, already has plans, nerves...)
3. **Shares probability among an action's targets.** Every candidate gets `−T·ln(n)`, so an action
   with many possible targets doesn't win just because it has more entries.
4. **Draws a softmax** with temperature `T x (1 + impulsive_noise x (impulsivity − 50)/100 + stress over 70)`.

All characters decide from the same start-of-slot state. Decisions are then resolved in a seeded order.
- **Invitations:** the other person compares the appeal of accepting (scored from their own point of
  view, +4 for being asked) against their own plan. Accepting cancels that plan. If the invitation
  falls through, the inviter does their best solo option instead.
- **Collective events** resolve after the individual choices.

**Traces** keep every candidate's utility and probability, the full term breakdown for the top five
and the chosen one, the temperature, the roll and a pointer to the rules version in effect.
Explanations in the UI are built only from these recorded numbers.

## 5. Events and consequences

Every resolver follows the same contract:
1. evaluate circumstances;
2. draw from the actor's resolution stream;
3. record each factor, probability and roll in `calc`;
4. change state only through `Effects`, which logs `[entity, field, before, after, why]`;
5. create memories and rumors;
6. schedule delayed consequences.

Examples of delayed consequences: tryout and audition results post the next morning; parents find
out about a prank the next day; a loyal friend tells the subject of a rumor; a hiring decision comes
two days after applying.

**An emergent loop the brief asked for:**
1. A student tries out and is cut. The coach's evaluation is recorded:
   `talent weight x performance + effort weight x (discipline + recent practice) + favoritism + seniority`.
2. Their reaction depends on resolve (competitiveness + discipline + ambition − volatility + confidence).
   Resilient students form "get better at X" and "make the team next time" goals, and their interest
   rises. Others lose interest.
3. The goals raise the utility of practice; skills grow.
4. If a rostered player is dropped for missing practices, the coach calls up the best cut candidate
   still interested.

None of this is scripted as a sequence.

## 6. Institutions in the first world

**Teams** (soccer in fall, basketball in winter, baseball in spring):
- tryouts (sign-up window, attendance, nerves, coach evaluation, next-day results, captain)
- practices, weekly games (strength vs. a random opponent, a standout player, spectators)
- rolling attendance: dropped for missing more than 4 of the last 8 sessions, configurable
- call-ups, and season end

**Drama:** two productions a year with auditions, a lead, rehearsals and a show with a review.

**Clubs** (art, robotics, jazz band, the paper): open membership, weekly meetings, members drift away
when they stop showing up.

**Student council:** sign-ups and an election where each student votes from affection, respect,
popularity × approval, clique loyalty and noise.

**Jobs:** two employers; hiring scored on discipline, charm and reputation; shifts; firing for missed shifts.

**School:**
- classes: academic skill, ambient classmate contact, daily stress
- quizzes every two weeks, midterms and finals, which feed GPA
- report cards with guardian reactions
- dances with asking windows, dates and wallflowers
- parties: hosts need a permissive or away household; invitations, crashers, kisses, fights,
  getting busted, hurt feelings over not being invited

**Graduation and the new year:** seniors become alumni and keep their relationships; the rest move
up a grade; new freshmen arrive, sometimes as younger siblings; the calendar rebuilds.

## 7. Randomness and reproducibility

Streams are derived with BLAKE2b from (seed, stream, keys):
- `decide/day/slot/char`
- `resolve/day/slot/char`
- `collective/day/slot`
- `order/day/slot`
- `weekly/day`, `dawn/day`, ...

World generation uses separate streams from `gen_seed`. Narrative wording uses its own stream, so
editing templates never changes outcomes. There is no RNG state to save; the tests verify three things:
- a loaded save continues exactly like the uninterrupted run;
- tracing on and off produce identical worlds;
- the same seed reproduces the same event sequence.

## 8. Experiments

Each (variant, seed) run deserializes its own copy of the base world in a worker process, with
history off. Variants reuse the baseline's seeds (common random numbers).

**Single seed: a deterministic paired comparison.**
- the metric differences;
- the per-character differences: friends, popularity, mood, GPA, groups gained or lost, partner changes;
- the first day the two timelines diverged (from a per-day digest of everyone's actions).

**Several seeds: a repeated-run measurement.**
- per-seed paired differences;
- mean, SD, a 95% t-interval and the count of seeds that went each way;
- an effect size (mean difference divided by the pooled SD).

The UI and `demo.py` say which kind of result they are showing, and warn that small samples are provisional.

## 9. Assumptions worth revisiting

- **Two decisions per day** (lunch plus after school on school days; daytime plus evening otherwise)
  is enough resolution for social life. Staff decide once a day.
- **Guardians are part of the household, not agents.** Their style parameters drive reactions.
- **Popularity is a rank:** a percentile of a weighted "known × liked/respected by people who are
  themselves popular" score, plus prestige from membership.
- **Cliques are mutual-affection communities** found weekly by label propagation (minimum size 3).
  A clique that dissolves and returns within four weeks keeps its identity.
- **Orientation is a simple per-person set of genders** and gates both attraction growth and a
  romantic yes. Pair chemistry is a fixed latent value per pair, so some pairs just click.
- **Money is coarse:** an allowance by income level, part-time pay, and costs for outings, dates and parties.
- **Default balance:** the default values produce plausible years for the demo world; other worlds
  and seeds vary a lot. Expect to tune.

## 10. Extension points

- **New actions:** add an entry to `data/actions.json` with an existing resolver (`solo`, `interact`
  and others), or register a resolver with `@resolver("name")` in `actions.py`. Target selectors live in
  `decision.targets`.
- **New goals:** add a type to `data/goals.json` (label, advancing actions and weights) and a
  generation rule in `development.generate`.
- **New institutions:** add a group to `data/world.json`. Teams, productions, clubs, councils and jobs
  already work. A new kind needs calendar entries (`calendar.build_year`) and a collective resolver in
  `institutions.after_slot`.
- **New rules:** add a parameter to `data/rules_schema.json` and read it where needed. The test suite
  fails if a parameter is never read.
- **New domains** (careers, adult life, pets as agents): add roles to the action catalog's `roles`,
  slot actors in `engine.slot_actors`, and the domain module.
- **Spreadsheet master:** `spreadsheet.py` already round-trips Rules, Actions and Characters. Groups,
  templates and goals would follow the same pattern.
