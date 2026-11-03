"""Pro sports in LIFE OS: the leagues that run in the background of your story, and the hooks storylines use.

MLB is the first (mlb.py: real history since 1990, the what-ifs, live seasons from 2026). Each league plugs in the same way:
a weekly step, a page on the Sports tab, requirements scenes can use, and placeholders scene text can say.

Storyline hooks (all about the protagonist's team: the Yankees unless you pick another):
- requires: pro:baseball_season, pro:october, pro:my_team_winning, pro:my_team_losing, pro:my_team_in_playoffs,
  pro:my_team_alive, pro:my_team_missed, pro:my_team_champs, and pro:whatif:<id> for a world where that what-if is on
  (pro:whatif:harper_2019 = Harper's a Yankee in this world)
- placeholders: {my_team} (Yankees), {my_team_record} (88-74), {my_team_star} (the best player on it right now),
  {mlb_champ} (whoever won the last World Series)
- fans: everyone has a team and how much they care; a title is a memory and a good week, a playoff exit stings
"""
from __future__ import annotations

from . import mlb

REQUIRES = {
    "pro:baseball_season": "The MLB regular season is on.",
    "pro:october": "It's the MLB postseason.",
    "pro:my_team_winning": "Your MLB team is over .500 (during the season).",
    "pro:my_team_losing": "Your MLB team is under .500 (during the season).",
    "pro:my_team_in_playoffs": "Your MLB team made the playoffs this year (from October to next spring).",
    "pro:my_team_alive": "Your MLB team is still alive in October.",
    "pro:my_team_missed": "Your MLB team missed the playoffs this year (from October to next spring).",
    "pro:my_team_champs": "Your MLB team won the last World Series.",
}
WHATIF_PREFIX = "pro:whatif:"
NAMES = {"my_team": "your MLB team (Yankees)", "my_team_record": "its record this season (88-74)",
         "my_team_star": "its best player right now", "mlb_champ": "whoever won the last World Series"}


def known(r: str) -> bool:
    return r in REQUIRES or (r.startswith(WHATIF_PREFIX) and r[len(WHATIF_PREFIX):] in mlb.WHATIF)


def requirement(sim, me, r: str) -> bool:
    if r.startswith(WHATIF_PREFIX):
        return r[len(WHATIF_PREFIX):] in mlb.whatifs(sim)
    cur = mlb.current(sim)
    team = mlb.my_team(sim)
    lg = mlb.data().teams[team]["lg"]
    w, l_ = cur["rec"].get(team, [0, 0])
    ph = cur["phase"]
    after = ph in ("october", "offseason")
    made = team in (cur.get("fields") or {}).get(lg, [])
    if r == "pro:baseball_season":
        return ph == "regular"
    if r == "pro:october":
        return ph == "october"
    if r == "pro:my_team_winning":
        return ph == "regular" and w > l_
    if r == "pro:my_team_losing":
        return ph == "regular" and w < l_
    if r == "pro:my_team_in_playoffs":
        return after and made
    if r == "pro:my_team_missed":
        return after and bool(cur.get("fields")) and not made
    if r == "pro:my_team_alive":
        return ph == "october" and made and team not in cur["eliminated"]
    if r == "pro:my_team_champs":
        return last_champ(sim) == team
    return False


def last_champ(sim) -> str | None:
    """Whoever won the most recent World Series that's been decided by today."""
    cur = mlb.current(sim)
    if cur["champ"]:
        return cur["champ"]
    y = cur["year"] - 1
    if y <= mlb.data().last:
        return mlb.season(sim, y)["champ"]
    a = mlb.state(sim)["arch"].get(str(y))
    return a.get("champ") if a else None


def names(sim, me) -> dict:
    """What a scene's text can say about pro sports."""
    try:
        team = mlb.my_team(sim)
        cur = mlb.current(sim)
        w, l_ = cur["rec"].get(team, [0, 0])
        stars = mlb._stars(sim, team, cur["year"], n=1)
        champ = last_champ(sim)
        return {"my_team": mlb.team_name(team), "my_team_record": f"{w}-{l_}",
                "my_team_star": stars[0]["name"] if stars else f"the {mlb.team_name(team)}' best player",
                "mlb_champ": mlb.team_name(champ) if champ else "the champs"}
    except Exception:  # never let the background league break a scene
        return {"my_team": "Yankees", "my_team_record": "", "my_team_star": "Aaron Judge", "mlb_champ": "the champs"}


def weekly(sim):
    mlb.weekly(sim)
