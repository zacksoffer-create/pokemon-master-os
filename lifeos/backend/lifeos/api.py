"""HTTP API for the Living World Laboratory.

One authoritative Simulation lives in the server process. Long advances run in a background
thread one day at a time (holding the lock per day), so the UI can poll progress and read
state between days. Mutations are refused with 409 while an advance is running.
"""
from __future__ import annotations

import csv
import io
import json
import os
import threading
import time

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import calendar as calm
from . import metrics
from .catalogs import ATTRIBUTE_DOCS, CatalogError
from .engine import EditError, Simulation
from .experiments import PRESETS, Runner, validate_spec
from .rules import RulesError, rules_hash, schema
from .social import grudge_score, label_for, satisfaction
from .storage import Store, world_from_bytes, world_to_json
from .worldgen import generate

FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")


def r2(x, n=1):
    return round(x, n) if isinstance(x, float) else x


class Lab:
    def __init__(self, store: Store, fresh: bool = False):
        self.store = store
        self.lock = threading.RLock()
        self.runner = Runner(store)
        self.job: dict | None = None
        self.job_seq = 0
        store.mark_stale_experiments()
        w = None if fresh else store.latest_autosave()
        if w is None:
            w = generate(1234, 36, True)
        self.sim = Simulation(w)
        if fresh or not store.list_saves():
            self.autosave()

    # --- helpers --------------------------------------------------------------
    @property
    def w(self):
        return self.sim.w

    def busy(self):
        return self.job is not None and self.job["status"] == "running"

    def guard(self):
        if self.busy():
            raise HTTPException(409, "The simulation is advancing. Wait for it to finish.")

    def autosave(self):
        self.store.save_world(self.w, "Autosave", kind="autosave")

    def replace_world(self, w):
        self.sim = Simulation(w)
        self.autosave()

    # --- advancing ---------------------------------------------------------------
    def start_advance(self, days: int) -> dict:
        self.guard()
        self.job_seq += 1
        start_ev = self.w.history.next_event
        job = {"id": self.job_seq, "status": "running", "days": days, "done": 0, "start_day": self.w.day,
               "start_event": start_ev, "started": time.time(), "error": None}
        self.job = job

        def work():
            try:
                for _ in range(days):
                    with self.lock:
                        self.sim.advance_days(1)
                    job["done"] += 1
                with self.lock:
                    self.autosave()
                job["status"] = "done"
            except Exception as e:  # surface the failure instead of hanging
                import traceback
                job["status"] = "failed"
                job["error"] = f"{type(e).__name__}: {e}"
                job["trace"] = traceback.format_exc()[-3000:]
            job["seconds"] = round(time.time() - job["started"], 2)
            job["end_day"] = self.w.day
            job["new_events"] = self.w.history.next_event - start_ev

        if days <= 2:
            work()
        else:
            threading.Thread(target=work, daemon=True).start()
        return job


lab: Lab | None = None


def get_lab() -> Lab:
    global lab
    if lab is None:
        lab = Lab(Store())
    return lab


app = FastAPI(title="LIFE OS - Living World Laboratory", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RulesError)
def _rules_err(request, exc: RulesError):
    return JSONResponse(status_code=422, content={"detail": "Invalid rule change", "errors": exc.errors})


@app.exception_handler(CatalogError)
def _cat_err(request, exc: CatalogError):
    return JSONResponse(status_code=422, content={"detail": str(exc), "errors": str(exc).split("; ")})


@app.exception_handler(EditError)
def _edit_err(request, exc: EditError):
    return JSONResponse(status_code=422, content={"detail": str(exc), "errors": str(exc).split("; ")})


# --- serializers -----------------------------------------------------------------

def world_info(L: Lab) -> dict:
    w = L.w
    cal = L.sim.cat.world["calendar"]
    roles = {}
    for c in w.chars.values():
        if c.status == "active":
            roles[c.role] = roles.get(c.role, 0) + 1
    return {"name": w.name, "town": L.sim.cat.world["town"], "school": L.sim.cat.world["school"], "day": w.day,
            "date": calm.label(w.day), "iso": calm.date_of(w.day).isoformat(), "weekday": calm.WEEKDAYS[calm.weekday(w.day)],
            "term": calm.term_label(w.day, cal), "school_day": calm.is_school_day(w.day, cal), "year": w.year + 1,
            "phase": L.sim.current_phase(), "phases": L.sim.phases(), "seed": w.seed, "gen_seed": w.gen_seed,
            "population": roles, "rules_version": rules_hash(w.rules), "events": len(w.history.events),
            "traces": len(w.history.traces), "folded": w.history.folded_total,
            "job": L.job, "busy": L.busy(), "action_overrides": sorted(w.action_overrides)}


def rep_tags(c, n=3):
    return [[k, round(v, 1)] for k, v in sorted(c.reputation.items(), key=lambda x: -x[1]) if v >= 3][:n]


def char_summary(L: Lab, c) -> dict:
    w = L.w
    R = w.rules
    friends = sum(1 for o, r in w.out.get(c.id, {}).items() if r.affection >= R["rel.friend_threshold"] and w.chars[o].role != "staff")
    cl = w.cliques.get(c.flags.get("clique") or "")
    top = sorted(c.interests.items(), key=lambda x: -x[1])[:3]
    return {"id": c.id, "name": c.name, "first": c.first, "last": c.last, "short": c.short, "role": c.role, "grade": c.grade,
            "archetype": c.archetype, "color": c.color, "pronouns": c.pronouns, "featured": c.featured, "status": c.status,
            "mood": r2(c.mood), "stress": r2(c.needs.get("stress", 0)), "energy": r2(c.needs.get("energy", 0)),
            "popularity": r2(c.popularity), "friends": friends, "clique": {"id": cl["id"], "name": cl["name"]} if cl and cl.get("active") else None,
            "memberships": [{"id": g, "name": w.groups[g]["name"], "kind": w.groups[g]["kind"]} for g in c.memberships],
            "partner": c.flags.get("partner"), "title": c.title, "role_label": c.role_label,
            "interests": [[k, round(v)] for k, v in top], "reputation": rep_tags(c), "bio": c.bio, "gpa": round(c.gpa, 2),
            "household": c.household_id, "grounded": c.flags.get("grounded_until", -1) >= w.day,
            "goals": [g["label"] for g in c.goals if g["status"] == "active"][:3]}


def rel_view(L: Lab, r, include_recent=False) -> dict:
    w = L.w
    d = {"familiarity": r2(r.familiarity), "affection": r2(r.affection), "respect": r2(r.respect), "attraction": r2(r.attraction),
         "trust": r2(r.trust), "rivalry": r2(r.rivalry), "perceived": r2(r.perceived), "label": r.label, "crush": r.crush,
         "met_day": r.met_day, "last_day": r.last_day, "pos": r.pos, "neg": r.neg, "peak_affection": r2(r.peak_affection),
         "grudge": r2(grudge_score(w, r, w.day))}
    if include_recent:
        d["recent"] = r.recent
        d["milestones"] = r.milestones
    return d


def skill_cap(L, c, sid):
    s = L.sim.cat.skills[sid]
    tw = L.w.rules["dev.talent_cap_weight"]
    return round((1 - tw) * 100 + tw * c.aptitudes.get(s["aptitude"], 50), 1)


def ev_out(ev, full=False) -> dict:
    d = {"id": ev["id"], "day": ev["day"], "date": calm.label(ev["day"]), "slot": ev.get("slot"), "type": ev["type"],
         "outcome": ev.get("outcome"), "actors": ev.get("actors", []), "targets": ev.get("targets", []),
         "involved": ev.get("involved", [])[:12], "group": ev.get("group"), "importance": ev.get("importance", 0),
         "text": ev.get("text"), "trace": ev.get("trace"), "has_calc": bool(ev.get("calc")),
         "n_changes": len(ev.get("changes") or []), "causes": ev.get("causes", [])}
    if full:
        d.update({"data": ev.get("data"), "changes": ev.get("changes"), "calc": ev.get("calc"), "memories": ev.get("memories"),
                  "traces": ev.get("traces"), "involved": ev.get("involved", [])})
    return d


# --- world & time ---------------------------------------------------------------------

@app.get("/api/state")
def api_state():
    L = get_lab()
    return world_info(L)


@app.get("/api/overview")
def api_overview():
    L = get_lab()
    with L.lock:
        w = L.w
        evs = [e for e in reversed(list(w.history.events.values())) if e["importance"] >= 20][:60]
        upcoming = [{"day": i["day"], "date": calm.label(i["day"]), "kind": i["kind"], "name": i["name"], "group": i.get("group")}
                    for i in w.calendar if w.day <= i["day"] <= w.day + 28 and i["kind"] != "season_end"
                    and not (i["kind"] == "exam" and i.get("weight", 1) < 2)][:14]
        groups = [{"id": g["id"], "name": g["name"], "kind": g["kind"], "members": len(g["members"]), "capacity": g["capacity"],
                   "record": g["record"], "in_season": L.sim.institutions.in_season(g) if g["kind"] == "team" else None,
                   "production": (g.get("production") or {}).get("name")} for g in w.groups.values()]
        cliques = [{"id": q["id"], "name": q["name"], "members": q["members"], "popularity": q.get("popularity"),
                    "interests": q.get("interests"), "formed": q.get("formed")} for q in w.cliques.values() if q.get("active")]
        studs = sorted(w.students(), key=lambda c: -c.popularity)
        return {"world": world_info(L), "metrics": metrics.compute(w), "metric_info": metrics.METRIC_INFO,
                "series": w.stats_series[-80:], "recent": [ev_out(e) for e in evs], "upcoming": upcoming,
                "groups": groups, "cliques": cliques,
                "spotlight": {"most_popular": [c.id for c in studs[:5]],
                              "most_stressed": [c.id for c in sorted(w.students(), key=lambda c: -c.needs["stress"])[:5]],
                              "loneliest": [c.id for c in sorted(w.students(), key=lambda c: c.needs["social"])[:5]]},
                "tally": w.meta.get("tally", {}), "actions": w.meta.get("actions", {})}


@app.post("/api/sim/advance")
def api_advance(body: dict = Body(...)):
    L = get_lab()
    unit = body.get("unit")
    days = body.get("days")
    if unit:
        days = {"day": 1, "week": 7, "month": 30, "year": 365}.get(unit)
    try:
        days = int(days)
    except (TypeError, ValueError):
        raise HTTPException(422, "days must be a whole number")
    if not 1 <= days <= 730:
        raise HTTPException(422, "days must be between 1 and 730")
    return L.start_advance(days)


@app.get("/api/sim/job")
def api_job():
    L = get_lab()
    return L.job or {"status": "idle"}


@app.post("/api/sim/new")
def api_new(body: dict = Body(default={})):
    L = get_lab()
    L.guard()
    try:
        gen_seed = int(body.get("gen_seed", 1234))
        students = int(body.get("students", 36))
        sim_seed = body.get("sim_seed")
        sim_seed = int(sim_seed) if sim_seed not in (None, "") else None
    except (TypeError, ValueError):
        raise HTTPException(422, "seeds and population must be whole numbers")
    if not 8 <= students <= 60:
        raise HTTPException(422, "students must be between 8 and 60")
    with L.lock:
        w = generate(gen_seed, students, bool(body.get("featured", True)), sim_seed=sim_seed, name=body.get("name") or None)
        L.replace_world(w)
    return world_info(L)


@app.post("/api/sim/seed")
def api_seed(body: dict = Body(...)):
    L = get_lab()
    L.guard()
    try:
        seed = int(body["seed"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(422, "seed must be a whole number")
    with L.lock:
        L.w.seed = seed
        L.sim = Simulation(L.w)
        L.autosave()
    return world_info(L)


# --- characters ----------------------------------------------------------------------

@app.get("/api/characters")
def api_characters():
    L = get_lab()
    with L.lock:
        return [char_summary(L, c) for c in sorted(L.w.chars.values(), key=lambda c: (c.role != "student", c.role, c.grade or 0, c.last, c.first))]


@app.get("/api/characters/{cid}")
def api_character(cid: str):
    L = get_lab()
    with L.lock:
        w = L.w
        c = w.chars.get(cid)
        if c is None:
            raise HTTPException(404, f"no character {cid}")
        d = char_summary(L, c)
        h = w.households.get(c.household_id)
        rels = []
        for oid, r in w.out.get(cid, {}).items():
            back = w.rels.get((oid, cid))
            bond = w.bond(cid, oid)
            rels.append({"id": oid, "mine": rel_view(L, r), "theirs": rel_view(L, back) if back else None,
                         "roles": bond["roles"] if bond else []})
        rels.sort(key=lambda x: -(abs(x["mine"]["affection"]) + x["mine"]["familiarity"] * 0.3 + x["mine"]["attraction"] * 0.3))
        timeline = [ev_out(w.history.events[e]) for e in w.history.by_char.get(cid, []) if e in w.history.events]
        decisions = []
        for tid, tr in reversed(list(w.history.traces.items())):
            if tr["char"] == cid:
                ch = next((x for x in tr["candidates"] if x["chosen"]), tr["candidates"][0])
                decisions.append({"id": tid, "day": tr["day"], "date": calm.label(tr["day"]), "slot": tr["slot"],
                                  "action": ch["action"], "label": ch.get("label", ch["action"]), "target": ch.get("target"),
                                  "target_name": ch.get("target_name"), "prob": ch["prob"], "n": tr["n"], "event": tr.get("event"),
                                  "player": bool(tr.get("player_choice")), "cancelled": tr.get("cancelled")})
                if len(decisions) >= 40:
                    break
        d.update({
            "traits": {k: r2(v) for k, v in c.traits.items()}, "aptitudes": {k: r2(v) for k, v in c.aptitudes.items()},
            "skills": [{"id": k, "label": L.sim.cat.skills[k]["label"], "value": r2(v), "cap": skill_cap(L, c, k),
                        "practice": round(c.counters.get("skillpractice:" + k, 0), 1)} for k, v in sorted(c.skills.items(), key=lambda x: -x[1])],
            "motives": {k: r2(v) for k, v in c.motives.items()}, "needs": {k: r2(v) for k, v in c.needs.items()},
            "all_interests": sorted([[k, r2(v)] for k, v in c.interests.items()], key=lambda x: -x[1]),
            "goals": c.goals[::-1], "memories": c.memories[::-1], "expectations": {k: v for k, v in sorted(c.expectations.items(), key=lambda x: -abs(x[1]))},
            "habits": {k: v for k, v in sorted(c.habits.items(), key=lambda x: -x[1])}, "money": round(c.money, 2),
            "reputation_all": {k: r2(v) for k, v in c.reputation.items()}, "age": c.age(w.day), "flags": c.flags,
            "past_memberships": c.past_memberships, "achievements": c.achievements[::-1], "relationships": rels,
            "household_info": h and {k: h[k] for k in ("id", "name", "style", "style_label", "income", "guardians", "pet", "members", "warmth", "strictness", "expectations")},
            "timeline": timeline[::-1][:200], "decisions": decisions, "counters": {k: v for k, v in c.counters.items() if not k.startswith("skillpractice:")},
            "docs": ATTRIBUTE_DOCS,
        })
        return d


@app.patch("/api/characters/{cid}")
def api_edit_character(cid: str, body: dict = Body(...)):
    L = get_lab()
    L.guard()
    with L.lock:
        ev = L.sim.edit_character(cid, body)
        L.autosave()
        return {"ok": True, "event": ev_out(ev, True)}


@app.post("/api/characters")
def api_create_character(body: dict = Body(...)):
    L = get_lab()
    L.guard()
    with L.lock:
        c = L.sim.create_character(body)
        L.autosave()
        return char_summary(L, c)


@app.get("/api/relationship/{a}/{b}")
def api_relationship(a: str, b: str):
    L = get_lab()
    with L.lock:
        w = L.w
        if a not in w.chars or b not in w.chars:
            raise HTTPException(404, "unknown character")
        ra, rb = w.rels.get((a, b)), w.rels.get((b, a))
        shared = sorted(set(w.history.by_char.get(a, [])) & set(w.history.by_char.get(b, [])))
        mems = {x: [m for m in w.chars[x].memories if y in m["with"]][::-1] for x, y in ((a, b), (b, a))}
        bond = w.bond(a, b)
        sat = None
        if w.chars[a].flags.get("partner") == b:
            sat = {a: round(satisfaction(w, a, b), 1), b: round(satisfaction(w, b, a), 1)}
        return {"a": a, "b": b, "ab": rel_view(L, ra, True) if ra else None, "ba": rel_view(L, rb, True) if rb else None,
                "roles": bond["roles"] if bond else [], "since": bond["since"] if bond else {},
                "events": [ev_out(w.history.events[e]) for e in shared if e in w.history.events][::-1][:80],
                "memories": mems, "satisfaction": sat, "thresholds": {k: w.rules[k] for k in w.rules if k.startswith("rel.")}}


@app.get("/api/social/graph")
def api_graph(mode: str = "friends", alumni: bool = False):
    L = get_lab()
    with L.lock:
        w = L.w
        R = w.rules
        roles = ("student", "alumni") if alumni else ("student",)
        ids = [c.id for c in w.chars.values() if c.role in roles and c.status == "active"]
        idset = set(ids)
        nodes = [{"id": c.id, "name": c.name, "short": c.short, "color": c.color, "popularity": r2(c.popularity), "grade": c.grade,
                  "role": c.role, "clique": c.flags.get("clique"), "partner": c.flags.get("partner"), "mood": r2(c.mood)}
                 for c in (w.chars[i] for i in sorted(ids))]
        edges = []
        for (a, b), r in w.rels.items():
            if a >= b or a not in idset or b not in idset:
                continue
            r2_ = w.rels.get((b, a))
            if r2_ is None:
                continue
            fa, fb = r.affection >= R["rel.friend_threshold"], r2_.affection >= R["rel.friend_threshold"]
            kind = None
            if w.has_role(a, b, "partner"):
                kind = "partner"
            elif mode in ("all", "romance") and (r.crush or r2_.crush):
                kind = "crush"
            elif r.label == "rival" or r2_.label == "rival" or (mode in ("all", "conflict") and (r.affection <= R["rel.enemy_threshold"] or r2_.affection <= R["rel.enemy_threshold"])):
                kind = "conflict"
            elif fa and fb:
                kind = "mutual"
            elif fa or fb:
                kind = "one_sided"
            elif mode == "all" and r.familiarity >= 30 and r2_.familiarity >= 30:
                kind = "acquaintance"
            if kind is None:
                continue
            if mode == "friends" and kind not in ("mutual", "one_sided", "partner"):
                continue
            if mode == "romance" and kind not in ("partner", "crush"):
                continue
            if mode == "conflict" and kind != "conflict":
                continue
            edges.append({"a": a, "b": b, "kind": kind, "ab": {"affection": r2(r.affection), "label": r.label, "crush": r.crush},
                          "ba": {"affection": r2(r2_.affection), "label": r2_.label, "crush": r2_.crush},
                          "weight": r2((max(r.affection, 0) + max(r2_.affection, 0)) / 2)})
        cliques = [{"id": q["id"], "name": q["name"], "members": q["members"]} for q in w.cliques.values() if q.get("active")]
        asym = []
        for (a, b), r in w.rels.items():
            if a in idset and b in idset and a < b and (b, a) in w.rels:
                o = w.rels[(b, a)]
                if r.familiarity >= 20 and o.familiarity >= 20:
                    asym.append({"a": a, "b": b, "ab": r2(r.affection), "ba": r2(o.affection), "gap": r2(abs(r.affection - o.affection)),
                                 "a_label": r.label, "b_label": o.label, "a_perceived": r2(r.perceived), "b_perceived": r2(o.perceived)})
        asym.sort(key=lambda x: -x["gap"])
        return {"nodes": nodes, "edges": edges, "cliques": cliques, "asymmetric": asym[:25]}


@app.get("/api/groups")
def api_groups():
    L = get_lab()
    with L.lock:
        w = L.w
        out = []
        for g in w.groups.values():
            d = {k: g.get(k) for k in ("id", "name", "kind", "skill", "selection", "capacity", "members", "leaders", "staff",
                                        "record", "prestige", "practice_days", "history", "production")}
            d["absences"] = {k: (sum(v) if isinstance(v, list) else v) for k, v in g.get("absences", {}).items()}
            d["cut"] = g.get("cut", [])
            d["in_season"] = L.sim.institutions.in_season(g) if g["kind"] == "team" else None
            d["upcoming"] = [{"day": i["day"], "date": calm.label(i["day"]), "kind": i["kind"], "name": i["name"]}
                             for i in w.calendar if i.get("group") == g["id"] and i["day"] >= w.day][:5]
            out.append(d)
        cl = [dict(q) for q in w.cliques.values()]
        return {"groups": out, "cliques": cl, "households": list(w.households.values())}


# --- history --------------------------------------------------------------------------

@app.get("/api/events")
def api_events(char: str | None = None, type: str | None = None, q: str | None = None, min_importance: float = 0,
               day_from: int | None = None, day_to: int | None = None, limit: int = 100, offset: int = 0, order: str = "desc",
               group: str | None = None):
    L = get_lab()
    with L.lock:
        h = L.w.history
        src = h.by_char.get(char, []) if char else list(h.events.keys())
        items = []
        ql = q.lower() if q else None
        for eid in src:
            e = h.events.get(eid)
            if e is None:
                continue
            if e["importance"] < min_importance:
                continue
            if type and not (e["type"] == type or e["type"].startswith(type + ".") or f"{e['type']}.{e.get('outcome')}" == type):
                continue
            if group and e.get("group") != group:
                continue
            if day_from is not None and e["day"] < day_from:
                continue
            if day_to is not None and e["day"] > day_to:
                continue
            if ql and ql not in (e.get("text") or "").lower():
                continue
            items.append(e)
        if order == "desc":
            items.reverse()
        total = len(items)
        types = sorted({e["type"].split(".")[0] for e in h.events.values()})
        return {"total": total, "items": [ev_out(e) for e in items[offset:offset + min(limit, 500)]], "types": types,
                "folded": h.folded.get(char) if char else None, "folded_total": h.folded_total}


@app.get("/api/events/{eid}")
def api_event(eid: int):
    L = get_lab()
    with L.lock:
        h = L.w.history
        e = h.events.get(eid)
        if e is None:
            raise HTTPException(404, "event not found (it may have been folded into counters by history retention)")
        d = ev_out(e, True)
        d["cause_events"] = [ev_out(h.events[c]) for c in e.get("causes", []) if c in h.events]
        d["consequences"] = [ev_out(h.events[c]) for c in h.consequences.get(eid, []) if c in h.events]
        tr = h.traces.get(e.get("trace")) if e.get("trace") else None
        d["trace_obj"] = trace_out(L, tr) if tr else None
        d["trace_missing"] = bool(e.get("trace")) and tr is None
        return d


def trace_out(L, tr):
    vs = L.w.meta.get("rules_versions", {})
    weights = vs.get(tr.get("rules_version"), {})
    d = dict(tr)
    d["date"] = calm.label(tr["day"])
    d["weights"] = {k: v for k, v in weights.items() if k.startswith(("decision.", "motive."))}
    return d


@app.get("/api/traces/{tid}")
def api_trace(tid: int):
    L = get_lab()
    with L.lock:
        tr = L.w.history.traces.get(tid)
        if tr is None:
            raise HTTPException(404, "trace not found (routine traces are kept for a limited window; see History retention rules)")
        d = trace_out(L, tr)
        e = L.w.history.events.get(tr.get("event")) if tr.get("event") else None
        d["event_obj"] = ev_out(e, True) if e else None
        return d


@app.get("/api/export/events.csv")
def api_events_csv():
    L = get_lab()
    with L.lock:
        buf = io.StringIO()
        wr = csv.writer(buf)
        wr.writerow(["id", "day", "date", "slot", "type", "outcome", "importance", "actors", "targets", "text"])
        for e in L.w.history.events.values():
            wr.writerow([e["id"], e["day"], calm.label(e["day"]), e.get("slot"), e["type"], e.get("outcome"), e["importance"],
                         " ".join(e.get("actors", [])), " ".join(e.get("targets", [])), e.get("text")])
        return Response(buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=lifeos-events.csv"})


# --- rules & catalogs -------------------------------------------------------------------

@app.get("/api/rules")
def api_rules():
    L = get_lab()
    sch = schema()
    return {"sections": sch.sections, "values": L.w.rules, "defaults": sch.defaults(), "version": rules_hash(L.w.rules),
            "changes": L.w.rule_changes[::-1][:50]}


@app.put("/api/rules")
def api_set_rules(body: dict = Body(...)):
    L = get_lab()
    L.guard()
    changes = body.get("changes")
    if not isinstance(changes, dict):
        raise HTTPException(422, "body must be {changes: {key: value}}")
    with L.lock:
        diffs = L.sim.set_rules(changes, note=body.get("note", ""))
        L.autosave()
    return {"applied": diffs, "values": L.w.rules, "version": rules_hash(L.w.rules)}


@app.post("/api/rules/reset")
def api_reset_rules(body: dict = Body(default={})):
    L = get_lab()
    L.guard()
    keys = body.get("keys")
    d = schema().defaults()
    ch = {k: d[k] for k in (keys or d)}
    with L.lock:
        diffs = L.sim.set_rules(ch, note="reset to defaults")
        L.autosave()
    return {"applied": diffs, "values": L.w.rules}


@app.get("/api/catalogs")
def api_catalogs():
    L = get_lab()
    cat = L.sim.cat
    acts = []
    for a in cat.actions.values():
        d = dict(a)
        d["overridden"] = a["id"] in L.w.action_overrides
        d["override"] = L.w.action_overrides.get(a["id"])
        acts.append(d)
    return {"actions": acts, "goals": cat.goals, "templates": cat.templates, "world": cat.world, "people": cat.people,
            "attributes": ATTRIBUTE_DOCS, "metrics": metrics.METRIC_INFO,
            "files": {"actions": "backend/data/actions.json", "rules": "backend/data/rules_schema.json", "world": "backend/data/world.json",
                      "people": "backend/data/people.json", "templates": "backend/data/templates.json", "goals": "backend/data/goals.json"}}


@app.put("/api/catalogs/actions/{aid}")
def api_set_action(aid: str, body: dict = Body(...)):
    L = get_lab()
    L.guard()
    with L.lock:
        clean = L.sim.set_action_override(aid, body.get("changes") or {})
        L.autosave()
    return {"applied": clean, "action": L.sim.cat.actions[aid]}


@app.delete("/api/catalogs/actions/{aid}/override")
def api_reset_action(aid: str):
    L = get_lab()
    L.guard()
    with L.lock:
        L.sim.reset_action(aid)
        L.autosave()
    return {"action": L.sim.cat.actions.get(aid)}


# --- saves ------------------------------------------------------------------------------

@app.get("/api/saves")
def api_saves():
    return get_lab().store.list_saves()


@app.post("/api/saves")
def api_save(body: dict = Body(default={})):
    L = get_lab()
    L.guard()
    with L.lock:
        sid = L.store.save_world(L.w, (body.get("name") or f"Save - {calm.label(L.w.day)}")[:120], notes=(body.get("notes") or "")[:2000])
    return {"id": sid}


@app.post("/api/saves/{sid}/load")
def api_load(sid: int):
    L = get_lab()
    L.guard()
    w = L.store.load_world(sid)
    if w is None:
        raise HTTPException(404, "save not found")
    with L.lock:
        L.replace_world(w)
    return world_info(L)


@app.delete("/api/saves/{sid}")
def api_delete_save(sid: int):
    if not get_lab().store.delete_save(sid):
        raise HTTPException(404, "save not found")
    return {"ok": True}


@app.get("/api/saves/{sid}/download")
def api_download(sid: int):
    b = get_lab().store.load_blob(sid)
    if b is None:
        raise HTTPException(404, "save not found")
    return Response(b, media_type="application/octet-stream",
                    headers={"Content-Disposition": f"attachment; filename=lifeos-save-{sid}.lifeos"})


@app.post("/api/saves/upload")
async def api_upload(request: Request):
    L = get_lab()
    L.guard()
    data = await request.body()
    try:
        w = world_from_bytes(data)
    except Exception:
        try:
            from .model import World
            w = World.from_dict(json.loads(data.decode("utf-8")))
        except Exception:
            raise HTTPException(422, "That file is not a LIFE OS save.")
    sid = L.store.save_world(w, f"Imported - {calm.label(w.day)}", notes="uploaded file")
    return {"id": sid}


# --- experiments --------------------------------------------------------------------------

@app.get("/api/experiments")
def api_experiments():
    L = get_lab()
    rows = L.store.list_experiments()
    for r in rows:
        st = L.runner.status(r["id"])
        if st:
            r["progress"] = {"done": st["done"], "total": st["total"]}
    return {"experiments": rows, "presets": PRESETS}


@app.post("/api/experiments")
def api_run_experiment(body: dict = Body(...)):
    L = get_lab()
    try:
        spec = validate_spec(body)
    except ValueError as e:
        raise HTTPException(422, str(e))
    base = spec["base"]
    with L.lock:
        if base["kind"] == "current":
            bw = L.w
        elif base["kind"] == "save":
            bw = L.store.load_world(int(base.get("save_id", 0)))
            if bw is None:
                raise HTTPException(422, "base save not found")
        else:
            bw = generate(int(base.get("gen_seed", 1234)), int(base.get("students", 36)), bool(base.get("featured", True)))
            from .engine import Simulation as _S
            _S(bw)
        base_json = world_to_json(bw, with_history=False)
        spec["base"]["day"] = bw.day
        spec["base"]["date"] = calm.label(bw.day)
    eid = L.runner.start(spec, base_json)
    return {"id": eid, "runs": len(spec["variants"]) * len(spec["seeds"])}


@app.get("/api/experiments/{eid}")
def api_experiment(eid: int):
    L = get_lab()
    e = L.store.get_experiment(eid)
    if e is None:
        raise HTTPException(404, "experiment not found")
    st = L.runner.status(eid)
    if st:
        e["progress"] = {"done": st["done"], "total": st["total"]}
    return e


@app.delete("/api/experiments/{eid}")
def api_delete_experiment(eid: int):
    if not get_lab().store.delete_experiment(eid):
        raise HTTPException(404, "experiment not found")
    return {"ok": True}


# --- play mode ------------------------------------------------------------------------------

@app.post("/api/play/{cid}/options")
def api_play_options(cid: str):
    L = get_lab()
    L.guard()
    with L.lock:
        w = L.w
        c = w.chars.get(cid)
        if c is None or c.status != "active":
            raise HTTPException(404, "no active character with that id")
        before = w.history.next_event
        res = L.sim.options_for(cid)
        if res is None:
            raise HTTPException(409, "this character has no decisions coming up this week")
        slot, dec = res
        skipped = [ev_out(e) for eid, e in w.history.events.items() if eid >= before and e["importance"] >= 15]
        rows = dec["trace"]["candidates"]
        order = sorted(range(len(dec["cands"])), key=lambda i: -dec["cands"][i].u)
        opts = []
        for rank, i in enumerate(order):
            cd = dec["cands"][i]
            row = rows[rank]
            opts.append({"index": i, "action": cd.a["id"], "label": cd.a["label"], "category": cd.a["category"],
                         "target": cd.target if not isinstance(cd.target, dict) else None, "target_name": L.sim.target_name(cd),
                         "why": cd.why, "utility": round(cd.u, 2), "prob": round(cd.prob, 4), "risk": cd.a["risk"],
                         "terms": row.get("terms")})
        today = [{"kind": i["kind"], "name": i["name"]} for i in L.sim._today]
        return {"slot": slot, "date": calm.label(w.day), "day": w.day, "character": char_summary(L, c),
                "needs": c.needs, "mood": c.mood, "money": c.money, "today": today,
                "goals": [g for g in c.goals if g["status"] == "active"], "options": opts, "temperature": round(dec["T"], 2),
                "skipped_events": skipped[-12:], "world": world_info(L)}


@app.post("/api/play/{cid}/act")
def api_play_act(cid: str, body: dict = Body(...)):
    L = get_lab()
    L.guard()
    with L.lock:
        try:
            idx = int(body["index"])
        except (KeyError, TypeError, ValueError):
            raise HTTPException(422, "index must be a whole number")
        c = L.w.chars.get(cid)
        if c is None:
            raise HTTPException(404, "unknown character")
        before = {k: v for k, v in c.needs.items()}
        mood0 = c.mood
        evs = L.sim.act_as(cid, idx)
        L.autosave()
        return {"events": [ev_out(e, True) for e in evs], "needs_before": before, "needs_after": c.needs,
                "mood_before": mood0, "mood_after": c.mood, "world": world_info(L)}


# --- workbook -------------------------------------------------------------------------------

@app.get("/api/export/workbook")
def api_export_workbook():
    from .spreadsheet import export_workbook
    L = get_lab()
    with L.lock:
        data = export_workbook(L.sim)
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=lifeos-balancing.xlsx"})


@app.post("/api/import/workbook")
async def api_import_workbook(request: Request):
    from .spreadsheet import import_workbook
    L = get_lab()
    L.guard()
    data = await request.body()
    try:
        with L.lock:
            rep = import_workbook(L.sim, data)
            L.autosave()
    except (OSError, ValueError, KeyError) as e:
        raise HTTPException(422, f"Could not read that workbook: {e}")
    return rep


# --- frontend ---------------------------------------------------------------------------------

if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def _no_frontend():
        return JSONResponse({"message": "API is running. The built frontend was not found at frontend/dist; run `npm run build` in frontend/."})
