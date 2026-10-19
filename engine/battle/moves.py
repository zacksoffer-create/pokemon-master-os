"""The move book (scouting engine, layer 1): what every move does, as plays, from data.

Power, type, category and priority come from Smogon's per-generation data (era-correct: Gen 2-3 split physical and
special by type). Accuracy and the rest come from PokeAPI, rolled back to the generation with PokeAPI's move
changelog. What a move *does* comes from PokeAPI's move meta: its category (damage, ailment, net-good-stats, heal,
damage+ailment, damage+lower, damage+raise, damage+heal, OHKO, field effects, force-switch, unique), its ailment,
stat changes, drain, healing, hit count, turns, flinch and crit chances, flags and target. Nothing here is a
hand-made list of moves: the plays are read off those fields.
"""
from dataclasses import dataclass, field
from functools import lru_cache

import rules
from refdb import VG_GEN

# PokeAPI's move meta describes the current games. These are the Gen 2-4 stat changes it gets wrong because a later
# generation changed them (believed; verify): {move: (generation the change arrived in, the Gen 2-4 self changes)}.
ERA_FIXES = {"Rapid Spin": (8, {}), "Growth": (5, {"spa": 1}), "Minimize": (5, {"evasion": 1}),
             "Tail Glow": (5, {"spa": 2})}
STATS = {1: "hp", 2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe", 7: "accuracy", 8: "evasion"}
SELF_TARGETS = {"user", "user-and-allies", "users-field", "user-or-ally"}
GEN_VG = {2: 4, 3: 6, 4: 10}       # the version group used to roll a move back to its generation


@dataclass
class Move:
    name: str
    gen: int
    type: str
    category: str                    # Physical / Special / Status, as that generation treats it
    power: int
    accuracy: int                    # 100 when it never misses
    priority: int
    pp: int
    target: str
    meta_category: str
    effect: str                      # PokeAPI's short effect text, with its chance filled in
    ailment: str = None
    ailment_chance: int = 0
    self_changes: dict = field(default_factory=dict)
    foe_changes: dict = field(default_factory=dict)
    stat_chance: int = 0
    drain: int = 0                   # % of damage dealt; negative = recoil
    healing: int = 0                 # % of max HP
    hits: tuple = (1, 1)
    turns: tuple = (None, None)
    flinch: int = 0
    crit: int = 0
    flags: set = field(default_factory=set)
    plays: list = field(default_factory=list)

    @property
    def damaging(self):
        return self.category != "Status"


class MoveBook:
    def __init__(self, ref):
        self.ref = ref

    @lru_cache(maxsize=None)
    def get(self, gen, name):
        data = rules.move(gen, name)
        mid = self.ref.move_id(data["name"])
        row = self.ref.q("""SELECT m.power, m.pp, m.accuracy, m.priority, m.effect_id, m.effect_chance, t.identifier AS target
            FROM moves m LEFT JOIN move_targets t ON t.id=m.target_id WHERE m.id=?""", mid)[0]
        acc, pp, effect_id, chance, target = row["accuracy"], row["pp"], row["effect_id"], row["effect_chance"], row["target"]
        for ch in self.ref.q("SELECT * FROM move_changelog WHERE move_id=? ORDER BY CAST(changed_in_version_group_id AS INT)", mid):
            if int(ch["changed_in_version_group_id"]) > GEN_VG[gen]:   # changelog rows hold the values before the change
                acc = ch["accuracy"] if ch["accuracy"] is not None and acc == row["accuracy"] else acc
                pp = ch["pp"] if ch["pp"] is not None and pp == row["pp"] else pp
                effect_id = ch["effect_id"] if ch["effect_id"] is not None and effect_id == row["effect_id"] else effect_id
                chance = ch["effect_chance"] if ch["effect_chance"] is not None and chance == row["effect_chance"] else chance
        meta = self.ref.q("""SELECT mm.*, c.identifier AS cat, a.identifier AS ail FROM move_meta mm
            LEFT JOIN move_meta_categories c ON c.id=mm.meta_category_id LEFT JOIN move_meta_ailments a ON a.id=mm.meta_ailment_id
            WHERE mm.move_id=?""", mid)
        meta = meta[0] if meta else None
        prose = self.ref.q("SELECT short_effect FROM move_effect_prose WHERE move_effect_id=? AND local_language_id=9", effect_id)
        effect = (prose[0][0] if prose else "").replace("$effect_chance", str(chance or ""))
        changes = {STATS.get(int(r["stat_id"])): int(r["change"]) for r in
                   self.ref.q("SELECT stat_id, change FROM move_meta_stat_changes WHERE move_id=?", mid)}
        flags = {r[0] for r in self.ref.q("""SELECT f.identifier FROM move_flag_map m JOIN move_flags f ON f.id=m.move_flag_id
            WHERE m.move_id=?""", mid)}
        on_self = target in SELF_TARGETS or (meta and meta["cat"] == "damage-raise")
        fix = ERA_FIXES.get(data["name"])
        if fix and gen < fix[0]:
            changes, on_self = dict(fix[1]), True
        mv = Move(
            name=data["name"], gen=gen, type=data["type"], category=rules.category(gen, data["name"]),
            power=data["bp"] or 0, accuracy=int(acc) if acc else 100, priority=data["priority"], pp=int(pp or 0),
            target=target or "", meta_category=(meta["cat"] if meta else "unique") or "unique", effect=effect,
            ailment=(meta["ail"] if meta and meta["ail"] not in (None, "none", "unknown", "protect") else None),
            ailment_chance=int(meta["ailment_chance"] or 0) if meta else 0,
            self_changes={k: v for k, v in changes.items() if on_self},
            foe_changes={k: v for k, v in changes.items() if not on_self},
            stat_chance=int(meta["stat_chance"] or 0) if meta else 0,
            drain=int(meta["drain"] or 0) if meta else 0, healing=int(meta["healing"] or 0) if meta else 0,
            hits=(int(meta["min_hits"] or 1), int(meta["max_hits"] or 1)) if meta else (1, 1),
            turns=(meta["min_turns"], meta["max_turns"]) if meta else (None, None),
            flinch=int(meta["flinch_chance"] or 0) if meta else 0, crit=int(meta["crit_rate"] or 0) if meta else 0,
            flags=flags)
        mv.plays = self.plays_of(mv)
        if "others decrease speed but raise attack and defense" in effect.lower():   # Curse's change isn't in the meta
            mv.self_changes = {"atk": 1, "def": 1, "spe": -1}
        if "max out its attack" in effect.lower():                                    # Belly Drum
            mv.self_changes = {"atk": 6}
        return mv

    @staticmethod
    def plays_of(mv):
        """A move's plays, each with whether it's the main job ('primary') or a side effect with a chance."""
        e = mv.effect.lower()
        plays = []
        add = lambda play, primary=True, chance=100, detail=None: plays.append(
            {"play": play, "primary": primary, "chance": chance, **({"detail": detail} if detail else {})})
        if mv.damaging:
            add("hit")
            if mv.priority > 0:
                add("priority")
            if mv.hits[1] > 1:
                add("multi-hit", detail=f"{mv.hits[0]}-{mv.hits[1]} hits")
        cat = mv.meta_category
        if cat == "ohko":
            add("ohko")
        boosts = {k: v for k, v in mv.self_changes.items() if v > 0}
        if boosts:
            sure = cat == "net-good-stats" or mv.stat_chance in (0, 100)
            add("boost", sure, 100 if sure else mv.stat_chance, ", ".join(f"{k} +{v}" for k, v in boosts.items()))
        drops = {k: v for k, v in mv.foe_changes.items() if v < 0}
        if drops:
            sure = cat == "net-good-stats" or mv.stat_chance in (0, 100)
            add("debuff", sure and not mv.damaging, 100 if sure else mv.stat_chance, ", ".join(f"{k} {v}" for k, v in drops.items()))
        self_drops = {k: v for k, v in mv.self_changes.items() if v < 0}
        if self_drops and mv.damaging:
            add("self-drop", False, 100, ", ".join(f"{k} {v}" for k, v in self_drops.items()))
        if mv.ailment and mv.ailment != "perish-song":
            primary = cat in ("ailment", "swagger")
            chance = 100 if primary else mv.ailment_chance or 100
            detail = "badly poisoned" if "badly poison" in e else mv.ailment
            add("status", primary, chance, detail)
        if cat == "heal" or mv.healing > 0 or "completely healing" in e or "restores" in e and not mv.damaging:
            add("heal", True, 100, f"{mv.healing}% of max HP" if mv.healing > 0 else "full HP" if "completely" in e else None)
        if mv.drain > 0:
            add("drain", False, 100, f"{mv.drain}% of damage dealt")
        if mv.drain < 0 or "recoil" in e or "user receives" in e:
            add("recoil", False)
        if "switch out" in e and mv.damaging:
            add("pivot")
        if cat == "force-switch":
            add("phaze")
        if cat in ("field-effect", "whole-field-effect"):
            add("field", True, 100, mv.name)
        if "prevents any moves from hitting the user" in e or "survives" in e and "1 hp" in e:
            add("protect")
        if "hits every turn for" in e:
            add("lock-in", False, 100, "2-3 turns, then it's confused")
        if "others decrease speed but raise attack and defense" in e:          # Curse, for anyone but a Ghost
            add("boost", True, 100, "atk +1, def +1, spe -1 (non-Ghost users)")
        if "max out its attack" in e:                                           # Belly Drum
            add("boost", True, 100, "atk +6 for half its HP")
        if "switch out the user and pass effects" in e:                          # Baton Pass
            add("pivot", True, 100, "passes its boosts")
        if "into a doll" in e:                                                   # Substitute
            add("protect", True, 100, "Substitute")
        if "resets all" in e and "stats" in e:                                   # Haze
            add("reset")
        if "recover half its max hp at the end of the next turn" in e:          # Wish
            add("heal", True, 100, "50% next turn")
        if "average of their current hp" in e:                                   # Pain Split
            add("heal", True, 100, "averages HP with the target")
        if "only works if the user is sleeping" in e:                            # Sleep Talk
            add("sleep-talk")
        if "cures the entire party" in e or "cleanses the user" in e:            # Heal Bell, Aromatherapy, Refresh
            add("cure")
        if "can only use damaging moves" in e:                                   # Taunt
            add("taunt")
        if "repeat its last used move" in e:                                     # Encore
            add("encore")
        if "removes" in e and ("spikes" in e or "field effects" in e):          # Rapid Spin, Defog
            add("clear")
        if "charge" in mv.flags:
            add("charge", False)
        if "recharge" in mv.flags:
            add("recharge", False)
        if "user faints" in e or "both faint" in e:                              # Explosion; Perish Song
            add("self-ko", False)
        if mv.flinch:
            add("flinch", False, mv.flinch)
        if not plays:
            add("utility")
        return plays

    def has(self, mv, play, primary_only=True):
        return any(p["play"] == play and (p["primary"] or not primary_only) for p in mv.plays)
