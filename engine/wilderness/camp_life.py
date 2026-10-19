"""Camp life (D-034): what a team can eat, grow and cook in its game, and who on the team helps.

The game's food systems come from camp_life.json (editable) and are checked against PokeAPI items.
The team side comes from the wilderness engine's evidence (foraging, food_source, cooking, heat_source).
What the team actually eats is authored per team; this only lays out the options.
"""
import json
import os

import rules
from wilderness.engine import TIER_RANK

CATALOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "camp_life.json")
FOOD_CAPS = ("foraging", "food_source", "cooking", "heat_source")


class CampLife:
    def __init__(self, wild, path=CATALOG_FILE):
        self.wild = wild
        self.ref = wild.ref
        with open(path, encoding="utf-8") as fh:
            self.catalog = json.load(fh)

    def item_gens(self, identifier):
        return sorted(int(r[0]) for r in self.ref.q(
            "SELECT x.generation_id FROM item_game_indices x JOIN items i ON i.id=x.item_id WHERE i.identifier=?",
            identifier))

    def berries(self, game):
        """Every berry that exists in the game's generation (Gen 2 under its own names)."""
        gen = rules.GAME_GEN[game]
        rows = self.ref.q("""SELECT i.identifier FROM items i JOIN item_game_indices x ON x.item_id=i.id
            WHERE x.generation_id=? AND i.identifier LIKE '%-berry' ORDER BY CAST(x.game_index AS INT)""", gen)
        names = self.catalog["gen2_berry_names"] if gen == 2 else {}
        return [names.get(r[0], r[0].replace("-berry", "").title() + " Berry") for r in rows]

    def systems(self, game):
        gen = rules.GAME_GEN[game]
        out = []
        for s in self.catalog["systems"]:
            if game not in s["games"]:
                continue
            missing = [i for i in s["items"] if gen not in self.item_gens(i)]
            out.append({**s, "items_missing_in_gen": missing})
        return out

    def team(self, team):
        """The game's food systems plus each member's food-related evidence (best tier per capability)."""
        helpers = {c: [] for c in FOOD_CAPS}
        for m in team.members:
            best = {}
            for e in self.wild.evidence(m.species, team.game):
                if e.capability in FOOD_CAPS and (e.capability not in best
                                                  or TIER_RANK[e.tier] > TIER_RANK[best[e.capability].tier]):
                    best[e.capability] = e
            for c, e in best.items():
                helpers[c].append(f"{m.species} ({e.tier}: {e.source})")
        return {"game": team.game, "systems": self.systems(team.game), "berries": len(self.berries(team.game)),
                "helpers": helpers, "open": [c for c in FOOD_CAPS if not helpers[c]]}
