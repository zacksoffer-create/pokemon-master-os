"""Seasons: the School Year (Sept 1 to May 31) and the Summer (June 1 to Aug 31). At a season's end the story stops for
the season break (the loading screen): a report of the season (storylines played and missed, your teams, big moments),
a clean-out of what the game kept only to explain the past, and a check of every storyline in the season ahead."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import dialogue, scheduler, seasons  # noqa: E402
from lifeos.engine import Simulation  # noqa: E402
from lifeos.story import begin, create_story  # noqa: E402
from tests.test_story import spec  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def world():
    sim = Simulation(create_story(spec(per=6)))
    begin(sim)
    return sim, sim.w.chars[sim.w.meta["protagonist"]]


def add(sim, text):
    r = dialogue.add_script(text)
    assert r["ok"], r.get("errors")
    sim.cat = sim.cat.__class__(sim.w.action_overrides)
    scheduler._cat_cache.clear()
    return r["ids"][0], scheduler.catalog(sim)


def to_day(sim, day):
    """Jump to the night before `day` and live into it (its dawn runs)."""
    w = sim.w
    w.day = day - 1
    w.phase = len(calm.phases_for(w.day, sim.cat.world["calendar"])) - 1
    while w.day < day:
        sim.step()
    sim.step()  # its morning


def test_two_seasons_a_year():
    sep1, may31, jun1, aug31 = calm.md_to_day(0, (9, 1)), calm.md_to_day(0, (5, 31)), calm.md_to_day(0, (6, 1)), calm.md_to_day(0, (8, 31))
    assert seasons.season_id(sep1) == seasons.season_id(may31) == "0-school"
    assert seasons.season_id(jun1) == seasons.season_id(aug31) == "0-summer"
    assert seasons.season_id(aug31 + 1) == "1-school"
    assert seasons.bounds("0-school") == (sep1, may31) and seasons.bounds("0-summer") == (jun1, aug31)
    sim, me = world()
    assert seasons.label(sim.w, "0-school") == "Freshman year" and seasons.label(sim.w, "0-summer") == "Summer after freshman year"
    assert seasons.label(sim.w, "1-school") == "Sophomore year"
    # school's out May 31: the summer break, finals, report cards and graduation are all before June
    cal = sim.cat.world["calendar"]
    assert calm.break_name(jun1, cal) == "Summer" and calm.break_name(may31, cal) != "Summer"


def test_the_story_stops_at_the_end_of_the_school_year_for_the_break():
    sim, me = world()
    w = sim.w
    to_day(sim, 1)  # (the first morning notes the season)
    assert w.meta["season"] == "0-school" and not seasons.due(w)
    to_day(sim, calm.md_to_day(0, (6, 1)))
    assert seasons.due(w) and w.meta["season_break"]["from"] == "0-school" and w.meta["season_break"]["to"] == "0-summer"
    st = seasons.state(w)
    assert st["status"] == "due" and st["from_label"] == "Freshman year" and st["to_label"] == "Summer after freshman year"


STORY = """=== The Year
cast: bro = older brother
years: freshman

outline:
1. October Thing | October | Something in October.
2. March Thing | March | Something in March.
3. Summer Thing | July | Something in July.
4. Hoops Night | December | A big game. | game: win

--- 1. October Thing
bro: October.
* "Okay."
bro: Good.

--- 2. March Thing
bro: March.
* "Okay."
bro: Good.

--- 3. Summer Thing
bro: July.
* "Okay."
bro: Good.

--- 4. Hoops Night
It's game day.
bro: Big game.
* "Let's go." | play basketball
bro: Go.
"""


def test_the_break_reports_cleans_out_and_looks_ahead():
    sim, me = world()
    w = sim.w
    pk, cat = add(sim, STORY)
    ch = cat["chapters"][pk]
    oct_day = calm.md_to_day(0, (10, 10))
    scheduler.done_map(w)[ch[0]] = [oct_day]  # October played; March never did
    scheduler.seen_map(w)[ch[0]] = [oct_day]
    # things the game only keeps to explain the past
    w.history.add_trace({"day": oct_day, "char": me.id, "candidates": [{"a": "x"}] * 50})
    eid = w.history.add({"day": oct_day, "type": "test", "outcome": "x", "actors": [me.id], "targets": [], "importance": 50,
                         "text": "A big day.", "changes": [[me.id, "mood", 1, 2, "x"]] * 20, "calc": [{"step": "x"}]})
    to_day(sim, 1)
    to_day(sim, calm.md_to_day(0, (6, 1)))
    r = seasons.run_break(sim)
    assert r["ok"] and r["status"] == "done", r
    rep = r["report"]
    row = next(s for s in rep["storylines"] if s["pack"] == pk)
    assert row["played"] == 1 and sorted(m["title"] for m in row["missed"]) == ["Hoops Night", "March Thing"], row
    assert rep["cleaned"]["traces"] >= 1 and rep["cleaned"]["events_trimmed"] >= 1
    assert "changes" not in w.history.events[eid] and "calc" not in w.history.events[eid] and w.history.events[eid]["text"] == "A big day."
    assert not [t for t in w.history.traces.values() if t["day"] < calm.md_to_day(0, (6, 1))]
    ahead = rep["ahead"]
    assert any(s["pack"] == pk and s["scenes"] == 1 for s in ahead["storylines"]), ahead  # the July scene
    assert w.meta["seasons"]["0-school"]["label"] == "Freshman year"
    assert seasons.run_break(sim)["report"] == rep  # it runs once
    seasons.seen(w)
    assert seasons.state(w) is None


def test_the_look_ahead_catches_a_game_storyline_without_a_team():
    sim, me = world()
    pk, cat = add(sim, STORY)
    ahead = seasons.look_ahead(sim, "0-school")
    row = next(s for s in ahead["storylines"] if s["pack"] == pk)
    assert any("basketball" in x and "not on a basketball team" in x for x in row["issues"]), row


def test_an_advance_stops_at_the_break_and_the_phone_runs_it():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    sim = api.lab.sim
    w = sim.w
    import time
    from lifeos import moments
    w.meta["season"] = "0-school"
    w.day = calm.md_to_day(0, (5, 29))
    j = {}
    for _ in range(30):
        for m in moments.pending(w):
            moments.resolve(sim, m["id"], None)
        j = c.post("/api/story/advance", json={"until": "week"}).json()
        while j.get("status") == "running":
            time.sleep(0.05)
            j = c.get("/api/sim/job").json()
        if seasons.due(w):
            break
    assert seasons.due(w) and j.get("stop") == "season_break", j
    assert w.day == calm.md_to_day(0, (6, 1)), calm.label(w.day)  # it stopped on the first day of summer
    st = c.get("/api/phone/state").json()
    assert st["season_break"]["status"] == "due" and st["season"]["part"] == "summer", st["season_break"]
    r = c.post("/api/phone/season/break").json()
    assert r["status"] == "done" and r["report"]["label"] == "Freshman year"
    assert c.post("/api/phone/season/seen").json()["ok"]
    assert c.get("/api/phone/state").json()["season_break"] is None
