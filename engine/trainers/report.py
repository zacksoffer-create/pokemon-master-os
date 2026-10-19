"""The trainer scouting report (docs/TRAINER_REPORT.md, step 4): layers 1 and 2 turned into a report.

`build_report` returns one plain-data report per trainer version, ready for Part 2 to read:
- the header: the four sliders (authored, measured, disagreement) and the tags;
- the matrix (rows, verdicts, bulk tags) and the team summary;
- the written plan, in four sections: who this trainer is, what to expect, how to beat them, and where their
  rigidity or recklessness leaves a gap. Every sentence is a rule in trainers/phrases.json; per-trainer overrides
  in canon/trainers.json replace a section for named characters.

`exposure` is your workflow: your team against theirs, showing which of their attack types find your weak spots and
whether their attacking side meets your soft rows. Deterministic, no damage calculations, no simulation.
"""
import os

from battle.phrases import Phrasebook
from trainers.era import GAME_GEN
from trainers.matrix import team_matrix
from trainers.sliders import measure, nature_clashes, speed_line, tags

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_TITLE = {"crystal": "Crystal", "firered": "FireRed", "emerald": "Emerald", "platinum": "Platinum",
              "heartgold": "HeartGold", "soulsilver": "SoulSilver"}
SECTIONS = [("who", "Who they are"), ("expect", "What to expect"), ("beat", "How to beat them"),
            ("gap", "Where their rigidity or recklessness leaves a gap")]
SCHEMA = "trainer-report/1"


def join(items, word="and"):
    items = [str(i) for i in items]
    return "" if not items else items[0] if len(items) == 1 else f"{', '.join(items[:-1])} {word} {items[-1]}"


def band(value, cfg):
    if value is None:
        return None
    return "low" if value <= cfg["low_at_most"] else "high" if value >= cfg["high_at_least"] else "mid"


def bond_read(bond, rigidity, cfg):
    if bond is None:
        return None
    for r in cfg["rules"]:
        if "bond_at_most" in r and bond > r["bond_at_most"]:
            continue
        if "rigidity_at_least" in r and (rigidity is None or rigidity < r["rigidity_at_least"]):
            continue
        return r["read"]
    return None


def their_attacks(store, team, gen, min_power=0):
    """[(member, move, type, class)] for every damaging move on the team."""
    out = []
    for b in team:
        for m in b.moves:
            i = store.era.move_info(m, gen)
            if i["class"] != "status" and (i["power"] >= min_power or i["power"] <= 1):
                out.append((b.species, m, i["type"], i["class"]))
    return out


def context(store, version, team, matrix, sliders, tag_list, clashes):
    cfg = store.config
    gen = GAME_GEN[version.game]
    s = matrix["summary"]
    rows = matrix["rows"]
    ctx = {"trainer": store.trainers[version.trainer].name, "title": version.title, "game_title": GAME_TITLE[version.game]}
    # the sliders: the authored value speaks for who they are; the measured one fills in where none is authored
    ctx["authored_n"] = sum(1 for v in sliders.values() if v["authored"] is not None)
    values = {}
    for k, v in sliders.items():
        values[k] = v["authored"] if v["authored"] is not None else v["measured"]
        ctx[k] = values[k]
        ctx[f"{k}_band"] = band(values[k], cfg["bands"])
    ctx["bond_read"] = bond_read(values["bond"], values["rigidity"], cfg["bond_read"])
    for k, v in sliders.items():
        d = v["disagreement"]
        if not d:
            continue
        because = "; ".join(f"{r['label']}: {join(r['members'])}" if r["members"] else f"no {r['label']}"
                            for r in d["because"]) or "the team's data"
        ctx[f"disagree_{k}"] = v["poles"][1] if v["authored"] >= 50 else v["poles"][0]
        ctx[f"disagree_{k}_reads"] = d["team_leans"]
        ctx[f"disagree_{k}_authored"] = v["authored"]
        ctx[f"disagree_{k}_measured"] = v["measured"]
        ctx[f"disagree_{k}_because"] = because
    ctx["nature_clash_str"] = " ".join(c["line"] for c in clashes)
    # tags
    by = {t["id"]: t for t in tag_list}
    roles = {d for t in tag_list if t["id"] == "role" for d in t["detail"]}
    ctx.update(is_gym_leader="Gym Leader" in roles, is_champion="Champion" in roles and "Region Champion" not in roles,
               is_region_champion="Region Champion" in roles)
    if "cohesive" in by:
        ctx["cohesive_str"] = "; ".join(f"{m} on {join(by['cohesive']['members'][m])}" for m in by["cohesive"]["detail"])
    if "type_dominant" in by:
        ctx["type_dominant_str"] = "; ".join(f"{t} ({len(by['type_dominant']['members'][t])} of {len(rows)})"
                                             for t in by["type_dominant"]["detail"])
    # what they throw
    attacks = their_attacks(store, team, gen)
    phys = sum(1 for a in attacks if a[3] == "physical")
    spec = len(attacks) - phys
    ctx.update(their_attacks_n=len(attacks), their_phys_n=phys, their_spec_n=spec)
    if attacks:
        side = "physical" if phys >= 2 * spec else "special" if spec >= 2 * phys else "mixed"
        ctx.update(their_side=side, their_side_n=phys if side == "physical" else spec)
    line = speed_line(store, gen, rows[0]["level"]) if rows else 0
    fast = [r["species"] for r in rows if r["stats"]["spe"] >= line]
    ctx["fast_str"] = join(fast) if fast and len(fast) * 2 >= len(rows) else ""
    # how to beat them
    gaps = s["gaps"]
    ctx["gaps_n"] = len(gaps)
    if gaps:
        top = s["per_type"][gaps[0]]
        ctx["top_gap"] = gaps[0]
        ctx["top_gap_members"] = join(top["weak_members"])
        ctx["top_gap_cover"] = f", and only {join(top['covered_by'])} can take it" if top["covered_by"] else ", and nobody on the team resists it"
        ctx["more_gaps_str"] = join([f"{g} ({s['per_type'][g]['weak_total']} weak)" for g in gaps[1:4]])
    very = [f"{r['species']} to {join([t for t, c in r['cells'].items() if c['verdict'] == 'very weak'])}"
            for r in rows if any(c["verdict"] == "very weak" for c in r["cells"].values())]
    ctx["very_weak_str"] = "; ".join(very) + (" (four times the damage)" if very else "")
    if s["bring"] in ("physical", "special"):
        soft = s["soft_members"][s["bring"]]
        ctx.update(bring=s["bring"], soft_str=join(soft), soft_verb="is" if len(soft) == 1 else "are",
                   soft_label=cfg["bulk"]["labels"][s["bring"]])
    else:
        ctx["bring"] = "either"
    abil = []
    for r in rows:
        changed = [t for t, c in r["cells"].items() if c.get("ability")]
        if changed:
            abil.append(f"{r['species']}'s {r['ability']} changes {join(changed)} (from {join(sorted({r['cells'][t]['before_ability'] for t in changed}))} "
                        f"to {join(sorted({r['cells'][t]['verdict'] for t in changed}))})")
    ctx["ability_str"] = "; ".join(abil)
    if s["strengths"]:
        ctx["strengths_str"] = join(s["strengths"][:3], "or")
        ctx["strength_cover_str"] = "; ".join(f"{len(s['per_type'][t]['covered_by'])} of {len(rows)} resist {t}"
                                              for t in s["strengths"][:3])
    # where rigidity or recklessness leaves a gap
    sig = {k: {r["signal"]: r for r in v["signals"]} for k, v in sliders.items()}
    few = sig["rigidity"].get("few_attack_types")
    if few and few["members"]:
        ctx["few_types_str"] = join(few["members"])
        ctx["few_types_their"] = "its" if len(few["members"]) == 1 else "their"
    choice = sig["rigidity"].get("choice")
    if choice and choice["members"]:
        ctx["choice_str"] = join(choice["members"])
    gambles = []
    for b in team:
        bits = []
        for m in b.moves:
            i = store.era.move_info(m, gen)
            if i["class"] == "status":
                continue
            r = cfg["signals"]["risk"]["risky"]
            if i["meta"] == "ohko":
                bits.append(f"{m} (one-hit KO, {i['accuracy']}%)")
            elif (i["accuracy"] or 100) < r["accuracy_below"]:
                bits.append(f"{m} ({i['accuracy']}%)")
            elif i["drain"] < 0:
                bits.append(f"{m} (recoil)")
            elif "user faints" in i["effect"].lower():
                bits.append(f"{m} (faints)")
        item = store.era.item_name(b.item) if b.item else None
        if item in cfg["signals"]["risk"]["risky"]["items"]:
            bits.append(item)
        if bits:
            gambles.append(f"{b.species}'s {join(bits)}")
    ctx["gamble_str"] = "; ".join(gambles)
    return ctx


def build_report(store, trainer_id, version_id=None, level=None):
    version = store.version(trainer_id, version_id)
    team = store.team(version)
    matrix = team_matrix(store, version, level=level, team=team)
    sliders = measure(store, version, matrix, team)
    tag_list = tags(store, version, team, matrix)
    clashes = nature_clashes(store, version, team)
    ctx = context(store, version, team, matrix, sliders, tag_list, clashes)
    book = Phrasebook(os.path.join(HERE, "phrases.json"))
    phrases = book.speak("report", ctx)
    plan = {sid: [p for p in phrases if p["section"] == sid] for sid, _ in SECTIONS}
    for sid, text in (version.overrides or {}).items():
        if sid in plan and isinstance(text, str):
            plan[sid] = [{"section": sid, "text": text, "rule": "override", "trigger": "per-trainer override"}]
    return {"schema": SCHEMA, "trainer": trainer_id, "trainer_name": ctx["trainer"], "version": version.id,
            "title": version.title, "game": version.game, "gen": GAME_GEN[version.game], "source": version.source,
            "status": version.status, "notes": store.trainers[trainer_id].notes + version.notes,
            "sliders": sliders, "tags": tag_list, "nature_clashes": clashes, "matrix": matrix, "plan": plan,
            "roles": version.roles, "overrides": version.overrides}


def exposure(store, mine, theirs, level=None):
    """Where your team is exposed against theirs: the attack types they carry against your rows, and their
    attacking side against your soft rows. Both read in their version's game."""
    them = store.version(*theirs)
    me = store.version(*mine)
    gen = GAME_GEN[them.game]
    my_team = store.team(me)
    their_team = store.team(them)
    from types import SimpleNamespace
    lens = SimpleNamespace(**{**me.__dict__, "game": them.game})   # read your six in their game's chart
    my_matrix = team_matrix(store, lens, level=level, team=my_team)
    carried = their_attacks(store, their_team, gen, store.config["exposure"]["min_power"])
    by_type = {}
    for who, move, t, _ in carried:
        by_type.setdefault(t, []).append(f"{move} ({who})")
    phys = sum(1 for a in carried if a[3] == "physical")
    spec = len(carried) - phys
    side = "physical" if phys >= 2 * spec else "special" if spec >= 2 * phys else "mixed"
    book = Phrasebook(os.path.join(HERE, "phrases.json"))
    rows, lines = [], []
    for r in my_matrix["rows"]:
        hits = []
        for t, throws in by_type.items():
            v = r["cells"][t]["verdict"]
            if v in ("weak", "very weak"):
                hits.append({"type": t, "verdict": v, "their_moves": throws})
        hits.sort(key=lambda h: (h["verdict"] != "very weak", h["type"]))
        soft_match = r["bulk"]["lean"] != "even" and r["bulk"]["lean"] == side
        ctx = {"member": r["species"], "soft_label": r["bulk"]["label"], "their_side": side, "soft_match": soft_match,
               "hits_str": "; ".join(f"{h['verdict']} to {h['type']}: they throw {join(h['their_moves'][:3])}" for h in hits)}
        said = book.speak("exposure", ctx)
        rows.append({"member": r["species"], "hits": hits, "bulk": r["bulk"], "soft_match": soft_match,
                     "lines": [p["text"] for p in said]})
        lines += [p["text"] for p in said]
    exposed = sorted(rows, key=lambda x: (-sum(2 if h["verdict"] == "very weak" else 1 for h in x["hits"]) - x["soft_match"]))
    return {"schema": "trainer-exposure/1", "mine": list(mine), "theirs": list(theirs), "game": them.game,
            "their_types": {t: v for t, v in sorted(by_type.items())}, "their_side": side,
            "rows": rows, "most_exposed": [x["member"] for x in exposed if x["hits"] or x["soft_match"]][:3], "lines": lines}


VERDICT_MARK = {"immune": "0", "resists": "½", "neutral": "·", "weak": "2×", "very weak": "4×"}


def render(rep):
    """The readable report (markdown)."""
    m = rep["matrix"]
    out = [f"# {rep['title']}", "",
           f"*{rep['trainer_name']} · {GAME_TITLE[rep['game']]} (Gen {rep['gen']}) · source: {rep['source']} · {rep['status']}*", ""]
    head = ["| Slider | Authored | Team reads | Note |", "|---|---|---|---|"]
    for k, v in rep["sliders"].items():
        lo, hi = v["poles"]
        a = "–" if v["authored"] is None else f"{v['authored']} ({hi if v['authored'] >= 50 else lo})"
        me = "no signal" if v["measured"] is None else f"{v['measured']}"
        note = f"reads {v['disagreement']['team_leans']}" if v["disagreement"] else (v["why"] or "")
        head.append(f"| {k.capitalize()} ({lo} ↔ {hi}) | {a} | {me} | {note} |")
    out += head + [""]
    if rep["tags"]:
        out += ["**Tags:** " + " · ".join(f"{t['name']}" + (f" ({join(t['detail'])})" if t['id'] != 'role' else "") for t in rep["tags"]), ""]
    for sid, title in SECTIONS:
        if rep["plan"][sid]:
            out += [f"## {title}", ""] + [f"- {p['text']}" for p in rep["plan"][sid]] + [""]
    out += ["## The matrix", "", "Their Pokémon down the side, attacking types across the top. "
            "0 immune · ½ resists · · neutral · 2× weak · 4× very weak; * means an ability changed it.", ""]
    types = m["types"]
    out.append("| Pokémon | Bulk | " + " | ".join(t[:3] for t in types) + " |")
    out.append("|---|---|" + "---|" * len(types))
    for r in m["rows"]:
        cells = [VERDICT_MARK[r["cells"][t]["verdict"]] + ("*" if r["cells"][t].get("ability") else "") for t in types]
        out.append(f"| **{r['species']}** Lv {r['level']} ({r['ability']}) | {r['bulk']['label']} | " + " | ".join(cells) + " |")
    s = m["summary"]
    out += ["", f"**Gaps:** {join(s['gaps']) or 'none'} · **Strengths:** {join(s['strengths']) or 'none'} · "
                f"**Bring:** {s['bring']} attackers ({s['soft']['physical']} physically soft, {s['soft']['special']} specially soft)", ""]
    flagged = [(r["species"], f) for r in m["rows"] for f in r["flags"]]
    reasons = [(r["species"], b) for r in m["rows"] for b in r["move_basis"] if b["basis"] != "this game"]
    if reasons or flagged:
        out += ["**Moves and reasons** (D-048):", ""]
        out += [f"- {sp}: {b['move']}: {b['reason']}" for sp, b in reasons]
        out += [f"- {sp}: ⚑ {f}" for sp, f in flagged]
        out.append("")
    used = sorted({u for r in m["rows"] for u in r["defaults_used"]})
    if used:
        out += [f"*Defaults where nothing is recorded: {'; '.join(used)}.*", ""]
    if rep["notes"]:
        out += ["**Notes:** " + " ".join(rep["notes"]), ""]
    return "\n".join(out)


def render_exposure(exp, store):
    me = store.version(*exp["mine"])
    them = store.version(*exp["theirs"])
    out = [f"# {me.title} vs {them.title}: where you're exposed", "",
           f"*Read in {GAME_TITLE[exp['game']]}'s type chart. " +
           (f"They attack mostly from the {exp['their_side']} side.*" if exp["their_side"] != "mixed" else
            "Their attacks are split between physical and special.*"), ""]
    out += [f"- {l}" for l in exp["lines"]] or ["- Nothing on their team hits your weak spots."]
    if exp["most_exposed"]:
        out += ["", f"**Most exposed:** {join(exp['most_exposed'])}."]
    return "\n".join(out) + "\n"
