"""Time: days, phases and the yearly institutional calendar.

Day 0 is the first day of the first school year. Each day runs a fixed list of phases.
School days:   dawn -> classes -> lunch* -> after_school* -> night
Other days:    dawn -> day* -> evening* -> night
(* = decision slots where every character chooses an action)
Weekly, term and yearly processing hang off 'night'.
"""
from __future__ import annotations

import datetime as dt

SCHOOL_PHASES = ["dawn", "classes", "lunch", "after_school", "night"]
FREE_PHASES = ["dawn", "day", "evening", "night"]
DECISION_SLOTS = {"lunch", "after_school", "day", "evening"}
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

START = dt.date(2025, 9, 1)


def date_of(day: int) -> dt.date:
    return START + dt.timedelta(days=day)


def weekday(day: int) -> int:
    return date_of(day).weekday()


def day_of(date: dt.date) -> int:
    return (date - START).days


def school_year_of(day: int) -> int:
    d = date_of(day)
    return d.year - START.year if (d.month, d.day) >= (9, 1) else d.year - START.year - 1


def md_to_day(year: int, md) -> int:
    m, d = md
    y = START.year + year if m >= 9 else START.year + year + 1
    try:
        date = dt.date(y, m, d)
    except ValueError:
        date = dt.date(y, m, 28)
    return day_of(date)


def in_range(day: int, year: int, start_md, end_md) -> bool:
    a = md_to_day(year, start_md)
    b = md_to_day(year, end_md)
    if b < a:
        b = md_to_day(year + 1, end_md) if start_md[0] < 9 else b
    return a <= day <= b


def break_name(day: int, cal: dict) -> str | None:
    y = school_year_of(day)
    for b in cal["breaks"]:
        a = md_to_day(y, b["from"])
        z = md_to_day(y, b["to"])
        if z < a:
            z = md_to_day(y + 1, b["to"]) if b["from"][0] >= 9 and b["to"][0] < 9 else z
        if a <= day <= z:
            return b["name"]
    return None


def is_school_day(day: int, cal: dict) -> bool:
    return weekday(day) < 5 and break_name(day, cal) is None


def phases_for(day: int, cal: dict) -> list[str]:
    return SCHOOL_PHASES if is_school_day(day, cal) else FREE_PHASES


def term_label(day: int, cal: dict) -> str:
    b = break_name(day, cal)
    if b:
        return b
    d = date_of(day)
    return "Fall term" if d.month >= 9 else "Spring term"


def label(day: int) -> str:
    d = date_of(day)
    return f"{WEEKDAYS[d.weekday()]}, {d.strftime('%b')} {d.day}, {d.year}"


def next_school_day(day: int, cal: dict) -> int:
    for k in range(0, 21):
        if is_school_day(day + k, cal):
            return day + k
    return day


def next_weekday(day: int, wd: int) -> int:
    return day + ((wd - weekday(day)) % 7)


def build_year(world, cat, year: int) -> list[dict]:
    """Every scheduled institutional event for one school year."""
    cal = cat.world["calendar"]
    items: list[dict] = []
    y0 = md_to_day(year, cal["school_year_start"])
    y1 = md_to_day(year + 1, cal["school_year_start"]) - 1

    def slot_for(d: int) -> str:
        return "after_school" if is_school_day(d, cal) else ("evening" if weekday(d) >= 5 else "day")

    for g in world.groups.values():
        if g["kind"] == "team":
            s_start = md_to_day(year, g["season"]["start"])
            s_end = md_to_day(year, g["season"]["end"])
            if s_end < s_start:
                s_end = md_to_day(year + 1, g["season"]["end"]) if g["season"]["start"][0] >= 9 else s_end
            t = next_school_day(md_to_day(year, g["tryout"]), cal)
            items.append({"day": t, "kind": "tryout", "group": g["id"], "slot": "after_school",
                          "name": f"{g['name']} tryouts", "key": f"tryout:{g['id']}:{year}",
                          "signup_from": max(y0, t - 21) if t - 21 >= y0 else y0})
            items.append({"day": s_end, "kind": "season_end", "group": g["id"], "slot": None,
                          "name": f"{g['name']} season ends", "key": f"season_end:{g['id']}:{year}"})
            gd = next_weekday(t + 6, g["game_day"])
            n = 0
            while gd <= s_end:
                if break_name(gd, cal) is None:
                    n += 1
                    items.append({"day": gd, "kind": "game", "group": g["id"], "slot": slot_for(gd) if g["game_day"] < 5 else "day",
                                  "name": f"{g['name']} game {n}", "key": f"game:{g['id']}:{year}:{n}"})
                gd += 7
        elif g["kind"] == "production":
            for p in g["productions"]:
                a = next_school_day(md_to_day(year, p["audition"]), cal)
                s = md_to_day(year, p["show"])
                s = s if weekday(s) == 4 else next_weekday(s, 4)
                items.append({"day": a, "kind": "audition", "group": g["id"], "slot": "after_school",
                              "name": f"Auditions for {p['name']}", "production": p["id"], "production_name": p["name"],
                              "key": f"audition:{p['id']}:{year}", "signup_from": max(y0, a - 14)})
                items.append({"day": s, "kind": "show", "group": g["id"], "slot": slot_for(s),
                              "name": f"Opening night of {p['name']}", "production": p["id"],
                              "production_name": p["name"], "key": f"show:{p['id']}:{year}"})
        elif g["kind"] == "council":
            e = next_school_day(md_to_day(year, g["election"]), cal)
            items.append({"day": e, "kind": "election", "group": g["id"], "slot": "lunch",
                          "name": "Student Council election", "key": f"election:{g['id']}:{year}",
                          "signup_from": md_to_day(year, g["signup_open"])})
    for ev in cal["events"]:
        d = md_to_day(year, ev["date"])
        if ev["kind"] == "dance":
            d = next_weekday(d, 5)
            items.append({"day": d, "kind": "dance", "slot": "evening", "name": ev["name"], "id": ev["id"],
                          "grades": ev.get("grades"), "ask_from": d - ev.get("ask_window", 14),
                          "key": f"dance:{ev['id']}:{year}"})
        elif ev["kind"] in ("exam", "report_card"):
            d = next_school_day(d, cal) if not is_school_day(d, cal) else d
            items.append({"day": d, "kind": ev["kind"], "slot": "classes", "name": ev["name"], "id": ev["id"],
                          "weight": ev.get("weight", 1), "key": f"{ev['kind']}:{ev['id']}:{year}"})
        elif ev["kind"] == "graduation":
            items.append({"day": d, "kind": "graduation", "slot": "night", "name": ev["name"], "id": ev["id"],
                          "key": f"graduation:{year}"})
    q = cal.get("quiz_every_days", 14)
    d = next_weekday(y0 + 10, 4)
    n = 0
    while d < y1:
        if is_school_day(d, cal) and not any(i["day"] == d and i["kind"] == "exam" for i in items):
            n += 1
            items.append({"day": d, "kind": "exam", "slot": "classes", "name": f"Quiz {n}", "id": f"quiz{n}",
                          "weight": 1, "key": f"exam:quiz{n}:{year}"})
        d += q
    items.sort(key=lambda i: (i["day"], i["kind"], i.get("group") or "", i["key"]))
    return items
