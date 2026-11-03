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
    from . import dialogue, script
    w = sim.w
    L = []
    for name, d in dialogue.merged()["cast"].items():
        rec = (w.meta.get("cast_slots") or {}).get(name) or {}
        who = w.chars.get(rec.get("id")) if rec.get("id") else None
        L.append(script.cast_line(name, d["spec"]) + (f"   // in my story: {who.name}, {who.year_label.lower()}" if who else ""))
    return "\n".join(L) or "(no cast yet)"


def _family(sim) -> str:
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if not me:
        return "(no story yet)"
    L = [f"- Me: {me.name}, {me.year_label.lower()} at {sim.cat.world['school']['name']} ({sim.cat.world['town']['name']})"]
    for s_ in sim.siblings(me.id):
        c = w.chars[s_]
        L.append(f"- {c.name}: {'brother' if c.gender == 'm' else 'sister' if c.gender == 'f' else 'sibling'}, {c.year_label.lower()}")
    p = me.flags.get("partner")
    if p in w.chars:
        L.append(f"- Dating: {w.chars[p].name}")
    return "\n".join(L)


def _storylines(sim) -> str:
    """Every storyline as its scene lines, and the facts its choices remember (what new scenes hook onto)."""
    from . import dialogue
    out = [dialogue.storyline_headers()]
    facts = sorted({op[1] for p in dialogue.packs() if p["enabled"] for sc in p["pack"].get("scenes") or [] if isinstance(sc, dict)
                    for op in dialogue._all_ops(sc) if isinstance(op, list) and op and op[0] == "remember" and len(op) > 1})
    if facts:
        out.append("Facts my storylines' choices remember (a new scene can use `if <fact>`): " + ", ".join(facts))
    return "\n".join(out)


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
school (fall 2010) through three years of college (seven school years: freshman, sophomore, junior, senior, college
freshman, college sophomore, college junior). My story is made of storylines the game plays as scenes, several a day when
they're ready, each in its season. They're written as story scripts (the format is below).

## What I want

{ask}

## Rules for your reply

- Reply with ONE code block (```) holding the script, and nothing after it.
- New storylines get a new `=== Title`. To add to one of mine, send that storyline back COMPLETE with the same `===` title
  (it replaces it): keep its scenes and titles, add yours where they go.
- Hook new scenes into what I have: `after <Storyline>: <Scene>`, `if <a fact below>`, a cast name from "My cast" (copy its
  cast: line into your storyline exactly), or a kind of person (best friend, crush, partner, older brother, teammate...).
- Put every new scene in a school year (freshman ... college junior) and give seasonal ones a month or a date. Say how big
  each is (small, regular, big, finale).
- To retime any of my scenes without rewriting them, add a `schedule:` block (format below).
- Scenes have 1 to 4 choices that matter, talk that goes back and forth, and `remember` / `if` so later scenes follow from
  what I chose.

## My family

{family}

## My cast (the people storylines are about)

{cast}

## How my story plays right now

{now}

## My storylines

{lines}

"""


def prompt(sim, ask: str = "") -> str:
    from . import script
    ask = (ask or "").strip() or "More scenes where my story is thin, that fit what's already happening then."
    body = PROMPT.format(ask=ask, family=_family(sim), cast=_cast_block(sim), now=_now(sim), lines=_storylines(sim))
    return body + "---\n\n" + script.guide(story_only=True)


def fix_prompt(errors: list, text: str) -> str:
    return ("The LIFE OS game couldn't load the script you gave me. Fix exactly these problems and send the whole script again "
            "as ONE code block (```), nothing after it:\n\n" + "\n".join(f"- {e}" for e in errors[:60]) +
            "\n\nHere's the script you sent:\n\n```\n" + text[:200000] + "\n```\n")


# ---------------------------------------------------------------------------------------- preview before adding

def preview(new_sim, pack, days: int = 7 * 365 + 10, last: dict | None = None, text: str | None = None,
            replaces: str | None = None) -> dict:
    """Check what ChatGPT wrote (a script, or an old JSON pack) and play the story forward on a copy with it in
    (new_sim makes that copy, after it's in). replaces=<pack id>: the script is a new version of that storyline, so it
    stands in for it. Nothing is saved."""
    from . import dialogue, scheduler, script
    if text is not None:
        r = script.compile_script(script.extract(text))
        errs = [f"line {e['line']}: {e['text']}" for e in r["errors"]]
        out = {"ok": not errs, "errors": errs, "error_lines": r["errors"], "warnings": [f"line {e['line']}: {e['text']}" for e in r["warnings"]],
               "summary": r["summary"], "name": ", ".join(p.get("name", "") for p in r["packs"]), "script": True}
        if errs:
            out["fix_prompt"] = fix_prompt(errs, script.extract(text))
            return out
        new_packs = r["packs"]
    else:
        rep = dialogue.check(pack)
        out = {"ok": rep["ok"], "errors": rep["errors"], "warnings": rep["warnings"], "summary": rep.get("summary"), "name": pack.get("name")}
        if not rep["ok"]:
            out["fix_prompt"] = fix_prompt(rep["errors"], json.dumps(pack, indent=1)[:200000])
            return out
        new_packs = [pack]
    hide = set()
    by_name = {p["pack"].get("name"): p["id"] for p in dialogue.packs() if p.get("kind") == "script"}
    for pk in new_packs:  # a storyline sent back with the same title replaces mine
        if pk.get("name") in by_name:
            hide.add(by_name[pk["name"]])
    if replaces:
        hide.add(replaces)
    have = set(dialogue.merged()["moments"])  # (a storyline sent back keeps its scenes' ids: only the new ones are new)
    new_ids = [s_.get("id") for pk in new_packs for s_ in pk.get("scenes") or [] if isinstance(s_, dict)]
    new_ids = [i for i in new_ids if i not in have]
    with dialogue.trial_pack(new_packs, hide=hide):
        sim = new_sim()
        run = scheduler.dry_run(sim, days, None, full=False)
        rows = {r_["sid"]: r_ for r_ in scheduler.rows(sim)}
        cov = coverage(sim, run)
    played = sum(1 for r_ in rows.values() if r_["state"] == "played")
    scenes = []
    for sid in new_ids:
        r_ = rows.get(sid) or {}
        scenes.append({"sid": sid, "title": r_.get("title") or sid, "state": r_.get("state", "missing"), "date": r_.get("date"), "day": r_.get("day"),
                       "reason": (r_.get("missed") or {}).get("reason") or r_.get("reason"), "why": r_.get("why"), "detail": r_.get("detail")})
    changed = []
    for pk in new_packs:
        for sid in (pk.get("schedule") or {}):
            r_ = rows.get(sid) or next((x for x in rows.values() if sid.startswith("@") and x.get("title", "").lower() == sid[1:].split(": ")[-1].lower()), None)
            if r_:
                changed.append({"sid": r_["sid"], "title": r_.get("title"), "state": r_["state"], "date": r_.get("date"), "why": r_.get("why"),
                                "reason": r_.get("reason")})
    scenes.sort(key=lambda x: (x["state"] != "played", x.get("day") or 0))
    out.update({"new": scenes, "new_played": sum(1 for x in scenes if x["state"] == "played"),
                "changed": changed, "already_there": [], "played_total": played, "coverage": cov,
                "before": (last or {}).get("played"), "replaces": sorted(hide)})
    return out


# ---------------------------------------------------------------------------------------- add a scene right here

WEAVE = """You're adding to my LIFE OS story. LIFE OS is a life-simulation game: I play one person from freshman year of \
high school (fall 2010) through college junior year, and storylines play out as scenes across those years. They're written
as story scripts (the format is below). I want to add to one storyline at one exact spot, so it reads like it was always there.

## What I want

{ask}

## Where it goes

In the storyline **{line}**, {where}

{timing}

## The storyline's script, as it is now

```
{content}
```

## What I chose when I played it

{path}

## What else is going on around then (other storylines)

{around}

## My family

{family}

## My cast

{cast}

Facts my story can already remember (from any storyline's choices); a new scene can use `if <fact>`: {facts}

## Rules for your reply

- Reply with ONE code block (```) holding only the new scene{plural}: each starts with `--- Title  [tags]`. No `===` line,
  no cast: line, nothing after the block. {count}
- The game puts them into the storyline right at this spot, in order, so they play there and the story carries on after
  them. Don't add `after ...` tags to wire them in; that's done for you.
- Same people, same voice, same running threads as the scenes around this spot. Pick up what the scene before leaves open
  and set up what the scene after needs. Use the cast names this storyline already uses ({names}).
- Tags: the school year{years_hint}, a month or date if it's seasonal, how big it is (small, regular, big, finale).
- 1 to 4 choices that matter, talk that goes back and forth, and `remember` / `if` if a later scene should react.

---

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
    """The ChatGPT prompt for adding to one storyline at one spot: the storyline's script around it, what you chose
    when you played it, what else is happening then, who's who. The reply is just the new scenes; the app inserts them."""
    from . import dialogue, scheduler, script
    cat = scheduler.catalog(sim)
    if pack not in cat["chapters"]:
        raise KeyError(pack)
    p = dialogue._script_pack(pack)
    from .preview import storyline_order
    order = storyline_order(sim, pack)
    name = p["pack"].get("name") or "the storyline"
    raw = _raw_scenes()
    live = dialogue.merged()["moments"]
    when_of = lambda s: (live.get(s) or {}).get("scene", {}).get("when") or {}
    i = order.index(after) if after in order else -1
    nxt = order[i + 1] if i + 1 < len(order) else None
    title = lambda s: (raw.get(s) or {}).get("title") or s
    if i < 0:
        where = f"before its first scene, “{title(order[0])}”." if order else "as its first scene."
    elif nxt:
        where = f"right after scene {i + 1}, “{title(after)}”, and before scene {i + 2}, “{title(nxt)}”."
    else:
        where = f"after its last scene, “{title(after)}”: what happens next."
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
    src = p["script"].rstrip()
    if len(src) > 40000:  # a long storyline: its scene lines, with the scenes around this spot in full
        near = set(order[max(0, i - 2): i + 4])
        L = [ln for ln in src.split("\n")[:12] if not script.SCENE_RE.match(ln.strip())][:8]
        for sc in p["pack"].get("scenes") or []:
            body = sc.get("src") or f"--- {sc.get('title')}"
            L.append(body if sc.get("id") in near else body.split("\n")[0])
        src = "\n".join(L)
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
    names = ", ".join(f"{{{n}}}" for n in (p["pack"].get("cast") or {})) or "none"
    yl = {"freshman": "freshman", "sophomore": "sophomore", "junior": "junior", "senior": "senior", "college_freshman": "college freshman",
          "college_sophomore": "college sophomore", "college_junior": "college junior"}
    body = WEAVE.format(
        ask=(ask or "").strip() or "A scene that belongs here: whatever this spot in the storyline is missing.", line=name, where=where,
        timing=timing or "", content=src, path=ptxt, around=around_txt, family=_family(sim), cast=_cast_block(sim),
        facts=", ".join(f"`{f}`" for f in facts[:200]) or "(none yet)", plural="(s)",
        count="One scene unless I asked for more (at most three).", names=names,
        years_hint=f" ({', '.join(yl.get(y, y) for y in sorted(years, key=lambda y: YEAR_KEYS.index(y) if y in YEAR_KEYS else 9))})" if years else "")
    text = body + script.guide(story_only=True)
    return {"prompt": text, "chars": len(text), "pack_name": name, "where": where, "after": after, "next": nxt, "pack": pack}
