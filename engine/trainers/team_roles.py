"""The four team roles (Ace, Wall, Sweeper, Support) and the build-name ladder (docs/design/FOUR_LABS.md §3).

Every rule and number is in trainers/team_roles.json; this file only evaluates them, so the browser copy
(app/web/28_teamroles.html) stays small and a parity test can hold the two together.

    python3 -I trainers/team_roles.py <build id> [<game>]   # one build: its four roles, name and the numbers behind them
    python3 -I trainers/team_roles.py --pack                 # every library and journey build: app/data/roles4.json,
                                                             #   docs/roles/ROLE_SCORES.md, docs/naming/NAMES_NEEDED.md
    python3 -I trainers/team_roles.py --parity OUT [ids]     # Python's reads for the browser parity test
    python3 -I trainers/team_roles.py --docs                 # ROLE_SCORES.md and NAMES_NEEDED.md again from the stored pack

- **Ace** plays the build one-on-one against every Pokémon of its generation's Elite Four and Champions (named pools,
  rematches included), both sides at level 100, in the battle engine (battle/evaluate.py: our best plan against the
  game's own AI). It's an Ace when it beats enough of each.
- **Wall** reads the 100 attacks from those same pools that hit it hardest, or its bulk against the field.
- **Sweeper** and **Support** read the role engine (trainers/roles.py) underneath.
- **The name** follows Zack's ladder over the role engine's primary score. Words Zack hasn't named yet print as
  ⟨placeholders⟩, and the pack lists every word still needed.
"""
import json
import os
import sys
from collections import Counter, defaultdict
from dataclasses import replace

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
ROOT = os.path.dirname(ENGINE)
sys.path.insert(0, ENGINE)

import rules  # noqa: E402
from battle.knowledge import from_build  # noqa: E402
from trainers.model import Build, Store  # noqa: E402
from trainers.roles import RoleBook  # noqa: E402

CONFIG = os.path.join(HERE, "team_roles.json")
GAME_OF_GEN = {2: "crystal", 3: "emerald", 4: "platinum"}
SETUP = {"setup_physical", "setup_special", "setup_speed", "setup_defense"}


def load_config():
    with open(CONFIG, encoding="utf-8") as fh:
        return json.load(fh)


class TeamRoles:
    def __init__(self, store=None, scout=None, cfg=None):
        from battle.scouting_report import scout_engine
        self.cfg = cfg or load_config()
        self.store = store or Store()
        self.book = RoleBook(self.store)
        self.scout = scout or scout_engine()
        self.ev = self.scout.grid.ev
        self._pools, self._loaded = {}, {}

    # --- the opponents ------------------------------------------------------------------------------------
    def trainers(self, game):
        if game not in self._loaded:
            self._loaded[game] = {t["name"]: t for t in self.scout.bench.load(game)}
        return self._loaded[game]

    def pool(self, gen):
        """{pool name: [(Combatant at level 100, [where it appears])]}; the same Pokémon and set counts once."""
        if gen in self._pools:
            return self._pools[gen]
        level = self.cfg["level"]
        out = {}
        for pool, members in self.cfg["pools"][str(gen)].items():
            seen = {}
            for game, name in members:
                tr = self.trainers(game)[name]
                for c in self.scout.grid.theirs(tr, gen):
                    c = replace(c, level=level, name=f"{c.species} ({name}, {game})")
                    if c.key in seen:
                        seen[c.key][1].append(f"{name} ({game})")
                    else:
                        seen[c.key] = (c, [f"{name} ({game})"])
            out[pool] = list(seen.values())
        self._pools[gen] = out
        return out

    # --- our side ---------------------------------------------------------------------------------------------
    def combatant(self, build, gen):
        game = GAME_OF_GEN[gen]
        fill = lambda sp, rej: self.scout.strongest_set(sp, game, rej)
        b = {"moves": list(build.moves or []), "nature": build.nature, "ability": build.ability, "item": build.item,
             "evs": build.evs or None, "ivs": build.ivs or None, "level": self.cfg["level"]}
        return from_build(gen, build.species, b, fill=fill, name=build.species)

    # --- the four roles ---------------------------------------------------------------------------------------
    def fights(self, builds_by_gen):
        """Every build against every pool Pokémon of its generation, batched per generation (the calculator's numbers
        are fetched once for all of them). {build id: {pool: [(Combatant, where, Matchup)]}}."""
        out = {}
        for gen, builds in builds_by_gen.items():
            pools = self.pool(gen)
            field = [c for members in pools.values() for c, _ in members]
            ours = {}
            for b in builds:
                try:
                    ours[b.id] = self.combatant(b, gen)
                except (KeyError, IndexError, ValueError, TypeError):
                    pass
            res = self.ev.versus(list({c.key: c for c in ours.values()}.values()), list({c.key: c for c in field}.values()),
                                 rounds=self.cfg["fetch_rounds"])
            for bid, a in ours.items():
                if any((a.key, c.key) not in res for c in field):
                    continue                  # a fight that didn't settle in the rounds allowed reads as an error, not a guess
                out[bid] = {pool: [(c, where, res[(a.key, c.key)]) for c, where in members] for pool, members in pools.items()}
        return out

    def ace(self, fights):
        r = self.cfg["roles"]["ace"]
        rate = {}
        lost = {}
        for pool in ("elite_four", "champion"):
            games = fights[pool]
            wins = [m.outcome.winner == "A" for _, _, m in games]
            rate[pool] = round(sum(wins) / len(wins), 4) if wins else 0.0
            lost[pool] = [c.name for (c, _, m), w in zip(games, wins) if not w]
        earned = rate["elite_four"] >= r["elite_four_at_least"] and rate["champion"] >= r["champion_at_least"]
        score = round((rate["elite_four"] + rate["champion"]) / 2, 4)
        n = {p: len(fights[p]) for p in ("elite_four", "champion")}
        why = [f"beats {round(100 * rate['elite_four'])}% of {n['elite_four']} Elite Four Pokémon (needs "
               f"{round(100 * r['elite_four_at_least'])}%)",
               f"beats {round(100 * rate['champion'])}% of {n['champion']} Champion Pokémon (needs "
               f"{round(100 * r['champion_at_least'])}%)"]
        return {"role": "ace", "score": score, "earned": earned, "why": why,
                "numbers": {"elite_four_rate": rate["elite_four"], "champion_rate": rate["champion"],
                            "elite_four_n": n["elite_four"], "champion_n": n["champion"],
                            "lost_to": lost}}

    def wall(self, fights, sig):
        r = self.cfg["roles"]["wall"]
        hits = []
        for pool in ("elite_four", "champion"):
            for c, _, m in fights[pool]:
                for mv, (lo, hi) in m.incoming.items():
                    hits.append((hi, lo, c.name, mv))
        hits.sort(key=lambda x: (-x[0], -x[1], x[2], x[3]))
        top = hits[:r["hardest_attacks"]]
        n = r["hits_to_take"]
        under = 100 / (n - 1)                     # n hits taken: n - 1 top rolls don't knock it out
        three = sum(1 for hi, _, _, _ in top if hi < under) / len(top) if top else 0.0
        bulk = min(sig.get("bulk_phys", 0.0), sig.get("bulk_spec", 0.0))
        by_hits = three >= r["share_at_least"]
        by_bulk = bulk >= r["bulk_percentile_at_least"]
        why = [f"takes {n} or more hits from {round(100 * three)}% of the {len(top)} hardest-hitting Elite Four and "
               f"Champion attacks (needs {round(100 * r['share_at_least'])}%)",
               f"its weaker side of bulk is above {round(100 * bulk)}% of the field (needs "
               f"{round(100 * r['bulk_percentile_at_least'])}%)"]
        return {"role": "wall", "score": round(max(three, bulk), 4), "earned": by_hits or by_bulk, "why": why,
                "numbers": {"hit_share": round(three, 4), "hits_to_take": n, "attacks_read": len(top), "bulk_low_side": round(bulk, 4),
                            "by_hits": by_hits, "by_bulk": by_bulk,
                            "hardest": [{"attacker": a, "move": mv, "max": hi, "min": lo} for hi, lo, a, mv in top[:5]]}}

    def sweeper(self, cl):
        r = self.cfg["roles"]["sweeper"]
        best = max((x for x in cl["roles"] if x["role"] in r["from_roles"]), key=lambda x: x["score"])
        return {"role": "sweeper", "score": best["score"], "earned": best["score"] >= r["score_at_least"],
                "why": [f"best sweeping role: {best['name']} {best['score']:.2f} (needs {r['score_at_least']:.2f})"],
                "numbers": {"from": best["role"]}}

    def support(self, cl, moves):
        r = self.cfg["roles"]["support"]
        cats = set(r["support_categories"])
        sup = [m["name"] for m in moves if m["categories"] & cats]
        best = max((x for x in cl["roles"] if x["family"] == r["from_family"]), key=lambda x: x["score"])
        earned = len(sup) >= r["moves_at_least"] and best["score"] >= r["score_at_least"]
        return {"role": "support", "score": best["score"], "earned": earned,
                "why": [f"support moves: {', '.join(sup) or 'none'} (needs {r['moves_at_least']})",
                        f"best support role: {best['name']} {best['score']:.2f} (needs {r['score_at_least']:.2f})"],
                "numbers": {"support_moves": sup, "from": best["role"]}}

    # --- the name ---------------------------------------------------------------------------------------------
    def moveset(self, moves, gen):
        n = self.cfg["naming"]["movesets"]
        sup = set(self.cfg["roles"]["support"]["support_categories"])
        attacks = [m for m in moves if m["class"] != "status" and m["power"] > 0]
        count = {"setup_any": sum(1 for m in moves if m["categories"] & SETUP), "attacks": len(attacks),
                 "recovery_or_rest": sum(1 for m in moves if m["categories"] & {"recovery", "rest"}),
                 "support": sum(1 for m in moves if m["categories"] & sup),
                 "hazard_or_screens": sum(1 for m in moves if m["categories"] & {"hazard", "screens"}),
                 "priority_attack": sum(1 for m in moves if "priority_attack" in m["categories"])}
        cover = len(self.book.covered(attacks, gen, 0))
        for mid in n["order"]:
            spec = n[mid]
            if all(count[k] >= v for k, v in spec["needs"].items()) and \
                    count["attacks"] <= spec.get("attacks_at_most", 99) and cover >= spec.get("coverage_types_at_least", 0):
                return mid, count, cover
        return "mixed_bag", count, cover

    def name(self, cl, team, moves, gen, species):
        nm = self.cfg["naming"]
        words = nm["words"]
        match = cl["primary"]["score"] if cl["primary"]["role"] else 0.0
        band = next((b for b in nm["bands"] if match >= b["at_least"]), None)
        mid, _, _ = self.moveset(moves, gen)
        if band is None:
            return {"text": words.get("unnamed") or "⟨unnamed⟩", "match": match, "band": None, "tokens": [
                {"slot": "unnamed", "id": "unnamed", "word": words.get("unnamed") or None, "placeholder": "unnamed"}]}
        strong = sorted((x for x in cl["roles"] if x["score"] >= nm["hybrid_at_least"]), key=lambda x: -x["score"])[:nm["hybrid_max_roles"]]
        types = rules.species(gen, species)["types"]
        bst = sum(self.book.era.base_stats(species, gen).values())
        bst_id = next(b["id"] for b in nm["bst_bands"] if bst < b["below"])
        earned = [r for r in team if r["earned"]]
        team_id = max(earned, key=lambda r: r["score"])["role"] if earned else "none"
        tokens = []
        for part in band["parts"]:
            if part == "type":
                tokens.append(("type", types[0], types[0]))
            elif part == "noun":
                if len(strong) >= 2:
                    key = "+".join(sorted(x["role"] for x in strong))
                    tokens.append(("hybrid", key, " + ".join(self.book.roles[x["role"]]["name"] for x in sorted(strong, key=lambda x: x["role"]))))
                else:
                    tokens.append(("noun", cl["primary"]["role"], cl["primary"]["name"]))
            elif part == "moveset":
                tokens.append(("moveset", mid, nm["movesets"][mid]["label"]))
            elif part == "team_role":
                tokens.append(("team_role", team_id, self.cfg["roles"][team_id]["name"] if team_id != "none" else "no team role"))
            elif part == "bst":
                tokens.append(("bst", bst_id, f"BST {bst}"))
        out = []
        for slot, tid, label in tokens:
            word = (words.get(slot) or {}).get(tid) if isinstance(words.get(slot), dict) else None
            out.append({"slot": slot, "id": tid, "word": word or None, "placeholder": label})
        text = " ".join(t["word"] or f"⟨{t['placeholder']}⟩" for t in out)
        return {"text": text, "match": match, "band": band["at_least"], "tokens": out}

    # --- one build, or many -----------------------------------------------------------------------------------
    def read_many(self, builds, game_of=None):
        """[(Build, game)] -> {build id: read}. Fights are batched per generation."""
        by_gen = defaultdict(list)
        games = {}
        for b, game in builds:
            game = game or GAME_OF_GEN[b.generation or 4]
            games[b.id] = game
            by_gen[rules.GAME_GEN[game]].append(b)
        fights = self.fights(by_gen)
        out = {}
        for b, _ in builds:
            try:
                out[b.id] = self._read_one(b, games[b.id], fights)
            except (KeyError, IndexError, ValueError, TypeError) as e:
                out[b.id] = {"build": b.id, "species": b.species, "error": f"{type(e).__name__}: {e}"}
        return out

    def _read_one(self, b, game, fights):
        gen = rules.GAME_GEN[game]
        if b.id not in fights:
            raise ValueError(f"its fights didn't settle in {self.cfg['fetch_rounds']} calculator rounds (or it can't be built)")
        filled = Build(**{**b.__dict__, "moves": list(self.combatant(b, gen).moves), "level": self.cfg["level"]})
        cl = self.book.classify(filled, game, self.cfg["level"])
        ctx = self.book.context(filled, game, self.cfg["level"])
        team = [self.ace(fights[b.id]), self.wall(fights[b.id], cl["signals"]), self.sweeper(cl),
                self.support(cl, ctx["moves"])]
        team_sorted = sorted(team, key=lambda r: (-r["score"], r["role"]))
        return {"build": b.id, "species": b.species, "game": game, "gen": gen, "moves": filled.moves,
                "filled_moves": [m for m in filled.moves if m not in (b.moves or [])],
                "roles": team_sorted, "earned": [r["role"] for r in team_sorted if r["earned"]],
                "second_layer": {"primary": cl["primary"], "secondary": cl["secondary"],
                                 "top": [{"role": x["role"], "name": x["name"], "score": x["score"]} for x in cl["roles"][:5]]},
                "name": self.name(cl, team, ctx["moves"], gen, b.species)}

    def read(self, build, game=None):
        return self.read_many([(build, game)])[build.id]


# --- the pack, the distribution report and the names still needed --------------------------------------------------
def all_builds(store, competitive=True):
    """Every library build in its own generation, every journey companion (as its individual, me:<game>/<species>, in
    its chapter's game; open move slots filled by the engine) and, from the record store, every competitive set."""
    out = [(b, None) for b in store.library.values()]
    seen = set()
    for vid, v in store.trainers["me"].versions.items():
        for b in store.team(v):
            key = (v.game, b.species)
            if key in seen:
                continue
            seen.add(key)
            out.append((replace(b, id=f"me:{v.game}/{b.species}"), v.game))
    path = os.path.join(ENGINE, "store", "out", "builds.json")
    if competitive and os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for bid, x in json.load(fh)["builds"].items():
                if x["provenance"] == "competitive":
                    out.append((Build(id=bid, species=x["species"], moves=list(x.get("moves") or []), nature=x.get("nature"),
                                      ability=x.get("ability"), item=x.get("item"), ivs=x.get("ivs"), evs=x.get("evs"),
                                      generation=x.get("generation"), source=x.get("source", ""), name=x.get("name")), None))
    return out


def names_needed(cfg, reads, book):
    words = cfg["naming"]["words"]
    need = defaultdict(Counter)
    for r in reads.values():
        for t in r["name"]["tokens"]:
            if not t["word"]:
                need[t["slot"]][(t["id"], t["placeholder"])] += 1
    # every possible word, even ones no build needs yet, so the list is complete
    full = {"type": [(t, t) for t in rules.TYPES if t != "???"], "noun": [(k, v["name"]) for k, v in book.roles.items()],
            "moveset": [(k, cfg["naming"]["movesets"][k]["label"]) for k in cfg["naming"]["movesets"]["order"]],
            "team_role": [(k, cfg["roles"][k]["name"]) for k in ("ace", "wall", "sweeper", "support")] + [("none", "no team role")],
            "bst": [(b["id"], f"BST below {b['below']}" if b["below"] < 9999 else "BST 580 and up") for b in cfg["naming"]["bst_bands"]]}
    out = {}
    for slot in ("type", "noun", "hybrid", "moveset", "team_role", "bst"):
        rows = {}
        for k, label in full.get(slot, []):
            rows[k] = {"id": k, "means": label, "builds_using_it": 0, "named": bool((words.get(slot) or {}).get(k))}
        for (k, label), n in need.get(slot, {}).items():
            rows.setdefault(k, {"id": k, "means": label, "builds_using_it": 0, "named": False})["builds_using_it"] = n
        out[slot] = sorted(rows.values(), key=lambda r: (-r["builds_using_it"], r["id"]))
    shapes = cfg["team"]["shapes"]
    out["team_shape"] = [{"id": k, "means": shapes[k]["label"] + ": " + ", ".join(
        [f"{n}+ {r.replace('_or_', ' or ')}" for r, n in shapes[k].get("needs", {}).items()] +
        [f"at most {n} {r}" for r, n in shapes[k].get("at_most", {}).items()]) if shapes[k].get("needs") or shapes[k].get("at_most")
        else shapes[k]["label"] + ": anything the others don't fit", "builds_using_it": None,
        "named": bool((words.get("team_shape") or {}).get(k))} for k in shapes["order"]] + (
        [] if "balance" in shapes["order"] else [{"id": "balance", "means": "balance: anything the others don't fit",
                                                  "builds_using_it": None, "named": bool((words.get("team_shape") or {}).get("balance"))}])
    out["line"] = [{"id": l["id"], "means": l["means"], "builds_using_it": None, "named": bool((words.get("line") or {}).get(l["id"]))}
                   for l in breeding_lines()]
    return out


def breeding_lines():
    """The boutique lines the breeding lab shows (app/web/86_breedlines.html uses the same ids)."""
    out = []
    path = os.path.join(ENGINE, "store", "out", "lines.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for l in json.load(fh)["lines"]:
                lid = "-".join(x for x in "".join(c if c.isalnum() else " " for c in f"{l['game']}-{l['species']}".lower()).split())
                out.append({"id": lid, "means": f"{l['species']} line, {l['game']}: bred for {', '.join(l['egg_moves'])}"})
    path = os.path.join(ENGINE, "store", "proposed_lines.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            for l in json.load(fh)["lines"]:
                sig = l.get("signature") or {}
                out.append({"id": l["id"], "means": f"{l['species']} line, {l['game']} (proposed): " + ", ".join(sig.get("moves") or l["egg_moves"])
                            + (f", {sig['ability']}" if sig.get("ability") else "")})
    return out


def histogram(values, edges=(0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1.0001)):
    out = []
    for lo, hi in zip(edges, edges[1:]):
        out.append((lo, min(hi, 1.0), sum(1 for v in values if lo <= v < hi)))
    return out


def write_pack(tr, reads):
    cfg = tr.cfg
    os.makedirs(os.path.join(ROOT, "docs", "roles"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "docs", "naming"), exist_ok=True)
    bst = {}
    for g in (2, 3, 4):
        bst[str(g)] = {}
        for sp in rules.gen_data(g)["species"].values():
            try:
                bst[str(g)][sp["name"]] = sum(tr.book.era.base_stats(sp["name"], g).values())
            except (KeyError, IndexError, TypeError, ValueError):
                pass
    pack = {"config": cfg, "reads": {k: r for k, r in reads.items() if "error" not in r},
            "errors": {k: r["error"] for k, r in reads.items() if "error" in r}, "bst": bst, "built": __import__("time").strftime("%Y-%m-%d"),
            "pools": {str(g): {p: [{"name": c.name, "species": c.species, "where": w} for c, w in m] for p, m in tr.pool(g).items()}
                      for g in (2, 3, 4)}}
    with open(os.path.join(ENGINE, "app", "data", "roles4.json"), "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    write_docs(cfg, reads, tr.book)
    return pack


def write_docs(cfg, reads, book):
    """docs/roles/ROLE_SCORES.md and docs/naming/NAMES_NEEDED.md (+ .json) from a set of reads."""
    need = names_needed(cfg, reads, book)
    with open(os.path.join(ROOT, "docs", "naming", "names_needed.json"), "w", encoding="utf-8") as fh:
        json.dump(need, fh, indent=1, ensure_ascii=False)
    # the distribution report
    errors = {k: r["error"] for k, r in reads.items() if "error" in r}
    reads = {k: r for k, r in reads.items() if "error" not in r}
    match = [r["name"]["match"] for r in reads.values()]
    lines = ["# Role scores across every build", "",
             f"Generated by `python3 -I engine/trainers/team_roles.py --pack` from {len(reads)} builds "
             "(the build library, every journey companion and every Smogon competitive set in the record store). Rules: "
             "`engine/trainers/team_roles.json`.", "",
             "## The match score (the role engine's primary score, which the name ladder reads)", "",
             "| Score | Builds |", "|---|---|"]
    lines += [f"| {lo:.1f}–{hi:.1f} | {n} |" for lo, hi, n in histogram(match)]
    bands = cfg["naming"]["bands"]
    lines += ["", "Builds in each name band (current thresholds):", ""]
    edges = [b["at_least"] for b in bands]
    for i, b in enumerate(bands):
        hi = edges[i - 1] if i else 1.01
        lines.append(f"- {b['at_least']:.2f} and up{'' if not i else f' (below {hi:.2f})'}: "
                     f"{sum(1 for v in match if b['at_least'] <= v < hi)} builds, name = {' + '.join(b['parts'])}")
    lines.append(f"- below {edges[-1]:.2f}: {sum(1 for v in match if v < edges[-1])} builds, no name yet")
    for role in ("ace", "wall", "sweeper", "support"):
        vals = [next(x for x in r["roles"] if x["role"] == role) for r in reads.values()]
        lines += ["", f"## {cfg['roles'][role]['name']}", "", f"Rule: {cfg['roles'][role]['rule']}", "",
                  f"Earned by **{sum(1 for v in vals if v['earned'])} of {len(vals)}** builds.", "",
                  "| Score | Builds |", "|---|---|"]
        lines += [f"| {lo:.1f}–{hi:.1f} | {n} |" for lo, hi, n in histogram([v["score"] for v in vals])]
        top = sorted(reads.values(), key=lambda r: -next(x for x in r["roles"] if x["role"] == role)["score"])[:8]
        lines += ["", "Highest:", ""] + [f"- {r['build']} ({r['species']}, {r['game']}): "
                                         f"{next(x for x in r['roles'] if x['role'] == role)['score']:.2f}; "
                                         + "; ".join(next(x for x in r['roles'] if x['role'] == role)["why"]) for r in top]
    order = ["ace", "wall", "sweeper", "support"]
    combos = Counter(tuple(sorted(r["earned"], key=order.index)) for r in reads.values())
    lines += ["", "## Team roles earned together", "", "| Roles | Builds |", "|---|---|"]
    lines += [f"| {' + '.join(k) or 'none'} | {n} |" for k, n in combos.most_common()]
    with open(os.path.join(ROOT, "docs", "roles", "ROLE_SCORES.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    # the names still needed
    ln = ["# Names still needed", "",
          "Every word the build-name ladder uses, and how many current builds use it. Fill a word in "
          "`engine/trainers/team_roles.json` → `naming.words.<slot>.<id>`; until then the name shows ⟨what it means⟩. "
          "Generated by `python3 -I engine/trainers/team_roles.py --pack`.", ""]
    titles = {"type": "Type words (the build's first type)", "noun": "Role nouns (the role engine's primary role)",
              "hybrid": "Hybrid nouns (two or three roles at 0.80 or more; only pairs builds use today)",
              "moveset": "Moveset words", "team_role": "Team-role words", "bst": "Base-stat-total words",
              "team_shape": "Team shapes (the team lab: the first shape whose role counts fit, in this order)",
              "line": "Breeding lines (the breeding lab; one name per boutique line)"}
    counts = {slot: sum(1 for r in rows if not r["named"]) for slot, rows in need.items()}
    ln += ["## At a glance", "", "| What | Still to name |", "|---|---|"] + [f"| {titles[k]} | {n} |" for k, n in counts.items()]
    ln += [f"| One word for a build below the last band (`naming.words.unnamed`) | {0 if cfg['naming']['words'].get('unnamed') else 1} |",
           f"| **Total** | **{sum(counts.values()) + (0 if cfg['naming']['words'].get('unnamed') else 1)}** |", ""]
    for slot, rows in need.items():
        used = rows and rows[0]["builds_using_it"] is not None
        ln += [f"## {titles[slot]}", "", f"Fill in `naming.words.{slot}.<id>`.", "",
               "| id | means |" + (" builds using it |" if used else "") + " named |", "|---|---|" + ("---|" if used else "") + "---|"]
        ln += [f"| `{r['id']}` | {r['means']} |" + (f" {r['builds_using_it']} |" if used else "") + f" {'yes' if r['named'] else ''} |" for r in rows]
        ln.append("")
    ln += ["## Waiting on a rule as well as a name", "",
           "- **Top-tier Ace:** the rule for the tier above Ace, and its name (`roles.ace.top_tier`, off for now).", ""]
    with open(os.path.join(ROOT, "docs", "naming", "NAMES_NEEDED.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(ln))


def main(argv):
    store = Store()
    tr = TeamRoles(store)
    if argv and argv[0] == "--pack":
        reads = tr.read_many(all_builds(store))
        write_pack(tr, reads)
        earned = Counter(r for x in reads.values() for r in x["earned"])
        print(f"{len(reads)} builds read; earned: {dict(earned)}")
        return
    if argv and argv[0] == "--docs":                 # the docs again from the stored pack, without re-running the fights
        with open(os.path.join(ENGINE, "app", "data", "roles4.json"), encoding="utf-8") as fh:
            write_docs(tr.cfg, json.load(fh)["reads"], tr.book)
        return
    if argv and argv[0] == "--parity":
        ids = argv[2].split(",") if len(argv) > 2 else None
        builds = [x for x in all_builds(store) if not ids or x[0].id in ids]
        reads = tr.read_many(builds)
        with open(argv[1], "w", encoding="utf-8") as fh:
            json.dump({"builds": [{"build": b.to_dict(), "game": g} for b, g in builds], "reads": reads}, fh, ensure_ascii=False)
        return
    bid = argv[0]
    build = store.library.get(bid) or next(b for b, _ in all_builds(store) if b.id == bid)
    r = tr.read(build, argv[1] if len(argv) > 1 else None)
    print(f"{r['species']} ({r['game']}): {r['name']['text']}   match {r['name']['match']:.2f}")
    for x in r["roles"]:
        print(f"  {'✓' if x['earned'] else ' '} {x['role']:8} {x['score']:.2f}  " + " · ".join(x["why"]))


if __name__ == "__main__":
    main(sys.argv[1:])
