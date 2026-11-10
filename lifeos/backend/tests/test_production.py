"""Story Studio production pipeline (V2): outline -> parallel writing batches -> paste in any order -> validate with the
game's own compiler -> focused repairs -> preview -> safe import. Tests A-K of the handoff, plus the API end to end."""
import json
import os
import sys
import time

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import dialogue, production as PR, script  # noqa: E402


@pytest.fixture(autouse=True)
def own_dirs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


# the test ensemble (names live here, in the test data: nothing in the engine knows them)
ENSEMBLE = [("zack", "Zack Soffer"), ("nikki", "Nikki Basilicato"), ("jen", "Jennifer Soffer"), ("nicole", "Nicole Soffer"),
            ("mike", "Mike Soffer"), ("viv", "Vivienne Whitmore")]
HEADER = "=== Watch Hill Summer\n" + "".join(f"cast: {a} = {n}\n" for a, n in ENSEMBLE[1:]) + \
         "years: sophomore\nabout: A summer at the beach with everybody.\n"
MONTHS = ["June"] * 14 + ["July"] * 14 + ["August"] * 12


def outline_text(n=40, cond=None):
    lines = []
    for i in range(1, n + 1):
        line = f"{i}. Beach Day {i} | {MONTHS[i - 1] if i % 5 == 1 else ''} | Something happens at the beach, part {i}."
        if cond and i == cond[0]:
            line += f" | only if you picked \"{cond[1]}\" in {cond[2]}"
        lines.append(line)
    return HEADER + "\noutline:\n" + "\n".join(lines) + "\n"


def scene(i, who="nikki", extra="", title=None, choices=('"Yeah."', '"Not really."')):
    """A complete, valid scene the way an outside chat writes it (lines under each choice, flush left)."""
    t = title or f"Beach Day {i}"
    out = [f"--- {i}. {t}", "The sun's out and the sand is hot.", f"{who}: You coming in or what? (day {i})",
           "jen: Don't let him chicken out."]
    if extra:
        out.append(extra)
    for k, c in enumerate(choices):
        out.append(f"* {c} | {who} affection +" if k == 0 else f"* {c}")
        out.append(f"{who}: {'Good.' if k == 0 else 'Fine, suit yourself.'}")
    return "\n".join(out) + "\n"


def batch_reply(ns, chatty=True, **kw):
    body = "\n".join(scene(i, **kw) for i in ns)
    return f"Here are scenes {ns[0]} to {ns[-1]}!\n```\n{body}```\nLet me know if you want any changes." if chatty else body


def project(n=40, cond=None, **kw):
    return PR.create(outline_text(n, cond), **kw)


# ---------------------------------------------------------------------------------------------- A: standard 40 / 7

def test_a_standard_forty_scenes_in_seven_batches_of_six_with_self_contained_prompts():
    p = project()
    assert len(p["scenes"]) == 40 and not [d for d in p["outline_issues"] if d["severity"] == "error"]
    bs = PR.batches(p)
    assert len(bs) == 7 and [b["ns"] for b in bs][-1] == [37, 38, 39, 40] and bs[0]["ns"] == [1, 2, 3, 4, 5, 6]
    b7 = PR.batch_prompt(p, 7)
    t = b7["prompt"]
    # self-contained: identity, header with the cast, the whole outline, its scenes, the engine's rules and limits
    for must in ("LIFE OS", "=== Watch Hill Summer", "cast: nikki = Nikki Basilicato", "## The whole outline", "37. Beach Day 37",
                 "<- yours", "### Scene 40: Beach Day 40", "## How a scene is written", "## Your reply",
                 f"at most {dialogue.MAX_SCENE_TEXT:,} characters", f"at most {dialogue.MAX_LINE} characters",
                 f"at most {dialogue.MAX_LABEL} characters", "Only scenes 37 to 40", "never stop partway",
                 "Don't assume what I chose in any other scene"):
        assert must in t, must
    assert t.count("<- yours") == 4 and "Beach Day 36   <- yours" not in t
    assert "## The scene right before" not in t, "no other batch's text: batches can run at the same time"
    assert PR.batch_prompt(p, 7)["prompt"] == t, "deterministic: the same project gives the same prompt"
    assert b7["snapshot"] == p["snapshot"] and f"context version {p['snapshot']}" in t
    # the rules in the prompt are the engine's own guide (one source)
    assert script.guide_scenes().strip()[:200] in t
    # batch size is configurable
    p2 = project(batch_size=8)
    assert [b["ns"][0] for b in PR.batches(p2)] == [1, 9, 17, 25, 33]


# ------------------------------------------------------------------------------------ B: out of order, in parallel

def test_b_batches_pasted_out_of_order_and_together_land_in_their_places():
    p = project()
    for i in (7, 3):
        PR.mark_copied(p, i)
    r7 = PR.intake(p, batch_reply(range(37, 41)))
    assert r7["got"] == [37, 38, 39, 40] and r7["truncated"] is False
    assert any("code fence" in n for n in r7["notes"]) and r7["set_aside"], "commentary set aside, not lost"
    PR.intake(p, batch_reply(range(13, 19)))
    both = PR.intake(p, batch_reply(range(1, 7), chatty=False) + "\n" + batch_reply(range(7, 13), chatty=False))
    assert both["got"] == list(range(1, 13))
    v = PR.view(p)
    st = {s["n"]: s["status"] for s in v["scenes"]}
    assert all(st[n] == "validated" for n in list(range(1, 19)) + [37, 38, 39, 40]), st
    assert st[19] == "planned" and st[25] == "planned"
    b = {x["i"]: x for x in v["batches"]}
    assert b[7]["status"] == "validated" and b[4]["status"] == "planned" and v["next"] == 4
    PR.mark_copied(p, 4)
    assert {s["n"]: s["status"] for s in PR.view(p)["scenes"]}[19] == "prompt_copied"
    text = PR.assemble(p)
    pos = [text.index(f"--- {n}. Beach Day {n}\n") for n in (1, 2, 12, 13, 18, 37, 40)]
    assert pos == sorted(pos), "assembled in outline order, whatever order they came in"


# ------------------------------------------------------------------------------------------- C: malformed scenes

def _codes(p, n):
    """A scene's problems (errors and warnings; the notes about tidying the format aren't problems)."""
    return {d["code"] for d in next(s for s in p["scenes"] if s["n"] == n)["diag"] if d["severity"] != "info"}


def test_c_malformed_scenes_get_precise_diagnostics_from_the_games_own_compiler():
    p = project()
    long_open = "\n".join(f"nikki: {'The water is cold and the waves keep coming in sets of three. ' * 2}{k}" for k in range(40))
    bad = "\n".join([
        scene(1),
        scene(2, extra=long_open),
        "--- 3. Beach Day 3\nnikki: Nothing to decide here.\nYou just stand there.\n",
        scene(4, extra="viv: Hi."),  # viv is in the cast
        "--- 5. Beach Day 5\nnikki: Hi.\nviviane: Who's that?\n* \"Hey.\"\nnikki: Hey.\n* Leave\nnikki: Bye.\n",
        scene(6).replace("nikki affection +", "nikki frobnicate ++"),
        scene(7, choices=('"' + "I really think we should go get food at the place by the pier because it's late " * 2 + '"', '"No."')),
    ])
    PR.intake(p, bad)
    assert _codes(p, 1) == set() and _codes(p, 4) == set()
    sc2 = next(d for d in next(s for s in p["scenes"] if s["n"] == 2)["diag"] if d["code"] == "SCENE_LENGTH_EXCEEDED")
    assert sc2["limit"] == dialogue.MAX_SCENE_TEXT and sc2["actual"] > dialogue.MAX_SCENE_TEXT and sc2["severity"] == "error"
    assert "NO_CHOICES" in _codes(p, 3)
    d5 = next(d for d in next(s for s in p["scenes"] if s["n"] == 5)["diag"] if d["code"] == "INVALID_CAST_ALIAS")
    assert d5["line"] == 3 and "viviane" in d5["message"], d5
    assert "UNKNOWN_EFFECT" in _codes(p, 6)
    d7 = next(d for d in next(s for s in p["scenes"] if s["n"] == 7)["diag"] if d["code"] == "CHOICE_TOO_LONG")
    assert d7["limit"] == dialogue.MAX_LABEL
    st = {s["n"]: s["status"] for s in PR.view(p)["scenes"]}
    assert st[1] == "validated" and all(st[n] == "needs_correction" for n in (2, 3, 5, 6, 7))
    # a reply cut off mid-scene (its code block never closed): its last scene is flagged, the ones before it are fine
    cut = "```\n" + scene(8) + "\n--- 9. Beach Day 9\nnikki: So about last night\n* \"What about it?\"\nnikki: You know what.\n* \"Nothing."
    r = PR.intake(p, cut)
    assert r["truncated"] and r["got"] == [8, 9]
    assert "SCENE_INCOMPLETE" in _codes(p, 9) and _codes(p, 8) == set()


def test_c_one_grammar_what_the_validator_passes_the_strict_import_takes_and_what_it_refuses_the_import_refuses():
    good, bad = scene(1), scene(1).replace("nikki affection +", "nikki frobnicate ++")
    for txt, ok in ((good, True), (bad, False)):
        p = project(n=1)
        PR.intake(p, txt)
        v = PR.validate_all(p, None, dialogue.library())
        r = dialogue.add_script(PR.assemble(p), strict=True)
        assert (v["blockers"] == 0) == ok == bool(r["ok"]), (txt, v["diagnostics"], r.get("errors"))
        if r["ok"]:
            for pk in list(dialogue.packs()):
                dialogue.remove(pk["id"]) if hasattr(dialogue, "remove") else None


def test_c_safe_format_fixes_are_applied_and_reported_never_silently():
    p = project(n=2)
    r = PR.intake(p, "--- 1. Beach Day 1\nnikki: Hi.\nChoice 1: \"Hey.\" | nikki affection +\nOutcome: nikki: Hey.\n"
                     "Choice 2: Wave\nOutcome: nikki: Cute.\n")
    s = p["scenes"][0]
    assert r["got"] == [1] and s["original"] and r["tidied"][1]
    assert "* \"Hey.\" | nikki affection +" in s["text"] and "    nikki: Hey." in s["text"]
    assert any(d["code"] == "NORMALIZED" and d["severity"] == "info" for d in s["diag"])
    assert not any(d["severity"] == "error" for d in s["diag"]), s["diag"]
    # an unknown effect is NOT "fixed": it stays as written, reported
    PR.intake(p, scene(2).replace("nikki affection +", "nikki afection +"))
    assert "afection" in p["scenes"][1]["text"] and "UNKNOWN_EFFECT" in _codes(p, 2)


# -------------------------------------------------------------------------------------------- D: targeted repair

def test_d_a_focused_repair_prompt_and_replacing_one_scene_alone():
    p = project()
    PR.intake(p, batch_reply(range(1, 7)))
    PR.intake(p, scene(4).replace("nikki affection +", "nikki frobnicate ++"))
    assert "UNKNOWN_EFFECT" in _codes(p, 4)
    rp = PR.repair_prompt(p, [4])["prompt"]
    for must in ("Scene 4: Beach Day 4", "frobnicate", "isn't an effect", "The scene as it is now", "--- 4. Beach Day 4",
                 "same number", "Fix only what's listed", f"at most {dialogue.MAX_SCENE_TEXT:,}"):
        assert must in rp, must
    assert "Beach Day 5" not in rp.split("## Rules")[0], "only the scene being fixed"
    # the fix comes back without its header line: it's put back from the outline; the others aren't touched
    other = next(s for s in p["scenes"] if s["n"] == 5)["text"]
    r = PR.replace_scene(p, 4, "\n".join(scene(4).split("\n")[1:]))
    assert r["got"] == [4] and r["changed"] == [4]
    assert _codes(p, 4) == set() and next(s for s in p["scenes"] if s["n"] == 5)["text"] == other
    s4 = next(s for s in p["scenes"] if s["n"] == 4)
    assert len(s4["history"]) == 2 and "frobnicate" in s4["history"][0]["text"], "earlier versions kept"
    PR.restore_version(p, 4, 0)
    assert "frobnicate" in s4["text"] and "UNKNOWN_EFFECT" in _codes(p, 4)
    # a paste meant for one scene doesn't take the others in it
    r = PR.replace_scene(p, 4, scene(4) + "\n" + scene(5, who="jen"))
    assert r["got"] == [4] and r["not_asked"] == [5] and next(s for s in p["scenes"] if s["n"] == 5)["text"] == other


# ------------------------------------------------------------------------------------------------ E: duplicates

def test_e_duplicates_and_unexpected_numbers_are_kept_and_reported_never_dropped():
    o = PR.parse_outline(HEADER + "outline:\n1. A | June | x\n2. B | | y\n2. C | | z\n5. D | | w\nthis isn't a scene\n")
    codes = [d["code"] for d in o["issues"]]
    assert "OUTLINE_DUPLICATE_NUMBER" in codes and "OUTLINE_MISSING_NUMBERS" in codes and "OUTLINE_LINE_UNREADABLE" in codes
    assert "3, 4" in next(d for d in o["issues"] if d["code"] == "OUTLINE_MISSING_NUMBERS")["message"]
    p = project(n=10)
    r = PR.intake(p, scene(5) + "\n" + scene(5, who="jen") + "\n" + scene(99))
    assert r["got"] == [5] and r["duplicates"] == [5] and r["unexpected"][0]["n"] == 99
    assert [u["n"] for u in p["unplaced"]] == [5, 99] and "jen:" in p["unplaced"][0]["text"], "kept, with their text"
    assert "nikki: You coming in" in next(s for s in p["scenes"] if s["n"] == 5)["text"], "the first copy is the one taken"
    again = PR.intake(p, scene(5))
    assert again["same"] == [5] and again["got"] == [] and not next(s for s in p["scenes"] if s["n"] == 5)["history"]
    # a scene with no number is placed by its title
    r = PR.intake(p, scene(6).replace("--- 6. Beach Day 6", "--- Beach Day 6"))
    assert r["got"] == [6]
    # the raw paste is always kept
    assert len(p["pastes"]) == 3 and p["pastes"][0]["text"].count("--- 5.") == 2


# -------------------------------------------------------------------------------------------- F: branch semantics

def test_f_only_if_branches_warn_until_the_choice_exists_and_are_wired_by_the_engine():
    p = project(n=12, cond=(9, "Swim out to the raft", 4))
    t = PR.batch_prompt(p, 1)["prompt"]
    assert "Must have a choice like “Swim out to the raft” (scene 9 depends on it)" in t
    t2 = PR.batch_prompt(p, 2)["prompt"]
    assert "Only happens if I picked “Swim out to the raft” in scene 4" in t2
    PR.intake(p, batch_reply(range(1, 7), chatty=False))
    v = PR.validate_all(p)
    dep = [d for d in v["diagnostics"] if d["code"] == "CHOICE_DEPENDENCY"]
    assert dep and dep[0]["scene"] == 4 and dep[0]["severity"] == "warning", dep
    assert v["blockers"] == 0, "a branch problem is a warning: the scene plays either way"
    PR.replace_scene(p, 4, scene(4, choices=('"Swim out to the raft."', '"Stay on the sand."')))
    PR.intake(p, batch_reply(range(7, 13), chatty=False))
    v = PR.validate_all(p)
    assert not [d for d in v["diagnostics"] if d["code"] == "CHOICE_DEPENDENCY"], v["diagnostics"]
    r = script.compile_script(PR.assemble(p))
    pk = r["packs"][0]
    s9 = next(sc for sc in pk["scenes"] if sc["title"] == "Beach Day 9")
    assert s9["when"].get("remembered"), "the engine wires the branch (a fact the choice remembers)"


# ---------------------------------------------------------------------------------------- G: existing content

def test_g_existing_storylines_are_never_silently_replaced_or_shrunk():
    first3 = outline_text(6) + "\n" + "\n".join(scene(i) for i in (1, 2, 3))
    r = dialogue.add_script(first3)  # (the regular Story Studio paste, as storylines you have got in)
    assert r["ok"], r
    pid = r["ids"][0]
    # a project for it brings its outline and written scenes along; the storyline isn't touched until import
    p = PR.from_storyline(pid)
    assert p["target"] == pid and [s["n"] for s in p["scenes"] if s.get("text")] == [1, 2, 3]
    before = dialogue.script_of(pid)
    PR.intake(p, batch_reply([4, 5, 6], chatty=False))
    assert dialogue.script_of(pid) == before
    pv = PR.preview(p)
    assert pv["mode"] == "update" and pv["new"] == [4, 5, 6] and pv["replaced"] == [] and pv["can_import"]
    # a new project from the same outline (same title) without those scenes: the import would take them out -> blocked
    q = project(n=6)
    PR.intake(q, batch_reply([4, 5, 6], chatty=False))
    pv = PR.preview(q, allow_partial=True)
    assert pv["mode"] == "copy" and pv["removed"] == [1, 2, 3] and pv["acknowledge"], "the engine's rule: not that storyline, newer"
    assert "Keep the scenes you have" in " ".join(pv["acknowledge"])
    # pointed at that storyline on purpose, an import that would take scenes out is blocked
    PR.set_context(q, {"target": pid})
    pv = PR.preview(q, allow_partial=True)
    assert pv["mode"] == "update" and not pv["can_import"] and any(d["code"] == "IMPORT_WOULD_REMOVE" for d in pv["blockers"])
    assert PR.adopt_existing(q) == [1, 2, 3]
    pv = PR.preview(q)
    assert pv["can_import"] and pv["mode"] == "update" and pv["replaced"] == [] and pv["removed"] == []
    # a different storyline that only shares the name goes in alongside it (acknowledged), never over it
    other = PR.create(HEADER.replace("about: A summer at the beach with everybody.", "about: Something else.")
                      + "\noutline:\n1. Totally Different | June | x.\n")
    PR.intake(other, "--- 1. Totally Different\nnikki: Hi.\n* \"Hey.\"\nnikki: Hey.\n* Wave\nnikki: Bye.\n")
    pv = PR.preview(other)
    assert pv["mode"] == "copy" and pv["acknowledge"]
    with pytest.raises(PR.ProductionError):
        PR.import_project(other, confirm=True)
    res = PR.import_project(other, confirm=True, acknowledge=True)
    assert res["pack"] != pid and dialogue.script_of(pid) == before


# -------------------------------------------------------------------------------------------- H: save protection

def _sim():
    from lifeos.engine import Simulation
    from lifeos.story import begin, create_story
    from tests.test_scheduler import BROTHER, TWINS
    from tests.test_story import spec
    sim = Simulation(create_story(spec(per=6, siblings=[BROTHER] + TWINS)))
    begin(sim)
    return sim


def test_h_import_confirms_validates_first_keeps_history_is_idempotent_and_never_touches_the_save():
    sim = _sim()
    p = project(n=6)
    PR.intake(p, batch_reply(range(1, 7), chatty=False))
    with pytest.raises(PR.ProductionError):
        PR.import_project(p, sim)  # no confirmation, nothing happens
    assert not [x for x in dialogue.packs() if str(x["id"]).startswith("yours:")]
    world_before = json.dumps(sim.w.to_dict(), sort_keys=True, default=str)
    r = PR.import_project(p, sim, confirm=True)
    pid = r["pack"]
    assert r["mode"] == "new" and pid.startswith("yours:") and json.dumps(sim.w.to_dict(), sort_keys=True, default=str) == world_before
    assert {s["status"] for s in PR.view(p)["scenes"]} == {"imported"}
    assert PR.import_project(p, sim, confirm=True)["unchanged"], "the same import again changes nothing"
    # an error anywhere blocks the import, and nothing is written
    good = dialogue.script_of(pid)
    PR.replace_scene(p, 3, scene(3).replace("nikki affection +", "nikki frobnicate ++"))
    with pytest.raises(PR.ProductionError):
        PR.import_project(p, sim, confirm=True)
    assert dialogue.script_of(pid) == good
    # a played scene whose title changes: the preview says so and the import needs it acknowledged
    PR.replace_scene(p, 3, scene(3))
    done = sim.w.meta.setdefault("scenes_done", {})
    sid = next(e["sid"] for e in next(x for x in dialogue.packs() if x["id"] == pid)["pack"]["outline"] if e["n"] == 2)
    done[sid] = sim.w.day
    rows = [{"uid": s["uid"], "n": s["n"], "title": ("Beach Day Two" if s["n"] == 2 else s["title"]), "when": s["when"],
             "summary": s["summary"], "if": s["if"]} for s in p["scenes"]]
    PR.set_outline(p, rows)
    pv = PR.preview(p, sim)
    assert pv["played_renamed"] == [2] and pv["acknowledge"] and pv["can_import"]
    with pytest.raises(PR.ProductionError):
        PR.import_project(p, sim, confirm=True)
    r = PR.import_project(p, sim, confirm=True, acknowledge=True)
    assert r["mode"] == "update" and r["pack"] == pid and "--- 2. Beach Day Two" in dialogue.script_of(pid)
    assert sim.w.meta["scenes_done"] == done, "what you played is untouched"
    # the replaced version is kept and can be brought back
    hist = dialogue.history() if hasattr(dialogue, "history") else None
    vers = (hist or {}).get("versions") if isinstance(hist, dict) else hist
    assert vers and any("Watch Hill Summer" in (v.get("title") or "") for v in vers)


def test_h_partial_import_needs_saying_so():
    p = project(n=6)
    PR.intake(p, batch_reply([1, 2, 3], chatty=False))
    pv = PR.preview(p)
    assert not pv["can_import"] and any(d["code"] == "SCENES_MISSING" for d in pv["blockers"])
    with pytest.raises(PR.ProductionError):
        PR.import_project(p, confirm=True)
    r = PR.import_project(p, confirm=True, allow_partial=True)
    pk = next(x for x in dialogue.packs() if x["id"] == r["pack"])["pack"]
    assert [e["written"] for e in pk["outline"]] == [True, True, True, False, False, False]


# ------------------------------------------------------------------------------------------ I: continuity, shared

def test_i_shared_briefs_events_and_memory_keys_give_soft_warnings_only():
    PR.set_character({"name": "Nikki Basilicato", "aliases": ["nikki"], "relationships": "Your summer friend from Watch Hill.",
                      "personality": "Dry, loyal, competitive.", "status": "canon"})
    PR.set_character({"name": "Vivienne Whitmore", "aliases": ["viv"], "personality": "Says what she thinks.", "status": "proposed"})
    PR.set_event({"name": "Fourth of July bonfire", "key": "bonfire", "when": "July 4", "notes": "Everybody's at the jetty.",
                  "owner": {"project": "prj_other_abc123", "title": "Fireworks", "scene": 3}})
    p = project(n=12)
    rows = [{"uid": s["uid"], "n": s["n"], "title": s["title"], "when": s["when"], "summary": s["summary"], "if": s["if"],
             "meta": ({"event": "bonfire", "depends": [3]} if s["n"] == 8 else {"event": "regatta"} if s["n"] == 9 else
                      {"depends": [11]} if s["n"] == 10 else {})} for s in p["scenes"]]
    PR.set_outline(p, rows)
    t = PR.batch_prompt(p, 2)["prompt"]
    assert "Nikki Basilicato" in t and "Dry, loyal, competitive." in t and "[proposed, not settled canon]" in t
    assert "Fourth of July bonfire (July 4): Everybody's at the jetty. It belongs to Fireworks, scene 3: refer to it, don't redefine it." in t
    q = project(n=12)
    rows_q = [{**{k: s[k] for k in ("uid", "n", "title", "when", "summary", "if")}, "meta": ({"event": "bonfire"} if s["n"] == 2 else {})}
              for s in q["scenes"]]
    PR.set_outline(q, rows_q)
    PR.save(q)
    PR.intake(p, scene(5, extra="").replace("nikki: Good.", "nikki: Good.\nremember zack_swam_out") + "\n"
              + scene(6).replace("nikki: Good.", "nikki: Good.\nremember zack_swum_out"))
    lib = dialogue.library()
    v = PR.validate_all(p, None, lib)
    codes = {d["code"]: d for d in v["diagnostics"]}
    assert "EVENT_SHARED" in codes and "EVENT_UNREGISTERED" in codes and "MEMORY_SIMILAR" in codes
    assert "DEPENDENCY_ORDER" in codes and codes["DEPENDENCY_ORDER"]["scene"] == 10
    assert all(codes[c]["severity"] in ("warning", "info") for c in ("EVENT_SHARED", "EVENT_UNREGISTERED", "MEMORY_SIMILAR", "DEPENDENCY_ORDER"))
    mem = PR.memory_report(p, lib)
    assert mem["writes"] == {"zack_swam_out": [5], "zack_swum_out": [6]}
    # briefs are production notes: no character in any world is touched (and the engine doesn't know these names)
    src = open(PR.__file__, encoding="utf-8").read()
    for name in ("Zack", "Nikki", "Jennifer", "Nicole", "Vivienne"):
        assert name not in src.replace("Zack Soffer unless the cast says", ""), name


# --------------------------------------------------------------------------------------------- J: reload, resume

def test_j_progress_survives_reload_and_travels_in_a_backup(tmp_path, monkeypatch):
    p = project(n=12)
    PR.mark_copied(p, 2)
    PR.intake(p, batch_reply(range(1, 7)))
    PR.replace_scene(p, 3, scene(3).replace("nikki affection +", "nikki frobnicate ++"))
    PR.save(p)
    view = PR.view(p)
    q = PR.load(p["id"])
    assert PR.view(q)["scenes"] == view["scenes"] and PR.view(q)["batches"] == view["batches"]
    assert q["pastes"][0]["text"].startswith("Here are scenes 1 to 6!")
    assert [r["id"] for r in PR.list_projects()] == [p["id"]]
    b = PR.bundle()
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "elsewhere"))
    assert PR.list_projects() == []
    assert PR.install(b) == 1 and PR.view(PR.load(p["id"]))["scenes"] == view["scenes"]
    assert PR.install(b) == 0, "the same backup again changes nothing"
    # older project files (fields added later) still open
    raw = json.load(open(PR._path(p["id"]), encoding="utf-8"))
    for k in ("copied", "pastes", "snapshot", "context"):
        raw.pop(k)
    PR._write(PR._path(p["id"]), raw)
    assert PR.view(PR.load(p["id"]))["scenes"]


def test_j_the_project_folder_is_invisible_to_the_storyline_loader():
    p = project(n=6)
    PR.intake(p, batch_reply(range(1, 7)))
    PR.save(p)
    dialogue.reload()
    assert not [x for x in dialogue.packs() if str(x["id"]).startswith("yours:")], "a project isn't a storyline until imported"


# --------------------------------------------------------------------------------------------- K: performance

def test_k_forty_scenes_validate_quickly_and_a_second_check_only_redoes_what_changed():
    p = project()
    t0 = time.time()
    for k in range(0, 40, 6):
        PR.intake(p, batch_reply(range(k + 1, min(k + 7, 41))))
    first = time.time() - t0
    t0 = time.time()
    v = PR.validate_all(p, None, dialogue.library())
    again = time.time() - t0
    assert v["blockers"] == 0 and not v["missing"], v["diagnostics"][:3]
    assert first < 30 and again < 5, (first, again)
    calls = []
    real = PR.validate_scene
    PR.validate_scene = lambda pp, s, *a: calls.append(s["n"]) or real(pp, s, *a)
    try:
        PR.replace_scene(p, 17, scene(17, who="jen"))
        PR.validate_all(p, None, dialogue.library())
    finally:
        PR.validate_scene = real
    assert calls == [17], calls


# ---------------------------------------------------------------------------------------------------- the API

def test_the_workspace_api_end_to_end():
    from fastapi.testclient import TestClient
    from lifeos import api
    from lifeos.storage import Store
    from tests.test_scheduler import BROTHER, TWINS
    from tests.test_story import spec
    api.lab = api.Lab(Store(":memory:"), fresh=True)
    c = TestClient(api.app)
    assert c.post("/api/story/new", json={"spec": spec(per=6, siblings=[BROTHER] + TWINS)}).status_code == 200
    chk = c.post("/api/story/production/outline-check", json={"text": outline_text(12)}).json()
    assert len(chk["entries"]) == 12 and chk["title"] == "Watch Hill Summer"
    v = c.post("/api/story/production", json={"text": "Sure! Here's the outline:\n```\n" + outline_text(12) + "```"}).json()
    pid = v["id"]
    assert len(v["batches"]) == 2 and v["next"] == 1
    bp = c.get(f"/api/story/production/{pid}/batch", params={"i": 2}).json()
    assert bp["from"] == 7 and "Only scenes 7 to 12" in bp["prompt"]
    assert "June" in bp["prompt"] or "July" in bp["prompt"]
    c.post(f"/api/story/production/{pid}/copied", json={"i": 2})
    r = c.post(f"/api/story/production/{pid}/paste", json={"text": batch_reply(range(7, 13))}).json()
    assert r["report"]["got"] == list(range(7, 13))
    r = c.post(f"/api/story/production/{pid}/paste", json={"text": batch_reply(range(1, 7)).replace("nikki affection +", "nikki frobnicate ++", 1)}).json()
    st = {s["n"]: s["status"] for s in r["project"]["scenes"]}
    assert st[1] == "needs_correction" and st[2] == "validated"
    pv = c.get(f"/api/story/production/{pid}/preview").json()
    assert not pv["can_import"] and pv["blockers"][0]["scene"] == 1
    rep = c.get(f"/api/story/production/{pid}/repair", params={"ns": "1"}).json()
    assert "frobnicate" in rep["prompt"]
    assert c.post(f"/api/story/production/{pid}/import", json={"confirm": True}).status_code == 422
    c.post(f"/api/story/production/{pid}/paste", json={"text": scene(1), "scene": 1})
    val = c.post(f"/api/story/production/{pid}/validate").json()
    assert val["blockers"] == 0
    det = c.get(f"/api/story/production/{pid}/scene", params={"n": 1}).json()
    assert det["history"] and "frobnicate" in det["history"][0]["text"]
    assert c.post(f"/api/story/production/{pid}/import", json={}).status_code == 422, "needs confirm"
    imp = c.post(f"/api/story/production/{pid}/import", json={"confirm": True}).json()
    assert imp["ok"] and any(x["id"] == imp["pack"] for x in imp["packs"])
    assert c.get(f"/api/story/production/{pid}/export").json()["text"].startswith("=== Watch Hill Summer")
    lst = c.get("/api/story/production").json()
    assert lst["projects"][0]["imported"] and any(x["id"] == imp["pack"] for x in lst["storylines"])
    assert c.get("/api/story/production/prj_nope_000000").status_code == 404
    assert c.get("/api/story/production/../../etc").status_code in (404, 422)


# --------------------------------------------------------------------------------- the handoff's exact scenarios

def test_b_the_handoffs_paste_order_assembles_one_to_forty():
    p = project()
    for ns in ((19, 24), (1, 6), (31, 36), (7, 12), (25, 30), (13, 18), (37, 40)):
        r = PR.intake(p, batch_reply(range(ns[0], ns[1] + 1)))
        assert r["got"] == list(range(ns[0], ns[1] + 1)), r
    v = PR.validate_all(p, None, dialogue.library())
    assert v["blockers"] == 0 and not v["missing"] and set(v["scenes"].values()) == {"validated"}
    text = PR.assemble(p)
    heads = [ln for ln in text.split("\n") if ln.startswith("--- ")]
    assert heads == [f"--- {n}. Beach Day {n}" for n in range(1, 41)]
    pk = script.compile_script(text)["packs"][0]
    assert [e["n"] for e in pk["outline"]] == list(range(1, 41)) and all(e["written"] for e in pk["outline"])


def test_e_the_same_batch_twice_changes_nothing_and_a_revision_says_what_changed():
    p = project(n=12)
    PR.intake(p, batch_reply(range(1, 7)))
    again = PR.intake(p, batch_reply(range(1, 7)))
    assert again["same"] == [1, 2, 3, 4, 5, 6] and again["got"] == [] and PR.assemble(p).count("--- 3. Beach Day 3") == 1
    revised = batch_reply(range(1, 7)).replace("jen: Don't let him chicken out.\n* \"Yeah.\" | nikki affection +\nnikki: Good.\n* \"Not really.\"\nnikki: Fine, suit yourself.\n\n--- 4.",
                                                "jen: He's scared of jellyfish.\n* \"Yeah.\" | nikki affection +\nnikki: Good.\n* \"Not really.\"\nnikki: Fine, suit yourself.\n\n--- 4.")
    r = PR.intake(p, revised)
    assert r["changed"] == [3] and r["same"] == [1, 2, 4, 5, 6]
    assert any("jellyfish" in ln and ln.startswith("+") for ln in r["diffs"][3]) and any(ln.startswith("-jen: Don't") for ln in r["diffs"][3])


def test_f_lines_under_choices_nested_choices_and_either_way_play_where_the_runtime_plays_them():
    p = project(n=2)
    PR.intake(p, "--- 1. Beach Day 1\nnikki: So?\n* \"Yes.\" | nikki affection +\nnikki: Good.\n    ** \"Really yes.\"\n"
                 "        nikki: Okay, okay.\n    ** Shrug\n        nikki: Whatever.\n* \"No.\"\nnikki: Fine.\neither way:\n"
                 "nikki: Anyway, the water's warm.\n")
    s = p["scenes"][0]
    assert not [d for d in s["diag"] if d["severity"] != "info"], s["diag"]
    assert any("indented ** choice" in x for x in s["tidied"]) and any("whichever choice" in x for x in s["tidied"])
    # what the validator passed is what the runtime builds: the strict import compiles the same structure
    r = dialogue.add_script(PR.assemble(p, only_valid=True), strict=True)
    assert r["ok"], r
    sc = next(x for x in next(pk for pk in dialogue.packs() if pk["id"] == r["ids"][0])["pack"]["scenes"] if x["title"] == "Beach Day 1")
    yes, no = sc["choices"]
    assert yes["then"]["text"].endswith("Good.") and [c["label"] for c in yes["then"]["choices"]] == ['"Really yes."', "Shrug"]
    says = lambda c: [op[1] for op in c.get("ops") or [] if op[0] == "say"]  # noqa: E731
    assert says(yes["then"]["choices"][0])[-1].endswith("the water's warm.") and says(no)[-1].endswith("the water's warm.")
    assert says(no)[0].endswith("Fine."), "the line right under a choice is that choice's"


def _fixture_scripts():
    """Outlined storylines the existing tests already use (the repository's own fixtures)."""
    import importlib
    out = []
    for mod in ("tests.test_builder", "tests.test_never_lose", "tests.test_sports_storylines", "tests.test_seasons",
                "tests.test_storycal", "tests.test_storyline_checkup", "tests.test_games_line_up", "tests.test_scene_moves"):
        try:
            m = importlib.import_module(mod)
        except Exception:  # noqa: BLE001
            continue
        for k, v in vars(m).items():
            if isinstance(v, str) and v.lstrip().startswith("===") and "outline:" in v:
                out.append((f"{mod}.{k}", v))
    return out


def test_g_the_repositorys_storyline_fixtures_load_into_projects_unchanged_and_stay_playable():
    from tests.test_builder import OUTLINE, SCENES_1
    fixtures = _fixture_scripts() + [("test_builder OUTLINE+SCENES_1", OUTLINE + "\n" + SCENES_1.split("```")[1])]
    assert len(fixtures) >= 3, [k for k, _ in fixtures]
    checked = 0
    for name, text in fixtures:
        for pk in [x for x in dialogue.packs() if str(x["id"]).startswith("yours:")]:
            dialogue.remove_pack(pk["id"])
        r = dialogue.add_script(text)
        if not r["ok"]:
            continue
        for pid in r["ids"]:
            row = next(x for x in dialogue.packs() if x["id"] == pid)
            if not row["pack"].get("outline"):
                continue
            stored = dialogue.script_of(pid)
            p = PR.from_storyline(pid)
            pv = PR.preview(p, allow_partial=True)
            assert pv["mode"] == "unchanged" and pv["replaced"] == [] and pv["removed"] == [], (name, pv["mode"], pv["blockers"][:2])
            strict = script.compile_script(stored, library=dialogue.library())
            errs = [d for d in pv["diagnostics"] if d["severity"] == "error"]
            assert bool(errs) == bool(strict["errors"]), (name, errs[:2], strict["errors"][:2])
            assert dialogue.script_of(pid) == stored and row["enabled"], "loading it into a project changes nothing"
            checked += 1
    assert checked >= 3, checked


def test_h_a_refused_write_leaves_the_storyline_and_the_project_as_they_were(monkeypatch):
    p = project(n=4)
    PR.intake(p, batch_reply(range(1, 5), chatty=False))
    first = PR.import_project(p, confirm=True)
    before_file = dialogue.script_of(first["pack"])
    before_imported = dict(p["imported"])
    PR.replace_scene(p, 2, scene(2, who="jen"))
    monkeypatch.setattr(dialogue, "add_script", lambda *a, **k: {"ok": False, "errors": ["line 9: simulated refusal"]})
    with pytest.raises(PR.ProductionError):
        PR.import_project(p, confirm=True)
    assert dialogue.script_of(first["pack"]) == before_file and p["imported"] == before_imported
    st = {s["n"]: s["status"] for s in PR.view(p)["scenes"]}
    assert st[2] == "validated" and st[1] == "imported", st

    def boom(*a, **k):
        raise OSError("disk full")
    monkeypatch.setattr(dialogue, "add_script", boom)
    with pytest.raises(PR.ProductionError):
        PR.import_project(p, confirm=True)
    assert dialogue.script_of(first["pack"]) == before_file


def test_k_a_big_library_and_a_played_world_dont_slow_down_checking_one_scene():
    # dozens of storylines you already have
    for k in range(30):
        txt = (f"=== Library Story {k}\ncast: nikki = Nikki Basilicato\ncast: jen = Jennifer Soffer\nyears: sophomore\n\noutline:\n"
               + "".join(f"{i}. Old Scene {k}-{i} | | stuff.\n" for i in range(1, 13)) + "\n"
               + "\n".join(scene(i, title=f"Old Scene {k}-{i}") for i in range(1, 13)))
        assert dialogue.add_script(txt)["ok"]
    sim = _sim()
    sim.w.meta["scenes_done"] = {f"library_story_{k}_old_scene_{k}_{i}": 10 + i for k in range(30) for i in range(1, 13)}
    p = project()
    for a in range(1, 41, 6):
        PR.intake(p, batch_reply(range(a, min(a + 6, 41))))
    t0 = time.time()
    pv = PR.preview(p, sim)
    full = time.time() - t0
    assert pv["can_import"] and pv["scenes"] == 40, pv["blockers"][:2]
    import lifeos.script as S
    n = {"calls": 0}
    real = S.compile_script

    def counting(*a, **k):
        n["calls"] += 1
        return real(*a, **k)
    S.compile_script = counting
    try:
        t0 = time.time()
        PR.replace_scene(p, 22, scene(22, who="jen"))
        one = time.time() - t0
    finally:
        S.compile_script = real
    assert n["calls"] == 1, "one changed scene: one compile (not the whole world, not the other 39)"
    assert full < 20 and one < 2, (full, one)


# ------------------------------------------------------------------- found checking real storylines (regressions)

def test_g_an_expansion_checks_its_scenes_with_its_storylines_cast():
    assert dialogue.add_script(outline_text(4) + "\n" + "\n".join(scene(i) for i in range(1, 5)))["ok"]
    exp = ("=== Watch Hill Summer: The Bonfire\nexpands: Watch Hill Summer\nyears: sophomore\n\noutline:\n"
           "1. Sparks | July | The bonfire.\n2. Embers | July | After.\n")
    p = PR.create(exp)
    PR.intake(p, scene(1, title="Sparks") + "\n" + scene(2, title="Embers", who="viv"))
    assert all(not [d for d in s["diag"] if d["severity"] == "error"] for s in p["scenes"]), [s["diag"] for s in p["scenes"]]
    assert PR.preview(p)["can_import"]


def test_g_old_scenes_without_choices_stay_valid_new_ones_need_choices():
    old = outline_text(3) + "\n" + scene(1) + "\n--- 2. Beach Day 2\nnikki: We just sit there.\nThe sun goes down.\n\n" + scene(3)
    r = dialogue.add_script(old)
    assert r["ok"]
    p = PR.from_storyline(r["ids"][0])
    s2 = next(s for s in p["scenes"] if s["n"] == 2)
    nc = next(d for d in s2["diag"] if d["code"] == "NO_CHOICES")
    assert nc["severity"] == "warning" and "Continue" in nc["message"], "in the game like this already: not a blocker"
    pv = PR.preview(p)
    assert pv["mode"] == "unchanged" and not pv["blockers"]
    PR.replace_scene(p, 2, "nikki: We just sit there, again.\nThe sun goes down.\n")
    assert next(d for d in s2["diag"] if d["code"] == "NO_CHOICES")["severity"] == "error", "new writing needs its choices"


def test_g_reopening_a_storyline_reuses_its_project_and_brings_in_scenes_written_elsewhere():
    r = dialogue.add_script(outline_text(6) + "\n" + scene(1) + "\n" + scene(2))
    pid = r["ids"][0]
    p = PR.from_storyline(pid)
    PR.intake(p, scene(5))
    PR.save(p)
    # scene 3 written the other way (the regular Write the next scenes flow) while the project sat
    assert dialogue.merge_scenes(pid, scene(3))["ok"]
    q = PR.from_storyline(pid)
    assert q["id"] == p["id"], "one project per storyline"
    assert [s["n"] for s in q["scenes"] if s.get("text")] == [1, 2, 3, 5], "scene 3 came in; scene 5 (the project's own) stayed"
    assert PR.preview(q, allow_partial=True)["removed"] == []


def test_f_an_indented_double_star_choice_is_tidied_so_the_player_never_sees_the_star():
    raw = ("--- 1. Beach Day 1\nnikki: So?\n* \"Ask her.\"\n    nikki: Ask me what?\n    ** \"Can I kiss you?\"\n        nikki: Yes.\n"
           "    ** \"Never mind.\"\n        nikki: Okay.\n* \"Nothing.\"\n    nikki: Fine.\n")
    lab = script.compile_script("=== X\ncast: nikki = Nikki Basilicato\nyears: sophomore\n\noutline:\n1. Beach Day 1 | June | x\n\n" + raw)
    shown = lab["packs"][0]["scenes"][0]["choices"][0]["then"]["choices"][0]["label"]
    assert shown.startswith("*"), "the runtime keeps the * of an indented ** (what the tidy is for)"
    p = project(n=1)
    PR.intake(p, raw)
    r = dialogue.add_script(PR.assemble(p), strict=True)
    sc = next(x for x in dialogue.packs() if x["id"] == r["ids"][0])["pack"]["scenes"][0]
    assert [c["label"] for c in sc["choices"][0]["then"]["choices"]] == ['"Can I kiss you?"', '"Never mind."']


def test_the_workspace_runs_in_the_phone_app_too(tmp_path):
    """The same routes answered by the in-browser engine (the FastAPI stand-in), as on the phone."""
    import subprocess
    import textwrap
    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    code = textwrap.dedent(f"""
        import sys, json, asyncio
        sys.path[:0] = [{os.path.join(backend, 'standalone')!r}, {backend!r}]
        import fastapi
        assert hasattr(fastapi, 'ROUTES')
        from lifeos import local_api
        from tests.test_production import outline_text, batch_reply, scene
        local_api.boot({str(tmp_path / 'saves')!r})
        call = lambda m, p, b=None, q='': asyncio.run(local_api.handle(m, p, q, None if b is None else json.dumps(b).encode()))
        js = lambda r: json.loads(r['body'])
        r = call('POST', '/api/story/production', {{'text': outline_text(12)}})
        assert r['status'] == 200, r['body'][:300]
        pid = js(r)['id']
        b = js(call('GET', f'/api/story/production/{{pid}}/batch', q='i=2'))
        assert b['from'] == 7 and 'Only scenes 7 to 12' in b['prompt']
        assert call('POST', f'/api/story/production/{{pid}}/copied', {{'i': 2}})['status'] == 200
        for a in (7, 1):
            r = js(call('POST', f'/api/story/production/{{pid}}/paste', {{'text': batch_reply(range(a, a + 6))}}))
            assert r['report']['got'] == list(range(a, a + 6))
        v = js(call('POST', f'/api/story/production/{{pid}}/validate'))
        assert v['blockers'] == 0, v['diagnostics'][:2]
        pv = js(call('GET', f'/api/story/production/{{pid}}/preview', q='partial=false'))
        assert pv['can_import'] and pv['mode'] == 'new'
        assert call('POST', f'/api/story/production/{{pid}}/import', {{}})['status'] == 422
        imp = js(call('POST', f'/api/story/production/{{pid}}/import', {{'confirm': True}}))
        assert imp['ok'] and imp['pack'].startswith('yours:')
        assert call('GET', '/api/story/production/prj_nope_000000')['status'] == 404
        assert js(call('GET', '/api/story/production'))['projects'][0]['imported']
        print('ok')
    """)
    r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, cwd=backend, timeout=600)
    assert r.returncode == 0 and r.stdout.strip().endswith("ok"), (r.stdout[-2000:], r.stderr[-3000:])
