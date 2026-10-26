# Ecosystems and food webs (v1, D-077)

Zack: *"let's talk about ecosystems and food webs and creating something actually based on biological
principles."* Johto and Kanto in HeartGold and SoulSilver are built in three levels, from `engine/biology/ecology.py`,
`engine/biology/johto.json` and `engine/biology/kanto.json`. The calls behind it are A-63 to A-68 in
`docs/design/ASSUMPTIONS.md`; Kanto came with A-66 (Zack: *"HeartGold does both of them."*).

## The landscape

`johto.json` holds every Johto place and `kanto.json` every Kanto place as a node; each node says which region it is
in. The five Kanto places Johto's file already had (Routes 26, 27 and 28, Tohjo Falls and Victory Road) are marked
Kanto. Places are joined as HeartGold's map joins them (class mechanic): paths, caves and sea, plus the Magnet Train
(Goldenrod City to Saffron City) and the S.S. Aqua (Olivine City to Vermilion City). The two regions meet in four
places: those two, the sea east of New Bark Town onto Route 27, and Route 28 onto Mt. Silver.

Some joins needed a judgement:
- **The Pokémon League Reception Gate** isn't a place, so Route 26 is joined straight to Route 22, Route 28 and
  Victory Road, which the gate links.
- **Tohjo Falls** opens onto Route 27. Johto's file had it joined to Route 26; that is fixed.
- **Routes 3 and 4** are joined only through Mt. Moon, and **Routes 5 and 6** through the Underground Path.

Each place has a biome, an elevation band, its water and a position on the drawing, all Blackthorn's reading. For
Kanto these were read from the place's description on the Pokégear map and what its tables hold, and each Kanto
place's note quotes the Pokégear. Positions come from the Pokégear map's own grid, scaled to Johto's drawing, so
**Kanto lies east of Johto, as the games draw it** (the brief said west or south-west; the games and the existing
drawing both put it east).

Five Kanto places have no community: Saffron City, Lavender Town, the Indigo Plateau and the Power Plant have no wild
Pokémon in HeartGold, and Pal Park is managed by people, so it is described, not reconstructed.

There are eight flagship ecosystems:
- **Ilex Forest** (Johto).
- **The Blackthorn highlands** (Johto): Ice Path, Blackthorn City, Dragon's Den, Route 44, Route 45 and Dark Cave.
- **Viridian Forest** (Kanto).
- **Mt. Moon** (Kanto).
- **The Seafoam Islands** (Kanto).
- **Cerulean Cave** (Kanto).
- **The routes around Fuchsia** (Kanto): Routes 12 to 15 and Fuchsia City.
- **Cinnabar and its seas** (Kanto): Cinnabar Island and Sea Routes 19, 20 and 21.

`#/ecosystems` draws both regions on one map, and `?region=johto` or `?region=kanto` draws one.

## Level 1: reconstruction

Each place's community comes from the encounter tables, HeartGold and SoulSilver merged, with version-only species
flagged. Kanto's tables were checked against the HeartGold decomp (pret/pokeheartgold at 6988158), place by place,
for walking, surfing, Rock Smash and fishing (not Headbutt trees, radio or swarms). They agree everywhere but one: the reference data lists Vermilion City's Wingull twice, once without its condition,
where the decomp has it only as a surf swarm. The decomp wins, so Wingull is a visitor there (`CORRECTIONS` in
`ecology.py`).

- **Residents:** Pokémon found there unconditionally. Only residents are in the web.
- **Visitors:** Pokémon that arrive only by radio, swarm, contest, post-game or weekday.
- **The Safari Zone** is managed, so it's described, not reconstructed.
- **Encounter rates** say how often you meet a Pokémon, never how many there are.

The non-Pokémon life a habitat needs by principle is added per biome and labelled:
- **Producers:** trees, leaves, flowers, fruit, moss, algae, phytoplankton, kelp.
- **Detritus:** detritus, deadwood, refuse.
- **Fungi:** the decomposers.
- **Invertebrates:** flying insects, soil, cave and water fauna, zooplankton.
- **Small fish.**
- **Energy:** sun, soil, rock, moonlight, electricity and dreams.

Geothermal heat comes with no biome; it is given by place, and only in two:
- **The Blackthorn highlands:** Zack's call (A-64). The games show no vents or magma there, so it is Blackthorn's
  reading.
- **Cinnabar Island:** the games' own words. The Pokégear says a town used to be there until it was swept away by an
  eruption; the Pokémon Center says it has been a year since the volcano erupted; the radio says the mouth of the
  volcano is still open.

Nowhere else in Kanto. The sea routes around Cinnabar only see the volcano or the rocks it threw, and nothing in the
games makes Mt. Silver volcanic.

## Level 2: the web and its analysis

A consumer's links come from, in order of trust:
1. **its curated dossier**;
2. **its own Pokédex diet** (`claims.py`), mapped to the resources present;
3. **for predators, a rule:** a smaller Pokémon (at most half its mass, at least a thousandth) in the same place,
   active at the same time. These are low-confidence hypotheses, at most four per predator.

Every link carries its evidence class and why. Non-trophic relationships (shelter, materials, pollination,
competition) are kept apart.

The analysis (`analyse()`, with a copy in `web/36_ecology.html`; `app/test_biology.mjs` requires both to agree on
every web):
- **Trophic levels:** prey-averaged. Abiotic energy is 0 and producers are 1.
- **Positions:** who's on top, and who has nothing to eat here.
- **Roles:** producers, herbivores, pollinators, decomposers, predators and energy-eaters, and which of them have
  no Pokémon at all.
- **Keystones by secondary extinction:** remove one, then any consumer whose foods are all gone goes too, round by
  round. You can do this yourself on the page.

## Level 3: a model you can perturb

An allometric trophic network (Brose, Williams and Martinez 2006, after Yodzis and Innes 1992), in the browser only:

```
dB_i/dt = r_i B_i (1 − B_i/K)                                        producers, and detritus fed from outside
        − x_i B_i + Σ_j x_i y_i B_i F_ij − Σ_k x_k y_k B_k F_ki / e_ki   consumers
F_ij = w_ij B_j^q / (B0^q + Σ_l w_il B_l^q)        x_i = a_x (M_i / M_ref)^−0.25 (Kleiber)
```

| Parameter | Value |
|---|---|
| Body mass M | Pokédex weight |
| Metabolic constant a_x | 0.314 for invertebrates (Bugs), 0.88 for ectotherms (fish-shaped), 2.3 for endotherms (the rest) |
| Maximum consumption y | 8 for invertebrates, 4 for vertebrates |
| Assimilation efficiency e | 0.45 on plants and detritus, 0.85 on animals |
| Hill exponent q | 1.2 |
| Half-saturation B0 | 0.5 |
| M_ref | 1 g |

Non-Pokémon groups have nominal masses. Starting biomass follows the encounter rate only to give each population
somewhere to start. Integration is RK4 with dt 0.05. Every parameter is a slider, and you can remove any node.

With the defaults:
- **Ilex Forest** keeps 81% of its Pokémon. Zubat, Psyduck and Magikarp fall out: their foods are the thinnest.
- **The highlands** keep 29%. It's an energy-poor alpine and cave system fed from outside, and most of its Pokémon
  links are hypotheses. It kept 39% before ten more of its species had dossiers, which changed what their links
  rest on.
- **Viridian Forest** keeps 71% and **Mt. Moon** 75%.
- **The routes around Fuchsia** keep 56% and **Cerulean Cave** 53%.
- **Cinnabar and its seas** keep 38% and **the Seafoam Islands** 21%.

These results show what the assumptions imply, not what Johto or Kanto does.
