"""The matrix and bulk tags (docs/TRAINER_REPORT.md, step 2). No damage calculations and no simulation: the type
chart of the version's game, the build's ability, and the build's real stats.

- **The matrix:** their Pokémon down the side, the attacking types across the top. Each cell is a verdict (immune,
  resists, neutral, weak, very weak), chosen after the ability rewrites the multiplier (Levitate, Flash Fire, Thick
  Fat, Wonder Guard…). Rules and words live in trainers/config.json.
- **Bulk lean:** each row compares its real Defense with its real Sp. Def (HP cancels out of HP x Def against
  HP x Sp. Def). A clear gap (15% by default) tags the row physically or specially soft, and its weak cells read
  "weak, and worse from physical attackers". Gen IV splits physical and special by move, so this is a row tag, not
  a column.
- **Team summary:** weaknesses and resistances counted per type; gaps (types that hit them hard) and strengths
  (types they handle); and which kind of attacker to bring, from the soft tags.

`team_matrix` returns plain data (for the report and for Part 2) and never prints.
"""
from trainers.era import GAME_GEN


def verdict(mult, rules):
    for r in rules:
        if "at_most" in r and mult <= r["at_most"]:
            return r["verdict"]
        if "below" in r and mult < r["below"]:
            return r["verdict"]
        if "at_most" not in r and "below" not in r:
            return r["verdict"]
    return rules[-1]["verdict"]


def rewrite(mult, attack_type, ability, table):
    """The multiplier after the ability, and whether the ability changed it."""
    rule = table.get(ability) if ability else None
    if not rule:
        return mult, False
    new = mult
    if attack_type in rule:
        new = mult * rule[attack_type] if rule[attack_type] else 0.0
    if "super_effective" in rule and mult > 1:
        new = mult * rule["super_effective"]
    if "not_super_effective" in rule and mult <= 1:
        new = rule["not_super_effective"]
    return new, new != mult


def bulk_lean(stats, cfg):
    d, s = stats["def"], stats["spd"]
    t = cfg["threshold"]
    if d <= s * (1 - t):
        lean = "physical"
    elif s <= d * (1 - t):
        lean = "special"
    else:
        lean = "even"
    return {"lean": lean, "label": cfg["labels"][lean], "def": d, "spd": s,
            "gap": round(1 - min(d, s) / max(d, s), 3) if max(d, s) else 0.0}


def row(store, build, game, level=None):
    """One Pokémon's row: its typing, ability, real stats, bulk lean and a verdict for every attacking type."""
    cfg = store.config
    gen = GAME_GEN[game]
    era = store.era
    types = era.types(build.species, gen)
    stats, lvl, used = store.stats(build, game, level)
    filled, _ = store.filled(build, gen)
    ability = filled["ability"]
    bulk = bulk_lean(stats, cfg["bulk"])
    cells = {}
    for t in era.chart(gen):
        base = era.multiplier(t, types, gen)
        mult, changed = rewrite(base, t, ability, cfg["abilities"])
        v = verdict(mult, cfg["verdicts"]["rules"])
        cell = {"verdict": v, "multiplier": mult}
        if changed:
            cell["ability"] = ability
            cell["before_ability"] = verdict(base, cfg["verdicts"]["rules"])
        if bulk["lean"] != "even" and v in cfg["bulk"]["cell_note_on"]:
            cell["note"] = cfg["bulk"]["worse_from"][bulk["lean"]]
        cells[t] = cell
    return {"build": build.id, "species": build.species, "nickname": build.nickname, "types": list(types),
            "ability": ability, "level": lvl, "stats": stats, "bulk": bulk, "cells": cells,
            "defaults_used": used, "moves": build.moves, "move_basis": store.move_basis(build, game),
            "flags": store.check(build, game), "source": build.source}


def summary(rows, types, cfg):
    t = cfg["team"]
    per_type = {}
    for ty in types:
        count = {"weak": 0, "very weak": 0, "neutral": 0, "resists": 0, "immune": 0}
        for r in rows:
            count[r["cells"][ty]["verdict"]] += 1
        weak = count["weak"] + count["very weak"]
        covered = count["resists"] + count["immune"]
        per_type[ty] = {**count, "weak_total": weak, "covered": covered,
                        "weak_members": [r["species"] for r in rows if r["cells"][ty]["verdict"] in ("weak", "very weak")],
                        "covered_by": [r["species"] for r in rows if r["cells"][ty]["verdict"] in ("resists", "immune")]}
    gaps = [ty for ty, c in per_type.items()
            if c["weak_total"] >= t["gap_if_weak_at_least"]
            or (c["weak_total"] >= t["gap_if_weak_and_uncovered_at_least"] and c["covered"] == 0)]
    gaps.sort(key=lambda ty: (-per_type[ty]["weak_total"], -per_type[ty]["very weak"], per_type[ty]["covered"]))
    strengths = [ty for ty, c in per_type.items()
                 if c["covered"] >= t["strength_if_resisted_at_least"]
                 and (c["weak_total"] == 0 or not t["strength_needs_no_weakness"])]
    strengths.sort(key=lambda ty: (-per_type[ty]["covered"], -per_type[ty]["immune"]))
    soft = {"physical": sum(r["bulk"]["lean"] == "physical" for r in rows),
            "special": sum(r["bulk"]["lean"] == "special" for r in rows),
            "even": sum(r["bulk"]["lean"] == "even" for r in rows)}
    margin = t["bring_margin"]
    bring = ("physical" if soft["physical"] - soft["special"] >= margin else
             "special" if soft["special"] - soft["physical"] >= margin else "either")
    return {"per_type": per_type, "gaps": gaps, "strengths": strengths, "soft": soft, "bring": bring,
            "soft_members": {k: [r["species"] for r in rows if r["bulk"]["lean"] == k] for k in ("physical", "special")}}


def team_matrix(store, version, level=None, team=None):
    """The whole matrix for a trainer version (or any team in a game): rows, the types across the top, a summary."""
    game = version.game
    gen = GAME_GEN[game]
    builds = team if team is not None else store.team(version)
    rows = [row(store, b, game, level) for b in builds]
    types = list(store.era.chart(gen))
    return {"trainer": version.trainer, "version": version.id, "title": version.title, "game": game, "gen": gen,
            "types": types, "rows": rows, "summary": summary(rows, types, store.config)}
