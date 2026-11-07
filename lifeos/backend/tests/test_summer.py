"""Summer at Watch Hill: the family and the Watch Hill crowd go when school's out (after your spring season, if it runs
into June), a summer day has a morning with your workout as the routine, the afternoons and nights are the beach,
Bay Street, the boat and whoever's around (no studying), and everyone's home for the first day of school."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import dialogue, moments, summer  # noqa: E402
from tests.test_storylines_run import add, world  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def _to(sim, day, phase="dawn"):
    w = sim.w
    while w.day < day or (w.day == day and sim.current_phase() != phase):
        for m in moments.pending(w):
            moments.resolve(sim, m["id"], None)
        sim.step()


def _summer_world():
    sim, me = world()
    w = sim.w
    friend = next(c for c in w.students() if c.id != me.id and c.household_id != me.household_id and c.school == me.school)
    pk, cat = add(sim, f"=== Watch Hill Days\ncast: pal = {friend.first} {friend.last}\nyears: freshman\n" + """
--- The porch [freshman · July]
{pal}: Same time next summer?
* "Obviously."
{pal}: Good.
* "We'll see."
{pal}: Rude.
""")
    dialogue.bind(sim, me, "pal")
    for g in w.groups.values():  # (no spring team holding you in Guilford)
        if me.id in g.get("members", []):
            g["members"].remove(me.id)
    me.memberships = [g for g in me.memberships if w.groups.get(g, {}).get("kind") != "team"]
    w.day = calm.md_to_day(0, (5, 30))
    w.phase = len(sim.phases()) - 1
    sim._refresh_day()
    return sim, me, friend


def test_summer_is_at_watch_hill_with_the_watch_hill_crowd():
    sim, me, friend = _summer_world()
    w = sim.w
    stranger = next(c for c in w.students() if c.id not in (me.id, friend.id) and c.household_id != me.household_id)
    home = me.location
    _to(sim, calm.md_to_day(0, (6, 1)), "day")
    fam = [c for c in w.chars.values() if c.household_id == me.household_id and c.status == "active"]
    assert me.location == summer.WATCH_HILL and all(c.location == summer.WATCH_HILL for c in fam)
    assert friend.location == summer.WATCH_HILL  # (in a Watch Hill storyline: they're there too)
    assert stranger.location != summer.WATCH_HILL
    _to(sim, calm.md_to_day(0, (8, 31)), "day")
    assert me.location == home and friend.location != summer.WATCH_HILL  # home the day before school starts


def test_a_summer_day_has_a_morning_and_your_workout_is_the_routine():
    from fastapi.testclient import TestClient

    from lifeos import api, phone_api
    from lifeos.storage import Store
    sim, me, friend = _summer_world()
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    api.lab.replace_world(sim.w)
    sim, w = api.lab.sim, api.lab.w
    me = w.chars[w.meta["protagonist"]]
    _to(sim, calm.md_to_day(0, (6, 2)), "morning")
    assert sim.phases() == calm.SUMMER_PHASES
    ch = phone_api.phone_choices()
    assert ch["slot"] == "morning" and ch["options"][0]["text"] == "Your morning workout" and ch["options"][0].get("routine")
    assert {"Sleep in", "Run on the beach"} <= {o["text"] for o in ch["options"]}
    before = me.skills.get("fitness", 0)
    sim.step()  # (you didn't pick: your workout)
    assert me.skills.get("fitness", 0) > before
    _to(sim, w.day, "day")
    ch = phone_api.phone_choices()
    acts = {o["action"]: o for o in ch["options"]}
    assert "study" not in acts  # no hitting the books in July
    assert {"beach_day", "boat_day", "bay_street", "napatree"} & set(acts)
    assert all(o["section"] == "out" for a, o in acts.items() if a in ("beach_day", "boat_day", "bay_street", "napatree"))
    TestClient(api.app).get("/api/phone/state").json()  # (the phone opens on a summer morning)


def test_a_spring_team_still_playing_in_june_keeps_you_home_until_its_last_game():
    sim, me, friend = _summer_world()
    w = sim.w
    g = w.groups["baseball"]
    g["members"] = sorted(set(g["members"]) | {me.id})
    me.memberships = sorted(set(me.memberships) | {"baseball"})
    june_game = calm.md_to_day(0, (6, 4))
    w.calendar.append({"day": june_game, "kind": "game", "group": "baseball", "slot": "day", "name": "Guilford Baseball: a June game",
                       "key": "game:baseball:0:99"})
    _to(sim, calm.md_to_day(0, (6, 2)), "day")
    assert me.location != summer.WATCH_HILL
    w.calendar = [i for i in w.calendar if i.get("key") != "game:baseball:0:99"]  # (they lost: the season's over)
    _to(sim, calm.md_to_day(0, (6, 3)), "day")
    assert me.location == summer.WATCH_HILL
