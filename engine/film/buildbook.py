"""The builds book (docs/FILM.md): what a format's ladder actually runs, species by species.

Two sources, each doing what the other can't:
- **Smogon's monthly numbers** (film/usage.py): how common each Pokémon is, how often it leads, the team styles
  of the month, and per Pokémon the shares of its moves, items, abilities and spreads, its teammates, and the
  checks that beat it. They count every ladder battle but never say which moves went together.
- **Replays** (film/log.py, every replay cached for the format): real sets, the moves one Pokémon showed in one
  battle, clustered into variants (film/study.py). They show what goes together, on a smaller sample.

Each set is read through the role engine, given the field's spread that fits its role best, compared with the
closest archetype in the build library, and written out as a Showdown paste. Reference data, not canon: a set
reaches the build library only through a card you approve.
"""
import glob
import json
import os
import re

from film.log import parse
from film.replays import url_of
from film.usage import Names, best_spread, evs_line, fetch, fetch_text, species as usage_line
from trainers.model import Build

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)


def cached_records(cfg, fmt, base=ENGINE):
    """Every replay of a format in the cache (ladder and Smogon tournament games)."""
    d = os.path.join(base, cfg["store"]["raw"])
    out = []
    for path in sorted(glob.glob(os.path.join(d, f"{fmt}-*.json")) +
                       glob.glob(os.path.join(d, f"{cfg['sources']['tournament_prefix']}{fmt}-*.json"))):
        try:
            with open(path, encoding="utf-8") as fh:
                rec = json.load(fh)
        except ValueError:
            continue
        if rec.get("log"):
            out.append(rec)
    return out


def leads(path):
    """Smogon's leads file → {species: share of leads %}."""
    out = {}
    if not path or not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r"\|\s*\d+\s*\|\s*(.+?)\s*\|\s*([\d.]+)%", line.strip())
            if m:
                out[m.group(1)] = round(float(m.group(2)), 1)
    return out


def metagame(path):
    """Smogon's metagame file → ([(team style, % of teams)], mean stalliness)."""
    styles, stall = [], None
    if not path or not os.path.exists(path):
        return styles, stall
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r"([a-z]+)\.{2,}([\d.]+)%", line.strip())
            if m:
                styles.append((m.group(1), round(float(m.group(2)), 1)))
            m = re.match(r"Stalliness \(mean:\s*([-\d.]+)\)", line.strip())
            if m:
                stall = float(m.group(1))
    return styles, stall


def paste(s, gen):
    """A set as a Showdown paste (what the teambuilder and PKHeX's Showdown import read)."""
    lines = [s["species"] + (f" @ {s['item']}" if s.get("item") else "")]
    if gen >= 3 and s.get("ability"):
        lines.append(f"Ability: {s['ability']}")
    if gen >= 3 and s.get("evs"):
        lines.append(f"EVs: {evs_line(s['evs'])}")
    if gen >= 3 and s.get("nature"):
        lines.append(f"{s['nature']} Nature")
    lines += [f"- {m}" for m in s["moves"]]
    return "\n".join(lines)


def _read(reader, sp, s, game, skip=(), closest=True):
    """(role, name, roles that define it, extra): the set read through the role engine. A primary role in
    `skip` (one no spread can change, like setting sand) hands the spread fit to the secondary."""
    b = Build(id=f"book/{sp}", species=sp, moves=s["moves"], item=s.get("item"), ability=s.get("ability"),
              nature=s.get("nature"), evs=s.get("evs"))
    try:
        cl = reader.book.classify(b, game)
    except (KeyError, IndexError, ValueError):
        return None, None, [], None
    near = None
    if closest:
        try:
            near = reader.solver.distance(b, game)["line"]
        except (KeyError, IndexError, ValueError):
            near = None
    p, s2 = cl["primary"], cl["secondary"]
    strong = s2 and s2["score"] >= reader.book.cfg["confidence"]["strong_at_least"]
    name = p["name"] + (f", then {s2['name']}" if strong else "")
    defining = [r["role"] for r in (p, s2) if r and r["role"] not in skip and r["score"] > 0] or [p["role"]]
    return p["role"], name, defining, {"why": reader.book.line(cl, top=1), "closest": near}


def book(cfg, reader, fmt, month=None, cutoff=None, top=None, base=ENGINE):
    """The format's builds book: the month's numbers and every species' sets, as plain data for the page."""
    from film.study import Study, parse_replay
    fc = cfg["formats"][fmt]
    gen, game = fc["gen"], fc["game"]
    bc = cfg["book"]
    top = top or bc["species"]
    data = fetch(cfg, fmt, month, cutoff, base=base)
    month, cutoff = data["_month"], data["_cutoff"]
    names = Names(cfg, gen)
    lead_share = leads(fetch_text(cfg, "leads", fmt, month, cutoff, base))
    styles, stalliness = metagame(fetch_text(cfg, "metagame", fmt, month, cutoff, base))
    st = Study(reader, fmt, fc)
    for rec in cached_records(cfg, fmt, base):
        st.add(parse_replay(rec, reader, gen, cfg))
    film = st.result(top=top)
    film_sets = {c["species"]: c for c in film["sets"]}
    usage_rank = sorted(data["data"].items(), key=lambda x: -x[1]["usage"])
    rows = []
    for rank, (sp, _) in enumerate(usage_rank[:top], 1):
        line = usage_line(cfg, data, sp, names)
        if not line:
            continue
        sets = []
        for v in (film_sets.get(sp) or {}).get("variants", [])[:bc["sets_per_species"]]:
            if v["battles"] < bc["min_battles"] and sets:
                continue
            s = {"species": sp, "moves": v["moves"], "item": v["item"] or (line["items"][0][0] if line["items"] else None),
                 "ability": v["ability"] or (line["abilities"][0][0] if line["abilities"] else None),
                 "battles": v["battles"], "win_rate": v["win_rate"], "also": v["also"], "source": "replays",
                 "example": url_of(v["example"])}
            sets.append(s)
        standard = {"species": sp, "moves": [m for m, _ in line["moves"][:4]],
                    "item": line["items"][0][0] if line["items"] else None,
                    "ability": line["abilities"][0][0] if line["abilities"] else None, "source": "usage"}
        if not any(set(s["moves"]) == set(standard["moves"]) for s in sets):
            sets.append(standard)
        for s in sets:
            role, name, defining, extra = _read(reader, sp, s, game, bc["fit_skip_roles"], closest=gen < 3)
            s["role"], s["name"] = role, name or "too little seen to read"
            if gen >= 3 and role:
                fit = best_spread(reader.book, s, line["spreads"], game, gen, roles=defining)
                if fit:
                    s["nature"], s["evs"], s["spread_share"] = fit["nature"], fit["evs"], fit["share"]
                role, name, defining, extra = _read(reader, sp, s, game, bc["fit_skip_roles"])   # with the spread in
                s["role"], s["name"] = role, name or s["name"]
            s.update(extra or {})
            s["paste"] = paste(s, gen)
        rows.append({"species": sp, "rank": rank, "usage": line["usage"], "raw": line["raw"], "lead": lead_share.get(sp),
                     "moves": line["moves"], "items": line["items"], "abilities": line["abilities"],
                     "spreads": [{"nature": x["nature"], "evs": evs_line(x["evs"]), "share": x["share"]} for x in line["spreads"]]
                     if gen >= 3 else [],
                     "teammates": line["teammates"], "checks": line["checks"], "sets": sets,
                     "film_battles": (film_sets.get(sp) or {}).get("battles", 0)})
    return {"format": fmt, "label": fc["label"], "gen": gen, "game": game, "month": month, "cutoff": cutoff,
            "battles": data["info"]["number of battles"], "styles": styles[:bc["styles"]], "stalliness": stalliness,
            "leads": sorted(lead_share.items(), key=lambda x: -x[1])[:bc["leads"]],
            "replays": film["battles"], "tournament_games": film["tournament_games"], "species": rows,
            "sources": {"stats": cfg["usage"]["chaos"].format(month=month, fmt=fmt, cutoff=cutoff),
                        "leads": f"https://www.smogon.com/stats/{month}/leads/{fmt}-{cutoff}.txt",
                        "metagame": f"https://www.smogon.com/stats/{month}/metagame/{fmt}-{cutoff}.txt",
                        "replays": "https://replay.pokemonshowdown.com/"}}


def render(b, species=None):
    out = [f"{b['label']} · {b['month']}, rated {b['cutoff']}+ · {b['battles']:,} ladder battles · "
           f"{b['replays']} replays read ({b['tournament_games']} tournament)"]
    out.append("Team styles: " + ", ".join(f"{s} {p}%" for s, p in b["styles"]))
    out.append("Leads: " + ", ".join(f"{s} {p}%" for s, p in b["leads"]))
    for r in b["species"]:
        if species and r["species"].lower() not in {x.lower() for x in species}:
            continue
        out.append(f"\n#{r['rank']} {r['species']} · on {r['usage']}% of teams" + (f" · leads {r['lead']}%" if r["lead"] else ""))
        for s in r["sets"]:
            src = f"seen in {s['battles']} replays, won {s['win_rate']}%" if s["source"] == "replays" else "the ladder's most-used moves"
            out.append(f"  {s['name']} ({src})")
            out += ["    " + x for x in s["paste"].splitlines()]
            if s.get("closest"):
                out.append(f"    vs the library: {s['closest']}")
        out.append("  checks: " + ", ".join(f"{c['species']} {c['beats']}%" for c in r["checks"]))
        out.append("  teammates: " + ", ".join(r["teammates"]))
    return "\n".join(out)
