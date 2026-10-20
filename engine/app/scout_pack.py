"""The scouting engine pack (docs/APP.md, "The Scouting Lab"): what the browser needs to run the trainer report itself.

The app's Scouting Lab rebuilds a report every time you change a slider, a move, a member or a threshold. It runs the
report engine in JavaScript (app/web/25_scout.html), a line-for-line port of trainers/report.py, matrix.py,
sliders.py, roles.py and playsheet.py, so this file writes the data those modules read from the database and canon,
in the shape the port reads:

    config, roles, phrases     trainers/config.json, roles.json, phrases.json as they are
    chart                      each generation's type chart (the attacking types in the era's order)
    species                    every species and form: per generation its types, base stats and abilities
    fully_evolved              each generation's fully evolved species (the field the percentiles read)
    moves                      every move as each generation had it (type, class, power, accuracy, priority, target,
                               drain, meta, whether the user faints, stat changes, ailment, hits)
    move_gen, items, natures   when a move or item first appears; item names; what each nature raises and lowers
    trainers                   every trainer and version with its team resolved to builds (lineups and cartridge
                               teams included), plus each build's move reasons as the engine reads them
    observed, ladder           what's on film for each version; each species' line in Smogon's monthly stats

    python3 -I app/scout_pack.py      # writes engine/app/data/scout.json
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

from trainers.era import GAME_GEN, STATS, _CORRECTIONS  # noqa: E402
from trainers.model import DB, Store  # noqa: E402

GENS = (2, 3, 4)


def live(d):
    """A config section without its notes, all the way down (the port doesn't read them)."""
    if isinstance(d, dict):
        return {k: live(v) for k, v in d.items() if not k.startswith("_")}
    if isinstance(d, list):
        return [live(v) for v in d]
    return d


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def species_entry(era, name):
    out = {}
    for g in GENS:
        try:
            base = era.base_stats(name, g)
            out[g] = {"t": list(era.types(name, g)), "b": [base[s] for s in STATS], "ab": list(era.abilities(name, g))}
        except (KeyError, IndexError):
            continue
    try:
        sg = era.species_gen(name)
    except (KeyError, IndexError):
        sg = None
    return {"g": out, "sg": sg}


def move_entry(era, name, gen):
    i = era.move_info(name, gen)
    return [i["type"], i["class"], i["power"], i["accuracy"], i["priority"], i["target"], i["drain"], i["meta"],
            "user faints" in i["effect"].lower(), i["stat_changes"], i["ailment"], list(i["hits"]) if i["hits"] else None]


def build_dict(b):
    d = b.to_dict()
    d["id"] = b.id
    return d


def pack(store=None):
    store = store or Store()
    era, ref = store.era, store.era.ref
    out = {"config": live(store.config), "roles": live(load(os.path.join(ENGINE, "trainers", "roles.json"))),
           "phrases": live(load(os.path.join(ENGINE, "trainers", "phrases.json"))), "games": GAME_GEN}
    # the type charts, attacking types in the era's own order (the matrix's columns)
    out["chart"] = {}
    for g in GENS:
        ch = era.chart(g)
        types = list(ch)
        out["chart"][g] = {"types": types, "m": [[ch[a][d] for d in types] for a in types]}
    out["fully_evolved"] = {g: [ref.name(ref.species_id(sp)) for sp in era.fully_evolved(g)] for g in GENS}
    # trainers and their teams, resolved
    from trainers.playsheet import observed
    trainers, names, move_names, item_names = {}, set(), set(), set()
    basis = {}
    for tid, t in store.trainers.items():
        versions = {}
        for vid, v in t.versions.items():
            team = store.team(v)
            for b in team:
                names.add(b.species)
                move_names.update(b.moves)
                if b.item:
                    item_names.add(b.item)
                basis[f"{b.id}|{v.game}"] = {"basis": store.move_basis(b, v.game), "flags": store.check(b, v.game)}
            versions[vid] = {"title": v.title, "game": v.game, "team_ref": v.team_ref, "sliders": v.sliders,
                             "roles": v.roles, "source": v.source, "status": v.status, "overrides": v.overrides,
                             "notes": v.notes, "signature_moves": v.signature_moves, "team": [build_dict(b) for b in team],
                             "observed": observed(store, v)}
        trainers[tid] = {"name": t.name, "notes": t.notes, "career": t.career, "versions": versions}
    out["trainers"] = trainers
    out["basis"] = basis
    for b in store.library.values():
        names.add(b.species)
        move_names.update(b.moves)
        if b.item:
            item_names.add(b.item)
    out["library"] = {i: build_dict(b) for i, b in store.library.items()}
    # species: every default species of Gens 1-4, the field's slugs, and every form a team names
    for sid in range(1, 494):
        names.add(ref.name(sid))
    for g in GENS:
        names.update(out["fully_evolved"][g])
    out["species"] = {}
    for n in sorted(names):
        e = species_entry(era, n)
        if e["g"]:
            out["species"][n] = e
    # moves, as each generation had them
    all_moves = [r[0] for r in ref.q("SELECT n.name FROM moves m JOIN move_names n ON n.move_id=m.id AND "
                                     "n.local_language_id=9 WHERE CAST(m.generation_id AS INT)<=4 AND CAST(m.id AS INT)<10000")]
    move_names.update(all_moves)
    out["move_gen"], out["moves"] = {}, {g: {} for g in GENS}
    for name in sorted(move_names):
        try:
            out["move_gen"][name] = era.move_gen(name)
        except KeyError:
            continue
        for g in GENS:
            if out["move_gen"][name] <= g:
                try:
                    out["moves"][g][name] = move_entry(era, name, g)
                except (KeyError, IndexError):
                    pass
    # items: every spelling the builds and the config use, and every item the games index up to Gen IV
    cfg_items = set()
    for grp in out["roles"]["item_groups"].values():
        if isinstance(grp, list):
            cfg_items.update(grp)
    sig = store.config["signals"]
    cfg_items.update(sig["rigidity"]["choice"]["items"])
    cfg_items.update(sig["risk"]["risky"]["items"])
    rows = ref.q("SELECT DISTINCT n.name FROM item_names n JOIN item_game_indices g ON g.item_id=n.item_id "
                 "WHERE n.local_language_id=9 AND CAST(g.generation_id AS INT)<=4")
    out["items"] = {}
    idx = {}
    for name, g, i in ref.q("SELECT n.name, CAST(g.generation_id AS INT), CAST(g.game_index AS INT) FROM item_names n "
                            "JOIN item_game_indices g ON g.item_id=n.item_id WHERE n.local_language_id=9 AND CAST(g.generation_id AS INT)<=4"):
        idx.setdefault(name, {})[int(g)] = int(i)
    for name in sorted({r[0] for r in rows} | item_names | cfg_items):
        english = era.item_name(name)
        out["items"][name] = [english, era.item_gen(name), idx.get(english, {})]
    out["natures"] = {}
    for (ident,) in ref.q("SELECT identifier FROM natures"):
        up, down = era.nature(ident)
        out["natures"][ident.capitalize()] = [up, down]
    out["type_forms"] = _CORRECTIONS["type_forms"]["species"]
    out["ladder"] = ladder(store, names)
    return out


def ladder(store, names):
    """{gen: {species: the playsheet's ladder row and its line}} for every species in each format's cached month."""
    from film.replays import load_config as film_config
    from film.usage import Names, line_for
    from trainers.playsheet import ladder_lines
    cfg = store.config["ladder"]
    fc = film_config()
    out = {}
    for g in GENS:
        fmt = fc["usage"]["formats_by_gen"].get(str(g))
        if not fmt:
            continue
        try:
            nm = Names(fc, g)
        except (OSError, KeyError):
            continue
        rows = {}
        for sp in sorted(names):
            try:
                line = line_for(fc, fmt, sp, nm, cfg["cutoffs"], cfg["min_raw"])
            except (OSError, KeyError, ValueError):
                line = None
            if not line:
                continue
            row = {"species": sp, "usage": line["usage"], "format": fmt, "month": line["month"], "cutoff": line["cutoff"],
                   "moves": [m for m, _ in line["moves"][:4]], "item": line["items"][0][0] if line["items"] else None,
                   "spread": line["spreads"][0] if line["spreads"] else None, "checks": line["checks"][:cfg["checks"]]}
            rows[sp] = {"row": row, "line": ladder_lines([row])[0]}
        out[g] = rows
    return out


def main():
    data = pack()
    path = os.path.join(HERE, "data", "scout.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"scout.json {os.path.getsize(path) / 1024:.1f} KB: {len(data['species'])} species, "
          f"{len(data['moves'][4])} Gen IV moves, {sum(len(t['versions']) for t in data['trainers'].values())} versions")




def parity(path, variants=3, seed=7):
    """For the tests: Python's report for every version, plus `variants` random edits of each (sliders, roles, a
    member swapped for another species with moves it can learn, natures, EVs, items, the reading level), written with
    the edits themselves so the browser's engine can rebuild the same variants."""
    import random
    from trainers.model import Build, Trainer, Version
    from trainers.report import build_report, exposure
    store = Store()
    rng = random.Random(seed)
    era = store.era
    out = {"reports": {}, "variants": [], "exposure": {}}
    for tid, t in list(store.trainers.items()):
        for vid in t.versions:
            out["reports"][f"{tid}/{vid}"] = build_report(store, tid, vid)
    items = ["Leftovers", "Choice Band", "Choice Specs", "Life Orb", "Focus Sash", "Lum Berry", "Expert Belt", "Light Ball",
             "Choice Scarf", "Black Sludge", None]
    natures = list(load(os.path.join(HERE, "data", "scout.json"))["natures"]) if os.path.exists(os.path.join(HERE, "data", "scout.json")) else ["Adamant"]
    roles = list(store.config["tags"]["roles"])
    n = 0
    for tid, t in list(store.trainers.items()):
        for vid, v in list(t.versions.items()):
            team = store.team(v)
            gen = GAME_GEN[v.game]
            for k in range(variants):
                n += 1
                sliders = {s: {"value": rng.randint(0, 100), "why": "fuzz"} for s in ("offense", "rigidity", "bond", "risk") if rng.random() < 0.8}
                new = []
                for i, b in enumerate(team):
                    d = build_dict(b)
                    d["id"] = f"fuzz{n}/{i}"
                    if rng.random() < 0.35:
                        sp = rng.choice(store.era.fully_evolved(gen))
                        name = era.ref.name(era.ref.species_id(sp))
                        pool = era.learnable(name, v.game)
                        d = {"id": d["id"], "species": name, "moves": rng.sample(pool, min(4, len(pool))), "source": "fuzz"}
                    if gen >= 3 and rng.random() < 0.5:
                        d["nature"] = rng.choice(natures)
                    if rng.random() < 0.4:
                        stats = rng.sample(list(STATS), 3)
                        d["evs"] = {s: (252 if j < 2 else 4) for j, s in enumerate(stats)}
                    if rng.random() < 0.4:
                        it = rng.choice(items)
                        d["item"] = it
                        if it is None:
                            d.pop("item", None)
                    if rng.random() < 0.2:
                        d["friendship"] = rng.randint(0, 255)
                    if rng.random() < 0.2:
                        d["nickname"] = "Fuzz"
                    new.append(d)
                if rng.random() < 0.3 and len(new) > 1:
                    new.pop(rng.randrange(len(new)))
                level = rng.choice([None, None, 50, 75])
                vroles = rng.sample(roles, rng.randint(0, 2))
                key = f"fuzz{n}"
                lib = {}
                for d in new:
                    fields = {k2: v2 for k2, v2 in d.items() if k2 != "id"}
                    lib[d["id"]] = Build(id=d["id"], **fields)
                store.library.update(lib)
                ver = Version(id=key, trainer=key, title=v.title + " (variant)", game=v.game, team_ref={"builds": list(lib)},
                              sliders=sliders, roles=vroles, source=v.source, status=v.status, overrides={}, notes=[],
                              signature_moves=v.signature_moves)
                store.trainers[key] = Trainer(id=key, name=t.name, versions={key: ver}, notes=t.notes, career=t.career)
                rep = build_report(store, key, key, level=level)
                out["variants"].append({"base": f"{tid}/{vid}", "sliders": sliders, "roles": vroles, "team": new, "level": level,
                                        "report": rep})
    for mine in [("me", "heartgold"), ("me", "platinum")]:
        for theirs in [("cynthia", "champion-platinum"), ("lance", "champion-hgss"), ("red", "mt-silver")]:
            out["exposure"][f"{mine[0]}/{mine[1]}|{theirs[0]}/{theirs[1]}"] = exposure(store, mine, theirs)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, default=lambda o: sorted(o) if isinstance(o, (set, frozenset)) else str(o))
    return len(out["reports"]), len(out["variants"])


def specimen_parity(path):
    """For the tests: specimen.py's card, Showdown set and Batch Editor script for a spread of specimens."""
    from specimen import Lab, Specimen
    lab = Lab(DB)
    cases = [dict(species="Tyranitar", game="heartgold", level=50, nature="Jolly", ability="Sand Stream", gender="M", moves=["Dragon Dance", "Crunch"], item="Lum Berry",
                  ivs={"hp": 31, "atk": 31, "def": 30, "spa": 12, "spd": 31, "spe": 31}, evs={"atk": 252, "spe": 252, "hp": 4}, tid=12345, sid=54321, friendship=255, ball="Friend", ot_name="Zack"),
             dict(species="Gengar", game="platinum", level=100, nature="Timid", gender="F", shiny=True, tid=1, sid=2, moves=["Shadow Ball"], ivs={"atk": 2}, evs={"spa": 252, "spe": 252}),
             dict(species="Pikachu", game="emerald", level=81, nature="Hasty", gender="F", moves=["Volt Tackle"], item="Light Ball", tid=40000, sid=1000, met_level=5, contest={"cool": 255}),
             dict(species="Feraligatr", game="crystal", level=50, dvs={"atk": 14, "def": 13, "spe": 15, "spc": 15}, stat_exp={"hp": 65535, "atk": 40000}, moves=["Surf"], gender="M", item="Leftovers"),
             dict(species="Mew", game="soulsilver", level=100, nature="Modest", moves=["Psychic"], ivs={"hp": 30, "atk": 2, "def": 30, "spa": 30, "spd": 30, "spe": 30}),
             dict(species="Snorlax", game="firered", level=100, nature="Careful", ability="Thick Fat", moves=["Curse", "Rest"], tid=7, sid=7)]
    out = []
    for c in cases:
        sp = Specimen(**c)
        card = lab.derive(sp)
        out.append({"input": c, "card": card, "showdown": lab.showdown(sp, card), "batch": lab.batch_script(sp, card)})
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    return len(out)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--specimens":
        print("specimens: %d" % specimen_parity(sys.argv[2]))
    elif len(sys.argv) > 2 and sys.argv[1] == "--parity":
        print("parity: %d reports, %d variants" % parity(sys.argv[2]))
    else:
        main()
