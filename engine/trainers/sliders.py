"""The trainer layer's measurements and the tags (docs/TRAINER_REPORT.md, step 3).

The four sliders (offense, rigidity, bond, risk) are authored: you set them from canon and judgment. This module
reads the team's data against each one and notes where they disagree. Every signal is a share of the team (how many
members show it), so a measured value sits on the same 0-100 scale as the authored one. A signal with no data on
the team (no recorded EVs, no friendship) is left out, and **missing data is never evidence**: a build with no item
isn't "not Choice-locked", and a plain Poké Ball says nothing about bond. A slider with no data at all reads "no
signal". Bond tends to read high, so the report reads it together with rigidity, never on its own.

Also here:
- **nature clashes:** a recorded nature that pulls against its trainer's sliders gets a line;
- **tags:** Cohesive (members sharing a move), type-dominant (members sharing a type) and the version's role tags.

All rules and thresholds come from trainers/config.json. Nothing here simulates a battle.
"""
from collections import Counter
from functools import lru_cache
from statistics import median

from trainers.era import GAME_GEN, STATS

POLES = {"offense": ("defensive", "offensive"), "rigidity": ("flexible", "rigid"), "bond": ("tool", "partnership"),
         "risk": ("percentage player", "gambler")}


@lru_cache(maxsize=None)
def speed_line(store, gen, level):
    """The median Speed of every fully evolved Pokémon of the generation, at this level, with the default spread."""
    d = store.config["defaults"]
    evs = {s: d["even_evs_each"] if d["evs"] == "even" else 0 for s in STATS}
    ivs = {s: d["ivs"] for s in STATS}
    out = []
    for sp in store.era.fully_evolved(gen):
        try:
            out.append(store.era.stats(sp, gen, level, None, ivs, evs)["spe"])
        except (KeyError, IndexError):
            continue
    return median(out)


def _share(members, test):
    """(share 0-100, the members that show it) over the members test can read; None when it can read none."""
    read = [(m, test(m)) for m in members]
    read = [(m, v) for m, v in read if v is not None]
    if not read:
        return None, []
    hits = [m["species"] for m, v in read if v]
    return round(100 * len(hits) / len(read)), hits


def measure(store, version, matrix, team):
    """{slider: {authored, why, measured, signals, disagreement}} for a version, from its team's data."""
    cfg = store.config["signals"]
    gen = GAME_GEN[version.game]
    era = store.era
    members = []
    for b, r in zip(team, matrix["rows"]):
        info = [era.move_info(m, gen) for m in b.moves]
        members.append({"species": b.species, "build": b, "row": r, "moves": list(zip(b.moves, info))})
    line = speed_line(store, gen, matrix["rows"][0]["level"]) if matrix["rows"] else 0

    def attack_heavy(m):
        s = m["row"]["stats"]
        return max(s["atk"], s["spa"]) > (s["def"] + s["spd"]) / 2

    def damage_moves(m):
        return sum(1 for _, i in m["moves"] if i["class"] != "status") >= cfg["offense"]["damage_moves"]["min_damaging"]

    def narrow(m):
        evs = m["build"].evs
        if not evs or not sum(evs.values()):
            return None
        top2 = sum(sorted(evs.values(), reverse=True)[:2])
        return top2 >= cfg["rigidity"]["narrow_evs"]["share"] * sum(evs.values())

    def few_types(m):
        types = {i["type"] for _, i in m["moves"] if i["class"] != "status"}
        return len(types) <= cfg["rigidity"]["few_attack_types"]["max_types"] if types else None

    def risky(m):
        r = cfg["risk"]["risky"]
        for name, i in m["moves"]:
            if i["class"] == "status":
                continue
            if (i["accuracy"] or 100) < r["accuracy_below"] or i["meta"] == "ohko" or i["drain"] < 0 \
                    or "user faints" in i["effect"].lower():
                return True
        return (era.item_name(m["build"].item) if m["build"].item else None) in r["items"]

    signals = {
        "offense": [("attack_heavy", attack_heavy), ("damage_moves", damage_moves),
                    ("fast", lambda m: m["row"]["stats"]["spe"] >= line)],
        "rigidity": [("choice", lambda m: None if not m["build"].item else
                      era.item_name(m["build"].item) in cfg["rigidity"]["choice"]["items"]),
                     ("narrow_evs", narrow), ("few_attack_types", few_types)],
        "bond": [("friendship", lambda m: None if m["build"].friendship is None
                  else m["build"].friendship >= cfg["bond"]["friendship"]["min"]),
                 ("ball", lambda m: True if m["build"].ball in cfg["bond"]["ball"]["balls"] else None),
                 ("ribbons", lambda m: True if m["build"].ribbons else None),
                 ("nickname", lambda m: True if m["build"].nickname else None)],
        "risk": [("risky", risky)],
    }
    out = {}
    gap = store.config["disagreement"]["gap"]
    for slider, tests in signals.items():
        read = []
        for name, test in tests:
            value, who = _share(members, test)
            if value is not None:
                read.append({"signal": name, "label": cfg[slider][name]["label"], "value": value, "members": who})
        measured = round(sum(r["value"] for r in read) / len(read)) if read else None
        authored = version.sliders.get(slider, {}).get("value")
        entry = {"authored": authored, "why": version.sliders.get(slider, {}).get("why"), "measured": measured,
                 "signals": read, "disagreement": None, "poles": POLES[slider]}
        if authored is not None and measured is not None and abs(authored - measured) >= gap:
            leaning = POLES[slider][1] if measured > authored else POLES[slider][0]
            entry["disagreement"] = {"gap": measured - authored, "team_leans": leaning,
                                     "because": [r for r in read if (r["value"] > authored) == (measured > authored)]}
        out[slider] = entry
    return out


def nature_clashes(store, version, team):
    out = []
    for rule in store.config["nature_clash"]["rules"]:
        value = version.sliders.get(rule["slider"], {}).get("value")
        if value is None or (rule["side"] == "high" and value < rule["at"]) or (rule["side"] == "low" and value > rule["at"]):
            continue
        for b in team:
            if not b.nature:
                continue
            up, down = store.era.nature(b.nature)
            if up in rule["raises_any"] and down in rule["lowers_any"]:
                out.append({"species": b.species, "nature": b.nature, "slider": rule["slider"],
                            "line": rule["line"].format(species=b.species, nature=b.nature)})
    return out


def tags(store, version, team, matrix):
    cfg = store.config["tags"]
    out = []
    moves = Counter(m for b in team for m in set(b.moves))
    shared = sorted((m for m, n in moves.items() if n >= cfg["cohesive"]["min_members"]), key=lambda m: (-moves[m], m))
    if shared:
        out.append({"id": "cohesive", "name": cfg["cohesive"]["name"], "detail": shared,
                    "members": {m: [b.species for b in team if m in b.moves] for m in shared}})
    types = Counter(t for r in matrix["rows"] for t in r["types"])
    dominant = sorted((t for t, n in types.items() if n >= cfg["type_dominant"]["min_members"]), key=lambda t: -types[t])
    if dominant:
        out.append({"id": "type_dominant", "name": cfg["type_dominant"]["name"], "detail": dominant,
                    "members": {t: [r["species"] for r in matrix["rows"] if t in r["types"]] for t in dominant}})
    for role in version.roles:
        if role in cfg["roles"]:
            out.append({"id": "role", "name": cfg["roles"][role]["name"], "detail": [role], "members": {}})
    return out
