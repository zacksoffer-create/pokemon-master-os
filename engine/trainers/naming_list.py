"""Every name the build-name ladder can make, with a generated name for each (v2, D-078; docs/design/V2_PLAN.md §7).

    python3 -I engine/trainers/naming_list.py      # docs/naming/ALL_COMBINATIONS.md, all_combinations.csv.gz, proposed_words.json

Zack, 2026-10-25: "I do want that massive list of every single combination of all of those things that exist ... so
that we can come up with names for all of these things. With that being said, I do want that to be mainly generated."

A build's name is made of words, one per slot of its band (trainers/team_roles.json → naming):
| Band | Slots |
|---|---|
| 0.9 and up | type, noun |
| 0.8 and up | moveset, type, noun |
| 0.7 and up | team role, moveset, type, noun |
| 0.6 and up | base-stat band, team role, moveset, type, noun |

The noun is the role engine's primary role, or a hybrid when two or three roles score 0.8 or more. A hybrid needs a
primary of 0.8 or more, so it only appears in the top two bands.

This writes three things:
- **every word a slot can take**, with a generated proposal (proposed_words.json, class creative);
- **every combination** with the name those proposals make (the .csv.gz: single roles and every pair of roles as
  hybrids, plus the triples builds actually use);
- **the combinations in use** among the stored reads, with how many builds have each.

Nothing here is applied: a word becomes real only when Zack puts it in team_roles.json → naming.words, which the app
and the docs read (then `python3 -I engine/trainers/team_roles.py --words`).
"""
import csv
import gzip
import io
import itertools
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
ROOT = os.path.dirname(ENGINE)
OUT = os.path.join(ROOT, "docs", "naming")
sys.path.insert(0, ENGINE)

TYPES = ["Normal", "Fire", "Water", "Grass", "Electric", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug",
         "Rock", "Ghost", "Dragon", "Dark", "Steel"]
# The generated proposals: one evocative word per slot value, written to read left to right as a title
# ("Crowned Rising Ember Berserker"). Creative class: Blackthorn's suggestions, for Zack to keep, change or replace.
PROPOSED = {
    "type": {"Normal": "Wild", "Fire": "Ember", "Water": "Tidal", "Grass": "Verdant", "Electric": "Volt", "Ice": "Frost",
             "Fighting": "Martial", "Poison": "Venom", "Ground": "Earthen", "Flying": "Sky", "Psychic": "Mind", "Bug": "Hive",
             "Rock": "Stone", "Ghost": "Phantom", "Dragon": "Wyrm", "Dark": "Shadow", "Steel": "Iron"},
    "noun": {"physical_setup_sweeper": "Berserker", "special_setup_sweeper": "Sorcerer", "mixed_setup_sweeper": "Spellblade",
             "wallbreaker": "Siegebreaker", "revenge_killer": "Avenger", "late_game_cleaner": "Closer", "lead_attacker": "Vanguard",
             "bulky_attacker": "Juggernaut", "choice_locked_attacker": "Zealot", "weather_sweeper": "Stormrider",
             "physical_wall": "Bulwark", "special_wall": "Aegis", "tank": "Bastion", "bulky_setup": "Colossus",
             "status_absorber": "Absorber", "check_counter": "Warden", "hazard_setter": "Sapper", "hazard_remover": "Groundskeeper",
             "cleric": "Cleric", "screens_setter": "Shieldbearer", "weather_setter": "Stormcaller", "phazer": "Banisher",
             "status_spreader": "Plaguebearer", "staller": "Stonewall", "stallbreaker": "Disruptor", "trapper": "Hunter",
             "trick_room_setter": "Timebender", "tailwind_setter": "Windcaller", "fake_out_support": "Trickster",
             "spinblocker": "Gatekeeper", "pivot": "Rover", "baton_pass_starter": "Relay", "lure": "Ambusher", "suicide_lead": "Martyr"},
    "moveset": {"setup_attack": "Rising", "stall": "Enduring", "hazard_support": "Tactical", "status_attack": "Crippling",
                "priority_attack": "Swift", "coverage": "Versatile", "all_out_attack": "Relentless", "mixed_bag": "Wildcard"},
    "team_role": {"ace": "Crowned", "sweeper": "Sweeping", "support": "Steadfast", "wall": "Unyielding", "tank": "Battle-Hardened",
                  "none": "Untested"},
    "bst": {"bst_low": "Humble", "bst_mid": "Seasoned", "bst_high": "Noble", "bst_top": "Mythic"},
    "team_shape": {"trick_room": "Inversion", "weather": "Tempest", "baton_pass": "Relay", "hyper_offense": "Blitz",
                   "stall": "Fortress", "semi_stall": "Garrison", "bulky_offense": "Phalanx", "offense": "Vanguard",
                   "balance": "Equilibrium"},
    "unnamed": "Prospect",
}


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def hybrid_word(key, nouns):
    return "-".join(nouns[r] for r in key.split("+"))


def main():
    cfg = load(os.path.join(HERE, "team_roles.json"))
    roles = load(os.path.join(HERE, "roles.json"))["roles"]
    nm, words = cfg["naming"], cfg["naming"]["words"]
    role_ids = [k for k, v in roles.items() if isinstance(v, dict) and "family" in v]
    movesets = nm["movesets"]["order"]
    team_roles = [r for r in cfg["roles"]["_order"]] + ["none"]
    bsts = [b["id"] for b in nm["bst_bands"]]
    reads = load(os.path.join(ENGINE, "app", "data", "roles4.json"))["reads"]

    # the hybrids: every pair of roles, and the triples builds use today
    used_hybrids = Counter(t["id"] for r in reads.values() for t in r["name"]["tokens"] if t["slot"] == "hybrid")
    pairs = ["+".join(sorted(p)) for p in itertools.combinations(role_ids, 2)]
    triples = sorted(k for k in used_hybrids if k.count("+") == 2)
    nouns = PROPOSED["noun"]
    proposed = {k: dict(v) if isinstance(v, dict) else v for k, v in PROPOSED.items()}
    proposed["hybrid"] = {k: hybrid_word(k, nouns) for k in pairs + triples}
    # a word Zack has named wins over the proposal
    for slot, vals in words.items():
        if isinstance(vals, dict) and slot in proposed:
            for k, w in vals.items():
                if w:
                    proposed[slot][k] = w
        elif slot == "unnamed" and vals:
            proposed["unnamed"] = vals

    def label(slot, k):
        if slot == "type":
            return k
        if slot == "noun":
            return roles[k]["name"]
        if slot == "hybrid":
            return " + ".join(roles[x]["name"] for x in k.split("+"))
        if slot == "moveset":
            return movesets_label[k]
        if slot == "team_role":
            return cfg["roles"][k]["name"] if k != "none" else "no team role"
        if slot == "bst":
            return bst_label[k]
        return k
    movesets_label = {k: nm["movesets"][k]["label"] for k in movesets}
    bst_label = {b["id"]: (f"BST below {b['below']}" if b["below"] < 9999 else "BST 580 and up") for b in nm["bst_bands"]}

    # every combination, band by band
    singles = [("noun", r) for r in role_ids]
    hybrids = [("hybrid", h) for h in pairs + triples]
    bands = [(0.9, ["type", "noun"], singles + hybrids), (0.8, ["moveset", "type", "noun"], singles + hybrids),
             (0.7, ["team_role", "moveset", "type", "noun"], singles), (0.6, ["bst", "team_role", "moveset", "type", "noun"], singles)]
    values = {"type": TYPES, "moveset": movesets, "team_role": team_roles, "bst": bsts}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["band", "name", "bst", "team_role", "moveset", "type", "noun_slot", "noun", "means"])
    counts = {}
    for band, parts, noun_opts in bands:
        n = 0
        lists = [values[p] for p in parts if p != "noun"]
        for combo in itertools.product(*lists):
            got = dict(zip([p for p in parts if p != "noun"], combo))
            for slot, k in noun_opts:
                name = " ".join(proposed[p][got[p]] if p != "noun" else proposed[slot][k] for p in parts)
                means = " · ".join(label(p, got[p]) if p != "noun" else label(slot, k) for p in parts)
                w.writerow([band, name, got.get("bst", ""), got.get("team_role", ""), got.get("moveset", ""), got.get("type", ""), slot, k, means])
                n += 1
        counts[band] = n
    os.makedirs(OUT, exist_ok=True)
    with gzip.open(os.path.join(OUT, "all_combinations.csv.gz"), "wt", encoding="utf-8", compresslevel=9) as fh:
        fh.write(buf.getvalue())

    # the combinations in use today
    used = Counter()
    example = {}
    for bid, r in reads.items():
        toks = r["name"]["tokens"]
        key = tuple((t["slot"], t["id"]) for t in toks)
        used[key] += 1
        example.setdefault(key, f"{r['species']} ({bid})")
    with open(os.path.join(OUT, "proposed_words.json"), "w", encoding="utf-8") as fh:
        json.dump({"_note": "Generated by engine/trainers/naming_list.py (v2, D-078): one proposed word per naming slot value, "
                            "class creative. Nothing here is applied until Zack puts a word in trainers/team_roles.json → naming.words.",
                   "words": proposed}, fh, indent=1, ensure_ascii=False)

    def name_of(key):
        return " ".join(proposed["unnamed"] if s == "unnamed" else proposed[s].get(k, f"⟨{k}⟩") for s, k in key)

    def means_of(key):
        return " · ".join("below the last band" if s == "unnamed" else label(s, k) for s, k in key)

    total = sum(counts.values())
    L = ["# Every build name, generated", "",
         "Generated by `python3 -I engine/trainers/naming_list.py` (v2, D-078). Zack: *\"I do want that massive list of every "
         "single combination ... I do want that to be mainly generated.\"*", "",
         "A build's name is one word per slot of its band (`engine/trainers/team_roles.json` → `naming`). Below are:",
         "1. every word each slot can take, with a generated proposal;",
         "2. how many combinations each band makes;",
         "3. every combination in use among today's builds.", "",
         f"Every combination, **{total:,}** of them, is in `all_combinations.csv.gz`, with the name these proposals make. It "
         "opens in Excel once unzipped.", "",
         "The proposals are Blackthorn's (class creative). A word becomes real only when you put it in `naming.words`; then "
         "`python3 -I engine/trainers/team_roles.py --words` names every build in seconds.", "",
         "## How many combinations", "", "| Band | Slots | Combinations |", "|---|---|---|"]
    for band, parts, _ in bands:
        L.append(f"| {band:.1f} and up | {' + '.join(parts)} | {counts[band]:,} |")
    L += [f"| below 0.6 | one word for any build not yet named | 1 |", "",
          f"Nouns are the {len(role_ids)} roles of the role engine. Hybrids (two or three roles at 0.80 or more) are only "
          f"possible in the top two bands; all {len(pairs)} pairs are listed, and the {len(triples)} triples builds use today.", ""]
    titles = [("type", "Type (the build's first type)"), ("noun", "Role nouns (the role engine's primary role)"),
              ("moveset", "Moveset"), ("team_role", "Team role (the best one it earns)"), ("bst", "Base-stat-total band"),
              ("team_shape", "Team shapes (the team homepage)")]
    L += ["## Every word, with its generated proposal", ""]
    for slot, title in titles:
        named = words.get(slot) or {}
        L += [f"### {title}", "", "| id | means | proposal | named |", "|---|---|---|---|"]
        keys = values.get(slot) or (role_ids if slot == "noun" else list(PROPOSED[slot]))
        for k in keys:
            mean = label(slot, k) if slot != "team_shape" else cfg["team"]["shapes"][k]["label"]
            L.append(f"| `{k}` | {mean} | {proposed[slot][k]} | {'yes' if named.get(k) else ''} |")
        L.append("")
    L += ["### Hybrids in use today", "", "| id | means | proposal | builds |", "|---|---|---|---|"]
    for k, n in used_hybrids.most_common():
        L.append(f"| `{k}` | {label('hybrid', k)} | {proposed['hybrid'][k]} | {n} |")
    L += ["", f"One word for a build below the last band (`naming.words.unnamed`): proposal **{proposed['unnamed']}**.", "",
          "## Every combination in use today", "",
          f"{len(used)} different names across {len(reads)} builds (the build library, the trainer ecosystem and Smogon's sets), "
          "most used first.", "", "| Generated name | What it means | Builds | For example |", "|---|---|---|---|"]
    for key, n in used.most_common():
        L.append(f"| {name_of(key)} | {means_of(key)} | {n} | {example[key]} |")
    with open(os.path.join(OUT, "ALL_COMBINATIONS.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print(f"{total:,} combinations ({', '.join(f'{b}: {n:,}' for b, n in counts.items())}); {len(used)} in use across {len(reads)} builds -> {OUT}")


if __name__ == "__main__":
    main()
