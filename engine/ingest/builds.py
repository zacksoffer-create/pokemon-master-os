"""Builds in (docs/INGEST.md): a Showdown paste or PKHeX export becomes a card of build claims, each already read
by the engine: its roles (trainers/roles.py), why it knows each move (D-048), any flags, and how far it is from
the closest archetype (trainers/solver.py). The analysis rides along as the claim's note; the build itself is what
lands in canon/build_library.json once approved, as yours (provenance authored) or external with its source.
"""
from battle.paste import parse
from ingest.cards import digest
from trainers.era import GAME_GEN
from trainers.model import Build, Store
from trainers.roles import RoleBook
from trainers.solver import Solver

FIELDS = ("species", "nickname", "gender", "moves", "item", "ability", "nature", "evs", "ivs", "level")


def read(text, game, store=None):
    """[(build dict, analysis)] for every set in the paste, read in this game."""
    store = store or Store()
    book = RoleBook(store)
    solver = Solver(book)
    out = []
    for i, b in enumerate(parse(text)):
        data = {k: b[k] for k in FIELDS if b.get(k) not in (None, "", [], {})}
        if b.get("happiness") is not None:
            data["friendship"] = b["happiness"]
        build = Build(id=f"paste/{i}", **{k: v for k, v in data.items()})
        roles = book.classify(build, game)
        p, s = roles["primary"], roles["secondary"]
        analysis = {"roles": f"{p['name']} ({p['confidence']})" + (f", then {s['name']}" if s else ""),
                    "why": book.line(roles, top=1),
                    "moves": [f"{m['move']}: {m['reason']}" for m in store.move_basis(build, game)],
                    "flags": store.check(build, game),
                    "closest": solver.distance(build, game)["line"]}
        out.append((data, analysis))
    return out


def to_card(inbox, text, game, provenance="authored", source=None, again=False, store=None):
    gen = GAME_GEN[game]
    claims = []
    for data, a in read(text, game, store):
        data = {**data, "generation": gen}
        note = (f"{a['roles']}. {a['closest']}." + (f" Flags: {'; '.join(a['flags'])}." if a["flags"] else ""))
        claims.append(inbox.claim("build", data, note=note, source_ref=(source or {}).get("url")))
    src = {"title": (source or {}).get("title") or f"Showdown paste ({game})", "url": (source or {}).get("url"),
           "game": game, "note": (source or {}).get("note")}
    names = ", ".join(c["data"]["species"] for c in claims)
    return inbox.new("paste", f"{game}-{digest(text)}", src, provenance, f"{len(claims)} build(s): {names}",
                     claims, raw={"paste": text, "game": game}, again=again)
