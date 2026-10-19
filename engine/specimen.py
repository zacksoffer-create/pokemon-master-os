"""Specimen Lab kernel: one individual Pokémon at PKHeX-level detail, per generation.

Derives what the games themselves derive, and says why:
  Gen 3-4: PID -> nature, gender, ability slot, shininess (with TID/SID); IVs -> Hidden Power;
           highest IV -> the Gen 4 summary-screen characteristic; nature -> stat change + flavors.
  Gen 2:   DVs -> HP DV, gender, shininess, Hidden Power. No ball, nature, ability or PID is
           stored (PKHeX GBPKM: Ball/Nature/Ability/PID are `get => 0; set { }`).
Stats use the base stats of the specimen's own era (PokeAPI pokemon_stats_past).
Validity gate is learnability (decision D-024), plus explicitly recorded exceptions.
Exports a Showdown set and a PKHeX Batch Editor script (`=Filter=Value`, `.Property=Value`).
"""
import math
import random
from dataclasses import dataclass, field

from refdb import Ref, VG, VG_GEN

STATS = ["hp", "atk", "def", "spa", "spd", "spe"]
GAME_ORDER = ["hp", "atk", "def", "spe", "spa", "spd"]  # in-game IV order (PID/IV, HP, characteristic)
POKEAPI_STAT = {"hp": 1, "atk": 2, "def": 3, "spa": 4, "spd": 5, "spe": 6}
SHOWDOWN = {"hp": "HP", "atk": "Atk", "def": "Def", "spa": "SpA", "spd": "SpD", "spe": "Spe"}
PKHEX = {"hp": "HP", "atk": "ATK", "def": "DEF", "spa": "SPA", "spd": "SPD", "spe": "SPE"}
HP_TYPES = ["Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel",
            "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark"]
# PKHeX.Core/Game/Enums/Ball.cs
BALL_ID = {"Master": 1, "Ultra": 2, "Great": 3, "Poke": 4, "Safari": 5, "Net": 6, "Dive": 7,
           "Nest": 8, "Repeat": 9, "Timer": 10, "Luxury": 11, "Premier": 12, "Dusk": 13,
           "Heal": 14, "Quick": 15, "Cherish": 16, "Fast": 17, "Level": 18, "Lure": 19,
           "Heavy": 20, "Love": 21, "Friend": 22, "Moon": 23, "Sport": 24}
BALLS_IN_GAME = {6: range(1, 13), 7: range(1, 13), 9: range(1, 17), 10: range(1, 25)}
GEN34_FEMALE_BELOW = {1: 31, 2: 63, 4: 127, 6: 191, 7: 225}   # female if (PID & 0xFF) < value
GEN2_FEMALE_MAX_ATK_DV = {1: 1, 2: 3, 4: 7, 6: 11}            # female if Attack DV <= value
GEN2_SHINY_ATK = {2, 3, 6, 7, 10, 11, 14, 15}

# Exceptions to the learnability gate, each tied to a recorded decision.
EXCEPTIONS = {("crystal", "feraligatr", "waterfall"): "D-028 (learnable from Gen 3; works on the Crystal cartridge)"}


@dataclass
class Specimen:
    species: str
    game: str
    level: int = 50
    nickname: str = ""
    moves: list = field(default_factory=list)
    item: str = ""
    nature: str = ""            # Gen 3-4
    ability: str = ""           # Gen 3-4
    gender: str = ""            # "M" / "F" / "" (Gen 2: must agree with the Attack DV)
    shiny: bool = False
    ivs: dict = field(default_factory=dict)       # Gen 3-4: 0-31
    evs: dict = field(default_factory=dict)       # Gen 3-4: 0-255, total <= 510
    dvs: dict = field(default_factory=dict)       # Gen 2: atk/def/spe/spc 0-15
    stat_exp: dict = field(default_factory=dict)  # Gen 2: hp/atk/def/spe/spc 0-65535
    ball: str = ""
    friendship: int | None = None
    ot_name: str = ""
    tid: int = 0
    sid: int = 0
    met_level: int | None = None
    contest: dict = field(default_factory=dict)   # cool/beauty/cute/smart/tough/sheen
    pid: int | None = None


class Lab:
    def __init__(self, db_path):
        self.r = Ref(db_path)

    # --- reference lookups ----------------------------------------------
    def era_base_stats(self, species, gen):
        """Base stats as they were in `gen` (later-gen buffs undone)."""
        sid = self.r.species_id(species)
        names = {1: "hp", 2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe"}
        base = {names[int(r["stat_id"])]: int(r["base_stat"]) for r in self.r.q(
            "SELECT stat_id, base_stat FROM pokemon_stats WHERE pokemon_id=? AND stat_id<=6", sid)}
        for r in self.r.q("SELECT generation_id, stat_id, base_stat FROM pokemon_stats_past "
                          "WHERE pokemon_id=? AND stat_id<=6 AND generation_id>=? "
                          "ORDER BY generation_id DESC", sid, gen):
            base[names[int(r["stat_id"])]] = int(r["base_stat"])   # earliest applicable row wins
        return base

    def nature_row(self, name):
        return self.r.q("SELECT * FROM natures WHERE identifier=?", name.lower())[0]

    def nature_by_index(self, idx):
        return self.r.q("SELECT * FROM natures WHERE game_index=?", idx)[0]

    def flavor(self, contest_type_id):
        return self.r.q("SELECT flavor FROM contest_type_names WHERE contest_type_id=? "
                        "AND local_language_id=9", contest_type_id)[0][0]

    def characteristic(self, stat, mod5):
        return self.r.q("""SELECT t.message FROM characteristics c JOIN characteristic_text t
            ON t.characteristic_id=c.id AND t.local_language_id=9
            WHERE c.stat_id=? AND c.gene_mod_5=?""", POKEAPI_STAT[stat], mod5)[0][0]

    def item_index(self, item, gen):
        r = self.r.q("""SELECT g.game_index FROM item_names n JOIN item_game_indices g ON g.item_id=n.item_id
            WHERE n.local_language_id=9 AND lower(n.name)=lower(?) AND g.generation_id=?""", item, gen)
        return int(r[0][0]) if r else None

    # --- Gen 3-4 mechanics ------------------------------------------------
    @staticmethod
    def gender_from_pid(pid, rate):
        if rate == -1:
            return ""
        if rate in (0, 8):
            return "M" if rate == 0 else "F"
        return "F" if (pid & 0xFF) < GEN34_FEMALE_BELOW[rate] else "M"

    @staticmethod
    def is_shiny(pid, tid, sid):
        return (tid ^ sid ^ (pid >> 16) ^ (pid & 0xFFFF)) < 8

    def find_pid(self, nature_idx, gender, ability_slot, shiny, rate, tid, sid, seed=0):
        """A PID giving this nature, gender, ability slot and shininess at once.
        In Gen 3-4 all four come from the same 32-bit number, so they can't be picked separately."""
        def ok(pid):
            return (pid % 25 == nature_idx
                    and (not gender or self.gender_from_pid(pid, rate) == gender)
                    and (ability_slot is None or pid & 1 == ability_slot))
        if shiny:
            for low in range(0x10000):
                for k in range(8):
                    pid = (((tid ^ sid ^ low ^ k) & 0xFFFF) << 16) | low
                    if ok(pid):
                        return pid
            return None
        rng = random.Random(seed)
        while True:
            pid = rng.getrandbits(32)
            if ok(pid) and not self.is_shiny(pid, tid, sid):
                return pid

    @staticmethod
    def hidden_power_34(iv):
        bits = [iv[s] for s in GAME_ORDER]
        t = sum((v & 1) << i for i, v in enumerate(bits)) * 15 // 63
        p = sum(((v >> 1) & 1) << i for i, v in enumerate(bits)) * 40 // 63 + 30
        return HP_TYPES[t], p

    def characteristic_g4(self, iv, pid):
        top = max(iv.values())
        start = pid % 6
        for i in range(6):
            stat = GAME_ORDER[(start + i) % 6]
            if iv[stat] == top:
                return self.characteristic(stat, top % 5), stat

    @staticmethod
    def stats_34(base, iv, ev, level, plus, minus):
        out = {}
        for s in STATS:
            core = (2 * base[s] + iv[s] + ev[s] // 4) * level // 100
            if s == "hp":
                out[s] = core + level + 10
            else:
                mult = 110 if s == plus and plus != minus else 90 if s == minus and plus != minus else 100
                out[s] = (core + 5) * mult // 100
        return out

    # --- Gen 2 mechanics ---------------------------------------------------
    @staticmethod
    def hp_dv(dv):
        return ((dv["atk"] & 1) << 3) | ((dv["def"] & 1) << 2) | ((dv["spe"] & 1) << 1) | (dv["spc"] & 1)

    @staticmethod
    def gender_g2(dv, rate):
        if rate == -1:
            return ""
        if rate in (0, 8):
            return "M" if rate == 0 else "F"
        return "F" if dv["atk"] <= GEN2_FEMALE_MAX_ATK_DV[rate] else "M"

    @staticmethod
    def shiny_g2(dv):
        return dv["def"] == 10 and dv["spe"] == 10 and dv["spc"] == 10 and dv["atk"] in GEN2_SHINY_ATK

    @staticmethod
    def hidden_power_g2(dv):
        t = 4 * (dv["atk"] % 4) + dv["def"] % 4
        msb = (dv["spc"] >> 3) | ((dv["spe"] >> 3) << 1) | ((dv["def"] >> 3) << 2) | ((dv["atk"] >> 3) << 3)
        return HP_TYPES[t], (5 * msb + dv["spc"] % 4) // 2 + 31

    def stats_g2(self, base, dv, se, level):
        dvs = {"hp": self.hp_dv(dv), "atk": dv["atk"], "def": dv["def"], "spe": dv["spe"],
               "spa": dv["spc"], "spd": dv["spc"]}
        exp = {"hp": se.get("hp", 0), "atk": se.get("atk", 0), "def": se.get("def", 0),
               "spe": se.get("spe", 0), "spa": se.get("spc", 0), "spd": se.get("spc", 0)}
        out = {}
        for s in STATS:
            term = min(255, math.ceil(math.sqrt(exp[s]))) // 4
            core = ((base[s] + dvs[s]) * 2 + term) * level // 100
            out[s] = core + (level + 10 if s == "hp" else 5)
        return out, dvs

    # --- the specimen card -------------------------------------------------
    def derive(self, sp):
        game = sp.game.lower()
        vg, gen = VG[game], VG_GEN[VG[game]]
        sid = self.r.species_id(sp.species)
        rate = self.r.gender_rate(sid)
        base = self.era_base_stats(sp.species, gen)
        card = {"species": sp.species, "game": sp.game, "gen": gen, "level": sp.level,
                "era_base_stats": base, "notes": [], "conflicts": []}
        # learnability gate (D-024)
        for mv in sp.moves:
            res = self.r.learn(sp.species, mv, vg)
            if res["routes"]:
                continue
            key = (game, sp.species.lower(), self.r.q("SELECT identifier FROM moves WHERE id=?",
                                                      self.r.move_id(mv))[0][0])
            if key in EXCEPTIONS:
                card["notes"].append(f"{mv}: not learnable in Gen {gen}; allowed by {EXCEPTIONS[key]}")
            else:
                card["conflicts"].append(f"{mv}: {sp.species} can't learn it in Gen {gen}")
        if gen == 2:
            dv = {k: sp.dvs.get(k, 15) for k in ("atk", "def", "spe", "spc")}
            stats, dvs = self.stats_g2(base, dv, sp.stat_exp, sp.level)
            g, shiny = self.gender_g2(dv, rate), self.shiny_g2(dv)
            hp_t, hp_p = self.hidden_power_g2(dv)
            card.update(stats=stats, dvs=dvs, gender=g, shiny=shiny, hidden_power=f"{hp_t} {hp_p}")
            if sp.gender and sp.gender != g:
                need = GEN2_FEMALE_MAX_ATK_DV.get(rate)
                card["conflicts"].append(f"gender {sp.gender} needs Attack DV "
                                         f"{'<= ' if sp.gender == 'F' else '> '}{need} in Gen 2 "
                                         f"(this one has {dv['atk']})")
            if sp.shiny and not shiny:
                card["conflicts"].append("Gen 2 shininess is fixed by DVs: Def = Spe = Spc = 10, "
                                         "Atk in {2,3,6,7,10,11,14,15}")
            if sp.ball:
                card["notes"].append(f"{sp.ball} Ball: Gen 2 doesn't store a ball. Story-only detail")
            if sp.nature or sp.ability:
                card["notes"].append("Gen 2 has no natures or abilities")
            return card
        iv = {s: sp.ivs.get(s, 31) for s in STATS}
        ev = {s: sp.evs.get(s, 0) for s in STATS}
        if sum(ev.values()) > 510:
            card["conflicts"].append(f"EV total {sum(ev.values())} > 510")
        nat = self.nature_row(sp.nature) if sp.nature else None
        abilities = self.r.abilities(sp.species, gen)
        slot = abilities.index(sp.ability) if sp.ability in abilities and len(abilities) > 1 else None
        if sp.ability and sp.ability not in abilities:
            card["conflicts"].append(f"{sp.ability} isn't a Gen {gen} ability of {sp.species} {abilities}")
        pid = sp.pid if sp.pid is not None else self.find_pid(
            int(nat["game_index"]) if nat else 0, sp.gender, slot, sp.shiny, rate, sp.tid, sp.sid)
        nat = self.nature_by_index(pid % 25)
        names = {2: "atk", 3: "def", 4: "spa", 5: "spd", 6: "spe"}
        plus, minus = names[int(nat["increased_stat_id"])], names[int(nat["decreased_stat_id"])]
        hp_t, hp_p = self.hidden_power_34(iv)
        card.update(
            pid=f"0x{pid:08X}", nature=nat["identifier"].title(),
            nature_effect="neutral" if plus == minus else f"+{SHOWDOWN[plus]} / -{SHOWDOWN[minus]}",
            flavors="no preference" if plus == minus else
                    f"likes {self.flavor(nat['likes_flavor_id'])}, dislikes {self.flavor(nat['hates_flavor_id'])}",
            gender=self.gender_from_pid(pid, rate),
            shiny=self.is_shiny(pid, sp.tid, sp.sid), hidden_power=f"{hp_t} {hp_p}",
            stats=self.stats_34(base, iv, ev, sp.level, plus, minus), ivs=iv, evs=ev)
        if len(abilities) > 1:
            card["ability_slot"] = f"{pid & 1} ({abilities[pid & 1]})"
        if gen == 4:
            text, stat = self.characteristic_g4(iv, pid)
            card["characteristic"] = f'"{text}" (highest IV: {SHOWDOWN[stat]} {iv[stat]}, {iv[stat]} mod 5 = {iv[stat] % 5})'
        if sp.ball and BALL_ID.get(sp.ball) not in BALLS_IN_GAME.get(vg, range(0)):
            card["notes"].append(f"{sp.ball} Ball doesn't exist in {sp.game} (story note only, D-024)")
        return card

    # --- exports -------------------------------------------------------------
    def showdown(self, sp, card):
        head = f"{sp.nickname} ({sp.species})" if sp.nickname else sp.species
        if card.get("gender"):
            head += f" ({card['gender']})"
        if sp.item:
            head += f" @ {sp.item}"
        lines = [head]
        if card["gen"] >= 3 and sp.ability:
            lines.append(f"Ability: {sp.ability}")
        lines.append(f"Level: {sp.level}")
        if card.get("shiny"):
            lines.append("Shiny: Yes")
        if sp.friendship is not None:
            lines.append(f"Happiness: {sp.friendship}")
        if card["gen"] >= 3:
            evs = " / ".join(f"{v} {SHOWDOWN[s]}" for s, v in card["evs"].items() if v)
            if evs:
                lines.append(f"EVs: {evs}")
            lines.append(f"{card['nature']} Nature")
            ivs = " / ".join(f"{v} {SHOWDOWN[s]}" for s, v in card["ivs"].items() if v != 31)
        else:  # Showdown's Gen 2 IVs are DV x 2
            ivs = " / ".join(f"{card['dvs'][s] * 2} {SHOWDOWN[s]}" for s in STATS if card["dvs"][s] != 15)
        if ivs:
            lines.append(f"IVs: {ivs}")
        lines += [f"- {m}" for m in sp.moves]
        return "\n".join(lines)

    def batch_script(self, sp, card):
        """PKHeX Batch Editor instructions for what a Showdown set can't carry."""
        dex = self.r.species_id(sp.species)
        out = [f"=Species={dex}"]
        if card["gen"] == 2:
            dv = card["dvs"]
            out.append(f".DV16={(dv['atk'] << 12) | (dv['def'] << 8) | (dv['spe'] << 4) | dv['spa']}")
            for s, prop in (("hp", "HP"), ("atk", "ATK"), ("def", "DEF"), ("spe", "SPE"), ("spc", "SPC")):
                if s in sp.stat_exp:
                    out.append(f".EV_{prop}={sp.stat_exp[s]}")
        else:
            out.append(f".PID={int(card['pid'], 16)}")
            out += [f".TID16={sp.tid}", f".SID16={sp.sid}"]
            out += [f".IV_{PKHEX[s]}={v}" for s, v in card["ivs"].items()]
            out += [f".EV_{PKHEX[s]}={v}" for s, v in card["evs"].items()]
            if sp.ball in BALL_ID:
                out.append(f".Ball={BALL_ID[sp.ball]}")
            for k, v in sp.contest.items():
                out.append(f".Contest{k.title()}={v}")
        if sp.met_level is not None:
            out.append(f".MetLevel={sp.met_level}")
        if sp.ot_name:
            out.append(f".OriginalTrainerName={sp.ot_name}")
        if sp.friendship is not None:
            out.append(f".{'OriginalTrainerFriendship' if card['gen'] == 3 else 'CurrentFriendship'}={sp.friendship}")
        if sp.item and card["gen"] >= 2:
            idx = self.item_index(sp.item, card["gen"])
            if idx is not None:
                out.append(f".HeldItem={idx}")
        return "\n".join(out)
