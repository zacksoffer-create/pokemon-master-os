"""Regression tests: every verified fact the engines rely on. Run from engine/:
    python3 -I -m unittest discover -s tests -v
Needs engine/data/pokeref.sqlite (python3 -I fetch_reference.py) and battle/node_modules (npm ci)."""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)
DB = os.path.join(ENGINE, "data", "pokeref.sqlite")

import rules  # noqa: E402
from team import Member, Team  # noqa: E402

HEARTGOLD = ["Typhlosion", "Tyranitar", "Mamoswine", "Crobat", "Lapras", "Snorlax"]
CRYSTAL = ["Feraligatr", "Miltank", "Donphan", "Ampharos", "Umbreon", "Espeon"]
PLATINUM = ["Infernape", "Weavile", "Roserade", "Lucario", "Garchomp", "Magnezone"]


class Rules(unittest.TestCase):
    def test_gen2_to_5_chart_keeps_steel_resisting_ghost_and_dark(self):
        for gen in (2, 3, 4):
            self.assertEqual(rules.effectiveness(gen, "Ghost", ["Steel"]), 0.5)
            self.assertEqual(rules.effectiveness(gen, "Dark", ["Steel"]), 0.5)

    def test_category_is_type_based_before_gen4(self):
        self.assertEqual(rules.category(3, "Crunch"), "Special")
        self.assertEqual(rules.category(4, "Crunch"), "Physical")
        self.assertEqual(rules.category(3, "Shadow Ball"), "Physical")
        self.assertEqual(rules.category(2, "Thunder Wave"), "Status")

    def test_levitate_and_era_abilities(self):
        self.assertEqual(rules.effectiveness(4, "Ground", ["Ghost", "Poison"], "Levitate"), 0)
        self.assertEqual(rules.effectiveness(3, "Electric", ["Water"], "Motor Drive"), 2)   # Gen 4 ability
        self.assertEqual(rules.abilities(2, "Typhlosion"), [])

    def test_era_base_stats(self):
        self.assertEqual(rules.species(2, "Ampharos")["bs"]["def"], 75)
        self.assertEqual(rules.species(4, "Roserade")["bs"]["def"], 55)


@unittest.skipUnless(os.path.exists(DB), "reference DB not built")
class Engines(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from battle.engine import BattleEngine
        from breeding.engine import BreedingEngine
        from refdb import Ref
        from wilderness.engine import WildernessEngine
        cls.ref, cls.battle = Ref(DB), BattleEngine(DB)
        cls.breed, cls.wild = BreedingEngine(DB), WildernessEngine(DB)

    # learnability (D-024 gate) and mechanics findings
    def test_learnability_facts(self):
        self.assertTrue(self.ref.egg_move_of("Typhlosion", "Extrasensory", 10))
        self.assertFalse(self.ref.learn("Garchomp", "Fly", 9)["routes"])
        self.assertFalse(self.ref.learn("Feraligatr", "Waterfall", 4)["routes"])
        self.assertTrue(self.ref.learn("Feraligatr", "Waterfall", 6)["routes"])
        swinub_only = {st for k, st, m, l, v in self.ref.learn("Mamoswine", "Ice Shard", 10)["routes"] if k == "native"}
        self.assertEqual(swinub_only, {"Swinub"})

    def test_acquisition_facts(self):
        self.assertEqual(self.ref.wild_in("Mareep", "crystal"), [])
        self.assertEqual(self.ref.wild_in("Growlithe", "emerald"), [])
        self.assertEqual(self.ref.wild_in("Vulpix", "heartgold"), [])

    # battle engine
    def test_defense_pairs(self):
        d = self.battle.defense(Team.of("soulsilver", ["Dragonite", "Empoleon"]))
        shared = [t for t in rules.TYPES if len(d["weak"][t]) == 2]
        self.assertEqual(shared, [])
        g = self.battle.defense(Team.of("soulsilver", ["Gengar"]))
        self.assertIn("Gengar", g["immune"]["Ground"])

    def test_heartgold_fighting_weakness(self):
        d = self.battle.defense(Team.of("heartgold", HEARTGOLD))
        self.assertEqual(len(d["weak"]["Fighting"]), 4)

    def test_damage_calc_bridge(self):
        r = self.battle.damage([{"gen": 3, "attacker": {"species": "Absol", "nature": "Adamant", "evs": {"atk": 252}},
                                 "defender": {"species": "Swampert"}, "move": "Crunch"}])[0]
        self.assertIn("SpA Absol", r["desc"])   # Gen 3 Crunch uses Special Attack

    # breeding engine
    def test_riolu_bundle_regression(self):
        self.assertIn("Machop", self.breed.bundle("Lucario", ["Vacuum Wave", "Cross Chop"], "heartgold")["fathers"])

    def test_feasibility(self):
        self.assertFalse(self.breed.feasibility("Tauros", "heartgold")["egg_moves_possible"])
        self.assertFalse(self.breed.feasibility("Magnezone", "platinum")["egg_moves_possible"])

    def test_milotic_teaches_refresh(self):
        fathers = {f for ch in self.ref.chain("Swampert", "Refresh", 6)["chains"] for f, _, _ in ch["path"][:1]}
        self.assertIn("Milotic", fathers)

    # wilderness engine (field functions)
    def test_field_function_gaps(self):
        def holders(team, cap):
            r = self.wild.team_report(team)["capabilities"][cap]["holders"]
            return sorted(s for s, src in r.items() if src.startswith("cartridge"))
        self.assertEqual(holders(Team.of("crystal", CRYSTAL), "air_travel"), [])
        self.assertEqual(holders(Team.of("platinum", PLATINUM), "air_travel"), [])
        self.assertEqual(holders(Team.of("heartgold", HEARTGOLD), "air_travel"), ["Crobat"])
        self.assertIn("Miltank", holders(Team.of("crystal", CRYSTAL), "field_healing"))

    # benchmarks (opponent teams straight from the games' code)
    def test_benchmarks_load_every_game(self):
        from battle.benchmarks import Benchmarks
        bm = Benchmarks(DB, self.battle)
        hg = {s["name"]: s for s in bm.load("heartgold")}
        red = hg["Red"]["party"]
        self.assertEqual((red[0]["species"], red[0]["level"], red[0]["item"]), ("Pikachu", 88, "lightball"))
        self.assertIn("Volt Tackle", red[0]["moves"])
        lance = {s["name"]: s for s in bm.load("crystal")}["Champion Lance"]["party"]
        self.assertEqual(sum(p["species"] == "Dragonite" for p in lance), 3)
        self.assertEqual(lance[0]["ivs"]["atk"], 26)            # Crystal Champion class DVs 13/12/13/13
        self.assertIn("Garchomp", [p["species"] for p in {s["name"]: s for s in bm.load("platinum")}["Champion Cynthia"]["party"]])
        self.assertIn("Milotic", [p["species"] for p in {s["name"]: s for s in bm.load("emerald")}["Champion Wallace"]["party"]])
        self.assertEqual(len([s for s in bm.load("firered") if s["name"].startswith("Champion")]), 3)

    def test_default_moves_are_last_four_level_up(self):
        from battle.benchmarks import Benchmarks
        self.assertEqual(Benchmarks(DB, self.battle).default_moves("Pidgey", "heartgold", 5), ["Tackle", "Sand Attack"])

    def test_matchup_grid(self):
        from battle.benchmarks import Benchmarks
        bm = Benchmarks(DB, self.battle)
        red = {s["name"]: s for s in bm.load("heartgold")}["Red"]
        r = bm.matchups(Team.of("heartgold", HEARTGOLD), red)
        self.assertEqual(len(r["grid"]), 6)
        self.assertEqual(r["our_level"], 88)
        cell = r["grid"][0]["vs"]["Mamoswine"]                  # Ground-type: Volt Tackle can't touch it
        self.assertNotIn("Volt Tackle", cell["they_hit"])

    # authored world
    def test_world_needs_a_decision_and_preview_saves_nothing(self):
        import tempfile
        from wilderness.world import WorldStore
        path = os.path.join(tempfile.mkdtemp(), "world.json")
        ws = WorldStore(path)
        rid = ws.propose("heartgold", "Typhlosion", "heat_source", "the camp's fire", "test")
        with self.assertRaises(ValueError):
            ws.decide([rid], "approved", decision=None)
        self.assertEqual(ws.authored(), {})
        ws.decide([rid], "approved", decision="D-TEST")
        self.assertEqual(ws.authored()[("heartgold", "Typhlosion")][0].tier, "authored")

    # multi-generation breeding
    def test_lineage_planner(self):
        p = self.breed.plan_lineage("Tyranitar", ["Dragon Dance", "Outrage"], "heartgold")
        self.assertEqual(p["plans"][0]["steps"], 2)
        fathers = {pl["father"] for pl in p["plans"]}
        self.assertTrue(fathers & {"Lapras", "Feraligatr", "Charizard"})
        t = self.breed.plan_lineage("Mamoswine", ["Ice Shard"], "heartgold")["timing"][0]
        self.assertIn("Swinub at Lv 28", t)
        self.assertIn("Lv 33", t)
        self.assertTrue(self.breed.plan_lineage("Pikachu", ["Volt Tackle"], "soulsilver")["by_held_item"])

    # specimen engine
    def test_specimen_gen2_shiny_hidden_power(self):
        from specimen import Lab, Specimen
        card = Lab(DB).derive(Specimen("Feraligatr", "crystal", dvs={"atk": 15, "def": 10, "spe": 10, "spc": 10}))
        self.assertTrue(card["shiny"])
        self.assertEqual(card["hidden_power"], "Dragon 69")


if __name__ == "__main__":
    unittest.main()
