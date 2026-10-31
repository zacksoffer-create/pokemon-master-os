"""Your phone: texts, group chats and contacts, written from what actually happens in the world.

Nothing here is scripted. Texts come from events (a good hangout, a cut list, a win, a forgotten
chore), from invitations and moments (which you can answer by text), and from friends who just
want to talk. Each sender has a voice that comes from their personality. Replies have real effects
on the relationship, and you can text people first. People can leave you on read.

Storage: w.meta["phone"] = {"threads": {tid: thread}, "contacts": [...], "pending": [...], "next": n,
"texted": {cid: day}, "parent_trust": 0-100}.
"""
from __future__ import annotations

import json
import os
import re
import zlib

from . import calendar as calm
from .history import Effects
from .rng import clamp

_DATA = os.path.join(os.path.dirname(__file__), "..", "data", "texts.json")
_T = None
PHASE_TIME = {"dawn": (7, 0, 50), "classes": (10, 0, 200), "lunch": (12, 0, 40), "after_school": (15, 30, 150), "day": (11, 0, 300),
              "evening": (19, 0, 180), "night": (22, 0, 60)}
ABBR = [(r"\byou\b", "u"), (r"\bare\b", "r"), (r"\btonight\b", "tn"), (r"\btomorrow\b", "tmrw"), (r"\bthough\b", "tho"),
        (r"\bbecause\b", "bc"), (r"\bplease\b", "pls"), (r"\bpeople\b", "ppl")]
ADULT_F = set("""Linda Mary Patricia Jennifer Elizabeth Barbara Susan Jessica Sarah Karen Lisa Nancy Betty Sandra Margaret Ashley Kimberly
Emily Donna Michelle Carol Amanda Melissa Deborah Stephanie Dorothy Rebecca Sharon Laura Cynthia Amy Kathleen Angela Shannon Anna Brenda
Pamela Emma Nicole Helen Samantha Katherine Christine Debra Rachel Carolyn Janet Maria Catherine Heather Diane Olivia Julie Joyce Victoria
Kelly Christina Lauren Joan Evelyn Judith Andrea Hannah Megan Cheryl Jacqueline Martha Gloria Teresa Ann Sara Madison Frances Kathryn
Janice Jean Abigail Alice Judy Sophia Grace Denise Amber Doris Marilyn Danielle Beverly Isabella Theresa Diana Natalie Brittany Charlotte
Marie Kayla Alexis Lori Tina Dana Wendy Erin Colleen Kristen Tracy Molly Gina Allison Jill Holly Kristin Courtney Monica Renee Rose
Carrie Robin Leslie Joanne Kate Liz Beth Sue Patty Kathy Debbie Jenny Steph Jo Annie Meg Missy""".split())
ADULT_M = set("""James Robert John Michael David William Richard Joseph Thomas Charles Christopher Daniel Matthew Anthony Mark Donald Steven
Paul Andrew Joshua Kenneth Kevin Brian George Timothy Ronald Edward Jason Jeffrey Ryan Jacob Gary Nicholas Eric Jonathan Stephen Larry
Justin Scott Brandon Benjamin Samuel Gregory Alexander Frank Patrick Raymond Jack Dennis Jerry Tyler Aaron Jose Adam Nathan Henry Douglas
Zachary Peter Kyle Ethan Walter Noah Jeremy Christian Keith Roger Terry Gerald Harold Sean Austin Carl Arthur Lawrence Dylan Jesse Jordan
Bryan Billy Joe Bruce Gabriel Logan Albert Willie Alan Juan Wayne Elijah Randy Roy Vincent Ralph Eugene Russell Bobby Mason Philip Louis
Rob Bob Bobby Mike Mikey Dave Bill Rich Rick Joe Tom Tommy Chris Dan Danny Matt Tony Steve Andy Josh Ken Greg Tim Ron Ed Jeff Jim Jimmy
Pete Doug Phil Al Ray Dennis Frank Hank Chuck Marty Gene Stan Fred Ted Ben Sam Nick Pat Jon""".split())
EMOJI_TEEN = ["😂", "💀", "😭", "🔥", "👀", "😅", "🙃", "🤝", "😤", "✨"]
EMOJI_WARM = ["❤️", "😊", "🥹", "💛"]
EMOJI_BY_KIND = {"team_win": ["🔥", "💪", "🐻"], "team": ["🔥", "💪"], "after_good": ["😊", "🙌"], "after_good_date": ["😊", "🥹"],
                 "congrats_team": ["🔥", "🎉"], "congrats_award": ["🏆", "🔥"], "chatter_partner": ["❤️", "😊"], "flirt_in": ["👀", "😊"],
                 "react_funny": ["💀", "😭"], "react_warm": ["😊"], "park_followup": ["🐶"], "sibling_home": ["🎉"], "chatter": ["😅", "😂"]}


def T() -> dict:
    global _T
    if _T is None:
        with open(_DATA, encoding="utf-8") as f:
            _T = json.load(f)
    return _T


def _h(*parts) -> int:
    return zlib.crc32(":".join(str(p) for p in parts).encode())


def phone(w) -> dict:
    ph = w.meta.setdefault("phone", {})
    ph.setdefault("threads", {})
    ph.setdefault("contacts", [])
    ph.setdefault("pending", [])
    ph.setdefault("next", 1)
    ph.setdefault("texted", {})
    ph.setdefault("parent_trust", 60.0)
    return ph


def prot(w):
    p = w.meta.get("protagonist")
    return w.chars.get(p) if p else None


# --- who's who ---------------------------------------------------------------------------------

def parent_names(sim) -> list:
    """The guardians aren't characters. On your phone they're Mom / Dad when their names say so."""
    w = sim.w
    me = prot(w)
    h = w.households.get(me.household_id) if me else None
    if not h:
        return []
    fem = set(sim.cat.people["names"]["female"]) | ADULT_F
    male = set(sim.cat.people["names"]["male"]) | ADULT_M
    out = []
    for i, g in enumerate(h["guardians"]):
        first = g.split()[0]
        label = "Mom" if first in fem else "Dad" if first in male else first
        out.append({"id": f"parent{i}", "name": label, "full": g, "first": first})
    labels = [p["name"] for p in out]
    if len(labels) == 2 and labels[0] == labels[1]:
        for p in out:
            p["name"] = p["first"]
    return out


def sender_name(sim, sid) -> str:
    w = sim.w
    if sid == "me":
        return "You"
    if sid.startswith("parent"):
        return next((p["name"] for p in parent_names(sim) if p["id"] == sid), "Parent")
    c = w.chars.get(sid)
    return c.first if c else sid


def add_contact(sim, cid, why=None):
    w = sim.w
    ph = phone(w)
    me = prot(w)
    if not me or cid == me.id or cid in ph["contacts"] or cid not in w.chars:
        return False
    ph["contacts"].append(cid)
    return True


def seed_contacts(sim):
    """Family, teammates and anyone you're already close to start in your phone."""
    w = sim.w
    me = prot(w)
    if not me or phone(w).get("seeded"):
        return
    for s in sim.siblings(me.id):
        add_contact(sim, s)
    for oid, r in w.out.get(me.id, {}).items():
        if r.familiarity >= 30 or r.affection >= 40:
            add_contact(sim, oid)
    phone(w)["seeded"] = True


# --- threads ----------------------------------------------------------------------------------

def thread(sim, tid, title=None, members=None, kind="dm"):
    ph = phone(sim.w)
    t = ph["threads"].get(tid)
    if t is None:
        t = {"id": tid, "kind": kind, "title": title, "members": members or [], "msgs": [], "unread": 0, "last": 0}
        ph["threads"][tid] = t
    return t


def dm(sim, cid):
    return thread(sim, f"dm:{cid}", members=[cid], kind="dm")


def family_thread(sim):
    w = sim.w
    me = prot(w)
    h = w.households.get(me.household_id) if me else None
    members = [p["id"] for p in parent_names(sim)] + (sim.siblings(me.id) if me else [])
    t = thread(sim, "family", title=f"The {h['last'] if h else ''}s".strip() if h else "Family", members=members, kind="group")
    t["members"] = members
    return t


def time_label(day, phase, salt) -> str:
    hh, mm, spread = PHASE_TIME.get(phase, (12, 0, 60))
    total = hh * 60 + mm + _h(day, salt) % max(1, spread)
    h24, m = divmod(total, 60)
    h24 %= 24
    ampm = "AM" if h24 < 12 else "PM"
    h12 = h24 % 12 or 12
    return f"{h12}:{m:02d} {ampm}"


def voice(sim, sid, text, salt, kind="text") -> str:
    """Make a line sound like the person sending it."""
    w = sim.w
    if sid == "me" or sid.startswith("parent"):
        return text
    c = w.chars.get(sid)
    if not c:
        return text
    if c.role == "staff":
        return text[0].upper() + text[1:] if text else text
    t = c.traits
    r = _h(salt, "voice") % 1000 / 1000
    out = text
    casual = (t["sociability"] + t["impulsivity"]) / 2 + (50 - t["discipline"]) * 0.3
    if casual > 45 or r < 0.5:
        out = out[0].lower() + out[1:] if out[:1].isupper() and not out[:2].isupper() else out
        out = out.rstrip(".")
    if casual > 60 and r < 0.6:
        for pat, rep in ABBR:
            out = re.sub(pat, rep, out)
    if t["sociability"] > 70 and out.endswith("!") and r < 0.5:
        out += "!"
    pool = EMOJI_BY_KIND.get(kind)
    emoji_p = (t["sociability"] + t["impulsivity"]) / 400
    if pool and (r * 7) % 1 < emoji_p and not out.endswith("?") and not any(e in out for e in EMOJI_TEEN + EMOJI_WARM):
        out += " " + pool[_h(salt, "e") % len(pool)]
    return out


def pick(key, salt, **kw) -> str:
    pool = T().get(key) or [key]
    s = pool[_h(salt, key) % len(pool)]
    return _fill(s, kw)


def _fill(s, kw):
    def rep(m):
        k = m.group(1)
        return str(kw.get(k, m.group(0)))
    return re.sub(r"\{(\w+)\}", rep, s)


def post(sim, tid, sid, text, kind="text", replies=None, ctx=None, phase=None, unread=True, title=None, members=None, tkind=None):
    w = sim.w
    ph = phone(w)
    if tid.startswith("dm:"):
        t = dm(sim, tid[3:])
    elif tid == "family":
        t = family_thread(sim)
    else:
        t = thread(sim, tid, title=title, members=members, kind=tkind or "group")
    mid = f"m{ph['next']}"
    ph["next"] += 1
    phase = phase or sim.current_phase()
    msg = {"id": mid, "from": sid, "text": voice(sim, sid, text, mid, kind), "day": w.day, "phase": phase,
           "at": time_label(w.day, phase, mid), "kind": kind, "replies": replies, "chosen": None, "ctx": ctx or {}}
    t["msgs"].append(msg)
    if len(t["msgs"]) > 150:
        t["msgs"] = t["msgs"][-150:]
    if unread and sid != "me":
        t["unread"] += 1
    t["last"] = ph["next"]
    if sid not in ("me",) and not sid.startswith("parent") and sid in w.chars:
        add_contact(sim, sid)
    return msg


def later(sim, cid, key, delay_phases=2, **kw):
    """Queue a text to arrive later today (after the moment has passed)."""
    w = sim.w
    phone(w)["pending"].append({"due": w.day * 10 + min(9, w.phase + delay_phases), "from": cid, "key": key, "kw": kw})


def family_text(sim, key, sender=None, **kw):
    w = sim.w
    me = prot(w)
    if not me or me.location == "away" and key.startswith("pet_"):
        return
    parents = parent_names(sim)
    if sender is None:
        if not parents:
            return
        sender = parents[_h(w.day, key) % len(parents)]["id"]
    kw.setdefault("me", me.first)
    if key == "pet_you_forgot" and kw.get("parent_style") in ("strict", "overbearing"):
        key = "pet_you_forgot_strict"
    replies = None
    if key in ("pet_you_forgot", "pet_you_forgot_strict"):
        replies = [{"label": "on it, sorry!", "fx": "parent_ok"}, {"label": "i was busy 🙄", "fx": "parent_annoyed"}]
        phone(w)["parent_trust"] = clamp(phone(w)["parent_trust"] - 2, 0, 100)
    elif key in ("parent_made_team", "parent_award", "parent_offer", "parent_win", "parent_report_proud", "pet_streak", "parent_drafted"):
        replies = [{"label": "love you guys ❤️", "fx": "parent_ok"}, {"label": "thanks!", "fx": "parent_ok"}]
    elif key in ("parent_report_worried", "parent_grounded"):
        replies = [{"label": "ok. i know", "fx": "parent_ok"}, {"label": "this is so unfair", "fx": "parent_annoyed"}]
    return post(sim, "family", sender, pick(key, f"{w.day}:{key}:{sender}", **kw), kind=key, replies=replies)


# --- events become texts -----------------------------------------------------------------------

def on_event(sim, ev):
    """Called for every finished event. Cheap unless it touches your life."""
    w = sim.w
    p = w.meta.get("protagonist")
    if not p or "phone" not in w.meta:
        return
    actors, targets = ev.get("actors") or [], ev.get("targets") or []
    et = ev["type"]
    out = ev.get("outcome")
    mine = p in actors or p in targets or p in (ev.get("involved") or [])
    if not mine:
        if et == "game" and ev.get("group") in w.chars[p].memberships:
            mine = True
        else:
            return
    me = w.chars[p]
    salt = f"{ev.get('id')}:{et}"
    other = next((x for x in actors + targets if x != p and x in w.chars), None)
    if other and et.startswith("interact.") and out not in ("declined", "busy", "invited"):
        if et in ("interact.hang_out", "interact.date", "interact.sit_with", "interact.chat", "interact.family", "interact.help"):
            add_contact(sim, other)
    if et in ("interact.hang_out", "interact.date") and other and out not in ("declined", "busy", "invited"):
        q = (ev.get("data") or {}).get("quality")
        r = w.rels.get((other, p))
        if r is None:
            return
        good = (q is None and out in ("good", "great")) or (q is not None and q >= 0.55) or out in ("great", "good")
        if good and r.affection >= 25 and _h(salt, "after") % 100 < 45 + w.chars[other].traits["sociability"] * 0.3:
            later(sim, other, "after_good_date" if et == "interact.date" else "after_good", replies="warm")
        elif (out in ("awkward", "bad") or (q is not None and q < 0.3)) and _h(salt, "awk") % 3 == 0:
            later(sim, other, "after_awkward", replies="awkward")
    elif et in ("interact.confront", "interact.tease", "interact.prank", "spread_rumor") and p in targets and other:
        friend = best_friend(sim, exclude=other)
        if friend and _h(salt, "uok") % 2 == 0:
            later(sim, friend, "u_ok", other=w.chars[other].first, replies="support")
    elif et == "interact.apologize" and p in targets and other:
        later(sim, other, "they_apologize", delay_phases=1, replies="apology")
    elif et in ("tryout", "audition") and p in actors and out in ("made", "lead", "cut"):
        team = (ev.get("data") or {}).get("group") or "the team"
        if out in ("made", "lead"):
            family_text(sim, "parent_made_team", team=team)
            f = best_friend(sim)
            if f:
                later(sim, f, "congrats_team", delay_phases=1, team=team, replies="thanks")
        else:
            family_text(sim, "parent_cut", team=team)
            f = best_friend(sim)
            if f:
                later(sim, f, "consolation_cut", delay_phases=1, replies="support")
    elif et == "game" and out in ("win", "loss"):
        d = ev.get("data") or {}
        g = w.groups.get(ev.get("group"))
        if g and p in g["members"]:
            mates = sorted([m for m in g["members"] if m != p and m in w.chars], key=lambda m: -w.chars[m].traits["sociability"])
            if mates:
                s = mates[_h(salt, "mate") % min(3, len(mates))]
                post(sim, f"team:{g['id']}", s, pick(f"team_{out}", salt, opp=d.get("opponent", "them")), kind="team",
                     title=g["name"], members=[m for m in g["members"] if m != p], tkind="group", phase="night")
            if _h(salt, "par") % 3 != 0:
                family_text(sim, f"parent_{out}")
    elif et == "award" and p in actors:
        label = (ev.get("data") or {}).get("label", "the award")
        family_text(sim, "parent_award", event=label)
        f = best_friend(sim)
        if f:
            later(sim, f, "congrats_award", delay_phases=1, event=label, replies="thanks")
    elif et == "recruiting" and out == "offer" and p in actors:
        family_text(sim, "parent_offer", college=(ev.get("data") or {}).get("label", "a college"))
    elif et == "draft" and out == "drafted" and p in actors:
        family_text(sim, "parent_drafted", team=(ev.get("data") or {}).get("label", "them"))
    elif et == "household" and p in actors:
        if out == "proud":
            family_text(sim, "parent_report_proud")
        elif out in ("pressure",):
            family_text(sim, "parent_report_worried")
        elif out == "grounded":
            family_text(sim, "parent_grounded")
    elif et == "rumor_reached" and p in actors:
        f = best_friend(sim)
        if f:
            later(sim, f, "rumor", delay_phases=1, replies="rumor")
    elif et == "path" and out == "home" and actors and actors[0] in sim.siblings(p):
        post(sim, f"dm:{actors[0]}", actors[0], pick("sibling_home", salt), kind="sibling", replies=_replies("sibling", salt))
    elif et == "path" and out == "left" and actors and actors[0] in sim.siblings(p):
        later(sim, actors[0], "sibling_leaving", delay_phases=1, replies="sibling")


def best_friend(sim, exclude=None):
    w = sim.w
    p = w.meta.get("protagonist")
    cands = [(r.affection, o) for o, r in w.out.get(p, {}).items() if o != exclude and o in w.chars and w.chars[o].status == "active"
             and w.chars[o].role in ("student", "alumni") and o not in sim.siblings(p) and r.affection >= 35]
    return max(cands)[1] if cands else None


def tick(sim):
    """Deliver queued texts whose time has come, and maybe a little chatter. Called after each phase."""
    w = sim.w
    ph = w.meta.get("phone")
    if not ph or not w.meta.get("protagonist"):
        return
    now = w.day * 10 + w.phase
    due = [x for x in ph["pending"] if x["due"] <= now]
    if not due:
        return
    ph["pending"] = [x for x in ph["pending"] if x["due"] > now]
    for x in due:
        cid = x["from"]
        if cid == "family":
            family_text(sim, x["key"], **x["kw"])
            continue
        if cid not in w.chars or w.chars[cid].status != "active":
            continue
        kw = dict(x["kw"])
        rk = kw.pop("replies", None)
        salt = f"{w.day}:{x['key']}:{cid}"
        post(sim, f"dm:{cid}", cid, pick(x["key"], salt, me=w.chars[w.meta["protagonist"]].first, **kw), kind=x["key"],
             replies=_replies(rk, salt) if rk else _replies("generic", salt))


def daily(sim):
    """Morning: friends who are thinking about you might text. A pet chore reminder now and then."""
    w = sim.w
    me = prot(w)
    if not me or "phone" not in w.meta:
        return
    rng_base = _h(w.day, "chatter")
    partner = me.flags.get("partner")
    sent = 0
    if partner in w.chars and rng_base % 100 < 30:
        later(sim, partner, "chatter_partner", delay_phases=4 + rng_base % 3, replies="partner")
        sent += 1
    friends = sorted([(r.affection, o) for o, r in w.out.get(me.id, {}).items()
                      if o in w.chars and w.chars[o].status == "active" and w.chars[o].role in ("student", "alumni")
                      and r.affection >= 45 and r.familiarity >= 35 and o != partner and o not in sim.siblings(me.id)], reverse=True)[:6]
    for aff, o in friends:
        if sent >= 2:
            break
        back = w.rels.get((o, me.id))
        p = 0.05 + (back.affection if back else 0) / 900 + w.chars[o].traits["sociability"] / 1500
        if (_h(w.day, o, "c") % 1000) / 1000 < p:
            crush = back is not None and back.attraction >= 45 and not me.flags.get("partner") and not w.chars[o].flags.get("partner")
            later(sim, o, "flirt_in" if crush and _h(w.day, o) % 3 == 0 else "chatter", delay_phases=2 + _h(o, w.day) % 5,
                  replies="flirt" if crush else "chatter")
            sent += 1
    sibs = [s for s in sim.siblings(me.id) if w.chars[s].status == "active"]
    if sibs and rng_base % 100 < 8:
        s = sibs[rng_base % len(sibs)]
        later(sim, s, "sibling_chatter", delay_phases=3, replies="sibling")
    # chores reminder (once in a while, if it's yours today and not done)
    from . import pets
    for pet in pets.household_pets(w, me.household_id or ""):
        if pets.setup_needed(w, pet["id"]):
            continue
        for d in pets.SPECIES[pet["species"]]["duties"]:
            if pets.due_today(d, w.day) and pets.owner_today(sim, pet, d) == me.id and _h(w.day, pet["id"], d) % 20 == 0:
                phone(w)["pending"].append({"due": w.day * 10 + 5, "from": "family", "key": "pet_reminder",
                                            "kw": {"pet": pet["name"], "chore": pets.DUTIES[d]["noun"], "chore_a": pets.DUTIES[d]["a"]}})
                break


def pregame(sim):
    """The night before your games, the team chat lights up."""
    w = sim.w
    me = prot(w)
    if not me:
        return
    tomorrow = w.day + 1
    for it in w.calendar:
        if it["day"] == tomorrow and it["kind"] == "game" and it.get("group") in me.memberships:
            g = w.groups[it["group"]]
            mates = sorted([m for m in g["members"] if m != me.id and m in w.chars], key=lambda m: -w.chars[m].traits["sociability"])
            if mates:
                from .sports import opponent_name
                n = int(it["key"].split(":")[-1]) if it["key"].split(":")[-1].isdigit() else 1
                s = mates[_h(w.day, g["id"]) % min(2, len(mates))]
                post(sim, f"team:{g['id']}", s, pick("team_pregame", f"{w.day}:{g['id']}", opp=opponent_name(sim, g, n)), kind="team",
                     title=g["name"], members=[m for m in g["members"] if m != me.id], tkind="group", phase="evening")
            if _h(w.day, "pp") % 2 == 0:
                family_text(sim, "parent_pregame")


# --- invitations and moments arrive as texts ----------------------------------------------------

def invite_text(sim, inv):
    w = sim.w
    cid = inv["from"]
    places = [p["name"] for p in sim.cat.world["places"] if p["id"] not in ("house",)]
    place = places[_h(inv["id"]) % len(places)] if places else "the diner"
    key = "invite_date" if inv.get("action") == "date" else "invite"
    post(sim, f"dm:{cid}", cid, pick(key, inv["id"], place=place), kind="invite",
         replies=[{"label": "i'm in", "fx": f"invite:{inv['id']}:yes"}, {"label": "can't today, sorry", "fx": f"invite:{inv['id']}:no"}],
         ctx={"invite": inv["id"]})


def moment_text(sim, m):
    """Some moments are really texts: someone asking you out, asking you to a dance."""
    w = sim.w
    kind = m["kind"]
    other = m["ctx"].get("other")
    if kind not in ("asked_out", "asked_to_dance") or other not in w.chars:
        return
    labels = ["yes!! 😊", "i'm sorry, i don't feel that way"] if kind == "asked_out" else ["yes, let's go", "i can't, sorry"]
    post(sim, f"dm:{other}", other, pick(kind, m["id"], event=m["ctx"].get("event", "the dance")), kind=kind,
         replies=[{"label": labels[0], "fx": f"moment:{m['id']}:0"}, {"label": labels[1], "fx": f"moment:{m['id']}:1"}],
         ctx={"moment": m["id"]})


# --- replying ---------------------------------------------------------------------------------

REPLY_SETS = {
    "warm": [("same!! we need to do it again", "warm"), ("haha yeah it was fun", "warm"), ("👍", "dry")],
    "awkward": [("no we're good! i was just tired", "warm"), ("yeah it was kinda weird", "dry")],
    "support": [("thanks. i'm ok", "warm"), ("honestly it sucked", "vent"), ("whatever, don't care", "dry")],
    "apology": [("it's ok. thanks for saying that", "forgive"), ("i need some time", "dry"), ("whatever", "cold")],
    "thanks": [("thank you!! 🙏", "warm"), ("lol thanks", "warm")],
    "rumor": [("ugh. what are they saying", "vent"), ("don't care honestly", "dry")],
    "chatter": [("lmao yes", "funny"), ("haha i'm down", "warm"), ("can't talk rn", "dry")],
    "partner": [("❤️", "warm"), ("miss you too", "warm"), ("lol goodnight", "dry")],
    "flirt": [("you're not so bad yourself 😏", "flirt"), ("haha thanks", "warm"), ("lol ok", "dry")],
    "sibling": [("lol", "sibling_warm"), ("miss you too", "sibling_warm"), ("go away", "sibling_tease")],
    "generic": [("haha", "warm"), ("ok", "dry")],
}


def _replies(key, salt):
    opts = REPLY_SETS.get(key) or REPLY_SETS["generic"]
    return [{"label": l, "fx": fx} for l, fx in opts]


def reply(sim, tid, mid, index) -> dict:
    """You pick one of the reply options. It has an effect, and they might answer."""
    w = sim.w
    me = prot(w)
    ph = phone(w)
    t = ph["threads"].get(tid)
    if not t:
        raise ValueError("no such conversation")
    msg = next((m for m in t["msgs"] if m["id"] == mid), None)
    if not msg or not msg.get("replies"):
        raise ValueError("that message doesn't need a reply")
    if msg.get("chosen") is not None:
        raise ValueError("you already replied")
    if not 0 <= index < len(msg["replies"]):
        raise ValueError("no such reply")
    opt = msg["replies"][index]
    fx_key = opt["fx"]
    # links to invitations / moments
    if fx_key.startswith("moment:"):
        _, mo, i = fx_key.split(":")
        from . import moments
        mm = next((x for x in w.meta.get("moments", []) if x["id"] == mo), None)
        if not mm or mm["status"] != "pending":
            msg["chosen"] = -1
            raise ValueError("that's already been answered")
    if fx_key.startswith("invite:"):
        _, iid, yn = fx_key.split(":")
        inv = next((i for i in w.meta.get("inbox", []) if i["id"] == iid), None)
        if not inv or inv["status"] != "pending":
            msg["chosen"] = -1
            raise ValueError("that invitation isn't waiting anymore")
    msg["chosen"] = index
    sender = msg["from"]
    mine = post(sim, tid, "me", opt["label"], kind="reply", unread=False)
    answer = None
    ev = sim.new_event("text", fx_key.split(":")[0], [me.id], [sender] if sender in w.chars else [], 6,
                       {"label": opt["label"], "thread": tid})
    ev["text"] = f"You texted {sender_name(sim, sender)}: \"{opt['label']}\""
    fx = Effects(w, ev)
    if fx_key.startswith("moment:"):
        _, mo, i = fx_key.split(":")
        from . import moments
        moments.resolve(sim, mo, int(i))
        answer = "react_flirt_yes" if int(i) == 0 else "react_dry"
    elif fx_key.startswith("invite:"):
        _, iid, yn = fx_key.split(":")
        inv = next(i for i in w.meta.get("inbox", []) if i["id"] == iid)
        if yn == "yes":
            w.meta.setdefault("control", {})["queued"] = {"invite": iid}
            answer = "react_plans_yes"
        else:
            inv["status"] = "declined"
            if sender in w.chars:
                fx.rel(sender, me.id, "perceived", -3, "you said no")
            answer = "react_dry" if _h(mid) % 2 else None
    elif sender.startswith("parent"):
        if fx_key == "parent_ok":
            ph["parent_trust"] = clamp(ph["parent_trust"] + 1.5, 0, 100)
            answer = "react_parent"
        else:
            ph["parent_trust"] = clamp(ph["parent_trust"] - 3, 0, 100)
            answer = "react_parent_annoyed"
    elif sender in w.chars:
        r_them = w.ensure_rel(sender, me.id, w.day)
        if fx_key in ("warm", "thanks", "forgive", "vent"):
            fx.rel(sender, me.id, "affection", 2.0, "texting")
            fx.rel(sender, me.id, "perceived", 2.0, "texting")
            fx.rel(me.id, sender, "familiarity", 1.0, "texting")
            if fx_key == "forgive":
                fx.rel(me.id, sender, "rivalry", -6, "forgave them")
                fx.rel(sender, me.id, "trust", 4, "you forgave them")
            if fx_key == "vent":
                fx.need(me.id, "stress", -4, "venting to a friend")
            answer = "react_warm"
        elif fx_key == "funny":
            fx.rel(sender, me.id, "affection", 2.5, "made them laugh")
            fx.need(me.id, "fun", 3, "texting")
            answer = "react_funny"
        elif fx_key in ("dry", "cold"):
            fx.rel(sender, me.id, "perceived", -2.0 if fx_key == "dry" else -5.0, "a dry text")
            answer = "react_dry" if _h(mid, "dry") % 2 else None
        elif fx_key == "flirt":
            if r_them.attraction >= 35:
                fx.rel(sender, me.id, "attraction", 4, "flirting")
                fx.rel(me.id, sender, "attraction", 3, "flirting")
                answer = "react_flirt_yes"
            else:
                fx.rel(sender, me.id, "perceived", -1, "awkward flirt")
                answer = "react_flirt_no"
        elif fx_key == "sibling_warm":
            fx.rel(sender, me.id, "affection", 2, "texting")
            answer = "react_warm"
        elif fx_key == "sibling_tease":
            fx.rel(sender, me.id, "affection", 0.5, "sibling banter")
            answer = "react_funny"
    sim.finish(ev, fx)
    if answer:
        post(sim, tid, sender, pick(answer, f"{mid}:ans"), kind="react", unread=False)
    t["unread"] = 0
    return {"thread": thread_view(sim, tid)}


# --- texting first ----------------------------------------------------------------------------

def text_options(sim, cid) -> list:
    w = sim.w
    me = prot(w)
    o = w.chars.get(cid)
    if not me or not o:
        return []
    r = w.rels.get((me.id, cid))
    ph = phone(w)
    if ph["texted"].get(cid) == w.day:
        return []
    out = [{"kind": "hey", "label": "Just say hey"}]
    if o.role != "staff":
        out.append({"kind": "hang", "label": "Ask to hang out"})
    if r and (r.attraction >= 30 or r.crush) and o.role != "staff":
        out.append({"kind": "flirt", "label": "Flirt a little"})
    tomorrow_games = {i["group"] for i in w.calendar if i["kind"] == "game" and i["day"] in (w.day, w.day + 1)}
    if any(g in tomorrow_games for g in o.memberships):
        out.append({"kind": "good_luck", "label": "Wish them luck"})
    recent = [a for a in o.achievements if w.day - a["day"] <= 7]
    if recent:
        out.append({"kind": "congrats", "label": f"Congrats on {recent[-1]['label'].lower()}"})
    if r and (r.rivalry >= 25 or r.affection < 0):
        out.append({"kind": "sorry", "label": "Apologize"})
    return out


def text_first(sim, cid, kind) -> dict:
    w = sim.w
    me = prot(w)
    o = w.chars.get(cid)
    if not o:
        raise ValueError("unknown person")
    if cid not in phone(w)["contacts"] and cid not in sim.siblings(me.id):
        raise ValueError(f"You don't have {o.first}'s number yet.")
    if kind not in {x["kind"] for x in text_options(sim, cid)}:
        raise ValueError("you can't send that right now")
    phone(w)["texted"][cid] = w.day
    tid = f"dm:{cid}"
    places = [p["name"] for p in sim.cat.world["places"] if p["id"] not in ("house",)]
    salt = f"{w.day}:{cid}:{kind}"
    post(sim, tid, "me", pick(f"first_{kind}", salt, place=places[_h(salt) % len(places)]), kind="first", unread=False)
    r_them = w.ensure_rel(cid, me.id, w.day)
    r_me = w.ensure_rel(me.id, cid, w.day)
    ev = sim.new_event("text", kind, [me.id], [cid], 8, {"label": kind})
    fx = Effects(w, ev)
    rng = sim.streams.get("text-first", w.day, cid)
    warmth = r_them.affection + o.traits["sociability"] * 0.3 + rng.gauss(0, 12)
    answer, note, plans = None, None, False
    if kind == "hey":
        if warmth > 40:
            answer = "reply_hey"
            fx.rel(cid, me.id, "affection", 1.5, "you texted first")
            fx.rel(cid, me.id, "familiarity", 1.5, "texting")
        elif warmth > 10:
            answer = "reply_hey_dry"
            fx.rel(cid, me.id, "familiarity", 1.0, "texting")
        else:
            note = "read"
    elif kind == "hang":
        free = o.location == me.location and o.status == "active"
        p = clamp((warmth - 10) / 70, 0.02, 0.92) * (1 if free else 0.1) * (0.6 + o.needs.get("energy", 60) / 250)
        if rng.random() < p:
            answer, plans = "react_plans_yes", True
            w.meta.setdefault("control", {})["queued"] = {"action": "hang_out", "target": cid, "agreed": True, "day": w.day}
            fx.rel(cid, me.id, "affection", 1.0, "making plans")
            note = "plans"
        elif warmth > 15:
            answer = "react_plans_no"
        else:
            note = "read"
    elif kind == "flirt":
        if r_them.attraction >= 40:
            answer = "react_flirt_yes"
            fx.rel(cid, me.id, "attraction", 5, "you flirted")
            fx.rel(me.id, cid, "attraction", 3, "flirting")
        elif warmth > 25:
            answer = "react_flirt_no"
            fx.rel(cid, me.id, "perceived", -1, "awkward")
        else:
            note = "read"
            fx.rel(me.id, cid, "perceived", -2, "left on read")
    elif kind in ("good_luck", "congrats"):
        answer = "react_warm"
        fx.rel(cid, me.id, "affection", 2.5, "you thought of them")
        fx.rel(cid, me.id, "perceived", 2, "you thought of them")
    elif kind == "sorry":
        if warmth > -10:
            answer = "react_warm"
            fx.rel(cid, me.id, "rivalry", -8, "you apologized")
            fx.rel(cid, me.id, "trust", 4, "you apologized")
            fx.rel(cid, me.id, "affection", 3, "you apologized")
        else:
            note = "read"
    ev["outcome"] = note or ("replied" if answer else "no reply")
    ev["text"] = f"You texted {o.first}." + (" They're in." if plans else " Left on read." if note == "read" else "")
    sim.finish(ev, fx)
    if answer:
        post(sim, tid, cid, pick(answer, f"{salt}:ans"), kind="react", unread=False)
    t = phone(w)["threads"][tid]
    if note == "read":
        t["msgs"][-1]["read"] = True
    return {"thread": thread_view(sim, tid), "result": note or "replied", "plans": plans}


# --- views ------------------------------------------------------------------------------------

def _reply_open(sim, msg) -> bool:
    w = sim.w
    if not msg.get("replies") or msg.get("chosen") is not None:
        return False
    for r in msg["replies"]:
        if r["fx"].startswith("moment:"):
            mo = r["fx"].split(":")[1]
            mm = next((x for x in w.meta.get("moments", []) if x["id"] == mo), None)
            return bool(mm and mm["status"] == "pending")
        if r["fx"].startswith("invite:"):
            iid = r["fx"].split(":")[1]
            inv = next((i for i in w.meta.get("inbox", []) if i["id"] == iid), None)
            return bool(inv and inv["status"] == "pending")
    return w.day - msg["day"] <= 3


def thread_view(sim, tid, mark_read=False) -> dict:
    w = sim.w
    t = phone(w)["threads"][tid]
    if mark_read:
        t["unread"] = 0
    msgs = []
    for m in t["msgs"][-60:]:
        msgs.append({"id": m["id"], "from": m["from"], "from_name": sender_name(sim, m["from"]), "text": m["text"], "at": m["at"],
                     "day": m["day"], "date": calm.label(m["day"]), "kind": m["kind"], "read": m.get("read", False),
                     "replies": [r["label"] for r in m["replies"]] if _reply_open(sim, m) else None,
                     "chosen": m.get("chosen")})
    return {"id": tid, "kind": t["kind"], "title": thread_title(sim, t), "members": t["members"], "msgs": msgs,
            "can_text": t["kind"] == "dm" and bool(text_options(sim, t["members"][0])) if t["members"] else False,
            "text_options": text_options(sim, t["members"][0]) if t["kind"] == "dm" and t["members"] else []}


def thread_title(sim, t) -> str:
    if t["kind"] == "dm":
        c = sim.w.chars.get(t["members"][0])
        return c.name if c else "Unknown"
    return t.get("title") or "Group"


def threads_view(sim) -> list:
    w = sim.w
    out = []
    for t in phone(w)["threads"].values():
        if not t["msgs"]:
            continue
        last = t["msgs"][-1]
        out.append({"id": t["id"], "kind": t["kind"], "title": thread_title(sim, t), "members": t["members"][:6],
                    "unread": t["unread"], "last": last["text"], "last_from": sender_name(sim, last["from"]), "at": last["at"],
                    "date": calm.label(last["day"]), "order": t["last"],
                    "needs_reply": any(_reply_open(sim, m) for m in t["msgs"][-6:])})
    out.sort(key=lambda x: -x["order"])
    return out
