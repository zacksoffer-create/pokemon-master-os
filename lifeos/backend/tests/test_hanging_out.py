"""Hanging out like real life: mostly in small groups, one on one only with people you're close to, and nobody asks while
they (or you) have practice."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _story():
    from fastapi.testclient import TestClient
    from lifeos import api, moments
    from lifeos.storage import Store
    from tests.test_story import spec
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    for m in moments.pending(api.lab.w):
        moments.resolve(api.lab.sim, m["id"], None)
    w = api.lab.w
    me = w.chars[w.meta["protagonist"]]
    sibs = set(api.lab.sim.siblings(me.id))
    ppl = [p["id"] for p in c.get("/api/phone/editor").json()["people"] if not p["me"] and p["id"] not in sibs and p["role"] == "student"]
    return c, api, me, ppl


def test_only_people_who_know_you_ask_you_one_on_one_and_not_too_often():
    from lifeos import squad
    c, api, me, ppl = _story()
    sim, w = api.lab.sim, api.lab.w
    stranger, friend = ppl[0], ppl[1]
    c.post(f"/api/phone/editor/pair/{me.id}/{stranger}", json={"preset": "acquaintance"})
    c.post(f"/api/phone/editor/pair/{me.id}/{friend}", json={"preset": "close_friend"})
    assert not squad.can_ask(sim, stranger, "evening")
    assert squad.can_ask(sim, friend, "evening")
    squad.note_ask(w)
    squad.note_ask(w)
    assert not squad.can_ask(sim, friend, "evening")  # two this week already
    w.meta["asks"] = []
    real = sim.committed
    sim.committed = lambda cid, slot=None: {"kind": "practice", "group": "x", "label": "practice"} if cid == friend else real(cid, slot)
    try:
        assert not squad.can_ask(sim, friend, "evening")  # they have practice
    finally:
        sim.committed = real


def test_whos_at_practice_isnt_an_option_and_the_phone_says_so():
    c, api, me, ppl = _story()
    sim, w = api.lab.sim, api.lab.w
    for _ in range(40):
        ch = c.get("/api/phone/choices").json()
        if ch.get("ready") and any(o["action"] == "hang_out" and o.get("target") for o in ch["options"]):
            break
        for m in c.get("/api/phone/state").json()["moments"]:
            c.post(f"/api/phone/moment/{m['id']}", json={"index": None})
        c.post("/api/story/advance", json={"until": "decision"})
    targets = [o["target"] for o in ch["options"] if o["action"] == "hang_out" and o.get("target")]
    assert targets
    busy = targets[0]
    c.post(f"/api/phone/editor/pair/{me.id}/{busy}", json={"preset": "friend"})
    real = sim.committed
    sim.committed = lambda cid, slot=None: {"kind": "practice", "group": "x", "label": "practice"} if cid == busy else real(cid, slot)
    try:
        ch = c.get("/api/phone/choices").json()
    finally:
        sim.committed = real
    assert busy not in [o.get("target") for o in ch["options"] if o["action"] in ("hang_out", "date")]
    assert any(b["id"] == busy and b["what"] == "practice" for b in ch["busy"])
    # one on one with someone you're not close to sits behind the group stuff
    solo = [o for o in ch["options"] if o["action"] == "hang_out" and o.get("minor")]
    groups = [i for i, o in enumerate(ch["options"]) if o["action"] in ("squad", "hang_group")]
    if solo and groups:
        assert max(groups) < min(ch["options"].index(o) for o in solo)


def test_a_friend_asks_you_along_with_their_people_and_you_say_yes_by_text():
    from lifeos import squad
    c, api, me, ppl = _story()
    sim, w = api.lab.sim, api.lab.w
    host, pal = ppl[0], ppl[1]
    c.post(f"/api/phone/editor/pair/{me.id}/{host}", json={"preset": "close_friend"})
    c.post(f"/api/phone/editor/pair/{host}/{pal}", json={"preset": "close_friend"})
    w.meta.pop("group_invite", None)
    for d in range(60):  # some mornings it happens
        squad.invite_dawn(sim)
        if squad.invite(sim):
            break
        w.day += 1
    gi = squad.invite(sim)
    assert gi and gi["host"] in w.chars and gi["crew"]
    th = c.get(f"/api/phone/thread/dm:{gi['host']}").json()
    msg = next(m for m in th["msgs"][::-1] if m.get("replies"))
    assert msg["text"].endswith("in?")  # in their texting style ("u in?")
    r = c.post(f"/api/phone/thread/dm:{gi['host']}/reply", json={"msg": msg["id"], "index": 0})
    assert r.status_code == 200, r.text
    q = w.meta["control"]["queued"]
    assert q["target"] == gi["host"] and q["agreed"] and w.meta["control"]["crew"]["ids"] == gi["crew"]
    assert squad.invite(sim)["answer"] == "yes"
