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

from . import lines as _lines
from .catalogs import APTITUDES, TRAITS, _base, DATA_DIR

BUILTIN_DIR = os.path.join(DATA_DIR, "dialogue")
USER_DIR = os.environ.get("LIFEOS_DIALOGUE") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "var", "dialogue")

SECTIONS = ("texts", "replies", "narration", "moment_choices", "scenes", "trivia", "mods", "chat", "schedule")
MOD_KINDS = {"open": "said before a text (\"ok so\", \"u up?\")", "close": "tacked on after a text (\"lol\")",
             "talk": "how a line is said in person: \"{them_first} {says}, grinning\" ({says} becomes says or asks)"}
PH = re.compile(r"\{(\w+)\}")
SLUG = re.compile(r"^[a-z][a-z0-9_]{2,79}$")   # ids and remembered facts: lowercase, digits, underscores, up to 80 long


def _slug_problem(v) -> str:
    """Why a name isn't a good id, in words."""
    if not isinstance(v, str) or not v:
        return "needs a short lowercase id with underscores, like cover_for_me"
    if len(v) > 80:
        return f"is {len(v)} characters; keep it under 80"
    if not re.match(r"^[a-z]", v):
        return f"'{v}' has to start with a lowercase letter"
    bad = sorted(set(re.sub(r"[a-z0-9_]", "", v)))
    if bad:
        return f"'{v}' can only have lowercase letters, digits and underscores (it has {' '.join(repr(c) for c in bad)})"
    return f"'{v}' is too short; use at least 3 characters"

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
    "invite_later": "A friend who asked while you were busy, texting to try again later.",
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
    "hang_talk": "IN PERSON: something they say while you're hanging out at {place} (shows in the story feed).",
    "date_talk": "IN PERSON: something they say on a date at {place}.",
    "chat_talk": "IN PERSON: something they say when you stop and talk (hallway, lunch, practice).",
    "awkward_talk": "IN PERSON: something they say when a hangout or date is going badly.",
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
    "brother": "A brother.",
    "sister": "A sister.",
    "older_brother": "An older brother.",
    "older_sister": "An older sister.",
    "younger_brother": "A younger brother.",
    "younger_sister": "A younger sister.",
    "twin": "Your twin.",
    "coach": "A coach of one of your teams.",
}

VIBE_STYLES = ("tease", "sweet", "bold", "funny", "cheesy", "chill")
SIBLING_KINDS = ("sibling", "older_sibling", "younger_sibling", "twin", "brother", "sister", "older_brother", "older_sister",
                 "younger_brother", "younger_sister")
CASTABLE = SIBLING_KINDS + ("friend", "teammate", "classmate", "ex", "coach")  # kinds with more than one person who fits: a storyline keeps its pick
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
SCENE_GAP_DAYS = 2      # at most one storyline scene every couple of days, across all of them
CHAPTER_GAP_DAYS = 5    # a storyline's next chapter comes at least this long after its last one (when.gap_days changes it)
CHAPTER_CHANCE = 0.5    # once it's due, the next chapter comes soon (about every other day)
MAX_BEATS = 3           # how deep a scene can keep going with "then"
NO_ADD = {"college_decision"}  # choices are built from your real options

# where each mini game fits in a story, for the guide
MG_FITS = {
    "trivia": "a pop quiz, a study session, trivia night at a restaurant, a bet over who knows more",
    "soccer_pk": "penalties at the park, settling an argument, a gym-class shootout",
    "soccer_11": "a pickup match, gym class, a game where your team needs a goal",
    "basketball": "shooting around in the driveway, HORSE with a sibling, open gym, a dare from half court",
    "playmaker": "running the offense at the park, a pickup run where you have to find the open man",
    "football": "a goal-line stand at practice, a backyard game, a bet on one play",
    "baseball": "a big at-bat, batting practice, a home run derby with friends",
    "swing_lab": "the batting cages, a hitting lesson",
    "golf": "a round with a parent, a golf outing, a bet on one hole",
    "cup_pong": "a friend's basement, a party (beer pong in college)",
    "paper_toss": "bored in class, the trash can across the room",
    "hold": "a steady pour in chem lab, one brushstroke, a power throw in gym, holding a note (press, hold, let go on the line)",
    "sweep": "stopping a pendulum, hitting the beat, timing a jump rope, any \"tap at the right moment\"",
    "mathdash": "mental math with a friend, splitting a check, making change at a register job, counting atoms",
    "flash": "remembering a pattern, ear training in band, a memory bet",
    "oddone": "proofreading a friend's essay, spot the difference, a typo on a sign",
    "lineup": "a timeline review, ranking things with friends, putting cards in order",
    "reflex": "catching something falling, a reaction test, first hand up, a quick-draw bet",
}

# ops a pack can use: name -> (arg count, how to write it, what it does)
OPS = {
    "say": (1, '["say", ["{them_first} grins. \\"owe you one.\\"", "\\"Legend,\\" {them_first} says."]]', "A line of dialogue or narration shown right after the choice. One line, or a list of versions the game rotates through."),
    "text": (2, '["text", "them", ["thanks for today fr", "ok that was fun"]]', "Someone (them, best_friend, sibling, partner) texts you this later today. One line or a list of versions."),
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
    "vibe": (2, '["vibe", "tease", {"good": ["{them_first} cracks up."], "meh": ["A small laugh."], "bad": ["{them_first} goes quiet."]}]',
             "A choice in a style (tease, sweet, bold, funny, cheesy, or chill for the safe pick) that lands or misses by what they like. "
             "good / meh / bad are what happens, a line or a list of versions. Only in scenes about someone (who)."),
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


def _check_variants(R, where, v, allowed, max_len=240):
    """One line, or a list of versions of it (the game rotates through them and doesn't repeat one too soon)."""
    if isinstance(v, list):
        if not 1 <= len(v) <= 20:
            R.err(where, "a list of versions has 1 to 20 lines")
            return False
        return all([_check_line(R, f"{where}[{i}]", x, allowed, max_len) for i, x in enumerate(v)])
    return _check_line(R, where, v, allowed, max_len)


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
            _check_variants(R, w, args[0], names, 300)
        elif name == "text":
            if args[0] in refs:
                _check_variants(R, w, args[1], names, 200)
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
                R.err(w, "a remembered fact " + _slug_problem(args[0]).replace("needs a short lowercase id", "needs a short lowercase name").removeprefix("is "))
        elif name == "vibe":
            style, outs = args
            if style not in VIBE_STYLES:
                R.err(w, f"'{style}' isn't a style. Use: {', '.join(VIBE_STYLES)}")
            if "them" not in refs:
                R.err(w, "a style choice needs the scene to be about someone (set who)")
            if not isinstance(outs, dict) or not outs or any(k not in ("good", "meh", "bad") for k in outs):
                R.err(w, 'the second value maps good / meh / bad to what happens, like {"good": ["..."], "meh": ["..."], "bad": ["..."]}')
            else:
                for ok_, lines in outs.items():
                    _check_variants(R, f"{w} ({ok_})", lines, names, 300)
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


def _check_choice(R, where, ch, refs, names, depth=0):
    if not isinstance(ch, dict):
        R.err(where, 'a choice looks like {"label": "...", "ops": [...]}')
        return
    for k in ch:
        if k not in ("label", "hint", "fits", "ops", "then"):
            R.warn(where, f"'{k}' is ignored (a choice has label, hint, fits, ops, then)")
    then = ch.get("then")
    if then is not None:
        if depth + 1 >= MAX_BEATS:
            R.err(where + ".then", f"a scene can keep going {MAX_BEATS - 1} times at most; end it here")
        elif not isinstance(then, dict) or "text" not in then or "choices" not in then:
            R.err(where + ".then", 'keeps the scene going: {"text": "what happens next", "choices": [2 to 4 choices]}')
        else:
            _check_variants(R, where + ".then.text", then["text"], names, 700)
            tch = then["choices"]
            if not isinstance(tch, list) or not 2 <= len(tch) <= 4:
                R.err(where + ".then.choices", "needs 2 to 4 choices")
            else:
                for i, c2 in enumerate(tch):
                    _check_choice(R, f"{where}.then.choices[{i}]", c2, refs, names, depth + 1)
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
        R.err(where + ".id", _slug_problem(sid))
    elif sid in base_moments:
        R.err(where + ".id", f"'{sid}' is already a moment in the game; pick another id")
    elif sid in seen_ids:
        R.err(where + ".id", f"'{sid}' is used twice")
    else:
        seen_ids.add(sid)
    for k in sc:
        if k not in ("id", "title", "text", "by_text", "who", "when", "choices", "notes"):
            R.warn(where, f"'{k}' is ignored (a scene has id, title, text, by_text, who, when, choices)")
    who = sc.get("who")
    if isinstance(who, str) and who.startswith("cast:"):
        if who[5:] not in getattr(R, "slots", set()):
            R.err(where + ".who", f"'{who}' needs a cast slot named '{who[5:]}' in this pack's \"cast\" section"
                  + (f" (this pack has: {', '.join(sorted(R.slots))})" if getattr(R, "slots", None) else ""))
    elif who is not None and who not in WHO:
        R.err(where + ".who", f"'{who}' isn't a kind of person.{_suggest(who, WHO)} Use: {', '.join(WHO)}, or cast:<slot> for a named person")
    names = set(SCENE_NAMES)
    refs = set(SCENE_REFS)
    if not who:
        names -= {"them", "them_first"}
        refs -= {"them"}
    _check_line(R, where + ".title", sc.get("title"), names, 80)
    _check_variants(R, where + ".text", sc.get("text"), names, 700)
    if sc.get("by_text") is not None:
        if not who:
            R.warn(where + ".by_text", "is skipped: a texted version needs the scene to be about someone (set who), so the game knows who it's from")
        else:
            _check_variants(R, where + ".by_text", sc["by_text"], names, 220)
    when = sc.get("when", {})
    if not isinstance(when, dict):
        R.err(where + ".when", "when is an object, like {\"chance\": 0.05, \"years\": [\"freshman\"]}")
        when = {}
    allowed_when = {"chance", "years", "months", "dates", "weekdays", "requires", "you_feel", "they_feel", "me",
                    "remembered", "not_remembered", "once", "cooldown_days", "after", "gap_days"}
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
                    R.err(w, _slug_problem(r))
        elif k == "once":
            if not isinstance(v, bool):
                R.err(w, "is true or false")
        elif k == "cooldown_days":
            _num(R, w, v, 1, 2000)
        elif k == "after":
            for a in v if isinstance(v, list) else [v]:
                if not isinstance(a, str) or not SLUG.match(a):
                    R.err(w, "is a list of scene ids that have to happen first")
        elif k == "gap_days":
            _num(R, w, v, 0, 365)
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
        if k not in SECTIONS + ("dialogue_pack", "name", "author", "notes", "version", "in_order", "cast"):
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
        have = {_lines.text_of(x).lower().strip() for x in base_texts[pool]}
        allowed = pool_names(pool)
        for i, s in enumerate(lines):
            wi = f"{w}[{i}]"
            if isinstance(s, dict):
                for k in s:
                    if k not in ("text", "talk", "when"):
                        R.warn(wi, f"'{k}' is ignored (a line has text, talk and when)")
                if not _check_line(R, wi + ".text", s.get("text"), allowed, 200):
                    continue
                if s.get("talk") is not None and not _check_line(R, wi + ".talk", s["talk"], allowed | {"them_first", "says"}, 300):
                    continue
                wh = s.get("when", [])
                if not isinstance(wh, list) or any(t not in _lines.TAGS for t in wh):
                    bad = [t for t in (wh if isinstance(wh, list) else [wh]) if t not in _lines.TAGS]
                    R.err(wi + ".when", f"is a list of context tags; {', '.join(map(str, bad))} isn't one.{_suggest(str(bad[0]) if bad else '', _lines.TAGS)} Tags: {', '.join(_lines.TAGS)}")
                    continue
                key = s["text"].lower().strip()
            elif _check_line(R, wi, s, allowed, 200):
                key = s.lower().strip()
            else:
                continue
            if key in have:
                added["duplicates"] += 1
            else:
                have.add(key)
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
    mods = pack.get("mods", {})
    added["mods"] = 0
    if not isinstance(mods, dict):
        R.err("mods", 'is an object like {"open": {"late_night": ["u up?"]}, "close": {"close": ["fr"]}, "talk": {"happy": ["{them_first} {says}, grinning"]}}')
        mods = {}
    for kind, bank in mods.items():
        w = f"mods.{kind}"
        if kind not in MOD_KINDS:
            R.err(w, f"'{kind}' isn't a kind of mod. Use: {', '.join(MOD_KINDS)}")
            continue
        if not isinstance(bank, dict):
            R.err(w, 'is an object of context tags to lines, like {"late_night": ["u up?"]}')
            continue
        for tag, ls in bank.items():
            wt = f"{w}.{tag}"
            bad = [t for t in tag.split("+") if t not in _lines.TAGS] if tag != "any" else []
            if bad:
                R.err(wt, f"'{bad[0]}' isn't a context tag.{_suggest(bad[0], _lines.TAGS)} Tags: any, {', '.join(_lines.TAGS)} "
                          "(join several with +, like close+guys)")
                continue
            if not isinstance(ls, list):
                R.err(wt, "is a list of lines")
                continue
            for i, x in enumerate(ls):
                if kind == "talk":
                    if _check_line(R, f"{wt}[{i}]", x, {"them_first", "says"}, 90):
                        if "{them_first}" not in x:
                            R.err(f"{wt}[{i}]", "a way of saying something needs {them_first} (who's talking), like \"{them_first} {says}, grinning\"")
                        else:
                            added["mods"] += 1
                elif _check_line(R, f"{wt}[{i}]", x, set(), 40):
                    added["mods"] += 1

    added["chat"] = _check_chat(R, pack.get("chat", {}))
    added["schedule"] = _check_schedule(R, pack.get("schedule", {}))

    R.slots = _check_cast(R, pack["cast"]) if "cast" in pack else set()  # named people this storyline is about
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


SCHEDULE_KEYS = ("years", "after", "gap_days", "months")


def _check_schedule(R, sch) -> int:
    """When episodes of any storyline air: {"scene_id": {"years": [...], "after": [...], "gap_days": n, "months": [...]}}."""
    if not sch:
        return 0
    if not isinstance(sch, dict):
        R.err("schedule", 'is an object of scene ids to when they air, like {"bro_driveway": {"years": ["freshman"], "after": ["crush_first_text"]}}')
        return 0
    n = 0
    for sid, v in sch.items():
        w = f"schedule.{sid}"
        if not isinstance(sid, str) or not SLUG.match(sid):
            R.err(w, "needs to be a scene id")
            continue
        if not isinstance(v, dict) or not v:
            R.err(w, 'is an object like {"years": ["sophomore"], "after": ["other_scene_id"]}')
            continue
        for k, x in v.items():
            if k not in SCHEDULE_KEYS:
                R.err(f"{w}.{k}", f"isn't part of a schedule. Use: {', '.join(SCHEDULE_KEYS)}")
            elif k == "years":
                for y in x if isinstance(x, list) else [x]:
                    if y not in YEARS:
                        R.err(f"{w}.years", f"'{y}' isn't a school year. Use: {', '.join(YEARS)}")
            elif k == "after":
                for a in x if isinstance(x, list) else [x]:
                    if not isinstance(a, str) or not SLUG.match(a):
                        R.err(f"{w}.after", "is a list of scene ids")
            elif k == "gap_days":
                _num(R, f"{w}.gap_days", x, 0, 365)
            elif k == "months":
                for mo in x if isinstance(x, list) else [x]:
                    _num(R, f"{w}.months", mo, 1, 12)
        n += 1
    return n


def _check_chat(R, chat) -> int:
    """Texting lines (chat.py): same shape as the built-in ones, lists of short lines in places that exist."""
    if not chat:
        return 0
    base = _base("chat.json")
    if not isinstance(chat, dict):
        R.err("chat", 'is an object like {"topic": {"school": ["pop quiz again"]}, "suggest": {"flirt_tease": ["you wish"]}}')
        return 0
    n = 0

    def walk(v, b, where):
        nonlocal n
        if isinstance(b, dict):
            if not isinstance(v, dict):
                R.err(where, "should be an object here")
                return
            for k, sub in v.items():
                if k not in b:
                    R.err(f"{where}.{k}", f"isn't a place for lines.{_suggest(k, list(b))} Use: {', '.join(x for x in b if not x.startswith('_'))}")
                    continue
                walk(sub, b[k], f"{where}.{k}")
            return
        if not isinstance(v, list):
            R.err(where, "is a list of lines")
            return
        for i, x in enumerate(v):
            if re.search(r"\.ask\.(general|flirty)$", where):
                kinds = ("yesno", "doing", "day", "weekend", "open", "flirty")
                if not isinstance(x, dict) or "q" not in x or x.get("a") not in kinds:
                    R.err(f"{where}[{i}]", f'is a question like {{"q": "you going friday?", "a": "yesno"}}; "a" is one of {", ".join(kinds)}')
                    continue
                if _check_line(R, f"{where}[{i}].q", x["q"], {"me"}, 160):
                    n += 1
            elif _check_line(R, f"{where}[{i}]", x, {"me"}, 200):
                n += 1
    shape = {k: v for k, v in base.items() if not k.startswith("_")}
    for k, v in chat.items():
        if k == "people":  # lines for one kind of person: the same shape, used first for them
            if not isinstance(v, dict):
                R.err("chat.people", 'is an object of kinds of people to lines, like {"older_sibling": {"reply": {"greet": {"warm": ["what do you want"]}}}}')
                continue
            for kind, sub in v.items():
                if kind not in WHO:
                    R.err(f"chat.people.{kind}", f"isn't a kind of person.{_suggest(kind, WHO)} Use: {', '.join(WHO)}")
                    continue
                walk(sub, shape, f"chat.people.{kind}")
            continue
        if k not in base or k.startswith("_"):
            R.err(f"chat.{k}", f"isn't part of chat lines.{_suggest(k, list(shape) + ['people'])}")
            continue
        walk(v, base[k], f"chat.{k}")
    return n


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
    from . import drama, hangouts, nights
    hangouts.register(moments)
    nights.register(moments)  # parties and dances, scene by scene
    drama.register(moments)  # friends fighting, triangles, falling out and making up
    replies = {k: list(v) for k, v in _base_reply_sets().items()}
    mods = {k: copy.deepcopy(v) for k, v in _base("mods.json").items() if k in MOD_KINDS}
    loaded = []
    trivia_extra: dict = {}
    chat_lines = copy.deepcopy(_base("chat.json"))
    chat_people = []  # (pack, {kind: lines}): a storyline's own people text with these
    in_order = {}  # pack -> its scenes happen as chapters, in the order they're written
    for p in packs():
        if not p["enabled"]:
            continue
        pk = p["pack"]
        loaded.append(p["id"])
        for pool, lines in (pk.get("texts") or {}).items():
            have = {_lines.text_of(x).lower().strip() for x in texts[pool]}
            for s in lines:
                k = _lines.text_of(s).lower().strip()
                if k not in have:
                    texts[pool].append(s)
                    have.add(k)
        for kind, bank in (pk.get("mods") or {}).items():
            for tag, ls in bank.items():
                cur = mods.setdefault(kind, {}).setdefault(tag, [])
                cur.extend(x for x in ls if x not in cur)
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
        _merge_chat(chat_lines, {k: v for k, v in (pk.get("chat") or {}).items() if k != "people"})
        if (pk.get("chat") or {}).get("people"):
            chat_people.append((p["id"], pk["chat"]["people"]))
        for sub, qs in (pk.get("trivia") or {}).items():
            trivia_extra.setdefault(sub, []).extend({"q": q["q"], "a": q["a"], "w": list(q["w"]), "g": q.get("g", 9)} for q in qs)
        st_order = _state().get("order", {})
        in_order[p["id"]] = st_order.get(p["id"], pk.get("in_order", p["source"] == "yours"))
        for n, sc in enumerate(pk.get("scenes") or []):
            if sc["id"] in moments:
                continue  # an earlier pack already has a scene with this id
            moments[sc["id"]] = {"title": sc["title"], "text": sc["text"],
                                 "choices": _with_beats(moments, sc["id"], sc["title"], p["id"], sc["choices"], ""),
                                 "scene": {"who": sc.get("who"), "when": sc.get("when", {}), "pack": p["id"], "by_text": sc.get("by_text"), "order": n,
                                           "needs": needs({"title": sc["title"], "text": sc["text"]})}}
    cast = {}  # named people storylines are about: a slot name means the same person in every pack that uses it
    for p in packs():
        if p["enabled"]:
            for name, spec in (p["pack"].get("cast") or {}).items():
                if isinstance(spec, dict):
                    d = cast.setdefault(name, {"spec": normalize_slot(spec), "packs": []})
                    d["packs"].append(p["id"])
    for p in packs():  # a season plan places any storyline's episodes across the seasons
        if p["enabled"]:
            for sid, sch in (p["pack"].get("schedule") or {}).items():
                sc = (moments.get(sid) or {}).get("scene")
                if sc is not None and isinstance(sch, dict):
                    when = dict(sc.get("when") or {})
                    for k, v in sch.items():
                        if k == "after":
                            when["after"] = sorted(set((when.get("after") or []) + (v if isinstance(v, list) else [v])))
                        elif k in SCHEDULE_KEYS:
                            when[k] = v
                    sc["when"] = when
    return {"texts": texts, "templates": templates, "moments": moments, "replies": replies, "trivia": trivia_extra, "mods": mods,
            "chat": chat_lines, "chat_people": chat_people, "in_order": in_order, "loaded": loaded, "cast": cast}


def _with_beats(moments, sid, title, pack, choices, path) -> list:
    """Choices, where one with "then" keeps the scene going: the next beat is its own moment, right after."""
    out = []
    for i, ch in enumerate(choices):
        c2 = _with_needs({k: v for k, v in ch.items() if k != "then"})
        then = ch.get("then")
        if isinstance(then, dict):
            bid = f"{sid}__{path}{i}"
            moments[bid] = {"title": title, "text": then["text"], "beat_of": sid, "scene_pack": pack,
                            "choices": _with_beats(moments, sid, title, pack, then.get("choices") or [], f"{path}{i}_")}
            c2["ops"] = list(c2["ops"]) + [["beat", bid]]
        out.append(c2)
    return out


def in_order(pid) -> bool:
    return bool(merged()["in_order"].get(pid))


def set_in_order(pid: str, on: bool):
    if not any(p["id"] == pid for p in packs()):
        raise KeyError(pid)
    st = _state()
    st.setdefault("order", {})[pid] = bool(on)
    _save_state(st)
    reload()


def chapters(sim, pid) -> list:
    """A storyline's scenes in order (not the beats inside them)."""
    return sorted(((m["scene"].get("order", 0), sid, m) for sid, m in sim.cat.moments.items()
                   if (m.get("scene") or {}).get("pack") == pid), key=lambda x: x[0])


def progress(sim, pid) -> dict:
    """How far along a storyline you are: chapters done, out of how many, and what's next."""
    seen = sim.w.meta.get("scenes_seen", {})
    ch = chapters(sim, pid)
    done = sum(1 for _, sid, _ in ch if sid in seen)
    nxt = next((m["title"] for _, sid, m in ch if sid not in seen), None)
    return {"done": done, "of": len(ch), "next": nxt, "in_order": in_order(pid)}


def chapter_label(sim, kind) -> str | None:
    """'Hoops with my brother · Chapter 2 of 5' for a scene (or a beat inside one)."""
    m = sim.cat.moments.get(kind) or {}
    sid = m.get("beat_of") or kind
    sc = (sim.cat.moments.get(sid) or {}).get("scene")
    if not sc:
        return None
    pid = sc.get("pack")
    p = next((x for x in packs() if x["id"] == pid), None)
    name = (p["pack"].get("name") if p else None) or "A storyline"
    if not in_order(pid):
        return name
    ch = chapters(sim, pid)
    n = next((i for i, (_, s, _) in enumerate(ch) if s == sid), 0) + 1
    return f"{name} · Chapter {n} of {len(ch)}"


def _merge_chat(into: dict, add: dict):
    """A pack's texting lines go into the same places as the built-in ones (no duplicates)."""
    for k, v in add.items():
        if k.startswith("_"):
            continue
        if k == "people" and isinstance(v, dict):
            into.setdefault("people", {})
            for kind, sub in v.items():
                into["people"].setdefault(kind, {})
                _merge_people(into["people"][kind], sub)
        elif isinstance(v, dict) and isinstance(into.get(k), dict):
            _merge_chat(into[k], v)
        elif isinstance(v, list) and isinstance(into.get(k), list):
            have = {(x["q"] if isinstance(x, dict) else x).lower() for x in into[k]}
            for x in v:
                key = (x["q"] if isinstance(x, dict) else x).lower()
                if key not in have:
                    into[k].append(x)
                    have.add(key)


def _merge_people(into: dict, add: dict):
    for k, v in add.items():
        if isinstance(v, dict):
            _merge_people(into.setdefault(k, {}), v)
        elif isinstance(v, list):
            cur = into.setdefault(k, [])
            have = {(x["q"] if isinstance(x, dict) else x).lower() for x in cur}
            cur.extend(x for x in v if (x["q"] if isinstance(x, dict) else x).lower() not in have)


def chat_people() -> list:
    return merged()["chat_people"]


def pack_kinds(pack: str) -> list:
    """The kinds of people a storyline is about (from its scenes and its texting lines)."""
    m = merged()
    kinds = {(v.get("scene") or {}).get("who") for v in m["moments"].values() if (v.get("scene") or {}).get("pack") == pack}
    for pid, people in m["chat_people"]:
        if pid == pack:
            kinds |= set(people)
    return [k for k in WHO if k in kinds and k in CASTABLE]


def chat_lines() -> dict:
    return merged()["chat"]


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


def mods() -> dict:
    return merged()["mods"]


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
    if who in SIBLING_KINDS:
        sibs = [s for s in sim.siblings(me.id) if ok(s)]
        g = me.grade or 9
        if who.startswith("older_"):
            sibs = [s for s in sibs if (w.chars[s].grade or 99) > g]
        elif who.startswith("younger_"):
            sibs = [s for s in sibs if (w.chars[s].grade or 0) < g]
        if who.endswith("brother"):
            sibs = [s for s in sibs if w.chars[s].gender == "m"]
        elif who.endswith("sister"):
            sibs = [s for s in sibs if w.chars[s].gender == "f"]
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
    allseen = w.meta.get("scenes_seen", {})
    after = when.get("after") or []
    after = after if isinstance(after, list) else [after]
    if any(a not in allseen and not _expired(sim, me, a) for a in after):
        return False  # (a chapter whose school years are over counts as skipped, so the story doesn't get stuck)
    if after and when.get("gap_days") and not ignore_time and w.day - max(allseen[a][-1] for a in after) < when["gap_days"]:
        return False
    for f, rng in (when.get("me") or {}).items():
        v = me.mood if f == "mood" else me.gpa if f == "gpa" else me.needs.get(f, 50)
        if not _in(v, rng):
            return False
    return True


def cast_of(w, pack, who):
    return (w.meta.get("pack_cast", {}).get(pack) or {}).get(who)


def set_cast(w, pack, who, cid):
    w.meta.setdefault("pack_cast", {}).setdefault(pack, {})[who] = cid


# ---------------------------------------------------------------------------------------- cast slots
# A pack can name the people it's about: "cast": {"lead_brother": {"who": "older_brother", "sport": "basketball",
# "grade_offset": 3}}, and its scenes say "who": "cast:lead_brother". A slot is bound once, to one real person in your story
# (never a new or changed one), and stays bound for the whole run: through graduation, college, everything. Every pack that
# uses the same slot name gets the same person. If nobody fits, those scenes just don't happen.

CAST_FIELDS = ("who", "gender", "sport", "grade_offset", "bind", "bond", "floor", "label")
CAST_ALIASES = {"relationship_to_player": "who", "grade_offset_at_player_freshman": "grade_offset", "grade_offset_at_start": "grade_offset"}
CAST_SPORT_FLAGS = {"basketball_player": "basketball", "football_player": "football", "baseball_player": "baseball", "soccer_player": "soccer",
                    "softball_player": "softball"}
CAST_ACCEPTED = ("same_high_school_at_start", "bind_once", "notes")  # fine to include: always true / informational
GENDERS = {"m": "m", "male": "m", "boy": "m", "f": "f", "female": "f", "girl": "f"}


def normalize_slot(spec: dict) -> dict:
    out = {}
    for k, v in spec.items():
        if k in CAST_SPORT_FLAGS:
            if v:
                out["sport"] = CAST_SPORT_FLAGS[k]
            continue
        k2 = CAST_ALIASES.get(k, k)
        if k2 == "gender":
            v = GENDERS.get(str(v).lower(), v)
        if k2 in CAST_FIELDS:
            out[k2] = v
    who = out.get("who")
    if isinstance(who, str) and who.endswith("brother"):
        out.setdefault("gender", "m")
    elif isinstance(who, str) and who.endswith("sister"):
        out.setdefault("gender", "f")
    out.setdefault("bind", "first_scene")
    return out


def _check_cast(R, cast) -> set:
    if not isinstance(cast, dict):
        R.err("cast", 'is an object of named people, like {"lead_brother": {"who": "older_brother", "sport": "basketball"}}')
        return set()
    sports = set(_base("sports.json")["sports"])
    out = set()
    for name, spec in cast.items():
        w = f"cast.{name}"
        if not isinstance(name, str) or not SLUG.match(name):
            R.err(w, _slug_problem(name))
            continue
        if not isinstance(spec, dict):
            R.err(w, 'is an object like {"who": "older_brother"}')
            continue
        for k in spec:
            if k not in CAST_FIELDS + tuple(CAST_ALIASES) + tuple(CAST_SPORT_FLAGS) + CAST_ACCEPTED:
                R.warn(w, f"'{k}' is ignored. A cast slot has: {', '.join(CAST_FIELDS)}")
        n = normalize_slot(spec)
        who = n.get("who")
        if who not in CASTABLE:
            R.err(w + ".who", f"'{who}' isn't a kind of person a slot can be. Use one of: {', '.join(CASTABLE)}")
            continue
        g = n.get("gender")
        if g is not None and g not in ("m", "f"):
            R.err(w + ".gender", 'is "male" or "female"')
        elif (g == "f" and who.endswith("brother")) or (g == "m" and who.endswith("sister")):
            R.err(w + ".gender", f"doesn't match '{who}'")
        if n.get("sport") is not None and n["sport"] not in sports:
            R.err(w + ".sport", f"'{n['sport']}' isn't a sport. Sports: {', '.join(sorted(sports))}")
        off = n.get("grade_offset")
        if off is not None and (not isinstance(off, int) or isinstance(off, bool) or not -8 <= off <= 8):
            R.err(w + ".grade_offset", "is how many grades ahead of you they are (3 = a senior when you're a freshman; -2 = two behind)")
        if n.get("bind") not in ("start", "first_scene"):
            R.err(w + ".bind", '"start" (bind when the story starts) or "first_scene" (when their first scene comes up)')
        for key in ("bond", "floor"):
            v = n.get(key)
            if v is None:
                continue
            if not isinstance(v, dict):
                R.err(f"{w}.{key}", 'is an object like {"affection": 70, "trust": 70}')
                continue
            for f, x in v.items():
                if f not in REL_FIELDS:
                    R.err(f"{w}.{key}.{f}", f"isn't part of a relationship. Use: {', '.join(REL_FIELDS)}")
                elif not isinstance(x, (int, float)) or isinstance(x, bool) or not -100 <= x <= 100:
                    R.err(f"{w}.{key}.{f}", "is a number from -100 to 100")
        out.add(name)
    return out


def slot_spec(name):
    return (merged()["cast"].get(name) or {}).get("spec")


def slot_label(spec) -> str:
    if spec.get("label"):
        return spec["label"]
    bits = [WHO.get(spec.get("who"), "someone")[:-1].lower()]
    if spec.get("sport"):
        bits.append(f"who plays {spec['sport']}")
    off = spec.get("grade_offset")
    if off:
        bits.append(f"{abs(off)} grade{'s' if abs(off) != 1 else ''} {'ahead of' if off > 0 else 'behind'} you")
    return ", ".join(bits)


def plays(sim, c, sport) -> bool:
    """On (or was on) that sport's team, or clearly into it."""
    w = sim.w
    if any(w.groups.get(g, {}).get("skill") == sport for g in c.memberships):
        return True
    if any(isinstance(pm, dict) and w.groups.get(pm.get("group"), {}).get("skill") == sport for pm in c.past_memberships):
        return True
    if (c.path or {}).get("sport") == sport:
        return True
    return c.skills.get(sport, 0) >= 55 or c.interests.get(sport, 0) >= 70


def slot_candidates(sim, me, spec) -> list:
    """Everyone in your story who fits a slot right now."""
    w = sim.w
    out = candidates(sim, me, spec["who"])
    if spec.get("gender"):
        out = [o for o in out if w.chars[o].gender == spec["gender"]]
    if spec.get("sport"):
        out = [o for o in out if plays(sim, w.chars[o], spec["sport"])]
    off = spec.get("grade_offset")
    if off is not None and me.grade:
        out = [o for o in out if w.chars[o].grade is None or w.chars[o].grade - me.grade == off]
    return out


def bound(sim, name):
    """Who a slot is bound to (None if it isn't, or if they're gone from your story)."""
    rec = sim.w.meta.get("cast_slots", {}).get(name)
    cid = rec and rec.get("id")
    c = sim.w.chars.get(cid) if cid else None
    return cid if c and c.status == "active" else None


def bind(sim, me, name, cid=None, by="auto"):
    """The person a slot means in this story: bound once, then the same person every time (even after they graduate).
    The best fit is the one whose life matches what the storylines say (the brother who plays basketball); ties go the
    same way every time. Pass cid to pick them yourself."""
    w = sim.w
    d = merged()["cast"].get(name)
    if not d:
        return None
    spec = d["spec"]
    if cid is None:
        cur = bound(sim, name)
        if cur or name in w.meta.get("cast_slots", {}):
            return cur  # bound already (if they've left your story, so does this storyline: nobody gets swapped in)
        cands = slot_candidates(sim, me, spec)
        if not cands:
            return None
        words = " ".join(_story_words(sim, p) for p in d["packs"])
        cid = sorted(cands, key=lambda o: (-_fit(sim, o, words), o))[0]
    w.meta.setdefault("cast_slots", {})[name] = {"id": cid, "day": w.day, "by": by, "who": spec["who"]}
    w.meta.setdefault("cast_log", []).append([w.day, name, cid, by])
    _raise_to(sim, me.id, cid, spec.get("bond"))
    return cid


def _raise_to(sim, a, b, levels):
    """Make sure two people are at least this close (both ways). Never lowers anything."""
    from .social import label_for
    w = sim.w
    if not levels:
        return
    for x, y in ((a, b), (b, a)):
        r = w.ensure_rel(x, y, w.day)
        for f, v in levels.items():
            if getattr(r, f, None) is not None and getattr(r, f) < v:
                setattr(r, f, float(v))
        r.peak_affection = max(r.peak_affection, r.affection)
        r.label = label_for(r, w.rules)


def keep_floor(sim, ctx):
    """After a scene with a slot that has a floor: whatever you chose, the bond stays at least that strong."""
    name = (ctx or {}).get("cast_slot")
    spec = slot_spec(name) if name else None
    me = sim.w.meta.get("protagonist")
    if spec and spec.get("floor") and me and ctx.get("them") in sim.w.chars:
        _raise_to(sim, me, ctx["them"], spec["floor"])


def _expired(sim, me, sid) -> bool:
    """A scene whose school years are all behind you (it can't happen anymore)."""
    spec = sim.cat.moments.get(sid) or {}
    years = ((spec.get("scene") or {}).get("when") or {}).get("years") or []
    grades = [g for y in years for g in YEARS.get(y, ())]
    return bool(grades) and max(grades) < (me.grade or 0)


def suggest_lock(sim, pack_id, kind) -> dict:
    """What a general kind most likely means in this storyline, from what it says: older_sibling + "he/his/brother" and
    "hoops/court" -> your older brother who plays basketball."""
    words = _story_words(sim, pack_id)
    he, she = len(re.findall(MALE, words)), len(re.findall(FEMALE, words))
    base = kind.replace("_sibling", "") if kind != "sibling" else ""
    pre = f"{base}_" if base else ""
    who = kind if kind == "twin" else f"{pre}brother" if he > she * 1.5 else f"{pre}sister" if she > he * 1.5 else kind
    counts = {s: len(re.findall(rx, words)) for s, rx in SPORT_WORDS.items()}
    sport = max(counts, key=lambda s: counts[s]) if max(counts.values(), default=0) >= 3 else None
    return {"who": who, "sport": sport, "slot": who}


def lock_cast(pack: dict, slot: str, spec: dict, replace: list) -> dict:
    """Rewrite a pack so its scenes (and texting lines) about a general kind of person are about one named person:
    adds the cast slot and points those scenes at it. Everything else in the pack stays exactly as it was."""
    import copy
    out = copy.deepcopy(pack)
    cast = out.setdefault("cast", {})
    cast[slot] = dict(cast.get(slot) or {}, **{k: v for k, v in spec.items() if v is not None})
    n = 0
    for sc in out.get("scenes") or []:
        if isinstance(sc, dict) and sc.get("who") in replace:
            sc["who"] = f"cast:{slot}"
            n += 1
    people = (out.get("chat") or {}).get("people")
    target = normalize_slot(cast[slot]).get("who")
    if isinstance(people, dict) and target in WHO:
        for k in list(people):
            if k in replace and k != target:
                lines = people.pop(k)
                if isinstance(lines, dict) and isinstance(people.get(target), dict):
                    for sec, v in lines.items():
                        people[target][sec] = (people[target].get(sec) or []) + (v if isinstance(v, list) else [v])
                else:
                    people[target] = lines
    out["_locked"] = n
    return out


MALE = r"\b(he|him|his|himself|brother|bro|son|guy)\b"
FEMALE = r"\b(she|her|hers|herself|sister|sis|daughter|girl)\b"
SPORT_WORDS = {"basketball": r"\b(basketball|hoops?|court|dunk|layup|jumper|three[- ]pointer|free throws?|point guard)\b",
               "football": r"\b(football|touchdown|quarterback|qb|end zone|gridiron|huddle)\b",
               "baseball": r"\b(baseball|batting|pitcher|inning|home run|dugout|shortstop|bullpen)\b",
               "soccer": r"\b(soccer|striker|goalie|keeper|penalty kick|free kick|corner kick|hat trick|the pitch)\b",
               "softball": r"\b(softball|windmill|fastpitch)\b"}


def _story_words(sim, pack) -> str:
    """Everything a storyline says (its scenes' titles, text and lines), to tell who it's about."""
    out = []
    for sid, m in sim.cat.moments.items():
        if (m.get("scene") or {}).get("pack") == pack or m.get("scene_pack") == pack:
            out.append(json.dumps([m.get("title"), m.get("text"), (m.get("scene") or {}).get("by_text"),
                                   [(c.get("label"), c.get("ops")) for c in m.get("choices", [])]], ensure_ascii=False))
    return " ".join(out).lower()


def _fit(sim, cid, words) -> float:
    """How well someone fits what a storyline says: the right brother or sister, the one who plays the sport it's about."""
    w = sim.w
    c = w.chars[cid]
    he, she = len(re.findall(MALE, words)), len(re.findall(FEMALE, words))
    score = 0.0
    if he + she:
        score += 2.0 * (he - she) / (he + she) * (1 if c.gender == "m" else -1 if c.gender == "f" else 0)
    for sport, rx in SPORT_WORDS.items():
        n = len(re.findall(rx, words))
        if n:
            plays = any(w.groups.get(g, {}).get("skill") == sport for g in c.memberships) or (c.path or {}).get("sport") == sport
            score += min(3.0, n * 0.5) * ((1.0 if plays else 0.0) + c.interests.get(sport, 0) / 100)
    return score


def pick_cast(sim, me, pack, who, cands):
    """The person a storyline is about: the one you picked, else the one it keeps using, else the best fit (and keep them)."""
    w = sim.w
    if not cands:
        return None
    kept = cast_of(w, pack, who) if pack else None
    if kept in cands:
        return kept
    if len(cands) == 1 or not pack:
        return cands[0]
    words = _story_words(sim, pack)
    best = sorted(cands, key=lambda o: (-_fit(sim, o, words), o))[0]
    set_cast(w, pack, who, best)
    return best


def _context(sim, me, who, when, rng, pack=None) -> dict | None:
    """Who the scene is about and everything its text can say. None if nobody fits."""
    w = sim.w
    ctx = {"me_first": me.first}
    if who and who.startswith("cast:"):
        name = who[5:]
        them = bind(sim, me, name)
        if not them:
            return None  # nobody fits that slot in your story: these scenes don't happen
        if not (all(_in(_rel(w, me.id, them, f), r) for f, r in (when.get("you_feel") or {}).items())
                and all(_in(_rel(w, them, me.id, f), r) for f, r in (when.get("they_feel") or {}).items())):
            return None
        ctx["them"] = them
        ctx["them_first"] = w.chars[them].first
        ctx["cast_slot"] = name
        who = None
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
        if who in ("best_friend", "crush", "rival", "partner"):
            them = cands[0]
        elif pack and who in CASTABLE:
            them = pick_cast(sim, me, pack, who, cands)  # the storyline's person: the same one every time
        else:
            them = cands[int(rng.random() * len(cands))]
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
    """Once a morning in story mode: maybe one scene from the packs happens today. A storyline played in order offers only its
    next chapter (the first one that can happen now), a few days after its last; the rest come up now and then."""
    w = sim.w
    pid = w.meta.get("protagonist")
    me = w.chars.get(pid) if pid else None
    if not me or me.status != "active" or "story" not in w.meta:
        return None
    from . import moments as mo
    for name, d in merged()["cast"].items():  # slots that bind at the start of the story bind now
        if d["spec"].get("bind") == "start" and name not in w.meta.get("cast_slots", {}):
            bind(sim, me, name)
    busy = bool(mo.pending(w))  # another moment is waiting: only a scene with a date (Halloween...) still happens
    seen = w.meta.get("scenes_seen", {})
    last = max((d[-1] for d in seen.values() if d), default=-999)
    scenes = sorted((sid, m) for sid, m in sim.cat.moments.items() if m.get("scene"))
    if not scenes:
        return None
    rng = sim.streams.get("scene", w.day)
    by_pack = {}
    for sid, m in scenes:
        by_pack.setdefault(m["scene"].get("pack"), []).append((m["scene"].get("order", 0), sid, m))
    ordered = {pk for pk in by_pack if in_order(pk)}
    chapters_due = []
    for pk in sorted(ordered):
        lst = sorted(by_pack[pk], key=lambda x: x[0])
        nxt = next(((sid, m) for _, sid, m in lst if sid not in seen and _when_ok(sim, me, sid, m["scene"].get("when") or {}, ignore_time=True)), None)
        if not nxt:
            continue
        last_pk = max((seen[s][-1] for _, s, _ in lst if seen.get(s)), default=-999)
        if w.day - last_pk >= (nxt[1]["scene"].get("when") or {}).get("gap_days", CHAPTER_GAP_DAYS):
            chapters_due.append((w.day - last_pk, nxt))
    chapters_due = [x for _, x in sorted(chapters_due, key=lambda t: -t[0])]  # the storyline that's waited longest first
    free = [(sid, m) for sid, m in scenes if m["scene"].get("pack") not in ordered]
    rng.shuffle(free)
    dated_today = []
    for sid, spec in scenes:
        when = spec["scene"].get("when") or {}
        if when.get("dates") and _when_ok(sim, me, sid, when) and (spec["scene"].get("pack") not in ordered or (sid, spec) in chapters_due):
            dated_today.append((sid, spec))
    if not dated_today and (busy or w.day - last < SCENE_GAP_DAYS):
        return None
    due_ids = {sid for sid, _ in chapters_due}
    for sid, spec in (dated_today if busy else dated_today + chapters_due + free):
        when = spec["scene"].get("when") or {}
        if not _when_ok(sim, me, sid, when):
            continue
        chance = when.get("chance", 1.0 if when.get("dates") else CHAPTER_CHANCE if sid in due_ids else DEFAULT_CHANCE)
        if sid in due_ids:
            chance = max(chance, CHAPTER_CHANCE)
        if rng.random() >= chance:
            continue
        ctx = _context(sim, me, spec["scene"].get("who"), when, rng, pack=spec["scene"].get("pack"))
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
    ctx = _context(sim, me, who, when, sim.streams.get("scene-try", w.day, sid), pack=spec["scene"].get("pack"))
    if ctx is None:
        if isinstance(who, str) and who.startswith("cast:"):
            raise ValueError(f"nobody in your story fits '{who[5:]}' ({slot_label(slot_spec(who[5:]) or {})})")
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
    "texts": {
        "sibling_chatter": [
            "did you take my charger again",
            {"text": "mom's asking where you are. i said practice", "talk": "\"Mom's asking where you are. I said practice,\" {them_first} whispers from the doorway."},
            {"text": "u up? i need a favor", "when": ["late_night"]},
        ],
        "hang_talk": ["ok but this is the best fries in town", {"text": "i'm so glad we did this", "when": ["close"]}],
    },
    "mods": {"open": {"sibling": ["ok don't be mad but"]}, "talk": {"sibling": ["{them_first} {says}, already halfway out the door"]}},
    "replies": {"sibling": [["absolutely not", "sibling_tease"]]},
    "scenes": [{
        "id": "cover_for_me",
        "who": "older_sibling",
        "when": {"years": ["freshman", "sophomore"], "requires": ["school_day"], "chance": 0.05},
        "title": "{them_first} needs a favor",
        "text": [
            "{them_first} leans into your doorway, already whispering. \"If anyone asks, I was at the library till eleven. Deal?\"",
            "{them_first} corners you in the kitchen. \"Library. Till eleven. You saw me there. Okay?\"",
            "{them_first} drops onto the end of your bed. \"I need an alibi and you're it. Library, eleven. Please.\"",
        ],
        "by_text": ["if mom asks i was at the library till 11. deal??", "ok i need you to cover for me tonight. library. 11. pls"],
        "choices": [
            {"label": "Deal. You owe me.", "fits": {"loyalty": 1},
             "ops": [["rel_back", "them", "affection", 6], ["remember", "covered_for_sibling"],
                     ["say", ["{them_first} points at you on the way out. \"Legend.\"", "\"You're the best. Seriously,\" {them_first} says."]]]},
            {"label": "No way. I'm not lying for you.", "fits": {"discipline": 1, "loyalty": -0.5},
             "ops": [["rel_back", "them", "affection", -4], ["say", ["\"Wow. Okay. Remember this.\"", "{them_first} just stares at you. \"Unbelievable.\""]]]},
            {"label": "Beat me in HORSE and I'll do it.", "fits": {"competitiveness": 1},
             "ops": [["minigame", "basketball",
                      {"great": [["rel_back", "them", "respect", 5], ["say", "You drain the last shot. {them_first} groans. \"Fine. I'll cover for myself.\""]],
                       "good": [["say", "It comes down to the last shot. You call it a tie and cover anyway."], ["rel_back", "them", "affection", 3]],
                       "miss": [["rel_back", "them", "affection", 4], ["say", "{them_first} wins easy. \"Library. Eleven. Thanks.\""]]},
                      {"base": 0.5, "athletic": 0.3}]]},
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

How to write it:
- Write a LOT. The game remembers what it has used and won't repeat a line until it's rested, so more lines means more
  life. Aim for 12 or more new lines for every text pool you touch, and give every scene 3 versions of its text and
  2 or 3 versions of every "say" line (a list instead of one string).
- Every line works two ways: as a text, and said in person. Give the lines that matter most a "talk" version (how they'd say
  it to your face) and "when" tags (late_night, close, crush, stressed...) so the right line shows up at the right moment.
  Add "mods" (openers, closers, ways of saying things) for the people in your pack: one base line times its mods is many lines.
- When a scene is about someone you'd text, add "by_text" (what they'd text you instead) so it can happen either way.
- Use the mini games. Where a scene fits one (pickup soccer, shooting around, cup pong at a party, a round of golf, a quiz),
  make one choice play it, with different outcomes for great, good and miss. Always keep two choices that don't need a game.
- Add texting lines in "chat" for what I asked for: how people answer when I text them, questions they ask back, follow-ups,
  and flirt lines by style (tease, sweet, bold, funny, cheesy). At least 8 lines in every list you touch.
- Make it a story: write the scenes in the order they should happen (they play as chapters), give important scenes a "then"
  so they keep going, and use ["remember", ...] with "when": {"remembered": [...]} so choices change what happens later.
- In scenes about someone, make a choice a style ("vibe": tease, sweet, bold, funny, cheesy) with good / meh / bad outcomes.
- Don't reuse the same idea twice. Vary the openings, the length, and the mood.

How to answer:
- Reply with ONE JSON code block and nothing else after it. It must be valid JSON (double quotes, no comments, no trailing commas).
- Follow the format and the lists in the guide below exactly. The game checks every line and will tell me what to fix.
- Only add what I asked for.

"""

UPDATE_PROMPT = """You're building out a dialogue pack (one of my storylines) for LIFE OS, a life-simulation game: you play one person
from the first day of high school (Guilford High School in Guilford, Connecticut) through college. I made this storyline before
the game could tell real stories. Build it out: make it a story with chapters, scenes that keep going, choices that matter
later, and people who react like themselves. Make it much bigger.

How storylines work now:
- A storyline's scenes are chapters: they happen in the order they're written in "scenes", a few days apart (set
  "when": {"gap_days": 7} on a scene to space it out more). A chapter that can't happen yet (wrong school year, needs a
  girlfriend...) waits, and the story moves on to the next one that can.
- A choice can keep the scene going right away with "then": {"text": "what happens next", "choices": [...]}. Up to two
  "then"s deep, so a scene can be three decisions long.
- Choices can matter later: ["remember", "fact"] in a choice, then a later chapter with "when": {"remembered": ["fact"]} (or
  "not_remembered") only happens on that path. Use this for branches and different endings.
- In a scene about someone, a choice can be a style: ["vibe", "tease" | "sweet" | "bold" | "funny" | "cheesy" | "chill",
  {"good": [...], "meh": [...], "bad": [...]}]. Whether it lands depends on what that person likes, and I learn their taste.
- Mini games can be a choice (["minigame", ...] with great / good / miss outcomes).
- "who" picks the person the story is about and keeps them for every chapter. Use the most specific kind (older_brother, not
  older_sibling, when it's about my brother). If the pack has a "cast" section (named people) and scenes say "who":
  "cast:<slot>", keep the cast section and those who values exactly as they are.

Do all of this:
1. Keep the "name" exactly the same (so it replaces the old pack when I paste it in), and keep every scene id and line that's
   already there. You can reorder scenes so they read as a story.
2. Put the scenes in story order (the order they should happen) and turn them into a real arc: a beginning, things getting
   harder or more interesting, a turning point, and an ending. Add new chapters so the storyline has at least 8.
3. Give at least half the chapters a "then" so the scene keeps going after the first choice (and some a second "then").
4. Make choices matter: at least 2 facts remembered early that change which later chapters happen, and 2 different endings
   (one for each path).
5. In every scene about someone, make at least one choice a style choice (vibe) with good / meh / bad outcomes written for
   that person.
6. Scenes: give each scene's "text" 3 versions (a list) and each "say" 2 or 3 versions. Add a "by_text" version to scenes about
   someone I'd text. 2 to 4 choices per scene and per "then".
7. Where a scene fits a mini game, give it a choice that plays it.
8. If a scene's "who" is a general kind but it's clearly about one person, change it to the specific kind (older_brother,
   older_sister, younger_brother, younger_sister, brother, sister).
9. Add a "chat" section with texting lines for this storyline's people under "chat": {"people": {"<kind>": {...}}}: how they
   answer, questions they ask back (with the kind of answer), follow-ups, things that come up after you've done something
   together ("recent"), and for a crush or partner flirts by style. At least 6 lines in every list you add.

Reply with the COMPLETE built-out pack as ONE JSON code block and nothing after it: valid JSON, no comments, no trailing commas.
Follow the format and the lists in the guide below exactly; the game checks every line.

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
    a("- `texts`: more lines for a text-message pool (the list is below). Use only that pool's placeholders. A line can be a plain "
      "string or an object with a `talk` version and `when` tags (see Every line, two ways).")
    a("- `replies`: more reply buttons for a reply set. Each option is `[\"what you say\", \"tone\"]`. The tone decides the effect.")
    a("- `narration`: more lines for the story feed, keyed `event.outcome`.")
    a("- `moment_choices`: extra choices on an existing story moment.")
    a("- `scenes`: brand-new story moments. The game decides when they happen from `who` and `when`.")
    a("- `mods`: openers, closers and ways of saying things, by context, that the game puts on lines.")
    a("- `chat`: lines for texting that goes back and forth (when you text someone yourself): how they answer, what they ask "
      "back, follow-ups, flirt lines by style. See Texting lines.")
    a("- `schedule`: when episodes of any storyline air: `{\"scene_id\": {\"years\": [\"sophomore\"], \"after\": [\"other_scene\"], "
      "\"gap_days\": 7}}`. A season plan uses this to weave all your storylines into one story.\n")
    a("## Texting lines\n")
    a("When you text someone yourself, the game reads what you typed and answers from these lists. Add to any of them in a "
      "`chat` section. Every list is short lines; `{me}` is your first name.\n")
    a("- `reply.<what you did>.<how it went>`: their answer. What you did: greet, chat, ask, joke, compliment, flirt, plans, support, "
      "apology, vent, news, gossip, thanks, dry, rude, love, ask_out, answered, style, family. How it went, for flirt: landed, playful, "
      "awkward, shut; for jokes: laugh, meh; for chat: warm, ok, cold; vent: comfort, meh; news: hype, meh; gossip: spill, shut; "
      "style: loves, hates (when you hit or miss their taste).")
    a("- `recent.<kind>`: how they bring up something you just did together: hangout, date, group, game_win, game_loss.")
    a("- `people.<kind>`: lines for one kind of person (older_sibling, crush, coach...) in the same shape. They use those first, "
      "so a brother texts like a brother.")
    a("- `topic.<topic>`: their answer when you bring something up: game, school, music, weekend, food.")
    a("- `ask.general` / `ask.flirty`: questions they send back, as {\"q\": \"you going friday?\", \"a\": \"yesno\"}. `a` is the "
      "kind of answer: yesno, doing, day, weekend, open, flirty. The game offers you fitting answers.")
    a("- `answer.<kind>`: answers you can tap (`yes`, `no`, doing, day, weekend, open, flirty).")
    a("- `follow.<topic>`: them following up a day or two later (\"how'd the test go??\").")
    a("- `suggest.<kind>`: messages you can tap to send: greet, ask, joke, compliment, plans, support, apology, bye, love, ask_out, "
      "and flirts by style: flirt_tease, flirt_sweet, flirt_bold, flirt_funny, flirt_cheesy.")
    a("- `close.nice` / `close.tired` / `close.cold`: how they wrap up a conversation. `double`: extra texts from someone into you.\n")
    a('```json\n"chat": {"topic": {"school": ["mr. hanley gave us a pop quiz AGAIN"]}, "suggest": {"flirt_tease": ["you\'re lucky you\'re cute"]}, '
      '"ask": {"general": [{"q": "you going to the bonfire?", "a": "yesno"}]}}\n```\n')
    a("## Storylines: chapters, scenes that keep going, choices that matter\n")
    a("Your packs play as storylines: their scenes happen in the order they're written in `scenes`, as chapters a few days apart "
      f"(at least {CHAPTER_GAP_DAYS} days; set `\"when\": {{\"gap_days\": 7}}` on a scene for more). A chapter that can't happen yet waits, and the "
      "story moves on to the next one that can. (On the phone, each storyline has a Play in order switch; a pack can also say "
      "`\"in_order\": false` to let its scenes come up in any order.)\n")
    a("- **Keep going:** a choice with `then` continues the scene right away: `{\"label\": \"You're on\", \"then\": {\"text\": "
      "\"It's 10-10...\", \"choices\": [...]}}`. Up to two `then`s deep (three decisions in one scene).")
    a("- **Branches:** `[\"remember\", \"fact\"]` in a choice, and a later chapter with `\"when\": {\"remembered\": [\"fact\"]}` "
      "(or `not_remembered`) only happens on that path. `\"when\": {\"after\": [\"scene_id\"]}` waits for a specific scene.")
    a("- **Style choices:** in a scene about someone, `[\"vibe\", \"tease\", {\"good\": [...], \"meh\": [...], \"bad\": [...]}]` "
      "lands or misses by what they like (tease, sweet, bold, funny, cheesy; chill is the safe pick), and you learn their taste.")
    a("- **The same person:** `who` picks who the story is about and keeps them for every chapter (and its texting lines). Use "
      "the most specific kind (older_brother rather than older_sibling).\n")
    a("```json\n" + json.dumps({"id": "driveway_one_on_one", "title": "One on one", "who": "older_brother",
                                "text": ["{them_first} bounces you the ball. \"First to eleven.\""],
                                "choices": [{"label": "You're on", "ops": [["remember", "played_brother"]],
                                             "then": {"text": "It's 10-10. {them_first} is talking trash about your left hand.",
                                                      "choices": [{"label": "Drive left", "ops": [["vibe", "bold", {"good": ["You score. He can't believe it."],
                                                                                                                  "meh": ["He blocks it, barely."],
                                                                                                                  "bad": ["He swats it into the yard."]}]]},
                                                                  {"label": "Pull up from deep", "ops": [["mood", 2]]}]}},
                                            {"label": "Homework first", "ops": [["mood", -1]]}]},
                               ensure_ascii=False, indent=1) + "\n```\n")
    a("## Every line, two ways\n")
    a("Any line can be texted or said in person. A text-pool line is a plain string (the text), or an object:\n")
    a('```json\n{"text": "u free later?", "talk": "\\"You free later?\\" {them_first} asks, trying to sound casual.", "when": ["late_night", "crush"]}\n```\n')
    a("- `text`: how it reads on the phone. The game roughs up spelling and adds emoji by personality, so write it plain.")
    a("- `talk` (optional): how they'd say it to your face, with `{them_first}` (who's talking). Leave it out and the game makes "
      "one: it spells out the abbreviations, capitalizes, puts it in quotes and adds how it was said from the `talk` mods.")
    a("- `when` (optional): context tags that all have to be true for the line to be used. Lines that fit the moment more "
      "specifically get picked over generic ones more often than not. Tags:\n")
    a("| tag | true when |")
    a("|---|---|")
    for k, v in _lines.TAGS.items():
        a(f"| `{k}` | {v} |")
    a("\nThe pools marked IN PERSON below are things people say to your face; they show in the story feed when you hang out, "
      "go on a date or stop and talk.\n")
    a("## Mods: one line, many versions\n")
    a("Mods dress a line for its moment. The game adds an opener or a closer to some texts and says in-person lines a "
      "particular way, picked by context tag (or `any`; join tags with + when all must hold, like `close+guys` for \"bro\"). "
      "One base line times its mods is a lot of different lines.\n")
    for k, v in MOD_KINDS.items():
        a(f"- `{k}`: {v}")
    base_mods = _base("mods.json")
    a("\n```json\n\"mods\": " + json.dumps({k: {t: v[:2] for t, v in list(base_mods[k].items())[:3]} for k in MOD_KINDS}, ensure_ascii=False) + "\n```\n")
    a("Openers and closers are short (under 40 characters, no placeholders). A talk mod must have `{them_first}` and can use "
      "`{says}` (it becomes says or asks).\n")
    a("## Nothing repeats\n")
    a("The game remembers every line it uses and rests it before using it again; the bigger the pool, the longer the rest. "
      "Scene `text`, `by_text`, `say` lines and `text` op lines can each be a list of versions instead of one string, and "
      "the game rotates through them the same way. So write plenty, and make the versions really different, not the same "
      "sentence reworded.\n")
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
    a("**id**: lowercase with underscores, unique.  **title**: under 80 characters.  **text**: the scene, second person; one "
      "string or a list of versions.\n")
    a("**by_text** (optional, needs `who`): what they'd text you instead, one line or a list. A scene with both can happen in "
      "person or by text (more often by text on days off, rarely with family). By text, their message lands in your phone "
      "and the choices are your replies; write `say` lines that work either way.\n")
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
    a("## Cast slots: one specific person (`cast`)\n")
    a("When a storyline is about one specific person (your older brother, the basketball star; your twin), name them in a "
      "`cast` section and set the scenes' `who` to `cast:<slot>`. A slot is bound once, to one real person already in the "
      "player's story (never a new or changed one), and kept for the whole run: through graduation, college, everything. "
      "Every pack that uses the same slot name gets the same person, so two storylines about the same brother should use "
      "the same slot name. If nobody in the story fits, those scenes don't happen (it never falls back to someone else, "
      "like a sister for a brother story). The player can see and change who a slot is on the pack's card.\n")
    a("| field | what it means |")
    a("|---|---|")
    a("| `who` (required) | the kind of person: " + ", ".join(f"`{k}`" for k in CASTABLE) + ". Use the specific kind: `older_brother`, not `older_sibling`. |")
    a("| `sport` | they play (or played) this sport: on its team, or clearly into it |")
    a("| `grade_offset` | how many grades ahead of the player they are: 3 = a senior when the player is a freshman (-2 = two behind) |")
    a("| `bind` | `start` (bind as soon as the story runs with this pack) or `first_scene` (default: when their first scene comes up) |")
    a("| `bond` | start at least this close, both ways, once, when they're bound: `{\"familiarity\": 95, \"affection\": 75, \"trust\": 75}` |")
    a("| `floor` | in these storylines, the relationship never drops below this, whatever the player chooses: `{\"affection\": 55}` |")
    a("| `label` | how the pack card describes them (\"Your older brother, the basketball star\") |")
    a("")
    a('```json\n"cast": {"lead_brother": {"who": "older_brother", "sport": "basketball", "grade_offset": 3, "bind": "start",\n'
      '  "bond": {"familiarity": 95, "affection": 75, "trust": 75}, "floor": {"affection": 55, "trust": 55}}},\n'
      '"scenes": [{"id": "bro_team_01_first_morning", "who": "cast:lead_brother", ...}]\n```\n')
    a("Also accepted (same meaning): `relationship_to_player` for `who`, `gender` (\"male\"/\"female\", must match `who`), "
      "`grade_offset_at_player_freshman` for `grade_offset`, `basketball_player: true` (and football/baseball/soccer/softball) for `sport`, "
      "and `same_high_school_at_start`, `bind_once` (always true). Remembered facts (`remember`) keep pointing at the same person "
      "after they graduate. A chapter whose school `years` are over counts as skipped for `after`, so a missed season doesn't "
      "strand the rest of the story.\n")
    a("## Trivia (`trivia`)\n")
    a("Quiz questions for class quizzes, midterms and finals. Each: `q`, `a` (the right answer), `w` (exactly three wrong answers), "
      "`g` (the lowest grade it fits: 9 to 12, or 13 for college). Facts must be correct; keep answers short. Math is generated, so "
      "don't add math. Subjects: " + ", ".join(f"`{k}`" for k in __import__("lifeos.trivia", fromlist=["x"]).subjects() if k != "math") + ".\n")
    a('```json\n"trivia": {"biology": [{"q": "What do red blood cells carry?", "a": "Oxygen", "w": ["Insulin", "Bile", "Calcium"], "g": 9}]}\n```\n')
    a("## Mini games (the `minigame` op)\n")
    from .minigames import reg as _mreg
    a("A choice can be played: `[\"minigame\", game, {\"great\": [ops], \"good\": [ops], \"miss\": [ops]}, odds if nobody plays]`. "
      "The player plays the game right there; great is 80% or better, good 50% or better, anything else a miss, and each "
      "picks its own ops (write a different `say` for each). If they skip it, the odds roll instead. Use `\"sport\"` for the "
      "player's own sport in a sports scene. A choice with a game that isn't ready stays hidden, so always keep two other "
      "choices. Use them: a scene that turns into a game is the best kind. The quick ones (`hold`, `sweep`, `mathdash`, `flash`, "
      "`oddone`, `lineup`, `reflex`) take a few seconds, so they fit anywhere: a bet, a dare, a dumb contest with a friend. "
      "(Class already has its own quick games most school days, so your scenes don't need to make class challenges.)\n")
    a("| game | what it is | scenes it fits |")
    a("|---|---|---|")
    for k, g in _mreg()["games"].items():
        if g.get("status") != "ready":
            continue
        a(f"| `{k}` | {g['title']}: {g.get('blurb', '')} | {MG_FITS.get(k, '')} |")
    a("")
    a("## Ops\n")
    a("| op | how to write it | what it does |")
    a("|---|---|---|")
    for k, (n, ex, doc) in OPS.items():
        a(f"| `{k}` | `{ex}` | {doc} |")
    a("\nTraits: " + ", ".join(TRAITS) + ".  Talents: " + ", ".join(APTITUDES) + ".  Skills: " + ", ".join(sorted(_skill_ids())) + ".\n")
    a("Keep effects small and believable: most relationship changes are 2 to 8; 10+ is a big moment. Good choices aren't free: "
      "the kind option can cost stress or energy, the bold one can backfire through `chance`.\n")
    a("## Checklist\n")
    a("- One JSON object, valid JSON, with a `name`.\n- Pool, set, moment, op and tag names exactly as listed.\n"
      "- Only the placeholders listed for that spot.\n- Scenes have 2 to 4 choices and unique ids.\n"
      "- Lots of lines, real variety, versions that differ in more than a word.\n")
    return "\n".join(L)


def prompt_for_ai() -> str:
    return PROMPT + guide_markdown()


TEXTING_PROMPT = """You're upgrading a dialogue pack (one of my storylines) for LIFE OS, a life-simulation game: you play one person from
the first day of high school (Guilford High School in Guilford, Connecticut) through college. Texting in the game just got a
lot deeper, and I want the people in this storyline to text like themselves. Add a big "chat" section to the pack.

How texting works now:
- I can type anything to anyone, or tap a suggestion. The game reads what I did: say hi, ask something, chat, joke, compliment,
  flirt (in a style: tease, sweet, bold, funny or cheesy), make plans, check on them, apologize, vent about my day, share good
  news, gossip, say thanks, go dry, be rude, say bye, or ask them out.
- They answer from lines picked by what I did and how it went (a joke can land or not, a flirt can land, be playful, get
  awkward or get shut down, venting gets comfort or a shrug). They often ask me something back, and the game offers fitting
  answers. A conversation runs until they wrap it up. Someone into me answers fast and sometimes double-texts.
- Everyone has a taste: some love teasing, some love sweet stuff, some hate cheesy lines. Each style can land or miss.
- They remember: if I mention a test or a game they follow up later, and when we just did something together (a hangout, a
  date, the boys, a game we won or lost) they bring it up when we start talking.
- Lines can belong to a kind of person (older_sibling, crush, coach...): those people use their own lines first, so a brother
  texts like a brother and a coach like a coach.

Do all of this:
1. Keep the "name" exactly the same (so it replaces the old pack when I paste it in), and keep everything already in the pack.
2. Add a "chat" section. For every person this storyline is about, add their own lines under "chat": {"people": {"<kind>": {...}}},
   using the kinds of people listed below, the most specific one that fits (older_brother, not older_sibling, when it's about
   my brother). If the pack's scenes use a general kind for someone specific, change their "who" to the specific kind too.
   Write the lines so you could tell who's texting without a name.
3. For each of those people, fill at least:
   - reply.greet (warm, ok, cold), reply.chat (warm, ok, cold), reply.ask (warm, ok, cold), reply.joke (laugh, meh),
     reply.compliment (warm, weird), reply.vent (comfort, meh), reply.news (hype, meh), reply.plans (yes, no, already),
     reply.apology (accept, cold), reply.support (thanks, fine), reply.thanks (warm, ok), reply.dry (dry, check)
   - ask.general: questions they'd text back, each {"q": "...", "a": "yesno" | "doing" | "day" | "weekend" | "open" | "flirty"}
   - topic (game, school, music, weekend, food), follow (school, game, weekend), recent (hangout, date, group, game_win, game_loss)
   - close (nice, tired, cold)
   - suggest: things I'd text THEM (greet, ask, joke, plans, support, apology, vent, news, thanks, bye)
   For a crush, partner or ex, also: reply.flirt (landed, playful, awkward, shut), reply.style (loves, hates), reply.ask_out
   (yes, no), reply.love (back), ask.flirty, double, and suggest.flirt_tease, flirt_sweet, flirt_bold, flirt_funny, flirt_cheesy.
   For a sibling, also reply.family (sib_flirt, sib_ok, sib_warm) and reply.love (fam).
4. At least 6 lines in every list, more for the ones that come up most (greet, chat, ask, close). Short, like real texts (under
   120 characters). Vary them: openers, lengths, moods. Don't repeat an idea.
5. Add general lines too (top level of "chat", same shape) for anyone in the storyline's world: at least 6 more for each of
   reply.vent, reply.news, reply.gossip (spill, shut), reply.thanks and recent.
6. Use {me} for my first name if you need it; no other names or placeholders in chat lines. Keep it PG-13.

Reply with the COMPLETE upgraded pack as ONE JSON code block and nothing after it: valid JSON, no comments, no trailing commas.
The game checks every line and will tell me exactly what to fix.

"""


def texting_guide() -> str:
    """Everything a texting upgrade needs: the shape of "chat", every place a line can go, and the kinds of people."""
    base = _base("chat.json")
    L = ["## The \"chat\" section\n",
         "Every list is short text lines. The same shape works at the top level (anyone) and under people.<kind> (just them).\n"]
    L.append("Their answers, `reply.<what you did>.<how it went>`:")
    for k, v in base["reply"].items():
        L.append(f"- reply.{k}: {', '.join(v)}")
    L.append("\nQuestions they ask back, `ask.general` / `ask.flirty`: each {\"q\": \"...\", \"a\": kind}; a is one of yesno, doing, day, "
             "weekend, open, flirty.")
    L.append(f"Answers I can tap, `answer.<kind>`: {', '.join(base['answer'])}.")
    L.append(f"What I brought up, `topic.<topic>`: {', '.join(base['topic'])}.")
    L.append(f"Following up later, `follow.<topic>`: {', '.join(base['follow'])}.")
    L.append(f"Something we just did together, `recent.<kind>`: {', '.join(base['recent'])}.")
    L.append(f"Wrapping up, `close.<tone>`: {', '.join(base['close'])}. Extra texts from someone into me: `double`.")
    L.append(f"Things I'd text them, `suggest.<kind>`: {', '.join(base['suggest'])}.\n")
    L.append("## Kinds of people (for chat.people)\n")
    for k, v in WHO.items():
        L.append(f"- `{k}`: {v}")
    L.append("\n## Example\n")
    L.append("```json\n" + json.dumps({"name": "My storyline", "chat": {
        "people": {"older_sibling": {"reply": {"greet": {"warm": ["what do you want", "oh look who remembered i exist"]},
                                               "vent": {"comfort": ["who do i need to fight", "come to my room, we'll figure it out"]}},
                                     "ask": {"general": [{"q": "did you take my charger", "a": "yesno"}]},
                                     "suggest": {"ask": ["can you drive me later", "is mom mad at me or"]}},
                   "coach": {"reply": {"greet": {"warm": ["Hey. What's up.", "Talk to me."]}},
                             "recent": {"game_win": ["Good game tonight. Film at 3.", "Proud of that effort. Don't get comfortable."]}}},
        "reply": {"gossip": {"spill": ["no WAY. who told you"]}}}}, indent=1, ensure_ascii=False) + "\n```\n")
    return "\n".join(L) + "\n"


def prompt_for_texting(pid: str | None = None) -> str:
    """The prompt that gives a storyline's people their own way of texting (the pack itself, when it's loaded here)."""
    body = "Here's my pack:\n\n[paste your pack's JSON here]\n\n"
    if pid:
        p = next((x for x in packs() if x["id"] == pid), None)
        if p is None:
            raise KeyError(pid)
        body = "Here's my pack:\n\n```json\n" + json.dumps(p["pack"], indent=1, ensure_ascii=False) + "\n```\n\n"
    return TEXTING_PROMPT + body + texting_guide()


SHOW_PROMPT = """You're the showrunner for my LIFE OS story. LIFE OS is a life-simulation game: you play one person from the first day
of high school (Guilford High School in Guilford, Connecticut) through college, seven years. I want my whole run to feel like ONE
big story with a bunch of episodes, like a TV show: each school year is a season, and my storylines are the threads that run
through it. Below is a summary of every storyline I have: each one's episodes in order, who they're about, and the facts its
choices remember.

How it plays:
- Each storyline's episodes air in the order they're written, a few days apart, woven together with the others. An episode
  waits until its conditions are true (school year, things remembered...).
- A "schedule" can place any episode of any storyline: which school years it airs in ("years"), which episodes from other
  storylines have to air first ("after"), and how long after those it comes ("gap_days").
- New "scenes" here are crossover episodes. They're about someone ("who"), can depend on facts remembered in any storyline
  ("when": {"remembered": [...]}), and can remember facts that change other storylines.

Make me a season plan: ONE pack named "Season plan" with
1. "schedule": an entry for EVERY episode below. Spread each storyline across the seasons so the years have a shape (a
   premiere, things building, a finale), interleave the storylines so they feel connected, and use "after" so episodes that
   relate to each other air in a sensible order. Don't put more than one storyline's big moment in the same week.
2. "scenes": at least 8 crossover episodes that tie storylines together: characters from different storylines meeting,
   something from one thread causing trouble in another, a season finale that pays off two threads at once. Give them
   "then" so they keep going, style choices ("vibe") where they're about someone, and remember facts that later episodes
   use. Put each crossover in the schedule too.
3. Keep every scene id you schedule exactly as it is below. Don't rewrite my storylines; this pack only plans and connects them.

Reply with ONE JSON code block and nothing after it: valid JSON, no comments, no trailing commas. The game checks every line.

"""


def show_summary() -> str:
    """Every storyline you have, compact: its episodes in order, who they're about, what they remember."""
    L = []
    m = merged()
    for p in packs():
        if not p["enabled"] or p["source"] != "yours" or (p["pack"].get("name") == "Season plan"):
            continue
        L.append(f"### {p['pack'].get('name')}")
        for sc in p["pack"].get("scenes") or []:
            if not isinstance(sc, dict):
                continue
            text = sc.get("text")
            text = (text[0] if isinstance(text, list) and text else text or "")[:140].replace("\n", " ")
            facts = sorted({op[1] for op in _all_ops(sc) if isinstance(op, list) and op and op[0] == "remember" and len(op) > 1})
            when = sc.get("when") or {}
            bits = [f"who: {sc.get('who')}" if sc.get("who") else None,
                    f"years: {', '.join(when['years'])}" if when.get("years") else None,
                    f"needs remembered: {', '.join(when['remembered'])}" if when.get("remembered") else None,
                    f"remembers: {', '.join(facts)}" if facts else None]
            L.append(f"- `{sc.get('id')}` \"{sc.get('title')}\" ({'; '.join(b for b in bits if b)}): {text}")
        L.append("")
    return "\n".join(L) if L else "(no storylines yet)\n"


def _all_ops(sc):
    out = []
    def walk(chs):
        for ch in chs or []:
            if isinstance(ch, dict):
                out.extend(ch.get("ops") or [])
                if isinstance(ch.get("then"), dict):
                    walk(ch["then"].get("choices"))
    walk(sc.get("choices"))
    return out


def prompt_for_show() -> str:
    return SHOW_PROMPT + "## My storylines\n\n" + show_summary() + "\n" + guide_markdown()


def prompt_for_update(pid: str | None = None) -> str:
    """The prompt that upgrades a pack you already have: the pack itself (when it's loaded here), what to change, and the guide."""
    body = "Here's my pack:\n\n[paste your pack's JSON here]\n\n"
    if pid:
        p = next((x for x in packs() if x["id"] == pid), None)
        if p is None:
            raise KeyError(pid)
        body = "Here's my pack:\n\n```json\n" + json.dumps(p["pack"], indent=1, ensure_ascii=False) + "\n```\n\n"
    return UPDATE_PROMPT + body + guide_markdown()


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
