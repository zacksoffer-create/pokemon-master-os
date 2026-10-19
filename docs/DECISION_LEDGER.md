# Decision Ledger

Append-only. Never edit a past row's meaning; supersede it with a new row. IDs are stable references.
**Source key:** `H§n` = master handoff section n (recovered conversation context, not verbatim transcripts) · `V3` = Pokemon Master Spreadsheet v3 · `S` = this session.
Exact dates are given where the handoff gives them; `2026-07` means "July 2026, day not recovered."

| ID | Date | Subject | Decision | Status | Author | Source | Supersedes |
|---|---|---|---|---|---|---|---|
| D-001 | 2025-12 | All six rosters as in v3 `Canon Builds` | historical drafts | ARCHIVE | — | V3; H§19.3 | — |
| D-002 | ≤2026-07 | Crystal roster: Feraligatr · Miltank · Donphan · Ampharos · Umbreon · Espeon | established | WORKING CANON | Zack | H§6 | D-001 (Lapras) |
| D-003 | ≤2026-07 | FireRed roster: Charizard · Blastoise · Venusaur · Alakazam · Jolteon · Machamp | established | WORKING CANON | Zack | H§7 | D-001 (Snorlax) |
| D-004 | ≤2026-07 | Emerald roster: Swampert · Milotic · Altaria · Arcanine · Absol · Meganium | established | WORKING CANON | Zack | H§8 | D-001 (Metagross, Gardevoir) |
| D-005 | ≤2026-07 | Platinum roster: Infernape · Weavile · Roserade · Lucario · Garchomp · Magnezone | established | WORKING CANON | Zack | H§9 | D-001 (Empoleon) |
| D-006 | ≤2026-07 | **HeartGold roster: Typhlosion · Tyranitar · Mamoswine · Crobat · Lapras · Snorlax** | **sacred; do not reopen** | **LOCKED** | Zack | H§10 | D-001 (Milotic, Scizor) |
| D-007 | 2026-07 | Former SoulSilver six: Pikachu · Dragonite · Gyarados · Empoleon · Gengar · Scizor, concept "Everything you do matters, and it is all wrong" | historical | ARCHIVE | Zack | H§11.1 | — |
| D-008 | 2026-07-14 | **SoulSilver wiped; all incumbency removed; every eligible non-legendary Gen I–IV Pokémon except HeartGold's six may be considered** | process rule | LOCKED | Zack | H§11.2 | D-007 |
| D-009 | 2026-07 | SoulSilver reinterpreted: veteran, soulful, Brady-like, "We've been here before / Show us anything. We have an answer," equal in stature to HeartGold | philosophy | WORKING CANON | Zack | H§3, §11.2 | the cold-control reading |
| D-010 | 2026-07-16 | SoulSilver rough starting six: Pikachu · Dragonite · Infernape · Empoleon · Gengar · Scizor | **starting point, not a lock** | PROVISIONAL | Zack | H§11.4 | — |
| D-011 | 2026-07 | Scizor-as-equipment-carrier | **half-thought; don't run with it** | PROVISIONAL (fenced) | Zack | H§11.5 | — |
| D-012 | 2026-07 | Typhlosion keeps Extrasensory; preferred set Flamethrower / Extrasensory / Thunder Punch / Earthquake; **Focus Blast not wanted** | direct preference | WORKING (moves); nature open | Zack | H§10.1 | earlier Sunny Day/SolarBeam and Eruption/HP sets |
| D-013 | 2026-07-14 | HeartGold moves: Tyranitar DD/Crunch/EQ/Outrage + Lum Berry · Crobat Fly/Roost/U-turn/Toxic · Lapras Surf/Ice Beam/Rest/Heal Bell · Snorlax Body Slam/Rest/Thunder Punch/Zen Headbutt | strong proposed directions | PROPOSED (not confirmed) | review | H§10.1 | — |
| D-014 | 2026-07-14 | Mamoswine: Ice Shard over Hail | proposed improvement | PROPOSED | review | H§10.1 | — |
| D-015 | 2026-07 | Infernape (Platinum): Close Combat / Flamethrower / Mach Punch / Thunder Punch | accepted working set | WORKING | Zack | H§9 | V3 Grass Knot/U-turn set |
| D-016 | 2026-07 | Garchomp (Platinum): EQ / Dragon Claw / Fire Fang / Poison Jab; 4th slot still evaluative | working direction | WORKING | Zack | H§9 | V3 Outrage/Stone Edge set |
| D-017 | 2026-07 | Garchomp Aqua Tail **rejected**: "versatility and another coverage option were weaker than making the opponent's decisions costly" | rejected | REJECTED | Zack | H§9 | — |
| D-018 | 2026-07 | Field-function policy (team covers HMs; Surf & Fly universal minimums; no HM slaves; cartridge ≠ world) | rule, "going forward to every team" | WORKING CANON | Zack | H§12 | — |
| D-019 | 2026-07 | Rival final six: Nidoking (constant) · Kingdra (Crystal) · Houndoom (FireRed) · Metagross (Emerald) · Gliscor (Platinum) · Salamence (SoulSilver) | canonical | WORKING CANON | Zack | H§17 | older Aerodactyl/Heracross drafts |
| D-020 | 2025-12 | "HeartGold (Danny)": Raichu · Torterra · Combusken · Breloom · Flygon · Buizel | separate character, archival | ARCHIVE | — | V3; H§18 | — |
| D-021 | 2026-07 | Brainstorm foundational members in **groups of two or three**; no shotgun full-roster swaps | process preference | WORKING CANON | Zack | H§4, §11.4 | — |
| D-022 | 2026-10-07 | App decomposition (Rules Engine / Personal Canon / Journey & Companion / Workbench) + model Species → Companion → Membership → Build → MoveDecision | promising direction | PROPOSED | assistant | H§20 | — |
| D-023 | 2026-10-19 | Zack has **PKHeX** and can create and import custom Pokémon | fact about tooling; policy open (Q2) | RECORDED | Zack | S | — |

## Evidence recorded this session (mechanical facts, not decisions)

| ID | Claim | Verdict |
|---|---|---|
| E-001 | Crystal and Platinum sixes have no Fly learner and no Waterfall learner; Platinum also has no Defog learner | VERIFIED (PokeAPI + Showdown) |
| E-002 | HeartGold six covers all 8 HGSS HMs; all members and breeding sources obtainable in one HG save | VERIFIED (PokeAPI) |
| E-003 | Typhlosion Extrasensory is an HGSS-only Cyndaquil egg move → a legal Extrasensory Typhlosion isn't the Elm starter | VERIFIED (2) |
| E-004 | Thunder Punch on Infernape (Platinum): tutor and egg both legal | VERIFIED (2) |
| E-005 | Tyranitar Outrage obtainable from the HGSS tutor; Dragon Dance requires a 2-step egg chain | VERIFIED (2) |
| E-006 | Mamoswine Ice Shard: Swinub Lv28 only in Gen 4; not relearnable after evolving | VERIFIED (2) |
| E-007 | Swampert Refresh: Mudkip egg move; Milotic learns Refresh at Lv15 (legal father) | VERIFIED (ROM) |
| E-008 | Mareep line not obtainable in Crystal except by trade | VERIFIED (ROM + PokeAPI) |
| E-009 | Growlithe absent from Emerald; FireRed-exclusive | VERIFIED (PokeAPI) |
| E-010 | No Sinnoh starters in HGSS → SoulSilver Infernape/Empoleon arrive by trade | VERIFIED (PokeAPI; knowledge) |
| E-011 | Dragon's Den ExtremeSpeed Dratini not represented in either learnset dataset | UNVERIFIED → PKHeX |
