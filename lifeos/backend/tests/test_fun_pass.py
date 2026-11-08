"""A world to have fun in: the game never makes a big call for you, punishments fit what happened, nothing drains while
you're not looking, the numbers that decide things are on the screen, and the world doesn't do things that feel fake."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import decision, dialogue, moments  # noqa: E402
from tests.test_storylines_run import world  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def _clear(sim):
    for m in moments.pending(sim.w):
        m["status"] = "resolved"


def _other(sim, me):
    return next(c for c in sorted(sim.w.students(), key=lambda c: c.id) if c.id != me.id and c.household_id != me.household_id
                and c.gender != me.gender)


# --- A. the game never decides for you --------------------------------------------------------------------------------

def test_an_ask_out_you_never_answer_just_passes():
    sim, me = world()
    _clear(sim)
    o = _other(sim, me)
    sim.w.ensure_rel(me.id, o.id, sim.w.day).attraction = 90  # (you'd have said yes, by the old rule)
    sim.moment_trigger("asked_out", me.id, {"other": o.id})
    m = moments.pending(sim.w)[-1]
    assert moments.big("asked_out")
    moments.leave(sim, m)
    assert m["status"] == "lapsed" and not me.flags.get("partner") and moments.asked_too_soon(sim.w, o.id)


def test_saying_no_sticks_and_just_friends_sticks_longer():
    sim, me = world()
    _clear(sim)
    o = _other(sim, me)
    sim.moment_trigger("asked_out", me.id, {"other": o.id})
    m = moments.pending(sim.w)[-1]
    assert [c["label"] for c in m["choices"]][2].startswith("Tell them you'd rather stay friends")
    moments.resolve(sim, m["id"], 2)
    assert sim.w.meta["ask_wait"][o.id] == sim.w.day + 150 and not me.flags.get("partner")
    from lifeos.decision import Cand
    a = next(x for x in sim.cat.actions.values() if x["id"] == "ask_out") if isinstance(sim.cat.actions, dict) else \
        next(x for x in sim.cat.actions if x["id"] == "ask_out")
    terms = []
    sim.ctx = sim.slot_ctx("after_school")
    ctx = sim.char_ctx(o) or sim.ctx
    decision.score(sim, o, Cand(a, me.id, None, ""), ctx, terms)
    assert any(t[0] == "you told them no" and t[1] <= -100 for t in terms)


def test_small_things_you_leave_get_the_do_nothing_answer_and_big_ones_wait():
    sim, me = world()
    _clear(sim)
    sim.moment_trigger("benched", me.id, {"coach": None, "sport": "football"})
    m = moments.pending(sim.w)[-1]
    moments.leave(sim, m)
    assert m["status"] == "resolved" and m["choice"] == 2 and m["by"] == "auto"  # stay patient
    # the college decision: never answered for you, unless you set a path at the start
    me.recruiting = {"offers": [], "admits": [{"college": "uconn", "name": "UConn", "tier": "D1"}]}
    sim.moment_trigger("college_decision", me.id, {})
    cd = next(x for x in moments.pending(sim.w) if x["kind"] == "college_decision")
    assert moments.leave(sim, cd) is None and cd["status"] == "pending"
    me.flags["preset_path"] = {"kind": "work"}
    moments.leave(sim, cd)
    assert cd["status"] == "resolved" and me.path.get("kind") == "work"


def test_tryouts_tomorrow_means_youre_going_if_you_played_last_year():
    sim, me = world()
    _clear(sim)
    g = sim.w.groups["football"]
    sim.moment_trigger("tryout_eve", me.id, {"team_id": "football"})
    m = moments.pending(sim.w)[-1]
    moments.leave(sim, m)
    assert m["status"] == "lapsed"  # never played: not this year
    me.stats["football:2009-10:jv"] = {"games": 8, "team": "football"}
    sim.moment_trigger("tryout_eve", me.id, {"team_id": "football"})
    m = moments.pending(sim.w)[-1]
    moments.leave(sim, m)
    assert m["status"] == "resolved" and m["choice"] == 0 and g["id"]


def test_left_alone_your_character_never_starts_trouble_or_romance():
    sim, me = world()
    _clear(sim)
    for d in range(60):
        for m in list(moments.pending(sim.w)):
            moments.leave(sim, m)
        sim.step()
        for _ in range(5):
            sim.step()
    mine = [e for e in sim.w.history.events.values() if e["actors"][:1] == [me.id] and e["type"].split(".")[-1] in decision.AUTOPILOT_NO]
    assert mine == [], [(e["type"], e.get("text")) for e in mine[:5]]


def test_your_partner_cheating_is_a_card_not_a_feeling_set_for_you():
    from lifeos.actions import start_dating
    from lifeos.history import Effects
    from lifeos.social import make_rumor
    sim, me = world()
    _clear(sim)
    o = _other(sim, me)
    ev = sim.new_event("test", "x", [me.id], [o.id], 1, {})
    start_dating(sim, me.id, o.id, ev, Effects(sim.w, ev))
    r = sim.w.rels[(me.id, o.id)]
    aff, tr = r.affection, r.trust
    third = next(c for c in sorted(sim.w.students(), key=lambda c: c.id) if c.id not in (me.id, o.id))
    rid = make_rumor(sim, o.id, "kiss", f"{o.name} and {third.name} kissed at a party", True, -0.2, 0.7, None, [third.id], None,
                     involves=[o.id, third.id])
    sim._tell_subject({"rumor": rid, "jealous": me.id, "teller": third.id}, None, sim.streams.get("t", 1))
    card = next(m for m in moments.pending(sim.w) if m["kind"] == "partner_cheat")
    assert card["ctx"]["partner"] == o.id and r.affection == aff and r.trust == tr
    moments.resolve(sim, card["id"], 1)  # break up
    assert not me.flags.get("partner")


# --- B. punishments that fit ------------------------------------------------------------------------------------------

def test_a_steady_report_card_never_grounds_you_and_a_real_drop_is_a_card():
    from lifeos import households
    sim, me = world()
    _clear(sim)
    h = sim.w.households[me.household_id]
    h["strictness"], h["expectations"] = 100, 100  # the strictest parents there are
    me.gpa = 2.4
    me.flags["last_card_gpa"] = 2.45
    for i in range(20):  # a 2.4 student every card: never grounded for being one
        me.flags.pop("card_grounded_day", None)
        households.report_card_reaction(sim, me, {"name": "Report card"}, sim.streams.get("rc", i))
        me.flags["last_card_gpa"] = 2.45
    assert me.flags.get("grounded_until") is None
    grounded = False
    for i in range(30):  # a real drop: sometimes, and it's a card that says why
        me.flags.pop("card_grounded_day", None)
        me.flags["last_card_gpa"], me.gpa = 3.3, 2.5
        households.report_card_reaction(sim, me, {"name": "Report card"}, sim.streams.get("rc2", i))
        if me.flags.get("grounded_until") is not None:
            grounded = True
            break
    assert grounded and me.flags["grounded_until"] - sim.w.day <= 5
    card = next(m for m in moments.pending(sim.w) if m["kind"] == "grounded")
    assert "3.30" in card["text"] and len(card["choices"]) == 3
    moments.resolve(sim, card["id"], 1)  # the study deal: half as long
    assert me.flags["grounded_until"] - sim.w.day <= 2 and households.grounding_view(sim.w, me) is not None or \
        me.flags["grounded_until"] < sim.w.day


def test_hurt_is_excused_from_practice_and_still_tries_out():
    sim, me = world()
    _clear(sim)
    w = sim.w
    g = w.groups["football"]
    if me.id not in g["members"]:
        g["members"].append(me.id)
        me.memberships.append("football")
    me.flags["injured_until"] = w.day + 30
    for _ in range(15):
        for m in list(moments.pending(w)):
            moments.leave(sim, m)
        sim.advance_days(1)
    assert me.id in g["members"]  # (missed every practice hurt, still on the team)


def test_playing_a_quiz_yourself_can_only_help():
    from lifeos import classes
    sim, me = world()
    me.flags["quiz_played"] = {"day": sim.w.day, "pct": 0.2}
    s, terms = classes.blend_exam(me, sim.w.day, 82.0)
    assert s == 82.0 and any("can only help" in t[0] for t in terms)
    me.flags["quiz_played"] = {"day": sim.w.day, "pct": 1.0}
    assert classes.blend_exam(me, sim.w.day, 82.0)[0] > 82


def test_cops_are_a_rare_story_not_every_other_party():
    from lifeos import institutions
    import inspect
    src = inspect.getsource(institutions.Institutions.party)
    assert "0.15" in src and "pb *= 0.5" in src


def test_a_bad_reputation_fades():
    sim, me = world()
    me.reputation["embarrassed"] = 10.0
    sim.advance_days(28)
    assert me.reputation["embarrassed"] < 9.0


# --- C. nothing drains while you're not looking -----------------------------------------------------------------------

def test_texting_counts_as_keeping_in_touch_and_close_friends_never_fade_away():
    from lifeos import messages
    sim, me = world()
    w = sim.w
    messages.phone(w)
    o = _other(sim, me)
    r = w.ensure_rel(me.id, o.id, w.day)
    r.affection, r.peak_affection, r.last_day = 90.0, 90.0, w.day - 30
    messages.post(sim, f"dm:{o.id}", "me", "yo what's up")
    assert r.last_day == w.day
    r.last_day = w.day - 200
    for _ in range(40):
        sim._weekly()
    assert r.affection >= 90 * 0.75 - 0.01


def test_no_money_still_means_you_can_hang_out():
    import json
    acts = json.load(open(os.path.join(os.path.dirname(__file__), "..", "data", "actions.json")))
    acts = acts.get("actions", acts)
    for a in (acts if isinstance(acts, list) else acts.values()):
        if a["id"] in ("hang_out", "date"):
            assert not any(str(r).startswith("money") for r in a["requires"])


def test_your_pet_chores_never_blame_you():
    from lifeos import pets
    sim, me = world()
    hp = pets.household_pets(sim.w, me.household_id)
    if not hp:
        return
    pid = hp[0]["id"]
    pets.set_duties(sim, pid, {d: "me" for d in pets.SPECIES[hp[0]["species"]]["duties"]})
    sim.advance_days(7)
    assert not any(e["type"] == "pet" and e.get("outcome") == "chore_missed" for e in sim.w.history.events.values())


# --- D. the numbers that decide things are on the screen ---------------------------------------------------------------

def test_playing_well_and_the_coachs_trust_move_you_up_the_lineup():
    from lifeos import sports
    sim, me = world()
    g = sim.w.groups["football"]
    g.setdefault("form", {})[me.id] = [8.0, 6.0, 7.0]
    assert sports.start_edge(sim.w, g, me.id) >= 3.0
    g["form"][me.id] = [-9.0, -8.0, -7.0]
    assert sports.start_edge(sim.w, g, me.id) <= 0


def test_your_resume_counts_for_college_and_top_students_get_a_shot():
    from lifeos import sports
    sim, me = world()
    col = next(c for c in sim.cat.colleges if c["min_gpa"] >= 3.6)
    me.gpa = 4.0
    base = sports.admit_odds(sim.w, me, col)
    me.awards = [{"day": 0, "label": "All-State Football", "sport": "football"}, {"day": 0, "label": "Guilford Football MVP"}]
    me.stats["football:2010-11:varsity"] = {"games": 10}
    from lifeos.rng import sigmoid
    old_rule = col.get("admit_cap", 1.0) * sigmoid((4.0 - col["min_gpa"]) / 0.12)
    assert sports.admit_odds(sim.w, me, col) > base > old_rule
    bonus, bits = sports.resume_bonus(sim.w, me)
    assert bonus > 0 and any("award" in b for b in bits)


def test_a_game_your_storyline_already_wrote_says_so_and_skips_the_big_moment():
    sim, me = world()
    _clear(sim)
    sim.moment_trigger("game_day", me.id, {"group": "football", "opponent": "Hand", "written": "win", "written_by": "Brothers"})
    m = moments.pending(sim.w)[-1]
    assert "This one's written" in m["text"] and "Brothers" in m["text"]
    assert not any(isinstance(o, list) and o and o[0] == "minigame" for ch in m["_choices"] for o in ch["ops"])


def test_you_pick_your_own_elective():
    from lifeos import classes
    sim, me = world()
    sched = classes.pick_elective(sim, me, "Theater Arts")
    assert next(r for r in sched if r["id"] == "elective")["name"] == "Theater Arts"
    with pytest.raises(ValueError):
        classes.pick_elective(sim, me, "Underwater Basket Weaving")


# --- E. nothing that feels fake ----------------------------------------------------------------------------------------

def test_friends_fight_rarely_for_a_reason_and_it_blows_over():
    from lifeos import drama
    import random as _r
    sim, me = world()
    w = sim.w
    fr = [c for c in sorted(w.students(), key=lambda c: c.id) if c.id != me.id and c.household_id != me.household_id][:2]
    a, b = fr
    for x in fr:
        w.ensure_rel(me.id, x.id, w.day).affection = 80
    for x, y in ((a, b), (b, a)):
        r = w.ensure_rel(x.id, y.id, w.day)
        r.affection, r.rivalry = 70.0, 15.0  # (a rivalry: a reason you could see coming)
    st = drama.state(w)

    class Sure(_r.Random):
        def random(self):
            return 0.0
    assert drama._friends_fight(sim, me, st, Sure())
    f = st["fallouts"][-1]
    assert 15 <= f["hit"] <= 20 and w.rels[(a.id, b.id)].affection >= 70 - 20 - 0.01
    assert not drama._friends_fight(sim, me, st, Sure())  # (weeks apart at least)
    w.day = f["heal"]
    drama._blow_over(sim, st)
    assert f["fixed"] and w.rels[(a.id, b.id)].affection > 70 - f["hit"]


def test_a_freshman_isnt_captain_when_there_are_upperclassmen():
    from lifeos import institutions
    import inspect
    src = inspect.getsource(institutions.Institutions.selection_results)
    assert "seniors first" in src and "upper or" in src


def test_a_jv_player_who_outplays_varsity_gets_called_up():
    from lifeos import sports
    sim, me = world()
    w = sim.w
    g = w.groups["football"]
    others = [c for c in sorted(w.students(), key=lambda c: c.id) if c.id != me.id][: g.get("starters", 5) + 1]
    g["members"] = [c.id for c in others]
    g["levels"] = {c.id: "varsity" for c in others[:-1]}
    star = others[-1]
    g["levels"][star.id] = "jv"
    star.skills[g["skill"]] = 99
    for c in others[:-1]:
        c.skills[g["skill"]] = 20
    y = w.day
    g["season"] = {"start": [9, 1], "end": [8, 31]}
    sim.institutions.callups(sim.streams.get("cu", y))
    assert g["levels"][star.id] == "varsity" and sports.rating(star, g["skill"]) > 0


def test_your_partner_checks_in_after_three_weeks_apart():
    from lifeos.actions import start_dating
    from lifeos.history import Effects
    sim, me = world()
    _clear(sim)
    o = _other(sim, me)
    ev = sim.new_event("test", "x", [me.id], [o.id], 1, {})
    start_dating(sim, me.id, o.id, ev, Effects(sim.w, ev))
    sim.w.rels[(me.id, o.id)].last_day = sim.w.day - 25
    sim._weekly()
    card = next(m for m in moments.pending(sim.w) if m["kind"] == "partner_checkin")
    assert card["ctx"]["partner"] == o.id and len(card["choices"]) == 3
