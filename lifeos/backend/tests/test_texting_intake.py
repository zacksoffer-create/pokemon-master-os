"""Adding your own texting: flirt lines and group chats in plain blocks, written by ChatGPT (or you), pasted in, fixed
rather than refused, and live right away."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import chat, dialogue, groupchat, messages, script, scriptfix  # noqa: E402
from tests.test_chat import _setup  # noqa: E402
from tests.test_story import spec  # noqa: E402

SAMPLE = """Here you go!
```
flirt tease:
  you're lucky you're funny bc that hat was a choice
  ok who gave you permission to be this {cute|annoying}
flirt bold later:
  i'm taking you to the diner friday. that's the plan
flirt answers tease, lands:
  oh you think you're so smooth
flirt follow-ups sweet after a laugh:
  ok fine. for real tho i like this
flirt first:
  you were the best part of chem today
flirt back letdown:
  haha you're the best but i think we're better as friends
flirt payoff plans:
  ok diner friday. you're buying fries

group chat crew, weekend:
  A: fantasy draft is tonight. who's in
  B: i'm taking the jets defense first
  C: why would you do that
  B: because i believe
  * {B} you're gonna finish last | A +, B -, fun +
      A: LMAO
      B: watch me
      dm B: ok be honest is the jets thing bad
  * i'm in. i'm winning the whole thing | A +, crew +
      C: we'll see about that
```"""


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def test_flirt_blocks_go_where_flirting_looks_for_them():
    assert script.flirt_path("tease") == ["banter", "open", "early", "tease"]
    assert script.flirt_path("bold later") == ["banter", "open", "close", "bold"]
    assert script.flirt_path("answers bold, laughs") == ["banter", "them", "bold", "playful"]
    assert script.flirt_path("follow-ups cool") == ["banter", "back", "landed", "cool"]
    assert script.flirt_path("follow-ups sweet after a laugh") == ["banter", "back", "playful", "sweet"]
    assert script.flirt_path("first later") == ["banter", "in", "close"]
    assert script.flirt_path("back let them down easy") == ["banter", "in_back", "letdown"]
    assert script.flirt_path("payoff good night") == ["banter", "payoff", "goodnight"]
    with pytest.raises(script.Fail):
        script.flirt_path("answers tease, maybe")
    r = script.compile_script(script.extract(SAMPLE))
    assert not r["errors"], r["errors"]
    ch = r["packs"][0]["chat"]["banter"]
    assert ch["open"]["early"]["tease"][1:] == ["ok who gave you permission to be this cute", "ok who gave you permission to be this annoying"]
    assert ch["payoff"]["plans"] == ["ok diner friday. you're buying fries"]


def test_a_group_chat_block_is_a_conversation_with_replies_effects_and_a_dm():
    r = script.compile_script(script.extract(SAMPLE))
    b = r["packs"][0]["groupchat"][0]
    assert b["chat"] == "crew" and b["when"] == ["weekend"] and len(b["lines"]) == 4 and b["lines"][0] == ["A", "fantasy draft is tonight. who's in"]
    first = b["you"][0]
    assert first["say"] == "{B} you're gonna finish last" and first["then"] == [["A", "LMAO"], ["B", "watch me"]]
    assert first["fx"] == {"A": {"affection": 1.5}, "B": {"affection": -1.0}, "me": {"fun": 1.5}}
    assert first["dm"] == {"from": "B", "text": "ok be honest is the jets thing bad"}
    assert b["you"][1]["fx"] == {"A": {"affection": 1.5}, "crew": {"cohesion": 1.5}}
    fam = script.compile_script("group chat family, pet:\n  mom: who fed {pet}\n  sibling: not me\n  * i did | trust +\n      mom: thank you\n")
    assert not fam["errors"] and fam["packs"][0]["groupchat"][0]["lines"][0][0] == "P"


def test_what_chatgpt_gets_wrong_in_texting_is_fixed_not_refused():
    bad = """flirt teese:
  you wish
flirt answers bold, maybe:
  hm
group chat crew, weekend, full moon:
  A: yo
  D: who's D
  B: sup
  * hey | A +, vibes +
      A: hey
"""
    fx = scriptfix.repair(bad, library={})
    assert fx["ok"], fx["result"]["errors"]
    notes = " | ".join(n["text"] for n in fx["notes"])
    assert "flirt tease:" in fx["text"], fx["text"]
    pk = fx["result"]["packs"][0]
    assert pk["chat"]["banter"]["open"]["early"]["tease"] == ["you wish"]
    assert pk.get("groupchat") and pk["groupchat"][0]["lines"] == [["A", "yo"], ["B", "sup"]], notes


def test_add_texting_through_the_phone_and_it_plays():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6)}).status_code == 200
    p = c.get("/api/texting/prompt", params={"what": "both", "ask": "sarcastic flirting, the boys roasting each other", "size": "few"}).json()
    for must in ("sarcastic flirting", "Zack", "flirt answers <style>, <how it went>:", "group chat <crew|team|family>", "{A}", "2 group chats"):
        assert must in p["prompt"], must
    assert c.get("/api/texting/prompt", params={"what": "flirt"}).json()["prompt"].count("group chat") == 0
    ck = c.post("/api/texting/check", json={"text": SAMPLE}).json()
    assert ck["breakdown"]["flirt_total"] == 9 and len(ck["breakdown"]["group_chats"]) == 1, ck  # ({cute|annoying} is two)
    assert {f["label"] for f in ck["breakdown"]["flirt"]} >= {"flirt openers", "payoffs", "them flirting first"}
    assert not dialogue.packs(), "checking doesn't add anything"
    assert c.post("/api/texting/check", json={"text": "just words"}).status_code == 422
    r = c.post("/api/texting/add", json={"text": SAMPLE}).json()
    assert r["ok"] and r["pack"]
    row = next(x for x in r["packs"] if x["id"] == r["pack"])
    assert row["texting"] == {"flirt": 9, "group_chats": 1, "lines": 0}
    assert "you were the best part of chem today" in chat.D()["banter"]["in"]["early"]
    assert any(b["id"].startswith("pk_") for b in groupchat.D()["bursts"])
    # it plays: the pasted group chat starts up and your answer lands, with the DM after
    sim = api.lab.sim
    w = sim.w
    me = w.chars[w.meta["protagonist"]]
    friends = [x.id for x in w.students() if x.id != me.id and x.household_id != me.household_id][:3]
    w.meta["squad"] = {"ids": friends, "cohesion": 50.0, "formed": w.day, "updated": w.day + 400, "last_you": None, "jokes": [], "name": "the boys"}
    mine = [b for b in groupchat.D()["bursts"] if b["id"].startswith("pk_")]
    groupchat._DATA, saved = {"bursts": []}, groupchat._DATA
    try:
        assert groupchat.start(sim, "crew", {"weekend"})
    finally:
        groupchat._DATA = saved
    t = messages.phone(w)["threads"]["squad"]
    last = t["msgs"][-1]
    assert last["text"] == "because i believe" and len(last["replies"]) == 2 and mine
    cast = list(t["bursts"].values())[-1]["cast"]
    assert last["replies"][0]["label"] == f"{w.chars[cast['B']].first} you're gonna finish last"
    messages.reply(sim, "squad", last["id"], 0)
    assert any(x["key"] == "chat_side" and x["from"] == cast["B"] for x in messages.phone(w)["pending"])
