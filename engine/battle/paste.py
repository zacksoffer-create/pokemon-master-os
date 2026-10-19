"""Showdown text in and out (scouting engine, layer 5): the format PKHeX imports and exports, Smogon publishes sets
in, and the Showdown teambuilder reads. A paste becomes builds (the same dicts canon/builds.json holds), so a pasted
team runs through every layer exactly like a canon one.
"""
import re

STAT_NAMES = {"hp": "HP", "atk": "Atk", "def": "Def", "spa": "SpA", "spd": "SpD", "spe": "Spe"}
STAT_KEYS = {v.lower(): k for k, v in STAT_NAMES.items()}


def _stats(text):
    out = {}
    for part in text.split("/"):
        m = re.match(r"\s*(\d+)\s+(\w+)\s*$", part)
        if m and m.group(2).lower() in STAT_KEYS:
            out[STAT_KEYS[m.group(2).lower()]] = int(m.group(1))
    return out


def parse(text):
    """Showdown text → [build dict] with species, moves and whatever else the set gives."""
    builds = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [l.strip() for l in block.strip().splitlines() if l.strip() and not l.strip().startswith("===")]
        if not lines:
            continue
        head, item = (lines[0].split(" @ ", 1) + [None])[:2]
        b = {"moves": []}
        if item:
            b["item"] = item.strip()
        gender = re.search(r"\((M|F)\)\s*$", head)
        if gender:
            b["gender"] = gender.group(1)
            head = head[:gender.start()].strip()
        named = re.match(r"^(.*?)\s*\(([^()]+)\)\s*$", head)
        if named:
            b["nickname"], b["species"] = named.group(1).strip(), named.group(2).strip()
        else:
            b["species"] = head.strip()
        for line in lines[1:]:
            key, _, val = line.partition(":")
            k = key.strip().lower()
            if line.startswith("-"):
                mv = line[1:].strip()
                hp = re.match(r"Hidden Power\s*\[(\w+)\]", mv)
                b["moves"].append(f"Hidden Power {hp.group(1)}" if hp else mv)
            elif line.endswith("Nature"):
                b["nature"] = line[:-len("Nature")].strip()
            elif k == "ability":
                b["ability"] = val.strip()
            elif k == "level":
                b["level"] = int(val)
            elif k == "evs":
                b["evs"] = _stats(val)
            elif k == "ivs":
                b["ivs"] = _stats(val)
            elif k == "shiny":
                b["shiny"] = val.strip().lower() == "yes"
            elif k == "happiness":
                b["happiness"] = int(val)
        builds.append(b)
    return builds


def export(c, nickname=None):
    """A Combatant (or anything with its fields) → Showdown text. EVs and IVs print only where they differ from
    0 and 31, as Showdown writes them."""
    head = f"{nickname} ({c.species})" if nickname else c.species
    if c.item:
        head += f" @ {c.item}"
    lines = [head]
    if c.gen >= 3 and c.ability:
        lines.append(f"Ability: {c.ability}")
    if c.level != 100:
        lines.append(f"Level: {c.level}")
    if c.gen >= 3:
        evs = " / ".join(f"{c.evs[s]} {STAT_NAMES[s]}" for s in STAT_NAMES if (c.evs or {}).get(s))
        if evs:
            lines.append(f"EVs: {evs}")
        if c.nature:
            lines.append(f"{c.nature} Nature")
    ivs = " / ".join(f"{(c.ivs or {})[s]} {STAT_NAMES[s]}" for s in STAT_NAMES if (c.ivs or {}).get(s, 31) != 31)
    if ivs:
        lines.append(f"IVs: {ivs}")
    for m in c.moves:
        hp = re.match(r"Hidden Power (\w+)$", m)
        lines.append(f"- Hidden Power [{hp.group(1)}]" if hp else f"- {m}")
    return "\n".join(lines)
