"""Texting that goes back and forth: type anything, tap a suggestion, and flirting that says why."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import chat, messages  # noqa: E402
from tests.test_phone import story  # noqa: E402


def _setup(att, fam, aff):
    w, sim = story(pet=False)
    me = w.chars[w.meta["protagonist"]]
    sim.advance_days(2)
    g = next(c.id for c in w.students() if c.gender == "f" and "m" in c.attracted_to and not c.flags.get("partner") and not c.custom)
    messages.add_contact(sim, g)
    r = w.ensure_rel(g, me.id, w.day)
    r.familiarity, r.affection, r.attraction = fam, aff, att
    w.ensure_rel(me.id, g, w.day).familiarity = fam
    return w, sim, me, g


def test_reading_what_you_type():
    cases = {"hey!": "greet", "what are you up to?": "ask", "ok": "dry", "you're cute 😏": "flirt", "i miss you": "flirt",
             "wanna get food this weekend?": "plans", "sorry about earlier": "apology", "shut up loser": "rude", "gtg night!": "bye",
             "you killed it today": "compliment", "you ok? you seemed off": "support", "will you go out with me": "ask_out",
             "i just finished the math homework and it was brutal": "chat", "i'm convinced the cafeteria pizza is plastic lol": "joke"}
    for text, intent in cases.items():
        assert chat.classify(text)["intent"] == intent, (text, chat.classify(text))
    assert chat.classify("i miss you")["flirt"] == 2 and chat.classify("you're cute 😏")["flirt"] == 1
    assert not chat.classify("you're cute")["question"] and chat.classify("did you do the hw")["question"]


def test_a_conversation_goes_back_and_forth_until_they_wrap_it_up():
    w, sim, me, g = _setup(30, 50, 40)
    t = lambda: messages.phone(w)["threads"][f"dm:{g}"]  # noqa: E731
    sent = 0
    while chat.view(sim, g)["status"] != "done" and sent < 15:
        sug = chat.suggestions(sim, g)
        assert sug and all(s["text"] and s["tone"] for s in sug)
        pick = next((i for i, s in enumerate(sug) if s["intent"] in ("ask", "answer", "joke")), 0)
        chat.send(sim, g, None, pick)
        sent += 1
    assert 3 <= sent <= 12, sent
    theirs = [m for m in t()["msgs"] if m["from"] == g]
    assert len(theirs) >= sent and theirs[-1]["kind"] in ("chat_close", "chat_close_cold")
    # they're done for now: a text gets left on read, and a note says so
    chat.send(sim, g, "helloooo?")
    assert t()["msgs"][-2]["read"] and t()["msgs"][-1]["kind"] == "note"
    assert chat.suggestions(sim, g) == []
    # texting can't be farmed: a day's texting moves affection only so far
    assert messages.phone(w)["chat_gain"][g]["affection"] <= chat.CAP["affection"]


def test_flirting_lands_when_the_signs_are_there_and_says_why():
    w, sim, me, g = _setup(55, 55, 40)
    assert chat.read(sim, g)["label"] == "Seems into you"
    before = w.rels[(g, me.id)].attraction
    chat.send(sim, g, "hey")
    res = chat.send(sim, g, "ok you're kinda cute when you're annoyed 😏")
    assert res["result"] == "flirt_landed" and res["why"].startswith("Landed: ")
    assert w.rels[(g, me.id)].attraction > before
    assert any(m["kind"] == "note" and m["text"] == res["why"] for m in messages.phone(w)["threads"][f"dm:{g}"]["msgs"])
    assert any(s["text"].startswith("Flirted back") for s in chat.signals(sim, g))
    assert chat.stage(sim, g) == 3, "you flirted and they flirted back: flirty"


def test_flirting_with_someone_who_barely_knows_you_tells_you_to_talk_first():
    w, sim, me, g = _setup(10, 12, 2)
    assert chat.read(sim, g)["label"] == "Too early to tell" and chat.stage(sim, g) == 0
    res = chat.send(sim, g, "you're cute 😏")
    assert res["result"] in ("flirt_awkward", "flirt_shut")
    assert "barely know you" in res["why"] and "Talk and hang out first." in res["why"]
    assert "Get to know them first" in chat.tip(sim, g)


def test_typing_yes_to_an_invite_answers_it():
    w, sim, me, g = _setup(20, 50, 45)
    inv = {"id": "inv_t", "from": g, "to": me.id, "action": "hang_out", "status": "pending", "day": w.day, "event": None}
    w.meta.setdefault("inbox", []).append(inv)
    messages.post(sim, f"dm:{g}", g, "wanna hang after school?", replies=[{"label": "yes!", "fx": "invite:inv_t:yes"},
                                                                         {"label": "can't today", "fx": "invite:inv_t:no"}],
                  ctx={"invite": "inv_t"})
    chat.send(sim, g, "yeah i'm down")
    assert w.meta["control"]["queued"] == {"invite": "inv_t"}
    assert messages.phone(w)["threads"][f"dm:{g}"]["msgs"][-2]["text"] == "yeah i'm down"


def test_flirting_choices_say_how_risky_they_are():
    from lifeos import planner
    w, sim, me, g = _setup(55, 55, 40)
    opts = [{"index": 0, "action": "flirt", "target": g, "category": "romance"}, {"index": 1, "action": "ask_out", "target": g, "category": "romance"}]
    out = {o["action"]: o for o in planner.annotate(sim, me, opts)}
    assert out["flirt"]["group"] == "want" and out["flirt"]["reason"] == "Seems into you"
    assert out["ask_out"]["reason"].startswith("Risky"), "they haven't flirted back yet"
    r = w.rels[(g, me.id)]
    r.attraction = 5
    out = {o["action"]: o for o in planner.annotate(sim, me, opts)}
    assert out["flirt"]["reason"] == "Risky: just friends vibes"


def test_the_phone_routes():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    w, sim, me, g = _setup(40, 50, 35)
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    api.lab.replace_world(w)
    c = TestClient(api.app)
    th = c.get(f"/api/phone/thread/dm:{g}").json()
    assert th["chat"]["can_type"] and th["chat"]["suggestions"]
    r = c.post(f"/api/phone/thread/dm:{g}/say", json={"text": "heyyy what are you doing"})
    assert r.status_code == 200 and r.json()["thread"]["msgs"][-1]["from"] in (g, "note")
    r = c.post(f"/api/phone/thread/dm:{g}/say", json={"suggestion": 0})
    assert r.status_code == 200
    v = c.get(f"/api/phone/contact/{g}").json()["vibe"]
    assert v["stages"][0] == "Strangers" and v["read"] and v["tip"] and isinstance(v["signals"], list)
    assert len(c.get("/api/phone/flirting").json()["guide"]) >= 5
    assert c.post(f"/api/phone/thread/dm:{g}/say", json={"text": "   "}).status_code == 409
