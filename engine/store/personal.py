"""Your records made in the app: the Sheet's My Pokémon, My Builds and My Teams tabs (docs/design/DATA_CONTRACT.md §3-4).

The app appends rows to those tabs and never rewrites one. This file is the engine's side of that:
- the row formats, shared with the browser (app/web/21_records.html, held together by app/test_records.mjs);
- a snapshot of the tabs in engine/store/personal.json, which store/migrate.py merges over the starting records so the
  engines (team roles, the app's packs) read your saved versions too.

    python3 -I engine/store/personal.py --from rows.json      # rows.json: {"My Builds": [[header…], [row…]…] | [{…}], …}
    python3 -I engine/store/personal.py --fixture out.json    # the format test's fixture (rows and what they decode to)

The snapshot is taken from the tabs (with the Sheets connector or a download); nothing here writes to the Sheet.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SNAPSHOT = os.path.join(HERE, "personal.json")
TABS = {"individual": "My Pokémon", "build": "My Builds", "team": "My Teams", "artwork": "My Artwork", "gear": "My Gear"}
GEAR_FIELDS = ("item", "game", "qty", "note", "at")   # your equipment (Phase 6): one row per item per game, the newest wins
STATS = ("hp", "atk", "def", "spa", "spd", "spe")
BUILD_FIELDS = ("species", "generation", "game", "level", "nature", "ability", "item")
BUILD_TEXT = ("name", "note", "parent", "individual", "at", "recognition",   # a version keeps the recognition it earned
              "kind", "purpose", "labels")       # kind "blueprint": breeding stock (its purpose and your labels with it)
IND_FIELDS = ("species", "game", "nickname", "gender", "shiny", "form", "ball", "build", "met_how", "met_as", "met_location", "caught_level",
              "friendship", "origin", "note", "hero",
              "sire", "dam", "blueprint")         # its parents' ids (the studbook's or yours) and the blueprint it was bred to
# hatch_moves (a list, written like moves): the moves it hatched with, kept even after it learns others


# --- formats (the browser's Records.enc / Records.dec do the same) -------------------------------------------------
def enc_stats(d):
    """{'hp': 0, 'atk': 252, …} -> '0/252/0/0/4/252'; none recorded -> ''. A missing stat in a partial spread is 0."""
    if not d:
        return ""
    return "/".join(str(int(d.get(s) or 0)) for s in STATS)


def dec_stats(s):
    if isinstance(s, dict):
        return {k: int(v) for k, v in s.items()} or None
    s = str(s or "").strip()
    if not s:
        return None
    parts = [p.strip() for p in s.split("/")]
    if len(parts) != 6:
        raise ValueError(f"a spread needs six numbers (HP/Atk/Def/SpA/SpD/Spe): {s!r}")
    return {k: int(float(p or 0)) for k, p in zip(STATS, parts)}


def enc_moves(m):
    return " / ".join(x for x in (m or []) if x)


def dec_moves(s):
    if isinstance(s, list):
        return [x for x in s if x]
    return [x.strip() for x in str(s or "").split(" / ") if x.strip()]


def _blank(v):
    return v is None or v == ""


def _num(v):
    if _blank(v):
        return None
    f = float(v)
    return int(f) if f == int(f) else f


def _bool(v):
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("true", "yes", "1")


def dec_build(row):
    """A My Builds row -> a store build record (version `v` of build `id`)."""
    b = {"id": str(row["id"]), "v": int(_num(row.get("v")) or 1), "provenance": "yours",
         "status": row.get("status") or "saved"}
    for k in BUILD_FIELDS:
        if not _blank(row.get(k)):
            b[k] = _num(row[k]) if k in ("generation", "level") else row[k]
    b["moves"] = dec_moves(row.get("moves"))
    for k in ("ivs", "evs"):
        x = dec_stats(row.get(k))
        if x:
            b[k] = x
    for k in BUILD_TEXT:
        if not _blank(row.get(k)):
            b[k] = str(row[k])
    return b


def enc_build(b):
    row = {"id": b["id"], "v": b.get("v", 1), "status": b.get("status", "saved")}
    for k in BUILD_FIELDS:
        row[k] = b.get(k, "")
    row["moves"] = enc_moves(b.get("moves"))
    row["ivs"], row["evs"] = enc_stats(b.get("ivs")), enc_stats(b.get("evs"))
    for k in BUILD_TEXT:
        row[k] = b.get(k, "")
    return {k: ("" if v is None else v) for k, v in row.items()}


def dec_individual(row):
    i = {"id": str(row["id"]), "status": row.get("status") or "working"}
    for k in IND_FIELDS:
        if not _blank(row.get(k)):
            v = row[k]
            i[k] = _bool(v) if k == "shiny" else _num(v) if k in ("caught_level", "friendship") else v
    hm = dec_moves(row.get("hatch_moves"))
    if hm:
        i["hatch_moves"] = hm
    if not _blank(row.get("at")):
        i["at"] = str(row["at"])
    return i


def enc_individual(i):
    row = {"id": i["id"], "status": i.get("status", "working")}
    for k in IND_FIELDS:
        v = i.get(k)
        row[k] = ("yes" if v else "no") if k == "shiny" and v is not None else v
    row["hatch_moves"] = enc_moves(i.get("hatch_moves"))
    row["at"] = i.get("at", "")
    return {k: ("" if v is None else v) for k, v in row.items()}


TEAM_EXTRA = ("kind", "trainer", "parent", "scenario", "kit", "facility")   # a trainer's version (the Trainer Library); an expedition plan (scenario, kit) or a staff plan (facility), Phase 7


def dec_team(row):
    slots = row.get("slots")
    if isinstance(slots, str):
        slots = json.loads(slots) if slots.strip() else []
    t = {"id": str(row["id"]), "game": row.get("game"), "title": row.get("title") or None,
         "slots": slots or [], "status": row.get("status") or "saved", "origin": "the app (My Teams)"}
    for k in ("note", "at") + TEAM_EXTRA:
        if not _blank(row.get(k)):
            t[k] = str(row[k])
    return t


def dec_gear(row):
    """A My Gear row: one piece of equipment you have in one game (qty 0 = you don't have it any more)."""
    g = {"id": str(row["id"]), "owned": str(row.get("owned", "")).strip().lower() in ("true", "yes", "1")}
    for k in GEAR_FIELDS:
        if not _blank(row.get(k)):
            g[k] = int(float(row[k])) if k == "qty" else str(row[k])
    return g


def enc_gear(g):
    row = {"id": g["id"], "owned": "yes" if g.get("owned") else "no"}
    for k in GEAR_FIELDS:
        row[k] = "" if g.get(k) is None else g[k]
    return row


# --- the snapshot ----------------------------------------------------------------------------------------------
def rows_of(table):
    """A tab's rows as dicts, from either a list of dicts or a values grid whose first row is the header."""
    if not table:
        return []
    if isinstance(table, dict) and "values" in table:
        table = table["values"]
    if isinstance(table[0], dict):
        return table
    head = [str(h).strip() for h in table[0]]
    return [dict(zip(head, r + [""] * (len(head) - len(r)))) for r in table[1:] if any(str(c).strip() for c in r)]


def load(path=SNAPSHOT):
    """Your records from the snapshot: {'builds': {id: [v1, v2…]}, 'individuals': {id: rec}, 'teams': {id: rec}}."""
    out = {"builds": {}, "individuals": {}, "teams": {}, "gear": {}}
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as fh:
        snap = json.load(fh)
    for row in rows_of(snap.get(TABS["build"])):
        b = dec_build(row)
        vs = out["builds"].setdefault(b["id"], {})
        vs[b["v"]] = b                                     # the newest row for a version wins
    out["builds"] = {k: [v[n] for n in sorted(v)] for k, v in out["builds"].items()}
    for row in rows_of(snap.get(TABS["individual"])):
        i = dec_individual(row)
        out["individuals"][i["id"]] = {**out["individuals"].get(i["id"], {}), **i}
    for row in rows_of(snap.get(TABS["team"])):
        t = dec_team(row)
        out["teams"][t["id"]] = t
    for row in rows_of(snap.get(TABS["gear"])):
        g = dec_gear(row)
        out["gear"][g["id"]] = g
    return out


def merge(builds, individuals, teams, mine=None):
    """Your records over the starting ones. A build's newest version becomes its record (with `v` and the earlier
    versions under `versions`); an individual's newest row updates it field by field; new ones are added."""
    mine = mine or load()
    versions = {}
    for bid, vs in mine["builds"].items():
        start = builds.get(bid)
        history = ([dict(start, v=1)] if start and not any(x["v"] == 1 for x in vs) else []) + vs
        cur = dict(history[-1])
        if start:                                           # keep what the starting record knows that a row doesn't
            for k in ("trainers", "origin", "source", "role", "tier"):
                if k in start and k not in cur:
                    cur[k] = start[k]
        cur.setdefault("origin", "the app (My Builds)")
        builds[bid] = cur
        if len(history) > 1:
            versions[bid] = history
    for iid, i in mine["individuals"].items():
        base = individuals.get(iid, {"id": iid, "ribbons": [], "defaults_used": [], "origin_record": "the app (My Pokémon)"})
        individuals[iid] = {**base, **i}
    for tid, t in mine["teams"].items():
        teams[tid] = t
    return versions


def write_snapshot(src, path=SNAPSHOT):
    with open(src, encoding="utf-8") as fh:
        data = json.load(fh)
    snap = {"_note": "A snapshot of the Sheet's My Pokémon, My Builds and My Teams tabs (append-only; the newest row "
                     "wins). Taken with store/personal.py --from; merged by store/migrate.py. Don't edit by hand."}
    for tab in TABS.values():
        snap[tab] = rows_of(data.get(tab))
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(snap, fh, ensure_ascii=False, indent=1)
    mine = load(path)
    print(f"{path}: {sum(len(v) for v in mine['builds'].values())} build versions, {len(mine['individuals'])} "
          f"individuals, {len(mine['teams'])} teams")


def fixture(path):
    """Rows and what each decodes to, for the browser's format test."""
    b = {"id": "yours:Larvitar-test", "v": 2, "status": "saved", "species": "Larvitar", "generation": 4, "game": "heartgold",
         "level": 100, "nature": "Adamant", "ability": "Guts", "item": "", "moves": ["Dragon Dance", "Stone Edge", "Crunch", "Earthquake"],
         "ivs": {s: 31 for s in STATS}, "evs": {"hp": 4, "atk": 252, "def": 0, "spa": 0, "spd": 0, "spe": 252},
         "name": "", "note": "more speed", "parent": "yours:heartgold/Tyranitar@1", "individual": "me:heartgold/Larvitar-test", "at": "2026-10-24T12:00:00Z",
         "kind": "blueprint", "purpose": "competitive", "labels": "dragon dance, mixed"}
    i = {"id": "me:heartgold/Larvitar-test", "status": "working", "species": "Larvitar", "game": "heartgold", "nickname": "Pebble",
         "gender": "F", "shiny": True, "form": None, "ball": "Heavy Ball", "build": "yours:Larvitar-test", "met_location": None,
         "caught_level": 5, "friendship": None, "origin": "hatched", "note": None, "at": "2026-10-24T12:00:00Z",
         "hatch_moves": ["Bite", "Leer", "Dragon Dance", "Outrage"], "sire": "S-TYRANITAR", "dam": "D-TYRANITAR",
         "blueprint": "yours:Larvitar-test"}
    g = {"id": "heartgold:super-rod", "owned": True, "item": "super-rod", "game": "heartgold", "qty": 1, "note": "from the Route 12 fisherman", "at": "2026-10-24T12:00:00Z"}
    rows = {"build": enc_build(b), "individual": enc_individual(i), "gear": enc_gear(g),
            "blank_spread": {"id": "yours:x", "v": 1, "species": "Snorlax", "moves": "Body Slam / Rest", "ivs": "", "evs": ""}}
    out = {"rows": rows, "decoded": {"build": dec_build(rows["build"]), "individual": dec_individual(rows["individual"]),
                                     "blank_spread": dec_build(rows["blank_spread"]), "gear": dec_gear(rows["gear"])},
           "stats": {"enc": enc_stats({"atk": 252, "spe": 252, "hp": 4}), "dec": dec_stats("4/252/0/0/0/252")}}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1, sort_keys=True)


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--from":
        write_snapshot(sys.argv[2])
    elif len(sys.argv) > 2 and sys.argv[1] == "--fixture":
        fixture(sys.argv[2])
    else:
        print(__doc__)
