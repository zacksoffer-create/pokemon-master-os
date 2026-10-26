"""Tags, badges, archetypes and qualifications for a build (docs/specs/TAGS_BADGES_ARCHETYPES_QUALIFICATIONS.md).

    python3 -I engine/trainers/recognition.py --calibrate      # docs/recognition/CALIBRATION.md: the thresholds against the field
    python3 -I engine/trainers/recognition.py --parity OUT [ids]  # Python's reads for app/test_recognition_parity.mjs

A pure function of the build, its team-role read (trainers/team_roles.py, which carries the Ace fights' damage
evidence) and the rules in trainers/recognition.json. It describes what the mechanics already do and changes nothing
in a fight. The browser copy is app/web/29_recognition.html, held to this file by app/test_recognition_parity.mjs.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
ROOT = os.path.dirname(ENGINE)
sys.path.insert(0, ENGINE)

import rules  # noqa: E402

STATS = ("hp", "atk", "def", "spa", "spd", "spe")
POOL_NAME = {"elite_four": "Elite Four", "champion": "Champion"}
MEASURE = {"2hko": "2HKO", "ohko": "OHKO"}


def load_config():
    with open(os.path.join(HERE, "recognition.json"), encoding="utf-8") as fh:
        return json.load(fh)


def pct(x):
    return round(100 * x)


def stat_of(base, s, gen, level, nature_up, nature_down, iv, ev, shedinja=False):
    """One stat, the way trainers/era.py Era.stats computes it (the formula checked against Smogon's calc)."""
    if gen <= 2:
        iv = 2 * (iv // 2)
    core = (2 * base + iv + ev // 4) * level // 100
    if s == "hp":
        return 1 if shedinja else core + level + 10
    return (core + 5) * (110 if s == nature_up else 90 if s == nature_down else 100) // 100


def full(base, s, gen, level):
    """What a base-`base` Pokémon reaches in this stat with full investment (IV 31, 252 EVs, a helpful nature)."""
    return stat_of(base, s, gen, level, s if gen >= 3 and s != "hp" else None, None, 31, 252)


class Recognition:
    def __init__(self, store=None, cfg=None):
        from trainers.model import Store
        from trainers.roles import RoleBook
        self.store = store or Store()
        self.era = self.store.era
        self.book = RoleBook(self.store)
        self.cfg = cfg or load_config()

    # --- the stats --------------------------------------------------------------------------------------------
    def natures(self, nature, gen):
        return self.era.nature(nature) if gen >= 3 and nature else (None, None)

    def stats_of(self, species, gen, level, nature, ivs, evs):
        """Era.stats' formula over the calculator's base stats for that generation (rules.species, the same table the
        browser reads), so alternate forms get their own stats (B15)."""
        base = rules.species(gen, species)["bs"]
        ivs = {s: (ivs or {}).get(s, 31) for s in STATS}
        evs = {s: (evs or {}).get(s, 0) for s in STATS}
        up, down = self.natures(nature, gen)
        if gen <= 2:
            dv = {s: ivs[s] // 2 for s in STATS}
            dv["spd"] = dv["spa"]
            dv["hp"] = (dv["atk"] % 2) * 8 + (dv["def"] % 2) * 4 + (dv["spe"] % 2) * 2 + dv["spa"] % 2
            ivs = {s: 2 * dv[s] for s in STATS}
            evs["spd"] = evs["spa"]
        shed = rules.species(gen, species)["name"].lower().startswith("shedinja")
        return {s: stat_of(base[s], s, gen, level, up, down, ivs[s], evs[s], shed) for s in STATS}

    def least_evs(self, species, gen, level, nature, ivs, evs, s, target):
        """The fewest EVs in stat `s` that reach `target`, the rest of the spread as it is; with a helpful nature too if
        the current one can't. None when nothing reaches it."""
        for nat_note, nat in ((None, nature), ("a +" + {"atk": "Atk", "def": "Def", "spa": "SpA", "spd": "SpD", "spe": "Spe"}.get(s, s) + " nature", None)):
            if nat_note:
                if gen < 3 or s == "hp" or self.natures(nature, gen)[0] == s:
                    return None
                nat = {"atk": "Adamant", "def": "Impish", "spa": "Modest", "spd": "Careful", "spe": "Jolly"}[s]
            for e in range(0, 253, 4):
                trial = {**(evs or {}), s: e}
                if self.stats_of(species, gen, level, nat, ivs, trial)[s] >= target:
                    left = None
                    if gen >= 3:
                        left = 510 - (sum((evs or {}).values()) - (evs or {}).get(s, 0) + e)
                    return {"evs": e, "nature": nat_note, "left": left}
        return None

    def stats_part(self, b, gen, level):
        sc = self.cfg["stats"]
        if not b.evs:
            return {"no_evs": True}
        st = self.stats_of(b.species, gen, level, b.nature, b.ivs, b.evs)
        out = {}
        for s, bases in sc["bases"].items():
            th = [full(x, s, gen, level) for x in bases]
            tier = sum(1 for t in th if st[s] >= t) - 1
            nxt = None
            if tier + 1 < len(th):
                need = th[tier + 1]
                nxt = {"tier": self.cfg["tiers"][tier + 1], "at": need, "base": bases[tier + 1],
                       "how": self.least_evs(b.species, gen, level, b.nature, b.ivs, b.evs, s, need)}
            out[s] = {"name": sc["names"][s], "value": st[s], "thresholds": th,
                      "tier": self.cfg["tiers"][tier] if tier >= 0 else None, "next": nxt}
        return out

    def speed_part(self, b, gen, level, ability, item, moves):
        sp = self.cfg["speed"]
        if not b.evs:
            return {"no_evs": True}
        v = self.stats_of(b.species, gen, level, b.nature, b.ivs, b.evs)["spe"]
        ms = [{"base": x, "at": full(x, "spe", gen, level) + 1} for x in sp["milestones"]]
        for m in ms:
            m["clears"], m["ties"] = v >= m["at"], v == m["at"] - 1
        cleared = [m["base"] for m in ms if m["clears"]]
        tier = sum(1 for x in sp["tiers"] if x in cleared) - 1
        nxt = None
        if tier + 1 < len(sp["tiers"]):
            base = sp["tiers"][tier + 1]
            at = next(m["at"] for m in ms if m["base"] == base)
            nxt = {"tier": self.cfg["tiers"][tier + 1], "at": at, "base": base,
                   "how": self.least_evs(b.species, gen, level, b.nature, b.ivs, b.evs, "spe", at)}
        boosted = []
        if item == "Choice Scarf":
            boosted.append(("Choice Scarf", v * 3 // 2))
        for mv, n in (("Dragon Dance", 1), ("Agility", 2), ("Rock Polish", 2)):
            if mv in moves:
                boosted.append((f"{mv} ({'+' + str(n)})", v * (2 + n) // 2))
        if ability in ("Swift Swim", "Chlorophyll"):
            boosted.append((f"{ability} in its weather", v * 2))
        prio = [mv for mv in moves if rules.move(gen, mv)["priority"] > 0 and rules.category(gen, mv) != "Status"]
        return {"name": sp["name"], "value": v, "milestones": ms, "tier": self.cfg["tiers"][tier] if tier >= 0 else None,
                "next": nxt, "boosted": [{"how": h, "value": x, "clears": [m["base"] for m in ms if x >= m["at"]]} for h, x in boosted],
                "priority": prio, "paralyzed": v // 4}

    # --- damage badges, from the Ace fights ---------------------------------------------------------------------
    def badges_part(self, ev):
        """Damage badges from the fight evidence. Tiers build on each other: a tier counts only with every one below."""
        D = self.cfg["damage"]["badges"]
        tiers = self.cfg["tiers"]
        out = {}
        foes = ev["foes"]
        for bid, d in D.items():
            if "both" in d:
                continue
            of, extra, x = foes, {}, None
            if d["from"] in ("physical", "special", "priority"):
                x = ev.get(d["from"])
                if not x:
                    extra = {"missing": True}
                    hit = lambda t: False
                    count = lambda t: 0
                elif d["from"] == "priority":
                    extra = {"move": x["move"], "by_hp": {h: x[h] for h in ("100", "50", "25")}}
                    count = lambda t: x[str(t["hp"])]
                    hit = lambda t: bool(of) and x[str(t["hp"])] / of >= t["share"]
                else:
                    extra = {"move": x["move"], "near": x["near_2hko"], "ohko": x["ohko"], "2hko": x["2hko"]}
                    count = lambda t: x[t["measure"]]
                    hit = lambda t: bool(of) and x[t["measure"]] / of >= t["share"]
            else:
                x = ev["taken"][d["from"].split(".")[1]]
                of = x["hits"]
                count = lambda t: x["takes"][str(d["takes"])]
                hit = lambda t: bool(of) and x["takes"][str(d["takes"])] / of >= t
            tier = -1
            for i, t in enumerate(d["tiers"]):
                if not hit(t):
                    break
                tier = i
            shown = d["tiers"][max(tier, 0)]
            n = count(shown)
            share = round(n / of, 4) if of else 0.0
            if isinstance(shown, dict):
                extra.update({k: v for k, v in shown.items() if k != "share"})
            nxt = None
            if tier + 1 < len(d["tiers"]):
                t = d["tiers"][tier + 1]
                nxt = {"tier": tiers[tier + 1], "needs": t if isinstance(t, dict) else {"share": t}}
            out[bid] = {"name": d["name"], "tier": tiers[tier] if tier >= 0 else None, "share": share, "n": n, "of": of,
                        **extra, "next": nxt}
        for bid, d in D.items():
            if "both" in d:
                ts = [out[x]["tier"] for x in d["both"]]
                tier = min(tiers.index(t) for t in ts) if all(ts) else -1
                out[bid] = {"name": d["name"], "tier": tiers[tier] if tier >= 0 else None, "of_badges": d["both"], "next": None}
        for bid, x in out.items():
            x["says"] = self.says(D[bid], x)
        return out

    @staticmethod
    def says(d, x):
        if "both" in d:
            return d["says"]
        if x.get("missing"):
            return d["none"]
        return d["says"].format(share=f"{pct(x['share'])}%", n=x["n"], of=x["of"], move=x.get("move", ""), hp=x.get("hp", ""),
                                measure=MEASURE.get(x.get("measure"), ""))

    # --- v2 (D-078): the kit badges, read from the build's own moves and item ----------------------------------------
    def kit_part(self, moves, item, gen):
        K, tiers = self.cfg["kit"], self.cfg["tiers"]
        su = K["sustain"]
        has = lambda names: [m for m in moves if m in names]
        held = item if item in su["items"] else None
        drain, rest, rel = has(su["drain"]), has(su["rest"]), has(su["reliable"])
        level = 4 if rel and held else 3 if rel else 2 if rest else 1 if (held or drain) else 0
        which = {4: rel, 3: rel, 2: rest, 1: drain}.get(level, [])
        says = su["says"][level - 1].format(item=held or "nothing", moves=", ".join(which) or "no move") if level else su["none"]
        out = {"sustain": {"name": su["name"], "tier": tiers[level - 1] if level else None, "level": level, "says": says,
                           "next": {"tier": tiers[level], "needs": ["a passive or draining heal", "Rest or Wish", "a reliable recovery move",
                                                                     "reliable recovery and Leftovers"][level]} if level < 4 else None}}
        ut = K["utility"]
        jobs = []
        for job, cats in ut["jobs"].items():
            if any(self.book.move(m, gen)["categories"] & set(cats) for m in moves):
                jobs.append(job)
        n = len(jobs)
        t = max((i for i, need in enumerate(ut["tiers"]) if n >= need), default=-1)
        out["utility"] = {"name": ut["name"], "tier": tiers[t] if t >= 0 else None, "n": n, "jobs": jobs,
                          "says": ut["says"].format(n=n, jobs=", ".join(jobs)) if n else ut["none"],
                          "next": {"tier": tiers[t + 1], "needs": f"{ut['tiers'][t + 1]} support jobs"} if t + 1 < len(ut["tiers"]) else None}
        return out

    # --- tags, qualifications, archetype --------------------------------------------------------------------------
    def tags_part(self, signals):
        out = []
        for t in self.cfg["tags"]["list"]:
            ok = (all((signals.get(k) or 0) >= v for k, v in t["all"].items()) if "all" in t else
                  any((signals.get(k) or 0) >= 1 for k in t["any"]))
            if ok:
                out.append({"id": t["id"], "name": t["name"], **({"level": signals.get(t["level"]) or 0} if t.get("level") else {})})
        return out

    def quals_part(self, read):
        ace = next(r for r in read["roles"] if r["role"] == "ace")
        nums = ace["numbers"]
        out = []
        for q in self.cfg["qualifications"]["list"]:
            if q.get("from") == "team_role":
                out.append({"id": q["id"], "name": q["name"], "earned": ace["earned"], "status": q["status"],
                            "why": ace["why"]})
                continue
            checks = [(k[:-len("_at_least")], v) for k, v in q.items() if k.endswith("_at_least")]
            earned = all(nums[f"{k}_rate"] >= v for k, v in checks)
            out.append({"id": q["id"], "name": q["name"], "earned": earned, "status": q["status"],
                        "why": [f"beats {pct(nums[f'{k}_rate'])}% of {nums[f'{k}_n']} {POOL_NAME[k]} Pokémon (needs {pct(v)}%)"
                                for k, v in checks]})
        return out

    def archetype_part(self, read, types, tags, badges, quals):
        a = self.cfg["archetype"]
        sl = read["second_layer"]
        if read["name"]["match"] >= a["ladder_at_least"]:
            functional, src = read["name"]["text"], "ladder"
        else:
            p, s = sl["primary"], sl["secondary"]
            hybrid = s and p["score"] - s["score"] <= a["hybrid_within"] and s["score"] > 0
            functional = p["name"] + (f" / {s['name']}" if hybrid else "")
            src = "role engine" + (" (hybrid)" if hybrid else "")
        have_tags = {t["id"] for t in tags}
        tiers = self.cfg["tiers"]
        tier_of = {k: v["tier"] for k, v in badges.items()}
        earned_q = {q["id"] for q in quals if q["earned"]}
        sig = []
        for d in self.cfg["signature"]["list"]:
            need, unmet = d["needs"], []
            unmet += [f"a {t} type" for t in need.get("types", []) if t not in types]
            unmet += [f"the {self.tag_name(t)} tag" for t in need.get("tags", []) if t not in have_tags]
            for bid, t in need.get("badges", {}).items():
                have = tier_of.get(bid)
                if have is None or tiers.index(have) < tiers.index(t):
                    unmet.append(f"{self.badge_name(bid)} {t}" + (f" (has {have})" if have else ""))
            unmet += [f"{q}" for q in need.get("qualifications", []) if q not in earned_q]
            sig.append({"id": d["id"], "name": d["name"], "status": d["status"], "enabled": d["enabled"],
                        "earned": not unmet and d["enabled"], "met": not unmet, "unmet": unmet})
        return {"functional": functional, "from": src, "primary": sl["primary"]["name"],
                "nearby": [{"name": x["name"], "score": x["score"], "gap": round(sl["primary"]["score"] - x["score"], 4)} for x in sl["top"][1:4]],
                "signature": sig}

    def tag_name(self, tid):
        return next((t["name"] for t in self.cfg["tags"]["list"] if t["id"] == tid), tid)

    def badge_name(self, bid):
        if bid == "speed":
            return self.cfg["speed"]["name"]
        if bid in self.cfg.get("kit", {}):
            return self.cfg["kit"][bid]["name"]
        if bid in self.cfg["stats"]["names"]:
            return self.cfg["stats"]["names"][bid]
        return self.cfg["damage"]["badges"][bid]["name"]

    # --- the whole read -----------------------------------------------------------------------------------------
    def read(self, b, rd):
        """b: the Build; rd: its team-role read (with evidence)."""
        if not rd or rd.get("error"):
            return {"error": (rd or {}).get("error", "no team-role read")}
        if "evidence" not in rd:
            return {"error": "this read was stored before the fights kept their damage evidence (rebuild the team roles)"}
        game, gen, level = rd["game"], rd["gen"], self.cfg["level"]
        from trainers.model import Build
        filled = Build(**{**b.__dict__, "moves": list(rd["moves"]), "level": level})
        cl = self.book.classify(filled, game, level)
        sp = rules.species(gen, b.species)
        ability = b.ability or (rules.abilities(gen, b.species) or [None])[0] if gen >= 3 else None
        stats = self.stats_part(b, gen, level)
        speed = self.speed_part(b, gen, level, ability, b.item, rd["moves"])
        badges = self.badges_part(rd["evidence"])
        for s, x in stats.items():
            if isinstance(x, dict) and x.get("tier"):
                badges[s] = {"name": x["name"], "tier": x["tier"], "says": f"{x['name']} {x['value']} at level {level}", "next": x["next"]}
        if speed.get("tier"):
            badges["speed"] = {"name": speed["name"], "tier": speed["tier"], "says": f"Speed {speed['value']} at level {level}", "next": speed["next"]}
        for k, x in self.kit_part(list(rd["moves"]), b.item, gen).items():
            badges[k] = x
        tags = self.tags_part(cl["signals"])
        quals = self.quals_part(rd)
        arch = self.archetype_part(rd, sp["types"], tags, badges, quals)
        return {"version": self.cfg["version"], "game": game, "gen": gen, "types": sp["types"], "stats": stats, "speed": speed,
                "badges": badges, "tags": tags, "qualifications": quals, "archetype": arch}


def summary(r):
    """One line for a saved version's record: archetype; badges at a tier; qualifications earned (recognition@version)."""
    if r.get("error"):
        return ""
    sig = [s["name"] for s in r["archetype"]["signature"] if s["earned"]]
    bad = [f"{v['name']} {v['tier']}" for v in r["badges"].values() if v.get("tier")]
    q = [x["name"] for x in r["qualifications"] if x["earned"]]
    return "; ".join(x for x in [" / ".join(sig + [r["archetype"]["functional"]]), ", ".join(bad), ", ".join(q)] if x) + f" (recognition@{r['version']})"


def calibrate():
    """docs/recognition/CALIBRATION.md: each threshold against the fully evolved field, and how many of the stored
    builds reach each tier, so the provisional numbers can be judged before they're adopted (spec Part III §8)."""
    from trainers.model import Store
    store = Store()
    rec = Recognition(store)
    cfg = rec.cfg
    with open(os.path.join(ENGINE, "app", "data", "roles4.json"), encoding="utf-8") as fh:
        pack = json.load(fh)
    from trainers.team_roles import all_builds
    builds = {b.id: b for b, _ in all_builds(store)}
    lines = ["# Recognition calibration", "",
             "Generated by `python3 -I engine/trainers/recognition.py --calibrate` from trainers/recognition.json "
             f"(version {cfg['version']}) and the stored team-role reads (app/data/roles4.json, built {pack.get('built')}). "
             "The thresholds are the spec's proposals; this shows where they fall so they can be adjusted.", ""]
    # 1. stat thresholds against the Gen IV fully evolved field at full investment
    gen, level = 4, cfg["level"]
    field = []
    for x in rec.era.fully_evolved(gen):
        try:
            field.append(rec.era.base_stats(x, gen))
        except (KeyError, IndexError):
            continue
    lines += ["## Stat thresholds against the Gen IV fully evolved field", "",
              f"Each fully evolved Gen I-IV Pokémon ({len(field)}) at level {level} with full investment in that stat "
              "(IV 31, 252 EVs, a helpful nature). The share is how many reach the threshold.", "",
              "| Stat | Threshold (base) | Field share reaching it |", "|---|---|---|"]
    for s, bases in cfg["stats"]["bases"].items():
        vals = [full(x[s], s, gen, level) for x in field]
        for b in bases:
            t = full(b, s, gen, level)
            share = sum(1 for v in vals if v >= t) / len(vals) if vals else 0
            lines.append(f"| {cfg['stats']['names'][s]} | {t} (base {b}) | {pct(share)}% |")
    lines += ["", "Speed milestones (one point above a base-B Pokémon with a +Speed nature):", "",
              "| Milestone | Field share that can outrun it at full investment |", "|---|---|"]
    vals = [full(x["spe"], "spe", gen, level) for x in field]
    for b in cfg["speed"]["milestones"]:
        t = full(b, "spe", gen, level) + 1
        lines.append(f"| {t} (base {b}) | {pct(sum(1 for v in vals if v >= t) / len(vals)) if vals else 0}% |")
    # 2. how many stored builds reach each tier
    from collections import Counter
    counts = {}
    n = 0
    for bid, rd in pack["reads"].items():
        b = builds.get(bid)
        if not b or rd.get("error") or "evidence" not in rd:
            continue
        r = rec.read(b, rd)
        if r.get("error"):
            continue
        n += 1
        for k, v in r["badges"].items():
            counts.setdefault(k, Counter())[v.get("tier")] += 1
        for q in r["qualifications"]:
            counts.setdefault("q:" + q["id"], Counter())[q["earned"]] += 1
    lines += ["", f"## Tiers across the {n} stored builds", "",
              "| Badge | " + " | ".join(cfg["tiers"]) + " | none |", "|---|" + "---|" * (len(cfg["tiers"]) + 1)]
    for k in sorted(c for c in counts if not c.startswith("q:")):
        c = counts[k]
        lines.append(f"| {rec.badge_name(k)} | " + " | ".join(str(c.get(t, 0)) for t in cfg["tiers"]) + f" | {n - sum(c.get(t, 0) for t in cfg['tiers'])} |")
    lines += ["", "| Qualification | earned |", "|---|---|"]
    for k in sorted(c for c in counts if c.startswith("q:")):
        lines.append(f"| {k[2:]} | {counts[k].get(True, 0)} of {n} |")
    os.makedirs(os.path.join(ROOT, "docs", "recognition"), exist_ok=True)
    with open(os.path.join(ROOT, "docs", "recognition", "CALIBRATION.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    tiers = {k: {"name": rec.badge_name(k), "counts": {t: c.get(t, 0) for t in cfg["tiers"]},
                 "none": n - sum(c.get(t, 0) for t in cfg["tiers"])} for k, c in sorted(counts.items()) if not k.startswith("q:")}
    quals = {next(q["name"] for q in cfg["qualifications"]["list"] if q["id"] == k[2:]): counts[k].get(True, 0)
             for k in sorted(counts) if k.startswith("q:")}
    with open(os.path.join(ENGINE, "data_manifest", "recognition_calibration.json"), "w", encoding="utf-8") as fh:
        json.dump({"version": cfg["version"], "builds": n, "built": pack.get("built"), "tiers": tiers, "qualifications": quals}, fh,
                  ensure_ascii=False, indent=1, sort_keys=True)
    print(f"docs/recognition/CALIBRATION.md: {n} builds")


def parity(out_path, ids=None, reads_path=None):
    """Python's recognition for every stored build (or `ids`), each with the read it came from, so the browser reads
    exactly the same input. `reads_path`: a team_roles.py --parity file instead of the stored pack."""
    from trainers.model import Store
    from trainers.team_roles import all_builds
    store = Store()
    rec = Recognition(store)
    with open(reads_path or os.path.join(ENGINE, "app", "data", "roles4.json"), encoding="utf-8") as fh:
        pack = json.load(fh)
    res = []
    for b, game in all_builds(store):
        if ids and b.id not in ids:
            continue
        rd = pack["reads"].get(b.id)
        if not rd or "evidence" not in rd:
            continue
        r = rec.read(b, rd)
        res.append({"build": {k: v for k, v in b.__dict__.items() if v not in (None, [], {}, "")}, "read_id": b.id,
                    "read": rd, "recognition": r, "summary": summary(r)})
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False)
    print(f"{len(res)} builds")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--calibrate"]:
        calibrate()
    elif sys.argv[1:2] == ["--parity"]:
        parity(sys.argv[2], sys.argv[3].split(",") if len(sys.argv) > 3 and sys.argv[3] else None,
               sys.argv[4] if len(sys.argv) > 4 else None)
    else:
        print(__doc__)
