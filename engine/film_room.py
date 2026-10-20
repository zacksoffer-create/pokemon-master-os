"""The film room (docs/FILM.md): public Pokémon Showdown replays, read turn by turn.

    python3 -I film_room.py search --format gen4ou [--user NAME] [--tournaments] [--min-rating 1300]
    python3 -I film_room.py box gen4ou-2701283736                 # one battle: teams in order, builds, how it went
    python3 -I film_room.py study --format gen4ou --count 60 [--min-rating 1300] [--tournaments] [--json]
    python3 -I film_room.py study --user NAME --format gen4ou     # one player's scouting read
    python3 -I film_room.py card  …same as study… [--trainer me]  # the study as an intake card, for review

Replays are cached in data/raw/showdown_replays; a study is saved to data/derived/film. A card goes to the intake
inbox (intake.py show / approve / apply); nothing reaches canon until it's approved.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from film.replays import Unreachable, collect, fetch, load_config  # noqa: E402


def reader_for(cfg):
    from film.study import Reader
    from trainers.model import Store
    from trainers.roles import RoleBook
    from trainers.solver import Solver
    store = Store()
    book = RoleBook(store)
    return Reader(store, book, Solver(book), cfg)


def gather(cfg, a):
    entries = collect(cfg, a.format, a.user, a.count, a.min_rating, a.tournaments, a.pages)
    recs = []
    for e in entries:
        rec = fetch(cfg, e["id"])
        if rec and rec.get("log"):
            recs.append(rec)
    return recs


def study(cfg, a):
    from film.study import run
    fmt = a.format
    if fmt not in cfg["formats"]:
        sys.exit(f"{fmt} isn't a format the film room reads (film/config.json formats: {', '.join(cfg['formats'])})")
    recs = gather(cfg, a)
    if not recs:
        sys.exit("No replays matched.")
    r, parsed = run(reader_for(cfg), fmt, cfg["formats"][fmt], recs, a.user)
    out = os.path.join(HERE, cfg["store"]["studies"], f"{fmt}-{(a.user or 'field').lower()}.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(r, fh, indent=1, ensure_ascii=False)
    return r


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["search", "box", "study", "card"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--format", default="gen4ou")
    ap.add_argument("--user")
    ap.add_argument("--count", type=int, default=40)
    ap.add_argument("--pages", type=int)
    ap.add_argument("--min-rating", type=int)
    ap.add_argument("--tournaments", action="store_true", help="Smogon tournament games only")
    ap.add_argument("--trainer", help="card: the trainer id to file under (e.g. me)")
    ap.add_argument("--again", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    cfg = load_config()
    try:
        if a.cmd == "search":
            for e in collect(cfg, a.format, a.user, a.count, a.min_rating, a.tournaments, a.pages):
                print(f"{e['id']}  {' vs '.join(e.get('players') or [])}  rating {e.get('rating') or '—'}")
        elif a.cmd == "box":
            from film.report import render_box
            from film.study import parse_replay
            rec = fetch(cfg, a.args[0])
            if not rec:
                sys.exit(f"No replay {a.args[0]}")
            fmt = rec.get("formatid") or a.format
            gen = cfg["formats"].get(fmt, {}).get("gen") or int(fmt[3]) if fmt.startswith("gen") else 4
            b = parse_replay(rec, reader_for(cfg), gen, cfg)
            print(json.dumps(b, indent=1, ensure_ascii=False) if a.json else render_box(b))
        elif a.cmd in ("study", "card"):
            r = study(cfg, a)
            if a.cmd == "study":
                from film.report import render_study
                print(json.dumps(r, indent=1, ensure_ascii=False) if a.json else render_study(r))
            else:
                from film.cards import to_card
                from ingest.cards import Inbox, render_card
                inbox = Inbox()
                card, made = to_card(inbox, cfg, r, a.trainer, again=a.again)
                print(("New card:\n" if made else "Already in the inbox (use --again to re-run):\n") + render_card(card, inbox))
    except Unreachable as e:
        sys.exit(f"Not ready: {e}")


if __name__ == "__main__":
    main()
