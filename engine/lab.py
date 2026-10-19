"""The lab: make teams and movesets, then scout them with the engine (docs/SCOUTING_ENGINE.md, layer 5).

A team can be:
- a lineup id (`heartgold`, `heartgold-sheet-tyranitar`; `lineups` lists them);
- a Showdown paste file (`paste:my_team.txt`, or any path ending in .txt), the format PKHeX and Smogon use;
- `field` (that generation's usage field);
- `usage:Snorlax,Tyranitar` (the usage sets of those species);
- `trainer:<game>:<name>` (a game's trainer, e.g. `trainer:heartgold:red`).

    python3 -I lab.py lineups
    python3 -I lab.py team heartgold
    python3 -I lab.py sets Tyranitar --gen 4
    python3 -I lab.py profile heartgold [--coach heal_line=50,tempo=finish]
    python3 -I lab.py scout heartgold --vs trainer:heartgold:red
    python3 -I lab.py scout paste:my_team.txt --vs usage:Snorlax,Blissey --gen 4
    python3 -I lab.py fight heartgold Tyranitar field Blissey

Add --json to any command for the raw numbers.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import rules  # noqa: E402
from battle.engine import BattleEngine  # noqa: E402
from battle.evaluate import COACH, Evaluator  # noqa: E402
from battle.knowledge import Combatant, from_build, usage_field, usage_sets  # noqa: E402
from battle.moves import MoveBook  # noqa: E402
from battle.paste import export, parse  # noqa: E402
from battle.playsheet import SITUATIONS, member_sheet, sheet, their_sheet  # noqa: E402
from battle.profile import POLES, SLIDER_NAMES, SLIDERS, Profiler  # noqa: E402

DB = os.path.join(HERE, "data", "pokeref.sqlite")
GAME_OF_GEN = {2: "crystal", 3: "emerald", 4: "platinum"}


class Lab:
    def __init__(self):
        self.battle = BattleEngine(DB)
        self.mb = MoveBook(self.battle.ref)
        self.ev = Evaluator(self.battle, self.mb)
        self.profiler = Profiler(self.ev, self.mb)
        self._scout = None

    @property
    def scout(self):
        if self._scout is None:
            from battle.scouting import Scouting
            self._scout = Scouting(self.battle)
        return self._scout

    def lineups(self):
        from battle.scouting_report import load_lineups
        return {l["id"]: l for l in load_lineups()}

    def coach_of(self, lineup_id):
        with open(os.path.join(HERE, "canon", "lineups.json"), encoding="utf-8") as fh:
            return json.load(fh).get("coaches", {}).get(lineup_id, {})

    def team(self, spec, gen=None, level=None):
        """(gen, [Combatant], label, coach) for a team spec."""
        if spec == "field":
            gen = gen or 4
            return gen, usage_field(gen), f"Gen {gen} OU usage field", {}
        if spec.startswith("usage:"):
            gen = gen or 4
            want = {rules.species(gen, s.strip())["name"] for s in spec[6:].split(",")}
            return gen, [c for c in usage_field(gen) if c.species in want], f"usage sets: {', '.join(sorted(want))}", {}
        if spec.startswith("trainer:"):
            _, game, name = spec.split(":", 2)
            gen = rules.GAME_GEN[game]
            from battle.benchmarks import Benchmarks
            trainers = Benchmarks(DB, self.battle).load(game)
            tr = next((t for t in trainers if name.lower() in t["name"].lower()), None)
            if tr is None:
                raise SystemExit(f"no trainer matching {name!r} in {game}: " + ", ".join(t["name"] for t in trainers))
            from battle.grid import EngineGrid
            ai = EngineGrid.ai_of(tr)
            party = [Combatant(species=p["species"], gen=gen, moves=p["moves"], level=p["level"], item=p.get("item"),
                               ivs=p.get("ivs"), evs={s: 0 for s in ("hp", "atk", "def", "spa", "spd", "spe")},
                               nature=p.get("nature"), ability=p.get("ability"), ai=ai,
                               name=f"{p['species']} ({tr['name']})", source=tr["source"]) for p in tr["party"]]
            return gen, party, f"{tr['name']} ({game})", {}
        if spec.startswith("paste:") or spec.endswith(".txt"):
            path = spec[6:] if spec.startswith("paste:") else spec
            gen = gen or 4
            with open(path, encoding="utf-8") as fh:
                builds = parse(fh.read())
            game = GAME_OF_GEN[gen]
            fill = lambda sp, rej: self.scout.strongest_set(sp, game, rej)
            return gen, [from_build(gen, b["species"], {**b, **({"level": level} if level else {})}, fill,
                                    name=b.get("nickname") or b["species"], source=path) for b in builds], path, {}
        lineups = self.lineups()
        if spec not in lineups:
            raise SystemExit(f"unknown team {spec!r}; lineups: {', '.join(lineups)}")
        l = lineups[spec]
        game = l["game"]
        gen = rules.GAME_GEN[game]
        fill = lambda sp, rej: self.scout.strongest_set(sp, game, rej)
        team = [from_build(gen, sp, {**b, **({"level": level} if level else {})}, fill, name=sp,
                           source=b.get("status") or b.get("source") or "no build on record")
                for sp, b in l["members"]]
        return gen, team, l["title"], self.coach_of(spec)


def coach_arg(text):
    out = {}
    for part in (text or "").split(","):
        if "=" in part:
            k, v = part.split("=", 1)
            k = k.strip()
            if k not in COACH:
                raise SystemExit(f"unknown coach setting {k!r}; settings: " + "; ".join(f"{k}: {v}" for k, v in COACH.items()))
            out[k] = v.strip() if k == "tempo" else float(v)
    return out


def bar(value, width=20):
    filled = round(value / 100 * width)
    return "█" * filled + "·" * (width - filled)


def cmd_lineups(lab, args):
    rows = [{"id": i, "title": l["title"], "members": [sp for sp, _ in l["members"]]} for i, l in lab.lineups().items()]
    if args.json:
        return rows
    for r in rows:
        print(f"{r['id']:28} {r['title']}\n{'':28} {', '.join(r['members'])}")


def cmd_team(lab, args):
    gen, team, label, coach = lab.team(args.team, args.gen, args.level)
    if args.json:
        return [{"name": c.name, "showdown": export(c), "assumed": c.assumed, "source": c.source} for c in team]
    print(f"# {label} (Gen {gen})" + (f"  coach: {coach}" if coach else "") + "\n")
    for c in team:
        print(export(c))
        if c.assumed:
            print("  (assumed: " + "; ".join(c.assumed) + ")")
        print()


def cmd_sets(lab, args):
    gen = args.gen or 4
    sets = usage_sets(gen, args.species, args.format)
    if args.json:
        return sets
    if not sets:
        print(f"no usage sets for {args.species} in Gen {gen}")
    for fmt, named in sets.items():
        for name, s in named.items():
            c = Combatant(species=rules.species(gen, args.species)["name"], gen=gen, moves=s["moves"],
                          level=s.get("level", 100), ability=s.get("ability"), item=s.get("item"),
                          nature=s.get("nature"), evs=s.get("evs"), ivs=s.get("ivs"))
            print(f"# {fmt} · {name}\n{export(c)}\n")


def cmd_profile(lab, args):
    gen, team, label, coach = lab.team(args.team, args.gen, args.level)
    coach = {**coach, **coach_arg(args.coach)}
    base = lab.profiler.baseline(gen, progress=None)
    p = lab.profiler.team(team, usage_field(gen), base)
    sheets = {name: member_sheet(lab.ev, m["matchups"], coach) for name, m in p["members"].items()}
    if args.json:
        return {"label": label, "gen": gen, "coach": coach, "sliders": p["sliders"], "percentiles": p["percentiles"],
                "philosophy": p["philosophy"], "record": p["record"],
                "members": {n: {"sliders": m["sliders"], "percentiles": m["percentiles"], "record": m["record"],
                                "assumed": m["combatant"].assumed, "play_sheet": sheets[n]}
                            for n, m in p["members"].items()}}
    r = p["record"]
    print(f"# {label}: self-scout against the Gen {gen} OU usage field ({len(base)} sets)")
    print(f"record {r['won']}-{r['drew']}-{r['lost']} in {r['of']} one-on-ones" + (f"   coach: {coach}" if coach else ""))
    phil = p["philosophy"]
    print("philosophy: " + (", ".join(f"{pole} (p{pc})" for _, pole, pc in phil) or "close to the field's middle on every slider"))
    print()
    for k in SLIDERS:
        lo, hi = POLES[k]
        print(f"  {SLIDER_NAMES[k]:11} {lo:>14} {bar(p['sliders'][k])} {hi:<16} {p['sliders'][k]:5.1f}  p{p['percentiles'][k]}")
    print("\nmembers (slider / percentile against the field's players):")
    print(f"  {'':12} {'W-D-L':>8}  " + "  ".join(f"{SLIDER_NAMES[k][:8]:>8}" for k in SLIDERS))
    for name, m in p["members"].items():
        rr = m["record"]
        print(f"  {name:12} {rr['won']:>2}-{rr['drew']}-{rr['lost']:<3}  " +
              "  ".join(f"{m['sliders'][k]:3.0f} p{m['percentiles'][k]:<3}" for k in SLIDERS))
    print("\nplay sheet (its most common call in each situation, against the field):")
    print(f"  {'':12} " + " | ".join(f"{name}" for _, name, _ in SITUATIONS))
    for name, sh in sheets.items():
        print(f"  {name:12} " + " | ".join(f"{sh[sid]['call']} {sh[sid]['share']}%" for sid, _, _ in SITUATIONS))
    assumed = sorted({a for m in p["members"].values() for a in m["combatant"].assumed})
    if assumed:
        print("\nassumed where nothing is on record: " + "; ".join(assumed))


def cmd_scout(lab, args):
    gen, ours, label, coach = lab.team(args.team, args.gen, args.level)
    tgen, theirs, tlabel, _ = lab.team(args.vs, gen, None)
    if tgen != gen:
        raise SystemExit(f"{label} is Gen {gen} and {tlabel} is Gen {tgen}: scout within one generation")
    if args.vs.startswith("trainer:") and not args.level:   # meet them at their level, as the journey did
        top = max(c.level for c in theirs)
        ours = [Combatant(**{**c.__dict__, "level": top}) for c in ours]
    coach = {**coach, **coach_arg(args.coach)}
    res = lab.ev.versus(ours, theirs)
    grid = {(a.name, b.name): res[(a.key, b.key)] for a in ours for b in theirs}
    plan = []
    for b in theirs:   # the game plan: who takes each of theirs, their calls and ours by situation
        best = max(ours, key=lambda a: grid[(a.name, b.name)].outcome.value())
        m = grid[(best.name, b.name)]
        plan.append({"theirs": b.name, "send": best.name, "result": m.outcome.winner, "plan": m.plan.label(),
                     "our_calls": sheet(lab.ev, m, coach), "their_calls": their_sheet(lab.ev, m),
                     "answers": [a.name for a in ours if grid[(a.name, b.name)].outcome.winner == "A"]})
    if args.json:
        return {"ours": label, "theirs": tlabel, "coach": coach, "game_plan": plan,
                "grid": {f"{a} vs {b}": {"winner": m.outcome.winner, "plan": m.plan.label(), "answer": m.answer.label(),
                                         "turns": m.outcome.turns, "hp": m.outcome.hp, "odds": m.outcome.odds,
                                         "calls": m.outcome.calls, "credits": m.credits}
                         for (a, b), m in grid.items()}}
    mark = {"A": "W", "B": "L", "draw": "D"}
    print(f"# {label} vs {tlabel} (Gen {gen})" + (f"   coach: {coach}" if coach else ""))
    print("\none-on-ones (W = ours wins with its best plan against their best answer):")
    print(f"  {'':24} " + " ".join(f"{a.name[:10]:>10}" for a in ours))
    for b in theirs:
        print(f"  {b.name[:24]:24} " + " ".join(f"{mark[grid[(a.name, b.name)].outcome.winner]:>10}" for a in ours))
    print("\ngame plan:")
    for row in plan:
        print(f"\n  {row['theirs']}: send {row['send']} ({mark[row['result']]}), {row['plan']}"
              + (f"; also beats it: {', '.join(x for x in row['answers'] if x != row['send'])}" if len(row['answers']) > 1 else ""))
        for sid, name, _ in SITUATIONS:
            print(f"    {name:17} we call {str(row['our_calls'][sid]):16} they call {row['their_calls'][sid]}")


def cmd_fight(lab, args):
    gen, ours, _, coach = lab.team(args.team, args.gen, args.level)
    tgen, theirs, _, _ = lab.team(args.vs, gen, None)
    if args.vs.startswith("trainer:") and not args.level:   # meet them at their level, as the journey did
        top = max(c.level for c in theirs)
        ours = [Combatant(**{**c.__dict__, "level": top}) for c in ours]
    pick = lambda team, name: next((c for c in team if name.lower() in c.name.lower()), None)
    a, b = pick(ours, args.ours), pick(theirs, args.theirs)
    if not a or not b:
        raise SystemExit("couldn't find " + (args.ours if not a else args.theirs))
    m = lab.ev.versus([a], [b])[(a.key, b.key)]
    o = m.outcome
    if args.json:
        return {"plan": m.plan.label(), "answer": m.answer.label(), "winner": o.winner, "log": o.log,
                "odds": o.odds, "credits": m.credits, "notes": sorted(o.notes), "straight": m.straight.winner}
    print(f"# {a.name} vs {b.name}")
    print(f"our best plan: {m.plan.label()}   their best answer: {m.answer.label()}")
    print(f"result: {({'A': a.name, 'B': b.name}).get(o.winner, 'a draw')} in {o.turns} turns; "
          f"the odds all our moves land {o.odds[0]:.0%}, theirs {o.odds[1]:.0%}")
    print(f"attacking only, the winner would be: {({'A': a.name, 'B': b.name}).get(m.straight.winner, 'a draw')}")
    if m.credits:
        print("what made the difference: " + ", ".join(f"{k} ({v})" for k, v in m.credits.items()))
    print(f"\n  {'turn':>4}  {'first':6} {a.name[:20]:20} {b.name[:20]:20} {'HP':>12}")
    for t, ca, cb, ha, hb, first in o.log:
        print(f"  {t:>4}  {('ours' if first == 'A' else 'theirs'):6} {str(ca)[:20]:20} {str(cb)[:20]:20} {ha:5.1f} / {hb:5.1f}")
    if o.notes:
        print("\nnotes: " + "; ".join(sorted(o.notes)))


def _add(sub, common, name, positional, options):
    p = sub.add_parser(name, parents=[common])
    for a in positional:
        p.add_argument(a)
    for k, v in options.items():
        p.add_argument(f"--{k}", **v)
    return p


def main(argv=None):
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true", help="print the raw numbers as JSON")
    common.add_argument("--gen", type=int, help="generation for pastes, usage sets and the field (default 4)")
    common.add_argument("--level", type=int, help="level for our team (default 100; a trainer's top level vs a trainer)")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    add = lambda name, *pos, **opts: _add(sub, common, name, pos, opts)
    add("lineups")
    add("team", "team")
    add("sets", "species", format={"help": "one format, e.g. gen4ou"})
    add("profile", "team", coach={"help": "coach settings, e.g. heal_line=50,tempo=finish"})
    add("scout", "team", vs={"required": True, "help": "the other team"}, coach={"help": "coach settings"})
    add("fight", "team", "ours", "vs", "theirs")
    args = ap.parse_args(argv)
    lab = Lab()
    out = {"lineups": cmd_lineups, "team": cmd_team, "sets": cmd_sets, "profile": cmd_profile, "scout": cmd_scout,
           "fight": cmd_fight}[args.cmd](lab, args)
    if args.json:
        print(json.dumps(out, indent=1, default=str))


if __name__ == "__main__":
    main()
