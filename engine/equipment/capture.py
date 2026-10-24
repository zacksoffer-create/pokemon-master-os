"""The chance a Poké Ball catches a wild Pokémon, exactly as each game's own catch code computes it.

    from equipment.capture import chance
    chance("heartgold", "moon", species, level=20, hp_pct=1, status="sleep", ctx={...})

Each function is a line-by-line port of the game's routine (the pinned sources are in engine/data/raw/equipment/,
listed by fetch_reference.py; equipment/balls.py checks the numbers against them):
- Crystal: PokeBallEffect and its BallMultiplierFunctionTable (pokecrystal engine/items/item_effects.asm), byte for
  byte: each multiplier caps the catch rate at 255, the HP step works on low bytes, the Level Ball skips the HP and
  status step, the documented bugs are kept (Moon Ball never boosts, Love Ball the same gender, Fast Ball only
  Magnemite, Grimer and Tangela, burn, poison and paralysis add nothing). Caught when Random() (0-255) <= the result.
- Emerald and FireRed: Cmd_handleballthrow (src/battle_script_commands.c). Caught outright above 254; otherwise four
  shake checks against 1048560 / sqrt(sqrt(16711680 / odds)).
- Platinum: BattleScript_CalcCatchShakes (src/battle/battle_script.c); HeartGold: BattleSystem_CalculateBallShakes
  (src/battle/battle_command.c), where the Apricorn balls change the catch rate itself (capped at 255) and the Heavy
  Ball takes 20 off every Pokémon under 204.8 kg (its weight test reads the catch rate).

`species` is a record from engine/data_manifest/catch_species.json (equipment/species.py): each generation's own catch
rate, base HP and Speed and types, the weight in kg x 10, the Pokédex weight in pounds x 10 (Crystal's Heavy Ball
converts it with shifts) and the gender ratio (-1 genderless, 0-8 eighths female).
`ctx` holds the situation: fishing, underwater (Gen 3), water (Gen 4 battle on water), night, cave, turn (0 = the
first), caught_before, mine = {level, species, gender}, their gender. The wild Pokémon's max HP uses IV 15 (DV 8 in
Gen 2) and no EVs; its HP is `hp_pct` of that, at least 1.
"""
import math
import os

GEN = {"crystal": 2, "emerald": 3, "firered": 3, "platinum": 4, "heartgold": 4, "soulsilver": 4}
SLEEP_FREEZE = ("sleep", "freeze")
OTHER_STATUS = ("poison", "burn", "paralysis", "toxic")
GEN2_FAST_BALL = ("Magnemite", "Grimer", "Tangela")      # the first three bytes of FleeMons: the bug (pokecrystal)
HGSS_MOON_BALL = ("Nidoran♀", "Nidorina", "Nidoqueen", "Nidoran♂", "Nidorino", "Nidoking", "Cleffa", "Clefairy",
                  "Clefable", "Igglybuff", "Jigglypuff", "Wigglytuff", "Skitty", "Delcatty")   # sMoonBallPokemon
GEN2_HEAVY_BAD_WEIGHT = ("Kadabra", "Tauros", "Sunflora")  # HeavyBall_GetDexEntryBank reads another bank (bug)


def flat(name, rec, game):
    """One species as one game sees it."""
    g = rec[f"gen{GEN[game]}"]
    return {"name": name, "rate": g["rate"], "hp": g["hp"], "spe": g["spe"], "types": g["types"], "weight": rec["weight"],
            "lbs10": rec.get("lbs10"), "gender_rate": rec["gender_rate"]}


def gen2_weight(lbs10):
    """HeavyBallMultiplier's conversion of the Pokédex weight (pounds x 10) to about kg x 10: w/2 - w/32 - w/64."""
    h = lbs10 >> 1
    return h - (h >> 4) - (h >> 5)


def max_hp(gen, base, level):
    if gen == 2:   # DV 8, no stat experience: ((base + DV) * 2) * level / 100 + level + 10
        return (base + 8) * 2 * level // 100 + level + 10
    return (2 * base + 15) * level // 100 + level + 10


def current_hp(mx, hp_pct):
    return max(1, min(mx, round(mx * hp_pct / 100)))


def _gen2_rate(ball, sp, level, ctx):
    """The catch rate after the ball's multiplier function (b in PokeBallEffect)."""
    b = sp["rate"]
    mine = ctx.get("mine") or {}
    if ball == "ultra":
        b = min(255, b * 2)
    elif ball in ("great", "safari", "sport"):
        b = min(255, b + (b >> 1))
    elif ball == "heavy":
        hi = gen2_weight(sp["lbs10"]) >> 8          # the routine compares only the high byte
        if hi < 4:
            b = b - 20 if b >= 20 else 1            # sub 20; ret nc; ld b, 1
        else:
            boost = 0 if hi < 8 else 20 if hi < 12 else 30 if hi < 16 else 40
            b = min(255, b + boost)
    elif ball == "level":
        c, a = mine.get("level") or 0, level
        if a < c:
            for _ in range(3):
                if b * 2 > 255:
                    b = 255
                    break
                b *= 2
                c >>= 1
                if a >= c:
                    break
    elif ball == "lure":
        if ctx.get("fishing"):
            b = min(255, b * 3)
    elif ball == "love":
        if mine.get("species") == sp["name"] and sp["gender_rate"] >= 0 and mine.get("gender") == ctx.get("their_gender"):
            b = min(255, b * 8)                       # the bug: the same gender
    elif ball == "fast":
        if sp["name"] in GEN2_FAST_BALL:
            b = min(255, b * 4)
    return b                                          # moon (bug), friend, poke: no change


def crystal(ball, sp, level, hp_pct, status, ctx):
    if ball == "master":
        return {"p": 1.0, "why": "the Master Ball never fails"}
    if ball == "heavy" and sp["name"] in GEN2_HEAVY_BAD_WEIGHT:
        return {"p": None, "why": "the Heavy Ball reads another Pokémon's weight for " + sp["name"] + " (a bug), so the chance isn't known"}
    b = _gen2_rate(ball, sp, level, ctx)
    if ball == "level":
        final = b                                     # the Level Ball skips the HP and status step
    else:
        mx = max_hp(2, sp["hp"], level)
        cur = current_hp(mx, hp_pct)
        bc, de = (cur * 2) & 0xFFFF, (mx * 3) & 0xFFFF
        if de >> 8:
            de, bc = de >> 2, bc >> 2
            if bc & 0xFF == 0:
                bc = (bc & 0xFF00) | 1
        e, c = de & 0xFF, bc & 0xFF
        mult = (e - c) & 0xFF
        q = (b * mult // e) & 0xFF if e else 0
        if q == 0:
            q = 1
        final = min(255, q + (10 if status in SLEEP_FREEZE else 0))   # burn, poison, paralysis add nothing (bug)
    return {"p": min(1.0, (final + 1) / 256), "rate": b, "final": final}


def _shakes(odds, cap):
    """Gens 3-4: caught outright at the cap, else four checks of Random() (0-65535) < b."""
    if odds >= cap:
        return 1.0, None
    if odds <= 0:
        return 0.0, 0
    b = 1048560 // math.isqrt(math.isqrt(16711680 // odds))
    return min(1.0, b / 65536) ** 4, b


def _ball_mult(game, ball, sp, level, ctx):
    gen = GEN[game]
    std = {"ultra": 20, "great": 15, "poke": 10, "safari": 15}
    if ball in std:
        return std[ball]
    if ball == "net":
        return 30 if {"Water", "Bug"} & set(sp["types"]) else 10
    if ball == "dive":
        return 35 if (ctx.get("underwater") if gen == 3 else ctx.get("water")) else 10
    if ball == "nest":
        return max(10, 40 - level) if level < 40 else 10
    if ball == "repeat":
        return 30 if ctx.get("caught_before") else 10
    if ball == "timer":
        return min(40, 10 + (ctx.get("turn") or 0))
    if ball == "dusk" and gen == 4:
        return 35 if ctx.get("night") or ctx.get("cave") else 10
    if ball == "quick" and gen == 4:
        return 40 if (ctx.get("turn") or 0) < 1 else 10
    if ball == "sport" and game in ("heartgold", "soulsilver"):
        return 15
    return 10


def _hgss_rate(ball, sp, level, ctx):
    """HeartGold's Apricorn balls change the catch rate itself; the result is capped to 1-255."""
    r, mine = sp["rate"], ctx.get("mine") or {}
    if ball == "fast" and sp["spe"] >= 100:
        r *= 4
    elif ball == "level":
        a, d = mine.get("level") or 0, level
        r *= 1 if a <= d else 2 if a // 2 <= d else 4 if a // 4 <= d else 8
    elif ball == "lure" and ctx.get("fishing"):
        r *= 3
    elif ball == "heavy":
        w = sp["weight"]
        r += 40 if w >= 4096 else 30 if w >= 3072 else 20 if w >= 2048 else -20   # the bug: never 0 under 204.8 kg
    elif ball == "love":
        if mine.get("species") == sp["name"] and sp["gender_rate"] >= 0 and mine.get("gender") != ctx.get("their_gender"):
            r *= 8
    elif ball == "moon" and sp["name"] in HGSS_MOON_BALL:
        r *= 4
    return 255 if r > 255 else 1 if r < 0 else r


def gens34(game, ball, sp, level, hp_pct, status, ctx):
    gen, hgss = GEN[game], game in ("heartgold", "soulsilver")
    if ball == "master":
        return {"p": 1.0, "why": "the Master Ball never fails"}
    if ball == "park" and gen == 4:
        return {"p": 1.0, "why": "Pal Park battles always catch"}
    rate = _hgss_rate(ball, sp, level, ctx) if hgss and ball not in ("ultra", "great", "poke", "safari") else sp["rate"]
    mult = _ball_mult(game, ball, sp, level, ctx)
    mx = max_hp(gen, sp["hp"], level)
    cur = current_hp(mx, hp_pct)
    odds = rate * mult // 10 * (mx * 3 - cur * 2) // (mx * 3)
    if status in SLEEP_FREEZE:
        odds *= 2
    elif status in OTHER_STATUS:
        odds = odds * 15 // 10
    p, b = _shakes(odds, 255)                        # Gen 3 tests odds > 254, Gen 4 >= 255: the same
    return {"p": p, "rate": rate, "mult": mult, "odds": odds, "shake": b}


def chance(game, ball, sp, level=10, hp_pct=100, status=None, ctx=None):
    """{p: the chance one throw catches (None when the game's own bug makes it unknowable), and the steps}."""
    ctx = ctx or {}
    out = crystal(ball, sp, level, hp_pct, status, ctx) if GEN[game] == 2 else gens34(game, ball, sp, level, hp_pct, status, ctx)
    if out["p"] is not None:
        out["p"] = math.floor(out["p"] * 1e6 + 0.5) / 1e6     # half up, as the page rounds
    return out


def parity_cases():
    """A fixed grid of throws across every game and ball (app/test_capture_parity.mjs runs the same in the page)."""
    import itertools
    import json as _json
    with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data_manifest", "catch_species.json"), encoding="utf-8") as fh:
        species = _json.load(fh)["species"]
    names = ["Snorlax", "Clefairy", "Magikarp", "Kadabra", "Magnemite", "Tauros", "Onix", "Steelix", "Pikachu", "Chansey",
             "Jigglypuff", "Heracross", "Groudon", "Wailord", "Dialga", "Skitty", "Nidorina", "Caterpie", "Mewtwo", "Blissey"]
    balls = ["poke", "great", "ultra", "master", "safari", "level", "lure", "moon", "friend", "love", "heavy", "fast", "sport",
             "park", "net", "dive", "nest", "repeat", "timer", "luxury", "premier", "dusk", "heal", "quick", "cherish"]
    ctxs = [{}, {"fishing": True, "water": True, "underwater": True, "night": True, "turn": 0, "caught_before": True},
            {"turn": 12, "cave": True, "mine": {"level": 60, "species": "Clefairy", "gender": "F"}, "their_gender": "M"},
            {"turn": 40, "mine": {"level": 9, "species": "Skitty", "gender": "M"}, "their_gender": "M"}]
    out, i = [], 0
    for game, name, ball, level, pct, status, ctx in itertools.product(
            ["crystal", "emerald", "firered", "platinum", "heartgold"], names, balls, [3, 30, 70], [100, 37, 1],
            [None, "sleep", "paralysis"], range(len(ctxs))):
        i += 1
        if i % 7:                                   # a fixed one in seven, so the grid stays quick
            continue
        rec = species[name]
        if f"gen{GEN[game]}" not in rec:
            continue
        sp = flat(name, rec, game)
        out.append({"case": [game, name, ball, level, pct, status, ctx], "want": chance(game, ball, sp, level, pct, status, ctxs[ctx])})
    return {"ctxs": ctxs, "cases": out}


if __name__ == "__main__":
    import json as _json
    import sys as _sys
    if len(_sys.argv) > 2 and _sys.argv[1] == "--parity":
        data = parity_cases()
        with open(_sys.argv[2], "w", encoding="utf-8") as fh:
            _json.dump(data, fh, ensure_ascii=False)
        print(f"{_sys.argv[2]}: {len(data['cases'])} throws")
