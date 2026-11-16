#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/assets/source"
OUT="$ROOT/apps/web/public/assets"

mkdir -p "$OUT/cards" "$OUT/guilds" "$OUT/misc" "$OUT/audio"

to_webp() {
  local input="$1" output="$2" width="$3" quality="$4"
  cwebp -quiet -q "$quality" -resize "$width" 0 "$input" -o "$output"
}

for file in "$SRC"/cards/*.png; do
  to_webp "$file" "$OUT/cards/$(basename "${file%.png}").webp" 560 80
done

for file in "$SRC"/guilds/*.png; do
  to_webp "$file" "$OUT/guilds/$(basename "${file%.png}").webp" 360 80
done

to_webp "$SRC/misc/hero.png" "$OUT/misc/hero.webp" 1400 78

encode_audio() {
  local input="$1" name="$2" loudness="$3" trim="$4"
  local filters="loudnorm=I=${loudness}:TP=-1.5:LRA=11"
  if [[ "$trim" == "trim" ]]; then
    filters="silenceremove=start_periods=1:start_threshold=-50dB,${filters}"
  fi
  ffmpeg -loglevel error -y -i "$input" -af "$filters" -ar 48000 -c:a libopus -b:a 96k "$OUT/audio/${name}.webm"
  ffmpeg -loglevel error -y -i "$input" -af "$filters" -ar 44100 -c:a aac -b:a 128k "$OUT/audio/${name}.m4a"
}

for file in "$SRC"/audio/*.mp3; do
  name="$(basename "${file%.mp3}")"
  case "$name" in
    music) encode_audio "$file" "$name" -20 keep ;;
    ambience) encode_audio "$file" "$name" -26 keep ;;
    *) encode_audio "$file" "$name" -16 trim ;;
  esac
done

echo "Assets written to $OUT"
