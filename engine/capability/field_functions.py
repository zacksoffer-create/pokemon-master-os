"""The moves each game lets a Pokémon use from the party menu outside battle (the "field moves"), the badge or flag
the game's own code tests before it allows one, whether the move is an HM or a TM there (and its number), read from
the games' decompiled source (the pret projects), with the file:line and label each fact comes from.

    python3 -I engine/capability/field_functions.py [--pret DIR] [--out FILE]   # engine/data_manifest/field_functions.json

DIR holds one git clone per repo (pokecrystal, pokefirered, pokeemerald, pokeplatinum, pokeheartgold; default PRET
below, or $PRET_DIR). Every file is read from the pinned commit in COMMITS (the same commits as
engine/equipment/acquire.py) through git's object store (`git cat-file`), never from the working tree, so a sparse or
blobless clone works: blobs it lacks are fetched in one batch first. The inputs are only read and parsed; nothing in
them is run. Standard library only.

What each game's extractor reads:
- Crystal: data/mon_menu.asm (MonMenuOptions, the MONMENU_FIELD_MOVE rows: the menu's field moves), engine/pokemon/
  mon_menu.asm (PokemonActionSubmenu.Actions -> the MonMenu_* handler -> the *Function it farcalls), engine/events/
  *.asm and engine/items/item_effects.asm (that function's body, with its fall-through and one level of calls, searched
  for `ld de, ENGINE_*BADGE` + `call CheckBadge`), maps/*.asm (`setflag ENGINE_*BADGE` and the badge's name in that
  map's text), constants/item_constants.asm (add_tm / add_hm / add_mt order = TM / HM / tutor number),
  data/pokemon/evos_attacks.asm and egg_moves.asm (how a move with no machine is learned), engine/pokemon/
  mon_submenu.asm (link-mode rule) and the Try*OW overworld prompts.
- FireRed, Emerald: the FIELD_MOVE_* order (src/party_menu.c enum or include/constants/party_menu.h), src/data/
  party_menu.h (sFieldMoves, sFieldMoveCursorCallbacks, FireRed's sFieldMoveDescriptionTable -> src/strings.c, and
  FireRed's sTMHMMoves), src/party_menu.c (CursorCb_FieldMove: the badge test `fieldMove <= FIELD_MOVE_WATERFALL &&
  FlagGet(FLAG_BADGE01_GET + fieldMove)`), src/*.c (each SetUpFieldMove_* callback), include/constants/flags.h,
  data/maps/*/scripts.inc + text.inc (which gym sets FLAG_BADGEnn_GET and the badge's name in its text),
  include/constants/tms_hms.h (Emerald's TM/HM order), src/data/pokemon/{tutor,level_up}_learnsets.h and egg_moves.h,
  and the overworld prompts (data/scripts/field_move*.inc, src/field_control_avatar.c).
- Platinum: include/field_move_tasks.h (enum FieldMoveList), src/applications/party_menu/main.c (sFieldMoves),
  src/field_move_tasks.c (fieldMoveTaskOrError and each FieldMoves_Check* body, for PlayerHasRequiredBadge),
  src/applications/party_menu/context_menu.c (Milk Drink / Softboiled), generated/badges.txt, res/field/scripts/
  scripts_*.s (GiveBadge) with res/text/<same map>.json (the badge's name), res/items/data/{tm,hm}NN.json
  (teachesMove), res/pokemon/move_tutors.json, res/pokemon/*/data.json (level-up and egg learnsets),
  res/field/scripts/scripts_field_moves.s (overworld prompts).
- HeartGold: include/party_menu.h (PartyMonContextMenuItem, PartyMenuActionReturn), src/party_menu.c (sFieldMoves),
  src/party_menu_list_items.c (the per-move menu actions; the HP transfer for Milk Drink / Softboiled), src/field_move.c
  (sFieldMoveFuncTable and each FieldMove_Check* body, for PlayerProfile_TestBadgeFlag), include/constants/badge.h,
  files/fielddata/script/scr_seq/*.s (GiveBadge, and the message bank it #includes -> files/msgdata/msg/*.json for the
  badge's name; scr_seq_0146.s for the overworld prompts), src/item.c (sTMHMMoves), src/field/scrcmd_move_tutor.c
  (sTutorMoves), files/poketool/personal/wotbl.narc and files/fielddata/sodateya/kowaza_list.narc (level-up and egg
  learnsets, decoded as include/pokemon.h and src/get_egg.c do), include/constants/{moves,species}.h. SoulSilver is
  built from the same files; any GetGameVersion/GAME_VERSION test in the files read is reported in notes.

A row is {"move", "machine", "badge", "badge_const", "requires", "does", "source"}. "machine" is "HMnn"/"TMnn", or for
a move with no machine "move tutor" (it is in the game's tutor table), "level-up only", or "level-up or egg move".
"badge" is the badge's display name (or "none"); "badge_const" the constant the code tests (null when none).
"requires" is a short summary of the other conditions the cited check function enforces; "does" a short summary of
what the move does (FireRed: its own party-menu description). What the source can't settle goes to "gaps", never into
a guess; "notes" hold source-backed remarks.
"""
import json
import os
import re
import struct
import subprocess
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
OUT = os.path.join(ENGINE, "data_manifest", "field_functions.json")
PRET = os.environ.get("PRET_DIR") or os.path.join(ENGINE, "data", "raw", "pret")
COMMITS = {"pokecrystal": "5c877ef55197039c9676e8e3eec6d254b1c40fe8",
           "pokeemerald": "731ad5bfd6e6f265508d0efcca0ba42f9dcf5881",
           "pokefirered": "ce6406d8c2eaf46d543c8a2606de0c3cb1951982",
           "pokeplatinum": "be36a9db3d2390a5009adc087c7aef550ce335e7",
           "pokeheartgold": "6988158691eb6178cff697cda0428045ddcba5fb"}
GAMES = {"crystal": "pokecrystal", "firered": "pokefirered", "emerald": "pokeemerald", "platinum": "pokeplatinum",
         "heartgold": "pokeheartgold"}

# move constant without MOVE_ and underscores -> display name (the spellings the rest of Blackthorn uses)
MOVE_NAMES = {"CUT": "Cut", "FLY": "Fly", "SURF": "Surf", "STRENGTH": "Strength", "FLASH": "Flash",
              "WHIRLPOOL": "Whirlpool", "WATERFALL": "Waterfall", "DIG": "Dig", "TELEPORT": "Teleport",
              "SOFTBOILED": "Soft-Boiled", "MILKDRINK": "Milk Drink", "HEADBUTT": "Headbutt", "ROCKSMASH": "Rock Smash",
              "SWEETSCENT": "Sweet Scent", "DIVE": "Dive", "SECRETPOWER": "Secret Power", "DEFOG": "Defog",
              "ROCKCLIMB": "Rock Climb", "CHATTER": "Chatter"}

# What each move does once used from the menu: short summaries of the use code the row cites (FireRed's rows use the
# game's own party-menu descriptions instead). Per-game entries override the common one.
DOES = {"CUT": "cuts down a small tree", "FLY": "flies to a town you have visited", "SURF": "carries you across water",
        "STRENGTH": "pushes a boulder", "FLASH": "lights up a dark cave", "WATERFALL": "climbs up a waterfall",
        "WHIRLPOOL": "clears a whirlpool out of the way", "ROCKSMASH": "smashes a breakable rock",
        "DIVE": "dives to the seafloor at a dive spot, or resurfaces", "DEFOG": "clears the fog",
        "ROCKCLIMB": "climbs a rocky wall", "DIG": "escapes from a cave to its entrance, like an Escape Rope",
        "TELEPORT": "warps you back to the last Pokémon Center you used",
        "SOFTBOILED": "gives 1/5 of its max HP to another party Pokémon",
        "MILKDRINK": "gives 1/5 of its max HP to another party Pokémon",
        "SWEETSCENT": "lures a wild Pokémon into battle", "SECRETPOWER": "opens a Secret Base entrance",
        "HEADBUTT": "shakes a tree so a wild Pokémon may fall out",
        "CHATTER": "records a new cry for Chatot's Chatter (the record-Chatot-cry script)"}
DOES_GAME = {"crystal": {"CUT": "cuts a small tree or tall grass", "STRENGTH": "lets you push boulders on this map",
                         "SWEETSCENT": "lures a wild Pokémon into battle if the map has wild encounters"},
             "emerald": {"CUT": "cuts a small tree or tall grass", "TELEPORT": "warps you back to the last healing spot",
                         "DIG": "escapes to the entrance you came in by, like an Escape Rope"}}

HP_FIFTH = "only if the user has more than 1/5 of its max HP; then pick the party Pokémon to heal"
GEN3_MAPTYPE = "outdoors (map type route, town, city or ocean route)"
# The other conditions each cited check function enforces, summarised (the row's source cites the function).
REQUIRES = {
    "crystal": {"CUT": "facing a tree or grass tile the tileset lets you cut",
                "FLY": "outdoors (map environment ROUTE or TOWN)",
                "SURF": "facing surfable water; not already surfing; not on a must-bike road",
                "STRENGTH": None,
                "FLASH": "in a dark cave (DARKNESS_PALSET) or the Ruins of Alph Aerodactyl chamber",
                "WATERFALL": "facing up at a waterfall", "WHIRLPOOL": "facing a whirlpool",
                "DIG": "in a CAVE or DUNGEON map with an escape (dig) warp set",
                "TELEPORT": "outdoors (ROUTE or TOWN) with a valid last spawn point",
                "SOFTBOILED": HP_FIFTH, "MILKDRINK": HP_FIFTH, "HEADBUTT": "facing a headbutt tree",
                "ROCKSMASH": "facing a smashable rock", "SWEETSCENT": None},
    "firered": {"FLASH": "the map is a cave and Flash isn't already lit",
                "CUT": "facing a cuttable tree, tall grass next to you, or the Ruin Valley spot",
                "FLY": GEN3_MAPTYPE, "STRENGTH": "facing a boulder; not surfing",
                "SURF": "facing surfable water that isn't a fast current", "ROCKSMASH": "facing a breakable rock",
                "WATERFALL": "surfing north into a waterfall", "TELEPORT": GEN3_MAPTYPE,
                "DIG": "the map allows escaping (as for an Escape Rope)",
                "MILKDRINK": HP_FIFTH, "SOFTBOILED": HP_FIFTH, "SWEETSCENT": None},
    "emerald": {"CUT": "facing a cuttable tree, or cuttable grass around you (a wider square with Hyper Cutter)",
                "FLASH": "in a cave with Flash not yet lit, or at the Registeel braille spot",
                "ROCKSMASH": "facing a breakable rock, or at the Regirock braille spot",
                "STRENGTH": "facing a boulder", "SURF": "facing surfable water", "FLY": GEN3_MAPTYPE,
                "DIVE": "on a dive spot (deep water, or underwater to resurface)",
                "WATERFALL": "surfing north into a waterfall", "TELEPORT": GEN3_MAPTYPE,
                "DIG": "the map allows escaping (as for an Escape Rope)",
                "SECRETPOWER": "facing north at a secret-base cave, tree or shrub, and you don't already have a base",
                "MILKDRINK": HP_FIFTH, "SOFTBOILED": HP_FIFTH, "SWEETSCENT": None},
    "platinum": {"CUT": "facing a cuttable tree", "FLY": "the map allows Fly; no partner; not in the Safari Zone or Pal Park",
                 "SURF": "facing surfable water; not already surfing; no partner",
                 "STRENGTH": "facing a Strength boulder", "DEFOG": "the weather is fog",
                 "ROCKSMASH": "facing a breakable rock; not surfing", "WATERFALL": "facing a waterfall",
                 "ROCKCLIMB": "facing a Rock Climb wall; no partner",
                 "FLASH": "the weather is the dark-cave (Flash) weather",
                 "TELEPORT": "the map allows Teleport; no partner; not in the Safari Zone or Pal Park",
                 "DIG": "a cave map that allows an Escape Rope; no partner", "SWEETSCENT": "not in Pal Park",
                 "CHATTER": "not in the Distortion World", "MILKDRINK": HP_FIFTH, "SOFTBOILED": HP_FIFTH},
    "heartgold": {"CUT": "facing a cuttable tree",
                  "FLY": "the map allows Fly; no follower; not in the Rocket disguise; not in the Safari Zone or Pal Park",
                  "SURF": "facing surfable water; not already surfing; no follower; not in the Rocket disguise",
                  "STRENGTH": "facing a boulder; not on Ice Path B2F", "ROCKSMASH": "facing a breakable rock",
                  "WATERFALL": "surfing and facing a waterfall",
                  "ROCKCLIMB": "facing a Rock Climb wall; no follower; not in the Rocket disguise",
                  "WHIRLPOOL": "surfing and facing a whirlpool",
                  "FLASH": "the weather is the dark (Flash) weather, or at the Ruins of Alph chamber spot",
                  "TELEPORT": "the map allows Teleport; no follower; not in the Rocket disguise; not in the Safari Zone or Pal Park",
                  "DIG": "a cave map that allows an Escape Rope; no follower; not in the Rocket disguise",
                  "SWEETSCENT": "not in Pal Park", "CHATTER": None, "HEADBUTT": "facing a headbutt tree",
                  "MILKDRINK": HP_FIFTH, "SOFTBOILED": HP_FIFTH},
}


class Missing(Exception):
    """A pattern the extractor relies on wasn't found; the row or fact becomes a gap."""


# --- reading the repos ------------------------------------------------------------------------------------------------
class Repo:
    """One pret clone, read at its pinned commit from git's object store (as engine/equipment/acquire.py does)."""

    def __init__(self, root, name):
        self.name, self.dir, self.commit = name, os.path.join(root, name), COMMITS[name]
        self._data, self._tree = {}, None

    def _git(self, *args, stdin=None):
        return subprocess.run(["git", "-c", "gc.auto=0", "-C", self.dir, *args], input=stdin, capture_output=True,
                              check=True).stdout

    def tree(self):
        if self._tree is None:
            out = self._git("ls-tree", "-r", "--full-tree", self.commit).decode("utf-8", "replace")
            self._tree = {}
            for line in out.splitlines():
                meta, path = line.split("\t", 1)
                if meta.split()[1] == "blob":
                    self._tree[path] = meta.split()[2]
        return self._tree

    def match(self, regex):
        rx = re.compile(regex)
        return sorted(p for p in self.tree() if rx.search(p))

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
        paths = [p for p in dict.fromkeys(paths) if p not in self._data]
        if not paths:
            return
        self.prefetch(paths)
        out = self._git("cat-file", "--batch", stdin="".join(f"{self.commit}:{p}\n" for p in paths).encode())
        pos = 0
        for p in paths:
            nl = out.index(b"\n", pos)
            head = out[pos:nl].split()
            if head[-1] == b"missing":
                self._data[p], pos = None, nl + 1
                continue
            size = int(head[2])
            self._data[p] = out[nl + 1:nl + 1 + size]
            pos = nl + 1 + size + 1

    def blob(self, path):
        self.load([path])
        if self._data.get(path) is None:
            raise Missing(f"{self.name}@{self.commit[:8]}:{path} is not in the tree")
        return self._data[path]

    def read(self, path):
        return self.blob(path).decode("utf-8", "replace")

    def lines(self, path):
        return self.read(path).splitlines()

    def src(self, path, line=None, label=None):
        s = f"{self.name}/{path}" + (f":{line}" if line else "")
        return s + (f" {label}" if label else "")


# --- small helpers --------------------------------------------------------------------------------------------------
def key(const):
    """MOVE_SOFT_BOILED, SOFTBOILED, MOVE_SOFTBOILED -> SOFTBOILED (one key across the games' spellings)."""
    return re.sub(r"^MOVE_", "", const).replace("_", "").upper()


def move_name(const):
    return MOVE_NAMES.get(key(const)) or re.sub(r"^MOVE_", "", const).replace("_", " ").title()


def find(lines, pattern, start=0, end=None):
    """(index, match) of the first line from `start` matching `pattern`, or (None, None)."""
    rx = re.compile(pattern)
    for i in range(max(start, 0), len(lines) if end is None else min(end, len(lines))):
        m = rx.search(lines[i])
        if m:
            return i, m
    return None, None


def need(lines, pattern, what, start=0, end=None):
    i, m = find(lines, pattern, start, end)
    if i is None:
        raise Missing(what)
    return i, m


def block(lines, start_pattern, what, end_pattern=r"^\s*\};|^\}"):
    """(first, last) line indices of the table/function that opens on the line matching start_pattern."""
    i, _ = need(lines, start_pattern, what)
    j, _ = need(lines, end_pattern, f"end of {what}", i + 1)
    return i, j


def c_function(lines, name, what=None):
    """(first, last) of a C function definition (not its prototype): the body ends at the first column-0 '}'."""
    i, _ = need(lines, rf"^(static\s+)?[\w\s\*]*\b{re.escape(name)}\s*\([^;]*$", what or f"definition of {name}")
    j, _ = need(lines, r"^\}", f"end of {name}", i + 1)
    return i, j


def badge_display(word):
    return f"{word.capitalize()} Badge"


def badge_text_line(lines, word):
    """Line index of the first text that names the badge (HIVEBADGE, STONE BADGE, Forest Badge...)."""
    return find(lines, rf"(?i)\b{word} ?badge\b")[0]


def mention_line(lines, move, start=0):
    """Line index of the first quoted text from `start` that names the move (Rock Smash, ROCK SMASH, SOFTBOILED...),
    or None: the badge's own explanation usually follows the line that names it."""
    words = move.replace("-", " ").split()
    return find(lines, r'(?i)".*\b' + r"[\s\-]?".join(map(re.escape, words)) + r"\b", start)[0]


def named(line):
    """'badge named in text: ...' label from a text line (the quoted part of an asm/inc/json line)."""
    m = re.search(r'"(.*)"', line.strip())
    text = (m.group(1) if m else line.strip()).replace('\\"', '"')
    return "badge named in text: " + re.sub(r"(\\[nlpr]|\$)+$", "", text).strip()


def machine_label(k, machines, tutors, levelup, egg):
    """The machine column and its citation: TM/HM, else the tutor table, else the learnsets that teach it."""
    if k in machines:
        return machines[k]
    if k in tutors:
        return "move tutor", tutors[k]
    if k in levelup:
        if k in egg:
            return "level-up or egg move", f"{levelup[k]}; {egg[k]}"
        return "level-up only", levelup[k] + " (and in no egg-move list)"
    if k in egg:
        return "egg move only", egg[k]
    raise Missing(f"how {k} is learned (no TM/HM, tutor, level-up or egg entry)")


def row_key(row):
    """A row's move key (SOFTBOILED, ROCKSMASH...) from its display name."""
    return next((k for k, v in MOVE_NAMES.items() if v == row["move"]), key(row["move"].upper().replace(" ", "_")))


def make_row(game, const, machine, badge, badge_const, source):
    k = key(const)
    return {"move": move_name(const), "machine": machine, "badge": badge, "badge_const": badge_const,
            "requires": REQUIRES.get(game, {}).get(k), "does": DOES_GAME.get(game, {}).get(k, DOES.get(k)),
            "source": "; ".join(s for s in source if s)}


# --- Crystal --------------------------------------------------------------------------------------------------------
ASM_TOP = re.compile(r"^([A-Za-z_]\w*)::?")
ASM_END = re.compile(r"^\s*(ret|jp|jr|farjp|reti|sjump|end)\b(?!\s+(z|nz|c|nc)\b)")


def asm_labels(lines):
    """Top-level label -> line index."""
    out = {}
    for i, l in enumerate(lines):
        m = ASM_TOP.match(l)
        if m:
            out.setdefault(m.group(1), i)
    return out


def asm_body(lines, labels, name, follow_calls=True):
    """Line indices of a routine: from its label to the next top-level label, plus its fall-through (when it has no
    unconditional ret/jump at all, as DigFunction falls into EscapeRopeOrDig) and, one level deep, the bodies of the
    routines it calls or jumps to in the same file."""
    tops = sorted(labels.values())

    def span(i):
        nxt = next((t for t in tops if t > i), len(lines))
        return list(range(i, nxt)), nxt

    idx, nxt = span(labels[name])
    code = [lines[j].split(";")[0].strip() for j in idx if lines[j].split(";")[0].strip()]
    if code and not any(ASM_END.match(c) for c in code) and nxt < len(lines):
        more, _ = span(nxt)
        idx += more
    if follow_calls:
        for j in list(idx):
            m = re.match(r"\s*(?:far)?(?:call|jp|jr)\s+(?:(?:z|nz|c|nc),\s*)?([A-Za-z_]\w*)\s*$", lines[j].split(";")[0])
            if m and m.group(1) in labels and m.group(1) != name:
                idx += [k for k in asm_body(lines, labels, m.group(1), False) if k not in idx]
    return idx


def crystal_badge_check(lines, body):
    """(ENGINE_*BADGE, line index) of `ld de, ENGINE_X` followed by `call/farcall CheckBadge` in the body."""
    for j in body:
        m = re.match(r"\s*ld de, (ENGINE_\w+BADGE)\b", lines[j])
        if m and any(re.match(r"\s*(far)?call CheckBadge\b", lines[k]) for k in range(j + 1, min(j + 3, len(lines)))):
            return m.group(1), j
    return None, None


def crystal(repo):
    rows, notes, gaps = [], [], []
    menu_p, act_p, sub_p = "data/mon_menu.asm", "engine/pokemon/mon_menu.asm", "engine/pokemon/mon_submenu.asm"
    item_p, evo_p, egg_p = "constants/item_constants.asm", "data/pokemon/evos_attacks.asm", "data/pokemon/egg_moves.asm"
    code_files = repo.match(r"^engine/(events|items)/[^/]+\.asm$")
    maps = repo.match(r"^maps/[^/]+\.asm$")
    repo.load([menu_p, act_p, sub_p, item_p, evo_p, egg_p] + code_files + maps)

    menu = repo.lines(menu_p)
    entries = [(i, m.group(1), m.group(2)) for i, l in enumerate(menu)
               for m in [re.match(r"\s*db MONMENU_FIELD_MOVE,\s*(MONMENUITEM_\w+),\s*(\w+)", l)] if m]
    if not entries:
        raise Missing("MonMenuOptions field-move rows")
    act = repo.lines(act_p)
    p0, _ = need(act, r"^PokemonActionSubmenu:", "PokemonActionSubmenu")
    a0, _ = need(act, r"^\.Actions:", "PokemonActionSubmenu.Actions", p0)
    handlers = {m.group(1): (i, m.group(2)) for i, l in enumerate(act[a0:a0 + 40], a0)
                for m in [re.match(r"\s*dbw (MONMENUITEM_\w+),\s*(\w+)", l)] if m}
    act_labels = asm_labels(act)
    files = {p: repo.lines(p) for p in code_files}
    defined = {name: (p, i) for p, ls in files.items() for name, i in asm_labels(ls).items()}

    machines, tutors = crystal_machines(repo, item_p)
    levelup, egg = crystal_learnsets(repo, evo_p, egg_p)
    badges = crystal_badges(repo, maps)

    for i, item, const in entries:
        try:
            src = [repo.src(menu_p, i + 1, f"MonMenuOptions: MONMENU_FIELD_MOVE, {item}, {const}")]
            if item not in handlers:
                raise Missing(f"PokemonActionSubmenu.Actions entry for {item}")
            hi, handler = handlers[item]
            hb = asm_body(act, act_labels, handler, False)
            fn = next((m.group(1) for j in hb for m in [re.match(r"\s*farcall (\w+)", act[j])] if m), None)
            if not fn or fn not in defined:
                raise Missing(f"the field function {handler} calls")
            fpath, fline = defined[fn]
            src.append(repo.src(act_p, hi + 1, f"PokemonActionSubmenu.Actions: {item} -> {handler} (farcall {fn})"))
            flines = files[fpath]
            body = asm_body(flines, asm_labels(flines), fn)
            bconst, bline = crystal_badge_check(flines, body)
            if bconst:
                src.append(repo.src(fpath, bline + 1, f"{fn}: ld de, {bconst} / call CheckBadge"))
                name, bsrc = badges.get(bconst, (None, None))
                if not name:
                    gaps.append(f"crystal: {move_name(const)}: where {bconst} is awarded and its name wasn't found")
                    name = badge_display(bconst[len("ENGINE_"):-len("BADGE")])
                src.append(bsrc)
                mention = badges.get(bconst + "/text")
                if mention:
                    j = mention_line(mention[1], move_name(const), mention[2])
                    if j is not None:
                        src.append(repo.src(mention[0], j + 1, f"badge text mentions {move_name(const)}"))
            else:
                name = "none"
                src.append(repo.src(fpath, fline + 1, f"{fn} (no CheckBadge in its body or the routines it calls)"))
            if handler == "MonMenu_Softboiled_MilkDrink":
                j, _ = need(act, r"^\.CheckMonHasEnoughHP:", "MonMenu_Softboiled_MilkDrink.CheckMonHasEnoughHP", hi)
                src.append(repo.src(act_p, j + 1, f"{handler}.CheckMonHasEnoughHP (HP vs max HP / 5)"))
            label, msrc = machine_label(key(const), machines, tutors, levelup, egg)
            src.append(msrc)
            rows.append(make_row("crystal", const, label, name, bconst, src))
        except Missing as e:
            gaps.append(f"crystal: {const}: {e}")

    sub = repo.lines(sub_p)
    j, _ = find(sub, r"^GetMonSubmenuItems:")
    k, _ = find(sub, r"ld a, \[wLinkMode\]", j or 0)
    if k is not None:
        notes.append(f"crystal: field moves are only added to a Pokémon's menu when not in link mode and not an Egg "
                     f"({repo.src(sub_p, k + 1, 'GetMonSubmenuItems: ld a, [wLinkMode]')}).")
    notes.append(crystal_overworld(repo, files, rows))
    return rows, notes, gaps


def crystal_machines(repo, path):
    """TM/HM/tutor numbers by the order of add_tm / add_hm / add_mt in item_constants.asm."""
    lines = repo.lines(path)
    machines, tutors, n = {}, {}, {"tm": 0, "hm": 0, "mt": 0}
    for i, l in enumerate(lines):
        m = re.match(r"\s*add_(tm|hm|mt)\s+(\w+)", l)
        if m:
            kind, mv = m.groups()
            n[kind] += 1
            label = f"{kind.upper()}{n[kind]:02d}"
            if kind == "mt":
                tutors[key(mv)] = repo.src(path, i + 1, f"add_mt {mv} (move tutor {n[kind]})")
            else:
                machines[key(mv)] = (label, repo.src(path, i + 1, f"add_{kind} {mv} ({label})"))
    if not n["tm"] or not n["hm"]:
        raise Missing("add_tm / add_hm lists")
    return machines, tutors


def crystal_learnsets(repo, evo_p, egg_p):
    levelup, egg = {}, {}
    for path, table, rx, suffix in ((evo_p, levelup, r"^\s*db\s+\d+,\s*([A-Z][A-Z0-9_]*)\s*(;.*)?$", "EvosAttacks"),
                                    (egg_p, egg, r"^\s*db\s+([A-Z][A-Z0-9_]*)\s*(;.*)?$", "EggMoves")):
        label = None
        for i, l in enumerate(repo.lines(path)):
            m = re.match(rf"^(\w+){suffix}:", l)
            if m:
                label = m.group(1)
                continue
            m = re.match(rx, l)
            if m and label:
                what = "level-up" if suffix == "EvosAttacks" else "egg move"
                table.setdefault(key(m.group(1)), repo.src(path, i + 1, f"{label}{suffix}: {m.group(1)} ({what})"))
    return levelup, egg


def crystal_badges(repo, maps):
    """ENGINE_*BADGE -> (display name, citation of where it is set and the text naming it)."""
    out = {}
    for p in maps:
        lines = repo.lines(p)
        for i, l in enumerate(lines):
            m = re.match(r"\s*setflag (ENGINE_(\w+)BADGE)\b", l)
            if m and m.group(1) not in out:
                word = m.group(2)
                t = badge_text_line(lines, word)
                cite = repo.src(p, i + 1, f"setflag {m.group(1)}")
                if t is not None:
                    cite += f"; {repo.src(p, t + 1, named(lines[t]))}"
                out[m.group(1)] = (badge_display(word), cite)
                out[m.group(1) + "/text"] = (p, lines, t if t is not None else i)
    return out


def crystal_overworld(repo, files, rows):
    """The overworld prompts (Try*OW) and the engine flag each tests, compared with the party-menu badge."""
    path = "engine/events/overworld.asm"
    lines = files.get(path)
    if lines is None:
        return "crystal: engine/events/overworld.asm not read; overworld prompts not compared"
    labels = asm_labels(lines)
    menu = {row_key(r): r["badge_const"] for r in rows}
    parts = []
    for name, i in sorted(labels.items(), key=lambda kv: kv[1]):
        m = re.match(r"Try(\w+)OW$", name)
        if not m:
            continue
        k = key(re.sub(r"(?<!^)(?=[A-Z])", "_", m.group(1)).upper())
        body = asm_body(lines, labels, name, False)
        flag = next((mm.group(1) for j in body for mm in [re.match(r"\s*ld de, (ENGINE_\w+BADGE)", lines[j])] if mm), None)
        verdict = "same as the menu" if flag == menu.get(k) else f"menu tests {menu.get(k)}"
        parts.append(f"{name} {flag or 'no badge test'} ({verdict}, {repo.src(path, i + 1)})")
        OW_COMPARED.setdefault("crystal", set()).add(k)
    return "crystal: overworld prompts: " + "; ".join(parts) + "."


# --- FireRed / Emerald ----------------------------------------------------------------------------------------------
def gen3(repo, game):
    rows, notes, gaps = [], [], []
    pm, pmh = "src/party_menu.c", "src/data/party_menu.h"
    const_pm, flags_p, items_p = "include/constants/party_menu.h", "include/constants/flags.h", "include/constants/items.h"
    tmhm_p, strings_p = "include/constants/tms_hms.h", "src/strings.c"
    learn = ["src/data/pokemon/tutor_learnsets.h", "src/data/pokemon/level_up_learnsets.h", "src/data/pokemon/egg_moves.h"]
    csrc = repo.match(r"^src/[^/]+\.c$")
    scripts = repo.match(r"^data/maps/[^/]+/scripts\.inc$")
    ow = [p for p in ("data/scripts/field_move_scripts.inc", "data/scripts/field_moves.inc") if repo.has(p)]
    repo.load([pm, pmh, const_pm, flags_p, items_p, strings_p] + ([tmhm_p] if repo.has(tmhm_p) else []) + learn + csrc
              + scripts + ow)
    L = repo.lines(pm)
    H = repo.lines(pmh)

    order = gen3_order(repo, L, pm, const_pm)                     # [(FIELD_MOVE_X, path, line)]
    index = {fm: n for n, (fm, _, _) in enumerate(order)}
    moves = gen3_field_moves(repo, H, pmh, order)                  # FIELD_MOVE_X -> (MOVE_Y, line)
    callbacks = {m.group(1): (i, m.group(2)) for i, l in enumerate(H)
                 for m in [re.match(r"\s*\[(FIELD_MOVE_\w+)\]\s*=\s*\{(SetUpFieldMove_\w+),", l)] if m}
    bi, bm = need(L, r"fieldMove <= (FIELD_MOVE_\w+) && FlagGet\((FLAG_BADGE(\d+)_GET) \+ fieldMove\)",
                  "CursorCb_FieldMove badge test")
    limit, base_flag, base_n = bm.group(1), bm.group(2), int(bm.group(3))
    cb_i, _ = find(L, r"^static void CursorC[bB]_FieldMove\(u8 taskId\)$")
    flag_lines = repo.lines(flags_p)
    badges = gen3_badges(repo, scripts)
    defs = {}
    for p in csrc:
        for i, l in enumerate(repo.lines(p)):
            m = re.match(r"^(?:static\s+)?bool8\s+(SetUpFieldMove_\w+)\(void\)\s*$", l)
            if m:
                defs.setdefault(m.group(1), (p, i))
    machines = gen3_machines(repo, H, pmh, items_p, tmhm_p)
    tutors, levelup, egg = gen3_learnsets(repo, *learn)
    descs = gen3_descriptions(repo, H, pmh, strings_p)

    for fm, opath, oline in order:
        try:
            if fm not in moves:
                raise Missing(f"sFieldMoves entry for {fm}")
            const, mline = moves[fm]
            src = [repo.src(pmh, mline + 1, f"sFieldMoves: {fm} = {const}")]
            if fm not in callbacks:
                raise Missing(f"sFieldMoveCursorCallbacks entry for {fm}")
            ci, func = callbacks[fm]
            src.append(repo.src(pmh, ci + 1, f"sFieldMoveCursorCallbacks: {fm} -> {func}"))
            if func in defs:
                src.append(repo.src(defs[func][0], defs[func][1] + 1, func))
            else:
                gaps.append(f"{game}: definition of {func} not found")
            if index[fm] <= index[limit]:
                flag = f"FLAG_BADGE{base_n + index[fm]:02d}_GET"
                fi, _ = need(flag_lines, rf"#define {flag}\b", f"{flag} in flags.h")
                src.append(repo.src(pm, bi + 1, f"CursorCb_FieldMove: {fm} ({index[fm]}) <= {limit} -> FlagGet({base_flag} + "
                                                f"{index[fm]}) = {flag}"))
                src.append(repo.src(flags_p, fi + 1, f"#define {flag}"))
                if flag not in badges:
                    raise Missing(f"which gym sets {flag}")
                name, bsrc, bpath, blines, at = badges[flag]
                src.append(bsrc)
                j = mention_line(blines, move_name(const), at)
                if j is not None:
                    src.append(repo.src(bpath, j + 1, f"badge text mentions {move_name(const)}"))
            else:
                name, flag = "none", None
                src.append(repo.src(pm, bi + 1, f"CursorCb_FieldMove: {fm} ({index[fm]}) > {limit}, so no badge test"))
            label, msrc = machine_label(key(const), machines, tutors, levelup, egg)
            src.append(msrc)
            row = make_row(game, const, label, name, flag, src)
            if fm in descs:
                row["does"], dsrc = descs[fm]
                row["source"] += f"; {dsrc}"
            rows.append(row)
        except Missing as e:
            gaps.append(f"{game}: {fm}: {e}")

    li, _ = find(L, r"MenuHelpers_IsLinkActive\(\) == TRUE \|\| InUnionRoom\(\) == TRUE", cb_i or 0)
    link = (f" In a link or the Union Room every field move only says it can't be used "
            f"({repo.src(pm, li + 1, 'MenuHelpers_IsLinkActive || InUnionRoom')}).") if li is not None else ""
    notes.append(f"{game}: the party menu tests badges by position: a field move whose FIELD_MOVE_* index is at most "
                 f"{limit} needs FLAG_BADGE(01 + index)_GET ({repo.src(pm, bi + 1, 'CursorCb_FieldMove')}); every later "
                 f"one has no badge test." + link)
    notes.append(gen3_overworld(repo, game, ow, rows))
    return rows, notes, gaps


def gen3_order(repo, L, pm, const_pm):
    """The FIELD_MOVE_* order: Emerald's enum in party_menu.c, FireRed's #defines in constants/party_menu.h."""
    i, _ = find(L, r"^\s*FIELD_MOVE_CUT,")
    if i is not None:
        out = []
        for j in range(i, len(L)):
            m = re.match(r"\s*(FIELD_MOVE_\w+),", L[j])
            if not m or m.group(1) in ("FIELD_MOVES_COUNT",):
                break
            out.append((m.group(1), pm, j))
        return out
    C = repo.lines(const_pm)
    defs = [(int(m.group(2)), m.group(1), j) for j, l in enumerate(C)
            for m in [re.match(r"#define (FIELD_MOVE_\w+)\s+(\d+)", l)] if m and m.group(1) != "FIELD_MOVE_END"]
    if not defs:
        raise Missing("FIELD_MOVE_* order")
    return [(name, const_pm, j) for _, name, j in sorted(defs)]


def gen3_field_moves(repo, H, pmh, order):
    """FIELD_MOVE_X -> (MOVE_Y, line index) from sFieldMoves (designated initialisers, or a positional list)."""
    a, b = block(H, r"static const u16 sFieldMoves\[", "sFieldMoves")
    out, pos = {}, []
    for j in range(a, b + 1):
        for m in re.finditer(r"\[(FIELD_MOVE_\w+)\]\s*=\s*(MOVE_\w+)", H[j]):
            out[m.group(1)] = (m.group(2), j)
        if not out:
            pos += [(m.group(1), j) for m in re.finditer(r"\b(MOVE_\w+)", H[j].split("//")[0])]
    if not out:
        for (fm, _, _), mv in zip(order, pos):
            out[fm] = mv
    return out


def gen3_badges(repo, scripts):
    """FLAG_BADGEnn_GET -> (display name, citation, text path, text lines): the map script that sets it and the badge's
    name in that map's text ("received the STONE BADGE", or the BADGE name it mentions most)."""
    out = {}
    for p in scripts:
        lines = repo.lines(p)
        for i, l in enumerate(lines):
            m = re.match(r"\s*setflag (FLAG_BADGE\d\d_GET)\b", l)
            if not m or m.group(1) in out:
                continue
            text_p = p.replace("scripts.inc", "text.inc")
            texts = [(p, lines)] + ([(text_p, repo.lines(text_p))] if repo.has(text_p) else [])
            hit = None
            for tp, tl in texts:
                j, mm = find(tl, r"received the ([A-Z]+) ?BADGE\b")
                if j is not None:
                    hit = (tp, tl, j, mm.group(1))
                    break
            if not hit:
                counts, first = Counter(), {}
                for tp, tl in texts:
                    for j, t in enumerate(tl):
                        for mm in re.finditer(r"\b([A-Z]{3,}) ?BADGE\b", t):
                            if mm.group(1) not in ("GYM", "LEAGUE", "THE", "THIS", "THAT", "YOUR", "EACH", "ALL"):
                                counts[mm.group(1)] += 1
                                first.setdefault(mm.group(1), (tp, tl, j))
                if counts:
                    word = counts.most_common(1)[0][0]
                    hit = first[word] + (word,)
            cite = repo.src(p, i + 1, f"setflag {m.group(1)}")
            if hit:
                tp, tl, j, word = hit
                cite += f"; {repo.src(tp, j + 1, named(tl[j]))}"
                out[m.group(1)] = (badge_display(word), cite, tp, tl, j)
    return out


def gen3_machines(repo, H, pmh, items_p, tmhm_p):
    """key -> (TMnn/HMnn, citation): Emerald's FOREACH_TM / FOREACH_HM, FireRed's sTMHMMoves split at
    NUM_TECHNICAL_MACHINES."""
    out = {}
    if repo.has(tmhm_p):
        T = repo.lines(tmhm_p)
        for kind in ("TM", "HM"):
            a, _ = need(T, rf"#define FOREACH_{kind}\(F\)", f"FOREACH_{kind}")
            n = 0
            for j in range(a + 1, len(T)):
                m = re.search(r"F\((\w+)\)", T[j])
                if not m:
                    break
                n += 1
                out[key(m.group(1))] = (f"{kind}{n:02d}", repo.src(tmhm_p, j + 1, f"FOREACH_{kind}: F({m.group(1)}) ({kind}{n:02d})"))
                if not T[j].rstrip().endswith("\\"):
                    break
        return out
    I = repo.lines(items_p)
    _, m = need(I, r"#define NUM_TECHNICAL_MACHINES\s+(\d+)", "NUM_TECHNICAL_MACHINES")
    ntm = int(m.group(1))
    a, b = block(H, r"static const u16 sTMHMMoves\[\]", "sTMHMMoves")
    n = 0
    for j in range(a + 1, b):
        for mm in re.finditer(r"\b(MOVE_\w+)", H[j]):
            n += 1
            label = f"TM{n:02d}" if n <= ntm else f"HM{n - ntm:02d}"
            out.setdefault(key(mm.group(1)), (label, repo.src(pmh, j + 1, f"sTMHMMoves[{n - 1}] {mm.group(1)} ({label}, "
                                                                           f"NUM_TECHNICAL_MACHINES {ntm})")))
    return out


def gen3_learnsets(repo, tutor_p, lvl_p, egg_p):
    tutors, levelup, egg = {}, {}, {}
    T = repo.lines(tutor_p)
    a, b = block(T, r"u16 [gs]TutorMoves\[", "tutor move table")
    for j in range(a, b + 1):
        m = re.search(r"\[(TUTOR_MOVE_\w+)\]\s*=\s*(MOVE_\w+)", T[j])
        if m:
            tutors[key(m.group(2))] = repo.src(tutor_p, j + 1, f"tutor move table: {m.group(1)} = {m.group(2)}")
    label = None
    for j, l in enumerate(repo.lines(lvl_p)):
        m = re.search(r"\bs(\w+)LevelUpLearnset\[\]", l)
        if m:
            label = m.group(1)
        m = re.search(r"LEVEL_UP_MOVE\(\s*\d+,\s*(MOVE_\w+)\)", l)
        if m:
            levelup.setdefault(key(m.group(1)), repo.src(lvl_p, j + 1, f"s{label}LevelUpLearnset: {m.group(1)} (level-up)"))
    label = None
    for j, l in enumerate(repo.lines(egg_p)):
        m = re.search(r"egg_moves\((\w+),", l)
        if m:
            label = m.group(1)
        for mm in re.finditer(r"\b(MOVE_\w+)", l):
            egg.setdefault(key(mm.group(1)), repo.src(egg_p, j + 1, f"egg_moves({label}): {mm.group(1)}"))
    return tutors, levelup, egg


def gen3_descriptions(repo, H, pmh, strings_p):
    """FireRed's party-menu description for each field move: sFieldMoveDescriptionTable -> src/strings.c."""
    i, _ = find(H, r"sFieldMoveDescriptionTable\[\]")
    if i is None:
        return {}
    S = repo.lines(strings_p)
    out = {}
    for j in range(i, len(H)):
        if re.match(r"\s*\};", H[j]):
            break
        m = re.search(r"\[(FIELD_MOVE_\w+)\]\s*=\s*(gText_\w+)", H[j])
        if m:
            k, mm = find(S, rf"\b{m.group(2)}\[\] = _\(\"(.*)\"\);")
            if k is not None:
                out[m.group(1)] = (mm.group(1), repo.src(pmh, j + 1, f"sFieldMoveDescriptionTable: {m.group(1)} = {m.group(2)}")
                                   + "; " + repo.src(strings_p, k + 1, f"{m.group(2)} {json.dumps(mm.group(1))}"))
    return out


def gen3_overworld(repo, game, ow, rows):
    """The overworld prompts' badge tests (field-move scripts, and the C checks in field_control_avatar.c), compared
    with the party menu's."""
    menu = {row_key(r): r["badge_const"] for r in rows}
    parts = []
    for p in ow:
        lines = repo.lines(p)
        for i, l in enumerate(lines):
            m = re.match(r"\s*checkpartymove (MOVE_\w+)", l)
            if not m:
                continue
            flag = next((mm.group(1) for k in range(max(i - 3, 0), min(i + 3, len(lines)))
                         for mm in [re.search(r"goto_if_unset (FLAG_BADGE\d\d_GET)", lines[k])] if mm), None)
            if flag:
                k = key(m.group(1))
                same = "same as the menu" if menu.get(k) == flag else f"menu tests {menu.get(k)}"
                parts.append(f"{move_name(m.group(1))} {flag} ({same}, {repo.src(p, i + 1)})")
                OW_COMPARED.setdefault(game, set()).add(k)
    fca = "src/field_control_avatar.c"
    if repo.has(fca):
        lines = repo.lines(fca)
        cues = (("PartyHasMonWithSurf", "SURF"), ("IsPlayerSurfingNorth", "WATERFALL"), ("TrySetDiveWarp", "DIVE"))
        for i, l in enumerate(lines):
            m = re.search(r"FlagGet\((FLAG_BADGE\d\d_GET)\)", l)
            k = next((mv for cue, mv in cues if cue in l), None)
            if m and k and k in menu:
                same = "same as the menu" if menu[k] == m.group(1) else f"menu tests {menu[k]}"
                parts.append(f"{MOVE_NAMES[k]} {m.group(1)} ({same}, {repo.src(fca, i + 1)})")
                OW_COMPARED.setdefault(game, set()).add(k)
    return f"{game}: overworld prompts: " + ("; ".join(dict.fromkeys(parts)) or "none found") + "."


# --- Platinum -------------------------------------------------------------------------------------------------------
def platinum(repo):
    rows, notes, gaps = [], [], []
    enum_p, main_p, tasks_p = "include/field_move_tasks.h", "src/applications/party_menu/main.c", "src/field_move_tasks.c"
    ctx_p, badges_p, tutor_p, ow_p = ("src/applications/party_menu/context_menu.c", "generated/badges.txt",
                                      "res/pokemon/move_tutors.json", "res/field/scripts/scripts_field_moves.s")
    machine_ps = repo.match(r"^res/items/data/(tm|hm)\d\d\.json$")
    species_ps = repo.match(r"^res/pokemon/[^/]+/data\.json$")
    scripts = repo.match(r"^res/field/scripts/scripts_[^/]+\.s$")
    repo.load([enum_p, main_p, tasks_p, ctx_p, badges_p, tutor_p, ow_p] + machine_ps + species_ps + scripts)

    E = repo.lines(enum_p)
    i0, _ = need(E, r"^\s*FIELD_MOVE_CUT,", "enum FieldMoveList")
    order = []
    for j in range(i0, len(E)):
        m = re.match(r"\s*(FIELD_MOVE_\w+),?", E[j])
        if not m or m.group(1) == "FIELD_MOVE_MAX":
            break
        order.append((m.group(1), j))
    M = repo.lines(main_p)
    a, b = block(M, r"static const u16 sFieldMoves\[", "sFieldMoves")
    moves = {m.group(1): (m.group(2), j) for j in range(a, b) for m in [re.search(r"\[(FIELD_MOVE_\w+)\] = (MOVE_\w+)", M[j])] if m}
    T = repo.lines(tasks_p)
    a, b = block(T, r"fieldMoveTaskOrError\[\] = \{", "fieldMoveTaskOrError")
    table = [(m.group(1), m.group(2), j) for j in range(a, b)
             for m in [re.search(r"\{\s*(FieldMoves_Set\w+Task),\s*(FieldMoves_Check\w+)\s*\}", T[j])] if m]
    C = repo.lines(ctx_p)
    badge_lines = repo.read(badges_p).splitlines()
    badges = gen4_badges(repo, scripts, r"\s*GiveBadge (BADGE_ID_(\w+))",
                         lambda p: f"res/text/{os.path.basename(p)[len('scripts_'):-2]}.json")
    machines = {}
    for p in machine_ps:
        L = repo.lines(p)
        j, m = find(L, r'"teachesMove":\s*"(MOVE_\w+)"')
        if j is not None:
            label = os.path.basename(p)[:-5].upper()
            machines[key(m.group(1))] = (label, repo.src(p, j + 1, f"teachesMove {m.group(1)} ({label})"))
    tutors = {key(m.group(1)): repo.src(tutor_p, j + 1, f"move tutor: {m.group(1)}")
              for j, l in enumerate(repo.lines(tutor_p)) for m in [re.search(r'"move":\s*"(MOVE_\w+)"', l)] if m}
    levelup, egg = platinum_learnsets(repo, species_ps)

    for n, (fm, ei) in enumerate(order):
        try:
            if fm not in moves:
                raise Missing(f"sFieldMoves entry for {fm}")
            const, mline = moves[fm]
            src = [repo.src(main_p, mline + 1, f"sFieldMoves: {fm} = {const}")]
            bconst, name = None, "none"
            if n < len(table):
                setter, check, tj = table[n]
                src.append(repo.src(tasks_p, tj + 1, f"fieldMoveTaskOrError[{n}] ({fm}): {setter}, {check}"))
                ca, cb = c_function(T, check)
                bj, bm = find(T, r"PlayerHasRequiredBadge\(fieldMoveContext, (BADGE_ID_\w+)\)", ca, cb)
                if bj is not None:
                    bconst = bm.group(1)
                    src.append(repo.src(tasks_p, bj + 1, f"{check}: PlayerHasRequiredBadge({bconst})"))
                else:
                    src.append(repo.src(tasks_p, ca + 1, f"{check} (no badge test)"))
                sa, _ = c_function(T, setter)
                src.append(repo.src(tasks_p, sa + 1, setter))
            else:
                fname = "PartyMenu_Select" + "".join(w.capitalize() for w in fm[len("FIELD_MOVE_"):].split("_"))
                fa, _ = c_function(C, fname)
                hj, _ = need(C, r"maxHP / 5", "the max HP / 5 test")
                src.append(repo.src(ctx_p, fa + 1, f"{fname} (no badge test, past the end of fieldMoveTaskOrError)"))
                src.append(repo.src(ctx_p, hj + 1, "PartyMenu_StartFieldMoveHPTransfer: curHP <= maxHP / 5 -> not enough HP"))
            if bconst:
                word = bconst[len("BADGE_ID_"):]
                name = badge_display(word)
                k, _ = find(badge_lines, rf"^{bconst}$")
                if k is not None:
                    src.append(repo.src(badges_p, k + 1, f"{bconst} (enum Badge {k})"))
                if bconst in badges:
                    src.append(badges[bconst][0])
                    tpath, tlines, at = badges[bconst][1]
                    j = mention_line(tlines, move_name(const), at) if tlines else None
                    if j is not None:
                        src.append(repo.src(tpath, j + 1, f"badge text mentions {move_name(const)}"))
                else:
                    gaps.append(f"platinum: where {bconst} is given (GiveBadge) wasn't found")
            label, msrc = machine_label(key(const), machines, tutors, levelup, egg)
            src.append(msrc)
            rows.append(make_row("platinum", const, label, name, bconst, src))
        except Missing as e:
            gaps.append(f"platinum: {fm}: {e}")

    j, _ = find(T, r"mapLoadType == MAP_LOAD_TYPE_COLOSSEUM")
    notes.append(f"platinum: every field-move check except Milk Drink/Softboiled first refuses in the Union Room and "
                 f"Colosseum ({repo.src(tasks_p, (j or 0) + 1, 'PlayerOutsideLinkRoom: mapLoadType == MAP_LOAD_TYPE_COLOSSEUM')}); "
                 f"Milk Drink and Softboiled have "
                 f"no entry in fieldMoveTaskOrError and are handled by the party menu's HP transfer.")
    notes.append(gen4_overworld(repo, "platinum", ow_p, r"FindPartySlotWithMove VAR_RESULT, (MOVE_\w+)",
                                r"CheckBadgeAcquired (BADGE_ID_\w+)", rows))
    return rows, notes, gaps


def platinum_learnsets(repo, species_ps):
    """key -> first citation, from each species' data.json learnset (by_level and egg_moves)."""
    levelup, egg = {}, {}
    for p in species_ps:
        section = None
        for j, l in enumerate(repo.lines(p)):
            m = re.search(r'"(by_level|by_tm|by_tutor|egg_moves|evolutions|offspring)"\s*:', l)
            if m:
                section = m.group(1)
            sp = p.split("/")[2]
            if section == "by_level":
                mm = re.search(r'\[\s*\d+,\s*"(MOVE_\w+)"\s*\]', l)
                if mm:
                    levelup.setdefault(key(mm.group(1)), repo.src(p, j + 1, f"{sp} learnset.by_level: {mm.group(1)} (level-up)"))
            elif section == "egg_moves":
                for mm in re.finditer(r'"(MOVE_\w+)"', l):
                    egg.setdefault(key(mm.group(1)), repo.src(p, j + 1, f"{sp} learnset.egg_moves: {mm.group(1)}"))
    return levelup, egg


def gen4_badges(repo, scripts, give_rx, text_of):
    """BADGE const -> (citation of the GiveBadge and the text naming the badge, (text path, text lines))."""
    found = {}
    for p in sorted(scripts, key=lambda s: ("_dp_" in s, s)):
        for i, l in enumerate(repo.lines(p)):
            m = re.match(give_rx, l)
            if m and m.group(1) not in found:
                found[m.group(1)] = (p, i, m.group(2))
    texts = {text_of(p) for p, _, _ in found.values()}
    texts = {t for t in texts if t and repo.has(t)}
    repo.load(sorted(texts))
    out = {}
    for const, (p, i, word) in found.items():
        cite = repo.src(p, i + 1, f"GiveBadge {const}")
        tp = text_of(p)
        tl = repo.lines(tp) if tp in texts else None
        j = badge_text_line(tl, word) if tl else None
        if j is not None:
            cite += f"; {repo.src(tp, j + 1, named(tl[j]))}"
        out[const] = (cite, (tp, tl if j is not None else None, j))
    return out


def gen4_overworld(repo, game, path, move_rx, badge_rx, rows):
    """The overworld prompt scripts' badge tests (a party-move lookup followed within 4 lines by a badge check),
    compared with the party menu's."""
    if not repo.has(path):
        return f"{game}: {path} not found; overworld prompts not compared"
    menu = {row_key(r): r["badge_const"] for r in rows}
    lines = repo.lines(path)
    parts = []
    for i, l in enumerate(lines):
        m = re.search(move_rx, l)
        if not m:
            continue
        b = next((mm.group(1) for k in range(i + 1, min(i + 5, len(lines))) for mm in [re.search(badge_rx, lines[k])] if mm), None)
        if b:
            k = key(m.group(1))
            same = "same as the menu" if menu.get(k) == b else f"menu tests {menu.get(k)}"
            parts.append(f"{move_name(m.group(1))} {b} ({same}, {repo.src(path, i + 1)})")
            OW_COMPARED.setdefault(game, set()).add(k)
    return f"{game}: overworld prompts: " + ("; ".join(parts) or "none found") + "."


# --- HeartGold / SoulSilver -----------------------------------------------------------------------------------------
def heartgold(repo):
    rows, notes, gaps = [], [], []
    hdr_p, pm_p, li_p, fm_p = "include/party_menu.h", "src/party_menu.c", "src/party_menu_list_items.c", "src/field_move.c"
    badge_p, item_p, tutor_p = "include/constants/badge.h", "src/item.c", "src/field/scrcmd_move_tutor.c"
    moves_p, species_p, wotbl_p, egg_p = ("include/constants/moves.h", "include/constants/species.h",
                                          "files/poketool/personal/wotbl.narc", "files/fielddata/sodateya/kowaza_list.narc")
    ow_p = "files/fielddata/script/scr_seq/scr_seq_0146.s"
    scripts = repo.match(r"^files/fielddata/script/scr_seq/scr_seq_[^/]+\.s$")
    repo.load([hdr_p, pm_p, li_p, fm_p, badge_p, item_p, tutor_p, moves_p, species_p, wotbl_p, egg_p] + scripts)

    Hd = repo.lines(hdr_p)
    i0, _ = need(Hd, r"^\s*PARTY_MON_CONTEXT_MENU_CUT,", "PartyMonContextMenuItem field moves")
    items = []
    for j in range(i0, len(Hd)):
        m = re.match(r"\s*PARTY_MON_CONTEXT_MENU_(\w+),", Hd[j])
        if not m or m.group(1) == "MAX":
            break
        items.append(m.group(1))
    r0, _ = need(Hd, r"^\s*PARTY_MENU_ACTION_RETURN_CUT,", "PartyMenuActionReturn field moves")
    returns = []
    for j in range(r0, len(Hd)):
        m = re.match(r"\s*PARTY_MENU_ACTION_RETURN_(\w+),", Hd[j])
        if not m:
            break
        returns.append((m.group(1), j))
    P = repo.lines(pm_p)
    a, b = block(P, r"static const u16 sFieldMoves\[", "sFieldMoves")
    menu_moves = [(m.group(1), j) for j in range(a + 1, b) for m in [re.search(r"\b(MOVE_\w+)", P[j])] if m]
    F = repo.lines(fm_p)
    a, b = block(F, r"static const FieldMoveFuncData sFieldMoveFuncTable\[\] = \{", "sFieldMoveFuncTable")
    table = [(m.group(1), m.group(2), j) for j in range(a, b)
             for m in [re.search(r"\{\s*(FieldMove_Use\w+),\s*(FieldMove_Check\w+)\s*\}", F[j])] if m]
    LI = repo.lines(li_p)
    B = repo.lines(badge_p)
    badges = gen4_badges(repo, scripts, r"\s*GiveBadge (BADGE_(\w+))", lambda p: hg_msg_bank(repo, p))
    machines = {}
    for j, l in enumerate(repo.lines(item_p)):
        m = re.search(r"\b(MOVE_\w+),\s*//\s*((TM|HM)\d+)", l)
        if m:
            machines.setdefault(key(m.group(1)), (m.group(2), repo.src(item_p, j + 1, f"sTMHMMoves: {m.group(1)} // {m.group(2)}")))
    T = repo.lines(tutor_p)
    a, b = block(T, r"static const TutorMove sTutorMoves\[\] = \{", "sTutorMoves")
    tutors = {key(m.group(1)): repo.src(tutor_p, j + 1, f"sTutorMoves: {m.group(1)}, {m.group(2)}")
              for j in range(a, b) for m in [re.search(r"\{\s*(MOVE_\w+),\s*\d+,\s*(\w+)\s*\}", T[j])] if m}
    levelup, egg = hg_learnsets(repo, moves_p, species_p, wotbl_p, egg_p)

    for n, item in enumerate(items):
        try:
            if n >= len(menu_moves):
                raise Missing(f"sFieldMoves entry for PARTY_MON_CONTEXT_MENU_{item}")
            const, mline = menu_moves[n]
            src = [repo.src(pm_p, mline + 1, f"sFieldMoves[{n}] {const} -> PARTY_MON_CONTEXT_MENU_{item}")]
            act = "PartyMonContextMenuAction_" + "".join(w.capitalize() for w in item.split("_"))
            act_i, act_m = find(LI, rf"^static void {act}\(")
            ret_names = [r for r, _ in returns]
            ri = ret_names.index(item) if item in ret_names else None
            bconst, name = None, "none"
            if act_i is not None:
                src.append(repo.src(li_p, act_i + 1, act))
            if ri is not None and ri < len(table):
                use, check, tj = table[ri]
                src.append(repo.src(fm_p, tj + 1, f"sFieldMoveFuncTable[{ri}] (PARTY_MENU_ACTION_RETURN_{item} - CUT): "
                                                   f"{use}, {check}"))
                ca, cb = c_function(F, check)
                bj, bm = find(F, r"PlayerProfile_TestBadgeFlag\(.*,\s*(BADGE_\w+)\)", ca, cb)
                if bj is not None:
                    bconst = bm.group(1)
                    src.append(repo.src(fm_p, bj + 1, f"{check}: PlayerProfile_TestBadgeFlag({bconst})"))
                else:
                    src.append(repo.src(fm_p, ca + 1, f"{check} (no badge test)"))
                ua, _ = c_function(F, use)
                src.append(repo.src(fm_p, ua + 1, use))
            else:
                hj, _ = need(LI, r"maxHp / 5", "the max HP / 5 test")
                src.append(repo.src(li_p, hj + 1, "PartyMonContextMenuAction_TransferHP: hp <= maxHp / 5 -> not enough HP "
                                                  "(no badge test, past the end of sFieldMoveFuncTable)"))
            if bconst:
                word = bconst[len("BADGE_"):]
                name = badge_display(word)
                k, _ = find(B, rf"#define {bconst}\b")
                if k is not None:
                    src.append(repo.src(badge_p, k + 1, f"#define {bconst}"))
                if bconst in badges:
                    src.append(badges[bconst][0])
                    tpath, tlines, at = badges[bconst][1]
                    j = mention_line(tlines, move_name(const), at) if tlines else None
                    if j is not None:
                        src.append(repo.src(tpath, j + 1, f"badge text mentions {move_name(const)}"))
                else:
                    gaps.append(f"heartgold: where {bconst} is given (GiveBadge) wasn't found")
            label, msrc = machine_label(key(const), machines, tutors, levelup, egg)
            src.append(msrc)
            rows.append(make_row("heartgold", const, label, name, bconst, src))
        except Missing as e:
            gaps.append(f"heartgold: {item}: {e}")

    j, _ = find(F, r"mapLoadType == MAP_LOAD_TYPE_UNION")
    notes.append(f"heartgold: every field-move check first refuses in the Union Room and Colosseum "
                 f"({repo.src(fm_p, (j or 0) + 1, 'FieldMove_CheckCut: mapLoadType == MAP_LOAD_TYPE_UNION, as in every FieldMove_Check*')}); "
                 f"Waterfall and Whirlpool test that you are "
                 f"surfing before the badge, so without surfing they say \"can't use here\", not \"need a badge\".")
    version = [repo.src(p, i + 1) for p in (hdr_p, pm_p, li_p, fm_p, item_p, tutor_p, badge_p)
               for i, l in enumerate(repo.lines(p)) if re.search(r"GAME_VERSION|GetGameVersion|gGameVersion|VERSION_(HEART|SOUL)", l)]
    notes.append("heartgold: " + ("no GetGameVersion/GAME_VERSION test in the field-move, party-menu, TM, tutor or badge "
                                  "code read, so these checks are the same in SoulSilver (it is built from the same "
                                  "files)." if not version else "version tests found at " + "; ".join(version)
                                  + " - check them for SoulSilver differences."))
    notes.append(gen4_overworld(repo, "heartgold", ow_p, r"GetPartySlotWithMove VAR_SPECIAL_RESULT, (MOVE_\w+)",
                                r"CheckBadge (BADGE_\w+)", rows))
    return rows, notes, gaps


def hg_msg_bank(repo, script):
    """The message bank a scr_seq script #includes ("msgdata/msg/msg_0567_T23GYM0102.h") -> its .json."""
    i, m = find(repo.lines(script), r'#include "msgdata/msg/(\w+)\.h"')
    return f"files/msgdata/msg/{m.group(1)}.json" if i is not None else None


def narc_members(data):
    """The member files of a Nitro archive (NARC: BTAF offsets, BTNF names, GMIF data)."""
    if data[:4] != b"NARC":
        raise Missing("not a NARC archive")
    off = struct.unpack_from("<H", data, 12)[0]
    if data[off:off + 4] != b"BTAF":
        raise Missing("NARC without BTAF")
    size, count = struct.unpack_from("<IH", data, off + 4)
    spans = [struct.unpack_from("<II", data, off + 12 + 8 * k) for k in range(count)]
    btnf = off + size
    gmif = btnf + struct.unpack_from("<I", data, btnf + 4)[0]
    if data[gmif:gmif + 4] != b"GMIF":
        raise Missing("NARC without GMIF")
    return [data[gmif + 8 + s:gmif + 8 + e] for s, e in spans]


def hg_learnsets(repo, moves_p, species_p, wotbl_p, egg_p):
    """Level-up learnsets (wotbl.narc: one member per species/form, u16 entries move | level << 9, ended by 0xFFFF;
    include/pokemon.h) and egg moves (kowaza_list.narc: one u16 list, 20000 + species then its moves; src/get_egg.c)."""
    move_ids = {int(m.group(2)): m.group(1) for l in repo.lines(moves_p)
                for m in [re.match(r"#define (MOVE_\w+)\s+(\d+)\b", l)] if m}
    species = {int(m.group(2)): m.group(1) for l in repo.lines(species_p)
               for m in [re.match(r"#define (SPECIES_\w+)\s+(\d+)\b", l)] if m}
    levelup, egg = {}, {}
    for n, member in enumerate(narc_members(repo.blob(wotbl_p))):
        for (v,) in struct.iter_unpack("<H", member[:len(member) // 2 * 2]):
            if v == 0xFFFF:
                break
            mv = move_ids.get(v & 0x1FF)
            if mv:
                levelup.setdefault(key(mv), repo.src(wotbl_p, None, f"member {n} ({species.get(n, 'form ' + str(n))}): "
                                                                     f"{mv} at level {v >> 9} (level-up)"))
    members = narc_members(repo.blob(egg_p))
    cur = None
    for (v,) in struct.iter_unpack("<H", members[0][:len(members[0]) // 2 * 2]):
        if v == 0xFFFF:
            break
        if v > 20000:
            cur = species.get(v - 20000, str(v - 20000))
        elif cur and v in move_ids:
            egg.setdefault(key(move_ids[v]), repo.src(egg_p, None, f"{cur}: {move_ids[v]} (egg move)"))
    return levelup, egg


# --- the whole ------------------------------------------------------------------------------------------------------
OW_COMPARED = {}   # game -> move keys whose overworld prompt's badge test was found and compared (filled as games run)
EXTRACT = {"crystal": crystal, "firered": lambda r: gen3(r, "firered"), "emerald": lambda r: gen3(r, "emerald"),
           "platinum": platinum, "heartgold": heartgold}


def compare(games):
    """Source-backed remarks across games: the same move with a different badge or machine."""
    out = []
    by = {g: {r["move"]: r for r in rows} for g, rows in games.items()}
    for a, b in (("crystal", "heartgold"), ("firered", "emerald"), ("platinum", "heartgold")):
        diffs = []
        for mv in by.get(a, {}):
            if mv in by.get(b, {}):
                ra, rb = by[a][mv], by[b][mv]
                for f in ("badge", "machine"):
                    if ra[f] != rb[f]:
                        diffs.append(f"{mv} {f} {ra[f]} -> {rb[f]}")
        only_a = sorted(set(by.get(a, {})) - set(by.get(b, {})))
        only_b = sorted(set(by.get(b, {})) - set(by.get(a, {})))
        out.append(f"{a} vs {b}: " + ("; ".join(diffs) or "same badges and machines for shared moves")
                   + (f"; only in {a}: {', '.join(only_a)}" if only_a else "")
                   + (f"; only in {b}: {', '.join(only_b)}" if only_b else "") + ".")
    return out


def build(root=PRET):
    games, notes, gaps = {}, [], []
    for game, name in GAMES.items():
        repo = Repo(root, name)
        try:
            rows, g_notes, g_gaps = EXTRACT[game](repo)
        except Missing as e:
            rows, g_notes, g_gaps = [], [], [f"{game}: {e}; no rows extracted"]
        games[game] = rows
        notes += [n for n in g_notes if n]
        gaps += g_gaps
    notes += compare(games)
    by = {g: {r["move"]: r for r in rows} for g, rows in games.items()}
    cr, hg = by.get("crystal", {}), by.get("heartgold", {})
    if (cr.get("Flash", {}).get("badge_const") == "ENGINE_ZEPHYRBADGE" and hg.get("Flash", {}).get("badge") == "none"
            and hg.get("Rock Smash", {}).get("badge_const") == "BADGE_ZEPHYR"):
        notes.append("memory vs code: I expected HeartGold to keep Crystal's pairing of the Zephyr Badge with Flash; its "
                     "code tests no badge for Flash (now TM70) and tests the Zephyr Badge for Rock Smash (now HM06), and "
                     "Falkner's badge text says the same (see the Rock Smash row). The code wins; nothing else extracted "
                     "here contradicted what I recalled.")
    for game, rows in games.items():
        left = [r["move"] for r in rows if r["badge_const"] and row_key(r) not in OW_COMPARED.get(game, set())]
        if left:
            gaps.append(f"{game}: the overworld prompt's own badge test (walking up to the obstacle) wasn't found or "
                        f"compared for: {', '.join(left)} (some have no prompt at all, e.g. Fly); the party-menu test in "
                        f"the row is unaffected.")
    gaps += ["all: \"does\" and \"requires\" are short summaries of the cited check/use code, written by hand (only "
             "FireRed has its own field-move descriptions, used verbatim); the citations, badges, machines and the "
             "field-move lists are parsed from the code.",
             "all: \"level-up only\" / \"level-up or egg move\" / \"move tutor\" weigh only the TM/HM table, the game's "
             "move-tutor table and the level-up and egg-move learnsets; event, trade-back, Sketch and Pokéwalker "
             "sources aren't considered.",
             "heartgold: the scripted tutors outside sTutorMoves (Blast Burn, Hydro Cannon, Frenzy Plant, Draco "
             "Meteor in scr_seq_0948_T30R0601.s) weren't read; none is a field move.",
             "heartgold: the level-up and egg learnsets come from the binary wotbl.narc and kowaza_list.narc at the "
             "pinned commit (decoded as include/pokemon.h and src/get_egg.c describe); their citations name the "
             "archive member, not a line."]
    return {"_note": "Built by engine/capability/field_functions.py from the pret decompilations at the commits below. "
                     "One row per move the game's party menu offers outside battle, in the game's own table order. "
                     "badge/badge_const: what the party-menu path tests before the move runs (\"none\"/null when "
                     "nothing is tested); machine: TM/HM number, else how the move is learned; requires/does: short "
                     "summaries of the cited code; source: file:line and label for each fact. SoulSilver shares "
                     "HeartGold's code.",
            "commits": dict(COMMITS), "games": games, "notes": notes, "gaps": gaps}


def main(argv):
    root, out = PRET, OUT
    if "--pret" in argv:
        root = argv[argv.index("--pret") + 1]
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
    doc = build(root)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(out)
    for game, rows in doc["games"].items():
        print(f"  {game:10} {len(rows):2} field moves: " + ", ".join(
            f"{r['move']} ({r['machine']}, {r['badge']})" for r in rows))
    print(f"  {len(doc['gaps'])} gaps, {len(doc['notes'])} notes")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
