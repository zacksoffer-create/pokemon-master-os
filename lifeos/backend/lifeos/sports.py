"""Sports: ratings, varsity/JV rosters, starters, box scores, season stats, awards, injuries, recruiting.

A player's sport rating combines learned skill, athletic aptitude, fitness, body (height for
basketball, build for football lines) and confidence. Coaches pick and start players from it;
game stat lines are drawn from position templates scaled by how well the player performed and
how much they played. Season totals feed awards, and awards plus production feed recruiting.
"""
from __future__ import annotations

import math

from . import calendar as calm
from .history import Effects
from .rng import clamp, sigmoid

SPORTS = ("football", "basketball", "baseball")
INJURY_RATE = {"football": 0.010, "basketball": 0.005, "baseball": 0.0035}
INJURIES = {
    "football": [("sprained ankle", 10, 21), ("shoulder strain", 10, 28), ("concussion", 7, 18), ("torn hamstring", 21, 42), ("broken wrist", 28, 49)],
    "basketball": [("sprained ankle", 7, 21), ("jammed finger", 4, 10), ("knee strain", 10, 28), ("back spasms", 5, 14)],
    "baseball": [("pulled hamstring", 7, 21), ("sore elbow", 7, 24), ("sprained wrist", 7, 18)],
}
BUILD_BONUS = {"slight": -5, "average": 0, "athletic": 4, "strong": 5}
TIER_VALUE = {"D1": 30, "D2": 22, "D3": 16, "JUCO": 10}


def poisson(rng, lam: float) -> int:
    lam = max(0.0, lam)
    if lam > 30:
        return max(0, int(round(rng.gauss(lam, math.sqrt(lam)))))
    l, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= l:
            return k
        k += 1


def binom(rng, n: int, p: float) -> int:
    return sum(1 for _ in range(n) if rng.random() < p)


# --- bodies and positions ------------------------------------------------------------

def default_body(c, rng) -> dict:
    mean = {"m": 69.5, "f": 64.5}.get(c.gender, 67.0)
    sd = 3.0 if c.gender != "f" else 2.6
    h = mean + rng.gauss(0, sd) + (c.aptitudes.get("athletic", 50) - 50) / 25
    if c.grade and c.grade <= 10:
        h -= (11 - c.grade) * 0.8  # still growing
    a = c.aptitudes.get("athletic", 50)
    r = rng.random()
    if a >= 65:
        build = "athletic" if r < 0.6 else "strong"
    elif a <= 40:
        build = "slight" if r < 0.55 else "average"
    else:
        build = "average" if r < 0.5 else ("athletic" if r < 0.75 else ("strong" if r < 0.88 else "slight"))
    return {"height_in": int(round(h)), "build": build}


def default_position(c, sport: str, rng) -> str:
    b = c.body or {}
    h = b.get("height_in", 68)
    build = b.get("build", "average")
    t = c.traits
    if sport == "basketball":
        return "C" if h >= 77 else "PF" if h >= 74 else "SF" if h >= 72 else "SG" if h >= 69 else "PG"
    if sport == "football":
        if build == "strong":
            return "OL" if rng.random() < 0.5 else "DL"
        if build == "slight":
            return ["WR", "DB", "K"][int(rng.random() * 3)]
        if t["confidence"] > 65 and c.aptitudes.get("academic", 50) > 55 and rng.random() < 0.35:
            return "QB"
        return ["RB", "WR", "LB", "DB", "TE", "LB"][int(rng.random() * 6)]
    if sport == "baseball":
        if t["competitiveness"] > 65 and rng.random() < 0.4:
            return "P"
        if build == "strong" and t["discipline"] > 55 and rng.random() < 0.4:
            return "C"
        return ["1B", "2B", "SS", "3B", "OF", "OF"][int(rng.random() * 6)]
    return ""


def ensure_athlete(c, sport, rng):
    if not c.body:
        c.body = default_body(c, rng)
    if sport and sport not in c.positions:
        c.positions[sport] = default_position(c, sport, rng)
    if not c.jersey:
        c.jersey = 1 + int(rng.random() * 98)


def body_bonus(c, sport, pos=None) -> float:
    b = c.body or {}
    h = b.get("height_in", 68)
    build = b.get("build", "average")
    pos = pos or c.positions.get(sport)
    if sport == "basketball":
        v = (h - 70) * 1.1
        if pos in ("C", "PF"):
            v += (h - 74) * 0.5
        return clamp(v, -12, 14)
    if sport == "football":
        v = BUILD_BONUS.get(build, 0)
        if pos in ("OL", "DL"):
            v += {"strong": 7, "athletic": 2, "average": -2, "slight": -10}.get(build, 0)
        if pos in ("WR", "DB", "RB"):
            v += {"slight": 3, "athletic": 3, "strong": -2}.get(build, 0)
        return v
    if sport == "baseball" and pos == "P":
        return (h - 70) * 0.4
    return 0.0


def rating(c, sport: str, pos=None) -> float:
    """How good someone is at a sport right now (0-100ish, no randomness)."""
    sk = c.skills.get(sport, 0)
    fit = c.skills.get("fitness", 30)
    return (0.6 * sk + 0.15 * c.aptitudes.get("athletic", 50) + 0.12 * fit + body_bonus(c, sport, pos)
            + 0.06 * (c.traits.get("confidence", 50) - 50) + 6)


def healthy(w, cid) -> bool:
    return w.chars[cid].flags.get("injured_until", -1) < w.day


def season_key(sport, day, level):
    y = calm.START.year + calm.school_year_of(day)
    return f"{sport}:{y}-{str(y + 1)[2:]}:{level}"


# --- box scores ------------------------------------------------------------------------

def stat_line(sport, pos, f, starter, rng) -> dict:
    if sport == "football":
        if pos == "QB":
            return {"pass_yds": max(0, int(rng.gauss(170 * f, 45))), "pass_td": poisson(rng, 1.4 * f),
                    "int_thrown": poisson(rng, 0.9 * max(0.3, 1.6 - f)), "rush_yds": int(rng.gauss(15 * f, 12))}
        if pos == "RB":
            rec = poisson(rng, 1.5 * f)
            return {"rush_yds": max(-5, int(rng.gauss(75 * f, 25))), "rush_td": poisson(rng, 0.7 * f), "rec": rec,
                    "rec_yds": max(0, int(rec * rng.gauss(8, 3)))}
        if pos in ("WR", "TE"):
            k = 3.5 if pos == "WR" else 2.0
            rec = poisson(rng, k * f)
            return {"rec": rec, "rec_yds": max(0, int(rec * rng.gauss(13 if pos == "WR" else 10, 4))),
                    "rec_td": poisson(rng, (0.45 if pos == "WR" else 0.25) * f)}
        if pos == "DL":
            return {"tackles": poisson(rng, 2.5 * f), "sacks": poisson(rng, 0.5 * f)}
        if pos == "LB":
            return {"tackles": poisson(rng, 5.5 * f), "sacks": poisson(rng, 0.3 * f), "ints": poisson(rng, 0.1 * f)}
        if pos == "DB":
            return {"tackles": poisson(rng, 3.5 * f), "ints": poisson(rng, 0.25 * f)}
        if pos == "K":
            return {"fg": poisson(rng, 1.0 * f)}
        return {"tackles": poisson(rng, 0.4 * f)}  # OL: rarely in the box score
    if sport == "basketball":
        base = {"PG": (10, 3, 5), "SG": (13, 3, 2.5), "SF": (11, 5, 2), "PF": (9, 7, 1.5), "C": (8, 8, 1)}.get(pos, (9, 4, 2))
        return {"pts": max(0, int(rng.gauss(base[0] * f, 3))), "reb": poisson(rng, base[1] * f), "ast": poisson(rng, base[2] * f),
                "stl": poisson(rng, 0.9 * f), "blk": poisson(rng, (1.5 if pos == "C" else 0.8 if pos == "PF" else 0.3) * f)}
    if sport == "baseball":
        ab = 4 if starter else 1
        avg = clamp(0.12 + 0.22 * f, 0.05, 0.5)
        h = binom(rng, ab, avg)
        hr = binom(rng, h, clamp(0.1 * f, 0, 0.4))
        line = {"ab": ab, "h": h, "hr": hr, "rbi": poisson(rng, 0.5 * h + hr), "sb": poisson(rng, 0.2 * f)}
        if pos == "P" and starter:
            ip = round(clamp(rng.gauss(5 * f, 1), 1, 7))
            line.update({"ip": ip, "k": poisson(rng, ip * 1.1 * f), "er": poisson(rng, ip * 0.45 * max(0.3, 1.5 - f))})
        return line
    return {}


def line_text(sport, line) -> str:
    order = {"football": [("pass_yds", "pass yds"), ("pass_td", "TD"), ("rush_yds", "rush yds"), ("rush_td", "TD"), ("rec", "rec"),
                          ("rec_yds", "yds"), ("rec_td", "TD"), ("tackles", "tackles"), ("sacks", "sacks"), ("ints", "INT"), ("fg", "FG")],
             "basketball": [("pts", "PTS"), ("reb", "REB"), ("ast", "AST"), ("stl", "STL"), ("blk", "BLK")],
             "baseball": [("h", "H"), ("ab", "AB"), ("hr", "HR"), ("rbi", "RBI"), ("k", "K"), ("ip", "IP")]}[sport]
    parts = []
    for k, label in order:
        v = line.get(k)
        if not v:
            continue
        if sport == "baseball" and k == "h":
            parts.append(f"{v}-for-{line.get('ab', 0)}")
            continue
        if sport == "baseball" and k == "ab":
            continue
        parts.append(f"{v} {label}")
    return ", ".join(parts[:4]) if parts else "limited minutes"


def add_line(dst: dict, line: dict):
    for k, v in line.items():
        dst[k] = dst.get(k, 0) + v


# --- games -----------------------------------------------------------------------------

def opponent_name(sim, g, n: int) -> str:
    school = "college" if g.get("school") == "college" else "hchs"
    names = sim.cat.world.get("opponents", {}).get(school) or ["Rival"]
    return names[(n * 7 + len(g["id"])) % len(names)]


def play_game(inst, it, rng):
    sim = inst.sim
    w = sim.w
    g = w.groups[it["group"]]
    levels = g.setdefault("levels", {})
    came = set(sim.slot.attend.get(("event", it["key"]), []))
    fans = sorted(set(sim.slot.attend.get(("spectate", it["key"]), [])))
    num = int(it["key"].split(":")[-1]) if it["key"].split(":")[-1].isdigit() else 1
    for level in ("varsity", "jv"):
        squad = [m for m in g["members"] if levels.get(m, "varsity") == level]
        if not squad:
            continue
        players = sorted(c for c in squad if c in came and healthy(w, c))
        missing = sorted(c for c in squad if c not in came and healthy(w, c))
        _game(inst, g, it, level, players, missing, fans if level == "varsity" else [], num, rng)


def _game(inst, g, it, level, players, missing, fans, num, rng):
    from .institutions import ambient, mark
    sim = inst.sim
    w = sim.w
    sport = g["skill"]
    n_start = g.get("starters", 5)
    pre = {cid: rating(w.chars[cid], sport) for cid in players}
    starters = sorted(players, key=lambda x: (-pre[x], x))[:n_start]
    perf, share, appr = {}, {}, {}
    for cid in players:
        c = w.chars[cid]
        approach = c.flags.get("game_approach") if c.flags.get("game_approach_day") == w.day else None
        appr[cid] = approach
        bonus = {"all_out": 4.0, "smart": 0.0, "team": -1.0}.get(approach, 0.0)
        perf[cid] = pre[cid] + rng.gauss(0, 7) + bonus + (c.mood - 55) * 0.05
    college = w.meta.get("college") if g.get("school") == "college" else None
    filler = (college["level"] - 8) if college else 38.0
    if college:
        bar = college["level"] + 2
        starters = [s for s in starters if pre[s] - (w.chars[s].grade - 13) * 2 >= bar or len(players) <= n_start // 2]
        share = {}
    filled = [perf[s] for s in starters] + [filler] * max(0, n_start - len(starters))
    share = {cid: 1.0 if cid in starters else 0.3 for cid in players}
    strength = sum(filled) / max(1, len(filled))
    base = college["level"] if college else (48 if level == "varsity" else 41)
    opp = base + rng.gauss(0, 8)
    home = 2 if fans else 0
    margin = strength - opp + rng.gauss(0, 6) + home
    win = margin > 0
    oname = opponent_name(sim, g, num)
    score = inst.score_line(sport, margin, rng)
    if sport == "football":
        a = 7 * max(1, int(abs(margin) / 7) + 1) + int(rng.random() * 14)
        b = max(0, a - max(3, int(abs(margin) / 1.5)))
        score = f"{a}-{b}" if win else f"{b}-{a}"
    box = {}
    skey = season_key(sport, w.day, level)
    for cid in players:
        c = w.chars[cid]
        pos = c.positions.get(sport) or default_position(c, sport, rng)
        f = clamp(perf[cid] / 62, 0.25, 1.8) * (1.0 if cid in starters else 0.35)
        line = stat_line(sport, pos, f, cid in starters, rng)
        box[cid] = {"pos": pos, "starter": cid in starters, "line": line, "perf": round(perf[cid], 1), "approach": appr[cid]}
        st = c.stats.setdefault(skey, {"sport": sport, "level": level, "team": g["id"], "team_name": g["name"],
                                       "school": g.get("school"), "games": 0, "starts": 0, "wins": 0, "losses": 0,
                                       "line": {}, "impact": 0.0})
        st["games"] += 1
        st["starts"] += 1 if cid in starters else 0
        st["wins" if win else "losses"] += 1
        st["impact"] = round(st["impact"] + perf[cid] * share[cid], 2)
        add_line(st["line"], line)
    label = f"{g['name']}{' JV' if level == 'jv' else ''}"
    ev = inst.event("game", "win" if win else "loss", players, importance=14 if level == "varsity" else 7, group=g["id"],
                    involved=fans, data={"group": label, "score": score, "opponent": oname, "level": level, "sport": sport,
                                          "box": box, "starters": starters, "fans": len(fans)})
    ev["text"] = f"{label} {'beat' if win else 'lost to'} {oname}, {score}."
    if w.tracing:
        ev["calc"] = [{"step": "game result", "terms": [["team strength (avg of starters' performances)", round(strength, 2)],
                                                         ["opponent strength", round(opp, 2)], ["home crowd", home]],
                       "total": round(margin, 2), "outcome": "win" if win else "loss",
                       "rule": f"{n_start} starters picked by sport rating (skill, aptitude, fitness, body, confidence); performance = rating + luck",
                       "performances": {k: round(v, 1) for k, v in perf.items()}}]
    fx = Effects(w, ev)
    if level == "varsity":
        g["record"]["w" if win else "l"] += 1
    for cid in players:
        fx.mood(cid, 6 if win else -4, "game")
        fx.need(cid, "energy", -14 if cid in starters else -6, "game")
        fx.need(cid, "fun", 10 if win else 3, "game")
        fx.rep(cid, "athlete", 1.0 if cid in starters else 0.3, "played")
        mark(g, cid, True)
        if appr[cid] == "team":
            for o in players[:6]:
                if o != cid:
                    fx.rel(o, cid, "affection", 1.5, "played for the team")
    for i in range(len(players)):
        for j in range(i + 1, min(len(players), i + 4)):
            ambient(sim, fx, players[i], players[j], 0.3 if win else 0.05, f"{label} game")
    for cid in fans:
        fx.need(cid, "social", 10, "watched the game")
        fx.need(cid, "fun", 9 if win else 5, "watched the game")
    coach = g.get("staff")
    for cid in missing:
        mark(g, cid, False)
        if coach:
            fx.rel(coach, cid, "respect", -8, "missed a game")
    sim.attach_traces(ev, players + fans)
    sim.finish(ev, fx)
    # first starts and standouts
    for cid in starters:
        c = w.chars[cid]
        k = f"started:{g['id']}:{level}"
        if not c.flags.get(k):
            c.flags[k] = w.day
            e2 = inst.event("game", "first_start", [cid], importance=30, group=g["id"], data={"group": label})
            e2["text"] = f"{c.short} made their first start for {label}."
            e2["causes"] = [ev["id"]]
            f2 = Effects(w, e2)
            f2.memory(cid, "first_start", [coach] if coach else [], 0.7, 60, f"First start for {label}")
            sim.confidence(cid, 1.5, f2, "first start")
            sim.finish(e2, f2)
    prot = w.meta.get("protagonist")
    if prot in players and level == "varsity":
        pc = w.chars[prot]
        streak = 0 if prot in starters else pc.flags.get("bench_streak", 0) + 1
        pc.flags["bench_streak"] = streak
        if streak == 3:
            sim.moment_trigger("benched", prot, {"group": g["id"], "games": streak})
    notable = [k for k in players if any(v for v in box[k]["line"].values())]
    if notable:
        star = max(notable, key=lambda k: (perf[k] * share[k], k))
        if level == "varsity" or w.meta.get("protagonist") == star:
            line = box[star]["line"]
            e3 = inst.event("game", "star", [star], importance=26 if level == "varsity" else 14, group=g["id"],
                            data={"group": label, "score": score, "line": line})
            e3["text"] = f"{w.chars[star].short} led {label}: {line_text(sport, line)}."
            e3["causes"] = [ev["id"]]
            f3 = Effects(w, e3)
            f3.rep(star, "star", 3, "standout game")
            f3.mood(star, 5, "standout game")
            if win:
                f3.memory(star, "star_game", [], 0.55, 45, f"{line_text(sport, line)} in a {score} win over {oname}")
            sim.finish(e3, f3)
    # injuries
    for cid in players:
        c = w.chars[cid]
        mult = {"all_out": 1.8, "smart": 0.6}.get(box[cid].get("approach"), 1.0)
        p = INJURY_RATE[sport] * (1.35 - c.skills.get("fitness", 30) / 100) * share[cid] * mult * (1.4 if g.get("school") == "college" else 1)
        if rng.random() < p:
            injure(inst, cid, sport, rng, ev)
    for cid in missing:
        from .institutions import misses
        if misses(g, cid) > w.rules["inst.absence_tolerance"] and cid in g["members"]:
            inst.drop(g["id"], cid, "dropped", ev, rng)


def injure(inst, cid, sport, rng, cause=None, during="game"):
    sim = inst.sim
    w = sim.w
    c = w.chars[cid]
    name, lo, hi = INJURIES[sport][int(rng.random() * len(INJURIES[sport]))]
    days = int(lo + rng.random() * (hi - lo))
    ev = inst.event("injury", "hurt", [cid], importance=34, data={"label": name, "n": days, "sport": sport})
    ev["text"] = f"{c.short} suffered a {name} {'in a game' if during == 'game' else 'at practice'} and will be out about {max(1, days // 7)} week{'s' if days >= 14 else ''}."
    if cause and cause.get("id"):
        ev["causes"] = [cause["id"]]
    fx = Effects(w, ev)
    fx.flag(cid, "injured_until", w.day + days, name)
    fx.flag(cid, "injury", name, name)
    fx.mood(cid, -10, name)
    fx.need(cid, "stress", 9, name)
    fx.memory(cid, "injured", [], -0.6, 60, f"Got hurt: {name}")
    sim.finish(ev, fx)
    sim.moment_trigger("injury", cid, {"injury": name, "days": days, "sport": sport, "event": ev.get("id")})


# --- seasons, awards, recruiting -----------------------------------------------------------

def season_awards(inst, g):
    """Team MVP and all-conference honors from the season's recorded games."""
    sim = inst.sim
    w = sim.w
    sport = g["skill"]
    skey = season_key(sport, w.day, "varsity")
    rows = []
    for cid in g["members"]:
        st = w.chars[cid].stats.get(skey)
        if st and st["games"]:
            rows.append((st["impact"], cid, st))
    rows.sort(key=lambda r: (-r[0], r[1]))
    awards = []
    if rows:
        awards.append((rows[0][1], f"{g['name']} MVP"))
        for imp, cid, st in rows:
            if st["starts"] >= max(2, st["games"] // 2) and imp / st["games"] >= (66 if g.get("school") == "college" else 60):
                awards.append((cid, f"All-Conference {sim.cat.sports['sports'][sport]['label']}"))
    for cid, label in awards:
        c = w.chars[cid]
        ev = inst.event("award", "won", [cid], importance=36, group=g["id"], data={"label": label})
        ev["text"] = f"{c.short} was named {label}."
        fx = Effects(w, ev)
        c.awards.append({"day": w.day, "label": label, "sport": sport, "season": skey})
        c.achievements.append({"day": w.day, "label": label, "event": ev.get("id")})
        fx.rep(cid, "star", 6, label)
        fx.memory(cid, "award", [], 0.8, 70, f"Named {label}")
        sim.confidence(cid, 2.0, fx, label)
        sim.finish(ev, fx)
    return awards


def recruit_score(c, sport) -> float:
    entries = [st for k, st in c.stats.items() if k.startswith(sport + ":") and st["level"] == "varsity" and st["games"]]
    prod = 0.0
    if entries:
        last = entries[-1]
        prod = (last["impact"] / last["games"] - 55) * 0.4
    aw = min(10, 4 * sum(1 for a in c.awards if a.get("sport") == sport))
    return rating(c, sport) + prod + aw + ((c.grade or 12) - 10) * 1.5


def recruiting_update(inst, c, sport, rng):
    sim = inst.sim
    w = sim.w
    if c.role != "student" or c.school != "hchs" or (c.grade or 0) < 10:
        return
    rec = c.recruiting
    rec.setdefault("interest", {})
    rec.setdefault("offers", [])
    rec.setdefault("score", {})
    score = recruit_score(c, sport)
    rec["score"][sport] = round(score, 1)
    for col in sim.cat.colleges:
        if sport not in col["sports"]:
            continue
        key = f"{col['id']}:{sport}"
        gap = score - col["recruit_bar"]
        if gap < -6:
            continue
        first = key not in rec["interest"]
        rec["interest"][key] = max(rec["interest"].get(key, 0), int(clamp(50 + gap * 5, 5, 99)))
        already = any(o["college"] == col["id"] and o["sport"] == sport for o in rec["offers"])
        eligible = c.gpa >= col["min_gpa"] * 0.85
        p = sigmoid(gap / 3) * (0.9 if c.grade >= 12 else 0.5 if c.grade == 11 else 0.0)
        if not already and c.grade >= 11 and gap >= 0 and eligible and rng.random() < p:
            offer = {"college": col["id"], "name": col["name"], "tier": col["tier"], "sport": sport,
                     "scholarship": col["tier"] in ("D1", "D2", "JUCO"), "day": w.day}
            rec["offers"].append(offer)
            ev = inst.event("recruiting", "offer", [c.id], importance=42, data={"label": col["name"], "sport": sport})
            ev["text"] = (f"{col['name']} ({col['tier']}) offered {c.short} a "
                          f"{'scholarship' if offer['scholarship'] else 'roster spot'} to play {sport}.")
            fx = Effects(w, ev)
            fx.mood(c.id, 10, "college offer")
            fx.memory(c.id, "offer", [], 0.8, 70, f"Offer from {col['name']} for {sport}")
            sim.confidence(c.id, 1.5, fx, "college offer")
            sim.finish(ev, fx)
            sim.moment_trigger("offer", c.id, {"college": col["id"], "college_name": col["name"], "sport": sport, "tier": col["tier"]})
        elif first:
            ev = inst.event("recruiting", "interest", [c.id], importance=22, data={"label": col["name"], "sport": sport})
            ev["text"] = f"{col['name']} coaches are keeping an eye on {c.short} ({sport})."
            sim.finish(ev, Effects(w, ev))


def admissions(inst, rng):
    sim = inst.sim
    w = sim.w
    for c in sorted(w.students(), key=lambda c: c.id):
        if c.school != "hchs" or c.grade != 12:
            continue
        admits = []
        for col in sim.cat.colleges:
            if c.gpa + rng.gauss(0, 0.15) >= col["min_gpa"]:
                admits.append({"college": col["id"], "name": col["name"], "tier": col["tier"]})
        c.recruiting["admits"] = admits
        prot = w.meta.get("protagonist") == c.id
        ev = inst.event("admissions", "letters", [c.id], importance=30 if prot else 12,
                        data={"label": ", ".join(a["name"] for a in admits[:4])})
        ev["text"] = (f"{c.short} got into {len(admits)} school{'s' if len(admits) != 1 else ''}"
                      + (f": {', '.join(a['name'] for a in admits[:3])}" if admits else "") + ".")
        sim.finish(ev, Effects(w, ev))


def path_options(sim, c) -> list:
    """Every realistic thing a senior could do next, with a utility for autonomous choosing."""
    w = sim.w
    t, m = c.traits, c.motives
    h = w.households.get(c.household_id) or {}
    poor = h.get("income") == "low"
    opts = []
    for o in c.recruiting.get("offers", []):
        iv = c.interests.get(o["sport"], 50)
        v = TIER_VALUE[o["tier"]] + iv * 0.2 + (8 if o["scholarship"] else 0) + m["achievement"] * 0.1 + (6 if poor and o["scholarship"] else 0)
        opts.append({"kind": "college", "college": o["college"], "name": o["name"], "tier": o["tier"], "sport": o["sport"],
                     "scholarship": o["scholarship"], "utility": round(v, 1),
                     "label": f"Play {o['sport']} at {o['name']} ({o['tier']}{', scholarship' if o['scholarship'] else ''})"})
    for a in c.recruiting.get("admits", []):
        v = {"D1": 24, "D2": 18, "D3": 19, "JUCO": 9}[a["tier"]] + t["ambition"] * 0.15 + c.aptitudes["academic"] * 0.05 - (5 if poor and a["tier"] != "JUCO" else 0)
        opts.append({"kind": "college", "college": a["college"], "name": a["name"], "tier": a["tier"], "sport": None,
                     "scholarship": False, "utility": round(v, 1), "label": f"Go to {a['name']} as a regular student"})
    v = 12 + m["pleasure"] * 0.08 + (50 - t["ambition"]) * 0.2 + (6 if poor else 0)
    opts.append({"kind": "work", "college": None, "name": "Hollow Creek", "tier": None, "sport": None, "scholarship": False,
                 "utility": round(v, 1), "label": "Stay in Hollow Creek and work"})
    return opts


def choose_path(inst, c, rng, option=None, how="decided"):
    sim = inst.sim
    w = sim.w
    opts = path_options(sim, c)
    if option is None:
        from .rng import softmax_pick
        idx, _ = softmax_pick([o["utility"] for o in opts], 6.0, rng.random())
        option = opts[idx]
    c.path = {k: option[k] for k in ("kind", "college", "name", "tier", "sport", "scholarship")}
    c.path["decided"] = w.day
    if option["kind"] == "college":
        txt = (f"{c.short} committed to play {option['sport']} at {option['name']}." if option["sport"]
               else f"{c.short} will attend {option['name']} in the fall.")
    else:
        txt = f"{c.short} plans to stay in Hollow Creek and work after graduation."
    ev = inst.event("path", "chosen", [c.id], importance=40, data={"label": option["label"]})
    ev["text"] = txt
    fx = Effects(w, ev)
    fx.memory(c.id, "decision", [], 0.6, 70, txt.replace(c.short, "I", 1))
    fx.mood(c.id, 5, "made the big decision")
    sim.finish(ev, fx)
    return c.path
