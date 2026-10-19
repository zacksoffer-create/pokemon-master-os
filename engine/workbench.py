"""Workbench: run every engine over a team, and show exactly what changes when one team
becomes another (the backbone of the pair/trio conversations)."""
import rules
from battle.engine import BattleEngine
from breeding.engine import BreedingEngine
from wilderness.engine import WildernessEngine


class Workbench:
    def __init__(self, db_path, authored=None):
        self.battle = BattleEngine(db_path)
        self.breeding = BreedingEngine(db_path)
        self.wild = WildernessEngine(db_path, authored)

    def analyze(self, team):
        return {"battle": self.battle.report(team), "wilderness": self.wild.team_report(team),
                "breeding": {m.species: self.breeding.feasibility(m.species, team.game) for m in team.members}}

    def diff(self, before, after):
        """What changes, engine by engine, when `before` becomes `after` (same game)."""
        a, b = self.analyze(before), self.analyze(after)
        out = {"members": {"out": sorted({m.species for m in before.members} - {m.species for m in after.members}),
                           "in": sorted({m.species for m in after.members} - {m.species for m in before.members})}}
        # battle: weaknesses and resistances per attacking type
        defense = []
        for t in rules.TYPES:
            wa, wb = len(a["battle"]["defense"]["weak"][t]), len(b["battle"]["defense"]["weak"][t])
            ra = len(a["battle"]["defense"]["resist"][t]) + len(a["battle"]["defense"]["immune"][t])
            rb = len(b["battle"]["defense"]["resist"][t]) + len(b["battle"]["defense"]["immune"][t])
            if (wa, ra) != (wb, rb):
                defense.append(f"{t}: weak {wa}->{wb}, resist/immune {ra}->{rb}")
        out["defense"] = defense
        sea, seb = set(a["battle"]["coverage"]["super_effective"]), set(b["battle"]["coverage"]["super_effective"])
        out["coverage"] = {"gained_SE": sorted(seb - sea), "lost_SE": sorted(sea - seb)}
        pa, pb = a["battle"]["playbook"], b["battle"]["playbook"]
        out["playbook"] = {"roles_gained": [r for r in pb if pb[r] and not pa[r]],
                           "roles_lost": [r for r in pa if pa[r] and not pb[r]]}
        # wilderness: capability strength and scenario readiness
        ca, cb = a["wilderness"]["capabilities"], b["wilderness"]["capabilities"]
        def game_backed(cap):   # holders whose evidence is the cartridge itself (or authored canon)
            return sorted(sp for sp, src in cap["holders"].items() if src.split(":")[0] in ("cartridge", "authored"))
        out["capabilities"] = []
        for c in sorted(ca):
            ha, hb = game_backed(ca[c]), game_backed(cb[c])
            if ca[c]["strength"] != cb[c]["strength"] or ha != hb:
                out["capabilities"].append(f"{c}: {ca[c]['strength']} -> {cb[c]['strength']} "
                                           f"(game-backed holders {len(ha)}->{len(hb)}: {', '.join(hb) or 'none'})")
        sa, sb = a["wilderness"]["scenarios"], b["wilderness"]["scenarios"]
        out["scenarios"] = {s: {"ready": f"{len(sa[s]['ready'])}->{len(sb[s]['ready'])}",
                                "gaps_now": sb[s]["gaps"]}
                            for s in sa if (sa[s]["ready"], sa[s]["gaps"]) != (sb[s]["ready"], sb[s]["gaps"])}
        return out
