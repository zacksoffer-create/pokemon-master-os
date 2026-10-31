"""Second person for the phone: "Zack sat with Danny at lunch" becomes "You sat with Danny at lunch".

Event text is written in the third person so the lab can read it about anyone. On the phone, the
story is yours, so lines about the protagonist are rewritten. This is presentation only.
"""
from __future__ import annotations

import re

VERB_FIX = {"was": "were", "is": "are", "has": "have", "does": "do", "wasn't": "weren't", "isn't": "aren't",
            "hasn't": "haven't", "doesn't": "don't", "plans": "plan", "wants": "want", "gets": "get", "makes": "make",
            "takes": "take", "feels": "feel", "needs": "need", "says": "say", "thinks": "think", "goes": "go", "knows": "know",
            "likes": "like", "loves": "love", "starts": "start", "keeps": "keep", "considers": "consider", "reports": "report",
            "finished": "finished", "seems": "seem", "looks": "look", "gives": "give", "tries": "try", "hopes": "hope"}


def second_person(text: str, c, solo: bool = False) -> str:
    """Rewrite references to character c as 'you'. solo=True also rewrites they/their (no one else in the line)."""
    if not text or c is None:
        return text
    names = sorted({c.name, c.first, getattr(c, "short", c.first)}, key=len, reverse=True)
    pat = "|".join(re.escape(n) for n in names if n)
    if not pat:
        return text
    out = re.sub(rf"\b(?:{pat})'s\b", "your", text)
    out = re.sub(rf"\b(?:{pat})\b", "you", out)
    if solo:
        out = re.sub(r"\bthemselves\b", "yourself", out)
        out = re.sub(r"\btheir\b", "your", out)
        out = re.sub(r"\bthey\b", "you", out)
        out = re.sub(r"\bthem\b", "you", out)
    # verb agreement right after "you"
    out = re.sub(r"\byou (\w+(?:n't)?)\b", lambda m: "you " + VERB_FIX.get(m.group(1), m.group(1)), out)
    out = re.sub(r"\byou and (\w+) (was|is|has)\b", lambda m: f"you and {m.group(1)} " + {"was": "were", "is": "are", "has": "have"}[m.group(2)], out)
    # sentence starts
    out = re.sub(r"(^|[.!?]\s+|\"\s*)you\b", lambda m: m.group(1) + "You", out)
    out = re.sub(r"(^|[.!?]\s+)your\b", lambda m: m.group(1) + "Your", out)
    out = out.replace("you yourself", "you")
    return out


def event_line(w, ev, pid) -> str:
    c = w.chars.get(pid)
    text = ev.get("text") or ""
    others = [x for x in (ev.get("actors") or []) + (ev.get("targets") or []) if x != pid]
    return second_person(text, c, solo=not others)
