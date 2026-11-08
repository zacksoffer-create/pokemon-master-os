"""The organism (v2.8, docs/ORGANISM.md): a Pokémon read as a living animal in the wild, the species and then the
individual. Pure functions over the organism pack (app/data/organism.json, from app/organism_pack.py), the breeding pack
(its learnsets: how each move is learned), the capability pack (what it can do, on what evidence) and the Wild's pack
(its places). The browser runs the same code (app/web/44_organism.html; app/test_organism_parity.mjs).

- sheet(species): the animal: its body, how it moves, what it eats, water and climate, senses, defence, its social
  life, when it's about, and what it needs on the trail; every line with its class (mechanic, inferred, canon, draft);
- learn_origin(species, move, game): how the species comes by the move in that game (level-up, egg, tutor, machine),
  through its pre-evolutions;
- portrait(member, build, ind): the individual on top of its species: each move it knows, how it came by it and what
  it's for away from battle; its ability read as biology and its overworld effect; its nature's flavours and its
  characteristic (from its IVs); where it was born; what it brings, by standing;
- exposure(species, ability, place, weather): how the place's conditions treat its body (the type chart, read as
  physiology);
- camp(members, kit, place, weather): who keeps watch at night, who feels the conditions and who eases them.

    python3 -I engine/biology/organism.py Lapras        # one species' sheet and a sample individual
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

import rules  # noqa: E402
from capability import assess  # noqa: E402

READY = ("covered", "equipped")


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def norm(name):
    return re.sub(r"[^a-z0-9]", "", str(name).lower().replace("♀", "f").replace("♂", "m"))


def find(org, name):
    nm = org["index"].get(norm(name))
    return (nm, org["species"][nm]) if nm else (name, None)


def num(x):
    """A number as the browser prints it (220.0 is "220")."""
    return str(int(x)) if float(x).is_integer() else str(x)


def line(text, cls, source):
    return {"text": text, "class": cls, "source": source}


# --- the species ---------------------------------------------------------------------------------------------
def sheet(org, cap, name):
    R = org["rules"]
    nm, s = find(org, name)
    if s is None:
        return None
    H = R["habitat_words"]
    D = s.get("dossier") or {}
    dex = s["dex"]
    dl = lambda part: line("“" + dex[part][0] + "”", "canon", "Pokédex (" + ", ".join(dex[part][1][:2]) + ")") if dex.get(part) else None
    dos = lambda sec: line(D[sec][0], D[sec][1] or "draft", "dossier (" + (D.get("status") or "draft") + ")") if D.get(sec) else None
    keep = lambda xs: [x for x in xs if x]
    body = [line((s.get("genus") or "") + ": " + num(s["h"]) + " m, " + num(s["w"]) + " kg, " + (s.get("color") or "") + ", " + (s.get("shape") or "") + " body",
                 "mechanic", "the game (Pokédex data)")]
    body += [line(R["type_body"][t], "inferred", t + " type") for t in s["t"] if t in R["type_body"]]
    moves = keep([line(R["shape_moves"][s["shape"]], "inferred", "its body shape (" + s["shape"] + ")") if s.get("shape") in R["shape_moves"] else None, dl("moves")])
    eats = keep([line("a " + s["guild"] + (" (as its line's " + s["guild_from"] + " is in the food webs)" if s.get("guild_from") else ""), "inferred",
                      "the food webs") if s.get("guild") else None, dos("diet"), dl("eats")])
    if not eats:
        eats = [line("Nothing on record says what it eats.", "unknown", "")]
    water = [line(H["water"][s["water"]], "mechanic", "the habitat engine")]
    climate = [line(H["climate"][s["climate"]], "inferred", "the habitat engine (its type)")]
    home = []
    if s.get("hab"):
        home.append(line("lives in " + H.get(s["hab"], s["hab"]), "mechanic", "the Gen 3 Pokédex habitat"))
    if s.get("zones"):
        home.append(line("its land: " + ", ".join(z.replace("_", " & ") for z in s["zones"]), "inferred", "the habitat engine"))
    senses = keep([dos("senses"), dl("senses")])
    defense = keep([dos("defense"), dl("defense")])
    social = keep([dos("social"), dos("behavior")])
    W = R.get("windows_names") or {"morning": "morning", "day": "day", "night": "night"}
    act = s.get("activity")
    rhythm = [line("about in the wild in the " + " and ".join(W[w] for w in act) + " (HeartGold and SoulSilver's encounter times)", "mechanic", "the games' encounter tables")
              if act else line("never wild in HeartGold or SoulSilver: no clock on record", "unknown", "")]
    P = cap["model"]["provisions"]
    about = keep([dl("about"), line(D["summary"], "draft", "dossier (" + (D.get("status") or "draft") + ")") if D.get("summary") else None])
    return {"species": nm, "n": s["n"], "genus": s.get("genus"), "types": s["t"], "size": s["size"], "line": s["line"], "about": about,
            "body": body, "moves": moves, "eats": eats, "water": water, "climate": climate, "home": home, "senses": senses, "defense": defense,
            "social": social, "rhythm": rhythm, "abilities": s["abilities"],
            "needs": {"rations": P["per_day"][s["size"]], "water": s["water"], "climate": s["climate"]}}


# --- how it came by a move -------------------------------------------------------------------------------------
def chain(breeding, name):
    """The species and its pre-evolutions, newest first: [(id, name)]."""
    by = breeding["species"]
    sid = next((k for k, v in by.items() if norm(v["n"]) == norm(name)), None)
    out = []
    while sid is not None and sid in by:
        out.append((sid, by[sid]["n"]))
        f = by[sid].get("f")
        sid = str(f) if f is not None else None
    return out


def learn_origin(org, breeding, name, move, game):
    vg = str(org["rules"]["vg"][game])
    L = breeding["learn"].get(vg) or {}
    mid = next((k for k, v in breeding["moves"].items() if v[0] == move), None)
    if mid is None:
        return []
    mid = int(mid)
    ch = chain(breeding, name)
    out = []
    best_lv = None
    for sid, nm in ch:
        lv = L.get("L", {}).get(sid) or []
        for i in range(0, len(lv) - 1, 2):
            if lv[i] == mid and (best_lv is None or lv[i + 1] < best_lv[0]):
                best_lv = (lv[i + 1], nm)
    if best_lv:
        out.append({"how": "level", "level": best_lv[0], "as": best_lv[1] if best_lv[1] != (ch[0][1] if ch else name) else None})
    for kind, how in (("E", "egg"), ("T", "tutor"), ("B", "light-ball")):
        if any(mid in (L.get(kind, {}).get(sid) or []) for sid, _ in ch):
            out.append({"how": how})
    M = (org.get("machines") or {}).get(vg)
    if M:
        i = next((j for j, (mv, _) in enumerate(M["m"]) if mv == mid), None)
        if i is not None and any(taught(M["have"].get(sid), i) for sid, _ in ch):
            out.append({"how": "machine", "machine": M["m"][i][1]})
    return out


def taught(hexbits, i):
    """Bit i of a machines bitstring: a hex digit per four machines, bit i % 4 of digit i // 4."""
    if not hexbits or i // 4 >= len(hexbits):
        return False
    return (int(hexbits[i // 4], 16) >> (i % 4)) & 1 == 1


def origin_text(org, o):
    W = org["rules"]["learn"]
    if o["how"] == "level":
        return W["level"].replace("{level}", str(o["level"])).replace("{as}", ", as " + o["as"] if o.get("as") else "")
    if o["how"] == "machine":
        return W["machine"].replace("{machine}", o["machine"])
    return W[o["how"]]


STORY = ("level", "machine", "tutor", "egg", "light-ball")


def story(org, origins, hatched):
    """The likeliest way this individual came by the move: hatched with it, else level-up, a machine, a tutor, its father."""
    W = org["rules"]["learn"]
    if hatched:
        return W["hatch"] + ("; " + W["egg"] if any(o["how"] == "egg" for o in origins) else "")
    for how in STORY:
        o = next((x for x in origins if x["how"] == how), None)
        if o:
            return origin_text(org, o)
    return W["unknown"]


# --- the individual ----------------------------------------------------------------------------------------------
def characteristic(org, ivs):
    if not ivs:
        return None
    order = org["rules"]["characteristic_order"]
    vals = {s: ivs.get(s, 31) for s in order}
    mx = max(vals.values())
    tops = [s for s in order if vals[s] == mx]
    names = org["rules"]["stat_names"]
    if len(tops) > 1:
        return {"text": None, "tie": [names[s] for s in tops], "iv": mx}
    return {"text": org["characteristics"][tops[0]][mx % 5], "stat": names[tops[0]], "iv": mx}


def native_place(wild, location):
    if not location or not wild:
        return None
    for pid in sorted(wild["places"]):
        p = wild["places"][pid]
        if location == p["name"] or location in p["areas"]:
            return pid
    return None


def origin(org, wild, ind):
    if not ind or not ind.get("met_how"):
        return None
    O = org["rules"]["origin"]
    out = {"how": ind["met_how"], "text": O.get(ind["met_how"], ind["met_how"]), "where": ind.get("met_location"), "level": ind.get("caught_level"), "native": None}
    if ind["met_how"] in ("wild", "encounter"):
        pid = native_place(wild, ind.get("met_location"))
        if pid:
            p = wild["places"][pid]
            biome = " and ".join(b.replace("-", " ") for b in p["biome"]) or "the open"
            out["native"] = {"place": pid, "name": p["name"], "biome": p["biome"],
                             "text": O["native"].replace("{biome}", biome).replace("{place}", p["name"])}
    return out


def portrait(org, breeding, cap, wild, game, member, build=None, ind=None):
    """The individual: its species' sheet, then what's its own."""
    sh = sheet(org, cap, member["species"])
    if sh is None:
        return None
    R = org["rules"]
    build = build or {}
    names = cap["model"]["capabilities"]
    recs = assess.records(cap, game, member["species"])
    uses = cap["model"]["move_uses"]
    hatched = (ind or {}).get("hatch_moves") or []
    moves = []
    for mv in member.get("moves") or []:
        field = [names[r["cap"]]["name"] for r in recs if r["kind"] == "move" and r["move"] == mv]
        use = [names[c]["name"] for c in uses if not c.startswith("_") and mv in uses[c]]
        origins = learn_origin(org, breeding, sh["species"], mv, game)
        moves.append({"move": mv, "hatched": mv in hatched, "story": story(org, origins, mv in hatched),
                      "origins": [origin_text(org, o) for o in origins], "how": [o["how"] for o in origins],
                      "field": field, "use": use, "battle_only": not field and not use})
    ab = member.get("ability")
    ability = None
    if ab:
        text = next((a[1] for a in sh["abilities"] if a[0] == ab), None)
        t = R["traits"].get(ab)
        ow = [{"cap": names[r["cap"]]["name"], "detail": r.get("detail")} for r in recs if r["kind"] == "ability" and r["ability"] == ab]
        ability = {"name": ab, "text": text, "trait": t["reading"] if t else None, "trait_caps": [names[c]["name"] for c in t["caps"]] if t else [],
                   "overworld": ow}
    nat = build.get("nature")
    nature = None
    if nat and nat in org["natures"]:
        up, down, likes, hates = org["natures"][nat]
        nature = {"name": nat, "up": R["stat_names"].get(up) if up else None, "down": R["stat_names"].get(down) if down else None, "likes": likes, "hates": hates}
    best = assess.best(cap, game, member)
    order = list(names)
    brings = sorted(([c, names[c]["name"], st, r["kind"], r.get("source")] for c, (st, r) in best.items()),
                    key=lambda x: (assess.RANK[x[2]], order.index(x[0]) if x[0] in order else 99))
    return {"sheet": sh, "who": member.get("label") or member["species"], "moves": moves, "egg_moves": [m["move"] for m in moves if "egg" in m["how"]],
            "ability": ability, "nature": nature, "characteristic": characteristic(org, build.get("ivs")), "origin": origin(org, wild, ind),
            "item": build.get("item"), "brings": [{"cap": c, "name": n, "standing": st, "kind": k, "source": src} for c, n, st, k, src in brings]}


# --- the body in a place -------------------------------------------------------------------------------------------
def effectiveness(org, gen, attack_type, defend_types, ability=None):
    """rules.effectiveness over the pack's copy of the type chart and defensive abilities (the browser has no battle pack here)."""
    chart = org["chart"][str(gen)]
    mult = 1.0
    for t in defend_types:
        mult *= chart[attack_type].get(t, 1)
    D = org["defend"]
    if ability and gen >= 3:
        first_gen, table = D["abilities"].get(ability, (99, {}))
        if gen >= first_gen and attack_type in table:
            mult *= table[attack_type]
        if gen >= D["filters"].get(ability, 99) and mult > 1:
            mult *= 0.75
        if ability == D["wonder_guard"] and mult <= 1:
            mult = 0
    return mult


def exposure(org, game, name, ability, place, weather):
    """[{id, name, type, effect: hard | home, mult, eased_by}] for the conditions that hold at the place in this weather."""
    nm, s = find(org, name)
    if s is None or place is None:
        return []
    gen = rules.GAME_GEN[game]
    out = []
    for c in org["rules"]["exposure"]["conditions"]:
        w = c["when"]
        hit = any(b in w.get("biome", []) for b in place["biome"]) or weather in w.get("weather", [])
        if not hit:
            continue
        m = effectiveness(org, gen, c["type"], list(s["t"]), ability if gen >= 3 else None)
        if m > 1:
            out.append({"id": c["id"], "name": c["name"], "type": c["type"], "effect": "hard", "mult": m, "eased_by": c["eased_by"]})
        elif m < 1:
            out.append({"id": c["id"], "name": c["name"], "type": c["type"], "effect": "home", "mult": m, "eased_by": None})
    return out


def watcher(org, members):
    """Who keeps watch at night: the first member about at night in the wild, else the first that never sleeps."""
    for m in members:
        nm, s = find(org, m["species"])
        if s and s.get("activity") and "night" in s["activity"]:
            return {"who": m.get("label") or m["species"], "why": "in the wild it's about at night"}
    for m in members:
        if m.get("ability") in ("Insomnia", "Vital Spirit"):
            return {"who": m.get("label") or m["species"], "why": org["rules"]["traits"][m["ability"]]["reading"]}
    return None


def helper_how(h):
    """How a holder eases a condition, in words: the move or ability, your call by its id, or the record's source."""
    if h.get("kind") == "world":
        return "your call " + h["id"] + (", approved" if h.get("status") == "approved" else ", proposed")
    return h.get("move") or h.get("ability") or h.get("source")


def camp(org, cap, game, members, kit, place, weather):
    """The camp on one day: the night watch, and each member the conditions are hard on, with who eases it."""
    exposed, home = [], []
    for m in members:
        who = m.get("label") or m["species"]
        nm, s = find(org, m["species"])
        for e in exposure(org, game, m["species"], m.get("ability"), place, weather):
            if e["effect"] == "hard":
                hs = assess.need_holders(cap, game, e["eased_by"], [x for x in members if x is not m], list(kit))
                helper = hs[0] if hs and hs[0]["standing"] != "gap" else None
                exposed.append({"who": who, "types": s["t"], "condition": e["name"], "type": e["type"], "mult": e["mult"], "eased_by": e["eased_by"],
                                "helper": helper["who"] if helper else None, "helper_standing": helper["standing"] if helper else None,
                                "helper_kit": bool(helper and helper.get("kit")),
                                "helper_how": helper_how(helper) if helper else None})
            else:
                home.append({"who": who, "condition": e["name"]})
    return {"watch": watcher(org, members), "exposed": exposed, "home": home}


def fill(text, **kw):
    for k, v in kw.items():
        text = text.replace("{" + k + "}", str(v))
    return text


def camp_events(org, cap, game, members, kit, place, weather):
    """The camp's lines for one day of an expedition: [{kind: camp, part, result, text}]. A hard condition nobody eases
    is a strain (hard going), never a setback. No randomness: the same team, place and weather always read the same."""
    C = org["rules"]["camp"]
    names = cap["model"]["capabilities"]
    c = camp(org, cap, game, members, kit, place, weather)
    out = []
    for e in c["exposed"]:
        types = "/".join(e["types"])
        if e["helper"] and e["helper_standing"] in READY:
            out.append({"kind": "camp", "part": "exposure", "result": "handled", "who": e["who"], "condition": e["condition"],
                        "text": fill(C["eased_kit"] if e["helper_kit"] else C["eased"], who=e["who"], condition=e["condition"], types=types,
                                     helper=e["helper"], how=e["helper_how"] or "")})
        elif e["helper"]:
            out.append({"kind": "camp", "part": "exposure", "result": "strained", "who": e["who"], "condition": e["condition"],
                        "text": fill(C["maybe"], who=e["who"], condition=e["condition"], types=types, helper=e["helper"], how=e["helper_how"] or "",
                                     standing=C["standing"].get(e["helper_standing"], e["helper_standing"]))})
        else:
            out.append({"kind": "camp", "part": "exposure", "result": "strained", "who": e["who"], "condition": e["condition"],
                        "text": fill(C["unaided"], who=e["who"], condition=e["condition"], types=types, cap=names[e["eased_by"]]["name"].lower())})
    conds = []
    for h in c["home"]:
        if h["condition"] not in conds:
            conds.append(h["condition"])
    for cond in conds:
        out.append({"kind": "camp", "part": "home", "result": "note", "condition": cond,
                    "text": fill(C["home"], condition=cond, who=", ".join(h["who"] for h in c["home"] if h["condition"] == cond))})
    w = c["watch"]
    out.append({"kind": "camp", "part": "watch", "result": "note", "who": w["who"] if w else None,
                "text": fill(C["watch"], who=w["who"], why=w["why"]) if w else C["no_watch"]})
    return out


def forage_event(org, holder, n):
    C = org["rules"]["camp"]
    if holder.get("kit"):
        text = fill(C["forage_kit"], who=holder["who"], n=n)
    else:
        how = holder.get("move") or holder.get("ability") or holder.get("source") or ""
        text = fill(C["forage"], who=holder["who"], how=how, n=n)
    return {"kind": "camp", "part": "forage", "result": "note", "who": holder["who"], "text": text}


PARITY_TEAMS = [
    [{"species": "Typhlosion", "moves": ["Flamethrower", "Strength", "Rock Smash", "Cut"], "ability": "Blaze", "label": "Typhlosion", "ind": "me:heartgold/Typhlosion"},
     {"species": "Lapras", "moves": ["Surf", "Ice Beam", "Waterfall", "Whirlpool"], "ability": "Water Absorb", "label": "Lapras"},
     {"species": "Ampharos", "moves": ["Thunderbolt", "Flash", "Signal Beam", "Light Screen"], "ability": "Static", "label": "Ampharos"},
     {"species": "Pidgeot", "moves": ["Fly", "Return", "Roost", "U-turn"], "ability": "Keen Eye", "label": "Pidgeot"}],
    [{"species": "Mamoswine", "moves": ["Earthquake", "Ice Shard", "Strength", "Rock Smash"], "ability": "Oblivious", "label": "Mamoswine"},
     {"species": "Meganium", "moves": ["Leaf Storm", "Synthesis", "Sunny Day", "Cut"], "ability": "Overgrow", "label": "Meganium"},
     {"species": "Miltank", "moves": ["Milk Drink", "Body Slam", "Heal Bell", "Rollout"], "ability": "Thick Fat", "label": "Miltank"},
     {"species": "Magcargo", "moves": ["Flamethrower", "Rock Slide", "Recover", "Rock Smash"], "ability": "Flame Body", "label": "Magcargo"}],
    [{"species": "Noctowl", "moves": ["Hypnosis", "Fly", "Air Slash", "Reflect"], "ability": "Insomnia", "label": "Owl"},
     {"species": "Dragonite", "moves": ["Outrage", "Fly", "Surf", "Extreme Speed"], "ability": "Inner Focus", "label": "Dragonite"},
     {"species": "Nidoran♀", "moves": ["Scratch", "Double Kick", "Poison Sting", "Charm"], "ability": "Poison Point", "label": "Nidoran"},
     {"species": "Houndoom", "moves": ["Flamethrower", "Crunch", "Pursuit", "Sunny Day"], "ability": "Early Bird", "label": "Houndoom"}]]


def parity(out_path):
    """Python's side of app/test_organism_parity.mjs: every species' sheet, learn origins over a spread of species, moves
    and games, portraits, characteristics, exposure across species, places and weather, and camps."""
    org = load(os.path.join(ENGINE, "app", "data", "organism.json"))
    cap = load(os.path.join(ENGINE, "app", "data", "capability.json"))
    breeding = load(os.path.join(ENGINE, "app", "data", "breeding.json"))
    wild = load(os.path.join(ENGINE, "app", "data", "wild.json"))
    out = {"sheets": {nm: sheet(org, cap, nm) for nm in org["species"]}, "learn": [], "portraits": [], "chars": [], "exposure": [], "camps": []}
    field = ["Surf", "Strength", "Fly", "Cut", "Flash", "Rock Smash", "Waterfall", "Whirlpool", "Rock Climb", "Defog", "Dig", "Headbutt"]
    names = sorted(org["species"])
    for game in ("heartgold", "platinum", "emerald", "firered", "crystal"):
        vg = str(org["rules"]["vg"][game])
        L = breeding["learn"].get(vg) or {}
        for nm in names[::23]:
            ch = chain(breeding, nm)
            ids = []
            for sid, _ in ch[:1]:
                lv = L.get("L", {}).get(sid) or []
                ids += lv[0::2][:8] + (L.get("E", {}).get(sid) or [])[:4] + (L.get("T", {}).get(sid) or [])[:3]
            mvs = [breeding["moves"][str(i)][0] for i in ids if str(i) in breeding["moves"]] + field
            for mv in mvs:
                out["learn"].append({"species": nm, "move": mv, "game": game, "out": learn_origin(org, breeding, nm, mv, game)})
    builds = [{"nature": "Calm", "ivs": {"hp": 31, "atk": 12, "def": 25, "spa": 28, "spd": 30, "spe": 20}, "item": "Leftovers"},
              {"nature": "Hardy", "ivs": {"hp": 7, "atk": 7, "def": 3, "spa": 0, "spd": 1, "spe": 2}},
              {"nature": "Jolly", "ivs": {"hp": 31, "atk": 31, "def": 31, "spa": 31, "spd": 31, "spe": 31}}, {}]
    inds = [{"met_how": "encounter", "met_location": "Union Cave (B2F)"}, {"met_how": "hatched", "hatch_moves": ["Ice Beam", "Surf", "Double Kick", "Charm", "Pursuit"]},
            {"met_how": "wild", "met_location": "Ice Path"}, {"met_how": "starter"}, None]
    k = 0
    for team in PARITY_TEAMS:
        for m in team:
            for game in ("heartgold", "platinum"):
                b, ind = builds[k % len(builds)], inds[k % len(inds)]
                k += 1
                out["portraits"].append({"game": game, "member": m, "build": b, "ind": ind, "out": portrait(org, breeding, cap, wild, game, m, b, ind)})
    for i in range(40):
        ivs = {s: (i * 7 + j * 11) % 32 for j, s in enumerate(org["rules"]["characteristic_order"])}
        out["chars"].append({"ivs": ivs, "out": characteristic(org, ivs)})
    places = ["ice-path", "mt-silver", "ilex-forest", "whirl-islands", "johto-route-45", "kanto-sea-route-21"]
    weathers = ["clear", "rain", "storm", "snow", "blizzard", "heat", "sheltered"]
    for nm in names[::3]:
        for pid in places[:3]:
            for w in weathers:
                sp = org["species"][nm]
                ab = sp["abilities"][0][0] if sp["abilities"] else None
                out["exposure"].append({"species": nm, "ability": ab, "place": pid, "weather": w,
                                        "out": exposure(org, "heartgold", nm, ab, wild["places"][pid], w)})
    for team in PARITY_TEAMS:
        for kit in ([], ["stove", "tent"], ["water-filter"]):
            for pid in places:
                for w in ("snow", "rain", "heat", "clear"):
                    pl = wild["places"][pid]
                    out["camps"].append({"members": team, "kit": kit, "place": pid, "weather": w, "camp": camp(org, cap, "heartgold", team, kit, pl, w),
                                         "events": camp_events(org, cap, "heartgold", team, kit, pl, w)})
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)


def main(argv):
    if argv and argv[0] == "--parity":
        parity(argv[1])
        return
    name = argv[0] if argv else "Lapras"
    org = load(os.path.join(ENGINE, "app", "data", "organism.json"))
    cap = load(os.path.join(ENGINE, "app", "data", "capability.json"))
    breeding = load(os.path.join(ENGINE, "app", "data", "breeding.json"))
    wild = load(os.path.join(ENGINE, "app", "data", "wild.json"))
    sh = sheet(org, cap, name)
    for k in ("about", "body", "moves", "eats", "water", "climate", "home", "senses", "defense", "social", "rhythm"):
        for x in sh[k]:
            print(f"  {k:8} [{x['class']}] {x['text'][:140]}")
    member = {"species": name, "moves": ["Surf", "Ice Beam", "Sing", "Waterfall"], "ability": "Water Absorb", "label": name}
    p = portrait(org, breeding, cap, wild, "heartgold", member, {"nature": "Calm", "ivs": {"hp": 31, "atk": 12, "def": 25, "spa": 28, "spd": 30, "spe": 20}},
                 {"met_how": "encounter", "met_location": "Union Cave (B2F)"})
    for mv in p["moves"]:
        print("  move", mv["move"], "|", mv["story"], "|", mv["origins"], mv["field"], mv["use"])
    print("  ability", p["ability"]); print("  nature", p["nature"], p["characteristic"]); print("  origin", p["origin"])
    print("  brings", [(b["name"], b["standing"]) for b in p["brings"]][:10])
    print("  exposure", exposure(org, "heartgold", "Meganium", "Overgrow", wild["places"]["ice-path"], "sheltered"))


if __name__ == "__main__":
    main(sys.argv[1:])
