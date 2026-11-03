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


# ---------------------------------------------------------------------------------------- add a scene right here

WEAVE = """You're adding to my LIFE OS story. LIFE OS is a life-simulation game: I play one character from freshman year of \
high school through college junior year, and storylines (packs of scenes with choices) play out across those years. I \
want to add to one storyline at one exact spot, so it reads like it was always there.

## What I want

{ask}

## Where it goes

In the storyline **{line}**, {where}

{timing}

## The storyline, as it is now

{content}

## What I chose when I played it

{path}

## What else is going on around then (other storylines)

{around}

## My family and the people in my story

{family}

Cast slots (one specific person; the same slot name in another pack means the same person):
{cast}

Facts my story can already remember (from any storyline's choices); a new scene can depend on them with "remembered":
{facts}

## Rules for your reply

- Reply with ONE pack in a ```json block, named exactly "{pack_name}", with "dialogue_pack": 1 and "in_order": true.
- Write {count}. Give every new scene an id that starts with `{prefix}`.
- Make them fit exactly here: same people, same voice, same running threads as the chapters around them. Pick up what \
the chapter before leaves open and set up what the chapter after needs.
- Wire them in so they play right here:
{wiring}
- Set "years" on each new scene to the school year where this spot falls{years_hint}. Use "importance" (ambient, regular, \
major or finale) honestly.
- If a new scene is about {who_hint}, copy that cast slot into your pack's "cast" section exactly as it's written above \
and set "who" to it.
- 2 to 4 choices per scene, each with a `say` line or two and small effects. A choice can `remember` a new fact (a new \
name) if a later scene should react to it.
- Second person ("you"), the way the chapters above are written. Short paragraphs.

The pack format (the parts for scenes and storylines):

"""


def _raw_scenes() -> dict:
    from . import dialogue
    out = {}
    for p in dialogue.packs():
        if p["enabled"]:
            for sc in p["pack"].get("scenes") or []:
                if isinstance(sc, dict) and sc.get("id") and sc["id"] not in out:
                    out[sc["id"]] = sc
    return out


def _first(x) -> str:
    return (x[0] if isinstance(x, list) and x else x or "") if not isinstance(x, str) else x


def _says(ops) -> list:
    out = []
    for op in ops or []:
        if isinstance(op, list) and op and op[0] == "say" and len(op) > 1:
            out.append(_first(op[1]))
    return out


def _remembers(ops) -> list:
    return [op[1] for op in ops or [] if isinstance(op, list) and len(op) > 1 and op[0] == "remember"]


def _chapter_text(n: int, sc: dict, when: dict, full: bool) -> str:
    bits = [f"who {sc.get('who')}" if sc.get("who") else None, ", ".join(when.get("years") or []) or None,
            f"needs {', '.join(when['remembered'])}" if when.get("remembered") else None,
            f"not if {', '.join(when['not_remembered'])}" if when.get("not_remembered") else None]
    head = f"### Chapter {n}: {sc.get('title')} (`{sc.get('id')}`)" + (f" · {'; '.join(b for b in bits if b)}" if any(bits) else "")
    if not full:
        return head
    L = [head, "", _first(sc.get("text")).strip(), ""]

    def choices(chs, depth):
        for ch in chs or []:
            if not isinstance(ch, dict):
                continue
            say = _says(ch.get("ops"))
            rem = _remembers(ch.get("ops"))
            L.append("  " * depth + f"- **{ch.get('label')}**" + (f": {say[0]}" if say else "") + (f" (remembers `{'`, `'.join(rem)}`)" if rem else ""))
            if isinstance(ch.get("then"), dict):
                L.append("  " * (depth + 1) + f"then: {_first(ch['then'].get('text')).strip()}")
                choices(ch["then"].get("choices"), depth + 1)
    choices(sc.get("choices"), 0)
    return "\n".join(L)


def weave_prompt(sim, pack: str, after: str | None, ask: str = "", path: list | None = None) -> dict:
    """The ChatGPT prompt for adding to one storyline at one spot: the storyline's own words around it, what you chose,
    what else is happening then, who's who, and exactly how to wire the new scenes in. Returns the prompt and the name
    the new pack should have."""
    from . import dialogue, scheduler
    cat = scheduler.catalog(sim)
    if pack not in cat["chapters"]:
        raise KeyError(pack)
    from .preview import storyline_order
    order = storyline_order(sim, pack)  # with the scenes you've already added to it
    p = next(x for x in dialogue.packs() if x["id"] == pack)
    name = p["pack"].get("name") or "the storyline"
    raw = _raw_scenes()
    live = dialogue.merged()["moments"]
    when_of = lambda s: (live.get(s) or {}).get("scene", {}).get("when") or {}
    i = order.index(after) if after in order else -1
    nxt = order[i + 1] if i + 1 < len(order) else None
    title = lambda s: (raw.get(s) or {}).get("title") or s
    if i < 0:
        where = f"before its first chapter, “{title(order[0])}” (`{order[0]}`)." if order else "as its first chapter."
    elif nxt:
        where = f"right after chapter {i + 1}, “{title(after)}” (`{after}`), and before chapter {i + 2}, “{title(nxt)}” (`{nxt}`)."
    else:
        where = f"after its last chapter, “{title(after)}” (`{after}`): what happens next."
    rows = {r["sid"]: r for r in scheduler.rows(sim)}

    def when_line(s):
        r = rows.get(s) or {}
        w = when_of(s)
        if r.get("state") == "played":
            return f"“{title(s)}” played on {r.get('date')}."
        return (f"“{title(s)}” hasn't happened yet: " + ", ".join(b for b in [
            ("school year " + ", ".join(w["years"])) if w.get("years") else None,
            ("months " + ", ".join(str(m) for m in w["months"])) if w.get("months") else None,
            (f"its season: {r['window_text']}") if r.get("window_text") else None] if b) + ".").replace(": .", ".")
    timing = "\n".join("- " + when_line(s) for s in [after, nxt] if s)
    near = set(order[max(0, i - 2): i + 4]) if len(order) > 12 else set(order)
    content = "\n\n".join(_chapter_text(k + 1, raw.get(s) or {"id": s, "title": title(s)}, when_of(s), s in near) for k, s in enumerate(order))
    if path:
        ptxt = "\n".join(f"- “{c['title']}”: " + (" → ".join(f"“{x}”" for x in c["picks"]) or "(didn't get to choose)") for c in path)
    else:
        ptxt = "(I haven't played it through; write it so it works whatever I chose.)"
    years = set()
    for s in [after, nxt]:
        years |= set(when_of(s).get("years") or []) if s else set()

    def months(sid):  # the months a scene can come in: its own, or the season map's window
        w = when_of(sid)
        if w.get("months"):
            return set(w["months"])
        win = (cat["info"].get(sid) or {}).get("window")
        if isinstance(win, list):
            return set(win)
        if isinstance(win, dict):
            a, b = win["from"][0], win["to"][0]
            return {((a - 1 + k) % 12) + 1 for k in range(((b - a) % 12) + 1)}
        return set()
    spot = set().union(*(months(s) for s in [after, nxt] if s)) if (after or nxt) else set()
    around, close = [], []
    for pk, sids in cat["chapters"].items():
        if pk == pack:
            continue
        nm = next((x["pack"].get("name") for x in dialogue.packs() if x["id"] == pk), pk)
        for s in sids:
            if years and not (set(when_of(s).get("years") or []) & years):
                continue
            (close if spot and months(s) & spot else around).append(f"- {title(s)} ({nm})")
    around = close + around  # the ones in the same weeks first
    around_txt = "\n".join(around[:30]) + (f"\n- …and {len(around) - 30} more" if len(around) > 30 else "") if around else "(nothing else at that point)"
    facts = sorted({f for sc in raw.values() for f in _remembers([op for op in dialogue._all_ops(sc)])})
    n = sum(1 for x in dialogue.packs() if (x["pack"].get("name") or "").startswith(f"Additions: {name}")) + 1
    pack_name = f"Additions: {name} #{n}"
    tag = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:16] or "line"
    prefix = f"add_{tag}_{n}_"
    if i < 0 and order:
        wiring = (f"  - Your last new scene: nothing before it. Then keep the storyline going after yours: add "
                  f"\"schedule\": {{\"{order[0]}\": {{\"after\": [\"<your last new scene id>\"]}}}}.")
    elif nxt:
        wiring = (f"  - Your first new scene: \"when\": {{\"after\": [\"{after}\"]}} (add \"gap_days\" if some time should pass).\n"
                  f"  - Each next new scene: \"after\" the one before it.\n"
                  f"  - Keep the story's next chapter after yours: \"schedule\": {{\"{nxt}\": {{\"after\": [\"<your last new scene id>\"]}}}}.")
    else:
        wiring = (f"  - Your first new scene: \"when\": {{\"after\": [\"{after}\"]}} (add \"gap_days\" if some time should pass).\n"
                  f"  - Each next new scene: \"after\" the one before it.")
    who = [sc.get("who") for s in order[max(0, i - 1): i + 2] for sc in [raw.get(s) or {}] if sc.get("who")]
    body = WEAVE.format(
        ask=(ask or "").strip() or "A scene that belongs here: whatever this spot in the storyline is missing.", line=name, where=where,
        timing=timing or "", content=content, path=ptxt, around=around_txt, family=_family(sim), cast=_cast_block(sim),
        facts=", ".join(f"`{f}`" for f in facts[:200]) or "(none yet)", pack_name=pack_name,
        count="one scene unless I asked for more (at most three)", prefix=prefix, wiring=wiring,
        years_hint=f" ({', '.join(sorted(years))})" if years else "", who_hint=f"`{who[0]}`" if who else "someone with a cast slot")
    text = body + scene_guide(dialogue.guide_markdown())
    return {"prompt": text, "chars": len(text), "pack_name": pack_name, "where": where, "after": after, "next": nxt}
