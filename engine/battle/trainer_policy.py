"""The games' own trainer AI as a policy (scouting engine, layer 4): how a game's trainer picks its move.

Read from the pret disassemblies (battle/trainer_ai.json, with sources):
- **Gen 3–4:** every move starts at 100, each AI flag nudges the scores, and the highest score is used.
- **Crystal:** every move starts at 20, each AI layer nudges the scores, and the lowest score is used.

The games roll dice for many nudges. Two rules keep the engine deterministic:
- a nudge counts when it happens **more often than not**; coin flips and rarer rolls are left out, and the reports say so;
- the games break ties at random, and the engine picks the attack with the fewest expected turns among the tied
  moves.

What's modeled, by flag:

| Gen 3–4 flag | Rule |
|---|---|
| BASIC / CHECK_BAD_MOVE | −10 to a move that would fail or do nothing |
| EVAL_ATTACK / TRY_TO_FAINT | +4 to a knockout (+6 with priority); −1 to every attack but the strongest; +2 to a 4× hit (Gen 4, Emerald); −2 to Explosion, Focus Punch, Sucker Punch (Gen 4). The knockout check uses the top roll in Gen 4 and the average roll in Gen 3 |
| EXPERT / CHECK_VIABILITY | healing: −3 at full HP, −8 when it isn't slower, −3 at 70% or more, else +2; stat boosts: −1 at +3 or higher, −2 at 70% HP or less; Toxic and Leech Seed: −3 when its own HP is at half or less, −3 when the target's is |
| SETUP_FIRST_TURN | +2 to set-up and status moves on the first turn |
| CHECK_HP / HP_AWARE | −2 to Explosion, healing and Endure-type moves above 70% HP; −2 to stat changes at 70% or less; −2 to slow status and set-up against a target at 30% or less |
| PRIORITIZE_EXTREMES / PREFER_POWER_EXTREMES / PREFER_STRONGEST_MOVE | +2 to status moves and to the attacks the AI doesn't compare (Explosion, two-turn and recharge moves, Focus Punch, Sucker Punch, Superpower, Eruption-type); FireRed and Emerald include fixed-damage moves |

| Crystal layer | Rule (lower is better) |
|---|---|
| AI_BASIC | +10 to a redundant move or a status move on a statused target |
| AI_SETUP | +2 to stat changes after the first turn |
| AI_SMART | healing −2 under 25% HP, +1 over 50%; Toxic and Leech Seed +1 when the target is under half; screens +1 unless at full HP |
| AI_AGGRESSIVE | +1 to every attack but the strongest (reckless moves excepted) |
| AI_CAUTIOUS | +1 to residual moves after the first turn |
| AI_STATUS | +10 to moves the target's type is immune to |
| AI_RISKY | −5 to a knockout (Explosion and one-hit KO moves excepted) |
"""
import rules

EXTREMES = {"Explosion", "Self-Destruct", "Dream Eater", "Focus Punch", "Sucker Punch", "Superpower", "Eruption",
            "Water Spout", "Spit Up", "Head Smash", "Double-Edge"}
FLAILS = {"Flail", "Reversal"}
ENDURES = {"Endure", "Destiny Bond", "Memento"}
RESIDUAL = {"Leech Seed", "Poison Powder", "Stun Spore", "Thunder Wave", "Substitute", "Spikes", "Mist",
            "Focus Energy", "Poison Gas", "Toxic"}
SETUP_KINDS = {"boost", "debuff", "screen", "protect-sub", "status", "weather"}


def flags_of(ai):
    """Flag names without their prefixes: {'BASIC', 'EVAL_ATTACK', ...}."""
    return {f.upper().replace("AI_FLAG_", "").replace("AI_SCRIPT_", "").replace("AI_", "") for f in ai or ()}


def useless(f, u, t, m):
    """Would this move fail or do nothing right now (what BASIC / CHECK_BAD_MOVE / AI_BASIC rule out)?"""
    mv, k = u.moves[m], u.kinds[m]
    e = mv.effect.lower()
    if mv.damaging:
        if "only works if the target is asleep" in e and t.status != "sleep":
            return True
        return f.damage_hi(u, t, m) <= 0
    if k == "status":
        ail = mv.ailment
        if t.sub > 0 and "authentic" not in mv.flags:
            return True
        if ail == "leech-seed":
            return t.seeded or "Grass" in t.types
        if ail == "yawn":
            return bool(t.status or t.yawn)
        if t.status:
            return True
        from battle.evaluate import STATUS_SAFE_ABILITIES, STATUS_SAFE_TYPES
        ail = "toxic" if ail == "poison" and "badly" in e else ail
        if set(t.types) & STATUS_SAFE_TYPES.get(ail, set()) or t.ability in STATUS_SAFE_ABILITIES.get(ail, set()):
            return True
        return mv.name == "Thunder Wave" and rules.effectiveness(f.gen, "Electric", t.types, t.ability) == 0
    if k == "boost":
        return not any(u.st.get(s, 0) < 6 for s, v in mv.self_changes.items() if v > 0)
    if k == "debuff":
        return t.sub > 0 or not any(t.st.get(s, 0) > -6 for s in mv.foe_changes)
    if k == "protect-sub":
        return u.sub > 0 or u.hp <= 25
    if k == "screen":
        return bool(u.screens.get("Physical" if m == "Reflect" else "Special"))
    if k == "weather":
        from battle.evaluate import WEATHER_MOVES
        return f.weather == WEATHER_MOVES[m]
    if k == "heal":
        return u.hp >= 100 and "end of the next turn" not in e
    if k == "taunt":
        return bool(t.taunt)
    if k == "sleep-talk":
        return u.status != "sleep"
    if k == "cure":
        return not u.status
    return False


def scores(f, u, t, ai):
    """{move: score} under the game's AI, with higher always better (Crystal's scores are turned around)."""
    fl = flags_of(ai)
    gen = f.gen
    moves = [m for m in f.usable(u)]
    hi = {m: f.damage_hi(u, t, m) for m in moves if u.moves[m].damaging}
    lo = {m: f.damage(u, t, m)[0] for m in hi}
    strongest = max(hi.values(), default=0)
    first = u.fresh
    faster = f.speed(u) >= f.speed(t)
    out = {}
    for m in moves:
        mv, k = u.moves[m], u.kinds[m]
        e = mv.effect.lower()
        selfko = "user faints" in e
        if gen == 2:
            s = 20
            if "BASIC" in fl and useless(f, u, t, m):
                s += 10
            if "STATUS" in fl and ((mv.damaging and hi.get(m, 0) <= 0) or (k == "status" and useless(f, u, t, m))):
                s += 10
            if "SETUP" in fl and ((k == "boost" and not first) or (k == "debuff" and not t.fresh)):
                s += 2
            if "SMART" in fl:
                if k == "heal":
                    s += -2 if u.hp < 25 else 1 if u.hp > 50 else 0
                if m in ("Toxic", "Leech Seed") and t.hp < 50:
                    s += 1
                if k == "screen" and u.hp < 100:
                    s += 1
            if "AGGRESSIVE" in fl and mv.damaging and 0 < hi[m] < strongest and not selfko \
                    and "hits every turn for" not in e and mv.hits[1] == 1:
                s += 1
            if "CAUTIOUS" in fl and not first and m in RESIDUAL:
                s += 1
            if "RISKY" in fl and mv.damaging and hi[m] >= t.hp and not selfko and mv.meta_category != "ohko":
                s -= 5
            out[m] = -s
            continue
        s = 100
        if ("BASIC" in fl or "CHECK_BAD_MOVE" in fl) and useless(f, u, t, m):
            s -= 10
        if ("EVAL_ATTACK" in fl or "TRY_TO_FAINT" in fl) and mv.damaging and hi[m] > 0:
            kills = (hi[m] if gen >= 4 else (lo[m] + hi[m]) / 2) >= t.hp
            if kills and not (gen == 3 and selfko):
                s += 6 if mv.priority > 0 else 4
            elif hi[m] < strongest:
                s -= 1
            if (gen == 4 or "GAME_EMERALD" in fl) and rules.effectiveness(gen, mv.type, t.types) >= 4:
                s += 2
            if gen == 4 and (selfko or m in ("Focus Punch", "Sucker Punch")):
                s -= 2
        if "EXPERT" in fl or "CHECK_VIABILITY" in fl:
            if k == "heal":
                s += -3 if u.hp >= 100 else -8 if faster else -3 if u.hp >= 70 else 2
            if k == "boost":
                raised = [st for st, v in mv.self_changes.items() if v > 0]
                if any(u.st.get(st, 0) >= 3 for st in raised):
                    s -= 1
                if u.hp <= 70:
                    s -= 2
            if m in ("Toxic", "Leech Seed") and hi:
                s -= (3 if u.hp <= 50 else 0) + (3 if t.hp <= 50 else 0)
        if "SETUP_FIRST_TURN" in fl and first and k in SETUP_KINDS:
            s += 2
        if "CHECK_HP" in fl or "HP_AWARE" in fl:
            if u.hp > 70 and (selfko or k == "heal" or m in FLAILS | ENDURES):
                s -= 2
            elif u.hp <= 70 and k in ("boost", "debuff"):
                s -= 2
            if t.hp <= 30 and k in ("status", "boost", "debuff"):
                s -= 2
        if fl & {"PRIORITIZE_EXTREMES", "PREFER_POWER_EXTREMES", "PREFER_STRONGEST_MOVE"}:
            fixed = mv.damaging and (mv.power or 0) <= 1 and gen == 3
            if not mv.damaging or m in EXTREMES or "charge" in mv.flags or "recharge" in mv.flags or fixed:
                s += 2
        out[m] = s
    return out


def choose(f, u, t, ai):
    """The game's pick: the best score; among ties, the attack with the fewest expected turns."""
    sc = scores(f, u, t, ai)
    best = max(sc.values())
    tied = [m for m, v in sc.items() if v == best]
    attacks = [m for m in tied if u.moves[m].damaging]
    if len(tied) > 1:
        f.notes.add("the game breaks ties at random; the engine shows its own pick among them")
    if attacks:
        return min(attacks, key=lambda m: f.attack_score(u, t, m))
    return tied[0]
