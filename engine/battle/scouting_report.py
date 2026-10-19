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
from battle.evaluate import Evaluator  # noqa: E402
from battle.grid import EngineGrid  # noqa: E402
from battle.knowledge import usage_field  # noqa: E402
from battle.moves import MoveBook  # noqa: E402
from battle.phrases import Phrasebook  # noqa: E402
from battle.playsheet import SITUATIONS, member_sheet, sheet as play_sheet, their_sheet  # noqa: E402
from battle.profile import POLES, SLIDER_NAMES, SLIDERS, Profiler  # noqa: E402
from battle.scouting import GAME_TITLE, SIGNATURE_ITEMS, Scouting, join  # noqa: E402
from team import Member, Team  # noqa: E402

DOCS = os.path.join(os.path.dirname(ENGINE), "docs", "scouting")
METHOD = ("No grades: every line below is a phrase from the phrase book (engine/battle/phrasebook.json), triggered by "
          "numbers the engine measures, the way the games turn a Pokémon's best IV into its characteristic. Speed, power "
          "and bulk are measured against every fully evolved Pokémon of the same generation. Opponents' philosophy comes "
          "from the game's own trainer AI flags, bag and battle lines. Every one-on-one is played out by the scouting "
          "engine (docs/SCOUTING_ENGINE.md): our best plan against their best answer, Smogon's calculator for every "
          "hit at the lowest roll, every move landing, the odds kept. Against a game's trainers we meet them at their "
          "top level; the coach profile is measured against that generation's Smogon OU usage field at Lv 100.")


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


def situations_for(scout, sh, m, coach):
    """The game plan by situation: for each of their Pokémon, the one we send, our call and theirs, down and distance."""
    ev = scout.grid.ev
    out = []
    for i, row in enumerate(sh["calls"]):
        names = m["our_names"]
        send = row["call"]["member"] if row["call"] else max(names, key=lambda n: m["evaluated"][(i, names.index(n))].outcome.value())
        mt = m["evaluated"][(i, names.index(send))]
        out.append({"theirs": row["species"], "send": send, "result": mt.outcome.winner, "plan": mt.plan.label(),
                    "answer": mt.answer.label(), "turns": mt.outcome.turns, "odds": [round(x, 2) for x in mt.outcome.odds],
                    "credits": mt.credits, "ours": play_sheet(ev, mt, coach), "their": their_sheet(ev, mt),
                    "notes": sorted(mt.outcome.notes)})
    return out


def profile_for(scout, team, coach):
    """The coach profile against the generation's usage field, and each member's play sheet there."""
    ev = scout.grid.ev
    prof = Profiler(ev, ev.mb)
    gen = team.gen
    ours = scout.grid.ours(team)
    field = usage_field(gen)
    p = prof.team(ours, field, prof.baseline(gen))
    members = {}
    for name, m in p["members"].items():
        members[name] = {"sliders": {k: round(v, 1) for k, v in m["sliders"].items() if k in SLIDERS},
                         "decisive": {k: round(v, 1) for k, v in m["sliders"]["decisive"].items()},
                         "percentiles": m["percentiles"], "record": m["record"], "assumed": m["combatant"].assumed,
                         "play_sheet": member_sheet(ev, m["matchups"], coach)}
    return {"gen": gen, "field_n": len(field), "sliders": p["sliders"], "percentiles": p["percentiles"],
            "philosophy": [list(x) for x in p["philosophy"]], "record": p["record"], "members": members,
            "coach": coach}


def chapter_data(scout, lineup, coach=None):
    """Everything one packet shows, as data: the self-scout, the reports, and a call sheet per opponent."""
    game = lineup["game"]
    built = [scout.member_for(sp, game, b) for sp, b in lineup["members"]]
    team = Team(game, [m for m, _ in built])
    opponents = [o for o in scout.bench.load(game) if "rematch" not in o["name"].lower()]
    coach = coach or {}
    sheets = []
    for o in opponents:
        sh = scout.call_sheet(team, o)
        if isinstance(scout.grid, EngineGrid):
            sh["situations"] = situations_for(scout, sh, scout._last_matchups, coach)
        sheets.append(sh)
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
            wins = sum(dict(scout.grid.matchups(alt, o)["anchors"])[mem.species] for o in opponents)
            w, l = record[mem.species]
            notes.append(f"{mem.species} has no {item} on record: {w}-{l} against the league without it, "
                         f"{wins}-{w + l - wins} with it.")
    cards = [scout.report(sp, game, b, tuple(record[rules.species(team.gen, sp)["name"]])) for sp, b in lineup["members"]]
    return {"id": lineup["id"], "chapter": lineup["chapter"], "game": game, "title": lineup["title"],
            "thesis": lineup["thesis"], "status": lineup["status"], "decision": lineup["decision"],
            "variation": lineup["variation"], "cards": cards, "sheets": sheets,
            "self_scout": scout.self_scout(team, cards, notes),
            "profile": profile_for(scout, team, coach) if isinstance(scout.grid, EngineGrid) else None,
            "members": team.members}


MARK = {"A": "W", "B": "L", "draw": "D"}


def render_profile(p):
    phil = ", ".join(f"{pole} (p{pc})" for _, pole, pc in p["philosophy"]) or "close to the field's middle on every slider"
    r = p["record"]
    lines = ["### Coach profile", "",
             f"Against the Gen {p['gen']} OU usage field ({p['field_n']} Smogon sets): **{phil}**. "
             f"{r['won']}-{r['drew']}-{r['lost']} in {r['of']} one-on-ones. A slider is a share of those fights; p is the "
             "percentile among 2,000 random six-Pokémon teams drawn from the field.", "",
             "| Slider | ◀ | Value | ▶ | Percentile |", "|---|---|---|---|---|"]
    lines += [f"| {SLIDER_NAMES[k]} | {POLES[k][0]} | {p['sliders'][k]:.0f} | {POLES[k][1]} | p{p['percentiles'][k]} |"
              for k in SLIDERS]
    lines += ["", "| Player | W-D-L | " + " | ".join(SLIDER_NAMES[k] for k in SLIDERS) + " |",
              "|---|---|" + "---|" * len(SLIDERS)]
    for name, m in p["members"].items():
        rr = m["record"]
        lines.append(f"| {name} | {rr['won']}-{rr['drew']}-{rr['lost']} | " +
                     " | ".join(f"{m['sliders'][k]:.0f} (p{m['percentiles'][k]})" for k in SLIDERS) + " |")
    lines += ["", "**Play sheet** (its most common call in each situation, against the field):", "",
              "| Player | " + " | ".join(n for _, n, _ in SITUATIONS) + " |", "|---|" + "---|" * len(SITUATIONS)]
    for name, m in p["members"].items():
        lines.append(f"| {name} | " + " | ".join(f"{m['play_sheet'][sid]['call']} ({m['play_sheet'][sid]['share']}%)"
                                                for sid, _, _ in SITUATIONS) + " |")
    assumed = sorted({a for m in p["members"].values() for a in m["assumed"]})
    if assumed:
        lines += ["", f"*Assumed where nothing is on record: {'; '.join(assumed)}.*"]
    return lines


def render_situations(rows):
    lines = ["", "**Game plan by situation** (our call / theirs):", "",
             "| Their player | We send | " + " | ".join(n for _, n, _ in SITUATIONS) + " |",
             "|---|---|" + "---|" * len(SITUATIONS)]
    for r in rows:
        lines.append(f"| {r['theirs']} | {r['send']} ({MARK[r['result']]}) | " +
                     " | ".join(f"{r['ours'][sid] or '—'} / {r['their'][sid] or '—'}" for sid, _, _ in SITUATIONS) + " |")
    return lines


def render_packet(d):
    lines = [f"# Scouting packet: {d['title']} ({d['thesis']})", "",
             f"*Roster status: {d['status']} ({d['decision']}). {METHOD}*", "", "## Self-scout", ""]
    if d.get("profile"):
        lines += render_profile(d["profile"]) + [""]
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
        lines += [Scouting.render_call_sheet(sh)]
        if sh.get("situations"):
            lines += render_situations(sh["situations"])
        lines += [""]
    return "\n".join(lines)


def scout_engine():
    db = os.path.join(ENGINE, "data", "pokeref.sqlite")
    battle = BattleEngine(db)
    return Scouting(battle, Benchmarks(db, battle), grid=EngineGrid(Evaluator(battle, MoveBook(battle.ref))))


def coaches():
    with open(os.path.join(ENGINE, "canon", "lineups.json"), encoding="utf-8") as fh:
        return json.load(fh).get("coaches", {})


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
    coach = coaches()
    lineups = [chapter_data(scout, lu, coach.get(lu["id"])) for lu in load_lineups()]
    league = scout.what_if_league({d["id"]: d["members"] for d in lineups})
    for d in lineups:
        d.pop("members")
    titles = dict(GAME_TITLE, **{d["id"]: d["title"] for d in lineups})
    return {"generated": time.strftime("%Y-%m-%d"), "method": METHOD, "lineups": lineups, "league": league,
            "titles": titles, "chapters": [g for g in GAME_TITLE if any(d["chapter"] == g for d in lineups)],
            "sections": Scouting.SECTION_TITLES,
            "situations": [{"id": i, "name": n, "state": st} for i, n, st in SITUATIONS],
            "sliders": [{"id": k, "name": SLIDER_NAMES[k], "left": POLES[k][0], "right": POLES[k][1]} for k in SLIDERS],
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
