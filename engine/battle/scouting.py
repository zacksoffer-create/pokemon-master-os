"""Scouting reports and call sheets (D-043): the battle pillar as a front office reads it.

Not a simulator. A *scouting report* grades a Pokémon the way a baseball scout grades a player: tools on
the 20-80 scale (50 = average, 60 plus, 70 plus-plus, 80 elite), present and peak, plus tendencies,
splits and comps. Grades are era-adjusted: each one is measured against the fully evolved Pokémon of
that game's generation, so a Crystal Pokémon and a HeartGold Pokémon can be compared like OPS+.
A *call sheet* is a team's plan against one opponent, built from the benchmark 1v1 grid: the call for
every Pokémon they can send out, the backup, who not to send, the closers and the open threats.
"""
import math
import statistics

import rules
from battle.engine import ROLES as ROLES_ALL
from team import Member, Team

GAME_TITLE = {"crystal": "Crystal", "firered": "FireRed", "emerald": "Emerald", "platinum": "Platinum",
              "heartgold": "HeartGold", "soulsilver": "SoulSilver"}
TOOL_NOTE = {"power": "top attacking stat", "speed": "Speed", "phys_bulk": "HP x Defense", "spec_bulk": "HP x Sp. Def",
             "coverage": "types hit super-effectively by threatening moves", "utility": "strategic roles in the moveset"}
COVERAGE_GRADE = [(15, 80), (13, 70), (11, 60), (9, 55), (7, 50), (5, 45), (3, 40), (1, 30), (0, 20)]
UTILITY_GRADE = [(6, 80), (5, 70), (4, 60), (3, 55), (2, 50), (1, 40), (0, 30)]
PRIORITY_ROLE = "priority"
SIGNATURE_ITEMS = {"Pikachu": "Light Ball", "Marowak": "Thick Club", "Farfetch'd": "Stick"}   # species-only boosters
# Left out of a "peak" set: moves that need a recharge, a charge turn, a condition, or a faint to work.
UNRELIABLE = {"Hyper Beam", "Giga Impact", "Blast Burn", "Frenzy Plant", "Hydro Cannon", "Rock Wrecker", "Roar of Time",
              "Solar Beam", "Sky Attack", "Skull Bash", "Razor Wind", "Focus Punch", "Dream Eater", "Explosion",
              "Self-Destruct", "Future Sight", "Doom Desire", "Last Resort", "Snore", "Dig", "Dive", "Bounce", "Fly",
              "Shadow Force", "Natural Gift", "Fling", "Spit Up", "Synchronoise", "Belch", "Present", "Magnitude",
              "Rollout", "Ice Ball", "Fake Out", "Counter", "Mirror Coat", "Bide", "Endeavor", "Trump Card"}
ROLE_PREFERENCE = {
    "setup": ["Dragon Dance", "Swords Dance", "Nasty Plot", "Calm Mind", "Bulk Up", "Curse", "Agility", "Rock Polish",
              "Amnesia", "Iron Defense", "Growth", "Belly Drum"],
    "recovery": ["Roost", "Recover", "Slack Off", "Soft-Boiled", "Milk Drink", "Synthesis", "Moonlight", "Morning Sun",
                 "Wish", "Rest", "Aqua Ring", "Ingrain", "Leech Seed", "Heal Order"],
}


GRADE_WORDS = [(80, "elite"), (70, "plus-plus"), (60, "plus"), (55, "above-average"), (50, "average"),
               (45, "fringe-average"), (40, "below-average"), (30, "well below-average"), (20, "poor")]
WHAT_IF_GAME = "heartgold"   # the what-if league: every team at Lv 100 under Gen 4 rules (the ranch era)


def grade_word(g):
    return next(w for floor, w in GRADE_WORDS if g >= floor)


def to_grade(z):
    """z-score -> scouting grade: 50 + 10 per standard deviation, rounded to 5, kept within 20-80."""
    return int(max(20, min(80, 5 * round((50 + 10 * z) / 5))))


def rubric(value, table):
    return next(g for floor, g in table if value >= floor)


class Scouting:
    def __init__(self, battle, benchmarks=None):
        self.battle = battle
        self.ref = battle.ref
        self.bench = benchmarks
        self._pop = {}

    # --- the population a grade is measured against ------------------------------
    def population(self, gen):
        if gen not in self._pop:
            dex_max = {2: 251, 3: 386, 4: 493}[gen]
            final = {rules.to_id(r[0]) for r in self.ref.q(
                "SELECT s.identifier FROM pokemon_species s WHERE s.id<=? AND NOT EXISTS "
                "(SELECT 1 FROM pokemon_species c WHERE c.evolves_from_species_id=s.id AND c.id<=?)", dex_max, dex_max)}
            rows = {sid: sp for sid, sp in rules.gen_data(gen)["species"].items() if sid in final}
            metrics = {sid: self._raw(sp["bs"]) for sid, sp in rows.items()}
            stats = {k: (statistics.mean(m[k] for m in metrics.values()), statistics.pstdev(m[k] for m in metrics.values()))
                     for k in ("power", "speed", "phys_bulk", "spec_bulk")}
            self._pop[gen] = {"rows": rows, "metrics": metrics, "stats": stats}
        return self._pop[gen]

    @staticmethod
    def _raw(bs):
        return {"power": max(bs["atk"], bs["spa"]), "speed": bs["spe"],
                "phys_bulk": bs["hp"] * bs["def"], "spec_bulk": bs["hp"] * bs["spd"]}

    # --- one player's report -----------------------------------------------------------
    def coverage_of(self, member, game, min_score=60):
        gen = rules.GAME_GEN[game]
        hits = [a for a in self.battle.attacks(member, game) if a["score"] >= min_score]
        return sorted({t for t in rules.TYPES for a in hits if rules.effectiveness(gen, a["type"], [t]) > 1})

    def roles_of(self, member, game):
        team = Team(game, [member])
        roles = {r for r, holders in self.battle.playbook(team).items() if holders}
        gen = rules.GAME_GEN[game]
        if any(rules.move(gen, m)["priority"] > 0 and rules.category(gen, m) != "Status" for m in member.moves):
            roles.add(PRIORITY_ROLE)
        return sorted(roles)

    def accuracy(self, move):
        try:
            r = self.ref.q("SELECT accuracy FROM moves WHERE id=?", self.ref.move_id(move))
        except KeyError:
            return 100
        return int(r[0][0]) if r and r[0][0] else 100

    def peak_moveset(self, species, game, rejected=(), min_score=60):
        """The 'peak of its powers' set from everything it can learn (D-024): its most reliable strong STAB
        attack, then the attacks that add the most new super-effective types, then its best setup or
        recovery move. Rejected moves and moves that need a recharge, a charge turn or a condition are left out."""
        gen = rules.GAME_GEN[game]
        types = rules.species(gen, species)["types"]
        pool = [dict(a, value=a["score"] * self.accuracy(a["move"]) / 100)
                for a in self.battle.attacks(Member(species), game, potential=True)
                if a["score"] >= min_score and a["move"] not in UNRELIABLE and a["move"] not in rejected]
        pool.sort(key=lambda a: -a["value"])
        se = lambda a: {t for t in rules.TYPES if rules.effectiveness(gen, a["type"], [t]) > 1}
        picked, covered = [], set()
        stab = [a for a in pool if a["stab"] > 1]
        if stab:
            picked.append(stab[0])
            covered |= se(stab[0])
        while len(picked) < 3:
            rest = [a for a in pool if a["move"] not in {p["move"] for p in picked} and a["type"] not in {p["type"] for p in picked}]
            if not rest:
                break
            best = max(rest, key=lambda a: (len(se(a) - covered), a["value"]))
            picked.append(best)
            covered |= se(best)
        moves = [a["move"] for a in picked]
        learnable = set(self.battle.learnable(species, game)) - set(rejected)
        for role in ("setup", "recovery"):
            options = [m for m in ROLE_PREFERENCE[role] if m in learnable and not (m == "Curse" and "Ghost" in types)]
            if options and len(moves) < 4:
                moves.append(options[0])
        for a in pool:
            if len(moves) >= 4:
                break
            if a["move"] not in moves:
                moves.append(a["move"])
        return moves[:4]

    def pitch_baseline(self, gen):
        """Mean and spread of every fully evolved Pokémon's best STAB attack (power x STAB x stat x accuracy)."""
        key = ("pitch", gen)
        if key not in self._pop:
            game = {2: "crystal", 3: "emerald", 4: "heartgold"}[gen]
            vals = []
            for sp in self.population(gen)["rows"].values():
                try:
                    stab = [a for a in self.battle.attacks(Member(sp["name"]), game, potential=True) if a["stab"] > 1]
                except KeyError:
                    continue
                stab = [a for a in stab if a["move"] not in UNRELIABLE]
                if stab:
                    vals.append(max(a["score"] * self.accuracy(a["move"]) / 100 for a in stab))
            self._pop[key] = (statistics.mean(vals), statistics.pstdev(vals))
        return self._pop[key]

    def arsenal(self, member, game):
        """Each move as a pitch: type, category in that era, power, accuracy, a 20-80 grade for attacks
        (against the generation's best STAB hits) and its job in the set."""
        gen = rules.GAME_GEN[game]
        mean, sd = self.pitch_baseline(gen)
        attacks = {a["move"]: a for a in self.battle.attacks(member, game)}
        stab_types = {a["type"] for a in attacks.values() if a["stab"] > 1}
        se_by_stab = {t for t in rules.TYPES for st in stab_types if rules.effectiveness(gen, st, [t]) > 1}
        best = max(attacks.values(), key=lambda a: a["score"] * self.accuracy(a["move"]), default=None)
        out = []
        for name in member.moves:
            mv = rules.move(gen, name)
            cat = rules.category(gen, name)
            acc = self.accuracy(name)
            row = {"move": mv["name"], "type": mv["type"], "category": cat, "power": mv["bp"] or None,
                   "accuracy": acc, "priority": mv["priority"]}
            a = attacks.get(mv["name"])
            if a:
                value = a["score"] * acc / 100
                row.update(grade=to_grade((value - mean) / sd), stab=a["stab"] > 1)
                adds = sorted({t for t in rules.TYPES if rules.effectiveness(gen, a["type"], [t]) > 1} - se_by_stab)
                tags = []
                if best and a["move"] == best["move"]:
                    tags.append("out pitch")
                tags.append("STAB" if a["stab"] > 1 else "coverage")
                if mv["priority"] > 0:
                    tags.append("closer")
                row.update(tags=tags, adds_coverage=adds if a["stab"] == 1 else [])
            else:
                roles = [r for r, ms in ROLES_ALL.items() if mv["name"] in ms]
                row.update(grade=None, stab=False, tags=roles or ["utility"], adds_coverage=[])
            out.append(row)
        return out

    def type_chart(self, member, game):
        """Splits by type: the best multiplier its moves land on each type, and what each type does to it."""
        gen = rules.GAME_GEN[game]
        sp = rules.species(gen, member.species)
        abil = member.ability or (rules.abilities(gen, member.species) or [None])[0]
        attacks = [a for a in self.battle.attacks(member, game)]
        chart = []
        for t in rules.TYPES:
            hits = [(rules.effectiveness(gen, a["type"], [t]), a["move"]) for a in attacks]
            off = max(hits, default=(0, None))
            chart.append({"type": t, "offense": off[0], "best_move": off[1],
                          "defense": rules.effectiveness(gen, t, sp["types"], abil)})
        return chart

    def trouble(self, member, game, n=5):
        """Tough matchups: fully evolved Pokémon of the generation that hit it super-effectively with
        their own type and take no better than neutral from anything it carries. Strongest first."""
        gen = rules.GAME_GEN[game]
        me = rules.species(gen, member.species)
        abil = member.ability or (rules.abilities(gen, member.species) or [None])[0]
        attacks = [a for a in self.battle.attacks(member, game) if a["score"] >= 40]
        out = []
        for sp in self.population(gen)["rows"].values():
            if sp["name"] == me["name"] or self._legendary(sp["name"]):
                continue
            threat = max(rules.effectiveness(gen, t, me["types"], abil) for t in sp["types"])
            if threat <= 1:
                continue
            their_abil = rules.abilities(gen, sp["name"]) if gen >= 3 else []
            ours = max((rules.effectiveness(gen, a["type"], sp["types"],
                                            rules.best_defensive_ability(gen, sp["types"], a["type"], their_abil))
                        for a in attacks), default=0)
            if ours <= 1:
                out.append((threat, max(sp["bs"]["atk"], sp["bs"]["spa"]) + sp["bs"]["spe"], sp["name"], ours))
        out.sort(key=lambda x: (-x[0], -x[1]))
        return [{"species": name, "hits_it": f"x{t:g}", "best_it_can_do": f"x{o:g}"} for t, _, name, o in out[:n]]

    def _legendary(self, name):
        try:
            r = self.ref.q("SELECT is_legendary, is_mythical FROM pokemon_species WHERE id=?", self.ref.species_id(name))
        except KeyError:
            return False
        return bool(r and (int(r[0][0]) or int(r[0][1])))

    @staticmethod
    def projection(grades, roles):
        """The role a scout would project, from tools and the moveset's jobs."""
        bulk = max(grades["phys_bulk"], grades["spec_bulk"])
        if "setup" in roles and grades["power"] >= 60:
            return "setup sweeper"
        if "recovery" in roles and bulk >= 60:
            return "wall"
        if "pivot" in roles:
            return "pivot"
        if grades["speed"] >= 65 and grades["power"] >= 60:
            return "speed attacker"
        if grades["power"] >= 60 and min(grades["phys_bulk"], grades["spec_bulk"]) >= 55:
            return "tank"
        if PRIORITY_ROLE in roles:
            return "closer"
        if "status" in roles or "screens" in roles:
            return "utility"
        return "attacker"

    def risk(self, member, game, grades, arsenal):
        gen = rules.GAME_GEN[game]
        sp = rules.species(gen, member.species)
        abil = member.ability or (rules.abilities(gen, member.species) or [None])[0]
        reasons = []
        if min(grades["phys_bulk"], grades["spec_bulk"]) <= 40:
            reasons.append("frail on one side")
        out = next((r for r in arsenal if "out pitch" in r.get("tags", [])), None)
        if out and out["accuracy"] < 85:
            reasons.append(f"out pitch is {out['accuracy']}% accurate")
        fours = [t for t in rules.TYPES if rules.effectiveness(gen, t, sp["types"], abil) >= 4]
        if fours:
            reasons.append(f"4x weak to {', '.join(fours)}")
        if SIGNATURE_ITEMS.get(member.species) and member.item != SIGNATURE_ITEMS[member.species]:
            reasons.append(f"plays without its {SIGNATURE_ITEMS[member.species]}")
        level = "low" if not reasons else "medium" if len(reasons) == 1 else "high"
        return {"level": level, "reasons": reasons}

    def take(self, r):
        """The scout's summary line, built only from the report's own numbers."""
        g = r["grades"]["present"]
        bulk = round((g["phys_bulk"] + g["spec_bulk"]) / 2 / 5) * 5
        out = next((a for a in r["arsenal"] if "out pitch" in a["tags"]), None)
        parts = [f"{grade_word(g['power']).capitalize()} power, {grade_word(g['speed'])} speed, {grade_word(bulk)} bulk.",
                 f"Projects as {'an' if r['role'][0] in 'aeiou' else 'a'} {r['role']}."]
        if out:
            parts.append(f"Out pitch: {out['move']} ({out['grade']}).")
        if r["trouble"]:
            parts.append(f"Gets in trouble against {', '.join(t['species'] for t in r['trouble'][:3])}.")
        return " ".join(parts)

    def report(self, species, game, build=None):
        gen = rules.GAME_GEN[game]
        sp = rules.species(gen, species)
        pop = self.population(gen)
        raw = self._raw(sp["bs"])
        build = build or {}
        moves = build.get("moves") or []
        source = build.get("status") or "no build on record: strongest learnable set"
        rejected = build.get("rejected", [])
        alt = self.peak_moveset(species, game, rejected)
        if moves and len(moves) < 4:   # a partial build: keep what's on record, fill the rest from the peak set
            source += f"; slots {len(moves) + 1}-4 filled from its strongest learnable set"
            moves = moves + [m for m in alt if m not in moves][:4 - len(moves)]
        member = Member(species, moves=moves or alt, nature=build.get("nature"),
                        ability=build.get("ability"), item=build.get("item"))
        peak = Member(species, moves=alt)
        grades = {k: to_grade((raw[k] - pop["stats"][k][0]) / pop["stats"][k][1]) for k in pop["stats"]}
        cov_now, cov_peak = self.coverage_of(member, game), self.coverage_of(peak, game)
        roles_now, roles_peak = self.roles_of(member, game), self.roles_of(peak, game)
        present = {**grades, "coverage": rubric(len(cov_now), COVERAGE_GRADE), "utility": rubric(len(roles_now), UTILITY_GRADE)}
        # peak = the better of the build as recorded and the best alternative set, tool by tool
        future = {**grades, "coverage": max(present["coverage"], rubric(len(cov_peak), COVERAGE_GRADE)),
                  "utility": max(present["utility"], rubric(len(roles_peak), UTILITY_GRADE))}

        def ofp(g):   # overall: the plain average of the tools (bulk counts once), not rounded to 5
            return round((g["power"] + g["speed"] + (g["phys_bulk"] + g["spec_bulk"]) / 2 + g["coverage"] + g["utility"]) / 5)

        attacks = sorted(self.battle.attacks(member, game), key=lambda a: -a["score"])
        mix = {c: sum(1 for m in member.moves if rules.category(gen, m) == c) for c in ("Physical", "Special", "Status")}
        abil = member.ability or (rules.abilities(gen, species) or [None])[0]
        weak = {t: rules.effectiveness(gen, t, sp["types"], abil) for t in rules.TYPES}
        out = {
            "species": sp["name"], "game": game, "types": sp["types"], "moves": member.moves, "build_source": source,
            "peak_moves": peak.moves, "grades": {"present": present, "peak": future},
            "ofp": {"present": ofp(present), "peak": ofp(future)},
            "out_pitch": attacks[0]["move"] if attacks else None,
            "pitch_mix": mix, "damage_profile": self._profile(member, gen, build.get("nature_note")),
            "approach": self._approach(member, game, roles_now),
            "splits": {"better_vs": "physical hitters" if raw["phys_bulk"] > raw["spec_bulk"] else "special hitters",
                       "phys_bulk_grade": grades["phys_bulk"], "spec_bulk_grade": grades["spec_bulk"]},
            "coverage": {"present": cov_now, "peak": cov_peak},
            "roles": {"present": roles_now, "peak": roles_peak},
            "weak_to": {t: x for t, x in weak.items() if x > 1}, "immune_to": [t for t, x in weak.items() if x == 0],
            "comps": self.comps(species, gen),
            "body": self._body(species),
        }
        out["arsenal"] = self.arsenal(member, game)
        out["type_chart"] = self.type_chart(member, game)
        out["trouble"] = self.trouble(member, game)
        out["role"] = self.projection(present, roles_now)
        out["risk"] = self.risk(member, game, present, out["arsenal"])
        out["take"] = self.take(out)
        return out

    def _body(self, species):
        r = self.ref.q("SELECT height, weight FROM pokemon WHERE id=?", self.ref.species_id(species))[0]
        return {"height_m": int(r["height"]) / 10, "weight_kg": int(r["weight"]) / 10}

    def _profile(self, member, gen, nature_note=None):
        by_cat = {c: [m for m in member.moves if rules.category(gen, m) == c and rules.move(gen, m)["bp"] > 20]
                  for c in ("Physical", "Special")}
        if by_cat["Physical"] and by_cat["Special"]:
            note = "mixed attacker"
            if member.nature and gen >= 3:
                n = self.ref.q("SELECT decreased_stat_id d, increased_stat_id i FROM natures WHERE identifier=?",
                               member.nature.lower())
                cut = {2: "Physical", 4: "Special"}.get(n[0]["d"]) if n and n[0]["d"] != n[0]["i"] else None
                if cut:
                    note += f"; {member.nature} weakens {', '.join(by_cat[cut])}"
            elif gen >= 3:
                note += f"; nature {nature_note or 'not set'}: any nature that cuts Attack or Sp. Atk weakens half the set"
            return note
        return "physical attacker" if by_cat["Physical"] else "special attacker" if by_cat["Special"] else "no attacks"

    def _approach(self, member, game, roles):
        gen = rules.GAME_GEN[game]
        notes = []
        if "setup" in roles:
            notes.append("sets up, then sweeps")
        if "recovery" in roles:
            notes.append("stays in and outlasts")
        if "pivot" in roles:
            notes.append("hits and pivots out")
        if "status" in roles:
            notes.append("cripples first")
        prio = [m for m in member.moves if rules.move(gen, m)["priority"] > 0 and rules.category(gen, m) != "Status"]
        if prio:
            notes.append(f"closes with {', '.join(prio)}")
        return notes or ["straight attacker: picks the best hit every turn"]

    def comps(self, species, gen, n=3):
        """Most similar fully evolved Pokémon of the generation by base-stat shape."""
        pop = self.population(gen)
        me = rules.species(gen, species)
        v = [me["bs"][k] for k in ("hp", "atk", "def", "spa", "spd", "spe")]

        def dist(sp):
            w = [sp["bs"][k] for k in ("hp", "atk", "def", "spa", "spd", "spe")]
            return math.dist(v, w) - (15 if set(sp["types"]) & set(me["types"]) else 0)
        ranked = sorted((sp for sid, sp in pop["rows"].items() if sp["name"] != me["name"]), key=dist)
        return [sp["name"] for sp in ranked[:n]]

    # --- a team's call sheet against one opponent ----------------------------------------
    def call_sheet(self, team, opponent):
        """The game plan against one opponent, from the benchmark 1v1 grid: the call for each Pokémon
        they can send (and what they hit back with), the backup, who not to send, the lead, their best
        player, what to do if they set up, the closers and the last man standing."""
        m = self.bench.matchups(team, opponent)
        gen = team.gen
        rows = []
        for r, o in zip(m["grid"], opponent["party"]):
            ranked = sorted(r["vs"].items(), key=lambda kv: self._margin(kv[1]), reverse=True)
            wins = [(s, v) for s, v in ranked if v["wins"]]
            losses = [s for s, v in ranked if not v["wins"] and v["hits_to_ko"].split(" vs ")[1] == "1"]
            ghost = "Ghost" in rules.species(gen, o["species"])["types"]   # a Ghost's Curse costs HP, it doesn't boost
            setup = [mv for mv in o["moves"] if mv in ROLES_ALL["setup"] and not (mv == "Curse" and ghost)]
            rows.append({"they_send": r["opponent"], "their_moves": o["moves"], "their_item": o.get("item"),
                         "beats_of_ours": sum(1 for v in r["vs"].values() if not v["wins"]),
                         "call": f"{wins[0][0]}: {wins[0][1]['we_hit']}" if wins else None,
                         "call_detail": {"member": wins[0][0], **wins[0][1]} if wins else None,
                         "backup": f"{wins[1][0]}: {wins[1][1]['we_hit']}" if len(wins) > 1 else None,
                         "dont_send": losses, "sets_up_with": setup})
        closers = [(mem.species, [mv for mv in m["our_movesets"][rules.species(gen, mem.species)["name"]]
                                  if rules.move(gen, mv)["priority"] > 0 and rules.category(gen, mv) != "Status"])
                   for mem in team.members]
        wins_by = {s: sum(r["vs"][s]["wins"] for r in m["grid"]) for s in m["grid"][0]["vs"]} if m["grid"] else {}
        lead = max(wins_by, key=lambda s: (m["grid"][0]["vs"][s]["wins"], wins_by[s])) if wins_by else None
        danger = max(rows, key=lambda r: r["beats_of_ours"]) if rows else None
        return {"opponent": m["opponent"], "source": m["source"], "level": m["our_level"],
                "opener": rows[0] if rows else None, "lead": lead, "calls": rows,
                "their_best": {"species": danger["they_send"], "beats": danger["beats_of_ours"]} if danger else None,
                "if_they_set_up": [{"they_send": r["they_send"], "move": ", ".join(r["sets_up_with"]),
                                    "answer": r["call"] or "no clean answer: hit it before it moves"}
                                   for r in rows if r["sets_up_with"]],
                "closers": [f"{s}: {', '.join(p)}" for s, p in closers if p],
                "last_one_standing": m["anchors"][0][0] if m["anchors"] else None,
                "no_answer": m["threats"], "anchors": m["anchors"], "movesets": m["our_movesets"],
                "record": wins_by}

    # --- the what-if league: every journey team against every other at its peak --------------
    @staticmethod
    def as_opponent(label, members):
        return {"name": label, "game": WHAT_IF_GAME, "source": "journey team, Lv 100, Gen 4 rules",
                "party": [{"species": rules.species(4, m.species)["name"], "level": 100, "moves": m.moves,
                           "item": m.item, "nature": m.nature, "ability": m.ability,
                           "ivs": {k: 31 for k in ("hp", "atk", "def", "spa", "spd", "spe")}} for m in members]}

    def what_if_league(self, teams):
        """teams: {label: [Member]}. Every team meets every other at Lv 100 under Gen 4 rules; a team's
        score is how many of the 36 one-on-one matchups it wins. Not a simulation: the same benchmark grid."""
        labels = list(teams)
        matrix = {a: {} for a in labels}
        for a in labels:
            for b in labels:
                if a == b:
                    continue
                m = self.bench.matchups(Team(WHAT_IF_GAME, teams[a]), self.as_opponent(b, teams[b]))
                matrix[a][b] = sum(v["wins"] for r in m["grid"] for v in r["vs"].values())
        standings = []
        for a in labels:
            won = sum(matrix[a].values())
            played = 36 * (len(labels) - 1)
            series = sum(1 for b in labels if b != a and matrix[a][b] > matrix[b][a])
            standings.append({"team": a, "wins": won, "losses": played - won, "pct": round(won / played, 3),
                              "series_won": series})
        standings.sort(key=lambda r: (-r["series_won"], -r["pct"]))
        return {"rules": "Lv 100, Gen 4 rules, 31 IVs, no EVs, builds as recorded", "standings": standings,
                "matrix": matrix}

    @staticmethod
    def _margin(v):
        """Wins first, then the quickest win (fewest of our hits), then the widest margin."""
        ours, theirs = (int(x) for x in v["hits_to_ko"].split(" vs "))
        return (v["wins"], -ours, theirs - ours, v["moves_first"])

    # --- rendering -------------------------------------------------------------------------
    @staticmethod
    def render_report(r):
        g, p = r["grades"]["present"], r["grades"]["peak"]
        tool = lambda k: f"{g[k]}" if g[k] == p[k] else f"{g[k]} / {p[k]}"
        risk = r["risk"]["level"] + (f" ({'; '.join(r['risk']['reasons'])})" if r["risk"]["reasons"] else "")
        lines = [f"### {r['species']} ({'/'.join(r['types'])}), {GAME_TITLE[r['game']]}",
                 f"**OFP {r['ofp']['present']} / {r['ofp']['peak']}** (present / peak) · **role:** {r['role']} · "
                 f"**risk:** {risk} · build: {r['build_source']}",
                 "", f"> {r['take']}", "",
                 "| Power | Speed | Phys. bulk | Spec. bulk | Coverage | Utility |", "|---|---|---|---|---|---|",
                 f"| {tool('power')} | {tool('speed')} | {tool('phys_bulk')} | {tool('spec_bulk')} | {tool('coverage')} | {tool('utility')} |",
                 "", "| Pitch | Type | Kind | Power | Acc. | Grade | Job |", "|---|---|---|---|---|---|---|"]
        for a in r["arsenal"]:
            job = ", ".join(a["tags"]) + (f" (adds {', '.join(a['adds_coverage'])})" if a["adds_coverage"] else "")
            lines.append(f"| {a['move']} | {a['type']} | {a['category']} | {a['power'] or '—'} | {a['accuracy']} | "
                         f"{a['grade'] if a['grade'] is not None else '—'} | {job} |")
        lines += ["",
                  (f"- **Peak set:** {' / '.join(r['peak_moves'])}" if r["peak_moves"] != r["moves"] and p != g else None),
                  f"- **Pitch mix:** {r['pitch_mix']['Physical']} physical, {r['pitch_mix']['Special']} special, "
                  f"{r['pitch_mix']['Status']} status ({r['damage_profile']})",
                  f"- **Approach:** {'; '.join(r['approach'])}",
                  f"- **Splits:** sturdier against {r['splits']['better_vs']}",
                  "- **Weak to:** " + ", ".join(f"{t} ×{x:g}" for t, x in sorted(r["weak_to"].items(), key=lambda kv: -kv[1]))
                  + (f" · **immune:** {', '.join(r['immune_to'])}" if r["immune_to"] else ""),
                  "- **Tough matchups:** " + (", ".join(f"{t['species']} (hits it {t['hits_it']})" for t in r["trouble"]) or "none"),
                  f"- **Comps:** {', '.join(r['comps'])}"]
        return "\n".join(x for x in lines if x is not None)

    @staticmethod
    def render_call_sheet(c):
        lines = [f"### Call sheet vs {c['opponent']} (Lv {c['level']}, {c['source']})", "",
                 "| They send | The call | Backup | Don't send (KO'd in one hit) |", "|---|---|---|---|"]
        for r in c["calls"]:
            lines.append(f"| {r['they_send']} | {r['call'] or '**no answer**'} | {r['backup'] or '—'} | "
                         f"{', '.join(r['dont_send']) or '—'} |")
        lines += ["", f"- **Opener:** they lead {c['opener']['they_send']}; call {c['opener']['call'] or 'nobody wins it 1v1'}",
                  f"- **Lead with:** {c['lead']} · **their best player:** {c['their_best']['species']} "
                  f"(beats {c['their_best']['beats']} of ours)",
                  *[f"- **If {x['they_send']} sets up ({x['move']}):** {x['answer']}" for x in c["if_they_set_up"]],
                  f"- **Last one standing:** {c['last_one_standing']}",
                  f"- **Closers (priority):** {'; '.join(c['closers']) or 'none'}",
                  f"- **Anchors (1v1 wins):** {', '.join(f'{s} {w}' for s, w in c['anchors'])}",
                  f"- **No answer:** {', '.join(c['no_answer']) or 'none'}"]
        return "\n".join(lines)
