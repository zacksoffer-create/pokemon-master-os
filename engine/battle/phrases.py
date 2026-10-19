"""The phrase book (D-046): numbers from the data trigger phrases, the way the games turn a Pokémon's highest
IV into "Likes to thrash about" or a trainer's last Pokémon at half HP into a line of dialogue.

Rules live in phrasebook.json and can be edited without touching code. Each rule has:
  id        a stable name, shown as the phrase's trigger
  section   where the phrase goes (philosophy, tendencies, when_ahead, when_behind, vs_types, vs_moves, ...)
  when      conditions that must all hold: [metric, op, value]; ops: >= <= > < == != in notin has empty nonempty
  say       the phrase, with {metric} placeholders (and format specs such as {speed_pct:.0%})
  group     optional: within a group only the first matching rule fires (a tier list, like the game's tables)
Rules fire in file order. Nothing is evaluated as code.
"""
import json
import os
import string

HERE = os.path.dirname(os.path.abspath(__file__))
BOOK = os.path.join(HERE, "phrasebook.json")
OPS = {
    ">=": lambda a, b: a is not None and a >= b, "<=": lambda a, b: a is not None and a <= b,
    ">": lambda a, b: a is not None and a > b, "<": lambda a, b: a is not None and a < b,
    "==": lambda a, b: a == b, "!=": lambda a, b: a != b,
    "in": lambda a, b: a in b, "notin": lambda a, b: a not in b, "has": lambda a, b: a is not None and b in a,
    "empty": lambda a, b: not a, "nonempty": lambda a, b: bool(a),
}


class Phrasebook:
    def __init__(self, path=BOOK):
        with open(path, encoding="utf-8") as fh:
            self.book = json.load(fh)
        self._check()

    def _check(self):
        for kind, rules in self.book.items():
            if kind.startswith("_"):
                continue
            for r in rules:
                for metric, op, *_ in r["when"]:
                    if op not in OPS:
                        raise ValueError(f"{kind}/{r['id']}: unknown op {op}")

    @staticmethod
    def _holds(cond, ctx):
        metric, op, *value = cond
        return OPS[op](ctx.get(metric), value[0] if value else None)

    @staticmethod
    def _fields(template):
        return {f.split(".")[0].split("[")[0] for _, f, _, _ in string.Formatter().parse(template) if f}

    def speak(self, kind, ctx):
        """Every phrase this context triggers: [{section, text, rule, trigger}] in phrase-book order."""
        out, fired_groups = [], set()
        for r in self.book.get(kind, []):
            if r.get("group") in fired_groups:
                continue
            if not all(self._holds(c, ctx) for c in r["when"]):
                continue
            if any(ctx.get(f) in (None, "", []) for f in self._fields(r["say"])):
                continue   # a phrase never prints with a hole in it
            if r.get("group"):
                fired_groups.add(r["group"])
            trigger = "; ".join(self._show(m, op, v, ctx) for m, op, *v in r["when"]) or "always"
            out.append({"section": r["section"], "text": r["say"].format(**ctx), "rule": r["id"], "trigger": trigger})
        return out

    @staticmethod
    def _show(metric, op, value, ctx):
        """A condition as the trigger line shows it, with the value that met it."""
        here = ctx.get(metric)
        if isinstance(here, float):
            here = round(here, 2)
        if op in ("empty", "nonempty"):
            return f"{metric} {op}"
        return f"{metric} {op} {value[0] if value else ''} (here {here})"

    @staticmethod
    def by_section(phrases):
        grouped = {}
        for p in phrases:
            grouped.setdefault(p["section"], []).append(p)
        return grouped
