"""Ranch planner: the Champion's breeding ranch (D-035) as a system.

Inputs are canon: the rosters (canon/rosters.json), the ranch design (canon/ranch.json) and the
authored world (canon/world.json). The design fixes the shape (D-036 to D-040):
  - one headquarters; satellites only for land it can't give (D-036)
  - companions' fates are open, so every companion is a *possible* resident (D-037)
  - the breeding program keeps only its final product, one stud per line (D-038)
  - staff are Pokémon and people (D-039); the Day-Care preserve is the only open part (D-040)
The census answers who could live there, what land they need, which satellites the headquarters needs,
who can run each facility (and which jobs hang on a single Pokémon), and what the breeding program keeps.
Nothing here decides the ranch; site locations and story are authored.
"""
import json
import os
from itertools import combinations

import rules
from breeding.engine import BreedingEngine
from ranch.habitat import ZONES, HabitatEngine
from wilderness.engine import FIELD_ABILITIES, TIER_RANK, WildernessEngine
from wilderness.world import WorldStore

HERE = os.path.dirname(os.path.abspath(__file__))
CANON = os.path.join(os.path.dirname(HERE), "canon")
DEX_MAX = 493
# The ranch is the present day at Blackthorn, under Gen 4 rules (D-042, D-044): every resident is read in this game
# for staffing, not in the chapter it came from (B39: a Crystal companion had no abilities, FireRed only Pickup).
PRESENT_GAME = "heartgold"
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
        self.sites = {s["id"]: s for s in self.design["sites"]}
        self.hq = self.design["shape"]["headquarters"]

    # --- who could live there ------------------------------------------------------
    def companions(self):
        """Every companion, as a possible resident: where each one ends up is left open (D-037)."""
        return [{"id": f"{ch['game']}:{sp}", "species": sp, "game": ch["game"], "role": "companion",
                 "fate": "open", "status": ch["status"]} for ch in self.rosters["chapters"] for sp in ch["roster"]]

    def breeding_program(self):
        return [self.program_entry(t) for t in self.design["breeding_program"]]

    def program_entry(self, t):
        """One lineage the canon asks for: the fathers used to build it (not kept) and what the ranch
        keeps (D-038): one male of the target line who knows the whole egg-move set, or the held item."""
        plan = self.breeding.plan_lineage(t["species"], t["moves"], t["game"])
        chain, node = [], plan["plans"][0] if plan["plans"] else None
        while node:
            chain.append(node["father"])
            node = node["via"]
        sid = self.ref.species_id(t["species"])
        has_males = any(self.ref.gender_rate(s) not in (-1, 8) for s in self.ref.family(sid))
        if plan["egg_moves"] and has_males:
            kept = {"kind": "stud", "species": t["species"], "sex": "male", "knows": plan["egg_moves"]}
        elif plan["by_held_item"]:
            kept = {"kind": "item", "item": "Light Ball", "note": plan["by_held_item"][0]}
        else:
            kept = {"kind": "none", "note": "no egg moves to carry"}
        return {"target": f"{t['game']}:{t['species']}", "game": t["game"], "moves": t["moves"],
                "source": t["source"], "fathers_used": list(reversed(chain)), "kept": kept,
                "after_hatching": plan["learn_after_hatching"], "timing": plan["timing"]}

    def residents(self, program=None):
        program = self.breeding_program() if program is None else program
        studs = [{"id": f"stud:{p['kept']['species']}", "species": p["kept"]["species"], "game": p["game"],
                  "role": "stud", "fate": "kept", "status": f"♂ knowing {', '.join(p['kept']['knows'])}"}
                 for p in program if p["kept"]["kind"] == "stud"]
        return self.companions() + studs

    # --- what land they need ---------------------------------------------------------
    def home_site(self, profile, satellites=None):
        """The headquarters if it offers the resident's primary zone; otherwise a satellite that does,
        its native region's first."""
        primary = profile.zones[0] if profile.zones else "meadow"
        if primary in self.sites[self.hq]["offers"]:
            return self.hq
        pool = [self.sites[s] for s in (satellites or [s for s in self.sites if s != self.hq])]
        for s in sorted(pool, key=lambda s: s["region"] != profile.native_region):
            if primary in s["offers"]:
                return s["id"]
        return None

    def satellite_options(self, profiles):
        """Smallest sets of satellites that give every resident its primary zone."""
        missing = sorted({p.zones[0] for p in profiles.values()
                          if p.zones and p.zones[0] not in self.sites[self.hq]["offers"]})
        needs = {z: sorted(rid for rid, p in profiles.items() if p.zones and p.zones[0] == z) for z in missing}
        candidates = [s for s in self.sites if s != self.hq]
        for k in range(len(candidates) + 1):
            sets = [c for c in combinations(candidates, k)
                    if all(any(z in self.sites[s]["offers"] for s in c) for z in missing)]
            if sets:
                return {"hq_lacks": needs, "minimum": [list(c) for c in sets]}
        return {"hq_lacks": needs, "minimum": [], "uncovered": missing}

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

    def staffing(self, residents, facilities=None):
        """Per facility: Pokémon the games (or authored canon) back for each job, Pokédex story candidates,
        the people roles, open jobs, and jobs that hang on a single species."""
        best = {r["id"]: self._best_evidence(r["species"], PRESENT_GAME) for r in residents}
        species = {r["id"]: r["species"] for r in residents}
        out = {}
        for f in facilities or self.design["facilities"]:
            jobs, story = {}, {}
            for c in f["needs"]:
                for rid, ev in best.items():
                    e = ev.get(c)
                    if not e or e.tier == "inference":
                        continue
                    target = jobs if TIER_RANK[e.tier] >= TIER_RANK["cartridge"] else story
                    entry = f"{species[rid]} ({e.tier}: {e.source})"
                    if entry not in target.setdefault(c, []):
                        target[c].append(entry)
            single = {c: v[0] for c, v in jobs.items() if len({x.split(" (")[0] for x in v}) == 1}
            out[f["name"]] = {"access": f.get("access", "private"), "people": f["people"], "pokemon": jobs,
                              "story_candidates": story,
                              "open_jobs": [c for c in f["needs"] if c not in jobs], "single_species": single}
        return out

    # --- the census --------------------------------------------------------------------
    def census(self):
        program = self.breeding_program()
        res = self.residents(program)
        prof = {r["id"]: self.habitat.profile(r["species"]) for r in res}
        options = self.satellite_options(prof)
        chosen = self.design["shape"].get("satellites")          # empty until Zack picks one
        pending = "satellite (" + " or ".join("+".join(o) for o in options["minimum"]) + ")"
        sites = {self.hq: []}
        for rid, p in prof.items():
            home = self.home_site(p, chosen)
            sites.setdefault(home if chosen or home == self.hq else pending, []).append(rid)
        zones = {z: sorted(rid for rid, p in prof.items() if p.zones and p.zones[0] == z) for z in ZONES}
        staff = self.staffing(res)
        open_jobs = sorted({c for f in staff.values() for c in f["open_jobs"]})
        groups = {}
        for r in res:
            for g in self.ref.breeding_groups(r["species"]):
                groups.setdefault(EGG_GROUP_NAMES.get(g, g), set()).add(r["species"])
        no_egg_moves = sorted({r["species"] for r in res
                               if not self.breeding.feasibility(r["species"], r["game"]).get("egg_moves_possible", False)})
        return {
            "shape": {k: self.design[k]["rule"] for k in ("shape", "residents_policy", "stock_policy",
                                                           "staffing_policy", "access")},
            "residents": res, "profiles": prof, "headquarters": self.hq, "sites": {k: v for k, v in sites.items() if v},
            "satellite_options": options,
            "zones_primary": {z: v for z, v in zones.items() if v},
            "native_regions": {reg: sorted(rid for rid, p in prof.items() if p.native_region == reg)
                               for reg in ("Kanto", "Johto", "Hoenn", "Sinnoh")},
            "sizes": {s: sorted(rid for rid, p in prof.items() if p.size == s) for s in ("small", "medium", "large", "huge")},
            "water": {w: sorted(rid for rid, p in prof.items() if p.water == w) for w in ("sea", "fresh")},
            "climate": {c: sorted(rid for rid, p in prof.items() if p.climate == c) for c in ("warm", "cold")},
            "facilities": staff,
            "staff_proposals": {c: v for c in open_jobs if (v := self.suggest_staff(c))},
            "egg_group_pens": {g: sorted(v) for g, v in sorted(groups.items(), key=lambda x: -len(x[1]))},
            "no_inherited_egg_moves": no_egg_moves, "breeding_program": program,
            "authoring_questions": self.design["authoring_questions"],
        }
