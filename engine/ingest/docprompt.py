"""The documentary prompt kit (docs/INGEST.md): turn videos you like into prompts you can reuse.

A style card (approved from a video you liked: narration voice, pacing, structure, shots, light) plus a species'
approved field notes become:
- a **narration brief**: what to write, in that voice, saying only what the field notes support;
- a **shot list**: one prompt per shot for a video tool (Sora, Veo, Runway…), the style card's framing and camera
  moves applied to the species' recorded behaviors.
Templates live in ingest/config.json (doc_prompt). Nothing is invented: a species with no approved field notes
says so instead of making behavior up.
"""
import json
import os

from ingest.cards import ENGINE


def _jsonl(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


def kit(cfg, species, style=None, setting=None, seconds=None, base=ENGINE):
    notes = [n for n in _jsonl(os.path.join(base, cfg["claims"]["field_note"]["lands_in"]))
             if (n.get("species") or "").lower() == species.lower()]
    styles = _jsonl(os.path.join(base, cfg["claims"]["style_card"]["lands_in"]))
    if style:
        styles = [s for s in styles if style in (s.get("card"), s.get("name"))] or \
                 [s for s in styles if style.lower() in (s.get("name") or "").lower()]
    if not notes:
        return {"species": species, "error": f"no approved field notes for {species} yet: ingest a video or page "
                                            "about it, then approve its field notes"}
    if not styles:
        return {"species": species, "error": "no approved style card yet: ingest a video you like and approve its "
                                            "style card" + (f" (none matches '{style}')" if style else "")}
    st = styles[-1]
    notes.sort(key=lambda n: not n.get("canon"))      # the games' own words first
    habitat = [n for n in notes if n.get("aspect") == "habitat"]
    behavior = [n for n in notes if n.get("aspect") != "habitat"] or notes
    setting = setting or (habitat[0]["note"] if habitat else "its habitat")
    d = cfg["doc_prompt"]
    tidy = lambda v: str(v).strip().rstrip(".").strip() if v else "unspecified"   # the template's own punctuation stands
    fill = lambda t, **k: t.format(**{key: ("; ".join(tidy(x) for x in v) if isinstance(v, list) else tidy(v))
                                      for key, v in k.items()})
    narration = fill(d["narration"], narration_voice=st.get("narration_voice"),
                     narrator_perspective=st.get("narrator_perspective"), tone=st.get("tone"), pacing=st.get("pacing"),
                     structure=st.get("structure"), species=species, setting=setting,
                     notes=[f"{n['note']} [{n.get('source_ref') or n.get('source')}]" for n in notes],
                     seconds=str(seconds or d["default_seconds"]))
    shots = []
    for i, shot in enumerate(st.get("shots") or [{}]):
        b = behavior[i % len(behavior)]
        shots.append(fill(d["shot"], framing=shot.get("framing") or shot.get("shot"), subject=shot.get("subject"),
                          species=species, setting=setting, camera_move=shot.get("camera_move"),
                          color_and_light=st.get("color_and_light"), behavior=b["note"]))
    return {"species": species, "style": st.get("name"), "style_source": st.get("source"), "setting": setting,
            "narration_brief": narration, "shots": shots,
            "grounded_in": [n.get("source_ref") or n.get("source") for n in notes]}


def render(k):
    if k.get("error"):
        return k["error"]
    lines = [f"# {k['species']}, in the style of {k['style']}", "", f"Setting: {k['setting']}", "",
             "## Narration brief", "", k["narration_brief"], "", "## Shot list", ""]
    lines += [f"{i}. {s}" for i, s in enumerate(k["shots"], 1)]
    lines += ["", "Grounded in: " + "; ".join(x for x in k["grounded_in"] if x)]
    return "\n".join(lines)
