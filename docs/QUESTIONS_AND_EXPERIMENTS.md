# Questions & Experiments

Nothing in this file is canon. Questions are numbered so decisions can reference them (`D-… resolves Q3`).

## Open decisions that block design work

| # | Question | Why it matters now | Evidence |
|---|---|---|---|
| **Q1** | Does "Surf and Fly as permanent moves on every team" apply **retroactively** to Crystal and Platinum? | Neither six can learn Fly on cartridge; neither has a Waterfall learner. Options: (a) the rule is forward-only (SoulSilver and later detail work); (b) earlier chapters satisfy it via *world function* (Garchomp flies in its own Pokédex); (c) the rule stands and the earlier rosters must answer it. *Interpretation, not a proposal:* Crystal having no flyer may be *thematically right*, a first journey made on foot | `MECHANICS_FINDINGS` §5 |
| **Q2** | PKHeX provenance policy: legal-by-construction / legal-only / canon-over-cartridge / hybrid? | It decides whether HeartGold's Extrasensory Typhlosion is "the starter's bred grandchild" or "a PKHeX'd starter" | `APP_PRODUCT_SPEC` §7 |
| **Q3** | Storage: repo + static app (recommended) / all-Google / artifact-native? Do you have, or want, a GitHub account? | Without a persistent home, this container's work disappears | `APP_PRODUCT_SPEC` §6 |
| **Q4** | Typhlosion's nature under the July set (2 special + 2 physical moves) | Timid (older build) cuts Attack, which two of the July moves rely on | `MECHANICS_FINDINGS` §1 |

## Mechanical research queue

- Dragon's Den Dratini + ExtremeSpeed in HGSS: confirm in PKHeX's encounter DB (neither dataset has it).
- Story-mandatory HMs per game (Crystal Waterfall? Platinum Waterfall to reach the League? Platinum Defog?), each with a citation.
- Meganium in Emerald: the exact Birch gift condition.
- Gen 3–4 PID/IV: which nature + IV combos exist for each *non-egg* canon member (starters, statics). PKHeX answers this per specimen.
- Old Apps Script legality logic (if source can be exported): how it treated egg chains, tutors and transfers.

## Cross-chapter facts that are story questions

- **SoulSilver's Infernape and Empoleon can only arrive by trade from a Sinnoh game**: HGSS has no Sinnoh starters. Is SoulSilver's Infernape *the* Platinum Infernape ("We've been here before," literally), or a different individual? There's no ban on repeats, and none being proposed.
- **Emerald's Arcanine can only come from FireRed** (Growlithe is FireRed-exclusive and absent from Emerald).
- **Crystal's Ampharos can only come by trade** (no Mareep line exists in Crystal, per the ROM data). A gift from someone? The rival? Story unknown.
- **HeartGold's Extrasensory Typhlosion and Emerald's Refresh Swampert must be bred.** Neither can be the professor's starter on a legal cartridge.
- Archive curiosity, *speculative*: the v3 sheet had **Empoleon in Platinum** before Lucario took the slot. A Platinum-era Empoleon who didn't make the final six, then traveled to Johto, would give the archive a story role. Offered only because it's interesting.

---

## SoulSilver: pair/trio audit of the provisional six (opened 2026-10-19)

**Status: PROVISIONAL.** Pikachu · Dragonite · Infernape · Empoleon · Gengar · Scizor is a starting point with no incumbency (reset July 14; rough six July 16).

### Structural observation (mechanical)
On a Gen 4 type chart (with Gengar's Gen 4 Levitate), the provisional six resolves into **three mutually covering pairs**:

| Pair | Covers each other | Shared weaknesses |
|---|---|---|
| Dragonite ↔ Empoleon | Empoleon takes Dragonite's Ice (×4), Rock, Dragon. Dragonite takes Empoleon's Fighting and Ground | none |
| Scizor ↔ Infernape | Infernape takes Scizor's *only* weakness (Fire ×4). Scizor takes Infernape's Psychic | none |
| Gengar → Pikachu | Levitate makes Gengar immune to Pikachu's only weakness (Ground) | none |

For comparison, the **former Gyarados + Empoleon** pairing shared an Electric weakness and doubled the water role, while the old six had no answer to Scizor's ×4 Fire weakness. The July 16 swap to Infernape fixed both, whether or not that was the reason.

### Playbook coverage (mechanical; "Show us anything. We have an answer.")
- **Every member can carry a priority move** in HGSS: Quick Attack, ExtremeSpeed, Mach Punch, Aqua Jet, Sucker Punch, Bullet Punch.
- **Gengar holds 9 of the 17 answers that only one member can learn** (Perish Song, Trick Room, Destiny Bond, Hypnosis, Disable, Trick, Sucker Punch…). Structurally it's the team's audible-caller.
- **Gap: team status care.** No member can learn Heal Bell, Aromatherapy or Refresh. HeartGold has Lapras's Heal Bell; Emerald has Swampert's Refresh. Alternates that would add it: **Lanturn** (Heal Bell) and **Mismagius** (Heal Bell, Shadow Sneak). One possible non-move answer is *preparation* (berries, medicine), which touches the equipment half-thought. Noting the connection only, not running with it.
- Other absences: Rapid Spin/hazard control (Starmie adds it), Spikes (Skarmory), Whirlwind (Noctowl, Skarmory).

### Pair 1 — Dragonite + Empoleon: the sky-and-sea spine
- **For:** the cleanest defensive pair on the team (above). Together they hold Fly, Surf, Waterfall, Whirlpool and Rock Climb (Empoleon). The lore reads like SoulSilver's screening list. *HeartGold dex:* Dragonite "constantly flies over the immense seas and rescues drowning people." *Platinum dex:* it "guides crews of shipwrecks to shore." *HGSS dex:* Empoleon "avoids unnecessary disputes, but it will decimate anything that threatens its pride", which is restraint and measured intervention. *Platinum dex:* its wings "cleave through an ice floe."
- **Against / costs:** Fly has **no backup**: if Dragonite is the flyer, every emergency extraction runs through one companion. Both are large (civilization fit in towns?). Water transit is doubled. That's redundancy, which suits a contingency team, but it costs a slot's worth of uniqueness.
- **Mechanics:** Dragonite's ExtremeSpeed has no Gen 4 father in the data; its source is believed to be the Dragon's Den gift Dratini (verify in PKHeX). Empoleon is a Sinnoh trade.
- **Open question for Zack:** is this pair the *foundation*, the two members whose removal would change what SoulSilver *is*, or just the logistics core?

### Pair 2 — Scizor + Infernape: the hands
- **For:** tightest mechanical pair (above). Both are technique fighters with priority (Bullet Punch, Mach Punch). Infernape adds Rock Climb (shared only with Empoleon), fire and warmth. *HGSS dex:* Infernape "uses all its limbs to fight in its own unique style."
- **Against / costs:** Infernape's Platinum identity (initiative) needs an interpretation in SoulSilver (judgment, maturity?). Scizor evolves by trade. The supply-carrier idea is a half-thought and stays one.

### Pair 3 — Pikachu + Gengar: the intimate and the clever
- **For:** the two members that fit indoors and in towns. Pikachu's dex entries across the three Gen 4 games are almost a companion profile: it roasts hard berries with electricity so they can be eaten (*HeartGold*), uses a shock to recharge "a fellow PIKACHU that is in a weakened state" (*Platinum*; stretching that to other teammates is interpretation), and raises its tail to check its surroundings (*SoulSilver*). Gengar (*SoulSilver*) "slips into the prey's shadow and silently waits for an opportunity," which is patience and timing, the July "restraint" language.
- **Against / costs:** both are frail. Pikachu's battle case leans on Light Ball, which uses the item slot. Gengar carries a lot of the playbook, so it's also a single point of failure.

### What the pair audit hasn't answered yet
Who is the closest *everyday* companion? Who navigates at night? Who is the medic? What does each member know because they trained together?
