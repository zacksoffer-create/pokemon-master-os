"""The role engine (docs/TRAINER_REPORT.md, Part 2, step 1): what job a build does, and how sure we are.

Every role is defined once, in trainers/roles.json, as a profile of signals: stat shape (percentiles against the
generation's fully evolved Pokémon at the same level and the default spread), nature, EV spread, item, ability,
typing and move categories. Move categories come from the game's data (PokeAPI move, meta and stat-change tables,
rolled back to the generation), plus named lists where the data has no clean field. This module reads that file and
nothing else for roles; the solver (trainers/solver.py) and the playsheet (trainers/playsheet.py) read the same
scores, so a role means one thing everywhere.

    book = RoleBook(store)
    book.classify(build, "platinum")   # {"primary", "secondary", "roles": [...ranked, with the signals that fired]}

A role's score is the weighted mean of its signals over its positive weights, clipped to 0-1; negative weights pull
it down; a role whose gate ("requires") isn't met scores 0 and says what it needs. Deterministic: the same build in
the same game always reads the same. Not a battle simulation and not a damage calculation.
"""
import bisect
import json
import math
import os
from functools import lru_cache

from trainers.era import GAME_GEN, STATS
from trainers.matrix import rewrite

HERE = os.path.dirname(os.path.abspath(__file__))
ROLES_PATH = os.path.join(HERE, "roles.json")
SETUP = ("setup_physical", "setup_special", "setup_speed", "setup_defense")
STAT_WORDS = {"hp": "HP", "atk": "Attack", "def": "Defense", "spa": "Sp. Atk", "spd": "Sp. Def", "spe": "Speed"}
LISTED = ("moves", "attacks", "stab", "support_moves", "coverage")   # signals whose evidence is a list of names


def load_roles(path=None):
    with open(path or ROLES_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def live(d):
    """A config section without its "_note" keys."""
    return {k: v for k, v in d.items() if not k.startswith("_")}


def _pct(value, pool):
    """Where a value sits in a sorted pool, 0-1 (ties count half)."""
    if not pool:
        return 0.5
    lo, hi = bisect.bisect_left(pool, value), bisect.bisect_right(pool, value)
    return (lo + hi) / 2 / len(pool)


class RoleBook:
    def __init__(self, store, path=None):
        self.store, self.era = store, store.era
        self.cfg = load_roles(path)
        self.roles = live(self.cfg["roles"])
        self.signal_defs = live(self.cfg["signals"])
        self.categories = live(self.cfg["move_categories"])
        self.items = {k: v for k, v in live(self.cfg["item_groups"]).items() if k != "for_types"}
        self.item_types = self.cfg["item_groups"].get("for_types", {})
        self.abilities = live(self.cfg["ability_groups"])
        self.power = self.cfg["power"]
        self.by_name = live(self.cfg["stat_changes_by_name"])
        self.weathers = live(self.cfg["weathers"])

    # --- moves ----------------------------------------------------------------------------------------
    @lru_cache(maxsize=None)
    def move(self, name, gen):
        """The move's data for this generation, plus the categories it falls in."""
        info = dict(self.era.move_info(name, gen))
        if name in self.by_name:
            info["stat_changes"] = dict(self.by_name[name])
        info["name"] = name
        info["categories"] = frozenset(c for c, spec in self.categories.items() if self._fits(name, info, spec))
        return info

    @staticmethod
    def _fits(name, info, spec):
        if name in spec.get("names", ()):
            return True
        if name in spec.get("exclude_names", ()):
            return False
        rule = spec.get("rule")
        effect = info["effect"].lower()
        if rule == "damaging":
            if info["class"] == "status" or info["meta"] == "ohko" or "user faints" in effect:
                return False
            if info["priority"] < spec.get("priority_at_least", -99):
                return False
            return not spec.get("ailments") or info["ailment"] in spec["ailments"]
        if rule == "user_boost":
            return info["class"] == "status" and info["target"] in ("user", "user-and-allies") and \
                any(info["stat_changes"].get(s, 0) > 0 for s in spec["stats"])
        if rule == "heal_self":
            return info["class"] == "status" and info["meta"] == "heal" and info["target"] == "user"
        if rule == "inflicts":
            return info["class"] == "status" and info["ailment"] in spec["ailments"]
        if rule == "force_switch":
            return info["class"] == "status" and info["meta"] == "force-switch"
        if rule == "user_faints":
            return "user faints" in effect
        if rule == "ohko":
            return info["meta"] == "ohko"
        if rule == "recoil":
            return info["class"] != "status" and info["drain"] < 0
        return False

    def effective_power(self, mv, types, ability, turn_cost=True):
        """Base power x accuracy x STAB x hits, with the config's adjustments (turn_cost=False leaves out the
        discount for moves that cost a turn). Ranks attacks; not a damage calculation."""
        if mv["class"] == "status" or "attack" not in mv["categories"]:
            return 0.0
        p = self.power
        base = "Hidden Power" if mv["name"].startswith("Hidden Power") else mv["name"]
        power = mv["power"] if mv["power"] and mv["power"] > 1 else p["variable_power"].get(base, 0)
        if not power:
            return 0.0
        ab = p["abilities"].get(ability or "", {})
        if "at_most" in ab and power <= ab["at_most"]:
            power *= ab["times"]
        acc = (mv["accuracy"] or 100) / 100
        stab = (ab.get("stab", p["stab"])) if mv["type"] in types else 1.0
        hits = 1
        if mv["hits"]:
            lo, hi = mv["hits"]
            hits = hi if lo == hi else ab.get("multi_hit", p["multi_hit_average"])
        return power * acc * stab * hits * (p["factor"].get(mv["name"], 1.0) if turn_cost else 1.0)

    @lru_cache(maxsize=None)
    def type_list(self, gen):
        return tuple(sorted(self.era.type_names(gen).values()))

    # --- the pool the stat signals compare against -------------------------------------------------------
    @lru_cache(maxsize=None)
    def pool(self, gen, level):
        d = self.store.config["defaults"]
        evs = {s: d["even_evs_each"] if d["evs"] == "even" else 0 for s in STATS}
        ivs = {s: d["ivs"] for s in STATS}
        cols = {k: [] for k in (*STATS, "best_attack", "bulk_physical", "bulk_special", "bulk_both", "typing")}
        for sp in self.era.fully_evolved(gen):
            try:
                st = self.era.stats(sp, gen, level, None, ivs, evs)
                types = self.era.types(sp, gen)
            except (KeyError, IndexError):
                continue
            abil = self.era.abilities(sp, gen)
            for k, v in self._shape(st).items():
                cols[k].append(v)
            cols["typing"].append(self.typing_score(types, abil[0] if abil else None, gen))
        return {k: sorted(v) for k, v in cols.items()}

    @staticmethod
    def _shape(st):
        out = dict(st)
        out["best_attack"] = max(st["atk"], st["spa"])
        out["bulk_physical"] = st["hp"] * st["def"]
        out["bulk_special"] = st["hp"] * st["spd"]
        out["bulk_both"] = st["hp"] * math.sqrt(st["def"] * st["spd"])
        return out

    @lru_cache(maxsize=None)
    def typing_score(self, types, ability, gen):
        spec = self.signal_defs["typing"]
        w = spec.get("weights", {"immune": 2, "resist": 1, "weak": -1, "very_weak": -2})
        table = self.store.config["abilities"]
        total = 0
        for t in self.type_list(gen):
            m, _ = rewrite(self.era.multiplier(t, types, gen), t, ability, table)
            total += w["immune"] if m == 0 else w["resist"] if m < 1 else w["very_weak"] if m >= 4 else w["weak"] if m > 1 else 0
        return total

    # --- reading a build ----------------------------------------------------------------------------------
    def context(self, build, game, level=None, team_weather=None):
        """Everything the signals read: real stats (with stat-doubling abilities and items), the filled-in fields,
        typing, each move's data, categories and effective power, and the weather it has (its own, plus
        team_weather, the weathers its teammates set, in a team read)."""
        gen = GAME_GEN[game]
        level = level or self.cfg["pool"]["level"]
        stats, level, used = self.store.stats(build, game, level)
        filled, _ = self.store.filled(build, gen)
        stats = dict(stats)
        mult = self.power["stat_multipliers"]
        item = self.era.item_name(build.item) if build.item else None
        for s, x in mult["abilities"].get(filled["ability"] or "", {}).items():
            stats[s] = int(stats[s] * x)
        rule = mult["items"].get(item or "")
        if rule and build.species in rule["species"]:
            for s, x in rule["stats"].items():
                stats[s] = int(stats[s] * x)
        types = self.era.types(build.species, gen)
        moves = []
        for m in build.moves:
            try:
                mv = self.move(m, gen)
            except (KeyError, IndexError):
                continue
            eff = self.effective_power(mv, types, filled["ability"])
            stat = stats["atk" if mv["class"] == "physical" else "spa"] / (max(stats["atk"], stats["spa"]) or 1)
            plain = self.effective_power(mv, types, filled["ability"], turn_cost=False)
            moves.append({**mv, "eff": eff, "scaled": eff * stat, "plain": plain * stat})
        phys = sum(m["eff"] for m in moves if m["class"] == "physical")
        spec = sum(m["eff"] for m in moves if m["class"] == "special")
        evs_recorded = bool(build.evs and sum(build.evs.values()))
        invest = self._investment(filled, evs_recorded)
        lean = self.cfg["pool"]["investment_lean"]
        if abs(invest["atk"] - invest["spa"]) >= lean:
            matching = "atk" if invest["atk"] > invest["spa"] else "spa"
        elif phys or spec:
            matching = "atk" if phys >= spec else "spa"
        else:
            matching = "atk" if stats["atk"] >= stats["spa"] else "spa"
        return {"build": build, "game": game, "gen": gen, "level": level, "stats": stats, "types": types,
                "filled": filled, "item": item, "ability": filled["ability"], "moves": moves, "matching": matching,
                "defaults_used": used, "evs_recorded": evs_recorded,
                "own_weather": self.weather_of(build.moves, filled["ability"]),
                "weather": set(self.weather_of(build.moves, filled["ability"])) | set(team_weather or ())}

    def _investment(self, filled, evs_recorded=True):
        """How much a build puts into Attack and Sp. Atk: its recorded EVs (the default spread counts as none),
        plus or minus the nature's tilt (in EV terms)."""
        tilt = self.cfg["pool"]["nature_tilt"]
        up, down = self.era.nature(filled["nature"]) if filled["nature"] else (None, None)
        evs = filled["evs"] if evs_recorded else {}
        return {s: evs.get(s, 0) + (tilt if up == s else -tilt if down == s else 0) for s in ("atk", "spa")}

    def signals(self, ctx):
        """{signal: (value 0-1, evidence)} for every signal in the config."""
        pool = self.pool(ctx["gen"], ctx["level"])
        shape = self._shape(ctx["stats"])
        up, down = self.era.nature(ctx["filled"]["nature"]) if ctx["filled"]["nature"] else (None, None)
        evs, ivs = ctx["filled"]["evs"], ctx["filled"]["ivs"]
        moves = ctx["moves"]
        cls = {"atk": "physical", "spa": "special"}[ctx["matching"]]
        attacks = [m for m in moves if m["eff"] > 0]
        out = {}
        for name, spec in self.signal_defs.items():
            kind = spec["kind"]
            stats_named = [ctx["matching"] if s == "matching" else s for s in spec.get("stats", [])]
            if kind == "stat_pct":
                key = spec["stat"]
                if key == "best_attack":            # its better attacking stat, against the field's same stat
                    key = "atk" if ctx["stats"]["atk"] >= ctx["stats"]["spa"] else "spa"
                raw = _pct(shape[key], pool[key])
                v = 1 - raw if spec.get("invert") else raw
                if spec.get("invert"):
                    rel = "the slowest in the field" if v >= 0.995 else f"slower than {round(100 * v)}% of the field"
                else:
                    rel = "the top of the field" if raw >= 0.995 else f"above {round(100 * raw)}% of the field"
                out[name] = (v, [f"{STAT_WORDS[key]} {shape[key]} ({rel})"])
            elif kind == "bulk_pct":
                key = "bulk_" + spec["side"]
                side = {"both": "overall"}.get(spec["side"], spec["side"])
                v = _pct(shape[key], pool[key])
                rel = "the top of the field" if v >= 0.995 else f"above {round(100 * v)}% of the field"
                out[name] = (v, [f"{side} bulk {rel}"])
            elif kind == "typing_pct":
                sc = self.typing_score(ctx["types"], ctx["ability"], ctx["gen"])
                out[name] = (_pct(sc, pool["typing"]), ["/".join(ctx["types"]) + (f" ({ctx['ability']})" if ctx["ability"] else "")])
            elif kind == "nature":
                raises = [ctx["matching"] if s == "matching" else s for s in spec.get("raises", [])]
                ok = (not raises or up in raises) and (not spec.get("lowers") or down in spec["lowers"])
                out[name] = (1.0 if up and ok else 0.0, [ctx["filled"]["nature"]] if up and ok else [])
            elif kind == "evs":
                total = sum(evs.get(s, 0) for s in stats_named)
                words = spec["label"] if spec["label"].startswith("EVs") else spec["label"].replace(" EVs", "") + " EVs"
                out[name] = (min(1.0, total / spec["full_at"]), [f"{total} {words}"] if total else [])
            elif kind == "iv_low":
                low = ivs.get(spec["stat"], 31) <= spec["at_most"]
                out[name] = (1.0 if low else 0.0, [f"{spec['stat']} IV {ivs.get(spec['stat'])}"] if low else [])
            elif kind == "item":
                hit = ctx["item"] in self.items[spec["group"]]
                out[name] = (1.0 if hit else 0.0, [ctx["item"]] if hit else [])
            elif kind == "ability":
                hit = ctx["ability"] in self.abilities[spec["group"]]
                out[name] = (1.0 if hit else 0.0, [ctx["ability"]] if hit else [])
            elif kind == "type":
                hit = [t for t in ctx["types"] if t in spec["types"]]
                out[name] = (1.0 if hit else 0.0, hit)
            elif kind == "attacks":
                pw = "scaled" if spec.get("scaled") else "eff"
                pool_ = [m for m in attacks if m[pw] >= spec["min_power"]]
                c = spec["class"]
                if c == "mixed":
                    p = [m["name"] for m in pool_ if m["class"] == "physical"]
                    s = [m["name"] for m in pool_ if m["class"] == "special"]
                    n, ev = min(len(p), len(s)), (p + s if p and s else [])
                else:
                    want = cls if c == "matching" else c
                    ev = [m["name"] for m in pool_ if want == "any" or m["class"] == want]
                    n = len(ev)
                out[name] = (min(1.0, n / spec["full_at"]), ev)
            elif kind == "stab":
                ev = [m["name"] for m in attacks if m["type"] in ctx["types"] and m["eff"] >= spec["min_power"]]
                out[name] = (1.0 if ev else 0.0, ev)
            elif kind == "best_power":
                pw = "scaled" if spec.get("scaled") else "eff"
                best = max(attacks, key=lambda m: (m[pw], m["name"]), default=None)
                out[name] = (min(1.0, best[pw] / spec["full_at"]) if best else 0.0,
                             [f"{best['name']} ({round(best[pw])})"] if best else [])
            elif kind == "matched_setup":
                ev = [m["name"] for m in moves if m["categories"] & set(SETUP[:3]) and
                      (m["stat_changes"].get(ctx["matching"], 0) > 0 or set(k for k, v in m["stat_changes"].items()
                                                                             if v > 0) == {"spe"})]
                out[name] = (min(1.0, len(ev) / spec["full_at"]), ev)
            elif kind == "coverage":
                hit = self.covered(attacks, ctx["gen"], spec["min_power"])
                out[name] = (min(1.0, len(hit) / spec["full_at"]), sorted(hit))
            elif kind == "weather_sweep":
                ev = []
                for w, a in self._weather_users(ctx):
                    if a in self.weathers[w]["sweep_abilities"]:
                        ev.append(f"{a} with {w}")
                        ev += [m for m in ctx["own_weather"].get(w, []) if m in ctx["build"].moves]   # what sets it
                out[name] = (1.0 if ev else 0.0, ev)
            elif kind == "weather_boosted":
                ev = []
                for w in sorted(ctx["weather"]):
                    spec_w = self.weathers[w]
                    ev += [m["name"] for m in attacks if (m["type"] in spec_w["boosted_types"]
                                                         or m["name"] in spec_w["boosted_moves"]) and m["name"] not in ev]
                out[name] = (min(1.0, len(ev) / spec["full_at"]), ev)
            elif kind == "lure":
                ev = self._lure(ctx, attacks, spec["min_power"], spec["invested_at_least"])
                out[name] = (1.0 if ev else 0.0, ev)
            elif kind == "support_moves":
                ev = [m["name"] for m in moves if m["class"] == "status" and not (m["categories"] & set(SETUP))]
                out[name] = (min(1.0, len(ev) / spec["full_at"]), ev)
            elif kind == "moves":
                want = spec["category"] if isinstance(spec["category"], list) else [spec["category"]]
                hit = [m for m in moves if m["categories"] & set(want)]
                count = sum((m["accuracy"] or 100) / 100 if m["class"] == "status" else 1.0 for m in hit)
                out[name] = (min(1.0, count / spec["full_at"]) * spec.get("scale", 1.0), [m["name"] for m in hit])
            else:
                raise ValueError(f"signal {name}: unknown kind {kind}")
        return out

    def covered(self, attacks, gen, min_power):
        """The single defending types at least one of these attacks hits super-effectively, at decent power."""
        out = set()
        for m in attacks:
            if m["eff"] >= min_power:
                out |= self.super_effective(m["type"], gen)
        return out

    @lru_cache(maxsize=None)
    def super_effective(self, attack_type, gen):
        return frozenset(t for t in self.type_list(gen) if self.era.multiplier(attack_type, [t], gen) >= 2)

    def weather_of(self, moves, ability):
        """The weathers a build sets itself: {weather: what sets it}."""
        out = {}
        for w, spec in self.weathers.items():
            hit = [m for m in moves if m in spec["moves"]] + ([ability] if ability in spec["abilities"] else [])
            if hit:
                out[w] = hit
        return out

    def _weather_users(self, ctx):
        return [(w, ctx["ability"]) for w in sorted(ctx["weather"])
                if ctx["ability"] in self.weathers[w]["sweep_abilities"] + self.weathers[w]["other_abilities"]]

    def _lure(self, ctx, attacks, min_power, invested):
        """An attack from its other side, with some investment behind it, that hits super-effectively a type
        resisting every same-type attack it carries on its main side: the move aimed at what would normally
        switch in on it."""
        main = {"atk": "physical", "spa": "special"}[ctx["matching"]]
        off = "spa" if ctx["matching"] == "atk" else "atk"
        if not ctx["evs_recorded"] and not ctx["filled"]["nature"]:
            return []                                   # the default spread is not evidence
        if self._investment(ctx["filled"], ctx["evs_recorded"])[off] < invested:
            return []
        stabs = {m["type"] for m in attacks if m["class"] == main and m["type"] in ctx["types"]}
        if not stabs:
            return []
        gen = ctx["gen"]
        walls = {t for t in self.type_list(gen) if all(self.era.multiplier(s, [t], gen) < 1 for s in stabs)}
        ev = []
        for m in attacks:
            if m["class"] == main or m["eff"] < min_power:
                continue
            hit = sorted(t for t in walls if self.era.multiplier(m["type"], [t], gen) >= 2)
            if hit:
                ev.append(f"{m['name']} for {', '.join(hit)}")
        return ev

    # --- scoring --------------------------------------------------------------------------------------
    def value(self, key, sig):
        """A weight key is a signal, or a group: "a|b" reads the best of them, "a&b" the weakest (both needed)."""
        if "|" in key:
            parts = [self.value(k, sig) for k in key.split("|")]
            return max(parts, key=lambda p: (p[0], -len(p[1])))
        if "&" in key:
            parts = [self.value(k, sig) for k in key.split("&")]
            return min(p[0] for p in parts), [e for p in parts for e in p[1]]
        return sig[key]

    def gate_progress(self, role_id, sig):
        """How close a build is to a role's gate, 0-1 (1: met). Steers the solver toward a role it can't score yet."""
        best = 0.0
        for alt in self.roles[role_id]["requires"]:
            parts = []
            for s, m in alt.items():
                v = self.value(s, sig)[0]
                parts.append(1.0 if v > m else (v / m if m else 0.0) * 0.99)
            best = max(best, sum(parts) / len(parts))
        return best

    def label(self, key):
        if "|" in key:
            return " or ".join(self.label(k) for k in key.split("|"))
        if "&" in key:
            return " with ".join(self.label(k) for k in key.split("&"))
        return self.signal_defs[key]["label"]

    def score(self, role_id, sig, explain=True):
        role = self.roles[role_id]
        gate = None
        for alt in role["requires"]:
            if all(self.value(s, sig)[0] > m for s, m in alt.items()):
                gate = alt
                break
        if gate is None:
            if not explain:
                return {"role": role_id, "score": 0.0, "fit": 0.0}
            need = [" and ".join(self.label(s) for s in alt) for alt in role["requires"]]
            return {"role": role_id, "name": role["name"], "family": role["family"], "score": 0.0, "fit": 0.0,
                    "because": [], "against": [], "needs": need}
        pos = sum(w for w in role["weights"].values() if w > 0)
        parts = [(s, w, *self.value(s, sig)) for s, w in role["weights"].items()]
        raw = sum(w * v for _, w, v, _ in parts)
        fit = max(0.0, min(1.0, raw / pos))
        if not explain:
            return {"role": role_id, "score": round(fit * role.get("prior", 1.0), 4), "fit": round(fit, 4)}
        because = sorted((p for p in parts if p[1] > 0 and p[2] > 0), key=lambda p: (-p[1] * p[2], p[0]))
        against = sorted((p for p in parts if p[1] < 0 and p[2] > 0), key=lambda p: (p[1] * p[2], p[0]))
        fmt = lambda s, w, v, ev: {"signal": s, "label": self.label(s), "value": round(v, 3), "weight": w,
                                   "evidence": ev}
        return {"role": role_id, "name": role["name"], "family": role["family"],
                "score": round(fit * role.get("prior", 1.0), 4), "fit": round(fit, 4),
                "because": [fmt(*p) for p in because], "against": [fmt(*p) for p in against], "needs": []}

    def scores(self, sig):
        out = [self.score(r, sig) for r in self.roles]
        return sorted(out, key=lambda r: (-r["score"], r["role"]))

    def confidence(self, fit):
        c = self.cfg["confidence"]
        return "strong" if fit >= c["strong_at_least"] else "solid" if fit >= c["solid_at_least"] else "loose"

    def classify(self, build, game, level=None, team_weather=None):
        """The build's roles, ranked, with the primary and secondary and how sure each is. team_weather: the
        weathers its teammates set (a team read); alone, a build has only its own."""
        ctx = self.context(build, game, level, team_weather)
        sig = self.signals(ctx)
        ranked = self.scores(sig)
        top, second = ranked[0], ranked[1]
        margin = round(top["score"] - second["score"], 4)
        clear = margin >= self.cfg["confidence"]["clear_margin"]
        pick = lambda r: {"role": r["role"], "name": r["name"], "family": r["family"], "score": r["score"],
                          "confidence": self.confidence(r["score"])}
        also = [pick(r) for r in ranked[2:] if r["score"] >= self.cfg["confidence"]["also_at_least"]]
        return {"build": build.id, "species": build.species, "game": game, "level": ctx["level"],
                "primary": {**pick(top), "margin": margin, "clear": clear},
                "secondary": pick(second) if second["score"] > 0 else None, "also": also,
                "roles": ranked, "signals": {k: round(v[0], 3) for k, v in sig.items()},
                "evidence": {k: v[1] for k, v in sig.items() if v[1]}, "defaults_used": ctx["defaults_used"],
                "matching": ctx["matching"]}

    def reason(self, b):
        """One signal that fired, in words: "Swords Dance", "attacks: Earthquake, Dragon Claw", "Speed 333 (…)"."""
        kinds = {self.signal_defs[p]["kind"] for g in b["signal"].split("|") for p in g.split("&")}
        ev = b["evidence"]
        if not ev:
            return b["label"]
        if kinds <= set(LISTED) and not kinds <= {"moves"}:
            return f"{b['label']}: {', '.join(ev)}"
        return ", ".join(ev)

    def line(self, result, top=2, reasons=3):
        """One readable line per role: "physical setup sweeper (0.99, strong): Swords Dance; Attack 359 (…)"."""
        parts = []
        for r in result["roles"][:top]:
            if not r["score"]:
                continue
            why = []
            for b in r["because"]:
                text = self.reason(b)
                if text not in why:
                    why.append(text)
                if len(why) == reasons:
                    break
            parts.append(f"{r['name']} ({r['score']:.2f}, {self.confidence(r['score'])}): {'; '.join(why)}")
        return " | ".join(parts)
