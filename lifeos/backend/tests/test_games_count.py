"""One game day is one game: for a varsity or JV player, in the stats, the team record and the phone. Football scores add up."""
import os
import random
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos.sports import football_score  # noqa: E402


def test_football_scores_are_touchdowns_and_field_goals():
    r = random.Random(7)
    for margin in (0.5, 3, 8, 15, 30, 55):
        for _ in range(40):
            a, b, (wtd, ltd) = football_score(margin, r)
            assert a > b >= 0
            assert any(7 * t + 3 * f == a for t in range(10) for f in range(8)) and 7 * wtd <= a
            assert any(7 * t + 3 * f == b for t in range(10) for f in range(8)) and 7 * ltd <= b


def _first_game(level):
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    from tests.test_story import spec
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    played = None
    for _ in range(400):
        w = api.lab.w
        me = w.chars[w.meta["protagonist"]]
        if "football" in me.memberships and level == "jv":
            w.groups["football"].setdefault("levels", {})[me.id] = "jv"
        st = c.get("/api/phone/state").json()
        for m in st["moments"]:
            if m["kind"] == "game_day" and played is None:
                i = next(k for k, ch in enumerate(m["choices"]) if "yourself" in ch["label"])
                r = c.post(f"/api/phone/moment/{m['id']}", json={"index": i}).json()
                c.post(f"/api/phone/moment/{m['id']}", json={"index": i, "session": r["minigame"]["session"], "score": 10, "max": 10})
                played = st["day"]
            else:
                r = c.post(f"/api/phone/moment/{m['id']}", json={"index": 0}).json()
                if r.get("minigame"):
                    c.post(f"/api/phone/moment/{m['id']}", json={"index": 0, "auto": True})
        if played is not None and api.lab.w.day > played:
            break
        j = c.post("/api/story/advance", json={"until": "moment"}).json()
        while j.get("status") == "running":
            time.sleep(0.1)
            j = c.get("/api/story/job").json()
    assert played is not None, "the season got to a game day"
    return c, api.lab.w


def test_one_game_day_is_one_game_varsity_and_jv():
    for level in ("varsity", "jv"):
        c, w = _first_game(level)
        me = w.chars[w.meta["protagonist"]]
        st = me.stats[next(k for k in me.stats if k.startswith("football:"))]
        assert st["games"] == 1 and st["level"] == level, (level, st)
        card = c.get("/api/phone/state").json()["teams"][0]
        assert card["level"] == level and card["record"]["w"] + card["record"]["l"] == 1, (level, card)
        mine = [e for e in w.history.events.values() if e["type"] == "game" and e.get("outcome") in ("win", "loss") and me.id in e["actors"]]
        assert len(mine) == 1, [e.get("text") for e in mine]
