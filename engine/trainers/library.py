"""The Trainer Library's in-game trainers (docs/specs/TRAINER_ECOSYSTEM.md, Category A; MASTER_PLAN Phase 5).

    python3 -I engine/trainers/library.py        # engine/data_manifest/trainer_library.json

Every Gym Leader, Elite Four member, Champion, rival meeting, villain leader and admin, and their rematches, in
Crystal, FireRed, Emerald, Platinum and HeartGold/SoulSilver, read exactly from the pret decompilations in
data/raw/trainers (fetch_reference.py --trainers): species and order, levels, moves (the game's own, or the last four
level-up moves where the game fills them in), held items, IVs by the game's rule, the ability slot where the game sets
it, the trainer's bag items, AI flags, double battles and battle lines. Natures come from a hidden value the data
doesn't fix, and trainers have no EVs: both are said so, not invented.

One encounter is one record; a rematch is its own record, never an edit of the first. Records group into identities
(Lance in Crystal, FireRed and HeartGold is one trainer with three entries). The rival's name in the files is a
placeholder (FireRed's "TERRY", Platinum's "Cedric"); the library uses the names the games show: Blue, Silver, Barry,
Brendan and May. Blue joins the existing Gary record (canon/trainers.json already files HeartGold's Blue there).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
RAW = os.path.join(ENGINE, "data", "raw", "trainers")
OUT = os.path.join(ENGINE, "data_manifest", "trainer_library.json")
GEN = {"crystal": 2, "firered": 3, "emerald": 3, "platinum": 4, "heartgold": 4}
REGION = {"crystal": "Johto", "heartgold": "Johto", "firered": "Kanto", "emerald": "Hoenn", "platinum": "Sinnoh"}
KANTO = {"brock", "misty", "lt-surge", "erika", "janine", "sabrina", "blaine", "gary", "red", "koga-leader"}
NAMES = {"LT.SURGE": "Lt. Surge", "LT_SURGE": "Lt. Surge", "TATE&LIZA": "Tate & Liza", "TATE_LIZA": "Tate & Liza"}
IDENTITY = {"blue": "gary", "terry": "gary", "cedric": "barry", "?": "silver"}   # placeholder and game names -> who
STARTERS = {2: ("Chikorita", "Bayleef", "Meganium", "Cyndaquil", "Quilava", "Typhlosion", "Totodile", "Croconaw", "Feraligatr"),
            3: ("Treecko", "Grovyle", "Sceptile", "Torchic", "Combusken", "Blaziken", "Mudkip", "Marshtomp", "Swampert",
                "Bulbasaur", "Ivysaur", "Venusaur", "Charmander", "Charmeleon", "Charizard", "Squirtle", "Wartortle", "Blastoise"),
            4: ("Turtwig", "Grotle", "Torterra", "Chimchar", "Monferno", "Infernape", "Piplup", "Prinplup", "Empoleon",
                "Chikorita", "Bayleef", "Meganium", "Cyndaquil", "Quilava", "Typhlosion", "Totodile", "Croconaw", "Feraligatr")}
CATEGORY_ORDER = ["gym", "elite_four", "champion", "rival", "villain", "special"]


def slug(s):
    s = str(s).lower().replace("&", "and").replace("é", "e").replace(".", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def pretty(name):
    name = str(name).replace("{TRNAME}", "").strip()
    if name.upper() in NAMES:
        return NAMES[name.upper()]
    return " ".join(w.capitalize() for w in name.split()) if name.isupper() else name


def humanize(token):
    """A place from a file or symbol name: 'route_103' -> 'Route 103', 'mt_chimney' -> 'Mt. Chimney'."""
    words = {"vr": "Victory Road", "mt": "Mt.", "ss": "S.S.", "hq": "HQ", "pokemon": "Pokémon"}
    out = [words.get(w, w.capitalize()) for w in re.split(r"[_\s]+", token.lower()) if w]
    return re.sub(r"Route(\d)", r"Route \1", " ".join(out)).replace("Route22", "Route 22")


class Library:
    def __init__(self):
        sys.path.insert(0, ENGINE)
        from battle.benchmarks import Benchmarks, clean_line, platinum_ivs, trainer_ivs
        from trainers.model import DB
        import rules
        self.rules = rules
        self.bench = Benchmarks(DB, None)
        self.clean = clean_line
        self.ivs, self.platinum_ivs = trainer_ivs, platinum_ivs   # IVs by the game's rule, out-of-range values too
        self.ai = json.load(open(os.path.join(ENGINE, "battle", "trainer_ai.json"), encoding="utf-8"))
        self.records = []

    # --- shared -----------------------------------------------------------------------------------------------
    def mon(self, game, species, level, moves, item, ivs, ability_slot=0):
        m = self.bench._mon(game, species, level, moves or [], item, dict(ivs))
        given = [x for x in (moves or []) if x and "NONE" not in str(x).upper()]
        m["moves_from"] = "game" if given else "level-up"     # the game's own set, or the last four level-up moves
        options = self.rules.abilities(GEN[game], m["species"]) if GEN[game] >= 3 else []
        if options:
            m["ability"] = options[min(ability_slot, len(options) - 1)]
            if ability_slot:
                m["ability_set"] = True                       # the game sets this slot (HGSS abilityOverride)
        return m

    def add(self, game, identity, name, title, category, encounter, party, source, **extra):
        gen = GEN[game]
        starters = [p["species"] for p in party if p["species"] in STARTERS.get(gen, ())]
        rec = {"identity": identity, "name": name, "title": title, "category": category, "game": game, "generation": gen,
               "region": "Kanto" if identity in KANTO and game in ("crystal", "heartgold") else REGION[game],
               "encounter": encounter, "kind": "cartridge", "party": party, "source": source,
               "top_level": max(p["level"] for p in party) if party else 0}
        if category == "rival" and starters:
            rec["starter"] = starters[0]
        if game == "heartgold":
            rec["also_in"] = ["soulsilver"]
        rec.update({k: v for k, v in extra.items() if v not in (None, [], "")})
        self.records.append(rec)

    def finish(self):
        """Ids, encounter numbering for repeated meetings, and a stable order."""
        lines = {}
        for chain in (("Chikorita", "Bayleef", "Meganium"), ("Cyndaquil", "Quilava", "Typhlosion"),
                      ("Totodile", "Croconaw", "Feraligatr")):
            for sp in chain:
                lines[sp] = chain[0]
        for r in self.records:                               # Silver: numbered within his starter's line
            if r["identity"] == "silver" and not r["encounter"] and r.get("starter") in lines:
                r["encounter"] = f"{lines[r['starter']]} line"
        groups = {}
        for r in self.records:
            groups.setdefault((r["game"], r["identity"], r["encounter"] or ""), []).append(r)
        for (game, ident, enc), rs in groups.items():
            if len(rs) > 1:                                  # the same label twice: number them by level
                rs.sort(key=lambda r: (r["top_level"], r["source"]))
                for i, r in enumerate(rs, 1):
                    r["encounter"] = (enc + " · " if enc else "") + f"meeting {i} of {len(rs)} (Lv {r['top_level']})"
        seen = {}
        for r in self.records:
            base = f"{r['game']}/{r['identity']}" + (f"-{slug(r['encounter'])}" if r["encounter"] and r["encounter"] != "first battle" else "")
            n = seen.get(base, 0)
            seen[base] = n + 1
            r["id"] = base if not n else f"{base}-{n + 1}"
        cat = {c: i for i, c in enumerate(CATEGORY_ORDER)}
        self.records.sort(key=lambda r: (["crystal", "firered", "emerald", "platinum", "heartgold"].index(r["game"]),
                                         cat[r["category"]], r["identity"], r["top_level"], r["id"]))
        return self.records

    # --- Crystal (pokecrystal data/trainers/parties.asm, dvs.asm, attributes.asm) ---------------------------------
    CRYSTAL = {   # group -> (identity, title, category, display name)
        "Falkner": ("falkner", "Gym Leader", "gym", None), "Whitney": ("whitney", "Gym Leader", "gym", None),
        "Bugsy": ("bugsy", "Gym Leader", "gym", None), "Morty": ("morty", "Gym Leader", "gym", None),
        "Pryce": ("pryce", "Gym Leader", "gym", None), "Jasmine": ("jasmine", "Gym Leader", "gym", None),
        "Chuck": ("chuck", "Gym Leader", "gym", None), "Clair": ("clair", "Gym Leader", "gym", None),
        "Brock": ("brock", "Gym Leader", "gym", None), "Misty": ("misty", "Gym Leader", "gym", None),
        "LtSurge": ("lt-surge", "Gym Leader", "gym", "Lt. Surge"), "Erika": ("erika", "Gym Leader", "gym", None),
        "Janine": ("janine", "Gym Leader", "gym", None), "Sabrina": ("sabrina", "Gym Leader", "gym", None),
        "Blaine": ("blaine", "Gym Leader", "gym", None), "Blue": ("gary", "Gym Leader", "gym", "Blue"),
        "Will": ("will", "Elite Four", "elite_four", None), "Bruno": ("bruno", "Elite Four", "elite_four", None),
        "Karen": ("karen", "Elite Four", "elite_four", None), "Koga": ("koga", "Elite Four", "elite_four", None),
        "Champion": ("lance", "Champion", "champion", "Lance"), "Rival1": ("silver", "Rival", "rival", "Silver"),
        "Rival2": ("silver", "Rival", "rival", "Silver"), "Red": ("red", "Pokémon Trainer", "special", "Red"),
        "ExecutiveM": ("rocket-executive", "Team Rocket Executive", "villain", "Rocket Executive"),
        "ExecutiveF": ("rocket-executive", "Team Rocket Executive", "villain", "Rocket Executive"),
        "Mysticalman": ("eusine", "Mystery Man", "special", "Eusine"),
        "KimonoGirl": ("kimono-girls", "Kimono Girl", "special", None),
    }

    def crystal(self):
        text = open(os.path.join(RAW, "crystal_parties.asm"), encoding="utf-8").read()
        order, groups, group, cur = [], {}, None, None
        for line in text.splitlines():
            g = re.match(r"^(\w+)Group:", line)
            if g:
                group = g.group(1)
                order.append(group)
                groups[group] = []
                continue
            s = line.split(";")[0].strip()
            t = re.match(r'db "(.*?)@",\s*(\w+)', s)
            if t:
                cur = {"name": t.group(1), "type": t.group(2), "party": []}
                groups[group].append(cur)
            elif s.startswith("db -1"):
                cur = None
            elif cur is not None and s.startswith("db "):
                parts = [p.strip() for p in s[3:].split(",")]
                rest = parts[2:]
                item = rest.pop(0) if "ITEM" in cur["type"] else None
                cur["party"].append((int(parts[0]), parts[1], rest[:4] if "MOVES" in cur["type"] else [], item))
        dvs = []
        for line in open(os.path.join(RAW, "crystal_dvs.asm"), encoding="utf-8"):
            m = re.match(r"\s*dn\s+(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*;\s*(\w+)", line)
            if m:
                a, d, sp, c = map(int, m.groups()[:4])
                dvs.append({"atk": a * 2, "def": d * 2, "spe": sp * 2, "spa": c * 2, "spd": c * 2, "hp": 30})
        attrs, cur = [], None
        for line in open(os.path.join(RAW, "crystal_attributes.asm"), encoding="utf-8"):
            if re.match(r"^; \w", line) and not line.startswith("; entries"):
                cur = {"items": [], "ai": []}
                attrs.append(cur)
            elif cur is not None and re.match(r"\s*db .*; items", line):
                cur["items"] = [x.strip() for x in line.split(";")[0].strip()[3:].split(",") if "NO_ITEM" not in x]
            elif cur is not None and re.match(r"\s*dw AI_", line):
                cur["ai"] = [x.strip() for x in line.strip()[3:].split("|")]
        for gi, group in enumerate(order):
            if group not in self.CRYSTAL:
                continue
            ident, title, cat, disp = self.CRYSTAL[group]
            ivs, at = dvs[gi], attrs[gi]
            for ti, tr in enumerate(groups[group]):
                party = [self.mon("crystal", sp, lvl, mv, item, ivs) for lvl, sp, mv, item in tr["party"]]
                name = disp or pretty(tr["name"])
                enc = "first battle"
                if ident in ("silver", "rocket-executive"):
                    enc = ""
                elif ident == "kimono-girls":
                    enc, name = pretty(tr["name"]), "Kimono Girl " + pretty(tr["name"])
                self.add("crystal", ident, name, title, cat, enc, party,
                         f"pret/pokecrystal data/trainers/parties.asm {group}Group ({ti + 1})",
                         ai_flags=at["ai"], items=[self.rules.to_id(x) for x in at["items"]])

    # --- FireRed and Emerald (src/data/trainers.h + trainer_parties.h) ---------------------------------------
    def gen3(self, game):
        text = open(os.path.join(RAW, f"{game}_trainers.h"), encoding="utf-8").read()
        parties = self.bench._gen3(game)
        for sym, body in re.findall(r"\[(TRAINER_\w+)\]\s*=\s*\{(.*?)\n\s*\},", text, re.S):
            m = re.search(r"\.trainerClass\s*=\s*(\w+)", body)
            if not m:
                continue
            cls = m.group(1).replace("TRAINER_CLASS_", "")
            raw_name = (re.search(r'\.trainerName\s*=\s*_\("(.*?)"\)', body) or [None, ""])[1]
            party_sym = re.search(r"\.party\s*=\s*\w+\((sParty_\w+)\)", body)
            if not party_sym or party_sym.group(1) not in parties:
                continue
            what = self.gen3_role(game, cls, sym, raw_name)
            if not what:
                continue
            ident, name, title, cat, enc = what
            items = re.search(r"\.items\s*=\s*\{([^}]*)\}", body)
            items = [self.rules.to_id(x.strip()) for x in (items.group(1) if items else "").split(",")
                     if x.strip() and "NONE" not in x]
            ai = re.search(r"\.aiFlags\s*=\s*([^,\n]+)", body)
            ai = [x.strip() for x in ai.group(1).split("|")] if ai and ai.group(1).strip() not in ("0",) else []
            double = "doubleBattle = TRUE" in body
            party = [self.mon(game, sp, lvl, mv, item, self.ivs(iv)) for iv, lvl, sp, item, mv in parties[party_sym.group(1)]]
            self.add(game, ident, name, title, cat, enc, party,
                     f"pret/poke{game} src/data/trainers.h {sym} ({party_sym.group(1)})",
                     ai_flags=ai, items=items, double=double or None)

    def gen3_role(self, game, cls, sym, raw_name):
        name = pretty(raw_name)
        ident = IDENTITY.get(slug(raw_name), slug(raw_name))
        if game == "firered":
            if cls.startswith("RS_") or cls in ("AQUA_ADMIN", "MAGMA_ADMIN", "AQUA_LEADER", "MAGMA_LEADER"):
                return None                                   # Ruby/Sapphire leftovers the game never uses
            if cls == "LEADER":
                return ident, name, "Gym Leader", "gym", "first battle"
            if cls == "ELITE_FOUR":
                return ident, name, "Elite Four", "elite_four", "rematch" if sym.endswith("_2") else "first battle"
            if cls == "CHAMPION":
                kind = "rematch" if "REMATCH" in sym else "first battle"
                return "gary", "Blue", "Champion", "champion", f"{kind} · he chose {sym.rsplit('_', 1)[1].capitalize()}"
            if cls in ("RIVAL_EARLY", "RIVAL_LATE"):
                place = humanize(sym.replace("TRAINER_RIVAL_", "").rsplit("_", 1)[0])
                return "gary", "Blue", "Rival", "rival", f"{place} · he chose {sym.rsplit('_', 1)[1].capitalize()}"
            if cls == "BOSS":
                return "giovanni", "Giovanni", "Team Rocket Boss", "villain", "meeting 2" if sym.endswith("_2") else "meeting 1"
            return None
        # Emerald
        if cls == "LEADER":
            n = int(sym.rsplit("_", 1)[1])
            return ident, name, "Gym Leader", "gym", "first battle" if n == 1 else f"rematch {n - 1}"
        if cls == "ELITE_FOUR":
            return ident, name, "Elite Four", "elite_four", "first battle"
        if cls == "CHAMPION":
            return ident, name, "Champion", "champion", "first battle"
        if cls == "RIVAL":
            if ident == "steven":
                return "steven", "Steven", "Former Champion", "special", "Meteor Falls"
            rest = sym.replace(f"TRAINER_{raw_name.upper()}_", "")
            parts = rest.rsplit("_", 1)
            if parts[-1] in ("MUDKIP", "TREECKO", "TORCHIC"):
                return ident, name, "Rival", "rival", f"{humanize(parts[0])} · you chose {parts[1].capitalize()}"
            vr = re.match(r"VR_(\d)$", rest)
            if vr:
                return ident, name, "Rival", "rival", "Victory Road" if vr.group(1) == "1" else f"Victory Road rematch {int(vr.group(1)) - 1}"
            return ident, name, "Rival", "rival", humanize(rest)
        if cls in ("MAGMA_LEADER", "AQUA_LEADER"):
            team = "Magma" if "MAGMA" in cls else "Aqua"
            place = sym.replace(f"TRAINER_{raw_name.upper()}", "").strip("_")
            return ident, name, f"Team {team} Leader", "villain", humanize(place) if place else "first battle"
        if cls in ("MAGMA_ADMIN", "AQUA_ADMIN"):
            team = "Magma" if "MAGMA" in cls else "Aqua"
            place = sym.replace(f"TRAINER_{raw_name.upper()}", "").strip("_")
            return ident, name, f"Team {team} Admin", "villain", humanize(place) if place else "first battle"
        return None

    # --- Platinum (pokeplatinum res/trainers/data/*.json) ------------------------------------------------------
    def platinum(self):
        sys.path.insert(0, ENGINE)
        from fetch_reference import PLATINUM_TRAINERS
        for f in PLATINUM_TRAINERS:
            path = os.path.join(RAW, f"platinum_{f}.json")
            if not os.path.exists(path) or "unused" in f:
                continue
            d = json.load(open(path, encoding="utf-8"))
            cls = d.get("class", "").replace("TRAINER_CLASS_", "")
            name, kind, rest = pretty(d.get("name", "")), f.split("_")[0], f
            if cls.startswith("LEADER"):
                ident, title, cat, rest = slug(name), "Gym Leader", "gym", f.replace("leader_" + slug(name).replace("-", "_"), "")
            elif cls.startswith("ELITE_FOUR"):
                ident, title, cat, rest = slug(name), "Elite Four", "elite_four", f.replace("elite_four_" + slug(name), "")
            elif cls.startswith("CHAMPION"):
                ident, title, cat, rest = slug(name), "Champion", "champion", f.replace("champion_" + slug(name), "")
            elif cls == "RIVAL":
                ident, name, title, cat = "barry", "Barry", "Rival", "rival"
                place, starter = f.replace("rival_", "").rsplit("_", 1)
                rest = f"_{place}_x"
            elif cls.startswith("COMMANDER"):
                ident, title, cat, rest = slug(name), "Team Galactic Commander", "villain", f.replace(f"commander_{slug(name)}", "")
            elif cls.startswith("GALACTIC_BOSS"):
                ident, title, cat, rest = "cyrus", "Team Galactic Boss", "villain", f.replace("galactic_boss_cyrus", "")
            else:
                continue
            rest = rest.strip("_")
            if cls == "RIVAL":
                enc = f"{humanize(place)} · you chose {starter.capitalize()}"
            elif rest == "rematch":
                enc = "rematch"
            elif not rest:
                enc = "first battle"
            else:
                enc = humanize(rest)
            party = [self.mon("platinum", p["species"], p["level"], p.get("moves") or [], p.get("item"),
                              self.platinum_ivs(f, d, p)) for p in d["party"]]
            msgs = [{"type": m["type"], "text": self.clean(" ".join(m.get("en_US", [])))} for m in d.get("messages", [])]
            self.add("platinum", ident, name, title, cat, enc, party, f"pret/pokeplatinum res/trainers/data/{f}.json",
                     ai_flags=d.get("ai_flags", []), items=[self.rules.to_id(x) for x in d.get("items", []) if "NONE" not in x],
                     double=d.get("double_battle") or None, messages=msgs,
                     note="The file's placeholder name is Cedric; the game shows the rival's name, Barry." if cls == "RIVAL" else None)

    # --- HeartGold/SoulSilver (pokeheartgold files/poketool/trainer/trainers.json) -------------------------------
    HGSS = {"LEADER": ("Gym Leader", "gym"), "ELITE_FOUR": ("Elite Four", "elite_four"), "CHAMPION": ("Champion", "champion"),
            "RIVAL": ("Rival", "rival"), "EXECUTIVE": ("Team Rocket Executive", "villain"),
            "ROCKET_BOSS": ("Team Rocket Boss", "villain"), "PKMN_TRAINER_RED": ("Pokémon Trainer", "special"),
            "ELDER": ("Elder", "special"), "MYSTERY_MAN": ("Mystery Man", "special"), "KIMONO_GIRL": ("Kimono Girl", "special")}

    def heartgold(self):
        trainers = json.load(open(os.path.join(RAW, "hgss_trainers.json"), encoding="utf-8"))["trainers"]
        bits = self.ai["gen4_bits"]
        seen = {}
        for idx, tr in enumerate(trainers):
            cls = tr["class"].replace("TRAINERCLASS_", "")
            key = next((k for k in self.HGSS if cls == k or cls.startswith(k + "_")), None)
            if not key or not tr["party"]:
                continue
            title, cat = self.HGSS[key]
            name = pretty(tr["name"])
            ident = IDENTITY.get(slug(name), slug(name))
            if key == "KIMONO_GIRL":
                ident, name = "kimono-girls", "Kimono Girl " + name
            if key == "EXECUTIVE" or key == "RIVAL":
                enc = ""                                      # numbered by level in finish()
            elif len(tr["party"]) == 3 and idx >= 733:
                enc = "three-Pokémon team (a tag battle)"
            else:
                n = seen.get((cls, name), 0)
                seen[(cls, name)] = n + 1
                enc = "first battle" if n == 0 else ("rematch" if n == 1 else f"rematch {n}")
            if key == "KIMONO_GIRL":
                enc = name.replace("Kimono Girl ", "")
            party = []
            for p in tr["party"]:
                slot = 1 if "SECOND" in str(p.get("abilityOverride", "")) else 0
                party.append(self.mon("heartgold", p["species"], p["level"], p.get("moves") or [], p.get("item"),
                                      self.ivs(p.get("difficulty", 0)), slot))
            flags = tr.get("ai_flags", 0)
            msgs = [{"type": m["type"], "text": self.clean(m.get("message", ""))} for m in tr.get("messages", [])]
            self.add("heartgold", ident, name, title, cat, enc, party,
                     f"pret/pokeheartgold files/poketool/trainer/trainers.json #{idx}",
                     ai_flags=flags, ai_flag_names=[n for n, b in bits.items() if flags & b],
                     items=[self.rules.to_id(x) for x in tr.get("items", []) if "NONE" not in x],
                     double=bool(tr.get("double")) or None, messages=msgs)

    def build(self):
        self.crystal()
        self.gen3("firered")
        self.gen3("emerald")
        self.platinum()
        self.heartgold()
        return self.finish()


def main():
    recs = Library().build()
    by = {}
    for r in recs:
        by.setdefault(r["game"], {}).setdefault(r["category"], 0)
        by[r["game"]][r["category"]] += 1
    doc = {"_note": "Built by trainers/library.py from the pret decompilations (data/raw/trainers). One record per "
                    "encounter; a rematch is its own record. Natures aren't fixed by the data and trainers have no EVs.",
           "records": recs}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=0)
    print(f"{OUT}: {len(recs)} trainer encounters, {len({r['identity'] for r in recs})} trainers")
    for g, c in by.items():
        print(f"  {g:10} " + ", ".join(f"{k} {v}" for k, v in c.items()))


if __name__ == "__main__":
    sys.exit(main())
