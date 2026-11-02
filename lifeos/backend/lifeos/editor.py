"""The editor: change anyone, and anything between any two people.

For setting a story up the way you want it (or fixing it later). On the phone it's a switch on the Me tab (on to start):
every person gets an Edit button, and the editor lists everyone in your world. For a person you can change their name,
bio and look, their personality, talents, what drives them, skills, interests, and how they're doing right now (mood,
energy, stress, popularity, money, GPA). For any two people you can set how each feels about the other (closeness,
attraction, trust, respect, rivalry, how well they know each other) or pick a preset (friends, best friends, a crush,
dating, exes, rivals...). Dating is real: it ends whoever they were with before.

Edits are quiet: no texts, no "you became friends" news, nothing in your feed. Labels and crushes just update to match.
Each save is one small event in the lab's history, so you can see what was changed.
"""
from __future__ import annotations

from .catalogs import APTITUDES, MOTIVES, NEEDS, TRAITS
from .history import Effects
from .model import REL_FIELDS
from .rng import clamp

REL_LABELS = {"affection": "Closeness", "attraction": "Attraction", "trust": "Trust", "respect": "Respect", "rivalry": "Rivalry",
              "familiarity": "Know each other", "perceived": "Think the other likes them"}
REL_ORDER = ["affection", "attraction", "trust", "respect", "rivalry", "familiarity"]
PRESETS = [("strangers", "Strangers"), ("acquaintance", "Know each other"), ("friend", "Friends"), ("close_friend", "Close friends"),
           ("best_friend", "Best friends"), ("crush", "{a} has a crush"), ("admirer", "{b} has a crush"), ("mutual_crush", "Like each other"),
           ("dating", "Dating"), ("ex", "Exes"), ("rival", "Rivals"), ("enemy", "Can't stand each other"), ("mentor", "{a} looks up to {b}")]
SCALARS = {"mood": (0, 100), "popularity": (0, 100), "money": (0, 100000), "gpa": (0, 4)}


class EditorError(ValueError):
    pass


def on(w) -> bool:
    from .moments import control
    return bool(control(w).get("editor", True))


def _mini(w, cid) -> dict:
    from .appearance import look_of
    c = w.chars[cid]
    return {"id": c.id, "name": c.name, "first": c.first, "color": c.color, "look": look_of(c), "year": c.year_label, "role": c.role}


def schema(sim) -> dict:
    """What can be edited, with labels (the phone uses its own words for personality and drives)."""
    cat = sim.cat
    return {"traits": TRAITS, "aptitudes": APTITUDES, "motives": MOTIVES, "needs": NEEDS,
            "skills": [{"id": k, "label": v["label"]} for k, v in cat.skills.items()],
            "interests": [{"id": k, "label": v["label"]} for k, v in cat.skills.items()] +
                         [{"id": k, "label": v["label"][0].upper() + v["label"][1:]} for k, v in cat.hobbies.items()],
            "rel_fields": [{"id": f, "label": REL_LABELS[f], "min": REL_FIELDS[f][0], "max": REL_FIELDS[f][1]} for f in REL_ORDER],
            "crush_at": sim.w.rules["rel.crush_threshold"], "friend_at": sim.w.rules["rel.friend_threshold"],
            "scalars": {k: list(v) for k, v in SCALARS.items()}}


def people(sim) -> list:
    """Everyone in the world, closest to you first, then your grade, then everyone else."""
    w = sim.w
    me = w.meta.get("protagonist")
    sibs = set(sim.siblings(me)) if me else set()
    out = []
    for c in w.chars.values():
        if c.status not in ("active",) and c.id != me:
            continue
        r = w.rels.get((me, c.id)) if me else None
        same_home = bool(c.household_id and me and c.household_id == w.chars[me].household_id)
        out.append({**_mini(w, c.id), "grade": c.grade, "me": c.id == me, "family": c.id in sibs or same_home,
                    "known": bool(r and r.familiarity > 0), "label": r.label if r else None,
                    "close": round((r.affection + r.familiarity) if r else -999, 1)})
    mg = w.chars[me].grade if me else None
    out.sort(key=lambda x: (not x["me"], not x["family"], not x["known"], -x["close"] if x["known"] else 0, x["grade"] != mg, x["name"]))
    return out


def _rel_view(r) -> dict | None:
    if r is None:
        return None
    return {**{f: round(getattr(r, f), 1) for f in REL_ORDER + ["perceived"]}, "label": r.label, "crush": r.crush}


def person(sim, cid) -> dict:
    w = sim.w
    c = w.chars.get(cid)
    if c is None:
        raise EditorError("no such person")
    me = w.meta.get("protagonist")
    rels = []
    for o, r in w.out.get(cid, {}).items():
        if o not in w.chars or w.chars[o].status != "active":
            continue
        back = w.rels.get((o, cid))
        bond = w.bond(cid, o)
        rels.append({**_mini(w, o), "roles": (bond or {}).get("roles", []), "ab": _rel_view(r), "ba": _rel_view(back),
                     "score": abs(r.affection) + r.familiarity + (200 if bond and bond.get("roles") else 0) + (300 if o == me else 0)})
    rels.sort(key=lambda x: -x["score"])
    return {**_mini(w, cid), "last": c.last, "bio": c.bio, "gender": c.gender, "grade": c.grade, "is_me": cid == me,
            "look_locked": dict(c.look or {}), "traits": _round(c.traits), "aptitudes": _round(c.aptitudes), "motives": _round(c.motives),
            "skills": _round(c.skills), "interests": _round(c.interests), "needs": _round(c.needs),
            "mood": round(c.mood, 1), "popularity": round(c.popularity, 1), "money": round(c.money, 2), "gpa": round(c.gpa, 2),
            "student": c.role in ("student", "alumni"), "partner": c.flags.get("partner"),
            "with_me": None if cid == me or not me else {"ab": _rel_view(w.rels.get((me, cid))), "ba": _rel_view(w.rels.get((cid, me)))},
            "rels": rels[:24]}


def _round(d: dict) -> dict:
    return {k: round(v, 1) for k, v in d.items()}


def _num(v, lo, hi, what, errors):
    try:
        x = float(v)
    except (TypeError, ValueError):
        errors.append(f"{what} must be a number")
        return None
    if not lo <= x <= hi:
        errors.append(f"{what} must be between {lo:g} and {hi:g}")
        return None
    return x


def _event(sim, actors, label):
    ev = sim.new_event("lab", "edit", actors, [], 3, {"label": label, "by": "editor"})
    ev["text"] = label
    return ev


def save_person(sim, cid, body: dict) -> dict:
    """Apply a batch of changes to one person. Everything is checked first; nothing changes if anything's wrong."""
    from . import appearance
    w = sim.w
    c = w.chars.get(cid)
    if c is None:
        raise EditorError("no such person")
    errors, plan = [], []
    allowed = {"traits": TRAITS, "aptitudes": APTITUDES, "motives": MOTIVES, "needs": NEEDS, "skills": list(sim.cat.skills),
               "interests": list(sim.cat.skills) + list(sim.cat.hobbies)}
    for key, val in body.items():
        if key in allowed:
            if not isinstance(val, dict):
                errors.append(f"{key} must be an object")
                continue
            for k, v in val.items():
                if k not in allowed[key]:
                    errors.append(f"{key}.{k} isn't something people have")
                    continue
                x = _num(v, 0, 100, f"{key}.{k}", errors)
                if x is not None:
                    plan.append((key, k, x))
        elif key in SCALARS:
            lo, hi = SCALARS[key]
            x = _num(val, lo, hi, key, errors)
            if x is not None:
                plan.append((key, None, x))
        elif key in ("first", "last"):
            if not isinstance(val, str) or not val.strip() or len(val.strip()) > 40:
                errors.append(f"{key} name must be 1 to 40 characters")
            else:
                plan.append((key, None, val.strip()))
        elif key == "bio":
            if not isinstance(val, str) or len(val) > 500:
                errors.append("bio must be text under 500 characters")
            else:
                plan.append((key, None, val.strip()))
        elif key == "look":
            if val in (None, {}):
                plan.append(("look", None, {}))
            else:
                appearance.validate(val, "look", errors)
                plan.append(("look", None, dict(val)))
        else:
            errors.append(f"{key} can't be edited here")
    if errors:
        raise EditorError("; ".join(errors))
    if not plan:
        return person(sim, cid)
    ev = _event(sim, [cid], f"Editor: changed {c.name} ({', '.join(sorted({k for k, _, _ in plan}))})")
    fx = Effects(w, ev)
    for key, k, v in plan:
        if k is not None:
            before = getattr(c, key).get(k, 0.0)
            if abs(v - before) > 1e-9:
                fx.attr(cid, key, k, v - before, "editor")
            if key == "traits" and k == "confidence":
                c.flags["confidence_base"] = v
        elif key in ("first", "last", "bio", "look"):
            if w.tracing:
                ev["changes"].append([cid, key, getattr(c, key), v, "editor"])
            setattr(c, key, v)
        else:
            fx.scalar(cid, key, v, "editor")
    ev["text"] = ev["data"]["label"] = f"Editor: changed {c.name} ({', '.join(sorted({k for k, _, _ in plan}))})"  # the new name, if it changed
    sim.finish(ev, fx)
    return person(sim, cid)


def pair(sim, a, b) -> dict:
    w = sim.w
    if a not in w.chars or b not in w.chars or a == b:
        raise EditorError("pick two different people")
    bond = w.bond(a, b) or {}
    return {"a": _mini(w, a), "b": _mini(w, b), "ab": _rel_view(w.rels.get((a, b))), "ba": _rel_view(w.rels.get((b, a))),
            "roles": bond.get("roles", []), "dating": w.chars[a].flags.get("partner") == b,
            "presets": [{"id": p, "label": lbl.format(a=w.chars[a].first, b=w.chars[b].first)} for p, lbl in PRESETS]}


def _settle(sim, a, b):
    """Labels and crushes follow the numbers, quietly (no news, no texts)."""
    from . import social
    from .worldgen import orientation_ok
    w, R = sim.w, sim.w.rules
    for x, y in ((a, b), (b, a)):
        r = w.rels.get((x, y))
        if r is None:
            continue
        X, Y = w.chars[x], w.chars[y]
        if r.attraction >= R["rel.crush_threshold"] and not orientation_ok(X, Y):
            X.attracted_to = sorted(set(X.attracted_to) | {Y.gender})  # you said they're into them: they are
        r.peak_affection = max(r.peak_affection, r.affection)
        r.label = social.label_for(r, R)
        r.crush = bool(R["romance.enabled"] and r.attraction >= R["rel.crush_threshold"] and orientation_ok(X, Y)
                       and X.role == "student" and Y.role == "student")


def save_pair(sim, a, b, body: dict) -> dict:
    """Set how two people feel about each other: a preset, numbers for either direction, or both (numbers win)."""
    from .actions import end_relationship
    from .story import REL_PRESETS, apply_relationship
    w = sim.w
    if a not in w.chars or b not in w.chars or a == b:
        raise EditorError("pick two different people")
    errors, sets = [], []
    preset = body.get("preset")
    if preset is not None and preset not in {p for p, _ in PRESETS}:
        errors.append(f"'{preset}' isn't a preset")
    for side, (x, y) in (("ab", (a, b)), ("ba", (b, a))):
        vals = body.get(side) or {}
        if not isinstance(vals, dict):
            errors.append(f"{side} must be an object")
            continue
        for f, v in vals.items():
            if f not in REL_FIELDS:
                errors.append(f"{f} isn't part of a relationship")
                continue
            lo, hi = REL_FIELDS[f]
            n = _num(v, lo, hi, REL_LABELS.get(f, f), errors)
            if n is not None:
                sets.append((x, y, f, n))
    if errors:
        raise EditorError("; ".join(errors))
    A, B = w.chars[a], w.chars[b]
    ev = _event(sim, [a, b], f"Editor: {A.name} and {B.name}" + (f" set to {dict(PRESETS)[preset].format(a=A.first, b=B.first).lower()}" if preset else ""))
    fx = Effects(w, ev)
    dating = A.flags.get("partner") == b
    if preset:
        if preset == "dating" and not dating:
            for x in (a, b):  # whoever they were with before, it's over
                old = w.chars[x].flags.get("partner")
                if old and old in w.chars:
                    end_relationship(sim, x, old, ev, fx, reason="the editor")
        elif preset != "dating" and dating:
            end_relationship(sim, a, b, ev, fx, reason="the editor")
            if preset != "ex":
                bd = w.bond(a, b)
                if bd and "ex" in bd["roles"]:
                    bd["roles"].remove("ex")
        if preset == "strangers":
            for x, y in ((a, b), (b, a)):
                r = w.ensure_rel(x, y, w.day)
                for f in REL_FIELDS:
                    setattr(r, f, 30.0 if f == "trust" else 0.0)
        else:
            apply_relationship(w, a, b, preset, day=w.day)
            for x, y in ((a, b), (b, a)):  # presets describe history, not today's last contact
                r = w.rels[(x, y)]
                r.last_day = max(r.last_day, w.day)
    for x, y, f, n in sets:
        r = w.ensure_rel(x, y, w.day)
        if w.tracing:
            ev["changes"].append([f"{x}>{y}", f, getattr(r, f), n, "editor"])
        setattr(r, f, n)
    _settle(sim, a, b)
    sim.finish(ev, fx)
    me = w.meta.get("protagonist")
    if me in (a, b) and w.meta.get("squad"):
        w.meta["squad"]["updated"] = -99  # your group re-forms around who your friends are now
    return pair(sim, a, b)
