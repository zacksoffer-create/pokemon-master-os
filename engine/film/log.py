"""Reading one Showdown replay (docs/FILM.md): the battle's protocol log, line by line, into a Battle.

A Battle has two sides. Each side keeps its members in the order they came in, and each member keeps what the
battle revealed about it:
- its species, level and gender;
- its moves in the order it first showed them, and how often it chose each;
- the item it started with (read through Trick, Knock Off and berries) and its ability;
- its stints on the field (how it came in, the moves it used in order, how it left);
- its knockouts, the damage it dealt and took, and the turn it fell.

Every chosen action (a move, or a switch the player picked) is a row with the game state just before it:
- the Pokémon and HP left on each side, and whether the side acting is even, ahead or behind;
- who was on the field, the weather, the hazards on each side and the active boosts;
- what the action did (damage, a knockout, a status, a boost, a hazard, a miss).

The log is Showdown's battle protocol (SIM-PROTOCOL.md in smogon/pokemon-showdown). Chat lines are skipped and
never stored. The parser needs nothing but the log; reading moves into the role engine's categories is the
study's job (film/study.py), given here as an optional `group_of(move)`.
"""
import re

TAG = re.compile(r"^\[(\w+)\]\s*(.*)$")
IDENT = re.compile(r"^(p[1-4])[a-z]?: (.+)$")
SIDE_IDENT = re.compile(r"^(p[1-4]): ?(.*)$")
HAZARDS = ("Stealth Rock", "Spikes", "Toxic Spikes", "Sticky Web")
SCREENS = ("Reflect", "Light Screen", "Safeguard", "Mist", "Tailwind", "Lucky Chant", "Aurora Veil")
RESIDUAL = {"brn", "psn", "tox", "Sandstorm", "Hail", "Leech Seed", "confusion", "Curse", "Nightmare",
            "Stealth Rock", "Spikes", "Recoil", "Struggle"}
SELF_KO = {"Explosion", "Self-Destruct", "Memento", "Healing Wish", "Lunar Dance", "Final Gambit"}
PIVOTS = {"U-turn": "pivot", "Volt Switch": "pivot", "Flip Turn": "pivot", "Parting Shot": "pivot",
          "Teleport": "pivot", "Baton Pass": "baton"}
SKIP = {"c", "chat", "c:", "j", "J", "l", "L", "n", "N", "raw", "html", "uhtml", "uhtmlchange", "inactive",
        "inactiveoff", "t:", "debug", "seed", "badge", "join", "leave", "name", "spectator", "spectatorleave"}


def split(line):
    """'|move|p1a: Uxie|Trick|p2a: Swampert|[miss]' → ('move', ['p1a: Uxie', 'Trick', 'p2a: Swampert'], {'miss': ''})"""
    parts = line.split("|")
    if len(parts) < 2:
        return None, [], {}
    args, tags = [], {}
    for a in parts[2:]:
        m = TAG.match(a)
        if m:
            tags[m.group(1)] = m.group(2)
        else:
            args.append(a)
    return parts[1], args, tags


def hp_of(text):
    """'53/100 par' → (0.53, 'par'); '0 fnt' → (0.0, 'fnt')."""
    bits = (text or "").split()
    if not bits:
        return None, None
    status = bits[1] if len(bits) > 1 else None
    if bits[0] == "0":
        return 0.0, status or "fnt"
    a, _, b = bits[0].partition("/")
    try:
        return (int(a) / int(b) if b else float(a) / 100), status
    except ValueError:
        return None, status


def _plain(effect):
    """'move: Stealth Rock' → 'Stealth Rock'; 'item: Leftovers' → 'Leftovers'."""
    return effect.split(": ", 1)[1] if ": " in (effect or "") else (effect or "")


class Member:
    def __init__(self, side, nickname, order, turn):
        self.side, self.nickname, self.order, self.first_turn = side, nickname, order, turn
        self.species = self.form = None
        self.level, self.gender, self.shiny = 100, None, False
        self.moves, self.uses, self.called = [], {}, []
        self.item = self.item_now = self.item_how = None
        self.traded = None                      # the action row that swapped its item away (Trick)
        self.ability = None
        self.hp, self.status = 1.0, None
        self.fainted_turn = self.fainted_by = None
        self.kos, self.stints = [], []
        self.damage_dealt = self.damage_taken = 0.0
        self.turns_active = 0
        self.cant = {}

    def reveal_move(self, move, chosen=True, called=False):
        if move not in self.moves and move != "Struggle":
            self.moves.append(move)
        if called and move not in self.called:
            self.called.append(move)
        if chosen:
            self.uses[move] = self.uses.get(move, 0) + 1

    def start_item(self, item, how, row=None):
        """The item it held when the battle began, if what's revealed can still be that one (a Trick reveals both
        starting items in the same action)."""
        if self.item is None and (self.traded is None or self.traded == row):
            self.item, self.item_how = item, how

    def to_dict(self):
        d = {k: v for k, v in vars(self).items() if k not in ("side",)}
        d["damage_dealt"], d["damage_taken"] = round(self.damage_dealt, 3), round(self.damage_taken, 3)
        d["hp"] = round(self.hp, 3) if self.hp is not None else None
        return d


class Side:
    def __init__(self, sid):
        self.id, self.player, self.rating, self.teamsize = sid, None, None, 6
        self.members, self.order = {}, []
        self.active = None
        self.fainted = 0
        self.hazards, self.screens, self.boosts = {}, set(), {}
        self.hazard_by = {}
        self.forced = False                     # a member fainted: the next switch replaces it
        self.pursued = False                    # Pursuit hit a member switching out: its chosen switch goes on
        self.pivot = None                       # the U-turn / Baton Pass this turn, before its switch shows

    def member(self, nickname, turn):
        if nickname not in self.members:
            self.members[nickname] = Member(self.id, nickname, len(self.order) + 1, turn)
            self.order.append(nickname)
        return self.members[nickname]

    def alive(self):
        return self.teamsize - self.fainted

    def hp_total(self):
        seen = sum(m.hp or 0.0 for m in self.members.values())
        return seen + max(0, self.teamsize - len(self.members))


class Battle:
    def __init__(self, meta=None, state_cfg=None, group_of=None):
        self.meta = dict(meta or {})
        self.state_cfg = state_cfg or {"ahead_by_alive": 1, "hp_margin": 1.0}
        self.group_of = group_of or (lambda move: None)
        self.sides = {"p1": Side("p1"), "p2": Side("p2")}
        self.gen = self.meta.get("gen")
        self.tier = None
        self.rules = []
        self.turn = 0
        self.weather = None
        self.rows = []
        self.winner = None
        self.forfeit = False
        self.ended = False
        self.last_ko = None
        self.current = None                     # the move row whose effects are being read
        self.last_hit = {}                      # (side, nickname) → what last damaged it
        self.bond = {}                          # side → member that used Destiny Bond this turn

    # --- reading ------------------------------------------------------------------------------------------
    def feed(self, log):
        for line in log.splitlines():
            cmd, args, tags = split(line)
            if not cmd or cmd in SKIP:
                continue
            handler = getattr(self, "on_" + cmd.lstrip("-").replace("-", "_"), None)
            if handler:
                handler(args, tags)
        if not self.ended:
            self._end_turn()
        return self

    def who(self, ident, create=False):
        m = IDENT.match(ident or "")
        if not m:
            return None, None
        side = self.sides.get(m.group(1))
        if side is None:
            return None, None
        nick = m.group(2).strip()
        if nick not in side.members and not create:
            return side, None
        return side, side.member(nick, self.turn)

    def foe(self, side):
        return self.sides["p2" if side.id == "p1" else "p1"]

    def snapshot(self, side):
        foe = self.foe(side)
        alive, alive_foe = side.alive(), foe.alive()
        hp, hp_foe = side.hp_total(), foe.hp_total()
        diff, margin = alive - alive_foe, hp - hp_foe
        if diff >= self.state_cfg["ahead_by_alive"]:
            state = "ahead"
        elif diff <= -self.state_cfg["ahead_by_alive"]:
            state = "behind"
        elif margin >= self.state_cfg["hp_margin"]:
            state = "ahead"
        elif margin <= -self.state_cfg["hp_margin"]:
            state = "behind"
        else:
            state = "even"
        act = side.members.get(side.active)
        foe_act = foe.members.get(foe.active)
        return {"state": state, "alive": alive, "alive_foe": alive_foe, "hp": round(hp, 2), "hp_foe": round(hp_foe, 2),
                "active": act.species if act else None, "active_hp": round(act.hp, 2) if act and act.hp is not None else None,
                "foe_active": foe_act.species if foe_act else None,
                "foe_hp": round(foe_act.hp, 2) if foe_act and foe_act.hp is not None else None,
                "weather": self.weather, "hazards": dict(side.hazards), "hazards_foe": dict(foe.hazards),
                "boosts": dict(side.boosts), "boosts_foe": dict(foe.boosts)}

    def _row(self, side, kind, **kw):
        row = {"n": len(self.rows) + 1, "turn": self.turn, "side": side.id, "player": side.player, "kind": kind,
               **kw, "before": self.snapshot(side), "result": {}}
        self.rows.append(row)
        return row

    # --- the battle's frame ---------------------------------------------------------------------------------
    def on_player(self, args, tags):
        if not args or args[0] not in self.sides:
            return
        side = self.sides[args[0]]
        if len(args) > 1 and args[1]:
            side.player = args[1]
        if len(args) > 3 and args[3].strip().isdigit():
            side.rating = int(args[3])

    def on_teamsize(self, args, tags):
        if len(args) > 1 and args[0] in self.sides:
            self.sides[args[0]].teamsize = int(args[1])

    def on_gen(self, args, tags):
        self.gen = int(args[0]) if args and args[0].isdigit() else self.gen

    def on_tier(self, args, tags):
        self.tier = args[0] if args else None

    def on_rule(self, args, tags):
        if args:
            self.rules.append(args[0].split(":")[0])

    def on_turn(self, args, tags):
        self._end_turn()
        self.turn = int(args[0]) if args and args[0].isdigit() else self.turn + 1

    def _end_turn(self):
        if self.turn >= 1:
            for side in self.sides.values():
                m = side.members.get(side.active)
                if m and m.fainted_turn is None:
                    m.turns_active += 1
        for side in self.sides.values():
            side.pivot = None
            side.pursued = False
        self.current = None
        self.bond = {}

    def on_upkeep(self, args, tags):
        self.current = None

    def on_win(self, args, tags):
        name = args[0] if args else None
        self.winner = next((s.id for s in self.sides.values() if s.player == name), None)
        self._close_stints("end")
        self.ended = True
        self._end_turn()

    def on_tie(self, args, tags):
        self._close_stints("end")
        self.ended = True
        self._end_turn()

    def on_message(self, args, tags):
        if args and args[0].endswith("forfeited."):
            self.forfeit = True

    def on_hint(self, args, tags):
        pass

    # --- switches ------------------------------------------------------------------------------------------
    def _close_stints(self, how):
        for side in self.sides.values():
            m = side.members.get(side.active)
            if m and m.stints and m.stints[-1].get("out") is None:
                m.stints[-1].update(out=how, out_turn=self.turn)

    def on_switch(self, args, tags, dragged=False):
        side, m = self.who(args[0] if args else "", create=True)
        if side is None:
            return
        details = (args[1] if len(args) > 1 else "").split(", ")
        prev = side.members.get(side.active)
        if m.species is None:
            m.species = details[0]
            for d in details[1:]:
                if re.fullmatch(r"L\d+", d):
                    m.level = int(d[1:])
                elif d in ("M", "F"):
                    m.gender = d
                elif d == "shiny":
                    m.shiny = True
        m.form = details[0]
        if self.turn == 0:
            how = "lead"
        elif dragged:
            how = "dragged"
        elif side.pursued:
            how = "voluntary"
        elif tags.get("from") in PIVOTS or side.pivot:
            how = PIVOTS.get(tags.get("from"), side.pivot or "pivot")
        elif side.forced:
            how = "forced"
        else:
            how = "voluntary"
        if how not in ("lead", "dragged"):
            self._row(side, "switch", how=how, actor=prev.species if prev else None, into=m.species,
                      out_hp=round(prev.hp, 2) if prev and prev.hp is not None else None)
        if prev and prev is not m and prev.stints and prev.stints[-1].get("out") is None:
            prev.stints[-1].update(out={"forced": "fainted", "pivot": "pivoted", "baton": "passed",
                                        "dragged": "dragged"}.get(how, "switched"), out_turn=self.turn)
        if how != "baton":
            side.boosts = {}
        side.active = m.nickname
        side.forced = side.pursued = False
        side.pivot = None
        hp, status = hp_of(args[2] if len(args) > 2 else "")
        if hp is not None:
            m.hp = hp
        m.status = status if status != "fnt" else m.status
        facing = self.foe(side).members.get(self.foe(side).active)
        m.stints.append({"in": how, "in_turn": self.turn, "moves": [], "out": None, "out_turn": None,
                         "facing": facing.species if facing else None})
        self.current = None

    def on_drag(self, args, tags):
        self.on_switch(args, tags, dragged=True)

    def on_replace(self, args, tags):
        side, m = self.who(args[0] if args else "", create=True)
        if m and m.species is None and len(args) > 1:
            m.species = args[1].split(", ")[0]

    def on_detailschange(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m and len(args) > 1:
            m.form = args[1].split(", ")[0]

    on_formechange = on_detailschange

    # --- moves ---------------------------------------------------------------------------------------------
    def on_move(self, args, tags):
        side, m = self.who(args[0] if args else "", create=True)
        if m is None or len(args) < 2:
            return
        move = args[1]
        frm = _plain(tags.get("from", ""))
        locked = tags.get("from", "").replace(" ", "") == "lockedmove"
        called = frm in CALLERS
        chosen = not locked and not called
        m.reveal_move(move, chosen=chosen, called=called)
        tside, target = self.who(args[2] if len(args) > 2 else "")
        row = self._row(side, "move", actor=m.species, move=move,
                        target=target.species if target and tside is not side else None,
                        group=self.group_of(move), chosen=chosen, locked=locked or None,
                        called_by=frm if called else None, miss=("miss" in tags) or None)
        if m.stints:
            m.stints[-1]["moves"].append(move)
        if move in PIVOTS and chosen:
            side.pivot = PIVOTS[move]
        self.current = {"row": row, "side": side, "actor": m, "target": target if tside is not side else None}

    def on_cant(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m and len(args) > 1:
            m.cant[args[1]] = m.cant.get(args[1], 0) + 1
        self.current = None

    def _result(self):
        return self.current["row"]["result"] if self.current else None

    def on_damage(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None:
            return
        before = m.hp if m.hp is not None else 1.0
        hp, status = hp_of(args[1] if len(args) > 1 else "")
        if hp is None:
            return
        lost = max(0.0, before - hp)
        m.hp = hp
        m.damage_taken += lost
        frm = tags.get("from", "")
        if frm:
            self.last_hit[(side.id, m.nickname)] = _plain(frm)
            self._learn_from(frm, tags, m)
            if frm == "Recoil" and self.current and self.current["actor"] is m:
                self.current["row"]["result"]["recoil"] = round(self.current["row"]["result"].get("recoil", 0) + lost, 3)
            return
        cur = self.current
        if cur and cur["actor"].side != side.id:
            r = cur["row"]["result"]
            r["damage"] = round(r.get("damage", 0) + lost, 3)
            cur["actor"].damage_dealt += lost
            self.last_hit[(side.id, m.nickname)] = ("move", cur["side"].id, cur["actor"].nickname, cur["row"]["move"])

    def on_sethp(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m:
            hp, _ = hp_of(args[1] if len(args) > 1 else "")
            if hp is not None:
                m.hp = hp

    def on_heal(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None:
            return
        before = m.hp if m.hp is not None else 0.0
        hp, status = hp_of(args[1] if len(args) > 1 else "")
        if hp is None:
            return
        m.hp = hp
        frm = tags.get("from", "")
        if frm:
            self._learn_from(frm, tags, m)
        elif self.current and self.current["actor"] is m:
            r = self.current["row"]["result"]
            r["healed"] = round(r.get("healed", 0) + max(0.0, hp - before), 3)

    def _learn_from(self, frm, tags, m):
        """A [from] tag names an item or ability: whose it is."""
        kind, _, name = frm.partition(": ")
        if kind == "item":
            m.start_item(name, "seen")
            m.item_now = name
        elif kind == "ability":
            owner = m
            if tags.get("of"):
                _, o = self.who(tags["of"])
                owner = o or m
            owner.ability = owner.ability or name

    def on_faint(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None or m.fainted_turn is not None:
            return
        m.fainted_turn, m.hp = self.turn, 0.0
        side.fainted += 1
        side.forced = True
        if m.stints and m.stints[-1].get("out") is None:
            m.stints[-1].update(out="fainted", out_turn=self.turn)
        cause = self.last_hit.get((side.id, m.nickname))
        cur = self.current
        by = None
        if cur and cur["actor"] is m and (cur["row"].get("group") == "self_ko" or cur["row"]["move"] in SELF_KO):
            m.fainted_by = "self: " + cur["row"]["move"]
        elif self.bond.get(self.foe(side).id) and cur and cur["actor"] is m:
            by = (self.foe(side), self.bond[self.foe(side).id], "Destiny Bond")
        elif isinstance(cause, tuple) and cause[0] == "move":
            by = (self.sides[cause[1]], self.sides[cause[1]].members[cause[2]], cause[3])
        elif cause in HAZARDS and self.foe(side).hazard_by.get(cause):
            by = (self.foe(side), self.foe(side).hazard_by[cause], cause)
        else:
            m.fainted_by = cause if isinstance(cause, str) else None
        if by and by[1] is not None:
            bside, killer, how = by
            killer.kos.append({"turn": self.turn, "target": m.species, "by": how})
            m.fainted_by = f"{killer.species} ({how})"
            self.last_ko = {"side": bside.id, "species": killer.species, "turn": self.turn, "target": m.species, "by": how}
            if cur and cur["actor"] is killer:
                cur["row"]["result"]["ko"] = m.species
        elif not m.fainted_by:
            m.fainted_by = "unknown"

    def on_status(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None or len(args) < 2:
            return
        m.status = args[1]
        frm = tags.get("from", "")
        if frm:
            self._learn_from(frm, tags, m)
        elif self.current and self.current["actor"].side != side.id:
            self.current["row"]["result"]["status"] = args[1]

    def on_curestatus(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None:
            return
        m.status = None
        frm = tags.get("from", "")
        if frm:
            self._learn_from(frm, tags, m)

    def on_cureteam(self, args, tags):
        side, _ = self.who(args[0] if args else "")
        for mm in (side.members.values() if side else ()):
            mm.status = None

    def on_boost(self, args, tags, sign=1):
        side, m = self.who(args[0] if args else "")
        if m is None or len(args) < 3:
            return
        n = sign * int(args[2]) if args[2].lstrip("-").isdigit() else 0
        if side.active == m.nickname:
            side.boosts[args[1]] = side.boosts.get(args[1], 0) + n
        if tags.get("from"):
            self._learn_from(tags["from"], tags, m)
        elif self.current and self.current["actor"] is m:
            b = self.current["row"]["result"].setdefault("boosts", {})
            b[args[1]] = b.get(args[1], 0) + n
        elif self.current and self.current["actor"].side != side.id:
            b = self.current["row"]["result"].setdefault("foe_boosts", {})
            b[args[1]] = b.get(args[1], 0) + n

    def on_unboost(self, args, tags):
        self.on_boost(args, tags, sign=-1)

    def on_setboost(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m and len(args) > 2 and args[2].lstrip("-").isdigit():
            side.boosts[args[1]] = int(args[2])
            if self.current and self.current["actor"] is m:
                self.current["row"]["result"].setdefault("boosts", {})[args[1]] = int(args[2])

    def on_clearallboost(self, args, tags):
        for side in self.sides.values():
            side.boosts = {}

    def on_clearboost(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if side and m and side.active == m.nickname:
            side.boosts = {}

    def on_sidestart(self, args, tags):
        m = SIDE_IDENT.match(args[0] if args else "")
        if not m or len(args) < 2:
            return
        side, what = self.sides[m.group(1)], _plain(args[1])
        if what in HAZARDS:
            side.hazards[what] = side.hazards.get(what, 0) + 1
            if self.current and self.current["side"] is not side:
                self.current["row"]["result"]["hazard"] = what
                self.foe(side).hazard_by[what] = self.current["actor"]
        else:
            side.screens.add(what)
            if self.current and self.current["side"] is side:
                self.current["row"]["result"]["screen"] = what

    def on_sideend(self, args, tags):
        m = SIDE_IDENT.match(args[0] if args else "")
        if not m or len(args) < 2:
            return
        side, what = self.sides[m.group(1)], _plain(args[1])
        side.hazards.pop(what, None)
        side.screens.discard(what)
        if self.current and self.current["side"] is side and what in HAZARDS:
            self.current["row"]["result"].setdefault("cleared", []).append(what)

    def on_weather(self, args, tags):
        w = args[0] if args else "none"
        self.weather = None if w == "none" else w
        if tags.get("from"):
            _, m = self.who(tags.get("of", ""))
            if m and tags["from"].startswith("ability: "):
                m.ability = m.ability or _plain(tags["from"])
        elif "upkeep" not in tags and self.current and self.weather:
            self.current["row"]["result"]["weather"] = self.weather

    def on_item(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None or len(args) < 2:
            return
        item, frm = args[1], _plain(tags.get("from", ""))
        if frm in ("Trick", "Switcheroo", "Thief", "Covet", "Bestow"):
            cur = self.current
            n = cur["row"]["n"] if cur else None
            other = None
            if cur:
                other = cur["target"] if cur["actor"] is m else cur["actor"]
            if other is not None:
                other.start_item(item, f"{frm} revealed it", row=n)
                other.traded = other.traded or n
            if frm in ("Trick", "Switcheroo"):
                m.traded = m.traded or n
            m.item_now = item
            if cur and cur["actor"] is m:
                cur["row"]["result"]["took"] = item
        else:
            if tags.get("from", "").startswith("ability: ") and tags.get("of"):
                _, o = self.who(tags["of"])
                if o:
                    o.ability = o.ability or _plain(tags["from"])
            m.start_item(item, "seen")
            m.item_now = item

    def on_enditem(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None or len(args) < 2:
            return
        item, frm = args[1], _plain(tags.get("from", ""))
        m.start_item(item, "used up" if ("eat" in tags or "consumed" in tags) else (f"{frm}" if frm else "used up"))
        m.item_now = None
        if frm in ("Knock Off",) and self.current:
            self.current["row"]["result"]["knocked_off"] = item

    def on_ability(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None or len(args) < 2:
            return
        frm = tags.get("from", "")
        if frm == "ability: Trace":
            m.ability = m.ability or "Trace"
            _, o = self.who(tags.get("of", ""))
            if o:
                o.ability = o.ability or args[1]
        elif "move" in frm:
            return                              # Skill Swap, Role Play: not its own
        else:
            m.ability = m.ability or args[1]

    def on_activate(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m is None or len(args) < 2:
            return
        effect = args[1]
        if effect.startswith("ability: "):
            m.ability = m.ability or _plain(effect)
        elif effect.startswith("item: "):
            m.start_item(_plain(effect), "seen")
        elif effect == "move: Pursuit":
            side.pursued = True
        elif effect in ("move: Destiny Bond", "Destiny Bond"):
            self.bond[side.id] = m

    def on_singlemove(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m and len(args) > 1 and args[1] == "Destiny Bond":
            self.bond[side.id] = m

    def on_immune(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m and tags.get("from"):
            self._learn_from(tags["from"], tags, m)
        if self.current:
            self.current["row"]["result"]["immune"] = True

    def on_start(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m and tags.get("from"):
            self._learn_from(tags["from"], tags, m)
        if m and self.current and len(args) > 1 and self.current["actor"].side != side.id:
            self.current["row"]["result"].setdefault("effects", []).append(_plain(args[1]))

    def on_miss(self, args, tags):
        if self.current:
            self.current["row"]["result"]["miss"] = True

    def on_fail(self, args, tags):
        if self.current:
            self.current["row"]["result"]["fail"] = True

    def on_crit(self, args, tags):
        if self.current:
            self.current["row"]["result"]["crit"] = True

    def on_supereffective(self, args, tags):
        if self.current:
            self.current["row"]["result"]["effect"] = "super"

    def on_resisted(self, args, tags):
        if self.current:
            self.current["row"]["result"]["effect"] = "resisted"

    def on_ohko(self, args, tags):
        if self.current:
            self.current["row"]["result"]["ohko"] = True

    def on_hitcount(self, args, tags):
        if self.current and len(args) > 1 and args[1].isdigit():
            self.current["row"]["result"]["hits"] = int(args[1])

    def on_transform(self, args, tags):
        side, m = self.who(args[0] if args else "")
        if m:
            m.cant["transformed"] = m.cant.get("transformed", 0) + 1

    # --- out ----------------------------------------------------------------------------------------------
    def to_dict(self):
        sides = {}
        for sid, s in self.sides.items():
            members = [s.members[n].to_dict() for n in s.order]
            sides[sid] = {"player": s.player, "rating": s.rating, "teamsize": s.teamsize,
                          "order": [s.members[n].species for n in s.order], "unseen": max(0, s.teamsize - len(s.order)),
                          "fainted": s.fainted, "members": members, "won": self.winner == sid}
        return {"meta": self.meta, "gen": self.gen, "tier": self.tier, "rules": self.rules, "turns": self.turn,
                "winner": self.winner, "forfeit": self.forfeit, "last_ko": self.last_ko, "sides": sides,
                "rows": self.rows}


CALLERS = {"Sleep Talk", "Metronome", "Assist", "Copycat", "Mirror Move", "Me First", "Magic Coat", "Snatch",
           "Nature Power"}


def parse(log, meta=None, state_cfg=None, group_of=None, callers=None):
    """One replay log → the battle as plain data (Battle.to_dict())."""
    global CALLERS
    if callers:
        CALLERS = set(callers)
    return Battle(meta, state_cfg, group_of).feed(log).to_dict()
