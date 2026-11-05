"""Every storyline scene asks you something: the prompt hands ChatGPT a template with the question and the choices built
in, a scene that comes back without them (no choices, or just one) is named with a fix-it message, template lines left
unfilled come out, and the storylines you're writing are listed with how far along each is."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tests.test_scene_import import own_packs, story  # noqa: E402,F401

FILLED = """```
--- 13. Front Row Seats
<a line or two of setup>
The gym is packed. Nicole spots you from the court.
nicole: You actually came.
nicole: So where are you sitting?
* "Front row." | nicole affection +
nicole: Front row, then. Come on.
* "Back row's fine."
nicole: Wow. Okay.
* "<choice 3>"
<what happens after it: their answer, 2 to 5 lines>

--- 14. The Banner
nicole: Please tell me that's not a banner.
nicole: It is. It has my face on it.
nicole: I'm going to die.

--- 15. Nicole Hears About It
nicole: People are talking about my brother.
* "Good talk?"
nicole: Annoyingly good.
```"""


def test_the_batch_prompt_is_a_template_with_the_question_and_choices_built_in(story):
    c, pid, _ = story
    b = c.get(f"/api/story/build/batch-prompt?pack={pid}&count=3").json()
    assert b["first"] == 13 and b["last"] == 15
    tpl = b["prompt"].split("## Fill in this template", 1)[1].split("Reply with ONE", 1)[0]
    for n, t in zip(range(13, 16), b["titles"]):
        assert f"--- {n}. {t}" in tpl
    assert tpl.count("<the question: someone asks me something, or it's my move>") == 3
    assert tpl.count('* "<choice 2>"') == 3
    assert "ENDS ON A QUESTION" in b["prompt"] and "doesn't count as written" in b["prompt"]


def test_a_scene_that_never_asks_or_gives_one_choice_is_named_and_unfilled_template_lines_come_out(story):
    c, pid, _ = story
    r = c.post("/api/story/build/scenes", json={"pack": pid, "text": FILLED})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["got"] == [13, 14, 15]
    gaps = {g["n"]: " ".join(g["problems"]) for g in j["gaps"]}
    assert "never asks you anything" in gaps[14]
    assert "only has one choice" in gaps[15]
    assert 13 not in gaps  # the unfilled third choice came out; the two real ones stand
    assert "Every scene ends on a question" in j["fix_prompt"] and "Scene 14 (The Banner):" in j["fix_prompt"]
    from tests.test_scene_import import _scenes
    sc = _scenes(c, pid)[13]
    assert [ch["label"].strip('"') for ch in sc["choices"]] == ["Front row.", "Back row's fine."]
    assert "<" not in str(sc)
    assert any("template line left unfilled" in n for n in j["notes"])


def test_the_storylines_you_are_writing_and_a_checkup_of_one(story):
    c, pid, _ = story
    c.post("/api/story/build/scenes", json={"pack": pid, "text": FILLED})
    rows = c.get("/api/story/build/writing").json()["storylines"]
    me = next(x for x in rows if x["pack"] == pid)
    assert me["written"] == 15 and me["total"] >= 15 and me["needs_fixing"] >= 2 and "stuck" in me
    ck = c.get(f"/api/story/build/checkup?pack={pid}").json()
    assert {14, 15} <= {g["n"] for g in ck["gaps"]} and ck["fix_prompt"]
    # ChatGPT sends them back whole: they're fixed
    fixed = """--- 14. The Banner
nicole: Please tell me that's not a banner.
* "It's a banner." | nicole affection +
nicole: I'm going to die. Thank you.
* "It's a tablecloth."
nicole: Nobody believes that.

--- 15. Nicole Hears About It
nicole: People are talking about my brother.
* "Good talk?"
nicole: Annoyingly good.
* "I'll keep it down."
nicole: Don't you dare.
"""
    c.post("/api/story/build/scenes", json={"pack": pid, "text": fixed})
    ck = c.get(f"/api/story/build/checkup?pack={pid}").json()
    assert not {14, 15} & {g["n"] for g in ck["gaps"]}
