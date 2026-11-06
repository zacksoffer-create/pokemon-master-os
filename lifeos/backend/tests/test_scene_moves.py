"""Moving a scene to a month and year (Read it → a scene's time) never strands the rest of its storyline: a later scene
pinned to before its new time moves with it (and plays after it), an earlier one pinned to after it moves back, and the
storyline stays in calendar order so every scene can still play."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import dialogue  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


SCENES = "\n".join(f"""
--- {n}. Scene {n}
Mike: Line for scene {n}.
* "Okay."
Mike: Good.
""" for n in range(1, 7))

STORY = """=== Brothers
cast: mike = older brother
years: freshman

outline:
1. Scene 1 | September | It starts.
2. Scene 2 | October | Something happens.
3. Scene 3 | | No time of its own.
4. Scene 4 | November · big | A turn.
5. Scene 5 | Thanksgiving | Turkey.
6. Scene 6 | late December | Winter.
""" + SCENES


def positions(pid):
    p = next(x for x in dialogue.packs() if x["id"] == pid)
    by_id = {s["id"]: s for s in p["pack"]["scenes"]}
    return [(e["n"], dialogue._when_pos(by_id[e["sid"]].get("when") or {})) for e in p["pack"]["outline"]], p


def in_order(pos):
    vals = [v for _, v in pos if v is not None]
    return vals == sorted(vals)


def test_moving_a_scene_later_takes_the_pinned_scenes_after_it_along():
    r = dialogue.add_script(STORY)
    assert r["ok"], r.get("errors")
    pid = r["ids"][0]
    pos, p = positions(pid)
    assert in_order(pos), pos
    s2 = next(e["sid"] for e in p["pack"]["outline"] if e["n"] == 2)
    r = dialogue.set_scene_timing(pid, s2, "freshman", 3)  # Scene 2 to March
    assert r["ok"], r.get("errors")
    assert {m["n"] for m in r["moved_too"]} == {4, 5, 6}, r["moved_too"]  # November, Thanksgiving and late December come along
    pos, p = positions(pid)
    assert in_order(pos), pos
    line4 = next(e for e in p["pack"]["outline"] if e["n"] == 4)
    assert "March" in line4["when"] and "big" in line4["when"] and "November" not in line4["when"], line4  # keeps "big"


def test_moving_a_scene_earlier_pulls_the_pinned_scenes_before_it_back():
    r = dialogue.add_script(STORY)
    pid = r["ids"][0]
    _, p = positions(pid)
    s4 = next(e["sid"] for e in p["pack"]["outline"] if e["n"] == 4)
    r = dialogue.set_scene_timing(pid, s4, "freshman", 9)  # Scene 4 back to September
    assert r["ok"], r.get("errors")
    assert {m["n"] for m in r["moved_too"]} == {2}, r["moved_too"]  # October came back to September; Thanksgiving is after it
    pos, _ = positions(pid)
    assert in_order(pos), pos


def test_a_move_that_breaks_nothing_moves_nothing_else():
    r = dialogue.add_script(STORY)
    pid = r["ids"][0]
    _, p = positions(pid)
    s2 = next(e["sid"] for e in p["pack"]["outline"] if e["n"] == 2)
    r = dialogue.set_scene_timing(pid, s2, "freshman", 10)  # October to October: nothing else has to move
    assert r["ok"] and r["moved_too"] == [], r.get("moved_too")
