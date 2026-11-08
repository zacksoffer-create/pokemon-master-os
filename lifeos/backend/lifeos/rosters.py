"""Real rosters, coaches and teachers: a roster sheet (ChatGPT writes it from your notes), checked, then put in.

A sheet is plain lines under headers:

    -- Football 2010-11            (a team and a school year; "(only these)" when the list is the whole roster)
    coach: Tom Bryant | head coach | old-school, loud, plays seniors
    coach: Dave Grant | JV coach
    player: Arjun Winslow | senior | RB | #22 | varsity | captain | fast, quiet leader, the star
    player: Zack Soffer | freshman | WR | #3 | JV
    -- Teachers
    teacher: Mr. Haddad | Honors English 9, English 10 | advisor: Grizzly Gazette | dry humor, tough grader
    staff: Dr. Alvarez | Principal

What it does:
- a player is matched to the person in your story with that name (or made, in the right grade and family-free), and put
  on that team that school year at that level, with the position, number and captaincy. Rosters are kept by school year
  (w.meta["rosters"]), so tryouts that year put them there; "(only these)" means nobody else makes it (you're never cut
  by a sheet unless it lists you as out). A season under way changes now; a finished season's yearbook roster too.
- what the notes say ("the star", "backup", "cocky", "hard worker", "funny") sets how good they are and who they are;
  the notes are their bio.
- a head coach renames the team's coach if they only coach this team (so storylines keep them), or takes over from a
  coach who runs two; assistants and JV coaches join the staff. A coach's style ("old-school", "players' coach", "plays
  seniors", "plays favorites") changes how they pick the roster.
- a teacher is a person at the school; the classes listed are theirs in everyone's schedule (yours too), and a club
  they advise is theirs. Staff (principal, counselor, athletic director) are people too.
Sheets are kept in the groundwork, so Start over puts them back.
"""
from __future__ import annotations

import random
import re

from . import calendar as calm

TEAM_WORDS = [  # (regex, group id): checked in order
    (r"girls?'?\s*(varsity\s+)?basketball|women'?s basketball", "basketball_girls"),
    (r"girls?'?\s*(varsity\s+)?soccer|women'?s soccer", "soccer_girls"),
    (r"basketball|hoops", "basketball"),
    (r"soccer", "soccer"),
    (r"football", "football"),
    (r"softball", "softball"),
    (r"baseball", "baseball"),
]
GRADES = {"freshman": 9, "frosh": 9, "fr": 9, "9th": 9, "sophomore": 10, "soph": 10, "so": 10, "10th": 10, "junior": 11,
          "jr": 11, "11th": 11, "senior": 12, "sr": 12, "12th": 12}
YEAR_WORDS = {"freshman": 9, "sophomore": 10, "junior": 11, "senior": 12}
POS = {
    "football": {"QB": r"qb|quarterback", "RB": r"rb|running ?back|tailback|halfback|fullback", "WR": r"wr|wide ?receiver|receiver|wideout|slot",
                 "TE": r"te|tight ?end", "OL": r"ol|o-?line(man)?|offensive line(man)?|guard|center|tackle|lineman",
                 "DL": r"dl|d-?line(man)?|defensive line(man)?|defensive end|de|dt|nose ?tackle",
                 "LB": r"lb|linebacker|mlb|olb", "DB": r"db|cb|corner(back)?|safety|s|fs|ss", "K": r"k|kicker|punter|p"},
    "basketball": {"PG": r"pg|point ?guard|point", "SG": r"sg|shooting ?guard|guard|2 ?guard", "SF": r"sf|small ?forward|wing",
                   "PF": r"pf|power ?forward|forward", "C": r"c|center|big"},
    "baseball": {"P": r"p|pitcher|rhp|lhp|sp|rp|closer", "C": r"c|catcher", "1B": r"1b|first( base)?", "2B": r"2b|second( base)?",
                 "SS": r"ss|short( ?stop)?", "3B": r"3b|third( base)?", "OF": r"of|lf|cf|rf|outfield(er)?|left field|center field|right field"},
    "soccer": {"GK": r"gk|goalie|keeper|goalkeeper", "CB": r"cb|center ?back|centre ?back|defender|sweeper|stopper",
               "FB": r"fb|full ?back|outside ?back|wing ?back|lb|rb", "CM": r"cm|cdm|cam|mid(fielder|field)?|center mid",
               "WM": r"wm|winger|wing|lm|rm|outside mid", "ST": r"st|striker|forward|cf"},
}
POS["softball"] = POS["baseball"]
GOOD = [(r"\b(the )?(star|best (player|athlete)|stud|all[- ]?(state|conference|scc|american)|mvp|phenom|d1|division (1|i) recruit)\b", 82),
        (r"\b(starter|starting|start(ed|s)?)\b", 68), (r"\b(solid|good|reliable|contributor)\b", 60),
        (r"\b(bench|backup|back-up|role player|scrub|reserve|depth)\b", 46)]
TRAIT_WORDS = [  # (regex, {"traits": {...}, "aptitudes": {...}, "popularity": n})
    (r"\b(natural )?leader\b", {"traits": {"confidence": 75, "sociability": 70}}),
    (r"\bquiet\b", {"traits": {"sociability": 30}}),
    (r"\bshy\b", {"traits": {"sociability": 25, "confidence": 35}}),
    (r"\bloud\b", {"traits": {"sociability": 80, "volatility": 60}}),
    (r"\b(funny|class clown|jokester|hilarious|goofy)\b", {"traits": {"impulsivity": 70, "sociability": 80}}),
    (r"\b(cocky|arrogant|jerk|ego|full of himself|full of herself|asshole|prick)\b", {"traits": {"empathy": 30, "confidence": 85}}),
    (r"\b(nice|kind|good (guy|kid|dude|girl)|sweet|genuine)\b", {"traits": {"empathy": 80}}),
    (r"\b(hard[- ]?work(er|ing)|grinder|gym rat|works hard|blue[- ]collar)\b", {"traits": {"discipline": 85}}),
    (r"\b(lazy|slacker)\b", {"traits": {"discipline": 25}}),
    (r"\b(smart|brainy|genius|nerd|honors kid)\b", {"aptitudes": {"academic": 80}}),
    (r"\bcompetitive\b", {"traits": {"competitiveness": 85}}),
    (r"\b(hot ?head(ed)?|temper|hot-tempered)\b", {"traits": {"volatility": 85}}),
    (r"\bloyal\b", {"traits": {"loyalty": 85}}),
    (r"\bpopular\b", {"popularity": 70}),
    (r"\b(party(er|ing)?|partier)\b", {"traits": {"sociability": 80, "impulsivity": 70}}),
    (r"\b(fast|quick|speedy|athletic|athlete)\b", {"aptitudes": {"athletic": 80}}),
    (r"\b(confident|swagger)\b", {"traits": {"confidence": 80}}),
    (r"\b(old[- ]school|strict|tough|yell(er|s)|intense|hard-?nosed|drill sergeant|disciplinarian)\b",
     {"traits": {"discipline": 85, "volatility": 65, "empathy": 40}}),
    (r"\b(players'? coach|laid[- ]back|relaxed|chill|easygoing|easy-going)\b", {"traits": {"empathy": 80, "discipline": 45, "volatility": 30}}),
    (r"\b(win(s)? at all costs|only plays the best|plays the best|cutthroat)\b", {"traits": {"competitiveness": 90}}),
    (r"\b(x'?s and o'?s|tactician|knows the game|smart coach)\b", {"aptitudes": {"academic": 80}}),
]
FAVORS = [(r"\b(plays|loyal to|favors|sticks with) (the )?seniors\b", "seniors"), (r"\bplays favorites\b", "favorites"),
          (r"\b(plays|gives) (the )?(young|underclass)(men|men)?\b|\bplays (freshmen|young guys|young kids)\b", "young")]
TITLE_RX = re.compile(r"^(mr|ms|mrs|miss|mx|dr|coach|principal)\.?$", re.I)
TITLE = {"mr": "Mr.", "ms": "Ms.", "mrs": "Mrs.", "miss": "Miss", "mx": "Mx.", "dr": "Dr.", "coach": "Coach", "principal": "Principal"}
TITLE_GENDER = {"mr": "m", "ms": "f", "mrs": "f", "miss": "f"}
CLUB_WORDS = {"robotics": r"robot", "band": r"band|jazz|music", "art": r"\bart\b|studio art", "paper": r"gazette|paper|newspaper|herald|journalism",
              "council": r"council|student government", "drama": r"drama|theater|theatre|play|musical|footlights"}


class SheetError(ValueError):
    pass


# ------------------------------------------------------------------------------------------------ reading a sheet
def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' .-]", " ", (s or "").lower())).strip()


def team_of(text: str) -> str | None:
    t = (text or "").lower()
    for rx, gid in TEAM_WORDS:
        if re.search(rx, t):
            return gid
    return None


def _year_of(sim, text: str, base: int) -> int | None:
    """'2010-11' / '2010-2011' / 'fall 2010' / 'spring 2011' / 'sophomore year' -> the school year (0 = 2010-11)."""
    t = (text or "").lower()
    m = re.search(r"\b(20\d\d)\s*[-/–]\s*(\d{2,4})\b", t)
    if m:
        return int(m.group(1)) - calm.START.year
    m = re.search(r"\b(fall|autumn|winter|spring|summer)?\s*(20\d\d)\b", t)
    if m:
        y = int(m.group(2)) - calm.START.year
        return y - 1 if m.group(1) in ("winter", "spring", "summer") else y
    m = re.search(r"\b(freshman|sophomore|junior|senior) year\b", t)
    if m:
        me = sim.w.chars.get(sim.w.meta.get("protagonist") or "")
        if me is not None and me.grade and me.grade <= 12:
            return calm.school_year_of(sim.w.day) - (me.grade - 9) + (YEAR_WORDS[m.group(1)] - 9)
        return YEAR_WORDS[m.group(1)] - 9
    return None


def _split(line: str) -> list:
    return [p.strip() for p in re.split(r"\s*[|\t]\s*", line) if p.strip()]


def _pos(sport: str, text: str) -> str | None:
    t = text.strip().lower().replace(".", "")
    for code, rx in (POS.get(sport) or {}).items():
        for part in re.split(r"\s*[/,&]\s*|\s+and\s+", t):
            if re.fullmatch(rx, part.strip()):
                return code
    return None


def parse(sim, text: str, base: int | None = None) -> dict:
    """The sheet's sections and lines, read leniently. {"sections": [...], "notes": [problems]}"""
    w = sim.w
    base = calm.school_year_of(w.day) if base is None else base
    sections, notes = [], []
    cur = None
    for n, raw in enumerate((text or "").splitlines(), 1):
        line = raw.strip().strip("`").strip()
        if not line:
            continue
        line = re.sub(r"^[-*•]\s+(?=(coach|player|teacher|staff)\s*:)", "", line, flags=re.I)
        if re.match(r"^(--+|==+|#{1,4})\s*", line):
            hashed = line.startswith("#")
            head = re.sub(r"^(--+|==+|#{1,4})\s*", "", line).strip(" -=*")
            if re.search(r"\b(teachers?|staff|faculty|administration|school)\b", head, re.I) and not team_of(head):
                cur = {"kind": "staff", "head": head, "line": n, "rows": []}
            elif team_of(head):
                y = _year_of(sim, head, base)
                cur = {"kind": "team", "team": team_of(head), "year": base if y is None else y, "only": bool(re.search(r"only", head, re.I)),
                       "head": head, "line": n, "rows": []}
            else:
                cur = None
                if head and not hashed and not re.match(r"^(guilford|rosters?|my )", head, re.I):
                    notes.append(f"line {n}: \"{head}\" isn't a team (Football, Boys Soccer, Girls Soccer, Boys Basketball, Girls Basketball, "
                                 f"Baseball, Softball) or Teachers")
            if cur is not None:
                sections.append(cur)
            continue
        m = re.match(r"^(coach|player|teacher|staff)\s*:\s*(.+)$", line, re.I)
        if not m:
            notes.append(f"line {n}: didn't understand \"{line[:60]}\" (lines start with player:, coach:, teacher: or staff:)")
            continue
        kind, rest = m.group(1).lower(), m.group(2)
        if cur is None:
            if kind in ("teacher", "staff"):
                cur = {"kind": "staff", "head": "Teachers", "line": n, "rows": []}
                sections.append(cur)
            else:
                notes.append(f"line {n}: a {kind} line needs a team header above it (like: -- Football 2010-11)")
                continue
        if cur["kind"] == "staff" and kind in ("player", "coach"):
            notes.append(f"line {n}: a {kind} goes under a team header, not under {cur['head']}")
            continue
        parts = _split(rest)
        cur["rows"].append({"kind": kind, "name": parts[0], "fields": parts[1:], "line": n})
    return {"sections": sections, "notes": notes}


def _read_player(sport: str, fields: list) -> dict:
    out: dict = {"notes": []}
    for f in fields:
        t = f.strip()
        low = t.lower().strip(" .")
        if re.fullmatch(r"#?\s*\d{1,2}", low):
            out["jersey"] = int(re.sub(r"\D", "", low))
        elif low in GRADES or re.fullmatch(r"(grade )?(9|10|11|12)(th)?( grade)?", low):
            out["grade"] = GRADES.get(low) or int(re.sub(r"\D", "", low))
        elif low in ("varsity", "v", "jv", "junior varsity", "freshman team", "frosh team", "out", "cut", "not on the team"):
            out["level"] = "varsity" if low in ("varsity", "v") else "out" if low in ("out", "cut", "not on the team") else "jv"
        elif low in ("captain", "co-captain", "c", "capt", "captains"):
            out["captain"] = True
        elif "pos" not in out and _pos(sport, low):
            out["pos"] = _pos(sport, low)
        else:
            m = re.match(r"^(freshman|sophomore|junior|senior)\b", low)
            if m and "grade" not in out:
                out["grade"] = GRADES[m.group(1)]
            if re.search(r"\b(co-)?captain\b", low):
                out["captain"] = True
            if re.search(r"\bvarsity\b", low) and "level" not in out:
                out["level"] = "jv" if re.search(r"\bjv\b|junior varsity", low) else "varsity"
            elif re.search(r"\bjv\b|junior varsity", low) and "level" not in out:
                out["level"] = "jv"
            mj = re.search(r"#\s*(\d{1,2})\b", low)
            if mj and "jersey" not in out:
                out["jersey"] = int(mj.group(1))
            out["notes"].append(t)
    out["note"] = "; ".join(out.pop("notes"))
    return out


def _read_staff(fields: list) -> dict:
    out: dict = {"role": None, "classes": [], "advises": None, "notes": []}
    for f in fields:
        t = f.strip()
        m = re.match(r"^(advisor|advises|adviser|club)\s*(of|for)?\s*:?\s*(.+)$", t, re.I)
        if m:
            out["advises"] = m.group(3).strip()
        elif out["role"] is None and not out["classes"]:
            out["role"] = t
        else:
            out["notes"].append(t)
    out["note"] = "; ".join(out.pop("notes"))
    return out


def _notes_effects(note: str) -> dict:
    eff: dict = {"traits": {}, "aptitudes": {}}
    low = (note or "").lower()
    for rx, e in TRAIT_WORDS:
        if re.search(rx, low):
            for k in ("traits", "aptitudes"):
                eff[k].update(e.get(k) or {})
            if e.get("popularity"):
                eff["popularity"] = e["popularity"]
    skill = next((v for rx, v in GOOD if re.search(rx, low)), None)
    if skill is not None:
        eff["skill"] = skill
    eff["favors"] = next((v for rx, v in FAVORS if re.search(rx, low)), None)
    return eff


# ------------------------------------------------------------------------------------------------ who's who
def _split_name(name: str) -> tuple:
    """'Mr. Haddad' -> ('Mr.', '', 'Haddad'); 'Tom Bryant' -> ('', 'Tom', 'Bryant'); 'Coach Tom Bryant' -> ('Coach', 'Tom', 'Bryant')"""
    bits = [b for b in re.sub(r"\(.*?\)|\".*?\"", " ", name or "").replace(",", " ").split() if b]
    title = ""
    if bits and TITLE_RX.match(bits[0]):
        title = TITLE.get(bits[0].rstrip(".").lower(), bits[0])
        bits = bits[1:]
    if not bits:
        return title, "", ""
    if len(bits) == 1:
        return title, ("" if title else bits[0]), (bits[0] if title else "")
    return title, " ".join(bits[:-1]), bits[-1]


def find(sim, name: str, staff: bool | None = None, grade: int | None = None) -> tuple:
    """(id, how) for the person this name means, or (None, why). how: 'exact', 'last name', 'first name'."""
    w = sim.w
    title, first, last = _split_name(name)
    pool = [c for c in w.chars.values() if c.status == "active" and (staff is None or (c.role == "staff") == staff)
            and (staff or c.role in ("student", "alumni", "staff"))]
    if staff is False:
        pool = [c for c in pool if c.role in ("student", "alumni")]
    fl, ll = first.lower(), last.lower()
    exact = [c for c in pool if c.first.lower() == fl and c.last.lower() == ll] if first and last else []
    if not exact and first and last:  # (a middle name, "Mike" for "Michael")
        exact = [c for c in pool if c.last.lower() == ll and (c.first.lower().startswith(fl[:3]) or fl.startswith(c.first.lower()[:3]))]
    if len(exact) > 1 and grade:
        exact = [c for c in exact if c.grade == grade] or exact
    if len(exact) == 1:
        return exact[0].id, "exact"
    if len(exact) > 1:
        return None, f"more than one {name}"
    if staff and first and last:  # a teacher or coach the game named differently ("Coach Bryant" is "Tom Bryant")
        lastm = [c for c in pool if c.role == "staff" and c.last.lower() == ll and "recruit" not in (c.role_label or "").lower()
                 and "university" not in (c.role_label or "").lower()]
        tg = TITLE_GENDER.get(title.rstrip(".").lower()) if title else None
        lastm = [c for c in lastm if not tg or c.gender == tg]
        if len(lastm) == 1:
            return lastm[0].id, "last name"
    if title and last and not first:
        lastm = [c for c in pool if c.last.lower() == ll and (c.role == "staff" or staff is None)]
        if len(lastm) == 1:
            return lastm[0].id, "last name"
        if len(lastm) > 1:
            t = [c for c in lastm if (c.title or "").lower() == title.lower()]
            if len(t) == 1:
                return t[0].id, "last name"
            return None, f"more than one {last}"
    return None, "new"


def _gender_for(sim, first: str, title: str = "", team: str | None = None) -> str:
    g = TITLE_GENDER.get(title.rstrip(".").lower()) if title else None
    if g:
        return g
    if team and sim.w.groups.get(team, {}).get("gender"):
        return sim.w.groups[team]["gender"]
    if team and team in ("softball",):
        return "f"
    names = sim.cat.people["names"]
    if first in names["female"] and first not in names["male"]:
        return "f"
    if first in names["male"]:
        return "m"
    return "m" if team in ("football", "baseball", "basketball", "soccer") else "f" if (first or "x")[-1] in "aey" else "m"


def _class_names() -> list:
    from . import classes
    d = classes.data()
    out = []
    for rows in d["grades"].values():
        for r in rows:
            for spec in (r["std"], r["hon"]):
                if spec[0] not in out:
                    out.append(spec[0])
    out += [e["class"][0] for e in d["electives"] if e["class"][0] not in out]
    return out


def _match_classes(text: str) -> tuple:
    names = _class_names()
    got, missing = [], []
    for part in [p.strip() for p in re.split(r"\s*[,;/]\s*|\s+and\s+", text or "") if p.strip()]:
        low = part.lower()
        hit = next((n for n in names if n.lower() == low), None) or next((n for n in names if low in n.lower() or n.lower() in low), None)
        if hit and hit not in got:
            got.append(hit)
        elif not hit:
            missing.append(part)
    return got, missing


def _club_for(w, text: str) -> str | None:
    low = (text or "").lower()
    for g in w.groups.values():
        if g.get("kind") in ("club", "council", "production") and g["name"].lower() in low:
            return g["id"]
    for gid, rx in CLUB_WORDS.items():
        if re.search(rx, low) and gid in w.groups:
            return gid
    return None


# ------------------------------------------------------------------------------------------------ the plan (check)
def _team_label(w, gid: str) -> str:
    return (w.groups.get(gid) or {}).get("name", gid).replace("Guilford ", "")


def plan(sim, text: str, base: int | None = None) -> dict:
    """What a sheet would do, without doing it. {"rows": [{section, kind, name, status, says, warn}], "notes", "counts"}"""
    w = sim.w
    base = calm.school_year_of(w.day) if base is None else base
    me = w.chars.get(w.meta.get("protagonist") or "")
    p = parse(sim, text, base)
    rows, notes = [], list(p["notes"])
    now_year = calm.school_year_of(w.day)
    for sec in p["sections"]:
        if sec["kind"] == "team":
            g = w.groups.get(sec["team"])
            if g is None:
                notes.append(f"line {sec['line']}: there's no {sec['team']} team in this story")
                continue
            sport = g["skill"]
            label = f"{_team_label(w, sec['team'])} {calm.START.year + sec['year']}-{str(calm.START.year + sec['year'] + 1)[2:]}"
            for r in sec["rows"]:
                if r["kind"] == "coach":
                    st = _read_staff(r["fields"])
                    cid, how = find(sim, r["name"], staff=True)
                    role = st["role"] or "head coach"
                    head = bool(re.search(r"\bhead\b", role, re.I)) or not re.search(r"assist|jv|junior varsity|freshman|pitching|hitting|"
                                                                                      r"coordinator|line|position|volunteer|strength", role, re.I)
                    cur = w.chars.get(g.get("staff") or "")
                    if cid:
                        status, says = "found", f"{role} of {label.rsplit(' ', 1)[0]}"
                    elif head and cur and sum(1 for x in w.groups.values() if x.get("staff") == cur.id) == 1:
                        status, says = "rename", f"{cur.name} becomes {r['name']}, head coach of {_team_label(w, sec['team'])}"
                    else:
                        status, says = "new", f"{role} of {_team_label(w, sec['team'])}"
                    rows.append({"section": label, "kind": "coach", "name": r["name"], "status": status, "says": says, "line": r["line"],
                                 "id": cid, "head": head, "role": role, "team": sec["team"], "note": st["note"] or (st["role"] if not head else ""),
                                 "warn": how if how.startswith("more than one") else None,
                                 "matched": w.chars[cid].name if cid and how == "last name" else None})
                    continue
                pl = _read_player(sport, r["fields"])
                g_then = pl.get("grade")
                g_now = (g_then - (sec["year"] - now_year)) if g_then else None
                cid, how = find(sim, r["name"], staff=False, grade=g_now)
                warn = how if how.startswith("more than one") else None
                status = "found" if cid else "new"
                c = w.chars.get(cid) if cid else None
                if c is None and g_now is not None and not (9 <= g_now <= 12):
                    status = "skip"
                    warn = (f"a {('senior' if g_then == 12 else 'student')} in {label.split()[-1]} has already graduated by now"
                            if g_now > 12 else f"starts high school after this year ({label.split()[-1]}): add them later")
                if c is None and g_now is None and status == "new":
                    status = "skip"
                    warn = "needs a grade (freshman, sophomore, junior or senior) to be added"
                if c is not None and g_now and c.role == "student" and c.grade != g_now and 9 <= g_now <= 12:
                    warn = f"in the game they're a {calm_year(c.grade)}; the sheet makes them a {calm_year(g_now)} now"
                if c is not None and not _can_play(c, g):
                    status, warn = "skip", f"{c.name} can't play on {_team_label(w, sec['team'])} (boys' and girls' teams)"
                lvl = pl.get("level") or ("jv" if (g_then or 12) == 9 and g.get("jv_capacity") and sport == "football" else "varsity")
                says = " · ".join(x for x in [
                    "off the team" if lvl == "out" else f"{'JV' if lvl == 'jv' else 'varsity'}", pl.get("pos"),
                    f"#{pl['jersey']}" if pl.get("jersey") else "", "captain" if pl.get("captain") else "",
                    calm_year(g_then) if g_then else ""] if x)
                if me is not None and cid == me.id:
                    says += " · that's you"
                rows.append({"section": label, "kind": "player", "name": r["name"], "status": status, "says": says, "line": r["line"],
                             "id": cid, "team": sec["team"], "year": sec["year"], "level": lvl, "grade_now": g_now, "pl": pl, "warn": warn,
                             "matched": (c.name if c is not None and c.name.lower() != r["name"].lower() else None)})
            if sec["only"]:
                n = sum(1 for r in sec["rows"] if r["kind"] == "player")
                need = g.get("starters", 5)
                rows.append({"section": label, "kind": "only", "name": "Only these", "status": "rule", "line": sec["line"], "team": sec["team"],
                             "year": sec["year"], "says": "nobody else makes the team that year (you aren't cut unless you're listed as out)",
                             "warn": f"only {n} players: a lineup takes {need}" if n < need else None})
        else:
            for r in sec["rows"]:
                st = _read_staff(r["fields"])
                cid, how = find(sim, r["name"], staff=True)
                if not cid:
                    cid2, how2 = find(sim, r["name"], staff=None)
                    if cid2 and w.chars[cid2].role == "staff":
                        cid, how = cid2, how2
                classes, missing = (_match_classes(st["role"]) if r["kind"] == "teacher" else ([], []))
                club = _club_for(w, st["advises"]) if st["advises"] else None
                bits = []
                if classes:
                    bits.append(", ".join(classes))
                elif r["kind"] == "staff" and st["role"]:
                    bits.append(st["role"])
                if st["advises"]:
                    bits.append(f"advises {w.groups[club]['name'] if club else st['advises']}")
                warn = None
                if missing:
                    warn = f"not a class in the game: {', '.join(missing)}"
                if st["advises"] and not club:
                    warn = (warn + "; " if warn else "") + f"no club called {st['advises']}"
                if how.startswith("more than one"):
                    warn = how
                rows.append({"section": "Teachers & staff", "kind": r["kind"], "name": r["name"], "status": "found" if cid else "new",
                             "says": " · ".join(bits) or (st["role"] or ""), "line": r["line"], "id": cid, "classes": classes, "club": club,
                             "role": st["role"], "note": st["note"], "warn": warn,
                             "matched": w.chars[cid].name if cid and w.chars[cid].name.lower() != r["name"].lower() else None})
    counts = {k: sum(1 for r in rows if r["status"] == k) for k in ("found", "new", "rename", "skip")}
    return {"rows": rows, "notes": notes, "counts": counts}


def calm_year(g) -> str:
    return {9: "freshman", 10: "sophomore", 11: "junior", 12: "senior"}.get(g, f"grade {g}")


def _can_play(c, g) -> bool:
    from . import sports
    return sports.can_play(c, g)


# ------------------------------------------------------------------------------------------------ putting it in
def store(w) -> dict:
    return w.meta.setdefault("rosters", {})


def closed(w, gid: str) -> bool:
    """This school year's roster is "only these": nobody walks on or gets called up."""
    ros = pinned(w, gid, calm.school_year_of(w.day))
    return bool(ros and ros.get("only"))


def pinned(w, gid: str, year: int) -> dict | None:
    """The roster a sheet set for this team this school year: {"players": {id: level}, "captains": [ids], "only": bool}."""
    return store(w).get(f"{gid}:{year}")


def apply(sim, text: str, base: int | None = None, record: bool = True) -> dict:
    """Put a sheet in. {"done": [lines said], "skipped": [...], "notes": [...], "counts"}"""
    from . import editor, groundwork, sports
    w = sim.w
    base = calm.school_year_of(w.day) if base is None else base
    pl_ = plan(sim, text, base)
    done, skipped = [], []
    now_year = calm.school_year_of(w.day)
    me_id = w.meta.get("protagonist")
    was = groundwork._replaying
    groundwork._replaying = True  # (the sheet is what's kept, not each edit it makes)
    try:
        for r in pl_["rows"]:
            if r["status"] == "skip":
                skipped.append(f"{r['name']}: {r['warn']}")
                continue
            try:
                if r["kind"] == "player":
                    said = _put_player(sim, r, now_year, me_id)
                elif r["kind"] == "coach":
                    said = _put_coach(sim, r)
                elif r["kind"] == "only":
                    key = f"{r['team']}:{r['year']}"
                    store(w).setdefault(key, {"players": {}, "captains": [], "only": False})["only"] = True
                    said = f"{r['section']}: only the players listed"
                else:
                    said = _put_staff(sim, r)
                if said:
                    done.append(said)
            except (editor.EditorError, ValueError, KeyError) as e:
                skipped.append(f"{r['name']}: {e}")
        for key, ros in store(w).items():  # a season under way (or finished) gets its roster now
            gid, y = key.rsplit(":", 1)
            if gid in w.groups:
                _settle_team(sim, gid, int(y), ros, now_year, me_id)
    finally:
        groundwork._replaying = was
    if record and not was:
        gw = groundwork.get(w)
        gw.setdefault("sheets", []).append({"text": text, "year": base, "day": w.day})
    sports  # noqa: B018 (imported for _settle_team's helpers)
    return {"done": done, "skipped": skipped, "notes": pl_["notes"], "counts": pl_["counts"]}


def _effects_body(c, note: str, sport: str | None) -> dict:
    eff = _notes_effects(note)
    body: dict = {}
    if eff["traits"]:
        body["traits"] = eff["traits"]
    if eff["aptitudes"]:
        body["aptitudes"] = eff["aptitudes"]
    if note:
        body["bio"] = note[:480]
    return body


def _put_player(sim, r, now_year, me_id) -> str:
    from . import editor
    w = sim.w
    g = w.groups[r["team"]]
    sport = g["skill"]
    pl = r["pl"]
    note = pl.get("note") or ""
    eff = _notes_effects(note)
    cid = r["id"] or find(sim, r["name"], staff=False, grade=r["grade_now"])[0]  # (an earlier line may have made them)
    made = False
    if cid is None:
        title, first, last = _split_name(r["name"])
        if not first:
            raise ValueError("needs a first and last name")
        gender = _gender_for(sim, first, "", r["team"])
        spec = {"first": first, "last": last or "Smith", "gender": gender, "grade": r["grade_now"],
                "interests": {sport: 80}, "skills": {sport: eff.get("skill") or (60 if r["level"] == "varsity" else 46)}}
        if pl.get("pos"):
            spec["positions"] = {sport: pl["pos"]}
        if pl.get("jersey"):
            spec["jersey"] = pl["jersey"]
        for k in ("traits", "aptitudes"):
            if eff[k]:
                spec[k] = dict(eff[k])
        if note:
            spec["bio"] = note[:480]
        c = editor.make_person(sim, spec)
        cid, made = c.id, True
    c = w.chars[cid]
    body = _effects_body(c, note, sport) if not made else {}
    if pl.get("pos") and (c.positions or {}).get(sport) != pl["pos"]:
        body["positions"] = {**(c.positions or {}), sport: pl["pos"]}
    if pl.get("jersey") and c.jersey != pl["jersey"]:
        body["jersey"] = pl["jersey"]
    if cid == me_id:
        body.pop("bio", None)
        body.pop("traits", None)  # (a sheet says where you play, not who you are)
    if body:
        editor.save_person(sim, cid, body)
    if not made and eff.get("skill") is not None and cid != me_id:
        c.skills[sport] = float(eff["skill"])
    if eff.get("popularity") and cid != me_id:
        c.popularity = max(c.popularity, float(eff["popularity"]))
    if r["grade_now"] and c.role == "student" and c.grade != r["grade_now"] and 9 <= r["grade_now"] <= 12 and cid != me_id:
        c.grade = r["grade_now"]
    key = f"{r['team']}:{r['year']}"
    ros = store(w).setdefault(key, {"players": {}, "captains": [], "only": False})
    ros["players"][cid] = r["level"]
    if pl.get("captain") and cid not in ros["captains"]:
        ros["captains"].append(cid)
    return f"{c.name}: {r['says']} ({r['section']}){' · new' if made else ''}"


def _settle_team(sim, gid, year, ros, now_year, me_id):
    """A roster for this school year whose team is picked now: on (or off) it at the level, captains named. A finished
    season (its yearbook roster): the listed players are on it."""
    from .history import Effects
    w = sim.w
    g = w.groups[gid]
    players = {cid: lvl for cid, lvl in ros["players"].items() if cid in w.chars}
    if year == now_year and g.get("members"):
        levels = g.setdefault("levels", {})
        for cid, lvl in players.items():
            c = w.chars[cid]
            if c.role != "student" or c.status != "active":
                continue
            if lvl == "out":
                if gid in c.memberships:
                    Effects(w, None).leave(cid, gid, "roster sheet")
                    levels.pop(cid, None)
                continue
            if gid not in c.memberships:
                Effects(w, None).join(cid, gid, "roster sheet")
                from . import sports
                sports.ensure_athlete(c, g["skill"], random.Random(f"{cid}:{gid}"))
            levels[cid] = lvl
        if ros.get("only"):
            for cid in list(g["members"]):
                if cid not in players and cid != me_id:
                    Effects(w, None).leave(cid, gid, "roster sheet")
                    levels.pop(cid, None)
        caps = [x for x in ros.get("captains") or [] if x in g["members"]]
        if caps:
            g["leaders"] = caps
    else:
        hist = next((h for h in g.get("history") or [] if h.get("year") == year), None)
        if hist is not None:
            roster = list(hist.get("roster") or [])
            lv = hist.setdefault("levels", {})
            for cid, lvl in players.items():
                if lvl == "out":
                    if cid in roster:
                        roster.remove(cid)
                    continue
                if cid not in roster:
                    roster.append(cid)
                lv[cid] = lvl
            if ros.get("only"):
                roster = [x for x in roster if x in players or x == me_id]
            hist["roster"] = roster
            if ros.get("captains"):
                hist["captains"] = list(ros["captains"])


def _staff_spec(sim, name, role_label, note, coach=False) -> dict:
    title, first, last = _split_name(name)
    if not last:
        raise ValueError("needs a last name (like Mr. Haddad or Tom Bryant)")
    gender = _gender_for(sim, first, title)
    if not first:
        rng = random.Random(f"{sim.w.gen_seed}:staff:{last}")
        names = sim.cat.people["names"]["female" if gender == "f" else "male"]
        first = rng.choice(names)
    if not title:
        title = "Coach" if coach else ("Mr." if gender == "m" else "Ms.")
    spec = {"role": "staff", "first": first, "last": last, "gender": gender, "title": title, "role_label": role_label[:60]}
    eff = _notes_effects(note)
    if eff["traits"]:
        spec["traits"] = dict(eff["traits"])
    if note:
        spec["bio"] = note[:480]
    return spec


def _apply_staff_style(c, note):
    eff = _notes_effects(note)
    for k in ("traits", "aptitudes"):
        for t, v in eff[k].items():
            getattr(c, k)[t] = float(v)
    if eff.get("favors"):
        c.flags["favors"] = eff["favors"]
    if note:
        c.bio = note[:480]


def _put_coach(sim, r) -> str:
    from . import editor
    w = sim.w
    g = w.groups[r["team"]]
    team = _team_label(w, r["team"])
    role = r["role"]
    note = r.get("note") or ""
    if not r["id"]:
        r["id"] = find(sim, r["name"], staff=True)[0]  # (an earlier line may have made or renamed them)
    if r["status"] == "rename" and not r["id"]:
        c = w.chars[g["staff"]]
        title, first, last = _split_name(r["name"])
        old = c.name
        c.title = title or "Coach"
        if first:
            c.first = first
        c.last = last or c.last
        if title in TITLE_GENDER:
            c.gender = TITLE_GENDER[title]
        _apply_staff_style(c, note)
        return f"{old} is now {c.name}, head coach of {team}"
    if r["id"]:
        c = w.chars[r["id"]]
        title, first, last = _split_name(r["name"])
        if first and c.first != first:
            c.first = first  # (the sheet knows their real first name)
    else:
        label = f"{team} coach" if r["head"] else f"{team} {role}" if not re.search(r"\bcoach\b", role, re.I) else f"{role[:1].upper() + role[1:]} ({team})"
        c = editor.make_person(sim, _staff_spec(sim, r["name"], label, note, coach=True))
    _apply_staff_style(c, note)
    if r["head"]:
        old = g.get("staff")
        g["staff"] = c.id
        if c.id in (g.get("assistants") or []):
            g["assistants"].remove(c.id)
        relabel(w, c.id)
        if old and old != c.id:
            relabel(w, old)  # (the coach who had this team: their job now)
        return f"{c.name}: head coach of {team}"
    if c.id not in (g.get("assistants") or []):
        g.setdefault("assistants", []).append(c.id)
    c.flags["coach_role_" + r["team"]] = role
    relabel(w, c.id)
    return f"{c.name}: {role} for {team}"


def relabel(w, cid) -> None:
    """A coach's job, from the teams they coach: 'Football & baseball coach', 'JV football coach', or a teacher's job plus it."""
    c = w.chars.get(cid)
    if c is None or c.role != "staff":
        return
    teams = [g for g in sorted(w.groups.values(), key=lambda g: g["id"]) if g.get("kind") == "team" and g.get("school", "hchs") == "hchs"]
    word = lambda g: _team_label(w, g["id"]).lower()  # noqa: E731
    heads = [word(g) for g in teams if g.get("staff") == cid]
    jv = [word(g) for g in teams if cid in (g.get("assistants") or []) and cid != g.get("staff")
          and re.search(r"\bjv\b|junior varsity|freshman", c.flags.get("coach_role_" + g["id"], "jv") or "", re.I)]
    asst = [word(g) for g in teams if cid in (g.get("assistants") or []) and cid != g.get("staff") and word(g) not in jv]
    bits = []
    if heads:
        bits.append(" & ".join(heads) + " coach")
    if jv:
        bits.append("JV " + " & ".join(jv) + " coach")
    if asst:
        bits.append(" & ".join(asst) + " assistant coach")
    if not bits:
        return
    job = " · ".join(bits)
    job = job[:1].upper() + job[1:]
    lab = c.role_label or ""
    if not lab or lab in ("Teacher", "Staff") or re.search(r"coach", lab, re.I):
        c.role_label = job[:60]
    elif job.lower() not in lab.lower():
        c.role_label = f"{lab} · {job[:1].lower() + job[1:]}"[:80]


def _put_staff(sim, r) -> str:
    from . import classes, editor
    w = sim.w
    note = r.get("note") or ""
    if r["kind"] == "teacher":
        label = (f"{r['classes'][0].replace('Honors ', '').replace('AP ', '')} teacher" if r["classes"] else (r["role"] or "Teacher"))
    else:
        label = r["role"] or "Staff"
    if not r["id"]:
        r["id"] = find(sim, r["name"], staff=True)[0]
    if r["id"]:
        c = w.chars[r["id"]]
        title, first, last = _split_name(r["name"])
        if first and c.first != first and c.role == "staff":
            c.first = first
        if title and c.title != title:
            c.title = title
        if r["kind"] == "staff" or not c.role_label or c.role_label in ("Teacher", "Staff"):
            c.role_label = label
        _apply_staff_style(c, note)
    else:
        c = editor.make_person(sim, _staff_spec(sim, r["name"], label, note))
    bits = []
    if r.get("classes"):
        t = w.meta.setdefault("teachers", {})
        for name in r["classes"]:
            t[name] = c.id
        classes.retag(sim)
        bits.append(", ".join(r["classes"]))
    if r.get("club"):
        w.groups[r["club"]]["staff"] = c.id
        bits.append(f"advises {w.groups[r['club']]['name']}")
    return f"{c.name}: {' · '.join(bits) or c.role_label}"


def replay(sim, sheets: list) -> dict:
    """Start over: the sheets again, in order, each for the school year it was written in."""
    done, skipped = 0, []
    for s in sheets or []:
        r = apply(sim, s.get("text") or "", base=s.get("year"), record=False)
        done += len(r["done"])
        skipped += r["skipped"]
    return {"done": done, "skipped": skipped}


# ------------------------------------------------------------------------------------------------ the ChatGPT prompt
def prompt(sim, ask: str = "") -> str:
    from . import classes
    w = sim.w
    me = w.chars.get(w.meta.get("protagonist") or "")
    y0 = calm.START.year + calm.school_year_of(w.day)
    L = []
    A = L.append
    A("I'm building the real rosters, coaches and teachers for my high school life sim. Turn my notes (at the bottom) into a "
      "roster sheet in exactly the format below. Output only the sheet, in one code block. Don't invent people I didn't mention; if "
      "I didn't say something (a number, a position), leave it out.")
    A("")
    A("FORMAT")
    A("A header line for each team and school year:   -- <Team> <school year>")
    A("  Teams: Football, Boys Soccer, Girls Soccer, Boys Basketball, Girls Basketball, Baseball, Softball")
    A(f"  School years look like {y0}-{str(y0 + 1)[2:]}. Add (only these) to the header when the list is the whole roster.")
    A("Under a team header, one line per person:")
    A("  coach: <name> | head coach | <what they're like as a coach>")
    A("  coach: <name> | <assistant, JV coach, pitching coach, defensive coordinator...> | <what they're like>")
    A("  player: <first last> | <freshman/sophomore/junior/senior THAT year> | <position> | #<number> | varsity or JV | captain | <what they're like, how good>")
    A("  (captain only if they were one; leave out anything I didn't say)")
    A("Teachers and other staff go under one header:   -- Teachers")
    A("  teacher: <Mr./Ms./Mrs./Dr. Last, or First Last> | <the classes they taught, comma separated> | advisor: <club> | <what they're like>")
    A("  staff: <name> | <their job: Principal, Vice principal, Guidance counselor, Athletic director, Nurse...> | <what they're like>")
    A("")
    A("Positions: Football QB RB WR TE OL DL LB DB K · Basketball PG SG SF PF C · Baseball/Softball P C 1B 2B SS 3B OF · Soccer GK CB FB CM WM ST")
    A("Words the game reads in the notes (use them when they fit): how good: the star, starter, solid, backup. Who they are: leader, quiet, "
      "shy, loud, funny, cocky, nice, hard worker, lazy, smart, competitive, hothead, loyal, popular, party, fast, confident. Coaches: "
      "old-school, strict, players' coach, laid back, wins at all costs, plays seniors, plays favorites, plays young guys.")
    A("Class names the game knows (use these exact names): " + ", ".join(_class_names()) + ".")
    clubs = [g["name"] for g in w.groups.values() if g.get("kind") in ("club", "council", "production")]
    if clubs:
        A("Clubs: " + ", ".join(sorted(clubs)) + ".")
    A("")
    A("EXAMPLE")
    A("```")
    A(f"-- Football {y0}-{str(y0 + 1)[2:]}")
    A("coach: Tom Bryant | head coach | old-school, loud, plays seniors")
    A("coach: Dave Grant | JV coach | laid back")
    A("player: Arjun Winslow | senior | RB | #22 | varsity | captain | the star, quiet leader, fast")
    A("player: Mike Knapp | junior | LB | #44 | varsity | starter, hothead")
    A("-- Teachers")
    A("teacher: Mr. Haddad | Honors English 9, English 10 | advisor: The Grizzly Gazette | dry humor, tough grader")
    A("staff: Dr. Alvarez | Principal | strict but fair")
    A("```")
    A("")
    A("WHO'S IN MY GAME NOW (when it's the same person, spell the name exactly like this)")
    if me is not None:
        A(f"Me: {me.name}, {calm_year(me.grade) if me.grade and me.grade <= 12 else 'graduated'} in {y0}-{str(y0 + 1)[2:]}.")
        fam = [w.chars[x] for x in sim.siblings(me.id) if x in w.chars]
        if fam:
            A("My siblings: " + ", ".join(f"{c.name} ({calm_year(c.grade) if c.grade and c.grade <= 12 else 'graduated'})" for c in fam) + ".")
    for g in sorted((g for g in w.groups.values() if g.get("kind") == "team" and g.get("school", "hchs") == "hchs"), key=lambda g: g["id"]):
        coach = w.chars.get(g.get("staff") or "")
        asst = [w.chars[a].name for a in g.get("assistants") or [] if a in w.chars]
        hist = (g.get("history") or [None])[-1]
        mem = g.get("members") or (hist or {}).get("roster") or []
        names = ", ".join(w.chars[m].name for m in mem if m in w.chars)
        A(f"{g['name'].replace('Guilford ', '')}: coach {coach.name if coach else 'none'}"
          + (f", assistants {', '.join(asst)}" if asst else "") + (f". Players: {names}" if names else "") + ".")
    staff = sorted((c for c in w.chars.values() if c.role == "staff" and c.status == "active" and "recruit" not in (c.role_label or "").lower()
                    and "university" not in (c.role_label or "").lower()), key=lambda c: c.last)
    if staff:
        A("Teachers and staff: " + "; ".join(f"{c.name} ({c.role_label})" for c in staff) + ".")
    if me is not None and me.grade and me.grade <= 12:
        A("My classes this year: " + "; ".join(f"{x['name']} ({x['teacher']})" for x in classes.schedule(sim, me)) + ".")
    studs = sorted((c for c in w.chars.values() if c.role == "student" and c.status == "active" and c.school == (me.school if me else "hchs")),
                   key=lambda c: (-(c.grade or 0), c.last))
    if studs:
        A("Everyone at school: " + "; ".join(f"{c.name} ({calm_year(c.grade)})" for c in studs) + ".")
    A("")
    A("MY NOTES")
    A(ask.strip() or "(I'll paste my notes here: teams, years, who played what, coaches, teachers.)")
    return "\n".join(L)


def overview(sim) -> dict:
    """For the phone: each team's coaches and this year's roster as set, the teachers, and the sheets put in."""
    from . import groundwork
    w = sim.w
    now = calm.school_year_of(w.day)
    teams = []
    for g in sorted((g for g in w.groups.values() if g.get("kind") == "team" and g.get("school", "hchs") == "hchs"), key=lambda g: g["id"]):
        coach = w.chars.get(g.get("staff") or "")
        ros = pinned(w, g["id"], now) or {}
        teams.append({"id": g["id"], "name": _team_label(w, g["id"]), "coach": coach.name if coach else None,
                      "assistants": [w.chars[a].name for a in g.get("assistants") or [] if a in w.chars],
                      "set": len(ros.get("players") or {}), "only": bool(ros.get("only")),
                      "years": sorted(int(k.rsplit(":", 1)[1]) for k in store(w) if k.startswith(g["id"] + ":"))})
    teachers = {}
    for cls, cid in (w.meta.get("teachers") or {}).items():
        if cid in w.chars:
            teachers.setdefault(w.chars[cid].name, []).append(cls)
    sheets = [{"day": s.get("day"), "date": calm.label(s.get("day", 0)), "lines": sum(1 for x in (s.get("text") or "").splitlines() if ":" in x)}
              for s in groundwork.get(w).get("sheets") or []]
    return {"teams": teams, "teachers": [{"name": k, "classes": v} for k, v in sorted(teachers.items())], "sheets": sheets,
            "year": f"{calm.START.year + now}-{str(calm.START.year + now + 1)[2:]}"}
