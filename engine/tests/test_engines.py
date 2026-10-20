"""Regression tests: every verified fact the engines rely on. Run from engine/:
    python3 -I -m unittest discover -s tests -v
Needs engine/data/pokeref.sqlite (python3 -I fetch_reference.py) and battle/node_modules (npm ci)."""
import json
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

    def test_matrix_verdicts_with_abilities_first(self):
        from trainers.matrix import row
        from trainers.model import Build
        gengar = row(self.store, Build(id="t", species="Gengar", moves=["Shadow Ball"], ability="Levitate"), "platinum")
        self.assertEqual((gengar["cells"]["Ground"]["verdict"], gengar["cells"]["Ground"]["before_ability"]), ("immune", "weak"))
        self.assertEqual(gengar["cells"]["Psychic"]["verdict"], "weak")
        lax = row(self.store, Build(id="t", species="Snorlax", moves=["Body Slam"], ability="Thick Fat"), "heartgold")
        self.assertEqual((lax["cells"]["Fire"]["verdict"], lax["cells"]["Fighting"]["verdict"]), ("resists", "weak"))
        shed = row(self.store, Build(id="t", species="Shedinja", moves=["Shadow Sneak"], ability="Wonder Guard"), "platinum")
        self.assertEqual((shed["cells"]["Water"]["verdict"], shed["cells"]["Fire"]["verdict"]), ("immune", "weak"))
        steel = row(self.store, Build(id="t", species="Steelix", moves=["Iron Tail"], ability="Sturdy"), "platinum")
        self.assertEqual(steel["cells"]["Ghost"]["verdict"], "resists")             # Gen IV chart, not today's
        chomp = row(self.store, self.store.library["stock/garchomp-sweeper"], "platinum")
        self.assertEqual(chomp["cells"]["Ice"]["verdict"], "very weak")

    def test_bulk_lean_and_team_summary(self):
        import json as _json
        from trainers.matrix import team_matrix
        brock = team_matrix(self.store, self.store.version("brock"))
        self.assertTrue(all(r["bulk"]["lean"] == "special" for r in brock["rows"]))
        self.assertEqual(brock["summary"]["bring"], "special")
        self.assertIn("worse from special attackers", brock["rows"][0]["cells"]["Water"]["note"])
        self.assertIn("Grass", brock["summary"]["gaps"])
        mine = team_matrix(self.store, self.store.version("me", "heartgold"))
        self.assertEqual(mine["summary"]["gaps"][0], "Fighting")                      # four of the six are weak to it
        _json.dumps(mine)                                                              # plain data, ready for Part 2

    def test_bulk_counts_hp(self):
        """Softness is placed in the field, HP included: a low Defense on a huge HP pool isn't soft."""
        from trainers.matrix import row, summary
        from trainers.model import Build
        def lean(sp, game="platinum"):
            return row(self.store, Build(id="t", species=sp, moves=["Tackle"]), game)["bulk"]
        self.assertNotEqual(lean("Snorlax")["lean"], "physical")       # 65 Def on 160 HP: above most of the field
        self.assertGreater(lean("Snorlax")["physical_pct"], 0.6)
        self.assertNotEqual(lean("Snorlax", "heartgold")["lean"], "physical")
        self.assertEqual(lean("Blissey")["lean"], "physical")          # 255 HP can't carry 10 Def
        self.assertEqual(lean("Skarmory")["lean"], "special")
        self.assertEqual(lean("Cloyster")["lean"], "special")
        self.assertEqual(lean("Ninjask")["lean"], "frail")             # low on both sides is frail, not a side
        self.assertEqual(lean("Tyranitar")["lean"], "sturdy")
        rows = [row(self.store, Build(id="t", species=sp, moves=["Tackle"]), "platinum")
                for sp in ("Sceptile", "Snorlax", "Heracross", "Charizard", "Tyranitar", "Gyarados")]
        self.assertEqual(summary(rows, ["Fire"], self.store.config)["bring"], "either")   # one soft member isn't a team

    def _measure(self, tid, vid=None):
        from trainers.matrix import team_matrix
        from trainers.sliders import measure
        v = self.store.version(tid, vid)
        team = self.store.team(v)
        return measure(self.store, v, team_matrix(self.store, v, team=team), team)

    def test_measured_sliders_and_disagreements(self):
        paul = self._measure("paul", "sinnoh")
        self.assertTrue(paul["offense"]["measured"] >= 70 and paul["offense"]["disagreement"] is None)
        self.assertIsNone(paul["bond"]["measured"])                      # missing data is never evidence
        self.assertEqual(paul["rigidity"]["disagreement"]["team_leans"], "flexible")
        red = self._measure("red")
        self.assertEqual(red["risk"]["disagreement"]["team_leans"], "gambler")
        self.assertIn("Lapras", red["risk"]["signals"][0]["members"])    # Blizzard at 70% accuracy
        kanto = self._measure("ash", "kanto")
        self.assertEqual(kanto["rigidity"]["disagreement"]["team_leans"], "rigid")   # one- and two-type movesets
        self.assertEqual(kanto["bond"]["measured"], 100)                 # Pikachu's friendship is the only signal

    def test_tags_and_nature_clashes(self):
        from trainers.matrix import team_matrix
        from trainers.model import Build, Version
        from trainers.sliders import nature_clashes, tags
        v = self.store.version("brock")
        team = self.store.team(v)
        names = {t["name"]: t["detail"] for t in tags(self.store, v, team, team_matrix(self.store, v, team=team))}
        self.assertEqual((names["Cohesive"], names["Type-dominant"], names["Gym Leader"]), (["Rock Slide"], ["Rock"], ["Gym Leader"]))
        bold = Build(id="t", species="Snorlax", moves=["Body Slam"], nature="Bold")
        hot = Version(id="t", trainer="t", title="t", game="platinum", team_ref={}, sliders={"offense": {"value": 80}})
        self.assertEqual(len(nature_clashes(self.store, hot, [bold])), 1)
        hot.sliders["offense"]["value"] = 50
        self.assertEqual(nature_clashes(self.store, hot, [bold]), [])

    def _text(self, rep):
        return [p["text"] for sec in rep["plan"].values() for p in sec]

    def test_paul_reads_aggressive_rigid_and_demanding_not_cold(self):
        from trainers.report import build_report
        who = " ".join(p["text"] for p in build_report(self.store, "paul", "sinnoh")["plan"]["who"])
        self.assertIn("comes at you with force", who)
        self.assertIn("same way every time", who)
        self.assertIn("demanding of them: tough love, not coldness", who)

    def test_every_slider_and_tag_changes_a_sentence(self):
        """A slider or tag earns its place only if it changes a line of the report (the brief's rule)."""
        import copy
        from trainers.report import build_report
        v = self.store.version("paul", "sinnoh")
        saved = copy.deepcopy(v.sliders)
        try:
            for k in ("offense", "rigidity", "bond", "risk"):
                texts = []
                for value in (10, 90):
                    v.sliders = copy.deepcopy(saved)
                    v.sliders[k]["value"] = value
                    texts.append(self._text(build_report(self.store, "paul", "sinnoh")))
                self.assertNotEqual(texts[0], texts[1], f"the {k} slider changes no sentence")
        finally:
            v.sliders = saved
        tag_cfg = self.store.config["tags"]
        for tid, tag, knob in (("brock", "cohesive", "min_members"), ("brock", "type_dominant", "min_members")):
            on = self._text(build_report(self.store, tid))
            saved_n = tag_cfg[tag][knob]
            tag_cfg[tag][knob] = 99
            try:
                self.assertNotEqual(on, self._text(build_report(self.store, tid)), f"the {tag} tag changes no sentence")
            finally:
                tag_cfg[tag][knob] = saved_n
        for tid in ("brock", "red", "lance"):
            v = self.store.version(tid)
            saved_roles = list(v.roles)
            on = self._text(build_report(self.store, tid))
            v.roles = []
            try:
                self.assertNotEqual(on, self._text(build_report(self.store, tid)), f"{tid}'s role tag changes no sentence")
            finally:
                v.roles = saved_roles

    def test_reports_are_deterministic_and_ready_for_part_2(self):
        import json as _json
        from trainers.report import build_report
        a = _json.dumps(build_report(self.store, "red"), sort_keys=True)
        b = _json.dumps(build_report(self.store, "red"), sort_keys=True)
        self.assertEqual(a, b)
        rep = _json.loads(a)
        self.assertEqual(rep["schema"], "trainer-report/2")      # /2: Part 2's playsheet joined the report
        self.assertTrue({"sliders", "tags", "matrix", "plan"} <= set(rep))
        self.assertTrue({"gaps", "strengths", "bring", "per_type"} <= set(rep["matrix"]["summary"]))

    def test_exposure_shows_where_your_team_is_hit(self):
        from trainers.report import exposure
        e = exposure(self.store, ("me", "heartgold"), ("paul", "sinnoh"))
        tyr = next(r for r in e["rows"] if r["member"] == "Tyranitar")
        self.assertEqual(tyr["hits"][0]["verdict"], "very weak")          # Brick Break from Electivire
        self.assertIn("Brick Break (Electivire)", tyr["hits"][0]["their_moves"])
        self.assertEqual(e["most_exposed"][0], "Tyranitar")


class RoleEngine(unittest.TestCase):
    """Part 2 (docs/TRAINER_REPORT.md): the role engine. One source of truth (trainers/roles.json)."""
    @classmethod
    def setUpClass(cls):
        from trainers.model import Store
        from trainers.roles import RoleBook
        cls.store = Store()
        cls.book = RoleBook(cls.store)

    def test_move_categories_come_from_the_games_data(self):
        cat = lambda m: self.book.move(m, 4)["categories"]
        self.assertEqual(cat("Dragon Dance") >= {"setup_physical", "setup_speed"}, True)
        self.assertEqual(self.book.move("Growth", 4)["stat_changes"], {"spa": 1})     # Attack too only from Gen V
        self.assertEqual(self.book.move("Tail Glow", 4)["stat_changes"], {"spa": 2})  # +3 only from Gen V
        self.assertTrue({"setup_physical", "setup_defense"} <= cat("Curse"))
        self.assertIn("recovery", cat("Roost"))
        self.assertIn("phaze", cat("Roar"))
        self.assertIn("self_ko", cat("Explosion"))
        self.assertIn("hazard_removal", cat("Rapid Spin"))
        self.assertIn("sleep", cat("Spore"))
        self.assertNotIn("priority_attack", cat("Fake Out"))
        self.assertEqual(self.book.move("Extreme Speed", 4)["priority"], 1)    # E-031: +2 only from Gen V

    def test_every_role_reads_only_defined_signals(self):
        sig = set(self.book.signal_defs)
        cats = set(self.book.categories)
        keys = lambda k: [p for g in k.split("|") for p in g.split("&")]
        for rid, role in self.book.roles.items():
            self.assertIn(role["family"], self.book.cfg["families"], rid)
            self.assertIn(role.get("ev_template"), self.book.cfg["ev_templates"], rid)
            for k in list(role["weights"]) + [s for alt in role["requires"] for s in alt]:
                for part in keys(k):
                    self.assertIn(part, sig, f"{rid}: {part}")
        for name, spec in self.book.signal_defs.items():
            if spec["kind"] == "moves":
                for c in (spec["category"] if isinstance(spec["category"], list) else [spec["category"]]):
                    self.assertIn(c, cats, name)
            if spec["kind"] == "item":
                self.assertIn(spec["group"], self.book.items, name)
            if spec["kind"] == "ability":
                self.assertIn(spec["group"], self.book.abilities, name)
        self.assertEqual(len(self.book.roles), 34)
        self.assertEqual({r["family"] for r in self.book.roles.values()}, {"offense", "defense", "support", "utility"})

    def test_stock_archetypes_read_as_the_role_they_are_built_for(self):
        stock = [b for b in self.store.library.values() if b.role]
        top2 = 0
        for b in stock:
            r = self.book.classify(b, "platinum")
            ranked = [x["role"] for x in r["roles"]]
            listed = ranked[:3] + [a["role"] for a in r["also"]]      # a multi-role Pokémon lists every job
            self.assertIn(b.role, listed, f"{b.id}: {listed}")
            top2 += b.role in ranked[:2]
        self.assertGreaterEqual(top2 / len(stock), 0.85)
        chomp = self.book.classify(self.store.library["stock/garchomp-sweeper"], "platinum")
        self.assertEqual(chomp["primary"]["role"], "physical_setup_sweeper")
        why = chomp["roles"][0]["because"][0]
        self.assertEqual((why["signal"], why["evidence"]), ("setup_physical|setup_speed", ["Swords Dance"]))

    def test_missing_data_is_never_evidence(self):
        from trainers.model import Build
        bare = Build(id="t/ttar", species="Tyranitar", moves=["Crunch", "Stone Edge", "Fire Blast", "Pursuit"])
        r = self.book.classify(bare, "platinum")
        self.assertEqual(r["signals"]["lure"], 0.0)            # default EVs aren't off-side investment
        bare.evs, bare.nature = {"atk": 252, "spa": 64, "spe": 192}, "Lonely"
        self.assertEqual(self.book.classify(bare, "platinum")["signals"]["lure"], 1.0)

    def test_a_weather_sweeper_needs_its_weather(self):
        from trainers.model import Build
        dra = Build(id="t/kingdra", species="Kingdra", moves=["Hydro Pump", "Draco Meteor", "Surf", "Ice Beam"],
                    nature="Modest", evs={"spa": 252, "spe": 252, "hp": 4}, ability="Swift Swim")
        alone = self.book.classify(dra, "platinum")
        self.assertEqual(alone["signals"]["weather_sweep"], 0.0)
        with_rain = self.book.classify(dra, "platinum", team_weather={"rain"})
        self.assertEqual(with_rain["primary"]["role"], "weather_sweeper")

    def test_classification_is_deterministic(self):
        import json as _json
        b = self.store.library["stock/skarmory"]
        self.assertEqual(_json.dumps(self.book.classify(b, "platinum"), sort_keys=True, default=list),
                         _json.dumps(self.book.classify(b, "platinum"), sort_keys=True, default=list))


class RoleSolver(unittest.TestCase):
    """Part 2, step 2: role → build, species → archetypes, locks, and the round trip."""
    @classmethod
    def setUpClass(cls):
        from trainers.model import Store
        from trainers.roles import RoleBook
        from trainers.solver import Solver
        cls.store = Store()
        cls.book = RoleBook(cls.store)
        cls.solver = Solver(cls.book)

    def test_round_trip_every_suggested_build_classifies_back_to_its_role(self):
        cases = [("Garchomp", "physical_setup_sweeper"), ("Garchomp", "revenge_killer"), ("Garchomp", "wallbreaker"),
                 ("Skarmory", "hazard_setter"), ("Bronzong", "trick_room_setter"), ("Starmie", "hazard_remover"),
                 ("Kingdra", "weather_sweeper"), ("Vaporeon", "cleric"), ("Uxie", "screens_setter"),
                 ("Gliscor", "staller"), ("Jirachi", "pivot"), ("Ninjask", "baton_pass_starter"),
                 ("Smeargle", "suicide_lead")]
        for species, role in cases:
            r = self.solver.solve(species, role, "platinum")
            self.assertTrue(r["reached"], f"{species} {role}")
            from trainers.model import Build
            b = Build(id="rt", **{k: v for k, v in r["build"].items() if k != "id"})
            again = self.book.classify(b, "platinum")
            self.assertEqual(again["primary"]["role"], role, f"{species}: {again['primary']}")
            self.assertEqual(r["dead_moves"], [], species)
            self.assertTrue(r["export"]["legal"], f"{species}: {r['export']['conflicts']}")   # legal in Platinum

    def test_suggestions_look_like_the_builds_people_run(self):
        sd = self.solver.solve("Garchomp", "physical_setup_sweeper", "platinum")["build"]
        self.assertEqual((sd["nature"], sd["item"]), ("Jolly", "Life Orb"))
        self.assertTrue({"Swords Dance", "Earthquake"} <= set(sd["moves"]))
        self.assertEqual(self.solver.solve("Garchomp", "revenge_killer", "platinum")["build"]["item"], "Choice Scarf")
        self.assertEqual(self.solver.solve("Garchomp", "wallbreaker", "platinum")["build"]["item"], "Choice Band")
        dd = self.solver.solve("Gyarados", "physical_setup_sweeper", "platinum")["build"]
        self.assertIn("Dragon Dance", dd["moves"])

    def test_alternatives_carry_their_tradeoffs(self):
        r = self.solver.solve("Garchomp", "physical_setup_sweeper", "platinum")
        adamant = next(a for a in r["alternatives"]["nature"] if a["value"] == "Adamant")
        self.assertEqual(adamant["trade"], ["Attack 359 → 394", "Speed 333 → 303"])       # Jolly vs Adamant
        sd_slot = next(m for m in r["alternatives"]["moves"] if m["move"] == "Swords Dance")
        self.assertFalse(sd_slot["instead"][0]["keeps_role"])                                # the load-bearing slot

    def test_locks_are_kept_and_checked(self):
        r = self.solver.solve("Garchomp", "physical_setup_sweeper", "platinum", locks={"item": "Choice Scarf"})
        self.assertEqual(r["build"]["item"], "Choice Scarf")
        self.assertFalse(r["reached"])                          # a Choice lock and a setup move don't mix
        r = self.solver.solve("Skarmory", "hazard_setter", "platinum",
                              locks={"nature": "Impish", "evs": {"hp": 252, "def": 252, "spd": 4}})
        self.assertEqual((r["build"]["nature"], r["build"]["evs"]["def"]), ("Impish", 252))
        self.assertEqual(r["dead_moves"], [])                   # never a do-nothing move to pull another role down
        flags = self.solver.check_locks("Garchomp", "platinum", {"moves": ["Sludge Bomb"], "item": "Choice Scarf"})
        self.assertEqual(flags, ["Sludge Bomb: Garchomp can't learn it in this game"])
        self.assertIn("Choice Scarf doesn't exist in Gen 3",
                      self.solver.check_locks("Salamence", "emerald", {"item": "Choice Scarf"}))

    def test_unreachable_roles_say_what_they_need(self):
        r = self.solver.solve("Gengar", "special_setup_sweeper", "platinum")
        self.assertIsNone(r["build"])
        self.assertIn("Special Attack setup or Speed setup", r["unreachable"])
        self.assertIn("Ghost type", self.solver.solve("Garchomp", "spinblocker", "platinum")["unreachable"])

    def test_suggestions_stay_legal_for_the_game(self):
        self.assertNotIn("Choice Scarf", self.solver.items("Salamence", 3))   # Gen IV item, not in Emerald
        self.assertNotIn("Black Sludge", self.solver.items("Garchomp", 4))    # only worth it on a Poison type
        self.assertIn("Black Sludge", self.solver.items("Crobat", 4))
        self.assertNotIn("Light Ball", self.solver.items("Raichu", 4))        # species items only for their species
        self.assertIn("Spore", self.era_learnable("Smeargle"))                # Sketch (era_corrections.json)
        legal = self.solver.legal_moves("Garchomp", "platinum")
        self.assertNotIn("Dragon Dance", legal)
        anywhere = self.solver.legal_moves("Garchomp", "platinum", scope="any")
        self.assertEqual(set(legal) - set(anywhere), set())

    def era_learnable(self, species):
        return self.store.era.learnable(species, "platinum")

    def test_hidden_power_sets_its_ivs(self):
        from trainers.solver import hidden_power, hp_ivs
        for t in ("Fire", "Ice", "Ground", "Fighting", "Grass"):
            ivs = hp_ivs(t, {s: 31 for s in ("hp", "atk", "def", "spa", "spd", "spe")})
            self.assertEqual(hidden_power(ivs), (t, 70))
            self.assertTrue(all(v in (30, 31) for v in ivs.values()))
        tr = hp_ivs("Fire", {"hp": 31, "atk": 31, "def": 31, "spa": 31, "spd": 31, "spe": 0})
        self.assertLessEqual(tr["spe"], 3)                       # a Trick Room build keeps its Speed low

    def test_archetypes_distance_and_the_external_rule(self):
        import copy
        from trainers.model import Build
        a = self.solver.archetypes("Garchomp", "platinum", derived=False)
        self.assertEqual({x["id"] for x in a["library"]},
                         {"stock/garchomp-sweeper", "stock/garchomp-earthquake", "stock/garchomp-outrage"})
        self.assertTrue(all(x["source"] and x["generation"] for x in a["library"]))
        mine = copy.deepcopy(self.store.library["stock/garchomp-sweeper"])
        mine.id, mine.source, mine.item = "mine/chomp", "mine", "Choice Band"
        d = self.solver.distance(mine, "platinum")
        self.assertEqual(d["stock"]["line"], "Swords Dance sweeper, differs on item (Choice Band → Life Orb)")
        self.assertFalse(self.solver.trusted(Build(id="x", species="Garchomp", source="external:")))
        self.assertFalse(self.solver.trusted(Build(id="x", species="Garchomp", source="external: a forum post")))
        self.assertTrue(self.solver.trusted(Build(id="x", species="Garchomp", source="external: a forum post",
                                                  generation=4)))
        open_build = Build(id="x", species="Snorlax", moves=["Curse", "Body Slam", "Rest", "Sleep Talk"])
        self.assertEqual(self.solver.distance(open_build, "platinum")["stock"]["differences"], [])   # open ≠ different


class TrainerPlaysheet(unittest.TestCase):
    """Part 2, steps 3-4: careers, the playsheet, combos and the aggression ratio, joined to the report."""
    @classmethod
    def setUpClass(cls):
        from trainers.model import Store
        from trainers.report import build_report
        cls.store = Store()
        cls.report = staticmethod(build_report)
        cls.paul = build_report(cls.store, "paul", "sinnoh")

    def _text(self, rep):
        return [p["text"] for lines in rep["playsheet"]["text"].values() for p in lines]

    def test_one_unified_report(self):
        sh = self.paul["playsheet"]
        self.assertEqual(self.paul["schema"], "trainer-report/2")
        self.assertTrue({"career", "roles", "ace", "go_to", "type_read", "combos", "signature_moves", "aggression",
                         "text"} <= set(sh))
        self.assertEqual(len(sh["roles"]), 6)
        ninjask = next(r for r in sh["roles"] if r["species"] == "Ninjask")
        self.assertEqual(ninjask["primary"]["role"], "baton_pass_starter")

    def test_career_tags_come_from_the_records_and_each_changes_a_line(self):
        names = lambda rep: {t["name"] for t in rep["tags"]}
        self.assertTrue({"Multi-Region Traveler", "Alola Champion", "Orange League Champion"} <= names(
            self.report(self.store, "ash", "all-time")))
        kanto = self.report(self.store, "ash", "kanto")
        self.assertNotIn("Multi-Region Traveler", names(kanto))          # only the records Kanto Ash has lived
        self.assertNotIn("Alola Champion", names(kanto))
        self.assertIn("Elite Four Beaten", names(self.report(self.store, "red")))
        for tid, vid, mark in (("ash", "all-time", "multi_region"), ("red", None, "elite_four"),
                               ("cynthia", None, "champion")):
            t = self.store.trainers[tid]
            saved = t.career
            on = self._text(self.report(self.store, tid, vid))
            if mark == "multi_region":
                t.career = [r for r in saved if r["region"] in ("Kanto", "World")]
            else:
                t.career = [{k: v for k, v in r.items() if k != ("elite_four" if mark == "elite_four" else "champion")}
                            for r in saved]
            try:
                self.assertNotEqual(on, self._text(self.report(self.store, tid, vid)), f"{tid}: {mark} changes no line")
            finally:
                t.career = saved

    def test_the_ace_shows_story_and_data_when_they_differ(self):
        from trainers.model import Store
        store = Store()                                                # a story ace the team doesn't back
        store.trainers["paul"].versions["sinnoh"].overrides["ace"] = "Electivire"
        paul = self.report(store, "paul")
        a = paul["playsheet"]["ace"]
        self.assertEqual((a["authored"], a["derived"], a["agree"]), ("Electivire", "Torterra", False))
        line = paul["playsheet"]["text"]["ace"][0]["text"]
        self.assertTrue("Electivire" in line and "Torterra" in line)
        red = self.report(self.store, "red")["playsheet"]["ace"]
        self.assertEqual((red["derived"], red["agree"]), ("Pikachu", True))    # the Lv 88 Pikachu
        self.assertEqual(self.report(self.store, "cynthia")["playsheet"]["ace"]["derived"], "Garchomp")
        lance = self.report(self.store, "lance")["playsheet"]["ace"]           # the game marks its ace by level
        self.assertEqual((lance["derived"], lance["ranking"][0]["sent_out"], lance["agree"]), ("Dragonite", "last", True))

    def test_go_to_by_game_state(self):
        g = self.paul["playsheet"]["go_to"]
        self.assertEqual((g["even"]["label"], g["ahead"]["label"], g["behind"]["label"]), ("workhorse", "cleaner", "gambit"))
        self.assertTrue(all(g[s]["species"] for s in ("even", "ahead", "behind")))
        lance = self.report(self.store, "lance")["playsheet"]["go_to"]["behind"]["last_resorts"]
        self.assertIn({"species": "Gyarados", "moves": ["Flail"], "item": None}, lance)

    def test_type_read_pairs_with_part_1(self):
        brock = self.report(self.store, "brock")
        tr = brock["playsheet"]["type_read"]
        per = brock["matrix"]["summary"]["per_type"]
        for r in tr["rows"]:
            self.assertEqual(r["their_weak_to_it"], per[r["type"]]["weak_total"])
        self.assertIn("Fighting", tr["holes"])
        self.assertEqual(tr["bring"][0], {"type": "Fighting", "their_weak": 5})
        self.assertEqual(tr["covered_n"] + len(tr["holes"]), 17)

    def test_every_combo_has_a_sentence_and_fires_where_present(self):
        from trainers.model import Build, Version
        from trainers.playsheet import combos, read_team
        from trainers.roles import RoleBook
        ids = [c["id"] for c in self.store.config["playsheet"]["combos"]["list"]]
        rules = {r["id"]: r for r in __import__("json").load(open(os.path.join(ENGINE, "trainers", "phrases.json")))["playsheet"]}
        for cid in ids:
            self.assertTrue(any(["combos", "has", cid] in r["when"] for r in rules.values()), cid)
        self.assertNotIn("baton_chain", [c["id"] for c in self.paul["playsheet"]["combos"]])   # Bulbapedia: no Baton Pass
        me = self.report(self.store, "me", "heartgold")["playsheet"]["combos"]
        self.assertEqual([(c["id"], c["members"]) for c in me], [("dd_priority", ["Tyranitar"])])
        B = lambda sp, moves, **k: Build(id=f"t/{sp}", species=sp, moves=moves, **k)
        team = [B("Politoed", ["Rain Dance", "Surf", "Hypnosis", "Ice Beam"]),
                B("Kingdra", ["Thunder", "Hydro Pump", "Draco Meteor", "Rain Dance"], ability="Swift Swim"),
                B("Bronzong", ["Trick Room", "Gyro Ball", "Earthquake", "Explosion"], ivs={"spe": 0}),
                B("Snorlax", ["Rest", "Sleep Talk", "Body Slam", "Earthquake"]),
                B("Skarmory", ["Spikes", "Whirlwind", "Roost", "Toxic"]),
                B("Breloom", ["Substitute", "Focus Punch", "Spore", "Seed Bomb"]),
                B("Ninjask", ["Swords Dance", "Baton Pass", "Protect", "X-Scissor"], ability="Speed Boost")]
        version = Version(id="t", trainer="me", title="t", game="platinum", team_ref={})
        book = RoleBook(self.store)
        reads, weather = read_team(book, version, team)
        found = {c["id"] for c in combos(self.store, book, reads, weather)}
        self.assertTrue({"rain_swift_thunder", "sleep_absorb", "hazards_phaze", "sub_punch", "baton_chain"} <= found, found)

    def test_aggression_ratio_against_the_offense_slider(self):
        brock = self.report(self.store, "brock")["playsheet"]["aggression"]
        self.assertEqual((brock["flag"]["leans"], brock["flag"]["part1_flags_it"]), ("offensive", False))
        self.assertIsNone(self.paul["playsheet"]["aggression"]["flag"])
        v = self.store.version("paul", "sinnoh")
        saved = v.sliders["offense"]["value"]
        v.sliders["offense"]["value"] = 10                      # Part 1 now flags the same lean
        try:
            rep = self.report(self.store, "paul", "sinnoh")
            self.assertTrue(rep["playsheet"]["aggression"]["flag"]["part1_flags_it"])
            text = " ".join(p["text"] for p in rep["playsheet"]["text"]["aggression"])
            self.assertIn("the same lean", text)                 # referred to, not flagged twice
            self.assertNotIn("trust the moves", text)
        finally:
            v.sliders["offense"]["value"] = saved

    def test_signature_moves_are_authored_and_checked_against_the_build(self):
        sigs = self.report(self.store, "ash", "all-time")["playsheet"]["signature_moves"]
        tackle = next(s for s in sigs if s["move"] == "Volt Tackle")
        self.assertTrue(tackle["in_moveset"])
        self.assertEqual(self.report(self.store, "brock")["playsheet"]["signature_moves"], [])
        self.assertIn("No signature moves authored", " ".join(
            p["text"] for p in self.report(self.store, "brock")["playsheet"]["text"]["signature"]))

    def test_the_playsheet_is_deterministic(self):
        import json as _json
        a = _json.dumps(self.report(self.store, "paul", "sinnoh")["playsheet"], sort_keys=True, default=list)
        b = _json.dumps(self.report(self.store, "paul", "sinnoh")["playsheet"], sort_keys=True, default=list)
        self.assertEqual(a, b)


class Intake(unittest.TestCase):
    """The intake inbox (docs/INGEST.md): sources become cards of proposed claims; nothing reaches canon unapproved."""
    def setUp(self):
        import shutil
        from ingest.cards import Inbox
        self.tmp = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.tmp, "canon"))
        for f in ("trainers.json", "build_library.json"):
            shutil.copy(os.path.join(ENGINE, "canon", f), os.path.join(self.tmp, "canon", f))
        self.inbox = Inbox(base=self.tmp)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp)

    def _envelope(self):
        """A hand-written test envelope in the analyzer's shape (not a model result)."""
        return {"app": "test", "lens": "pokemon", "source": {"platform": "YOUTUBE", "url": "https://youtu.be/abc123xyz",
                                                             "key": "abc123xyz", "creator": "A Nature Channel", "analysed": "video"},
                "analysis": {"provider": "Gemini", "model": "test"},
                "result": {"summary": "A Garchomp hunts at dusk.", "transcript": [], "on_screen_text": [],
                           "observations": [], "limitations": [],
                           "pokemon": {"videoType": "NATURE_DOCUMENTARY",
                                       "species": [{"name": "Garchomp", "confidence": "HIGH"}],
                                       "behaviors": [{"species": "Garchomp", "behavior": "hunts by gliding low over sand",
                                                      "context": "dusk", "at": "00:42"}],
                                       "habitats": [{"species": "Garchomp", "habitat": "desert caves", "time_of_day": "dusk",
                                                     "at": "00:10"}],
                                       "battle": [], "lore": [],
                                       "builds": [{"species": "Garchomp", "moves": ["Earthquake", "Outrage"],
                                                   "game_or_generation": "Platinum", "at": "02:00"}],
                                       "style": {"narration_voice": "a calm, low narrator", "pacing": "slow",
                                                 "tone": "reverent", "structure": ["dawn", "the hunt", "night"],
                                                 "shots": [{"at": "00:05", "framing": "wide aerial", "camera_move": "slow push-in",
                                                            "subject": "the dunes"}]}}}}

    def test_an_envelope_becomes_one_card_of_proposed_claims_with_sources(self):
        from ingest.media import to_card
        card, made = to_card(self.inbox, self._envelope())
        self.assertTrue(made)
        kinds = [c["kind"] for c in card["claims"]]
        self.assertEqual(kinds, ["field_note", "field_note", "build", "style_card"])
        self.assertTrue(all(c["status"] == "proposed" for c in card["claims"]))
        self.assertEqual(card["claims"][0]["source_ref"], "https://youtu.be/abc123xyz @ 00:42")
        self.assertEqual(card["claims"][2]["data"]["generation"], 4)          # "Platinum" read as Gen 4
        again, made = to_card(self.inbox, self._envelope())
        self.assertFalse(made)                                                # the same video is the same card

    def test_nothing_lands_until_approved_and_each_kind_lands_in_its_place(self):
        from ingest.media import to_card
        card, _ = to_card(self.inbox, self._envelope())
        self.assertEqual(self.inbox.apply(), [])                              # nothing approved, nothing written
        self.inbox.approve(card["id"])
        out = self.inbox.apply()
        self.assertEqual(len(out), 4)
        with open(os.path.join(self.tmp, "canon", "field_notes.jsonl"), encoding="utf-8") as fh:
            notes = [json.loads(l) for l in fh]
        self.assertEqual((notes[0]["species"], notes[0]["provenance"], notes[0]["card"]),
                         ("Garchomp", "ingested", card["id"]))
        with open(os.path.join(self.tmp, "canon", "build_library.json"), encoding="utf-8") as fh:
            lib = json.load(fh)["builds"]
        new = [b for b in lib.values() if b.get("source", "").startswith("external: https://youtu.be/abc123xyz")]
        self.assertEqual(len(new), 1)                                        # external, with its source
        self.inbox.apply()
        with open(os.path.join(self.tmp, "canon", "field_notes.jsonl"), encoding="utf-8") as fh:
            self.assertEqual(len(fh.readlines()), 2)                          # applying twice doesn't duplicate

    def test_a_claim_missing_what_its_kind_needs_waits_for_an_edit(self):
        c = self.inbox.claim("build", {"species": "Garchomp", "moves": ["Earthquake"]})
        card, _ = self.inbox.new("note", "chomp", {"title": "a note"}, "ingested", "", [c])
        msg = self.inbox.approve(card["id"], "c1")
        self.assertIn("needs generation", msg[0])
        self.inbox.edit(card["id"], "c1", "generation", "4")
        self.assertEqual(self.inbox.approve(card["id"], "c1"), [f"{card['id']}:c1 approved"])

    def test_rejections_and_corrections(self):
        fix = self.inbox.claim("correction", {"target": "canon/trainers.json:trainers.paul.career.0.status",
                                              "value": "confirmed", "why": "Serebii episode guide"})
        bad = self.inbox.claim("correction", {"target": "canon/trainers.json:trainers.paul.name", "value": "Shinji",
                                              "why": "test"})
        card, _ = self.inbox.new("note", "paul", {"title": "research"}, "ingested", "", [fix, bad])
        self.inbox.approve(card["id"], "c1")
        self.inbox.reject(card["id"], "c2", why="names stay as they are")
        out = self.inbox.apply(card["id"])
        self.assertEqual(len(out), 1)
        with open(os.path.join(self.tmp, "canon", "trainers.json"), encoding="utf-8") as fh:
            self.assertEqual(json.load(fh)["trainers"]["paul"]["career"][0]["status"], "confirmed")
        self.assertEqual(self.inbox.load(card["id"])["claims"][1]["status"], "rejected")
        rogue = self.inbox.claim("correction", {"target": "canon/trainers.json:trainers.paul.name", "value": "x",
                                                "why": "x"})
        card2, _ = self.inbox.new("note", "rogue", {"title": "x"}, "ingested", "", [rogue])
        self.inbox.approve(card2["id"])
        with self.assertRaises(PermissionError):                              # only allowed paths can change
            self.inbox.apply(card2["id"])

    def test_the_gemini_call_and_answer(self):
        from ingest.media import Gemini, parse_response, platform_of, video_key
        cfg = self.inbox.cfg
        g = Gemini(cfg)
        url, headers, body = g.request([{"file_data": {"file_uri": "https://youtu.be/abc123xyz"}}, {"text": "go"}])
        self.assertTrue(url.endswith(f"/models/{cfg['gemini']['model']}:streamGenerateContent?alt=sse"))
        self.assertEqual(body["generationConfig"]["responseMimeType"], "application/json")
        result, usage, _ = parse_response({"candidates": [{"content": {"parts": [{"text": "```json\n{\"summary\": \"x\"}\n```"}]}}],
                                           "usageMetadata": {"totalTokenCount": 10}})
        self.assertEqual((result, usage["totalTokenCount"]), ({"summary": "x"}, 10))
        from ingest.media import parse_stream
        streamed = [{"candidates": [{"content": {"parts": [{"text": '{"summ'}]}}]},
                    {"candidates": [{"content": {"parts": [{"text": 'ary": "y"}'}]}}], "usageMetadata": {"totalTokenCount": 7}}]
        self.assertEqual(parse_stream(streamed)[:2], ({"summary": "y"}, {"totalTokenCount": 7}))
        self.assertTrue(platform_of("https://www.youtube.com/watch?v=abc", cfg)[1]["direct_to_model"])
        self.assertFalse(platform_of("https://www.tiktok.com/@a/video/7696546463953718541", cfg)[1]["direct_to_model"])
        self.assertEqual(video_key("https://www.tiktok.com/@a/video/7696546463953718541"), "7696546463953718541")

    def test_a_fan_work_is_marked_and_a_link_gets_its_title(self):
        """A fan animation's 'facts' are its interpretation: every claim says so. A link's title and creator come
        from the site's oEmbed answer (no download, no sign-in)."""
        import io
        import urllib.request
        from unittest import mock
        from ingest.media import link_metadata, to_card
        env = self._envelope()
        env["result"]["pokemon"]["videoType"] = "FAN_ANIMATION"
        env["source"]["title"] = "Life of a Garchomp"
        card, _ = to_card(self.inbox, env)
        facts = [c for c in card["claims"] if c["kind"] != "style_card"]
        self.assertTrue(all(c["data"].get("fan_work") and "not canon" in c["note"] for c in facts))
        style = [c for c in card["claims"] if c["kind"] == "style_card"][0]
        self.assertEqual(style["data"]["name"], "A Nature Channel · Life of a Garchomp")
        answer = io.BytesIO(b'{"title": "Life of a Torterra", "author_name": "A Channel", '
                            b'"author_url": "https://www.youtube.com/@AChannel"}')
        with mock.patch.object(urllib.request, "urlopen", return_value=answer) as call:
            meta = link_metadata("https://www.youtube.com/watch?v=abc123xyz", self.inbox.cfg)
        self.assertIn("youtube.com/oembed", call.call_args[0][0].full_url)
        self.assertEqual(meta, {"title": "Life of a Torterra", "creator": "A Channel", "handle": "@AChannel"})

    def test_without_a_key_it_says_so_and_writes_nothing(self):
        """No key in the session (a network secret would add it on the way out): Gemini's refusal becomes a
        plain 'add the key' message, and nothing is written."""
        import io
        import urllib.error
        import urllib.request
        from unittest import mock
        from ingest.media import Gemini, NotReady, analyze
        saved = os.environ.pop(self.inbox.cfg["gemini"]["key_env"], None)
        refusal = urllib.error.HTTPError("https://generativelanguage.googleapis.com", 403, "Forbidden", {},
                                         io.BytesIO(b'{"error": {"status": "PERMISSION_DENIED", "message": "Method doesn\'t allow unregistered callers"}}'))
        try:
            self.assertEqual(Gemini(self.inbox.cfg).request([])[1].get("x-goog-api-key"), None)   # left to the proxy
            with mock.patch.object(urllib.request, "urlopen", side_effect=refusal):
                with self.assertRaises(NotReady) as ctx:
                    analyze(self.inbox.cfg, "pokemon", "video", "https://youtu.be/abc123xyz")
            self.assertIn("network secret", str(ctx.exception))
        finally:
            if saved:
                os.environ[self.inbox.cfg["gemini"]["key_env"]] = saved
        self.assertEqual(self.inbox.all(), [])

    def test_a_food_os_envelope_has_the_same_core(self):
        """Food OS and this analyzer share the envelope; a food-lens result simply has no pokemon block."""
        from ingest.media import claims_from
        food = {"source": {"platform": "TIKTOK", "url": "https://www.tiktok.com/@x/video/1"},
                "result": {"summary": "a steakhouse", "transcript": [], "foodos": {"places": []}}}
        self.assertEqual(claims_from(self.inbox, food, self.inbox.cfg["lenses"]["pokemon"]), [])

    def test_a_paste_becomes_builds_read_by_the_engine(self):
        from ingest.builds import to_card
        paste = "Garchomp @ Life Orb\nAbility: Sand Veil\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Swords Dance\n- Earthquake\n- Outrage\n- Fire Fang"
        card, _ = to_card(self.inbox, paste, "platinum")
        c = card["claims"][0]
        self.assertEqual((card["provenance"], c["data"]["generation"]), ("authored", 4))
        self.assertIn("physical setup sweeper", c["note"])
        self.assertIn("Swords Dance sweeper", c["note"])                     # its closest archetype
        self.inbox.approve(card["id"])
        self.inbox.apply(card["id"])
        with open(os.path.join(self.tmp, "canon", "build_library.json"), encoding="utf-8") as fh:
            mine = [b for b in json.load(fh)["builds"].values() if b.get("source") == "mine"]
        self.assertEqual(mine[0]["species"], "Garchomp")

    def test_the_documentary_kit_only_says_what_the_field_notes_support(self):
        from ingest.docprompt import kit
        from ingest.media import to_card
        self.assertIn("no approved field notes", kit(self.inbox.cfg, "Garchomp", base=self.tmp)["error"])
        card, _ = to_card(self.inbox, self._envelope())
        self.inbox.approve(card["id"])
        self.inbox.apply()
        k = kit(self.inbox.cfg, "Garchomp", base=self.tmp)
        self.assertIn("hunts by gliding low over sand", k["narration_brief"])
        self.assertIn("wide aerial", k["shots"][0])
        self.assertIn("https://youtu.be/abc123xyz @ 00:42", k["grounded_in"])


FILM_LOG = """|player|p1|Alice|1|1500
|player|p2|Bob|2|1450
|teamsize|p1|3
|teamsize|p2|3
|gen|4
|tier|[Gen 4] OU
|start
|switch|p1a: Rocky|Swampert, M|100/100
|switch|p2a: Gengar|Gengar, M|100/100
|turn|1
|c|Alice|good luck
|move|p2a: Gengar|Trick|p1a: Rocky
|-activate|p2a: Gengar|move: Trick|[of] p1a: Rocky
|-item|p1a: Rocky|Choice Scarf|[from] move: Trick
|-item|p2a: Gengar|Leftovers|[from] move: Trick
|move|p1a: Rocky|Stealth Rock|p2a: Gengar
|-sidestart|p2: Bob|move: Stealth Rock
|upkeep
|turn|2
|switch|p2a: Tar|Tyranitar, F|100/100
|-damage|p2a: Tar|88/100|[from] Stealth Rock
|-weather|Sandstorm|[from] ability: Sand Stream|[of] p2a: Tar
|move|p1a: Rocky|Earthquake|p2a: Tar
|-supereffective|p2a: Tar
|-damage|p2a: Tar|20/100
|upkeep
|turn|3
|move|p1a: Rocky|Earthquake|p2a: Tar
|-damage|p2a: Tar|0 fnt
|faint|p2a: Tar
|upkeep
|switch|p2a: Gengar|Gengar, M|100/100
|-damage|p2a: Gengar|88/100|[from] Stealth Rock
|turn|4
|move|p2a: Gengar|Explosion|p1a: Rocky
|-damage|p1a: Rocky|0 fnt
|faint|p2a: Gengar
|faint|p1a: Rocky
|upkeep
|switch|p1a: Zap|Zapdos|100/100
|switch|p2a: Bird|Skarmory, F|100/100
|turn|5
|move|p1a: Zap|U-turn|p2a: Bird
|-resisted|p2a: Bird
|-damage|p2a: Bird|95/100
|switch|p1a: Jira|Jirachi|100/100|[from] U-turn
|move|p2a: Bird|Brave Bird|p1a: Jira
|-resisted|p1a: Jira
|-damage|p1a: Jira|80/100
|-damage|p2a: Bird|90/100|[from] Recoil
|-heal|p1a: Jira|86/100|[from] item: Leftovers
|upkeep
|turn|6
|move|p1a: Jira|Iron Head|p2a: Bird
|-resisted|p2a: Bird
|-damage|p2a: Bird|0 fnt
|faint|p2a: Bird
|win|Alice
"""


class FilmRoom(unittest.TestCase):
    """The film room (docs/FILM.md): Showdown replays read turn by turn. FILM_LOG is a hand-written log in
    Showdown's protocol (not a real battle), built to exercise every rule once."""
    @classmethod
    def setUpClass(cls):
        import copy
        from film.replays import load_config
        from film.study import Reader
        from trainers.model import Store
        from trainers.roles import RoleBook
        from trainers.solver import Solver
        cls.cfg = copy.deepcopy(load_config())
        cls.store = Store()
        cls.book = RoleBook(cls.store)
        cls.reader = Reader(cls.store, cls.book, Solver(cls.book), cls.cfg)

    def battle(self):
        from film.study import parse_replay
        return parse_replay({"id": "gen4ou-1", "log": FILM_LOG, "formatid": "gen4ou", "uploadtime": 1792000000},
                            self.reader, 4, self.cfg)

    def test_order_builds_and_who_did_what(self):
        b = self.battle()
        p1, p2 = b["sides"]["p1"], b["sides"]["p2"]
        self.assertEqual((p1["order"], p2["order"]), (["Swampert", "Zapdos", "Jirachi"], ["Gengar", "Tyranitar", "Skarmory"]))
        self.assertEqual((b["winner"], b["turns"], b["last_ko"]["species"]), ("p1", 6, "Jirachi"))
        mon = {m["species"]: m for s in (p1, p2) for m in s["members"]}
        self.assertEqual(mon["Swampert"]["item"], "Leftovers")          # a Trick reveals both starting items
        self.assertEqual(mon["Gengar"]["item"], "Choice Scarf")
        self.assertEqual((mon["Tyranitar"]["ability"], mon["Jirachi"]["item"]), ("Sand Stream", "Leftovers"))
        self.assertEqual(mon["Swampert"]["moves"], ["Stealth Rock", "Earthquake"])   # first-shown order
        self.assertEqual(mon["Swampert"]["uses"]["Earthquake"], 2)
        self.assertEqual(mon["Gengar"]["fainted_by"], "self: Explosion")
        self.assertEqual(mon["Swampert"]["fainted_by"], "Gengar (Explosion)")     # Explosion's knockout is Gengar's
        self.assertEqual([k["target"] for k in mon["Swampert"]["kos"]], ["Tyranitar"])
        self.assertEqual([st["in"] for st in mon["Gengar"]["stints"]], ["lead", "forced"])
        self.assertEqual(mon["Jirachi"]["stints"][0]["in"], "pivot")             # U-turn brought it in
        switches = [(r["side"], r["how"]) for r in b["rows"] if r["kind"] == "switch"]
        self.assertEqual(switches, [("p2", "voluntary"), ("p2", "forced"), ("p1", "forced"), ("p2", "forced"), ("p1", "pivot")])
        boom = next(r for r in b["rows"] if r.get("move") == "Explosion")
        self.assertEqual((boom["before"]["state"], boom["before"]["alive"], boom["group"]), ("behind", 2, "self_ko"))
        self.assertNotIn("good luck", json.dumps(b))                          # chat is never stored

    def test_a_study_reads_order_builds_and_game_state(self):
        from film.study import Study
        st = Study(self.reader, "gen4ou", self.cfg["formats"]["gen4ou"], who="Alice")
        st.add(self.battle())
        r = st.result()
        self.assertEqual((r["battles"], r["wins"], r["win_rate"]), (1, 1, 100))
        self.assertEqual(r["leads"][0]["species"], "Swampert")
        self.assertEqual(r["leads"][0]["first_move"][0]["name"], "Stealth Rock")
        self.assertEqual(r["order"]["closers"][0]["name"], "Jirachi")
        self.assertEqual({h["name"] for h in r["order"]["held_back"]}, {"Zapdos", "Jirachi"})
        self.assertEqual(r["pressure"]["after_faint"][0]["species"], "Zapdos")
        swampert = next(c for c in r["sets"] if c["species"] == "Swampert")
        self.assertEqual(swampert["variants"][0]["item"], "Leftovers")
        self.assertIn("hazard setter", swampert["variants"][0]["name"])
        self.assertIsNotNone(r["aggression"]["ratio"])
        self.assertEqual(r["examples"]["lead|Swampert"], ["gen4ou-1"])

    def test_variants_split_on_what_sets_share(self):
        from film.study import Study
        st = Study(self.reader, "gen4ou", self.cfg["formats"]["gen4ou"])
        rows = [(["Stealth Rock", "Crunch", "Pursuit", "Thunder Wave"], "Leftovers"),
                (["Crunch", "Pursuit"], None), (["Stealth Rock", "Crunch", "Earthquake"], "Leftovers"),
                (["Dragon Dance", "Crunch", "Earthquake", "Stone Edge"], "Life Orb"), (["Dragon Dance", "Stone Edge"], None),
                (["Crunch"], None)]
        for i, (moves, item) in enumerate(rows):
            st.sets["Tyranitar"].append({"moves": moves, "item": item, "ability": "Sand Stream", "battle": f"b{i}", "won": i % 2 == 0})
        variants, unread = st.variants("Tyranitar")
        self.assertEqual(unread, 1)                                        # one move shown: too little to read
        self.assertEqual([v["battles"] for v in variants], [3, 2])
        self.assertIn("Stealth Rock", variants[0]["moves"])
        self.assertIn("Dragon Dance", variants[1]["moves"])
        self.assertEqual(variants[1]["item"], "Life Orb")

    def test_a_study_becomes_a_card_filed_under_its_trainer(self):
        import copy
        import shutil
        from film.cards import to_card
        from film.study import Study
        from ingest.cards import Inbox
        cfg = copy.deepcopy(self.cfg)
        cfg["cards"]["players"] = {"alice": "me"}
        cfg["cards"]["observation_min_seen"] = 1
        tmp = tempfile.mkdtemp()
        try:
            os.makedirs(os.path.join(tmp, "canon"))
            for f in ("trainers.json", "build_library.json"):
                shutil.copy(os.path.join(ENGINE, "canon", f), os.path.join(tmp, "canon", f))
            inbox = Inbox(base=tmp)
            st = Study(self.reader, "gen4ou", cfg["formats"]["gen4ou"], who="Alice")
            st.add(self.battle())
            card, made = to_card(inbox, cfg, st.result())
            obs = [c for c in card["claims"] if c["kind"] == "observation"]
            self.assertTrue(made and obs)
            self.assertTrue(all(c["data"]["trainer"] == "me" and c["data"]["gen"] == 4 for c in obs))
            lead = next(c for c in obs if c["data"]["situation"] == "lead")
            self.assertEqual((lead["data"]["pokemon"], lead["data"]["move"]), ("Swampert", "Stealth Rock"))
            self.assertEqual(lead["source_ref"], "https://replay.pokemonshowdown.com/gen4ou-1")
            self.assertTrue(all(c["status"] == "proposed" for c in card["claims"]))   # nothing lands unapproved
            builds = [c for c in card["claims"] if c["kind"] == "build"]
            self.assertTrue(all(c["data"]["generation"] == 4 for c in builds))
        finally:
            shutil.rmtree(tmp)

    def test_approved_observations_show_on_the_playsheet(self):
        from trainers.playsheet import film_lines, observed
        v = self.store.version("me", "platinum")
        tmp = tempfile.mkdtemp()
        path = os.path.join(tmp, "observations.jsonl")
        rows = [{"trainer": "me", "version": None, "gen": 4, "battle": "Showdown Gen 4 OU, Alice (9 battles)",
                 "situation": "lead", "pokemon": "Swampert", "move": "Stealth Rock", "outcome": "led 7 of 9", "sample_size": 7},
                {"trainer": "me", "version": None, "gen": 4, "battle": "Showdown Gen 4 OU, Alice (9 battles)",
                 "situation": "all states", "pokemon": "team", "move": "finishing moves", "outcome": "61%", "value": 61,
                 "sample_size": 80},
                {"trainer": "me", "version": None, "gen": 3, "situation": "lead", "pokemon": "Metagross", "move": "x",
                 "outcome": "other generation", "sample_size": 9},
                {"trainer": "ash", "version": None, "gen": 4, "situation": "lead", "pokemon": "Pikachu", "move": "x",
                 "outcome": "someone else", "sample_size": 9},
                {"trainer": "me", "version": "platinum", "battle": "the final", "situation": "sent out", "pokemon": "Gengar",
                 "move": "sent out last", "position": 6, "outcome": "x", "sample_size": 1},
                {"trainer": "me", "version": "platinum", "battle": "the final", "situation": "sent out", "pokemon": "Lucario",
                 "move": "sent out #2", "position": 2, "outcome": "x", "sample_size": 1}]
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(json.dumps(r) for r in rows))
        f = observed(self.store, v, path)
        self.assertEqual((f["n"], f["aggression"], [x["pokemon"] for x in f["lead"]]), (4, 61, ["Swampert"]))
        self.assertEqual([x["pokemon"] for x in f["sent_out"]], ["Lucario", "Gengar"])     # in the order they came out
        sheet = {"observed": f, "go_to": {s: {"species": None} for s in ("even", "ahead", "behind")},
                 "ace": {"derived": "Typhlosion"}, "aggression": {"ratio": 55, "offense_authored": 70}}
        lines = film_lines(sheet)
        self.assertIn("Leads with Swampert", lines[0])
        self.assertTrue(any("61%" in l and "55%" in l for l in lines))
        self.assertIn("In the final: Lucario (#2) → Gengar (last).", lines)
        import shutil
        shutil.rmtree(tmp)

    def test_search_filters_and_the_cache(self):
        from unittest import mock
        from film import replays
        cfg = self.cfg
        page = [{"id": "gen4ou-5", "rating": 1100, "uploadtime": 5}, {"id": "smogtours-gen4ou-4", "uploadtime": 4},
                {"id": "gen4ou-3", "rating": 1500, "uploadtime": 3}, {"id": "gen4ou-2", "rating": 1600, "private": 1, "uploadtime": 2}]
        with mock.patch.object(replays, "search", return_value=page):
            self.assertEqual([e["id"] for e in replays.collect(cfg, "gen4ou", min_rating=1300, pages=1)],
                             ["smogtours-gen4ou-4", "gen4ou-3"])          # tournament games pass the rating floor
            self.assertEqual([e["id"] for e in replays.collect(cfg, "gen4ou", tournaments=True, pages=1)],
                             ["smogtours-gen4ou-4"])
        tmp = tempfile.mkdtemp()
        with mock.patch.object(replays, "_get", return_value={"id": "gen4ou-9", "log": "|turn|1", "password": None}) as call:
            replays.fetch(cfg, "gen4ou-9", base=tmp)
            replays.fetch(cfg, "gen4ou-9", base=tmp)
        self.assertEqual(call.call_count, 1)                               # the second read is the cache
        self.assertEqual(replays.player_id("Mr_D15951"), "mrd15951")
        import shutil
        shutil.rmtree(tmp)

    def test_forms_read_as_their_species(self):
        from refdb import Ref
        ref = Ref(os.path.join(ENGINE, "data", "pokeref.sqlite"))
        self.assertEqual(ref.species_id("Rotom-Heat"), ref.species_id("Rotom"))
        self.assertEqual(ref.species_id("Gastrodon-East"), ref.species_id("Gastrodon"))
        self.assertEqual(ref.abilities("Shaymin-Sky", 4), ["Serene Grace"])
        self.assertEqual(ref.abilities("Shaymin", 4), ["Natural Cure"])
        self.assertEqual(self.store.era.types("Arceus-Bug", 4), ("Bug",))

WIKI_POKEMON = """{{AnimePokémonInfobox
|trainername=Paul
|pokemonname=Torterra
|ability={{a|Overgrow}}
}}
==History==
==={{aniseries|DP}}===
Paul caught a {{p|Turtwig}}. It used {{m|Tackle}} and {{m|Razor Leaf}} early on, then {{m|Razor Leaf}} again.
Much later, as Torterra, it used {{m|Leaf Storm}} and {{m|Stone Edge}}, then {{m|Leaf Storm}} once more and
{{m|Frenzy Plant}}, finishing with {{m|Leaf Storm}} against [[Ash's Infernape]].
==={{aniseries|JN}}===
It used {{m|Earthquake}} and {{m|Earthquake}} and {{m|Earthquake}}.
==Moves used==
{{anmov/h|grass|ground|Paul Torterra.png|Using Leaf Storm}}
{{anmov|normal|Tackle|DP003|When Pokémon Worlds Collide!}}
{{anmov|grass|Razor Leaf|DP003|When Pokémon Worlds Collide!}}
{{anmov|grass|Leaf Storm|DP120|An Old Family Blend!|rec=yes}}
{{anmov|rock|Stone Edge|DP150|Some Title}}
{{anmov|grass|Frenzy Plant|DP180|Another Title|rec=yes}}
{{anmov|ground|Earthquake|JN010|Later Title|rec=yes}}
{{anmov/f|grass}}
"""

WIKI_TRAINER = """==History==
===''[[Pokémon the Series: Diamond and Pearl]]''===
Paul sent out {{TP|Paul|Ninjask}}, which used {{m|Agility}} twice and {{m|Fury Cutter}}. Later Torterra
battled, and Torterra won again. {{TP|Paul|Electivire}} fought once.
==Pokémon==
===On hand===
{{TrainerPoké
|trainer=Paul
|pkmn=Ninjask
|epnum=DP051
|desc={{p|Ninjask}} was used as Paul's fourth Pokémon.

Ninjask's known moves are {{m|Agility}}, {{m|Fury Cutter}}, and {{m|Giga Drain}}, and its [[Ability]] is {{a|Speed Boost}}.}}
==Achievements==
===Pokémon League===
* [[Lily of the Valley Conference]] - Top 8 (''[[DP188|Battling a Thaw in Relations!]]'')
"""


class FakeWiki:
    """Bulbapedia's page source, hand-written for the tests (not real pages)."""
    pages = {"Paul's Torterra": WIKI_POKEMON, "Paul": WIKI_TRAINER, "Paul's Ninjask": "#REDIRECT [[Paul#Ninjask]]"}

    def page(self, title, hops=3):
        from ingest.bulbapedia import Missing, REDIRECT
        anchor = None
        for _ in range(hops):
            if title not in self.pages:
                raise Missing(title)
            m = REDIRECT.match(self.pages[title])
            if not m:
                return title, anchor, self.pages[title]
            title, _, anchor = m.group(1).partition("#")
        raise Missing(title)

    def url(self, title):
        return "https://bulbapedia.bulbagarden.net/wiki/" + title.replace(" ", "_")


class BulbapediaResearch(unittest.TestCase):
    """The ASK list answered from Bulbapedia's page source (ingest/bulbapedia.py), exactly where it's structured.
    The builds and signature moves are set here, as they stood before research (canon has moved on since)."""
    def setUp(self):
        from ingest.cards import load_config
        from trainers.model import Store
        self.cfg, self.store = load_config(), Store()
        lib = self.store.library
        lib["paul-sinnoh/torterra"].moves = ["Leaf Storm", "Earthquake", "Hyper Beam", "Stone Edge"]
        lib["paul-sinnoh/torterra"].status = "proposed"
        lib["paul-sinnoh/ninjask"].moves = ["Agility", "Double Team", "Baton Pass", "Fury Cutter"]
        lib["paul-sinnoh/ninjask"].ability = None
        lib["paul-sinnoh/ninjask"].status = "proposed"
        v = self.store.trainers["paul"].versions["sinnoh"]
        v.signature_moves = [{"pokemon": "Torterra", "move": "Leaf Storm", "why": "x", "status": "proposed"},
                             {"pokemon": "Electivire", "move": "Giga Impact", "why": "x", "status": "proposed"},
                             {"pokemon": "Ninjask", "move": "Baton Pass", "why": "x", "status": "proposed"}]
        v.overrides["ace"] = "Electivire"

    def test_reading_wikitext(self):
        from ingest.bulbapedia import abilities_of, anmov, known_moves, mentions, path, plain, trainer_poke
        rows = anmov(WIKI_POKEMON)
        self.assertEqual([r["move"] for r in rows], ["Tackle", "Razor Leaf", "Leaf Storm", "Stone Edge", "Frenzy Plant", "Earthquake"])
        self.assertEqual((rows[2]["episode"], rows[2]["recent"]), ("DP120", True))
        span = path(WIKI_POKEMON, ["History"], ["DP"])
        self.assertEqual(mentions(plain(WIKI_POKEMON[span[0]:span[1]]), ["Leaf Storm", "Earthquake"]),
                         {"Leaf Storm": 3, "Earthquake": 0})                  # the era's stretch only
        entry = trainer_poke(WIKI_TRAINER, "Ninjask")
        self.assertEqual(known_moves(entry["desc"]), ["Agility", "Fury Cutter", "Giga Drain"])
        self.assertEqual((abilities_of(entry["desc"]), abilities_of(WIKI_POKEMON)), (["Speed Boost"], ["Overgrow"]))
        self.assertEqual(mentions("Thunder Punch, then Thunder", ["Thunder", "Thunder Punch"]), {"Thunder": 1, "Thunder Punch": 1})
        self.assertIn("Paul's Ninjask", plain("{{TP|Paul|Ninjask}}"))

    def test_movesets_keep_what_the_page_supports(self):
        from ingest.bulbapedia import Researcher
        rr = Researcher(self.cfg, self.store, wiki=FakeWiki())
        r = rr.moveset("paul", "sinnoh", "paul-sinnoh/torterra")       # authored: Leaf Storm, Earthquake, Hyper Beam, Stone Edge
        self.assertIn("Earthquake", r["unsupported"])                  # first used in JN, after the Sinnoh era
        self.assertIn("Leaf Storm", r["proposed"])
        self.assertNotIn("Earthquake", r["proposed"])
        nin = rr.moveset("paul", "sinnoh", "paul-sinnoh/ninjask")      # no page of its own: the trainer page's entry
        self.assertEqual((nin["source"], nin["proposed"]), ("trainer page entry", ["Agility", "Fury Cutter", "Giga Drain"]))

    def test_signatures_aces_and_careers(self):
        from ingest.bulbapedia import Researcher
        rr = Researcher(self.cfg, self.store, wiki=FakeWiki())
        sig = rr.signature("paul", "sinnoh", 0)                         # Torterra's Leaf Storm
        self.assertEqual((sig["move"], sig["rank"]), ("Leaf Storm", 1))
        bp = rr.signature("paul", "sinnoh", 2)                          # Ninjask's Baton Pass
        self.assertNotIn("Baton Pass", bp["known"])
        lance = rr.ace("lance", "champion-hgss")
        self.assertEqual((lance["answer"], lance["source"]), ("Dragonite", "cartridge"))
        self.assertIn("sent out last", lance["why"])
        paul = rr.ace("paul", "sinnoh")
        self.assertEqual(paul["answer"], "Torterra")                    # named most in the era's history
        car = rr.career("paul", 1)
        self.assertEqual((car["result"], car["episode"]), ("Top 8", "DP188"))

    def test_answers_become_corrections_for_review(self):
        import shutil
        from ingest.bulbapedia import research
        from ingest.cards import Inbox
        from ingest.sheet import asks
        tmp = tempfile.mkdtemp()
        try:
            os.makedirs(os.path.join(tmp, "canon"))
            for f in ("trainers.json", "build_library.json"):
                shutil.copy(os.path.join(ENGINE, "canon", f), os.path.join(tmp, "canon", f))
            inbox = Inbox(base=tmp)
            made, _ = research(inbox, self.store, asks(self.store), wiki=FakeWiki(), only={"paul"})
            card = next(c for c, _ in made if c["id"] == "research-bulbapedia-paul-sinnoh")
            targets = {c["data"]["target"].split(":")[1]: c for c in card["claims"]}
            self.assertEqual(targets["trainers.paul.versions.sinnoh.signature_moves.0.status"]["data"]["value"], "confirmed")
            self.assertEqual(targets["trainers.paul.versions.sinnoh.signature_moves.2.status"]["data"]["value"],
                             "not on Bulbapedia's list")
            self.assertEqual(targets["builds.paul-sinnoh/ninjask.ability"]["data"]["value"], "Speed Boost")
            self.assertTrue(all(c["status"] == "proposed" for c in card["claims"]))
            self.assertTrue(any("no page" in n for n in card["source"]["unresolved"]))   # the others aren't in FakeWiki
        finally:
            shutil.rmtree(tmp)


class PokedexCrosscheck(unittest.TestCase):
    """What the games' own Pokédex says (ingest/pokedex.py), held against a video's claims."""
    def setUp(self):
        from ingest.cards import Inbox
        self.tmp = tempfile.mkdtemp()
        self.inbox = Inbox(base=self.tmp)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp)

    def test_entries_are_the_games_words(self):
        from ingest.pokedex import entries
        e = entries("Torterra", gen_max=4)
        self.assertEqual([x["versions"][0] for x in e], ["diamond", "pearl", "platinum", "heartgold"])
        self.assertIn("moving forests", e[1]["text"])
        self.assertIn("Torterra", e[2]["text"])                         # 'TORTERRA' reads as a name

    def test_a_fan_claim_the_games_back_says_so(self):
        from ingest.pokedex import crosscheck
        backed = self.inbox.claim("field_note", {"species": "Torterra", "note": "Migrating in slow herds resembling moving forests.",
                                                 "fan_work": True})
        unbacked = self.inbox.claim("field_note", {"species": "Torterra", "note": "Naps flat on the ground all afternoon."})
        self.assertEqual(crosscheck(self.inbox, [backed, unbacked]), 1)
        self.assertEqual(backed["canon_backing"][0]["games"], ["pearl"])
        self.assertIn("The games back this: Pearl Pokédex", backed["note"])
        self.assertNotIn("canon_backing", unbacked)
        self.assertEqual(backed["status"], "proposed")                  # evidence, never an approval

    def test_a_species_entries_become_canon_field_notes(self):
        from ingest.pokedex import to_card
        card, _ = to_card(self.inbox, "Torterra", gen_max=4)
        self.assertEqual((card["provenance"], len(card["claims"])), ("cartridge", 4))
        self.assertTrue(all(c["data"]["canon"] and c["source_ref"].startswith("Pokédex:") for c in card["claims"]))

def _chaos(spreads, checks, raw=2000):
    """A hand-written month of Smogon stats for one species (not real numbers)."""
    return {"info": {"metagame": "gen4ou", "cutoff": 1630, "number of battles": 100},
            "data": {"Gyarados": {"Raw count": raw, "usage": 0.3, "Abilities": {"intimidate": 100.0},
                                  "Items": {"leftovers": 60.0, "lifeorb": 40.0}, "Spreads": spreads,
                                  "Moves": {"waterfall": 95.0, "dragondance": 60.0, "earthquake": 50.0, "thunderwave": 30.0,
                                            "hiddenpowerflying": 2.0},
                                  "Teammates": {"Tyranitar": 50.0, "Latias": 20.0}, "Checks and Counters": checks,
                                  "Viability Ceiling": [1, 1, 1, 1], "Happiness": {}, "Tera Types": {}}}}


class SmogonUsage(unittest.TestCase):
    """The field's monthly numbers (film/usage.py): spreads, items, moves, teammates, checks."""
    @classmethod
    def setUpClass(cls):
        import copy
        from film.replays import load_config
        from film.usage import Names
        from trainers.model import Store
        from trainers.roles import RoleBook
        cls.cfg = copy.deepcopy(load_config())
        cls.store = Store()
        cls.book = RoleBook(cls.store)
        cls.names = Names(cls.cfg, 4)
        cls.spreads = {"Adamant:0/252/4/0/0/252": 50.0, "Impish:248/0/252/0/8/0": 30.0, "Jolly:4/252/0/0/0/252": 20.0}

    def test_a_species_line(self):
        from film.usage import species, spread
        self.assertEqual(spread("Jolly:0/252/0/0/4/252"), ("Jolly", {"hp": 0, "atk": 252, "def": 0, "spa": 0, "spd": 4, "spe": 252}))
        data = _chaos(self.spreads, {"Starmie": {"n": 200, "p": 0.8, "d": 0.02}, "Skarmory": {"n": 10, "p": 0.99, "d": 0.01},
                                     "Latias": {"n": 300, "p": 0.85, "d": 0.05}})
        line = species(self.cfg, data, "Gyarados", self.names)
        self.assertEqual((line["items"][0], line["abilities"][0]), (("Leftovers", 60.0), ("Intimidate", 100.0)))
        self.assertIn(("Dragon Dance", 60.0), line["moves"])
        self.assertNotIn("Hidden Power Flying", [m for m, _ in line["moves"]])       # under the share floor
        self.assertEqual([c["species"] for c in line["checks"]], ["Starmie", "Latias"])  # Skarmory: too few matchups
        self.assertEqual(line["checks"][0]["beats"], 80)

    def test_the_spread_that_fits_the_role(self):
        from film.usage import best_spread, species
        line = species(self.cfg, _chaos(self.spreads, {}), "Gyarados", self.names)
        sweeper = {"species": "Gyarados", "moves": ["Dragon Dance", "Waterfall", "Earthquake", "Stone Edge"],
                   "item": "Life Orb", "ability": "Intimidate", "role": "physical_setup_sweeper"}
        wall = {"species": "Gyarados", "moves": ["Waterfall", "Thunder Wave", "Roar", "Rest"], "item": "Leftovers",
                "ability": "Intimidate", "role": "physical_wall"}
        self.assertEqual(best_spread(self.book, sweeper, line["spreads"], "platinum", 4)["evs"]["atk"], 252)
        self.assertEqual(best_spread(self.book, wall, line["spreads"], "platinum", 4)["nature"], "Impish")
        self.assertIsNone(best_spread(self.book, sweeper, line["spreads"], "crystal", 2))   # no spreads in Gen 2

    def test_the_ladder_reads_the_cache_and_widens_for_answers(self):
        import shutil
        from film.usage import line_for
        from trainers.playsheet import ladder_lines
        tmp = tempfile.mkdtemp()
        try:
            d = os.path.join(tmp, self.cfg["store"]["usage"])
            os.makedirs(d)
            with open(os.path.join(d, "2026-09-gen4ou-1630.json"), "w") as fh:
                json.dump(_chaos(self.spreads, {}), fh)
            with open(os.path.join(d, "2026-09-gen4ou-0.json"), "w") as fh:
                json.dump(_chaos(self.spreads, {"Starmie": {"n": 500, "p": 0.7, "d": 0.02}}, raw=9000), fh)
            line = line_for(self.cfg, "gen4ou", "Gyarados", self.names, [1630, 0], 300, base=tmp)
            self.assertEqual((line["cutoff"], line["checks"][0]["species"]), (0, "Starmie"))   # 1630 had no answers
            self.assertIsNone(line_for(self.cfg, "gen4ou", "Pikachu", self.names, [1630, 0], 300, base=tmp))
            row = {"species": "Gyarados", "usage": 0.3, "format": "gen4ou", "month": "2026-09", "cutoff": 0,
                   "moves": ["Waterfall"], "item": "Leftovers", "spread": line["spreads"][0], "checks": line["checks"]}
            text = ladder_lines([row])[0]
            self.assertIn("rare on gen4ou", text)
            self.assertIn("What beats it: Starmie 70%", text)
        finally:
            shutil.rmtree(tmp)

    def test_film_builds_get_a_spread_for_review(self):
        import shutil
        from film.cards import spreads_card
        from ingest.cards import Inbox
        from trainers.model import Build, Store
        store = Store()
        store.library = {"ingested/gyarados-x": Build(id="ingested/gyarados-x", species="Gyarados",
                                                      moves=["Dragon Dance", "Waterfall", "Earthquake", "Stone Edge"],
                                                      item="Life Orb", ability="Intimidate", generation=4,
                                                      role="physical_setup_sweeper",
                                                      source="external: https://replay.pokemonshowdown.com/gen4ou-1")}
        tmp = tempfile.mkdtemp()
        try:
            d = os.path.join(tmp, self.cfg["store"]["usage"])
            os.makedirs(d)
            with open(os.path.join(d, "2026-09-gen4ou-1630.json"), "w") as fh:
                json.dump(_chaos(self.spreads, {}), fh)
            os.makedirs(os.path.join(tmp, "canon"))
            card, _ = spreads_card(Inbox(base=tmp), store, self.book, self.cfg, "2026-09", 1630, base=tmp)
            targets = {c["data"]["target"].rsplit(".", 1)[1]: c["data"]["value"] for c in card["claims"]}
            self.assertEqual(targets["evs"]["atk"], 252)
            self.assertIn(targets["nature"], ("Adamant", "Jolly"))
            self.assertTrue(all(c["status"] == "proposed" for c in card["claims"]))
        finally:
            shutil.rmtree(tmp)

class BuildsBook(unittest.TestCase):
    """The builds book (film/buildbook.py): the month's numbers joined with the sets replays show."""
    def test_smogon_text_files(self):
        from film.buildbook import leads, metagame
        tmp = tempfile.mkdtemp()
        try:
            lp, mp = os.path.join(tmp, "leads.txt"), os.path.join(tmp, "meta.txt")
            with open(lp, "w") as fh:
                fh.write(" Total leads: 10\n + ---- +\n | Rank | Pokemon | Usage % | Raw | % |\n"
                         " | 1    | Azelf              | 10.18939% | 13940  | 12.085% |\n | 2    | Empoleon | 8.49909% | 6961 | 6.035% |\n")
            with open(mp, "w") as fh:
                fh.write(" sand..............56.87036%\n stall.............41.03650%\n\n Stalliness (mean: 1.626)\n")
            self.assertEqual(leads(lp), {"Azelf": 10.2, "Empoleon": 8.5})
            self.assertEqual(metagame(mp), ([("sand", 56.9), ("stall", 41.0)], 1.626))
            self.assertEqual(leads(None), {})
        finally:
            import shutil
            shutil.rmtree(tmp)

    def test_a_set_as_a_showdown_paste(self):
        from film.buildbook import paste
        s = {"species": "Tyranitar", "item": "Choice Band", "ability": "Sand Stream", "nature": "Adamant",
             "evs": {"hp": 0, "atk": 252, "def": 0, "spa": 0, "spd": 4, "spe": 252}, "moves": ["Crunch", "Pursuit"]}
        self.assertEqual(paste(s, 4), "Tyranitar @ Choice Band\nAbility: Sand Stream\nEVs: 252 Atk / 4 SpD / 252 Spe\n"
                                      "Adamant Nature\n- Crunch\n- Pursuit")
        self.assertEqual(paste(s, 2), "Tyranitar @ Choice Band\n- Crunch\n- Pursuit")      # Gen 2: no ability, EVs, nature

    def test_a_book_from_cached_numbers_and_replays(self):
        import copy
        import shutil
        from film.buildbook import book
        from film.replays import load_config
        from film_room import reader_for
        cfg = copy.deepcopy(load_config())
        reader = reader_for(cfg)
        tmp = tempfile.mkdtemp()
        try:
            d = os.path.join(tmp, cfg["store"]["usage"])
            os.makedirs(d)
            chaos = _chaos({"Impish:248/0/252/0/8/0": 50.0, "Adamant:0/252/4/0/0/252": 50.0},
                           {"Starmie": {"n": 200, "p": 0.8, "d": 0.02}})
            with open(os.path.join(d, "2026-09-gen4ou-1630.json"), "w") as fh:
                json.dump(chaos, fh)
            with open(os.path.join(d, "2026-09-leads-gen4ou-1630.txt"), "w") as fh:
                fh.write(" | 1 | Gyarados | 4.34656% | 3119 | 2.704% |\n")
            with open(os.path.join(d, "2026-09-metagame-gen4ou-1630.txt"), "w") as fh:
                fh.write(" offense...........18.78929%\n")
            rd = os.path.join(tmp, cfg["store"]["raw"])
            os.makedirs(rd)
            log = FILM_LOG.replace("Swampert", "Gyarados").replace("Stealth Rock|p2a", "Dragon Dance|p1a")
            with open(os.path.join(rd, "gen4ou-1.json"), "w") as fh:
                json.dump({"id": "gen4ou-1", "log": log, "formatid": "gen4ou", "uploadtime": 1792000000}, fh)
            b = book(cfg, reader, "gen4ou", "2026-09", 1630, top=5, base=tmp)
            self.assertEqual((b["leads"], b["styles"], b["replays"]), ([("Gyarados", 4.3)], [("offense", 18.8)], 1))
            g = b["species"][0]
            self.assertEqual((g["species"], g["lead"], g["checks"][0]["species"]), ("Gyarados", 4.3, "Starmie"))
            usage_set = next(s for s in g["sets"] if s["source"] == "usage")
            self.assertEqual(usage_set["moves"], ["Waterfall", "Dragon Dance", "Earthquake", "Thunder Wave"])
            self.assertTrue(all(s["paste"].startswith("Gyarados @ ") for s in g["sets"]))
            self.assertTrue(all(s.get("evs") for s in g["sets"]))                 # every Gen 4 set gets a spread
        finally:
            shutil.rmtree(tmp)


AUDIT_LOG = """|player|p1|Alice|1|1500
|player|p2|Bob|2|1450
|teamsize|p1|2
|teamsize|p2|2
|gen|4
|tier|[Gen 4] OU
|start
|switch|p1a: Sparky|Jolteon, M|100/100
|switch|p2a: Star|Starmie|100/100
|turn|1
|move|p2a: Star|Thunderbolt|p1a: Sparky
|-heal|p1a: Sparky|100/100|[from] ability: Volt Absorb|[of] p2a: Star
|move|p1a: Sparky|Thunderbolt|p2a: Star
|-damage|p2a: Star|60/100
|upkeep
|turn|2
|switch|p2a: Spooky|Gengar, F|100/100
|move|p1a: Sparky|Perish Song|p1a: Sparky
|-start|p1a: Sparky|perish3|[silent]
|-start|p2a: Spooky|perish3|[silent]
|upkeep
|turn|3
|move|p2a: Spooky|Curse|p1a: Sparky
|-start|p1a: Sparky|Curse|[of] p2a: Spooky
|-damage|p2a: Spooky|0 fnt
|faint|p2a: Spooky
|upkeep
|switch|p2a: Star|Starmie|60/100
|turn|4
|move|p1a: Sparky|Thunderbolt|p2a: Star
|-damage|p2a: Star|30/100
|-start|p2a: Star|perish0
|faint|p2a: Star
|-message|Bob lost due to inactivity.
|win|Alice
"""


class EngineAudit(unittest.TestCase):
    """The engine audit (engine/sanity.py, docs/SANITY.md): what the first audit found wrong, pinned so it can't
    come back. Each test names the outside reference it was checked against."""
    @classmethod
    def setUpClass(cls):
        from trainers.model import Store
        cls.store = Store()

    def test_stats_match_smogons_calc(self):
        import shutil
        import sanity
        if not shutil.which("node"):
            self.skipTest("node isn't installed")
        r = sanity.check_stats(self.store, levels=(100, 37),
                               species=["snorlax", "alakazam", "chansey", "skarmory", "gengar", "pikachu", "shedinja"])
        self.assertGreater(r["compared"], 60)
        self.assertEqual(r["mismatched"], [])

    def test_gen2_stats_are_dvs_and_stat_experience(self):
        era = self.store.era
        ivs = {"hp": 31, "atk": 27, "def": 12, "spa": 9, "spd": 31, "spe": 30}
        st = era.stats("alakazam", 2, 100, "Modest", ivs, {s: 252 for s in ("hp", "atk", "def", "spa", "spd", "spe")})
        self.assertEqual(st, {"hp": 303, "atk": 194, "def": 170, "spa": 346, "spd": 246, "spe": 338})   # the calc's
        self.assertEqual(self.store.default_evs(2)["spe"], 252)            # Showdown's Gen 2 default: maxed
        self.assertEqual(self.store.default_evs(4)["spe"], 85)

    def test_known_facts(self):
        import sanity
        self.assertEqual(sanity.check_facts(self.store)["mismatched"], [])

    def test_legality_rules(self):
        from trainers.model import Build
        c = self.store.check
        flags = c(Build(id="t", species="Pikachu", moves=["Volt Tackle", "Thunderbolt", "Thunderbolt", "Surf", "Quick Attack"],
                        item="Life Orb", ability="Static", nature="Timid", evs={"spa": 252, "spd": 0}), "crystal")
        for want in ("Life Orb doesn't exist until Gen 4", "Volt Tackle doesn't exist until Gen 3", "5 moves, over 4",
                     "Thunderbolt listed twice", "Gen 2 has no abilities", "Gen 2 has no natures", "one Special stat"):
            self.assertTrue(any(want in f for f in flags), want)
        self.assertIn("Light Ball does nothing for Raichu (only Pikachu)",
                      c(Build(id="t", species="Raichu", moves=["Thunderbolt"], item="Light Ball"), "platinum"))
        self.assertTrue(any("Gen II calls it MiracleBerry" in f
                            for f in c(Build(id="t", species="Snorlax", moves=["Rest"], item="Lum Berry"), "crystal")))
        self.assertEqual(c(Build(id="t", species="Snorlax", moves=["Rest"], item="MiracleBerry"), "crystal"), [])
        self.assertEqual(c(Build(id="t", species="Rotom-Heat", moves=["Overheat"]), "platinum"), [])   # form move
        self.assertEqual(c(Build(id="t", species="Espeon", moves=["Growth"]), "crystal"), [])           # Gen 2 event

    def test_library_and_teams_are_legal(self):
        import sanity
        r = sanity.check_legality(self.store, books={})
        self.assertEqual(r["mismatched"], [])

    def test_light_ball_by_generation(self):
        from trainers.model import Build
        from trainers.roles import RoleBook
        book = RoleBook(self.store)
        pika = Build(id="t", species="Pikachu", moves=["Thunderbolt"], item="Light Ball")
        plain = Build(id="t", species="Pikachu", moves=["Thunderbolt"])
        g2, g2_plain = book.context(pika, "crystal")["stats"], book.context(plain, "crystal")["stats"]
        g4, g4_plain = book.context(pika, "platinum")["stats"], book.context(plain, "platinum")["stats"]
        self.assertEqual((g2["atk"], g2["spa"]), (g2_plain["atk"], 2 * g2_plain["spa"]))   # Sp. Atk only before Gen 4
        self.assertEqual((g4["atk"], g4["spa"]), (2 * g4_plain["atk"], 2 * g4_plain["spa"]))

    def test_film_credits_and_endings(self):
        import sanity
        from film.log import parse
        b = parse(AUDIT_LOG, {"id": "gen4ou-audit"})
        mon = {m["species"]: m for s in b["sides"].values() for m in s["members"]}
        self.assertEqual(mon["Jolteon"]["ability"], "Volt Absorb")          # the absorber, not the attacker ([of])
        self.assertIsNone(mon["Starmie"]["ability"])
        self.assertEqual(mon["Gengar"]["fainted_by"], "self: Curse")       # a Ghost's Curse costs half its HP
        self.assertEqual(mon["Starmie"]["fainted_by"], "Jolteon (Perish Song)")
        self.assertEqual((b["winner"], b["forfeit"], b["timed_out"]), ("p1", True, True))
        self.assertEqual(sanity.battle_rules(b, 4, self.store.era, set()), [])

    def test_smogon_checks_cutoff_and_order(self):
        import copy
        from film.replays import load_config
        from film.usage import Names, species
        cfg = copy.deepcopy(load_config())
        data = _chaos({"Adamant:0/252/4/0/0/252": 100.0},
                      {"Starmie": {"n": 25, "p": 0.700, "d": 0.0010}, "Latias": {"n": 300, "p": 0.704, "d": 0.0015},
                       "Skarmory": {"n": 20, "p": 0.99, "d": 0.01}})
        line = species(cfg, data, "Gyarados", Names(cfg, 4))
        self.assertEqual([c["species"] for c in line["checks"]], ["Latias", "Starmie"])   # n > 20, exact score order
        self.assertEqual([c["score"] for c in line["checks"]], [70, 70])

    def test_smogon_moveset_file_parser(self):
        import tempfile as _tf
        from film.usage import published
        text = (" +----------------------------------------+ \n | Tyranitar                              | \n"
                " +----------------------------------------+ \n | Raw count: 53318                       | \n"
                " | Items                                  | \n | Lum Berry 22.959%                      | \n"
                " | Other 3.398%                           | \n | Checks and Counters                    | \n"
                " | Breloom 72.839 (81.68±2.21)            | \n")
        with _tf.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as fh:
            fh.write(text)
        p = published(fh.name)
        os.unlink(fh.name)
        self.assertEqual(p["Tyranitar"]["raw"], 53318)
        self.assertEqual(p["Tyranitar"]["Items"], [("Lum Berry", 22.959)])                 # "Other" left out
        self.assertEqual(p["Tyranitar"]["Checks and Counters"], [("Breloom", 72.839, 81.68, 2.21)])



class Blackthorn(unittest.TestCase):
    """The ranch in the present (docs/BLACKTHORN.md): the lineage tracker, the export, the Sheet and its script."""
    @classmethod
    def setUpClass(cls):
        from breeding.lineage import Lineage
        cls.lin = Lineage(DB)
        cls.rows = cls.lin.individuals()

    def test_the_planned_studbook(self):
        roles = {}
        for r in self.rows:
            roles[r["role"]] = roles.get(r["role"], 0) + 1
        self.assertEqual(roles, {"companion": 36, "father used": 8, "dam": 10, "stud": 9})
        self.assertEqual(self.lin.check(self.rows), [])
        by = {r["id"]: r for r in self.rows}
        stud = by["S-TYRANITAR"]                     # Kingdra -> a bred Feraligatr -> the Larvitar stud
        self.assertEqual((stud["generation"], stud["hatched_as"], sorted(stud["moves"])),
                         (2, "Larvitar", ["Dragon Dance", "Outrage"]))
        self.assertEqual(by[stud["sire"]]["sire"], "F-KINGDRA-TYRANITAR")
        self.assertEqual(by["S-INFERNAPE"]["sire"], "C-AMPHAROS")          # a journey companion can be the father
        self.assertIn("Budew", by["S-ROSERADE"]["note"])                   # an incense baby says so

    def test_the_rules_catch_a_bad_pedigree(self):
        bad = [dict(r) for r in self.rows]
        by = {r["id"]: r for r in bad}
        by["S-GENGAR"]["generation"] = 4
        by["HG-SNORLAX"]["sex"] = "genderless"
        by["S-SCIZOR"]["inherited"] = [{"move": "Surf", "from": by["S-SCIZOR"]["sire"]}]
        why = {}
        for i, w in self.lin.check(bad):
            why[i] = why.get(i, "") + w + "; "
        self.assertIn("should be 1", why["S-GENGAR"])
        self.assertIn("can't be genderless", why["HG-SNORLAX"])
        self.assertIn("isn't an egg move", why["S-SCIZOR"])

    def test_authored_records_override_and_add(self):
        import tempfile as _tf
        import shutil as _sh
        from breeding.lineage import Lineage
        tmp = _tf.mkdtemp()
        try:
            for f in ("rosters.json", "builds.json", "ranch.json"):
                _sh.copy(os.path.join(ENGINE, "canon", f), tmp)
            with open(os.path.join(tmp, "lineage.json"), "w", encoding="utf-8") as fh:
                json.dump({"individuals": [{"id": "HG-TYRANITAR", "sex": "female", "name": "Rivera's Tyranitar"},
                                           {"id": "H-LARVITAR-1", "species": "Larvitar", "sex": "male", "generation": 3,
                                            "sire": "S-TYRANITAR", "dam": "D-TYRANITAR", "moves": ["Dragon Dance"],
                                            "inherited": [{"move": "Dragon Dance", "from": "S-TYRANITAR"}],
                                            "role": "hatchling", "status": "hatched"}]}, fh)
            lin = Lineage(DB, tmp)
            rows = lin.individuals()
            by = {r["id"]: r for r in rows}
            self.assertEqual((by["HG-TYRANITAR"]["sex"], by["HG-TYRANITAR"]["generation"]), ("female", 0))
            self.assertEqual(len(rows), 64)
            self.assertEqual(lin.check(rows), [])
            self.assertEqual([r["id"] for r in lin.descendants("S-TYRANITAR", rows)], ["H-LARVITAR-1"])
        finally:
            _sh.rmtree(tmp)

    def test_the_export_and_the_sheet(self):
        from ranch import dashboard, sheet
        d = dashboard.build()
        k = d["kpis"]
        self.assertEqual((k["residents"], k["at_hq"], k["lines"], k["individuals"], k["generations"], k["rule_issues"]),
                         (45, 41, 10, 63, 3, 0))
        self.assertGreaterEqual(len(d["decisions"]), 53)
        self.assertTrue(any(q["id"] == "Q-RANCH-1" for q in d["questions"]))
        calls = sheet.build(d)
        grid = {}
        for r in calls[0]["requests"]:
            p = (r.get("addSheet") or r.get("updateSheetProperties") or {}).get("properties")
            if p:
                grid[p["sheetId"]] = (p["gridProperties"]["rowCount"], p["gridProperties"]["columnCount"])
        bands = []

        def walk(o):
            if isinstance(o, dict):
                if "sheetId" in o and "endRowIndex" in o:
                    rows, cols = grid[o["sheetId"]]
                    self.assertLessEqual(o["endRowIndex"], rows)
                    self.assertLessEqual(o.get("endColumnIndex", 0), cols)
                if "bandedRangeId" in o:
                    bands.append(o["bandedRangeId"])
                for v in o.values():
                    walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        for c in calls[1:]:
            if c["tool"] == "update_spreadsheet":
                walk(c["requests"])
        self.assertEqual(len(bands), len(set(bands)))                      # the API refuses a reused banding id
        self.assertEqual(len(grid), 16)

    def test_the_apps_script_rules(self):
        import shutil as _sh
        import subprocess as _sp
        if not _sh.which("node"):
            self.skipTest("node isn't installed")
        here = os.path.join(ENGINE, "appscript")
        _sp.run([sys.executable, "-I", os.path.join(here, "make_fixture.py")], check=True, capture_output=True)
        out = _sp.run(["node", os.path.join(here, "test_rules.mjs")], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)


class WebApp(unittest.TestCase):
    """Blackthorn HQ, the web app (docs/APP.md): the pages, the launcher, and the Lab's math against the engine's."""
    @classmethod
    def setUpClass(cls):
        import shutil as _sh
        import subprocess as _sp
        if not _sh.which("node"):
            raise unittest.SkipTest("node isn't installed")
        cls.sp = _sp
        cls.app = os.path.join(ENGINE, "app")
        _sp.run([sys.executable, "-I", os.path.join(cls.app, "build.py")], check=True, capture_output=True)

    def test_every_page_part_is_valid_javascript(self):
        import glob as _glob
        import re as _re
        for f in sorted(_glob.glob(os.path.join(self.app, "web", "*.html"))):
            with open(f, encoding="utf-8") as fh:
                code = "\n".join(_re.findall(r"<script>(.*?)</script>", fh.read(), _re.S))
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tmp:
                tmp.write(code)
            out = self.sp.run(["node", "--check", tmp.name], capture_output=True, text=True)
            os.unlink(tmp.name)
            self.assertEqual(out.returncode, 0, os.path.basename(f) + ": " + out.stderr[-600:])

    def test_the_launcher_serves_the_zip_and_writes_only_the_app_tabs(self):
        out = self.sp.run(["node", os.path.join(ENGINE, "appscript", "test_webapp.mjs")], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout[-1500:] + out.stderr[-1500:])

    def test_the_browser_scouting_engine_writes_the_same_reports_as_python(self):
        """web/25_scout.html against trainers/report.py: every version, 60 random edits of them (sliders, roles,
        members, moves, natures, EVs, items, the reading level) and six exposure reads, sentence for sentence."""
        out = self.sp.run([sys.executable, "-I", os.path.join(self.app, "scout_pack.py")], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stderr[-1500:])
        with tempfile.TemporaryDirectory() as tmp:
            dump = os.path.join(tmp, "py.json")
            out = self.sp.run([sys.executable, "-I", os.path.join(self.app, "scout_pack.py"), "--parity", dump], capture_output=True, text=True)
            self.assertEqual(out.returncode, 0, out.stderr[-1500:])
            out = self.sp.run(["node", os.path.join(self.app, "test_scout_parity.mjs"), dump], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout[-3000:] + out.stderr[-1500:])
        self.assertIn(" match", out.stdout)

    def test_the_browser_battle_engine_builds_the_same_scouting_file_as_python(self):
        """web/27_battle.html (with @smogon/calc in the page) against battle/scouting_report.py: a Gen 4 lineup, a
        Gen 2 lineup with coach settings, and a Gen 4 lineup with edited builds, every section of each (cards, call
        sheets, advance reports, game plans, play calls by situation, self-scout, coach profile), number for number.
        The whole file and the league: python3 -I app/battle_pack.py --parity OUT && node app/test_battle_parity.mjs OUT"""
        out = self.sp.run([sys.executable, "-I", os.path.join(self.app, "battle_pack.py")], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stderr[-1500:])
        ids = "heartgold,fuzz-heartgold-builds,fuzz-crystal-coach"
        with tempfile.TemporaryDirectory() as tmp:
            dump = os.path.join(tmp, "battle.json")
            out = self.sp.run([sys.executable, "-I", os.path.join(self.app, "battle_pack.py"), "--parity", dump, ids], capture_output=True, text=True)
            self.assertEqual(out.returncode, 0, out.stderr[-1500:])
            out = self.sp.run(["node", os.path.join(self.app, "test_battle_parity.mjs"), dump, "--only", ids], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout[-3000:] + out.stderr[-1500:])
        self.assertIn("sections match Python", out.stdout)

    def test_the_browser_wilderness_read_matches_python(self):
        """web/85_field.html against wilderness/engine.py team_report: every lineup, random teams in every game,
        and a preview with every pending world record (the workbench's preview_world)."""
        out = self.sp.run([sys.executable, "-I", os.path.join(self.app, "field_pack.py")], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stderr[-1500:])
        with tempfile.TemporaryDirectory() as tmp:
            dump = os.path.join(tmp, "field.json")
            out = self.sp.run([sys.executable, "-I", os.path.join(self.app, "field_pack.py"), "--parity", dump], capture_output=True, text=True)
            self.assertEqual(out.returncode, 0, out.stderr[-1500:])
            out = self.sp.run(["node", os.path.join(self.app, "test_field_parity.mjs"), dump], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout[-3000:] + out.stderr[-1500:])

    def test_the_browser_specimen_kernel_matches_python(self):
        """web/26_specimen.html against specimen.py: PIDs (a shiny search included, and Python's own random
        generator for the rest), natures, genders, Hidden Power, characteristics, stats and both exports."""
        with tempfile.TemporaryDirectory() as tmp:
            dump = os.path.join(tmp, "spec.json")
            out = self.sp.run([sys.executable, "-I", os.path.join(self.app, "scout_pack.py"), "--specimens", dump], capture_output=True, text=True)
            self.assertEqual(out.returncode, 0, out.stderr[-1500:])
            out = self.sp.run(["node", os.path.join(self.app, "test_specimen_parity.mjs"), dump], capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout[-3000:] + out.stderr[-1500:])

    def test_the_labs_stats_and_hidden_power_match_the_engine(self):
        from trainers.model import Store
        era = Store().era
        cases = [("Tyranitar", 4, 100, "Jolly", {}, {"atk": 252, "spd": 4, "spe": 252}),
                 ("Garchomp", 4, 50, "Adamant", {"spa": 0}, {"hp": 4, "atk": 252, "spe": 252}),
                 ("Gengar", 3, 100, "Timid", {"atk": 2, "def": 30, "spe": 30}, {"spa": 252, "spe": 252, "hp": 4}),
                 ("Snorlax", 2, 100, None, {"atk": 30, "def": 26, "spe": 20, "spa": 29}, {"hp": 252, "atk": 252, "spa": 252}),
                 ("Pikachu", 2, 81, None, {}, {}), ("Shedinja", 4, 100, "Brave", {}, {"hp": 252})]
        with open(os.path.join(self.app, "web", "20_core.html"), encoding="utf-8") as fh:
            core = fh.read().split("<script>", 1)[1].rsplit("</script>", 1)[0]
        js = core + """
S.builds = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
indexAtlas(JSON.parse(require('fs').readFileSync(process.argv[3], 'utf8')));
const cases = JSON.parse(process.argv[4]);
console.log(JSON.stringify(cases.map(c => { const iv = Object.assign({hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31}, c[4]);
  return {stats: calcStats(dexOf(c[0]).b, c[1], c[2], c[3], iv, c[5]), hp: hiddenPower(c[1], iv)}; })));
"""
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tmp:
            tmp.write(js)
        out = self.sp.run(["node", tmp.name, os.path.join(self.app, "data", "builds.json"), os.path.join(self.app, "data", "atlas.json"),
                           json.dumps(cases)], capture_output=True, text=True)
        os.unlink(tmp.name)
        self.assertEqual(out.returncode, 0, out.stderr[-1500:])
        got = json.loads(out.stdout)
        for c, g in zip(cases, got):
            ivs = {s: c[4].get(s, 31) for s in ("hp", "atk", "def", "spa", "spd", "spe")}
            self.assertEqual(g["stats"], era.stats(c[0], c[1], c[2], c[3], ivs, c[5]), c)
        self.assertEqual(got[0]["hp"], {"type": "Dark", "power": 70})          # all 31s
        self.assertEqual(got[3]["hp"]["type"], "Ice")                         # Gen II: Atk DV 15, Def DV 13 (4*3+1), GSC's HP Ice


if __name__ == "__main__":
    unittest.main()
