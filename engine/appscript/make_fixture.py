"""The data the Sheet's Studbook and Reference tabs hold, as a fixture for test_rules.mjs."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from ranch.sheet import SRC, reference_tab, studbook_tab  # noqa: E402

with open(SRC, encoding="utf-8") as fh:
    d = json.load(fh)
stud = studbook_tab(d)
rows = [r for row, c0, block in stud.blocks for r in block[1:]]          # drop the header row
ref = reference_tab()
ref_rows = [r for row, c0, block in ref.blocks for r in block[1:]]
with open(os.path.join(HERE, "fixture.json"), "w", encoding="utf-8") as fh:
    json.dump({"studbook": rows, "reference": ref_rows}, fh, ensure_ascii=False)
print(len(rows), "studbook rows,", len(ref_rows), "reference rows")
