# BLACKTHORN OS — POKÉ BALL & EQUIPMENT SYSTEM

Implementation Specification | Approved Design Direction

(Zack, received 2026-10-24. Verbatim. The approved three-panel visual mockup it refers to was not attached to this
message; it is a visual reference, not a source of mechanics.)

## 1. Project Objective

Build a premium, visually immersive Poké Ball and Equipment system within Blackthorn OS.

The goal is to create a beautiful, informative, interconnected reference library for every Poké Ball available across Pokémon Generations I–IV, while integrating each Ball into individual Pokémon profiles.

The system should combine:

* Authentic Pokémon game mechanics and equipment information.
* Beautiful, prominent exterior artwork.
* Detailed, researched equipment profiles.
* High-resolution conceptual illustrations of Poké Ball interiors.
* A searchable, collectible-style Poké Ball library.
* Personalized artwork showing an individual Pokémon inhabiting its assigned Ball.
* Connections to the existing Pokémon Builder, inventory, and broader Blackthorn OS ecosystem.

The user has approved a specific three-panel visual mockup. Use the supplied approved mockup as the principal design reference.

The approved aesthetic is dark, premium, elegant, and visually rich, with restrained gold accents, strong typography, high-quality imagery, and clear information hierarchy.

Do not redesign this as a generic Pokédex, spreadsheet, futuristic technical dashboard, or conventional inventory screen.

## 2. Core Design Philosophy

There are two distinct but interconnected experiences:

### A. Poké Ball Equipment Profile

The Ball itself is the subject.

Display hierarchy:

1. Exterior artwork — highest priority. Large, beautiful, recognizable image of the Ball.
2. Equipment information — second priority. Accurate mechanics, history, acquisition, craftsmanship, and notable characteristics.
3. Interior visualization — supporting priority (2B). A richly detailed conceptual interior, easily expandable into a large or fullscreen view.

### B. Individual Pokémon Profile

The Pokémon itself is the subject.

Once an individual has an assigned Ball, display:

* The exterior icon of that Ball.
* The Ball's name and its connection to the individual.
* A personalized illustration showing that specific Pokémon inhabiting the Ball's conceptual interior.
* An easy link back to the complete Ball equipment profile.

The interior is supporting content on the equipment page but becomes a major personalized visual feature inside the individual Pokémon profile.

The system should make every Pokémon feel like a unique individual with its own environment, possessions, and identity.

## 3. Screen One — Poké Ball Collection Library

Create an elegant collection gallery displaying all supported Poké Balls from Generations I–IV.

Layout:

* Dark premium Blackthorn styling.
* Page title: "Poké Ball Collection."
* Responsive grid of Ball cards.
* Each card features a clear, high-quality exterior Ball image.
* Ball name beneath the image.
* Subtle supporting classification information.
* Search bar.
* Practical filters for generation, category, acquisition method, and special functionality.
* Clickable cards that open the detailed Ball profile.

Use the approved mockup's library panel as the primary layout reference.

Categories should include relevant standard, specialized, Apricorn-crafted, Safari, event, and other historically available Balls.

Make sure the underlying catalog is complete for the chosen Generation I–IV scope, without inventing Ball types or treating modern-only mechanics as historical.

Design details:

Cards should feel like a premium collectible equipment catalog, not large text-heavy documents.

Exterior imagery must remain visually consistent in size, alignment, and presentation.

Avoid excessive badges or decorative statistics. The artwork and name should dominate each card.

The library should be functional on desktop and mobile.

## 4. Screen Two — Individual Poké Ball Profile

Each Ball should open a rich equipment profile.

Use the approved Luxury Ball mockup as the principal design reference.

### Section A: Exterior Hero

The upper portion of the screen should prominently feature:

* Large exterior Ball artwork.
* Ball name.
* Generation of introduction.
* Concise thematic description.
* A small number of meaningful classification labels.
* Optional additional exterior views when genuine assets are available.

The Ball must be visually dominant.

Use high-quality artwork and restrained supporting text.

Do not implement a fake 3D or 360-degree viewer that merely rotates a flat image. A small image gallery is preferable unless actual suitable assets exist.

### Section B: Mechanics and Information

Present detailed, reliable information about each Ball.

Relevant fields include:

Capture mechanics

* Base capture behavior.
* Exact capture modifier or catch-rate adjustment.
* Conditions that activate special bonuses.
* Important limitations.
* Relevant differences between Generations I–IV.

Acquisition

* How the Ball is obtained.
* Games where it is available.
* Purchasing, crafting, event, or other acquisition methods.
* Important generation-specific restrictions.

Origins and craftsmanship

* When and where the Ball originated.
* Relevant historical or cultural context.
* Apricorn source where applicable.
* Kurt's craftsmanship where applicable.
* Established materials and construction information, where documented.

Design interpretation

* What makes the Ball visually distinctive.
* Connections between its appearance, purpose, history, and conceptual interior.
* Researched context informing Blackthorn's interpretation.

Information should be concise enough for enjoyable browsing, with expandable details for deeper research.

Do not clutter the profile with six or more large generic information cards. Favor a deliberate hierarchy, readable specifications, and carefully organized content.

### Section C: Conceptual Interior

Create a supporting interior gallery featuring a beautiful, high-resolution conceptual environment for each Ball type.

The interiors should feel like actual habitable spaces, not abstract energy fields, technical cutaways, sterile science-fiction chambers, or schematic containment devices.

The Luxury Ball interior from the originally approved light-theme mockup is an especially important creative reference.

It resembles a richly furnished circular private lounge, featuring warm gold lighting, beautiful furniture, substantial architectural detail, and an inviting atmosphere.

Every Ball should receive a distinctive interpretation appropriate to its identity.

Examples of thematic directions:

* Luxury Ball: elegant, comfortable private sanctuary.
* Moon Ball: peaceful nocturnal retreat illuminated by moonlight.
* Dive Ball: serene aquatic-inspired environment.
* Friend Ball: warm, natural, welcoming environment.
* Heavy Ball: solid, grounded, sheltered environment.

These are creative directions, not canonical descriptions or finalized required interiors.

The interior should be clearly identified as a Blackthorn Conceptual Interpretation, distinguishing it from established Pokémon lore.

Each profile should feature an easily expandable image with the ability to inspect fine architectural and environmental details.

Do not require real-time 3D rendering or procedural environment generation.

Use high-quality static artwork.

### Section D: Related Balls

Include a compact collection strip or gallery showing similar and related Balls.

Use small exterior images and names.

Clicking another Ball should open its corresponding equipment profile.

Navigation should be quick and visually consistent.

## 5. Screen Three — Individual Pokémon Ball Integration

This is a particularly important requirement.

Every created individual Pokémon should be able to have a specific Poké Ball assigned through its personal information.

Once assigned, its profile must reflect that choice.

Use the approved Umbreon / Moon Ball panel as the primary visual reference.

### Assigned Ball Panel

Include:

* Ball exterior thumbnail or icon.
* Ball name.
* Link to full equipment profile.
* Relevant personal Ball information where available.
* A personalized interior image.

### Personalized Interior Visualization

The user wants to see their actual individual Pokémon inside its assigned Ball's imagined environment.

For example:

An Umbreon assigned a Moon Ball could appear resting in a beautifully designed nocturnal sanctuary.

A Milotic assigned a Luxury Ball could appear in an environment adapted to its anatomy and aquatic needs while preserving the Luxury Ball's architectural identity.

The important distinction is that the image should incorporate BOTH:

1. The standardized visual identity of the Ball interior.
2. The identity and characteristics of the individual Pokémon.

The individual Pokémon must be a meaningful subject of the artwork, not a tiny decorative figure added to an otherwise generic room.

### Artwork Variant Support

Where applicable, support:

* Species and evolution.
* Male/female visual differences.
* Shiny/non-shiny appearance.
* Custom uploaded Pokémon artwork.
* Relevant personal visual characteristics.
* Assigned Ball type.

Use the existing individual Pokémon record as the authoritative source of these selections.

### Image Generation Workflow

Do not assume images must be generated automatically whenever a Pokémon is edited.

Instead, implement a reusable artwork brief / generation packet derived from existing structured data.

The packet should describe:

* Individual Pokémon identity.
* Species, form, gender presentation, and shiny status.
* Assigned Ball.
* Established Ball interior style.
* Pokémon anatomy and environmental needs.
* Desired composition, lighting, and mood.
* Consistency requirements for previously established interior architecture.

Provide an easy method to upload or attach the resulting artwork to the individual Pokémon profile.

If a reliable existing image-generation integration is available, it may be used; otherwise preserve the packet and manual artwork upload workflow.

The user should not have to re-enter information already stored elsewhere in Blackthorn.

If no custom image exists, display the standard conceptual Ball interior, with the option to add a personalized illustration later.

The Pokémon profile must function perfectly well without a personalized image.

## 6. Artwork and Asset Standards

Visual quality is a defining feature of this module.

Use:

* High-resolution exterior artwork.
* Large, richly detailed interior compositions.
* Consistent exterior image framing.
* Consistent architectural identity for each Ball type.
* Responsive image containers.
* Fullscreen or expanded artwork viewing.
* Optimized thumbnails for collection browsing.
* Larger image assets only when needed.

Exterior artwork should faithfully depict the established Ball design. Conceptual interior art can be creative but must be clearly classified.

The user should be able to replace or improve imagery without changing the underlying equipment data.

Do not embed images directly into Google Sheets cells as the primary asset-management method.

Use an appropriate image storage/reference approach compatible with the existing Google Drive and Apps Script architecture.

Preserve links between each Ball, its artwork collection, and individual Pokémon assigned to it.

The system should support future artwork enrichment without structural rebuilding.

## 7. Reference Data and Generation Accuracy

The Equipment Library should use stable reference records covering relevant Pokémon equipment from Generations I–IV.

However, actual functionality must be stored and evaluated according to the selected game.

This is essential because capture mechanics and Ball behavior differ between generations.

Examples of historical distinctions that must be verified:

* Generation II Apricorn Ball behavior versus HeartGold/SoulSilver.
* Heavy Ball's weight-dependent capture adjustments.
* Fast Ball, Love Ball, and Moon Ball mechanics and historical implementation differences.
* Generation III–IV specialized Ball conditions.
* Friendship effects associated with the Luxury Ball and Friend Ball.
* Availability and restrictions of special-purpose Balls.
* The legal capture-Ball combinations possible for an individual Pokémon in the selected game.

Do not copy mechanical claims from the approved visual mockups without verification.

Those mockups were approved for visual design, not technical accuracy.

For example, the Luxury Ball is not a Kurt-crafted Apricorn Ball, its capture modifier should not be invented, and its friendship effect must be represented accurately.

Keep historical reference data separate from personal inventory and customized Pokémon records.

Separate:

* Confirmed canonical/game data.
* Source-supported descriptive information.
* Biological or material inferences.
* Creative Blackthorn interpretations.

Reference records should contain source provenance where appropriate.

## 8. Equipment Beyond Poké Balls

The Poké Ball Gallery is the standout feature, but Blackthorn should also have a straightforward general equipment library.

Include relevant Generation I–IV trainer equipment and key items where appropriate, such as:

* Running Shoes.
* Bicycle.
* Town Map and navigation equipment.
* Pokégear.
* Fishing Rods.
* Coin Case.
* Exploration and traversal equipment.
* Other relevant tools and personal gear.

These items do not all require elaborate interiors, immersive visualizations, or complex crafting systems.

Use the same general design language with appropriately simpler profiles.

Support information about acquisition, purpose, game availability, and ownership where relevant.

Preserve connections to Survival, Homestead, and journey planning without attempting to implement those entire systems inside this module.

**Settled later (A-35, Zack, 2026-10-26: "Change: include every key item.").** "Key items where appropriate" now means every key item: everything Crystal, FireRed, Emerald, Platinum and HeartGold/SoulSilver file in their Key Items pocket, read from each game's own item data, plus the four devices that aren't bag items (Running Shoes, Pokégear, PokéNav, Pokétch). Story items that only matter to the plot are in too, marked as story items. Each game gets its own name and description for an item, and how you get it comes from that game's scripts; an item a game only carries in its item table is shown as such. The build stops if the library and the games' item lists disagree (`equipment/gear.py` check()). What it looks like in the app: `docs/APP.md` (Equipment).

## 9. Apricorns and Craftsmanship

Include accurate information about the seven Apricorn types and their corresponding Balls.

For Apricorn-related equipment, connect:

* Apricorn type and source.
* Corresponding Ball.
* Kurt's crafting process.
* Relevant region and location.
* Generation-specific functionality.
* Acquisition information.

These relationships should be structured as reusable reference data.

A lightweight material or craftsmanship reference system is sufficient for this phase.

Do not create an elaborate fictional manufacturing simulation, resource economy, or worker-management game as part of the Poké Ball module.

Those capabilities may be developed separately through Blackthorn's Survival and Homestead systems.

## 10. Data Model and Cross-System Integration

Design a reusable equipment schema rather than isolated hardcoded pages.

At minimum, distinguish:

Ball Reference Record

* Stable Ball identifier.
* Name and category.
* Introduction generation.
* Mechanics by game/generation.
* Acquisition information.
* Canonical source references.
* Crafting and ingredient relationships.
* Exterior image references.
* Standard interior concept image references.
* Creative interpretation metadata.

Personal Inventory Record

* Equipment identifier.
* Quantity or ownership state when appropriate.
* Associated game or save.
* Notes where applicable.

Individual Pokémon Association

* Pokémon individual identifier.
* Assigned Ball identifier.
* Game/save context.
* Personal provenance where relevant.
* Optional custom artwork reference.
* Optional personal description or note.

Artwork Record

* Image identifier.
* Asset type: exterior, interior, personalized interior.
* Related Ball identifier.
* Related Pokémon identifier when applicable.
* Storage reference.
* Description and creative-interpretation status.
* Version or replacement history where useful.

Editing the Ball reference record should update its information wherever it appears.

Assigning a Ball to a Pokémon should immediately update the Pokémon's personal profile.

Do not duplicate equipment descriptions or art metadata independently across Pokémon records.

Preserve canonical historical facts and user-owned inventory separately.

## 11. User Experience Requirements

The module must integrate with Blackthorn's broader design philosophy.

Desktop

* Premium, spacious, visually appealing layout.
* Large exterior hero images.
* Easy navigation between gallery and profiles.
* Concise, informative equipment content.

Mobile

* Fully usable in an ordinary browser.
* Responsive Ball gallery.
* Exterior hero artwork remains prominent.
* Easy scrolling and large image viewing.
* Accessible navigation back to the gallery or Pokémon profile.
* No required local software installation.

Cross-module navigation

* From Ball Collection to Ball Profile.
* From Ball Profile to related Balls.
* From Individual Pokémon to assigned Ball Profile.
* From Ball Profile to associated personal Pokémon where appropriate.
* From Equipment to related acquisition or craftsmanship references.

Avoid cumbersome navigation and duplicated information.

## 12. Technical Architecture and Constraints

Blackthorn OS currently uses Google Apps Script, Google Sheets, and Google Drive.

Preserve this web-accessible, shareable, phone-friendly foundation unless a concrete technical limitation makes a different approach necessary.

The user's work laptop has software installation restrictions, so normal Blackthorn browsing and planning must not require installing additional programs.

Prioritize reputable, free technology.

No new paid services, subscriptions, or required paid APIs.

This equipment module should not require a separate Node.js service or a dedicated server for ordinary browsing and editing.

It should be practical to operate through the existing Google-backed application.

Use existing shared Pokémon IDs, team records, navigation conventions, and asset structures wherever possible.

Before modifying the application, inspect the existing code and data organization.

Avoid disrupting functioning Pokémon Builder, battle, trainer, or inventory features.

## 13. Implementation Priorities

Prioritize implementation in this order:

Phase A — Reference and data integration

* Audit existing equipment, image, and Pokémon data.
* Establish accurate Ball reference records.
* Establish cross-system identifiers and generation-specific mechanics.

Phase B — Visual equipment experience

* Build the approved Poké Ball Library.
* Build the individual Ball detail page.
* Implement exterior hero artwork, organized information, and supporting interior imagery.

Phase C — Individual Pokémon connection

* Allow Ball assignment.
* Display Ball exterior icon in Pokémon profiles.
* Add personalized Ball interior imagery.
* Support artwork upload and reusable creative briefs.

Phase D — Enrichment

* Complete Generation I–IV catalog.
* Verify mechanics and acquisition details.
* Enrich interior art, material references, and related equipment connections.
* Add general equipment profiles.

Do not allow later enhancements to block the core gallery and individual Pokémon integration.

## 14. Acceptance Criteria

The feature is successful when:

1. A user can browse the complete Generation I–IV Poké Ball library with attractive exterior thumbnails.
2. Selecting a Ball opens a beautiful profile where exterior artwork is the dominant element.
3. The profile contains accurate game-specific mechanics, acquisition details, and relevant origin/craftsmanship information.
4. Every Ball supports a high-quality conceptual interior image that can be viewed at a larger size.
5. The user can assign a Ball to an individual Pokémon.
6. The Pokémon profile displays the assigned Ball's recognizable exterior artwork.
7. The user can attach a personalized illustration of their Pokémon inhabiting the Ball's environment.
8. Image references, Ball metadata, and individual Pokémon information stay connected across the application.
9. The interface works on desktop and mobile.
10. The feature preserves the existing Google-backed Blackthorn architecture without introducing mandatory paid services or unnecessary complexity.

## 15. Final Design Instruction

Treat the approved mockup as the visual reference, but preserve the following hierarchy absolutely:

Poké Ball Library: Beautiful, browseable exterior-art collection.

Poké Ball Profile: Exterior artwork first, authentic information second, richly detailed conceptual interior third.

Individual Pokémon Profile: Pokémon identity first, assigned Ball clearly visible, personalized interior illustration showing that Pokémon actually inhabiting its Ball.

The standard Ball interior should feel like an actual place. The personalized Pokémon interior should feel like that individual Pokémon's place.

Do not substitute futuristic diagrams, schematic cutaways, or generic glowing chambers for the rich, inhabitable environments envisioned here.

Above all, this system should make Poké Balls feel like meaningful, beautifully designed pieces of the Pokémon world—and make the relationship between a trainer, an individual Pokémon, and its Ball feel personal.

Build a precise equipment reference system underneath a visually extraordinary, enjoyable experience.
