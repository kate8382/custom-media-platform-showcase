#!/usr/bin/env bash
set -e
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg: command not found. Install ffmpeg first (see scripts/merge_instructions.md)"
  exit 1
fi
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: merge_audio_video.sh <video-file> <audio-file> [output-file]"
  exit 2
fi
VIDEO="$1"
AUDIO="$2"
OUT="${3:-merged_$(basename "$VIDEO") }"
ffmpeg -y -i "$VIDEO" -i "$AUDIO" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 "$OUT"
echo "Merged -> $OUT"
