"""Who's on which team, when it isn't up to the tryout: a recruit (Mike, headed to UConn for basketball) is varsity in his
sport every year whether or not he signed up, and doesn't play anything else; football has a freshman team, so freshmen
play JV; and the editor can put anyone on varsity, JV or off a team (now, if the season is under way), carried into
Start over."""
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import editor, groundwork, sports  # noqa: E402
from lifeos.engine import Simulation, SlotState  # noqa: E402
from lifeos.story import begin, create_story  # noqa: E402
from tests.test_story import spec  # noqa: E402

UCONN = {"kind": "college", "college": "uconn", "sport": "basketball"}


def world(**kw):
    s = spec(per=10, **kw)
    s["siblings"][0].update({"path": UCONN, "interests": {"football": 90, "basketball": 90}, "skills": {"football": 60}})
    sim = Simulation(create_story(s))
    begin(sim)
    w = sim.w
    me = w.chars[w.meta["protagonist"]]
    mike = next(c for c in w.chars.values() if c.first == "Mike" and c.last == "Soffer")
    return sim, me, mike


def tryout(sim, gid, came, seed=1):
    """Hold this team's tryout with these people there (signed up), and post the results."""
    w = sim.w
    it = next(i for i in sim.w.calendar if i["kind"] == "tryout" and i["group"] == gid)
    w.registrations[it["key"]] = list(came)
    got = {}
    real = sim.schedule
    sim.schedule = lambda day, kind, payload, cause=None: got.update(payload=payload)
    try:
        sim.slot = SlotState("after_school")
        sim.slot.attend[("event", it["key"])] = list(came)
        sim.institutions.selection(it, random.Random(seed))
    finally:
        sim.slot = None
        sim.schedule = real
    sim.institutions.selection_results(got["payload"], None, random.Random(seed))
    return {r["char"]: r for r in got["payload"]["rows"]}


def level(sim, gid, cid):
    g = sim.w.groups[gid]
    return (g.get("levels") or {}).get(cid, "varsity") if cid in g["members"] else None


def boys(sim, grade=None):
    return [c.id for c in sim.w.students() if c.school == "hchs" and c.gender == "m" and (grade is None or c.grade == grade)]


def test_a_recruit_makes_his_sport_and_plays_nothing_else():
    sim, me, mike = world()
    assert sports.placement(mike, "basketball") == "varsity" and sports.placement(mike, "football") == "out"
    # he signs up for football anyway: he isn't offered it, and if he's on the list he's taken off it
    assert not any(gid == "football" for gid, it, _ in sim.institutions.opportunities(mike) if it)
    rows = tryout(sim, "football", boys(sim) + [mike.id])
    assert mike.id not in rows and level(sim, "football", mike.id) is None
    # basketball: he never signed up, and he's on varsity, ahead of everyone (even with a bad day)
    rows = tryout(sim, "basketball", [c for c in boys(sim) if c != mike.id])
    assert rows[mike.id]["placed"] and level(sim, "basketball", mike.id) == "varsity"
    assert "basketball" in mike.memberships and "football" not in mike.memberships


def test_freshmen_play_on_the_freshman_football_team():
    sim, me, mike = world()
    came = [c for c in boys(sim) if c != mike.id]
    tryout(sim, "football", came)
    g = sim.w.groups["football"]
    varsity = [m for m in g["members"] if level(sim, "football", m) == "varsity"]
    assert len(varsity) < g["capacity"]  # there was room on varsity: it's the freshman rule that sends them to JV
    for cid in came:
        if cid in g["members"]:
            want = "jv" if sim.w.chars[cid].grade == 9 else "varsity"
            assert level(sim, "football", cid) == want, (sim.w.chars[cid].name, sim.w.chars[cid].grade)
    assert level(sim, "football", me.id) == "jv"
    # basketball has no freshman rule: a freshman who's good enough makes varsity
    sim2, me2, mike2 = world()
    sim2.w.rules["inst.freshman_football"] = False
    tryout(sim2, "football", [c for c in boys(sim2) if c != mike2.id])
    assert level(sim2, "football", me2.id) == "varsity"


def test_the_editor_puts_anyone_on_a_team_at_a_level():
    sim, me, mike = world()
    v = editor.person(sim, me.id)
    teams = {t["sport"]: t for t in v["teams"]}
    assert set(teams) >= {"football", "basketball", "baseball"} and "softball" not in teams
    assert teams["football"]["why"] == "Freshmen play on the freshman team (JV)" and teams["basketball"]["set"] is None
    mt = {t["sport"]: t for t in editor.person(sim, mike.id)["teams"]}
    assert mt["basketball"]["why"].startswith("Recruited to play basketball") and mt["football"]["why"].startswith("Sticks to basketball")
    # you on varsity football as a freshman, and off baseball
    editor.save_person(sim, me.id, {"teams": {"football": "varsity", "baseball": "out"}})
    assert me.flags["teams"] == {"football": "varsity", "baseball": "out"}
    other = next(c for c in boys(sim, 11))  # stays home from the tryout
    rows = tryout(sim, "football", [c for c in boys(sim) if c not in (mike.id, other)])
    assert rows[me.id]["placed"] and level(sim, "football", me.id) == "varsity"
    assert not any(gid == "baseball" for gid, it, _ in sim.institutions.opportunities(me) if it)
    # mid-season: someone who isn't on it joins now, at the level you pick; "out" takes them off
    assert level(sim, "football", other) is None
    editor.save_person(sim, other, {"teams": {"football": "jv"}})
    assert level(sim, "football", other) == "jv"
    editor.save_person(sim, other, {"teams": {"football": "out"}})
    assert level(sim, "football", other) is None and "football" not in sim.w.chars[other].memberships
    # back to tryouts deciding
    editor.save_person(sim, me.id, {"teams": {"baseball": None}})
    assert me.flags["teams"] == {"football": "varsity"}
    # Start over keeps it
    assert groundwork.get(sim.w)["people"][me.id]["set"]["teams"] == {"football": "varsity"}
    # bad values say so
    for bad in ({"teams": {"football": "starter"}}, {"teams": {"softball": "jv"}}, {"teams": "varsity"}):
        try:
            editor.save_person(sim, me.id, bad)
            raise AssertionError(bad)
        except editor.EditorError:
            pass
