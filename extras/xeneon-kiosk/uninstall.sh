#!/bin/bash
# Removes the XENEON EDGE kiosk for the current user.
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later

UNIT="openlinkhub-xeneon-kiosk.service"
RULE="openlinkhub-xeneon-kiosk"

systemctl --user disable --now "$UNIT" 2>/dev/null
rm -f "$HOME/.config/systemd/user/$UNIT"
rm -rf "$HOME/.local/share/openlinkhub-xeneon-kiosk"
rm -f "$HOME/.local/share/applications/openlinkhub-xeneon-editor.desktop"
systemctl --user daemon-reload

kwriteconfig6 --file kwinrulesrc --group "$RULE" --key Description --delete
RULES="$(kreadconfig6 --file kwinrulesrc --group General --key rules | tr ',' '\n' | grep -v -x "$RULE" | paste -sd,)"
kwriteconfig6 --file kwinrulesrc --group General --key rules "$RULES"
kwriteconfig6 --file kwinrulesrc --group General --key count "$(echo "$RULES" | tr ',' '\n' | grep -c .)"
python3 - "$HOME/.config/kwinrulesrc" "$RULE" <<'EOF'
import re, sys
path, rule = sys.argv[1], sys.argv[2]
text = open(path).read()
open(path, "w").write(re.sub(r"\[" + re.escape(rule) + r"\]\n(?:[^\[].*\n?)*", "", text))
EOF
qdbus org.kde.KWin /KWin reconfigure >/dev/null 2>&1
echo "Removed. The browser profile in ~/.var/app/com.google.Chrome/olh-xeneon and the touchscreen mapping are kept."
