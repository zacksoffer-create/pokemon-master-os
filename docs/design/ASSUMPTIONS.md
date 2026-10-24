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
