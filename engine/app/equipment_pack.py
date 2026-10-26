"""equipment.json: the Poké Ball collection and the equipment library for the app (web/33_capture.html, 91_gear.html).

    python3 -I engine/app/equipment_pack.py      # app/data/equipment.json (export.py runs it)

- balls: the 25 reference records (equipment/balls.py, mechanics checked against the games' code), with acquisition
  (engine/data_manifest/ball_acquisition.json from equipment/acquire.py) and the Apricorns;
- gear: the equipment library (equipment/gear.py): every key item of the five games, read from each game's key items
  pocket, with each game's name, description and ways to get it, and the four devices that aren't bag items; checked
  against the games' item lists (gear.check()) before anything is written;
- species: each generation's own catch rate, base HP and Speed, types and weights (data_manifest/catch_species.json),
  for the catch calculator, which runs equipment/capture.py's rules in the page (held to Python by
  app/test_capture_parity.mjs);
- met: per game, how each species is met (a bitmask: 1 in the wild outside the Safari Zone, 2 by rod, 4 on water, 8
  underwater, 16 in the Safari Zone or Great Marsh, 32 in National Park (the Bug-Catching Contest's park), 64 gift,
  trade or egg only), and `pre`, each species' pre-evolution, so a ball can be checked against how an individual (or
  what it evolved from) could have been met.
"""
import csv
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
OUT = os.path.join(HERE, "data", "equipment.json")
RAW = os.path.join(ENGINE, "data", "raw", "equipment")
VERSIONS = ("crystal", "firered", "emerald", "platinum", "heartgold", "soulsilver")
FISH = {"old-rod", "good-rod", "super-rod", "feebas-tile-fishing"}
GIFT = {"gift", "gift-egg", "npc-trade", "colosseum-bonus-disc-jpn"}
SAFARI = {"kanto-safari-zone", "hoenn-safari-zone", "great-marsh", "johto-safari-zone"}


def met():
    meth = {r["id"]: r["identifier"] for r in csv.DictReader(open(os.path.join(RAW, "encounter_methods.csv"), encoding="utf-8"))}
    slot = {r["id"]: meth[r["encounter_method_id"]] for r in csv.DictReader(open(os.path.join(RAW, "encounter_slots.csv"), encoding="utf-8"))}
    db = sqlite3.connect(os.path.join(ENGINE, "data", "pokeref.sqlite"))
    names = {sid: n for sid, n in db.execute("select pokemon_species_id, name from pokemon_species_names where local_language_id=9")}
    species = {pid: sid for pid, sid in db.execute("select id, species_id from pokemon")}
    pre = {names[s]: names[f] for s, f in db.execute("select id, evolves_from_species_id from pokemon_species where evolves_from_species_id is not null and id <= 493")}
    out = {v: {} for v in VERSIONS}
    q = ("select v.identifier, e.encounter_slot_id, l.identifier, e.pokemon_id from encounters e join versions v on v.id = e.version_id "
         "join location_areas la on la.id = e.location_area_id join locations l on l.id = la.location_id")
    seen = {}
    for ver, sl, loc, pid in db.execute(q):
        if ver not in out or species.get(pid, 9999) > 493:
            continue
        m, name = slot.get(str(sl)), names[species[pid]]
        bits = 64 if m in GIFT else 16 if loc in SAFARI else 1   # only Safari Balls are thrown in the Safari Zone
        if m in FISH:
            bits |= 2 | 4
        if m == "surf":
            bits |= 4
        if m == "seaweed":
            bits |= 8
        if loc == "national-park" and m not in GIFT:      # ordinary wild Pokémon outside the contest, too
            bits |= 32
        seen.setdefault((ver, name), set()).add(bits)
    for (ver, name), all_bits in seen.items():
        b = 0
        for x in all_bits:
            b |= x
        if b & ~64:                                 # met in the wild somewhere: not "gift only"
            b &= ~64
        out[ver][name] = b
    return out, pre


def main():
    sys.path.insert(0, ENGINE)
    from equipment import balls, gear
    bad = balls.check()
    if bad:
        raise SystemExit("The ball mechanics disagree with the games' code:\n  " + "\n  ".join(bad))
    ref = balls.build()
    acq = {}
    if os.path.exists(balls.ACQ):
        with open(balls.ACQ, encoding="utf-8") as fh:
            acq = json.load(fh)
    bad = gear.check(acq)
    if bad:
        raise SystemExit("The equipment library disagrees with the games' item lists:\n  " + "\n  ".join(bad))
    kit = gear.build(acq)
    with open(os.path.join(ENGINE, "data_manifest", "catch_species.json"), encoding="utf-8") as fh:
        sp = json.load(fh)
    m, pre = met()
    pack = {"_note": "Built by app/equipment_pack.py: the Poké Ball collection (equipment/balls.py), the equipment library "
                     "(equipment/gear.py), each generation's catch numbers (equipment/species.py) and how each species is met.",
            "balls": ref["balls"], "formula": ref["formula"], "era_of_game": ref["era_of_game"], "games": ref["games"],
            "categories": ref["categories"], "apricorns": ref["apricorns"], "acquisition_gaps": ref["acquisition_gaps"],
            "acquisition_commits": ref["acquisition_commits"], "gear": kit, "gear_kinds": gear.KIND,
            "gear_counts": gear.counts(kit), "gear_pockets": gear.POCKET_FROM, "gear_gaps": acq.get("gear_gaps", []),
            "species": sp["species"], "species_commits": sp["commits"], "met": m, "pre": pre,
            "art": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/"}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{OUT}: {len(pack['balls'])} balls, {len(pack['gear'])} pieces of gear, {len(pack['species'])} species, "
          f"{os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
