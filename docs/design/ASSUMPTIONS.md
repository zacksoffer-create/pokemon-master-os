# Assumptions register

What the assistant assumed while building, so you can see each one and keep, change or reject it (Zack, 2026-10-24: *"make assumptions and decisions as you need to, just keep track so I can have my input"*). Generated from `engine/store/assumptions.json` by `engine/store/assumptions.py`; the same items are in the app under **Your calls**, each with a link to where it shows. Every item is reversible; each phase's set is one PROVISIONAL row in `docs/DECISION_LEDGER.md`.

## Master plan defaults

### A-01 · Ace test (D-066)

The Ace score is the plain average of the two win rates (Elite Four and Champions). It decides nothing on its own: Ace is earned only by clearing both bars.

- **Why:** Q1 of the master plan was open and blocked the build; the average was already what the engine computed.
- **See it:** `#/standards` (The standards)
- **Could instead:** weight the Champions more; use the lower of the two rates
- **Your call** (2026-10-26, chat): Keep: "the ace score is fine where it is"

### A-02 · Ace test (D-066)

The Elite Four's and Champions' Pokémon fight with no EVs (the games give trainers none); the unread field_evs_each: 85 setting was removed. Our builds with blank EVs still fight on 85 each (D-061).

- **Why:** Q2: it's how the Ace count you accepted in D-064 was made, so the numbers stay what you saw.
- **See it:** `#/standards` (The standards)
- **Could instead:** give their side 85 each too (every Ace number would move)
- **Your call** (2026-10-26, chat): Keep

## v2.5 · Everything in git

### A-03 · Storage (D-066)

Everything is kept in git. The app still saves to your Sheet as you go (it can only write to the Sheet and Drive), and Record → Keep it in git makes the bridge: one tap saves a copy of every app tab and your unsaved changes (a new file in the Drive folder "Blackthorn HQ records", or a download in the preview), and engine/store/personal.py --from files it into the project: store/personal.json, store/tabs.json, store/drafts.json. A copy only adds rows, so nothing in git is lost if a later copy lacks it. The app starts from git and lays the live Sheet over it; pictures stay in the Drive folder, listed in git through My Artwork.

- **Why:** Your call: "We should probably keep everything in Git."
- **See it:** `#/record/git` (The record, Keep it in git)
- **Could instead:** copy only your Pokémon, builds and teams, not the logs; take the copy straight from the Sheet with the Sheets connector instead of a file (needs the Sheet the app writes to)
- **Your call** (2026-10-26, chat): Change: everything in git. "We should probably keep everything in Git."

## Master plan defaults

### A-04 · Your Pokémon (D-066)

You can have several of the same species in one game; each gets its own id with a token.

- **Why:** Q4: a breeding program needs more than one of a line.
- **See it:** `#/mine` (Your Pokémon)
- **Could instead:** one per species per game
- **Your call** (2026-10-26, chat): Keep

## Phase 4 · breeding stock

### A-05 · Blueprints (D-067)

A blueprint is a design: a build marked kind 'blueprint' in My Builds, as many as you like. D-038 still decides which animals live at the ranch.

- **Why:** Q10 of the master plan; a design costs nothing to keep.
- **See it:** `#/stock` (Breeding stock)
- **Could instead:** cap blueprints per line; blueprints only for ranch lines
- **Your call** (2026-10-26, chat): Keep

### A-06 · Hatch rules (D-067)

When the breeding page says a moveset is 'possible', it means an egg could really hatch with those moves, the way the games build an egg: which moves are passed down, which get pushed out when there are more than four, and the level it hatches at (5 in Gens II-III, 1 in Gen IV). It's information only: whether a Pokémon can learn a move is still what decides what you can build.

- **Why:** The code is the most exact source there is.
- **See it:** `#/stock/heartgold/Swinub` (Swinub's catalogue)
- **Could instead:** a simpler 'any egg move' rule
- **Your call** (2026-10-26, chat): Not sure what it means: asked for plainer words (rewritten). *(later)*

### A-07 · Lineages (D-067)

A line's own male can be a link in a breeding chain (hatched with some moves, learns the rest himself).

- **Why:** Larvitar's lines were empty without it.
- **See it:** `#/stock/heartgold/Tyranitar` (Larvitar's catalogue)
- **Could instead:** fathers from other lines only
- **Your call** (2026-10-26, chat): Keep

### A-08 · Studbook (D-067)

Among equally short planned pedigrees, the studbook prefers a journey companion who can reach the game on cartridge (same generation, or Gen 3 to 4 by Pal Park). A Crystal companion in a Gen 4 cross is still allowed; B29 stays your call.

- **Why:** It keeps a plan doable on real cartridges.
- **See it:** `#/breeding/studbook` (The studbook)
- **Could instead:** no preference; only same-generation companions
- **Your call** (2026-10-26, chat): Keep

## v2.5 · Breeding stock

### A-09 · What a set suggests (D-067)

'What a set might suggest' lists the evidence by kind (game mechanics, canon about the species), then reads it by fixed rules. Each sentence is marked a hypothesis and names its rule and what it rests on. Only the parents' moves are read as the line's; the ability, nature, IVs and purpose are read as what you intend. With nothing to go on, it says there's too little to read.

- **Why:** Your call (2026-10-26, chat): "You can propose an interpretation, that's fine."
- **See it:** `#/stock` (Breeding stock)
- **Could instead:** show only the evidence and draw no conclusion (as before); one overall reading per set instead of a sentence for each rule that fires
- **Your call** (2026-10-26, chat): Change: let it propose an interpretation, marked hypothetical. "You can propose an interpretation, that's fine."

## Phase 5 · Trainer Library

### A-10 · Who's in the library (D-068)

Every Gym Leader, Elite Four member, Champion, rival meeting, rematch and villain boss or admin of the five games, plus the special battles (Red, the Kimono Girls, Eusine, Li and a few more). Route trainers, the Battle Tower and Frontier facilities, and partner-only teams are left out.

- **Why:** The spec's 'notable trainers'; the left-out ones are thousands of teams nobody benchmarks against.
- **See it:** `#/trainers` (The directory)
- **Could instead:** add the Frontier Brains; add the Battle Tower or route trainers
- **Your call** (2026-10-26, chat): Keep

### A-11 · Names (D-068)

Rivals you name in the game get their usual names: Crystal and HeartGold's '?' is Silver, Platinum's 'Cedric' placeholder is Barry, FireRed's 'Terry' placeholder is Blue.

- **Why:** The data holds a placeholder, not a name; these are the names everyone uses.
- **See it:** `#/trainer/silver` (Silver)
- **Could instead:** your own names for them
- **Your call** (2026-10-26, chat): Keep

### A-12 · Identities (D-068)

The games' Blue and the anime's Gary are one trainer (Gary, also listed as Blue), with every version under him.

- **Why:** They're the same character; the library is identity → versions.
- **See it:** `#/trainer/gary` (Gary)
- **Could instead:** two identities, Blue and Gary
- **Your call** (2026-10-26, chat): Keep

### A-13 · Identities (D-068)

The anime's May and Emerald's rival May are one trainer. Brendan stays his own.

- **Why:** Same character across media, like Blue and Gary.
- **See it:** `#/trainer/may` (May)
- **Could instead:** separate the anime May from the games' May
- **Your call** (2026-10-26, chat): Keep

### A-14 · Identities (D-068)

Crystal's unnamed Rocket Executives are one group identity (Rocket Executives, Crystal); HeartGold's named ones (Archer, Ariana, Petrel, Proton) are their own trainers. The five Kimono Girls are one group identity.

- **Why:** Crystal doesn't say which executive is which; the Kimono Girls fight as a set.
- **See it:** `#/trainer/rocket-executive` (Rocket Executives)
- **Could instead:** map Crystal's executives onto Archer, Ariana, Petrel and Proton; each Kimono Girl her own trainer
- **Your call** (2026-10-26, chat): Keep

### A-15 · Encounters (D-068)

Each encounter is its own version: a rematch is its own record, a rival's team per starter you chose is its own version ('you chose Chikorita'), and repeat meetings are numbered ('meeting 3 of 7'). HeartGold's tag battles are kept as the trainer's three-Pokémon team; double battles are kept as teams (benchmarks are one-on-one either way).

- **Why:** The spec asks for versions you can compare and pick; one record per real fight does that.
- **See it:** `#/trainer/silver` (Silver's meetings)
- **Could instead:** fold rival starter variants into one version
- **Your call** (2026-10-26, chat): Keep

### A-16 · Abilities and natures (D-068)

When the game doesn't fix a trainer Pokémon's ability, Blackthorn reads the species' first ability (marked standardized); HeartGold's ability overrides are kept. Natures come from a hidden value the data doesn't fix: marked unknown, and fights use a neutral nature.

- **Why:** The ability and nature are rolled from values the trainer data doesn't hold; guessing would look like fact.
- **See it:** `#/trainer/cynthia` (Cynthia's team)
- **Could instead:** compute the Gen 4 personality value (deterministic, but a lot of code); try both abilities
- **Your call** (2026-10-26, chat): Keep

### A-17 · Evidence classes (D-068)

Every field of every team member carries one of five classes. Cartridge: species, level, moves, IVs, EVs and item confirmed, ability standardized unless the game sets it, nature unknown. Reconstructions: species confirmed; approved moves confirmed, drafted ones strongly inferred; an authored ability strongly inferred, else standardized; item unknown unless shown; nature, IVs, EVs and level standardized. In your own versions a field you kept keeps the original's class, a changed one is hypothetical.

- **Why:** Spec criterion 3: say what a version rests on, field by field.
- **See it:** `#/trainer/ash/ash%2Fsinnoh` (Sinnoh Ash's research)
- **Could instead:** fewer classes (known / assumed)
- **Your call** (2026-10-26, chat): Keep

### A-18 · How they think (D-068)

The games' AI flags are read two ways: tendencies (sets up early, takes risks, weather...) and competence (avoids failing moves, weighs damage, expert judgment). Coach settings are tendencies, measured sliders are evidence, authored sliders are 'your reading', an interpretation (master plan Q9).

- **Why:** A flag says how moves get scored, not what the trainer plans; keeping the kinds apart stops an interpretation passing as a measurement.
- **See it:** `#/trainer/cynthia` (How Cynthia thinks)
- **Could instead:** one combined 'AI level'
- **Your call** (2026-10-26, chat): Keep

### A-19 · Benchmarks (D-068)

A collection's default bar is 70%. The Ace collections keep the Ace test's own bars (80% Elite Four, 70% Champions). You can move any bar on the benchmark page; the group's version stamp changes with it.

- **Why:** 70% matches the Champion bar you already accepted.
- **See it:** `#/bench` (Benchmarks)
- **Could instead:** a different default; a bar per collection
- **Your call** (2026-10-26, chat): Keep

### A-20 · Benchmarks (D-068)

A group's rate counts each distinct Pokémon once (the same species, set and level is one fight), as the Ace test does; a team's own line counts each of its Pokémon. A draw isn't a win.

- **Why:** It's the Ace test's rule, so the Ace collections give the Ace test's numbers. How rematches should weigh is still master plan Q6.
- **See it:** `#/bench?c=ace-champion-gen4` (The Ace collections)
- **Could instead:** count every team slot (a rematch counts twice); a draw as half a win
- **Your call** (2026-10-26, chat): Keep

### A-21 · Lenses (D-068)

Two lenses. 'As encountered': their team exactly as the game has it, yours at their top level. 'Standardized': both at Lv 100 (the Ace test's terms). Game collections default to as encountered; the Ace, anime and journey groups to standardized. A reconstruction has no game levels, so it's always standardized.

- **Why:** The spec asks both 'how would mine do in the game' and 'how does mine compare on equal footing'.
- **See it:** `#/bench` (Benchmarks)
- **Could instead:** yours at its own level; a level cap per game
- **Your call** (2026-10-26, chat): Keep

### A-22 · Benchmarks (D-068)

A benchmark runs in your Pokémon's generation; a team from another generation is skipped and listed, not converted. Moves your build doesn't list are filled from the strongest set in the generation's reference game (Crystal, Emerald, Platinum), as the Ace test fills them.

- **Why:** Converting a team across generations would invent moves and mechanics.
- **See it:** `#/bench` (Benchmarks)
- **Could instead:** read Gen 3 teams in Gen 4 rules
- **Your call** (2026-10-26, chat): Keep

### A-23 · Your versions (D-068)

Your versions of a trainer are teams in My Teams with three new fields (kind, trainer, parent): kind 'custom' (optimized or what-if) or 'all-time'. 'Optimize' gives every member the engine's strongest set at Lv 100 and keeps species, ability and item. The original version never changes.

- **Why:** Spec criterion 9, on the record store you already have; the team lab opens them like any saved team.
- **See it:** `#/trainers/variant/platinum%2Fcynthia` (Make a version of Cynthia)
- **Could instead:** a separate Trainer Versions tab; optimize by fights instead of the strongest set
- **Your call** (2026-10-26, chat): Keep

### A-24 · Your groups (D-068)

Groups of teams you make on the benchmark page stay in this browser, not the Sheet.

- **Why:** A quick test shouldn't need a Sheet change; if you use them a lot they can move to a tab.
- **See it:** `#/bench` (Benchmarks)
- **Could instead:** save them to a My Groups tab in the Sheet
- **Your call** (2026-10-26, chat): Keep

### A-25 · Collections (D-068)

The collections are: per game, the Gym Leaders, Gym rematches, Elite Four with the Champion, their rematches, rival battles, villains and special battles; the Ace test's pools; the Gen 4 anime reconstructions; and your three Gen 4 journey teams.

- **Why:** One group per question you'd ask of a game; the Ace pools so the library and the Ace test agree.
- **See it:** `#/trainers` (The directory's collections)
- **Could instead:** add a 'whole league' group per game; add your Gen 2-3 journey teams
- **Your call** (2026-10-26, chat): Keep

### A-26 · Intake (D-068)

A new claim kind, trainer_version, adds a version of a trainer with its roster once approved: its id must be new (a revision names the version it revises as parent, and the original stays), a trainer not in canon yet is added only when the claim gives a name, and each team member becomes a build in the library (<trainer>-<version>/<species>).

- **Why:** The master plan's 'intake that can create versions and rosters', without ever overwriting a version (D-049: approved before it lands).
- **See it:** `#/inbox` (The inbox)
- **Could instead:** let a claim replace a version's roster in place; a separate claim kind per roster change
- **Your call** (2026-10-26, chat): Keep

### A-27 · Corrections (D-068)

A correction to a build in the library makes a new version of it: the old values are kept under the build's history with their version number, and the record store lists both. Corrections to a trainer's career or signature moves still change the value in place (the claim keeps the old value in its note).

- **Why:** The master plan: approved corrections overwrote build fields in place, which broke 'never overwrite canonical'.
- **See it:** `#/inbox` (The inbox)
- **Could instead:** version trainer corrections too; make each correction a separate build id
- **Your call** (2026-10-26, chat): Keep

## Phase 6 · Poké Balls and equipment

### A-28 · Exterior art (D-070)

Each ball's exterior is the official Dream World art where it exists (15 balls), otherwise the game's own sprite, shown large and crisp. Art you upload replaces it everywhere. No AI-made exteriors.

- **Why:** Image generation isn't open to this project's free Gemini key, the spec rules out new paid services, and a made-up exterior could get the design wrong.
- **See it:** `#/balls` (The Poké Ball Collection)
- **Could instead:** commission or generate high-resolution exteriors and upload them; hotlink a fan wiki's renders
- **Your call** (2026-10-26, chat): Keep

### A-29 · Interior art (D-070)

Every ball has a written interior direction (creative, labelled) and a brief to make its picture; the first interior you upload becomes that ball's standard interior. A Pokémon's own picture inside its ball uses the image packet's new 'Inside its Poké Ball' purpose. Until a picture exists the profile shows the direction and works fine without it.

- **Why:** No image generator is available here; the spec allows the brief-and-upload workflow when there isn't one.
- **See it:** `#/ball/luxury` (The Luxury Ball's interior)
- **Could instead:** connect a paid image service; a set of commissioned interiors
- **Your call** (2026-10-26, chat): Keep

### A-30 · Mechanics (D-070)

Every ball's effect comes from the game's own catch code at a pinned commit (Red, Crystal, Emerald and FireRed, Platinum, HeartGold) and is re-checked against it on every build; the games' bugs are kept and named. Gen 1 is shown for history only.

- **Why:** The spec asks for verified, game-specific mechanics; the code is the most exact source.
- **See it:** `#/ball/moon` (The Moon Ball, Crystal vs HeartGold)
- **Could instead:** the intended behaviour, with the bugs as footnotes
- **Your call** (2026-10-26, chat): Keep: and bring in more of the animation of a Pokémon coming out of its ball, if there's a way

### A-31 · The catch calculator (D-070)

One throw's chance, worked out the game's own way: the wild Pokémon's max HP assumes IV 15 (DV 8 in Gen 2) and no EVs; each generation's catch rates come from its own data (Crystal, Emerald for FireRed too, Platinum for HeartGold too); Crystal's Heavy Ball reads Platinum's Pokédex pounds through Crystal's own conversion; the Safari Zone's rocks and bait and the Great Marsh's mood aren't modelled.

- **Why:** These are the only inputs the calculator can't know; the defaults are the average case.
- **See it:** `#/balls/catch` (The catch planner)
- **Could instead:** let you set IVs; model Safari bait and rocks
- **Your call** (2026-10-26, chat): Keep

### A-32 · Ball names (D-070)

Crystal's Park Ball (the Bug-Catching Contest's ball) and HeartGold's Sport Ball are one ball, shown as the Park Ball in Crystal; Gen 4's Park Ball is Pal Park's, a different ball. Crystal has no Safari Ball (its constant is an alias of the Moon Stone).

- **Why:** That's how the games and PKHeX number them (24 and 25).
- **See it:** `#/ball/sport` (The Sport Ball)
- **Could instead:** list Crystal's Park Ball as its own ball
- **Your call** (2026-10-26, chat): Keep

### A-33 · Could it be in that ball? (D-070)

Blackthorn checks a ball against how the species (or what it evolved from) is met in that game: a hatched Pokémon in Gens 3-4 is in a Poké Ball, a gift or trade comes in a Poké Ball, a Safari Zone-only Pokémon in a Safari Ball, a Park Ball is never kept (Pal Park Pokémon keep their Gen 3 ball: from Bulbapedia, not yet checked in the code), a Cherish Ball means an event, and Gen 2 stores no ball. It's a note, never a block (D-024).

- **Why:** The spec asks for the legal ball for an individual in its game; your story still wins.
- **See it:** `#/pokemon/me%3Aheartgold%2FSnorlax` (Snorlax's ball in the Studio)
- **Could instead:** block illegal balls; drop the check
- **Your call** (2026-10-26, chat): Keep: "I like that it's a note and not a block"

### A-34 · Categories (D-070)

Six kinds: Standard (Poké, Great, Ultra, Master), Apricorn (Kurt's seven), Specialized (Net, Dive, Nest, Repeat, Timer, Dusk, Quick), Comfort (Luxury, Heal), Safari and parks (Safari, Sport, Park), Commemorative (Premier, Cherish), plus a 'special' filter for what each one's for.

- **Why:** The spec's categories, made to cover all 25 without overlap.
- **See it:** `#/balls` (The collection's filters)
- **Could instead:** put Luxury and Heal under Specialized
- **Your call** (2026-10-26, chat): Keep

## v2.5 · Equipment

### A-35 · The equipment library (D-070)

Every key item of Crystal, FireRed, Emerald, Platinum and HeartGold/SoulSilver: the 110 items the games keep in their Key Items pocket, read from each game's own item data, plus the Running Shoes, Pokégear, PokéNav and Pokétch, which aren't bag items and get short Blackthorn summaries. Each game's own name and description. How you get each one comes from that game's scripts, with file and line. An item a game only carries in its item table is shown as a leftover. Keys and plot items are marked as story items. The build stops if the library and the games' item lists disagree.

- **Why:** Your call: "Change: include every key item."
- **See it:** `#/equipment` (The equipment library)
- **Could instead:** only the key items a game actually hands out, leaving out the leftovers in the shared item tables; every key item, but story and event items on their own page, apart from the gear you use
- **Your call** (2026-10-26, chat): Change: include every key item.

## Phase 6 · Poké Balls and equipment

### A-36 · Your inventory (D-070)

Your gear is a new My Gear tab in the Sheet: one row per item per game (have it, how many, a note), the newest row wins. Saving it needs the updated WebApp.gs (its list of the app's tabs gains My Gear).

- **Why:** The same append-only pattern as your Pokémon, builds and teams.
- **See it:** `#/equipment/super-rod` (The Super Rod's inventory)
- **Could instead:** keep inventory in the browser only
- **Your call** (2026-10-26, chat): Keep

### A-37 · Menu (D-070)

Poké Balls and Equipment sit under Pokédex & Reference; your ball shows on each Pokémon's profile.

- **Why:** They're reference libraries first; the personal side lives on your Pokémon.
- **See it:** `#/balls` (The menu)
- **Could instead:** a sixth space for Equipment; under My World
- **Your call** (2026-10-26, chat): Keep

### A-38 · How you get each ball (D-070)

Read from each game's own scripts, marts, item balls, hidden items, phone gifts, prize tables and Kurt's table at the pinned commits (1,132 ways, each citing its file and line). Not counted: HeartGold's 26 give lines whose item is set elsewhere, the scratch-off prizes, the Pokéwalker and Emerald's Battle Pyramid Pickup. Where nothing was found (FireRed's Dive and Premier Balls, HeartGold's Dive Ball, the Cherish Ball) the page says so. How you get each piece of gear isn't read yet.

- **Why:** The spec asks for acquisition that's accurate per game; the code is exact, and saying what wasn't read keeps a gap from looking like a fact.
- **See it:** `#/ball/luxury?g=emerald` (The Luxury Ball in Emerald)
- **Could instead:** fill the gaps from Bulbapedia, labelled as such; read the gear's gifts the same way
- **Your call** (2026-10-26, chat): Keep

## Phase 7 · Capability, survival and homestead

### A-39 · Capabilities (D-076)

One model of 35 capabilities in seven areas: the spec's six (mobility, food and water, shelter and environment, safety, tools and construction, ecological awareness) plus life at home. The 27 the wilderness engine had keep their ids and evidence; eight are new: water supply, cold source, heat tolerance, manipulation, construction, electricity, tracking and navigation.

- **Why:** The spec asks for a capability modelled once and reused everywhere, and names these gaps.
- **See it:** `#/capabilities` (Capabilities)
- **Could instead:** fewer, broader capabilities; split heat source into warmth and cooking fire
- **Your call** (2026-10-26, chat): Keep

### A-40 · How evidence reads (D-076)

On the Survival Lab and Homestead pages, each piece of evidence that a Pokémon can do a job is labelled three ways: where it comes from (a game mechanic, its biology, or equipment), how sure it is (a game fact, an inference, a guess, or a Blackthorn invention), and whether you've approved it. Each job then reads Covered, With equipment, If taught, Plausible, Needs your approval or Gap; there's no single overall score. An ability counts only when every ability the species can have does the job; otherwise it's plausible until your build names the ability.

- **Why:** The spec forbids an opaque score and asks for canon kept apart from interpretation (Test E).
- **See it:** `#/survival` (World readiness)
- **Could instead:** a weighted readiness percentage; count teachable field moves as covered
- **Your call** (2026-10-26, chat): Keep: though the wording wasn't clear (rewritten)

### A-41 · Bodies (D-076)

The Gen 4 Pokédex's body shape is read as anatomy: arms, two legs with free forelimbs, or tentacles suggest manipulation; a large or huge four-legged body suggests hauling. Wings are never read as flight (Scizor's own Pokédex says its wings aren't for flying).

- **Why:** It's the games' own body data, so it's better evidence than a guess from type.
- **See it:** `#/capability/manipulation` (Manipulation)
- **Could instead:** hand-authored anatomy per species; no anatomy, Pokédex text only
- **Your call** (2026-10-26, chat): Keep

### A-42 · Pokédex misreadings fixed (D-076)

Four of the wilderness engine's Pokédex patterns read too much: 'not used for flying' counted as flight, 'dangerously' as danger sense, 'can be seen from far away' as scouting, and any mention of the sea as carrying people over water. They're narrower now, and this changes what the profile and breeding pages show too.

- **Why:** A misreading presented as evidence is what the spec warns against.
- **See it:** `#/capability/air_travel` (Air travel)
- **Could instead:** keep the broad patterns and hand-reject false hits
- **Your call** (2026-10-26, chat): Keep: and fix any other pattern that reads too broad or too narrow, if possible

### A-43 · Moves put to use (D-076)

A move a build actually knows can be put to use outside battle, as a hypothesis: Flamethrower for heat, Ice Beam for cold, Thunderbolt for electricity, Water Gun for water, X-Scissor for cutting, Heal Bell for healing, Rain Dance for weather, Roar for keeping wild Pokémon off, Odor Sleuth for tracking. Field moves stay game mechanics.

- **Why:** The spec asks that learned and inherited moves shape an individual's specialisation without being treated as canon.
- **See it:** `#/survival` (A member's holders)
- **Could instead:** no move uses; only egg moves count
- **Your call** (2026-10-26, chat): Keep

### A-44 · Equipment and training (D-076)

Seven equipment rules, proposed: a harness or a saddle for large Pokémon that haul or carry, hand tools and garden tools for a Pokémon with a grip, a rescue kit for one that tracks or scouts, and a dynamo (and lamps) for an Electric type. A Pokémon qualifies on its own evidence; the rule counts only when the kit is packed.

- **Why:** Layer C is the spec's equipment-assisted capability; the anatomy decides who can use what.
- **See it:** `#/capability/construction` (Construction)
- **Could instead:** no layer C until you author each one; a longer equipment list
- **Your call** (2026-10-26, chat): Keep

### A-45 · The kit (D-076)

Game items do what the game says (Potions heal, an Escape Rope gets you out of a cave, Repel keeps weaker Pokémon away, rods, finders, maps, Go-Goggles). Camp gear is Blackthorn's (tent, stove, lanterns, water filter, rations, cold- and hot-weather clothing, climbing kit) and says so.

- **Why:** Equipment is half of survival; game items are canon, camp gear isn't.
- **See it:** `#/survival` (Kit)
- **Could instead:** no camp gear: game items only
- **Your call** (2026-10-26, chat): Keep

### A-46 · Scenarios (D-076)

Eleven scenarios: the spec's eight (winter mountain, dense forest, coastal or marine, cave, extended camp, wetland, long overland journey, hazardous research) and Field readiness's emergency, night travel and living in town. Each has conditions, hazards, food and water, a recommended kit, the field moves its ground calls for, and needs marked critical, important or useful. They're illustrative Blackthorn scenarios; edit capability/scenarios.json.

- **Why:** The spec's list, made concrete so a team can be assessed against them.
- **See it:** `#/survival` (Scenario)
- **Could instead:** fewer, simpler scenarios; scenarios tied to real game locations
- **Your call** (2026-10-26, chat): Keep

### A-47 · Provisions (D-076)

What to carry if nobody forages: rations a day by body size (small 1, medium 2, large 4, huge 8), 2 for the trainer, and as much water. A Blackthorn standard, labelled as one, not canon.

- **Why:** The spec asks to estimate consumption without inventing precision; this is a stated method you can change.
- **See it:** `#/survival` (Provisions)
- **Could instead:** by weight instead of size class; no estimate at all
- **Your call** (2026-10-26, chat): Keep

### A-48 · Slot cost (D-076)

A field move earns its place in a battle moveset if it does at least 70 damage that generation (Surf, Fly, Waterfall, Strength, Rock Climb, Dive, Dig, Headbutt, Secret Power) or is Soft-Boiled or Milk Drink; any other field move costs a slot. Two slot-costing field moves on one Pokémon is an HM slave (D-018).

- **Why:** The spec asks for battle moveset opportunity costs; the threshold is stated and changeable.
- **See it:** `#/survival` (Cartridge readiness)
- **Could instead:** a different power line; judge each move by hand
- **Your call** (2026-10-26, chat): Keep

### A-49 · World records follow your Pokémon (D-076)

A few world records (W-001 to W-017) were written about one particular Pokémon of yours, such as your Emerald Meganium tending the Glasshouse. Those records stay with that one Pokémon: they count for it wherever it's assessed, and not for any other Meganium. While the fresh start is on, those old Pokémon are hidden, so these records don't show.

- **Why:** MASTER_PLAN's 'species-level records across games', resolved by the individual the record describes.
- **See it:** `#/facility/glasshouse` (Tending the berry beds)
- **Could instead:** apply a W-record to every Pokémon of that species
- **Your call** (2026-10-26, chat): Not sure what it means: asked for plainer words (rewritten). *(later)*

### A-50 · Facilities (D-076)

Fourteen facilities as capability networks: the Glasshouse and its cold vault (approved), the nine ranch facilities, and four of the spec's concepts as proposals: Research Institute, Workshop and equipment depot, Habitats and conservation grounds, and Dragon's Den research. Each job is met by any of its capabilities or by infrastructure (named, Blackthorn). Under D-039 one of yours can staff a job only on a game mechanic or a record you approved; other evidence makes it a candidate. Species you don't have that a mechanic qualifies are shown as hires.

- **Why:** The spec's facility model, kept inside D-039.
- **See it:** `#/homestead` (The Homestead)
- **Could instead:** leave the four new facilities out until you ask; let biology staff a job
- **Your call** (2026-10-26, chat): Keep: the facilities are being reworked anyway

### A-51 · Plans, not facts (Q13) (D-076)

Staff and expedition plans are plans: saving one changes nobody's team or home (D-037, D-042). They're saved as My Teams rows (kind staffing or expedition, with the facility or the scenario and kit), so there's no new tab and no Apps Script change.

- **Why:** Q13's proposal, taken as the default.
- **See it:** `#/facility/glasshouse` (Save this staff plan)
- **Could instead:** assignments as facts that move a Pokémon; a separate My Plans tab
- **Your call** (2026-10-26, chat): Keep: the base is good; how it reads and what it outputs will change

### A-52 · Menu (D-076)

The Survival Lab replaces Field readiness under Labs (the old #/field address opens it); the Homestead sits in My World after the Estate; Capabilities joins Pokédex & Reference. Each Pokémon's profile gains 'Away from battle'.

- **Why:** MASTER_PLAN §3.1 maps Field readiness to the Survival Lab.
- **See it:** `#/survival` (The menu)
- **Could instead:** keep Field readiness as well; a separate Survival space
- **Your call** (2026-10-26, chat): Keep

## v1 · The Arena

### A-53 · Arena engine (D-077)

The Arena's battles run in your browser, on a smaller battle-only copy of the engine that loads only on Arena pages. Where the browser allows it, several battles run at once in the background; otherwise they run one at a time, with the same results. The trainers' teams were checked for legality in advance; a team you build is checked by the builder, and the result says so.

- **Why:** The full build (6.9 MB, with learnsets) is too heavy to load in the app; the battle-only build can't check legality, so the checks travel with it. The browser test proves the page plays exactly Node's battles (the fingerprint).
- **See it:** `#/arena` (The Arena)
- **Could instead:** load the full build on demand to check your saved teams with Showdown's validator; run the engine on the home laptop and send results back
- **Your call** (2026-10-26, chat): Not sure what it means: asked for plainer words (rewritten). *(later)*

### A-54 · Gen II-III teams (D-077)

Crystal, FireRed and Emerald teams (yours and the trainers') play in the Arena under Gen IV rules, as gen4:<id>: the same Pokémon, moves, items and levels; Gen IV's physical/special split, abilities (Gen II's Pokémon get the species' first) and formulas. The original record is untouched.

- **Why:** The engine plays Gen IV only, and Legends and all-time leagues need your Crystal, FireRed and Emerald sixes and Lance, Red, Blue and Wallace.
- **See it:** `#/legends` (Legends)
- **Could instead:** leave Gen II-III teams out of the Arena; a separate Gen III engine later
- **Your call** (2026-10-26, chat): Keep: everything in the Arena plays by Gen IV rules; the games and the wilderness are a separate conversation

## v1 · Recognition 2.0

### A-55 · Tier names (D-077)

Every stat-gated badge gets a name at each tier, FIFA-style: Speed Bronze-Elite reads Quick, Swift, Blazing, Lightning; Attack Hard Hitter to Titan; Defense Sturdy to Bastion; and so on (trainers/recognition.json tier_names). Display only: badges, tiers and thresholds are unchanged.

- **Why:** Your 2K/FIFA brief: 'if you had a heading power of over 85, you automatically got the power header trait'. The thresholds were already stat-gated; this names them.
- **See it:** `#/standards` (The standards)
- **Could instead:** rename any of them; no names: tiers only
- **Your call** (2026-10-26, chat): Keep

## v1 · The Arena

### A-56 · Legends (D-077)

The Legends field is every Champion at their strongest (Crystal Lance and Red, FireRed Blue's rematch, Emerald Wallace, Platinum Cynthia's rematch, HeartGold Lance's rematch and Red), the anime's teams (25 new), the all-time team and your six journeys: 45 teams, each against every other 8 times on the standardized lens, each trainer as Blackthorn reads them. Your teams keep D-072's optimized spreads, everyone else has 85 EVs, which is part of why yours rank 1-3.

- **Why:** Your '96 Bulls question needs a fixed all-time field; D-072 is how your teams fight everywhere else in the 6v6 engine.
- **See it:** `#/legends` (Legends)
- **Could instead:** put your teams on 85 EVs in Legends (even footing); the cartridge AI for cartridge trainers; more battles per pairing
- **Your call** (2026-10-26, chat): Keep

### A-57 · Your trainer (D-077)

Your trainer is the same nine dials every library trainer is read onto (aggression, risk, patience, heal line, switching, preservation, harassment, set-up-first, sharpness), with six philosophies to start from (2K's coaching styles read for Pokémon: All-out offense, Momentum, Attrition, Set up and sweep, Play the percentages). They're saved in this browser and apply to your teams in every Arena mode. Traits name your style and change nothing.

- **Why:** 2K's coach settings and MyGM traits; one scale means your style and Cynthia's can be compared.
- **See it:** `#/trainer` (Your trainer)
- **Could instead:** save your trainer in the Sheet so every device has it; settings per team
- **Your call** (2026-10-26, chat): Keep

### A-58 · The Draft (D-077)

The Draft pool is every Pokémon an era's trainers use (HeartGold, Platinum, or the Legends), each with the build its strongest trainer used. You and five GMs (Mira, Okafor, Sato, Ferreira, Lindqvist), each with two traits that shape both how they draft and how they battle, take six picks each in a snake draft, then the six teams play a league.

- **Why:** MyTEAM and MyGM: build the best six you can against GMs who think differently.
- **See it:** `#/draft` (The Draft)
- **Could instead:** draft from your own builds too; a salary-cap or points draft; more GMs
- **Your call** (2026-10-26, chat): Keep

### A-59 · Arena records (D-077)

Results you play are kept by default in an append-only Arena tab (one row a match, series, league, playoff or draft, with each of your Pokémon's numbers), and careers and the Hall of Fame read it. A checkbox on Play now turns it off.

- **Why:** MyCAREER needs a record; append-only is how every record of yours is kept.
- **See it:** `#/halloffame` (Hall of Fame)
- **Could instead:** keep only when you press Keep; a separate tab per mode
- **Your call** (2026-10-26, chat): Keep

## v1 · The trainer ecosystem

### A-60 · Trainer ecosystem (D-077)

25 new anime versions sit in trainers/ecosystem.json, outside canon: Ash at the Orange League, Silver Conference, Ever Grande, Battle Frontier, Lily of the Valley against Tobias and three best-of teams; Gary and Paul at four moments each; Harrison, Tyson, Brandon, Barry, Nando, Zoey, Drake and Wallace; and anime Cynthia, Lance, Brock and Misty. Every version and build is proposed, each says where it's unsure, and canon wins any clash. Career records give each its tags.

- **Why:** Your brief: 12 versions of Ash, four of Gary and Paul, every champion, tagged by accomplishments, as the standard everything else is set against.
- **See it:** `#/trainers` (Trainer Library)
- **Could instead:** approve them into canon one by one; drop the low-confidence versions (early Paul, Silver Conference Ash)
- **Your call** (2026-10-26, chat): Keep

## v1 · The Arena

### A-61 · Tendencies in battle (D-077)

Trainer criterion 6 (how a trainer's tendencies show in battle) is answered on each profile by playing them six battles against your HeartGold team with every decision logged, and counting their choices by kind (attack, switch, status, set-up, heal) and how often they took the option they rated best.

- **Why:** The decisions are what the engine logs; counting them shows the reading at work, not just its settings.
- **See it:** `#/trainers` (Trainer Library)
- **Could instead:** against a fixed reference team that isn't yours; more battles
- **Your call** (2026-10-26, chat): Keep

## v1 · Field Biology

### A-62 · Dossiers (D-077)

64 dossiers (your companions, the Ilex Forest community, the Blackthorn highlands) were drafted by the assistant from each species' evidence pack and nothing else. Every statement is canon, game data, inferred, hypothesis, Blackthorn's invention or unknown, with the ids it cites, checked by biology/dossier.py. Real-world biology appears only as a labelled analogy, never as evidence. All are drafts.

- **Why:** Your biology brief ('I want this to be real'), and the other assistant's evidence classes.
- **See it:** `#/biology` (Field Biology)
- **Could instead:** a stricter class set; your own dossiers written alongside
- **Your call** (2026-10-26, chat): Keep: and more of them: "Want more of it."

### A-63 · Encounter tables (D-077)

Encounter tables are read as evidence-based reconstruction: a Pokémon found there unconditionally is a resident; one that comes only by radio, a swarm, the Bug-Catching Contest, the post-game or a weekday is a visitor and stays out of the web; the Safari Zone is managed, so it's described, not reconstructed. An encounter rate is how often you meet it, never how many there are.

- **Why:** The open question from the ecology conversation; the other assistant recommended this one, and it keeps the games' data primary without treating it as a census.
- **See it:** `#/ecosystems` (Ecosystems)
- **Could instead:** strict game ecology (only what the tables show, nothing added); naturalistic first (the tables as a hint)
- **Your call** (2026-10-26, chat): Keep

### A-64 · Non-Pokémon life (D-077)

Each habitat gets the non-Pokémon life it needs by principle, by biome: trees, leaves, flowers, fruit, moss, algae, plankton, deadwood, detritus, fungi (the decomposers), insects and other invertebrates, small fish; plus Pokémon-world energy where entries describe it (electricity, dreams). Geothermal heat is nowhere by default.

- **Why:** Pokémon alone can't feed a forest; Ilex Forest has no Pokémon decomposer at all. Geothermal heat waits for your answer on Magcargo.
- **See it:** `#/ecosystem/ilex-forest` (Ilex Forest)
- **Could instead:** Pokémon only; geothermal ground in the highlands
- **Your call** (2026-10-26, chat): Change: geothermal ground in the highlands.

### A-65 · Food-web links (D-077)

A link comes first from a curated dossier, then from the species' own Pokédex diet, then, for predators, from a rule: a Pokémon at most half its mass and at least a thousandth, in the same place, active at the same time (a low-confidence hypothesis, four at most). Bark for a case or a trunk to cling to is a material, not food.

- **Why:** Every Pokémon-on-Pokémon link in both flagship webs is a hypothesis: no entry names a predator and its prey inside one community. The rule makes those guesses the same everywhere.
- **See it:** `#/ecosystem/ilex-forest` (Ilex Forest)
- **Could instead:** no rule: only links a dossier or the Pokédex gives; a stricter size window
- **Your call** (2026-10-26, chat): Keep

### A-66 · Johto's landscape (D-077)

Johto's places connect as the games' map joins them (paths, caves, sea routes). Each place's biome, elevation and water, and its position on the drawing, are Blackthorn's reading.

- **Why:** The reference data has no adjacency, so the graph was authored from the games' map.
- **See it:** `#/ecosystems` (Ecosystems)
- **Could instead:** add Kanto; your own biome for any place
- **Your call** (2026-10-26, chat): Change: add Kanto. "HeartGold does both of them."

### A-67 · Flagship ecosystems (D-077)

Two flagships: Ilex Forest (one web holding both versions' bug lines, as the National Park contest does) and the Blackthorn highlands (Ice Path, Blackthorn City, Dragon's Den, Route 44, Route 45 and Dark Cave). HeartGold and SoulSilver are merged; a version-only species is flagged (Delibird is SoulSilver's alone in the Ice Path).

- **Why:** The dossier writers asked; one web per place is simpler to read, and the flags keep the versions visible.
- **See it:** `#/ecosystem/blackthorn-highlands` (The highlands)
- **Could instead:** one web per version; add Mt. Silver to the highlands
- **Your call** (2026-10-26, chat): Keep

### A-68 · The Level 3 model (D-077)

Level 3 is an allometric trophic network (Brose, Williams and Martinez 2006, after Yodzis and Innes 1992). Metabolism scales with Pokédex weight to the -1/4 power; Bugs are invertebrates, fish-shaped Pokémon ectotherms, the rest endotherms. Non-Pokémon groups get nominal masses, detritus is refilled from outside, and starting biomass follows the encounter rate only as a place to start. Every parameter is a slider. It runs in the browser only.

- **Why:** A model of a world nobody has counted is only as good as what it lets you vary.
- **See it:** `#/ecosystem/ilex-forest` (Ilex Forest)
- **Could instead:** logistic growth only (the simpler model in the ecology conversation); a Python copy for reports
- **Your call** (2026-10-26, chat): Keep

### A-69 · Ecotypes (D-077)

Ecotypes for every line with egg moves: each egg move is read as an ecological function (an ambush strike, a sedative, cold, rock and soil, cooperation...), weighted by how much it says about a way of life (plain Normal attacks count least), and two functions together make a named ecotype ('Frost ice-walker'), fitted to the Johto places of its range. Machine ecotypes are hypotheses; the dossiers' curated ones come first, and your Pokémon's egg moves are read against both.

- **Why:** Your orca analogy: lineages that differ by how they live, carried through the parents.
- **See it:** `#/ecotypes` (Ecotypes)
- **Could instead:** curated ecotypes only; read level-up moves too
- **Your call** (2026-10-26, chat): Keep

### A-70 · Your review (D-077)

Agree, disagree or note on any statement, claim, relationship or link goes to the Journal as a review row; the dossier file stays the author's account, and a dossier's approval is a status change made when you say so.

- **Why:** Your review is the evidence of a different kind, and it shouldn't overwrite what the author wrote.
- **See it:** `#/biology` (Field Biology)
- **Could instead:** edit the dossier in the app
- **Your call** (2026-10-26, chat): Keep

### A-71 · Field guide (D-077)

The other 429 species get a field guide made from their own claims, grouped by domain, with the machine's diet and guild labelled as machine-made and what nobody has said listed as open questions. No prose is invented for them.

- **Why:** Every species has a page now; a curated dossier replaces the guide when one is written.
- **See it:** `#/biology/Heracross` (A field guide)
- **Could instead:** write dossiers for every species, cohort by cohort
- **Your call** (2026-10-26, chat): Keep

### A-72 · Capability readings (D-077)

The dossier writers found capability records that misread entries: Weedle, Oddish, Zubat and Noctowl as light sources, Kakuna as a heat source, Pineco and Machamp as fliers, Machamp as calming. Those readings are now excluded (wilderness/engine.py LORE_EXCLUDE).

- **Why:** Reading every entry closely found what the pattern reading missed.
- **See it:** `#/capabilities` (Capabilities)
- **Could instead:** keep them and let you reject each
- **Your call** (2026-10-26, chat): Keep

## v1 · Careers

### A-73 · Careers (D-077)

An Arena result is credited to the Pokémon that played it: for your journey teams, to your individual of that species in that game; for a saved team, to the individual in the slot. Every result you keep counts toward its career.

- **Why:** The journey teams fight as species with builds, not as individuals; this ties the record to the one you have.
- **See it:** `#/mine` (Your Pokémon)
- **Could instead:** link each journey slot to an individual explicitly
- **Your call** (2026-10-26, chat): Keep: the Arena is a live comparison, not the game, so its results don't need tracking

### A-74 · Titles and achievements (D-077)

A player card's signature title is its best achievement (Champion, League Champion, Legend Slayer, Team Ace, The Closer, Iron Wall), or else its top badge's tier name before its build name ('Blazing Swords Dance sweeper'). The achievements are: First win, Centurion (100 battles), The Closer (1 KO a battle over 20), Iron Wall (fainted 25% or less over 20), Team Ace (most KOs on its team in a league), Legend Slayer, League Champion and Champion.

- **Why:** MyCAREER's identity: names earned from what happened, never a made-up rating.
- **See it:** `#/halloffame` (Hall of Fame)
- **Could instead:** different thresholds; more achievements

### A-75 · The Chronicle (D-077)

Each Pokémon's career timeline merges its Arena results, build versions and Timeline entries with the Chronicle: chapters you write, kept as Journal rows (kind chronicle).

- **Why:** The automatic record says what happened; the Chronicle says what it meant.
- **See it:** `#/mine` (Your Pokémon)
- **Could instead:** a separate Chronicle tab
- **Your call** (2026-10-26, chat): Keep

## v1 · The product

### A-76 · Home and the menu (D-077)

Home opens with the modes (Play now, Legends, Leagues, the Draft, MyCAREER, Your trainer, Field Biology, Ecosystems, the Homestead, the Survival Lab, the Trainer Library, What's new) above the estate's dashboard. The menu gains The Arena (with the Hall of Fame) and Field Biology (the atlas and the journal move there), and Pokédex & Reference becomes Reference.

- **Why:** 2K's main menu: modes first.
- **See it:** `#/` (Home)
- **Could instead:** the dashboard first; modes in the menu only
- **Your call** (2026-10-26, chat): Keep

## v1 · Field Biology

### A-77 · Guilds along a line (D-077)

Where two dossiers of one line file it differently, both stand and the difference is shown: Golbat as a predator, Zubat and Crobat as parasites; Dratini and Dragonair as predators, Dragonite with none; Psyduck as an omnivore, Golduck as a piscivore.

- **Why:** Each writer read its species' own entries; a line can change its diet as it grows, so a forced match would hide a real question.
- **See it:** `#/biology` (Field Biology)
- **Could instead:** one guild for each line
- **Your call** (2026-10-26, chat): Keep

### A-78 · Borrowing from relatives (D-077)

When a species' own entries say nothing, a dossier may lean on its line's entries and its level-up moves, labelled inferred or hypothesis (Zubat's blood-feeding comes from Golbat's entries and Leech Life).

- **Why:** Without it, most young forms would have no diet at all.
- **See it:** `#/biology/Zubat` (Zubat)
- **Could instead:** a species' own entries only
- **Your call** (2026-10-26, chat): Keep

## v2 · The fresh start

### A-79 · Hidden, not deleted (D-078)

The fresh start hides your old records in the app (journeys, builds, lineups, the party, residents, studbook, lineage, program, the journey's scouting files and Sheet rows from before 2026-10-25) rather than deleting them. canon/ and docs/ keep them; engine/store/fresh_start.json turns it off.

- **Why:** You asked for a blank slate to learn from; keeping the archive means nothing you built is lost and it can come back with one switch.
- **See it:** `#/` (Home)
- **Could instead:** delete the old records; archive them to a separate Drive file
- **Your call** (2026-10-26, chat): Keep

### A-80 · The world stays (D-078)

What the fresh start keeps: the reference world (species, moves, trainers, the builds book, Smogon sets, Field Biology), the facilities as designed (now unstaffed), the decision ledger, your calls, and your name in the greeting.

- **Why:** They're the world and the project's record, not your playthrough; the Estate's facilities are design, their staff were your Pokémon.
- **See it:** `#/estate` (The Estate)
- **Could instead:** blank the facilities too; hide the decision record
- **Your call** (2026-10-26, chat): Keep

## v2 · Teams

### A-81 · One team per game, each its own trainer (D-078)

Each game has exactly one team (My Teams row journey:<game>), with its own trainer: name, philosophy, coaching style and the nine dials. The newest row wins; earlier lineups stay in the Sheet. The Arena plays the team with its own trainer.

- **Why:** Your words: 'think of it as separate trainers, as separate journeys'; and 'I don't want different versions'.
- **See it:** `#/team/heartgold` (HeartGold team)
- **Could instead:** several saved versions per game; one trainer across all six
- **Your call** (2026-10-26, chat): Keep

### A-82 · The region is beaten (D-078)

Every team's page counts the region's badges, the Elite Four and Champion, the Pokédex (National where the game has one) and the post-game as done, listed with the leaders' names.

- **Why:** Your call: 'assume ... I've beat the region and I have the national Pokédex'.
- **See it:** `#/team/heartgold` (HeartGold team)
- **Could instead:** track them as you go
- **Your call** (2026-10-26, chat): Keep

### A-83 · A candidate becomes yours (D-078)

Putting a build from the builds book on a team makes it a new Pokémon of yours with its own build record (the book's build is unchanged and noted as its parent).

- **Why:** A team holds your Pokémon; a reference set shouldn't be edited in place.
- **See it:** `#/team/heartgold` (HeartGold team)
- **Could instead:** link the book's build directly
- **Your call** (2026-10-26, chat): Keep

### A-84 · Legendaries left out of candidates (D-078)

The candidates list leaves legendary and mythical Pokémon out unless you include them.

- **Why:** Ubers-level sets crowd the top of a sorted list, and your teams have been non-legendary (D-008's spirit).
- **See it:** `#/team/heartgold` (HeartGold team)
- **Could instead:** include them by default
- **Your call** (2026-10-26, chat): Keep

### A-85 · Nine team shapes (D-078)

A team's shape is the first of nine competitive archetypes it fits, in this order: Trick Room, weather, Baton Pass, hyper offense, stall, semi-stall, bulky offense, offense, balance. Each shows what it still needs.

- **Why:** Smogon's team archetypes, read from the five roles and the moves and abilities the six carry.
- **See it:** `#/team/heartgold` (HeartGold team)
- **Could instead:** v1's five shapes; shapes you define
- **Your call** (2026-10-26, chat): Keep

### A-86 · Scouting report, not questions (D-078)

The team's scenario questions became a scouting report: strengths, weaknesses and tendencies. The same checks feed it.

- **Why:** Your call: 'not questions, but more just strengths, weaknesses ... tendencies'.
- **See it:** `#/team/heartgold` (HeartGold team)
- **Could instead:** keep the questions alongside
- **Your call** (2026-10-26, chat): Keep

## v2 · The builder

### A-87 · Saving is one button (D-078)

Save writes a new build version and the individual together, with an optional note; nothing is asked in a drawer. Unsaved changes are kept in the browser until you save or revert.

- **Why:** Fewer steps between choosing a move and seeing it stick.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** ask what changed on every save
- **Your call** (2026-10-26, chat): Keep: "I'd like saving to be one button"

### A-88 · IVs start at 31 (D-078)

A new build starts with 31 in every IV (Max IVs) and no EVs; EVs left blank still count as no evidence for the stat badges (B19).

- **Why:** A 'perfect' build is the usual starting point; you lower what you want lower.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** IVs blank until set
- **Your call** (2026-10-26, chat): Keep

### A-89 · Species follows evolution (D-078)

The species on a Pokémon can change only within its evolution line (Cyndaquil to Typhlosion); a different species is a different Pokémon.

- **Why:** It's the same individual when it evolves.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** any species
- **Your call** (2026-10-26, chat): Keep

### A-90 · Held items (D-078)

The item dropdown lists items a Pokémon can hold to effect in that generation: held items, Choice items, type boosters and resist berries, Plates, species items, berries, training and evolution items.

- **Why:** The full item list includes balls, TMs and key items that do nothing held.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** every item
- **Your call** (2026-10-26, chat): Keep

### A-91 · Move descriptions (D-078)

Each move shows its type, category, power, accuracy, PP and priority, what it does (the battle pack's effect text) and the game's own description for that generation (PokeAPI's move_flavor_text, newly fetched).

- **Why:** Your call: 'I want to see the move description in there as well'.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** the effect text only
- **Your call** (2026-10-26, chat): Keep

### A-92 · Hand-set roles left out (D-078)

The builder doesn't offer setting a team role by hand (D-059's overrides still apply from team_roles.json).

- **Why:** It kept the page simpler while you rebuild; it can come back.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** keep the override menu on each role
- **Your call** (2026-10-26, chat): Keep

## v2 · Roles

### A-93 · Five roles from the fights (D-078)

Sweeper, Support and Wall are now read from the same League one-on-ones as Ace (who moves first, how hard it hits, which hits it takes), and Tank is new. The 34-role engine stays underneath for the build name.

- **Why:** Each role answers one competitive question with numbers you can check; v1 read two of them from composite scores.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** v1's definitions
- **Your call** (2026-10-26, chat): Keep

### A-94 · The role bars (D-078)

Sweeper: moves first against 80%, 2HKOs 80% and OHKOs 30% (one use of its setup applied). Wall: four hits from 80% of one side's 50 hardest attacks, with sustain. Tank: three hits from 75% of the 100 hardest, and 2HKOs 60%. Support: two support moves, and survives (80%) or outpaces (60%). Ace unchanged.

- **Why:** Set against 1,076 builds so each role picks out about a fifth of them (246 Sweepers, 226 Walls, 195 Tanks, 181 Supports; 448 Aces at D-064's bars).
- **See it:** `#/v2` (What's new in v2 (docs/roles/ROLE_SCORES.md))
- **Could instead:** the first bars (60/60): about twice as many
- **Your call** (2026-10-26, chat): Keep

### A-95 · One boost, as an estimate (D-078)

A Sweeper's setup is counted as one use (capped at +2), applied as the stat stage multiplier on its Speed and its damage. Labelled an estimate.

- **Why:** A setup sweeper is judged after its boost; the stage multiplier is the mechanic, the damage scaling is close but not exact.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** re-run the fights boosted
- **Your call** (2026-10-26, chat): Keep

### A-96 · Two-part scores (D-078)

Sweeper's and Tank's scores are the geometric mean of their two shares, so a Pokémon strong at one half and hopeless at the other scores low.

- **Why:** With a plain mean, a fast frail attacker scored halfway to Tank.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** the plain mean
- **Your call** (2026-10-26, chat): Keep

## v2 · Badges

### A-97 · Six badge families (D-078)

Badges are grouped as Speed, Power, Bulk, Finishing, Sustain and Utility. Speed names the Pokémon it outruns and how often it moves first against the League. Sustain and Utility are new.

- **Why:** Your call: rework the badges around competitive Pokémon; these are the axes competitive players read a set on.
- **See it:** `#/pokemon` (Your Pokémon)
- **Could instead:** v1's flat list
- **Your call** (2026-10-26, chat): Keep

## v2 · Naming

### A-98 · Generated words, not applied (D-078)

Every naming slot has a generated proposal (Ember, Berserker, Rising, Crowned, Noble...), and every combination of them (257,006) is listed with the name it makes. None is applied until you put it in naming.words.

- **Why:** Your call: 'I do want that massive list ... mainly generated'; names stay yours to approve (D-059).
- **See it:** `#/v2` (What's new in v2 (docs/naming/ALL_COMBINATIONS.md))
- **Could instead:** apply the proposals now
- **Your call** (2026-10-26, chat): Keep: workshop the list; Zack uploads it back once it's finished

## v2 · Navigation

### A-99 · The menu (D-078)

The menu leads with your six teams; Build, Play and Explore follow; Labs, World and Record are folded until you open them. The top bar has the six teams one click away.

- **Why:** Your call: the app should be built around your inputs and easy to navigate.
- **See it:** `#/` (Home)
- **Could instead:** v1's eight open sections

## v2.1 · The builder

### A-100 · Where it came from (D-078)

Where it came from is a list of the real ways this species reaches you in this game: your starter, gifts, gift eggs, in-game trades, one-time encounters and every wild area (with method and levels), for it and its earlier stages, read from the games' encounter tables. An egg is offered when its line can breed, a trade or the Pal Park always, and 'something else' lets you write it in. Picking one fills Met at and Level met, which you can still edit.

- **Why:** Your call: "it can only come from a few places, so let's make where it comes from realistic."
- **See it:** `#/pokemon` (Any of your Pokémon, Who it is)
- **Could instead:** a short fixed list (starter, wild, egg, trade, other); free text only, as before

### A-101 · The ball (D-078)

The ball is its own choice: the builder shows what the ball does in this game and the Pokémon in it, and never says whether the ball fits how it was met (a starter in a Moon Ball is fine).

- **Why:** Your call: "I don't want to get into the legality of the ball and its starter ... treat the ball as independent."
- **See it:** `#/balls` (Poké Balls)
- **Could instead:** a quiet note when a ball couldn't happen in the game, without blocking it

### A-102 · Start from a build (D-078)

A Start from a build section sits between Who it is and Moves. It lists your earlier versions of this Pokémon's build and the known sets for the species under this game's rules; picking one fills in moves, ability, nature, item, IVs and EVs (not who it is). Ability is now the first dropdown in Moves; Nature and item have their own card.

- **Why:** Your call: a section in between "that says like, you know, previous build ... then all of the rest of it fills in", and "I want ability to be grouped in with moves ... the first question".
- **See it:** `#/pokemon` (Any of your Pokémon)
- **Could instead:** known sets only; fill the moves only, keeping the rest

## v2.1 · Teams

### A-103 · Move families (D-078)

Moves and abilities that do one job in several forms are read together across a team (trainers/families.json): Weather (Sunny Day or Drought, Rain Dance or Drizzle, Sandstorm or Sand Stream, Hail or Snow Warning), Screens (Reflect, Light Screen), Entry hazards (Stealth Rock, Spikes, Toxic Spikes) and Status (paralysis, burn, poison, sleep). The Weather shape counts any form. The team page says who sets each form, who thrives or suffers in it, and who takes no chip from sand and hail; it also says the last weather set wins, so several forms let a team overwrite a rival's weather.

- **Why:** Your call: "Sunny Day and Sandstorm and Hail and Rain Dance are all the same move in a sense ... all of those play into each other. I want that factored in." The note on overwriting is how the games resolve two weathers.
- **See it:** `#/team/heartgold` (A team page, Shapes & roles)
- **Could instead:** count only one weather per team, since two different weathers replace each other in battle; add more families (setup, recovery, pivoting)

## v2.1 · Natural history

### A-104 · Research it (D-078)

Each natural-history page has a Research it card: the topics with nothing on record yet, links to Bulbapedia, Serebii, Pokémon Database and Smogon, a research brief to copy, and a form (or a paste of several lines, topic | finding | source | link) for what you find. A finding is a Journal row marked proposed: it shows on the page as yours, and joins the curated dossier only once you approve it.

- **Why:** Your call: the page should be "easily researchable, and easily enrichable through kind of research". Proposed until approved keeps your findings apart from what the games say (D-063: labs never write canon).
- **See it:** `#/biology/Typhlosion` (Typhlosion's natural history)
- **Could instead:** findings go straight into the dossier; a Research tab of their own in the Sheet

## v2.1 · Your calls

### A-105 · Your calls (D-078)

Your calls is second in the menu with a count of what's waiting, the count is in the top bar and in Start here, and the page opens with the newest batch. Each call is one tap: Keep, Change (say how), Reject or Later, and the card updates in place with a progress bar.

- **Why:** Your call: "I can't find the your calls list ... that needs to be better presented to me."
- **See it:** `#/calls` (Your calls)
- **Could instead:** one call at a time, full screen, with next and back

## v2.4 · Ball openings

### A-106 · Ball openings, as the games play them (D-078)

Every ball opens the way its own game sends a Pokémon out, rebuilt from the game's code at the pinned commits (app/web/31_ballopen.html; docs/design/BALL_OPENINGS.md):
- HeartGold, SoulSilver and Platinum play each ball's own particle file, simulated as the game's particle library runs it. The seven Apricorn balls and the Sport Ball play the Poké Ball's burst, because HeartGold and SoulSilver give them a copy of it.
- FireRed and Emerald play each ball's particle routine, with its fade colour and the ball's own open frames.
- Crystal plays a grey smoke poof with no ball, the same for every ball, as Gen II does.
The game's pictures are loaded from the disassemblies when the opening plays; none are copied into the project. It plays on the builder's portrait (tap to replay), on the team's six, and on each ball's page.

- **Why:** Your call: "I want all of the ball to have the animation from the game, not a custom one." It replaces v2.3's custom openings.
- **See it:** `#/ball/master?g=heartgold` (Any ball's page, How it opens)
- **Could instead:** keep the v2.3 custom openings for the balls whose game opening looks the same (Apricorn balls in HeartGold); play only one generation's openings for every game

## v2.3 · Roles

### A-107 · Pivot (D-078)

Pivot is the sixth team role. It's earned with a pivoting move (U-turn or Baton Pass) and either takes two or more hits from 80% of the 100 hardest-hitting League attacks or moves first against 80% of the League's Pokémon; or with Intimidate or Natural Cure and those two hits. 130 of 1,076 builds earn it (12%). The League carries no EVs, so nearly every U-turn or Baton Pass user clears the bulk-or-speed bar: the move or ability is what separates a Pivot.

- **Why:** Your call: "pivot needs to be added to the list of team roles." Smogon's pivot keeps momentum: it comes in safely and brings the right teammate in.
- **See it:** `#/team/heartgold` (A team page, Shapes & roles)
- **Could instead:** moves only (no switch-in abilities); also count Roar and Whirlwind, which force switches

## v2.4 · Ball openings

### A-108 · Where the portrait differs from the game (D-078)

Five places the portrait can't or doesn't copy the game exactly:
- The throw is left out; the ball has already landed.
- Gen IV's burst is shown in a DS-screen-sized window around the Pokémon, with its edges faded rather than cut off hard.
- The front sprite is shown, so Gen II and IV use the enemy side's positions.
- Gen IV Pokémon grow from a pivot at the sprite's feet, not the species' own offset, which the app doesn't have.
- HeartGold and SoulSilver's Apricorn and Sport balls show their item picture before the burst, because their battle sprites are packed in an archive the app doesn't read. The Platinum Park Ball's tint reads past the end of the game's table, so white (HeartGold's value) is used.

- **Why:** These keep the opening inside the page and honest about what's known.
- **See it:** `#/ball/fast?g=heartgold` (The Fast Ball in HeartGold, How it opens)
- **Could instead:** show the whole DS screen with hard edges; read the Apricorn balls' battle sprites from the HeartGold archive (more work: the sprites are packed graphics, not PNGs)

## v2.5 · The Estate

### A-109 · Who lives on the estate (D-080)

The residents are the Pokémon on your six teams. Any of them could retire to the ranch, and nobody is assigned (D-037 stays open). A toggle on the estate page adds your other Pokémon too. The census, the land counts and the nursery pens all come from them, recomputed every visit.

- **Why:** The old census was 36 retired companions, and the fresh start hid them. Your teams are who you're building now, so they're who could live here.
- **See it:** `#/estate` (The Estate, Residents)
- **Could instead:** only Pokémon you mark as retired to the ranch; every Pokémon of yours, team or not, with no toggle

### A-110 · Geothermal ground at Blackthorn (D-080)

Your A-64 answer (geothermal ground in the highlands) is read two ways. It counts as volcanic land at the headquarters, so fire Pokémon like Magcargo and Typhlosion live at Blackthorn. It's also the heat for the Glasshouse and the Climate facility, as geothermal pipes. The Sevii Islands are then mostly for the sea Pokémon.

- **Why:** Blackthorn had no volcanic ground, so every fire Pokémon would have gone to a satellite. Your answer gave the highlands geothermal ground.
- **See it:** `#/estate/geothermal` (The estate map, Geothermal ground)
- **Could instead:** geothermal heat for the buildings only: fire Pokémon still live on the Sevii Islands (Mt. Ember); no geothermal ground at all

### A-111 · World records on your v2 Pokémon (D-080)

The world records approved for the companions (W-001 to W-015, D-033) now follow your Pokémon of that species in that game. W-001 (heat) goes to your HeartGold Typhlosion, for example, whichever one is on the team. W-016 and W-017 wait on your Emerald Meganium and your Crystal Miltank. You can also approve new records in the app, from a facility's job: each one is a Journal row, the newest row per record wins, and you can withdraw one the same way.

- **Why:** Without this, no world record could reach a v2 Pokémon, and under D-039 the jobs with no game mechanic (heat, cold, calm, plant care) couldn't be staffed at all. It's a new reading of A-49 for the fresh start.
- **See it:** `#/facility/glasshouse` (The Glasshouse's jobs, Approve a world record)
- **Could instead:** the old records stay with the hidden companions; you approve every record again on your new Pokémon; records follow the species in any game, not just the record's own game

### A-112 · The land meets some jobs (D-080)

Some jobs are met by the land itself, and that counts the same as a Pokémon covering it with kit: the Glasshouse's heat (geothermal pipes), its water (the Route 45 river and rain cisterns), the cold vault's cold (the Ice Path's own ice), and the Climate facility's heat and cold. Built things, like a boiler or electric lamps, don't count until they're built.

- **Why:** The estate sits on real land with a river and a glacier; pretending a Pokémon has to make the cold in an ice cave would be odd. The facilities list says which jobs (marked land).
- **See it:** `#/facility/cold-vault` (The cold vault, Keeping it cold)
- **Could instead:** only Pokémon meet jobs: the land is shown but doesn't count; built infrastructure counts too

### A-113 · Staffing stays a plan (D-080)

Each facility page has Suggest a staff plan. It gives each job to a resident who holds it on a game mechanic or your record, spreading the work so one Pokémon doesn't do everything. Nothing is saved until you save the plan, and a plan never takes anyone off a team.

- **Why:** You decide who works where; the app shows who could.
- **See it:** `#/facility/glasshouse` (The Glasshouse's facility page, Suggest a staff plan)
- **Could instead:** the estate staffs itself from the best candidates, with no plan to save; no suggestion: you assign every job by hand

### A-114 · The preserve's clients (D-080)

The Day-Care preserve page lists who could be a client: the Champions and the Elite Four from the Trainer Library, for "other amazing trainers". It's a proposal. Nobody has booked, and nothing about stays, prices or the preserve's land is made up: those stay open on the page.

- **Why:** Your words for who it serves, D-079.
- **See it:** `#/preserve` (The Day-Care preserve, Who could be a client)
- **Could instead:** every trainer in the library; no client list until you name some

### A-115 · The Sevii Islands page (D-080)

The satellite's page shows its game facts, the residents whose land is only there (the sea, mostly), and every Sevii place with the wild Pokémon FireRed's encounter tables put there. HeartGold and SoulSilver have no Sevii Islands, so FireRed is the source.

- **Why:** "Oh, definitely Sevii Islands." The islands are a real place in FireRed with their own wildlife.
- **See it:** `#/sevii` (The Sevii Islands)
- **Could instead:** LeafGreen's tables; no wild Pokémon, just the land

### A-116 · The Glasshouse on your records (D-080)

The Glasshouse reads your records now. The egg schedule comes from your blueprints' lines, then your teams' lines, slowest first (species that can't breed are left out). The crop plan is the medicine crop plus every berry one of your builds holds. Each room's jobs come from the facility list, with who of yours could hold them. The studbook tab lists your Pokémon with a sire, a dam, a blueprint or hatch moves. Nutrition reads the residents' body sizes. The plan's drawing no longer names Magcargo, Ampharos or Mamoswine as staff; the design text (D-045) still describes the Magcargo hearth.

- **Why:** The old pages read the hidden companions' program and builds, so after the fresh start they showed people and plants that weren't there.
- **See it:** `#/glasshouse` (The Glasshouse, every tab)
- **Could instead:** keep the canon program's lines (the old stud lines) in the schedule; only blueprints, not team lines

### A-117 · One compound (D-080)

The Estate, the Homestead and the facilities are one drill-down: the estate page, then a facility, then its jobs. The old Homestead link opens the estate. The map has a pin for every facility, coloured by how well your residents cover it. The menu's World section lists the Estate, the Glasshouse, the Day-Care preserve and the Sevii Islands.

- **Why:** You described it as all one thing: "It's all a part of it."
- **See it:** `#/estate` (The Estate)
- **Could instead:** keep a separate Homestead page for the jobs and an Estate page for the land
