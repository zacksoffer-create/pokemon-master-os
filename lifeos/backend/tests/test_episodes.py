"""Episodes back to back: Next episode lives your life up to the next storyline scene and stops there, every time."""
import copy
import os
import sys
import time

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import dialogue, moments, scheduler  # noqa: E402
from tests.test_scheduler import BROTHER, TWINS, season_plan  # noqa: E402
from tests.test_story import spec  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def _client():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    for p in season_plan():
        dialogue.add_pack(copy.deepcopy(p))
    dialogue.reload()
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6, siblings=[BROTHER] + TWINS)}).status_code == 200
    return c, api


def _next_episode(c):
    j = c.post("/api/story/advance", json={"until": "episode"}).json()
    while j.get("status") == "running":
        time.sleep(0.05)
        j = c.get("/api/sim/job").json()
    return j


def _play_through(c, w, sim, root):
    """Answer every beat of the scene, the way the phone does."""
    for _ in range(20):
        pend = [m for m in moments.pending(w) if scheduler._root(sim, m["kind"]) == root]
        if not pend:
            return
        r = c.post(f"/api/phone/moment/{pend[0]['id']}", json={"index": 0}).json()
        if r.get("minigame"):
            c.post(f"/api/phone/moment/{pend[0]['id']}", json={"index": 0, "auto": True})
    raise AssertionError("the scene never finished")


def test_next_episode_goes_straight_to_the_next_scene_every_time():
    c, api = _client()
    w, sim = api.lab.w, api.lab.sim
    assert c.post("/api/story/control", json={"binge": True}).json()["binge"] is True
    assert c.get("/api/phone/state").json()["stories"]["binge"] is True
    played, days = [], []
    for _ in range(8):
        start = w.day
        j = _next_episode(c)
        assert j["status"] == "done" and j["stop"] == "episode", j
        pend = moments.pending(w)
        # only the scene is waiting: tryouts, invites, class games and the rest, your character already handled
        assert pend and all(scheduler.is_episode(sim, m["kind"]) for m in pend), [m["kind"] for m in pend]
        root = scheduler._root(sim, pend[0]["kind"])
        _play_through(c, w, sim, root)
        played.append(root)
        days.append(w.day - start)
        assert root in scheduler.done_map(w)
    assert len(set(played)) == 8, played
    assert c.get("/api/phone/state").json()["stories"]["played"] >= 8


def test_next_episode_stops_right_away_when_a_scene_is_already_waiting():
    c, api = _client()
    w, sim = api.lab.w, api.lab.sim
    _next_episode(c)
    day, waiting = w.day, [m["id"] for m in moments.pending(w)]
    j = _next_episode(c)  # didn't answer it: the same scene is still there, no time passed
    assert j["stop"] == "episode" and w.day == day and [m["id"] for m in moments.pending(w)] == waiting
