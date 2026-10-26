"""The capability assessments (Phase 7): what a team, a plan or a facility can do, read from the capability records
(capability/records.py, packed by app/capability_pack.py). Pure functions over the pack, so the browser runs the same
rules (web/34_capability.html, held to this file by app/test_capability_parity.mjs).

Two reports that never borrow from each other (spec §3, Test A):
- cartridge readiness: the game's field moves, who knows each and who could learn it, the machine and the badge,
  and what each one costs a battle moveset. Only game mechanics count;
- world readiness against a scenario: every need's standing (covered, with equipment, if taught, plausible, needs
  your approval, gap), who holds it and on what evidence, strengths, weaknesses, failure points, missing equipment,
  preparations and provisions. No overall score.
Then: lock-and-optimise (Recommended / Potential Fits / Everything Else, each with its reasons), a comparison of two
configurations that names the tradeoffs and picks no winner, and facility assessments (requirements, who can staff
each one under D-039, candidates, staff plans compared).

A member is {species, ind (your individual's id, for its world records), moves (a build's four, or None when only
the species is known), ability, label}.
"""
import json

ORDER = ["covered", "equipped", "teachable", "plausible", "proposed", "gap"]
RANK = {s: i for i, s in enumerate(ORDER)}
READY = ("covered", "equipped")
PRIORITIES = ("critical", "important", "useful")
KINDS = {"move": ("A", "mechanic"), "ability": ("A", "mechanic"), "lore": ("B", "inferred"), "type": ("B", "inferred"),
         "size": ("B", "inferred"), "habitat": ("B", "inferred"), "shape": ("B", "inferred"),
         "move_use": ("B", "hypothesis"), "gear": ("C", "creative"), "world": ("B", "creative")}


def cap_name(pack, cap):
    return pack["model"]["capabilities"][cap]["name"]


def records(pack, game, species):
    """The species' records in this game, decoded."""
    rows = pack["games"].get(game, {}).get("records", {}).get(species, [])
    src = pack["sources"]
    out = []
    for cap, kind, s, d, x in (pack["rows"][j] for j in rows):
        r = {"cap": cap, "kind": kind, "source": src[s], "detail": src[d] if d is not None else None}
        if kind == "move":
            r["move"], r["route"] = x[0], x[1]
            if len(x) > 2:
                r["note"] = x[2]
        elif kind == "ability":
            r["ability"] = x
        elif kind == "gear":
            r["rule"], r["equipment"], r["limitations"] = x[0], x[1], x[2]
        elif kind == "shape":
            r["limitations"] = x
        out.append(r)
    return out


def _abilities(pack, game, species):
    gen = str(pack["gen"][game])
    return (pack["abilities"].get(gen) or {}).get(species, [])


def evidence(pack, game, member, kit=(), preview=()):
    """Every record that applies to this member, each with its standing: [(standing, record)] in record order."""
    known = member.get("moves")
    ab = member.get("ability")
    out = []
    recs = records(pack, game, member["species"])
    for r in recs:
        k = r["kind"]
        if k == "move":
            st = "covered" if known is not None and r["move"] in known else "teachable"
        elif k == "ability":
            if ab and ab != r["ability"]:
                continue
            same = {x["ability"] for x in recs if x["kind"] == "ability" and x["cap"] == r["cap"]}
            others = [a for a in _abilities(pack, game, member["species"]) if a not in same]
            if ab or not others:
                st = "covered"
            else:
                st = "plausible"
                r = dict(r, note="if it has " + " or ".join(a for a in _abilities(pack, game, member["species"]) if a in same)
                         + " (it could have " + " or ".join(others) + " instead)")
        elif k == "gear":
            st = "equipped" if r["equipment"] in kit else "proposed"
        else:
            st = "plausible"
        out.append((st, r))
    if known:
        for cap, moves in pack["model"]["move_uses"].items():
            if cap.startswith("_"):
                continue
            for mv in moves:
                if mv in known:
                    out.append(("plausible", {"cap": cap, "kind": "move_use", "move": mv, "source": mv + " (a move it knows)",
                                              "detail": "put to use outside battle: a hypothesis, not a game mechanic"}))
    ind = member.get("ind")
    if ind:
        for w in pack["world"]:
            if w["ind"] == ind:
                if w["status"] == "approved":
                    out.append(("covered", w))
                elif w["id"] in preview:
                    out.append(("covered", dict(w, note="preview: as if you approved it")))
                else:
                    out.append(("proposed", w))
    return out


def best(pack, game, member, kit=(), preview=()):
    """{cap: (standing, record)}: the member's best standing for each capability (the first record at that standing)."""
    out = {}
    for st, r in evidence(pack, game, member, kit, preview):
        cur = out.get(r["cap"])
        if cur is None or RANK[st] < RANK[cur[0]]:
            out[r["cap"]] = (st, r)
    return out


def _holder(member, i, st, r):
    layer, cls = KINDS[r["kind"]]
    h = {"who": member.get("label") or member["species"], "i": i, "standing": st, "kind": r["kind"], "layer": layer,
         "class": cls, "source": r["source"], "detail": r.get("detail")}
    for k in ("move", "route", "ability", "rule", "equipment", "note", "limitations", "id", "status"):
        if r.get(k) is not None:
            h[k] = r[k]
    return h


def _kit_items(pack, kit):
    return [x for x in pack["kit"] if x["id"] in kit]


def need_holders(pack, game, cap, members, kit=(), preview=(), bests=None):
    holders = []
    for i, m in enumerate(members):
        b = (bests[i] if bests else best(pack, game, m, kit, preview)).get(cap)
        if b:
            holders.append(_holder(m, i, b[0], b[1]))
    for x in _kit_items(pack, kit):
        if cap in x["covers"]:
            holders.append({"who": x["name"], "kit": x["id"], "standing": "equipped", "kind": "kit", "layer": "kit",
                            "class": x["class"], "source": x["name"], "detail": x["what"], "limitations": x["limitations"]})
    holders.sort(key=lambda h: (RANK[h["standing"]], h.get("i", 99)))
    return holders


def provisions(pack, members, days):
    p = pack["model"]["provisions"]
    per = p["trainer"] + sum(p["per_day"][pack["facts"].get(m["species"], ["medium"])[0]] for m in members)
    return {"per_day": per, "days": days, "rations": per * days, "water": per * days * p["water_per_ration"]}


def world_report(pack, game, scenario, members, kit=(), preview=()):
    """A team (and its kit) against one scenario: every need's standing and holders, and what follows from them."""
    sc = scenario if isinstance(scenario, dict) else next(s for s in pack["scenarios"] if s["id"] == scenario)
    bests = [best(pack, game, m, kit, preview) for m in members]
    needs = []
    for n in sc["needs"]:
        hs = need_holders(pack, game, n["cap"], members, kit, preview, bests)
        st = hs[0]["standing"] if hs else "gap"
        covered = [h for h in hs if h["standing"] == "covered" and "kit" not in h]
        kit_backup = any("kit" in h for h in hs)
        needs.append({"cap": n["cap"], "name": cap_name(pack, n["cap"]), "priority": n["priority"], "why": n["why"],
                      "standing": st, "holders": hs, "covered_n": len(covered),
                      "single_point": st == "covered" and len(covered) == 1 and not kit_backup})
    counts = {p: {"total": 0, "ready": 0, "teachable": 0, "plausible": 0, "proposed": 0, "gap": 0} for p in PRIORITIES}
    for n in needs:
        c = counts[n["priority"]]
        c["total"] += 1
        c["ready" if n["standing"] in READY else n["standing"]] += 1
    failures = []
    for n in needs:
        if n["priority"] != "critical":
            continue
        if n["standing"] not in READY:
            failures.append({"cap": n["cap"], "why": n["name"] + ": " + ORDER_TEXT[n["standing"]]})
        elif n["single_point"]:
            failures.append({"cap": n["cap"], "why": n["name"] + ": hangs on " + n["holders"][0]["who"] + " alone"})
    strengths = [{"cap": n["cap"], "why": n["name"] + ": " + str(n["covered_n"]) + " members have it"}
                 for n in needs if n["covered_n"] >= 2]
    weaknesses = [{"cap": n["cap"], "priority": n["priority"], "why": n["name"] + ": " + ORDER_TEXT[n["standing"]]}
                  for n in needs if n["standing"] not in READY]
    missing = missing_equipment(pack, game, sc, needs, members, kit, preview)
    return {"scenario": sc["id"], "game": game, "needs": needs, "counts": counts, "failure_points": failures,
            "strengths": strengths, "weaknesses": weaknesses, "missing_equipment": missing,
            "preparations": preparations(pack, game, needs, missing, members),
            "provisions": provisions(pack, members, sc["days"]),
            "foragers": sorted({h["who"] for n in needs if n["cap"] in ("foraging", "food_source", "water_supply")
                                for h in n["holders"] if "kit" not in h and h["standing"] in ("covered", "plausible")})}


ORDER_TEXT = {"covered": "covered", "equipped": "covered by kit", "teachable": "only if a member is taught the move",
              "plausible": "only plausible (biology, not a game mechanic or your call)",
              "proposed": "only a proposal waiting for your approval", "gap": "nobody and nothing covers it"}


def missing_equipment(pack, game, sc, needs, members, kit, preview):
    """Kit the scenario recommends that isn't packed, and kit that would let a member do a need it can't yet."""
    by = {n["cap"]: n for n in needs}
    out = []
    for kid in sc["kit"]:
        if kid in kit:
            continue
        x = next(k for k in pack["kit"] if k["id"] == kid)
        closes = [c for c in x["covers"] if c in by and by[c]["standing"] not in READY]
        out.append({"id": kid, "name": x["name"], "covers": x["covers"], "closes": closes, "why": "recommended for this scenario"})
    for n in needs:
        if n["standing"] in READY:
            continue
        for h in n["holders"]:
            if h["kind"] == "gear" and h["equipment"] not in kit and not any(o["id"] == h["equipment"] for o in out):
                x = next(k for k in pack["kit"] if k["id"] == h["equipment"])
                out.append({"id": x["id"], "name": x["name"], "covers": [], "closes": [n["cap"]],
                            "why": h["who"] + " could then: " + h["source"].split(": ", 1)[1]})
    return out


def preparations(pack, game, needs, missing, members):
    """What to do before leaving, in priority order: teach, pack, approve."""
    field = pack["field"].get(game, {})
    out, seen = [], set()
    for pr in PRIORITIES:
        for n in needs:
            if n["priority"] != pr or n["standing"] in READY:
                continue
            for h in n["holders"]:
                if h["standing"] == "teachable" and h["kind"] == "move":
                    key = ("teach", h["who"], h["move"])
                    if key in seen:
                        continue
                    seen.add(key)
                    f = field.get(h["move"]) or {}
                    bits = [b for b in (f.get("machine"), (f.get("badge") + " to use it") if f.get("badge") else None,
                                        ROUTE_TEXT.get(h.get("route"))) if b]
                    out.append({"kind": "teach", "cap": n["cap"], "priority": pr,
                                "text": "Teach " + h["move"] + " to " + h["who"] + (" (" + "; ".join(bits) + ")" if bits else "")
                                + ": " + n["name"].lower()})
                    break
            for m in missing:
                if n["cap"] in m["closes"] and ("pack", m["id"]) not in seen:
                    seen.add(("pack", m["id"]))
                    out.append({"kind": "pack", "cap": n["cap"], "priority": pr,
                                "text": "Pack " + m["name"] + ": " + n["name"].lower() + (" (" + m["why"] + ")" if m["why"] != "recommended for this scenario" else "")})
            for h in n["holders"]:
                if h["kind"] == "world" and h["standing"] == "proposed" and ("approve", h["id"]) not in seen:
                    seen.add(("approve", h["id"]))
                    out.append({"kind": "approve", "cap": n["cap"], "priority": pr,
                                "text": "Approve " + h["id"] + " (" + h["who"] + ": " + n["name"].lower() + ") in Your calls"})
    return out


ROUTE_TEXT = {"trade": "by trade from the other version", "transfer": "only from an earlier generation",
              "exception": "your approved exception"}


# --- cartridge readiness ---------------------------------------------------------------------------------------
def battle_worthy(pack, game, move):
    pol = pack["model"]["field_policy"]
    bp = (pack["move_bp"].get(str(pack["gen"][game])) or {}).get(move, 0)
    return move in pol["battle_worthy"] or bp >= pol["battle_worthy_bp"]


def cartridge_report(pack, game, members, moves=None):
    """The game's field moves against a team: who knows each, who could learn it, the machine, the badge, what it
    costs a battle moveset, and the field-function policy (D-018). Game mechanics only."""
    all_moves = pack["field_moves"][game]
    want = [m for m in (moves if moves is not None else all_moves) if m in all_moves]
    field = pack["field"].get(game, {})
    can = []
    for m in members:
        can.append({r["move"]: r["route"] for r in records(pack, game, m["species"]) if r["kind"] == "move"})
    def standing(mv):
        knows = [i for i, m in enumerate(members) if m.get("moves") is not None and mv in m["moves"]]
        could = [{"i": i, "route": can[i][mv]} for i, m in enumerate(members) if i not in knows and mv in can[i]]
        return ("covered" if knows else "teachable" if could else "gap"), knows, could

    rows = []
    for mv in want:
        st, knows, could = standing(mv)
        f = field.get(mv) or {}
        rows.append({"move": mv, "standing": st, "knows": knows, "could": could, "machine": f.get("machine"),
                     "badge": f.get("badge"), "requires": f.get("requires"), "does": f.get("does") or pack["field_does"].get(mv),
                     "battle_worthy": battle_worthy(pack, game, mv),
                     "candidates": candidates(pack, game, mv, members) if st == "gap" else []})
    slots = []
    for i, m in enumerate(members):
        if m.get("moves") is None:
            slots.append({"i": i, "known": None, "costs": [], "hm_slave": False})
            continue
        known = [mv for mv in m["moves"] if mv in all_moves]
        costs = [mv for mv in known if not battle_worthy(pack, game, mv)]
        slots.append({"i": i, "known": known, "costs": costs, "hm_slave": len(costs) >= 2})
    pol = pack["model"]["field_policy"]
    policy = []
    for mv in pol["minimum"]:
        if mv not in all_moves:
            continue
        policy.append({"move": mv, "standing": standing(mv)[0], "exception": pol["exceptions"].get(game, {}).get(mv)})
    return {"game": game, "moves": rows, "slots": slots, "policy": policy,
            "missing": [r["move"] for r in rows if r["standing"] == "gap"],
            "teachable": [r["move"] for r in rows if r["standing"] == "teachable"]}


def candidates(pack, game, move, members, limit=6):
    """Species outside the team that learn the move natively in this game, the ones learning the most of the game's
    field moves first (so one Pokémon can cover several). Legendary and mythical Pokémon aren't suggested."""
    have = {m["species"] for m in members}
    out = []
    for sp, rows in pack["games"][game]["records"].items():
        if sp in have or pack["facts"][sp][4]:
            continue
        learn = [x[4][0] for x in (pack["rows"][j] for j in rows) if x[1] == "move" and x[4][1] == "native"]
        if move in learn:
            out.append((-len(set(learn)), sp))
    out.sort()
    return [sp for _, sp in out[:limit]]


# --- lock-and-optimise, compare -----------------------------------------------------------------------------------
def recommend(pack, game, scenario, members, kit=(), preview=(), pool=()):
    """For the next open place on the team: every candidate in the pool, sorted into Recommended (it makes a critical
    need ready, or an important one when nothing critical is open), Potential Fits (it improves something, but only
    to 'if taught', 'plausible' or 'needs approval', or only useful needs) and Everything Else, each with its reasons."""
    base = world_report(pack, game, scenario, members, kit, preview)
    crit_open = any(n["priority"] == "critical" and n["standing"] not in READY for n in base["needs"])
    taken = {(m["species"], m.get("ind")) for m in members}
    out = {"recommended": [], "potential": [], "rest": []}
    for c in pool:
        if (c["species"], c.get("ind")) in taken:
            continue
        rep = world_report(pack, game, scenario, list(members) + [c], kit, preview)
        better = []
        for a, b in zip(base["needs"], rep["needs"]):
            if RANK[b["standing"]] < RANK[a["standing"]]:
                via = next((h for h in b["holders"] if h.get("i") == len(members)), None)
                better.append({"cap": a["cap"], "name": a["name"], "priority": a["priority"], "from": a["standing"],
                               "to": b["standing"], "via": via["source"] if via else None})
        ready = [x for x in better if x["to"] in READY]
        crit = [x for x in ready if x["priority"] == "critical"]
        imp = [x for x in ready if x["priority"] == "important"]
        extra = rep["provisions"]["per_day"] - base["provisions"]["per_day"]
        item = {"label": c.get("label") or c["species"], "species": c["species"], "ind": c.get("ind"), "better": better,
                "critical": len(crit), "important": len(imp), "rations": extra,
                "why": [x["name"] + ": " + x["from"] + " → " + x["to"] + (" (" + x["via"] + ")" if x["via"] else "") for x in better]}
        if crit or (not crit_open and imp):
            out["recommended"].append(item)
        elif better:
            out["potential"].append(item)
        else:
            out["rest"].append(item)
    key = lambda x: (-x["critical"], -x["important"], -len(x["better"]), x["rations"], x["label"])
    for k in out:
        out[k].sort(key=key)
    return out


def compare(pack, game, scenario, a, b):
    """Two configurations ({members, kit, label}) against one scenario: need by need, what each covers that the other
    doesn't, the field moves, and what each costs to feed. No winner is picked."""
    ra = world_report(pack, game, scenario, a["members"], a.get("kit", ()), a.get("preview", ()))
    rb = world_report(pack, game, scenario, b["members"], b.get("kit", ()), b.get("preview", ()))
    sc = next(s for s in pack["scenarios"] if s["id"] == (scenario if isinstance(scenario, str) else scenario["id"]))
    ca = cartridge_report(pack, game, a["members"], sc["field_moves"])
    cb = cartridge_report(pack, game, b["members"], sc["field_moves"])
    rows, a_only, b_only = [], [], []
    for x, y in zip(ra["needs"], rb["needs"]):
        side = "a" if RANK[x["standing"]] < RANK[y["standing"]] else "b" if RANK[y["standing"]] < RANK[x["standing"]] else None
        rows.append({"cap": x["cap"], "name": x["name"], "priority": x["priority"], "a": x["standing"], "b": y["standing"], "better": side,
                     "a_n": x["covered_n"], "b_n": y["covered_n"]})
        if side == "a":
            a_only.append(x["name"].lower() + " (" + x["standing"] + " vs " + y["standing"] + ")")
        if side == "b":
            b_only.append(y["name"].lower() + " (" + y["standing"] + " vs " + x["standing"] + ")")
    la, lb = a.get("label") or "A", b.get("label") or "B"
    says = []
    if a_only:
        says.append(la + " is stronger on " + ", ".join(a_only) + ".")
    if b_only:
        says.append(lb + " is stronger on " + ", ".join(b_only) + ".")
    if not a_only and not b_only:
        says.append("They meet this scenario's needs equally; the difference is elsewhere.")
    pa, pb = ra["provisions"]["per_day"], rb["provisions"]["per_day"]
    if pa != pb:
        says.append((la if pa > pb else lb) + " needs more food: " + str(max(pa, pb)) + " rations a day against " + str(min(pa, pb)) + ".")
    fa = sum(1 for r in ca["moves"] if r["standing"] == "covered")
    fb = sum(1 for r in cb["moves"] if r["standing"] == "covered")
    if fa != fb:
        says.append((la if fa > fb else lb) + " knows more of the field moves this ground calls for (" + str(max(fa, fb)) + " against " + str(min(fa, fb)) + ").")
    sa = sum(len(s["costs"]) for s in ca["slots"])
    sb = sum(len(s["costs"]) for s in cb["slots"])
    if sa != sb:
        says.append((la if sa > sb else lb) + " gives up more battle slots to field moves (" + str(max(sa, sb)) + " against " + str(min(sa, sb)) + ").")
    return {"rows": rows, "a": ra, "b": rb, "a_cart": ca, "b_cart": cb, "says": says}


# --- facilities ------------------------------------------------------------------------------------------------
def facility_report(pack, facility, staff=(), pool=(), preview=(), game=None):
    """A facility's requirements against a staff plan ([{member…, need}] where need is a requirement id or None for
    any) and the candidates in the pool. Under D-039 a Pokémon can staff a job only on a game mechanic it has or a
    record you approved ('covered'); everything else is a candidate."""
    fac = facility if isinstance(facility, dict) else next(f for f in pack["facilities"] if f["id"] == facility)
    game = game or pack["present_game"]
    cache = {}

    def b(m):
        k = (m["species"], m.get("ind"), tuple(m.get("moves") or ()) if m.get("moves") is not None else None, m.get("ability"))
        if k not in cache:
            cache[k] = best(pack, game, m, (), preview)
        return cache[k]

    reqs = []
    for rq in fac["requirements"]:
        def standing_of(m):
            hits = [(b(m)[c][0], b(m)[c][1]) for c in rq["any"] if c in b(m)]
            hits.sort(key=lambda x: RANK[x[0]])
            return hits[0] if hits else None
        assigned = []
        for j, s in enumerate(staff):
            if s.get("need") not in (None, rq["id"]):
                continue
            h = standing_of(s)
            if h:
                assigned.append(_holder(s, j, h[0], h[1]))
        assigned.sort(key=lambda h: (RANK[h["standing"]], h["i"]))
        st = assigned[0]["standing"] if assigned else "gap"
        land = [{"who": x["name"], "standing": "equipped", "kind": "land", "layer": "land", "class": "creative", "source": x["name"],
                 "detail": x.get("note") or None} for x in rq["infrastructure"] if x.get("land")]   # what the land itself gives (A-112)
        if land and RANK["equipped"] < RANK[st]:
            st = "equipped"
        cands = []
        for i, m in enumerate(pool):
            h = standing_of(m)
            if h:
                x = _holder(m, i, h[0], h[1])
                x["can_staff"] = h[0] == "covered"
                cands.append(x)
        cands.sort(key=lambda h: (RANK[h["standing"]], h["who"]))
        n_cov = len([h for h in assigned if h["standing"] == "covered"])
        can_staff = [c["who"] for c in cands if c["can_staff"]]
        reqs.append({"id": rq["id"], "name": rq["name"], "group": rq["group"], "priority": rq["priority"], "any": rq["any"],
                     "why": rq["why"], "infrastructure": rq["infrastructure"], "standing": st, "staff": assigned,
                     "covered_n": n_cov, "single_point": n_cov == 1 and not land, "candidates": cands, "can_staff": can_staff, "land": land,
                     "hires": hires(pack, game, rq["any"], {m["species"] for m in pool}) if not can_staff and not land else []})
    groups = []
    for rq in reqs:
        if rq["group"] not in groups:
            groups.append(rq["group"])
    return {"facility": fac["id"], "name": fac["name"], "status": fac["status"], "game": game, "requirements": reqs, "groups": groups,
            "staffed": [r["id"] for r in reqs if r["standing"] == "covered"],
            "met": [r["id"] for r in reqs if r["standing"] in READY],
            "open": [r["id"] for r in reqs if r["standing"] not in READY],
            "open_critical": [r["id"] for r in reqs if r["standing"] not in READY and r["priority"] == "critical"],
            "single_points": [r["id"] for r in reqs if r["single_point"]],
            "nobody": [r["id"] for r in reqs if not r["can_staff"] and not r["land"]]}


def hires(pack, game, caps, have, limit=6):
    """Species you don't have that could staff a job on a game mechanic alone (an overworld ability every one of them
    has), the way ranch/planner.py suggests hires; legendary and mythical Pokémon left out."""
    out = []
    for sp in pack["games"][game]["records"]:
        if sp in have or pack["facts"][sp][4]:
            continue
        b = best(pack, game, {"species": sp})
        hit = [b[c][1] for c in caps if c in b and b[c][0] == "covered"]
        if hit:
            out.append({"species": sp, "source": hit[0]["source"]})
    out.sort(key=lambda x: x["species"])
    return out[:limit]


def compare_staff(pack, facility, a, b, preview=()):
    """Two staff plans for one facility, requirement by requirement; the tradeoffs named, no winner picked."""
    ra = facility_report(pack, facility, a["staff"], (), preview)
    rb = facility_report(pack, facility, b["staff"], (), preview)
    la, lb = a.get("label") or "A", b.get("label") or "B"
    rows, says = [], []
    for x, y in zip(ra["requirements"], rb["requirements"]):
        side = "a" if RANK[x["standing"]] < RANK[y["standing"]] else "b" if RANK[y["standing"]] < RANK[x["standing"]] else None
        rows.append({"id": x["id"], "name": x["name"], "a": x["standing"], "b": y["standing"], "better": side,
                     "a_n": x["covered_n"], "b_n": y["covered_n"]})
    for side, lab in (("a", la), ("b", lb)):
        wins = [r["name"].lower() for r in rows if r["better"] == side]
        if wins:
            says.append(lab + " covers " + ", ".join(wins) + " that the other doesn't.")
    red_a = sum(1 for r in rows if r["a_n"] >= 2)
    red_b = sum(1 for r in rows if r["b_n"] >= 2)
    if red_a != red_b:
        says.append((la if red_a > red_b else lb) + " has more backup: " + str(max(red_a, red_b)) + " jobs held by two or more, against " + str(min(red_a, red_b)) + ".")
    if len(a["staff"]) != len(b["staff"]):
        says.append((la if len(a["staff"]) > len(b["staff"]) else lb) + " uses more Pokémon (" + str(max(len(a["staff"]), len(b["staff"]))) + " against " + str(min(len(a["staff"]), len(b["staff"]))) + ").")
    if not says:
        says.append("They staff this facility the same way.")
    return {"rows": rows, "a": ra, "b": rb, "says": says}


def load_pack(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


__all__ = ["records", "evidence", "best", "world_report", "cartridge_report", "recommend", "compare", "facility_report",
           "compare_staff", "provisions", "ORDER", "RANK"]
