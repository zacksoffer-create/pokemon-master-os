"""The film room (docs/FILM.md): public Pokémon Showdown replays, read turn by turn.

    python3 -I film_room.py search --format gen4ou [--user NAME] [--tournaments] [--min-rating 1300]
    python3 -I film_room.py box gen4ou-2701283736                 # one battle: teams in order, builds, how it went
    python3 -I film_room.py study --format gen4ou --count 60 [--min-rating 1300] [--tournaments] [--json]
    python3 -I film_room.py study --user NAME --format gen4ou     # one player's scouting read
    python3 -I film_room.py card  …same as study… [--trainer me]  # the study as an intake card, for review
    python3 -I film_room.py usage --format gen4ou Tyranitar [--month 2026-09] [--cutoff 1630]   # Smogon's numbers
    python3 -I film_room.py spreads [--month 2026-09]             # likely spreads for the film builds → a card
    python3 -I film_room.py book [--format gen4ou] [Tyranitar …]  # the builds book (no --format: every format → the page)

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


def write_book_page(cfg, reader, month=None, cutoff=None, top=None):
    """Every format's builds book, saved as data and written into the page (docs/film/builds_book.html)."""
    import datetime
    from film.buildbook import book
    books = {}
    for fmt in cfg["book"]["formats"]:
        b = book(cfg, reader, fmt, month, cutoff, top)
        books[fmt] = b
        out = os.path.join(HERE, cfg["store"]["book"], f"book-{fmt}-{b['month']}.json")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(b, fh, ensure_ascii=False)
        print(f"{fmt}: {len(b['species'])} species, {sum(len(r['sets']) for r in b['species'])} sets, {b['replays']} replays")
    blob = json.dumps({"books": books, "built": datetime.date.today().isoformat()}, ensure_ascii=False).replace("</", "<\\/")
    with open(os.path.join(HERE, "film", "builds_page.html"), encoding="utf-8") as fh:
        page = fh.read().replace("/*DATA*/", blob)
    path = os.path.join(os.path.dirname(HERE), cfg["book"]["page"])
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(page)
    print("wrote", path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["search", "box", "study", "card", "usage", "spreads", "book"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--format")
    ap.add_argument("--user")
    ap.add_argument("--count", type=int, default=40)
    ap.add_argument("--pages", type=int)
    ap.add_argument("--min-rating", type=int)
    ap.add_argument("--tournaments", action="store_true", help="Smogon tournament games only")
    ap.add_argument("--trainer", help="card: the trainer id to file under (e.g. me)")
    ap.add_argument("--again", action="store_true")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--month", help="usage/spreads: a Smogon stats month (default: the newest)")
    ap.add_argument("--cutoff", type=int, help="usage/spreads: the rating cutoff (default in film/config.json)")
    ap.add_argument("--top", type=int, help="book: how many species, by usage")
    a = ap.parse_args(argv)
    cfg = load_config()
    if a.cmd != "book":
        a.format = a.format or "gen4ou"
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
        elif a.cmd == "usage":
            from film.usage import Names, fetch, render, species
            fmt = a.format
            data = fetch(cfg, fmt, a.month, a.cutoff)
            names = Names(cfg, cfg["formats"][fmt]["gen"])
            for sp in a.args or [k for k, _ in sorted(data["data"].items(), key=lambda x: -x[1]["usage"])[:10]]:
                line = species(cfg, data, sp, names)
                print((json.dumps(line, indent=1, ensure_ascii=False) if a.json else
                       render(line, data["_month"], fmt, data["_cutoff"])) + "\n")
        elif a.cmd == "spreads":
            from film.cards import spreads_card
            from ingest.cards import Inbox, render_card
            reader = reader_for(cfg)
            inbox = Inbox()
            card, made = spreads_card(inbox, reader.store, reader.book, cfg, a.month, a.cutoff, again=a.again)
            print(("New card:\n" if made else "Already in the inbox (use --again to re-run):\n") + render_card(card, inbox))
        elif a.cmd == "book":
            from film.buildbook import book, render
            reader = reader_for(cfg)
            if a.format:
                b = book(cfg, reader, a.format, a.month, a.cutoff, a.top)
                print(json.dumps(b, indent=1, ensure_ascii=False) if a.json else render(b, a.args or None))
            else:
                write_book_page(cfg, reader, a.month, a.cutoff, a.top)
    except Unreachable as e:
        sys.exit(f"Not ready: {e}")


if __name__ == "__main__":
    main()
