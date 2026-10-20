"""Bulbapedia research (docs/INGEST.md): the open questions on the agent sheet's ASK list, answered from Bulbapedia's
page source, exactly where the page is structured and through Gemini only where it's prose.

What it reads (raw wikitext, cached in data/raw/bulbapedia; text is CC BY-NC-SA, so every claim cites its page):
- **a Pokémon's own page** ("Paul's Torterra"): the anime moves-used table (each move, the episode it was first
  used in, and the moves marked as its most recent set), and its History split by series;
- **a trainer's page** for Pokémon without one (Paul#Ninjask): the TrainerPoké entry and its "known moves";
- **the Achievements lists** ("[[Indigo Plateau Conference]] - Top 32 (EP077)"): league and contest results.

What it proposes, one card per trainer version, every claim a correction for review:
- **movesets:** the moves used in the version's era, and the four known at its moment (Gemini reads the era's
  history when it can; otherwise the most recent set, then the most mentioned). Moves the game can't teach are
  flagged;
- **signature moves:** how often the move is mentioned in the era's history against the rest of the moveset, and
  where it was first used: confirmed when it ranks near the top, otherwise the move that does;
- **aces:** a cartridge team's ace is the one the game marks (the unique top level; D-050); an anime ace is the
  teammate the era's history names most (and Gemini's read of the page, when it can);
- **careers:** the Achievements line for the event, with its episode.
"""
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from ingest.cards import slug

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
HEADING = re.compile(r"^(={2,6})\s*(.+?)\s*\1\s*$", re.M)
REDIRECT = re.compile(r"^#REDIRECT\s*\[\[([^\]]+)\]\]", re.I)


class Missing(Exception):
    """A page Bulbapedia doesn't have."""


# --- the wiki ------------------------------------------------------------------------------------------
class Wiki:
    def __init__(self, cfg, base=ENGINE):
        self.c = cfg["bulbapedia"]
        self.dir = os.path.join(base, self.c["cache"])

    def url(self, title):
        return self.c["page"].format(title=urllib.parse.quote(title.replace(" ", "_"), safe="#()'_,:!"))

    def _fetch(self, title):
        path = os.path.join(self.dir, slug(title, 120) + ".txt")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                return fh.read()
        req = urllib.request.Request(self.c["raw"].format(title=urllib.parse.quote(title)),
                                     headers={"User-Agent": self.c["user_agent"]})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                text = r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise Missing(title) from None
            raise
        os.makedirs(self.dir, exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
        return text

    def page(self, title, hops=3):
        """(final title, anchor or None, wikitext), following redirects."""
        anchor = None
        for _ in range(hops):
            text = self._fetch(title)
            m = REDIRECT.match(text.strip())
            if not m:
                return title, anchor, text
            title, _, anchor = m.group(1).partition("#")
            anchor = anchor or None
        raise Missing(title)


# --- reading wikitext ----------------------------------------------------------------------------------
def heading_key(raw):
    """'{{aniseries|DP}}' → 'DP'; "''[[Pokémon the Series: Diamond and Pearl]]''" → 'Pokémon the Series: Diamond
    and Pearl'; '[[Z-Move]]s used' → 'Z-Moves used'."""
    s = re.sub(r"\{\{aniseries\|([^}|]+)[^}]*\}\}", r"\1", raw)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    return s.replace("'''", "").replace("''", "").strip()


def headings(text):
    return [(m.start(), m.end(), len(m.group(1)), heading_key(m.group(2))) for m in HEADING.finditer(text)]


def section(text, names, start=0, end=None):
    """The text under the first heading whose key matches one of `names` (case-insensitive), within
    [start, end). Returns (start, end) of its body, or None."""
    end = len(text) if end is None else end
    want = {n.lower() for n in names}
    hs = [h for h in headings(text) if start <= h[0] < end]
    for i, (s, e, lvl, key) in enumerate(hs):
        if key.lower() in want:
            stop = next((h[0] for h in hs[i + 1:] if h[2] <= lvl), end)
            return e, stop
    return None


def path(text, *steps):
    """Nested sections: path(text, ["History"], ["DP"]) → (start, end) or None."""
    span = (0, len(text))
    for names in steps:
        span = section(text, names, *span)
        if span is None:
            return None
    return span


def template_blocks(text, name):
    """Every {{name|…}} block, with its nested braces intact."""
    out, i, opener = [], 0, "{{" + name
    while True:
        i = text.find(opener, i)
        if i < 0:
            return out
        depth, j = 0, i
        while j < len(text) - 1:
            two = text[j:j + 2]
            if two == "{{":
                depth += 1
                j += 2
                continue
            if two == "}}":
                depth -= 1
                j += 2
                if depth == 0:
                    break
                continue
            j += 1
        out.append(text[i:j])
        i = j


def params(block):
    """{{T|a|b|k=v}} → ([a, b], {k: v}), splitting on top-level pipes only."""
    body = block[2:-2]
    parts, depth, cur, i = [], 0, "", 0
    while i < len(body):
        two = body[i:i + 2]
        if two in ("{{", "[["):
            depth += 1
            cur += two
            i += 2
            continue
        if two in ("}}", "]]"):
            depth -= 1
            cur += two
            i += 2
            continue
        if body[i] == "|" and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += body[i]
        i += 1
    parts.append(cur)
    pos, named = [], {}
    for p in parts[1:]:
        k, eq, v = p.partition("=")
        if eq and re.fullmatch(r"\s*[\w ]+\s*", k):
            named[k.strip()] = v.strip()
        else:
            pos.append(p.strip())
    return pos, named


def anmov(text):
    """The anime moves-used table (the first one on the page): [{move, type, episode, title, recent}]."""
    span = section(text, ["Moves used"])
    if not span:
        return []
    body = text[span[0]:span[1]]
    stop = body.find("{{anmov/f")
    body = body[:stop] if stop >= 0 else body
    rows = []
    for b in template_blocks(body, "anmov|"):
        pos, named = params(b)
        if len(pos) < 3:
            continue
        rows.append({"move": pos[1], "type": pos[0].lower(), "episode": pos[2],
                     "title": re.sub(r"\{\{tt\|.*", "", pos[3]).strip() if len(pos) > 3 else None,
                     "recent": named.get("rec") == "yes", "other": named.get("x") == "yes"})
    return rows


def trainer_poke(text, species):
    """The {{TrainerPoké|…|pkmn=Species|…}} entry on a trainer's page, as named params."""
    for b in template_blocks(text, "TrainerPoké"):
        _, named = params(b)
        if named.get("pkmn", "").lower() == species.lower():
            return named
    return None


def abilities_of(text):
    """The abilities a page or entry records (an infobox's |ability=…, or 'its [[Ability]] is {{a|X}}'); a line
    that evolved can list one per stage."""
    m = re.search(r"\|\s*ability\s*=([^\n]*)", text or "")
    if m:
        return re.findall(r"\{\{a\|([^}|]+)", m.group(1))
    return re.findall(r"its \[\[Ability\]\] is \{\{a\|([^}|]+)", text or "")


def known_moves(desc):
    """'Ninjask's known moves are {{m|Swords Dance}}, {{m|Agility}} and {{m|Baton Pass}}.' → the moves."""
    m = re.search(r"known moves? (?:are|is)(.+?)(?:\.\s|\.$|\n|$)", desc or "", re.S) or \
        re.search(r"(.+?) (?:is|are) its only known moves?", desc or "")
    return re.findall(r"\{\{m\|([^}|]+)", m.group(1)) if m else []


def plain(text):
    """Wikitext as readable prose, for the model: refs, files and tables out; links and move/Pokémon templates
    as their words."""
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    s = re.sub(r"\[\[File:[^\]]*(\[\[[^\]]*\]\][^\]]*)*\]\]", "", s)
    s = re.sub(r"\{\|.*?\|\}", "", s, flags=re.S)
    s = re.sub(r"\{\{(?:m|p|t|an|ab|i|type|pkmn|pkmn2)\|([^}|]+)(?:\|([^}]+))?\}\}",
               lambda m: m.group(2) or m.group(1), s)
    s = re.sub(r"\{\{AP\|([^}|]+)\}\}", r"Ash's \1", s)
    s = re.sub(r"\{\{(?:TP|tp)\|([^}|]+)\|([^}|]+)(?:\|([^}]+))?\}\}", lambda m: m.group(3) or f"{m.group(1)}'s {m.group(2)}", s)
    s = re.sub(r"\{\{tt\|([^}|]+)\|[^}]*\}\}", r"\1", s)
    s = re.sub(r"\{\{Ash\}\}", "Ash", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", s)
    s = s.replace("'''", "").replace("''", "")
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def about(text, name):
    """The sentences of a stretch of prose that name a Pokémon (for one that shares its trainer's page)."""
    return " ".join(x for x in re.split(r"(?<=[.!?])\s+", text) if name in x)


def episode_key(code, order):
    m = re.fullmatch(r"([A-Z]{2,3})(\d{2,3})", (code or "").strip())
    if not m or m.group(1) not in order:
        return None
    return order.index(m.group(1)), int(m.group(2))


def mentions(text, moves):
    """How often each move is named in a stretch of history (longest names first, so 'Thunder Punch' isn't also
    counted as 'Thunder')."""
    s, out = text, Counter()
    for mv in sorted(set(moves), key=len, reverse=True):
        pat = re.compile(r"(?<![\w-])" + re.escape(mv) + r"(?![\w-])")
        out[mv] = len(pat.findall(s))
        s = pat.sub("§", s)
    return out


# --- one trainer version -------------------------------------------------------------------------------
class Researcher:
    def __init__(self, cfg, store, wiki=None, gemini=None):
        self.cfg, self.c, self.store = cfg, cfg["bulbapedia"], store
        self.wiki = wiki or Wiki(cfg)
        self.gemini = gemini
        self.order = self.c["series_order"]
        self.usage = []

    def era(self, tid, vid):
        return self.c["eras"].get(f"{tid}/{vid}")

    def in_era(self, code, era):
        """Known by the era's end: first used at or before its last episode (a move learned in an earlier series is
        still one it knows)."""
        k = episode_key(code, self.order)
        if k is None or not era:
            return False
        return k <= episode_key(era["to"], self.order)

    def history(self, text, era):
        """The era's stretch of the page's History (or the whole History for an all-time version)."""
        h = section(text, ["History"])
        if not h:
            return ""
        if not era.get("aniseries"):
            return text[h[0]:h[1]]
        names = self.c["aniseries"].get(era["aniseries"], [era["aniseries"]])
        span = section(text, names, *h)
        if span and era.get("part"):
            span = section(text, [era["part"]], *span) or span
        return text[span[0]:span[1]] if span else ""

    def pokemon(self, tid, species):
        """Where a trainer's Pokémon is written up: ('page', title, text) or ('entry', trainer page, TrainerPoké)."""
        name = self.c["trainers"][tid]
        title = self.c["page_overrides"].get(f"{tid}/{species}", f"{name}'s {species}")
        final, anchor, text = self.wiki.page(title)
        if anchor:
            entry = trainer_poke(text, anchor) or trainer_poke(text, species)
            return ("entry", final, entry) if entry else ("missing", final, None)
        return "page", final, text

    def ask_model(self, prompt):
        """Gemini's answer to one question about a page, cached by the question (the same page and question
        never costs twice)."""
        if not self.gemini:
            return None
        import hashlib
        path = os.path.join(self.wiki.dir if hasattr(self.wiki, "dir") else ENGINE, "model",
                            hashlib.sha1(prompt.encode("utf-8")).hexdigest()[:16] + ".json")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        try:
            result, usage, _ = self.gemini.generate([{"text": prompt}])
        except Exception as e:                          # the exact read still stands without the model
            return {"error": str(e)[:200]}
        self.usage.append(usage)
        if isinstance(result, dict):
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(result, fh, ensure_ascii=False)
        return result

    # moveset ------------------------------------------------------------------------------------------
    def moveset(self, tid, vid, bid):
        build = self.store.library[bid]
        version = self.store.version(tid, vid)
        era = self.era(tid, vid)
        species = build.species
        kind, title, body = self.pokemon(tid, species)
        out = {"bid": bid, "species": species, "page": self.wiki.url(title), "current": list(build.moves)}
        if kind == "missing":
            out["unresolved"] = f"no write-up for {species} on {title}"
            return out
        if kind == "entry":
            moves = known_moves(body.get("desc"))
            _, _, page_text = self.wiki.page(title)
            hist = about(plain(self.history(page_text, era) if era else ""), species) + " " + plain(body.get("desc", ""))
            count = mentions(hist, moves)
            out.update(source="trainer page entry", first_seen=body.get("epnum"), abilities=abilities_of(body.get("desc")),
                       era_moves=[{"move": m, "mentions": count.get(m, 0)} for m in moves])
            ranked = sorted(moves, key=lambda m: -count.get(m, 0))
        else:
            rows = [r for r in anmov(body) if era is None or era.get("aniseries") is None or self.in_era(r["episode"], era)]
            hist = self.history(body, era) if era else ""
            text_ = plain(hist)
            cut = int(len(text_) * (1 - self.c["late_share"]))
            count, late = mentions(text_, [r["move"] for r in rows]), mentions(text_[cut:], [r["move"] for r in rows])
            for r in rows:
                r["mentions"], r["late_mentions"] = count.get(r["move"], 0), late.get(r["move"], 0)
            out.update(source="moves-used table", era_moves=rows, abilities=abilities_of(body))
            # the moves named closest to the era's end are the ones it knew at the moment; then the most named
            ranked = [r["move"] for r in sorted(rows, key=lambda r: (-r["late_mentions"], -r["mentions"],
                                                                     [-x for x in episode_key(r["episode"], self.order) or (0, 0)]))]
        era_names = [m["move"] for m in out["era_moves"]]
        out["supported"] = [m for m in build.moves if m in era_names]
        out["unsupported"] = [m for m in build.moves if m not in era_names]
        # keep every move the page supports; fill a dropped slot with the best-ranked era move not already there
        fill = [m for m in ranked if m not in out["supported"]]
        if out["unsupported"] and fill and self.gemini and kind == "page" and era:
            ans = self.ask_model(self.c["prompts"]["moveset"].format(
                who=f"{self.c['trainers'][tid]}'s {species}", moment=era["moment"],
                moves=", ".join(f"{m['move']} (first used {m.get('episode')})" for m in out["era_moves"]),
                text=plain(self.history(body, era))[:self.c["model_text_chars"]]))
            if ans and ans.get("moves"):
                out["model"] = ans
                said = [re.sub(r"\s*\(.*\)\s*$", "", str(m)).strip() for m in ans["moves"]]   # "Dig (first used DP006)" → "Dig"
                fill = [m for m in said if m in fill] + [m for m in fill if m not in said]
        out["proposed"] = (out["supported"] + fill)[:max(len(build.moves), 1)] if out["unsupported"] else list(build.moves)
        if kind == "entry":
            out["proposed"] = (out["supported"] + [m for m in ranked if m not in out["supported"]])[:4]
        legal = self.store.era.learnable(species, version.game) if hasattr(self.store.era, "learnable") else None
        if legal is not None:
            out["not_in_game"] = [m for m in out["proposed"] if m not in legal]
        return out

    # signature ----------------------------------------------------------------------------------------
    def signature(self, tid, vid, j):
        version = self.store.version(tid, vid)
        sig = version.signature_moves[j]
        era = self.era(tid, vid)
        kind, title, body = self.pokemon(tid, sig["pokemon"])
        out = {"index": j, "pokemon": sig["pokemon"], "move": sig["move"], "page": self.wiki.url(title)}
        if kind == "missing":
            out.update(rank=None, counts={}, top=None, source="no write-up")
            return out
        if kind == "entry":
            moves = known_moves(body.get("desc"))
            _, _, page_text = self.wiki.page(title)
            hist = about(plain(self.history(page_text, era) if era else ""), sig["pokemon"]) + " " + plain(body.get("desc", ""))
            count = mentions(hist, moves + [sig["move"]])
            ranked = [m for m, n in count.most_common() if n]
            out.update(counts=dict(count.most_common(6)), rank=(ranked.index(sig["move"]) + 1) if sig["move"] in ranked else None,
                       top=ranked[0] if ranked else None, first_used=body.get("epnum"), known=moves,
                       source="trainer page (sentences naming it)")
            return out
        rows = [r for r in anmov(body) if era is None or era.get("aniseries") is None or self.in_era(r["episode"], era)]
        hist = plain(self.history(body, era) if era else "")
        count = mentions(hist, [r["move"] for r in rows] + [sig["move"]])
        ranked = [m for m, n in count.most_common() if n]
        first = next((r["episode"] for r in anmov(body) if r["move"] == sig["move"]), None)
        out.update(counts=dict(count.most_common(6)), rank=(ranked.index(sig["move"]) + 1) if sig["move"] in ranked else None,
                   top=ranked[0] if ranked else None, first_used=first, known=[r["move"] for r in rows],
                   source="history mentions")
        return out

    # ace ----------------------------------------------------------------------------------------------
    def ace(self, tid, vid):
        version = self.store.version(tid, vid)
        team = self.store.team(version)
        authored = (version.overrides or {}).get("ace")
        out = {"authored": authored}
        if team and all(b.source.startswith("cartridge") for b in team):
            top = max(b.level or 0 for b in team)
            at_top = [(i, b) for i, b in enumerate(team) if b.level == top]
            if len(at_top) == 1:
                i, b = at_top[0]
                out.update(answer=b.species, source="cartridge",
                           why=f"the game marks it: the only Lv {top} on the team, sent out "
                               f"{'last' if i == len(team) - 1 else 'first' if i == 0 else f'#{i + 1}'} "
                               f"({' → '.join(f'{x.species} {x.level}' for x in team)})")
            return out
        name = self.c["trainers"].get(tid)
        page = self.c["trainer_pages"].get(tid)
        era = self.era(tid, vid)
        if not page:
            return {**out, "unresolved": f"no trainer page configured for {tid}"}
        final, _, text = self.wiki.page(page)
        hist = plain(self.history(text, era) if era else "")
        species = [b.species for b in team]
        names = {}
        for sp in species:
            ref = self.store.era.ref
            for sid in ref.line(ref.species_id(sp)):
                names[ref.name(sid)] = sp
        raw_count = mentions(hist, list(names))
        count = Counter()
        for n, k in raw_count.items():
            count[names[n]] += k
        out.update(page=self.wiki.url(final), counts=dict(count.most_common(6)), source="history mentions",
                   answer=count.most_common(1)[0][0] if count and count.most_common(1)[0][1] else None)
        span = section(text, ["Pokémon"])
        if self.gemini and span:
            ans = self.ask_model(self.c["prompts"]["ace"].format(
                who=name, version=version.title, team=", ".join(species),
                text=(plain(text[span[0]:span[1]]) + "\n\n" + hist)[:self.c["model_text_chars"]]))
            if ans and ans.get("ace"):
                out["model"] = ans
        return out

    # battle order -------------------------------------------------------------------------------------
    ORDINALS = {"first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "last": 99, "final": 99}

    def battle_order(self, tid, vid):
        """The order the version's Pokémon came out in its defining battle, from the sentences that say so:
        [{species, position, sentence, page}] (position 99 = last)."""
        b = self.c["battles"].get(f"{tid}/{vid}")
        if not b:
            return None, []
        era = self.era(tid, vid)
        pat = re.compile(r"\b(" + "|".join(self.ORDINALS) + r")\b Pokémon")
        out = []
        for build in self.store.team(self.store.version(tid, vid)):
            try:
                kind, title, body = self.pokemon(tid, build.species)
            except Missing:
                continue
            if kind == "missing":
                continue
            text = plain(body.get("desc", "")) if kind == "entry" else plain(self.history(body, era) if era else "")
            for sent in re.split(r"(?<=[.!?])\s+", text):
                m = pat.search(sent)
                if m and b["against"] in sent and any(w in sent for w in b["words"]):
                    out.append({"species": build.species, "position": self.ORDINALS[m.group(1)], "sentence": sent.strip(),
                                "page": self.wiki.url(title)})
                    break
        last = [o for o in out if o["position"] == 99]
        if last:
            last[0]["position"] = max([o["position"] for o in out if o["position"] < 99] + [len(out)]) + 1
            last[0]["last"] = True
        return b["label"], sorted(out, key=lambda o: o["position"])

    # career -------------------------------------------------------------------------------------------
    def career(self, tid, i):
        rec = self.store.trainers[tid].career[i]
        page = self.c["trainer_pages"].get(tid)
        out = {"index": i, "event": rec["event"], "current": rec["result"]}
        if not page:
            return {**out, "unresolved": f"no trainer page configured for {tid}"}
        final, _, text = self.wiki.page(page)
        out["page"] = self.wiki.url(final)
        line = re.search(r"^\*\s*\[\[" + re.escape(rec["event"]) + r"\]\]\s*-\s*(.+)$", text, re.M)
        if line:
            m = re.match(r"(.+?)\s*\(''\[\[([A-Z]{2,3}\d{2,3})\|([^\]]+)\]\]''\)", line.group(1))
            if m:
                out.update(result=m.group(1).strip(), episode=m.group(2), title=m.group(3), source="Achievements")
            else:
                out.update(result=plain(line.group(1)).strip(), source="Achievements")
            return out
        spots = [plain(s) for s in re.findall(r"[^\n]*" + re.escape(rec["event"]) + r"[^\n]*", text)][:6]
        out["mentions"] = spots
        if self.gemini and spots:
            ans = self.ask_model(self.c["prompts"]["career"].format(
                who=self.c["trainers"][tid], event=rec["event"], current=rec["result"], text="\n".join(spots)))
            if ans and ans.get("result"):
                out.update(model=ans, result=ans["result"], source="model read of the page")
                return out
        out["unresolved"] = f"no Achievements line for the {rec['event']}"
        return out


# --- the batch -----------------------------------------------------------------------------------------
def jobs(store, rows):
    """ASK rows grouped by trainer version: {(trainer, version): [row]}."""
    out = {}
    for r in rows:
        target = r["Target"].split(":", 1)[1]
        parts = target.split(".")
        if parts[0] == "builds":
            bid = target[len("builds."):-len(".moves")]
            tid, vid = bid.split("/")[0].split("-", 1)
        else:
            tid = parts[1]
            vid = parts[3] if parts[2] == "versions" else None
        out.setdefault((tid, vid), []).append({**r, "_target": target})
    return out


def research(inbox, store, rows, gemini=None, wiki=None, only=None):
    """Answer the ASK rows from Bulbapedia: one card per trainer version, every answer a correction for review."""
    cfg = inbox.cfg
    rr = Researcher(cfg, store, wiki, gemini)
    made = []
    work = jobs(store, rows)
    for key in cfg["bulbapedia"]["battles"]:            # a rival's send-out order is read even with nothing to ask
        tid, vid = key.split("/")
        work.setdefault((tid, vid), [])
    for (tid, vid), asks in sorted(work.items(), key=lambda x: (x[0][0], x[0][1] or "")):
        if only and tid not in only:
            continue
        if tid not in cfg["bulbapedia"]["trainers"] and not any(a["Topic"] == "ace" for a in asks):
            continue
        claims, notes, pages = [], [], set()
        for a in asks:
            try:
                c = _answer(inbox, rr, store, tid, vid, a)
            except Missing as e:
                notes.append(f"{a['AskID']}: Bulbapedia has no page {e}")
                continue
            if isinstance(c, str):
                notes.append(f"{a['AskID']}: {c}")
                continue
            for x in c:
                pages.update(p for p in (x.get("source_ref") or "").split(" | ") if p.startswith("http"))
            claims += c
        if vid and tid in cfg["bulbapedia"]["trainers"]:
            label, order = rr.battle_order(tid, vid)
            for o in order:
                claims.append(inbox.claim("observation", {
                    "trainer": tid, "version": vid, "battle": label, "turn": None, "situation": "sent out",
                    "pokemon": o["species"], "move": "sent out last" if o.get("last") else f"sent out #{o['position']}",
                    "position": o["position"], "outcome": o["sentence"], "sample_size": 1},
                    confidence="MEDIUM", source_ref=o["page"], note=f"order in {label}"))
                pages.add(o["page"])
        if not claims and not notes:
            continue
        who = store.trainers[tid].name
        title = store.version(tid, vid).title if vid else who
        src = {"title": f"Bulbapedia research: {title}", "url": next(iter(sorted(pages)), None), "pages": sorted(pages),
               "asks": [a["AskID"] for a in asks], "unresolved": notes, "license": cfg["bulbapedia"]["license"]}
        n_obs = len([c for c in claims if c["kind"] == "observation"])
        summary = (f"{len(claims) - n_obs} answer(s) for {len(asks)} open question(s) on {title}, from Bulbapedia"
                   + (f"; {len(notes)} not settled" if notes else "")
                   + (f"; the send-out order of {n_obs} Pokémon in its defining battle" if n_obs else "") + ".")
        key = f"bulbapedia-{tid}-{vid or 'career'}"
        n = 1
        while inbox.exists(f"research-{key}" + (f"-r{n}" if n > 1 else "")):
            old = inbox.load(f"research-{key}" + (f"-r{n}" if n > 1 else ""))
            if all(c["status"] == "proposed" for c in old["claims"]):
                break                                   # nothing reviewed yet: this run replaces it
            n += 1                                      # reviewed: keep it as it is, follow up in a new card
        if n > 1:
            key += f"-r{n}"
            src["follows"] = f"research-bulbapedia-{tid}-{vid or 'career'}"
        card, new = inbox.new("research", key, src, "ingested", summary, claims, again=True)
        made.append((card, new))
    return made, rr.usage


def _answer(inbox, rr, store, tid, vid, a):
    t, target = a["Topic"], a["_target"]
    ref = lambda *p: " | ".join(x for x in p if x)
    if t == "moveset":
        bid = target[len("builds."):-len(".moves")]
        r = rr.moveset(tid, vid, bid)
        if r.get("unresolved"):
            return r["unresolved"]
        era_list = ", ".join(f"{m['move']}" + (f" ({m['episode']}" + (", recent" if m.get("recent") else "") +
                                               (f", named {m['mentions']}×" if m.get("mentions") else "") + ")"
                                               if m.get("episode") else "") for m in r["era_moves"])
        same = sorted(r["proposed"]) == sorted(r["current"])
        why = (f"Bulbapedia ({r['source']}): moves in this era: {era_list}."
               + (f" The model's read of the history at the moment: {r['model'].get('notes') or ''}".rstrip() if r.get("model") else "")
               + (f" Not in the game's learnset for {r['species']}: {', '.join(r['not_in_game'])} (anime only, or another route)."
                  if r.get("not_in_game") else ""))
        claims = [inbox.claim("correction", {"target": f"canon/build_library.json:builds.{bid}.status" if same else
                                             f"canon/build_library.json:{target}",
                                             "value": "approved" if same else r["proposed"],
                                             "was": "proposed" if same else r["current"], "why":
                                             ("Bulbapedia confirms the moveset. " if same else "") + why},
                              confidence="MEDIUM", source_ref=ref(r["page"]),
                              note=(f"{a['AskID']}: proposed {', '.join(r['proposed'])}"
                                    + ("" if same else f" (was {', '.join(r['current'])})")
                                    + (f"; Bulbapedia knows only {len(r['proposed'])}, the other slots stay open"
                                       if len(r["proposed"]) < 4 else "")))]
        have = store.library[bid].ability
        build = store.library[bid]
        legal = store.era.abilities(build.species, build.generation or 4)
        named = [x for x in r.get("abilities") or [] if x in legal]
        r["ability"] = named[-1] if named else None      # the last listed is the latest stage's
        if r.get("ability") and r["ability"] != have:
            claims.append(inbox.claim("correction", {"target": f"canon/build_library.json:builds.{bid}.ability",
                                                     "value": r["ability"], "was": have,
                                                     "why": f"Bulbapedia records its Ability as {r['ability']}."},
                                      confidence="MEDIUM", source_ref=r["page"], note=f"{a['AskID']}: ability"))
        return claims
    if t == "signature":
        j = int(target.split(".")[-1])
        r = rr.signature(tid, vid, j)
        base = f"canon/trainers.json:{target}"
        tally = ", ".join(f"{m} {n}" for m, n in r["counts"].items())
        if r["rank"] and r["rank"] <= rr.c["signature"]["confirm_rank_at_most"]:
            why = (f"Bulbapedia: {r['move']} is named {r['counts'].get(r['move'], 0)}× in {r['pokemon']}'s history for this "
                   f"era, #{r['rank']} of its moves ({tally})" + (f"; first used {r['first_used']}" if r.get("first_used") else "") + ".")
            return [inbox.claim("correction", {"target": base + ".status", "value": "confirmed", "was": "proposed",
                                               "why": why}, confidence="MEDIUM", source_ref=r["page"],
                                note=f"{a['AskID']}: confirmed")]
        if r.get("known") is not None and r["move"] not in r["known"]:
            why = (f"Bulbapedia doesn't list {r['move']} among {r['pokemon']}'s moves in this era "
                   f"({', '.join(r['known']) or 'none listed'}).")
            return [inbox.claim("correction", {"target": base + ".status", "value": "not on Bulbapedia's list",
                                               "was": "proposed", "why": why}, confidence="MEDIUM", source_ref=r["page"],
                                note=f"{a['AskID']}: unsupported" + (f"; the most named is {r['top']}" if r.get("top") else ""))]
        return (f"{r['pokemon']}'s {r['move']} is on its list but the history doesn't single it out "
                f"(named {r['counts'].get(r['move'], 0)}×; {tally})")
    if t == "ace":
        r = rr.ace(tid, vid)
        if r.get("unresolved"):
            return r["unresolved"]
        ans = r.get("answer")
        model = r.get("model") or {}
        if model.get("ace") and r["source"] != "cartridge":
            ans = model["ace"]
        if not ans:
            return "no ace in the record"
        why = r["why"] if r["source"] == "cartridge" else (
            f"Bulbapedia: the era's history names {', '.join(f'{m} {n}×' for m, n in r['counts'].items())}"
            + (f"; the page reads: \"{model.get('quote')}\"" if model.get("quote") else "") + ".")
        return [inbox.claim("correction", {"target": f"canon/trainers.json:{target}", "value": ans, "was": r["authored"],
                                           "why": why}, confidence="HIGH" if r["source"] == "cartridge" else "LOW",
                            source_ref=r.get("page") or "pret data (the cartridge's own party)",
                            note=f"{a['AskID']}: {'confirms' if ans == r['authored'] else 'differs from'} the authored ace "
                                 f"({r['authored']})")]
    if t == "career":
        i = int(target.split(".")[-1])
        r = rr.career(tid, i)
        if r.get("unresolved"):
            return r["unresolved"]
        result = r["result"] + (f" ({r['episode']}, {r['title']})" if r.get("episode") else "")
        base = f"canon/trainers.json:{target}"
        why = f"Bulbapedia {r['source']}: \"{r['event']} - {result}\"."
        return [inbox.claim("correction", {"target": base + ".result", "value": result, "was": r["current"], "why": why},
                            confidence="MEDIUM", source_ref=r["page"], note=f"{a['AskID']}: {r['event']}"),
                inbox.claim("correction", {"target": base + ".status", "value": "approved", "was": "draft: confirm",
                                           "why": why}, confidence="MEDIUM", source_ref=r["page"])]
    return f"no reader for {t}"
