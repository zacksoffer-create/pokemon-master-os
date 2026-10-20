"""The intake inbox (docs/INGEST.md): videos, screenshots, pages, pastes and research in; reviewed facts out.

    python3 -I intake.py status                                  # what's ready: the Gemini key, the hosts, yt-dlp
    python3 -I intake.py video https://youtu.be/… [--note "…"]   # a YouTube/TikTok/Instagram link or a video file
    python3 -I intake.py image screenshot.png [--note "…"]       # a screenshot (summary screen, anime frame, team)
    python3 -I intake.py page https://bulbapedia…/wiki/Paul      # an article or web page
    python3 -I intake.py envelope result.json                    # an analysis already done (Food OS's format too)
    python3 -I intake.py paste team.txt --game platinum [--external "where it came from"]
    python3 -I intake.py card claims.json                        # a card written by hand or by a research agent
    python3 -I intake.py asks [--json]                           # the agent sheet's ASK rows, from what canon still needs
    python3 -I intake.py results tabs.json                       # the agent sheet's RESULTS tabs → one card per job
    python3 -I intake.py list [--open]                           # the inbox
    python3 -I intake.py show CARD
    python3 -I intake.py approve CARD[:c2]   |   reject CARD[:c2] --why "…"   |   edit CARD:c2 generation 4
    python3 -I intake.py apply [CARD]                            # write approved claims into canon
    python3 -I intake.py doc-prompt Garchomp [--style "…"] [--setting "…"] [--seconds 60]
    python3 -I intake.py film --format gen4ou --count 60 [--user NAME] [--trainer me]   # Showdown replays → a card
    python3 -I intake.py research [--only paul,gary] [--no-model]   # the ASK list answered from Bulbapedia → cards
    python3 -I intake.py pokedex Torterra [--gen-max 4]            # the games' Pokédex entries → canon field notes
    python3 -I intake.py pokedex --teams [--gen-max 4]             # every species on a trainer team, in one card
    python3 -I intake.py crosscheck CARD                           # re-check a card's claims against the Pokédex

Nothing reaches canon without approval. Every claim keeps its exact source (a link and timestamp, a file, a page).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from ingest.cards import Inbox, render_card, render_list  # noqa: E402


def target(text):
    card, _, claim = text.partition(":")
    return card, claim or None


def status(inbox):
    cfg = inbox.cfg
    from ingest.media import Gemini
    ok, msg = Gemini(cfg).check()
    print(f"Gemini: {msg}")
    hosts = ["www.youtube.com", "www.tiktok.com", "www.instagram.com", "bulbapedia.bulbagarden.net",
             "archives.bulbagarden.net", "www.serebii.net", "www.smogon.com", "pokemondb.net", "www.pokemon.com",
             "replay.pokemonshowdown.com"]
    for h in hosts:
        try:
            urllib.request.urlopen(urllib.request.Request(f"https://{h}/", method="HEAD"), timeout=8)
            ok = "reachable"
        except urllib.error.HTTPError:
            ok = "reachable"
        except Exception:
            ok = "blocked: allow it in the environment's network settings"
        print(f"  {h}: {ok}")
    tool = shutil.which("yt-dlp") or (subprocess.run([sys.executable, "-m", "yt_dlp", "--version"],
                                                     capture_output=True).returncode == 0)
    print(f"yt-dlp (TikTok/Instagram downloads): {'installed' if tool else 'not installed: pip install yt-dlp'}")
    print(f"Inbox: {len(inbox.all())} cards, {len([c for c in inbox.all() if c['status'] == 'open'])} open")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv and argv[0] == "film":                     # the film room's own options (film_room.py card)
        import film_room
        return film_room.main(["card"] + argv[1:])
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["status", "video", "image", "page", "envelope", "paste", "card", "asks", "results",
                                    "list", "show", "approve", "reject", "edit", "apply", "doc-prompt", "research", "pokedex", "crosscheck"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--note")
    ap.add_argument("--lens", default="pokemon")
    ap.add_argument("--again", action="store_true", help="re-run a source that already has a card")
    ap.add_argument("--game", default="platinum")
    ap.add_argument("--external", help="paste: where the sets came from (otherwise they're yours)")
    ap.add_argument("--why", default="")
    ap.add_argument("--open", action="store_true")
    ap.add_argument("--style")
    ap.add_argument("--setting")
    ap.add_argument("--seconds", type=int)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--only", help="research: trainer ids, comma-separated")
    ap.add_argument("--gen-max", type=int, help="pokedex: entries from games up to this generation")
    ap.add_argument("--teams", action="store_true", help="pokedex: every species on a trainer team in canon")
    ap.add_argument("--no-model", action="store_true", help="research: exact reads only, no Gemini")
    a = ap.parse_args(argv)
    inbox = Inbox()

    if a.cmd == "status":
        status(inbox)
    elif a.cmd in ("video", "image", "page"):
        from ingest.media import NotReady, analyze, to_card
        try:
            env = analyze(inbox.cfg, a.lens, a.cmd, a.args[0], note=a.note)
        except NotReady as e:
            sys.exit(f"Not ready: {e}")
        card, made = to_card(inbox, env, again=a.again)
        print(("New card:\n" if made else "Already in the inbox (use --again to re-run):\n") + render_card(card, inbox))
    elif a.cmd == "envelope":
        from ingest.media import to_card
        with open(a.args[0], encoding="utf-8") as fh:
            env = json.load(fh)
        block = inbox.cfg["lenses"][a.lens]["block"]
        if block not in (env.get("result") or {}):
            sys.exit(f"{a.args[0]} has no '{block}' block (it was analysed with another lens, e.g. Food OS's food "
                     "lens); re-run the source with the Pokémon lens")
        env.setdefault("lens", a.lens)
        card, made = to_card(inbox, env, again=a.again)
        print(render_card(card, inbox))
    elif a.cmd == "paste":
        from ingest.builds import to_card
        text = sys.stdin.read() if not a.args or a.args[0] == "-" else open(a.args[0], encoding="utf-8").read()
        prov = "ingested" if a.external else "authored"
        card, made = to_card(inbox, text, a.game, prov, {"title": a.external, "note": a.note} if a.external else
                             {"note": a.note}, again=a.again)
        print(render_card(card, inbox))
    elif a.cmd == "card":
        with open(a.args[0], encoding="utf-8") as fh:
            spec = json.load(fh)
        claims = [inbox.claim(c["kind"], c["data"], c.get("evidence"), c.get("confidence"), c.get("source_ref"),
                              c.get("note")) for c in spec["claims"]]
        card, made = inbox.new(spec.get("kind", "note"), spec["key"], spec.get("source", {}),
                               spec.get("provenance", "ingested"), spec.get("summary", ""), claims,
                               raw=spec.get("raw"), again=a.again)
        print(render_card(card, inbox))
    elif a.cmd == "asks":
        from ingest.sheet import asks
        from trainers.model import Store
        rows = asks(Store(), inbox=inbox)
        if a.json:
            print(json.dumps(rows, indent=1, ensure_ascii=False))
        else:
            for r in rows:
                print(f"{r['AskID']} [{r['Topic']}] {r['Question']}")
    elif a.cmd == "results":
        from ingest.sheet import cards_from_results
        with open(a.args[0], encoding="utf-8") as fh:
            tabs = json.load(fh)
        for card, made in cards_from_results(inbox, tabs, again=a.again):
            print(("New card:\n" if made else "Already in the inbox:\n") + render_card(card, inbox))
    elif a.cmd == "list":
        cards = inbox.all()
        if a.open:
            cards = [c for c in cards if c["status"] == "open"]
        print(json.dumps(cards, indent=1, ensure_ascii=False) if a.json else render_list(cards))
    elif a.cmd == "show":
        print(render_card(inbox.load(a.args[0]), inbox))
    elif a.cmd == "approve":
        for t in a.args:
            print("\n".join(inbox.approve(*target(t))))
    elif a.cmd == "reject":
        for t in a.args:
            print("\n".join(inbox.reject(*target(t), why=a.why)))
    elif a.cmd == "edit":
        card, claim = target(a.args[0])
        print(inbox.edit(card, claim, a.args[1], a.args[2]))
    elif a.cmd == "apply":
        done = inbox.apply(a.args[0] if a.args else None)
        print("\n".join(done) or "Nothing approved to apply.")
    elif a.cmd == "research":
        from ingest.bulbapedia import research
        from ingest.media import Gemini
        from ingest.sheet import asks
        from trainers.model import Store
        store = Store()
        made, usage = research(inbox, store, asks(store, inbox=inbox), gemini=None if a.no_model else Gemini(inbox.cfg),
                               only=set(a.only.split(",")) if a.only else None)
        for card, _ in made:
            print(render_card(card, inbox) + "\n")
        tokens = sum((u or {}).get("totalTokenCount", 0) for u in usage)
        print(f"{len(made)} card(s); Gemini used {tokens} tokens over {len(usage)} call(s).")
    elif a.cmd == "pokedex":
        from ingest.pokedex import batch_card, to_card as dex_card
        if a.teams:
            from trainers.model import Store
            store = Store()
            have = set()                                 # species whose entries are already canon
            path = os.path.join(inbox.base, inbox.cfg["claims"]["field_note"]["lands_in"])
            if os.path.exists(path):
                with open(path, encoding="utf-8") as fh:
                    have = {json.loads(l).get("species") for l in fh if l.strip() and json.loads(l).get("canon")}
            species = sorted({b.species for t in store.trainers.values() for v in t.versions.values()
                              for b in store.team(v)} - have)
            card, made = batch_card(inbox, species, "trainer-teams", "Every trainer team's species: the games' "
                                    "Pokédex entries", a.gen_max, again=a.again)
        else:
            card, made = dex_card(inbox, a.args[0], a.gen_max, again=a.again)
        print(("New card:\n" if made else "Already in the inbox (use --again to re-run):\n") + render_card(card, inbox))
    elif a.cmd == "crosscheck":
        from ingest.pokedex import crosscheck
        card = inbox.load(a.args[0])
        n = crosscheck(inbox, [c for c in card["claims"] if c["status"] == "proposed"])
        inbox.save(card)
        print(f"{n} claim(s) backed by the Pokédex.\n" + render_card(card, inbox))
    elif a.cmd == "doc-prompt":
        from ingest.docprompt import kit, render
        k = kit(inbox.cfg, a.args[0], a.style, a.setting, a.seconds)
        print(json.dumps(k, indent=1, ensure_ascii=False) if a.json else render(k))


if __name__ == "__main__":
    main()
