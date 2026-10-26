"""Ecotypes (Field Biology, v1 B10): egg moves read as how a lineage lives.

    python3 -I engine/biology/ecotypes.py             # engine/data_manifest/biology/ecotypes.json
    python3 -I engine/biology/ecotypes.py Dratini     # one line, as text

Zack's orca analogy: killer whale populations differ less by genes than by what they hunt, how and where, and pass
it on. An egg move is the nearest thing the games have: a move a lineage carries through its parents, not one every
member of the species learns. So each egg move is read as an ecological function (an ambush strike, a sedative, a
cold-water move, a social call), and a lineage that carries two functions together is an ecotype: a Frost ambusher, a
Sedative forager. Each one is a hypothesis (class hypothesis, made by these rules), says which moves it rests on, and
names the places in Johto and Kanto whose habitat it fits, from the species' own range first. The curated ecotypes in
the dossiers (biology/dossiers/) come first wherever they exist.

The same reading of each move, for every Gen I-IV move, goes out with the ecotypes (`moves`), so the breeding-stock
page can read a whole starting set by these rules (web/88_stock.html, A-09).
"""
import json
import os
import sqlite3
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

from biology.ecology import landscape  # noqa: E402

DB = os.path.join(ENGINE, "data", "pokeref.sqlite")
MAN = os.path.join(ENGINE, "data_manifest", "biology")
DOSSIERS = os.path.join(HERE, "dossiers")

# what a move says about how a lineage lives: name, adjective and noun for naming, the reading, the biomes it fits
FUNCTIONS = {
    "ambush": ("Ambush strike", "Ambush", "ambusher", "strikes before the other can act: a sit-and-wait or burst hunter", ["forest", "woodland-edge", "cave", "wetland"]),
    "pursuit": ("Pursuit", "Pursuing", "runner", "runs down what flees: a chaser", ["grassland", "pasture", "montane"]),
    "theft": ("Theft", "Thieving", "thief", "takes what others hold: a kleptoparasite of other foragers", ["urban", "woodland-edge", "forest"]),
    "chemical": ("Chemical defence", "Venomous", "venom-bearer", "poison as weapon and armour", ["forest", "wetland", "cave"]),
    "sedative": ("Sedative", "Sedative", "soother", "puts others to sleep: a forager that disarms its food or its threats", ["forest", "grassland", "wetland"]),
    "paralytic": ("Paralysis", "Numbing", "stunner", "immobilises prey or attackers", ["grassland", "forest", "wetland"]),
    "aquatic": ("Water", "Riverine", "swimmer", "a lineage tied to water", ["wetland", "lake", "river", "coast", "sea", "sacred-pool"]),
    "cold": ("Cold", "Frost", "ice-walker", "a cold-adapted lineage", ["ice-cave", "alpine", "montane", "sea"]),
    "heat": ("Fire", "Ember", "ember-keeper", "a heat-associated lineage", ["urban", "ruins", "tower"]),
    "lithic": ("Rock and soil", "Stone", "burrower", "rock, sand and soil: a digging or cliff lineage", ["cave", "montane", "alpine", "coast"]),
    "flora": ("Plants", "Leaf", "gardener", "a plant-associated lineage: seeds, roots, spores", ["forest", "woodland-edge", "grassland", "wetland"]),
    "aerial": ("Flight", "Sky", "glider", "an aerial lineage: wind and height", ["montane", "alpine", "coast", "grassland"]),
    "shadow": ("Darkness", "Shadow", "night-stalker", "a nocturnal lineage: works in the dark", ["cave", "forest", "tower", "ruins"]),
    "social": ("Cooperation", "Kindred", "companion", "lives with others: care, calls and help", ["urban", "pasture", "grassland", "woodland-edge"]),
    "vocal": ("Sound", "Singing", "caller", "communicates and fights with sound", ["forest", "woodland-edge", "cave", "sea"]),
    "recovery": ("Recovery", "Enduring", "survivor", "heals and outlasts: a lineage of hard places", ["alpine", "ice-cave", "cave", "sea"]),
    "armour": ("Armour", "Shielded", "bulwark", "defended or retaliatory: takes the hit, or returns it", ["cave", "montane", "forest"]),
    "display": ("Power display", "Rampant", "displayer", "builds itself up before it commits: display, dominance, a dance", ["montane", "grassland", "lake"]),
    "trick": ("Deception", "Trickster", "trickster", "confuses, mimics and misdirects", ["forest", "ruins", "urban", "tower"]),
    "electric": ("Electricity", "Storm", "spark", "a charged lineage", ["grassland", "urban", "coast"]),
    "mind": ("Mind", "Seer", "dreamer", "a psychic lineage: foresight and the mind", ["ruins", "tower", "urban"]),
    "brawn": ("Brawn", "Iron", "brawler", "fights up close with strength", ["montane", "cave", "pasture"]),
}
SETS = {   # status and signature moves read directly (identifiers)
    "ambush": {"quick-attack", "aqua-jet", "extreme-speed", "mach-punch", "bullet-punch", "ice-shard", "shadow-sneak", "sucker-punch", "fake-out", "vacuum-wave", "feint"},
    "pursuit": {"pursuit", "agility", "rapid-spin", "u-turn"},
    "theft": {"thief", "covet", "knock-off", "trick", "switcheroo", "snatch"},
    "sedative": {"spore", "sleep-powder", "hypnosis", "sing", "yawn", "lovely-kiss", "grass-whistle", "dark-void"},
    "paralytic": {"stun-spore", "thunder-wave", "glare", "body-slam", "nuzzle", "zap-cannon"},
    "social": {"helping-hand", "heal-bell", "wish", "aromatherapy", "follow-me", "baton-pass", "charm", "sweet-kiss", "attract", "captivate", "tickle", "safeguard", "lucky-chant"},
    "vocal": {"sing", "growl", "screech", "uproar", "hyper-voice", "perish-song", "supersonic", "metal-sound", "grass-whistle", "snore", "bug-buzz", "roar", "heal-bell", "chatter"},
    "recovery": {"recover", "rest", "synthesis", "moonlight", "morning-sun", "milk-drink", "slack-off", "ingrain", "aqua-ring", "soft-boiled", "roost", "heal-order", "refresh"},
    "armour": {"harden", "withdraw", "iron-defense", "acid-armor", "barrier", "amnesia", "defense-curl", "reflect", "light-screen", "protect", "endure", "counter", "mirror-coat", "bide", "revenge", "metal-burst", "stockpile"},
    "display": {"swords-dance", "dragon-dance", "belly-drum", "curse", "bulk-up", "nasty-plot", "calm-mind", "growth", "howl", "meditate", "sharpen", "focus-energy", "tail-glow", "rock-polish"},
    "trick": {"disable", "encore", "mimic", "spite", "confuse-ray", "flash", "fake-tears", "memento", "sweet-scent", "teeter-dance", "sand-attack", "smokescreen", "double-team", "minimize", "substitute", "transform", "torment", "taunt", "imprison", "trick"},
}
WEIGHT = {"brawn": 0.3, "armour": 0.8, "ambush": 1.5, "sedative": 1.5, "theft": 1.5, "chemical": 1.3, "social": 1.3, "paralytic": 1.2}   # how much a move says about a way of life
TYPE_FN = {"poison": "chemical", "water": "aquatic", "ice": "cold", "fire": "heat", "rock": "lithic", "ground": "lithic", "grass": "flora",
           "flying": "aerial", "dark": "shadow", "ghost": "shadow", "electric": "electric", "psychic": "mind", "fighting": "brawn"}


def functions(ident, type_, status):
    """What one move says about how a lineage lives: the sets above by name, a damaging move by its type, a poison
    status move as chemical, a plain Normal hit as brawn."""
    fns = [f for f, s in SETS.items() if ident in s]
    if not status and type_ in TYPE_FN and TYPE_FN[type_] not in fns:
        fns.append(TYPE_FN[type_])
    if status and type_ == "poison":
        fns.append("chemical")
    if not fns and not status and type_ == "normal":
        fns.append("brawn")
    return fns


def load(name):
    with open(os.path.join(MAN, name), encoding="utf-8") as fh:
        return json.load(fh)


class Ecotypes:
    def __init__(self):
        self.db = sqlite3.connect(DB)
        q = self.db.execute
        self.type_name = {r[0]: r[1] for r in q("SELECT id, identifier FROM types")}
        self.moves = {}
        for mid, ident, tid, dc, gen in q("SELECT id, identifier, type_id, damage_class_id, generation_id FROM moves"):
            self.moves[mid] = {"ident": ident, "type": self.type_name.get(tid), "status": dc == 1, "gen": gen}
        self.move_name = {r[0]: r[1] for r in q("SELECT move_id, name FROM move_names WHERE local_language_id=9")}
        self.archive = load("archive.json")
        self.sp = {s["name"]: s for s in self.archive["species"]}
        self.areas = self.archive["areas"]
        self.ecology = load("ecology.json") if os.path.exists(os.path.join(MAN, "ecology.json")) else None
        self.land = landscape()      # Johto and Kanto (biology/johto.json, kanto.json)
        self.dos = {}
        if os.path.isdir(DOSSIERS):
            for f in os.listdir(DOSSIERS):
                if f.endswith(".json"):
                    d = json.load(open(os.path.join(DOSSIERS, f), encoding="utf-8"))
                    self.dos[d["species"]] = d

    def egg_moves(self, name):
        out = {}
        for nm in self.sp[name]["evolution"]["chain"]:
            if nm not in self.sp:
                continue
            pid = self.db.execute("SELECT id FROM pokemon WHERE species_id=? AND is_default=1", (self.sp[nm]["id"],)).fetchone()[0]
            for (mid,) in self.db.execute("SELECT DISTINCT move_id FROM pokemon_moves WHERE pokemon_id=? AND version_group_id=10 AND pokemon_move_method_id=2", (pid,)):
                out[mid] = self.move_name.get(mid, str(mid))
        return out

    def functions_of(self, mid):
        m = self.moves[mid]
        return functions(m["ident"], m["type"], m["status"])

    def move_table(self, last_gen=4):
        """Every move of Gens I-IV that reads as something, by name: {move: [functions]}."""
        return {self.move_name[mid]: fns for mid in sorted(self.moves)
                if (self.moves[mid]["gen"] or 99) <= last_gen and mid in self.move_name and (fns := self.functions_of(mid))}

    def range_of(self, name):
        """The Johto and Kanto places the species is resident in (HG/SS), with their biomes."""
        out = {}
        if not self.ecology:
            return out
        for key, rows in self.ecology["communities"].items():
            if any(r["species"] == name and r["status"] == "resident" for r in rows):
                n = self.land["nodes"][key]
                out[key] = n["biome"] + n.get("water", [])
        return out

    def lineage(self, name):
        eggs = self.egg_moves(name)
        by = defaultdict(list)
        for mid, mv in eggs.items():
            for f in self.functions_of(mid):
                by[f].append(mv)
        ranked = sorted(by.items(), key=lambda kv: (-len(kv[1]) * WEIGHT.get(kv[0], 1.0), kv[0]))
        rng = self.range_of(name)
        own = {TYPE_FN.get(t.lower()) for t in self.sp[name]["types"]}
        machine = []
        used = set()
        # pairs of functions, the commonest first, and a function that's only the species' own type last (every member
        # has that; a lineage is what sets some apart); a pair needs at least two different moves
        cands = [f for f, ms in ranked if f not in own] + [f for f, ms in ranked if f in own]
        for i, f1 in enumerate(cands):
            for f2 in cands[i + 1:]:
                ms = list(dict.fromkeys(sorted(by[f1], key=lambda m: m in by[f2])[:2] + sorted(by[f2], key=lambda m: m in by[f1])[:2]))
                if len(ms) < 2 or (f1, f2) in used or len(machine) >= 3:
                    continue
                if set(by[f1]) == set(by[f2]):
                    continue
                used.add((f1, f2))
                fit = FUNCTIONS[f1][4] + FUNCTIONS[f2][4]
                where = sorted(k for k, b in rng.items() if set(b) & set(fit))
                elsewhere = sorted(k for k, n in self.land["nodes"].items() if set(n["biome"] + n.get("water", [])) & set(FUNCTIONS[f1][4]) & set(FUNCTIONS[f2][4] + FUNCTIONS[f1][4]))[:6]
                machine.append({
                    "name": f"{FUNCTIONS[f1][1]} {FUNCTIONS[f2][2]}", "functions": [f1, f2], "moves": ms[:4],
                    "reading": f"{FUNCTIONS[f1][3].capitalize()}, and {FUNCTIONS[f2][3]}: {', '.join(sorted(set(by[f1])))} with {', '.join(sorted(set(by[f2]) - set(by[f1])) or by[f2])}.",
                    "where": where, "fits": [] if where else elsewhere, "class": "hypothesis", "confidence": "low", "source": "machine"})
            if len(machine) >= 3:
                break
        if not machine and ranked:
            f, ms = ranked[0]
            machine.append({"name": f"{FUNCTIONS[f][1]} lineage", "functions": [f], "moves": sorted(ms)[:4], "reading": FUNCTIONS[f][3].capitalize() + ".",
                            "where": sorted(k for k, b in rng.items() if set(b) & set(FUNCTIONS[f][4])), "fits": [], "class": "hypothesis", "confidence": "low", "source": "machine"})
        curated = [{**e, "source": "dossier"} for e in self.dos.get(name, {}).get("ecotypes", [])]
        return {"species": name, "id": self.sp[name]["id"], "egg_moves": sorted(eggs.values()), "functions": {f: sorted(ms) for f, ms in ranked},
                "curated": curated, "machine": machine, "range": sorted(rng)}

    def build(self):
        out = {}
        for s in self.archive["species"]:
            out[s["name"]] = self.lineage(s["name"])
        return {"_note": "Built by engine/biology/ecotypes.py (v1 B10). Egg moves (HeartGold/SoulSilver, the whole line) read as ecological functions; "
                         "machine ecotypes are hypotheses made by these rules, curated ones come from the dossiers.",
                "functions": {k: {"name": v[0], "reading": v[3], "biomes": v[4]} for k, v in FUNCTIONS.items()},
                "type_fn": TYPE_FN, "moves": self.move_table(), "species": out}


def main():
    E = Ecotypes()
    if len(sys.argv) > 1:
        print(json.dumps(E.lineage(sys.argv[1]), indent=1, ensure_ascii=False))
        return
    data = E.build()
    path = os.path.join(MAN, "ecotypes.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    sp = data["species"].values()
    print(f"{path}: {sum(1 for s in sp if s['egg_moves'])} lines with egg moves, {sum(len(s['machine']) for s in sp)} machine ecotypes, "
          f"{sum(len(s['curated']) for s in sp)} curated, {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    main()
