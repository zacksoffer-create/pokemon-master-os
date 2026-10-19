"""Ranch planner: the Champion's breeding ranch (D-035) as a system.

Inputs are canon: the rosters (canon/rosters.json), the ranch design (canon/ranch.json) and the
authored world (canon/world.json). The census answers:
  - who lives there: every companion from every chapter, plus the breeding stock the canon's lineages need
  - what land they need: zones, climate, water and size, and which proposed site fits each resident
  - who can run it: each facility's jobs, the residents the games back for them, and staff proposals for gaps
  - the breeding program: each lineage the canon calls for, its fathers, and which fathers are already residents
Nothing here decides the ranch; sites, scale and story are authored.
"""
import json
import os

import rules
from breeding.engine import BreedingEngine
from ranch.habitat import ZONES, HabitatEngine
from wilderness.engine import FIELD_ABILITIES, TIER_RANK, WildernessEngine
from wilderness.world import WorldStore

HERE = os.path.dirname(os.path.abspath(__file__))
CANON = os.path.join(os.path.dirname(HERE), "canon")
FACILITIES = {
    "nursery & hatchery": ["egg_care", "calming_presence"],
    "clinic": ["field_healing", "calming_presence"],
    "kitchen & orchard": ["foraging", "food_source", "cooking", "heat_source"],
    "works (building & upkeep)": ["hauling", "digging", "clearing"],
    "transport": ["air_travel", "water_travel", "escape"],
    "security & watch": ["deterrence", "scouting", "danger_sense"],
    "climate": ["heat_source", "cold_tolerance", "weather_handling"],
}
DEX_MAX = 493
EGG_GROUP_NAMES = {"monster": "Monster", "water1": "Water 1", "bug": "Bug", "flying": "Flying", "ground": "Field",
                   "fairy": "Fairy", "plant": "Grass", "humanshape": "Human-Like", "water3": "Water 3",
                   "mineral": "Mineral", "indeterminate": "Amorphous", "water2": "Water 2", "dragon": "Dragon"}


class RanchPlanner:
    def __init__(self, db_path, canon_dir=CANON):
        self.habitat = HabitatEngine(db_path)
        self.breeding = BreedingEngine(db_path)
        self.ref = self.breeding.ref
        world = WorldStore(os.path.join(canon_dir, "world.json"))
        self.wild = WildernessEngine(db_path, world.authored())
        with open(os.path.join(canon_dir, "rosters.json"), encoding="utf-8") as fh:
            self.rosters = json.load(fh)
        with open(os.path.join(canon_dir, "ranch.json"), encoding="utf-8") as fh:
            self.design = json.load(fh)

    # --- who lives there -----------------------------------------------------------
    def companions(self):
        return [{"id": f"{ch['game']}:{sp}", "species": sp, "game": ch["game"], "role": "companion",
                 "status": ch["status"]} for ch in self.rosters["chapters"] for sp in ch["roster"]]

    def breeding_program(self):
        """Each lineage the canon asks for, with its shortest chain of fathers (oldest first)."""
        companions = {c["species"] for c in self.companions()}
        program = []
        for t in self.design["breeding_program"]:
            plan = self.breeding.plan_lineage(t["species"], t["moves"], t["game"])
            chain, node = [], plan["plans"][0] if plan["plans"] else None
            while node:
                chain.append(node["father"])
                node = node["via"]
            fathers = list(reversed(chain))
            program.append({"target": f"{t['game']}:{t['species']}", "game": t["game"], "moves": t["moves"],
                            "source": t["source"], "fathers": fathers, "by_held_item": plan["by_held_item"],
                            "after_hatching": plan["learn_after_hatching"], "timing": plan["timing"],
                            "father_is_companion": [f for f in fathers if f in companions]})
        return program

    def residents(self, program=None):
        program = self.breeding_program() if program is None else program
        out = self.companions()
        have = {c["species"] for c in out}
        for p in program:
            for f in p["fathers"]:
                if f not in have:
                    have.add(f)
                    out.append({"id": f"stock:{f}", "species": f, "game": p["game"], "role": "breeding stock",
                                "status": f"father for {p['target']}"})
        return out

    # --- what land they need ---------------------------------------------------------
    def home_site(self, profile):
        """The proposed site for a resident: its native region's site if that offers its primary zone,
        else any site that does, else its native region's site."""
        sites = self.design["sites"]
        primary = profile.zones[0] if profile.zones else "meadow"
        native = [s for s in sites if s["region"] == profile.native_region]
        for pool in (native, sites):
            for s in pool:
                if primary in s["offers"]:
                    return s["id"]
        return native[0]["id"] if native else None

    # --- who can run it ----------------------------------------------------------------
    def _best_evidence(self, species, game):
        best = {}
        for e in self.wild.evidence(species, game):
            if e.capability not in best or TIER_RANK[e.tier] > TIER_RANK[best[e.capability].tier]:
                best[e.capability] = e
        return best

    def suggest_staff(self, capability, gen=4, limit=8):
        """Fully evolved species of Gen 1-4 whose overworld ability backs this capability in-game."""
        names = [a for a, (cap, _) in FIELD_ABILITIES.items() if cap == capability]
        if not names:
            return []
        rows = self.ref.q(f"""SELECT DISTINCT s.id FROM pokemon_abilities pa JOIN ability_names n
            ON n.ability_id=pa.ability_id AND n.local_language_id=9 JOIN pokemon_species s ON s.id=pa.pokemon_id
            WHERE n.name IN ({",".join("?" * len(names))}) AND CAST(s.id AS INT)<=? AND NOT EXISTS
            (SELECT 1 FROM pokemon_species c WHERE c.evolves_from_species_id=s.id AND CAST(c.id AS INT)<=?)""",
                          *names, DEX_MAX, DEX_MAX)
        out = []
        for (sid,) in rows:
            sp = self.ref.name(int(sid))
            held = [a for a in self.ref.abilities(sp, gen) if a in names]
            if held:
                out.append({"species": sp, "ability": held[0],
                            "native_region": self.habitat.profile(sp, gen).native_region})
        return sorted(out, key=lambda x: (x["native_region"], x["species"]))[:limit]

    # --- the census --------------------------------------------------------------------
    def census(self):
        program = self.breeding_program()
        res = self.residents(program)
        prof = {r["id"]: self.habitat.profile(r["species"]) for r in res}
        sites = {s["id"]: [] for s in self.design["sites"]}
        for rid, p in prof.items():
            sites.setdefault(self.home_site(p), []).append(rid)
        zones = {z: sorted(rid for rid, p in prof.items() if p.zones and p.zones[0] == z) for z in ZONES}
        staff, lore = {f: {} for f in FACILITIES}, {f: {} for f in FACILITIES}
        for r in res:
            best = self._best_evidence(r["species"], r["game"])
            for f, caps in FACILITIES.items():
                for c in caps:
                    if c not in best:
                        continue
                    e = best[c]
                    target = staff if TIER_RANK[e.tier] >= TIER_RANK["cartridge"] else lore
                    if e.tier != "inference":
                        target[f].setdefault(c, []).append(f"{r['species']} ({e.tier}: {e.source})")
        gaps = {f: [c for c in caps if c not in staff[f]] for f, caps in FACILITIES.items()}
        proposals = {c: self.suggest_staff(c) for c in sorted({c for v in gaps.values() for c in v})}
        groups = {}
        for r in res:
            for g in self.ref.breeding_groups(r["species"]):
                groups.setdefault(EGG_GROUP_NAMES.get(g, g), []).append(r["species"])
        no_egg_moves = sorted({r["species"] for r in res
                               if not self.breeding.feasibility(r["species"], r["game"]).get("egg_moves_possible", False)})
        return {
            "residents": res, "profiles": prof, "sites": sites,
            "zones_primary": {z: v for z, v in zones.items() if v},
            "native_regions": {reg: sorted(rid for rid, p in prof.items() if p.native_region == reg)
                               for reg in ("Kanto", "Johto", "Hoenn", "Sinnoh")},
            "sizes": {s: sorted(rid for rid, p in prof.items() if p.size == s) for s in ("small", "medium", "large", "huge")},
            "water": {w: sorted(rid for rid, p in prof.items() if p.water == w) for w in ("sea", "fresh")},
            "climate": {c: sorted(rid for rid, p in prof.items() if p.climate == c) for c in ("warm", "cold")},
            "staffing": staff, "story_candidates": lore, "staffing_gaps": {f: v for f, v in gaps.items() if v},
            "staff_proposals": {c: v for c, v in proposals.items() if v},
            "egg_group_pens": {g: sorted(set(v)) for g, v in sorted(groups.items(), key=lambda x: -len(set(x[1])))},
            "no_inherited_egg_moves": no_egg_moves, "breeding_program": program,
            "authoring_questions": self.design["authoring_questions"],
        }
