"""Texts about real things, that go somewhere, from people who sound like themselves.

- Topics (data/talk.json): what someone would actually text you about right now, from what happened: your game (the
  score, the opponent, your line, the big play), theirs, a quiz coming up, the party you were both at, gossip about two
  people you both know, their news (made the team, got cut, got hurt, got grounded, started dating someone, got the
  lead), the crew's inside jokes, your award. Small talk is what's left when nothing real is going on.
- Each topic is a small conversation: their opener, four replies you can send (each with a tone you can see), and what
  they say back to the one you picked. After that you can keep going by typing.
- Memory: nobody texts you about the same thing twice; a congrats comes once per award per person per season (a close
  friend might rib you about the fifth one); someone you turned down stops flirting and checks you're good first.
- Voices: everyone has a texting style that stays theirs (how they laugh, the emoji they use, their filler words,
  capitals or not, what they call you, sending two texts instead of one).

Storage: phone["talk"] = {"done": {cid: {key: day}}, "turned_down": {cid: day}, "said": {cid: day}}.
"""
from __future__ import annotations

import json
import os
import re
import zlib

from . import calendar as calm

_DATA = None
TONES = ("hype", "humble", "funny", "dry", "real", "move on", "curious", "sweet", "helpful", "same", "cocky", "spill", "skeptic",
         "above it", "thanks", "one-up", "kind", "honest", "distant")
SMALL_TALK_GAP = 4      # days before the same person makes small talk again
TURNED_DOWN_QUIET = 45  # days someone you turned down won't flirt


def D() -> dict:
    global _DATA
    if _DATA is None:
        from .catalogs import DATA_DIR
        with open(os.path.join(DATA_DIR, "talk.json"), encoding="utf-8") as f:
            _DATA = json.load(f)
    return _DATA


def _h(*parts) -> int:
    return zlib.crc32(":".join(str(p) for p in parts).encode())


def store(w) -> dict:
    ph = w.meta.setdefault("phone", {})
    t = ph.setdefault("talk", {})
    for k in ("done", "turned_down", "said"):
        t.setdefault(k, {})
    return t


def _me(sim):
    w = sim.w
    return w.chars.get(w.meta.get("protagonist") or "")


# ------------------------------------------------------------------------------------------------ voices
def style(sim, cid) -> dict:
    """How someone texts. Stable: the same person always texts the same way (from who they are and their name)."""
    w = sim.w
    c = w.chars.get(cid)
    if c is None or c.role == "staff":
        return {}
    s = D()["style"]
    t = c.traits or {}
    casual = (t.get("sociability", 50) + t.get("impulsivity", 50)) / 2 + (50 - t.get("discipline", 50)) * 0.4
    hype = t.get("sociability", 50) > 65 and t.get("impulsivity", 50) > 55
    k = lambda tag: _h(cid, "style", tag)  # noqa: E731
    laughs = s["laughs"]
    fill = (s["fillers_m"] if c.gender == "m" else s["fillers_f"] if c.gender == "f" else []) + s["fillers_any"]
    emo = s["emoji"]
    names = s["names_m"] if c.gender == "m" else s["names_f"]
    return {
        "lower": casual > 48 or k("lower") % 3 == 0,
        "caps": hype and k("caps") % 2 == 0,                     # LETS GOOO when they're excited
        "laugh": laughs[k("laugh") % len(laughs)],
        "fillers": [fill[k("f1") % len(fill)], fill[(k("f1") % len(fill) + 1 + k("f2") % (len(fill) - 1)) % len(fill)]] if len(fill) > 1 else fill,
        "filler_rate": 0.12 + casual / 500,
        "emoji": [emo[k("e1") % len(emo)], emo[k("e2") % len(emo)]],
        "emoji_rate": (t.get("sociability", 50) + t.get("impulsivity", 50)) / 400 * (0.5 if k("emo") % 4 == 0 else 1.0),
        "double": t.get("impulsivity", 50) > 60 or k("double") % 5 == 0,   # sends two texts instead of one
        "name": names[k("name") % len(names)],
        "periods": t.get("discipline", 50) > 70 and not casual > 55,
    }


def your_name(sim, cid) -> str:
    me = _me(sim)
    st = style(sim, cid)
    if me is None or not st:
        return me.first if me else "you"
    return st["name"].format(first=me.first, first_low=me.first.lower(), last_low=(me.last or me.first).lower(), initial=me.first[:1].lower())


LAUGH_RX = re.compile(r"\b(lol|lmao|haha+|hah)\b|😂", re.I)


def styled(sim, cid, text: str, salt, plain: bool = False) -> str:
    """A line in their texting style. Applied to every text a student sends you (plain: no filler words, for an invite or an
    ask, which people say straight)."""
    st = style(sim, cid)
    if not st or not text:
        return text
    r = (_h(salt, "sty") % 1000) / 1000
    out = text
    if LAUGH_RX.search(out):  # their laugh, not a generic one
        out = LAUGH_RX.sub(st["laugh"], out, count=1)
    if st["fillers"] and not plain and r < st["filler_rate"] and not out.lower().startswith(("omg", "yo", "dude", "bro", "ok so", "wait")):
        f = st["fillers"][_h(salt, "fill") % len(st["fillers"])]
        out = (f + " " + out[0].lower() + out[1:]) if f in ("omg", "yo", "ok so", "honestly", "ngl", "lowkey", "tbh") else (out + " " + f)
    if st["lower"] and not st["caps"]:
        out = out[0].lower() + out[1:] if out[:1].isupper() and not out[:3].isupper() else out
        out = out.rstrip(".")
    elif st["periods"] and out[-1:].isalnum():
        out += "."
    if st["caps"] and ("!!" in out or "gooo" in out.lower()) and len(out) < 40:
        out = out.upper()
    if (_h(salt, "emo") % 1000) / 1000 < st["emoji_rate"] and not re.search(r"[\U0001F300-\U0001FAFF]", out):
        out += " " + st["emoji"][_h(salt, "emo2") % 2]
    return out


def split(sim, cid, text: str, salt) -> list:
    """Some people send two texts instead of one ("WAIT" / "did you hear...")."""
    st = style(sim, cid)
    if not st or not st.get("double") or len(text) < 28 or _h(salt, "dbl") % 3:
        return [text]
    m = re.search(r"^(.{6,40}?)([.!?]+\s+|\s+(?=did |wait |ok |so |i ))(.+)$", text)
    if not m:
        return [text]
    return [m.group(1).rstrip(" .") + (m.group(2).strip() if m.group(2).strip() in ("!", "?", "!!", "??") else ""), m.group(3)]


# ------------------------------------------------------------------------------------------------ memory
def done(w, cid, key) -> bool:
    return key in (store(w)["done"].get(cid) or {})


def mark(w, cid, key):
    d = store(w)["done"].setdefault(cid, {})
    d[key] = w.day
    if len(d) > 60:  # (only what's recent matters)
        for k in sorted(d, key=lambda k: d[k])[:len(d) - 60]:
            d.pop(k)


def turned_down(w, cid, day=None):
    store(w)["turned_down"][cid] = w.day if day is None else day


def quiet_flirting(w, cid) -> bool:
    """You turned them down lately: no flirty texts from them."""
    d = store(w)["turned_down"].get(cid)
    return d is not None and w.day - d < TURNED_DOWN_QUIET


def small_talk_ok(w, cid) -> bool:
    return w.day - store(w)["said"].get(cid, -99) >= SMALL_TALK_GAP


def note_small_talk(w, cid):
    store(w)["said"][cid] = w.day


# ------------------------------------------------------------------------------------------------ what's real right now
def _game_line(sport, line) -> str:
    from .gameplay import line_words
    try:
        s = line_words(sport, line or {})
    except Exception:  # noqa: BLE001
        s = ""
    return s or "played great"


def _recent(w, cid, days=2):
    hist = w.history
    ids = hist.by_char.get(cid) or []
    out = []
    for eid in ids[-40:]:
        e = hist.events.get(eid)
        if e and w.day - e["day"] <= days:
            out.append(e)
    return out


def topics(sim, cid) -> list:
    """What this person could text you about now: [(score, topic, facts, memory key)], best first."""
    w = sim.w
    me = _me(sim)
    c = w.chars.get(cid)
    if me is None or c is None:
        return []
    out = []
    rel = w.rels.get((cid, me.id))
    close = rel.affection if rel else 0
    # someone you turned down: first, are we good?
    td = store(w)["turned_down"].get(cid)
    if td is not None and w.day - td <= 10 and not done(w, cid, f"awkward:{td}"):
        out.append((95, "awkward_after_no", {}, f"awkward:{td}"))
    # your game
    g = (me.flags or {}).get("last_game")
    if g and 0 <= w.day - g["day"] <= 1 and not done(w, cid, f"game:{g['day']}:{g.get('group')}"):
        mates = (w.groups.get(g.get("group")) or {}).get("members") or []
        if cid not in mates:  # (teammates have the team chat)
            facts = {"opp": g.get("opp") or "them", "score": g.get("score") or "", "line": _game_line(g.get("sport"), g.get("line")),
                     "play": re.sub(rf"^{re.escape(me.first)}\b", "you", (g.get("play") or "that play").rstrip(".")), "team": g.get("team") or ""}
            if g.get("tier") != "great":  # (how you actually played picks the opener: not "beast mode" for 1-for-5)
                facts["_open"] = "open_ok" if g.get("win") else "open"
            elif g.get("play") and g.get("win"):
                facts["_open"] = "open_play"
            out.append((80 + close / 5, "game_you_win" if g.get("win") else "game_you_loss", facts, f"game:{g['day']}:{g.get('group')}"))
    # their stuff
    for e in _recent(w, cid, 2):
        if (e.get("actors") or [None])[0] != cid:
            continue
        t, o, d = e.get("type"), e.get("outcome"), e.get("data") or {}
        key = f"ev:{e.get('id')}"
        if done(w, cid, key):
            continue
        if t == "game" and o in ("win", "loss") and d.get("level", "varsity") == "varsity":
            box = (d.get("box") or {}).get(cid) or {}
            facts = {"opp": d.get("opponent") or "them", "score": d.get("score") or "",
                     "their_line": _game_line(d.get("sport"), box.get("line")) if box.get("line") else "played"}
            facts["their_line"] = re.sub(r"^(\d)", r"had \1", facts["their_line"])
            out.append((60, "game_theirs_win" if o == "win" else "game_theirs_loss", facts, key))
        elif t == "tryout" and o in ("made", "cut"):
            out.append((75, "their_made" if o == "made" else "their_cut", {"team": d.get("group") or "the team"}, key))
        elif t == "injury" and o == "hurt":
            label = (d.get("label") or "got hurt")
            inj = label if label.startswith(("broke", "tore", "sprained", "got", "hurt", "pulled")) else f"have {label}"
            out.append((78, "their_hurt", {"injury": inj, "weeks": max(1, round((d.get("n") or 7) / 7))}, key))
        elif t == "household" and o == "grounded":
            out.append((55, "their_grounded", {"days": d.get("n") or "a few"}, key))
        elif t == "milestone" and o == "dating":
            other = next((x for x in (e.get("targets") or []) if x in w.chars), None)
            if other and other != me.id:
                out.append((70, "their_dating", {"who": w.chars[other].first}, key))
        elif t == "audition" and o == "lead":
            out.append((70, "their_lead", {"show": d.get("event") or "the show"}, key))
    # a party you were both at (last night)
    for eid in (w.history.by_char.get(me.id) or [])[-30:]:
        e = w.history.events.get(eid)
        if not e or e.get("type") != "party" or e.get("outcome") != "thrown" or not (0 <= w.day - e["day"] <= 1):
            continue
        came = set((e.get("actors") or []) + (e.get("targets") or []))
        if cid in came and me.id in came and not done(w, cid, f"party:{e['id']}"):
            host = w.chars.get((e.get("actors") or [None])[0])
            what = _party_moment(w, e) or "everything"
            out.append((65, "party", {"host": host.first if host else "the", "what": what}, f"party:{e['id']}"))
    # gossip: two people you both know
    gos = _gossip(sim, cid)
    if gos:
        out.append((50, "gossip", gos[0], gos[1]))
    # a quiz soon (same grade: same classes)
    q = _quiz_soon(sim, me, c)
    if q and not done(w, cid, q[1]):
        out.append((40, "quiz", q[0], q[1]))
    # the crew's inside jokes
    from . import squad
    s = squad.state(sim)
    if s and cid in s.get("ids", []) and s.get("jokes"):
        j = s["jokes"][-1]
        key = f"joke:{_h(j)}"
        if not done(w, cid, key):
            out.append((35, "joke", {"joke": j.rstrip(".").lower()}, key))
    out.sort(key=lambda x: -x[0])
    return out


def _party_moment(w, party) -> str | None:
    for e in w.history.events.values():
        if e.get("type") == "party" and e.get("outcome") in ("kiss", "fight", "busted") and abs(e["day"] - party["day"]) <= 1:
            a = w.chars.get((e.get("actors") or [None])[0])
            b = w.chars.get((e.get("targets") or [None])[0]) if e.get("targets") else None
            if e["outcome"] == "kiss" and a and b:
                return f"{a.first} and {b.first} kissing"
            if e["outcome"] == "fight" and a and b:
                return f"{a.first} and {b.first} almost fighting"
            if e["outcome"] == "busted":
                return "the cops showing up"
    return None


GOSSIP = {("falling_out", "friends"): "aren't talking anymore", ("milestone", "dating"): "are dating",
          ("party", "kiss"): "kissed at the party", ("party", "fight"): "got into it at the party", ("confront", "argument"): "got in a huge fight",
          ("milestone", "broke_up"): "broke up"}


def _gossip(sim, cid):
    w = sim.w
    me = _me(sim)
    knows = {o for (a, o), r in w.rels.items() if a == me.id and r.familiarity >= 20}
    best = None
    for eid in list(w.history.events)[-400:]:
        e = w.history.events.get(eid)
        if not e or w.day - e["day"] > 3:
            continue
        what = GOSSIP.get((e.get("type"), e.get("outcome")))
        if not what:
            continue
        a = (e.get("actors") or [None])[0]
        b = (e.get("targets") or [None])[0] if e.get("targets") else None
        if not a or not b or me.id in (a, b) or cid in (a, b) or a not in w.chars or b not in w.chars:
            continue
        if a not in knows and b not in knows:
            continue
        key = f"gossip:{e['id']}"
        if done(w, cid, key):
            continue
        best = ({"a": w.chars[a].first, "b": w.chars[b].first, "gossip": what}, key)
    return best


def _quiz_soon(sim, me, c):
    w = sim.w
    if not (me.grade and c.grade == me.grade and c.role == "student"):
        return None
    for it in w.calendar:
        if it.get("kind") == "exam" and 1 <= it["day"] - w.day <= 2:
            try:
                from . import classes
                ctx = classes.quiz_context(sim, me, it)
            except Exception:  # noqa: BLE001
                return None
            subj = ctx.get("class_name") or "the"
            if ctx.get("class_id") == "all":
                subj = it.get("name") or "the test"
            when = "tomorrow" if it["day"] - w.day == 1 else calm.label(it["day"]).split(",")[0].lower()
            return {"subject": subj, "when": when}, f"quiz:{it.get('id') or it['day']}"
    return None


# ------------------------------------------------------------------------------------------------ a conversation
def build(sim, cid, topic: str, facts: dict, salt) -> dict:
    """Their opener and your four replies (each with a tone and what they'll say back)."""
    T = D()["topics"][topic]
    kw = {**facts, "you_name": your_name(sim, cid)}
    fill = lambda s: re.sub(r"\{(\w+)\}", lambda m: str(kw.get(m.group(1), m.group(0))), s)  # noqa: E731
    opens = T.get(facts.get("_open") or "open") or T["open"]
    text = fill(opens[_h(salt, topic, "open") % len(opens)])
    opts = []
    for i, r in enumerate(T["replies"]):
        say = r["text"][_h(salt, topic, i, "r") % len(r["text"])]
        backs = r.get("back") or [None]
        back = backs[_h(salt, topic, i, "b") % len(backs)]
        opts.append({"label": fill(say), "fx": r["fx"], "tone": r["tone"], "back": fill(back) if back else None})
    # the warm ones first, the dry one last (it's there when you want it)
    return {"text": text, "opts": opts, "topic": topic}


def start(sim, cid, delay_phases=2, only=None) -> bool:
    """This person texts you about the best real thing there is (if there is one). True if they will."""
    from . import messages
    w = sim.w
    c = w.chars.get(cid)
    if c is None or c.status != "active" or c.role not in ("student", "alumni"):
        return False
    tops = [t for t in topics(sim, cid) if not only or t[1] in only]
    if not tops:
        return False
    score, topic, facts, key = tops[0]
    salt = f"{w.day}:{cid}:{key}"
    b = build(sim, cid, topic, facts, salt)
    mark(w, cid, key)
    ctx = {"talk": topic, "key": key}
    if topic.startswith("game_"):  # (the score, on the text)
        ctx["card"] = {"kind": "game", "win": topic.endswith("_win"), "score": facts.get("score"), "opp": facts.get("opp"),
                       "team": facts.get("team") or ""}
    messages.later(sim, cid, "talk", delay_phases=delay_phases, text=b["text"], opts=b["opts"], ctx=ctx)
    return True


def answer(sim, tid, msg, index, fx) -> str | None:
    """You picked a reply to a topic text: what they say back (the line that fits what you said)."""
    opt = (msg.get("replies") or [])[index]
    return opt.get("back")


# ------------------------------------------------------------------------------------------------ awards
def award_congrats(sim, cid, label: str) -> str | None:
    """A friend congratulates you on an award: once per award per season, and a ribbing for a close friend after that."""
    w = sim.w
    yr = calm.school_year_of(w.day)
    key = f"award:{label}:{yr}"
    n = store(w).setdefault("awards", {}).get(label, 0)
    if not done(w, cid, key):
        mark(w, cid, key)
        return "award"
    me = _me(sim)
    r = w.rels.get((cid, me.id)) if me else None
    if r and r.affection >= 60 and n >= 3 and _h(w.day, cid, label) % 4 == 0:
        return "award_again"
    return None


def note_award(w, label):
    a = store(w).setdefault("awards", {})
    a[label] = a.get(label, 0) + 1
    return a[label]
