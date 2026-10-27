#!/usr/bin/env bash
# Regenerates the small audio fixtures used by tests/unit/metadata.test.ts.
#
# Every fixture is a short sine tone encoded at a low bitrate with
# deterministic settings (-bitexact), tagged with the same values so the
# tests can assert them:
#   title  "Neon Test Tone"   artist "Pulsefall Lab"   album "Fixtures"   date 2024
# A 16x16 PNG (cover.png, also kept as a fixture) is embedded where the
# container supports artwork.
#
# Usage: scripts/make-audio-fixtures.sh   (needs ffmpeg with libmp3lame,
# libvorbis and libopus; the native aac/alac/flac encoders are built in)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/tests/fixtures/audio"
mkdir -p "$OUT"

FF=(ffmpeg -hide_banner -loglevel error -y)
BITEXACT=(-fflags +bitexact -flags:a +bitexact)
TAGS=(-metadata title="Neon Test Tone" -metadata artist="Pulsefall Lab" -metadata album="Fixtures" -metadata date=2024)

# sine <seconds> <sample rate>: a lavfi input producing a 440 Hz tone. The
# channel count is an output option (-ac) so it applies to the encoded audio.
sine() {
  echo -f lavfi -i "sine=frequency=440:sample_rate=$2:duration=$1"
}

ENCODERS="$(ffmpeg -hide_banner -encoders 2>/dev/null)"
has_encoder() {
  grep -qE "^ [A-Z.]{6} $1 " <<< "$ENCODERS"
}

# --- cover art -------------------------------------------------------------
"${FF[@]}" -f lavfi -i color=c=0x22e6ff:s=16x16 -frames:v 1 -c:v png -pix_fmt rgb24 \
  -fflags +bitexact -flags:v +bitexact "$OUT/cover.png"

COVER_MP3=(-i "$OUT/cover.png" -map 0 -map 1 -c:v copy
  -metadata:s:v title="Album cover" -metadata:s:v comment="Cover (front)")

# --- MP3 -------------------------------------------------------------------
# MPEG-1, 44.1 kHz stereo, ID3v2.4 + APIC, Xing/Info header => duration known.
"${FF[@]}" $(sine 1.5 44100) "${COVER_MP3[@]}" -ac 2 -c:a libmp3lame -b:a 64k \
  -id3v2_version 4 "${TAGS[@]}" "${BITEXACT[@]}" "$OUT/tone-id3v24.mp3"

# MPEG-2, 22.05 kHz mono, ID3v2.3 + APIC; the album contains non-Latin-1
# characters so ffmpeg writes it as UTF-16 with a BOM.
"${FF[@]}" $(sine 1 22050) "${COVER_MP3[@]}" -ac 1 -c:a libmp3lame -b:a 32k \
  -id3v2_version 3 "${TAGS[@]}" -metadata album="Fixtures ✦ Café" \
  "${BITEXACT[@]}" "$OUT/tone-id3v23.mp3"

# MPEG-1, 32 kHz mono, ID3v1 only (still has the Info header). With ID3v2
# disabled ffmpeg only finds ID3v1 values under ID3v2 frame names.
"${FF[@]}" $(sine 1 32000) -ac 1 -c:a libmp3lame -b:a 32k \
  -id3v2_version 0 -write_id3v1 1 -metadata TIT2="Neon Test Tone" -metadata TPE1="Pulsefall Lab" \
  -metadata TALB="Fixtures" -metadata TDRC=2024 "${BITEXACT[@]}" "$OUT/tone-v1only.mp3"

# MPEG-2.5, 8 kHz mono, no tags and no Xing header => duration unknown.
"${FF[@]}" $(sine 1 8000) -ac 1 -c:a libmp3lame -b:a 8k \
  -id3v2_version 0 -write_xing 0 -map_metadata -1 "${BITEXACT[@]}" "$OUT/tone-notags.mp3"

# --- MP4 / M4A -------------------------------------------------------------
COVER_MP4=(-i "$OUT/cover.png" -map 0:a -map 1:v -c:v copy -disposition:v attached_pic)

# AAC, 44.1 kHz stereo, moov before mdat.
"${FF[@]}" $(sine 1.5 44100) "${COVER_MP4[@]}" -ac 2 -c:a aac -b:a 32k \
  "${TAGS[@]}" -movflags +faststart "${BITEXACT[@]}" "$OUT/tone.m4a"

# AAC, 22.05 kHz mono, moov after mdat (ffmpeg's default layout).
"${FF[@]}" $(sine 1 22050) "${COVER_MP4[@]}" -ac 1 -c:a aac -b:a 24k \
  "${TAGS[@]}" "${BITEXACT[@]}" "$OUT/tone-moovend.m4a"

# Apple Lossless, 16 kHz mono, tags but no cover.
"${FF[@]}" $(sine 1 16000) -ac 1 -c:a alac "${TAGS[@]}" "${BITEXACT[@]}" "$OUT/tone-alac.m4a"

# --- WAV -------------------------------------------------------------------
# 16-bit PCM, 8 kHz mono, 1.25 s; tags go into a LIST/INFO chunk.
"${FF[@]}" $(sine 1.25 8000) -ac 1 -c:a pcm_s16le "${TAGS[@]}" -write_bext 0 \
  "${BITEXACT[@]}" "$OUT/tone.wav"

# --- FLAC ------------------------------------------------------------------
# 16 kHz mono, Vorbis comments + PICTURE block; album has non-ASCII text.
"${FF[@]}" $(sine 1 16000) "${COVER_MP4[@]}" -ac 1 -c:a flac \
  -metadata:s:v comment="Cover (front)" "${TAGS[@]}" -metadata album="Fixtures ✦ Café" \
  "${BITEXACT[@]}" "$OUT/tone.flac"

# --- Ogg -------------------------------------------------------------------
if has_encoder libvorbis; then
  "${FF[@]}" $(sine 1.5 22050) -ac 2 -c:a libvorbis -q:a 0 "${TAGS[@]}" \
    "${BITEXACT[@]}" "$OUT/tone.ogg"
else
  echo "libvorbis not available: skipping tone.ogg" >&2
fi

# Opus with a METADATA_BLOCK_PICTURE comment: a base64-encoded FLAC picture
# block (type 3 = front cover) wrapping cover.png.
# be32 <n>: n as four big-endian bytes.
be32() { printf '%b' "$(printf '\\x%02x' $(($1 >> 24 & 255)) $(($1 >> 16 & 255)) $(($1 >> 8 & 255)) $(($1 & 255)))"; }
picture_block() {
  local mime="image/png" size
  size=$(wc -c < "$OUT/cover.png")
  { be32 3; be32 ${#mime}; printf %s "$mime"; be32 0; be32 16; be32 16; be32 24; be32 0
    be32 "$size"; cat "$OUT/cover.png"; } | base64 -w0
}
if has_encoder libopus; then
  "${FF[@]}" $(sine 1.5 48000) -ac 1 -c:a libopus -b:a 16k "${TAGS[@]}" \
    -metadata METADATA_BLOCK_PICTURE="$(picture_block)" "${BITEXACT[@]}" "$OUT/tone.opus"
else
  echo "libopus not available: skipping tone.opus" >&2
fi

# --- Raw AAC (ADTS) ----------------------------------------------------------
"${FF[@]}" $(sine 1 22050) -ac 1 -c:a aac -b:a 24k -f adts "${BITEXACT[@]}" "$OUT/tone.aac"

ls -l "$OUT"
