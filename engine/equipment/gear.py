"""The equipment library: every key item of Crystal, Emerald, FireRed, Platinum and HeartGold/SoulSilver, and the
trainer gear that isn't a bag item (spec §8), with the Apricorns (§9).

What's in it is read, not picked: every item a game files in its key items pocket, from the game's own item data
(Crystal's data/items/attributes.asm, Emerald's src/data/items.h, FireRed's src/data/items.json, Platinum's
res/items/data/*.json, HeartGold's files/itemtool/itemdata/item_data.csv; fetch_reference.py --equipment). One entry
per item across the games, matched by the item's constant (HeartGold's ITEM_VS__SEEKER is Platinum's ITEM_VS_SEEKER).
For each game the entry has the game's own name for it, its own description (Crystal's descriptions.asm, Emerald's
item_descriptions.h, FireRed's items.json, Platinum's item files, HeartGold's message bank 0221) and how you get it:
equipment/acquire.py's key-item run over the games' scripts (gifts, item balls, hidden items, each citing its file
and line), written to data_manifest/ball_acquisition.json under "gear". An item a game's table carries but none of its
scripts hands out is kept and said so: the two Gen 3 games share one item table, and HeartGold's carries Platinum's.

The Running Shoes, Pokégear, PokéNav and Pokétch aren't bag items; they're short Blackthorn summaries, labelled as
such. The groups, the "story item" mark and what an item connects to in Blackthorn are Blackthorn's sorting, not the
games'. check() holds the library to the games' item lists on every build (app/equipment_pack.py).
"""
import csv
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
RAW = os.path.join(ENGINE, "data", "raw", "equipment")
REF = os.path.join(ENGINE, "data", "raw")
GAMES = ("crystal", "firered", "emerald", "platinum", "heartgold")
TABLE = {"crystal": "crystal", "firered": "gen3", "emerald": "gen3", "platinum": "gen4", "heartgold": "gen4"}   # acquire.py's
POCKET_FROM = {"crystal": "pokecrystal data/items/attributes.asm, pocket KEY_ITEM",
               "emerald": "pokeemerald src/data/items.h, .pocket = POCKET_KEY_ITEMS",
               "firered": "pokefirered src/data/items.json, pocket POCKET_KEY_ITEMS",
               "platinum": "pokeplatinum res/items/data/*.json, fieldPocket POCKET_KEY_ITEMS",
               "heartgold": "pokeheartgold files/itemtool/itemdata/item_data.csv, fieldPocket POCKET_KEY_ITEMS"}
TEXT_FROM = {"crystal": "Crystal's description", "emerald": "Emerald's description", "firered": "FireRed's description",
             "platinum": "Platinum's description", "heartgold": "HeartGold's description (SoulSilver shares the text)"}
KIND = {"traversal": "Getting around", "fishing": "Fishing", "finding": "Finders and scopes", "navigation": "Maps and navigation",
        "communication": "Devices", "battle": "Battles", "cases": "Cases and keepers", "gardening": "Berries, growing and gathering",
        "passes": "Passes and tickets", "keys": "Keys", "story": "Story items", "fossils": "Fossils",
        "legendary": "Legendary and event items", "other": "Other"}
STORY = {"keys", "story"}   # groups whose items matter only to the plot: each is marked "story item" on the page
CONNECTS = {"travel": "how far and fast a team can travel (Phase 7: survival and homestead)",
            "food": "fishing and food for a camp (camp life, Phase 7)", "foraging": "finding what the land hides (foraging, Phase 7)",
            "wildlife": "finding and identifying wild Pokémon (the Glasshouse and the atlas)", "battle": "rematches and recorded battles (the Trainer Library)",
            "gardening": "growing Berries (the Glasshouse)", "crafting": "Kurt's Apricorn balls (the Poké Ball collection)",
            "survival": "getting through hard terrain (Phase 7: survival)"}

# The four that aren't bag items: id, name, group, link, {game: a Blackthorn summary}.
FEATURES = [
    ("running-shoes", "Running Shoes", "traversal", "travel", {g: "Hold B to run on foot. Not a bag item: given early in the journey."
                                                              for g in ("firered", "emerald", "platinum", "heartgold")}),
    ("pokegear", "Pokégear", "communication", "travel", {g: "The watch-phone of Johto: clock, map, phone and radio. Not a bag item: Mom gives it at the start."
                                                        for g in ("crystal", "heartgold")}),
    ("pokenav", "PokéNav", "communication", "travel", {"emerald": "Hoenn's handheld: map, condition checks, the Match Call phone and ribbons. Not a bag item: the Devon Corporation's gift."}),
    ("poketch", "Pokétch", "communication", "foraging", {"platinum": "Sinnoh's wrist device of apps: clock, counter, map, dowsing, Berry Searcher and more. Not a bag item: you're given it in Jubilife City."}),
]
# Every key item, by its constant without ITEM_ and underscores: (id, name when the games' own won't do, group,
# what it connects to in Blackthorn). The 24 bag items the library started with keep their ids; check() fails on a
# key item that isn't here, or an entry no game has.
ITEMS = {
    # getting around, fishing, finders and scopes, maps
    "BICYCLE": ("bicycle", None, "traversal", "travel"), "MACHBIKE": ("mach-bike", None, "traversal", "travel"),
    "ACROBIKE": ("acro-bike", None, "traversal", "travel"), "GOGOGGLES": ("go-goggles", None, "traversal", "survival"),
    "OLDROD": ("old-rod", None, "fishing", "food"), "GOODROD": ("good-rod", None, "fishing", "food"),
    "SUPERROD": ("super-rod", None, "fishing", "food"),
    "ITEMFINDER": ("itemfinder", None, "finding", "foraging"), "DOWSINGMCHN": ("dowsing-machine", "Dowsing Machine", "finding", "foraging"),
    "POKERADAR": ("poke-radar", None, "finding", "wildlife"), "DEVONSCOPE": ("devon-scope", None, "finding", "wildlife"),
    "SILPHSCOPE": ("silph-scope", None, "finding", "wildlife"), "EXPLORERKIT": ("explorer-kit", None, "finding", "survival"),
    "TOWNMAP": ("town-map", None, "navigation", "travel"),
    # devices and battles
    "POKEFLUTE": ("poke-flute", None, "communication", None), "FAMECHECKER": ("fame-checker", None, "communication", None),
    "TEACHYTV": ("teachy-tv", None, "communication", None), "JOURNAL": ("journal", None, "communication", None),
    "PALPAD": ("pal-pad", None, "communication", None), "GBSOUNDS": ("gb-sounds", None, "communication", None),
    "PHOTOALBUM": ("photo-album", None, "communication", None), "UNOWNREPORT": ("unown-report", "Unown Report", "communication", "wildlife"),
    "VSSEEKER": ("vs-seeker", None, "battle", "battle"), "VSRECORDER": ("vs-recorder", None, "battle", "battle"),
    "POINTCARD": ("point-card", None, "battle", "battle"), "RULEBOOK": ("rule-book", None, "battle", "battle"),
    # cases and keepers; Berries, growing and gathering
    "COINCASE": ("coin-case", None, "cases", None), "BLUECARD": ("blue-card", None, "cases", None),
    "POKEBLOCKCASE": ("pokeblock-case", None, "cases", "food"), "POFFINCASE": ("poffin-case", None, "cases", "food"),
    "APRICORNBOX": ("apricorn-box", None, "cases", "crafting"), "TMCASE": ("tm-case", None, "cases", None),
    "SEALCASE": ("seal-case", None, "cases", None), "FASHIONCASE": ("fashion-case", None, "cases", None),
    "SEALBAG": ("seal-bag", None, "cases", None), "LOOTSACK": ("loot-sack", None, "cases", "survival"),
    "BERRYPOUCH": ("berry-pouch", None, "gardening", "gardening"), "POWDERJAR": ("powder-jar", None, "gardening", "food"),
    "SQUIRTBOTTLE": ("squirtbottle", None, "gardening", "gardening"), "WAILMERPAIL": ("wailmer-pail", None, "gardening", "gardening"),
    "SPRAYDUCK": ("sprayduck", None, "gardening", "gardening"), "BERRYPOTS": ("berry-pots", None, "gardening", "gardening"),
    "SOOTSACK": ("soot-sack", None, "gardening", None),
    # passes and tickets
    "SSTICKET": ("ss-ticket", None, "passes", "travel"), "PASS": ("pass", None, "passes", "travel"),
    "TRIPASS": ("tri-pass", None, "passes", "travel"), "RAINBOWPASS": ("rainbow-pass", None, "passes", "travel"),
    "CONTESTPASS": ("contest-pass", None, "passes", None), "BIKEVOUCHER": ("bike-voucher", None, "passes", None),
    # keys
    "CARDKEY": ("card-key", None, "keys", None), "BASEMENTKEY": ("basement-key", None, "keys", None),
    "SECRETKEY": ("secret-key", None, "keys", None), "LIFTKEY": ("lift-key", None, "keys", None),
    "STORAGEKEY": ("storage-key", None, "keys", None), "ROOM1KEY": ("rm-1-key", None, "keys", None),
    "ROOM2KEY": ("rm-2-key", None, "keys", None), "ROOM4KEY": ("rm-4-key", None, "keys", None),
    "ROOM6KEY": ("rm-6-key", None, "keys", None), "WORKSKEY": ("works-key", None, "keys", None),
    "GALACTICKEY": ("galactic-key", None, "keys", None), "SUITEKEY": ("suite-key", None, "keys", None),
    "MAGMAEMBLEM": ("magma-emblem", None, "keys", None),
    # story items
    "SECRETPOTION": ("secretpotion", None, "story", None), "MYSTERYEGG": ("mystery-egg", None, "story", None),
    "MACHINEPART": ("machine-part", None, "story", None), "LOSTITEM": ("lost-item", None, "story", None),
    "REDSCALE": ("red-scale", None, "story", None), "SLOWPOKETAIL": ("slowpoketail", None, "story", None),
    "RAGECANDYBAR": ("ragecandybar", None, "story", None), "DEVONGOODS": ("devon-goods", None, "story", None),
    "LETTER": ("letter", None, "story", None), "SCANNER": ("scanner", None, "story", None),
    "METEORITE": ("meteorite", None, "story", None), "OAKSPARCEL": ("oaks-parcel", None, "story", None),
    "GOLDTEETH": ("gold-teeth", None, "story", None), "TEA": ("tea", None, "story", None),
    "RUBY": ("ruby", None, "story", None), "SAPPHIRE": ("sapphire", None, "story", None),
    "OLDCHARM": ("old-charm", None, "story", None), "PARCEL": ("parcel", None, "story", None),
    "COUPON1": ("coupon-1", None, "story", None), "COUPON2": ("coupon-2", None, "story", None),
    "COUPON3": ("coupon-3", None, "story", None), "LOCKCAPSULE": ("lock-capsule", None, "story", None),
    # fossils
    "ROOTFOSSIL": ("root-fossil", None, "fossils", "wildlife"), "CLAWFOSSIL": ("claw-fossil", None, "fossils", "wildlife"),
    "HELIXFOSSIL": ("helix-fossil", None, "fossils", "wildlife"), "DOMEFOSSIL": ("dome-fossil", None, "fossils", "wildlife"),
    "OLDAMBER": ("old-amber", None, "fossils", "wildlife"),
    # legendary and event items
    "GSBALL": ("gs-ball", "GS Ball", "legendary", None), "EGGTICKET": ("egg-ticket", None, "legendary", None),
    "CLEARBELL": ("clear-bell", None, "legendary", None), "TIDALBELL": ("tidal-bell", None, "legendary", None),
    "SILVERWING": ("silver-wing", None, "legendary", None), "RAINBOWWING": ("rainbow-wing", None, "legendary", None),
    "REDORB": ("red-orb", None, "legendary", None), "BLUEORB": ("blue-orb", None, "legendary", None),
    "JADEORB": ("jade-orb", None, "legendary", None), "EONTICKET": ("eon-ticket", None, "legendary", "travel"),
    "MYSTICTICKET": ("mysticticket", "MysticTicket", "legendary", "travel"), "AURORATICKET": ("auroraticket", "AuroraTicket", "legendary", "travel"),
    "OLDSEAMAP": ("old-sea-map", None, "legendary", "travel"), "REDCHAIN": ("red-chain", None, "legendary", None),
    "LUNARWING": ("lunar-wing", None, "legendary", None), "AZUREFLUTE": ("azure-flute", None, "legendary", None),
    "OAKSLETTER": ("oaks-letter", None, "legendary", None), "MEMBERCARD": ("member-card", None, "legendary", None),
    "MAGMASTONE": ("magma-stone", None, "legendary", None), "GRACIDEA": ("gracidea", None, "legendary", None),
    "ENIGMASTONE": ("enigma-stone", None, "legendary", None),
}
FIRST = ["bicycle", "mach-bike", "acro-bike", "running-shoes", "old-rod", "good-rod", "super-rod", "itemfinder",
         "dowsing-machine", "poke-radar", "vs-seeker", "vs-recorder", "town-map", "pokegear", "pokenav", "poketch",
         "coin-case", "squirtbottle", "wailmer-pail", "sprayduck", "berry-pots", "apricorn-box", "go-goggles",
         "devon-scope", "silph-scope", "pokeblock-case", "poffin-case", "explorer-kit"]   # the 28 the library started with


NEEDS = ["crystal_item_attributes.asm", "crystal_item_names.asm", "crystal_item_descriptions.asm", "crystal_item_constants.asm",
         "emerald_items.h", "emerald_item_descriptions.h", "firered_items.json", "platinum_item_list.txt", "platinum_items.json",
         "heartgold_item_data.csv", "heartgold_item_names.json", "heartgold_item_descriptions.json", "heartgold_items.h"]


def _read(name, base=RAW):
    with open(os.path.join(base, name), encoding="utf-8") as fh:
        return fh.read()


KEEP = {"TM", "TMs", "HM", "HMs", "TV", "GS", "GB", "PP", "HP", "HQ", "OT", "ID", "PC", "UFO"}


def _tidy(text):
    """A game's text made readable: line breaks joined (a hyphen at a break kept, as the game prints it: silver-
    colored, Golden-rod), POKéMON as Pokémon (Crystal writes POKé as #), words in capitals in normal case (OAK'S ->
    Oak's; TM, HQ and the like kept)."""
    text = text.replace("{POKEBLOCK}S", "Pokéblocks").replace("{POKEBLOCK}", "Pokéblock").replace("#MON", "POKéMON")
    text = text.replace("#", "POKé").replace("\\n", " ").replace("\n", " ").replace("S.S.", "\x01").replace("@", "")
    text = text.replace("POKéMON", "Pokémon").replace("POKé", "Poké")
    text = re.sub(r"[A-Z][A-Z']*[A-Z](?![a-zé])", lambda m: m.group(0) if m.group(0) in KEEP else m.group(0).capitalize(), text)
    return re.sub(r"\s+", " ", text).replace("- ", "-").replace("\x01", "S.S.").strip()


def key_of(const):
    """The item's constant without ITEM_ and underscores: one key for an item across the games."""
    return re.sub(r"^ITEM_", "", const).replace("_", "")


# --- each game's key items pocket ---------------------------------------------------------------------------------
def pocket(game):
    """Every item the game files in its key items pocket, in item order: [{const, index, raw (its name as the game
    spells it), says (its description as the game has it), desc (the description's label)}]."""
    return {"crystal": _crystal, "emerald": _emerald, "firered": _firered, "platinum": _platinum, "heartgold": _heartgold}[game]()


def _crystal():
    pairs = re.findall(r"^; (\w+)\s*\n\s*item_attribute (.*)$", _read("crystal_item_attributes.asm"), re.M)
    names = re.findall(r'^\s*li "([^"]*)"', _read("crystal_item_names.asm"), re.M)
    cr = _read("crystal_item_descriptions.asm")
    labels = re.findall(r"dw (\w+Desc)", cr)
    out = []
    for i, (const, attr) in enumerate(pairs, 1):           # entries correspond to item ids, from 1
        if [a.strip() for a in attr.split(",")][4] != "KEY_ITEM":
            continue
        m = re.search(re.escape(labels[i - 1]) + r":\n((?:\t(?:db|next|text|line)\s+\"[^\"]*\"\n)+)", cr)
        says = " ".join(re.findall(r"\"([^\"]*)\"", m.group(1))) if m else None
        out.append({"const": const, "index": i, "raw": names[i - 1], "says": says, "desc": labels[i - 1]})
    return out


def _emerald():
    texts = {m.group(1): " ".join(re.findall(r"\"([^\"]*)\"", m.group(2))) for m in
             re.finditer(r"(\w+)\[\] = _\(\s*((?:\"[^\"]*\"\s*)+)\);", _read("emerald_item_descriptions.h"))}
    out = []
    for i, m in enumerate(re.finditer(r"\[(ITEM_\w+)\] =\s*\{(.*?)\n    \},", _read("emerald_items.h"), re.S)):
        body = m.group(2)
        if "POCKET_KEY_ITEMS" not in body:
            continue
        sym = re.search(r"\.description = (\w+)", body).group(1)
        out.append({"const": m.group(1), "index": i, "raw": re.search(r'\.name = _\("([^"]*)"\)', body).group(1),
                    "says": texts.get(sym), "desc": sym})
    return out


def _firered():
    return [{"const": it["itemId"], "index": i, "raw": it["english"], "says": it["description_english"], "desc": "description_english"}
            for i, it in enumerate(json.loads(_read("firered_items.json"))["items"]) if it["pocket"] == "POCKET_KEY_ITEMS"]


def _platinum():
    order = [c for c in _read("platinum_item_list.txt").split() if c != "MAX_ITEMS"]
    data = json.loads(_read("platinum_items.json"))["items"]
    return [{"const": c, "index": i, "raw": data[c]["name"], "says": "".join(data[c]["description"]),
             "desc": f"res/items/data/{c[5:].lower()}.json"}
            for i, c in enumerate(order) if c in data and data[c]["fieldPocket"] == "POCKET_KEY_ITEMS"]


def hg_ids():
    """HeartGold's items.h numbers for the ITEM_ names, from the item list only (later #defines reuse small numbers)."""
    text = _read("heartgold_items.h")
    out, seen = {}, set()
    for name, num in re.findall(r"#define (ITEM_\w+)\s+(\d+)\b", text[text.index("#define ITEM_NONE 0"):]):
        if name != "ITEM_MIN" and not name.startswith("ITEM_VAR_") and int(num) not in seen:
            out[name] = int(num)
            seen.add(int(num))
    return out


def _heartgold():
    ids = hg_ids()
    names = json.loads(_read("heartgold_item_names.json"))["messages"]
    texts = json.loads(_read("heartgold_item_descriptions.json"))["messages"]
    text = lambda t: "".join(t) if isinstance(t, list) else t
    out = []
    for row in csv.DictReader(_read("heartgold_item_data.csv").splitlines()):
        if row["fieldPocket"] == "POCKET_KEY_ITEMS":
            n = ids[row["item"]]
            out.append({"const": row["item"], "index": n, "raw": text(names[n].get("en_US")),
                        "says": text(texts[n].get("en_US")), "desc": f"msg_0221 #{n}"})
    return out


# --- one entry per item ---------------------------------------------------------------------------------------------
def catalogue():
    """{key: {game: pocket row}}: every key item of every game, merged across the games by key_of(constant)."""
    out = {}
    for game in GAMES:
        for row in pocket(game):
            out.setdefault(key_of(row["const"]), {})[game] = row
    return out


def key_tables():
    """For acquire.py's key-item run: {table: {constant without ITEM_: id}} (crystal, gen3, gen4) and {game: ids}."""
    tables, ids = {"crystal": {}, "gen3": {}, "gen4": {}}, {g: set() for g in GAMES}
    for key, games in catalogue().items():
        if key not in ITEMS:
            continue
        for game, row in games.items():
            tables[TABLE[game]][re.sub(r"^ITEM_", "", row["const"])] = ITEMS[key][0]
            ids[game].add(ITEMS[key][0])
    return tables, ids


def _case_like(raw, model):
    """A Gen 2 or 3 name (in capitals) in the case of the same name in Gen 4 when the letters match, else in title case:
    SQUIRTBOTTLE -> SquirtBottle, S.S.TICKET -> S.S.Ticket, OAK'S PARCEL -> Oak's Parcel."""
    raw = raw.replace("{POKEBLOCK}", "POKéBLOCK")
    if model and [c.lower() for c in raw if c.isalpha()] == [c.lower() for c in model if c.isalpha()]:
        letters = iter([c for c in model if c.isalpha()])
        return "".join(next(letters) if c.isalpha() else c for c in raw)
    if re.search(r"[a-z]", raw.replace("é", "")):
        return raw
    return " ".join(w if w in KEEP else re.sub(r"[A-Za-zé']+", lambda m: m.group(0).capitalize(), w) for w in raw.split(" "))


def _art():
    """PokeAPI's item identifiers by English name (letters and digits only), for the sprite; display only."""
    ident = {r["id"]: r["identifier"] for r in csv.DictReader(open(os.path.join(REF, "items.csv"), encoding="utf-8"))}
    out = {}
    for r in csv.DictReader(open(os.path.join(REF, "item_names.csv"), encoding="utf-8")):
        if r["local_language_id"] == "9" and r["item_id"] in ident:
            out.setdefault(re.sub(r"[^a-z0-9]", "", r["name"].lower().replace("é", "e")), ident[r["item_id"]])
    return out


def check(acquisition=None):
    """What disagrees with the games' item lists (empty when all's well): every key item of every game is in the
    library and sorted into a group, every entry is some game's key item, each has its game's description, each
    game's tables line up (Crystal's attributes and item constants by item number; Platinum's item files), and, given
    acquire.py's file, its key-item ways are for items that game's pocket has."""
    missing = [n for n in NEEDS if not os.path.exists(os.path.join(RAW, n))]
    if missing:
        return [f"engine/data/raw/equipment/ lacks {', '.join(missing)}: run python3 -I engine/fetch_reference.py --equipment"]
    bad = []
    cat = catalogue()
    if acquisition is not None:
        _, ids = key_tables()
        if "gear" not in acquisition:
            bad.append("data_manifest/ball_acquisition.json has no key-item ways ('gear'): run equipment/acquire.py")
        for g, items in acquisition.get("gear", {}).items():
            bad += [f"{g}: acquire.py has ways for {i}, which isn't in {g}'s key items pocket" for i in items if i not in ids.get(g, ())]
    for key, games in cat.items():
        if key not in ITEMS:
            bad.append(f"{'/'.join(games)}: {next(iter(games.values()))['raw']} ({key}) is a key item but has no group in gear.ITEMS")
        for game, row in games.items():
            if not (row["says"] or "").strip() or row["says"].strip() == "?????":
                bad.append(f"{game}: no description for {row['const']} ({row['desc']})")
    bad += [f"gear.ITEMS has {k}, which is in no game's key items pocket" for k in ITEMS if k not in cat]
    consts = re.findall(r"^\s*const (\w+)", _read("crystal_item_constants.asm"), re.M)
    for row in pocket("crystal"):
        if consts[row["index"]] != row["const"]:
            bad.append(f"crystal: attributes.asm entry {row['index']} is {row['const']}, item_constants.asm says {consts[row['index']]}")
    order = [c for c in _read("platinum_item_list.txt").split() if c != "MAX_ITEMS"]
    files = json.loads(_read("platinum_items.json"))["items"]
    missing = [c for c in order if c not in files and not c.startswith("ITEM_UNUSED_")]
    if missing:
        bad.append(f"platinum: no item file for {', '.join(missing)}")
    ids = {ITEMS[k][0] for k in ITEMS} | {f[0] for f in FEATURES}
    bad += [f"the library lost {i}, one of the 28 it started with (old links point to it)" for i in FIRST if i not in ids]
    if len(ids) != len(ITEMS) + len(FEATURES):
        bad.append("two entries in gear.ITEMS or FEATURES share an id")
    return bad


def build(acquisition=None):
    """The library's entries, in group order: the features, then every key item with each game whose key items pocket
    has it. Per game: its name, its description, the ways to get it (acquire.py), `found` (a way was found) and, when
    none was, `refs`: script lines that still name it (none: only the item table has it)."""
    acq = (acquisition or {}).get("gear", {})
    refs = (acquisition or {}).get("gear_refs", {})
    art = _art()
    out = []
    for gid, name, kind, link, games in FEATURES:
        out.append({"id": gid, "name": name, "kind": kind, "kind_name": KIND[kind], "story": False, "item": False,
                    "games": {g: {"name": name, "says": games[g], "from": "Blackthorn summary (no bag item)", "item": False,
                                  "found": True, "ways": []} for g in GAMES if g in games},
                    "connects": CONNECTS.get(link), "art": f"items/{art.get(re.sub(r'[^a-z0-9]', '', name.lower().replace('é', 'e')), gid)}.png"})
    for key, games in catalogue().items():
        gid, title, kind, link = ITEMS[key]
        model = (games.get("heartgold") or games.get("platinum") or {}).get("raw") or title
        name = title or _case_like(next(games[g]["raw"] for g in ("heartgold", "platinum", "firered", "emerald", "crystal") if g in games), model)
        per = {}
        for g in GAMES:
            if g not in games:
                continue
            row = games[g]
            ways = (acq.get(g) or {}).get(gid, [])
            per[g] = {"name": row["raw"] if g in ("platinum", "heartgold") else _case_like(row["raw"], model),
                      "says": _tidy(row["says"]), "from": TEXT_FROM[g], "item": True, "found": bool(ways), "ways": ways}
            if not ways:
                per[g]["refs"] = (refs.get(g) or {}).get(gid, [])
        look = re.sub(r"[^a-z0-9]", "", name.lower().replace("é", "e"))
        out.append({"id": gid, "name": name, "kind": kind, "kind_name": KIND[kind], "story": kind in STORY, "item": True,
                    "games": per, "connects": CONNECTS.get(link), "art": f"items/{art.get(look, gid)}.png"})
    order = list(KIND)
    return sorted(out, key=lambda e: order.index(e["kind"]))


def counts(entries):
    """Per game: how many key items its pocket has, for how many a way to get it was found, and how many more its
    scripts still name."""
    per = lambda g, ok: sum(1 for e in entries if e["item"] and g in e["games"] and ok(e["games"][g]))
    return {g: {"key_items": per(g, lambda x: True), "found": per(g, lambda x: x["found"]),
                "named": per(g, lambda x: not x["found"] and x.get("refs"))} for g in GAMES}
