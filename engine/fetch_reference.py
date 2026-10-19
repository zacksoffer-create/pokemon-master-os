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
]
EXTRA = {  # independent cross-check sources
    "showdown_learnsets.ts": "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/learnsets.ts",
}


def fetch(url, dest):
    with urllib.request.urlopen(url, timeout=120) as resp, open(dest, "wb") as fh:
        fh.write(resp.read())


def main():
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(MANIFEST, exist_ok=True)
    targets = {f"{t}.csv": POKEAPI + f"{t}.csv" for t in CSV_TABLES} | EXTRA
    for name, url in targets.items():
        fetch(url, os.path.join(RAW, name))
        print("fetched", name)
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
