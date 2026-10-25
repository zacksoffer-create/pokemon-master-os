"""Curated dossiers (Field Biology, v1 B5): the format, and the check every dossier passes before the app shows it.

    python3 -I engine/biology/dossier.py --check            # every dossier in engine/biology/dossiers/
    python3 -I engine/biology/dossier.py --check pineco     # one
    python3 -I engine/biology/dossier.py --template Pineco  # an empty dossier to fill

A dossier is a field-guide account of one species, written from its evidence pack (evidence.py) and nothing else. Every
statement carries an evidence class and the ids it rests on, so you can see at a glance what the games say, what is
read from game data, what is a biological inference, and what is a hypothesis or Blackthorn's own invention:

    canon       the Pokédex says it; cites entry ids (204.2) or claim ids (C204.3), of this species or its line
    mechanic    game data says it (types, size, abilities, moves, encounter tables); cites game:<field> or move:<Name>
    inferred    a strong biological inference from canon or mechanics; cites what it's inferred from
    hypothesis  plausible, untested; says why in a note
    creative    Blackthorn world-building, never mistaken for canon
    unknown     we don't know; the statement says what's missing

Real-world biology appears only as a labelled `analogy` on a statement ("as in orb-weaving spiders ..."), never as
evidence. Confidence (high / medium / low) is separate from the class. A dossier is a draft until you approve it in
the app (your review is kept in the Journal, so the file stays the author's account).
"""
import json
import os
import re
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

from biology import claims as C        # noqa: E402
from biology.evidence import Evidence, slug  # noqa: E402

DIR = os.path.join(HERE, "dossiers")
SECTIONS = {   # key -> (heading, what belongs there)
    "anatomy": ("Anatomy", "body plan, size, structures and what they're for"),
    "diet": ("Diet and foraging", "what it eats and how it gets it"),
    "habitat": ("Habitat and range", "where it lives, at what scale, and where the games put it"),
    "behavior": ("Behaviour", "what it does day to day, activity pattern"),
    "social": ("Social life", "alone, pairs, groups, hierarchies, communication"),
    "reproduction": ("Reproduction", "breeding, eggs, care of young (egg groups and cycles are mechanics)"),
    "defense": ("Defence", "how it avoids being eaten or hurt"),
    "senses": ("Senses", "how it perceives the world"),
    "life_cycle": ("Life cycle", "evolution read as development: what changes and why"),
    "moves_in_the_wild": ("Moves in the wild", "how its natural moves serve feeding, defence and travel; moves explain biology, they don't define it"),
    "ecology": ("Role in the ecosystem", "what it does for and to the community it lives in"),
    "humans": ("People", "its history with people, uses, dangers"),
    "homestead": ("At the homestead", "what it could provide, and what it would need, at Blackthorn"),
}
CLASSES = ("canon", "mechanic", "inferred", "hypothesis", "creative", "unknown")
CONFIDENCE = ("high", "medium", "low")
GAME_FIELDS = {"types", "size", "shape", "color", "habitat", "egg_groups", "gender", "egg_cycles", "growth", "catch_rate",
               "friendship", "evolution", "abilities", "encounters", "learnset", "capability", "genus"}
GUILDS = sorted({g for g, _ in C.GUILDS.values()} | {"detritivore", "decomposer", "filter feeder", "parasite", "omnivore",
                                                     "fungivore", "frugivore", "granivore", "scavenger", "mixotroph"})
ACTIVITY = ("diurnal", "nocturnal", "crepuscular", "cathemeral", "unknown")
REL_KINDS = {
    "feeds_on": "eats it", "preyed_on_by": "is eaten by it", "competes_with": "competes for the same resource",
    "mutualism": "both benefit", "commensalism": "one benefits, the other is unaffected", "parasitism": "one lives at the other's cost",
    "host_of": "carries a parasite or symbiont", "engineers": "changes the habitat others use", "disperses": "carries its seeds or spores",
    "pollinates": "carries its pollen", "mimics": "resembles it", "rivalry": "a stated rivalry", "evolves_into": "develops into it",
    "shares_habitat": "found in the same places", "uses_resource": "depends on a non-Pokémon resource",
}
ENTRY = re.compile(r"^\d+\.\d+$")
CLAIM = re.compile(r"^C\d+\.\d+$")


def statement(text="", cls="canon", conf="high", evidence=None, note=None, analogy=None):
    s = {"text": text, "class": cls, "confidence": conf, "evidence": evidence or []}
    if note:
        s["note"] = note
    if analogy:
        s["analogy"] = analogy
    return s


class Checker:
    """Checks dossiers against the archive and claims: cited ids exist, classes are backed, moves are learnable."""

    def __init__(self):
        self.ev = Evidence()
        self.entries = {e["id"]: s["name"] for s in self.ev.archive["species"] for e in s["entries"]}
        self.claim_ids = {c["id"]: s["name"] for s in self.ev.claims["species"] for c in s["claims"]}
        self.names = set(self.ev.sp)
        self._moves = {}
        self.cap_ids = set()
        model = os.path.join(ENGINE, "capability", "model.json")
        if os.path.exists(model):
            m = json.load(open(model, encoding="utf-8"))
            self.cap_ids = set(m["capabilities"]) if isinstance(m["capabilities"], dict) else {c["id"] for c in m["capabilities"]}

    def line(self, name):
        return self.ev.sp[name]["evolution"]["chain"]

    def moves(self, name):
        """Every move the species' line can learn in HGSS, by method (egg moves sit on the line's first stage)."""
        if name not in self._moves:
            out = {}
            for nm in self.line(name):
                if nm not in self.ev.sp:
                    continue
                for k, xs in self.ev.learnset(self.ev.sp[nm]["id"]).items():
                    for x in xs:
                        out.setdefault(k, set()).add(re.sub(r" \(Lv \d+\)$", "", x))
            self._moves[name] = out
        return self._moves[name]

    def check(self, d):
        errs, warns = [], []
        name = d.get("species")
        if name not in self.names:
            return [f"species {name!r} isn't a Gen I-IV species"], []
        line = set(self.line(name))
        own_moves = set().union(*self.moves(name).values()) if self.moves(name) else set()
        egg = self.moves(name).get("egg", set())
        for k in ("id", "status", "written_by", "date", "summary", "sections"):
            if k not in d:
                errs.append(f"missing {k}")
        if d.get("id") != self.ev.sp[name]["id"]:
            errs.append(f"id {d.get('id')} isn't {name}'s ({self.ev.sp[name]['id']})")
        if d.get("status") not in ("draft", "approved", "rejected"):
            errs.append(f"status {d.get('status')!r}")

        def cite(where, s, need=True):
            ev = s.get("evidence", [])
            if not isinstance(ev, list):
                errs.append(f"{where}: evidence must be a list")
                return
            for t in ev:
                if ENTRY.match(t):
                    if t not in self.entries:
                        errs.append(f"{where}: entry {t} doesn't exist")
                elif CLAIM.match(t):
                    if t not in self.claim_ids:
                        errs.append(f"{where}: claim {t} doesn't exist")
                elif t.startswith("game:"):
                    if t[5:] not in GAME_FIELDS:
                        errs.append(f"{where}: unknown game field {t}")
                elif t.startswith("move:"):
                    if t[5:] not in own_moves:
                        errs.append(f"{where}: {name}'s line can't learn {t[5:]} in HGSS")
                elif t.startswith("species:"):
                    if t[8:] not in self.names:
                        errs.append(f"{where}: unknown species {t[8:]}")
                else:
                    errs.append(f"{where}: unrecognised evidence {t!r}")
            cls = s.get("class")
            if cls not in CLASSES:
                errs.append(f"{where}: class {cls!r}")
                return
            if cls == "canon":
                own = [t for t in ev if (ENTRY.match(t) and self.entries.get(t) in line) or (CLAIM.match(t) and self.claim_ids.get(t) in line)]
                other = [t for t in ev if (ENTRY.match(t) or CLAIM.match(t)) and t not in own]
                if not own and not other:
                    errs.append(f"{where}: canon must cite a Pokédex entry or claim")
            elif cls == "mechanic" and not any(t.startswith(("game:", "move:")) for t in ev):
                errs.append(f"{where}: mechanic must cite game:<field> or move:<Name>")
            elif cls == "inferred" and need and not ev:
                errs.append(f"{where}: inferred must cite what it's inferred from")
            elif cls == "hypothesis" and not (s.get("note") or ev):
                warns.append(f"{where}: a hypothesis should say why (note) or what it rests on")
            if cls != "creative" and s.get("confidence") not in CONFIDENCE:
                errs.append(f"{where}: confidence {s.get('confidence')!r}")
            if s.get("capability") and s["capability"] not in self.cap_ids:
                errs.append(f"{where}: unknown capability {s['capability']}")

        secs = d.get("sections", {})
        for k in secs:
            if k not in SECTIONS:
                errs.append(f"unknown section {k}")
        for k in SECTIONS:
            xs = secs.get(k, [])
            if not xs:
                warns.append(f"section {k} is empty")
            for i, s in enumerate(xs):
                if not s.get("text"):
                    errs.append(f"{k}[{i}]: no text")
                cite(f"{k}[{i}]", s)
        n = d.get("niche", {})
        if n:
            if n.get("guild") and n["guild"] not in GUILDS:
                errs.append(f"niche: guild {n['guild']!r} (one of {', '.join(GUILDS)})")
            tl = n.get("trophic_level")
            if tl is not None and not (isinstance(tl, (int, float)) and 1 <= tl <= 5):
                errs.append("niche: trophic_level is 1-5 or null")
            if n.get("activity") and n["activity"] not in ACTIVITY:
                errs.append(f"niche: activity {n['activity']!r}")
            cite("niche", {**n, "class": n.get("class", "inferred"), "confidence": n.get("confidence", "medium")})
        else:
            errs.append("missing niche")
        for i, r in enumerate(d.get("relationships", [])):
            if r.get("kind") not in REL_KINDS:
                errs.append(f"relationships[{i}]: kind {r.get('kind')!r}")
            if not r.get("with"):
                errs.append(f"relationships[{i}]: with whom?")
            cite(f"relationships[{i}]", r)
        for i, e in enumerate(d.get("ecotypes", [])):
            if e.get("class") not in ("hypothesis", "creative"):
                errs.append(f"ecotypes[{i}]: an ecotype is a hypothesis or creative, never canon")
            for m in e.get("moves", []):
                if m not in egg:
                    errs.append(f"ecotypes[{i}]: {m} isn't an egg move of {name}'s line in HGSS")
            if not e.get("name") or not e.get("reading"):
                errs.append(f"ecotypes[{i}]: needs a name and a reading")
            cite(f"ecotypes[{i}]", {**e, "confidence": e.get("confidence", "low")}, need=False)
        for i, c in enumerate(d.get("contradictions", [])):
            for t in c.get("entries", []):
                if t not in self.entries:
                    errs.append(f"contradictions[{i}]: entry {t} doesn't exist")
        for i, f in enumerate(d.get("folklore", [])):
            cite(f"folklore[{i}]", {**f, "class": "canon", "confidence": "high"})
        # every Pokédex entry of the species should be used somewhere (cited, folklore or contradiction)
        used = set(re.findall(r"\b\d+\.\d+\b", json.dumps(d)))
        used |= {self.claims_entry(t) for t in re.findall(r"\bC\d+\.\d+\b", json.dumps(d))}
        missed = [e["id"] for e in self.ev.sp[name]["entries"] if e["id"] not in used]
        if missed:
            warns.append(f"entries not cited anywhere: {', '.join(missed)}")
        return errs, warns

    def claims_entry(self, cid):
        sid = int(cid[1:].split(".")[0])
        for s in self.ev.claims["species"]:
            if s["id"] == sid:
                for c in s["claims"]:
                    if c["id"] == cid:
                        return c["src"][0] if c["src"] else ""
        return ""


def template(name, ev=None):
    ev = ev or Evidence()
    s = ev.sp[name]
    return {"species": name, "id": s["id"], "status": "draft", "written_by": "", "date": date.today().isoformat(),
            "summary": "", "sections": {k: [] for k in SECTIONS},
            "niche": {"guild": None, "trophic_level": None, "microhabitat": [], "activity": "unknown", "foraging": "", "evidence": []},
            "relationships": [], "ecotypes": [], "open_questions": [], "contradictions": [], "folklore": []}


def load(slug_):
    with open(os.path.join(DIR, slug_ + ".json"), encoding="utf-8") as fh:
        return json.load(fh)


def all_slugs():
    return sorted(f[:-5] for f in os.listdir(DIR) if f.endswith(".json")) if os.path.isdir(DIR) else []


def main():
    if "--template" in sys.argv:
        print(json.dumps(template(sys.argv[sys.argv.index("--template") + 1]), indent=2, ensure_ascii=False))
        return
    want = [a for a in sys.argv[1:] if not a.startswith("--")] or all_slugs()
    ch, bad = Checker(), 0
    for sl in want:
        try:
            d = load(sl)
        except (OSError, json.JSONDecodeError) as e:
            print(f"{sl}: can't read ({e})")
            bad += 1
            continue
        errs, warns = ch.check(d)
        bad += bool(errs)
        print(f"{sl}: {'OK' if not errs else str(len(errs)) + ' error(s)'}" + (f", {len(warns)} warning(s)" if warns else ""))
        for e in errs:
            print("   ERROR", e)
        for w in warns:
            print("   warn ", w)
    print(f"{len(want)} dossier(s), {bad} with errors")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
