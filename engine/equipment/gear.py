"""The general equipment library: trainer gear from Gens 2-4 beyond the Poké Balls (spec §8), and the Apricorns (§9).

Simpler records than the balls: what it is, which games have it, what it's for in the game's own words, how you get it
(equipment/acquire.py's map-script gifts where it found them), and what it connects to in Blackthorn (the field and
survival work, Phase 7). Bag items read their description from the games' text (Crystal's descriptions.asm, Emerald's
item_descriptions.h, HeartGold's message bank 0221); the features with no bag item (Running Shoes, the Pokégear,
PokéNav, Pokétch) are short Blackthorn summaries, labelled as such.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
RAW = os.path.join(ENGINE, "data", "raw", "equipment")
KIND = {"traversal": "Getting around", "fishing": "Fishing", "finding": "Finding things", "navigation": "Maps and navigation",
        "communication": "Devices", "gardening": "Growing and gathering", "cases": "Cases and keepers", "battle": "Battles", "other": "Other"}

# id, name, kind, {game: (source, key)} where source is crystal (const), gen3 (description symbol), gen4 (ITEM_ name) or
# feature (no bag item: a Blackthorn summary), and what it connects to in Blackthorn
GEAR = [
    ("bicycle", "Bicycle", "traversal", {"crystal": ("crystal", "BICYCLE"), "firered": ("gen3", "sBicycleDesc"), "platinum": ("gen4", "BICYCLE"), "heartgold": ("gen4", "BICYCLE")}, "travel"),
    ("mach-bike", "Mach Bike", "traversal", {"emerald": ("gen3", "sMachBikeDesc")}, "travel"),
    ("acro-bike", "Acro Bike", "traversal", {"emerald": ("gen3", "sAcroBikeDesc")}, "travel"),
    ("running-shoes", "Running Shoes", "traversal", {g: ("feature", "Hold B to run on foot. Not a bag item: given early in the journey.") for g in ("firered", "emerald", "platinum", "heartgold")}, "travel"),
    ("old-rod", "Old Rod", "fishing", {"crystal": ("crystal", "OLD_ROD"), "firered": ("gen3", "sOldRodDesc"), "emerald": ("gen3", "sOldRodDesc"), "platinum": ("gen4", "OLD_ROD"), "heartgold": ("gen4", "OLD_ROD")}, "food"),
    ("good-rod", "Good Rod", "fishing", {"crystal": ("crystal", "GOOD_ROD"), "firered": ("gen3", "sGoodRodDesc"), "emerald": ("gen3", "sGoodRodDesc"), "platinum": ("gen4", "GOOD_ROD"), "heartgold": ("gen4", "GOOD_ROD")}, "food"),
    ("super-rod", "Super Rod", "fishing", {"crystal": ("crystal", "SUPER_ROD"), "firered": ("gen3", "sSuperRodDesc"), "emerald": ("gen3", "sSuperRodDesc"), "platinum": ("gen4", "SUPER_ROD"), "heartgold": ("gen4", "SUPER_ROD")}, "food"),
    ("itemfinder", "Itemfinder", "finding", {"crystal": ("crystal", "ITEMFINDER"), "firered": ("gen3", "sItemfinderDesc"), "emerald": ("gen3", "sItemfinderDesc")}, "foraging"),
    ("dowsing-machine", "Dowsing Machine", "finding", {"heartgold": ("gen4", "DOWSING_MCHN")}, "foraging"),
    ("poke-radar", "Poké Radar", "finding", {"platinum": ("gen4", "POKE_RADAR")}, "wildlife"),
    ("vs-seeker", "Vs. Seeker", "battle", {"firered": ("gen3", "sVSSeekerDesc"), "platinum": ("gen4", "VS__SEEKER")}, "battle"),
    ("vs-recorder", "Vs. Recorder", "battle", {"platinum": ("gen4", "VS__RECORDER"), "heartgold": ("gen4", "VS__RECORDER")}, "battle"),
    ("town-map", "Town Map", "navigation", {"firered": ("gen3", "sTownMapDesc"), "platinum": ("gen4", "TOWN_MAP")}, "travel"),
    ("pokegear", "Pokégear", "communication", {g: ("feature", "The watch-phone of Johto: clock, map, phone and radio. Not a bag item: Mom gives it at the start.") for g in ("crystal", "heartgold")}, "travel"),
    ("pokenav", "PokéNav", "communication", {"emerald": ("feature", "Hoenn's handheld: map, condition checks, the Match Call phone and ribbons. Not a bag item: the Devon Corporation's gift.")}, "travel"),
    ("poketch", "Pokétch", "communication", {"platinum": ("feature", "Sinnoh's wrist device of apps: clock, counter, map, dowsing, Berry Searcher and more. Not a bag item: you're given it in Jubilife City.")}, "foraging"),
    ("coin-case", "Coin Case", "cases", {"crystal": ("crystal", "COIN_CASE"), "firered": ("gen3", "sCoinCaseDesc"), "emerald": ("gen3", "sCoinCaseDesc"), "platinum": ("gen4", "COIN_CASE"), "heartgold": ("gen4", "COIN_CASE")}, None),
    ("squirtbottle", "SquirtBottle", "gardening", {"crystal": ("crystal", "SQUIRTBOTTLE"), "heartgold": ("gen4", "SQUIRTBOTTLE")}, "gardening"),
    ("wailmer-pail", "Wailmer Pail", "gardening", {"emerald": ("gen3", "sWailmerPailDesc")}, "gardening"),
    ("sprayduck", "Sprayduck", "gardening", {"platinum": ("gen4", "SPRAYDUCK")}, "gardening"),
    ("berry-pots", "Berry Pots", "gardening", {"heartgold": ("gen4", "BERRY_POTS")}, "gardening"),
    ("apricorn-box", "Apricorn Box", "cases", {"heartgold": ("gen4", "APRICORN_BOX")}, "crafting"),
    ("go-goggles", "Go-Goggles", "traversal", {"emerald": ("gen3", "sGoGogglesDesc")}, "survival"),
    ("devon-scope", "Devon Scope", "finding", {"emerald": ("gen3", "sDevonScopeDesc")}, "wildlife"),
    ("silph-scope", "Silph Scope", "finding", {"firered": ("gen3", "sSilphScopeDesc")}, "wildlife"),
    ("pokeblock-case", "Pokéblock Case", "cases", {"emerald": ("gen3", "sPokeblockCaseDesc")}, "food"),
    ("poffin-case", "Poffin Case", "cases", {"platinum": ("gen4", "POFFIN_CASE")}, "food"),
    ("explorer-kit", "Explorer Kit", "finding", {"platinum": ("summary", "The kit for the Sinnoh Underground, where fossils, spheres and treasures are dug from the walls. A bag item; its Platinum text isn't in the fetched files.")}, "survival"),
]
CONNECTS = {"travel": "how far and fast a team can travel (Phase 7: survival and homestead)",
            "food": "fishing and food for a camp (camp life, Phase 7)", "foraging": "finding what the land hides (foraging, Phase 7)",
            "wildlife": "finding and identifying wild Pokémon (the Glasshouse and the atlas)", "battle": "rematches and recorded battles (the Trainer Library)",
            "gardening": "growing Berries (the Glasshouse)", "crafting": "Kurt's Apricorn balls (the Poké Ball collection)",
            "survival": "getting through hard terrain (Phase 7: survival)"}


def _read(name):
    with open(os.path.join(RAW, name), encoding="utf-8") as fh:
        return fh.read()


def _tidy(text):
    text = text.replace("#MON", "POKéMON").replace("POKéMON", "Pokémon").replace("POKé", "Poké").replace("\\n", " ")
    words = [w.capitalize() if w.isupper() and len(w) > 1 else w for w in text.split()]
    return re.sub(r"\s+", " ", " ".join(words)).replace("- ", "").strip()


def text_of(source, key):
    """(text, where it came from) for one game's item."""
    if source == "feature":
        return key, "Blackthorn summary (no bag item)"
    if source == "summary":
        return key, "Blackthorn summary"
    if source == "crystal":
        consts = re.findall(r"^\s*const (\w+)", _read("crystal_item_constants.asm"), re.M)
        if key not in consts:
            return None, None
        cr = _read("crystal_item_descriptions.asm")
        labels = re.findall(r"dw (\w+Desc)", cr)
        label = labels[consts.index(key) - 1] if consts.index(key) - 1 < len(labels) else None   # const NO_ITEM is 0
        m = re.search(re.escape(label) + r":\n((?:\t(?:db|next)\s+\"[^\"]*\"\n)+)", cr) if label else None
        return (_tidy(" ".join(re.findall(r"\"([^\"]*)\"", m.group(1))).replace("@", "")), "Crystal's description") if m else (None, None)
    if source == "gen3":
        m = re.search(re.escape(key) + r"\[\] = _\(\s*((?:\"[^\"]*\"\s*)+)\);", _read("emerald_item_descriptions.h"))
        return (_tidy(" ".join(re.findall(r"\"([^\"]*)\"", m.group(1)))), "Gen 3's description (Emerald and FireRed share the item text)") if m else (None, None)
    ids = {m.group(1): int(m.group(2)) for m in re.finditer(r"#define ITEM_(\w+)\s+(\d+)", _read("heartgold_items.h"))}
    msgs = json.loads(_read("heartgold_item_descriptions.json"))["messages"]
    n = ids.get(key)
    txt = msgs[n].get("en_US") if n is not None and n < len(msgs) else None
    if not txt:
        return None, None
    return _tidy("".join(txt) if isinstance(txt, list) else txt), "Gen 4's description (HeartGold's item text)"


def build(acquisition=None):
    acq = (acquisition or {}).get("gear", {})
    out = []
    for gid, name, kind, games, link in GEAR:
        per = {}
        for g, (src, key) in games.items():
            txt, where = text_of(src, key)
            per[g] = {"says": txt.replace("{pokeblock}", "Pokéblock") if txt else txt, "from": where, "item": src != "feature",
                      "ways": (acq.get(g) or {}).get(gid, [])}
        out.append({"id": gid, "name": name, "kind": kind, "kind_name": KIND[kind], "games": per,
                    "connects": CONNECTS.get(link), "art": f"items/{gid}.png"})
    return out
