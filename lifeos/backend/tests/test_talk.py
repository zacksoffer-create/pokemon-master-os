"""Texting 3.0: texts about real things (your game, their news, gossip, a quiz, a party), each with four toned replies and
an answer that fits; nobody texts about the same thing twice; a congrats once per award per season; someone you turned
down stops flirting and checks you're good; everyone has their own texting style; tapbacks, leave on read, pins, and the
inbox's "waiting on you"."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import dialogue, messages, talk  # noqa: E402
from tests.test_storylines_run import world  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def _setup():
    sim, me = world()
    w = sim.w
    messages.phone(w)
    friend = next(c for c in sorted(w.students(), key=lambda c: c.id) if c.id != me.id and c.household_id != me.household_id)
    r = w.ensure_rel(friend.id, me.id, w.day)
    r.affection, r.familiarity = 70.0, 60.0
    r2 = w.ensure_rel(me.id, friend.id, w.day)
    r2.affection, r2.familiarity = 70.0, 60.0
    messages.add_contact(sim, friend.id)
    return sim, me, friend


def _event(sim, etype, outcome, actors, targets=(), data=None):
    w = sim.w
    ev = sim.new_event(etype, outcome, list(actors), list(targets), 20, data or {})
    w.history.add(ev)
    return ev


def _deliver(sim):
    w = sim.w
    for x in messages.phone(w)["pending"]:
        x["due"] = 0
    messages.tick(sim)


def test_a_text_about_your_game_has_the_score_your_line_and_four_toned_replies():
    sim, me, friend = _setup()
    w = sim.w
    me.flags["last_game"] = {"day": w.day, "sport": "basketball", "team": "Guilford Boys Basketball", "group": "basketball", "opp": "Hand",
                             "score": "67-53", "win": True, "line": {"pts": 22, "ast": 6}, "starter": True, "tier": "great",
                             "play": f"{me.first} hit the big three late", "rivalry": True}
    tops = talk.topics(sim, friend.id)
    assert tops and tops[0][1] == "game_you_win" and tops[0][2]["opp"] == "Hand" and tops[0][2]["play"].startswith("you hit")
    assert talk.start(sim, friend.id)
    _deliver(sim)
    t = messages.phone(w)["threads"][f"dm:{friend.id}"]
    m = next(x for x in t["msgs"][::-1] if x.get("replies"))
    assert len(m["replies"]) == 4 and {r["tone"] for r in m["replies"]} == {"hype", "humble", "funny", "dry"}
    card = next(x for x in t["msgs"] if (x.get("ctx") or {}).get("card"))["ctx"]["card"]
    assert card == {"kind": "game", "win": True, "score": "67-53", "opp": "Hand", "team": "Guilford Boys Basketball"}
    # what you pick, they answer to
    funny = next(i for i, r in enumerate(m["replies"]) if r["tone"] == "funny")
    messages.reply(sim, f"dm:{friend.id}", m["id"], funny)
    last = t["msgs"][-1]
    assert last["from"] == friend.id and last["kind"] == "react"
    assert last["text"].lower().rstrip(" .!😂💀🙌😊😎🔥😅🙄😤👀🤦😭").startswith(m["replies"][funny]["back"].lower()[:6])
    # and nobody texts you about that game again
    assert not any(x[1] == "game_you_win" for x in talk.topics(sim, friend.id))


def test_their_news_gossip_and_a_party_are_things_to_text_about():
    sim, me, friend = _setup()
    w = sim.w
    _event(sim, "tryout", "made", [friend.id], data={"group": "Guilford Soccer"})
    a, b = [c for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, friend.id)][:2]
    w.ensure_rel(me.id, a.id, w.day).familiarity = 40
    _event(sim, "falling_out", "friends", [a.id], [b.id])
    party = _event(sim, "party", "thrown", [a.id], [me.id, friend.id], {"n": 2})
    _event(sim, "party", "kiss", [friend.id], [b.id])
    kinds = {x[1]: x for x in talk.topics(sim, friend.id)}
    assert kinds["their_made"][2]["team"] == "Guilford Soccer"
    assert kinds["gossip"][2] == {"a": a.first, "b": b.first, "gossip": "aren't talking anymore"}
    assert kinds["party"][2]["host"] == a.first and "kissing" in kinds["party"][2]["what"]
    assert party["id"]


def test_a_congrats_once_per_award_and_mom_doesnt_text_fifteen_times():
    sim, me, friend = _setup()
    w = sim.w
    sent = []
    for i in range(6):
        n = talk.note_award(w, "SCC Player of the Week")
        sent.append(talk.award_congrats(sim, friend.id, "SCC Player of the Week"))
        w.day += 7
    assert sent[0] == "award" and "award" not in sent[1:]
    assert all(x in (None, "award_again") for x in sent[1:])
    assert n == 6


def test_someone_you_turned_down_stops_flirting_and_checks_youre_good():
    sim, me, friend = _setup()
    w = sim.w
    ev = _event(sim, "ask_out", "no", [friend.id], [me.id])
    messages.on_event(sim, ev)
    assert talk.quiet_flirting(w, friend.id)
    assert talk.topics(sim, friend.id)[0][1] == "awkward_after_no"
    w.day += talk.TURNED_DOWN_QUIET + 1
    assert not talk.quiet_flirting(w, friend.id)


def test_everyone_texts_like_themselves():
    sim, me, friend = _setup()
    w = sim.w
    other = next(c for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, friend.id))
    s1, s2 = talk.style(sim, friend.id), talk.style(sim, other.id)
    assert s1 == talk.style(sim, friend.id)  # (always the same)
    line = "lol that was so fun today"
    assert talk.styled(sim, friend.id, line, "a").count(s1["laugh"]) >= 1
    assert talk.your_name(sim, friend.id) in (me.first, me.first.lower(), "bro", "dude", (me.last or "").lower(), me.first[:1].lower())
    assert messages.voice(sim, friend.id, "Exactly As Written.", "x", kind="scene") == "Exactly As Written."
    assert s2  # (a style for everyone)


def test_tapbacks_leave_on_read_pins_and_waiting_on_you():
    from fastapi.testclient import TestClient

    from lifeos import api
    from lifeos.storage import Store
    sim, me, friend = _setup()
    w = sim.w
    b = talk.build(sim, friend.id, "quiz", {"subject": "Biology", "when": "tomorrow"}, "q")
    m = messages.post(sim, f"dm:{friend.id}", friend.id, b["text"], kind="talk", ctx={"talk": "quiz"}, replies=b["opts"])
    rows = {t["id"]: t for t in messages.threads_view(sim)}
    wt = rows[f"dm:{friend.id}"]["waiting"]
    assert wt and wt["id"] == m["id"] and len(wt["replies"]) == 4 and wt["tones"][0] == "helpful"
    before = w.rels[(friend.id, me.id)].affection
    messages.tapback(sim, f"dm:{friend.id}", m["id"], "😂")
    assert m["tap"] == "😂" and m["chosen"] == -3 and w.rels[(friend.id, me.id)].affection > before
    assert messages.threads_view(sim)[0]["waiting"] is None or all(t["id"] != f"dm:{friend.id}" or not t["waiting"] for t in messages.threads_view(sim))
    m2 = messages.post(sim, f"dm:{friend.id}", friend.id, "you around?", kind="chatter_plans", replies=[{"label": "yeah", "fx": "warm"}])
    messages.leave_on_read(sim, f"dm:{friend.id}", m2["id"])
    assert m2["chosen"] == -4
    with pytest.raises(ValueError):
        messages.leave_on_read(sim, f"dm:{friend.id}", m2["id"])
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    api.lab.replace_world(w)
    cl = TestClient(api.app)
    r = cl.post(f"/api/phone/thread/dm:{friend.id}/pin", json={"on": True}).json()
    assert next(t for t in r["threads"] if t["id"] == f"dm:{friend.id}")["pinned"] == 0
    m3 = messages.post(api.lab.sim, f"dm:{friend.id}", friend.id, "did you see that", kind="chatter_game")
    assert cl.post(f"/api/phone/thread/dm:{friend.id}/tap", json={"msg": m3["id"], "emoji": "❤️"}).json()["thread"]["msgs"][-1]["tap"] == "❤️"
    assert cl.post(f"/api/phone/thread/dm:{friend.id}/tap", json={"msg": m3["id"], "emoji": "🍕"}).status_code == 409


def test_not_texting_never_costs_anything():
    sim, me, friend = _setup()
    w = sim.w
    r = w.rels[(friend.id, me.id)]
    a0, p0 = r.affection, r.perceived
    # an invite you never answer just expires
    w.meta.setdefault("inbox", []).append({"id": "i1", "from": friend.id, "day": w.day - 3, "status": "pending", "action": "hang_out"})
    sim.step()
    assert next(i for i in w.meta["inbox"] if i["id"] == "i1")["status"] == "expired"
    # a text you leave on read, and a "can't today" to an invite
    m = messages.post(sim, f"dm:{friend.id}", friend.id, "you around?", kind="chatter_plans", replies=[{"label": "yeah", "fx": "warm"}])
    messages.leave_on_read(sim, f"dm:{friend.id}", m["id"])
    w.meta["inbox"].append({"id": "i2", "from": friend.id, "day": w.day, "status": "pending", "action": "hang_out"})
    m2 = messages.post(sim, f"dm:{friend.id}", friend.id, "food later?", kind="invite", ctx={"invite": "i2"},
                       replies=[{"label": "i'm in", "fx": "invite:i2:yes"}, {"label": "can't today, sorry", "fx": "invite:i2:no"}])
    messages.reply(sim, f"dm:{friend.id}", m2["id"], 1)
    assert r.affection >= a0 - 0.01 and r.perceived >= p0 - 0.01


def test_rumors_crushes_dances_big_games_and_teachers_are_things_to_text_about():
    from lifeos import calendar as calm
    from lifeos import classes, social
    sim, me, friend = _setup()
    w = sim.w
    others = [c for c in sorted(w.students(), key=lambda c: c.id) if c.id not in (me.id, friend.id) and c.grade == me.grade]
    b = others[0]
    social.make_rumor(sim, me.id, "rejected", f"{me.name} asked {b.name} out and got shut down", True, -0.25, 0.6, None, [friend.id], None,
                      involves=[me.id, b.id])
    social.make_rumor(sim, me.id, "dating", f"{me.name} and {b.name} are together now", True, 0.1, 0.6, None, [friend.id], None)
    crush = others[1]
    w.ensure_rel(friend.id, crush.id, w.day).attraction = 75
    w.calendar.append({"day": w.day + 4, "kind": "dance", "name": "Homecoming Dance", "key": "dance:homecoming:0", "slot": "night"})
    kinds = {x[1]: x for x in talk.topics(sim, friend.id)}
    assert kinds["rumor_you"][2]["rumor"] == f"you asked {b.first} out and got shut down"  # (news, in first names; not who you're dating)
    assert kinds["crush_advice"][2]["crush"] == crush.first
    assert kinds["dance_soon"][2]["dance"] == "Homecoming Dance"
    # a teacher's name keeps its capital in anyone's style
    t = classes.schedule(sim, me)[0]["teacher"]
    assert t in talk.styled(sim, friend.id, f"{t} gave us a pop quiz", "s")  # ("omg Mr. Duarte...", never "mr. duarte")
    assert calm  # (imported for the calendar)
