# BLACKTHORN OS — SURVIVAL, HOMESTEAD & WORLD CAPABILITY SYSTEMS

(Zack, received 2026-10-24. Verbatim; the original's plain-text numbering and headings are kept as written.)

Master Implementation Specification for Claude
PROJECT CONTEXT
You are developing Blackthorn OS, a comprehensive Pokémon trainer toolkit, research environment, and interconnected personal management system.
This specification concerns the Survival, Homestead, Environmental Capability, and Pokémon World Operations systems.
It will be combined with other Blackthorn OS specifications covering individual Pokémon builds, team construction, competitive battle simulation, breeding, biology, ecology, equipment, trainers, qualifications, and the overall technical architecture.
Do not treat this as a standalone application. Design these systems as integrated components of the larger Blackthorn OS ecosystem.
The primary reference universe is Pokémon Generations I–IV, with particular emphasis on Pokémon HeartGold and SoulSilver. Support future expansion without unnecessarily complicating the initial implementation.
The project's philosophy is to understand what is possible within the established Pokémon world, explore those possibilities, and optimize individual Pokémon and teams according to the user's chosen objectives.
1. CORE DESIGN PHILOSOPHY
The central question behind these modules is:
What does it actually mean to live, travel, survive, and operate a functioning homestead alongside Pokémon?
Pokémon are not simply collections of battle statistics. They are biological organisms possessing anatomy, physiology, behavioral tendencies, ecological requirements, learned capabilities, and extraordinary natural abilities.
Those characteristics should influence their usefulness beyond competitive battles.
The Survival and Homestead modules must allow users to explore those possibilities in a structured, evidence-based, practical, and visually engaging environment.
Fundamental principles

1. Pokémon biology should inform capabilities.
2. Capabilities should translate into practical applications.
3. Individual builds, inherited moves, training, and equipment can influence specialization.
4. Teams should be evaluated collectively rather than as six isolated individuals.
5. Environmental circumstances should affect suitability and effectiveness.
6. Homestead facilities should have realistic functional requirements.
7. Battle performance and environmental performance must remain distinct but interconnected.
8. Canonical game mechanics must never be silently overridden by speculative world-building.
9. The user—not an arbitrary overall rating—determines the preferred solution.
10. All modules must share Pokémon records, build configurations, and reference information.

Model a capability once and reuse it throughout the entire application.
A Pokémon capable of generating heat might assist with expedition warmth, greenhouse temperature regulation, and industrial processes. These should reference a shared underlying capability, not three unrelated invented statistics.
2. TWO CONNECTED EXPERIENCES
Implement two primary contextual workspaces.
A. Survival — Away From Home
Survival evaluates how effectively individual Pokémon and teams can operate outside the compound.
It should consider environmental conditions, terrain, transportation, resources, safety, shelter, biological requirements, and Pokémon capabilities.
The user should be able to plan an expedition, evaluate a particular team, understand its limitations, and experiment with different builds, equipment, and personnel.
The primary experience is planning, preparedness, and optimization.
An optional simulation layer may eventually model expeditions unfolding over time, but this should not become a mandatory real-time survival game.
B. Homestead — At Blackthorn
Homestead evaluates how the user's Pokémon, facilities, equipment, and resources work together to maintain a functional compound.
It should connect infrastructure, breeding operations, gardening, environmental regulation, research, food production, specialized labor, storage, equipment, and habitat management.
The primary experience is facility planning, capability management, staffing, and operational design.
The compound should feel like a real place inhabited and operated by Pokémon, not a generic menu of buildings that passively generate points.
Both workspaces must draw from the same biological and capability systems.
3. UNIVERSAL POKÉMON CAPABILITY FRAMEWORK
Create a reusable capability framework that can be consumed by Survival, Homestead, Team Construction, Pokémon profiles, Breeding, and other systems.
Every capability should have an identifiable source and evidence classification.
Layer A — Official game-mechanical capabilities
These include:

* HM-based field actions.
* Other moves with field applications.
* Relevant Ability effects.
* Game-specific traversal restrictions.
* Badge and progression requirements.
* Mechanics established by the applicable generation.

These must respect the actual game's rules.
Layer B — Natural biological capabilities
These describe what a Pokémon could reasonably accomplish based on its species characteristics.
Examples include:

* Flight and aerial movement.
* Swimming and aquatic endurance.
* Climbing.
* Digging.
* Physical strength.
* Carrying and transporting loads.
* Precision manipulation.
* Generating heat.
* Producing light.
* Generating electricity.
* Temperature tolerance.
* Sensory abilities.
* Hunting and tracking.
* Defensive protection.
* Environmental adaptation.

These capabilities must be supported by biological evidence wherever possible.
Layer C — Equipment-assisted and trained capabilities
These describe what a Pokémon can accomplish through tools, specialized training, infrastructure, or cooperation.
Examples include:

* Using equipment to transport supplies.
* Operating within a workshop.
* Assisting with construction.
* Carrying specialized expedition equipment.
* Supporting greenhouse operations.
* Performing a trained search or rescue function.

Anatomical suitability, intelligence, training, equipment compatibility, and safety should affect these applications.
Critical separation
Cartridge functionality and fictional-world capability are different.
A Scizor may plausibly cut vegetation with its pincers. That does not automatically mean a Scizor without Cut can remove every HM-required tree in HeartGold/SoulSilver.
Implement separate assessments for:

* Cartridge traversal readiness.
* Blackthorn-world expedition readiness.

Never substitute speculative capabilities for official game requirements without explicitly entering the appropriate world-simulation context.
4. CAPABILITY DATA MODEL
Develop an extensible data structure rather than inventing isolated capability scores throughout the application.
Recommended capability fields include:

* Capability ID.
* Capability category.
* Species ID.
* Individual or build modifiers, if applicable.
* Capability description.
* Canonical evidence.
* Evidence source.
* Evidence classification.
* Environmental conditions.
* Equipment requirements.
* Training requirements.
* Limitations.
* Potential risks.
* Applicable operational functions.
* Relevant Pokémon moves or Abilities.
* Confidence level.
* Generation or game restrictions, where relevant.

Distinguish between:

1. Directly established facts.
2. Mechanically demonstrated capabilities.
3. Strong biological inferences.
4. Plausible interpretations.
5. Creative Blackthorn-specific extensions.

Do not present creative interpretations as established canon.
Where reliable quantitative measurements exist, use them.
Where they do not, avoid fabricating precision. Use explainable capability categories, requirements, descriptive limitations, or clearly defined custom models.
5. POKÉMON BIOLOGY INTEGRATION
Survival and Homestead should consume information from the broader Blackthorn Biology and Ecology database.
They should not independently recreate species biology.
Relevant biological information includes:

* Physical anatomy.
* Size and mass.
* Locomotion.
* Habitats.
* Dietary requirements.
* Feeding methods.
* Foraging and hunting strategies.
* Environmental tolerances.
* Natural defenses.
* Sensory abilities.
* Social behavior.
* Reproduction.
* Ecological relationships.
* Typical behavior.
* Available moves and potential natural applications.

Synthesize information from relevant Generation I–IV Pokédex entries and approved canonical sources.
Support different games and source interpretations without conflating incompatible information.
Individual specialization
A species has baseline capabilities, but individual Pokémon may possess meaningful specializations through:

* Legal inherited moves.
* Other learned moves.
* Training.
* Experience.
* Physical configuration.
* Equipment.
* Individually defined characteristics.

Egg moves are particularly interesting as potential ecological specializations.
An inherited move could influence how an individual hunts, forages, protects itself, transports objects, or performs specialized tasks.
Multiple inherited moves could interact to create additional possibilities.
However, do not automatically claim that having an egg move establishes a biological subspecies or distinct regional form.
Treat ecological interpretations as hypotheses or creative applications unless directly established by canon.
6. HM FUNCTIONS AND FIELD UTILITY
Preserve the established Blackthorn team-building philosophy:
Teams should aim for comprehensive traversal coverage without unnecessarily sacrificing competitive move quality.
Surf and Fly are particularly important because they can simultaneously provide meaningful battle and travel utility.
Other field functions may be addressed through actual moves, temporary move configurations, trained natural capabilities, or equipment depending on the operational context.
Build a comprehensive Generation I–IV field-function reference covering relevant mechanics such as:

* Surf.
* Fly.
* Cut.
* Strength.
* Rock Smash.
* Waterfall.
* Whirlpool.
* Rock Climb.
* Defog.
* Flash.
* Other generation-specific field interactions.

Do not assume all of these operate identically across games.
Required features
Provide a field-readiness assessment identifying:

* Functions covered by the active party.
* Required actual moves.
* Applicable badge or progression requirements.
* Missing functions.
* Potential Pokémon capable of addressing gaps.
* Equipment-assisted alternatives in Blackthorn-world scenarios.
* Battle moveset opportunity costs.
* Temporary or permanent configuration tradeoffs.

The system should help determine how to cover field responsibilities without ruining carefully optimized battle builds.
7. SURVIVAL CAPABILITY CATEGORIES
Evaluate Pokémon and teams across six primary areas.
A. Mobility and Traversal
Evaluate:

* Ground transportation.
* Aerial movement.
* Aquatic movement.
* Climbing.
* Digging.
* Difficult terrain.
* Obstacle removal.
* Cargo transport.
* Carrying capacity.
* Travel endurance.
* Scouting and navigation.

B. Food and Water
Evaluate:

* Food requirements.
* Water requirements.
* Foraging.
* Hunting.
* Fishing.
* Resource identification.
* Food storage.
* Preparation.
* Preservation.
* Water acquisition and treatment.

C. Shelter and Environmental Protection
Evaluate:

* Shelter construction.
* Heat generation.
* Cold protection.
* Rain protection.
* Wind protection.
* Environmental regulation.
* Sleeping and resting conditions.
* Safety from environmental hazards.

D. Safety and Recovery
Evaluate:

* Hazard detection.
* Defense against dangerous wildlife.
* Emergency response.
* Search and rescue.
* Medical support.
* Recovery.
* Rest.
* Team protection.

Do not invent medical abilities without evidence.
E. Tools and Construction
Evaluate:

* Cutting.
* Digging.
* Lifting.
* Precision manipulation.
* Materials processing.
* Construction.
* Equipment repair.
* Tool compatibility.
* Collaborative physical work.

F. Ecological Awareness
Evaluate:

* Habitat knowledge.
* Tracking.
* Resource identification.
* Navigation.
* Environmental sensing.
* Wildlife observation.
* Threat avoidance.
* Locating suitable campsites.

A Pokémon may contribute to multiple categories, but suitability must remain context-dependent.
8. TEAM-BASED SURVIVAL ANALYSIS
Survival should evaluate the active team collectively.
A successful expedition depends on complementary capabilities, not six independently high-scoring Pokémon.
The system should identify:

* Capability coverage.
* Redundant capabilities.
* Missing capabilities.
* Critical dependencies.
* Specialized contributions.
* Environmental weaknesses.
* Required equipment.
* Resource demands.
* Opportunities for complementary teamwork.

Example
A Fire-type may supply heat, but that does not guarantee safe shelter construction or transportation.
A Flying-type may scout terrain but might be unable to carry the trainer safely through severe weather.
A Water-type may provide excellent aquatic mobility but require special provisions for an extended desert expedition.
Each contribution should be evaluated within the actual scenario.
Scenario-specific optimization
The user must be able to lock Pokémon species, individual builds, equipment, and other choices while requesting recommendations for the remaining variables.
Examples:

* Keep all six Pokémon and optimize equipment.
* Keep five Pokémon and identify the best sixth expedition member.
* Keep a particular Scizor and adapt the remaining team.
* Optimize a predefined team for winter conditions.
* Compare two builds of the same Pokémon across an identical expedition.

The engine should recommend solutions while preserving user authority over the final selection.
9. ENVIRONMENTAL SCENARIOS AND EXPEDITION PLANNING
Create a reusable scenario framework.
Initially, support illustrative expedition types such as:

* Winter mountain expedition.
* Dense forest traversal.
* Coastal or marine expedition.
* Cave exploration.
* Extended wilderness camp.
* Wetland or swamp expedition.
* Long-distance overland journey.
* Hazardous-environment research expedition.

Each scenario should define:

* Geographic or environmental conditions.
* Terrain.
* Climate.
* Expected duration.
* Travel requirements.
* Critical hazards.
* Food and water considerations.
* Shelter requirements.
* Required operational capabilities.
* Equipment considerations.
* Optional objectives.

Expedition assessment
Given a selected team, builds, equipment, and scenario, generate a readiness report.
The report should identify:

* Capabilities adequately covered.
* Areas of exceptional strength.
* Weaknesses and limitations.
* Missing equipment.
* Potential failure points.
* Recommended preparations.
* Alternative Pokémon or build configurations.
* Meaningful tradeoffs.

Avoid collapsing this into a single arbitrary Survival Overall score.
If summary ratings are provided, ensure their methodology is transparent.
Optional simulation
Design the architecture to support future simulations involving:

* Travel progress.
* Resource consumption.
* Changing weather.
* Fatigue.
* Environmental complications.
* Equipment usage.
* Pokémon assignments.
* Recovery and rest.
* Unexpected encounters.

The initial implementation should prioritize planning and analytical capability.
Do not create mandatory daily chores or real-time maintenance requirements.
10. BLACKTHORN HOMESTEAD
The Homestead is an established concept centered around the Blackthorn City region, including connections to Dragon's Den and Ice Path.
It should be treated as a real compound with meaningful facilities, Pokémon roles, resources, infrastructure, and environmental requirements.
Facilities must not simply generate arbitrary numerical bonuses.
Each facility should have a function and a set of operational requirements.
Initial facility concepts
A. The Glasshouse
A central multifunctional facility combining:

* Greenhouse cultivation.
* Hatchery.
* Nursery.
* Biological research.
* Environmental regulation.
* Egg-walking paths.
* Food and Berry production.
* Pokémon-supported operational roles.

Previously explored potential contributors include:
Magcargo — Hearth / Climate Regulation
Explore its heat-producing biology and egg-hatching applications.
Distinguish between official Flame Body/Magma Armor mechanics and speculative greenhouse heating applications.
Ampharos — Lighting and Electrical Support
Explore its established light-producing biology and possible equipment-assisted energy roles.
Do not assume unlimited electrical production.
Meganium — Horticultural Support
Explore plant care, environmental interactions, and potential cultivation assistance.
Miltank — Nursery and Food Production
Explore milk production and possible nursery-related support, with biologically appropriate limitations.
These are candidate roles, not compulsory staff assignments.
B. Hatchery and Breeding Operations
Connect to the separate Breeding system.
Consider:

* Egg development.
* Incubation conditions.
* Egg-hatching mechanics.
* Parent and offspring records.
* Lineage.
* Nursery capacity.
* Staff and equipment.
* Species-specific biological requirements.

Preserve the previously discussed 255-step egg-cycle concept as a potential Glasshouse walking-route design consideration, but verify applicable Generation IV egg-cycle mechanics before implementing exact step calculations.
C. Ice Path Cold Vault
A potential temperature-controlled storage facility drawing inspiration from the nearby Ice Path environment.
Explore:

* Refrigerated storage.
* Food preservation.
* Biological sample storage.
* Temperature management.
* Specialized Pokémon support.
* Safety and operational requirements.

Mamoswine is a previously discussed candidate contributor.
D. Research Institute
Support:

* Species research.
* Biology dossiers.
* Ecological studies.
* Breeding research.
* Habitat observations.
* Egg-move specializations.
* Field capability documentation.

This facility should connect directly to the broader Blackthorn reference library.
E. Workshop and Equipment Depot
Support:

* Tools.
* Equipment storage.
* Repairs.
* Materials.
* Field kits.
* Crafting.
* Production planning.
* Expedition preparation.

Integrate with the separate Equipment and Poké Ball systems.
F. Habitats and Conservation Grounds
Support:

* Species-specific environments.
* Pokémon accommodation.
* Feeding.
* Exercise.
* Behavioral enrichment.
* Ecological observation.
* Habitat compatibility.

G. Dragon's Den Research Operations
Support:

* Cave exploration.
* Field studies.
* Environmental research.
* Wildlife observation.
* Expedition preparation.

These are starting facility concepts. Preserve compatibility with other compound-design specifications and do not treat this list as exhaustive or permanently finalized.
11. FACILITIES AS CAPABILITY NETWORKS
Each facility must be modeled in terms of its actual requirements.
For example, a greenhouse might need:

* Temperature regulation.
* Lighting.
* Water access.
* Growing space.
* Soil management.
* Labor.
* Storage.
* Maintenance.
* Safety systems.

Pokémon, equipment, and infrastructure can satisfy those requirements in different combinations.
Required facility model
Each facility should support:

* Facility identity.
* Function.
* Location.
* Infrastructure.
* Required resources.
* Environmental requirements.
* Equipment.
* Operational capacity.
* Available Pokémon contributors.
* Staff assignments.
* Dependencies.
* Limitations.
* Optional production or research outputs.

Avoid assuming that assigning one Fire-type solves every heating requirement or that any Grass-type automatically provides agricultural expertise.
Facilities should benefit from complementary Pokémon capabilities.
Where meaningful, the user should be able to compare different staff combinations.
Assignment philosophy
Allow Pokémon to hold operational assignments without automatically removing them from the user's battle team.
If availability conflicts are modeled, they should be explicitly enabled and explained.
Avoid creating unnecessary management chores.
12. FOOD, RESOURCES, AND EQUIPMENT
Develop a resource model that connects Survival and Homestead.
Consumable resources
Examples:

* Food.
* Water.
* Berries.
* Medicine.
* Expedition provisions.

Production materials
Examples:

* Apricorns.
* Wood.
* Stone.
* Crafting materials.
* Specialized environmental resources.

Operational resources
Examples:

* Facility capacity.
* Storage space.
* Transport capability.
* Equipment availability.
* Pokémon assistance.
* Research equipment.

Resources should have meaningful functions.
However, avoid creating artificial daily tasks or arbitrary depletion systems that make the application tedious.
The user should be able to estimate expedition consumption, resource requirements, and operational capacity without having to participate in a constant maintenance simulation.
Equipment integration
Connect to the separate Blackthorn Equipment system, including:

* Poké Balls.
* Apricorn crafting.
* Travel equipment.
* Field tools.
* Storage.
* Shelter equipment.
* Transportation.
* Utility devices.
* Workshop supplies.

Use official game mechanics where applicable and clearly identify speculative production or crafting rules.
13. CONTEXTUAL BUILD INTEGRATION
This is one of the most important architectural requirements.
Do not require the user to return to one giant Pokémon Builder screen to change a build.
The same individual Pokémon configuration must be accessible and adjustable within multiple working contexts.
Pokémon Studio
Focus on:

* Individual design.
* Species.
* Nature.
* IVs.
* EVs.
* Ability.
* Moves.
* Item.
* Breeding.
* Lineage.
* Identity.

Battle Laboratory
Focus on:

* Damage.
* Matchups.
* Roles.
* Team synergy.
* Simulations.
* Qualifications.

Survival Laboratory
Focus on:

* Environmental capabilities.
* Traversal.
* Food and shelter.
* Expedition readiness.
* Supplies.
* Equipment.
* Team complementarity.

Homestead
Focus on:

* Facility roles.
* Pokémon contributions.
* Environmental suitability.
* Operational requirements.
* Resource usage.
* Specialized assignments.

Critical requirement
Changes must remain connected across modules.
If the user creates a new Scizor build within Survival, that same configuration should be available in Pokémon Studio, Team Construction, and Battle.
Support draft branches and version history so experimentation does not destroy previous configurations.
Use a shared Pokémon/build identity rather than duplicating editable Pokémon records independently in each module.
14. DECISION SUPPORT AND OPTIMIZATION
The user should be able to decide what matters most.
Avoid defining a universally perfect survival Pokémon or universally optimal homestead configuration.
Support:

* Hard requirements.
* Strong preferences.
* Optional objectives.
* Adjustable variables.
* Alternative configurations.
* Transparent tradeoffs.

Results should be organized into:
Recommended: Strong matches for the chosen requirements and preferences.
Potential Fits: Interesting possibilities requiring compromises or additional resources.
Everything Else: Remaining discoverable possibilities, subject to legality and applicability filters.
Include an explanation of each recommendation.
Examples:

* This team handles cold-weather travel but needs additional food capacity.
* This Pokémon improves transportation at the cost of increased provisioning requirements.
* This facility arrangement offers better redundancy but requires more space.
* This Scizor build retains its competitive identity while meeting the expedition's equipment-handling needs.

Avoid inventing quantitative precision where evidence is insufficient.
15. SHARED TAGS, QUALIFICATIONS, AND RECOGNITION
Integrate with the broader Blackthorn Tags, Badges, and Qualification system.
Survival and Homestead may contribute evidence toward specialized recognition.
Potential categories include:

* Environmental specialists.
* Traversal specialists.
* Expedition-ready teams.
* Facility specialists.
* Transport specialists.
* Ecological versatility.
* Specialized resource acquisition.
* Operational coordination.

These are possible categories, not finalized qualifications.
Recognition should be based on defined conditions, capabilities, or performance tests.
Do not automatically grant combat bonuses because a Pokémon qualifies for a noncombat tag.
Keep descriptive recognition separate from any explicitly designed custom mechanical effects.
Qualification thresholds should remain adjustable where the broader Blackthorn architecture allows.
16. USER EXPERIENCE AND VISUAL DESIGN
Build an attractive, practical, easily navigable experience consistent with the broader Blackthorn interface.
The user should feel like a Pokémon trainer managing actual individuals, a team, expeditions, and a compound.
Survival interface priorities

* Current team and selected builds.
* Expedition or environment selection.
* Capability coverage.
* Environmental strengths.
* Missing requirements.
* Equipment and supplies.
* Actionable recommendations.
* Comparison between team configurations.

Homestead interface priorities

* Visually organized compound facilities.
* Facility functions.
* Assigned Pokémon.
* Operational status.
* Equipment.
* Resource requirements.
* Capability coverage.
* Facility comparisons.
* Pokémon contributions.

Preserve attractive Pokémon imagery and individual identities.
Avoid turning the entire experience into an overwhelming spreadsheet.
Detailed information should be available through contextual drill-downs.
The system should support desktop and mobile layouts.
17. TECHNICAL ARCHITECTURE
Preserve the project's existing Google-centered foundation wherever practical.
Blackthorn currently uses a combination of:

* Google Apps Script.
* Google Sheets.
* Google Drive.
* Browser-accessible web interfaces.

The user values:

* Access from a phone.
* Access from a restricted work laptop without installing software.
* Shareable Google links.
* Easy navigation.
* Zero additional spending.
* Reputable free software.
* The ability to use a home gaming laptop for computationally intensive operations.

Implementation requirements

1. Audit the existing Blackthorn application before replacing functionality.
2. Reuse shared species, move, item, trainer, Pokémon, and team records.
3. Do not create competing reference databases for the same information.
4. Keep biological interpretations separate from factual game data.
5. Ensure Survival and Homestead consume shared capability records.
6. Preserve individual build versioning and cross-module relationships.
7. Prefer modular, maintainable components.
8. Do not require local software on the user's work laptop.
9. Avoid introducing paid services.
10. Ensure the application remains useful when heavy simulation services are unavailable.

Do not assume that a new backend is required for every analytical function.
Most capability lookups, rule checks, resource comparisons, and facility assessments should be achievable through structured reference data and lightweight calculations.
If future expedition simulations require additional computation, design that as an optional connected service rather than replacing the existing browser-based experience.
18. DEVELOPMENT PRIORITIES
Because this specification will be combined with other Blackthorn requirements, implementation should be coordinated with the overall project architecture.
Phase 1 — Shared Foundation
Establish the capability schema and integrations with existing Pokémon/build and species reference records.
Implement evidence classifications, capability relationships, and basic contextual queries.
Phase 2 — Survival Planning
Build the Survival workspace with environmental scenarios, team capability assessments, traversal requirements, equipment needs, and recommendations.
Phase 3 — Homestead Foundation
Build the compound's facility records, functional requirements, Pokémon role assignments, and capability-based evaluations.
Phase 4 — Deeper Systems Integration
Connect resource planning, equipment, breeding, ecological specialization, tags, qualifications, and other modules.
Phase 5 — Advanced Optimization and Optional Simulation
Expand team optimization, complementary work assignments, scenario analysis, and optional time-based simulation.
These phases describe development priorities, not a requirement to isolate the systems permanently.
Shared structures should be designed with later integrations in mind.
19. ACCEPTANCE CRITERIA
The implementation should eventually demonstrate the following:
Test A — Capability consistency
A Scizor's anatomy-supported manipulation capabilities can be referenced by Survival and Homestead without automatically granting cartridge HM permissions.
Test B — Shared builds
A Pokémon build selected in Survival can be opened in Battle and Team Construction without losing its configuration or creating an unrelated duplicate.
Test C — Expedition assessment
A six-Pokémon team can be evaluated against a winter expedition scenario, producing identifiable strengths, gaps, equipment requirements, and useful alternatives.
Test D — Facility assessment
The Glasshouse can evaluate Pokémon candidates for climate management, horticulture, and nursery support using shared capabilities and explicit requirements.
Test E — Canon separation
The interface clearly distinguishes official game mechanics from biologically plausible interpretations and fictional Blackthorn extensions.
Test F — Comparative decisions
The user can compare two team or facility configurations and receive explanations of tradeoffs without being forced to accept a single universal winner.
Test G — Reference reuse
Updating a shared capability record updates the relevant assessments without manually revising each facility or scenario.
Test H — Accessibility
The everyday Survival and Homestead interfaces remain usable through a shareable browser-based application on a phone and laptop, with no required local software installation.
20. IMPORTANT IMPLEMENTATION GUARDRAILS
Do not:

* Build an entirely separate survival game.
* Make Pokémon usefulness depend exclusively on their four selected battle moves.
* Treat speculative biological interpretations as official game mechanics.
* Invent unsupported exact physical performance statistics.
* Turn the Homestead into a mandatory daily-maintenance simulator.
* Replace user decision-making with arbitrary overall ratings.
* Force permanent facility assignments without user choice.
* Create redundant Pokémon records across modules.
* Duplicate the research systems defined elsewhere.
* Treat candidate facilities or assignments as already finalized.
* Introduce unnecessary paid infrastructure.
* Rebuild functioning Blackthorn systems merely for architectural convenience.

The purpose is to extend the existing Pokémon ecosystem while preserving its mechanical authenticity and personal identity.
21. EXPECTED DEVELOPMENT APPROACH
This specification will be combined with several others.
Before implementing, review the full set of Blackthorn instructions, identify overlapping data requirements, and propose a coherent shared architecture.
Specifically:

1. Identify which Survival and Homestead capabilities already exist.
2. Determine which reference data can be reused.
3. Identify dependencies on Biology, Breeding, Equipment, Team Construction, and Pokémon Studio.
4. Establish shared data contracts and stable identifiers.
5. Resolve incompatible assumptions across specifications.
6. Distinguish minimum viable features from later expansions.
7. Implement iteratively without losing the overall design.
8. Test factual accuracy, cross-module consistency, and user experience.

Do not invent missing canon or silently make irreversible design decisions when specifications conflict.
Favor extensible foundations over short-term isolated solutions.
FINAL PRODUCT VISION
Blackthorn's Survival and Homestead systems should make the Pokémon world feel functional, coherent, and biologically alive.
A Pokémon's species determines its biological foundation.
Its individual build, training, moves, and inherited capabilities may shape its specialization.
Its team determines what it can accomplish collaboratively.
Equipment expands practical possibilities.
Environmental conditions change which capabilities are valuable.
Facilities translate those capabilities into useful ongoing functions.
Research explains why those relationships make sense.
The result should be a connected system where the user's carefully designed Pokémon have meaningful roles beyond battle, without compromising their competitive identities or the authentic mechanics of the games.
Survival should help the user understand what their team could accomplish in the world.
Homestead should help the user understand how their Pokémon could live, work, and contribute together.
Above all, these should be sophisticated tools for exploration, optimization, planning, and personal expression—not obligatory minigames or repetitive management chores.
