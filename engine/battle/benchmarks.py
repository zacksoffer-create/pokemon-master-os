"""Benchmarks: each game's real opponents (Elite Four, Champion, Red, the rival), read straight from
the games' own code (pret disassemblies), and a 1v1 matchup grid against them.

Opponent stats follow the source: Crystal trainer DVs by trainer class (data/trainers/dvs.asm);
Gen 3-4 IVs from each Pokémon's difficulty value (IV = value * 31 / 255). Assumed (not in the data
read here): neutral natures and 0 EVs / stat exp, first ability. Moves the data leaves out are the
last four level-up moves at that level, which is how the games fill them in.

The 1v1 model is deliberately simple: best damaging move each way, hits-to-KO, Speed and priority
decide who wins. It ignores status, recovery, switching and items beyond damage. It's a map of
where a team stands, not a battle simulator.
"""
import json
import math
import os
import re

import rules
from refdb import Ref

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(os.path.dirname(HERE), "data", "raw", "trainers")
NAME_FIXES = {"psychicm": "psychic", "faintattack": "feintattack", "hijumpkick": "highjumpkick",
              "vicegrip": "visegrip", "selfdestruct": "selfdestruct"}
HGSS = {"Will": 245, "Koga": 247, "Bruno": 418, "Karen": 246, "Champion Lance": 244, "Red": 260,
        "Will (rematch)": 702, "Koga (rematch)": 703, "Bruno (rematch)": 704, "Karen (rematch)": 705,
        "Champion Lance (rematch)": 701}
BENCHMARK_SETS = {
    "crystal": [("Will", "Will"), ("Koga", "Koga"), ("Bruno", "Bruno"), ("Karen", "Karen"),
                ("Champion Lance", "Champion"), ("Red", "Red"), ("Clair", "Clair")],
    "firered": [("Lorelei", "sParty_EliteFourLorelei"), ("Bruno", "sParty_EliteFourBruno"),
                ("Agatha", "sParty_EliteFourAgatha"), ("Lance", "sParty_EliteFourLance"),
                ("Champion (rival, Squirtle variant)", "sParty_ChampionFirstSquirtle"),
                ("Champion (rival, Bulbasaur variant)", "sParty_ChampionFirstBulbasaur"),
                ("Champion (rival, Charmander variant)", "sParty_ChampionFirstCharmander")],
    "emerald": [("Sidney", "sParty_Sidney"), ("Phoebe", "sParty_Phoebe"), ("Glacia", "sParty_Glacia"),
                ("Drake", "sParty_Drake"), ("Champion Wallace", "sParty_Wallace"), ("Steven", "sParty_Steven")],
    "platinum": [("Aaron", "elite_four_aaron"), ("Bertha", "elite_four_bertha"), ("Flint", "elite_four_flint"),
                 ("Lucian", "elite_four_lucian"), ("Champion Cynthia", "champion_cynthia"),
                 ("Cynthia (rematch)", "champion_cynthia_rematch")],
}


def mon_id(raw):
    s = rules.to_id(re.sub(r"^(SPECIES|MOVE|ITEM)_", "", raw))
    return NAME_FIXES.get(s, s)


class Benchmarks:
    def __init__(self, db_path, battle_engine):
        self.ref = Ref(db_path)
        self.battle = battle_engine

    # --- loading -----------------------------------------------------------------
    def default_moves(self, species, game, level):
        """The last four level-up moves at or below `level` (how the games fill unset movesets)."""
        rows = self.ref.q("""SELECT m.identifier, pm.level FROM pokemon_moves pm JOIN moves m ON m.id=pm.move_id
            WHERE pm.pokemon_id=? AND pm.version_group_id=? AND pm.pokemon_move_method_id=1 AND pm.level<=?
            ORDER BY pm.level, pm."order\"""", self.ref.species_id(species), rules.GAME_VG[game], level)
        moves = []
        for ident, _ in rows:
            if ident in moves:
                moves.remove(ident)
            moves.append(ident)
        gen = rules.GAME_GEN[game]
        data = rules.gen_data(gen)["moves"]
        return [data[mon_id(m)]["name"] for m in moves[-4:] if mon_id(m) in data]

    def _mon(self, game, species_raw, level, moves_raw, item_raw, ivs):
        gen = rules.GAME_GEN[game]
        sp = rules.gen_data(gen)["species"][mon_id(species_raw)]["name"]
        mdata = rules.gen_data(gen)["moves"]
        moves = [mdata[mon_id(m)]["name"] for m in moves_raw if m and mon_id(m) in mdata and mon_id(m) != "none"]
        if not moves:
            moves = self.default_moves(sp, game, level)
        item = None if not item_raw or mon_id(item_raw) == "none" else mon_id(item_raw)
        return {"species": sp, "level": level, "moves": moves, "item": item, "ivs": ivs}

    def _crystal(self):
        text = open(os.path.join(RAW, "crystal_parties.asm"), encoding="utf-8").read()
        dvs = {}
        for line in open(os.path.join(RAW, "crystal_dvs.asm"), encoding="utf-8"):
            m = re.match(r"\s*dn\s+(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*;\s*(\w+)", line)
            if m:
                a, d, s, c = map(int, m.groups()[:4])
                dvs[m.group(5)] = {"atk": a, "def": d, "spe": s, "spa": c, "spd": c, "hp": 15}
        groups, group, cur = {}, None, None
        for line in text.splitlines():
            g = re.match(r"^(\w+)Group:", line)
            if g:
                group = g.group(1)
                groups[group] = []
                continue
            s = line.split(";")[0].strip()
            t = re.match(r'db "(.*?)@",\s*(\w+)', s)
            if t:
                cur = {"type": t.group(2), "party": []}
                groups[group].append(cur)
            elif s.startswith("db -1"):
                cur = None
            elif cur is not None and s.startswith("db "):
                parts = [p.strip() for p in s[3:].split(",")]
                rest = parts[2:]
                item = rest.pop(0) if "ITEM" in cur["type"] else None
                cur["party"].append((int(parts[0]), parts[1], rest[:4] if "MOVES" in cur["type"] else [], item))
        return groups, dvs

    def _gen3(self, game):
        text = open(os.path.join(RAW, f"{game}_trainer_parties.h"), encoding="utf-8").read()
        parties = {}
        for m in re.finditer(r"static const struct \w+ (sParty_\w+)\[\] = \{(.*?)\n\};", text, re.S):
            mons = []
            for b in re.finditer(r"\.iv\s*=\s*(\d+),\s*\.lvl\s*=\s*(\d+),\s*\.species\s*=\s*(\w+)"
                                 r"(?:,\s*\.heldItem\s*=\s*(\w+))?(?:,\s*\.moves\s*=\s*\{([^}]*)\})?", m.group(2)):
                iv, lvl, sp, item, moves = b.groups()
                mons.append((int(iv), int(lvl), sp, item, [x.strip() for x in (moves or "").split(",")]))
            parties[m.group(1)] = mons
        return parties

    def load(self, game):
        """[{name, game, source, party: [{species, level, moves, item, ivs}]}] for this game."""
        out = []
        if game == "crystal":
            groups, dvs = self._crystal()
            for name, group in BENCHMARK_SETS["crystal"]:
                tr = groups[group][0]
                dv = dvs[group.upper()]
                ivs = {k: v * 2 for k, v in dv.items()}
                party = [self._mon(game, sp, lvl, mv, item, ivs) for lvl, sp, mv, item in tr["party"]]
                out.append({"name": name, "game": game, "party": party,
                            "source": f"pret/pokecrystal data/trainers/parties.asm {group}Group (1)"})
            rivals = groups["Rival2"]
            final = max(rivals, key=lambda t: sum(m[0] for m in t["party"]))
            ivs = {k: v * 2 for k, v in dvs["RIVAL2"].items()}
            out.append({"name": "Rival Silver (strongest team)", "game": game, "source": "pret/pokecrystal Rival2Group",
                        "party": [self._mon(game, sp, lvl, mv, item, ivs) for lvl, sp, mv, item in final["party"]]})
        elif game in ("firered", "emerald"):
            parties = self._gen3(game)
            for name, sym in BENCHMARK_SETS[game]:
                party = [self._mon(game, sp, lvl, mv, item, {s: iv * 31 // 255 for s in
                                                             ("hp", "atk", "def", "spa", "spd", "spe")})
                         for iv, lvl, sp, item, mv in parties[sym]]
                out.append({"name": name, "game": game, "party": party,
                            "source": f"pret/poke{game} src/data/trainer_parties.h {sym}"})
        elif game == "platinum":
            for name, fname in BENCHMARK_SETS["platinum"]:
                d = json.load(open(os.path.join(RAW, f"platinum_{fname}.json"), encoding="utf-8"))
                party = [self._mon(game, p["species"], p["level"], p.get("moves", []), p.get("item"),
                                   {s: p.get("iv_scale", 0) * 31 // 255 for s in ("hp", "atk", "def", "spa", "spd", "spe")})
                         for p in d["party"]]
                out.append({"name": name, "game": game, "party": party,
                            "source": f"pret/pokeplatinum res/trainers/data/{fname}.json"})
        elif game in ("heartgold", "soulsilver"):
            trainers = json.load(open(os.path.join(RAW, "hgss_trainers.json"), encoding="utf-8"))["trainers"]
            for name, idx in HGSS.items():
                party = [self._mon(game, p["species"], p["level"], p.get("moves", []), p.get("item"),
                                   {s: p.get("difficulty", 0) * 31 // 255 for s in ("hp", "atk", "def", "spa", "spd", "spe")})
                         for p in trainers[idx]["party"]]
                out.append({"name": name, "game": game, "party": party,
                            "source": f"pret/pokeheartgold files/poketool/trainer/trainers.json #{idx}"})
        return out

    # --- matchups -----------------------------------------------------------------
    def best_moveset(self, member, game):
        """For a species-only member: its four strongest attacks, one per type."""
        attacks = sorted(self.battle.attacks(member, game, potential=True), key=lambda a: -a["score"])
        picked, types = [], set()
        for a in attacks:
            if a["type"] not in types:
                picked.append(a["move"])
                types.add(a["type"])
            if len(picked) == 4:
                break
        return picked

    def matchups(self, team, opponent, level="match"):
        """1v1 grid: for each of our members against each opponent Pokémon, who wins and how."""
        gen = team.gen
        top_level = max(p["level"] for p in opponent["party"])
        ours = []
        for m in team.members:
            moves = m.moves or self.best_moveset(m, team.game)
            ours.append({"species": rules.species(gen, m.species)["name"], "moves": moves,
                         "level": top_level if level == "match" else m.level, "nature": m.nature,
                         "evs": m.evs or None, "ivs": m.ivs or None, "item": m.item,
                         "ability": m.ability})
        reqs, index = [], []
        zero_evs = {s: 0 for s in ("hp", "atk", "def", "spa", "spd", "spe")}
        for oi, o in enumerate(opponent["party"]):
            foe = {"species": o["species"], "level": o["level"], "ivs": o["ivs"], "evs": zero_evs, "item": o["item"]}
            foe.update({k: o[k] for k in ("nature", "ability") if o.get(k)})   # set when the opponent is a built team
            for ui, u in enumerate(ours):
                me = {k: v for k, v in u.items() if k != "moves" and v is not None}
                for mv in u["moves"]:
                    if rules.category(gen, mv) != "Status":
                        reqs.append({"gen": gen, "attacker": me, "defender": foe, "move": mv})
                        index.append(("us", oi, ui, mv))
                for mv in o["moves"]:
                    if rules.category(gen, mv) != "Status":
                        reqs.append({"gen": gen, "attacker": foe, "defender": me, "move": mv})
                        index.append(("them", oi, ui, mv))
        results = self.battle.damage(reqs)
        retry = [i for i, r in enumerate(results) if "error" in r]
        if retry:   # unknown held item names etc.: retry without items
            fixed = self.battle.damage([{**reqs[i], "attacker": {k: v for k, v in reqs[i]["attacker"].items() if k != "item"},
                                         "defender": {k: v for k, v in reqs[i]["defender"].items() if k != "item"}}
                                        for i in retry])
            for i, r in zip(retry, fixed):
                results[i] = r
        best = {}
        for (side, oi, ui, mv), r in zip(index, results):
            if "error" in r:
                continue
            key = (side, oi, ui)
            if key not in best or r["percent"][0] > best[key]["percent"][0]:
                best[key] = {**r, "move": mv}
        grid = []
        for oi, o in enumerate(opponent["party"]):
            row = {"opponent": f"{o['species']} L{o['level']}", "vs": {}}
            for ui, u in enumerate(ours):
                us, them = best.get(("us", oi, ui)), best.get(("them", oi, ui))
                our_hits = math.ceil(100 / us["percent"][0]) if us and us["percent"][0] > 0 else 99
                their_hits = math.ceil(100 / them["percent"][0]) if them and them["percent"][0] > 0 else 99
                our_prio = us and rules.move(gen, us["move"])["priority"] or 0
                their_prio = them and rules.move(gen, them["move"])["priority"] or 0
                speed_us = (us or them or {}).get("attacker_speed" if us else "defender_speed", 0)
                speed_them = (us or them or {}).get("defender_speed" if us else "attacker_speed", 0)
                first = our_prio > their_prio or (our_prio == their_prio and speed_us > speed_them)
                wins = our_hits < their_hits or (our_hits == their_hits and first)
                row["vs"][u["species"]] = {
                    "wins": wins, "we_hit": f"{us['move']} {us['percent'][0]}-{us['percent'][1]}%" if us else "no damage",
                    "they_hit": f"{them['move']} {them['percent'][0]}-{them['percent'][1]}%" if them else "no damage",
                    "hits_to_ko": f"{our_hits} vs {their_hits}", "moves_first": first}
            row["answers"] = [s for s, v in row["vs"].items() if v["wins"]]
            grid.append(row)
        threats = [r["opponent"] for r in grid if not r["answers"]]
        anchors = sorted(((s, sum(r["vs"][s]["wins"] for r in grid)) for s in grid[0]["vs"]), key=lambda x: -x[1])
        return {"opponent": opponent["name"], "source": opponent["source"], "our_level": ours[0]["level"],
                "our_movesets": {u["species"]: u["moves"] for u in ours},
                "grid": grid, "threats": threats, "anchors": anchors}
