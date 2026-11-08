"""Sports records you control: how much each part of a sports year counts toward popularity (with a reset), and anyone's
season (stat line, games, starts, record, captain, awards, Players of the Week) replacing what the simulation made."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import records, sports  # noqa: E402
from tests.test_talk import _setup  # noqa: E402


def _athlete(sim, me, friend):
    w = sim.w
    a = next(c for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, friend.id) and c.gender == "m")
    a.memberships = [g for g in a.memberships if w.groups[g]["kind"] != "team"]
    for g in w.groups.values():
        if a.id in g.get("members", []):
            g["members"].remove(a.id)
        if a.id in (g.get("leaders") or []):
            g["leaders"].remove(a.id)
    a.awards = []
    a.reputation["athlete"] = 0
    g = w.groups["football"]
    g["members"].append(a.id)
    a.memberships.append("football")
    g.setdefault("levels", {})[a.id] = "varsity"
    return a, g


def test_you_decide_how_much_sports_count_and_can_put_it_back():
    sim, me, friend = _setup()
    w = sim.w
    a, _ = _athlete(sim, me, friend)
    a.awards.append({"day": w.day, "label": "All-SCC Football", "sport": "football"})
    base = sports.athletic_standing(w, a)[0]
    assert base > 0
    v = records.set_weights(sim, {"weights": {"overall": 0.5, "all_conf": 200}})
    assert v["changed"] and {r["key"]: r["value"] for r in v["rows"]}["overall"] == 0.5
    assert w.meta["sports_weights"] == {"overall": 0.5, "all_conf": 200.0}
    half = sports.athletic_standing(w, a)[0]
    assert abs(half - (base + 100) * 0.5) < 1.0  # (the All-SCC is worth 200 now, and everything is halved)
    raw = w.meta["popularity_raw"][a.id]
    records.set_weights(sim, {"weights": {"overall": 0}})
    assert sports.athletic_standing(w, a)[0] == 0 and w.meta["popularity_raw"][a.id] < raw  # (re-ranked right away)
    # out of range is clamped, unknown keys and nonsense are refused, setting a default back stores nothing
    records.set_weights(sim, {"weights": {"varsity": 9999}})
    assert records.weights(w)["varsity"] == 400
    with pytest.raises(records.RecordError):
        records.set_weights(sim, {"weights": {"charisma": 3}})
    with pytest.raises(records.RecordError):
        records.set_weights(sim, {"weights": {"captain": "lots"}})
    records.set_weights(sim, {"weights": {"varsity": 120}})
    assert "varsity" not in w.meta["sports_weights"]
    v = records.set_weights(sim, {"reset": True})
    assert not v["changed"] and "sports_weights" not in w.meta
    assert abs(sports.athletic_standing(w, a)[0] - base) < 1e-6


def test_your_numbers_replace_the_simulations():
    sim, me, friend = _setup()
    w = sim.w
    a, g = _athlete(sim, me, friend)
    view = records.seasons(sim, a.id)
    row = next(s for s in view["seasons"] if s["team"] == "football")
    assert row["level"] == "varsity" and not row["captain"] and row["awards"] == [] and row["potw"] == 0
    assert [k for k, _ in row["fields"]][:2] == ["pass_yds", "pass_td"] and "All-State Football" in row["options"]
    before = sports.athletic_standing(w, a)[0]
    out = records.save(sim, a.id, {"year": view["year"], "team": "football", "games": 10, "starts": 12, "wins": 8, "losses": 2,
                                   "line": {"rush_yds": 1200, "rush_td": 14, "made_up": 5}, "captain": True,
                                   "awards": ["All-State Football", "SCC Offensive Player of the Year"], "potw": 3})
    row = next(s for s in out["seasons"] if s["team"] == "football")
    assert row["games"] == 10 and row["starts"] == 10 and (row["wins"], row["losses"]) == (8, 2)  # (can't start more than you play)
    assert row["line"]["rush_yds"] == 1200 and row["line"]["rush_td"] == 14 and row["edited"]
    assert row["captain"] and a.id in g["leaders"]
    assert row["awards"] == ["All-State Football", "SCC Offensive Player of the Year"] and row["potw"] == 3
    st = a.stats[f"football:{out['label']}:varsity"]
    assert st["impact"] == 1200 * 0.1 + 14 * 6 and "made_up" not in st["line"]
    after, why = sports.athletic_standing(w, a)
    assert after > before + 300 and "All-State Football" in why
    # take it back: no captain, one award, no Players of the Week
    out = records.save(sim, a.id, {"year": view["year"], "team": "football", "captain": False, "awards": ["SCC Offensive Player of the Year"],
                                   "potw": 0})
    row = next(s for s in out["seasons"] if s["team"] == "football")
    assert not row["captain"] and a.id not in g["leaders"] and row["awards"] == ["SCC Offensive Player of the Year"] and row["potw"] == 0
    assert row["line"]["rush_yds"] == 1200  # (what you didn't send stays)
    assert sports.athletic_standing(w, a)[0] < after
    assert any(e.get("type") == "editor" and "football" in (e.get("text") or "").lower() for e in w.history.events.values())
    with pytest.raises(records.RecordError):
        records.save(sim, a.id, {"year": view["year"], "team": "basketball"})


def test_the_phone_can_read_and_change_both():
    from fastapi.testclient import TestClient

    from lifeos import api
    from lifeos.storage import Store
    sim, me, friend = _setup()
    a, _ = _athlete(sim, me, friend)
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    api.lab.replace_world(sim.w)
    cl = TestClient(api.app)
    v = cl.get("/api/phone/sports-weights").json()
    assert {r["key"] for r in v["rows"]} == set(records.DEFAULTS) and not v["changed"]
    v = cl.post("/api/phone/sports-weights", json={"weights": {"captain": 150}}).json()
    assert v["changed"] and {r["key"]: r["value"] for r in v["rows"]}["captain"] == 150
    assert cl.post("/api/phone/sports-weights", json={"weights": {"nope": 1}}).status_code == 400
    assert not cl.post("/api/phone/sports-weights", json={"reset": True}).json()["changed"]
    r = cl.get(f"/api/phone/editor/sports/{a.id}").json()
    assert any(s["team"] == "football" for s in r["seasons"])
    r = cl.post(f"/api/phone/editor/sports/{a.id}", json={"year": r["year"], "team": "football", "awards": ["All-SCC Football"], "potw": 1}).json()
    row = next(s for s in r["seasons"] if s["team"] == "football")
    assert row["awards"] == ["All-SCC Football"] and row["potw"] == 1
    assert cl.get("/api/phone/editor/sports/nobody").status_code == 404
    assert cl.post(f"/api/phone/editor/sports/{a.id}", json={"team": "basketball"}).status_code == 400
