# Assumptions register

What the assistant assumed while building, so you can see each one and keep, change or reject it (Zack, 2026-10-24: *"make assumptions and decisions as you need to, just keep track so I can have my input"*). Generated from `engine/store/assumptions.json` by `engine/store/assumptions.py`; the same items are in the app under **Your calls**, each with a link to where it shows. Every item is reversible; each phase's set is one PROVISIONAL row in `docs/DECISION_LEDGER.md`.

## Master plan defaults

### A-01 · Ace test (D-066)

The Ace score is the plain average of the two win rates (Elite Four and Champions). It decides nothing on its own: Ace is earned only by clearing both bars.

- **Why:** Q1 of the master plan was open and blocked the build; the average was already what the engine computed.
- **See it:** `#/standards` (The standards)
- **Could instead:** weight the Champions more; use the lower of the two rates

### A-02 · Ace test (D-066)

The Elite Four's and Champions' Pokémon fight with no EVs (the games give trainers none); the unread field_evs_each: 85 setting was removed. Our builds with blank EVs still fight on 85 each (D-061).

- **Why:** Q2: it's how the Ace count you accepted in D-064 was made, so the numbers stay what you saw.
- **See it:** `#/standards` (The standards)
- **Could instead:** give their side 85 each too (every Ace number would move)

### A-03 · Storage (D-066)

Reference data and definitions live in git; your own records (My Pokémon, My Builds, My Teams) in append-only Sheet tabs; pictures in a Drive folder the app makes. D-025's 'canon lives in the Sheet' is read as 'your data lives in the Sheet'.

- **Why:** Q3, read as approved by D-065 (use the old framework, build the new plan).
- **See it:** `#/record` (The record)
- **Could instead:** everything in the Sheet; everything in git

### A-04 · Your Pokémon (D-066)

You can have several of the same species in one game; each gets its own id with a token.

- **Why:** Q4: a breeding program needs more than one of a line.
- **See it:** `#/mine` (Your Pokémon)
- **Could instead:** one per species per game

## Phase 4 · breeding stock

### A-05 · Blueprints (D-067)

A blueprint is a design: a build marked kind 'blueprint' in My Builds, as many as you like. D-038 still decides which animals live at the ranch.

- **Why:** Q10 of the master plan; a design costs nothing to keep.
- **See it:** `#/stock` (Breeding stock)
- **Could instead:** cap blueprints per line; blueprints only for ranch lines

### A-06 · Hatch rules (D-067)

'Possible' follows the hatch rules as the games' own code builds an egg (the pret decompilations: move order, push-out, hatch level 5 in Gens 2-3 and 1 in Gen 4). The four-state verdict informs and decides nothing; learnability stays the gate.

- **Why:** The code is the most exact source there is.
- **See it:** `#/stock/heartgold/Swinub` (Swinub's catalogue)
- **Could instead:** a simpler 'any egg move' rule

### A-07 · Lineages (D-067)

A line's own male can be a link in a breeding chain (hatched with some moves, learns the rest himself).

- **Why:** Larvitar's lines were empty without it.
- **See it:** `#/stock/heartgold/Tyranitar` (Larvitar's catalogue)
- **Could instead:** fathers from other lines only

### A-08 · Studbook (D-067)

Among equally short planned pedigrees, the studbook prefers a journey companion who can reach the game on cartridge (same generation, or Gen 3 to 4 by Pal Park). A Crystal companion in a Gen 4 cross is still allowed; B29 stays your call.

- **Why:** It keeps a plan doable on real cartridges.
- **See it:** `#/breeding/studbook` (The studbook)
- **Could instead:** no preference; only same-generation companions

### A-09 · What a set suggests (D-067)

'What a set might suggest' shows only evidence by kind (game mechanics, canon about the species) and draws no conclusion.

- **Why:** An interpretation would be a hypothesis for the journal, not a fact.
- **See it:** `#/stock` (Breeding stock)
- **Could instead:** let it propose an interpretation, marked hypothetical

## Phase 5 · Trainer Library

### A-10 · Who's in the library (D-068)

Every Gym Leader, Elite Four member, Champion, rival meeting, rematch and villain boss or admin of the five games, plus the special battles (Red, the Kimono Girls, Eusine, Li and a few more). Route trainers, the Battle Tower and Frontier facilities, and partner-only teams are left out.

- **Why:** The spec's 'notable trainers'; the left-out ones are thousands of teams nobody benchmarks against.
- **See it:** `#/trainers` (The directory)
- **Could instead:** add the Frontier Brains; add the Battle Tower or route trainers

### A-11 · Names (D-068)

Rivals you name in the game get their usual names: Crystal and HeartGold's '?' is Silver, Platinum's 'Cedric' placeholder is Barry, FireRed's 'Terry' placeholder is Blue.

- **Why:** The data holds a placeholder, not a name; these are the names everyone uses.
- **See it:** `#/trainer/silver` (Silver)
- **Could instead:** your own names for them

### A-12 · Identities (D-068)

The games' Blue and the anime's Gary are one trainer (Gary, also listed as Blue), with every version under him.

- **Why:** They're the same character; the library is identity → versions.
- **See it:** `#/trainer/gary` (Gary)
- **Could instead:** two identities, Blue and Gary

### A-13 · Identities (D-068)

The anime's May and Emerald's rival May are one trainer. Brendan stays his own.

- **Why:** Same character across media, like Blue and Gary.
- **See it:** `#/trainer/may` (May)
- **Could instead:** separate the anime May from the games' May

### A-14 · Identities (D-068)

Crystal's unnamed Rocket Executives are one group identity (Rocket Executives, Crystal); HeartGold's named ones (Archer, Ariana, Petrel, Proton) are their own trainers. The five Kimono Girls are one group identity.

- **Why:** Crystal doesn't say which executive is which; the Kimono Girls fight as a set.
- **See it:** `#/trainer/rocket-executive` (Rocket Executives)
- **Could instead:** map Crystal's executives onto Archer, Ariana, Petrel and Proton; each Kimono Girl her own trainer

### A-15 · Encounters (D-068)

Each encounter is its own version: a rematch is its own record, a rival's team per starter you chose is its own version ('you chose Chikorita'), and repeat meetings are numbered ('meeting 3 of 7'). HeartGold's tag battles are kept as the trainer's three-Pokémon team; double battles are kept as teams (benchmarks are one-on-one either way).

- **Why:** The spec asks for versions you can compare and pick; one record per real fight does that.
- **See it:** `#/trainer/silver` (Silver's meetings)
- **Could instead:** fold rival starter variants into one version

### A-16 · Abilities and natures (D-068)

When the game doesn't fix a trainer Pokémon's ability, Blackthorn reads the species' first ability (marked standardized); HeartGold's ability overrides are kept. Natures come from a hidden value the data doesn't fix: marked unknown, and fights use a neutral nature.

- **Why:** The ability and nature are rolled from values the trainer data doesn't hold; guessing would look like fact.
- **See it:** `#/trainer/cynthia` (Cynthia's team)
- **Could instead:** compute the Gen 4 personality value (deterministic, but a lot of code); try both abilities

### A-17 · Evidence classes (D-068)

Every field of every team member carries one of five classes. Cartridge: species, level, moves, IVs, EVs and item confirmed, ability standardized unless the game sets it, nature unknown. Reconstructions: species confirmed; approved moves confirmed, drafted ones strongly inferred; an authored ability strongly inferred, else standardized; item unknown unless shown; nature, IVs, EVs and level standardized. In your own versions a field you kept keeps the original's class, a changed one is hypothetical.

- **Why:** Spec criterion 3: say what a version rests on, field by field.
- **See it:** `#/trainer/ash/ash%2Fsinnoh` (Sinnoh Ash's research)
- **Could instead:** fewer classes (known / assumed)

### A-18 · How they think (D-068)

The games' AI flags are read two ways: tendencies (sets up early, takes risks, weather...) and competence (avoids failing moves, weighs damage, expert judgment). Coach settings are tendencies, measured sliders are evidence, authored sliders are 'your reading', an interpretation (master plan Q9).

- **Why:** A flag says how moves get scored, not what the trainer plans; keeping the kinds apart stops an interpretation passing as a measurement.
- **See it:** `#/trainer/cynthia` (How Cynthia thinks)
- **Could instead:** one combined 'AI level'

### A-19 · Benchmarks (D-068)

A collection's default bar is 70%. The Ace collections keep the Ace test's own bars (80% Elite Four, 70% Champions). You can move any bar on the benchmark page; the group's version stamp changes with it.

- **Why:** 70% matches the Champion bar you already accepted.
- **See it:** `#/bench` (Benchmarks)
- **Could instead:** a different default; a bar per collection

### A-20 · Benchmarks (D-068)

A group's rate counts each distinct Pokémon once (the same species, set and level is one fight), as the Ace test does; a team's own line counts each of its Pokémon. A draw isn't a win.

- **Why:** It's the Ace test's rule, so the Ace collections give the Ace test's numbers. How rematches should weigh is still master plan Q6.
- **See it:** `#/bench?c=ace-champion-gen4` (The Ace collections)
- **Could instead:** count every team slot (a rematch counts twice); a draw as half a win

### A-21 · Lenses (D-068)

Two lenses. 'As encountered': their team exactly as the game has it, yours at their top level. 'Standardized': both at Lv 100 (the Ace test's terms). Game collections default to as encountered; the Ace, anime and journey groups to standardized. A reconstruction has no game levels, so it's always standardized.

- **Why:** The spec asks both 'how would mine do in the game' and 'how does mine compare on equal footing'.
- **See it:** `#/bench` (Benchmarks)
- **Could instead:** yours at its own level; a level cap per game

### A-22 · Benchmarks (D-068)

A benchmark runs in your Pokémon's generation; a team from another generation is skipped and listed, not converted. Moves your build doesn't list are filled from the strongest set in the generation's reference game (Crystal, Emerald, Platinum), as the Ace test fills them.

- **Why:** Converting a team across generations would invent moves and mechanics.
- **See it:** `#/bench` (Benchmarks)
- **Could instead:** read Gen 3 teams in Gen 4 rules

### A-23 · Your versions (D-068)

Your versions of a trainer are teams in My Teams with three new fields (kind, trainer, parent): kind 'custom' (optimized or what-if) or 'all-time'. 'Optimize' gives every member the engine's strongest set at Lv 100 and keeps species, ability and item. The original version never changes.

- **Why:** Spec criterion 9, on the record store you already have; the team lab opens them like any saved team.
- **See it:** `#/trainers/variant/platinum%2Fcynthia` (Make a version of Cynthia)
- **Could instead:** a separate Trainer Versions tab; optimize by fights instead of the strongest set

### A-24 · Your groups (D-068)

Groups of teams you make on the benchmark page stay in this browser, not the Sheet.

- **Why:** A quick test shouldn't need a Sheet change; if you use them a lot they can move to a tab.
- **See it:** `#/bench` (Benchmarks)
- **Could instead:** save them to a My Groups tab in the Sheet

### A-25 · Collections (D-068)

The collections are: per game, the Gym Leaders, Gym rematches, Elite Four with the Champion, their rematches, rival battles, villains and special battles; the Ace test's pools; the Gen 4 anime reconstructions; and your three Gen 4 journey teams.

- **Why:** One group per question you'd ask of a game; the Ace pools so the library and the Ace test agree.
- **See it:** `#/trainers` (The directory's collections)
- **Could instead:** add a 'whole league' group per game; add your Gen 2-3 journey teams

### A-26 · Intake (D-068)

A new claim kind, trainer_version, adds a version of a trainer with its roster once approved: its id must be new (a revision names the version it revises as parent, and the original stays), a trainer not in canon yet is added only when the claim gives a name, and each team member becomes a build in the library (<trainer>-<version>/<species>).

- **Why:** The master plan's 'intake that can create versions and rosters', without ever overwriting a version (D-049: approved before it lands).
- **See it:** `#/inbox` (The inbox)
- **Could instead:** let a claim replace a version's roster in place; a separate claim kind per roster change

### A-27 · Corrections (D-068)

A correction to a build in the library makes a new version of it: the old values are kept under the build's history with their version number, and the record store lists both. Corrections to a trainer's career or signature moves still change the value in place (the claim keeps the old value in its note).

- **Why:** The master plan: approved corrections overwrote build fields in place, which broke 'never overwrite canonical'.
- **See it:** `#/inbox` (The inbox)
- **Could instead:** version trainer corrections too; make each correction a separate build id

## Phase 6 · Poké Balls and equipment

### A-28 · Exterior art (D-070)

Each ball's exterior is the official Dream World art where it exists (15 balls), otherwise the game's own sprite, shown large and crisp. Art you upload replaces it everywhere. No AI-made exteriors.

- **Why:** Image generation isn't open to this project's free Gemini key, the spec rules out new paid services, and a made-up exterior could get the design wrong.
- **See it:** `#/balls` (The Poké Ball Collection)
- **Could instead:** commission or generate high-resolution exteriors and upload them; hotlink a fan wiki's renders

### A-29 · Interior art (D-070)

Every ball has a written interior direction (creative, labelled) and a brief to make its picture; the first interior you upload becomes that ball's standard interior. A Pokémon's own picture inside its ball uses the image packet's new 'Inside its Poké Ball' purpose. Until a picture exists the profile shows the direction and works fine without it.

- **Why:** No image generator is available here; the spec allows the brief-and-upload workflow when there isn't one.
- **See it:** `#/ball/luxury` (The Luxury Ball's interior)
- **Could instead:** connect a paid image service; a set of commissioned interiors

### A-30 · Mechanics (D-070)

Every ball's effect comes from the game's own catch code at a pinned commit (Red, Crystal, Emerald and FireRed, Platinum, HeartGold) and is re-checked against it on every build; the games' bugs are kept and named. Gen 1 is shown for history only.

- **Why:** The spec asks for verified, game-specific mechanics; the code is the most exact source.
- **See it:** `#/ball/moon` (The Moon Ball, Crystal vs HeartGold)
- **Could instead:** the intended behaviour, with the bugs as footnotes

### A-31 · The catch calculator (D-070)

One throw's chance, worked out the game's own way: the wild Pokémon's max HP assumes IV 15 (DV 8 in Gen 2) and no EVs; each generation's catch rates come from its own data (Crystal, Emerald for FireRed too, Platinum for HeartGold too); Crystal's Heavy Ball reads Platinum's Pokédex pounds through Crystal's own conversion; the Safari Zone's rocks and bait and the Great Marsh's mood aren't modelled.

- **Why:** These are the only inputs the calculator can't know; the defaults are the average case.
- **See it:** `#/balls/catch` (The catch planner)
- **Could instead:** let you set IVs; model Safari bait and rocks

### A-32 · Ball names (D-070)

Crystal's Park Ball (the Bug-Catching Contest's ball) and HeartGold's Sport Ball are one ball, shown as the Park Ball in Crystal; Gen 4's Park Ball is Pal Park's, a different ball. Crystal has no Safari Ball (its constant is an alias of the Moon Stone).

- **Why:** That's how the games and PKHeX number them (24 and 25).
- **See it:** `#/ball/sport` (The Sport Ball)
- **Could instead:** list Crystal's Park Ball as its own ball

### A-33 · Could it be in that ball? (D-070)

Blackthorn checks a ball against how the species (or what it evolved from) is met in that game: a hatched Pokémon in Gens 3-4 is in a Poké Ball, a gift or trade comes in a Poké Ball, a Safari Zone-only Pokémon in a Safari Ball, a Park Ball is never kept (Pal Park Pokémon keep their Gen 3 ball: from Bulbapedia, not yet checked in the code), a Cherish Ball means an event, and Gen 2 stores no ball. It's a note, never a block (D-024).

- **Why:** The spec asks for the legal ball for an individual in its game; your story still wins.
- **See it:** `#/pokemon/me%3Aheartgold%2FSnorlax` (Snorlax's ball in the Studio)
- **Could instead:** block illegal balls; drop the check

### A-34 · Categories (D-070)

Six kinds: Standard (Poké, Great, Ultra, Master), Apricorn (Kurt's seven), Specialized (Net, Dive, Nest, Repeat, Timer, Dusk, Quick), Comfort (Luxury, Heal), Safari and parks (Safari, Sport, Park), Commemorative (Premier, Cherish), plus a 'special' filter for what each one's for.

- **Why:** The spec's categories, made to cover all 25 without overlap.
- **See it:** `#/balls` (The collection's filters)
- **Could instead:** put Luxury and Heal under Specialized

### A-35 · The equipment library (D-070)

28 pieces of gear (bikes, rods, finders, devices, cases, gardening tools, scopes) in the games' own words; the Running Shoes, Pokégear, PokéNav and Pokétch aren't bag items and get short Blackthorn summaries. Which games have each is authored, checked against the games' item lists where they're fetched.

- **Why:** The spec asks for a simpler library beyond the balls.
- **See it:** `#/equipment` (The equipment library)
- **Could instead:** include every key item; only gear with a field use

### A-36 · Your inventory (D-070)

Your gear is a new My Gear tab in the Sheet: one row per item per game (have it, how many, a note), the newest row wins. Saving it needs the updated WebApp.gs (its list of the app's tabs gains My Gear).

- **Why:** The same append-only pattern as your Pokémon, builds and teams.
- **See it:** `#/equipment/super-rod` (The Super Rod's inventory)
- **Could instead:** keep inventory in the browser only

### A-37 · Menu (D-070)

Poké Balls and Equipment sit under Pokédex & Reference; your ball shows on each Pokémon's profile.

- **Why:** They're reference libraries first; the personal side lives on your Pokémon.
- **See it:** `#/balls` (The menu)
- **Could instead:** a sixth space for Equipment; under My World

### A-38 · How you get each ball (D-070)

Read from each game's own scripts, marts, item balls, hidden items, phone gifts, prize tables and Kurt's table at the pinned commits (1,132 ways, each citing its file and line). Not counted: HeartGold's 26 give lines whose item is set elsewhere, the scratch-off prizes, the Pokéwalker and Emerald's Battle Pyramid Pickup. Where nothing was found (FireRed's Dive and Premier Balls, HeartGold's Dive Ball, the Cherish Ball) the page says so. How you get each piece of gear isn't read yet.

- **Why:** The spec asks for acquisition that's accurate per game; the code is exact, and saying what wasn't read keeps a gap from looking like a fact.
- **See it:** `#/ball/luxury?g=emerald` (The Luxury Ball in Emerald)
- **Could instead:** fill the gaps from Bulbapedia, labelled as such; read the gear's gifts the same way

## Phase 7 · Capability, survival and homestead

### A-39 · Capabilities (D-071)

One model of 35 capabilities in seven areas: the spec's six (mobility, food and water, shelter and environment, safety, tools and construction, ecological awareness) plus life at home. The 27 the wilderness engine had keep their ids and evidence; eight are new: water supply, cold source, heat tolerance, manipulation, construction, electricity, tracking and navigation.

- **Why:** The spec asks for a capability modelled once and reused everywhere, and names these gaps.
- **See it:** `#/capabilities` (Capabilities)
- **Could instead:** fewer, broader capabilities; split heat source into warmth and cooking fire

### A-40 · How evidence reads (D-071)

Every piece of evidence keeps three separate labels: its layer (A game mechanic, B biology, C equipment), its class (mechanic, inferred, hypothesis, Blackthorn) and whether you approved it. A need then reads Covered, With equipment, If taught, Plausible, Needs your approval or Gap. There's no overall score. A species' overworld ability counts as covered only when every ability it can have does the job (Magcargo's two both warm eggs); otherwise it's plausible until the build names the ability.

- **Why:** The spec forbids an opaque score and asks for canon kept apart from interpretation (Test E).
- **See it:** `#/survival` (World readiness)
- **Could instead:** a weighted readiness percentage; count teachable field moves as covered

### A-41 · Bodies (D-071)

The Gen 4 Pokédex's body shape is read as anatomy: arms, two legs with free forelimbs, or tentacles suggest manipulation; a large or huge four-legged body suggests hauling. Wings are never read as flight (Scizor's own Pokédex says its wings aren't for flying).

- **Why:** It's the games' own body data, so it's better evidence than a guess from type.
- **See it:** `#/capability/manipulation` (Manipulation)
- **Could instead:** hand-authored anatomy per species; no anatomy, Pokédex text only

### A-42 · Pokédex misreadings fixed (D-071)

Four of the wilderness engine's Pokédex patterns read too much: 'not used for flying' counted as flight, 'dangerously' as danger sense, 'can be seen from far away' as scouting, and any mention of the sea as carrying people over water. They're narrower now, and this changes what the profile and breeding pages show too.

- **Why:** A misreading presented as evidence is what the spec warns against.
- **See it:** `#/capability/air_travel` (Air travel)
- **Could instead:** keep the broad patterns and hand-reject false hits

### A-43 · Moves put to use (D-071)

A move a build actually knows can be put to use outside battle, as a hypothesis: Flamethrower for heat, Ice Beam for cold, Thunderbolt for electricity, Water Gun for water, X-Scissor for cutting, Heal Bell for healing, Rain Dance for weather, Roar for keeping wild Pokémon off, Odor Sleuth for tracking. Field moves stay game mechanics.

- **Why:** The spec asks that learned and inherited moves shape an individual's specialisation without being treated as canon.
- **See it:** `#/survival` (A member's holders)
- **Could instead:** no move uses; only egg moves count

### A-44 · Equipment and training (D-071)

Seven equipment rules, proposed: a harness or a saddle for large Pokémon that haul or carry, hand tools and garden tools for a Pokémon with a grip, a rescue kit for one that tracks or scouts, and a dynamo (and lamps) for an Electric type. A Pokémon qualifies on its own evidence; the rule counts only when the kit is packed.

- **Why:** Layer C is the spec's equipment-assisted capability; the anatomy decides who can use what.
- **See it:** `#/capability/construction` (Construction)
- **Could instead:** no layer C until you author each one; a longer equipment list

### A-45 · The kit (D-071)

Game items do what the game says (Potions heal, an Escape Rope gets you out of a cave, Repel keeps weaker Pokémon away, rods, finders, maps, Go-Goggles). Camp gear is Blackthorn's (tent, stove, lanterns, water filter, rations, cold- and hot-weather clothing, climbing kit) and says so.

- **Why:** Equipment is half of survival; game items are canon, camp gear isn't.
- **See it:** `#/survival` (Kit)
- **Could instead:** no camp gear: game items only

### A-46 · Scenarios (D-071)

Eleven scenarios: the spec's eight (winter mountain, dense forest, coastal or marine, cave, extended camp, wetland, long overland journey, hazardous research) and Field readiness's emergency, night travel and living in town. Each has conditions, hazards, food and water, a recommended kit, the field moves its ground calls for, and needs marked critical, important or useful. They're illustrative Blackthorn scenarios; edit capability/scenarios.json.

- **Why:** The spec's list, made concrete so a team can be assessed against them.
- **See it:** `#/survival` (Scenario)
- **Could instead:** fewer, simpler scenarios; scenarios tied to real game locations

### A-47 · Provisions (D-071)

What to carry if nobody forages: rations a day by body size (small 1, medium 2, large 4, huge 8), 2 for the trainer, and as much water. A Blackthorn standard, labelled as one, not canon.

- **Why:** The spec asks to estimate consumption without inventing precision; this is a stated method you can change.
- **See it:** `#/survival` (Provisions)
- **Could instead:** by weight instead of size class; no estimate at all

### A-48 · Slot cost (D-071)

A field move earns its place in a battle moveset if it does at least 70 damage that generation (Surf, Fly, Waterfall, Strength, Rock Climb, Dive, Dig, Headbutt, Secret Power) or is Soft-Boiled or Milk Drink; any other field move costs a slot. Two slot-costing field moves on one Pokémon is an HM slave (D-018).

- **Why:** The spec asks for battle moveset opportunity costs; the threshold is stated and changeable.
- **See it:** `#/survival` (Cartridge readiness)
- **Could instead:** a different power line; judge each move by hand

### A-49 · World records follow your Pokémon (D-071)

W-001 to W-017 are about one of your Pokémon, so they follow it wherever it's assessed: your Emerald Meganium's W-016 counts at the Glasshouse even though the Homestead reads everyone in HeartGold. A species on someone else's team doesn't get them.

- **Why:** MASTER_PLAN's 'species-level records across games', resolved by the individual the record describes.
- **See it:** `#/facility/glasshouse` (Tending the berry beds)
- **Could instead:** apply a W-record to every Pokémon of that species

### A-50 · Facilities (D-071)

Fourteen facilities as capability networks: the Glasshouse and its cold vault (approved), the nine ranch facilities, and four of the spec's concepts as proposals: Research Institute, Workshop and equipment depot, Habitats and conservation grounds, and Dragon's Den research. Each job is met by any of its capabilities or by infrastructure (named, Blackthorn). Under D-039 one of yours can staff a job only on a game mechanic or a record you approved; other evidence makes it a candidate. Species you don't have that a mechanic qualifies are shown as hires.

- **Why:** The spec's facility model, kept inside D-039.
- **See it:** `#/homestead` (The Homestead)
- **Could instead:** leave the four new facilities out until you ask; let biology staff a job

### A-51 · Plans, not facts (Q13) (D-071)

Staff and expedition plans are plans: saving one changes nobody's team or home (D-037, D-042). They're saved as My Teams rows (kind staffing or expedition, with the facility or the scenario and kit), so there's no new tab and no Apps Script change.

- **Why:** Q13's proposal, taken as the default.
- **See it:** `#/facility/glasshouse` (Save this staff plan)
- **Could instead:** assignments as facts that move a Pokémon; a separate My Plans tab

### A-52 · Menu (D-071)

The Survival Lab replaces Field readiness under Labs (the old #/field address opens it); the Homestead sits in My World after the Estate; Capabilities joins Pokédex & Reference. Each Pokémon's profile gains 'Away from battle'.

- **Why:** MASTER_PLAN §3.1 maps Field readiness to the Survival Lab.
- **See it:** `#/survival` (The menu)
- **Could instead:** keep Field readiness as well; a separate Survival space
