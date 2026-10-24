"""Breeding engine: what can be passed down, by whom, through how many generations, per game.

Gen 2-4 inheritance rules every plan here obeys:
  - egg moves come only from the father (a Ditto parent passes none)
  - the father's TM/HM moves pass if the baby can learn that TM/HM
  - level-up moves known by both parents pass if the baby learns them by level-up
  - Light Ball on a parent gives Pichu Volt Tackle (Emerald and Gen 4)
  - incense babies (Gen 3-4) only hatch if a parent holds the incense
Lines that are male-only or genderless can't receive egg moves at all (their only partner is
Ditto, and the father would have to be the same line already knowing the move).

The lineage search, feasibility and timing live in breeding/stock.py (one implementation, read from the same data
pack the browser gets); this class keeps their old names. stock.py also holds the full hatch order (slots and
push-out) read from the games' code.
"""
import rules
from breeding.stock import INCENSE_BABIES, Stock, load
from refdb import Ref


class BreedingEngine:
    def __init__(self, db_path):
        self.ref = Ref(db_path)
        self.stock = Stock(load(db_path))

    def egg_moves(self, species, game):
        vg = rules.GAME_VG[game]
        fam = self.ref.family(self.ref.species_id(species))
        rows = self.ref.q(f"""SELECT DISTINCT m.identifier FROM pokemon_moves pm JOIN moves m ON m.id=pm.move_id
            WHERE pm.pokemon_id IN ({",".join(map(str, fam))}) AND pm.version_group_id=?
              AND pm.pokemon_move_method_id IN (2, 6)""", vg)
        return sorted(self.ref.move_name(self.ref.move_id(r[0])) for r in rows)

    def feasibility(self, species, game):
        """Can this line hatch with inherited egg moves at all, and what does it need?"""
        return self.stock.feasibility(species, game)

    def bundle(self, species, moves, game):
        """One-step fathers that can know every move in `moves` at once and pass them all in one egg."""
        vg = rules.GAME_VG[game]
        missing = [m for m in moves if not self.ref.egg_move_of(species, m, vg)]
        if missing:
            return {"fathers": [], "note": f"not egg moves for this line in {game}: {missing}"}
        sets = []
        for mv in moves:
            c = self.ref.chain(species, mv, vg, max_hops=1)
            sets.append({f for ch in c["chains"] for (f, _, _) in ch["path"][:1]})
        common = set.intersection(*sets) if sets else set()
        return {"fathers": sorted(common),
                "note": "each of these can know all the moves together and pass them in one egg"
                        if common else "no single father knows all of them; breed in stages"}

    def plan(self, species, moves, game):
        """A full plan: feasibility, a one-egg bundle if one exists, otherwise a chain per move."""
        vg = rules.GAME_VG[game]
        result = {"target": species, "game": game, "feasibility": self.feasibility(species, game)}
        egg = [m for m in moves if self.ref.egg_move_of(species, m, vg)]
        result["not_egg_moves"] = [m for m in moves if m not in egg]
        if len(egg) > 1:
            result["bundle"] = self.bundle(species, egg, game)
        result["chains"] = {}
        for mv in egg:
            c = self.ref.chain(species, mv, vg)
            result["chains"][mv] = [{"steps": " -> ".join(f"{f}♂ x {m}♀ [{g}]" for f, m, g in ch["path"]),
                                     "first_father_learns_it": ch["source"][0]} for ch in c["chains"][:5]]
        return result

    # --- multi-generation planning (breeding/stock.py) ------------------------------------------------------
    def plan_lineage(self, species, moves, game, max_depth=3):
        """Shortest lineage that hatches `species` knowing every egg move in `moves` at once.
        The father must know them all together; anything he can't learn himself must be bred into him."""
        return self.stock.plan_lineage(species, moves, game, max_depth)

    @staticmethod
    def render(plan):
        """A lineage plan as numbered breeding steps, oldest generation first."""
        chain, node = [], plan
        while node:
            chain.append(node)
            node = node["via"]
        lines = []
        for i, step in enumerate(reversed(chain), 1):
            own = "; ".join(f"{mv}: {r[0]}" for mv, r in step["learns_itself"].items())
            inh = f" + inherited {', '.join(step['inherits'])}" if step["inherits"] else ""
            lines.append(f"{i}. {step['father']} ♂ ({own or 'nothing of its own'}{inh})"
                         f"{' [catchable here]' if step['catchable_in_game'] else ''}")
        return lines

    def timing(self, species, move, game):
        """Warnings about *when* a move must be learned (before evolving, Light Ball, other game only)."""
        return self.stock.timing(species, move, game)

    def ranch_stock(self, targets):
        """Ranch roster: fathers that serve the most (species, move, game) targets at once."""
        serves = {}
        for species, mv, game in targets:
            c = self.ref.chain(species, mv, rules.GAME_VG[game], max_hops=1)
            for ch in c["chains"]:
                father = ch["path"][0][0]
                serves.setdefault(father, set()).add(f"{species}:{mv}")
        return sorted(((f, sorted(t)) for f, t in serves.items()), key=lambda x: -len(x[1]))
