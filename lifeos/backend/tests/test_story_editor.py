"""The Story Editor's engine side: the format it offers, checking a whole story at once, playing it from the first day on
your own setup, and the one-file bundle the phone imports. None of it touches the story you're playing."""
import copy
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import dialogue, moments, storyeditor  # noqa: E402
from tests.test_scheduler import BROTHER, S, TWINS, season_plan  # noqa: E402
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
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    return TestClient(api.app), api


def test_the_schema_is_the_games_own_vocabulary():
    s = storyeditor.schema()
    assert "older_brother" in s["who"] and "school_day" in s["requires"] and "remember" in s["ops"] and s["ops"]["rel_back"]["args"] == 3
    assert [y["key"] for y in s["years"]][:7] == storyeditor.YEAR_ORDER and "major" in s["importance"] and "basketball" in s["minigames"]


def test_check_all_finds_what_only_shows_across_storylines():
    a = {"dialogue_pack": 1, "name": "Line A", "scenes": [S("a_one"), S("a_two", after=["nowhere_scene"])]}
    b = {"dialogue_pack": 1, "name": "Line B", "scenes": [S("a_one"), S("b_two", remembered=["nobody_sets_this"])]}
    broken = {"dialogue_pack": 1, "name": "Broken", "scenes": [{"id": "Bad Id", "title": "x", "text": "y", "choices": []}]}
    r = storyeditor.check_all([a, b, broken])
    assert not r["ok"] and not r["packs"][2]["ok"] and r["packs"][2]["errors"]
    kinds = {(c["kind"], c["sid"]) for c in r["cross"]}
    assert ("duplicate", "a_one") in kinds and ("missing_scene", "a_two") in kinds and ("missing_fact", "b_two") in kinds


def test_run_plays_the_story_from_the_first_day_and_leaves_your_packs_alone():
    dialogue.add_pack({"dialogue_pack": 1, "name": "Already on my phone", "scenes": [S("phone_only_scene")]})
    dialogue.reload()
    before = [p["id"] for p in dialogue.packs()]
    packs = season_plan()
    r = storyeditor.run(packs, spec(per=6, siblings=[BROTHER] + TWINS))
    by = {x["sid"]: x for x in r["scenes"]}
    assert "phone_only_scene" not in by, "only the editor's storylines are in its story"
    assert sum(r["counts"].values()) == len(by) and r["counts"].get("played", 0) >= 10
    played = [x for x in r["scenes"] if x["state"] == "played"]
    assert all(x["date"] for x in played) and r["coverage"]["years"] and r["who"]["name"] == "Zack Soffer"
    assert all(x["why"] or x["reason"] for x in r["scenes"] if x["state"] == "unreachable")
    assert [p["id"] for p in dialogue.packs()] == before, "your game's packs are back as they were"


def test_your_own_story_from_a_phone_backup():
    c, api = _client()
    assert c.post("/api/story/new", json={"spec": spec(per=6, siblings=[BROTHER] + TWINS)}).status_code == 200
    data = c.get("/api/phone/backup").content
    r = c.post("/api/storyeditor/backup", content=data, headers={"Content-Type": "application/octet-stream"}).json()
    assert r["name"] == "Zack Soffer" and r["spec"]["siblings"][0]["first"] == "Mike"
    assert c.post("/api/storyeditor/backup", content=b"not a backup").status_code == 422
    run = c.post("/api/storyeditor/run", json={"packs": season_plan()[:2], "spec": r["spec"]}).json()
    assert run["who"]["name"] == "Zack Soffer" and not run["who"]["sample"] and run["scenes"]
    sample = c.post("/api/storyeditor/run", json={"packs": season_plan()[:1]}).json()
    assert sample["who"]["sample"]
    assert c.get("/api/storyeditor/schema").json()["ops"]["say"] and isinstance(c.get("/api/storyeditor/builtin").json()["packs"], list)


def test_one_bundle_file_imports_every_storyline_or_none():
    c, api = _client()
    packs = season_plan()[:2]
    text = "here's my story\n```json\n" + json.dumps(storyeditor.bundle("My story", packs)) + "\n```"
    chk = c.post("/api/dialogue/check", json={"text": text}).json()
    assert chk["ok"] and chk["packs"] == 2 and chk["summary"]["scenes"] == sum(len(p.get("scenes") or []) for p in packs)
    bad = copy.deepcopy(packs)
    bad[1]["scenes"][0]["when"]["years"] = ["fifth_year"]
    r = c.post("/api/dialogue/packs", json={"pack": storyeditor.bundle("Broken", bad)})
    assert r.status_code == 422 and any(packs[1]["name"] in e for e in r.json()["errors"])
    assert not [p for p in dialogue.packs() if p["source"] == "yours"], "nothing went in"
    r = c.post("/api/dialogue/packs", json={"text": text}).json()
    assert len(r["added_all"]) == 2 and {p["name"] for p in r["packs"] if p["id"] in r["added_all"]} == {p["name"] for p in packs}
