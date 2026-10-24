"""The Poké Ball reference records (docs/specs/POKE_BALLS_EQUIPMENT.md; MASTER_PLAN Phase 6).

    python3 -I engine/equipment/balls.py          # engine/data_manifest/balls.json, after checking the mechanics

Every Gen I-IV ball (25) as one reference record: its name in each game, category, the generation that introduced it,
what it does in each game (from that game's own catch code, with the file and routine it comes from), how you get it
(equipment/acquire.py, from the games' map scripts and marts), the game's own description, its Apricorn and Kurt where
it has them, and Blackthorn's creative reading (design and interior direction), kept apart and labelled.

The mechanics are written here as plain statements with their numbers, and `check()` holds every number to the pinned
sources in engine/data/raw/equipment/ (fetch_reference.py --equipment): the multiplier tables and switch cases of
Emerald, FireRed, Platinum and HeartGold, Crystal's multiplier routines, weight table, Moon Ball and Fast Ball bugs,
and Red's random ranges. A number that disagrees with the code stops the build. equipment/capture.py computes the
same rules as catch chances.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
RAW = os.path.join(ENGINE, "data", "raw", "equipment")
OUT = os.path.join(ENGINE, "data_manifest", "balls.json")
ACQ = os.path.join(ENGINE, "data_manifest", "ball_acquisition.json")
GAMES = ["crystal", "firered", "emerald", "platinum", "heartgold"]
ERA = {"crystal": "crystal", "firered": "gen3", "emerald": "gen3", "platinum": "platinum", "heartgold": "hgss", "soulsilver": "hgss"}
ERA_NAME = {"gen1": "Red, Blue and Yellow (Gen 1)", "crystal": "Crystal (Gen 2)", "gen3": "Emerald and FireRed (Gen 3)",
            "platinum": "Platinum (Gen 4)", "hgss": "HeartGold and SoulSilver (Gen 4)"}
SRC = {"gen1": "pret/pokered engine/items/item_effects.asm ItemUseBall",
       "crystal": "pret/pokecrystal engine/items/item_effects.asm PokeBallEffect",
       "gen3": "pret/pokeemerald and pokefirered src/battle_script_commands.c Cmd_handleballthrow",
       "platinum": "pret/pokeplatinum src/battle/battle_script.c BattleScript_CalcCatchShakes",
       "hgss": "pret/pokeheartgold src/battle/battle_command.c BattleSystem_CalculateBallShakes"}
CATEGORY = {"standard": "Standard", "apricorn": "Apricorn", "specialized": "Specialized", "comfort": "Comfort",
            "parks": "Safari and parks", "commemorative": "Commemorative"}

# id, name, PKHeX ball id, generation introduced, category, the games it's in (with its name there when it differs),
# special functionality, related balls
BALLS = [
    ("poke", "Poké Ball", 4, 1, "standard", {g: None for g in GAMES}, [], ["great", "ultra", "premier"]),
    ("great", "Great Ball", 3, 1, "standard", {g: None for g in GAMES}, ["a better rate"], ["poke", "ultra"]),
    ("ultra", "Ultra Ball", 2, 1, "standard", {g: None for g in GAMES}, ["a better rate"], ["great", "master"]),
    ("master", "Master Ball", 1, 1, "standard", {g: None for g in GAMES}, ["never fails"], ["ultra", "cherish"]),
    ("safari", "Safari Ball", 5, 1, "parks", {"firered": None, "emerald": None, "platinum": None, "heartgold": None},
     ["Safari Zone only"], ["sport", "park"]),
    ("level", "Level Ball", 18, 2, "apricorn", {"crystal": None, "heartgold": None}, ["your Pokémon's level"], ["fast", "heavy", "lure"]),
    ("lure", "Lure Ball", 19, 2, "apricorn", {"crystal": None, "heartgold": None}, ["fishing"], ["net", "dive", "level"]),
    ("moon", "Moon Ball", 23, 2, "apricorn", {"crystal": None, "heartgold": None}, ["Moon Stone lines"], ["dusk", "love", "friend"]),
    ("friend", "Friend Ball", 22, 2, "apricorn", {"crystal": None, "heartgold": None}, ["friendship"], ["luxury", "heal", "love"]),
    ("love", "Love Ball", 21, 2, "apricorn", {"crystal": None, "heartgold": None}, ["same species, opposite gender"], ["friend", "moon"]),
    ("heavy", "Heavy Ball", 20, 2, "apricorn", {"crystal": None, "heartgold": None}, ["weight"], ["level", "fast"]),
    ("fast", "Fast Ball", 17, 2, "apricorn", {"crystal": None, "heartgold": None}, ["fast Pokémon"], ["quick", "level", "heavy"]),
    ("sport", "Sport Ball", 24, 2, "parks", {"crystal": "Park Ball", "heartgold": None}, ["Bug-Catching Contest"], ["safari", "park", "net"]),
    ("park", "Park Ball", 25, 4, "parks", {"platinum": None, "heartgold": None}, ["Pal Park"], ["sport", "safari"]),
    ("net", "Net Ball", 6, 3, "specialized", {g: None for g in GAMES[1:]}, ["Water and Bug types"], ["dive", "lure", "nest"]),
    ("dive", "Dive Ball", 7, 3, "specialized", {g: None for g in GAMES[1:]}, ["underwater (Gen 3), on water (Gen 4)"], ["net", "lure"]),
    ("nest", "Nest Ball", 8, 3, "specialized", {g: None for g in GAMES[1:]}, ["low level"], ["net", "level", "repeat"]),
    ("repeat", "Repeat Ball", 9, 3, "specialized", {g: None for g in GAMES[1:]}, ["already caught"], ["timer", "nest"]),
    ("timer", "Timer Ball", 10, 3, "specialized", {g: None for g in GAMES[1:]}, ["long battles"], ["quick", "repeat"]),
    ("luxury", "Luxury Ball", 11, 3, "comfort", {g: None for g in GAMES[1:]}, ["friendship"], ["friend", "heal", "premier"]),
    ("premier", "Premier Ball", 12, 3, "commemorative", {g: None for g in GAMES[1:]}, ["commemorative"], ["poke", "cherish", "luxury"]),
    ("dusk", "Dusk Ball", 13, 4, "specialized", {"platinum": None, "heartgold": None}, ["night and caves"], ["moon", "quick"]),
    ("heal", "Heal Ball", 14, 4, "comfort", {"platinum": None, "heartgold": None}, ["heals"], ["luxury", "friend"]),
    ("quick", "Quick Ball", 15, 4, "specialized", {"platinum": None, "heartgold": None}, ["first turn"], ["timer", "fast", "dusk"]),
    ("cherish", "Cherish Ball", 16, 4, "commemorative", {"platinum": None, "heartgold": None}, ["event"], ["premier", "master"]),
]

# What each ball does, era by era: a plain statement, the numbers it rests on, the game's own bug where there is one.
# Multipliers are tenths in Gens 3-4 (the code's ballMultiplier: 15 = x1.5).
MECH = {
    "poke": {"gen1": ("The first random number is drawn from 0-255 and the HP check uses a ball factor of 12.", {"range": 255, "factor": 12}),
             "crystal": ("No change to the catch rate (x1).", {"x": 1}), "gen3": ("x1.", {"x10": 10}),
             "platinum": ("x1.", {"x10": 10}), "hgss": ("x1.", {"x10": 10})},
    "great": {"gen1": ("The first random number is drawn from 0-200; the HP check uses a ball factor of 8.", {"range": 200, "factor": 8}),
              "crystal": ("x1.5 to the catch rate (capped at 255).", {"x": 1.5}), "gen3": ("x1.5.", {"x10": 15}),
              "platinum": ("x1.5.", {"x10": 15}), "hgss": ("x1.5.", {"x10": 15})},
    "ultra": {"gen1": ("The first random number is drawn from 0-150; the HP check uses a ball factor of 12.", {"range": 150, "factor": 12}),
              "crystal": ("x2 to the catch rate (capped at 255).", {"x": 2}), "gen3": ("x2.", {"x10": 20}),
              "platinum": ("x2.", {"x10": 20}), "hgss": ("x2.", {"x10": 20})},
    "master": {e: ("Always catches.", {"always": True}) for e in ("gen1", "crystal", "gen3", "platinum", "hgss")},
    "safari": {"gen1": ("Like the Ultra Ball: random number from 0-150, ball factor 12. Thrown only in the Safari Zone.", {"range": 150, "factor": 12}),
               "gen3": ("x1.5. Thrown only in the Safari Zone; rocks and bait move the catch rate instead.", {"x10": 15}),
               "platinum": ("x1.5. Thrown only in the Great Marsh, where the Pokémon's mood moves the catch rate.", {"x10": 15}),
               "hgss": ("x1.5. Thrown only in the Safari Zone, where the Pokémon's mood moves the catch rate.", {"x10": 15})},
    "level": {"crystal": ("x2 if your Pokémon's level is above theirs, x4 if half your level is above theirs, x8 if a quarter is. "
                          "It skips the HP and status step entirely: a full-health Pokémon is as easy as a weakened one.", {"x": [2, 4, 8]}),
              "hgss": ("x2 if your Pokémon's level is above theirs, x4 if half your level is above theirs, x8 if a quarter is. "
                       "It multiplies the catch rate itself, capped at 255.", {"x": [2, 4, 8]})},
    "lure": {"crystal": ("x3 to the catch rate against a Pokémon hooked with a rod.", {"x": 3}),
             "hgss": ("x3 to the catch rate against a Pokémon hooked with a rod (capped at 255).", {"x": 3})},
    "moon": {"crystal": ("Meant to give x4 to Pokémon that evolve with a Moon Stone, but it never does.", {"x": 1},
                         "The code checks the wrong item (Burn Heal's id), so no Pokémon ever gets the boost."),
             "hgss": ("x4 to the catch rate for the Nidoran lines, Clefairy's, Jigglypuff's and Skitty's (capped at 255).", {"x": 4, "list": 14})},
    "friend": {"crystal": ("No change to the catch rate; the Pokémon's friendship starts at 200.", {"x": 1, "friendship": 200}),
               "hgss": ("No change to the catch rate; the Pokémon's friendship starts at 200.", {"x10": 10, "friendship": 200})},
    "love": {"crystal": ("Meant to give x8 against the same species of the opposite gender; it boosts the same gender instead.", {"x": 8},
                         "The comparison is reversed: same species and the same gender gets x8. Genderless Pokémon never do."),
             "hgss": ("x8 to the catch rate against the same species as yours, of the opposite gender (capped at 255).", {"x": 8})},
    "heavy": {"crystal": ("Adds to the catch rate by weight: -20 under 102.4 kg, +0 under 204.8 kg, +20 under 307.2 kg, +30 under 409.6 kg, "
                          "+40 from 409.6 kg.", {"weights": [1024, 2048, 3072, 4096], "add": [-20, 0, 20, 30, 40]},
                          "Kadabra, Tauros and Sunflora are read with another Pokémon's weight."),
              "hgss": ("Adds to the catch rate by weight: +20 from 204.8 kg, +30 from 307.2 kg, +40 from 409.6 kg; -20 for everything lighter.",
                       {"weights": [2048, 3072, 4096], "add": [-20, 20, 30, 40]},
                       "Its last test reads the catch rate instead of the weight, so every Pokémon under 204.8 kg takes the -20 (the 102.4 kg step is gone).")},
    "fast": {"crystal": ("Meant to give x4 to Pokémon that tend to flee; only Magnemite, Grimer and Tangela get it.", {"x": 4},
                         "The loop reads just the first three entries of the flee list."),
             "hgss": ("x4 to the catch rate for Pokémon with a base Speed of 100 or more (capped at 255).", {"x": 4, "speed": 100})},
    "sport": {"crystal": ("x1.5 to the catch rate. Called the Park Ball here: the Bug-Catching Contest's ball.", {"x": 1.5}),
              "hgss": ("x1.5. The Bug-Catching Contest's ball.", {"x10": 15})},
    "park": {"platinum": ("Always catches: it's thrown only in Pal Park, at Pokémon brought over from Gen 3.", {"always": True}),
             "hgss": ("Always catches: it's thrown only in Pal Park, at Pokémon brought over from Gen 3.", {"always": True})},
    "net": {e: ("x3 against Water- and Bug-type Pokémon.", {"x10": 30}) for e in ("gen3", "platinum", "hgss")},
    "dive": {"gen3": ("x3.5 underwater (Emerald's dives; FireRed has no underwater, so x1 there).", {"x10": 35}),
             "platinum": ("x3.5 when the battle is on water (surfing or fishing).", {"x10": 35}),
             "hgss": ("x3.5 when the battle is on water (surfing or fishing).", {"x10": 35})},
    "nest": {e: ("Better the lower the Pokémon's level: (40 - level) / 10 below level 40, never worse than x1 (up to x3.9 at level 1).", {"x10": "40-level"})
             for e in ("gen3", "platinum", "hgss")},
    "repeat": {e: ("x3 if the species is already caught in your Pokédex.", {"x10": 30}) for e in ("gen3", "platinum", "hgss")},
    "timer": {e: ("(10 + turns) / 10: x1 on the first turn, rising by 0.1 a turn to x4 from turn 30.", {"x10": "10+turns", "max10": 40})
              for e in ("gen3", "platinum", "hgss")},
    "luxury": {e: ("x1; every friendship gain is 1 bigger for a Pokémon that lives in one.", {"x10": 10, "friendship": 1}) for e in ("gen3", "platinum", "hgss")},
    "premier": {e: ("x1.", {"x10": 10}) for e in ("gen3", "platinum", "hgss")},
    "dusk": {e: ("x3.5 at night or in a cave.", {"x10": 35}) for e in ("platinum", "hgss")},
    "heal": {e: ("x1; the caught Pokémon's HP and status are restored.", {"x10": 10}) for e in ("platinum", "hgss")},
    "quick": {e: ("x4 on the first turn of the battle.", {"x10": 40}) for e in ("platinum", "hgss")},
    "cherish": {e: ("x1. Only event Pokémon come in one.", {"x10": 10}) for e in ("platinum", "hgss")},
}
FORMULA = {
    "gen1": "A different method from every later game: the ball sets the range of a first random number; status subtracts 25 (sleep, freeze) or 12 (burn, paralysis, poison) from it; the HP check divides max HP x 255 by the ball factor and by a quarter of current HP.",
    "crystal": "Catch rate after the ball, x (3 x max HP - 2 x HP) / (3 x max HP), +10 for sleep or freeze, capped at 255; caught when a random 0-255 is at most that. Burn, poison and paralysis add nothing (a bug), and a Pokémon with more than 341 max HP breaks the arithmetic (a bug). Gen 2 doesn't store which ball a Pokémon was caught in.",
    "gen3": "Catch rate x ball x (3 x max HP - 2 x HP) / (3 x max HP), x2 for sleep or freeze, x1.5 for burn, poison or paralysis. 255 or more catches outright; otherwise four shake checks, each passing with odds 1048560 / sqrt(sqrt(16711680 / that)) out of 65536.",
    "platinum": "The same formula as Gen 3, with Gen 4's balls added.",
    "hgss": "The same formula, except that the Apricorn balls multiply or add to the catch rate itself (capped at 255) instead of being a ball multiplier, so very catchable Pokémon gain less from them.",
}
# Blackthorn's creative reading: how each ball's design reads, and the direction for its conceptual interior (a
# habitable room; the equator band as a ring or balcony, the button as a round window). Creative, never canon.
CREATIVE = {
    "poke": ("The original: red over white, the black band and white button that every other design varies.", "a warm, lived-in round den: a red-lacquered dome, white plaster walls, a black ring of shelves at the equator, a brass-rimmed round window where the button sits"),
    "great": ("Blue with two red fins: a step up, built to look quicker.", "a traveler's cabin under a blue dome, the two red fins as crimson canopies over a reading nook and a bunk, maps and a compass-rose floor"),
    "ultra": ("Black with yellow bands: serious equipment.", "a black-and-gold observatory workshop, the yellow bands as brass gantries across the dome, a telescope at the round window"),
    "master": ("Purple with two pink domes and an M: the one that never fails.", "a violet hall of honor, the two pink domes as rose-lit rotundas, an M cartouche over the doorway, polished white stone below"),
    "safari": ("Camouflage greens: made for the Safari Zone's grass.", "a canvas safari lodge, camouflage tent-cloth on timber ribs, khaki rugs, field gear, a slatted window onto tall grass"),
    "level": ("Kurt's Red Apricorn ball, for training up.", "a training dojo of tiered wooden platforms rising level by level around a central mat"),
    "lure": ("Kurt's Blu Apricorn ball, for the water.", "a seaside boathouse: rods and nets on the walls, water lapping through a floor hatch, a round porthole"),
    "moon": ("Kurt's Ylw Apricorn ball, with its crescent.", "a peaceful nocturnal retreat lit by moonlight through a crescent skylight, deep blue cushions, silver lamps"),
    "friend": ("Kurt's Grn Apricorn ball, made to put a Pokémon at ease.", "a warm, natural, welcoming nook of living wood and moss, sunlight through leaves, a woven hammock"),
    "love": ("Kurt's Pnk Apricorn ball, with its heart.", "a soft rose parlor with a heart-shaped arch, paired armchairs, pressed flowers and warm lamplight"),
    "heavy": ("Kurt's Blk Apricorn ball, built solid.", "a solid, grounded, sheltered vault of stone and iron, thick walls, a low hearth, heavy timber beams"),
    "fast": ("Kurt's Wht Apricorn ball, for the quick ones.", "an airy streamlined lounge like a wind tunnel, sweeping curved benches, banners rippling"),
    "sport": ("The Bug-Catching Contest's ball.", "a meadow clubhouse for the contest, net racks, glass terrariums, a window onto National Park's grass"),
    "park": ("Pal Park's ball, for the ones who come across.", "a quiet park pavilion, a lawn and old trees seen through arches, a bench by a fountain"),
    "net": ("A net over blue: for water and bugs.", "a room woven from nets and rope lattice, hammocks strung across, cool aquatic light through the mesh"),
    "dive": ("Blue waves: built for the deep.", "a serene underwater grotto suite, rippling light on the ceiling, coral ledges, a still pool to sink into"),
    "nest": ("Green and gentle: for the young and small.", "a cozy woven nest-room of interlaced twigs and grasses, soft down bedding, green leaf light"),
    "repeat": ("Orange with yellow rings: the ball for a familiar face.", "a homecoming room of repeating arches in orange and yellow, a wall of keepsakes from the last time"),
    "timer": ("Marked like a clock face: patience pays.", "a clockwork study of brass gears and hourglasses, a great clock face as the round window, a calm place where time is felt"),
    "luxury": ("Black and gold: comfort as a design principle.", "an elegant, comfortable private sanctuary: a richly furnished circular lounge with warm gold lighting, beautiful furniture and substantial architectural detail"),
    "premier": ("White with a red band: made for an occasion.", "a white marble gallery of ceremony, a single red velvet band around the room, soft daylight on commemorative plaques"),
    "dusk": ("Dark green and black: for the dark.", "a twilight cave terrace of dark stone and ember lanterns, the last orange light of evening through the cave mouth"),
    "heal": ("Pink and white: soft by design.", "a soft pink-and-white spa, warm baths, folded towels, gentle steam and rest"),
    "quick": ("Blue with yellow streaks: first-move speed.", "a bright launch deck, starting-line stripes on the floor, streamlined benches, open sky beyond"),
    "cherish": ("Deep red: kept for the rarest.", "a jewel-box keepsake chamber of deep red velvet, glass cases of mementos, candlelight"),
}
APRICORN = {"level": "Red Apricorn", "lure": "Blu Apricorn", "moon": "Ylw Apricorn", "friend": "Grn Apricorn",
            "love": "Pnk Apricorn", "heavy": "Blk Apricorn", "fast": "Wht Apricorn"}


# --- the game's own descriptions -----------------------------------------------------------------------------------
def _read(name):
    with open(os.path.join(RAW, name), encoding="utf-8") as fh:
        return fh.read()


def _tidy(text):
    text = text.replace("#MON", "POKéMON").replace("POKéMON", "Pokémon").replace("POKé", "Poké").replace("\\n", " ")
    words = [w.capitalize() if w.isupper() and len(w) > 1 and w not in ("HP", "PP") else w for w in text.split()]
    return re.sub(r"\s+", " ", " ".join(words)).replace("- ", "").strip()


def descriptions():
    """{ball: {game: text}}: Crystal's, Emerald's (FireRed shares Gen 3's) and HeartGold's own words."""
    out = {b[0]: {} for b in BALLS}
    cr = _read("crystal_item_descriptions.asm")
    for bid, label in {"poke": "Poke", "great": "Great", "ultra": "Ultra", "master": "Master", "level": "Level", "lure": "Lure",
                       "moon": "Moon", "friend": "Friend", "love": "Love", "heavy": "Heavy", "fast": "Fast", "sport": "Park"}.items():
        m = re.search(label + r"BallDesc:\n((?:\t(?:db|next)\s+\"[^\"]*\"\n)+)", cr)
        if m:
            out[bid]["crystal"] = _tidy(" ".join(re.findall(r"\"([^\"]*)\"", m.group(1))).replace("@", ""))
    em = _read("emerald_item_descriptions.h")
    for b in BALLS:
        m = re.search(r"s" + b[1].replace("é", "e").replace(" ", "") + r"Desc\[\] = _\(\s*((?:\"[^\"]*\"\s*)+)\);", em)
        if m:
            out[b[0]]["emerald"] = _tidy(" ".join(re.findall(r"\"([^\"]*)\"", m.group(1))))
    hg = json.loads(_read("heartgold_item_descriptions.json"))["messages"]
    ids = {m.group(1): int(m.group(2)) for m in re.finditer(r"#define ITEM_(\w+)_BALL\s+(\d+)", _read("heartgold_items.h"))}
    for b in BALLS:
        n = ids.get(b[0].upper())
        if n is not None and n < len(hg):
            txt = hg[n].get("en_US")
            out[b[0]]["heartgold"] = _tidy("".join(txt) if isinstance(txt, list) else txt or "")
    return out


# --- holding the numbers to the code -------------------------------------------------------------------------------
def _defined(c_text, func):
    """Where a C function is defined (not just declared)."""
    return re.search(re.escape(func) + r"\([^;{]*\)\s*\{", c_text).start()


def _cases(c_text, func):
    """{ITEM_X: multiplier} from a C catch routine's switch (the first `ballMultiplier|ballMod = N` under each case)."""
    body = c_text[_defined(c_text, func):]
    body = body[:body.index("\n}\n")]
    out, cur = {}, []
    for line in body.splitlines():
        cases = re.findall(r"case (ITEM_\w+):", line)
        if cases:
            cur = cases if not out.get("_open") else cur + cases
        m = re.search(r"\b(?:ballMultiplier|ballMod)\s*=\s*(\d+);", line)
        if m and cur:
            for c in cur:
                out.setdefault(c, int(m.group(1)))
            cur = []
    return out


def check():
    """Every number in MECH, against the pinned sources. Returns the list of disagreements (empty when all hold)."""
    bad = []

    def want(what, have, expect):
        if have != expect:
            bad.append(f"{what}: the code says {have!r}, the record says {expect!r}")

    x10 = lambda era, ball: MECH[ball][era][1].get("x10")
    for era, fname, func in (("gen3", "emerald_battle_script_commands.c", "Cmd_handleballthrow"),
                             ("gen3", "firered_battle_script_commands.c", "Cmd_handleballthrow"),
                             ("platinum", "platinum_battle_script.c", "BattleScript_CalcCatchShakes"),
                             ("hgss", "heartgold_battle_command.c", "BattleSystem_CalculateBallShakes")):
        cases = _cases(_read(fname), func)
        for ball in ("net", "dive", "repeat", "dusk", "quick", "sport"):
            if era in MECH[ball] and isinstance(x10(era, ball), int):
                want(f"{fname} {ball}", cases.get(f"ITEM_{ball.upper()}_BALL"), x10(era, ball))
        text = _read(fname)
        want(f"{fname} nest", bool(re.search(r"ITEM_NEST_BALL:[\s\S]{0,300}?40 - ", text[_defined(text, func):])), True)
    em = _read("emerald_battle_script_commands.c")
    std = dict(re.findall(r"\[ITEM_(\w+)_BALL - ITEM_ULTRA_BALL\]\s*=\s*(\d+)", em))
    for ball in ("ultra", "great", "poke", "safari"):
        want(f"Gen 3 {ball}", int(std[ball.upper()]), x10("gen3", ball))
    pt = _read("platinum_battle_script.c")
    pstd = [int(n) for n in re.findall(r"^\s*(\d+),", re.search(r"sBasicBallMod\[\] = \{([^}]*)\}", pt).group(1), re.M)]
    want("Platinum ultra/great/poke/safari", pstd, [x10("platinum", b) for b in ("ultra", "great", "poke", "safari")])
    hs = _read("heartgold_battle_command_data.s")
    hstd = [int(n) for n in re.search(r"sStandardBallCatchRates:.*\n\s*\.byte ([\d, ]+)", hs).group(1).split(",")]
    want("HeartGold ultra/great/poke/safari", hstd, [x10("hgss", b) for b in ("ultra", "great", "poke", "safari")])
    moon = re.findall(r"\.short SPECIES_(\w+)", hs[hs.index("sMoonBallPokemon:"):hs.index("sMoonBallPokemon:") + 900].split(".public")[0])
    want("HeartGold Moon Ball list", len(moon), MECH["moon"]["hgss"][1]["list"])
    hg = _read("heartgold_battle_command.c")
    want("HeartGold Fast Ball speed", bool(re.search(r"speed >= 100\)", hg)), True)
    want("HeartGold Heavy Ball bug", "else if (catchRate < 1024)" in hg, True)
    for w, add in ((4096, 40), (3072, 30), (2048, 20)):
        want(f"HeartGold Heavy Ball {w}", bool(re.search(rf"weight >= {w}\) {{[^}}]*catchRate \+= {add};", hg)), True)
    for ball, x in (("FAST", "\\*= 4"), ("LURE", "\\*= 3"), ("LOVE", "\\*= 8"), ("MOON", "\\*= 4")):
        want(f"HeartGold {ball}", bool(re.search(rf"case ITEM_{ball}_BALL:[\s\S]{{0,700}}?catchRate {x};", hg)), True)
    # Crystal
    cr = _read("crystal_item_effects.asm")
    table = re.findall(r"dbw (\w+_BALL),\s+(\w+)", cr)
    want("Crystal balls with a multiplier routine", sorted(t[0] for t in table),
         sorted(["ULTRA_BALL", "GREAT_BALL", "SAFARI_BALL", "HEAVY_BALL", "LEVEL_BALL", "LURE_BALL", "FAST_BALL", "MOON_BALL", "LOVE_BALL", "PARK_BALL"]))
    weights = re.findall(r"db HIGH\((\d+)\),\s+(\d+)", cr)
    want("Crystal Heavy Ball table", [int(w) for w, _ in weights][:3], MECH["heavy"]["crystal"][1]["weights"][1:])
    want("Crystal Heavy Ball boosts", [int(a) for _, a in weights], MECH["heavy"]["crystal"][1]["add"][1:])
    want("Crystal Moon Ball bug", "BUG: Moon Ball does not boost catch rate" in cr, True)
    want("Crystal Love Ball bug", "BUG: Love Ball boosts catch rate for the wrong gender" in cr, True)
    want("Crystal Fast Ball reads three", bool(re.search(r"FastBallMultiplier:[\s\S]{0,80}ld d, 3", cr)), True)
    flee = re.findall(r"db (\w+)", _read("crystal_flee_mons.asm"))[:3]
    want("Crystal Fast Ball's three", [f.capitalize() for f in flee], ["Magnemite", "Grimer", "Tangela"])
    want("Crystal Level Ball skips HP", bool(re.search(r"cp LEVEL_BALL\n\tld a, b\n\tjp z, \.skip_hp_calc", cr)), True)
    bugs = _read("crystal_bugs_and_glitches.md")
    for title in ("Moon Ball does not boost catch rate", "Love Ball boosts catch rate for the wrong gender",
                  "Fast Ball only boosts catch rate for three Pokémon", "Heavy Ball uses wrong weight value for three Pokémon",
                  "BRN/PSN/PAR do not affect catch rate"):
        want(f"pokecrystal bug doc: {title}", f"### {title}" in bugs, True)
    want("Crystal Apricorns", re.findall(r"db (\w+)_APRICORN, (\w+)_BALL", _read("crystal_apricorn_balls.asm")),
         [("RED", "LEVEL"), ("BLU", "LURE"), ("YLW", "MOON"), ("GRN", "FRIEND"), ("WHT", "FAST"), ("BLK", "HEAVY"), ("PNK", "LOVE")])
    # Red
    rb = _read("red_item_effects.asm")
    for ball, era in (("Poké Ball", 255), ("Great Ball", 200), ("Ultra/Safari Ball", 150)):
        want(f"Red {ball} range", f"; {ball}:" in rb and f"[0, {era}]" in rb, True)
    want("Red ball factors", "It's 8 for Great Balls and 12 for the others" in rb, True)
    # friendship and healing
    want("Luxury Ball friendship (Gen 3)", "== ITEM_LUXURY_BALL)" in _read("emerald_pokemon.c"), True)
    pk = _read("platinum_pokemon.c")
    want("Luxury Ball friendship (Gen 4)", bool(re.search(r"ITEM_LUXURY_BALL\) \{\s*friendshipChange\+\+;", pk)), True)
    want("Heal Ball restores HP (Gen 4)", bool(re.search(r"monPokeball == ITEM_HEAL_BALL\) \{\s*int monMaxHP", pk)), True)
    want("Friend Ball friendship (HeartGold)", "FRIENDSHIP_TIER_HI_MIN" in hg, True)
    return bad


# --- the record ---------------------------------------------------------------------------------------------------
def build():
    desc = descriptions()
    acq = {}
    if os.path.exists(ACQ):
        with open(ACQ, encoding="utf-8") as fh:
            acq = json.load(fh)
    balls = []
    for bid, name, pkhex, gen, cat, games, tags, related in BALLS:
        mech = []
        for era in ("gen1", "crystal", "gen3", "platinum", "hgss"):
            m = MECH.get(bid, {}).get(era)
            if not m:
                continue
            row = {"era": era, "name": ERA_NAME[era], "says": m[0], "numbers": m[1], "source": SRC[era], "class": "confirmed"}
            if len(m) > 2:
                row["bug"] = m[2]
            mech.append(row)
        ways = {g: (acq.get("games", {}).get(g, {}).get(bid) or []) for g in games}
        design, interior = CREATIVE[bid]
        balls.append({"id": bid, "name": name, "pkhex": pkhex, "introduced": gen, "category": cat, "category_name": CATEGORY[cat],
                      "games": {g: {"name": games[g] or name} for g in games}, "tags": tags, "related": related,
                      "apricorn": APRICORN.get(bid), "mechanics": mech, "descriptions": desc[bid], "acquisition": ways,
                      "art": {"sprite": f"items/{bid}-ball.png" if bid != "poke" else "items/poke-ball.png",
                              "official": f"items/dream-world/{bid}-ball.png" if bid not in APRICORN and bid not in ("sport", "park", "cherish") else None},
                      "creative": {"design": design, "interior": interior, "class": "Blackthorn conceptual interpretation"}})
    return {"_note": "The 25 Gen I-IV Poké Balls (equipment/balls.py). Mechanics from each game's own catch code (checked by check()); "
                     "acquisition from equipment/acquire.py; descriptions are the games' own words; creative fields are Blackthorn's.",
            "formula": {e: {"name": ERA_NAME[e], "says": FORMULA[e], "source": SRC[e]} for e in FORMULA},
            "era_of_game": ERA, "games": GAMES, "categories": CATEGORY, "balls": balls,
            "apricorns": acq.get("apricorns", {}), "acquisition_gaps": acq.get("gaps", []), "acquisition_commits": acq.get("commits", {})}


def main():
    bad = check()
    if bad:
        print("The mechanics disagree with the games' code:\n  " + "\n  ".join(bad))
        return 1
    data = build()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f"{OUT}: {len(data['balls'])} balls, mechanics checked against the code")


if __name__ == "__main__":
    sys.exit(main())
