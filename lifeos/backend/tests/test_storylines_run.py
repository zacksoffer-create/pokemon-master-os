"""Storylines run as written: your pet can be in a scene's cast, a summer scene that leads into the same year's fall is
the summer before it, a storyline whose list runs backwards in the calendar plays in calendar order (named days like
winter break count), one scene that can't start doesn't hold up the rest, and you can play any scene (or a stuck
storyline's next one) right now."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import dialogue, moments, scheduler  # noqa: E402
from lifeos.engine import Simulation  # noqa: E402
from lifeos.story import begin, create_story  # noqa: E402
from tests.test_story import spec  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def world():
    sim = Simulation(create_story(spec(per=6)))
    begin(sim)
    return sim, sim.w.chars[sim.w.meta["protagonist"]]


def add(sim, text):
    r = dialogue.add_script(text)
    assert r["ok"], r.get("errors")
    sim.cat = sim.cat.__class__(sim.w.action_overrides)
    scheduler._cat_cache.clear()
    return r["ids"][0], scheduler.catalog(sim)


def scene(title, tag, line="Something happens."):
    return f"""
--- {title} [{tag}]
Mike: {line}
* "Okay."
Mike: Good.
* "Sure."
Mike: Fine.
"""


def titles(cat, pk):
    return [cat["info"][s]["title"] for s in cat["chapters"][pk]]


def test_your_dog_can_be_in_a_scene():
    sim, me = world()
    w = sim.w
    w.meta.setdefault("pets", {})["pet1"] = {"id": "pet1", "name": "Bailey", "species": "dog", "household": me.household_id,
                                             "status": "home"}
    pk, cat = add(sim, "=== Dog Days\ncast: mike = older brother\ncast: bailey = Bailey\nyears: freshman\n" + """
--- The walk [freshman]
Mike: {bailey} wants the park again.
* "Fine, let's go."
Mike: He always wins.
* "Not today, {bailey}."
Mike: He's going to sulk.
""")
    sid = cat["chapters"][pk][0]
    assert "bailey" in (cat["scenes"][sid].get("cast_refs") or [])
    assert scheduler.castable(sim, me, sid, cat) is None
    r = scheduler.play_now(sim, sid)
    assert r["ok"], r
    m = next(m for m in moments.pending(w) if m["kind"] == sid)
    assert "Bailey wants the park" in m["text"]


def test_a_summer_scene_that_leads_into_the_fall_is_the_summer_before():
    sim, me = world()
    pk, cat = add(sim, "=== Preseason\ncast: mike = older brother\nyears: sophomore\n"
                  + scene("Camp", "sophomore · August") + scene("Tryouts", "sophomore · September") + scene("First game", "sophomore · October"))
    camp = cat["chapters"][pk][0]
    assert cat["scenes"][camp]["when"]["years"] == ["freshman"]  # the August before sophomore year
    assert camp in cat["calendar_notes"][pk]["summer_before"]
    assert titles(cat, pk) == ["Camp", "Tryouts", "First game"]
    # (an August scene at the end of a year, with nothing after it that year, stays where it is)
    pk2, cat = add(sim, "=== Summer job\ncast: mike = older brother\nyears: freshman\n" + scene("Spring", "freshman · April") + scene("The job", "freshman · August"))
    assert cat["scenes"][cat["chapters"][pk2][1]]["when"]["years"] == ["freshman"] and pk2 not in cat["calendar_notes"]


def test_a_storyline_listed_out_of_calendar_order_plays_in_calendar_order():
    sim, me = world()
    pk, cat = add(sim, "=== Nicole's season\ncast: mike = older brother\nyears: freshman\n"
                  + scene("Opener", "freshman · September") + scene("Winter talk", "freshman · winter break")
                  + scene("The rival", "freshman · October") + scene("Goodbye", "freshman · November"))
    assert titles(cat, pk) == ["Opener", "The rival", "Goodbye", "Winter talk"]  # the dates win
    assert cat["calendar_notes"][pk]["reordered"] >= 1


def test_one_scene_that_cant_start_doesnt_hold_up_the_storyline():
    sim, me = world()
    w = sim.w
    pk, cat = add(sim, "=== Line\ncast: mike = older brother\nyears: freshman\n"
                  + scene("One", "freshman") + scene("Two", "freshman") + scene("Three", "freshman"))
    one, two, _ = cat["chapters"][pk]
    assert scheduler.next_chapter(sim, me, pk, cat)[0] == one
    scheduler._note(w, one, "waiting", "missing_cast", "cast:jv_coach")  # (it was tried today and couldn't start)
    assert scheduler.next_chapter(sim, me, pk, cat)[0] == two
    assert scheduler.next_chapter(sim, me, pk, cat, day=w.day + scheduler.RETRY_DAYS)[0] == one  # tried again later


def test_play_any_scene_now_or_get_a_storyline_going():
    sim, me = world()
    w = sim.w
    pk, cat = add(sim, "=== Later\ncast: mike = older brother\nyears: freshman, junior\n"
                  + scene("Fall", "freshman · November") + scene("Way later", "junior · March"))
    fall, later = cat["chapters"][pk]
    assert scheduler.gate(sim, me, later, cat) is not None  # it isn't its time
    r = scheduler.play_now(sim, later)
    assert r["ok"] and r["title"] == "Way later"
    assert any(m["kind"] == later for m in moments.pending(w))
    assert not scheduler.play_now(sim, later)["ok"]  # it's on your Story tab already
    r = scheduler.start_storyline(sim, pk)
    assert r["ok"] and r["title"] == "Fall"
    for m in list(moments.pending(w)):
        moments.resolve(sim, m["id"], 0)
    assert scheduler.play_now(sim, fall)["why"] == "it already happened"
    assert not scheduler.start_storyline(sim, pk)["ok"]  # every scene in it has played
    assert not scheduler.play_now(sim, "nope")["ok"]


def test_play_now_through_the_api():
    from fastapi.testclient import TestClient

    from lifeos import api
    from lifeos.storage import Store
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    sim = api.lab.sim
    pk, cat = add(sim, "=== Later\ncast: mike = older brother\nyears: junior\n" + scene("Way later", "junior · March"))
    r = c.post("/api/story/storyline/start", json={"pack": pk})
    assert r.status_code == 200 and r.json()["title"] == "Way later"
    assert any(m["kind"] == cat["chapters"][pk][0] for m in c.get("/api/phone/state").json()["moments"])
    assert c.post("/api/story/scene/play_now", json={"sid": "nope"}).status_code == 422


def test_teammate_scenes_play_in_the_forecast():
    """The fast forecast holds each team's tryout, so a storyline about someone's teammates can be cast in it."""
    sim, me = world()
    w = sim.w
    g = next(g for g in w.groups.values() if g.get("kind") == "team" and g.get("skill") and not g["members"]
             and g.get("school", "hchs") != "college")
    tryout = next((i for i in w.calendar if i.get("kind") == "tryout" and i.get("group") == g["id"]), None)
    assert tryout is not None
    w.day = tryout["day"] - 1
    sim._refresh_day()
    for c in w.students():  # (a few kids who clearly play it)
        if c.school == g.get("school", "hchs") and (not g.get("gender") or c.gender == g.get("gender")):
            c.skills[g["skill"]] = 70
    scheduler._light_day(sim)
    assert w.day == tryout["day"] and g["members"]
    assert all(g["id"] in w.chars[m].memberships for m in g["members"])
    assert len(g["members"]) <= g["capacity"] + g.get("jv_capacity", 0)
    assert calm.date_of(w.day)  # (it's a real day)


def test_a_coach_role_is_that_sports_coach_and_never_two_roles_at_once():
    sim, me = world()
    w = sim.w
    shared = w.groups["football"]["staff"]
    w.groups["baseball"]["staff"] = shared  # (one coach runs both, like in a generated school)
    coach = w.chars[shared]
    pk, cat = add(sim, "=== Two sports\ncast: mike = older brother\n"
                  f"cast: bryant = {coach.first}\n"
                  "cast: varsity_coach = coach, Guilford varsity football coach, demanding\n"
                  "cast: jv_coach = coach, Guilford junior varsity baseball coach, patient\n"
                  "cast: girls_coach = coach, Guilford girls varsity soccer coach\n"
                  "years: freshman\n" + """
--- Film session [freshman]
{bryant} and {varsity_coach} argue about the depth chart while {jv_coach} watches. {girls_coach} walks by.
* "Okay."
Mike: Wow.
* "Not my business."
Mike: Smart.
""")
    sid = cat["chapters"][pk][0]
    assert scheduler.castable(sim, me, sid, cat) is None
    assert dialogue.bind(sim, me, "bryant") == shared
    vc = dialogue.bind(sim, me, "varsity_coach")
    jv = dialogue.bind(sim, me, "jv_coach")
    gc = dialogue.bind(sim, me, "girls_coach")
    assert len({shared, vc, jv, gc}) == 4  # four roles, four people
    assert w.groups["football"]["staff"] == vc  # (the new varsity football coach takes over football)
    assert w.groups["baseball"]["staff"] == shared and jv in w.groups["baseball"].get("assistants", [])
    assert gc == w.groups["soccer_girls"]["staff"]  # Nicole's coach, not one of yours
    assert w.chars[vc].role == "staff" and "football" in w.chars[vc].role_label.lower()
    assert dialogue.bind(sim, me, "varsity_coach") == vc  # and it stays them


def test_the_day_before_a_tryout_you_get_asked_and_signing_up_means_you_go():
    sim, me = world()
    w = sim.w
    it = next(i for i in w.calendar if i.get("kind") == "tryout" and i.get("group") == "basketball")
    me.interests["basketball"] = 90
    me.memberships = [g for g in me.memberships if g != "basketball"]
    w.day = it["day"] - 2
    w.phase = len(calm.phases_for(w.day, sim.cat.world["calendar"])) - 1
    while w.day < it["day"] - 1:
        sim.step()
    sim.step()  # the morning before
    m = next(m for m in moments.pending(w) if m["kind"] == "tryout_eve")
    assert "Basketball" in m["title"] and [c["label"] for c in m["choices"]] == ["Sign me up.", "Not this year."]
    moments.resolve(sim, m["id"], 0)
    assert me.id in w.registrations.get(it["key"], [])
    while w.day < it["day"]:
        for x in list(moments.pending(w)):
            moments.resolve(sim, x["id"], None)
        sim.step()
    while sim.current_phase() != it.get("slot", "after_school") and w.day == it["day"]:
        for x in list(moments.pending(w)):
            moments.resolve(sim, x["id"], None)
        sim.step()
    _, dec = sim.options_for(me.id)
    i = sim.must_go(dec)
    assert i is not None and dec["cands"][i].extra.get("kind") == "tryout"  # (you signed up: you go)
