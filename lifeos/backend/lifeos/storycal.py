"""The story calendar: the fixed schedule every storyline is planned on.

One school year at a time, the way the game will actually play it: the named days (first day of school, homecoming,
Thanksgiving, winter break, prom, graduation...) with their dates, and every team's season game by game (date and
opponent, the rivalry game, the holiday tournament, the Thanksgiving game, the tournaments). The outline prompt hands
it to ChatGPT, every outline line has to pick its `when` from it, and the scene prompt tells ChatGPT the exact moment
each scene is (Friday, Sept 23, 2011: football game 3 vs Branford).
"""
from __future__ import annotations

import datetime as dt
import re
import zlib

from . import calendar as calm

YEAR_WORDS = ["freshman", "sophomore", "junior", "senior"]
MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
SPORT_NAMES = {"football": "Football", "soccer": "Boys soccer", "soccer_girls": "Girls soccer", "basketball": "Boys basketball",
               "basketball_girls": "Girls basketball", "baseball": "Baseball", "softball": "Softball"}

# the named days a scene can be on (the game knows each one's date every year)
NAMED = [("first day of school", "first_day_of_school"), ("homecoming week", "homecoming_week"), ("homecoming", "homecoming"),
         ("Halloween", "10-31"), ("midterms week", "midterms_week"), ("Thanksgiving", "thanksgiving"),
         ("Thanksgiving break", "thanksgiving_break"), ("finals week", "finals_week"), ("winter break", "winter_break"),
         ("Christmas Eve", "12-24"), ("Christmas", "12-25"), ("New Year's Eve", "12-31"), ("New Year's Day", "01-01"),
         ("Super Bowl Sunday", "super_bowl"), ("Valentine's Day", "02-14"), ("the Snow Ball", "snow_ball"),
         ("spring break", "spring_break"), ("Easter", "easter"), ("prom week", "prom_week"), ("prom", "prom"),
         ("Mother's Day", "mothers_day"), ("Memorial Day", "memorial_day"), ("graduation", "graduation"),
         ("last day of school", "last_day_of_school"), ("Father's Day", "fathers_day"), ("July 4th", "07-04")]
SUMMER_DAYS = [("first day at Watch Hill", "watch_hill_first"), ("last night at Watch Hill", "watch_hill_last")]


def _h(*parts) -> int:
    return zlib.crc32(":".join(str(p) for p in parts).encode())


def md(day: int) -> str:
    d = calm.date_of(day)
    return f"{MON[d.month]} {d.day}"


def label(day: int) -> str:
    d = calm.date_of(day)
    return f"{DAYS[d.weekday()]} {MON[d.month]} {d.day}, {d.year}"


def year_of_grade(sim, word: str) -> int | None:
    """The school year (0 = 2010-11) of 'sophomore' for you."""
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if me is None or not me.grade:
        return None
    now = calm.school_year_of(w.day)
    words = YEAR_WORDS + ["college freshman", "college sophomore", "college junior", "college senior"]
    if word not in words:
        return None
    return now + (words.index(word) + 9) - me.grade


def year_word(sim, y: int) -> str:
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    g = (me.grade or 9) + (y - calm.school_year_of(w.day)) if me else 9
    words = {9: "freshman", 10: "sophomore", 11: "junior", 12: "senior", 13: "college freshman", 14: "college sophomore",
             15: "college junior", 16: "college senior"}
    return words.get(g, f"{2010 + y}-{str(2011 + y)[2:]}")


def schedule_order(sim, g, year: int) -> list:
    """The league's opponents in order for a team's season (the same order league.py plays them in)."""
    from . import league as lg
    key = f"{g['id']}:{calm.START.year + year}"  # (league.py names a season by the year it starts: 2011)
    order = sorted(lg._names(sim, g), key=lambda n: lg._h(key, "order", n))
    riv = lg.rival(sim, g)
    if riv in order:
        order.remove(riv)
        order.insert(max(0, min(len(order), 7)), riv)
    return order


def items(sim, year: int) -> list:
    """The year's calendar items: the real ones for this school year (they may have changed: a team out of a
    tournament), the ones the game will build for a later year."""
    w = sim.w
    now = calm.school_year_of(w.day)
    if year == now:
        return [i for i in w.calendar if calm.school_year_of(i["day"]) == year]
    if year < now:
        return []
    return calm.build_year(w, sim.cat, year)


def team_games(sim, gid: str, year: int) -> list:
    """[{n, day, opp, rival, event, round}] for one team's season."""
    w = sim.w
    g = w.groups.get(gid)
    if not g:
        return []
    order = schedule_order(sim, g, year)
    from . import league as lg
    riv = lg.rival(sim, g)
    out = []
    for i in sorted((i for i in items(sim, year) if i.get("group") == gid and i["kind"] == "game"), key=lambda i: i["day"]):
        tail = str(i["key"]).split(":")[-1]
        n = int(tail) if tail.isdigit() else None
        opp = i.get("opp") or (order[(n - 1) % len(order)] if n and order else None)
        out.append({"n": n, "day": i["day"], "opp": opp, "rival": bool(opp and opp == riv and not i.get("stage")),
                    "event": i.get("event"), "round": i.get("round_name"), "stage": i.get("stage")})
    return out


def _named_day(sim, key: str, year: int) -> int | None:
    cal = sim.cat.world["calendar"]
    a, b = calm.md_to_day(year, (9, 1)), calm.md_to_day(year, (8, 31))
    if re.fullmatch(r"\d\d-\d\d", key):
        m, d = int(key[:2]), int(key[3:])
        return calm.md_to_day(year, (m, d))
    if key == "watch_hill_first":
        return calm.md_to_day(year, (6, 1))
    if key == "watch_hill_last":
        return calm.md_to_day(year, (8, 30))
    for x in range(a, b + 1):
        if calm.date_matches(x, [key], cal):
            return x
    return None


def named_days(sim, year: int) -> list:
    out = []
    for name, key in NAMED + SUMMER_DAYS:
        d = _named_day(sim, key, year)
        if d is not None:
            out.append((name, d))
    return sorted(out, key=lambda x: x[1])


def teams(sim) -> list:
    w = sim.w
    return sorted((g for g in w.groups.values() if g.get("kind") == "team" and g.get("first_game") and g.get("school", "hchs") == "hchs"),
                  key=lambda g: list(SPORT_NAMES).index(g["id"]) if g["id"] in SPORT_NAMES else 99)


def family_teams(sim) -> list:
    """The teams that matter to your story: yours and your family's (now or before), and the sports you're into."""
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if me is None:
        return []
    fam = [c for c in w.chars.values() if c.household_id and c.household_id == me.household_id]
    ids = set()
    for g in teams(sim):
        for c in fam:
            if c.id in g["members"] or any(c.id in (h.get("roster") or []) for h in g.get("history") or []) \
                    or (c.id == me.id and me.interests.get(g["skill"], 0) >= 60 and (g.get("gender") or "m") == me.gender):
                ids.add(g["id"])
    return [g for g in teams(sim) if g["id"] in ids]


def season_line(sim, g, year: int, full: bool) -> str:
    """'Football (Fridays): tryouts Sep 2; games 1 Sep 9 Amity, 2 Sep 16 Branford, ... 8 Oct 28 Hand (rivalry) ...'"""
    games = team_games(sim, g["id"], year)
    t = next((i["day"] for i in items(sim, year) if i.get("group") == g["id"] and i["kind"] == "tryout"), None)
    days = "/".join(DAYS[d] for d in g.get("game_days") or [])
    bits = [f"tryouts {md(t)}" if t is not None else None]
    reg = [x for x in games if not x["stage"]]
    if full:
        gl = []
        for x in reg:
            tag = "Thanksgiving game" if x["event"] == "thanksgiving" else "holiday tournament" if x["event"] == "holiday" else None
            gl.append(f"{x['n']} {md(x['day'])} {x['opp'] or ''}{' (rivalry)' if x['rival'] else ''}{f' ({tag})' if tag else ''}".strip())
        bits.append("games: " + ", ".join(gl))
    elif reg:
        bits.append(f"{len(reg)} games {days} from {md(reg[0]['day'])}")
        riv = next((x for x in reg if x["rival"]), None)
        if riv:
            bits.append(f"rivalry game {riv['n']} vs {riv['opp']} {md(riv['day'])}")
    if reg:
        bits.append(f"regular season ends {md(reg[-1]['day'])}")
    stages = {}
    for x in games:
        if x["stage"]:
            stages.setdefault(x["stage"], []).append(x)
    for st, xs in stages.items():
        nm = "SCC tournament" if st == "scc" else "state tournament" if g["id"] != "football" else "state playoffs"
        bits.append(f"{nm} {md(xs[0]['day'])}-{md(xs[-1]['day'])} (" + ", ".join(f"{x['round'].split(', ')[-1].replace('State ', '').replace('SCC ', '')} {md(x['day'])}" for x in xs) + ")")
    return f"{SPORT_NAMES.get(g['id'], g['name'])} ({days}): " + "; ".join(b for b in bits if b) + "."


def year_text(sim, year: int, full_teams=None) -> str:
    """One school year of the calendar, for a prompt."""
    full = {g["id"] for g in (full_teams if full_teams is not None else family_teams(sim))}
    a = 2010 + year
    L = [f"### {year_word(sim, year).title()} year ({a}-{str(a + 1)[2:]})", ""]
    nd = named_days(sim, year)
    school = [f"{n} {md(d)}" for n, d in nd if calm.date_of(d).month not in (6, 7, 8) or n in ("graduation", "last day of school")]
    summer = [f"{n} {md(d)}" for n, d in nd if calm.date_of(d).month in (6, 7, 8) and n not in ("graduation", "last day of school")]
    L.append("- Days: " + ", ".join(school) + ".")
    for g in teams(sim):
        L.append("- " + season_line(sim, g, year, g["id"] in full))
    L.append("- Summer (at Watch Hill, no school or teams): " + ", ".join(summer) + ".")
    return "\n".join(L)


def years_for(sim, years_words=None) -> list:
    """The school years to print: the storyline's (by its years: line), else this one and the rest of high school."""
    w = sim.w
    now = calm.school_year_of(w.day)
    if years_words:
        ys = sorted({y for y in (year_of_grade(sim, x) for x in years_words) if y is not None and y >= now})
        if ys:
            return ys
    me = w.chars.get(w.meta.get("protagonist") or "")
    last = now + max(0, 12 - (me.grade or 12)) if me and me.grade and me.grade <= 12 else now
    return list(range(now, last + 1))


def text(sim, years_words=None) -> str:
    ys = years_for(sim, years_words)
    full = family_teams(sim)
    head = ("## The calendar (plan every scene on it)\n\nThis is exactly how the game plays each year. Game numbers and "
            "opponents are the real ones (your games, game by game; the other teams in short). Tournaments only happen "
            "for a team that qualifies, and a loss ends one.\n")
    # (the years a storyline names, game by game; with none named, this year and next in full and the rest in short)
    detail = set(ys) if years_words else set(ys[:2])
    return head + "\n" + "\n\n".join(year_text(sim, y, full if y in detail else []) for y in ys) + "\n"


# ------------------------------------------------------------------------------------------------ what a when means
def describe(sim, when: str, years_words=None) -> str | None:
    """'football game 3 · big' -> 'Fri Sep 23, 2011: football game 3 vs Branford' (for the scene prompt). None when it
    isn't one exact day (a month, game day in general)."""
    from . import cues
    toks = [t.strip() for t in re.split(r"\s*[·;,]\s*", when or "") if t.strip()]
    ys = years_for(sim, years_words)
    for t in toks:
        mo = cues.parse_tag(t)
        if mo and mo["kind"] in ("game_n", "game_vs", "thanksgiving_game"):
            for y in ys:
                gid = _team_id(sim, mo)
                if not gid:
                    break
                for x in team_games(sim, gid, y):
                    if x["stage"]:
                        continue
                    hit = (mo["kind"] == "game_n" and x["n"] == mo.get("n")) or \
                          (mo["kind"] == "game_vs" and (x["opp"] or "").lower() == str(mo.get("opp", "")).lower()) or \
                          (mo["kind"] == "thanksgiving_game" and x["event"] == "thanksgiving")
                    if hit:
                        return f"{label(x['day'])}: {SPORT_NAMES.get(gid, gid).lower()} game {x['n']} vs {x['opp']}" + (" (the rivalry game)" if x["rival"] else "")
        for name, key in NAMED + SUMMER_DAYS:
            if t.lower() == name.lower() and ys:
                d = _named_day(sim, key, ys[0])
                if d is not None:
                    return f"{label(d)}: {name}"
    return None


def _team_id(sim, mo) -> str | None:
    sport = mo.get("sport")
    if not sport:
        me = sim.w.chars.get(sim.w.meta.get("protagonist") or "")
        sport = next((sim.w.groups[g]["skill"] for g in (me.memberships if me else []) if sim.w.groups.get(g, {}).get("kind") == "team"), None)
    if not sport:
        return None
    me = sim.w.chars.get(sim.w.meta.get("protagonist") or "")
    side = [g for g in teams(sim) if g["skill"] == sport]
    if mo.get("owner") and me is not None:
        return next((g["id"] for g in side if g.get("gender") == "f"), side[0]["id"] if side else None) if len(side) > 1 else (side[0]["id"] if side else None)
    mine = [g for g in side if (g.get("gender") or "m") == (me.gender if me else "m")]
    return (mine or side)[0]["id"] if (mine or side) else None


# ------------------------------------------------------------------------------------------------ checking an outline
def check_outline(sim, outline: list, years_words=None) -> list:
    """What's off the calendar in an outline: (number, problem). A when that isn't one of the calendar's words, a game
    number past the season, an opponent who isn't on the schedule, a week with too many scenes."""
    from . import cues, script
    probs = []
    ys = years_for(sim, years_words)
    weeks: dict = {}

    class _Sec:
        pending_after: list = []
        cast: dict = {}
    for e in outline:
        n = e.get("n")
        raw = e.get("when_raw") if e.get("when_raw") is not None else e.get("when") or ""
        toks = [t.strip() for t in re.split(r"\s*[·;,]\s*", raw) if t.strip()]
        for t in toks:
            if t.lower() in ("any", "anytime", "-", "—", "whenever"):
                continue
            mo = cues.parse_tag(t)
            if mo is None and re.match(r"(after|before|if|unless|with)\s", t.lower()):
                probs.append((n, f"“{t}” isn't on the calendar (the order comes from the scene numbers)"))
                continue
            try:
                script.tags(t, None, 0, {}, _Sec())
            except Exception:  # noqa: BLE001
                probs.append((n, f"“{t}” isn't on the calendar"))
                continue
            if mo and mo["kind"] in ("game_n", "game_vs") and ys:
                gid = _team_id(sim, mo)
                games = [x for x in team_games(sim, gid, ys[0]) if not x["stage"]] if gid else []
                if mo["kind"] == "game_n" and games and not any(x["n"] == mo.get("n") for x in games):
                    probs.append((n, f"“{t}”: there are {len(games)} {SPORT_NAMES.get(gid, gid).lower()} games"))
                if mo["kind"] == "game_vs" and games and not any((x["opp"] or "").lower() == str(mo.get("opp", "")).lower() for x in games):
                    opps = sorted({x["opp"] for x in games if x["opp"]})
                    probs.append((n, f"“{t}”: {mo.get('opp')} isn't on the schedule ({', '.join(opps)})"))
        wk = _week_key(raw, sim, years_words)
        if wk:
            weeks.setdefault(wk, []).append(n)
    for k, ns in weeks.items():
        if k and len(ns) > 3:
            probs.append((ns[0], f"scenes {', '.join(str(x) for x in ns)} are all in one week: spread them out (2 or 3 a week at most)"))
    return probs


def _week_key(raw, sim, years_words):
    d = describe(sim, raw, years_words)
    if not d:
        return None
    try:
        when = dt.datetime.strptime(d.split(":")[0], "%a %b %d, %Y").date()
    except ValueError:
        return None
    return when.isocalendar()[:2]


def years_in(text: str) -> list:
    m = re.search(r"^\s*years:\s*(.+)$", text or "", re.M | re.I)
    if not m:
        return []
    raw = m.group(1).lower()
    words = []
    r = re.match(r"\s*(freshman|sophomore|junior|senior)\s*(?:-|to)\s*(freshman|sophomore|junior|senior)", raw)
    if r:
        a, b = YEAR_WORDS.index(r.group(1)), YEAR_WORDS.index(r.group(2))
        return YEAR_WORDS[a:b + 1]
    for x in YEAR_WORDS:
        if re.search(rf"\b{x}\b", raw):
            words.append(x)
    return words


def fix_prompt(sim, text: str, probs: list) -> str:
    """Send the outline back to ChatGPT with what's off the calendar: the same outline, those whens fixed."""
    from . import script
    L = ["This LIFE OS outline has scenes that aren't on the game's calendar. Send back the WHOLE outline, the same "
         "numbers, titles, people and what happens, with only these fixed:", ""]
    L += [f"- Scene {n}: {why}" for n, why in probs]
    L += ["", "Every scene's when is exactly one of these (plus `big` or `finale` after a ·):", script.WHEN_WORDS, "",
          text_for_years(sim, years_in(text)), "", "## The outline", "", "```", (script.extract(text) or text).strip(), "```", "",
          "Reply with ONE code block holding the whole outline, nothing after it."]
    return "\n".join(L)


def text_for_years(sim, words) -> str:
    return text(sim, words or None)
