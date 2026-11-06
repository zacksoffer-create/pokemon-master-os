"""Lunch is a routine: everyone has a table, and that's where they sit, every school day.

- The first lunch of a school year, the groups (the cliques) sit together, and a big one (more than a table seats)
  spills onto a second table beside it ("the Friday Night Crew, table 2 of 2"). Anyone not in a group sits with the
  table where their friends are, or at a table of their year. Nobody eats alone by routine.
- A table sticks. Once a week (after the groups) people only move if they've drifted from their table and have
  somewhere clearly better to go; a group changing its name or losing a couple of people moves nobody. New students
  find a table the same way. A new school year starts fresh.
- Every school day everyone at school sits at their table (studying through lunch or eating alone are the exceptions).
  Now and then someone spends the day at a friend's other table (a visit), and only newcomers and visitors can be
  frozen out. You, on the routine (auto lunch, the default), just sit at your table.
- You set your table, not a person (Scene → Crowd → The cafeteria: "Sit here from now on"); otherwise you sit with
  your group.
- Lunch is where relationships drift: each table, a handful of small exchanges a day (more for people who get on), and
  now and then a little something happens at it: an inside joke, someone takes a shot at someone, someone catches
  someone looking. Small steps, so nothing swings wildly; over a year, tablemates become close. Your character never
  starts something on autopilot (that's yours to do).
"""
from __future__ import annotations

import math

SEATS = 8
NEW_DAYS = 10  # a newcomer at a table (yours, or a move) for this long: the table can still freeze them out
DRIFT_BIG = 25  # move when another table is this much closer (average two-way affection) than your own
DRIFT_SMALL = 12  # or this much, once your own table has gone cold on you (under 5)
VISIT_P = 0.12  # on a given day, the chance someone who'd like to sit with a friend at another table actually goes
JOKES = ["the cafeteria pizza", "the vending machine that eats quarters", "the lunch lady's 'one cookie' rule",
         "the guy who microwaves fish every day", "Mr. Davis's tie collection", "the mystery meat Tuesday",
         "who'd survive a zombie apocalypse", "the worst song on the morning announcements", "the chocolate milk shortage",
         "a teacher's catchphrase", "the broken clock that's always 2:15", "the seagull outside the window"]


def store(w) -> dict:
    return w.meta.setdefault("lunch", {"tables": {}, "home": {}, "since": {}, "mine": None, "made": None})


def _students(w, school="hchs") -> list:
    return sorted((c for c in w.chars.values() if c.role == "student" and c.status == "active" and c.school == school),
                  key=lambda c: c.id)


def _aff(w, a, b) -> float:
    r = w.rels.get((a, b))
    return r.affection if r else 0.0


def _closeness(w, cid, members) -> float:
    others = [m for m in members if m != cid]
    if not others:
        return 0.0
    return sum(_aff(w, cid, m) + _aff(w, m, cid) for m in others) / (2 * len(others))


def _cliques(w) -> dict:
    out = {}
    for qid, q in sorted((w.cliques or {}).items()):
        if q.get("active"):
            for m in q.get("members") or []:
                out.setdefault(m, qid)
    return out


def rebuild(sim):
    """Seat everyone: weekly, after the groups; and the first time lunch comes. A table is a routine, so it sticks:
    people stay where they sit unless they've drifted from that table and have somewhere clearly better (a group
    changing its name or losing a couple of people moves nobody). New people sit with their group, then their friends,
    then their year."""
    w = sim.w
    st = store(w)
    me_id = w.meta.get("protagonist")
    me = w.chars.get(me_id or "")
    school = me.school if me is not None and me.school else "hchs"
    studs = {c.id: c for c in _students(w, school)}
    clq = _cliques(w)
    from . import calendar as calm
    yr = calm.school_year_of(w.day)
    if st.get("year") is not None and st["year"] != yr:  # a new school year: new lunch, everyone finds a table again
        st.update({"tables": {}, "home": {}, "since": {}, "mine": None})
    st["year"] = yr
    old_home = dict(st.get("home") or {})
    tables = {tid: {**t, "members": [m for m in t["members"] if m in studs]} for tid, t in (st.get("tables") or {}).items()}
    home = {m: tid for tid, t in tables.items() for m in t["members"]}
    mine = st.get("mine")
    if mine and mine not in tables:
        mine = st["mine"] = None

    def new_table(group=None):
        st["next"] = st.get("next", 0) + 1
        tid = f"t{st['next']}"
        tables[tid] = {"id": tid, "group": group, "name": "a table", "side": 0, "of": 1, "members": []}
        return tables[tid]

    def move(cid, t):
        if cid in home:
            tables[home[cid]]["members"].remove(cid)
        t["members"].append(cid)
        home[cid] = t["id"]

    def room(t):
        return len(t["members"]) < SEATS

    def place(cid):
        """Somewhere for someone with no table: their group's table (or one beside it when it's full), then the table
        with their friends, then a table of their year."""
        q = clq.get(cid)
        if q:
            mates = set((w.cliques[q].get("members") or [])) - {cid}
            at = sorted(((t, sum(1 for m in t["members"] if m in mates)) for t in tables.values()), key=lambda x: (-x[1], x[0]["id"]))
            at = [x for x in at if x[1] >= 1]
            open_ = [t for t, n in at if room(t)]
            if open_:  # where most of the group sits (then who you're closest to there)
                n_of = {t["id"]: n for t, n in at}
                return move(cid, max(open_, key=lambda t: (n_of[t["id"]], _closeness(w, cid, t["members"]), t["id"])))
            if len(mates) >= 1:
                return move(cid, new_table(q))  # the group's spilled onto another table
        cands = [(t, _closeness(w, cid, t["members"])) for t in tables.values() if t["members"] and room(t)]
        cands = [x for x in cands if x[1] >= 15]
        if cands:
            return move(cid, max(cands, key=lambda x: (x[1], x[0]["id"]))[0])
        g = studs[cid].grade
        for t in sorted(tables.values(), key=lambda t: t["id"]):
            if t["members"] and room(t) and not any(clq.get(m) for m in t["members"]) and all(studs[m].grade == g for m in t["members"]):
                return move(cid, t)
        move(cid, new_table())

    # 1. who's drifted from their table and has somewhere clearly better to go
    for cid in sorted(home, key=lambda x: (-studs[x].popularity, x)):
        if cid == me_id and mine:
            continue
        t = tables[home[cid]]
        stay = _closeness(w, cid, t["members"])
        cands = [(o, _closeness(w, cid, o["members"])) for o in tables.values() if o is not t and o["members"] and room(o)]
        if not cands:
            continue
        o, best = max(cands, key=lambda x: (x[1], x[0]["id"]))
        if best >= 15 and (best - stay >= DRIFT_BIG or (stay < 5 and best - stay >= DRIFT_SMALL)):
            move(cid, o)
    # 2. anyone without a table (the first lunch, new students): a group sits together, the popular first
    for cid in sorted((c for c in studs if c not in home), key=lambda x: (clq.get(x) is None, clq.get(x) or "", -studs[x].popularity, x)):
        if cid == me_id and mine:
            continue
        place(cid)
    # 3. you: your pick (if it has room for you), else where you are (or with your group)
    if me_id in studs and mine:
        t = tables[mine]
        if home.get(me_id) == mine:
            pass
        elif room(t):
            move(me_id, t)
        else:
            st["mine"] = None
            if me_id not in home:
                place(me_id)
    # nobody eats alone by routine: someone left on their own joins the table they get on with best
    for t in sorted(tables.values(), key=lambda t: t["id"]):
        if len(t["members"]) == 1 and t["members"][0] != (me_id if st.get("mine") else None):
            cid = t["members"][0]
            cands = [o for o in tables.values() if o is not t and o["members"] and room(o)]
            if cands:
                move(cid, max(cands, key=lambda o: (_closeness(w, cid, o["members"]), o["id"])))
    tables = {k: v for k, v in tables.items() if v["members"]}
    _names(w, tables, studs, clq)
    since = dict(st.get("since") or {})
    for cid, t in home.items():
        if old_home and old_home.get(cid) != t:  # (the first seating isn't anyone moving)
            since[cid] = w.day
    st.update({"tables": tables, "home": {m: t for m, t in home.items() if t in tables}, "made": w.day,
               "since": {k: v for k, v in since.items() if k in home and w.day - v < NEW_DAYS}})


def _names(w, tables, studs, clq):
    """Each table goes by the group most of it is (a big group's tables are 1 of 2, 2 of 2), else its year, else mixed."""
    from collections import Counter
    for t in tables.values():
        counts = Counter(clq[m] for m in t["members"] if m in clq)
        q, n = counts.most_common(1)[0] if counts else (None, 0)
        if q and n >= 2 and n * 2 >= len(t["members"]):
            t["group"], t["name"] = q, (w.cliques[q].get("name") or "a table")
            continue
        t["group"] = None
        grades = {studs[m].grade for m in t["members"]}
        t["name"] = f"a {studs[t['members'][0]].year_label.lower()} table" if len(grades) == 1 else "a mixed table"
    by_name: dict = {}
    for t in tables.values():
        by_name.setdefault(t["name"], []).append(t)
    for ts in by_name.values():
        ts.sort(key=lambda t: (-sum(studs[m].popularity for m in t["members"]) / len(t["members"]), t["id"]))
        for i, t in enumerate(ts):
            t["side"], t["of"] = i, len(ts)


def weekly(sim):
    rebuild(sim)


def home_of(w, cid):
    return (store(w).get("home") or {}).get(cid)


def my_table(sim):
    """(table id, table) where you sit (the tables made fresh for the school year first, if they need to be)."""
    from . import calendar as calm
    w = sim.w
    st = store(w)
    if not st.get("tables") or st.get("made") is None or st.get("year") != calm.school_year_of(w.day):
        rebuild(sim)
    tid = (st.get("home") or {}).get(w.meta.get("protagonist"))
    return (tid, st["tables"].get(tid)) if tid else (None, None)


def my_options(sim, dec):
    """Your lunch choices, added to the engine's: your usual table (what you do unless you pick something else), and
    lunch with one close friend somewhere other than the cafeteria, just you two."""
    from .decision import Cand
    w = sim.w
    me = w.meta.get("protagonist")
    a = sim.cat.actions.get("sit_with")
    tid, t = my_table(sim)
    if a is None or t is None or me not in w.chars:
        return
    here = lambda x: x in w.chars and w.chars[x].status == "active" and w.chars[x].location != "away"  # noqa: E731
    top = max((c.u for c in dec["cands"]), default=0.0)
    mates = [m for m in t["members"] if m != me and here(m)]
    if mates:
        cd = Cand(a, max(mates, key=lambda m: (_aff(w, me, m), m)), {"routine": True, "table": tid}, "your usual table")
        cd.u = top + 0.02
        dec["cands"].append(cd)
    fam = set(sim.siblings(me))
    pals = [x for x in (w.out.get(me) or {}) if here(x) and x not in fam and w.chars[x].role == "student"
            and w.chars[x].school == w.chars[me].school and _aff(w, me, x) >= 30 and _aff(w, x, me) >= 20]
    for x in sorted(pals, key=lambda x: (-_aff(w, me, x), x))[:3]:
        cd = Cand(a, x, {"just_us": True}, "just you two")
        cd.u = top + 0.01
        dec["cands"].append(cd)


def routine_index(dec):
    return next((i for i, cd in enumerate(dec["cands"]) if isinstance(cd.extra, dict) and cd.extra.get("routine")), None)


def seating(sim, absent: set, visits: list, rng=None, just_us=()) -> tuple:
    """Today's lunch: (join pairs for the table builder, newcomers who can still be frozen out). Everyone at school sits at
    their table; now and then someone spends the day at a friend's other table (a visit), and you can get lunch with a
    friend somewhere else, just you two (if they're around and not studying)."""
    import random
    w = sim.w
    my_table(sim)
    st = store(w)
    home = st["home"]
    rng = rng or random.Random(w.day)
    me = w.meta.get("protagonist")
    pair = {}
    for a, b in just_us:
        if a in home and b in home and a not in absent and b not in absent and a not in pair and b not in pair:
            pair[a], pair[b] = b, a
    away = {}
    for a, b in visits:
        if a in pair or b in pair:
            continue
        if a in home and b in home and home[a] != home[b] and a not in absent and b not in absent and a not in away:
            if a == me or rng.random() < VISIT_P:
                away[a] = b
    joins = []
    for tid, t in sorted(st["tables"].items()):
        here = [m for m in t["members"] if m not in absent and m not in away and m not in pair and m in w.chars and w.chars[m].location != "away"]
        if len(here) < 2:
            continue
        anchor = here[0]
        joins += [(m, anchor) for m in here[1:]]
    joins += sorted(away.items())
    joins += sorted((a, b) for a, b in pair.items() if a < b)
    newcomers = set(away) | {cid for cid, d in (st.get("since") or {}).items() if w.day - d < NEW_DAYS}
    return joins, newcomers


def table_pairs(n: int) -> int:
    """How many small exchanges a table has in a day: about one per person."""
    return max(2, min(10, n))


def happening(sim, fx, members, rng):
    """Now and then something happens at a table. Small, and it makes sense for who's there. -> a line for your feed if
    it happened at your table, else None."""
    from . import social
    from .worldgen import compatibility
    w = sim.w
    me = w.meta.get("protagonist")
    at_mine = me in members
    if rng.random() >= (0.22 if at_mine else 0.08) or len(members) < 3:
        return None
    others = [m for m in members if m != me]
    kind = rng.choices(["joke", "jab", "noticed"], weights=[6, 2, 2])[0]
    name = lambda cid: "you" if cid == me else w.chars[cid].first  # noqa: E731
    if kind == "joke":
        trio = rng.sample(members, 3)
        thing = rng.choice(JOKES)
        for i in range(3):
            for j in range(3):
                if i != j:
                    fx.rel(trio[i], trio[j], "familiarity", 2.0, "inside joke at lunch")
                    fx.rel(trio[i], trio[j], "affection", 1.2, "inside joke at lunch")
        who = [name(x) for x in trio]
        return f"Lunch: {who[0].capitalize()}, {who[1]} and {who[2]} have a running joke about {thing} now." if at_mine else None
    if kind == "jab":
        pairs = [(a, b) for a in members for b in members if a != b and a != me]  # (you never start it on your own)
        a, b = min(pairs, key=lambda p: (compatibility(w, w.chars[p[0]], w.chars[p[1]]) + rng.random() * 0.2, p))
        if compatibility(w, w.chars[a], w.chars[b]) > 0.2:
            return None  # nobody here grates on each other
        fx.rel(b, a, "affection", -2.0, "a jab at lunch")
        fx.rel(a, b, "affection", -0.8, "a jab at lunch")
        return f"Lunch: {name(a).capitalize()} took a shot at {name(b)}, and the table went quiet for a second." if at_mine else None
    if kind == "noticed":
        pairs = [(a, b) for a in members for b in members if a != b and a != me and social.romance_ok(w, a, b)]
        if not pairs:
            return None
        a, b = rng.choice(pairs)
        fx.rel(a, b, "attraction", 2.5, "noticed them at lunch")
        if b == me:
            return f"Lunch: you caught {w.chars[a].first} looking over more than once."
        return f"Lunch: {w.chars[a].first} keeps finding reasons to talk to {w.chars[b].first}." if at_mine else None
    return None


def pair_line(sim, members):
    w = sim.w
    me = w.meta.get("protagonist")
    if me not in members:
        return None
    other = next(m for m in members if m != me)
    return f"Lunch: you and {w.chars[other].first} skipped the cafeteria and ate somewhere else, just the two of you."


def choose(sim, tid: str | None) -> dict:
    """You: sit at this table from now on (None: back to sitting with your group)."""
    w = sim.w
    st = store(w)
    if tid is not None and tid not in (st.get("tables") or {}):
        raise KeyError(tid)
    me = w.meta.get("protagonist")
    if tid is not None and me not in st["tables"][tid]["members"] and len(st["tables"][tid]["members"]) >= SEATS:
        raise ValueError("that table's full")
    st["mine"] = tid
    if tid is None and me in (st.get("home") or {}):
        cur = st["tables"].get(st["home"][me])
        if cur is not None:
            cur["members"].remove(me)  # back with your group: you're seated fresh, group first
        del st["home"][me]
    rebuild(sim)
    return view(sim)


def view(sim) -> dict:
    """The cafeteria for the Scene tab: every table, who sits there, which is yours, and how each table feels about you."""
    from .scene import _mini
    w = sim.w
    st = store(w)
    if not st.get("tables"):
        rebuild(sim)
    me = w.meta.get("protagonist")
    mine = (st.get("home") or {}).get(me)
    out = []
    for tid, t in st["tables"].items():
        members = [m for m in t["members"] if m in w.chars]
        others = [m for m in members if m != me]
        feel = round(sum(_aff(w, m, me) for m in others) / len(others)) if others and me else None
        pop = round(sum(w.chars[m].popularity for m in members) / len(members)) if members else 0
        out.append({"id": tid, "name": t["name"], "side": t.get("side", 0), "of": t.get("of", 1), "group": t.get("group"),
                    "people": [_mini(w, m) for m in sorted(members, key=lambda m: (-w.chars[m].popularity, m))],
                    "yours": tid == mine, "feel": feel, "pop": pop, "full": len(members) >= SEATS and tid != mine})
    out.sort(key=lambda x: (not x["yours"], -x["pop"], x["id"]))
    return {"tables": out, "picked": bool(st.get("mine")), "mine": mine}
