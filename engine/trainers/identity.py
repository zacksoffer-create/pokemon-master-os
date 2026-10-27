"""Battle identity v0: what a build does and what to call it, from the League fights it already has.

The master battle-intelligence handoff (docs/battle/BATTLE_INTELLIGENCE.md) asks for one evidence-backed name per
exact set, chosen deterministically, with the facts behind it, the alternatives it beat and the names it nearly
earned. This is the first slice: a fingerprint of the set (its methods, conditions and League-lens numbers), the
fourteen functions in three tiers (mechanically plausible, supported by the League lens, observed in 6v6), and the
name engine (hard gates, then a lexicographic ranking). Pure: evaluate(build, game, read, ctx, speed) reads the
team-role read (TeamRoles.read, with its lens rows), the role engine's context (RoleBook.context) and, when given,
the recognition Speed part; it fights nothing new.

Every rule and word lives in trainers/identity.json. Every bar is one of the calibrated team-role bars
(team_roles.json) or a Gen IV mechanic; a function with no calibrated bar yet is shown as pending and names nothing.
The browser runs the same code (app/web/37_identity.html); app/test_identity_parity.mjs holds the two together.

Run:  python3 -I trainers/identity.py --pilot        the pilot sets (trainers/identity_pilot.json), read and named
      python3 -I trainers/identity.py <build id>     one stored build
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

import rules  # noqa: E402

STATS = ("hp", "atk", "def", "spa", "spd", "spe")


def load_config():
    with open(os.path.join(HERE, "identity.json"), encoding="utf-8") as fh:
        return json.load(fh)


def lookup(roles, path):
    """'sweeper.first_at_least' -> team_roles.json roles.sweeper.first_at_least."""
    role, key = path.split(".")
    return roles[role][key]


def r4(x):
    return round(x, 4)


def pct(n, of):
    return round(100 * n / of) if of else 0


def share(n, of):
    return n / of if of else 0.0


class Identity:
    def __init__(self, cfg=None, roles_cfg=None):
        self.cfg = cfg or load_config()
        if roles_cfg is None:
            from trainers.team_roles import load_config as roles_config
            roles_cfg = roles_config()
        self.rc = roles_cfg
        self.bars = {k: lookup(roles_cfg["roles"], v) for k, v in self.cfg["bars"].items() if not k.startswith("_")}
        self.switch_abilities = lookup(roles_cfg["roles"], self.cfg["switch_abilities"])
        self.heads = {h["id"]: h for h in self.cfg["heads"]}
        self.head_order = [h["id"] for h in self.cfg["heads"]]
        self.mods = {m["id"]: m for m in self.cfg["modifiers"]}
        self.mod_order = [m["id"] for m in self.cfg["modifiers"]]

    # --- the set's commitments: its four moves, its item and its spread ------------------------------------
    def tags_of_move(self, m, gen):
        C = self.cfg["categories"]
        cats = set(m["categories"])
        has = lambda k: bool(cats & set(C[k]))
        out = []
        damaging = m["class"] in ("physical", "special")
        if damaging and not has("dedicated"):
            out.append("attack")
        if damaging and (m.get("priority") or 0) > 0 and "fake_out" not in cats:
            out.append("priority")
        for k in ("setup", "recovery", "support", "status", "pivot", "hazard", "screens", "weather", "room", "cleric",
                  "self_ko", "trap"):
            if has(k):
                out.append(k)
        if m["name"] in self.cfg["self_side_removal"].get(str(gen), []):
            out.append("removal")
        if "substitute" in cats:
            out.append("substitute")
        return out

    def spread_of(self, ctx, gen):
        """The set's leans from its nature and EVs: offense, defense, speed, slow. None with no EVs recorded (or Gen II,
        where every stat is maxed and there is nothing to choose)."""
        if gen < 3 or not ctx.get("evs_recorded"):
            return None
        S = self.cfg["spread"]
        f = ctx["filled"]
        evs, ivs = f["evs"], f["ivs"]
        up, down = self.cfg["natures"].get(f["nature"] or "", [None, None])
        out = []
        for lean in ("offense", "defense", "speed"):
            rule = S[lean]
            if sum(evs.get(s, 0) for s in rule["evs"]) >= S["full"] or up in rule["nature_up"]:
                out.append(lean)
        if down in S["slow"]["nature_down"] or (ivs.get("spe", 31) <= S["slow"]["spe_iv_at_most"] and not evs.get("spe")):
            out.append("slow")
        return out

    def resources(self, ctx, gen):
        I = self.cfg["items"]
        out = []
        for m in ctx["moves"]:
            out.append({"id": "move:" + m["name"], "kind": "move", "label": m["name"], "tags": self.tags_of_move(m, gen)})
        item = ctx.get("item")
        if item:
            out.append({"id": "item", "kind": "item", "label": item,
                        "tags": [k for k in ("offense", "choice", "speed", "sustain", "setup", "field", "weather", "slow") if item in I[k]]})
        lean = self.spread_of(ctx, gen)
        if lean is not None:
            out.append({"id": "spread", "kind": "spread", "label": "its spread", "tags": lean})
        return out

    @staticmethod
    def selects(sel, res):
        kind, tag = sel.split(":")
        want = {"moves": "move", "items": "item", "spread": "spread"}[kind]
        return res["kind"] == want and tag in res["tags"]

    # --- measures, from the League lens rows ---------------------------------------------------------------
    @staticmethod
    def stage_mult(stage):
        st = max(0, min(int(stage or 0), 2))
        return (2 + st) / 2

    def reach(self, lens, gen, mult):
        """{ko2, ko1}: League Pokémon its best damaging move 2HKOs / OHKOs at its lowest roll times mult(move) (None
        leaves a move out)."""
        ko2 = ko1 = 0
        for foe in lens:
            best = 0.0
            for mv in sorted(foe["d"]):
                lo = foe["d"][mv][0]
                k = mult(mv)
                if k is None or rules.category(gen, mv) not in ("Physical", "Special"):
                    continue
                best = max(best, lo * k)
            ko2 += best >= 50
            ko1 += best >= 100
        return {"ko2": ko2, "ko1": ko1}

    def first(self, lens, mult):
        return sum(1 for foe in lens if int(foe["s"][0] * mult) > foe["s"][1])

    def measures(self, read, ctx, gen, res):
        lens = read["lens"]
        N = len(lens)
        C = self.cfg
        by_name = {m["name"]: m for m in ctx["moves"]}
        tags = {r["label"]: r["tags"] for r in res if r["kind"] == "move"}
        boosts = read["facts"]["boosts"]
        side = lambda mv: {"Physical": "atk", "Special": "spa"}.get(rules.category(gen, mv))
        reusable = lambda mv: None if "self_ko" in tags.get(mv, []) else 1.0
        boosted = lambda mv: None if "self_ko" in tags.get(mv, []) else self.stage_mult(boosts.get(side(mv) or "", 0))
        prio = lambda mv: 1.0 if "priority" in tags.get(mv, []) else None
        prio_b = lambda mv: self.stage_mult(boosts.get(side(mv) or "", 0)) if "priority" in tags.get(mv, []) else None
        selfko = lambda mv: 1.0 if "self_ko" in tags.get(mv, []) else None
        roles = {r["role"]: r for r in read["roles"]}
        M = {"N": N, "first": self.first(lens, 1.0), "first_boosted": self.first(lens, self.stage_mult(boosts.get("spe", 0))),
             "room_first": sum(1 for foe in lens if foe["s"][0] < foe["s"][1]),
             "plain": self.reach(lens, gen, reusable), "boosted": self.reach(lens, gen, boosted),
             "priority": self.reach(lens, gen, prio), "priority_boosted": self.reach(lens, gen, prio_b),
             "self_ko": self.reach(lens, gen, selfko),
             "take3": roles["tank"]["numbers"]["take_share"], "take2": roles["support"]["numbers"]["survive"],
             "wall": {"physical": roles["wall"]["numbers"]["physical"], "special": roles["wall"]["numbers"]["special"]},
             "sustain": roles["wall"]["numbers"]["sustain"],
             "sub_safe": sum(1 for foe in lens if all(v[1] < 100 * C["pinch"]["substitute_cost"] for v in foe["i"].values())),
             "setup_moves": [m["name"] for m in ctx["moves"] if "setup" in tags.get(m["name"], [])],
             "priority_moves": [m["name"] for m in ctx["moves"] if "priority" in tags.get(m["name"], [])]}
        ev = read["evidence"]
        phys = (ev.get("physical") or {}).get("2hko", -1) if ev.get("physical") else -1
        spec = (ev.get("special") or {}).get("2hko", -1) if ev.get("special") else -1
        M["side"] = "physical" if phys > spec else ("special" if spec > phys else None)
        # own weather and what it does for the set
        W = C["weather"]
        own = None
        for m in ctx["moves"]:
            if m["name"] in W["moves"]:
                own = W["moves"][m["name"]]
                break
        if own is None and ctx.get("ability") in W["abilities"]:
            own = W["abilities"][ctx["ability"]]
        M["weather"] = None
        if own:
            fast = W["speed_abilities"].get(ctx.get("ability")) == own
            btype = W["boost_type"].get(own)
            boosted_types = [m["name"] for m in ctx["moves"] if btype and m["type"] == btype and m["class"] in ("physical", "special")]
            wmult = lambda mv: None if "self_ko" in tags.get(mv, []) else (1.5 if btype and by_name.get(mv, {}).get("type") == btype else
                                                                          (0.5 if own == "rain" and by_name.get(mv, {}).get("type") == "Fire" else
                                                                           (0.5 if own == "sun" and by_name.get(mv, {}).get("type") == "Water" else 1.0)))
            wmult_b = lambda mv: None if wmult(mv) is None else wmult(mv) * self.stage_mult(boosts.get(side(mv) or "", 0))
            by_move = any(m["name"] in W["moves"] for m in ctx["moves"])
            rock = W["rocks"][own]
            M["weather"] = {"kind": own, "name": W["names"][own], "speed_ability": fast, "boosted_moves": boosted_types,
                            "by": "move" if by_move else "ability",
                            "turns": (W["rock_turns"] if ctx.get("item") == rock else W["turns"]) if by_move else None,
                            "rock": rock if ctx.get("item") == rock else None,
                            "benefits": bool(fast or boosted_types),
                            "first": self.first(lens, 2.0 if fast else 1.0),
                            "first_boosted": self.first(lens, (2.0 if fast else 1.0) * self.stage_mult(boosts.get("spe", 0))),
                            "plain": self.reach(lens, gen, wmult), "boosted": self.reach(lens, gen, wmult_b)}
        # a low-HP window: a pinch ability with moves of its type, reached by Substitute and a pinch berry
        P = C["pinch"]
        M["window"] = None
        ptype = P["abilities"].get(ctx.get("ability"))
        berry = C["items"]["pinch_berries"].get(ctx.get("item") or "")
        subs = any("substitute" in tags.get(m["name"], []) for m in ctx["moves"])
        if ptype and any(m["type"] == ptype and m["class"] in ("physical", "special") for m in ctx["moves"]) and (berry or subs):
            st = dict(boosts)
            if berry:
                st[berry] = st.get(berry, 0) + 1
            wm = lambda mv: None if "self_ko" in tags.get(mv, []) else \
                (1.5 if by_name.get(mv, {}).get("type") == ptype else 1.0) * self.stage_mult(st.get(side(mv) or "", 0))
            M["window"] = {"ability": ctx["ability"], "type": ptype, "berry": ctx.get("item") if berry else None, "berry_stat": berry,
                           "substitute": subs, "first": self.first(lens, self.stage_mult(st.get("spe", 0))),
                           "reach": self.reach(lens, gen, wm), "sub_safe": M["sub_safe"]}
        # Eruption and Water Spout: power falls with HP; Stealth Rock takes its share on entry
        sr = C["stealth_rock"]
        sr_share = 0.0 if ctx.get("ability") == "Magic Guard" else sr["share"] * rules.effectiveness(gen, sr["type"], list(ctx["types"]))
        M["stealth_rock"] = r4(sr_share)
        hp_moves = [m["name"] for m in ctx["moves"] if m["name"] in C["hp_power"]["moves"]]
        M["hp_power"] = None
        if hp_moves:
            left = 1 - sr_share
            power = max(1, math.floor(150 * left)) / 150
            hm = lambda mv: None if "self_ko" in tags.get(mv, []) else (power if mv in hp_moves else 1.0)
            M["hp_power"] = {"moves": hp_moves, "after_rocks": r4(left), "reach": self.reach(lens, gen, hm)}
        # Taunt, Encore and the like matter against League Pokémon with non-damaging moves
        M["status_users"] = sum(1 for foe in lens if any(rules.category(gen, mv) == "Status" for mv in foe["m"]))
        return M

    # --- the fourteen functions -------------------------------------------------------------------------
    def functions(self, read, ctx, gen, res, M):
        B = self.bars
        C = self.cfg
        N = M["N"]
        mtags = [t for r in res if r["kind"] == "move" for t in r["tags"]]
        has = lambda t: t in mtags
        lean = next((r["tags"] for r in res if r["kind"] == "spread"), []) or []
        roles = {r["role"]: r for r in read["roles"]}
        sh = lambda n: share(n, N)
        F = {}

        def put(fid, plausible, supported, why, numbers=None, extra=None):
            rec = {"id": fid, "name": C["functions"]["names"][fid], "plausible": bool(plausible), "supported": supported,
                   "observed": None, "why": why, "numbers": numbers or {}}
            if supported is None and plausible:
                rec["pending"] = C["functions"]["pending"].get(fid)
            if extra:
                rec.update(extra)
            F[fid] = rec

        # Setup Sweeper: after one use of its setup, it takes the League down: by Speed, by bulk or by priority
        b, pb = M["boosted"], M["priority_boosted"]
        paths = []
        if sh(M["first_boosted"]) >= B["sweep_first"] and sh(b["ko2"]) >= B["sweep_ko2"] and sh(b["ko1"]) >= B["sweep_ko1"]:
            paths.append("speed")
        if M["take3"] >= B["bulk_take3"] and sh(b["ko2"]) >= B["sweep_ko2"] and sh(b["ko1"]) >= B["sweep_ko1"]:
            paths.append("bulk")
        if sh(pb["ko2"]) >= B["sweep_ko2"] and sh(b["ko2"]) >= B["sweep_ko2"]:
            paths.append("priority")
        setup_ok = has("setup") and has("attack")
        put("setup_sweeper", setup_ok, bool(paths) if setup_ok else False,
            [f"after one use of {', '.join(M['setup_moves']) or 'a setup move'}: moves first against {M['first_boosted']} of {N} League Pokémon "
             f"(bar {pct(B['sweep_first'], 1)}%), 2HKOs {b['ko2']} and OHKOs {b['ko1']} with attacks it can repeat "
             f"(bars {pct(B['sweep_ko2'], 1)}% and {pct(B['sweep_ko1'], 1)}%)",
             f"or it lasts instead: takes three hits from {pct(M['take3'], 1)}% of the 100 hardest League attacks (bar {pct(B['bulk_take3'], 1)}%)",
             f"or its priority does it: {', '.join(M['priority_moves']) or 'no priority attack'} 2HKOs {pb['ko2']} of {N} after the setup"],
            {"first_boosted": M["first_boosted"], "ko2_boosted": b["ko2"], "ko1_boosted": b["ko1"], "take3": M["take3"],
             "priority_ko2_boosted": pb["ko2"], "of": N, "paths": paths})
        # Sweeper: no setup needed
        p = M["plain"]
        sw = sh(M["first"]) >= B["sweep_first"] and sh(p["ko2"]) >= B["sweep_ko2"] and sh(p["ko1"]) >= B["sweep_ko1"]
        put("sweeper", has("attack"), sw if has("attack") else False,
            [f"moves first against {M['first']} of {N} (bar {pct(B['sweep_first'], 1)}%), 2HKOs {p['ko2']} and OHKOs {p['ko1']} "
             f"with attacks it can repeat, no setup (bars {pct(B['sweep_ko2'], 1)}% and {pct(B['sweep_ko1'], 1)}%)"],
            {"first": M["first"], "ko2": p["ko2"], "ko1": p["ko1"], "of": N})
        put("wallbreaker", has("attack") and "offense" in lean, None,
            [f"its attacks 2HKO {p['ko2']} of {N} League Pokémon, but the League isn't a pool of walls"], {"ko2": p["ko2"], "of": N})
        put("cleaner", has("attack") and (has("priority") or sh(M["first"]) >= B["sweep_first"]), None,
            [f"moves first against {M['first']} of {N}; priority: {', '.join(M['priority_moves']) or 'none'}"], {"first": M["first"], "of": N})
        put("revenge_killer", has("attack") and (has("priority") or (ctx.get("item") in C["items"]["speed"]) or sh(M["first"]) >= B["sweep_first"]), None,
            [f"moves first against {M['first']} of {N}; priority: {', '.join(M['priority_moves']) or 'none'}"], {"first": M["first"], "of": N})
        t = roles["tank"]
        put("tank", has("attack"), bool(t["earned"]) if has("attack") else False, list(t["why"]), {"take3": M["take3"], "ko2": t["numbers"]["ko2"]})
        w = roles["wall"]
        sides = [s for s in ("physical", "special") if M["wall"][s] >= B["wall_take4"]] if M["sustain"] else []
        put("wall", bool(M["sustain"]) or "defense" in lean, bool(w["earned"]), list(w["why"]),
            {"physical": M["wall"]["physical"], "special": M["wall"]["special"], "sustain": M["sustain"]},
            {"sides": sides if w["earned"] else []})
        pv = roles["pivot"]
        by_move = has("pivot") and (M["take2"] >= B["lasts_take2"] or sh(M["first"]) >= B["pivot_first"])
        put("pivot", has("pivot") or ctx.get("ability") in self.switch_abilities, bool(pv["earned"]), list(pv["why"]),
            {"take2": M["take2"], "first": M["first"], "of": N}, {"path": "move" if by_move else ("ability" if pv["earned"] else None)})
        s = roles["support"]
        put("support", has("support"), bool(s["earned"]), list(s["why"]), {"moves": s["numbers"]["support_moves"]})
        put("disruptor", any(set(m["categories"]) & set(C["categories"]["disrupt"]) for m in ctx["moves"]), None,
            [f"{M['status_users']} of {N} League Pokémon carry a non-damaging move (what Taunt stops)"], {"status_users": M["status_users"], "of": N})
        # Field Controller: hazards, its own side's removal, screens, weather, Trick Room; it has to last to use them
        lasts = M["take2"] >= B["lasts_take2"] or sh(M["first"]) >= B["lasts_first"]
        methods = []
        if has("hazard"):
            methods.append("hazard")
        if has("removal"):
            methods.append("removal")
        if has("screens"):
            methods.append("screens")
        if M["weather"] and (M["weather"]["by"] == "move" or M["weather"]["rock"]):
            methods.append("weather")               # invested: its move or its rock (an ability it can't swap isn't a choice)
        if has("room"):
            methods.append("room")
        defog = gen == 4 and any(m["name"] == "Defog" for m in ctx["moves"])
        why = [f"field moves: {', '.join(methods) or 'none'}",
               f"it lasts to use them: takes two hits from {pct(M['take2'], 1)}% of the 100 hardest League attacks (bar {pct(B['lasts_take2'], 1)}%) "
               f"or moves first against {M['first']} of {N} (bar {pct(B['lasts_first'], 1)}%)"]
        if defog:
            why.append("Defog in Gen IV clears the target's side only, so it isn't hazard removal for this team")
        if M["weather"] and M["weather"]["by"] == "ability" and "weather" not in methods:
            why.append(f"{ctx.get('ability')} sets {M['weather']['name'].lower()} as it comes in (until another weather replaces it): a fact about it, not a move it spends")
        put("field_controller", bool(methods), bool(methods) and lasts, why, {"take2": M["take2"], "first": M["first"], "of": N},
            {"methods": methods if lasts else [], "candidate_methods": methods})
        put("trapper", has("trap") or ctx.get("ability") in C["trap_abilities"], None,
            ["Pursuit, binding and trapping moves need an opponent that switches; the League lens has none"])
        put("stallbreaker", any("taunt" in m["categories"] or "trick" in m["categories"] for m in ctx["moves"]), None, [])
        put("setup_enabler", has("screens") or has("status") or has("pivot") or has("hazard"), None, [])
        put("attacker", has("attack"), (sh(p["ko2"]) >= B["attack_ko2"]) if has("attack") else False,
            [f"its attacks 2HKO {p['ko2']} of {N} League Pokémon from full, no boosts (bar {pct(B['attack_ko2'], 1)}%, the Tank's)"],
            {"ko2": p["ko2"], "ko1": p["ko1"], "of": N})
        return F

    # --- the name ---------------------------------------------------------------------------------------------
    def head_test(self, hid, F, M):
        """(status, why): True earned, False measured short, None not measurable yet."""
        h = self.heads[hid]
        fid = h["function"]
        f = F[fid]
        if not f["plausible"]:
            return "absent", None
        if hid == "pivot":
            if f["supported"] and f.get("path") == "move":
                return True, None
            return (False if f["supported"] is not None else None), "a pivoting move that it lasts to use (two hits from most hard attacks, or moving first)"
        if h.get("method") or hid == "field_controller":
            cand = F["field_controller"]["candidate_methods"]
            got = F["field_controller"]["methods"]
            if hid == "field_controller":
                if len(cand) < h["needs_methods"]:
                    return "absent", None
                return (len(got) >= h["needs_methods"]), "it has to last to use its field moves"
            if h["method"] not in cand:
                return "absent", None
            return (h["method"] in got), "it has to last to use its field move"
        if hid == "cleric" and "cleric" not in M["_tags"]:
            return "absent", None
        return f["supported"], (f.get("pending") or "; ".join(f["why"]))

    def nearness(self, kind, eid, hid, F, M, sustain):
        """How close a failing element came: the smallest value/bar over the bars it needs (1 = met). None for a
        pending one. Only orders the near misses; it decides nothing."""
        B = self.bars
        N = M["N"]
        q = lambda v, bar: min(1.0, share(v, N) / bar) if bar else 1.0
        r = lambda v, bar: min(1.0, v / bar) if bar else 1.0
        lasts = max(r(M["take2"], B["lasts_take2"]), q(M["first"], B["lasts_first"]))
        if kind == "head":
            f = F[self.heads[eid]["function"]]
            if f["supported"] is None:
                return None
            if eid == "setup_sweeper":
                b, pb = M["boosted"], M["priority_boosted"]
                return max(min(q(M["first_boosted"], B["sweep_first"]), q(b["ko2"], B["sweep_ko2"]), q(b["ko1"], B["sweep_ko1"])),
                           min(r(M["take3"], B["bulk_take3"]), q(b["ko2"], B["sweep_ko2"]), q(b["ko1"], B["sweep_ko1"])),
                           min(q(pb["ko2"], B["sweep_ko2"]), q(b["ko2"], B["sweep_ko2"])))
            if eid == "sweeper":
                return min(q(M["first"], B["sweep_first"]), q(M["plain"]["ko2"], B["sweep_ko2"]), q(M["plain"]["ko1"], B["sweep_ko1"]))
            if eid == "attacker":
                return q(M["plain"]["ko2"], B["attack_ko2"])
            if eid == "tank":
                return min(r(M["take3"], B["bulk_take3"]), q(M["plain"]["ko2"], B["attack_ko2"]))
            if eid == "wall":
                best = max(r(M["wall"]["physical"], B["wall_take4"]), r(M["wall"]["special"], B["wall_take4"]))
                return best if sustain else 0.0
            if eid in ("support", "cleric"):
                return min(1.0, len(F["support"]["numbers"].get("moves") or []) / self.rc["roles"]["support"]["moves_at_least"]) * lasts
            if eid == "pivot":
                return max(r(M["take2"], B["lasts_take2"]), q(M["first"], B["pivot_first"])) if "pivot" in M["_tags"] else 0.0
            return lasts
        if eid in ("window", "trapping"):
            return None
        if eid in ("rain", "sun"):
            w = M["weather"]
            if hid == "setup_sweeper":
                return min(q(w["first_boosted"], B["sweep_first"]), q(w["boosted"]["ko2"], B["sweep_ko2"]), q(w["boosted"]["ko1"], B["sweep_ko1"]))
            if hid == "sweeper":
                return min(q(w["first"], B["sweep_first"]), q(w["plain"]["ko2"], B["sweep_ko2"]), q(w["plain"]["ko1"], B["sweep_ko1"]))
            return q(w["plain"]["ko2"], B["attack_ko2"])
        if eid == "room":
            return min(lasts, q(M["room_first"], B["sweep_first"]))
        if eid == "fast":
            return q(M["first"], B["sweep_first"])
        if eid == "offensive":
            return q(M["plain"]["ko2"], B["attack_ko2"])
        if eid == "bulky":
            return r(M["take3"], B["bulk_take3"])
        if eid in ("specially_defensive", "physically_defensive"):
            v = r(M["wall"][self.mods[eid]["side"]], B["wall_take4"])
            return v if sustain else 0.99 * v
        if eid == "priority":
            return q(M["priority_boosted"]["ko2"], B["sweep_ko2"]) if hid == "setup_sweeper" else q(M["priority"]["ko2"], B["attack_ko2"])
        if eid == "hazard_setting":
            return lasts
        if eid == "sacrificial":
            return q(M["self_ko"]["ko1"], B["attack_ko2"])
        return 0.0

    def mod_test(self, mid, hid, F, M, ctx, lean, sustain):
        """(status, why, plausible). Status True/False/None as head_test; plausible False keeps it out entirely."""
        B = self.bars
        N = M["N"]
        sh = lambda n: share(n, N)
        if mid in ("rain", "sun"):
            w = M["weather"]
            if not w or w["kind"] != mid or not w["benefits"]:
                return False, None, False
            if hid == "setup_sweeper":
                ok = sh(w["first_boosted"]) >= B["sweep_first"] and sh(w["boosted"]["ko2"]) >= B["sweep_ko2"] and sh(w["boosted"]["ko1"]) >= B["sweep_ko1"]
            elif hid == "sweeper":
                ok = sh(w["first"]) >= B["sweep_first"] and sh(w["plain"]["ko2"]) >= B["sweep_ko2"] and sh(w["plain"]["ko1"]) >= B["sweep_ko1"]
            else:
                ok = sh(w["plain"]["ko2"]) >= B["attack_ko2"]
            return ok, f"in its {w['name'].lower()}: first against {w['first']} of {N}, 2HKOs {w['plain']['ko2']}", True
        if mid == "room":
            if "room" not in F["field_controller"]["candidate_methods"]:
                return False, None, False
            ok = "room" in F["field_controller"]["methods"] and sh(M["room_first"]) >= B["sweep_first"]
            return ok, f"under Trick Room it moves first against {M['room_first']} of {N} (bar {pct(B['sweep_first'], 1)}%)", True
        if mid == "fast":
            plaus = "speed" in lean or ctx.get("item") in self.cfg["items"]["speed"]
            return sh(M["first"]) >= B["sweep_first"], f"moves first against {M['first']} of {N} (bar {pct(B['sweep_first'], 1)}%)", plaus
        if mid == "offensive":
            return sh(M["plain"]["ko2"]) >= B["attack_ko2"], f"2HKOs {M['plain']['ko2']} of {N} (bar {pct(B['attack_ko2'], 1)}%)", "offense" in lean
        if mid == "defensive":
            ok = sh(M["plain"]["ko2"]) < B["attack_ko2"] and "defense" in lean and bool(sustain)
            return ok, "built to take hits (defensive spread, a way to heal) rather than to KO", "defense" in lean
        if mid == "bulky":
            return M["take3"] >= B["bulk_take3"], f"takes three hits from {pct(M['take3'], 1)}% of the 100 hardest League attacks (bar {pct(B['bulk_take3'], 1)}%)", \
                "defense" in lean or bool(sustain)
        if mid in ("specially_defensive", "physically_defensive"):
            sd = self.mods[mid]["side"]
            v = M["wall"][sd]
            why = (f"takes four hits from {pct(v, 1)}% of the 50 hardest {sd} attacks (bar {pct(B['wall_take4'], 1)}%)" if v < B["wall_take4"] else
                   f"takes four hits from {pct(v, 1)}% of the 50 hardest {sd} attacks, but has no way to heal (recovery, Rest, Wish or Leftovers)")
            return v >= B["wall_take4"] and bool(sustain), why, "defense" in lean or bool(sustain)
        if mid == "priority":
            if not M["priority_moves"]:
                return False, None, False
            if hid == "setup_sweeper":
                n = M["priority_boosted"]["ko2"]
                return sh(n) >= B["sweep_ko2"], f"{', '.join(M['priority_moves'])} 2HKOs {n} of {N} after its setup (bar {pct(B['sweep_ko2'], 1)}%)", True
            n = M["priority"]["ko2"]
            return sh(n) >= B["attack_ko2"], f"{', '.join(M['priority_moves'])} 2HKOs {n} of {N} from full (bar {pct(B['attack_ko2'], 1)}%)", True
        if mid == "trapping":
            f = F["trapper"]
            return f["supported"], f.get("pending"), f["plausible"]
        if mid == "hazard_setting":
            if "hazard" not in F["field_controller"]["candidate_methods"]:
                return False, None, False
            return "hazard" in F["field_controller"]["methods"], "it has to last to set its hazard", True
        if mid == "sacrificial":
            if not any(m for m in M["_selfko"]):
                return False, None, False
            n = M["self_ko"]["ko1"]
            return sh(n) >= B["attack_ko2"], f"{', '.join(M['_selfko'])} OHKOs {n} of {N} from full, once (bar {pct(B['attack_ko2'], 1)}%)", True
        if mid in ("choice_band", "choice_specs", "choice_scarf"):
            it = self.mods[mid]["item"]
            return ctx.get("item") == it, None, ctx.get("item") == it
        if mid == "window":
            w = M["window"]
            if not w:
                return False, None, False
            return None, (f"the {w['ability']} window (a third of its HP or less) isn't a measured scenario yet: in it, it would move first against "
                          f"{w['first']} and 2HKO {w['reach']['ko2']} of {N}; its Substitute holds against {w['sub_safe']} of {N}"), True
        if mid in ("physical", "special"):
            return M["side"] == mid, None, M["side"] == mid
        return False, None, False

    def phrase(self, hid, mids, M, ctx, F):
        h = self.heads[hid]
        head = h["phrase"]
        if "{side}" in head:
            sides = F["wall"].get("sides") or []
            head = head.replace("{side}", "Mixed" if len(sides) == 2 else (sides[0].capitalize() if sides else ""))
        if "{weather}" in head:
            head = head.replace("{weather}", M["weather"]["name"] if M["weather"] else "Weather")
        order = self.cfg["word_order"]
        ms = sorted(mids, key=lambda m: (order.index(self.mods[m]["group"]), self.mod_order.index(m)))
        words = []
        for m in ms:
            ph = self.mods[m]["phrase"]
            if "{ability}" in ph:
                ph = ph.replace("{ability}", (M["window"] or {}).get("ability") or "")
            words.append(ph)
        meth = [i for i, m in enumerate(ms) if self.mods[m]["group"] == "method"]
        if len(meth) == 2 and all(" " not in words[i] and "-" not in words[i] for i in meth) and meth[1] == meth[0] + 1:
            words[meth[0]] = words[meth[0]] + "-" + words[meth[1]]
            del words[meth[1]]
        return " ".join(words + [head]).strip()

    def accounted(self, hid, mids, res):
        sels = list(self.heads[hid]["accounts"]) + [s for m in mids for s in self.mods[m]["accounts"]]
        return [r["id"] for r in res if any(self.selects(s, r) for s in sels)]

    def combos(self, hid):
        """Every modifier set (up to max_modifiers) allowed on this head, one per group (method: up to two)."""
        allowed = [m for m in self.mod_order if hid in self.mods[m]["heads"]]
        out = [[]]
        cap = self.cfg["max_modifiers"]
        per = self.cfg["max_per_group"]
        for i, a in enumerate(allowed):
            out.append([a])
            if cap >= 2:
                for b in allowed[i + 1:]:
                    ga, gb = self.mods[a]["group"], self.mods[b]["group"]
                    if ga == gb and per.get(ga, 1) < 2:
                        continue
                    if {a, b} == {"fast", "room"}:
                        continue
                    out.append([a, b])
        return out

    def candidates(self, F, M, ctx, res, lean, sustain):
        conds = self.conditions_present(M)
        out = []
        for hid in self.head_order:
            hs, hwhy = self.head_test(hid, F, M)
            if hs == "absent":
                continue
            for mids in self.combos(hid):
                tests = [(m,) + self.mod_test(m, hid, F, M, ctx, lean, sustain) for m in mids]
                if any(not t[3] for t in tests):
                    continue                           # a modifier whose mechanics aren't on the set: not a candidate at all
                elems = [("head", hid, hs, hwhy)] + [("mod", t[0], t[1], t[2]) for t in tests]
                name = self.phrase(hid, mids, M, ctx, F)
                acc = self.accounted(hid, mids, res)
                gate = self.gate(hid, mids, res, name)
                if gate:
                    continue                           # a hard gate: not a name at all (see identity.json → gates)
                spec = [self.mods[m]["specificity"] for m in mids]
                rank = {"coverage": len(acc), "head_specificity": self.heads[hid]["specificity"],
                        "modifier_specificity": max(spec) if spec else -1, "specific_modifiers": sum(1 for x in spec if x >= 1),
                        "adequacy": sum(1 for c in conds if c in mids), "words": len(name.split()),
                        "order": [self.head_order.index(hid)] + [self.mod_order.index(m) for m in mids]}
                out.append({"name": name, "head": hid, "modifiers": list(mids), "elements": elems, "accounts": acc, "rank": rank})
        return out

    def gate(self, hid, mids, res, name):
        """The reason a name fails a hard gate, or None (identity.json → gates)."""
        G = self.cfg["gates"]
        if G["head_accounts"] and not self.accounted(hid, [], res):
            return "the head accounts for none of its commitments"
        if G["modifier_adds"]:
            for m in mids:
                if self.mods[m]["group"] in G["exempt_groups"]:
                    continue
                rest = self.accounted(hid, [x for x in mids if x != m], res)
                if not [r for r in self.accounted(hid, mids, res) if r not in rest]:
                    return f"{self.mods[m]['phrase']} adds nothing the rest of the name doesn't say"
        if len(name.split()) > self.cfg["max_words"]:
            return "too long"
        return None

    @staticmethod
    def rank_key(c):
        r = c["rank"]
        return (-r["coverage"], -r["head_specificity"], -r["modifier_specificity"], -r["specific_modifiers"], -r["adequacy"],
                r["words"], r["order"], c["name"])

    @staticmethod
    def conditions_present(M):
        out = []
        if M["weather"] and M["weather"]["benefits"]:
            out.append(M["weather"]["kind"])
        if M.get("_room"):
            out.append("room")
        if M["window"]:
            out.append("window")
        return out

    # --- what to say -------------------------------------------------------------------------------------
    def finding(self, claim, mechanism, evidence=None, conditions=None, status="pass", caveat=None):
        return {"lens": self.cfg["lens"]["id"], "claim": claim, "mechanism": mechanism, "conditions": conditions or [],
                "evidence": evidence or {}, "status": status, "caveat": caveat}

    def takeaways(self, best, F, M, ctx, res):
        N = M["N"]
        out = []
        hid = best["head"]
        f = F[self.heads[hid]["function"]]
        n = f["numbers"]
        if hid == "setup_sweeper":
            path = (n.get("paths") or ["speed"])[0]
            lead = {"speed": f"it moves first against {n['first_boosted']} of {N}",
                    "bulk": f"it takes three hits from {pct(M['take3'], 1)}% of the hardest League attacks while it sets up",
                    "priority": f"its priority 2HKOs {n['priority_ko2_boosted']} of {N}"}[path]
            out.append(self.finding(f"After one {', '.join(M['setup_moves'])}, {lead} and its attacks 2HKO {n['ko2_boosted']} of {N} League Pokémon.",
                                    "one use of its setup, applied as the stat stage's multiplier on the dry roll (the Sweeper's estimate)",
                                    {"measure": "ko2_boosted", "n": n["ko2_boosted"], "of": N}, ["after one setup turn"]))
        elif hid in ("sweeper", "attacker"):
            out.append(self.finding(f"Its attacks 2HKO {M['plain']['ko2']} and OHKO {M['plain']['ko1']} of {N} League Pokémon from full, no boosts"
                                    + (f", and it moves first against {M['first']}." if hid == "sweeper" else "."),
                                    "the calculator's lowest roll, every attack it can use more than once",
                                    {"measure": "ko2", "n": M["plain"]["ko2"], "of": N}))
        elif hid == "tank":
            out.append(self.finding(f"Takes three hits from {pct(M['take3'], 1)}% of the 100 hardest League attacks and 2HKOs {M['plain']['ko2']} of {N} back.",
                                    "the top roll of each attack against it, its lowest roll against them",
                                    {"measure": "take3", "share": M["take3"]}))
        elif hid == "wall":
            sides = F["wall"].get("sides") or []
            out.append(self.finding(f"Takes four hits from {', '.join(str(pct(M['wall'][s], 1)) + '% of the 50 hardest ' + s for s in sides)} attacks, "
                                    f"and heals with {', '.join(M['sustain'])}.", "the top roll of each attack against it",
                                    {"measure": "take4", "sides": {s: M["wall"][s] for s in sides}},
                                    caveat=None if len(sides) == 2 else f"only the {sides[0] if sides else ''} side: the other side's hardest attacks break through"))
        elif hid == "pivot":
            piv = [r["label"] for r in res if r["kind"] == "move" and "pivot" in r["tags"]]
            out.append(self.finding(f"{', '.join(piv)} hands off to a teammate, and it lasts to use it: two hits from {pct(M['take2'], 1)}% of the 100 hardest League attacks.",
                                    "a pivoting move, and the survival the Pivot role reads", {"measure": "take2", "share": M["take2"]}))
        else:
            got = F["field_controller"]["methods"] if self.heads[hid]["function"] == "field_controller" else []
            moves = [r["label"] for r in res if r["kind"] == "move" and "support" in r["tags"]]
            out.append(self.finding(f"{', '.join(moves)}: and it lasts to use them (two hits from {pct(M['take2'], 1)}% of the 100 hardest League attacks, "
                                    f"first against {M['first']} of {N}).", "its support moves, and the survival the Support role reads",
                                    {"measure": "take2", "share": M["take2"], "methods": got}))
        for m in best["modifiers"]:
            if len(out) >= self.cfg["show"]["takeaways"]:
                break
            if m == "priority":
                boosted = hid == "setup_sweeper"
                k = M["priority_boosted"]["ko2"] if boosted else M["priority"]["ko2"]
                out.append(self.finding(f"{', '.join(M['priority_moves'])} 2HKOs {k} of {N} League Pokémon {'after its setup' if boosted else 'from full'}, "
                                        "and goes first whatever the Speed.", "+1 priority: it acts before any normal move",
                                        {"measure": "priority_ko2", "n": k, "of": N}, ["against foes without priority of their own"]))
            elif m == "room":
                out.append(self.finding(f"Under its own Trick Room it moves first against {M['room_first']} of {N} League Pokémon.",
                                        self.cfg["room"]["_note"], {"measure": "room_first", "n": M["room_first"], "of": N},
                                        [f"after Trick Room goes up: {self.cfg['room']['turns']} turns counting that one"], "conditional"))
            elif m in ("rain", "sun"):
                w = M["weather"]
                out.append(self.finding(f"In its own {w['name'].lower()} it moves first against {w['first']} and 2HKOs {w['plain']['ko2']} of {N} "
                                        f"(dry: first against {M['first']}, 2HKOs {M['plain']['ko2']}).",
                                        ("Swift Swim doubles its Speed; " if w["speed_ability"] else "") + (f"{', '.join(w['boosted_moves'])} hit 1.5x (an estimate on the dry roll)" if w["boosted_moves"] else ""),
                                        {"measure": "weather_reach", "n": w["plain"]["ko2"], "of": N},
                                        [f"after {('Rain Dance' if w['kind'] == 'rain' else 'Sunny Day') if w['by'] == 'move' else 'it comes in'}"
                                         + (f": {w['turns']} turns counting that one" if w["turns"] else "")], "conditional"))
            elif m == "fast":
                out.append(self.finding(f"Moves first against {M['first']} of {N} League Pokémon, no boosts.", "its Speed with items against theirs; a tie isn't first",
                                        {"measure": "first", "n": M["first"], "of": N}))
            elif m == "sacrificial":
                out.append(self.finding(f"{', '.join(M['_selfko'])} OHKOs {M['self_ko']['ko1']} of {N} League Pokémon from full: one use, and it faints.",
                                        "a self-KO move at its lowest roll", {"measure": "self_ko_ohko", "n": M["self_ko"]["ko1"], "of": N}))
            elif m == "bulky":
                out.append(self.finding(f"Takes three hits from {pct(M['take3'], 1)}% of the 100 hardest League attacks.", "the top roll of each attack against it",
                                        {"measure": "take3", "share": M["take3"]}))
            elif m in ("specially_defensive", "physically_defensive"):
                sd = self.mods[m]["side"]
                out.append(self.finding(f"Takes four hits from {pct(M['wall'][sd], 1)}% of the 50 hardest {sd} League attacks, and heals with {', '.join(M['sustain'])}.",
                                        "the top roll of each attack against it", {"measure": "take4", "side": sd, "share": M["wall"][sd]},
                                        caveat=f"the other side ({'physical' if sd == 'special' else 'special'}): {pct(M['wall']['physical' if sd == 'special' else 'special'], 1)}%"))
        return out

    def limitation(self, F, M, ctx, best):
        N = M["N"]
        item = ctx.get("item") or ""
        if M["hp_power"]:
            h = M["hp_power"]
            return self.finding(f"{', '.join(h['moves'])} loses power with its HP: from full its attacks 2HKO {M['plain']['ko2']} of {N}; after Stealth Rock "
                                f"({pct(M['stealth_rock'], 1)}% of its HP) about {h['reach']['ko2']}.", self.cfg["hp_power"]["_note"],
                                {"measure": "hp_power_reach", "n": h["reach"]["ko2"], "of": N}, ["after Stealth Rock on entry"], "conditional",
                                "an estimate: the power ratio on the full-HP roll")
        if item in self.cfg["items"]["choice"]:
            return self.finding(f"{item} locks it into the first move it picks until it switches out.", "Choice items (Gen IV)", status="conditional",
                                caveat="a Pokémon that resists that move walls it until it switches")
        if M["weather"] and M["weather"]["benefits"] and M["weather"]["by"] == "move":
            w = M["weather"]
            return self.finding(f"Its {w['name'].lower()} lasts {w['turns']} turns counting the one it goes up on, and costs that turn.",
                                self.cfg["weather"]["_note"], status="conditional",
                                caveat=f"out of it: first against {M['first']}, 2HKOs {M['plain']['ko2']} of {N}")
        if "room" in F["field_controller"]["candidate_methods"]:
            return self.finding("Trick Room lasts five turns counting the one it goes up on: four turns of reversed order, then its own low Speed again.",
                                self.cfg["room"]["_note"], status="conditional",
                                caveat=f"outside Trick Room it moves first against {M['first']} of {N}")
        if M["window"]:
            w = M["window"]
            return self.finding(f"The {w['ability']} window needs it at a third of its HP or less; its Substitute holds against {w['sub_safe']} of {N} League Pokémon.",
                                self.cfg["pinch"]["_note"], status="unknown", caveat="the window isn't a measured scenario yet")
        if item == "Life Orb":
            return self.finding("Life Orb costs a tenth of its HP every attack.", "Life Orb (Gen IV)", status="pass")
        if item == "Focus Sash":
            return self.finding("Focus Sash only saves it from full HP: Stealth Rock, weather or a multi-hit move breaks it.", "Focus Sash (Gen IV)", status="pass")
        if F["trapper"]["plausible"]:
            return self.finding("Its trapping isn't measured: the League lens fights one-on-one, with nothing that switches out.", F["trapper"]["pending"], status="unknown")
        return self.finding("Measured one-on-one against the League from full HP; team play (6v6) isn't measured yet.", self.cfg["functions"]["observed"], status="unknown")

    # --- evaluate ---------------------------------------------------------------------------------------
    def unknown(self, build_id, species, game, why):
        return {"version": self.cfg["version"], "grammar": self.cfg["grammar"], "lens": {"id": self.cfg["lens"]["id"]},
                "build": build_id, "species": species, "game": game, "evaluated": False, "why": why,
                "headline": None, "alternates": [], "near_misses": [], "functions": [], "takeaways": [], "limitation": None}

    def evaluate(self, build_id, species, game, read, ctx, speed=None):
        if not read or read.get("error") or not read.get("lens"):
            return self.unknown(build_id, species, game, (read or {}).get("error") or "no League fights in this read yet")
        gen = rules.GAME_GEN[game]
        res = self.resources(ctx, gen)
        M = self.measures(read, ctx, gen, res)
        M["_selfko"] = [r["label"] for r in res if r["kind"] == "move" and "self_ko" in r["tags"]]
        M["_tags"] = [t for r in res if r["kind"] == "move" for t in r["tags"]]
        M["_room"] = "room" in M["_tags"]
        F = self.functions(read, ctx, gen, res, M)
        lean = next((r["tags"] for r in res if r["kind"] == "spread"), []) or []
        sustain = M["sustain"]
        cands = self.candidates(F, M, ctx, res, lean, sustain)
        eligible = sorted([c for c in cands if all(e[2] is True for e in c["elements"])], key=self.rank_key)
        near = [c for c in cands if sum(1 for e in c["elements"] if e[2] is not True) == 1]
        best = eligible[0] if eligible else None
        names = {c["name"] for c in eligible}
        lab = {r["id"]: r["label"] for r in res}

        def short(c):
            miss = [lab[r["id"]] for r in res if r["id"] not in c["accounts"]]
            return {"name": c["name"], "head": c["head"], "modifiers": c["modifiers"],
                    "accounts": {"named": len(c["accounts"]), "of": len(res), "unaccounted": miss}, "rank": c["rank"]}

        def miss_of(c):
            e = next(e for e in c["elements"] if e[2] is not True)
            kind = "pending" if e[2] is None else "short"
            what = self.heads[e[1]]["phrase"] if e[0] == "head" else self.mods[e[1]]["phrase"]
            return {**short(c), "missing": {"element": e[1], "kind": kind, "what": what.replace("{side} ", "").replace("{weather} ", "").replace("{ability}-", ""), "why": e[3],
                                            "near": None if c["near"] is None else r4(c["near"])}}

        near = [c for c in near if c["name"] not in names]
        for c in near:
            e = next(e for e in c["elements"] if e[2] is not True)
            c["near"] = self.nearness(e[0], e[1], c["head"], F, M, sustain)
        near.sort(key=lambda c: (0 if c["near"] is None else 1, -(c["near"] or 0), -c["rank"]["coverage"]) + tuple(self.rank_key(c)[1:]))
        seen, near_out, pending_out = set(), [], []
        for c in near:
            e = next(e for e in c["elements"] if e[2] is not True)
            if e[1] in seen or (best and e[0] == "mod" and e[1] in ("physical", "special", "offensive", "defensive")):
                continue
            seen.add(e[1])
            if c["near"] is None:                    # can't be measured yet: its own list, not a near miss
                if len(pending_out) < self.cfg["show"]["pending"]:
                    pending_out.append(miss_of(c))
            elif len(near_out) < self.cfg["show"]["near_misses"]:
                near_out.append(miss_of(c))
        if best:
            headline = short(best)
            headline["functional"] = self.phrase(best["head"], [], M, ctx, F)
            label = lambda e: headline["functional"] if e[0] == "head" else self.mods[e[1]]["phrase"].replace("{ability}", (M["window"] or {}).get("ability") or "")
            headline["why"] = [label(e) + ": " + e[3] for e in best["elements"] if e[3]]
        else:
            lean_word = self.cfg["fallback"]["lean"]["offense" if "offense" in lean else ("defense" if "defense" in lean else ("speed" if "speed" in lean else "none"))]
            headline = {"name": self.cfg["fallback"]["phrase"].replace("{lean}", lean_word), "head": None, "modifiers": [], "fallback": True,
                        "functional": None, "why": [self.cfg["fallback"]["says"]], "accounts": {"named": 0, "of": len(res), "unaccounted": [lab[r["id"]] for r in res]}}
        conditions = []
        if M["weather"] and M["weather"]["benefits"]:
            w = M["weather"]
            conditions.append(f"{w['name']}: " + (f"after {('Rain Dance' if w['kind'] == 'rain' else 'Sunny Day')}, {w['turns']} turns counting that one"
                                                 if w["by"] == "move" else "from its ability, until another weather replaces it"))
        if M["_room"]:
            conditions.append(f"Trick Room: {self.cfg['room']['turns']} turns counting the one it goes up on; priority still goes first")
        if M["hp_power"]:
            conditions.append(f"{', '.join(M['hp_power']['moves'])}: power falls with its HP")
        if M["window"]:
            conditions.append(f"{M['window']['ability']}: its {M['window']['type']} moves hit 1.5x at a third of its HP or less")
        out = {"version": self.cfg["version"], "grammar": self.cfg["grammar"],
               "lens": {"id": self.cfg["lens"]["id"], "name": self.cfg["lens"]["name"], "foes": M["N"], "gen": gen},
               "build": build_id, "species": species, "game": game, "evaluated": True,
               "headline": headline, "alternates": [short(c) for c in eligible[1:1 + self.cfg["show"]["alternates"]]],
               "near_misses": near_out, "pending": pending_out, "eligible": len(eligible),
               "functions": [F[k] for k in self.cfg["functions"]["order"]],
               "takeaways": self.takeaways(best, F, M, ctx, res) if best else [],
               "limitation": self.limitation(F, M, ctx, best),
               "conditions": conditions, "filled_moves": list(read.get("filled_moves") or []),
               "resources": [{"id": r["id"], "label": r["label"], "tags": r["tags"]} for r in res],
               "facts": {"first": M["first"], "first_boosted": M["first_boosted"], "room_first": M["room_first"], "of": M["N"],
                         "plain": M["plain"], "boosted": M["boosted"], "priority": M["priority"], "priority_boosted": M["priority_boosted"],
                         "self_ko": M["self_ko"], "take2": M["take2"], "take3": M["take3"], "wall": M["wall"], "sustain": M["sustain"],
                         "side": M["side"], "weather": M["weather"], "window": M["window"], "hp_power": M["hp_power"],
                         "stealth_rock": M["stealth_rock"], "status_users": M["status_users"], "sub_safe": M["sub_safe"],
                         "speed": speed},
               "missing": [f"{F[k]['name']}: {F[k]['pending']}" for k in self.cfg["functions"]["order"] if F[k].get("pending")]}
        return out


# --- the pilot ----------------------------------------------------------------------------------------------
def pilot_builds():
    from trainers.model import Build
    with open(os.path.join(HERE, "identity_pilot.json"), encoding="utf-8") as fh:
        P = json.load(fh)["builds"]
    out = []
    for p in P:
        out.append((Build(id="pilot:" + p["case"], species=p["species"], generation=4, moves=p["moves"], item=p["item"],
                          ability=p["ability"], nature=p["nature"], evs=p["evs"], ivs=p.get("ivs"), level=100), p["game"], p))
    return out


def evaluate_many(builds, store=None, tr=None):
    """[(Build, game)] -> {id: (read, decision)}: the League reads (one batch) and their identities."""
    from trainers.model import Build, Store
    from trainers.recognition import Recognition
    from trainers.team_roles import TeamRoles
    store = store or Store()
    tr = tr or TeamRoles(store)
    ident = Identity(roles_cfg=tr.cfg)
    rec = Recognition(store)
    reads = tr.read_many([(b, g) for b, g in builds])
    out = {}
    for b, g in builds:
        r = reads[b.id]
        if "error" in r:
            out[b.id] = (r, ident.unknown(b.id, b.species, g, r["error"]))
            continue
        filled = Build(**{**b.__dict__, "moves": list(r["moves"]), "level": tr.cfg["level"]})
        ctx = tr.book.context(filled, g, tr.cfg["level"])
        sp = rec.read(b, r)["speed"]
        out[b.id] = (r, ident.evaluate(b.id, b.species, g, r, ctx, sp))
    return out


def compact(d):
    """One decision as the identity pack keeps it (app/data/identity4.json): enough for the Archetype Atlas to list,
    filter and explain names across the library; the builder works the full decision out live."""
    if not d.get("evaluated"):
        return {"sp": d["species"], "g": d["game"], "x": d.get("why")}
    h = d["headline"]
    return {"sp": d["species"], "g": d["game"], "h": h["name"], "f": h.get("functional"), "hd": h.get("head"), "m": h.get("modifiers") or [],
            "a": [h["accounts"]["named"], h["accounts"]["of"]], "alt": [a["name"] for a in d["alternates"]],
            "nm": [[n["name"], n["missing"]["element"], n["missing"]["near"]] for n in d["near_misses"]],
            "pd": [[n["name"], n["missing"]["element"]] for n in d["pending"]],
            "fn": [f["id"] for f in d["functions"] if f["supported"] is True], "lim": (d["limitation"] or {}).get("claim")}


def identity_pack(tr, builds, reads, store=None):
    """identity4.json for the app: every library build's identity, from the reads the role pack just fought (their lens
    rows are still in memory). Written by team_roles.py --pack, next to roles4.json."""
    from collections import Counter
    from trainers.model import Build, Store
    from trainers.recognition import Recognition
    store = store or tr.store or Store()
    ident = Identity(roles_cfg=tr.cfg)
    rec = Recognition(store)
    out = {}
    for b, g in builds:
        r = reads.get(b.id)
        if r is None:
            continue
        game = r.get("game") or g
        if "error" in r:
            out[b.id] = compact(ident.unknown(b.id, b.species, game, r["error"]))
            continue
        filled = Build(**{**b.__dict__, "moves": list(r["moves"]), "level": tr.cfg["level"]})
        ctx = tr.book.context(filled, game, tr.cfg["level"])
        out[b.id] = compact(ident.evaluate(b.id, b.species, game, r, ctx, rec.read(b, r)["speed"]))
    census = Counter(d["h"] for d in out.values() if d.get("h"))
    pack = {"version": ident.cfg["version"], "grammar": ident.cfg["grammar"], "lens": ident.cfg["lens"]["id"],
            "built": __import__("time").strftime("%Y-%m-%d"), "census": dict(sorted(census.items(), key=lambda x: (-x[1], x[0]))),
            "decisions": out}
    with open(os.path.join(ENGINE, "app", "data", "identity4.json"), "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    return pack


def parity(out_path, ids=None):
    """Python's side of app/test_identity_parity.mjs: the pilot sets and the named library builds, with their full
    decisions (the browser fights them again and must say exactly the same)."""
    from trainers.model import Store
    from trainers.team_roles import GAME_OF_GEN, all_builds
    store = Store()
    builds = [(b, g) for b, g, _ in pilot_builds()]
    if ids:
        want = set(ids)
        builds += [(b, g or GAME_OF_GEN[b.generation or 4]) for b, g in all_builds(store) if b.id in want]
    res = evaluate_many(builds, store)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({"builds": [{"build": b.to_dict(), "game": g} for b, g in builds], "decisions": {k: v[1] for k, v in res.items()}}, fh, ensure_ascii=False)


def write_docs():
    """docs/battle/PILOT.md (the pilot sets, named, beside the V3 literature hypothesis) and docs/battle/CENSUS.md (every
    name the library earns, from app/data/identity4.json)."""
    from collections import Counter
    root = os.path.dirname(ENGINE)
    os.makedirs(os.path.join(root, "docs", "battle"), exist_ok=True)
    P = pilot_builds()
    res = evaluate_many([(b, g) for b, g, _ in P])
    L = ["# The battle-identity pilot", "",
         "Generated by `python3 -I engine/trainers/identity.py --docs` from `engine/trainers/identity_pilot.json`: exact legal sets for the V3 contrast cases, "
         "fought against the League and named by `trainers/identity.py`. The V3 column is the literature's hypothesis, kept only to compare against: the engine never reads it. "
         "'Explains' is how many of the set's choices (four moves, item, spread) the name accounts for.", "",
         "| Case | Set | Name | Explains | Also earned | Nearly (how close) | V3 hypothesis |", "|---|---|---|---|---|---|---|"]
    for b, g, p in P:
        d = res[b.id][1]
        h = d["headline"]
        near = "; ".join(f"{n['name']} ({round(100 * n['missing']['near'])}%)" for n in d["near_misses"][:2])
        pend = "; ".join(f"{n['name']} (pending)" for n in d["pending"][:1])
        L.append(f"| {p['case']} | {b.species} ({g}): {', '.join(b.moves)} @ {b.item}, {b.nature} | **{h['name']}** | {h['accounts']['named']}/{h['accounts']['of']} | "
                 f"{', '.join(a['name'] for a in d['alternates']) or '—'} | {'; '.join(x for x in (near, pend) if x) or '—'} | {p['v3_candidate']} |")
    L += ["", "## The catch on each", ""]
    for b, g, p in P:
        d = res[b.id][1]
        L.append(f"- **{p['case']} {d['headline']['name']}** ({b.species}): {d['limitation']['claim']}")
    with open(os.path.join(root, "docs", "battle", "PILOT.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    path = os.path.join(ENGINE, "app", "data", "identity4.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            pack = json.load(fh)
        D = pack["decisions"]
        heads = Counter((d.get("hd") or "fallback") for d in D.values() if d.get("h"))
        L = ["# Every name the library earns", "",
             f"Generated by `python3 -I engine/trainers/identity.py --docs` from `engine/app/data/identity4.json` ({pack['version']}, built {pack['built']}): "
             f"{len(D)} builds, {len(pack['census'])} distinct names. The Archetype Atlas (`#/archetypes`) shows the same, with the builds.", "",
             "## By job", "", "| Job | Builds |", "|---|---|"]
        L += [f"| {k} | {v} |" for k, v in sorted(heads.items(), key=lambda x: (-x[1], x[0]))]
        L += ["", "## Every name", "", "| Name | Builds |", "|---|---|"]
        L += [f"| {k} | {v} |" for k, v in pack["census"].items()]
        with open(os.path.join(root, "docs", "battle", "CENSUS.md"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(L) + "\n")


def main(argv):
    if argv and argv[0] == "--docs":
        write_docs()
        return
    if argv and argv[0] == "--parity":
        parity(argv[1], argv[2].split(",") if len(argv) > 2 and argv[2] else None)
        return
    if argv and argv[0] == "--pilot":
        P = pilot_builds()
        res = evaluate_many([(b, g) for b, g, _ in P])
        for b, g, p in P:
            d = res[b.id][1]
            h = d["headline"]
            print(f"{p['case']} {b.species:10} {h['name']:34} ({h['accounts']['named']}/{h['accounts']['of']})   V3 hypothesis: {p['v3_candidate']}")
            for a in d["alternates"]:
                print(f"      alt  {a['name']} ({a['accounts']['named']}/{a['accounts']['of']})")
            for nm in d["near_misses"]:
                print(f"      near {nm['name']} ({nm['missing']['near']}): {nm['missing']['what']} - {nm['missing']['why']}")
            for nm in d["pending"]:
                print(f"      pend {nm['name']}: {nm['missing']['what']} - {nm['missing']['why']}")
            print(f"      limit {d['limitation']['claim']}")
        if len(argv) > 1:
            with open(argv[1], "w", encoding="utf-8") as fh:
                json.dump({k: v[1] for k, v in res.items()}, fh, ensure_ascii=False, indent=1)
        return
    from trainers.model import Store
    from trainers.team_roles import all_builds
    store = Store()
    bid = argv[0]
    pair = next(((b, g) for b, g in all_builds(store) if b.id == bid), None)
    if not pair:
        raise SystemExit(f"no build {bid}")
    d = evaluate_many([(pair[0], pair[1] or "platinum")], store)[bid][1]
    print(json.dumps(d, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
