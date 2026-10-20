"""The research agent sheet (docs/INGEST.md), the same pattern as Food OS's Agent Sheet.

An AI agent (ChatGPT, Claude, any other) researches and writes what it finds into the sheet's RESULTS tabs, with
every row tied to SOURCES. The engine writes ASK (what canon still needs: drafts to confirm, unsourced records,
proposed movesets) and only ever reads RESULTS. Each research job's rows become one card in the inbox, so a job's
findings go through the same review as everything else: nothing lands in canon until approved.

Tabs and columns are defined here (TABS) and written into the sheet's README; `asks(store)` builds the ASK rows from
canon; `cards_from_results(inbox, tabs)` turns the RESULTS tabs into cards.
"""
import re

from ingest.cards import slug

STATUS_DONE = {"FOUND", "PARTIAL"}
TAIL = ["AskID", "JobID", "Status", "Confidence", "SourceIDs", "AgentNotes", "ResearchedOn"]
TABS = {
    "ASK": ["Batch", "AskID", "Status", "Topic", "Question", "WhatWeHave", "Target", "JobID", "Note"],
    "RESULTS_CAREER": ["Trainer", "Region", "Event", "Kind", "Result", "Title", "Champion", "EliteFour",
                       "Versions"] + TAIL,
    "RESULTS_LORE": ["Subject", "Fact", "EpisodeOrTitle"] + TAIL,
    "RESULTS_FIELD_NOTES": ["Species", "Aspect", "Note", "Region"] + TAIL,
    "RESULTS_BUILDS": ["Trainer", "Species", "Nickname", "Moves", "Item", "Ability", "Nature", "EVs",
                       "Generation"] + TAIL,
    "RESULTS_OBSERVATIONS": ["Trainer", "Version", "Battle", "Turn", "Situation", "Pokemon", "Move",
                             "Outcome"] + TAIL,
    "RESULTS_CORRECTIONS": ["Target", "CurrentValue", "NewValue", "Why"] + TAIL,
    "SOURCES": ["SourceID", "URL", "Publisher", "Title", "PublishedOn", "Kind"],
    "JOBS": ["JobID", "Request", "Scope", "Status", "CoverageNotes", "NextSteps", "Found", "Imported",
             "Unresolved", "UpdatedOn"],
}
VOCAB = [
    ("Status (RESULTS)", "FOUND", "confirmed by at least one listed source"),
    ("Status (RESULTS)", "PARTIAL", "part of the answer confirmed; AgentNotes says which part"),
    ("Status (RESULTS)", "NOT_CONFIRMABLE", "looked for and couldn't confirm; AgentNotes says where you looked"),
    ("Status (ASK)", "TO_RESEARCH", "open"),
    ("Status (ASK)", "WAITING", "answered in RESULTS, not reviewed yet"),
    ("Confidence", "HIGH", "an official or primary source says it plainly (the episode, the game, an official site)"),
    ("Confidence", "MEDIUM", "a well-kept secondary source (Bulbapedia, Serebii) says it"),
    ("Confidence", "LOW", "one weak or indirect source; say why in AgentNotes"),
    ("Aspect", "behavior | habitat | diet | social | other", "what a field note is about"),
    ("Kind (career)", "league | contest | frontier | tournament | gym | title", "what the record is"),
    ("Trainer", "ash, paul, gary, red, may, dawn, brock, misty, lance, cynthia, giovanni", "the trainer ids canon uses"),
    ("Moves", "Move One | Move Two | …", "official English move names, separated by |"),
    ("EVs", "252 Atk / 252 Spe / 4 HP", "Showdown style"),
    ("SourceIDs", "S1 | S2", "ids from the SOURCES tab, separated by |"),
]


def answered(inbox):
    """What approved research has already settled: the subject of every applied correction (a build, or the exact
    trainer value), so a question isn't asked twice."""
    out = set()
    for card in inbox.all():
        for c in card["claims"]:
            if c["kind"] == "correction" and c["status"] == "applied":
                out.add(_subject(c["data"]["target"]))
    return out


def _subject(target):
    file_rel, _, dotted = target.partition(":")
    if dotted.startswith("builds."):
        return f"{file_rel}:" + ".".join(dotted.split(".")[:2])
    return target


def asks(store, batch_size=25, inbox=None):
    """ASK rows: what canon still holds as a draft or a proposal, phrased as research questions. With the inbox,
    anything an approved correction already settled is left out."""
    rows = []
    done = answered(inbox) if inbox else set()

    def add(topic, q, have, target):
        subject = _subject(target)
        if subject in done or any(d.startswith(subject + ".") for d in done):
            return
        rows.append({"Topic": topic, "Question": q, "WhatWeHave": have, "Target": target})

    for tid, t in store.trainers.items():
        for i, r in enumerate(t.career):
            if str(r.get("status", "")).startswith("draft"):
                add("career", f"Confirm {t.name}'s record at the {r['event']} ({r['region']}): {r['result']}. "
                              "Correct the result, region or round if they're wrong.",
                    f"{r['event']} | {r['region']} | {r['result']}", f"canon/trainers.json:trainers.{tid}.career.{i}")
        for vid, v in t.versions.items():
            for j, s in enumerate(v.signature_moves):
                if s.get("status") == "proposed":
                    add("signature", f"Is {s['move']} a signature move of {t.name}'s {s['pokemon']} in "
                                     f"{v.title}? Cite the episode where it's used most memorably.",
                        f"{s['pokemon']} | {s['move']} | {s['why']}",
                        f"canon/trainers.json:trainers.{tid}.versions.{vid}.signature_moves.{j}")
            ace = (v.overrides or {}).get("ace")
            if ace:
                add("ace", f"Is {ace} {t.name}'s ace in {v.title}? Cite where the show or game treats it that way.",
                    ace, f"canon/trainers.json:trainers.{tid}.versions.{vid}.overrides.ace")
    for bid, b in store.library.items():
        if b.source.startswith("anime") and b.status == "proposed":
            add("moveset", f"Which moves did {b.species} ({bid.split('/')[0]}) use in the show in this era? "
                           "List every move with an episode where it's used.",
                " | ".join(b.moves), f"canon/build_library.json:builds.{bid}.moves")
    for i, r in enumerate(rows):
        r.update(Batch=i // batch_size + 1, AskID=f"ASK-{i + 1:04d}", Status="TO_RESEARCH", JobID="", Note="")
    return rows


# --- reading RESULTS -------------------------------------------------------------------------------------
def _split(v):
    return [x.strip() for x in re.split(r"\s*\|\s*", str(v or "")) if x.strip()]


def _bool(v):
    return str(v).strip().lower() in ("yes", "true", "y", "1")


def _evs(text):
    out = {}
    for part in str(text or "").split("/"):
        m = re.match(r"\s*(\d+)\s+(\w+)\s*$", part)
        key = {"hp": "hp", "atk": "atk", "def": "def", "spa": "spa", "spd": "spd", "spe": "spe"}.get(
            m.group(2).lower()) if m else None
        if key:
            out[key] = int(m.group(1))
    return out


def _claim(inbox, tab, row, sources):
    refs = [sources.get(s, {}).get("URL") or s for s in _split(row.get("SourceIDs"))]
    ref = " | ".join(refs) or None
    conf, note = row.get("Confidence"), row.get("AgentNotes") or None
    if tab == "RESULTS_CAREER":
        data = {"trainer": slug(row.get("Trainer"), 20), "region": row.get("Region"), "event": row.get("Event"),
                "kind": row.get("Kind") or "league", "result": row.get("Result"), "title": row.get("Title") or None,
                "champion": _bool(row.get("Champion")) or None,
                "elite_four": "beaten" if _bool(row.get("EliteFour")) else None,
                "versions": _split(row.get("Versions")) or None}
        return inbox.claim("career", data, confidence=conf, source_ref=ref, note=note)
    if tab == "RESULTS_LORE":
        return inbox.claim("lore", {"subject": row.get("Subject"), "fact": row.get("Fact"),
                                    "episode": row.get("EpisodeOrTitle")}, confidence=conf, source_ref=ref, note=note)
    if tab == "RESULTS_FIELD_NOTES":
        return inbox.claim("field_note", {"species": row.get("Species"), "aspect": row.get("Aspect") or "other",
                                          "note": row.get("Note"), "region": row.get("Region") or None},
                           confidence=conf, source_ref=ref, note=note)
    if tab == "RESULTS_BUILDS":
        gen = re.search(r"\d", str(row.get("Generation") or ""))
        data = {"species": row.get("Species"), "nickname": row.get("Nickname") or None,
                "moves": _split(row.get("Moves")), "item": row.get("Item") or None,
                "ability": row.get("Ability") or None, "nature": row.get("Nature") or None,
                "evs": _evs(row.get("EVs")) or None, "generation": int(gen.group(0)) if gen else None,
                "trainer": row.get("Trainer") or None}
        return inbox.claim("build", {k: v for k, v in data.items() if v is not None}, confidence=conf,
                           source_ref=ref, note=note)
    if tab == "RESULTS_OBSERVATIONS":
        data = {"trainer": slug(row.get("Trainer"), 20), "version": row.get("Version"), "battle": row.get("Battle"),
                "turn": row.get("Turn"), "situation": row.get("Situation"), "pokemon": row.get("Pokemon"),
                "move": row.get("Move"), "outcome": row.get("Outcome"), "sample_size": 1}
        return inbox.claim("observation", data, confidence=conf, source_ref=ref, note=note)
    if tab == "RESULTS_CORRECTIONS":
        value = row.get("NewValue")
        if str(row.get("Target", "")).endswith(".moves"):
            value = _split(value)                       # a moveset is a list
        return inbox.claim("correction", {"target": row.get("Target"), "value": value,
                                          "was": row.get("CurrentValue"), "why": row.get("Why")},
                           confidence=conf, source_ref=ref, note=note)
    return None


def cards_from_results(inbox, tabs, again=False):
    """tabs: {tab name: [row dicts]} as read from the sheet. One card per research job."""
    sources = {r.get("SourceID"): r for r in tabs.get("SOURCES", []) if r.get("SourceID")}
    jobs = {r.get("JobID"): r for r in tabs.get("JOBS", []) if r.get("JobID")}
    by_job, unresolved = {}, {}
    for tab, rows in tabs.items():
        if not tab.startswith("RESULTS_"):
            continue
        for row in rows:
            job = row.get("JobID") or "no-job"
            status = str(row.get("Status") or "").upper()
            if status not in STATUS_DONE:
                unresolved.setdefault(job, []).append(f"{tab}: {row.get('AskID') or ''} {row.get('AgentNotes') or ''}".strip())
                continue
            c = _claim(inbox, tab, row, sources)
            if c:
                by_job.setdefault(job, []).append(c)
    out = []
    for job in sorted(set(by_job) | set(unresolved)):
        j = jobs.get(job, {})
        src = {"title": j.get("Request") or f"research job {job}", "sheet": "Agent Sheet", "job": job,
               "unresolved": unresolved.get(job, [])}
        summary = j.get("CoverageNotes") or f"{len(by_job.get(job, []))} finding(s) from job {job}"
        card, made = inbox.new("research", job, src, "ingested", summary, by_job.get(job, []), again=again)
        out.append((card, made))
    return out
