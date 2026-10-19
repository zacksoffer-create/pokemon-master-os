"""Situations and play sheets (scouting engine, layer 4): what we call, down and distance.

A situation is a game state. The play sheet puts each of our members in that state against an opponent and asks
the same policy the fights use what it calls. The plan is the member's best plan from the evaluation layer, and the
coach settings are this lineup's. Against the field, a member's call in a situation is its most common one; against
a specific opponent, it's that matchup's call.

The opponent's play sheet is the same question asked from their side: their tendencies, the MLB report's half.
"""
from collections import Counter
from dataclasses import replace

from battle.evaluate import Fight

SITUATIONS = [
    ("opening", "Opening script", "both at full HP, first turn"),
    ("first_down", "1st and 10", "both healthy, the opening is done"),
    ("short_yardage", "Short yardage", "they're at half: one solid hit finishes it"),
    ("goal_line", "Goal line", "they're under 25%"),
    ("third_long", "3rd and long", "we're under the heal line (30% unless the coach sets one), they're healthy"),
    ("blitz", "Blitz", "they've boosted twice (their own boost move, or +2 in the stat they attack with)"),
    ("two_minute", "Two-minute drill", "both at 25%: whoever lands next wins"),
]
SITUATION_NAMES = {sid: name for sid, name, _ in SITUATIONS}


def full_kit(plan, kinds):
    """The plan with every habit the moveset supports switched on: how a side plays when nothing is held back."""
    has = set(kinds.values())
    return replace(plan, build=plan.build or "boost" in has,
                   disrupt=plan.disrupt or bool(has & {"phaze", "haze", "encore"}),
                   sustain=plan.sustain or bool(has & {"heal", "cure", "protect"}))


def _stage(f, sid, us, them, coach):
    if sid == "opening":
        return
    for s in (us, them):
        s.fresh = False
        s.opener_i = len(s.plan.opener)
    if sid == "short_yardage":
        them.hp = 50.0
    elif sid == "goal_line":
        them.hp = 20.0
    elif sid == "third_long":
        us.hp = float(coach.get("heal_line", 30))
    elif sid == "two_minute":
        us.hp = them.hp = 25.0
    elif sid == "blitz":
        boosts = [m for m in them.moves if them.kinds.get(m) == "boost"]
        if boosts:
            for s, v in them.moves[boosts[0]].self_changes.items():
                them.st[s] = max(-6, min(6, them.st[s] + 2 * v))
        else:
            cats = Counter(them.moves[m].category for m in them.moves if them.moves[m].damaging and m != "Struggle")
            them.st["atk" if cats["Physical"] >= cats["Special"] else "spa"] += 2


def _ask(ev, a, b, pa, pb, sid, coach, side):
    f = Fight(ev, a, b, pa, pb, coach_a=coach if side == "A" else None, coach_b=coach if side == "B" else None)
    us, them = (f.A, f.B) if side == "A" else (f.B, f.A)
    _stage(f, sid, us, them, coach or {})
    return f.choose(us)


def calls(ev, jobs, rounds=8):
    """Answer many situation questions at once: jobs are (a, b, plan_a, plan_b, situation, coach, side).
    Every question runs, the damage numbers they were missing are fetched in one batch, and the run repeats."""
    out = [None] * len(jobs)
    todo = list(range(len(jobs)))
    for _ in range(rounds):
        dirty = []
        for i in todo:
            before = ev.table.misses
            out[i] = _ask(ev, *jobs[i])
            if ev.table.misses != before:
                dirty.append(i)
        if not dirty:
            break
        ev.table.fetch()
        todo = dirty
    return out


def sheet(ev, matchup, coach=None):
    """One matchup's play sheet: {situation: our call}."""
    jobs = [(matchup.a, matchup.b, matchup.plan, matchup.answer, sid, coach, "A") for sid, _, _ in SITUATIONS]
    return dict(zip((sid for sid, _, _ in SITUATIONS), calls(ev, jobs)))


def their_sheet(ev, matchup, coach=None):
    """Their side of one matchup, playing their full kit: {situation: their call} against our member."""
    _, kinds = ev.plans(matchup.b)
    jobs = [(matchup.a, matchup.b, matchup.plan, full_kit(matchup.answer, kinds), sid, coach, "B")
            for sid, _, _ in SITUATIONS]
    return dict(zip((sid for sid, _, _ in SITUATIONS), calls(ev, jobs)))


def member_sheet(ev, matchups, coach=None):
    """A member's play sheet against a field: {situation: {"call", "share", "also"}} from its most common calls."""
    sids = [sid for sid, _, _ in SITUATIONS]
    jobs = [(m.a, m.b, m.plan, m.answer, sid, coach, "A") for m in matchups for sid in sids]
    answers = calls(ev, jobs)
    tallies = {sid: Counter() for sid in sids}
    for (_, _, _, _, sid, _, _), c in zip(jobs, answers):
        tallies[sid][c or "—"] += 1
    out = {}
    for sid, tally in tallies.items():
        n = sum(tally.values())
        top = tally.most_common(3)
        out[sid] = {"call": top[0][0], "share": round(100 * top[0][1] / n) if n else 0,
                    "also": [(c, round(100 * k / n)) for c, k in top[1:]]}
    return out
