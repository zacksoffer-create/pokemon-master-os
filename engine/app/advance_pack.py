"""Advance scouting's data (docs/APP.md): the battle engine's Journey Scouting File (battle/scouting_report.py) for the
app, split so a page loads one lineup at a time.

The battle engine plays every one-on-one out with Smogon's damage calculator (node), which the app can't run, so the
app shows the engine's last run as it stands: docs/scouting/scouting_file.html, read back here. `--fresh` re-runs
the engine first (needs node and battle/node_modules).

    advance.json            the method, sections, situations, coach sliders, the what-if league, and every lineup's
                            member cards, self-scout and coach profile
    advance-<lineup>.json   that lineup's opponent sheets: calls, the lead, anchors, the advance report, the game
                            plan and the play calls by situation

    python3 -I app/advance_pack.py [--fresh]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
ROOT = os.path.dirname(ENGINE)
sys.path.insert(0, ENGINE)
PAGE = os.path.join(ROOT, "docs", "scouting", "scouting_file.html")
TEMPLATE = os.path.join(ENGINE, "battle", "scouting_page.html")


def read_page(path=PAGE):
    with open(TEMPLATE, encoding="utf-8") as fh:
        tpl = fh.read()
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    i = tpl.find("/*DATA*/")
    return json.loads(html[i:len(html) - len(tpl[i + len("/*DATA*/"):])].replace("<\\/", "</"))


def main(fresh=False):
    if fresh:
        from battle.scouting_report import export_data
        data = export_data()
    else:
        data = read_page()
    out = os.path.join(HERE, "data")
    index = {k: v for k, v in data.items() if k != "lineups"}
    index["lineups"] = []
    sizes = {}
    for lu in data["lineups"]:
        sheets = lu.pop("sheets")
        index["lineups"].append(lu)
        path = os.path.join(out, f"advance-{lu['id']}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"id": lu["id"], "sheets": sheets}, fh, ensure_ascii=False, separators=(",", ":"))
        sizes[lu["id"]] = os.path.getsize(path)
    path = os.path.join(out, "advance.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"advance.json {os.path.getsize(path) / 1024:.0f} KB (generated {data['generated']}); "
          f"{len(sizes)} lineup files, {sum(sizes.values()) / 1024:.0f} KB")


if __name__ == "__main__":
    main("--fresh" in sys.argv)
