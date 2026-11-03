"""Writing more story, the way it's meant to go: ask ChatGPT for a storyline or an expansion of one, paste it back, read it
in the order it plays (with what won't and why), and keep adding. Holidays and school days land on their real dates,
scenes can be set in a class, walk-ons can talk, a storyline can bring "my sister's friend" with it, and the engine
stays fast with thousands of scenes."""
import datetime as dt
import os
import sys
import time

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import dialogue, moments, scheduler, script  # noqa: E402
from lifeos.engine import Simulation  # noqa: E402
from lifeos.story import begin, create_story  # noqa: E402
from tests.test_scheduler import BROTHER, TWINS  # noqa: E402
from tests.test_story import spec  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def _story():
    sim = Simulation(create_story(spec(per=6, siblings=[BROTHER] + TWINS)))
    begin(sim)
    for m in moments.pending(sim.w):
        moments.resolve(sim, m["id"], 0)
    return sim


def _played(sim, days=365):
    scheduler.dry_run(sim, days, None, full=False)
    return {r["title"]: r for r in scheduler.rows(sim)}


SISTERS = """=== Sisters
order: any
cast: sis = older sister, close, from the start
cast: kayla = friend of sis, girl

--- Turkey day  [freshman · Thanksgiving]
mom: Somebody set the table.
sis: Not it.
* Set it | family affection +
* Hide in your room | mood +

--- Kayla's over  [freshman · winter break · weekend]
kayla: So you're the little brother.
* Make her laugh | vibe funny
    good: She cracks up. | remember kayla_laughed
    meh: A polite smile.
    bad: Silence. | mood -
* Shrug

--- Lab partners  [freshman · in biology · October]
{teacher}: Pair up. This is {class}, not a nap.
* Raise your hand

--- Big game  [freshman · Super Bowl]
sis: Who are we even rooting for?
* The commercials

--- Mother's Day  [freshman · Mother's Day]
sis: Did you get her anything?
* "Uh."
"""


def test_named_days_land_on_their_real_dates():
    cal = {"events": [], "breaks": []}
    import json
    cal = json.load(open(os.path.join(os.path.dirname(dialogue.__file__), "..", "data", "world.json")))["calendar"]
    on = lambda name, y: [str(calm.date_of(d)) for d in range(calm.day_of(dt.date(y, 1, 1)), calm.day_of(dt.date(y, 12, 31)))  # noqa: E731
                          if name in calm.named_days(d, cal)]
    assert on("thanksgiving", 2010) == ["2010-11-25"] and on("thanksgiving", 2011) == ["2011-11-24"]
    assert on("super_bowl", 2011) == ["2011-02-06"] and on("super_bowl", 2012) == ["2012-02-05"], "the real Super Bowl Sundays"
    assert on("easter", 2011) == ["2011-04-24"] and on("mothers_day", 2011) == ["2011-05-08"]
    assert on("first_day_of_school", 2010) == ["2010-09-01"]
    assert len(on("finals_week", 2011)) == 12 and "2011-10-18" in on("homecoming", 2011)


def test_holidays_classes_walkons_and_a_friend_of_your_sister_all_play():
    r = dialogue.add_script(SISTERS)
    assert r["ok"], r["errors"]
    sim = _story()
    rows = _played(sim)
    when = {t: rows[t].get("date") for t in ("Turkey day", "Kayla's over", "Lab partners", "Big game", "Mother's Day")}
    assert when == {"Turkey day": "Thu, Nov 25, 2010", "Kayla's over": "Sat, Dec 25, 2010", "Lab partners": when["Lab partners"],
                    "Big game": "Sun, Feb 6, 2011", "Mother's Day": "Sun, May 8, 2011"}, when
    assert when["Lab partners"] and "Oct" in when["Lab partners"]
    w = sim.w
    sis, kayla = w.meta["cast_slots"]["sis"]["id"], w.meta["cast_slots"]["kayla"]["id"]
    assert kayla not in sim.siblings(w.meta["protagonist"]) and w.chars[kayla].gender == "f"
    assert dialogue._rel(w, sis, kayla, "affection") >= 50, "the storyline says they're friends: now they are"
    turkey = next(m for m in w.meta["moments"] if m["kind"] == "sisters_turkey_day")
    assert turkey["text"].startswith("Mom: Somebody set the table."), "a walk-on talks (mom: is Mom)"
    lab = next(m for m in w.meta["moments"] if m["kind"] == "sisters_lab_partners")
    assert "Biology" in lab["text"] and ("Mr." in lab["text"] or "Ms." in lab["text"] or "Mrs." in lab["text"] or "Dr." in lab["text"])


def test_what_the_checker_says_about_the_new_words():
    bad = script.compile_script("=== X\n\n--- A  [freshman]\nbest friend: hi\n* ok | mom affection +\n")
    assert "doesn't keep track" in bad["errors"][0]["text"]
    bad = script.compile_script("=== X\n\n--- A  [freshman]\nbest friend: hi | mood +\n* ok\n")
    assert "not on the scene's opening lines" in bad["errors"][0]["text"]
    bad = script.compile_script("=== X\n\n--- A  [freshman · in basket weaving]\nbest friend: hi\n* ok\n")
    assert bad["errors"]
    bad = script.compile_script("=== X\n\n--- A  [freshman]\nbest friend: hi\n* go | 60% +courage\n    yes: ok\n    no: no\n")
    assert any("Traits:" in e["text"] and "confidence" in e["text"] for e in bad["errors"]), bad["errors"]
    ok = script.compile_script("=== X\ncast: sis = older sister\n\n--- A  [freshman · prom week · after Thanksgiving]\nsis: hi\n"
                               "* ok\n    sis: Fine. | sis respect +\n")
    assert not ok["errors"], ok["errors"]
    sc = ok["packs"][0]["scenes"][0]
    assert sc["when"]["dates"] == ["prom_week"] and sc["when"]["not_before"] == "11-25"
    assert ["rel_back", "them", "respect", 3] in sc["choices"][0]["ops"], "a line under a choice can carry effects"
    vibe = script.compile_script("=== X\ncast: sis = older sister\n\n--- A  [freshman]\nsis: hi\n* joke | vibe funny\n"
                                 "    good: Ha. | sis affection +\n    meh: Hm.\n    bad: No. | mood -\n")
    assert not vibe["errors"], vibe["errors"]
    op = vibe["packs"][0]["scenes"][0]["choices"][0]["ops"][0]
    assert op[0] == "vibe" and op[3] == {"good": [["rel_back", "them", "affection", 3]], "bad": [["mood", -3]]}, op


def test_a_scene_with_one_choice_plays():
    assert dialogue.add_script("=== One\n\n--- Just one  [freshman · October · always]\nbest friend: Come on.\n* Go\n")["ok"]
    rows = _played(_story(), 80)
    assert rows["Just one"]["state"] == "played", rows["Just one"]


EXPANSION = """Here you go!
```
=== Sisters: Summers
expands: Sisters
order: any

--- Beach day  [freshman · July · after Turkey day · often]
sis: You're carrying the cooler.
kayla: And the chairs.
* Fine | sis affection +
* "Absolutely not."
```"""


def test_an_expansion_adds_to_a_storyline_in_its_own_piece():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    assert dialogue.add_script(SISTERS)["ok"]
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6, siblings=[BROTHER] + TWINS)}).status_code == 200
    p = c.get("/api/story/add/expand", params={"pack": "yours:sisters", "ask": "summers at the beach", "size": "few"}).json()
    for must in ("summers at the beach", "=== Sisters: <a short name", "expands: Sisters", "`sis`", "`kayla`", "--- Turkey day",
                 "kayla_laughed", "4 to 6 scenes", "# LIFE OS story scripts"):
        assert must in p["prompt"], must
    pv = c.post("/api/story/add/preview", json={"text": EXPANSION}).json()
    assert pv["ok"] and [x["title"] for x in pv["new"]] == ["Beach day"] and pv["new"][0]["state"] == "played", pv
    r = c.post("/api/dialogue/packs", json={"text": EXPANSION})
    assert r.status_code == 200 and r.json()["ids"] == ["yours:sisters_summers"]
    rows = {x["id"]: x for x in c.get("/api/dialogue/packs").json()["packs"]}
    assert rows["yours:sisters_summers"]["expands"] == "Sisters" and {x["name"] for x in rows["yours:sisters_summers"]["cast"]} == {"sis", "kayla"}
    assert "expands: Sisters" in dialogue.script_of("yours:sisters_summers") and "Beach day" not in dialogue.script_of("yours:sisters")
    beach = dialogue.merged()["moments"]["sisters_summers_beach_day"]["scene"]["when"]
    assert beach["after"] == ["sisters_turkey_day"], "after <a scene in the storyline it expands>"
    p2 = c.get("/api/story/add/expand", params={"pack": "yours:sisters_summers"}).json()
    assert p2["title"] == "Sisters" and p2["expansions"] == ["Sisters: Summers"] and "=== Sisters: Summers\n--- Beach day" in p2["prompt"]
    # the storyline's cast changes: the expansion follows
    src = dialogue.script_of("yours:sisters").replace("older sister, close", "older sister, plays soccer, close")
    assert dialogue.add_script(src, into="yours:sisters")["ok"]
    exp = next(x for x in dialogue.packs() if x["id"] == "yours:sisters_summers")
    assert exp["pack"]["cast"]["sis"]["sport"] == "soccer"
    # an expansion of something that isn't there says so
    bad = c.post("/api/dialogue/check", json={"text": "=== Nope: More\nexpands: Nope\n\n--- A  [freshman]\nbest friend: hi\n* ok\n"}).json()
    assert not bad["ok"] and "no storyline called 'Nope'" in bad["errors"][0]
    # a new storyline and its expansion in one paste
    both = "=== Brothers\ncast: bro = older brother\n\n--- Hoops  [freshman · fall]\nbro: Ball.\n* Play\n\n" \
           "=== Brothers: Road trip\nexpands: Brothers\n\n--- The van  [sophomore · summer]\nbro: Shotgun.\n* Fine\n"
    r = c.post("/api/dialogue/packs", json={"text": both}).json()
    assert r["ids"] == ["yours:brothers", "yours:brothers_road_trip"]


def test_read_a_storyline_the_way_it_plays():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    assert dialogue.add_script(SISTERS + "\n--- Never  [freshman · if some_fact_nobody_remembers]\nsis: Hm.\n* ok\n")["ok"]
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6, siblings=[BROTHER] + TWINS)}).status_code == 200
    assert c.post("/api/dialogue/packs", json={"text": EXPANSION}).status_code == 200
    r = c.get("/api/story/storyline/read", params={"pack": "yours:sisters_summers"}).json()
    assert r["title"] == "Sisters" and [p["name"] for p in r["parts"]] == ["Sisters", "Sisters: Summers"]
    played = [x for x in r["scenes"] if x["plays"]]
    assert [x["day"] for x in played] == sorted(x["day"] for x in played), "in the order they play"
    assert played[0]["year"] == "Freshman" and played[0]["src"].startswith("--- ")
    assert r["total"] == 7 and r["plays"] == 6
    assert r["wont"] == [{"why": "it needs a choice you didn't make", "count": 1, "titles": ["Never"]}]
    assert sum(y["total"] for y in r["coverage"]["years"]) == 6


def test_a_chapter_whose_day_is_gone_lets_the_storyline_move_on():
    from lifeos.catalogs import Catalogs
    sim = _story()
    sim.advance_days(3)  # the first day of school has gone by
    assert dialogue.add_script("=== Late\ncast: sis = older sister\n\n--- First day  [freshman · first day of school]\nsis: Bye.\n* Bye\n\n"
                               "--- Next  [freshman · October]\nsis: Hey.\n* Hey\n")["ok"]
    sim.cat = Catalogs(sim.w.action_overrides)  # (what the app does when a script comes in)
    rows = _played(sim, 120)
    assert rows["First day"]["state"] != "played" and rows["Next"]["state"] == "played", rows["Next"]


def test_thousands_of_scenes_stay_fast(monkeypatch):
    import random
    rng = random.Random(3)
    years = ["freshman", "sophomore", "junior", "senior"]
    months = ["September", "October", "November", "December", "January", "February", "March", "April", "May"]
    parts = []
    for i in range(30):
        L = [f"=== Bulk {i}", "order: any", ""]
        for k in range(40):
            L += [f"--- Scene {k}  [{rng.choice(years)} · {rng.choice(months)} · sometimes]", "best friend: Hey.", "* Hey | mood +", "* Nah", ""]
        parts.append("\n".join(L))
    t = time.time()
    assert dialogue.add_script("\n".join(parts))["ok"]
    assert time.time() - t < 20
    assert len(dialogue.merged()["moments"]) >= 1200  # (opened once: compiled, and the compiles kept)
    assert len(os.listdir(os.path.join(dialogue.USER_DIR, ".compiled"))) == 30
    calls = []
    real = script.compile_script
    monkeypatch.setattr(script, "compile_script", lambda *a, **k: calls.append(1) or real(*a, **k))
    dialogue._file_cache.clear()
    dialogue.reload()
    assert len(dialogue.merged()["moments"]) >= 1200
    assert not calls, "opening the library uses the kept compiles: nothing is compiled again"
    sim = _story()
    t = time.time()
    scheduler.dry_run(sim, 365, None, full=False)
    assert time.time() - t < 20, "a year with 1,200 scenes"


def test_a_storyline_can_name_the_people_in_your_world():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6, siblings=[BROTHER] + TWINS)}).status_code == 200
    p = c.get("/api/story/add/prompt").json()["prompt"]
    assert "Danny Kim: my best friend" in p and "Ally Soffer: sister" in p and "cast: ally = Ally Soffer" in p
    assert c.post("/api/dialogue/packs", json={"text": """=== Danny and Ally
cast: danny = Danny Kim
cast: ally = Ally, close
cast: ghost = Nobody Here

--- Study hall  [freshman · October]
danny: You're sitting with me, right?
* "Obviously." | danny affection +

--- Ally's car  [freshman · November]
ally: Get in.
* Get in | ally trust +

--- Never  [freshman · November]
ghost: Boo.
* Run
"""}).status_code == 200
    r = c.get("/api/story/storyline/read", params={"pack": "yours:danny_and_ally"}).json()
    assert r["plays"] == 2 and r["wont"][0]["titles"] == ["Never"] and "Nobody Here" in [x for x in r["scenes"] if not x["plays"]][0]["detail"]
    w = api.lab.w
    slots = c.get("/api/dialogue/cast", params={"pack": "yours:danny_and_ally"}).json()["slots"]
    assert {s["slot"]: [o["name"] for o in s["options"]] for s in slots} == {"danny": ["Danny Kim"], "ally": ["Ally Soffer"], "ghost": []}
    # the same name in another storyline is the same person
    assert dialogue.add_script("=== More Danny\ncast: danny = Danny Kim\n\n--- Lunch  [freshman · December]\ndanny: Fries?\n* Yes\n")["ok"]
    assert dialogue.merged()["cast"]["danny"]["packs"] == ["yours:danny_and_ally", "yours:more_danny"]
    assert script.cast_line("ally", script.cast_spec("Ally Soffer, close")) == "cast: ally = Ally Soffer, close"
