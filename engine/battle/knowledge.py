"""The knowledge layer's people (scouting engine, layer 1): a Combatant is everything the battle needs to know about
one Pokémon, and a field is the set of Combatants a team is measured against.

A Combatant comes from a build (canon/builds.json, a lineup character, a Showdown paste) or from Smogon's usage
stats. Whatever a build leaves open is filled with a documented default, and the Combatant records which defaults it
used, so a report can say "assumed". The defaults are "at the peak of its powers" (D-043's what-if question):

| Field | Default | Why |
|---|---|---|
| level | 100 | the peak; the usage field is Lv 100 too |
| IVs | 31 (Gen 2 DVs 15) | the peak; the field runs the same |
| EVs, Gen 3-4 | 85 in every stat (510 total) | a Pokémon that battled a whole journey has full EVs; nothing records where they went, so they're spread evenly instead of guessed |
| stat experience, Gen 2 | maxed (the calculator's default) | the same reasoning; Gen 2 stat experience isn't capped by a total |
| nature | neutral (Serious) | nothing on record |
| ability | the species' first ability | the same rule the battle engine already uses, flagged when a species has two |
| item | none | nothing on record |
| moves | the build's; open slots get the scouting engine's strongest set (D-024: its best reliable STAB, the attacks adding the most new super-effective types, then its best setup or recovery move) | nothing on record |
"""
import json
import os
from dataclasses import dataclass, field

import rules

HERE = os.path.dirname(os.path.abspath(__file__))
SMOGON = os.path.join(os.path.dirname(HERE), "data", "raw", "smogon")
STATS = ("hp", "atk", "def", "spa", "spd", "spe")
EVEN_EVS = {s: 85 for s in STATS}
FIELD_SOURCE = "Showdown Usage"     # the one set per species in @smogon/sets' MIT "stats" source


@dataclass
class Combatant:
    species: str
    gen: int
    moves: list
    level: int = 100
    ability: str = None
    item: str = None
    nature: str = None
    evs: dict = None
    ivs: dict = None
    ai: tuple = ()                       # a game's trainer: its AI flags (battle/trainer_policy.py picks its moves)
    name: str = ""                       # a label: "Tyranitar (HeartGold)", "Snorlax (gen4ou usage)"
    source: str = ""
    assumed: list = field(default_factory=list)

    @property
    def key(self):
        """Identifies the battle-relevant spec (two Combatants with the same key fight the same)."""
        return json.dumps([self.species, self.gen, self.level, self.ability, self.item, self.nature, self.evs,
                           self.ivs, sorted(self.moves)] + ([sorted(self.ai)] if self.ai else []), sort_keys=True)

    def calc(self):
        """The spec the damage calculator takes."""
        out = {"species": self.species, "level": self.level}
        for k in ("ability", "item", "nature", "evs", "ivs"):
            if getattr(self, k):
                out[k] = getattr(self, k)
        return out

    @property
    def types(self):
        return rules.species(self.gen, self.species)["types"]


def from_build(gen, species, build, fill=None, level=100, name="", source=""):
    """A Combatant from a build dict (moves, nature, ability, item, evs, ivs, level), filling the documented defaults.
    `fill(species, rejected)` gives the engine's strongest set (the scouting engine's D-024 rule) for open slots."""
    sp = rules.species(gen, species)["name"]
    assumed = []
    moves = list(build.get("moves") or [])
    if len(moves) < 4 and fill:
        extra = [m for m in fill(sp, build.get("rejected", [])) if m not in moves][:4 - len(moves)]
        if extra:
            assumed.append("moves: the engine's strongest set (nothing on record)" if not moves else
                           f"moves {len(moves) + 1}-4: filled in from the engine's strongest set")
        moves += extra
    if not moves:
        raise ValueError(f"{sp} has no moves on record and nothing was given to fill them")
    level = build.get("level") or level
    if not build.get("level") and level == 100:
        assumed.append("level 100 (the peak)")
    ivs = build.get("ivs")
    if not ivs:
        assumed.append("IVs 31" if gen >= 3 else "DVs 15")
    evs = build.get("evs")
    if gen >= 3 and not evs:
        evs = dict(EVEN_EVS)
        assumed.append("EVs 85 in every stat")
    nature = build.get("nature") if gen >= 3 else None
    if gen >= 3 and not nature:
        assumed.append("neutral nature")
    ability = build.get("ability") if gen >= 3 else None
    if gen >= 3 and not ability:
        options = rules.abilities(gen, sp)
        ability = options[0] if options else None
        if len(options) > 1:
            assumed.append(f"ability {ability} (could be {', '.join(options[1:])})")
    return Combatant(species=sp, gen=gen, moves=moves, level=level, ability=ability, item=build.get("item"),
                     nature=nature, evs=evs, ivs=ivs, name=name or sp, source=source, assumed=assumed)


def usage_field(gen, fmt=None):
    """The usage field: one Combatant per species, each the most-used set in that generation's OU on Showdown."""
    fmt = fmt or f"gen{gen}ou"
    with open(os.path.join(SMOGON, f"gen{gen}_usage_sets.json"), encoding="utf-8") as fh:
        book = json.load(fh)[fmt]
    out = []
    for species, sets in sorted(book.items()):
        s = sets.get(FIELD_SOURCE) or next(iter(sets.values()))
        out.append(Combatant(
            species=rules.species(gen, species)["name"], gen=gen, moves=list(s["moves"]), level=s.get("level", 100),
            ability=s.get("ability"), item=s.get("item"), nature=s.get("nature"),
            evs=({k: s["evs"].get(k, 0) for k in STATS} if s.get("evs") else None), ivs=s.get("ivs"),
            name=f"{species} ({fmt} usage)", source=f"@smogon/sets 2.0.0 stats, {fmt}, {FIELD_SOURCE}"))
    return out


def usage_sets(gen, species, fmt=None):
    """Every usage set recorded for a species in a generation, by format (for the lab's 'what did people run')."""
    with open(os.path.join(SMOGON, f"gen{gen}_usage_sets.json"), encoding="utf-8") as fh:
        book = json.load(fh)
    want = rules.species(gen, species)["name"]
    return {f: sets[want] for f, sets in book.items() if want in sets and (fmt is None or f == fmt)}
