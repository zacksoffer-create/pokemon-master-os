"""Sports storylines run the season with you: a scene tagged `game: loss, I play great` is that game (it waits for a game
day, plays before it, and the game goes that way: the result, and how you play, while the big moment you play yourself
still moves your line); the scene after a game waits for it; and `record: 7-3` leans the rest of the season toward that
record and lands on it."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import dialogue, gameplay, scheduler, script  # noqa: E402
from tests.test_games_line_up import game_today, own_packs, play, world  # noqa: E402,F401


def add(sim, text):
    r = dialogue.add_script(text)
    assert r["ok"], r.get("errors")
    sim.cat = sim.cat.__class__(sim.w.action_overrides)
    scheduler._cat_cache.clear()
    cat = scheduler.catalog(sim)
    return r["ids"][0], cat


GAME_NIGHT = """=== Friday Nights
years: freshman
{head}
outline:
1. Game Night | September | The opener under the lights. | game: {tag}
2. The Bus Home | September | Everybody talks about it. | if we lost

--- 1. Game Night
It's game day, and the stands are filling up.
Coach: Big one tonight.
* "I'm ready." | play football
    good: Coach: That's it.

--- 2. The Bus Home
Coach: {{last_game}}. You had {{my_line}}.
* "We'll get them next time."
Coach: We will.
"""


def test_the_tag_reads_how_the_game_goes():
    assert script.game_spec("game: loss, I play great") == {"sport": None, "result": "loss", "me": "great"}
    assert script.game_spec("game: football, we win and I play quietly") == {"sport": "football", "result": "win", "me": "quiet"}
    assert script.game_spec("game") == {"sport": None, "result": None, "me": None}
    assert script.season_record("7-3") == {"sport": None, "w": 7, "l": 3}
    for bad in ("game: tie", "game: we crush them"):
        try:
            script.game_spec(bad)
            raise AssertionError(bad)
        except script.Fail as e:
            assert "I play great" in str(e)


def test_a_game_scene_waits_for_game_day_and_the_game_goes_its_way():
    sim, me, gid = world()
    w = sim.w
    pk, cat = add(sim, GAME_NIGHT.format(head="", tag="loss, I play great"))
    first, after = cat["chapters"][pk]
    gd = cat["info"][first]["game_day"]
    assert gd["sport"] == "football" and gd["result"] == "loss" and gd["me"] == "great", gd
    # a game in three days: it waits for it
    w.calendar.append({"day": w.day + 3, "kind": "game", "group": gid, "key": f"game:{gid}:{w.day + 3}:1", "slot": "evening"})
    assert scheduler.gate(sim, me, first, cat)[0] == "waiting_for_game"
    w.day += 3
    it = next(i for i in w.calendar if i["day"] == w.day and i["kind"] == "game")
    assert scheduler.gate(sim, me, first, cat) is None
    scheduler.done_map(w)[first] = [w.day]  # played it this afternoon
    assert scheduler.gate(sim, me, after, cat)[0] == "after_game"  # the bus home waits for the game
    call = gameplay.storyline_calls(sim, me, "football")
    assert call["result"] == "loss" and call["me"] == "great", call
    for seed in range(1, 6):  # whatever the dice say, it's a loss and you played great
        g = w.groups[gid]
        g.get("played", []).clear()
        play(sim, it, seed=seed)
        last = me.flags["last_game"]
        assert last["win"] is False and last["tier"] == "great", (seed, last)
    assert scheduler.gate(sim, me, after, cat) is None  # the game's been played: the bus home is next


def test_how_you_play_is_set_but_your_big_moment_still_counts():
    sim, me, gid = world()
    w = sim.w
    pk, cat = add(sim, GAME_NIGHT.format(head="", tag="win, I play quietly"))
    first = cat["chapters"][pk][0]
    it = game_today(sim, gid)
    scheduler.done_map(w)[first] = [w.day]
    play(sim, it, seed=3)
    last = me.flags["last_game"]
    assert last["win"] is True and last["tier"] in ("quiet", "rough", "bench", "solid"), last


def test_the_season_record_leans_the_games_and_lands_on_it():
    sim, me, gid = world()
    w = sim.w
    pk, cat = add(sim, GAME_NIGHT.format(head="record: 2-3\n", tag="loss"))
    assert gameplay.season_targets(sim)[0]["w"] == 2 and gameplay.season_targets(sim)[0]["sport"] == "football"
    g = w.groups[gid]
    g["record"] = {"w": 0, "l": 0}
    w.calendar = [i for i in w.calendar if not (i.get("kind") == "game" and i.get("group") == gid)]
    games = [{"day": w.day + 7 * k, "kind": "game", "group": gid, "key": f"game:{gid}:{w.day + 7 * k}:{k + 1}", "slot": "evening"}
             for k in range(5)]
    w.calendar += games
    for k, it in enumerate(games):
        w.day = it["day"]
        play(sim, it, seed=11 + k)
    assert g["record"] == {"w": 2, "l": 3}, g["record"]
