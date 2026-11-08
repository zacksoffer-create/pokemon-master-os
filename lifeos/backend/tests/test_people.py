"""The Scene tab's People (everyone at school, in numbers; a person's full card) and Yearbook (this season so far, and
each finished season's page, saved at its season break)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient  # noqa: E402

from lifeos import api, seasons  # noqa: E402
from lifeos import calendar as calm  # noqa: E402
from lifeos.storage import Store  # noqa: E402
from tests.test_story import spec  # noqa: E402


def client():
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    return c


def test_everyone_at_school_in_numbers():
    c = client()
    d = c.get("/api/phone/people").json()
    rows = d["rows"]
    me = next(r for r in rows if r["me"])
    assert len(rows) == d["of"] and me["name"] == "Zack Soffer"
    assert [r["rank"] for r in rows] == sorted(r["rank"] for r in rows)  # by rank
    for r in rows:
        for k in ("rank", "pop", "gpa", "grade", "teams", "tags", "likes_you"):
            assert k in r, k
    other = next(r for r in rows if not r["me"])
    p = c.get(f"/api/phone/people/{other['id']}").json()
    for k in ("traits", "skills", "aptitudes", "with_you", "people", "season", "superlatives", "rumors"):
        assert k in p, k
    assert set(p["with_you"]) == {"they", "you"}
    assert c.get("/api/phone/people/nobody").status_code == 404


def test_the_yearbook_live_and_saved_at_the_season_break():
    c = client()
    y = c.get("/api/phone/yearbook").json()
    v = y["volume"]
    assert v["label"].startswith("Freshman year") and v["you"]["of"] > 0 and y["recaps"] == [] and len(y["volumes"]) == 1
    assert {s["label"] for s in v["superlatives"]} >= {"Most Popular", "Best Athlete"}
    sim = api.lab.sim
    w = sim.w
    w.meta["season"] = "0-school"
    w.day = calm.md_to_day(0, (6, 1))
    seasons.on_dawn(sim)
    assert c.post("/api/phone/season/break").json()["status"] == "done"
    y = c.get("/api/phone/yearbook").json()
    past = y["recaps"][0]  # (the season break's page, under Season recaps)
    assert past["label"] == "Freshman year" and past["superlatives"] and past["top"] and past["you"]["rank"]
    assert y["volume"]["title"] == "The Grizzly 2011"  # (the summer after it is still freshman year's book)
