"""The yearbook: a book a school year with chapters (you, superlatives, classes, sports, clubs, student life, the year,
honors, signatures); this year's graduates stay on the senior pages; the book is kept when the next school year starts;
a storyline's "Mr. Reyes" is a teacher, not a freshman; Watch Hill doesn't empty the school."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import dialogue, editor, moments, scene, summer, yearbook  # noqa: E402
from tests.test_storylines_run import world  # noqa: E402

CHAPTERS = ("you", "superlatives", "classes", "sports", "clubs", "life", "timeline", "honors", "signatures")


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def _to(sim, day):
    w = sim.w
    while w.day < day:
        for m in moments.pending(w):
            moments.resolve(sim, m["id"], None)
        sim.step()


def test_the_book_has_every_chapter_and_you_are_in_your_class():
    sim, me = world()
    _to(sim, 30)  # (a month in: games played, friends made)
    v = yearbook.build(sim)
    assert v["title"] == "The Grizzly 2011" and v["live"] and set(CHAPTERS) <= set(v)
    assert v["you"]["id"] == me.id and v["you"]["of"] == v["students"]
    mine = next(c for c in v["classes"] if c["grade"] == me.grade)
    assert any(s["me"] for s in mine["students"])
    assert sum(c["count"] for c in v["classes"]) == v["students"]
    school = [s for s in v["superlatives"] if not s.get("pair")]
    assert len(school) == 16
    wins: dict = {}
    for s in school:
        wins[s["winner"]["id"]] = wins.get(s["winner"]["id"], 0) + 1
    assert max(wins.values()) <= yearbook.SUPER_CAP  # (two to a person, like a real ballot)
    texts = [s["text"] for s in v["signatures"]]
    assert len(texts) == len(set(texts))  # (nobody signs the same line twice)
    assert all(s["from"]["id"] != me.id for s in v["signatures"])
    assert all(t["roster"] or t["games"] for t in v["sports"])


def test_graduates_stay_on_the_senior_pages_with_where_theyre_going():
    sim, me = world()
    w = sim.w
    senior = next(c for c in w.students() if c.grade == 12 and c.id != me.id)
    senior.role, senior.grade, senior.school = "alumni", None, None
    senior.achievements.append({"day": calm.md_to_day(0, (6, 10)), "label": "Graduated"})
    senior.path = {"kind": "work"}
    v = yearbook.build(sim)
    seniors = next(c for c in v["classes"] if c["grade"] == 12)
    row = next(s for s in seniors["students"] if s["id"] == senior.id)
    assert row["year"] == "Senior" and row["quote"] and row["next"].startswith("Staying in")
    assert any(c["who"]["id"] == senior.id for c in v["honors"]["commitments"])


def test_the_book_is_kept_when_the_next_school_year_starts():
    sim, me = world()
    w = sim.w
    w.day = calm.md_to_day(0, (8, 30))
    w.phase = len(sim.phases()) - 1
    sim._refresh_day()
    _to(sim, calm.md_to_day(1, (9, 2)))
    kept = (w.meta.get("yearbook") or {}).get("0")
    assert kept and kept["live"] is False and kept["title"] == "The Grizzly 2011"
    assert next(c for c in kept["classes"] if any(s["me"] for s in c["students"]))["grade"] == 9  # (as you were: a freshman)
    view = yearbook.view(sim)
    assert [x["year"] for x in view["volumes"]] == [1, 0] and view["volume"]["title"] == "The Grizzly 2012"
    assert yearbook.view(sim, 0)["volume"]["title"] == "The Grizzly 2011"


def test_a_storyline_teacher_is_staff_not_a_freshman():
    sim, me = world()
    w = sim.w
    r = editor.create_fit(sim, {"who": "named", "name": "Mr. Reyes"}, slot="reyes")
    c = w.chars[r["id"]]
    assert c.role == "staff" and c.grade is None and c.name == "Mr. Reyes" and c.first != "Mr."
    # an old save: "Ms. Chen" made as a freshman, on the softball team
    kid = next(x for x in w.students() if x.grade == 9 and x.id != me.id and x.household_id != me.household_id)
    kid.first, kid.last = "Ms.", "Chen"
    w.groups["softball"]["members"].append(kid.id)
    kid.memberships.append("softball")
    w.meta.pop("titled_staff_v", None)
    assert kid.id in editor.staff_from_titles(sim)
    assert kid.role == "staff" and kid.name == "Ms. Chen" and kid.grade is None and kid.gender == "f"
    assert kid.id not in w.groups["softball"]["members"] and not kid.memberships
    assert kid.id not in {s["id"] for c in yearbook.build(sim)["classes"] for s in c["students"]}
    # and a teacher left at your lunch table or in your friend group by an old save is taken out
    from lifeos import lunch
    st = lunch.store(w)
    st["tables"]["t1"] = {"name": "the Pitch", "members": [me.id, kid.id]}
    w.meta["squad"] = {"ids": [kid.id, "x"], "updated": 5}
    assert editor.staff_out_of_student_life(w) >= 2
    assert st["tables"]["t1"]["members"] == [me.id] and kid.id not in w.meta["squad"]["ids"] and w.meta["squad"]["updated"] == -99


def test_watch_hill_doesnt_empty_the_school():
    sim, me = world()
    before = {c.id for c in scene.students(sim, me)}
    me.flags["summer_home"] = me.location
    me.location = summer.WATCH_HILL
    assert {c.id for c in scene.students(sim, me)} == before


def test_the_phone_yearbook_and_a_graduates_card():
    from fastapi.testclient import TestClient

    from lifeos import api
    from lifeos.storage import Store
    sim, me = world()
    w = sim.w
    senior = next(c for c in w.students() if c.grade == 12 and c.id != me.id)
    senior.role, senior.grade, senior.school = "alumni", None, None
    senior.achievements.append({"day": 5, "label": "Graduated"})
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    api.lab.replace_world(w)
    cl = TestClient(api.app)
    d = cl.get("/api/phone/yearbook").json()
    assert d["volumes"][0]["live"] and d["volume"]["title"].startswith("The Grizzly") and "recaps" in d
    card = cl.get(f"/api/phone/people/{senior.id}").json()
    assert isinstance(card["gpa"], float) and card["teams"] == []
