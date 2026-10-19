"""Battle engine: how a team defends, what it can hit (with the right stat for its era), who
walls it, how fast it is, which tools its playbook holds, and exact damage through Smogon's
calculator. Works for any Team in any of the six games; nothing here is canon-specific.
"""
import json
import os
import subprocess

import rules
from refdb import Ref, VG_GEN

HERE = os.path.dirname(os.path.abspath(__file__))
STAT_FOR = {"Physical": "atk", "Special": "spa"}

# Strategic roles a move can fill (the "playbook"). Priority is read from move data instead.
ROLES = {
    "setup": {"Swords Dance", "Dragon Dance", "Calm Mind", "Nasty Plot", "Bulk Up", "Curse",
              "Agility", "Belly Drum", "Growth", "Rock Polish", "Iron Defense", "Amnesia"},
    "recovery": {"Recover", "Roost", "Slack Off", "Soft-Boiled", "Milk Drink", "Rest", "Synthesis",
                 "Morning Sun", "Moonlight", "Wish", "Aqua Ring", "Ingrain", "Leech Seed", "Heal Order"},
    "status_care": {"Heal Bell", "Aromatherapy", "Refresh"},
    "pivot": {"U-turn", "Baton Pass"},
    "hazards": {"Spikes", "Stealth Rock", "Toxic Spikes"},
    "hazard_control": {"Rapid Spin", "Defog"},
    "phazing": {"Roar", "Whirlwind", "Haze"},
    "status": {"Toxic", "Thunder Wave", "Will-O-Wisp", "Hypnosis", "Sleep Powder", "Spore",
               "Stun Spore", "Glare", "Yawn", "Lovely Kiss", "Sing", "Dark Void", "Confuse Ray"},
    "disruption": {"Taunt", "Encore", "Disable", "Trick", "Switcheroo", "Knock Off", "Perish Song",
                   "Destiny Bond", "Counter", "Mirror Coat", "Sucker Punch"},
    "screens": {"Reflect", "Light Screen", "Safeguard"},
    "weather": {"Sunny Day", "Rain Dance", "Sandstorm", "Hail"},
    "speed_control": {"Thunder Wave", "Trick Room", "Tailwind", "Icy Wind"},
}


class BattleEngine:
    def __init__(self, db_path):
        self.ref = Ref(db_path)

    # --- move pools ------------------------------------------------------------
    def learnable(self, species, game):
        """Every move the species line can learn in this game's generation (D-024 standard)."""
        vg = rules.GAME_VG[game]
        gen = VG_GEN[vg]
        vgs = [v for v, g in VG_GEN.items() if g == gen]
        line = self.ref.line(self.ref.species_id(species))
        rows = self.ref.q(f"""SELECT DISTINCT m.identifier FROM pokemon_moves pm JOIN moves m ON m.id=pm.move_id
            WHERE pm.pokemon_id IN ({",".join(map(str, line))})
              AND pm.version_group_id IN ({",".join(map(str, vgs))})""")
        data = rules.gen_data(gen)["moves"]
        return sorted(data[i]["name"] for i in (rules.to_id(r[0]) for r in rows) if i in data)

    def moves_of(self, member, game, potential=False):
        return self.learnable(member.species, game) if potential or not member.moves else member.moves

    def ability_of(self, member, gen):
        options = rules.abilities(gen, member.species)
        return member.ability or (options[0] if options else None)

    # --- defense ----------------------------------------------------------------
    def defense(self, team):
        gen = team.gen
        matrix, weak, resist, immune = {}, {}, {}, {}
        for t in rules.TYPES:
            row = {}
            for m in team.members:
                row[m.species] = rules.effectiveness(gen, t, rules.species(gen, m.species)["types"],
                                                     self.ability_of(m, gen))
            matrix[t] = row
            weak[t] = [s for s, x in row.items() if x > 1]
            resist[t] = [s for s, x in row.items() if 0 < x < 1]
            immune[t] = [s for s, x in row.items() if x == 0]
        flags = [f"assumed ability {self.ability_of(m, gen)} for {m.species} (options: "
                 f"{', '.join(rules.abilities(gen, m.species))})"
                 for m in team.members if not m.ability and len(rules.abilities(gen, m.species)) > 1]
        for t in rules.TYPES:
            covered = len(resist[t]) + len(immune[t])
            if len(weak[t]) >= 3 or (len(weak[t]) >= 2 and covered == 0):
                flags.append(f"{t}: {len(weak[t])} weak ({', '.join(weak[t])}), "
                             f"{covered} resist/immune")
        return {"matrix": matrix, "weak": weak, "resist": resist, "immune": immune, "flags": flags}

    # --- offense ----------------------------------------------------------------
    def attacks(self, member, game, potential=False):
        """Damaging moves with era category, STAB and the attacking stat that powers them."""
        gen = rules.GAME_GEN[game]
        sp = rules.species(gen, member.species)
        out = []
        for name in self.moves_of(member, game, potential):
            mv = rules.move(gen, name)
            cat = rules.category(gen, name)
            if cat == "Status" or mv["bp"] < 20:
                continue
            stab = 1.5 if mv["type"] in sp["types"] else 1.0
            stat = sp["bs"][STAT_FOR[cat]]
            out.append({"move": mv["name"], "type": mv["type"], "category": cat, "bp": mv["bp"],
                        "stab": stab, "stat": stat, "score": round(mv["bp"] * stab * stat / 100)})
        return out

    def coverage(self, team, potential=False, min_score=60):
        """Best hit on each single type; a move only counts if it's actually threatening
        (power x STAB x the attacking stat it uses)."""
        gen = team.gen
        best = {}
        for t in rules.TYPES:
            top = (0, None)
            for m in team.members:
                for a in self.attacks(m, team.game, potential):
                    if a["score"] < min_score:
                        continue
                    x = rules.effectiveness(gen, a["type"], [t])
                    if x > top[0]:
                        top = (x, f"{m.species}: {a['move']} ({a['category']}, score {a['score']})")
            best[t] = top
        return {"super_effective": {t: b[1] for t, b in best.items() if b[0] > 1},
                "neutral_only": [t for t, b in best.items() if b[0] == 1],
                "resisted_only": [t for t, b in best.items() if 0 < b[0] < 1],
                "no_answer": [t for t, b in best.items() if b[0] == 0]}

    def walls(self, team, min_score=60):
        """Fully evolved species of this generation that resist or ignore every threatening move
        the team actually carries (judged by the defender's best ability)."""
        gen = team.gen
        attacks = [a for m in team.members for a in self.attacks(m, team.game) if a["score"] >= min_score]
        if not attacks:
            return []
        dex_max = {2: 251, 3: 386, 4: 493}[gen]
        final = {rules.to_id(r[0]) for r in self.ref.q(
            "SELECT s.identifier FROM pokemon_species s WHERE s.id<=? AND NOT EXISTS "
            "(SELECT 1 FROM pokemon_species c WHERE c.evolves_from_species_id=s.id AND c.id<=?)", dex_max, dex_max)}
        out = []
        for sid, sp in rules.gen_data(gen)["species"].items():
            if sid not in final:   # not fully evolved, out of this generation's dex, or an alternate form
                continue
            abil = rules.abilities(gen, sp["name"])
            top = max(rules.effectiveness(gen, a["type"], sp["types"],
                                          rules.best_defensive_ability(gen, sp["types"], a["type"], abil))
                      for a in attacks)
            if top < 1:
                out.append(sp["name"])
        return sorted(out)

    # --- speed ------------------------------------------------------------------
    def speed(self, team):
        gen = team.gen
        rows = []
        for m in team.members:
            base = rules.species(gen, m.species)["bs"]["spe"]
            if gen == 2:
                stat = ((base + 15) * 2 + 63) * m.level // 100 + 5
            else:
                core = (2 * base + m.ivs.get("spe", 31) + m.evs.get("spe", 0) // 4) * m.level // 100 + 5
                stat = core
                if m.nature:
                    n = self.ref.q("SELECT increased_stat_id i, decreased_stat_id d FROM natures "
                                   "WHERE identifier=?", m.nature.lower())[0]
                    stat = core * (110 if n["i"] == 6 != n["d"] else 90 if n["d"] == 6 != n["i"] else 100) // 100
            prio = sorted({mv for mv in self.moves_of(m, team.game)
                           if rules.move(gen, mv)["priority"] > 0 and rules.category(gen, mv) != "Status"})
            rows.append({"species": m.species, "base": base, f"stat_at_L{m.level}": stat, "priority_moves": prio})
        return sorted(rows, key=lambda r: -r["base"])

    # --- playbook ---------------------------------------------------------------
    def playbook(self, team, potential=False):
        holders = {role: [] for role in ROLES}
        for m in team.members:
            pool = set(self.moves_of(m, team.game, potential))
            for role, moves in ROLES.items():
                hit = sorted(pool & moves)
                if hit:
                    holders[role].append(f"{m.species} ({', '.join(hit[:3])}{'…' if len(hit) > 3 else ''})")
        return holders

    # --- exact damage -------------------------------------------------------------
    def damage(self, requests):
        """requests: [{gen, attacker: {...}, defender: {...}, move}] -> Smogon calc results."""
        proc = subprocess.run(["node", os.path.join(HERE, "calc_bridge.mjs")], input=json.dumps(requests),
                              capture_output=True, text=True, cwd=HERE, check=True)
        return json.loads(proc.stdout)

    def report(self, team, potential=None):
        potential = all(not m.moves for m in team.members) if potential is None else potential
        return {"defense": self.defense(team), "coverage": self.coverage(team, potential),
                "walls": self.walls(team) if not potential else "n/a (needs actual movesets)",
                "speed": self.speed(team), "playbook": self.playbook(team, potential),
                "mode": "potential (learnable pool)" if potential else "actual movesets"}
