"""The build layer and the trainer layer's storage (docs/TRAINER_REPORT.md, step 1).

A **build** is plain data: species, nickname, nature, IVs, EVs, moves, held item, ability, ball, friendship,
ribbons and level, tagged with where it came from. Stock builds and your own live in canon/build_library.json; the
journey's builds stay in canon/builds.json (the canon register) and are read from there, not copied.

A **trainer** has **versions** (Kanto Ash, Sinnoh Ash…), and each version has its own game, team, four authored
sliders (each with a reason), role tags, signature notes and per-trainer text overrides. Trainers live in
canon/trainers.json. A version's team is one of:
- `builds`: build ids from the library;
- `lineup`: one of the journey's lineups (canon/rosters.json + builds.json, open slots filled by the engine's
  strongest-set rule, and said so);
- `cartridge`: a game's own trainer, read from the pret data (exact levels, moves, items and IVs; no EVs).

Stats are always computed from the build (nature, IVs, EVs) at the configured level, so the same species is a
different row in a different build. Lore (Ash's Light Ball Pikachu, a Pokémon that refuses its ball) is data on the
build or the version, never engine logic.
"""
import json
import os
from dataclasses import asdict, dataclass, field

from refdb import VG
from trainers.era import GAME_GEN, STATS, Era

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
CANON = os.path.join(ENGINE, "canon")
DB = os.path.join(ENGINE, "data", "pokeref.sqlite")
SLIDERS = ("offense", "rigidity", "bond", "risk")


def load_config():
    with open(os.path.join(HERE, "config.json"), encoding="utf-8") as fh:
        return json.load(fh)


@dataclass
class Build:
    id: str
    species: str
    name: str = None                 # an archetype's name ("Swords Dance sweeper")
    role: str = None                 # the role an archetype is meant for (trainers/roles.json id)
    moves: list = field(default_factory=list)
    nickname: str = None
    gender: str = None
    nature: str = None
    ivs: dict = None
    evs: dict = None
    item: str = None
    ability: str = None
    ball: str = None
    friendship: int = None
    ribbons: list = field(default_factory=list)
    level: int = None
    move_reasons: dict = field(default_factory=dict)   # {move: why it knows it} where the games don't say
    source: str = ""                 # "stock (authored)", "mine", "canon register", "cartridge: …", "anime (authored)"
    generation: int = None
    tier: str = None
    status: str = ""                 # "proposed", "approved", or the canon register's own label
    notes: list = field(default_factory=list)

    def to_dict(self):
        return {k: v for k, v in asdict(self).items() if v not in (None, [], {}, "")}


@dataclass
class Version:
    id: str
    trainer: str
    title: str
    game: str
    team_ref: dict
    sliders: dict = field(default_factory=dict)      # {slider: {"value": 0-100, "why": "…"}}
    roles: list = field(default_factory=list)        # role tags the report config knows (Gym Leader, Champion…)
    source: str = ""
    status: str = "proposed"
    overrides: dict = field(default_factory=dict)    # per-trainer text overrides for named characters
    notes: list = field(default_factory=list)        # lore and canon notes: data, never logic


@dataclass
class Trainer:
    id: str
    name: str
    versions: dict
    notes: list = field(default_factory=list)


class Store:
    """Loads builds and trainers, resolves teams, computes stats and checks builds against the game's data."""

    def __init__(self, db_path=DB, canon=CANON):
        self.era = Era(db_path)
        self.config = load_config()
        self.canon = canon
        with open(os.path.join(canon, "build_library.json"), encoding="utf-8") as fh:
            self.library = {i: Build(id=i, **b) for i, b in json.load(fh)["builds"].items()}
        with open(os.path.join(canon, "trainers.json"), encoding="utf-8") as fh:
            raw = json.load(fh)["trainers"]
        self.trainers = {}
        for tid, t in raw.items():
            versions = {vid: Version(id=vid, trainer=tid, title=v["title"], game=v["game"], team_ref=v["team"],
                                     sliders=v.get("sliders", {}), roles=v.get("roles", []), source=v.get("source", ""),
                                     status=v.get("status", "proposed"), overrides=v.get("overrides", {}),
                                     notes=v.get("notes", []))
                        for vid, v in t["versions"].items()}
            self.trainers[tid] = Trainer(id=tid, name=t["name"], versions=versions, notes=t.get("notes", []))
        self._scout = None

    # --- teams ----------------------------------------------------------------------------------------
    def version(self, trainer_id, version_id=None):
        t = self.trainers[trainer_id]
        return t.versions[version_id or next(iter(t.versions))]

    def team(self, version):
        ref = version.team_ref
        if "builds" in ref:
            return [self.library[b] for b in ref["builds"]]
        if "lineup" in ref:
            return self._lineup(ref["lineup"])
        if "cartridge" in ref:
            return self._cartridge(**ref["cartridge"])
        raise ValueError(f"{version.trainer}/{version.id}: a team needs builds, a lineup or a cartridge trainer")

    def _lineup(self, lineup_id):
        from battle.engine import BattleEngine
        from battle.scouting import Scouting
        from battle.scouting_report import load_lineups
        if self._scout is None:
            self._scout = Scouting(BattleEngine(DB))
        lu = next(l for l in load_lineups() if l["id"] == lineup_id)
        out = []
        for sp, b in lu["members"]:
            member, source = self._scout.member_for(sp, lu["game"], b)
            notes = [] if b.get("moves") and len(b["moves"]) >= 4 else [source]
            out.append(Build(id=f"lineup:{lineup_id}/{sp}", species=member.species, moves=member.moves,
                             nature=member.nature, ability=member.ability, item=member.item, evs=b.get("evs"),
                             ivs=b.get("ivs"), source="canon register (canon/builds.json)",
                             status=b.get("status", "no build on record"), generation=GAME_GEN[lu["game"]], notes=notes))
        return out

    def _cartridge(self, game, trainer=None, index=None, file=None):
        """A game's own trainer, exactly as the pret data has it."""
        from battle.benchmarks import RAW, Benchmarks
        bench = Benchmarks(DB, None)
        gen = GAME_GEN[game]
        if game in ("heartgold", "soulsilver"):
            with open(os.path.join(RAW, "hgss_trainers.json"), encoding="utf-8") as fh:
                tr = json.load(fh)["trainers"][index]
            src = f"pret/pokeheartgold trainers.json #{index}"
        elif game == "platinum":
            with open(os.path.join(RAW, f"platinum_{file}.json"), encoding="utf-8") as fh:
                tr = json.load(fh)
            src = f"pret/pokeplatinum res/trainers/data/{file}.json"
        else:
            raise ValueError(f"cartridge teams for {game} aren't wired yet")
        out = []
        for i, p in enumerate(tr["party"]):
            scale = p.get("difficulty", p.get("iv_scale", 0))
            ivs = {s: scale * 31 // 255 for s in STATS}
            mon = bench._mon(game, p["species"], p["level"], p.get("moves", []), p.get("item"), ivs)
            override = str(p.get("abilityOverride", ""))
            options = self.era.abilities(mon["species"], gen)
            ability = options[1] if "_2" in override and len(options) > 1 else (options[0] if options else None)
            out.append(Build(id=f"cartridge:{game}:{index if index is not None else file}/{i}", species=mon["species"],
                             moves=mon["moves"], level=mon["level"], ivs=ivs, evs={s: 0 for s in STATS},
                             item=self.era.item_name(mon["item"]) if mon["item"] else None, ability=ability,
                             source=f"cartridge: {src}", generation=gen, status="cartridge",
                             notes=["nature: set by the game from a hidden value; not modeled"]))
        return out

    # --- stats and checks -----------------------------------------------------------------------------
    def filled(self, build, gen):
        """The build with the configured defaults in every open field, and the list of defaults used."""
        d = self.config["defaults"]
        used = []
        ivs = build.ivs
        if not ivs:
            ivs = {s: d["ivs"] for s in STATS}
            used.append(f"IVs {d['ivs']}")
        evs = build.evs
        if not evs:
            if d["evs"] == "even":
                evs = {s: d["even_evs_each"] for s in STATS}
                used.append(f"EVs {d['even_evs_each']} in every stat")
            else:
                evs = {s: 0 for s in STATS}
                used.append("no EVs")
        if not build.nature:
            used.append("neutral nature")
        ability = build.ability
        if not ability:
            options = self.era.abilities(build.species, gen)
            ability = options[0] if options else None
            if len(options) > 1:
                used.append(f"ability {ability} (could be {', '.join(options[1:])})")
        return {"ivs": {s: ivs.get(s, d["ivs"]) for s in STATS}, "evs": {s: evs.get(s, 0) for s in STATS},
                "nature": build.nature, "ability": ability}, used

    def stats(self, build, game, level=None):
        gen = GAME_GEN[game]
        scale = self.config["level_scale"]
        lvl = level or (build.level if scale.get("use_build_level") and build.level else scale["default"])
        f, used = self.filled(build, gen)
        return self.era.stats(build.species, gen, lvl, f["nature"], f["ivs"], f["evs"]), lvl, used

    def move_basis(self, build, game):
        """Why the build knows each move (D-048: legality is biological). For each move, the first that applies:
        it learns it in this game; it learns it in another game of any generation; the build records a reason;
        it's from the show. A move with none of these has no reason on record, and the report flags it."""
        gen = GAME_GEN[game]
        here = self.era.game_names()[VG[game]][0]
        out = []
        for mv in build.moves:
            res = self.era.learn(build.species, mv, game)
            if res["in_game"]:
                r = res["in_game"][0]
                how = f"level {r[3]}" if r[2] == "level-up" else r[2]
                out.append({"move": mv, "basis": "this game", "reason": f"learns it in {here} ({how}, as {r[1]})"})
                continue
            anywhere = self.era.learn_anywhere(build.species, mv)
            if anywhere:
                best = min(anywhere, key=lambda r: (abs(r[1] - gen), r[1]))
                how = f"level {best[3]}" if best[2] == "level-up" else best[2]
                out.append({"move": mv, "basis": "another game", "reason": f"learns it in {best[0]} ({how})"})
            elif mv in build.move_reasons:
                out.append({"move": mv, "basis": "on record", "reason": build.move_reasons[mv]})
            elif build.source.startswith("anime"):
                out.append({"move": mv, "basis": "the show", "reason": "uses it in the show (draft: confirm)"})
            else:
                out.append({"move": mv, "basis": "none", "reason": "no reason on record"})
        return out

    def check(self, build, game):
        """What needs a reason or a fix. Moves follow D-048 (legality is biological: any game, the show, or a
        reason on record); only a move with no reason at all is flagged. The rest are data-range checks."""
        gen = GAME_GEN[game]
        v = self.config["validation"]
        flags = []
        try:
            self.era.pokemon_id(build.species)
        except KeyError:
            return [f"{build.species} isn't a species in our data"]
        if self.era.species_gen(build.species) > gen:
            flags.append(f"{build.species} doesn't exist yet in Gen {gen}")
        for b in self.move_basis(build, game):
            if b["basis"] == "none":
                flags.append(f"{b['move']}: {build.species} can't learn it in any game, and no reason is on record")
        if build.nature:
            try:
                self.era.nature(build.nature)
            except KeyError:
                flags.append(f"unknown nature {build.nature}")
        for name, block, cap in (("EV", build.evs, v["max_ev_per_stat"]), ("IV", build.ivs, v["max_iv"])):
            for s, x in (block or {}).items():
                if s not in STATS or not 0 <= x <= cap:
                    flags.append(f"{name} {s} {x} is out of range")
        if build.evs and sum(build.evs.values()) > v["max_ev_total"]:
            flags.append(f"EVs total {sum(build.evs.values())}, over {v['max_ev_total']}")
        if build.ability and gen >= 3 and build.ability not in self.era.abilities(build.species, gen):
            flags.append(f"{build.species} can't have {build.ability} in Gen {gen}")
        if build.friendship is not None and not 0 <= build.friendship <= 255:
            flags.append(f"friendship {build.friendship} is out of range")
        if build.item and not self.era.item_lookup(build.item):
            flags.append(f"item {build.item} isn't in our data")
        return flags
