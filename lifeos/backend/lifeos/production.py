"""Story Studio production pipeline (V2): outline -> writing batches -> paste -> validate -> assemble -> import.

The creative director writes a storyline as a numbered outline (about 40 scenes), splits it into batches (6 scenes each,
so 7 batches for 40), runs each batch in its own outside chat (ChatGPT, Claude, anything), and pastes the results back,
in any order. This module keeps that work as a *production project*, separate from the game's storylines until the
creator imports it:

- outline intake: a pasted numbered outline (or a whole story pack with an outline:) becomes scene records, with the
  original text kept, duplicate and missing numbers reported, nothing re-typed.
- batches: self-contained prompts, one per batch, made here deterministically from the project (no AI call, no keys):
  the storyline, the shared context, the assigned scenes, the engine's own writing rules and limits, the output contract.
  Every batch is written from the same context snapshot, and none needs another batch's text.
- staging: pasted replies split into scenes by their `--- N. Title` headers (not by where they were expected), matched
  to the outline by number, kept per scene with the raw paste and the earlier versions. One bad scene is replaced alone.
- validation: each scene is compiled by the same compiler and checker the game uses (script.compile_script and
  dialogue.check), so there is one definition of a valid script. Engine messages become diagnostics with a code, the
  scene, the line inside the scene, the limit and what to do. Truncated replies and missing outcomes are caught by the
  same completeness rules the existing scene merge uses.
- assembly, preview and import: the storyline's header, outline and scenes in order, compiled with your library, shown
  against what's there now (scenes replaced, scenes already played, a diff), and imported only on confirmation through
  dialogue.add_script (which compiles before writing, keeps the replaced version in history, and never writes over a
  different storyline with the same name).
- shared context: reusable character briefs and shared events (Watch Hill weekends, dances, holidays) that several
  projects can point at, and a registry of the memory keys scenes write and read. These are production notes only: they
  never change a character in the world, and the continuity checks they feed are warnings, never blockers.

Projects live as JSON files in a hidden folder beside your storylines (the game's loader skips it), so they survive a
restart and travel in a backup. A storyline without a project is untouched: nothing here is needed to play.
"""
from __future__ import annotations

import difflib
import hashlib
import json
import os
import re
import time

VERSION = 1
DEFAULT_BATCH = 6
DEFAULT_TARGET = 40
STATUS_ORDER = ("planned", "prompt_copied", "received", "needs_correction", "validated", "imported")
STATUS_LABEL = {"planned": "Planned", "prompt_copied": "Prompt copied", "received": "Output received",
                "needs_correction": "Needs correction", "validated": "Validated", "ready": "Ready to import",
                "imported": "Imported"}
BLOCKBEFORE = re.compile(r"^(here (are|is)|sure[,!]|okay[,!]|ok[,!]|below (are|is)|these are|i('ve| have) written)\b", re.I)
COMMENT_AFTER = re.compile(r"^(let me know|i hope|want me to|would you like|if you('d| would) like|happy to|feel free|"
                           r"note:|notes:|these scenes|this batch|i can also)\b", re.I)


class ProductionError(ValueError):
    pass


# ---------------------------------------------------------------------------------------------------------------- storage

def folder() -> str:
    from . import dialogue
    return os.path.join(dialogue.USER_DIR, ".production")


def _path(pid: str) -> str:
    if not re.fullmatch(r"prj_[a-z0-9_]{1,80}", pid or ""):
        raise ProductionError("that isn't a production project id")
    return os.path.join(folder(), pid + ".json")


def _write(path: str, data: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def load(pid: str) -> dict:
    p = _path(pid)
    if not os.path.exists(p):
        raise KeyError(pid)
    with open(p, encoding="utf-8") as f:
        return _upgrade(json.load(f))


def save(p: dict) -> dict:
    p["updated"] = time.time()
    _write(_path(p["id"]), p)
    return p


def list_projects() -> list:
    d = folder()
    if not os.path.isdir(d):
        return []
    out = []
    for fn in sorted(os.listdir(d)):
        if not fn.startswith("prj_") or not fn.endswith(".json"):
            continue
        try:
            with open(os.path.join(d, fn), encoding="utf-8") as f:
                p = _upgrade(json.load(f))
        except (OSError, ValueError):
            continue
        if p.get("archived"):
            continue
        out.append(summary(p))
    return sorted(out, key=lambda r: -(r.get("updated") or 0))


def archive(pid: str) -> None:
    p = load(pid)
    p["archived"] = True
    save(p)


def _upgrade(p: dict) -> dict:
    """Older project files read as the current version (fields added later get their defaults)."""
    p.setdefault("v", VERSION)
    p.setdefault("batch_size", DEFAULT_BATCH)
    p.setdefault("scenes", [])
    p.setdefault("pastes", [])
    p.setdefault("copied", {})
    p.setdefault("snapshot", 1)
    p.setdefault("context", {})
    for k in ("brief", "time_period", "tone", "instructions", "canon"):
        p["context"].setdefault(k, "")
    p["context"].setdefault("primary", [])
    p["context"].setdefault("supporting", [])
    p.setdefault("target", None)
    p.setdefault("imported", None)
    p.setdefault("seq", len(p["scenes"]))
    return p


def _new_id(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", (title or "storyline").lower()).strip("_")[:40] or "storyline"
    h = hashlib.sha1(f"{title}{time.time()}".encode()).hexdigest()[:6]
    return f"prj_{base}_{h}"


def _hash(text: str) -> str:
    return hashlib.sha1((text or "").strip().encode("utf-8")).hexdigest()[:12]


# --------------------------------------------------------------------------------------------------------------- outline

def _split_header(text: str) -> tuple:
    """(header lines, outline lines, scene text) of a pasted outline or story pack. The header is everything before
    `outline:` (=== title, cast:, years:, about:); without `outline:`, the numbered lines are the outline."""
    from . import script as SC
    lines = text.replace("\r\n", "\n").split("\n")
    k_out = next((i for i, ln in enumerate(lines) if ln.strip().lower().startswith("outline:")), None)
    k_scene = next((i for i, ln in enumerate(lines) if SC.SCENE_RE.match(ln.strip())), None)
    if k_out is not None:
        head = lines[:k_out]
        end = k_scene if (k_scene is not None and k_scene > k_out) else len(lines)
        outline = lines[k_out + 1:end]
        scenes = "\n".join(lines[end:]) if k_scene is not None and k_scene > k_out else ""
    else:
        stop = k_scene if k_scene is not None else len(lines)
        head = [ln for ln in lines[:stop] if not SC.OUTLINE_RE.match(ln.strip()) and (SC.SECTION_RE.match(ln.strip())
                                                                                       or SC.ATTR_RE.match(ln.strip()))]
        outline = [ln for ln in lines[:stop] if SC.OUTLINE_RE.match(ln.strip())]
        scenes = "\n".join(lines[stop:]) if k_scene is not None else ""
    return head, outline, scenes


def _fields(line: str) -> dict:
    """One outline line split the way the compiler splits it (script._parse_outline, with its own regexes):
    `N. Title | when | what happens | only if you picked "X" in 5 | game: loss | if we won`. The first plain field after
    the title is the when and the rest is the summary; condition and game fields are kept as written (in `if`)."""
    from . import script as SC
    m = SC.OUTLINE_RE.match(line.strip())
    if not m:
        return {}
    parts = [x.strip() for x in SC._split(m.group(2), "|")]
    title = re.sub(r"\*\*|__", "", parts[0]).strip(" \"'“”") or f"Scene {m.group(1)}"
    rest, conds = [], []
    for x in parts[1:]:
        if SC.GAME_TAG_RE.match(x) or SC.GAME_COND_RE.match(x) or SC.COND_RE2.match(x) or (
                SC.COND_RE.match(x) and x.lower().startswith(("only if", "unless"))):
            conds.append(x)
        else:
            rest.append(x)
    return {"n": int(m.group(1)), "title": title, "when": rest[0] if rest else "", "summary": " | ".join(rest[1:]),
            "if": " | ".join(conds) or None, "raw": line.strip()}


def parse_outline(text: str, title: str = "") -> dict:
    """A pasted outline -> {title, header, entries, scenes_text, issues}. Accepts a plain numbered list, a story pack's
    `outline:` block, or a whole pack (its written scenes come along). Nothing is dropped: lines that aren't numbered
    scenes are reported; duplicate and missing numbers are reported."""
    from . import script as SC
    raw = text or ""
    norm = SC.normalize_outline(raw)
    head, out_lines, scenes_text = _split_header(norm)
    issues = []
    m = next((SC.SECTION_RE.match(h.strip()) for h in head if SC.SECTION_RE.match(h.strip())), None)
    t = (title or (m.group(1).strip() if m else "") or "Untitled storyline").strip()
    entries, seen = [], {}
    for i, ln in enumerate(out_lines, start=1):
        s = ln.strip()
        if not s:
            continue
        f = _fields(s)
        if not f:
            issues.append(_diag("warning", "OUTLINE_LINE_UNREADABLE", None, f"This outline line isn't a numbered scene: “{s[:80]}”",
                                action="Number it like `12. Title | when | what happens`, or delete it."))
            continue
        if f["n"] in seen:
            issues.append(_diag("error", "OUTLINE_DUPLICATE_NUMBER", f["n"], f"Scene {f['n']} is in the outline twice "
                                f"(“{seen[f['n']]}” and “{f['title']}”).", action="Renumber one of them."))
            continue
        if not f["title"]:
            issues.append(_diag("error", "OUTLINE_NO_TITLE", f["n"], f"Scene {f['n']} has no title.", action="Give it a short title."))
        if not f["summary"]:
            issues.append(_diag("warning", "OUTLINE_NO_SUMMARY", f["n"], f"Scene {f['n']} has no description of what happens.",
                                action="Add a sentence after the title so the writer knows what the scene is."))
        seen[f["n"]] = f["title"]
        entries.append(f)
    entries.sort(key=lambda e: e["n"])
    if entries:
        ns = [e["n"] for e in entries]
        gaps = [n for n in range(ns[0], ns[-1] + 1) if n not in set(ns)]
        if gaps:
            issues.append(_diag("warning", "OUTLINE_MISSING_NUMBERS", None, "The outline skips scene number"
                                + ("s " if len(gaps) > 1 else " ") + ", ".join(map(str, gaps)) + ".",
                                action="Renumber, or add the missing scenes."))
    else:
        issues.append(_diag("error", "OUTLINE_EMPTY", None, "There are no numbered scenes in that.",
                            action="Paste lines like `1. Saved You a Seat | September | Mike saves you a seat on the bus.`"))
    header = [h for h in head if h.strip() and not SC.SECTION_RE.match(h.strip())]
    return {"title": t, "header": header, "entries": entries, "scenes_text": scenes_text, "issues": issues, "original": raw}


def create(text: str, title: str = "", batch_size: int = DEFAULT_BATCH, target: str | None = None, context: dict | None = None) -> dict:
    """A new production project from a pasted outline (or a whole story pack)."""
    o = parse_outline(text, title)
    if not o["entries"]:
        raise ProductionError(o["issues"][0]["message"] if o["issues"] else "no scenes in that outline")
    p = _upgrade({"v": VERSION, "id": _new_id(o["title"]), "title": o["title"], "created": time.time(),
                  "batch_size": max(1, min(20, int(batch_size or DEFAULT_BATCH))), "header": o["header"],
                  "outline_original": o["original"], "outline_issues": o["issues"], "target": target,
                  "context": dict(context or {})})
    for e in o["entries"]:
        p["seq"] += 1
        p["scenes"].append({"uid": f"sc{p['seq']:03d}", "n": e["n"], "title": e["title"], "when": e["when"],
                            "summary": e["summary"], "if": e["if"], "raw": e["raw"], "meta": {}, "text": None,
                            "history": [], "diag": [], "checked": None})
    if not p["context"].get("time_period"):
        yrs = next((h.split(":", 1)[1].strip() for h in p["header"] if h.strip().lower().startswith("years:")), "")
        p["context"]["time_period"] = yrs
    if o["scenes_text"].strip():  # a whole pack: its written scenes are received too (a storyline you have: as they are in the game)
        intake(p, o["scenes_text"], source=EXISTING if target else "outline paste")
    return save(p)


def project_for(pack_id: str) -> dict | None:
    """The (not put away) project that imports into this storyline, if there is one."""
    for row in list_projects():
        try:
            q = load(row["id"])
        except (KeyError, OSError, ValueError):
            continue
        if q.get("target") == pack_id:
            return q
    return None


def drop_unplaced(p: dict, k: int) -> dict:
    """Let go of one unplaced scene (a duplicate or a number the outline doesn't have) once you've dealt with it."""
    items = p.get("unplaced") or []
    if not 0 <= k < len(items):
        raise ProductionError("no such unplaced scene")
    items.pop(k)
    return p


def from_storyline(pid: str, batch_size: int = DEFAULT_BATCH) -> dict:
    """A production project for a storyline you already have (its outline and written scenes), to finish or revise it.
    The storyline itself isn't changed until you import. (Its project if it already has one: never two.)"""
    from . import dialogue
    have = project_for(pid)
    if have is not None:  # its project, brought up to date with scenes written since (elsewhere); nothing of the project's is replaced
        if adopt_existing(have):
            save(have)
        return have
    text = dialogue.script_of(pid)
    if "outline:" not in text.lower():
        raise ProductionError("that storyline has no outline: production works from a numbered outline")
    return create(text, batch_size=batch_size, target=pid)


def set_outline(p: dict, entries: list) -> dict:
    """The creator's edits to the scene list: [{uid?, n, title, when, summary, if, meta?}]. Scenes keep their uid (and
    their written text) through renumbering; a new row gets a new uid; a row left out is removed (its text is kept in
    the project's removed list, never just dropped)."""
    old = {s["uid"]: s for s in p["scenes"]}
    seen_n, out = set(), []
    for e in entries:
        n = int(e["n"])
        if n in seen_n:
            raise ProductionError(f"scene {n} is in the list twice")
        seen_n.add(n)
        s = old.pop(e.get("uid"), None) if e.get("uid") else None
        if s is None:
            p["seq"] += 1
            s = {"uid": f"sc{p['seq']:03d}", "text": None, "history": [], "diag": [], "checked": None, "meta": {}}
        changed = s.get("n") != n or s.get("title") != e.get("title")
        s.update({"n": n, "title": str(e.get("title") or "").strip(), "when": str(e.get("when") or "").strip(),
                  "summary": str(e.get("summary") or "").strip(), "if": (str(e["if"]).strip() or None) if e.get("if") else None})
        s["raw"] = None  # (edited: the outline line is rebuilt from the fields)
        if isinstance(e.get("meta"), dict):
            s["meta"] = {k: v for k, v in e["meta"].items() if k in META_FIELDS}
        if changed and s.get("text"):
            s["text"] = _retitle(s["text"], n, s["title"])
            s["checked"] = None
        out.append(s)
    p.setdefault("removed", []).extend(s for s in old.values() if s.get("text"))
    p["scenes"] = sorted(out, key=lambda s: s["n"])
    p["snapshot"] += 1
    return p


META_FIELDS = ("time_period", "primary", "supporting", "purpose", "relationship", "agency", "history", "depends",
               "event", "constraints", "choice_design", "subject")


def set_context(p: dict, ctx: dict) -> dict:
    """Brief, time period, tone, instructions, canon, primary and supporting characters. Bumps the context snapshot:
    prompts copied before carry the old number, so you can tell which batches were written from what."""
    for k in ("brief", "time_period", "tone", "instructions", "canon"):
        if k in ctx:
            p["context"][k] = str(ctx[k] or "")[:6000]
    for k in ("primary", "supporting"):
        if k in ctx:
            p["context"][k] = [str(x).strip() for x in (ctx[k] or []) if str(x).strip()][:20]
    if "title" in ctx and str(ctx["title"]).strip():
        p["title"] = str(ctx["title"]).strip()[:150]
    if "batch_size" in ctx:
        p["batch_size"] = max(1, min(20, int(ctx["batch_size"])))
    if "target" in ctx:
        p["target"] = ctx["target"] or None
    p["snapshot"] += 1
    return p


def _retitle(text: str, n: int, title: str) -> str:
    from . import script as SC
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        if SC.SCENE_RE.match(ln.strip()):
            lines[i] = f"--- {n}. {title}"
            break
    return "\n".join(lines)


def outline_line(s: dict) -> str:
    """The outline line as the compiler reads it: the one pasted, or rebuilt from the edited fields."""
    if s.get("raw"):
        return s["raw"]
    line = f"{s['n']}. {s['title']}"
    if s.get("when") or s.get("summary"):
        line += f" | {s.get('when') or ''}"
    if s.get("summary"):
        line += f" | {s['summary']}"
    return line + (f" | {s['if']}" if s.get("if") else "")


def header_text(p: dict) -> str:
    return "\n".join([f"=== {p['title']}"] + [h for h in p.get("header") or [] if h.strip()])


def outline_text(p: dict) -> str:
    return "outline:\n" + "\n".join(outline_line(s) for s in p["scenes"])


# --------------------------------------------------------------------------------------------------------------- batches

def batches(p: dict) -> list:
    """The writing batches: consecutive scenes, batch_size each (40 scenes at 6 -> 1-6, 7-12, ..., 37-40)."""
    ns = [s["n"] for s in p["scenes"]]
    k = max(1, int(p.get("batch_size") or DEFAULT_BATCH))
    out = []
    for i in range(0, len(ns), k):
        chunk = ns[i:i + k]
        out.append({"i": len(out) + 1, "from": chunk[0], "to": chunk[-1], "ns": chunk})
    return out


def scene_status(p: dict, s: dict, copied_ns: set) -> str:
    if p.get("imported") and s.get("text") and s.get("imported_hash") == _hash(s["text"]):
        return "imported"
    if s.get("text"):
        if s.get("checked") != _ckey(p, s):
            return "received"
        return "needs_correction" if _errors(s) else "validated"
    return "prompt_copied" if s["n"] in copied_ns else "planned"


def batch_status(statuses: list) -> str:
    if all(x == "imported" for x in statuses):
        return "imported"
    if any(x == "needs_correction" for x in statuses):
        return "needs_correction"
    if all(x in ("validated", "imported") for x in statuses):
        return "validated"
    if any(x in ("received", "validated", "imported") for x in statuses):
        return "received"
    if any(x == "prompt_copied" for x in statuses):
        return "prompt_copied"
    return "planned"


def _copied_ns(p: dict) -> set:
    out = set()
    for b in batches(p):
        if str(b["i"]) in p["copied"]:
            out |= set(b["ns"])
    return out


def mark_copied(p: dict, i: int) -> dict:
    p["copied"][str(int(i))] = {"at": time.time(), "snapshot": p["snapshot"]}
    return p


def next_unfinished(p: dict) -> int | None:
    """The first batch nobody has copied yet and that has scenes still to write (or, when all were copied, the first one
    still waiting on scenes)."""
    copied = _copied_ns(p)
    have = {s["n"] for s in p["scenes"] if s.get("text")}
    bs = batches(p)
    for b in bs:
        if str(b["i"]) not in p["copied"] and not set(b["ns"]) <= have:
            return b["i"]
    for b in bs:
        if not set(b["ns"]) <= have:
            return b["i"]
    return None if copied or not bs else bs[0]["i"]


# --------------------------------------------------------------------------------------------------------------- prompts

def _limits() -> dict:
    from . import dialogue as D
    return {"scene": D.MAX_SCENE_TEXT, "line": D.MAX_LINE, "choice": D.MAX_LABEL, "title": D.MAX_TITLE, "depth": D.MAX_BEATS}


def _conditions(p: dict) -> dict:
    """Outline lines that depend on a choice in another scene, read with the compiler's regexes:
    {scene n: (unless?, choice label, source scene n)}."""
    from . import script as SC
    out = {}
    for s in p["scenes"]:
        for x in (s.get("if") or "").split(" | "):
            x = x.strip()
            c = SC.COND_RE2.match(x)
            if c:
                out[s["n"]] = (c.group(1).lower() == "unless", c.group(2).strip(" \"'“”"), int(c.group(3)))
                continue
            c = SC.COND_RE.match(x)
            if c and x.lower().startswith(("only if", "unless")):
                out[s["n"]] = (c.group(1).lower() == "unless", c.group(3).strip(" \"'“”"), int(c.group(2)))
    return out


def _brief_lines(p: dict) -> list:
    """The shared character briefs this project's people have (production notes, not the world's data)."""
    sh = shared()
    names = {x.lower() for x in p["context"].get("primary", []) + p["context"].get("supporting", [])}
    for h in p.get("header") or []:
        m = re.match(r"\s*cast:\s*([a-z][a-z0-9_]*)\s*=\s*(.+)$", h, re.I)
        if m:
            names.add(m.group(1).lower())
            names.add(m.group(2).split(",")[0].strip().lower())
    for s in p["scenes"]:
        for k in ("primary", "supporting"):
            for x in (s.get("meta") or {}).get(k) or []:
                names.add(str(x).lower())
    out = []
    for key, b in sorted(sh["characters"].items()):
        alias = {key.lower(), str(b.get("name") or "").lower()} | {a.lower() for a in b.get("aliases") or []}
        if not alias & names:
            continue
        bits = [f"- {b.get('name') or key}" + (f" (also {', '.join(b['aliases'])})" if b.get("aliases") else "")
                + (" [proposed, not settled canon]" if b.get("status") == "proposed" else "")]
        for k, lab in (("relationships", "Relationships"), ("personality", "Personality"), ("history", "History"),
                       ("goals", "Goals"), ("boundaries", "Don't")):
            if b.get(k):
                bits.append(f"  {lab}: {b[k]}")
        out.append("\n".join(bits))
    return out


def _event_lines(p: dict, ns: set | None = None) -> list:
    sh = shared()
    out = []
    used = {(s.get("meta") or {}).get("event") for s in p["scenes"] if ns is None or s["n"] in ns} - {None, ""}
    for eid in sorted(used):
        ev = sh["events"].get(eid)
        if not ev:
            out.append(f"- {eid} (a shared occasion; no details recorded yet)")
            continue
        owner = ev.get("owner") or {}
        own = f" It belongs to {owner.get('title') or owner.get('project')}" + (f", scene {owner['scene']}" if owner.get("scene") else "") + \
              ": refer to it, don't redefine it." if owner.get("project") and owner.get("project") != p["id"] else ""
        out.append(f"- {ev.get('name') or eid}" + (f" ({ev['when']})" if ev.get("when") else "") + (f": {ev['notes']}" if ev.get("notes") else "") + own)
    return out


def batch_prompt(p: dict, i: int, sim=None) -> dict:
    """Batch i's writing prompt: everything the outside chat needs, in one paste (no other document)."""
    from . import script as SC
    bs = batches(p)
    b = next((x for x in bs if x["i"] == int(i)), None)
    if b is None:
        raise ProductionError(f"there's no batch {i} (this project has {len(bs)})")
    by_n = {s["n"]: s for s in p["scenes"]}
    take = [by_n[n] for n in b["ns"]]
    ns = set(b["ns"])
    ctx = p["context"]
    lim = _limits()
    conds = _conditions(p)
    L = [f"# LIFE OS writing batch {b['i']} of {len(bs)}: {p['title']}",
         f"(production project {p['id']}, context version {p['snapshot']}; scenes {b['from']} to {b['to']})", "",
         "You're writing scenes for LIFE OS, a life-simulation game. I play one person (Zack Soffer unless the cast says "
         "otherwise) and these scenes come up in my story as I play. Write them in the game's story script format so I "
         "can paste your reply straight into the game.", "",
         "## The storyline", f"Title: {p['title']}"]
    if ctx.get("time_period"):
        L.append(f"Time period: {ctx['time_period']}")
    if ctx.get("brief"):
        L.append(f"What it's about: {ctx['brief']}")
    if ctx.get("tone"):
        L.append(f"Tone: {ctx['tone']}")
    if ctx.get("primary"):
        L.append("Focus characters: " + ", ".join(ctx["primary"]))
    if ctx.get("supporting"):
        L.append("Also around: " + ", ".join(ctx["supporting"]))
    L += ["", "The storyline's header (use these cast names exactly in your scenes; don't write the header yourself):",
          "```", header_text(p), "```"]
    shared_bits = []
    if ctx.get("canon"):
        shared_bits.append(ctx["canon"].strip())
    briefs = _brief_lines(p)
    if briefs:
        shared_bits.append("People:\n" + "\n".join(briefs))
    evs = _event_lines(p, ns)
    if evs:
        shared_bits.append("Shared occasions these scenes are part of:\n" + "\n".join(evs))
    if sim is not None:
        try:
            from . import storybuilder
            shared_bits.append("Me and the people around me right now:\n" + storybuilder._family(sim))
        except Exception:  # noqa: BLE001  (no story yet: the prompt works without it)
            pass
    if shared_bits:
        L += ["", "## What's already true (keep to it)", *shared_bits]
    if ctx.get("instructions"):
        L += ["", "## How I want these written", ctx["instructions"].strip()]
    L += ["", "## The whole outline (for continuity)",
          "Other scenes are being written at the same time in other chats. Don't assume what I chose in any other "
          "scene: write each of yours so it works whatever I picked before, unless its line below says it only "
          "happens after a certain choice (the game handles that).", ""]
    for s in p["scenes"]:
        L.append(outline_line(s) + ("   <- yours" if s["n"] in ns else ""))
    L += ["", f"## Your scenes: {b['from']} to {b['to']} ({len(take)} scenes)"]
    for s in take:
        L.append("")
        L.append(f"### Scene {s['n']}: {s['title']}")
        when = s.get("when") or ""
        if sim is not None and when:
            try:
                from . import storycal
                d = storycal.describe(sim, when, storycal.years_in(header_text(p) + "\n" + outline_text(p)) or None)
                when = d or when
            except Exception:  # noqa: BLE001
                pass
        if when:
            L.append(f"When: {when}")
        if s.get("summary"):
            L.append(f"What happens: {s['summary']}")
        meta = s.get("meta") or {}
        for k, lab in (("purpose", "Why it matters"), ("relationship", "Relationship focus"), ("agency", "What I get to decide"),
                       ("history", "Already happened"), ("constraints", "Keep to"), ("choice_design", "The choices"),
                       ("subject", "Whose story it is")):
            if meta.get(k):
                L.append(f"{lab}: {meta[k]}")
        for k, lab in (("primary", "In it"), ("supporting", "Also in it")):
            if meta.get(k):
                L.append(f"{lab}: {', '.join(meta[k])}")
        if s["n"] in conds:
            neg, label, src = conds[s["n"]]
            L.append(f"Only happens if I {'did NOT pick' if neg else 'picked'} “{label}” in scene {src}: pick up from "
                     f"{'not doing that' if neg else 'that'}.")
        musts = [(n2, c) for n2, c in conds.items() if c[2] == s["n"]]
        for n2, (neg, label, src) in musts:
            L.append(f"Must have a choice like “{label}” (scene {n2} depends on it), with what happens after it written out.")
        if meta.get("depends"):
            L.append("Builds on scene" + ("s " if len(meta["depends"]) > 1 else " ") + ", ".join(map(str, meta["depends"]))
                     + " (what's true whatever I chose there, nothing more).")
    L += ["", "## How a scene is written (the game's own rules)", SC.guide_scenes().strip(), "",
          "## Limits the game enforces (it refuses a scene that goes over)",
          f"- A scene's opening (everything before its first choice) together: at most {lim['scene']:,} characters. "
          "Aim for well under that: 15 to 25 lines.",
          f"- One line said after a choice: at most {lim['line']} characters.",
          f"- A choice: at most {lim['choice']} characters.",
          f"- A scene title: at most {lim['title']} characters.",
          f"- Choices inside choices: at most {lim['depth']} levels deep.", "",
          "## The shape of each scene", *["\n" + SC.scene_template(s["n"], s["title"], 3) for s in take], "",
          "## Your reply",
          f"- Only scenes {b['from']} to {b['to']}, each from its header line `--- N. Title` to its last line. "
          "Exactly those numbers and titles.",
          "- Every scene complete: never stop partway through one. If you run out of room, end after a whole scene and "
          "leave the rest out; I'll ask for them separately.",
          "- No scenes I didn't ask for, no header (=== or cast:), no outline.",
          "- Every scene ends on a real decision: 2 to 4 choices, each with what happens after it.",
          "- Keep to the limits above; shorter and complete beats long and cut off.",
          "- Only the formats in the rules above: no commands or effects that aren't in them.",
          "- No introduction, no notes, no closing comments. Just the scenes, ready to paste."]
    text = "\n".join(L).rstrip() + "\n"
    return {"prompt": text, "chars": len(text), "i": b["i"], "from": b["from"], "to": b["to"], "ns": b["ns"],
            "snapshot": p["snapshot"], "of": len(bs)}


def repair_prompt(p: dict, ns: list) -> dict:
    """A focused prompt to fix one scene (or a few): the scene as it is, exactly what's wrong, the rules, and to send back
    only the corrected scene(s), whole."""
    from . import script as SC
    by_n = {s["n"]: s for s in p["scenes"]}
    pick = [by_n[n] for n in ns if n in by_n]
    if not pick:
        raise ProductionError("pick a scene to repair")
    lim = _limits()
    L = [f"# Fix {'this scene' if len(pick) == 1 else 'these scenes'} for my LIFE OS storyline “{p['title']}”", "",
         "LIFE OS is a life-simulation game; this is its story script format. The game refused "
         + ("this scene" if len(pick) == 1 else "these scenes") + " for the reasons listed. Fix exactly those problems.", "",
         "The storyline's header (the cast names to use):", "```", header_text(p), "```"]
    for s in pick:
        L += ["", f"## Scene {s['n']}: {s['title']}", f"What happens in it: {s.get('summary') or '(see the scene)'}", "",
              "What's wrong:"]
        probs = [d for d in s.get("diag") or [] if d["severity"] in ("error", "warning")] or [{"message": "(no problems recorded)"}]
        for d in probs:
            line = f"- {d['message']}"
            if d.get("line"):
                line += f" (line {d['line']} of the scene)"
            if d.get("action"):
                line += f" {d['action']}"
            L.append(line)
        L += ["", "The scene as it is now:", "```", (s.get("text") or f"--- {s['n']}. {s['title']}").strip(), "```"]
    L += ["", "## Rules", SC.guide_scenes().strip(), "",
          f"Limits: a scene's opening at most {lim['scene']:,} characters; a line after a choice at most {lim['line']}; "
          f"a choice at most {lim['choice']}; a title at most {lim['title']}.", "",
          "## Send back",
          "- The complete corrected scene" + ("s" if len(pick) > 1 else "") + ", from the `--- N. Title` line to the end, "
          "with the same number" + ("s" if len(pick) > 1 else "") + " and title" + ("s" if len(pick) > 1 else "") + ".",
          "- Fix only what's listed. Keep the story, the people and how they are with each other, and the choices (and "
          "what happens after each) unless a listed problem is about them.",
          "- Never cut the scene off. If it's too long, tighten the opening; don't drop the choices or their outcomes.",
          "- Only the formats in the rules: no new commands.",
          "- Nothing else: no notes before or after."]
    text = "\n".join(L).rstrip() + "\n"
    return {"prompt": text, "chars": len(text), "ns": [s["n"] for s in pick]}


# ---------------------------------------------------------------------------------------------------------------- intake

def _blocks(lines: list) -> tuple:
    """Scene blocks by their `---` header lines; everything that isn't inside a scene comes back separately."""
    from . import script as SC
    blocks, outside, cur, in_outline = [], [], None, False
    for ln in lines:
        t = ln.strip()
        if SC.SECTION_RE.match(t):
            cur, in_outline = None, False
            outside.append(ln)
            continue
        if t.lower().startswith("outline:") and cur is None:
            in_outline = True
            outside.append(ln)
            continue
        if SC.SCENE_RE.match(t):
            cur, in_outline = [ln], False
            blocks.append(cur)
        elif cur is not None:
            cur.append(ln)
        else:
            outside.append(ln)
    return blocks, outside


def normalize(text: str) -> tuple:
    """Safe, meaning-preserving cleanup of a pasted reply: code fences off, chat commentary before the first scene and
    after the last one set aside. -> (clean text, [what was done], [text set aside]). Nothing inside a scene changes."""
    from . import script as SC
    notes, aside = [], []
    lines = (text or "").replace("\r\n", "\n").replace(" ", " ").split("\n")
    fences = [i for i, ln in enumerate(lines) if ln.strip().startswith("```")]
    if fences:
        lines = [ln for i, ln in enumerate(lines) if i not in set(fences)]
        notes.append(f"Took off {len(fences)} code fence line{'s' if len(fences) != 1 else ''} (```).")
    first = next((i for i, ln in enumerate(lines) if SC.SCENE_RE.match(ln.strip())), None)
    if first is not None and any(ln.strip() for ln in lines[:first]):
        before = [ln for ln in lines[:first] if ln.strip()]
        if not any(SC.SECTION_RE.match(ln.strip()) or ln.strip().lower().startswith("outline:") for ln in before):
            aside.append("\n".join(before))
            notes.append("Set aside the text before the first scene (it isn't part of any scene).")
            lines = lines[first:]
    # trailing chat commentary after the last scene: only lines that read as talking to me, after a blank line
    k = len(lines)
    while k > 0 and not lines[k - 1].strip():
        k -= 1
    tail_start = k
    i = k - 1
    while i > 0:
        if not lines[i].strip():
            nxt = [ln for ln in lines[i + 1:k] if ln.strip()]
            if nxt and COMMENT_AFTER.match(nxt[0].strip()) and not any(SC.SCENE_RE.match(ln.strip()) for ln in nxt):
                tail_start = i
            break
        i -= 1
    if tail_start < k:
        aside.append("\n".join(ln for ln in lines[tail_start:k] if ln.strip()))
        notes.append("Set aside the comment after the last scene (it isn't part of the scene).")
        lines = lines[:tail_start]
    return "\n".join(lines).strip("\n"), notes, aside


def _block_number(block: list, p: dict) -> tuple:
    """(scene number from the header, or the outline scene whose title it is; the header's title)."""
    from . import script as SC
    t = SC.SCENE_RE.match(block[0].strip()).group(1)
    t = re.sub(r"\s*(\[.*|#[a-z].*)$", "", t).strip()
    m = re.match(r"(?:scene\s*|chapter\s*|#)?(\d+)\s*[.):\-]\s*(.*)$", t, re.I)
    if m:
        return int(m.group(1)), m.group(2).strip()
    title = t.strip().lower()
    titles = {s["title"].lower(): s["n"] for s in p["scenes"]}
    if title in titles:
        return titles[title], t
    near = difflib.get_close_matches(title, list(titles), n=1, cutoff=0.8)
    return (titles[near[0]], t) if near else (None, t)


def tidy_scene(body: str) -> tuple:
    """The safe, meaning-preserving format fixes the game's writing guide promises (scriptfix.habits, the same code the
    regular scene paste uses): the lines written right under a choice are put under it (indented), *italic narration*
    and **bold** names become plain lines, effects after an arrow go after |, `Choice 1:` / `Outcome:` labels become the
    game's own marks, unfilled template lines come out. Nothing is dropped, renamed or reworded: an unknown effect, a
    name not in the cast or a line too long stays exactly as written, for the validator to report.
    -> (tidied text, [what was done, with the line in the scene as pasted])"""
    from . import scriptfix
    pre, did, cut = [], [], None
    for k, ln in enumerate(body.split("\n"), start=1):
        m = re.match(r"^(\s+)\*\*\s+(\S.*)$", ln)
        if m:  # an indented `** x`: the guide's choice inside the choice above, written flush left the way it reads
            cut = len(m.group(1))  # (the compiler would show its * to the player)
            did.append(f"line {k}: an indented ** choice was moved flush left (it's a choice inside the choice above)")
            ln = ln[cut:]
        elif cut is not None and ln.strip() and len(ln) - len(ln.lstrip()) > cut:
            ln = ln[cut:]  # (what's under it moves with it)
        elif ln.strip():
            cut = None
        pre.append(ln)
    lines, origin, notes = scriptfix.habits("\n".join(pre))
    did += [f"line {n['line']}: {n['text']}" if n.get("line") else n["text"] for n in notes]
    return "\n".join(lines).rstrip(), did


def intake(p: dict, text: str, only: set | None = None, source: str = "paste", sim=None) -> dict:
    """Pasted scenes into the project. Each `--- N. Title` block goes to outline scene N (whatever batch it came in);
    the same text again changes nothing; a different version replaces the old one (kept in the scene's history).
    only: the scenes this paste is for (a single-scene repair); others in it are reported, not taken. Nothing is ever
    silently dropped: scenes with numbers the outline doesn't have, and second copies of a scene in one paste, are kept
    in the project's unplaced list (with their text) to use or ignore; the whole paste is kept as pasted.
    -> {paste, got, same, changed, unexpected, duplicates, not_asked, notes, set_aside, truncated, tidied}"""
    from . import dialogue as D
    clean, notes, aside = normalize(text)
    pid = f"paste{len(p['pastes']) + 1}"
    p["pastes"].append({"id": pid, "at": time.time(), "source": source, "text": text})
    del p["pastes"][:-60]
    blocks, outside = _blocks(clean.split("\n"))
    extra = [ln for ln in outside if ln.strip()]
    if extra and not blocks:
        aside.append("\n".join(extra))
    by_n = {s["n"]: s for s in p["scenes"]}
    rep = {"paste": pid, "got": [], "same": [], "changed": [], "unexpected": [], "duplicates": [], "not_asked": [],
           "notes": notes, "set_aside": aside, "truncated": D.cut_off(text), "tidied": {}}
    seen, order = set(), []
    unplaced = p.setdefault("unplaced", [])
    for b in blocks:
        n, head_title = _block_number(b, p)
        raw = "\n".join(b).rstrip()
        if n is None or n not in by_n:
            rep["unexpected"].append({"n": n, "title": head_title})
            unplaced.append({"at": time.time(), "paste": pid, "n": n, "title": head_title, "why": "not in the outline", "text": raw})
            continue
        if only is not None and n not in only:
            rep["not_asked"].append(n)
            continue
        if n in seen:
            rep["duplicates"].append(n)
            unplaced.append({"at": time.time(), "paste": pid, "n": n, "title": head_title, "why": "a second copy in one paste", "text": raw})
            continue
        seen.add(n)
        order.append(n)
        body, did = tidy_scene(raw)
        s = by_n[n]
        if s.get("text") and s["text"].strip() == body.strip():
            rep["same"].append(n)
            continue
        if s.get("text"):
            s["history"] = ([{"text": s["text"], "at": s.get("received_at"), "paste": s.get("paste")}] + s.get("history", []))[:6]
            rep["changed"].append(n)
            rep.setdefault("diffs", {})[n] = list(difflib.unified_diff(s["text"].split("\n"), body.split("\n"), "before", "now",
                                                                     lineterm="", n=0))[2:42]
        s.update({"text": body, "original": raw if body != raw else None, "tidied": did, "received_at": time.time(),
                  "paste": pid, "checked": None, "header_title": head_title, "truncated": False,
                  "origin": "existing" if source == EXISTING else "new"})
        if did:
            rep["tidied"][n] = did
        rep["got"].append(n)
    del unplaced[:-40]
    if rep["truncated"] and order and order[-1] in rep["got"]:
        by_n[order[-1]]["truncated"] = True  # (the reply's last scene is the one a cut-off reply cut)
    lib = scene_library(p) if rep["got"] else None
    for n in rep["got"]:
        validate_scene(p, by_n[n], lib)
    if not blocks:
        rep["notes"].append("There are no scenes in that: each starts with a line like `--- 12. Title`.")
    return rep


def replace_scene(p: dict, n: int, text: str) -> dict:
    """A corrected version of one scene. The header line can be left off: it's put back from the outline."""
    from . import script as SC
    by_n = {s["n"]: s for s in p["scenes"]}
    if n not in by_n:
        raise ProductionError(f"there's no scene {n} in this outline")
    clean, _, _ = normalize(text)
    if not any(SC.SCENE_RE.match(ln.strip()) for ln in clean.split("\n")):
        clean = f"--- {n}. {by_n[n]['title']}\n{clean}"
    return intake(p, clean, only={n}, source=f"replace {n}")


def restore_version(p: dict, n: int, k: int) -> dict:
    """Put back an earlier version of a scene (the current one goes into its history)."""
    s = next(x for x in p["scenes"] if x["n"] == n)
    hist = s.get("history") or []
    if not 0 <= k < len(hist):
        raise ProductionError("no such earlier version")
    old = hist.pop(k)
    if s.get("text"):
        hist.insert(0, {"text": s["text"], "at": s.get("received_at"), "paste": s.get("paste")})
    s.update({"text": old["text"], "received_at": time.time(), "checked": None})
    validate_scene(p, s)
    return p


# ------------------------------------------------------------------------------------------------------------ validation

def _diag(severity, code, scene, message, line=None, actual=None, limit=None, action="", storyline=None, span=None) -> dict:
    d = {"severity": severity, "code": code, "scene": scene, "message": message}
    for k, v in (("line", line), ("actual", actual), ("limit", limit), ("action", action), ("storyline", storyline), ("span", span)):
        if v not in (None, ""):
            d[k] = v
    return d


CODES = (  # engine message -> stable code, what to do. First match wins; the engine's own words stay the explanation.
    (r"talks, but nobody here is called that|isn't someone this scene knows|talks, but this scene is about|"
     r"can talk in a scene, but the game doesn't keep track|isn't who this scene is about|isn't someone in th",
     "INVALID_CAST_ALIAS", "Use a cast name from the header (or map the character there: cast: name = who they are); anyone else talks by name with a capital (Mom:, Coach Reyes:)."),
    (r"isn't an effect|isn't part of a relationship|isn't an amount|isn't a trait|isn't a reputation|"
     r"isn't something people get into|isn't a style|isn't a mini game|isn't a kind of flirt|isn't a kind of person",
     "UNKNOWN_EFFECT", "Use one of the effects in the rules (the message names the closest), or take it off."),
    (r"isn't a name the game can fill in|which isn't filled in here", "UNKNOWN_PLACEHOLDER", "Use a cast name or one of the {names} in the rules."),
    (r"unmatched \{ or \}", "BRACE_MISMATCH", "Close the { } or take it out."),
    (r"isn't a tag I know|isn't a time the game knows|needs a date, like", "UNKNOWN_TAG", "Use a when from the calendar, or take the tag off."),
    (r"no choice in this script or your storylines remembers", "MEMORY_NEVER_SET", "Have a choice somewhere `remember` that fact, or take the condition off."),
    (r"if takes a fact|should be a short lowercase fact name", "MEMORY_KEY_INVALID", "Facts are short lowercase names with underscores, like mike_said_sorry."),
    (r"there's no scene or storyline called|has no scene called|^'after ", "MISSING_DEPENDENCY", "Point it at a scene that exists."),
    (r"the conversation comes first|past the fourth reply|indent|nested|under a choice|inside a choice|too deep|deeper than",
     "BRANCH_STRUCTURE", "Write the opening first, then the choices; what happens after a choice goes under it (indented, or down to the next `* `)."),
    (r"cast looks like|is already in the cast|isn't a kind of person a storyline can keep", "CAST_DECLARATION", "Fix the cast line in the header: cast: alias = who they are."),
    (r"order and conditions come from the outline", "OUTLINE_CONFLICT", "Take the [after ...] / [if ...] off the scene: the outline decides its order and conditions."),
)
LENGTH_ACTION = {"SCENE_LENGTH_EXCEEDED": "Shorten the opening (everything before the first choice) without changing its choices or what happens after them.",
                 "LINE_TOO_LONG": "Split the line into two, or tighten it.",
                 "CHOICE_TOO_LONG": "Say the choice in fewer words; put the rest in what happens after it.",
                 "TITLE_TOO_LONG": "Shorten the title.", "TEXT_TOO_LONG": "Shorten it."}


SUBJECT = {"SCENE_LENGTH_EXCEEDED": "This scene's opening (everything before its first choice, or before a choice inside a choice)",
           "LINE_TOO_LONG": "A line", "CHOICE_TOO_LONG": "A choice", "TITLE_TOO_LONG": "The scene's title", "TEXT_TOO_LONG": "This text"}


def _say(text: str) -> str:
    """An engine message as a whole sentence. The checker's length messages lose what they measured on the way out of the
    compiler ("is 4214 characters; keep it under 4000"): the limit says which it was, and the numbers stay the engine's."""
    m = re.fullmatch(r"is (\d+) characters; keep it under (\d+)", text.strip())
    if not m:
        return text
    code = classify(text)[0]
    return f"{SUBJECT.get(code, 'This text')} is {int(m.group(1)):,} characters; the game's limit is {int(m.group(2)):,}."


def classify(text: str) -> tuple:
    """An engine message -> (code, actual, limit, action). The message itself stays as the explanation: this only adds a
    stable code and the numbers, so the UI can filter and the repair prompt can be precise. The numbers come from the
    engine's own message (the limits are dialogue.py's), never recomputed here."""
    from . import dialogue as D
    m = re.search(r"is (\d+) characters; keep it under (\d+)", text)
    if m:
        a, mx = int(m.group(1)), int(m.group(2))
        code = {D.MAX_SCENE_TEXT: "SCENE_LENGTH_EXCEEDED", D.MAX_LINE: "LINE_TOO_LONG", D.MAX_LABEL: "CHOICE_TOO_LONG",
                D.MAX_TITLE: "TITLE_TOO_LONG"}.get(mx, "TEXT_TOO_LONG")
        return code, a, mx, LENGTH_ACTION[code]
    m = re.search(r"under (\d+) characters \(this one is (\d+)\)", text)
    if m:
        return "TEXT_TOO_LONG", int(m.group(2)), int(m.group(1)), LENGTH_ACTION["TEXT_TOO_LONG"]
    for pat, code, act in CODES:
        if re.search(pat, text, re.I):
            return code, None, None, act
    return "SCRIPT_ERROR", None, None, ""


def _scene_src(p: dict, s: dict) -> tuple:
    """The script the game would compile for one scene alone: the header, the outline, the scene. -> (src, offset)."""
    head = header_text(p) + "\n" + outline_text(p) + "\n\n"
    return head + (s.get("text") or "").rstrip() + "\n", head.count("\n")


OTHER_SCENE_WARN = re.compile(r"^scene \d+: (scene \d+ has no choice like|only if a choice in scene)", re.I)


def _ckey(p: dict, s: dict) -> str:
    """What a scene's check depends on: its text, the header and the outline (an edit to either checks it again)."""
    return _hash(header_text(p) + "\n" + outline_text(p) + "\n" + (s.get("text") or ""))


def _sentence(why: str) -> str:
    """The engine's "it never asks you anything: ..." as "This scene never asks you anything: ..."."""
    return "This scene " + (why[3:] if why.startswith("it ") else why)


EXISTING = "from the storyline you have"


def scene_library(p: dict) -> dict | None:
    """What a scene alone needs from your storylines to compile the way the game compiles it: for an expansion
    (`expands: X`), its storyline X (the cast it shares). Everything else needs nothing (and loads nothing)."""
    from . import dialogue
    m = next((re.match(r"\s*expands\s*:\s*(.+?)\s*$", h, re.I) for h in p.get("header") or [] if re.match(r"\s*expands\s*:", h, re.I)), None)
    if not m:
        return None
    lib = dialogue.library()
    parent = lib.get(m.group(1).strip().lower())
    return {m.group(1).strip().lower(): parent} if parent else lib


def validate_scene(p: dict, s: dict, lib: dict | None = None) -> list:
    """One scene through the game's own compiler and checker (script.compile_script -> dialogue.check: the same code an
    import runs), inside its storyline's header and outline, plus the completeness rules the scene merge uses. Its
    diagnostics are stored on it, with line numbers counted inside the scene."""
    from . import script as SC
    if not s.get("text"):
        s["diag"], s["checked"] = [], None
        return []
    src, off = _scene_src(p, s)
    r = SC.compile_script(src, library=lib if lib is not None else scene_library(p))
    out, head_errs = [], []
    old_scene = s.get("origin") == "existing"  # (in the game like this already: new-writing rules are advice for it)
    for e in r["errors"]:
        if e["line"] <= off:  # the header or outline itself: every scene would fail on it, so say that once, plainly
            head_errs.append(e["text"])
            continue
        code, a, mx, act = classify(e["text"])
        out.append(_diag("error", code, s["n"], _say(e["text"]), line=e["line"] - off, actual=a, limit=mx, action=act))
    if head_errs:
        out.insert(0, _diag("error", "STORYLINE_HEADER_ERROR", s["n"], "The storyline's header or outline has a problem, so "
                            "this scene can't be checked yet: " + head_errs[0], action="Fix it under Outline (Project info), then check again."))
    for wv in r["warnings"]:
        if wv["line"] <= off or OTHER_SCENE_WARN.search(wv["text"]):
            continue  # (about the outline, or another scene: reported once for the whole storyline)
        code, a, mx, act = classify(wv["text"])
        out.append(_diag("warning", code if code != "SCRIPT_ERROR" else "SCRIPT_WARNING", s["n"], _say(wv["text"]),
                         line=wv["line"] - off, actual=a, limit=mx, action=act))
    pack = (r["packs"] or [{}])[0]
    entry = next((e for e in pack.get("outline") or [] if e.get("n") == s["n"]), None)
    sc = next((x for x in pack.get("scenes") or [] if entry and x.get("id") == entry.get("sid")), None)
    if sc is None and not r["errors"]:
        out.append(_diag("error", "SCENE_UNREADABLE", s["n"], "The game couldn't find a scene in this text.",
                         action="Start it with its header line: `--- N. Title`."))
    if sc is not None:
        why = SC.no_choices(sc)
        if why:
            out.append(_diag("warning" if old_scene else "error", "NO_CHOICES", s["n"], _sentence(why) + "." + (
                " (It's in the game like this already: it plays with a Continue.)" if old_scene else ""),
                action="End it on a question with 2 to 4 choices."))
        else:
            short = SC.stops_short(sc, True)
            if short or s.get("truncated"):
                out.append(_diag("warning" if old_scene and not s.get("truncated") else "error", "SCENE_INCOMPLETE", s["n"], "This scene looks cut off: " + (
                    short[3:] if short and short.startswith("it ") else short or "the reply ended partway (its code block never closed)") + ".",
                    action="Ask for the complete scene again (Copy repair prompt)."))
            one = SC.no_question(sc)
            if one and "only has one choice" in one:
                out.append(_diag("warning", "ONE_CHOICE", s["n"], _sentence(one) + ".", action="Give it 2 to 4 choices."))
            for g in SC.choice_gaps(sc):
                out.append(_diag("warning", "CHOICE_WITHOUT_OUTCOME", s["n"], g[:1].upper() + g[1:] + ".",
                                 action="Write what happens after that choice (a line or two)."))
            for lab in _marked_labels(sc.get("choices")):
                out.append(_diag("warning", "CHOICE_MARK_IN_LABEL", s["n"], f"The choice “{lab}” would show with its * in the game.",
                                 action="Write a choice inside a choice as `* ` indented under it."))
    head = (s.get("text") or "").split("\n", 1)[0]
    tags = re.search(r"\[([^\]]*)\]", head)
    if tags and re.search(r"\b(after|if|unless)\b", tags.group(1), re.I):
        out.append(_diag("info", "OUTLINE_DECIDES", s["n"], f"The [{tags.group(1).strip()}] on this scene's header line is ignored: "
                         "in an outlined storyline the outline decides when a scene plays and what it waits for.",
                         action="Put the condition on the scene's outline line instead (| only if you picked \"X\" in N)."))
    if s.get("tidied"):
        out.append(_diag("info", "NORMALIZED", s["n"], "Tidied the format (nothing reworded or dropped): " + "; ".join(s["tidied"][:4])
                         + ("…" if len(s["tidied"]) > 4 else ""), action="The scene as pasted is kept: View original."))
    ht = s.get("header_title")
    if ht and ht.strip().lower() != s["title"].strip().lower() and not difflib.get_close_matches(ht.lower(), [s["title"].lower()], cutoff=0.6):
        out.append(_diag("info", "TITLE_DIFFERS", s["n"], f"The pasted header says “{ht}”; the outline calls scene {s['n']} “{s['title']}”.",
                         action=f"It goes in as scene {s['n']} with the outline's title."))
    s["diag"] = out
    s["checked"] = _ckey(p, s)
    return out


def _marked_labels(chs) -> list:
    """Choice labels (at any depth) that still start with a * mark: shown to the player as written."""
    out = []
    for c in chs or []:
        if not isinstance(c, dict):
            continue
        if str(c.get("label") or "").startswith("*"):
            out.append(c["label"])
        if isinstance(c.get("then"), dict):
            out += _marked_labels(c["then"].get("choices"))
    return out


def _errors(s: dict) -> bool:
    return any(d["severity"] == "error" for d in s.get("diag") or [])


def _received(p: dict) -> list:
    return [s for s in p["scenes"] if s.get("text")]


def _placed(p: dict, s: dict) -> str:
    """A scene's text for the assembled script: as written when its header already finds its place in the outline (by
    number, or by title), else with the header rewritten to `--- N. Title` so the game puts it where it belongs."""
    text = s["text"].rstrip()
    head = text.split("\n", 1)[0]
    try:
        n, _t = _block_number([head], p)
    except AttributeError:  # (no header line at all)
        n = None
    return text if n == s["n"] else _retitle(text, s["n"], s["title"])


def assemble(p: dict, only_valid: bool = False) -> str:
    """The storyline as one script: header, outline, then every received scene in order (its own text, untouched)."""
    parts = [header_text(p), outline_text(p), ""]
    for s in p["scenes"]:
        if not s.get("text"):
            continue
        if only_valid and any(d["severity"] == "error" for d in s.get("diag") or []):
            continue
        parts.append(_placed(p, s))
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def validate_all(p: dict, sim=None, library: dict | None = None) -> dict:
    """Every scene (only the ones that changed are compiled again) plus the storyline as a whole: missing scenes,
    choices later scenes depend on, memory keys nothing sets, calendar problems, shared-event continuity.
    -> {diagnostics, scenes: {n: status}, counts, blockers}"""
    from . import script as SC
    stale = [s for s in _received(p) if s.get("checked") != _ckey(p, s)]
    lib = scene_library(p) if stale else None
    for s in stale:
        validate_scene(p, s, lib)
    diags = [d for s in p["scenes"] for d in s.get("diag") or []]
    for d in p.get("outline_issues") or []:
        diags.append(d)
    missing = [s["n"] for s in p["scenes"] if not s.get("text")]
    if missing:
        diags.append(_diag("warning", "SCENES_MISSING", None, f"{len(missing)} scene{'s' if len(missing) != 1 else ''} not written yet: "
                           + _ranges(missing) + ".", action="Paste them, or import what's written (the rest stay in the outline)."))
    # the storyline as a whole, compiled the way an import compiles it (with your library: facts other storylines
    # remember, titles in use): the outline's own problems, choices later scenes wait for, cross-scene clashes
    full = assemble(p, only_valid=True)
    r = SC.compile_script(full, library=library)
    spans = _scene_spans(full)
    seen = {(d.get("scene"), d["message"]) for d in diags}
    for sev, items in (("error", r["errors"]), ("warning", r["warnings"])):
        for e in items:
            n, start = _scene_at(spans, e["line"])
            code, a, mx, act = classify(e["text"])
            m = re.match(r"scene (\d+):", e["text"])
            if sev == "warning" and (OTHER_SCENE_WARN.search(e["text"]) or "plays either way" in e["text"]):
                code, n = "CHOICE_DEPENDENCY", int(m.group(1)) if m else n
                act = "Give the earlier scene that choice (or change what the later scene waits for)."
            elif n is None:
                code = ("OUTLINE_ERROR" if sev == "error" else "OUTLINE_WARNING") if code in ("SCRIPT_ERROR",) else code
                mm = re.search(r"\bscene (\d+)\b", e["text"])
                n = int(mm.group(1)) if mm else None
            elif sev == "warning" and code == "SCRIPT_ERROR":
                code = "SCRIPT_WARNING"
            if code == "MEMORY_NEVER_SET":
                act += " (If a scene that isn't pasted yet remembers it, this clears when that scene comes in.)"
            if (n, e["text"]) in seen or (n, _say(e["text"])) in seen:
                continue
            seen.add((n, e["text"]))
            diags.append(_diag(sev, code, n, _say(e["text"]), line=(e["line"] - start + 1) if start else None, actual=a, limit=mx,
                               action=act, storyline=p["title"]))
    pack = (r["packs"] or [{}])[0]
    sc_of = {e["n"]: next((x for x in pack.get("scenes") or [] if x.get("id") == e.get("sid")), None) for e in pack.get("outline") or []}
    written = {s["n"] for s in _received(p)}
    for n2, (neg, label, src_n) in sorted(_conditions(p).items()):
        src_sc = sc_of.get(src_n)
        if src_sc is None or n2 in written:  # (once the later scene is in, the compiler says it, on that scene)
            continue
        if SC.find_choice(src_sc, label) is None:
            diags.append(_diag("warning", "CHOICE_DEPENDENCY", src_n, f"Scene {n2} only happens if you {'did not pick' if neg else 'picked'} "
                               f"“{label}” in scene {src_n}, and scene {src_n} has no choice like that.",
                               action=f"Give scene {src_n} a choice like “{label}” (Copy repair prompt), or change scene {n2}'s outline line."))
    if sim is not None:
        try:
            from . import storycal
            ys = storycal.years_in(header_text(p) + "\n" + outline_text(p)) or None
            outline = [{"n": s["n"], "when": s.get("when"), "when_raw": s.get("when")} for s in p["scenes"]]
            for n, why in storycal.check_outline(sim, outline, ys):
                diags.append(_diag("warning", "SCHEDULE", n, why, action="Use a when from the calendar (Write more lists them)."))
        except Exception:  # noqa: BLE001  (the calendar check is advice: it never stops validation)
            pass
    for s in p["scenes"]:
        for dep in (s.get("meta") or {}).get("depends") or []:
            try:
                dep = int(dep)
            except (TypeError, ValueError):
                continue
            if dep not in {x["n"] for x in p["scenes"]}:
                diags.append(_diag("warning", "MISSING_DEPENDENCY", s["n"], f"Scene {s['n']} builds on scene {dep}, which isn't in the outline.",
                                   action="Fix the number, or take the dependency off."))
            elif dep > s["n"]:
                diags.append(_diag("warning", "DEPENDENCY_ORDER", s["n"], f"Scene {s['n']} builds on scene {dep}, which comes after it.",
                                   action="Scenes play in order: move one of them."))
    diags += continuity(p)
    diags += memory_report(p, library)["diagnostics"]
    copied = _copied_ns(p)
    statuses = {s["n"]: scene_status(p, s, copied) for s in p["scenes"]}
    counts = {sev: sum(1 for d in diags if d["severity"] == sev and d["code"] != "NORMALIZED") for sev in ("error", "warning", "info")}
    counts["tidied"] = sum(1 for d in diags if d["code"] == "NORMALIZED")
    blockers = [d for d in diags if d["severity"] == "error"]
    p["validated_at"] = time.time()
    p["diagnostics"] = diags
    return {"diagnostics": diags, "scenes": statuses, "counts": counts, "blockers": len(blockers), "missing": missing}


def _ranges(ns: list) -> str:
    ns = sorted(ns)
    out, start, prev = [], None, None
    for n in ns:
        if start is None:
            start = prev = n
        elif n == prev + 1:
            prev = n
        else:
            out.append(f"{start}" if start == prev else f"{start}-{prev}")
            start = prev = n
    if start is not None:
        out.append(f"{start}" if start == prev else f"{start}-{prev}")
    return ", ".join(out)


def _scene_spans(text: str) -> list:
    from . import script as SC
    spans = []
    for i, ln in enumerate(text.split("\n"), start=1):
        m = SC.SCENE_RE.match(ln.strip())
        if m:
            mm = re.match(r"(\d+)", m.group(1))
            spans.append((i, int(mm.group(1)) if mm else None))
    return spans


def _scene_at(spans: list, line: int) -> tuple:
    """(scene number, its first line) of a line in an assembled script; (None, None) in the header or outline."""
    n, start = None, None
    for first, num in spans:
        if first <= line:
            n, start = num, first
    return n, start


# ------------------------------------------------------------------------------------------------- shared context (P2)

def _shared_path() -> str:
    return os.path.join(folder(), "_shared.json")


def shared() -> dict:
    try:
        with open(_shared_path(), encoding="utf-8") as f:
            d = json.load(f)
    except (OSError, ValueError):
        d = {}
    d.setdefault("v", 1)
    d.setdefault("characters", {})
    d.setdefault("events", {})
    return d


def _key(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (s or "").lower()).strip("_")[:60]


CHAR_FIELDS = ("name", "aliases", "world_id", "relationships", "personality", "history", "goals", "boundaries", "status", "notes")
EVENT_FIELDS = ("name", "when", "notes", "owner")


def set_character(fields: dict) -> dict:
    """A reusable character brief (production notes for prompts: the world's character is never changed by this)."""
    d = shared()
    k = _key(fields.get("key") or fields.get("name") or "")
    if not k:
        raise ProductionError("a character brief needs a name")
    if fields.get("delete"):
        d["characters"].pop(k, None)
    else:
        b = d["characters"].get(k, {})
        for f in CHAR_FIELDS:
            if f in fields:
                b[f] = ([str(x).strip() for x in fields[f] if str(x).strip()] if f == "aliases" else str(fields[f] or "")[:2000])
        b.setdefault("status", "canon")
        d["characters"][k] = b
    _write(_shared_path(), d)
    return d


def set_event(fields: dict) -> dict:
    """A shared occasion several storylines can point at (an owner storyline defines it; others refer to it)."""
    d = shared()
    k = _key(fields.get("key") or fields.get("name") or "")
    if not k:
        raise ProductionError("a shared event needs a name")
    if fields.get("delete"):
        d["events"].pop(k, None)
    else:
        ev = d["events"].get(k, {})
        for f in EVENT_FIELDS:
            if f in fields:
                ev[f] = fields[f] if f == "owner" else str(fields[f] or "")[:2000]
        d["events"][k] = ev
    _write(_shared_path(), d)
    return d


def continuity(p: dict) -> list:
    """Soft continuity notes across projects that share an occasion: who else uses it, two storylines both claiming to
    define it, an occasion nobody recorded. Warnings and notes only: they never block an import."""
    sh = shared()
    mine = {}
    for s in p["scenes"]:
        ev = (s.get("meta") or {}).get("event")
        if ev:
            mine.setdefault(ev, []).append(s["n"])
    if not mine:
        return []
    others = []
    for row in list_projects():
        if row["id"] == p["id"]:
            continue
        try:
            q = load(row["id"])
        except (KeyError, OSError, ValueError):
            continue
        for s in q["scenes"]:
            ev = (s.get("meta") or {}).get("event")
            if ev in mine:
                others.append((ev, q["title"], s["n"]))
    out = []
    for ev, ns in mine.items():
        rec = sh["events"].get(ev)
        if rec is None:
            out.append(_diag("info", "EVENT_UNREGISTERED", ns[0], f"Scenes {_ranges(ns)} are part of “{ev}”, which isn't in the "
                             "shared events yet.", action="Add it under Shared events so other storylines can point at it."))
        also = [(t, n) for e2, t, n in others if e2 == ev]
        if also:
            out.append(_diag("info", "EVENT_SHARED", ns[0], f"“{(rec or {}).get('name') or ev}” is also in "
                             + "; ".join(f"{t} (scene {n})" for t, n in also[:5]) + ".",
                             action="Keep the details the same across them (who's there, what happens)."))
        owner = (rec or {}).get("owner") or {}
        if owner.get("project") and owner.get("project") != p["id"] and any(
                str(n) == str(owner.get("scene")) for n in ns) is False and any((s.get("meta") or {}).get("defines_event") for s in p["scenes"]):
            out.append(_diag("warning", "EVENT_OWNER_CONFLICT", ns[0], f"“{rec.get('name') or ev}” belongs to {owner.get('title') or owner.get('project')}, "
                             "and a scene here also defines it.", action="Have this storyline refer to it instead of redefining it."))
    return out


def _tag_reads(text: str) -> list:
    """`[... · if mike_said_sorry]` / `if not x` facts on a scene's header line."""
    m = re.search(r"\[([^\]]*)\]", (text or "").split("\n", 1)[0])
    if not m:
        return []
    out = []
    for tok in re.split(r"\s*[·;,]\s*", m.group(1)):
        mm = re.fullmatch(r"(?:if|unless)\s+(?:not\s+)?([a-z][a-z0-9_]{2,79})", tok.strip())
        if mm:
            out.append(mm.group(1))
    return out


def _near_names(names: list, pool: set) -> list:
    """Pairs (a name here, a name anywhere) one typo apart: the same with underscores ignored, or one letter changed, added
    or dropped. A one-deletion index keeps this linear in a big library (thousands of facts), not one comparison per pair."""
    flat = lambda s: s.replace("_", "")  # noqa: E731
    index: dict = {}
    for k in pool:
        f = flat(k)
        for v in {f} | {f[:i] + f[i + 1:] for i in range(len(f))}:
            index.setdefault(v, set()).add(k)
    out, seen = [], set()
    for a in names:
        f = flat(a)
        hits = set()
        for v in {f} | {f[:i] + f[i + 1:] for i in range(len(f))}:
            hits |= index.get(v, set())
        for b in sorted(hits - {a}):
            if len(f) < 6 and flat(b) != f:
                continue  # (short names one letter apart are usually different facts)
            pair = (min(a, b), max(a, b))
            if pair not in seen:
                seen.add(pair)
                out.append((a, b))
    return out


def memory_report(p: dict, library: dict | None = None) -> dict:
    """The memory keys (facts) this project's scenes write with `remember x` and the ones scenes wait on, beside what your
    other storylines and production projects write and wait on. Soft notes only: a fact nobody remembers, a fact other
    storylines wait for that this storyline writes (so you see the connection), names so alike they're probably one fact.
    -> {writes: {fact: [n]}, reads: {fact: [n]}, elsewhere: {fact: [where]}, waits: {fact: [where]}, diagnostics}"""
    from . import dialogue as D
    from . import script as SC
    writes, reads = {}, {}
    for s in _received(p):
        for ln in s["text"].split("\n"):
            m = SC.CMD_RE.match(ln.strip())
            if m and m.group(1) == "remember":
                writes.setdefault(m.group(2), []).append(s["n"])
        for f in _tag_reads(s["text"]):
            reads.setdefault(f, []).append(s["n"])
    elsewhere, waits = {}, {}
    for name, pk in (library or {}).items():
        if name.strip().lower() == p["title"].strip().lower():
            continue
        for sc in pk.get("scenes") or []:
            if not isinstance(sc, dict):
                continue
            for op in D._all_ops(sc):
                if isinstance(op, list) and len(op) > 1 and op[0] == "remember":
                    elsewhere.setdefault(op[1], set()).add(pk.get("name") or name)
            for f in (sc.get("when") or {}).get("remembered") or []:
                waits.setdefault(f, set()).add(pk.get("name") or name)
    for row in list_projects():
        if row["id"] == p["id"]:
            continue
        try:
            q = load(row["id"])
        except (KeyError, OSError, ValueError):
            continue
        for s in q["scenes"]:
            for ln in (s.get("text") or "").split("\n"):
                m = SC.CMD_RE.match(ln.strip())
                if m and m.group(1) == "remember":
                    elsewhere.setdefault(m.group(2), set()).add(q["title"] + " (production)")
    diags = []
    # (facts a scene's own header waits on are ignored in an outlined storyline: OUTLINE_DECIDES says so on the scene)
    for k, ns in sorted(writes.items()):
        if k in waits:
            diags.append(_diag("info", "MEMORY_READ_ELSEWHERE", ns[0], f"“{k}” (remembered in scene {ns[0]}) is what "
                               + ", ".join(sorted(waits[k])[:3]) + " waits for.", action="Keep the name exactly the same."))
    names = sorted(set(writes) | set(reads))
    for x, y in _near_names(names, set(names) | set(elsewhere)):
        diags.append(_diag("info", "MEMORY_SIMILAR", (writes.get(x) or reads.get(x) or [None])[0],
                           f"“{x}” and “{y}” are almost the same name.", action="If they're meant to be one fact, use one name."))
    return {"writes": writes, "reads": reads, "elsewhere": {k: sorted(v) for k, v in elsewhere.items()},
            "waits": {k: sorted(v) for k, v in waits.items()}, "diagnostics": diags}


# ------------------------------------------------------------------------------------------------ preview and import

def _existing(p: dict) -> tuple:
    """(pack id, its script, its compiled pack) of the storyline this would update: the one you picked (target), or one of
    yours with this title. (None, None, None) when it would be new."""
    from . import dialogue
    rows = [pk for pk in dialogue.packs() if str(pk["id"]).startswith("yours:") and pk.get("kind") == "script"]
    hit = None
    if p.get("target"):
        hit = next((pk for pk in rows if pk["id"] == p["target"]), None)
    if hit is None:
        hit = next((pk for pk in rows if (pk["pack"].get("name") or "").strip().lower() == p["title"].strip().lower()), None)
    return (hit["id"], hit["script"], hit["pack"]) if hit else (None, None, None)


def _by_number(pack: dict | None) -> dict:
    """A compiled outlined storyline's written scenes: {n: (scene id, title, its text as written)}."""
    if not pack:
        return {}
    scs = {sc.get("id"): sc for sc in pack.get("scenes") or [] if isinstance(sc, dict)}
    return {e["n"]: (e["sid"], e["title"], (scs.get(e["sid"]) or {}).get("src") or "")
            for e in pack.get("outline") or [] if e.get("sid") and e["sid"] in scs}


def adopt_existing(p: dict) -> list:
    """Bring the scenes the storyline you have already has (and this project doesn't) into the project, so an import
    keeps them. -> the scene numbers brought in."""
    _pid, _old, pack = _existing(p)
    have = {s["n"] for s in _received(p)}
    outline_ns = {s["n"] for s in p["scenes"]}
    got = []
    texts = []
    for n, (_sid, _t, text) in sorted(_by_number(pack).items()):
        if n in outline_ns and n not in have and text.strip():
            texts.append(text.strip())
            got.append(n)
    if texts:
        intake(p, "\n\n".join(texts), only=set(got), source=EXISTING)
    return got


def _same_script(a: str, b: str) -> bool:
    """The same storyline, apart from blank lines and spaces at line ends (what an unedited round trip can change)."""
    norm = lambda t: [ln.rstrip() for ln in t.replace("\r\n", "\n").split("\n") if ln.strip()]  # noqa: E731
    return norm(a) == norm(b)


def preview(p: dict, sim=None, allow_partial: bool = False) -> dict:
    """What an import would do, before it does anything: the storyline, its scenes, the validation, what's missing, which
    scenes it replaces and adds, scenes it would remove, which replaced scenes you already played (and any whose id would
    change, so the game would treat them as new), and a diff against the version you have. Nothing is written."""
    from . import dialogue
    from . import script as SC
    lib = dialogue.library()
    v = validate_all(p, sim, lib)
    text = assemble(p, only_valid=False)
    pid, old, old_pack = _existing(p)
    r = SC.compile_script(text, library=lib)
    new_pack = next((pk for pk in r["packs"] if pk.get("outline")), None)
    was, now = _by_number(old_pack), _by_number(new_pack)
    done = (sim.w.meta.get("scenes_done") or {}) if sim is not None else {}
    replaced = [n for n in sorted(now) if n in was and was[n][2].strip() != now[n][2].strip()]
    added = [n for n in sorted(now) if n not in was]
    removed = [n for n in sorted(was) if n not in now]
    played = [n for n in sorted(now) if n in was and was[n][0] in done]
    renamed = [n for n in played if was[n][0] != now[n][0]]
    mode = "new"
    if pid:
        if _same_script(old or "", text):
            mode = "unchanged"
        else:
            mode = "update" if (p.get("target") == pid or dialogue._is_update(old, text)) else "copy"
    diff = list(difflib.unified_diff((old or "").split("\n"), text.split("\n"), "now", "after import", lineterm="", n=1))[:600] if old else []
    blockers = [d for d in v["diagnostics"] if d["severity"] == "error"]
    if v["missing"] and not allow_partial:
        blockers.append(_diag("error", "SCENES_MISSING", None, f"{len(v['missing'])} scenes aren't written yet ({_ranges(v['missing'])}).",
                              action="Paste them, or choose to import what's written (the rest stay in the outline, unwritten)."))
    if removed and mode == "update":
        blockers.append(_diag("error", "IMPORT_WOULD_REMOVE", removed[0], f"The storyline you have has scene{'s' if len(removed) > 1 else ''} "
                              f"{_ranges(removed)} written, and this project doesn't: importing would take {'them' if len(removed) > 1 else 'it'} out.",
                              action="Bring them into the project first (Keep the scenes you have), or write them here."))
    acks = []
    if renamed:
        acks.append(f"You've already played scene{'s' if len(renamed) > 1 else ''} {_ranges(renamed)}, and {'their' if len(renamed) > 1 else 'its'} "
                    "title (or the storyline's) changed: the game will treat " + ("them" if len(renamed) > 1 else "it") + " as new and can play it again.")
    if mode == "copy":
        acks.append(f"You already have a storyline called “{p['title']}” that this doesn't replace (it isn't the same storyline, newer): "
                    "it goes in alongside it with its own name, and yours is untouched."
                    + (f" If it's meant to be that storyline, Keep the scenes you have ({_ranges(removed)}) first and it becomes an update."
                       if removed else ""))
    cast = [h.split(":", 1)[1].strip() for h in p.get("header") or [] if h.strip().lower().startswith("cast:")]
    got = [s["n"] for s in _received(p)]
    return {"title": p["title"], "scenes": len(got), "of": len(p["scenes"]), "range": [min(got), max(got)] if got else None,
            "cast": cast, "validation": v["counts"], "diagnostics": v["diagnostics"], "missing": v["missing"],
            "mode": mode, "existing": pid, "replaced": replaced, "new": added, "removed": removed, "played": played,
            "played_renamed": renamed, "acknowledge": acks, "diff": diff, "can_import": not blockers and mode != "unchanged",
            "blockers": blockers, "chars": len(text)}


def import_project(p: dict, sim=None, allow_partial: bool = False, confirm: bool = False, acknowledge: bool = False) -> dict:
    """Import on confirmation only. Everything is checked first (the same preview), then the game's own add_script writes
    it: strict (nothing is changed or dropped on the way in), compiled before anything is written, one storyline file
    replaced at once (never half), the version it replaces kept in the storyline's history (restorable), and never over
    a different storyline that happens to have the same name. The world and your save (who's who, what happened, what you
    chose, what you played) are never touched: storylines are content. Importing the same thing again changes nothing."""
    from . import dialogue
    if not confirm:
        raise ProductionError("an import needs your confirmation (preview it first)")
    pv = preview(p, sim, allow_partial)
    if pv["mode"] == "unchanged":
        return {"ok": True, "unchanged": True, "pack": pv["existing"], "mode": "unchanged", "replaced": [], "new": [], "notes": [], "warnings": []}
    if not pv["can_import"]:
        raise ProductionError(pv["blockers"][0]["message"])
    if pv["acknowledge"] and not acknowledge:
        raise ProductionError(pv["acknowledge"][0] + " Tick the box to go ahead.")
    text = assemble(p, only_valid=False)
    into = pv["existing"] if pv["mode"] == "update" else None
    try:
        r = dialogue.add_script(text, into=into, strict=True)
    except OSError as e:  # (a disk problem: add_script writes one file at once, so nothing is half written)
        raise ProductionError(f"couldn't write the storyline: {e}")
    if not r.get("ok"):
        raise ProductionError("the game refused it: " + "; ".join(r.get("errors") or [])[:400])
    pack = r["ids"][0] if r.get("ids") else into
    p["imported"] = {"pack": pack, "at": time.time(), "hash": _hash(text), "mode": pv["mode"], "scenes": [s["n"] for s in _received(p)]}
    p["target"] = pack
    for s in _received(p):
        s["imported_hash"] = _hash(s["text"])
    return {"ok": True, "pack": pack, "mode": pv["mode"], "replaced": pv["replaced"], "new": pv["new"],
            "notes": r.get("notes", []), "warnings": r.get("warnings", []),
            "undo": "The version it replaced is kept: Story Studio → Older versions brings it back." if pv["mode"] == "update" else None}


# ---------------------------------------------------------------------------------------------------------------- views

def summary(p: dict) -> dict:
    copied = _copied_ns(p)
    sts = [scene_status(p, s, copied) for s in p["scenes"]]
    return {"id": p["id"], "title": p["title"], "scenes": len(p["scenes"]), "received": sum(1 for s in p["scenes"] if s.get("text")),
            "errors": sum(1 for x in sts if x == "needs_correction"), "validated": sum(1 for x in sts if x in ("validated", "imported")),
            "imported": bool(p.get("imported")), "updated": p.get("updated"), "batches": len(batches(p))}


def view(p: dict) -> dict:
    """The project for the workspace: scenes with status and issues, batches with status, context, counts."""
    copied = _copied_ns(p)
    rows = []
    for s in p["scenes"]:
        st = scene_status(p, s, copied)
        rows.append({"uid": s["uid"], "n": s["n"], "title": s["title"], "when": s.get("when") or "", "summary": s.get("summary") or "",
                     "if": s.get("if"), "meta": s.get("meta") or {}, "status": st, "has_text": bool(s.get("text")),
                     "chars": len(s.get("text") or ""), "diag": s.get("diag") or [], "versions": len(s.get("history") or [])})
    st_by_n = {r["n"]: r["status"] for r in rows}
    bs = []
    for b in batches(p):
        sts = [st_by_n[n] for n in b["ns"]]
        c = p["copied"].get(str(b["i"])) or {}
        bs.append({**b, "status": batch_status(sts), "received": sum(1 for x in sts if x not in ("planned", "prompt_copied")),
                   "errors": sum(1 for x in sts if x == "needs_correction"), "copied_snapshot": c.get("snapshot"),
                   "stale": bool(c) and c.get("snapshot") != p["snapshot"]})
    return {"id": p["id"], "title": p["title"], "batch_size": p["batch_size"], "snapshot": p["snapshot"], "context": p["context"],
            "header": p.get("header") or [], "scenes": rows, "batches": bs, "next": next_unfinished(p), "target": p.get("target"),
            "imported": p.get("imported"), "outline_issues": p.get("outline_issues") or [], "summary": summary(p),
            "unplaced": [{"k": k, "n": u.get("n"), "title": u.get("title"), "why": u.get("why"), "at": u.get("at"), "text": u.get("text")}
                         for k, u in enumerate(p.get("unplaced") or [])][::-1],
            "removed": len(p.get("removed") or []), "statuses": STATUS_LABEL}


def scene_detail(p: dict, n: int) -> dict:
    s = next((x for x in p["scenes"] if x["n"] == n), None)
    if s is None:
        raise ProductionError(f"there's no scene {n}")
    raw = next((x["text"] for x in p["pastes"] if x["id"] == s.get("paste")), None)
    return {"n": s["n"], "title": s["title"], "text": s.get("text") or "", "diag": s.get("diag") or [],
            "history": [{"k": i, "at": h.get("at"), "chars": len(h.get("text") or ""), "text": h.get("text")} for i, h in enumerate(s.get("history") or [])],
            "paste": raw}


# ---------------------------------------------------------------------------------------------------------- backups

def bundle() -> dict:
    """Production projects and shared context, to travel in a .lifeos backup (optional; older backups have none)."""
    d = folder()
    out = {"projects": [], "shared": shared() if os.path.exists(_shared_path()) else None}
    if os.path.isdir(d):
        for fn in sorted(os.listdir(d)):
            if fn.startswith("prj_") and fn.endswith(".json"):
                try:
                    with open(os.path.join(d, fn), encoding="utf-8") as f:
                        out["projects"].append(json.load(f))
                except (OSError, ValueError):
                    continue
    return out


def install(b: dict | None) -> int:
    """A backup's projects into this copy: one you don't have is added; one you have keeps whichever was updated last."""
    if not b:
        return 0
    n = 0
    for p in b.get("projects") or []:
        try:
            path = _path(p.get("id", ""))
        except ProductionError:
            continue
        if os.path.exists(path):
            try:
                with open(path, encoding="utf-8") as f:
                    mine = json.load(f)
                if (mine.get("updated") or 0) >= (p.get("updated") or 0):
                    continue
            except (OSError, ValueError):
                pass
        _write(path, p)
        n += 1
    if b.get("shared") and not os.path.exists(_shared_path()):
        _write(_shared_path(), b["shared"])
    return n
