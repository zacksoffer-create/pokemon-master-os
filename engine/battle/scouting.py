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
        return {
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
        }

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
        m = self.bench.matchups(team, opponent)
        gen = team.gen
        rows = []
        for r in m["grid"]:
            ranked = sorted(r["vs"].items(), key=lambda kv: self._margin(kv[1]), reverse=True)
            wins = [(s, v) for s, v in ranked if v["wins"]]
            losses = [s for s, v in ranked if not v["wins"] and v["hits_to_ko"].split(" vs ")[1] == "1"]
            rows.append({"they_send": r["opponent"],
                         "call": f"{wins[0][0]}: {wins[0][1]['we_hit']}" if wins else None,
                         "backup": f"{wins[1][0]}: {wins[1][1]['we_hit']}" if len(wins) > 1 else None,
                         "dont_send": losses})
        closers = [(mem.species, [mv for mv in m["our_movesets"][rules.species(gen, mem.species)["name"]]
                                  if rules.move(gen, mv)["priority"] > 0 and rules.category(gen, mv) != "Status"])
                   for mem in team.members]
        return {"opponent": m["opponent"], "source": m["source"], "level": m["our_level"],
                "opener": rows[0] if rows else None, "calls": rows,
                "closers": [f"{s}: {', '.join(p)}" for s, p in closers if p],
                "no_answer": m["threats"], "anchors": m["anchors"], "movesets": m["our_movesets"]}

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
        lines = [f"### {r['species']} ({'/'.join(r['types'])}), {GAME_TITLE[r['game']]}",
                 f"**OFP {r['ofp']['present']} / {r['ofp']['peak']}** (present / peak) · build: {r['build_source']}",
                 "",
                 "| Power | Speed | Phys. bulk | Spec. bulk | Coverage | Utility |", "|---|---|---|---|---|---|",
                 f"| {tool('power')} | {tool('speed')} | {tool('phys_bulk')} | {tool('spec_bulk')} | {tool('coverage')} | {tool('utility')} |",
                 "",
                 f"- **Moves:** {' / '.join(r['moves'])}" + (f" · **peak set:** {' / '.join(r['peak_moves'])}"
                                                             if r["peak_moves"] != r["moves"] and p != g else ""),
                 f"- **Out pitch:** {r['out_pitch']} · **pitch mix:** {r['pitch_mix']['Physical']} physical, "
                 f"{r['pitch_mix']['Special']} special, {r['pitch_mix']['Status']} status ({r['damage_profile']})",
                 f"- **Approach:** {'; '.join(r['approach'])}",
                 f"- **Splits:** sturdier against {r['splits']['better_vs']}",
                 f"- **Hits super-effectively:** {len(r['coverage']['present'])} types"
                 + (f" (peak set: {len(r['coverage']['peak'])})" if len(r['coverage']['peak']) > len(r['coverage']['present']) else ""),
                 "- **Weak to:** " + ", ".join(f"{t} ×{x:g}" for t, x in sorted(r["weak_to"].items(), key=lambda kv: -kv[1]))
                 + (f" · **immune:** {', '.join(r['immune_to'])}" if r["immune_to"] else ""),
                 f"- **Comps:** {', '.join(r['comps'])}"]
        return "\n".join(lines)

    @staticmethod
    def render_call_sheet(c):
        lines = [f"### Call sheet vs {c['opponent']} (Lv {c['level']}, {c['source']})", "",
                 "| They send | The call | Backup | Don't send (KO'd in one hit) |", "|---|---|---|---|"]
        for r in c["calls"]:
            lines.append(f"| {r['they_send']} | {r['call'] or '**no answer**'} | {r['backup'] or '—'} | "
                         f"{', '.join(r['dont_send']) or '—'} |")
        lines += ["", f"- **Opener:** they lead {c['opener']['they_send']}; call {c['opener']['call'] or 'nobody wins it 1v1'}",
                  f"- **Closers (priority):** {'; '.join(c['closers']) or 'none'}",
                  f"- **Anchors (1v1 wins):** {', '.join(f'{s} {w}' for s, w in c['anchors'])}",
                  f"- **No answer:** {', '.join(c['no_answer']) or 'none'}"]
        return "\n".join(lines)
