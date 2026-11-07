"""A scene's moment: the real event it's about, on this world's calendar.

A storyline's outline says "April", but the scene is "Zack's first varsity game", or "the night before baseball tryouts",
or "Nicole's SCC final". A month alone lets it play any day in April: the day before the game, or a week after it. A
moment ties it to the event: the scene plays on that team's game day (or the day after, or the night before), at
tryouts, on the first or last game, at the end of the season, or in the tournament round it's about.

Where a moment comes from:
- a tag (in the outline's "when" or the scene's tags): `game day`, `after a game`, `night before tryouts`, `first game`,
  `senior night`, `after the season`, `SCC final`, `state semifinal`, `holiday tournament`, with a sport or a person
  when it isn't yours: `Nicole's game day`, `basketball tryouts`;
- or the scene's own words (its title, the outline's summary, its first lines), when no tag says.

Whose game: the person whose game it is ("Nicole's soccer game"), else yours if you're on that sport's team, else the
first person named who is, else your school's team in that sport. Someone who isn't at your school anymore (your brother
at college) isn't a game here: the scene plays as written.

The event wins over the month: a scene tagged "June" that's about the last home game plays on the last home game. A month
still narrows it when the event falls in it ("April · game day": an April game).
"""
from __future__ import annotations

import re

from . import calendar as calm

SPORT_WORDS = {"baseball": "baseball", "softball": "softball", "basketball": "basketball", "hoops": "basketball",
               "football": "football", "soccer": "soccer"}
SPORT_RX = re.compile(r"\b(baseball|softball|basketball|hoops|football|soccer)\b", re.I)

# kind -> (days from the event: lo, hi), what it reads as
KINDS = {
    "game": (0, 0, "game day"),
    "night_before_game": (-1, -1, "the night before a game"),
    "after_game": (0, 1, "after a game"),
    "first_game": (0, 0, "the first game"),
    "night_before_first_game": (-1, -1, "the night before the first game"),
    "last_game": (0, 0, "the last regular-season game"),
    "regular_end": (0, 2, "the end of the regular season"),
    "tryouts": (0, 0, "tryouts"),
    "before_tryouts": (-5, -1, "the days before tryouts"),
    "after_tryouts": (1, 3, "right after tryouts"),
    "season_end": (0, 14, "after the season's last game"),
    "postseason": (0, 0, "a tournament game"),
    "after_postseason": (0, 1, "after a tournament game"),
    "holiday": (0, 0, "the holiday tournament"),
}
ROUNDS = {"championship": "championship", "final": "championship", "finals": "championship", "title game": "championship",
          "semifinal": "semifinal", "semifinals": "semifinal", "semi": "semifinal", "semis": "semifinal",
          "final four": "semifinal", "quarterfinal": "quarterfinal", "quarterfinals": "quarterfinal",
          "elite eight": "quarterfinal", "first round": "first round", "opening round": "first round",
          "second round": "second round"}

# ------------------------------------------------------------------------------------------------ reading a tag
_POSS = r"(?:(?P<who>[a-z][a-z'\-]+)'s\s+)?"
_SP = r"(?:(?P<sport>baseball|softball|basketball|hoops|football|soccer)\s+)?"
TAG_FORMS = [
    (rf"^(?:the\s+)?(?:night|evening|day)\s+before\s+{_POSS}(?:the\s+|a\s+)?{_SP}(?:first\s+game|opener|season\s+opener|home\s+opener)$",
     "night_before_first_game"),
    (rf"^{_POSS}{_SP}(?:first\s+(?:home\s+|varsity\s+|jv\s+)?game|opener|season\s+opener|home\s+opener|opening\s+day|opening\s+night)$",
     "first_game"),
    (rf"^{_POSS}{_SP}(?:last\s+(?:regular[- ]season\s+|home\s+)?game|senior\s+night|season\s+finale)$", "last_game"),
    (rf"^(?:the\s+)?(?:night|day|days|week)\s+before\s+{_POSS}{_SP}tryouts?$", "before_tryouts"),
    (rf"^{_POSS}{_SP}tryouts?\s+tomorrow$", "before_tryouts"),
    (rf"^(?:right\s+)?after\s+{_POSS}{_SP}tryouts?$", "after_tryouts"),
    (rf"^{_POSS}{_SP}(?:roster|cut\s+list|cuts)\s+(?:posted|goes\s+up|go\s+up)$", "after_tryouts"),
    (rf"^{_POSS}{_SP}tryouts?(?:\s+day)?$", "tryouts"),
    (rf"^(?:after|end\s+of)\s+{_POSS}(?:the\s+)?{_SP}season$", "season_end"),
    (rf"^{_POSS}{_SP}season(?:'s|\s+is)?\s+over$", "season_end"),
    (rf"^{_POSS}{_SP}banquet$", "season_end"),
    (rf"^{_POSS}{_SP}holiday\s+tournament$", "holiday"),
    (rf"^(?:the\s+)?(?:night|evening)\s+before\s+{_POSS}(?:a\s+|the\s+)?{_SP}game$", "night_before_game"),
    (rf"^{_POSS}{_SP}game\s+tomorrow$", "night_before_game"),
    (rf"^(?:right\s+)?after\s+{_POSS}(?:a\s+|the\s+)?{_SP}game$", "after_game"),
    (rf"^{_POSS}{_SP}postgame$", "after_game"),
    (rf"^{_POSS}{_SP}(?:game\s*day|game-day|game\s+night)$", "game"),
    (rf"^at\s+{_POSS}(?:a\s+|the\s+)?{_SP}game$", "game"),
]
TAG_FORMS = [(re.compile(rx), k) for rx, k in TAG_FORMS]
_STAGE_RX = re.compile(r"^(?:(?P<who>[a-z][a-z'\-]+)'s\s+)?(?:(?P<sport>baseball|softball|basketball|hoops|football|soccer)\s+)?"
                       r"(?P<after>after\s+(?:the\s+)?)?(?P<stage>scc|conference|state|playoffs?|postseason|tournament)"
                       r"(?:\s+(?:tournament|playoffs?))?(?:\s+(?P<round>championship|final|finals|title\s+game|semifinals?|semis?|"
                       r"quarterfinals?|first\s+round|opening\s+round|second\s+round))?(?:\s+game)?$")


def parse_tag(tok: str) -> dict | None:
    """One tag ('night before tryouts', "Nicole's game day", 'state semifinal') -> a moment, or None."""
    low = re.sub(r"\s+", " ", tok.lower().strip().replace("’", "'"))
    m = _STAGE_RX.match(low)
    if m and (m.group("stage") not in ("tournament",) or m.group("round")):
        st = m.group("stage")
        stage = "scc" if st in ("scc", "conference") else "state" if st == "state" else None
        rnd = ROUNDS.get(re.sub(r"\s+", " ", m.group("round") or "")) if m.group("round") else None
        return _moment("after_postseason" if m.group("after") else "postseason", m.group("sport"), m.group("who"), stage, rnd, "tag")
    for rx, kind in TAG_FORMS:
        m = rx.match(low)
        if m:
            gd = m.groupdict()
            return _moment(kind, gd.get("sport"), gd.get("who"), None, None, "tag")
    return None


def _moment(kind, sport, who, stage=None, rnd=None, src="read") -> dict:
    out = {"kind": kind, "sport": SPORT_WORDS.get(sport or "", None), "src": src}
    if who and who not in ("my", "your", "our", "the", "a"):
        out["owner"] = who.strip("'")
    if stage:
        out["stage"] = stage
    if rnd:
        out["round"] = rnd
    return out


# ------------------------------------------------------------------------------------------------ reading a scene
_W = r"(?:[\w'-]+ ){0,3}"  # a few words between ("after Nikki's big soccer game")
NOT_A_GAME = re.compile(r"\b(video ?games?|board games?|card games?|drinking games?|table games?|games? night|mind games|desk games|"
                        r"game of (pool|cards|life|chess|catch|telephone|horse)|truth or dare|game show|the long game|"
                        r"ping[- ]?pong|cornhole|madden|fifa|xbox|playstation|one-on-one|two-on-two|three-on-three|pickup|"
                        r"driveway|backyard|neighborhood (hoop|court)|scrimmage|bowling|back in the game|game plan|game face|"
                        r"game[- ]changer|name of the game|ahead of the game|game on\b|whole new game|dating game|waiting game|"
                        r"blame game|open gym)\b", re.I)
RECRUIT = re.compile(r"\b(recruit\w*|official visit|unofficial visit|scholarship offer|staff (emphasizes|pitches|calls)|coach k\b|izzo|"
                     r"krzyzewski|calhoun|commit(s|ment|ted)? to|(duke|michigan state|uconn|kentucky|north carolina|kansas|villanova|"
                     r"syracuse|michigan)'?s? (roster|staff|program|offense|sets|campus|coach|pitch|visit))\b", re.I)
TRAVEL = re.compile(r"\b(hotel|travel (team|tournament|ball)|summer (league|tournament|team|ball|baseball|basketball|soccer|showcase)|"
                    r"aau|showcase|legion)\b", re.I)
PRO_GAME = re.compile(r"\b((yankees|red sox|mets|giants|jets|patriots|celtics|knicks|nets|huskies|uconn|duke|michigan state|"
                      r"college) " + _W + r"(game|games|matchup)|super bowl|world series|march madness|(game|games) on (tv|television)|"
                      r"on (tv|television)|the broadcast)\b", re.I)
GAME_SCENE = re.compile(
    r"\b(game ?day|game-day|game night|pregame|pre-game|postgame|post-game|warm-?ups|tip-?off|kick-?off|first pitch|"
    r"away[- ]game|home game|road game|rivalry game|late-season " + _W + r"game|late-game|late in the game|"
    r"(during|at|after|before|following|watch(es|ing|ed)?|attend(s|ing|ed)?|miss(es|ing)?|catch(es)?|cheer(s|ing)? (at|for)|"
    r"in|from|leaving|enter(s|ing)?|plays? in|start(s|ing)? in|appearance in) (a|an|the|his|her|their|its|\w+'s|guilford's|"
    r"tonight's|today's|saturday's|friday's)? ?" + _W + r"(game|matchup|match)\b|"
    r"(wins|loses|win|lose|won|lost|drops|takes) (a|an|the|its|their)? ?" + _W + r"(game|matchup|opener)\b|"
    r"the (bleachers|stands) (at|during)|the bus ride (home|back|to)|"
    r"(during|watch(es|ing)?) (the )?(pregame )?warm-?ups)", re.I)
BEFORE_RX = re.compile(r"\b(night before|evening before|the eve of|day before|tomorrow's|tomorrow night|tomorrow|next game)\b", re.I)
EVE_RX = re.compile(r"\b(night before|evening before|the eve of|the night ahead of)\b", re.I)
FILM_RX = re.compile(r"\b(film (review|session|study)|watch(es|ing)? (the )?film|breaks down (the )?(film|tape)|the morning after)\b", re.I)
PRE_RX = re.compile(r"\b(before (the|his|her|their|a|an)? ?" + _W + r"game|pregame|pre-game|warm-?ups|prepares? for|getting ready for|"
                    r"gets? ready for|on the way to|arriv\w+ early)\b", re.I)
AFTER_RX = re.compile(r"\b(after (the|his|her|their|a|an|its)? ?" + _W + r"(game|loss|win|matchup|victory|defeat)|afterward|"
                      r"postgame|post-game|the bus ride (home|back)|following (the|a|an|his|her|their|its)? ?" + _W +
                      r"(game|loss|win|victory|defeat))\b", re.I)
PAST = re.compile(r"\b(photograph|photo|remember(s|ing)?|memories|banner|rings?|last year'?s|last season'?s|previous|defending|"
                  r"reigning|a year ago|looks? back|recall(s|ing)?|anniversary|trophy case|revisit(s|ing)?|began (during|before|at|with)|"
                  r"since (freshman|tryouts|the)|years? (ago|earlier)|four years|three years|back when)\b", re.I)
TRYOUT_RX = re.compile(r"\btry-?outs?\b|\btrying out\b", re.I)
TRYOUT_BEFORE = re.compile(r"\b((night|day|days|week|weeks) before|ahead of|before) (the )?(official )?(\w+ )?try-?outs?\b|"
                           r"try-?outs? (are )?(tomorrow|next week|coming|in (two|three|a few) days)|prepar\w* for (the )?(\w+ )?try-?outs?|"
                           r"get(ting)? ready for (the )?(\w+ )?try-?outs?", re.I)
TRYOUT_AFTER = re.compile(r"\b(roster (is |gets )?(posted|announced|list)|roster assignments? (are |is )?posted|names? on the (wall|list|roster)|"
                          r"cut list|(makes?|made|didn't make|doesn't make) the (team|varsity|jv|roster)|cuts? (are |were )?(posted|announced)|"
                          r"after try-?outs?|the list (goes|went) up)\b", re.I)
TRYOUT_DAY = re.compile(r"\b(try-?outs? (begin|start|open|day)|(the day of|day of|at|during|on|first day of) (the )?(official |varsity )?(\w+ )?"
                        r"try-?outs?|(compet\w+|fights?|battles?) (at|in|through) (the )?(\w+ )?try-?outs?)\b", re.I)
FIRST_RX = re.compile(r"\b(first (\w+ ){0,2}game|season opener|home opener|opening (day|night|game)|the opener|opens its season|"
                      r"(its|their|his) (\w+ )?debut)\b", re.I)
LAST_HOME = re.compile(r"\b(senior night|senior day|last (regular[- ]season )?home (game|appearance|stand)|final (scheduled )?"
                       r"(regular[- ]season )?home (game|appearance)|one more regular[- ]season home game|regular[- ]season (finale|"
                       r"schedule (ends|finishes)|ends|is ending|ending|winding down|comes to an end)|finishes its regular[- ]season|"
                       r"(last|final) regular[- ]season game)\b", re.I)
LAST_ANY = re.compile(r"\b(last|final) (\w+ ){0,2}(game|appearance)\b|season finale", re.I)
END_RX = re.compile(r"\b(season (is over|ends|ended|ending|comes to an end|is done|is finished)|end of the season|after the season|"
                    r"(team'?s?|season'?s?) (banquet|final (team )?(meeting|gathering|practice))|the banquet|end-of-season|"
                    r"season-ending|postseason (ending|elimination|exit)|elimination|eliminated|(run|season) (reaches|comes to) (its|an) "
                    r"(heartbreaking |painful |sudden )?(end|conclusion)|tournament (defeat|loss|exit)|ends its (title defense|season))\b", re.I)
HOLIDAY_RX = re.compile(r"\bholiday (tournament|tourney|classic)\b", re.I)
SCC_RX = re.compile(r"\b(scc|conference|southern connecticut conference) (tournament|tourney|playoffs?|final|finals|championship|"
                    r"semifinal|semifinals|semis|quarterfinal|quarterfinals|opening round|title)\b", re.I)
STATE_RX = re.compile(r"\b(state (tournament|tourney|playoffs?|final|finals|championship|title|semifinal|semifinals|quarterfinal|"
                      r"quarterfinals|first round|second round)|ciac|elite eight|final four)\b", re.I)
POST_RX = re.compile(r"\b(postseason|post-season|playoffs?|tournament|the bracket|elimination game)\b", re.I)
NOT_SCHOOL_TOURNAMENT = re.compile(r"\b(travel|summer|aau|showcase|club|two-on-two|one-on-one|three-on-three|organizes|backyard|"
                                   r"driveway|neighborhood|pickup|outdoor|mansion|estate|family|olympics|desk|video|study hall|"
                                   r"brotherhood|cornhole|trivia|holiday tournament|hotel|trip|while (\w+ ){0,4}away|staff emphasizes|"
                                   r"recruit\w*|scholarship|official visit|izzo|krzyzewski|calhoun|college|campus)\b", re.I)
SPORTY = re.compile(r"\b(game|games|team|teammates?|coach|season|field|court|gym|dugout|bench|crowd|stands|bleachers|varsity|jv|"
                    r"roster|practice|score|opener|tryouts?|tournament|playoffs?|postseason|lineup|inning|quarter|half|"
                    r"possession|kickoff|tip-?off|at-bat|championship|opponents?|matchup|scc|ciac|state title|defense|"
                    r"offense|loss|win|victory|defeat)\b", re.I)
LATE_REGULAR = re.compile(r"\b(late-season|regular[- ]season (test|matchup|game|stretch)|(approach\w*|nears?|nearing) the end of (its|the|their) "
                          r"(regular[- ]season )?schedule|postseason (positioning|seeding|hopes)|(playoff|tournament) (positioning|seeding)|"
                          r"at stake)\b", re.I)
ROUND_RX = re.compile(r"\b(championship(?! (run|expectations|culture|program|team|banner|ring|celebration)s?)|title game|"
                      r"(the|state|scc|conference) finals?\b(?! (four|score|game|run|season|year|home|time|practice|gathering|meeting|"
                      r"minutes|seconds|whistle|buzzer))|semifinals?|semis|final four|quarterfinals?|elite eight|first round|opening round|"
                      r"second round)", re.I)


def _round_of(text: str) -> str | None:
    m = ROUND_RX.search(text)
    if not m:
        return None
    w = re.sub(r"^(the|state|scc|conference) ", "", m.group(1).lower())
    return ROUNDS.get(w) or ("championship" if w.startswith("final") and w != "final four" else None)


def _first_sentence(t: str) -> str:
    return re.split(r"(?<=[.!?;])\s+", (t or "").strip())[0] if t else ""


def read(title: str, summary: str, opening: str, sport_hint: str | None, months=None) -> dict | None:
    """What event a scene is about, from its words (title, outline summary, first lines). Precise on purpose: a scene
    that only mentions a game in passing, or looks back on one, keeps its month."""
    head = f"{title or ''}. {summary or ''}"
    lead = f"{title or ''}. {_first_sentence(summary)}"  # (what the scene is: the title and the summary's first sentence)
    first = " ".join(re.split(r"(?<=[.!?])\s+", (opening or "").strip())[:2])
    sports = [SPORT_WORDS[s.lower()] for s in SPORT_RX.findall(head)]
    sport = sports[0] if sports else sport_hint or next((SPORT_WORDS[s.lower()] for s in SPORT_RX.findall(first)), None)
    if not sport or PRO_GAME.search(lead) or RECRUIT.search(lead) or TRAVEL.search(lead):
        return None  # (the Yankees on TV, a college's recruiting pitch, a summer travel tournament: not a game here)
    if months and set(months) <= {7, 8}:
        return None  # (July and August: no school games)
    if not SPORT_RX.search(head) and not SPORTY.search(head):
        return None  # (nothing about sports in it: "one last senior night" at a graduation party)
    past = bool(PAST.search(lead))
    summer_only = bool(months) and set(months) <= {6, 7, 8} and sport not in ("baseball", "softball")
    if summer_only and not re.search(r"\b(scc|state|ciac|postseason|playoffs?)\b", head, re.I):
        return None
    after = bool(AFTER_RX.search(lead))
    if LATE_REGULAR.search(lead) and not past and not (SCC_RX.search(lead) or STATE_RX.search(lead)):
        # (the regular season's last stretch, with the tournament at stake: a late game, not the tournament)
        return _moment("game", sport, None)
    # the end of the regular season / the last home game
    if LAST_HOME.search(lead) and not past:
        return _moment("last_game", sport, None)
    # tournaments
    if (SCC_RX.search(lead) or STATE_RX.search(lead) or POST_RX.search(lead)) and not past and not NOT_SCHOOL_TOURNAMENT.search(lead):
        if END_RX.search(lead):
            return _moment("season_end", sport, None)  # (out of the tournament: after the last game)
        if re.search(r"\b(whether|depending on|either)\b", lead, re.I):  # (it could go either way: the regular season's end decides)
            return _moment("season_end" if re.search(r"\b(final|last)\b", lead, re.I) else "regular_end", sport, None)
        stage = "scc" if SCC_RX.search(lead) else "state" if STATE_RX.search(lead) else None
        if re.search(r"\b(bracket goes up|bracket|seeding|seeds?|postseason picture|qualif\w+)\b", lead, re.I) and not stage:
            return _moment("postseason", sport, None, None, "first round" if False else None)
        return _moment("after_postseason" if after and not GAME_SCENE.search(_first_sentence(summary) or "") else "postseason",
                       sport, None, stage, _round_of(lead))
    if HOLIDAY_RX.search(lead):
        return _moment("holiday", sport, None, None, "championship" if re.search(r"championship|title|final\b", lead, re.I) else None)
    if TRYOUT_RX.search(lead) and not past:
        if TRYOUT_AFTER.search(lead):
            return _moment("after_tryouts", sport, None)
        if TRYOUT_BEFORE.search(lead):
            return _moment("before_tryouts", sport, None)
        if TRYOUT_DAY.search(lead) or TRYOUT_RX.search(title or ""):
            return _moment("tryouts", sport, None)
        return None  # (tryouts mentioned, not the day: it keeps its month)
    if TRYOUT_AFTER.search(lead) and not past:
        return _moment("after_tryouts", sport, None)
    if NOT_A_GAME.search(lead) and not GAME_SCENE.search(NOT_A_GAME.sub("", lead)):
        return None
    if past and re.search(r"\b(on opening night|at the (home |season )?opener|before the (home |season )?opener|opening night)\b", lead, re.I):
        return _moment("first_game", sport, None)  # (the banner goes up at the opener: last year's title, this year's first game)
    if past:
        return None
    if END_RX.search(lead):
        return _moment("season_end", sport, None)
    if LAST_ANY.search(lead):
        # (after the final game, or "his final appearance, whether it comes in the regular season or the tournament":
        # the season's last game, whenever that turns out to be)
        whenever = re.search(r"\b(whether|appearance)\b", lead, re.I)
        return _moment("season_end" if after or whenever else "last_game", sport, None)
    if FIRST_RX.search(lead):
        if (BEFORE_RX.search(lead) or re.search(r"\b(before|eve of|ahead of) (the|their|his|its|her) (\w+ ){0,2}(opener|first (\w+ )?game)",
                                                 lead, re.I)) and not after:
            return _moment("night_before_first_game", sport, None)
        return _moment("first_game", sport, None)
    if GAME_SCENE.search(lead) or (GAME_SCENE.search(first) and re.search(r"\bgame\b", first, re.I)) or FILM_RX.search(lead) \
            or after:
        if EVE_RX.search(lead) or (BEFORE_RX.search(lead) and not after and not PRE_RX.search(lead)):
            return _moment("night_before_game", sport, None)
        if after or FILM_RX.search(lead):
            return _moment("after_game", sport, None)
        return _moment("game", sport, None)
    return None


def owner_names(text: str, names: dict) -> tuple:
    """(whose game it is: the name in "Nicole's game", or None; everyone named, in order) — names: first name -> slot."""
    owner = None
    m = re.search(r"\b([A-Z][a-z]+)'s\s+(?:\w+\s+){0,2}(?:game|games|match|tryouts?|season|team|opener|senior night|"
                  r"tournament|championship|final|semifinal|quarterfinal)\b", text or "")
    if m and m.group(1).lower() in names:
        owner = names[m.group(1).lower()]
    seen = []
    for w_ in re.findall(r"\b([A-Z][a-z]+)\b", text or ""):
        k = w_.lower()
        if k in names and names[k] not in seen:
            seen.append(names[k])
    return owner, seen


# ------------------------------------------------------------------------------------------------ the days it fits
def label(m: dict) -> str:
    lo, hi, txt = KINDS.get(m["kind"], (0, 0, m["kind"]))
    if m["kind"] in ("postseason", "after_postseason"):
        st = {"scc": "SCC tournament", "state": "state tournament"}.get(m.get("stage") or "", "tournament")
        txt = (f"the {st} {m['round']}" if m.get("round") else f"a {st} game")
        if m["kind"] == "after_postseason":
            txt = "after " + txt
    sp = m.get("sport")
    who = m.get("owner")
    return (f"{who.title()}'s " if who else "") + (f"{sp} " if sp and not who else "") + txt


def team_for(sim, me, m: dict, day: int) -> str | None:
    """The team this moment is about, at your school, or None (nobody's game here: the scene plays as written)."""
    w = sim.w
    sport = m.get("sport")
    school = me.school if me.school and me.school != "college" else "hchs"
    cands = [g for g in w.groups.values() if g.get("kind") == "team" and (g.get("skill") == sport or not sport)
             and g.get("school", "hchs") == school and (sport or g.get("first_game") or g.get("season"))]
    if not sport:  # ("Nicole's game day", "game day"): the team that's in season for them then
        y = calm.school_year_of(day)
        cands = [g for g in cands if g.get("season") and calm.md_to_day(y, g["season"]["start"]) <= day <= calm.md_to_day(y, g["season"]["end"])]
        if not cands:
            return None
    if not cands:
        return None
    slots = w.meta.get("cast_slots") or {}

    def person(slot):
        e = slots.get(slot)
        cid = e.get("id") if isinstance(e, dict) else e
        if cid in w.chars:
            return w.chars[cid]
        from . import dialogue  # (not cast yet: someone named in the storyline is that person, by name)
        spec = dialogue.slot_spec(slot) or {}
        nm = str(spec.get("name") or "").lower().strip()
        if spec.get("who") == "named" and nm:
            return next((c for c in w.chars.values() if c.name.lower() == nm or c.first.lower() == nm), None)
        return None

    def theirs(c):
        if c is None or c.status != "active" or c.role != "student" or c.school != school:
            return "gone" if c is not None else None
        on = next((g["id"] for g in cands if c.id in g["members"]), None)
        if on:
            return on
        side = [g for g in cands if (g.get("gender") or "m") == c.gender]
        return side[0]["id"] if side else None
    owner = m.get("owner_slot")
    if owner == "me":
        t = theirs(me)
        return t if t != "gone" else None
    if owner:
        t = theirs(person(owner))
        return None if t == "gone" else t
    mine = next((g["id"] for g in cands if me.id in g["members"]), None)
    if mine:
        return mine
    for s in m.get("named") or []:
        c = person(s)
        if c is not None and c.id != me.id and any(c.id in g["members"] for g in cands):
            return theirs(c)
    side = [g for g in cands if (g.get("gender") or "m") == me.gender]
    return (side or cands)[0]["id"]


_DAYS: dict = {}


def event_days(sim, gid: str, m: dict, year: int) -> list:
    """The days a moment fits for one team in one school year."""
    w = sim.w
    key = (gid, m["kind"], m.get("stage"), m.get("round"), year, w.meta.get("cal_rev", 0), len(w.calendar))
    hit = _DAYS.get(key)
    if hit is not None:
        return hit
    if len(_DAYS) > 20000:
        _DAYS.clear()
    its = [i for i in w.calendar if i.get("group") == gid and calm.school_year_of(i["day"]) == year]
    games = sorted(i["day"] for i in its if i["kind"] == "game")
    regular = sorted(i["day"] for i in its if i["kind"] == "game" and not i.get("stage"))
    k = m["kind"]
    base: list = []
    if k in ("game", "night_before_game", "after_game"):
        base = games
    elif k in ("first_game", "night_before_first_game"):
        base = regular[:1]
    elif k in ("last_game", "regular_end"):
        base = regular[-1:]
    elif k in ("tryouts", "before_tryouts", "after_tryouts"):
        base = [i["day"] for i in its if i["kind"] == "tryout"][:1]
    elif k == "season_end":
        base = games[-1:]
    elif k == "holiday":
        base = [i["day"] for i in its if i["kind"] == "game" and i.get("event") == "holiday"]
        base = base[-1:] if m.get("round") == "championship" else base
    elif k in ("postseason", "after_postseason"):
        post = [i for i in its if i["kind"] == "game" and i.get("stage") and (not m.get("stage") or i["stage"] == m["stage"])]
        if m.get("round"):
            post = [i for i in post if m["round"] in (i.get("round_name") or "").lower()]
        base = sorted(i["day"] for i in post)
    lo, hi = KINDS.get(k, (0, 0, ""))[:2]
    out = sorted({d + o for d in base for o in range(lo, hi + 1)})
    _DAYS[key] = out
    return out


def fits(sim, me, m: dict, months, day: int) -> bool | None:
    """True / False: does today fit this scene's moment? None: it has no team here (it plays as written)."""
    gid = team_for(sim, me, m, day)
    if gid is None:
        return None
    ds = event_days(sim, gid, m, calm.school_year_of(day))
    if months:
        inside = [d for d in ds if calm.date_of(d).month in months]
        ds = inside or ds  # (the month narrows it when the event falls in it; otherwise the event wins)
    return day in ds


def next_day(sim, me, m: dict, months, day: int) -> int | None:
    """The next day this moment fits this school year (for "waiting for the game")."""
    gid = team_for(sim, me, m, day)
    if gid is None:
        return None
    ds = event_days(sim, gid, m, calm.school_year_of(day))
    if months:
        inside = [d for d in ds if calm.date_of(d).month in months]
        ds = inside or ds
    return next((d for d in ds if d >= day), None)


def is_mine(sim, me, m: dict, day: int) -> bool:
    gid = team_for(sim, me, m, day)
    return bool(gid) and me.id in (sim.w.groups.get(gid) or {}).get("members", [])
