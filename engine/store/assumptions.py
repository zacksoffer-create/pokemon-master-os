"""The assumptions register (store/assumptions.json): what the assistant assumed while building, for Zack to review.

    python3 -I engine/store/assumptions.py         # checks the register and writes docs/design/ASSUMPTIONS.md

app/export.py puts the items in hq.json; the app shows them in Your calls (#/calls) with Keep / Change / Reject.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
SRC = os.path.join(HERE, "assumptions.json")
DOC = os.path.join(os.path.dirname(ENGINE), "docs", "design", "ASSUMPTIONS.md")
FIELDS = ("id", "decision", "phase", "area", "what", "why", "where", "instead")


def load():
    with open(SRC, encoding="utf-8") as fh:
        items = json.load(fh)["items"]
    seen = set()
    for a in items:
        missing = [f for f in FIELDS if not a.get(f)]
        if missing:
            raise ValueError(f"{a.get('id')}: missing {', '.join(missing)}")
        if a["id"] in seen:
            raise ValueError(f"{a['id']} twice")
        seen.add(a["id"])
        if not (isinstance(a["where"], list) and len(a["where"]) == 2 and a["where"][0].startswith("#/")):
            raise ValueError(f"{a['id']}: where is [app link, label]")
    return items


def markdown(items):
    out = ["# Assumptions register", "",
           "What the assistant assumed while building, so you can see each one and keep, change or reject it "
           "(Zack, 2026-10-24: *\"make assumptions and decisions as you need to, just keep track so I can have my input\"*). "
           "Generated from `engine/store/assumptions.json` by `engine/store/assumptions.py`; the same items are in the app "
           "under **Your calls**, each with a link to where it shows. Every item is reversible; each phase's set is one "
           "PROVISIONAL row in `docs/DECISION_LEDGER.md`.", ""]
    phase = None
    for a in items:
        if a["phase"] != phase:
            phase = a["phase"]
            out += [f"## {phase}", ""]
        out += [f"### {a['id']} · {a['area']} ({a['decision']})", "", a["what"], "",
                f"- **Why:** {a['why']}", f"- **See it:** `{a['where'][0]}` ({a['where'][1]})",
                f"- **Could instead:** {'; '.join(a['instead'])}", ""]
    return "\n".join(out)


def main():
    items = load()
    with open(DOC, "w", encoding="utf-8") as fh:
        fh.write(markdown(items))
    print(f"{DOC}: {len(items)} assumptions")


if __name__ == "__main__":
    sys.exit(main())
