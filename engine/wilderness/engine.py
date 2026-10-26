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
from specimen import EXCEPTIONS
from refdb import Ref

CAPABILITIES = {
    "movement": {"climbing": "mountains, cliffs, waterfalls", "water_travel": "carrying the trainer across water",
                 "underwater": "travel beneath the surface", "air_travel": "flying the trainer",
                 "night_travel": "moving safely in darkness"},
    "environment": {"light": "light in caves and at night", "heat_source": "fire and warmth",
                    "cold_tolerance": "working in snow and ice", "weather_handling": "fog, sand, hail"},
    "sustenance": {"foraging": "finding items, food or Pokémon", "food_source": "producing food",
                   "cooking": "preparing food", "field_healing": "healing a teammate outside battle",
                   "plant_care": "growing and tending plants"},
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
# Pokédex patterns, one per capability. Every pattern was checked against every Gen II-IV entry the engine reads, with
# what each caught wrongly or missed written up in docs/capability/PATTERN_AUDIT.md (A-42); change one there too.
LORE_PATTERNS = {
    "rescue": r"\brescu|guides? .{0,30}to (?:shore|safety)|\bsav(?:e|es|ed) (?:people|drowning|lost)"
              r"|(?:people|pokémon) who were saved|\bspots? a drowning|beacon for lost",
    "light": r"\bglow(?:s|ed|ing)?\b|\bshin(?:e|es|ing)\b|illuminat|\bbrightly\b|\bbrightens\b|\bbright light\b"
             r"|\blights? up\b|light[- ]emitting|\b(?:flashing|electric) lights\b|\blight (?:on|from) its\b"
             r"|\b(?:emits?|emitting|gives? off|giving off|produces?|releases?|casts?|shoots?|flash(?:es|ing)?|beams? of"
             r"|burst of) (?:\w+ ){0,3}light\b|\b(?:its|[\w-]+'s) light\b(?! (?:pink|blue))|\blight it emits\b|\blight and heat\b",
    "air_travel": r"\bfl(?:y|ies|ying)\b|\bflight\b|\bfl(?:ew|own)\b|\bsoar(?:s|ed|ing)?\b",
    "water_travel": r"\bswim|ferr(?:y|ies)|carr(?:y|ies) (?:people|humans|passengers)|across (?:the )?(?:seas?|oceans?|waters?)\b",
    "hauling": r"\bhaul|\btow(?:s|ed|ing)?\b|twice its (?:own )?weight|lifts and throws|\b(?:lift|lifts|lifting|carr(?:y|ies"
               r"|ying)|transport\w*|drags?|pick up and carry|moving of|piles? up) (?:[\w-]+ ){0,3}(?:heavy|boulders?|rocks?"
               r"|trucks?|cargo|loads?|goods|people|humans?|adult|ships?|logs?|pokémon)\b",
    "digging": r"\bdig(?:s|ging)?\b|\bburrow|\btunnel|\bgoug\w* (?:\w+ ){0,3}holes|\bbor(?:e|es|ing) (?:its way|holes?|a hole"
               r"|tunnels?)|\beat its way through the soil|\bcarves holes",
    "heat_source": r"\bheat\b|\bwarmth\b|\bhot\b|\bflames?\b|\b(?:its|with|the) fire\b|\bfiery\b|\bembers\b|\bignites?\b"
                   r"|\bburn(?:s|ing)? (?:more )?coal",
    "cold_tolerance": r"\bcold\b|\bsnow|\bice\b|\bfreez|\bicy (?:seas?|waters?|ground|mountains?)|\bfrigid\b",
    "danger_sense": r"\bsens(?:e|es|ing)\b|\bpredict|\bforesee|\bdisaster|\bdanger\b(?!ous)|if a storm approaches",
    "scouting": r"through walls|\bkeen (?:eyes|eyesight|sight|vision|senses)|\bsees? (?:far|great distances|for miles|.{0,20}far away)"
                r"|\bspots? .{0,30}from (?:far|high|miles|a distance)|\bdistant (?:sounds|flowers)"
                r"|\b(?:outstanding|superior|sharp|powerful|excellent) (?:vision|eyesight|eyes)\b|\bsee a long way"
                r"|\blookout\b|\bkeeps? watch\b|\bscan wide areas|\bsee in all directions|\b360 degrees",
    "calming_presence": r"\bcalm\b|\bbecalm\w*|\bgentle\b|\bkind(?:hearted|ly|ness)?\b|\bsooth|\brelax(?:es|ing)\b|\bdocile\b"
                        r"|\bfriendly\b",
    "food_source": r"\bmilk\b|\b(?:delicious|nutriti\w*|tasty) (?:\w+ ){0,2}(?:eggs?|fruits?|juices?)\b"
                   r"|\b(?:eggs?|fruits?|berries) (?:[\w-]+ ){0,4}(?:delicious|nutriti\w*)|\bshares? (?:an |its |the )?eggs?\b"
                   r"|\bgrows? (?:\w+ ){0,2}(?:berries|fruits?)\b|\b(?:berries|fruits?) (?:that )?(?:grows?|growing) (?:\w+ ){0,3}"
                   r"(?:on|around)\b|\bis (?:\w+ ){0,3}tasty\b|\b(?:collects?|collecting|gathers?|makes?|concocts?|produces?"
                   r"|delivers?|carries) (?:\w+ ){0,3}honey\b|\bsecretes honey\b|\bsugary syrup",
    "cooking": r"\broast|\bcook|\bbak(?:e|es)\b|\bferment|\bto make a drink",
    "field_healing": r"\bheal(?:s|ed|ing)?\b|\bcures?\b|\brestor\w* (?:\w+ ){0,2}health|\bback to health|\bnurs(?:e|es|ing)\b"
                     r"|\bwith injured|\bfor the sick",
    "night_travel": r"\bnights?\b|\bin the (?:\w+ )?dark|\bdarkness\b|\bnocturnal\b",
    "plant_care": r"revive (?:dead )?(?:grass|plants|flowers)|scatters pollen|\bplants? trees\b|\bgrows? (?:trees|plants|crops)\b"
                  r"|\b(?:grass|trees|plants|flowers)(?: and \w+)? flourish|\braises the trees|\b(?:sows?|sowing|scatters?)"
                  r" (?:its )?seeds|\btilled\b|ideal for planting|into a lush field",
}
# A sentence that matches one of these is not evidence for the capability ("steals heat", "wings not used for flying",
# "sense of smell" is tracking, not danger sense, sleeping at night isn't moving in the dark).
LORE_EXCLUDE = {
    "heat_source": r"(?:steal|absorb)\w* .{0,25}heat|\bcool|\bhot (?:the |its )?shell|shell becomes|\bhot (?:and humid|season"
                   r"|topic|springs?|things)|hot-headed|\bwhen it(?:'s| is) hot\b|hot inside its cocoon|desert(?:'s)? heat"
                   r"|geothermal|heat of lava|feeling the heat|pressure and heat|\bfreez|search of warmth|won't melt",
    "light": r"anything that shines|shiny (?:object|coins?)|something shiny|shines like gold|shining future|glow of street"
             r"|glowing with warmth|illuminated volbeat|meteors illuminate|\breflects?\b",
    "air_travel": r"not used for flying|\b(?:can't|cannot|can not|unable to|doesn't|does not) fly|flightless"
                  r"|flying[- ](?:insect|bug|prey|pokémon)|knock\w* .{0,40}flying|\bsen(?:d|ds|ding|t) (?:[\w-]+ ){0,3}flying"
                  r"|\bthrown\b|as if it were flying|\bdream\w* of (?:one day )?(?:fly|flying|soar)|doomed efforts|hopes for wings"
                  r"|\btemperatures? (?:\w+ ){0,2}soar|flies from branch|flies into (?:a|an) |spirit is said to leave"
                  r"|orbs fly|\brarely\b|just a little|only fly short|rather than flying",
    "water_travel": r"when it flies|swimming (?:to be )?somewhat challenging|swimming muscles are weak",
    "hauling": r"\bin tow\b|its heavy body",
    "digging": r"digs in with",
    "cold_tolerance": r"\bdislikes? (?:the )?cold|\b(?:avoid|escape) the cold|\bshelter(?: itself)? from (?:the )?cold"
                      r"|sluggish in cold|\b(?:grows|gets|turns) cold\b|\bcold (?:periods|seasons|summer|day|nights|underground)\b"
                      r"|encounters cold air|snow-?white|snowball|freeze in (?:utter )?fear|seasons without snow|ice mountain"
                      r"|out of clay",
    "calming_presence": r"\bkinds? of\b|\b(?:this|that|its) kind\b|one of a kind|calm (?:itself|down)|(?:waves|waters|sea) (?:are|is) calm"
                        r"|feeling calm|calm raging|gentle (?:breezes?|waves?)|docile[- ]looking|becomes docile if|docile one moment",
    "danger_sense": r"sense of (?!danger)\w+|\b(?:its|their|other|all) senses\b|olfactory sense|sens\w* (?:\w+ ){0,6}(?:emotions?"
                    r"|feelings?|sadness|gratitude|disposition)|senses? strong sunlight|earth's rotation"
                    r"|\b(?:in|faced with|faces|less) danger\b|danger it faces",
    "scouting": r"passing through walls",
    "food_source": r"trees that bear",
    "field_healing": r"heals? itself|nurses injuries|long-held belief",
    "night_travel": r"^(?!.*\b(?:by day|during the day)\b).*\bsleeps?\b|\bgoes to sleep|closes its petals|becomes still"
                    r"|stops moving|dislikes darkness|grows it back|night of a storm|cries at night|reflections of stars"
                    r"|number of stars|radio signals|\b(?:shines?|glows?|flashes|sparkle)\b|\baurora\b",
}
# A match a few words after one of these is negated ("cannot fly", "a poor swimmer", "too lethargic to even lift"), except
# for tolerances, where "it never feels the cold" is the evidence.
LORE_NEGATION = re.compile(r"\b(?:not(?! only)|never|cannot|can't|can not|unable to|incapable of|inability to|doesn't|does not"
                           r"|didn't|did not|isn't|is not|won't|aren't|no longer|poor|poorly|too (?:\w+ ){1,2}to|without)"
                           r"\s+(?:[\w'-]+,?\s+){0,2}$", re.I)
LORE_NOT_NEGATED = {"cold_tolerance", "heat_tolerance"}


def lore_text(text):
    """An entry as the patterns read it: Gen II-III entries break words across lines with a soft hyphen or a hyphen
    ("drown- ing", "high- pitched") and later ones use a curly apostrophe."""
    text = " ".join(text.split()).replace("\u00ad ", "").replace("\u00ad", "").replace("\u2019", "'")
    return re.sub(r"(\w)- (\w)", r"\1-\2", text)


def lore_reads(text, patterns, exclude):
    """The capabilities one Pokédex entry is evidence for: a sentence counts when its pattern matches, the match isn't
    negated, and the sentence isn't excluded."""
    sentences = re.split(r"(?<=[.!?])\s+", lore_text(text))

    def reads(cap, pat, sentence):
        if re.search(exclude.get(cap, "$^"), sentence, re.I):
            return False
        return any(cap in LORE_NOT_NEGATED or not LORE_NEGATION.search(sentence[:m.start()])
                   for m in re.finditer(pat, sentence, re.I))
    return [cap for cap, pat in patterns.items() if any(reads(cap, pat, s) for s in sentences)]


GAME_VERSIONS = {"crystal": [6, 4, 5], "firered": [10, 11, 9], "emerald": [9, 7, 8], "platinum": [14, 12, 13],
                 "heartgold": [15, 16, 14], "soulsilver": [16, 15, 14]}
GEN24_VERSIONS = list(range(4, 17))
SCENARIOS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenarios.json")


def load_scenarios():
    """Situations live only in scenarios.json, so they're edited in one place."""
    with open(SCENARIOS_FILE, encoding="utf-8") as fh:
        return json.load(fh)["scenarios"]


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
        if (game, species.lower(), move.lower()) in EXCEPTIONS:      # a learnability exception Zack approved (D-028)
            return True
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
                why = EXCEPTIONS.get((game, species.lower(), mv.lower()))
                src = f"{mv} (field move; {why.split(' (')[0]})" if why else f"{mv} (field move)"
                out.append(Evidence(cap, "cartridge", src, what))
                if mv == "Waterfall":
                    out.append(Evidence("water_travel", "cartridge", src, what))
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
            for cap in lore_reads(text, {c: p for c, p in LORE_PATTERNS.items() if c not in seen}, LORE_EXCLUDE):
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
            # a cave is dark terrain: it says the Pokémon moves in darkness, not that it gives light (Zubat is blind)
            cap = {"mountain": "climbing", "cave": "night_travel", "rough-terrain": "climbing", "sea": "water_travel",
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
