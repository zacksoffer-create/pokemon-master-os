"""The NFL, the NBA and college sports behind the story, as they really happened: on their real dates, nothing past today,
your teams (the Giants, the Knicks, UConn, then your own college), fans who feel the titles, and hooks for storylines."""
import datetime as dt
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import dialogue, moments, pro  # noqa: E402
from lifeos import realleagues as RL  # noqa: E402
from tests.test_story import spec  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def _story():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=8)}).status_code == 200
    for m in moments.pending(api.lab.w):
        moments.resolve(api.lab.sim, m["id"], None)
    return c, api.lab.sim


def _on(sim, y, m, d):
    sim.w.day = calm.day_of(dt.date(y, m, d))


def test_the_story_starts_in_fall_2010():
    assert calm.START == dt.date(2010, 9, 1)
    c, sim = _story()
    v = RL.view(sim, "nfl")
    assert v["season"] == "2010" and v["my_team"]["name"] == "New York Giants" and v["my_team"]["record"] is None
    assert v["my_team"]["next"]["opp"] == "Panthers"
    assert [x["season"] for x in v["champions"]][0] == "2009", "nothing past today"
    mbb = RL.view(sim, "mbb")
    assert mbb["season"] == "2009-10" and mbb["champions"][0]["champ"] == "Duke Blue Devils"


def test_uconn_2011_plays_out_day_by_day():
    c, sim = _story()
    _on(sim, 2011, 3, 1)
    card = RL.view(sim, "mbb")["my_team"]
    assert card["name"] == "UConn Huskies" and card["conf_record"] == "9-7" and not RL.in_postseason("mbb", "2011", card["team"], sim.w.day)
    _on(sim, 2011, 4, 3)
    assert pro.requirement(sim, None, "pro:mbb:my_team_alive") and RL.champion("mbb", "2011", sim.w.day) is None
    _on(sim, 2011, 4, 5)
    v = RL.view(sim, "mbb")
    assert v["champ"] == "UConn Huskies" and v["my_team"]["record"] == "32-9" and v["my_team"]["status"].startswith("Champions")
    assert pro.requirement(sim, None, "pro:mbb:my_team_champs") and not pro.requirement(sim, None, "pro:mbb:my_team_alive")
    RL.weekly(sim)
    me = sim.w.chars[sim.w.meta["protagonist"]]
    assert any("UConn men's basketball won the national championship" in m["text"] for m in me.memories)
    assert any("to win the national championship" in n["text"] for n in RL.state(sim)["news"])
    assert pro.names(sim, None)["mbb_champ"] == "UConn"


def test_the_pros_and_their_titles():
    c, sim = _story()
    _on(sim, 2012, 2, 4)
    assert RL.champion("nfl", "2011", sim.w.day) is None and pro.requirement(sim, None, "pro:nfl:my_team_alive")
    _on(sim, 2012, 2, 6)
    assert RL.name("nfl", RL.champion("nfl", "2011", sim.w.day)) == "Giants" and pro.requirement(sim, None, "pro:nfl:my_team_champs")
    _on(sim, 2011, 6, 13)
    nba = RL.view(sim, "nba")
    assert nba["champ"] == "Dallas Mavericks" and "lost to Celtics" in nba["my_team"]["status"]
    assert all(p["done"] for p in nba["postseason"]) and {p["round"] for p in nba["postseason"]} == {"R1", "CSF", "CF", "F"}
    RL.set_follow(sim, "nfl", "NE")
    assert RL.name("nfl", RL.followed(sim, "nfl")) == "Patriots"
    with pytest.raises(ValueError):
        RL.set_follow(sim, "nfl", "Hartford Colonials")


def test_your_college_once_you_are_there():
    c, sim = _story()
    me = sim.w.chars[sim.w.meta["protagonist"]]
    assert RL.my_college(sim) == "UConn" and RL.name("cfb", RL.followed(sim, "cfb")) == "UConn"
    me.path = {"kind": "college", "college": "lsu"}
    assert RL.my_college(sim) == "LSU" and RL.followed(sim, "cbase") == "LSU"
    _on(sim, 2011, 1, 11)
    cfb = RL.view(sim, "cfb")
    assert cfb["my_team"]["name"] == "LSU" and cfb["champ"] == "Auburn" and cfb["top25"]
    RL.set_follow(sim, "cfb", "Stanford")
    assert RL.my_college(sim) == "Stanford"
    _on(sim, 2011, 12, 31)
    soc = RL.view(sim, "wsoc")
    assert soc["titles_only"] and soc["finals"][0]["champ"] == "Stanford" and 2011 in soc["school_titles"]


def test_storylines_can_ask_about_any_league():
    c, sim = _story()
    ok = dialogue.check({"name": "Tourney", "scenes": [{
        "id": "march_run", "who": "best_friend", "title": "{my_college} is still alive",
        "text": "{them_first} won't stop talking about {my_college} ({my_mbb_record}). The {my_nfl_team} lost again.",
        "when": {"requires": ["pro:mbb:my_team_alive"]},
        "choices": [{"label": "Watch the game with them", "ops": [["mood", 3]]}, {"label": "Study", "ops": []}]}]})
    assert ok["ok"], ok["errors"]
    bad = dialogue.check({"name": "x", "scenes": [{"id": "bad_one", "who": "best_friend", "title": "t", "text": "t",
                                                    "when": {"requires": ["pro:mbb:my_team_rules"]},
                                                    "choices": [{"label": "a", "ops": []}, {"label": "b", "ops": []}]}]})
    assert not bad["ok"]
    assert "pro:mbb:my_team_alive" in dialogue.guide_markdown()


def test_the_phone_pages():
    c, sim = _story()
    lines = c.get("/api/phone/leagues").json()["leagues"]
    assert {x["league"] for x in lines} == set(RL.LEAGUES) and any(x["in_season"] for x in lines if x["league"] == "cfb")
    v = c.get("/api/phone/league", params={"lg": "nba"}).json()
    assert v["my_team"]["name"] == "New York Knicks" and v["standings"]
    v = c.post("/api/phone/league/follow", json={"lg": "mbb", "team": "North Carolina"}).json()
    assert v["my_team"]["name"] == "North Carolina Tar Heels"
    assert c.get("/api/phone/league", params={"lg": "cbase"}).json()["school"] == "North Carolina"
    assert c.get("/api/phone/league", params={"lg": "xfl"}).status_code == 404
