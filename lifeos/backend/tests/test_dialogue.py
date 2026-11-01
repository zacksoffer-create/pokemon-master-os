"""Dialogue packs: checking, loading, merging, and scenes that happen in the story."""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import dialogue, messages, moments  # noqa: E402
from lifeos.engine import Simulation  # noqa: E402
from lifeos.story import begin, create_story  # noqa: E402
from tests.test_story import spec  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    """Every test gets an empty folder for 'your' packs (the built-in starter pack still loads)."""
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def story(**kw):
    s = spec(per=6, **kw)
    sim = Simulation(create_story(s))
    begin(sim)
    for m in moments.pending(sim.w):
        moments.resolve(sim, m["id"], 0)
    return sim


def test_built_in_packs_are_clean_and_the_guide_lists_everything():
    for p in dialogue.packs():
        assert p["check"]["ok"], (p["id"], p["check"]["errors"])
    g = dialogue.guide_markdown()
    for must in ("chatter_school", "sibling_tease", "older_sibling", "remembered", "hang_out", "rumor"):
        assert must in g
    assert dialogue.prompt_for_ai().startswith("You're writing dialogue for LIFE OS")


def test_check_explains_mistakes_in_plain_words():
    bad = {"name": "oops", "texts": {"chater_school": ["x"], "invite": ["come to {placee}"]},
           "replies": {"chatter_plans": [["ok", "happy"]]},
           "scenes": [{"id": "x1x", "who": "bff", "title": "t", "text": "t", "when": {"chanse": 0.1},
                       "choices": [{"label": "a", "ops": [["moood", 2]]}]}]}
    r = dialogue.check(bad)
    msg = " | ".join(r["errors"])
    assert not r["ok"]
    for frag in ("Did you mean chatter_school", "{placee}", "'happy' isn't a tone", "'bff' isn't a kind of person",
                 "Did you mean chance", "2 to 4 choices", "Did you mean mood"):
        assert frag in msg, frag


def test_a_pack_pasted_from_chatgpt_loads_and_adds_lines():
    answer = "Here you go!\n```json\n" + json.dumps({
        "dialogue_pack": 1, "name": "More school texts",
        "texts": {"chatter_school": ["did u start the lab report", "is the quiz today or tmrw"]},
        "replies": {"chatter_school": [["on it", "warm"], ["what lab report 💀", "funny"]]},
    }) + "\n```\nLet me know if you want more."
    pack = dialogue.parse_text(answer)
    r = dialogue.add_pack(pack)
    assert r["ok"] and r["id"] == "yours:more_school_texts"
    assert "did u start the lab report" in messages.T()["chatter_school"]
    labels = [l for l, _ in dialogue.reply_sets()["chatter_school"]]
    assert "what lab report 💀" in labels
    for salt in ("a", "b", "c", "d"):
        opts = messages._replies("chatter_school", salt)
        assert len(opts) == 3 and len({o["fx"] for o in opts}) >= 2
    dialogue.set_enabled("yours:more_school_texts", False)
    assert "did u start the lab report" not in messages.T()["chatter_school"]
    dialogue.set_enabled("yours:more_school_texts", True)
    dialogue.remove_pack("yours:more_school_texts")
    assert not any(p["id"] == "yours:more_school_texts" for p in dialogue.packs())
    with pytest.raises(ValueError):
        dialogue.remove_pack("builtin:everyday_life")
    with pytest.raises(ValueError):
        dialogue.parse_text("sorry, I can't help with that")


def test_scenes_play_with_dialogue_texts_and_follow_ups():
    sim = story()
    m = dialogue.try_scene(sim, "cover_for_me")
    them = m["ctx"]["them"]
    assert sim.w.chars[them].first in m["title"] and "{" not in m["text"]
    ev = moments.resolve(sim, m["id"], 0)
    assert ev["data"]["say"] and "Legend" in ev["data"]["say"][0]
    assert sim.w.meta["remembered"]["covered_for_sibling"]["them"] == them
    m2 = dialogue.try_scene(sim, "cover_story_falls_apart")
    assert m2["ctx"]["them"] == them, "the follow-up is about the same sibling"
    moments.resolve(sim, m2["id"], 1)
    assert "covered_for_sibling" not in sim.w.meta["remembered"]
    for _ in range(4):
        sim.step()
    t = messages.phone(sim.w)["threads"].get(f"dm:{them}")
    assert t and any(x["text"] == "seriously??" or "seriously" in x["text"] for x in t["msgs"])


def test_a_choice_that_needs_someone_only_shows_when_they_exist():
    s = spec(per=6)
    s["siblings"] = []
    s["family"]["pet"] = {"species": "dog", "name": "Scout"}
    sim = Simulation(create_story(s))
    begin(sim)
    for m in moments.pending(sim.w):
        moments.resolve(sim, m["id"], 0)
    m = dialogue.try_scene(sim, "pet_got_out")
    labels = [c["label"] for c in m["choices"]]
    assert len(labels) == 2 and not any("help corner" in x for x in labels)
    with pytest.raises(ValueError):
        dialogue.try_scene(sim, "hoodie_thief")  # needs a sibling


def test_scenes_happen_on_their_own_and_dated_ones_get_their_day():
    from lifeos import calendar as calm
    sim = story()
    w = sim.w
    while calm.date_of(w.day) <= calm.date_of(0).replace(month=11, day=1):
        for m in moments.pending(w):
            if m["kind"] != "halloween_plans":
                moments.resolve(sim, m["id"], None)
        sim.step()
    seen = w.meta.get("scenes_seen", {})
    assert seen.get("halloween_plans") and str(calm.date_of(seen["halloween_plans"][0])).endswith("10-31")
    assert len(seen) >= 3


def test_dialogue_api_and_the_phone_engine_layer(tmp_path):
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    j = c.get("/api/dialogue/packs").json()
    assert any(p["id"] == "builtin:everyday_life" and p["enabled"] for p in j["packs"]) and "u_up" in j["scenes"]
    bad = c.post("/api/dialogue/packs", json={"text": '{"name": "x", "texts": {"nope": ["hi"]}}'})
    assert bad.status_code == 422 and bad.json()["errors"]
    good = {"name": "Snow day", "scenes": [{
        "id": "snow_day", "who": "best_friend", "when": {"months": [1, 2]}, "title": "Snow day",
        "text": "{them_first}: \"SCHOOL'S CANCELLED\"",
        "choices": [{"label": "Sledding.", "ops": [["need", "fun", 8], ["say", "Best day of the year."]]},
                    {"label": "Sleep till noon.", "ops": [["need", "energy", 10]]}]}]}
    assert c.post("/api/dialogue/check", json={"pack": good}).json()["ok"]
    r = c.post("/api/dialogue/packs", json={"pack": good})
    assert r.status_code == 200 and "snow_day" in r.json()["scenes"]
    t = c.post("/api/dialogue/try/snow_day")
    assert t.status_code == 200 and t.json()["moment"]["title"] == "Snow day"
    assert c.post("/api/dialogue/packs/yours%3Asnow_day/enabled", json={"enabled": False}).status_code == 200
    assert "snow_day" not in c.get("/api/dialogue/packs").json()["scenes"]
    assert c.post("/api/dialogue/packs/builtin%3Aeveryday_life/remove").status_code == 409
    assert c.post("/api/dialogue/packs/yours%3Asnow_day/remove").status_code == 200
    assert "Text pools" in c.get("/api/dialogue/guide.md").text
    assert "texts" in c.get("/api/dialogue/current").json()
    assert len(c.get("/api/dialogue/prompt").json()["prompt"]) > 5000
