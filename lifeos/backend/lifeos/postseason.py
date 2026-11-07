"""Tournaments at the end of a high school season (CIAC): the SCC tournament, then the state tournament.

Every round is on the calendar from the start of the school year (calendar.team_season), so a storyline can wait for the
state final the way it waits for any game. The day before a team's first tournament game, its regular season decides
who's in (a winning record for the SCC, a .400 one for the state tournament, more for the football playoffs); a team
that isn't comes off those rounds. A loss takes a team off the rest of that tournament (the state tournament still comes
after an SCC loss). Once a team has no games left, its season ends the next day, so a team that's out on Feb 22 isn't
still "in season" in March, and one that's still playing in June is.
"""
from __future__ import annotations

import zlib

from . import calendar as calm


def _h(*parts) -> int:
    return zlib.crc32(":".join(str(p) for p in parts).encode())


def _year(day: int) -> int:
    return calm.school_year_of(day)


def _stage_items(w, gid, year, stage=None) -> list:
    return sorted((i for i in w.calendar if i.get("group") == gid and i.get("stage") and _year(i["day"]) == year
                   and (stage is None or i["stage"] == stage)), key=lambda i: i["day"])


def _record(g) -> tuple:
    r = g.get("record") or {}
    return int(r.get("w", 0)), int(r.get("l", 0))


def qualifies(w, g, st, fast=False) -> bool:
    wins, losses = _record(g)
    if wins + losses == 0:
        if not fast:
            return False
        # (the fast forecast plays only your games: the others get a season of about the league's spread, one number
        # for both tournaments, so an SCC champion is in the state tournament too)
        pct = 0.2 + 0.65 * (_h(w.seed, "post-in", g["id"], _year(w.day)) % 1000) / 1000
        return pct >= float(st.get("qualify", 0.5))
    return wins / (wins + losses) >= float(st.get("qualify", 0.5))


def _opponents(sim, g, its) -> None:
    """Who a team plays in each round: the conference's better teams, the best last (the same way every time)."""
    from . import league as lg
    try:
        lea = lg.league(sim, g)
    except Exception:  # noqa: BLE001 (no league for this team)
        return
    them = sorted((t for t in lea["teams"].values() if not t.get("ours") and t.get("strength") is not None),
                  key=lambda t: -t["strength"])
    if not them:
        return
    used = set()
    for i in its:
        n, k = i.get("rounds", 1), i.get("round", 1)
        top = max(1, min(len(them), 2 * (n - k + 1)))  # the final: one of the two best; the first round: anyone decent
        pool = [t for t in them[:top] if t["name"] not in used] or them[:top]
        t = pool[_h(sim.w.seed, i["key"]) % len(pool)]
        i["opp"] = t["name"]
        used.add(t["name"])


def drop(w, g, its, why: str) -> None:
    keys = {i["key"] for i in its}
    w.calendar = [i for i in w.calendar if i.get("key") not in keys]
    w.meta["cal_rev"] = w.meta.get("cal_rev", 0) + 1  # (what's waiting on those games looks again)
    res = g.setdefault("post_results", {})
    for i in its:
        res.setdefault(f"{_year(i['day'])}:{i['stage']}", {"stage_name": i.get("stage_name"), "result": why})


def _played_this_year(g, y) -> bool:
    r = g.get("record") or {}
    return bool(r.get("w") or r.get("l")) or any(str(k).startswith(f"game:{g['id']}:{y}:") for k in g.get("played") or [])


def settle_end(w, g) -> None:
    """A team with no games left this year ends its season tomorrow (not on the last possible tournament day)."""
    y = _year(w.day)
    mine = [i for i in w.calendar if i.get("group") == g["id"] and _year(i["day"]) == y]
    end = next((i for i in mine if i["kind"] == "season_end"), None)
    if end is None or end["day"] <= w.day + 1:
        return
    games = [i for i in mine if i["kind"] == "game"]
    if any(i["day"] >= w.day for i in games):
        return
    if not games and not _played_this_year(g, y):
        return  # (its season hasn't started yet this year)
    end["day"] = w.day + 1
    w.meta["cal_rev"] = w.meta.get("cal_rev", 0) + 1


def daily(sim, fast: bool = False) -> None:
    """Each morning: decide who's in each tournament the day before it starts, and end the seasons that are over."""
    w = sim.w
    y = _year(w.day)
    for g in w.groups.values():
        if g.get("kind") != "team" or not g.get("post") or g.get("school") == "college":
            continue
        its = _stage_items(w, g["id"], y)
        regular_left = any(i.get("group") == g["id"] and i["kind"] == "game" and not i.get("stage") and i["day"] >= w.day
                           and _year(i["day"]) == y for i in w.calendar)
        if its and not its[0].get("decided") and (w.day >= its[0]["day"] - 1 or (not regular_left and _played_this_year(g, y))):
            # (decided the day after the regular season's last game: a team that's out ends its season then)
            for st in g["post"]:
                s_its = [i for i in its if i["stage"] == st["stage"]]
                if not s_its:
                    continue
                for i in s_its:
                    i["decided"] = True
                if qualifies(w, g, st, fast):
                    _opponents(sim, g, s_its)
                    g.setdefault("post_results", {})[f"{y}:{st['stage']}"] = {"stage_name": st.get("name"), "result": "in"}
                else:
                    drop(w, g, s_its, "didn't qualify")
        if fast:
            _fast_results(sim, g, y)
        settle_end(w, g)


def after_game(sim, g, it, win: bool) -> None:
    """A tournament game was played: a loss ends that tournament for the team; winning the last round wins it."""
    if not it.get("stage"):
        return
    w = sim.w
    y = _year(it["day"])
    res = g.setdefault("post_results", {})
    key = f"{y}:{it['stage']}"
    if win and it.get("round") == it.get("rounds"):
        res[key] = {"stage_name": it.get("stage_name"), "result": "champion", "round": it.get("round_name")}
        return
    if win:
        res[key] = {"stage_name": it.get("stage_name"), "result": "alive", "round": it.get("round_name")}
        return
    rest = [i for i in _stage_items(w, g["id"], y, it["stage"]) if i["day"] > it["day"]]
    w.calendar = [i for i in w.calendar if i.get("key") not in {r["key"] for r in rest}]
    w.meta["cal_rev"] = w.meta.get("cal_rev", 0) + 1
    res[key] = {"stage_name": it.get("stage_name"), "result": "out", "round": it.get("round_name")}


def _fast_results(sim, g, y) -> None:
    """The fast forecast: yesterday's tournament games for teams you're not on (yours get a result in _light_games)."""
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if me is not None and g["id"] in me.memberships:
        return
    for i in _stage_items(w, g["id"], y):
        if i["day"] == w.day - 1 and not i.get("result"):
            i["result"] = "win" if (_h(w.seed, "light-post", i["key"]) % 100) < 55 else "loss"
            after_game(sim, g, i, i["result"] == "win")


def status(w, g, day=None) -> str | None:
    """'In the SCC semifinal', 'SCC champions', 'Out of the state tournament' — for the Sports tab and storylines."""
    y = _year(w.day if day is None else day)
    res = g.get("post_results") or {}
    bits = []
    for st in g.get("post") or []:
        r = res.get(f"{y}:{st['stage']}")
        if not r:
            continue
        if r["result"] == "champion":
            bits.append(f"{st['name'].replace(' tournament', '').replace(' playoffs', '')} champions")
        elif r["result"] == "out":
            bits.append(f"out of the {st['name']} ({r.get('round')})")
        elif r["result"] == "didn't qualify":
            bits.append(f"missed the {st['name']}")
    return "; ".join(bits) or None


def upgrade_teams(w, world_groups: list) -> int:
    """Old saves: give the high school teams the CIAC season (it takes effect with the next school year's calendar)."""
    by_id = {g["id"]: g for g in world_groups}
    n = 0
    for g in w.groups.values():
        src = by_id.get(g.get("id"))
        if g.get("kind") != "team" or not src or not src.get("calendar_v") or g.get("calendar_v", 0) >= src["calendar_v"]:
            continue
        for k in ("tryout", "first_game", "game_days", "regular_end", "post", "holiday", "thanksgiving_game", "season", "game_day",
                  "calendar_v"):
            if k in src:
                g[k] = src[k]
        n += 1
    return n
