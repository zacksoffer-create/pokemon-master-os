"""Rumors you can understand (every move says what it does, the card says what happened, a friend's text is where you
answer), sports that count at school (varsity, starting, captain, awards), and parties that feel real (the rare big
one is packed; most weekends it's a few people at somebody's house, said that way)."""
import os
import random
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import drama, messages, social, sports, talk  # noqa: E402
from lifeos.history import Effects  # noqa: E402
from tests.test_talk import _deliver, _setup  # noqa: E402
from lifeos import dialogue  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def test_every_rumor_says_what_each_move_does_and_what_happened():
    sim, me, friend = _setup()
    w = sim.w
    other = next(c for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, friend.id))
    rid = social.make_rumor(sim, other.id, "humiliated", f"{friend.name} completely roasted {other.name} at lunch", True, -0.2, 0.55, None,
                            [friend.id, me.id], None)
    row = next(r for r in drama.view(sim) if r["id"] == rid)
    assert [o["key"] for o in row["options"]] == ["tell", "pass", "drop"] and row["options"][0]["label"] == f"Warn {other.first}"
    assert all(o["does"] for o in row["options"]) and other.first in row["effect"]
    drama.act(sim, rid, "tell")
    row = next(r for r in drama.view(sim) if r["id"] == rid)
    assert row["acted"] == "tell" and row["result"].startswith("You gave") and other.first in row["result"]


def test_a_friends_text_about_a_rumor_about_you_is_where_you_answer_it():
    sim, me, friend = _setup()
    w = sim.w
    b = next(c for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, friend.id))
    rid = social.make_rumor(sim, me.id, "rejected", f"{me.name} asked {b.name} out and got shut down", True, -0.25, 0.6, None, [friend.id], None,
                            involves=[me.id, b.id])
    assert talk.start(sim, friend.id, only=("rumor_you",))
    _deliver(sim)
    t = messages.phone(w)["threads"][f"dm:{friend.id}"]
    m = next(x for x in t["msgs"][::-1] if x.get("replies"))
    assert (m.get("ctx") or {}).get("rumor") == rid and me.id in w.rumors[rid]["known_by"]
    own = next(i for i, r in enumerate(m["replies"]) if r.get("act") == "own")
    messages.reply(sim, f"dm:{friend.id}", m["id"], own)
    assert drama.state(w)["acted"][rid] == "own"
    assert any(x["kind"] == "note" and "owned it" in x["text"] for x in t["msgs"])


def test_gossip_about_someone_else_comes_with_what_you_can_do():
    sim, me, friend = _setup()
    w = sim.w
    other = next(c for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, friend.id))
    rid = social.make_rumor(sim, other.id, "fight", f"{other.name} and somebody got into a huge fight", True, -0.1, 0.9, None, [friend.id], None)
    class Sure(random.Random):  # (gossip reaches you today, for sure)
        def random(self):
            return 0.0
    drama._gossip_reaches_you(sim, me, drama.state(w), Sure())
    _deliver(sim)
    t = messages.phone(w)["threads"][f"dm:{friend.id}"]
    m = next(x for x in t["msgs"][::-1] if x.get("replies"))
    assert [r["act"] for r in m["replies"]] == ["tell", "pass", "drop"] and m["ctx"]["rumor"] == rid
    messages.reply(sim, f"dm:{friend.id}", m["id"], 2)
    assert drama.state(w)["acted"][rid] == "drop"


def test_sports_count_for_a_lot_at_school():
    sim, me, friend = _setup()
    w = sim.w
    a, b = [c for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, friend.id) and c.gender == "m"][:2]
    for c in (a, b):  # (the same person twice, except for sports)
        c.memberships = [g for g in c.memberships if w.groups[g]["kind"] != "team"]
        for g in w.groups.values():
            if c.id in g.get("members", []):
                g["members"].remove(c.id)
        c.reputation["athlete"] = 0
        c.awards = []
    g = w.groups["football"]
    g["members"].append(a.id)
    a.memberships.append("football")
    g.setdefault("levels", {})[a.id] = "varsity"
    a.awards.append({"day": w.day, "label": "All-SCC Football", "sport": "football"})
    pts, why = sports.athletic_standing(w, a)
    assert pts >= 250 and why[0].startswith("Varsity football") and "All-SCC Football" in why
    assert sports.athletic_standing(w, b)[0] == 0
    for c in (a, b):
        c.popularity = 50.0
    social.recompute_popularity(sim, Effects(w, None))
    assert w.meta["popularity_raw"][a.id] - w.meta["popularity_raw"][b.id] > 200


def test_most_weekends_its_a_few_people_and_the_big_party_is_packed():
    from lifeos import calendar as calm
    from lifeos import engine, nights
    sim, me, friend = _setup()
    w = sim.w
    # a few people over: small, said that way, no cops
    host = friend
    key = f"party:{host.id}:{w.day}"
    w.parties[key] = {"key": key, "day": w.day, "host": host.id, "invited": [me.id], "slot": "evening", "big": False}
    sim.slot = engine.SlotState("evening")
    others = [c.id for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, host.id)][:3]
    sim.slot.attend[("party", key)] = [me.id] + others
    sim.institutions.party(key, random.Random(1))
    st = w.meta["night"]
    assert st["event"] == f"At {host.first}'s" and st["plan"][0] == "arrive_small" and "busted" not in st["plan"] and st["n"] <= 6
    # a real party is rare (two weeks apart at least) and big
    w.meta["last_big_party"] = w.day
    assert nights.big_night(sim, me, random.Random(0)) is None
    w.meta["last_big_party"] = -99
    ev = sim.new_event("game", "win", [me.id], [], 14, {"opponent": "Hand", "level": "varsity", "score": "21-14"}, group="football")
    w.history.add(ev)
    assert nights.big_night(sim, me, random.Random(0)) == "after the win"
    assert calm  # (imported for the calendar)
