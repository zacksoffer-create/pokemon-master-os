"""Scouting reports and call sheets (D-043, D-046): the battle pillar as a front office reads it.

No grades. A scouting report is tendencies and a philosophy: the engine measures a Pokémon (speed against
its generation, which side its attacks come from, what it does with a free turn, what it does when it's low,
which types and moves it handles), and the phrase book (phrasebook.json, editable) turns those numbers into
plain-language lines, the way the games turn a Pokémon's best IV into "Likes to thrash about".
For opponents, the same book reads their moves, items and the game's own trainer AI flags (trainer_ai.json),
and the call sheet says how to attack each one. Not a simulator: matchups come from the benchmark 1v1 grid.
"""
import json
import math
import os

import rules
from battle.engine import ROLES
from battle.phrases import Phrasebook
from team import Member, Team

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_TITLE = {"crystal": "Crystal", "firered": "FireRed", "emerald": "Emerald", "platinum": "Platinum",
              "heartgold": "HeartGold", "soulsilver": "SoulSilver"}
GAME_VERSION_IDS = {"crystal": [6], "firered": [10], "emerald": [9], "platinum": [14], "heartgold": [15],
                    "soulsilver": [16]}
with open(os.path.join(HERE, "species_items.json"), encoding="utf-8") as _fh:   # species-only boosters (data)
    SIGNATURE_ITEMS = json.load(_fh)["items"]
# Left out of a filled-in set: moves that need a recharge, a charge turn, a condition, or a faint to work.
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
RECOIL = {"Volt Tackle", "Flare Blitz", "Brave Bird", "Double-Edge", "Take Down", "Wood Hammer", "Head Smash", "Submission"}
LOCK_IN = {"Outrage", "Petal Dance", "Thrash"}
CHARGE = {"Fly", "Dig", "Dive", "Bounce", "Solar Beam", "Sky Attack", "Skull Bash", "Razor Wind", "Shadow Force"}
RISKY = {"Explosion", "Self-Destruct", "Destiny Bond", "Memento", "Perish Song"}
PROTECT = {"Protect", "Detect", "Endure"}
ABILITY_NOTES = {
    "Thick Fat": "Fire and Ice moves only do half", "Levitate": "Ground moves miss it entirely",
    "Water Absorb": "Water moves heal it instead", "Volt Absorb": "Electric moves heal it instead",
    "Flash Fire": "Fire moves power it up instead", "Motor Drive": "Electric moves make it faster instead",
    "Intimidate": "your Attack drops the moment it comes in", "Inner Focus": "it never flinches",
    "Snow Cloak": "harder to hit in hail", "Sand Veil": "harder to hit in a sandstorm", "Sturdy": "one-hit KO moves fail",
    "Immunity": "it can't be poisoned", "Limber": "it can't be paralyzed", "Insomnia": "it can't be put to sleep",
    "Vital Spirit": "it can't be put to sleep", "Natural Cure": "switching out cures its status",
    "Static": "touching it can paralyze you", "Flame Body": "touching it can burn you",
    "Poison Point": "touching it can poison you", "Rough Skin": "touching it hurts", "Sand Stream": "it brings a sandstorm",
    "Drizzle": "it brings rain", "Drought": "it brings sun", "Swift Swim": "doubles its Speed in rain",
    "Chlorophyll": "doubles its Speed in sun", "Guts": "a status condition makes it hit harder",
    "Marvel Scale": "a status condition makes it sturdier", "Filter": "super-effective hits do less",
    "Solid Rock": "super-effective hits do less", "Heatproof": "Fire moves do half", "Dry Skin": "Water heals it, Fire hurts more",
    "Clear Body": "its stats can't be lowered", "Keen Eye": "its accuracy can't be lowered", "Synchronize": "it passes its status back",
    "Pressure": "your moves burn extra PP", "Shed Skin": "it can shake off status between turns",
    "Torrent": "Water moves hit harder when it's low", "Blaze": "Fire moves hit harder when it's low",
    "Overgrow": "Grass moves hit harder when it's low", "Swarm": "Bug moves hit harder when it's low",
    "Steadfast": "flinching makes it faster", "Technician": "weak moves hit harder", "Adaptability": "same-type moves hit even harder",
    "Iron Fist": "punches hit harder", "Rock Head": "no recoil damage", "Magnet Pull": "Steel types can't escape it",
    "Hustle": "hits harder but misses more",
}
ITEM_NOTES = {
    "Leftovers": "it heals a little every turn", "Black Sludge": "it heals a little every turn",
    "Lum Berry": "it shrugs off the first status", "Sitrus Berry": "it heals once when it drops to half",
    "Focus Sash": "from full health it survives any single hit", "Light Ball": "its attacks hit twice as hard",
    "Life Orb": "every attack hits harder and costs it HP", "Choice Band": "big physical hits, locked into one move",
    "Choice Specs": "big special hits, locked into one move", "Choice Scarf": "faster, locked into one move",
    "NeverMeltIce": "Ice moves hit harder", "Expert Belt": "super-effective hits land harder",
    "Quick Claw": "sometimes it moves first anyway", "King's Rock": "its hits can make you flinch",
    "Bright Powder": "it's harder to hit", "Scope Lens": "more critical hits", "Shell Bell": "its hits heal it a little",
}


# Which status moves a target shrugs off, by type and by ability (Gen 4 rules; Gen 2-3 agree for these).
STATUS_EFFECT = {"Toxic": "poison", "Poison Powder": "poison", "Poison Gas": "poison", "Thunder Wave": "paralysis",
                 "Stun Spore": "paralysis", "Glare": "paralysis", "Will-O-Wisp": "burn", "Hypnosis": "sleep",
                 "Sleep Powder": "sleep", "Spore": "sleep", "Sing": "sleep", "Lovely Kiss": "sleep", "Grass Whistle": "sleep",
                 "Dark Void": "sleep", "Yawn": "sleep", "Confuse Ray": "confusion", "Supersonic": "confusion",
                 "Swagger": "confusion", "Sweet Kiss": "confusion"}
STATUS_IMMUNE_TYPES = {"poison": {"Poison", "Steel"}, "burn": {"Fire"}, "paralysis": set(), "sleep": set(),
                       "confusion": set()}
STATUS_IMMUNE_ABILITIES = {"poison": {"Immunity"}, "paralysis": {"Limber"}, "sleep": {"Insomnia", "Vital Spirit"},
                           "burn": {"Water Veil"}, "confusion": {"Own Tempo"}}
TRAINER_ITEMS = ["Full Restore", "Max Potion", "Hyper Potion", "Super Potion", "Potion", "Full Heal", "Max Revive",
                 "Revive", "X Attack", "X Defend", "X Speed", "X Special", "Guard Spec.", "Dire Hit"]


def join(items, word="and"):
    items = [str(i) for i in items]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + f" {word} " + items[-1]


class Scouting:
    def __init__(self, battle, benchmarks=None, phrasebook=None, grid=None):
        self.battle = battle
        self.ref = battle.ref
        self.bench = benchmarks
        self.grid = grid or benchmarks   # the matchup grid: the scouting engine's fights (battle/grid.py), else the old count
        self.book = phrasebook or Phrasebook()
        self._pop = {}
        with open(os.path.join(HERE, "trainer_ai.json"), encoding="utf-8") as fh:
            self.trainer_ai = json.load(fh)

    # --- the field a Pokémon is measured against ----------------------------------------
    def population(self, gen):
        if gen not in self._pop:
            dex_max = {2: 251, 3: 386, 4: 493}[gen]
            final = {rules.to_id(r[0]) for r in self.ref.q(
                "SELECT s.identifier FROM pokemon_species s WHERE s.id<=? AND NOT EXISTS "
                "(SELECT 1 FROM pokemon_species c WHERE c.evolves_from_species_id=s.id AND c.id<=?)", dex_max, dex_max)}
            self._pop[gen] = {"rows": {sid: sp for sid, sp in rules.gen_data(gen)["species"].items() if sid in final}}
        return self._pop[gen]

    def share_below(self, gen, fn, value):
        """Share of the generation's fully evolved Pokémon that fall below this value."""
        vals = [fn(sp["bs"]) for sp in self.population(gen)["rows"].values()]
        return sum(v < value for v in vals) / len(vals)

    # --- moves -------------------------------------------------------------------------------
    def accuracy(self, move):
        try:
            r = self.ref.q("SELECT accuracy FROM moves WHERE id=?", self.ref.move_id(move))
        except KeyError:
            return 100
        return int(r[0][0]) if r and r[0][0] else 100

    def coverage_of(self, member, game, min_score=60):
        gen = rules.GAME_GEN[game]
        hits = [a for a in self.battle.attacks(member, game) if a["score"] >= min_score]
        return sorted({t for t in rules.TYPES for a in hits if rules.effectiveness(gen, a["type"], [t]) > 1})

    def strongest_set(self, species, game, rejected=(), min_score=60):
        """The set the engine fills in when no build is on record: its most reliable strong STAB attack, the
        attacks that add the most new super-effective types, then its best setup or recovery move (D-024)."""
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
            rest = [a for a in pool if a["move"] not in {p["move"] for p in picked}
                    and a["type"] not in {p["type"] for p in picked}]
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

    @staticmethod
    def moves_by_role(moves, types):
        """Strategic jobs in a moveset (a Ghost's Curse costs HP, so it isn't setup)."""
        return {role: [m for m in moves if m in ms and not (m == "Curse" and "Ghost" in types)]
                for role, ms in ROLES.items()}

    # --- the type picture --------------------------------------------------------------------
    def type_chart(self, member, game):
        """Splits by type: the best multiplier its moves land on each type, and what each type does to it."""
        gen = rules.GAME_GEN[game]
        sp = rules.species(gen, member.species)
        abil = member.ability or (rules.abilities(gen, member.species) or [None])[0]
        attacks = self.battle.attacks(member, game)
        chart = []
        for t in rules.TYPES:
            off = max(((rules.effectiveness(gen, a["type"], [t]), a["move"]) for a in attacks), default=(0, None))
            chart.append({"type": t, "offense": off[0], "best_move": off[1],
                          "defense": rules.effectiveness(gen, t, sp["types"], abil)})
        return chart

    def _legendary(self, name):
        try:
            r = self.ref.q("SELECT is_legendary, is_mythical FROM pokemon_species WHERE id=?", self.ref.species_id(name))
        except KeyError:
            return False
        return bool(r and (int(r[0][0]) or int(r[0][1])))

    def trouble(self, member, game, n=4):
        """Who gives it trouble: non-legendary fully evolved Pokémon of the generation that hit it
        super-effectively with their own type and take no better than neutral from anything it carries."""
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
                out.append((threat, max(sp["bs"]["atk"], sp["bs"]["spa"]) + sp["bs"]["spe"], sp["name"]))
        out.sort(key=lambda x: (-x[0], -x[1]))
        return [name for _, _, name in out[:n]]

    def comps(self, species, gen, n=3):
        """Most similar fully evolved Pokémon of the generation by base-stat shape."""
        me = rules.species(gen, species)
        v = [me["bs"][k] for k in ("hp", "atk", "def", "spa", "spd", "spe")]

        def dist(sp):
            w = [sp["bs"][k] for k in ("hp", "atk", "def", "spa", "spd", "spe")]
            return math.dist(v, w) - (15 if set(sp["types"]) & set(me["types"]) else 0)
        ranked = sorted((sp for sp in self.population(gen)["rows"].values() if sp["name"] != me["name"]), key=dist)
        return [sp["name"] for sp in ranked[:n]]

    def makeup(self, species, game):
        """Its own Pokédex entry in that game: the scout's line on makeup."""
        ids = GAME_VERSION_IDS[game]
        r = self.ref.q(f"SELECT flavor_text FROM pokemon_species_flavor_text WHERE species_id=? AND language_id=9 "
                       f"AND version_id IN ({','.join(map(str, ids))})", self.ref.species_id(species))
        return " ".join(r[0][0].replace("\xad ", "").replace("\xad", "").split()) if r else None

    # --- one of ours: the numbers, then the phrases ------------------------------------------
    def member_for(self, species, game, build=None):
        build = build or {}
        moves = list(build.get("moves") or [])
        source = build.get("status") or "no build on record: the engine filled in its strongest set"
        if len(moves) < 4:
            fill = self.strongest_set(species, game, build.get("rejected", []))
            if moves:
                source += f"; slots {len(moves) + 1}-4 filled in by the engine"
            moves = moves + [m for m in fill if m not in moves][:4 - len(moves)]
        return Member(species, moves=moves, nature=build.get("nature"), ability=build.get("ability"),
                      item=build.get("item")), source

    def metrics(self, member, game, build=None):
        """Every number and fact the phrase book can read about one of ours."""
        build = build or {}
        gen = rules.GAME_GEN[game]
        sp = rules.species(gen, member.species)
        bs = sp["bs"]
        abil = member.ability or (rules.abilities(gen, member.species) or [None])[0]
        attacks = sorted(self.battle.attacks(member, game), key=lambda a: -a["score"] * self.accuracy(a["move"]))
        dmg = [m for m in member.moves if rules.category(gen, m) != "Status" and rules.move(gen, m)["bp"] > 20]
        phys = [m for m in dmg if rules.category(gen, m) == "Physical"]
        spec = [m for m in dmg if rules.category(gen, m) == "Special"]
        roles = self.moves_by_role(member.moves, sp["types"])
        prio = [m for m in member.moves if rules.move(gen, m)["priority"] > 0 and rules.category(gen, m) != "Status"]
        chart = self.type_chart(member, game)
        coverage = self.coverage_of(member, game)
        phys_bulk = self.share_below(gen, lambda b: b["hp"] * b["def"], bs["hp"] * bs["def"])
        spec_bulk = self.share_below(gen, lambda b: b["hp"] * b["spd"], bs["hp"] * bs["spd"])
        cut = []
        if member.nature and gen >= 3:
            n = self.ref.q("SELECT decreased_stat_id d, increased_stat_id i FROM natures WHERE identifier=?",
                           member.nature.lower())
            if n and n[0]["d"] != n[0]["i"]:
                cut = phys if n[0]["d"] == 2 else spec if n[0]["d"] == 4 else []
        holes = sorted((c for c in chart if c["defense"] > 1), key=lambda c: -c["defense"])
        item = member.item
        sig = SIGNATURE_ITEMS.get(member.species)
        return {
            "name": sp["name"], "game_title": GAME_TITLE[game], "types": sp["types"],
            "speed_pct": self.share_below(gen, lambda b: b["spe"], bs["spe"]),
            "power_pct": self.share_below(gen, lambda b: max(b["atk"], b["spa"]), max(bs["atk"], bs["spa"])),
            "phys_bulk_pct": phys_bulk, "spec_bulk_pct": spec_bulk,
            "bulk_lean": "physical" if phys_bulk - spec_bulk >= 0.2 else "special" if spec_bulk - phys_bulk >= 0.2 else "even",
            "min_bulk_pct": min(phys_bulk, spec_bulk), "max_bulk_pct": max(phys_bulk, spec_bulk),
            "lean": "mixed" if phys and spec else "physical" if phys else "special" if spec else "status",
            "phys_str": join(phys), "spec_str": join(spec), "nature": member.nature,
            "nature_cut_str": join(cut), "nature_open": bool(phys and spec and not member.nature and gen >= 3),
            "nature_note": build.get("nature_note"),
            "setup_str": join(roles["setup"], "or"), "recovery_str": join(roles["recovery"], "or"),
            "status_str": join(roles["status"], "or"), "pivot_str": join(roles["pivot"]),
            "phaze_str": join(roles["phazing"], "or"), "hazard_str": join(roles["hazards"]),
            "screen_str": join(roles["screens"]), "disrupt_str": join(roles["disruption"], "or"),
            "status_care_str": join(roles["status_care"], "or"), "priority_str": join(prio, "or"),
            "has_rest": "Rest" in member.moves,
            "out_pitch": attacks[0]["move"] if attacks else None,
            "out_pitch_type": attacks[0]["type"] if attacks else None,
            "coverage_n": len(coverage), "coverage_str": join(coverage),
            "walls_str": join([c["type"] for c in chart if 0 < c["offense"] <= 0.5]),
            "zero_str": join([c["type"] for c in chart if c["offense"] == 0]),
            "holes_str": join([f"{c['type']} (×{c['defense']:g})" for c in holes]),
            "fours_str": join([c["type"] for c in holes if c["defense"] >= 4]),
            "immune_str": join([c["type"] for c in chart if c["defense"] == 0]),
            "toxic_immune": bool({"Poison", "Steel"} & set(sp["types"])) or abil == "Immunity",
            "ability": abil if gen >= 3 else None, "ability_note": ABILITY_NOTES.get(abil) if gen >= 3 else None,
            "item": item, "item_note": ITEM_NOTES.get(item) if item else None,
            "signature_missing": sig if sig and item != sig else None,
            "recoil_str": join([m for m in dmg if m in RECOIL]), "lock_str": join([m for m in dmg if m in LOCK_IN]),
            "charge_str": join([m for m in dmg if m in CHARGE]),
            "shaky_str": join([f"{m} ({self.accuracy(m)}%)" for m in dmg if self.accuracy(m) < 90]),
            "risky_str": join([m for m in member.moves if m in RISKY]),
            "protect_str": join([m for m in member.moves if m in PROTECT], "or"),
            "trouble_str": join(self.trouble(member, game)), "comps_str": join(self.comps(member.species, gen)),
            "makeup": self.makeup(member.species, game),
        }

    def report(self, species, game, build=None, record=None):
        """One of ours: the build, the numbers, and the phrases those numbers trigger."""
        member, source = self.member_for(species, game, build)
        ctx = self.metrics(member, game, build)
        if record:
            w, l = record
            ctx.update(record_w=w, record_l=l, record_n=w + l, record_pct=w / (w + l) if w + l else None)
        r = self.ref.q("SELECT height, weight FROM pokemon WHERE id=?", self.ref.species_id(species))[0]
        return {"species": ctx["name"], "game": game, "types": ctx["types"], "moves": member.moves,
                "nature": member.nature, "ability": ctx["ability"], "item": member.item, "build_source": source,
                "body": {"height_m": int(r["height"]) / 10, "weight_kg": int(r["weight"]) / 10},
                "type_chart": self.type_chart(member, game), "record": record,
                "phrases": self.book.speak("player", ctx),
                "numbers": {k: round(v, 3) for k, v in ctx.items() if k.endswith("_pct") and v is not None}}

    # --- a trainer, from the game's own data ---------------------------------------------------
    def trainer_context(self, opponent):
        """The trainer's AI flags, bag and battle lines, as the phrase book reads them."""
        game = opponent["game"]
        gen = rules.GAME_GEN[game]
        raw = opponent.get("ai_flags") or []
        if isinstance(raw, int):   # HGSS stores the flags as a bitmask
            raw = [name for name, bit in self.trainer_ai.get("gen4_bits", {}).items() if raw & bit]
        flags = {f.upper().replace("AI_FLAG_", "").replace("AI_SCRIPT_", "").replace("AI_", "") for f in raw}
        items = [self._item_name(i) for i in opponent.get("items") or [] if i and "NONE" not in str(i).upper()]
        heals = [i for i in items if i in self.trainer_ai.get("healing_items", [])]
        party = opponent["party"]
        ctx = {f"ai_{f.lower()}": True for f in flags}
        ctx.update(trainer=opponent["name"], game_title=GAME_TITLE[game], gen=gen, ai_flags_str=join(sorted(flags)),
                   heal_items_n=len(heals), heal_item=heals[0] if heals else None, items_str=join(items),
                   lead=party[0]["species"] if party else None,
                   party_str=", ".join(f"{p['species']} (Lv {p['level']})" for p in party),
                   ace=max(party, key=lambda p: p["level"])["species"] if party else None,
                   switch_rule=self.trainer_ai.get("switching_phrase", {}).get(str(gen)),
                   heal_rule=self.trainer_ai.get("items_phrase", {}).get(str(gen)))
        for msg in opponent.get("messages") or []:
            ctx[f"msg_{msg['type'].lower()}"] = msg["text"]
        return ctx

    def opponent_context(self, o, row, m, team):
        """One of theirs: its moves, what it does to each of ours, and how we hurt it."""
        gen = team.gen
        types = rules.species(gen, o["species"])["types"]
        abil = (rules.abilities(gen, o["species"]) or [None])[0] if gen >= 3 else None
        roles = self.moves_by_role(o["moves"], types)
        dmg = [mv for mv in o["moves"] if rules.category(gen, mv) != "Status" and rules.move(gen, mv)["bp"] > 20]
        phys = [mv for mv in dmg if rules.category(gen, mv) == "Physical"]
        spec = [mv for mv in dmg if rules.category(gen, mv) == "Special"]
        prio = [mv for mv in o["moves"] if rules.move(gen, mv)["priority"] > 0 and rules.category(gen, mv) != "Status"]
        vs = row["vs"]
        first = [s for s, v in vs.items() if not v["moves_first"]]
        ko_us = [s for s, v in vs.items() if v["hits_to_ko"].split(" vs ")[1] == "1"]
        blind = [s for s, v in vs.items() if v["they_hit"] == "no damage"
                 or float(v["they_hit"].rsplit(" ", 1)[1].split("-")[0]) < 25]
        go_to = {}
        for s, v in vs.items():
            if v["they_hit"] != "no damage":
                go_to.setdefault(v["they_hit"].rsplit(" ", 1)[0], []).append(s)
        ranked_moves = sorted(go_to.items(), key=lambda kv: -len(kv[1]))
        our_types = {rules.move(gen, mv)["type"] for mvs in m["our_movesets"].values() for mv in mvs
                     if rules.category(gen, mv) != "Status" and rules.move(gen, mv)["bp"] > 20}
        holes = sorted(t for t in our_types if rules.effectiveness(gen, t, types, abil) > 1)
        ranked = sorted(vs.items(), key=lambda kv: self._margin(kv[1]), reverse=True)
        wins = [(s, v) for s, v in ranked if v["wins"]]
        item = self._item_name(o.get("item"))
        return {"name": o["species"], "level": o["level"], "types_str": "/".join(types),
                "lean": "mixed" if phys and spec else "physical" if phys else "special" if spec else "status",
                "phys_str": join(phys), "spec_str": join(spec),
                "our_n": len(vs), "moves_first_n": len(first), "moves_first_str": join(first),
                "ko_us_str": join(ko_us), "blind_str": join(blind), "blind_n": len(blind),
                "main_move": ranked_moves[0][0] if ranked_moves else None,
                "main_targets": join(ranked_moves[0][1]) if ranked_moves else None,
                "alt_moves_str": "; ".join(f"{mv} against {join(who)}" for mv, who in ranked_moves[1:]),
                "setup_str": join(roles["setup"], "or"), "recovery_str": join(roles["recovery"], "or"),
                "status_str": join(roles["status"], "or"), "phaze_str": join(roles["phazing"], "or"),
                "pivot_str": join(roles["pivot"]), "priority_str": join(prio, "or"),
                "risky_str": join([mv for mv in o["moves"] if mv in RISKY], "or"),
                "protect_str": join([mv for mv in o["moves"] if mv in PROTECT], "or"),
                "holes_str": join(holes), "item": item, "item_note": ITEM_NOTES.get(item),
                "ability": abil, "ability_note": ABILITY_NOTES.get(abil),
                "call_str": f"{wins[0][0]}: {wins[0][1]['we_hit']}" if wins else None,
                "backup_str": f"{wins[1][0]}: {wins[1][1]['we_hit']}" if len(wins) > 1 else None,
                "no_answer": not wins, "beats_n": sum(1 for v in vs.values() if not v["wins"])}

    @staticmethod
    def _item_name(item):
        if not item:
            return None
        known = list(ITEM_NOTES) + list(SIGNATURE_ITEMS.values()) + TRAINER_ITEMS
        names = {i.lower().replace(" ", "").replace("'", "").replace("-", ""): i for i in known}
        key = str(item).lower().replace("item_", "").replace("_", "").replace(" ", "").replace("-", "").replace("'", "")
        return names.get(key, str(item).replace("ITEM_", "").replace("_", " ").title())

    # --- a team's call sheet against one opponent ----------------------------------------------
    def call_sheet(self, team, opponent):
        """The game plan against one trainer: the trainer's philosophy (from the game's AI flags, bag and
        battle lines), then each of their Pokémon in send-out order with its tendencies and how to attack it."""
        m = self.grid.matchups(team, opponent)
        trainer = self.trainer_context(opponent)
        rows = []
        for i, (r, o) in enumerate(zip(m["grid"], opponent["party"])):
            ctx = self.opponent_context(o, r, m, team)
            ctx.update({k: v for k, v in trainer.items() if k.startswith("ai_")}, is_lead=i == 0,
                       is_last=i == len(opponent["party"]) - 1, heal_items_n=trainer["heal_items_n"],
                       heal_item=trainer["heal_item"])
            ranked = sorted(r["vs"].items(), key=lambda kv: self._margin(kv[1]), reverse=True)
            wins = [(s, v) for s, v in ranked if v["wins"]]
            rows.append({"they_send": r["opponent"], "species": o["species"], "level": o["level"],
                         "their_moves": o["moves"], "their_item": ctx["item"],
                         "call": {"member": wins[0][0], **wins[0][1]} if wins else None,
                         "backup": {"member": wins[1][0], **wins[1][1]} if len(wins) > 1 else None,
                         "dont_send": [s for s, v in ranked if not v["wins"] and v["hits_to_ko"].split(" vs ")[1] == "1"],
                         "symbols": {"swings_first": ctx["moves_first_n"] * 2 > ctx["our_n"],
                                     "priority": bool(ctx["priority_str"]), "sets_up": bool(ctx["setup_str"]),
                                     "heals": bool(ctx["recovery_str"]), "lean": ctx["lean"]},
                         "moves_first_n": ctx["moves_first_n"], "beats_n": ctx["beats_n"], "our_n": ctx["our_n"],
                         "holes": ctx["holes_str"],
                         "phrases": self.book.speak("opponent", ctx)})
        wins_by = {s: sum(r["vs"][s]["wins"] for r in m["grid"]) for s in m["grid"][0]["vs"]} if m["grid"] else {}
        # the lead is whoever handles their opener (most wins overall breaks a tie, or covers a no-answer opener)
        lead = rows[0]["call"]["member"] if rows and rows[0]["call"] else (
            max(wins_by, key=lambda s: wins_by[s]) if wins_by else None)
        beats = [sum(1 for v in r["vs"].values() if not v["wins"]) for r in m["grid"]]
        best = opponent["party"][beats.index(max(beats))]["species"] if beats else None
        trainer.update(our_lead=lead, their_best=best, their_best_beats=max(beats) if beats else 0,
                       our_n=len(team.members), anchor=m["anchors"][0][0] if m["anchors"] else None,
                       no_answer_str=join(m["threats"]))
        sheet = {"opponent": m["opponent"], "game": opponent["game"], "source": m["source"], "level": m["our_level"],
                 "trainer_phrases": self.book.speak("trainer", trainer), "calls": rows,
                 "lead": lead, "anchors": m["anchors"], "no_answer": m["threats"], "record": wins_by,
                 "movesets": m["our_movesets"]}
        sheet["advance"] = self.advance_report(team, opponent, m)
        sheet["plan"] = self.game_plan(team, opponent, sheet, sheet["advance"])
        self._last_matchups = m
        return sheet

    @staticmethod
    def _margin(v):
        """Wins first, then the evaluation layer's ranking when the fight was played out; else the quickest win
        (fewest of our hits), then the widest margin."""
        if "value" in v:
            return (v["wins"], tuple(v["value"]))
        ours, theirs = (int(x) for x in v["hits_to_ko"].split(" vs "))
        return (v["wins"], -ours, theirs - ours, v["moves_first"])

    # --- the advance report: the MLB form, Pokémon instead of hitters, types instead of pitches ------
    def repertoire(self, team, movesets):
        """Our 'pitch types': every attack type the club throws, who throws it and with what."""
        gen = team.gen
        rep = {}
        for name, moves in movesets.items():
            for mv in moves:
                if rules.category(gen, mv) != "Status" and rules.move(gen, mv)["bp"] > 20:
                    rep.setdefault(rules.move(gen, mv)["type"], []).append({"member": name, "move": mv})
        order = sorted(rep, key=lambda t: (-len({x["member"] for x in rep[t]}), rules.TYPES.index(t)))
        return [{"type": t, "throwers": rep[t]} for t in order]

    def advance_report(self, team, opponent, m):
        """One row per opposing Pokémon (the hitter): how it handles each of our attack types (the pitch types),
        whether it swings first, which of our status moves it bites on (chases off-speed), who can set up on it
        for free (chases up), and the plan for attacking it."""
        gen = team.gen
        names = m["our_names"]
        rep = self.repertoire(team, m["our_movesets"])
        status_moves = [(n, mv) for n, moves in m["our_movesets"].items() for mv in moves if mv in STATUS_EFFECT]
        setup_moves = {n: [mv for mv in moves if mv in ROLES["setup"] and not (mv == "Curse" and "Ghost" in rules.species(gen, n)["types"])]
                       for n, moves in m["our_movesets"].items()}
        rows = []
        for oi, (r, o) in enumerate(zip(m["grid"], opponent["party"])):
            sp = rules.species(gen, o["species"])
            abil = o.get("ability") or ((rules.abilities(gen, o["species"]) or [None])[0] if gen >= 3 else None)
            ours = [w for w in m["web"] if w["side"] == "us" and w["theirs"] == oi]
            theirs = [w for w in m["web"] if w["side"] == "them" and w["theirs"] == oi]
            cells = {}
            for col in rep:
                hits = [w for w in ours if rules.move(gen, w["move"])["type"] == col["type"]]
                if not hits:
                    continue
                best = max(hits, key=lambda w: w["min"])
                eff = rules.effectiveness(gen, col["type"], sp["types"], abil)
                cells[col["type"]] = {"pct": best["min"], "max": best["max"], "by": names[best["ours"]], "move": best["move"],
                                      "se": eff > 1, "resisted": 0 < eff < 1, "immune": eff == 0,
                                      "k": best["min"] >= 100, "two": 50 <= best["min"] < 100}
            effects = {}
            for n, mv in status_moves:
                eff = STATUS_EFFECT[mv]
                blocked = (set(sp["types"]) & STATUS_IMMUNE_TYPES[eff]) or abil in STATUS_IMMUNE_ABILITIES.get(eff, set()) \
                    or (mv == "Thunder Wave" and rules.effectiveness(gen, "Electric", sp["types"]) == 0)
                effects[mv] = not blocked
            landed = [mv for mv, ok in effects.items() if ok]
            takes = ("—" if not effects else ", ".join(landed) if len(effects) == 1 and landed else
                     "ALL" if len(landed) == len(effects) else ", ".join(landed) or "none")
            if o.get("item") and self._item_name(o["item"]) == "Lum Berry" and landed:
                takes += " (Lum Berry cures one)"
            bait = []
            for ui, n in enumerate(names):
                if setup_moves.get(n):
                    worst = max((w["max"] for w in theirs if w["ours"] == ui), default=0)
                    if worst <= 33:
                        bait.append({"member": n, "move": setup_moves[n][0], "takes_at_most": worst})
            phys = sp["bs"]["hp"] * sp["bs"]["def"]
            spec = sp["bs"]["hp"] * sp["bs"]["spd"]
            rows.append({"species": o["species"], "level": o["level"], "item": self._item_name(o.get("item")),
                         "moves": o["moves"], "ability": abil, "types": sp["types"], "cells": cells,
                         "softer_vs": "physical" if phys < spec * 0.85 else "special" if spec < phys * 0.85 else "even",
                         "takes_status": takes, "setup_bait": bait})
        return {"pitch_types": [{"type": c["type"], "throwers": [f"{x['member']} ({x['move']})" for x in c["throwers"]]}
                                for c in rep], "rows": rows}

    def self_scout(self, team, cards, notes=()):
        """What the club is good at and what it's trying to do: its repertoire, its jobs, its holes."""
        gen = team.gen
        rep = self.repertoire(team, {rules.species(gen, mem.species)["name"]: mem.moves for mem in team.members})
        d = self.battle.defense(team)
        speed = self.battle.speed(team)
        jobs = {}
        for c in cards:
            for p in c["phrases"]:
                jobs.setdefault(p["rule"], []).append(c["species"])
        holes = [t for t in rules.TYPES if len(d["weak"][t]) >= 3 or (len(d["weak"][t]) >= 2 and not d["resist"][t] and not d["immune"][t])]
        reach = sorted({t for c in rep for x in c["throwers"] for t in rules.TYPES
                        if rules.effectiveness(gen, c["type"], [t]) > 1})
        ctx = {"game_title": GAME_TITLE[team.game], "pitch_types_n": len(rep),
               "pitch_types_str": join([f"{c['type']} ({join(sorted({x['member'] for x in c['throwers']}))})" for c in rep[:4]]),
               "reach_n": len(reach), "missing_str": join([t for t in rules.TYPES if t not in reach]),
               "holes_str": join([f"{t} ({join(d['weak'][t])})" for t in holes]),
               "fastest": speed[0]["species"], "slowest": speed[-1]["species"],
               "setup_str": join(jobs.get("ahead_setup", [])), "setup_n": len(jobs.get("ahead_setup", [])),
               "healers_str": join(jobs.get("behind_heal", []) + jobs.get("behind_rest", [])),
               "healers_n": len(jobs.get("behind_heal", []) + jobs.get("behind_rest", [])),
               "closers_str": join(jobs.get("ahead_close", [])), "pivots_str": join(jobs.get("behind_pivot", [])),
               "status_str": join(jobs.get("ahead_status", [])),
               "anchor": max(cards, key=lambda c: (c["record"] or (0, 0))[0])["species"] if cards else None,
               "notes_str": " ".join(notes)}
        return {"repertoire": [{"type": c["type"], "throwers": c["throwers"]} for c in rep],
                "phrases": self.book.speak("self", ctx)}

    def game_plan(self, team, opponent, sheet, advance):
        """The two reports combined: who takes whom, where the free turns are, what to save, what to fear."""
        rows = sheet["calls"]
        load, assign = {}, []
        for i in sorted(range(len(rows)), key=lambda i: sum(1 for v in [rows[i]["call"], rows[i]["backup"]] if v)):
            options = [x for x in (rows[i]["call"], rows[i]["backup"]) if x]
            pick = next((x for x in options if load.get(x["member"], 0) < 2), options[0] if options else None)
            if pick:
                load[pick["member"]] = load.get(pick["member"], 0) + 1
            assign.append((i, pick))
        assign.sort()
        trainer = self.trainer_context(opponent)
        bait = [f"{b['member']} can {b['move']} on {a['species']}" for a in advance["rows"] for b in a["setup_bait"]]
        ks = []
        for a in advance["rows"]:
            k = [f"{c['move']} ({c['by']})" for c in a["cells"].values() if c["k"]]
            if k:
                ks.append(f"{a['species']}: {join(k[:3], 'or')}")
        setups = [f"{r['species']} ({', '.join(mv for mv in r['their_moves'] if mv in ROLES['setup'])})"
                  for r in rows if any(mv in ROLES["setup"] for mv in r["their_moves"])]
        status_ok = [a["species"] for a in advance["rows"] if a["takes_status"] not in ("—", "none")]
        ctx = {"trainer": opponent["name"], "lead": sheet["lead"], "their_lead": rows[0]["species"] if rows else None,
               "assign_str": "; ".join(f"{rows[i]['species']} → {p['member']} ({p['we_hit'].rsplit(' ', 1)[0]})"
                                       for i, p in assign if p),
               "unassigned_str": join([rows[i]["species"] for i, p in assign if not p]),
               "heal_items_n": trainer["heal_items_n"], "heal_item": trainer["heal_item"],
               "k_n": len(ks), "k_str": "; ".join(ks), "bait_str": join(bait[:3]), "bait_n": len(bait),
               "their_setup_str": join(setups), "status_targets_str": join(status_ok),
               "their_best": max(rows, key=lambda r: len(r["dont_send"]))["species"] if rows else None,
               "their_best_dont": join(max(rows, key=lambda r: len(r["dont_send"]))["dont_send"]) if rows else None,
               "anchor": sheet["anchors"][0][0] if sheet["anchors"] else None, "switch_rule": trainer.get("switch_rule"),
               "ai_setup_first_turn": trainer.get("ai_setup_first_turn")}
        return {"assignments": [{"theirs": rows[i]["species"], "ours": p["member"] if p else None,
                                 "how": p["we_hit"] if p else None} for i, p in assign],
                "phrases": self.book.speak("plan", ctx)}

    # --- the what-if league ---------------------------------------------------------------------
    @staticmethod
    def as_opponent(label, members):
        return {"name": label, "game": "heartgold", "source": "journey team, Lv 100, Gen 4 rules",
                "party": [{"species": rules.species(4, m.species)["name"], "level": 100, "moves": m.moves,
                           "item": m.item, "nature": m.nature, "ability": m.ability,
                           "ivs": {k: 31 for k in ("hp", "atk", "def", "spa", "spd", "spe")}} for m in members]}

    def what_if_league(self, teams):
        """teams: {label: [Member]}. Every team meets every other at Lv 100 under Gen 4 rules; a team's score is
        how many of the 36 one-on-one matchups it wins. Not a simulation: the same benchmark grid."""
        labels = list(teams)
        matrix = {a: {} for a in labels}
        drawn = {a: {} for a in labels}
        for a in labels:
            for b in labels:
                if a != b:
                    res = self.grid.matchups(Team("heartgold", teams[a]), self.as_opponent(b, teams[b]))
                    matrix[a][b] = sum(v["wins"] for r in res["grid"] for v in r["vs"].values())
                    drawn[a][b] = sum(bool(v.get("draw")) for r in res["grid"] for v in r["vs"].values())
        standings = []
        for a in labels:
            won, played = sum(matrix[a].values()), 36 * (len(labels) - 1)
            draws = sum(drawn[a].values())
            standings.append({"team": a, "wins": won, "draws": draws, "losses": played - won - draws,
                              "pct": round(won / played, 3),
                              "series_won": sum(1 for b in labels if b != a and matrix[a][b] > matrix[b][a])})
        standings.sort(key=lambda r: (-r["series_won"], -r["pct"]))
        played_out = self.grid is not self.bench
        rules_line = ("Lv 100, Gen 4 rules, IVs 31, EVs 85 in every stat unless recorded, builds as recorded; each "
                      "one-on-one played out by the scouting engine" if played_out else
                      "Lv 100, Gen 4 rules, 31 IVs, no EVs, builds as recorded")
        return {"rules": rules_line, "standings": standings, "matrix": matrix, "draws": drawn}

    # --- rendering -------------------------------------------------------------------------------
    SECTION_TITLES = {"philosophy": "Philosophy", "tendencies": "Tendencies", "when_ahead": "When it's ahead",
                      "when_behind": "When it's behind", "vs_types": "Against types", "vs_moves": "Against moves",
                      "how_to_beat": "How you beat it", "how_to_attack": "How to attack it", "production": "Production",
                      "makeup": "Makeup", "order": "Order", "bag": "The bag", "dialogue": "What they say",
                      "scouts_note": "Scout's note", "identity": "What we're trying to do", "good_at": "What we're good at",
                      "soft": "Where we're soft", "plan_lead": "The opener", "plan_assign": "Who takes whom",
                      "plan_keys": "Keys to the game", "plan_watch": "Watch out for"}

    @classmethod
    def render_phrases(cls, phrases):
        return [f"- **{cls.SECTION_TITLES.get(section, section)}:** " + " ".join(p["text"] for p in ps)
                for section, ps in Phrasebook.by_section(phrases).items()]

    @classmethod
    def render_report(cls, r):
        head = [f"### {r['species']} ({'/'.join(r['types'])}), {GAME_TITLE[r['game']]}",
                f"*{' / '.join(r['moves'])}" + (f" · {r['nature']}" if r["nature"] else "")
                + (f" · {r['ability']}" if r["ability"] else "") + (f" · @ {r['item']}" if r["item"] else "")
                + f" · build: {r['build_source']}*", ""]
        return "\n".join(head + cls.render_phrases(r["phrases"]))

    @classmethod
    def render_call_sheet(cls, c):
        lines = [f"### Call sheet vs {c['opponent']} (Lv {c['level']}, {c['source']})", ""]
        lines += cls.render_phrases(c["trainer_phrases"])
        lines += ["", "| They send | Their moves | The call | Backup | Don't send |", "|---|---|---|---|---|"]
        for r in c["calls"]:
            call = f"{r['call']['member']}: {r['call']['we_hit']}" if r["call"] else "**no clean answer**"
            back = f"{r['backup']['member']}: {r['backup']['we_hit']}" if r["backup"] else "—"
            item = f" @ {r['their_item']}" if r["their_item"] else ""
            lines.append(f"| {r['they_send']} | {' · '.join(r['their_moves'])}{item} | {call} | {back} | "
                         f"{', '.join(r['dont_send']) or '—'} |")
        for r in c["calls"]:
            lines += ["", f"**{r['they_send']}**", ""] + cls.render_phrases(r["phrases"])
        return "\n".join(lines)
