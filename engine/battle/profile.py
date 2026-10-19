"""Profiles (scouting engine, layer 3): who a team is, as sliders, measured against a field.

Every slider is a share (0-100) of a member's matchups against the field, read off the evaluation layer's fights. A
slider is a tendency, not a grade: 90 on Build-up says it wins by setting up, not that it's good.

| Slider | 0 ◀ ▶ 100 | Measured as |
|---|---|---|
| Pace | absorbs first ◀ ▶ strikes first | share of matchups where its first hit lands before theirs (attacking only) |
| Punch | chips ◀ ▶ knocks out | share of the field it knocks out in two hits or fewer from full, unboosted, lowest roll |
| Run / pass | special ◀ ▶ physical | physical share of the damage its calls deal (each call at its unboosted damage) |
| Build-up | hits now ◀ ▶ builds first | share of matchups a boost, Substitute, screen or weather play makes better |
| Sustain | no healing ◀ ▶ heal and reset | share that healing, Rest, Protect-stalling or curing itself makes better |
| Disruption | straight-up ◀ ▶ disruptive | share that status, a stat drop, Taunt, Encore or phazing makes better |
| Risk | safe ◀ ▶ gambler | share where its plan needs a move under 90% accuracy, or takes recoil, a lock-in, a charge turn or a faint |
| Script | adaptive ◀ ▶ scripted | share where its first call is its single most common first call |

"Makes better" is the evaluation layer's credit: take that family out of its best plan and the result gets worse
(the winner changes, or the margin, the odds or the length of the fight do). How often it changes the *winner* is
kept next to each slider as its "decisive" share; one-on-one, type matchups settle most fights, so that share is
small and is reported rather than used as the scale.

A team's sliders are its members' averages. The field gets the same treatment (every field member against the whole
field), so each slider can also be read as a percentile:
- a member's against the field's players, one by one;
- a team's against teams drawn from the field (2,000 random six-Pokémon teams, a fixed seed), because an average
  of six is smoother than any one player.

The philosophy line comes from the percentiles that sit furthest from the middle.
"""
import hashlib
import json
import os
import random
from statistics import mean

from battle.knowledge import usage_field

HERE = os.path.dirname(os.path.abspath(__file__))
DERIVED = os.path.join(os.path.dirname(HERE), "data", "derived")
SLIDERS = ["pace", "punch", "run_pass", "build", "sustain", "disrupt", "risk", "script"]
SLIDER_NAMES = {"pace": "Pace", "punch": "Punch", "run_pass": "Run / pass", "build": "Build-up", "sustain": "Sustain",
                "disrupt": "Disruption", "risk": "Risk", "script": "Script"}
POLES = {"pace": ("absorbs first", "strikes first"), "punch": ("chips", "knocks out"),
         "run_pass": ("special", "physical"), "build": ("hits now", "builds first"),
         "sustain": ("no healing", "heals and resets"), "disrupt": ("straight-up", "disruptive"),
         "risk": ("safe", "gambler"), "script": ("adaptive", "scripted")}
RISKY_PLAYS = {"recoil", "lock-in", "charge", "recharge", "self-ko"}
# Bump when a definition in the evaluation or profile layer changes, so cached field baselines are rebuilt.
ENGINE_VERSION = "eval-3"


def member_sliders(matchups, movebook):
    """One member's sliders from its matchups against a field."""
    n = len(matchups)
    if not n:
        return {}
    gen = matchups[0].a.gen
    firsts = [m.outcome.calls[0][0] for m in matchups if m.outcome.calls[0]]
    top_first = max(set(firsts), key=firsts.count) if firsts else None
    phys = total = 0.0
    risky = 0
    for m in matchups:
        calls = [c for c in m.outcome.calls[0] if c in m.damage]
        for c in calls:
            d = m.damage[c][0]
            total += d
            if movebook.get(gen, c).category == "Physical":
                phys += d
        used = {c for c in m.outcome.calls[0] if c and not c.startswith("(")}
        plays = {p["play"] for c in used if c in m.a.moves for p in movebook.get(gen, c).plays}
        if m.outcome.odds[0] < 0.9 or plays & RISKY_PLAYS:
            risky += 1
    share = lambda k: 100 * sum(1 for m in matchups if m.credits.get(k)) / n
    decisive = lambda k: 100 * sum(1 for m in matchups if m.credits.get(k) == "decisive") / n
    return {
        "decisive": {k: decisive(k) for k in ("build", "sustain", "disrupt")},
        "pace": 100 * sum(1 for m in matchups if m.straight.first_hit == "A") / n,
        "punch": 100 * sum(1 for m in matchups if max((d[0] for d in m.damage.values()), default=0) >= 50) / n,
        "run_pass": 100 * phys / total if total else 50.0,
        "build": share("build"),
        "sustain": share("sustain"),
        "disrupt": share("disrupt"),
        "risk": 100 * risky / n,
        "script": 100 * firsts.count(top_first) / n if firsts else 0.0,
    }


def record(matchups):
    w = sum(1 for m in matchups if m.outcome.winner == "A")
    d = sum(1 for m in matchups if m.outcome.winner == "draw")
    return {"won": w, "drew": d, "lost": len(matchups) - w - d, "of": len(matchups)}


def percentile(value, population):
    """Share of the population at or below this value (ties count half)."""
    if not population:
        return None
    below = sum(1 for p in population if p < value)
    tied = sum(1 for p in population if p == value)
    return round(100 * (below + tied / 2) / len(population))


class Profiler:
    def __init__(self, evaluator, movebook):
        self.ev, self.mb = evaluator, movebook

    def members(self, team, field, progress=None):
        """{member name: {sliders, record, matchups}} for each member of the team against the field."""
        results = self.ev.versus(team, field, progress=progress)
        out = {}
        for a in team:
            ms = [results[(a.key, b.key)] for b in field if (a.key, b.key) in results]
            out[a.name] = {"combatant": a, "sliders": member_sliders(ms, self.mb), "record": record(ms), "matchups": ms}
        return out

    def team(self, team, field, baseline=None, progress=None):
        mem = self.members(team, field, progress)
        sliders = {k: round(mean(m["sliders"][k] for m in mem.values()), 1) for k in SLIDERS}
        out = {"sliders": sliders, "members": mem,
               "record": {k: sum(m["record"][k] for m in mem.values()) for k in ("won", "drew", "lost", "of")}}
        if baseline:
            teams = team_baseline(baseline, size=len(team))
            out["percentiles"] = {k: percentile(sliders[k], [t[k] for t in teams]) for k in SLIDERS}
            for m in mem.values():
                m["percentiles"] = {k: percentile(m["sliders"][k], [b[k] for b in baseline.values()]) for k in SLIDERS}
            out["philosophy"] = philosophy(out["percentiles"])
        return out

    def baseline(self, gen, fmt=None, progress=None):
        """Every field member's sliders against the whole field (cached under engine/data/derived)."""
        field = usage_field(gen, fmt)
        tag = hashlib.sha256(json.dumps([ENGINE_VERSION] + [c.key for c in field]).encode()).hexdigest()[:12]
        path = os.path.join(DERIVED, f"field_profile_gen{gen}_{fmt or 'ou'}_{tag}.json")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        mem = self.members(field, field, progress)
        out = {name: m["sliders"] for name, m in mem.items()}
        os.makedirs(DERIVED, exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(out, fh, indent=1)
        return out


def team_baseline(baseline, size=6, samples=2000, seed=0):
    """Slider averages of random teams drawn from the field: what a team-level percentile is measured against."""
    rng = random.Random(seed)
    names = sorted(baseline)
    out = []
    for _ in range(samples):
        pick = rng.sample(names, min(size, len(names)))
        out.append({k: mean(baseline[n][k] for n in pick) for k in SLIDERS})
    return out


def philosophy(percentiles, top=3, cut=20):
    """The sliders furthest from the field's middle, each as its pole: [(slider, pole, percentile)]."""
    far = sorted(((abs(p - 50), k, p) for k, p in percentiles.items() if p is not None), reverse=True)
    return [(k, POLES[k][1] if p >= 50 else POLES[k][0], p) for dist, k, p in far[:top] if dist >= cut]
