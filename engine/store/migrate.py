"""The three-tier record store (docs/design/FOUR_LABS.md §1-2), migrated from the five places builds live today.

    python3 -I engine/store/migrate.py        # writes engine/store/out/{builds,individuals,teams,lines}.json + MIGRATION.md

Tiers:
- **species**: not stored. Base stats, types, sprite, height, weight and move pool come from the reference data.
- **build** (the variant): moveset, nature, IVs, EVs, held item and ability, plus its provenance:
  `yours` · `canonical` (a trainer's, from the show or the games) · `stock` · `ingested` (Showdown, Bulbapedia) ·
  `competitive` (Smogon's usage sets).
- **individual** (one of Zack's own Pokémon): its build, nickname, ball, met location, caught level, friendship, shiny,
  gender, each defaulted when nothing's on record (Zack, 2026-10-20: Poké Ball, the normal found location and level
  range, not shiny, male), and every default named in `defaults_used`.

Nothing in canon/ is written: the old homes stay exactly as they are, and this store is rebuilt from them. Your own
records made in the app (store/personal.json, a snapshot of the Sheet's My Pokémon / My Builds / My Teams tabs, D-065,
D-066) are merged on top: a build's newest version is its record, earlier versions go under `versions`
(docs/design/DATA_CONTRACT.md). EVs stay blank when nothing's recorded (Zack: blank means untouched).
"""
import hashlib
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
ROOT = os.path.dirname(ENGINE)
CANON = os.path.join(ENGINE, "canon")
OUT = os.path.join(HERE, "out")
DB = os.path.join(ENGINE, "data", "pokeref.sqlite")
sys.path.insert(0, ENGINE)

import rules  # noqa: E402

GAME_GEN = rules.GAME_GEN
GAME_OF_GEN = {2: "crystal", 3: "emerald", 4: "platinum"}
BUILD_FIELDS = ("species", "generation", "game", "moves", "nature", "ability", "item", "ivs", "evs", "level")
DEFAULTS = {"ball": "Poké Ball", "shiny": False}


def load(name):
    with open(os.path.join(CANON, name), encoding="utf-8") as fh:
        return json.load(fh)


def content_key(b):
    return json.dumps({k: b.get(k) for k in BUILD_FIELDS if k not in ("game",)}, sort_keys=True)


class Ref:
    def __init__(self):
        self.db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)

    def q(self, sql, *a):
        return self.db.execute(sql, a).fetchall()

    def species_id(self, name):
        from refdb import Ref as R
        if not hasattr(self, "_r"):
            self._r = R(DB)
        return self._r.species_id(name)

    def line_down(self, sid):
        """The species and its pre-evolutions, latest stage first."""
        out = [sid]
        while True:
            r = self.q("SELECT evolves_from_species_id FROM pokemon_species WHERE id=?", out[-1])
            if not r or not r[0][0]:
                return out
            out.append(int(r[0][0]))

    def name(self, sid):
        r = self.q("SELECT name FROM pokemon_species_names WHERE pokemon_species_id=? AND local_language_id=9", sid)
        return r[0][0] if r else str(sid)

    def met(self, species, game):
        """Where and at what levels this line is found wild in the game: the latest stage that's found wild."""
        version = {"heartgold": "heartgold", "soulsilver": "soulsilver"}.get(game, game)
        for sid in self.line_down(self.species_id(species)):
            rows = self.q("""SELECT COALESCE(ln.name, l.identifier), MIN(CAST(e.min_level AS INT)), MAX(CAST(e.max_level AS INT))
                FROM encounters e JOIN versions v ON v.id=e.version_id JOIN location_areas la ON la.id=e.location_area_id
                JOIN locations l ON l.id=la.location_id LEFT JOIN location_names ln ON ln.location_id=l.id AND ln.local_language_id=9
                WHERE e.pokemon_id=? AND v.identifier=? GROUP BY l.id ORDER BY MIN(CAST(e.min_level AS INT)), 1""", sid, version)
            if rows:
                loc, lo, hi = rows[0]
                return {"met_as": self.name(sid), "met_location": loc, "caught_level": lo, "level_range": [lo, hi],
                        "other_locations": [r[0] for r in rows[1:6]]}
        base = self.line_down(self.species_id(species))[-1]
        return {"met_as": self.name(base), "met_location": None, "caught_level": None, "level_range": None,
                "other_locations": [], "note": f"PokeAPI has no wild encounter for this line in {game} (a starter, gift, trade or egg, or a gap in PokeAPI)"}

    def gender_default(self, species):
        r = self.q("SELECT gender_rate FROM pokemon_species WHERE id=?", self.species_id(species))
        rate = int(r[0][0]) if r else 4
        return "genderless" if rate == -1 else "F" if rate == 8 else "M"


def bid(prefix, *parts):
    return prefix + ":" + "/".join(str(p) for p in parts)


def migrate():
    ref = Ref()
    builds, individuals, teams, lines, aliases, report = {}, {}, {}, [], {}, []
    seen = {}

    def add(b, origin):
        b = {k: v for k, v in b.items() if v not in (None, [], {}, "")}
        key = content_key(b) + "|" + b["provenance"]
        if key in seen and b["provenance"] in ("ingested", "competitive"):
            first = seen[key]
            builds[first].setdefault("also_from", []).append(origin)
            aliases[b["id"]] = first
            return first
        seen.setdefault(key, b["id"])
        b["origin"] = origin
        builds[b["id"]] = b
        return b["id"]

    # 1. the journey: canon/builds.json -> your builds, and every rostered companion -> an individual
    rosters, jb = load("rosters.json"), load("builds.json")
    for ch in rosters["chapters"]:
        game, gen = ch["game"], GAME_GEN[ch["game"]]
        for sp in ch["roster"]:
            b = (jb.get(game) or {}).get(sp)
            build_id = None
            if b:
                build_id = add({"id": bid("yours", game, sp), "species": sp, "generation": gen, "game": game,
                                "moves": b.get("moves"), "nature": b.get("nature"), "ability": b.get("ability"),
                                "item": b.get("item"), "provenance": "yours", "status": b.get("status"),
                                "notes": [x for x in (b.get("nature_note") and f"nature: {b['nature_note']}",
                                                      b.get("rejected") and f"rejected: {', '.join(b['rejected'])}") if x]},
                               f"canon/builds.json {game}.{sp}")
            met = ref.met(sp, game)
            used = ["ball (Poké Ball)", "shiny (no)", "friendship (base)"]
            gender = ref.gender_default(sp)
            used.append(f"gender ({gender})")
            if met["met_location"]:
                used.append(f"met location and level (found wild as {met['met_as']})")
            iid = bid("me", game, sp)
            individuals[iid] = {"id": iid, "species": sp, "game": game, "chapter": ch.get("order"), "build": build_id,
                                "nickname": None, "ball": DEFAULTS["ball"], "shiny": DEFAULTS["shiny"], "gender": gender,
                                "friendship": None, "ribbons": [], **met, "defaults_used": used,
                                "no_build_note": None if build_id else "no build on record (the engines fill its moves until one is)",
                                "status": ch.get("status")}
    # 2. lineups.json characters -> your builds (historical); variations -> saved team drafts
    lu = load("lineups.json")
    for cid, c in lu["characters"].items():
        add({"id": bid("yours", "lineup", cid), "species": c["species"], "generation": None, "moves": c.get("moves"),
             "nature": c.get("nature"), "item": c.get("item"), "ability": c.get("ability"), "provenance": "yours",
             "status": "historical", "source": c.get("source")}, f"canon/lineups.json characters.{cid}")
    for v in lu["variations"]:
        teams[v["id"]] = {"id": v["id"], "title": v.get("title"), "base": v.get("base"), "why": v.get("why"),
                          "change": v.get("change") or v.get("swap") or v.get("members"), "origin": "canon/lineups.json variations"}
    # 3. build_library.json -> stock, canonical (anime trainers' builds), ingested (film, Bulbapedia)
    lib = load("build_library.json")["builds"]
    owner = {}
    for tid, t in load("trainers.json")["trainers"].items():
        for vid, v in t["versions"].items():
            for b in (v.get("team") or {}).get("builds", []):
                owner.setdefault(b, []).append(f"{tid}/{vid}")
    for lid, b in lib.items():
        src = b.get("source", "")
        prov = "stock" if src.startswith("stock") else "canonical" if src.startswith("anime") else "ingested"
        add({"id": lid, "species": b["species"], "generation": b.get("generation"), "moves": b.get("moves"),
             "nature": b.get("nature"), "ability": b.get("ability"), "item": b.get("item"), "ivs": b.get("ivs"),
             "evs": b.get("evs"), "level": b.get("level"), "name": b.get("name"), "role": b.get("role"),
             "provenance": prov, "trainers": owner.get(lid), "status": b.get("status"), "source": src,
             "tier": b.get("tier"), "notes": b.get("notes")}, f"canon/build_library.json {lid}")
    # 4. competitive: Smogon's usage sets (@smogon/sets 2.0.0 stats), every set per species and format
    from battle.knowledge import SMOGON
    for gen in (2, 3, 4):
        path = os.path.join(SMOGON, f"gen{gen}_usage_sets.json")
        if not os.path.exists(path):
            report.append(f"competitive sets for Gen {gen}: {path} is missing (run fetch_reference.py)")
            continue
        with open(path, encoding="utf-8") as fh:
            book = json.load(fh)
        for fmt, species in sorted(book.items()):
            for sp, sets in sorted(species.items()):
                for sname, s in sorted(sets.items()):
                    h = hashlib.sha1(f"{fmt}|{sp}|{sname}".encode()).hexdigest()[:8]
                    add({"id": f"competitive:{fmt}/{rules.to_id(sp)}-{h}", "species": rules.species(gen, sp)["name"],
                         "generation": gen, "moves": list(s.get("moves") or []), "nature": s.get("nature"),
                         "ability": s.get("ability"), "item": s.get("item"), "ivs": s.get("ivs"), "evs": s.get("evs"),
                         "level": s.get("level"), "name": sname, "provenance": "competitive",
                         "source": f"@smogon/sets 2.0.0 stats, {fmt}"}, f"data/raw/smogon/gen{gen}_usage_sets.json {fmt}.{sp}.{sname}")
    # 5. ranch.json breeding_program -> lines that point at a target build instead of copying its moves
    for x in load("ranch.json")["breeding_program"]:
        target = bid("yours", x["game"], x["species"])
        lines.append({"species": x["species"], "game": x["game"], "egg_moves": x["moves"],
                      "target_build": target if target in builds else None, "source": x.get("source"),
                      "origin": "canon/ranch.json breeding_program"})
    # 6. your records from the app (the Sheet's My Pokémon / My Builds / My Teams, snapshot in store/personal.json)
    from store import personal
    mine = personal.load()
    versions = personal.merge(builds, individuals, teams, mine)
    n = sum(len(v) for v in mine["builds"].values())
    if n or mine["individuals"] or mine["teams"]:
        report.append(f"your records from the app: {n} build versions, {len(mine['individuals'])} individuals, "
                      f"{len(mine['teams'])} teams (store/personal.json)")
    return builds, individuals, teams, lines, aliases, report, versions


def write():
    builds, individuals, teams, lines, aliases, report, versions = migrate()
    os.makedirs(OUT, exist_ok=True)
    note = "Generated by engine/store/migrate.py from canon/ (read-only). Do not edit by hand: edit canon, then rerun."
    for name, data in (("builds", {"_note": note, "builds": builds, "aliases": aliases, "versions": versions}),
                       ("individuals", {"_note": note, "individuals": individuals}),
                       ("teams", {"_note": note, "teams": teams}), ("lines", {"_note": note, "lines": lines})):
        with open(os.path.join(OUT, f"{name}.json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=1, ensure_ascii=False, sort_keys=True)
    from collections import Counter
    prov = Counter(b["provenance"] for b in builds.values())
    lib = load("build_library.json")["builds"]
    jb = load("builds.json")
    n_journey = sum(len(v) for k, v in jb.items() if not k.startswith("_"))
    no_build = [i for i in individuals.values() if not i["build"]]
    lines_md = ["# Store migration report", "", note, "",
                "| From | Records | Became |", "|---|---|---|",
                f"| canon/builds.json | {n_journey} builds | `yours:<game>/<species>` builds |",
                f"| canon/rosters.json | {len(individuals)} companions | `me:<game>/<species>` individuals ({len(no_build)} with no build yet) |",
                f"| canon/lineups.json | {len(load('lineups.json')['characters'])} characters, {len(teams)} variations | `yours:lineup/<id>` builds, saved team drafts |",
                f"| canon/build_library.json | {len(lib)} builds | stock / canonical / ingested builds (exact duplicates merged: {len(aliases)}) |",
                f"| @smogon/sets 2.0.0 | {prov.get('competitive', 0)} sets | `competitive:<format>/<species>` builds |",
                f"| canon/ranch.json breeding_program | {len(lines)} lines | lines that point at their target build |", "",
                "Builds by provenance: " + ", ".join(f"{k} {v}" for k, v in sorted(prov.items())), "",
                "Merged duplicates (the second id now points at the first):", ""]
    lines_md += [f"- `{a}` → `{b}`" for a, b in sorted(aliases.items())] or ["- none"]
    lines_md += ["", "Companions with no build on record (shown as such, never silently filled):", ""]
    lines_md += [f"- {i['game']} {i['species']}" for i in sorted(no_build, key=lambda i: (i["game"], i["species"]))]
    lines_md += ["", "Defaults every individual got (Zack, 2026-10-20): Poké Ball; not shiny; male where the species can "
                 "be male; met where the line is first found wild in that game, at the lowest level there; friendship "
                 "left at the species' base. Each individual lists its own in `defaults_used`.", ""] + \
                [f"- note: {r}" for r in report]
    with open(os.path.join(OUT, "MIGRATION.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines_md) + "\n")
    print(f"{len(builds)} builds ({dict(prov)}), {len(individuals)} individuals, {len(teams)} team drafts, {len(lines)} lines, "
          f"{len(aliases)} duplicates merged")


if __name__ == "__main__":
    write()
