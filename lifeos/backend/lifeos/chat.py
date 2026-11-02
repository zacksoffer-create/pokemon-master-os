"""Texting that goes back and forth: type anything, or tap a suggestion, and they answer like themselves.

What you type is read for what you're doing (saying hi, asking something, joking, complimenting, flirting, making
plans, checking on them, apologizing, being dry or rude, saying bye) and how much effort it shows. It doesn't
understand every word the way a person would.

A conversation has energy. How much depends on how much they like you, how social they are, whether they're into
you, and how stressed they are. Every message uses a little; good ones give some back; dry or rude ones drain it.
When it runs out they wrap it up ("gtg, ttyl"), and texting again right away doesn't help.

Flirting runs on five things, and every flirt tells you which ones decided it:
  closeness  how well they know you and like you as a person
  interest   whether they're into you (the signals on their contact page tell you)
  moment     their mood, their stress, how the conversation's been going
  pace       one step at a time: talking, joking around, flirting, then asking out
  you        your confidence and charm, and putting a little effort in
"""
from __future__ import annotations

import re

from .history import Effects
from .rng import clamp

STAGES = ["Strangers", "Know each other", "Friendly", "Flirty", "Talking stage", "Dating"]
GUIDE = [
    {"t": "They have to know you a little", "d": "Flirting with someone who barely knows you is a gamble. Say hi, talk, hang out first."},
    {"t": "Watch the signals", "d": "Do they text you first, ask about you, laugh at your jokes, flirt back? Their contact page keeps track."},
    {"t": "One step at a time", "d": "Talking, then joking around, then a light flirt, then asking out. Skipping steps is where it gets awkward."},
    {"t": "Read the room", "d": "Stressed, in a bad mood, or the conversation's gone dry? Not now."},
    {"t": "If they go cold, back off", "d": "Short answers, laughing it off, leaving you on read: pushing harder makes it worse."},
    {"t": "Confidence helps, effort counts", "d": "Charm and a real message go a long way. They can't make someone into you who isn't."},
    {"t": "Ask out in person", "d": "Once they're flirting back, ask them out when you see them. Over text they'll tell you to say it to their face."},
]
TONE = {"greet": "👋", "ask": "💬", "answer": "↩", "joke": "😂", "compliment": "✨", "flirt": "😏", "flirt_strong": "😏",
        "plans": "📅", "support": "🤝", "good_luck": "💪", "congrats": "🎉", "apology": "🙏", "love": "❤️", "bye": "👋"}
CAP = {"affection": 6.0, "familiarity": 5.0, "attraction": 8.0}  # most a day of texting one person can move things
_DATA = None


def D() -> dict:
    global _DATA
    if _DATA is None:
        from .catalogs import _base
        _DATA = _base("chat.json")
    return _DATA


# --- reading what you typed --------------------------------------------------------------------

FLIRT_EMOJI = ("😏", "😉", "😘", "🥰", "😍", "😳", "💕", "❤️", "♥", "💘", "😚", "🫣", "👀")
RX = [
    ("rude", r"\b(stfu|shut up|loser|idiot|stupid|ugly|hate you|annoying|f+u+c*k+ (off|you)|dumb(ass)?|weirdo|creep|nobody likes you)\b"),
    ("apology", r"\b(sorry|my bad|apologi[sz]e|i was wrong|forgive me|i messed up)\b"),
    ("ask_out", r"(go out with me|be my (gf|bf|girlfriend|boyfriend)|wanna go out|want to go out|go on a date|like a date|ask(ing)? you out)"),
    ("love", r"\b(love you|love u|ily|ilysm)\b"),
    ("bye", r"^(ok+ |okay |alright |anyway |well )?(gtg|g2g|gotta go|got to go|good ?night|gn|nighty?|bye+|ttyl|talk (to you )?(later|tomorrow|tmrw)|cya|see ya|later)\b"),
    ("plans", r"\b(wanna|want to|down to|u down|you down|hang ?out|hang|come over|get food|grab food|get pizza|movie|tonight\?|this weekend|after school|let'?s go|let'?s|chill (later|tomorrow|this))\b"),
    ("flirt", r"\b(cute|pretty|hot|handsome|beautiful|gorgeous|miss (you|u)|thinking (about|of) (you|u)|crush|kiss|babe|flirt|you look good|u look good|your smile|ur smile|your eyes|ur eyes|like you|like u|into you|into u)\b"),
    ("support", r"\b(you ok|u ok|you good\?|u good\?|are you okay|here for you|here if you|that sucks|feel better|hope you'?re ok|how are you holding up|wanna talk)\b"),
    ("compliment", r"\b(nice|great job|good job|congrats|congratulations|you killed it|killed it|amazing|awesome|so good|proud of you|smart|funny|talented|clutch|you'?re the best|ur the best)\b"),
    ("greet", r"^(hey+|hi+|hello|yo+|sup|wassup|what'?s up|whats good|heyo|howdy)\b"),
]
STRONG = r"\b(miss (you|u)|thinking (about|of) (you|u)|kiss|i like you|i like u|into you|into u|babe|love)\b"
DRY = r"^(k|kk|ok|okay|cool|sure|whatever|idk|fine|lol|ya|yeah|ye|yep|mhm|nm|nothing|ok lol|lol ok|same)[.!]*$"
JOKE = r"(\blol\b|\blmao\b|\bhaha+|\bhehe|😂|🤣|\bjk\b|💀|\blmfao\b)"
QUESTION = r"^((what|how|why|when|where|who|wyd|hbu|wbu)\b|(did|do|are|r|is|can|could|would|will|have|were|was) (you|u|we|i|they|he|she|it)\b)"
TOPICS = {"game": r"\b(game|practice|coach|team|match|season|play(ed|ing)?)\b", "school": r"\b(test|quiz|homework|hw|class|teacher|exam|grade|essay)\b",
          "music": r"\b(song|music|album|concert|playlist|listen)\b", "weekend": r"\b(weekend|saturday|sunday|friday|party|dance)\b",
          "food": r"\b(food|pizza|hungry|eat|dinner|lunch)\b"}
YES = r"^(yes+|yeah+|yea|yep|sure|ok(ay)?|down|i'?m down|bet|of course|definitely|deal|sounds good|let'?s do it)\b"
NO = r"^(no+|nah|nope|can'?t|i can'?t|busy|not today|maybe another|sorry,? (i )?can'?t)\b"


def classify(text: str) -> dict:
    """What a message you typed is doing, how flirty it is, and how much effort it shows."""
    s = (text or "").strip()
    low = s.lower()
    words = re.findall(r"[a-z0-9']+", low)
    f = {"text": s, "words": len(words), "question": "?" in s or bool(re.match(QUESTION, low)),
         "effort": round(clamp(len(words) / 12, 0, 1), 2), "topic": next((k for k, rx in TOPICS.items() if re.search(rx, low)), None),
         "flirt": 0, "joke": bool(re.search(JOKE, low))}
    emoji = any(e in s for e in FLIRT_EMOJI)
    intent = None
    for name, rx in RX:
        if re.search(rx, low):
            if name == "bye" and len(words) > 7:
                continue  # "ok gtg" closes; a long message that happens to say "later" doesn't
            intent = name
            break
    if intent in ("flirt", "ask_out", "love") or emoji:
        f["flirt"] = 2 if (intent in ("ask_out", "love") or re.search(STRONG, low)) else 1
        if intent is None or intent in ("greet", "compliment", "chat"):
            intent = "flirt"
    if intent is None:
        if re.match(DRY, low) or not words:
            intent = "dry"
        elif f["question"]:
            intent = "ask"
        elif f["joke"]:
            intent = "joke"
        else:
            intent = "chat"
    f["intent"] = intent
    return f


# --- how things stand between you ---------------------------------------------------------------

def _me(sim):
    from .messages import prot
    return prot(sim.w)


def _thread(sim, cid):
    from .messages import dm
    return dm(sim, cid)


def _landed_flirts(sim, cid, days=30) -> int:
    w = sim.w
    me = _me(sim)
    n = sum(1 for m in _thread(sim, cid)["msgs"] if m["from"] == cid and m.get("kind") == "chat_flirt_landed" and w.day - m["day"] <= days)
    for eid in w.history.by_char.get(me.id, [])[-400:]:
        e = w.history.events.get(eid)
        if e and e["type"] == "interact.flirt" and cid in e["actors"] + e["targets"] and e.get("outcome") in ("good", "great") \
                and w.day - e["day"] <= days:
            n += 1
    return n


def stage(sim, cid) -> int:
    """Where you two are: strangers, know each other, friendly, flirty, talking stage, dating."""
    w = sim.w
    me = _me(sim)
    if me.flags.get("partner") == cid:
        return 5
    r = w.rels.get((cid, me.id))
    if not r or r.familiarity < 15:
        return 0
    if cid in sim.siblings(me.id) or w.chars[cid].role == "staff":
        return 2 if r.affection >= 15 else 1
    flirts = _landed_flirts(sim, cid)
    if flirts >= 2 and r.attraction >= 50:
        return 4
    if flirts >= 1 and r.attraction >= 30:
        return 3
    if r.affection >= 15 and r.familiarity >= 30:
        return 2
    return 1


def _open_to_you(sim, cid):
    """None if they could be into you; otherwise the reason they can't."""
    from .social import orientation_ok
    w = sim.w
    me = _me(sim)
    o = w.chars[cid]
    if cid in sim.siblings(me.id):
        return "family"
    if o.role == "staff":
        return "staff"
    if o.flags.get("partner") and o.flags["partner"] != me.id:
        return "taken"
    if not orientation_ok(o, me):
        return "not_into"
    return None


def read(sim, cid) -> dict:
    """Your read on whether they're into you. Once you know someone a little, you can tell."""
    w = sim.w
    me = _me(sim)
    r = w.rels.get((cid, me.id))
    why = _open_to_you(sim, cid)
    if why == "family":
        return {"label": "Family", "tone": "none", "level": -1}
    if why == "staff":
        return {"label": "A teacher or coach", "tone": "none", "level": -1}
    if me.flags.get("partner") == cid:
        return {"label": "You're together", "tone": "good", "level": 4}
    if why == "taken":
        return {"label": f"They're dating {w.chars[w.chars[cid].flags['partner']].first}", "tone": "bad", "level": 0}
    if not r or r.familiarity < 20:
        return {"label": "Too early to tell", "tone": "unknown", "level": -1}
    if why == "not_into":
        return {"label": "Just friends vibes", "tone": "bad", "level": 0}
    a = r.attraction
    if a >= 60:
        return {"label": "Definitely into you", "tone": "good", "level": 4}
    if a >= 40:
        return {"label": "Seems into you", "tone": "good", "level": 3}
    if a >= 22:
        return {"label": "Maybe. Some signs", "tone": "neutral", "level": 2}
    return {"label": "Just friends vibes", "tone": "bad", "level": 0 if a < 10 else 1}


def signals(sim, cid, days=21) -> list:
    """What you've noticed lately: the things that tell you how they feel."""
    w = sim.w
    me = _me(sim)
    t = _thread(sim, cid)
    recent = [m for m in t["msgs"] if w.day - m["day"] <= days]
    out = []
    starts = 0
    seen_days = set()
    for m in recent:
        if m["day"] in seen_days or m.get("kind") == "note":
            continue
        seen_days.add(m["day"])
        if m["from"] == cid:
            starts += 1
    count = lambda k: sum(1 for m in recent if m["from"] == cid and m.get("kind") == k)  # noqa: E731
    if starts:
        out.append({"text": f"Texted you first{f' ({starts}×)' if starts > 1 else ''}", "good": True})
    back = count("chat_flirt_landed")
    if back:
        out.append({"text": "Flirted back" + (f" ({back}×)" if back > 1 else ""), "good": True})
    if count("chat_ask"):
        out.append({"text": "Asked about you", "good": True})
    if count("chat_laugh"):
        out.append({"text": "Laughed at your jokes", "good": True})
    if any(w.day - d <= days for d in t.get("long_days", [])):
        out.append({"text": "Kept the conversation going", "good": True})
    if count("chat_flirt_playful"):
        out.append({"text": "Laughed off a flirt (but didn't mind)", "good": None})
    if count("chat_dry") + count("chat_close_cold"):
        out.append({"text": "Short, dry answers", "good": False})
    if count("chat_flirt_awkward"):
        out.append({"text": "A flirt got awkward", "good": False})
    if count("chat_flirt_shut"):
        out.append({"text": "Shut a flirt down", "good": False})
    unread = sum(1 for m in recent if m["from"] == "me" and m.get("read") and m.get("kind") in ("chat", "first"))
    if unread:
        out.append({"text": "Left you on read", "good": False})
    for eid in w.history.by_char.get(me.id, [])[-300:]:
        e = w.history.events.get(eid)
        if not e or w.day - e["day"] > days or cid not in e["actors"] + e["targets"]:
            continue
        k, o = e["type"], e.get("outcome")
        if k == "interact.flirt" and o in ("good", "great"):
            out.append({"text": "Flirting went well in person", "good": True})
        elif k == "interact.flirt" and o in ("awkward", "bad"):
            out.append({"text": "Flirting got awkward in person", "good": False})
        elif k in ("interact.hang_out", "interact.date") and o == "great":
            out.append({"text": "Had a great time with you", "good": True})
        elif k in ("interact.hang_out", "interact.date") and o in ("declined", "busy"):
            out.append({"text": "Turned down plans", "good": False})
    seen, uniq = set(), []
    for s in out:
        if s["text"] not in seen:
            seen.add(s["text"])
            uniq.append(s)
    return uniq[:8]


def tip(sim, cid, st=None, rd=None) -> str:
    st = stage(sim, cid) if st is None else st
    rd = read(sim, cid) if rd is None else rd
    why = _open_to_you(sim, cid)
    if why in ("family", "staff"):
        return ""
    if why == "taken":
        return "They're with someone. Flirting now mostly makes things weird."
    if st == 5:
        return "You're together. Text, hang out, show up for them."
    if rd["level"] == -1 or st == 0:
        return "Get to know them first: say hi, ask about their day, hang out. Flirting with someone who barely knows you is a gamble."
    if rd["level"] <= 1:
        return "They see you as a friend right now. Hang out and make them laugh; flirting now will probably be awkward."
    if st <= 2:
        return "There are signs. Try a light flirt and see if they flirt back."
    if st == 3:
        return "They flirt back. Keep it going, then ask them to hang out, just you two."
    return "This is going somewhere. Ask them out in person."


def vibe(sim, cid) -> dict:
    st = stage(sim, cid)
    rd = read(sim, cid)
    from .social import orientation_ok
    w = sim.w
    me = _me(sim)
    r = w.rels.get((cid, me.id))
    # only where it could mean something: you could be into them, or they're into you
    maybe = orientation_ok(me, w.chars[cid]) or (r is not None and r.attraction >= 30) or me.flags.get("partner") == cid
    return {"stage": st, "stages": STAGES, "read": rd["label"], "tone": rd["tone"], "level": rd["level"],
            "signals": signals(sim, cid), "tip": tip(sim, cid, st, rd),
            "romance": bool(maybe) and _open_to_you(sim, cid) not in ("family", "staff")}


# --- flirting, and why it worked -----------------------------------------------------------------

WHY = {
    "closeness": ("you two are close", "you barely know each other yet", "Talk more first."),
    "interest": ("they were already into you", "they don't seem into you like that (yet)", "Watch for signals before you flirt."),
    "moment": ("they were in a good mood", "bad timing", "Try another time."),
    "pace": ("you'd built up to it", "too much, too fast", "Joke around first, then flirt."),
    "you": ("you were smooth about it", "it came off a little forced", "Put a little more into it."),
}


def flirt_check(sim, cid, strength: int, effort: float, momentum: float, rng) -> dict:
    """Did the flirt land? Five readable parts, the two that mattered most become the reason."""
    w = sim.w
    me = _me(sim)
    o = w.chars[cid]
    rt = w.ensure_rel(cid, me.id, w.day)
    block = _open_to_you(sim, cid)
    if block in ("taken", "not_into", "staff"):
        why = {"taken": "they're dating someone", "not_into": "they're not into you that way", "staff": "that's a teacher or coach. Hard no"}[block]
        return {"outcome": "shut", "why": f"Shut down: {why}.", "terms": []}
    closeness = 0.6 * ((rt.familiarity - 35) / 65 * 0.5 + rt.affection / 100 * 0.6)
    interest = 0.9 * (rt.attraction - 30) / 40
    stress = max(0.0, o.needs.get("stress", 40) - 60) / 40
    moment = 0.4 * (o.mood - 55) / 45 - 0.4 * stress + momentum + (0.1 if sim.current_phase() in ("evening", "night") else 0.0)
    need = 2 if strength <= 1 else 3
    st = stage(sim, cid)
    pace = 0.25 if st >= need else -0.35 * (need - st)
    you = 0.4 * (me.aptitudes["charisma"] + me.traits["confidence"] - 100) / 100 + 0.15 * effort
    terms = [("closeness", closeness), ("interest", interest), ("moment", moment), ("pace", pace), ("you", you)]
    score = sum(v for _, v in terms) + rng.gauss(0, 0.15)
    if score >= 0.9:
        out = "landed"
    elif score >= 0.35:
        out = "playful"
    elif score >= -0.6 or rt.attraction >= 15:
        out = "awkward"
    else:
        out = "shut"
    pos = sorted([t for t in terms if t[1] > 0.12], key=lambda t: -t[1])
    neg = sorted([t for t in terms if t[1] < -0.05], key=lambda t: t[1])

    def word(k, good):
        if k == "pace" and not good and st <= 1:
            return "they barely know you yet"
        if k == "moment" and not good:
            return "they're stressed out" if stress > 0.3 else "they're in a bad mood" if o.mood < 40 else "the conversation had gone dry" if momentum < 0 else "bad timing"
        return WHY[k][0 if good else 1]
    if out == "landed":
        why = "Landed: " + " and ".join(word(k, True) for k, _ in pos[:2]) + "." if pos else "Landed."
    elif out == "playful":
        why = "They liked it" + (f" ({word(pos[0][0], True)})" if pos else "") + (f", but {word(neg[0][0], False)}." if neg else ".")
    else:
        lead = "Awkward" if out == "awkward" else "Shut down"
        why = f"{lead}: " + " and ".join(word(k, False) for k, _ in neg[:2]) + "." if neg else f"{lead}."
        if neg:
            why += " " + ("Talk and hang out first." if neg[0][0] in ("pace", "closeness") and st <= 1 else WHY[neg[0][0]][2])
    return {"outcome": out, "why": why[0].upper() + why[1:], "terms": [[k, round(v, 2)] for k, v in terms], "score": round(score, 2)}


def why_interact(terms, me_first: bool) -> str | None:
    """In person: the parts of how an interaction went, in words (from social.interact's terms)."""
    names = [("compatibility", "you two click", "you don't have much in common"), ("charm", "you were charming", "you weren't at your smoothest"),
             ("their mood", "they were in a good mood", "they were in a bad mood"), ("feelings", "they already like you", "they don't really like you"),
             ("their stress", None, "they were stressed"), ("your mood", "you were in a good mood", "you were in a bad mood"),
             ("luck", "a little luck", "bad luck"), ("chemistry", "there's chemistry", "no real chemistry")]
    vals = [t[1] for t in terms[1:]]
    if not me_first:
        return None
    parts = [(names[i], v) for i, v in enumerate(vals) if i < len(names)]
    pos = sorted([(n, v) for n, v in parts if v > 0.04 and n[1]], key=lambda x: -x[1])
    neg = sorted([(n, v) for n, v in parts if v < -0.04 and n[2]], key=lambda x: x[1])
    bits = [n[1] for n, _ in pos[:2]] + [n[2] for n, _ in neg[:1]] if sum(vals) >= 0.15 else [n[2] for n, _ in neg[:2]] + [n[1] for n, _ in pos[:1]]
    if not bits:
        return None
    return "Why: " + ", ".join(bits[:-1]) + (" and " if len(bits) > 1 else "") + bits[-1] + "."


def why_ask_out(terms, yes: bool) -> str:
    """In person: why they said yes or no to going out."""
    d = {t[0]: t[1] for t in terms}
    att = next((v for k, v in d.items() if "attraction" in k), 0)
    aff = next((v for k, v in d.items() if "affection" in k), 0)
    taken = next((v for k, v in d.items() if k == "already taken"), 0)
    other = next((v for k, v in d.items() if k == "likes someone else"), 0)
    if yes:
        bits = ["they were into you"] if att > -1 else []
        if aff > 0.3:
            bits.append("they really like you")
        return "Why: " + (" and ".join(bits) if bits else "you took the shot at the right time") + "."
    if taken < 0:
        return "Why: they're with someone."
    if att <= -7:
        return "Why: they're not into you that way."
    bits = []
    if att < -1:
        bits.append("they're not into you like that yet")
    if other < 0:
        bits.append("they like someone else")
    if aff < 0:
        bits.append("they don't know you that well")
    return "Why: " + (" and ".join(bits[:2]) if bits else "just not the right time") + ". Flirt first, and wait for them to flirt back."


# --- the conversation -----------------------------------------------------------------------------

def _convo(sim, cid) -> dict:
    """Today's conversation with them (one per part of the day)."""
    w = sim.w
    t = _thread(sim, cid)
    c = t.get("convo")
    ph = sim.current_phase()
    if not c or c.get("day") != w.day or c.get("phase") != ph:
        earlier = c.get("today", 0) + 1 if c and c.get("day") == w.day else 0
        c = {"day": w.day, "phase": ph, "energy": None, "turns": 0, "momentum": 0.0, "closed": False, "double": 0, "today": earlier}
        t["convo"] = c
    return c


def _energy(sim, cid, c) -> float:
    w = sim.w
    me = _me(sim)
    o = w.chars[cid]
    r = w.ensure_rel(cid, me.id, w.day)
    e = 2 + r.affection / 25 + o.traits["sociability"] / 50 + max(0.0, r.attraction - 30) / 20 - max(0.0, o.needs.get("stress", 40) - 65) / 15
    if me.flags.get("partner") == cid:
        e += 2
    return clamp(e - c.get("today", 0) * 1.2, 1, 9)


def _gain(sim, cid, fx, who, what, amount, why):
    """Relationship change from texting, capped per person per day (spamming doesn't farm it)."""
    w = sim.w
    from .messages import phone
    me = _me(sim)
    day = phone(w).setdefault("chat_gain", {}).setdefault(cid, {"day": w.day})
    if day.get("day") != w.day:
        day.clear()
        day["day"] = w.day
    if amount > 0 and what in CAP:
        room = CAP[what] - day.get(what, 0)
        amount = max(0.0, min(amount, room))
        day[what] = day.get(what, 0) + amount
    if amount:
        fx.rel(who, me.id if who == cid else cid, what, amount, why)


def _pick(sim, pool: list, salt: str, avoid: set) -> str:
    from .messages import _h
    if not pool:
        return ""
    i0 = _h(salt) % len(pool)
    for k in range(len(pool)):
        s = pool[(i0 + k) % len(pool)]
        if s.lower().rstrip(".!") not in avoid:
            return s
    return pool[i0]


def _say(sim, cid, key, outcome, salt, kind, avoid):
    from .messages import post, _fill
    pool = D()["reply"].get(key, {}).get(outcome) or []
    me = _me(sim)
    return post(sim, f"dm:{cid}", cid, _fill(_pick(sim, pool, salt, avoid), {"me": me.first}), kind=kind, unread=False)


def _note(sim, cid, text):
    from .messages import post
    return post(sim, f"dm:{cid}", "note", text, kind="note", unread=False)


def _pending(sim, cid):
    """Their last message, if it's still waiting on an answer from you."""
    from .messages import _reply_open
    t = _thread(sim, cid)
    for m in reversed(t["msgs"]):
        if m["from"] == "me":
            return None
        if m.get("kind") == "note":
            continue
        return m if _reply_open(sim, m) else None
    return None


def send(sim, cid, text: str | None = None, suggestion: int | None = None) -> dict:
    """You send a text: typed, or one of the suggestions. They answer (or don't), and things move a little."""
    from .messages import _avoid, _h, phone, post, reply, sender_name
    w = sim.w
    me = _me(sim)
    o = w.chars.get(cid)
    if not me or not o:
        raise ValueError("unknown person")
    if cid not in phone(w)["contacts"] and cid not in sim.siblings(me.id):
        raise ValueError(f"You don't have {o.first}'s number yet.")
    if suggestion is not None:
        sug = suggestions(sim, cid)
        if not 0 <= suggestion < len(sug):
            raise ValueError("no such suggestion")
        text, forced = sug[suggestion]["text"], sug[suggestion]["intent"]
    else:
        forced = None
    text = (text or "").strip()[:240]
    if not text:
        raise ValueError("say something")
    f = classify(text)
    intent = forced or f["intent"]
    if forced in ("flirt", "flirt_strong"):
        f["flirt"] = 2 if forced == "flirt_strong" else max(1, f["flirt"])
        intent = "flirt"
    if forced in ("good_luck", "congrats"):
        intent = "compliment"
    if forced == "answer":
        intent = "chat"
    tid = f"dm:{cid}"
    # their last text was asking you something with set answers (an invite, a moment): a typed yes or no counts
    pend = _pending(sim, cid)
    if pend is not None:
        low = text.lower()
        linked = [i for i, r in enumerate(pend["replies"]) if r["fx"].startswith(("invite:", "moment:"))]
        if linked:
            yes_i = next((i for i in linked if pend["replies"][i]["fx"].endswith(":yes") or pend["replies"][i]["fx"].endswith(":0")), None)
            no_i = next((i for i in linked if i != yes_i), None)
            pick_i = yes_i if re.match(YES, low) else no_i if re.match(NO, low) else None
            if pick_i is not None:
                pend["replies"][pick_i] = dict(pend["replies"][pick_i], label=text)
                return reply(sim, tid, pend["id"], pick_i)
        else:
            pend["chosen"] = -2  # you answered in your own words
    c = _convo(sim, cid)
    if c["energy"] is None:
        c["energy"] = _energy(sim, cid, c)
    avoid = _avoid(sim, tid)
    salt = f"{w.day}:{cid}:{phone(w)['next']}"
    mine = post(sim, tid, "me", text, kind="chat", unread=False)
    rng = sim.streams.get("chat", w.day, cid, phone(w)["next"])
    ev = sim.new_event("text", intent, [me.id], [cid], 2, {"label": text, "thread": tid})
    ev["text"] = f"{me.short} texted {o.first}: \"{text}\""
    fx = Effects(w, ev)
    rt = w.ensure_rel(cid, me.id, w.day)
    if c["closed"]:
        # they already wrapped it up: texting again doesn't get an answer, and doing it twice is a lot
        c["double"] += 1
        mine["read"] = True
        if c["double"] >= 2:
            _gain(sim, cid, fx, cid, "perceived", -1.5, "double texting")
        sim.finish(ev, fx)
        if c["double"] == 1:
            _note(sim, cid, f"{o.first} is done talking for now. Texting again won't help; try later.")
        return {"thread": None, "result": "read"}
    sib = cid in sim.siblings(me.id)
    warmth = rt.affection / 100 + (o.traits["sociability"] - 50) / 100 + rng.gauss(0, 0.12)
    ok = "warm" if warmth > 0.25 else "ok" if warmth > -0.15 else "cold"
    cost, result, why, ask = 1.0, "replied", None, False
    plans = False
    if sib and intent in ("flirt", "ask_out"):
        _say(sim, cid, "family", "sib_flirt", salt, "chat_react", avoid)
    elif intent == "greet":
        _say(sim, cid, "greet", ok, salt, "chat_react", avoid)
        ask = ok != "cold"
        _gain(sim, cid, fx, cid, "familiarity", 0.6, "texting")
    elif intent in ("chat", "ask"):
        _say(sim, cid, "ask" if f["question"] else "chat", ok, salt, "chat_react", avoid)
        _gain(sim, cid, fx, cid, "familiarity", 1.0, "texting")
        _gain(sim, cid, fx, cid, "affection", 0.6 + 0.6 * f["effort"] if ok != "cold" else 0.0, "a good conversation")
        ask = ok == "warm" and _h(salt, "ask") % 3 != 0
        cost = 0.8
    elif intent == "joke":
        from .social import compatibility
        q = 0.4 * compatibility(w, me, o) + (me.aptitudes["charisma"] - 50) / 100 + (o.mood - 50) / 100 + rng.gauss(0, 0.2)
        if q > 0:
            _say(sim, cid, "joke", "laugh", salt, "chat_laugh", avoid)
            _gain(sim, cid, fx, cid, "affection", 1.2, "made them laugh")
            fx.need(me.id, "fun", 2, "texting")
            c["momentum"] = min(0.3, c["momentum"] + 0.1)
            cost = 0.6
        else:
            _say(sim, cid, "joke", "meh", salt, "chat_react", avoid)
            c["momentum"] -= 0.1
    elif intent == "compliment":
        if rt.affection >= 10 or rt.familiarity >= 40:
            _say(sim, cid, "compliment", "warm", salt, "chat_react", avoid)
            _gain(sim, cid, fx, cid, "affection", 2.0, "a nice text")
            _gain(sim, cid, fx, cid, "perceived", 1.5, "a nice text")
        else:
            _say(sim, cid, "compliment", "weird", salt, "chat_react", avoid)
    elif intent == "support":
        down = o.needs.get("stress", 40) > 55 or o.mood < 45 or any(
            m["valence"] <= -0.3 and w.day - m["day"] <= 4 for m in o.memories)
        if down:
            _say(sim, cid, "support", "thanks", salt, "chat_react", avoid)
            _gain(sim, cid, fx, cid, "affection", 3.0, "you checked on them")
            fx.rel(cid, me.id, "trust", 3, "you checked on them")
            fx.need(cid, "stress", -5, "someone checked on them")
            c["momentum"] = min(0.3, c["momentum"] + 0.15)
        else:
            _say(sim, cid, "support", "fine", salt, "chat_react", avoid)
            _gain(sim, cid, fx, cid, "affection", 0.5, "you checked on them")
    elif intent == "apology":
        if rt.affection > -30:
            _say(sim, cid, "apology", "accept", salt, "chat_react", avoid)
            fx.rel(cid, me.id, "rivalry", -6, "you apologized")
            fx.rel(cid, me.id, "trust", 3, "you apologized")
            _gain(sim, cid, fx, cid, "affection", 2.0, "you apologized")
        else:
            _say(sim, cid, "apology", "cold", salt, "chat_react", avoid)
    elif intent == "dry":
        c["momentum"] -= 0.2
        _gain(sim, cid, fx, cid, "perceived", -1.0, "a dry text")
        cost = 1.5
        if rt.affection >= 35 and _h(salt, "chk") % 2 == 0:
            _say(sim, cid, "dry", "check", salt, "chat_react", avoid)
        else:
            _say(sim, cid, "dry", "dry", salt, "chat_dry", avoid)
    elif intent == "rude":
        _say(sim, cid, "rude", "hurt", salt, "chat_react", avoid)
        fx.rel(cid, me.id, "affection", -4, "you were rude")
        fx.rel(cid, me.id, "rivalry", 5, "you were rude")
        fx.rel(cid, me.id, "perceived", -6, "you were rude")
        c["energy"] = 0
        result = "rude"
    elif intent == "bye":
        post(sim, tid, cid, _pick(sim, D()["close"]["nice" if ok != "cold" else "tired"], salt, avoid), kind="chat_close", unread=False)
        _gain(sim, cid, fx, cid, "perceived", 0.5, "ended on a good note")
        if c["turns"] >= 4:
            post(sim, tid, "note", "Nice. Ending on a good note leaves them wanting more.", kind="note", unread=False)
        c["closed"] = True
        result = "bye"
    elif intent == "love" and (me.flags.get("partner") == cid or sib):
        _say(sim, cid, "love", "back" if not sib else "fam", salt, "chat_react", avoid)
        _gain(sim, cid, fx, cid, "affection", 2.0, "love you")
    elif intent == "plans" and (w.meta.get("control", {}).get("queued") or {}).get("target") == cid:
        _say(sim, cid, "plans", "already", salt, "chat_react", avoid)
    elif intent == "plans" and (w.meta.get("control", {}).get("queued") or {}).get("agreed"):
        q = w.meta["control"]["queued"]
        _say(sim, cid, "plans", "no" if ok != "cold" else "cold", salt, "chat_react", avoid)
        other = w.chars[q["target"]].first if q.get("target") in w.chars else "someone"
        _note(sim, cid, f"You already have plans with {other} at your next free time. Ask {o.first} after that.")
    elif intent == "plans":
        free = o.location == me.location and o.status == "active"
        p = clamp((rt.affection + o.traits["sociability"] * 0.3 - 10) / 70, 0.02, 0.92) * (1 if free else 0.1)
        if me.flags.get("partner") == cid:
            p = max(p, 0.8)
        if rng.random() < p:
            _say(sim, cid, "plans", "yes", salt, "chat_plans_yes", avoid)
            w.meta.setdefault("control", {})["queued"] = {"action": "hang_out", "target": cid, "agreed": True, "day": w.day}
            _gain(sim, cid, fx, cid, "affection", 1.0, "making plans")
            _note(sim, cid, "Plans made. You'll hang out at your next free time.")
            plans, result = True, "plans"
        else:
            _say(sim, cid, "plans", "no" if ok != "cold" else "cold", salt, "chat_react", avoid)
    elif intent in ("flirt", "ask_out", "love"):
        res = flirt_check(sim, cid, 2 if intent in ("ask_out", "love") else max(1, f["flirt"]), f["effort"], c["momentum"], rng)
        out = res["outcome"]
        why = res["why"]
        if intent == "ask_out" and out == "landed":
            _say(sim, cid, "ask_out", "yes", salt, "chat_flirt_landed", avoid)
            why += " Ask them out in person: it's in your choices when you see them."
        elif intent == "ask_out" and out == "shut":
            _say(sim, cid, "ask_out", "no", salt, "chat_flirt_shut", avoid)
        else:
            _say(sim, cid, "flirt", out, salt, f"chat_flirt_{out}", avoid)
        if out == "landed":
            _gain(sim, cid, fx, cid, "attraction", 4.0, "flirting")
            _gain(sim, cid, fx, me.id, "attraction", 3.0, "flirting")
            _gain(sim, cid, fx, cid, "affection", 1.0, "flirting")
            c["momentum"] = min(0.3, c["momentum"] + 0.15)
            cost = 0.5
            ask = _h(salt, "fa") % 2 == 0
        elif out == "playful":
            _gain(sim, cid, fx, cid, "attraction", 1.5, "flirting")
            cost = 0.8
        elif out == "awkward":
            _gain(sim, cid, fx, cid, "perceived", -1.0, "an awkward flirt")
            c["momentum"] -= 0.15
            cost = 1.4
        else:
            _gain(sim, cid, fx, cid, "perceived", -3.0, "a flirt that didn't land")
            fx.rel(cid, me.id, "attraction", -1.5, "a flirt that didn't land")
            c["momentum"] -= 0.3
            cost = 2.0
        ev["importance"] = 8
        ev["outcome"] = out
        ev["data"]["why"] = why
        result = f"flirt_{out}"
    else:
        _say(sim, cid, "chat", ok, salt, "chat_react", avoid)
    c["turns"] += 1
    c["energy"] -= cost
    if c["energy"] <= 0 and not c["closed"]:
        tone = "cold" if result == "rude" or c["momentum"] < -0.3 else "nice" if ok == "warm" else "tired"
        post(sim, tid, cid, _pick(sim, D()["close"][tone], salt + ":close", avoid), kind="chat_close" if tone != "cold" else "chat_close_cold", unread=False)
        c["closed"] = True
    elif ask and not c["closed"]:
        pool = D()["ask"]["flirty" if result == "flirt_landed" else "general"]
        post(sim, tid, cid, _pick(sim, pool, salt + ":ask", avoid), kind="chat_ask", unread=False)
    if c["turns"] == 5:
        t = _thread(sim, cid)
        t["long_days"] = (t.get("long_days", []) + [w.day])[-10:]  # a real back-and-forth
    if why:
        notes = [m for m in _thread(sim, cid)["msgs"][-8:] if m.get("kind") == "note"]
        if not notes or notes[-1]["text"] != why:  # same reason as last time: the reply says it
            _note(sim, cid, why)
    sim.finish(ev, fx)
    phone(w)["texted"][cid] = w.day
    return {"thread": None, "result": result, "plans": plans, "why": why, "who": sender_name(sim, cid)}


def suggestions(sim, cid) -> list:
    """A few things you could send next, fitted to where the conversation and the two of you are."""
    from .messages import _avoid, _h, phone
    w = sim.w
    me = _me(sim)
    o = w.chars.get(cid)
    if not me or not o:
        return []
    t = _thread(sim, cid)
    c = t.get("convo") if t.get("convo", {}).get("day") == w.day and t["convo"].get("phase") == sim.current_phase() else None
    if c and c.get("closed"):
        return []
    last = next((m for m in reversed(t["msgs"]) if m.get("kind") != "note"), None)
    talking = bool(c and c["turns"])
    asked = last is not None and last["from"] == cid and (last.get("kind") == "chat_ask" or last["text"].rstrip().endswith("?"))
    rd = read(sim, cid)
    st = stage(sim, cid)
    sib = cid in sim.siblings(me.id)
    kinds = []
    if asked:
        kinds.append("answer")
    elif not talking:
        kinds.append("greet")
    soon = {i["group"] for i in w.calendar if i["kind"] == "game" and i["day"] in (w.day, w.day + 1)}
    if any(g in soon for g in o.memberships):
        kinds.append("good_luck")
    if any(w.day - a["day"] <= 7 for a in o.achievements):
        kinds.append("congrats")
    hurt = any(m["valence"] <= -0.3 and cid in m.get("with", []) and w.day - m["day"] <= 21 for m in me.memories)
    r_me = w.rels.get((me.id, cid))
    if hurt or (r_me and (r_me.affection < 0 or r_me.rivalry >= 45)):
        kinds.append("apology")
    if o.needs.get("stress", 40) > 60:
        kinds.append("support")
    kinds += ["ask", "joke"]
    if me.flags.get("partner") == cid:
        kinds += ["love", "plans", "flirt_strong"]
    elif not sib and o.role != "staff" and rd["level"] >= 2:
        kinds.append("flirt_strong" if st >= 3 else "flirt")
    if (r_me and r_me.affection >= 20) or st >= 2:
        kinds.append("plans")
    if talking and c["turns"] >= 2:
        kinds.append("bye")
    pick_rank = {"answer": 0, "greet": 0, "bye": 1, "flirt": 2, "flirt_strong": 2, "love": 2, "good_luck": 3, "congrats": 3,
                 "apology": 3, "support": 3, "plans": 4, "ask": 5, "joke": 5}
    show_rank = {"answer": 0, "greet": 0, "good_luck": 1, "congrats": 1, "apology": 1, "support": 1, "ask": 2, "joke": 2,
                 "love": 3, "flirt": 3, "flirt_strong": 3, "plans": 4, "bye": 9}
    salt = f"{w.day}:{cid}:{len(t['msgs'])}"
    uniq = list(dict.fromkeys(kinds))
    chosen = sorted(uniq, key=lambda k: (pick_rank[k], _h(salt, k) % 7))[:4]
    avoid = _avoid(sim, f"dm:{cid}")
    out = []
    for k in sorted(chosen, key=lambda k: show_rank[k]):
        pool = D()["suggest"].get(k) or []
        if pool:
            out.append({"text": _pick(sim, pool, f"{salt}:{k}", avoid), "intent": k, "tone": TONE.get(k, "💬")})
    return out


def view(sim, cid) -> dict:
    """The compose bar for a conversation: what you can send, and where things stand."""
    from .messages import phone
    w = sim.w
    me = _me(sim)
    o = w.chars.get(cid)
    if not o or not me:
        return {"can_type": False, "suggestions": [], "status": "none"}
    if cid not in phone(w)["contacts"] and cid not in sim.siblings(me.id):
        return {"can_type": False, "suggestions": [], "status": "no_number"}
    t = _thread(sim, cid)
    c = t.get("convo")
    live = c and c.get("day") == w.day and c.get("phase") == sim.current_phase()
    status = "done" if live and c.get("closed") else "open" if live and c.get("turns") else "new"
    return {"can_type": True, "suggestions": suggestions(sim, cid), "status": status,
            "stage": STAGES[stage(sim, cid)], "read": read(sim, cid)["label"]}
