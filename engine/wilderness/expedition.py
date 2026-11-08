"""The Wild (v2.7, docs/WILD.md): expeditions from Blackthorn to the real places of Johto and Kanto, and the estate's
year. Pure functions over two packs: the wild pack (app/data/wild.json: the rules, the places with their terrain evidence
and wild Pokémon, the map's links) and the capability pack (app/data/capability.json, read by capability/assess.py,
which does all the assessing). The browser runs the same code (app/web/41_wild.html; app/test_wild_parity.mjs).

- profile(place): what the place calls for and why, from its biome and elevation (inferred), the game's own encounter
  methods there (mechanic) and three needs every night out has; the field moves its ground calls for; its wild Pokémon
  by morning, day and night; its weather by season (creative);
- route(place, team): the way from Blackthorn over the games' own map, on foot or flown to the nearest town;
- plan(place, team, kit, season, days, residents): the place's needs as a scenario for the capability engine's world
  report, the cartridge check for the field moves, provisions, the weather and wildlife, and who'd be missed at home;
- simulate(plan, seed) and odds(plan, runs): the optional seeded run, a day-by-day field journal (spec §9's optional
  simulation; a planning aid, never canon);
- season_card, stores, day: the estate's year, its weekly stores and a day at Blackthorn.

    python3 -I engine/wilderness/expedition.py <place> [days] [season]     # a sample plan and run with a sample team
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

from capability import assess  # noqa: E402

PRI = {"critical": 0, "important": 1, "useful": 2}
READY = ("covered", "equipped")
SOFT = ("teachable", "plausible", "proposed")


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# --- the seeded generator: mulberry32, the same 32-bit steps as the browser's ------------------------------------
def imul(a, b):
    return (a * b) & 0xFFFFFFFF


class Rng:
    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFF

    def next(self):
        self.s = (self.s + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.s
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    def pick(self, weighted):
        """[(item, weight)] -> item; weights > 0, in the order given."""
        total = 0.0
        for _, w in weighted:
            total += w
        r = self.next() * total
        acc = 0.0
        for item, w in weighted:
            acc += w
            if r < acc:
                return item
        return weighted[-1][0]


# --- seasons and weather -----------------------------------------------------------------------------------------
def season_of(rules, month):
    for s in rules["seasons"]["order"]:
        if month in rules["seasons"]["months"][s]:
            return s
    return rules["seasons"]["order"][0]


def sheltered(rules, place):
    sh = rules["climate"]["sheltered"]
    return bool(place["biome"]) and all(b in sh for b in place["biome"])


def weather_weights(rules, place, season):
    """[(kind, weight)] in the climate's own kind order; [('sheltered', 1)] for a place that is all cave or indoors."""
    C = rules["climate"]
    if sheltered(rules, place):
        return [("sheltered", 1)]
    w = dict(C["elevation"][place.get("elevation") or "low"][season])
    for b in place["biome"]:
        for k, v in (C["biome_adds"].get(b) or {}).items():
            w[k] = w.get(k, 0) + v
    return [(k, w[k]) for k in C["kinds"] if w.get(k)]


def weather_shares(rules, place, season):
    ws = weather_weights(rules, place, season)
    tot = sum(v for _, v in ws)
    return [{"kind": k, "name": rules["climate"]["kinds"][k]["name"], "share": round(v / tot, 4)} for k, v in ws]


# --- a place -----------------------------------------------------------------------------------------------------
def _merge(needs, add):
    """Keep one need per capability: the highest priority, its reason first, every source."""
    for n in add:
        old = next((x for x in needs if x["cap"] == n["cap"]), None)
        if old is None:
            needs.append(dict(n, sources=[n["source"]]))
            continue
        if n["source"] not in old["sources"]:
            old["sources"].append(n["source"])
        if PRI[n["priority"]] < PRI[old["priority"]]:
            old["priority"], old["why"] = n["priority"], n["why"]
    return needs


def enc_game(rules, game):
    """The encounter tables an expedition reads: the game's own in HeartGold and SoulSilver, HeartGold's for a team
    from another game (the places are Johto's and Kanto's as HeartGold has them)."""
    return game if game in rules["games"] else rules["game"]


def profile(wild, pid, game=None):
    R = wild["rules"]
    game = enc_game(R, game or R["game"])
    p = wild["places"][pid]
    T = R["terrain"]
    needs = []
    _merge(needs, [{"cap": c, "priority": pr, "why": why, "source": "always", "class": "creative"} for c, pr, why in T["always"]])
    for b in p["biome"]:
        _merge(needs, [{"cap": c, "priority": pr, "why": why, "source": "biome:" + b, "class": "inferred"} for c, pr, why in T["biome"].get(b, [])])
    _merge(needs, [{"cap": c, "priority": pr, "why": why, "source": "elevation:" + p["elevation"], "class": "inferred"}
                   for c, pr, why in T["elevation"].get(p["elevation"], [])])
    moves, kit = [], []
    for m in p["methods"]:
        rule = T["methods"].get(m)
        if not rule:
            continue
        _merge(needs, [{"cap": rule["cap"], "priority": rule["priority"], "why": rule["why"], "source": "method:" + m, "class": "mechanic"}])
        if rule.get("field_move") and rule["field_move"] not in [x["move"] for x in moves]:
            moves.append({"move": rule["field_move"], "why": rule["why"], "method": m})
        if rule.get("kit") and rule["kit"] not in kit:
            kit.append(rule["kit"])
    needs.sort(key=lambda n: PRI[n["priority"]])
    return {"id": pid, "name": p["name"], "region": p["region"], "biome": p["biome"], "elevation": p["elevation"], "water": p["water"],
            "note": p.get("note"), "xy": p.get("xy"), "areas": p["areas"], "methods": p["methods"], "sheltered": sheltered(R, p),
            "needs": needs, "field_moves": moves, "kit": kit, "wildlife": p["enc"].get(game) or {w: [] for w in R["windows"]["order"]},
            "weather": {s: weather_shares(R, p, s) for s in R["seasons"]["order"]}}


# --- the way there -----------------------------------------------------------------------------------------------
def adjacency(wild):
    adj = {}
    for a, b, kind in wild["edges"]:
        adj.setdefault(a, []).append((b, kind))
        adj.setdefault(b, []).append((a, kind))
    for k in adj:
        adj[k].sort(key=lambda x: (x[0], x[1]))
    return adj


def shortest(wild, start, goal):
    """Breadth-first over the map's links, neighbours in id order: [(node, kind of the link into it)]."""
    adj = adjacency(wild)
    prev = {start: None}
    queue = [start]
    i = 0
    while i < len(queue):
        n = queue[i]
        i += 1
        if n == goal:
            break
        for m, kind in adj.get(n, []):
            if m not in prev:
                prev[m] = (n, kind)
                queue.append(m)
    if goal not in prev:
        return None
    out = []
    n = goal
    while prev[n] is not None:
        out.append((n, prev[n][1]))
        n = prev[n][0]
    out.append((start, None))
    out.reverse()
    return out


def team_standing(cap_pack, game, cap, members, kit):
    hs = assess.need_holders(cap_pack, game, cap, members, list(kit))
    return (hs[0]["standing"], hs[0]) if hs else ("gap", None)


def route(wild, cap_pack, game, pid, members, kit=()):
    R = wild["rules"]
    T = R["terrain"]["route"]
    home = R["home"]
    walk = shortest(wild, home, pid)
    by, fly_to, path = "foot", None, walk
    st, holder = team_standing(cap_pack, game, T["fly"]["cap"], members, kit)
    if st in READY and pid != home and walk:
        towns = [n for n, p in sorted(wild["places"].items()) if T["fly"]["towns"] in p["biome"]]
        best = None
        for t in towns:
            sp = shortest(wild, t, pid)
            if sp is not None and (best is None or len(sp) < len(best[1])):
                best = (t, sp)
        if best and len(best[1]) < len(walk):
            by, fly_to, path = "air", best[0], best[1]
    if path is None:
        return {"by": None, "path": [], "legs": [], "days": None, "needs": [], "fly_to": None, "flyer": None}
    legs = [[path[i - 1][0], path[i][0], path[i][1]] for i in range(1, len(path))]
    needs = []
    for a, b, kind in legs:
        if kind in ("sea", "cave"):
            c, pr, why = T[kind]
            _merge(needs, [{"cap": c, "priority": pr, "why": why, "source": "route:" + kind, "class": "mechanic"}])
    days = int(math.ceil(len(legs) / T["legs_per_day"])) if legs else 0
    return {"by": by, "path": [n for n, _ in path], "legs": legs, "days": days, "needs": needs, "fly_to": fly_to,
            "flyer": (holder or {}).get("who") if by == "air" else None}


# --- who'd be missed at home ---------------------------------------------------------------------------------------
def _same(a, b):
    if a.get("ind") and b.get("ind"):
        return a["ind"] == b["ind"]
    return (a.get("label") or a["species"]) == (b.get("label") or b["species"])


def home_cover(cap_pack, game, away, residents):
    """Every facility job that someone on the expedition can staff and nobody left at home can (and the land doesn't meet)."""
    left = [r for r in residents if not any(_same(r, a) for a in away)]
    out = []
    for fac in cap_pack["facilities"]:
        before = assess.facility_report(cap_pack, fac, (), residents, (), game)
        after = assess.facility_report(cap_pack, fac, (), left, (), game)
        for rb, ra in zip(before["requirements"], after["requirements"]):
            if rb["can_staff"] and not ra["can_staff"] and not ra["land"]:
                out.append({"facility": fac["id"], "facility_name": fac["name"], "requirement": rb["id"], "name": rb["name"],
                            "priority": rb["priority"], "who": rb["can_staff"]})
    out.sort(key=lambda x: (PRI[x["priority"]], x["facility"], x["requirement"]))
    return out


# --- the plan ----------------------------------------------------------------------------------------------------
def plan(wild, cap_pack, game, pid, members, kit=(), season=None, days=3, residents=None):
    R = wild["rules"]
    season = season or R["seasons"]["order"][0]
    days = max(1, min(int(days), R["sim"]["max_days"]))
    prof = profile(wild, pid, game)
    rt = route(wild, cap_pack, game, pid, members, kit)
    needs = [dict(n) for n in prof["needs"]]
    for n in needs:
        n["sources"] = list(n["sources"])
    _merge(needs, rt["needs"])
    needs.sort(key=lambda n: PRI[n["priority"]])
    total = days + 2 * (rt["days"] or 0)
    scenario = {"id": "wild:" + pid, "name": "Expedition to " + prof["name"], "days": total, "needs": needs,
                "kit": prof["kit"], "field_moves": [m["move"] for m in prof["field_moves"]]}
    readiness = assess.world_report(cap_pack, game, scenario, members, list(kit))
    cart = assess.cartridge_report(cap_pack, game, members, scenario["field_moves"]) if scenario["field_moves"] else None
    return {"version": R["version"], "place": prof, "route": rt, "season": season, "days": days, "total_days": total,
            "kit": list(kit), "members": [m.get("label") or m["species"] for m in members], "scenario": scenario,
            "readiness": readiness, "cartridge": cart, "provisions": assess.provisions(cap_pack, members, total),
            "weather": prof["weather"][season],
            "home": home_cover(cap_pack, game, members, residents) if residents is not None else None}


# --- the optional run ----------------------------------------------------------------------------------------------
def _how(h):
    if not h:
        return ""
    if h.get("kit"):
        return "the " + h["who"]
    for k in ("move", "ability", "equipment"):
        if h.get(k):
            return h[k]
    return h.get("source") or ""


def _forage(rules, place, kit):
    if any(b in ("forest", "woodland-edge", "grassland", "pasture", "coast", "lake") for b in place["biome"]):
        return True
    return "rod" in kit and any(m in ("old-rod", "good-rod", "super-rod") for m in place["methods"])


def simulate(wild, cap_pack, game, pl, members, seed):
    R = wild["rules"]
    S = R["sim"]
    rng = Rng(seed)
    kit = pl["kit"]
    windows = R["windows"]["order"]
    hz_caps = []
    for hz in R["hazards"]["list"]:
        for c in hz["needs"]:
            if c not in hz_caps:
                hz_caps.append(c)
    for c in ("water_travel", "foraging"):
        if c not in hz_caps:
            hz_caps.append(c)
    stand = {c: team_standing(cap_pack, game, c, members, kit) for c in hz_caps}
    names = {c: cap_pack["model"]["capabilities"][c]["name"] for c in hz_caps}
    rt = pl["route"]
    path = rt["path"] or [pl["place"]["id"]]
    out_days = rt["days"] or 0
    site_days = pl["days"]
    per_day = pl["provisions"]["per_day"]
    food = per_day * (pl["total_days"] + S["reserve_days"])
    can_swim = stand["water_travel"][0] in READY
    can_forage = stand["foraging"][0] in READY
    lpd = R["terrain"]["route"]["legs_per_day"]
    setbacks = strains = 0
    seen = {}
    log = []
    causes = {}
    outcome, ended = "completed", None
    for d in range(1, out_days + site_days + 1):
        if d <= out_days:
            phase = "out"
            node = path[min(d * lpd, len(path) - 1)]
        else:
            phase = "site"
            node = pl["place"]["id"]
        place = wild["places"][node]
        ws = weather_weights(R, place, pl["season"])
        weather = "sheltered" if ws[0][0] == "sheltered" else rng.pick(ws)
        events = []
        for hz in R["hazards"]["list"]:
            when = hz["when"]
            if "weather" in when and weather not in when["weather"]:
                continue
            if "biome" in when and not any(b in when["biome"] for b in place["biome"]):
                continue
            sts = [stand[c] for c in hz["needs"]]
            worst = max(sts, key=lambda x: assess.RANK[x[0]])[0]
            parts = [names[c] + ": " + (h["who"] + (" (" + _how(h) + ")" if _how(h) and not h.get("kit") else "") if h else "nobody")
                     for c, (s, h) in zip(hz["needs"], sts)]
            if worst in READY:
                res = "handled"
                text = hz["says"] + "; handled. " + "; ".join(parts)
            elif worst in SOFT:
                res = "strained"
                strains += 1
                text = hz["says"] + "; hard going. " + "; ".join(parts)
            else:
                res = "setback"
                setbacks += 1
                causes[hz["id"]] = causes.get(hz["id"], 0) + 1
                gaps = [names[c] for c, (s, h) in zip(hz["needs"], sts) if s == "gap"]
                text = hz["says"] + "; a setback: nobody for " + ", ".join(gaps)
            events.append({"kind": "hazard", "hazard": hz["id"], "name": hz["name"], "result": res, "text": text})
        enc = place["enc"].get(enc_game(R, game)) or {}
        for w in windows:
            land = [x for x in enc.get(w, []) if x[4] == "walk"]
            water = [x for x in enc.get(w, []) if x[4] == "surf"] if can_swim else []
            if land and water:
                rows = land if rng.pick([("walk", S["water_weights"]["walk"]), ("surf", S["water_weights"]["surf"])]) == "walk" else water
            else:
                rows = land or water
            if not rows:
                continue
            r = rng.pick([(x, x[1]) for x in rows])
            lv = r[2] if r[2] == r[3] else r[2] + int(rng.next() * (r[3] - r[2] + 1))
            seen[r[0]] = seen.get(r[0], 0) + 1
            events.append({"kind": "wild", "window": w, "species": r[0], "level": lv, "method": r[4],
                           "text": R["windows"]["names"][w] + ": " + ("a wild " + r[0] + " (level " + str(lv) + ")" +
                                                                       (" on the water" if r[4] == "surf" else ""))})
        food -= per_day
        gained = 0
        if can_forage and _forage(R, place, kit):
            gained = int(math.floor(S["forage_share"] * per_day))
            food += gained
        log.append({"day": d, "phase": phase, "node": node, "where": place["name"], "weather": weather,
                    "weather_name": R["climate"]["kinds"][weather]["name"], "events": events, "food": food, "foraged": gained})
        if food < 0:
            outcome, ended = "turned back", {"day": d, "why": "the food ran out"}
            break
        if setbacks >= S["setbacks_to_turn_back"]:
            outcome, ended = "turned back", {"day": d, "why": str(setbacks) + " setbacks"}
            break
    site_done = sum(1 for x in log if x["phase"] == "site")
    return {"seed": seed, "outcome": outcome, "ended": ended, "days": log, "site_days_done": site_done, "site_days": site_days,
            "setbacks": setbacks, "strains": strains, "causes": causes,
            "seen": sorted(([k, v] for k, v in seen.items()), key=lambda x: (-x[1], x[0])), "food_left": food}


def odds(wild, cap_pack, game, pl, members, runs=None):
    R = wild["rules"]
    runs = runs or R["sim"]["runs"]
    done = 0
    setbacks = strains = 0
    causes, seen = {}, {}
    site = 0
    for seed in range(1, runs + 1):
        s = simulate(wild, cap_pack, game, pl, members, seed)
        done += s["outcome"] == "completed"
        setbacks += s["setbacks"]
        strains += s["strains"]
        site += s["site_days_done"]
        for k, v in s["causes"].items():
            causes[k] = causes.get(k, 0) + v
        for sp, n in s["seen"]:
            seen[sp] = seen.get(sp, 0) + n
    hz = {h["id"]: h["name"] for h in R["hazards"]["list"]}
    return {"runs": runs, "completed": done, "setbacks": round(setbacks / runs, 2), "strains": round(strains / runs, 2),
            "site_days": round(site / runs, 2),
            "causes": [{"hazard": k, "name": hz[k], "setbacks": v} for k, v in sorted(causes.items(), key=lambda x: (-x[1], x[0]))],
            "seen": [[k, v] for k, v in sorted(seen.items(), key=lambda x: (-x[1], x[0]))][:12]}


# --- the estate's year -----------------------------------------------------------------------------------------
def season_card(wild, season, residents):
    """The highlands this season: Blackthorn's weather and how each resident fares outdoors (residents carry their
    habitat climate: warm, cold or any)."""
    R = wild["rules"]
    E = R["estate"]
    home = wild["places"][R["home"]]
    out = []
    for r in residents:
        f = E["outdoor"][r.get("climate") or "any"][season]
        out.append({"who": r.get("label") or r["species"], "species": r["species"], "climate": r.get("climate") or "any", "outdoor": f,
                    "says": E["outdoor_says"][f]})
    return {"season": season, "name": R["seasons"]["names"][season], "weather": weather_shares(R, home, season), "residents": out,
            "indoors": [x["who"] for x in out if x["outdoor"] == "indoors"], "thrives": [x["who"] for x in out if x["outdoor"] == "thrives"]}


def stores(wild, cap_pack, crops, residents, plots=None):
    """A week of the Glasshouse against a week of rations: each crop's harvests in a week of continuous growing (Gen IV
    growth hours) times its best harvest times its plots, against the residents' rations by body size."""
    E = wild["rules"]["estate"]
    plots = E["plots_per_crop"] if plots is None else plots
    week = E["glasshouse_hours_per_week"]
    rows = []
    made = 0
    for c in crops:
        per = week // c["hours_to_harvest"] if c["hours_to_harvest"] else 0
        n = per * c["max_harvest"] * plots
        made += n * E["berry_rations"]
        rows.append({"berry": c["berry"], "hours": c["hours_to_harvest"], "harvests": per, "max_harvest": c["max_harvest"], "plots": plots,
                     "berries": n, "why": c.get("why")})
    P = cap_pack["model"]["provisions"]
    eat = []
    need = 0
    for r in residents:
        size = cap_pack["facts"].get(r["species"], ["medium"])[0]
        n = P["per_day"][size] * 7
        need += n
        eat.append({"who": r.get("label") or r["species"], "species": r["species"], "size": size, "rations": n})
    return {"plots": plots, "crops": rows, "made": made, "eat": eat, "need": need, "balance": made - need}


def day(wild, residents, jobs):
    """A day at Blackthorn: per window, who is about and what it does. jobs: {who: [job names]} from the facility
    reports. A resident is most active in the windows its species appears in the wild in HeartGold and SoulSilver."""
    R = wild["rules"]
    out = {w: [] for w in R["windows"]["order"]}
    for r in residents:
        who = r.get("label") or r["species"]
        act = wild["activity"].get(r["species"]) or wild["activity"].get(r.get("line") or "")
        basis = "wild" if wild["activity"].get(r["species"]) else ("line" if act else None)
        act = act or R["windows"]["order"]
        for w in R["windows"]["order"]:
            out[w].append({"who": who, "species": r["species"], "active": w in act, "basis": basis, "jobs": jobs.get(who, []),
                           "land": r.get("land")})
    return {"windows": R["windows"]["order"], "names": R["windows"]["names"], "hours": R["windows"]["hours"], "by": out}


# --- a sample ------------------------------------------------------------------------------------------------------
def sample(pid="ice-path", days=3, season="winter"):
    wild = load(os.path.join(ENGINE, "app", "data", "wild.json"))
    cap = load(os.path.join(ENGINE, "app", "data", "capability.json"))
    team = [{"species": "Typhlosion", "moves": ["Flamethrower", "Strength", "Rock Smash", "Cut"], "ability": "Blaze", "label": "Typhlosion"},
            {"species": "Lapras", "moves": ["Surf", "Ice Beam", "Waterfall", "Whirlpool"], "ability": "Water Absorb", "label": "Lapras"},
            {"species": "Ampharos", "moves": ["Thunderbolt", "Flash", "Signal Beam", "Light Screen"], "ability": "Static", "label": "Ampharos"},
            {"species": "Pidgeot", "moves": ["Fly", "Return", "Roost", "U-turn"], "ability": "Keen Eye", "label": "Pidgeot"}]
    pl = plan(wild, cap, "heartgold", pid, team, ["tent", "rations"], season, days, residents=team)
    return wild, cap, team, pl


def parity(out_path):
    """Python's side of app/test_wild_parity.mjs: every place's profile, plans, runs and odds for a spread of places,
    teams and seasons, and the estate's year on a sample household."""
    wild = load(os.path.join(ENGINE, "app", "data", "wild.json"))
    cap = load(os.path.join(ENGINE, "app", "data", "capability.json"))
    _, _, team, _ = sample()
    team2 = [{"species": "Mamoswine", "moves": ["Earthquake", "Ice Shard", "Strength", "Rock Smash"], "ability": "Oblivious", "label": "Mamoswine"},
             {"species": "Meganium", "moves": ["Leaf Storm", "Synthesis", "Sunny Day", "Cut"], "ability": "Overgrow", "label": "Meganium"},
             {"species": "Miltank", "moves": ["Milk Drink", "Body Slam", "Heal Bell", "Rollout"], "ability": "Thick Fat", "label": "Miltank"},
             {"species": "Magcargo", "species_note": "", "moves": ["Flamethrower", "Rock Slide", "Recover", "Rock Smash"], "ability": "Flame Body", "label": "Magcargo"}]
    residents = team + team2
    cases = [("ice-path", team, ["tent", "rations"], "winter", 3), ("whirl-islands", team, [], "summer", 2), ("mt-silver", team, ["tent", "cold-gear"], "winter", 4),
             ("ilex-forest", team2, ["rod"], "autumn", 3), ("dragons-den", team2, [], "spring", 2), ("johto-route-45", team2, ["tent"], "winter", 5),
             ("kanto-sea-route-21", team, ["rod", "potion"], "summer", 3), ("lake-of-rage", team2, ["tent", "lantern"], "autumn", 6)]
    out = {"profiles": {pid: profile(wild, pid, "heartgold") for pid in sorted(wild["places"])}, "cases": []}
    for pid, mem, kit, season, days in cases:
        pl = plan(wild, cap, "heartgold", pid, mem, kit, season, days, residents)
        out["cases"].append({"place": pid, "members": mem, "kit": kit, "season": season, "days": days, "residents": residents, "plan": pl,
                             "runs": [simulate(wild, cap, "heartgold", pl, mem, seed) for seed in (1, 2, 3)],
                             "odds": odds(wild, cap, "heartgold", pl, mem, 8)})
    hh = [dict(m, climate={"Magcargo": "warm", "Typhlosion": "warm", "Mamoswine": "cold", "Lapras": "any"}.get(m["species"], "any"),
               land="forest" if m["species"] == "Meganium" else None, line=m["species"]) for m in residents]
    crops = [{"berry": "Oran Berry", "hours_to_harvest": 16, "max_harvest": 5, "why": "the medicine crop"},
             {"berry": "Sitrus Berry", "hours_to_harvest": 32, "max_harvest": 5, "why": "held in a build"},
             {"berry": "Lum Berry", "hours_to_harvest": 48, "max_harvest": 5, "why": "held in a build"}]
    out["estate"] = {"household": hh, "crops": crops, "jobs": {"Magcargo": ["Glasshouse: heat"], "Ampharos": ["Glasshouse: light"]},
                     "seasons": {s: season_card(wild, s, hh) for s in wild["rules"]["seasons"]["order"]},
                     "stores": [stores(wild, cap, crops, hh), stores(wild, cap, crops, hh, 8)],
                     "day": day(wild, hh, {"Magcargo": ["Glasshouse: heat"], "Ampharos": ["Glasshouse: light"]})}
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)


def main(argv):
    if argv and argv[0] == "--parity":
        parity(argv[1])
        return
    pid = argv[0] if argv else "ice-path"
    days = int(argv[1]) if len(argv) > 1 else 3
    season = argv[2] if len(argv) > 2 else "winter"
    wild, cap, team, pl = sample(pid, days, season)
    p = pl["place"]
    print(f"{p['name']} ({p['region']}, {', '.join(p['biome'])}, {p['elevation']}): {pl['season']}, {pl['days']} days there, "
          f"{pl['route']['days']} each way by {pl['route']['by']} via {' > '.join(pl['route']['path'])}")
    for n in pl["readiness"]["needs"]:
        print(f"  {n['priority']:9} {n['name']:18} {n['standing']:10} {', '.join(h['who'] for h in n['holders'][:2])}")
    print("  home:", [(h["facility"], h["requirement"]) for h in pl["home"]])
    s = simulate(wild, cap, "heartgold", pl, team, 1)
    for d in s["days"]:
        print(f"  day {d['day']} {d['where']} {d['weather_name']}: " + " | ".join(e["text"] for e in d["events"]))
    print(" ", s["outcome"], s["ended"], "seen", s["seen"])
    print(" ", odds(wild, cap, "heartgold", pl, team))


if __name__ == "__main__":
    main(sys.argv[1:])
