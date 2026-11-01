#!/bin/bash
# Installs the XENEON EDGE kiosk for the current user (KDE Plasma 6).
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Usage: ./install.sh [output-name]   (e.g. HDMI-A-2, default: auto-detect 2560x720)

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/.local/share/openlinkhub-xeneon-kiosk"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT="openlinkhub-xeneon-kiosk.service"
RULE="openlinkhub-xeneon-kiosk"

# Find the XENEON EDGE output and its position
read -r OUTPUT X Y W H < <(kscreen-doctor -j | python3 -c '
import json, sys
want = sys.argv[1] if len(sys.argv) > 1 else ""
for o in json.load(sys.stdin)["outputs"]:
    if not o.get("enabled"):
        continue
    s, p = o["size"], o["pos"]
    if o["name"] == want or (not want and (s["width"], s["height"]) == (2560, 720)):
        print(o["name"], p["x"], p["y"], s["width"], s["height"])
        break
' "$1")

if [ -z "$OUTPUT" ]; then
  echo "XENEON EDGE output not found. Pass the output name, see: kscreen-doctor -o"
  exit 1
fi
echo "XENEON EDGE output: $OUTPUT at $X,$Y (${W}x${H})"

# Launcher and user service
mkdir -p "$APP_DIR" "$UNIT_DIR"
install -m 755 "$DIR/xeneon-kiosk.sh" "$APP_DIR/xeneon-kiosk.sh"
install -m 644 "$DIR/$UNIT" "$UNIT_DIR/$UNIT"

# KWin window rule: pin the kiosk window fullscreen to the XENEON EDGE and keep
# it out of the taskbar, pager and task switcher
k() { kwriteconfig6 --file kwinrulesrc --group "$RULE" --key "$1" "$2"; }
k Description "OpenLinkHub XENEON EDGE kiosk"
k wmclass "127.0.0.1__xeneon"
k wmclasscomplete true
k wmclassmatch 2
k position "$X,$Y"
k positionrule 2
k size "$W,$H"
k sizerule 2
k fullscreen true
k fullscreenrule 2
k noborder true
k noborderrule 2
k minimize false
k minimizerule 2
k skiptaskbar true
k skiptaskbarrule 2
k skippager true
k skippagerrule 2
k skipswitcher true
k skipswitcherrule 2

RULES="$(kreadconfig6 --file kwinrulesrc --group General --key rules)"
if [[ ",$RULES," != *",$RULE,"* ]]; then
  RULES="${RULES:+$RULES,}$RULE"
  kwriteconfig6 --file kwinrulesrc --group General --key rules "$RULES"
  kwriteconfig6 --file kwinrulesrc --group General --key count "$(echo "$RULES" | tr ',' '\n' | grep -c .)"
fi
qdbus org.kde.KWin /KWin reconfigure >/dev/null 2>&1 || true

systemctl --user daemon-reload
systemctl --user enable --now "$UNIT"
echo "Done. The kiosk starts automatically with your desktop session."
