"""Breeding engine: what can be passed down, by whom, through how many generations, per game.

Gen 2-4 inheritance rules every plan here obeys:
  - egg moves come only from the father (a Ditto parent passes none)
  - the father's TM/HM moves pass if the baby can learn that TM/HM
  - level-up moves known by both parents pass if the baby learns them by level-up
  - Light Ball on a parent gives Pichu Volt Tackle (Emerald and Gen 4)
  - incense babies (Gen 3-4) only hatch if a parent holds the incense
Lines that are male-only or genderless can't receive egg moves at all (their only partner is
Ditto, and the father would have to be the same line already knowing the move).
"""
import rules
from refdb import Ref

INCENSE_BABIES = {
    3: {"Azurill": "Sea Incense", "Wynaut": "Lax Incense"},
    4: {"Azurill": "Sea Incense", "Wynaut": "Lax Incense", "Munchlax": "Full Incense",
        "Happiny": "Luck Incense", "Mime Jr.": "Odd Incense", "Bonsly": "Rock Incense",
        "Budew": "Rose Incense", "Chingling": "Pure Incense", "Mantyke": "Wave Incense"},
}


class BreedingEngine:
    def __init__(self, db_path):
        self.ref = Ref(db_path)

    def egg_moves(self, species, game):
        vg = rules.GAME_VG[game]
        fam = self.ref.family(self.ref.species_id(species))
        rows = self.ref.q(f"""SELECT DISTINCT m.identifier FROM pokemon_moves pm JOIN moves m ON m.id=pm.move_id
            WHERE pm.pokemon_id IN ({",".join(map(str, fam))}) AND pm.version_group_id=?
              AND pm.pokemon_move_method_id IN (2, 6)""", vg)
        return sorted(self.ref.move_name(self.ref.move_id(r[0])) for r in rows)

    def feasibility(self, species, game):
        """Can this line hatch with inherited egg moves at all, and what does it need?"""
        gen = rules.GAME_GEN[game]
        fam = self.ref.family(self.ref.species_id(species))
        rates = {self.ref.name(s): self.ref.gender_rate(s) for s in fam}
        groups = self.ref.breeding_groups(species)
        notes = []
        if not groups:
            return {"breedable": False, "notes": ["this line can't breed (No Eggs group)"]}
        if all(r == -1 for r in rates.values()):
            return {"breedable": True, "egg_moves_possible": False,
                    "notes": ["genderless: breeds only with Ditto, so no egg moves can be inherited"]}
        if all(r == 0 for r in rates.values()):
            return {"breedable": True, "egg_moves_possible": False,
                    "notes": ["male-only: breeds only with Ditto, so no egg moves can be inherited"]}
        for baby, incense in INCENSE_BABIES.get(gen, {}).items():
            if baby in rates:
                notes.append(f"{baby} only hatches if a parent holds {incense}; otherwise the egg is the next stage")
        female_share = max(r for r in rates.values() if r >= 0) / 8
        if female_share < 0.5:
            notes.append(f"only {female_share:.1%} of this line is female; a female of the line must be the mother")
        return {"breedable": True, "egg_moves_possible": True, "egg_groups": groups, "notes": notes}

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

    # --- multi-generation planning -------------------------------------------------
    def _fam(self, sid):
        return tuple(sorted(self.ref.family(sid)))

    def _routes(self, fam, mid, vgs, methods):
        return [(s, m, l, v) for s in fam for v in vgs for m, l in self.ref.methods(s, mid, v) if m in methods]

    def _ctx(self, game):
        vg = rules.GAME_VG[game]
        gen = rules.GAME_GEN[game]
        from refdb import TRANSFER_FROM, VG_GEN
        gen_vgs = [v for v, g in VG_GEN.items() if g == gen]
        src_vgs = gen_vgs + [v for v, g in VG_GEN.items() if g in TRANSFER_FROM.get(gen, [])]
        return vg, gen_vgs, src_vgs

    def _candidates(self, fam):
        groups = {g for s in fam for g in self.ref.egg_groups(s) if g not in ("no-eggs", "ditto")}
        out = set()
        for g in groups:
            for r in self.ref.q("SELECT p.species_id FROM pokemon_egg_groups p JOIN egg_groups e ON e.id=p.egg_group_id "
                                "WHERE e.identifier=? AND p.species_id<=493", g):
                f = self._fam(int(r[0]))
                if any(self.ref.gender_rate(s) not in (-1, 8) for s in f):
                    out.add(f)
        return out

    def _search(self, fam, need, game, depth, visited, memo):
        key = (fam, need, depth)
        if key in memo:
            return memo[key]
        vg, gen_vgs, src_vgs = self._ctx(game)
        plans = []
        for f in self._candidates(fam):
            direct = {m: self._routes(f, m, src_vgs, ("level-up", "tutor", "machine")) for m in need}
            inherit = frozenset(m for m in need if not direct[m])
            if any(not self._routes(f, m, gen_vgs, ("egg",)) for m in inherit):
                continue                                   # f can't even hatch with it
            sub = None
            if inherit:
                if f == fam or f in visited or depth <= 1:
                    continue
                if not any(self.ref.gender_rate(s) not in (-1, 0) for s in f):
                    continue                               # no female of f's line to hatch it from
                subs = self._search(f, inherit, game, depth - 1, visited | {f}, memo)
                if not subs:
                    continue
                sub = subs[0]
            native = all(any(r[3] in gen_vgs for r in direct[m]) for m in need if direct[m]) and (
                sub is None or sub["native"])                # no Pal Park / Time Capsule transfer needed
            catchable = bool(self.ref.wild_in(self.ref.name(f[0]), game)) or any(
                self.ref.wild_in(self.ref.name(s), game) for s in f)
            stage = max(f, key=lambda s: (len([m for m in need if self._routes((s,), m, src_vgs,
                                                                             ("level-up", "tutor", "machine"))]), s))
            plans.append({"father": self.ref.name(stage),
                          "family": [self.ref.name(s) for s in f],
                          "learns_itself": {self.ref.move_name(m): [
                              f"{self.ref.name(s)} {mm}{' L' + str(l) if mm == 'level-up' else ''} (vg{v})"
                              for s, mm, l, v in sorted(set(direct[m]), key=lambda r: (r[0] != stage, r[3] != vg, r[3]))][:2]
                              for m in need if direct[m]},
                          "inherits": [self.ref.move_name(m) for m in inherit], "via": sub,
                          "steps": 1 + (sub["steps"] if sub else 0), "native": native,
                          "catchable_in_game": catchable})
        plans.sort(key=lambda p: (p["steps"], not p["native"], not p["catchable_in_game"], len(p["inherits"])))
        memo[key] = plans[:5]
        return memo[key]

    def plan_lineage(self, species, moves, game, max_depth=3):
        """Shortest lineage that hatches `species` knowing every egg move in `moves` at once.
        The father must know them all together; anything he can't learn himself must be bred into him."""
        vg, gen_vgs, src_vgs = self._ctx(game)
        sid = self.ref.species_id(species)
        fam = self._fam(sid)
        mids = [self.ref.move_id(m) for m in moves]
        light_ball = [m for m in mids if self._routes(fam, m, [vg], ("light-ball-egg",))]
        egg = frozenset(m for m in mids if m not in light_ball and self._routes(fam, m, [vg], ("egg",)))
        later = [self.ref.move_name(m) for m in mids if m not in egg and m not in light_ball]
        result = {"target": species, "game": game, "egg_moves": [self.ref.move_name(m) for m in egg],
                  "by_held_item": [f"{self.ref.move_name(m)}: either parent holds a Light Ball; no father needed"
                                   for m in light_ball],
                  "learn_after_hatching": later, "timing": [t for m in moves for t in self.timing(species, m, game)],
                  "feasibility": self.feasibility(species, game)}
        if len(egg) > 4:
            result["plans"] = []
            result["note"] = "more than four egg moves can't be carried at once"
            return result
        result["plans"] = self._search(fam, egg, game, max_depth, {fam}, {}) if egg else []
        return result

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
        vg = rules.GAME_VG[game]
        res = self.ref.learn(species, move, vg)
        native = [r for r in res["routes"] if r[0] == "native"]
        notes = []
        if any(m == "light-ball-egg" for _, _, m, _, _ in native):
            notes.append(f"{res['move']}: a parent must hold a Light Ball when the egg is made")
        final = self.ref.name(self.ref.species_id(species))
        if native and all(m == "level-up" and st != final for _, st, m, _, _ in native):
            st, lvl = min(((st, l) for _, st, m, l, _ in native), key=lambda x: x[1])
            evo = self.ref.q("""SELECT e.minimum_level FROM pokemon_evolution e JOIN pokemon_species s ON s.id=e.evolved_species_id
                WHERE s.evolves_from_species_id=? LIMIT 1""", self.ref.species_id(st))
            when = f" before it evolves at Lv {evo[0][0]}" if evo and evo[0][0] else " before it evolves"
            notes.append(f"{res['move']}: must be learned as {st} at Lv {lvl}{when}; later forms can't relearn it")
        if not native and res["routes"]:
            where = sorted({f"vg{v}" for *_, v in res["routes"]})
            notes.append(f"{res['move']}: not learnable in {game} itself; only in {', '.join(where)} (trade/transfer)")
        return notes

    def stock(self, targets):
        """Ranch roster: fathers that serve the most (species, move, game) targets at once."""
        serves = {}
        for species, mv, game in targets:
            c = self.ref.chain(species, mv, rules.GAME_VG[game], max_hops=1)
            for ch in c["chains"]:
                father = ch["path"][0][0]
                serves.setdefault(father, set()).add(f"{species}:{mv}")
        return sorted(((f, sorted(t)) for f, t in serves.items()), key=lambda x: -len(x[1]))
