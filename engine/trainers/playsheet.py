"""The trainer playsheet (docs/TRAINER_REPORT.md, Part 2, steps 3-4): how a trainer version plays, read from its
team. It joins the Part 1 report, so the scouting report stays one film-room document.

- **career:** the records this version has lived through, and the career tags they earn (trainers/config.json
  tags.career: Multi-Region Traveler, a Champion title, Elite Four Beaten);
- **roles:** every member's primary and secondary role (trainers/roles.py), read as a team (a Swift Swim member
  counts its teammates' rain);
- **ace:** derived from investment, support, coverage and role, next to the authored ace when they differ;
- **go-to by game state:** the workhorse when it's even, the cleaner when ahead, the gambit when behind (plus the
  last resorts: Explosion, Destiny Bond, Endeavor, Focus Sash);
- **type-advantage read:** a real super-effective attack for each type, the coverage it adds up to, and the holes,
  paired with Part 1's count of how many of them are weak to each;
- **combos to watch:** the config's list, flagged where the team has one;
- **signature moves:** authored per version;
- **aggression ratio:** finishing and setup moves against attrition moves, compared with Part 1's offense slider.

Plain data out (schema in the report); every sentence comes from trainers/phrases.json (kind "playsheet").
Deterministic. No simulation, no damage calculation.
"""
from trainers.era import GAME_GEN
from trainers.roles import live


def join(items, word="and"):
    items = [str(i) for i in items]
    return "" if not items else items[0] if len(items) == 1 else f"{', '.join(items[:-1])} {word} {items[-1]}"


# --- career ---------------------------------------------------------------------------------------------
def career(store, trainer, version_id):
    cfg = store.config["tags"]["career"]
    records = trainer.career_for(version_id)
    regions = []
    for r in records:
        if r["region"] not in cfg["multi_region"]["not_regions"] and r["region"] not in regions:
            regions.append(r["region"])
    tags = []
    if len(regions) >= cfg["multi_region"]["regions_at_least"]:
        tags.append({"id": "multi_region", "name": cfg["multi_region"]["name"], "detail": regions})
    for r in records:
        if r.get("champion"):
            tags.append({"id": "region_champion", "name": cfg["region_champion"]["name"].format(title=r["title"]),
                         "detail": [r["event"]]})
    beaten = [r["event"] for r in records if r.get("elite_four") == "beaten"]
    if beaten:
        tags.append({"id": "elite_four_beaten", "name": cfg["elite_four_beaten"]["name"], "detail": beaten})
    return {"records": records, "regions": regions, "tags": tags}


# --- reading the team -----------------------------------------------------------------------------------
def read_team(book, version, team, level=None):
    """[(build, context, signals, classification)] for every member, read as a team."""
    gen = GAME_GEN[version.game]
    weather = set()
    for b in team:
        weather |= set(book.weather_of(b.moves, book.store.filled(b, gen)[0]["ability"]))
    out = []
    for b in team:
        ctx = book.context(b, version.game, level, weather)
        sig = book.signals(ctx)
        out.append((b, ctx, sig, book.classify(b, version.game, level, weather)))
    return out, weather


def _fits(book, role_id, family_or_ids):
    fam = book.roles[role_id]["family"]
    return role_id in family_or_ids or fam in family_or_ids


def ace(store, book, reads):
    cfg = store.config["playsheet"]["ace"]
    w = cfg["weights"]
    gen = reads[0][1]["gen"] if reads else 4
    types_n = len(book.type_list(gen))
    top_level = max((b.level for b, *_ in reads if b.level), default=None)
    rows = []
    for i, (b, ctx, sig, cl) in enumerate(reads):
        inv = []
        if b.evs and sum(b.evs.values()):
            inv.append(min(1.0, sum(b.evs.values()) / 510))
        if b.level and top_level:
            inv.append(max(0.0, 1 - (top_level - b.level) / cfg["level_window"]))
        if b.friendship is not None:
            inv.append(b.friendship / 255)
        mine = [cl["primary"]["role"]] + ([cl["secondary"]["role"]] if cl["secondary"] else [])
        helpers = []
        for j, (t, tctx, tsig, tcl) in enumerate(reads):
            if j == i:
                continue
            theirs = [tcl["primary"]["role"]] + ([tcl["secondary"]["role"]] if tcl["secondary"] else [])
            for r in theirs:
                rule = cfg["supports"].get(r)
                if not rule or not any(_fits(book, m, rule["for"]) for m in mine):
                    continue
                if rule.get("needs") == "slow" and sig["slow"][0] < cfg["slow_at_least"]:
                    continue
                if rule.get("needs") == "its weather":
                    own = {wname for wname, spec in book.weathers.items()
                           if ctx["ability"] in spec["sweep_abilities"] + spec["other_abilities"]}
                    if not own & set(book.weather_of(t.moves, tctx["ability"])):
                        continue
                helpers.append(t.species)
                break
        attacks = [m for m in ctx["moves"] if m["eff"] > 0]
        cover = len(book.covered(attacks, gen, store.config["playsheet"]["type_read"]["min_power"])) / types_n
        role_v = max(cfg["role_value"].get(r, cfg["role_value_default"]) for r in mine)
        parts = {"support": min(1.0, len(helpers) / cfg["support_full_at"]), "coverage": cover, "role": role_v}
        if inv:
            parts["investment"] = sum(inv) / len(inv)
        score = sum(w[k] * v for k, v in parts.items()) / sum(w[k] for k in parts)
        rows.append({"species": b.species, "slot": i + 1, "score": round(score, 3),
                     "parts": {k: round(v, 3) for k, v in parts.items()}, "helpers": helpers,
                     "role": cl["primary"]["name"], "level": b.level})
    rows.sort(key=lambda r: (-r["score"], -(r["level"] or 0), -r["slot"]))
    return rows


def go_to(store, book, reads):
    cfg = store.config["playsheet"]["go_to"]
    out = {}
    for state in ("even", "ahead", "behind"):
        spec = cfg[state]
        best = None
        for i, (b, ctx, sig, cl) in enumerate(reads):
            for r in cl["roles"]:
                v = r["score"] * spec["roles"].get(r["role"], 0)
                if v > 0 and (best is None or v > best[0] + 1e-9):
                    best = (v, b.species, r["name"], i)
        out[state] = {"label": spec["label"], "species": best[1] if best else None, "role": best[2] if best else None,
                      "fit": round(best[0], 3) if best else 0.0}
    last = []
    for b, ctx, sig, cl in reads:
        moves = [m for m in b.moves if m in cfg["behind"]["last_resort_moves"]]
        item = ctx["item"] if ctx["item"] in cfg["behind"]["last_resort_items"] else None
        if moves or item:
            last.append({"species": b.species, "moves": moves, "item": item})
    out["behind"]["last_resorts"] = last
    return out


def type_read(store, book, reads, report):
    gen = reads[0][1]["gen"] if reads else 4
    min_power = store.config["playsheet"]["type_read"]["min_power"]
    per_type = report["matrix"]["summary"]["per_type"]
    rows = []
    for t in book.type_list(gen):
        best = None
        for b, ctx, sig, cl in reads:
            for m in ctx["moves"]:
                if m["eff"] <= 0 or m["plain"] < min_power:
                    continue
                if book.era.multiplier(m["type"], [t], gen) >= 2 and (best is None or m["plain"] > best[0]):
                    best = (m["plain"], m["name"], b.species, m["type"])
        weak = _weak_to(per_type, t)
        rows.append({"type": t, "covered": best is not None, "move": best[1] if best else None,
                     "member": best[2] if best else None, "move_type": best[3] if best else None,
                     "power": round(best[0]) if best else 0, "their_weak_to_it": weak})
    covered = [r["type"] for r in rows if r["covered"]]
    holes = [r["type"] for r in rows if not r["covered"]]
    bring = sorted((r for r in rows if not r["covered"] and r["their_weak_to_it"]),
                   key=lambda r: (-r["their_weak_to_it"], r["type"]))
    return {"rows": rows, "coverage": round(len(covered) / len(rows), 3) if rows else 0.0,
            "covered_n": len(covered), "types_n": len(rows), "holes": holes,
            "bring": [{"type": r["type"], "their_weak": r["their_weak_to_it"]} for r in bring]}


def _weak_to(per_type, attack_type):
    """How many of their Pokémon are weak (or very weak) to attacks of this type, from Part 1's summary. A hole is
    a type they can't hit super-effectively; a Pokémon of that type whose same-type attacks also hit several of
    them hard is the one to bring."""
    return per_type.get(attack_type, {}).get("weak_total", 0)


# --- combos ---------------------------------------------------------------------------------------------
def _member_has(book, cond, b, ctx, sig, weather):
    if "any" in cond:
        return any(_member_has(book, c, b, ctx, sig, weather) for c in cond["any"])
    if "moves_any" in cond:
        return any(m in cond["moves_any"] for m in b.moves)
    if "category" in cond:
        return any(cond["category"] in m["categories"] for m in ctx["moves"])
    if "item_any" in cond:
        return ctx["item"] in cond["item_any"]
    if "item_group" in cond:
        return ctx["item"] in book.items[cond["item_group"]]
    if "ability_any" in cond:
        return ctx["ability"] in cond["ability_any"]
    if "weather" in cond:
        return cond["weather"] in weather
    if "signal_at_least" in cond:
        return all(sig[k][0] >= v for k, v in cond["signal_at_least"].items())
    raise ValueError(f"unknown combo condition {cond}")


def combos(store, book, reads, weather):
    found = []
    for combo in store.config["playsheet"]["combos"]["list"]:
        if combo["scope"] == "member":
            who = [b.species for b, ctx, sig, cl in reads
                   if all(_member_has(book, c, b, ctx, sig, weather) for c in combo["all"])]
            if who:
                found.append({"id": combo["id"], "name": combo["name"], "members": who})
        else:
            parts = []
            for c in combo["all"]:
                if "members_at_least" in c:
                    who = [b.species for b, ctx, sig, cl in reads if _member_has(book, c["where"], b, ctx, sig, weather)]
                    parts.append(who if len(who) >= c["members_at_least"] else None)
                elif "weather" in c:
                    parts.append(["the team"] if c["weather"] in weather else None)
                else:
                    who = [b.species for b, ctx, sig, cl in reads if _member_has(book, c, b, ctx, sig, weather)]
                    parts.append(who or None)
            if all(p for p in parts):
                members = []
                for p in parts:
                    members += [m for m in p if m not in members and m != "the team"]
                found.append({"id": combo["id"], "name": combo["name"], "members": members})
    return found


# --- aggression -----------------------------------------------------------------------------------------
def aggression(store, book, reads, report):
    cfg = store.config["playsheet"]["aggression"]
    fin, att, f_moves, a_moves = 0, 0, [], []
    for b, ctx, sig, cl in reads:
        for m in ctx["moves"]:
            cats = m["categories"]
            if cats & set(cfg["finisher_categories"]) or (m["eff"] > 0 and m["scaled"] >= cfg["finisher_attack_at_least"]):
                fin += 1
                f_moves.append(f"{m['name']} ({b.species})")
            elif cats & set(cfg["attrition_categories"]):
                att += 1
                a_moves.append(f"{m['name']} ({b.species})")
    ratio = round(100 * fin / (fin + att)) if fin + att else None
    off = report["sliders"]["offense"]
    authored = off["authored"]
    flag = None
    if ratio is not None and authored is not None and abs(ratio - authored) >= cfg["gap"]:
        leans = off["poles"][1] if ratio > authored else off["poles"][0]
        part1 = off["disagreement"]
        flag = {"gap": ratio - authored, "leans": leans,
                "part1_flags_it": bool(part1 and part1["team_leans"] == leans)}
    return {"ratio": ratio, "finishers": fin, "attrition": att, "finisher_moves": f_moves, "attrition_moves": a_moves,
            "offense_authored": authored, "offense_measured": off["measured"], "flag": flag}


# --- the playsheet --------------------------------------------------------------------------------------
def build_playsheet(store, book, version, team, report, level=None):
    trainer = store.trainers[version.trainer]
    reads, weather = read_team(book, version, team, level)
    car = career(store, trainer, version.id)
    aces = ace(store, book, reads)
    authored_ace = (version.overrides or {}).get("ace")
    roles = [{"species": b.species, "nickname": b.nickname, "primary": cl["primary"], "secondary": cl["secondary"],
              "also": cl["also"], "why": book.line(cl, top=1)} for b, ctx, sig, cl in reads]
    sigs = []
    for s in version.signature_moves:
        on = next((b for b in team if b.species == s["pokemon"]), None)
        sigs.append({**s, "on_team": on is not None, "in_moveset": bool(on and s["move"] in on.moves)})
    return {"career": car, "roles": roles,
            "ace": {"derived": aces[0]["species"] if aces else None, "authored": authored_ace,
                    "agree": authored_ace in (None, aces[0]["species"] if aces else None), "ranking": aces},
            "go_to": go_to(store, book, reads), "type_read": type_read(store, book, reads, report),
            "combos": combos(store, book, reads, weather), "signature_moves": sigs,
            "aggression": aggression(store, book, reads, report), "weather": sorted(weather)}


def context(store, report, sheet):
    """The phrase context for the playsheet's sentences."""
    ctx = {"trainer": report["trainer_name"], "title": report["title"]}
    car = sheet["career"]
    by = {t["id"]: t for t in car["tags"]}
    ctx["career_n"] = len(car["records"])
    ctx["regions_n"] = len(car["regions"])
    ctx["regions_str"] = join(car["regions"])
    ctx["multi_region"] = "multi_region" in by
    ctx["titles_str"] = join([t["name"] for t in car["tags"] if t["id"] == "region_champion"])
    ctx["elite_four"] = "elite_four_beaten" in by
    best = [r for r in car["records"] if r["kind"] in ("league", "contest", "tournament", "frontier")]
    ctx["record_str"] = "; ".join(f"{r['event']}: {r['result']}" for r in best[-3:])
    a = sheet["ace"]
    ctx["ace"] = a["derived"]
    if a["ranking"]:
        top = a["ranking"][0]
        why = []
        inv = [r["parts"].get("investment") for r in a["ranking"] if r["parts"].get("investment") is not None]
        if inv and top["parts"].get("investment") == max(inv) and inv.count(max(inv)) == 1:
            why.append("the most invested" if top["level"] is None else f"the highest level ({top['level']})")
        if top["helpers"]:
            why.append("set up by " + join(top["helpers"]))
        if top["parts"]["coverage"] == max(r["parts"]["coverage"] for r in a["ranking"]) and top["parts"]["coverage"]:
            why.append("the widest coverage")
        why.append(f"a {top['role']}")
        ctx["ace_why"] = join([w for w in why if w])
    ctx["ace_authored"] = a["authored"] if not a["agree"] else ""
    ctx["ace_agrees"] = a["authored"] if a["authored"] and a["agree"] else ""
    g = sheet["go_to"]
    for state in ("even", "ahead", "behind"):
        ctx[f"{state}_who"] = g[state]["species"] or ""
        ctx[f"{state}_role"] = g[state]["role"] or ""
    same = {g[s]["species"] for s in ("even", "ahead", "behind")}
    ctx["one_for_all"] = g["even"]["species"] if len(same) == 1 and g["even"]["species"] else ""
    ctx["last_resort_str"] = "; ".join(f"{x['species']}'s {join(x['moves'] + ([x['item']] if x['item'] else []))}"
                                       for x in g["behind"]["last_resorts"])
    tr = sheet["type_read"]
    ctx.update(covered_n=tr["covered_n"], types_n=tr["types_n"], holes_n=len(tr["holes"]), holes_str=join(tr["holes"], "or"))
    if tr["bring"]:
        top = tr["bring"][0]
        words = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six"}
        ctx["bring_type"] = top["type"]
        ctx["bring_weak"] = top["their_weak"]
        ctx["bring_weak_str"] = f"{words.get(top['their_weak'], top['their_weak'])} of them " + \
            ("is" if top["their_weak"] == 1 else "are")
        ctx["bring_more"] = join([b["type"] for b in tr["bring"][1:3]], "or")
    combo_by = {c["id"]: c for c in sheet["combos"]}
    ctx["combos"] = sorted(combo_by)
    for cid, c in combo_by.items():
        ctx[f"combo_{cid}"] = join(c["members"])
    ctx["combos_n"] = len(combo_by)
    sm = sheet["signature_moves"]
    ctx["signature_str"] = "; ".join(f"{s['pokemon']}'s {s['move']} ({s['why']})" for s in sm)
    ctx["signature_missing"] = join([f"{s['pokemon']}'s {s['move']}" for s in sm if s["on_team"] and not s["in_moveset"]])
    ag = sheet["aggression"]
    ctx["aggression"] = ag["ratio"]
    ctx["finishers_n"], ctx["attrition_n"] = ag["finishers"], ag["attrition"]
    ctx["aggr_total"] = ag["finishers"] + ag["attrition"]
    f = ag["flag"]
    ctx["aggr_flag"] = bool(f and not f["part1_flags_it"])
    ctx["aggr_same_as_part1"] = bool(f and f["part1_flags_it"])
    if f:
        ctx["aggr_leans"] = f["leans"]
        ctx["offense_authored"] = ag["offense_authored"]
    return ctx
