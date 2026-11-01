#!/bin/bash
# XENEON EDGE kiosk launcher for OpenLinkHub
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Shows the OpenLinkHub kiosk page (/xeneon) in a dedicated browser window while
# OpenLinkHub is running and the XENEON EDGE is available, and closes it when
# OpenLinkHub stops. A KWin window rule (see install.sh) pins the window
# fullscreen to the XENEON EDGE output.

URL="${OLH_URL:-http://127.0.0.1:27003}/xeneon"
PROFILE="${OLH_KIOSK_PROFILE:-$HOME/.var/app/com.google.Chrome/olh-xeneon}"
INTERVAL="${OLH_KIOSK_INTERVAL:-5}"

# Find a Chromium based browser. Its --app window gets a window class containing
# "127.0.0.1__xeneon", which is what the KWin rule matches on.
findBrowser() {
  for b in chromium chromium-browser google-chrome google-chrome-stable brave-browser; do
    if command -v "$b" >/dev/null; then
      echo "$b"
      return
    fi
  done
  for f in com.google.Chrome org.chromium.Chromium com.brave.Browser; do
    if flatpak info "$f" >/dev/null 2>&1; then
      echo "flatpak run $f"
      return
    fi
  done
}

BROWSER="${OLH_KIOSK_BROWSER:-$(findBrowser)}"
if [ -z "$BROWSER" ]; then
  echo "No Chromium based browser found. Set OLH_KIOSK_BROWSER." >&2
  exit 1
fi

isAvailable() {
  # /xeneon returns an error status when the XENEON EDGE is not available
  curl -fs -o /dev/null --max-time 3 "$URL"
}

isRunning() {
  pgrep -f -- "--user-data-dir=$PROFILE" >/dev/null
}

# Changes when OpenLinkHub restarts (e.g. after an update), so the page reloads
serverId() {
  systemctl show -p MainPID --value OpenLinkHub 2>/dev/null
}

disableTranslate() {
  # The Translate feature flag does not hide the translate popup, the profile
  # preference does
  mkdir -p "$PROFILE/Default"
  python3 - "$PROFILE/Default/Preferences" <<'EOF'
import json, os, sys
path = sys.argv[1]
prefs = {}
if os.path.exists(path):
    try:
        prefs = json.load(open(path))
    except ValueError:
        pass
prefs.setdefault("translate", {})["enabled"] = False
json.dump(prefs, open(path, "w"))
EOF
}

startKiosk() {
  disableTranslate
  # shellcheck disable=SC2086
  $BROWSER \
    --user-data-dir="$PROFILE" \
    --app="$URL" \
    --no-first-run \
    --no-default-browser-check \
    --noerrdialogs \
    --disable-session-crashed-bubble \
    --disable-features=Translate \
    --password-store=basic \
    >/dev/null 2>&1 &
}

stopKiosk() {
  pkill -f -- "--user-data-dir=$PROFILE"
  for _ in 1 2 3 4 5; do
    isRunning || return 0
    sleep 1
  done
  pkill -KILL -f -- "--user-data-dir=$PROFILE"
}

trap 'stopKiosk; exit 0' TERM INT

# Map the touchscreen to the XENEON EDGE (output names can change between sessions)
"$(dirname "$0")/xeneon-touch.sh" "$OLH_KIOSK_OUTPUT" || true

# A Flatpak browser runs outside this service, clean up a previous instance
stopKiosk
lastServer=""

while true; do
  if isAvailable; then
    server="$(serverId)"
    if [ -n "$lastServer" ] && [ "$server" != "$lastServer" ]; then
      stopKiosk
    fi
    lastServer="$server"

    isRunning || startKiosk
  else
    isRunning && stopKiosk
  fi
  sleep "$INTERVAL"
done
