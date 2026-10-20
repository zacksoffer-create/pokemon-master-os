"""Studying battles (docs/FILM.md): many parsed replays become one scouting read, of one player or of a whole
field (a format at a level of play).

What it reads, all from the battles themselves:
- **who**: each Pokémon's usage, win rate and knockouts;
- **order**: the lead and what it does first, the order the rest come in, who's held back, who closes the game
  (the last knockout) and who's still standing at the end;
- **move order**: what each Pokémon uses first when it comes in, and its opening sequence as the lead;
- **builds**: the moves, item and ability each revealed, the consensus set per species, read through the role
  engine (trainers/roles.py), with how far it sits from the closest archetype in the library;
- **game state**: what gets chosen when even, ahead or behind (the action mix, the switch rate, the top moves) and
  the measured aggression ratio, on the playsheet's own finisher and attrition lists;
- **choices under pressure**: who comes in after a faint, and who they switch to when facing what;
- **teams**: cores (two Pokémon together), the playsheet's combos seen on revealed teams, and the roles a team is
  built from.
"""
import datetime
from collections import Counter, defaultdict
from functools import lru_cache

from film.log import parse
from film.replays import player_id, url_of
from trainers.model import Build
from trainers.playsheet import combos as find_combos, read_team

STATES = ("even", "ahead", "behind")


class Reader:
    """The role engine's reads, cached: a move's group, a set's roles and context."""

    def __init__(self, store, book, solver, film_cfg):
        self.store, self.book, self.solver, self.cfg = store, book, solver, film_cfg
        self.groups = film_cfg["actions"]["groups"]
        self.aggr = store.config["playsheet"]["aggression"]

    @lru_cache(maxsize=None)
    def move(self, name, gen):
        try:
            return self.book.move(name, gen)
        except (KeyError, IndexError):
            return None

    @lru_cache(maxsize=None)
    def group(self, name, gen):
        mv = self.move(name, gen)
        if not mv:
            return None
        for g in self.groups:
            if mv["categories"] & set(g["categories"]):
                return g["id"]
        return "other"

    @lru_cache(maxsize=None)
    def read(self, species, moves, item, ability, game):
        """(classification, {move: context row}) for a revealed set; no classification when it showed too little
        to read."""
        b = Build(id=f"film/{species}", species=species, moves=list(moves), item=item, ability=ability)
        try:
            ctx = self.book.context(b, game)
            cl = self.book.classify(b, game) if len(moves) >= self.cfg["study"]["min_moves_to_read"] else None
        except (KeyError, IndexError, ValueError):
            return None, {}
        return cl, {m["name"]: m for m in ctx["moves"]}

    def finishes(self, ctx_move):
        """The playsheet's aggression split for one chosen move: 'finisher', 'attrition' or None."""
        if not ctx_move:
            return None
        cats = ctx_move["categories"]
        if cats & set(self.aggr["finisher_categories"]) or (
                ctx_move["eff"] > 0 and ctx_move["scaled"] >= self.aggr["finisher_attack_at_least"]):
            return "finisher"
        if cats & set(self.aggr["attrition_categories"]):
            return "attrition"
        return None


def parse_replay(rec, reader, gen, film_cfg):
    meta = {"id": rec["id"], "url": url_of(rec["id"]), "format": rec.get("formatid"), "uploadtime": rec.get("uploadtime"),
            "rating": rec.get("rating"), "players": rec.get("players"),
            "tournament": rec["id"].startswith(film_cfg["sources"]["tournament_prefix"])}
    return parse(rec["log"], meta, film_cfg["state"], lambda m: reader.group(m, gen),
                 film_cfg["actions"]["called_from"])


def _pct(a, b):
    return round(100 * a / b) if b else None


def _date(ts):
    return datetime.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d") if ts else None


def _top(counter, n):
    return [{"name": k, "n": v} for k, v in counter.most_common(n)]


class Study:
    def __init__(self, reader, fmt, fmt_cfg, who=None):
        self.r, self.fmt, self.fc = reader, fmt, fmt_cfg
        self.gen, self.game = fmt_cfg["gen"], fmt_cfg["game"]
        self.who = player_id(who) if who else None
        self.cfg = reader.cfg
        self.battles = []
        self.games = []
        # who
        self.teams = Counter()                  # species → battles on a revealed team
        self.wins = Counter()
        self.kos = Counter()
        self.ko_battles = Counter()
        # order
        self.leads, self.lead_wins = Counter(), Counter()
        self.lead_first = defaultdict(Counter)  # lead species → its first move
        self.lead_opening = defaultdict(Counter)  # lead species → its first two moves
        self.positions = defaultdict(Counter)   # species → reveal position
        self.held_back = Counter()
        self.closers = Counter()
        self.closer_moves = defaultdict(Counter)
        self.standing = Counter()
        self.last_in = Counter()
        # move order
        self.entry_first = defaultdict(Counter)  # species → first move on coming in
        # builds
        self.moves = defaultdict(Counter)       # species → battles revealing each move
        self.items = defaultdict(Counter)
        self.abilities = defaultdict(Counter)
        self.sets = defaultdict(list)           # species → [revealed set]
        # game state
        self.state_actions = {s: Counter() for s in STATES}
        self.state_moves = {s: Counter() for s in STATES}
        self.state_species = {s: Counter() for s in STATES}
        self.state_pairs = {s: Counter() for s in STATES}  # (Pokémon, move) chosen in each state
        self.state_pair_battles = {s: Counter() for s in STATES}  # … counted once per battle
        self.state_pair_kos = {s: Counter() for s in STATES}
        self.state_switches = Counter()
        self.state_chosen = Counter()
        self.aggression = {s: Counter() for s in STATES + ("all",)}
        self.finisher_moves, self.attrition_moves = Counter(), Counter()
        # choices under pressure
        self.after_faint = Counter()
        self.after_faint_first = defaultdict(Counter)
        self.switch_into = defaultdict(Counter)  # facing species → species switched in
        self.sacks = Counter()                  # voluntary switches into a faint in the same turn (rare); kept small
        # teams
        self.pairs, self.pair_wins = Counter(), Counter()
        self.combos, self.combo_wins = Counter(), Counter()
        self.role_counts = Counter()
        self.team_shapes = Counter()
        # habits
        self.first_hazard = []
        self.self_ko_states = Counter()
        self.opponents = Counter()
        self.opp_species = Counter()
        self.forfeits = 0
        self.examples = defaultdict(list)       # (kind, …) → battle ids it happened in

    def _ex(self, key, bid):
        ex = self.examples[key]
        if bid not in ex and len(ex) < 5:
            ex.append(bid)

    # --- reading one battle ---------------------------------------------------------------------------
    def sides(self, b):
        for sid, s in b["sides"].items():
            if self.who is None or player_id(s["player"]) == self.who:
                yield sid, s, b["sides"]["p2" if sid == "p1" else "p1"]

    def add(self, b):
        studied = list(self.sides(b))
        if not studied:
            return False
        self.battles.append(b)
        self.forfeits += bool(b["forfeit"])
        for sid, s, foe in studied:
            self._side(b, sid, s, foe)
        return True

    def _side(self, b, sid, s, foe):
        won = s["won"]
        turns = max(b["turns"], 1)
        members = s["members"]
        species = [m["species"] for m in members]
        self.games.append({"id": b["meta"]["id"], "url": b["meta"]["url"], "date": _date(b["meta"]["uploadtime"]),
                           "player": s["player"], "rating": s["rating"] or b["meta"]["rating"], "opponent": foe["player"],
                           "won": won, "turns": b["turns"], "forfeit": b["forfeit"], "order": species,
                           "unseen": s["unseen"], "foe_order": foe["order"],
                           "tournament": b["meta"].get("tournament")})
        if self.who:
            self.opponents[foe["player"]] += 1
            for sp in foe["order"]:
                self.opp_species[sp] += 1
        for sp in species:
            self.teams[sp] += 1
            self.wins[sp] += won
        for i, a in enumerate(species):
            for c in species[i + 1:]:
                k = tuple(sorted((a, c)))
                self.pairs[k] += 1
                self.pair_wins[k] += won
        # order
        bid = b["meta"]["id"]
        lead = members[0] if members else None
        if lead:
            self._ex(("lead", lead["species"]), bid)
            self.leads[lead["species"]] += 1
            self.lead_wins[lead["species"]] += won
            mv = lead["stints"][0]["moves"] if lead["stints"] else []
            if mv:
                self.lead_first[lead["species"]][mv[0]] += 1
                self.lead_opening[lead["species"]][" → ".join(mv[:2])] += 1
        for m in members:
            self.positions[m["species"]][m["order"]] += 1
            if m["first_turn"] / turns >= self.cfg["order"]["held_back_after"]:
                self.held_back[m["species"]] += 1
                self._ex(("held_back", m["species"]), bid)
            if won and m["fainted_turn"] is None:
                self.standing[m["species"]] += 1
            for st in m["stints"]:
                if st["moves"]:
                    self.entry_first[m["species"]][st["moves"][0]] += 1
            if m["kos"]:
                self.kos[m["species"]] += len(m["kos"])
                self.ko_battles[m["species"]] += 1
        if members and s["unseen"] == 0:
            self.last_in[members[-1]["species"]] += 1
        lk = b["last_ko"]
        if won and lk and lk["side"] == sid:
            self.closers[lk["species"]] += 1
            self.closer_moves[lk["species"]][lk["by"]] += 1
            self._ex(("closer", lk["species"]), bid)
        # builds
        team = []
        for m in members:
            sp = m["species"]
            for mv in m["moves"]:
                self.moves[sp][mv] += 1
            if m["item"]:
                self.items[sp][m["item"]] += 1
            if m["ability"]:
                self.abilities[sp][m["ability"]] += 1
            rset = {"moves": list(m["moves"]), "item": m["item"], "ability": m["ability"], "battle": b["meta"]["id"],
                    "won": won}
            self.sets[sp].append(rset)
            team.append(Build(id=f"film/{sp}", species=sp, moves=list(m["moves"]), item=m["item"], ability=m["ability"]))
        self._team(team, won)
        # game state and choices
        ctx_of = {}
        for m in members:
            cl, ctx = self.r.read(m["species"], tuple(m["moves"]), m["item"], m["ability"], self.game)
            ctx_of[m["species"]] = ctx
        first_hazard = None
        seen_pairs = {st: set() for st in STATES}
        for row in b["rows"]:
            if row["side"] != sid:
                continue
            st = row["before"]["state"]
            if row["kind"] == "switch":
                if row["how"] == "forced":
                    self.after_faint[row["into"]] += 1
                    self._ex(("after_faint", row["into"]), bid)
                    continue
                if row["how"] == "voluntary":
                    self.state_chosen[st] += 1
                    self.state_switches[st] += 1
                    self.state_actions[st]["switch"] += 1
                    if row["before"]["foe_active"]:
                        self.switch_into[row["before"]["foe_active"]][row["into"]] += 1
                        self._ex(("switch", row["before"]["foe_active"], row["into"]), bid)
                continue
            if not row.get("chosen"):
                continue
            self.state_chosen[st] += 1
            g = row.get("group") or "other"
            self.state_actions[st][g] += 1
            self.state_moves[st][row["move"]] += 1
            self.state_species[st][row["actor"]] += 1
            self.state_pairs[st][(row["actor"], row["move"])] += 1
            seen_pairs[st].add((row["actor"], row["move"]))
            self._ex(("state", st, row["actor"], row["move"]), bid)
            if row["result"].get("ko"):
                self.state_pair_kos[st][(row["actor"], row["move"])] += 1
            split = self.r.finishes(ctx_of.get(row["actor"], {}).get(row["move"]))
            if split:
                self.aggression[st][split] += 1
                self.aggression["all"][split] += 1
                (self.finisher_moves if split == "finisher" else self.attrition_moves)[row["move"]] += 1
            if g == "hazard" and first_hazard is None and row["result"].get("hazard"):
                first_hazard = row["turn"]
            if g == "self_ko":
                self.self_ko_states[st] += 1
        for st in STATES:
            self.state_pair_battles[st].update(seen_pairs[st])
        if first_hazard is not None:
            self.first_hazard.append(first_hazard)
        # what came in after a faint did first
        for m in members:
            for stt in m["stints"]:
                if stt["in"] == "forced" and stt["moves"]:
                    self.after_faint_first[m["species"]][stt["moves"][0]] += 1

    def _team(self, team, won):
        if not team:
            return
        class _V:                               # read_team needs only the game
            game = self.game
        try:
            reads, weather = read_team(self.r.book, _V, team)
        except (KeyError, IndexError, ValueError):
            return
        shape = Counter()
        need = self.cfg["study"]["min_moves_to_read"]
        for b, ctx, sig, cl in reads:
            if len(b.moves) < need:
                shape["unread"] += 1
                continue
            fam = cl["primary"]["family"]
            self.role_counts[cl["primary"]["role"]] += 1
            shape[fam] += 1
        if shape["unread"] <= self.cfg["study"]["shape_max_unread"]:
            shape.pop("unread", None)
            self.team_shapes[" + ".join(f"{n} {f}" for f, n in sorted(shape.items(), key=lambda x: (-x[1], x[0])))] += 1
        for c in find_combos(self.r.store, self.r.book, reads, weather):
            self.combos[c["name"]] += 1
            self.combo_wins[c["name"]] += won

    # --- the read ------------------------------------------------------------------------------------
    def consensus(self, sp):
        """The species' most-revealed set: up to four moves, its item and ability, with how often each showed."""
        n = self.teams[sp]
        moves = [m for m, _ in self.moves[sp].most_common(4)]
        item = self.items[sp].most_common(1)[0][0] if self.items[sp] else None
        ability = self.abilities[sp].most_common(1)[0][0] if self.abilities[sp] else None
        return {"species": sp, "battles": n, "moves": moves,
                "move_shares": {m: _pct(self.moves[sp][m], n) for m in moves},
                "item": item, "item_share": _pct(self.items[sp][item], n) if item else None,
                "ability": ability, "other_moves": [m for m, _ in self.moves[sp].most_common()[4:8]],
                "other_items": [i for i, _ in self.items[sp].most_common()[1:4]]}

    def variants(self, sp):
        """The species' revealed sets clustered into variants by what they share (moves, and the item), fuller
        sets first; each variant's consensus is read through the role engine. (variants, sets too thin to read)"""
        need = self.cfg["study"]["min_moves_to_read"]
        cut = self.cfg["study"]["variant_overlap"]
        readable = [rs for rs in self.sets[sp] if len(rs["moves"]) >= need]
        unread = len(self.sets[sp]) - len(readable)
        feats = lambda rs: set(rs["moves"]) | ({"@" + rs["item"]} if rs["item"] else set())
        clusters = []                                   # [{"rows": [...], "mv": Counter, "it": Counter}]

        def core(c):
            out = {m for m, _ in c["mv"].most_common(4)}
            if c["it"]:
                out.add("@" + c["it"].most_common(1)[0][0])
            return out

        for rs in sorted(readable, key=lambda r: (-len(r["moves"]), -bool(r["item"]))):
            f = feats(rs)
            best, score = None, 0.0
            for c in clusters:
                k = core(c)
                ov = len(f & k) / min(len(f), len(k))
                if ov > score or (ov == score and best and len(c["rows"]) > len(best["rows"])):
                    best, score = c, ov
            if best is None or score < cut:
                best = {"rows": [], "mv": Counter(), "it": Counter(), "ab": Counter()}
                clusters.append(best)
            best["rows"].append(rs)
            best["mv"].update(rs["moves"])
            if rs["item"]:
                best["it"][rs["item"]] += 1
            if rs["ability"]:
                best["ab"][rs["ability"]] += 1
        out = []
        for c in sorted(clusters, key=lambda c: -len(c["rows"])):
            moves = [m for m, _ in c["mv"].most_common(4)]
            item = c["it"].most_common(1)[0][0] if c["it"] else None
            ability = c["ab"].most_common(1)[0][0] if c["ab"] else None
            cl, _ = self.r.read(sp, tuple(moves), item, ability, self.game)
            p, s2 = (cl["primary"], cl["secondary"]) if cl else ({"role": None, "name": "unread"}, None)
            name = p["name"] + (f", then {s2['name']}" if s2 and s2["score"] >= self.r.book.cfg["confidence"]["strong_at_least"] else "")
            rows = c["rows"]
            out.append({"role": p["role"], "name": name, "battles": len(rows),
                        "win_rate": _pct(sum(r["won"] for r in rows), len(rows)), "moves": moves,
                        "also": [m for m, _ in c["mv"].most_common()[4:7]], "item": item, "ability": ability,
                        "items_seen": dict(c["it"]), "example": rows[0]["battle"]})
        return out, unread

    def result(self, top=None):
        top = top or self.cfg["study"]["top"]
        n_sides = len(self.games)
        wins = sum(g["won"] for g in self.games)
        ratings = [g["rating"] for g in self.games if g["rating"]]
        dates = sorted(g["date"] for g in self.games if g["date"])
        usage = []
        for sp, n in self.teams.most_common():
            pos = self.positions[sp]
            usage.append({"species": sp, "battles": n, "share": _pct(n, n_sides), "win_rate": _pct(self.wins[sp], n),
                          "lead": self.leads[sp], "avg_position": round(sum(k * v for k, v in pos.items()) / n, 1),
                          "held_back": self.held_back[sp], "closer": self.closers[sp], "standing": self.standing[sp],
                          "kos": self.kos[sp], "kos_per_battle": round(self.kos[sp] / n, 2)})
        leads = [{"species": sp, "n": n, "share": _pct(n, n_sides), "win_rate": _pct(self.lead_wins[sp], n),
                  "first_move": _top(self.lead_first[sp], 3), "opening": _top(self.lead_opening[sp], 2)}
                 for sp, n in self.leads.most_common(top)]
        order = {"positions": {sp: dict(sorted(self.positions[sp].items())) for sp, _ in self.teams.most_common(top)},
                 "held_back": _top(self.held_back, top),
                 "closers": [{"name": sp, "n": n, "with": _top(self.closer_moves[sp], 2)} for sp, n in self.closers.most_common(top)],
                 "standing": _top(self.standing, top), "last_in": _top(self.last_in, top)}
        move_order = {sp: _top(self.entry_first[sp], 3) for sp, _ in self.teams.most_common(top)}
        sets = []
        floor = self.cfg["study"]["min_battles_for_set"] if not self.who else 1
        for sp, n in self.teams.most_common():
            if n < floor or not self.moves[sp]:
                continue
            c = self.consensus(sp)
            c["variants"], c["unread"] = self.variants(sp)
            top_v = c["variants"][0] if c["variants"] else None
            if top_v:
                c["role"], c["roles"] = top_v["role"], top_v["name"]
                try:
                    b = Build(id=f"film/{sp}", species=sp, moves=top_v["moves"], item=top_v["item"], ability=top_v["ability"])
                    c["closest"] = self.r.solver.distance(b, self.game)["line"]
                except (KeyError, IndexError, ValueError):
                    c["closest"] = None
            sets.append(c)
            if len(sets) >= top * 2:
                break
        states = {}
        for st in STATES:
            chosen = self.state_chosen[st]
            ag = self.aggression[st]
            states[st] = {"chosen": chosen, "switch_rate": _pct(self.state_switches[st], chosen),
                          "mix": {g: _pct(n, chosen) for g, n in self.state_actions[st].most_common()},
                          "top_moves": _top(self.state_moves[st], 6), "top_pokemon": _top(self.state_species[st], 4),
                          "top_plays": [{"pokemon": a, "move": m, "battles": nb, "n": self.state_pairs[st][(a, m)],
                                         "kos": self.state_pair_kos[st][(a, m)]}
                                        for (a, m), nb in sorted(self.state_pair_battles[st].items(),
                                                                 key=lambda x: (-x[1], -self.state_pairs[st][x[0]]))[:6]],
                          "aggression": _pct(ag["finisher"], ag["finisher"] + ag["attrition"])}
        ag = self.aggression["all"]
        aggression = {"ratio": _pct(ag["finisher"], ag["finisher"] + ag["attrition"]), "finishers": ag["finisher"],
                      "attrition": ag["attrition"], "top_finishers": _top(self.finisher_moves, 5),
                      "top_attrition": _top(self.attrition_moves, 5)}
        mp = self.cfg["study"]["min_pair_battles"]
        cores = sorted(({"pair": list(k), "n": n, "win_rate": _pct(self.pair_wins[k], n)}
                        for k, n in self.pairs.items() if n >= mp), key=lambda c: (-c["n"], -(c["win_rate"] or 0)))[:top]
        pressure = {"after_faint": [{"species": sp, "n": n, "first_move": _top(self.after_faint_first[sp], 2)}
                                    for sp, n in self.after_faint.most_common(top)],
                    "switch_into": {foe: _top(c, 3) for foe, c in
                                    sorted(self.switch_into.items(), key=lambda x: -sum(x[1].values()))[:top]}}
        teams = {"combos": [{"name": k, "n": n, "win_rate": _pct(self.combo_wins[k], n)} for k, n in self.combos.most_common()],
                 "roles": _top(self.role_counts, top), "shapes": _top(self.team_shapes, 5)}
        habits = {"first_hazard_turn": round(sum(self.first_hazard) / len(self.first_hazard), 1) if self.first_hazard else None,
                  "hazards_set_share": _pct(len(self.first_hazard), n_sides),
                  "self_ko_by_state": dict(self.self_ko_states), "forfeits": self.forfeits}
        out = {"format": self.fmt, "label": self.fc["label"], "gen": self.gen, "game": self.game,
               "who": self.who, "battles": len(self.battles), "sides": n_sides, "wins": wins,
               "win_rate": _pct(wins, n_sides) if self.who else None,
               "ratings": [min(ratings), max(ratings)] if ratings else None,
               "tournament_games": sum(1 for g in self.games if g["tournament"]) // (1 if self.who else 2),
               "dates": [dates[0], dates[-1]] if dates else None,
               "usage": usage[:top * 2], "leads": leads, "order": order, "move_order": move_order, "sets": sets,
               "states": states, "aggression": aggression, "cores": cores, "pressure": pressure, "teams": teams,
               "habits": habits, "games": self.games if self.who else self.games[:top],
               "examples": {"|".join(k): v for k, v in self.examples.items()},
               "replays": [b["meta"]["id"] for b in self.battles]}
        if self.who:
            out["opponents"] = _top(self.opponents, 5)
            out["faced"] = _top(self.opp_species, top)
        return out


def run(reader, fmt, fmt_cfg, records, who=None):
    """Records (fetched replays) → the study's read, and the parsed battles."""
    st = Study(reader, fmt, fmt_cfg, who)
    parsed = []
    for rec in records:
        b = parse_replay(rec, reader, fmt_cfg["gen"], reader.cfg)
        if st.add(b):
            parsed.append(b)
    return st.result(), parsed
