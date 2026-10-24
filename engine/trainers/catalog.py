"""The Trainer Library as one catalog (docs/specs/TRAINER_ECOSYSTEM.md; MASTER_PLAN Phase 5).

    python3 -I engine/trainers/catalog.py        # a summary; app/library_pack.py writes the app's copy

Joins the authored trainers (canon/trainers.json: the journey, anime reconstructions, the all-time team) with every
in-game encounter (trainers/library.py) into identities and versions, and adds what the spec asks of each:
- a kind per version: cartridge, anime, all-time, journey, custom;
- evidence classes per build field (confirmed, strongly inferred, standardized, hypothetical, unknown), so a
  reconstruction shows what the source says and what Blackthorn assumed;
- the two lenses a benchmark is read through: as encountered, and standardized;
- benchmark collections, each with its members, rule, lens and a version stamp, so changing a collection never
  silently changes an earlier result;
- the cartridge trainer's own AI read as tendencies and competence (Q9's default: tendencies come from how a trainer
  decides; your authored sliders stay your reading).
Nothing here changes a canonical record; it reads them.
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
LIBRARY = os.path.join(ENGINE, "data_manifest", "trainer_library.json")
GAMES = ["crystal", "firered", "emerald", "platinum", "heartgold"]
GAME_NAME = {"crystal": "Crystal", "firered": "FireRed", "emerald": "Emerald", "platinum": "Platinum",
             "heartgold": "HeartGold/SoulSilver", "soulsilver": "SoulSilver"}
GAME_GEN = {"crystal": 2, "firered": 3, "emerald": 3, "platinum": 4, "heartgold": 4, "soulsilver": 4}

LENSES = {
    "authentic": {"name": "As encountered",
                  "rule": "Their team exactly as the game has it (levels, moves, items, IVs, AI); your Pokémon at their "
                          "highest level. Answers: how would mine do against them in the original game?"},
    "standardized": {"name": "Standardized",
                     "rule": "Both sides at Lv 100. Their moves, items and IVs as the game has them, no EVs (the games give "
                             "trainers none); your blank EVs read as 85 each (D-061). The Ace test's terms. Answers: how does "
                             "mine compare on equal footing?"},
}
CLASSES = {
    "confirmed": "established by the source (the game's data, or the show for a reconstruction)",
    "strongly inferred": "supported by what the source shows, but not stated outright",
    "standardized": "filled in by Blackthorn's declared method (trainers/config.json), the same for every reconstruction",
    "hypothetical": "a deliberate choice for this version, not from the source",
    "unknown": "the source doesn't fix it, and Blackthorn doesn't guess",
}
# The games' AI flags, read as what kind of thing each one is: how the trainer prefers to battle (a tendency) or how
# well it decides (competence). The flags' own descriptions stay in battle/trainer_ai.json; this is the reading.
FLAG_READ = {
    "AI_FLAG_BASIC": ("competence", "avoids moves that would fail"), "AI_FLAG_EVAL_ATTACK": ("competence", "weighs damage"),
    "AI_FLAG_EXPERT": ("competence", "expert judgment"), "AI_FLAG_CHECK_HP": ("competence", "reads HP before acting"),
    "AI_FLAG_TAG_STRATEGY": ("competence", "double-battle play"),
    "AI_FLAG_SETUP_FIRST_TURN": ("tendency", "sets up early"), "AI_FLAG_RISKY": ("tendency", "takes risks"),
    "AI_FLAG_PRIORITIZE_EXTREMES": ("tendency", "favors extreme moves"), "AI_FLAG_BATON_PASS": ("tendency", "Baton Pass"),
    "AI_FLAG_WEATHER": ("tendency", "weather"), "AI_FLAG_HARRASSMENT": ("tendency", "status and harassment"),
    "AI_SCRIPT_CHECK_BAD_MOVE": ("competence", "avoids moves that would fail"),
    "AI_SCRIPT_TRY_TO_FAINT": ("competence", "goes for the knockout"), "AI_SCRIPT_CHECK_VIABILITY": ("competence", "judges each move"),
    "AI_SCRIPT_HP_AWARE": ("competence", "reads HP before acting"), "AI_SCRIPT_DOUBLE_BATTLE": ("competence", "double-battle play"),
    "AI_SCRIPT_SETUP_FIRST_TURN": ("tendency", "sets up early"), "AI_SCRIPT_RISKY": ("tendency", "takes risks"),
    "AI_SCRIPT_PREFER_POWER_EXTREMES": ("tendency", "favors extreme moves"),
    "AI_SCRIPT_PREFER_STRONGEST_MOVE": ("tendency", "always the strongest move"),
    "AI_SCRIPT_PREFER_BATON_PASS": ("tendency", "Baton Pass"), "AI_SCRIPT_TRY_SUNNY_DAY_START": ("tendency", "weather"),
    "AI_BASIC": ("competence", "avoids moves that would fail"), "AI_TYPES": ("competence", "reads type matchups"),
    "AI_SMART": ("competence", "situational judgment"), "AI_SETUP": ("tendency", "sets up"),
    "AI_OFFENSIVE": ("tendency", "offensive"), "AI_AGGRESSIVE": ("tendency", "aggressive"), "AI_CAUTIOUS": ("tendency", "cautious"),
    "AI_STATUS": ("tendency", "status moves"), "AI_RISKY": ("tendency", "takes risks"), "AI_OPPORTUNIST": ("tendency", "opportunist"),
}
DEFAULT_THRESHOLD = 0.7      # a collection's bar unless it says otherwise (the Ace collections keep Ace's own bars)


def stamp(*parts):
    return hashlib.sha1(json.dumps(parts, sort_keys=True).encode()).hexdigest()[:8]


def ace_of(party):
    """The trainer's ace: its one highest-level Pokémon (D-050), or None when two share the top level."""
    if not party:
        return None
    top = max(p.get("level") or 0 for p in party)
    at = [p for p in party if (p.get("level") or 0) == top]
    return at[0]["species"] if len(at) == 1 and top else None


def evidence(b, kind, cfg):
    """{field: [class, why]} for one team member, by the kind of record it comes from."""
    d = cfg["defaults"]
    std = {"ivs": f"IVs {d['ivs']} in every stat", "evs": f"EVs {d['even_evs_each']} in every stat (stat experience maxed in Gen 2)",
           "nature": "a neutral nature", "level": "Lv 100 in fights", "ability": "the species' first ability"}
    out = {}
    if kind == "cartridge":
        out["species"] = ["confirmed", "the game's own team"]
        out["level"] = ["confirmed", "the game's own level"]
        out["moves"] = ["confirmed", "the game's own moveset"] if b.get("moves_from", "game") == "game" else \
            ["confirmed", "the game fills it in: the last four level-up moves at that level"]
        out["item"] = ["confirmed", "the game's own held item" if b.get("item") else "the game gives it no item"]
        out["ivs"] = ["confirmed", "the game's IV rule for this trainer"]
        out["evs"] = ["confirmed", "the games give trainers no EVs"]
        out["nature"] = ["unknown", "set by the game from a hidden value the data doesn't fix"]
        out["ability"] = ["standardized", "the game picks it from a hidden value; Blackthorn reads the first ability"] \
            if not b.get("ability_set") else ["confirmed", "the game sets this ability slot"]
        return out
    if kind == "journey":
        full = len(b.get("moves") or []) >= 4 and "engine-filled" not in str(b.get("source", ""))
        out["species"] = ["confirmed", "your own record (canon/rosters.json)"]
        out["moves"] = ["confirmed", "your canon register"] if full else ["standardized", "engine-filled: the strongest set it can learn"]
        for k in ("nature", "ability", "item", "ivs", "evs"):
            out[k] = ["confirmed", "your canon register"] if b.get(k) else ["standardized", std.get(k, "left open")]
        return out
    approved = b.get("status") == "approved"
    out["species"] = ["confirmed", "on the team in the show"] if kind == "anime" else \
        ["confirmed", "one of the trainer's own Pokémon; which six is a curated choice"] if kind == "all-time" else \
        ["hypothetical", "your variant"]
    out["moves"] = ["confirmed", "used in the show, checked against the games' learnsets, approved"] if approved else \
        ["strongly inferred", "drafted from the show and checked against the games' learnsets; not approved yet"]
    out["ability"] = ["strongly inferred", "the show rarely names abilities: one the species can have"] if b.get("ability") else \
        ["standardized", std["ability"]]
    out["item"] = ["strongly inferred", "lore recorded with the build"] if b.get("item") else ["unknown", "no item shown"]
    for k in ("nature", "ivs", "evs", "level"):
        out[k] = ["hypothetical", "set for this version"] if b.get(k) else ["standardized", std[k]]
    return out


class Catalog:
    def __init__(self, store=None):
        sys.path.insert(0, ENGINE)
        from trainers.model import Store
        self.store = store or Store()
        with open(LIBRARY, encoding="utf-8") as fh:
            self.lib = json.load(fh)["records"]
        with open(os.path.join(ENGINE, "battle", "trainer_ai.json"), encoding="utf-8") as fh:
            self.ai = json.load(fh)
        with open(os.path.join(HERE, "team_roles.json"), encoding="utf-8") as fh:
            self.roles = json.load(fh)

    @staticmethod
    def key(party):
        return [(p["species"], p.get("level"), tuple(p.get("moves") or [])) for p in party]

    def canon_versions(self):
        """The authored versions, each with its team as a party, linked to its library record when it is one."""
        lib_by_key = {}
        for r in self.lib:
            lib_by_key.setdefault((r["game"] if r["game"] != "soulsilver" else "heartgold", json.dumps(self.key(r["party"]))), r["id"])
        out = {}
        cfg = self.store.config
        for tid, t in self.store.trainers.items():
            for vid, v in t.versions.items():
                team = self.store.team(v)
                party = []
                for b in team:
                    p = {k: x for k, x in b.to_dict().items() if k in ("species", "level", "moves", "item", "ability", "nature",
                                                                        "ivs", "evs", "nickname", "gender", "status", "source", "friendship", "ball")}
                    party.append(p)
                kind = v.kind
                game = v.game if v.game != "soulsilver" else "heartgold"
                lid = lib_by_key.get((game, json.dumps(self.key(party)))) if kind == "cartridge" else None
                rec = {"identity": tid, "canon_version": vid, "title": v.title, "kind": kind, "game": v.game,
                       "generation": GAME_GEN[v.game], "party": party, "source": v.source, "status": v.status,
                       "sliders": v.sliders, "roles": v.roles, "notes": v.notes, "signature_moves": v.signature_moves,
                       "report": f"{tid}-{vid}", "library": lid}
                if kind != "cartridge":
                    rec["evidence"] = [evidence(p, kind, cfg) for p in party]
                out[f"{tid}/{vid}"] = rec
        return out

    def build(self):
        cfg = self.store.config
        canon = self.canon_versions()
        linked = {c["library"]: k for k, c in canon.items() if c.get("library")}
        versions = {}
        for r in self.lib:
            v = dict(r)                                     # cartridge evidence follows from two facts: see pack()
            if r["id"] in linked:                         # an authored version of this very encounter: its reading joins it
                c = canon[linked[r["id"]]]
                v.update({"canon_version": c["canon_version"], "authored_title": c["title"], "sliders": c["sliders"],
                          "roles": c["roles"], "notes": c["notes"], "report": c["report"], "status": c["status"]})
            versions[r["id"]] = v
        for k, c in canon.items():
            if c.get("library"):
                continue
            c = dict(c)
            c["id"] = k
            c["name"] = self.store.trainers[c["identity"]].name
            c["category"] = {"journey": "journey", "all-time": "all-time"}.get(c["kind"], "anime")
            c["encounter"] = c["title"]
            c["top_level"] = max([p.get("level") or 0 for p in c["party"]] or [0])
            versions[k] = c
        for v in versions.values():
            v["ace"] = ace_of(v["party"])
            if v["kind"] == "cartridge":
                v["reading"] = self.read_ai(v)
        return {"versions": versions, "identities": self.identities(versions), "collections": self.collections(versions)}

    def read_ai(self, v):
        names = v.get("ai_flag_names") or (v.get("ai_flags") if isinstance(v.get("ai_flags"), list) else [])
        out = {"tendency": [], "competence": [], "flags": names}
        for n in names:
            if n in FLAG_READ:
                kind, label = FLAG_READ[n]
                out[kind].append(label)
        for k in ("tendency", "competence"):
            out[k] = list(dict.fromkeys(out[k]))
        return out

    def identities(self, versions):
        ids = {}
        for vid, v in versions.items():
            ids.setdefault(v["identity"], []).append(vid)
        out = {}
        for ident, vids in ids.items():
            vs = [versions[x] for x in vids]
            t = self.store.trainers.get(ident)
            names = list(dict.fromkeys(v.get("name") for v in vs if v.get("name")))
            name = t.name if t else names[0]
            aces = {}
            for v in vs:
                if v.get("ace"):
                    aces[v["ace"]] = aces.get(v["ace"], 0) + 1
            signature = sorted(aces, key=lambda s: (-aces[s], s))[:3]
            if not signature:                               # no levels to pick an ace by (a reconstruction): its signature moves' Pokémon
                sig = [m["pokemon"] for v in vs for m in v.get("signature_moves") or []] + [p["species"] for v in vs for p in v["party"][:1]]
                signature = list(dict.fromkeys(sig))[:3]
            order = {g: i for i, g in enumerate(GAMES)}
            vids.sort(key=lambda x: (order.get(versions[x]["game"] if versions[x]["game"] != "soulsilver" else "heartgold", 9),
                                     versions[x]["kind"] != "cartridge", versions[x].get("top_level") or 0, x))
            out[ident] = {"name": name, "aka": [n for n in names if n != name],
                          "titles": list(dict.fromkeys(v.get("authored_title") or v.get("title") for v in vs)),
                          "categories": list(dict.fromkeys(v["category"] for v in vs)),
                          "kinds": list(dict.fromkeys(v["kind"] for v in vs)),
                          "regions": list(dict.fromkeys(v.get("region") for v in vs if v.get("region"))),
                          "games": list(dict.fromkeys(v["game"] for v in vs)),
                          "signature": signature, "career": t.career if t else [], "notes": t.notes if t else [],
                          "versions": vids}
        return out

    def collections(self, versions):
        out = []

        def add(cid, name, members, gen, lens, threshold=DEFAULT_THRESHOLD, why=None, games=None):
            members = [m for m in members if m in versions]
            if not members:
                return
            rule = {"measure": "share of their Pokémon beaten one-on-one (a draw isn't a win)", "threshold": threshold,
                    "why": why or f"the default bar for a collection: {int(threshold * 100)}%"}
            out.append({"id": cid, "name": name, "generation": gen, "games": games or [], "members": members, "lens": lens,
                        "rule": rule, "version": stamp(sorted(members), rule["threshold"], lens)})
        cart = [v for v in versions.values() if v["kind"] == "cartridge"]
        for g in GAMES:
            gen = GAME_GEN[g]
            vs = [v for v in cart if v["game"] == g]
            first = lambda v: v["encounter"] in ("first battle",) or v["encounter"].startswith("first battle")
            rem = lambda v: v["encounter"].startswith("rematch")
            gname = GAME_NAME[g]
            add(f"{g}-gym", f"{gname} Gym Leaders", [v["id"] for v in vs if v["category"] == "gym" and first(v)], gen, "authentic", games=[g])
            add(f"{g}-gym-rematch", f"{gname} Gym Leader rematches", [v["id"] for v in vs if v["category"] == "gym" and rem(v)], gen, "authentic", games=[g])
            add(f"{g}-elite-four", f"{gname} Elite Four and Champion",
                [v["id"] for v in vs if v["category"] in ("elite_four", "champion") and first(v)], gen, "authentic", games=[g])
            add(f"{g}-elite-four-rematch", f"{gname} Elite Four and Champion rematches",
                [v["id"] for v in vs if v["category"] in ("elite_four", "champion") and rem(v)], gen, "authentic", games=[g])
            add(f"{g}-rivals", f"{gname} rival battles", [v["id"] for v in vs if v["category"] == "rival"], gen, "authentic", games=[g])
            add(f"{g}-villains", f"{gname} villains", [v["id"] for v in vs if v["category"] == "villain"], gen, "authentic", games=[g])
            add(f"{g}-special", f"{gname} special battles", [v["id"] for v in vs if v["category"] == "special"], gen, "authentic", games=[g])
        # Ace's own collections: exactly the team-roles pools, with Ace's bars (the same fights, read here)
        sys.path.insert(0, ENGINE)
        from battle.benchmarks import Benchmarks
        from trainers.model import DB
        bench, lib_key = Benchmarks(DB, None), {}
        for r in self.lib:
            lib_key.setdefault((r["game"], json.dumps(self.key(r["party"]))), r["id"])
        ace = self.roles["roles"]["ace"]
        for gen, pools in self.roles["pools"].items():
            if gen.startswith("_"):
                continue
            loaded = {}
            for pname, members in pools.items():
                if pname.startswith("_"):
                    continue
                ids = []
                for game, name in members:
                    if game not in loaded:
                        loaded[game] = {t["name"]: t for t in bench.load(game)}
                    t = loaded[game][name]
                    g2 = game if game != "soulsilver" else "heartgold"
                    lid = lib_key.get((g2, json.dumps(self.key(t["party"]))))
                    if lid:
                        ids.append(lid)
                bar = ace["elite_four_at_least"] if pname == "elite_four" else ace["champion_at_least"]
                add(f"ace-{pname.replace('_', '-')}-gen{gen}", f"The Ace test: {'Elite Four' if pname == 'elite_four' else 'Champions'} (Gen {gen})",
                    ids, int(gen), "standardized", bar, f"Ace's own bar for this pool (trainers/team_roles.json): {int(bar * 100)}%")
        reco = [k for k, v in versions.items() if v["kind"] in ("anime", "all-time")]
        add("anime-gen4", "Anime trainers (reconstructed, Gen 4)", reco, 4, "standardized")
        add("journey", "Your journey teams", [k for k, v in versions.items() if v["kind"] == "journey" and v["generation"] == 4], 4, "standardized")
        return out

    def pack(self):
        cat = self.build()
        flags = {k: v.get("does") for k, v in self.ai["flags"].items()}
        cfg = self.store.config
        templates = {f"{mf}|{int(ab)}": evidence({"moves_from": mf, "ability_set": ab, "item": None}, "cartridge", cfg)
                     for mf in ("game", "level-up") for ab in (False, True)}
        for t in templates.values():                          # the item line depends on the member; the page fills it
            t.pop("item", None)
        return {"_note": "Built by app/library_pack.py from trainers/catalog.py: the authored trainers (canon/trainers.json) "
                         "and every in-game encounter (trainers/library.py), with evidence classes, lenses and collections. "
                         "A cartridge member's evidence is cartridge_evidence['<moves_from>|<ability_set 0/1>'], plus its item.",
                "cartridge_evidence": templates,
                "item_evidence": {"with": ["confirmed", "the game's own held item"], "without": ["confirmed", "the game gives it no item"]},
                "lenses": LENSES, "classes": CLASSES, "flag_read": FLAG_READ, "flags": flags, "gen4_bits": self.ai["gen4_bits"],
                "coach": self._coach(), "default_threshold": DEFAULT_THRESHOLD, **cat}

    @staticmethod
    def _coach():
        sys.path.insert(0, ENGINE)
        from battle.evaluate import COACH
        return COACH


def main():
    c = Catalog().build()
    kinds = {}
    for v in c["versions"].values():
        kinds[v["kind"]] = kinds.get(v["kind"], 0) + 1
    print(f"{len(c['identities'])} trainers, {len(c['versions'])} versions ({kinds}), {len(c['collections'])} collections")
    for col in c["collections"]:
        print(f"  {col['id']:28} {len(col['members']):3} {col['lens']:12} {col['rule']['threshold']}  v{col['version']}")


if __name__ == "__main__":
    sys.exit(main())
