"""Breeding stock: a complete four-move starting configuration, checked against the game's own hatch code, with the
parents and the lineage that produce it (docs/specs/BREEDING_INHERITANCE_ECOLOGY.md; MASTER_PLAN §4.5, Phase 4).

    python3 -I engine/breeding/stock.py Larvitar heartgold "Dragon Dance" Outrage Pursuit "Stone Edge"
    python3 -I engine/breeding/stock.py Swinub heartgold "Ancient Power" --explore
    python3 -I engine/breeding/stock.py --parity out.json      # the cases app/test_stock_parity.mjs checks

How an egg's moves are made, read from the pret decompilations of the games themselves (2026-10-24):
- Gen 2 (pokecrystal engine/events/daycare.asm, engine/pokemon/breeding.asm): the egg is made at level 5 and knows its
  level-up moves up to 5. Then the father's moves, in his slot order: each one the egg doesn't know yet passes if it
  is one of the egg's egg moves; or, if the mother knows it too, a move the egg learns by level-up; or a TM, HM or
  Crystal tutor move the egg can learn.
- Gen 3 (pokeemerald and pokefirered src/daycare.c, BuildEggMoveset): level 5, its level-up moves up to 5; then the
  father's egg moves (his slot order), then his TM and HM moves the egg can learn, then the moves both parents know
  that the egg learns by level-up at any level. Emerald: a parent holding a Light Ball gives Pichu Volt Tackle last
  (FireRed's code for it is cut out).
- Gen 4 (pokeplatinum src/overlay005/daycare.c, Egg_BuildMoveset): the same order as Gen 3, but the egg is made at
  level 1. Light Ball: as Emerald.
A move goes into the first empty slot; with four already, the oldest is pushed out and the new one goes last.
Ditto: with a male or genderless partner, Ditto is the mother; with a female, Ditto is the father, so nothing passes.

The verdict keeps four claims apart (the spec's §3): the hatch rules allow the set (possible); parents who know the
right moves can actually be had in that generation (obtainable); PKHeX should accept it (it checks each move's source
and the hatch order, not whether a father could carry the set); and one of your Pokémon hatched with it (documented).
Learnability stays the gate (D-024, D-048): the verdict informs, it decides nothing.

Everything here reads one data pack (`pack_from_db`), the same one the browser gets as app/data/breeding.json
(app/breeding_pack.py), so app/web/23_stock.html can run the same code; app/test_stock_parity.mjs holds them together.
"""
import json
import os
import sqlite3
import sys
from itertools import combinations, permutations

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)

GAMES = {"crystal": (2, 4), "firered": (3, 7), "emerald": (3, 6), "platinum": (4, 9), "heartgold": (4, 10),
         "soulsilver": (4, 10)}                                    # game: (generation, PokeAPI version group)
VG_GEN = {1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 4, 9: 4, 10: 4}
VG_NAME = {1: "Red/Blue", 2: "Yellow", 3: "Gold/Silver", 4: "Crystal", 5: "Ruby/Sapphire", 6: "Emerald",
           7: "FireRed/LeafGreen", 8: "Diamond/Pearl", 9: "Platinum", 10: "HeartGold/SoulSilver"}
TRANSFER_FROM = {2: [1], 3: [], 4: [3]}                            # Time Capsule (1 -> 2), Pal Park (3 -> 4)
CAP = {1: 151, 2: 251, 3: 386, 4: 493}                             # the last species of each generation
HATCH_LEVEL = {2: 5, 3: 5, 4: 1}
METHOD = {1: "level-up", 2: "egg", 3: "tutor", 4: "machine", 6: "light-ball-egg"}
KEY = {"level-up": "L", "egg": "E", "tutor": "T", "machine": "M", "light-ball-egg": "B"}
RANK = {"level-up": 0, "egg": 1, "tutor": 2, "machine": 3, "light-ball-egg": 4}
INCENSE_BABIES = {
    3: {"Azurill": "Sea Incense", "Wynaut": "Lax Incense"},
    4: {"Azurill": "Sea Incense", "Wynaut": "Lax Incense", "Munchlax": "Full Incense",
        "Happiny": "Luck Incense", "Mime Jr.": "Odd Incense", "Bonsly": "Rock Incense",
        "Budew": "Rose Incense", "Chingling": "Pure Incense", "Mantyke": "Wave Incense"},
}
EGG_GROUPS = ("monster", "water1", "water2", "water3", "bug", "flying", "ground", "fairy", "plant", "humanshape",
              "mineral", "indeterminate", "dragon")
HOW = {"default": "knows it at hatch (a level-up move by Lv {lvl})", "egg": "an egg move: the father knows it",
       "tm": "the father knows it, and the egg can learn that TM/HM", "shared": "both parents know it, and the egg "
       "learns it by level-up", "light-ball": "a parent holds a Light Ball"}


# --- the data pack -------------------------------------------------------------------------------------------------
def pack_from_db(db_path):
    """Everything the stock engine reads, from pokeref.sqlite: species, learnsets by game and method, wild species,
    evolutions that need a known move. app/breeding_pack.py writes this as app/data/breeding.json."""
    con = sqlite3.connect(db_path)
    q = lambda sql, *a: con.execute(sql, a).fetchall()
    names = {int(r[0]): r[1] for r in q("SELECT pokemon_species_id, name FROM pokemon_species_names WHERE local_language_id=9")}
    groups = {}
    for sid, g in q("SELECT p.species_id, e.identifier FROM pokemon_egg_groups p JOIN egg_groups e ON e.id=p.egg_group_id "
                    "ORDER BY CAST(p.species_id AS INT), e.id"):
        groups.setdefault(int(sid), []).append(g)
    species = {}
    for sid, chain, frm, gr, gen, cyc, baby in q(
            "SELECT id, evolution_chain_id, evolves_from_species_id, gender_rate, generation_id, hatch_counter, is_baby "
            "FROM pokemon_species WHERE CAST(id AS INT)<=493"):
        sid = int(sid)
        evo = q("SELECT e.minimum_level FROM pokemon_evolution e JOIN pokemon_species s ON s.id=e.evolved_species_id "
                "WHERE s.evolves_from_species_id=? LIMIT 1", sid)
        species[str(sid)] = {"n": names[sid], "c": int(chain), "f": int(frm) if frm else None, "gr": int(gr),
                             "eg": groups.get(sid, []), "gen": int(gen), "cy": int(cyc or 0), "baby": int(baby or 0),
                             "evo_at": int(evo[0][0]) if evo and evo[0][0] else None}
    learn = {}
    for vg in sorted(VG_GEN):
        out = {k: {} for k in KEY.values()}
        for pid, mid, meth, lvl in q(
                'SELECT pokemon_id, move_id, pokemon_move_method_id, level FROM pokemon_moves WHERE version_group_id=? '
                'AND CAST(pokemon_id AS INT)<=493 AND pokemon_move_method_id IN (1,2,3,4,6) '
                'ORDER BY CAST(pokemon_id AS INT), CAST(level AS INT), COALESCE("order", 0), rowid', vg):
            k = KEY[METHOD[int(meth)]]
            lst = out[k].setdefault(str(int(pid)), [])
            if k == "L":
                lst += [int(mid), int(lvl or 0)]
            elif int(mid) not in lst:
                lst.append(int(mid))
        learn[str(vg)] = out
    used = {m for vg in learn.values() for k, d in vg.items() for lst in d.values()
            for m in (lst[0::2] if k == "L" else lst)}
    for vg, out in learn.items():                          # TM lists as bitmasks over the game's TM moves
        tms = sorted({m for lst in out["M"].values() for m in lst})
        at = {m: i for i, m in enumerate(tms)}
        out["M"] = {"moves": tms, "bits": {sid: bits([at[m] for m in lst]) for sid, lst in out["M"].items()}}
    moves = {}
    for mid, gen in q("SELECT id, generation_id FROM moves"):
        if int(mid) in used:
            moves[str(int(mid))] = [q("SELECT name FROM move_names WHERE move_id=? AND local_language_id=9", mid)[0][0],
                                    int(gen)]
    wild = {}
    for game in GAMES:
        wild[game] = sorted({int(r[0]) for r in q(
            "SELECT DISTINCT p.species_id FROM encounters e JOIN versions v ON v.id=e.version_id "
            "JOIN pokemon p ON p.id=e.pokemon_id WHERE v.identifier=? AND CAST(p.species_id AS INT)<=493", game)})
    evo_move = [[int(r[0]), int(r[1])] for r in q(
        "SELECT evolved_species_id, known_move_id FROM pokemon_evolution WHERE known_move_id IS NOT NULL "
        "AND CAST(evolved_species_id AS INT)<=493 ORDER BY CAST(evolved_species_id AS INT)")]
    con.close()
    return {"_note": "Built by engine/breeding/stock.py pack_from_db from PokeAPI's CSVs (pokeref.sqlite). learn[vg]"
                     "[L|E|T|M|B][species]: level-up as [move, level, …] in learning order; egg, tutor, machine and "
                     "Light Ball moves as move ids.",
            "species": species, "moves": moves, "learn": learn, "wild": wild, "evo_move": evo_move,
            "odds": {g: Stock.odds(g) for g in GAMES}, "how": HOW}


def bits(idx):
    """Indices -> a hex string, bit i in character i // 4 (value 1 << i % 4)."""
    n = (max(idx) // 4 + 1) if idx else 0
    v = [0] * n
    for i in idx:
        v[i // 4] |= 1 << (i % 4)
    return "".join("0123456789abcdef"[x] for x in v)


def unbits(h, moves):
    return [moves[c * 4 + b] for c, ch in enumerate(h) for b in range(4) if int(ch, 16) >> b & 1]


_PACKS = {}


def load(db_path=None):
    """The pack for this database, built once per process."""
    if db_path is None:
        from trainers.model import DB
        db_path = DB
    if db_path not in _PACKS:
        _PACKS[db_path] = pack_from_db(db_path)
    return _PACKS[db_path]


def slug(s):
    s = str(s).strip().lower().replace("’", "").replace("'", "").replace(".", "").replace("♀", "-f").replace("♂", "-m")
    return "".join(ch if ch.isalnum() else "-" for ch in s).strip("-").replace("--", "-")


# --- the engine -----------------------------------------------------------------------------------------------------
class Stock:
    def __init__(self, pack):
        self.p = pack
        self.sp = {int(k): v for k, v in pack["species"].items()}
        self.chains = {}
        for sid in sorted(self.sp):
            self.chains.setdefault(self.sp[sid]["c"], []).append(sid)
        self.by_name = {slug(v["n"]): sid for sid, v in self.sp.items()}
        self.mv = {int(k): v for k, v in pack["moves"].items()}
        self.by_move = {slug(v[0]): mid for mid, v in self.mv.items()}
        self.squashed = {k.replace("-", ""): mid for k, mid in sorted(self.by_move.items())}
        self.learn = {}
        for vg, d in pack["learn"].items():
            self.learn[int(vg)] = {k: {int(s): lst for s, lst in m.items()} for k, m in d.items() if k != "M"}
            self.learn[int(vg)]["M"] = {int(s): unbits(h, d["M"]["moves"]) for s, h in d["M"]["bits"].items()}
        self.lu_sets = {vg: {s: set(lst[0::2]) for s, lst in d["L"].items()} for vg, d in self.learn.items()}
        self.sets = {vg: {k: {s: set(lst) for s, lst in d[k].items()} for k in ("E", "T", "M", "B")}
                     for vg, d in self.learn.items()}
        self.wild = {g: set(v) for g, v in pack["wild"].items()}
        self.evo_move = {to: mid for to, mid in pack["evo_move"]}
        self.members = {}
        for sid in sorted(self.sp):
            for g in self.sp[sid]["eg"]:
                self.members.setdefault(g, []).append(sid)

    # identity
    def sid(self, name):
        if isinstance(name, int):
            return name
        s = slug(name)
        if s in self.by_name:
            return self.by_name[s]
        while "-" in s:                                     # a form ("Rotom-Heat") is its species
            s = s.rsplit("-", 1)[0]
            if s in self.by_name:
                return self.by_name[s]
        raise KeyError(name)

    def mid(self, name):
        if isinstance(name, int):
            return name
        s = slug(name)
        if s in self.by_move:
            return self.by_move[s]
        if s.replace("-", "") in self.squashed:              # Gen 4 spellings: "AncientPower", "ThunderPunch"
            return self.squashed[s.replace("-", "")]
        raise KeyError(name)

    def name(self, sid):
        return self.sp[sid]["n"]

    def move_name(self, mid):
        return self.mv[mid][0]

    def family(self, sid, gen=4):
        """The whole evolution family that exists in this generation (B26: Crystal has no Mamoswine)."""
        return tuple(s for s in self.chains[self.sp[sid]["c"]] if s <= CAP[gen])

    def line(self, sid):
        """The species and its pre-evolutions, newest first."""
        out = []
        while sid:
            out.append(sid)
            sid = self.sp[sid]["f"]
        return out

    def gr(self, sid):
        return self.sp[sid]["gr"]

    def egg_groups(self, sid):
        return self.sp[sid]["eg"]

    def methods(self, sid, mid, vg):
        """[(method, level)] for this species, move and version group (a level-up move can come at two levels)."""
        d, out = self.learn.get(vg), []
        if not d:
            return out
        if mid in self.lu_sets[vg].get(sid, ()):
            lst = d["L"][sid]
            out += [("level-up", lst[i + 1]) for i in range(0, len(lst), 2) if lst[i] == mid]
        for k, m in (("E", "egg"), ("T", "tutor"), ("M", "machine"), ("B", "light-ball-egg")):
            if mid in self.sets[vg][k].get(sid, ()):
                out.append((m, 0))
        return out

    def routes(self, fam, mid, vgs, methods):
        return [(s, m, l, v) for s in fam for v in vgs for m, l in self.methods(s, mid, v) if m in methods]

    @staticmethod
    def ctx(game):
        gen, vg = GAMES[game]
        gen_vgs = [v for v, g in VG_GEN.items() if g == gen]
        src_vgs = gen_vgs + [v for v, g in VG_GEN.items() if g in TRANSFER_FROM.get(gen, [])]
        return gen, vg, gen_vgs, src_vgs

    # --- the lineage search (moved here from breeding/engine.py, with B26 fixed and a total order) --------------------
    def candidates(self, fam, gen):
        """Families that can father an egg of `fam`: share an egg group, have a male, exist in this generation. A line
        with no female breeds only with Ditto, so its own males (or genderless members) are its only fathers."""
        if not any(self.gr(s) not in (-1, 0) for s in fam):
            return [fam] if any(self.gr(s) != 8 for s in fam) else []   # no female: Ditto is the mother
        groups = {g for s in fam for g in self.egg_groups(s) if g not in ("no-eggs", "ditto")}
        out = set()
        for g in groups:
            for s in self.members.get(g, []):
                if s > CAP[gen]:
                    continue
                f = self.family(s, gen)
                if any(self.gr(x) not in (-1, 8) for x in f):
                    out.add(f)
        return sorted(out)

    def search(self, fam, need, game, depth, visited, memo):
        """Fathers (best first) who can know every move in `need` together: each one he learns himself (level-up,
        TM, tutor; any game of the generation or a transfer) or inherits as an egg move of his own line, from a
        father found the same way, up to `depth` generations back."""
        key = (fam, need, depth)
        if key in memo:
            return memo[key]
        gen, vg, gen_vgs, src_vgs = self.ctx(game)
        plans = []
        for f in self.candidates(fam, gen):
            direct = {m: self.routes(f, m, src_vgs, ("level-up", "tutor", "machine")) for m in need}
            inherit = frozenset(m for m in need if not direct[m])
            if any(not self.routes(f, m, gen_vgs, ("egg",)) for m in inherit):
                continue                                   # f can't even hatch with it
            sub = None
            if inherit:
                if depth <= 1:
                    continue
                if f == fam:                               # the line's own male: hatched with some, learns the rest
                    if len(inherit) == len(need):
                        continue                           # nothing he learns himself: no step forward
                elif f in visited:
                    continue
                if not any(self.gr(s) not in (-1, 0) for s in f):
                    continue                               # no female of f's line to hatch it from
                subs = self.search(f, inherit, game, depth - 1, visited | {f}, memo)
                if not subs:
                    continue
                sub = subs[0]
            native = all(any(r[3] in gen_vgs for r in direct[m]) for m in need if direct[m]) and (
                sub is None or sub["native"])                # no Pal Park / Time Capsule transfer needed
            catchable = any(s in self.wild[game] for s in self.chains[self.sp[f[0]]["c"]])
            stage = max(f, key=lambda s: (len([m for m in need if self.routes((s,), m, src_vgs,
                                                                             ("level-up", "tutor", "machine"))]), s))
            order = lambda r: (r[0] != stage, r[3] != vg, r[3] not in gen_vgs, r[3], RANK[r[1]], r[2], r[0])
            learns, where = {}, {}
            for m in sorted(need, key=lambda x: self.move_name(x)):
                if direct[m]:
                    best = sorted(set(direct[m]), key=order)
                    learns[self.move_name(m)] = [
                        f"{self.name(s)} {mm}{' L' + str(l) if mm == 'level-up' else ''} (vg{v})" for s, mm, l, v in best][:2]
                    where[self.move_name(m)] = best[0][3]
            plans.append({"father": self.name(stage), "family": [self.name(s) for s in f], "learns_itself": learns,
                          "learns_in": where,
                          "inherits": sorted(self.move_name(m) for m in inherit), "via": sub,
                          "steps": 1 + (sub["steps"] if sub else 0), "native": native, "catchable_in_game": catchable,
                          "trades": sum(w != vg for w in where.values()) + (sub["trades"] if sub else 0), "_f": list(f)})
        plans.sort(key=lambda p: (p["steps"], not p["native"], not p["catchable_in_game"], p["trades"],
                                  len(p["inherits"]), p["_f"]))
        memo[key] = plans[:5]
        return memo[key]

    def feasibility(self, species, game):
        """Can this line hatch with inherited egg moves at all, and what does it need?"""
        gen = GAMES[game][0]
        fam = self.family(self.sid(species), gen)
        rates = {self.name(s): self.gr(s) for s in fam}
        groups = sorted({g for s in fam for g in self.egg_groups(s) if g not in ("no-eggs", "ditto")})
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

    def timing(self, species, move, game):
        """Warnings about *when* a move must be learned (before evolving, Light Ball, other game only)."""
        gen, vg, gen_vgs, src_vgs = self.ctx(game)
        sid, mid = self.sid(species), self.mid(move)
        native, other = [], []
        for st in self.line(sid):
            for m, lvl in self.methods(st, mid, vg):
                native.append((st, m, lvl))
            for v in [x for x in gen_vgs if x != vg] + [x for x in src_vgs if x not in gen_vgs]:
                for m, lvl in self.methods(st, mid, v):
                    other.append(v)
        notes, mname = [], self.move_name(mid)
        if any(m == "light-ball-egg" for _, m, _ in native):
            notes.append(f"{mname}: a parent must hold a Light Ball when the egg is made")
        if native and all(m == "level-up" and st != sid for st, m, _ in native):
            st, lvl = min(((st, l) for st, _, l in native), key=lambda x: x[1])
            at = self.sp[st]["evo_at"]
            when = f" before it evolves at Lv {at}" if at else " before it evolves"
            notes.append(f"{mname}: must be learned as {self.name(st)} at Lv {lvl}{when}; later forms can't relearn it")
        if not native and other:
            notes.append(f"{mname}: not learnable in {game} itself; only in "
                         f"{', '.join('vg' + str(v) for v in sorted(set(other)))} (trade/transfer)")
        return notes

    def plan_lineage(self, species, moves, game, max_depth=3, need_extra=()):
        """Shortest lineage that hatches `species` knowing every egg move in `moves` at once. The father must know
        them all together; anything he can't learn himself must be bred into him. `need_extra`: other moves the final
        father must also know (a blueprint's TM and shared level-up moves)."""
        gen, vg, gen_vgs, src_vgs = self.ctx(game)
        sid = self.sid(species)
        fam = self.family(sid, gen)
        mids = [self.mid(m) for m in moves]
        light_ball = [m for m in mids if self.routes(fam, m, [vg], ("light-ball-egg",))]
        egg = frozenset(m for m in mids if m not in light_ball and self.routes(fam, m, [vg], ("egg",)))
        later = [self.move_name(m) for m in mids if m not in egg and m not in light_ball]
        result = {"target": species, "game": game, "egg_moves": sorted(self.move_name(m) for m in egg),
                  "by_held_item": [f"{self.move_name(m)}: either parent holds a Light Ball; no father needed"
                                   for m in light_ball],
                  "learn_after_hatching": later, "timing": [t for m in moves for t in self.timing(species, m, game)],
                  "feasibility": self.feasibility(species, game)}
        need = egg | frozenset(self.mid(m) for m in need_extra)
        if len(need) > 4:
            result["plans"] = []
            result["note"] = "more than four egg moves can't be carried at once"
            return result
        result["plans"] = self.search(fam, need, game, max_depth, {fam}, {}) if need else []
        return result

    # --- the egg's starting moves --------------------------------------------------------------------------------
    def hatch_species(self, species, game):
        """What hatches: the line's first stage in this generation. An incense baby hatches only if a parent holds its
        incense, so asking for the evolved form reads as the next stage; asking for the baby itself keeps it."""
        gen = GAMES[game][0]
        sid = self.sid(species)
        chain = [s for s in reversed(self.line(sid)) if s <= CAP[gen]]          # oldest first
        incense = INCENSE_BABIES.get(gen, {}).get(self.name(chain[0]))
        if sid == chain[0]:
            return chain[0], incense
        if incense and len(chain) > 1:
            return chain[1], None
        return chain[0], None

    def defaults(self, sid, game):
        """The egg's own moves before anything is inherited: its level-up moves up to the hatch level, in order."""
        gen, vg = GAMES[game]
        lst = self.learn[vg]["L"].get(sid, [])
        slots, lvls = [], {}
        for i in range(0, len(lst), 2):
            m, lvl = lst[i], lst[i + 1]
            if lvl > HATCH_LEVEL[gen] or m in slots:
                continue
            if len(slots) == 4:
                slots.pop(0)
            slots.append(m)
            lvls[m] = lvl
        return slots, lvls

    def egg_lists(self, sid, game):
        """What the hatch code checks for this egg: its egg moves, the TM/HM (and Crystal tutor) moves it can learn,
        every move it learns by level-up (that both parents can know), and the Light Ball move."""
        gen, vg = GAMES[game]
        s = self.sets[vg]
        tm = set(s["M"].get(sid, ())) | (set(s["T"].get(sid, ())) if gen == 2 else set())
        lu = set(self.lu_sets[vg].get(sid, ()))
        if not any(self.gr(x) not in (-1, 0) for x in self.family(sid, gen)):
            lu = set()                                       # Ditto is the mother: no move comes from both parents
        return set(s["E"].get(sid, ())), tm, lu, set(s["B"].get(sid, ()))

    @staticmethod
    def hatch(gen, defaults, father, mother, egg, tm, lu, light_ball=None):
        """The egg's moves as the game builds them: [(move, how)] in slot order."""
        slots = []

        def add(m, how):
            if any(x == m for x, _ in slots):
                return
            if len(slots) == 4:
                slots.pop(0)
            slots.append((m, how))
        for m in defaults:
            add(m, "default")
        if gen == 2:
            for m in father:
                if m in egg:
                    add(m, "egg")
                elif m in mother and m in lu:
                    add(m, "shared")
                elif m in tm:
                    add(m, "tm")
        else:
            for m in father:
                if m in egg:
                    add(m, "egg")
            for m in father:
                if m in tm:
                    add(m, "tm")
            for m in father:
                if m in mother and m in lu:
                    add(m, "shared")
            if light_ball:
                add(light_ball, "light-ball")
        return slots

    def recipes(self, sid, mids, game):
        """Every way the parents' moves can make this exact set (the father's moves in his slot order, what the mother
        must know, the Light Ball), simplest first. Fewer than four moves: the rest of the slots are the egg's own
        moves at hatch, whichever of them stay."""
        gen, vg = GAMES[game]
        dflt, _ = self.defaults(sid, game)
        egg, tm, lu, lb = self.egg_lists(sid, game)
        want = set(mids)
        ball = next((m for m in mids if m in lb), None) if gen >= 3 else None
        pool = [m for m in mids if m in egg or m in tm or m in lu]
        out = []
        for k in range(len(pool) + 1):
            for father in permutations(pool, k):
                shared = [m for m in father if m in lu]
                for j in range(len(shared) + 1):
                    for mom in combinations(shared, j):
                        got = self.hatch(gen, dflt, father, set(mom), egg, tm, lu, ball)
                        have = {m for m, _ in got}
                        if want <= have and not (have - want - set(dflt)):
                            out.append({"father": list(father), "mother": list(mom), "light_ball": ball is not None,
                                        "slots": got})
        rank = {m: i for i, m in enumerate(mids)}
        out.sort(key=lambda r: (len(r["mother"]), len(r["father"]), [rank[m] for m in r["father"]],
                                [rank[m] for m in r["mother"]]))
        return out

    def options(self, sid, mid, game):
        """How one move could be in this egg's starting set (several can apply)."""
        dflt, lvls = self.defaults(sid, game)
        egg, tm, lu, lb = self.egg_lists(sid, game)
        gen = GAMES[game][0]
        o = []
        if mid in dflt:
            o.append("default")
        if mid in egg:
            o.append("egg")
        if mid in tm:
            o.append("tm")
        if mid in lu:
            o.append("shared")
        if mid in lb and gen >= 3:
            o.append("light-ball")
        return o

    def ways(self, sid, mid, game, egg=False):
        """How the line learns a move in this game, grouped: the tutor, TMs, each stage's level (a Lv 1 move on an
        evolved stage only comes from the Move Reminder, which Gen 2 doesn't have)."""
        gen, vg, gen_vgs, src_vgs = self.ctx(game)
        fam = self.family(sid, gen)
        dflt, _ = self.defaults(sid, game)
        rows = sorted(set(self.routes(fam, mid, [vg], ("level-up", "tutor", "machine", "egg"))),
                      key=lambda r: (r[0], RANK[r[1]], r[2]))
        out, tutor, tm = [], [], []
        for s, m, l, v in rows:
            if m == "egg":
                if egg:
                    out.append(f"{self.name(s)} hatches with it as an egg move (it stays through evolution)")
            elif m == "tutor":
                tutor.append(self.name(s))
            elif m == "machine":
                tm.append(self.name(s))
            elif not (s == sid and mid in dflt):
                evolved = s != fam[0] and self.sp[s]["f"] is not None
                note = ""
                if evolved and l <= 1:
                    note = " (from the Move Reminder: it starts above Lv 1)" if gen >= 3 else \
                        " (a Lv 1 move it can't learn once evolved: Gen 2 has no Move Reminder)"
                out.append(f"{self.name(s)} learns it at Lv {l}{note}")
        if tutor:
            out.append(f"the move tutor teaches it ({', '.join(dict.fromkeys(tutor))})")
        if tm:
            out.append(f"a TM or HM ({', '.join(dict.fromkeys(tm))})")
        return out

    def also(self, sid, mid, game):
        """B27: other ways the line learns this move in this game, so it needn't be bred in."""
        return self.ways(sid, mid, game)

    def evolution_needs(self, sid, game):
        """Evolutions in this line that need a known move (Piloswine needs Ancient Power to become Mamoswine)."""
        gen = GAMES[game][0]
        out = []
        for s in self.family(sid, gen):
            if s in self.evo_move:
                frm, m = self.sp[s]["f"], self.evo_move[s]
                out.append({"from": self.name(frm), "to": self.name(s), "move": self.move_name(m),
                            "line": f"{self.name(frm)} evolves into {self.name(s)} only while it knows {self.move_name(m)}",
                            "ways": self.ways(sid, m, game, egg=True)})
        return out

    @staticmethod
    def odds(game):
        """What the parents can pass besides moves, and the chances (mechanics; the time it takes isn't estimated)."""
        gen = GAMES[game][0]
        if gen == 2:
            return {"ivs": "DVs: the egg takes its Defense DV from the parent of the opposite sex (or Ditto), and its "
                           "Special DV too half the time (otherwise Special ±8). Attack and Speed are random; HP follows "
                           "from the others.", "nature": "Gen 2 has no natures.", "ability": "Gen 2 has no abilities.",
                    "stats": None, "source": "Bulbapedia, Pokémon breeding (Generation II); pokecrystal"}
        if game in ("firered",):
            stats = {s: 0.5 for s in ("hp", "atk", "def", "spa", "spd", "spe")}
            ivs = ("Three different stats are inherited, each from a parent chosen at random: any one stat 1 in 2, "
                   "from the parent you want 1 in 4.")
            nature = "Random (1 in 25): FireRed has no Everstone inheritance."
        elif game in ("emerald", "platinum"):
            stats = {"hp": 1 / 6, "def": 1 / 3, "atk": 0.5, "spa": 0.5, "spd": 0.5, "spe": 0.5}
            ivs = ("Three draws, each from a random parent; the second can't be HP and the third can't be HP or Defense, "
                   "and a later draw can land on the same stat (pokeplatinum Egg_InheritIVs): HP 1 in 6, Defense 1 in 3, "
                   "the rest 1 in 2; from the parent you want, half that.")
            nature = ("The mother (or Ditto) holding an Everstone passes her nature half the time: 52% in all, "
                      "1 in 25 without." + (" Platinum: only if both parents come from games of the same language."
                                            if game == "platinum" else ""))
        else:
            stats = {s: 0.5 for s in ("hp", "atk", "def", "spa", "spd", "spe")}
            ivs = ("Three different stats, each from a random parent: any one stat 1 in 2, from the parent you want 1 in "
                   "4. A parent holding a Power item always passes that stat; then two of the other five (2 in 5 each).")
            nature = "Either parent holding an Everstone passes its nature half the time: 52% in all, 1 in 25 without."
        return {"ivs": ivs, "nature": nature, "stats": stats,
                "ability": "Not inherited in Gens 3-4: an egg gets one of its species' abilities at random (1 in 2 when "
                           "it has two).", "source": "Bulbapedia, Pokémon breeding; pret decompilations"}

    # --- a blueprint ------------------------------------------------------------------------------------------------
    def blueprint(self, species, moves, game, individuals=None, max_depth=3):
        """A breeding-stock configuration read whole: what hatches, how each starting move gets in, the parents that
        make the exact set, the lineage for the father, and the four-state verdict."""
        gen, vg, gen_vgs, src_vgs = self.ctx(game)
        sid, incense = self.hatch_species(species, game)
        mids, unknown = [], []
        for m in [x for x in moves if x]:
            try:
                mids.append(self.mid(m))
            except KeyError:
                unknown.append(m)
        dflt, lvls = self.defaults(sid, game)
        fam = self.family(sid, gen)
        out = {"species": self.name(sid), "asked": species, "game": game, "generation": gen,
               "hatch_level": HATCH_LEVEL[gen], "incense": incense, "family": [self.name(s) for s in fam],
               "defaults": [self.move_name(m) for m in dflt], "unknown": unknown, "moves": []}
        bad = []
        for m in mids:
            o = self.options(sid, m, game)
            row = {"move": self.move_name(m), "options": o, "also": self.also(sid, m, game)}
            if self.mv[m][1] > gen:
                row["problem"] = f"{self.move_name(m)} doesn't exist until Gen {self.mv[m][1]}"
            elif not o:
                later = self.routes(fam, m, [vg], ("level-up", "tutor", "machine"))
                kin = [x for x in fam if x != sid and m in self.sets[vg]["E"].get(x, ())]
                if kin:
                    row["problem"] = (f"{self.move_name(m)} is an egg move of {self.name(kin[0])}, not {self.name(sid)}: "
                                      f"the game checks the egg's own species, so hatch {self.name(kin[0])}")
                elif later:
                    row["problem"] = (f"{self.move_name(m)} can't be in a hatched set in {game}: the line learns it "
                                      f"only after hatching ({'; '.join(row['also'][:3])})")
                else:
                    row["problem"] = f"{self.move_name(m)} isn't learnable by the {self.name(sid)} line in {game}"
            if "problem" in row:
                bad.append(row["problem"])
            out["moves"].append(row)
        if len(set(mids)) != len(mids):
            bad.append("a move is listed twice")
        if len(mids) > 4:
            bad.append("more than four moves")
        feas = self.feasibility(self.name(sid), game)
        out["feasibility"] = feas
        if not feas["breedable"]:
            bad.append(feas["notes"][0])
        recipes = [] if bad or unknown else self.recipes(sid, mids, game)
        out["recipes"] = len(recipes)
        if not recipes and not bad and not unknown:
            bad.append(self._why_not(sid, mids, game))
        best = recipes[0] if recipes else None
        if best:
            others = [r for r in recipes if sorted(r["father"]) == sorted(best["father"]) and r["mother"] == best["mother"]]
            orders = {tuple(r["father"]) for r in others}
            n_perm = len(set(permutations(best["father"])))
            out["recipe"] = {"father": [self.move_name(m) for m in best["father"]],
                             "mother": [self.move_name(m) for m in best["mother"]], "light_ball": best["light_ball"],
                             "slots": [{"move": self.move_name(m), "how": how,
                                        "why": HOW[how].format(lvl=lvls.get(m, 1))} for m, how in best["slots"]],
                             "order_matters": len(orders) < n_perm}
            how = {self.move_name(m): h for m, h in best["slots"]}
            for row in out["moves"]:
                row["how"] = how.get(row["move"])
        # the father: a lineage that lets him know every move he passes, together
        lineage = None
        if best and best["father"]:
            fam_need = [m for m in best["father"]]
            egg_part = [self.move_name(m) for m in fam_need if m in self.egg_lists(sid, game)[0]]
            extra = [self.move_name(m) for m in fam_need if m not in self.egg_lists(sid, game)[0]]
            lineage = self.plan_lineage(self.name(sid), egg_part, game, max_depth, need_extra=extra)
            out["lineage"] = {"plans": lineage["plans"][:3], "note": lineage.get("note"), "timing": lineage["timing"]}
        else:
            out["lineage"] = {"plans": [], "note": None, "timing": []}
        mother = self._mother(sid, best["mother"] if best else [], game)
        out["mother"] = mother["notes"]
        out["evolution"] = self.evolution_needs(sid, game)
        out["odds"] = self.odds(game)
        out["egg_cycles"] = self.sp[sid]["cy"]
        out["verdict"] = self._verdict(out, best, lineage, mother, bad, game, individuals, sid, mids)
        return out

    def _why_not(self, sid, mids, game):
        """Why no pair of parents can make this exact set (the hatch order)."""
        dflt, _ = self.defaults(sid, game)
        names = [self.move_name(m) for m in dflt]
        missing_d = [self.move_name(m) for m in dflt if m not in mids]
        inherited = [m for m in mids if m not in dflt]
        if len(mids) < 4 and missing_d:
            return (f"the egg always knows {', '.join(names)} at hatch; with only {len(mids)} moves listed, "
                    f"{', '.join(missing_d)} can't be left out (only a full set of four pushes a default out)")
        return (f"the hatch order can't make this set: the egg starts with {', '.join(names) or 'no moves'}, and with "
                f"{len(inherited)} inherited move(s) the oldest defaults are pushed out first; keep a default by having "
                f"both parents know it (if the egg learns it by level-up), or list a different one")

    def _mother(self, sid, mom, game):
        """The mother: a female of the line (Ditto if it has none), knowing the moves both parents must."""
        gen, vg, gen_vgs, src_vgs = self.ctx(game)
        fam = self.family(sid, gen)
        females = [s for s in fam if self.gr(s) not in (-1, 0)]
        m = {"ok": True, "notes": [], "vgs": [], "wild": True}
        if not females:
            m["notes"].append(f"no female in the {self.name(sid)} line: the mother is Ditto")
            if mom:
                m["ok"] = False
                m["notes"].append("Ditto knows only Transform, so no move can come from both parents")
            return m
        m["wild"] = any(s in self.wild[game] for s in self.chains[self.sp[sid]["c"]])
        m["notes"].append(f"a female of the line ({', '.join(self.name(s) for s in females)})" +
                          ("" if m["wild"] else f"; none is found in {game}, wild or as a gift: a trade"))
        for x in mom:
            r = self.routes(tuple(females), x, src_vgs, ("level-up", "tutor", "machine"))
            if r:
                s, mm, l, v = sorted(set(r), key=lambda y: (y[3] != vg, y[3] not in gen_vgs, y[3], RANK[y[1]], y[2], y[0]))[0]
                m["vgs"].append(v)
                m["notes"].append(f"she knows {self.move_name(x)}: {self.name(s)} {mm}"
                                  f"{' L' + str(l) if mm == 'level-up' else ''} (vg{v})")
            else:
                m["ok"] = False
                m["notes"].append(f"no female of the line can know {self.move_name(x)}")
        return m

    def _verdict(self, out, best, lineage, mother, bad, game, individuals, sid, mids):
        gen, vg, gen_vgs, src_vgs = self.ctx(game)
        possible = best is not None
        v = {"possible": {"ok": possible, "class": "mechanic",
                          "why": "the hatch rules make this exact set from parents who know the right moves" if possible
                          else "; ".join(bad) or "no pair of parents makes this set"}}
        if not possible:
            v["obtainable"] = {"ok": False, "class": "mechanic", "scope": None, "why": "not possible under the hatch rules"}
        elif best["father"] and not (lineage and lineage["plans"]):
            v["obtainable"] = {"ok": False, "class": "mechanic", "scope": None,
                               "why": (lineage or {}).get("note") or "no father who can know these moves together was "
                                      "found within three generations of fathers"}
        elif not mother["ok"]:
            v["obtainable"] = {"ok": False, "class": "mechanic", "scope": None, "why": "; ".join(mother["notes"][1:])}
        else:
            rank = {"this game": 0, "with trades or gifts": 1, "with a transfer": 2}
            scope, why = "this game", []

            def need(sc, text):
                nonlocal scope
                why.append(text)
                if rank[sc] > rank[scope]:
                    scope = sc
            node = lineage["plans"][0] if lineage and lineage["plans"] else None
            while node:
                for mv, w in node["learns_in"].items():
                    if w not in gen_vgs:
                        need("with a transfer", f"{node['father']} learns {mv} in {VG_NAME[w]} (Pal Park or the Time Capsule)")
                    elif w != vg:
                        need("with trades or gifts", f"{node['father']} learns {mv} in {VG_NAME[w]}")
                if not node["catchable_in_game"]:
                    need("with trades or gifts", f"no {node['father']}-line Pokémon is found in {game} (wild or a gift)")
                node = node["via"]
            for w in mother["vgs"]:
                if w not in gen_vgs:
                    need("with a transfer", f"the mother learns a move in {VG_NAME[w]}")
                elif w != vg:
                    need("with trades or gifts", f"the mother learns a move in {VG_NAME[w]}")
            if not mother["wild"]:
                need("with trades or gifts", f"no female of the line is found in {game} (wild or a gift)")
            v["obtainable"] = {"ok": True, "class": "mechanic", "scope": scope,
                               "why": "; ".join(why) if why else f"every parent and move is found in {game}"}
        v["pkhex"] = {"ok": "expected" if possible else False, "class": "inferred",
                      "why": ("enter the moves in this slot order: " + ", ".join(x["move"] for x in out["recipe"]["slots"])
                              + ". PKHeX checks each move's source and the hatch order, not whether a father could "
                                "carry the set; not run here") if possible else
                      "PKHeX would reject a set the hatch rules can't make"}
        mine = []                                            # the whole set it hatches with, defaults included
        want = {x["move"] for x in out["recipe"]["slots"]} if possible else {self.move_name(m) for m in mids}
        for i in individuals or []:
            try:
                same = self.sid(i.get("species") or "") in self.chains[self.sp[sid]["c"]]
            except KeyError:
                same = False
            hm = i.get("hatch_moves") or []
            if same and hm and set(hm) == want and GAMES.get(i.get("game"), (0,))[0] == gen:
                mine.append(i.get("id"))
        v["documented"] = {"ok": bool(mine), "class": "mine", "who": mine,
                           "why": f"{len(mine)} of your Pokémon hatched with this set" if mine else
                           "none of your Pokémon is recorded as hatching with this set"}
        return v

    # --- the catalogue: what a line can hatch knowing ------------------------------------------------------------
    def explore(self, species, game):
        """Every move an egg of this line can start with in this game, grouped by how it gets in, and the fathers who
        learn several of the egg moves themselves (the sets one father carries in a single step)."""
        gen, vg, gen_vgs, src_vgs = self.ctx(game)
        sid, incense = self.hatch_species(species, game)
        fam = self.family(sid, gen)
        dflt, lvls = self.defaults(sid, game)
        egg, tm, lu, lb = self.egg_lists(sid, game)
        feas = self.feasibility(self.name(sid), game)
        sort = lambda ms: sorted(ms, key=lambda m: self.move_name(m))
        fathers = {}
        cands = self.candidates(fam, gen) if feas.get("egg_moves_possible") else []
        for f in cands:
            got = [m for m in egg if self.routes(f, m, src_vgs, ("level-up", "tutor", "machine"))]
            if got:
                fathers[tuple(f)] = got
        one_step = {m: sorted(self.name(f[0]) for f, ms in fathers.items() if m in ms) for m in egg}
        bundles = {}
        for f, ms in fathers.items():
            if len(ms) >= 2:
                key = tuple(sort(ms))
                bundles.setdefault(key, []).append(self.name(f[0]))
        top = sorted(bundles.items(), key=lambda kv: (-len(kv[0]), -len(kv[1]), [self.move_name(m) for m in kv[0]]))
        return {"species": self.name(sid), "game": game, "generation": gen, "hatch_level": HATCH_LEVEL[gen],
                "incense": incense, "family": [self.name(s) for s in fam], "feasibility": feas,
                "defaults": [self.move_name(m) for m in dflt],
                "egg": [{"move": self.move_name(m), "one_step": one_step[m], "also": self.also(sid, m, game)}
                        for m in sort(egg)],
                "tm": [self.move_name(m) for m in sort(tm)],
                "shared": [self.move_name(m) for m in sort(lu - set(dflt))],
                "light_ball": [self.move_name(m) for m in sort(lb)] if gen >= 3 else [],
                "bundles": [{"moves": [self.move_name(m) for m in ms], "fathers": sorted(fs)} for ms, fs in top[:12]],
                "evolution": self.evolution_needs(sid, game)}


    # --- for the pickers (and the parity test) ------------------------------------------------------------------
    def breedable(self, game):
        """Every species an egg can hatch as in this game (an incense line lists its baby and the next stage)."""
        gen, seen, out = GAMES[game][0], set(), []
        for x in sorted(self.sp):
            if x > CAP[gen]:
                continue
            h = self.hatch_species(x, game)[0]
            if h in seen:
                continue
            seen.add(h)
            if any(g not in ("no-eggs", "ditto") for y in self.family(h, gen) for g in self.egg_groups(y)):
                out.append(self.name(h))
        return out

    def start_moves(self, species, game):
        """Every move this line's egg could start with: its defaults, egg moves, TMs, level-up moves, Light Ball."""
        sid = self.hatch_species(species, game)[0]
        egg, tm, lu, lb = self.egg_lists(sid, game)
        allm = set(self.defaults(sid, game)[0]) | egg | tm | lu | (lb if GAMES[game][0] >= 3 else set())
        return sorted((self.move_name(m) for m in allm))


def stock(db_path=None):
    return Stock(load(db_path))


def parity_cases(s, per_game=24, seed=4):
    """The cases app/test_stock_parity.mjs runs in the browser's copy: the breeding program, the proposed lines, and a
    fixed random sample of species and starting sets in every game."""
    import random
    rnd = random.Random(seed)
    out = []
    with open(os.path.join(ENGINE, "canon", "ranch.json"), encoding="utf-8") as fh:
        for t in json.load(fh)["breeding_program"]:
            out.append({"kind": "plan", "args": [t["species"], t["moves"], t["game"]],
                        "result": s.plan_lineage(t["species"], t["moves"], t["game"])})
    prop = os.path.join(ENGINE, "store", "proposed_lines.json")
    if os.path.exists(prop):
        with open(prop, encoding="utf-8") as fh:
            for line in json.load(fh)["lines"]:
                mv = (line.get("signature") or {}).get("moves") or line.get("egg_moves") or []
                sp = line.get("offspring") or line["species"]
                out.append({"kind": "blueprint", "args": [sp, mv, line["game"]], "result": s.blueprint(sp, mv, line["game"])})
    for game in GAMES:
        names = s.breedable(game)
        out.append({"kind": "breedable", "args": [game], "result": names})
        for sp in rnd.sample(names, min(per_game, len(names))):
            pool = s.start_moves(sp, game)
            out.append({"kind": "start_moves", "args": [sp, game], "result": pool})
            out.append({"kind": "explore", "args": [sp, game], "result": s.explore(sp, game)})
            for n in (1, 3, 4):
                mv = rnd.sample(pool, min(n, len(pool)))
                out.append({"kind": "blueprint", "args": [sp, mv, game], "result": s.blueprint(sp, mv, game)})
    for args in (("Larvitar", ["Bite", "Dragon Dance", "Pursuit", "Outrage"], "heartgold"),
                 ("Swinub", ["Ancient Power", "Hail", "Bite", "Powder Snow"], "heartgold"),
                 ("Cyndaquil", ["Extrasensory"], "heartgold"), ("Tauros", ["Earthquake"], "heartgold"),
                 ("Azurill", ["Belly Drum"], "heartgold"), ("Pichu", ["Volt Tackle"], "emerald"),
                 ("Swinub", ["Ancient Power"], "crystal"), ("Magnemite", ["Thunderbolt"], "crystal")):
        out.append({"kind": "blueprint", "args": list(args), "result": s.blueprint(*args)})
    mine = [{"id": "me:heartgold/Cyndaquil-x", "species": "Typhlosion", "game": "heartgold",
             "hatch_moves": ["Tackle", "Leer", "Extrasensory"]}]
    out.append({"kind": "blueprint", "args": ["Cyndaquil", ["Extrasensory"], "heartgold", mine],
                "result": s.blueprint("Cyndaquil", ["Extrasensory"], "heartgold", individuals=mine)})
    return out


def main(argv):
    sys.path.insert(0, ENGINE)
    if len(argv) < 2:
        print(__doc__)
        return 1
    if argv[0] == "--parity":
        cases = parity_cases(stock())
        with open(argv[1], "w", encoding="utf-8") as fh:
            json.dump(cases, fh, ensure_ascii=False, default=list)
        print(f"{len(cases)} cases -> {argv[1]}")
        return 0
    species, game, moves = argv[0], argv[1], [a for a in argv[2:] if not a.startswith("--")]
    s = stock()
    if "--explore" in argv:
        print(json.dumps(s.explore(species, game), indent=1, ensure_ascii=False))
    else:
        print(json.dumps(s.blueprint(species, moves, game), indent=1, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
