"""Regression tests: every verified fact the engines rely on. Run from engine/:
    python3 -I -m unittest discover -s tests -v
Needs engine/data/pokeref.sqlite (python3 -I fetch_reference.py) and battle/node_modules (npm ci)."""
import os
import sys
import tempfile
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

    def test_abilities_list_every_option_of_the_era(self):
        # Smogon's calc data keeps only the first ability; these come from PokeAPI with past-generation rows
        self.assertEqual(rules.abilities(4, "Snorlax"), ["Immunity", "Thick Fat"])
        self.assertIn("Snow Cloak", rules.abilities(4, "Mamoswine"))
        self.assertEqual(rules.abilities(4, "Garchomp"), ["Sand Veil"])

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


class Ranch(unittest.TestCase):
    """The breeding ranch (D-035) and camp life (D-034)."""

    @classmethod
    def setUpClass(cls):
        from ranch.habitat import HabitatEngine
        from ranch.planner import RanchPlanner
        from wilderness.camp_life import CampLife
        from wilderness.engine import WildernessEngine
        cls.habitat, cls.ranch = HabitatEngine(DB), RanchPlanner(DB)
        cls.camp = CampLife(WildernessEngine(DB))

    def test_symbol_names_resolve(self):
        self.assertEqual(self.habitat.ref.species_id("Nidoran♂"), 32)
        self.assertEqual(self.habitat.ref.species_id("Nidoran♀"), 29)

    def test_habitat_profiles(self):
        lapras = self.habitat.profile("Lapras")
        self.assertEqual((lapras.zones[0], lapras.climate, lapras.water), ("coast_sea", "cold", "sea"))
        self.assertIn("via Piloswine", self.habitat.profile("Mamoswine").evidence[0])   # Gen 4 inherits the line's habitat
        self.assertEqual(self.habitat.profile("Snorlax").size, "huge")

    def test_home_site_and_hatchery_staff(self):
        # one headquarters (D-036): everyone lives there unless it lacks their land
        self.assertEqual(self.ranch.home_site(self.habitat.profile("Typhlosion")), "S-JOHTO")
        self.assertEqual(self.ranch.home_site(self.habitat.profile("Lapras")), "S-KANTO")
        staff = {s["species"] for s in self.ranch.suggest_staff("egg_care")}
        self.assertTrue({"Magcargo", "Camerupt", "Magmortar"} <= staff)

    def test_one_satellite_covers_the_headquarters_gaps(self):
        prof = {c["id"]: self.habitat.profile(c["species"]) for c in self.ranch.companions()}
        options = self.ranch.satellite_options(prof)
        self.assertEqual(sorted(options["hq_lacks"]), ["coast_sea", "volcanic"])
        self.assertEqual(options["minimum"], [["S-KANTO"], ["S-SINNOH"]])

    def test_program_keeps_only_the_final_product(self):
        # D-038: the lineage's fathers are used, not kept; the ranch keeps a stud of the target line
        t = self.ranch.program_entry({"species": "Tyranitar", "game": "heartgold",
                                      "moves": ["Dragon Dance", "Outrage"], "source": "test"})
        self.assertEqual(t["fathers_used"], ["Kingdra", "Feraligatr"])
        self.assertEqual((t["kept"]["kind"], t["kept"]["species"], t["kept"]["sex"]), ("stud", "Tyranitar", "male"))
        self.assertEqual(sorted(t["kept"]["knows"]), ["Dragon Dance", "Outrage"])
        p = self.ranch.program_entry({"species": "Pikachu", "game": "soulsilver", "moves": ["Volt Tackle"], "source": "test"})
        self.assertEqual(p["kept"]["kind"], "item")

    def test_fathers_from_the_same_generation_come_first(self):
        # Volbeat only has Counter from Emerald's tutor; Heracross learns it in HGSS itself
        plan = self.ranch.breeding.plan_lineage("Scizor", ["Counter"], "soulsilver")["plans"][0]
        self.assertEqual(plan["father"], "Heracross")
        self.assertTrue(plan["native"])

    def test_camp_life_catalog_matches_the_games(self):
        self.assertIn("MiracleBerry", self.camp.berries("crystal"))
        self.assertEqual(len(self.camp.berries("platinum")), 64)
        for game in rules.GAME_GEN:
            for system in self.camp.systems(game):
                self.assertEqual(system["items_missing_in_gen"], [], f"{game}: {system['id']}")

    def test_lore_exclusions(self):
        # "it absorbs their heat" is the opposite of a heat source
        heat = [e for e in self.camp.wild.evidence("Gengar", "crystal") if e.capability == "heat_source"]
        self.assertEqual(heat, [])


class JourneyLabRanch(unittest.TestCase):
    """Scouting reports (D-043, D-046), the studbook (D-044) and the Glasshouse (D-045)."""

    @classmethod
    def setUpClass(cls):
        from battle.engine import BattleEngine
        from battle.scouting import Scouting
        from breeding.studbook import Studbook
        cls.scout = Scouting(BattleEngine(DB))
        cls.book = Studbook(DB)

    def test_phrases_are_triggered_by_numbers(self):
        snorlax = self.scout.report("Snorlax", "heartgold", {"moves": ["Body Slam", "Rest", "Thunder Punch", "Zen Headbutt"],
                                                             "ability": "Thick Fat", "item": "Leftovers"}, (27, 5))
        fired = {p["rule"]: p for p in snorlax["phrases"]}
        self.assertIn("speed_slow", fired)                       # base 30: near the bottom of Gen 4
        self.assertIn("speed_pct", fired["speed_slow"]["trigger"])
        self.assertIn("behind_rest", fired)
        self.assertIn("prod_anchor", fired)                      # 27 of 32 against the league
        self.assertIn("Fire and Ice moves only do half", fired["ability_note"]["text"])
        self.assertEqual(sum(p["section"] == "philosophy" for p in snorlax["phrases"]), 1)   # a group fires once
        self.assertNotIn("grades", snorlax)                      # D-046: no grades

    def test_phrase_with_a_hole_never_prints(self):
        import json as _json
        from battle.phrases import Phrasebook
        path = os.path.join(tempfile.mkdtemp(), "book.json")
        with open(path, "w") as fh:
            _json.dump({"player": [{"id": "a", "section": "s", "when": [], "say": "Holds {item}."},
                                   {"id": "b", "section": "s", "when": [["x", ">=", 2]], "say": "x is {x}."}]}, fh)
        book = Phrasebook(path)
        self.assertEqual(book.speak("player", {"item": None, "x": 1}), [])
        self.assertEqual([p["rule"] for p in book.speak("player", {"item": "Leftovers", "x": 3})], ["a", "b"])

    def test_gen3_type_split_shows_in_tendencies(self):
        # Bite is special in Gen 3, so a Bite + Rock Slide set hits from both sides
        absol = self.scout.report("Absol", "emerald", {"moves": ["Bite", "Rock Slide", "Swords Dance", "Ice Beam"]})
        self.assertTrue(any(p["rule"].startswith("lean_mixed") for p in absol["phrases"]))

    def test_trainer_philosophy_comes_from_the_game(self):
        from battle.benchmarks import Benchmarks
        bench = Benchmarks(DB, self.scout.battle)
        lucian = [o for o in bench.load("platinum") if o["name"] == "Lucian"][0]
        ctx = self.scout.trainer_context(lucian)
        self.assertTrue(ctx.get("ai_setup_first_turn"))         # Platinum's own AI flag for Lucian
        self.assertEqual((ctx["heal_items_n"], ctx["heal_item"]), (2, "Full Restore"))
        red = [o for o in bench.load("heartgold") if o["name"] == "Red"][0]
        self.assertEqual(self.scout.trainer_context(red)["heal_items_n"], 4)

    def test_filled_set_skips_rejected_and_unreliable_moves(self):
        filled = self.scout.strongest_set("Typhlosion", "heartgold", rejected=["Focus Blast"])
        self.assertNotIn("Focus Blast", filled)
        self.assertNotIn("Blast Burn", filled)

    def test_what_if_opponents_are_built_at_peak(self):
        from battle.scouting import Scouting
        opp = Scouting.as_opponent("heartgold", [Member("Lapras", moves=["Surf"], nature="Calm")])
        mon = opp["party"][0]
        self.assertEqual((mon["level"], mon["ivs"]["spa"], mon["nature"]), (100, 31, "Calm"))

    def test_journey_breeding_web(self):
        roles = {e["species"]: e for e in self.book.roles()}
        self.assertTrue(all(e["roles"] for e in roles.values()))              # D-044: everyone is a parent or product
        self.assertIn("dam (female-only line)", roles["Miltank"]["roles"])
        self.assertTrue(roles["Magnezone"]["roles"][0].startswith("Ditto line"))
        # Tyranitar's Dragon Dance can stay inside the journey: Dragonite teaches Lapras, Lapras passes it on
        self.assertIn("Dragonite → Lapras", roles["Tyranitar"]["journey_chains"]["Dragon Dance"])
        self.assertEqual(roles["Swampert"]["bred_moves"], {"Refresh": ["Milotic"]})

    def test_hatchery_numbers(self):
        from ranch.hatchery import Hatchery
        from ranch.planner import RanchPlanner
        h = Hatchery(RanchPlanner(DB))
        egg = h.egg_card("Tyranitar")
        self.assertEqual((egg["line"], egg["cycles"], egg["steps"], egg["steps_with_flame_body"]), ("Larvitar", 40, 10200, 5100))
        lum = [c for c in h.crops() if c["berry"] == "Lum Berry"][0]
        self.assertEqual((lum["hours_to_harvest"], lum["why"]), (48, "held by HeartGold Tyranitar"))

    def test_plant_care_lore(self):
        from wilderness.engine import WildernessEngine
        ev = [e for e in WildernessEngine(DB).evidence("Meganium", "emerald") if e.capability == "plant_care"]
        self.assertTrue(ev and "revive" in ev[0].detail)


class ScoutingEngine(unittest.TestCase):
    """The scouting engine's layers (docs/SCOUTING_ENGINE.md): move book, field, fights, profiles."""
    @classmethod
    def setUpClass(cls):
        from battle.engine import BattleEngine
        from battle.evaluate import Evaluator
        from battle.moves import MoveBook
        cls.battle = BattleEngine(DB)
        cls.mb = MoveBook(cls.battle.ref)
        cls.ev = Evaluator(cls.battle, cls.mb)

    def c(self, species, moves, gen=4, **kw):
        from battle.knowledge import Combatant
        evs = {"hp": 252, "atk": 252, "def": 0, "spa": 0, "spd": 4, "spe": 0} if gen >= 3 else None
        return Combatant(species=species, gen=gen, moves=moves, evs=kw.pop("evs", evs), name=species, **kw)

    def fight(self, a, b, pa=None, pb=None, state=False):
        from battle.evaluate import Fight, Plan
        self.ev.prepare([a, b])
        for _ in range(8):
            before = self.ev.table.misses
            f = Fight(self.ev, a, b, pa or Plan(), pb or Plan())
            o = f.run()
            if self.ev.table.misses == before:
                return (o, f) if state else o
            self.ev.table.fetch()
        raise AssertionError("damage table never settled")

    def plays(self, gen, move):
        return {(p["play"], p.get("detail")) for p in self.mb.get(gen, move).plays}

    def test_move_book_reads_plays_from_data(self):
        self.assertIn(("boost", "atk +1, spe +1"), self.plays(4, "Dragon Dance"))
        self.assertIn(("status", "badly poisoned"), self.plays(4, "Toxic"))
        self.assertEqual(self.mb.get(4, "Rapid Spin").self_changes, {})     # its Speed boost is Gen 8
        self.assertEqual(self.mb.get(2, "Growth").self_changes, {"spa": 1})
        self.assertIn(("lock-in", "2-3 turns, then it's confused"), self.plays(4, "Outrage"))
        self.assertIn(("cure", None), self.plays(3, "Refresh"))
        self.assertIn(("taunt", None), self.plays(4, "Taunt"))

    def test_usage_field_and_peak_defaults(self):
        from battle.knowledge import from_build, usage_field
        self.assertEqual([len(usage_field(g)) for g in (2, 3, 4)], [48, 57, 73])
        lax = from_build(4, "Snorlax", {"moves": ["Body Slam", "Rest"], "nature": "Careful"},
                         fill=lambda sp, rej: ["Earthquake", "Body Slam", "Crunch"])
        self.assertEqual(lax.moves, ["Body Slam", "Rest", "Earthquake", "Crunch"])
        self.assertEqual((lax.level, lax.evs["spe"], lax.ability), (100, 85, "Immunity"))
        self.assertTrue(any("filled in" in a for a in lax.assumed) and any("could be Thick Fat" in a for a in lax.assumed))

    def test_burn_halves_physical_hits_through_the_calculator(self):
        out = self.battle.damage([{"gen": 4, "attacker": {"species": "Tyranitar", "level": 100, "status": s},
                                   "defender": {"species": "Snorlax", "level": 100}, "move": "Crunch"} for s in ("", "brn")])
        self.assertAlmostEqual(out[1]["percent"][0] * 2, out[0]["percent"][0], delta=0.5)
        immune = self.battle.damage([{"gen": 4, "attacker": {"species": "Garchomp", "level": 100},
                                      "defender": {"species": "Gengar", "level": 100}, "move": "Earthquake"}])[0]
        self.assertEqual((immune["percent"], "error" in immune), ([0.0, 0.0], False))   # Levitate: 0, not an error

    def test_fake_out_flinches_and_a_flinched_opening_waits(self):
        from battle.evaluate import Plan
        o = self.fight(self.c("Ambipom", ["Fake Out", "Return"], ability="Technician"),
                       self.c("Snorlax", ["Curse", "Body Slam"]), pb=Plan(("Curse",)))
        self.assertEqual(o.calls[0][:2], ("Fake Out", "Return"))
        self.assertEqual(o.calls[1][:2], ("(flinched)", "Curse"))

    def test_rest_sleeps_two_turns(self):
        from battle.evaluate import Plan
        o = self.fight(self.c("Snorlax", ["Rest", "Curse"]), self.c("Blissey", ["Seismic Toss"]), Plan(sustain=True))
        calls = list(o.calls[0])
        i = calls.index("Rest")
        self.assertEqual(calls[i + 1:i + 3], ["(asleep)", "(asleep)"])

    def test_substitute_blocks_status(self):
        from battle.evaluate import Plan
        o, f = self.fight(self.c("Jirachi", ["Substitute", "Psychic"]), self.c("Blissey", ["Thunder Wave", "Seismic Toss"]),
                          Plan(("Substitute",)), Plan(("Thunder Wave",)), state=True)
        self.assertEqual((o.calls[0][0], o.calls[1][0]), ("Substitute", "Thunder Wave"))   # Jirachi is faster
        self.assertIsNone(f.A.status)

    def test_setup_gets_credit_only_when_it_changes_the_fight(self):
        from battle.knowledge import usage_field
        zapdos = [c for c in usage_field(4) if c.species == "Zapdos"][0]
        ttar = self.c("Tyranitar", ["Dragon Dance", "Crunch", "Earthquake", "Outrage"], item="Lum Berry",
                      ability="Sand Stream")
        m = self.ev.versus([ttar], [zapdos])[(ttar.key, zapdos.key)]
        self.assertEqual((m.outcome.winner, m.straight.winner), ("A", "B"))
        self.assertEqual(m.credits.get("build"), "decisive")
        self.assertEqual(m.outcome.calls[0][0], "Dragon Dance")

    def test_percentiles_and_philosophy(self):
        from battle.profile import percentile, philosophy
        self.assertEqual(percentile(5, [0, 0, 10, 10]), 50)
        self.assertEqual(percentile(10, [0, 0, 10, 10]), 75)
        line = philosophy({"pace": 95, "punch": 52, "risk": 10, "build": 60})
        self.assertEqual([(k, pole) for k, pole, _ in line], [("pace", "strikes first"), ("risk", "safe")])

    def test_showdown_paste_round_trip(self):
        from battle.knowledge import from_build
        from battle.paste import export, parse
        text = """Rex (Tyranitar) (F) @ Lum Berry
Ability: Sand Stream
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
IVs: 30 SpA
- Dragon Dance
- Crunch
- Hidden Power [Fire]
- Earthquake"""
        b = parse(text)[0]
        self.assertEqual((b["nickname"], b["species"], b["gender"], b["item"], b["nature"]),
                         ("Rex", "Tyranitar", "F", "Lum Berry", "Jolly"))
        self.assertEqual((b["evs"], b["ivs"]), ({"atk": 252, "spd": 4, "spe": 252}, {"spa": 30}))
        self.assertIn("Hidden Power Fire", b["moves"])
        out = export(from_build(4, b["species"], b), nickname="Rex")
        for line in ("Rex (Tyranitar) @ Lum Berry", "Jolly Nature", "- Hidden Power [Fire]", "IVs: 30 SpA"):
            self.assertIn(line, out)

    def test_coach_heal_line_changes_the_call(self):
        from battle.evaluate import Matchup, Plan
        from battle.playsheet import calls
        lax, foe = self.c("Snorlax", ["Rest", "Body Slam"], item="Leftovers"), self.c("Blissey", ["Seismic Toss"])
        self.ev.prepare([lax, foe])
        job = lambda coach: (lax, foe, Plan(), Plan(), "third_long", coach, "A")
        neutral, coached = calls(self.ev, [job({}), job({"heal_line": 50})])
        self.assertEqual((neutral, coached), ("Body Slam", "Rest"))   # at 30%, a Seismic Toss isn't a KO threat

    def test_report_grid_reads_the_engine(self):
        from battle.benchmarks import Benchmarks
        from battle.grid import EngineGrid
        from team import Member, Team
        grid = EngineGrid(self.ev)
        red = [t for t in Benchmarks(DB, self.battle).load("heartgold") if t["name"] == "Red"][0]
        team = Team("heartgold", [Member("Tyranitar", moves=["Dragon Dance", "Crunch", "Earthquake", "Stone Edge"]),
                                  Member("Lapras", moves=["Surf", "Ice Beam", "Thunderbolt", "Rest"])])
        m = grid.matchups(team, red)
        self.assertEqual(m["our_level"], max(p["level"] for p in red["party"]))     # met at their top level
        cell = m["grid"][0]["vs"]["Tyranitar"]
        self.assertTrue({"wins", "value", "plan", "we_hit", "hits_to_ko"} <= set(cell))
        self.assertTrue(any(w["side"] == "them" for w in m["web"]))
        self.assertEqual(m["theirs"][0].evs["atk"], 0)                              # trainers keep cartridge stats

    def test_lab_builds_lineups_and_rejects_unknown_coach_settings(self):
        import lab
        gen, team, label, coach = lab.Lab().team("heartgold")
        self.assertEqual((gen, len(team), label), (4, 6, "HeartGold"))
        self.assertTrue(all(c.level == 100 for c in team))
        self.assertEqual(lab.coach_arg("heal_line=40,tempo=finish"), {"heal_line": 40.0, "tempo": "finish"})
        with self.assertRaises(SystemExit):
            lab.coach_arg("courage=90")

    def test_trainers_carry_their_games_ai_flags(self):
        from battle.benchmarks import Benchmarks
        bench = Benchmarks(DB, self.battle)
        flags = lambda game, name: [t for t in bench.load(game) if t["name"] == name][0].get("ai_flags")
        self.assertIn("AI_RISKY", flags("crystal", "Red"))
        self.assertIn("AI_SCRIPT_SETUP_FIRST_TURN", flags("emerald", "Sidney"))
        self.assertIn("AI_SCRIPT_TRY_TO_FAINT", flags("firered", "Lorelei"))
        self.assertEqual(flags("heartgold", "Red"), 7)                     # HGSS: a bitmask, BASIC|EVAL_ATTACK|EXPERT

    def test_game_ai_scores_moves_like_the_cartridge(self):
        from battle.evaluate import Fight, Plan
        from battle import trainer_policy
        gen4 = ("AI_FLAG_BASIC", "AI_FLAG_EVAL_ATTACK", "AI_FLAG_EXPERT")
        us = self.c("Lapras", ["Surf", "Ice Beam"])
        them = self.c("Starmie", ["Surf", "Thunderbolt", "Recover", "Thunder Wave"], ai=gen4)
        self.ev.prepare([us, them])
        for _ in range(4):
            f = Fight(self.ev, us, them, Plan(), Plan())
            f.B.hp = 60.0
            sc = trainer_policy.scores(f, f.B, f.A, gen4)
            if not self.ev.table.missing:
                break
            self.ev.table.fetch()
        self.assertEqual(sc["Recover"], 92)        # Expert: no healing while it's the faster one (-8)
        self.assertEqual(sc["Surf"], 90)           # Basic: Lapras's Water Absorb makes it do nothing (-10)
        self.assertEqual(sc["Thunderbolt"], 100)   # its hardest hit, untouched
        crystal = ("AI_BASIC", "AI_RISKY", "AI_AGGRESSIVE")
        weak = self.c("Pikachu", ["Thunderbolt"], gen=2)
        cry = self.c("Snorlax", ["Body Slam", "Earthquake"], gen=2, ai=crystal)
        self.ev.prepare([weak, cry])
        for _ in range(4):
            f = Fight(self.ev, weak, cry, Plan(), Plan())
            f.A.hp = 10.0
            sc = trainer_policy.scores(f, f.B, f.A, crystal)
            if not self.ev.table.missing:
                break
            self.ev.table.fetch()
        self.assertEqual(sc["Earthquake"], -15)    # Crystal: 20, a knockout -5, lowest wins (turned around here)


class TrainerReportData(unittest.TestCase):
    """The trainer scouting report, step 1 (docs/TRAINER_REPORT.md): the Gen IV data layer, builds and trainers."""
    @classmethod
    def setUpClass(cls):
        from trainers.model import Store
        cls.store = Store()
        cls.era = cls.store.era

    def test_type_chart_comes_from_pokeapi_and_matches_the_era(self):
        for gen in (2, 3, 4):
            chart, smogon = self.era.chart(gen), rules.gen_data(gen)["types"]
            self.assertEqual({(a, d): chart[a][d] for a in chart for d in chart[a]},
                             {(a, d): smogon[a].get(d, 1) for a in chart for d in chart[a]})
        self.assertEqual(self.era.chart(4)["Ghost"]["Steel"], 0.5)      # Steel resisted Ghost and Dark through Gen V
        self.assertNotIn("Fairy", self.era.chart(4))

    def test_past_typing_and_stats(self):
        self.assertEqual(self.era.types("Clefairy", 4), ("Normal",))
        self.assertEqual(self.era.types("Rotom-Wash", 4), ("Electric", "Ghost"))
        for sp in rules.gen_data(4)["species"].values():
            try:
                self.era.pokemon_id(sp["name"])
            except KeyError:
                continue                    # Smogon's fan-made CAP species and in-battle forms
            self.assertEqual(self.era.types(sp["name"], 4), tuple(sp["types"]), sp["name"])
            self.assertEqual(self.era.base_stats(sp["name"], 4), sp["bs"], sp["name"])

    def test_stats_come_from_the_build_at_the_configured_level(self):
        chomp = self.store.library["stock/garchomp-sweeper"]
        stats, level, used = self.store.stats(chomp, "platinum")
        self.assertEqual((level, stats["hp"], stats["atk"], stats["def"], stats["spe"]), (100, 357, 359, 227, 333))
        self.assertEqual(self.store.stats(chomp, "platinum", level=50)[0]["spe"], 169)
        self.assertEqual(used, ["IVs 31"])

    def test_trainers_versions_and_teams(self):
        self.assertEqual(len(self.store.trainers), 12)
        for t in self.store.trainers.values():
            for v in t.versions.values():
                self.assertTrue(1 <= len(self.store.team(v)) <= 6, f"{t.id}/{v.id}")
        paul = self.store.version("paul", "sinnoh")
        self.assertTrue(paul.sliders["offense"]["value"] >= 70 and paul.sliders["rigidity"]["value"] >= 70)
        self.assertIn("demanding, not cold", paul.sliders["bond"]["why"])
        red = self.store.team(self.store.version("red"))
        self.assertEqual((red[0].species, red[0].level, red[0].item, red[0].ivs["spe"], red[0].evs["atk"]),
                         ("Pikachu", 88, "Light Ball", 30, 0))           # the cartridge's own data

    def test_move_legality_is_biological_with_a_reason(self):
        """D-048: any game, the show, or a reason on record; only a move with no reason is flagged."""
        from trainers.model import Build
        zard = self.store.team(self.store.version("ash", "all-time"))[1]
        basis = {b["move"]: b for b in self.store.move_basis(zard, "platinum")}
        self.assertEqual(basis["Flamethrower"]["basis"], "this game")
        self.assertEqual(basis["Dragon Breath"]["reason"], "learns it in Crystal (machine)")
        self.assertEqual(self.store.check(zard, "platinum"), [])
        mine = Build(id="t", species="Charizard", moves=["Ice Beam", "Flamethrower"])
        self.assertEqual(len(self.store.check(mine, "platinum")), 1)              # no game teaches it, no reason given
        mine.move_reasons = {"Ice Beam": "taught by a move tutor in my world"}
        self.assertEqual(self.store.check(mine, "platinum"), [])

    def test_lore_is_data_not_engine_logic(self):
        """No code pairs a species with its lore item (Pikachu + Light Ball): that lives in data files."""
        for folder in ("trainers", "battle"):
            for name in os.listdir(os.path.join(ENGINE, folder)):
                if name.endswith(".py"):
                    with open(os.path.join(ENGINE, folder, name), encoding="utf-8") as fh:
                        for line in fh:
                            self.assertFalse('"Pikachu"' in line and '"Light Ball"' in line, f"{folder}/{name}: {line}")
        from battle.scouting import SIGNATURE_ITEMS
        self.assertEqual(SIGNATURE_ITEMS["Pikachu"], "Light Ball")            # read from battle/species_items.json


if __name__ == "__main__":
    unittest.main()
