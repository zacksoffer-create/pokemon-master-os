"""Claims (Field Biology, v1 B2-B3): the archive's Pokédex entries split into sourced claims, read by biological domain.

    python3 -I engine/biology/claims.py            # engine/data_manifest/biology/claims.json
    python3 -I engine/biology/claims.py Paras      # one species, for a look

A claim is one sentence of one or more Pokédex entries (the same sentence in several games is one claim with all its
sources). Each is read for:
- its domains: anatomy, diet, habitat, behaviour, social life, reproduction, defence, senses, powers, life cycle,
  humans, other species, folklore (a sentence that reports belief: "it is said", "legend", "according to");
- what it says the species eats (diet items, gated by an eating word), which gives the species its feeding guild;
- habitat words, activity (night or day) and social words;
- every other species it names, read as a relationship: feeds on, fed on by, lives with or on (symbiosis), rivalry,
  resemblance, or simply mentioned together.
The reading is pattern-based and labelled as such: the claim's text is canon (class `canon`), the reading of it is
`inferred` (machine-extracted) until you review it. Species with no diet sentence get a guild inferred from type,
marked weak. Nothing is invented: a domain with no claim stays an open question.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
if ENGINE not in sys.path:
    sys.path.insert(0, ENGINE)

ARCHIVE = os.path.join(ENGINE, "data_manifest", "biology", "archive.json")
OUT = os.path.join(ENGINE, "data_manifest", "biology", "claims.json")

W = r"\b"
DOMAINS = {
    "diet": r"\b(eat|eats|eating|ate|eaten|feeds?|feeding|fed|food|diet|preys?|hunts?|hunting|hunted|devours?|devouring|consum\w*|swallows?|gobbles?|nibbles?|graz\w*|sips?|sipping|sucks?|sucking|drinks?|drinking|absorbs? \w*|nutrients?|nutrition|nourish\w*|forag\w*|meals?|appetite|starv\w*|gnaws?|gnawing|chews?|munch\w*|licks?|snacks?|feasts?|catch(es)? (its )?(prey|food|fish))\b",
    "habitat": r"\b(lives?|living|found|inhabits?|dwells?|nests?|nesting|burrows?|caves?|forests?|woods|mountains?|seas?|oceans?|rivers?|lakes?|ponds?|swamps?|marsh\w*|deserts?|volcano\w*|grassland\w*|fields?|plains|trees?|ruins|cities|city|towns?|underground|cliffs?|reefs?|beach\w*|shores?|snow\w*|glaciers?|seafloor|sea floor|depths|jungles?|wetlands?|prairies?|savanna\w*|sewers?|power plants?|skies|sky|clouds?|wilds?|wilderness|tundra|canyons?|valleys?|islands?|coast\w*|waters?)\b",
    "anatomy": r"\b(body|bodies|skin|scales?|shell|fur|feathers?|wings?|tail|horns?|claws?|fangs?|teeth|tooth|tusks?|eyes?|ears?|nose|mouth|beak|legs?|arms?|hands?|feet|fins?|gills|tentacles?|petals?|leaves|bulb|organs?|bones?|muscles?|blood|stomach|brain|hair|mane|antennae?|pincers?|spikes?|quills?|barbs?|needles?|plates?|armor|crest|whiskers|sac|pouch|gland\w*)\b",
    "behavior": r"\b(sleeps?|sleeping|asleep|wakes?|nocturnal|rests?|resting|plays?|playful|dances?|dancing|sings?|singing|cries|cry|runs?|flies|flying|swims?|swimming|digs?|digging|climbs?|hides?|hiding|camouflag\w*|territor\w*|aggressive|docile|timid|gentle|calm|curious|lazy|lazily|shy|hostile|violent|temper\w*|wanders?|migrat\w*|roams?|lurks?|basks?|bathes?|play)\b",
    "social": r"\b(herds?|flocks?|swarms?|colon(y|ies)|groups?|packs?|schools?|pairs?|alone|solitary|together|leaders?|famil(y|ies)|mates?|companions?|troops?|crowds?|gathers?|community|hierarch\w*|rank)\b",
    "reproduction": r"\b(eggs?|hatch\w*|lays?|born|birth|mating|mates?|breed\w*|young|offspring|larva\w*|cocoons?|pupa|spawn\w*|newborn|baby|babies|mother|parents?|raises?|nursing|cub|cubs|chicks?)\b",
    "defense": r"\b(defen[cs]\w*|protects?|protection|threaten\w*|enem(y|ies)|foes?|predators?|escapes?|flee\w*|venom\w*|poison\w*|toxi\w*|stings?|stinger|sprays?|stench|odor|camouflage|disguis\w*|intimidat\w*|danger\w*|attacked|bluff\w*|shields?)\b",
    "senses": r"\b(senses?|sensing|sensitive|detects?|smell\w*|scents?|hears?|hearing|sees?|sight|vision|vibrations?|feels?|aura|telepath\w*|predicts?|foresee\w*|radar|ultrasonic|echolocat\w*)\b",
    "powers": r"\b(electric\w*|fire|flames?|heat|ice|freez\w*|psychic|telekine\w*|ghosts?|curses?|magnet\w*|light|glows?|glowing|sound waves?|wind|storms?|weather|rain|sunlight|moonlight|power|energy|lightning|thunder|explod\w*|explosion)\b",
    "life_cycle": r"\b(evolv\w*|evolution|grows?|growing|ages?|years?|lifespan|centuries|molt\w*|sheds?|shedding|matures?|old|ancient|metamorph\w*)\b",
    "humans": r"\b(people|person|humans?|children|child|kids|trainers?|man|men|woman|women|homes?|houses?|ships?|sailors?|travelers?|villagers?|farms?|pets?|households?)\b",
    "folklore": r"\b(said|legends?|legendary|myths?|mytholog\w*|believed|according to|tales?|folklore|superstition|rumou?red|rumou?rs?|thought to be|considered (to be|a)|sacred|worshipped|deity|god|spirit of)\b",
}
DIET_ITEMS = [
    ("soil", r"\b(nutrients?|nourishment|nutrition|water|moisture) (from|in|out of) (the )?(soil|ground|earth|dirt)\b|\b(roots?|feet) (into|in) the (soil|ground)\b"),
    ("plants", r"\b(leaves|leaf|grass|plants?|roots?|flowers?|fruits?|berr(y|ies)|seeds?|nuts?|bark|moss|vegetation|weeds|shoots|apricorns?|acorns?|mushrooms?|fungi)\b"),
    ("nectar", r"\b(nectar|honey|sap|pollen)\b"),
    ("insects", r"\b(bugs?(?! (Pokémon|host|type))|insects?|caterpillars?|larvae|worms?)\b"),
    ("fish", r"\b(fish|fishes)\b"),
    ("aquatic", r"\b(plankton|krill|seaweed|kelp|algae|microorganisms?|shellfish)\b"),
    ("prey", r"\b(prey|meat|flesh|blood|birds?|rodents?|small (Pokémon|animals|creatures)|other Pokémon|animals)\b"),
    ("scraps", r"\b(scraps|leftovers|left over|carrion|corpses?|dead)\b"),
    ("minerals", r"\b(rocks?|stones?|boulders?|soil|dirt|minerals?|iron|metals?|ore|gems?|jewels?|crystals?|sand|coal|gravel|clay)\b"),
    ("electricity", r"\b(electricity|electric (power|energy|current)|power lines?|power plants?|lightning)\b"),
    ("sunlight", r"\b(sunlight|sunshine|sun's (light|rays)|rays of the sun|photosynth\w*|light of the sun)\b"),
    ("moonlight", r"\b(moonlight|moon's (light|glow)|light of the moon)\b"),
    ("heat", r"\b(magma|lava|heat|flames?|fire)\b"),
    ("psychic", r"\b(dreams?|emotions?|feelings?|life force|life energy|spirits?|souls?|sorrow|anger|grudges?|jealousy|brain waves|psychic energy|negative (energy|emotions)|feelings of)\b"),
    ("waste", r"\b(garbage|trash|sludge|waste|filth|pollut\w*|toxic|chemicals?|sewage)\b"),
    ("water", r"\b(water|rainwater|seawater)\b"),
    ("general", r"\b(food|anything|everything|whatever)\b"),
]
EATING = re.compile(r"\b(eat|eats|eating|ate|eaten|feeds?|feeding|fed|food|diet|preys?|hunts?|hunting|devours?|consum\w*|swallows?|gobbles?|nibbles?|graz\w*|sips?|sipping|sucks?|sucking|drinks?|drinking|absorbs?|absorbing|nutrients?|nutrition|nourish\w*|forag\w*|meals?|appetite|gnaws?|gnawing|chews?|munch\w*|licks?|snacks?|feasts?|catch(es)? (its )?(prey|food|fish)|draws? (on|out)|steals?)\b", re.I)
GUILDS = {   # diet category -> feeding guild, with what that guild means
    "soil": ("root feeder (plant-like)", "takes up nutrients and water from the soil, as plants do"), "general": ("generalist", "eats almost anything"),
    "plants": ("herbivore", "eats plant material"), "nectar": ("sap and nectar feeder", "feeds on sap, nectar, honey or pollen"),
    "insects": ("insectivore", "eats insects and other small invertebrates"), "fish": ("piscivore", "eats fish"),
    "aquatic": ("aquatic grazer or filter feeder", "eats plankton, algae or seaweed"), "prey": ("predator", "hunts and eats other animals"),
    "scraps": ("scavenger", "eats scraps and remains"), "minerals": ("lithovore", "eats rock, soil or metal"),
    "electricity": ("electrotroph", "takes in electricity"), "sunlight": ("phototroph", "lives on sunlight, as plants do"),
    "moonlight": ("lunar phototroph", "draws energy from moonlight"), "heat": ("thermotroph", "takes in heat or magma"),
    "psychic": ("psychotroph", "feeds on dreams, emotions or life energy"), "waste": ("detritivore of waste", "feeds on garbage, sludge or waste"),
}
TYPE_GUESS = {   # a weak, labelled guess when the Pokédex says nothing about food
    "Grass": "sunlight", "Electric": "electricity", "Fire": "heat", "Rock": "minerals", "Steel": "minerals", "Ground": "minerals",
    "Ghost": "psychic", "Psychic": "psychic", "Poison": "waste", "Water": "aquatic", "Bug": "plants", "Ice": "aquatic",
    "Flying": "insects", "Dragon": "prey", "Dark": "prey", "Fighting": "prey", "Normal": "plants",
}
HABITAT_TAGS = [
    ("forest", r"\b(forests?|woods|trees?|jungles?|woodland\w*)\b"), ("grassland", r"\b(grass\w*|fields?|plains|meadows?|prairies?|savanna\w*)\b"),
    ("mountain", r"\b(mountains?|peaks?|cliffs?|crags?|rocky)\b"), ("cave", r"\b(caves?|caverns?|underground|tunnels?|dark places)\b"),
    ("sea", r"\b(seas?|oceans?|sea floor|seafloor|depths|reefs?|tides?|waves|offshore)\b"), ("coast", r"\b(beach\w*|shores?|coast\w*|seaside)\b"),
    ("freshwater", r"\b(rivers?|lakes?|ponds?|streams?|waterfalls?|springs?|fresh water)\b"), ("wetland", r"\b(swamps?|marsh\w*|bogs?|wetlands?|mud\w*)\b"),
    ("desert", r"\b(deserts?|dunes?|arid|wastelands?)\b"), ("volcanic", r"\b(volcano\w*|magma|lava|craters?|hot springs?)\b"),
    ("cold", r"\b(snow\w*|ice|icy|glaciers?|frozen|cold regions|tundra|arctic)\b"), ("sky", r"\b(sky|skies|clouds?|stratosphere|high altitude)\b"),
    ("urban", r"\b(cities|city|towns?|houses?|homes?|buildings?|sewers?|power plants?|garbage dumps?|factor(y|ies)|ruins)\b"),
]
NIGHT = re.compile(r"\b(at night|nocturnal|by night|after dark|in the dark|night falls|darkness|moonlit|nighttime)\b", re.I)
DAY = re.compile(r"\b(by day|during the day|daytime|in the sun|sunny|sunlight|diurnal)\b", re.I)
GROUP = re.compile(r"\b(herds?|flocks?|swarms?|colon(y|ies)|groups?|packs?|schools?|troops?|crowds?|in pairs|together|gathers?)\b", re.I)
ALONE = re.compile(r"\b(alone|solitary|by itself|on its own|loner|lone)\b", re.I)
REL = [   # (kind, pattern with NAME), tried in order
    ("feeds_on", r"\b(eat|eats|eating|ate|feeds? on|feeding on|preys? on|hunts?|hunting|devours?|swallows?|catch(es)?|consumes?|gobbles?|sucks?|drinks?|steals?|snacks? on)\b[^.]{0,45}\bNAME\b"),
    ("fed_on_by", r"\bNAME\b[^.]{0,45}\b(eats?|preys? on|hunts?|devours?|swallows?|catch(es)?|feeds? on|targets?)\b[^.]{0,25}\b(it|them|its)\b|\b(prey|food|meal) (of|for) NAME\b|\b(eaten|hunted|preyed (up)?on|devoured|targeted) by NAME\b"),
    ("symbiosis", r"\b(latch\w*|attach\w*|cling\w*|bites?|biting|lives? (on|with|alongside)|living (on|with)|rides?|riding|carr(y|ies)|nests?|born on|hosts?|parasit\w*|symbio\w*|together|tail)\b"),
    ("rivalry", r"\b(rivals?|rivalry|enem(y|ies)|feud\w*|hates?|fights?|battles?|natural (foe|enemy|enemies)|sworn)\b"),
    ("resemblance", r"\b(mistaken|resembles?|looks? like|similar|imitat\w*|mimic\w*|disguis\w*|copy|copies)\b"),
]
ABBREV = re.compile(r"\b(Mr|Mt|Dr|St|Jr|Sr|Ms|Mrs)\.$")


def sentences(text):
    """Split an entry into sentences, keeping 'Mr. Mime' and 'Mt. Silver' whole."""
    parts, out = re.split(r"(?<=[.!?])\s+", text), []
    for p in parts:
        if out and ABBREV.search(out[-1]):
            out[-1] += " " + p
        else:
            out.append(p)
    return [s.strip() for s in out if s.strip()]


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


class Claims:
    def __init__(self, archive=None):
        if archive is None:
            with open(ARCHIVE, encoding="utf-8") as fh:
                archive = json.load(fh)
        self.a = archive
        self.by_name = {s["name"]: s for s in archive["species"]}
        self.family = {}
        for s in archive["species"]:
            for n in s["evolution"]["chain"]:
                self.family.setdefault(s["name"], set()).add(n)
        names = sorted((s["name"] for s in archive["species"]), key=len, reverse=True)
        self.name_re = re.compile(r"(?<![A-Za-z])(" + "|".join(re.escape(n) for n in names) + r")(?![a-z])")
        self.dom = {k: re.compile(v, re.I) for k, v in DOMAINS.items()}
        self.items = [(k, re.compile(v, re.I)) for k, v in DIET_ITEMS]
        self.habs = [(k, re.compile(v, re.I)) for k, v in HABITAT_TAGS]

    def relation(self, sentence, other):
        passive = re.search(r"\bby (a |an |the )?" + re.escape(other) + r"\b", sentence, re.I)
        for kind, pat in REL:
            if kind == "feeds_on" and passive:
                continue
            if re.search(pat.replace("NAME", re.escape(other)), sentence, re.I):
                return kind
        return "mentioned"

    def species(self, s):
        merged, order = {}, []
        for e in s["entries"]:
            for i, sent in enumerate(sentences(e["text"])):
                k = norm(sent)
                if not k:
                    continue
                if k not in merged:
                    merged[k] = {"text": sent, "src": [], "versions": []}
                    order.append(k)
                merged[k]["src"].append(e["id"])
                merged[k]["versions"] += [v for v in e["versions"] if v not in merged[k]["versions"]]
        claims, diet, habitats, rels = [], {}, {}, []
        night = day = group = alone = 0
        for n, k in enumerate(order):
            c = merged[k]
            t = c["text"]
            doms = [d for d, rx in self.dom.items() if rx.search(t)]
            named = [m.group(1) for m in self.name_re.finditer(t)]
            others = [x for x in dict.fromkeys(named) if x != s["name"] and x not in self.family.get(s["name"], ())]
            if others:
                doms.append("other_species")
            items = []
            subject_other = any(re.match(r"^(The |A |An |This |That |Its |Each )?" + re.escape(o) + r"\b", t) for o in others)
            if EATING.search(t) and not subject_other:      # a sentence about another species' food isn't this one's diet
                items = [cat for cat, rx in self.items if rx.search(t)]
                if "soil" in items and "minerals" in items and not re.search(r"\b(rocks?|stones?|iron|metals?|ore|gems?|jewels?|crystals?|coal|gravel)\b", t, re.I):
                    items.remove("minerals")       # nutrients from the soil is uptake, not eating rock
                if "general" in items and len(items) > 1:
                    items.remove("general")
                if "diet" not in doms:
                    doms.insert(0, "diet")
            claim = {"id": f"C{s['id']}.{n + 1}", "text": t, "src": c["src"], "versions": c["versions"], "domains": doms}
            if "folklore" in doms:
                claim["folklore"] = True
            if items:
                claim["diet"] = items
                for it in items:
                    diet.setdefault(it, []).append((claim["id"], bool(claim.get("folklore"))))
            for tag, rx in self.habs:
                if rx.search(t) and ("habitat" in doms or "diet" in doms):
                    habitats.setdefault(tag, []).append(claim["id"])
            night += bool(NIGHT.search(t))
            day += bool(DAY.search(t))
            group += bool(GROUP.search(t))
            alone += bool(ALONE.search(t))
            if others:
                claim["names"] = others
                for o in others:
                    rels.append({"a": s["name"], "b": o, "kind": self.relation(t, o), "claim": claim["id"]})
            claims.append(claim)
        guild = self.guild(s, diet)
        diet = {k: [c for c, _ in v] for k, v in diet.items()}
        return {"id": s["id"], "name": s["name"], "claims": claims, "diet": diet, "guild": guild,
                "habitats": habitats, "activity": "night" if night > day else "day" if day > night else None,
                "social": "groups" if group > alone else "solitary" if alone > group else None, "relationships": rels,
                "open": [d for d in ("diet", "habitat", "behavior", "social", "reproduction", "defense", "senses")
                         if not any(d in c["domains"] for c in claims)]}

    def guild(self, s, diet):
        """The feeding guild from what its entries say it eats (folklore counts only when nothing else does)."""
        firm = {c: [x for x in v if not x[1]] for c, v in diet.items()}
        use = firm if any(firm[c] for c in firm if c != "water") else diet
        cats = [c for c in use if c != "water" and use[c]]
        if len(cats) > 1 and "general" in cats:
            cats.remove("general")
        if cats:
            diet = use
            ranked = sorted(cats, key=lambda c: (-len(diet[c]), [k for k, _ in DIET_ITEMS].index(c)))
            animal = {"insects", "fish", "prey", "scraps"} & set(cats)
            plant = {"plants", "nectar"} & set(cats)
            primary = ranked[0]
            name, means = GUILDS[primary]
            if animal and plant:
                name, means = "omnivore", "eats both plant and animal food"
            return {"guild": name, "means": means, "categories": ranked, "class": "inferred", "basis": "its Pokédex entries",
                    "confidence": "medium" if sum(len(diet[c]) for c in cats) > 1 else "low"}
        for t in s["types"]:
            if t in TYPE_GUESS:
                cat = TYPE_GUESS[t]
                return {"guild": GUILDS[cat][0], "means": GUILDS[cat][1], "categories": [cat], "class": "hypothesis",
                        "basis": f"its {t} type only (the Pokédex never says what it eats)", "confidence": "weak"}
        return {"guild": "unknown", "means": "the Pokédex never says", "categories": [], "class": "unknown", "basis": "", "confidence": "none"}

    def build(self):
        per = [self.species(s) for s in self.a["species"]]
        rels = [r for p in per for r in p["relationships"]]
        return {"_note": "Built by biology/claims.py: the archive's Pokédex entries as sourced claims, read by pattern "
                         "(the text is canon; the reading is machine-extracted and yours to review).",
                "domains": list(DOMAINS) + ["other_species"], "guilds": {k: {"guild": v[0], "means": v[1]} for k, v in GUILDS.items()},
                "species": per, "relationships": rels}


def main():
    c = Claims()
    if len(sys.argv) > 1:
        s = c.by_name[sys.argv[1]]
        r = c.species(s)
        print(json.dumps({k: v for k, v in r.items() if k != "claims"}, indent=1, ensure_ascii=False))
        for cl in r["claims"]:
            print(f"- [{', '.join(cl['domains'])}]{' FOLK' if cl.get('folklore') else ''}{' diet=' + str(cl['diet']) if cl.get('diet') else ''} {cl['text']}  ({', '.join(cl['versions'])})")
        return
    data = c.build()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    n = sum(len(s["claims"]) for s in data["species"])
    known = sum(1 for s in data["species"] if s["guild"]["class"] == "inferred")
    print(f"{OUT}: {n} claims, {len(data['relationships'])} species-to-species mentions, guild from the Pokédex for {known} species, "
          f"{os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
