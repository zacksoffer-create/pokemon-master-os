"""Story mode, sports and life after high school."""
import os
import sys
import time

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import moments  # noqa: E402
from lifeos.engine import Simulation  # noqa: E402
from lifeos.story import StoryError, begin, create_story, validate_story  # noqa: E402


def spec(grade=9, per=8, **kw):
    s = {"title": "Test story",
         "protagonist": {"first": "Zack", "last": "Soffer", "gender": "m", "grade": grade, "archetype": "athlete", "attracted_to": ["f"],
                         "traits": {"discipline": 75, "competitiveness": 85}, "aptitudes": {"athletic": 85},
                         "interests": {"football": 85, "basketball": 80, "baseball": 90},
                         "skills": {"football": 45, "basketball": 48, "baseball": 55},
                         "body": {"height_in": 71, "build": "athletic"}, "positions": {"football": "WR", "basketball": "SG", "baseball": "SS"},
                         "jersey": 2, "birthday": [4, 12]},
         "family": {"last": "Soffer", "guardians": ["Linda Soffer", "Rob Soffer"], "style": "warm", "income": "middle"},
         "siblings": [{"key": "bro", "first": "Mike", "gender": "m", "grade": 12, "archetype": "athlete"},
                      {"key": "ally", "first": "Ally", "gender": "f", "grade": 11},
                      {"key": "jen", "first": "Jen", "gender": "f", "grade": 11, "twin_of": "ally"}],
         "cast": [{"key": "bf", "first": "Danny", "last": "Kim", "gender": "m", "grade": 9, "archetype": "athlete",
                   "relationships": [{"to": "me", "type": "best_friend"}]},
                  {"key": "rival", "first": "Cole", "last": "Price", "gender": "m", "grade": 9,
                   "relationships": [{"to": "me", "type": "rival"}]},
                  {"key": "coach", "role": "staff", "first": "Frank", "last": "Duda", "gender": "m", "coach_of": "baseball"}],
         "students_per_grade": per, "gen_seed": 77}
    s.update(kw)
    return s


def test_story_builds_you_your_family_and_your_people():
    w = create_story(spec())
    sim = Simulation(w)
    begin(sim)
    me = w.chars[w.meta["protagonist"]]
    keys = w.meta["story"]["keys"]
    assert me.grade == 9 and me.custom and me.positions["baseball"] == "SS" and me.body["height_in"] == 71 and me.jersey == 2
    assert calm.date_of(me.birth_day).month == 4 and calm.date_of(me.birth_day).day == 12
    sibs = {w.chars[s].first: w.chars[s] for s in sim.siblings(me.id)}
    assert sibs["Mike"].grade == 12 and sibs["Ally"].grade == 11 and sibs["Jen"].grade == 11
    assert sibs["Ally"].birth_day == sibs["Jen"].birth_day
    assert "twin" in w.bond(keys["ally"], keys["jen"])["roles"]
    assert all("sibling" in w.bond(me.id, s.id)["roles"] for s in sibs.values())
    assert w.rels[(keys["bf"], me.id)].affection >= 80 and w.rels[(me.id, keys["bf"])].label in ("best friend", "close friend")
    assert w.rels[(keys["rival"], me.id)].rivalry >= 60
    assert w.groups["baseball"]["staff"] == keys["coach"]
    for g in (9, 10, 11, 12):
        assert sum(1 for c in w.students() if c.grade == g) == 8
    pend = moments.pending(w)
    assert pend and pend[0]["kind"] == "first_day"


def test_story_validation_lists_every_problem():
    bad = spec()
    bad["protagonist"] = {"first": "", "gender": "q", "grade": 14, "traits": {"swagger": 50}, "positions": {"football": "XX"}}
    bad["cast"][0]["relationships"] = [{"to": "nobody", "type": "best_friend"}]
    with pytest.raises(StoryError) as e:
        validate_story(bad)
    msg = " | ".join(e.value.errors)
    for frag in ("first name", "gender", "grade", "swagger", "position", "nobody"):
        assert frag in msg


def test_moment_choices_change_state_and_are_recorded():
    w = create_story(spec())
    sim = Simulation(w)
    begin(sim)
    m = moments.pending(w)[0]
    ev = moments.resolve(sim, m["id"], 0)
    assert w.meta["control"]["focus"] == "athletics"
    tryout = next(i for i in w.calendar if i["kind"] == "tryout" and i["group"] == "football")
    assert w.meta["protagonist"] in w.registrations[tryout["key"]]
    assert ev["type"] == "moment" and ev["id"] in w.history.events
    with pytest.raises(ValueError):
        moments.resolve(sim, m["id"], 0)


def test_football_season_has_rosters_box_scores_and_stats():
    w = create_story(spec(per=10))
    w.tracing = True
    sim = Simulation(w)
    begin(sim)
    moments.resolve(sim, moments.pending(w)[0]["id"], 0)
    sim.advance_days(45)
    g = w.groups["football"]
    assert len(g["members"]) >= 11 and set(g["levels"].values()) <= {"varsity", "jv"}
    games = [e for e in w.history.events.values() if e["type"] == "game" and e["outcome"] in ("win", "loss")]
    assert games and all(e["data"]["box"] for e in games)
    played = [c for c in w.chars.values() if any(k.startswith("football:") for k in c.stats)]
    assert played
    st = next(st for c in played for k, st in c.stats.items() if k.startswith("football:"))
    assert st["games"] >= 1 and st["line"] is not None and st["impact"] > 0
    me = w.chars[w.meta["protagonist"]]
    assert "football" in me.memberships or any(e["type"] == "tryout" and me.id in e["actors"] for e in w.history.events.values())


def test_senior_year_ends_in_a_path_and_college_life():
    w = create_story(spec(grade=12, per=6, siblings=[], cast=[]))
    w.tracing = False
    sim = Simulation(w)
    begin(sim)
    me = w.chars[w.meta["protagonist"]]
    grad = next(i for i in w.calendar if i["kind"] == "graduation")
    while w.day < grad["day"]:
        sim.advance_days(7)
        for m in moments.pending(w):
            if m["kind"] == "college_decision":
                opts = m["ctx"]["paths"]
                pick = next((i for i, o in enumerate(opts) if o["kind"] == "college"), 0)
                moments.resolve(sim, m["id"], pick)
            else:
                moments.resolve(sim, m["id"], None)
    sim.advance_days(2)
    assert me.role == "alumni" and me.path, "every senior leaves with a path"
    if me.path["kind"] != "college":
        me.path = {"kind": "college", "college": "millbrook", "name": "Millbrook College", "tier": "D3", "sport": "baseball", "scholarship": False}
    others = [c for c in w.chars.values() if c.role == "alumni" and c.id != me.id]
    assert others and all(c.path for c in others)
    while calm.school_year_of(w.day) == 0:
        sim.advance_days(1)
        for m in moments.pending(w):
            moments.resolve(sim, m["id"], None)
    sim.advance_days(1)
    assert me.school == "college" and me.location == "college" and me.grade == 13
    assert w.meta["college"]["id"] == me.path["college"]
    assert any(g.get("school") == "college" for g in w.groups.values())
    assert any("roommate" in b["roles"] for k, b in w.bonds.items() if me.id in k)
    away = [c for c in w.chars.values() if c.location == "away"]
    stayed = [c for c in w.chars.values() if c.role == "alumni" and c.path.get("kind") == "work"]
    assert away or stayed
    assert all(any(w.groups[g].get("adult") for g in c.memberships) for c in stayed)
    thanksgiving = calm.md_to_day(1, (11, 26))
    sim.advance_days(thanksgiving - w.day + 1)
    assert me.location == "hollow_creek", "home for Thanksgiving"
    assert all(c.location == "hollow_creek" for c in away if c.household_id)


def test_story_api_flow():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.get("/api/story").json() == {"active": False}
    cat = c.get("/api/story/catalog").json()
    assert "football" in cat["sports"] and any(r["id"] == "twin" for r in cat["relationships"])
    assert c.post("/api/story/validate", json={"spec": {"protagonist": {"first": ""}}}).status_code == 422
    r = c.post("/api/story/new", json={"spec": spec()})
    assert r.status_code == 200 and r.json()["protagonist"]
    s = c.get("/api/story").json()
    assert s["active"] and s["moments"][0]["kind"] == "first_day" and len(s["family"]) == 3
    assert c.post(f"/api/story/moment/{s['moments'][0]['id']}", json={"index": 1}).status_code == 200
    assert c.post("/api/story/control", json={"focus": "academics", "ask_invites": True}).json()["focus"] == "academics"
    assert c.post("/api/story/control", json={"focus": "nonsense"}).status_code == 422
    j = c.post("/api/story/advance", json={"until": "decision"}).json()
    assert j["status"] == "done" and j["stop"] in ("decision", "moment")
    if j["stop"] == "decision":
        opts = c.post(f"/api/play/{s['protagonist']}/options").json()
        assert opts["options"] and any("your focus" in str(o.get("terms")) for o in opts["options"])
    j = c.post("/api/story/advance", json={"until": "week"}).json()
    while j["status"] == "running":
        time.sleep(0.2)
        j = c.get("/api/sim/job").json()
    assert j["status"] == "done", j.get("error")
    me = c.get(f"/api/characters/{s['protagonist']}").json()
    assert me["is_protagonist"] and me["positions"]["football"] == "WR" and "seasons" in me
    new = c.post("/api/characters", json={"first": "Riley", "last": "Moss", "gender": "f", "grade": 10,
                                          "relationships": [{"to": "me", "type": "crush"}]}).json()
    assert new["custom"] and new["grade"] == 10
