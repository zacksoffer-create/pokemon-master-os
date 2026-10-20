"""The field's monthly numbers (docs/FILM.md): Smogon's published usage statistics for a format, the part of real
play a replay never shows.

Every month Smogon publishes, per format and rating cutoff, what the ladder's teams carried (smogon.com/stats, the
"chaos" JSON). It's statistics about real play, cited as such:
- each Pokémon's share of teams, its EV spreads and natures, items, abilities and moves (shares of its sets);
- its teammates (how much more often a Pokémon appears beside it than chance);
- its checks and counters: for each opponent, how often the matchup ends with this Pokémon knocked out or forced
  out (Smogon's own score is that share less four standard deviations).

Here it fills what replays can't: a film variant's likely spread (the field's top spreads for the species, the one
the role engine says fits the variant's role best), and the answers to a trainer's Pokémon in real play.
Files are cached in data/raw/smogon_stats exactly as Smogon serves them.
"""
import json
import os
import re
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
STATS = ("hp", "atk", "def", "spa", "spd", "spe")


class Unavailable(Exception):
    """Smogon doesn't publish that month, format or cutoff (or can't be reached)."""


def _get(cfg, url):
    req = urllib.request.Request(url, headers={"User-Agent": cfg["sources"]["user_agent"]})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise Unavailable(f"smogon.com answered {e.code} for {url}") from None
    except (urllib.error.URLError, OSError) as e:
        raise Unavailable(f"can't reach smogon.com ({getattr(e, 'reason', e)}): allow it in the environment's "
                          "network settings") from None


def latest_month(cfg):
    idx = _get(cfg, cfg["usage"]["index"]).decode("utf-8", "replace")
    months = sorted(set(re.findall(r'href="(\d{4}-\d{2})/"', idx)))
    if not months:
        raise Unavailable("no months listed on smogon.com/stats")
    return months[-1]


def fetch(cfg, fmt, month=None, cutoff=None, base=ENGINE):
    u = cfg["usage"]
    month = month or latest_month(cfg)
    cutoff = cutoff if cutoff is not None else u["cutoff"]
    path = os.path.join(base, cfg["store"]["usage"], f"{month}-{fmt}-{cutoff}.json")
    if not os.path.exists(path):
        raw = _get(cfg, u["chaos"].format(month=month, fmt=fmt, cutoff=cutoff))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(raw)
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    data["_month"], data["_cutoff"], data["_path"] = month, cutoff, os.path.relpath(path, base)
    return data


def fetch_text(cfg, kind, fmt, month, cutoff, base=ENGINE):
    """One of Smogon's text files for the month ('leads', 'metagame' or 'moveset'), cached beside the chaos file. Its path,
    or None when Smogon doesn't publish it."""
    path = os.path.join(base, cfg["store"]["usage"], f"{month}-{kind}-{fmt}-{cutoff}.txt")
    if not os.path.exists(path):
        try:
            raw = _get(cfg, cfg["usage"]["text"].format(kind=kind, month=month, fmt=fmt, cutoff=cutoff))
        except Unavailable:
            return None
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(raw)
    return path


SECTIONS = ("Abilities", "Items", "Spreads", "Moves", "Teammates", "Checks and Counters")


def published(path):
    """Smogon's moveset file (the text one) → {species: {raw, Abilities: [(name, %)], …, Checks and Counters:
    [(name, score, mean, sd)]}}. What Smogon itself prints from the same month, for checking our reading of the chaos
    file against (engine/sanity.py)."""
    with open(path, encoding="utf-8") as fh:
        cells = [m.group(1).strip() for m in (re.match(r"\s*\|\s(.+?)\s+\|\s*$", line) for line in fh) if m]
    out, cur, sec = {}, None, None
    for i, cell in enumerate(cells):
        if i + 1 < len(cells) and cells[i + 1].startswith("Raw count:"):
            cur, sec = cell, None
            out[cur] = {}
        elif cell in SECTIONS:
            sec = cell
        elif cell.startswith("Raw count:"):
            out[cur]["raw"] = int(cell.split(":")[1])
        elif sec == "Checks and Counters":
            m = re.match(r"(.+?) ([\d.]+) \(([\d.]+)±([\d.]+)\)$", cell)
            if m:
                out[cur].setdefault(sec, []).append((m.group(1), *map(float, m.groups()[1:])))
        elif sec:
            m = re.match(r"(.+?) ([\d.]+)%$", cell)
            if m and m.group(1) != "Other":
                out[cur].setdefault(sec, []).append((m.group(1), float(m.group(2))))
    return out


class Names:
    """Smogon's ids ('choiceband', 'sandstream', 'stoneedge') as the names the engine uses."""

    def __init__(self, cfg, gen, ref=None):
        from refdb import Ref
        ref = ref or Ref(os.path.join(ENGINE, "data", "pokeref.sqlite"))
        key = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
        self.items = {key(i): n for i, n in ref.q("SELECT i.identifier, n.name FROM items i JOIN item_names n "
                                                  "ON n.item_id = i.id AND n.local_language_id = 9")}
        self.items.update(cfg["usage"]["item_aliases"])
        self.abilities = {key(i): n for i, n in ref.q("SELECT a.identifier, n.name FROM abilities a JOIN ability_names n "
                                                      "ON n.ability_id = a.id AND n.local_language_id = 9")}
        with open(os.path.join(ENGINE, "data_battle", f"gen{gen}.json"), encoding="utf-8") as fh:
            self.moves = {k: v["name"] for k, v in json.load(fh)["moves"].items()}

    def move(self, mid):
        if mid.startswith("hiddenpower") and len(mid) > len("hiddenpower"):
            return "Hidden Power " + mid[len("hiddenpower"):].capitalize()
        return self.moves.get(mid, mid)

    def item(self, iid):
        return self.items.get(iid, iid) if iid not in ("nothing", "") else None

    def ability(self, aid):
        return self.abilities.get(aid, aid) if aid != "noability" else None


def spread(text):
    """'Jolly:0/252/0/0/4/252' → ('Jolly', {'hp': 0, 'atk': 252, …})."""
    nature, _, evs = text.partition(":")
    vals = [int(x) for x in evs.split("/")] if evs else []
    return nature, dict(zip(STATS, vals))


def _shares(d, total, name=lambda x: x, top=None, floor=0.0):
    rows = sorted(((name(k), v / total) for k, v in d.items() if total), key=lambda x: -x[1])
    rows = [(k, round(100 * s, 1)) for k, s in rows if s * 100 >= floor and k]
    return rows[:top] if top else rows


def species(cfg, data, name, names):
    """One Pokémon's line in the month's numbers, or None if the format didn't see it."""
    v = data["data"].get(name)
    if not v:
        return None
    u = cfg["usage"]
    total = sum(v["Abilities"].values()) or v["Raw count"] or 1
    checks = []
    for opp, c in v["Checks and Counters"].items():
        if c["n"] > u["checks_min_n"]:
            checks.append((c["p"] - 4 * c["d"], {"species": opp, "beats": round(100 * c["p"]),
                                                 "score": round(100 * (c["p"] - 4 * c["d"])), "n": round(c["n"])}))
    checks = [c for _, c in sorted(checks, key=lambda x: -x[0])]   # ranked on the unrounded score, as Smogon ranks
    return {"species": name, "usage": round(100 * v["usage"], 1), "raw": v["Raw count"],
            "spreads": [{"nature": spread(s)[0], "evs": spread(s)[1], "share": p}
                        for s, p in _shares(v["Spreads"], total, top=u["top_spreads"])],
            "items": _shares(v["Items"], total, names.item, top=u["top"], floor=u["floor"]),
            "abilities": _shares(v["Abilities"], total, names.ability, top=3, floor=u["floor"]),
            "moves": _shares(v["Moves"], total, names.move, top=u["top"] + 4, floor=u["floor"]),
            "teammates": [t for t, _ in sorted(v["Teammates"].items(), key=lambda x: -x[1])[:u["top"]]],
            "checks": checks[:u["checks_top"]]}


def cached(cfg, fmt, base=ENGINE):
    """{cutoff: path} for the newest month cached for a format (no network: reports read only what's here)."""
    d = os.path.join(base, cfg["store"]["usage"])
    if not os.path.isdir(d):
        return None, {}
    rows = [re.match(r"(\d{4}-\d{2})-" + re.escape(fmt) + r"-(\d+)\.json$", f) for f in os.listdir(d)]
    rows = [m for m in rows if m]
    if not rows:
        return None, {}
    month = max(m.group(1) for m in rows)
    return month, {int(m.group(2)): os.path.join(d, m.group(0)) for m in rows if m.group(1) == month}


def line_for(cfg, fmt, name, names, cutoffs, min_raw, base=ENGINE, _cache={}):
    """A Pokémon's line from the newest cached month, at the highest cutoff with enough battles behind it."""
    month, files = cached(cfg, fmt, base)
    found = []
    for cut in cutoffs:
        path = files.get(cut)
        if not path:
            continue
        if path not in _cache:
            with open(path, encoding="utf-8") as fh:
                _cache[path] = json.load(fh)
        line = species(cfg, _cache[path], name, names)
        if line and line["raw"] >= min_raw:
            found.append({**line, "month": month, "cutoff": cut, "format": fmt})
    # the highest cutoff that also has answers to it (a rare Pokémon's checks need the wider pool)
    return next((f for f in found if f["checks"]), found[0] if found else None)


def best_spread(book, variant, spreads, game, gen, roles=None):
    """Of the field's top spreads for a species, the one that fits this variant best: the role engine's mean score
    for the roles that define it (its primary role, or the roles given, e.g. primary and secondary when the
    primary is one a spread can't change, like setting sand), with that spread. Gen 2 has no natures or EV
    spreads to choose."""
    from trainers.model import Build
    roles = roles or ([variant["role"]] if variant.get("role") else [])
    if gen < 3 or not spreads or not roles:
        return None
    best = None
    for s in spreads:
        b = Build(id="usage/fit", species=variant["species"], moves=variant["moves"], item=variant.get("item"),
                  ability=variant.get("ability"), nature=s["nature"], evs=s["evs"])
        try:
            sig = book.signals(book.context(b, game))
            fit = sum(book.score(r, sig, explain=False)["score"] for r in roles) / len(roles)
        except (KeyError, IndexError, ValueError):
            continue
        if best is None or fit > best["fit"] + 1e-9:
            best = {**s, "fit": round(fit, 3)}
    return best


def evs_line(evs):
    names = {"hp": "HP", "atk": "Atk", "def": "Def", "spa": "SpA", "spd": "SpD", "spe": "Spe"}
    return " / ".join(f"{v} {names[k]}" for k, v in evs.items() if v)


def render(line, month, fmt, cutoff):
    if not line:
        return "Not in the month's numbers."
    out = [f"{line['species']} · {fmt} {month}, rated {cutoff}+ · on {line['usage']}% of teams"]
    out.append("  spreads: " + "; ".join(f"{s['nature']} {evs_line(s['evs'])} ({s['share']}%)" for s in line["spreads"]))
    out.append("  items: " + ", ".join(f"{k} {p}%" for k, p in line["items"]))
    out.append("  abilities: " + ", ".join(f"{k} {p}%" for k, p in line["abilities"]))
    out.append("  moves: " + ", ".join(f"{k} {p}%" for k, p in line["moves"]))
    out.append("  teammates: " + ", ".join(line["teammates"]))
    out.append("  checks and counters: " + ", ".join(f"{c['species']} (beats it {c['beats']}% of {c['n']} matchups)"
                                                    for c in line["checks"]))
    return "\n".join(out)
