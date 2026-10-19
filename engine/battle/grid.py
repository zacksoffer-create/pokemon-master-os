"""The benchmark grid, played out by the evaluation layer: the same shape `Benchmarks.matchups` returns, so the
scouting reports (call sheets, advance reports, game plans, the what-if league) read the scouting engine's fights
instead of a hits-to-KO count.

Each cell is one evaluated one-on-one: our best plan against their best answer. `wins` is whether ours wins it,
`hits_to_ko` and the best hits both ways are the unboosted numbers the advance form prints, and `value` is the
evaluation layer's ranking of the result, which the call sheet uses to pick its call and backup.

Our side is built with the knowledge layer's defaults (docs/SCOUTING_ENGINE.md, layer 1). A game's trainers keep
what their data says: their level, DVs or IVs, moves and item, with no EVs, as the cartridge has them, and they pick
their moves with the game's own AI flags (battle/trainer_policy.py). A journey team met as an opponent (the what-if
league) gets the same defaults ours do and plays like ours.
"""
import json
import math
import os

import rules
from battle.knowledge import STATS, Combatant, from_build

HERE = os.path.dirname(os.path.abspath(__file__))
ZERO_EVS = {s: 0 for s in STATS}


class EngineGrid:
    def __init__(self, evaluator):
        self.ev = evaluator
        self.last = None

    def ours(self, team, level=None):
        gen = team.gen
        return [from_build(gen, m.species, {"moves": m.moves, "nature": m.nature, "ability": m.ability,
                                            "item": m.item, "evs": m.evs or None, "ivs": m.ivs or None,
                                            **({"level": level} if level else {})},
                           name=rules.species(gen, m.species)["name"]) for m in team.members]

    @staticmethod
    def ai_of(opponent):
        """The trainer's AI flags as names (HGSS stores a bitmask), plus which game it is where the AI differs."""
        raw = opponent.get("ai_flags") or []
        if isinstance(raw, int):
            with open(os.path.join(HERE, "trainer_ai.json"), encoding="utf-8") as fh:
                bits = json.load(fh)["gen4_bits"]
            raw = [name for name, bit in bits.items() if raw & bit]
        if not raw:
            return ()
        return tuple(sorted(set(raw) | ({"GAME_EMERALD"} if opponent.get("game") == "emerald" else set())))

    def theirs(self, opponent, gen):
        peak = str(opponent.get("source", "")).startswith("journey team")
        ai = () if peak else self.ai_of(opponent)
        out = []
        for p in opponent["party"]:
            name = rules.species(gen, p["species"])["name"]
            if peak:
                out.append(from_build(gen, name, {k: p.get(k) for k in ("moves", "item", "nature", "ability", "ivs",
                                                                        "level")}, name=name))
            else:
                out.append(Combatant(species=name, gen=gen, moves=list(p["moves"]), level=p["level"], item=p.get("item"),
                                     ivs=p.get("ivs"), evs=dict(ZERO_EVS), nature=p.get("nature"),
                                     ability=p.get("ability"), name=f"{name} L{p['level']}", ai=ai,
                                     source=opponent.get("source", "")))
        return out

    def matchups(self, team, opponent, level="match"):
        gen = team.gen
        top = max(p["level"] for p in opponent["party"])
        ours = self.ours(team, top if level == "match" else None)
        theirs = self.theirs(opponent, gen)
        res = self.ev.versus(ours, theirs)
        web, grid, evaluated = [], [], {}
        for oi, b in enumerate(theirs):
            row = {"opponent": f"{b.species} L{b.level}", "vs": {}}
            for ui, a in enumerate(ours):
                m = res[(a.key, b.key)]
                evaluated[(oi, ui)] = m
                web += [{"side": "us", "theirs": oi, "ours": ui, "move": mv, "min": lo, "max": hi}
                        for mv, (lo, hi) in m.damage.items()]
                web += [{"side": "them", "theirs": oi, "ours": ui, "move": mv, "min": lo, "max": hi}
                        for mv, (lo, hi) in m.incoming.items()]
                us = max(m.damage.items(), key=lambda kv: kv[1][0], default=None)
                them = max(m.incoming.items(), key=lambda kv: kv[1][0], default=None)
                hits = lambda best: math.ceil(100 / best[1][0]) if best and best[1][0] > 0 else 99
                row["vs"][a.species] = {
                    "wins": m.outcome.winner == "A", "draw": m.outcome.winner == "draw",
                    "we_hit": f"{us[0]} {us[1][0]}-{us[1][1]}%" if us and us[1][0] > 0 else "no damage",
                    "they_hit": f"{them[0]} {them[1][0]}-{them[1][1]}%" if them and them[1][0] > 0 else "no damage",
                    "hits_to_ko": f"{hits(us)} vs {hits(them)}", "moves_first": m.straight.first_hit == "A",
                    "value": list(m.outcome.value()), "plan": m.plan.label()}
            row["answers"] = [s for s, v in row["vs"].items() if v["wins"]]
            grid.append(row)
        anchors = sorted(((a.species, sum(r["vs"][a.species]["wins"] for r in grid)) for a in ours), key=lambda x: -x[1])
        out = {"opponent": opponent["name"], "source": opponent["source"], "our_level": ours[0].level,
               "our_movesets": {a.species: a.moves for a in ours}, "our_names": [a.species for a in ours],
               "web": web, "grid": grid, "threats": [r["opponent"] for r in grid if not r["answers"]],
               "anchors": anchors, "evaluated": evaluated, "ours": ours, "theirs": theirs}
        self.last = out
        return out
