# Pulsefall

A personal, mobile-first rhythm game in the spirit of Tap Tap Revenge. Import your own
MP3 or M4A, and Pulsefall listens to it on your device, finds the beat, the hits, the
sections and the long notes, and builds four playable three-lane charts automatically.
Then you play.

**Import song → automatic analysis → chart generated → play → results → replay.**

- Runs entirely in the browser (iPhone Safari, installed Home Screen app, desktop browsers).
- No accounts, no uploads, no servers, no subscriptions. Your music never leaves the device.
- Works offline once installed.

---

## Play it on your iPhone

Pulsefall is a static web app; it just needs to be served over HTTPS once. Pick one:

### Option A — GitHub Pages (free, already prepared)

A built copy is on the `gh-pages` branch of this repository.

1. On GitHub open **Settings → Pages**.
2. Under **Build and deployment → Source** choose **Deploy from a branch**, branch **`gh-pages`**, folder **`/ (root)`**, then **Save**.
3. After a minute the game is at **https://zacksoffer-create.github.io/pokemon-master-os/**.

To publish a newer build later: `cd pulsefall && npm run deploy:pages` (builds and pushes the `gh-pages` branch).

### Option B — Netlify Drop (free, no Git needed)

1. `cd pulsefall && npm install && npm run build` (or download a built `dist` folder).
2. Go to <https://app.netlify.com/drop> and drag the `dist` folder onto the page.
3. Open the URL it gives you on your iPhone.

### Option C — Cloudflare Pages (free, auto-deploys from GitHub)

Create a Pages project from this repo with **Root directory** `pulsefall`, **Build command**
`npm ci && npm run build`, **Output directory** `dist`.

### Install to the Home Screen

1. Open the site in **Safari** on your iPhone.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Launch Pulsefall from its icon — full screen, offline-capable.

> **Import songs inside the installed app.** iOS keeps the Home Screen app's storage separate
> from Safari's, so a song imported in a Safari tab won't show up in the installed app.
> Settings → Export backup / Restore backup moves charts, edits and scores between them.

---

## Using it

| | |
|---|---|
| **Import** | Home → *Import song* (or Library → *Import*). Pick one or several files from the Files app. Each one is decoded, analyzed and charted in a few seconds; you can keep browsing meanwhile. |
| **Play** | Open a song, pick a style, tap **Play**. Tap notes as they cross the glowing line, keep a finger down on holds, flick the gold arrow notes (a tap also counts with *Swipe assist*, on by default). |
| **Styles** | **Relaxed** (the groove, sparse), **Classic Groove** (default: main pulse + standout hits), **Full Rhythm** (syncopation and detail), **Advanced** (everything the track supports; optional 4 lanes). |
| **Demo** | *Neon Overture* is an original track synthesized by the app, with a hand-authored *Showcase* chart plus the automatic charts — useful to try everything before importing. |
| **Sync check** | Settings → *Run sync check*. 30 seconds of tapping to clicks and flashes measures audio and input latency separately. Re-run it when switching to Bluetooth headphones. |
| **Chart options** | Song → ⋯ → *Chart options*: density, pattern style (Flow / Alternate / Melodic), lanes, alternate lane variations, a manual BPM/first-beat fix, and a per-song timing offset. Rebuilding never touches your edits. |
| **Editor** | Song → ⋯ → *Edit chart*. Waveform + beat grid, snapping (1/1, 1/2, 1/4, 1/3, free), tap/hold/swipe tools, drag to move, drag a hold's end to resize, undo/redo, play with note clicks, *Test here* to play from the playhead, chart offset, export/import chart files. Edits are saved as a separate version; the automatic chart is always kept. Keyboard: Space play/pause, 1–4 add a note at the playhead, Delete, Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z. |
| **Backups** | Settings → *Export backup* saves charts, edits, scores and settings (not audio) as JSON. *Restore backup* merges it back. After restoring, re-import the same audio files and they relink automatically (matched by content fingerprint). |
| **Keyboard play** | F / Space / J (or ← ↓ →) for three lanes; D F J K for four. Shift + lane key flicks a swipe. |

### Audio formats

- **Works best:** MP3 (incl. VBR), M4A/AAC (DRM-free, e.g. iTunes purchases or files you converted), WAV.
- **Usually works:** FLAC; Ogg/Opus on iOS 17+; Apple Lossless depends on the browser.
- **Can't work:** copy-protected (DRM) subscription downloads (Apple Music, Spotify…). Pulsefall detects protected M4P/`drms`/`enca` files and explains why instead of failing silently.
- Songs from 3 seconds up to 20 minutes; files up to 150 MB.

---

## How the automatic charting works

All of it runs locally in a Web Worker (`src/core/analysis`, `src/core/chart`).

1. **Decode** at 22.05 kHz mono for analysis (the original file is kept for full-quality playback).
2. **Spectral analysis**: STFT (1024, 10 ms hop) → log-frequency filterbank → SuperFlux onset
   detection functions (overall and low/mid/high bands), loudness, brightness, chroma, timbre.
3. **Onsets** by adaptive peak picking, each with strength, band profile, brightness and a
   sustain estimate (how long the sound it starts keeps ringing).
4. **Tempo** from harmonic-enhanced autocorrelation over 12 s windows with a tempo prior,
   plus a smoothed local tempo curve (dynamic programming) for drift and tempo changes.
5. **Beats** by dynamic-programming beat tracking (Ellis) that follows the local tempo,
   then smoothed and phase-aligned to detected onsets. Confidence is measured, not assumed.
6. **Meter & feel**: 3/4 vs 4/4 and the downbeat from bass accents and harmonic changes;
   swing/triplet feel from where the off-beat energy sits.
7. **Structure**: multi-scale self-similarity novelty and top-down splitting into sections,
   each rated for intensity; similar sections share a label.
8. **Chart generation** (per style): metrical slots scored by onset salience × metrical
   weight; bars with the same rhythm and sound are clustered and share one rhythm pattern
   (consistent grooves, with room for one-off fills); note budgets follow section intensity;
   holds on sustained sounds and on rings across rests; doubles on big broadband accents and
   section arrivals; swipes on drops and the final hit. If the beat grid is unreliable the
   generator follows the detected hits directly instead of forcing a wrong grid, and says so.
9. **Lanes** by beam search over a comfort + musicality cost: follow the brightness contour,
   avoid fast same-lane repeats, keep lanes balanced, keep held lanes free, mirror alternate
   phrases (call and response) and **repeat lane patterns when a section repeats**.
10. **Validation & repair** on every chart (generated, edited or imported): ordering,
    duplicates, lanes, holds vs. later notes, chord size, density caps, stable ids.

Generation is deterministic (seeded by the audio fingerprint), so the same file gives the
same chart; *Variation* in Chart options produces alternative lane patterns.

### Timing

Gameplay time comes from the audio hardware clock (`getOutputTimestamp` where available),
smoothed into a linear model shared by the renderer and by input judging, so a dropped frame
can never cause drift. Audio, input and visual latency offsets are applied in one place
(`src/core/game/offsets.ts`). Default timing windows are generous (±60/115/175 ms) with
*Standard* and *Strict* profiles available.

---

## Development

```bash
cd pulsefall
npm install
npm run dev          # http://localhost:5173 (also on your LAN with --host)
npm test             # unit tests (Vitest)
npm run build        # type-check + production build into dist/
npm run test:e2e     # Playwright end-to-end tests against the built app
npm run deploy:pages # build and push dist/ to the gh-pages branch
npm run build:artifact # sandbox-friendly copy (no service worker) in dist-artifact/
```

Optional evaluation on real recordings (not committed): put mono 22.05 kHz float32 PCM files
in `.eval/pcm/` (e.g. `ffmpeg -i song.mp3 -ac 1 -ar 22050 -f f32le .eval/pcm/song.f32`) and
run `npx vitest run --config vitest.eval.config.ts`.

### Project layout

```
src/core/analysis   decode-independent music analysis (spectrum, onsets, tempo, beats, meter, structure)
src/core/chart      chart generation, lane assignment, validation, styles, stats
src/core/engine     the gameplay engine (judgments, holds, swipes, combo, score)
src/core/audio      AudioContext, iOS audio session handling, clock, song player, synthesized SFX
src/core/render     canvas renderer, themes, pre-rendered sprites
src/core/input      pointer/keyboard input
src/core/game       the play session orchestrator and latency offsets
src/core/import     metadata/artwork/DRM parsing, import pipeline, worker client
src/core/storage    IndexedDB library, backups, migrations
src/core/demo       the synthesized demo track and its hand-authored chart
src/workers         the analysis worker
src/app             Preact UI: screens, editor, components, state
tests/unit          Vitest suites       tests/e2e  Playwright suites
```

---

## Testing status

- **Unit tests (Vitest):** gameplay engine (judgments, combo, holds, swipes, autoplay,
  frame-rate independence), analysis on synthetic fixtures with exact ground truth (80–160
  BPM, hip-hop, syncopation, dense/sparse, swing, 3/4, tempo ramp, quiet intro, dynamics,
  silence/drone rejection, 44.1 kHz input, 5-minute performance), chart generation invariants
  across all styles, musical alignment, repetition, determinism, validator repairs, clock
  smoothing/drift/offsets/calibration, IndexedDB library and backups, metadata parsing for
  MP3/M4A/WAV/FLAC/Ogg/Opus/AAC incl. DRM and corrupt input, the demo track and chart, editor
  operations.
- **End-to-end (Playwright, Chromium, iPhone 13 viewport + touch):** import MP3 and M4A
  through the file picker, automatic analysis, autoplay to results, persistence across
  reload, search, duplicate detection, a non-audio file, keyboard play with pause/resume/exit,
  reload safety, chart editing and saving, settings persistence, deleting a song, an
  in-page bot that taps on time through the real input path (50/50 Perfect, mean error ≈ +7 ms),
  and a bot run through the sync check (measured offsets within a few ms of zero; stopping
  the live check really stops it).
- **Real recordings:** evaluated on CC-licensed tracks (pop/folk, ragtime, waltz, hip-hop,
  swing jazz, orchestral). Beat agreement with librosa's tracker is ~0.98 F-measure on
  steady-tempo music; free-tempo orchestral music is approximate (and flagged as such).

### Requirements

iOS 16.2 or newer is recommended. It runs on iOS 14.5+, but iOS 15.0–16.1 skip some colour
tints and glows (`color-mix`), and iOS 14 analyses songs on the main thread (no module workers).

### Not verified here

This build was developed and tested in Chromium. **No physical iPhone or WebKit browser was
available**, so these need a real-device check: audio unlock and the silent-switch behaviour,
latency on iPhone speakers/AirPods (use the Sync check), touch feel and multitouch, Home
Screen install/offline mode, storage persistence in the installed app, and decoding of your
particular M4A files.

## Credits & licenses

Code: MIT. Font: Chakra Petch (SIL Open Font License) via @fontsource. Libraries: Preact
(MIT), idb (ISC), Workbox via vite-plugin-pwa (MIT). The demo track and all sound effects are
synthesized by the app. No third-party audio is bundled.
