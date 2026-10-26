"""Blackthorn HQ, the web app (docs/APP.md): the data it reads, exported from every engine.

The app runs in Google Apps Script and can't run the Python engines, so the engines write what each page needs
here, compact, as JSON files the app's launcher reads from Drive. Editable things (the studbook, egg walks, plantings,
readings, feedings, the journal, your calls) live in the Canon DB Sheet instead, and the app reads and writes them
live.

    hq.json        the champion, the journey, the party, the estate, the Glasshouse, the program, the studbook,
                   the record (decisions, evidence, world records, questions) — the home and breeder pages
    scouting.json  every trainer report (docs/trainers/data): team, matrix, sliders, the plan, the playsheet
    atlas.json     every species of Gens 1-4: types, base stats, abilities, egg groups, genus, habitat, size,
                   evolution, a Pokédex entry
    builds.json    the build library with role reads; natures, characteristics, moves and the type chart for the
                   Lab; the ladder's sets per Gen 2-4 OU (the builds book)
    learnsets.json every species' moves in any game up to Gen 4, by move index (the Lab's legality check, D-048)
    journal.json   the research journal: Pokédex field notes, ingested observations, lore, verified mechanics

    scout.json     the scouting engine pack: what the browser's port of the report engine reads (app/scout_pack.py)
    field.json     the wilderness engine's evidence for every species and game (app/field_pack.py)
    advance*.json  the battle engine's Journey Scouting File as its last Python run left it, one lineup per file
                   (app/advance_pack.py)
    battle.json, calc.json   the battle engine pack and Smogon's damage calculator, so the browser runs the battle
                   engine itself (app/battle_pack.py)
    engines.json, inbox.json   the Engine Room and the intake inbox (app/room_pack.py)
    breeder.json   every line's egg moves with the breeding engine's lineages (app/breeder_pack.py, a few seconds)
    breeding.json  the breeding-stock engine's data for the browser's copy (app/breeding_pack.py, web/23_stock.html)
    library.json   the Trainer Library: every trainer and version, evidence, lenses, collections (app/library_pack.py)
    equipment.json the Poké Ball collection and the equipment library, each generation's catch numbers (app/equipment_pack.py)
    capability.json   the capability records, kit, scenarios and facilities for the Survival Lab and the Homestead
                   (app/capability_pack.py)
    biology.json, dossiers.json, ecology.json, ecotypes.json, ranges.json   Field Biology (app/biology_pack.py)

    python3 -I app/export.py               # writes engine/app/data/*.json and prints their sizes
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
ROOT = os.path.dirname(ENGINE)
sys.path.insert(0, ENGINE)
OUT = os.path.join(HERE, "data")
DB = os.path.join(ENGINE, "data", "pokeref.sqlite")
STATS = ("hp", "atk", "def", "spa", "spd", "spe")
GAME_NAME = {"crystal": "Crystal", "firered": "FireRed", "emerald": "Emerald", "platinum": "Platinum",
             "soulsilver": "SoulSilver", "heartgold": "HeartGold"}


def dump(name, obj):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def jsonl(path):
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


# --- atlas ----------------------------------------------------------------------------------------------------
def atlas(store):
    era, ref = store.era, store.era.ref
    flavor_pref = ["heartgold", "soulsilver", "platinum", "pearl", "diamond", "emerald", "firered", "leafgreen",
                   "ruby", "sapphire", "crystal", "gold", "silver"]
    rows = []
    for sid in range(1, 494):
        name = ref.name(sid)
        try:
            types = list(era.types(name, 4))
            base = era.base_stats(name, 4)
            abil = era.abilities(name, 4)
        except (KeyError, IndexError):
            continue
        sp = ref.q("SELECT evolves_from_species_id, habitat_id, gender_rate, hatch_counter, generation_id, has_gender_differences "
                   "FROM pokemon_species WHERE id=?", sid)[0]
        forms = {i.split("-", 1)[1]: int(p) for p, i in ref.q("SELECT id, identifier FROM pokemon WHERE species_id=? AND CAST(id AS INT) "
                                                              "BETWEEN 10001 AND 10015", sid)}
        habitat = ref.q("SELECT identifier FROM pokemon_habitats WHERE id=?", sp[1]) if sp[1] else []
        genus = ref.q("SELECT genus FROM pokemon_species_names WHERE pokemon_species_id=? AND local_language_id=9", sid)
        size = ref.q("SELECT height, weight FROM pokemon WHERE id=?", sid)[0]
        texts = {v: t for t, v in ref.q("""SELECT f.flavor_text, v.identifier FROM pokemon_species_flavor_text f
            JOIN versions v ON v.id=f.version_id WHERE f.species_id=? AND f.language_id=9""", sid)}
        game = next((g for g in flavor_pref if g in texts), None)
        text = " ".join(str(texts[game]).replace("\x0c", " ").split()) if game else ""
        text = re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).capitalize(), text).replace("POKéMON", "Pokémon")
        groups = [g for s in ref.family(sid) for g in ref.egg_groups(s)]
        rows.append({"n": sid, "name": name, "t": types, "b": [base[s] for s in STATS], "ab": abil,
                     "eg": sorted({_group(g) for g in groups if g != "no-eggs"}) or ["No Eggs"],
                     "gr": int(sp[2]), "cyc": int(sp[3]), "gen": int(sp[4]),
                     "from": int(sp[0]) if sp[0] else None, "hab": habitat[0][0] if habitat else None,
                     "genus": genus[0][0] if genus else "", "h": int(size[0]) / 10, "w": int(size[1]) / 10,
                     "dex": text, "dexg": game, **({"gd": 1} if str(sp[5]) == "1" else {}), **({"forms": forms} if forms else {})})
    return {"species": rows}


def _group(g):
    from ranch.planner import EGG_GROUP_NAMES
    return EGG_GROUP_NAMES.get(g, g.replace("-", " ").title())


# --- builds and the lab ------------------------------------------------------------------------------------------
def builds(store):
    from trainers.roles import RoleBook
    era, ref = store.era, store.era.ref
    book = RoleBook(store)
    GAME_OF = {2: "crystal", 3: "emerald", 4: "platinum"}
    library = []
    for bid, b in store.library.items():
        gen = b.generation or 4
        game = GAME_OF.get(gen, "platinum")
        try:
            cl = book.classify(b, game)
            p, s2 = cl["primary"], cl["secondary"]
            read = p["name"] + (f", then {s2['name']}" if s2 and s2["score"] >= book.cfg["confidence"]["strong_at_least"] else "")
            why = book.line(cl, top=1)
        except (KeyError, IndexError, ValueError):
            read, why = None, None
        stats, lvl, used = store.stats(b, game)
        library.append({"id": bid, "sp": b.species, "name": b.name or bid, "gen": gen, "mv": b.moves, "item": b.item,
                        "ab": b.ability, "nat": b.nature, "ev": b.evs, "iv": b.ivs, "src": b.source, "tier": b.tier,
                        "role": read, "why": why, "lv": lvl, "notes": b.notes[:3] if b.notes else [],
                        "flags": store.check(b, game)})
    natures = []
    flav = {1: "spicy", 2: "dry", 3: "sweet", 4: "bitter", 5: "sour"}      # flavour ids = contest types (cool…tough)
    stat_id = {2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe"}
    for ident, up, down, likes, hates in ref.q("SELECT identifier, increased_stat_id, decreased_stat_id, "
                                                "likes_flavor_id, hates_flavor_id FROM natures"):
        natures.append({"name": ident.capitalize(), "up": stat_id.get(int(up)) if up != down else None,
                        "down": stat_id.get(int(down)) if up != down else None,
                        "likes": flav.get(int(likes)) if likes else None, "hates": flav.get(int(hates)) if hates else None})
    chars = []
    for stat, mod, text in ref.q("""SELECT c.stat_id, c.gene_mod_5, t.message FROM characteristics c
            JOIN characteristic_text t ON t.characteristic_id=c.id AND t.local_language_id=9"""):
        chars.append({"stat": {1: "hp", 2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe"}[int(stat)], "mod": int(mod),
                      "text": text})
    moves = []
    for mid, ident in ref.q("SELECT id, identifier FROM moves WHERE CAST(generation_id AS INT)<=4 ORDER BY CAST(id AS INT)"):
        name = ref.move_name(int(mid))
        try:
            mi = era.move_info(name, 4)
        except (KeyError, IndexError):
            continue
        moves.append({"id": int(mid), "name": name, "t": mi["type"], "c": mi["class"], "p": mi["power"],
                      "a": mi["accuracy"], "pr": mi.get("priority", 0), "e": mi.get("effect") or ""})
    types = list(era.chart(4))
    chart = [[era.multiplier(a, (d,), 4) for d in types] for a in types]
    ladder = {}
    html_path = os.path.join(ROOT, "docs", "film", "builds_book.html")
    if os.path.exists(html_path):
        with open(html_path, encoding="utf-8") as fh:
            m = re.search(r'<script id="data" type="application/json">(.*?)</script>', fh.read(), re.S)
        for fmt, bk in json.loads(m.group(1))["books"].items() if m else []:
            ladder[fmt] = {"label": bk["label"], "gen": bk["gen"], "month": bk["month"], "cutoff": bk["cutoff"],
                           "battles": bk["battles"], "styles": bk["styles"], "leads": bk["leads"][:8],
                           "species": [{"sp": r["species"], "rank": r["rank"], "use": r["usage"], "lead": r["lead"],
                                        "checks": [[c["species"], c["beats"]] for c in r["checks"][:4]],
                                        "mates": r["teammates"][:5], "items": r["items"][:3], "moves": r["moves"][:6],
                                        "sets": [{"name": s["name"], "role": s.get("role"), "mv": s["moves"],
                                                  "item": s.get("item"), "ab": s.get("ability"), "nat": s.get("nature"),
                                                  "ev": [s["evs"].get(k, 0) for k in STATS] if s.get("evs") else None,
                                                  "n": s.get("battles"), "win": s.get("win_rate"),
                                                  "src": s["source"]} for s in r["sets"]]}
                                       for r in bk["species"]]}
    return {"library": library, "natures": natures, "characteristics": chars, "moves": moves, "types": types,
            "chart": chart, "ladder": ladder}


def learnsets(store):
    """Every species' moves in any game up to Gen 4 (and its pre-evolutions' egg moves), as move ids."""
    ref = store.era.ref
    vgs = [int(r[0]) for r in ref.q("SELECT id FROM version_groups WHERE CAST(generation_id AS INT)<=4")]
    marks = ",".join("?" * len(vgs))
    out = {}
    for sid in range(1, 494):
        stages = ref.line(sid)
        ids = set()
        for st in stages:
            ids |= {int(r[0]) for r in ref.q(f"SELECT DISTINCT move_id FROM pokemon_moves WHERE pokemon_id=? "
                                             f"AND version_group_id IN ({marks})", st, *vgs)}
        out[sid] = sorted(ids)
    return out


# --- scouting: every trainer report ---------------------------------------------------------------------------------
VERDICT = {"immune": "i", "resists": "r", "neutral": "n", "weak": "w", "very weak": "W"}


def scouting():
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, "docs", "trainers", "data", "*.json"))):
        d = load(path)
        m, ps = d["matrix"], d.get("playsheet", {})
        roles = {r["species"]: r for r in ps.get("roles", [])}
        team = []
        for r in m["rows"]:
            ro = roles.get(r["species"], {})
            team.append({"sp": r["species"], "nick": r.get("nickname"), "t": r["types"], "ab": r["ability"],
                         "lv": r["level"], "mv": r["moves"], "stats": r["stats"], "bulk": r["bulk"]["label"],
                         "lean": r["bulk"]["lean"],
                         "cells": "".join(VERDICT[r["cells"][t]["verdict"]] for t in m["types"]),   # one letter a type
                         "role": (ro.get("primary") or {}).get("name"), "why": ro.get("why"),
                         "flags": r.get("flags", [])})
        s = m["summary"]
        lines = lambda key: [x["text"] for x in (ps.get("text", {}).get(key) or [])]
        out.append({"id": os.path.basename(path)[:-5], "trainer": d["trainer"], "name": d["trainer_name"],
                    "version": d["version"], "title": d["title"], "game": d["game"], "gen": d["gen"],
                    "status": d.get("status"), "notes": d.get("notes", []), "mine": d["trainer"] == "me",
                    "sliders": {k: {"authored": v.get("authored"), "measured": v.get("measured"), "why": v.get("why"),
                                    "poles": v.get("poles"), "disagreement": v.get("disagreement"),
                                    "signals": [{"label": x["label"], "value": x["value"]} for x in v.get("signals", [])]}
                                for k, v in d["sliders"].items()},
                    "tags": [t["name"] for t in d.get("tags", [])], "types": m["types"], "team": team,
                    "gaps": s["gaps"], "strengths": s["strengths"], "bring": s["bring"], "soft": s["soft"],
                    "plan": {k: [x["text"] for x in v] for k, v in d.get("plan", {}).items()},
                    "play": {k: lines(k) for k in ("career", "ace", "go_to", "coverage", "combos", "signature",
                                                   "aggression")},
                    "ace": (ps.get("ace") or {}).get("derived"), "aggr": (ps.get("aggression") or {}).get("ratio"),
                    "ladder": ps.get("ladder_lines", []), "film": ps.get("film", [])[:8],
                    "clashes": [c.get("text") or str(c) for c in d.get("nature_clashes", [])]})
    return {"reports": out}


# --- the journal ----------------------------------------------------------------------------------------------------
def journal(bt):
    canon = os.path.join(ENGINE, "canon")
    out = []
    # Ingested notes aren't yours: a fan work's claims are world-building, anything else sourced is research
    # (docs/design/DATA_CONTRACT.md). A field note is a fan work when its source is a lore card marked fan_work.
    lore = list(jsonl(os.path.join(canon, "lore.jsonl")))
    fan = {(r.get("source_ref") or "").split(" @")[0] for r in lore if r.get("fan_work")}
    def sourced(is_fan):
        return "world-building" if is_fan else "research"
    for r in jsonl(os.path.join(canon, "field_notes.jsonl")):
        ref = (r.get("source_ref") or "").split(" @")[0]
        out.append({"kind": "official" if r.get("canon") else sourced(ref in fan), "sp": r.get("species"),
                    "aspect": r.get("aspect"), "text": r.get("note"), "src": r.get("source_ref") or r.get("source"),
                    "on": r.get("approved_on")})
    for r in lore:
        out.append({"kind": sourced(r.get("fan_work")), "sp": r.get("subject"),
                    "aspect": "lore", "text": r.get("fact"), "src": r.get("source_ref") or r.get("source"),
                    "on": r.get("approved_on")})
    for e in bt["evidence"]:
        out.append({"kind": "verified mechanic", "sp": None, "aspect": "mechanics", "text": e["text"], "src": e["status"],
                    "on": None, "id": e["id"]})
    return {"entries": out}


# --- the HQ: home and breeder pages -----------------------------------------------------------------------------------
def hq(store, bt):
    sys.path.insert(0, os.path.join(ENGINE, "store"))
    import assumptions                    # store/assumptions.json: what the assistant assumed, for Your calls
    with open(os.path.join(ENGINE, "canon", "builds.json"), encoding="utf-8") as fh:
        builds_ = json.load(fh)
    world = bt["world"]
    party_species = next(c for c in bt["chapters"] if c["game"] == "heartgold")["roster"]
    era = store.era
    party = []
    for m in party_species:
        sp = m["species"]
        b = builds_.get("heartgold", {}).get(sp, {})
        res = next((r for r in bt["residents"] if r["id"] == f"heartgold:{sp}"), {})
        role = next((r for r in bt["breeding_roles"] if r["companion"] == f"heartgold:{sp}"), {})
        party.append({"sp": sp, "n": era.ref.species_id(sp), "t": list(era.types(sp, 4)), "b": b,
                      "life": [{"id": w["id"], "cap": w["capability"].replace("_", " "), "say": w["statement"],
                                "status": w["status"]} for w in world if w["species"] == sp and w["game"] == "heartgold"],
                      "res": {k: res.get(k) for k in ("land", "size", "climate", "water", "native", "egg_groups", "jobs")},
                      "breeding": role.get("roles", []), "lineage": f"HG-{''.join(ch for ch in sp.upper() if ch.isalnum())}"})
    trainers = load(os.path.join(ENGINE, "canon", "trainers.json"))
    me = (trainers.get("trainers") or trainers)["me"]
    lineage = [{k: r.get(k) for k in ("id", "name", "species", "hatched_as", "sex", "generation", "sire", "dam", "moves",
                                      "inherited", "role", "origin", "fate", "status", "program", "check", "note")}
               for r in bt["lineage"]]
    return {"built": bt["built"], "kpis": bt["kpis"],
            "champion": {"name": me.get("name", "Zack"), "title": "Champion, retired · breeder · Blackthorn",
                         "versions": [{"id": v.get("id"), "game": v.get("game"), "title": v.get("title")}
                                      for v in (me.get("versions") or {}).values()] if isinstance(me.get("versions"), dict) else [],
                         "philosophy": "Breeding is mastery and inheritance, not an IV factory. An egg move has to earn its slot.",
                         "frame": "The journey is over; every companion is retired. The present is the ranch."},
            "chapters": bt["chapters"], "rival": bt["rival"], "party": party,
            "sites": load(os.path.join(ENGINE, "canon", "ranch.json"))["sites"],
            "satellite": bt["satellite_options"], "zones": bt["zones"],
            "pens": {g: len(v) for g, v in bt["egg_group_pens"].items()},
            "residents": [{k: r[k] for k in ("id", "species", "chapter", "kind", "site", "land", "size", "climate",
                                             "water", "native", "egg_groups", "jobs", "breeding_roles")}
                          for r in bt["residents"]],
            "facilities": [{"name": f["name"], "access": f["access"], "people": f["people"],
                            "staff": {j: sorted({w.split(" (")[0] for w in who}) for j, who in f["staffed"].items()},
                            "evidence": f["staffed"], "open": f["open_jobs"],
                            "one": {j: w.split(" (")[0] for j, w in f["hangs_on_one"].items()},
                            "story": {j: [w.split(" (")[0] for w in v] for j, v in f["story_candidates"].items()}}
                           for f in bt["facilities"]],
            "glasshouse": {"name": bt["glasshouse"]["name"], "status": bt["glasshouse"]["status"],
                           "idea": bt["glasshouse"]["idea"],
                           "rooms": {n: {"staff": {j.replace("_", " "): sorted({w.split(" (")[0] for w in who})
                                                   for j, who in r["pokemon"].items()},
                                         "open": [j.replace("_", " ") for j in r["open_jobs"]],
                                         "one": {j.replace("_", " "): w.split(" (")[0] for j, w in r["single_species"].items()},
                                         "people": r["people"]}
                                     for n, r in bt["glasshouse"]["rooms"].items()},
                           "eggs": bt["glasshouse"]["eggs"], "crops": bt["glasshouse"]["crops"]},
            "program": [{k: p[k] for k in ("target", "species", "game", "egg_moves", "fathers_used", "steps", "kept",
                                           "hatches_as", "stud_id", "status", "timing", "source")} for p in bt["program"]],
            "lineage": lineage, "fathers": bt["fathers"],
            "tinker": [{"c": r["companion"], "roles": r["roles"], "menu": r.get("tinker_menu") or {},
                        "as_father": r["as_father"]} for r in bt["breeding_roles"]],
            "questions": bt["questions"], "world": world, "assumptions": assumptions.load(),
            "decisions": [{k: d[k] for k in ("id", "date", "title", "area", "status", "who")} for d in bt["decisions"]],
            "locks": bt["locks"], "single_points": bt["single_points"], "open_jobs": bt["open_jobs"],
            "staff_hires": bt["staff_proposals"]}


def store_pack():
    """store.json: the three-tier record store (engine/store/out, built by store/migrate.py) for the four labs."""
    src = os.path.join(ENGINE, "store", "out")
    if not os.path.isdir(src):
        return
    out = {}
    for name in ("builds", "individuals", "teams", "lines"):
        path = os.path.join(src, f"{name}.json")
        if os.path.exists(path):
            d = load(path)
            out[name] = d[name]
            if name == "builds":
                out["aliases"] = d.get("aliases", {})
                out["versions"] = d.get("versions", {})
    prop = os.path.join(ENGINE, "store", "proposed_lines.json")
    if os.path.exists(prop):
        out["proposed_lines"] = load(prop)["lines"]
    dump("store.json", out)


def main(breeder=False):
    from trainers.model import Store
    store = Store()
    bt = load(os.path.join(ENGINE, "data_manifest", "blackthorn.json"))
    sizes = {"hq.json": dump("hq.json", hq(store, bt)), "scouting.json": dump("scouting.json", scouting()),
             "atlas.json": dump("atlas.json", atlas(store)), "builds.json": dump("builds.json", builds(store)),
             "learnsets.json": dump("learnsets.json", learnsets(store)), "journal.json": dump("journal.json", journal(bt))}
    for k, v in sizes.items():
        print(f"{k:16} {v / 1024:7.1f} KB")
    print(f"{'total':16} {sum(sizes.values()) / 1024:7.1f} KB -> {OUT}")
    # the engines the app runs live or reads whole: each pack is its own module and can be run alone
    store_pack()
    rec = load(os.path.join(ENGINE, "trainers", "recognition.json"))                     # the badge rules (29_recognition)
    cal = os.path.join(ENGINE, "data_manifest", "recognition_calibration.json")
    if os.path.exists(cal):
        rec["calibration"] = load(cal)
    dump("recognition.json", rec)
    words = os.path.join(ROOT, "docs", "naming", "proposed_words.json")   # v2: the generated name proposals (trainers/naming_list.py)
    if os.path.exists(words):
        dump("naming.json", load(words))
    import advance_pack
    import battle_pack
    import breeding_pack
    import explain_pack
    explain_pack.main()
    breeding_pack.main()
    import library_pack
    library_pack.main()
    import equipment_pack
    equipment_pack.main()
    import capability_pack
    capability_pack.main()
    import biology_pack                  # Field Biology (v1): the field guide, dossiers, ecology, ecotypes, ranges
    biology_pack.main()
    import field_pack
    import room_pack
    import scout_pack
    scout_pack.main()
    field_pack.main()
    advance_pack.main()
    battle_pack.pack()
    room_pack.main()
    import breeder_pack                  # seconds since the search moved to breeding/stock.py; --breeder is kept, unneeded
    breeder_pack.main()
    import fresh                         # the fresh start (D-078): the personal layer out of every pack, while it's on
    for name, gone in fresh.apply().items():
        print(f"fresh start: {name}: " + (", ".join(f"{k} {v}" for k, v in gone.items() if v) or "nothing personal"))


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    main(breeder="--breeder" in sys.argv)
