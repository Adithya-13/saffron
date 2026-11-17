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
    filters="silenceremove=start_periods=1:start_threshold=-50dB,lowpass=f=4200,afade=t=in:d=0.012,${filters}"
  fi
  ffmpeg -loglevel error -y -i "$input" -af "$filters" -ar 48000 -c:a libopus -b:a 96k "$OUT/audio/${name}.webm"
  ffmpeg -loglevel error -y -i "$input" -af "$filters" -ar 44100 -c:a aac -b:a 128k "$OUT/audio/${name}.m4a"
}

encode_audio "$SRC/audio/music.mp3" music -24 keep
encode_audio "$SRC/audio/ambience.mp3" ambience -28 keep

SFX_MEAN_DB=-20
SFX_MAX_SECONDS=1.6

mean_db() {
  ffmpeg -hide_banner -i "$1" -af silenceremove=start_periods=1:start_threshold=-50dB,volumedetect \
    -f null - 2>&1 | sed -n 's/.*mean_volume: \(-*[0-9.]*\) dB/\1/p'
}

encode_sfx() {
  local input="$1" name="$2"
  local gain
  gain="$(echo "$SFX_MEAN_DB - $(mean_db "$input")" | bc -l)"
  local filters="silenceremove=start_periods=1:start_threshold=-50dB,atrim=end=${SFX_MAX_SECONDS},afade=t=in:d=0.004,afade=t=out:st=$(echo "$SFX_MAX_SECONDS - 0.3" | bc -l):d=0.3,volume=${gain}dB,alimiter=limit=0.84:level=false"
  ffmpeg -loglevel error -y -i "$input" -af "$filters" -ar 48000 -c:a libopus -b:a 96k "$OUT/audio/${name}.webm"
  ffmpeg -loglevel error -y -i "$input" -af "$filters" -ar 44100 -c:a aac -b:a 128k "$OUT/audio/${name}.m4a"
}

for file in "$SRC"/sfx/*; do
  name="$(basename "${file%.*}")"
  case "$name" in
    victory) encode_audio "$file" "$name" -20 keep ;;
    *) encode_sfx "$file" "$name" ;;
  esac
done

echo "Assets written to $OUT"
