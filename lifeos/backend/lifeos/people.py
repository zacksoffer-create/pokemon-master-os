"""The Scene tab's People and Yearbook: the world in numbers.

- directory: everyone at your school with their numbers (rank, popularity, group, teams and level, their best sport
  and rating, GPA, how they feel about you and you about them), for sorting and filtering on the phone;
- profile: one person in full (personality, talents, skills, interests, reputation, teams and this season's line, their
  people, rumors about them you've heard, superlatives they hold, and both sides of how you two feel);
- yearbook: this season so far (superlatives, the top of the rankings, you, your teams, the big moments) and every
  finished season's page (saved at its season break).
"""
from __future__ import annotations

from . import ladder, scene, seasons, sports


def _me(sim):
    w = sim.w
    return w.chars.get(w.meta.get("protagonist") or "")


def _clique_of(w) -> dict:
    out = {}
    for q in (w.cliques or {}).values():
        if q.get("active"):
            for m in q.get("members") or []:
                out.setdefault(m, q.get("name"))
    return out


def _teams(w, c) -> list:
    out = []
    for gid in c.memberships:
        g = w.groups.get(gid) or {}
        if g.get("kind") != "team":
            continue
        sk = g.get("skill")
        out.append({"sport": sk, "team": g.get("name"), "level": (g.get("levels") or {}).get(c.id, "varsity"),
                    "pos": (c.positions or {}).get(sk), "group": gid})
    return out


def _best_sport(c) -> tuple:
    rated = [(s, sports.rating(c, s)) for s in sports.SPORTS if (c.skills or {}).get(s, 0) > 0]
    if not rated:
        return None, None
    s, r = max(rated, key=lambda x: x[1])
    return s, round(r)


def _aff(w, a, b):
    r = w.rels.get((a, b))
    return round(r.affection) if r else None


def directory(sim) -> dict:
    w = sim.w
    me = _me(sim)
    if me is None:
        return {"rows": []}
    ranked = ladder._ranked(sim, me)
    rank_of = {c.id: i + 1 for i, c in enumerate(ranked)}
    cliq = _clique_of(w)
    fam = set(sim.siblings(me.id))
    cast = ladder._cast_people(sim)
    rows = []
    for c in sorted(scene.students(sim, me), key=lambda c: rank_of.get(c.id, 999)):
        sport, rating = _best_sport(c)
        rows.append({**scene._mini(w, c.id), "grade": c.grade, "rank": rank_of.get(c.id), "pop": round(c.popularity),
                     "group": cliq.get(c.id), "teams": _teams(w, c), "sport": sport, "rating": rating, "gpa": round(c.gpa, 2),
                     "likes_you": _aff(w, c.id, me.id) if c.id != me.id else None, "you_like": _aff(w, me.id, c.id) if c.id != me.id else None,
                     "tags": ladder._tags(sim, me, c.id, fam, cast) if c.id != me.id else [], "me": c.id == me.id,
                     "gender": c.gender})
    return {"rows": rows, "of": len(ranked), "groups": sorted({r["group"] for r in rows if r["group"]})}


def profile(sim, cid: str) -> dict:
    from .editor import _rel_view
    from .gameplay import line_words
    w = sim.w
    me = _me(sim)
    c = w.chars.get(cid)
    if c is None or me is None:
        raise KeyError(cid)
    d = next((r for r in directory(sim)["rows"] if r["id"] == cid), None) or {  # (a graduate, someone at Watch Hill, a teacher)
        **scene._mini(w, cid), "grade": c.grade, "rank": None, "pop": round(c.popularity), "gpa": round(c.gpa, 2), "group": None,
        "sport": None, "rating": None, "likes_you": None, "you_like": None, "tags": [], "me": cid == me.id, "gender": c.gender,
        "teams": []}
    r2 = lambda m: {k: round(v) for k, v in sorted((m or {}).items(), key=lambda kv: -kv[1])}  # noqa: E731
    thr = w.rules["rel.friend_threshold"]
    people = sorted(((o, r.affection) for (a, o), r in w.rels.items() if a == cid and o in w.chars and o != me.id
                     and w.chars[o].status == "active" and r.affection >= thr), key=lambda x: -x[1])[:5]
    partner = c.flags.get("partner")
    crush = next((o for (a, o), r in w.rels.items() if a == cid and getattr(r, "crush", False) and o in w.chars), None)
    heard = [r_.get("text") for r_ in (w.rumors or {}).values()
             if r_.get("about") == cid and me.id in (r_.get("known_by") or {}) and r_.get("text")][:4]
    lines = []
    yr = sports.calm.school_year_of(w.day)
    for key, st in sorted((c.stats or {}).items()):
        if not isinstance(st, dict) or st.get("school") == "college":
            continue
        try:
            y = int(key.split(":")[1][:4]) - sports.calm.START.year
        except Exception:  # noqa: BLE001
            continue
        if y == yr and st.get("games"):
            lines.append({"team": st.get("team_name"), "level": st.get("level"), "games": st.get("games"),
                          "record": f"{st.get('wins', 0)}-{st.get('losses', 0)}", "line": line_words(st.get("sport"), st.get("line") or {})})
    holds = [s["label"] for s in ladder.superlatives(sim, me, ladder._ranked(sim, me)) if (s.get("winner") or {}).get("id") == cid
             or (s.get("partner") or {}).get("id") == cid]
    return {**d, "bio": c.bio, "age": c.age(w.day), "jersey": c.jersey or None, "body": dict(c.body or {}),
            "traits": r2(c.traits), "aptitudes": r2(c.aptitudes), "skills": r2({k: v for k, v in (c.skills or {}).items() if v > 0}),
            "interests": dict(list(r2(c.interests).items())[:6]), "reputation": dict(list(r2(c.reputation).items())[:5]),
            "with_you": None if cid == me.id else {"they": _rel_view(w.rels.get((cid, me.id))), "you": _rel_view(w.rels.get((me.id, cid)))},
            "people": [{**scene._mini(w, o), "affection": round(a)} for o, a in people],
            "partner": scene._mini(w, partner) if partner in w.chars else None,
            "crush": scene._mini(w, crush) if crush and crush != partner else None,
            "rumors": heard, "season": lines, "superlatives": holds}


def page(sim, me) -> dict:
    """A yearbook page for right now: superlatives, the top ten, where you stand."""
    w = sim.w
    ranked = ladder._ranked(sim, me)
    rank_of = {c.id: i + 1 for i, c in enumerate(ranked)}
    sup = [{"label": s["label"], "winner": (s.get("winner") or {}).get("name"), "winner_id": (s.get("winner") or {}).get("id"),
            "partner": (s.get("partner") or {}).get("name"), "you": s.get("you")} for s in ladder.superlatives(sim, me, ranked)]
    return {"superlatives": sup, "top": [{**scene._mini(w, c.id), "rank": i + 1, "pop": round(c.popularity)} for i, c in enumerate(ranked[:10])],
            "you": {"rank": rank_of.get(me.id), "of": len(ranked)}}


def yearbook(sim) -> dict:
    w = sim.w
    me = _me(sim)
    if me is None:
        return {"now": None, "past": []}
    sid = w.meta.get("season") or seasons.season_id(w.day)
    start, _ = seasons.bounds(sid)
    rep = seasons.season_report(sim, start, w.day)
    now = {"id": sid, "label": seasons.label(w, sid), **page(sim, me), "teams": rep["teams"], "moments": rep["moments"],
           "played": rep["played"]}
    past = [{"id": k, **v} for k, v in sorted((w.meta.get("seasons") or {}).items(), key=lambda kv: kv[0], reverse=True)]
    return {"now": now, "past": past}
