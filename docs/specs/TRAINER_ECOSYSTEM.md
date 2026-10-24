# BLACKTHORN OS — TRAINER ECOSYSTEM & BENCHMARK DATABASE

(Zack, received 2026-10-24. Verbatim; the original's plain-text numbering and headings are kept as written.)

## Master Planning Prompt for Claude

### 1. Purpose and Project Context

This document defines the intended Trainer Ecosystem for Blackthorn OS, a personal Pokémon world-building, team construction, simulation, and optimization platform initially focused on Generations I–IV.

**This is one module of a larger Blackthorn OS master plan.** Integrate it with the other specifications rather than treating it as an independent application or immediate implementation request.

The Trainer Ecosystem's primary purpose is to establish a comprehensive, reliable, reusable library of recognizable Pokémon trainers whose teams, individual Pokémon, abilities, movesets, strategic identities, and accomplishments can serve as standardized benchmarks.

The database should enable the user to evaluate individual Pokémon builds, compare teams, test hypothetical matchups, earn qualifications, and explore historical or fictional scenarios.

The inspiration comes partly from NBA 2K's historical rosters, coaching tendencies, playbooks, and MyNBA systems.

However, **the primary objective is not to recreate NBA 2K's MyGM or franchise-management gameplay.**

The trainers are predominantly static reference characters, with optional user-created variations.

Build the reference world first. Allow the user's creations to interact with it.

---

### 2. Core Design Principles

1. **Static reference foundation:** Canonical trainer versions should remain stable, reproducible reference records.

2. **Historical authenticity:** Reconstruct game, anime, and relevant manga trainers as accurately as their respective source material permits.

3. **Evidence-backed interpretation:** Separate explicitly established facts from reasonable deductions, standardized assumptions, and creative interpretations.

4. **Simulation readiness:** Trainer profiles should supply the information necessary for existing 1v1 benchmarks and the proposed full 6v6 simulation system.

5. **Optional creative freedom:** Permit all-time teams, optimized versions, and custom variants without modifying original canonical profiles.

6. **Reusable data:** Research and reconstruct a trainer once; make the resulting records useful throughout Blackthorn OS.

7. **User-directed evaluation:** The system provides evidence, statistics, comparisons, and recommendations. The user decides which teams or builds are preferable.

8. **Generation-aware design:** Initially prioritize Generations I–IV while allowing future expansion into later generations.

9. **Integration before duplication:** Use shared Blackthorn systems for Pokémon builds, moves, items, qualification rules, battle mechanics, and research sources.

10. **Controlled scope:** Do not introduce dynamic career simulation, trainer recruitment, evolving management skills, or franchise progression as required features.

---

# 3. Three Categories of Trainer Records

## Category A — Exact In-Game Trainers

**Priority: Foundational**

Create faithful recreations of important trainers across Generation I–IV games.

Include, as applicable:

- Gym Leaders
- Elite Four members
- Champions
- Rivals
- Major antagonists
- Significant recurring trainers
- Special postgame opponents
- Rematches and alternate encounter versions

These should be the most straightforward records to construct because their teams and mechanical properties are largely defined by the games.

Capture:

- Trainer identity and game version
- Encounter context and location
- Pokémon species and order
- Levels
- Movesets
- Held items
- Abilities
- IVs and other applicable trainer-specific parameters
- EVs, where actually defined
- Applicable trainer AI data or documented battle behavior
- Relevant mechanics and encounter-specific rules

Do not assume that every game trainer has conventional player-style EV investment. Reproduce the game's actual mechanics and identify missing or undefined values.

**Preserve exact source configurations wherever possible.**

Individual encounters should remain independently identifiable. A Champion's initial challenge and rematch are distinct records.

The objective is broad, accurate coverage of significant in-game trainers.

## Category B — Canonical Anime and Manga Trainers

**Priority: Research-intensive expansion**

Create deeply researched trainer reconstructions for important characters from the Pokémon anime and, where relevant, manga continuities.

Potential subjects include Ash, Gary, Paul, Cynthia, Lance, and other important trainers.

Support multiple historical versions of the same character.

For example, Ash may have distinct Kanto, Johto, Hoenn, and Sinnoh records.

For each version, research:

- Pokémon known to have been owned or used
- Teams used during specific battles or story arcs
- Demonstrated moves
- Significant battle performances
- Switching habits
- Offensive and defensive preferences
- Preferred strategies
- Risk tolerance
- Treatment and preservation of Pokémon
- Significant accomplishments
- Changes in demonstrated strategy over time

Use episodes, transcripts, credible reference materials, articles, videos, and other research sources.

### Canonical uncertainty

Anime Pokémon frequently lack explicit mechanical information such as IVs, EVs, Natures, exact levels, and held items.

Do not manufacture these as canonical facts.

Instead, develop clearly documented reconstruction assumptions that translate anime characters into valid, simulation-ready Pokémon.

Support evidence classifications:

- **Confirmed:** Explicitly established by the source.
- **Strongly inferred:** Supported by reliable observations or deductions.
- **Standardized:** Assigned using Blackthorn's declared reconstruction methodology.
- **Hypothetical:** Deliberate creative interpretation.
- **Unknown:** Insufficient information.

Preserve the original evidence independently of the standardized simulation version.

The objective is a credible representation of the trainer, not an unfounded claim of absolute canonical accuracy.

## Category C — Select All-Time and Optimized Teams

**Priority: Special projects, not universal coverage**

For a limited collection of particularly important trainers, support individually curated all-time or optimized teams.

Possible subjects include Ash, Red, Cynthia, Lance, Gary, and Paul.

These should be deliberate, thoughtful projects rather than automatically generated versions for every trainer in the database.

Explore questions such as:

- Which six Pokémon best represent this trainer?
- Which were their strongest demonstrated battlers?
- Which were their most historically significant partners?
- Which combination forms the strongest functioning team?
- How should signature Pokémon influence roster selection?
- What changes when optimizing for Generation IV versus unrestricted cross-generation rules?
- What movesets, Natures, EVs, items, and abilities best support the chosen team?
- What coaching philosophy most faithfully represents the trainer?

The result should be a curated interpretation with an explanation of the decisions made.

Allow multiple legitimate all-time interpretations when appropriate, such as "Most Iconic," "Strongest Competitive," and "Generation IV Optimized."

These records must never overwrite canonical source versions.

---

# 4. Trainer Identity and Profile Structure

Every trainer should have a recognizable identity, with multiple version records connected to that identity.

At the conceptual level, use:

**Trainer Identity → Canonical Version → Roster → Individual Pokémon Builds → Battle Philosophy → Tendencies → Simulation Profile**

These need not all be physically separate tables if a better database structure exists, but the relationships must be preserved.

### Trainer identity

Maintain:

- Name and identifying information
- Canon continuity
- Region and affiliations
- Titles and major roles
- Signature Pokémon
- Notable accomplishments
- Rivalries and relationships where relevant
- Brief biographical and strategic overview
- Relevant artwork and source references

### Trainer version

Maintain:

- Version identifier
- Source continuity
- Game, season, arc, or encounter
- Canonical versus interpreted status
- Applicable generation and ruleset
- Roster reference
- Reconstruction methodology
- Source evidence
- Version history

### Pokémon roster

Each trainer version should reference reusable Pokémon build records, with source-backed or standardized details as appropriate.

Avoid making the Trainer Database a second, incompatible Pokémon Builder.

Reuse the shared build format throughout Blackthorn OS.

---

# 5. NBA 2K-Inspired Coaching Tendencies

One of the most significant features is translating NBA 2K's coaching tendencies and playbook philosophy into Pokémon trainer behavior.

The system should describe how trainers are likely to act during battles.

Potential dimensions include:

| Tendency | What it influences |
|---|---|
| Offensive aggression | Preference for immediate pressure versus defensive positioning |
| Risk tolerance | Willingness to accept uncertain or high-variance outcomes |
| Switching tendency | Preference for repositioning and favorable matchups |
| Setup preference | Willingness to invest turns in future advantages |
| Defensive conservatism | Preference for damage prevention and long-term survivability |
| Ace preservation | Willingness to protect key Pokémon for later stages |
| Tactical adaptability | Willingness to depart from a preferred strategy |
| Prediction tendency | Willingness to anticipate opponent decisions |
| Resource conservation | Management of PP, health, status, and limited opportunities |
| Status and utility preference | Value assigned to non-damaging strategic actions |

These are candidate dimensions, not a mandatory final slider list. Evaluate overlap and eliminate redundant variables.

A 0–100 numerical scale is a useful presentation model.

However, **slider values must influence decision preferences, not directly dictate arbitrary action frequencies**.

A trainer with a Switching score of 80 should not blindly switch on 80% of turns.

Instead, switching preference should affect how the trainer evaluates valid tactical opportunities.

### Separate personality from competence

A major design requirement is distinguishing how a trainer prefers to battle from how effectively they make decisions.

An aggressive novice and an aggressive Champion can share philosophical preferences without possessing equal tactical intelligence.

Potential competence dimensions include:

- Awareness of type matchups
- Damage and survival assessment
- Prediction and uncertainty handling
- Strategic planning
- Opponent knowledge
- Understanding of team synergies
- Ability to recognize win conditions

Do not make extreme personality traits synonymous with poor decision-making.

---

# 6. Trainer Playbooks and Strategic Philosophies

A trainer's playbook describes their preferred overall battle strategy.

This is distinct from both individual tendencies and general tactical competence.

Potential styles include:

- Relentless offensive pressure
- Defensive attrition
- Balanced positional play
- Setup-oriented sweeping
- Status disruption
- Weather-focused strategies
- Specialized type or mechanic strategies
- Adaptive counterplay
- Ace-centered strategy
- Matchup-specific preparation

A playbook should inform the AI's decisions and make different trainers recognizable even when they use similar Pokémon.

For example, Paul might emphasize opponent-specific preparation and strategic adaptation, while another trainer might favor consistent execution of an established offensive system.

Those interpretations should be supported by research, rather than assigned purely from stereotypes.

A trainer profile may have one primary philosophy and several secondary tendencies.

Avoid excessive complexity unless it improves observable simulation behavior.

---

# 7. Trainer AI and 6v6 Simulation Integration

The proposed Blackthorn 6v6 simulator should use an established Pokémon battle engine, with Pokémon Showdown currently the leading candidate.

The Trainer Ecosystem should not independently recreate battle mechanics.

Instead, it should provide:

1. The trainer's complete simulation-ready roster.
2. The trainer's tactical tendencies.
3. The trainer's preferred playbook.
4. The trainer's competence and knowledge assumptions.
5. Any scenario-specific strategic instructions.

A shared battle engine should execute the legal moves, switching, damage, status effects, abilities, items, and other relevant mechanics.

The trainer AI decides which actions to select.

### Simulation philosophy

The objective is not perfect prediction of fictional battles.

The objective is a sufficiently credible, transparent, and consistent model that produces meaningful comparisons between Pokémon builds and teams.

Support repeated simulation batches, with approximately 100 battles as an initial user-facing standard.

Allow controlled variation in:

- Random battle outcomes
- Trainer tendencies
- Opponent builds
- Opening strategies
- Selected scenario assumptions

Separate controlled comparisons from exploratory scenarios.

Record which variables were held constant.

### Trainer knowledge

Do not give simulated trainers automatic access to hidden information.

Distinguish:

- Public battle information
- Information already revealed
- General species knowledge
- Prior scouting
- Reasonable predictions
- Unknown information

Tactical competence must not equal omniscience.

### Implementation status

The 6v6 engine is a planned, technically plausible system, not an already validated Blackthorn capability.

Preserve the existing 1v1 simulator as an established working foundation.

The Trainer Database should support both systems, even if full 6v6 implementation is delivered later.

---

# 8. Benchmark Library and Qualification Integration

**Benchmarking is the Trainer Ecosystem's primary reason for existing.**

The database should support evaluations of individual Pokémon and complete teams against standardized collections of recognizable opponents.

Potential collections include:

- Generation I–IV Gym Leaders
- Elite Four Pokémon
- Champion Pokémon
- Full Champion teams
- Regional rival teams
- Anime rivals
- Individual trainer versions
- Curated all-time trainer teams
- Custom challenge collections

### Existing Ace qualification

Blackthorn has an established, adjustable Ace recognition concept.

The current design uses approximately:

- 80% Elite Four benchmark coverage
- 70% Champion benchmark coverage

The benchmarks are evaluated through standardized 1v1 matchups.

The exact outcome definition, normalization assumptions, and threshold configuration should be inherited from the existing implementation rather than replaced without examination.

Users must be able to adjust qualification thresholds.

### Expansion opportunities

The same framework may eventually award other recognitions based on:

- Statistical thresholds
- Speed tiers
- Defensive survival
- Offensive performance
- Benchmark coverage
- Full-team simulated results
- Specialty against particular trainer collections

Build recognition and benchmark qualifications should remain related but distinct.

An archetype describes what a Pokémon is constructed to do.

A qualification demonstrates what it achieved under a defined test.

Deliberately optimizing a build to earn a special title or qualification is a desirable part of the experience, inspired by NBA 2K and historical FIFA traits.

Preserve that aspect of build culture.

### Versioning

Each benchmark collection should preserve its rules, participants, normalization assumptions, and threshold version.

Changing a benchmark definition should not silently change historical qualification records.

---

# 9. Historical Normalization and Fair Comparisons

Support two major modes of comparison without duplicating the underlying trainer identity.

### Authentic encounter

Reproduce the actual in-game configuration wherever it is known.

This answers:

"How would my Pokémon perform against the trainer as encountered in the original game?"

### Standardized benchmark

Apply an explicit common comparison framework.

This may involve:

- Standardizing levels
- Applying consistent IV/EV assumptions where source information is missing
- Choosing a common battle generation
- Defining item and move legality
- Assigning standardized trainer policies
- Applying common evaluation rules

This answers:

"How does my Pokémon compare against this trainer's team on standardized statistical terms?"

These should be selectable evaluation lenses derived from shared reference data.

Do not overwrite the authentic versions with normalized configurations.

The exact normalization policy should be coordinated with the Battle & Simulation specification.

---

# 10. Research Intake and Data Enrichment

Blackthorn should support a reusable research process for reconstructing trainer profiles.

The user may provide:

- Articles
- Website references
- Video links
- Episode information
- Manga references
- Game data
- Written observations
- Other research material

The envisioned workflow is:

**Source Intake → Evidence Extraction → Character Identification → Trainer-Version Matching → Reconstruction → User Review → Reference Record Update**

Extract relevant observations concerning:

- Team membership
- Demonstrated moves
- Tactical decisions
- Switching behavior
- Trainer preferences
- Major accomplishments
- Specific battle contexts

Maintain source references and distinguish explicit evidence from interpretation.

Where evidence conflicts, preserve the competing observations and identify whether they arise from different continuities, different points in the character's history, or genuine uncertainty.

The user should be able to review significant additions before they become part of the curated reference standard.

Reuse relevant content already available in Blackthorn's reference database.

Do not repeatedly research and reconstruct the same trainer whenever a new team is built.

---

# 11. Interface and User Experience

The Trainer Ecosystem should be a beautiful, useful reference library rather than an overwhelming management simulator.

### Trainer directory

Support browsing and filtering by:

- Name
- Region
- Game
- Generation
- Canon continuity
- Trainer category
- Title
- Significant accomplishments
- Pokémon roster
- Strategic style
- Available benchmark collections

### Trainer profile

Present:

- Prominent trainer artwork and identity
- Historical overview
- Signature Pokémon
- Accomplishments
- Available versions
- Team and individual build details
- Coaching philosophy
- Tendencies and playbook
- Benchmark availability
- Sources and reconstruction confidence

### Trainer-version comparison

Allow side-by-side comparisons of teams from different games, seasons, encounters, or creative variants.

### Simulation entry points

Users should be able to initiate trainer-related evaluations from:

- Individual Pokémon profiles
- Team Construction
- Battle Laboratory
- Trainer profiles
- Benchmark collections

Do not require users to navigate to a single centralized simulator screen for every analysis.

Maintain the shared active team, build version, and relevant simulation context.

### Editing permissions

Canonical reference profiles should not be casually overwritten.

A user who wishes to alter Cynthia's Platinum roster should create a custom variation or explicitly enter a curated data-correction workflow.

The core reference library remains stable.

---

# 12. Data Architecture and Scalability

Blackthorn currently relies primarily on Google Sheets, Google Drive, and Google Apps Script.

Preserve a shareable, browser-accessible, phone-friendly experience.

Avoid requiring installed software on a restricted work laptop.

The project should use reputable free tools wherever practical and should not require new paid services.

A separate local or hosted simulation worker may eventually be appropriate for demanding 6v6 calculations.

However, that implementation decision belongs to the shared Technical Architecture specification.

For this module, establish clear data interfaces rather than requiring a particular server implementation.

### Important architectural distinction

When the user describes trainer information as "hardcoded," the intention is a curated, stable, standardized reference database—not embedding thousands of character facts directly into application logic.

Maintain a distinction between:

- Source-backed reference data
- Derived or normalized simulation data
- User-created alternate versions
- Adjustable benchmark definitions
- Personal simulation results

Use reusable identifiers and shared Pokémon build records.

Support future data corrections and additional generations through versioned reference updates.

---

# 13. Scope and Priorities

### Core scope

- Accurate Generation I–IV major trainer database
- Separate canonical encounter versions
- Complete source-backed roster information
- Reusable Pokémon build references
- Standardization for benchmarking
- Trainer profile presentation
- Benchmark collections
- Existing 1v1 integration
- Trainer tendencies and playbook data suitable for eventual AI integration

### Important expansion

- Major anime trainer reconstructions
- Manga trainer versions where relevant
- Research intake and evidence management
- Enhanced historical scouting reports
- Trainer behavior evaluation
- Full 6v6 simulation integration once validated

### Selective creative features

- All-time trainer teams
- Optimized historical teams
- Custom trainer variations
- Alternate philosophies and playbooks
- Special hypothetical benchmark collections

### Explicitly outside the required scope

- Dynamic trainer career progression
- Automated roster recruitment and development
- MyGM-style multi-season franchise simulation
- Trainer economies or management currencies
- Relationship/morale mechanics invented solely to imitate sports games
- Automatically generating all-time teams for every trainer
- Adding gameplay stat bonuses solely because a trainer possesses a descriptive trait

These features can be explored separately if desired, but must not inflate the core Trainer Ecosystem.

---

# 14. Success Criteria

The Trainer Ecosystem should ultimately allow the user to:

1. Open an accurate Generation IV Champion profile and inspect their actual in-game team.
2. Compare multiple versions of the same trainer.
3. Inspect the research and assumptions behind an anime reconstruction.
4. Select a trainer team as a 1v1 or 6v6 benchmark.
5. Run or request standardized team comparisons using the relevant shared simulation engine.
6. Understand how a trainer's tendencies affect the modeled battle behavior.
7. Test a personal Pokémon build against recognizable groups of opponents.
8. Earn transparent, adjustable benchmark qualifications.
9. Create an optimized or all-time version of a favorite trainer without altering the original.
10. Reuse the trainer database across the individual builder, team builder, Battle Laboratory, qualification system, and hypothetical team scenarios.

The system should feel like a carefully curated historical roster database combined with the strategic depth of NBA 2K coaching profiles and the unique identity of Pokémon trainers.

---

# 15. Instructions for Integration into the Blackthorn OS Master Plan

When combining this prompt with the other Blackthorn specifications:

**Preserve the Trainer Ecosystem's identity as a primarily static, research-backed benchmark library.**

The following systems will have overlapping responsibilities and should share architecture:

- Individual Pokémon Builder — canonical build records and configuration formats
- Team Construction — roster analysis and team optimization
- Battle Laboratory — 1v1, 6v6, and trainer AI execution
- Tags & Qualifications — benchmark rules and earned recognition
- Pokémon Biology — species knowledge and reference sources
- Breeding & Lineage — inherited moves and individual origins
- Reference Database — provenance, versioning, and standardization
- Technical Architecture — Google integration and optional simulation workers

Avoid creating duplicate storage structures, incompatible Pokémon formats, separate benchmark engines, or disconnected trainer data.

Where another specification provides a more detailed design for a shared capability, use that specification as the authority and integrate the Trainer Ecosystem through stable interfaces.

**Planning priorities:**

First establish the common trainer data model and distinguish canonical records, reconstructed records, and optional creative variants.

Next determine which game data can be imported reliably and which major anime trainers require manual research.

Then define a consistent, interpretable trainer tendency and playbook system.

Finally connect that information to existing and future simulation services.

Do not make completion of a sophisticated 6v6 AI a prerequisite for building the trainer reference library.

Do not begin a wholesale rebuild from this prompt alone.

Instead, combine it with the other planning documents, audit existing Blackthorn components, identify reusable functionality, resolve overlapping dependencies, and propose an implementation sequence that preserves existing capabilities.

## Final Design Principle

**Blackthorn's Trainer Ecosystem exists to establish the Pokémon world's great trainers as recognizable, research-backed, reusable standards against which the user's own Pokémon and teams can be understood, challenged, and celebrated.**

The value comes from the quality of the reference data, the personality of the trainers, the consistency of the benchmarks, and the freedom to explore meaningful comparisons.

It does not require turning those trainers into an evolving franchise-management simulation.
