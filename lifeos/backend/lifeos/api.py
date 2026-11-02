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

import mimetypes

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import calendar as calm
from . import metrics, pets
from .catalogs import ATTRIBUTE_DOCS, CatalogError, Catalogs
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
        self.inline = False          # the phone app: no threads; long jobs are pumped step by step
        self._pump = None
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

    def autosave(self, force: bool = True):
        """Persist the world. Advances autosave at most every 20s (a big history takes ~1s to write).
        On the phone every save is throttled to 30s; flush() writes whatever is pending."""
        now = time.time()
        if self.inline and force != "now" and now - getattr(self, "_last_save", 0) < 30:
            self._dirty = True
            return
        if not force and now - getattr(self, "_last_save", 0) < 20:
            self._dirty = True
            return
        self.store.save_world(self.w, "Autosave", kind="autosave")
        self._last_save = now
        self._dirty = False

    def flush(self) -> bool:
        if getattr(self, "_dirty", False) and not self.busy():
            with self.lock:
                self.autosave(force="now")
            return True
        return False

    def replace_world(self, w):
        self.sim = Simulation(w)
        self.autosave(force="now")

    # --- running long jobs -------------------------------------------------------
    def _drain(self, gen):
        for _ in gen:
            pass

    def _launch(self, gen):
        if self.inline:
            self._pump = gen
        else:
            threading.Thread(target=self._drain, args=(gen,), daemon=True).start()

    def pump(self, seconds: float = 0.25) -> bool:
        """Run a pending job for up to `seconds`. Returns True while there's more to do (phone app)."""
        gen = self._pump
        if gen is None:
            return False
        end = time.time() + seconds
        try:
            while time.time() < end:
                next(gen)
        except StopIteration:
            self._pump = None
            return False
        return True

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
                    yield
                with self.lock:
                    self.autosave(force=days >= 7)
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
            self._drain(work())
        else:
            self._launch(work())
        return job


    STOP_TYPES = {"tryout", "audition", "injury", "recruiting", "award", "path", "ask_out", "ask_to_dance", "break_up", "election",
                  "rumor_reached", "graduation", "exclusion", "admissions"}

    def start_story_advance(self, until: str) -> dict:
        """Live the protagonist's life forward until something worth stopping for."""
        from . import moments
        from .calendar import DECISION_SLOTS
        self.guard()
        limits = {"decision": 4, "day": 1, "week": 7, "month": 31, "moment": 400}
        if until not in limits:
            raise HTTPException(422, f"until must be one of {', '.join(limits)}")
        self.job_seq += 1
        w = self.w
        job = {"id": self.job_seq, "status": "running", "days": limits[until], "done": 0, "start_day": w.day, "story": True,
               "until": until, "start_event": w.history.next_event, "started": time.time(), "error": None, "stop": None}
        self.job = job

        def work():
            try:
                sim = self.sim
                w = sim.w
                prot = w.meta.get("protagonist")
                start = w.day
                seen = {i["id"] for i in w.meta.get("inbox", [])}
                stepped = False
                reason = None
                ctl = moments.control(w)
                while True:
                    with self.lock:
                        pend = moments.pending(w)
                        if pend and until != "decision" and all(moments.light(m["kind"]) for m in pend):
                            for m in pend:  # skipping ahead: your character plays the class game or the night themselves
                                moments.resolve(sim, m["id"], None)
                            pend = []
                        if pend:
                            reason = "moment"
                            break
                        ph = sim.current_phase()
                        if until == "decision" and stepped and ph in DECISION_SLOTS and prot in sim.slot_actors(ph) \
                                and not (ph == "lunch" and ctl.get("auto_lunch", False)) and not sim.committed(prot, ph):
                            reason = "decision"
                            break
                        if w.day >= start + limits[until] and (until != "decision" or stepped):
                            reason = "time"
                            break
                        before = w.history.next_event
                        sim.step()
                        stepped = True
                        if until == "moment":
                            fresh = [i for i in w.meta.get("inbox", []) if i["id"] not in seen and i["status"] == "pending" and i["to"] == prot]
                            seen |= {i["id"] for i in fresh}
                            close = [i for i in fresh if (prot, i["from"]) in w.rels and (w.rels[(prot, i["from"])].affection >= w.rules["rel.friend_threshold"]
                                     or w.rels[(prot, i["from"])].crush or w.chars[prot].flags.get("partner") == i["from"])]
                            if close and ctl.get("ask_invites") and w.meta.get("_invite_stop_day") != w.day:
                                w.meta["_invite_stop_day"] = w.day
                                reason = "invite"
                                break
                            if ctl.get("stop_on_big"):
                                hit = [e for eid, e in w.history.events.items() if eid >= before and
                                       (prot in e["actors"] or (prot in e["targets"] and e["type"] != "exclusion")) and
                                       (e["type"].split(".")[0] in self.STOP_TYPES or e["importance"] >= 40)]
                                if hit:
                                    reason = "event"
                                    break
                    job["done"] = w.day - start
                    yield
                with self.lock:
                    self.autosave(force=(w.day - start) >= 7)
                job["status"] = "done"
            except Exception as e:  # surface it
                import traceback
                job["status"] = "failed"
                job["error"] = f"{type(e).__name__}: {e}"
                job["trace"] = traceback.format_exc()[-3000:]
            job["stop"] = reason
            job["end_day"] = self.w.day
            job["seconds"] = round(time.time() - job["started"], 2)
            job["new_events"] = self.w.history.next_event - job["start_event"]

        if until in ("decision", "day"):
            self._drain(work())
        else:
            self._launch(work())
        return job


lab: Lab | None = None


def get_lab() -> Lab:
    global lab
    if lab is None:
        lab = Lab(Store())
    return lab


mimetypes.add_type("application/manifest+json", ".webmanifest")
app = FastAPI(title="LIFE OS - Living World Laboratory", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
def _save_on_exit():
    if lab is not None and getattr(lab, "_dirty", False):
        with lab.lock:
            lab.autosave()


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
            "job": L.job, "busy": L.busy(), "action_overrides": sorted(w.action_overrides),
            "protagonist": w.meta.get("protagonist"), "story_title": (w.meta.get("story") or {}).get("title"),
            "pending_moments": sum(1 for m in w.meta.get("moments", []) if m["status"] == "pending")}


def rep_tags(c, n=3):
    return [[k, round(v, 1)] for k, v in sorted(c.reputation.items(), key=lambda x: -x[1]) if v >= 3][:n]


def char_summary(L: Lab, c) -> dict:
    from .appearance import look_of
    w = L.w
    R = w.rules
    friends = sum(1 for o, r in w.out.get(c.id, {}).items() if r.affection >= R["rel.friend_threshold"] and w.chars[o].role != "staff")
    cl = w.cliques.get(c.flags.get("clique") or "")
    top = sorted(c.interests.items(), key=lambda x: -x[1])[:3]
    return {"id": c.id, "name": c.name, "first": c.first, "last": c.last, "short": c.short, "role": c.role, "grade": c.grade,
            "year_label": c.year_label, "location": c.location, "school": c.school, "custom": c.custom,
            "archetype": c.archetype, "color": c.color, "pronouns": c.pronouns, "featured": c.featured, "status": c.status,
            "mood": r2(c.mood), "stress": r2(c.needs.get("stress", 0)), "energy": r2(c.needs.get("energy", 0)),
            "popularity": r2(c.popularity), "friends": friends, "clique": {"id": cl["id"], "name": cl["name"]} if cl and cl.get("active") else None,
            "memberships": [{"id": g, "name": w.groups[g]["name"], "kind": w.groups[g]["kind"]} for g in c.memberships],
            "partner": c.flags.get("partner"), "title": c.title, "role_label": c.role_label,
            "interests": [[k, round(v)] for k, v in top], "reputation": rep_tags(c), "bio": c.bio, "gpa": round(c.gpa, 2),
            "household": c.household_id, "grounded": c.flags.get("grounded_until", -1) >= w.day,
            "goals": [g["label"] for g in c.goals if g["status"] == "active"][:3], "look": look_of(c)}


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
            "year_label": c.year_label, "school": c.school, "location": c.location, "body": c.body, "positions": c.positions,
            "jersey": c.jersey, "seasons": [dict(st, key=k) for k, st in sorted(c.stats.items(), key=lambda x: (x[0].split(":")[1], x[0]))],
            "awards": c.awards[::-1], "recruiting": c.recruiting, "path": c.path, "custom": c.custom,
            "is_protagonist": c.id == w.meta.get("protagonist"),
        })
        from .story import career
        d["career"] = career(c)
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
        c = L.sim.create_custom(body) if body.get("first") and body.get("gender") else L.sim.create_character(body)
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


# --- story mode ----------------------------------------------------------------------------------

@app.get("/api/story")
def api_story():
    from . import story
    L = get_lab()
    with L.lock:
        return story.summary(L.sim, lambda sim, c: char_summary(L, c), lambda sim, r: rel_view(L, r), ev_out)


@app.get("/api/story/catalog")
def api_story_catalog():
    from . import story
    L = get_lab()
    cat = L.sim.cat
    return {"archetypes": cat.people["archetypes"], "relationships": [{"id": k, "label": v["label"]} for k, v in story.REL_PRESETS.items()],
            "sports": cat.sports["sports"], "builds": list(story.BUILDS), "guardian_styles": cat.people["guardian_styles"],
            "incomes": list(story.INCOMES), "skills": cat.world["skills"], "hobbies": cat.world["hobbies"], "attributes": ATTRIBUTE_DOCS,
            "colleges": cat.colleges, "names": {k: v[:12] for k, v in cat.people["names"].items()},
            "pets": {k: {"label": v["label"], "breeds": v["breeds"], "coats": v["coats"]} for k, v in pets.SPECIES.items()},
            "school": {k: cat.world["school"].get(k) for k in ("name", "short", "mascot")}, "town": cat.world["town"].get("name")}


@app.post("/api/story/validate")
def api_story_validate(body: dict = Body(...)):
    from . import story
    try:
        story.validate_story(body.get("spec") or body)
    except story.StoryError as e:
        return JSONResponse(status_code=422, content={"detail": "The story needs a few fixes", "errors": e.errors})
    return {"ok": True}


@app.post("/api/story/new")
def api_story_new(body: dict = Body(...)):
    from . import story
    L = get_lab()
    L.guard()
    try:
        w = story.create_story(body.get("spec") or body)
    except story.StoryError as e:
        return JSONResponse(status_code=422, content={"detail": "The story needs a few fixes", "errors": e.errors})
    with L.lock:
        L.replace_world(w)
        story.begin(L.sim)
        L.autosave()
    return world_info(L)


@app.post("/api/story/advance")
def api_story_advance(body: dict = Body(default={})):
    from . import moments
    L = get_lab()
    if not L.w.meta.get("protagonist"):
        raise HTTPException(409, "There is no story yet. Start one first.")
    if body.get("focus"):
        moments.control(L.w)["focus"] = str(body["focus"])
    return L.start_story_advance(body.get("until", "moment"))


@app.post("/api/story/control")
def api_story_control(body: dict = Body(...)):
    from . import moments
    from .decision import FOCUS
    L = get_lab()
    with L.lock:
        ctl = moments.control(L.w)
        if "focus" in body:
            if body["focus"] not in list(FOCUS) + ["balanced"]:
                raise HTTPException(422, f"focus must be one of balanced, {', '.join(FOCUS)}")
            ctl["focus"] = body["focus"]
        for k in ("ask_invites", "ask_romance", "stop_before_games", "stop_on_big", "auto_lunch", "class_games", "editor"):
            if k in body:
                ctl[k] = bool(body[k])
        return ctl


@app.post("/api/story/moment/{mid}")
def api_story_moment(mid: str, body: dict = Body(default={})):
    from . import moments
    L = get_lab()
    L.guard()
    with L.lock:
        try:
            ev = moments.resolve(L.sim, mid, body.get("index"))
        except ValueError as e:
            raise HTTPException(409, str(e))
        L.autosave(force=False)
        return {"event": ev_out(ev, True)}


@app.post("/api/story/inbox/{iid}")
def api_story_inbox(iid: str, body: dict = Body(...)):
    from .history import Effects
    L = get_lab()
    L.guard()
    with L.lock:
        w = L.w
        inv = next((i for i in w.meta.get("inbox", []) if i["id"] == iid), None)
        if inv is None or inv["status"] != "pending":
            raise HTTPException(409, "that invitation isn't waiting anymore")
        from . import messages
        if body.get("accept"):
            w.meta.setdefault("control", {})["queued"] = {"invite": iid}
            if "phone" in w.meta:
                messages.answered_elsewhere(L.sim, "invite", iid, 0)
            return {"queued": True, "note": "You'll say yes at your next free moment."}
        if "phone" in w.meta:
            messages.answered_elsewhere(L.sim, "invite", iid, 1)
        inv["status"] = "declined"
        ev = L.sim.new_event("interact.hang_out", "declined", [inv["from"]], [inv["to"]], 8, {"kind": "hang_out"})
        fx = Effects(w, ev)
        fx.rel(inv["from"], inv["to"], "perceived", -5, "invite declined")
        fx.rel(inv["from"], inv["to"], "affection", -1, "invite declined")
        L.sim.finish(ev, fx)
        return {"declined": True}


@app.post("/api/story/protagonist")
def api_story_protagonist(body: dict = Body(...)):
    L = get_lab()
    L.guard()
    cid = body.get("id")
    with L.lock:
        c = L.w.chars.get(cid)
        if c is None or c.role == "staff" or c.status != "active":
            raise HTTPException(422, "pick an active student or graduate")
        L.w.meta["protagonist"] = cid
        L.w.meta.setdefault("story", {"title": f"{c.name}'s story", "start_day": L.w.day, "years": 7})
        from .story import story_circle
        L.w.meta["circle"] = sorted(story_circle(L.w))
        L.autosave()
        return world_info(L)


# --- character worksheet -------------------------------------------------------------------------

@app.get("/api/story/worksheet.xlsx")
def api_worksheet():
    from .worksheet import build_workbook
    return Response(build_workbook(get_lab().sim.cat), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=character-worksheet.xlsx"})


# --- dialogue packs --------------------------------------------------------------------------

def _pack_from(body: dict) -> dict:
    from . import dialogue
    if isinstance(body.get("pack"), dict):
        return body["pack"]
    if isinstance(body.get("text"), str):
        return dialogue.parse_text(body["text"])
    if any(k in body for k in dialogue.SECTIONS):
        return body
    raise ValueError("send the pack as {\"pack\": {...}} or {\"text\": \"...\"}")


def _dialogue_changed(L):
    with L.lock:
        L.sim.cat = Catalogs(L.w.action_overrides)


def _dialogue_list():
    from . import dialogue
    m = dialogue.merged()
    L = get_lab()
    story = bool(L.w.meta.get("protagonist"))
    rows = []
    for p in dialogue.packs():
        row = dialogue.pack_summary(p)
        row["in_order"] = dialogue.in_order(p["id"])
        if story and p["enabled"]:
            with L.lock:
                row["progress"] = dialogue.progress(L.sim, p["id"])
        rows.append(row)
    return {"packs": rows,
            "scenes": sorted(k for k, v in m["moments"].items() if v.get("scene")),
            "lines": sum(len(v) for v in m["texts"].values())}


@app.get("/api/dialogue/packs")
def api_dialogue_packs():
    return _dialogue_list()


@app.post("/api/dialogue/check")
def api_dialogue_check(body: dict = Body(...)):
    from . import dialogue
    try:
        pack = _pack_from(body)
    except ValueError as e:
        return {"ok": False, "errors": [str(e)], "warnings": [], "summary": {}}
    return {**dialogue.check(pack), "name": pack.get("name")}


@app.post("/api/dialogue/packs")
def api_dialogue_add(body: dict = Body(...)):
    from . import dialogue
    L = get_lab()
    try:
        pack = _pack_from(body)
    except ValueError as e:
        return JSONResponse({"detail": str(e), "errors": [str(e)]}, status_code=422)
    r = dialogue.add_pack(pack)
    if not r["ok"]:
        return JSONResponse({"detail": "the pack has a few problems", "errors": r["errors"], "warnings": r["warnings"]}, status_code=422)
    _dialogue_changed(L)
    return {**_dialogue_list(), "added": r["id"], "warnings": r["warnings"], "summary": r["summary"]}


@app.post("/api/dialogue/packs/{pid}/enabled")
def api_dialogue_enable(pid: str, body: dict = Body(...)):
    from . import dialogue
    try:
        dialogue.set_enabled(pid, bool(body.get("enabled", True)))
    except KeyError:
        raise HTTPException(404, "no such pack")
    _dialogue_changed(get_lab())
    return _dialogue_list()


@app.post("/api/dialogue/packs/{pid}/remove")
def api_dialogue_remove(pid: str):
    from . import dialogue
    try:
        dialogue.remove_pack(pid)
    except KeyError:
        raise HTTPException(404, "no such pack")
    except ValueError as e:
        raise HTTPException(409, str(e))
    _dialogue_changed(get_lab())
    return _dialogue_list()


@app.get("/api/dialogue/guide.md")
def api_dialogue_guide(download: int = 0):
    from . import dialogue
    headers = {"Content-Disposition": "attachment; filename=lifeos-dialogue-guide.md"} if download else {}
    return Response(dialogue.guide_markdown(), media_type="text/markdown; charset=utf-8", headers=headers)


@app.get("/api/dialogue/prompt")
def api_dialogue_prompt():
    from . import dialogue
    return {"prompt": dialogue.prompt_for_ai()}


@app.post("/api/dialogue/packs/{pid}/order")
def api_dialogue_order(pid: str, body: dict = Body(...)):
    """Play a storyline's scenes as chapters in order (or let them come up whenever)."""
    from . import dialogue
    try:
        dialogue.set_in_order(pid, bool(body.get("in_order")))
    except KeyError:
        raise HTTPException(404, "no such pack")
    _dialogue_changed(get_lab())
    return _dialogue_list()


@app.get("/api/dialogue/cast")
def api_dialogue_cast(pack: str):
    """Who a storyline is about in your story: for each kind of person it uses, who it picked and who else fits."""
    from . import dialogue
    L = get_lab()
    w = L.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if not me:
        return {"kinds": []}
    out = []
    with L.lock:
        for k in dialogue.pack_kinds(pack):
            cands = dialogue.candidates(L.sim, me, k)
            cur = dialogue.cast_of(w, pack, k)
            cur = cur if cur in cands else None
            out.append({"who": k, "label": dialogue.WHO[k][:-1], "current": cur and {"id": cur, "name": w.chars[cur].name},
                        "options": [{"id": o, "name": w.chars[o].name, "first": w.chars[o].first} for o in cands]})
    return {"kinds": out}


@app.post("/api/dialogue/cast")
def api_dialogue_set_cast(body: dict = Body(...)):
    """Pick who a storyline is about: {pack, who, char}. char null goes back to the game's pick."""
    from . import dialogue
    L = get_lab()
    L.guard()
    with L.lock:
        w = L.w
        me = w.chars.get(w.meta.get("protagonist") or "")
        pack, who, cid = body.get("pack"), body.get("who"), body.get("char")
        if not me or who not in dialogue.WHO:
            raise HTTPException(422, "pick a kind of person")
        if cid is None:
            (w.meta.get("pack_cast", {}).get(pack) or {}).pop(who, None)
        elif cid not in dialogue.candidates(L.sim, me, who):
            raise HTTPException(409, "they aren't that to you in this story")
        else:
            dialogue.set_cast(w, pack, who, cid)
        L.autosave()
    return api_dialogue_cast(pack)


@app.get("/api/dialogue/show-prompt")
def api_dialogue_show_prompt():
    """The prompt that makes all your storylines one story: a season plan with crossover episodes."""
    from . import dialogue
    return {"prompt": dialogue.prompt_for_show()}


@app.get("/api/dialogue/texting-prompt")
def api_dialogue_texting_prompt(pack: str = ""):
    """The prompt that gives one of your storylines' people their own way of texting (?pack=<id> includes that pack)."""
    from . import dialogue
    try:
        return {"prompt": dialogue.prompt_for_texting(pack or None)}
    except KeyError:
        raise HTTPException(404, "no such pack")


@app.get("/api/dialogue/update-prompt")
def api_dialogue_update_prompt(pack: str = ""):
    """The prompt that upgrades a pack you already made: with ?pack=<id> it includes that pack's JSON."""
    from . import dialogue
    try:
        return {"prompt": dialogue.prompt_for_update(pack or None)}
    except KeyError:
        raise HTTPException(404, "no such pack")


@app.get("/api/dialogue/current")
def api_dialogue_current(download: int = 0):
    from . import dialogue
    data = json.dumps(dialogue.current_dialogue(), indent=1, ensure_ascii=False)
    headers = {"Content-Disposition": "attachment; filename=lifeos-current-dialogue.json"} if download else {}
    return Response(data, media_type="application/json; charset=utf-8", headers=headers)


@app.post("/api/dialogue/try/{sid}")
def api_dialogue_try(sid: str):
    from . import dialogue
    L = get_lab()
    L.guard()
    with L.lock:
        try:
            m = dialogue.try_scene(L.sim, sid)
        except KeyError:
            raise HTTPException(404, "no such scene")
        except ValueError as e:
            raise HTTPException(409, str(e))
        L.autosave()
        return {"moment": {k: m[k] for k in ("id", "kind", "title", "text", "choices")}}


@app.get("/api/story/worksheet-guide")
def api_worksheet_guide(download: int = 0):
    from .worksheet import guide_markdown
    headers = {"Content-Disposition": "attachment; filename=character-worksheet-guide.md"} if download else {}
    return Response(guide_markdown(get_lab().sim.cat), media_type="text/markdown; charset=utf-8", headers=headers)


@app.get("/api/story/worksheet-prompt")
def api_worksheet_prompt():
    from .worksheet import PROMPT
    cat = get_lab().sim.cat
    return {"prompt": PROMPT.replace("{school}", cat.world["school"]["name"]).replace("{town}", cat.world["town"]["name"]).strip()}


@app.post("/api/story/import-sheet")
async def api_import_sheet(request: Request):
    from .story import StoryError
    from .worksheet import parse_workbook
    data = await request.body()
    if not data:
        raise HTTPException(422, "send the .xlsx file as the request body")
    try:
        spec = parse_workbook(data)
    except StoryError as e:
        return JSONResponse({"detail": "the worksheet has a few problems", "errors": e.errors}, status_code=422)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"couldn't read that file as a worksheet ({type(e).__name__})")
    return {"spec": spec}


# --- the phone app ------------------------------------------------------------------------------

from .phone_api import router as _phone_router  # noqa: E402
app.include_router(_phone_router)

# --- frontend ---------------------------------------------------------------------------------

if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def _no_frontend():
        return JSONResponse({"message": "API is running. The built frontend was not found at frontend/dist; run `npm run build` in frontend/."})
