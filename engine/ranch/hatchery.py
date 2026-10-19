"""The hatchery-greenhouse (designs.hatchery_greenhouse in canon/ranch.json): staffing per room, egg
timing per line, and the crop plan. The design is a proposal until approved; the numbers come from the games.

Egg timing: Gen 4 counts an egg's hatch time in cycles of 255 steps (PokeAPI hatch_counter = cycles).
A Flame Body or Magma Armor Pokémon in the party makes each cycle pass twice as fast.
Crops: PokeAPI berry data is Gen 4's: growth_time is hours per stage, four stages to harvest;
soil_dryness is how fast the plant dries its soil (higher = more watering).
"""
import json
import math
import os

from battle.scouting import GAME_TITLE

STEPS_PER_CYCLE = 255


class Hatchery:
    def __init__(self, planner):
        self.planner = planner
        self.ref = planner.ref
        self.design = planner.design["designs"]["hatchery_greenhouse"]
        with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "canon", "builds.json"),
                  encoding="utf-8") as fh:
            self.builds = json.load(fh)

    # --- eggs ----------------------------------------------------------------------------
    def egg_card(self, species):
        sid = self.ref.species_id(species)
        base = self.ref.line(sid)[-1]
        cycles = int(self.ref.q("SELECT hatch_counter FROM pokemon_species WHERE id=?", base)[0][0])
        steps = cycles * STEPS_PER_CYCLE
        loop = self.design.get("loop_steps")
        return {"line": self.ref.name(base), "cycles": cycles, "steps": steps,
                "steps_with_flame_body": math.ceil(steps / 2),
                "laps": math.ceil(steps / loop) if loop else None,
                "laps_with_flame_body": math.ceil(steps / 2 / loop) if loop else None}

    def egg_schedule(self):
        """One egg card per stud line the program keeps, slowest first."""
        lines = [p["kept"]["species"] for p in self.planner.breeding_program() if p["kept"]["kind"] == "stud"]
        return sorted((self.egg_card(sp) for sp in lines), key=lambda c: -c["steps"])

    # --- crops ---------------------------------------------------------------------------
    def crops(self):
        wanted = {i: "medicine" for i in self.design["crops"]["medicine"]}
        for game in (g for g in self.builds if not g.startswith("_")):
            for sp, b in self.builds[game].items():
                item = (b.get("item") or "").lower().replace(" ", "-")
                if item.endswith("-berry"):
                    wanted[item] = f"held by {GAME_TITLE[game]} {sp}"
        out = []
        for ident, why in wanted.items():
            r = self.ref.q("""SELECT b.growth_time, b.max_harvest, b.soil_dryness, n.name FROM berries b
                JOIN items i ON i.id=b.item_id JOIN item_names n ON n.item_id=i.id AND n.local_language_id=9
                WHERE i.identifier=?""", ident)
            if not r:
                continue
            g, mx, dry, name = (r[0][0], r[0][1], r[0][2], r[0][3])
            out.append({"berry": name, "why": why, "hours_to_harvest": 4 * int(g), "max_harvest": int(mx),
                        "watering": "heavy" if int(dry) >= 15 else "medium" if int(dry) >= 8 else "light"})
        return sorted(out, key=lambda c: c["hours_to_harvest"])

    # --- rooms ---------------------------------------------------------------------------
    def rooms(self):
        census_res = self.planner.residents()
        hires = [{"id": f"hire:{sp}", "species": sp, "game": "heartgold", "role": "staff (proposed hire)",
                  "fate": "hired"} for sp in self.design.get("hires", [])]
        return self.planner.staffing(census_res + hires, [dict(r, access="private") for r in self.design["rooms"]])

    def report(self):
        return {"name": self.design["name"], "status": self.design["status"], "idea": self.design["idea"],
                "rooms": self.rooms(), "eggs": self.egg_schedule(), "crops": self.crops()}
