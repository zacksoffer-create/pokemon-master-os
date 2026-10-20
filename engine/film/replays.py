"""Finding and fetching Showdown replays (docs/FILM.md).

`search` pages through Showdown's public replay search (newest first). `collect` keeps paging until it has enough
replays that pass the filters: a format, a player, a ladder rating floor, tournament games only. `fetch` returns one
replay and caches it under data/raw/showdown_replays exactly as Showdown sent it, so a study can be re-run without
the network and a replay later made private is still the one that was read.
"""
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)


class Unreachable(Exception):
    """The replay server didn't answer (the network settings, or the server itself)."""


def load_config(path=None):
    with open(path or os.path.join(HERE, "config.json"), encoding="utf-8") as fh:
        return json.load(fh)


def player_id(name):
    """Showdown's id for a name: 'Mr_D15951' → 'mrd15951'."""
    return re.sub(r"[^a-z0-9]", "", str(name or "").lower())


def _get(cfg, url):
    src = cfg["sources"]
    req = urllib.request.Request(url, headers={"User-Agent": src["user_agent"]})
    try:
        with urllib.request.urlopen(req, timeout=src["timeout_seconds"]) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise Unreachable(f"replay.pokemonshowdown.com answered {e.code} for {url}") from None
    except (urllib.error.URLError, OSError) as e:
        raise Unreachable(f"can't reach replay.pokemonshowdown.com ({getattr(e, 'reason', e)}): allow it in the "
                          "environment's network settings") from None


def search(cfg, fmt=None, user=None, before=None):
    q = {k: v for k, v in (("format", fmt), ("user", player_id(user) if user else None), ("before", before)) if v}
    return _get(cfg, cfg["sources"]["search"] + "?" + urllib.parse.urlencode(q)) or []


def passes(entry, cfg, min_rating=None, tournaments=False):
    tour = entry["id"].startswith(cfg["sources"]["tournament_prefix"])
    if tournaments and not tour:
        return False
    if min_rating and not tour and (entry.get("rating") or 0) < min_rating:
        return False
    return not entry.get("private") and not entry.get("password")


def collect(cfg, fmt=None, user=None, count=30, min_rating=None, tournaments=False, pages=None):
    """Search entries (newest first) until `count` pass the filters, or the pages run out."""
    out, before, seen = [], None, set()
    for _ in range(pages or cfg["sources"]["max_pages"]):
        page = search(cfg, fmt, user, before)
        if not page:
            break
        for e in page:
            if e["id"] not in seen and passes(e, cfg, min_rating, tournaments):
                seen.add(e["id"])
                out.append(e)
                if len(out) >= count:
                    return out
        if len(page) < 51:
            break
        before = page[-1]["uploadtime"]
        time.sleep(cfg["sources"]["pause_seconds"])
    return out


def cache_path(cfg, rid, base=ENGINE):
    return os.path.join(base, cfg["store"]["raw"], f"{re.sub(r'[^A-Za-z0-9_-]', '', rid)}.json")


def fetch(cfg, rid, base=ENGINE, refresh=False):
    """One replay ({id, format, players, log, uploadtime, rating, …}), from the cache when it's there."""
    path = cache_path(cfg, rid, base)
    if os.path.exists(path) and not refresh:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    rec = _get(cfg, cfg["sources"]["replay"].format(id=rid))
    if rec is None:
        return None
    rec = {k: v for k, v in rec.items() if k not in ("password",)}
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, ensure_ascii=False)
    time.sleep(cfg["sources"]["pause_seconds"])
    return rec


def url_of(rid):
    return f"https://replay.pokemonshowdown.com/{rid}"
