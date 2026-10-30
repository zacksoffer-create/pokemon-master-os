"""Narrative: procedural text from an event's structured record.

Text is rendered from the event type, its outcome and its data. The template variant comes
from a presentation-only random stream keyed by event id, so wording never affects the
simulation. If no template matches, a plain factual sentence is generated instead.
"""
from __future__ import annotations

import string

from .rng import derive_seed


class _Safe(dict):
    def __missing__(self, key):
        return ""


def _names(w, ids):
    ns = [w.chars[i].short if i in w.chars else i for i in ids]
    if len(ns) <= 2:
        return " and ".join(ns)
    if len(ns) > 6:
        return ", ".join(ns[:5]) + f" and {len(ns) - 5} others"
    return ", ".join(ns[:-1]) + " and " + ns[-1]


def render(sim, ev) -> str:
    w = sim.w
    t = sim.cat.templates
    key = f"{ev['type']}.{ev.get('outcome')}"
    variants = t.get(key)
    if variants is None and ev["type"].startswith("interact."):
        variants = t.get(f"interact.chat.{ev.get('outcome')}")
    if variants is None and ev["type"] in sim.cat.actions:
        variants = t.get(f"{ev['type']}.{ev.get('outcome')}")
    d = ev.get("data", {})
    actors = ev.get("actors", [])
    targets = ev.get("targets", [])
    vals = _Safe()
    vals["a"] = w.chars[actors[0]].short if actors and actors[0] in w.chars else ""
    vals["b"] = w.chars[targets[0]].short if targets and targets[0] in w.chars else ""
    vals["members"] = _names(w, d.get("members") or actors)
    for k in ("place", "group", "event", "label", "about", "score", "verb", "pet", "n"):
        if k in d:
            vals[k] = d[k]
    if "skill" in d and d["skill"] in sim.cat.skills:
        vals["skill"] = sim.cat.skills[d["skill"]]["label"].lower()
    vals["where"] = "at the library" if ev.get("slot") in ("day",) else "at home"
    if not variants:
        who = vals["a"] or vals["members"]
        extra = f" with {vals['b']}" if vals["b"] else ""
        return f"{who}: {ev['type'].replace('_', ' ').replace('.', ' ')} ({ev.get('outcome')}){extra}."
    i = derive_seed(w.seed, "text", ev.get("id", 0), key) % len(variants)
    return string.Formatter().vformat(variants[i], (), vals)
