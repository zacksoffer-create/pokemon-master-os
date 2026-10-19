"""Run the reference engine over legacy 'Canon Builds' rows and report defects.

Usage: python3 -I legacy_audit.py <scripts_dir> <db.sqlite> <canon_builds.csv>
Reads the CSV as untrusted data; never writes back to it.
"""
import csv
import re
import sys

sys.path.insert(0, sys.argv[1])
from refdb import Ref, VG, VG_GEN, slug  # noqa: E402

r = Ref(sys.argv[2])
GAME_VERSION = {"crystal": "crystal", "firered": "firered", "emerald": "emerald", "platinum": "platinum",
                "heartgold": "heartgold", "soulsilver": "soulsilver"}


def game_of(cell):
    g = cell.split("(")[0].strip().lower()
    return g if g in VG else None


def encounter_levels(species, version, location):
    """(min, max) wild levels for the species' family at a location in a version, or None."""
    loc = slug(re.sub(r"\(.*?\)", "", location)).replace("mt-", "mt-")
    fam = ",".join(str(s) for s in r.family(r.species_id(species)))
    rows = r.q(f"""
        SELECT MIN(e.min_level) lo, MAX(e.max_level) hi FROM encounters e
        JOIN versions v ON v.id=e.version_id JOIN location_areas la ON la.id=e.location_area_id
        JOIN locations l ON l.id=la.location_id
        WHERE v.identifier=? AND e.pokemon_id IN ({fam}) AND
              (l.identifier=? OR l.identifier LIKE ? OR l.identifier LIKE ?)""",
               version, loc, f"%-{loc}", f"{loc}%")
    lo, hi = rows[0]["lo"], rows[0]["hi"]
    return None if lo is None else (int(lo), int(hi))


rows = list(csv.DictReader(open(sys.argv[3], encoding="utf-8")))
for i, row in enumerate(rows, start=2):
    sp, g = row["Pokémon"].strip(), game_of(row["Game"])
    moves = [row[f"Move {k}"].strip() for k in range(1, 5) if row[f"Move {k}"].strip()]
    if not g or not moves:
        continue
    vg, gen = VG[g], VG_GEN[VG[g]]
    issues = []
    try:
        sid = r.species_id(sp)
    except KeyError:
        print(f"row {i:>2} {sp}: UNKNOWN SPECIES")
        continue
    if slug(sp) != r.q("SELECT identifier FROM pokemon_species WHERE id=?", sid)[0][0]:
        issues.append(f"misspelled species '{sp}'")
    if row["Nature"].strip() != row["Nature"] and row["Nature"].strip():
        issues.append(f"whitespace in nature '{row['Nature']}'")
    ab = row["Ability"].strip()
    if gen == 2 and (ab or row["Nature"].strip()):
        issues.append("Gen 2 row has nature/ability (neither exists in Gen 2)")
    elif ab and ab not in r.abilities(sp, gen):
        issues.append(f"ability '{ab}' not available in Gen {gen} (has {r.abilities(sp, gen)})")
    egg_only = []
    for mv in moves:
        try:
            res = r.learn(sp, mv, vg)
        except KeyError:
            issues.append(f"unknown move '{mv}'")
            continue
        native = {m for k, _, m, _, _ in res["routes"] if k == "native"}
        any_gen = {m for k, _, m, _, _ in res["routes"] if k in ("native", "same-gen trade")}
        if not res["move_exists"]:
            issues.append(f"{mv}: move doesn't exist in Gen {gen}")
        elif not native and not any_gen:
            issues.append(f"{mv}: NOT LEARNABLE in {g}")
        elif not native:
            issues.append(f"{mv}: only via another Gen {gen} game")
        elif any_gen <= {"egg", "light-ball-egg"}:
            egg_only.append(mv)
    loc, lvl = row["Encounter Location"].strip(), row["Encounter Level"].strip()
    bred = "egg" in loc.lower() or lvl == "1"
    if egg_only and loc and not bred:
        issues.append(f"egg-only move(s) {egg_only} on a non-bred encounter ('{loc}', Lv {lvl}) — impossible as recorded")
    if loc and not bred and loc.lower() not in ("starter",) and "town" not in loc.lower():
        lv = encounter_levels(sp, GAME_VERSION[g], loc)
        if lv is None:
            issues.append(f"'{loc}' has no wild {sp}-line in {g} data (wrong game? exclusive? gift?)")
        elif lvl and not (lv[0] <= int(lvl) <= lv[1]):
            issues.append(f"met Lv {lvl} outside {loc} wild range {lv[0]}–{lv[1]}")
    if row["IV Notes"].strip() == "31/31/31/31/31/31" and not bred:
        issues.append("6×31 IVs on a non-egg encounter (PID/IV-coupled in Gen 3–4; verify in PKHeX)")
    tag = "OK" if not issues else f"{len(issues)} issue(s)"
    print(f"row {i:>2} {g:<10} {sp:<11} {tag}")
    for s in issues:
        print(f"         - {s}")
