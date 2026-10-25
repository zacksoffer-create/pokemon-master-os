"""The Engine Room and the inbox (docs/APP.md): what every engine does, where it lives in the app, how sure we are
of it, and what's waiting for review.

    engines.json   every engine with its status in the app (live in the browser, read from its last run, or not in
                   the app yet) and what it would take next; the product spec's screens; the open work the docs
                   name; the audit (docs/SANITY.md) and the parity tests that hold the browser to the Python engines
    inbox.json     the intake inbox (canon/inbox/cards): every card and its claims, applied or waiting on you

    python3 -I app/room_pack.py
"""
import glob
import json
import os
import re
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
ROOT = os.path.dirname(ENGINE)

LIVE, DATA, PART, NOT = "live", "data", "partial", "not yet"
ENGINES = [
    # (area, name, modules, what it does, status, where in the app, what's next)
    ("Champion", "Trainer scouting report", "trainers/report.py, matrix.py, sliders.py",
     "The type matrix, bulk, the four sliders (authored and measured), tags and the written plan, every sentence a phrase rule.",
     LIVE, "#/scoutlab", "Variants you save in the Scouting Lab land in the Variants tab; say which to keep and Claude writes them into canon/trainers.json."),
    ("Champion", "Role engine", "trainers/roles.py, roles.json",
     "What job each build does (34 roles), scored from stat shape, nature, EVs, item, ability, typing and move categories.",
     LIVE, "#/scoutlab", "Role weights live in roles.json; the Scouting Lab can move the confidence thresholds, not the weights yet."),
    ("Champion", "Playsheet", "trainers/playsheet.py",
     "Career tags, the ace, who they go to when even, ahead and behind, the type read, combos, signature moves and the aggression ratio.",
     LIVE, "#/scoutlab", "Observations on film feed it (canon/observations.jsonl); only Ash, Gary and Paul have film so far."),
    ("Champion", "Exposure", "trainers/report.py exposure",
     "Where your team is exposed against theirs: their attack types against your rows, and their side against your soft rows.",
     LIVE, "#/scoutlab", ""),
    ("Champion", "Role-to-build solver", "trainers/solver.py",
     "Builds a set for a role from what a species can learn: EV templates, items, the role engine as the judge.",
     NOT, "", "Needs each species' learnable pool per game in the browser (large); worth it once the role weights settle."),
    ("Champion", "Battle engine: fights, plans and calls", "battle/engine.py, evaluate.py, moves.py, knowledge.py, trainer_policy.py",
     "Plays every one-on-one out with Smogon's damage calculator: plans, maximin, the games' own trainer AI, what changed the result.",
     LIVE, "#/battlelab", "Runs in the browser with Smogon's calculator; the parity test holds it to Python section for section. Not modeled yet: switching, hazards, doubles (docs/SCOUTING_ENGINE.md)."),
    ("Champion", "Advance reports, self-scout, game plans, lineups", "battle/scouting.py, scouting_report.py",
     "The Journey Scouting File: member cards, call sheets per opponent, advance reports, game plans, play calls by situation.",
     LIVE, "#/battlelab", "Every lineup's file is built live (Advance scouting checks it against the last Python run). Coach settings in canon/lineups.json are empty: try some in the Battle Lab."),
    ("Champion", "Coach profile", "battle/profile.py",
     "Eight sliders measured from a lineup's play against the field (pace, punch, run/pass, build-up, sustain, disruption, risk, script).",
     LIVE, "#/battlelab", "Measured live against the cached usage-field baseline; a new field needs a Python run to rebuild the baseline."),
    ("Champion", "What-if league", "battle/scouting.py what_if_league",
     "Every lineup against every other, one-on-ones played out.", LIVE, "#/battlelab", "About ten seconds in the Battle Lab; your edited lineup plays alongside the originals."),
    ("Champion", "Benchmarks", "battle/benchmarks.py, grid.py",
     "The 38 cartridge opponent teams from the pret disassemblies and the 1v1 grid.", LIVE, "#/battlelab", "The opponent teams are data (read from the disassemblies in Python); the grid against them is played live."),
    ("Champion", "Trainer Library", "trainers/library.py, catalog.py",
     "Every notable trainer of the five games read from the pret data (350 encounters), joined with the authored ones: identities and versions, evidence per field, two lenses, collections with rules and version stamps.",
     LIVE, "#/trainers", "Benchmarks run in the browser (24_library.html over the battle engine); the Ace collections give the Ace test's rates (app/test_library.mjs). Not yet: the Battle Frontier, manga versions, 6v6."),
    ("Builds", "Poké Balls", "equipment/balls.py",
     "All 25 balls of Gens I-IV: which games have each and under what name, what each does read from that game's catch code (the games' bugs named), the games' own descriptions, how you get each, the Apricorns, the interior directions.",
     DATA, "#/balls", "Every number is re-checked against the pinned decompilations on every build (balls.check()). Pictures: the Dream World art or sprites until you upload your own; no image model is open to this project."),
    ("Builds", "Catch engine", "equipment/capture.py",
     "One throw's chance worked out each era's own way (Crystal's byte arithmetic, Gens 3-4's shake checks, HeartGold's Apricorn balls), with each generation's own catch rates.",
     LIVE, "#/balls/catch", "Runs in the browser (33_capture.html), held to Python by app/test_capture_parity.mjs. Wild max HP assumes IV 15 and no EVs; Safari rocks and bait aren't modelled."),
    ("Builds", "Equipment", "equipment/gear.py",
     "28 pieces of trainer gear beyond the balls in the games' own words, with your inventory per game (My Gear).",
     DATA, "#/equipment", "Saving your gear needs the updated WebApp.gs (My Gear). What each connects to in the field and homestead comes with Phase 7."),
    ("Builds", "Stat math", "trainers/era.py",
     "Real stats by generation (Gen II DVs and stat experience the way Showdown reads them), Hidden Power, characteristics.",
     LIVE, "#/builds/lab", ""),
    ("Builds", "Specimen kernel", "specimen.py",
     "PID to nature, gender, ability slot and shininess; the PID search; Gen II DVs; the Showdown set and the PKHeX Batch Editor script.",
     LIVE, "#/builds/lab", "SPECIMEN_LAB.md 'not yet': met locations, ribbons and contest stats, Pokérus, writing .pk files, PID-IV methods."),
    ("Builds", "The ladder book and film", "film/usage.py, buildbook.py, log.py, study.py",
     "Smogon's monthly stats and the sets real players run, read from 850 Showdown replays.",
     DATA, "#/builds/ladder", "The field studies (leads, cores, aggression on the ladder) aren't a page yet."),
    ("Breeder", "Breeding engine", "breeding/engine.py",
     "Egg moves, feasibility, the shortest lineage of fathers for any egg move, timing warnings, one-egg bundles.",
     DATA, "#/breeder", "The Breeder Lab's page is HeartGold/SoulSilver as its last run; the same search runs live in Breeding stock for every game."),
    ("Breeder", "Breeding stock", "breeding/stock.py",
     "Whole starting sets: the hatch order from the games' code, the parents that make an exact set, the father's lineage, the four-state verdict, the line catalogue.",
     LIVE, "#/stock", "Runs in the browser (23_stock.html), held to Python by app/test_stock_parity.mjs. IV and nature planning as a search, and ecology claims, come later."),
    ("Breeder", "Studbook and lineage", "breeding/studbook.py, lineage.py",
     "Every individual with its sire, dam, generation and inherited moves, checked against Gen 4's rules.",
     LIVE, "#/breeding", "Hatches you record in the app go to the Studbook tab; the engine reads them back when you tell Claude."),
    ("Headquarters", "Ranch planner, habitat, hatchery", "ranch/planner.py, habitat.py, hatchery.py, dashboard.py",
     "The census, the satellite choice, staffing, the Glasshouse, the egg schedule and the crop plan.",
     DATA, "#/estate", "The satellite choice and the stud reading are waiting on you (Your calls)."),
    ("Headquarters", "Wilderness engine", "wilderness/engine.py",
     "The first 27 capabilities' evidence: field moves, overworld abilities, Pokédex lore, type, size and habitat (the capability records build on it).",
     LIVE, "#/capabilities", "Its Pokédex patterns were narrowed in Phase 7 (wings not used for flying, 'dangerously', 'seen from far away', a bare mention of the sea)."),
    ("Headquarters", "Capability records", "capability/records.py, model.json",
     "35 capabilities in seven areas, every species' evidence in every journey game on three axes (layer, class, status): game mechanics, Pokédex text, body shape, type, size, habitat, equipment rules; world records by individual.",
     DATA, "#/capabilities", "Moves a build knows are put to use in the page; machines and badges come from data_manifest/field_functions.json when it has been read."),
    ("Headquarters", "Survival and homestead assessments", "capability/assess.py",
     "Cartridge readiness, world readiness against eleven scenarios with a kit, lock-and-optimise (Recommended / Potential Fits / Everything Else), comparisons without a winner, facility assessments under D-039.",
     LIVE, "#/survival", "Runs in the browser (34_capability.html), held to Python by app/test_capability_parity.mjs. The optional expedition simulation is later (spec §9)."),
    ("Headquarters", "Camp life", "wilderness/camp_life.py", "Each game's food systems and who on the team forages, produces, cooks and heats.",
     DATA, "#/capabilities", "Its food systems feed the kit and scenarios; the Survival Lab's provisions are a Blackthorn standard."),
    ("Headquarters", "World records", "wilderness/world.py",
     "Authored facts about your world, proposed and approved.", DATA, "#/record/world", "Approve or reject pending records in Your calls."),
    ("The Arena", "6v6 engine", "sixvsix/ (src/, cli/arena-pack.mjs)",
     "Showdown's Gen IV engine behind Blackthorn's contract: the trainer agent and the cartridge AI, mirrored batches, replays with every decision's reasons, the Legends round robin.",
     LIVE, "#/arena", "Runs in the page (35_arena.html, Web Workers where allowed); app/test_arena.mjs requires the page to play exactly Node's battles. Switch prediction and planning past one turn are the agent's next steps (sixvsix/docs/TRAINER_AI.md)."),
    ("The Arena", "Trainer ecosystem", "trainers/ecosystem.json, ecosystem.py",
     "25 proposed anime versions beside canon (Ash at eleven moments, Gary and Paul at four, rivals and the anime's champions), each with career records.",
     DATA, "#/trainers", "Approve versions into canon one by one; Ritchie, Drew, Tobias and Morrison wait for six known Pokémon."),
    ("Field Biology", "Pokédex archive and claims", "biology/archive.py, claims.py, evidence.py",
     "Every Gen I-IV Pokédex entry per species (3,639), split into 6,438 claims by domain with a machine reading of diet, guild, habitat and relationships; evidence packs for dossiers.",
     DATA, "#/biology", "Dossiers for the next cohort (the Glasshouse candidates) from their evidence packs."),
    ("Field Biology", "Curated dossiers", "biology/dossier.py, dossiers/",
     "64 dossiers, every statement classed (canon, game data, inferred, hypothesis, Blackthorn, unknown) and cited, checked against the archive.",
     DATA, "#/biology/Pineco", "Your reviews (Journal, kind review) decide what becomes approved."),
    ("Field Biology", "Ecology", "biology/ecology.py, johto.json",
     "Johto's landscape, every place's community from the encounter tables, food webs with evidence classes, trophic levels, gaps and keystones; a Level 3 allometric model in the page.",
     LIVE, "#/ecosystems", "The analysis and cascade run in the page (36_ecology.html), held to Python by app/test_biology.mjs; Kanto and Sinnoh landscapes are next."),
    ("Field Biology", "Ecotypes", "biology/ecotypes.py",
     "Egg moves read as how a lineage lives: 1,221 machine ecotypes and the dossiers' 165 curated ones, fitted to the places of each range.",
     DATA, "#/ecotypes", "Your verdicts on the machine ecotypes would let the rules be tuned."),
    ("Workbench", "Decision Lab (team diff)", "workbench.py",
     "Runs every engine over two teams and shows what changes.", PART, "#/battlelab",
     "The Scouting Lab diffs the report, the Battle Lab diffs the whole scouting file and the Survival Lab compares two set-ups; one page that runs all three side by side is next."),
    ("Record", "Intake", "intake.py, ingest/*",
     "Videos, images, pages, pastes and research turned into cards of claims, applied only when approved.",
     DATA, "#/inbox", "Running intake (Gemini, Bulbapedia) stays with Claude; the app shows the inbox and records your verdicts."),
    ("Record", "Engine audit", "sanity.py, canon_checks.py, legacy_audit.py",
     "The engine held to outside references: Smogon's calc, the games' data, the Showdown protocol, Smogon's own files.",
     DATA, "#/engine", ""),
    ("Record", "Canon DB Sheet and its script", "ranch/sheet.py, appscript/",
     "The Sheet the app runs on, its menu, the lineage tree, record-a-hatch and the lock guard.", LIVE, "", ""),
    ("Record", "Reference data", "fetch_reference.py, refdb.py",
     "PokeAPI, Showdown learnsets, Smogon sets and the pret disassemblies, pinned and checksummed.", DATA, "", ""),
]
SCREENS = [   # docs/APP_PRODUCT_SPEC.md v0.2's seven screens
    ("Journey", "#/", LIVE, "The home page and the six chapters."),
    ("Team, with build history side by side", "#/teams", PART, "Team reports self-scout every chapter; build history (what each member ran before) isn't shown yet."),
    ("Decision Lab: swap and diff", "#/battlelab", PART, "Swap members and read the diff in the Scouting Lab, the Battle Lab and the Survival Lab; not yet on one page."),
    ("Breeder Lab: target and moves to routes, chains, timing", "#/stock", LIVE, "Any line, any Gen 2-4 game, a whole starting set: the parents, the chain, the verdict (#/breeder keeps HeartGold's per-move lineages)."),
    ("Field Matrix", "#/survival", LIVE, "The Survival Lab: field moves (machine, badge, slot cost) and every capability for any team, against a scenario."),
    ("Specimen Lab", "#/builds/lab", LIVE, "Stats, genes, the PID and the PKHeX script."),
    ("History and sources", "#/record", PART, "Decisions, locks, world records and evidence; the legacy archive isn't in the app."),
]
OPEN_WORK = [
    ("Roadmap phase 3", "Write .pk files and keep instance records (PKHeX as the materializer, D-024)."),
    ("Roadmap phase 4", "Author the Field Matrix, the rival timeline, Danny, and a proposal queue."),
    ("Roadmap phase 5", "A scheduled refresh that shows what changed."),
    ("Build order 3b", "The ranch authoring loop: pick the satellite, confirm the stud reading (RANCH.md §6)."),
    ("Build order 4", "Engines reading the Sheet back: hatches, answers and readings flow into canon on approval."),
    ("Questions", "Q1: Crystal's missing Fly, Platinum's Waterfall and Defog (QUESTIONS_AND_EXPERIMENTS.md)."),
    ("Questions", "Q4 and the SoulSilver pair/trio audit."),
    ("Ranch", "W-016 (Meganium, the Glasshouse gardener) and W-017 (Miltank, the nursery's milk); who the Day-Care serves."),
    ("Coach settings", "canon/lineups.json coaches are empty: try settings in the Battle Lab, then say which to keep."),
    ("Battle engine", "Switching, hazards and doubles aren't modeled; a one-on-one is the unit (docs/SCOUTING_ENGINE.md)."),
]
VERIFIED = [   # the tests that hold the browser's engines to Python's (tests/test_engines.py, class WebApp)
    ("Report engine", "every trainer version, 60 random edits of them and six exposure reads, sentence for sentence", "5,172 checks"),
    ("Wilderness", "every lineup and 48 random teams across the six games, plus a preview of every pending record", "55 teams"),
    ("Specimen kernel", "PIDs (shiny searches included), natures, genders, Hidden Power, characteristics, stats and both exports", "78 checks"),
    ("Stat math", "the Lab's stats and Hidden Power against trainers/era.py", "6 builds"),
    ("Battle engine", "every lineup (three edited ones too), every section of the scouting file and the what-if league, with the damage calculator in the page", "2,365 sections"),
    ("Launcher", "serving the zip, every data file exactly, reading tabs, writing only the app's tabs", "9 tests"),
    ("The web app in Apps Script's frame", "every menu item, the links and clickable rows on every page, desktop and phone, inside a sandboxed frame built the way Apps Script serves the app", "100+ pages"),
]


def sanity():
    path = os.path.join(ROOT, "docs", "SANITY.md")
    if not os.path.exists(path):
        return {"rows": [], "date": None}
    text = open(path, encoding="utf-8").read()
    date = (re.search(r"\((\d{4}-\d{2}-\d{2})\)", text) or [None, None])[1]
    rows = [[c.strip() for c in line.strip("|").split("|")] for line in text.splitlines() if line.startswith("| ") and "---" not in line]
    return {"date": date, "rows": rows[1:] if rows and rows[0][0] == "Check" else rows}


def inbox():
    cards = []
    for f in sorted(glob.glob(os.path.join(ENGINE, "canon", "inbox", "cards", "*.json"))):
        c = json.load(open(f, encoding="utf-8"))
        src = c.get("source") or {}
        claims = []
        for x in c.get("claims") or []:
            data = x.get("data") or {}
            text = "; ".join(f"{k}: {v if not isinstance(v, (list, dict)) else json.dumps(v, ensure_ascii=False)[:160]}" for k, v in data.items())
            claims.append({"id": x.get("id"), "kind": x.get("kind"), "status": x.get("status"), "text": text[:600],
                           "source": x.get("source_ref"), "applied_to": x.get("applied_to")})
        cards.append({"id": c["id"], "kind": c.get("kind"), "added_on": c.get("added_on"), "provenance": c.get("provenance"),
                      "title": src.get("title") or src.get("url") or c["id"], "url": src.get("url"), "summary": c.get("summary"),
                      "status": c.get("status"), "claims": claims})
    return {"cards": cards}


def main():
    tests = len(re.findall(r"^\s+def test_", open(os.path.join(ENGINE, "tests", "test_engines.py"), encoding="utf-8").read(), re.M))
    keys = ("area", "name", "modules", "what", "status", "where", "next")
    data = {"generated": time.strftime("%Y-%m-%d"), "engines": [dict(zip(keys, e)) for e in ENGINES],
            "screens": [dict(zip(("name", "where", "status", "note"), s)) for s in SCREENS],
            "open": [dict(zip(("area", "what"), o)) for o in OPEN_WORK],
            "verified": [dict(zip(("engine", "how", "size"), v)) for v in VERIFIED], "tests": tests, "sanity": sanity()}
    out = os.path.join(HERE, "data")
    with open(os.path.join(out, "engines.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    ib = inbox()
    with open(os.path.join(out, "inbox.json"), "w", encoding="utf-8") as fh:
        json.dump(ib, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"engines.json: {len(ENGINES)} engines, {tests} tests; inbox.json: {len(ib['cards'])} cards, "
          f"{sum(len(c['claims']) for c in ib['cards'])} claims")


if __name__ == "__main__":
    main()
