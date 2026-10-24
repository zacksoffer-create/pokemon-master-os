"""breeding.json: the breeding-stock engine's data for the browser (breeding/stock.py `pack_from_db`, read by
web/23_stock.html; app/test_stock_parity.mjs holds the two together).

    python3 -I engine/app/breeding_pack.py        # app/data/breeding.json (export.py runs it)

Species (families, egg groups, gender rates, egg cycles), learnsets for every version group of Gens 1-4 by method
(level-up in learning order, egg, tutor, TM/HM as bitmasks, Light Ball), wild and gift species per game, evolutions
that need a known move, and the inheritance odds and explanation texts, so both copies read the same words.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
OUT = os.path.join(HERE, "data", "breeding.json")


def main():
    sys.path.insert(0, ENGINE)
    from breeding import stock
    from trainers.model import DB
    pack = stock.pack_from_db(DB)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{OUT}: {len(pack['species'])} species, {len(pack['moves'])} moves, {len(pack['learn'])} version groups, "
          f"{os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
