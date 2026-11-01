"""Dialogue packs: more lines, more reply options, more narration, more choices, and whole new scenes, from one JSON file.

Anyone can write a pack: you, ChatGPT, Claude. A pack only ever adds. The base content stays in data/*.json and the code;
packs layer on top in load order:
  1. built-in packs shipped with the game:   backend/data/dialogue/*.json
  2. your packs, loaded in the app:          USER_DIR (the lab: lifeos/var/dialogue; the phone: its own storage)

A pack has up to five sections:
  texts           more lines for a text-message pool        {"chatter_school": ["did u finish the lab"]}
  replies         more reply buttons for a reply set        {"chatter_school": [["send it to me pls", "warm"]]}
  narration       more lines for the story feed             {"study.focused": ["{a} finally got the chem stuff to click."]}
  moment_choices  extra choices on an existing moment       {"rumor": [{"label": ..., "ops": [...]}]}
  scenes          brand-new moments, with rules for when they can happen and who they're about

check(pack) explains every problem in plain words, so a writer (or an AI) can fix it. guide_markdown() and PROMPT are
generated from the real game data, so they're never out of date.
"""
from __future__ import annotations

import copy
import difflib
import json
import os
import re

from .catalogs import APTITUDES, TRAITS, _base, DATA_DIR

BUILTIN_DIR = os.path.join(DATA_DIR, "dialogue")
USER_DIR = os.environ.get("LIFEOS_DIALOGUE") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "var", "dialogue")

SECTIONS = ("texts", "replies", "narration", "moment_choices", "scenes", "trivia")
PH = re.compile(r"\{(\w+)\}")
SLUG = re.compile(r"^[a-z][a-z0-9_]{2,40}$")

# ---------------------------------------------------------------------------------------- vocabulary

REPLY_TONES = {
    "warm": "Friendly. They like you a little more and feel you care.",
    "funny": "Makes them laugh. They like you more and you have a bit more fun.",
    "vent": "Honest about how you feel. Your stress drops and they feel closer.",
    "thanks": "Grateful. Same effect as warm.",
    "forgive": "You let something go. Less rivalry, more trust.",
    "flirt": "Flirty. If they're into you, attraction goes up both ways. If not, it's a little awkward.",
    "dry": "Short and flat. They feel a bit less liked.",
    "cold": "Shuts them down. They feel a lot less liked.",
    "sibling_warm": "Brother or sister only: affectionate.",
    "sibling_tease": "Brother or sister only: teasing. Barely moves anything, it's just how siblings talk.",
}

REPLY_SET_DOCS = {
    "warm": "After a good hangout ('that was fun today').",
    "awkward": "After a hangout that went badly.",
    "support": "When a friend checks on you after something bad (got cut, a fight).",
    "apology": "When someone apologizes to you.",
    "thanks": "When someone congratulates you.",
    "rumor": "When a friend says people are talking about you.",
    "chatter_plans": "A friend's random text about plans.",
    "chatter_school": "A friend's random text about school or homework.",
    "chatter_vent": "A friend venting (tired, stressed).",
    "chatter_funny": "A friend texting something funny.",
    "chatter_game": "A friend texting about a game.",
    "partner": "Your boyfriend or girlfriend texting something sweet.",
    "flirt": "Someone flirting with you.",
    "sibling": "A brother or sister texting.",
    "generic": "Anything else.",
}

POOL_DOCS = {
    "invite": "A friend asks you to hang out.",
    "invite_date": "Someone you're dating or into asks you somewhere, just the two of you.",
    "after_good": "A friend, after a good hangout.",
    "after_good_date": "After a good date.",
    "after_awkward": "After a hangout that went badly.",
    "u_ok": "A friend checks on you after something bad happened with {other}.",
    "they_apologize": "Someone apologizes after a fight.",
    "congrats_team": "A friend congratulates you on making {team}.",
    "consolation_cut": "A friend, after you got cut.",
    "congrats_award": "A friend, after you won {event}.",
    "rumor": "A friend tells you people are talking about you.",
    "chatter_partner": "Your boyfriend or girlfriend, a random sweet text.",
    "flirt_in": "Someone with a crush on you flirts.",
    "asked_out": "Someone asks you out (you answer yes or no).",
    "asked_to_dance": "Someone asks you to {event} (a dance).",
    "park_followup": "Someone you met at the dog park, about your dog {pet}.",
    "team_pregame": "Team group chat the night before a game.",
    "team_win": "Team group chat after a win.",
    "team_loss": "Team group chat after a loss.",
    "parent_pregame": "Mom or Dad in the family chat before your game.",
    "parent_win": "Mom or Dad after your team won.",
    "parent_loss": "Mom or Dad after a loss.",
    "parent_made_team": "Mom or Dad after you made {team}.",
    "parent_cut": "Mom or Dad after you got cut.",
    "parent_award": "Mom or Dad after you won {event}.",
    "parent_offer": "Mom or Dad after a scholarship offer from {college}.",
    "parent_report_proud": "Mom or Dad after a good report card.",
    "parent_report_worried": "Mom or Dad after a bad report card.",
    "parent_grounded": "Mom or Dad grounding you.",
    "parent_drafted": "Mom or Dad after you got drafted by {team}.",
    "pet_adopted": "Family chat the day a new pet comes home.",
    "pet_chores_set": "A parent confirming your pet chores ({chores}).",
    "pet_you_forgot": "A parent: you forgot a pet chore ({chore_a}).",
    "pet_you_forgot_strict": "A strict parent: you forgot a pet chore.",
    "pet_sibling_forgot": "A parent: a sibling ({who}) forgot a pet chore.",
    "pet_streak": "A parent: the pet's been happy because you've been on it.",
    "pet_sad": "A parent: the pet's been moping.",
    "pet_vet": "A parent: the pet went to the vet.",
    "pet_reminder": "A parent reminding you about a pet chore.",
    "sibling_home": "A brother or sister away at college, coming home.",
    "sibling_leaving": "A brother or sister leaving for college.",
    "sibling_chatter": "A brother or sister, random texts.",
    "coach_starting": "Your coach: you're starting.",
    "coach_bench": "Your coach: you're coming off the bench.",
    "react_warm": "How someone answers your warm reply.",
    "react_funny": "How someone answers your funny reply.",
    "react_dry": "How someone answers your dry reply.",
    "react_flirt_yes": "Someone who's into you, answering your flirt.",
    "react_flirt_no": "Someone who isn't into you, answering your flirt.",
    "react_plans_yes": "Someone saying yes to plans.",
    "react_plans_no": "Someone saying no to plans.",
    "react_parent": "Mom or Dad answering your nice reply.",
    "react_parent_annoyed": "Mom or Dad answering an attitude reply.",
    "reply_hey": "Someone answering your 'hey' (they're glad you texted).",
    "reply_hey_dry": "Someone answering your 'hey' (meh).",
    "first_hey": "YOU, texting someone first: just saying hey.",
    "first_hang": "YOU, asking someone to hang out ({place} available).",
    "first_flirt": "YOU, flirting first.",
    "first_good_luck": "YOU, wishing someone luck before their game.",
    "first_congrats": "YOU, congratulating someone.",
    "first_sorry": "YOU, apologizing.",
    "chatter_plans": "A friend, random text about plans (reply set: chatter_plans).",
    "chatter_school": "A friend, random text about school (reply set: chatter_school).",
    "chatter_vent": "A friend venting (reply set: chatter_vent).",
    "chatter_funny": "A friend texting something funny (reply set: chatter_funny).",
    "chatter_game": "A friend texting about a game (reply set: chatter_game).",
    "parent_first_day": "Mom or Dad, the first morning of high school.",
    "friend_first_day": "A friend, the first morning of high school.",
}

WHO = {
    "best_friend": "The person you like most (not family, not a coach).",
    "friend": "A random friend.",
    "crush": "The person you're most attracted to who isn't your partner.",
    "partner": "Your boyfriend or girlfriend.",
    "ex": "An ex.",
    "rival": "Your biggest rival.",
    "teammate": "A random teammate on one of your teams.",
    "classmate": "Someone in your grade you barely know.",
    "sibling": "A random brother or sister.",
    "older_sibling": "An older brother or sister.",
    "younger_sibling": "A younger brother or sister.",
    "twin": "Your twin.",
    "coach": "A coach of one of your teams.",
}

YEARS = {"freshman": (9,), "sophomore": (10,), "junior": (11,), "senior": (12,), "high_school": (9, 10, 11, 12),
         "college_freshman": (13,), "college_sophomore": (14,), "college_junior": (15,), "college_senior": (16,),
         "college": (13, 14, 15, 16)}
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
REQUIRES = {
    "dating": "You're dating someone.", "single": "You're not dating anyone.", "has_pet": "Your family has a pet.",
    "has_sibling": "You have a brother or sister.", "plays_sport": "You're on a team.",
    "in_season": "One of your teams has a game within a week.", "injured": "You're hurt.", "grounded": "You're grounded.",
    "school_day": "It's a school day.", "weekend": "It's Saturday or Sunday.", "summer": "It's summer break.",
    "in_high_school": "You're in high school.", "in_college": "You're in college.",
}
ME_STATS = {"stress": "0-100", "energy": "0-100", "social": "0-100 (low = lonely)", "fun": "0-100 (low = bored)",
            "mood": "-100 to 100", "gpa": "0.0-4.0"}
REL_FIELDS = {"familiarity": "how well you know each other", "affection": "how much you like them (-100 to 100)",
              "attraction": "romantic interest", "trust": "trust", "respect": "respect", "rivalry": "rivalry",
              "perceived": "how much you think they like you"}
NEEDS = ("energy", "social", "fun", "stress")
FOCUS_MODES = ("balanced", "athletics", "academics", "social", "romance", "family", "rest")
REP_TAGS = ("athlete", "star", "legend", "tough", "host", "performer", "gossip", "flaky", "troublemaker", "mean", "embarrassed")
SCENE_REFS = ("them", "best_friend", "sibling", "partner")
SCENE_NAMES = {"them", "them_first", "best_friend", "best_friend_first", "sibling", "sibling_first", "partner", "partner_first",
               "me_first", "school", "town", "sport", "pet"}
DEFAULT_CHANCE = 0.04
SCENE_GAP_DAYS = 5
NO_ADD = {"college_decision"}  # choices are built from your real options

# ops a pack can use: name -> (arg count, how to write it, what it does)
OPS = {
    "say": (1, '["say", "{them_first} grins. \\"owe you one.\\""]', "A line of dialogue or narration shown right after the choice."),
    "text": (2, '["text", "them", "thanks for today fr"]', "Someone (them, best_friend, sibling, partner) texts you this later today."),
    "rel": (3, '["rel", "them", "affection", 6]', "Change how YOU feel about someone (field, amount -30..30)."),
    "rel_back": (3, '["rel_back", "them", "trust", 5]', "Change how THEY feel about you."),
    "mood": (1, '["mood", 4]', "Your mood, -20..20."),
    "need": (2, '["need", "stress", -6]', "energy, social, fun or stress, -30..30."),
    "trait": (2, '["trait", "confidence", 2]', "A personality trait, -10..10 (use sparingly)."),
    "skill": (2, '["skill", "sport", 1]', "A skill, -10..10. \"sport\" means your main sport."),
    "interest": (2, '["interest", "guitar", 5]', "How into something you are, -30..30. \"sport\" works here too."),
    "rep": (2, '["rep", "tough", 3]', "Your reputation for something, -20..20."),
    "memory": (4, '["memory", "Covered for {them_first}", 0.4, 40, ["them"]]', "A memory: text, feeling (-1..1), how big (0..100), who was there."),
    "family": (2, '["family", "affection", 3]', "You and every sibling, both directions."),
    "focus": (1, '["focus", "social"]', "What you focus on next: balanced, athletics, academics, social, romance, family, rest."),
    "hang_out": (1, '["hang_out", "them"]', "Makes plans: you'll hang out with them at your next free time."),
    "remember": (1, '["remember", "covered_for_sibling"]', "Remember a fact so a later scene can depend on it."),
    "forget": (1, '["forget", "covered_for_sibling"]', "Forget a remembered fact."),
    "minigame": (3, '["minigame", "soccer_pk", {"great": [ops], "good": [ops], "miss": [ops]}, {"base": 0.5, "athletic": 0.3}]',
                 "You play a mini game; how you do (great 80%+, good 50%+, else miss) picks the ops. If nobody plays it, the odds roll instead. The choice only shows when the game is ready."),
    "chance": (3, '["chance", {"base": 0.5, "charisma": 0.3}, [ops if it works], [ops if it doesn\'t]]',
               "Roll against your own traits and talents. base 0..1, then +coef x (stat - 50)/100 for each stat."),
}


# ---------------------------------------------------------------------------------------- base data

def _texts_base() -> dict:
    return {k: v for k, v in _base("texts.json").items() if isinstance(v, list)}


def _skill_ids() -> set:
    return {s["id"] for s in _base("world.json")["skills"]}


def _interest_ids() -> set:
    w = _base("world.json")
    return {s["id"] for s in w["skills"]} | {h["id"] for h in w["hobbies"]}


def _base_reply_sets() -> dict:
    from .messages import REPLY_SETS
    return REPLY_SETS


def _names_in(*texts) -> set:
    out = set()
    for t in texts:
        if isinstance(t, str):
            out |= set(PH.findall(t))
    return out


def pool_names(pool: str) -> set:
    return _names_in(*_texts_base().get(pool, []))


def narration_names(key: str) -> set:
    return _names_in(*_base("templates.json")["templates"].get(key, [])) | {"a"}


def _moment_texts(spec) -> list:
    out = [spec.get("title", ""), spec.get("text", "")]
    def walk(x):
        if isinstance(x, str):
            out.append(x)
        elif isinstance(x, list):
            for y in x:
                walk(y)
        elif isinstance(x, dict):
            for y in x.values():
                walk(y)
    walk(spec.get("choices", []))
    return out


def moment_names(mid: str) -> set:
    spec = _base("moments.json")["moments"].get(mid, {})
    return _names_in(*_moment_texts(spec)) | {"school", "town", "best_friend"}


def moment_refs(mid: str) -> set:
    spec = _base("moments.json")["moments"].get(mid, {})
    refs = {"best_friend"}
    def walk(ops):
        for op in ops or []:
            if not isinstance(op, list) or not op:
                continue
            if op[0] in ("rel", "rel_back") and len(op) > 1:
                refs.add(op[1])
            if op[0] == "memory" and len(op) > 4 and isinstance(op[4], list):
                refs.update(op[4])
            if op[0] == "chance" and len(op) > 3:
                walk(op[2])
                walk(op[3])
    for ch in spec.get("choices", []):
        walk(ch.get("ops"))
    people = {"other", "sibling", "coach", "origin", "roommate", "best_friend"}
    return (refs | (moment_names(mid) & people)) - {"school", "town"}


# ---------------------------------------------------------------------------------------- checking

class _Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append(f"{where}: {msg}" if where else msg)

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}" if where else msg)


def _suggest(word, options) -> str:
    near = difflib.get_close_matches(str(word), list(options), n=3, cutoff=0.5)
    return f" Did you mean {', '.join(near)}?" if near else ""


def _check_line(R, where, s, allowed, max_len=240):
    if not isinstance(s, str) or not s.strip():
        R.err(where, "needs to be a non-empty piece of text")
        return False
    if len(s) > max_len:
        R.err(where, f"is {len(s)} characters; keep it under {max_len}")
        return False
    bad = set(PH.findall(s)) - set(allowed)
    if bad:
        ok = ", ".join("{" + a + "}" for a in sorted(allowed)) or "none"
        R.err(where, f"uses {', '.join('{' + b + '}' for b in sorted(bad))}, which isn't filled in here. Allowed: {ok}")
        return False
    if s.count("{") != s.count("}"):
        R.err(where, "has an unmatched { or }")
        return False
    return True


def _num(R, where, v, lo, hi):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        R.err(where, f"needs a number ({lo} to {hi})")
        return False
    if not lo <= v <= hi:
        R.err(where, f"is {v}; keep it between {lo} and {hi}")
        return False
    return True


def _check_ops(R, where, ops, refs, names, depth=0):
    if not isinstance(ops, list):
        R.err(where, "ops must be a list like [[\"mood\", 3], [\"say\", \"...\"]]")
        return
    for i, op in enumerate(ops):
        w = f"{where}[{i}]"
        if not isinstance(op, list) or not op or not isinstance(op[0], str):
            R.err(w, 'each op is a list that starts with its name, like ["mood", 3]')
            continue
        name, args = op[0], op[1:]
        if name not in OPS:
            R.err(w, f"'{name}' isn't an op.{_suggest(name, OPS)} Ops: {', '.join(OPS)}")
            continue
        n = OPS[name][0]
        if len(args) != n:
            R.err(w, f"{name} takes {n} value{'s' if n != 1 else ''}, like {OPS[name][1]}")
            continue
        ref_ok = lambda r: r in refs or R.err(w, f"'{r}' isn't someone this can refer to here. Use one of: {', '.join(sorted(refs)) or 'nobody'}")  # noqa: E731
        if name == "say":
            _check_line(R, w, args[0], names, 300)
        elif name == "text":
            if args[0] in refs:
                _check_line(R, w, args[1], names, 200)
            else:
                ref_ok(args[0])
        elif name in ("rel", "rel_back"):
            if args[0] in refs:
                if args[1] not in REL_FIELDS:
                    R.err(w, f"'{args[1]}' isn't a relationship field. Use: {', '.join(REL_FIELDS)}")
                _num(R, w, args[2], -30, 30)
            else:
                ref_ok(args[0])
        elif name == "mood":
            _num(R, w, args[0], -20, 20)
        elif name == "need":
            if args[0] not in NEEDS:
                R.err(w, f"'{args[0]}' isn't a need. Use: {', '.join(NEEDS)}")
            _num(R, w, args[1], -30, 30)
        elif name == "trait":
            if args[0] not in TRAITS:
                R.err(w, f"'{args[0]}' isn't a trait.{_suggest(args[0], TRAITS)} Traits: {', '.join(TRAITS)}")
            _num(R, w, args[1], -10, 10)
        elif name == "skill":
            if args[0] != "sport" and args[0] not in _skill_ids():
                R.err(w, f"'{args[0]}' isn't a skill.{_suggest(args[0], _skill_ids())}")
            _num(R, w, args[1], -10, 10)
        elif name == "interest":
            if args[0] != "sport" and args[0] not in _interest_ids():
                R.err(w, f"'{args[0]}' isn't something people get into here.{_suggest(args[0], _interest_ids())}")
            _num(R, w, args[1], -30, 30)
        elif name == "rep":
            if not isinstance(args[0], str) or not SLUG.match(args[0]):
                R.err(w, "a reputation tag is one lowercase word, like tough or flaky")
            elif args[0] not in REP_TAGS:
                R.warn(w, f"'{args[0]}' is a new reputation tag (known: {', '.join(REP_TAGS)})")
            _num(R, w, args[1], -20, 20)
        elif name == "memory":
            _check_line(R, w, args[0], names, 120)
            _num(R, w, args[1], -1, 1)
            _num(R, w, args[2], 0, 100)
            if not isinstance(args[3], list):
                R.err(w, 'the last value is a list of who was there, like ["them"] (or [] for nobody)')
            else:
                for r in args[3]:
                    ref_ok(r)
        elif name == "family":
            if args[0] not in REL_FIELDS:
                R.err(w, f"'{args[0]}' isn't a relationship field. Use: {', '.join(REL_FIELDS)}")
            _num(R, w, args[1], -20, 20)
        elif name == "focus":
            if args[0] not in FOCUS_MODES:
                R.err(w, f"focus is one of {', '.join(FOCUS_MODES)}")
        elif name == "hang_out":
            ref_ok(args[0])
        elif name in ("remember", "forget"):
            if not isinstance(args[0], str) or not SLUG.match(args[0]):
                R.err(w, "a remembered fact is a short lowercase name with underscores, like covered_for_sibling")
        elif name == "minigame":
            from .minigames import reg
            game, tiers, spec = args
            games = reg()["games"]
            if game != "sport" and game not in games:
                R.err(w, f"'{game}' isn't a mini game.{_suggest(game, games)} Games: {', '.join(games)}")
            if not isinstance(tiers, dict) or not tiers or any(k not in ("great", "good", "miss") for k in tiers):
                R.err(w, 'the second value maps great / good / miss to ops, like {"great": [["mood", 4]], "miss": [["need", "stress", 3]]}')
            else:
                for tk, tops in tiers.items():
                    _check_ops(R, f"{w} ({tk})", tops, refs, names, depth + 1)
            if not isinstance(spec, dict) or "base" not in spec:
                R.err(w, 'the last value is the odds if nobody plays, like {"base": 0.5, "athletic": 0.3}')
        elif name == "chance":
            spec, ok_ops, bad_ops = args
            if not isinstance(spec, dict) or "base" not in spec:
                R.err(w, 'chance starts with odds like {"base": 0.5, "charisma": 0.3}')
            else:
                stats = set(TRAITS) | set(APTITUDES) | _skill_ids()
                for k, v in spec.items():
                    if k == "base":
                        _num(R, w + ".base", v, 0, 1)
                    elif k not in stats:
                        R.err(w, f"'{k}' isn't a trait, talent or skill to roll against.{_suggest(k, stats)}")
                    else:
                        _num(R, f"{w}.{k}", v, -1, 1)
            if depth > 2:
                R.err(w, "chance inside chance inside chance is too deep")
            else:
                _check_ops(R, w + " (if it works)", ok_ops, refs, names, depth + 1)
                _check_ops(R, w + " (if it doesn't)", bad_ops, refs, names, depth + 1)


def _check_choice(R, where, ch, refs, names):
    if not isinstance(ch, dict):
        R.err(where, 'a choice looks like {"label": "...", "ops": [...]}')
        return
    for k in ch:
        if k not in ("label", "hint", "fits", "ops"):
            R.warn(where, f"'{k}' is ignored (a choice has label, hint, fits, ops)")
    _check_line(R, where + ".label", ch.get("label"), names, 100)
    if ch.get("hint") is not None:
        _check_line(R, where + ".hint", ch["hint"], names, 140)
    fits = ch.get("fits", {})
    if not isinstance(fits, dict):
        R.err(where + ".fits", 'fits looks like {"empathy": 1, "impulsivity": -0.5}')
    else:
        for k, v in fits.items():
            if k not in TRAITS:
                R.err(where + ".fits", f"'{k}' isn't a trait.{_suggest(k, TRAITS)}")
            else:
                _num(R, f"{where}.fits.{k}", v, -2, 2)
    _check_ops(R, where + ".ops", ch.get("ops", []), refs, names)


def _check_range(R, where, rng, lo, hi):
    if not (isinstance(rng, list) and len(rng) == 2):
        R.err(where, f"is a range like [{lo}, {hi}]")
        return
    _num(R, where, rng[0], lo, hi)
    _num(R, where, rng[1], lo, hi)


def _check_scene(R, where, sc, seen_ids):
    base_moments = _base("moments.json")["moments"]
    if not isinstance(sc, dict):
        R.err(where, "a scene is an object with id, title, text, choices")
        return
    sid = sc.get("id")
    if not isinstance(sid, str) or not SLUG.match(sid):
        R.err(where + ".id", "needs a short lowercase id with underscores, like cover_for_me")
    elif sid in base_moments:
        R.err(where + ".id", f"'{sid}' is already a moment in the game; pick another id")
    elif sid in seen_ids:
        R.err(where + ".id", f"'{sid}' is used twice")
    else:
        seen_ids.add(sid)
    for k in sc:
        if k not in ("id", "title", "text", "who", "when", "choices", "notes"):
            R.warn(where, f"'{k}' is ignored (a scene has id, title, text, who, when, choices)")
    who = sc.get("who")
    if who is not None and who not in WHO:
        R.err(where + ".who", f"'{who}' isn't a kind of person.{_suggest(who, WHO)} Use: {', '.join(WHO)}")
    names = set(SCENE_NAMES)
    refs = set(SCENE_REFS)
    if not who:
        names -= {"them", "them_first"}
        refs -= {"them"}
    _check_line(R, where + ".title", sc.get("title"), names, 80)
    _check_line(R, where + ".text", sc.get("text"), names, 700)
    when = sc.get("when", {})
    if not isinstance(when, dict):
        R.err(where + ".when", "when is an object, like {\"chance\": 0.05, \"years\": [\"freshman\"]}")
        when = {}
    allowed_when = {"chance", "years", "months", "dates", "weekdays", "requires", "you_feel", "they_feel", "me",
                    "remembered", "not_remembered", "once", "cooldown_days"}
    for k, v in when.items():
        w = f"{where}.when.{k}"
        if k not in allowed_when:
            R.err(w, f"isn't a condition.{_suggest(k, allowed_when)} Conditions: {', '.join(sorted(allowed_when))}")
        elif k == "chance":
            _num(R, w, v, 0.001, 1)
        elif k == "years":
            for y in v if isinstance(v, list) else [v]:
                if y not in YEARS:
                    R.err(w, f"'{y}' isn't a school year. Use: {', '.join(YEARS)}")
        elif k == "months":
            for m in v if isinstance(v, list) else [v]:
                _num(R, w, m, 1, 12)
        elif k == "dates":
            for d in v if isinstance(v, list) else [v]:
                if not (isinstance(d, str) and re.match(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$", d)):
                    R.err(w, f"'{d}' should look like \"10-31\" (month-day)")
        elif k == "weekdays":
            for d in v if isinstance(v, list) else [v]:
                if d not in WEEKDAYS:
                    R.err(w, f"'{d}' isn't a weekday. Use: {', '.join(WEEKDAYS)}")
        elif k == "requires":
            for r in v if isinstance(v, list) else [v]:
                if r not in REQUIRES:
                    R.err(w, f"'{r}' isn't something a scene can require.{_suggest(r, REQUIRES)} Use: {', '.join(REQUIRES)}")
        elif k in ("you_feel", "they_feel"):
            if not who:
                R.err(w, "only works when the scene is about someone (set who)")
            elif not isinstance(v, dict):
                R.err(w, 'looks like {"affection": [40, 100]}')
            else:
                for f, rng in v.items():
                    if f not in REL_FIELDS:
                        R.err(w, f"'{f}' isn't a relationship field. Use: {', '.join(REL_FIELDS)}")
                    else:
                        _check_range(R, f"{w}.{f}", rng, -100, 100)
        elif k == "me":
            if not isinstance(v, dict):
                R.err(w, 'looks like {"stress": [60, 100]}')
            else:
                for f, rng in v.items():
                    if f not in ME_STATS:
                        R.err(w, f"'{f}' isn't one of your stats. Use: {', '.join(ME_STATS)}")
                    else:
                        _check_range(R, f"{w}.{f}", rng, -100 if f == "mood" else 0, 4 if f == "gpa" else 100)
        elif k in ("remembered", "not_remembered"):
            for r in v if isinstance(v, list) else [v]:
                if not isinstance(r, str) or not SLUG.match(r):
                    R.err(w, f"'{r}' should be a short lowercase name with underscores")
        elif k == "once":
            if not isinstance(v, bool):
                R.err(w, "is true or false")
        elif k == "cooldown_days":
            _num(R, w, v, 1, 2000)
    chs = sc.get("choices")
    if not isinstance(chs, list) or not 2 <= len(chs) <= 4:
        R.err(where + ".choices", "a scene needs 2 to 4 choices")
        chs = chs if isinstance(chs, list) else []
    for i, ch in enumerate(chs):
        _check_choice(R, f"{where}.choices[{i}]", ch, refs, names)


def parse_text(text: str) -> dict:
    """A pack from a file or a paste: plain JSON, or ChatGPT's answer with the JSON somewhere inside it."""
    t = text.strip().lstrip("﻿")
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", t)
    if fence:
        t = fence.group(1)
    else:
        a, b = t.find("{"), t.rfind("}")
        if a < 0 or b < a:
            raise ValueError("There's no dialogue pack in that text (it should be a JSON block that starts with { and ends with }).")
        t = t[a:b + 1]
    try:
        data = json.loads(t)
    except json.JSONDecodeError as e:
        raise ValueError(f"That JSON has a mistake near line {e.lineno}, column {e.colno}: {e.msg}. "
                         "Ask ChatGPT to send the pack again as valid JSON.") from None
    if not isinstance(data, dict):
        raise ValueError("A dialogue pack is a JSON object (it starts with {).")
    return data


def check(pack: dict) -> dict:
    """Every problem with a pack, in plain words. errors stop it from loading; warnings don't."""
    R = _Report()
    if not isinstance(pack, dict):
        R.err("", "a dialogue pack is a JSON object")
        return {"ok": False, "errors": R.errors, "warnings": R.warnings, "summary": {}}
    if not any(k in pack for k in SECTIONS):
        R.err("", f"there's nothing in this pack. Add at least one of: {', '.join(SECTIONS)}")
    if pack.get("dialogue_pack") not in (1, None):
        R.warn("dialogue_pack", "should be 1")
    name = pack.get("name")
    if not isinstance(name, str) or not name.strip():
        R.err("name", "give the pack a short name, like \"Freshman fall\"")
    elif len(name) > 60:
        R.err("name", "keep the name under 60 characters")
    for k in pack:
        if k not in SECTIONS + ("dialogue_pack", "name", "author", "notes", "version"):
            R.warn(k, f"isn't part of a pack and is ignored.{_suggest(k, SECTIONS)}")
    base_texts = _texts_base()
    added = {"texts": 0, "replies": 0, "narration": 0, "moment_choices": 0, "scenes": 0, "duplicates": 0}

    texts = pack.get("texts", {})
    if not isinstance(texts, dict):
        R.err("texts", 'is an object of pool names to lists of lines, like {"chatter_school": ["..."]}')
        texts = {}
    for pool, lines in texts.items():
        w = f"texts.{pool}"
        if pool not in base_texts:
            R.err(w, f"there's no '{pool}' pool.{_suggest(pool, base_texts)}")
            continue
        if not isinstance(lines, list):
            R.err(w, "is a list of lines")
            continue
        have = {x.lower().strip() for x in base_texts[pool]}
        allowed = pool_names(pool)
        for i, s in enumerate(lines):
            if _check_line(R, f"{w}[{i}]", s, allowed, 200):
                if s.lower().strip() in have:
                    added["duplicates"] += 1
                else:
                    have.add(s.lower().strip())
                    added["texts"] += 1

    replies = pack.get("replies", {})
    if not isinstance(replies, dict):
        R.err("replies", 'is an object of reply sets to options, like {"chatter_school": [["on it", "warm"]]}')
        replies = {}
    sets = _base_reply_sets()
    for rs, opts in replies.items():
        w = f"replies.{rs}"
        if rs not in sets:
            R.err(w, f"there's no '{rs}' reply set.{_suggest(rs, sets)} Sets: {', '.join(sets)}")
            continue
        if not isinstance(opts, list):
            R.err(w, 'is a list of [label, tone] pairs, like [["lmao same", "funny"]]')
            continue
        for i, o in enumerate(opts):
            label, tone = (o.get("label"), o.get("tone")) if isinstance(o, dict) else (o if isinstance(o, list) and len(o) == 2 else (None, None))
            if label is None:
                R.err(f"{w}[{i}]", 'each option is ["what you say", "tone"]')
                continue
            if _check_line(R, f"{w}[{i}]", label, set(), 80):
                if tone not in REPLY_TONES:
                    R.err(f"{w}[{i}]", f"'{tone}' isn't a tone.{_suggest(tone, REPLY_TONES)} Tones: {', '.join(REPLY_TONES)}")
                elif tone.startswith("sibling") and rs != "sibling":
                    R.err(f"{w}[{i}]", "sibling tones only work in the sibling reply set")
                else:
                    added["replies"] += 1

    narration = pack.get("narration", {})
    if not isinstance(narration, dict):
        R.err("narration", 'is an object like {"study.focused": ["{a} ..."]}')
        narration = {}
    templates = _base("templates.json")["templates"]
    for key, lines in narration.items():
        w = f"narration.{key}"
        if key not in templates:
            R.err(w, f"there's no '{key}' narration.{_suggest(key, templates)}")
            continue
        if not isinstance(lines, list):
            R.err(w, "is a list of lines")
            continue
        for i, s in enumerate(lines):
            if _check_line(R, f"{w}[{i}]", s, narration_names(key), 240):
                added["narration"] += 1

    mc = pack.get("moment_choices", {})
    if not isinstance(mc, dict):
        R.err("moment_choices", 'is an object like {"rumor": [{"label": "...", "ops": [...]}]}')
        mc = {}
    base_moments = _base("moments.json")["moments"]
    for mid, chs in mc.items():
        w = f"moment_choices.{mid}"
        if mid not in base_moments:
            R.err(w, f"there's no '{mid}' moment.{_suggest(mid, base_moments)}")
            continue
        if mid in NO_ADD or base_moments[mid].get("dynamic"):
            R.err(w, f"{mid}'s choices come from the game itself, so they can't be added to")
            continue
        if not isinstance(chs, list):
            R.err(w, "is a list of choices")
            continue
        if len(base_moments[mid].get("choices", [])) + len(chs) > 5:
            R.err(w, "a moment can have at most 5 choices in all")
        for i, ch in enumerate(chs):
            _check_choice(R, f"{w}[{i}]", ch, moment_refs(mid), moment_names(mid))
            added["moment_choices"] += 1

    tv = pack.get("trivia", {})
    added["trivia"] = 0
    if not isinstance(tv, dict):
        R.err("trivia", 'is an object of subjects to questions, like {"biology": [{"q": "...", "a": "...", "w": ["...", "...", "..."], "g": 9}]}')
        tv = {}
    from .trivia import bank as _tbank
    tsubs = _tbank()["subjects"]
    have_q = {q["q"].lower() for qs in _tbank()["questions"].values() for q in qs}
    for sub, qs in tv.items():
        w = f"trivia.{sub}"
        if sub not in tsubs or sub == "math":
            R.err(w, f"'{sub}' isn't a trivia subject (math is generated).{_suggest(sub, [k for k in tsubs if k != 'math'])} Subjects: {', '.join(k for k in tsubs if k != 'math')}")
            continue
        if not isinstance(qs, list):
            R.err(w, "is a list of questions")
            continue
        for i, q in enumerate(qs):
            wq = f"{w}[{i}]"
            if not isinstance(q, dict):
                R.err(wq, 'a question looks like {"q": "...", "a": "right answer", "w": ["wrong", "wrong", "wrong"], "g": 9}')
                continue
            ok = _check_line(R, wq + ".q", q.get("q"), set(), 200) and _check_line(R, wq + ".a", q.get("a"), set(), 80)
            wr = q.get("w")
            if not isinstance(wr, list) or len(wr) != 3 or not all(isinstance(x, str) and x.strip() for x in wr):
                R.err(wq + ".w", "needs exactly three wrong answers")
                ok = False
            elif ok and (len({x.strip().lower() for x in wr} | {q["a"].strip().lower()}) != 4):
                R.err(wq + ".w", "the four answers have to be different from each other")
                ok = False
            if q.get("g") is not None and (isinstance(q["g"], bool) or not isinstance(q["g"], int) or not 9 <= q["g"] <= 13):
                R.err(wq + ".g", "g is the lowest grade it fits: 9, 10, 11, 12, or 13 for college")
                ok = False
            if ok:
                if q["q"].lower() in have_q:
                    added["duplicates"] += 1
                else:
                    added["trivia"] += 1
    scenes = pack.get("scenes", [])
    if not isinstance(scenes, list):
        R.err("scenes", "is a list of scenes")
        scenes = []
    seen = set()
    for i, sc in enumerate(scenes):
        _check_scene(R, f"scenes[{i}]" + (f" ({sc.get('id')})" if isinstance(sc, dict) and sc.get("id") else ""), sc, seen)
        added["scenes"] += 1
    if added["duplicates"]:
        R.warn("texts", f"{added['duplicates']} line{'s are' if added['duplicates'] != 1 else ' is'} already in the game and will be skipped")
    return {"ok": not R.errors, "errors": R.errors, "warnings": R.warnings, "summary": added}


# ---------------------------------------------------------------------------------------- packs on disk

def _slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", (s or "pack").lower()).strip("_")
    return (s or "pack")[:40]


def _state_path():
    return os.path.join(USER_DIR, "state.json")


def _state() -> dict:
    try:
        with open(_state_path(), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"disabled": []}


def _save_state(st):
    os.makedirs(USER_DIR, exist_ok=True)
    tmp = _state_path() + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(st, f)
    os.replace(tmp, _state_path())


def _read_dir(folder, source):
    out = []
    if not os.path.isdir(folder):
        return out
    for fn in sorted(os.listdir(folder)):
        if not fn.endswith(".json") or fn == "state.json":
            continue
        pid = f"{source}:{fn[:-5]}"
        try:
            with open(os.path.join(folder, fn), encoding="utf-8") as f:
                data = json.load(f)
            rep = check(data)
        except (OSError, ValueError) as e:
            data, rep = {}, {"ok": False, "errors": [f"couldn't read it: {e}"], "warnings": [], "summary": {}}
        out.append({"id": pid, "file": fn, "source": source, "pack": data, "check": rep})
    return out


def packs() -> list:
    """Every pack the game knows about, in load order, with whether it's on and what it adds."""
    disabled = set(_state().get("disabled", []))
    out = []
    for p in _read_dir(BUILTIN_DIR, "builtin") + _read_dir(USER_DIR, "yours"):
        p["enabled"] = p["id"] not in disabled and p["check"]["ok"]
        out.append(p)
    return out


def pack_summary(p) -> dict:
    pk = p["pack"]
    return {"id": p["id"], "name": pk.get("name") or p["file"], "author": pk.get("author"), "notes": pk.get("notes"),
            "source": p["source"], "enabled": p["enabled"], "ok": p["check"]["ok"], "errors": p["check"]["errors"][:20],
            "warnings": p["check"]["warnings"][:20], "summary": p["check"]["summary"],
            "scenes": [{"id": s.get("id"), "title": s.get("title"), "who": s.get("who")} for s in pk.get("scenes", []) if isinstance(s, dict)]}


def add_pack(data: dict) -> dict:
    rep = check(data)
    if not rep["ok"]:
        return {"ok": False, **rep}
    os.makedirs(USER_DIR, exist_ok=True)
    base = _slug(data.get("name"))
    fn = f"{base}.json"
    path = os.path.join(USER_DIR, fn)
    with open(path + ".tmp", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    os.replace(path + ".tmp", path)
    st = _state()
    st["disabled"] = [d for d in st.get("disabled", []) if d != f"yours:{base}"]
    _save_state(st)
    reload()
    return {"ok": True, "id": f"yours:{base}", **rep}


def set_enabled(pid: str, on: bool):
    if not any(p["id"] == pid for p in packs()):
        raise KeyError(pid)
    st = _state()
    dis = set(st.get("disabled", []))
    (dis.discard if on else dis.add)(pid)
    st["disabled"] = sorted(dis)
    _save_state(st)
    reload()


def remove_pack(pid: str):
    src, _, name = pid.partition(":")
    if src != "yours":
        raise ValueError("built-in packs can be turned off, not removed")
    path = os.path.join(USER_DIR, f"{name}.json")
    if not os.path.exists(path):
        raise KeyError(pid)
    os.remove(path)
    reload()


# ---------------------------------------------------------------------------------------- merged content

_cache: dict = {}


def reload():
    _cache.clear()


NEEDABLE = {"them": "them", "them_first": "them", "best_friend": "best_friend", "best_friend_first": "best_friend",
            "sibling": "sibling", "sibling_first": "sibling", "partner": "partner", "partner_first": "partner", "pet": "pet"}


def needs(obj) -> list:
    """Who has to exist for this text or choice to make sense ({sibling_first}, ["rel", "partner", ...], ...)."""
    out = set()
    def walk(x, in_ops=False):
        if isinstance(x, str):
            out.update(NEEDABLE[n] for n in PH.findall(x) if n in NEEDABLE)
        elif isinstance(x, dict):
            for k, v in x.items():
                if k not in ("fits", "requires"):
                    walk(v, in_ops or k == "ops")
        elif isinstance(x, list):
            if in_ops and x and isinstance(x[0], str) and x[0] in ("rel", "rel_back", "text", "hang_out") and len(x) > 1 and x[1] in NEEDABLE:
                out.add(NEEDABLE[x[1]])
            if in_ops and x and x[0] == "memory" and len(x) > 4 and isinstance(x[4], list):
                out.update(NEEDABLE[r] for r in x[4] if r in NEEDABLE)
            for y in x:
                walk(y, in_ops)
    walk(obj)
    return sorted(out)


def _with_needs(ch) -> dict:
    ch = dict(ch, fits=ch.get("fits", {}), ops=ch.get("ops", []))
    n = needs({"label": ch.get("label"), "hint": ch.get("hint"), "ops": ch["ops"]})
    if n:
        ch["requires"] = n
    return ch


def _build() -> dict:
    texts = copy.deepcopy(_texts_base())
    templates = copy.deepcopy(_base("templates.json")["templates"])
    moments = copy.deepcopy(_base("moments.json")["moments"])
    replies = {k: list(v) for k, v in _base_reply_sets().items()}
    loaded = []
    trivia_extra: dict = {}
    for p in packs():
        if not p["enabled"]:
            continue
        pk = p["pack"]
        loaded.append(p["id"])
        for pool, lines in (pk.get("texts") or {}).items():
            have = {x.lower().strip() for x in texts[pool]}
            for s in lines:
                if s.lower().strip() not in have:
                    texts[pool].append(s)
                    have.add(s.lower().strip())
        for rs, opts in (pk.get("replies") or {}).items():
            have = {l.lower() for l, _ in replies[rs]}
            for o in opts:
                label, tone = (o["label"], o["tone"]) if isinstance(o, dict) else (o[0], o[1])
                if label.lower() not in have:
                    replies[rs].append((label, tone))
                    have.add(label.lower())
        for key, lines in (pk.get("narration") or {}).items():
            templates[key] = templates[key] + [s for s in lines if s not in templates[key]]
        for mid, chs in (pk.get("moment_choices") or {}).items():
            moments[mid]["choices"] = moments[mid]["choices"] + [_with_needs(ch) for ch in chs]
        for sub, qs in (pk.get("trivia") or {}).items():
            trivia_extra.setdefault(sub, []).extend({"q": q["q"], "a": q["a"], "w": list(q["w"]), "g": q.get("g", 9)} for q in qs)
        for sc in pk.get("scenes") or []:
            if sc["id"] in moments:
                continue  # an earlier pack already has a scene with this id
            moments[sc["id"]] = {"title": sc["title"], "text": sc["text"],
                                 "choices": [_with_needs(ch) for ch in sc["choices"]],
                                 "scene": {"who": sc.get("who"), "when": sc.get("when", {}), "pack": p["id"],
                                           "needs": needs({"title": sc["title"], "text": sc["text"]})}}
    return {"texts": texts, "templates": templates, "moments": moments, "replies": replies, "trivia": trivia_extra, "loaded": loaded}


def merged() -> dict:
    if "m" not in _cache:
        _cache["m"] = _build()
    return _cache["m"]


def texts() -> dict:
    return merged()["texts"]


def templates() -> dict:
    return merged()["templates"]


def moments() -> dict:
    return merged()["moments"]


def reply_sets() -> dict:
    return merged()["replies"]


# ---------------------------------------------------------------------------------------- scenes in play

def _rel(w, a, b, f):
    r = w.rels.get((a, b))
    return getattr(r, f, 0.0) if r else 0.0


def _family(sim, me):
    return set(sim.siblings(me.id))


def candidates(sim, me, who) -> list:
    """People who fit 'who', best fit first (for the 'best' kinds) or in a fixed order (for the random kinds)."""
    w = sim.w
    fam = _family(sim, me)
    ok = lambda o: o in w.chars and w.chars[o].status == "active" and o != me.id  # noqa: E731
    known = [o for o in w.out.get(me.id, {}) if ok(o)]
    people = [o for o in known if w.chars[o].role != "staff" and o not in fam]
    thr = w.rules.get("rel.friend_threshold", 35)
    if who == "best_friend":
        return sorted([o for o in people if _rel(w, me.id, o, "affection") >= thr * 0.8], key=lambda o: -_rel(w, me.id, o, "affection"))[:1]
    if who == "friend":
        return sorted(o for o in people if _rel(w, me.id, o, "affection") >= thr)
    if who == "crush":
        partner = me.flags.get("partner")
        return sorted([o for o in people if o != partner and _rel(w, me.id, o, "attraction") >= 30],
                      key=lambda o: -_rel(w, me.id, o, "attraction"))[:1]
    if who == "partner":
        p = me.flags.get("partner")
        return [p] if p and ok(p) else []
    if who == "ex":
        return sorted(o for o in people if w.has_role(me.id, o, "ex"))
    if who == "rival":
        riv = lambda o: max(_rel(w, me.id, o, "rivalry"), _rel(w, o, me.id, "rivalry"))  # noqa: E731
        return sorted([o for o in people if riv(o) >= 30], key=lambda o: -riv(o))[:1]
    if who == "teammate":
        mates = set()
        for gid in me.memberships:
            g = w.groups.get(gid)
            if g and g.get("skill") in sim.cat.sports["sports"]:
                mates |= {m for m in g["members"] if ok(m) and m not in fam}
        return sorted(mates)
    if who == "classmate":
        return sorted(c.id for c in w.students() if ok(c.id) and c.grade == me.grade and c.school == me.school
                      and c.id not in fam and _rel(w, me.id, c.id, "familiarity") < 30)
    if who in ("sibling", "older_sibling", "younger_sibling", "twin"):
        sibs = [s for s in sim.siblings(me.id) if ok(s)]
        g = me.grade or 9
        if who == "older_sibling":
            sibs = [s for s in sibs if (w.chars[s].grade or 99) > g]
        elif who == "younger_sibling":
            sibs = [s for s in sibs if (w.chars[s].grade or 0) < g]
        elif who == "twin":
            sibs = [s for s in sibs if w.has_role(me.id, s, "twin")]
        return sibs
    if who == "coach":
        return sorted({w.groups[g].get("staff") for g in me.memberships if w.groups.get(g, {}).get("staff") and ok(w.groups[g]["staff"])})
    return []


def _requirement(sim, me, r) -> bool:
    from . import calendar as calm
    w = sim.w
    cal = sim.cat.world["calendar"]
    if r == "dating":
        return bool(me.flags.get("partner"))
    if r == "single":
        return not me.flags.get("partner")
    if r == "has_pet":
        h = w.households.get(me.household_id) or {}
        return bool(h.get("pet")) or any(p.get("household") == me.household_id and p.get("status") == "home" for p in w.meta.get("pets", {}).values())
    if r == "has_sibling":
        return bool(sim.siblings(me.id))
    if r == "plays_sport":
        return any(w.groups.get(g, {}).get("skill") in sim.cat.sports["sports"] for g in me.memberships)
    if r == "in_season":
        return any(i["kind"] == "game" and i.get("group") in me.memberships and abs(i["day"] - w.day) <= 7 for i in w.calendar)
    if r == "injured":
        return me.flags.get("injured_until", -1) >= w.day
    if r == "grounded":
        return me.flags.get("grounded_until", -1) >= w.day
    if r == "school_day":
        return calm.is_school_day(w.day, cal)
    if r == "weekend":
        return calm.date_of(w.day).weekday() >= 5
    if r == "summer":
        return calm.break_name(w.day, cal) == "Summer"
    if r == "in_high_school":
        return (me.grade or 0) <= 12
    if r == "in_college":
        return (me.grade or 0) >= 13
    return False


def _remembered_who(w, key):
    v = w.meta.get("remembered", {}).get(key)
    return v.get("them") if isinstance(v, dict) else None


def _in(v, rng):
    return rng[0] <= v <= rng[1]


def _when_ok(sim, me, sid, when, ignore_time=False) -> bool:
    from . import calendar as calm
    w = sim.w
    seen = w.meta.get("scenes_seen", {}).get(sid, [])
    if not ignore_time:
        if seen and when.get("once", True):
            return False
        if seen and when.get("cooldown_days") and w.day - seen[-1] < when["cooldown_days"]:
            return False
        d = calm.date_of(w.day)
        if when.get("dates") and f"{d.month:02d}-{d.day:02d}" not in when["dates"]:
            return False
        if when.get("months") and d.month not in when["months"]:
            return False
        if when.get("weekdays") and WEEKDAYS[d.weekday()] not in when["weekdays"]:
            return False
    if when.get("years") and not any((me.grade or 0) in YEARS[y] for y in when["years"]):
        return False
    for r in when.get("requires", []):
        if not _requirement(sim, me, r):
            return False
    mem = w.meta.get("remembered", {})
    if any(k not in mem for k in when.get("remembered", [])) or any(k in mem for k in when.get("not_remembered", [])):
        return False
    for f, rng in (when.get("me") or {}).items():
        v = me.mood if f == "mood" else me.gpa if f == "gpa" else me.needs.get(f, 50)
        if not _in(v, rng):
            return False
    return True


def _context(sim, me, who, when, rng) -> dict | None:
    """Who the scene is about and everything its text can say. None if nobody fits."""
    w = sim.w
    ctx = {"me_first": me.first}
    if who:
        cands = candidates(sim, me, who)
        about = [_remembered_who(w, k) for k in when.get("remembered", [])]
        about = [a for a in about if a in cands]
        if about:  # a follow-up scene stays with the person the fact was about
            cands = about[:1]
        cands = [o for o in cands
                 if all(_in(_rel(w, me.id, o, f), r) for f, r in (when.get("you_feel") or {}).items())
                 and all(_in(_rel(w, o, me.id, f), r) for f, r in (when.get("they_feel") or {}).items())]
        if not cands:
            return None
        them = cands[0] if who in ("best_friend", "crush", "rival", "partner") else cands[int(rng.random() * len(cands))]
        ctx["them"] = them
        ctx["them_first"] = w.chars[them].first
    best = candidates(sim, me, "best_friend")
    if best:
        ctx["best_friend"] = best[0]
        ctx["best_friend_first"] = w.chars[best[0]].first
    sibs = [s for s in sim.siblings(me.id) if s != ctx.get("them") and w.chars[s].status == "active"]
    if sibs:
        s = sibs[int(rng.random() * len(sibs))]
        ctx["sibling"] = s
        ctx["sibling_first"] = w.chars[s].first
    p = me.flags.get("partner")
    if p in w.chars:
        ctx["partner"] = p
        ctx["partner_first"] = w.chars[p].first
    sports = [g.get("skill") for g in (w.groups.get(x, {}) for x in me.memberships) if g.get("skill") in sim.cat.sports["sports"]]
    if not sports:
        sports = sorted((s for s in sim.cat.sports["sports"]), key=lambda s: -me.interests.get(s, 0))[:1]
    if sports:
        ctx["sport"] = sports[0]
    h = w.households.get(me.household_id) or {}
    pets = [p for p in w.meta.get("pets", {}).values() if p.get("household") == me.household_id and p.get("status") == "home"]
    if pets or h.get("pet"):
        ctx["pet"] = pets[0]["name"] if pets else h["pet"]["name"]
    return ctx


def _playable(spec, ctx) -> bool:
    """Everyone the scene mentions exists, and at least two choices still make sense."""
    if any(not ctx.get(n) for n in spec["scene"].get("needs", [])):
        return False
    usable = [ch for ch in spec["choices"] if not any(not ctx.get(r) for r in ch.get("requires", []))]
    return len(usable) >= 2


def maybe_scene(sim):
    """Once a morning in story mode: maybe one scene from the packs happens today."""
    w = sim.w
    pid = w.meta.get("protagonist")
    me = w.chars.get(pid) if pid else None
    if not me or me.status != "active" or "story" not in w.meta:
        return None
    from . import moments as mo
    busy = bool(mo.pending(w))  # another moment is waiting: only a scene with a date (Halloween...) still happens
    seen = w.meta.get("scenes_seen", {})
    last = max((d[-1] for d in seen.values() if d), default=-999)
    scenes = sorted((sid, m) for sid, m in sim.cat.moments.items() if m.get("scene"))
    if not scenes:
        return None
    rng = sim.streams.get("scene", w.day)
    rng.shuffle(scenes)
    dated_today = []
    for sid, spec in scenes:
        when = spec["scene"].get("when") or {}
        if when.get("dates") and _when_ok(sim, me, sid, when):
            dated_today.append((sid, spec))
    if not dated_today and (busy or w.day - last < SCENE_GAP_DAYS):
        return None
    for sid, spec in (dated_today if busy else dated_today + scenes):
        when = spec["scene"].get("when") or {}
        if not _when_ok(sim, me, sid, when):
            continue
        chance = when.get("chance", 1.0 if when.get("dates") else DEFAULT_CHANCE)
        if rng.random() >= chance:
            continue
        ctx = _context(sim, me, spec["scene"].get("who"), when, rng)
        if ctx is None or not _playable(spec, ctx):
            continue
        return fire(sim, sid, ctx)
    return None


def fire(sim, sid, ctx):
    from . import moments as mo
    w = sim.w
    before = len(w.meta.get("moments", []))
    mo.trigger(sim, sid, w.meta["protagonist"], ctx)
    if len(w.meta.get("moments", [])) == before:
        return None
    w.meta.setdefault("scenes_seen", {}).setdefault(sid, []).append(w.day)
    return w.meta["moments"][-1]


def try_scene(sim, sid):
    """Play a scene right now, to see how it reads (ignores the date and chance, still needs someone who fits)."""
    w = sim.w
    spec = sim.cat.moments.get(sid)
    if not spec or not spec.get("scene"):
        raise KeyError(sid)
    me = w.chars.get(w.meta.get("protagonist") or "")
    if not me:
        raise ValueError("start a story first")
    when = spec["scene"].get("when") or {}
    who = spec["scene"].get("who")
    ctx = _context(sim, me, who, when, sim.streams.get("scene-try", w.day, sid))
    if ctx is None:
        raise ValueError(f"nobody fits '{who}' in your story right now ({WHO.get(who, '')[:-1].lower()})")
    if not _playable(spec, ctx):
        words = {"them": "someone who fits", "best_friend": "a best friend", "partner": "a boyfriend or girlfriend", "pet": "a pet",
                 "sibling": "another brother or sister" if who in ("sibling", "older_sibling", "younger_sibling", "twin") else "a brother or sister"}
        missing = [words.get(n, n) for n in spec["scene"].get("needs", []) if not ctx.get(n)]
        raise ValueError(f"This scene needs {' and '.join(missing) or 'more people'} in your story.")
    m = fire(sim, sid, ctx)
    if m is None:
        raise ValueError("that scene couldn't start")
    return m


# ---------------------------------------------------------------------------------------- the guide and the prompt

EXAMPLE = {
    "dialogue_pack": 1,
    "name": "Cover for me",
    "author": "ChatGPT",
    "texts": {"sibling_chatter": ["did you take my charger again", "mom's asking where you are. i said practice"]},
    "replies": {"sibling": [["absolutely not", "sibling_tease"]]},
    "scenes": [{
        "id": "cover_for_me",
        "who": "older_sibling",
        "when": {"years": ["freshman", "sophomore"], "requires": ["school_day"], "chance": 0.05},
        "title": "{them_first} needs a favor",
        "text": "{them_first} leans into your doorway, already whispering. \"If anyone asks, I was at the library till eleven. Deal?\"",
        "choices": [
            {"label": "Deal. You owe me.", "fits": {"loyalty": 1},
             "ops": [["rel_back", "them", "affection", 6], ["remember", "covered_for_sibling"],
                     ["say", "{them_first} points at you on the way out. \"Legend.\""]]},
            {"label": "No way. I'm not lying for you.", "fits": {"discipline": 1, "loyalty": -0.5},
             "ops": [["rel_back", "them", "affection", -4], ["say", "\"Wow. Okay. Remember this.\""]]},
            {"label": "Only if you drive me to practice all week.", "fits": {"ambition": 0.5, "confidence": 0.5},
             "ops": [["chance", {"base": 0.5, "charisma": 0.4},
                      [["rel_back", "them", "respect", 4], ["say", "\"...Fine. Seven sharp, I'm not waiting.\""]],
                      [["rel_back", "them", "affection", -2], ["say", "\"Forget it. I'll figure it out.\""]]]]},
        ],
    }],
}

VOICE = """- Texts sound like real texts. Teens: mostly lowercase, short, abbreviations sometimes, an emoji now and then, never
  a paragraph. Parents: full sentences, proper capitals, a heart emoji is fine. Coaches: short and direct.
- The game already roughs up spelling and adds emoji based on each person's personality, so write the plain version.
- Nobody talks like an ad or a guidance counselor. No "absolutely!", no life lessons.
- Scene text is second person, present tense ("You", "your"), one or two short paragraphs at most.
- Choices are what YOU do or say, in your own words, under about 12 words each.
- Use the {placeholders} listed for each spot and only those. Never write a specific person's name: use {them_first} and friends.
- Keep it PG-13: crushes, drama, parties, trouble at home are all fine; nothing graphic."""

PROMPT = """You're writing dialogue for LIFE OS, a life-simulation game: you play one person from the first day of high school
(Guilford High School in Guilford, Connecticut) through college. Texts, story moments and the story feed are all data, and
you can add to them by writing a "dialogue pack": one JSON object.

What I want in this pack:
[describe it here, e.g. "more texts from my older brother, and 3 scenes about my twin sisters borrowing my stuff"]

How to answer:
- Reply with ONE JSON code block and nothing else after it. It must be valid JSON (double quotes, no comments, no trailing commas).
- Follow the format and the lists in the guide below exactly. The game checks every line and will tell me what to fix.
- Only add what I asked for.

"""


def guide_markdown() -> str:
    """The full guide: format, voice, and every pool, set, moment and op, built from the game's own data."""
    texts = _texts_base()
    sets = _base_reply_sets()
    base_moments = _base("moments.json")["moments"]
    templates = _base("templates.json")["templates"]
    L = []
    a = L.append
    a("# LIFE OS dialogue packs\n")
    a("A dialogue pack adds lines, reply options, narration, choices and whole new scenes to the game. It's one JSON file. "
      "Load it on the phone (Me, then Dialogue packs) or in the lab (Content Library, then Dialogue). The game checks it and says exactly what to fix.\n")
    a("## The format\n")
    a("Every section is optional; use the ones you need.\n")
    a("```json\n" + json.dumps(EXAMPLE, indent=2, ensure_ascii=False) + "\n```\n")
    a("- `texts`: more lines for a text-message pool (the list is below). Use only that pool's placeholders.")
    a("- `replies`: more reply buttons for a reply set. Each option is `[\"what you say\", \"tone\"]`. The tone decides the effect.")
    a("- `narration`: more lines for the story feed, keyed `event.outcome`.")
    a("- `moment_choices`: extra choices on an existing story moment.")
    a("- `scenes`: brand-new story moments. The game decides when they happen from `who` and `when`.\n")
    a("## Voice\n")
    a(VOICE + "\n")
    a("## Text pools (`texts`)\n")
    a("| pool | when it shows up | placeholders | sounds like |")
    a("|---|---|---|---|")
    for k in texts:
        ph = ", ".join("{" + n + "}" for n in sorted(pool_names(k))) or "none"
        ex = " / ".join(f"\"{x}\"" for x in texts[k][:2]).replace("|", "/")
        a(f"| `{k}` | {POOL_DOCS.get(k, '')} | {ph} | {ex} |")
    a("")
    a("## Reply sets (`replies`)\n")
    a("| set | when you get to reply | current options |")
    a("|---|---|---|")
    for k, opts in sets.items():
        a(f"| `{k}` | {REPLY_SET_DOCS.get(k, '')} | " + " / ".join(f"\"{l}\" ({t})" for l, t in opts) + " |")
    a("\nTones and what they do:\n")
    for k, v in REPLY_TONES.items():
        a(f"- `{k}`: {v}")
    a("\nReply labels can't use placeholders. When a set has more than 3 options, the game shows 3 at a time and keeps a mix of tones.\n")
    a("## Narration (`narration`)\n")
    a("Story-feed lines, keyed `event.outcome`. `{a}` is the person doing it (you, on the phone, becomes \"You\"). One line per entry.\n")
    for k in templates:
        a(f"- `{k}`: " + (", ".join("{" + n + "}" for n in sorted(narration_names(k)))))
    a("")
    a("## Story moments (`moment_choices`)\n")
    a("Add up to 5 choices in all to an existing moment. Choices use the same ops as scenes, with the people and placeholders listed here.\n")
    a("| moment | title | placeholders | people ops can refer to |")
    a("|---|---|---|---|")
    for k, m in base_moments.items():
        if k in NO_ADD or m.get("dynamic"):
            continue
        a(f"| `{k}` | {m['title']} | " + ", ".join("{" + n + "}" for n in sorted(moment_names(k))) + " | " + ", ".join(sorted(moment_refs(k))) + " |")
    a("")
    a("## Scenes (`scenes`)\n")
    a("A scene is a new story moment: a title, a short scene, and 2 to 4 choices. Each morning the game may start one scene whose "
      "conditions fit (at most one every few days; scenes on a specific date always get their day).\n")
    a("```json\n" + json.dumps(EXAMPLE["scenes"][0], indent=2, ensure_ascii=False) + "\n```\n")
    a("**id**: lowercase with underscores, unique.  **title**: under 80 characters.  **text**: the scene, second person.\n")
    a("**who** (optional): who the scene is about. They become `{them}` / `{them_first}` and the ref `them` in ops.\n")
    for k, v in WHO.items():
        a(f"- `{k}`: {v}")
    a("\n**when** (all optional):\n")
    a(f"- `chance`: odds per day when everything else fits (default {DEFAULT_CHANCE}; 1 for date scenes). 0.02 rare, 0.05 normal, 0.15 likely.")
    a(f"- `years`: any of {', '.join(YEARS)}.")
    a("- `months`: numbers 1-12. `dates`: like \"10-31\". `weekdays`: " + ", ".join(WEEKDAYS) + ".")
    a("- `requires`: any of " + "; ".join(f"`{k}` ({v[:-1].lower()})" for k, v in REQUIRES.items()) + ".")
    a("- `you_feel` / `they_feel`: ranges on how you feel about them / they feel about you, e.g. `{\"affection\": [40, 100]}`. "
      "Fields: " + ", ".join(REL_FIELDS) + ".")
    a("- `me`: ranges on your own stats: " + ", ".join(f"{k} ({v})" for k, v in ME_STATS.items()) + ".")
    a("- `remembered` / `not_remembered`: facts set by `remember` ops in other scenes, to chain scenes together. A fact remembers "
      "who the scene was about, so a follow-up scene with the same `who` is about the same person.")
    a("- `once`: true by default (a scene happens once per story). Set false and add `cooldown_days` for things that can recur.\n")
    a("**Placeholders** in scenes: " + ", ".join("{" + n + "}" for n in sorted(SCENE_NAMES)) +
      ". `{them}` is a full name and `{them_first}` a first name; `{sport}` is your main sport; `{pet}` your pet's name.\n")
    a("**People** ops can refer to in scenes: `them` (needs who), `best_friend`, `sibling`, `partner`. A scene whose title or text "
      "mentions someone (like `{sibling_first}` or `{pet}`) only happens when they exist; a choice that mentions someone only shows "
      "when they exist. Keep at least two choices that work for anybody.\n")
    a("**Choices**: `label` (what you do or say), optional `hint`, `fits` (which personalities lean this way when the game picks for "
      "you, trait: -1..1), and `ops`.\n")
    a("## Trivia (`trivia`)\n")
    a("Quiz questions for class quizzes, midterms and finals. Each: `q`, `a` (the right answer), `w` (exactly three wrong answers), "
      "`g` (the lowest grade it fits: 9 to 12, or 13 for college). Facts must be correct; keep answers short. Math is generated, so "
      "don't add math. Subjects: " + ", ".join(f"`{k}`" for k in __import__("lifeos.trivia", fromlist=["x"]).subjects() if k != "math") + ".\n")
    a('```json\n"trivia": {"biology": [{"q": "What do red blood cells carry?", "a": "Oxygen", "w": ["Insulin", "Bile", "Calcium"], "g": 9}]}\n```\n')
    a("## Mini games (the `minigame` op)\n")
    from .minigames import reg as _mreg
    a("A choice can be played: `[\"minigame\", game, {\"great\": [ops], \"good\": [ops], \"miss\": [ops]}, odds if nobody plays]`. "
      "Use `\"sport\"` for the player's own sport in a sports scene. Games: " +
      ", ".join(f"`{k}` ({g['title']}{'' if g.get('status') == 'ready' else ', coming soon'})" for k, g in _mreg()["games"].items()) +
      ". A choice with a game that isn't ready yet stays hidden, so always keep two other choices.\n")
    a("## Ops\n")
    a("| op | how to write it | what it does |")
    a("|---|---|---|")
    for k, (n, ex, doc) in OPS.items():
        a(f"| `{k}` | `{ex}` | {doc} |")
    a("\nTraits: " + ", ".join(TRAITS) + ".  Talents: " + ", ".join(APTITUDES) + ".  Skills: " + ", ".join(sorted(_skill_ids())) + ".\n")
    a("Keep effects small and believable: most relationship changes are 2 to 8; 10+ is a big moment. Good choices aren't free: "
      "the kind option can cost stress or energy, the bold one can backfire through `chance`.\n")
    a("## Checklist\n")
    a("- One JSON object, valid JSON, with a `name`.\n- Pool, set, moment and op names exactly as listed.\n"
      "- Only the placeholders listed for that spot.\n- Scenes have 2 to 4 choices and unique ids.\n")
    return "\n".join(L)


def prompt_for_ai() -> str:
    return PROMPT + guide_markdown()


def current_dialogue() -> dict:
    """Everything in the game right now (base plus packs), for an AI to read before writing more."""
    m = merged()
    return {"texts": m["texts"], "replies": {k: [list(o) for o in v] for k, v in m["replies"].items()},
            "moments": {k: {"title": v["title"], "text": v["text"], "choices": [c.get("label") for c in v.get("choices", [])]}
                        for k, v in m["moments"].items()},
            "packs": m["loaded"]}


if __name__ == "__main__":  # python -m lifeos.dialogue check pack.json   |   python -m lifeos.dialogue guide > guide.md
    import sys
    if len(sys.argv) >= 3 and sys.argv[1] == "check":
        with open(sys.argv[2], encoding="utf-8") as f:
            r = check(parse_text(f.read()))
        for e in r["errors"]:
            print("ERROR  ", e)
        for wn in r["warnings"]:
            print("warning", wn)
        print("OK" if r["ok"] else "NOT OK", r["summary"])
        sys.exit(0 if r["ok"] else 1)
    elif len(sys.argv) >= 2 and sys.argv[1] == "guide":
        print(guide_markdown())
    else:
        print("usage: python -m lifeos.dialogue check <pack.json> | guide")
