#!/bin/bash
# Installs the custom widget helper for the current user, plus the example widgets.
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$HOME/.local/share/openlinkhub-widget-helper"
UNIT_DIR="$HOME/.config/systemd/user"
WIDGET_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/openlinkhub-widgets"
UNIT="openlinkhub-widget-helper.service"

mkdir -p "$APP_DIR" "$UNIT_DIR" "$WIDGET_DIR"
install -m 755 "$DIR/olh-widget-helper.py" "$APP_DIR/olh-widget-helper.py"
install -m 644 "$DIR/$UNIT" "$UNIT_DIR/$UNIT"

# Example widgets, existing widgets are never overwritten
for example in "$DIR"/examples/*/; do
  name="$(basename "$example")"
  if [ ! -e "$WIDGET_DIR/$name" ]; then
    cp -r "$example" "$WIDGET_DIR/$name"
    echo "Added example widget: $name"
  fi
done

# Secrets for widget sources (${NAME} in widget.json), only readable by you
if [ ! -e "$WIDGET_DIR/secrets.json" ]; then
  echo "{}" > "$WIDGET_DIR/secrets.json"
fi
chmod 600 "$WIDGET_DIR/secrets.json"

systemctl --user daemon-reload
systemctl --user enable "$UNIT"
systemctl --user restart "$UNIT"
echo "Done. Widgets folder: $WIDGET_DIR"
