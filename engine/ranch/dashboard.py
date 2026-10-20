"""Blackthorn, all in one place (docs/BLACKTHORN.md): the export the Canon DB Sheet and its dashboard are built from.

One JSON file, data_manifest/blackthorn.json, joins every part of the present-day ranch (D-042):
- **the journey:** the six chapters in story order, their thesis, status and lock, and each companion's sprite;
- **the ranch:** the census (who could live where, on what land), the sites, the facilities and who staffs them,
  the jobs nobody holds and the ones that hang on one Pokémon (ranch/planner.py);
- **the Glasshouse:** its rooms, the egg schedule in laps of the hatching loop, the crop plan (ranch/hatchery.py);
- **the breeding program:** each target line, the chain that builds its stud and what's kept (D-038);
- **the studbook:** every individual with sire, dam, generation and inherited moves, and the rule check
  (breeding/lineage.py); each companion's breeding roles, the best fathers and the tinkering menu
  (breeding/studbook.py);
- **the record:** the decision ledger's decisions and evidence, the locks, the authored world records, and the
  open questions (canon/questions.json).

Derived, never hand-edited: rebuild it with `python3 -I ranch/dashboard.py`.
"""
import datetime
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)
ROOT = os.path.dirname(ENGINE)
DB = os.path.join(ENGINE, "data", "pokeref.sqlite")
OUT = os.path.join(ENGINE, "data_manifest", "blackthorn.json")
SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/"
SPRITE_SET = {"crystal": "versions/generation-ii/crystal/", "firered": "versions/generation-iii/firered-leafgreen/",
              "emerald": "versions/generation-iii/emerald/", "platinum": "versions/generation-iv/platinum/",
              "soulsilver": "versions/generation-iv/heartgold-soulsilver/",
              "heartgold": "versions/generation-iv/heartgold-soulsilver/"}
GAME_NAME = {"crystal": "Crystal", "firered": "FireRed", "emerald": "Emerald", "platinum": "Platinum",
             "soulsilver": "SoulSilver", "heartgold": "HeartGold"}
THESIS_LINE = {"crystal": "first bonds, care before competence", "firered": "heroic clarity, ambition",
               "emerald": "\"We learned how to live out here.\"", "platinum": "\"Every turn you survive is a mistake.\"",
               "soulsilver": "\"We've been here before.\"", "heartgold": "\"Nothing you do matters.\""}


def sprite(ref, species, game="heartgold"):
    """The species' sprite from its own game (Crystal's Gen 2 art, Platinum's Gen 4), by national dex number."""
    try:
        n = ref.species_id(species)
    except KeyError:
        return None
    return SPRITES + SPRITE_SET.get(game, SPRITE_SET["heartgold"]) + f"{n}.png"


def ledger(path=os.path.join(ROOT, "docs", "DECISION_LEDGER.md")):
    """The ledger's decision and evidence rows as records (the Markdown table is the source)."""
    decisions, evidence = [], []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            cells = [c.strip() for c in re.split(r"(?<!\\)\|", line.strip())[1:-1]]
            if not cells:
                continue
            if re.match(r"D-\d{3}$", cells[0]) and len(cells) >= 6:
                text = cells[2]
                m = re.search(r"\*\*(.+?)\*\*", text)
                decisions.append({"id": cells[0], "date": cells[1], "title": (m.group(1) if m else text)[:160],
                                  "text": re.sub(r"\*\*|\*", "", text).replace("\\|", "|"), "area": cells[3],
                                  "status": re.sub(r"\*", "", cells[4]), "who": re.sub(r"\*", "", cells[5])})
            elif re.match(r"E-\d{3}$", cells[0]) and len(cells) >= 3:
                evidence.append({"id": cells[0], "text": re.sub(r"\*\*|`", "", cells[1]).replace("\\|", "|"),
                                 "status": cells[2]})
    decisions.sort(key=lambda d: d["id"])
    evidence.sort(key=lambda e: e["id"])
    return decisions, evidence


def build():
    from breeding.lineage import Lineage
    from breeding.studbook import Studbook
    from ranch.hatchery import Hatchery
    from ranch.planner import RanchPlanner
    planner = RanchPlanner(DB)
    ref = planner.ref
    census = planner.census()
    glass = Hatchery(planner).report()
    lin = Lineage(DB)
    rows = lin.individuals()
    issues = lin.check(rows)
    book = Studbook(DB)
    roles = {r["companion"]: r for r in book.roles()}
    with open(os.path.join(ENGINE, "canon", "rosters.json"), encoding="utf-8") as fh:
        rosters = json.load(fh)
    with open(os.path.join(ENGINE, "canon", "world.json"), encoding="utf-8") as fh:
        world = json.load(fh)["records"]
    with open(os.path.join(ENGINE, "canon", "questions.json"), encoding="utf-8") as fh:
        questions = json.load(fh)["questions"]
    decisions, evidence = ledger()

    chapters = []
    for ch in sorted(rosters["chapters"], key=lambda c: c["order"]):
        locked = ch["status"] == "locked" or ch["game"] == "heartgold"
        chapters.append({"order": ch["order"], "game": ch["game"], "name": GAME_NAME[ch["game"]],
                         "thesis": ch["thesis"], "line": THESIS_LINE[ch["game"]], "status": ch["status"],
                         "decision": ch.get("decision"), "locked": locked,
                         "roster": [{"species": sp, "sprite": sprite(ref, sp, ch["game"])} for sp in ch["roster"]]})

    home = {rid: site for site, ids in census["sites"].items() for rid in ids}
    profiles = census["profiles"]
    zones = {rid: z for z, ids in census["zones_primary"].items() for rid in ids}
    sizes = {rid: s for s, ids in census["sizes"].items() for rid in ids}
    jobs_of = {}
    for fname, f in census["facilities"].items():
        for job, who in f["pokemon"].items():
            for w in who:
                jobs_of.setdefault(w.split(" (")[0], set()).add(f"{fname}: {job.replace('_', ' ')}")
    residents = []
    for r in census["residents"]:
        p = profiles.get(r["id"])
        p = p if isinstance(p, dict) else vars(p) if p is not None else {}
        game = r["game"]
        groups = [g for g in ref.breeding_groups(r["species"])]
        role = roles.get(r["id"], {})
        residents.append({
            "id": r["id"], "species": r["species"], "chapter": GAME_NAME.get(game, game),
            "kind": "stud" if r["role"] == "stud" else "companion", "fate": r["fate"],
            "site": "Blackthorn (HQ)" if home.get(r["id"]) == census["headquarters"] else "satellite (Sevii Islands or Battle Zone)",
            "land": (zones.get(r["id"]) or (p.get("zones") or ["—"])[0]).replace("_", " & "),
            "size": sizes.get(r["id"], p.get("size")), "climate": p.get("climate"), "water": p.get("water"),
            "native": p.get("native_region"), "egg_groups": [n for g in groups for n in [_group(g)]],
            "jobs": sorted(jobs_of.get(r["species"], [])), "breeding_roles": role.get("roles", []),
            "sprite": sprite(ref, r["species"], game if game in SPRITE_SET else "heartgold")})

    facilities = []
    for fname, f in census["facilities"].items():
        facilities.append({"name": fname, "access": f["access"], "people": f["people"],
                           "staffed": {j.replace("_", " "): w for j, w in f["pokemon"].items()},
                           "open_jobs": [j.replace("_", " ") for j in f["open_jobs"]],
                           "hangs_on_one": {j.replace("_", " "): w for j, w in f["single_species"].items()},
                           "story_candidates": {j.replace("_", " "): w for j, w in f.get("story_candidates", {}).items()}})

    program = []
    by_id = {r["id"]: r for r in rows}
    for p in census["breeding_program"]:
        sp = p["target"].split(":")[1]
        stud = by_id.get(f"S-{''.join(ch for ch in sp.upper() if ch.isalnum())}")
        chain = p["fathers_used"] + ([f"{sp} stud"] if p["kept"]["kind"] == "stud" else [])
        program.append({"target": f"{GAME_NAME[p['game']]} {sp}", "species": sp, "game": GAME_NAME[p["game"]],
                        "egg_moves": p["moves"], "fathers_used": p["fathers_used"], "chain": chain,
                        "steps": len(p["fathers_used"]) if p["kept"]["kind"] == "stud" else 0,
                        "kept": "stud ♂ knowing " + ", ".join(p["kept"]["knows"]) if p["kept"]["kind"] == "stud"
                        else "a Light Ball (no father needed)" if p["kept"]["kind"] == "item" else p["kept"]["note"],
                        "hatches_as": stud["hatched_as"] if stud else None, "stud_id": stud["id"] if stud else None,
                        "status": "planned", "done": 0, "timing": p["timing"], "source": p["source"],
                        "sprite": sprite(ref, sp, p["game"])})

    for r in rows:
        r["sprite"] = sprite(ref, r.get("hatched_as") or r["species"])
        r["check"] = "; ".join(why for i, why in issues if i == r["id"]) or "ok"

    gens = max((r.get("generation") or 0) for r in rows)
    open_jobs = sorted({j for f in facilities for j in f["open_jobs"]})
    single = sorted({f"{w.split(' (')[0]}: {j}" for f in facilities for j, w in f["hangs_on_one"].items()})
    locks = [{"what": "HeartGold's six", "detail": ", ".join(c["species"] for c in chapters[-1]["roster"]),
              "decision": "D-006", "rule": "Claude refuses to write to it without a reopen decision"}]
    locks += [{"what": d["title"], "detail": d["area"], "decision": d["id"], "rule": "locked decision"}
              for d in decisions if d["status"].upper().startswith("LOCKED") and d["id"] != "D-006"]
    kpis = {"residents": len(residents), "at_hq": sum(r["site"].startswith("Blackthorn") for r in residents),
            "at_satellite": sum(not r["site"].startswith("Blackthorn") for r in residents),
            "companions": sum(r["kind"] == "companion" for r in residents),
            "studs": sum(r["kind"] == "stud" for r in residents), "lines": len(program),
            "individuals": len(rows), "generations": gens + 1, "rule_issues": len(issues),
            "facilities": len(facilities), "open_jobs": len(open_jobs), "single_points": len(single),
            "open_questions": len(questions), "decisions": len(decisions), "world_records": len(world)}
    return {"built": datetime.date.today().isoformat(), "kpis": kpis, "chapters": chapters,
            "rival": rosters.get("rival"), "residents": residents, "sites": census["sites"],
            "satellite_options": census["satellite_options"], "zones": {z: len(v) for z, v in census["zones_primary"].items()},
            "egg_group_pens": {g: sorted(v) for g, v in census["egg_group_pens"].items()},
            "facilities": facilities, "open_jobs": open_jobs, "single_points": single,
            "staff_proposals": census["staff_proposals"], "glasshouse": glass, "program": program,
            "lineage": rows, "lineage_issues": [{"id": i, "why": w} for i, w in issues],
            "fathers": [{"father": f, "moves": n, "lines": m} for f, n, m in book.leaderboard()],
            "breeding_roles": list(roles.values()), "decisions": decisions, "evidence": evidence, "locks": locks,
            "world": world, "questions": questions}


def _group(g):
    from ranch.planner import EGG_GROUP_NAMES
    return EGG_GROUP_NAMES.get(g, g)


def main():
    data = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1, ensure_ascii=False)
    k = data["kpis"]
    print(f"Blackthorn: {k['residents']} residents ({k['at_hq']} at HQ), {k['lines']} lines, {k['individuals']} in the "
          f"studbook over {k['generations']} generations, {k['rule_issues']} rule issues, {k['open_jobs']} open jobs, "
          f"{k['open_questions']} open questions -> {OUT}")


if __name__ == "__main__":
    main()
