# BLACKTHORN OS — TAGS, BADGES, ARCHETYPES & QUALIFICATION ENGINE

Comprehensive System Design & Implementation Specification

(Zack, received 2026-10-24. Verbatim.)

## PROJECT CONTEXT

You are developing Blackthorn OS, a deeply interconnected Pokémon trainer toolkit inspired by the experience of living as a trainer in the Pokémon world.

The initial primary reference universe is Pokémon Generations I–IV, with particular emphasis on HeartGold and SoulSilver. The architecture should support future expansion without requiring the initial implementation to cover every generation.

This specification concerns the Tags, Badges, Archetypes, and Qualifications System, one of Blackthorn's most important interconnected features.

It should be integrated with the Individual Pokémon Builder, Team Builder, Battle Laboratory, existing 1v1 simulator, future 6v6 simulator, Trainer Database, breeding and lineage systems, and other relevant Blackthorn modules.

Do not treat this as a standalone application.

The objective is to create a deep, mathematically grounded recognition and identity system inspired by NBA 2K's MyPLAYER Builder, build archetypes, badges, and the culture surrounding rare or specialized builds.

The system should make constructing Pokémon intellectually rewarding, highly customizable, and personally meaningful.

## PART I — CORE DESIGN PHILOSOPHY

### 1. Recreate the NBA 2K Building Experience

One of the strongest inspirations for Blackthorn OS is NBA 2K's MyPLAYER Builder.

In 2K, players carefully allocate limited attributes, understand important thresholds, pursue particular badges, and develop builds that earn recognizable archetype names.

A major part of the culture revolves around:

* Discovering unusual builds.
* Pursuing rare or distinctive archetype names.
* Understanding attribute thresholds.
* Sacrificing certain strengths to achieve others.
* Optimizing within finite mathematical constraints.
* Creating recognizable individual identities.
* Experimenting with combinations that produce unexpected results.
* Sharing and comparing builds.

Blackthorn should recreate these experiences through Pokémon's existing mechanics.

However, do not introduce artificial limitations or mechanics where Pokémon already provides meaningful ones.

The primary constraints are the actual Pokémon mechanics: species base stats, IVs, EVs, Natures, Abilities, four move slots, held items, typing, game-specific legality, and other relevant restrictions.

The system should recognize and explain capabilities rather than arbitrarily manufacture them.

A player should be able to pursue a particular badge or build name, understand exactly what is necessary to earn it, and decide whether the opportunity cost is worthwhile.

This is central to the intended experience.

### 2. User-Directed Optimization

Blackthorn should not assume that there is one universally best Pokémon build.

The user decides what matters.

One build may be stronger offensively but lack recovery. Another may be better defensively but sacrifice important knockout thresholds.

Both may be excellent for different reasons.

Blackthorn should:

* Identify meaningful alternatives.
* Calculate their respective capabilities.
* Explain differences and opportunity costs.
* Recognize efficient stat allocations.
* Identify reachable badges and archetypes.
* Allow the user to pursue specific classifications.
* Make recommendations without forcing a single answer.

If one configuration clearly dominates another under the selected criteria, the system may explain that.

Otherwise, preserve meaningful tradeoffs.

### 3. Measurable Evidence as the Foundation

Most classifications should be derived from four evidence sources:

1. Raw stats and mathematical thresholds.
2. Damage and survival calculations.
3. 1v1 benchmark performance.
4. Eventually, 6v6 team-performance evidence.

The first three form the initial core.

The 6v6 engine is a planned major capability, but this recognition system must be useful and complete without depending on sophisticated 6v6 AI.

Do not present estimated, inferred, or untested results as verified qualifications.

## PART II — THE RECOGNITION HIERARCHY

Establish four interconnected but distinct concepts.

### 4. Tags — Descriptive Capabilities

Tags are structured, machine-readable descriptions of what a Pokémon possesses or can accomplish.

Examples:

* Physical Attacker
* Special Attacker
* Priority User
* Recovery User
* Physical Bulk
* Special Bulk
* Speed Control
* Setup Capability
* Pivoting Capability
* Offensive Coverage
* Defensive Utility

Some tags may be binary. Others may have numerical values or levels.

Tags should serve several purposes:

* Describe Pokémon builds.
* Support filtering and searching.
* Feed archetype classification.
* Inform team-construction recommendations.
* Support benchmark qualifications.
* Provide reusable information across Blackthorn modules.

Not every tag needs prominent visual recognition.

### 5. Badges — Tiered Specialization

Badges recognize meaningful levels of capability.

Examples:

* Physical Attacker
* Elite Physical Attacker
* Priority Finisher
* Physical Wall
* Special Wall
* Offensive Breaker
* Speed Specialist

A badge may have multiple levels inspired by 2K or EA Sports FC.

Potential labels include Bronze, Silver, Gold, Elite, or another carefully designed progression.

Do not assume every badge requires the same number of levels or identical percentage thresholds.

Some badges can be purely numerical. Others require demonstrated performance.

Badges should have explicit and explainable requirements.

### 6. Archetypes — Build Identity

An archetype is the recognizable identity of a completed Pokémon configuration.

It should describe how that Pokémon is built to function.

Examples:

* Physical Setup Sweeper
* Bulky Special Attacker
* Defensive Pivot
* 2-Way Priority Pivot
* Offensive Utility Specialist
* Priority Enforcer

Archetypes are derived from combinations of capabilities, not chosen arbitrarily.

A Pokémon's archetype should reflect its actual build, including stats, moves, Ability, item, and applicable specialties.

### 7. Qualifications — Demonstrated Accomplishments

Qualifications represent performance against defined standards.

The established example is Ace, based on the existing Blackthorn 1v1 simulator.

Other proposed qualification families include:

* Champion Specialist
* Elite Four Specialist
* Offensive Conqueror
* Defensive Breaker
* Speed Hunter
* Disruption Specialist
* Versatility Specialist

These are provisional concepts requiring appropriate definitions and validation.

Qualifications differ from archetypes.

An archetype describes what a build is.

A qualification describes what it has demonstrated against a particular standard.

A Pokémon may qualify as Ace regardless of whether its archetype is an offensive sweeper, defensive specialist, or unusual hybrid.

## PART III — STAT-BASED QUALIFICATIONS

### 8. Establish Numerical Stat Standards

Implement classification support for all six stats:

* HP
* Attack
* Defense
* Special Attack
* Special Defense
* Speed

The initial standardized comparison environment should use Generation IV at level 100, while allowing calculations for actual in-game levels and other supported generations.

Raw-stat thresholds should be generation-aware and mathematically consistent.

#### Proposed Initial Reference Values

These are calibration candidates, not final competitive standards.

Attack, Defense, Special Attack, Special Defense:

* 328 — base-100 equivalent at maximum beneficial-Nature investment.
* 350 — base-110 equivalent.
* 394 — base-130 equivalent.
* 438 — base-150 equivalent.

HP:

* 364 — maximum-investment base-80 equivalent.
* 404 — base-100 equivalent.
* 444 — base-120 equivalent.
* 504 — base-150 equivalent.

These values should be evaluated against the actual Generation IV Pokémon population before final badge thresholds are adopted.

Do not confuse these statistical reference values with universally meaningful competitive breakpoints.

#### Speed Requires Special Treatment

Speed badges should be derived primarily from meaningful competitive thresholds rather than arbitrary round numbers.

Proposed Generation IV level-100 unboosted Speed benchmarks:

* 329 — outruns maximum positive-Nature base-100 Speed.
* 351 — outruns maximum positive-Nature base-110 Speed.
* 362 — outruns maximum positive-Nature base-115 Speed.
* 373 — outruns maximum positive-Nature base-120 Speed.
* 395 — outruns maximum positive-Nature base-130 Speed.

These are proposed qualification milestones.

Verify and supplement them using appropriate Generation IV competitive Speed reference data.

The engine must correctly distinguish outspeeding from tying.

Also account for:

* Nature and EV investment.
* Choice Scarf.
* Dragon Dance and other stat boosts.
* Weather-dependent abilities.
* Paralysis and other modifiers.
* Move priority brackets.
* Trick Room.
* Relevant generation-specific mechanics.

Natural Speed, boosted Speed, priority-based turn control, and Trick Room specialization should remain separate concepts.

A low-Speed Pokémon with powerful priority should not automatically receive an Elite Speed qualification.

#### Minimum Investment and Breakpoints

The builder should calculate:

* Minimum EV investment to reach a selected threshold.
* Which opposing Pokémon are newly outsped.
* Which thresholds are lost when investment decreases.
* Whether additional investment produces a meaningful benefit.
* Remaining EV budget after meeting the objective.

The aim is to make every stat-allocation decision understandable.

## PART IV — DAMAGE-BASED QUALIFICATIONS

### 9. Evaluate Actual Offensive and Defensive Performance

Raw stats cannot fully describe battle effectiveness.

For instance, Huge Power, Technician, Choice Band, typing, held items, and specific moves substantially affect effective performance.

Therefore, implement a separate system that recognizes demonstrated damage and survival capabilities.

Reuse the existing Smogon-based damage calculation infrastructure where appropriate.

Do not recreate established damage mechanics unnecessarily.

#### Core Offensive Measurements

* Guaranteed OHKO against specified opponents.
* Possible OHKO and probability.
* Guaranteed 2HKO under clearly stated conditions.
* Important damage thresholds.
* Knockout coverage across opponent collections.
* Coverage against defensive specialists.
* Priority-move knockout potential.
* Physical and special attacking versatility.
* Improvement following stat boosts.

A guaranteed KO must state the assumptions under which it is guaranteed, including that the move connects when applicable.

#### Core Defensive Measurements

* Survival against specified physical attacks.
* Survival against specified special attacks.
* Survival after entry hazards.
* Multiple-hit and multi-turn survival.
* Recovery-related benchmarks.
* Effective physical and special bulk.
* Ability to survive and respond meaningfully.

Do not equate high Defense or Special Defense alone with being an effective wall.

HP, typing, Ability, recovery, defensive moves, items, and matchup conditions must be considered.

#### Proposed Damage-Based Badge Families

Offensive:

* Physical Breaker
* Special Breaker
* Priority Finisher
* Mixed Wallbreaker
* Setup Threat

Defensive:

* Physical Wall
* Special Wall
* Mixed Wall
* Defensive Anchor
* Counterattacker

These are initial categories, not an exhaustive or finalized list.

#### Priority Finisher Example

For a Technician Scizor using Bullet Punch, evaluate knockout coverage against standardized opponents at:

* 100% HP
* 50% HP
* 25% HP

These represent different levels of finishing power.

The badge should reflect demonstrated knockout capability rather than simply the presence of a priority move.

Account for priority brackets, Speed within equal-priority brackets, damage modifiers, and opposing defensive mechanics.

## PART V — STANDARDIZED BENCHMARK COLLECTIONS

### 10. Build Reusable Opponent Collections

Qualifications should be derived from carefully defined, versioned reference populations.

Proposed collections:

1. Elite Four Pokémon from the selected Generation I–IV trainer records.
2. Champion Pokémon from the selected trainer versions.
3. Competitive offensive threats.
4. Competitive defensive threats.
5. Fast attackers and priority users.
6. Disruption, status, and endurance specialists.

Each entry must represent a specified build, not merely a species.

Records should support:

* Species.
* Level.
* IVs.
* EVs.
* Nature.
* Ability.
* Moves.
* Item.
* Battle conditions.
* Source or reconstruction provenance.
* Standardization rules.

The Trainer Database should be a shared source of historical trainer benchmarks.

Preserve distinctions between:

* Exact in-game trainer versions.
* Reconstructed anime or manga versions.
* Standardized comparisons.
* Selected hypothetical or optimized trainer versions.
* Competitive benchmark sets.

Do not overwrite canonical versions with custom or optimized interpretations.

#### Benchmark Weighting

Allow explicit decisions about whether results weight:

* Every trainer-team slot equally.
* Every unique opponent build equally.
* Every species equally.
* Specific threats more heavily.

Avoid silent duplication bias.

Collections should be curated and versioned.

## PART VI — THE EXISTING ACE QUALIFICATION

### 11. Preserve and Extend the Established Ace System

Blackthorn already has an adjustable Ace qualification powered by an existing 1v1 simulator.

The established conceptual criteria are:

* Defeat or qualify against at least 80% of the Elite Four benchmark collection.
* Defeat or qualify against at least 70% of the Champion benchmark collection.

Both conditions must be satisfied.

These thresholds are user-adjustable.

Before modifying the system, inspect the current implementation to determine:

* Exactly how matchups are evaluated.
* How victory is defined.
* Whether repeated trials are already used.
* How opponent builds are standardized.
* How benchmark populations are constructed.
* How results are stored.
* How thresholds can be modified.

Preserve working behavior and avoid replacing it unnecessarily.

The existing simulator is regarded as a useful, sufficiently reliable foundation for the current design stage.

#### Expand the Qualification System

Use the same general architecture to support additional qualifications.

A particular benchmark can evaluate how reliably a Pokémon performs against its reference population.

Store the applicable requirements and evidence.

Potential supporting measurements include:

* Opponent coverage.
* Matchup win rates.
* Overall average win rate.
* Survival margin.
* Turns required.
* Resources consumed.

Do not collapse these different measurements into one number without explaining the calculation.

Allow configurable performance thresholds, with sensible defaults derived from testing.

#### Benchmark Hunting Is Intentional

The user explicitly wants to pursue badges and qualifications as build objectives.

It is acceptable and desirable for someone to adjust a Pokémon specifically to earn Ace or another title.

This can involve sacrificing some capabilities to improve others.

Do not introduce arbitrary safeguards designed to discourage pursuing benchmark qualifications.

The essential requirement is transparency about what is earned and what is sacrificed.

## PART VII — ARCHETYPE NAMING ENGINE

### 12. Standard Functional Archetypes Must Be the Default

This is one of the highest-priority requirements.

Most Pokémon builds should receive descriptive, NBA 2K-style functional archetype names.

Examples:

* Physical Setup Sweeper
* Special Wallbreaker
* Bulky Offensive Pivot
* 2-Way Priority Pivot
* Defensive Utility Specialist
* Fast Special Attacker
* Mixed Offensive Threat
* Priority Enforcer

These names should communicate meaningful strategic information.

The system should have substantial vocabulary, but avoid unwieldy combinations of every badge and tag.

Every valid completed build should receive a sensible functional archetype.

### 13. Signature Archetypes Should Be Less Common

A smaller collection of builds may earn more distinctive names.

Examples of the intended style:

* Steel Executioner
* Dragon Vanguard
* Phantom Striker
* Unbreakable Sentinel

These are creative examples, not finalized names or automatic species-specific classifications.

Signature archetypes should be awarded only through defined, mechanically meaningful criteria.

Potential requirements include unusual combinations of:

* Stat thresholds.
* Offensive and defensive capabilities.
* Move interactions.
* Abilities.
* Items.
* Speed or priority specialties.
* Meaningful benchmark qualifications.
* Unusually versatile capabilities.

Do not assign signature names randomly.

Do not award them merely because a Pokémon is shiny, legendary, rare, or has high base stats.

Do not force an arbitrary percentage of Pokémon to receive signature classifications.

Distinctiveness and overall strength must remain separate.

A common functional archetype may be more competitively effective than an unusual signature build.

#### Preserve the Underlying Functional Classification

When a signature archetype is earned, the system should still retain the underlying functional archetype for analysis and filtering.

Example:

Signature name: Steel Executioner

Underlying role: Physical Setup Sweeper with priority specialization.

This preserves useful classification data while allowing memorable naming.

#### Archetype Determination

The naming engine should evaluate:

1. Primary function.
2. Secondary specialty.
3. Defining mechanical strategy.
4. Meaningful hybrid capabilities.
5. Applicable signature-archetype requirements.

Use deterministic, documented qualification rules with clear precedence and sensible fallbacks.

Avoid generating arbitrary new names every time a configuration is evaluated.

Build the initial vocabulary as a curated, editable library.

New archetypes can be deliberately added and calibrated over time.

## PART VIII — REVERSE BUILDING & ARCHETYPE DISCOVERY

### 14. Let Users Build Toward a Desired Identity

Blackthorn should support both:

Forward classification: Construct a Pokémon and discover the archetype and badges it earns.

Reverse classification: Select a desired archetype, badge, or qualification and explore how to construct a Pokémon that satisfies its requirements.

This is essential to recreating the NBA 2K experience.

#### Nearby Archetypes

While editing a Pokémon, show meaningful nearby classifications.

For each candidate, explain:

* What requirements are currently met.
* Which requirements remain unmet.
* What changes would be necessary.
* Whether the target is legally achievable.
* What tradeoffs the change would create.

For numerical requirements, calculate minimum necessary investments where possible.

For damage qualifications, identify relevant KO or survival breakpoints.

For 1v1 qualifications, evaluate promising candidate changes using the existing simulator.

Do not promise a badge can be earned solely through a numerical change when matchup evidence is still required.

#### Build Comparison

Support side-by-side comparisons of different versions of the same species or individual Pokémon.

The user should be able to see how changing Nature, EVs, moves, items, or other attributes influences:

* Stats.
* Damage and survival.
* Speed thresholds.
* Tags.
* Badge levels.
* 1v1 qualifications.
* Functional archetype.
* Signature eligibility.
* Relevant team contribution evidence when available.

Preserve meaningful alternatives instead of automatically declaring one universally best.

## PART IX — 6V6 INTEGRATION

### 15. Design for Team-Based Recognition Without Depending on It Initially

A full 6v6 simulator is a planned Blackthorn capability, potentially using the Pokémon Showdown battle engine and Blackthorn trainer tendency profiles.

Eventually, it may provide evidence for:

* Offensive team contribution.
* Defensive team contribution.
* Repositioning and momentum.
* Support effectiveness.
* Role synergy.
* Matchup improvement.
* Specialized team qualifications.

However, team contribution is difficult to measure and depends on battle AI quality, switching, trainer decisions, and opponent context.

The initial archetype and badge engine should not depend on finished 6v6 simulation functionality.

Build appropriate interfaces and data structures for future integration.

When 6v6 becomes reliable, use controlled comparisons and actual battle observations to support broader team-role recognition.

Do not infer that a Pokémon is a strong team pivot merely because it wins many isolated 1v1 matchups.

## PART X — CANONICAL MECHANICS & BADGE EFFECTS

### 16. Recognition Should Not Automatically Modify Pokémon Battle Rules

Unlike some NBA 2K or FIFA badges, Blackthorn battle badges should not automatically create new combat bonuses.

A Priority Finisher qualification should not secretly increase Bullet Punch damage.

A Physical Wall badge should not manufacture extra Defense.

The Pokémon's performance comes from the actual mechanics.

The recognition system describes those capabilities and accomplishments.

If any optional custom-world effects are introduced in the future, they must be clearly separated from canonical battle calculations.

Badges may inform recommendations, available strategic templates, playbook preferences, or other Blackthorn tools without modifying actual game rules.

Do not make an AI artificially incapable of recognizing a sound tactical action simply because the Pokémon lacks a badge.

## PART XI — BUILD HISTORY, COMMITMENT & IDENTITY

### 17. Qualifications Belong to Specific Build Versions

Every qualification result should be associated with the exact build configuration and benchmark version used.

If the Pokémon's moves, EVs, Nature, item, or another relevant parameter changes, affected qualifications should be recalculated.

Do not silently transfer qualifications between materially different builds.

However, preserve historical achievements.

Distinguish:

* Current active-build qualifications.
* Previously earned qualifications.
* Pending or outdated benchmark results.
* Unverified qualifications.

A previous Scizor build may have qualified as Ace even if the currently active build does not.

Both facts should remain available.

#### Preserve Decision History

A committed build may record:

* Which archetype it earned.
* Which badges it qualified for.
* What alternatives were evaluated.
* Why the user selected it.
* Which tradeoffs were accepted.
* Which benchmarks it cleared.
* Applicable lineage or development notes.

This recognizes the importance of deliberate building decisions.

The user can realize a planned Pokémon through the existing PKHeX export pathway, but the legitimate breeding and training effort behind the same build should still be treated seriously.

Do not make legitimate development time a compulsory optimization constraint.

## PART XII — USER EXPERIENCE & VISUAL DESIGN

### 18. Integrate Recognition Across Existing Contextual Workspaces

Do not create a compulsory central screen containing every badge, stat, matchup, and qualification.

Blackthorn is designed around contextual workspaces.

The same Pokémon build should be accessible and editable where the user is working.

#### Individual Pokémon Profile

Prioritize beautiful Pokémon artwork and identity.

Prominently display:

* Nickname and species.
* Functional or signature archetype.
* Selected meaningful badges.
* Major earned qualifications.

Provide deeper labs for full badge and benchmark analysis.

Do not crowd the primary profile with dozens of small tags.

#### Individual Pokémon Builder

Show:

* Live stat classifications.
* Relevant thresholds.
* Current archetype.
* Nearby attainable archetypes.
* Badge eligibility.
* Qualification objectives.
* Meaningful opportunity costs.

#### Battle Laboratory

Prioritize damage calculations, matchup benchmarks, 1v1 qualifications, and eventually 6v6 evidence.

#### Team Builder

Use capabilities and qualifications to inform team fit and role analysis without assuming that a badge automatically proves 6v6 effectiveness.

#### Qualification Standards

Provide an advanced configuration area for editing benchmark collections, thresholds, tiers, and applicable rules.

Changes should be deliberate, transparent, and versioned.

### 19. Result Presentation

Use progressive disclosure.

Primary views should emphasize meaningful identities and conclusions.

Detailed mathematical evidence should be one interaction away.

Where the user is exploring possible builds, organize results into:

* Recommended.
* Potential Fits.
* Everything Else.

Do not remove valid builds merely because a recommendation algorithm ranks them poorly.

Support search, filtering, comparisons, and exploration of unusual builds.

## PART XIII — ARCHITECTURE & DATA

### 20. Shared Recognition Engine

Design this as a reusable Blackthorn service, not independent badge logic scattered across screens.

Suggested conceptual components:

Tag Definitions: Structured rules and characteristics.

Badge Definitions: Tiered measurable requirements.

Archetype Definitions: Functional and signature classification rules.

Benchmark Collections: Standardized opponent configurations.

Qualification Definitions: Test conditions and achievement thresholds.

Evaluation Results: Evidence associated with a build and benchmark version.

Build History: Current and previous configurations and qualifications.

These should connect to shared Pokémon records, Trainer Database records, and generation-specific mechanical data.

Use stable identifiers and versioned records.

Separate reference definitions from user-specific builds and achievements.

#### Technical Constraints

The current Blackthorn foundation uses Google Apps Script, Google Sheets, and Google Drive.

Preserve the accessible, web-based, shareable, mobile-friendly experience unless a technically justified improvement is necessary.

The user strongly prefers free software and does not want additional ongoing costs.

Avoid requiring local software installations on the restricted work laptop.

Heavy computation can eventually run through separate services or the home gaming laptop where appropriate, but everyday building and qualification inspection should remain accessible through the main Blackthorn interface.

Optimize for reuse, maintainability, caching, and avoiding unnecessary repeated simulations.

## PART XIV — IMPLEMENTATION APPROACH

### 21. Audit Before Rebuilding

Before making implementation changes:

1. Inspect the existing Blackthorn code and data structure.
2. Identify any existing tags and badge definitions.
3. Inspect the existing Ace qualification implementation.
4. Identify existing stat and damage calculation functionality.
5. Identify existing build versioning, profile displays, and data dependencies.
6. Determine what can be reused and what requires extension.

Do not assume that a described existing system is absent merely because it has not been shown in the current prompt.

Preserve working functionality whenever possible.

### 22. Recommended Implementation Phases

Phase 1 — Unified Recognition Data Model

Establish the distinction between tags, badges, archetypes, and qualifications.

Create reusable definitions and build-version associations.

Phase 2 — Stat-Based Qualifications

Implement mathematically verified stat thresholds, competitive Speed milestones, and minimum-investment calculations.

Phase 3 — Damage-Based Qualifications

Connect the damage calculator to curated offensive and defensive benchmark collections.

Implement KO, survival, and priority qualifications.

Phase 4 — 1v1 Qualification Expansion

Preserve the existing Ace system and expand its framework to support additional specialized collections.

Phase 5 — Archetype Classification Engine

Implement the curated functional naming library, hybrid rules, signature names, precedence, and explainable qualification logic.

Phase 6 — Reverse Building & Discovery

Add nearby archetypes, threshold targeting, badge hunting, and build comparisons.

Phase 7 — Contextual UI Integration

Display meaningful classifications throughout existing Blackthorn profiles and workspaces.

Phase 8 — Future 6v6 Integration

Expand team-role recognition when validated simulation evidence becomes available.

These are logical implementation stages, not a demand for eight separate systems or a rigid release schedule.

## PART XV — QUALITY STANDARDS & ACCEPTANCE TESTS

The system should eventually satisfy scenarios such as:

Scenario A — Speed Optimization

A user modifies a Pokémon's Speed investment.

Blackthorn identifies the exact competitive benchmarks newly cleared or lost, the minimum EV investment required, and the resulting badge tier.

Scenario B — Offensive Specialization

A user compares two Scizor builds with different held items.

Blackthorn calculates the relevant damage differences, identifies knockout thresholds, and explains how the difference affects offensive qualifications.

Scenario C — Ace Pursuit

A user selects Ace as the desired qualification.

Blackthorn evaluates current results against the established Elite Four and Champion benchmark thresholds, identifies unmet requirements, and supports testing alternative configurations.

Scenario D — Hybrid Archetype

A Pokémon meets meaningful offensive, defensive, priority, and switching capability requirements.

Blackthorn classifies it under an appropriate functional hybrid archetype and explains why.

Scenario E — Signature Archetype

A particular unusual combination meets a curated signature-archetype definition.

Blackthorn awards the signature classification while preserving the underlying functional role and explaining its requirements.

Scenario F — Build Revision

The user changes a Pokémon's moveset.

Affected qualifications are marked as needing reevaluation, while previously earned results remain associated with the earlier build version.

Scenario G — Cross-Context Consistency

A build viewed in the Individual Pokémon Profile, Team Builder, and Battle Laboratory retains the same identity and underlying data.

Changes made in one workspace are correctly reflected elsewhere.

#### Mathematical and Data Integrity

Every qualification should be:

* Reproducible under its recorded assumptions.
* Explainable.
* Versioned.
* Generation-aware.
* Based on verified Pokémon mechanics or explicitly identified Blackthorn interpretations.
* Recalculated when relevant dependencies change.
* Never fabricated when the underlying evidence is unavailable.

The system should distinguish statistical benchmarks from empirically meaningful battle-performance thresholds.

Avoid treating proposed thresholds in this specification as fully calibrated standards.

## FINAL PRODUCT VISION

The ultimate objective is a Pokémon recognition system that captures the same satisfaction as NBA 2K's MyPLAYER build culture.

A user should be able to create a Pokémon, carefully optimize its configuration, discover its specialties, pursue prestigious qualifications, and eventually earn a recognizable build identity.

Most builds should receive clear, descriptive, competitive-style archetypes.

Some unusual builds should earn distinctive signature archetypes through meaningful combinations of capabilities.

Badges should recognize specific degrees of specialization.

Qualifications should represent measurable accomplishments.

The user should understand exactly why each classification was awarded and what compromises would be necessary to earn a different one.

No title should artificially change canonical Pokémon mechanics.

The system must preserve the user's control over what they consider the right build.

Above all:

A Pokémon's identity should emerge from the decisions made in constructing it, the capabilities those decisions create, and the accomplishments those capabilities allow it to achieve.

That is the Blackthorn interpretation of NBA 2K's building culture.

## INSTRUCTIONS FOR INTEGRATION WITH OTHER BLACKTHORN SPECIFICATIONS

This prompt is one component of a larger Blackthorn OS master plan.

Integrate it with the other specifications rather than implementing it as an isolated application.

Respect shared architecture, existing working systems, and decisions already established elsewhere in the project.

Where another specification provides more detailed requirements for breeding, biology, battle simulation, individual profiles, trainer systems, or team construction, use that specialized specification as the authority for its own domain.

Identify dependencies, reconcile conflicting assumptions, and preserve the shared-data philosophy.

Before implementation, provide an architecture and gap analysis showing what already exists, what should be retained, what needs expansion, and the proposed implementation sequence.

Do not begin another uncontrolled wholesale rebuild without first establishing the unified architecture.
