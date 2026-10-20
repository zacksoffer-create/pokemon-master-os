"""The Pokédex cross-check (docs/INGEST.md): what the games themselves say about a species, held against what a
video or page claims.

The games' Pokédex entries are already in the local PokeAPI database (pokemon_species_flavor_text), so this runs
with no network and no cost:
- `entries(species)`: every distinct English entry, with the games that carry it, oldest first;
- `crosscheck(inbox, claims)`: each field note or lore claim about a species is compared with that species'
  entries. A claim the games back carries the entry as evidence (`canon_backing`), and a fan work's claim says
  which game backs it. A claim no entry backs is left as it was. The comparison is word overlap after folding
  synonyms (config `pokedex`); a model judge can confirm it (`judge`), never invent it;
- `to_card(inbox, species)`: a species' Pokédex entries as canon field notes (provenance cartridge), so the
  documentary kit has the games' own words to stand on.
"""
import os
import re

from ingest.cards import ENGINE, slug

STOP = set("""a an the of to in on at by for with from and or but its it is are was were be been being as that this these
those their them they there here has have had which who whom whose while when where into onto out over under than then
so such can could may might will would very often also only some any all each every one two up down off about""".split())


def _ref():
    from refdb import Ref
    return Ref(os.path.join(ENGINE, "data", "pokeref.sqlite"))


def entries(species, ref=None, gen_max=None):
    """[{text, versions, gen}] for a species, oldest first; the same words in several games are one entry."""
    ref = ref or _ref()
    sid = ref.species_id(species)
    rows = ref.q("""SELECT f.flavor_text, v.identifier, g.generation_id FROM pokemon_species_flavor_text f
                    JOIN versions v ON v.id = f.version_id JOIN version_groups g ON g.id = v.version_group_id
                    WHERE f.species_id = ? AND f.language_id = 9 ORDER BY CAST(f.version_id AS INT)""", sid)
    out, seen = [], {}
    for text, version, gen in rows:
        clean = " ".join(str(text).replace("\x0c", " ").split())
        clean = re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).capitalize(), clean)   # 'TORTERRA' → 'Torterra'
        clean = clean.replace("POKéMON", "Pokémon").replace("POKé BALL", "Poké Ball")
        if gen_max and int(gen) > gen_max:
            continue
        key = clean.lower()
        if key in seen:
            seen[key]["versions"].append(version)
            continue
        seen[key] = {"text": clean, "versions": [version], "gen": int(gen)}
        out.append(seen[key])
    return out


def _stem(w):
    for suf in ("ies", "ing", "ed", "es", "s", "ly"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def words(text, cfg, drop=()):
    folds = {}
    for group in cfg["pokedex"]["synonyms"]:
        for w in group:
            folds[w] = group[0]
    out = set()
    for w in re.findall(r"[a-zé']+", text.lower()):
        w = w.strip("'")
        if w in STOP or w in drop or len(w) < 3:
            continue
        w = folds.get(w, w)
        w = folds.get(_stem(w), _stem(w))
        out.add(w)
    return out


def score(claim_text, entry_text, cfg, species=""):
    drop = {species.lower(), "pokémon", "pokemon"}
    a, b = words(claim_text, cfg, drop), words(entry_text, cfg, drop)
    shared = a & b
    if not a or not b:
        return 0.0, shared
    return len(shared) / min(len(a), len(b)), shared


def claim_text(c):
    d = c["data"]
    return " ".join(str(d.get(k) or "") for k in ("note", "context", "fact", "behavior", "habitat"))


def crosscheck(inbox, claims, ref=None, judge=None):
    """Attach the games' backing to every field note or lore claim it can find one for. Returns how many."""
    cfg = inbox.cfg
    pc = cfg["pokedex"]
    ref = ref or _ref()
    cache, n = {}, 0
    for c in claims:
        if c["kind"] not in ("field_note", "lore"):
            continue
        species = c["data"].get("species") or c["data"].get("subject")
        if not species:
            continue
        if species not in cache:
            try:
                cache[species] = entries(species, ref)
            except KeyError:
                cache[species] = []
        best = []
        for e in cache[species]:
            s, shared = score(claim_text(c), e["text"], cfg, species)
            if s >= pc["backs_at"] and len(shared) >= pc["shared_at_least"]:
                best.append((s, e, sorted(shared)))
        if not best:
            continue
        best.sort(key=lambda x: -x[0])
        if judge:
            best = [b for b in best if judge(claim_text(c), b[1]["text"])]
            if not best:
                continue
        backing = [{"pokedex": e["text"], "games": e["versions"], "shared": sh, "score": round(sc, 2)}
                   for sc, e, sh in best[:pc["keep"]]]
        c["canon_backing"] = backing
        line = "The games back this: " + "; ".join(
            f"{', '.join(v.replace('-', ' ').title() for v in b['games'])} Pokédex: \"{b['pokedex']}\"" for b in backing)
        if c["data"].get("fan_work"):
            c["note"] = line + " The rest of the claim is the fan work's own."
        else:
            c["note"] = (c.get("note", "") + " " if c.get("note") else "") + line
        n += 1
    return n


ASPECTS = ("diet", "behavior", "social", "habitat")


def aspect_of(text, cfg):
    w = words(text, cfg)
    for aspect in ASPECTS:
        if w & set(cfg["pokedex"]["aspect_words"].get(aspect, [])):
            return aspect
    return "other"


def to_card(inbox, species, gen_max=None, again=False, ref=None):
    """A species' Pokédex entries as canon field notes (the games' own words), one card per species."""
    es = entries(species, ref, gen_max)
    claims = []
    for e in es:
        games = ", ".join(v.replace("-", " ").title() for v in e["versions"])
        claims.append(inbox.claim("field_note", {"species": species, "aspect": aspect_of(e["text"], inbox.cfg),
                                                 "note": e["text"], "games": e["versions"], "gen": e["gen"],
                                                 "canon": True},
                                  source_ref=f"Pokédex: {games}", confidence="HIGH"))
    src = {"title": f"{species}: the games' Pokédex entries", "file": "data/pokeref.sqlite (PokeAPI flavor text)",
           "species": species, "gen_max": gen_max}
    return inbox.new("pokedex", slug(species), src, "cartridge",
                     f"{len(claims)} distinct Pokédex entries for {species}" + (f" through Gen {gen_max}" if gen_max else ""),
                     claims, again=again)


def batch_card(inbox, species, key, title, gen_max=None, again=False, ref=None):
    """Many species' Pokédex entries as canon field notes in one card (a team list, a ranch census), so one review
    covers them all. A species PokeAPI doesn't know is listed as unresolved."""
    ref = ref or _ref()
    claims, missing = [], []
    for sp in species:
        try:
            es = entries(sp, ref, gen_max)
        except KeyError:
            missing.append(sp)
            continue
        for e in es:
            games = ", ".join(v.replace("-", " ").title() for v in e["versions"])
            claims.append(inbox.claim("field_note", {"species": sp, "aspect": aspect_of(e["text"], inbox.cfg),
                                                     "note": e["text"], "games": e["versions"], "gen": e["gen"],
                                                     "canon": True},
                                      source_ref=f"Pokédex: {games}", confidence="HIGH"))
    src = {"title": title, "file": "data/pokeref.sqlite (PokeAPI flavor text)", "species": list(species),
           "gen_max": gen_max, "unresolved": missing}
    return inbox.new("pokedex", key, src, "cartridge",
                     f"{len(claims)} Pokédex entries for {len(species) - len(missing)} species"
                     + (f" through Gen {gen_max}" if gen_max else ""), claims, again=again)
