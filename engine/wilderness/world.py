"""The authored world: Zack's approved facts about how companions live, fed to the wilderness
engine as its top evidence tier.

Each record is a statement about one companion (game + species) filling one capability.
  proposed  -> shown as a proposal, never counted as coverage
  approved  -> becomes `authored` evidence; requires a decision ID (only Zack approves)
  rejected  -> kept with its reason, so the path taken stays visible
The file (canon/world.json) is the engine-side copy; the Drive Canon Sheet is its home (D-025).
"""
import json
import os

from wilderness.engine import ALL_CAPS, Evidence

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PATH = os.path.join(os.path.dirname(HERE), "canon", "world.json")


class WorldStore:
    def __init__(self, path=DEFAULT_PATH):
        self.path = path
        self.data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {"records": []}

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as fh:
            json.dump(self.data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")

    def propose(self, game, species, capability, statement, source, note=""):
        if capability not in ALL_CAPS:
            raise ValueError(f"unknown capability {capability}")
        rid = f"W-{len(self.data['records']) + 1:03d}"
        self.data["records"].append({"id": rid, "game": game, "species": species, "capability": capability,
                                     "statement": statement, "source": source, "note": note,
                                     "status": "proposed", "decision": None})
        return rid

    def decide(self, ids, status, decision, reason=""):
        """Approve or reject records. A decision ID from the ledger is required."""
        if status not in ("approved", "rejected") or not decision:
            raise ValueError("needs status approved/rejected and a decision ID")
        for r in self.data["records"]:
            if r["id"] in ids:
                r.update(status=status, decision=decision, reason=reason)

    def authored(self):
        """{(game, species): [Evidence]} for the wilderness engine (approved records only)."""
        out = {}
        for r in self.data["records"]:
            if r["status"] == "approved":
                out.setdefault((r["game"], r["species"]), []).append(
                    Evidence(r["capability"], "authored", f"{r['id']} ({r['decision']})", r["statement"]))
        return out

    def proposals(self, game=None):
        return [r for r in self.data["records"] if r["status"] == "proposed" and (game is None or r["game"] == game)]

    def suggest(self, team, wilderness):
        """Candidate world facts worth authoring: lore/inference evidence on capabilities the team
        has no game-backed or authored holder for."""
        report = wilderness.team_report(team)
        weak = {c for c, v in report["capabilities"].items() if v["strength"] in ("lore only", "inference only")}
        taken = {(r["species"], r["capability"]) for r in self.data["records"] if r["game"] == team.game}
        out = []
        for sp, evs in report["evidence"].items():
            for e in evs:
                if e.capability in weak and (sp, e.capability) not in taken and e.tier in ("lore", "inference"):
                    out.append({"species": sp, "capability": e.capability, "basis": f"{e.tier}: {e.source}",
                                "detail": e.detail})
        return out
