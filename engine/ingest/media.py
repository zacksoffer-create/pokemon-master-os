"""The analyzer (docs/INGEST.md): a video, a screenshot or a web page in, an analysis envelope and a card out.

It runs on Google's Gemini API, like Food OS, and writes the same envelope Food OS writes:
    {app, version, lens, extractedAt,
     source: {platform, url, key, creator, handle, media, analysed},
     analysis: {provider, model, machineGenerated, humanVerified, usage},
     result: {summary, transcript, on_screen_text, observations, limitations, <lens block>}}
The core is the same for any project; the lens block is the project's own (here "pokemon": species, behaviors,
habitats, battles, builds, lore, style). A shared intake engine for every project can take this over by adding
lenses. Food OS envelopes (or anything else in this shape) import with `intake.py envelope`.

How each source reaches the model:
- **YouTube:** the link goes to Gemini directly; nothing is downloaded.
- **TikTok, Instagram, other links:** downloaded with yt-dlp, then uploaded (Gemini's Files API above the inline
  limit, inline below it).
- **Video and image files** (a Drive download, a screenshot): uploaded or sent inline.
- **Web pages:** fetched and reduced to text.

Needs a Gemini key (a network secret on the environment, or the GEMINI_API_KEY variable) and the hosts allowed in
its network settings; `intake.py status` says what's missing. Nothing here invents a result: if the model can't be
reached, the command says why and writes nothing.
"""
import base64
import datetime
import html.parser
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

from ingest.cards import digest

GAME_WORDS = {"red": 1, "blue": 1, "yellow": 1, "gold": 2, "silver": 2, "crystal": 2, "ruby": 3, "sapphire": 3,
              "emerald": 3, "firered": 3, "leafgreen": 3, "diamond": 4, "pearl": 4, "platinum": 4, "heartgold": 4,
              "soulsilver": 4, "hgss": 4, "dpp": 4, "black": 5, "white": 5}


class NotReady(RuntimeError):
    """The analyzer can't run here yet (no key, a blocked host, no downloader). The message says what to fix."""


# --- the model ------------------------------------------------------------------------------------------
class Gemini:
    """The key comes one of two ways: a network secret on the environment (the agent proxy adds the
    x-goog-api-key header to requests for generativelanguage.googleapis.com, so the session never sees it), or
    the GEMINI_API_KEY environment variable. With neither, Gemini refuses and the command says how to add one."""

    def __init__(self, cfg):
        self.g = cfg["gemini"]
        self.key = os.environ.get(self.g["key_env"])

    def ready(self):
        return True                                     # a network secret is invisible here; Gemini's answer decides

    def auth(self):
        return {"x-goog-api-key": self.key} if self.key else {}

    def check(self):
        """(ok, message): one cheap call that says whether the key reaches Gemini."""
        try:
            _, raw = self._call(f"{self.g['base']}/models?pageSize=1", self.auth(), None, "GET")
            return True, "Gemini answers (key " + ("from GEMINI_API_KEY" if self.key else "added by the network secret") + ")"
        except NotReady as e:
            return False, str(e)
        except RuntimeError as e:
            return False, str(e)

    def request(self, parts, model=None):
        """The streaming generateContent call: (url, headers, body). Kept separate so it can be checked without a
        call. Streaming keeps a long analysis alive past the network proxy's 30-second limit on silent requests."""
        url = f"{self.g['base']}/models/{model or self.g['model']}:streamGenerateContent?alt=sse"
        headers = {"Content-Type": "application/json", **self.auth()}
        body = {"contents": [{"role": "user", "parts": parts}],
                "generationConfig": {"responseMimeType": "application/json"}}
        return url, headers, body

    def _call(self, url, headers, data, method="POST"):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.g["timeout_seconds"]) as r:
                return r.headers, r.read()
        except urllib.error.HTTPError as e:
            body = e.read()[:400].decode("utf-8", "replace")
            if e.code in (400, 401, 403) and ("API key" in body or "PERMISSION_DENIED" in body or "UNAUTHENTICATED" in body):
                raise NotReady("Gemini refused the request: no valid key reached it. Add the network secret "
                               "(header x-goog-api-key on generativelanguage.googleapis.com) or the "
                               f"{self.g['key_env']} environment variable, in the cloud environment's settings") from None
            raise RuntimeError(f"Gemini said {e.code}: {body}") from None
        except urllib.error.URLError as e:
            raise NotReady(f"can't reach {urllib.parse.urlparse(url).hostname} ({e.reason}): allow it in the "
                           "environment's network settings") from None

    def generate(self, parts):
        """Run the analysis: the configured model, retried while it's busy, then the fallbacks in order."""
        last = None
        for model in [self.g["model"]] + list(self.g.get("fallback_models", [])):
            for attempt in range(self.g.get("retries", 1)):
                url, headers, body = self.request(parts, model)
                try:
                    return self._stream(url, headers, json.dumps(body).encode("utf-8"))
                except Busy as e:
                    last = e
                    time.sleep(self.g.get("retry_wait_seconds", 5) * (attempt + 1))
        raise RuntimeError(f"Gemini stayed busy across every model ({last}); try again in a few minutes")

    def _stream(self, url, headers, data):
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        chunks = []
        try:
            with urllib.request.urlopen(req, timeout=self.g["timeout_seconds"]) as r:
                for line in r:
                    line = line.decode("utf-8").strip()
                    if line.startswith("data:"):
                        chunks.append(json.loads(line[5:]))
        except urllib.error.HTTPError as e:
            body = e.read()[:400].decode("utf-8", "replace")
            if e.code in (429, 500, 502, 503, 504):
                raise Busy(f"{e.code}: {body[:160]}") from None
            if e.code in (400, 401, 403) and ("API key" in body or "PERMISSION_DENIED" in body or "UNAUTHENTICATED" in body):
                raise NotReady("Gemini refused the request: no valid key reached it. Add the network secret "
                               "(header x-goog-api-key on generativelanguage.googleapis.com) or the "
                               f"{self.g['key_env']} environment variable, in the cloud environment's settings") from None
            raise RuntimeError(f"Gemini said {e.code}: {body}") from None
        except urllib.error.URLError as e:
            raise NotReady(f"can't reach {urllib.parse.urlparse(url).hostname} ({e.reason}): allow it in the "
                           "environment's network settings") from None
        return parse_stream(chunks)

    def upload(self, path, mime):
        """Gemini's Files API (resumable upload), then wait until the file is ready. Returns its URI."""
        self.ready()
        size = os.path.getsize(path)
        start = {"X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
                 "X-Goog-Upload-Header-Content-Length": str(size), "X-Goog-Upload-Header-Content-Type": mime,
                 "Content-Type": "application/json", **self.auth()}
        h, _ = self._call(f"{self.g['upload_base']}/files", start,
                          json.dumps({"file": {"display_name": os.path.basename(path)}}).encode())
        upload_url = h.get("X-Goog-Upload-URL") or h.get("x-goog-upload-url")
        with open(path, "rb") as fh:
            _, raw = self._call(upload_url, {"Content-Length": str(size), "X-Goog-Upload-Offset": "0",
                                             "X-Goog-Upload-Command": "upload, finalize", **self.auth()}, fh.read())
        info = json.loads(raw)["file"]
        deadline = time.time() + self.g["timeout_seconds"]
        while info.get("state") == "PROCESSING" and time.time() < deadline:
            time.sleep(self.g["poll_seconds"])
            _, raw = self._call(f"{self.g['base']}/{info['name']}", self.auth(), None, "GET")
            info = json.loads(raw)
        if info.get("state") not in (None, "ACTIVE"):
            raise RuntimeError(f"Gemini couldn't process {os.path.basename(path)} (state {info.get('state')})")
        return info["uri"]

    def file_part(self, path):
        mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
        if os.path.getsize(path) <= self.g["inline_max_bytes"]:
            with open(path, "rb") as fh:
                return {"inline_data": {"mime_type": mime, "data": base64.b64encode(fh.read()).decode()}}
        return {"file_data": {"mime_type": mime, "file_uri": self.upload(path, mime)}}


class Busy(RuntimeError):
    """Gemini is overloaded or rate-limited right now (429/5xx): worth a retry."""


def parse_stream(chunks):
    """Join a streamed answer's chunks into one response, then read it like a single one."""
    parts, usage, model, feedback = [], {}, None, None
    for c in chunks:
        for cand in c.get("candidates", []):
            parts += [p for p in cand.get("content", {}).get("parts", []) if "text" in p]
        usage = c.get("usageMetadata", usage)
        model = c.get("modelVersion", model)
        feedback = c.get("promptFeedback", feedback)
    resp = {"candidates": [{"content": {"parts": parts}}]} if parts else {"promptFeedback": feedback or {}}
    resp.update(usageMetadata=usage, modelVersion=model)
    return parse_response(resp)


def parse_response(resp):
    """The model's JSON answer and its usage, from a generateContent response."""
    cands = resp.get("candidates") or []
    if not cands:
        raise RuntimeError(f"Gemini returned no answer: {json.dumps(resp.get('promptFeedback', resp))[:400]}")
    text = "".join(p.get("text", "") for p in cands[0].get("content", {}).get("parts", []))
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(text), resp.get("usageMetadata", {}), resp.get("modelVersion")


# --- sources --------------------------------------------------------------------------------------------
def platform_of(url, cfg):
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    for name, p in cfg["platforms"].items():
        if name.startswith("_"):
            continue
        if host in p["hosts"]:
            return name, p
    return (host or "file"), {"direct_to_model": False}


def video_key(url):
    """A stable key for a link: the video id where the platform has one, else a hash of the link."""
    m = re.search(r"(?:v=|youtu\.be/|/shorts/|/video/|/reel/|/p/)([\w-]{6,})", url)
    return m.group(1) if m else digest(url)


def download(url, cfg, folder):
    """Download a link with yt-dlp; returns (path, info). Raises NotReady when the tool or the host isn't there."""
    d = cfg["download"]
    cmd = [shutil.which(d["tool"])] if shutil.which(d["tool"]) else [sys.executable, "-m", "yt_dlp"]
    probe = subprocess.run(cmd + ["--version"], capture_output=True, text=True)
    if probe.returncode != 0:
        raise NotReady("yt-dlp isn't installed here: `pip install yt-dlp` (or save the video into the Drive "
                       "Inbox and ingest the file)")
    out = os.path.join(folder, "%(id)s.%(ext)s")
    run = subprocess.run(cmd + ["-f", d["format"], "--max-filesize", d["max_filesize"], "--no-playlist",
                                "--write-info-json", "-o", out, url], capture_output=True, text=True)
    files = [f for f in os.listdir(folder) if not f.endswith(".json")]
    if run.returncode != 0 or not files:
        tail = (run.stderr or run.stdout).strip().splitlines()[-1:] or ["no output"]
        raise NotReady(f"couldn't download {url}: {tail[0]} (allow the site in the environment's network "
                       "settings, or save the video into the Drive Inbox and ingest the file)")
    info = {}
    infos = [f for f in os.listdir(folder) if f.endswith(".info.json")]
    if infos:
        with open(os.path.join(folder, infos[0]), encoding="utf-8") as fh:
            info = json.load(fh)
    return os.path.join(folder, files[0]), info


def link_metadata(url, cfg):
    """Title and creator for a link without downloading it: the site's oEmbed endpoint first (YouTube asks yt-dlp
    to sign in from a cloud address), then yt-dlp. Empty when neither answers."""
    plat = platform_of(url, cfg)[1]
    if plat.get("oembed"):
        try:
            req = urllib.request.Request(plat["oembed"].format(url=urllib.parse.quote(url, safe="")),
                                         headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                o = json.loads(r.read().decode("utf-8"))
            out = {"title": o.get("title"), "creator": o.get("author_name"),
                   "handle": (o.get("author_url") or "").rstrip("/").rsplit("/", 1)[-1] or None}
            if out["title"] or out["creator"]:
                return {k: v for k, v in out.items() if v}
        except (urllib.error.URLError, ValueError, OSError):
            pass
    d = cfg["download"]
    cmd = [shutil.which(d["tool"])] if shutil.which(d["tool"]) else [sys.executable, "-m", "yt_dlp"]
    try:
        run = subprocess.run(cmd + ["--skip-download", "--dump-json", "--no-playlist", url], capture_output=True,
                             text=True, timeout=60)
        info = json.loads(run.stdout) if run.returncode == 0 and run.stdout.strip() else {}
    except (subprocess.TimeoutExpired, ValueError, OSError):
        info = {}
    out = {"title": info.get("title"), "creator": info.get("uploader") or info.get("channel"),
           "handle": info.get("uploader_id"), "duration_seconds": info.get("duration")}
    return {k: v for k, v in out.items() if v}


class _Text(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.out, self.skip, self.title = [], 0, ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg"):
            self.skip += 1
        if tag == "title":
            self._in_title = True
        if tag in ("p", "br", "li", "tr", "h1", "h2", "h3", "h4", "div"):
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg") and self.skip:
            self.skip -= 1
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if not self.skip:
            self.out.append(data)


def page_text(url, limit=200000):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (research archive)"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")
    except urllib.error.HTTPError as e:                 # the site answered: the page itself is the problem
        raise NotReady(f"{urllib.parse.urlparse(url).hostname} answered {e.code} ({e.reason}) for {url}: "
                       "check the link") from None
    except urllib.error.URLError as e:
        raise NotReady(f"can't reach {urllib.parse.urlparse(url).hostname} ({getattr(e, 'reason', e)}): allow "
                       "it in the environment's network settings") from None
    p = _Text()
    p.feed(raw)
    text = re.sub(r"\n\s*\n+", "\n\n", "".join(p.out)).strip()
    return p.title.strip(), text[:limit]


# --- the envelope and its claims ------------------------------------------------------------------------
def envelope(cfg, lens, source, model, usage, result):
    return {"app": cfg["app"], "version": cfg["version"], "lens": lens,
            "extractedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds"),
            "source": source,
            "analysis": {"provider": "Gemini", "model": model or cfg["gemini"]["model"], "machineGenerated": True,
                         "humanVerified": False, "usage": usage},
            "result": result}


def analyze(cfg, lens, what, target, note=None, gemini=None):
    """Run the analyzer: what is 'video', 'image' or 'page'; target is a link or a file path. Returns the
    envelope. Raises NotReady with the fix when something is missing."""
    gem = gemini or Gemini(cfg)
    gem.ready()
    prompt = cfg["lenses"][lens]["prompt"]
    source = {"platform": None, "url": None, "file": None, "key": None, "creator": None, "handle": None,
              "media": None, "analysed": what, "note": note}
    is_url = re.match(r"https?://", target or "")
    with tempfile.TemporaryDirectory() as tmp:
        if what == "page":
            title, text = page_text(target)
            source.update(platform=urllib.parse.urlparse(target).hostname, url=target, key=digest(target),
                          media="web page", title=title)
            page_prompt = (prompt.replace("You are watching material", "You are reading a web page")
                           .replace("with a timestamp (mm:ss) for every item",
                                    "with the page section it comes from (as 'at') for every item"))
            parts = [{"text": page_prompt},
                     {"text": f"PAGE: {title}\nURL: {target}\n\n{text}"}]
        elif is_url:
            name, plat = platform_of(target, cfg)
            source.update(platform=name.upper(), url=target, key=video_key(target))
            if plat.get("direct_to_model"):
                source["media"] = "link sent to the model"
                source.update(link_metadata(target, cfg))
                parts = [{"file_data": {"file_uri": target}}, {"text": prompt}]
            else:
                path, info = download(target, cfg, tmp)
                source.update(media="downloaded video", creator=info.get("uploader") or info.get("channel"),
                              handle=info.get("uploader_id"), title=info.get("title"))
                caption = info.get("description") or ""
                parts = [gem.file_part(path), {"text": prompt + (f"\n\nCAPTION: {caption}" if caption else "")}]
        else:
            if not os.path.exists(target):
                raise FileNotFoundError(target)
            with open(target, "rb") as fh:
                key = digest(fh.read())
            source.update(platform="FILE", file=os.path.basename(target), key=key, media=what)
            parts = [gem.file_part(target), {"text": prompt}]
        result, usage, model = gem.generate(parts)
    return envelope(cfg, lens, source, model, usage, result)


def _generation(text):
    if not text:
        return None
    t = str(text).lower().replace(" ", "")
    m = re.search(r"gen(?:eration)?(\d)", t)
    if m:
        return int(m.group(1))
    for word, g in GAME_WORDS.items():
        if word in t:
            return g
    return None


def claims_from(inbox, env, lens_cfg):
    """Turn an envelope's lens block into proposed claims, each with its exact source reference."""
    block = (env.get("result") or {}).get(lens_cfg["block"]) or {}
    src = env.get("source") or {}
    where = src.get("url") or src.get("file") or src.get("title") or "the source"
    ref = lambda at: f"{where} @ {at}" if at else where
    fan = block.get("videoType") in lens_cfg.get("fan_types", [])
    out = []
    for b in block.get("behaviors", []):
        out.append(inbox.claim("field_note", {"species": b.get("species"), "aspect": "behavior",
                                              "note": b.get("behavior"), "context": b.get("context")},
                               source_ref=ref(b.get("at"))))
    for h in block.get("habitats", []):
        note = ", ".join(x for x in (h.get("habitat"), h.get("time_of_day"), h.get("weather"), h.get("season")) if x)
        out.append(inbox.claim("field_note", {"species": h.get("species"), "aspect": "habitat", "note": note,
                                              "region": h.get("region_if_named")}, source_ref=ref(h.get("at"))))
    for o in block.get("battle", []):
        out.append(inbox.claim("observation", {"trainer": o.get("trainer"), "pokemon": o.get("pokemon"),
                                               "move": o.get("move"), "situation": o.get("situation"),
                                               "outcome": o.get("outcome"), "battle": src.get("title") or where,
                                               "sample_size": 1}, source_ref=ref(o.get("at"))))
    for b in block.get("builds", []):
        data = {k: b.get(k) for k in ("species", "nickname", "moves", "item", "ability", "nature", "evs", "ivs",
                                      "level") if b.get(k) not in (None, "", [], {})}
        data["generation"] = _generation(b.get("game_or_generation"))
        out.append(inbox.claim("build", data, source_ref=ref(b.get("at"))))
    for l in block.get("lore", []):
        out.append(inbox.claim("lore", {"subject": l.get("subject"), "fact": l.get("fact"),
                                        "episode": l.get("episode_or_title")}, source_ref=ref(l.get("at"))))
    style = block.get("style") or {}
    if any(style.get(k) for k in ("narration_voice", "pacing", "shots", "structure", "tone")):
        name = " · ".join(x for x in (src.get("creator"), src.get("title")) if x) or where
        out.append(inbox.claim("style_card", {"name": name, **style}, source_ref=where))
    if fan:                                             # a fan work's "facts" are its interpretation, not canon
        for c in out:
            if c["kind"] in ("field_note", "lore", "observation", "build"):
                c["note"] = (c.get("note", "") + " " if c.get("note") else "") + lens_cfg["fan_note"]
                c["data"]["fan_work"] = True
    return out


def to_card(inbox, env, provenance="ingested", again=False):
    lens = env.get("lens") or "pokemon"
    lens_cfg = inbox.cfg["lenses"][lens]
    src = dict(env.get("source") or {})
    kind = {"page": "page", "image": "image"}.get(src.get("analysed"), "video")
    key = f"{(src.get('platform') or 'file').lower()}-{src.get('key') or digest(json.dumps(src, sort_keys=True))}"
    claims = claims_from(inbox, env, lens_cfg)
    from ingest.pokedex import crosscheck
    crosscheck(inbox, claims)                           # what the games' own Pokédex backs, as evidence
    summary = (env.get("result") or {}).get("summary") or ""
    return inbox.new(kind, key, src, provenance, summary, claims, raw=env, again=again)
