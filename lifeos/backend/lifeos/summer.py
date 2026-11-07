"""Summer at Watch Hill.

Every summer the family goes to the Watch Hill house the day after school's out (or after your spring season, if your
team is still playing in June), and comes home before school starts. The people in your Watch Hill storylines are there
too (Nikki, the Watch Hill crowd); everyone else is a text away. A summer day has a morning: your workout is your
routine (what you do unless you pick something else: a run on the beach, sleeping in, breakfast with the family), then
the afternoon and the night are yours: the beach, Bay Street, Napatree Point, the boat, a bonfire, or whoever wants to
hang out. No school, no teams, no job.
"""
from __future__ import annotations

from . import calendar as calm

WATCH_HILL = "watch_hill"
PLACE = "Watch Hill"


def is_summer(sim, day=None) -> bool:
    return calm.break_name(sim.w.day if day is None else day, sim.cat.world["calendar"]) == "Summer"


def state(w) -> dict:
    return w.meta.setdefault("watch_hill", {})


def here(w, c) -> bool:
    return c is not None and c.location == WATCH_HILL


def crowd(sim) -> list:
    """Who's at Watch Hill: your household, and the people in your Watch Hill storylines."""
    from . import dialogue
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if me is None:
        return []
    ids = [c.id for c in w.chars.values() if c.household_id and c.household_id == me.household_id]
    slots = w.meta.get("cast_slots") or {}
    wh = {p["id"] for p in dialogue.packs() if "watch hill" in str((p.get("pack") or {}).get("name") or "").lower()}
    if wh:
        for name, d in (dialogue.merged().get("cast") or {}).items():
            if not set(d.get("packs") or []) & wh:
                continue
            e = slots.get(name)
            cid = e.get("id") if isinstance(e, dict) else e
            if cid in w.chars and cid not in ids:
                ids.append(cid)
    return [i for i in ids if w.chars[i].status == "active"]


def _season_still_on(sim, me) -> bool:
    """Your spring team is still playing (the state tournament runs into June)."""
    w = sim.w
    y = calm.school_year_of(w.day)
    return any(i.get("kind") == "game" and i.get("group") in me.memberships and i["day"] >= w.day
               and calm.school_year_of(i["day"]) == y for i in w.calendar)


def daily(sim) -> None:
    """Each morning: go to Watch Hill when summer starts, bring anyone new along, come home when it ends."""
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if me is None:
        return
    st = state(w)
    last_day = is_summer(sim) and not is_summer(sim, w.day + 1)  # (home the day before school starts)
    if is_summer(sim) and not st.get("on") and not last_day:
        if me.location in ("away", "college") or _season_still_on(sim, me):
            return
        go(sim)
    elif st.get("on") and (not is_summer(sim) or last_day):
        come_home(sim)
    elif st.get("on"):
        _bring(sim, crowd(sim))  # (someone a storyline cast this week comes too)


def _bring(sim, ids) -> list:
    w = sim.w
    st = state(w)
    home = st.get("home") or "hollow_creek"
    moved = []
    for cid in ids:
        c = w.chars[cid]
        if c.location == WATCH_HILL or c.location in ("away", "college") or (c.location != home and c.role != "student"):
            continue
        c.flags["summer_home"] = c.location
        c.location = WATCH_HILL
        moved.append(cid)
    st["ids"] = sorted(set(st.get("ids") or []) | set(moved))
    return moved


def go(sim) -> None:
    w = sim.w
    me = w.chars[w.meta["protagonist"]]
    st = state(w)
    st.update({"on": True, "since": w.day, "home": me.location, "ids": []})
    _bring(sim, crowd(sim))
    ev = w.history.add_event if hasattr(w.history, "add_event") else None
    if ev is None:
        return


def come_home(sim) -> None:
    """Summer's over: everyone who's still at Watch Hill goes home (someone who left for college already went)."""
    w = sim.w
    st = state(w)
    for cid in st.get("ids") or []:
        c = w.chars.get(cid)
        if c is not None and c.location == WATCH_HILL:
            c.location = c.flags.pop("summer_home", None) or st.get("home") or "hollow_creek"
    st.update({"on": False, "ids": [], "back": w.day})


def upgrade(sim) -> None:
    """A save made before summer had a morning: if it's a summer day already under way, keep its part of the day."""
    w = sim.w
    if w.meta.get("summer_morning_v"):
        return
    w.meta["summer_morning_v"] = 1
    if is_summer(sim) and w.phase >= 1:
        w.phase = min(w.phase + 1, len(calm.SUMMER_PHASES) - 1)


HEADERS = {
    "morning": ("beach", "Morning at Watch Hill", "The house is still quiet. The water's flat and your running shoes are by the door."),
    "day": ("beach", "Watch Hill", "Summer at Watch Hill. The beach is filling up and Bay Street smells like fried dough."),
    "evening": ("beach", "Tonight at Watch Hill", "The sun's going down over the water. Somebody's already talking about a fire."),
    "night": ("beach", "Watch Hill, late", "The porch light's on. Your phone keeps buzzing."),
}
