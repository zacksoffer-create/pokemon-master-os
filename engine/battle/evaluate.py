"""The evaluation layer (scouting engine, layer 2): what happens when two Pokémon meet.

A matchup is played out as a small, deterministic one-on-one. Each turn both sides pick a move, the higher priority
(then the faster side) goes first, and the end of the turn ticks: weather, Wish, Leftovers, Leech Seed, poison,
burn, Speed Boost, Yawn. Damage comes from Smogon's calculator at the exact state of the hit: boosts, burn, weather,
a pinch ability like Blaze. Two rules keep it deterministic:
- every hit uses the **lowest damage roll**;
- every move **lands**. The chance that all of a side's moves land is kept as its *odds*.

Each side plays a **plan**. A plan is an opening (moves it uses first: a boost, a status move, Substitute, a screen,
a weather move, Taunt) plus three habits, each switched on or off:
- **build:** boosts on a free turn, when the foe can't hurt it.
- **disrupt:** phazes or Hazes a boosted foe; Encores a foe that just used a non-attacking move.
- **sustain:** heals when the next hit would knock it out, if the heal outpaces the hit. Rests when that comes out
  ahead. Protects to let poison or burn tick. Cures its own damaging status.

Outside the plan, every side attacks the same way. It finishes the foe when it can (with priority if it must).
Otherwise it uses the attack with the fewest expected turns to a KO: hits needed ÷ accuracy.

A matchup's result is the **maximin**: our best plan, judged against the foe's best answer from its own plans. A plan
family (build, disrupt, sustain) gets credit when taking it out of the best plan makes the result worse. It is
"decisive" when that changes who wins.

Modeled, noted or left out (and said so in the reports):
- **Modeled:** the calculator's own effects (abilities, items, weather and Explosion's defense halving), plus
  everything listed above.
- **Noted, not counted:** secondary effects below 100% (Body Slam's paralysis, flinches), full paralysis, crits,
  and confusion.
- **Left out of a one-on-one** (they're team plays): hazards, Baton Pass, U-turn's switch, Trick, trapping and
  Perish Song.
"""
import math
from dataclasses import dataclass, field, replace

import rules

TURN_CAP = 100
PP_UPS = 1.6                            # every move with its PP maxed
# Turns spent asleep: the floor of the mean of each generation's range (Gen 2: 1-6, Gen 3-4: 1-4). Believed; verify.
SLEEP_TURNS = {2: 3, 3: 2, 4: 2}
REST_TURNS = 2
ENCORE_TURNS = {2: 2, 3: 2, 4: 4}      # the shortest of each generation's range
TAUNT_TURNS = {3: 2, 4: 3}
LOCK_TURNS = 2                          # Outrage and Petal Dance: the shortest lock
WEATHER_TURNS = 5
WEATHER_ROCKS = {"Damp Rock": "Rain", "Heat Rock": "Sun", "Smooth Rock": "Sand", "Icy Rock": "Hail"}
WEATHER_ABILITIES = {"Drizzle": "Rain", "Drought": "Sun", "Sand Stream": "Sand", "Snow Warning": "Hail"}
WEATHER_MOVES = {"Rain Dance": "Rain", "Sunny Day": "Sun", "Sandstorm": "Sand", "Hail": "Hail"}
WEATHER_SAFE_TYPES = {"Sand": {"Rock", "Ground", "Steel"}, "Hail": {"Ice"}}
WEATHER_SAFE_ABILITIES = {"Sand": {"Sand Veil", "Magic Guard"}, "Hail": {"Ice Body", "Snow Cloak", "Magic Guard"}}
SPEED_WEATHER = {"Swift Swim": "Rain", "Chlorophyll": "Sun"}
PINCH = {"Blaze": "Fire", "Torrent": "Water", "Overgrow": "Grass", "Swarm": "Bug"}
ABSORB = {"Water Absorb": "Water", "Volt Absorb": "Electric", "Dry Skin": "Water"}
STAT_GUARD = {"Clear Body", "White Smoke"}
MAJOR = {"paralysis", "burn", "poison", "toxic", "sleep", "freeze"}
CALC_STATUS = {"paralysis": "par", "burn": "brn", "poison": "psn", "toxic": "tox", "sleep": "slp", "freeze": "frz"}
STATUS_SAFE_TYPES = {"poison": {"Poison", "Steel"}, "toxic": {"Poison", "Steel"}, "burn": {"Fire"},
                     "freeze": {"Ice"}, "leech-seed": {"Grass"}}
STATUS_SAFE_ABILITIES = {"poison": {"Immunity"}, "toxic": {"Immunity"}, "paralysis": {"Limber"},
                         "sleep": {"Insomnia", "Vital Spirit"}, "yawn": {"Insomnia", "Vital Spirit"},
                         "burn": {"Water Veil"}, "freeze": {"Magma Armor"}}
CURE_BERRIES = {"Lum Berry": MAJOR, "MiracleBerry": MAJOR, "Chesto Berry": {"sleep"}, "Mint Berry": {"sleep"},
                "Cheri Berry": {"paralysis"}, "PRZCureBerry": {"paralysis"}, "Pecha Berry": {"poison", "toxic"},
                "PSNCureBerry": {"poison", "toxic"}, "Rawst Berry": {"burn"}, "Ice Berry": {"burn"},
                "Aspear Berry": {"freeze"}, "Burnt Berry": {"freeze"}}
HEAL_BERRIES = {"Sitrus Berry": {3: ("hp", 30), 4: ("pct", 25)}, "Oran Berry": ("hp", 10), "Berry": ("hp", 10),
                "Gold Berry": ("hp", 30)}
PINCH_BERRIES = {"Salac Berry": "spe", "Liechi Berry": "atk", "Petaya Berry": "spa", "Ganlon Berry": "def",
                 "Apicot Berry": "spd"}
SLOW_ITEMS = {"Macho Brace", "Iron Ball", "Power Weight", "Power Bracer", "Power Belt", "Power Lens", "Power Band",
              "Power Anklet"}
CHOICE = {"Choice Band", "Choice Specs", "Choice Scarf"}
BOOSTABLE = ("atk", "def", "spa", "spd", "spe", "accuracy", "evasion")
FAMILY_OF = {"boost": "build", "protect-sub": "build", "screen": "build", "weather": "build",
             "status": "disrupt", "debuff": "disrupt", "taunt": "disrupt"}


def stage_mult(n):
    return (2 + n) / 2 if n >= 0 else 2 / (2 - n)


def acc_mult(n):
    return (3 + n) / 3 if n >= 0 else 3 / (3 - n)


class Missing(Exception):
    pass


# --- the damage table -------------------------------------------------------------------------------------------
class DamageTable:
    """Every damage number the fights ask for, fetched from the calculator in batches.

    A key is (attacker, defender, move, attack stage, defense stage, attacker status, defender status, weather,
    pinch). A fight that asks for a number the table doesn't have yet gets a stand-in (the same move at no boosts)
    and is marked dirty; the evaluator fetches every missing number at once and replays the dirty fights.
    """

    def __init__(self, battle):
        self.battle = battle
        self.cache, self.specs, self.errors = {}, {}, {}
        self.missing = set()
        self.misses = 0

    def get(self, key):
        r = self.cache.get(key)
        if r is None:
            self.missing.add(key)
            self.misses += 1
            return self.cache.get(key[:3] + (0, 0, "", "", key[7], False)) or (0.0, 0.0, 0)
        return r

    def request(self, key):
        akey, dkey, move, ast, dst, astat, dstat, weather, pinch = key
        a, d = self.specs[akey], self.specs[dkey]
        gen = a.gen
        cat = rules.category(gen, move)
        att = a.calc()
        dfn = d.calc()
        if cat != "Status":
            att["boosts"] = {"atk" if cat == "Physical" else "spa": ast}
            dfn["boosts"] = {"def" if cat == "Physical" else "spd": dst}
        if astat:
            att["status"] = astat
        if dstat:
            dfn["status"] = dstat
        if pinch:
            att["curHP"] = 1
        req = {"gen": gen, "attacker": att, "defender": dfn, "move": move}
        if weather:
            req["field"] = {"weather": weather}
        return req

    def fetch(self):
        keys = sorted(self.missing - set(self.cache), key=repr)
        self.missing.clear()
        if not keys:
            return 0
        results = self.battle.damage([self.request(k) for k in keys])
        for k, r in zip(keys, results):
            if "error" in r:
                self.errors[k] = r["error"]
                self.cache[k] = (0.0, 0.0, 0)
            else:
                lo = r["damage"][0] if isinstance(r["damage"], list) else r["damage"]
                self.cache[k] = (r["percent"][0], r["percent"][1], lo)
        return len(keys)


# --- plans and outcomes -----------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Plan:
    opener: tuple = ()
    build: bool = False
    disrupt: bool = False
    sustain: bool = False

    def families(self, kinds):
        """The families this plan uses: kinds maps an opener move to its kind (boost, status...)."""
        fams = {FAMILY_OF[kinds[m]] for m in self.opener if kinds.get(m) in FAMILY_OF}
        return fams | {f for f in ("build", "disrupt", "sustain") if getattr(self, f)}

    def without(self, family, kinds):
        return Plan(tuple(m for m in self.opener if FAMILY_OF.get(kinds.get(m)) != family),
                    **{f: getattr(self, f) and f != family for f in ("build", "disrupt", "sustain")})

    def label(self):
        parts = []
        if self.opener:
            seq = []
            for m in self.opener:
                if seq and seq[-1][0] == m:
                    seq[-1][1] += 1
                else:
                    seq.append([m, 1])
            parts.append(" → ".join(f"{m} ×{n}" if n > 1 else m for m, n in seq) + ", then attack")
        else:
            parts.append("attack")
        habits = [h for h in ("build", "disrupt", "sustain") if getattr(self, h)]
        if habits:
            parts.append("+ " + ", ".join(habits))
        return " ".join(parts)


@dataclass
class Outcome:
    winner: str                     # "A", "B" or "draw"
    turns: int
    hp: tuple                       # (A's HP %, B's HP %) at the end
    odds: tuple                     # (chance all of A's moves land, the same for B)
    calls: tuple                    # (A's moves turn by turn, B's)
    first_hit: str                  # who landed the first damaging hit: "A", "B" or ""
    used: tuple                     # (families A actually used, families B used)
    notes: frozenset = frozenset()

    def value(self):
        """How good this is for A. Who wins first, then the odds, then the margin, then the speed of it."""
        a_hp, b_hp = self.hp
        a_odds, b_odds = self.odds
        if self.winner == "A":
            return (2, round(a_odds, 4), round(a_hp, 1), -self.turns)
        if self.winner == "draw":
            return (1, round(a_odds, 4), round(-b_hp, 1), -self.turns)
        return (0, round(1 - b_odds, 4), round(100 - b_hp, 1), self.turns)

    def flipped(self):
        return Outcome({"A": "B", "B": "A"}.get(self.winner, "draw"), self.turns, self.hp[::-1], self.odds[::-1],
                       self.calls[::-1], {"A": "B", "B": "A"}.get(self.first_hit, ""), self.used[::-1], self.notes)


# --- one side's state ----------------------------------------------------------------------------------------
@dataclass(eq=False)
class Side:
    c: object                       # the Combatant
    tag: str
    plan: Plan
    moves: dict                     # name -> Move
    maxhp: int
    spe: int
    hp: float = 100.0
    st: dict = field(default_factory=lambda: {k: 0 for k in BOOSTABLE})
    status: str = None
    tox: int = 0
    sleep: int = 0
    item: str = None
    ability: str = None
    sub: float = 0.0
    screens: dict = field(default_factory=dict)
    lock: list = None               # [move, turns left] for Outrage-style locks and Encore
    choice: str = None
    charging: str = None
    hidden: bool = False            # in the air or underground mid-charge
    recharge: bool = False
    protect_last: bool = False
    protecting: bool = False
    seeded: bool = False
    yawn: int = 0
    taunt: int = 0
    wish: int = 0                   # turns until a Wish lands (0 = none)
    loaf: bool = False              # Truant
    berry_used: bool = False
    sash: bool = False
    hit_this_turn: bool = False
    flinch: bool = False
    fresh: bool = True              # hasn't moved yet (Fake Out)
    last: str = None
    opener_i: int = 0
    opening: bool = False           # this turn's move came from the opening
    pp: dict = field(default_factory=dict)
    kinds: dict = field(default_factory=dict)
    odds: float = 1.0
    calls: list = field(default_factory=list)
    used: set = field(default_factory=set)

    @property
    def types(self):
        return self.c.types


class Fight:
    def __init__(self, ev, a, b, plan_a, plan_b, a_first_on_tie=True):
        self.ev, self.gen = ev, a.gen
        self.A, self.B = ev.side(a, "A", plan_a), ev.side(b, "B", plan_b)
        self.tie_a = a_first_on_tie
        self.weather, self.weather_left = None, None
        self.notes = set()
        self.first_hit = ""
        self.turn = 0
        self.start()

    # --- helpers ---------------------------------------------------------------------------------------------
    def foe(self, s):
        return self.B if s is self.A else self.A

    def speed(self, s):
        v = s.spe * stage_mult(s.st["spe"])
        if s.status == "paralysis" and s.ability != "Quick Feet":
            v *= 0.25
        if s.ability == "Quick Feet" and s.status:
            v *= 1.5
        if s.item == "Choice Scarf":
            v *= 1.5
        if s.item in SLOW_ITEMS:
            v *= 0.5
        if self.weather and SPEED_WEATHER.get(s.ability) == self.weather:
            v *= 2
        return v

    def priority(self, s, move):
        return rules.move(self.gen, move)["priority"] if move and move in s.moves else 0

    def acts_first(self, u, um, t, tm):
        pu, pt = self.priority(u, um), self.priority(t, tm)
        if pu != pt:
            return pu > pt
        su, stt = self.speed(u), self.speed(t)
        if su != stt:
            return su > stt
        return (u is self.A) == self.tie_a

    def damage(self, u, t, name):
        """(min %, abs min) of u's move against t right now, before Substitute."""
        mv = u.moves[name]
        if mv.category == "Status":
            return 0.0, 0
        phys = mv.category == "Physical"
        ast = u.st["atk" if phys else "spa"]
        dst = t.st["def" if phys else "spd"]
        astat = ""
        if u.status and (u.ability == "Guts" or name == "Facade" or (u.status == "burn" and phys)):
            astat = CALC_STATUS[u.status]
        dstat = CALC_STATUS[t.status] if t.status and (t.ability == "Marvel Scale"
                                                         or name in ("Smelling Salts", "Wake-Up Slap")) else ""
        pinch = PINCH.get(u.ability) == mv.type and u.hp <= 100 / 3
        lo, _, absmin = self.ev.table.get((u.c.key, t.c.key, name, ast, dst, astat, dstat, self.weather or "", pinch))
        if t.screens.get(mv.category):
            lo, absmin = lo / 2, absmin // 2
        return lo, absmin

    def usable(self, s):
        out = [m for m in s.moves if s.pp.get(m, 0) > 0 and m not in ("Struggle",)]
        if s.taunt:
            out = [m for m in out if s.moves[m].damaging]
        if s.choice and s.choice in out:
            out = [s.choice]
        return out or ["Struggle"]

    def attacks(self, s):
        return [m for m in self.usable(s) if s.moves[m].damaging and not self.special_hit(s, m, check_only=True)]

    def special_hit(self, s, m, check_only=False):
        """Moves that need a condition: True when it can't be used now."""
        e = s.moves[m].effect.lower()
        if "first move after the user enters" in e and not s.fresh:
            return True
        if "user faints" in e:
            return True                              # only as a last resort (see choose)
        if "if the user takes damage before attacking" in e:
            t = self.foe(s)
            return not (s.sub > 0 or t.recharge or (t.status == "sleep" and t.sleep > 0))
        return False

    def incoming(self, u, t):
        """t's best hit on u next turn (min %) and the move: what u has to survive."""
        if t.recharge or (t.status == "sleep" and t.sleep > 0 and "Sleep Talk" not in t.moves) or t.loaf:
            return 0.0, None
        options = [t.lock[0]] if t.lock else [t.charging] if t.charging else self.attacks(t)
        best, move = 0.0, None
        for m in options:
            if m in t.moves and t.moves[m].damaging:
                d = self.damage(t, u, m)[0]
                if d > best:
                    best, move = d, m
        return best, move

    def residual(self, s):
        """HP % s loses (+) or gains (-) at the end of a turn, as things stand."""
        loss = 0.0
        if self.weather in WEATHER_SAFE_TYPES and not (set(s.types) & WEATHER_SAFE_TYPES[self.weather]) \
                and s.ability not in WEATHER_SAFE_ABILITIES[self.weather]:
            loss += 12.5 if self.gen == 2 and self.weather == "Sand" else 6.25
        if s.ability != "Magic Guard":
            if s.status in ("poison", "toxic") and s.ability == "Poison Heal":
                loss -= 12.5
            elif s.status == "poison" or s.status == "burn":
                loss += 12.5
            elif s.status == "toxic":
                loss += 6.25 * (s.tox + 1)
            if s.seeded:
                loss += 12.5
        if s.item == "Leftovers" or (s.item == "Black Sludge" and "Poison" in s.types):
            loss -= 6.25
        elif s.item == "Black Sludge" and s.ability != "Magic Guard":
            loss += 12.5
        return loss

    def accuracy(self, u, t, mv):
        if mv.target in ("user", "users-field", "user-and-allies", "entire-field", "opponents-field", "all-pokemon"):
            return 1.0
        if "No Guard" in (u.ability, t.ability):
            return 1.0
        acc = mv.accuracy
        if mv.name == "Thunder" and self.weather in ("Rain", "Sun"):
            acc = 100 if self.weather == "Rain" else 50
        if mv.name == "Blizzard" and self.weather == "Hail" and self.gen >= 4:
            acc = 100
        if mv.meta_category == "ohko":
            return max(0.0, (30 + u.c.level - t.c.level) / 100) if t.ability != "Sturdy" else 0.0
        mult = acc_mult(max(-6, min(6, u.st["accuracy"] - t.st["evasion"])))
        if u.ability == "Compound Eyes":
            mult *= 1.3
        if u.ability == "Hustle" and mv.category == "Physical":
            mult *= 0.8
        if t.item in ("BrightPowder", "Bright Powder", "Lax Incense"):
            mult *= 0.9
        if (t.ability == "Sand Veil" and self.weather == "Sand") or (t.ability == "Snow Cloak" and self.weather == "Hail"):
            mult *= 0.8
        if u.item == "Wide Lens":
            mult *= 1.1
        return min(1.0, acc / 100 * mult)

    def can_status(self, u, t, mv):
        ail = "toxic" if mv.ailment == "poison" and "badly" in mv.effect.lower() else mv.ailment
        if t.sub > 0 and "authentic" not in mv.flags:
            return False
        if ail in MAJOR or ail == "yawn":
            if t.status or (ail == "yawn" and t.yawn):
                return False
        if ail == "leech-seed" and t.seeded:
            return False
        if set(t.types) & STATUS_SAFE_TYPES.get(ail, set()) or t.ability in STATUS_SAFE_ABILITIES.get(ail, set()):
            return False
        if mv.name == "Thunder Wave" and rules.effectiveness(self.gen, "Electric", t.types, t.ability) == 0:
            return False
        if mv.name == "Will-O-Wisp" and t.ability == "Flash Fire":
            return False
        if ail in CURE_BERRIES.get(t.item, set()):
            return False                             # it'd be cured on the spot: not worth the turn
        if t.ability == "Leaf Guard" and self.weather == "Sun":
            return False
        return ail in MAJOR or ail in ("yawn", "leech-seed")

    def kind(self, s, m):
        return s.kinds[m]

    # --- the start ------------------------------------------------------------------------------------------
    def start(self):
        setters = [s for s in (self.A, self.B) if WEATHER_ABILITIES.get(s.ability)]
        if setters:   # the slower one's weather comes up last and stays
            setters.sort(key=lambda s: (-self.speed(s), s.tag != "A"))
            self.weather, self.weather_left = WEATHER_ABILITIES[setters[-1].ability], None
            if len(setters) == 2 and self.speed(setters[0]) == self.speed(setters[1]):
                self.notes.add("both set weather at the same speed: the second one's is used")
        for s in (self.A, self.B):
            t = self.foe(s)
            if s.ability == "Intimidate" and t.ability not in STAT_GUARD | {"Hyper Cutter"} and t.sub == 0:
                t.st["atk"] = max(-6, t.st["atk"] - 1)
            if s.ability == "Download" and self.gen >= 4:
                stats = self.ev.stats[t.c.key]["stats"]
                s.st["atk" if stats["def"] < stats["spd"] else "spa"] += 1

    # --- choosing ---------------------------------------------------------------------------------------------
    def choose(self, u):
        t = self.foe(u)
        if u.recharge:
            return None
        if u.charging:
            return u.charging
        if u.status == "sleep":
            if u.sleep > 0:
                u.sleep -= 1
                return "Sleep Talk" if "Sleep Talk" in u.moves and u.pp.get("Sleep Talk", 0) > 0 else None
            u.status = None
        if u.loaf:
            return None
        if u.lock:
            return u.lock[0]
        u.opening = False
        usable = self.usable(u)
        if usable == ["Struggle"] or len(usable) == 1 and u.choice:
            return usable[0]
        plan = u.plan
        inc, tm = self.incoming(u, t)
        attacks = self.attacks(u)

        # 1. Fake Out on the first turn
        for m in attacks:
            if "first move after the user enters" in u.moves[m].effect.lower() and self.damage(u, t, m)[0] > 0:
                return m
        # 2. finish it
        need = t.hp + (0.01 if t.sash and t.hp >= 100 else 0)
        if t.sub <= 0:
            kills = [m for m in attacks if self.damage(u, t, m)[0] >= need]
            if kills:
                kills.sort(key=lambda m: (not self.acts_first(u, m, t, tm), -self.accuracy(u, t, u.moves[m]),
                                          self.recoil_of(u, m)))
                m = kills[0]
                if self.acts_first(u, m, t, tm) or inc < u.hp:
                    return m
        # 3. disrupt: wipe a boosted foe, Encore a non-attacking move
        if plan.disrupt:
            boosted = sum(max(0, t.st[k]) for k in ("atk", "def", "spa", "spd", "spe")) > 0 or t.sub > 0
            for m in usable:
                k = self.kind(u, m)
                if k == "phaze" and boosted:
                    return self.tagged(u, m, "disrupt")
                if k == "haze" and boosted and sum(u.st.values()) <= 0:
                    return self.tagged(u, m, "disrupt")
                if k == "encore" and t.last and t.last in t.moves and not t.moves[t.last].damaging and not t.lock:
                    return self.tagged(u, m, "disrupt")
        # 4. sustain: heal, Rest, cure, Protect while the foe's poison ticks
        if plan.sustain:
            m = self.sustain(u, t, inc, tm, usable)
            if m:
                return self.tagged(u, m, "sustain")
        # 5. the opening
        while u.opener_i < len(plan.opener):
            m = plan.opener[u.opener_i]
            u.opener_i += 1
            if m in usable and self.valid(u, t, m):
                u.opening = True
                return self.tagged(u, m, FAMILY_OF.get(self.kind(u, m), "build"))
        # 6. build: boost on a free turn
        if plan.build and inc == 0:
            for m in usable:
                if self.kind(u, m) == "boost" and self.valid(u, t, m) and self.useful_boost(u, m):
                    return self.tagged(u, m, "build")
        # 7. last resort: Explosion when the race is lost anyway
        for m in usable:
            if "user faints" in u.moves[m].effect.lower() and u.moves[m].damaging and t.sub <= 0:
                if self.damage(u, t, m)[0] >= need and self.losing(u, t, inc, tm):
                    return m
        # 8. the attack with the fewest expected turns to a KO
        scored = [(self.attack_score(u, t, m), m) for m in attacks]
        scored = [x for x in scored if x[0][0] < math.inf]
        if scored:
            return min(scored)[1]
        for m in usable:   # nothing hurts it: anything that does something
            if self.valid(u, t, m):
                return m
        return usable[0]

    def tagged(self, u, m, family):
        u.used.add(family)
        return m

    def recoil_of(self, u, m):
        r = rules.move(self.gen, m).get("recoil") if m != "Struggle" else [1, 4]
        return r[0] / r[1] if r and u.ability not in ("Rock Head", "Magic Guard") else 0

    def attack_score(self, u, t, m):
        mv = u.moves[m]
        d = self.damage(u, t, m)[0]
        if d <= 0:
            return (math.inf, 0, 0, 0, 0)
        need = t.hp + t.sub + (0.01 if t.sash and t.hp >= 100 else 0)
        n = math.ceil(need / d - 1e-9)
        turns = n * (2 if "charge" in mv.flags and not (m == "Solar Beam" and self.weather == "Sun") else 1)
        turns += (n - 1) if "recharge" in mv.flags else 0
        acc = max(self.accuracy(u, t, mv), 0.01)
        drop = sum(-v for v in mv.self_changes.values() if v < 0) if mv.damaging else 0
        return (turns / acc, -acc, self.recoil_of(u, m), drop, -d)

    def losing(self, u, t, inc, tm):
        mine = min((self.attack_score(u, t, m)[0] for m in self.attacks(u)), default=math.inf)
        theirs = math.ceil(u.hp / inc - 1e-9) if inc > 0 else math.inf
        return mine > theirs or (mine == theirs and not self.acts_first(u, None, t, tm))

    def valid(self, u, t, m):
        mv, k = u.moves[m], self.kind(u, m)
        if k == "boost":
            if "max out its attack" in mv.effect.lower():
                return u.hp > 50 and u.st["atk"] < 6
            return any(u.st.get(s, 0) < 6 for s, v in mv.self_changes.items() if v > 0)
        if k == "protect-sub":
            return u.sub <= 0 and u.hp > 25
        if k == "status":
            return self.can_status(u, t, mv)
        if k == "debuff":
            return t.sub <= 0 and t.ability not in STAT_GUARD and any(t.st.get(s, 0) > -6 for s in mv.foe_changes)
        if k == "screen":
            return not u.screens.get("Physical" if m == "Reflect" else "Special")
        if k == "weather":
            return self.weather != WEATHER_MOVES[m]
        if k == "taunt":
            return not t.taunt and self.gen >= 3
        if k in ("heal", "cure", "protect", "phaze", "haze", "encore", "sleep-talk"):
            return False                             # used by the habits, not as openers
        return mv.damaging

    def useful_boost(self, u, m):
        """A free-turn boost only if it raises a stat this side attacks with, or its speed."""
        cats = {u.moves[x].category for x in u.moves if u.moves[x].damaging}
        want = {"atk"} if cats == {"Physical"} else {"spa"} if cats == {"Special"} else {"atk", "spa"}
        return any(v > 0 and (s in want or s == "spe") and u.st[s] < 6 for s, v in u.moves[m].self_changes.items())

    def sustain(self, u, t, inc, tm, usable):
        first = self.acts_first(u, None, t, tm)
        res = max(0.0, self.residual(u))
        hit = inc + res
        danger = (u.hp <= hit) if first else (inc < u.hp <= 2 * inc + res)
        kinds = {m: self.kind(u, m) for m in usable}
        # cure a status that's costing HP or speed
        if u.status in ("toxic", "poison", "burn", "paralysis") and not danger:
            for m, k in kinds.items():
                if k == "cure" and (u.status != "paralysis" or not first) and \
                        (m != "Refresh" or u.status in ("burn", "paralysis", "poison", "toxic")):
                    return m
        if danger and hit > 0:
            best, gain_best = None, 0.0
            for m, k in kinds.items():
                if k != "heal":
                    continue
                mv = u.moves[m]
                e = mv.effect.lower()
                if "sleeps for two turns" in e:
                    if u.status == "sleep":
                        continue
                    asleep = 0 if u.item in ("Chesto Berry", "Mint Berry", "Lum Berry", "MiracleBerry") else REST_TURNS
                    talks = "Sleep Talk" in u.moves
                    after = 100 - (asleep + 1) * inc
                    gain = after - (u.hp - inc) if after > 0 else 0
                    if talks:
                        gain += 1                    # tie-break in favor of Rest when it can still attack asleep
                elif "end of the next turn" in e:
                    if u.wish:
                        continue
                    gain = min(50, 100 - u.hp) - inc
                elif "average of their current hp" in e:
                    mine, theirs = u.hp * u.maxhp / 100, t.hp * t.maxhp / 100
                    gain = ((mine + theirs) / 2 - mine) / u.maxhp * 100 - inc if t.sub <= 0 else 0
                else:
                    gain = min(self.heal_amount(u, mv), 100 - u.hp) - hit
                if gain > gain_best:
                    best, gain_best = m, gain
            if best:
                return best
        # Protect: let the foe's poison, burn or seed tick (never twice in a row), or cover a Wish
        foe_loss = self.residual(t)
        for m, k in kinds.items():
            if k == "protect" and not u.protect_last and m in ("Protect", "Detect"):
                if (foe_loss > 0 and self.residual(u) <= 0) or (u.wish == 1 and danger):
                    return m
        return None

    def heal_amount(self, u, mv):
        if mv.name in ("Synthesis", "Morning Sun", "Moonlight") and self.gen >= 3:
            return 200 / 3 if self.weather == "Sun" else 25 if self.weather else 50
        return mv.healing or 50

    # --- acting ---------------------------------------------------------------------------------------------
    def act(self, u, t, m, foe_choice):
        if m is None:
            u.calls.append("(asleep)" if u.status == "sleep" else "(recharging)" if u.recharge else
                           "(loafing)" if u.loaf else "—")
            u.recharge = False
            return
        if u.flinch:
            u.calls.append("(flinched)")
            if u.opening:            # the opening move didn't happen: it's still next
                u.opener_i -= 1
            return
        u.fresh = False
        if m == "Sleep Talk":
            u.calls.append("Sleep Talk")
            u.pp[m] -= 1
            self.sleep_talk(u, t)
            return
        mv = u.moves[m]
        if m != "Struggle":
            u.pp[m] = u.pp.get(m, 0) - (2 if t.ability == "Pressure" else 1)
        u.last = m
        u.calls.append(m)
        if u.item in CHOICE and not u.choice and m != "Struggle":
            u.choice = m
        # two-turn moves
        if "charge" in mv.flags and u.charging != m and not (m == "Solar Beam" and self.weather == "Sun"):
            u.charging = m
            u.hidden = "dodging all attacks" in mv.effect.lower()
            if m == "Skull Bash":
                u.st["def"] = min(6, u.st["def"] + 1)
            return
        if u.charging == m:
            u.charging, u.hidden = None, False
        if self.kind(u, m) == "protect":
            u.protecting = mv.name in ("Protect", "Detect") and not u.protect_last
            if mv.name == "Endure":
                self.notes.add("Endure isn't modeled")
            return
        if t.protecting and "protect" in mv.flags:
            return
        if t.hidden and "No Guard" not in (u.ability, t.ability) and mv.target not in ("user", "users-field"):
            return
        u.odds *= self.accuracy(u, t, mv)
        if mv.damaging:
            self.hit(u, t, m, mv, foe_choice)
        else:
            self.effect(u, t, m, mv)

    def hit(self, u, t, m, mv, foe_choice):
        e = mv.effect.lower()
        if "only works if the target is about to use a damaging move" in e:
            if not foe_choice or foe_choice not in t.moves or not t.moves[foe_choice].damaging or t.calls and \
                    len(t.calls) > len(u.calls) - 1:
                return
        if "if the user takes damage before attacking" in e and u.hit_this_turn and u.sub <= 0:
            return
        d, absmin = self.damage(u, t, m)
        if not self.first_hit and d > 0:
            self.first_hit = u.tag
        if d <= 0:
            if ABSORB.get(t.ability) == mv.type and not (t.ability == "Dry Skin" and mv.type != "Water"):
                t.hp = min(100.0, t.hp + 25)
            if t.ability == "Motor Drive" and mv.type == "Electric":
                t.st["spe"] = min(6, t.st["spe"] + 1)
            self.after_hit_user(u, m, mv, 0)
            return
        if t.sub > 0:
            dealt_pct = min(d, t.sub)
            t.sub = max(0.0, t.sub - d)
            dealt_abs = dealt_pct * t.maxhp / 100
        else:
            before = t.hp
            if t.sash and t.hp >= 100 and d >= 100:
                t.hp = 100 / t.maxhp
                t.item, t.sash = None, False
            else:
                t.hp = max(0.0, t.hp - d)
            t.hit_this_turn = True
            dealt_abs = (before - t.hp) * t.maxhp / 100
            # 100% side effects on the foe
            if t.hp > 0 and mv.foe_changes and (mv.stat_chance in (0, 100)) and t.ability not in STAT_GUARD:
                for s, v in mv.foe_changes.items():
                    t.st[s] = max(-6, min(6, t.st[s] + v))
            if "first move after the user enters" in e and t.ability != "Inner Focus":
                t.flinch = True
                if t.ability == "Steadfast":
                    t.st["spe"] = min(6, t.st["spe"] + 1)
            if "drops its held item" in e and t.item and t.ability != "Sticky Hold" and self.gen >= 3:
                t.item, t.choice = None, None
            if "removes leech seed" in e or "rapid spin" == m.lower():
                u.seeded = False
            self.berries(t)
        # the user's side of it
        if mv.self_changes and mv.damaging:
            for s, v in mv.self_changes.items():
                u.st[s] = max(-6, min(6, u.st[s] + v))
        self.after_hit_user(u, m, mv, dealt_abs)
        if "hits every turn for" in e and not u.lock:
            u.lock = [m, LOCK_TURNS]
            self.notes.add("lock-in moves end in confusion, which isn't modeled")
        if "recharge" in mv.flags:
            u.recharge = True
        if "user faints" in e:
            u.hp = 0.0

    def after_hit_user(self, u, m, mv, dealt_abs):
        data = rules.move(self.gen, m) if m != "Struggle" else {"recoil": None, "drain": None}
        if m == "Struggle":
            u.hp = max(0.0, u.hp - 25)
            return
        if data.get("drain") and dealt_abs:
            heal = dealt_abs * data["drain"][0] / data["drain"][1] / u.maxhp * 100
            u.hp = max(0.0, u.hp - heal) if self.foe(u).ability == "Liquid Ooze" else min(100.0, u.hp + heal)
        if data.get("recoil") and dealt_abs and u.ability not in ("Rock Head", "Magic Guard"):
            u.hp = max(0.0, u.hp - dealt_abs * data["recoil"][0] / data["recoil"][1] / u.maxhp * 100)
        if u.item == "Life Orb" and dealt_abs and u.ability != "Magic Guard":
            u.hp = max(0.0, u.hp - 10)
        if u.item == "Shell Bell" and dealt_abs:
            u.hp = min(100.0, u.hp + dealt_abs / 8 / u.maxhp * 100)
        self.berries(u)

    def effect(self, u, t, m, mv):
        k = self.kind(u, m)
        e = mv.effect.lower()
        if k == "boost":
            if "max out its attack" in e:
                u.hp -= 50
                u.st["atk"] = 6
            else:
                for s, v in mv.self_changes.items():
                    u.st[s] = max(-6, min(6, u.st[s] + v))
        elif k == "protect-sub":
            if u.sub <= 0 and u.hp > 25:
                u.hp -= 25
                u.sub = 25.0
        elif k == "heal":
            if "sleeps for two turns" in e:
                if u.hp < 100 or u.status:
                    u.hp, u.status, u.tox = 100.0, "sleep", 0
                    u.sleep = REST_TURNS
                    self.cure_berry(u)
            elif "end of the next turn" in e:
                u.wish = u.wish or 2
            elif "average of their current hp" in e:
                if t.sub <= 0:
                    avg = (u.hp * u.maxhp + t.hp * t.maxhp) / 200
                    u.hp, t.hp = min(100.0, avg / u.maxhp * 100), min(100.0, avg / t.maxhp * 100)
            else:
                u.hp = min(100.0, u.hp + self.heal_amount(u, mv))
        elif k == "cure":
            if m != "Refresh" or u.status in ("burn", "paralysis", "poison", "toxic"):
                u.status, u.tox = None, 0
        elif k == "status":
            if not self.can_status(u, t, mv) and not (mv.ailment in CURE_BERRIES.get(t.item, set())):
                return
            ail = "toxic" if mv.ailment == "poison" and "badly" in e else mv.ailment
            if ail == "leech-seed":
                t.seeded = True
            elif ail == "yawn":
                t.yawn = 2
            else:
                t.status = ail
                t.tox = 0
                if ail == "sleep":
                    t.sleep = SLEEP_TURNS[self.gen] // (2 if t.ability == "Early Bird" else 1)
                self.cure_berry(t)
                if t.ability == "Synchronize" and ail in ("burn", "paralysis", "poison", "toxic") and not u.status:
                    back = "poison" if ail == "toxic" else ail
                    if not (set(u.types) & STATUS_SAFE_TYPES.get(back, set())):
                        u.status = back
        elif k == "debuff":
            if t.sub <= 0 and t.ability not in STAT_GUARD:
                for s, v in mv.foe_changes.items():
                    if not (s == "atk" and t.ability == "Hyper Cutter") and not (s == "accuracy" and t.ability == "Keen Eye"):
                        t.st[s] = max(-6, min(6, t.st[s] + v))
        elif k == "phaze":
            t.st = {s: 0 for s in BOOSTABLE}
            t.sub, t.lock, t.charging, t.hidden = 0.0, None, None, False
            self.notes.add("phazing in a one-on-one reads as wiping the target's boosts")
        elif k == "haze":
            u.st = {s: 0 for s in BOOSTABLE}
            t.st = {s: 0 for s in BOOSTABLE}
        elif k == "screen":
            turns = 8 if u.item == "Light Clay" else 5
            u.screens["Physical" if m == "Reflect" else "Special"] = turns
        elif k == "weather":
            self.weather = WEATHER_MOVES[m]
            self.weather_left = 8 if WEATHER_ROCKS.get(u.item) == self.weather and self.gen >= 4 else WEATHER_TURNS
        elif k == "taunt":
            t.taunt = TAUNT_TURNS.get(self.gen, 2)
        elif k == "encore":
            if t.last and t.last in t.moves and t.last not in ("Encore", "Struggle"):
                t.lock = [t.last, ENCORE_TURNS[self.gen]]

    def sleep_talk(self, u, t):
        """Sleep Talk calls one of its other moves at random: counted as their average damage."""
        others = [m for m in u.moves if m not in ("Sleep Talk", "Rest") and "charge" not in u.moves[m].flags]
        if not others:
            return
        dmg = sum(self.damage(u, t, m)[0] if u.moves[m].damaging else 0 for m in others) / len(others)
        if dmg > 0:
            if not self.first_hit:
                self.first_hit = u.tag
            if t.sub > 0:
                t.sub = max(0.0, t.sub - dmg)
            else:
                t.hp = max(0.0, t.hp - dmg)
                self.berries(t)
        self.notes.add("Sleep Talk counted as the average of its other moves")

    def cure_berry(self, s):
        if s.status and s.status in CURE_BERRIES.get(s.item, set()):
            s.status, s.sleep, s.tox, s.item = None, 0, 0, None

    def berries(self, s):
        if s.hp <= 0 or not s.item:
            return
        if s.item in HEAL_BERRIES and s.hp <= 50:
            rule = HEAL_BERRIES[s.item]
            kind, amt = rule.get(self.gen, rule.get(3)) if isinstance(rule, dict) else rule
            s.hp = min(100.0, s.hp + (amt if kind == "pct" else amt / s.maxhp * 100))
            s.item = None
        elif s.item in PINCH_BERRIES and s.hp <= 25:
            stat = PINCH_BERRIES[s.item]
            s.st[stat] = min(6, s.st[stat] + 1)
            s.item = None

    # --- the end of the turn --------------------------------------------------------------------------------
    def end_turn(self):
        order = sorted((self.A, self.B), key=lambda s: -self.speed(s))
        for s in order:
            if s.hp <= 0:
                continue
            t = self.foe(s)
            w = self.weather
            if w in WEATHER_SAFE_TYPES and not (set(s.types) & WEATHER_SAFE_TYPES[w]) \
                    and s.ability not in WEATHER_SAFE_ABILITIES[w]:
                s.hp -= 12.5 if self.gen == 2 and w == "Sand" else 6.25
            if w == "Rain" and s.ability == "Rain Dish" or w == "Hail" and s.ability == "Ice Body":
                s.hp = min(100.0, s.hp + 6.25)
            if w == "Rain" and s.ability == "Dry Skin":
                s.hp = min(100.0, s.hp + 12.5)
            if w == "Sun" and s.ability == "Dry Skin":
                s.hp -= 12.5
            if s.wish:
                s.wish -= 1
                if s.wish == 0:
                    s.hp = min(100.0, s.hp + 50)
            if s.item == "Leftovers" or (s.item == "Black Sludge" and "Poison" in s.types):
                s.hp = min(100.0, s.hp + 6.25)
            elif s.item == "Black Sludge" and s.ability != "Magic Guard":
                s.hp -= 12.5
            if s.seeded and s.ability != "Magic Guard" and t.hp > 0:
                drained = min(12.5, max(0.0, s.hp)) * s.maxhp / 100
                s.hp -= 12.5
                gain = drained / t.maxhp * 100
                t.hp = max(0.0, t.hp - gain) if s.ability == "Liquid Ooze" else min(100.0, t.hp + gain)
            if s.ability != "Magic Guard":
                if s.status in ("poison", "toxic") and s.ability == "Poison Heal":
                    s.hp = min(100.0, s.hp + 12.5)
                elif s.status in ("poison", "burn"):
                    s.hp -= 12.5
                elif s.status == "toxic":
                    s.tox += 1
                    s.hp -= 6.25 * s.tox
            if s.ability == "Speed Boost" and s.hp > 0:
                s.st["spe"] = min(6, s.st["spe"] + 1)
            if not s.status and s.item == "Toxic Orb" and not set(s.types) & {"Poison", "Steel"}:
                s.status, s.tox = "toxic", 0
            if not s.status and s.item == "Flame Orb" and "Fire" not in s.types:
                s.status = "burn"
            if s.yawn:
                s.yawn -= 1
                if s.yawn == 0 and not s.status:
                    s.status, s.sleep = "sleep", SLEEP_TURNS[self.gen]
            s.hp = max(0.0, s.hp)
            self.berries(s)
        for s in (self.A, self.B):
            s.protect_last, s.protecting = s.protecting, False
            s.flinch = s.hit_this_turn = False
            s.screens = {k: v - 1 for k, v in s.screens.items() if v > 1}
            s.taunt = max(0, s.taunt - 1)
            if s.lock and not s.charging:
                s.lock[1] -= 1
                if s.lock[1] <= 0:
                    s.lock = None
            if s.ability == "Truant":
                s.loaf = not s.loaf if s.calls and s.calls[-1] not in ("(loafing)",) else False
        if self.weather_left is not None:
            self.weather_left -= 1
            if self.weather_left <= 0:
                self.weather, self.weather_left = None, None

    # --- the fight ------------------------------------------------------------------------------------------
    def run(self):
        A, B = self.A, self.B
        for self.turn in range(1, TURN_CAP + 1):
            ca, cb = self.choose(A), self.choose(B)
            a_first = self.acts_first(A, ca, B, cb)
            if self.speed(A) == self.speed(B) and self.priority(A, ca) == self.priority(B, cb):
                self.notes.add("speed tie")
            order = [(A, B, ca, cb), (B, A, cb, ca)] if a_first else [(B, A, cb, ca), (A, B, ca, cb)]
            for u, t, m, fm in order:
                if u.hp <= 0 or t.hp <= 0:
                    break
                self.act(u, t, m, fm)
                if A.hp <= 0 or B.hp <= 0:
                    break
            if A.hp > 0 and B.hp > 0:
                self.end_turn()
            if A.hp <= 0 or B.hp <= 0:
                winner = "draw" if A.hp <= 0 and B.hp <= 0 else "A" if B.hp <= 0 else "B"
                return self.outcome(winner)
        self.notes.add("stalemate: no knockout in 100 turns")
        return self.outcome("draw")

    def outcome(self, winner):
        A, B = self.A, self.B
        return Outcome(winner, self.turn, (round(A.hp, 1), round(B.hp, 1)), (A.odds, B.odds),
                       (tuple(A.calls), tuple(B.calls)), self.first_hit, (frozenset(A.used), frozenset(B.used)),
                       frozenset(self.notes))


# --- the evaluator ----------------------------------------------------------------------------------------------
@dataclass
class Matchup:
    a: object
    b: object
    plan: Plan                      # our best plan
    answer: Plan                    # their best answer to it
    outcome: Outcome
    straight: Outcome               # attacking only, against their best answer to that
    credits: dict                   # family -> "decisive" / "helps"
    damage: dict                    # our move -> (min %, max %) at no boosts, from full
    incoming: dict                  # their move -> (min %, max %) on us
    speeds: tuple                   # (ours, theirs) with items, before anything happens
    plans_tried: int


class Evaluator:
    def __init__(self, battle, movebook):
        self.battle, self.mb = battle, movebook
        self.table = DamageTable(battle)
        self.stats = {}
        self._fights = {}

    # --- knowledge about a combatant ------------------------------------------------------------------------
    def prepare(self, combatants):
        new = [c for c in combatants if c.key not in self.stats]
        for c in combatants:
            self.table.specs[c.key] = c
        if new:
            for c, r in zip(new, self.battle.damage([{"gen": c.gen, "stats": c.calc()} for c in new])):
                if "error" in r:
                    raise ValueError(f"{c.name}: {r['error']}")
                self.stats[c.key] = r

    def kind(self, mv, c):
        """What a move is for, in the simulator's terms."""
        plays = {p["play"] for p in mv.plays if p["primary"]}
        if mv.damaging:
            return "hit"
        if mv.name in ("Protect", "Detect", "Endure"):
            return "protect"
        if mv.name == "Substitute":
            return "protect-sub"
        if mv.name in ("Reflect", "Light Screen"):
            return "screen"
        if mv.name in WEATHER_MOVES:
            return "weather"
        if mv.name == "Curse" and "Ghost" in c.types:
            return "utility"
        for k in ("boost", "heal", "cure", "taunt", "encore", "sleep-talk", "phaze"):
            if k in plays:
                return k
        if "reset" in plays:
            return "haze"
        if "status" in plays and mv.ailment in MAJOR | {"leech-seed", "yawn"}:
            return "status"
        if "debuff" in plays:
            return "debuff"
        return "utility"

    def side(self, c, tag, plan):
        moves = {m: self.mb.get(c.gen, m) for m in c.moves}
        moves.setdefault("Struggle", self.mb.get(c.gen, "Struggle"))
        st = self.stats[c.key]
        s = Side(c=c, tag=tag, plan=plan, moves=moves, maxhp=st["hp"], spe=st["stats"]["spe"],
                 item=c.item, ability=c.ability)
        s.pp = {m: int(mv.pp * PP_UPS) if mv.pp else 1 for m, mv in moves.items()}
        s.kinds = {m: self.kind(mv, c) for m, mv in moves.items()}
        s.sash = c.item == "Focus Sash"
        return s

    def plans(self, c):
        """Every plan this combatant could run: attacking only, then its openings with its habits switched on."""
        mvs = [self.mb.get(c.gen, m) for m in c.moves]
        kinds = {mv.name: self.kind(mv, c) for mv in mvs}
        has = lambda *ks: [mv.name for mv in mvs if kinds[mv.name] in ks]
        habits = dict(build=bool(has("boost")), disrupt=bool(has("phaze", "haze", "encore")),
                      sustain=bool(has("heal", "cure", "protect")))
        boosts, subs = has("boost"), has("protect-sub")
        openers = [()]
        for b in boosts:
            openers += [(b,)] + ([(b, b)] if "max out" not in self.mb.get(c.gen, b).effect.lower() else [])
        for s in subs:
            openers += [(s,)] + [(s, b) for b in boosts]
        first_boost = boosts[:1]
        for s in has("status"):
            openers += [(s,)] + [(s, b) for b in first_boost]
        for d in has("debuff"):
            openers += [(d,), (d, d)]
        for s in has("screen"):
            openers += [(s,)] + [(s, b) for b in first_boost]
        for w in has("weather", "taunt"):
            openers += [(w,)]
        out = [Plan()]
        for o in openers:
            p = Plan(o, **habits)
            if p not in out:
                out.append(p)
        return out, kinds

    # --- fights -----------------------------------------------------------------------------------------------
    def fight(self, a, b, pa, pb):
        key = (a.key, b.key, pa, pb)
        if key in self._fights:
            return self._fights[key]
        misses = self.table.misses
        o = Fight(self, a, b, pa, pb).run()
        if "speed tie" in o.notes:
            o2 = Fight(self, a, b, pa, pb, a_first_on_tie=False).run()
            if o2.winner != o.winner:
                o = Outcome("draw", max(o.turns, o2.turns), o.hp, (o.odds[0] * 0.5, o.odds[1] * 0.5), o.calls,
                            o.first_hit, o.used, o.notes | {"a coin flip: the speed tie decides it"})
        if self.table.misses == misses:
            self._fights[key] = o
        return o

    def response(self, a, b, pa, b_plans, floor=None):
        """Their best answer to our plan pa: the plan that leaves us worst off. Stops early below `floor`."""
        worst = None
        for pb in b_plans:
            o = self.fight(a, b, pa, pb)
            if worst is None or o.value() < worst[1].value():
                worst = (pb, o)
            if floor is not None and worst[1].value() <= floor:
                break
        return worst

    def matchup(self, a, b):
        a, b = self.traced(a, b), self.traced(b, a)
        self.prepare([a, b])
        (a_plans, kinds), (b_plans, _) = self.plans(a), self.plans(b)
        straight_answer, straight = self.response(a, b, a_plans[0], b_plans)
        best = (a_plans[0], straight_answer, straight)
        for pa in a_plans[1:]:
            pb, o = self.response(a, b, pa, b_plans, floor=best[2].value())
            if o.value() > best[2].value():
                best = (pa, pb, o)
        plan, answer, outcome = best
        credits = {}
        for fam in sorted(plan.families(kinds) & set(outcome.used[0]) | {FAMILY_OF[kinds[m]] for m in plan.opener
                                                                        if kinds.get(m) in FAMILY_OF}):
            alt = plan.without(fam, kinds)
            if alt == plan:
                continue
            _, o = self.response(a, b, alt, b_plans)
            if o.value()[0] < outcome.value()[0]:
                credits[fam] = "decisive"
            elif o.value() < outcome.value():
                credits[fam] = "helps"
        dmg = {m: self.table.get((a.key, b.key, m, 0, 0, "", "", self.start_weather(a, b), False))[:2]
               for m in a.moves if rules.category(a.gen, m) != "Status"}
        inc = {m: self.table.get((b.key, a.key, m, 0, 0, "", "", self.start_weather(a, b), False))[:2]
               for m in b.moves if rules.category(b.gen, m) != "Status"}
        f = Fight(self, a, b, Plan(), Plan())
        return Matchup(a, b, plan, answer, outcome, straight, credits, dmg, inc, (f.speed(f.A), f.speed(f.B)),
                       len(a_plans) * len(b_plans))

    def start_weather(self, a, b):
        return Fight(self, a, b, Plan(), Plan()).weather or ""

    def traced(self, c, foe):
        if c.ability == "Trace" and foe.ability and foe.ability not in ("Trace", "Multitype"):
            return replace(c, ability=foe.ability, name=f"{c.name} (traced {foe.ability})")
        return c

    def versus(self, ours, field, rounds=10, progress=None):
        """Every one of ours against every member of the field: {(our key, their key): Matchup}."""
        traced = [self.traced(a, b) for a in ours for b in field] + [self.traced(b, a) for a in ours for b in field]
        self.prepare(list(ours) + list(field) + traced)
        todo, done = [(a, b) for a in ours for b in field], {}
        self.prefetch(todo)
        for _ in range(rounds):
            dirty = []
            for a, b in todo:
                before = self.table.misses
                m = self.matchup(a, b)
                (dirty.append((a, b)) if self.table.misses != before else done.__setitem__((a.key, b.key), m))
            if progress:
                progress(len(done), len(dirty), len(self.table.missing))
            if not dirty:
                break
            self.table.fetch()
            todo = dirty
        return done

    def prefetch(self, pairs):
        """Ask for the obvious numbers first: every move both ways at no boosts, in the starting weather."""
        for a, b in pairs:
            a2, b2 = self.traced(a, b), self.traced(b, a)
            w = self.start_weather(a2, b2)
            for x, y in ((a2, b2), (b2, a2)):
                for m in x.moves:
                    if rules.category(x.gen, m) != "Status":
                        self.table.get((x.key, y.key, m, 0, 0, "", "", w, False))
        self.table.misses = 0
        self.table.fetch()
