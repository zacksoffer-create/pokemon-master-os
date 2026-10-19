"""Scouting packets for every chapter (D-043): python3 -I battle/scouting_report.py [game ...]
-> docs/scouting/<game>.md. Each packet is a depth chart, a 1v1 record against that game's Elite Four and
champions, one player card per companion, and a call sheet per opponent (rematches left out)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

import rules  # noqa: E402
from battle.benchmarks import Benchmarks  # noqa: E402
from battle.engine import BattleEngine  # noqa: E402
from battle.scouting import GAME_TITLE, SIGNATURE_ITEMS, Scouting  # noqa: E402
from team import Member, Team  # noqa: E402

DOCS = os.path.join(os.path.dirname(ENGINE), "docs", "scouting")


def load_canon():
    canon = os.path.join(ENGINE, "canon")
    with open(os.path.join(canon, "rosters.json"), encoding="utf-8") as fh:
        rosters = json.load(fh)
    with open(os.path.join(canon, "builds.json"), encoding="utf-8") as fh:
        builds = json.load(fh)
    return rosters, builds


def packet(scout, chapter, builds):
    game = chapter["game"]
    cards = [scout.report(sp, game, builds.get(game, {}).get(sp)) for sp in chapter["roster"]]
    team = Team(game, [Member(c["species"], moves=c["moves"], **{k: builds.get(game, {}).get(c["species"], {}).get(k)
                                                                 for k in ("nature", "ability", "item")})
                       for c in cards])
    opponents = [o for o in scout.bench.load(game) if "rematch" not in o["name"].lower()]
    sheets = [scout.call_sheet(team, o) for o in opponents]
    record = {c["species"]: [0, 0] for c in cards}
    for sh in sheets:
        for s, wins in sh["anchors"]:
            record[s][0] += wins
            record[s][1] += len(sh["calls"]) - wins
    # signature items not on record (Pikachu's Light Ball): the same 1v1 record with the item, as a scout's note
    item_notes = []
    for mem in team.members:
        item = SIGNATURE_ITEMS.get(mem.species)
        if item and not mem.item:
            alt = Team(game, [Member(m.species, moves=m.moves, nature=m.nature, ability=m.ability,
                                     item=item if m is mem else m.item) for m in team.members])
            wins = sum(dict(scout.call_sheet(alt, o)["anchors"])[mem.species] for o in opponents)
            w, l = record[mem.species]
            item_notes.append(f"{mem.species} has no {item} on record: {w}-{l} without it, "
                              f"{wins}-{w + l - wins} with it")
    defense = scout.battle.defense(team)
    cover = scout.battle.coverage(team)
    avg = lambda key: round(sum(c["ofp"][key] for c in cards) / len(cards))
    lines = [f"# Scouting packet: {GAME_TITLE[game]} ({chapter['thesis']})", "",
             f"*Roster status: {chapter['status']} ({chapter['decision']}). Grades are on the 20-80 scouting scale "
             f"(50 = average, 60 plus, 70 plus-plus, 80 elite), measured against every fully evolved Pokémon of "
             f"Gen {rules.GAME_GEN[game]}, so packets from different games compare like era-adjusted stats. "
             f"Present = the build on record; peak = the best of that and its strongest learnable set (D-024). "
             f"Not a simulation: the 1v1 record is the benchmark grid at the opponent's top level.*", "",
             f"## Depth chart (team OFP {avg('present')} present / {avg('peak')} peak)", "",
             "| | OFP | Power | Speed | Bulk (P/S) | Coverage | Utility | 1v1 vs the league | Build |",
             "|---|---|---|---|---|---|---|---|---|"]
    for c in sorted(cards, key=lambda c: -c["ofp"]["present"]):
        g, p = c["grades"]["present"], c["grades"]["peak"]
        both = lambda k: f"{g[k]}" if g[k] == p[k] else f"{g[k]}/{p[k]}"
        w, l = record[c["species"]]
        lines.append(f"| **{c['species']}** | {c['ofp']['present']}/{c['ofp']['peak']} | {g['power']} | {g['speed']} | "
                     f"{g['phys_bulk']}/{g['spec_bulk']} | {both('coverage')} | {both('utility')} | {w}-{l} | {c['build_source']} |")
    lines += ["", "## Team tendencies", "",
              f"- **Defensive flags:** {'; '.join(f for f in defense['flags'] if not f.startswith('assumed')) or 'none'}",
              f"- **Hits nothing super-effectively:** {', '.join(cover['neutral_only'] + cover['resisted_only'] + cover['no_answer']) or 'none'}",
              f"- **Speed order:** {', '.join(f'{r['species']} {r['base']}' for r in scout.battle.speed(team))}",
              *[f"- **Scout's note:** {n}" for n in item_notes],
              "", "## Player cards", ""]
    for c in cards:
        lines += [scout.render_report(c), ""]
    lines += ["## Call sheets", ""]
    for sh in sheets:
        lines += [scout.render_call_sheet(sh), ""]
    return "\n".join(lines)


def main(games=None):
    db = os.path.join(ENGINE, "data", "pokeref.sqlite")
    battle = BattleEngine(db)
    scout = Scouting(battle, Benchmarks(db, battle))
    rosters, builds = load_canon()
    os.makedirs(DOCS, exist_ok=True)
    for ch in rosters["chapters"]:
        if games and ch["game"] not in games:
            continue
        path = os.path.join(DOCS, f"{ch['game']}.md")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(packet(scout, ch, builds) + "\n")
        print("wrote", path)


if __name__ == "__main__":
    main(sys.argv[1:] or None)
