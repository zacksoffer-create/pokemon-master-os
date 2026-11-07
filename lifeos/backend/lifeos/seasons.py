"""Seasons: the School Year (September 1 to May 31) and the Summer (June 1 to August 31), two to a year.

When one ends, the story stops for a short loading screen (FIFA career mode's end of season) that closes the books on it:
- the season report: every storyline's scenes that played this season and the ones that didn't (and why), your teams'
  records and your lines, the big moments;
- the clean-out: everything the game kept only to explain the past in the lab (each decision's every option, each
  event's step-by-step changes) goes for the season that ended, and finished scenes go from the moment list. The events
  themselves stay. This is what keeps a save from growing by ~150 MB a school year;
- the look ahead: every storyline with scenes in the new season, checked now (is there someone to cast, are you on the
  team its games need), so a problem shows up while you can still fix it;
- the season's summary is kept (w.meta["seasons"]) for the yearbook.
The new school year's own rollover (grades, graduations, new freshmen) happens on September 1 as before.
"""
from __future__ import annotations

import time

from . import calendar as calm

SUMMER_MONTHS = (6, 7, 8)
GRADE_WORD = {9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior", 13: "College freshman", 14: "College sophomore",
              15: "College junior", 16: "College senior"}


def part_of(day: int) -> str:
    return "summer" if calm.date_of(day).month in SUMMER_MONTHS else "school"


def season_id(day: int) -> str:
    """'0-school' (the 2010-11 school year), '0-summer' (the summer of 2011): school year number, then which part."""
    return f"{calm.school_year_of(day)}-{part_of(day)}"


def bounds(sid: str) -> tuple:
    """(first day, last day) of a season."""
    yr, part = sid.split("-")
    yr = int(yr)
    if part == "summer":
        return calm.md_to_day(yr, (6, 1)), calm.md_to_day(yr, (8, 31))
    return calm.md_to_day(yr, (9, 1)), calm.md_to_day(yr, (5, 31))


def label(w, sid: str) -> str:
    """'Freshman year', 'Summer after freshman year' (by your grade then), or the years if there's no you."""
    yr, part = sid.split("-")
    yr = int(yr)
    me = w.chars.get(w.meta.get("protagonist") or "")
    if me is not None and me.grade:
        g = me.grade - (calm.school_year_of(w.day) - yr)
        word = GRADE_WORD.get(g)
        if word:
            return f"{word} year" if part == "school" else f"Summer after {word.lower()} year"
    y0 = calm.START.year + yr
    return f"{y0}-{str(y0 + 1)[2:]} school year" if part == "school" else f"Summer {y0 + 1}"


def on_dawn(sim):
    """Each morning: a new season? Then the story stops for its break (the loading screen) before going on."""
    w = sim.w
    cur = season_id(w.day)
    prev = w.meta.get("season")
    if prev is None:
        w.meta["season"] = cur
        return
    if prev != cur:
        w.meta["season"] = cur
        w.meta["season_break"] = {"from": prev, "to": cur, "day": w.day, "status": "due"}


def due(w) -> bool:
    return (w.meta.get("season_break") or {}).get("status") == "due"


def state(w) -> dict | None:
    """For the phone: the break that's due (show the loading screen), or the report not seen yet."""
    sb = w.meta.get("season_break")
    if not sb or sb.get("status") == "seen":
        return None
    return {"status": sb["status"], "from": sb["from"], "to": sb["to"], "from_label": label(w, sb["from"]),
            "to_label": label(w, sb["to"]), "report": sb.get("report") if sb["status"] == "done" else None}


def run_break(sim) -> dict:
    """The loading screen: the season report, the clean-out, the look ahead. Safe to call again (it runs once)."""
    w = sim.w
    sb = w.meta.get("season_break")
    if not sb:
        return {"ok": False, "detail": "no season break"}
    if sb.get("status") != "due":
        return {"ok": True, **(state(w) or {}), "report": sb.get("report")}
    t0 = time.time()
    start, end = bounds(sb["from"])
    cut = bounds(sb["to"])[0]
    report = {"season": sb["from"], "label": label(w, sb["from"]), "next": sb["to"], "next_label": label(w, sb["to"])}
    report.update(season_report(sim, start, min(end, cut - 1)))
    report["cleaned"] = clean_out(sim, cut)
    report["ahead"] = look_ahead(sim, sb["to"])
    report["seconds"] = round(time.time() - t0, 1)
    page = {}
    me = w.chars.get(w.meta.get("protagonist") or "")
    if me is not None:
        from . import people
        page = people.page(sim, me)  # the yearbook page: superlatives, the top ten, where you stood
    w.meta.setdefault("seasons", {})[sb["from"]] = {**{k: report[k] for k in ("label", "storylines", "teams", "moments", "played", "missed")},
                                                    **page}
    sb["status"] = "done"
    sb["report"] = report
    return {"ok": True, **state(w)}


def seen(w):
    sb = w.meta.get("season_break")
    if sb and sb.get("status") == "done":
        sb["status"] = "seen"
        sb.pop("report", None)  # (it's kept, slimmer, in w.meta["seasons"])


# --- the season report -------------------------------------------------------------------------------------------------

def season_report(sim, start: int, end: int) -> dict:
    from . import dialogue, scheduler
    from .gameplay import line_words
    w = sim.w
    me = scheduler._me(sim)
    cat = scheduler.catalog(sim)
    done = scheduler.done_map(w)
    lg = scheduler.log(w)
    names = {p["id"]: (p.get("pack") or {}).get("name") or p["id"] for p in dialogue.packs()}
    by_pack: dict = {}
    for sid, sc in cat["scenes"].items():
        pk = sc.get("pack")
        if not pk:
            continue
        played = [d for d in done.get(sid, []) if start <= d <= end]
        meant = _meant_for(sim, me, sid, cat, start, end)
        if not played and not meant:
            continue
        row = by_pack.setdefault(pk, {"pack": pk, "name": names.get(pk, pk), "played": 0, "missed": []})
        if played:
            row["played"] += 1
        elif meant:
            note = lg.get(sid) or {}
            why = scheduler.REASON_TEXT.get(note.get("reason") or "", note.get("reason") or "it never came up")
            row["missed"].append({"title": (cat["info"].get(sid) or {}).get("title") or sid, "why": why})
    rows = sorted(by_pack.values(), key=lambda r: (-r["played"], r["name"]))
    teams = []
    if me is not None:
        for key, st in sorted(me.stats.items()):
            if not isinstance(st, dict) or not _key_in(key, start, end):
                continue
            teams.append({"team": st.get("team_name"), "level": st.get("level"), "sport": st.get("sport"), "games": st.get("games", 0),
                          "starts": st.get("starts", 0), "record": f"{st.get('wins', 0)}-{st.get('losses', 0)}",
                          "line": line_words(st.get("sport"), st.get("line") or {}) if st.get("line") else ""})
    moments = []
    if me is not None:
        for eid in w.history.by_char.get(me.id, []):
            e = w.history.events.get(eid)
            if e and start <= e["day"] <= end and e.get("importance", 0) >= 40 and e.get("text"):
                moments.append({"date": calm.label(e["day"]), "text": e["text"]})
    return {"storylines": rows, "played": sum(r["played"] for r in rows), "missed": sum(len(r["missed"]) for r in rows),
            "teams": teams, "moments": moments[-12:]}


def _meant_for(sim, me, sid, cat, start, end) -> bool:
    """Was this scene meant to happen in this season (its school year, and a month in the season)? Unplayed scenes
    whose time it was are the season's misses."""
    from . import scheduler
    if me is None:
        return False
    sc = cat["scenes"][sid]
    when = sc.get("when") or {}
    ys = scheduler._years(when)
    grade_then = (me.grade or 0) - (calm.school_year_of(sim.w.day) - calm.school_year_of(start))
    if not ys or grade_then not in ys:
        return False
    months = set(when.get("months") or [])
    if when.get("not_before"):
        months.add(int(when["not_before"][:2]))
    if not months:
        return False
    in_season = {calm.date_of(d).month for d in range(start, end + 1, 7)} | {calm.date_of(end).month}
    return bool(months & in_season)


def _key_in(key, start, end) -> bool:
    """A season stat key ('football:2010-11:jv') is this school year's."""
    try:
        y = int(key.split(":")[1][:4]) - calm.START.year
    except Exception:  # noqa: BLE001
        return False
    return y == calm.school_year_of(start) and part_of(start) == "school"


# --- the clean-out -----------------------------------------------------------------------------------------------------

def clean_out(sim, cut: int) -> dict:
    """Drop what the game kept only to explain the season that ended: decision traces, each event's change log and
    working-out, finished scenes. -> counts."""
    w = sim.w
    h = w.history
    tr = [tid for tid, t in h.traces.items() if t.get("day", 0) < cut]
    for tid in tr:
        del h.traces[tid]
    stripped = 0
    for ev in h.events.values():
        if ev.get("day", 0) < cut and (ev.pop("changes", None) is not None) | (ev.pop("calc", None) is not None):
            stripped += 1
    h.compact(cut, w.rules)  # the usual fold of old routine events
    ms = w.meta.get("moments") or []
    keep = [m for m in ms if m.get("status") == "pending" or m.get("day", cut) >= cut]
    dropped = len(ms) - len(keep)
    w.meta["moments"] = keep
    return {"traces": len(tr), "events_trimmed": stripped, "moments": dropped}


KEEP_DETAIL_DAYS = 14  # each event's change log and working-out is kept two weeks; after that only what happened stays
KEEP_TRACE_DAYS = 3  # decision notes (every option everyone near you weighed, ~170 a day): the last few days


def rolling_trim(sim, keep_days: int = KEEP_DETAIL_DAYS, trace_days: int = KEEP_TRACE_DAYS) -> dict:
    """Weekly (and when a save opens): the season break's clean-out, early, for the everyday stuff. Routine decision notes
    older than a few days and routine events' change logs older than two weeks go; the events stay, and anything
    important keeps its "why" for the lab. A save stays small (and fits in a phone's memory) between
    season breaks, not only after them. -> counts."""
    w = sim.w
    h = w.history
    cut = w.day - keep_days
    big = w.rules.get("history.event_keep_importance", 20)  # (what the lab keeps: why something important happened)

    def routine(t):
        ev = h.events.get(t.get("event")) if t.get("event") else None
        return ev is None or ev.get("importance", 0) < big
    tr = [tid for tid, t in h.traces.items() if t.get("day", 0) < w.day - trace_days and routine(t)]
    for tid in tr:
        del h.traces[tid]
    stripped = 0
    for ev in h.events.values():
        if ev.get("day", 0) >= cut:
            break
        if ev.get("importance", 0) < big and (ev.pop("changes", None) is not None) | (ev.pop("calc", None) is not None):
            stripped += 1
    return {"traces": len(tr), "events_trimmed": stripped}


# --- the look ahead ----------------------------------------------------------------------------------------------------

def look_ahead(sim, sid_season: str) -> dict:
    """Every storyline with scenes in the new season: how many, and anything that would stop them (nobody to cast, a
    game storyline for a team you're not on)."""
    from . import dialogue, scheduler
    w = sim.w
    me = scheduler._me(sim)
    cat = scheduler.catalog(sim)
    start, end = bounds(sid_season)
    names = {p["id"]: (p.get("pack") or {}).get("name") or p["id"] for p in dialogue.packs()}
    seen_ = scheduler.seen_map(w)
    rows: dict = {}
    for sid, sc in cat["scenes"].items():
        pk = sc.get("pack")
        if not pk or sid in seen_ or not _meant_for(sim, me, sid, cat, start, end):
            continue
        row = rows.setdefault(pk, {"pack": pk, "name": names.get(pk, pk), "scenes": 0, "issues": []})
        row["scenes"] += 1
        if me is None:
            continue
        miss = scheduler.castable(sim, me, sid, cat)
        if miss and len(row["issues"]) < 3:
            text = f"nobody to play {miss[1]} yet (Roles shows who fits)"
            if text not in row["issues"]:
                row["issues"].append(text)
        gd = (cat["info"].get(sid) or {}).get("game_day")
        if gd and not any((w.groups.get(g) or {}).get("skill") == gd["sport"] for g in me.memberships):
            text = f"has {gd['sport']} games in it, and you're not on a {gd['sport']} team (make it at the tryout, or Teams in the editor)"
            if text not in row["issues"]:
                row["issues"].append(text)
    out = sorted(rows.values(), key=lambda r: (not r["issues"], -r["scenes"], r["name"]))
    return {"storylines": out, "ready": sum(1 for r in out if not r["issues"]), "need": sum(1 for r in out if r["issues"]),
            "scenes": sum(r["scenes"] for r in out)}
