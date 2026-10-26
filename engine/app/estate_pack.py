"""estate.json: what the Estate needs in the browser, which builds the census and the staffing from your teams
(v2.5, docs/ESTATE.md; web/40_estate.html).

    python3 -I app/estate_pack.py        # engine/app/data/estate.json (export.py runs it)

Everything here is reference or design, never your records, so the fresh start leaves it alone:
- sites: the headquarters (Blackthorn highlands, D-041) and the satellite you chose (the Sevii Islands, D-079), with
  the land each offers. Geothermal ground in the highlands (your A-64 answer) is read as volcanic land at the
  headquarters (A-110, provisional);
- habitat: every Gen I-IV species' land, climate, water, size and home region (ranch/habitat.py), for placing your
  Pokémon at Blackthorn or on the Sevii Islands (ranch/planner.py home_site, ported);
- eggs: each species' line, egg cycles, egg groups and gender rate, for the egg schedule and the nursery pens;
- berries: Gen 4's growth hours, harvest and watering per berry, and the medicine crop (canon/ranch.json);
- glasshouse: the approved design (D-045): the idea, the rooms with the Glasshouse's jobs that sit in each
  (capability/facilities.json), the hatching loop;
- preserve and sevii: the Day-Care preserve (D-040, D-079) and the satellite's places from FireRed, with the wild
  Pokémon its encounter tables put there (app/data/ranges.json);
- words: your own words about the estate, with where they were said.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

from ranch.habitat import ZONES, HabitatEngine  # noqa: E402
from ranch.hatchery import STEPS_PER_CYCLE  # noqa: E402
from refdb import Ref  # noqa: E402
from trainers.model import DB  # noqa: E402

OUT = os.path.join(HERE, "data", "estate.json")
EGG_GROUP = {"monster": "Monster", "water1": "Water 1", "bug": "Bug", "flying": "Flying", "ground": "Field", "fairy": "Fairy",
             "plant": "Grass", "humanshape": "Human-Like", "water3": "Water 3", "mineral": "Mineral", "indeterminate": "Amorphous",
             "water2": "Water 2", "ditto": "Ditto", "dragon": "Dragon", "no-eggs": "Undiscovered"}   # the games' names
CANON = os.path.join(ENGINE, "canon")
GEOTHERMAL = ("geothermal ground in the highlands: your answer (A-64), read as volcanic land at the headquarters "
              "(A-110, provisional), so fire Pokémon can live at Blackthorn and the satellite is for the sea")
SEVII = ("One Island", "Kindle Road", "Mt. Ember", "Treasure Beach", "Two Island", "Cape Brink", "Three Island",
         "Three Isle", "Bond Bridge", "Berry Forest", "Four Island", "Icefall Cave", "Five Island", "Five Isle",
         "Water Labyrinth", "Resort Gorgeous", "Memorial Pillar", "Lost Cave", "Six Island", "Water Path", "Ruin Valley",
         "Green Path", "Outcast Island", "Altering Cave", "Pattern Bush", "Dotted Hole", "Seven Island", "Trainer Tower",
         "Canyon Entrance", "Sevault Canyon", "Tanoby", "Navel Rock", "Birth Island")
WORDS = [
    ["think of it more like end game is a breeding ranch… for a Pokémon champion with unlimited money, with unlimited land… and obviously with the power of Pokémon", "D-035"],
    ["think of this all written in the past tense… all of these Pokémon are retired and that's where this whole breeding ranch is like the centerpiece", "D-042"],
    ["I'm a breeder now, a retired champion, and the thing I do is tinker with different builds and trying to achieve different move sets and breeding stock that can go different ways", "D-044"],
    ["build a hatchery from scratch… interweave a hatchery and a greenhouse", "D-041"],
    ["It's all about the breeding stock. It's not really about the parent.", "D-079"],
    ["The compound should feel like a real place inhabited and operated by Pokémon, not a generic menu of buildings that passively generate points.", "the homestead spec, 2026-10-24"],
    ["Think of it like the day care center gazillionaire edition… it's super exclusive, it's not massive, think more wildlife preserve with daycare aspect", "D-040"],
    ["It's other amazing trainers ... it costs so much money that you have to just have a ton of money.", "D-079"],
    ["Oh, definitely Sevii Islands.", "D-079"],
]


def load(name):
    with open(os.path.join(CANON, name), encoding="utf-8") as fh:
        return json.load(fh)


def sites(ranch):
    hq, sats = ranch["shape"]["headquarters"], ranch["shape"]["satellites"]
    out, rest = [], []
    for s in ranch["sites"]:
        if s["id"] != hq and s["id"] not in sats:
            rest.append(s["name"])
            continue
        x = {k: s.get(k) for k in ("id", "role", "name", "region", "status", "anchor", "game_facts", "why", "heritage")}
        x["offers"] = list(s["offers"])
        if s["id"] == hq and "volcanic" not in x["offers"]:
            x["offers"].append("volcanic")
            x["offers_note"] = {"volcanic": GEOTHERMAL}
        x["role"] = "headquarters" if s["id"] == hq else "satellite"
        out.append(x)
    return out, rest


def species_data(ref, hab):
    habitat, eggs = {}, {}
    groups = {r[0]: r[1] for r in ref.q("SELECT id, identifier FROM egg_groups")}
    for sid in range(1, 494):
        name = ref.name(sid)
        p = hab.profile(name.replace("♀", "-F").replace("♂", "-M"))
        habitat[name] = [p.zones, p.climate, p.water, p.size, p.native_region]
        base = ref.line(sid)[-1]
        cycles = int(ref.q("SELECT hatch_counter FROM pokemon_species WHERE id=?", base)[0][0])
        eg = [EGG_GROUP[groups[r[0]]] for r in ref.q("SELECT egg_group_id FROM pokemon_egg_groups WHERE species_id=? ORDER BY egg_group_id", sid)]
        rate = int(ref.q("SELECT gender_rate FROM pokemon_species WHERE id=?", sid)[0][0])
        eggs[name] = [ref.name(base), cycles, eg, rate]
    return habitat, eggs


def berries(ref, medicine):   # Gen 4's 64 (the later ones have no growth rows)
    out = {}
    for g, mx, dry, name, ident in ref.q("""SELECT b.growth_time, b.max_harvest, b.soil_dryness, n.name, i.identifier FROM berries b
            JOIN items i ON i.id=b.item_id JOIN item_names n ON n.item_id=i.id AND n.local_language_id=9 WHERE b.id <= 64 ORDER BY b.id"""):
        out[name] = [4 * int(g), int(mx), "heavy" if int(dry) >= 15 else "medium" if int(dry) >= 8 else "light", ident in medicine]
    return out


def glasshouse(ranch, facilities):
    d = ranch["designs"]["hatchery_greenhouse"]
    gh = next(f for f in facilities if f["id"] == "glasshouse")
    rooms = []
    for r in d["rooms"]:
        reqs = [q["id"] for q in gh["requirements"] if q.get("room") == r["name"]]
        rooms.append({"name": r["name"], "what": r["what"], "people": r.get("people", []), "requirements": reqs,
                      "facility": "cold-vault" if r["name"] == "Cold vault" else "glasshouse"})
    return {"name": d["name"], "status": d["status"], "idea": d["idea"], "rooms": rooms,
            "loop": {"steps_per_cycle": STEPS_PER_CYCLE, "steps": d.get("loop_steps"), "note": d.get("loop_note"),
                     "verify": "255 steps a cycle is believed (E-024); the spec asks to verify it before exact step counts"},
            "crops_note": "The medicine crop for the clinic and the nursery, plus every berry your Pokémon's builds hold. "
                          "Apricorns for Kurt's Poké Balls grow outside the glass (canon/ranch.json)."}


def sevii_wild(sites_list):
    with open(os.path.join(HERE, "data", "ranges.json"), encoding="utf-8") as fh:
        rg = json.load(fh)
    areas = rg["areas"]
    keep = {i for i, a in enumerate(areas) if a.startswith(SEVII)}
    places = {}
    for sp, games in rg["species"].items():
        for row in games.get("firered", []):
            if row[0] in keep and row[1] not in ("gift", "trade"):
                place = areas[row[0]].split(" (")[0]
                places.setdefault(place, set()).add(sp)
    return {p: sorted(v) for p, v in sorted(places.items())}


def build():
    ranch = load("ranch.json")
    with open(os.path.join(ENGINE, "capability", "facilities.json"), encoding="utf-8") as fh:
        facilities = json.load(fh)["facilities"]
    ref = Ref(DB)
    hab = HabitatEngine(DB)
    site_list, not_chosen = sites(ranch)
    habitat, eggs = species_data(ref, hab)
    preserve = next(f for f in ranch["facilities"] if f["name"] == "day-care preserve")
    return {
        "_note": "The Estate's reference and design (app/estate_pack.py). The census and the staffing are built in the "
                 "browser from your teams (web/40_estate.html); nothing here is your record.",
        "words": WORDS,
        "sites": site_list, "not_chosen": not_chosen, "zones": ZONES,
        "rules": {"one_hq": ranch["shape"]["rule"], "access": ranch["access"]["rule"], "residents": ranch.get("residents_policy"),
                  "stock": ranch.get("stock_policy"), "staffing": ranch.get("staffing_policy")},
        "habitat": habitat, "eggs": eggs,
        "berries": berries(ref, set(ranch["designs"]["hatchery_greenhouse"]["crops"]["medicine"])),
        "glasshouse": glasshouse(ranch, facilities),
        "preserve": {"access": preserve["access"], "people": preserve.get("people", []), "facility": "daycare",
                     "design": "It doesn't take walk-ins: it's exclusive, small and by invitation. Clients' Pokémon don't sit in a pen. "
                               "They live in real habitat on a protected piece of the land, cared for by keepers and by the ranch's own "
                               "Pokémon. That's the preserve side; the day-care side is that their trainers come back for them. (RANCH.md §2, approved under D-040)",
                     "open": ["How long clients' Pokémon stay", "What the preserve's land looks like, and where it sits", "How an invitation works"]},
        "sevii": {"wild": sevii_wild(site_list), "source": "FireRed's encounter tables (app/data/ranges.json): HeartGold and SoulSilver have no Sevii Islands"},
    }


def main():
    pack = build()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{OUT}: {len(pack['habitat'])} species, {len(pack['sites'])} sites, {len(pack['berries'])} berries, "
          f"{len(pack['sevii']['wild'])} Sevii places, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
