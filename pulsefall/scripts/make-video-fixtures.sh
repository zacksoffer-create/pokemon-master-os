#!/usr/bin/env bash
# Regenerates the small video fixtures used by tests/unit/mp4Audio.test.ts and the e2e
# MP4 import test: tiny H.264 pictures with AAC sound in the layouts real files use.
# Usage: scripts/make-video-fixtures.sh   (needs ffmpeg with libx264)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/tests/fixtures/video"
mkdir -p "$OUT"
FF=(ffmpeg -hide_banner -loglevel error -y)
EXACT=(-fflags +bitexact -flags:a +bitexact -flags:v +bitexact)
VIDEO=(-f lavfi -i "testsrc=size=64x48:rate=10:duration=6")
TONE=(-f lavfi -i "sine=frequency=440:sample_rate=44100:duration=6")
ENC=(-c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 64k -ac 2 -metadata title="Neon Test Clip" -metadata artist="Pulsefall Lab")

# Index at the end (the usual camera/screen-recording layout), picture and sound interleaved.
"${FF[@]}" "${VIDEO[@]}" "${TONE[@]}" "${ENC[@]}" "${EXACT[@]}" "$OUT/clip.mp4"
# Index first ("fast start", typical of web downloads).
"${FF[@]}" "${VIDEO[@]}" "${TONE[@]}" "${ENC[@]}" "${EXACT[@]}" -movflags +faststart "$OUT/clip-faststart.mp4"
# QuickTime (what iPhone cameras record).
"${FF[@]}" "${VIDEO[@]}" "${TONE[@]}" "${ENC[@]}" "${EXACT[@]}" -f mov "$OUT/clip.mov"
# Fragmented MP4 (streaming layout): not extracted, the original is decoded instead.
"${FF[@]}" "${VIDEO[@]}" "${TONE[@]}" "${ENC[@]}" "${EXACT[@]}" -movflags frag_keyframe+empty_moov "$OUT/clip-frag.mp4"
# A video with no sound track.
"${FF[@]}" "${VIDEO[@]}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${EXACT[@]}" "$OUT/silent-video.mp4"
# Reference: ffmpeg's own audio-only copy of clip.mp4 (same samples, no re-encode).
"${FF[@]}" -i "$OUT/clip.mp4" -vn -c:a copy "${EXACT[@]}" "$OUT/clip-audio-ref.m4a"

# e2e: the Neon Drop fixture as a music video.
E2E="$ROOT/tests/fixtures/e2e"
"${FF[@]}" -f lavfi -i "testsrc=size=96x64:rate=12" -i "$E2E/neon-drop.mp3" -shortest \
  -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 96k -metadata title="Neon Clip" -metadata artist="Pulsefall" \
  "${EXACT[@]}" "$E2E/neon-clip.mp4"
ls -la "$OUT" "$E2E/neon-clip.mp4"

# e2e: Neon Drop after 12 s of near-silence (a long intro with nothing to play).
"${FF[@]}" -f lavfi -i "anoisesrc=color=pink:amplitude=0.002:sample_rate=44100:duration=12" -i "$E2E/neon-drop.mp3" \
  -filter_complex "[0:a]aformat=channel_layouts=stereo[s];[1:a]aformat=sample_rates=44100:channel_layouts=stereo[m];[s][m]concat=n=2:v=0:a=1" \
  -c:a libmp3lame -b:a 96k -metadata title="Neon Late" -metadata artist="Pulsefall" "${EXACT[@]}" "$E2E/neon-late.mp3"
