"""How you get every Poké Ball in Crystal, Emerald, FireRed, Platinum and HeartGold/SoulSilver, read from the games' own
decompiled source (the pret projects), with the file and label each fact comes from.

    python3 -I engine/equipment/acquire.py [--pret DIR] [--out FILE]   # engine/data_manifest/ball_acquisition.json

DIR holds one git clone per repo (pokecrystal, pokeemerald, pokefirered, pokeplatinum, pokeheartgold; default PRET
below, or $PRET_DIR). Every file is read from the pinned commit in COMMITS through git's object store (`git cat-file`),
never from the working tree, so a sparse or blobless clone works: blobs it lacks are fetched in one batch first. The
inputs are only read and parsed; nothing in them is run.

What each game's extractor reads:
- Crystal: maps/*.asm (`pokemart`, `giveitem`, `verbosegiveitem[var]`, `itemball`, `hiddenitem`, `fruittree`,
  `special GiveParkBalls`/`BuenaPrize`), data/items/ (marts, rooftop sale, Buena prizes, Mom's purchases, Mystery Gift
  pool, Apricorn table, fruit trees, prices in attributes.asm), maps/KurtsHouse.asm for Kurt's Apricorn -> ball.
- Emerald, FireRed: data/maps/*/scripts.inc (`pokemart` lists, `giveitem`, `giveitem_msg`), data/maps/*/map.json (item
  ball objects and hidden items), data/scripts/ (item balls, shared gifts), src/ (prices, the Premier Ball bonus in
  shop.c, Safari Balls, Emerald's Lottery Corner, Pickup).
- Platinum: include/data/mart_items.h with src/scrcmd_shop.c's badge tiers, res/field/scripts/ (marts, gifts, visible
  items), include/data/field/hidden_items.h, res/field/events/ to place visible and hidden items on maps,
  include/data/map_headers.h for which script and event file belongs to which map, res/items/data/*.json for prices.
- HeartGold: src/scrcmd_mart.c (badge mart and the unnamed specialty marts), files/fielddata/script/scr_seq/ (gifts,
  marts; item ids there are often plain numbers, read through include/constants/items.h), files/fielddata/eventdata/
  zone_event/ (item balls, hidden items, Apricorn trees), include/constants/maps.h (map code -> map name),
  asm/unk_02031B0C.s (Kurt's Apricorn -> ball table), src/apricorn_tree_sys.c, files/itemtool/itemdata/item_data.csv.

A way is {"how": shop|gift|field|craft|other, "where", "source": "<repo>/<path>:<line> <label>", ...}. What the source
can't settle goes to "gaps", never into a guess. Place names are the map or label names made readable; the raw label
stays in "source".
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
OUT = os.path.join(ENGINE, "data_manifest", "ball_acquisition.json")
PRET = os.environ.get("PRET_DIR") or "/tmp/claude-0/-home-user/ec141e37-3c55-55e4-88d6-8cd37fdd0b67/scratchpad/pret"
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
BALL_CONST_CRYSTAL = {**{k: v for k, v in BALL_CONST.items()}, "PARK_BALL": "sport"}
BALL_CONST_GEN4 = {**BALL_CONST, "SPORT_BALL": "sport", "PARK_BALL": "park"}
APRICORN_NAME = {c: f"{c.capitalize()} Apricorn" for c in ("RED", "BLU", "YLW", "GRN", "WHT", "BLK", "PNK")}
WORD = {"Elms": "Elm's", "Kurts": "Kurt's", "Birchs": "Birch's", "Oaks": "Oak's", "Bills": "Bill's", "Stevens": "Steven's",
        "Dept": "Dept.", "Mt": "Mt.", "Mr": "Mr.", "Pokecenter": "Pokémon Center", "Pokemon": "Pokémon", "Pokemart": "Poké Mart",
        "Pokeathalon": "Pokéathlon", "Pokeathlon": "Pokéathlon", "Hq": "HQ", "Tv": "TV", "Ss": "S.S.", "Pc": "PC", "Ne": "NE",
        "Nw": "NW", "Se": "SE", "Sw": "SW", "Ii": "II"}


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
        ways.setdefault(ball, []).append({k: v for k, v in way.items()})


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
            "data/items/attributes.asm", "data/items/marts.asm", "data/items/rooftop_sale.asm",
            "data/items/buena_prizes.asm", "data/items/mom_phone.asm", "data/items/mystery_gift_items.asm",
            "data/items/apricorn_balls.asm", "data/items/fruit_trees.asm", "engine/items/mart.asm",
            "engine/events/bug_contest/contest.asm", "engine/events/mom_phone.asm"]
    repo.load(maps + data)
    consts = re.findall(r"^\s*const (\w+)", repo.read("constants/item_constants.asm"), re.M)
    present = {BALL_CONST_CRYSTAL[c] for c in consts if c in BALL_CONST_CRYSTAL}
    for n, line in enumerate(repo.lines("constants/item_constants.asm"), 1):
        if re.match(r"DEF SAFARI_BALL\s+EQU", line):
            notes.append(f"crystal: no Safari Ball item. SAFARI_BALL is only an alias of item ${line.split('$')[1][:2]} "
                         f"(MOON_STONE) under 'leftovers from red' ({repo.src('constants/item_constants.asm', n)}).")
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
        m = re.match(r"^(Mart\w+):", line)
        if m:
            cur = m.group(1)
            stock[cur] = []
            continue
        m = re.match(r"^\s*db (\w+)", line)
        if cur and m and not m.group(1).isdigit() and m.group(1) != "-1":
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
            cond = crystal_condition(lines, i, owner)
            if m.group(1) == "MARTTYPE_ROOFTOP":
                for item, cost, n, which, when in roof:
                    add(ways, ball_of(item, BALL_CONST_CRYSTAL), how="shop", where=place, price=cost, requires=None,
                        condition=f"rooftop sale ({when})",
                        source=f"{repo.src(path, i + 1, owner[i][0])}; {repo.src('data/items/rooftop_sale.asm', n, which)}")
                continue
            label = label_of.get(m.group(2))
            if not label:
                gaps.append(f"crystal: {repo.src(path, i + 1)} opens {m.group(2)}, which has no list in data/items/marts.asm")
                continue
            for item, n in stock[label]:
                add(ways, ball_of(item, BALL_CONST_CRYSTAL), how="shop", where=place, price=price.get(item), requires=None,
                    condition=cond, source=f"{repo.src(path, i + 1, owner[i][0])}; {repo.src('data/items/marts.asm', n, label)}")


def crystal_rooftop(repo, gaps):
    """The Goldenrod rooftop sale's two lists and which one engine/items/mart.asm picks (before/after the Hall of Fame)."""
    when = {}
    body = repo.read("engine/items/mart.asm").split("RooftopSale:", 1)[-1].split("\n\n", 1)[0]
    first = re.search(r"ld de, (RooftopSaleMart\d)", body)
    flag = re.search(r"bit (STATUSFLAGS_HALL_OF_FAME_F)", body)
    later = re.findall(r"ld de, (RooftopSaleMart\d)", body)
    if first and flag and len(later) == 2:
        when = {later[0]: f"before {flag.group(1)}", later[1]: f"after {flag.group(1)}"}
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
    for path, n in specials.get("GiveParkBalls", []):
        add(ways, "sport", how="other", where=humanize(os.path.basename(path)[:-4]),
            qty=int(balls.group(1)) if balls else None,
            note="Bug-Catching Contest entry: the gate officer gives the contest's Park Balls. GiveParkBalls sets the "
                 "wParkBallsRemaining counter (BUG_CONTEST_BALLS); they are not put in the Bag",
            source=f"{repo.src(path, n, 'special GiveParkBalls')}; "
                   f"{repo.src('engine/events/bug_contest/contest.asm', 1, 'GiveParkBalls')}; "
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
            add(ways, ball_of(m.group(1), BALL_CONST_CRYSTAL), how="other", where="Mystery Gift (link with another player)",
                note="in the Mystery Gift item pool (unlocked at Goldenrod Dept. Store 5F)",
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
    trees = crystal_trees(repo, maps)
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


def crystal_trees(repo, maps):
    """FRUITTREE_* -> Apricorn (data/items/fruit_trees.asm, entries in constant order with the constant as a comment)."""
    consts = re.findall(r"^\s*const (FRUITTREE_\w+)", repo.read("constants/script_constants.asm"), re.M)
    rows = re.findall(r"^\s*db (\w+)\s*;\s*(\w+)", repo.read("data/items/fruit_trees.asm"), re.M)
    item_of = {}
    for const, (item, comment) in zip(consts, rows):
        if const == f"FRUITTREE_{comment}":
            item_of[const] = item
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
    src += ["src/lottery_corner.c"] if repo.has("src/lottery_corner.c") else []
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
    for line in lines:
        m = re.match(rf"^\s*(goto|call)_if_(set|unset)\s+(\w+),\s*{re.escape(label)}\s*$", line) if label else None
        if m:
            conds.append(f"{m.group(3)} {'set' if m.group(2) == 'set' else 'not set'}")
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
    hits = [l.strip() for l in lines if label and re.search(rf"\b{re.escape(label)}\s*$", l) and not l.startswith(label)]
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
    pickup(repo, game, "src/battle_script_commands.c", r"sPickupItems\[\]\s*=\s*\{(.*?)\};", BALL_CONST, ways)
    if game == "emerald":
        gaps.append("emerald: the Battle Pyramid's own Pickup table (src/battle_pyramid.c, used by Cmd_pickup there) "
                    "wasn't read")
        bsc = repo.lines("src/battle_script_commands.c")
        n = next((i for i, l in enumerate(bsc) if "case ITEM_DIVE_BALL" in l), None)
        if n is not None and "MAP_TYPE_UNDERWATER" in " ".join(bsc[n:n + 4]):
            notes.append("emerald: the Dive Ball works anywhere; its bonus (35 vs 10, i.e. x3.5) applies only when the "
                         f"map type is MAP_TYPE_UNDERWATER ({repo.src('src/battle_script_commands.c', n + 1, 'Cmd_handleballthrow')}).")


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
                gaps.append(f"platinum: {repo.src(s)} has ball or mart lines but no map header uses it (skipped)")
    return present, ways, gaps, notes, None


def platinum_park_note(repo):
    ctl = repo.lines("src/battle/battle_controller_player.c")
    lib = repo.lines("src/battle/battle_lib.c")
    a = next((i + 1 for i, l in enumerate(ctl) if "PLAYER_INPUT_PAL_PARK_BALL" in l), None)
    b = next((i + 1 for i, l in enumerate(lib) if "BATTLE_TYPE_PAL_PARK" in l and "if" in l), None)
    return ("platinum: no Park Ball item. generated/items.txt has no ITEM_PARK_BALL; the Pal Park's ball button runs the "
            f"Safari throw ({repo.src('src/battle/battle_controller_player.c', a, 'PLAYER_INPUT_PAL_PARK_BALL')}) and a "
            "Pokémon caught there keeps the ball it already had (MON_DATA_POKEBALL, "
            f"{repo.src('src/battle/battle_lib.c', b)}).")


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
            if re.match(r"^\s*PokeMartCommon(WithGreeting)?\b", line):
                for item, need, n in common:
                    b = min_badges(tiers, need)
                    add(ways, ball_of(item, BALL_CONST_GEN4), how="shop", where=where, price=price.get(item),
                        requires=f"{b} badges" if b is not None else f"tier {need} (unreachable?)",
                        source=f"{repo.src(path, i + 1, owner[i][0])}; {repo.src(hdr, n, 'PokeMartCommonItems')}; "
                               f"{repo.src('src/scrcmd_shop.c', None, 'ScrCmd_PokeMartCommon')}")
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
    hits = []
    for line in lines:
        m = re.match(rf"^\s*(GoTo|Call)If(\w+)\s+(.*?),\s*{re.escape(label)}\s*$", line) if label else None
        if m:
            hits.append(f"{m.group(2)} {m.group(3)}")
    return "; ".join(hits) or None


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
            qty = pt_qty(lines, i, owner, label)
            if m.group(1) == "3":                               # Jubilife TV's lottery: the prize goes through VAR_0x8003
                add(ways, ball, how="other", where=where, qty=qty,
                    note=f"lottery prize ({label}, picked when {pt_condition(lines, label)})",
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
                     "src/application/pokegear/phone/overlay_101_021F1D74.c"]
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
        self.unresolved = []

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
    if hg.unresolved:
        gaps.append(f"heartgold: {len(hg.unresolved)} item-giving script lines take the item from a variable the script "
                    f"doesn't set nearby, so which item isn't known from the script alone (e.g. {', '.join(hg.unresolved[:4])})")
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
    tiers, common, cline, arrays, special, sline = hg_marts(hg)
    jumps = []                                                  # (target label, state, path) to follow one level
    for path in hg.scripts:
        lines = hg.repo.lines(path)
        state = {}
        for i, line in enumerate(lines):
            if re.match(HG_LABEL, line) and (i == 0 or re.match(r"^\s*(End|Return|GoTo \w+)\s*$", lines[i - 1])):
                state = {}
            hg_step(hg, path, lines, i, line, state, ways, jumps, (tiers, common, cline, arrays, special, sline), gaps)
    labels = {}
    for path in hg.scripts:
        lines = hg.repo.lines(path)
        for i, line in enumerate(lines):
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
            if "VAR_SPECIAL_x8004" in lines[j] and not re.match(r"^\s*(HasSpaceForItem|GiveItem|BufferItemName\w*)\b", lines[j]):
                break                                           # x8004 means something else here
            if hg_step(hg, path, lines, j, lines[j], st, ways, None, None, gaps, via=target) == "gave":
                break


def hg_step(hg, path, lines, i, line, state, ways, jumps, marts, gaps, via=None):
    """One script line: track what VAR_SPECIAL_x8004/x8005 hold, and record a gift or a mart when one happens."""
    s = line.strip()
    m = re.match(r"SetVar VAR_SPECIAL_x800([45]), (\w+)$", s)
    if m:
        state["item" if m.group(1) == "4" else "qty"] = (m.group(2), i + 1)
        return None
    m = re.match(r"CopyVar VAR_SPECIAL_x800([45]), (\w+)$", s)
    if m:
        state["item" if m.group(1) == "4" else "qty"] = (m.group(2), i + 1)
        return None
    m = re.match(r"(ItemVars|GoToIfNoItemSpace2?) (\w+), (\w+)", s)
    if m:
        state["item"], state["qty"] = (m.group(2), i + 1), (m.group(3), i + 1)
        return None
    m = re.match(r"GiveItemNoCheck (\w+), (\w+)", s)
    if m:
        hg_gift(hg, path, lines, i, m.group(1), m.group(2), i + 1, ways, via)
        return "gave"
    m = re.match(r"GiveItem (\w+), (\w+), \w+", s)
    if m:
        item = state.get("item", (None,))[0] if m.group(1) == "VAR_SPECIAL_x8004" else m.group(1)
        qty = state.get("qty", (None,))[0] if m.group(2) == "VAR_SPECIAL_x8005" else m.group(2)
        hg_gift(hg, path, lines, i, item, qty, state.get("item", (None, i + 1))[1], ways, via)
        return "gave"
    m = re.match(r"CallStd (\w+)$", s)
    if m and m.group(1) in HG_GIVE_STD:
        item, at = state.get("item", (None, i + 1))
        hg_gift(hg, path, lines, i, item, state.get("qty", (None,))[0], at, ways, via)
        return "gave"
    if m and marts and m.group(1) in ("std_pokemart", "std_special_mart"):
        hg_mart(hg, path, i, m.group(1), state, ways, marts, gaps)
        return None
    m = re.match(r"(GoTo|Call)\w* (?:.*, )?(\w+)$", s)
    if m and jumps is not None and "item" in state:
        jumps.append((m.group(2), dict(state), path))
    return None


def hg_gift(hg, path, lines, i, item_value, qty, at, ways, via):
    item = hg.item(item_value)
    if item is None:
        hg.unresolved.append(hg.repo.src(path, i + 1))
        return
    ball = ball_of(item, BALL_CONST_GEN4)
    if not ball:
        return
    owner = blocks(lines, HG_LABEL)
    label = owner[i][0]
    src = hg.repo.src(path, at, owner[at - 1][0])
    if at != i + 1:
        src += f"; {hg.repo.src(path, i + 1, label)}"
    qty = str(qty) if qty is not None else ""
    add(ways, ball, how="gift", where=hg.where(path), who=via or owner[at - 1][0], qty=int(qty) if qty.isdigit() else None,
        **({"qty_from": qty} if qty and not qty.isdigit() else {}), source=src)


def hg_mart(hg, path, i, std, state, ways, marts, gaps):
    tiers, common, cline, arrays, special, sline = marts
    src_line = hg.repo.src(path, i + 1, std)
    if std == "std_pokemart":
        for item, need in common:
            b = min_badges(tiers, need)
            add(ways, ball_of(item, BALL_CONST_GEN4), how="shop", where=hg.where(path), price=hg.price.get(item),
                requires=f"{b} badges" if b is not None else None,
                source=f"{src_line}; {hg.repo.src('src/scrcmd_mart.c', cline, '_020FBF22 (ScrCmd_MartBuy)')}")
        return
    which, at = state.get("item", (None, None))
    if not (which or "").isdigit() or int(which) >= len(special):
        gaps.append(f"heartgold: {src_line} opens a specialty mart whose index isn't set just before it")
        return
    name = special[int(which)]
    items, n = arrays[name]
    for item in items:
        add(ways, ball_of(item, BALL_CONST_GEN4), how="shop", where=hg.where(path), price=hg.price.get(item), requires=None,
            source=f"{hg.repo.src(path, at, f'SetVar VAR_SPECIAL_x8004, {which}')}; {src_line}; "
                   f"{hg.repo.src('src/scrcmd_mart.c', n, f'{name} = _0210FA3C[{which}]')}")


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
                    out.setdefault(code, []).append({"where": hg.where(zp),
                                                     "source": f"{repo.src(zp, None, o.get('id'))} (param0 {idx}); "
                                                               f"{repo.src('src/apricorn_tree_sys.c', line0 + 1 + idx, f'sTreeApricorns[{idx}]')}"})
    return out


def hg_versions(hg, ways, notes):
    """HeartGold/SoulSilver differences: any ball way whose script file branches on GetGameVersion is flagged."""
    flagged = []
    for ball, rows in ways.items():
        for w in rows:
            path = w["source"].split(";")[0].split(":")[0].replace(f"{hg.repo.name}/", "", 1)
            if path.endswith(".s") and hg.repo.has(path) and "GetGameVersion" in hg.repo.read(path):
                w["version_check"] = "this script file branches on GetGameVersion; the way may differ between HG and SS"
                flagged.append(f"{ball} ({os.path.basename(path)})")
    if flagged:
        notes.append("heartgold: ways from script files that check the game version (HeartGold vs SoulSilver): "
                     + ", ".join(sorted(set(flagged))))
    else:
        notes.append("heartgold: none of the ball ways found sit in a script that checks GetGameVersion; the marts, "
                     "item tables and Kurt's table read here have no HeartGold/SoulSilver switch.")


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
