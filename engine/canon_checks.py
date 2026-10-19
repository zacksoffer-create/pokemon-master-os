"""Canon regression checks: every move/ability/HM claim from the handoff, per game."""
import json
import sys

sys.path.insert(0, sys.argv[1])
from refdb import Ref, VG  # noqa: E402

r = Ref(sys.argv[2])
out = {}

# (game, species, [moves]) — union of every historical and current candidate move
MOVE_CLAIMS = [
    ("heartgold", "Typhlosion", ["Flamethrower", "Extrasensory", "Thunder Punch", "Earthquake",
                                 "Sunny Day", "Solar Beam", "Eruption", "Hidden Power", "Focus Blast"]),
    ("heartgold", "Tyranitar", ["Dragon Dance", "Crunch", "Earthquake", "Outrage", "Rock Slide", "Stone Edge"]),
    ("heartgold", "Mamoswine", ["Earthquake", "Ancient Power", "Ice Fang", "Hail", "Ice Shard"]),
    ("heartgold", "Crobat", ["Fly", "Roost", "U-turn", "Toxic"]),
    ("heartgold", "Lapras", ["Surf", "Ice Beam", "Rest", "Heal Bell"]),
    ("heartgold", "Snorlax", ["Body Slam", "Rest", "Thunder Punch", "Zen Headbutt"]),
    ("platinum", "Infernape", ["Close Combat", "Flamethrower", "Mach Punch", "Thunder Punch", "Grass Knot", "U-turn"]),
    ("platinum", "Garchomp", ["Earthquake", "Dragon Claw", "Fire Fang", "Poison Jab", "Aqua Tail", "Outrage", "Stone Edge"]),
    ("emerald", "Swampert", ["Refresh"]),
    ("soulsilver", "Pikachu", ["Volt Tackle", "Quick Attack", "Thunderbolt", "Iron Tail"]),
    ("soulsilver", "Dragonite", ["Fly", "Roost", "Extreme Speed", "Dragon Claw"]),
    ("soulsilver", "Gyarados", ["Waterfall", "Ice Fang", "Earthquake", "Dragon Dance"]),
    ("soulsilver", "Empoleon", ["Surf", "Flash Cannon", "Aqua Jet", "Aqua Ring"]),
    ("soulsilver", "Gengar", ["Shadow Ball", "Disable", "Dark Pulse", "Psychic"]),
    ("soulsilver", "Scizor", ["Bullet Punch", "U-turn", "Counter", "Roost"]),
]
claims = []
for game, sp, moves in MOVE_CLAIMS:
    for mv in moves:
        res = r.learn(sp, mv, VG[game])
        native = sorted({f"{st}:{m}{'@'+str(l) if m=='level-up' else ''}" for k, st, m, l, v in res["routes"] if k == "native"})
        other = sorted({f"{k}:{st}:{m}(vg{v})" for k, st, m, l, v in res["routes"] if k != "native"})
        claims.append({"game": game, "species": sp, "move": res["move"], "exists_in_gen": res["move_exists"],
                       "native": native, "other_routes": other,
                       "verdict": "LEARNABLE" if native else ("OTHER-ROUTE ONLY" if other else "NOT LEARNABLE")})
out["move_claims"] = claims

# Egg-move father searches (what parent can actually pass the move in that generation)
EGG = [("heartgold", "Typhlosion", "Extrasensory"), ("heartgold", "Tyranitar", "Outrage"),
       ("heartgold", "Tyranitar", "Dragon Dance"), ("heartgold", "Mamoswine", "Ancient Power"),
       ("heartgold", "Mamoswine", "Ice Shard"), ("platinum", "Infernape", "Thunder Punch"),
       ("emerald", "Swampert", "Refresh"), ("soulsilver", "Gengar", "Disable"),
       ("soulsilver", "Scizor", "Counter"), ("soulsilver", "Empoleon", "Aqua Ring")]
out["fathers"] = [dict(game=g, **r.fathers(sp, mv, VG[g])) for g, sp, mv in EGG]

# Abilities as they existed in each generation
TEAMS = {
    "crystal": ["Feraligatr", "Miltank", "Donphan", "Ampharos", "Umbreon", "Espeon"],
    "firered": ["Charizard", "Blastoise", "Venusaur", "Alakazam", "Jolteon", "Machamp"],
    "emerald": ["Swampert", "Milotic", "Altaria", "Arcanine", "Absol", "Meganium"],
    "platinum": ["Infernape", "Weavile", "Roserade", "Lucario", "Garchomp", "Magnezone"],
    "soulsilver": ["Pikachu", "Dragonite", "Infernape", "Empoleon", "Gengar", "Scizor"],
    "heartgold": ["Typhlosion", "Tyranitar", "Mamoswine", "Crobat", "Lapras", "Snorlax"],
}
GEN = {"crystal": 2, "firered": 3, "emerald": 3, "platinum": 4, "soulsilver": 4, "heartgold": 4}
out["abilities"] = {g: {sp: r.abilities(sp, GEN[g]) for sp in team} for g, team in TEAMS.items()}

# HM / field-move matrix: who on each roster can learn each HM in that version group
EXTRA_FIELD = {"crystal": ["Rock Smash", "Headbutt"], "firered": [], "emerald": ["Secret Power"],
               "platinum": ["Flash"], "heartgold": ["Flash", "Headbutt"], "soulsilver": ["Flash", "Headbutt"]}
matrix = {}
for g, team in TEAMS.items():
    vg = VG[g]
    rows = {}
    field = [r.move_name(m) for _, m in r.hms(vg)] + EXTRA_FIELD[g]
    for mv in field:
        who = []
        for sp in team:
            res = r.learn(sp, mv, vg)
            if any(k == "native" for k, *_ in res["routes"]):
                who.append(sp)
        rows[f"{r.machine_no(mv, vg) or 'tutor/other'} {mv}"] = who
    matrix[g] = rows
out["hm_matrix"] = matrix

# Wild availability (PokeAPI encounter tables; gifts/static events are often absent)
WILD = [("Growlithe", "emerald"), ("Growlithe", "firered"), ("Growlithe", "leafgreen"),
        ("Chikorita", "emerald"), ("Feebas", "emerald"), ("Absol", "emerald"), ("Swablu", "emerald"),
        ("Larvitar", "heartgold"), ("Swinub", "heartgold"), ("Lapras", "heartgold"), ("Snorlax", "heartgold"),
        ("Gible", "platinum"), ("Sneasel", "platinum"), ("Riolu", "platinum"), ("Magnemite", "platinum"),
        ("Budew", "platinum"), ("Phanpy", "crystal"), ("Mareep", "crystal"), ("Miltank", "crystal"),
        ("Eevee", "crystal"), ("Dratini", "soulsilver"), ("Pikachu", "soulsilver"), ("Scyther", "soulsilver"),
        ("Gastly", "soulsilver"), ("Piplup", "soulsilver"), ("Chimchar", "soulsilver")]
out["wild"] = {f"{s}@{v}": r.wild_in(s, v)[:6] for s, v in WILD}

# Base stats (relevant to Gen 2-3 type-based physical/special split)
out["stats"] = {s: r.base_stats(s) for s in ["Typhlosion", "Feraligatr", "Absol", "Altaria", "Swampert",
                                             "Umbreon", "Gengar", "Infernape", "Snorlax", "Lapras"]}
out["type_damage_class_gen1_3"] = {row["identifier"]: row["damage_class_id"] for row in
                                   r.q("SELECT identifier, damage_class_id FROM types WHERE CAST(id AS INT)<=17")}
print(json.dumps(out, indent=1))
