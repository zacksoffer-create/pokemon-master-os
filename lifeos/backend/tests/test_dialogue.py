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


def test_every_line_two_ways_with_context_mods_and_no_repeats():
    pack = {
        "dialogue_pack": 1, "name": "Two ways",
        "texts": {
            "chatter_school": [
                "did u do the reading",
                {"text": "u up? i can't do this essay", "when": ["late_night"]},
                {"text": "notes pls", "talk": "\"Can I see your notes?\" {them_first} asks, already reaching for them."},
            ],
            "hang_talk": [{"text": "this is the best idea you've had all year", "when": ["close"]}],
        },
        "mods": {"open": {"close": ["okay real question"]}, "close": {"any": ["fr fr"]}, "talk": {"happy": ["{them_first} {says}, practically bouncing"]}},
        "scenes": [{
            "id": "two_way_scene", "who": "friend", "when": {"chance": 0.01},
            "title": "{them_first} has a plan",
            "text": ["{them_first} slides into the seat next to you. \"I have a plan.\"", "{them_first} catches you after class. \"Okay. I have a plan.\"",
                     "\"Don't say no yet,\" {them_first} says, falling into step with you."],
            "by_text": ["ok i have a plan. don't say no yet", "hear me out. i have a plan"],
            "choices": [{"label": "I'm in.", "ops": [["say", ["\"Knew it,\" {them_first} says.", "{them_first} fist-bumps you."]]]},
                        {"label": "Absolutely not.", "ops": [["mood", -1]]}],
        }],
    }
    r = dialogue.check(pack)
    assert r["ok"], r["errors"]
    assert r["summary"]["mods"] == 3 and r["summary"]["texts"] == 4
    bad = dialogue.check({"name": "x", "texts": {"chatter_school": [{"text": "hi", "when": ["midnight"]}]},
                          "mods": {"talk": {"any": ["says it slowly"]}, "open": {"sometimes": ["yo"]}}})
    msgs = " ".join(bad["errors"])
    assert "midnight" in msgs and "them_first" in msgs and "sometimes" in msgs
    assert dialogue.add_pack(pack)["ok"]
    sim = story()
    w = sim.w
    me = w.chars[w.meta["protagonist"]]
    friend = next(o for o in w.out[me.id] if w.chars[o].role != "staff" and o not in sim.siblings(me.id))
    from lifeos import lines, narrative
    # texts from one friend on one day: never the same line twice while there's anything else
    got = [lines.pick_text(sim, "chatter_school", f"s{i}", frm=friend) for i in range(8)]
    base = [lines.speakable(x).lower() for x in got]
    assert len(set(got)) == len(got), got
    assert len({lines.hid(x) for x in got}) == 8 and len(base) == 8
    # context: a parent is family, late at night is late_night
    assert {"family", "parent"} <= lines.tags_for(sim, "parent1")
    assert "late_night" in lines.tags_for(sim, friend, phase="night")
    # the spoken version of a text: spelled out, in quotes, with who said it
    sp = lines.spoken(sim, lines.entry("u coming tmrw?"), friend, "x")
    assert sp.startswith("\"You coming tomorrow?\"") and w.chars[friend].first in sp and " asks" in sp
    assert lines.spoken(sim, lines.entry({"text": "notes pls", "talk": "\"Notes?\" {them_first} asks."}), friend, "y") == f"\"Notes?\" {w.chars[friend].first} asks."
    # versions rotate before they repeat
    vs = [lines.variant(sim, "test:v", ["a", "b", "c"], f"v{i}") for i in range(3)]
    assert sorted(vs) == ["a", "b", "c"]
    # a scene written both ways, happening by text: their message lands in your phone and the choices are your replies
    m = dialogue.try_scene(sim, "two_way_scene")
    them = m["ctx"]["them"]
    assert "{" not in m["text"]
    m["by_text"] = "ok i have a plan. don't say no yet"
    messages.moment_text(sim, m)
    t = messages.phone(w)["threads"][f"dm:{them}"]
    msg = t["msgs"][-1]
    assert msg["text"].lower().startswith("ok i have a plan") and [r["label"] for r in msg["replies"]] == ["I'm in.", "Absolutely not."]
    messages.reply(sim, t["id"], msg["id"], 1)
    assert next(x for x in w.meta["moments"] if x["id"] == m["id"])["status"] != "pending"
    # in person: hanging out with you, they say something in the story feed
    said = None
    for eid in range(1, 40):
        ev = {"id": 90_000 + eid, "type": "interact.hang_out", "outcome": "great", "actors": [me.id], "targets": [friend], "data": {"place": "the beach"}}
        txt = narrative.render(sim, ev)
        if "\"" in txt:
            said = txt
            break
    assert said and w.chars[friend].first in said.split("\"")[-1]


def test_the_upgrade_prompt_carries_your_pack_and_the_new_ways_to_write():
    assert dialogue.add_pack({"dialogue_pack": 1, "name": "Old pack", "texts": {"chatter_vent": ["so tired"]}})["ok"]
    p = dialogue.prompt_for_update("yours:old_pack")
    assert p.startswith("You're updating a dialogue pack") and '"so tired"' in p and "Every line, two ways" in p
    assert "[paste your pack's JSON here]" in dialogue.prompt_for_update()
    with pytest.raises(KeyError):
        dialogue.prompt_for_update("yours:nope")
    g = dialogue.guide_markdown()
    for must in ("## Mods", "late_night", "by_text", "soccer_11", "hang_talk", "Nothing repeats"):
        assert must in g, must
    assert "Write a LOT" in dialogue.prompt_for_ai()
