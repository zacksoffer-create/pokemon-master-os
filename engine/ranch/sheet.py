"""The Canon DB Sheet (docs/BLACKTHORN.md, D-025): data_manifest/blackthorn.json laid out as a Google Sheet.

The engine never talks to Google itself. This file turns the export into a list of plain API calls (Sheets
`values.update` and `batchUpdate` bodies) written to data_manifest/sheet/, one JSON file per call, in order. The
session that has the Sheets connector sends them. Rebuilding is safe: every call overwrites what it writes.

Tabs: Blackthorn (the dashboard) · Journey · Residents · Facilities · Glasshouse · Breeding Program · Studbook ·
Pedigrees · Fathers · Your Calls · Decisions · Evidence · Locks · World · Reference (hidden) · Setup.

    python3 -I ranch/sheet.py            # writes the calls; prints how many and how big
"""
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
sys.path.insert(0, ENGINE)
SRC = os.path.join(ENGINE, "data_manifest", "blackthorn.json")
OUT = os.path.join(ENGINE, "data_manifest", "sheet")

# --- the look ---------------------------------------------------------------------------------------------------
INK, DRAGON, ICE, FROST, PAPER = "1B2230", "4C3F91", "DCEEF5", "F3F7FB", "FFFFFF"
EMBER, MOSS, GOLD, SLATE, MIST, MUTED = "C8553D", "3F7D52", "B8860B", "5B6577", "E8ECF2", "6B7280"
TAB = {"Blackthorn": INK, "Journey": DRAGON, "Residents": MOSS, "Facilities": MOSS, "Glasshouse": EMBER,
       "Breeding Program": EMBER, "Studbook": DRAGON, "Pedigrees": DRAGON, "Fathers": DRAGON, "Your Calls": GOLD,
       "Decisions": SLATE, "Evidence": SLATE, "Locks": GOLD, "World": SLATE, "Reference": MUTED, "Setup": MUTED}
BODY, TITLE_FONT = "Lexend", "Montserrat"
SHEET_IDS = {name: i for i, name in enumerate(TAB)}


def rgb(h):
    return {"red": round(int(h[0:2], 16) / 255, 3), "green": round(int(h[2:4], 16) / 255, 3),
            "blue": round(int(h[4:6], 16) / 255, 3)}


def rng(sid, r0, r1, c0, c1):
    return {"sheetId": sid, "startRowIndex": r0, "endRowIndex": r1, "startColumnIndex": c0, "endColumnIndex": c1}


def fmt(sid, r0, r1, c0, c1, bg=None, fg=None, bold=None, size=None, font=None, italic=None, h=None, v=None,
        wrap=None, number=None):
    f, fields, tf = {}, [], {}
    if bg:
        f["backgroundColorStyle"] = {"rgbColor": rgb(bg)}
        fields.append("backgroundColorStyle")
    for k, val in (("foregroundColorStyle", {"rgbColor": rgb(fg)} if fg else None), ("bold", bold),
                   ("fontSize", size), ("fontFamily", font), ("italic", italic)):
        if val is not None:
            tf[k] = val
            fields.append(f"textFormat.{k}")
    if tf:
        f["textFormat"] = tf
    for k, val in (("horizontalAlignment", h), ("verticalAlignment", v), ("wrapStrategy", wrap)):
        if val:
            f[k] = val
            fields.append(k)
    if number:
        f["numberFormat"] = number
        fields.append("numberFormat")
    return {"repeatCell": {"range": rng(sid, r0, r1, c0, c1), "cell": {"userEnteredFormat": f},
                           "fields": ",".join(f"userEnteredFormat.{x}" for x in fields)}}


def merge(sid, r0, r1, c0, c1):
    return {"mergeCells": {"range": rng(sid, r0, r1, c0, c1), "mergeType": "MERGE_ALL"}}


def widths(sid, ws, start=0):
    return [{"updateDimensionProperties": {"range": {"sheetId": sid, "dimension": "COLUMNS", "startIndex": start + i,
                                                       "endIndex": start + i + 1},
                                             "properties": {"pixelSize": w}, "fields": "pixelSize"}}
            for i, w in enumerate(ws)]


def heights(sid, r0, r1, px):
    return {"updateDimensionProperties": {"range": {"sheetId": sid, "dimension": "ROWS", "startIndex": r0, "endIndex": r1},
                                          "properties": {"pixelSize": px}, "fields": "pixelSize"}}


def border(sid, r0, r1, c0, c1, color=MIST, outer=True, inner=False, bottom_only=False, width=1):
    b = {"style": "SOLID", "width": width, "colorStyle": {"rgbColor": rgb(color)}}
    req = {"range": rng(sid, r0, r1, c0, c1)}
    if bottom_only:
        req["bottom"] = b
    else:
        if outer:
            req.update(top=b, bottom=b, left=b, right=b)
        if inner:
            req.update(innerHorizontal=b, innerVertical=b)
    return {"updateBorders": req}


def banding(sid, r0, r1, c0, c1, bid):
    return {"addBanding": {"bandedRange": {"bandedRangeId": bid, "range": rng(sid, r0, r1, c0, c1), "rowProperties": {
        "headerColorStyle": {"rgbColor": rgb(DRAGON)}, "firstBandColorStyle": {"rgbColor": rgb(PAPER)},
        "secondBandColorStyle": {"rgbColor": rgb(FROST)}}}}}


def chip(sid, r0, r1, c0, c1, text, fg, bg=None, bold=True, how="TEXT_CONTAINS"):
    f = {"textFormat": {"foregroundColorStyle": {"rgbColor": rgb(fg)}, "bold": bold}}
    if bg:
        f["backgroundColorStyle"] = {"rgbColor": rgb(bg)}
    cond = {"type": how, "values": [{"userEnteredValue": text}]} if how != "CUSTOM_FORMULA" else \
        {"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": text}]}
    return {"addConditionalFormatRule": {"rule": {"ranges": [rng(sid, r0, r1, c0, c1)],
                                                  "booleanRule": {"condition": cond, "format": f}}, "index": 0}}


def dropdown(sid, r0, r1, c, options=None, source=None, strict=False):
    cond = ({"type": "ONE_OF_LIST", "values": [{"userEnteredValue": o} for o in options]} if options else
            {"type": "ONE_OF_RANGE", "values": [{"userEnteredValue": source}]})
    return {"setDataValidation": {"range": rng(sid, r0, r1, c, c + 1),
                                  "rule": {"condition": cond, "strict": strict, "showCustomUi": True}}}


def img(url):
    return f'=IMAGE("{url}", 1)' if url else ""


def col(n):
    s = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def names_of(who):
    """'Arcanine (cartridge: Intimidate (overworld ability))' → 'Arcanine'."""
    return [w.split(" (")[0] for w in who]


# --- a standard data tab ---------------------------------------------------------------------------------------
class Tab:
    def __init__(self, name, title, subtitle):
        self.name, self.sid = name, SHEET_IDS[name]
        self.title, self.subtitle = title, subtitle
        self.blocks = []            # (start_row, rows) value blocks, A1-indexed rows
        self.requests = []
        self.rows_used = 4
        self.cols_used = 1

    def write(self, row, rows, col0=0):
        self.blocks.append((row, col0, rows))
        self.rows_used = max(self.rows_used, row + len(rows))
        self.cols_used = max(self.cols_used, col0 + max((len(r) for r in rows), default=0))

    def table(self, top, headers, rows, ws=None, wrap=(), image_col=None, bid=None, col0=0, row_px=None):
        """Headers on row `top` (0-indexed), data below; banding, fonts, widths."""
        sid = self.sid
        n = len(headers)
        self.write(top, [headers] + rows, col0)
        end = top + 1 + len(rows)
        self.requests += [
            banding(sid, top, end, col0, col0 + n, bid if bid is not None else sid * 10 + len(self.requests) % 9),
            fmt(sid, top, top + 1, col0, col0 + n, fg=PAPER, bold=True, font=TITLE_FONT, size=10, v="MIDDLE",
                wrap="WRAP"),
            fmt(sid, top + 1, end, col0, col0 + n, font=BODY, size=10, v="MIDDLE", fg=INK),
            heights(sid, top, top + 1, 34)]
        for c in wrap:
            self.requests.append(fmt(sid, top + 1, end, col0 + c, col0 + c + 1, wrap="WRAP"))
        if ws:
            self.requests += widths(sid, ws, col0)
        if image_col is not None:
            self.requests += [heights(sid, top + 1, end, row_px or 56),
                              fmt(sid, top + 1, end, col0 + image_col, col0 + image_col + 1, h="CENTER")]
        elif row_px:
            self.requests.append(heights(sid, top + 1, end, row_px))
        return top + 1, end

    def finish(self):
        sid, w = self.sid, max(self.cols_used, 2)
        head = [
            merge(sid, 0, 1, 0, w), merge(sid, 1, 2, 0, w),
            fmt(sid, 0, 1, 0, w, bg=INK, fg=PAPER, bold=True, size=18, font=TITLE_FONT, v="MIDDLE"),
            fmt(sid, 1, 2, 0, w, bg=INK, fg=ICE, italic=True, size=10, font=BODY, v="MIDDLE", wrap="WRAP"),
            heights(sid, 0, 1, 48), heights(sid, 1, 2, 30), heights(sid, 2, 3, 10)]
        self.write(0, [[self.title], [self.subtitle]])
        return head + self.requests

    def value_calls(self, chunk=60):
        """The tab's values as a few big blocks: every write laid on one grid, sent in runs of non-empty rows."""
        cells = {}
        for row, c0, rows in self.blocks:
            for i, r in enumerate(rows):
                for j, v in enumerate(r):
                    if v != "" or (row + i, c0 + j) not in cells:
                        cells[(row + i, c0 + j)] = v
        filled = sorted({r for (r, _), v in cells.items() if v != ""})
        calls, runs = [], []
        for r in filled:
            if runs and r - runs[-1][-1] <= 2 and r - runs[-1][0] < chunk:
                runs[-1].append(r)
            else:
                runs.append([r])
        for run in runs:
            r0, r1 = run[0], run[-1]
            cs = [c for (r, c), v in cells.items() if r0 <= r <= r1 and v != ""]
            c0, c1 = min(cs), max(cs)
            grid = [[cells.get((r, c), "") for c in range(c0, c1 + 1)] for r in range(r0, r1 + 1)]
            a1 = f"'{self.name}'!{col(c0)}{r0 + 1}:{col(c1)}{r1 + 1}"
            calls.append({"tool": "update_values", "range": a1, "values": grid})
        return calls


# --- the tabs ----------------------------------------------------------------------------------------------------
def journey_tab(d):
    t = Tab("Journey", "The Journey", "Six chapters of one life, each answering \"what does mastery mean?\" differently. "
            "Every companion, with the build on record. The journey is over; they're all retired (D-042).")
    roles = {r["companion"]: r for r in d["breeding_roles"]}
    with open(os.path.join(ENGINE, "canon", "builds.json"), encoding="utf-8") as fh:
        builds = json.load(fh)
    rows = []
    for ch in d["chapters"]:
        for m in ch["roster"]:
            b = builds.get(ch["game"], {}).get(m["species"], {})
            key = f"{ch['game']}:{m['species']}"
            rows.append([img(m["sprite"]), ch["name"], m["species"],
                         "🔒 locked" if ch["locked"] else ch["status"], " / ".join(b.get("moves", [])) or "—",
                         b.get("item") or "", b.get("nature") or b.get("nature_note") or "", b.get("ability") or "",
                         b.get("status") or "no build on record", ", ".join(roles.get(key, {}).get("roles", [])),
                         f"{ch['thesis']}: {ch['line']}"])
    top, end = t.table(3, ["", "Chapter", "Companion", "Status", "Moves", "Item", "Nature", "Ability", "Build on record",
                           "Breeding roles", "The chapter's mastery"], rows,
                       ws=[64, 100, 110, 100, 300, 110, 110, 110, 180, 200, 280], wrap=(4, 8, 9, 10), image_col=0)
    t.requests += [chip(t.sid, top, end, 3, 4, "locked", GOLD), chip(t.sid, top, end, 3, 4, "provisional", EMBER),
                   {"setBasicFilter": {"filter": {"range": rng(t.sid, 3, end, 0, 11)}}}]
    return t


def residents_tab(d):
    t = Tab("Residents", "Residents", "Everyone who could live at the ranch: the 36 companions (fates stay open, D-037) "
            "and the 9 studs the program keeps (D-038). Land, size, climate and water come from the Pokédex habitat.")
    rows = [[img(r["sprite"]), r["species"], r["chapter"], r["kind"], r["site"], r["land"], r["size"], r["climate"],
             r["water"], r["native"], ", ".join(r["egg_groups"]), ", ".join(r["breeding_roles"]),
             "; ".join(r["jobs"]), r["fate"], r["id"]] for r in d["residents"]]
    top, end = t.table(3, ["", "Species", "Chapter", "Kind", "Lives at", "Primary land", "Size", "Climate", "Water",
                           "Native to", "Egg groups (nursery pens)", "Breeding roles", "Jobs the games back",
                           "Fate", "id"], rows,
                       ws=[64, 110, 100, 90, 190, 120, 80, 80, 70, 90, 160, 200, 360, 110, 150], wrap=(10, 11, 12),
                       image_col=0, row_px=60)
    t.requests += [chip(t.sid, top, end, 4, 5, "satellite", EMBER), chip(t.sid, top, end, 3, 4, "stud", DRAGON),
                   {"setBasicFilter": {"filter": {"range": rng(t.sid, 3, end, 0, 15)}}}]
    return t


def facilities_tab(d):
    t = Tab("Facilities", "Facilities & Staff", "Staff are Pokémon and people (D-039). A Pokémon holds a job only on "
            "evidence: a field move or ability from the games, or a world record you approved. Lore alone is a story "
            "candidate. Only the Day-Care preserve is open (D-040).")
    rows = []
    for f in d["facilities"]:
        for job, who in f["staffed"].items():
            one = job in f["hangs_on_one"]
            rows.append([f["name"], f["access"], job, ", ".join(sorted(set(names_of(who)))),
                         "hangs on one" if one else "covered", "; ".join(who),
                         ", ".join(names_of(f["story_candidates"].get(job, []))), ", ".join(f["people"])])
        for job in f["open_jobs"]:
            rows.append([f["name"], f["access"], job, "— nobody yet", "open", "", ", ".join(
                names_of(f["story_candidates"].get(job, []))), ", ".join(f["people"])])
    top, end = t.table(3, ["Facility", "Access", "Job", "Who holds it", "Cover", "Evidence", "Story candidates",
                           "People roles (to author)"], rows,
                       ws=[180, 120, 150, 260, 110, 420, 260, 180], wrap=(3, 5, 6, 7), row_px=44)
    t.requests += [chip(t.sid, top, end, 4, 5, "open", PAPER, EMBER), chip(t.sid, top, end, 4, 5, "hangs on one", EMBER),
                   chip(t.sid, top, end, 4, 5, "covered", MOSS), chip(t.sid, top, end, 1, 2, "open", GOLD),
                   {"setBasicFilter": {"filter": {"range": rng(t.sid, 3, end, 0, 8)}}}]
    return t


def glasshouse_tab(d):
    g = d["glasshouse"]
    t = Tab("Glasshouse", "The Glasshouse", "The hatchery and greenhouse in one building at Blackthorn (D-045). A "
            "Magcargo hearth heats the egg racks; the greenhouse rings live on the same heat; the egg walk is the "
            "harvest walk. One lap of the hatching loop = one egg cycle (255 steps); Magma Armor halves it.")
    rooms = []
    for name, r in g["rooms"].items():
        for job, who in r["pokemon"].items():
            rooms.append([name, job.replace("_", " "), ", ".join(sorted(set(names_of(who)))),
                          "hangs on one" if job in r["single_species"] else "covered"])
        for job in r["open_jobs"]:
            rooms.append([name, job.replace("_", " "), "— story only (needs a world record)", "open"])
    top, end = t.table(3, ["Room", "Job", "Who holds it", "Cover"], rooms, ws=[160, 150, 320, 110], wrap=(2,), bid=40)
    t.requests += [chip(t.sid, top, end, 3, 4, "open", PAPER, EMBER), chip(t.sid, top, end, 3, 4, "hangs on one", EMBER),
                   chip(t.sid, top, end, 3, 4, "covered", MOSS)]
    eggs = []
    for e in g["eggs"]:
        url = next((r["sprite"] for r in d["lineage"] if r.get("hatched_as") == e["line"]), None)
        eggs.append([img(url), e["line"], e["cycles"], e["steps"], e["laps"], e["laps_with_flame_body"]])
    a, b = t.table(3, ["", "Egg schedule: stud line", "Egg cycles", "Steps", "Laps", "Laps with Magcargo", "Laps (bar)"],
                   [r + [f'=SPARKLINE(J{5 + i},{{"charttype","bar";"max",40;"color1","#{EMBER}"}})']
                    for i, r in enumerate(eggs)], ws=[64, 150, 90, 90, 70, 130, 200], image_col=0, bid=41, col0=5)
    t.requests += widths(t.sid, [24], 4) + [fmt(t.sid, a, b, 7, 11, h="CENTER")]
    ctop = max(end, b) + 2
    t.write(ctop - 1, [["THE CROP PLAN · medicine for the clinic and nursery, and every berry a canon build holds "
                        "(up to 5 per plant)"]])
    t.requests.append(fmt(t.sid, ctop - 1, ctop, 0, 6, fg=DRAGON, bold=True, font=TITLE_FONT, size=11))
    crops = [[c["berry"], c["hours_to_harvest"], c["why"], c["watering"]] for c in g["crops"]]
    a2, b2 = t.table(ctop, ["Berry", "Hours to harvest", "Why", "Watering"], crops, bid=42)
    t.requests.append(fmt(t.sid, a2, b2, 1, 2, h="CENTER"))
    return t


def program_tab(d):
    t = Tab("Breeding Program", "The Breeding Program", "Build the lineage, keep only the final product (D-038): one "
            "stud per target line, a male who knows the whole egg-move set, so every future egg of the line is one "
            "step. The fathers used along the way go home. Status is yours to move.")
    rows = []
    for i, p in enumerate(d["program"]):
        r = 4 + 1 + i
        chain = " → ".join(p["fathers_used"] + ["stud"]) if p["fathers_used"] else "no father: a Light Ball on a parent"
        rows.append([img(p["sprite"]), p["target"], ", ".join(p["egg_moves"]), chain, p["hatches_as"] or "Pichu",
                     p["kept"], p["steps"], p["stud_id"] or "", p["status"], 0,
                     f'=SPARKLINE(J{r}/MAX(1,G{r}),{{"charttype","bar";"max",1;"color1","#{MOSS}";"color2","#{MIST}"}})',
                     "; ".join(p["timing"]) or "", p["source"]])
    top, end = t.table(3, ["", "Target", "Egg moves", "The chain (oldest father first)", "Hatches as", "Kept",
                           "Crosses", "Stud id", "Status", "Crosses done", "Progress", "Timing", "Source"], rows,
                       ws=[64, 160, 170, 260, 100, 240, 70, 150, 110, 90, 140, 220, 220], wrap=(2, 3, 5, 11, 12),
                       image_col=0)
    t.requests += [dropdown(t.sid, top, end, 8, ["planned", "in progress", "done", "on hold"]),
                   chip(t.sid, top, end, 8, 9, "done", MOSS), chip(t.sid, top, end, 8, 9, "in progress", EMBER),
                   fmt(t.sid, top, end, 6, 7, h="CENTER"), fmt(t.sid, top, end, 9, 10, h="CENTER", bg=ICE)]
    return t


def studbook_tab(d):
    t = Tab("Studbook", "The Studbook", "Every individual and where it came from: sire, dam, generation, the moves that "
            "came down and from whom, and what became of it. Planned rows follow from canon (D-038); a row you add "
            "or change is authored. Rule check: Gen 4 breeding (Blackthorn menu → Check the studbook).")
    rows = []
    by = {r["id"]: r for r in d["lineage"]}
    for r in d["lineage"]:
        inh = "; ".join(f"{x['move']} (from {by.get(x['from'], {}).get('name', x['from'])})" for x in r["inherited"] or [])
        sex = {"male": "♂ male", "female": "♀ female", "genderless": "genderless"}.get(r["sex"], r["sex"] or "open")
        rows.append([r["id"], img(r["sprite"]), r["name"], r["species"], r.get("hatched_as") or "", sex,
                     r["generation"] if r["generation"] is not None else "", r["sire"] or "", r["dam"] or "",
                     ", ".join(r["moves"] or []), inh, r["role"], r["origin"], r["fate"], r["status"],
                     r["program"] or "", r["check"], r["note"] or ""])
    top, end = t.table(3, ["id", "", "Name", "Species", "Hatched as", "Sex", "Gen", "Sire", "Dam", "Moves", "Inherited",
                           "Role", "Origin", "Fate", "Status", "Program", "Rule check", "Note"], rows,
                       ws=[190, 64, 230, 100, 90, 90, 50, 190, 190, 220, 260, 100, 170, 200, 90, 160, 120, 320],
                       wrap=(2, 9, 10, 12, 13, 17), image_col=1)
    n = 300
    t.requests += [
        dropdown(t.sid, top, n, 5, ["♂ male", "♀ female", "genderless", "open"]),
        dropdown(t.sid, top, n, 7, source=f"='Studbook'!$A${top + 1}:$A${n}"),
        dropdown(t.sid, top, n, 8, source=f"='Studbook'!$A${top + 1}:$A${n}"),
        dropdown(t.sid, top, n, 3, source="='Reference'!$A$2:$A$494"),
        dropdown(t.sid, top, n, 14, ["planned", "hatched", "kept", "home", "recorded", "working", "locked"]),
        chip(t.sid, top, end, 16, 17, "ok", MOSS, how="TEXT_EQ"),
        chip(t.sid, top, n, 16, 17, f'=AND(LEN(Q{top + 1})>0,Q{top + 1}<>"ok")', PAPER, EMBER, how="CUSTOM_FORMULA"),
        chip(t.sid, top, end, 11, 12, "stud", DRAGON, how="TEXT_EQ"),
        chip(t.sid, top, end, 5, 6, "♂", "2B5DA8", bold=False), chip(t.sid, top, end, 5, 6, "♀", "B23A6F", bold=False),
        fmt(t.sid, top, n, 0, 1, font="Roboto Mono", size=9, fg=SLATE), fmt(t.sid, top, n, 6, 7, h="CENTER"),
        fmt(t.sid, top, n, 7, 9, font="Roboto Mono", size=9, fg=SLATE),
        {"setBasicFilter": {"filter": {"range": rng(t.sid, 3, end, 0, 18)}}}]
    return t


def pedigrees_tab(d):
    t = Tab("Pedigrees", "Pedigrees", "Each stud's tree, three generations: the stud, his sire and dam, their sires and "
            "dams. Fathers used go home after (D-038); line females stay. For any individual's tree, Blackthorn menu → "
            "Show the lineage tree.")
    by = {r["id"]: r for r in d["lineage"]}

    def label(r):
        if not r:
            return "—"
        sex = {"male": "♂", "female": "♀"}.get(r["sex"], "")
        mv = ", ".join(r["moves"] or [])
        return f"{r['name']} {sex}".strip() + (f"\n{mv}" if mv else "") + f"\n{r['fate']}"
    sid = t.sid
    t.requests += widths(sid, [64, 240, 24, 64, 240, 24, 64, 240])
    row = 3
    for p in d["program"]:
        stud = by.get(p["stud_id"])
        if not stud:
            continue
        sire, dam = by.get(stud["sire"]), by.get(stud["dam"])
        g = [by.get(sire["sire"]) if sire else None, by.get(sire["dam"]) if sire else None,
             by.get(dam["sire"]) if dam else None, by.get(dam["dam"]) if dam else None]
        t.write(row, [[f"{p['target'].upper()} · {', '.join(p['egg_moves'])}"]])
        t.requests += [fmt(sid, row, row + 1, 0, 8, fg=DRAGON, bold=True, font=TITLE_FONT, size=11)]
        r0 = row + 1
        block = [[img(stud["sprite"]), label(stud), "", img(sire["sprite"]) if sire else "", label(sire), "",
                  img(g[0]["sprite"]) if g[0] else "", label(g[0])],
                 ["", "", "", "", "", "", img(g[1]["sprite"]) if g[1] else "", label(g[1])],
                 ["", "", "", img(dam["sprite"]) if dam else "", label(dam), "", img(g[2]["sprite"]) if g[2] else "",
                  label(g[2])],
                 ["", "", "", "", "", "", img(g[3]["sprite"]) if g[3] else "", label(g[3])]]
        t.write(r0, block)
        t.requests += [merge(sid, r0, r0 + 4, 0, 1), merge(sid, r0, r0 + 4, 1, 2),
                       merge(sid, r0, r0 + 2, 3, 4), merge(sid, r0, r0 + 2, 4, 5),
                       merge(sid, r0 + 2, r0 + 4, 3, 4), merge(sid, r0 + 2, r0 + 4, 4, 5),
                       heights(sid, r0, r0 + 4, 58),
                       fmt(sid, r0, r0 + 4, 1, 2, bg=ICE, bold=True, size=10), fmt(sid, r0, r0 + 4, 4, 5, bg=FROST),
                       border(sid, r0, r0 + 4, 0, 2, color=DRAGON, width=2),
                       border(sid, r0 + 3, r0 + 4, 3, 8, color=MIST, bottom_only=True)]
        row = r0 + 5
    t.requests.insert(0, fmt(sid, 4, row, 0, 8, font=BODY, size=9, v="MIDDLE", wrap="WRAP", fg=INK))
    t.rows_used = max(t.rows_used, row)
    return t


def fathers_tab(d):
    t = Tab("Fathers", "Fathers & the Tinkering Menu", "Who in the journey can father what (notable egg moves only: a "
            "60+ power attack, priority, or a strategic tool), and for each companion whose build has no egg move yet, "
            "what its line could be bred with. Gen 4 rules, Gen 3 moves by Pal Park (D-044).")
    lead = [[f["father"], f["moves"], f["lines"]] for f in d["fathers"]]
    top, end = t.table(3, ["Father", "Moves he can pass", "Lines he reaches"], lead, ws=[150, 130, 130], bid=80)
    t.requests.append(fmt(t.sid, top, end, 1, 3, h="CENTER"))
    rows = []
    for r in d["breeding_roles"]:
        game, sp = r["companion"].split(":")
        fathers = "; ".join(f"{line}: {', '.join(mv)}" for line, mv in sorted(r["as_father"].items()))
        menu = "; ".join(f"{mv} ({', '.join(fs) if fs else 'a father from outside the journey'})"
                         for mv, fs in (r.get("tinker_menu") or {}).items())
        bred = "; ".join(f"{mv} from {', '.join(fs) or 'outside the journey'}" for mv, fs in r["bred_moves"].items())
        rows.append([f"{game.title().replace('Heartgold', 'HeartGold').replace('Soulsilver', 'SoulSilver').replace('Firered', 'FireRed')} {sp}",
                     ", ".join(r["roles"]), bred, fathers, menu])
    t.write(3, [["Companion", "Roles", "Bred with (egg-only moves on its build)", "Can father (line: moves)",
                 "The tinkering menu (move: journey fathers who can give it)"]] + rows, 4)
    end2 = 4 + len(rows)
    t.requests += [banding(t.sid, 3, end2, 4, 9, 81),
                   fmt(t.sid, 3, 4, 4, 9, fg=PAPER, bold=True, font=TITLE_FONT, size=10, wrap="WRAP", v="MIDDLE"),
                   fmt(t.sid, 4, end2, 4, 9, font=BODY, size=10, v="MIDDLE", wrap="WRAP", fg=INK),
                   heights(t.sid, 4, end2, 64)] + widths(t.sid, [24, 160, 200, 230, 360, 420], 3)
    t.cols_used = 9
    t.rows_used = max(t.rows_used, end2)
    return t


def calls_tab(d):
    t = Tab("Your Calls", "Your Calls", "What the ranch, the breeding lab and the chapters are waiting on. Write your "
            "answer in \"Your call\" and set the status; Claude turns an answered call into a decision (a D- number) "
            "and nothing changes until then.")
    rows = [[q["id"], q["area"], q["question"], q["why"], "\n".join(f"• {o}" for o in q["options"]), q["blocks"],
             q["source"], "", "open"] for q in d["questions"]]
    top, end = t.table(3, ["id", "Area", "Question", "Why it matters", "Options", "Blocks", "Source", "Your call",
                           "Status"], rows, ws=[110, 90, 300, 360, 300, 200, 160, 260, 100], wrap=(2, 3, 4, 5, 6, 7),
                       row_px=90)
    t.requests += [dropdown(t.sid, top, end + 30, 8, ["open", "answered", "decided", "deferred"]),
                   chip(t.sid, top, end + 30, 8, 9, "open", PAPER, EMBER, how="TEXT_EQ"),
                   chip(t.sid, top, end + 30, 8, 9, "decided", MOSS, how="TEXT_EQ"),
                   fmt(t.sid, top, end, 7, 8, bg="FFF8E1"), fmt(t.sid, top, end, 2, 3, bold=True)]
    return t


def decisions_tab(d):
    t = Tab("Decisions", "The Decision Ledger", "Append-only (D-025): every canon change cites one. Newest last. The "
            "full ledger with history lives in docs/DECISION_LEDGER.md.")
    rows = [[x["id"], x["date"], x["title"], x["area"], x["status"], x["who"],
             x["text"] if len(x["text"]) <= 420 else x["text"][:417].rsplit(" ", 1)[0] + " …"] for x in d["decisions"]]
    top, end = t.table(3, ["id", "Date", "Decision", "Area", "Status", "Who", "In full"], rows,
                       ws=[70, 90, 320, 140, 150, 160, 640], wrap=(2, 4, 5, 6), row_px=80)
    t.requests += [chip(t.sid, top, end, 4, 5, "LOCKED", GOLD), chip(t.sid, top, end, 4, 5, "OPEN", EMBER),
                   chip(t.sid, top, end, 4, 5, "WORKING", DRAGON), fmt(t.sid, top, end, 6, 7, size=9, fg=SLATE),
                   {"setBasicFilter": {"filter": {"range": rng(t.sid, 3, end, 0, 7)}}}]
    return t


def evidence_tab(d):
    t = Tab("Evidence", "Evidence", "Mechanical facts, each verified against a source. Facts, not decisions.")
    rows = [[e["id"], e["text"], e["status"]] for e in d["evidence"]]
    t.table(3, ["id", "Finding", "Verified"], rows, ws=[70, 900, 260], wrap=(1, 2), row_px=70)
    return t


def locks_tab(d):
    t = Tab("Locks", "Locks", "Locked entities refuse changes unless a reopen decision exists (APP_PRODUCT_SPEC §6). "
            "The Apps Script guard warns on any edit to a locked row.")
    rows = [[x["what"], x["detail"], x["decision"], x["rule"]] for x in d["locks"]]
    top, end = t.table(3, ["What", "Detail", "Decision", "Rule"], rows, ws=[420, 300, 90, 320], wrap=(0, 1, 3), row_px=50)
    t.requests.append(fmt(t.sid, top, top + 1, 0, 4, bg="FFF4D6", bold=True))
    return t


def world_tab(d):
    t = Tab("World", "The Authored World", "World records: life roles mapped to capabilities, each with its source. "
            "Approved ones staff the ranch; proposed ones wait for you.")
    rows = [[w["id"], w["species"], w["game"], w["capability"].replace("_", " "), w["statement"], w["source"],
             w["status"], w.get("decision") or ""] for w in d["world"]]
    top, end = t.table(3, ["id", "Species", "Game", "Capability", "Statement", "Source", "Status", "Decision"], rows,
                       ws=[70, 100, 90, 140, 360, 360, 90, 80], wrap=(4, 5), row_px=56)
    t.requests += [chip(t.sid, top, end, 6, 7, "proposed", PAPER, EMBER, how="TEXT_EQ"),
                   chip(t.sid, top, end, 6, 7, "approved", MOSS, how="TEXT_EQ")]
    return t


def reference_tab():
    """Every species of Gens 1-4: dex number, egg groups, gender rate and what its eggs hatch as. The Apps Script
    checks a recorded hatch against it."""
    from breeding.lineage import Lineage
    from ranch.planner import EGG_GROUP_NAMES
    lin = Lineage(os.path.join(ENGINE, "data", "pokeref.sqlite"))
    ref = lin.ref
    rows = []
    for sid in range(1, 494):
        name = ref.name(sid)
        rows.append([name, sid, ", ".join(EGG_GROUP_NAMES.get(g, g) for g in lin.groups(name)) or "No Eggs",
                     ref.gender_rate(sid), lin.hatches_as(name)])
    t = Tab("Reference", "Reference (for the Apps Script)", "Species of Gens 1-4: egg groups, gender rate in eighths "
            "female (-1 genderless, 0 male only, 8 female only), and what an egg from its line hatches as. Derived "
            "from PokeAPI; never hand-edited.")
    t.blocks = []
    t.write(0, [["species", "dex", "line's egg groups", "gender rate", "hatches as"]] + rows)
    t.requests += [fmt(t.sid, 0, 1, 0, 5, bold=True, bg=MIST)]
    t.finish = lambda: t.requests
    return t


def setup_tab(d):
    t = Tab("Setup", "How this Sheet works", "Read once. Two minutes to install the Blackthorn menu.")
    lines = [
        ["THE LAYERS"],
        ["Derived (rebuilt by the engine, never hand-edited): the census, the Glasshouse numbers, the planned "
         "pedigree, the sire web, the reference data."],
        ["Authored (yours): sexes, names, hatches that happened, fates, your calls. Add or change a Studbook row and "
         "it's authored; Claude carries it into canon/lineage.json after you say so."],
        ["Locked: HeartGold's six (D-006) and every LOCKED decision. The script warns on any edit to them."],
        [""],
        ["FIRST TIME: LET THE SPRITES IN"],
        ["Every sprite is an IMAGE() from PokeAPI's sprite archive. Google won't fetch outside images until the owner "
         "allows it once: open the Sheet in a desktop browser, click any sprite cell that shows #REF!, and choose "
         "\"Allow access\". Every sprite in every tab loads after that."],
        [""],
        ["INSTALL THE BLACKTHORN MENU (once)"],
        ["1. Extensions → Apps Script. 2. Delete what's in Code.gs and paste the contents of Code.gs from the "
         "Engine/appscript folder in Drive. 3. File + → HTML, name it Tree, paste Tree.html; do the same for Hatch.html. "
         "4. Save, close the tab, reload this Sheet. 5. Blackthorn menu → any item; approve the permissions once."],
        [""],
        ["THE MENU"],
        ["Go to the dashboard · Show the lineage tree (for the selected Studbook row) · Record a hatch (a form that "
         "checks the cross before it adds the row) · Check the studbook (sexes, egg groups, generations, loops) · "
         "About this Sheet. The dashboard's numbers are live formulas; they update on their own."],
        [""],
        ["WHERE IT COMES FROM"],
        [f"Built {d['built']} from data_manifest/blackthorn.json (engine/ranch/dashboard.py) by engine/ranch/sheet.py. "
         "Rebuild after canon changes; the rebuild overwrites derived tabs and keeps your Your Calls answers only if "
         "you've told Claude to carry them over first."],
    ]
    t.write(3, lines)
    sid = t.sid
    t.requests += widths(sid, [900]) + [fmt(sid, 3, 3 + len(lines), 0, 1, font=BODY, size=11, wrap="WRAP", fg=INK)]
    for i, l in enumerate(lines):
        if l[0] and l[0].split(" (")[0].isupper():
            t.requests.append(fmt(sid, 3 + i, 4 + i, 0, 1, bold=True, fg=DRAGON, font=TITLE_FONT, size=12))
    return t


# --- the dashboard ---------------------------------------------------------------------------------------------------
def dashboard_tab(d):
    t = Tab("Blackthorn", "BLACKTHORN", "")
    sid, k = t.sid, d["kpis"]
    W = 18                                   # A margin, B..Q content (16), R margin
    t.requests += widths(sid, [18] + [64] * 16 + [18])
    t.cols_used = W
    rows = {}

    def put(r, c, v):
        rows.setdefault(r, {})[c] = v

    # banner
    put(0, 1, "BLACKTHORN")
    put(1, 1, f"The Champion's Ranch · Blackthorn highlands, Johto · the journey is over; the breeding goes on · "
              f"built {d['built']}")
    t.requests += [merge(sid, 0, 1, 1, 17), merge(sid, 1, 2, 1, 17), fmt(sid, 0, 3, 0, W, bg=INK),
                   fmt(sid, 0, 1, 1, 17, fg=PAPER, bold=True, size=30, font=TITLE_FONT, v="MIDDLE"),
                   fmt(sid, 1, 2, 1, 17, fg=ICE, italic=True, size=11, font=BODY, v="TOP"),
                   heights(sid, 0, 1, 64), heights(sid, 1, 2, 28), heights(sid, 2, 3, 10), heights(sid, 3, 4, 14)]
    # KPI tiles: label / number / caption, two columns each
    lin_end = 4 + len(d["lineage"])
    tiles = [
        ("RESIDENTS", "=COUNTA(Residents!B5:B)", "companions and studs"),
        ("AT BLACKTHORN", '=COUNTIF(Residents!E5:E,"Blackthorn*")', "the rest at one satellite"),
        ("BREEDING LINES", "=COUNTA('Breeding Program'!B5:B)", "9 studs and a Light Ball"),
        ("STUDBOOK", "=COUNTA(Studbook!A5:A)", "individuals on record"),
        ("GENERATIONS", "=MAX(Studbook!G5:G)+1", "founders are generation 0"),
        ("RULE ISSUES", '=COUNTIFS(Studbook!Q5:Q,"<>ok",Studbook!Q5:Q,"<>")', "Gen 4 breeding rules"),
        ("OPEN JOBS", '=COUNTIF(Facilities!E5:E,"open")+COUNTIF(Glasshouse!D5:D,"open")', "jobs nobody holds yet"),
        ("YOUR CALLS", "=COUNTIF('Your Calls'!I5:I,\"open\")", "questions waiting on you"),
    ]
    for i, (label, formula, cap) in enumerate(tiles):
        c = 1 + 2 * i
        put(4, c, label)
        put(5, c, formula)
        put(6, c, cap)
        bg = ICE if i % 2 == 0 else FROST
        t.requests += [merge(sid, 4, 5, c, c + 2), merge(sid, 5, 6, c, c + 2), merge(sid, 6, 7, c, c + 2),
                       fmt(sid, 4, 7, c, c + 2, bg=bg, h="CENTER", font=BODY),
                       border(sid, 4, 7, c, c + 2, color=PAPER, width=2)]
    t.requests += [fmt(sid, 4, 5, 1, 17, fg=SLATE, bold=True, size=8, v="BOTTOM"),
                   fmt(sid, 5, 6, 1, 17, fg=DRAGON, bold=True, size=24, font=TITLE_FONT, v="MIDDLE"),
                   fmt(sid, 6, 7, 1, 17, fg=MUTED, size=8, v="TOP", wrap="WRAP"),
                   chip(sid, 5, 6, 11, 13, "=$L$6>0", EMBER, how="CUSTOM_FORMULA"),
                   chip(sid, 5, 6, 13, 15, "=$N$6>0", EMBER, how="CUSTOM_FORMULA"),
                   heights(sid, 4, 5, 22), heights(sid, 5, 6, 46), heights(sid, 6, 7, 30)]

    def section(r, text):
        put(r, 1, text)
        t.requests.extend([merge(sid, r, r + 1, 1, 17), fmt(sid, r, r + 1, 1, 17, fg=DRAGON, bold=True, size=12,
                                                            font=TITLE_FONT, v="BOTTOM"),
                           border(sid, r, r + 1, 1, 17, color=DRAGON, bottom_only=True, width=2),
                           heights(sid, r, r + 1, 34)])

    # the journey
    r = 8
    section(r, "THE JOURNEY · six chapters, one life · all retired now")
    r += 1
    for ch in d["chapters"]:
        put(r, 1, ch["name"])
        put(r, 3, ch["line"])
        for j, m in enumerate(ch["roster"]):
            put(r, 7 + j, img(m["sprite"]))
        put(r, 13, "🔒 locked" if ch["locked"] else ch["status"])
        put(r, 15, f"{ch['thesis']} · {ch['decision'] or ''}")
        t.requests += [merge(sid, r, r + 1, 1, 3), merge(sid, r, r + 1, 3, 7), merge(sid, r, r + 1, 13, 15),
                       merge(sid, r, r + 1, 15, 17), heights(sid, r, r + 1, 60)]
        r += 1
    t.requests += [fmt(sid, 9, r, 1, 17, font=BODY, size=10, v="MIDDLE", fg=INK),
                   fmt(sid, 9, r, 1, 3, bold=True, size=12, font=TITLE_FONT),
                   fmt(sid, 9, r, 3, 7, italic=True, fg=SLATE, wrap="WRAP"),
                   fmt(sid, 9, r, 7, 13, h="CENTER"), fmt(sid, 9, r, 13, 15, h="CENTER", bold=True),
                   fmt(sid, 9, r, 15, 17, size=8, fg=MUTED, wrap="WRAP"),
                   chip(sid, 9, r, 13, 15, "locked", GOLD), chip(sid, 9, r, 13, 15, "provisional", EMBER),
                   border(sid, 9, r, 1, 17, color=MIST, outer=True), banding(sid, 9, r, 1, 17, 900)]
    # wipe the banding header colour: the journey band has no header row
    t.requests[-1]["addBanding"]["bandedRange"]["rowProperties"].pop("headerColorStyle")
    # the breeding program
    r += 1
    section(r, "THE BREEDING PROGRAM · build the lineage, keep the stud (D-038)")
    r += 1
    head = r
    for c, h in ((1, ""), (2, "Target"), (4, "Egg moves"), (7, "The chain"), (11, "Hatches as"), (12, "Kept"),
                 (15, "Crosses"), (16, "Status")):
        put(r, c, h)
    t.requests += [merge(sid, r, r + 1, 2, 4), merge(sid, r, r + 1, 4, 7), merge(sid, r, r + 1, 7, 11),
                   merge(sid, r, r + 1, 12, 15),
                   fmt(sid, r, r + 1, 1, 17, fg=SLATE, bold=True, size=8, font=BODY, v="BOTTOM")]
    r += 1
    for i, p in enumerate(d["program"]):
        src = 5 + i
        put(r, 1, img(p["sprite"]))
        put(r, 2, p["target"])
        put(r, 4, ", ".join(p["egg_moves"]))
        put(r, 7, " → ".join(p["fathers_used"] + ["stud"]) if p["fathers_used"] else "a Light Ball on a parent")
        put(r, 11, p["hatches_as"] or "Pichu")
        put(r, 12, p["kept"])
        put(r, 15, p["steps"])
        put(r, 16, f"='Breeding Program'!I{src}")
        t.requests += [merge(sid, r, r + 1, 2, 4), merge(sid, r, r + 1, 4, 7), merge(sid, r, r + 1, 7, 11),
                       merge(sid, r, r + 1, 12, 15), heights(sid, r, r + 1, 48)]
        r += 1
    t.requests += [fmt(sid, head + 1, r, 1, 17, font=BODY, size=9, v="MIDDLE", fg=INK, wrap="WRAP"),
                   fmt(sid, head + 1, r, 2, 4, bold=True, size=10), fmt(sid, head + 1, r, 1, 2, h="CENTER"),
                   fmt(sid, head + 1, r, 15, 16, h="CENTER"),
                   chip(sid, head + 1, r, 16, 17, "done", MOSS), chip(sid, head + 1, r, 16, 17, "progress", EMBER),
                   border(sid, head + 1, r, 1, 17, color=MIST, inner=False),
                   banding(sid, head + 1, r, 1, 17, 901)]
    t.requests[-1]["addBanding"]["bandedRange"]["rowProperties"].pop("headerColorStyle")
    # the ranch: facilities
    r += 1
    section(r, "THE RANCH · facilities and who runs them (D-039, D-040)")
    r += 1
    head = r
    for c, h in ((1, "Facility"), (4, "Access"), (6, "Who holds its jobs"), (11, "Open"), (13, "Hangs on one")):
        put(r, c, h)
    t.requests += [merge(sid, r, r + 1, 1, 4), merge(sid, r, r + 1, 4, 6), merge(sid, r, r + 1, 6, 11),
                   merge(sid, r, r + 1, 11, 13), merge(sid, r, r + 1, 13, 17),
                   fmt(sid, r, r + 1, 1, 17, fg=SLATE, bold=True, size=8, font=BODY, v="BOTTOM")]
    r += 1
    for f in d["facilities"]:
        who = sorted({n for w in f["staffed"].values() for n in names_of(w)})
        put(r, 1, f["name"].capitalize())
        put(r, 4, f["access"])
        put(r, 6, ", ".join(who[:10]) + (f" +{len(who) - 10} more" if len(who) > 10 else ""))
        put(r, 11, ", ".join(f["open_jobs"]) or "—")
        put(r, 13, "; ".join(f"{names_of([w])[0]} ({j})" for j, w in f["hangs_on_one"].items()) or "—")
        t.requests += [merge(sid, r, r + 1, 1, 4), merge(sid, r, r + 1, 4, 6), merge(sid, r, r + 1, 6, 11),
                       merge(sid, r, r + 1, 11, 13), merge(sid, r, r + 1, 13, 17), heights(sid, r, r + 1, 42)]
        r += 1
    t.requests += [fmt(sid, head + 1, r, 1, 17, font=BODY, size=9, v="MIDDLE", fg=INK, wrap="WRAP"),
                   fmt(sid, head + 1, r, 1, 4, bold=True, size=10),
                   chip(sid, head + 1, r, 11, 13, '=$L' + str(head + 2) + '<>"—"', EMBER, how="CUSTOM_FORMULA"),
                   chip(sid, head + 1, r, 4, 6, "open", GOLD),
                   banding(sid, head + 1, r, 1, 17, 902)]
    t.requests[-1]["addBanding"]["bandedRange"]["rowProperties"].pop("headerColorStyle")
    # the Glasshouse: egg laps + crops side by side
    r += 1
    section(r, "THE GLASSHOUSE · one lap of the hatching loop = one egg cycle; Magcargo's Magma Armor halves it")
    r += 1
    head = r
    for c, h in ((1, ""), (2, "Line"), (4, "Laps"), (5, "w/ Magcargo"), (6, ""), (10, "Berry"), (12, "Why"),
                 (15, "Hours"), (16, "Water")):
        put(r, c, h)
    t.requests += [merge(sid, r, r + 1, 2, 4), merge(sid, r, r + 1, 6, 9), merge(sid, r, r + 1, 10, 12),
                   merge(sid, r, r + 1, 12, 15),
                   fmt(sid, r, r + 1, 1, 17, fg=SLATE, bold=True, size=8, font=BODY, v="BOTTOM")]
    r += 1
    eggs, crops = d["glasshouse"]["eggs"], d["glasshouse"]["crops"]
    for i in range(max(len(eggs), len(crops))):
        if i < len(eggs):
            e = eggs[i]
            url = next((x["sprite"] for x in d["lineage"] if x.get("hatched_as") == e["line"]), None)
            put(r, 1, img(url))
            put(r, 2, e["line"])
            put(r, 4, e["laps"])
            put(r, 5, e["laps_with_flame_body"])
            put(r, 6, f'=SPARKLINE({{{e["laps_with_flame_body"]},{e["laps"] - e["laps_with_flame_body"]}}},'
                      f'{{"charttype","bar";"max",40;"color1","#{EMBER}";"color2","#{ICE}"}})')
            t.requests += [merge(sid, r, r + 1, 2, 4), merge(sid, r, r + 1, 6, 9)]
        if i < len(crops):
            c = crops[i]
            put(r, 10, c["berry"])
            put(r, 12, c["why"])
            put(r, 15, c["hours_to_harvest"])
            put(r, 16, c["watering"])
            t.requests += [merge(sid, r, r + 1, 10, 12), merge(sid, r, r + 1, 12, 15)]
        t.requests.append(heights(sid, r, r + 1, 40))
        r += 1
    t.requests += [fmt(sid, head + 1, r, 1, 17, font=BODY, size=9, v="MIDDLE", fg=INK),
                   fmt(sid, head + 1, r, 2, 4, bold=True), fmt(sid, head + 1, r, 4, 6, h="CENTER"),
                   fmt(sid, head + 1, r, 10, 12, bold=True), fmt(sid, head + 1, r, 15, 16, h="CENTER"),
                   fmt(sid, head + 1, r, 12, 15, size=8, fg=SLATE, wrap="WRAP")]
    # your calls
    r += 1
    section(r, "YOUR CALLS · what the ranch is waiting on (answer on the Your Calls tab)")
    r += 1
    for i, q in enumerate(d["questions"]):
        src = 5 + i
        put(r, 1, q["id"])
        put(r, 3, q["question"])
        put(r, 11, q["blocks"])
        put(r, 15, f"='Your Calls'!I{src}")
        t.requests += [merge(sid, r, r + 1, 1, 3), merge(sid, r, r + 1, 3, 11), merge(sid, r, r + 1, 11, 15),
                       merge(sid, r, r + 1, 15, 17), heights(sid, r, r + 1, 38)]
        r += 1
    top = r - len(d["questions"])
    t.requests += [fmt(sid, top, r, 1, 17, font=BODY, size=9, v="MIDDLE", fg=INK, wrap="WRAP"),
                   fmt(sid, top, r, 1, 3, font="Roboto Mono", size=8, fg=SLATE),
                   fmt(sid, top, r, 3, 11, bold=True, size=10), fmt(sid, top, r, 11, 15, fg=SLATE),
                   fmt(sid, top, r, 15, 17, h="CENTER", bold=True),
                   chip(sid, top, r, 15, 17, "open", PAPER, EMBER, how="TEXT_EQ"),
                   chip(sid, top, r, 15, 17, "decided", MOSS, how="TEXT_EQ"),
                   banding(sid, top, r, 1, 17, 903)]
    t.requests[-1]["addBanding"]["bandedRange"]["rowProperties"].pop("headerColorStyle")
    # charts: residents by land, nursery pens (source tables in Reference, columns H:I and K:L)
    r += 1
    section(r, "THE LAND AND THE PENS")
    chart_row = r + 1
    t.requests += [heights(sid, chart_row, chart_row + 16, 21)]
    r = chart_row + 16
    put(r, 1, "Derived from canon by engine/ranch/dashboard.py and ranch/sheet.py. Data, not decisions: nothing here "
              "changes canon until you say so.")
    t.requests += [merge(sid, r, r + 1, 1, 17), fmt(sid, r, r + 1, 1, 17, italic=True, size=8, fg=MUTED, font=BODY)]
    t.rows_used = r + 2
    last = max(rows)
    grid = [[rows.get(rr, {}).get(c, "") for c in range(17)] for rr in range(last + 1)]
    for start in range(0, len(grid), 45):
        t.write(start, grid[start:start + 45])
    t.chart_row = chart_row
    t.finish = lambda: t.requests
    return t


def charts(d, dash):
    """Two bar charts on the dashboard, reading small tables kept on the Reference tab."""
    ref_sid, sid = SHEET_IDS["Reference"], SHEET_IDS["Blackthorn"]
    zones = sorted(d["zones"].items(), key=lambda x: -x[1])
    pens = sorted(((g, len(v)) for g, v in d["egg_group_pens"].items()), key=lambda x: -x[1])
    vals = [{"tool": "update_values", "range": f"'Reference'!H1:I{len(zones) + 1}",
             "values": [["Primary land", "Residents"]] + [[z.replace("_", " & "), n] for z, n in zones]},
            {"tool": "update_values", "range": f"'Reference'!K1:L{len(pens) + 1}",
             "values": [["Nursery pen (egg group)", "Species"]] + [[g, n] for g, n in pens]}]

    def bar(title, c0, n, col_anchor, color):
        return {"addChart": {"chart": {"spec": {
            "title": title, "titleTextFormat": {"fontFamily": TITLE_FONT, "bold": True, "fontSize": 11,
                                                "foregroundColorStyle": {"rgbColor": rgb(INK)}},
            "fontName": BODY, "backgroundColorStyle": {"rgbColor": rgb(PAPER)},
            "basicChart": {"chartType": "BAR", "legendPosition": "NO_LEGEND", "headerCount": 1,
                           "axis": [{"position": "BOTTOM_AXIS"}, {"position": "LEFT_AXIS"}],
                           "domains": [{"domain": {"sourceRange": {"sources": [rng(ref_sid, 0, n + 1, c0, c0 + 1)]}}}],
                           "series": [{"series": {"sourceRange": {"sources": [rng(ref_sid, 0, n + 1, c0 + 1, c0 + 2)]}},
                                       "targetAxis": "BOTTOM_AXIS", "colorStyle": {"rgbColor": rgb(color)}}]}},
            "position": {"overlayPosition": {"anchorCell": {"sheetId": sid, "rowIndex": dash.chart_row,
                                                            "columnIndex": col_anchor},
                                             "widthPixels": 500, "heightPixels": 320}}}}}
    reqs = [bar("Residents by primary land", 7, len(zones), 1, MOSS),
            bar("Nursery pens: species per egg group", 10, len(pens), 9, DRAGON)]
    return vals, reqs


def squeeze(reqs):
    """Join row-height requests that touch and match; drop exact duplicates."""
    out, seen = [], set()
    for r in reqs:
        key = json.dumps(r, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        u = r.get("updateDimensionProperties")
        if u and u["range"]["dimension"] == "ROWS" and out:
            p = out[-1].get("updateDimensionProperties")
            if (p and p["range"]["dimension"] == "ROWS" and p["range"]["sheetId"] == u["range"]["sheetId"]
                    and p["properties"] == u["properties"] and p["range"]["endIndex"] == u["range"]["startIndex"]):
                p["range"]["endIndex"] = u["range"]["endIndex"]
                continue
        out.append(r)
    return out


def build(d):
    tabs = [dashboard_tab(d), journey_tab(d), residents_tab(d), facilities_tab(d), glasshouse_tab(d), program_tab(d),
            studbook_tab(d), pedigrees_tab(d), fathers_tab(d), calls_tab(d), decisions_tab(d), evidence_tab(d),
            locks_tab(d), world_tab(d), reference_tab(), setup_tab(d)]
    structure = [{"updateSpreadsheetProperties": {"properties": {"title": "Pokémon Master — Blackthorn Canon DB",
                                                                "timeZone": "America/New_York"},
                                                 "fields": "title,timeZone"}}]
    for i, t in enumerate(tabs):
        rows = {"Reference": 520, "Studbook": 320}.get(t.name, max(t.rows_used + 40, 200))
        cols = max(t.cols_used + 2, 12)
        props = {"sheetId": t.sid, "title": t.name, "index": i,
                 "gridProperties": {"rowCount": rows, "columnCount": cols,
                                    "frozenRowCount": 0 if t.name in ("Blackthorn", "Pedigrees", "Reference", "Setup") else 4,
                                    "hideGridlines": t.name != "Reference"},
                 "tabColorStyle": {"rgbColor": rgb(TAB[t.name])}, "hidden": t.name == "Reference"}
        if t.sid == 0:
            structure.append({"updateSheetProperties": {"properties": props, "fields": "title,index,gridProperties,"
                                                                                    "tabColorStyle,hidden"}})
        else:
            structure.append({"addSheet": {"properties": props}})
    calls = [{"tool": "update_spreadsheet", "requests": structure}]
    fmt_calls = []
    for t in tabs:
        reqs = squeeze(t.finish())
        calls += t.value_calls()
        for i in range(0, len(reqs), 150):
            fmt_calls.append({"tool": "update_spreadsheet", "tab": t.name, "requests": reqs[i:i + 150]})
    vals, chart_reqs = charts(d, tabs[0])
    calls += vals + fmt_calls + [{"tool": "update_spreadsheet", "tab": "Blackthorn", "requests": chart_reqs}]
    return calls


def main():
    with open(SRC, encoding="utf-8") as fh:
        d = json.load(fh)
    calls = build(d)
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    total = 0
    for i, c in enumerate(calls, 1):
        name = f"{i:03d}_{c['tool']}_{(c.get('tab') or c.get('range', 'structure').split('!')[0]).strip(chr(39)).replace(' ', '_')}.json"
        body = json.dumps(c, ensure_ascii=False, separators=(",", ":"))
        total += len(body)
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
            fh.write(body)
    print(f"{len(calls)} calls, {total / 1024:.0f} KB -> {OUT}")


if __name__ == "__main__":
    main()
