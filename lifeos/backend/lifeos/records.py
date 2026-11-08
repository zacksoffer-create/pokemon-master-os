"""Sports records you control: anyone's season (stat line, games, starts, record, captain, awards, Player of the Week) and
how much each thing counts toward popularity.

- weights(): what each part of a sports year is worth on the Ladder (sports.athletic_standing reads it). You change them
  (Scene -> Ladder -> Sports -> Change how sports count); reset puts the defaults back.
- seasons() / save(): a person's seasons in a school year, and editing one. What you set replaces what the simulation
  made (the stat line, the awards); the Ladder, the yearbook, the Sports tab and storylines all read the same record.
  Popularity is recomputed right away so you see it move.
"""
from __future__ import annotations

from . import calendar as calm

DEFAULTS = {
    "varsity": 120, "jv": 30, "second_team": 0.5, "starter": 50, "captain": 70, "title": 90,
    "mvp": 140, "all_conf": 100, "all_state": 160, "potw": 25, "potw_max": 5, "other_award": 40,
    "athlete_rep": 2.0, "football": 1.25, "basketball": 1.15, "overall": 1.0,
}
LABELS = [  # (key, what it is, how it's shown)
    ("overall", "Sports overall", "x"), ("varsity", "Making varsity", "pts"), ("jv", "Making JV", "pts"),
    ("second_team", "A second (or third) team", "x"), ("starter", "Starting", "pts"), ("captain", "Captain", "pts"),
    ("mvp", "Team MVP", "pts"), ("all_conf", "All-conference (All-SCC)", "pts"), ("all_state", "All-State, Player of the Year", "pts"),
    ("potw", "Each Player of the Week", "pts"), ("potw_max", "Players of the Week that count", "n"), ("other_award", "Any other award", "pts"),
    ("title", "A tournament title", "pts"), ("athlete_rep", "Athlete reputation", "x"), ("football", "Football bonus", "x"),
    ("basketball", "Basketball bonus", "x"),
]
LIMITS = {"x": (0.0, 3.0), "pts": (0, 400), "n": (0, 20)}
FIELDS = {"football": [("pass_yds", "Pass yds"), ("pass_td", "Pass TD"), ("rush_yds", "Rush yds"), ("rush_td", "Rush TD"), ("rec", "Catches"),
                       ("rec_yds", "Rec yds"), ("rec_td", "Rec TD"), ("tackles", "Tackles"), ("sacks", "Sacks"), ("ints", "INT"), ("fg", "FG")],
          "basketball": [("pts", "Points"), ("reb", "Rebounds"), ("ast", "Assists"), ("stl", "Steals"), ("blk", "Blocks")],
          "baseball": [("ab", "AB"), ("h", "Hits"), ("hr", "HR"), ("rbi", "RBI"), ("sb", "SB"), ("k", "K (pitching)"), ("ip", "IP")],
          "soccer": [("goals", "Goals"), ("assists", "Assists"), ("shots", "Shots"), ("saves", "Saves"), ("clean_sheets", "Clean sheets")]}
FIELDS["softball"] = FIELDS["baseball"]
IMPACT = {"football": {"pass_yds": 0.05, "pass_td": 6, "rush_yds": 0.1, "rush_td": 6, "rec": 0.5, "rec_yds": 0.1, "rec_td": 6, "tackles": 1,
                       "sacks": 3, "ints": 4, "fg": 3},
          "basketball": {"pts": 1, "reb": 1.2, "ast": 1.5, "stl": 2, "blk": 2},
          "baseball": {"h": 2, "hr": 4, "rbi": 1.5, "sb": 1, "k": 0.5, "ip": 0.5},
          "soccer": {"goals": 5, "assists": 3, "shots": 0.3, "saves": 0.5, "clean_sheets": 3}}
IMPACT["softball"] = IMPACT["baseball"]


class RecordError(ValueError):
    pass


# ------------------------------------------------------------------------------------------------ the weights
def weights(w) -> dict:
    return {**DEFAULTS, **(w.meta.get("sports_weights") or {})}


def weights_view(w) -> dict:
    cur = weights(w)
    return {"rows": [{"key": k, "label": l, "kind": kind, "value": cur[k], "default": DEFAULTS[k], "min": LIMITS[kind][0], "max": LIMITS[kind][1]}
                     for k, l, kind in LABELS], "changed": bool(w.meta.get("sports_weights"))}


def set_weights(sim, body: dict) -> dict:
    w = sim.w
    if body.get("reset"):
        w.meta.pop("sports_weights", None)
    else:
        over = dict(w.meta.get("sports_weights") or {})
        kinds = {k: kind for k, _, kind in LABELS}
        for k, v in (body.get("weights") or {}).items():
            if k not in DEFAULTS:
                raise RecordError(f"{k} isn't something sports are weighed by")
            try:
                v = float(v)
            except (TypeError, ValueError):
                raise RecordError(f"{k} must be a number")
            lo, hi = LIMITS[kinds[k]]
            v = max(lo, min(hi, v))
            if abs(v - DEFAULTS[k]) < 1e-9:
                over.pop(k, None)
            else:
                over[k] = v
        w.meta["sports_weights"] = over
    _rerank(sim)
    return weights_view(w)


def _rerank(sim):
    from .history import Effects
    from .social import recompute_popularity
    recompute_popularity(sim, Effects(sim.w, None))


# ------------------------------------------------------------------------------------------------ a person's seasons
def _skey(year: int) -> str:
    y0 = calm.START.year + year
    return f"{y0}-{str(y0 + 1)[2:]}"


def _bounds(year: int) -> tuple:
    return calm.md_to_day(year, (9, 1)), calm.md_to_day(year, (8, 31))


def _sport_label(sim, sport) -> str:
    return (sim.cat.sports["sports"].get(sport) or {}).get("label") or sport.title()


def _award_options(sim, g) -> list:
    sl = _sport_label(sim, g["skill"])
    return [f"{g['name']} MVP", f"All-SCC {sl}", f"All-State {sl}", f"SCC {sl} Player of the Year"]


def _teams_in(w, c, year) -> list:
    """(team, level) for every high school team someone was on (or has a season for) that school year."""
    sk = _skey(year)
    out = []
    for g in sorted(w.groups.values(), key=lambda g: g["id"]):
        if g.get("kind") != "team" or g.get("school") == "college":
            continue
        hist = next((h for h in g.get("history") or [] if h.get("year") == year and c.id in (h.get("roster") or [])), None)
        lvl = None
        if year == calm.school_year_of(w.day) and c.id in (g.get("members") or []):
            lvl = (g.get("levels") or {}).get(c.id, "varsity")
        elif hist is not None:
            lvl = (hist.get("levels") or {}).get(c.id, "varsity")
        else:
            for lv in ("varsity", "jv"):
                st = (c.stats or {}).get(f"{g['skill']}:{sk}:{lv}")
                if isinstance(st, dict) and st.get("team", g["id"]) == g["id"] and st.get("games"):
                    lvl = lv
                    break
        if lvl:
            out.append((g, lvl, hist))
    return out


def seasons(sim, cid: str, year: int | None = None) -> dict:
    w = sim.w
    c = w.chars.get(cid)
    if c is None:
        raise RecordError("no such person")
    now = calm.school_year_of(w.day)
    year = now if year is None else int(year)
    a, b = _bounds(year)
    years = sorted({int(k.split(":")[1][:4]) - calm.START.year for k in (c.stats or {}) if ":" in k and k.split(":")[1][:4].isdigit()} | {now})
    rows = []
    for g, lvl, hist in _teams_in(w, c, year):
        sport = g["skill"]
        st = (c.stats or {}).get(f"{sport}:{_skey(year)}:{lvl}") or {}
        opts = _award_options(sim, g)
        mine = [x for x in c.awards or [] if isinstance(x, dict) and a <= x.get("day", -1) <= b and _award_sport(sim, x) == sport]
        potw = sum(1 for x in mine if x.get("potw") or "Player of the Week" in (x.get("label") or ""))
        awards = [x["label"] for x in mine if not (x.get("potw") or "Player of the Week" in (x.get("label") or ""))]
        captain = (c.id in (g.get("leaders") or [])) if (year == now and hist is None) else c.id in ((hist or {}).get("captains") or [])
        rows.append({"team": g["id"], "name": g["name"], "sport": sport, "level": lvl, "games": st.get("games", 0), "starts": st.get("starts", 0),
                     "wins": st.get("wins", 0), "losses": st.get("losses", 0), "line": {k: (st.get("line") or {}).get(k, 0) for k, _ in FIELDS[sport]},
                     "fields": [[k, l] for k, l in FIELDS[sport]], "captain": captain, "awards": awards, "options": opts, "potw": potw,
                     "edited": bool(st.get("edited"))})
    return {"year": year, "label": _skey(year), "years": [{"year": y, "label": _skey(y)} for y in years], "seasons": rows,
            "name": c.name}


def _award_sport(sim, aw) -> str | None:
    if aw.get("sport"):
        return aw["sport"]
    lab = (aw.get("label") or "").lower()
    for s, d in sim.cat.sports["sports"].items():
        if d.get("label", s).lower() in lab or s in lab:
            return s
    return None


def save(sim, cid: str, body: dict) -> dict:
    """Edit one season: {year, team, games, starts, wins, losses, line: {..}, captain, awards: [labels], potw: n}."""
    from .history import Effects
    w = sim.w
    c = w.chars.get(cid)
    if c is None:
        raise RecordError("no such person")
    now = calm.school_year_of(w.day)
    year = int(body.get("year", now))
    team = body.get("team")
    found = next(((g, lvl, hist) for g, lvl, hist in _teams_in(w, c, year) if g["id"] == team), None)
    if found is None:
        raise RecordError("they weren't on that team that year (put them on it in Teams first)")
    g, lvl, hist = found
    sport = g["skill"]
    a, b = _bounds(year)
    key = f"{sport}:{_skey(year)}:{lvl}"
    st = c.stats.setdefault(key, {"sport": sport, "level": lvl, "team": g["id"], "team_name": g["name"], "school": g.get("school"),
                                  "games": 0, "starts": 0, "wins": 0, "losses": 0, "line": {}, "impact": 0.0})

    def num(k, lo=0, hi=999):
        v = body.get(k, st.get(k, 0))
        try:
            return max(lo, min(hi, int(float(v))))
        except (TypeError, ValueError):
            raise RecordError(f"{k} must be a number")
    for k in ("games", "starts", "wins", "losses"):
        st[k] = num(k)
    st["starts"] = min(st["starts"], st["games"])
    if isinstance(body.get("line"), dict):
        allowed = {k for k, _ in FIELDS[sport]}
        line = dict(st.get("line") or {})
        for k, v in body["line"].items():
            if k not in allowed:
                continue
            try:
                line[k] = max(0, min(9999, int(float(v))))
            except (TypeError, ValueError):
                raise RecordError(f"{k} must be a number")
        st["line"] = {k: v for k, v in line.items() if v}
        st["impact"] = round(sum(IMPACT[sport].get(k, 0) * v for k, v in st["line"].items()), 2)
    st["edited"] = True
    # captain
    if "captain" in body:
        on = bool(body["captain"])
        tgt = g.setdefault("leaders", []) if (year == now and hist is None) else hist.setdefault("captains", [])
        if on and c.id not in tgt:
            tgt.append(c.id)
        elif not on and c.id in tgt:
            tgt.remove(c.id)
    # awards and Players of the Week
    day = min(max(a, w.day), b) if year == now else calm.md_to_day(year, (6, 1))
    if "awards" in body or "potw" in body:
        keep, potw_old = [], []
        for x in c.awards or []:
            mine = isinstance(x, dict) and a <= x.get("day", -1) <= b and _award_sport(sim, x) == sport
            if not mine:
                keep.append(x)
            elif x.get("potw") or "Player of the Week" in (x.get("label") or ""):
                potw_old.append(x)
            elif "awards" not in body:
                keep.append(x)
        labels = [str(s).strip()[:60] for s in (body.get("awards") if "awards" in body else []) if str(s).strip()]
        new = [{"day": day, "label": lab, "sport": sport, "season": key, "edited": True} for lab in dict.fromkeys(labels)]
        n = max(0, min(30, int(body["potw"]))) if "potw" in body else len(potw_old)
        conf = sim.cat.world["school"].get("conference", "SCC")
        potw = potw_old[:n] + [{"day": day, "label": f"{'SCC' if 'Shoreline' in conf or conf == 'SCC' else conf} Player of the Week",
                                "sport": sport, "potw": True, "edited": True} for _ in range(max(0, n - len(potw_old)))]
        if "awards" not in body:
            c.awards = keep + potw
        else:
            c.awards = keep + new + potw
        if hist is not None and "awards" in body:  # (the yearbook's team page reads the season's awards)
            hist["awards"] = [x for x in hist.get("awards") or [] if x[0] != c.id] + [[c.id, lab] for lab in labels]
    ev = sim.new_event("editor", "sports", [c.id], [], 4, {"team": g["name"], "year": _skey(year)})
    ev["text"] = f"Editor: changed {c.name}'s {_skey(year)} {g['name']} season"
    sim.finish(ev, Effects(w, ev))
    _rerank(sim)
    return seasons(sim, cid, year)
