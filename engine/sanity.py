"""The engine audit (docs/SANITY.md): the engine's numbers and rules held against outside references, so a wrong
relationship shows up as a failed check instead of a strange line in a report.

    python3 -I sanity.py              # every check; prints a summary and writes docs/SANITY.md
    python3 -I sanity.py --fetch      # also downloads Smogon's moveset files it needs for the usage check
    python3 -I sanity.py stats film   # just some checks

| Check | Held against | What has to hold |
|---|---|---|
| stats | Smogon's damage calculator (battle/calc_bridge.mjs) | every fully evolved Pokémon of Gens 2-4, three levels, five spreads: the same stats |
| facts | sanity.json | known bulk reads, past base stats, types, abilities, item and move generations, learnable moves |
| legality | the games' data (trainers/model.py check) | every library build, every trainer team and every builds book set passes |
| film | the protocol itself | every cached replay: faints add up, knockouts go to the other side, one lead, at most 4 moves, legal abilities and items, a win is a wipe or a forfeit |
| usage | Smogon's own moveset file for the month | shares, raw counts, teammates and checks read from the chaos file match what Smogon printed |

Exits with status 1 when any check fails.
"""
import argparse
import collections
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
DOC = os.path.join(os.path.dirname(HERE), "docs", "SANITY.md")
STATS = ("hp", "atk", "def", "spa", "spd", "spe")
SPREADS = [
    ("default", None, {s: 31 for s in STATS}, {s: 85 for s in STATS}),
    ("physical max", "Adamant", {s: 31 for s in STATS}, {"hp": 4, "atk": 252, "def": 0, "spa": 0, "spd": 0, "spe": 252}),
    ("special wall", "Calm", {s: 31 for s in STATS}, {"hp": 252, "atk": 0, "def": 4, "spa": 0, "spd": 252, "spe": 0}),
    ("zero", "Quiet", {s: 0 for s in STATS}, {s: 0 for s in STATS}),
    ("odd", "Timid", {"hp": 30, "atk": 27, "def": 12, "spa": 9, "spd": 9, "spe": 30}, {"hp": 6, "atk": 0, "def": 0, "spa": 248, "spd": 248, "spe": 4}),
]
GAME_OF_GEN = {2: "crystal", 3: "emerald", 4: "platinum"}


def _calc(requests):
    proc = subprocess.run(["node", os.path.join(HERE, "battle", "calc_bridge.mjs")], input=json.dumps(requests),
                          capture_output=True, text=True, cwd=os.path.join(HERE, "battle"), check=True)
    return json.loads(proc.stdout)


def _calc_name(sp):
    return sp.replace("-", " ").title().replace("Mr Mime", "Mr. Mime").replace("Mime Jr", "Mime Jr.")


def check_stats(store, levels=(100, 50, 37), species=None):
    """Our stat formula against the calc's, for every fully evolved Pokémon of Gens 2-4 (or `species`)."""
    reqs, ours = [], []
    for gen in (2, 3, 4):
        for sp in species or store.era.fully_evolved(gen):
            for lvl in levels:
                for tag, nature, ivs, evs in SPREADS:
                    nat = nature if gen >= 3 else None
                    if gen <= 2:                               # one Special stat: the calc takes no other input
                        ivs, evs = dict(ivs, spd=ivs["spa"]), dict(evs, spd=evs["spa"])
                    try:
                        mine = store.era.stats(sp, gen, lvl, nat, ivs, evs)
                    except (KeyError, IndexError):
                        continue
                    reqs.append({"gen": gen, "stats": {"species": _calc_name(sp), "level": lvl, "nature": nat,
                                                       "ivs": ivs, "evs": evs}})
                    ours.append((gen, sp, lvl, tag, mine))
    out = {"compared": 0, "refused": 0, "mismatched": []}
    for (gen, sp, lvl, tag, mine), r in zip(ours, _calc(reqs)):
        if "error" in r:
            out["refused"] += 1                              # a name the calc spells differently
            continue
        out["compared"] += 1
        theirs = dict(r["stats"], hp=r["hp"])
        diff = {s: (mine[s], theirs[s]) for s in STATS if mine[s] != theirs[s]}
        if diff:
            out["mismatched"].append(f"Gen {gen} {sp} Lv {lvl} ({tag}): ours vs the calc {diff}")
    return out


def check_facts(store, path=os.path.join(HERE, "sanity.json")):
    from trainers.matrix import row
    from trainers.model import Build
    with open(path, encoding="utf-8") as fh:
        facts = json.load(fh)
    era, bad, n = store.era, [], 0
    for f in facts["bulk"]["facts"]:
        n += 1
        b = row(store, Build(id="sanity", species=f["species"], moves=["Tackle"]), f["game"])["bulk"]
        if ("is" in f and b["lean"] != f["is"]) or ("not" in f and b["lean"] == f["not"]):
            bad.append(f"{f['species']} ({f['game']}) reads {b['label']} (physical p{b['physical_pct']}, special "
                       f"p{b['special_pct']}); expected {'not ' + f['not'] if 'not' in f else f['is']}: {f['why']}")
    d = facts["data"]
    for f in d["base_stats"]:
        n += 1
        got = era.base_stats(f["species"], f["gen"])[f["stat"]]
        if got != f["value"]:
            bad.append(f"{f['species']} Gen {f['gen']} base {f['stat']} is {got}, should be {f['value']} ({f['why']})")
    for f in d["types"]:
        n += 1
        got = list(era.types(f["species"], f["gen"]))
        if got != f["types"]:
            bad.append(f"{f['species']} Gen {f['gen']} is {'/'.join(got)}, should be {'/'.join(f['types'])}")
    for f in d["abilities"]:
        n += 1
        got = list(era.abilities(f["species"], f["gen"]))
        if got != f["abilities"]:
            bad.append(f"{f['species']} Gen {f['gen']} abilities {got}, should be {f['abilities']} ({f['why']})")
    for f in d["item_gen"]:
        n += 1
        if era.item_gen(f["item"]) != f["gen"]:
            bad.append(f"{f['item']} dates to Gen {era.item_gen(f['item'])}, should be Gen {f['gen']}")
    for f in d["move_gen"]:
        n += 1
        if era.move_gen(f["move"]) != f["gen"]:
            bad.append(f"{f['move']} dates to Gen {era.move_gen(f['move'])}, should be Gen {f['gen']}")
    for f in d["learnable"]:
        n += 1
        basis = store.move_basis(Build(id="sanity", species=f["species"], moves=[f["move"]]), f["game"])[0]
        if basis["basis"] == "none":
            bad.append(f"{f['species']} can't learn {f['move']} by our data ({f['why']})")
    return {"compared": n, "mismatched": bad}


def book_data(path=os.path.join(os.path.dirname(HERE), "docs", "film", "builds_book.html")):
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        m = re.search(r'<script id="data" type="application/json">(.*?)</script>', fh.read(), re.S)
    return json.loads(m.group(1))["books"] if m else {}


def check_legality(store, books=None):
    """Every library build in its generation, every trainer team in its game, every builds book set."""
    from trainers.model import Build
    out = {"library": [], "teams": [], "book": [], "compared": 0}
    for bid, b in store.library.items():
        out["compared"] += 1
        out["library"] += [f"{bid}: {f}" for f in store.check(b, GAME_OF_GEN.get(b.generation or 4, "platinum"))]
    for tid, t in store.trainers.items():
        for v in t.versions.values():
            for b in store.team(v):
                out["compared"] += 1
                out["teams"] += [f"{tid}/{v.id} {b.species}: {f}" for f in store.check(b, v.game)]
    for fmt, bk in (books if books is not None else book_data()).items():
        g = bk["gen"]
        for r in bk["species"]:
            for s in r["sets"]:
                out["compared"] += 1
                b = Build(id="book", species=r["species"], moves=s["moves"], item=s.get("item"),
                          ability=s.get("ability") if g >= 3 else None, nature=s.get("nature") if g >= 3 else None,
                          evs=s.get("evs") if g >= 3 else None)
                out["book"] += [f"{fmt} {r['species']} ({s['source']}): {f}" for f in store.check(b, bk["game"])]
    out["mismatched"] = out["library"] + out["teams"] + out["book"]
    return out


def battle_rules(b, gen, era, gen2_only):
    """The rules one parsed battle has to keep. Returns [(rule, detail)]."""
    bad = []
    credited = lambda m: bool(m["fainted_by"]) and not m["fainted_by"].startswith("self") and m["fainted_by"].endswith(")")
    kos = sum(len(m["kos"]) for s in b["sides"].values() for m in s["members"])
    if kos != sum(credited(m) for s in b["sides"].values() for m in s["members"]):
        bad.append(("knockouts credited and faints credited differ", ""))
    for sid, s in b["sides"].items():
        foe = b["sides"]["p2" if sid == "p1" else "p1"]
        if sum(m["fainted_turn"] is not None for m in s["members"]) != s["fainted"]:
            bad.append(("fainted count and fainted members differ", sid))
        if len(s["members"]) > 6:
            bad.append(("more than six members", sid))
        if s["members"] and sum(t.get("in") == "lead" for m in s["members"] for t in m["stints"]) != 1:
            bad.append(("not exactly one lead", sid))
        lost = collections.Counter(m["species"] for m in foe["members"] if m["fainted_turn"] is not None)
        for m in s["members"]:
            for k in m["kos"]:
                if lost[k["target"]] <= 0:
                    bad.append(("a knockout on a Pokémon the other side didn't lose", f"{m['species']} → {k['target']}"))
                lost[k["target"]] -= 1
            if m["fainted_by"] == "unknown":
                bad.append(("a faint with no cause", m["species"]))
            own = [x for x in m["moves"] if x not in m.get("called", [])]
            if len(own) > 4 and "Transform" not in m["moves"] and m["species"] not in ("Ditto", "Smeargle", "Mew"):
                bad.append(("more than four moves of its own", f"{m['species']} {own}"))
            if m["ability"] and gen <= 2:
                bad.append(("an ability in Gen 2", f"{m['species']} {m['ability']}"))
            elif m["ability"] and m["ability"] != "Trace":
                try:
                    legal = era.abilities(m["species"], gen)
                except (KeyError, IndexError):
                    legal = None
                if legal is not None and m["ability"] not in legal:
                    bad.append(("an ability the species can't have", f"{m['species']} {m['ability']}"))
            if m["item"]:
                if gen >= 3 and m["item"] in gen2_only:
                    bad.append(("a Gen 2 item after Gen 2", f"{m['species']} {m['item']}"))
                elif (era.item_gen(m["item"]) or 0) > gen:
                    bad.append(("an item from a later generation", f"{m['species']} {m['item']}"))
            if m["hp"] is not None and not 0 <= m["hp"] <= 1:
                bad.append(("HP outside 0-100%", f"{m['species']} {m['hp']}"))
    if b["winner"] and not b["forfeit"]:
        loser = b["sides"]["p2" if b["winner"] == "p1" else "p1"]
        if loser["fainted"] < loser["teamsize"]:
            bad.append(("a win with the loser's Pokémon left and no forfeit", f"{loser['fainted']}/{loser['teamsize']}"))
    turns = [r["turn"] for r in b["rows"]]
    if turns != sorted(turns):
        bad.append(("actions out of turn order", ""))
    return bad


def check_film(store):
    """battle_rules over every cached replay."""
    from film.log import parse
    from film.replays import load_config
    cfg = load_config()
    gen2_only = set(store.config["validation"]["gen2_items"]["only"])
    out, causes, n = collections.defaultdict(list), collections.Counter(), 0
    for path in sorted(glob.glob(os.path.join(HERE, cfg["store"]["raw"], "*.json"))):
        try:
            with open(path, encoding="utf-8") as fh:
                rec = json.load(fh)
        except ValueError:
            continue
        m = re.match(r"(?:smogtours-)?gen(\d)", rec.get("id", ""))
        if not rec.get("log") or not m:
            continue
        gen = int(m.group(1))
        b = parse(rec["log"], {"id": rec["id"]}, cfg["state"], None, cfg["actions"]["called_from"])
        n += 1
        for s in b["sides"].values():
            for mem in s["members"]:
                if mem["fainted_by"]:
                    c = mem["fainted_by"]
                    causes["by a foe" if c.endswith(")") and not c.startswith("self") else c] += 1
        for rule, detail in battle_rules(b, gen, store.era, gen2_only):
            out[rule].append(f"{rec['id']} {detail}".strip())
    return {"compared": n, "causes": causes.most_common(), "rules": dict(out),
            "mismatched": [f"{k}: {len(v)} ({', '.join(v[:3])})" for k, v in out.items()]}


def check_usage(fetch=False):
    """Our reading of the chaos file against Smogon's printed moveset file, for every cached month and format."""
    from film.replays import load_config
    from film.usage import Names, fetch_text, published, species
    cfg = load_config()
    d = os.path.join(HERE, cfg["store"]["usage"])
    out = {"compared": 0, "formats": [], "mismatched": []}
    for path in sorted(glob.glob(os.path.join(d, "*-*-*.json"))):
        m = re.match(r"(\d{4}-\d{2})-(gen\d\w+)-(\d+)\.json$", os.path.basename(path))
        if not m or m.group(3) == "0":
            continue
        month, fmt, cutoff = m.group(1), m.group(2), int(m.group(3))
        text = os.path.join(d, f"{month}-moveset-{fmt}-{cutoff}.txt")
        if not os.path.exists(text):
            if not fetch:
                continue
            text = fetch_text(cfg, "moveset", fmt, month, cutoff)
            if not text:
                continue
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        names, pub = Names(cfg, int(fmt[3])), published(text)
        out["formats"].append(f"{fmt} {month} {cutoff}+")
        for sp, P in pub.items():
            ours = species(cfg, data, sp, names)
            out["compared"] += 1
            if not ours:
                out["mismatched"].append(f"{fmt} {sp}: Smogon prints it; we don't read it")
                continue
            if P.get("raw") != ours["raw"]:
                out["mismatched"].append(f"{fmt} {sp}: raw count {ours['raw']} vs {P.get('raw')}")
            for sec, key in (("Items", "items"), ("Moves", "moves"), ("Abilities", "abilities")):
                mine = dict(ours[key])
                for k, v in P.get(sec, []):
                    if k in mine and abs(mine[k] - v) > 0.06:
                        out["mismatched"].append(f"{fmt} {sp} {k}: {mine[k]}% vs Smogon's {v}%")
            for (k, v), s in zip(P.get("Spreads", []), ours["spreads"]):
                if abs(s["share"] - v) > 0.06:
                    out["mismatched"].append(f"{fmt} {sp} spread {k}: {s['share']}% vs Smogon's {v}%")
            theirs = [k for k, _ in P.get("Teammates", [])][:5]
            if theirs != ours["teammates"][:5]:
                out["mismatched"].append(f"{fmt} {sp} teammates {ours['teammates'][:5]} vs Smogon's {theirs}")
            checks = [k for k, *_ in P.get("Checks and Counters", [])]
            if checks[:len(ours["checks"])] != [c["species"] for c in ours["checks"]][:len(checks)]:
                out["mismatched"].append(f"{fmt} {sp} checks {[c['species'] for c in ours['checks']]} vs Smogon's {checks[:4]}")
    return out


CHECKS = {"stats": lambda st, a: check_stats(st), "facts": lambda st, a: check_facts(st),
          "legality": lambda st, a: check_legality(st), "film": lambda st, a: check_film(st),
          "usage": lambda st, a: check_usage(a.fetch)}
TITLES = {"stats": "Stats against Smogon's calc", "facts": "Known facts (sanity.json)",
          "legality": "Legality: library, teams, builds book", "film": "Film: rules on every cached replay",
          "usage": "Usage: our reading against Smogon's moveset file"}


def write_doc(results, path=DOC):
    import datetime
    out = [f"# Engine audit ({datetime.date.today().isoformat()})", "",
           "*`engine/sanity.py` holds the engine's numbers and rules against outside references: Smogon's damage "
           "calculator, the games' data, the Showdown protocol and Smogon's own printed statistics. A check that "
           "fails is a bug to fix, not a line to reword. The fixes from the first audit are E-037 in "
           "DECISION_LEDGER.md.*", "", "| Check | Compared | Problems |", "|---|---|---|"]
    for k, r in results.items():
        out.append(f"| {TITLES[k]} | {r['compared']:,} | {len(r['mismatched']) or 'none'} |")
    for k, r in results.items():
        out += ["", f"## {TITLES[k]}", ""]
        if k == "stats":
            out.append(f"{r['compared']:,} stat lines compared ({r['refused']} the calc couldn't name).")
        if k == "usage":
            out.append("Formats: " + (", ".join(r["formats"]) or "none cached (run with --fetch)") + ".")
        if k == "film":
            out.append("What every faint was put down to: " + ", ".join(f"{c} {n}" for c, n in r["causes"]) + ".")
        out += [f"- {m}" for m in r["mismatched"][:40]] or ["- Everything holds."]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("checks", nargs="*", help=f"any of {', '.join(CHECKS)} (default: all)")
    ap.add_argument("--fetch", action="store_true", help="download Smogon's moveset files the usage check needs")
    ap.add_argument("--no-doc", action="store_true")
    a = ap.parse_args(argv)
    unknown = [c for c in a.checks if c not in CHECKS]
    if unknown:
        ap.error(f"unknown check {', '.join(unknown)}; pick from {', '.join(CHECKS)}")
    from trainers.model import Store
    store = Store()
    results = {}
    for k in a.checks or CHECKS:
        results[k] = CHECKS[k](store, a)
        r = results[k]
        print(f"{TITLES[k]}: {r['compared']:,} compared, {len(r['mismatched'])} problems")
        for m in r["mismatched"][:10]:
            print("   -", m)
    if not a.no_doc and not a.checks:
        print("wrote", write_doc(results))
    return 1 if any(r["mismatched"] for r in results.values()) else 0


if __name__ == "__main__":
    sys.exit(main())
