# AI prompt: make an OpenLinkHub XENEON EDGE widget

> Part of the fork [wwoutt/OpenLinkHub](../../FORK.md) of
> [OpenLinkHub](https://github.com/jurkovic-nikola/OpenLinkHub) by Nikola Jurković.
> Not an official Corsair product.

Copy everything in the box below into an AI assistant (Claude, ChatGPT, a local
model, ...) and replace the last line with what your widget should do. The prompt
contains the complete widget format, so the assistant does not need to know this
project.

Always read what you get back before installing it, especially a `data.py` or
`.sh` script: it runs on your computer as your user.

````text
You are making a custom widget for the XENEON EDGE kiosk of OpenLinkHub
(fork wwoutt/OpenLinkHub). Follow this specification exactly.

## Output
Give me the complete contents of each file, each in its own code block with the
file name above it. A widget is one flat folder (no subfolders) named with
lowercase letters, digits, "-" and "_" (max 64 characters), for example
"weather-now". It contains:
- widget.json  (required)
- widget.html  (required)
- data.py      (only for a "script" source; another language is allowed, see below)
- action.py    (only when the widget must change something, see "Actions")
Allowed file types: .json .html .css .js .py .sh .png .jpg .jpeg .svg .webp .md .txt.
At most 30 files, 512 KB per file, 2 MB in total. Readable code only: nothing
minified or obfuscated.
After the files, tell me in short: which settings I must fill in (if any), which
websites the widget contacts, and how to install it.

## widget.json
{
    "name": "Human readable name",
    "description": "What it shows. Mention every website it contacts.",
    "author": "<my name or GitHub user>",
    "license": "GPL-3.0-or-later",
    "version": "1.0.0",
    "size": {"w": 4, "h": 4},
    "refresh": 60,
    "source": {"type": "none"}
}
- size: default size in grid cells. The screen is 2560 x 720 pixels and the grid
  is 24 columns x 12 rows, so one cell is about 106 x 60 px. Example: w 4, h 4 is
  about 420 x 235 px. The user can resize the widget, so the layout must adapt to
  any size (use flexbox, percentages, clamp() or container-relative sizes; never
  a fixed width or height in pixels for the whole widget).
- refresh: seconds between data updates (minimum 1). Pick a sensible value for
  the data source and respect API rate limits.
- source: one of
  - {"type": "none"}: no data, everything happens in JavaScript (clock, timer).
  - {"type": "url", "url": "https://...", "headers": {...}, "timeout": 10}:
    the helper fetches the URL on the computer and passes the JSON (or text) to
    the widget. headers and timeout (seconds, max 60) are optional.
  - {"type": "script", "command": ["python3", "data.py"], "timeout": 10}:
    the helper runs the command in the widget folder and passes what it prints.
    command is optional and defaults to ["python3", "data.py"].
- settings (optional): fields the user fills in with the gear button after
  adding the widget, e.g. a server address or an API key. Never put such values
  in the widget files and never ask the user to edit a file for them:
    "settings": [
        {"name": "HA_URL", "label": "Server", "type": "url", "default": "http://127.0.0.1:8123"},
        {"name": "HA_TOKEN", "label": "Token", "type": "secret", "help": "Where to find it"}
    ]
  name: letters, digits and "_". type: "text", "url" or "secret" (secrets are
  never sent back to the page). label and help are shown to the user.
  Write ${NAME} in the url or in a header value to use a setting.
  Example: "headers": {"Authorization": "Bearer ${HA_TOKEN}"}.
  Scripts read the saved values from the JSON file in the environment variable
  OLH_SETTINGS_FILE (name -> value); fields that were never saved are missing,
  so fall back to the default. The file may not exist yet.

## widget.html
An HTML fragment (no <html>, <head> or <body> tags) with <style> and <script>.
The kiosk wraps it in a sandboxed iframe with this Content Security Policy:
    default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
    img-src data: https:; font-src data:
That means:
- Inline <script> and <style> only. No external scripts, stylesheets or fonts,
  no CDN libraries. Write plain JavaScript (ES2020 is fine).
- NO network access from the widget: fetch, XMLHttpRequest and WebSocket are
  blocked. All data must come through the source in widget.json.
- Images: data: URLs or https:// URLs only.
- No localStorage, cookies, alert(), forms that submit, popups or navigation
  (the iframe sandbox only allows scripts).
- The background is transparent; the kiosk draws the card behind the widget.
  Do not set a background on html or body.

Data arrives in a global function you define:
    function onData(data, info) { ... }
- data: the parsed JSON from the source (or a string when it is not JSON),
  null when there is no data.
- info: {ok: boolean, error: string or null, updated: unix time in seconds}.
- onData is called after the widget loads and again every refresh. Always handle
  info.ok === false (show info.error in a muted color) and a missing or
  unexpected data shape. Use textContent, never innerHTML with data from the
  source.
- For source type "none", start your own timers in the script instead.

Look and feel (dark theme, readable from a distance on a touchscreen):
- Available: the font "Teko" (use for big numbers), and the CSS variables
  --olh-text (#e6e6e6, normal text), --olh-muted (#a1a1a1, labels) and
  --olh-accent (#38bdf8, highlights). The default font is system-ui.
- Large, high-contrast text, little clutter, padding of about 12-18 px. Use
  overflow: hidden and text-overflow: ellipsis so long text never breaks the card.

## Actions (only when the widget must change something, e.g. switch a light)
Add to widget.json:
    "action": {"type": "script", "command": ["python3", "action.py"], "timeout": 15}
In widget.html, call olhAction(request) with a JSON-serializable request. It
returns a Promise of {ok: boolean, error: string or null, data: what the script
printed}. Disable the control or show progress until it resolves; the widget's
data refreshes automatically afterwards. Show result.error when ok is false.
action.py gets the request as JSON on stdin and OLH_SETTINGS_FILE in the
environment, prints one JSON value on success, and on failure writes the error
to stderr and exits non-zero. The request comes from the page, so action.py must
validate it against a fixed allowlist of operations and parameter types, and
never pass it to a shell or use it as a command or file path. It may only do
what the widget is meant to do. Python standard library only, like data.py.

## data.py (only for a "script" source)
- Python 3 standard library only (no pip packages), unless I say otherwise.
  Any other language is allowed if you set "command" accordingly, e.g.
  ["sh", "data.sh"].
- Runs as my normal user (never root) on Linux, in the widget folder, with the
  timeout from widget.json. It must print exactly one JSON value on stdout and
  exit. Print errors to stderr and exit with a non-zero code on failure.
- Read-only: it may read files and run commands that only read information.
  It must not change the system, install anything, need sudo, or send personal
  data anywhere. Mention every website it contacts in the description.
- Keep stdout under 1 MB.

## What I want
<describe your widget here, e.g.: "A widget that shows the current temperature
and humidity of my Home Assistant sensor sensor.living_room from
http://homeassistant.local:8123, refreshing every 30 seconds.">
````

## After the AI answers
1. Create the folder `~/.config/openlinkhub-widgets/<id>/` and save the files in it.
2. Open edit mode on the XENEON EDGE (or **XENEON EDGE layout** in the
   OpenLinkHub sidebar), reload the page, click **Add widget** and pick your
   widget.
3. If the widget has settings (a server, an API key), the settings window opens
   right away; change them later with the gear button on the widget.
4. Does it work and do you want to share it? See
   [Share your widget](README.md#share-your-widget).

If something does not show up, check `journalctl --user -u openlinkhub-widget-helper`
for errors in `widget.json` or the script, and paste them back to the AI.
