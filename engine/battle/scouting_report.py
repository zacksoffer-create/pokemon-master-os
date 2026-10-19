"""Scouting packets for every chapter (D-043).

    python3 -I battle/scouting_report.py [game ...]   -> docs/scouting/<game>.md
    python3 -I battle/scouting_report.py --json PATH   -> one JSON file with every packet and the what-if league

Each packet: a depth chart, a 1v1 record against that game's Elite Four and champions, one player card per
companion (tools, arsenal, type chart, tough matchups, role, risk, the scout's take) and a call sheet per
opponent (rematches left out). The what-if league puts every journey team against every other at Lv 100."""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

import rules  # noqa: E402
from battle.benchmarks import Benchmarks  # noqa: E402
from battle.engine import BattleEngine  # noqa: E402
from battle.scouting import GAME_TITLE, SIGNATURE_ITEMS, Scouting  # noqa: E402
from team import Member, Team  # noqa: E402

DOCS = os.path.join(os.path.dirname(ENGINE), "docs", "scouting")
SCALE_NOTE = ("Grades are on the 20-80 scouting scale (50 = average, 60 plus, 70 plus-plus, 80 elite), measured "
              "against every fully evolved Pokémon of the same generation, so packets from different games compare "
              "like era-adjusted stats. Present = the build on record; peak = the best of that and its strongest "
              "learnable set (D-024). Not a simulation: the 1v1 record is the benchmark grid at the opponent's top level.")


def load_canon():
    canon = os.path.join(ENGINE, "canon")
    with open(os.path.join(canon, "rosters.json"), encoding="utf-8") as fh:
        rosters = json.load(fh)
    with open(os.path.join(canon, "builds.json"), encoding="utf-8") as fh:
        builds = json.load(fh)
    return rosters, builds


def members_of(cards, game, builds):
    return [Member(c["species"], moves=c["moves"], **{k: builds.get(game, {}).get(c["species"], {}).get(k)
                                                     for k in ("nature", "ability", "item")}) for c in cards]


def chapter_data(scout, chapter, builds):
    """Everything one packet shows, as data."""
    game = chapter["game"]
    cards = [scout.report(sp, game, builds.get(game, {}).get(sp)) for sp in chapter["roster"]]
    team = Team(game, members_of(cards, game, builds))
    opponents = [o for o in scout.bench.load(game) if "rematch" not in o["name"].lower()]
    sheets = [scout.call_sheet(team, o) for o in opponents]
    record = {c["species"]: [0, 0] for c in cards}
    for sh in sheets:
        for s, wins in sh["anchors"]:
            record[s][0] += wins
            record[s][1] += len(sh["calls"]) - wins
    notes = []
    for mem in team.members:   # a signature item not on record (Pikachu's Light Ball): the record with it
        item = SIGNATURE_ITEMS.get(mem.species)
        if item and not mem.item:
            alt = Team(game, [Member(m.species, moves=m.moves, nature=m.nature, ability=m.ability,
                                     item=item if m is mem else m.item) for m in team.members])
            wins = sum(dict(scout.call_sheet(alt, o)["anchors"])[mem.species] for o in opponents)
            w, l = record[mem.species]
            notes.append(f"{mem.species} has no {item} on record: {w}-{l} without it, {wins}-{w + l - wins} with it")
    for c in cards:
        c["record"] = record[c["species"]]
    defense = scout.battle.defense(team)
    cover = scout.battle.coverage(team)
    avg = lambda key: round(sum(c["ofp"][key] for c in cards) / len(cards))
    return {"game": game, "title": GAME_TITLE[game], "thesis": chapter["thesis"], "status": chapter["status"],
            "decision": chapter["decision"], "ofp": {"present": avg("present"), "peak": avg("peak")},
            "cards": cards, "sheets": sheets, "scouts_notes": notes,
            "defensive_flags": [f for f in defense["flags"] if not f.startswith("assumed")],
            "no_super_effective_hit": cover["neutral_only"] + cover["resisted_only"] + cover["no_answer"],
            "speed_order": [(r["species"], r["base"]) for r in scout.battle.speed(team)],
            "members": team.members}


def render_packet(d):
    lines = [f"# Scouting packet: {d['title']} ({d['thesis']})", "",
             f"*Roster status: {d['status']} ({d['decision']}). {SCALE_NOTE}*", "",
             f"## Depth chart (team OFP {d['ofp']['present']} present / {d['ofp']['peak']} peak)", "",
             "| | OFP | Role | Power | Speed | Bulk (P/S) | Coverage | Utility | Risk | 1v1 vs the league | Build |",
             "|---|---|---|---|---|---|---|---|---|---|---|"]
    for c in sorted(d["cards"], key=lambda c: -c["ofp"]["present"]):
        g, p = c["grades"]["present"], c["grades"]["peak"]
        both = lambda k: f"{g[k]}" if g[k] == p[k] else f"{g[k]}/{p[k]}"
        w, l = c["record"]
        lines.append(f"| **{c['species']}** | {c['ofp']['present']}/{c['ofp']['peak']} | {c['role']} | {g['power']} | "
                     f"{g['speed']} | {g['phys_bulk']}/{g['spec_bulk']} | {both('coverage')} | {both('utility')} | "
                     f"{c['risk']['level']} | {w}-{l} | {c['build_source']} |")
    lines += ["", "## Team tendencies", "",
              f"- **Defensive flags:** {'; '.join(d['defensive_flags']) or 'none'}",
              f"- **Hits nothing super-effectively:** {', '.join(d['no_super_effective_hit']) or 'none'}",
              f"- **Speed order:** {', '.join(f'{s} {b}' for s, b in d['speed_order'])}",
              *[f"- **Scout's note:** {n}" for n in d["scouts_notes"]],
              "", "## Player cards", ""]
    for c in d["cards"]:
        lines += [Scouting.render_report(c), ""]
    lines += ["## Call sheets", ""]
    for sh in d["sheets"]:
        lines += [Scouting.render_call_sheet(sh), ""]
    return "\n".join(lines)


def scout_engine():
    db = os.path.join(ENGINE, "data", "pokeref.sqlite")
    battle = BattleEngine(db)
    return Scouting(battle, Benchmarks(db, battle))


def main(games=None):
    scout = scout_engine()
    rosters, builds = load_canon()
    os.makedirs(DOCS, exist_ok=True)
    for ch in rosters["chapters"]:
        if games and ch["game"] not in games:
            continue
        path = os.path.join(DOCS, f"{ch['game']}.md")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(render_packet(chapter_data(scout, ch, builds)) + "\n")
        print("wrote", path)


def export_data():
    """Every packet plus the what-if league, for the scouting page."""
    scout = scout_engine()
    rosters, builds = load_canon()
    chapters = [chapter_data(scout, ch, builds) for ch in rosters["chapters"]]
    league = scout.what_if_league({d["game"]: d["members"] for d in chapters})
    for d in chapters:
        d.pop("members")
    return {"generated": time.strftime("%Y-%m-%d"), "scale": SCALE_NOTE, "chapters": chapters, "league": league,
            "titles": GAME_TITLE}


def write_page(path):
    """The Journey Scouting File: battle/scouting_page.html with every packet embedded."""
    data = json.dumps(export_data(), ensure_ascii=False).replace("</", "<\\/")
    with open(os.path.join(HERE, "scouting_page.html"), encoding="utf-8") as fh:
        page = fh.read().replace("/*DATA*/", data)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(page)
    print("wrote", path)


if __name__ == "__main__":
    if sys.argv[1:2] == ["--page"]:
        write_page(sys.argv[2] if len(sys.argv) > 2 else os.path.join(DOCS, "scouting_file.html"))
    else:
        main(sys.argv[1:] or None)
