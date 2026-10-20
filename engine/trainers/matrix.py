"""The matrix and bulk tags (docs/TRAINER_REPORT.md, step 2). No damage calculations and no simulation: the type
chart of the version's game, the build's ability, and the build's real stats.

- **The matrix:** their Pokémon down the side, the attacking types across the top. Each cell is a verdict (immune,
  resists, neutral, weak, very weak), chosen after the ability rewrites the multiplier (Levitate, Flash Fire, Thick
  Fat, Wonder Guard…). Rules and words live in trainers/config.json.
- **Bulk:** each row's physical bulk (HP x Defense) and special bulk (HP x Sp. Def), from its real stats, placed
  in the field: every fully evolved Pokémon of the generation at the row's level, on the default spread (the pool
  the role engine reads). A side is soft only when it sits low in the field and clearly below the other side, so
  HP counts: Snorlax's 65 Defense rides on 160 HP and still out-bulks most of the field physically. Both sides low
  is frail, both high is sturdy. A soft row's weak cells read "weak, and worse from physical attackers". Gen IV
  splits physical and special by move, so this is a row tag, not a column.
- **Team summary:** weaknesses and resistances counted per type; gaps (types that hit them hard) and strengths
  (types they handle); and which kind of attacker to bring, when enough of the team is soft on one side.

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


def field(store, gen, level):
    """The field's bulk at a level, sorted, cached on the store: the role engine's own pool."""
    from trainers.roles import RoleBook          # roles reads this module's `rewrite`
    cache = store.__dict__.setdefault("_bulk_field", {})
    if (gen, level) not in cache:
        pool = RoleBook(store).pool(gen, level)
        cache[(gen, level)] = {"physical": pool["bulk_physical"], "special": pool["bulk_special"]}
    return cache[(gen, level)]


def bulk_lean(stats, cfg, pool):
    """Where a row's physical and special bulk sit in the field (0-1), and the tag they earn."""
    from trainers.roles import _pct
    pct = {"physical": _pct(stats["hp"] * stats["def"], pool["physical"]),
           "special": _pct(stats["hp"] * stats["spd"], pool["special"])}
    low, high = sorted(pct, key=pct.get)
    gap = pct[high] - pct[low]
    if pct[low] < cfg["soft_below"] and gap >= cfg["gap_at_least"]:
        lean = low
    elif pct[high] < cfg["soft_below"]:
        lean = "frail"
    elif pct[low] >= cfg["sturdy_at"]:
        lean = "sturdy"
    else:
        lean = "even"
    return {"lean": lean, "label": cfg["labels"][lean], "def": stats["def"], "spd": stats["spd"],
            "physical_pct": round(pct["physical"], 2), "special_pct": round(pct["special"], 2), "gap": round(gap, 2)}


def row(store, build, game, level=None):
    """One Pokémon's row: its typing, ability, real stats, bulk lean and a verdict for every attacking type."""
    cfg = store.config
    gen = GAME_GEN[game]
    era = store.era
    types = era.types(build.species, gen)
    stats, lvl, used = store.stats(build, game, level)
    filled, _ = store.filled(build, gen)
    ability = filled["ability"]
    bulk = bulk_lean(stats, cfg["bulk"], field(store, gen, lvl))
    cells = {}
    for t in era.chart(gen):
        base = era.multiplier(t, types, gen)
        mult, changed = rewrite(base, t, ability, cfg["abilities"])
        v = verdict(mult, cfg["verdicts"]["rules"])
        cell = {"verdict": v, "multiplier": mult}
        if changed:
            cell["ability"] = ability
            cell["before_ability"] = verdict(base, cfg["verdicts"]["rules"])
        if bulk["lean"] in ("physical", "special") and v in cfg["bulk"]["cell_note_on"]:
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
    soft = {k: sum(r["bulk"]["lean"] == k for r in rows) for k in ("physical", "special", "even", "frail", "sturdy")}
    margin, least = t["bring_margin"], t["bring_at_least"]
    bring = ("physical" if soft["physical"] >= least and soft["physical"] - soft["special"] >= margin else
             "special" if soft["special"] >= least and soft["special"] - soft["physical"] >= margin else "either")
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
