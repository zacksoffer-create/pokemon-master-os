"""Lunch is a routine: everyone has a table and sits there every school day. Groups sit together (a big one takes two
tables), tables stick week to week (people only move when they've really drifted), you set your table rather than pick
a person, and lunch is where relationships drift a little each day, never wildly."""
import os
import random
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient  # noqa: E402

from lifeos import api, lunch, moments  # noqa: E402
from lifeos import calendar as calm  # noqa: E402
from lifeos.engine import Simulation  # noqa: E402
from lifeos.storage import Store  # noqa: E402
from lifeos.story import begin, create_story  # noqa: E402
from tests.test_story import spec  # noqa: E402


def world():
    sim = Simulation(create_story(spec(per=6)))
    begin(sim)
    return sim, sim.w.chars[sim.w.meta["protagonist"]]


def studs(sim):
    return [c.id for c in lunch._students(sim.w)]


def set_groups(sim, me, big=11, small=4):
    """A big group with you in it (more than a table seats) and a small one; everyone else on their own."""
    ids = [cid for cid in studs(sim) if cid != me.id]
    w = sim.w
    w.cliques = {"q1": {"name": "the Big Group", "members": [me.id] + ids[:big - 1], "active": True},
                 "q2": {"name": "the Small Group", "members": ids[big - 1:big - 1 + small], "active": True}}
    for q in w.cliques.values():  # a group is people who get on
        for a in q["members"]:
            for b in q["members"]:
                if a < b:
                    set_aff(w, a, b, 40)
    w.meta.pop("lunch", None)
    lunch.rebuild(sim)
    return w.cliques["q1"]["members"], w.cliques["q2"]["members"]


def set_aff(w, a, b, v):
    for x, y in ((a, b), (b, a)):
        w.ensure_rel(x, y, w.day).affection = v


def test_groups_sit_together_and_a_big_one_takes_two_tables():
    sim, me = world()
    big, small = set_groups(sim, me)
    st = lunch.store(sim.w)
    home = st["home"]
    assert set(home) == set(studs(sim))  # everyone has a table
    big_tables = {home[m] for m in big}
    assert len(big_tables) == 2  # 11 people: two tables side by side
    for t in big_tables:
        tb = st["tables"][t]
        assert tb["name"] == "the Big Group" and tb["of"] == 2 and len(tb["members"]) <= lunch.SEATS
    assert len({home[m] for m in small}) == 1  # a small group: one table
    assert all(len(t["members"]) >= 2 for t in st["tables"].values())  # nobody eats alone by routine
    assert all(len(t["members"]) <= lunch.SEATS for t in st["tables"].values())


def test_a_table_sticks_unless_you_really_drift():
    sim, me = world()
    big, small = set_groups(sim, me)
    w = sim.w
    before = dict(lunch.store(w)["home"])
    # the group loses two people and changes its name: nobody moves
    w.cliques["q1"]["members"] = big[:-2]
    w.cliques["q1"]["name"] = "the Renamed Crew"
    lunch.weekly(sim)
    assert lunch.store(w)["home"] == before
    assert any(t["name"] == "the Renamed Crew" for t in lunch.store(w)["tables"].values())
    # someone really drifts: their table goes cold on them and another table is close
    st = lunch.store(w)
    mover = next(m for m in big if m != me.id)
    mine_t = st["tables"][st["home"][mover]]["members"]
    other = st["tables"][st["home"][small[0]]]["members"]
    for m in mine_t:
        if m != mover:
            set_aff(w, mover, m, -20)
    for m in other:
        set_aff(w, mover, m, 60)
    lunch.weekly(sim)
    st = lunch.store(w)
    assert st["home"][mover] == st["home"][small[0]]
    assert sum(1 for k, v in st["home"].items() if before.get(k) != v) == 1  # only them
    assert mover in st["since"]  # and they're new at that table for a while


def test_everyone_sits_at_their_table_and_visits_are_rare(monkeypatch):
    sim, me = world()
    big, small = set_groups(sim, me)
    w = sim.w
    st = lunch.store(w)
    joins, newcomers = lunch.seating(sim, set(), [], random.Random(1))
    seated = {m for p in joins for m in p}
    assert seated == {m for t in st["tables"].values() for m in t["members"] if w.chars[m].location != "away"}
    for a, b in joins:
        assert st["home"][a] == st["home"][b]  # everyone with their own table
    assert not newcomers
    # a visit: someone spends the day at a friend's other table, and is new there
    visitor, host = small[0], big[3]
    monkeypatch.setattr(lunch, "VISIT_P", 1.0)
    joins, newcomers = lunch.seating(sim, set(), [(visitor, host)], random.Random(1))
    assert (visitor, host) in joins and visitor in newcomers
    assert not any(a == visitor and st["home"][b] == st["home"][visitor] for a, b in joins)
    monkeypatch.setattr(lunch, "VISIT_P", 0.0)
    joins, newcomers = lunch.seating(sim, set(), [(visitor, host)], random.Random(1))
    assert (visitor, host) not in joins and not newcomers


def test_you_on_the_routine_just_sit_at_your_table(monkeypatch):
    sim, me = world()
    big, small = set_groups(sim, me)
    w = sim.w
    monkeypatch.setattr(lunch, "VISIT_P", 1.0)
    moments.control(w)["auto_lunch"] = True
    joins, _ = lunch.seating(sim, {me.id}, [(me.id, small[0])], random.Random(1))
    st = lunch.store(w)
    mine = [b if a == me.id else a for a, b in joins if me.id in (a, b)]
    assert mine and all(st["home"][x] == st["home"][me.id] for x in mine)
    moments.control(w)["auto_lunch"] = False  # picking lunch yourself: your pick is where you go
    joins, newcomers = lunch.seating(sim, set(), [(me.id, small[0])], random.Random(1))
    assert (me.id, small[0]) in joins and me.id in newcomers


def test_you_set_your_table_and_can_go_back_to_your_group():
    sim, me = world()
    big, small = set_groups(sim, me)
    w = sim.w
    st = lunch.store(w)
    group_table = st["home"][me.id]
    there = st["home"][small[0]]
    v = lunch.choose(sim, there)
    assert v["mine"] == there and v["picked"] and next(t for t in v["tables"] if t["yours"])["id"] == there
    lunch.weekly(sim)  # it holds
    assert lunch.store(w)["home"][me.id] == there
    v = lunch.choose(sim, None)
    assert not v["picked"] and lunch.store(w)["tables"][v["mine"]]["group"] == "q1"
    assert v["mine"] in {lunch.store(w)["home"][m] for m in big if m != me.id}
    with pytest.raises(KeyError):
        lunch.choose(sim, "nope")
    full = next((t for t in lunch.store(w)["tables"].values() if len(t["members"]) >= lunch.SEATS and me.id not in t["members"]), None)
    if full is not None:
        with pytest.raises(ValueError):
            lunch.choose(sim, full["id"])
    assert group_table  # (where you started)


def test_a_new_school_year_starts_fresh():
    sim, me = world()
    set_groups(sim, me)
    w = sim.w
    st = lunch.store(w)
    lunch.choose(sim, st["home"][w.cliques["q2"]["members"][0]])
    st["year"] = calm.school_year_of(w.day) - 1
    lunch.rebuild(sim)
    st = lunch.store(w)
    assert st["mine"] is None and st["year"] == calm.school_year_of(w.day)
    assert st["tables"][st["home"][me.id]]["group"] == "q1"  # back with your group, fresh
    assert not st["since"]


class FakeFx:
    def __init__(self):
        self.calls = []

    def rel(self, a, b, field, delta, why):
        self.calls.append((a, b, field, delta))


def test_lunch_happenings_are_small_and_never_yours_to_start():
    sim, me = world()
    big, small = set_groups(sim, me)
    w = sim.w
    table = lunch.store(w)["tables"][lunch.store(w)["home"][me.id]]["members"]
    rng = random.Random(7)
    lines = 0
    for _ in range(3000):
        fx = FakeFx()
        line = lunch.happening(sim, fx, table, rng)
        lines += bool(line)
        for a, b, field, delta in fx.calls:
            assert abs(delta) <= 2.5  # small steps
            if field == "attraction" or delta == -0.8:  # (noticing someone; the one who took the shot)
                assert a != me.id  # you never start something on autopilot
    assert 0.08 < lines / 3000 < 0.25  # now and then, not every day
    other = lunch.store(w)["tables"][lunch.store(w)["home"][small[0]]]["members"]
    quiet = sum(bool(lunch.happening(sim, FakeFx(), other, rng)) for _ in range(3000))
    assert quiet == 0  # (another table's happenings don't reach your feed)


def test_lunch_runs_every_school_day_and_the_phone_shows_the_cafeteria():
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    sim = api.lab.sim
    w = sim.w
    me = w.meta["protagonist"]
    d0, seen = w.day, set(w.history.events)
    while w.day < d0 + 7:
        sim.step()
    lunches = [e for k, e in w.history.events.items() if k not in seen and e.get("type") == "lunch_table"]
    days = {e["day"] for e in lunches}
    school = {d for d in range(d0, d0 + 7) if calm.is_school_day(d, sim.cat.world["calendar"])}
    assert school and days >= school
    st = lunch.store(w)
    for e in lunches:  # a table is mostly its own people (a visitor or two at most)
        homes = [st["home"].get(m) for m in e["actors"]]
        top = max(set(homes), key=homes.count)
        assert homes.count(top) >= len(homes) - 2
    caf = c.get("/api/phone/scene").json()["cafeteria"]
    assert caf["tables"] and sum(t["yours"] for t in caf["tables"]) == 1 and caf["mine"] == st["home"][me]
    other = next(t for t in caf["tables"] if not t["yours"] and not t["full"])
    r = c.post("/api/phone/lunch/table", json={"table": other["id"]}).json()
    assert r["mine"] == other["id"] and r["picked"]
    r = c.post("/api/phone/lunch/table", json={"table": None}).json()
    assert not r["picked"]
    assert c.post("/api/phone/lunch/table", json={"table": "nope"}).status_code == 404
