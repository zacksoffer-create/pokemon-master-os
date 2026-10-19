"""Role to build, and species to archetypes (docs/TRAINER_REPORT.md, Part 2, step 2).

The loop has three ways in, and locks apply to all of them:
- **build → roles:** trainers/roles.py (`RoleBook.classify`);
- **role → build:** `Solver.solve(species, role, game, locks)` fills every open field (nature, moves, item, ability,
  EVs and IVs) so the role is the build's primary by a margin, then as strong as it can be. It also ranks the
  alternatives for each field, with what each one trades (Jolly against Adamant: Speed for Attack);
- **species → archetypes:** `Solver.archetypes(species, game)` lists the library's archetypes for the species
  (stock, yours, the trainers'; external sets only with a source) and a derived build for every role the species
  can reach.

Locks pin any field (`{"moves": ["Swords Dance"], "item": "Life Orb"}`); `reachable(species, game, locks)` says
which roles the locked build can still become, and `solve` fills the rest for the one you choose. Suggestions are
legal for the selected game: moves it can learn there (any route, through pre-evolutions), items that exist in its
generation, its abilities in that generation. `scope="any"` widens moves to any game (D-048), each with that game
named as its reason; the PKHeX export then flags what the cartridge won't accept. Everything the solver tries comes
from trainers/roles.json (EV templates, item list, passes, margins). Deterministic: ties break by name, and the same
request always returns the same build.

The round-trip test: anything `solve` returns as reached classifies back to its role (tests/test_engines.py).
"""
from trainers.era import GAME_GEN, STATS
from trainers.model import Build
from trainers.roles import STAT_WORDS, live

HP_TYPES = ["Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel",
            "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark"]
IV_ORDER = ["hp", "atk", "def", "spe", "spa", "spd"]          # the games' Hidden Power bit order
FIELDS = ("moves", "nature", "item", "ability", "evs", "ivs")


def hidden_power(ivs):
    """Gen III-IV Hidden Power type and power from IVs (the same formula as specimen.Lab.hidden_power_34)."""
    bits = [ivs[s] for s in IV_ORDER]
    t = sum((v & 1) << i for i, v in enumerate(bits)) * 15 // 63
    p = sum(((v >> 1) & 1) << i for i, v in enumerate(bits)) * 40 // 63 + 30
    return HP_TYPES[t], p


def hp_ivs(hp_type, base):
    """The IVs closest to `base` that give Hidden Power `hp_type` at full power: each IV moves down by at most one
    (31 → 30; a Trick Room 0 Speed goes to 2 or 3), keeping as many IVs as possible where they were."""
    best = None
    for mask in range(64):
        ivs = {}
        for i, s in enumerate(IV_ORDER):
            b = base[s]
            hi = b if b >= 2 else 3                     # bit 1 must be set for 70 power
            lo = hi - 1
            ivs[s] = hi if (mask >> i) & 1 else lo
        t, p = hidden_power(ivs)
        if t != hp_type or p < 70:
            continue
        key = (sum(abs(ivs[s] - base[s]) for s in STATS), tuple(ivs[s] for s in STATS))
        if best is None or key < best[0]:
            best = (key, ivs)
    return best[1] if best else None


def sig_pct(book, ctx, stat):
    """A stat's place in the generation's field, 0-1 (the same pool the stat signals use)."""
    from trainers.roles import _pct
    pool = book.pool(ctx["gen"], ctx["level"])
    return _pct(ctx["stats"][stat], pool[stat])


class Solver:
    def __init__(self, book):
        self.book, self.store, self.era = book, book.store, book.era
        self.cfg = book.cfg["solver"]
        self.templates = live(book.cfg["ev_templates"])
        self.natures = [r[0].title() for r in self.era.ref.q("SELECT identifier FROM natures ORDER BY identifier")]

    # --- what the solver may use ------------------------------------------------------------------------
    def legal_moves(self, species, game, scope=None):
        """{move: reason} the species may use. "game": learnable in this game. "any": any game (D-048), a move
        that exists by this generation, with the nearest game named."""
        scope = scope or self.cfg["scope"]
        gen = GAME_GEN[game]
        here = {m: "learns it in this game" for m in self.era.learnable(species, game)}
        if scope == "any":
            sid = self.era.ref.species_id(species)
            names = self.era.game_names()
            seen = {}
            for stage in self.era.ref.line(sid):
                for name, vg, mgen in self.era.ref.q(
                        "SELECT n.name, pm.version_group_id, m.generation_id FROM pokemon_moves pm "
                        "JOIN moves m ON m.id=pm.move_id JOIN move_names n ON n.move_id=pm.move_id "
                        "AND n.local_language_id=9 WHERE pm.pokemon_id=?", stage):
                    if int(mgen) > gen or name in here:
                        continue
                    game_name, g = names[int(vg)]
                    cand = (abs(g - gen), g, game_name)
                    if name not in seen or cand < seen[name]:
                        seen[name] = cand
            here.update({m: f"learns it in {c[2]}" for m, c in seen.items()})
        out = {}
        for m, why in here.items():
            if m == "Hidden Power" and gen >= 3:
                for t in HP_TYPES:
                    if t in self.book.type_list(gen):
                        out[f"Hidden Power {t}"] = why
            else:
                out[m] = why
        return out

    def move_pool(self, species, game, scope=None, keep=()):
        """The moves worth trying: every move with a job beyond plain damage (setup, hazards, priority, pivoting…),
        plus the strongest attacks of each type and side. `keep` (locked moves) always stays."""
        gen = GAME_GEN[game]
        types = self.era.types(species, gen)
        abilities = self.era.abilities(species, gen) if gen >= 3 else [None]
        legal = self.legal_moves(species, game, scope)
        plain = {"attack", "recoil", "partial_trap"}
        cfg = self.cfg["move_pool"]
        jobs, attacks = [], {}
        for m in sorted(legal):
            try:
                mv = self.book.move(m, gen)
            except (KeyError, IndexError):
                continue
            if mv["categories"] - plain:
                jobs.append(m)
                continue
            if "attack" not in mv["categories"]:
                continue
            eff = max(self.book.effective_power(mv, types, a) for a in abilities)
            if eff >= cfg["min_power"]:
                attacks.setdefault((mv["type"], mv["class"]), []).append((-eff, m))
        best = [m for group in attacks.values() for _, m in sorted(group)[:cfg["best_per_type_and_class"]]]
        return sorted(set(jobs) | set(best) | set(keep)), legal

    def items(self, species, gen):
        mult = self.book.power["stat_multipliers"]["items"]
        names = set(self.book.cfg["suggestion_items"]["items"])
        for group in self.book.items.values():
            names |= set(group)
        out = []
        types = set(self.era.types(species, gen))
        for it in sorted(names):
            if it in self.book.items["species_item"] and species not in mult.get(it, {}).get("species", []):
                continue
            if it in self.book.item_types and not types & set(self.book.item_types[it]):
                continue
            g = self.era.item_gen(it)
            if g is not None and g <= gen:
                out.append(it)
        return out

    def ev_options(self, gen):
        """[(template id, side, evs, ivs)] for every EV template; "matching" becomes Attack and Sp. Atk."""
        out, seen = [], set()
        for tid, t in self.templates.items():
            sides = ["atk", "spa"] if "matching" in t["evs"] or "matching" in t.get("ivs", {}) else [None]
            for side in sides:
                evs = {s: 0 for s in STATS}
                for k, v in t["evs"].items():
                    evs[side if k == "matching" else k] = v
                ivs = {s: 31 for s in STATS}
                ivs.update(t.get("ivs", {}))
                key = (tuple(evs.values()), tuple(ivs.values()))
                if key not in seen:                     # two templates can land on the same spread
                    seen.add(key)
                    out.append((tid, side, evs, ivs))
        return out

    # --- evaluating a candidate -------------------------------------------------------------------------
    def _build(self, species, state, gen, scope_reasons=None):
        ivs = dict(state["ivs"])
        hp = next((m for m in state["moves"] if m.startswith("Hidden Power ")), None)
        if hp and gen >= 3 and not state.get("ivs_locked"):
            ivs = hp_ivs(hp.split()[-1], ivs) or ivs
        reasons = {m: scope_reasons[m] for m in state["moves"]
                   if scope_reasons and scope_reasons.get(m, "").startswith("learns it in ") and
                   scope_reasons[m] != "learns it in this game"}
        return Build(id=f"suggested:{species.lower()}", species=species, moves=list(state["moves"]),
                     nature=state["nature"], item=state["item"], ability=state["ability"], evs=dict(state["evs"]),
                     ivs=ivs, move_reasons=reasons, source="derived (role solver)", generation=gen,
                     status="suggested")

    def _score(self, build, game, level, role, team_weather):
        """The solver's objective, compared as a tuple: is the role primary; how close to the role's gate; the
        role's score plus a capped bonus for its margin over the next role; then the small quality tie-breaker."""
        ctx = self.book.context(build, game, level, team_weather)
        sig = self.book.signals(ctx)
        scores = {r: self.book.score(r, sig, explain=False)["score"] for r in self.book.roles}
        mine = scores[role]
        other_role, other = max(((r, s) for r, s in scores.items() if r != role), key=lambda p: (p[1], p[0]))
        margin = mine - other
        gate = self.book.gate_progress(role, sig)
        value = mine + self.cfg["margin_weight"] * min(margin, self.cfg["target_margin"]) if gate >= 1 else 0.0
        q = self.quality(ctx, sig, role)
        dead = self.dead_moves(ctx, sig, role) if margin > 0 and gate >= 1 else []
        key = (margin > 0 and gate >= 1 and not dead, round(gate, 6),
               round(value + self.cfg["quality"]["weight"] * q, 6))
        return key, {"score": mine, "margin": round(margin, 4), "beaten_by": other_role, "sig": sig,
                     "gate": gate, "quality": round(q, 4), "ctx": ctx, "dead": dead}

    def dead_moves(self, ctx, sig, role):
        """Moves that do nothing for the role: not in the evidence of any of its signals that fired, and not an
        attack. A build that reaches its role only by carrying one (a move whose only effect is to pull another
        role down) doesn't count as reaching it."""
        used = set()
        for k, w in self.book.roles[role]["weights"].items():
            if w > 0:
                v, ev = self.book.value(k, sig)
                if v > 0:
                    used |= set(ev)
        return [m["name"] for m in ctx["moves"] if m["eff"] <= 0 and m["name"] not in used]

    def quality(self, ctx, sig, role):
        """The tie-breaker (trainers/roles.json solver.quality): attack power with the item, coverage, the stats
        the build uses, and how usual its item is for the role's family. 0-1."""
        q = self.cfg["quality"]
        attacks = [m for m in ctx["moves"] if m["eff"] > 0]
        boost = q["item_power"].get(ctx["item"] or "", 1.0)
        top = max(ctx["stats"]["atk"], ctx["stats"]["spa"]) or 1
        power = 0.0
        for m in attacks:                       # each attack, scaled by the stat it actually hits with
            b = boost.get(m["class"], 1.0) if isinstance(boost, dict) else boost
            stat = ctx["stats"]["atk" if m["class"] == "physical" else "spa"] / top
            power += min(1.0, m["eff"] * b * stat / q["power_full_at"])
        power /= 4
        coverage = len(self.book.covered(attacks, ctx["gen"], 50)) / len(self.book.type_list(ctx["gen"]))
        used = ["hp", "def", "spd", "spe", ctx["matching"]]
        stat_use = sum(sig_pct(self.book, ctx, s) for s in used) / len(used)
        prefs = q["item_preference"][self.book.roles[role]["family"]]
        item = (1 - prefs.index(ctx["item"]) / len(prefs)) if ctx["item"] in prefs else 0.0
        p = q["parts"]
        return p["power"] * power + p["coverage"] * coverage + p["stat_use"] * stat_use + p["item"] * item

    # --- role → build -----------------------------------------------------------------------------------
    def solve(self, species, role, game, locks=None, scope=None, level=None, team_weather=None, explain=True):
        """Fill every open field so `role` is the build's primary role. Returns the build, whether the role was
        reached (and if not, which role beats it), the ranked alternatives for each field, and the export."""
        if role not in self.book.roles:
            raise KeyError(f"unknown role {role}; roles are in trainers/roles.json")
        gen = GAME_GEN[game]
        locks = dict(locks or {})
        flags = self.check_locks(species, game, locks, scope)
        locked_moves = list(locks.get("moves", []))
        pool, legal = self.move_pool(species, game, scope, keep=locked_moves)
        natures = [locks["nature"]] if "nature" in locks else (self.natures if gen >= 3 else [None])
        items = [locks["item"]] if "item" in locks else self.items(species, gen)
        abilities = [locks["ability"]] if "ability" in locks else (self.era.abilities(species, gen) if gen >= 3 else [None])
        evs_opts = self._lock_spreads(self.ev_options(gen), locks)
        runs = []
        for start in self._starts(role, evs_opts):
            runs.append(self._search(species, role, game, gen, level, team_weather, start, locked_moves, pool, legal,
                                     natures, items, abilities, evs_opts, locks))
        state, best, info = max(runs, key=lambda r: r[1])
        free_slots = [i for i in range(4) if i >= len(locked_moves)]
        evaluate = lambda st: self._score(self._build(species, st, gen, legal), game, level, role, team_weather)
        return self._result(species, role, game, gen, level, team_weather, scope, locks, flags, state, best, info,
                            legal, pool, natures, items, abilities, evs_opts, free_slots, evaluate, explain)

    def _search(self, species, role, game, gen, level, team_weather, start, locked_moves, pool, legal, natures,
                items, abilities, evs_opts, locks):
        """Coordinate ascent from one start: fill the open move slots, then try every value of every open field,
        keeping a change only when it improves the objective, until a pass changes nothing."""
        state = {"moves": tuple(locked_moves), "nature": natures[0] if len(natures) == 1 else None,
                 "item": items[0] if len(items) == 1 else None, "ability": abilities[0],
                 "evs": start[2], "ivs": start[3], "ev_template": start[0], "ivs_locked": "ivs" in locks}
        if len(natures) > 1:
            neutral = [n for n in natures if self.era.nature(n) == (None, None)]
            state["nature"] = neutral[0] if neutral else natures[0]
        evaluate = lambda st: self._score(self._build(species, st, gen, legal), game, level, role, team_weather)
        best, info = evaluate(state)
        free_slots = [i for i in range(4) if i >= len(locked_moves)]

        def try_field(name, values):
            nonlocal state, best, info
            changed = False
            for v in values:
                cand = dict(state, **v) if isinstance(v, dict) else dict(state, **{name: v})
                if cand == state:
                    continue
                key, inf = evaluate(cand)
                if key > best:
                    state, best, info, changed = cand, key, inf, True
            return changed

        for _ in range(self.cfg["passes"]):
            improved = False
            while len(state["moves"]) < 4:                       # fill open slots one at a time
                pick = None
                for m in pool:                                   # sorted: the first of equals wins
                    if m in state["moves"] or self._clash(m, state["moves"]):
                        continue
                    key, inf = evaluate(dict(state, moves=state["moves"] + (m,)))
                    if pick is None or key > pick[0]:
                        pick = (key, inf, m)
                if pick is None:
                    break
                best, info = pick[0], pick[1]
                state, improved = dict(state, moves=state["moves"] + (pick[2],)), True
            for i in free_slots:
                if i >= len(state["moves"]):
                    continue
                swaps = []
                for m in pool:
                    if m in state["moves"] or self._clash(m, state["moves"][:i] + state["moves"][i + 1:]):
                        continue
                    mv = list(state["moves"])
                    mv[i] = m
                    swaps.append({"moves": tuple(mv)})
                improved |= try_field("moves", swaps)
            improved |= try_field("ability", abilities)
            improved |= try_field("item", items)
            improved |= try_field("nature", natures)
            improved |= try_field("evs", [{"evs": e, "ivs": iv, "ev_template": t} for t, _, e, iv in evs_opts])
            if not improved:
                break
        return state, best, info

    def _result(self, species, role, game, gen, level, team_weather, scope, locks, flags, state, best, info, legal,
                pool, natures, items, abilities, evs_opts, free_slots, evaluate, explain):
        build = self._build(species, state, gen, legal)
        if info["gate"] < 1:                    # the role's gate can't be met with what this species may use
            sets = []
            for alt in self.book.roles[role]["requires"]:
                miss = frozenset(self.book.label(k) for k, m in alt.items() if self.book.value(k, info["sig"])[0] <= m)
                if miss and miss not in sets:
                    sets.append(miss)
            sets = [m for m in sets if not any(o < m for o in sets)]      # "a hazard" covers "a hazard and Taunt"
            unmet = [" and ".join(sorted(m)) for m in sets]
            where = self.era.game_names()[self._vg(game)][0]
            return {"species": species, "game": game, "role": role, "role_name": self.book.roles[role]["name"],
                    "scope": scope or self.cfg["scope"], "locks": locks, "lock_flags": flags, "reached": False,
                    "score": 0.0, "margin": None, "beaten_by": None, "build": None,
                    "unreachable": f"{species} can't be a {self.book.roles[role]['name']} in {where}"
                                   + (" with these locks" if locks else "") + f": it would need {' or '.join(unmet)}"}
        result = {"species": species, "game": game, "role": role, "role_name": self.book.roles[role]["name"],
                  "ev_label": self._ev_label(state), "dead_moves": info["dead"],
                  "scope": scope or self.cfg["scope"], "locks": locks, "lock_flags": flags,
                  "reached": best[0], "score": round(info["score"], 4), "margin": info["margin"],
                  "beaten_by": None if best[0] else info["beaten_by"],
                  "ev_template": state["ev_template"], "build": build.to_dict()}
        if explain:
            check = self.book.classify(build, game, level, team_weather)
            result["classified"] = {"primary": check["primary"], "secondary": check["secondary"]}
            result["why"] = self.book.line(check, top=1)
            result["alternatives"] = self._alternatives(species, state, gen, legal, pool, natures, items, abilities,
                                                        evs_opts, free_slots, evaluate, best, info, role)
            result["export"] = self.export(build, game, level)
        return result

    @staticmethod
    def _lock_spreads(opts, locks):
        """The spreads left to try once EVs and/or IVs are locked (a locked field replaces the template's)."""
        if "evs" not in locks and "ivs" not in locks:
            return opts
        out, seen = [], set()
        for tid, side, e, i in opts:
            ev = {s: locks["evs"].get(s, 0) for s in STATS} if "evs" in locks else e
            iv = {s: locks["ivs"].get(s, 31) for s in STATS} if "ivs" in locks else i
            key = (tuple(ev.values()), tuple(iv.values()))
            if key not in seen:
                seen.add(key)
                out.append(("locked" if "evs" in locks else tid, side, ev, iv))
        return out

    def _ev_label(self, v):
        t = self.templates.get(v["ev_template"])
        if not t:
            label = " / ".join(f"{x} {STAT_WORDS[s]}" for s, x in v["evs"].items() if x) or "no EVs"
            low = [f"{x} {STAT_WORDS[s]} IV" for s, x in v["ivs"].items() if x != 31]
            return label + (", " + ", ".join(low) if low else "")
        label = t["label"]
        if "attack" in label:
            label = label.replace("attack", "Atk" if v["evs"].get("atk", 0) >= v["evs"].get("spa", 0) else "SpA")
        return label

    @staticmethod
    def _clash(move, others):
        """Two Hidden Powers can't share a build."""
        return move.startswith("Hidden Power ") and any(o.startswith("Hidden Power ") for o in others)

    def _starts(self, role, evs_opts):
        """Where the search starts: the role's EV template, on each attacking side it has (the search can't swap
        a whole set's side one field at a time, so each side gets its own run)."""
        tid = self.book.roles[role].get("ev_template")
        starts = [o for o in evs_opts if o[0] == tid]
        return starts or evs_opts[:1]

    def check_locks(self, species, game, locks, scope=None):
        """What's wrong with the locks, if anything (they're kept either way; the result says so)."""
        gen = GAME_GEN[game]
        flags = []
        legal = self.legal_moves(species, game, scope)
        for m in locks.get("moves", []):
            if m not in legal:
                flags.append(f"{m}: {species} can't learn it in {'any game' if scope == 'any' else 'this game'}")
        if len(locks.get("moves", [])) > 4:
            flags.append("more than four moves locked")
        if "item" in locks:
            g = self.era.item_gen(locks["item"])
            if g is None or g > gen:
                flags.append(f"{locks['item']} doesn't exist in Gen {gen}")
        if "ability" in locks and gen >= 3 and locks["ability"] not in self.era.abilities(species, gen):
            flags.append(f"{species} can't have {locks['ability']} in Gen {gen}")
        if "nature" in locks:
            try:
                self.era.nature(locks["nature"])
            except KeyError:
                flags.append(f"unknown nature {locks['nature']}")
        if sum(locks.get("evs", {}).values()) > 510:
            flags.append("EVs over 510")
        return flags

    # --- tradeoffs ------------------------------------------------------------------------------------
    def _alternatives(self, species, state, gen, legal, pool, natures, items, abilities, evs_opts, free_slots,
                      evaluate, best, info, role):
        n = self.cfg["alternatives"]
        chosen_stats = self.store.stats(self._build(species, state, gen), self._game(gen))[0]

        def ranked(field, values, describe, limit=n):
            rows = []
            for v in values:
                cand = dict(state, **v) if isinstance(v, dict) else dict(state, **{field: v})
                if cand == state:
                    continue
                key, inf = evaluate(cand)
                rows.append((key, v, inf))
            rows.sort(key=lambda r: (r[0], str(r[1])), reverse=True)
            out = []
            for key, v, inf in rows[:limit]:
                cand = dict(state, **v) if isinstance(v, dict) else dict(state, **{field: v})
                out.append({"value": describe(v), "score": round(inf["score"], 4),
                            "delta": round(inf["score"] - info["score"], 4), "keeps_role": key[0],
                            "trade": self._trade(role, info, inf, species, state, cand, gen, chosen_stats)})
            return out

        alts = {"nature": self._distinct_natures(ranked("nature", natures, lambda v: v, limit=len(natures)), state),
                "item": self._useful_items(ranked("item", items, lambda v: v, limit=len(items)), role),
                "ability": ranked("ability", abilities, lambda v: v),
                "evs": ranked("evs", [{"evs": e, "ivs": iv, "ev_template": t} for t, _, e, iv in evs_opts],
                              self._ev_label),
                "moves": []}
        for i in free_slots:
            if i >= len(state["moves"]):
                continue
            swaps = []
            for m in pool:
                if m in state["moves"] or self._clash(m, state["moves"][:i] + state["moves"][i + 1:]):
                    continue
                mv = list(state["moves"])
                mv[i] = m
                swaps.append({"moves": tuple(mv)})
            alts["moves"].append({"slot": i + 1, "move": state["moves"][i],
                                  "instead": [dict(r, value=r["value"]) for r in
                                              ranked("moves", swaps, lambda v, i=i: v["moves"][i])]})
        return alts

    @staticmethod
    def _vg(game):
        from refdb import VG
        return VG[game]

    @staticmethod
    def _game(gen):
        return {2: "crystal", 3: "emerald", 4: "platinum"}[gen]

    def _useful_items(self, rows, role):
        """Item alternatives worth showing: ones that change the role's score, or that the role's family usually
        carries. An item the role doesn't notice and nobody carries for it is noise."""
        prefs = self.cfg["quality"]["item_preference"][self.book.roles[role]["family"]]
        keep = [r for r in rows if abs(r["delta"]) > 1e-6 or r["value"] in prefs]
        return keep[:self.cfg["alternatives"]]

    def _distinct_natures(self, rows, state):
        """One nature per stat it raises (Jolly for Speed, Adamant for Attack…), skipping the chosen one's: the
        natures that only differ in which unused stat they lower aren't a real choice."""
        mine = self.era.nature(state["nature"])[0] if state["nature"] else None
        out, seen = [], {mine}
        for r in rows:
            up = self.era.nature(r["value"])[0]
            if up in seen:
                continue
            seen.add(up)
            out.append(r)
        return out[:self.cfg["alternatives"]]

    def _trade(self, role, info_a, info_b, species, a, b, gen, stats_a):
        """What moving from a to b gives and costs: real stat changes for natures and spreads; for the rest, the
        role's signals that move the most, or (when the role doesn't change) what the tie-breaker sees."""
        out = []
        if (a["nature"], a["evs"], a["ivs"]) != (b["nature"], b["evs"], b["ivs"]):
            stats_b = self.store.stats(self._build(species, b, gen), self._game(gen))[0]
            for s in STATS:
                if stats_a[s] != stats_b[s]:
                    out.append(f"{STAT_WORDS[s]} {stats_a[s]} → {stats_b[s]}")
            return out
        weights = self.book.roles[role]["weights"]
        moves = []
        for k, w in weights.items():
            va, vb = self.book.value(k, info_a["sig"])[0], self.book.value(k, info_b["sig"])[0]
            if abs(vb - va) > 1e-6:
                moves.append((w * (vb - va), k))
        for d, k in sorted(moves, key=lambda p: (-abs(p[0]), p[1]))[:3]:
            out.append(("more " if (d > 0) == (weights[k] > 0) else "less ") + self.book.label(k))
        if not out:
            out.append("the same for the role")
        out += self._plain_trade(a, b, info_a["ctx"], info_b["ctx"])
        return out

    def _plain_trade(self, a, b, ctx_a, ctx_b):
        """What the tie-breaker sees, in plain terms: a move's power and coverage, an item's boost."""
        out = []
        gone = [m for m in a["moves"] if m not in b["moves"]]
        new = [m for m in b["moves"] if m not in a["moves"]]
        if gone and new:
            pa = {m["name"]: m["scaled"] for m in ctx_a["moves"]}
            pb = {m["name"]: m["scaled"] for m in ctx_b["moves"]}
            if pa.get(gone[0]) or pb.get(new[0]):
                out.append(f"{new[0]} {round(pb.get(new[0], 0))} against {gone[0]} {round(pa.get(gone[0], 0))}")
            hits = lambda c: self.book.covered([m for m in c["moves"] if m["eff"] > 0], c["gen"], 50)
            ca, cb = hits(ctx_a), hits(ctx_b)
            if cb - ca:
                out.append("adds " + ", ".join(sorted(cb - ca)))
            if ca - cb:
                out.append("loses " + ", ".join(sorted(ca - cb)))
        if a["item"] != b["item"]:
            boost = self.cfg["quality"]["item_power"]
            word = lambda it: (f"×{boost[it]}" if not isinstance(boost.get(it), dict) else
                               ", ".join(f"×{v} {k}" for k, v in boost[it].items())) if it in boost else "no power boost"
            if word(a["item"]) != word(b["item"]):
                out.append(f"{b['item']}: {word(b['item'])} (now {word(a['item'])})")
        return out

    # --- export ---------------------------------------------------------------------------------------
    def export(self, build, game, level=None):
        """The PKHeX path: a Showdown set and a Batch Editor script from the Specimen Lab, with its legality
        check (D-024's learnability gate; anything outside the game shows up as a conflict)."""
        from specimen import Lab, Specimen
        from trainers.model import DB
        lab = Lab(DB)
        sp = Specimen(species=build.species, game=game, level=level or self.store.config["level_scale"]["default"],
                      moves=list(build.moves), item=build.item or "", nature=build.nature or "",
                      ability=build.ability or "", ivs=dict(build.ivs or {}), evs=dict(build.evs or {}))
        card = lab.derive(sp)
        return {"showdown": lab.showdown(sp, card), "pkhex": lab.batch_script(sp, card),
                "legal": not card["conflicts"], "conflicts": card["conflicts"], "notes": card["notes"]}

    # --- reachable roles and archetypes ---------------------------------------------------------------
    def reachable(self, species, game, locks=None, scope=None, level=None, team_weather=None):
        """Every role, and whether the locked build can still become it (best score and margin, or what beats it)."""
        out = []
        for role in self.book.roles:
            r = self.solve(species, role, game, locks, scope, level, team_weather, explain=False)
            floor = self.cfg["reachable_at_least"]
            out.append({"role": role, "name": r["role_name"], "family": self.book.roles[role]["family"],
                        "reached": r["reached"], "loose": r["reached"] and r["score"] < floor,
                        "score": r["score"], "confidence": self.book.confidence(r["score"]), "margin": r["margin"],
                        "beaten_by": r["beaten_by"], "unreachable": r.get("unreachable"), "build": r["build"]})
        families = list(live(self.book.cfg["families"]))
        return sorted(out, key=lambda r: (not r["reached"], r["loose"], families.index(r["family"]), -r["score"],
                                          r["role"]))

    def trusted(self, build):
        """An external set counts only with its source and generation on record."""
        a = self.book.cfg["archetypes"]
        if not build.source.startswith(a["external_prefix"]):
            return True
        return bool(build.source[len(a["external_prefix"]):].strip()) and all(
            getattr(build, f, None) for f in a["external_requires"])

    def library_archetypes(self, species):
        lib = [b for b in self.store.library.values() if b.species == species]
        return [b for b in lib if self.trusted(b)], [b for b in lib if not self.trusted(b)]

    def archetypes(self, species, game, level=None, derived=True):
        """The library's archetypes for a species, each classified, plus a derived build for each role it reaches."""
        gen = GAME_GEN[game]
        trusted, untrusted = self.library_archetypes(species)
        out = {"species": species, "game": game, "library": [], "derived": [],
               "untrusted": [b.id for b in untrusted]}
        for b in sorted(trusted, key=lambda b: b.id):
            r = self.book.classify(b, game, level)
            out["library"].append({"id": b.id, "name": b.name, "source": b.source, "generation": b.generation,
                                   "tier": b.tier, "role": b.role, "primary": r["primary"], "secondary": r["secondary"],
                                   "flags": self.store.check(b, game)})
        if derived:
            for r in self.reachable(species, game, level=level):
                if r["reached"] and not r["loose"]:
                    out["derived"].append({"role": r["role"], "name": r["name"], "family": r["family"],
                                           "score": r["score"], "margin": r["margin"], "build": r["build"],
                                           "source": "derived (role solver)", "generation": gen})
        return out

    def distance(self, build, game, level=None):
        """How far a build is from the closest stock archetype of its species: "Swords Dance sweeper, differs on
        item (Life Orb → Choice Band)". Only fields the build records are compared (an open field isn't a
        difference). With no stock archetype, or a far one, also the closest derived build for its own primary role."""
        a = self.book.cfg["archetypes"]
        stock = [b for b in self.store.library.values() if b.species == build.species and b.source in a["stock_sources"]
                 and b.id != build.id]
        rows = sorted((self._gap(build, b, a) + (b.name or b.id, b.id) for b in stock), key=lambda r: (r[0], r[2]))
        open_fields = [f for f in a["fields"] if not getattr(build, f)]
        out = {"build": build.id, "species": build.species, "not_recorded": open_fields, "stock": None, "derived": None}
        if rows:
            d, diffs, name, bid = rows[0]
            out["stock"] = {"closest": bid, "name": name, "distance": d, "differences": diffs,
                            "line": name + (", the same build" if not diffs else
                                            ", differs on " + "; ".join(x["text"] for x in diffs))}
        if not rows or rows[0][0] >= a["far_at"]:
            role = self.book.classify(build, game, level)["primary"]["role"]
            r = self.solve(build.species, role, game, level=level, explain=False)
            if r["build"]:
                dv = Build(id=f"derived:{role}", **{k: v for k, v in r["build"].items() if k != "id"})
                d, diffs = self._gap(build, dv, a)
                name = f"{self.book.roles[role]['name']} build"
                out["derived"] = {"role": role, "name": name, "distance": d, "differences": diffs, "build": r["build"],
                                  "line": name + (", the same build" if not diffs else
                                                  ", differs on " + "; ".join(x["text"] for x in diffs))}
        parts = []
        if out["stock"]:
            parts.append("closest stock: " + out["stock"]["line"])
        else:
            parts.append(f"no stock archetype for {build.species} yet")
        if out["derived"]:
            parts.append("closest derived: " + out["derived"]["line"])
        if open_fields:
            parts.append("not recorded: " + ", ".join(open_fields))
        out["line"] = ". ".join(parts)
        return out

    def _gap(self, x, y, cfg):
        """(distance, differences): one for each differing field, half for each differing move."""
        diffs = self._diff(x, y, cfg)
        d = 0.0
        for df in diffs:
            d += 0.5 * df["count"] if df["field"] == "moves" else 1.0
        return d, diffs

    @staticmethod
    def _diff(x, y, cfg):
        out = []
        for f in cfg["fields"]:
            vx, vy = getattr(x, f), getattr(y, f)
            if not vx:                                  # not recorded on the build: not a difference
                continue
            if f == "moves":
                gone, new = sorted(set(vx) - set(vy)), sorted(set(vy) - set(vx))
                if gone or new:
                    out.append({"field": f, "count": len(gone), "text": f"{len(gone)} move{'s' if len(gone) != 1 else ''} "
                                                                       f"({', '.join(gone)} → {', '.join(new) or 'none'})"})
            elif f == "evs":
                ex, ey = vx or {}, vy or {}
                gap = sum(abs(ex.get(s, 0) - ey.get(s, 0)) for s in STATS) / 2
                if (ex or ey) and gap > cfg["ev_close"]:
                    show = lambda e: " / ".join(f"{v} {STAT_WORDS[s]}" for s, v in e.items() if v) or "none"
                    out.append({"field": f, "text": f"EVs ({show(ex)} → {show(ey)})"})
            elif (vx or None) != (vy or None):
                out.append({"field": f, "text": f"{f} ({vx or 'none'} → {vy or 'none'})"})
        return out


# --- readable output (the CLI prints these; the data above is what Part 2's other pieces read) ---------------
def _spread(evs):
    return " / ".join(f"{v} {STAT_WORDS[s]}" for s, v in (evs or {}).items() if v) or "no EVs"


def render_solve(r):
    where = r["game"]
    if not r["build"]:
        return f"{r['species']} as a {r['role_name']}: not reachable. {r['unreachable']}."
    b = r["build"]
    head = f"{r['species']} as a {r['role_name']} ({where}): "
    if r["reached"]:
        nxt = r["classified"]["secondary"]
        head += f"reached, {r['score']:.2f} ({r['classified']['primary']['confidence']})"
        if nxt:
            head += f", ahead of {nxt['name']} by {r['margin']:.2f}"
    else:
        p = r["classified"]["primary"]
        head += (f"not reached: the best build for it reads {p['name']} first ({p['score']:.2f}), "
                 f"{r['role_name']} {r['score']:.2f}")
    lines = [head]
    if r["lock_flags"]:
        lines.append("  Locks to check: " + "; ".join(r["lock_flags"]))
    if r["locks"]:
        lines.append("  Locked: " + ", ".join(f"{k} {', '.join(v) if isinstance(v, list) else _spread(v) if isinstance(v, dict) else v}"
                                             for k, v in r["locks"].items()))
    ivs = {k: v for k, v in (b.get("ivs") or {}).items() if v != 31}
    lines.append(f"  {b.get('nature') or 'no nature'} · {b.get('item') or 'no item'} · {b.get('ability') or 'no ability'}"
                 f" · {r['ev_label']}" + (f" · IVs {_spread(ivs)}" if ivs else ""))
    lines.append("  Moves: " + ", ".join(b["moves"]))
    for m, why in (b.get("move_reasons") or {}).items():
        lines.append(f"    {m}: {why}")
    lines.append("  Why: " + r["why"].split(": ", 1)[-1])
    alt = r["alternatives"]
    lines.append("  Instead:")
    for field in ("nature", "item", "ability", "evs"):
        for a in alt[field]:
            lines.append(f"    {field:7} {a['value']} ({a['delta']:+.3f}{'' if a['keeps_role'] else ', loses the role'}): "
                         + "; ".join(a["trade"]))
    for slot in alt["moves"]:
        for a in slot["instead"][:2]:
            lines.append(f"    move {slot['slot']}  {slot['move']} → {a['value']} ({a['delta']:+.3f}"
                         f"{'' if a['keeps_role'] else ', loses the role'}): " + "; ".join(a["trade"]))
    ex = r["export"]
    lines.append("  Export (" + ("legal in this game" if ex["legal"] else "check: " + "; ".join(ex["conflicts"])) + "):")
    lines += ["    " + x for x in ex["showdown"].splitlines()]
    lines.append("  PKHeX batch:")
    lines += ["    " + x for x in ex["pkhex"].splitlines()]
    return "\n".join(lines)


def render_reachable(species, rows):
    lines = [f"{species}: roles it can reach"]
    fam = None
    for r in rows:
        if not r["reached"]:
            continue
        if r["family"] != fam:
            fam = r["family"]
            lines.append(f"  {fam.title()}")
        b = r["build"]
        lines.append(f"    {r['name']}: {r['score']:.2f} ({'loose' if r['loose'] else r['confidence']}) · "
                     f"{b.get('nature') or ''} {b.get('item') or ''} · {', '.join(b['moves'])}")
    out = [r for r in rows if not r["reached"]]
    if out:
        lines.append("  Not reachable:")
        lines += [f"    {r['name']}: {(r['unreachable'] or 'beaten by ' + str(r['beaten_by'])).split(': ', 1)[-1]}" for r in out]
    return "\n".join(lines)


def render_archetypes(a):
    lines = [f"{a['species']} archetypes ({a['game']})"]
    if a["library"]:
        lines.append("  From the library:")
        for x in a["library"]:
            p = x["primary"]
            tag = f"{x['source']}, Gen {x['generation']}" + (f", tier {x['tier']}" if x.get("tier") else "")
            lines.append(f"    {x['name'] or x['id']} [{tag}]: reads {p['name']} ({p['score']:.2f})"
                         + (f"; built for {x['role']}" if x.get("role") and x["role"] != p["role"] else "")
                         + (f"; flags: {'; '.join(x['flags'])}" if x["flags"] else ""))
    else:
        lines.append("  No library archetype for this species yet.")
    if a["untrusted"]:
        lines.append("  Left out (external, no source on record): " + ", ".join(a["untrusted"]))
    if a["derived"]:
        lines.append("  Derived (role solver):")
        for d in a["derived"]:
            b = d["build"]
            lines.append(f"    {d['name']} ({d['score']:.2f}): {b.get('nature')} {b.get('item')} · {', '.join(b['moves'])}")
    return "\n".join(lines)

