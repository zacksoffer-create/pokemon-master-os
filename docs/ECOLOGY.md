# Ecosystems and food webs (v1, D-077)

Zack: *"let's talk about ecosystems and food webs and creating something actually based on biological
principles."* Johto in HeartGold and SoulSilver is built in three levels, from `engine/biology/ecology.py` and
`engine/biology/johto.json`. The calls behind it are A-63 to A-68 in `docs/design/ASSUMPTIONS.md`.

## The landscape

`johto.json` holds every Johto place as a node, joined as the games' map joins them (path, cave, sea: class
mechanic). Each place has a biome, an elevation band, its water and a position on the drawing, all Blackthorn's
reading. There are two flagship ecosystems:
- **Ilex Forest.**
- **The Blackthorn highlands:** Ice Path, Blackthorn City, Dragon's Den, Route 44, Route 45 and Dark Cave.

## Level 1: reconstruction

Each place's community comes from the encounter tables, HeartGold and SoulSilver merged, with version-only species
flagged:
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

Geothermal heat is nowhere by default.

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
- **The highlands** keep 39%. It's an energy-poor alpine and cave system fed from outside, and most of its Pokémon
  links are hypotheses.

These results show what the assumptions imply, not what Johto does.
