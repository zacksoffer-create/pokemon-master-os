"""How you get every Poké Ball in Crystal, Emerald, FireRed, Platinum and HeartGold/SoulSilver, read from the games' own
decompiled source (the pret projects), with the file and label each fact comes from.

    python3 -I engine/equipment/acquire.py [--pret DIR] [--out FILE]   # engine/data_manifest/ball_acquisition.json

DIR holds one git clone per repo (pokecrystal, pokeemerald, pokefirered, pokeplatinum, pokeheartgold; default PRET
below, or $PRET_DIR). Every file is read from the pinned commit in COMMITS through git's object store (`git cat-file`),
never from the working tree, so a sparse or blobless clone works: blobs it lacks are fetched in one batch first. The
inputs are only read and parsed; nothing in them is run.

What each game's extractor reads:
- Crystal: maps/*.asm (`pokemart` with the checkevent tests and the clerk's object_event flag in front of it,
  `giveitem`, `verbosegiveitem[var]`, `itemball`/`hiddenitem` with their object_event/bg_event, `fruittree`,
  `special GiveParkBalls`/`BuenaPrize`/`UnlockMysteryGift`), data/items/ (marts, rooftop sale and bargain shop with
  their own prices, Buena prizes, Mom's purchases, the Mystery Gift pool, the Apricorn table, fruit trees, prices in
  attributes.asm), engine/items/mart.asm (which rooftop list applies), maps/KurtsHouse.asm (Kurt's Apricorn -> ball,
  cross-checked with data/items/apricorn_balls.asm).
- Emerald, FireRed: data/maps/*/scripts.inc (`pokemart` lists with the goto_if tests in front of them, `giveitem`,
  `giveitem_msg`), data/maps/*/map.json (which item-ball scripts a map really places; hidden items),
  data/scripts/ (item balls, shared gifts such as the contest hall), src/ (prices, the Premier Ball bonus in shop.c,
  the Safari Ball count, Pickup, and the prize tables in C: Emerald's Lottery Corner, Lilycove Lady and Trainer Hill,
  FireRed's Resort Gorgeous reward).
- Platinum: include/data/mart_items.h with src/scrcmd_shop.c's badge tiers, res/field/scripts/ (marts, gifts, the
  lottery, the Great Marsh entry, visible items), include/data/field/hidden_items.h, res/field/events/ (which
  visible/hidden item and which script entry a map really uses), include/data/map_headers.h (which script and event
  file belongs to which map), res/items/data/*.json (prices), src/ (Premier bonus, Safari count, Pickup, Pal Park).
- HeartGold: src/scrcmd_mart.c (badge mart and the unnamed specialty marts, picked by VAR_SPECIAL_x8004) and
  src/overlay_03/shop_menu.c (Poké Balls hidden until a flag), files/fielddata/script/scr_seq/ (gifts and marts: item
  ids there are often plain numbers, read through include/constants/items.h; a small reader follows what the
  VAR_SPECIAL_x80NN variables hold up to the give command, one jump deep, and records the raw tests in front of it),
  files/fielddata/eventdata/zone_event/ (item balls, hidden items, Apricorn trees), include/constants/maps.h (map code
  -> map name), include/constants/std_script.h, asm/unk_02031B0C.s (Kurt's Apricorn -> ball table),
  src/apricorn_tree_sys.c, the phone gift scripts, src/ (Bug-Catching Contest, Safari, Pal Park, Pickup in asm/),
  files/itemtool/itemdata/item_data.csv (prices). SoulSilver shares this data; a way whose script entry checks
  GetGameVersion first is flagged.

A way is {"how": shop|gift|field|craft|other, "where", "source": "<repo>/<path>:<line> <label>", ...}, plus price,
requires (badges), condition (the raw flag/variable tests), who, qty, note where they apply. What the source can't
settle goes to "gaps", never into a guess; "notes" hold source-backed remarks (a ball that isn't an item, a missing
bonus). Place names are the map or label names made readable; the raw label stays in "source".
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
OUT = os.path.join(ENGINE, "data_manifest", "ball_acquisition.json")
PRET = os.environ.get("PRET_DIR") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw", "pret")
COMMITS = {"pokecrystal": "5c877ef55197039c9676e8e3eec6d254b1c40fe8",
           "pokeemerald": "731ad5bfd6e6f265508d0efcca0ba42f9dcf5881",
           "pokefirered": "ce6406d8c2eaf46d543c8a2606de0c3cb1951982",
           "pokeplatinum": "be36a9db3d2390a5009adc087c7aef550ce335e7",
           "pokeheartgold": "6988158691eb6178cff697cda0428045ddcba5fb"}
GAMES = {"crystal": "pokecrystal", "emerald": "pokeemerald", "firered": "pokefirered", "platinum": "pokeplatinum",
         "heartgold": "pokeheartgold"}
BALLS = ["poke", "great", "ultra", "master", "safari", "level", "lure", "moon", "friend", "love", "heavy", "fast", "sport",
         "park", "net", "dive", "nest", "repeat", "timer", "luxury", "premier", "dusk", "heal", "quick", "cherish"]
# item constant (without ITEM_) -> ball id. Crystal's PARK_BALL is the Bug-Catching Contest ball (HGSS's SPORT_BALL).
BALL_CONST = {f"{b.upper()}_BALL": b for b in BALLS if b not in ("sport", "park")}
BALL_CONST_CRYSTAL = {**BALL_CONST, "PARK_BALL": "sport"}
BALL_CONST_GEN4 = {**BALL_CONST, "SPORT_BALL": "sport", "PARK_BALL": "park"}
APRICORN_NAME = {c: f"{c.capitalize()} Apricorn" for c in ("RED", "BLU", "YLW", "GRN", "WHT", "BLK", "PNK")}
WORD = {"Elms": "Elm's", "Kurts": "Kurt's", "Birchs": "Birch's", "Oaks": "Oak's", "Bills": "Bill's", "Stevens": "Steven's",
        "Dept": "Dept.", "Mt": "Mt.", "Mr": "Mr.", "Pokecenter": "Pokémon Center", "Pokemon": "Pokémon", "Pokemart": "Poké Mart",
        "Pokeathalon": "Pokéathlon", "Pokeathlon": "Pokéathlon", "Hq": "HQ", "Tv": "TV", "Ss": "S.S.", "Pc": "PC", "Ne": "NE",
        "Nw": "NW", "Se": "SE", "Sw": "SW", "Ii": "II", "OF": "of", "Of": "of", "And": "and", "AND": "and", "THE": "the",
        "The": "the", "TO": "to", "To": "to"}


# --- reading the repos ------------------------------------------------------------------------------------------------
class Repo:
    """One pret clone, read at its pinned commit from git's object store."""

    def __init__(self, root, name):
        self.name, self.dir, self.commit = name, os.path.join(root, name), COMMITS[name]
        self._text, self._tree = {}, None

    def _git(self, *args, stdin=None):
        return subprocess.run(["git", "-C", self.dir, *args], input=stdin, capture_output=True, check=True).stdout

    def tree(self):
        if self._tree is None:
            out = self._git("ls-tree", "-r", "--full-tree", self.commit).decode("utf-8", "replace")
            self._tree = {}
            for line in out.splitlines():
                meta, path = line.split("\t", 1)
                if meta.split()[1] == "blob":
                    self._tree[path] = meta.split()[2]
        return self._tree

    def files(self, prefix, suffix=""):
        return sorted(p for p in self.tree() if p.startswith(prefix) and p.endswith(suffix))

    def has(self, path):
        return path in self.tree()

    def prefetch(self, paths):
        """Fetch, in one request, the blobs these paths need that the (blobless) clone doesn't have yet."""
        want = {self.tree()[p] for p in paths if p in self.tree()}
        out = self._git("rev-list", "--objects", "--missing=print", "--no-object-names", "--no-walk", self.commit)
        missing = {l[1:] for l in out.decode().splitlines() if l.startswith("?")} & want
        if missing:
            self._git("-c", "fetch.negotiationAlgorithm=noop", "fetch", "origin", "--no-tags", "--no-write-fetch-head",
                      "--recurse-submodules=no", "--filter=blob:none", "--stdin", stdin="\n".join(sorted(missing)).encode())

    def load(self, paths):
        paths = [p for p in paths if p not in self._text]
        if not paths:
            return
        self.prefetch(paths)
        out = self._git("cat-file", "--batch", stdin="".join(f"{self.commit}:{p}\n" for p in paths).encode())
        pos = 0
        for p in paths:
            nl = out.index(b"\n", pos)
            head = out[pos:nl].split()
            if head[-1] == b"missing":
                self._text[p], pos = None, nl + 1
                continue
            size = int(head[2])
            self._text[p] = out[nl + 1:nl + 1 + size].decode("utf-8", "replace")
            pos = nl + 1 + size + 1

    def read(self, path):
        self.load([path])
        if self._text.get(path) is None:
            raise FileNotFoundError(f"{self.name}@{self.commit[:8]}:{path}")
        return self._text[path]

    def lines(self, path):
        return self.read(path).splitlines()

    def src(self, path, line=None, label=None):
        s = f"{self.name}/{path}" + (f":{line}" if line else "")
        return s + (f" {label}" if label else "")


# --- small helpers --------------------------------------------------------------------------------------------------
def humanize(name):
    """A map or label name made readable: GoldenrodDeptStore2F -> Goldenrod Dept. Store 2F, route_211_west -> Route 211
    West, MAP_AZALEA_POKEMART -> Azalea Poké Mart."""
    name = re.sub(r"^(MAP_HEADER_|MAP_|scripts_|events_)", "", name)
    words = []
    for part in re.split(r"[_\s]+", name):
        if not part:
            continue
        if part.isupper() or part.islower() or part.isdigit():
            toks = [part]
        else:
            toks = re.findall(r"B\d+F|\d+F|[A-Z]{2,}(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+|\d+|[A-Z]", part)
        for t in toks:
            if re.fullmatch(r"[bB]?\d+[fF]", t):
                t = t.upper()
            elif t.isupper() and len(t) > 2 and not re.search(r"\d", t) or t.islower():
                t = t.capitalize()
            words.append(WORD.get(t, t))
    return " ".join(words)


def ball_of(const, table):
    """'ITEM_NEST_BALL' or 'NEST_BALL' -> 'nest' (None for anything else, e.g. the Smoke Ball)."""
    return table.get(re.sub(r"^ITEM_", "", const or ""))


def add(ways, ball, **way):
    if ball:
        ways.setdefault(ball, []).append(dict(way))


def blocks(lines, label_re):
    """Map each line index to the label it sits under: [(label, label_line_index)] per line."""
    cur, at, out = None, None, []
    for i, line in enumerate(lines):
        m = re.match(label_re, line)
        if m:
            cur, at = m.group(1), i
        out.append((cur, at))
    return out


def qty_of(text):
    return int(text) if text and text.isdigit() else (text or 1)


# --- Crystal --------------------------------------------------------------------------------------------------------
CR_LABEL = r"^([A-Za-z_][\w]*|\.[\w]+):{1,2}"


def crystal(repo):
    ways, gaps, notes = {}, [], []
    maps = repo.files("maps/", ".asm")
    data = ["constants/item_constants.asm", "constants/mart_constants.asm", "constants/script_constants.asm",
            "data/items/attributes.asm", "data/items/marts.asm", "data/items/rooftop_sale.asm", "data/items/bargain_shop.asm",
            "data/items/buena_prizes.asm", "data/items/mom_phone.asm", "data/items/mystery_gift_items.asm",
            "data/items/apricorn_balls.asm", "data/items/fruit_trees.asm", "engine/items/mart.asm",
            "engine/events/bug_contest/contest.asm", "engine/events/mom_phone.asm"]
    repo.load(maps + data)
    consts = re.findall(r"^\s*const (\w+)", repo.read("constants/item_constants.asm"), re.M)
    present = {BALL_CONST_CRYSTAL[c] for c in consts if c in BALL_CONST_CRYSTAL}
    item_lines = repo.lines("constants/item_constants.asm")
    for n, line in enumerate(item_lines, 1):
        m = re.match(r"DEF SAFARI_BALL\s+EQU (\$\w+)\s*;\s*(\w+)", line)
        if m:
            heading = next((l.strip("; ").strip() for l in reversed(item_lines[:n - 1]) if l.startswith(";")), "")
            notes.append(f"crystal: no Safari Ball item. SAFARI_BALL is only a constant equal to item {m.group(1)} "
                         f"({m.group(2)}), under the comment '{heading}' ({repo.src('constants/item_constants.asm', n)}).")
    price = crystal_prices(repo)
    crystal_marts(repo, maps, ways, gaps, price)
    crystal_field_and_gifts(repo, maps, ways, gaps)
    crystal_other(repo, maps, ways, gaps)
    return present, ways, gaps, notes, crystal_kurt(repo, ways, gaps, maps)


def crystal_prices(repo):
    price, cur = {}, None
    for line in repo.lines("data/items/attributes.asm"):
        m = re.match(r"^; (\w+)\s*$", line)
        if m:
            cur = m.group(1)
            continue
        m = re.match(r"^\s*item_attribute (\$?[0-9A-Fa-f]+),", line)
        if m and cur:
            v = m.group(1)
            price[cur] = int(v[1:], 16) if v.startswith("$") else int(v)
            cur = None
    return price


def crystal_condition(lines, i, owner):
    """Why this line runs, from the checkevent/checkflag tests that lead to it (raw event names)."""
    label, at = owner[i]
    conds = []
    if label and label.startswith("."):
        scope = cr_global(lines, owner, i)
        for j, line in enumerate(lines):
            m = re.match(rf"^\s*(iftrue|iffalse)\s+{re.escape(label)}\s*$", line)
            if m and owner[j][0] != label and cr_global(lines, owner, j) == scope:
                for k in range(j - 1, max(j - 4, -1), -1):
                    t = re.match(r"^\s*check(event|flag)\s+(\w+)", lines[k])
                    if t:
                        conds.append(f"{t.group(2)} {'set' if m.group(1) == 'iftrue' else 'not set'}")
                        break
    for j in range((at or 0) + 1, i):
        t = re.match(r"^\s*check(event|flag)\s+(\w+)", lines[j])
        m = re.match(r"^\s*(iftrue|iffalse)\s+(\.?\w+)", lines[j + 1]) if t and j + 1 < i else None
        if m:
            conds.append(f"{t.group(2)} {'not set' if m.group(1) == 'iftrue' else 'set'}")
    return "; ".join(dict.fromkeys(conds)) or None


def cr_global(lines, owner, i):
    """The global (non-dot) label a line belongs to."""
    return next((owner[j][0] for j in range(i, -1, -1) if owner[j][0] and not owner[j][0].startswith(".")), None)


def crystal_marts(repo, maps, ways, gaps, price):
    order = re.findall(r"^\s*const (MART_[A-Z0-9_]+)", repo.read("constants/mart_constants.asm"), re.M)
    text = repo.read("data/items/marts.asm")
    table = re.findall(r"^\s*dw (Mart\w+)", text.split("assert_table_length")[0], re.M)
    label_of = dict(zip(order, table))
    stock, cur = {}, None
    for n, line in enumerate(text.splitlines(), 1):
        m = re.match(r"^(\w+):", line)
        if m:
            cur = m.group(1)
            stock[cur] = []
            continue
        if re.match(r"^\s*db -1", line):
            cur = None                                          # end of this mart's list
        m = re.match(r"^\s*db (\w+)", line)
        if cur and m and not m.group(1).isdigit():
            stock[cur].append((m.group(1), n))
    roof = crystal_rooftop(repo, gaps)
    for path in maps:
        lines = repo.lines(path)
        owner = blocks(lines, CR_LABEL)
        place = humanize(os.path.basename(path)[:-4])
        for i, line in enumerate(lines):
            m = re.match(r"^\s*pokemart (MARTTYPE_\w+),\s*(\w+)", line)
            if not m:
                continue
            cond = "; ".join(c for c in (crystal_condition(lines, i, owner), crystal_shown(lines, owner, i)) if c) or None
            if m.group(1) == "MARTTYPE_BARGAIN":                # its own list and prices
                for n, row in enumerate(repo.lines("data/items/bargain_shop.asm"), 1):
                    b = re.match(r"^\s*dbw (\w+),\s*(\d+)", row)
                    if b and ball_of(b.group(1), BALL_CONST_CRYSTAL):
                        add(ways, ball_of(b.group(1), BALL_CONST_CRYSTAL), how="shop", where=place, price=int(b.group(2)),
                            requires=None, condition=cond,
                            source=f"{repo.src(path, i + 1, owner[i][0])}; {repo.src('data/items/bargain_shop.asm', n, 'BargainShopData')}")
                continue
            if m.group(1) == "MARTTYPE_ROOFTOP":
                for item, cost, n, which, when in roof:
                    add(ways, ball_of(item, BALL_CONST_CRYSTAL), how="shop", where=place, price=cost, requires=None,
                        condition="; ".join(c for c in (f"rooftop sale ({when})", cond) if c),
                        source=f"{repo.src(path, i + 1, owner[i][0])}; {repo.src('data/items/rooftop_sale.asm', n, which)}")
                continue
            label = label_of.get(m.group(2))
            if not label:
                gaps.append(f"crystal: {repo.src(path, i + 1)} opens {m.group(2)}, which has no list in data/items/marts.asm")
                continue
            for item, n in stock[label]:
                add(ways, ball_of(item, BALL_CONST_CRYSTAL), how="shop", where=place, price=price.get(item), requires=None,
                    condition=cond, source=f"{repo.src(path, i + 1, owner[i][0])}; {repo.src('data/items/marts.asm', n, label)}")


def crystal_shown(lines, owner, i):
    """The NPC running this script is hidden while its object_event flag is set (Crystal object_event's last field)."""
    script = cr_global(lines, owner, i)
    for line in lines:
        m = re.match(rf"^\s*object_event .*,\s*{re.escape(script or '')},\s*(\w+)\s*$", line) if script else None
        if m and m.group(1) != "-1":
            return f"NPC hidden while {m.group(1)} is set"
    return None


def crystal_rooftop(repo, gaps):
    """The Goldenrod rooftop sale's two lists and which one engine/items/mart.asm picks (before/after the Hall of Fame)."""
    when = {}
    body = repo.read("engine/items/mart.asm").split("RooftopSale:", 1)[-1].split("\n\n", 1)[0]
    first = re.search(r"ld de, (RooftopSaleMart\d)", body)
    flag = re.search(r"bit (STATUSFLAGS_HALL_OF_FAME_F)", body)
    later = re.findall(r"ld de, (RooftopSaleMart\d)", body)
    if first and flag and len(later) == 2:
        when = {later[0]: f"{flag.group(1)} not set, i.e. before the Hall of Fame",
                later[1]: f"{flag.group(1)} set, i.e. after the Hall of Fame"}
    else:
        gaps.append("crystal: couldn't read which rooftop sale list engine/items/mart.asm RooftopSale uses when")
    rows, cur = [], None
    for n, line in enumerate(repo.lines("data/items/rooftop_sale.asm"), 1):
        m = re.match(r"^(RooftopSaleMart\d):", line)
        if m:
            cur = m.group(1)
        m = re.match(r"^\s*dbw (\w+),\s*(\d+)", line)
        if m and cur:
            rows.append((m.group(1), int(m.group(2)), n, cur, when.get(cur, "condition unread") +
                         "; engine/items/mart.asm RooftopSale"))
    return rows


def crystal_field_and_gifts(repo, maps, ways, gaps):
    for path in maps:
        lines = repo.lines(path)
        owner = blocks(lines, CR_LABEL)
        text = "\n".join(lines)
        place = humanize(os.path.basename(path)[:-4])
        for i, line in enumerate(lines):
            label = owner[i][0]
            m = re.match(r"^\s*itemball (\w+)(?:,\s*(\d+))?", line)
            if m and ball_of(m.group(1), BALL_CONST_CRYSTAL):
                placed = re.search(rf"^\s*object_event .*\b{re.escape(label)}\b", text, re.M) if label else None
                add(ways, ball_of(m.group(1), BALL_CONST_CRYSTAL), how="field", where=place, hidden=False,
                    qty=qty_of(m.group(2)), source=repo.src(path, i + 1, label))
                if not placed:
                    gaps.append(f"crystal: item ball {repo.src(path, i + 1, label)} has no object_event in its map")
            m = re.match(r"^\s*hiddenitem (\w+),\s*(\w+)", line)
            if m and ball_of(m.group(1), BALL_CONST_CRYSTAL):
                placed = re.search(rf"^\s*bg_event .*\b{re.escape(label)}\b", text, re.M) if label else None
                add(ways, ball_of(m.group(1), BALL_CONST_CRYSTAL), how="field", where=place, hidden=True, qty=1,
                    source=repo.src(path, i + 1, label))
                if not placed:
                    gaps.append(f"crystal: hidden item {repo.src(path, i + 1, label)} has no bg_event in its map")
            m = re.match(r"^\s*(giveitem|verbosegiveitem|verbosegiveitemvar) (\w+)(?:,\s*(\w+))?", line)
            if m and ball_of(m.group(2), BALL_CONST_CRYSTAL):
                if m.group(1) == "verbosegiveitemvar" and m.group(3) == "VAR_KURT_APRICORNS":
                    continue                                    # Kurt's Apricorn balls: see crystal_kurt (craft)
                who = cr_global(lines, owner, i)
                add(ways, ball_of(m.group(2), BALL_CONST_CRYSTAL), how="gift", where=place, who=who,
                    qty=qty_of(m.group(3)), condition=crystal_condition(lines, i, owner),
                    source=repo.src(path, i + 1, label))


def crystal_other(repo, maps, ways, gaps):
    specials = {}
    for path in maps:
        for i, line in enumerate(repo.lines(path)):
            m = re.match(r"^\s*special (GiveParkBalls|BuenaPrize|UnlockMysteryGift)\b", line)
            if m:
                specials.setdefault(m.group(1), []).append((path, i + 1))
    balls = re.search(r"DEF BUG_CONTEST_BALLS EQU (\d+)", repo.read("constants/script_constants.asm"))
    give = next((k for k, l in enumerate(repo.lines("engine/events/bug_contest/contest.asm"), 1) if l.startswith("GiveParkBalls:")), None)
    for path, n in specials.get("GiveParkBalls", []):
        add(ways, "sport", how="other", where=humanize(os.path.basename(path)[:-4]),
            qty=int(balls.group(1)) if balls else None,
            note="Bug-Catching Contest entry: the gate officer gives the contest's Park Balls. GiveParkBalls sets the "
                 "wParkBallsRemaining counter (BUG_CONTEST_BALLS); they are not put in the Bag",
            source=f"{repo.src(path, n, 'special GiveParkBalls')}; "
                   f"{repo.src('engine/events/bug_contest/contest.asm', give, 'GiveParkBalls')}; "
                   f"{repo.src('constants/script_constants.asm', None, 'BUG_CONTEST_BALLS')}")
    for n, line in enumerate(repo.lines("data/items/buena_prizes.asm"), 1):
        m = re.match(r"^\s*db (\w+),\s*(\d+)", line)
        if m and ball_of(m.group(1), BALL_CONST_CRYSTAL):
            for path, at in specials.get("BuenaPrize", []):
                add(ways, ball_of(m.group(1), BALL_CONST_CRYSTAL), how="other", where=humanize(os.path.basename(path)[:-4]),
                    cost=int(m.group(2)), note=f"Buena's Password prize, {m.group(2)} Blue Card points",
                    source=f"{repo.src('data/items/buena_prizes.asm', n, 'BuenaPrizeItems')}; {repo.src(path, at, 'special BuenaPrize')}")
    cur = None
    for n, line in enumerate(repo.lines("data/items/mom_phone.asm"), 1):
        m = re.match(r"^(MomItems_\d):", line)
        cur = m.group(1) if m else cur
        m = re.match(r"^\s*momitem\s+(\d+),\s*(\d+),\s*MOM_ITEM,\s*(\w+)", line)
        if m and ball_of(m.group(3), BALL_CONST_CRYSTAL):
            add(ways, ball_of(m.group(3), BALL_CONST_CRYSTAL), how="other", where="Mom (money she saves for you)",
                cost=int(m.group(2)), note=f"one of the items Mom may buy with the saved money ({cur}, cost {m.group(2)})",
                source=f"{repo.src('data/items/mom_phone.asm', n, cur)}; {repo.src('engine/events/mom_phone.asm', None, 'MomTriesToBuySomething')}")
    for n, line in enumerate(repo.lines("data/items/mystery_gift_items.asm"), 1):
        m = re.match(r"^\s*db (\w+)", line)
        if m and ball_of(m.group(1), BALL_CONST_CRYSTAL):
            unlock = ", ".join(humanize(os.path.basename(p)[:-4]) for p, _ in specials.get("UnlockMysteryGift", []))
            add(ways, ball_of(m.group(1), BALL_CONST_CRYSTAL), how="other", where="Mystery Gift (link with another player)",
                note="in the Mystery Gift item pool" + (f" (Mystery Gift is unlocked at {unlock})" if unlock else ""),
                source=f"{repo.src('data/items/mystery_gift_items.asm', n, 'MysteryGiftItems')}"
                       + "".join(f"; {repo.src(p, at, 'special UnlockMysteryGift')}" for p, at in specials.get("UnlockMysteryGift", [])))


def crystal_kurt(repo, ways, gaps, maps):
    """Kurt's Apricorn -> ball (maps/KurtsHouse.asm, cross-checked with data/items/apricorn_balls.asm) and the trees."""
    path = "maps/KurtsHouse.asm"
    lines = repo.lines(path)
    owner = blocks(lines, CR_LABEL)
    goes = {}                                                   # apricorn code -> local label
    for i, line in enumerate(lines[:-1]):
        m = re.match(r"^\s*checkevent EVENT_GAVE_KURT_(\w+)_APRICORN", line)
        t = re.match(r"^\s*iftrue (\.\w+)", lines[i + 1])
        if m and t:
            goes.setdefault(m.group(1), t.group(1))
    script = {}
    for i, line in enumerate(lines):
        m = re.match(r"^\s*verbosegiveitemvar (\w+), VAR_KURT_APRICORNS", line)
        if m:
            script[owner[i][0]] = (m.group(1), i + 1)
    table = {}
    for n, line in enumerate(repo.lines("data/items/apricorn_balls.asm"), 1):
        m = re.match(r"^\s*db (\w+)_APRICORN,\s*(\w+)", line)
        if m:
            table[m.group(1)] = (m.group(2), n)
    rows = []
    trees = crystal_trees(repo, maps, gaps)
    for code, label in goes.items():
        item, n = script.get(label, (None, None))
        t_item, t_n = table.get(code, (None, None))
        if item != t_item:
            gaps.append(f"crystal: Kurt's script ({path} {label}) gives {item} for the {APRICORN_NAME[code]}, "
                        f"data/items/apricorn_balls.asm says {t_item}")
        ball = ball_of(item, BALL_CONST_CRYSTAL)
        add(ways, ball, how="craft", where="Kurt's House", who="Kurt", **{"from": APRICORN_NAME[code]},
            note="Kurt makes one ball per Apricorn handed over (quantity VAR_KURT_APRICORNS); you collect them on a "
                 "later visit, once ENGINE_KURT_MAKING_BALLS is clear",
            source=f"{repo.src(path, n, label)}; {repo.src('data/items/apricorn_balls.asm', t_n, 'ApricornBalls')}")
        rows.append({"apricorn": APRICORN_NAME[code], "ball": ball, "trees": [t["where"] for t in trees.get(code, [])],
                     "tree_sources": [t["source"] for t in trees.get(code, [])],
                     "source": f"{repo.src('data/items/apricorn_balls.asm', t_n, 'ApricornBalls')}; {repo.src(path, n, label)}"})
    return rows


def crystal_trees(repo, maps, gaps):
    """FRUITTREE_* -> Apricorn (data/items/fruit_trees.asm, entries in constant order with the constant as a comment)."""
    consts = re.findall(r"^\s*const (FRUITTREE_\w+)", repo.read("constants/script_constants.asm"), re.M)
    rows = re.findall(r"^\s*db (\w+)\s*;\s*(\w+)", repo.read("data/items/fruit_trees.asm"), re.M)
    item_of = {}
    for const, (item, comment) in zip(consts, rows):
        if const == f"FRUITTREE_{comment}":
            item_of[const] = item
        else:
            gaps.append(f"crystal: data/items/fruit_trees.asm's entry for {const} is commented {comment}; tree skipped")
    if len(consts) != len(rows):
        gaps.append(f"crystal: {len(consts)} FRUITTREE_ constants but {len(rows)} FruitTreeItems entries")
    out = {}
    for path in maps:
        for i, line in enumerate(repo.lines(path)):
            m = re.match(r"^\s*fruittree (FRUITTREE_\w+)", line)
            item = item_of.get(m.group(1)) if m else None
            if item and item.endswith("_APRICORN"):
                out.setdefault(item[:-len("_APRICORN")], []).append(
                    {"where": humanize(os.path.basename(path)[:-4]),
                     "source": f"{repo.src(path, i + 1, m.group(1))}; {repo.src('data/items/fruit_trees.asm', None, 'FruitTreeItems')}"})
    return out


# --- Emerald and FireRed --------------------------------------------------------------------------------------------
G3_LABEL = r"^([A-Za-z_]\w*):{1,2}"


def gen3(repo, game):
    ways, gaps, notes = {}, [], []
    scripts = repo.files("data/maps/", "/scripts.inc") + repo.files("data/scripts/", ".inc")
    jsons = repo.files("data/maps/", "/map.json")
    items_h = "include/constants/items.h"
    src = ["src/shop.c", "src/safari_zone.c", "src/battle_script_commands.c"]
    src += ["src/data/items.h"] if repo.has("src/data/items.h") else ["src/data/items.json"]
    src += [p for p in ("src/lottery_corner.c", "src/data/lilycove_lady.h", "src/trainer_hill.c", "src/field_specials.c")
            if repo.has(p)]
    repo.load(scripts + jsons + [items_h] + src)
    present = {ball_of(c, BALL_CONST) for c in re.findall(r"\b(ITEM_[A-Z]+_BALL)\b", repo.read(items_h))} - {None}
    price = gen3_prices(repo)
    gen3_marts(repo, game, scripts, ways, price)
    gen3_field(repo, game, jsons, ways, gaps)
    gen3_gifts(repo, game, scripts, ways)
    gen3_other(repo, game, scripts, ways, gaps, notes)
    return present, ways, gaps, notes, None


def gen3_prices(repo):
    if repo.has("src/data/items.h"):
        text = repo.read("src/data/items.h")
        return {m.group(1): int(m.group(2)) for m in re.finditer(r"\[(ITEM_\w+)\]\s*=\s*\{[^}]*?\.price\s*=\s*(\d+)", text, re.S)}
    return {i["itemId"]: i["price"] for i in json.loads(repo.read("src/data/items.json"))["items"]}


def map_of(path):
    """data/maps/Route120/scripts.inc -> Route120; data/scripts/contest_hall.inc -> None."""
    m = re.match(r"data/maps/([^/]+)/", path)
    return m.group(1) if m else None


def place_of_label(label):
    """A shared script's label -> its place: LilycoveCity_ContestLobby_EventScript_X -> Lilycove City Contest Lobby."""
    head = re.split(r"_(?:EventScript|Script|Text|Movement)_", label)[0] if label else ""
    return humanize(head) if head else None


def gen3_condition(lines, i, owner):
    label, at = owner[i]
    conds = []
    ops = {"eq": "==", "ne": "!=", "lt": "<", "le": "<=", "gt": ">", "ge": ">="}
    for line in lines:
        m = re.match(rf"^\s*(goto|call)_if_(set|unset)\s+(\w+),\s*{re.escape(label)}\s*$", line) if label else None
        if m:
            conds.append(f"{m.group(3)} {'set' if m.group(2) == 'set' else 'not set'}")
        m = re.match(rf"^\s*(goto|call)_if_(eq|ne|lt|le|gt|ge)\s+(\w+),\s*(\w+),\s*{re.escape(label)}\s*$", line) if label else None
        if m:
            conds.append(f"{m.group(3)} {ops[m.group(2)]} {m.group(4)}")
    for j in range((at or 0) + 1, i):
        m = re.match(r"^\s*goto_if_(set|unset)\s+(\w+),\s*(\w+)", lines[j])
        if m and m.group(3) != label:
            conds.append(f"{m.group(2)} {'not set' if m.group(1) == 'set' else 'set'}")
    return "; ".join(dict.fromkeys(conds)) or None


def gen3_marts(repo, game, scripts, ways, price):
    for path in scripts:
        lines = repo.lines(path)
        owner = blocks(lines, G3_LABEL)
        lists, cur = {}, None
        for n, line in enumerate(lines, 1):
            m = re.match(G3_LABEL, line)
            if m:
                cur = m.group(1)
            m = re.match(r"^\s*\.2byte (ITEM_\w+)", line)
            if m and cur:
                lists.setdefault(cur, []).append((m.group(1), n))
        for i, line in enumerate(lines):
            m = re.match(r"^\s*pokemart (\w+)\s*$", line)
            if not m:
                continue
            where = humanize(map_of(path)) if map_of(path) else place_of_label(owner[i][0])
            cond = gen3_condition(lines, i, owner)
            for item, n in lists.get(m.group(1), []):
                add(ways, ball_of(item, BALL_CONST), how="shop", where=where, price=price.get(item), requires=None,
                    condition=cond, source=f"{repo.src(path, i + 1, owner[i][0])}; {repo.src(path, n, m.group(1))}")


def gen3_field(repo, game, jsons, ways, gaps):
    path = "data/scripts/item_ball_scripts.inc"
    lines = repo.lines(path)
    balls, cur = {}, None
    for n, line in enumerate(lines, 1):
        m = re.match(G3_LABEL, line)
        cur = m.group(1) if m else cur
        m = re.match(r"^\s*finditem (ITEM_\w+)(?:,\s*(\d+))?(.*)", line)
        if m and cur and ball_of(m.group(1), BALL_CONST):
            balls[cur] = (m.group(1), qty_of(m.group(2)), n, "Unused" in m.group(3))
    placed = {}
    for jp in jsons:
        d = json.loads(repo.read(jp))
        for o in d.get("object_events", []):
            if o.get("script") in balls:
                placed.setdefault(o["script"], []).append((d.get("name") or map_of(jp), jp, o.get("flag")))
        for b in d.get("bg_events", []):
            if b.get("type") == "hidden_item" and ball_of(b.get("item"), BALL_CONST):
                add(ways, ball_of(b["item"], BALL_CONST), how="field", where=humanize(d.get("name") or map_of(jp)),
                    hidden=True, qty=b.get("quantity", 1), source=repo.src(jp, None, b.get("flag")))
    for label, (item, qty, n, unused) in balls.items():
        if label not in placed:
            gaps.append(f"{game}: item ball script {repo.src(path, n, label)} ({item}) isn't used by any map object"
                        + (" (the source marks it Unused)" if unused else ""))
            continue
        for mapname, jp, flag in placed[label]:
            add(ways, ball_of(item, BALL_CONST), how="field", where=humanize(mapname), hidden=False, qty=qty,
                source=f"{repo.src(path, n, label)}; {repo.src(jp, None, flag)}")


def gen3_gifts(repo, game, scripts, ways):
    for path in scripts:
        if path.endswith("item_ball_scripts.inc"):
            continue
        lines = repo.lines(path)
        owner = blocks(lines, G3_LABEL)
        for i, line in enumerate(lines):
            m = (re.match(r"^\s*giveitem (ITEM_\w+)(?:,\s*(\w+))?", line)
                 or re.match(r"^\s*giveitem_msg \w+,\s*(ITEM_\w+)(?:,\s*(\w+))?", line)
                 or re.match(r"^\s*additem (ITEM_\w+)(?:,\s*(\w+))?", line))
            if not m or not ball_of(m.group(1), BALL_CONST):
                continue
            label = owner[i][0]
            where = humanize(map_of(path)) if map_of(path) else place_of_label(label)
            add(ways, ball_of(m.group(1), BALL_CONST), how="gift", where=where, who=label, qty=qty_of(m.group(2)),
                condition=gen3_condition(lines, i, owner) or gen3_jumps_to(lines, label),
                source=repo.src(path, i + 1, label))


def gen3_jumps_to(lines, label):
    """For a shared script: the lines that send the player to this label (switch cases and goto_if tests), raw."""
    hits = [l.strip() for l in lines if label and re.search(rf"\b{re.escape(label)}\s*$", l) and not l.startswith(label)
            and re.match(r"^\s*((goto|call)_if_\w+|case)\b", l)]
    return "; ".join(hits) or None


def gen3_other(repo, game, scripts, ways, gaps, notes):
    shop = repo.lines("src/shop.c")
    bonus = [i for i, l in enumerate(shop) if "ITEM_PREMIER_BALL" in l and "ITEM_POKE_BALL" in l]
    if bonus:
        cond = re.search(r"tItemCount >= (\d+)", shop[bonus[0]])
        add(ways, "premier", how="other", where="any Poké Mart", qty=1,
            note=f"bonus for buying {cond.group(1) if cond else 'enough'}+ Poké Balls at once",
            source=repo.src("src/shop.c", bonus[0] + 1, "Task_ReturnToItemListAfterItemPurchase"))
    else:
        notes.append(f"{game}: src/shop.c has no Premier Ball bonus (no ITEM_PREMIER_BALL anywhere in the shop code); "
                     "buying 10 Poké Balls gives nothing extra.")
    safari = repo.lines("src/safari_zone.c")
    n = next((i for i, l in enumerate(safari) if re.search(r"gNumSafariBalls = [1-9]\d*;", l)), None)
    entry = [(p, i + 1) for p in scripts for i, l in enumerate(repo.lines(p)) if re.match(r"^\s*special EnterSafariMode", l)]
    if n is not None:
        count = int(re.search(r"= (\d+)", safari[n]).group(1))
        for p, at in entry or [(None, None)]:
            add(ways, "safari", how="other", where=humanize(map_of(p)) if p else "Safari Zone", qty=count,
                note="handed out on entering the Safari Zone (EnterSafariMode); the count is a battle counter, not Bag items",
                source=f"{repo.src('src/safari_zone.c', n + 1, 'EnterSafariMode')}" + (f"; {repo.src(p, at)}" if p else ""))
    else:
        gaps.append(f"{game}: couldn't find the Safari Ball count in src/safari_zone.c")
    if repo.has("src/lottery_corner.c"):
        gen3_lottery(repo, game, scripts, ways)
    if repo.has("src/data/lilycove_lady.h"):
        gen3_lilycove_lady(repo, scripts, ways)
    if repo.has("src/trainer_hill.c"):
        gen3_trainer_hill(repo, ways, notes)
    if game == "firered":
        gen3_resort_gorgeous(repo, scripts, ways)
    pickup(repo, game, "src/battle_script_commands.c", r"sPickupItems\[\]\s*=\s*\{(.*?)\};", BALL_CONST, ways)
    if game == "emerald":
        gaps.append("emerald: the Battle Pyramid's own Pickup table (src/battle_pyramid.c, used by Cmd_pickup there) "
                    "wasn't read")
        bsc = repo.lines("src/battle_script_commands.c")
        n = next((i for i, l in enumerate(bsc) if "case ITEM_DIVE_BALL" in l), None)
        mult = re.findall(r"ballMultiplier = (\d+);", " ".join(bsc[n:n + 5])) if n is not None else []
        odds = next((i for i, l in enumerate(bsc) if "catchRate * ballMultiplier / 10" in l), None)
        if n is not None and "MAP_TYPE_UNDERWATER" in " ".join(bsc[n:n + 4]) and len(mult) == 2:
            notes.append(f"emerald: the Dive Ball can be thrown anywhere; its multiplier is {mult[0]} when the map type is "
                         f"MAP_TYPE_UNDERWATER and {mult[1]} elsewhere "
                         f"({repo.src('src/battle_script_commands.c', n + 1, 'Cmd_handleballthrow')})"
                         + (f", and the catch formula divides it by 10 ({repo.src('src/battle_script_commands.c', odds + 1)})"
                            if odds is not None else "") + ".")


def gen3_lottery(repo, game, scripts, ways):
    text = repo.read("src/lottery_corner.c")
    prizes = re.search(r"sLotteryPrizes\[\]\s*=\s*\{(.*?)\};", text, re.S)
    line = text[:prizes.start()].count("\n") + 1 if prizes else None
    rule = re.search(r"gSpecialVar_0x8004 = numMatchingDigits - (\d+);", text)
    pick = re.search(r"sLotteryPrizes\[gSpecialVar_0x8004 - (\d+)\]", text)
    where = [(p, i + 1) for p in scripts for i, l in enumerate(repo.lines(p)) if "special PickLotteryCornerTicket" in l]
    for idx, item in enumerate(re.findall(r"(ITEM_\w+)", prizes.group(1) if prizes else "")):
        if not ball_of(item, BALL_CONST):
            continue
        digits = idx + int(pick.group(1)) + int(rule.group(1)) if rule and pick else None
        for p, at in where:
            add(ways, ball_of(item, BALL_CONST), how="other", where=humanize(map_of(p)), qty=1,
                note=f"Lottery Corner prize: a Pokémon's OT ID matching {digits} digits of the day's number" if digits
                else "Lottery Corner prize",
                source=f"{repo.src('src/lottery_corner.c', line, 'sLotteryPrizes')}; {repo.src(p, at, 'special PickLotteryCornerTicket')}")


def gen3_lilycove_lady(repo, scripts, ways):
    """Emerald's Lilycove Lady: the Quiz Lady's and the Favor Lady's prize tables (src/data/lilycove_lady.h)."""
    path = "src/data/lilycove_lady.h"
    text = repo.read(path)
    at = [p for p in scripts if "LilycoveLady" in repo.read(p) or "QuizLady" in repo.read(p)]
    where = " / ".join(humanize(map_of(p)) for p in at if map_of(p)) or "Lilycove City"
    for name, who in (("sQuizLadyPrizes", "the Quiz Lady"), ("sFavorLadyPrizes", "the Favor Lady")):
        m = re.search(rf"{name}\[\]\s*=\s*\{{(.*?)\}};", text, re.S)
        if not m:
            continue
        line = text[:m.start()].count("\n") + 1
        for item in dict.fromkeys(re.findall(r"(ITEM_\w+)", m.group(1))):
            add(ways, ball_of(item, BALL_CONST), how="other", where=where, qty=1,
                note=f"one of {who}'s prizes",
                source=repo.src(path, line, name))


def gen3_trainer_hill(repo, ways, notes):
    """Emerald's Trainer Hill prizes (src/trainer_hill.c GetPrizeItemId): which slot a time earns, and the lists."""
    path = "src/trainer_hill.c"
    text = repo.read(path)
    lines = text.splitlines()
    lists = {m.group(1): (re.findall(r"(ITEM_\w+)", m.group(2)), text[:m.start()].count("\n") + 1)
             for m in re.finditer(r"static const u16 (sPrizeList\w+)\[\]\s*=\s*\{(.*?)\};", text)}
    start = text.index("static u16 GetPrizeItemId(void)\n{")
    body = text[start:].split("\n}\n", 1)[0]
    base = text[:start].count("\n") + 1
    slots, low = {}, 0
    for m in re.finditer(r"(?:if|else if) \(minutes < (\d+)\)\s*\n\s*id = (\d+);|else\s*\n\s*id = (\d+);", body):
        if m.group(3):
            slots[int(m.group(3))] = f"{low}+ minutes"
        else:
            slots[int(m.group(2))] = f"under {m.group(1)} minutes" if low == 0 else f"{low} to {m.group(1)} minutes"
            low = int(m.group(1))
    sets = [re.findall(r"(sPrizeList\w+)", m.group(1)) for m in
            re.finditer(r"static const u16 \*const sPrizeLists\d\[\w+\]\s*=\s*\{(.*?)\};", text, re.S)]
    reach = {(int(a), int(b)) for a, b in re.findall(r"//\s*sPrizeListSets\[(\d)\]\[(\d)\]", body)}
    reach_names = {sets[a][b] for a, b in reach if a < len(sets) and b < len(sets[a])}
    done = set()
    for name, (items, line) in lists.items():
        for slot, item in enumerate(items):
            ball = ball_of(item, BALL_CONST)
            if not ball or (ball, slot, slot == 0 and name) in done:
                continue
            if slot == 0 and reach and name not in reach_names:
                notes.append(f"emerald: {name} ({repo.src(path, line)}) has the {item} as its grand prize, but the "
                             f"source's own notes in GetPrizeItemId ({repo.src(path, base)}) list only "
                             f"{', '.join(sorted(reach_names))} as reachable, so it isn't listed as a way")
                continue
            done.add((ball, slot, slot == 0 and name))
            every = all(len(v[0]) > slot and v[0][slot] == item for v in lists.values())
            add(ways, ball, how="other", where="Trainer Hill", qty=1,
                note=f"Trainer Hill prize for a challenge time of {slots.get(slot, f'slot {slot}')}"
                     + ("" if slot else f" ({name})") + (" (the same in every prize list)" if slot and every else ""),
                source=f"{repo.src(path, line, name)}; {repo.src(path, base, 'GetPrizeItemId')}")


def gen3_resort_gorgeous(repo, scripts, ways):
    """FireRed's Resort Gorgeous reward (src/field_specials.c SampleResortGorgeousReward)."""
    path = "src/field_specials.c"
    lines = repo.lines(path)
    for i, line in enumerate(lines):
        m = re.search(r"return (ITEM_\w+);", line)
        if m and ball_of(m.group(1), BALL_CONST) and "SampleResortGorgeousReward" in "\n".join(lines[max(0, i - 6):i]):
            cond = re.search(r"\(Random\(\) % (\d+)\) >= (\d+)", lines[i - 1])
            share = f"{int(cond.group(1)) - int(cond.group(2))} in {cond.group(1)}" if cond else "some"
            at = [(p, k + 1) for p in scripts for k, l in enumerate(repo.lines(p)) if "special SampleResortGorgeousMonAndReward" in l]
            where = " / ".join(dict.fromkeys(humanize(map_of(p)) for p, _ in at)) or "Resort Gorgeous"
            add(ways, ball_of(m.group(1), BALL_CONST), how="other", where=where, qty=1,
                note=f"reward for showing the requested Pokémon; {share} requests carry this ball (SampleResortGorgeousReward)",
                source="; ".join([repo.src(path, i + 1, "SampleResortGorgeousReward")] + [repo.src(p, k) for p, k in at]))


def pickup(repo, game, path, pattern, table, ways, extra=""):
    """The Pickup ability's item table: which balls a Pokémon with Pickup can find after battle."""
    text = repo.read(path)
    m = re.search(pattern, text, re.S)
    if not m:
        return
    line = text[:m.start()].count("\n") + 1
    for item in dict.fromkeys(re.findall(r"(ITEM_\w+)", m.group(1))):
        add(ways, ball_of(item, table), how="other", where="Pickup (a party Pokémon with the ability, after battle)",
            note="in the Pickup table; which entries can come up depends on the Pokémon's level" + extra,
            source=repo.src(path, line, m.group(0).split("[")[0].split()[-1]))


# --- Platinum -------------------------------------------------------------------------------------------------------
PT_LABEL = r"^([A-Za-z_]\w*):\s*$"


def platinum(repo):
    ways, gaps, notes = {}, [], []
    scripts = repo.files("res/field/scripts/", ".s")
    events = repo.files("res/field/events/", ".json")
    data = ["generated/items.txt", "include/data/mart_items.h", "src/scrcmd_shop.c", "include/data/map_headers.h",
            "include/data/field/hidden_items.h", "include/script_manager.h", "src/overlay007/shop_menu.c",
            "src/scrcmd.c", "include/data/pickup.h", "src/catching_show.c", "include/constants/pokemon.h",
            "src/battle/battle_controller_player.c", "src/battle/battle_lib.c"]
    repo.load(scripts + events + data + repo.files("res/items/data/", ".json"))
    items = repo.read("generated/items.txt").split()
    present = {ball_of(c, BALL_CONST_GEN4) for c in items} - {None}
    if "ITEM_PARK_BALL" not in items:
        notes.append(platinum_park_note(repo))
    headers = platinum_headers(repo)
    headers["unused"] = platinum_unused_entries(repo, scripts, headers)
    platinum_drop_unused_maps(repo, scripts, events, headers, gaps)
    price = {f"ITEM_{os.path.basename(p)[:-5].upper()}": json.loads(repo.read(p)).get("price")
             for p in repo.files("res/items/data/", ".json")}
    platinum_marts(repo, scripts, headers, ways, gaps, price)
    platinum_items(repo, events, headers, ways, gaps)
    platinum_gifts(repo, scripts, headers, ways, gaps)
    platinum_other(repo, scripts, headers, ways)
    for s in scripts:
        if s not in headers["scripts"] and os.path.basename(s) not in ("scripts_visible_items.s", "scripts_hidden_items.s"):
            text = repo.read(s)
            if re.search(r"ITEM_\w+_BALL|PokeMart", text):
                why = (f"its only map header ({', '.join(headers['dropped'][s])}) is named unused and no warp or script "
                       "leads there" if s in headers["dropped"] else "no map header uses it")
                gaps.append(f"platinum: {repo.src(s)} has ball or mart lines but {why}; skipped")
    return present, ways, gaps, notes, None


def platinum_park_note(repo):
    ctl = repo.lines("src/battle/battle_controller_player.c")
    lib = repo.lines("src/battle/battle_lib.c")
    a = next((i + 1 for i, l in enumerate(ctl) if "PLAYER_INPUT_PAL_PARK_BALL" in l), None)
    b = next((i + 1 for i, l in enumerate(lib) if "BATTLE_TYPE_PAL_PARK" in l and "if" in l
              and "MON_DATA_POKEBALL" in lib[i + 1]), None)
    keeps = (" and a Pokémon caught there keeps the ball it already had (MON_DATA_POKEBALL, "
             f"{repo.src('src/battle/battle_lib.c', b)})") if b else ""
    return ("platinum: no Park Ball item. generated/items.txt has no ITEM_PARK_BALL; the Pal Park's ball button runs the "
            f"Safari throw ({repo.src('src/battle/battle_controller_player.c', a, 'PLAYER_INPUT_PAL_PARK_BALL')}){keeps}.")


def platinum_headers(repo):
    """Which map header(s) use each script file and event file (include/data/map_headers.h)."""
    out = {"scripts": {}, "events": {}}
    for m in re.finditer(r"\[(MAP_HEADER_\w+)\]\s*=\s*\{(.*?)\n\s*\},", repo.read("include/data/map_headers.h"), re.S):
        s = re.search(r"\.scriptsArchiveID = (scripts_\w+)", m.group(2))
        e = re.search(r"\.eventsArchiveID = (events_\w+)", m.group(2))
        if s:
            out["scripts"].setdefault(f"res/field/scripts/{s.group(1)}.s", []).append(m.group(1))
        if e:
            out["events"].setdefault(f"res/field/events/{e.group(1)}.json", []).append(m.group(1))
    return out


def platinum_drop_unused_maps(repo, scripts, events, headers, gaps):
    """Leave out maps the decomp names UNUSED that no warp event and no script sends the player to."""
    into = set()
    for ev in events:
        into |= {w.get("dest_header_id") for w in json.loads(repo.read(ev)).get("warp_events", [])}
    for path in scripts:
        into |= set(re.findall(r"\b(MAP_HEADER_\w+)", repo.read(path)))
    headers["dropped"] = {}
    for kind in ("scripts", "events"):
        for path, names in list(headers[kind].items()):
            keep = [n for n in names if "UNUSED" not in n or n in into]
            if kind == "scripts" and len(keep) < len(names):
                headers["dropped"][path] = sorted(set(names) - set(keep))
            if keep:
                headers[kind][path] = keep
            else:
                del headers[kind][path]


def platinum_unused_entries(repo, scripts, headers):
    """Script entries (1-based ScriptEntry index) that no event of the map and no init script refers to."""
    hdr = repo.read("include/data/map_headers.h")
    init = {}
    for m in re.finditer(r"\.scriptsArchiveID = (scripts_\w+),\s*\n\s*\.initScriptsArchiveID = (scripts_init_\w+)", hdr):
        init.setdefault(f"res/field/scripts/{m.group(1)}.s", []).append(f"res/field/scripts/{m.group(2)}.s")
    out = {}
    for path in scripts:
        names = headers["scripts"].get(path)
        if not names:
            continue
        used = set()
        for ev, hs in headers["events"].items():
            if set(hs) & set(names) and repo.has(ev):
                d = json.loads(repo.read(ev))
                for k in ("object_events", "bg_events", "coord_events"):
                    used |= {o.get("script") for o in d.get(k, []) if isinstance(o.get("script"), int)}
        for ip in init.get(path, []):
            if repo.has(ip):
                used |= {int(n) for l in repo.lines(ip) if l.strip().startswith("InitScript") for n in re.findall(r"\b(\d+)\b", l)}
        entries = re.findall(r"^\s*ScriptEntry (\w+)", repo.read(path), re.M)
        out[path] = {e for k, e in enumerate(entries, 1) if k not in used}
    return out


def pt_skip(repo, headers, path, label, line, gaps):
    """True (and a gap) when the way sits directly in a script entry nothing runs."""
    if label in headers["unused"].get(path, set()):
        gaps.append(f"platinum: {repo.src(path, line, label)} is a script entry that no event or init script of the map "
                    "runs; skipped")
        return True
    return False


def pt_where(headers, kind, path):
    names = headers[kind].get(path)
    return " / ".join(humanize(n) for n in names) if names else None


def platinum_tiers(repo, path, func):
    """The badge-count -> tier switch in a mart function: {badges: tier} for 0-8."""
    body = repo.read(path).split(func, 1)[1]
    body = body[body.index("switch ("):]
    body = body[:body.index("\n    }\n")]
    tier, pending, default = {}, [], None
    for line in body.splitlines():
        m = re.match(r"\s*case (\d+):", line)
        if m:
            pending.append(int(m.group(1)))
        if re.match(r"\s*default:", line):
            pending.append("default")
        m = re.match(r"\s*\w+ = (\d+);", line)
        if m and pending:
            for p in pending:
                if p == "default":
                    default = int(m.group(1))
                else:
                    tier[p] = int(m.group(1))
            pending = []
    return {b: tier.get(b, default) for b in range(9)}


def min_badges(tiers, need):
    ok = [b for b, t in tiers.items() if t is not None and t >= need]
    return min(ok) if ok else None


def platinum_marts(repo, scripts, headers, ways, gaps, price):
    hdr = "include/data/mart_items.h"
    text = repo.read(hdr)
    tiers = platinum_tiers(repo, "src/scrcmd_shop.c", "BOOL ScrCmd_PokeMartCommon(")
    tier_line = next((k for k, l in enumerate(repo.lines("src/scrcmd_shop.c"), 1) if l.startswith("BOOL ScrCmd_PokeMartCommon(")), None)
    base = text.index("PokeMartCommonItems[]")
    common = [(m.group(1), int(m.group(2), 0), text[:base].count("\n") + 1)
              for m in re.finditer(r"\{ (ITEM_\w+), (0x[0-9A-Fa-f]+|\d+) \}", text[base:].split("};", 1)[0])]
    arrays = {}
    for m in re.finditer(r"const u16 (\w+)\[\] = \{(.*?)\};", text, re.S):
        arrays[m.group(1)] = (re.findall(r"(ITEM_\w+)", m.group(2)), text[:m.start()].count("\n") + 1)
    ids = dict(re.findall(r"\[(MART_SPECIALTIES_ID_\w+)\] = (\w+),?", text))
    for path in scripts:
        where = pt_where(headers, "scripts", path)
        if not where:
            continue
        lines = repo.lines(path)
        owner = blocks(lines, PT_LABEL)
        for i, line in enumerate(lines):
            if re.match(r"^\s*PokeMart", line) and pt_skip(repo, headers, path, owner[i][0], i + 1, gaps):
                continue
            if re.match(r"^\s*PokeMartCommon(WithGreeting)?\b", line):
                for item, need, n in common:
                    b = min_badges(tiers, need)
                    if b is None and ball_of(item, BALL_CONST_GEN4):
                        gaps.append(f"platinum: {item} needs mart tier {need}, which no badge count reaches; not listed")
                        continue
                    add(ways, ball_of(item, BALL_CONST_GEN4), how="shop", where=where, price=price.get(item),
                        requires=f"{b} badges", source=f"{repo.src(path, i + 1, owner[i][0])}; "
                        f"{repo.src(hdr, n, 'PokeMartCommonItems')}; {repo.src('src/scrcmd_shop.c', tier_line, 'ScrCmd_PokeMartCommon')}")
            m = re.match(r"^\s*PokeMartSpecialties(?:WithGreeting)?\s+(MART_SPECIALTIES_ID_\w+)", line)
            if m:
                name = ids.get(m.group(1))
                if name not in arrays:
                    gaps.append(f"platinum: {repo.src(path, i + 1)} opens {m.group(1)} with no array in {hdr}")
                    continue
                for item in arrays[name][0]:
                    add(ways, ball_of(item, BALL_CONST_GEN4), how="shop", where=where, price=price.get(item), requires=None,
                        source=f"{repo.src(path, i + 1, owner[i][0])}; {repo.src(hdr, arrays[name][1], name)}")


def platinum_items(repo, events, headers, ways, gaps):
    """Visible item balls (scripts_visible_items.s) and hidden items (hidden_items.h), placed through the event files."""
    sm = repo.read("include/script_manager.h")
    vis_base = int(re.search(r"SCRIPT_ID_OFFSET_VISIBLE_ITEMS\s+(\d+)", sm).group(1))
    hid_base = int(re.search(r"SCRIPT_ID_OFFSET_HIDDEN_ITEMS\s+(\d+)", sm).group(1))
    placed_v, placed_h = {}, {}
    for ev in events:
        d = json.loads(repo.read(ev))
        for o in d.get("object_events", []):
            s = o.get("script")
            if isinstance(s, int) and vis_base <= s < hid_base:
                placed_v.setdefault(s - vis_base, []).append(ev)
        for b in d.get("bg_events", []):
            s = b.get("script")
            if isinstance(s, int) and hid_base <= s < hid_base + 1000:
                placed_h.setdefault(s - hid_base, []).append(ev)
    path = "res/field/scripts/scripts_visible_items.s"
    lines = repo.lines(path)
    entries = [re.match(r"^\s*ScriptEntry (\w+)", l).group(1) for l in lines if re.match(r"^\s*ScriptEntry \w+", l)]
    at = {re.match(PT_LABEL, l).group(1): i for i, l in enumerate(lines) if re.match(PT_LABEL, l)}
    for idx, label in enumerate(entries):
        i = at.get(label)
        if i is None:
            continue
        body = "\n".join(lines[i:i + 4])
        item = re.search(r"SetVar VAR_0x8008, (ITEM_\w+)", body)
        qty = re.search(r"SetVar VAR_0x8009, (\d+)", body)
        ball = ball_of(item.group(1), BALL_CONST_GEN4) if item else None
        if not ball:
            continue
        if idx not in placed_v:
            gaps.append(f"platinum: visible item {repo.src(path, i + 1, label)} isn't placed by any event file "
                        f"(script {vis_base + idx})")
            continue
        for ev in placed_v[idx]:
            add(ways, ball, how="field", where=pt_where(headers, "events", ev) or humanize(os.path.basename(ev)[:-5]),
                hidden=False, qty=int(qty.group(1)) if qty else 1,
                source=f"{repo.src(path, i + 1, label)}; {repo.src(ev, None, f'object script {vis_base + idx}')}")
    hpath = "include/data/field/hidden_items.h"
    hl = repo.lines(hpath)
    idx = -1
    for n, line in enumerate(hl, 1):
        m = re.match(r"^\s*HIDDEN_ITEM_ENTRY\((ITEM_\w+),\s*(\d+),\s*(\d+),\s*(\w+)\)", line)
        if not m:
            continue
        idx += 1
        ball = ball_of(m.group(1), BALL_CONST_GEN4)
        if not ball:
            continue
        if idx not in placed_h:
            gaps.append(f"platinum: hidden item {repo.src(hpath, n, m.group(4))} isn't placed by any event file")
            continue
        for ev in placed_h[idx]:
            add(ways, ball, how="field", where=pt_where(headers, "events", ev) or humanize(os.path.basename(ev)[:-5]),
                hidden=True, qty=int(m.group(2)),
                source=f"{repo.src(hpath, n, m.group(4))}; {repo.src(ev, None, f'bg script {hid_base + idx}')}")


def pt_condition(lines, label):
    """The tests that jump or call into this label: GoToIfEq VAR_X, 2, Label -> 'VAR_X == 2'."""
    ops = {"Eq": "==", "Ne": "!=", "Lt": "<", "Le": "<=", "Gt": ">", "Ge": ">="}
    hits = []
    for line in lines:
        m = re.match(rf"^\s*(?:GoTo|Call)If(\w+)\s+(.*?),\s*{re.escape(label)}\s*$", line) if label else None
        if not m:
            continue
        args = [a.strip() for a in m.group(2).split(",")]
        if m.group(1) in ops and len(args) == 2:
            hits.append(f"{args[0]} {ops[m.group(1)]} {args[1]}")
        elif m.group(1) in ("Set", "Unset") and len(args) == 1:
            hits.append(f"{args[0]} {'set' if m.group(1) == 'Set' else 'not set'}")
        else:
            hits.append(line.strip())
    return "; ".join(dict.fromkeys(hits)) or None


def platinum_gifts(repo, scripts, headers, ways, gaps):
    for path in scripts:
        where = pt_where(headers, "scripts", path)
        if not where or os.path.basename(path) in ("scripts_visible_items.s", "scripts_hidden_items.s"):
            continue
        lines = repo.lines(path)
        owner = blocks(lines, PT_LABEL)
        for i, line in enumerate(lines):
            m = re.match(r"^\s*SetVar VAR_0x800([34]), (ITEM_\w+)", line)
            ball = ball_of(m.group(2), BALL_CONST_GEN4) if m else None
            if not ball:
                continue
            label = owner[i][0]
            if pt_skip(repo, headers, path, label, i + 1, gaps):
                continue
            qty = pt_qty(lines, i, owner, label)
            if m.group(1) == "3":                               # Jubilife TV's lottery: the prize goes through VAR_0x8003
                add(ways, ball, how="other", where=where, qty=qty,
                    note=f"lottery prize ({label}, chosen when {pt_condition(lines, label)})",
                    source=repo.src(path, i + 1, label))
                continue
            add(ways, ball, how="gift", where=where, who=label, qty=qty, condition=pt_condition(lines, label),
                source=repo.src(path, i + 1, label))


def pt_qty(lines, i, owner, label):
    """The quantity (VAR_0x8005 or VAR_0x8009) set with the item: in the same block, or after the Call that ran it."""
    for j in range(i + 1, min(i + 4, len(lines))):
        m = re.match(r"^\s*SetVar VAR_0x800[59], (\d+)", lines[j])
        if m:
            return int(m.group(1))
        if re.match(r"^\s*(Return|End)\b", lines[j]):
            break
    for k, line in enumerate(lines):
        if label and re.search(rf"\bCall\w*\s+(.*,\s*)?{re.escape(label)}\s*$", line):
            for j in range(k + 1, min(k + 20, len(lines))):
                m = re.match(r"^\s*SetVar VAR_0x8005, (\d+)", lines[j])
                if m:
                    return int(m.group(1))
                if re.match(r"^\s*(End|Return)\b", lines[j]):
                    break
    return None


def platinum_other(repo, scripts, headers, ways):
    shop = repo.lines("src/overlay007/shop_menu.c")
    n = next((i for i, l in enumerate(shop) if "ITEM_POKE_BALL" in l and "itemAmount >=" in l), None)
    if n is not None and any("ITEM_PREMIER_BALL" in l for l in shop[n:n + 3]):
        need = re.search(r"itemAmount >= (\d+)", shop[n]).group(1)
        add(ways, "premier", how="other", where="any Poké Mart (normal or Battle Frontier type)", qty=1,
            note=f"bonus for buying {need}+ Poké Balls at once", source=repo.src("src/overlay007/shop_menu.c", n + 1))
    cmd = repo.lines("src/scrcmd.c")
    n = next((i for i, l in enumerate(cmd) if re.search(r"\*safariBallCount = [1-9]\d*;", l)), None)
    for path in scripts:
        where = pt_where(headers, "scripts", path)
        if not where:
            continue
        lines = repo.lines(path)
        for i, line in enumerate(lines):
            if re.match(r"^\s*StartSafariGame\b", line) and n is not None:
                fee = next((re.search(r"RemoveMoney (\d+)", l).group(1) for l in reversed(lines[max(0, i - 40):i])
                            if re.search(r"RemoveMoney \d+", l)), None)
                add(ways, "safari", how="other", where=where, qty=int(re.search(r"= (\d+)", cmd[n]).group(1)),
                    note="handed out when the Great Marsh Safari Game starts (ScrCmd_StartEndSafariGame)"
                         + (f"; the game costs {fee} (RemoveMoney {fee})" if fee else ""),
                    source=f"{repo.src(path, i + 1, 'StartSafariGame')}; {repo.src('src/scrcmd.c', n + 1, 'ScrCmd_StartEndSafariGame')}")
    pickup(repo, "platinum", "include/data/pickup.h", r"sCommonPickupItems\[\]\s*=\s*\{(.*?)\};", BALL_CONST_GEN4, ways)


# --- HeartGold / SoulSilver -----------------------------------------------------------------------------------------
HG_LABEL = r"^([A-Za-z_]\w*):\s*$"
HG_GIVE_STD = ("std_give_item_verbose", "std_obtain_item_verbose")


class HG:
    def __init__(self, repo):
        self.repo = repo
        self.scripts = repo.files("files/fielddata/script/scr_seq/", ".s")
        self.zones = repo.files("files/fielddata/eventdata/zone_event/", ".json")
        self.data = ["include/constants/items.h", "include/constants/maps.h", "include/constants/std_script.h",
                     "include/constants/apricorns.h", "include/constants/pokemon.h", "src/scrcmd_mart.c",
                     "src/script_manager.c", "src/data/fieldmap/hidden_items.h", "src/apricorn_tree_sys.c",
                     "asm/unk_02031B0C.s", "files/itemtool/itemdata/item_data.csv", "src/overlay_03/shop_menu.c",
                     "src/overlay_bug_contest.c", "src/scrcmd_c.c", "src/catching_show.c",
                     "src/battle/battle_controller_player.c", "asm/overlay_12_battle_command.s",
                     "src/application/pokegear/phone/phone_script_defs.c",
                     "src/application/pokegear/phone/overlay_101_021F1D74.c", "src/sys_flags.c"]
        repo.load(self.scripts + self.zones + self.data)
        self.items = self._items()
        self.map_name = {code: name for name, code in re.findall(r"#define (MAP_\w+)\s+\d+\s*//\s*MAP_(\w+)",
                                                                  repo.read("include/constants/maps.h"))}
        self.std = {k: int(v) for k, v in re.findall(r"#define (_?std_\w+)\s+(\d+)", repo.read("include/constants/std_script.h"))}
        self.price = {}
        for row in repo.read("files/itemtool/itemdata/item_data.csv").splitlines()[1:]:
            cells = row.split(",")
            if len(cells) > 1 and cells[1].isdigit():
                self.price[cells[0]] = int(cells[1])
        self.unresolved, self.resolved = [], set()

    def _items(self):
        """items.h numbers -> ITEM_ names, from the item list only (later #defines reuse small numbers)."""
        text = self.repo.read("include/constants/items.h")
        body = text[text.index("#define ITEM_NONE 0"):]
        out = {}
        for name, num in re.findall(r"#define (ITEM_\w+)\s+(\d+)\b", body):
            if name in ("ITEM_MIN",) or name.startswith("ITEM_VAR_") or int(num) in out:
                continue
            out[int(num)] = name
        return out

    def item(self, value):
        value = (value or "").strip()
        if value.isdigit():
            return self.items.get(int(value))
        return value if value.startswith("ITEM_") else None

    def code_of(self, path):
        m = re.match(r"(?:scr_seq_\d+|\d+)_([A-Z0-9]+)(?:_hdr)?\.(?:s|json)$", os.path.basename(path))
        return m.group(1) if m else None

    def where(self, path):
        code = self.code_of(path)
        if code:
            return humanize(self.map_name[code]) if code in self.map_name else f"map {code} (no name in maps.h)"
        bank = self.bank_of(path)
        return f"shared script {os.path.basename(path)[:-2]}" + (f" ({bank})" if bank else "")

    def bank_of(self, path):
        num = re.match(r"scr_seq_(\d+)", os.path.basename(path)).group(1)
        m = re.search(rf"\{{\s*(\w+),\s*scr_seq_{num}_bin", self.repo.read("src/script_manager.c"))
        return m.group(1) if m else None


def heartgold(repo):
    hg = HG(repo)
    ways, gaps, notes = {}, [], []
    present = {ball_of(n, BALL_CONST_GEN4) for n in hg.items.values()} - {None}
    hg_marts_and_gifts(hg, ways, gaps)
    hg_field(hg, ways, gaps)
    hg_phone(hg, ways, gaps)
    hg_other(hg, ways, gaps, notes)
    trees = hg_kurt(hg, ways, gaps)
    left = {}
    for where, var in hg.unresolved:
        if where not in hg.resolved:
            left.setdefault(where, set()).add(var)
    if left:
        gaps.append(f"heartgold: {len(left)} item-giving script lines (files/fielddata/script/scr_seq/) get the item from "
                    "a variable filled elsewhere (C code, a menu, a calling script), so the scripts alone don't say which "
                    "item; none of them was counted: " + ", ".join(f"{w} ({'/'.join(sorted(v))})" for w, v in sorted(left.items())))
    gaps.append("heartgold: the scratch-off card prizes (scr_seq_0263 GetScratchOffPrize; filled by overlay_87, which is "
                "not decompiled to named items) and the Pokéwalker weren't read")
    hg_versions(hg, ways, notes)
    return present, ways, gaps, notes, trees


def hg_marts(hg):
    text = hg.repo.read("src/scrcmd_mart.c")
    tiers = platinum_tiers(hg.repo, "src/scrcmd_mart.c", "BOOL ScrCmd_MartBuy(")
    base = text.index("_020FBF22[]")
    line = text[:base].count("\n") + 1
    common = [(m.group(1), int(m.group(2))) for m in
              re.finditer(r"\{ (ITEM_\w+),\s*(\d+) \}", text[base:].split("};", 1)[0])]
    arrays = {m.group(1): (re.findall(r"(ITEM_\w+)", m.group(2)), text[:m.start()].count("\n") + 1)
              for m in re.finditer(r"const u16 (_\w+)\[\] = \{(.*?)\};", text, re.S)}
    table = re.search(r"const u16 \*_0210FA3C\[\] = \{(.*?)\};", text, re.S)
    special = re.findall(r"(_\w+),", table.group(1))
    return tiers, common, line, arrays, special, text[:table.start()].count("\n") + 1


def hg_marts_and_gifts(hg, ways, gaps):
    marts = hg_marts(hg)
    jumps = []                                                  # (target label, state, path) to follow one level
    for path in hg.scripts:
        lines = hg.repo.lines(path)
        state = {}
        for i, line in enumerate(lines):
            if re.match(HG_LABEL, line) and hg_after_end(lines, i):
                state = {}
            hg_step(hg, path, lines, i, line, state, ways, jumps, marts, gaps)
    labels = {}
    for path in hg.scripts:
        for i, line in enumerate(hg.repo.lines(path)):
            m = re.match(HG_LABEL, line)
            if m:
                labels[(path, m.group(1))] = i
    for target, state, path in jumps:
        i = labels.get((path, target))
        if i is None:
            continue
        lines = hg.repo.lines(path)
        st = dict(state)
        for j in range(i + 1, len(lines)):
            if re.match(HG_LABEL, lines[j]) or re.match(r"^\s*(End|Return)\b", lines[j]):
                break
            if hg_step(hg, path, lines, j, lines[j], st, ways, None, None, gaps) == "gave":
                break


def hg_after_end(lines, i):
    """True when the code before this label can't fall through into it (the last real line ends or jumps)."""
    for j in range(i - 1, -1, -1):
        t = lines[j].strip()
        if t and not t.startswith(".") and not t.startswith("//"):
            return bool(re.match(r"(End|Return|GoTo \w+)$", t))
    return True


HG_READS_X8004 = {"HasSpaceForItem", "GiveItem", "GetItemPocket", "BufferItemName", "BufferItemNamePlural",
                  "BufferItemNameIndef", "Compare", "TakeItem", "BufferBackgroundName", "ItemIsTMOrHM"}


def hg_step(hg, path, lines, i, line, state, ways, jumps, marts, gaps):
    """One script line: track what VAR_SPECIAL_x8004/x8005 hold, and record a gift or a mart when one happens."""
    s = line.strip()
    m = re.match(r"(SetVar|CopyVar) (VAR_SPECIAL_x80[0-9A-F]{2}), (\w+)$", s)
    if m:
        value = state.get(m.group(3), (m.group(3), i + 1))     # a copy of another tracked variable keeps its origin
        state[m.group(2)] = value if m.group(1) == "CopyVar" else (m.group(3), i + 1)
        if m.group(2) in ("VAR_SPECIAL_x8004", "VAR_SPECIAL_x8005"):
            state["item" if m.group(2).endswith("4") else "qty"] = state[m.group(2)]
        return None
    m = re.match(r"(ItemVars|GoToIfNoItemSpace2?) (\w+), (\w+)", s)
    if m:
        state["item"] = state.get(m.group(2), (m.group(2), i + 1))
        state["qty"] = state.get(m.group(3), (m.group(3), i + 1))
        return None
    m = re.match(r"GiveItemNoCheck (\w+), (\w+)", s)
    if m:
        hg_gift(hg, path, lines, i, m.group(1), m.group(2), i + 1, ways)
        return "gave"
    m = re.match(r"GiveItem (\w+), (\w+), \w+", s)
    if m:
        item = state.get("item", (None,))[0] if m.group(1) == "VAR_SPECIAL_x8004" else m.group(1)
        qty = state.get("qty", (None,))[0] if m.group(2) == "VAR_SPECIAL_x8005" else m.group(2)
        hg_gift(hg, path, lines, i, item, qty, state.get("item", (None, i + 1))[1], ways)
        return "gave"
    m = re.match(r"CallStd (\w+)$", s)
    if m and m.group(1) in HG_GIVE_STD:
        item, at = state.get("item", (None, i + 1))
        hg_gift(hg, path, lines, i, item, state.get("qty", (None,))[0], at, ways)
        return "gave"
    if m and marts and m.group(1) in ("std_pokemart", "std_special_mart"):
        hg_mart(hg, path, i, m.group(1), state, ways, marts, gaps)
        return None
    m = re.match(r"(\w+) VAR_SPECIAL_x8004\b", s)
    if m and m.group(1) not in HG_READS_X8004:
        state["item"] = (f"@{m.group(1)}", i + 1)            # written by another command (e.g. Kurt's ScrCmd_737)
        return None
    m = re.match(r"(GoTo|Call)\w* (?:.*, )?(\w+)$", s) or re.match(r"Case \w+, (\w+)$", s)
    if m and jumps is not None and any(k.startswith("VAR_SPECIAL_x80") or k == "item" for k in state):
        jumps.append((m.groups()[-1], dict(state), path))
    return None


def hg_entry(lines, at):
    """The script entry (ScrDef scr_seq_<map>_NNN) a line belongs to, and its line index."""
    for j in range(at, -1, -1):
        m = re.match(r"^(scr_seq_\w+_\d{3}):", lines[j])
        if m:
            return m.group(1), j
    return None, 0


def hg_conditions(lines, at):
    """The raw tests that lead to line `at`: Compare/GoToIf pairs in its block, the jumps and menu cases that enter the
    block, and where each tested variable was last written (GetWeekday, Random, ...)."""
    owner = blocks(lines, HG_LABEL)
    label, top = owner[at]
    neg = {"Ne": "==", "Eq": "!=", "Lt": ">=", "Ge": "<", "Gt": "<=", "Le": ">"}
    pos = {"Ne": "!=", "Eq": "==", "Lt": "<", "Ge": ">=", "Gt": ">", "Le": "<="}
    conds = []
    entries_conditional = label is not None and hg_after_end(lines, top) and not any(
        re.match(rf"^\s*(GoTo|Call) {re.escape(label)}$", l) for l in lines)
    for j in range((top or 0) + 1, at):
        c = re.match(r"^\s*Compare (\w+), (\w+)", lines[j])
        g = re.match(r"^\s*GoToIf(\w+) \w+$", lines[j + 1]) if c and j + 1 < at else None
        if g and g.group(1) in neg:
            conds.append((c.group(1), f"{c.group(1)} {neg[g.group(1)]} {c.group(2)}", j))
    for j, line in enumerate(lines if entries_conditional else []):
        g = re.match(rf"^\s*GoToIf(\w+) {re.escape(label)}$", line) if label else None
        if g and j and g.group(1) in pos:
            c = re.match(r"^\s*Compare (\w+), (\w+)", lines[j - 1])
            if c:
                conds.append((c.group(1), f"{c.group(1)} {pos[g.group(1)]} {c.group(2)}", j))
        k = re.match(rf"^\s*Case (\w+), {re.escape(label)}$", line) if label else None
        if k:
            sw = next((re.match(r"^\s*Switch (\w+)", lines[x]).group(1) for x in range(j, -1, -1)
                       if re.match(r"^\s*Switch \w+", lines[x])), "?")
            conds.append((sw, f"{sw} == {k.group(1)}", j))
    out = []
    for var, text, j in conds:
        src = next((lines[x].strip() for x in range(j, -1, -1)
                    if re.match(rf"^\s*(?!Compare|SetVar|CopyVar|AddVar|Switch|GoTo|Call|BufferInt)\w+ {re.escape(var)}\b", lines[x])), None)
        out.append(text + (f" ({src})" if src else ""))
    return "; ".join(dict.fromkeys(out)) or None


def hg_gift(hg, path, lines, i, item_value, qty, at, ways):
    if (item_value or "").startswith("@ScrCmd_737"):
        return                                                  # Kurt's Apricorn ball: hg_kurt records it as craft
    item = hg.item(item_value)
    if item is None:
        hg.unresolved.append((f"{os.path.basename(path)}:{i + 1}", item_value or "unset"))
        return
    hg.resolved.add(f"{os.path.basename(path)}:{i + 1}")
    ball = ball_of(item, BALL_CONST_GEN4)
    if not ball:
        return
    owner = blocks(lines, HG_LABEL)
    entry, top = hg_entry(lines, at - 1)
    src = hg.repo.src(path, at, owner[at - 1][0])
    if at != i + 1:
        src += f"; {hg.repo.src(path, i + 1, owner[i][0])}"
    flow = lines[top:max(at, i + 1)]
    cost = next((re.match(r"^\s*SubMoneyImmediate (\d+)", l).group(1) for l in flow if re.match(r"^\s*SubMoneyImmediate \d+", l)), None)
    way = {"how": "other" if cost else "gift", "where": hg.where(path), "who": entry or owner[at - 1][0]}
    qty = str(qty) if qty is not None else ""
    way["qty"] = int(qty) if qty.isdigit() else None
    if qty and not qty.isdigit():
        way["qty_from"] = qty
    way["condition"] = hg_conditions(lines, at - 1)
    if cost:
        way["note"] = f"a paid draw: {entry} charges {cost} (SubMoneyImmediate {cost}) before the prize is picked"
    if any("GetGameVersion" in l for l in flow):
        way["version_check"] = f"{entry} checks GetGameVersion before this; HeartGold and SoulSilver may differ"
    way["source"] = src
    add(ways, ball, **way)


def hg_ball_unlock(hg):
    """Marts drop the Poké Ball from their list until a flag is set (src/overlay_03/shop_menu.c + src/sys_flags.c)."""
    shop = hg.repo.lines("src/overlay_03/shop_menu.c")
    n = next((k for k, l in enumerate(shop) if "unlockedPokeBallsInMarts == FALSE" in l), None)
    flags = re.search(r"BOOL CheckUnlockedPokeBallsInMarts\(.*?\)\s*\{\s*return CheckScriptFlag\(state, (\w+)\);",
                      hg.repo.read("src/sys_flags.c"), re.S)
    if n is None or not flags or "ITEM_POKE_BALL" not in shop[n + 1]:
        return None
    return (f"not listed until {flags.group(1)} is set",
            f"{hg.repo.src('src/overlay_03/shop_menu.c', n + 1)}; {hg.repo.src('src/sys_flags.c', None, 'CheckUnlockedPokeBallsInMarts')}")


def hg_mart(hg, path, i, std, state, ways, marts, gaps):
    tiers, common, cline, arrays, special, sline = marts
    src_line = hg.repo.src(path, i + 1, std)
    if not hasattr(hg, "unlock"):
        hg.unlock = hg_ball_unlock(hg)
    if std == "std_pokemart":
        for item, need in common:
            b = min_badges(tiers, need)
            lock = hg.unlock if item == "ITEM_POKE_BALL" and hg.unlock else (None, None)
            add(ways, ball_of(item, BALL_CONST_GEN4), how="shop", where=hg.where(path), price=hg.price.get(item),
                requires=f"{b} badges" if b is not None else None, condition=lock[0],
                source=f"{src_line}; {hg.repo.src('src/scrcmd_mart.c', cline, '_020FBF22 (ScrCmd_MartBuy)')}"
                       + (f"; {lock[1]}" if lock[1] else ""))
        return
    which, at = state.get("item", (None, None))
    if not (which or "").isdigit() or int(which) >= len(special):
        gaps.append(f"heartgold: {src_line} opens a specialty mart whose index isn't set just before it")
        return
    name = special[int(which)]
    items, n = arrays[name]
    for item in items:
        lock = hg.unlock if item == "ITEM_POKE_BALL" and hg.unlock else (None, None)
        add(ways, ball_of(item, BALL_CONST_GEN4), how="shop", where=hg.where(path), price=hg.price.get(item), requires=None,
            condition=lock[0], source=f"{hg.repo.src(path, at, f'SetVar VAR_SPECIAL_x8004, {which}')}; {src_line}; "
                   f"{hg.repo.src('src/scrcmd_mart.c', n, f'{name} = _0210FA3C[{which}]')}" + (f"; {lock[1]}" if lock[1] else ""))


def hg_field(hg, ways, gaps):
    repo = hg.repo
    bank = "files/fielddata/script/scr_seq/scr_seq_0141.s"
    mapping = re.search(r"\{\s*_std_item_ball,\s*scr_seq_(\d+)_bin", repo.read("src/script_manager.c"))
    if not mapping or f"scr_seq_{mapping.group(1)}.s" != os.path.basename(bank):
        gaps.append("heartgold: src/script_manager.c doesn't map _std_item_ball to scr_seq_0141; item balls skipped")
        return
    lines = repo.lines(bank)
    entry = {}
    for i, line in enumerate(lines):
        m = re.match(r"^scr_seq_0141_(\d+):", line)
        if m:
            body = "\n".join(lines[i:i + 4])
            it = re.search(r"SetVar VAR_SPECIAL_x8008, (\w+)", body)
            q = re.search(r"SetVar VAR_SPECIAL_x8009, (\d+)", body)
            entry[int(m.group(1))] = (hg.item(it.group(1)) if it else None, int(q.group(1)) if q else 1, i + 1)
    hpath = "src/data/fieldmap/hidden_items.h"
    hidden = {}
    for n, line in enumerate(repo.lines(hpath), 1):
        m = re.match(r"^\s*\{ (ITEM_\w+),\s*(\d+),\s*\d+,\s*\d+,\s*(\d+)\s*\}", line)
        if m:
            hidden[int(m.group(3))] = (m.group(1), int(m.group(2)), n)
    ib, hb = hg.std["_std_item_ball"], hg.std["_std_hidden_item"]
    for zp in hg.zones:
        d = json.loads(repo.read(zp))
        where = hg.where(zp)
        for o in d.get("objects", []):
            sid = str(o.get("scriptId"))
            if sid.startswith("std_itemball_") and sid in hg.std:
                idx = hg.std[sid] - ib
                item, qty, n = entry.get(idx, (None, 1, None))
                if ball_of(item, BALL_CONST_GEN4):
                    add(ways, ball_of(item, BALL_CONST_GEN4), how="field", where=where, hidden=False, qty=qty,
                        source=f"{repo.src(zp, None, o.get('id'))}; {repo.src(bank, n, f'scr_seq_0141_{idx:03d} ({sid})')}")
        for b in d.get("bgs", []):
            sid = str(b.get("scriptId"))
            if sid.startswith("std_hiddenitem_") and sid in hg.std:
                item, qty, n = hidden.get(hg.std[sid] - hb, (None, 1, None))
                if ball_of(item, BALL_CONST_GEN4):
                    add(ways, ball_of(item, BALL_CONST_GEN4), how="field", where=where, hidden=True, qty=qty,
                        source=f"{repo.src(zp, None, sid)}; {repo.src(hpath, n, 'sHiddenItemParam')}")


def hg_phone(hg, ways, gaps):
    """Phone contacts who call with an item (PHONESCRIPTTYPE_ITEM); Wilton's Poké Ball entry is rerolled in code."""
    defs = "src/application/pokegear/phone/phone_script_defs.c"
    roll = "src/application/pokegear/phone/overlay_101_021F1D74.c"
    lines, rl = hg.repo.lines(defs), hg.repo.lines(roll)
    reroll = {}
    for i, line in enumerate(rl[:-1]):
        m = re.search(r"itemId == (ITEM_\w+)", line)
        r = re.search(r"\(MTRandom\(\) % (\d+)\) \+ (ITEM_\w+)", rl[i + 1])
        if m and r:
            start = next(k for k, v in hg.items.items() if v == r.group(2))
            reroll[m.group(1)] = ([hg.items[start + k] for k in range(int(r.group(1)))], i + 2)
    who = None
    for i, line in enumerate(lines):
        m = re.match(r"^\s*// (?!PHONE_SCRIPT_)(.+?)\s*$", line)
        if m:
            who = m.group(1)
        if "PHONESCRIPTTYPE_ITEM" not in line:
            continue
        item = next((re.search(r"\.param1 = (ITEM_\w+)", l).group(1) for l in lines[i:i + 3] if ".param1 = ITEM_" in l), None)
        script = next((re.match(r"^\s*// (PHONE_SCRIPT_\d+)", lines[k]).group(1) for k in range(i, i - 5, -1)
                       if re.match(r"^\s*// PHONE_SCRIPT_\d+", lines[k])), None)
        given, rline = reroll.get(item, ([item], None))
        for g in given:
            add(ways, ball_of(g, BALL_CONST_GEN4), how="gift", where="phone call (Pokégear), then collected in person",
                who=f"{who} ({script})", qty=1,
                note=f"the script's item is {item}, rerolled to one of {', '.join(given)} at random" if rline else None,
                source=f"{hg.repo.src(defs, i + 1, script)}" + (f"; {hg.repo.src(roll, rline, 'PhoneCall_ApplyGenericNPCcallSideEffect')}" if rline else ""))


def hg_other(hg, ways, gaps, notes):
    repo = hg.repo
    shop = repo.lines("src/overlay_03/shop_menu.c")
    n = next((i for i, l in enumerate(shop) if "ITEM_POKE_BALL" in l and "ITEM_PREMIER_BALL" in l), None)
    if n is not None:
        need = re.search(r"quantity >= (\d+)", shop[n])
        add(ways, "premier", how="other", where="any Poké Mart (normal type)", qty=1,
            note=f"bonus for buying {need.group(1) if need else 'enough'}+ Poké Balls at once",
            source=repo.src("src/overlay_03/shop_menu.c", n + 1))
    bc = repo.lines("src/overlay_bug_contest.c")
    n = next((i for i, l in enumerate(bc) if re.search(r"sport_balls = \d+;", l)), None)
    gates = [(p, i + 1) for p in hg.scripts for i, l in enumerate(repo.lines(p)) if "CallStd std_bug_contest_guard_start" in l]
    if n is not None:
        for p, at in gates or [(None, None)]:
            add(ways, "sport", how="other", where=hg.where(p) if p else "Bug-Catching Contest",
                qty=int(re.search(r"= (\d+)", bc[n]).group(1)),
                note="Bug-Catching Contest entry: BugContest_New sets the contest's Sport Ball counter; not Bag items",
                source=f"{repo.src('src/overlay_bug_contest.c', n + 1, 'BugContest_New')}" + (f"; {repo.src(p, at, 'std_bug_contest_guard_start')}" if p else ""))
    sc = repo.lines("src/scrcmd_c.c")
    n = next((i for i, l in enumerate(sc) if re.search(r"\*p_nSafariBall = [1-9]\d*;", l)), None)
    starts = [(p, i + 1) for p in hg.scripts for i, l in enumerate(repo.lines(p)) if re.match(r"^\s*SafariZoneAction 0,", l)]
    if n is not None:
        for p, at in starts or [(None, None)]:
            add(ways, "safari", how="other", where=hg.where(p) if p else "Safari Zone", qty=int(re.search(r"= (\d+)", sc[n]).group(1)),
                note="handed out when the Safari Zone game starts (SafariZoneAction 0); a counter, not Bag items",
                source=f"{repo.src('src/scrcmd_c.c', n + 1, 'ScrCmd_SafariZoneAction')}" + (f"; {repo.src(p, at, 'SafariZoneAction 0')}" if p else ""))
    cs = repo.lines("src/catching_show.c")
    n = next((i for i, l in enumerate(cs) if "FieldSystem_GetParkBallCount(FieldSystem" in l), None)
    mons = re.search(r"#define CATCHING_SHOW_MONS\s+(\d+)", repo.read("include/constants/pokemon.h"))
    ctl = repo.lines("src/battle/battle_controller_player.c")
    throw = next((i for i, l in enumerate(ctl) if "battleType & BATTLE_TYPE_PAL_PARK" in l), None)
    if n is not None and mons:
        add(ways, "park", how="other", where="Pal Park (catching show)", qty=int(mons.group(1)),
            note="throws in the Pal Park catching show: CATCHING_SHOW_MONS minus the Pokémon caught so far. The ball "
                 "button runs the Safari-throw command (CONTROLLER_COMMAND_SAFARI_THROW_BALL); no script, mart or gift "
                 "puts ITEM_PARK_BALL in the Bag",
            source=f"{repo.src('src/catching_show.c', n + 1, 'FieldSystem_GetParkBallCount')}; "
                   f"{repo.src('include/constants/pokemon.h', None, 'CATCHING_SHOW_MONS')}; "
                   f"{repo.src('src/battle/battle_controller_player.c', throw + 1 if throw is not None else None)}")
    text = repo.read("asm/overlay_12_battle_command.s")
    m = re.search(r"^sPickupTable1:.*?\n((?:\s*\.short .*\n)+)", text, re.M)
    if m:
        line = text[:m.start()].count("\n") + 1
        for item in dict.fromkeys(re.findall(r"(ITEM_\w+)", m.group(1))):
            add(ways, ball_of(item, BALL_CONST_GEN4), how="other", where="Pickup (a party Pokémon with the ability, after battle)",
                note="in the Pickup table; which entries can come up depends on the Pokémon's level",
                source=repo.src("asm/overlay_12_battle_command.s", line, "sPickupTable1"))


def hg_kurt(hg, ways, gaps):
    """Kurt's ball for each Apricorn (asm/unk_02031B0C.s ApricornBox_GetKurtBall's table, indexed by Apricorn, which the
    Apricorn Box stores as APRICORN_* - 1: ApricornTrees_GetApricorn in src/apricorn_tree_sys.c) and the tree locations."""
    repo = hg.repo
    asm = repo.read("asm/unk_02031B0C.s")
    func = asm.split("ApricornBox_GetKurtBall:", 1)[1].split("thumb_func_end", 1)[0]
    table = re.search(r"=(_\w+)", func).group(1)
    m = re.search(rf"^{table}:\s*\n((?:\s*\.short \w+\s*\n)+)", asm, re.M)
    balls = re.findall(r"\.short (\w+)", m.group(1))
    tline = asm[:m.start()].count("\n") + 1
    apri = {int(v): k[len("APRICORN_"):] for k, v in re.findall(r"#define (APRICORN_\w+)\s+(\d+)", repo.read("include/constants/apricorns.h"))
            if k != "APRICORN_NONE"}
    sys_c = repo.read("src/apricorn_tree_sys.c")
    minus = "return ret - 1;" in sys_c
    if not minus:
        gaps.append("heartgold: couldn't confirm that the Apricorn Box index is APRICORN_* - 1 (src/apricorn_tree_sys.c)")
    kurt = [(p, i + 1) for p in hg.scripts for i, l in enumerate(repo.lines(p)) if re.match(r"^\s*ScrCmd_737 VAR_SPECIAL_x8004", l)]
    where = hg.where(kurt[0][0]) if kurt else "Kurt"
    trees = hg_trees(hg, apri, sys_c)
    rows = []
    for idx, item in enumerate(balls):
        code = apri.get(idx + 1)
        ball = ball_of(item, BALL_CONST_GEN4)
        src = f"{repo.src('asm/unk_02031B0C.s', tline + 1 + idx, f'{table}[{idx}] (ApricornBox_GetKurtBall)')}; " \
              f"{repo.src('include/constants/apricorns.h', None, f'APRICORN_{code}')}"
        if kurt:
            src += f"; {repo.src(kurt[0][0], kurt[0][1], 'ScrCmd_737 (Kurt hands over the ball)')}"
        add(ways, ball, how="craft", where=where, who="Kurt", **{"from": APRICORN_NAME.get(code, code)},
            note="Kurt makes balls from the Apricorns you give him (the quantity is the number of Apricorns); you collect "
                 "them later (FLAG_DAILY_KURT_MAKING_BALLS)", source=src)
        rows.append({"apricorn": APRICORN_NAME.get(code, code), "ball": ball, "trees": [t["where"] for t in trees.get(code, [])],
                     "tree_sources": [t["source"] for t in trees.get(code, [])], "source": src})
    return rows


def hg_trees(hg, apri, sys_c):
    """Tree index (the tree object's param0, read by FieldSystem_ApricornTree_GetApricorn) -> map, and -> Apricorn from
    sTreeApricorns."""
    repo = hg.repo
    body = sys_c.split("sTreeApricorns[NUM_APRICORN_TREE] = {", 1)[1].split("};", 1)[0]
    line0 = sys_c[:sys_c.index("sTreeApricorns[NUM_APRICORN_TREE]")].count("\n") + 1
    kinds = re.findall(r"APRICORN_(\w+),\s*(?://\s*(.*))?", body)
    out = {}
    for zp in hg.zones:
        for o in json.loads(repo.read(zp)).get("objects", []):
            if o.get("scriptId") == "std_apricorn_tree":
                idx = o.get("param0")
                code, comment = kinds[idx] if isinstance(idx, int) and idx < len(kinds) else (None, None)
                if code:
                    note = f" (its comment says {comment.strip()})" if comment else ""
                    out.setdefault(code, []).append({"where": hg.where(zp),
                                                     "source": f"{repo.src(zp, None, o.get('id'))} (param0 {idx}); "
                                                               f"{repo.src('src/apricorn_tree_sys.c', line0 + 1 + idx, f'sTreeApricorns[{idx}]')}{note}"})
    return out


def hg_versions(hg, ways, notes):
    """HeartGold/SoulSilver differences: list the ways whose script entry checks GetGameVersion before giving."""
    flagged = sorted({f"{b} ({w['source'].split(':')[0].split('/')[-1]})" for b, rows in ways.items() for w in rows
                      if w.get("version_check")})
    if flagged:
        notes.append("heartgold: ball ways whose script entry checks GetGameVersion first (may differ in SoulSilver): "
                     + ", ".join(flagged))
    else:
        notes.append("heartgold: no ball way found here sits after a GetGameVersion check in its script entry, and the "
                     "mart tables, item-ball and hidden-item tables and Kurt's table have no HeartGold/SoulSilver switch; "
                     "the same ways apply to SoulSilver as far as these sources show.")


# --- the whole ------------------------------------------------------------------------------------------------------
def build(root=PRET):
    games, gaps, notes, apricorns = {}, [], [], {}
    for game, name in GAMES.items():
        repo = Repo(root, name)
        present, ways, g_gaps, g_notes, trees = EXTRACT[game](repo, game)
        stray = sorted(set(ways) - present)
        for b in stray:
            g_gaps.append(f"{game}: found ways for '{b}', which isn't in the game's item list; dropped")
            ways.pop(b)
        games[game] = {b: dedupe(ways.get(b, [])) for b in BALLS if b in present}
        for b in BALLS:
            if b in present and not ways.get(b):
                g_gaps.append(f"{game}: {b} is in the item list but no way to get it was found in the sources read "
                              "(marts, map scripts, item balls, hidden items, gifts, Pickup)")
        gaps += g_gaps
        notes += g_notes
        if trees is not None:
            apricorns[game] = trees
    return {"_note": "Built by engine/equipment/acquire.py from the pret decompilations at the commits below. Each way "
                     "cites its file:line and label. 'shop' prices are the item's own price (Crystal's rooftop sale "
                     "lists its own); 'requires' is the badge count for the Gen 4 badge-tiered marts; 'condition' is "
                     "the raw flag/event test in front of a mart or gift. Gaps say what the source couldn't settle. "
                     "SoulSilver shares HeartGold's data.",
            "commits": dict(COMMITS), "games": games, "apricorns": apricorns, "notes": notes, "gaps": gaps}


EXTRACT = {"crystal": lambda r, g: crystal(r), "emerald": gen3, "firered": gen3, "platinum": lambda r, g: platinum(r),
           "heartgold": lambda r, g: heartgold(r)}


def dedupe(rows):
    seen, out = set(), []
    for r in rows:
        key = json.dumps(r, sort_keys=True, ensure_ascii=False)
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def main(argv):
    root, out = PRET, OUT
    if "--pret" in argv:
        root = argv[argv.index("--pret") + 1]
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
    doc = build(root)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
    print(f"{out}")
    for game, balls in doc["games"].items():
        n = sum(len(v) for v in balls.values())
        hows = {}
        for v in balls.values():
            for w in v:
                hows[w["how"]] = hows.get(w["how"], 0) + 1
        print(f"  {game:10} {len(balls)} balls, {n} ways ({', '.join(f'{k} {v}' for k, v in sorted(hows.items()))}); "
              f"empty: {', '.join(b for b, v in balls.items() if not v) or '-'}")
    print(f"  {len(doc['gaps'])} gaps, {len(doc['notes'])} notes")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
