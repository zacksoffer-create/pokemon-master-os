"""The story calendar: every storyline is planned on the game's real schedule. The calendar lists each year's days and
every game by number and opponent (the same ones the games are played against); a scene on `football game 3` or
`basketball game vs Hand` plays on that game; an outline whose when isn't on the calendar comes back with what's wrong
and a prompt that fixes it; a storyline you're keeping can be re-timed (only its whens change); and the scene prompt
says exactly when each scene is."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import dialogue, league, revise, scheduler, sports, storybuilder, storycal  # noqa: E402
from tests.test_storylines_run import add, scene, world  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def test_the_calendar_lists_every_game_with_its_real_opponent():
    sim, me = world()
    w = sim.w
    g = w.groups["football"]
    games = storycal.team_games(sim, "football", 0)
    reg = [x for x in games if not x["stage"]]
    assert reg[0]["n"] == 1 and any(x["event"] == "thanksgiving" for x in reg) and any(x["rival"] for x in reg)
    for x in reg[:5]:  # the calendar's opponent is the one the game is played against, and the one the planner names
        assert x["opp"] == league.opponent(sim, g, x["n"])["name"]
        it = next(i for i in w.calendar if i["kind"] == "game" and i["group"] == "football" and i["day"] == x["day"])
        assert sports.game_opponent(sim, g, it) == x["opp"]
    text = storycal.year_text(sim, 0, [g])
    assert f"1 {storycal.md(reg[0]['day'])} {reg[0]['opp']}" in text and "(rivalry)" in text and "Thanksgiving game" in text
    assert "first day of school Sep 1" in text and "prom May" in text and "state playoffs" in text
    later = storycal.team_games(sim, "football", 1)  # (a later year, built the way the game will build it)
    assert later and later[0]["day"] > reg[-1]["day"]


def test_a_scene_on_a_game_plays_on_that_game():
    sim, me = world()
    w = sim.w
    g = w.groups["football"]
    g["members"] = sorted(set(g["members"]) | {me.id})
    me.memberships = sorted(set(me.memberships) | {"football"})
    reg = [x for x in storycal.team_games(sim, "football", 0) if not x["stage"]]
    hand = next(x for x in reg if x["rival"])
    pk, cat = add(sim, "=== Season\ncast: mike = older brother\nyears: freshman\n"
                  + scene("Third", "freshman · football game 3") + scene("Hand Week", f"freshman · football game vs {hand['opp']}"))
    third, rivalry = cat["chapters"][pk]
    ok = lambda sid, d: scheduler.calendar_ok(sim, sid, cat["scenes"][sid]["when"], cat["info"][sid], d) is None  # noqa: E731
    assert ok(third, reg[2]["day"]) and not ok(third, reg[1]["day"]) and not ok(third, reg[3]["day"])
    assert ok(rivalry, hand["day"]) and not ok(rivalry, reg[0]["day"])


def test_an_outline_off_the_calendar_comes_back_with_a_fix():
    sim, me = world()
    n_games = len([x for x in storycal.team_games(sim, "basketball", 0) if not x["stage"]])
    opps = {x["opp"] for x in storycal.team_games(sim, "basketball", 0) if x["opp"]}
    outline = [{"n": 1, "when_raw": "basketball opener"}, {"n": 2, "when_raw": "the week after the bonfire"},
               {"n": 3, "when_raw": f"basketball game {n_games + 5}"}, {"n": 4, "when_raw": "basketball game vs Yale"},
               {"n": 5, "when_raw": "after basketball tryouts · big"}, {"n": 6, "when_raw": "mid December"},
               {"n": 7, "when_raw": f"basketball game vs {sorted(opps)[0]}"}, {"n": 8, "when_raw": "after scene 2"}]
    probs = dict(storycal.check_outline(sim, outline, ["freshman"]))
    assert set(probs) == {2, 3, 4, 8}, probs
    assert "isn't on the calendar" in probs[2] and f"there are {n_games}" in probs[3] and "Yale isn't on the schedule" in probs[4]
    fix = storycal.fix_prompt(sim, "=== X\nyears: freshman\noutline:\n2. The Bus | the week after the bonfire | x", list(probs.items()))
    assert "Scene 2" in fix and "first day of school" in fix and "## The calendar" in fix and "The Bus" in fix


def test_after_tryouts_in_an_outline_is_the_day_after_tryouts():
    sim, me = world()
    pk, cat = add(sim, "=== Spring\ncast: mike = older brother\nyears: freshman\noutline:\n"
                  "1. The List | after baseball tryouts | The roster goes up.\n" + scene("1. The List", "freshman"))
    sid = cat["chapters"][pk][0]
    assert (cat["info"][sid].get("moment") or {}).get("kind") == "after_tryouts"


def test_the_outline_api_flags_whens_off_the_calendar():
    from fastapi.testclient import TestClient

    from lifeos import api
    from lifeos.storage import Store
    from tests.test_story import spec
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    text = ("=== Test\ncast: mike = older brother\nyears: freshman\noutline:\n1. One | first day of school | a.\n"
            "2. Two | sometime after the dance | b.\n")
    r = c.post("/api/story/build/outline", json={"text": text, "save": False}).json()
    assert [x["n"] for x in r["calendar"]] == [2] and "Scene 2" in r["fix_prompt"]
    ok = c.post("/api/story/build/outline", json={"text": text.replace("sometime after the dance", "late October"), "save": False}).json()
    assert ok["calendar"] == [] and ok["fix_prompt"] is None


def test_a_storyline_you_keep_can_be_put_on_the_calendar():
    sim, me = world()
    r = dialogue.add_script("=== Keep\ncast: mike = older brother\nyears: freshman\noutline:\n"
                            "1. One | September | Mike's first game.\n2. Two | October | The rivalry.\n"
                            + scene("1. One", "freshman") + scene("2. Two", "freshman"))
    assert r["ok"], r
    pid = r["ids"][0]
    p = revise.retime_prompt(sim, pid)
    assert "1. One | September | Mike's first game." in p and "## The calendar" in p and "Only the when changes" in p
    before = dialogue._script_pack(pid)["script"]
    out = revise.retime_apply(sim, pid, "```\noutline:\n1. One | football opener | Mike's first game.\n"
                                        "2. Two | football game 8 · big | The rivalry. | doesn't fit: no idea\n```")
    assert out["ok"] and out["changed"] == [1, 2] and out["calendar"] == [] and "doesn't fit" in out["notes"][0]
    after = dialogue._script_pack(pid)["script"]
    assert "1. One | football opener | Mike's first game." in after and "2. Two | football game 8 · big" in after
    assert after.split("---", 1)[1] == before.split("---", 1)[1]  # (the scenes are exactly as they were)
    assert revise.can_undo(pid)


def test_the_scene_prompt_says_exactly_when_each_scene_is():
    sim, me = world()
    reg = [x for x in storycal.team_games(sim, "football", 0) if not x["stage"]]
    r = dialogue.add_script("=== Fall\ncast: mike = older brother\nyears: freshman\noutline:\n"
                            "1. Opener | football game 1 | The first game.\n2. Later | mid October | Later.\n")
    assert r["ok"], r
    b = storybuilder.batch_prompt(sim, r["ids"][0], 2)["prompt"]
    assert f"Scene 1, Opener: {storycal.label(reg[0]['day'])}: football game 1 vs {reg[0]['opp']}" in b
    assert "Scene 2, Later: mid October" in b


def test_hand_is_the_thanksgiving_game_and_the_last_game_every_year():
    sim, me = world()
    for y in range(4):
        reg = [x for x in storycal.team_games(sim, "football", y) if not x["stage"]]
        last = reg[-1]
        assert last["opp"] == "Hand" and last["event"] == "thanksgiving" and last["rival"]
        assert calm.date_of(last["day"]).month == 11 and calm.weekday(last["day"]) == 3  # Thanksgiving Thursday
        assert not [x for x in reg[:-1] if x["opp"] == "Hand"]  # (and only then)
    g = sim.w.groups["football"]
    it = next(i for i in sim.w.calendar if i.get("event") == "thanksgiving")
    assert sports.game_opponent(sim, g, it) == "Hand" and league.opponent_for(sim, g, it)["name"] == "Hand"
