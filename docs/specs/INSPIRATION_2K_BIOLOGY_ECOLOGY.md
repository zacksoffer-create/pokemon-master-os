# Inspiration: NBA 2K, biology and ecology (received 2026-10-25)

Zack's brief for v1, with three planning conversations he had elsewhere. **Zack's own words are kept verbatim** (they
are the authority); the other assistant's replies are summarised underneath as planning notes, because they shaped
the conversation but aren't Zack's decisions.

## The brief

> let me rescope - i meant for the entire project im giving you free rein. i want a finished version of the entire
> project i described when i put in all of those chat gpt prompts and im going to include one more that i want built
> in. and then i want to give you the rein to build out a whole first version, incorporating everything and then i
> want you to execute the best possible product given all of this so here we go heres the biology part and then you
> can improve and change anything, just keep track of why and what decisions so i can make sense of it or make a
> decision on it

With the 6v6 engine (`sixvsix/`): *"here is the 6v6 engine first draft ... feel free to build out names and try to
build out this thing to the fullest of what im asking for and build it out and improve it in ways that i didnt think
of or see. and then ill use it and give my feedback"*

## 1. NBA 2K as inspiration (Zack, verbatim, lightly trimmed of dictation artefacts)

> I think the trainers and coaches thing is perfect ... having that conversation about what coach's philosophy is 2K
> has, what we can translate over ... just pick a simulator, pick a path, decide on it. I don't really super care what
> it is as long as it kind of follows what I just said about it. ... I think the coach's tendencies to that is very
> similar.

> game modes ... how people interact with 2K and translate relating that over to how ... we would interact with
> Pokemon. ... My Career is kind of about the individual, and for the individual level it's about the Pokemon ...
> it's why I think the build names is so important. It's why I think that, like, in a sense creating unique
> identities as much as possible for build names ... you're trying to ... create that experience of it being special
> for the individual ... what else can we draw from 2K's My Career mode, other My Career modes across the sports
> industry, other RPG games ...

> The franchise mode ... My GMs, My Era, ... My League, Ultimate Team. All of that stuff is kind of similar. It's that
> team building. It's that kind of what-if comparison. It's trying to build the best team possible ... I want to see,
> like, what a hypothetical team does against the 96 Bulls, or against the 17 Warriors, or against ... the 04 Spurs
> ... You want to do a fictional league, like a fictional kind of GM. In this case, a fictional trainer and their
> story ... GM traits and trainer traits can kind of ... mesh a little bit.

> badges is a good idea ... we already have the start of kind of, like, merit-based badges or team composition badges
> ... in old FIFAs, if you had a heading power of over 85, you automatically got the power header trait ... a
> stat-gated thing ... on the individual level ... is kind of where the tag feature comes in ... tagging everyone with
> an attack over this number as competitive attacker ... you come up with some sort of merit for the tag of physical
> attacker ... and then you build levels on top of that ... the big thing to do with is speed.

> in the same way you do GM traits, you can do trainer traits, and maybe that's mainly based off of just canon ... you
> go through trainers and you build in their teams, you build in their versions, and you really take time and care
> building out that list. You build out their tendencies ... for Ash, maybe you have 12 different versions of Ash ...
> four different versions of Gary ... four different versions of Paul ... a show canon version ... all the gym
> leaders ... all the champions ... tag them using those ... accomplishments ... a whole ecosystem about trainers ...
> those you can hardcode in because they don't change, and it's kind of what you use to set the standard of
> everything else.

> when you have these different versions of Poké Balls ... you take [Apricorns] to Kurt ... you can kind of build out
> different ball profiles ... break down the utility of the ball ... a nice kind of visual of, like, what it's like
> inside the ball.

> with a lot of the Pokémon cards, like they're pulling from one ... the HeartGold or SoulSilver entry ... What I
> really want is for it to pull from all of the games, Gen 1 through 4 ... and then put all of them together and kind
> of create this biological story, biological profile ... when I say hardcoded ... I more mean it in the sense of ...
> it's just built into the structure of it ... it's not the lab ... It's ... the standards, the control, as things that
> just don't change.

> we would take every Pokémon Gen 1 through 4 ... pull all of their kind of Pokédex entries from all the games,
> anything you can find in the canon ... make a biology report ... What do they eat? Where do they live? What kind of
> environments do they like? ... Off of that, you can determine what can they provide you ... how different moves ...
> ties into their biology ... how they would use those moves kind of in the wild ... egg moves ... is almost like a
> regional variant of it ... orcas have different species, and a lot of it is not ... genetic ... But what separates
> them is how they live and what they eat, how they hunt, how they live, how they communicate ... you do each Pokémon
> with its moveset as a whole ... and then the egg moves, you can determine how each egg move combines with all of
> those to change its behavior. And then ... how multiple egg moves would combine ... based off of what route it lives
> on ... and then on top of that, what it can do for the homestead.

## 2. Biology (Zack, verbatim)

> This one is gonna be my major project. This one I'm gonna want a lot of input in. You know, I have a background in
> biology ... I'm really excited about this part of it. I think it's really doable ... people are doing it themselves,
> making their Pokémon National Geographic things ... I want this to be real ... I don't think this one is super heavy
> mechanics-wise though ... this one is just more of a ... something that we will spend time and effort on or do a lot
> of searching on ... I do want to build food webs ... we can get really complicated and really create ecosystems here
> ... you really can kind of recreate routes and habitats, which I think is really interesting and something that I'll
> probably pursue.

## 3. Ecology (Zack, verbatim)

> let's talk about ecosystems and food webs and creating something actually based on biological principles

## Planning notes from the other assistant (summarised, not Zack's decisions)

**2K mapping.** MyCAREER → the individual Pokémon (identity, builds, specialties, progression, achievements);
MyNBA/MyLEAGUE → team construction and historical what-ifs; MyGM → trainer management and philosophy; MyTEAM →
fantasy roster experimentation; badges and attributes → tags, thresholds, qualifications; coach tendencies and
playbooks → trainer AI profiles; historical eras → generation and canon environments. Borrow the systems design, not
the monetisation or artificial progression. Personal campaign teams and unrestricted hypothetical teams both belong,
under different constraints. Keep a tag's *recognition* separate from any invented *battle effect*.

**The reference world.** "Hardcoded" means a curated, sourced, versioned reference layer (species and biology, moves
and mechanics, trainer history, items, ecology, benchmarks) that personal records point to; stable but revisable
through explicit research revisions.

**Biology.** Three layers: species biology, individual specialisation, ecological context. Four evidence classes:
direct canonical evidence, strong biological inference, plausible ecological hypothesis, Blackthorn world-building,
with a separate confidence rating. A dossier: anatomy, diet and foraging, habitat, behaviour, ecology, reproduction,
capabilities, human relationships; a readable field guide over a research archive of the original entries. Moves
explain biology but don't define it: natural anatomy, species movepool and an individual's moves are three
categories. Egg moves suggest ecological specialisations or behavioural ecotypes, not canonical subspecies;
combinations matter and a lineage can carry a tradition. A research pipeline: collect, extract claims, classify,
synthesise, add interpretations separately, review, reuse. Start qualitative; add quantitative models selectively.

**Ecology.** Six areas: primary productivity and energy flow; trophic relationships; habitat and niche structure;
population and community ecology; non-trophic interactions (mutualism, commensalism, parasitism, engineering,
dispersal, pollination); ecosystem dynamics. Not every organism in an ecosystem is a Pokémon: forests need plants,
fungi, soil organisms and deadwood. Encounter tables establish presence, detectability and activity, not abundance.
Ilex Forest as the first ecosystem (canopy, understory, pond, deadwood and soil). Documented links: tree roots →
Paras, Paras → its mushroom (parasitism), flying insects → Pineco, Oddish's plant-like nutrition; a decomposer guild
required by principle, its members unresolved. Three depths: Level 1 reconstruction, Level 2 functional analysis,
Level 3 dynamic simulation (e.g. logistic growth dN/dt = rN(1 − N/K)), the last with transparent, sensitivity-tested
assumptions. Habitats connect into a regional landscape. Open question put to Zack: how literally to take encounter
tables (strict game ecology, evidence-based reconstruction, or naturalistic first); the other assistant preferred
evidence-based reconstruction.
