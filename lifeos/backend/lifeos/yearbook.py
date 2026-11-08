"""The yearbook: one volume a school year (September through the summer after it), like the real thing.

Chapters:
- You: your year in numbers (where you ranked, your best week, your GPA, your teams and lines, your awards, the friends you
  made, your dates to the dances, the scenes you played), your superlatives;
- Superlatives: sixteen school-wide (one person can take two at most, like a real ballot), the pairs (Cutest Couple,
  Best Friends, Fiercest Rivals), and each class's own;
- Classes: everyone's portrait and what they're known for; the seniors' quotes and where they're headed (this year's
  graduates stay on the senior pages after June);
- Sports: each team's record, its tournament run, the Hand game, the scoreboard, the captains, the leaders, the awards,
  the roster;
- Clubs & activities: the council, the play, the clubs, where people worked;
- Student life: homecoming court, the dances and who went with who, the couples, the parties, the crowds, the talk;
- The year: month by month, the moments that mattered, and the storylines that played;
- Honors: high honors and honor roll, athletic honors, offers, where the seniors are going;
- Signatures: the people closest to you sign your book (friends, family, teammates, your rival, a teacher or two).
This year's volume is live; it's kept as it was the morning the next school year starts (w.meta["yearbook"]).
"""
from __future__ import annotations

import re
import zlib

from . import calendar as calm
from . import ladder, scene, sports

MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
CLASS = {12: "Seniors", 11: "Juniors", 10: "Sophomores", 9: "Freshmen"}
YEAR_TITLE = {9: "Freshman", 10: "Sophomore", 11: "Junior", 12: "Senior"}
YEAR_WORD = {9: "freshman", 10: "sophomore", 11: "junior", 12: "senior"}
SPORT_ORDER = ["football", "soccer", "soccer_girls", "basketball", "basketball_girls", "baseball", "softball"]
REP_WORDS = {"leader": "a natural leader", "star": "a star", "performer": "always on stage", "host": "throws the parties",
             "legend": "a legend", "kind": "the kindest in the building", "brain": "the brain", "athlete": "an athlete",
             "gossip": "knows everything first", "troublemaker": "trouble (the fun kind)", "mean": "sharp-tongued",
             "flaky": "always running late", "embarrassed": "survived a moment or two"}
SUPER_CAP = 2  # school-wide superlatives one person can take


def _h(*parts) -> int:
    return zlib.crc32(":".join(str(p) for p in parts).encode())


def bounds(year: int) -> tuple:
    """A school year's days: Sept 1 through Aug 31 (the summer after it is part of its book)."""
    return calm.md_to_day(year, (9, 1)), calm.md_to_day(year, (8, 31))


def title(year: int) -> str:
    return f"The Grizzly {calm.START.year + year + 1}"


def season_key(year: int) -> str:
    a = calm.START.year + year
    return f"{a}-{str(a + 1)[2:]}"


def _short_date(day: int) -> str:
    return calm.label(day).split(",")[1].strip()


class Book:
    """One school year's book: who's in it (this year's students, and the seniors who graduated in June) and their grade."""

    def __init__(self, sim, year: int):
        self.sim, self.w = sim, sim.w
        w = self.w
        self.me = me = w.chars.get(w.meta.get("protagonist") or "")
        self.year = year
        self.a, self.b = bounds(year)
        self.grade: dict = {}
        pool = {c.id: c for c in scene.students(sim, me)} if me.role == "student" else {}
        for c in w.chars.values():
            grad = next((x["day"] for x in c.achievements or [] if isinstance(x, dict) and x.get("label") == "Graduated"), None)
            if grad is not None and self.a <= grad <= self.b:
                pool[c.id] = c
                self.grade[c.id] = 12
        for cid, c in pool.items():
            self.grade.setdefault(cid, c.grade)
        self.pool = sorted(pool.values(), key=lambda c: c.id)
        self.ids = set(pool)
        self.thr = w.rules["rel.friend_threshold"]

    def mini(self, cid) -> dict:
        m = scene._mini(self.w, cid)
        g = self.grade.get(cid)
        if g in YEAR_TITLE:
            m["year"] = YEAR_TITLE[g]
        return m

    def rel(self, a, b, f="affection") -> float:
        r = self.w.rels.get((a, b))
        return getattr(r, f, 0.0) if r else 0.0

    def events(self, *types):
        for e in self.w.history.events.values():
            if self.a <= e["day"] <= self.b and (not types or e.get("type") in types):
                yield e


# ------------------------------------------------------------------------------------------------ superlatives
def _score_fns(bk: Book):
    w = bk.w
    rep = lambda c, *ks: sum((c.reputation or {}).get(k, 0) for k in ks)  # noqa: E731
    tr = lambda c, k: (c.traits or {}).get(k, 50)  # noqa: E731
    ap = lambda c, k: (c.aptitudes or {}).get(k, 50)  # noqa: E731
    admirers: dict = {}
    for (a, b), r in w.rels.items():
        if r.attraction >= 55 and a != b and a in bk.ids:
            admirers[b] = admirers.get(b, 0) + 1
    clubs = lambda c: [g for g in c.memberships if (w.groups.get(g) or {}).get("kind") in ("team", "club", "council", "production")]  # noqa: E731

    def athlete(c):
        best = max((c.skills.get(s, 0) for s in sports.SPORTS), default=0)
        varsity = any((w.groups.get(g) or {}).get("kind") == "team" and (w.groups[g].get("levels") or {}).get(c.id, "varsity") == "varsity"
                      for g in c.memberships)
        return best + (12 if varsity else 0) + rep(c, "athlete") * 0.3

    return [
        ("popular", "Most Popular", lambda c: c.popularity),
        ("athlete", "Best Athlete", athlete),
        ("brain", "Biggest Brain", lambda c: c.gpa * 25 + c.skills.get("academics", 0) * 0.3 + rep(c, "brain")),
        ("success", "Most Likely to Succeed", lambda c: tr(c, "ambition") * 0.5 + c.gpa * 12 + tr(c, "discipline") * 0.3),
        ("party", "Life of the Party", lambda c: rep(c, "host", "legend") * 3 + tr(c, "sociability") * 0.2),
        ("nice", "Nicest Person", lambda c: rep(c, "kind") * 3 + tr(c, "empathy") * 0.5),
        ("leader", "Natural Leader", lambda c: rep(c, "leader") * 3 + ap(c, "charisma") * 0.4 + tr(c, "confidence") * 0.2),
        ("famous", "Most Likely to Be Famous", lambda c: rep(c, "star", "performer") * 2.5 + ap(c, "charisma") * 0.4 + c.popularity * 0.2),
        ("creative", "Most Creative", lambda c: ap(c, "creativity") + 15 * sum(1 for g in c.memberships if g in ("art", "band", "drama", "paper"))
         + rep(c, "performer") * 2),
        ("flirt", "Biggest Flirt", lambda c: admirers.get(c.id, 0) * 10 + tr(c, "confidence") * 0.2 + tr(c, "impulsivity") * 0.1),
        ("competitive", "Most Competitive", lambda c: tr(c, "competitiveness") * 0.8 + rep(c, "athlete") * 0.5),
        ("loyal", "Most Loyal Friend", lambda c: tr(c, "loyalty") * 0.8 + rep(c, "kind")),
        ("spirit", "Most School Spirit", lambda c: 14 * len(clubs(c)) + rep(c, "leader") * 2 + tr(c, "sociability") * 0.1),
        ("clown", "Class Clown", lambda c: tr(c, "impulsivity") * 0.5 + tr(c, "sociability") * 0.3 + rep(c, "troublemaker", "embarrassed") * 1.5),
        ("drama", "Drama Magnet", lambda c: rep(c, "gossip", "troublemaker", "mean") * 3 + tr(c, "volatility") * 0.2),
        ("curious", "Always Asking Why", lambda c: tr(c, "curiosity") * 0.8 + ap(c, "academic") * 0.2),
    ]


def superlatives(bk: Book, pool, keys=None, cap=SUPER_CAP) -> list:
    """Each category's winner and the two behind them; nobody takes more than `cap` (the next one in line does)."""
    me = bk.me
    wins: dict = {}
    out = []
    for key, label, f in _score_fns(bk):
        if keys and key not in keys:
            continue
        order = sorted(pool, key=lambda c: (-f(c), c.id))
        if not order:
            continue
        pos = next((i + 1 for i, c in enumerate(order) if c.id == me.id), None)
        win = next((c for c in order if wins.get(c.id, 0) < cap), order[0])
        wins[win.id] = wins.get(win.id, 0) + 1
        rest = [c for c in order if c.id != win.id][:2]
        out.append({"key": key, "label": label, "winner": bk.mini(win.id), "runners": [bk.mini(c.id) for c in rest],
                    "you": pos, "yours": win.id == me.id, "capped": pos == 1 and win.id != me.id})
    return out


def pairs(bk: Book) -> list:
    """Cutest Couple, Best Friends, Fiercest Rivals: two people each."""
    w = bk.w
    me = bk.me
    best = {"couple": (None, -1), "friends": (None, -1), "rivals": (None, -1)}
    for (a, b), r in w.rels.items():
        if a not in bk.ids or b not in bk.ids or a >= b:
            continue
        r2 = w.rels.get((b, a))
        ca, cb = w.chars[a], w.chars[b]
        if r2 is None or (ca.household_id and ca.household_id == cb.household_id):
            continue
        if ca.flags.get("partner") == b:
            s = (ca.popularity + cb.popularity) / 2 + (r.affection + r2.affection) / 4
            if s > best["couple"][1]:
                best["couple"] = ((a, b), s)
        else:
            s = min(r.affection, r2.affection) + min(r.trust, r2.trust) * 0.3
            if s > best["friends"][1]:
                best["friends"] = ((a, b), s)
        s = min(r.rivalry, r2.rivalry)
        if s > best["rivals"][1] and s >= 20:
            best["rivals"] = ((a, b), s)
    labels = {"couple": "Cutest Couple", "friends": "Best Friends", "rivals": "Fiercest Rivals"}
    out = []
    for k in ("couple", "friends", "rivals"):
        p = best[k][0]
        if p:
            if me.id == p[1]:
                p = (p[1], p[0])
            out.append({"key": k, "label": labels[k], "winner": bk.mini(p[0]), "partner": bk.mini(p[1]), "runners": [],
                        "you": 1 if me.id in p else None, "yours": me.id in p, "pair": True})
    return out


# ------------------------------------------------------------------------------------------------ class pages
QUOTES = {
    "sociability": ["Never sat alone at lunch. Never will.", "Every hallway was a reunion.", "If you needed a ride, you had one."],
    "confidence": ["Walked in like I owned the place. Still don't, but I'm working on it.", "Bet on yourself. I did.", "No regrets, just stories."],
    "discipline": ["Showed up early, left late, did it again tomorrow.", "The work was the fun part.", "Set the alarm. Beat the alarm."],
    "ambition": ["This was the warm-up.", "Next stop: everything.", "Four years down. The rest of it to go."],
    "impulsivity": ["It seemed like a good idea at the time.", "Ask forgiveness, not permission.", "The best nights weren't planned."],
    "empathy": ["Be the person you needed freshman year.", "Thanks for every hallway hello.", "Kindness was always the cool thing."],
    "competitiveness": ["Second place is a long bus ride home.", "Keep score. Always keep score.", "Beat Hand."],
    "curiosity": ["Still asking why.", "Read everything. Try everything.", "Every class was a rabbit hole."],
    "volatility": ["Loud, honest, and here for all of it.", "Felt everything. Wouldn't change it.", "It was never boring."],
    "loyalty": ["Same people since day one.", "Ride or die, Grizzlies.", "If you know, you know."],
}


def _teams_of(bk: Book, c) -> list:
    """(team, level) for every team someone was on this school year (a graduate's too, from the season's roster)."""
    w = bk.w
    out = []
    for g in w.groups.values():
        if g.get("kind") != "team":
            continue
        hist = next((h for h in g.get("history") or [] if h.get("year") == bk.year and c.id in (h.get("roster") or [])), None)
        if hist is None and g["id"] not in c.memberships:
            continue
        lvl = ((hist or {}).get("levels") or g.get("levels") or {}).get(c.id, "varsity")
        out.append((g, lvl))
    out.sort(key=lambda t: SPORT_ORDER.index(t[0]["id"]) if t[0]["id"] in SPORT_ORDER else 99)
    return out


def _known_for(bk: Book, c) -> str:
    w = bk.w
    bits = []
    for g, lvl in _teams_of(bk, c):
        bits.append(f"{'Varsity' if lvl == 'varsity' else 'JV'} {g['name'].replace('Guilford ', '').replace('Boys ', '').lower()}")
    for gid in c.memberships:
        g = w.groups.get(gid) or {}
        if g.get("kind") in ("club", "production", "council"):
            bits.append(g.get("name"))
    rep = sorted(((k, v) for k, v in (c.reputation or {}).items() if v >= 15 and k in REP_WORDS), key=lambda kv: -kv[1])
    if rep:
        bits.append(REP_WORDS[rep[0][0]])
    if not bits and c.interests:
        bits.append("into " + max(c.interests.items(), key=lambda kv: kv[1])[0].replace("_", " "))
    return " · ".join(bits[:3])


def _quote(c) -> str:
    t = max((c.traits or {"sociability": 50}).items(), key=lambda kv: kv[1])[0]
    bank = QUOTES.get(t) or QUOTES["sociability"]
    return bank[_h(c.id, "quote") % len(bank)]


def _next(bk: Book, c) -> str | None:
    p = c.path or {}
    if p.get("kind") == "college":
        col = (getattr(bk.sim.cat, "college_by_id", {}) or {}).get(p.get("college")) or {}
        name = p.get("name") or col.get("name") or (p.get("college") or "").replace("_", " ").title()
        return name + (f" ({p['sport']})" if p.get("sport") else "")
    if p.get("kind") == "work":
        return f"Staying in {bk.sim.cat.world['town']['name']}, working"
    if p.get("kind") == "pro":
        return "Pro ball" + (f": {p['team']}" if p.get("team") else "")
    return None


def classes(bk: Book, badges: dict) -> list:
    out = []
    for g in (12, 11, 10, 9):
        kids = sorted((c for c in bk.pool if bk.grade.get(c.id) == g), key=lambda c: (c.last, c.first))
        if not kids:
            continue
        rows = []
        for c in kids:
            r = {**bk.mini(c.id), "line": _known_for(bk, c), "me": c.id == bk.me.id, "badge": badges.get(c.id)}
            if g == 12:
                r["quote"] = _quote(c)
                r["next"] = _next(bk, c)
            rows.append(r)
        out.append({"grade": g, "label": CLASS[g], "count": len(rows), "students": rows,
                    "superlatives": superlatives(bk, kids, keys=("popular", "athlete", "success", "party", "nice"), cap=1)})
    return out


# ------------------------------------------------------------------------------------------------ sports pages
def sports_pages(bk: Book) -> list:
    from . import postseason
    from .gameplay import line_words
    w, me = bk.w, bk.me
    sk = season_key(bk.year)
    teams = [g for g in w.groups.values() if g.get("kind") == "team" and g.get("school", "hchs") == (me.school or "hchs")]
    games_by: dict = {}
    for e in bk.events("game"):
        d = e.get("data") or {}
        if e.get("outcome") in ("win", "loss") and d.get("level", "varsity") == "varsity" and e.get("group"):
            games_by.setdefault(e["group"], []).append(e)
    out = []
    for g in sorted(teams, key=lambda g: (SPORT_ORDER.index(g["id"]) if g["id"] in SPORT_ORDER else 99, g["name"])):
        hist = next((h for h in reversed(g.get("history") or []) if h.get("year") == bk.year), None)
        live = hist is None
        games = sorted(games_by.get(g["id"], []), key=lambda e: e["day"])
        if live and calm.school_year_of(w.day) != bk.year and not games:
            continue
        rec = (hist or {}).get("record") or (g.get("record") if live else None) or {}
        roster = [x for x in (hist or {}).get("roster") or g.get("members") or [] if x in w.chars and w.chars[x].role != "staff"]
        levels = (hist or {}).get("levels") or g.get("levels") or {}
        varsity = [x for x in roster if levels.get(x, "varsity") == "varsity"]
        if not varsity and not games:
            continue
        leaders = []
        for cid in varsity:
            st = (w.chars[cid].stats or {}).get(f"{g['skill']}:{sk}:varsity")
            if isinstance(st, dict) and st.get("games") and st.get("team", g["id"]) == g["id"]:
                leaders.append((st.get("impact", 0), cid, st))
        leaders.sort(key=lambda x: -x[0])
        hand = next((e for e in reversed(games) if (e.get("data") or {}).get("opponent") == "Hand"), None)
        hand_line = None
        if hand:
            d = hand.get("data") or {}
            when = "on Thanksgiving" if d.get("thanksgiving") or (g["skill"] == "football" and calm.date_of(hand["day"]).month == 11) \
                else _short_date(hand["day"])
            hand_line = " ".join(x for x in ("Beat" if hand["outcome"] == "win" else "Lost to", "Hand", d.get("score") or "", when) if x)
        board = []
        for e in games:
            d = e.get("data") or {}
            board.append({"date": _short_date(e["day"]), "opp": d.get("opponent"), "score": d.get("score"), "win": e["outcome"] == "win",
                          "round": d.get("round"), "rival": bool(d.get("rivalry")), "you": me.id in (e.get("actors") or [])})
        coach = w.chars.get(g.get("staff") or "")
        you_st = (me.stats or {}).get(f"{g['skill']}:{sk}:varsity")
        you_line = line_words(g["skill"], you_st.get("line") or {}) if isinstance(you_st, dict) and you_st.get("games") \
            and you_st.get("team", g["id"]) == g["id"] else None
        out.append({"id": g["id"], "name": g["name"], "sport": g["skill"], "record": f"{rec.get('w', 0)}-{rec.get('l', 0)}",
                    "post": postseason.status(w, g, bk.a), "hand": hand_line, "live": live,
                    "coach": coach.name if coach else None,
                    "captains": [bk.mini(x) for x in (g.get("leaders") or []) if x in w.chars] if live else [],
                    "leaders": [{"who": bk.mini(cid), "line": line_words(g["skill"], st.get("line") or {}), "games": st.get("games")}
                                for _, cid, st in leaders[:3]],
                    "awards": [{"who": bk.mini(cid), "label": lab} for cid, lab in (hist or {}).get("awards") or [] if cid in w.chars],
                    "roster": [bk.mini(x) for x in varsity][:30], "jv": len(roster) - len(varsity),
                    "games": board, "you": me.id in roster, "you_line": you_line})
    return out


# ------------------------------------------------------------------------------------------------ clubs
def clubs(bk: Book) -> list:
    w, me = bk.w, bk.me
    notes: dict = {}
    for e in bk.events("election", "audition"):
        who = (e.get("actors") or [None])[0]
        if who not in w.chars:
            continue
        if e["type"] == "election" and e.get("outcome") == "won":
            notes.setdefault(e.get("group") or "council", []).append(f"{w.chars[who].name}: elected")
        elif e["type"] == "audition" and e.get("outcome") == "lead":
            notes.setdefault(e.get("group") or "drama", []).append(f"{w.chars[who].name}: the lead")
    shows: dict = {}
    for e in bk.events("audition"):
        who = (e.get("actors") or [None])[0]
        if e.get("outcome") in ("made", "lead") and who in w.chars:
            k = (e.get("group") or "drama", (e.get("data") or {}).get("event") or "the show")
            row = shows.setdefault(k, {"cast": [], "lead": [], "day": e["day"]})
            row["lead" if e["outcome"] == "lead" else "cast"].append(who)
    kinds = ["council", "production", "club", "job"]
    out = []
    for (gid, name), row in sorted(shows.items(), key=lambda kv: kv[1]["day"]):
        g = w.groups.get(gid) or {}
        cast = row["lead"] + [x for x in row["cast"] if x not in row["lead"]]
        out.append({"id": f"{gid}:{name}", "name": f"{g.get('name', 'Drama')}: {name[0].upper() + name[1:]}", "kind": "production",
                    "note": "On stage", "advisor": (w.chars[g["staff"]].name if g.get("staff") in w.chars else None),
                    "leaders": [bk.mini(x) for x in row["lead"]], "members": [bk.mini(x) for x in cast][:36], "count": len(cast),
                    "you": me.id in cast, "highlights": [f"{w.chars[x].name}: the lead" for x in row["lead"]]})
    for g in sorted(w.groups.values(), key=lambda g: (kinds.index(g["kind"]) if g.get("kind") in kinds else 9, g["name"])):
        if g.get("kind") not in kinds or (g["kind"] == "production" and any(k[0] == g["id"] for k in shows)):
            continue
        mem = [x for x in g.get("members") or [] if x in w.chars and w.chars[x].status == "active" and w.chars[x].role != "staff"]
        lead = [x for x in g.get("leaders") or [] if x in w.chars]
        if not mem and not lead:
            continue
        adv = w.chars.get(g.get("staff") or "")
        out.append({"id": g["id"], "name": g["name"], "kind": g["kind"],
                    "note": {"council": "Elected by the school", "production": "On stage", "job": "Where we worked"}.get(g["kind"], ""),
                    "advisor": adv.name if adv else None, "leaders": [bk.mini(x) for x in lead],
                    "members": [bk.mini(x) for x in mem][:36], "count": len(mem), "you": me.id in mem,
                    "highlights": (notes.get(g["id"]) or [])[:4]})
    return out


# ------------------------------------------------------------------------------------------------ student life
def life(bk: Book) -> dict:
    w, me = bk.w, bk.me
    top = max((bk.grade.get(x.id) or 9) for x in bk.pool)
    court_pool = [c for c in bk.pool if bk.grade.get(c.id) == top]
    court = {}
    for gender, t in (("m", "king"), ("f", "queen")):
        c = sorted((x for x in court_pool if x.gender == gender), key=lambda x: (-x.popularity, x.id))
        if c:
            court[t] = bk.mini(c[0].id)
            court[t + "_court"] = [bk.mini(x.id) for x in c[1:3]]
    dances = []
    for ev in bk.sim.cat.world["calendar"].get("events") or []:
        if ev.get("kind") != "dance":
            continue
        dd = (w.dance_dates or {}).get(f"dance:{ev['id']}:{bk.year}") or {}
        prs, seen = [], set()
        for x, y in (dd.items() if isinstance(dd, dict) else dd):
            k = frozenset((x, y))
            if x in w.chars and y in w.chars and k not in seen:
                seen.add(k)
                prs.append((x, y))
        if not prs:
            continue
        mine = next((y if x == me.id else x for x, y in prs if me.id in (x, y)), None)
        prs.sort(key=lambda p: (me.id not in p, -(w.chars[p[0]].popularity + w.chars[p[1]].popularity)))
        dances.append({"name": ev["name"], "couples": len(prs), "you_with": bk.mini(mine) if mine else None,
                       "pairs": [[bk.mini(x), bk.mini(y)] for x, y in prs[:8]]})
    couples, seen = [], set()
    for c in sorted(bk.pool, key=lambda c: -c.popularity):
        p = c.flags.get("partner")
        if p in bk.ids and frozenset((c.id, p)) not in seen:
            seen.add(frozenset((c.id, p)))
            couples.append([bk.mini(c.id), bk.mini(p)])
    hosts: dict = {}
    biggest = None
    went = 0
    for e in bk.events("party"):
        if e.get("outcome") not in ("thrown", "flop"):
            continue
        host = (e.get("actors") or [None])[0]
        if host not in w.chars:
            continue
        hosts[host] = hosts.get(host, 0) + 1
        n = (e.get("data") or {}).get("n", 0)
        if me.id in (e.get("targets") or []) + (e.get("actors") or []):
            went += 1
        if biggest is None or n > biggest[1]:
            biggest = (host, n, e["day"])
    host = max(hosts.items(), key=lambda kv: kv[1], default=None)
    talk: dict = {}
    for r in (w.rumors or {}).values():
        if r.get("about") in bk.ids:
            talk[r["about"]] = talk.get(r["about"], 0) + 1
    crowds = []
    for q in sorted(w.cliques.values(), key=lambda q: -len(q.get("members") or [])):
        mem = [x for x in q.get("members") or [] if x in bk.ids]
        if len(mem) >= 3:
            crowds.append({"name": q.get("name") or "A crowd", "count": len(mem), "members": [bk.mini(x) for x in mem[:10]],
                           "you": me.id in mem})
    return {"court": court, "court_class": CLASS.get(top, ""), "dances": dances, "couples": couples[:10], "parties": sum(hosts.values()),
            "you_went": went, "host": {"who": bk.mini(host[0]), "count": host[1]} if host else None,
            "biggest": {"who": bk.mini(biggest[0]), "n": biggest[1], "date": _short_date(biggest[2])} if biggest and biggest[1] else None,
            "crowds": crowds[:8],
            "talked_about": [{"who": bk.mini(x), "count": n} for x, n in sorted(talk.items(), key=lambda kv: -kv[1])[:3] if x in w.chars]}


# ------------------------------------------------------------------------------------------------ the year, month by month
BIG = {("award", "won"): 40, ("tryout", "made"): 30, ("tryout", "captain"): 40, ("audition", "lead"): 40, ("audition", "made"): 22,
       ("election", "won"): 40, ("milestone", "dating"): 45, ("milestone", "best_friends"): 16, ("ask_out", "yes"): 36,
       ("ask_to_dance", "yes"): 30, ("graduation", "graduated"): 50, ("path", "chosen"): 44, ("recruiting", "offer"): 42,
       ("injury", "hurt"): 34, ("falling_out", "friends"): 30, ("prank", "legend"): 30, ("clique", "formed"): 20,
       ("party", "thrown"): 18, ("party", "busted"): 30, ("party", "kiss"): 30, ("job", "fired"): 20, ("breakup", "ended"): 40,
       ("milestone", "broke_up"): 40}


def timeline(bk: Book) -> list:
    """The year month by month: the moments that mattered (yours and your people's first), and your storylines."""
    from . import dialogue, pov, scheduler
    w, me = bk.w, bk.me
    close = {x for (s, x), r in w.rels.items() if s == me.id and r.affection >= max(45, bk.thr)} | {me.id}
    months: dict = {}
    opened: set = set()
    once: set = set()
    for e in sorted(bk.events(), key=lambda e: e["day"]):
        t, o = e.get("type"), e.get("outcome")
        who = set((e.get("actors") or []) + (e.get("targets") or []))
        base = BIG.get((t, o))
        if t == "milestone" and o in ("best_friends", "close_friends") and me.id not in who:
            continue
        if t in ("milestone", "ask_out") and len(who) == 2:  # (Mike→you and you→Mike is one moment; a couple's first time is the one)
            key = ("romance" if o in ("dating", "yes") else o, frozenset(who))
            if key in once:
                continue
            once.add(key)
        if t == "game" and o in ("win", "loss"):
            d = e.get("data") or {}
            if d.get("level", "varsity") != "varsity":
                continue
            opener = e.get("group") not in opened
            opened.add(e.get("group"))
            base = 46 if d.get("round") else 44 if d.get("opponent") == "Hand" else 30 if opener and me.id in who else None
        if base is None:
            continue
        mine, near = me.id in who, bool(who & close)
        if not mine and not near and base < 40:
            continue
        txt = re.sub(r"\s*\(q\d+\)", "", pov.event_line(w, e, me.id) if mine else (e.get("text") or ""))
        if not txt or len(txt) > 200:
            continue
        if t == "game" and (e.get("data") or {}).get("round"):
            txt = f"{e['data']['round']}: {txt}"
        dt = calm.date_of(e["day"])
        months.setdefault((dt.year, dt.month), []).append((base + (40 if mine else 15 if near else 0), e["day"], txt, (t, o)))
    story: dict = {}
    try:
        cat = scheduler.catalog(bk.sim)
        names = {p["id"]: (p.get("pack") or {}).get("name") or p["id"] for p in dialogue.packs()}
        for sid, days in scheduler.done_map(w).items():
            pk = (cat["scenes"].get(sid) or {}).get("pack")
            for d in days:
                if pk and bk.a <= d <= bk.b:
                    dt = calm.date_of(d)
                    row = story.setdefault((dt.year, dt.month), {})
                    nm = names.get(pk, pk).split(" — ")[0]
                    row[nm] = row.get(nm, 0) + 1
    except Exception:  # noqa: BLE001 (the book without the storylines is still the book)
        story = {}
    out = []
    for k in sorted(set(months) | set(story)):
        rows = sorted(months.get(k, []), key=lambda x: (-x[0], x[1]))
        seen, keep, kinds = set(), [], {}
        for _, day, txt, kind in rows:
            if txt in seen or kinds.get(kind, 0) >= 2:  # (two of any one kind a month: not five "best friends")
                continue
            seen.add(txt)
            kinds[kind] = kinds.get(kind, 0) + 1
            keep.append((day, txt))
            if len(keep) >= 6:
                break
        st = sorted((story.get(k) or {}).items(), key=lambda kv: -kv[1])
        out.append({"month": f"{MONTHS[k[1]]} {k[0]}", "items": [{"date": _short_date(d), "text": t} for d, t in sorted(keep)],
                    "story": [{"name": n, "scenes": c} for n, c in st[:4]], "scenes": sum(c for _, c in st)})
    return out


# ------------------------------------------------------------------------------------------------ honors
def honors(bk: Book) -> dict:
    gp = lambda c: round(c.gpa, 2)  # noqa: E731
    hi = sorted((c for c in bk.pool if c.gpa >= 3.7), key=lambda c: (-c.gpa, c.id))
    ho = sorted((c for c in bk.pool if 3.3 <= c.gpa < 3.7), key=lambda c: (-c.gpa, c.id))
    ath: dict = {}
    for c in bk.pool:
        for aw in c.awards or []:
            if isinstance(aw, dict) and bk.a <= aw.get("day", -1) <= bk.b:
                k = (c.id, aw.get("label"))
                ath[k] = ath.get(k, 0) + 1
    athletic = [{"who": bk.mini(cid), "label": lab + (f" ×{n}" if n > 1 else "")}
                for (cid, lab), n in sorted(ath.items(), key=lambda kv: ("Week" in kv[0][1], -kv[1], kv[0][1], kv[0][0]))][:30]
    offers = []
    for e in bk.events("recruiting"):
        if e.get("outcome") == "offer" and (e.get("actors") or [None])[0] in bk.ids and e.get("text"):
            offers.append({"who": bk.mini(e["actors"][0]), "text": e["text"]})
    commits = [{"who": bk.mini(c.id), "where": _next(bk, c)} for c in bk.pool if bk.grade.get(c.id) == 12 and _next(bk, c)]
    return {"high": [{**bk.mini(c.id), "gpa": gp(c)} for c in hi][:40], "honors": [{**bk.mini(c.id), "gpa": gp(c)} for c in ho][:50],
            "athletic": athletic, "offers": offers[:12], "commitments": sorted(commits, key=lambda x: x["who"]["name"])}


# ------------------------------------------------------------------------------------------------ signatures
SIGN = {
    "sibling_older": ["Proud of you, kid. Don't touch my stuff. — {f}", "You made this year way more fun than it had to be. — {f}",
                      "Still the better {sib}. Love you anyway. — {f}"],
    "sibling_same": ["Same house, same hallways, same everything. Wouldn't have it any other way. — {f}",
                     "We survived {yr} year. Together. Mostly. — {f}", "Love you, {me}. Don't let it go to your head. — {f}"],
    "sibling_younger": ["You're kind of cool. Don't tell anyone I said that. — {f}", "Save me a seat next year. — {f}",
                        "Thanks for the rides. And everything. — {f}"],
    "partner": ["Best year ever, because of you. Call me tonight? — {f}", "I'm keeping this page forever. xo {f}",
                "Summer with you > everything. — {f}"],
    "admirer": ["Glad we finally talked this year. Text me this summer? — {f}", "You're way funnier than you think. Have a great summer! — {f}",
                "Don't forget about me this summer. Seriously. — {f}"],
    "teammate": ["What a season{n}. Next year we run it back. — {f}", "Locker room's going to be quiet this summer. See you at workouts. — {f}",
                 "Couldn't ask for a better teammate. Let's get Hand next year. — {f}", "Bus rides, practices, all of it. Glad it was with you. — {f}"],
    "best": ["Best friends since forever. Don't ever change. — {f}", "Can't wait for {next} year. Same table, same everything. — {f}",
             "You're stuck with me. HAGS! — {f}", "Remember everything. Seriously, everything. — {f}"],
    "rival": ["Next year I'm coming for your spot. Have a good summer anyway. — {f}", "Respect. Barely. — {f}"],
    "friend": ["HAGS! Stay cool. — {f}", "So glad we had class together. See you {next} year! — {f}", "Stay awesome, {me}. — {f}",
               "Have the best summer. Don't forget about me! — {f}", "Never a dull lunch. Have a great summer. — {f}"],
    "graduate": ["Take care of the place for me. It's yours now. — {f}", "Four years go fast. Enjoy every one. — {f}"],
    "teacher": ["A pleasure to have in class. Keep asking questions. — {f}", "Do the reading this summer. (I'm only half kidding.) — {f}",
                "Proud of the work you did this year. — {f}"],
}
PRIO = {"partner": 300, "sibling": 200, "best": 150, "teammate": 120, "admirer": 110, "graduate": 100, "rival": 60, "friend": 0}


def signatures(bk: Book) -> list:
    w, me, sim = bk.w, bk.me, bk.sim
    fam = set(sim.siblings(me.id))
    mates = set()
    for g in w.groups.values():
        if g.get("kind") != "team":
            continue
        for h in [x for x in g.get("history") or [] if x.get("year") == bk.year] + [{"roster": g.get("members") or []}]:
            if me.id in (h.get("roster") or []):
                mates |= set(h.get("roster") or [])
    mates.discard(me.id)
    rows, teachers = [], []
    for (a, b), r in w.rels.items():
        if b != me.id or a == me.id or a not in w.chars:
            continue
        c = w.chars[a]
        if c.status != "active":
            continue
        if c.role == "staff":
            if r.affection >= bk.thr + 10 and c.title:
                teachers.append((r.affection, a))
            continue
        if a not in bk.ids and a not in fam:
            continue
        back = w.rels.get((me.id, a))
        aff = r.affection
        if aff < bk.thr and r.attraction < 60 and r.rivalry < 40 and a not in fam:
            continue
        if me.flags.get("partner") == a:
            kind = "partner"
        elif a in fam:
            kind = "sibling"
        elif r.rivalry >= 40 and aff < 30:
            kind = "rival"
        elif r.attraction >= 60 and (not back or back.affection >= 20):
            kind = "admirer"
        elif a in mates:
            kind = "teammate"
        elif aff >= 70:
            kind = "best"
        elif bk.grade.get(a) == 12 and (bk.grade.get(me.id) or 9) < 12:
            kind = "graduate"
        else:
            kind = "friend"
        rows.append((PRIO[kind] + aff, a, kind))
    rows.sort(key=lambda x: (-x[0], x[1]))
    rows = rows[:12] + [(0, a, "teacher") for _, a in sorted(teachers, reverse=True)[:2]]
    myg = bk.grade.get(me.id) or me.grade or 9
    nxt = YEAR_WORD.get(myg + 1, "next")
    used: set = set()
    out = []
    for _, a, kind in rows:
        c = w.chars[a]
        bank_key = kind
        if kind == "sibling":
            cg = bk.grade.get(a) or c.grade or 13
            bank_key = "sibling_older" if cg > myg else "sibling_younger" if cg < myg else "sibling_same"
        bank = SIGN[bank_key]
        start = _h(bk.year, a, me.id) % len(bank)
        pick = next((bank[(start + i) % len(bank)] for i in range(len(bank)) if bank[(start + i) % len(bank)] not in used), bank[start])
        used.add(pick)
        text = pick.format(f=c.short if c.role == "staff" else c.first, me=me.first, next=nxt, yr=YEAR_WORD.get(myg, "this"),
                           sib="brother" if me.gender == "m" else "sister" if me.gender == "f" else "sibling",
                           n=f", #{me.jersey}" if me.jersey else "")
        out.append({"from": bk.mini(a), "kind": kind, "style": _h(a) % 4, "text": text})
    return out


# ------------------------------------------------------------------------------------------------ your page
def your_page(bk: Book, sup: list) -> dict:
    from . import scheduler
    from .gameplay import line_words
    w, me = bk.w, bk.me
    ranked = sorted(bk.pool, key=lambda c: (-c.popularity, c.id))
    rank = next((i + 1 for i, c in enumerate(ranked) if c.id == me.id), None)
    myg = bk.grade.get(me.id)
    grade = [c for c in ranked if bk.grade.get(c.id) == myg]
    hist = [h for h in ladder.hist(w)["me"] if bk.a <= h[0] <= bk.b]
    best = min((h[1] for h in hist), default=rank)
    sk = season_key(bk.year)
    teams = []
    for key, st in (me.stats or {}).items():
        if isinstance(st, dict) and f":{sk}:" in key and st.get("school") != "college" and st.get("games"):
            teams.append({"team": st.get("team_name"), "level": st.get("level"), "record": f"{st.get('wins', 0)}-{st.get('losses', 0)}",
                          "games": st.get("games", 0), "line": line_words(st.get("sport"), st.get("line") or {}) if st.get("line") else "",
                          "sport": st.get("sport")})
    teams.sort(key=lambda t: SPORT_ORDER.index(t["sport"]) if t["sport"] in SPORT_ORDER else 99)
    aw: dict = {}
    for x in me.awards or []:
        if isinstance(x, dict) and bk.a <= x.get("day", -1) <= bk.b:
            aw[x.get("label")] = aw.get(x.get("label"), 0) + 1
    new_friends = [o for (s, o), r in w.rels.items() if s == me.id and o in w.chars and r.affection >= bk.thr and bk.a <= r.met_day <= bk.b
                   and bk.rel(o, me.id) >= bk.thr and w.chars[o].role != "staff"]
    friends = [o for (s, o), r in w.rels.items() if s == me.id and o in w.chars and r.affection >= bk.thr and bk.rel(o, me.id) >= bk.thr]
    done = scheduler.done_map(w)
    scenes = sum(1 for days in done.values() if any(bk.a <= d <= bk.b for d in days))
    dates = []
    for ev in bk.sim.cat.world["calendar"].get("events") or []:
        if ev.get("kind") == "dance":
            p = ((w.dance_dates or {}).get(f"dance:{ev['id']}:{bk.year}") or {}).get(me.id)
            if p in w.chars:
                dates.append({"dance": ev["name"], "with": bk.mini(p)})
    partner = me.flags.get("partner")
    return {**bk.mini(me.id), "rank": rank, "of": len(ranked), "best_rank": best,
            "grade_rank": next((i + 1 for i, c in enumerate(grade) if c.id == me.id), None), "grade_of": len(grade),
            "gpa": round(me.gpa, 2), "teams": teams, "games": sum(t["games"] for t in teams),
            "wins": sum(int(t["record"].split("-")[0]) for t in teams),
            "awards": [{"label": k, "count": n} for k, n in sorted(aw.items(), key=lambda kv: ("Week" in kv[0], -kv[1]))],
            "friends": len(friends), "new_friends": [bk.mini(o) for o in sorted(new_friends, key=lambda o: -bk.rel(me.id, o))[:8]],
            "partner": bk.mini(partner) if partner in w.chars else None, "scenes": scenes, "dates": dates,
            "won": [s["label"] for s in sup if s.get("yours")],
            "close": [{"label": s["label"], "you": s["you"]} for s in sup
                      if not s.get("yours") and not s.get("pair") and s.get("you") and s["you"] <= 3],
            "history": [{"date": _short_date(h[0]), "rank": h[1], "of": h[2]} for h in hist][-40:],
            "known_for": _known_for(bk, me)}


# ------------------------------------------------------------------------------------------------ the volume
def build(sim, year: int | None = None) -> dict:
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    if me is None:
        return {}
    y = calm.school_year_of(w.day) if year is None else year
    bk = Book(sim, y)
    if not bk.pool:
        return {}
    sup = superlatives(bk, bk.pool) + pairs(bk)
    badges: dict = {}
    for s in sup:
        badges.setdefault(s["winner"]["id"], s["label"])
        if s.get("partner"):
            badges.setdefault(s["partner"]["id"], s["label"])
    myg = bk.grade.get(me.id) or me.grade
    return {"year": y, "title": title(y), "label": f"{YEAR_TITLE.get(myg, '')} year · {season_key(y)}".strip(" ·"),
            "school": sim.cat.world["school"]["name"], "live": True, "as_of": calm.label(w.day), "students": len(bk.pool),
            "you": your_page(bk, sup), "superlatives": sup, "classes": classes(bk, badges), "sports": sports_pages(bk),
            "clubs": clubs(bk), "life": life(bk), "timeline": timeline(bk), "honors": honors(bk), "signatures": signatures(bk)}


def freeze(sim, year: int) -> None:
    """The school year's over (and the summer after it): its book is kept just as it is."""
    store = sim.w.meta.setdefault("yearbook", {})
    if str(year) in store:
        return
    v = build(sim, year)
    if v:
        v["live"] = False
        store[str(year)] = v


def view(sim, year: int | None = None) -> dict:
    """{"volumes": [{year, title, label, live}], "volume": the one asked for (this year's by default)}"""
    w = sim.w
    now = calm.school_year_of(w.day)
    store = w.meta.get("yearbook") or {}
    vols = [{"year": now, "title": title(now), "live": True}] + [
        {"year": int(k), "title": v.get("title") or title(int(k)), "label": v.get("label"), "live": False}
        for k, v in sorted(store.items(), key=lambda kv: -int(kv[0])) if int(k) != now]
    vol = build(sim) if year is None or year == now else (store.get(str(year)) or {})
    return {"volumes": vols, "volume": vol}
