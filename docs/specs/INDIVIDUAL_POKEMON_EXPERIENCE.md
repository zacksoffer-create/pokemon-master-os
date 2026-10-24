# BLACKTHORN OS — INDIVIDUAL POKÉMON EXPERIENCE & VISUAL IDENTITY

(Zack, received 2026-10-24. Verbatim; the original's plain-text numbering and headings are kept as written.)

Consolidated Master Planning Handoff for Claude
Status: Approved product direction and planning input. This document will be combined with other Blackthorn OS workstream specifications before final architecture and implementation.
Scope: Individual Pokémon building, identity, profiles, artwork, image generation, personal history, and connections with the wider Blackthorn ecosystem.
1. THE CORE VISION
Blackthorn OS should feel like the personal operating system someone would want if they were genuinely living in the Pokémon world.
Imagine being a trainer, breeder, researcher, and strategist with access to an incredibly sophisticated personal dashboard.
What tools would you want? What information would be useful? How would you create and manage Pokémon, study their capabilities, develop teams, plan expeditions, and make important decisions?
That is the fundamental product concept.
Blackthorn is not primarily a traditional RPG, a scripted Pokémon adventure, or a game with artificial progression systems.
Its priorities are:
Priority 1 — The Workshop
Create an extraordinary Pokémon builder and interconnected collection of functional tools.
This is the central attraction.
The user should be able to create extremely precise Pokémon builds, experiment with possibilities, investigate relationships, calculate consequences, compare alternatives, and confidently settle on a final design.
Priority 2 — The Showcase
Present everything the user creates beautifully.
Pokémon are not simply data entries. They are thoughtfully designed individuals that should be visually impressive, enjoyable to revisit, and easy to share.
The system should make users proud of their creations.
Priority 3 — The Chronicle
Optionally capture accomplishments, meaningful decisions, personal history, and storytelling.
These features should emerge naturally from activities already taking place within Blackthorn.
They must never interfere with the builder or introduce mandatory grinding, role-playing, storytelling, or recordkeeping.
The Workshop must remain exceptional even if the user never touches the Chronicle.
2. NBA 2K MyPLAYER AS THE PRIMARY DESIGN INSPIRATION
The NBA 2K MyPLAYER Builder is a major inspiration for the individual Pokémon experience.
The important elements are not simply aesthetics.
They include:

* Building an individual around a precise vision.
* Making meaningful decisions within finite constraints.
* Understanding the downstream consequences of attribute allocation.
* Identifying statistical thresholds and unlocking specialized classifications.
* Discovering archetypes and rare build names.
* Balancing competing strengths and weaknesses.
* Experimenting with variations.
* Comparing similar builds.
* Developing a strong attachment to a particular creation.
* Showcasing a completed build with a recognizable identity.

Pokémon already contains an extensive mathematical system of base stats, IVs, EVs, Natures, moves, abilities, items, types, breeding rules, and generation-specific mechanics.
Blackthorn should expose the depth of that system rather than replace it with an artificial attribute economy.
A user should be able to work forward from a Pokémon they love or backward from a desired capability.
For example:

* Build the strongest possible version of a particular Pokémon under chosen criteria.
* Develop a Pokémon around an inherited move.
* Build toward a particular Speed threshold.
* Find the best EV allocation for specific matchup requirements.
* Construct a Pokémon to fill a precise role on an existing team.
* Adjust teammates to make a preferred Pokémon more effective.
* Deliberately pursue a rare archetype or qualification, even if doing so requires a tradeoff.

Blackthorn calculates, explains, and recommends.
The user decides what constitutes the ideal final build.
There is no requirement to produce one universal definition of the best Pokémon.
3. THE INDIVIDUAL POKÉMON AS A PERSISTENT OBJECT
Every Pokémon should have a unique, persistent identity within Blackthorn.
That identity should link to:

* Species and reference Pokédex information.
* Nickname and personal details.
* Sex, coloration, shininess, and applicable forms.
* Game and generation.
* IVs, EVs, Nature, Ability, moves, and held item.
* Active build and alternative configurations.
* Build archetype and capability tags.
* Earned qualifications and benchmarks.
* Biological and ecological information.
* Breeding lineage and inheritance.
* Team membership and responsibilities.
* Battle performance.
* Survival and field capabilities.
* Personal artwork and image gallery.
* Build history and important decisions.
* Accomplishments and optional narrative history.

These should be connected dimensions of one individual, not separate records requiring duplicate manual entry.
The same build should be accessible from multiple Blackthorn modules.
Editing the build in the Battle Laboratory, Team Construction, or individual Pokémon Studio should update the same underlying record, subject to draft and version controls.
4. CLOSED-LOOP DATA ENRICHMENT — FUNDAMENTAL REQUIREMENT
One of the most important philosophies of Blackthorn OS is:
Enter information once. Enrich it automatically. Reuse it everywhere.
For example, after creating a Scizor with its complete build information, Blackthorn should be capable of populating relevant information throughout the ecosystem.
This can include:

* Exact battle stats.
* Speed benchmarks.
* Damage and survival thresholds.
* Legal move and ability checks.
* Archetype classification.
* Capability tags.
* Qualification eligibility.
* Battle simulation inputs.
* Team role analysis.
* Defensive and offensive coverage.
* Breeding and inheritance information.
* Survival and environmental capabilities.
* Personal profile and artwork references.
* Build comparisons.
* Decision history.
* Optional storytelling context.

When one value changes, affected derived information should update appropriately.
Unrelated information should remain untouched.
Expensive calculations and simulations may update on demand or use intelligent caching rather than automatically rerunning everything.
The system must distinguish:

1. Reference facts: Stable, sourced species and generation information.
2. Exact calculations: Mechanically determined statistics and outcomes under specified conditions.
3. Evaluated results: Benchmark results, simulation outcomes, and performance estimates.
4. Interpretations: Biological inferences, creative applications, and user-approved narrative content.

Do not present speculative information as established fact.
This closed-loop model should extend throughout Blackthorn, not only individual profiles.
5. CONTEXTUAL BUILDING
Do not force the user to perform every edit through one giant centralized builder screen.
The individual Pokémon remains the same underlying object, but the building experience should respond to its context.
Individual Pokémon Studio
A place to construct the exact envisioned Pokémon from the ground up.
Battle Laboratory
Build and refine Pokémon while evaluating stats, damage, defense, Speed, matchups, and qualifications.
Team Construction
Build and refine individual Pokémon while examining their fit among teammates.
Survival Laboratory
Examine field capabilities, travel, environmental suitability, recovery, and operational roles.
A user might build Typhlosion entirely from the individual profile because they already know what they want.
The same user might refine Scizor by moving repeatedly between Team, Battle, and Survival.
Both experiences should feel natural.
Preserve active selections, relevant context, versions, comparisons, and unsaved work while navigating.
6. THE APPROVED HYBRID INDIVIDUAL PROFILE
We explored several profile directions:

* The focused 2K-style builder.
* The beautiful showcase.
* The analytical dashboard.
* The career and history presentation.

The approved visual direction is a hybrid combining the strongest elements of all four.
The original hybrid concept was particularly successful because of its strong information hierarchy, prominent Pokémon artwork, clean presentation, useful overview information, and access to deeper tools.
Preserve that general direction.
Do not replace it with an overcrowded analytical dashboard or an artwork-only collector card.
Recommended hierarchy
A. Hero and Identity
The top of the profile should prominently feature:

* Large, beautiful Pokémon artwork.
* Nickname and species.
* Relevant sex, shiny, and form information.
* Active build archetype.
* Key Ability, Nature, and item information.
* Appropriate qualifications and identity indicators.
* Simple actions such as Edit Build, Compare, Share, and Artwork.

This should immediately communicate that the Pokémon is a distinct individual.
B. At-a-Glance Overview
Present the most meaningful information without requiring extensive scrolling or analysis.
Possible elements:

* Core stats.
* Primary and secondary specialties.
* Build archetype.
* Relevant capability tags.
* Benchmark or qualification status.
* Current team and role.
* Important strengths and limitations.

Use clear hierarchy rather than treating every metric as equally important.
C. Contextual Tools and Deeper Information
Provide access to:

* Build configuration.
* Battle analysis.
* Team roles and contribution.
* Biology and ecology.
* Breeding and lineage.
* Survival capabilities.
* Build history.
* Personal gallery.
* Accomplishments and optional Chronicle.

Deep analysis should be readily available without overwhelming the profile overview.
D. Personal Gallery
Support multiple illustrations of the same individual.
E. History and Accomplishments
Provide a location for significant build revisions, qualifications, meaningful events, and optional storytelling.
The profile must remain useful without any historical activity.
7. ARTWORK VARIANTS — HIGH-PRIORITY REQUIREMENT
The profile should automatically select appropriate artwork based on the Pokémon's actual attributes.
Where applicable, support:

* Male, standard coloration.
* Female, standard coloration.
* Male, shiny coloration.
* Female, shiny coloration.
* Relevant alternate forms.

Recognize that not all species have visible sex differences, and some species are genderless.
Do not invent visual differences where none exist.
The source artwork library should preserve verified official or otherwise authorized reference assets separately from generated artwork.
The user should not need to manually specify sex, shiny status, or form again when that information already exists in the Pokémon record.
The correct default artwork should appear automatically.
8. CUSTOM ARTWORK & PERSONAL GALLERIES
The user should be able to override the default profile artwork with a chosen custom image.
Support:

* Uploading an existing image.
* Selecting reference artwork.
* Choosing from previously saved custom artwork.
* Setting a preferred hero portrait.
* Maintaining multiple images of the same individual.
* Returning to default artwork at any time.

Potential gallery categories include:
Hero Portrait: Primary profile artwork.
Battle Portrait: A pose or scene reflecting moves, archetype, or fighting style.
Environmental Portrait: The Pokémon in a natural habitat or relevant setting.
Homestead Portrait: The Pokémon participating in activities or responsibilities at Blackthorn.
Career Artwork: Important battles, accomplishments, or approved narrative events.
These are organizational possibilities, not mandatory image requirements.
One great artwork asset should be enough to create a complete, beautiful profile.
The gallery should enhance the experience without becoming an additional workload.
9. IMAGE-GENERATION PACKETS — MAJOR NEW SHARED CAPABILITY
Introduce an optional image-generation packet system available throughout Blackthorn.
This system should leverage existing structured information to automatically assemble a detailed creative brief for an image.
The user should not need to repeatedly describe information that Blackthorn already knows.
For example, generating a Scizor illustration could automatically draw from:

* Species and anatomy.
* Sex.
* Shininess.
* Form.
* Personal nickname.
* Build archetype.
* Moves and fighting style.
* Relevant biology.
* Trainer or team affiliation.
* Personal environment.
* Blackthorn compound details.
* Any previously established visual references.
* Desired presentation format.

The user can then select a few creative preferences, such as:

* Portrait, battle scene, or environmental scene.
* Art style.
* Mood.
* Setting.
* Camera framing.
* Orientation or aspect ratio.

Blackthorn assembles the complete packet.
Image-generation packet contents
Where supported, a packet could include:

1. Primary subject and identifying details.
2. Visual anatomy and coloration constraints.
3. Relevant personal and mechanical identity.
4. Location and environmental context.
5. Pose and activity.
6. Art style and lighting.
7. Composition and aspect ratio.
8. Reference images.
9. Important exclusions and accuracy requirements.
10. Intended use within Blackthorn.

The resulting packet should be easily copyable or transferable to an image-generation tool.
If direct image generation is technically available and appropriately integrated, Blackthorn may offer that workflow as well.
However, direct integrated generation should not be a dependency of the profile system.
A working packet-export and image-upload workflow is a viable foundation.
Do not assume a particular image-generation API or service is free or permanently available.
10. MAKE IMAGE GENERATION EXTREMELY EASY
This is a specific user-experience priority.
Image creation should not require the user to complete a long form, manually collect reference details, or compose a sophisticated prompt.
A preferred workflow:
Step 1 — Select Create Artwork
Accessible near the profile's main image or through its gallery.
Step 2 — Choose an image purpose
Examples:

* Profile Portrait.
* Battle Scene.
* Natural Habitat.
* Homestead Scene.
* Custom Scene.

Step 3 — Automatically populate the packet
Use existing information from Blackthorn.
Step 4 — Offer simple optional customization
For example:

* Art style.
* Scene.
* Mood.
* Orientation.

Use useful defaults.
Step 5 — Generate or export
Depending on the integration, generate the image directly or provide a complete creative packet ready for an external image tool.
Step 6 — Save the result
Upload or select the resulting artwork, link it to the Pokémon, and optionally set it as the active profile image.
Step 7 — Reuse everywhere
The saved asset becomes available for other Blackthorn displays, galleries, team profiles, and approved storytelling.
The ideal experience should require only a few intentional choices, not extensive manual setup.
Remember creative preferences where appropriate so repeated artwork generation becomes easier over time.
Never overwrite canonical artwork or existing user artwork without explicit approval.
11. EXTEND VISUAL GENERATION THROUGHOUT BLACKTHORN
The packet system should eventually be reusable in other modules.
Individual Pokémon
Portraits, battle poses, habitat scenes, personal galleries.
Teams
Group portraits, training environments, team commemorations.
Survival
Expeditions, field camps, wilderness scenes, environmental challenges.
Homestead
Buildings, facility interiors, compound landscapes, Pokémon working in specialized roles.
Breeding
Nurseries, lineage imagery, parent-and-offspring compositions.
Trainer Profiles
Trainer portraits, team visualizations, tactical settings.
Chronicle
Illustrations of recorded or approved fictional events.
The system should reuse persistent environmental descriptions and visual references.
For example, if the Blackthorn compound's greenhouse has already been designed, artwork generated inside that greenhouse should reference its established appearance.
This creates a coherent visual world rather than disconnected illustrations.
Generated imagery should be labeled as creative artwork, not confused with canonical evidence.
12. MECHANICAL DEVELOPMENT VS. PERSONAL HISTORY
Separate:
Mechanical Development
What the Pokémon is capable of under the relevant game rules.
Career and Personal History
What the individual has actually accomplished, experienced, or contributed.
A Pokémon can be perfectly constructed mechanically and have no established career history.
Two mechanically identical Pokémon can have different identities and histories.
Do not invent mandatory level-grinding or artificial progression purely to make Blackthorn feel like a career game.
The actual building and optimization work is already a meaningful activity.
13. BUILD HISTORY & DECISION RECORDS
This is a valuable extension to the Workshop.
Preserve meaningful build revisions and experimentation.
Potential information includes:

* Initial design objective.
* Locked choices.
* Candidate configurations.
* Changes to EVs, moves, items, Nature, or other variables.
* Comparison outcomes.
* Relevant benchmark results.
* Reasons behind the final selection.

Technical changes can be tracked automatically.
Allow optional user notes when an important decision is made.
Do not require extensive journaling.
The user should be able to revisit earlier build versions, compare them, and understand what was gained or sacrificed.
Build history should also be available for optional showcase presentation.
14. ARCHETYPES, TAGS, BADGES & QUALIFICATIONS
Preserve distinct identity categories.
Build Archetypes
Describe how a specific Pokémon is constructed.
Capability Tags
Describe measurable properties such as Speed tiers, offensive thresholds, defensive qualities, or utility specialties.
Earned Qualifications
Recognize performance against established, adjustable benchmark collections.
The existing Ace qualification is an important example.
Personal Identity
Represents nickname, lineage, background, and individual significance.
A Pokémon may share its archetype with others while retaining a distinct personal identity.
Rare names and qualifications can be meaningful design objectives.
The user may deliberately make tradeoffs to achieve them, just as NBA 2K players sometimes modify attributes to earn preferred archetypes.
Keep descriptive labels separate from any custom mechanical effects.
Do not introduce invented battle bonuses without an explicitly defined optional ruleset.
15. OPTIONAL ACCOMPLISHMENTS, HALL OF FAME & LEGACY
Support future enrichment through:
Career Records
Notable victories, team service, responsibilities, and established milestones.
Hall of Fame
A beautiful collection of personally important or qualifying Pokémon, teams, and trainers.
Allow manual recognition of personally meaningful individuals.
Leaderboards
Comparisons across specific, transparent measures such as performance, specialization, achievements, or other relevant categories.
Legacy Scores
Optional composite measures of an individual's accumulated significance.
Do not confuse legacy with raw mechanical strength.
All composite scoring should be transparent, versioned, and configurable.
These systems should complement the builder, never dominate it.
16. THE OPTIONAL STORYTELLING LOOP
Storytelling should emerge from actions already recorded within Blackthorn.
Proposed loop:

1. The user records or imports information about a game event, battle, team change, expedition, or other activity.
2. Blackthorn links the information to relevant Pokémon, teams, trainers, and other records.
3. Associated profiles and accomplishments update.
4. Blackthorn may suggest an optional narrative interpretation.
5. The user approves, edits, or rejects the suggestion.
6. Approved story material becomes available in the individual's Chronicle.

Maintain three clearly separated kinds of events:
Recorded History: Confirmed or user-established events.
Simulation History: Hypothetical outcomes from battle simulations or scenarios.
Creative Chronicle: User-approved fictional or interpretive stories.
Never invent actual accomplishments or silently convert simulated victories into recorded game history.
Storytelling should remain optional and lightweight.
17. PROFILE PRESENTATION & SHARING
The individual profile should work exceptionally well as both a private workspace and a public-facing showcase.
Private Working View
May include:

* Detailed mechanics.
* Build editing.
* Draft comparisons.
* Notes.
* Full analytical tools.
* Development and lineage information.

Showcase View
May emphasize:

* Beautiful artwork.
* Individual identity.
* Build archetype.
* Signature capabilities.
* Selected statistics.
* Qualifications and accomplishments.
* Personal highlights.

The two modes should draw from the same structured data.
Sharing should not expose private notes, unfinished work, or other information without user choice.
Preserve mobile-friendly, browser-based access and simple link sharing where technically feasible.
18. TECHNICAL & PRACTICAL CONSTRAINTS
The current Google Sheets, Google Drive, and Google Apps Script structure should remain the default foundation unless a demonstrably better solution is justified.
Design around:

* Access through an ordinary web browser.
* Strong mobile usability.
* Sharing through links.
* Restricted work computers that cannot install software.
* No additional recurring software expenses.
* Reputable free tools.
* Optional use of a home gaming laptop for demanding processes.
* Reusing working systems rather than unnecessarily rebuilding them.
* Generation I–IV as the initial reference scope.

Google Drive is a reasonable initial candidate for storing user artwork, with appropriate attention to permissions, storage limits, image sizes, and retrieval performance.
An image-generation integration should not introduce an unapproved paid dependency.
Do not assume generated images will always perfectly preserve visual details. Build in review, replacement, and iteration.
19. DESIGN PRINCIPLES TO PRESERVE
The completed experience should be:
Beautiful: Pokémon feel visually extraordinary.
Functional: Every major element supports a useful activity.
Precise: Mechanical data is accurate and explainable.
Connected: Information flows naturally across modules.
Personal: Individual Pokémon reflect the user's decisions.
Flexible: Multiple approaches to building and optimizing are supported.
Effortless: Shared information automatically populates where relevant.
Nonintrusive: Optional creative or narrative features do not impede functional work.
Shareable: Creations can be presented elegantly to other people.
Expandable: The architecture supports future modules without needless duplication.
One specific visual design principle:
Every beautiful element should represent something meaningful, and every important piece of information should lead somewhere useful.
20. PRIORITIES FOR IMPLEMENTATION PLANNING
Essential

* Exceptional individual Pokémon builder.
* Shared individual and build records.
* Closed-loop derived information.
* Contextual editing.
* Beautiful hybrid individual profile.
* Automatic sex/shiny/form artwork selection where applicable.
* Custom artwork uploading and selection.
* Functional and responsive navigation.

High Priority

* Detailed battle and team analysis.
* Build archetypes and tags.
* Qualification presentation.
* Build comparison and version history.
* Personal artwork galleries.
* Simple image-generation packets.
* Reuse of artwork and profile data throughout Blackthorn.

Supporting / Optional

* Career milestones.
* Hall of Fame.
* Leaderboards.
* Legacy scoring.
* Narrative Chronicle.
* Expanded relationship history.
* Advanced image-generation integrations.
* Sophisticated visual continuity across environments.

These are product priorities, not instructions to construct separate disconnected systems.
Shared data and dependencies should be planned coherently.
21. FINAL INSTRUCTIONS FOR CLAUDE
This is one component of a larger Blackthorn OS planning package.
It must be reconciled with the separate discussions covering:

* Team Construction.
* Trainer Ecosystem.
* Battle Simulation.
* Badges and Qualifications.
* Pokémon Biology.
* Breeding and Lineage.
* Survival.
* Homestead.
* Equipment.
* Reference Database.
* Technical Architecture.

Avoid duplicating concepts or inventing separate storage structures for information that should be shared.
Preserve established decisions while identifying genuine unresolved questions.
Do not treat every brainstormed idea as an approved mandatory feature.
Do not start rebuilding merely because this prompt has been supplied.
First combine the planning workstreams into an integrated specification, examine the existing implementation, determine which functionality should be retained, and establish a sensible development sequence.
Above all:
Blackthorn should be an extraordinary Pokémon operating system: a place to build precisely, understand deeply, display beautifully, and preserve what makes every creation special.
The artwork system should be one of the clearest demonstrations of this philosophy.
The user creates the Pokémon once; Blackthorn uses that information to help them understand it, evaluate it, visualize it, and bring it to life.
