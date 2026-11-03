"""The Story Editor's side of the engine.

The editor is its own app (play/edit/ on the phone site): you write storylines there and export them as the same pack
files the game already loads, or as one bundle file with all of them. This is what it asks the game engine, so what you
write is checked and played by the real rules, not a copy of them:

- schema(): the vocabulary (who a scene can be about, school years, conditions, every op and its arguments, stats...)
- check_all(packs): every pack's problems, plus the ones you only see across packs (two scenes with one id, a link to a
  scene that isn't in your story, a fact nothing remembers)
- run(packs, ...): your story played from the first day of freshman year to the end, on your own family and cast
  (rebuilt from your phone's backup) or a sample story: when every scene comes, or why it never does
- bundle / packs_in: one file with many packs, both ways

None of it touches the story you're playing.
"""
from __future__ import annotations

import time

from . import dialogue

BUNDLE = "dialogue_bundle"
YEAR_ORDER = ["freshman", "sophomore", "junior", "senior", "college_freshman", "college_sophomore", "college_junior"]
YEAR_LABEL = {"freshman": "Freshman", "sophomore": "Sophomore", "junior": "Junior", "senior": "Senior",
              "college_freshman": "College freshman", "college_sophomore": "College sophomore", "college_junior": "College junior",
              "college_senior": "College senior", "high_school": "Any high school year", "college": "Any college year"}

# a story to play when you haven't brought your own: an older brother who plays basketball, twin sisters, a best friend,
# a rival and a coach, so the usual kinds of storylines have someone to be about
SAMPLE_SPEC = {
    "title": "A Sample Story",
    "protagonist": {"first": "Alex", "last": "Rivera", "gender": "m", "grade": 9, "archetype": "athlete", "attracted_to": ["f"],
                    "traits": {"competitiveness": 80, "discipline": 65, "sociability": 66}, "aptitudes": {"athletic": 80},
                    "interests": {"football": 78, "basketball": 72, "baseball": 88}, "skills": {"football": 42, "basketball": 44, "baseball": 50},
                    "positions": {"baseball": "SS"}},
    "family": {"last": "Rivera", "guardians": ["Maria Rivera", "Dan Rivera"], "style": "warm", "income": "middle"},
    "siblings": [{"key": "bro", "first": "Marcus", "gender": "m", "grade": 12, "archetype": "athlete",
                  "interests": {"basketball": 95}, "skills": {"basketball": 80}, "positions": {"basketball": "PG"}},
                 {"key": "sis1", "first": "Sofia", "gender": "f", "grade": 10},
                 {"key": "sis2", "first": "Lucia", "gender": "f", "grade": 10, "twin_of": "sis1"}],
    "cast": [{"key": "bf", "first": "Danny", "last": "Kim", "gender": "m", "grade": 9, "archetype": "athlete",
              "relationships": [{"to": "me", "type": "best_friend"}]},
             {"key": "rival", "first": "Cole", "last": "Price", "gender": "m", "grade": 9, "relationships": [{"to": "me", "type": "rival"}]},
             {"key": "coach", "role": "staff", "first": "Frank", "last": "Duda", "gender": "m", "coach_of": "baseball"}],
    "students_per_grade": 8, "gen_seed": 4242,
}


def is_bundle(d) -> bool:
    return isinstance(d, dict) and isinstance(d.get("packs"), list) and not any(k in d for k in dialogue.SECTIONS)


def packs_in(d) -> list:
    """The packs in a file: a bundle's packs, or the one pack it is."""
    if is_bundle(d):
        return [p for p in d["packs"] if isinstance(p, dict)]
    return [d] if isinstance(d, dict) else []


def bundle(name: str, packs: list) -> dict:
    return {BUNDLE: 1, "name": name or "My story", "packs": packs}


def schema() -> dict:
    """Everything the editor offers in its menus, straight from the game's own lists."""
    from . import scheduler
    from .catalogs import APTITUDES, TRAITS
    return {
        "who": dialogue.WHO, "years": [{"key": k, "label": YEAR_LABEL[k]} for k in YEAR_ORDER + ["high_school", "college"]],
        "requires": dialogue.REQUIRES, "me_stats": dialogue.ME_STATS, "rel_fields": dialogue.REL_FIELDS, "needs": list(dialogue.NEEDS),
        "focus": list(dialogue.FOCUS_MODES), "rep": list(dialogue.REP_TAGS), "refs": list(dialogue.SCENE_REFS),
        "names": sorted(dialogue.SCENE_NAMES), "vibes": list(dialogue.VIBE_STYLES), "importance": list(scheduler.IMPORTANCE),
        "when_keys": sorted(dialogue.WHEN_KEYS), "schedule_keys": list(dialogue.SCHEDULE_KEYS),
        "traits": list(TRAITS), "talents": list(APTITUDES), "skills": sorted(dialogue._skill_ids()),
        "minigames": dialogue.MG_FITS, "max_beats": dialogue.MAX_BEATS,
        "cast_who": list(dialogue.SIBLING_KINDS) + ["friend", "teammate", "classmate", "ex", "coach"],
        "sports": sorted(dialogue._base("sports.json")["sports"]),
        "ops": {k: {"args": v[0], "example": v[1], "about": v[2]} for k, v in dialogue.OPS.items()},
    }


def builtin_packs() -> list:
    """The storylines that come with the game, to start from or borrow."""
    return [{"id": p["id"], "name": p["pack"].get("name"), "pack": p["pack"]} for p in dialogue.packs() if p["source"] == "builtin"]


def _scene_ids(pk) -> list:
    return [s.get("id") for s in pk.get("scenes") or [] if isinstance(s, dict) and s.get("id")]


def _ops_of(x):
    """Every op in a choice (or a list of choices), down through then, minigame/vibe/chance branches."""
    if isinstance(x, list):
        if x and isinstance(x[0], str):
            yield x
            for a in x[1:]:
                if isinstance(a, (list, dict)):
                    yield from _ops_of(a)
        else:
            for y in x:
                yield from _ops_of(y)
    elif isinstance(x, dict):
        for k, v in x.items():
            if k in ("ops", "choices", "then", "great", "good", "miss", "meh", "bad") or isinstance(v, (list, dict)):
                yield from _ops_of(v)


def check_all(packs: list) -> dict:
    """Every pack's own check, then what's only wrong across them."""
    base = set(dialogue._base("moments.json")["moments"])
    builtin = {sid: p["pack"].get("name") for p in dialogue.packs() if p["source"] == "builtin" for sid in _scene_ids(p["pack"])}
    per, where = [], {}
    for i, pk in enumerate(packs):
        r = dialogue.check(pk)
        per.append({"index": i, "name": pk.get("name") if isinstance(pk, dict) else None, "ok": r["ok"], "errors": r["errors"],
                    "warnings": r["warnings"], "summary": r.get("summary") or {}})
        if isinstance(pk, dict):
            for sid in _scene_ids(pk):
                where.setdefault(sid, []).append(i)
    known = set(where) | set(builtin)
    remembered = set()
    for pk in packs + [p["pack"] for p in dialogue.packs() if p["source"] == "builtin"]:
        for sc in (pk.get("scenes") or []) if isinstance(pk, dict) else []:
            for op in _ops_of(sc.get("choices") or []):
                if op and op[0] == "remember" and len(op) > 1 and isinstance(op[1], str):
                    remembered.add(op[1])
    cross = []

    def add(kind, i, sid, text):
        cross.append({"kind": kind, "pack": i, "name": packs[i].get("name") if i is not None else None, "sid": sid, "text": text})

    for sid, idx in where.items():
        if len(idx) > 1:
            add("duplicate", idx[1], sid, f"“{sid}” is in {len(idx)} storylines ({', '.join(str(packs[i].get('name')) for i in idx)}): "
                                          "only the first one plays")
        if sid in builtin:
            add("duplicate", idx[0], sid, f"“{sid}” is also a scene in the built-in storyline {builtin[sid]}: the built-in one plays")
        if sid in base:
            add("duplicate", idx[0], sid, f"“{sid}” is already one of the game's own moments: pick another id")
    for i, pk in enumerate(packs):
        if not isinstance(pk, dict):
            continue
        for sc in pk.get("scenes") or []:
            if not isinstance(sc, dict):
                continue
            when = sc.get("when") or {}
            after = when.get("after") or []
            for a in after if isinstance(after, list) else [after]:
                if a not in known:
                    add("missing_scene", i, sc.get("id"), f"“{sc.get('id')}” comes after “{a}”, which isn't in your story (so it doesn't wait for anything)")
            for f in when.get("remembered") or []:
                if f not in remembered:
                    add("missing_fact", i, sc.get("id"), f"“{sc.get('id')}” needs “{f}” remembered, and no choice anywhere remembers it: it can never happen")
        for sid, sch in (pk.get("schedule") or {}).items():
            if sid not in known:
                add("missing_scene", i, sid, f"the schedule places “{sid}”, which isn't in your story")
            elif isinstance(sch, dict):
                aft = sch.get("after") or []
                for a in aft if isinstance(aft, list) else [aft]:
                    if a not in known:
                        add("missing_scene", i, sid, f"the schedule has “{sid}” come after “{a}”, which isn't in your story")
    return {"ok": all(p["ok"] for p in per), "packs": per, "cross": cross,
            "scenes": len(where), "storylines": sum(1 for pk in packs if isinstance(pk, dict) and pk.get("scenes"))}


def spec_from_backup(data: bytes) -> dict:
    """Your story's setup (you, your family, your people) from a phone backup, to play from the first day."""
    from .storage import world_from_bytes
    w = world_from_bytes(data)
    spec = (w.meta.get("story") or {}).get("spec")
    if not spec:
        raise ValueError("That backup doesn't have a story's setup in it.")
    return spec


def run(packs: list, spec: dict | None = None, builtin: bool = True, days: int | None = None) -> dict:
    """Play the story from the first day of freshman year with these packs (fast: the calendar and the stories), your
    character answering. When each scene comes, or why it never does, plus the month-by-month picture."""
    from . import scheduler, storybuilder
    from .engine import Simulation
    from .story import begin, create_story
    t0 = time.time()
    spec = spec or SAMPLE_SPEC
    with dialogue.project_packs(packs, builtin=builtin) as pp:
        names = {it["id"]: (it["pack"].get("name") if isinstance(it["pack"], dict) else None) for it in pp.items}
        skipped = [{"name": names[it["id"]], "errors": it["check"]["errors"][:5]} for it in pp.items if not it["check"]["ok"]]
        sim = Simulation(create_story(spec))
        begin(sim)
        span = days or (7 * 365 + 10)
        dr = scheduler.dry_run(sim, span, None, full=False)
        rows = scheduler.rows(sim)
        cov = storybuilder.coverage(sim, dr)
        mine = {it["id"] for it in pp.items}
        from . import calendar as calm
        y0 = calm.school_year_of((sim.w.meta.get("story") or {}).get("start_day", 0))
        out = []
        for r in rows:
            if r["pack"] not in mine:
                continue
            at = {}
            if r["state"] == "played" and r.get("day") is not None:
                at = {"yi": calm.school_year_of(r["day"]) - y0, "month": calm.date_of(r["day"]).month}
            out.append({**at, "sid": r["sid"], "pack": names.get(r["pack"]), "title": r["title"], "state": r["state"], "day": r.get("day"),
                        "date": r.get("date"), "reason": (r.get("missed") or {}).get("reason") or r.get("reason"), "why": r.get("why"),
                        "detail": r.get("detail"), "importance": r["importance"]})
        me = sim.w.chars[sim.w.meta["protagonist"]]
    counts: dict = {}
    for r in out:
        counts[r["state"]] = counts.get(r["state"], 0) + 1
    return {"scenes": out, "counts": counts, "coverage": cov, "skipped": skipped, "seconds": round(time.time() - t0, 1),
            "who": {"name": me.name, "title": spec.get("title"), "sample": spec is SAMPLE_SPEC}}
