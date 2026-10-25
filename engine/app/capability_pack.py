"""capability.json: the capability records and everything that reads them, for the Survival Lab, the Homestead and the
profiles (web/34_capability.html, 93_survival.html).

    python3 -I app/capability_pack.py                 # engine/app/data/capability.json (export.py runs it)
    python3 -I app/capability_pack.py --parity OUT    # Python's assessments on a fixed grid, for app/test_capability_parity.mjs

- model: the capability definitions, areas, classes, standings, move uses, the field policy and the provisions
  standard (capability/model.json); kit, scenarios and facilities (capability/*.json);
- games: every species' records in each journey game (capability/records.py), compact: each game lists a species'
  rows by number; `rows` holds every distinct record once as [capability, kind, source, detail, extra], and
  `sources` every distinct text once;
- facts: body size, Pokédex shape, height, weight and whether it's legendary or mythical; abilities per generation (for a build's own ability);
- world: canon/world.json's records about your Pokémon, by individual;
- field: each game's field moves with their machine and badge (data_manifest/field_functions.json, read from the
  games' code), and each one's power for the slot cost.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

import rules  # noqa: E402
from capability import assess  # noqa: E402
from capability.records import GAMES, KINDS, TOP, CapabilityRecords, load  # noqa: E402
from trainers.model import DB  # noqa: E402
from wilderness.engine import FIELD_MOVES, GAME_FIELD_MOVES  # noqa: E402

OUT = os.path.join(HERE, "data", "capability.json")
FIELD_TABLE = os.path.join(ENGINE, "data_manifest", "field_functions.json")
PRESENT_GAME = "heartgold"     # the ranch is the present day at Blackthorn (D-042, D-044; ranch/planner.py)


def field_table():
    """{game: {move: {machine, badge, requires, does, source}}} from the games' code, when it has been read."""
    if not os.path.exists(FIELD_TABLE):
        return {}, []
    with open(FIELD_TABLE, encoding="utf-8") as fh:
        data = json.load(fh)
    out = {}
    for game, rows in data.get("games", {}).items():
        out[game] = {r["move"]: {k: (None if k == "badge" and str(r.get(k) or "").lower() in ("", "none", "-", "–") else r.get(k))
                                 for k in ("machine", "badge", "requires", "does", "source")} for r in rows}
    if "heartgold" in out:
        out.setdefault("soulsilver", out["heartgold"])
    return out, data.get("gaps", [])


def pack():
    cr = CapabilityRecords(DB)
    sources, ix = [], {}

    def s(text):
        if text is None:
            return None
        if text not in ix:
            ix[text] = len(sources)
            sources.append(text)
        return ix[text]

    games, facts, abilities, rows_ix, rows_list = {}, {}, {"3": {}, "4": {}}, {}, []

    def row(r):                      # every distinct record once; a game's species list points at them
        k = json.dumps(r, ensure_ascii=False, separators=(",", ":"))
        if k not in rows_ix:
            rows_ix[k] = len(rows_list)
            rows_list.append(r)
        return rows_ix[k]
    for game in GAMES:
        gen = rules.GAME_GEN[game]
        recs = {}
        for sid in range(1, TOP[gen] + 1):
            name = cr.ref.name(sid)
            try:
                rows = cr.records(name, game)
            except (KeyError, IndexError):
                continue
            out = []
            for r in rows:
                k = r["kind"]
                extra = ([r["move"], r["route"]] + ([r["note"]] if r.get("note") else []) if k == "move" else
                         r["ability"] if k == "ability" else [r["rule"], r["equipment"], r["limitations"]] if k == "gear" else
                         r.get("limitations") if k == "shape" else None)
                out.append(row([r["cap"], k, s(r["source"]), s(r["detail"]), extra]))
            recs[name] = out
            if name not in facts:
                f = cr.facts(name)
                facts[name] = [f["size"], f["shape"], f["h"], f["w"], 1 if f["legendary"] else 0]
            if gen >= 3 and name not in abilities[str(gen)]:
                abilities[str(gen)][name] = rules.abilities(gen, name)
        games[game] = {"records": recs}
    field, gaps = field_table()
    move_bp = {}
    for gen in (2, 3, 4):
        move_bp[str(gen)] = {}
        for mv in FIELD_MOVES:
            try:
                move_bp[str(gen)][mv] = rules.move(gen, mv).get("bp") or 0
            except KeyError:
                pass
    model = load("model.json")
    return {"_note": "Built by app/capability_pack.py from capability/ (the model, kit, scenarios, facilities and records) and "
                     "canon/world.json. Evidence classes and statuses are kept apart (MASTER_PLAN §3.2).",
            "model": model, "kinds": {k: list(v) for k, v in KINDS.items()}, "kit": load("kit.json")["items"],
            "scenarios": load("scenarios.json")["scenarios"], "facilities": load("facilities.json")["facilities"],
            "field": field, "field_gaps": gaps, "field_moves": {g: sorted(GAME_FIELD_MOVES[g]) for g in GAMES},
            "field_does": {k: v[1] for k, v in FIELD_MOVES.items()}, "move_bp": move_bp,
            "gen": {g: rules.GAME_GEN[g] for g in GAMES}, "games": games, "facts": facts, "abilities": abilities,
            "world": CapabilityRecords.world(), "rows": rows_list, "sources": sources, "present_game": PRESENT_GAME}


def main():
    data = pack()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(r) for g in data["games"].values() for r in g["records"].values())
    print(f"{OUT}: {n} records ({len(data['rows'])} distinct) over {sum(len(g['records']) for g in data['games'].values())} species-games, "
          f"{len(data['scenarios'])} scenarios, {len(data['facilities'])} facilities, {os.path.getsize(OUT) // 1024} KB")


# --- parity ---------------------------------------------------------------------------------------------------
def members_of(builds, individuals):
    """Your individuals as members: their builds' moves and ability, their own id for world records."""
    out = []
    for iid, ind in sorted(individuals.items()):
        b = builds.get(ind.get("build") or "", {})
        out.append({"species": ind["species"], "ind": iid, "moves": b.get("moves"), "ability": b.get("ability"),
                    "label": ind.get("nickname") or ind["species"], "game": ind["game"]})
    return out


def parity(path):
    data = assess.load_pack(OUT)
    with open(os.path.join(ENGINE, "store", "out", "builds.json"), encoding="utf-8") as fh:
        builds = json.load(fh)
    with open(os.path.join(ENGINE, "store", "out", "individuals.json"), encoding="utf-8") as fh:
        individuals = json.load(fh)
    builds = builds.get("builds", builds)
    individuals = individuals.get("individuals", individuals)
    mine = members_of(builds, individuals)
    by_game = {}
    for m in mine:
        by_game.setdefault(m["game"], []).append(m)
    cases = []
    scen = [s["id"] for s in data["scenarios"]]
    kits = [[], ["tent", "stove", "lantern", "potion"], ["pack-harness", "tool-kit", "dynamo", "water-filter", "cold-gear"]]
    previews = [[], [w["id"] for w in data["world"] if w["status"] == "proposed"]]
    for gi, (game, team) in enumerate(sorted(by_game.items())):
        team = team[:6]
        species_only = [{"species": m["species"], "label": m["species"]} for m in team]
        for si, sc in enumerate(scen):
            kit = kits[(gi + si) % len(kits)]
            pv = previews[si % 2]
            cases.append({"fn": "world", "args": [game, sc, team, kit, pv], "want": assess.world_report(data, game, sc, team, kit, pv)})
            if si % 3 == 0:
                cases.append({"fn": "world", "args": [game, sc, species_only, kit, pv],
                              "want": assess.world_report(data, game, sc, species_only, kit, pv)})
        cases.append({"fn": "cartridge", "args": [game, team, None], "want": assess.cartridge_report(data, game, team)})
        cases.append({"fn": "cartridge", "args": [game, species_only, None], "want": assess.cartridge_report(data, game, species_only)})
        sc = scen[gi % len(scen)]
        cases.append({"fn": "cartridge", "args": [game, team, next(s for s in data["scenarios"] if s["id"] == sc)["field_moves"]],
                      "want": assess.cartridge_report(data, game, team, next(s for s in data["scenarios"] if s["id"] == sc)["field_moves"])})
        pool = [m for g, t in sorted(by_game.items()) for m in t if m not in team[:5]][:24] + \
               [{"species": sp, "label": sp} for sp in list(data["games"][game]["records"])[:40:3]]
        cases.append({"fn": "recommend", "args": [game, sc, team[:5], kits[1], [], pool],
                      "want": assess.recommend(data, game, sc, team[:5], kits[1], [], pool)})
        other = [{"species": m["species"], "label": m["species"], "moves": None} for m in team[::-1]]
        a = {"members": team, "kit": kits[1], "label": "Journey"}
        b = {"members": other[:4], "kit": kits[2], "label": "Lighter"}
        cases.append({"fn": "compare", "args": [game, sc, a, b], "want": assess.compare(data, game, sc, a, b)})
    for fi, fac in enumerate(data["facilities"]):
        staff = [dict(m, need=None if j % 2 else fac["requirements"][j % len(fac["requirements"])]["id"]) for j, m in enumerate(mine[fi % 5::5][:4])]
        pv = previews[fi % 2]
        cases.append({"fn": "facility", "args": [fac["id"], staff, mine, pv], "want": assess.facility_report(data, fac["id"], staff, mine, pv)})
        a = {"staff": staff, "label": "Plan A"}
        b = {"staff": [dict(m, need=None) for m in mine[(fi + 2) % 7::7][:3]], "label": "Plan B"}
        cases.append({"fn": "compare_staff", "args": [fac["id"], a, b, pv], "want": assess.compare_staff(data, fac["id"], a, b, pv)})
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"cases": cases}, fh, ensure_ascii=False)
    return len(cases)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--parity":
        print("parity: %d cases" % parity(sys.argv[2]))
    else:
        main()
