"""Wilderness engine: what a team can do in the lived world — travel, light, warmth, food,
healing, safety, labor, town life — and which real situations it's ready for.

Evidence is tiered and never blended:
  cartridge  what the game actually lets the Pokémon do outside battle (field moves, overworld abilities)
  lore       its own Pokédex text, quoted (a candidate until approved)
  inference  type, size and habitat (weakest; a starting point for authoring)
  authored   Zack's approved world (fed in from canon; empty until decisions exist)
"""
import json
import os
import re
from dataclasses import dataclass

import rules
from refdb import Ref

CAPABILITIES = {
    "movement": {"climbing": "mountains, cliffs, waterfalls", "water_travel": "carrying the trainer across water",
                 "underwater": "travel beneath the surface", "air_travel": "flying the trainer",
                 "night_travel": "moving safely in darkness"},
    "environment": {"light": "light in caves and at night", "heat_source": "fire and warmth",
                    "cold_tolerance": "working in snow and ice", "weather_handling": "fog, sand, hail"},
    "sustenance": {"foraging": "finding items, food or Pokémon", "food_source": "producing food",
                   "cooking": "preparing food", "field_healing": "healing a teammate outside battle"},
    "shelter": {"camp_making": "making a base or shelter", "egg_care": "keeping eggs warm"},
    "safety": {"scouting": "seeing far or through obstacles", "danger_sense": "sensing danger early",
               "deterrence": "keeping wild Pokémon away", "rescue": "saving people in trouble",
               "escape": "getting everyone out fast"},
    "labor": {"hauling": "moving heavy things", "digging": "digging and tunneling",
              "clearing": "clearing trees and rocks", "carrying_rider": "carrying a person"},
    "social": {"town_fit": "living comfortably in towns", "calming_presence": "a gentle, steadying presence"},
}
ALL_CAPS = {c for group in CAPABILITIES.values() for c in group}

# Field moves usable outside battle, per game (cartridge tier).
FIELD_MOVES = {
    "Cut": ("clearing", "cuts small trees"), "Fly": ("air_travel", "flies the trainer to any visited town"),
    "Surf": ("water_travel", "carries the trainer across water"), "Strength": ("hauling", "pushes boulders"),
    "Flash": ("light", "lights dark caves"), "Whirlpool": ("water_travel", "crosses whirlpools"),
    "Waterfall": ("climbing", "climbs waterfalls"), "Rock Smash": ("clearing", "breaks boulders"),
    "Headbutt": ("foraging", "shakes Pokémon out of trees"), "Dive": ("underwater", "dives to the seafloor"),
    "Rock Climb": ("climbing", "climbs rock walls"), "Defog": ("weather_handling", "clears fog"),
    "Dig": ("escape", "digs out of a cave to its entrance"), "Teleport": ("escape", "returns to the last Pokémon Center"),
    "Soft-Boiled": ("field_healing", "gives its own HP to a teammate"),
    "Milk Drink": ("field_healing", "gives its own HP to a teammate"),
    "Sweet Scent": ("foraging", "draws out wild Pokémon"), "Secret Power": ("camp_making", "opens a secret base"),
}
COMMON = {"Cut", "Fly", "Surf", "Strength", "Flash", "Rock Smash", "Waterfall", "Dig", "Teleport",
          "Soft-Boiled", "Milk Drink", "Sweet Scent"}
GAME_FIELD_MOVES = {
    "crystal": COMMON | {"Whirlpool", "Headbutt"},
    "firered": COMMON,
    "emerald": COMMON | {"Dive", "Secret Power"},
    "platinum": COMMON | {"Defog", "Rock Climb"},
    "heartgold": COMMON | {"Whirlpool", "Rock Climb", "Headbutt"},
    "soulsilver": COMMON | {"Whirlpool", "Rock Climb", "Headbutt"},
}
# Abilities with an overworld effect (cartridge tier). Most began in Emerald; FireRed has few.
FIELD_ABILITIES = {
    "Pickup": ("foraging", "finds items after battles"), "Honey Gather": ("foraging", "finds Honey"),
    "Flame Body": ("egg_care", "eggs hatch in half the steps"), "Magma Armor": ("egg_care", "eggs hatch in half the steps"),
    "Intimidate": ("deterrence", "fewer encounters with weaker wild Pokémon"),
    "Keen Eye": ("deterrence", "fewer encounters with weaker wild Pokémon"),
    "Stench": ("deterrence", "halves wild encounters"), "White Smoke": ("deterrence", "halves wild encounters"),
    "Sand Veil": ("weather_handling", "fewer encounters in sandstorms"),
    "Snow Cloak": ("weather_handling", "fewer encounters in hail"),
    "Illuminate": ("foraging", "draws wild Pokémon out more often"),
    "Suction Cups": ("foraging", "fish bite more readily"), "Sticky Hold": ("foraging", "fish bite more readily"),
    "Static": ("foraging", "draws out Electric-types"), "Magnet Pull": ("foraging", "draws out Steel-types"),
}
ABILITY_FIELD_GAMES = {"emerald", "platinum", "heartgold", "soulsilver"}   # FireRed: Pickup only (believed)
LORE_PATTERNS = {
    "rescue": r"\brescu|guides? .{0,30}to (?:shore|safety)|saves? (?:people|drowning)",
    "light": r"\blight\b|\bglow|\bshin(?:e|es|ing)\b|illuminat|\bbright",
    "air_travel": r"\bfl(?:y|ies|ying)\b|\bsoar",
    "water_travel": r"\bswim|\bseas?\b|\bocean|ferr(?:y|ies)|carr(?:y|ies) people",
    "hauling": r"\bcarr(?:y|ies)\b|\bhaul|\blift",
    "digging": r"\bdig|\bburrow|\btunnel",
    "heat_source": r"\bheat\b|\bwarmth\b|\bhot\b|\bflames?\b",
    "cold_tolerance": r"\bcold\b|\bsnow|\bice\b|\bfreez",
    "danger_sense": r"\bsens(?:e|es|ing)\b|\bpredict|\bdisaster|\bdanger",
    "scouting": r"through walls|\bkeen\b|far away|\bdistan",
    "calming_presence": r"\bcalm\b|\bgentle\b|\bkind(?:hearted)?\b|\bsooth",
    "food_source": r"\bmilk\b|\bnutriti|\bhoney\b",
    "cooking": r"\broast|\bcook|\bbak(?:e|es)\b",
    "field_healing": r"\bheal|\bcures?\b|\brestor",
    "night_travel": r"\bnight\b|\bin the dark|\bdarkness\b",
}
# A sentence that matches one of these is not evidence for the capability ("steals heat", "turned warm").
LORE_EXCLUDE = {
    "heat_source": r"(?:steal|absorb)\w* .{0,25}heat|\bcool",
}
GAME_VERSIONS = {"crystal": [6, 4, 5], "firered": [10, 11, 9], "emerald": [9, 7, 8], "platinum": [14, 12, 13],
                 "heartgold": [15, 16, 14], "soulsilver": [16, 15, 14]}
GEN24_VERSIONS = list(range(4, 17))
SCENARIOS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenarios.json")
DEFAULT_SCENARIOS = {
    "Mountain storm crossing": ["climbing", "cold_tolerance", "weather_handling", "light", "heat_source", "rescue"],
    "Open-sea crossing": ["water_travel", "rescue", "light", "scouting"],
    "A week at camp": ["foraging", "food_source", "cooking", "heat_source", "deterrence", "field_healing",
                       "calming_presence"],
    "Cave expedition": ["light", "clearing", "hauling", "escape", "digging"],
    "Emergency far from town": ["field_healing", "air_travel", "rescue", "escape"],
    "Night travel": ["night_travel", "light", "scouting", "danger_sense"],
    "Living in town": ["town_fit", "calming_presence"],
}


def load_scenarios():
    """Situations live in scenarios.json so they can be edited without touching code."""
    if os.path.exists(SCENARIOS_FILE):
        return json.load(open(SCENARIOS_FILE, encoding="utf-8"))["scenarios"]
    return DEFAULT_SCENARIOS


SCENARIOS = load_scenarios()
TIER_RANK = {"authored": 4, "cartridge": 3, "lore": 2, "inference": 1}


@dataclass
class Evidence:
    capability: str
    tier: str
    source: str
    detail: str


class WildernessEngine:
    def __init__(self, db_path, authored=None, proposals=None):
        self.ref = Ref(db_path)
        self.authored = authored or {}     # {(game, species): [Evidence]} from approved canon
        self.proposals = proposals or []   # pending world records, shown but never counted

    def _knows_or_can_learn(self, species, move, game):
        try:
            return bool(self.ref.learn(species, move, rules.GAME_VG[game])["routes"])
        except KeyError:
            return False

    def evidence(self, species, game):
        gen = rules.GAME_GEN[game]
        out = list(self.authored.get((game, species), []))
        for mv in sorted(GAME_FIELD_MOVES[game]):
            if self._knows_or_can_learn(species, mv, game):
                cap, what = FIELD_MOVES[mv]
                out.append(Evidence(cap, "cartridge", f"{mv} (field move)", what))
                if mv == "Waterfall":
                    out.append(Evidence("water_travel", "cartridge", "Waterfall (field move)", what))
                if mv == "Dig":
                    out.append(Evidence("digging", "cartridge", "Dig (field move)", "digs through to the surface"))
        if gen >= 3:
            for ab in rules.abilities(gen, species):
                if ab in FIELD_ABILITIES and (game in ABILITY_FIELD_GAMES or ab == "Pickup"):
                    cap, what = FIELD_ABILITIES[ab]
                    out.append(Evidence(cap, "cartridge", f"{ab} (overworld ability)", what))
        out += self._lore(species, game) + self._inference(species, gen)
        return out

    def _lore(self, species, game):
        sid = self.ref.species_id(species)
        order = GAME_VERSIONS[game] + [v for v in GEN24_VERSIONS if v not in GAME_VERSIONS[game]]
        rows = {int(r["version_id"]): " ".join(r["flavor_text"].split()) for r in self.ref.q(
            "SELECT version_id, flavor_text FROM pokemon_species_flavor_text WHERE species_id=? "
            "AND language_id=9 AND version_id BETWEEN 4 AND 16", sid)}
        names = {int(r["id"]): r["identifier"] for r in self.ref.q("SELECT id, identifier FROM versions")}
        out, seen = [], set()
        for v in order:
            text = rows.get(v)
            if not text:
                continue
            sentences = re.split(r"(?<=[.!?])\s+", text)
            for cap, pat in LORE_PATTERNS.items():
                if cap not in seen and any(re.search(pat, x, re.I) and not re.search(LORE_EXCLUDE.get(cap, "$^"), x, re.I)
                                           for x in sentences):
                    seen.add(cap)
                    out.append(Evidence(cap, "lore", f"Pokédex ({names[v]})", text))
        return out

    def _inference(self, species, gen):
        sid = self.ref.species_id(species)
        row = self.ref.q("SELECT height, weight FROM pokemon WHERE id=?", sid)[0]
        h, w = int(row["height"]) / 10, int(row["weight"]) / 10
        types = rules.species(gen, species)["types"]
        out = []
        if "Fire" in types:
            out.append(Evidence("heat_source", "inference", "Fire type", "a living source of heat"))
        if "Ice" in types:
            out.append(Evidence("cold_tolerance", "inference", "Ice type", "at home in the cold"))
        if h >= 1.5 and w >= 60:
            out.append(Evidence("carrying_rider", "inference", f"{h} m, {w} kg", "big enough to carry a person"))
        if h <= 1.2 and w <= 60:
            out.append(Evidence("town_fit", "inference", f"{h} m, {w} kg", "small enough for houses and towns"))
        hab = self.ref.q("SELECT h.identifier FROM pokemon_species s JOIN pokemon_habitats h "
                         "ON h.id=s.habitat_id WHERE s.id=?", sid)
        if hab:
            habitat = hab[0][0]
            cap = {"mountain": "climbing", "cave": "light", "rough-terrain": "climbing", "sea": "water_travel",
                   "waters-edge": "water_travel", "forest": "foraging", "grassland": "foraging",
                   "urban": "town_fit"}.get(habitat)
            if cap:
                out.append(Evidence(cap, "inference", f"habitat: {habitat}", "native terrain (Gen 3 Pokédex habitat)"))
        return out

    def team_report(self, team):
        per_member = {m.species: self.evidence(m.species, team.game) for m in team.members}
        caps = {}
        for sp, evs in per_member.items():
            for e in evs:
                best = caps.setdefault(e.capability, {}).get(sp)
                if best is None or TIER_RANK[e.tier] > TIER_RANK[best.tier]:
                    caps[e.capability][sp] = e
        summary = {}
        for cap in sorted(ALL_CAPS):
            holders = caps.get(cap, {})
            top = max((TIER_RANK[e.tier] for e in holders.values()), default=0)
            summary[cap] = {"holders": {sp: f"{e.tier}: {e.source}" for sp, e in holders.items()},
                            "strength": {4: "authored", 3: "cartridge", 2: "lore only", 1: "inference only"}.get(top, "GAP"),
                            "single_point": len([e for e in holders.values() if TIER_RANK[e.tier] >= 3]) == 1}
        scenarios = {}
        for name, needs in SCENARIOS.items():
            scenarios[name] = {
                "ready": [c for c in needs if summary[c]["strength"] in ("authored", "cartridge")],
                "story_only": [c for c in needs if summary[c]["strength"] in ("lore only", "inference only")],
                "gaps": [c for c in needs if summary[c]["strength"] == "GAP"]}
        names = {m.species for m in team.members}
        pending = [p for p in self.proposals if p["game"] == team.game and p["species"] in names]
        return {"capabilities": summary, "scenarios": scenarios, "evidence": per_member, "proposals": pending}
