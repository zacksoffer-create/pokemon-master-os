"""Generation rules shared by every engine (Gen 2-4).

Battle data (types, stats, moves) is Smogon's per-generation tables (data_battle/gen{2,3,4}.json,
exported by battle/dump_gen_data.mjs from @smogon/calc). Abilities come from PokeAPI, era-correct.
Before Gen 4 a damaging move's category comes from its type; Gen 4 stores it per move.
Abilities exist from Gen 3.
"""
import json
import os
import re
from functools import lru_cache

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_GEN = {"crystal": 2, "firered": 3, "emerald": 3, "platinum": 4, "heartgold": 4, "soulsilver": 4}
GAME_VG = {"crystal": 4, "firered": 7, "emerald": 6, "platinum": 9, "heartgold": 10, "soulsilver": 10}
TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
         "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel"]
SPECIAL_BEFORE_GEN4 = {"Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark"}

# Abilities that change incoming damage: name -> (first generation, {attacking type: multiplier}).
DEFENSIVE_ABILITIES = {
    "Levitate": (3, {"Ground": 0}),
    "Volt Absorb": (3, {"Electric": 0}),
    "Water Absorb": (3, {"Water": 0}),
    "Flash Fire": (3, {"Fire": 0}),
    "Thick Fat": (3, {"Fire": 0.5, "Ice": 0.5}),
    "Motor Drive": (4, {"Electric": 0}),
    "Dry Skin": (4, {"Water": 0, "Fire": 1.25}),
    "Heatproof": (4, {"Fire": 0.5}),
}
SUPER_EFFECTIVE_FILTERS = {"Filter": 4, "Solid Rock": 4}   # super-effective damage x0.75
WONDER_GUARD = "Wonder Guard"                               # only super-effective hits land


def to_id(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


@lru_cache(maxsize=None)
def gen_data(gen):
    with open(os.path.join(HERE, "data_battle", f"gen{gen}.json"), encoding="utf-8") as fh:
        return json.load(fh)


def species(gen, name):
    return gen_data(gen)["species"][to_id(name)]


def move(gen, name):
    return gen_data(gen)["moves"][to_id(name)]


@lru_cache(maxsize=1)
def _ref():
    from refdb import Ref
    return Ref(os.path.join(HERE, "data", "pokeref.sqlite"))


@lru_cache(maxsize=None)
def abilities(gen, name):
    """Every ability the species had in that generation, from PokeAPI (Smogon's calc data keeps
    only the first ability, so it can't be the source here). Gen 2 has none."""
    if gen < 3:
        return []
    return _ref().abilities(species(gen, name)["name"], gen)


def category(gen, name):
    """'Physical' / 'Special' / 'Status' as the given generation treats the move."""
    if gen >= 4:
        return move(gen, name)["category"]
    if move(4, name)["category"] == "Status":   # status-ness never changed across Gen 2-4
        return "Status"
    return "Special" if move(gen, name)["type"] in SPECIAL_BEFORE_GEN4 else "Physical"


def effectiveness(gen, attack_type, defend_types, ability=None):
    """Damage multiplier of an attacking type against a defender (types + optional ability)."""
    chart = gen_data(gen)["types"]
    mult = 1.0
    for t in defend_types:
        mult *= chart[attack_type].get(t, 1)
    if ability and gen >= 3:
        first_gen, table = DEFENSIVE_ABILITIES.get(ability, (99, {}))
        if gen >= first_gen and attack_type in table:
            mult *= table[attack_type]
        if gen >= SUPER_EFFECTIVE_FILTERS.get(ability, 99) and mult > 1:
            mult *= 0.75
        if ability == WONDER_GUARD and mult <= 1:
            mult = 0
    return mult


def best_defensive_ability(gen, defend_types, attack_type, ability_options):
    """The defender's ability that takes the least damage from this type (worst case for us)."""
    options = ability_options or [None]
    return min(options, key=lambda a: effectiveness(gen, attack_type, defend_types, a))
