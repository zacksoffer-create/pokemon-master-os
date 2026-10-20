"""The film room in words (docs/FILM.md): a box score for one battle, a scouting read for a study."""


def _list(rows, key="name", n=None, fmt="{name} {n}"):
    rows = rows[:n] if n else rows
    return ", ".join(fmt.format(**r) if key == "name" else fmt.format(**r) for r in rows) or "—"


def _set_line(v):
    out = ", ".join(v["moves"]) or "no moves seen"
    if v.get("item"):
        out += f" @ {v['item']}"
    if v.get("ability"):
        out += f" ({v['ability']})"
    return out


def render_box(b):
    """One battle: the teams in the order they came in, every member's revealed build, and how it went."""
    p = b["sides"]
    win, lose = ("p1", "p2") if b["winner"] == "p1" else ("p2", "p1")
    rate = lambda s: f" ({p[s]['rating']})" if p[s]["rating"] else ""
    head = (f"{b['meta'].get('id')} · {p[win]['player']}{rate(win)} beat {p[lose]['player']}{rate(lose)} in "
            f"{b['turns']} turns" + (" (forfeit)" if b["forfeit"] else "")) if b["winner"] else \
        f"{b['meta'].get('id')} · {p['p1']['player']} vs {p['p2']['player']}, {b['turns']} turns, no result"
    lines = [head, f"  {b['meta'].get('url', '')}"]
    for sid in ("p1", "p2"):
        s = p[sid]
        lines.append(f"\n{s['player']}: " + " → ".join(s["order"]) + (f" (+{s['unseen']} never seen)" if s["unseen"] else ""))
        for m in s["members"]:
            item = f" @ {m['item']}" + (f" ({m['item_how']})" if m["item_how"] and m["item_how"] != "seen" else "") if m["item"] else ""
            ab = f" [{m['ability']}]" if m["ability"] else ""
            uses = ", ".join(f"{mv} ×{m['uses'][mv]}" if m["uses"].get(mv, 0) > 1 else mv for mv in m["moves"]) or "no moves"
            fate = f"fell turn {m['fainted_turn']} to {m['fainted_by']}" if m["fainted_turn"] is not None else "standing at the end"
            kos = f"; KOs: {', '.join(k['target'] for k in m['kos'])}" if m["kos"] else ""
            ins = " / ".join(f"{st['in']} T{st['in_turn']}: {' → '.join(st['moves']) or '—'}" for st in m["stints"])
            lines.append(f"  {m['order']}. {m['species']}{item}{ab}: {uses}. {fate}{kos}")
            lines.append(f"       stints: {ins}")
    flips, last = [], {}
    for r in b["rows"]:
        st = r["before"]["state"]
        if last.get(r["side"]) not in (None, st):
            flips.append(f"T{r['turn']} {p[r['side']]['player']} {last[r['side']]} → {st}")
        last[r["side"]] = st
    kos = [f"T{r['turn']} {r['actor']} {r['move']} KO {r['result']['ko']} ({r['before']['state']})" for r in b["rows"]
           if r["kind"] == "move" and r["result"].get("ko")]
    lines.append("\nKnockouts: " + ("; ".join(kos) or "none"))
    lines.append("Game state changes: " + ("; ".join(flips[:16]) or "none"))
    return "\n".join(lines)


def render_study(r):
    who = f"{r['who']}" if r["who"] else "the field"
    span = f", {r['dates'][0]} to {r['dates'][1]}" if r["dates"] else ""
    rate = f", ladder ratings {r['ratings'][0]}–{r['ratings'][1]}" if r["ratings"] else ""
    tour = f", {r['tournament_games']} Smogon tournament games" if r["tournament_games"] else ""
    lines = [f"{r['label'].upper()} · {who} · {r['battles']} battles{rate}{tour}{span}"]
    if r["who"]:
        lines.append(f"Record {r['wins']}-{r['sides'] - r['wins']} ({r['win_rate']}%)."
                     + (f" Most faced: {_list(r['faced'], n=6)}." if r.get("faced") else ""))
    lines.append("\nWHO PLAYS (on team · win% · leads · average slot · held back · closes · KOs a battle)")
    for u in r["usage"][:14]:
        lines.append(f"  {u['species']:<16} {u['battles']:>3} ({u['share']}%) · {u['win_rate']}% · lead {u['lead']} · "
                     f"slot {u['avg_position']} · back {u['held_back']} · closes {u['closer']} · {u['kos_per_battle']}")
    lines.append("\nLEADS (and what they do first)")
    for l in r["leads"][:8]:
        lines.append(f"  {l['species']} {l['n']} ({l['share']}%, wins {l['win_rate']}%): first {_list(l['first_move'])}"
                     + (f" · opening {l['opening'][0]['name']}" if l["opening"] else ""))
    o = r["order"]
    lines.append("\nORDER")
    lines.append(f"  held back (first in after half the battle): {_list(o['held_back'], n=6)}")
    lines.append(f"  closers (the last knockout): " + (", ".join(
        f"{c['name']} {c['n']} ({_list(c['with'])})" for c in o["closers"][:6]) or "—"))
    lines.append(f"  still standing at the end: {_list(o['standing'], n=6)}")
    lines.append(f"  sent in last (teams fully seen): {_list(o['last_in'], n=6)}")
    lines.append("\nMOVE ORDER (first move each time it comes in)")
    for sp, mv in list(r["move_order"].items())[:10]:
        if mv:
            lines.append(f"  {sp}: {_list(mv)}")
    lines.append("\nBUILDS (revealed sets, clustered into variants by what they share; each read through the role engine)")
    for c in r["sets"][:12]:
        lines.append(f"  {c['species']} ({c['battles']} battles" + (f", {c['unread']} too little seen" if c.get("unread") else "") + ")")
        for v in c.get("variants", [])[:3]:
            lines.append(f"    {v['name']} ×{v['battles']} (wins {v['win_rate']}%): {_set_line(v)}"
                         + (f"; also {', '.join(v['also'])}" if v["also"] else ""))
        if c.get("closest"):
            lines.append(f"    top variant vs the library: {c['closest']}")
    lines.append("\nGAME STATE (what gets chosen)")
    for st, s in r["states"].items():
        mix = ", ".join(f"{g} {p}%" for g, p in list(s["mix"].items())[:6])
        plays = ", ".join(f"{p['pokemon']} {p['move']} in {p['battles']} battles ×{p['n']}" + (f", {p['kos']} KO" if p["kos"] else "")
                          for p in s["top_plays"][:4])
        lines.append(f"  {st}: {s['chosen']} choices · switch {s['switch_rate']}% · aggression {s['aggression']}%")
        lines.append(f"     {mix}")
        lines.append(f"     top plays: {plays or '—'}")
    a = r["aggression"]
    lines.append(f"\nAGGRESSION {a['ratio']}% of finishing-or-wearing choices finish ({a['finishers']} vs {a['attrition']}). "
                 f"Finish with {_list(a['top_finishers'])}; wear down with {_list(a['top_attrition'])}.")
    pr = r["pressure"]
    lines.append("\nUNDER PRESSURE")
    lines.append("  after a faint, in comes: " + (", ".join(
        f"{x['species']} {x['n']} (opens {_list(x['first_move'])})" for x in pr["after_faint"][:6]) or "—"))
    for foe, into in list(pr["switch_into"].items())[:8]:
        lines.append(f"  facing {foe}, switch to {_list(into)}")
    t = r["teams"]
    lines.append("\nTEAMS")
    lines.append("  cores: " + (", ".join(f"{' + '.join(c['pair'])} {c['n']} ({c['win_rate']}%)" for c in r["cores"][:8]) or "—"))
    lines.append("  combos: " + (", ".join(f"{c['name']} {c['n']} ({c['win_rate']}%)" for c in t["combos"]) or "—"))
    lines.append(f"  roles: {_list(t['roles'], n=10)}")
    lines.append(f"  team shapes: {_list(t['shapes'], n=4)}")
    h = r["habits"]
    lines.append("\nHABITS")
    lines.append(f"  first hazard: turn {h['first_hazard_turn']} on average, set in {h['hazards_set_share']}% of battles. "
                 f"Self-KOs by state: {h['self_ko_by_state'] or 'none'}. Forfeits: {h['forfeits']}.")
    if r["who"]:
        lines.append("\nGAMES")
        for g in r["games"][:20]:
            lines.append(f"  {g['date']} {'W' if g['won'] else 'L'} vs {g['opponent']} ({g['turns']} turns"
                         + (", forfeit" if g["forfeit"] else "") + f"): {' → '.join(g['order'])}  {g['url']}")
    return "\n".join(lines)
