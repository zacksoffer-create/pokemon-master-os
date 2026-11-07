"""Mini game results land right: Swing Lab counts a home run (it's a hit, four bases), grades a game like baseball, and
your at-bats are your box score. And a save stays light between season breaks (old step-by-step detail is trimmed)."""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lifeos import gameplay, seasons  # noqa: E402
from lifeos.engine import Simulation  # noqa: E402
from lifeos.story import begin, create_story  # noqa: E402
from tests.test_story import spec  # noqa: E402

SWING = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "minigames", "swing.html")


def test_swing_lab_counts_a_home_run_as_a_hit_and_reports_each_at_bat():
    src = open(SWING).read()
    assert re.search(r"label: 'HOME RUN', tone: 'great', base: 4", src)
    for k in ("pa:", "ab:", "h:", "hr:", "bb:", "results:"):
        assert k in src.split("function finishEmbed")[1].split("function start")[0], k


def test_your_at_bats_are_your_box_score():
    line = {"ab": 4, "h": 0, "hr": 0, "rbi": 0}
    st = {"pa": 5, "ab": 5, "h": 1, "hr": 1, "doubles": 0, "triples": 0, "bb": 0, "k": 1}
    text = gameplay.apply_play("baseball", "SS", line, {"tier": "great", "stats": st}, "Zack", None)
    assert line["ab"] == 5 and line["h"] == 1 and line["hr"] == 1 and line["rbi"] >= 1
    assert text == "Zack went 1-for-5 with a home run"
    line = {"ab": 4, "h": 2, "hr": 0, "rbi": 1}
    text = gameplay.apply_play("baseball", "CF", line, {"tier": "good", "stats": {"pa": 4, "ab": 3, "h": 2, "hr": 0, "doubles": 1, "bb": 1}},
                               "Zack", None)
    assert (line["ab"], line["h"], line["bb"]) == (3, 2, 1) and text == "Zack went 2-for-3 with a double"
    # (no at-bats reported: the old one-big-at-bat way still works)
    line = {"ab": 3, "h": 1, "hr": 0, "rbi": 0}
    assert "homered" in gameplay.apply_play("baseball", "SS", line, {"tier": "great", "stats": {}}, "Zack", None)


def test_old_step_by_step_detail_is_trimmed_but_what_happened_stays():
    sim = Simulation(create_story(spec(per=6)))
    begin(sim)
    w = sim.w
    for _ in range(4 * 6 * 7):  # (about four weeks)
        sim.step()
    h = w.history
    seasons.rolling_trim(sim)
    big = w.rules["history.event_keep_importance"]
    for t in h.traces.values():  # routine notes: only the last few days; important outcomes keep their "why"
        ev = h.events.get(t.get("event"))
        assert t["day"] >= w.day - seasons.KEEP_TRACE_DAYS or (ev and ev["importance"] >= big)
    old = [e for e in h.events.values() if e["day"] < w.day - seasons.KEEP_DETAIL_DAYS and e["importance"] < big]
    new = [e for e in h.events.values() if e["day"] >= w.day - 3]
    assert old and not any("changes" in e or "calc" in e for e in old)  # the events themselves stay
    assert any("changes" in e for e in new)  # the recent ones keep their detail
