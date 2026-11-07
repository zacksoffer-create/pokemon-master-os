"""Scenes play at the moment they're about: Guilford's season is a CIAC one (tryouts, game days, the holiday tournament,
the Thanksgiving game, the SCC and state tournaments, the season ending after the last game), a scene about Nicole's
soccer game plays on Nicole's game day, the night before tryouts is the night before, a storyline that has the state
final in it wins the semifinal, and one storyline doesn't play five chapters in an afternoon."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import calendar as calm  # noqa: E402
from lifeos import cues, dialogue, gameplay, postseason, scheduler  # noqa: E402
from tests.test_storylines_run import add, world  # noqa: E402


@pytest.fixture(autouse=True)
def own_packs(tmp_path, monkeypatch):
    monkeypatch.setattr(dialogue, "USER_DIR", str(tmp_path / "dialogue"))
    dialogue.reload()
    yield
    dialogue.reload()


def _items(w, gid, kind=None):
    return sorted((i for i in w.calendar if i.get("group") == gid and (kind is None or i["kind"] == kind)), key=lambda i: i["day"])


def test_a_ciac_season():
    sim, me = world()
    w = sim.w
    games = [i for i in _items(w, "football", "game") if not i.get("stage")]
    assert all(calm.weekday(i["day"]) == 4 for i in games if i.get("event") != "thanksgiving")  # Friday nights
    assert calm.date_of(games[0]["day"]).month == 9 and any(i.get("event") == "thanksgiving" for i in games)
    base = [i for i in _items(w, "baseball", "game") if not i.get("stage")]
    assert calm.date_of(base[0]["day"]).month == 4 and len(base) >= 18  # games from April, about 20 of them
    post = [i for i in _items(w, "baseball", "game") if i.get("stage")]
    assert [i["stage"] for i in post].count("scc") == 3 and [i["stage"] for i in post].count("state") == 5
    assert calm.date_of(post[-1]["day"]).month == 6  # the state final is in June
    hoops = _items(w, "basketball", "game")
    assert sum(1 for i in hoops if i.get("event") == "holiday") == 2
    tryout = _items(w, "baseball", "tryout")[0]
    assert calm.date_of(tryout["day"]).month == 3 and tryout["day"] < base[0]["day"]


def test_tournaments_who_gets_in_who_goes_home_and_the_season_ends_after_the_last_game():
    sim, me = world()
    w = sim.w
    g = w.groups["basketball"]
    reg = [i for i in _items(w, "basketball", "game") if not i.get("stage")]
    end = _items(w, "basketball", "season_end")[0]
    # a 6-12 team: out of the SCC tournament (it needs .500) but in the state tournament (.400)? no: 6-12 is .333
    w.day = reg[-1]["day"] + 1
    g["record"] = {"w": 6, "l": 12}
    postseason.daily(sim)
    assert not [i for i in _items(w, "basketball") if i.get("stage")]
    assert end["day"] == w.day + 1  # its season ends tomorrow, not in March
    # another year's team: 12-6, in both; it loses the SCC semifinal and keeps playing in the state tournament
    sim2, me2 = world()
    w2 = sim2.w
    g2 = w2.groups["basketball"]
    reg2 = [i for i in _items(w2, "basketball", "game") if not i.get("stage")]
    w2.day = reg2[-1]["day"] + 1
    g2["record"] = {"w": 12, "l": 6}
    postseason.daily(sim2)
    scc = [i for i in _items(w2, "basketball") if i.get("stage") == "scc"]
    assert len(scc) == 3 and all(i.get("opp") for i in scc)
    postseason.after_game(sim2, g2, scc[0], True)
    postseason.after_game(sim2, g2, scc[1], False)
    assert not [i for i in _items(w2, "basketball") if i.get("stage") == "scc" and i["day"] > scc[1]["day"]]
    assert len([i for i in _items(w2, "basketball") if i.get("stage") == "state"]) == 5
    assert "out of the SCC tournament" in postseason.status(w2, g2)


def test_moment_tags():
    assert cues.parse_tag("game day")["kind"] == "game"
    t = cues.parse_tag("Nicole's game day")
    assert t["kind"] == "game" and t["owner"] == "nicole"
    assert cues.parse_tag("night before tryouts")["kind"] == "before_tryouts"
    assert cues.parse_tag("basketball tryouts") == {"kind": "tryouts", "sport": "basketball", "src": "tag"}
    t = cues.parse_tag("state semifinal")
    assert (t["kind"], t["stage"], t["round"]) == ("postseason", "state", "semifinal")
    assert cues.parse_tag("SCC final")["round"] == "championship"
    assert cues.parse_tag("after the season")["kind"] == "season_end"
    assert cues.parse_tag("April") is None and cues.parse_tag("big") is None


@pytest.mark.parametrize("title,summary,sport,kind", [
    ("Number Eight on the Wing", "Zack watches Nicole repeatedly connect with Nikki during a soccer game.", None, "game"),
    ("Three Days to Prove It", "Varsity tryouts begin, and Zack competes against older guards.", "basketball", "tryouts"),
    ("Thursday Means Something Different", "Before the season opener, the freshmen complete their final walkthrough.", "football",
     "night_before_first_game"),
    ("Names on the Wall", "The first roster assignments are posted.", "baseball", "after_tryouts"),
    ("Senior Night", "Guilford celebrates the graduating players before a packed home game.", "basketball", "last_game"),
    ("Conference Champions", "In the SCC championship, Guilford faces an opponent prepared for Mike.", "basketball", "postseason"),
    ("The Silence After the Horn", "Guilford's tournament defeat ends its title defense.", "basketball", "season_end"),
    ("Everybody Still Shows Up", "Following a Guilford basketball loss, the same social circle approaches Mike and Zack.", None, "after_game"),
    ("Built for March", "Michigan State's staff emphasizes Tom Izzo and deep tournament runs.", "basketball", None),
    ("The Team in the Photograph", "Zack stops in front of the photograph of the 2011 state championship team.", "basketball", None),
    ("Brothers Versus Everybody", "Mike organizes an outdoor two-on-two basketball tournament with Will.", "basketball", None),
    ("The Best Seats in the House", "You and Mike head to a Yankees game together.", "baseball", None),
    ("Cam's Already Hitting", "Zack arrives at the batting cages and finds Cam taking swings.", "baseball", None),
])
def test_reading_what_a_scene_is_about(title, summary, sport, kind):
    m = cues.read(title, summary, "", sport)
    assert (m or {}).get("kind") == kind, m


def test_a_scene_about_nicoles_game_plays_on_nicoles_game_day():
    sim, me = world()
    w = sim.w
    girls = w.groups["soccer_girls"]
    nicole = next(c for c in w.students() if c.gender == "f" and c.id != me.id and c.school == me.school)
    girls["members"] = sorted(set(girls["members"]) | {nicole.id})
    pk, cat = add(sim, f"=== Her Season\ncast: nicole = {nicole.first} {nicole.last}\nyears: freshman\n" + """
--- The Wing [freshman · October · Nicole's game day]
{nicole}: You came!
* "Wouldn't miss it."
{nicole}: Liar.
* "Mom made me."
{nicole}: Figures.
""")
    sid = cat["chapters"][pk][0]
    mo = cat["info"][sid]["moment"]
    assert mo["kind"] == "game" and mo["owner_slot"] == "nicole"  # (no sport in the tag: whatever team she's on then)
    days = [i["day"] for i in _items(w, "soccer_girls", "game") if not i.get("stage") and calm.date_of(i["day"]).month == 10]
    boys = {i["day"] for i in _items(w, "soccer", "game")}
    assert scheduler.calendar_ok(sim, sid, cat["scenes"][sid]["when"], cat["info"][sid], days[0]) is None
    off = next(d for d in range(days[0] + 1, days[0] + 7) if d not in days)
    assert scheduler.calendar_ok(sim, sid, cat["scenes"][sid]["when"], cat["info"][sid], off) is not None
    assert not set(days) & boys  # (her games, not the boys')


def test_the_night_before_tryouts_is_the_night_before():
    sim, me = world()
    w = sim.w
    pk, cat = add(sim, "=== Spring\ncast: mike = older brother\nyears: freshman\n" + """
--- Can't Sleep [freshman · night before baseball tryouts]
Mike: Big day tomorrow.
* "I'm ready."
Mike: Sure you are.
* "I'm terrified."
Mike: Good. That means you care.
""")
    sid = cat["chapters"][pk][0]
    t = _items(w, "baseball", "tryout")[0]["day"]
    ok = [d for d in range(t - 10, t + 3) if scheduler.calendar_ok(sim, sid, cat["scenes"][sid]["when"], cat["info"][sid], d) is None]
    assert ok and max(ok) == t - 1 and min(ok) >= t - 5


def test_a_storyline_with_the_state_final_in_it_wins_the_semifinal():
    sim, me = world()
    w = sim.w
    g = w.groups["basketball"]
    g["members"] = sorted(set(g["members"]) | {me.id})
    me.memberships = sorted(set(me.memberships) | {"basketball"})
    pk, cat = add(sim, "=== The Run\ncast: mike = older brother\nyears: freshman\n" + """
--- Final Four [freshman · state semifinal]
Mike: One more.
* "One more."
Mike: Let's go.
* "I'm nervous."
Mike: Me too.

--- The Title [freshman · state final]
Mike: This is it.
* "Let's win it."
Mike: Together.
* "Breathe."
Mike: Yeah.
""")
    semi = next(i for i in _items(w, "basketball") if i.get("stage") == "state" and i.get("round_name") == "State semifinal")
    w.day = semi["day"]
    sim._refresh_day()
    call = gameplay.storyline_calls(sim, me, "basketball")
    assert call and call["result"] == "win" and call["scene"] == cat["chapters"][pk][1]


def test_one_storyline_doesnt_play_five_chapters_in_an_afternoon():
    sim, me = world()
    w = sim.w
    lines = "".join(f"\n--- Part {k} [freshman · October]\nMike: Part {k}.\n* \"Okay.\"\nMike: Good.\n* \"Sure.\"\nMike: Fine.\n" for k in range(1, 9))
    pk, cat = add(sim, "=== October\ncast: mike = older brother\nyears: freshman\n" + lines)
    w.day = calm.md_to_day(0, (9, 30))
    run = scheduler.dry_run(sim, 32, None, full=False)
    days = [d for d, sids in run["per_day"].items() for s in sids if s in cat["chapters"][pk]]
    assert len(days) == 8  # all of them play in October
    assert max(days.count(d) for d in set(days)) <= 2  # spread over the month, not piled on its first day
