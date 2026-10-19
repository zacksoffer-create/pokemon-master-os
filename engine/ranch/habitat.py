"""Habitat engine: what land, climate and water a species needs, and how big it is.

Evidence (never blended): the Gen 3 Pokédex habitat (Gen 1-3 species; Gen 4 species inherit their
evolution line's), type-driven climate and terrain, size from height/weight, and Pokédex lore.
"""
import re
from dataclasses import dataclass, field

import rules
from refdb import Ref

ZONES = {
    "meadow": "open grassland and pasture", "forest": "woodland and orchard",
    "highlands": "mountains, cliffs and rocky ground", "caverns": "caves and underground",
    "volcanic": "geothermal ground and hot springs", "snowfield": "glacier, snow and ice",
    "wetland": "marsh and bog", "lakes_rivers": "fresh water: lakes, rivers, waterfalls",
    "coast_sea": "coast, open sea and reef", "skies": "aeries and high perches",
    "sanctuary": "quiet ruins, shrine and night garden", "homestead": "the house, yards and human spaces",
}
HABITAT_ZONE = {"cave": "caverns", "forest": "forest", "grassland": "meadow", "mountain": "highlands",
                "rare": "sanctuary", "rough-terrain": "highlands", "sea": "coast_sea", "urban": "homestead",
                "waters-edge": "lakes_rivers"}
TYPE_ZONE = {"Fire": "volcanic", "Ice": "snowfield", "Grass": "forest", "Bug": "forest", "Ground": "highlands",
             "Rock": "highlands", "Flying": "skies", "Ghost": "sanctuary", "Psychic": "sanctuary",
             "Dark": "sanctuary", "Poison": "wetland", "Dragon": "highlands", "Steel": "highlands",
             "Electric": "homestead", "Fighting": "meadow", "Normal": "meadow"}
LORE_ZONE = {"coast_sea": r"\bseas?\b|\bocean|\breef", "lakes_rivers": r"\blakes?\b|\brivers?\b|\bponds?\b|waterfall",
             "highlands": r"\bmountain|\bcliffs?\b|\bpeaks?\b", "caverns": r"\bcaves?\b|underground",
             "snowfield": r"\bsnow|\bglaci|\bicy\b|\bfrozen", "volcanic": r"\bvolcan|\bmagma|\blava",
             "forest": r"\bforests?\b|\bwoods\b|\btrees?\b", "skies": r"\bsky\b|\bclouds?\b|\bsoar"}
REGION = {1: "Kanto", 2: "Johto", 3: "Hoenn", 4: "Sinnoh"}


@dataclass
class Habitat:
    species: str
    native_region: str
    zones: list                 # ordered: primary first
    climate: str                # "warm" / "cold" / "any"
    water: str                  # "none" / "fresh" / "sea"
    size: str                   # small / medium / large / huge
    height_m: float
    weight_kg: float
    evidence: list = field(default_factory=list)


class HabitatEngine:
    def __init__(self, db_path):
        self.ref = Ref(db_path)

    def _habitat(self, sid):
        for s in self.ref.line(sid):           # Gen 4 species inherit the line's Gen 3 habitat
            r = self.ref.q("SELECT h.identifier FROM pokemon_species s JOIN pokemon_habitats h ON h.id=s.habitat_id "
                           "WHERE s.id=?", s)
            if r:
                return r[0][0], self.ref.name(s)
        return None, None

    @staticmethod
    def size_class(h, w):
        if h <= 1.0 and w <= 40:
            return "small"
        if h <= 2.0 and w <= 150:
            return "medium"
        if h <= 3.5 and w <= 400:
            return "large"
        return "huge"

    def profile(self, species, gen=4):
        sid = self.ref.species_id(species)
        types = rules.species(gen, species)["types"]
        row = self.ref.q("SELECT height, weight FROM pokemon WHERE id=?", sid)[0]
        h, w = int(row["height"]) / 10, int(row["weight"]) / 10
        native = REGION[int(self.ref.q("SELECT generation_id FROM pokemon_species WHERE id=?", sid)[0][0])]
        zones, evidence = [], []
        hab, via = self._habitat(sid)
        if hab:
            zones.append(HABITAT_ZONE[hab])
            evidence.append(f"Pokédex habitat: {hab}" + (f" (via {via})" if via != self.ref.name(sid) else ""))
        for t in types:
            z = TYPE_ZONE.get(t)
            if t == "Water":
                z = "coast_sea" if hab == "sea" else "lakes_rivers"
            if z and z not in zones:
                zones.append(z)
                evidence.append(f"{t} type")
        lore = " ".join(" ".join(r[0].split()) for r in self.ref.q(
            "SELECT flavor_text FROM pokemon_species_flavor_text WHERE species_id=? AND language_id=9 "
            "AND version_id BETWEEN 4 AND 16", sid))
        for z, pat in LORE_ZONE.items():
            if z not in zones and re.search(pat, lore, re.I):
                zones.append(z)
                evidence.append(f"Pokédex lore mentions {z.replace('_', ' ')}")
        climate = "warm" if "Fire" in types else "cold" if "Ice" in types else "any"
        water = "sea" if "coast_sea" in zones[:2] and "Water" in types else "fresh" if "Water" in types else "none"
        return Habitat(self.ref.name(sid), native, zones, climate, water, self.size_class(h, w), h, w, evidence)
