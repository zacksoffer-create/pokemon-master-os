"""Add to your story: the easy way to grow a big story without touching the files you already have.

1. Say what you want more of ("fill the quiet weeks in sophomore year", "a storyline with the twins' friends", "fix what
   can't happen"). The game writes a prompt for ChatGPT with everything it needs: your family and cast, every storyline's
   scenes (ids, who, years, facts), how your seven years play right now (scenes per month, the quiet stretches, what
   can't happen and why), and the rules for a reply that loads.
2. ChatGPT answers with ONE small pack: "Additions: ...". New scenes hook into the story you have (after an existing
   scene, on a fact one of your choices remembers, about a cast slot), and its "schedule" can adjust existing scenes
   (move a year or a month, replace an after-link, retire one with "skip") without editing the originals.
3. Paste it back. Before anything is saved, the game checks it and plays your seven years forward on a copy with it
   added: which new scenes play and when, which can't and why, and how many more scenes your story has now.
4. Add it. Packs stack: every addition is its own file, on or off on its own, and the next one builds on all of them.
"""
from __future__ import annotations

import json
import re

from . import calendar as calm

YEAR_KEYS = ["freshman", "sophomore", "junior", "senior", "college_freshman", "college_sophomore", "college_junior"]
YEAR_LABEL = ["Freshman", "Sophomore", "Junior", "Senior", "College freshman", "College sophomore", "College junior"]
MONTHS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]
SUGGESTIONS = [
    "Fill the quiet weeks with scenes that fit what's going on then",
    "More sophomore and junior year: the middle of the story is thin",
    "Fix what can't happen: give the stuck storylines a way through",
    "A new storyline about someone already in my story",
    "Bigger payoffs: finales that tie two storylines together",
]


# ---------------------------------------------------------------------------------------- how the story plays now

def coverage(sim, run: dict) -> dict:
    """Scenes per month for each of the seven school years, and the quiet stretches (three weeks or more with nothing
    during the school year)."""
    w = sim.w
    st = w.meta.get("story") or {}
    y0 = calm.school_year_of(st.get("start_day", 0))
    grid = [[0] * 12 for _ in YEAR_KEYS]
    days = sorted(int(d) for d in (run.get("per_day") or {}) if (run["per_day"].get(d) or run["per_day"].get(str(d))))
    for d in days:
        n = len(run["per_day"].get(d) or run["per_day"].get(str(d)) or [])
        yi = calm.school_year_of(d) - y0
        if 0 <= yi < len(YEAR_KEYS):
            grid[yi][(calm.date_of(d).month - 9) % 12] += n
    quiet = []
    start = max(run.get("start", 0), 0)
    end = run.get("end", start)
    prev = start
    for d in days + [end]:
        if d - prev >= 21:
            a, b = prev + 1, d - 1
            yi = calm.school_year_of(a) - y0
            if 0 <= yi < len(YEAR_KEYS) and calm.date_of(a).month not in (7, 8):
                quiet.append({"from": calm.label(a), "to": calm.label(b), "days": b - a + 1, "year": YEAR_LABEL[yi]})
        prev = d
    quiet.sort(key=lambda q: -q["days"])
    return {"years": [{"label": YEAR_LABEL[i], "key": YEAR_KEYS[i], "months": grid[i], "total": sum(grid[i])} for i in range(len(YEAR_KEYS))],
            "months": MONTHS, "quiet": quiet[:12]}


def remember_check(L_world, rep: dict, cov: dict):
    """Keep the last check's numbers on the story, so the next prompt and preview can use them."""
    L_world.meta["last_check"] = {"day": L_world.day, "counts": rep.get("counts"), "coverage": cov,
                                  "problems": problems(rep.get("scenes") or []), "played": (rep.get("counts") or {}).get("played", 0)}


def problems(rows: list) -> list:
    """What can't happen (or is stuck), grouped by storyline and reason, with a few example scenes."""
    groups: dict = {}
    for r in rows:
        if r.get("state") not in ("unreachable", "waiting", "expired"):
            continue
        reason = (r.get("missed") or {}).get("reason") or r.get("reason") or r.get("state")
        key = (r.get("pack"), reason)
        g = groups.setdefault(key, {"pack": r.get("pack"), "reason": reason, "count": 0, "examples": []})
        g["count"] += 1
        if len(g["examples"]) < 4:
            g["examples"].append({"sid": r["sid"], "detail": r.get("detail")})
    return sorted(groups.values(), key=lambda g: -g["count"])[:25]


# ---------------------------------------------------------------------------------------- the prompt

def _cast_block(sim) -> str:
    from . import dialogue
    w = sim.w
    L = []
    for name, d in dialogue.merged()["cast"].items():
        rec = (w.meta.get("cast_slots") or {}).get(name) or {}
        who = w.chars.get(rec.get("id")) if rec.get("id") else None
        spec = {k: v for k, v in d["spec"].items()}
        L.append(f"- `{name}` = {json.dumps(spec)}" + (f" (in my story: {who.name}, {who.year_label.lower()})" if who else ""))
    return "\n".join(L) or "- (no cast slots yet)"


def _family(sim) -> str:
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if not me:
        return "(no story yet)"
    L = [f"- Me: {me.name}, {me.year_label.lower()} at {sim.cat.world['school']['name']} ({sim.cat.world['town']['name']})"]
    for s in sim.siblings(me.id):
        c = w.chars[s]
        L.append(f"- {c.name}: {'brother' if c.gender == 'm' else 'sister' if c.gender == 'f' else 'sibling'}, {c.year_label.lower()}")
    p = me.flags.get("partner")
    if p in w.chars:
        L.append(f"- Dating: {w.chars[p].name}")
    return "\n".join(L)


def _storylines(sim) -> str:
    """Every storyline, compact: each scene's id, title, who, years and facts (what ChatGPT hooks new scenes onto)."""
    from . import dialogue
    L = ["(Years, needs and after are where each scene plays now, after every schedule.)", ""]
    live = dialogue.merged()["moments"]
    for p in dialogue.packs():
        if not p["enabled"]:
            continue
        sc_list = [sc for sc in p["pack"].get("scenes") or [] if isinstance(sc, dict)]
        if not sc_list and not p["pack"].get("schedule"):
            continue
        L.append(f"### {p['pack'].get('name')} ({'plays in order' if dialogue.in_order(p['id']) else 'any order'}, {len(sc_list)} scenes)")
        sched = p["pack"].get("schedule") or {}
        for sc in sc_list:
            mine = (live.get(sc.get("id")) or {}).get("scene") or {}
            if mine.get("pack") not in (None, p["id"]):
                continue  # another pack already has a scene with this id; that one is the one that plays
            when = dict(mine.get("when") or sc.get("when") or {})
            if when.get("skip"):
                continue
            facts = sorted({op[1] for op in dialogue._all_ops(sc) if isinstance(op, list) and op and op[0] == "remember" and len(op) > 1})
            bits = [f"who {sc.get('who')}" if sc.get("who") else None,
                    ", ".join(when["years"]) if when.get("years") else None,
                    f"needs {', '.join(when['remembered'])}" if when.get("remembered") else None,
                    f"not if {', '.join(when['not_remembered'])}" if when.get("not_remembered") else None,
                    f"after {', '.join(when['after'] if isinstance(when.get('after'), list) else [when['after']])}" if when.get("after") else None,
                    f"remembers {', '.join(facts)}" if facts else None]
            L.append(f"- `{sc.get('id')}` {sc.get('title')} | " + "; ".join(b for b in bits if b))
        if sched and not sc_list:
            L.append(f"- (schedules {len(sched)} scenes)")
        L.append("")
    return "\n".join(L)


def _now(sim) -> str:
    lc = sim.w.meta.get("last_check")
    if not lc:
        return ("(I haven't run the seven-year check yet. Assume the middle years are thinner than freshman year, and spread "
                "new scenes across the months.)")
    L = ["Scenes that played per month in a seven-year test run (Sep to Aug):", "",
         "| year | " + " | ".join(MONTHS) + " | total |", "|---|" + "---|" * 13]
    for y in lc["coverage"]["years"]:
        L.append(f"| {y['label']} | " + " | ".join(str(n) for n in y["months"]) + f" | {y['total']} |")
    if lc["coverage"]["quiet"]:
        L.append("\nQuiet stretches (three weeks or more with no scene):")
        L += [f"- {q['year']}: {q['from']} to {q['to']} ({q['days']} days)" for q in lc["coverage"]["quiet"]]
    if lc.get("problems"):
        L.append("\nWhat can't happen (or is stuck), and why:")
        for g in lc["problems"]:
            ex = ", ".join(f"`{e['sid']}`" + (f" ({e['detail']})" if e.get("detail") else "") for e in g["examples"])
            L.append(f"- {g['pack']}: {g['count']} scenes, {g['reason'].replace('_', ' ')}. e.g. {ex}")
    return "\n".join(L)


PROMPT = """You're adding to my LIFE OS story. LIFE OS is a life-simulation game: I play one person from the first day of high
school (freshman year) through three years of college (seven school years: freshman, sophomore, junior, senior,
college_freshman, college_sophomore, college_junior). My story is made of storylines (dialogue packs) that the game plays
as scenes, several a day when they're ready, each in its season.

## What I want

{ask}

## Rules for your reply

- Reply with ONE JSON code block: one pack, `"dialogue_pack": 1`, `"name": "Additions: <a short title>"`. Valid JSON, no
  comments, no trailing commas. The game checks every line before it loads.
- Every NEW scene id starts with `add_` plus a short tag for this batch (`add_soph1_...`). Never reuse an id from my
  storylines below; never rewrite or rename my scenes.
- Hook new scenes into what I have: `"after": [an existing scene id]` to come after something, `"remembered": [an
  existing fact]` for a branch, `"who": "cast:<slot>"` for someone a storyline is about (copy that slot's definition from
  "My cast" into your pack's `"cast"` exactly as written), or a kind of person (`best_friend`, `crush`, `partner`,
  `older_brother`, `older_sister`, `twin`, `teammate`, `classmate`, `coach`...).
- Put every new scene in a school year (`"years"`), and pin seasonal ones (`"months": [10]`, or `"not_before": "10-01"`,
  `"not_after": "10-25"`). Only the seven years above.
- Say how big each is: `"importance"`: ambient (a text, a joke), regular, major (a turning point), finale.
- To fix my existing scenes without touching their files, add a `"schedule"` entry for them: move a year (`"years"`), a
  season (`"months"`), add or replace an after-link (`"after"`, with `"replace_after": true` to replace instead of add),
  space it (`"gap_days"`), or retire one that doesn't fit anymore (`"skip": true`).
- If your new scenes are chapters of one story, keep them in order in `"scenes"` (they play in that order); if they're
  separate moments that can come in any order, add `"in_order": false` to the pack.
- Scenes have 2 to 4 choices that matter. Use `"then"` to keep a scene going and `["remember", "fact"]` so later scenes
  can follow from it.

## My family

{family}

## My cast (the people storylines are about)

{cast}

## How my story plays right now

{now}

## My storylines (scene id, title | who; years; facts)

{lines}
"""


def prompt(sim, ask: str = "") -> str:
    from . import dialogue
    ask = (ask or "").strip() or "More scenes where my story is thin, that fit what's already happening then."
    body = PROMPT.format(ask=ask, family=_family(sim), cast=_cast_block(sim), now=_now(sim), lines=_storylines(sim))
    return body + "\n---\n\nThe pack format (the parts for scenes and storylines):\n\n" + scene_guide(dialogue.guide_markdown())


# what adding scenes needs from the full pack guide; texting pools, trivia, mini games and the rest are left out so the
# prompt stays small enough for ChatGPT with a big story in it
GUIDE_SKIP = ("Texting lines", "Text pools", "Reply sets", "Narration", "Story moments", "Trivia", "Mini games")


def scene_guide(md: str) -> str:
    parts = re.split(r"\n(?=## )", md)
    return "\n".join(x for x in parts if not any(x.startswith("## " + h) for h in GUIDE_SKIP))


def fix_prompt(errors: list, pack_text: str) -> str:
    return ("The LIFE OS game couldn't load the pack you gave me. Fix exactly these problems and send the whole pack again as "
            "ONE JSON code block (valid JSON, nothing after it):\n\n" + "\n".join(f"- {e}" for e in errors[:60]) +
            "\n\nHere's the pack you sent:\n\n```json\n" + pack_text[:200000] + "\n```\n")


# ---------------------------------------------------------------------------------------- preview before adding

def preview(new_sim, pack: dict, days: int = 7 * 365 + 10, last: dict | None = None) -> dict:
    """Check a pack and play the story forward on a copy with it added (new_sim makes that copy, after the pack is in).
    Nothing is saved."""
    from . import dialogue, scheduler
    rep = dialogue.check(pack)
    # a pack that loads can still be quietly wrong: timing set on the scene itself instead of inside "when" is ignored, so
    # the scene would play in any year. Old packs only get a warning; anything new has to be right before it goes in.
    misplaced = [f"scene '{s.get('id')}': \"{k}\" has to go inside \"when\" (\"when\": {{\"{k}\": ...}}); on the scene itself it's ignored"
                 for s in pack.get("scenes") or [] if isinstance(s, dict) for k in s if k in dialogue.WHEN_KEYS]
    if misplaced:
        rep = {**rep, "ok": False, "errors": misplaced + rep["errors"]}
    out = {"ok": rep["ok"], "errors": rep["errors"], "warnings": rep["warnings"], "summary": rep.get("summary"), "name": pack.get("name")}
    if not rep["ok"]:
        out["fix_prompt"] = fix_prompt(rep["errors"], json.dumps(pack, indent=1)[:200000])
        return out
    have = set(dialogue.merged()["moments"])
    new_ids = [s.get("id") for s in pack.get("scenes") or [] if isinstance(s, dict)]
    clash = [i for i in new_ids if i in have]
    with dialogue.trial_pack(pack):
        sim = new_sim()
        run = scheduler.dry_run(sim, days, None, full=False)
        rows = {r["sid"]: r for r in scheduler.rows(sim)}
        cov = coverage(sim, run)
    played = sum(1 for r in rows.values() if r["state"] == "played")
    scenes = []
    for sid in new_ids:
        r = rows.get(sid) or {}
        scenes.append({"sid": sid, "title": r.get("title") or sid, "state": r.get("state", "missing"), "date": r.get("date"), "day": r.get("day"),
                       "reason": (r.get("missed") or {}).get("reason") or r.get("reason"), "why": r.get("why"), "detail": r.get("detail")})
    changed = []
    for sid in (pack.get("schedule") or {}):
        r = rows.get(sid)
        if r:
            changed.append({"sid": sid, "title": r.get("title"), "state": r["state"], "date": r.get("date"), "why": r.get("why"),
                            "reason": r.get("reason")})
    scenes.sort(key=lambda x: (x["state"] != "played", x.get("day") or 0))
    out.update({"new": scenes, "new_played": sum(1 for x in scenes if x["state"] == "played"),
                "changed": changed, "already_there": clash, "played_total": played, "coverage": cov,
                "before": (last or {}).get("played")})
    return out
