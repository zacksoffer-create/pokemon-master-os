"""The intake inbox (docs/INGEST.md): every source becomes a card of proposed claims, and nothing reaches canon
until it's approved.

A **card** is one source (a video, a screenshot, a page, a Showdown paste, a research result, a note you write):
where it came from, when it was added, its provenance (authored, cartridge, lore, derived, ingested), a summary,
the raw analysis it came from, and its **claims**. A claim is one proposed fact of one kind (field note, battle
observation, build, lore, career record, style card, correction), with its evidence and an exact source reference
(a URL with a timestamp, an episode, a file).

The flow is propose → approve → apply:
- `approve` checks the claim has what its kind requires (a build needs its generation; nothing external without a
  source) and marks it approved; `reject` marks it rejected with a reason; `edit` fills a missing field;
- `apply` writes approved claims into canon (field notes, observations, lore and style cards append to JSONL files;
  builds join the build library; career records join a trainer; a trainer version adds a version and its roster,
  never replacing one; a correction changes one allowed value, and a corrected build keeps its old values as an
  earlier version) and records where each landed.

Cards live one per file in canon/inbox/cards/, the raw analysis beside them in canon/inbox/raw/, so the review is
plain data you can read in any editor and diff in git. Kinds, required fields and destinations are in
ingest/config.json.
"""
import datetime
import fnmatch
import hashlib
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)


def load_config(path=None):
    with open(path or os.path.join(HERE, "config.json"), encoding="utf-8") as fh:
        return json.load(fh)


def slug(text, n=60):
    s = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return s[:n] or hashlib.sha1(str(text).encode()).hexdigest()[:10]


def digest(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha1(data).hexdigest()[:10]


def today():
    return datetime.date.today().isoformat()


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, path)


def _read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


class Inbox:
    def __init__(self, base=ENGINE, config=None):
        self.base = base
        self.cfg = config or load_config()
        self.cards_dir = os.path.join(base, self.cfg["store"]["cards"])
        self.raw_dir = os.path.join(base, self.cfg["store"]["raw"])
        self.kinds = {k: v for k, v in self.cfg["claims"].items() if not k.startswith("_")}

    # --- cards ----------------------------------------------------------------------------------------
    def path(self, cid):
        return os.path.join(self.cards_dir, f"{cid}.json")

    def exists(self, cid):
        return os.path.exists(self.path(cid))

    def load(self, cid):
        if not self.exists(cid):
            raise KeyError(f"no card {cid}")
        return _read_json(self.path(cid))

    def save(self, card):
        _write_json(self.path(card["id"]), card)
        return card

    def all(self, status=None):
        if not os.path.isdir(self.cards_dir):
            return []
        cards = [_read_json(os.path.join(self.cards_dir, f)) for f in sorted(os.listdir(self.cards_dir))
                 if f.endswith(".json")]
        if status:
            cards = [c for c in cards if any(cl["status"] == status for cl in c["claims"]) or c["status"] == status]
        return cards

    def save_raw(self, cid, raw):
        path = os.path.join(self.raw_dir, f"{cid}.json")
        _write_json(path, raw)
        return os.path.relpath(path, self.base)

    def claim(self, kind, data, evidence=None, confidence=None, source_ref=None, note=None):
        if kind not in self.kinds:
            raise ValueError(f"unknown claim kind {kind}; kinds are in ingest/config.json")
        c = {"kind": kind, "data": data, "status": "proposed"}
        if evidence:
            c["evidence"] = evidence
        if confidence:
            c["confidence"] = confidence
        if source_ref:
            c["source_ref"] = source_ref
        if note:
            c["note"] = note
        return c

    def new(self, kind, key, source, provenance, summary, claims, raw=None, again=False):
        """A new card. The id comes from the source (the same video or page twice is the same card); `again`
        replaces a card that exists, keeping any claim already reviewed."""
        cid = f"{kind}-{slug(key)}"
        old = self.load(cid) if self.exists(cid) else None
        if old and not again:
            return old, False
        for i, c in enumerate(claims, 1):
            c["id"] = f"c{i}"
        card = {"id": cid, "kind": kind, "added_on": today(), "provenance": provenance, "source": source,
                "summary": summary, "claims": claims, "status": "open"}
        if raw is not None:
            card["raw"] = self.save_raw(cid, raw)
        if old:
            reviewed = {(c["kind"], json.dumps(c["data"], sort_keys=True)): c for c in old["claims"]
                        if c["status"] != "proposed"}
            for c in card["claims"]:
                prev = reviewed.get((c["kind"], json.dumps(c["data"], sort_keys=True)))
                if prev:
                    c.update({k: prev[k] for k in ("status", "why", "applied_to", "reviewed_on") if k in prev})
        if provenance in self.cfg["review"]["auto_approve_provenance"]:
            for c in card["claims"]:
                if c["status"] == "proposed" and not self.missing(c):
                    c.update(status="approved", reviewed_on=today(), why=f"auto-approved ({provenance})")
        self._settle(card)
        return self.save(card), True

    def _settle(self, card):
        card["status"] = "open" if any(c["status"] in ("proposed", "approved") for c in card["claims"]) else "closed"

    # --- review ---------------------------------------------------------------------------------------
    def missing(self, claim):
        need = self.kinds[claim["kind"]]["requires"]
        return [f for f in need if claim["data"].get(f) in (None, "", [], {})]

    def _targets(self, card, claim_id):
        if claim_id is None:
            return card["claims"]
        hit = [c for c in card["claims"] if c["id"] == claim_id]
        if not hit:
            raise KeyError(f"{card['id']} has no claim {claim_id}")
        return hit

    def approve(self, cid, claim_id=None):
        """Approve one claim (or every proposed claim on the card). A claim missing a required field stays
        proposed and says what it needs."""
        card = self.load(cid)
        out = []
        for c in self._targets(card, claim_id):
            if c["status"] != "proposed":
                continue
            need = self.missing(c)
            if need:
                out.append(f"{cid}:{c['id']} ({c['kind']}) needs {', '.join(need)} first (intake.py edit)")
                continue
            c.update(status="approved", reviewed_on=today())
            out.append(f"{cid}:{c['id']} approved")
        self._settle(card)
        self.save(card)
        return out

    def reject(self, cid, claim_id=None, why=""):
        card = self.load(cid)
        out = []
        for c in self._targets(card, claim_id):
            if c["status"] in ("proposed", "approved"):
                c.update(status="rejected", reviewed_on=today(), why=why or "rejected")
                out.append(f"{cid}:{c['id']} rejected")
        self._settle(card)
        self.save(card)
        return out

    def edit(self, cid, claim_id, field, value):
        """Fill or change one field of a claim before approval (the generation of a build, a species name)."""
        card = self.load(cid)
        c = self._targets(card, claim_id)[0]
        if c["status"] not in ("proposed", "approved"):
            raise ValueError(f"{cid}:{claim_id} is {c['status']}; only open claims can change")
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            pass
        c["data"][field] = value
        if c["status"] == "approved":
            c["status"] = "proposed"                    # an edit sends it back for another look
        self.save(card)
        return f"{cid}:{claim_id} {field} = {json.dumps(value, ensure_ascii=False)}"

    # --- apply ----------------------------------------------------------------------------------------
    def apply(self, cid=None):
        """Write every approved claim (on one card, or all) into canon. Returns what landed where."""
        out = []
        for card in ([self.load(cid)] if cid else self.all()):
            changed = False
            for c in card["claims"]:
                if c["status"] != "approved":
                    continue
                where = getattr(self, f"_apply_{c['kind']}")(card, c)
                c.update(status="applied", applied_to=where, applied_on=today())
                out.append(f"{card['id']}:{c['id']} {c['kind']} → {where}")
                changed = True
            if changed:
                self._settle(card)
                self.save(card)
        return out

    def _stamp(self, card, c):
        return {"source": card["source"].get("url") or card["source"].get("file") or card["source"].get("title"),
                "source_ref": c.get("source_ref"), "provenance": card["provenance"], "card": card["id"],
                "claim": c["id"], "approved_on": c.get("reviewed_on")}

    def _append(self, rel, record):
        path = os.path.join(self.base, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                for line in fh:
                    if line.strip():
                        r = json.loads(line)
                        if r.get("card") == record["card"] and r.get("claim") == record["claim"]:
                            return rel                  # already there
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        return rel

    def _apply_jsonl(self, card, c):
        rel = self.kinds[c["kind"]]["lands_in"]
        return self._append(rel, {**c["data"], **self._stamp(card, c), "kind": c["kind"]})

    _apply_field_note = _apply_observation = _apply_lore = _apply_style_card = _apply_jsonl

    def _apply_build(self, card, c):
        rel = self.kinds["build"]["lands_in"]
        path = os.path.join(self.base, rel)
        lib = _read_json(path)
        d = dict(c["data"])
        bid = d.pop("id", None) or f"ingested/{slug(d['species'], 24)}-{digest(card['id'] + c['id'])}"
        ref = c.get("source_ref") or card["source"].get("url") or card["source"].get("title") or card["id"]
        entry = {k: v for k, v in d.items() if k in ("species", "moves", "nickname", "gender", "nature", "ivs",
                                                     "evs", "item", "ability", "ball", "friendship", "level",
                                                     "name", "role", "generation", "tier", "notes")
                 and v not in (None, "", [], {})}
        entry["source"] = "mine" if card["provenance"] == "authored" else f"external: {ref}"
        entry["status"] = "approved"
        entry.setdefault("tier", "unrated")
        entry.setdefault("notes", []).append(f"ingested from {card['id']} ({c['id']})")
        lib["builds"][bid] = entry
        _write_json(path, lib)
        return f"{rel} ({bid})"

    def _apply_career(self, card, c):
        rel = self.kinds["career"]["lands_in"]
        path = os.path.join(self.base, rel)
        data = _read_json(path)
        d = dict(c["data"])
        tid = d.pop("trainer")
        if tid not in data["trainers"]:
            raise KeyError(f"no trainer {tid} in {rel}")
        rec = {k: d[k] for k in ("region", "event", "kind", "result", "title", "champion", "elite_four", "versions")
               if d.get(k) not in (None, "", [])}
        rec.setdefault("kind", "league")
        rec["source"] = c.get("source_ref") or card["source"].get("url") or card["id"]
        rec["status"] = "approved"
        data["trainers"][tid].setdefault("career", []).append(rec)
        _write_json(path, data)
        return f"{rel} (trainers.{tid}.career)"

    def _apply_trainer_version(self, card, c):
        """A new version of a trainer and its roster (Trainer Library, MASTER_PLAN Phase 5). The version id must be new:
        a revision names the version it revises as `parent`, and the original stays as it was. A trainer not in canon
        yet is added when the claim gives its `name` (a manga trainer, say). Each team member becomes a build in the
        library (<trainer>-<version>/<species>)."""
        rel_t, rel_b = "canon/trainers.json", self.kinds["build"]["lands_in"]
        tpath, bpath = os.path.join(self.base, rel_t), os.path.join(self.base, rel_b)
        data, lib = _read_json(tpath), _read_json(bpath)
        d = dict(c["data"])
        tid, vid = d["trainer"], slug(d["version"], 40)
        if tid not in data["trainers"]:
            if not d.get("name"):
                raise KeyError(f"no trainer {tid} in {rel_t}; give the claim a name to add one")
            data["trainers"][tid] = {"name": d["name"], "notes": [], "versions": {}, "career": []}
        t = data["trainers"][tid]
        if vid in t["versions"]:
            raise ValueError(f"{tid} already has a version {vid}: a version is never overwritten; propose a new id with "
                             f"parent: {vid}")
        if d.get("parent") and d["parent"] not in t["versions"]:
            raise KeyError(f"{tid} has no version {d['parent']} to revise")
        ref = c.get("source_ref") or card["source"].get("url") or card["source"].get("title") or card["id"]
        source = f"anime: {ref}" if d["kind"] == "anime" else f"trainer ({d['kind']}): {ref}"   # a trainer's build (store: canonical)
        ids = []
        for m in d["team"]:
            base = f"{tid}-{vid}/{slug(m['species'], 24)}"
            bid, n = base, 2
            while bid in lib["builds"]:
                bid, n = f"{base}-{n}", n + 1
            entry = {k: m[k] for k in ("species", "moves", "nature", "ivs", "evs", "item", "ability", "level", "friendship",
                                       "ball", "gender", "nickname", "role", "notes") if m.get(k) not in (None, "", [], {})}
            entry.setdefault("moves", [])
            entry.update(generation=d.get("generation") or {"crystal": 2, "firered": 3, "emerald": 3}.get(d["game"], 4),
                         source=source, status="approved", tier=entry.get("tier", "unrated"))
            entry.setdefault("notes", []).append(f"from {card['id']} ({c['id']}): {tid}/{vid}")
            lib["builds"][bid] = entry
            ids.append(bid)
        v = {"title": d["title"], "game": d["game"], "kind": d["kind"], "source": ref, "status": "approved",
             "team": {"builds": ids}, "sliders": d.get("sliders") or {}, "roles": d.get("roles") or [],
             "notes": list(d.get("notes") or []), "signature_moves": d.get("signature_moves") or []}
        if d.get("parent"):
            v["parent"] = d["parent"]
            v["notes"].append(f"a revision of {tid}/{d['parent']}, which stays as it was")
        t["versions"][vid] = v
        _write_json(bpath, lib)
        _write_json(tpath, data)
        return f"{rel_t} (trainers.{tid}.versions.{vid}) + {rel_b} ({len(ids)} builds)"

    def _apply_correction(self, card, c):
        d = c["data"]
        file_rel, _, dotted = d["target"].partition(":")
        allowed = any(a["file"] == file_rel and fnmatch.fnmatchcase(dotted, a["path"])
                      for a in self.cfg["corrections"]["allowed"])
        if not allowed:
            raise PermissionError(f"corrections can't change {d['target']} (ingest/config.json corrections.allowed)")
        path = os.path.join(self.base, file_rel)
        data = _read_json(path)
        node = data
        keys = dotted.split(".")
        for k in keys[:-1]:
            node = node[int(k)] if isinstance(node, list) else node[k]
        last = keys[-1]
        before = node[int(last)] if isinstance(node, list) else node.get(last)
        if file_rel == "canon/build_library.json" and len(keys) == 3 and keys[0] == "builds":
            # a corrected build becomes a new version: its old values stay under history, nothing is overwritten
            b = data["builds"][keys[1]]
            prior = {k: v for k, v in b.items() if k not in ("history", "v")}
            b.setdefault("history", []).append(dict(prior, v=b.get("v", 1), until=today(), changed_by=f"{card['id']}:{c['id']}"))
            b["v"] = b.get("v", 1) + 1
        if isinstance(node, list):
            node[int(last)] = d["value"]
        else:
            node[last] = d["value"]
        _write_json(path, data)
        c.setdefault("note", f"was {json.dumps(before, ensure_ascii=False)}")
        return f"{file_rel} ({dotted}: {json.dumps(before, ensure_ascii=False)} → {json.dumps(d['value'], ensure_ascii=False)})"


# --- reading -------------------------------------------------------------------------------------------
def render_list(cards):
    if not cards:
        return "The inbox is empty."
    lines = []
    for card in cards:
        counts = {}
        for c in card["claims"]:
            counts[c["status"]] = counts.get(c["status"], 0) + 1
        tally = ", ".join(f"{n} {s}" for s, n in sorted(counts.items())) or "no claims"
        lines.append(f"{card['id']}  [{card['kind']}, {card['provenance']}]  {tally}")
        if card.get("summary"):
            lines.append(f"    {card['summary'][:140]}")
    return "\n".join(lines)


def render_card(card, inbox):
    src = card["source"]
    lines = [f"{card['id']}  ({card['kind']}, {card['provenance']}, added {card['added_on']})",
             f"  source: {src.get('url') or src.get('file') or src.get('title')}"
             + (f" · {src['creator']}" if src.get("creator") else "") + (f" · note: {src['note']}" if src.get("note") else "")]
    if card.get("summary"):
        lines.append(f"  {card['summary']}")
    if card.get("raw"):
        lines.append(f"  raw analysis: {card['raw']}")
    for c in card["claims"]:
        need = inbox.missing(c) if c["status"] == "proposed" else []
        lines.append(f"  {c['id']} [{c['status']}] {c['kind']}: {json.dumps(c['data'], ensure_ascii=False)[:240]}"
                     + (f"  (needs {', '.join(need)})" if need else "")
                     + (f"  @ {c['source_ref']}" if c.get("source_ref") else "")
                     + (f"  → {c['applied_to']}" if c.get("applied_to") else "")
                     + (f"  ({c['why']})" if c.get("why") else ""))
        if c.get("note"):
            lines.append(f"      {c['note']}")
    return "\n".join(lines)
