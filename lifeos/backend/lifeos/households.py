"""Households: guardians are household-level actors (not autonomous agents in v0.1).

Each household has a parenting style (warmth, strictness, expectations, permissiveness) and
an income level. They react to report cards and to trouble, pay allowance, occasionally go
away for a weekend (which is when parties happen), and check in when a kid is struggling.
Every reaction is computed from those numbers and recorded with its calculation.
"""
from __future__ import annotations

from .history import Effects
from .rng import clamp, sigmoid

ALLOWANCE = {"low": 4, "middle": 10, "high": 22}


def guardians_label(h) -> str:
    gs = h["guardians"]
    if len(gs) == 1:
        return gs[0]
    return f"{gs[0].split()[0]} and {gs[1].split()[0]}"


def weekly(sim, rng):
    w, R = sim.w, sim.w.rules
    week = w.day // 7
    for hid in sorted(w.households):
        h = w.households[hid]
        kids = [w.chars[m] for m in h["members"] if m in w.chars and w.chars[m].status == "active" and w.chars[m].role == "student"
                and w.chars[m].school == "hchs"]
        if not kids:
            continue
        h["away_weekend"] = week + 1 if rng.random() < h["permissive"] * 0.5 else None
        fx = Effects(w, None)
        for c in kids:
            fx.money(c.id, ALLOWANCE[h["income"]] * R["inst.allowance_scale"], "allowance")
            if c.needs["stress"] >= 70 or c.mood <= 30:
                p = h["warmth"] / 150
                roll = rng.random()
                if roll < p:
                    ev = sim.new_event("household", "support", [c.id], [], 14, {"label": guardians_label(h)})
                    ev["calc"] = [{"step": "guardians notice", "terms": [["warmth", h["warmth"]]], "p": round(p, 3),
                                   "roll": round(roll, 4), "rule": "P = warmth / 150 when stress >= 70 or mood <= 30"}] if w.tracing else None
                    f2 = Effects(w, ev)
                    f2.need(c.id, "stress", -12, "family support")
                    f2.mood(c.id, 6, "family support")
                    f2.memory(c.id, "family_support", [], 0.4, 35, f"{guardians_label(h)} were there when it got hard")
                    sim.finish(ev, f2)


def parents_find_out(sim, payload, cause_id, rng):
    w, R = sim.w, sim.w.rules
    c = w.chars.get(payload["char"])
    if c is None or c.status != "active" or c.role != "student":
        return
    h = w.households.get(c.household_id)
    if not h:
        return
    s = h["strictness"] / 100 * R["inst.parent_strictness"]
    terms = [["strictness x rules", round(s, 3)], ["warmth", h["warmth"]]]
    p_ground = clamp(0.1 + s * 0.4, 0, 0.6)  # (a few days, sometimes: parents, not a parole board)
    roll = rng.random()
    if roll < p_ground:
        days = int(round(2 + s * 3))
        ev = sim.new_event("household", "grounded", [c.id], [], 26, {"label": guardians_label(h), "n": days,
                                                                     "what": payload.get("what")})
        fx = Effects(w, ev)
        fx.flag(c.id, "grounded_until", max(c.flags.get("grounded_until", -1), w.day + days), f"found out about {payload.get('what')}")
        fx.need(c.id, "stress", 8, "grounded")
        fx.mood(c.id, -6, "grounded")
        fx.memory(c.id, "grounded", [], -0.45, 45, f"Grounded for {payload.get('what')}")
        _grounded_card(sim, c, h, f"they found out about {payload.get('what')}")
    else:
        ev = sim.new_event("household", "argument", [c.id], [], 16, {"label": guardians_label(h), "what": payload.get("what")})
        fx = Effects(w, ev)
        fx.need(c.id, "stress", 6, "argument at home")
        fx.mood(c.id, -4, "argument at home")
    ev["causes"] = [cause_id] if cause_id else []
    ev["calc"] = [{"step": f"{guardians_label(h)} react to {payload.get('what')}", "terms": terms, "p_grounded": round(p_ground, 3),
                   "roll": round(roll, 4), "rule": "P(grounded) = 0.15 + 0.7 x strictness x parental strictness"}] if w.tracing else None
    sim.finish(ev, fx)


def report_card_reaction(sim, c, it, rng):
    w, R = sim.w, sim.w.rules
    h = w.households.get(c.household_id)
    if not h:
        return
    standard = 2.1 + h["expectations"] / 100 * 1.8
    diff = c.gpa - standard
    s = h["strictness"] / 100 * R["inst.parent_strictness"]
    last = c.flags.get("last_card_gpa")
    c.flags["last_card_gpa"] = round(c.gpa, 2)
    drop = (last - c.gpa) if last is not None else 0.0
    terms = [["GPA", round(c.gpa, 2)], ["household standard", round(standard, 2)], ["since the last card", round(-drop, 2)],
             ["strictness x rules", round(s, 3)], ["warmth", h["warmth"]]]
    roll = rng.random()
    # grounded only for a real drop (0.3 or more since the last card) or a GPA under 2.0, and once a semester at most:
    # a kid who's always been a 2.5 student isn't grounded for being one
    real = drop >= 0.3 or c.gpa < 2.0
    recent = w.day - c.flags.get("card_grounded_day", -999) < 120
    if diff <= -0.35 or real:
        p_ground = clamp(sigmoid((max(drop, 2.0 - c.gpa, 0) * 4) - 0.5) * s, 0, 0.9) if real and not recent else 0.0
        if roll < p_ground:
            outcome, imp = "grounded", 26
        elif s > 0.45:
            outcome, imp = "pressure", 16
        elif h["warmth"] >= 60:
            outcome, imp = "support", 12
        else:
            return
        p = p_ground
    elif diff >= 0.25:
        outcome, imp, p = "proud", 12, None
    else:
        return
    days = int(round(3 + s * 2))
    ev = sim.new_event("household", outcome, [c.id], [], imp, {"label": guardians_label(h), "n": days, "event": it["name"]})
    ev["calc"] = [{"step": f"{guardians_label(h)} read the report card", "terms": terms, "gap": round(diff, 2),
                   "p_grounded": round(p, 3) if p is not None else None, "roll": round(roll, 4), "outcome": outcome,
                   "rule": "below standard by 0.35+: grounded with P = sigmoid(3 x (gap - 0.6)) x strictness, else pressure (strict) or support (warm); above by 0.25+: proud"}] if w.tracing else None
    fx = Effects(w, ev)
    if outcome == "grounded":
        fx.flag(c.id, "grounded_until", max(c.flags.get("grounded_until", -1), w.day + days), "report card")
        fx.flag(c.id, "pressure_until", w.day + 21, "report card")
        fx.need(c.id, "stress", 10, "grounded over grades")
        fx.mood(c.id, -6, "grounded over grades")
        fx.memory(c.id, "grounded", [], -0.5, 50, "Grounded over a report card")
        fx.flag(c.id, "card_grounded_day", w.day, "report card")
        _grounded_card(sim, c, h, f"your GPA went from {last:.2f} to {c.gpa:.2f}" if last is not None and drop >= 0.3
                       else f"a {c.gpa:.2f} GPA")
    elif outcome == "pressure":
        fx.flag(c.id, "pressure_until", w.day + 21, "report card")
        fx.need(c.id, "stress", 7, "pressure about grades")
    elif outcome == "support":
        fx.need(c.id, "stress", -6, "family support")
    elif outcome == "proud":
        fx.mood(c.id, 7, "proud family")
        sim.confidence(c.id, 1.0, fx, "good report card")
        c.achievements.append({"day": w.day, "label": f"Strong report card ({c.gpa:.2f})", "event": None})
    sim.finish(ev, fx)


def _grounded_card(sim, c, h, why):
    """You're grounded: a card that says why and until when, and what you can do about it."""
    w = sim.w
    c.flags["grounded_why"] = why
    if c.id == w.meta.get("protagonist"):
        from . import calendar as calm
        sim.moment_trigger("grounded", c.id, {"guardians": guardians_label(h), "why": why,
                                              "until": calm.label(c.flags.get("grounded_until", w.day))})


def grounding_view(w, c) -> dict | None:
    """For the phone: grounded until when, and why (or None)."""
    from . import calendar as calm
    g = c.flags.get("grounded_until")
    if g is None or g < w.day:
        return None
    return {"until": calm.label(g), "days": g - w.day + 1, "why": c.flags.get("grounded_why") or ""}
