"""Habitats, ecosystems and food webs (Field Biology, v1 B6-B8; docs/ECOLOGY.md).

    python3 -I engine/biology/ecology.py                  # engine/data_manifest/biology/ecology.json
    python3 -I engine/biology/ecology.py ilex-forest      # one web, as text

Level 1, reconstruction: every Johto and Kanto place in HeartGold and SoulSilver (biology/johto.json and kanto.json,
read together by landscape()) gets its community from the encounter tables, read as presence, method, time of day and
how easily each is found (an encounter rate is how often you meet it, not how many there are). Residents are kept apart
from what only arrives by radio, swarm, the Bug-Catching Contest, the post-game or a weekday, and the Safari Zone is
managed, so it's described, not reconstructed. Then the non-Pokémon life a habitat needs by principle (plants, fungi,
deadwood, insects, plankton: the games never show them, but a forest without them can't feed a Butterfree) is added per
biome, labelled as such.

Level 2, functional analysis: the food web's links come, in order of trust, from a curated dossier
(biology/dossiers/), from a species' own Pokédex entries (claims.py: its diet and named relationships), or from a
size-and-overlap rule for predators (a smaller Pokémon in the same place, active at the same time: a hypothesis).
Every link carries its evidence class. Then: trophic levels (prey-averaged), who is basal and who is on top, who has
nothing to eat here, which functional groups have no Pokémon in them, and keystones by secondary extinction (take one
away and count who starves after it, round by round). The browser runs the same cascade (web/36_ecology.html) and the
Level 3 model; app/test_biology.mjs checks they agree.
"""
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

from biology import claims as C        # noqa: E402

MAN = os.path.join(ENGINE, "data_manifest", "biology")
DOSSIERS = os.path.join(HERE, "dossiers")
VERSIONS = ("heartgold", "soulsilver")
NOT_WILD = {"gift", "static", "npc-trade", "gift-egg", "roaming-grass", "pokemon-ranger", "squirt-bottle", "pokeflute"}
LAND = ["forest", "woodland-edge", "grassland", "pasture", "wetland", "urban", "ruins", "montane", "alpine", "coast", "tower", "managed"]
VEG = ["forest", "woodland-edge", "grassland", "pasture", "wetland", "urban", "ruins", "montane", "managed"]
WATER = ["wetland", "lake", "river", "coast", "sea", "sacred-pool", "sea-cave"]
DARK = ["cave", "ice-cave", "sea-cave", "sacred-pool", "tower"]
EVERY = sorted(set(LAND + WATER + DARK + ["alpine"]))

# The non-Pokémon life and the energy every web stands on. group: abiotic (energy and matter, never goes extinct),
# producer, detritus, consumer (non-Pokémon animals and fungi). eats: what a non-Pokémon consumer or producer feeds on.
RESOURCES = {
    "sunlight": {"name": "Sunlight", "group": "abiotic", "biomes": [b for b in EVERY if b not in DARK]},
    "soil": {"name": "Soil and its nutrients", "group": "abiotic", "biomes": LAND},
    "rock": {"name": "Rock and minerals", "group": "abiotic", "biomes": EVERY},
    "ambient-electricity": {"name": "Electricity (storms, static, power lines)", "group": "abiotic", "biomes": ["urban", "grassland", "pasture", "montane", "coast"],
                            "why": "Pokémon-world energy: several entries have Pokémon taking in electricity"},
    "moonlight": {"name": "Moonlight", "group": "abiotic", "biomes": [b for b in EVERY if b not in DARK]},
    "geothermal-heat": {"name": "Geothermal heat", "group": "abiotic", "biomes": [],
                        "places": ["ice-path", "blackthorn-city", "dragons-den", "johto-route-45", "dark-cave", "johto-route-44", "cinnabar-island"],
                        "why": "geothermal ground in the Blackthorn highlands, Zack's call (A-64, 2026-10-26), a Blackthorn reading since the games show no vents "
                               "or magma there; and Cinnabar Island, where the games say the volcano erupted and swept the town away a year ago and its mouth "
                               "is still open (HeartGold's radio and the Pokémon Center there). Nowhere else in Kanto: its sea routes only see the volcano "
                               "or the rocks it threw, and nothing in the games makes Mt. Silver volcanic"},
    "psychic-energy": {"name": "Dreams and emotions", "group": "abiotic", "biomes": ["urban", "tower", "ruins"],
                       "why": "Pokémon-world energy: entries have Pokémon feeding on dreams or feelings, so it follows people"},
    "trees": {"name": "Trees (wood, bark, sap)", "group": "producer", "biomes": ["forest", "woodland-edge", "montane", "urban"], "eats": ["sunlight", "soil"]},
    "foliage": {"name": "Leaves, grass and low plants", "group": "producer", "biomes": VEG, "eats": ["sunlight", "soil"]},
    "flowers": {"name": "Flowers (nectar and pollen)", "group": "producer", "biomes": ["forest", "woodland-edge", "grassland", "pasture", "urban", "ruins", "montane", "managed"], "eats": ["sunlight", "soil"]},
    "fruit": {"name": "Fruit, Berries and Apricorns", "group": "producer", "biomes": ["forest", "woodland-edge", "grassland", "urban", "managed"], "eats": ["sunlight", "soil"]},
    "moss": {"name": "Moss and lichen", "group": "producer", "biomes": ["forest", "montane", "alpine", "cave", "ice-cave", "ruins"], "eats": ["sunlight", "rock"],
             "why": "on rock and bark; in caves only near the light at the mouth"},
    "algae": {"name": "Algae and water plants", "group": "producer", "biomes": ["wetland", "lake", "river", "coast", "sacred-pool"], "eats": ["sunlight"]},
    "phytoplankton": {"name": "Phytoplankton", "group": "producer", "biomes": ["sea", "coast", "lake"], "eats": ["sunlight"]},
    "kelp": {"name": "Seaweed and kelp", "group": "producer", "biomes": ["sea", "coast", "sea-cave"], "eats": ["sunlight"]},
    "detritus": {"name": "Detritus (dead leaves, remains, droppings)", "group": "detritus", "biomes": EVERY,
                 "why": "in caves this is what washes or is carried in, and the droppings of Pokémon that feed outside"},
    "deadwood": {"name": "Deadwood", "group": "detritus", "biomes": ["forest", "woodland-edge"]},
    "refuse": {"name": "Refuse and waste from people", "group": "detritus", "biomes": ["urban", "tower"]},
    "fungi": {"name": "Fungi and mushrooms", "group": "consumer", "biomes": ["forest", "woodland-edge", "grassland", "cave", "montane", "ruins"], "eats": ["detritus", "deadwood"],
              "why": "the decomposers: no wild Pokémon in these places is one, so the role is filled by principle"},
    "flying-insects": {"name": "Flying insects", "group": "consumer", "biomes": ["forest", "woodland-edge", "grassland", "pasture", "wetland", "urban", "montane", "ruins", "managed"], "eats": ["foliage", "flowers", "fruit"]},
    "soil-invertebrates": {"name": "Soil invertebrates (worms, larvae, mites)", "group": "consumer", "biomes": LAND, "eats": ["detritus", "deadwood", "fungi"]},
    "cave-invertebrates": {"name": "Cave invertebrates", "group": "consumer", "biomes": ["cave", "sea-cave", "ice-cave"], "eats": ["detritus", "fungi"]},
    "aquatic-invertebrates": {"name": "Aquatic invertebrates (larvae, snails, shrimp)", "group": "consumer", "biomes": ["wetland", "lake", "river", "coast", "sacred-pool", "sea-cave"], "eats": ["algae", "detritus"]},
    "zooplankton": {"name": "Zooplankton", "group": "consumer", "biomes": ["sea", "coast", "lake"], "eats": ["phytoplankton"]},
    "small-fish": {"name": "Small fish (non-Pokémon)", "group": "consumer", "biomes": ["sea", "coast", "lake", "river"], "eats": ["zooplankton", "aquatic-invertebrates"],
                   "why": "entries speak of Pokémon eating 'fish' without naming one; whether these are Pokémon is open"},
}
SHORT = {"sunlight": "Sun", "soil": "Soil", "rock": "Rock", "ambient-electricity": "Electricity", "moonlight": "Moonlight", "geothermal-heat": "Heat", "psychic-energy": "Dreams", "trees": "Trees", "foliage": "Leaves", "flowers": "Flowers", "fruit": "Fruit", "moss": "Moss", "algae": "Algae", "phytoplankton": "Phytoplankton", "kelp": "Kelp", "detritus": "Detritus", "deadwood": "Deadwood", "refuse": "Refuse", "fungi": "Fungi", "flying-insects": "Insects", "soil-invertebrates": "Soil fauna", "cave-invertebrates": "Cave fauna", "aquatic-invertebrates": "Water fauna", "zooplankton": "Zooplankton", "small-fish": "Small fish"}   # labels for the web diagram
RES_WORDS = [   # a dossier's non-Pokémon partner, read as one of the resources
    ("flying-insects", r"insect|\bbugs?\b"), ("fungi", r"mushroom|fung"), ("fruit", r"berr|fruit|apricorn|seed|\bnuts?\b"),
    ("flowers", r"nectar|pollen|flower|honey"), ("moss", r"moss|lichen"), ("trees", r"\btrees?\b|bark|\bsap\b|wood"),
    ("foliage", r"\bleaf|leaves|grass|plant|vegetation|shoot|\broots?\b"), ("algae", r"alga|water plant|pondweed"), ("phytoplankton", r"plankton"),
    ("kelp", r"kelp|seaweed"), ("small-fish", r"\bfish"), ("aquatic-invertebrates", r"shellfish|crustacean|aquatic invert|snail|krill|shrimp"),
    ("soil-invertebrates", r"worm|larva|grub"), ("detritus", r"dead|detritus|carrion|remains|dropping|guano|\bshed\b|corpse"),
    ("refuse", r"garbage|trash|refuse|waste|sludge"), ("soil", r"\bsoil|nutrient|\bground\b|\bearth\b|\bdirt"), ("rock", r"\brock|stone|mineral|boulder|\bore\b|iron|metal"),
    ("ambient-electricity", r"electric|lightning"), ("geothermal-heat", r"\bheat|magma|lava|geotherm|hot spring|volcan"),
    ("psychic-energy", r"dream|emotion|feeling|life force|life energy"), ("sunlight", r"\bsun"), ("moonlight", r"\bmoon"),
]
DIET_RES = {   # a Pokédex diet category, read as the resources it could mean in a place
    "plants": ["foliage", "trees", "fruit", "moss"], "plants_water": ["algae", "kelp"], "soil": ["soil", "sunlight"], "nectar": ["flowers"],
    "insects": ["flying-insects", "soil-invertebrates", "cave-invertebrates"], "insects_water": ["aquatic-invertebrates"],
    "fish": ["small-fish"], "aquatic": ["algae", "phytoplankton", "zooplankton", "kelp", "aquatic-invertebrates"],
    "prey": [], "scraps": ["detritus", "refuse"], "minerals": ["rock"], "electricity": ["ambient-electricity"], "sunlight": ["sunlight"],
    "moonlight": ["moonlight"], "heat": ["geothermal-heat"], "psychic": ["psychic-energy"], "waste": ["refuse", "detritus"], "water": [],
    "general": ["foliage", "fruit", "flying-insects", "refuse", "detritus"],
}
GUILD_CAT = {g: k for k, (g, _) in C.GUILDS.items()}
GUILD_CAT.update({"detritivore": "scraps", "decomposer": "scraps", "omnivore": "general", "fungivore": "plants", "frugivore": "plants",
                  "granivore": "plants", "filter feeder": "aquatic", "parasite": "prey", "mixotroph": "soil"})
TROPHIC = {"feeds_on", "parasitism"}
ENERGY = {"sunlight", "moonlight", "ambient-electricity", "geothermal-heat", "psychic-energy", "soil"}   # using one of these is feeding on it
FOODWORD = re.compile(r"\beat|\bfeed|\bfood|\bdiet|\bdrink|absorb|nutri|\bgraz|\bprey|\bsip|\bsuck", re.I)
NONTROPHIC = {"mutualism", "commensalism", "host_of", "engineers", "disperses", "pollinates", "competes_with", "mimics", "rivalry"}
# where the reference data and the HeartGold decomp disagree, the decomp's table wins (A-66): (place, species) -> the condition
# the decomp gives it. Vermilion's Wingull is its surf swarm (gs_enc_data.json T06 surfSwarm), listed a second time without one.
CORRECTIONS = {("vermilion-city", "Wingull"): "swarm"}
CONDITIONAL = [("radio", r"^radio-"), ("swarm", r"^swarm-"), ("contest", r"^bug-catching-contest"), ("post-game", r"^story-progress-(national|beat)"),
               ("weekday", r"^weekday-"), ("safari", r"^johto-safari")]


def load(name):
    with open(os.path.join(MAN, name), encoding="utf-8") as fh:
        return json.load(fh)


def landscape():
    """Johto and Kanto as one landscape: johto.json's biomes, both files' nodes, edges and flagship ecosystems."""
    with open(os.path.join(HERE, "johto.json"), encoding="utf-8") as fh:
        land = json.load(fh)
    with open(os.path.join(HERE, "kanto.json"), encoding="utf-8") as fh:
        kanto = json.load(fh)
    return {"biomes": land["biomes"], "nodes": {**land["nodes"], **kanto["nodes"]}, "edges": land["edges"] + kanto["edges"],
            "ecosystems": {**land["ecosystems"], **kanto["ecosystems"]}}


def dossiers():
    out = {}
    if os.path.isdir(DOSSIERS):
        for f in sorted(os.listdir(DOSSIERS)):
            if f.endswith(".json"):
                with open(os.path.join(DOSSIERS, f), encoding="utf-8") as fh:
                    d = json.load(fh)
                out[d["species"]] = d
    return out


class Ecology:
    def __init__(self):
        self.archive = load("archive.json")
        self.claims = {s["name"]: s for s in load("claims.json")["species"]}
        self.sp = {s["name"]: s for s in self.archive["species"]}
        self.areas = self.archive["areas"]
        self.land = landscape()
        self.dos = dossiers()

    # ---- Level 1: who is found where ---------------------------------------------------------------------------
    def communities(self):
        places = {k: {} for k in self.land["nodes"]}
        for s in self.archive["species"]:
            for e in s["encounters"]:
                if e["v"] not in VERSIONS or e["m"] in NOT_WILD:
                    continue
                key = self.areas[str(e["a"])]["loc_key"]
                if key not in places:
                    continue
                rec = places[key].setdefault(s["name"], {"species": s["name"], "id": s["id"], "methods": set(), "times": set(), "rate": 0,
                                                         "conditions": set(), "versions": set(), "levels": [100, 0], "resident": False})
                rec["methods"].add(e["m"])
                rec["versions"].add(e["v"])
                rec["rate"] = max(rec["rate"], e["r"])
                rec["levels"] = [min(rec["levels"][0], e["l"][0]), max(rec["levels"][1], e["l"][1])]
                conds = [c for c in e.get("c", []) if not c.startswith("headbutt-tree") and not c.startswith("time-")]
                kinds = {k for c in conds for k, pat in CONDITIONAL if re.match(pat, c)} or ({CORRECTIONS[key, s["name"]]} if (key, s["name"]) in CORRECTIONS else set())
                rec["conditions"] |= kinds
                for t in e.get("t", []):
                    rec["times"].add(t)
                if not kinds:
                    rec["resident"] = True
        out = {}
        for key, recs in places.items():
            rows = []
            for r in recs.values():
                status = "resident" if r["resident"] else ("managed" if r["conditions"] == {"safari"} else "visitor")
                times = sorted(r["times"]) if r["times"] and len(r["times"]) < 3 else []
                rows.append({"species": r["species"], "id": r["id"], "methods": sorted(r["methods"]), "times": times, "rate": r["rate"],
                             "status": status, "conditions": sorted(r["conditions"]),
                             "versions": sorted(r["versions"]) if len(r["versions"]) == 1 else [], "levels": r["levels"]})
            rows.sort(key=lambda x: (x["status"] != "resident", -x["rate"], x["id"]))
            out[key] = rows
        return out

    # ---- Level 2: the web ------------------------------------------------------------------------------------------
    def resources_for(self, biomes):
        return [rid for rid, r in RESOURCES.items() if set(r["biomes"]) & set(biomes)]

    def aquatic(self, rec):
        return bool(set(rec["methods"]) & {"surf", "old-rod", "good-rod", "super-rod"}) and not set(rec["methods"]) & {"walk", "headbutt", "rock-smash"}

    def web(self, key, places, communities):
        biomes = sorted({b for p in places for b in self.land["nodes"][p]["biome"]} | {w for p in places for w in self.land["nodes"][p].get("water", [])})
        by_place = {rid for rid, r in RESOURCES.items() if set(r.get("places", [])) & set(places)}   # a resource a place has, whatever its biome
        present_res = set(self.resources_for(biomes)) | by_place
        comm = {}
        for p in places:
            for r in communities[p]:
                if r["status"] != "resident":
                    continue
                c = comm.setdefault(r["species"], {**r, "places": []})
                c["places"].append(p)
                c["methods"] = sorted(set(c["methods"]) | set(r["methods"]))
                c["times"] = sorted(set(c["times"]) | set(r["times"])) if c["times"] and r["times"] else []
                c["rate"] = max(c["rate"], r["rate"])
        links, nontrophic, used = [], [], set()

        def add(frm, to, cls, conf, why, ev=None):
            if frm == to or any(l["from"] == frm and l["to"] == to for l in links):
                return
            links.append({"from": frm, "to": to, "class": cls, "confidence": conf, "why": why, **({"evidence": ev} if ev else {})})
            used.add(to)

        nodes = {}
        for name, r in comm.items():
            s = self.sp[name]
            d = self.dos.get(name)
            cl = self.claims.get(name, {})
            water = self.aquatic(r)
            guild = (d or {}).get("niche", {}).get("guild") or cl.get("guild", {}).get("guild")
            nodes[name] = {"id": name, "kind": "pokemon", "name": name, "dex": s["id"], "mass": s["weight_kg"], "types": s["types"], "guild": guild,
                           "source": "dossier" if d else "claims", "times": r["times"], "rate": r["rate"], "aquatic": water, "places": r["places"]}
            got = 0
            if d:
                for rel in d.get("relationships", []):
                    w = rel.get("with", "")
                    if rel.get("kind") in TROPHIC | {"uses_resource"}:
                        tgt = w if w in comm else self.res_of(w, rel.get("kind"))
                        if tgt and (tgt in comm or tgt in present_res):
                            if rel["kind"] == "uses_resource" and tgt not in ENERGY and not FOODWORD.search(f"{w} {rel.get('note', '')}"):
                                nontrophic.append({"from": name, "to": tgt, "kind": "uses", "class": rel.get("class", "hypothesis"), "why": rel.get("note") or f"uses {w}"})
                                used.add(tgt)
                                continue   # bark for a case, a trunk to cling to: a material or a place, not food
                            add(name, tgt, rel.get("class", "hypothesis"), rel.get("confidence", "low"), rel.get("note") or f"the dossier: {rel['kind'].replace('_', ' ')} {w}", rel.get("evidence"))
                            got += 1
                    elif rel.get("kind") == "preyed_on_by" and w in comm:
                        add(w, name, rel.get("class", "hypothesis"), rel.get("confidence", "low"), rel.get("note") or f"the dossier: preyed on by {w}", rel.get("evidence"))
                    elif rel.get("kind") in NONTROPHIC:
                        tgt = w if w in comm else self.res_of(w, rel["kind"])
                        if tgt and (tgt in comm or tgt in present_res):
                            nontrophic.append({"from": name, "to": tgt, "kind": rel["kind"], "class": rel.get("class", "hypothesis"), "why": rel.get("note") or ""})
                            used.add(tgt)
            if not got:
                cats = list(cl.get("diet", {}).keys()) or ([GUILD_CAT[guild]] if guild in GUILD_CAT else [])
                basis = cl.get("guild", {}) if cl.get("diet") else {"class": "hypothesis", "confidence": "low", "basis": "its type (nothing in the Pokédex)"}
                cls = "inferred" if cl.get("diet") else "hypothesis"
                if not cl.get("diet") and d and guild:
                    cls, basis = d["niche"].get("class", "inferred"), {"confidence": d["niche"].get("confidence", "medium"), "basis": "its dossier's niche"}
                for cat in cats:
                    opts = DIET_RES.get(cat + "_water", []) if water and cat + "_water" in DIET_RES else DIET_RES.get(cat, [])
                    if water and cat == "plants":
                        opts = DIET_RES["plants_water"]
                    for rid in opts:
                        if rid in present_res:
                            add(name, rid, cls, basis.get("confidence", "low"), f"{cat} in its diet ({basis.get('basis', 'its Pokédex entries')})", cl.get("diet", {}).get(cat))
                            got += 1
            # named in its own entries: a Pokémon it eats, or one that eats it
            for rel in cl.get("relationships", []):
                if rel["b"] in comm and rel["kind"] == "feeds_on":
                    add(name, rel["b"], "canon", "medium", f"its Pokédex names {rel['b']}", [rel["claim"]])
                if rel["b"] in comm and rel["kind"] == "fed_on_by":
                    add(rel["b"], name, "canon", "medium", f"its Pokédex names {rel['b']} as a predator", [rel["claim"]])
        # predators: smaller Pokémon in the same places, active at the same time (a hypothesis, low confidence)
        for name, n in nodes.items():
            cats = set(self.claims.get(name, {}).get("diet", {}))
            g = n["guild"]
            if g in ("predator", "parasite"):
                cats.add("prey")
            if g == "insectivore":
                cats.add("insects")
            if g == "piscivore":
                cats.add("fish")
            if not cats & {"prey", "insects", "fish"} or n["source"] == "dossier":
                continue
            cand = []
            for m, o in nodes.items():
                if m == name or self.same_line(name, m):
                    continue
                if not (o["mass"] <= 0.5 * n["mass"] and o["mass"] >= n["mass"] / 1000):
                    continue
                if n["times"] and o["times"] and not set(n["times"]) & set(o["times"]):
                    continue
                kind = "prey" if "prey" in cats else None
                if "insects" in cats and "Bug" in o["types"]:
                    kind = "insects"
                if "fish" in cats and self.sp[m]["shape"] == "fish":
                    kind = "fish"
                if not kind or (o["aquatic"] and not n["aquatic"] and kind != "fish" and "Flying" not in n["types"]):
                    continue
                cand.append((abs(math.log10(n["mass"] / max(o["mass"], 1e-3)) - 1), m, kind))
            for _, m, kind in sorted(cand)[:4]:
                add(name, m, "hypothesis", "low", f"{kind} in its diet; {m} is smaller ({nodes[m]['mass']} kg against {n['mass']} kg) and found here at the same time")
        # the non-Pokémon life, and what it stands on
        for rid in sorted(present_res):
            r = RESOURCES[rid]
            nodes[rid] = {"id": rid, "kind": "resource", "name": r["name"], "short": SHORT.get(rid, r["name"]), "group": r["group"], **({"why": r["why"]} if r.get("why") else {})}
        for rid in sorted(present_res):
            for food in RESOURCES[rid].get("eats", []):
                if food in present_res:
                    add(rid, food, "inferred", "high", "ecological principle: what this group lives on")
        # keep only resources the web uses (directly or as the base of one it uses)
        keep = set(comm)
        frontier = [l["to"] for l in links if l["from"] in comm]
        while frontier:
            x = frontier.pop()
            if x in keep:
                continue
            keep.add(x)
            frontier += [l["to"] for l in links if l["from"] == x]
        for rid in ("detritus", "fungi"):     # the recycling loop exists whether or not a Pokémon uses it
            if rid in present_res:
                keep.add(rid)
                keep |= {f for f in RESOURCES[rid].get("eats", []) if f in present_res}
        keep |= by_place                      # so does what the ground itself gives (geothermal heat in the highlands)
        nodes = {k: v for k, v in nodes.items() if k in keep}
        links = [l for l in links if l["from"] in nodes and l["to"] in nodes]
        nontrophic = [l for l in nontrophic if l["from"] in nodes and l["to"] in nodes]
        return {"key": key, "places": places, "biomes": biomes, "nodes": list(nodes.values()), "links": links, "nontrophic": nontrophic,
                "analysis": analyse(list(nodes.values()), links)}

    def res_of(self, text, kind=None):
        t = str(text).lower()
        if "pokémon" in t and not re.search(r"non-pok", t):
            return None
        for rid, pat in RES_WORDS:
            if re.search(pat, t):
                return rid
        return None

    def same_line(self, a, b):
        return b in self.sp[a]["evolution"]["chain"]

    def build(self):
        comm = self.communities()
        webs = {}
        region = lambda places: "/".join(sorted({self.land["nodes"][p]["region"] for p in places}))   # johto, kanto (or both)
        for key, e in self.land["ecosystems"].items():
            webs[key] = {**self.web(key, e["places"], comm), "name": e["name"], "flagship": True, "why": e["why"], "region": region(e["places"])}
        for key, n in self.land["nodes"].items():
            if key in webs or "managed" in n["biome"] or not any(r["status"] == "resident" for r in comm[key]):
                continue
            webs[key] = {**self.web(key, [key], comm), "name": n["name"], "flagship": False, "region": n["region"]}
        lines = line_disagreements(self.dos, self.sp)
        return {"_note": "Built by engine/biology/ecology.py (v1 B6-B8; Kanto A-66). Communities from HeartGold/SoulSilver's encounter tables, Johto and Kanto; webs from dossiers, claims and stated rules; every link has its evidence class.",
                "resources": RESOURCES, "landscape": {"biomes": self.land["biomes"], "nodes": self.land["nodes"], "edges": self.land["edges"]},
                "communities": comm, "webs": webs, "line_disagreements": lines}


def analyse(nodes, links):
    """Trophic levels, roles, gaps and keystones. The browser's copy is in web/36_ecology.html (Eco.analyse)."""
    by = {n["id"]: n for n in nodes}
    food = {n["id"]: [l["to"] for l in links if l["from"] == n["id"]] for n in nodes}
    tl = {k: (0.0 if by[k].get("group") == "abiotic" else 1.0) for k in by}
    for _ in range(200):          # prey-averaged trophic level: 1 + the mean of what it eats (abiotic energy is 0)
        for k in by:
            if by[k].get("group") == "abiotic":
                continue
            fs = food[k]
            tl[k] = 1.0 + sum(tl[f] for f in fs) / len(fs) if fs else 1.0
    pk = [n["id"] for n in nodes if n["kind"] == "pokemon"]
    eaten = {l["to"] for l in links}
    unfed = sorted(k for k in pk if not food[k])
    top = sorted(k for k in pk if k not in eaten and food[k])
    keystones = []
    for k in by:
        if by[k].get("group") == "abiotic":
            continue
        lost = cascade(nodes, links, {k})
        lostp = [x for x in lost if by[x]["kind"] == "pokemon" and x != k]
        if lostp:
            keystones.append({"id": k, "lost": lostp})
    keystones.sort(key=lambda x: (-len(x["lost"]), x["id"]))
    roles = {
        "producers": [n["id"] for n in nodes if n.get("group") == "producer"],
        "herbivores": [k for k in pk if food[k] and all(by[f].get("group") in ("producer", "abiotic") for f in food[k]) and any(by[f].get("group") == "producer" for f in food[k])],
        "pollinators": [k for k in pk if "flowers" in food[k]],
        "decomposers": [k for k in pk if any(by[f].get("group") == "detritus" for f in food[k])],
        "predators": [k for k in pk if any(by[f]["kind"] == "pokemon" for f in food[k])],
        "energy_eaters": [k for k in pk if food[k] and all(by[f].get("group") == "abiotic" for f in food[k])],
    }
    missing = [r for r in ("herbivores", "pollinators", "decomposers", "predators") if not roles[r]]
    S = len(nodes)
    return {"tl": {k: half_up(v, 2) for k, v in tl.items()}, "unfed": unfed, "top": top, "keystones": keystones[:12], "roles": roles, "missing": missing,
            "links": len(links), "species": len(pk), "connectance": half_up(len(links) / (S * S), 3) if S else 0}


def half_up(x, n):
    """Rounds as the browser's Math.round does (halves up), so both copies print the same numbers."""
    return math.floor(x * 10 ** n + 0.5) / 10 ** n


def cascade(nodes, links, removed):
    """Secondary extinction: after `removed` go, anything that eats and has nothing left to eat goes too, round by round.
    Abiotic energy never goes; a producer with its energy still there never goes."""
    gone = set(removed)
    eats = {}
    for l in links:
        eats.setdefault(l["from"], []).append(l["to"])
    grow = True
    while grow:
        grow = False
        for n in nodes:
            k = n["id"]
            if k in gone or n.get("group") == "abiotic" or k not in eats:
                continue
            if all(f in gone for f in eats[k]):
                gone.add(k)
                grow = True
    return sorted(gone)


def line_disagreements(dos, sp):
    """Where two dossiers of one evolutionary line file it in different guilds (worth a decision, not a silent pick)."""
    out, seen = [], set()
    for name, d in dos.items():
        line = tuple(sp[name]["evolution"]["chain"])
        if line in seen:
            continue
        seen.add(line)
        g = {m: dos[m]["niche"].get("guild") for m in line if m in dos}
        vals = {v for v in g.values()}
        if len(vals) > 1:
            out.append({"line": list(line), "guilds": g})
    return out


def main():
    eco = Ecology()
    data = eco.build()
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        w = data["webs"][sys.argv[1]]
        print(w["name"], "·", ", ".join(w["biomes"]))
        for l in w["links"]:
            print(f"  {l['from']:>26} eats {l['to']:<26} [{l['class']}, {l['confidence']}] {l['why'][:90]}")
        a = w["analysis"]
        print("top:", a["top"], "\nunfed:", a["unfed"], "\nmissing:", a["missing"], "\nkeystones:", [(k["id"], len(k["lost"])) for k in a["keystones"][:6]])
        print("TL:", {k: v for k, v in a["tl"].items() if any(n["id"] == k and n["kind"] == "pokemon" for n in w["nodes"])})
        return
    path = os.path.join(MAN, "ecology.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(w["links"]) for w in data["webs"].values())
    print(f"{path}: {len(data['webs'])} webs ({sum(1 for w in data['webs'].values() if w['flagship'])} flagship), {n} links, "
          f"{len(data['line_disagreements'])} line disagreements, {os.path.getsize(path) // 1024} KB")


if __name__ == "__main__":
    main()
