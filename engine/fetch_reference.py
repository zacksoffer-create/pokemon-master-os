"""Fetch the pinned public reference data and build the local SQLite database.

Usage: python3 -I engine/fetch_reference.py            (writes engine/data/, gitignored)
Every file is checksummed into engine/data_manifest/SHA256SUMS.txt with the fetch time,
so a later refresh can show exactly what changed upstream. Canon is never touched.
"""
import hashlib
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "data", "raw")
MANIFEST = os.path.join(HERE, "data_manifest")
POKEAPI = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/"
CSV_TABLES = [
    "pokemon_moves", "moves", "move_names", "pokemon", "pokemon_species", "pokemon_species_names",
    "pokemon_egg_groups", "egg_groups", "version_groups", "versions", "generations",
    "pokemon_abilities", "pokemon_abilities_past", "abilities", "ability_names",
    "pokemon_move_methods", "machines", "items", "pokemon_types", "pokemon_types_past", "types",
    "encounters", "location_areas", "locations", "location_names", "pokemon_evolution",
    "evolution_triggers", "pokemon_stats", "stats", "move_damage_classes",
    "pokemon_stats_past", "natures", "nature_names", "characteristics", "characteristic_text",
    "contest_types", "contest_type_names", "item_game_indices", "item_names",
    "pokemon_species_flavor_text", "pokemon_habitats", "type_efficacy", "type_efficacy_past",
    "berries",
    "move_meta", "move_meta_stat_changes", "move_meta_categories", "move_meta_ailments", "move_flag_map",
    "move_flags", "move_effect_prose", "move_changelog", "move_targets",
    # the builder's explanations (reference/explain.py): each game's own ability and item text, and PokeAPI's summaries
    "ability_prose", "ability_flavor_text", "item_prose", "item_flavor_text", "item_categories", "item_pockets",
]
# Smogon usage-stats sets (what players actually ran on Pokémon Showdown's ladder), MIT-licensed. The same package's
# "dex" sets are Smogon's copyrighted analyses and are not kept.
SMOGON_SETS = "https://registry.npmjs.org/@smogon/sets/-/sets-2.0.0.tgz"
PRET = "https://raw.githubusercontent.com/pret/"
PLATINUM_TRAINERS = ["elite_four_aaron", "elite_four_bertha", "elite_four_flint", "elite_four_lucian",
                     "champion_cynthia", "elite_four_aaron_rematch", "elite_four_bertha_rematch",
                     "elite_four_flint_rematch", "elite_four_lucian_rematch", "champion_cynthia_rematch"]
# The Trainer Library's Platinum trainers (trainers/library.py): every Gym Leader, the rival at each meeting, Team
# Galactic's commanders and Cyrus, the Fight Area's Flint and Volkner (pokeplatinum res/trainers/data/*.json).
PLATINUM_TRAINERS += [f"leader_{n}{r}" for n in ("roark", "gardenia", "maylene", "wake", "fantina", "byron", "candice",
                                                 "volkner") for r in ("", "_rematch")] + \
    ["leader_volkner_fight_area", "elite_four_flint_fight_area"] + \
    [f"rival_{w}_{s}" for w in ("route_201", "route_203", "route_209", "canalave_city", "pastoria_city", "spear_pillar",
                                "pokemon_league", "fight_area", "survival_area_1", "survival_area_2")
     for s in ("turtwig", "chimchar", "piplup")] + \
    ["commander_mars_valley_windworks", "commander_mars_lake_verity", "commander_mars_spear_pillar",
     "commander_mars_stark_mountain", "commander_jupiter_team_galactic_eterna_building", "commander_jupiter_spear_pillar",
     "commander_jupiter_stark_mountain", "commander_saturn_valor_cavern", "commander_saturn_galactic_hq",
     "galactic_boss_cyrus_galactic_hq", "galactic_boss_cyrus_celestic_town_ruins", "galactic_boss_cyrus_distortion_world"]
EXTRA = {  # independent cross-check sources, and in-game trainer teams straight from the games' code
    "showdown_learnsets.ts": "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/learnsets.ts",
    "trainers/crystal_parties.asm": PRET + "pokecrystal/master/data/trainers/parties.asm",
    "trainers/crystal_dvs.asm": PRET + "pokecrystal/master/data/trainers/dvs.asm",
    "trainers/firered_trainer_parties.h": PRET + "pokefirered/master/src/data/trainer_parties.h",
    "trainers/emerald_trainer_parties.h": PRET + "pokeemerald/master/src/data/trainer_parties.h",
    "trainers/hgss_trainers.json": PRET + "pokeheartgold/master/files/poketool/trainer/trainers.json",
    # each Gen 3 trainer's class, name, bag items, AI flags and party symbol; Crystal's per-class items and AI
    "trainers/emerald_trainers.h": PRET + "pokeemerald/master/src/data/trainers.h",
    "trainers/firered_trainers.h": PRET + "pokefirered/master/src/data/trainers.h",
    "trainers/crystal_attributes.asm": PRET + "pokecrystal/master/data/trainers/attributes.asm",
    # what Platinum seeds a trainer Pokémon's RNG with when its difficulty value makes the game roll the IVs (trainer
    # ids, trainer classes and their genders, species ids; battle/benchmarks.py platinum_rolled_ivs), at a pinned commit
    **{f"trainers/platinum_{name}": PRET + "pokeplatinum/be36a9db3d2390a5009adc087c7aef550ce335e7/" + path
       for name, path in {"trainer_ids.txt": "generated/trainers.txt", "trainer_classes.txt": "generated/trainer_classes.txt",
                          "trainer_class_genders.h": "include/data/trainer_class_genders.h",
                          "species_ids.txt": "generated/species.txt"}.items()},
} | {f"trainers/platinum_{t}.json": PRET + f"pokeplatinum/main/res/trainers/data/{t}.json" for t in PLATINUM_TRAINERS} | {
    # Poké Ball mechanics, each from the game's own catch code, at a pinned commit (equipment/balls.py checks them)
    f"equipment/{name}": PRET + path for name, path in {
        "red_item_effects.asm": "pokered/171e2c204f9c1ff8e577ca387a4bbb009e130843/engine/items/item_effects.asm",
        "crystal_item_effects.asm": "pokecrystal/5c877ef55197039c9676e8e3eec6d254b1c40fe8/engine/items/item_effects.asm",
        "crystal_bugs_and_glitches.md": "pokecrystal/5c877ef55197039c9676e8e3eec6d254b1c40fe8/docs/bugs_and_glitches.md",
        "crystal_flee_mons.asm": "pokecrystal/5c877ef55197039c9676e8e3eec6d254b1c40fe8/data/wild/flee_mons.asm",
        "crystal_apricorn_balls.asm": "pokecrystal/5c877ef55197039c9676e8e3eec6d254b1c40fe8/data/items/apricorn_balls.asm",
        "crystal_item_descriptions.asm": "pokecrystal/5c877ef55197039c9676e8e3eec6d254b1c40fe8/data/items/descriptions.asm",
        "crystal_item_constants.asm": "pokecrystal/5c877ef55197039c9676e8e3eec6d254b1c40fe8/constants/item_constants.asm",
        "emerald_battle_script_commands.c": "pokeemerald/731ad5bfd6e6f265508d0efcca0ba42f9dcf5881/src/battle_script_commands.c",
        "emerald_item_descriptions.h": "pokeemerald/731ad5bfd6e6f265508d0efcca0ba42f9dcf5881/src/data/text/item_descriptions.h",
        "emerald_pokemon.c": "pokeemerald/731ad5bfd6e6f265508d0efcca0ba42f9dcf5881/src/pokemon.c",
        "firered_battle_script_commands.c": "pokefirered/ce6406d8c2eaf46d543c8a2606de0c3cb1951982/src/battle_script_commands.c",
        "platinum_battle_script.c": "pokeplatinum/be36a9db3d2390a5009adc087c7aef550ce335e7/src/battle/battle_script.c",
        "platinum_pokemon.c": "pokeplatinum/be36a9db3d2390a5009adc087c7aef550ce335e7/src/pokemon.c",
        "heartgold_battle_command.c": "pokeheartgold/6988158691eb6178cff697cda0428045ddcba5fb/src/battle/battle_command.c",
        "heartgold_battle_command_data.s": "pokeheartgold/6988158691eb6178cff697cda0428045ddcba5fb/asm/overlay_12_battle_command.s",
        "heartgold_item_descriptions.json": "pokeheartgold/6988158691eb6178cff697cda0428045ddcba5fb/files/msgdata/msg/msg_0221.json",
        "heartgold_items.h": "pokeheartgold/6988158691eb6178cff697cda0428045ddcba5fb/include/constants/items.h",
    }.items()} | {   # how each wild Pokémon is met (rod, surf, the Safari Zone...), for which balls it could be caught in
    f"equipment/{t}.csv": POKEAPI + f"{t}.csv" for t in ("encounter_slots", "encounter_methods")} | {
    # the Gen 4 Pokédex's body shapes, for what a body can do (capability/records.py)
    f"capability/{t}.csv": POKEAPI + f"{t}.csv" for t in ("pokemon_shapes", "pokemon_shape_prose")}


def fetch(url, dest):
    with urllib.request.urlopen(url, timeout=120) as resp, open(dest, "wb") as fh:
        fh.write(resp.read())


def fetch_smogon_sets():
    """Keep only the MIT 'stats' source for Gen 2-4, one JSON per generation: {format: {species: {set: {...}}}}."""
    import io
    import json
    import tarfile
    with urllib.request.urlopen(SMOGON_SETS, timeout=120) as resp:
        tar = tarfile.open(fileobj=io.BytesIO(resp.read()), mode="r:gz")
    os.makedirs(os.path.join(RAW, "smogon"), exist_ok=True)
    names = []
    for gen in (2, 3, 4):
        data = json.load(tar.extractfile(f"package/gen{gen}.json"))
        stats = {fmt: v["stats"] for fmt, v in data.items() if isinstance(v, dict) and "stats" in v}
        name = f"smogon/gen{gen}_usage_sets.json"
        with open(os.path.join(RAW, name), "w", encoding="utf-8") as fh:
            json.dump(stats, fh, ensure_ascii=False, sort_keys=True)
        names.append(name)
    return names


def fetch_new_trainers(prefix="trainers/"):
    """Only the files under `prefix` not on disk yet (trainers/, equipment/); their checksums are added, nothing already
    fetched is rewritten (B30)."""
    os.makedirs(os.path.join(RAW, prefix), exist_ok=True)
    sums = os.path.join(MANIFEST, "SHA256SUMS.txt")
    lines = open(sums).read().splitlines() if os.path.exists(sums) else []
    have = {ln.split("  ", 1)[1] for ln in lines if "  " in ln}
    for name, url in EXTRA.items():
        dest = os.path.join(RAW, name)
        if not name.startswith(prefix) or os.path.exists(dest):
            continue
        tmp = dest + ".part"
        fetch(url, tmp)
        os.replace(tmp, dest)
        if name not in have:
            lines.append(f"{hashlib.sha256(open(dest, 'rb').read()).hexdigest()}  {name}")
        print("fetched", name)
    with open(sums, "w") as out:
        out.write("\n".join(sorted(lines, key=lambda ln: ln.split("  ", 1)[-1])) + "\n")


def main():
    if "--trainers" in sys.argv:
        return fetch_new_trainers()
    if "--equipment" in sys.argv:
        return fetch_new_trainers("equipment/")
    if "--capability" in sys.argv:
        return fetch_new_trainers("capability/")
    os.makedirs(os.path.join(RAW, "trainers"), exist_ok=True)
    os.makedirs(os.path.join(RAW, "equipment"), exist_ok=True)
    os.makedirs(os.path.join(RAW, "capability"), exist_ok=True)
    os.makedirs(MANIFEST, exist_ok=True)
    targets = {f"{t}.csv": POKEAPI + f"{t}.csv" for t in CSV_TABLES} | EXTRA
    for name, url in targets.items():
        fetch(url, os.path.join(RAW, name))
        print("fetched", name)
    targets.update({n: SMOGON_SETS for n in fetch_smogon_sets()})
    with open(os.path.join(MANIFEST, "SHA256SUMS.txt"), "w") as out:
        for name in sorted(targets):
            digest = hashlib.sha256(open(os.path.join(RAW, name), "rb").read()).hexdigest()
            out.write(f"{digest}  {name}\n")
    with open(os.path.join(MANIFEST, "FETCHED_AT.txt"), "w") as out:
        out.write(time.strftime("%Y-%m-%dT%H:%M:%SZ\n", time.gmtime()))
    sys.path.insert(0, HERE)
    import refdb
    refdb.build(RAW, os.path.join(HERE, "data", "pokeref.sqlite"))
    print("built", os.path.join(HERE, "data", "pokeref.sqlite"))


if __name__ == "__main__":
    main()
