"""Hanging out: quicker and more fun. Scenes with one styled choice, the crew, a backup friend, and lunch on autopilot."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import api, chat, hangouts, moments, phone_api  # noqa: E402
from lifeos.storage import Store  # noqa: E402
from tests.test_phone import story  # noqa: E402


def _world(friends=4):
    w, sim = story(pet=False)
    sim.advance_days(9)
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    api.lab.replace_world(w)
    sim, w = api.lab.sim, api.lab.w
    me = w.chars[w.meta["protagonist"]]
    pals = []
    for c in sorted(w.students(), key=lambda c: c.id):
        if c.id != me.id and c.id not in sim.siblings(me.id) and c.grade == me.grade and c.location == me.location and len(pals) < friends:
            a, b = w.ensure_rel(me.id, c.id, w.day), w.ensure_rel(c.id, me.id, w.day)
            a.affection, a.familiarity, b.affection, b.familiarity = 55 - len(pals), 60, 50, 60
            pals.append(c.id)
    return w, sim, me, pals


def _to_slot(sim, w, me, slots=("after_school", "day", "evening")):
    for _ in range(60):
        for m in moments.pending(w):
            moments.resolve(sim, m["id"], None)
        ch = phone_api.phone_choices()
        if ch.get("ready") and ch["slot"] in slots:
            return ch
        sim.step()
    raise AssertionError("never got to a free afternoon")


def test_scenes_load_as_moments_and_every_choice_is_a_style():
    from lifeos import dialogue
    ms = dialogue.moments()
    scenes = [k for k in ms if k.startswith("hang_")]
    assert len(scenes) >= 15
    for k in scenes:
        for ch in ms[k]["choices"]:
            assert ch["ops"][0][0] == "vibe" and ch["ops"][0][1] in chat.STYLES + ("chill",) and ch["hint"]
    kinds = {kd for sc in hangouts.scenes() for kd in sc["kind"]}
    assert kinds == {"hang", "date", "group"}


def test_a_hangout_you_pick_plays_out_and_teaches_you_what_they_like():
    w, sim, me, pals = _world()
    ch = _to_slot(sim, w, me)
    pick = next(o for o in ch["options"] if o["action"] == "hang_out" and o["target"] in pals)
    r = phone_api.phone_choose({"index": pick["index"]})
    assert not any(l["type"] == "interact.hang_out" and "invited" in l["text"] and me.first in l["text"] for l in r["lines"])
    hang = [m for m in moments.pending(w) if m["kind"].startswith("hang_")]
    assert len(hang) == 1, [l["text"] for l in r["lines"]]
    m = hang[0]
    them = m["ctx"]["them"]
    assert all(c["hint"] for c in m["choices"])
    styled = next(i for i, c in enumerate(m["_choices"]) if c["ops"][0][1] in chat.STYLES)
    style = m["_choices"][styled]["ops"][0][1]
    before = w.rels[(them, me.id)].affection
    out = phone_api.phone_moment(m["id"], {"index": styled})
    whys = [l for l in out["lines"] if l["type"] == "why"]
    assert whys and w.chars[them].first in whys[0]["text"]
    assert any(l["type"] == "say" for l in out["lines"]), "something happens, in words"
    known = {x["style"]: x for x in chat.tastes_view(sim, them)}
    assert known[style]["known"] and known[style]["taste"] == chat.tastes(w.chars[them])[style]
    delta = w.rels[(them, me.id)].affection - before
    vibe = next(e for e in w.history.events.values() if e["type"] == "moment" and e["outcome"] == m["kind"])["data"]["vibe"]
    assert (delta > 0) if vibe in ("good", "meh") else (delta < 0), (vibe, delta)
    # one scene a day: another hangout today doesn't bring up a second
    assert hangouts.maybe_scene(sim, me.id, pals[-1], "hang") is None


def test_the_crew_comes_along_and_everyone_gets_closer():
    w, sim, me, pals = _world()
    ch = _to_slot(sim, w, me)
    crew = next((o for o in ch["options"] if o["action"] == "hang_group"), None)
    assert crew and len(crew["crew"]) == 2 and crew["text"].startswith("Hang out with ") and crew["key"].startswith("crew")
    assert not any(x in sim.siblings(me.id) for x in crew["crew"] + [crew["target"]])
    r = phone_api.phone_choose({"index": crew["index"], "crew": crew["crew"]})
    lines = {l["type"]: l for l in r["lines"]}
    assert "crew" in lines and lines["crew"]["text"].endswith("came too."), [l["text"] for l in r["lines"]]
    ev = next(e for e in w.history.events.values() if e["type"] == "interact.hang_out" and e["data"].get("crew"))
    assert set(ev["data"]["crew"]) <= set(crew["crew"]) and all(x in ev["involved"] for x in ev["data"]["crew"])
    scene = next((m for m in moments.pending(w) if m["kind"].startswith("hang_")), None)
    assert scene is None or "group" in sim.cat.moments[scene["kind"]]["hangout"]


def test_your_pick_is_busy_so_you_hang_out_with_someone_else():
    from lifeos import actions
    w, sim, me, pals = _world()
    _to_slot(sim, w, me)
    first = pals[0]
    w.chars[first].location = "away"  # not around today
    ch = phone_api.phone_choices()
    pick = next((o for o in ch["options"] if o["action"] == "hang_out" and o["target"] == first), None)
    if pick is None:
        return  # they're not even an option when they're away
    r = phone_api.phone_choose({"index": pick["index"]})
    assert any(l["type"] == "swap" for l in r["lines"]) or any("passed" in l["text"] for l in r["lines"])


def test_lunch_runs_on_autopilot_unless_you_turn_it_off():
    from fastapi.testclient import TestClient
    w, sim, me, pals = _world()
    c = TestClient(api.app)
    assert moments.control(w)["auto_lunch"] is True
    stops = []
    for _ in range(8):
        for m in c.get("/api/phone/state").json()["moments"]:
            r = c.post(f"/api/phone/moment/{m['id']}", json={"index": 0}).json()
            if r.get("minigame"):
                c.post(f"/api/phone/moment/{m['id']}", json={"index": 0, "auto": True})
        c.post("/api/story/advance", json={"until": "decision"})
        stops.append(sim.current_phase())
    assert "lunch" not in stops, stops
    c.post("/api/story/control", json={"auto_lunch": False})
    stops = []
    for _ in range(8):
        for m in c.get("/api/phone/state").json()["moments"]:
            r = c.post(f"/api/phone/moment/{m['id']}", json={"index": 0}).json()
            if r.get("minigame"):
                c.post(f"/api/phone/moment/{m['id']}", json={"index": 0, "auto": True})
        c.post("/api/story/advance", json={"until": "decision"})
        stops.append(sim.current_phase())
    assert "lunch" in stops, stops


def test_when_you_make_a_plan_you_go_first():
    w, sim, me, pals = _world()
    _to_slot(sim, w, me)
    ch = phone_api.phone_choices()
    pick = next(o for o in ch["options"] if o["action"] == "hang_out" and o["target"] in pals)
    before = w.history.next_event
    phone_api.phone_choose({"index": pick["index"]})
    mine = [e for eid, e in w.history.events.items() if eid >= before and e["type"] == "interact.hang_out" and me.id in e["actors"]]
    assert mine and mine[0]["outcome"] not in ("busy",), "your friend wasn't already booked: you asked first"
