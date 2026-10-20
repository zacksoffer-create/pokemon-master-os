# Intake: how the project learns (design, 2026-10-19)

*Everything that comes in (a video, a screenshot, a web page, a Showdown paste, a research result) becomes a card of proposed claims. Nothing reaches canon until it's approved. Every claim keeps its exact source.*

Built separately for Pokémon for now. It uses the same analysis envelope as Food OS, so one shared intake engine and one sheet for every project can take it over later (D-049).

## The flow

```
  ways in                          the inbox                            canon
  ───────                          ─────────                            ─────
  video link or file  ─┐
  screenshot          ─┤  analyzer   ┌──────────────┐  approve /  ┌─ field_notes.jsonl
  web page            ─┼──(Gemini)──▶│ card         │  reject /   ├─ observations.jsonl
  Showdown paste      ─┤  engine ───▶│  └ claims    │──edit──────▶├─ lore.jsonl
  agent sheet RESULTS ─┤             │   (proposed) │  then apply ├─ video_styles.jsonl
  a note you write    ─┘             └──────────────┘             ├─ build_library.json
                                                                   ├─ trainers.json (careers)
                                                                   └─ corrections (allowed paths only)
```

## Ways in

- **Videos** (`intake.py video <link or file>`):
  - YouTube links go to Gemini directly; nothing is downloaded.
  - TikTok and Instagram links are downloaded with yt-dlp, then uploaded.
  - A video saved into the Drive Inbox can be ingested as a file.
  - A link's title and creator come from the site's oEmbed answer (YouTube, TikTok), so a card names the video and its channel without a download.
  - **Fan works** (fan animations, mockumentaries) are marked: every fact-type claim from one carries `fan_work` and a note that it's the creator's interpretation, not canon. You can still approve it into your world; the style card is unaffected.
- **Screenshots** (`intake.py image`): a summary screen or PKHeX view, a teambuilder, an anime frame, a Pokédex page.
- **Pages** (`intake.py page <url>`): fetched, reduced to text, then analyzed.
- **Analyses already done** (`intake.py envelope <json>`): anything in the shared envelope format. A Food OS result analyzed with its food lens has no Pokémon block and is turned away with that reason.
- **Builds** (`intake.py paste team.txt --game platinum [--external "where from"]`): each set is read by the engine on the way in (its roles, why it knows each move, flags, the closest archetype). Builds are yours unless `--external` names a source.
- **Research** (`intake.py results tabs.json`): the agent sheet's RESULTS tabs, with one card per research job.
- **By hand** (`intake.py card claims.json`): a card written in a session, e.g. a finding from a web search.
- **Game film** (`intake.py film --format gen4ou --count 150 [--user NAME] [--trainer me]`): public Showdown replays read turn by turn by the film room (`docs/FILM.md`). One study becomes one card of observation tallies (leads, order, choices by game state, aggression) and build variants.

## The analysis envelope (shared with Food OS)

```
{app, version, lens, extractedAt,
 source:   {platform, url, key, creator, handle, media, analysed},
 analysis: {provider: "Gemini", model, machineGenerated, humanVerified, usage},
 result:   {summary, transcript[{timestamp,text}], on_screen_text[…], observations[…], limitations[…],
            pokemon: {videoType, species, behaviors, habitats, battle, builds, lore, style, creatorClaims, notInVideo}}}
```

The core is identical to Food OS's. The `pokemon` block is this project's lens; Food OS's is `foodos`. The lens prompt and the mapping from block to claims live in `engine/ingest/config.json`.

## Claims and where they land

| Claim | Needs | Lands in |
|---|---|---|
| field note (behavior, habitat, diet, social) | species, note | `canon/field_notes.jsonl` |
| battle observation | trainer, Pokémon, move, outcome | `canon/observations.jsonl` (the Part 2 schema) |
| build | species, moves, generation | `canon/build_library.json` (yours, or `external: <source>`) |
| lore | subject, fact | `canon/lore.jsonl` |
| career record | trainer, region, event, result | `canon/trainers.json` |
| style card | name | `canon/video_styles.jsonl` |
| correction | target, value, why | the named value, only on allowed paths |

**Review:**
- `approve` refuses a claim that's missing what its kind needs; `edit` fills it in.
- `reject` keeps the claim with its reason.
- `apply` writes approved claims and records where each landed.
- Applying twice never duplicates.
- Everything goes through you. `review.auto_approve_provenance` can let a provenance approve itself; it's empty by default.

## The research agent sheet (Drive: Inbox / Pokémon Master OS - Agent Sheet)

This is the Food OS Agent Sheet pattern:
- **README** holds the agent instructions. Paste them into a ChatGPT or Claude project once; after that a job is one line ("Research batch 1", "Research ASK-0014").
- **ASK** is written by the engine (`intake.py asks`) from what canon still holds as a draft. It started with 69 questions: 42 anime movesets, 18 signature moves, 5 story aces and 4 career records.
- **The agent writes** RESULTS_CAREER, RESULTS_LORE, RESULTS_FIELD_NOTES, RESULTS_BUILDS, RESULTS_OBSERVATIONS, RESULTS_CORRECTIONS, SOURCES and JOBS. Every FOUND row cites a SourceID.
- **The engine only reads RESULTS.** Each job becomes one card.

## The documentary prompt kit (`intake.py doc-prompt <species>`)

It combines an approved **style card** (from a video you liked: narration voice, perspective, pacing, tone, structure, shot list, light) with the species' approved **field notes**. Out come a narration brief and a shot-by-shot prompt list for a video tool. The narration may only say what the field notes support, and the kit cites them. A species with no approved field notes gets a "not yet" instead of invented behavior.

## What it needs (environment settings)

Open the settings from the session: the arrow next to the session title, then **Edit cloud environment**.

**Network access:** set it to **Custom**, tick **Also include default list of common package managers**, and paste this into **Allowed domains** (one per line; `*.` covers every subdomain). It reaches running sessions within about a minute.

```
*.bulbagarden.net
serebii.net
*.serebii.net
smogon.com
*.smogon.com
pokemondb.net
*.pokemondb.net
pokemon.com
*.pokemon.com
pokemonshowdown.com
*.pokemonshowdown.com
pokeapi.co
*.pokeapi.co
youtube.com
*.youtube.com
youtu.be
*.googlevideo.com
*.ytimg.com
tiktok.com
*.tiktok.com
*.tiktokcdn.com
*.tiktokcdn-us.com
*.tiktokv.com
instagram.com
*.instagram.com
*.cdninstagram.com
*.fbcdn.net
generativelanguage.googleapis.com
```

**The Gemini key:** add it as a network secret, so the proxy attaches it and the session never sees it.
- Path: **Network secrets** → **Add secret**.
- **Name:** `Gemini`.
- **Allowed websites:** `generativelanguage.googleapis.com`.
- **Custom headers:** rename `Authorization` to `x-goog-api-key`, clear the `Bearer` prefix, paste the key as the value.
- **Add** saves it immediately.
- Without a Network secrets section (or with the one-host short form), put `GEMINI_API_KEY=<key>` under **Environment variables** instead. It's readable by anyone using the environment, and it reaches a session after a restart.
- Gemini bills per token; Food OS's results record about 7,500 to 14,000 tokens per video.

**yt-dlp for TikTok and Instagram:** add this to the **Setup script** so every new session has it (it's installed in the current one already):

```
#!/bin/bash
pip install --quiet --upgrade yt-dlp || true
```

**Check:** `python3 -I engine/intake.py status` tries Gemini with the key and every site.

**Caveats:**
- Instagram often refuses logged-out downloads. When it does, save the Reel into the Drive Inbox's Videos folder and ingest the file.
- If a TikTok download names a host that isn't on the list, add that host.

## Later (the shared intake engine)

The analyzer, the envelope, the card store and the agent-sheet pattern don't depend on Pokémon. A shared engine would keep one inbox of links (every TikTok and Reel, whatever it's about), run each through the lenses that apply (food, Pokémon, …), and hand each project its cards. The lens config and the claim kinds are the only per-project parts.
