"""The battle engine pack (docs/APP.md, "The Battle Lab"): what the browser needs to run the scouting engine itself.

The Battle Lab regenerates the whole Journey Scouting File (cards, call sheets, advance reports, game plans, play calls
by situation, the self-scout, the coach profile and the what-if league) every time you change a member, a build, a
coach setting or a phrase rule. It runs the battle engine in JavaScript (app/web/27_battle.html), a line-for-line
port of battle/engine.py, moves.py, knowledge.py, evaluate.py, trainer_policy.py, grid.py, scouting.py,
playsheet.py, profile.py, phrases.py and scouting_report.py, with Smogon's damage calculator running in the page
(the same @smogon/calc the node bridge runs). This file writes what those modules read from the database and canon:

    gens        each generation's battle tables (rules.gen_data): species, moves with their era category, the type
                chart, abilities (PokeAPI, era-correct), the fully evolved field, and every species' learnable pool
    movebook    every move as the move book reads it (battle/moves.py), its plays included
    scouting    move accuracy, legendaries, Pokédex entries per game, height and weight, natures, species items
    opponents   each game's benchmark trainers, read from the pret data by battle/benchmarks.py
    field       each generation's Smogon OU usage field, and its cached profile baseline
    lineups     every lineup (canon chapters and variations), the characters, and the coach settings
    phrasebook  battle/phrasebook.json as it is; trainer_ai.json's phrases and the HGSS bitmask

    python3 -I app/battle_pack.py               # writes engine/app/data/battle.json and calc.json
    python3 -I app/battle_pack.py --parity OUT [ids]  # the Python engine's scouting file (or just these lineups),
                                                      # for app/test_battle_parity.mjs
"""
import base64
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

import rules  # noqa: E402
from battle import scouting_report as sr  # noqa: E402
from battle.knowledge import usage_field  # noqa: E402
from battle.profile import Profiler  # noqa: E402
from battle.scouting import GAME_TITLE, GAME_VERSION_IDS, SIGNATURE_ITEMS  # noqa: E402

GENS = (2, 3, 4)
CALC = os.path.join(ENGINE, "battle", "node_modules", "@smogon", "calc", "dist")


def bits(indices, n):
    """A set of indices as a base64 bitset (a learnable pool in ~60 characters)."""
    b = bytearray((n + 7) // 8)
    for i in indices:
        b[i >> 3] |= 1 << (i & 7)
    return base64.b64encode(bytes(b)).decode()


class Strings:
    def __init__(self):
        self.list, self.index = [], {}

    def __call__(self, s):
        if s not in self.index:
            self.index[s] = len(self.list)
            self.list.append(s)
        return self.index[s]


def move_entry(mv, text):
    return [mv.type, mv.category, mv.power, mv.accuracy, mv.priority, mv.pp, mv.target, mv.meta_category, text(mv.effect),
            mv.ailment, mv.ailment_chance, mv.self_changes, mv.foe_changes, mv.stat_chance, mv.drain, mv.healing,
            list(mv.hits), list(mv.turns), mv.flinch, mv.crit, sorted(mv.flags),
            [[p["play"], p["primary"], p["chance"], p.get("detail")] for p in mv.plays]]


def pack():
    scout = sr.scout_engine()
    battle, ref = scout.battle, scout.battle.ref
    mb = scout.grid.ev.mb
    text = Strings()
    gens, movebook, missing = {}, {}, []
    for gen in GENS:
        gd = rules.gen_data(gen)
        species = {sid: [sp["name"], sp["types"], [sp["bs"][k] for k in ("hp", "atk", "def", "spa", "spd", "spe")]]
                   for sid, sp in gd["species"].items()}
        moves = {mid: [m["name"], m["type"], rules.category(gen, m["name"]), m["bp"], m["priority"], m["recoil"],
                       m["drain"]] for mid, m in gd["moves"].items() if mid != "nomove"}
        abilities = {}
        for sp in gd["species"].values():
            try:
                abilities[sp["name"]] = rules.abilities(gen, sp["name"])
            except (KeyError, IndexError):
                missing.append(f"abilities gen{gen} {sp['name']}")
        order = sorted(moves)
        pos = {m: i for i, m in enumerate(order)}
        game = next(g for g, v in rules.GAME_GEN.items() if v == gen)
        learn = {}
        for sid, sp in gd["species"].items():
            try:
                pool = battle.learnable(sp["name"], game)
            except KeyError:
                continue
            learn[sid] = bits([pos[rules.to_id(m)] for m in pool if rules.to_id(m) in pos], len(order))
        pop = scout.population(gen)["rows"]
        gens[gen] = {"species": species, "moves": moves, "types": gd["types"], "abilities": abilities,
                     "final": sorted(pop), "order": order, "learn": learn}
        book = {}
        for m in moves.values():
            try:
                book[m[0]] = move_entry(mb.get(gen, m[0]), text)
            except (KeyError, IndexError):
                missing.append(f"movebook gen{gen} {m[0]}")
        movebook[gen] = book

    names = sorted({m[0] for g in gens.values() for m in g["moves"].values()})
    accuracy = {n: scout.accuracy(n) for n in names}
    all_species = sorted({sp[0] for g in gens.values() for sp in g["species"].values()})
    legendary = sorted({sp["name"] for gen in GENS for sp in scout.population(gen)["rows"].values()
                        if scout._legendary(sp["name"])})
    flavor, body = {}, {}
    for game in GAME_VERSION_IDS:
        gen = rules.GAME_GEN[game]
        flavor[game] = {}
        for sp in rules.gen_data(gen)["species"].values():
            try:
                t = scout.makeup(sp["name"], game)
            except KeyError:
                continue
            if t:
                flavor[game][sp["name"]] = text(t)
    for name in all_species:
        try:
            r = ref.q("SELECT height, weight FROM pokemon WHERE id=?", ref.species_id(name))[0]
            body[name] = [int(r["height"]), int(r["weight"])]
        except (KeyError, IndexError):
            pass
    natures = {r["identifier"]: [int(r["decreased_stat_id"]), int(r["increased_stat_id"])]
               for r in ref.q("SELECT identifier, decreased_stat_id, increased_stat_id FROM natures")}

    games = sorted({lu["game"] for lu in sr.load_lineups()})
    opponents = {g: scout.bench.load(g) for g in games}
    prof = Profiler(scout.grid.ev, mb)
    field, baseline = {}, {}
    for gen in GENS:
        field[gen] = [{"species": c.species, "gen": c.gen, "moves": c.moves, "level": c.level, "ability": c.ability,
                       "item": c.item, "nature": c.nature, "evs": c.evs, "ivs": c.ivs, "name": c.name, "source": c.source}
                      for c in usage_field(gen)]
        baseline[gen] = prof.baseline(gen)

    with open(os.path.join(ENGINE, "canon", "lineups.json"), encoding="utf-8") as fh:
        book = json.load(fh)
    with open(os.path.join(ENGINE, "battle", "phrasebook.json"), encoding="utf-8") as fh:
        phrasebook = json.load(fh)
    with open(os.path.join(ENGINE, "battle", "trainer_ai.json"), encoding="utf-8") as fh:
        tai = json.load(fh)
    out = {
        "gens": gens, "movebook": movebook, "text": text.list,
        "accuracy": accuracy, "legendary": legendary, "flavor": flavor, "body": body, "natures": natures,
        "signature": SIGNATURE_ITEMS, "game_title": GAME_TITLE,
        "opponents": opponents, "field": field, "baseline": baseline,
        "lineups": sr.load_lineups(), "coaches": sr.coaches(), "characters": book.get("characters", {}),
        "phrasebook": {k: v for k, v in phrasebook.items() if not k.startswith("_")},
        "trainer_ai": {k: tai[k] for k in ("gen4_bits", "healing_items", "switching_phrase", "items_phrase")},
        "method": sr.METHOD, "missing": missing,
    }
    path = os.path.join(HERE, "data", "battle.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    code = ""
    for f in ("data/production.min.js", "production.min.js"):
        with open(os.path.join(CALC, f), encoding="utf-8") as fh:
            code += fh.read() + "\n;\n"
    with open(os.path.join(HERE, "data", "calc.json"), "w", encoding="utf-8") as fh:
        json.dump({"version": "@smogon/calc 0.12.0", "license": "MIT (github.com/smogon/damage-calc); its data, Smogon's, MIT too",
                   "code": code}, fh, ensure_ascii=False, separators=(",", ":"))
    return path


def parity(path, only=None):
    """The Python engine's scouting file plus a few edited lineups, for app/test_battle_parity.mjs. Also counts any
    fight the damage table couldn't settle within its rounds. `only`: just these lineups, and no league (the quick
    check tests/test_engines.py runs; the whole file takes about five minutes)."""
    from battle import evaluate, playsheet
    unsettled = {"versus": 0, "calls": 0}
    versus, calls = evaluate.Evaluator.versus, playsheet.calls

    def versus_(self, ours, field, rounds=10, progress=None):
        done = versus(self, ours, field, rounds, progress)
        unsettled["versus"] += sum(1 for a in ours for b in field if (a.key, b.key) not in done)
        return done

    def calls_(ev, jobs, rounds=8):
        out, todo = [None] * len(jobs), list(range(len(jobs)))
        for _ in range(rounds):
            dirty = []
            for i in todo:
                before = ev.table.misses
                out[i] = playsheet._ask(ev, *jobs[i])
                if ev.table.misses != before:
                    dirty.append(i)
            if not dirty:
                break
            ev.table.fetch()
            todo = dirty
        else:
            unsettled["calls"] += len(todo)
        return out
    evaluate.Evaluator.versus = versus_
    playsheet.calls = calls_
    load, coaches = sr.load_lineups, sr.coaches
    base = {lu["id"]: lu for lu in load()}
    hg, cr, pt = base["heartgold"], base["crystal"], base["platinum"]
    fuzz = [
        {**hg, "id": "fuzz-heartgold-builds", "title": "HeartGold · fuzz: edited builds", "status": "variation",
         "decision": None, "variation": {"title": "edited builds", "why": "parity fuzz"},
         "members": [(sp, {"moves": (b.get("moves") or [])[:2], "nature": "Modest", "item": "Leftovers"})
                     if i == 0 else (sp, {**b, "item": "Choice Band"}) if i == 1 else (sp, b)
                     for i, (sp, b) in enumerate(hg["members"])]},
        {**cr, "id": "fuzz-crystal-coach", "title": "Crystal · fuzz: coach settings", "status": "variation",
         "decision": None, "variation": {"title": "coach settings", "why": "parity fuzz"}},
        {**pt, "id": "fuzz-platinum-swap", "title": "Platinum · fuzz: a swap", "status": "variation",
         "decision": None, "variation": {"title": "a swap", "why": "parity fuzz"},
         "members": [("Gengar", {}) if i == 2 else m for i, m in enumerate(pt["members"])]},
    ]
    fuzz_coach = {"fuzz-crystal-coach": {"aggression": 80, "patience": 30, "heal_line": 40, "risk_tolerance": 85,
                                         "tempo": "finish"},
                  "fuzz-heartgold-builds": {"heal_line": 55, "aggression": 20}}
    sr.load_lineups = lambda: load() + fuzz
    sr.coaches = lambda: {**coaches(), **fuzz_coach}
    if only:
        scout, coach = sr.scout_engine(), sr.coaches()
        data = {"lineups": [sr.chapter_data(scout, lu, coach.get(lu["id"])) for lu in sr.load_lineups() if lu["id"] in only],
                "league": None}
        for d in data["lineups"]:
            d.pop("members")
    else:
        data = sr.export_data()
    data["inputs"] = {"lineups": sr.load_lineups(), "coaches": sr.coaches()}
    data["unsettled"] = unsettled
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, default=list)
    return path


if __name__ == "__main__":
    if sys.argv[1:2] == ["--parity"]:
        print("wrote", parity(sys.argv[2], sys.argv[3].split(",") if len(sys.argv) > 3 else None))
    else:
        p = pack()
        print("wrote", p, f"{os.path.getsize(p) / 1024:.0f} KB")
