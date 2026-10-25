"""Capability records v2 (Phase 7): every piece of evidence for what a species could do away from battle, in every
journey game, on three separate axes (MASTER_PLAN §3.2): its layer (A game mechanic, B biology, C equipment or
training), its evidence class (mechanic, inferred, hypothesis, creative) and its status (a record you approved, one
proposed, or neither because it's simply the game's data).

    python3 -I engine/capability/records.py Scizor heartgold      # one species' records, for a look

The original 27 capabilities keep exactly the evidence the wilderness engine has always found (wilderness/engine.py:
field moves, overworld abilities, Pokédex lore, type, size and habitat), re-labelled onto the axes. The eight new ones
(capability/model.json) add: Pokédex patterns, type readings and the Gen 4 Pokédex's body shapes. Layer C records are
derived here from model.json's rules: a species qualifies when its own evidence meets the rule (never on a move-use
hypothesis). Moves a build knows, put to use (model.json move_uses), are applied per build by capability/assess.py,
because they belong to an individual, not the species. World records (canon/world.json) are about one of your
Pokémon, so they're kept apart, keyed by the individual they describe.
"""
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

import rules  # noqa: E402
from ranch.habitat import HabitatEngine  # noqa: E402
from specimen import EXCEPTIONS  # noqa: E402
from wilderness.engine import GAME_VERSIONS, GEN24_VERSIONS, WildernessEngine  # noqa: E402
from wilderness.world import WorldStore  # noqa: E402

GAMES = ("crystal", "firered", "emerald", "platinum", "heartgold", "soulsilver")
TOP = {2: 251, 3: 386, 4: 493}
SIZES = ("small", "medium", "large", "huge")
# what each kind of record is, on the axes
KINDS = {"move": ("A", "mechanic"), "ability": ("A", "mechanic"), "lore": ("B", "inferred"), "type": ("B", "inferred"),
         "size": ("B", "inferred"), "habitat": ("B", "inferred"), "shape": ("B", "inferred"),
         "move_use": ("B", "hypothesis"), "gear": ("C", "creative"), "world": ("B", "creative")}


def load(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as fh:
        return json.load(fh)


def shapes():
    path = os.path.join(ENGINE, "data", "raw", "capability", "pokemon_shapes.csv")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return {r["id"]: r["identifier"] for r in csv.DictReader(fh)}


class CapabilityRecords:
    def __init__(self, db):
        self.model = load("model.json")
        self.wild = WildernessEngine(db)            # no authored evidence: world records are kept apart, by individual
        self.ref = self.wild.ref
        self.habitat = HabitatEngine(db)
        self._routes = {}

    # --- facts ------------------------------------------------------------------------------------------------
    def facts(self, species):
        sid = self.ref.species_id(species)
        row = self.ref.q("SELECT height, weight FROM pokemon WHERE id=?", sid)[0]
        h, w = int(row["height"]) / 10, int(row["weight"]) / 10
        shape, legend, myth = self.ref.q("SELECT shape_id, is_legendary, is_mythical FROM pokemon_species WHERE id=?", sid)[0]
        return {"size": HabitatEngine.size_class(h, w), "h": h, "w": w, "shape": str(shape) if shape else None,
                "legendary": bool(int(legend or 0) or int(myth or 0))}

    def route(self, species, move, game):
        """How the species gets a field move in this game: native, by trade from the other version, by transfer
        from an earlier generation, or an approved exception (D-028)."""
        key = (species, move, game)
        if key not in self._routes:
            if (game, species.lower(), move.lower()) in EXCEPTIONS:
                self._routes[key] = "exception"
            else:
                try:
                    kinds = {r[0] for r in self.ref.learn(species, move, rules.GAME_VG[game])["routes"]}
                except KeyError:
                    kinds = set()
                self._routes[key] = ("native" if "native" in kinds else "trade" if "same-gen trade" in kinds
                                     else "transfer" if "transfer" in kinds else None)
        return self._routes[key]

    # --- records ----------------------------------------------------------------------------------------------
    def records(self, species, game):
        """Every species-level record for one species in one game, as dicts."""
        gen = rules.GAME_GEN[game]
        out = []
        for e in self.wild.evidence(species, game):
            if e.tier == "cartridge":
                name = e.source.split(" (")[0]
                if "(field move" in e.source:
                    r = {"cap": e.capability, "kind": "move", "move": name, "route": self.route(species, name, game),
                         "source": e.source, "detail": e.detail}
                    if "; " in e.source:
                        r["note"] = e.source.split("; ", 1)[1].rstrip(")")
                    out.append(r)
                else:
                    out.append({"cap": e.capability, "kind": "ability", "ability": name, "source": e.source, "detail": e.detail})
            elif e.tier == "lore":
                out.append({"cap": e.capability, "kind": "lore", "source": e.source, "detail": e.detail})
            elif e.tier == "inference":
                kind = "type" if e.source.endswith(" type") else "habitat" if e.source.startswith("habitat:") else "size"
                out.append({"cap": e.capability, "kind": kind, "source": e.source, "detail": e.detail})
        out += self._new_lore(species, game) + self._new_types(species, gen) + self._shape(species)
        out += self._layer_c(species, out)
        return out

    def _new_lore(self, species, game):
        pats = {k: v for k, v in self.model["lore"].items() if not k.startswith("_")}
        excl = {k: v for k, v in self.model["lore_exclude"].items() if not k.startswith("_")}
        sid = self.ref.species_id(species)
        order = GAME_VERSIONS[game] + [v for v in GEN24_VERSIONS if v not in GAME_VERSIONS[game]]
        rows = {int(r["version_id"]): " ".join(r["flavor_text"].split()) for r in self.ref.q(
            "SELECT version_id, flavor_text FROM pokemon_species_flavor_text WHERE species_id=? "
            "AND language_id=9 AND version_id BETWEEN 4 AND 16", sid)}
        names = {int(r["id"]): r["identifier"] for r in self.ref.q("SELECT id, identifier FROM versions")}
        out, seen = [], set()
        for v in order:
            text = rows.get(v)
            if not text:
                continue
            sentences = re.split(r"(?<=[.!?])\s+", text)
            for cap, pat in pats.items():
                if cap not in seen and any(re.search(pat, x, re.I) and not re.search(excl.get(cap, "$^"), x, re.I)
                                           for x in sentences):
                    seen.add(cap)
                    out.append({"cap": cap, "kind": "lore", "source": f"Pokédex ({names[v]})", "detail": text})
        return out

    def _new_types(self, species, gen):
        types = rules.species(gen, species)["types"]
        out = []
        for cap, rows in self.model["types"].items():
            if cap.startswith("_"):
                continue
            for t, why in rows:
                if t in types:
                    out.append({"cap": cap, "kind": "type", "source": f"{t} type", "detail": why})
        return out

    def _shape(self, species):
        f = self.facts(species)
        rules_ = self.model["shapes"]["caps"].get(f["shape"] or "", [])
        out = []
        for row in rules_:
            cap, why, limit = row[0], row[1], row[2]
            if len(row) > 3 and SIZES.index(f["size"]) < SIZES.index(row[3]):
                continue
            name = self.model["shapes"]["names"][f["shape"]]
            out.append({"cap": cap, "kind": "shape", "source": f"body: {name} (Gen 4 Pokédex shape)", "detail": why,
                        "limitations": limit})
        return out

    def _layer_c(self, species, recs):
        f = self.facts(species)
        have = {r["cap"] for r in recs if r["kind"] != "move_use"}
        out = []
        for rule in self.model["layer_c"]["rules"]:
            if rule.get("min_size") and SIZES.index(f["size"]) < SIZES.index(rule["min_size"]):
                continue
            if not any(c in have for c in rule["requires"]["any"]):
                continue
            basis = [c for c in rule["requires"]["any"] if c in have]
            out.append({"cap": rule["capability"], "kind": "gear", "rule": rule["id"], "equipment": rule["equipment"],
                        "source": f"{rule['id']}: {rule['name']}", "detail": f"it has {', '.join(b.replace('_', ' ') for b in basis)}"
                        + (f" and it's {f['size']}" if rule.get("min_size") else "") + f"; needs {rule['training']}",
                        "limitations": rule["limitations"]})
        return out

    # --- world records ----------------------------------------------------------------------------------------
    @staticmethod
    def world(path=None):
        """canon/world.json's records about your Pokémon, keyed to the individual each one describes."""
        store = WorldStore(path) if path else WorldStore()
        out = []
        for r in store.data["records"]:
            if r["status"] == "rejected":
                continue
            out.append({"id": r["id"], "ind": f"me:{r['game']}/{r['species']}", "game": r["game"], "species": r["species"],
                        "cap": r["capability"], "kind": "world", "status": r["status"], "decision": r.get("decision"),
                        "source": f"{r['id']}" + (f" ({r['decision']})" if r.get("decision") else " (proposed)"),
                        "detail": r["statement"]})
        return out


def main():
    from trainers.model import DB
    species, game = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("Scizor", "heartgold")
    cr = CapabilityRecords(DB)
    print(json.dumps(cr.facts(species)))
    for r in cr.records(species, game):
        layer, cls = KINDS[r["kind"]]
        print(f"{layer} {cls:10} {r['cap']:16} {r['kind']:8} {r['source']}" + (f"  [{r.get('route')}]" if r.get("route") else ""))


if __name__ == "__main__":
    main()
