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


def main():
    sys.path.insert(0, ENGINE)
    from trainers.catalog import Catalog
    pack = Catalog().pack()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{OUT}: {len(pack['identities'])} trainers, {len(pack['versions'])} versions, {len(pack['collections'])} collections, "
          f"{os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
