"""Scouting packets for every chapter (D-043, D-046).

    python3 -I battle/scouting_report.py [game ...]   -> docs/scouting/<game>.md
    python3 -I battle/scouting_report.py --page [PATH] -> the Journey Scouting File page (default docs/scouting/scouting_file.html)

Each packet: the team's tendencies, a depth chart, a report on every companion (philosophy, tendencies, when it's
ahead or behind, against types and moves, how you beat it, production, makeup) and a call sheet per opponent with
the trainer's philosophy from the game's own AI flags, bag and battle lines. Every line is a phrase from
battle/phrasebook.json, triggered by the numbers. The what-if league puts every journey team against every other."""
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
from battle.phrases import Phrasebook  # noqa: E402
from battle.scouting import GAME_TITLE, SIGNATURE_ITEMS, Scouting, join  # noqa: E402
from team import Member, Team  # noqa: E402

DOCS = os.path.join(os.path.dirname(ENGINE), "docs", "scouting")
METHOD = ("No grades: every line below is a phrase from the phrase book (engine/battle/phrasebook.json), triggered by "
          "numbers the engine measures, the way the games turn a Pokémon's best IV into its characteristic. Speed, power "
          "and bulk are measured against every fully evolved Pokémon of the same generation. Opponents' philosophy comes "
          "from the game's own trainer AI flags, bag and battle lines. Records are the benchmark 1v1 grid at the "
          "opponent's top level, with exact damage from Smogon's calculator. Not a simulation.")


def load_canon():
    canon = os.path.join(ENGINE, "canon")
    with open(os.path.join(canon, "rosters.json"), encoding="utf-8") as fh:
        rosters = json.load(fh)
    with open(os.path.join(canon, "builds.json"), encoding="utf-8") as fh:
        builds = json.load(fh)
    return rosters, builds


def load_lineups():
    """Every lineup to scout: each canon chapter as it stands, then the variations in canon/lineups.json."""
    rosters, builds = load_canon()
    with open(os.path.join(ENGINE, "canon", "lineups.json"), encoding="utf-8") as fh:
        book = json.load(fh)
    chars = book.get("characters", {})
    resolve = lambda b: dict(chars[b]) if isinstance(b, str) else dict(b)
    out = {}
    for ch in rosters["chapters"]:
        g = ch["game"]
        out[g] = {"id": g, "chapter": g, "game": g, "title": GAME_TITLE[g], "thesis": ch["thesis"],
                  "status": ch["status"], "decision": ch["decision"], "variation": None,
                  "members": [(sp, builds.get(g, {}).get(sp, {})) for sp in ch["roster"]]}
    for v in book.get("variations", []):
        base = out[v["base"]]
        members = list(base["members"])
        for sp, b in v.get("change", {}).items():
            members = [(s, resolve(b) if s == sp else bd) for s, bd in members]
        for old, b in v.get("swap", {}).items():
            new = resolve(b)
            members = [(new["species"], new) if s == old else (s, bd) for s, bd in members]
        if v.get("members"):
            members = [(resolve(b)["species"], resolve(b)) for b in v["members"]]
        out[v["id"]] = {**base, "id": v["id"], "title": f"{base['title']} · {v['title']}", "status": "variation",
                        "decision": None, "variation": {"title": v["title"], "why": v.get("why")}, "members": members}
    return list(out.values())


def chapter_data(scout, lineup):
    """Everything one packet shows, as data: the self-scout, the reports, and a call sheet per opponent."""
    game = lineup["game"]
    built = [scout.member_for(sp, game, b) for sp, b in lineup["members"]]
    team = Team(game, [m for m, _ in built])
    opponents = [o for o in scout.bench.load(game) if "rematch" not in o["name"].lower()]
    sheets = [scout.call_sheet(team, o) for o in opponents]
    record = {rules.species(team.gen, m.species)["name"]: [0, 0] for m in team.members}
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
            wins = sum(dict(scout.bench.matchups(alt, o)["anchors"])[mem.species] for o in opponents)
            w, l = record[mem.species]
            notes.append(f"{mem.species} has no {item} on record: {w}-{l} against the league without it, "
                         f"{wins}-{w + l - wins} with it.")
    cards = [scout.report(sp, game, b, tuple(record[rules.species(team.gen, sp)["name"]])) for sp, b in lineup["members"]]
    return {"id": lineup["id"], "chapter": lineup["chapter"], "game": game, "title": lineup["title"],
            "thesis": lineup["thesis"], "status": lineup["status"], "decision": lineup["decision"],
            "variation": lineup["variation"], "cards": cards, "sheets": sheets,
            "self_scout": scout.self_scout(team, cards, notes),
            "members": team.members}


def render_packet(d):
    lines = [f"# Scouting packet: {d['title']} ({d['thesis']})", "",
             f"*Roster status: {d['status']} ({d['decision']}). {METHOD}*", "", "## Self-scout", ""]
    lines += Scouting.render_phrases(d["self_scout"]["phrases"])
    lines += ["", "| Attack type | Who throws it |", "|---|---|"]
    lines += [f"| {r['type']} | {', '.join(x['member'] + ' (' + x['move'] + ')' for x in r['throwers'])} |"
              for r in d["self_scout"]["repertoire"]]
    lines += ["", "## Depth chart", "", "| Player | Philosophy | 1v1 vs the league | Build |", "|---|---|---|---|"]
    for c in sorted(d["cards"], key=lambda c: -c["record"][0]):
        phil = " ".join(p["text"] for p in c["phrases"] if p["section"] == "philosophy")
        lines.append(f"| **{c['species']}** | {phil} | {c['record'][0]}-{c['record'][1]} | {c['build_source']} |")
    lines += ["", "## Scouting reports", ""]
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
    """Markdown packets for the canon chapters (variations live on the page)."""
    scout = scout_engine()
    os.makedirs(DOCS, exist_ok=True)
    for lu in load_lineups():
        if lu["variation"] or (games and lu["game"] not in games):
            continue
        path = os.path.join(DOCS, f"{lu['game']}.md")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(render_packet(chapter_data(scout, lu)) + "\n")
        print("wrote", path)


def export_data():
    """Every lineup (canon and variations) plus the what-if league, for the scouting page."""
    scout = scout_engine()
    lineups = [chapter_data(scout, lu) for lu in load_lineups()]
    league = scout.what_if_league({d["id"]: d["members"] for d in lineups})
    for d in lineups:
        d.pop("members")
    titles = dict(GAME_TITLE, **{d["id"]: d["title"] for d in lineups})
    return {"generated": time.strftime("%Y-%m-%d"), "method": METHOD, "lineups": lineups, "league": league,
            "titles": titles, "chapters": [g for g in GAME_TITLE if any(d["chapter"] == g for d in lineups)],
            "sections": Scouting.SECTION_TITLES,
            "rules": sum(len(v) for k, v in Phrasebook().book.items() if not k.startswith("_"))}


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
