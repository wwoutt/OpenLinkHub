#!/bin/bash
# Maps the XENEON EDGE touchscreen to the XENEON EDGE output (KDE Plasma 6), so a
# touch lands on the XENEON EDGE instead of being stretched over all screens.
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Usage: ./xeneon-touch.sh [output-name]   (e.g. HDMI-A-2, default: auto-detect 2560x720)
#
# Applies the mapping right away through KWin (D-Bus) and saves it in
# kcminputrc, the same setting as System Settings > Touchscreen > Target display.
# Safe to run again; the kiosk launcher runs it at every start.

# Touchscreen of the XENEON EDGE: "wch.cn TouchScreen", USB 27c0:0859
TOUCH_NAME="${OLH_TOUCH_NAME:-wch.cn TouchScreen}"
TOUCH_VENDOR="${OLH_TOUCH_VENDOR:-10176}"
TOUCH_PRODUCT="${OLH_TOUCH_PRODUCT:-2137}"

OUTPUT="$(kscreen-doctor -j 2>/dev/null | python3 -c '
import json, sys
want = sys.argv[1] if len(sys.argv) > 1 else ""
for o in json.load(sys.stdin)["outputs"]:
    s = o.get("size") or {}
    if o.get("enabled") and (o["name"] == want or (not want and (s.get("width"), s.get("height")) == (2560, 720))):
        print(o["name"])
        break
' "$1")"
if [ -z "$OUTPUT" ]; then
  echo "XENEON EDGE output not found. Pass the output name, see: kscreen-doctor -o" >&2
  exit 1
fi

# "Output: 1 HDMI-A-2 08c5fb86-..." (the JSON output has no UUID)
UUID="$(kscreen-doctor -o 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g' | awk -v n="$OUTPUT" '$1 == "Output:" && $3 == n { print $4 }')"

prop() {
  busctl --user get-property org.kde.KWin "/org/kde/KWin/InputDevice/$1" org.kde.KWin.InputDevice "$2" 2>/dev/null |
    sed -E 's/^[a-z]+ //; s/^"(.*)"$/\1/'
}

# Live: every connected KWin input device that is this touchscreen
found=0
for dev in $(busctl --user get-property org.kde.KWin /org/kde/KWin/InputDevice \
    org.kde.KWin.InputDeviceManager devicesSysNames 2>/dev/null | tr -d '"' | cut -d' ' -f3-); do
  [ "$(prop "$dev" vendor)" = "$TOUCH_VENDOR" ] && [ "$(prop "$dev" product)" = "$TOUCH_PRODUCT" ] || continue
  [ "$(prop "$dev" name)" = "$TOUCH_NAME" ] || continue
  if busctl --user set-property org.kde.KWin "/org/kde/KWin/InputDevice/$dev" \
      org.kde.KWin.InputDevice outputName s "$OUTPUT"; then
    found=1
  fi
done

# Saved: used by KWin for the next session and when the touchscreen reconnects
k() {
  kwriteconfig6 --file kcminputrc --group Libinput --group "$TOUCH_VENDOR" --group "$TOUCH_PRODUCT" \
    --group "$TOUCH_NAME" --key "$1" "$2"
}
k Enabled true
k OutputName "$OUTPUT"
[ -n "$UUID" ] && k OutputUuid "$UUID"

if [ "$found" -eq 1 ]; then
  echo "Touchscreen mapped to $OUTPUT${UUID:+ ($UUID)}."
else
  echo "Touchscreen not connected; saved the mapping to $OUTPUT for when it is."
fi
