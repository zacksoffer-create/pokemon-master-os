"""library.json: the Trainer Library for the app (trainers/catalog.py; pages in web/89_trainers.html).

    python3 -I engine/app/library_pack.py        # app/data/library.json (export.py runs it)

Every trainer and version (in-game encounters from trainers/library.py, and the authored ones in canon/trainers.json),
evidence classes per team member, the two lenses, benchmark collections with their rules and version stamps, and the
games' AI flags read as tendencies and competence.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
OUT = os.path.join(HERE, "data", "library.json")


def main(argv=None):
    """--out PATH writes the whole pack somewhere else (the 6v6 fixtures read it there: app/data's copy has the fresh
    start applied, D-078)."""
    argv = sys.argv[1:] if argv is None else argv
    out = argv[argv.index("--out") + 1] if "--out" in argv else OUT
    sys.path.insert(0, ENGINE)
    from trainers.catalog import Catalog
    pack = Catalog().pack()
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{out}: {len(pack['identities'])} trainers, {len(pack['versions'])} versions, {len(pack['collections'])} collections, "
          f"{os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    main()
    if "--out" not in sys.argv:          # the app's copy keeps the fresh start (D-078); --out is the whole pack on purpose
        sys.path.insert(0, HERE)
        import fresh
        fresh.after("library.json")
