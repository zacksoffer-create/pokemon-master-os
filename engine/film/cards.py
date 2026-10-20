"""A study becomes a card (docs/FILM.md, docs/INGEST.md): the claims it can stand behind, proposed for review.

- **Observations** are tallies in the Part 2 schema (canon/observations.jsonl): who leads and what it does first,
  who's held back, who closes, who comes in after a faint, the top plays when even, ahead and behind, the
  switches made facing a threat, and the measured aggression ratio. Each carries how many times it was seen
  (sample_size), the format and generation, and the replays it came from.
- **Builds** are the variants (revealed sets grouped by the role they read as) seen in enough battles, with their
  generation, role and the battles that showed them. Moves a battle never showed stay open.

A player maps to a trainer id through film/config.json cards.players (your Showdown name → 'me'); anyone else
files as 'showdown:<name>', and a field study as 'field:<format>'.
"""
from ingest.cards import digest
from film.replays import player_id, url_of


def trainer_for(cfg, who, fmt, override=None):
    if override:
        return override
    if not who:
        return f"field:{fmt}"
    return cfg["cards"]["players"].get(player_id(who), f"showdown:{player_id(who)}")


def claims_for(inbox, cfg, r, trainer):
    cc = cfg["cards"]
    floor, caps, k = cc["observation_min_seen"], cc["per_kind"], cc["examples_per_claim"]
    label = f"Showdown {r['label']}" + (f", {r['who']}" if r["who"] else "") + f" ({r['battles']} battles)"
    base = {"trainer": trainer, "version": None, "battle": label, "format": r["format"], "gen": r["gen"]}
    examples = r.get("examples", {})
    obs = {kind: [] for kind in caps}

    def cite(*key):
        ids = examples.get("|".join(key), [])[:k] or [g["id"] for g in r["games"][:k]]
        return " | ".join(url_of(i) for i in ids)

    def add(kind, situation, pokemon, move, outcome, n, ref, turn=None, **extra):
        if n >= floor and len(obs[kind]) < caps[kind]:
            obs[kind].append(inbox.claim("observation", {**base, "turn": turn, "situation": situation,
                                                         "pokemon": pokemon, "move": move, "outcome": outcome,
                                                         "sample_size": n, **extra}, source_ref=ref))

    for l in r["leads"]:
        first = l["first_move"][0] if l["first_move"] else None
        add("lead", "lead", l["species"], first["name"] if first else "leads",
            f"led {l['n']} of {r['sides']} ({l['share']}%), won {l['win_rate']}%"
            + (f"; first move {first['name']} {first['n']} of {l['n']}" if first else ""), l["n"],
            cite("lead", l["species"]), turn=1)
    for h in r["order"]["held_back"]:
        add("held_back", "held back (first in after half the battle)", h["name"], "kept in back",
            f"held back in {h['n']} battles", h["n"], cite("held_back", h["name"]))
    for c in r["order"]["closers"]:
        mv = c["with"][0]["name"] if c["with"] else "the last knockout"
        add("closer", "closing (the battle's last knockout)", c["name"], mv, f"closed {c['n']} wins", c["n"],
            cite("closer", c["name"]))
    for x in r["pressure"]["after_faint"]:
        first = x["first_move"][0]["name"] if x["first_move"] else "switch in"
        add("after_faint", "after a faint", x["species"], first, f"brought in after a faint {x['n']} times"
            + (f"; opened with {first} {x['first_move'][0]['n']}" if x["first_move"] else ""), x["n"],
            cite("after_faint", x["species"]))
    for st, s in r["states"].items():
        plays = [p for p in s["top_plays"] if p["battles"] >= floor][:caps["state"]]
        for p in plays:
            obs["state"].append(inbox.claim("observation", {
                **base, "turn": None, "situation": st, "pokemon": p["pokemon"], "move": p["move"],
                "outcome": f"chosen when {st} in {p['battles']} battles ({p['n']} times, of {s['chosen']} choices "
                           f"when {st})" + (f"; {p['kos']} knockouts" if p["kos"] else ""),
                "sample_size": p["battles"]}, source_ref=cite("state", st, p["pokemon"], p["move"])))
    for foe, into in r["pressure"]["switch_into"].items():
        for i in into[:1]:
            add("switch", f"facing {foe}", i["name"], "switch in", f"switched in {i['n']} times facing {foe}",
                i["n"], cite("switch", foe, i["name"]))
    a = r["aggression"]
    if a["ratio"] is not None:
        by = ", ".join(f"{st} {s['aggression']}%" for st, s in r["states"].items() if s["aggression"] is not None)
        add("aggression", "all states", "team", "finishing moves",
            f"{a['ratio']}% of finishing-or-wearing choices finish ({a['finishers']} vs {a['attrition']}); {by}",
            a["finishers"] + a["attrition"], cite(), value=a["ratio"],
            by_state={st: s["aggression"] for st, s in r["states"].items()})
    claims = [c for kind in ("aggression", "lead", "state", "after_faint", "closer", "held_back", "switch")
              for c in obs.get(kind, [])]
    builds = 0
    floor_b = 1 if r["who"] else cfg["study"]["min_battles_for_set"]
    for c in r["sets"]:
        for v in c.get("variants", []):
            if v["battles"] < floor_b or builds >= cc["max_builds"]:
                continue
            data = {"species": c["species"], "moves": v["moves"], "item": v["item"], "ability": v["ability"],
                    "generation": r["gen"], "role": v["role"],
                    "name": f"{v['name']} ({r['label']}, {v['battles']} battles)", "tier": "unrated",
                    "move_reasons": {m: f"used in Showdown {r['label']} battles, which Showdown's validator accepted"
                                     for m in v["moves"]},
                    "notes": [f"revealed in {v['battles']} {r['label']} battles"
                              + (f" by {r['who']}" if r["who"] else "") + "; moves no battle showed are open",
                              *([f"also seen: {', '.join(v['also'])}"] if v["also"] else [])]}
            claims.append(inbox.claim("build", {k2: x for k2, x in data.items() if x not in (None, [], "")},
                                      source_ref=url_of(v["example"]),
                                      note=f"{v['name']}, won {v['win_rate']}% of {v['battles']}"))
            builds += 1
    return claims


def to_card(inbox, cfg, r, trainer=None, again=False):
    t = trainer_for(cfg, r["who"], r["format"], trainer)
    claims = claims_for(inbox, cfg, r, t)
    ids = r.get("replays") or [g["id"] for g in r["games"]]
    src = {"title": f"Showdown replays: {r['label']}" + (f", {r['who']}" if r["who"] else ", the field"),
           "url": "https://replay.pokemonshowdown.com/" + (f"?user={r['who']}" if r["who"] else f"?format={r['format']}"),
           "replays": ids, "dates": r["dates"], "ratings": r["ratings"], "trainer": t}
    who = r["who"] or t.replace(":", "-")
    summary = (f"{r['battles']} {r['label']} battles" + (f" by {r['who']} ({r['wins']}-{r['sides'] - r['wins']})" if r["who"] else "")
               + f": {len([c for c in claims if c['kind'] == 'observation'])} observations, "
               f"{len([c for c in claims if c['kind'] == 'build'])} builds. Filed under {t}.")
    key = f"{r['format']}-{who}-{(r['dates'] or ['', ''])[1]}-{digest(' '.join(sorted(ids)))}"
    return inbox.new("film", key, src, "ingested", summary, claims, raw=r, again=again)


def spreads_card(inbox, store, book, cfg, month=None, cutoff=None, again=False, base=None):
    """The film builds in the library get the spread the field most likely runs on them: of the species' top
    spreads in Smogon's monthly numbers, the one the role engine says fits the build's role best. One card of
    corrections (EVs and nature per build), for review."""
    from film.usage import Names, best_spread, evs_line, fetch, species
    from trainers.era import GAME_GEN
    claims, seen, months = [], {}, set()
    prefix = "external: " + cfg["sources"]["replay"].split("{")[0]
    for bid, b in sorted(store.library.items()):
        if not b.source.startswith(prefix) or b.evs or not b.generation:
            continue
        fmt = cfg["usage"]["formats_by_gen"].get(str(b.generation))
        game = next((f["game"] for k, f in cfg["formats"].items() if k == fmt), None)
        if not fmt or not game or b.generation < 3:
            continue
        if fmt not in seen:
            seen[fmt] = (fetch(cfg, fmt, month, cutoff, **({"base": base} if base else {})), Names(cfg, b.generation))
        data, names = seen[fmt]
        line = species(cfg, data, b.species, names)
        if not line:
            continue
        variant = {"species": b.species, "moves": b.moves, "item": b.item, "ability": b.ability, "role": b.role}
        best = best_spread(book, variant, line["spreads"], game, b.generation)
        if not best:
            continue
        months.add(f"{fmt} {data['_month']} ({data['_cutoff']}+)")
        why = (f"Smogon {fmt} {data['_month']}, rated {data['_cutoff']}+: of {b.species}'s top spreads, "
               f"{best['nature']} {evs_line(best['evs'])} (on {best['share']}% of its sets) fits this build's role "
               f"({b.role}) best, fit {best['fit']}.")
        src = cfg["usage"]["chaos"].format(month=data["_month"], fmt=fmt, cutoff=data["_cutoff"])
        claims.append(inbox.claim("correction", {"target": f"canon/build_library.json:builds.{bid}.evs",
                                                 "value": best["evs"], "was": None, "why": why},
                                  confidence="MEDIUM", source_ref=src, note=f"{b.species}: {evs_line(best['evs'])}"))
        claims.append(inbox.claim("correction", {"target": f"canon/build_library.json:builds.{bid}.nature",
                                                 "value": best["nature"], "was": b.nature, "why": why},
                                  confidence="MEDIUM", source_ref=src, note=f"{b.species}: {best['nature']}"))
    srcd = {"title": "Smogon monthly usage stats: spreads for the film builds", "url": cfg["usage"]["index"],
            "months": sorted(months)}
    key = "spreads-" + "-".join(sorted(m.split()[0] + m.split()[1] for m in months)) if months else "spreads-none"
    return inbox.new("usage", key, srcd, "ingested",
                     f"Likely EV spreads and natures for {len(claims) // 2} film builds, from {', '.join(sorted(months))}.",
                     claims, again=again)
