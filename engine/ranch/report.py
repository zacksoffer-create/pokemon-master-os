"""Ranch census as a file: python3 -I ranch/report.py  ->  data_manifest/ranch_census.json"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)

from ranch.planner import RanchPlanner  # noqa: E402


def main():
    c = RanchPlanner(os.path.join(ENGINE, "data", "pokeref.sqlite")).census()
    c["profiles"] = {k: vars(v) for k, v in c["profiles"].items()}
    out = os.path.join(ENGINE, "data_manifest", "ranch_census.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(c, fh, ensure_ascii=False, indent=1)
    print(f"{len(c['residents'])} residents -> {out}")


if __name__ == "__main__":
    main()
