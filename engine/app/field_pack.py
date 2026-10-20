"""Field readiness's data (docs/APP.md): the wilderness engine's evidence for every species in every journey game,
so the app can read any team's readiness live (wilderness/engine.py team_report, ported in web/85_field.html).

Evidence is tiered and never blended (cartridge, lore, inference, authored). Pending world records travel with it,
so the page can preview a team as if they were approved, the way the workbench's preview_world does; nothing is
saved. Also each game's camp-life food systems (wilderness/camp_life.py).

    python3 -I app/field_pack.py      # writes engine/app/data/field.json
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

import rules  # noqa: E402
from trainers.model import DB  # noqa: E402
from wilderness.camp_life import CampLife  # noqa: E402
from wilderness.engine import CAPABILITIES, FIELD_MOVES, GAME_FIELD_MOVES, SCENARIOS, TIER_RANK, WildernessEngine  # noqa: E402
from wilderness.world import WorldStore  # noqa: E402

GAMES = ("crystal", "firered", "emerald", "platinum", "heartgold", "soulsilver")
TOP = {2: 251, 3: 386, 4: 493}


def pack():
    world = WorldStore()
    wild = WildernessEngine(DB, world.authored(), world.proposals())
    camp = CampLife(wild)
    sources, src_ix = [], {}

    def s(text):
        if text not in src_ix:
            src_ix[text] = len(sources)
            sources.append(text)
        return src_ix[text]

    out = {"capabilities": CAPABILITIES, "scenarios": SCENARIOS, "tiers": TIER_RANK, "games": {}, "field_moves": {k: v[1] for k, v in FIELD_MOVES.items()}}
    for game in GAMES:
        gen = rules.GAME_GEN[game]
        ev = {}
        for sid in range(1, TOP[gen] + 1):
            name = wild.ref.name(sid)
            try:
                rows = wild.evidence(name, game)
            except (KeyError, IndexError):
                continue
            ev[name] = [[e.capability, e.tier, s(e.source), s(e.detail) if e.tier != "lore" else None] for e in rows]
        out["games"][game] = {"evidence": ev, "camp": camp.systems(game), "berries": len(camp.berries(game)),
                              "field_moves": sorted(GAME_FIELD_MOVES[game])}
    out["sources"] = sources
    out["proposals"] = [{k: r[k] for k in ("id", "game", "species", "capability", "statement")} for r in world.proposals()]
    return out


def main():
    data = pack()
    path = os.path.join(HERE, "data", "field.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"field.json {os.path.getsize(path) / 1024:.0f} KB, {sum(len(g['evidence']) for g in data['games'].values())} species-games")




def parity(path, seed=11):
    """For the tests: Python's team_report for every lineup on file and random teams in every game, plus one read
    with every pending world record previewed (the workbench's preview_world)."""
    import random
    from team import Member, Team
    from workbench import Workbench
    rng = random.Random(seed)
    world = WorldStore()
    wild = WildernessEngine(DB, world.authored(), world.proposals())
    trainers = json.load(open(os.path.join(ENGINE, "canon", "trainers.json"), encoding="utf-8"))["trainers"]
    from trainers.model import Store
    store = Store()
    cases = []
    for vid, v in store.trainers["me"].versions.items():
        cases.append((v.game, [b.species for b in store.team(v)]))
    for game in GAMES:
        pool = [wild.ref.name(s) for s in range(1, TOP[rules.GAME_GEN[game]] + 1)]
        for _ in range(8):
            cases.append((game, rng.sample(pool, rng.randint(1, 6))))
    out = {"cases": [], "preview": None}
    for game, species in cases:
        rep = wild.team_report(Team(game, [Member(s) for s in species]))
        out["cases"].append({"game": game, "species": species,
                             "report": {"capabilities": rep["capabilities"], "scenarios": rep["scenarios"]}})
    hg = next(c for c in cases if c[0] == "heartgold")
    ids = [p["id"] for p in world.proposals()]
    rep = Workbench(DB).preview_world(Team(hg[0], [Member(s) for s in hg[1]]), ids)
    out["preview"] = {"game": hg[0], "species": hg[1], "ids": ids, "report": {"capabilities": rep["capabilities"], "scenarios": rep["scenarios"]}}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    return len(out["cases"])


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--parity":
        print("parity: %d teams" % parity(sys.argv[2]))
    else:
        main()
