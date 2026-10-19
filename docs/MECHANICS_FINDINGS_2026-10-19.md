# Mechanics Findings — first verification pass (2026-10-19)

**What this is:** every move, ability, HM and acquisition claim in the master handoff, checked against data rather than memory.
**Category:** Mechanical fact (source-backed). Interpretation is marked *Design note*. Nothing here changes canon by itself.

> **Read with D-024 (decided after this report):** the project's only validity gate is *learnability*. Statements below about starters vs bred individuals, encounters, balls and save-plausibility describe a strictly legal cartridge. They're **story options, not constraints**.

## Sources and method

| Source | What it gives | How used |
|---|---|---|
| PokeAPI CSV dataset (GitHub `PokeAPI/pokeapi` master, fetched 2026-10-19, SHA-256 in `engine/data_manifest/`) | Learnsets per **version group** and method, egg groups, gender ratios, encounters, machines, abilities incl. past-gen | Primary query engine (`engine/refdb.py`) |
| Pokémon Showdown `data/learnsets.ts` (MIT) | Independent learnsets by generation (`4E` egg, `4T` tutor, `4L28` level 28, `4M` TM) | Cross-check of every surprising result |
| pret disassemblies (`pokecrystal`, `pokeemerald`) | The games' own data tables | Tie-breaker. Used for Crystal wild data and Emerald egg/level moves |

Verdict tags: **VERIFIED (2 sources)**, **VERIFIED (ROM)**, **UNVERIFIED** (no source settles it). Story-mandatory HM status (which HMs block progress) is **not** in these datasets. Where I state it, it's marked *believed*.

---

## 1. HeartGold — sacred roster, build evidence checked (HGSS version group)

| Member | Move | Route in HGSS | Notes |
|---|---|---|---|
| Typhlosion | Flamethrower | level / TM35 | |
| | **Extrasensory** | **Cyndaquil egg move only** | Not available in DPPt at all. **VERIFIED (2)** |
| | Thunder Punch | HGSS move tutor | |
| | Earthquake | TM26 | |
| | Sunny Day / SolarBeam / Hidden Power | TMs | historical builds |
| | Eruption | level-up | historical (Dec 2025 sheet) |
| | Focus Blast | TM52 | Learnable. Its exclusion is a **design choice**, not a legality issue |
| Tyranitar | **Dragon Dance** | **Larvitar egg move only** | No Monster-group parent learns it by level/TM/tutor in Gen 4. **Needs a 2-step chain** (see §4) |
| | Outrage | Larvitar egg **or HGSS tutor (Tyranitar directly)** | It doesn't *have* to be inherited. **VERIFIED (2)** |
| | Crunch / Earthquake / Rock Slide / Stone Edge | level / TM | |
| Mamoswine | Ancient Power | Piloswine Lv1 (Move Relearner) · tutor · Swinub egg | **Required to evolve.** Piloswine only becomes Mamoswine while knowing it |
| | **Ice Shard** | **Swinub level 28 only** | Not an egg move. Not on Piloswine/Mamoswine lists in Gen 4, so it **can't be relearned after evolving**. Swinub must learn it at 28, before evolving at 33. **VERIFIED (2)** |
| | Ice Fang / Hail / Earthquake | level / TM | |
| Crobat | Fly / Roost / U-turn / Toxic | all TM/HM | trivially legal |
| Lapras | Surf / Ice Beam / Rest | HM / level / TM | |
| | Heal Bell | HGSS tutor | **VERIFIED (2)** |
| Snorlax | Body Slam (Lv33) / Rest / Thunder Punch (tutor) / Zen Headbutt (tutor or Munchlax egg) | | legal |

**Gen 4 abilities (all historical picks valid):** Typhlosion Blaze · Tyranitar Sand Stream · Mamoswine Oblivious/Snow Cloak · Crobat Inner Focus · Lapras Water Absorb/Shell Armor · Snorlax Immunity/Thick Fat.

**The July 2026 Typhlosion set (Flamethrower / Extrasensory / Thunder Punch / Earthquake) is cartridge-legal.** An egg move, a TM, a tutor move and a TM can always coexist.

> *Design note (not a decision):* that set is **mixed**: two special moves, two physical, on a Pokémon with 84 Atk / 109 SpA. The older build's **Timid** nature (−Atk) works against the July set's intent. If the July set stands, the nature question is genuinely open: a −Def or −SpD nature, or accepting the Timid trade-off on purpose. This is the "Typhlosion nature/fourth-move details unsettled" item from the handoff, now with the mechanical reason attached.

> *Design note:* **because Extrasensory is egg-only, a Typhlosion that knows it cannot be Professor Elm's starter** (on a legal cartridge). It has to hatch from a female Cyndaquil-line parent (only 12.5% of Cyndaquil are female) and a male father that knows the move. For HeartGold, "home/lineage/permanence", that may be exactly right: the companion would be *bred at home*, perhaps the starter's grandchild. But it's a fact the story has to own, not a detail to paper over.

## 2. Platinum — checked moves

| Member | Move | Route in Platinum | Notes |
|---|---|---|---|
| Infernape | Close Combat (Lv41) / Flamethrower / Mach Punch (Lv14) | level / TM | |
| | **Thunder Punch** | **Platinum tutor AND Chimchar egg move** | Answers the handoff's open question: both routes are legal. The starter itself can learn it from the tutor. **VERIFIED (2)** |
| | Grass Knot / U-turn | TM | historical sheet set |
| Garchomp | Earthquake / Dragon Claw / Poison Jab (TM84) / Stone Edge | TM / level | |
| | Fire Fang | **Garchomp Lv1 → Move Relearner (Heart Scale)** | |
| | Aqua Tail | Platinum tutor | the rejected option. Legality was never the reason |
| | Outrage | tutor / Gible egg | historical |

**Gen 4 abilities:** Garchomp has **Sand Veil only** (Rough Skin didn't exist for it until Gen 5) · Weavile Pressure · Roserade Natural Cure/Poison Point · Lucario Steadfast/Inner Focus · Magnezone Magnet Pull/Sturdy · Infernape Blaze.

## 3. Emerald & former SoulSilver special moves

| Claim | Result |
|---|---|
| Swampert — Refresh (Emerald) | **Mudkip egg move. VERIFIED (ROM: `pokeemerald/egg_moves.h`).** Fathers that learn it by level-up: **Milotic Lv15** (ROM-confirmed), Corsola Lv17, Lickitung Lv51 |
| Gengar — Disable (HGSS) | Gastly egg move only. Fathers: Grimer/Muk Lv12, Duskull line |
| Scizor — Counter (HGSS) | Scyther egg move. Father: **Heracross Lv25**, or transfer from the Emerald/FRLG tutor |
| Empoleon — Aqua Ring (HGSS) | Piplup egg move. Fathers: Marill Lv23, Seel Lv23, Milotic Lv49, others |
| Pikachu — Volt Tackle (HGSS) | Light Ball breeding (Pichu) |
| Dragonite — ExtremeSpeed (HGSS) | Dratini egg move in Gen 4, but **no Gen 4 father learns it by level/TM/tutor in either dataset.** The known source is the **Dragon's Den gift Dratini** (believed to know ExtremeSpeed if the Elder's quiz is answered correctly). That's an *encounter* fact neither learnset dataset contains. **UNVERIFIED by data: a job for PKHeX's encounter database.** |

> *Design note:* **Emerald's Milotic is a legal father for a Refresh Mudkip.** On the cartridge, then, the team's healer can literally hand its self-care technique to Swampert's line. That's the handoff's "team members learn from each other" made mechanical. Same caveat as Typhlosion: a Refresh Swampert is bred, not the Birch starter.

## 4. Breeding chains found (Breeder Lab kernel, `Ref.chain()`)

| Target | Shortest chain(s) | All in one save? |
|---|---|---|
| Typhlosion + Extrasensory (HG) | **Nuzleaf♂ (Lv49)** × Cyndaquil-line♀ · or Vulpix♂ (Lv44) × Cyndaquil-line♀ | **Nuzleaf: yes** (HG Safari Zone, per PokeAPI). Vulpix is **SoulSilver-exclusive**, so it would need a trade |
| Tyranitar + Dragon Dance (HG) | Dragon-group father with level-up DD (**Horsea, Seadra, Kingdra, Dratini line, Gyarados, Altaria**) × **Lapras♀** or Charmander/Totodile♀ → that son × Larvitar-line♀ | **Yes**, via Horsea (Whirl Islands) or Dratini (Dragon's Den) → Lapras (Union Cave) → Larvitar |
| Tyranitar + Outrage (HG) | tutor directly, or Lapras/Snorlax/Nidoking/etc. ♂ with tutor-Outrage × Larvitar♀ | yes |
| Tyranitar + DD **and** Outrage from one egg | A male **Lapras** carrying DD (inherited) + Outrage (tutor) passes both | yes |
| Mamoswine + Ice Shard | not inheritable, timing only (see §1) | yes |
| Swampert + Refresh (E) | Milotic♂ / Corsola♂ / Lickitung♂ × Mudkip-line♀ | yes |

> *Design note:* **HeartGold's own Lapras line can be the bridge for Tyranitar's Dragon Dance.** I'm presenting this as an authoring candidate, not canon. A team where the gentle water-carrier is the one who taught the mountain its controlled escalation is the kind of internal lineage the handoff describes.

## 5. Field / HM matrix (who on each roster can learn each field move, cartridge only)

| Game | HMs covered | **Gaps** | Single points of failure |
|---|---|---|---|
| Crystal | Cut, Surf (Feraligatr, *Miltank*), Strength, Flash (**Ampharos**, Umbreon, Espeon), Whirlpool, Rock Smash TM, Headbutt TM | **Fly: nobody. Waterfall: nobody** (Feraligatr can't learn Waterfall until Gen 3. VERIFIED (2)) | Whirlpool = Feraligatr |
| FireRed | all 7 (+ Dive) | — | Fly = Charizard; Surf/Waterfall = Blastoise |
| Emerald | all 8 incl. Dive & Flash; Secret Power (secret bases) = everyone | — | Fly = Altaria |
| Platinum | Cut, Surf (Weavile, Garchomp), Strength, Rock Smash, Rock Climb, Flash TM | **Fly: nobody. Defog: nobody. Waterfall: nobody.** Waterfall is *believed* required to reach the League | — |
| SoulSilver (provisional six) | all 8 | — | **Fly = Dragonite only**; Rock Climb = Infernape/Empoleon only |
| HeartGold | **all 8** | only TM70 Flash (optional TM) | Fly = Crobat; Waterfall = Lapras |

> *Design note:* Garchomp can't learn HM Fly on any Gen 4 cartridge, but its own Pokédex says *"It flies at sonic speed"* (Diamond) and *"at speeds equal to a jet fighter plane"* (Pearl). The **Platinum** entry adds that its wings *"create blades of wind that can fell nearby trees"*, a field function written into this team's own game. (Dex text VERIFIED via PokeAPI flavor-text table.) Typhlosion can't learn TM Flash. That its flames could light a cave is my *interpretation*: its dex entries describe heat haze and explosions, not light. **These are the cleanest examples in the project of "cartridge requirement ≠ world function"** (handoff §12.5).

## 6. Acquisition / provenance on an unmodified cartridge

| Game | Members needing a trade or special path |
|---|---|
| Crystal | **Ampharos: the Mareep line doesn't exist in Crystal's wild, gift, NPC-trade or Odd Egg data (VERIFIED: ROM disassembly + PokeAPI).** Trade from Gold/Silver only. Espeon + Umbreon: Bill gives one Eevee. The second comes from breeding Eevee × Ditto (Routes 34/35) |
| FireRed | 4 of 6: the two non-chosen starters (need a trade to get a breeding parent); **Alakazam and Machamp evolve only by trade** |
| Emerald | **Arcanine: Growlithe isn't in Emerald; it's FireRed-exclusive** → trade from FireRed. Meganium: postgame Birch gift (requirement: verify) |
| Platinum | none: all six obtainable in one save |
| SoulSilver (provisional) | **Infernape and Empoleon: no Sinnoh starters exist in HGSS** → trade from a Sinnoh game. Gengar and Scizor evolve by trade |
| HeartGold | **none. All six, plus every breeding source above, exist in one HeartGold save** |

> *Design note:* the data supports HeartGold's thesis in a way nobody designed on purpose. It is the only chapter that is **fully self-sufficient**: every HM covered, every member and every lineage source found inside one save, zero trades. Separately, **an Infernape in SoulSilver is necessarily a Sinnoh immigrant**, which bears directly on the open question of whether a repeated species is the same individual.

## 7. Era traps the engine must model (and the legacy sheet couldn't)

1. **Gen 2–3 physical/special split by type** (`types.damage_class_id`): Feraligatr's Water moves are *special* in Crystal (79 SpA vs 105 Atk). Absol's Dark moves are *special* in Emerald (130 Atk / 75 SpA). Altaria's Dragon Claw is *special* in Emerald. Ghost is *physical* in Gen 3.
2. **Gen 2 has no natures or abilities**; it uses DVs (0–15) and Stat Exp, and gender/shininess derive from DVs. Any Crystal row with Nature/Ability/IV/EV columns is a schema error.
3. **Gen 3–4 PID/IV coupling** for non-egg encounters: a starter or static Pokémon with a chosen nature *and* 6×31 IVs may not exist. A flat `31/31/31/31/31/31` cell means nothing without an encounter type. PKHeX knows which spreads exist.
4. **Gen 2–4 inheritance rules** differ from modern ones: egg moves come from the father only; the father's TM/HM moves pass if the baby can learn them; level-up moves known by both parents pass. Light Ball → Volt Tackle.
5. PokeAPI's evolution table mixes eras (e.g., Magnezone by Thunder Stone and Milotic by Prism Scale are Gen 5+). Filter by era.

## 8. Data-source gaps (proof that no single source is enough)

- Gift encounters with special moves (Dragon's Den ExtremeSpeed) are absent from both learnset datasets.
- Story-mandatory HM requirements are in no dataset.
- My own memory was wrong once (Crystal Mareep); the ROM settled it. **This is exactly why the app must never let an LLM's recall stand in for a source.**
