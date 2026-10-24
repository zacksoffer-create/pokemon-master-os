"""Lineage tracker (D-038, D-044): every individual at Blackthorn and where it came from.

The studbook (breeding/studbook.py) says what each *species* can pass on; this file follows *individuals*: who
sired whom, with which dam, in which generation, which moves came down from which parent, and what became of each
one. Two kinds of record, merged by id:
- **Planned**, derived from canon: the founders (every companion of the journey, generation 0) and, for each target
  in the breeding program (canon/ranch.json), the crosses that build its stud: the father used, the line female, any
  generation in between, and the stud that's kept. Nothing here is authored; it follows from D-038 the way the
  census follows from the rosters.
- **Authored**, in canon/lineage.json: what you've decided or recorded. A sex, a name, a hatch that happened, a
  father who turned out to be a companion. An authored record overrides the planned one with the same id, field by
  field, and new ids add hatchlings to the tree.

The rules every bred individual is checked against (the game its cross is planned for; Gen 4, the ranch era, D-044,
unless a target says otherwise; B28) are in `check`: parents exist; the
sire can be male and the dam female (or one is Ditto); they share an egg group; the egg hatches as the dam's line;
each move inherited from the sire is an egg move of that line and one the sire can know; the generation is one past
the older parent; nobody is their own ancestor; a stud is male-capable and carries his line's whole program set.
Genders aren't decided yet, so a parent's sex reads "could be" until you set it.
"""
import json
import os

from breeding.engine import INCENSE_BABIES, BreedingEngine

HERE = os.path.dirname(os.path.abspath(__file__))
CANON = os.path.join(os.path.dirname(HERE), "canon")
LAB_GAME, LAB_GEN = "heartgold", 4
GAME_GEN = {"crystal": 2, "firered": 3, "emerald": 3, "platinum": 4, "soulsilver": 4, "heartgold": 4}
GAME_ABBR = {"crystal": "C", "firered": "FR", "emerald": "E", "platinum": "PT", "soulsilver": "SS", "heartgold": "HG"}
GAME_NAME = {"crystal": "Crystal", "firered": "FireRed", "emerald": "Emerald", "platinum": "Platinum",
             "soulsilver": "SoulSilver", "heartgold": "HeartGold"}
FIELDS = ("id", "name", "species", "hatched_as", "line", "sex", "generation", "sire", "dam", "moves", "inherited",
          "role", "origin", "fate", "status", "program", "chapter", "decision", "note", "game")


def _key(s):
    return "".join(ch for ch in s.upper() if ch.isalnum())


class Lineage:
    def __init__(self, db_path, canon_dir=CANON):
        self.breeding = BreedingEngine(db_path)
        self.ref = self.breeding.ref
        self.canon_dir = canon_dir
        with open(os.path.join(canon_dir, "rosters.json"), encoding="utf-8") as fh:
            self.rosters = json.load(fh)
        with open(os.path.join(canon_dir, "builds.json"), encoding="utf-8") as fh:
            self.builds = json.load(fh)
        with open(os.path.join(canon_dir, "ranch.json"), encoding="utf-8") as fh:
            self.program_targets = json.load(fh)["breeding_program"]
        path = os.path.join(canon_dir, "lineage.json")
        self.authored_doc = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {"individuals": []}
        self._egg = {}

    # --- species facts ---------------------------------------------------------------------------------
    def sid(self, species):
        return self.ref.species_id(species)

    def rate(self, species):
        """Gender rate in eighths female: -1 genderless, 0 male-only, 8 female-only."""
        return self.ref.gender_rate(self.sid(species))

    def can_be(self, species, sex):
        r = self.rate(species)
        if species == "Ditto":
            return sex == "genderless"
        return {"male": r not in (-1, 8), "female": r not in (-1, 0), "genderless": r == -1}[sex]

    def groups(self, species):
        """The breedable egg groups of the line (a baby's 'no eggs' read through its adult forms)."""
        fam = self.ref.family(self.sid(species))
        return sorted({g for s in fam for g in self.ref.egg_groups(s) if g not in ("no-eggs",)})

    def hatches_as(self, species, game=LAB_GAME):
        """What an egg from this line's female hatches as in that game (Gen 4 at the ranch): the line's first stage,
        except an incense baby, which needs its incense held (otherwise the next stage)."""
        gen = GAME_GEN.get(game, LAB_GEN)
        chain = [s for s in reversed(self.ref.line(self.sid(species))) if s <= {2: 251, 3: 386, 4: 493}[gen]]
        names = [self.ref.name(s) for s in chain]
        if names[0] in INCENSE_BABIES.get(gen, {}) and len(names) > 1:
            return names[1]
        return names[0]

    def egg_moves(self, species, game=LAB_GAME):
        if (species, game) not in self._egg:
            self._egg[(species, game)] = set(self.breeding.egg_moves(species, game))
        return self._egg[(species, game)]

    def knows_itself(self, species, move, game=LAB_GAME):
        """Can this line learn the move without inheriting it (level-up, TM, tutor; transfer allowed, D-048)?
        B28: in the game the cross is planned for, not always HeartGold."""
        try:
            res = self.ref.learn(species, move, {"crystal": 4, "firered": 7, "emerald": 6, "platinum": 9}.get(game, 10))
        except KeyError:
            return False
        return any(r[2] in ("level-up", "machine", "tutor") for r in res["routes"])

    # --- the founders -----------------------------------------------------------------------------------
    def founders(self):
        out = []
        for ch in self.rosters["chapters"]:
            for sp in ch["roster"]:
                b = self.builds.get(ch["game"], {}).get(sp, {})
                out.append({"id": f"{GAME_ABBR[ch['game']]}-{_key(sp)}", "name": f"{GAME_NAME[ch['game']]} {sp}",
                            "species": sp, "hatched_as": None, "line": self.hatches_as(sp, ch["game"]), "sex": "open",
                            "generation": 0, "sire": None, "dam": None, "moves": b.get("moves", []), "inherited": [],
                            "role": "companion", "origin": f"the journey: {GAME_NAME[ch['game']]}",
                            "fate": "open (D-037)", "status": ch["status"], "program": None,
                            "chapter": GAME_NAME[ch["game"]], "decision": ch.get("decision"),
                            "note": f"build: {b.get('status')}" if b else "no build on record", "game": ch["game"]})
        return out

    # --- the program's crosses ----------------------------------------------------------------------------
    def _companion_of(self, species, founders, game=None):
        """Journey companions of this species, the ones that can reach `game` on cartridge first (the same
        generation, or Gen 3 -> 4 by Pal Park); a Crystal companion in a Gen 4 cross stays possible (B29, your call)."""
        comps = [f for f in founders if f["species"] == species]
        if game:
            comps.sort(key=lambda f: not self._reaches(f, game))
        return comps

    @staticmethod
    def _reaches(founder, game):
        src = next((g for g, n in GAME_NAME.items() if n == founder.get("chapter")), None)
        a, b = GAME_GEN.get(src), GAME_GEN.get(game)
        return a is not None and (a == b or (a, b) == (3, 4))

    def _pick(self, plans, game, founders):
        """The plan to build: the shortest, and among the shortest one whose first father is a companion who can
        reach the game (D-038: a journey companion can be the father); otherwise the engine's first."""
        best = min(p["steps"] for p in plans)
        for p in plans:
            node = p
            while node["via"]:
                node = node["via"]
            if p["steps"] == best and any(self._reaches(c, game) for c in self._companion_of(node["father"], founders)):
                return p
        return plans[0]

    def program(self, founders=None):
        """The planned pedigree for every breeding-program target: the steps oldest first, each a cross."""
        founders = self.founders() if founders is None else founders
        people, crosses = [], []
        for t in self.program_targets:
            plan = self.breeding.plan_lineage(t["species"], t["moves"], t["game"])
            target = f"{GAME_NAME[t['game']]} {t['species']}"
            line = self.hatches_as(t["species"], t["game"])
            if not plan["plans"]:
                if plan["by_held_item"]:
                    crosses.append({"program": target, "kind": "item", "line": line, "moves": t["moves"],
                                    "note": plan["by_held_item"][0]})
                continue
            chain, node = [], self._pick(plan["plans"], t["game"], founders)
            while node:
                chain.append(node)
                node = node["via"]
            chain.reverse()                                      # oldest father first
            sire_id, sire_gen = None, 0
            for i, step in enumerate(chain):
                fam = step["father"]
                passes = list(step["learns_itself"]) + step["inherits"]
                if i == 0:                                       # the first father learns it all himself
                    comps = self._companion_of(fam, founders, t["game"])
                    if comps:
                        sire_id, origin = comps[0]["id"], comps[0]["origin"]
                        note = f"a journey companion, if he's male ({comps[0]['name']})"
                    else:
                        sire_id = f"F-{_key(fam)}-{_key(t['species'])}"
                        people.append(self._record(sire_id, f"{fam} (borrowed father)", fam, None, "male", 0, None,
                                                   None, passes, [], "father used", "borrowed for the cross",
                                                   "goes home (D-038)", target,
                                                   f"learns {', '.join(step['learns_itself'])} itself", t["game"]))
                    sire_gen = 0
                    continue
                # a bred father in between: the previous father x a female of this line
                dam_id = f"D-{_key(fam)}-{_key(t['species'])}"            # a line female, for this target
                people.append(self._dam(dam_id, fam, target, founders, t["game"]))
                bred_id = f"B-{_key(fam)}-{_key(t['species'])}"
                people.append(self._record(
                    bred_id, f"{fam} ♂ bred for the {t['species']} line", fam, self.hatches_as(fam, t["game"]), "male",
                    sire_gen + 1, sire_id, dam_id, passes, [{"move": m, "from": sire_id} for m in step["inherits"]],
                    "father used", "bred at Blackthorn", "goes home (D-038)", target,
                    f"hatches knowing {', '.join(step['inherits'])}; then learns "
                    f"{', '.join(step['learns_itself']) or 'nothing more'} itself", t["game"]))
                crosses.append({"program": target, "kind": "cross", "sire": sire_id, "dam": dam_id, "child": bred_id,
                                "moves": step["inherits"]})
                sire_id, sire_gen = bred_id, sire_gen + 1
            # the final cross: the last father x a female of the target line -> the stud that's kept
            dam_id = f"D-{_key(t['species'])}"
            people.append(self._dam(dam_id, t["species"], target, founders, t["game"]))
            stud_id = f"S-{_key(t['species'])}"
            last = chain[-1]
            people.append(self._record(
                stud_id, f"{t['species']}-line stud", t["species"], line, "male", sire_gen + 1, sire_id, dam_id,
                plan["egg_moves"], [{"move": m, "from": sire_id} for m in plan["egg_moves"]], "stud",
                "bred at Blackthorn", "kept: sires every future egg of the line in one step (D-038)", target,
                f"hatches as {line} knowing {', '.join(plan['egg_moves'])}" + self._incense(t["species"]), t["game"]))
            crosses.append({"program": target, "kind": "cross", "sire": sire_id, "dam": dam_id, "child": stud_id,
                            "moves": plan["egg_moves"], "last_father": last["father"]})
        return people, crosses

    def _incense(self, species):
        root = self.ref.name(self.ref.line(self.sid(species))[-1])
        item = INCENSE_BABIES[LAB_GEN].get(root)
        return f" (as {root} if a parent holds {item})" if item else ""

    def _dam(self, dam_id, species, target, founders, game=LAB_GAME):
        comps = [f for f in self._companion_of(species, founders, game) if self.can_be(species, "female")]
        could = f" Could be {', '.join(c['name'] for c in comps)}, if she's female." if comps else ""
        return self._record(dam_id, f"{species}-line female", species, None, "female", 0, None, None, [], [], "dam",
                            "a ranch female of the line", "stays at the ranch", target,
                            f"any female of the line carries the egg.{could}", game)

    @staticmethod
    def _record(id_, name, species, hatched_as, sex, gen, sire, dam, moves, inherited, role, origin, fate, program,
                note, game=LAB_GAME):
        return {"id": id_, "name": name, "species": species, "hatched_as": hatched_as, "line": hatched_as or species,
                "sex": sex, "generation": gen, "sire": sire, "dam": dam, "moves": list(moves),
                "inherited": inherited, "role": role, "origin": origin, "fate": fate, "status": "planned",
                "program": program, "chapter": None, "decision": "D-038", "note": note, "game": game}

    # --- merged ---------------------------------------------------------------------------------------------
    def individuals(self):
        founders = self.founders()
        planned, _ = self.program(founders)
        by_id = {}
        for r in founders + planned:
            if r["id"] not in by_id:                             # a dam shared by two targets is one record
                by_id[r["id"]] = r
        for a in self.authored_doc.get("individuals", []):
            base = by_id.get(a["id"], {k: None for k in FIELDS} | {"moves": [], "inherited": [], "status": "recorded"})
            by_id[a["id"]] = {**base, **{k: v for k, v in a.items() if not k.startswith("_")}}
        rows = list(by_id.values())
        for r in rows:
            if not r.get("line"):
                r["line"] = self.hatches_as(r["species"], r.get("game") or LAB_GAME) if r.get("species") else None
        return rows

    # --- the rules --------------------------------------------------------------------------------------------
    def check(self, rows=None):
        rows = self.individuals() if rows is None else rows
        by = {r["id"]: r for r in rows}
        bad = []
        for r in rows:
            sp = r.get("species")
            if not sp:
                bad.append((r["id"], "no species"))
                continue
            if r.get("sex") in ("male", "female", "genderless") and not self.can_be(sp, r["sex"]):
                bad.append((r["id"], f"{sp} can't be {r['sex']}"))
            if len(r.get("moves") or []) > 4:
                bad.append((r["id"], f"{len(r['moves'])} moves, over 4"))
            sire, dam = by.get(r.get("sire")), by.get(r.get("dam"))
            if r.get("sire") and not sire:
                bad.append((r["id"], f"sire {r['sire']} isn't in the studbook"))
            if r.get("dam") and not dam:
                bad.append((r["id"], f"dam {r['dam']} isn't in the studbook"))
            if not (sire and dam):
                continue
            ditto = "Ditto" in (sire["species"], dam["species"])
            if not ditto:
                if not self.can_be(sire["species"], "male"):
                    bad.append((r["id"], f"sire {sire['id']} ({sire['species']}) can't be male"))
                if not self.can_be(dam["species"], "female"):
                    bad.append((r["id"], f"dam {dam['id']} ({dam['species']}) can't be female"))
                if sire.get("sex") == "female" or dam.get("sex") == "male":
                    bad.append((r["id"], "the sire is recorded female or the dam male"))
                shared = set(self.groups(sire["species"])) & set(self.groups(dam["species"]))
                if not shared:
                    bad.append((r["id"], f"{sire['species']} and {dam['species']} share no egg group"))
            g = r.get("game") or LAB_GAME                            # B28: the game the cross is for
            mother_line = sire["species"] if dam["species"] == "Ditto" else dam["species"]
            if self.hatches_as(mother_line, g) != self.hatches_as(sp, g):
                bad.append((r["id"], f"an egg from a {mother_line} hatches as {self.hatches_as(mother_line, g)}, "
                                     f"not {self.hatches_as(sp, g)}"))
            for inh in r.get("inherited") or []:
                if inh.get("from") == sire["id"]:
                    if inh["move"] not in self.egg_moves(sp, g):
                        bad.append((r["id"], f"{inh['move']} isn't an egg move of the {self.hatches_as(sp, g)} line"))
                    if inh["move"] not in (sire.get("moves") or []) and not self.knows_itself(sire["species"], inh["move"], g):
                        bad.append((r["id"], f"the sire {sire['id']} can't know {inh['move']}"))
                if ditto and inh.get("from") == sire["id"] and sire["species"] == "Ditto":
                    bad.append((r["id"], "a Ditto passes no egg moves"))
            want = max(sire.get("generation") or 0, dam.get("generation") or 0) + 1
            if r.get("generation") is not None and r["generation"] != want:
                bad.append((r["id"], f"generation {r['generation']}, should be {want} (one past the older parent)"))
        for r in rows:                                           # nobody is their own ancestor
            seen, stack = set(), [r.get("sire"), r.get("dam")]
            while stack:
                p = stack.pop()
                if not p or p in seen:
                    continue
                if p == r["id"]:
                    bad.append((r["id"], "is its own ancestor"))
                    break
                seen.add(p)
                if p in by:
                    stack += [by[p].get("sire"), by[p].get("dam")]
        for t in self.program_targets:                            # a stud carries his line's whole set
            s = by.get(f"S-{_key(t['species'])}")
            if not s:
                continue
            if not self.can_be(s["species"], "male"):
                bad.append((s["id"], f"a stud must be male; {s['species']} can't be"))
            plan_moves = set(self.breeding.plan_lineage(t["species"], t["moves"], t["game"])["egg_moves"])
            missing = plan_moves - set(s.get("moves") or [])
            if missing:
                bad.append((s["id"], f"the stud doesn't carry {', '.join(sorted(missing))}"))
        return bad

    # --- the tree -----------------------------------------------------------------------------------------------
    def pedigree(self, id_, rows=None, depth=4):
        """The ancestors of one individual as a nested dict, sire and dam each a level up."""
        by = {r["id"]: r for r in (rows or self.individuals())}

        def up(i, d):
            r = by.get(i)
            if not r:
                return None
            node = {"id": r["id"], "name": r["name"], "species": r["species"], "sex": r["sex"],
                    "generation": r["generation"], "moves": r["moves"]}
            if d > 0:
                node["sire"], node["dam"] = up(r.get("sire"), d - 1), up(r.get("dam"), d - 1)
            return node
        return up(id_, depth)

    def descendants(self, id_, rows=None):
        rows = rows or self.individuals()
        out, frontier = [], {id_}
        while frontier:
            kids = [r for r in rows if r.get("sire") in frontier or r.get("dam") in frontier]
            kids = [k for k in kids if k["id"] not in {o["id"] for o in out}]
            out += kids
            frontier = {k["id"] for k in kids}
        return out


def main():
    import sys
    sys.path.insert(0, os.path.dirname(HERE))
    lin = Lineage(os.path.join(os.path.dirname(HERE), "data", "pokeref.sqlite"))
    rows = lin.individuals()
    print(f"{len(rows)} individuals: " + ", ".join(f"{k} {sum(r['role'] == k for r in rows)}"
                                                for k in ("companion", "father used", "dam", "stud")))
    for i, why in lin.check(rows):
        print("  !", i, why)


if __name__ == "__main__":
    main()
