"""Real rosters and staff from a roster sheet: lines matched to the people in your story (or made, in the right grade),
put on the team that school year with position, number and captaincy; tryouts that year keep them there ("only these"
keeps everyone else off, never you); head coaches renamed or taking over, assistants added, coaching style read from
the notes; teachers in everyone's schedule and advising clubs; sheets kept for Start over."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import classes, dialogue, groundwork, moments, rosters  # noqa: E402
from tests.test_storylines_run import world  # noqa: E402


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


def _boys(w, me, n, grade=None):
    return [c for c in sorted(w.students(), key=lambda c: c.id) if c.gender == "m" and c.id != me.id
            and c.household_id != me.household_id and (grade is None or c.grade == grade)][:n]


def test_reading_a_sheet_is_lenient():
    sim, me = world()
    p = rosters.parse(sim, """```
## Football 2010-2011 (only these)
- player: Joe Smith | Senior | running back | #22 | Varsity | Co-Captain | the star
coach: Tom Bryant | head coach | old-school
nonsense line
-- Chess Club
-- Teachers
teacher: Mr. Haddad | Honors English 9 | advisor: the newspaper
```""")
    fb, staff = p["sections"]
    assert fb["team"] == "football" and fb["year"] == 0 and fb["only"]
    pl = rosters._read_player("football", fb["rows"][0]["fields"])
    assert pl == {"grade": 12, "pos": "RB", "jersey": 22, "level": "varsity", "captain": True, "note": "the star"}
    assert staff["kind"] == "staff" and staff["rows"][0]["kind"] == "teacher"
    assert any("nonsense" in n for n in p["notes"]) and any("Chess Club" in n for n in p["notes"])
    assert rosters._year_of(sim, "-- Baseball spring 2012", 0) == 1 and rosters._year_of(sim, "sophomore year", 0) == me.grade - 9 + 1 - (me.grade - 9)


def test_a_sheet_matches_people_makes_new_ones_and_sets_the_team():
    sim, me = world()
    w = sim.w
    a, b = _boys(w, me, 2, grade=11)[:2] if len(_boys(w, me, 2, grade=11)) >= 2 else _boys(w, me, 2)
    sheet = f"""-- Football 2010-11
player: {a.first} {a.last} | {rosters.calm_year(a.grade)} | QB | #7 | varsity | captain | the star, cocky
player: Tyler Brennan | sophomore | LB | #44 | JV | backup, funny
player: {me.first} {me.last} | {rosters.calm_year(me.grade)} | WR | #3 | varsity
"""
    p = rosters.plan(sim, sheet)
    st = {r["name"]: r["status"] for r in p["rows"]}
    assert st[f"{a.first} {a.last}"] == "found" and st["Tyler Brennan"] == "new" and st[f"{me.first} {me.last}"] == "found"
    r = rosters.apply(sim, sheet)
    assert not r["skipped"]
    t = next(c for c in w.chars.values() if c.name == "Tyler Brennan")
    assert t.grade == 10 and t.gender == "m" and t.positions["football"] == "LB" and t.jersey == 44 and t.bio == "backup, funny"
    assert t.traits["impulsivity"] == 70 and t.skills["football"] == 46
    assert a.positions["football"] == "QB" and a.jersey == 7 and a.skills["football"] == 82 and a.traits["empathy"] == 30
    ros = rosters.pinned(w, "football", 0)
    assert ros["players"] == {a.id: "varsity", t.id: "jv", me.id: "varsity"} and ros["captains"] == [a.id]
    assert groundwork.get(w)["sheets"][0]["year"] == 0


def test_tryouts_keep_the_sheets_roster_and_only_these_keeps_others_off():
    sim, me = world()
    w = sim.w
    listed = _boys(w, me, 3)
    other = [c for c in _boys(w, me, 20) if c not in listed]
    lines = "\n".join(f"player: {c.first} {c.last} | {rosters.calm_year(c.grade)} | varsity" for c in listed)
    rosters.apply(sim, f"-- Football 2010-11 (only these)\n{lines}\n")
    g = w.groups["football"]
    _to(sim, calm.md_to_day(0, (9, 6)))
    assert g["members"], "the tryout ran"
    assert all(c.id in g["members"] and g["levels"][c.id] == "varsity" for c in listed)
    assert not any(c.id in g["members"] for c in other)  # (only these)


def test_coaches_rename_take_over_and_join_with_their_style():
    sim, me = world()
    w = sim.w
    fb, bb = w.groups["football"], w.groups["basketball"]
    old = w.chars[bb["staff"]]
    solo = sum(1 for g in w.groups.values() if g.get("staff") == old.id) == 1
    r = rosters.apply(sim, """-- Boys Basketball 2010-11
coach: Frank Russo | head coach | players' coach, plays seniors
coach: Dave Grant | JV coach | laid back
-- Football 2010-11
coach: Bill Dunn | defensive coordinator | intense
""")
    assert not r["skipped"]
    head = w.chars[bb["staff"]]
    assert head.name == "Coach Russo" and head.first == "Frank" and head.flags["favors"] == "seniors" and head.traits["empathy"] == 80
    if solo:
        assert head.id == old.id  # (renamed, so storylines that cast the basketball coach keep them)
    jv = next(w.chars[x] for x in bb["assistants"] if w.chars[x].last == "Grant")
    assert "JV" in jv.role_label and "basketball" in jv.role_label.lower()
    dc = next(w.chars[x] for x in fb["assistants"] if w.chars[x].last == "Dunn")
    assert "assistant" in dc.role_label.lower() and dc.traits["discipline"] == 85
    # the same coach named with their real first name is the same person, not a second one
    n = len(w.chars)
    rosters.apply(sim, "-- Boys Basketball 2011-12\ncoach: Frank Russo | head coach\n")
    assert len(w.chars) == n and w.chars[bb["staff"]].id == head.id


def test_teachers_are_in_your_schedule_and_advise_clubs():
    sim, me = world()
    w = sim.w
    mine = classes.schedule(sim, me)
    eng = next(x for x in mine if x["id"] == "english")
    r = rosters.apply(sim, f"""-- Teachers
teacher: Mr. Haddad | {eng['name']}, English 10 | advisor: Robotics Club | dry humor, tough grader
staff: Dr. Alvarez | Principal | strict but fair
teacher: Ms. Nobody | Underwater Basket Weaving
""")
    t = next(c for c in w.chars.values() if c.name == "Mr. Haddad" and c.role == "staff")
    assert next(x for x in classes.schedule(sim, me) if x["id"] == "english")["teacher"] == "Mr. Haddad"
    assert w.groups["robotics"]["staff"] == t.id and t.bio == "dry humor, tough grader"
    assert next(c for c in w.chars.values() if c.name == "Dr. Alvarez").role_label == "Principal"
    plan = rosters.plan(sim, "-- Teachers\nteacher: Ms. Nobody | Underwater Basket Weaving\n")
    assert plan["rows"][0]["warn"].startswith("not a class")
    assert r["done"]


def test_start_over_puts_the_sheets_back():
    sim, me = world()
    w = sim.w
    rosters.apply(sim, "-- Football 2010-11\nplayer: Tyler Brennan | junior | QB | #12 | varsity\ncoach: Bill Dunn | assistant\n"
                       "-- Teachers\nteacher: Mrs. Lombardi | Honors Geometry\n")
    g = groundwork.get(w)
    sim2, me2 = world()
    out = groundwork.apply(sim2, g)
    w2 = sim2.w
    t = next(c for c in w2.chars.values() if c.name == "Tyler Brennan")
    assert t.grade == 11 and rosters.pinned(w2, "football", 0)["players"][t.id] == "varsity"
    assert any(w2.chars[x].last == "Dunn" for x in w2.groups["football"].get("assistants") or [])
    assert (w2.meta.get("teachers") or {}).get("Honors Geometry") and len(groundwork.get(w2)["sheets"]) == 1
    assert out["done"] >= 3


def test_the_phone_rosters_flow():
    from fastapi.testclient import TestClient

    from lifeos import api
    from lifeos.storage import Store
    sim, me = world()
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    api.lab.replace_world(sim.w)
    cl = TestClient(api.app)
    pr = cl.get("/api/phone/rosters/prompt", params={"ask": "football"}).json()["prompt"]
    assert "WHO'S IN MY GAME NOW" in pr and me.name in pr and "MY NOTES\nfootball" in pr
    sheet = "-- Football 2010-11\nplayer: Tyler Brennan | junior | QB | varsity\n"
    ck = cl.post("/api/phone/rosters/check", json={"text": sheet}).json()
    assert ck["counts"]["new"] == 1 and ck["rows"][0]["says"].startswith("varsity")
    ap = cl.post("/api/phone/rosters/apply", json={"text": sheet}).json()
    assert ap["done"] and not ap["skipped"]
    ov = cl.get("/api/phone/rosters").json()
    assert next(t for t in ov["teams"] if t["id"] == "football")["years"] == [0] and len(ov["sheets"]) == 1
    assert cl.post("/api/phone/rosters/apply", json={"text": "  "}).status_code == 400
