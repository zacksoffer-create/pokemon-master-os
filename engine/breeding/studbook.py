"""Studbook (D-044): the journey as one breeding web.

Every Pokémon of the journey should be a parent of breeding stock or a product of it. This engine says,
for each companion: what it can sire (egg moves it can pass to other journey lines), whether its own build
was bred (egg moves on record), whether its line has a ranch stud (D-038), and, for any companion with
neither role yet, the egg moves its line could be bred with: the menu for tinkering in the lab.
The lab runs on the ranch era's rules: Gen 4 (HGSS and Platinum), with Gen 3 moves arriving by Pal Park.
Genders aren't decided, so roles read "as a father" / "as a mother".
"""
import json
import os

import rules
from battle.engine import ROLES
from breeding.engine import BreedingEngine

CANON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "canon")
LAB_GAME = "heartgold"
LEVEL_UP, EGG, TUTOR, MACHINE = 1, 2, 3, 4


class Studbook:
    def __init__(self, db_path, canon_dir=CANON):
        self.breeding = BreedingEngine(db_path)
        self.ref = self.breeding.ref
        with open(os.path.join(canon_dir, "rosters.json"), encoding="utf-8") as fh:
            self.rosters = json.load(fh)
        with open(os.path.join(canon_dir, "builds.json"), encoding="utf-8") as fh:
            self.builds = json.load(fh)
        with open(os.path.join(canon_dir, "ranch.json"), encoding="utf-8") as fh:
            self.program = {t["species"] for t in json.load(fh)["breeding_program"]}
        _, _, self.gen_vgs, self.src_vgs = self.breeding.stock.ctx(LAB_GAME)
        self._cache = {}

    def companions(self):
        return [(ch["game"], sp) for ch in self.rosters["chapters"] for sp in ch["roster"]]

    # --- move sets in the lab's era ------------------------------------------------------
    def _ids(self, sql, *args):
        return {int(r[0]) for r in self.ref.q(sql, *args)}

    def egg_moves(self, species):
        """Egg moves of the species' family in Gen 4."""
        key = ("egg", species)
        if key not in self._cache:
            fam = self.ref.family(self.ref.species_id(species))
            self._cache[key] = self._ids(f"""SELECT DISTINCT move_id FROM pokemon_moves WHERE pokemon_id IN
                ({",".join(map(str, fam))}) AND version_group_id IN ({",".join(map(str, self.gen_vgs))})
                AND pokemon_move_method_id={EGG}""")
        return self._cache[key]

    def teachable(self, species):
        """Moves the species (or a pre-evolution) learns by itself: level-up, tutor or TM/HM, Gen 3-4."""
        key = ("own", species)
        if key not in self._cache:
            line = self.ref.line(self.ref.species_id(species))
            self._cache[key] = self._ids(f"""SELECT DISTINCT move_id FROM pokemon_moves WHERE pokemon_id IN
                ({",".join(map(str, line))}) AND version_group_id IN ({",".join(map(str, self.src_vgs))})
                AND pokemon_move_method_id IN ({LEVEL_UP},{TUTOR},{MACHINE})""")
        return self._cache[key]

    def _rates(self, species):
        return [self.ref.gender_rate(s) for s in self.ref.family(self.ref.species_id(species))]

    def can_father(self, species):
        return any(r not in (-1, 8) for r in self._rates(species))

    def can_mother(self, species):
        return any(r not in (-1, 0) for r in self._rates(species))

    def notable(self, move_name):
        """Worth breeding for: a real attack (60+ power), priority, or a strategic tool."""
        try:
            mv = rules.move(4, move_name)
        except KeyError:
            return False
        attack = rules.category(4, move_name) != "Status"
        return (attack and (mv["bp"] >= 60 or mv["priority"] > 0)) or any(move_name in r for r in ROLES.values())

    # --- the web -------------------------------------------------------------------------
    def sire_web(self, species_list=None, notable_only=False):
        """{father: {target line: [egg moves he can pass]}} across the given species (default: the journey).
        Works for any Pokémon, not only the journey's."""
        species = sorted(set(species_list or [sp for _, sp in self.companions()]))
        groups = {sp: set(self.ref.breeding_groups(sp)) for sp in species}
        fam = {sp: set(self.ref.family(self.ref.species_id(sp))) for sp in species}
        web = {}
        for father in species:
            if not self.can_father(father) or not groups[father]:
                continue
            for target in species:
                if fam[target] == fam[father] or not (groups[father] & groups[target]) or not self.can_mother(target):
                    continue
                # only moves the target line can't learn by itself: the father is the reason it has them
                moves = sorted(self.ref.move_name(m) for m in
                               (self.egg_moves(target) - self.teachable(target)) & self.teachable(father))
                if notable_only:
                    moves = [m for m in moves if self.notable(m)]
                if moves:
                    web.setdefault(father, {})[target] = moves
        return web

    def roles(self):
        web = self.sire_web(notable_only=True)
        sired_by = {}
        for father, targets in web.items():
            for target, moves in targets.items():
                for mv in moves:
                    sired_by.setdefault(target, {}).setdefault(mv, []).append(father)
        out = []
        for game, sp in self.companions():
            build = self.builds.get(game, {}).get(sp, {})
            egg = self.egg_moves(sp)
            own = self.teachable(sp)
            on_build = [m for m in build.get("moves", []) if self.ref.move_id(m) in egg]
            egg_only = [m for m in on_build if self.ref.move_id(m) not in own]
            role = []
            if web.get(sp):
                role.append("sire")
            if not self.can_father(sp) and self.can_mother(sp):
                role.append("dam (female-only line)")
            if not self.can_father(sp) and not self.can_mother(sp):
                role.append("Ditto line (genderless: parent and product only with Ditto, no egg moves)")
            if egg_only:
                role.append("product")
            elif on_build:
                role.append("product (optional: its egg moves can also be learned)")
            if sp in self.program:
                role.append("stud line")
            entry = {"companion": f"{game}:{sp}", "species": sp, "roles": role, "as_father": web.get(sp, {}),
                     "bred_moves": {m: sired_by.get(sp, {}).get(m, []) for m in egg_only},
                     "journey_chains": {m: [f"{g} → {s2}" for g, s2 in self.journey_chain(sp, m)]
                                        for m in egg_only if not sired_by.get(sp, {}).get(m)},
                     "egg_or_learned": [m for m in on_build if m not in egg_only],
                     "can_father": self.can_father(sp), "can_mother": self.can_mother(sp)}
            if not egg_only:   # the menu: what its line could be bred with, and which journey fathers can give it
                entry["tinker_menu"] = {self.ref.move_name(m): sired_by.get(sp, {}).get(self.ref.move_name(m), [])
                                        for m in sorted(egg - own) if self.notable(self.ref.move_name(m))}
            out.append(entry)
        return out

    def journey_chain(self, target, move_name):
        """Two-step chains inside the journey: a grandsire teaches a sire by breeding, the sire passes it on.
        [(grandsire, sire)] for a target line and one of its egg moves."""
        mid = self.ref.move_id(move_name)
        species = sorted({sp for _, sp in self.companions()})
        tgroups = set(self.ref.breeding_groups(target))
        out = []
        for sire in species:
            if (sire == target or not self.can_father(sire) or mid not in self.egg_moves(sire)
                    or not tgroups & set(self.ref.breeding_groups(sire))):
                continue
            sgroups = set(self.ref.breeding_groups(sire))
            for grand in species:
                if (grand not in (sire, target) and self.can_father(grand) and self.can_mother(sire)
                        and mid in self.teachable(grand) and sgroups & set(self.ref.breeding_groups(grand))):
                    out.append((grand, sire))
        return out

    def leaderboard(self):
        """Journey fathers ranked by how many notable (line, move) pairs they can pass."""
        web = self.sire_web(notable_only=True)
        return sorted(((f, sum(len(m) for m in t.values()), len(t)) for f, t in web.items()), key=lambda x: -x[1])
