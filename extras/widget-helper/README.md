## Custom widgets for the XENEON EDGE kiosk

> Fork addition (2026-11-01), written by Claude (Anthropic) for wwoutt, see
> [FORK.md](../../FORK.md). Not part of upstream
> [OpenLinkHub](https://github.com/jurkovic-nikola/OpenLinkHub) by Nikola Jurković.
> This project is not an official Corsair product.

Add your own widgets to the [free layout](../xeneon-layout/README.md): a folder
with an HTML file, and optionally a data source from the internet or from Linux.

### Install
```bash
./install.sh
```
Installs the widget helper as a user service (`openlinkhub-widget-helper`) and
copies the example widgets to `~/.config/openlinkhub-widgets/`.

Then open edit mode on the XENEON EDGE, **Add widget**, and pick a widget marked
"custom". New widget folders show up after reloading the page.

### Make a widget
**Quickest way:** copy the [AI prompt](AI-WIDGET-PROMPT.md) into an AI assistant,
describe what you want, and save the files it gives you. The prompt contains the
complete format below, including the rules of the sandbox.

**By hand:** create a folder in `~/.config/openlinkhub-widgets/` (lowercase letters, digits,
`-` and `_`), with:

**`widget.json`**
```json
{
    "name": "My widget",
    "description": "What it shows",
    "size": {"w": 4, "h": 4},
    "refresh": 60,
    "source": {"type": "none"}
}
```
- `size`: default size in grid cells (the grid is 24 × 12)
- `refresh`: seconds between data updates
- `source`: where the data comes from, see below

**`widget.html`**: what the widget shows. Define `onData` to receive the data:
```html
<style>
    .value { font-family: Teko, sans-serif; font-size: 48px; color: var(--olh-accent); }
</style>
<div class="value" id="value">--</div>
<script>
    function onData(data, info) {
        // info: {ok, error, updated}
        document.getElementById('value').textContent = info.ok ? data.value : info.error;
    }
</script>
```
Available in the widget: the `Teko` font and the colors `--olh-text`,
`--olh-muted` and `--olh-accent`. `onData` is called once the widget has loaded
and after every refresh; `data` is the parsed JSON (or text) from the source.

Optional fields for sharing your widget: `author`, `license` (an SPDX id such as
`GPL-3.0-or-later` or `MIT`) and `version`. The store requires them.

### What a widget can and cannot do
The widget runs in a sandboxed iframe with a strict Content Security Policy:

| Can | Cannot |
|---|---|
| Inline `<style>` and `<script>` | Load external scripts, stylesheets or fonts (no CDNs) |
| Images from `data:` or `https://` URLs | `fetch`, `XMLHttpRequest` or WebSockets: data only comes through the source |
| Animations, timers, canvas, SVG | `localStorage`, cookies, popups, forms, navigating away |
| React to touch and clicks inside the widget | Do anything outside the widget, except through its own action script (see [Actions](#actions)) |

Design for any size: the user can resize the widget. One grid cell is about
106 × 60 pixels on the 2560 × 720 screen.

### Data sources

| `source.type` | Use | Settings |
|---|---|---|
| `none` | Only JavaScript (a clock, a countdown) | |
| `url` | Internet: JSON or text from a web address | `url`, optional `headers`, `timeout` (s) |
| `script` | Linux: any program that prints JSON | `command` (default `["python3", "data.py"]`), `timeout` (s) |

**Internet** (`url`): the helper fetches the address, so it works for APIs that
browsers block, and API keys stay out of the page. Put keys in
`~/.config/openlinkhub-widgets/secrets.json` (only readable by you) and use
`${NAME}` in `url` or `headers`:
```json
"source": {
    "type": "url",
    "url": "https://api.example.com/data?key=${EXAMPLE_KEY}",
    "headers": {"Authorization": "Bearer ${EXAMPLE_TOKEN}"}
}
```

**Linux** (`script`): runs in the widget folder as your own user, so it can use
your files, commands and desktop session, but never more than you can. It must
print JSON (or text) on stdout within `timeout` seconds. Python is recommended,
any language works. `OLH_SECRETS_FILE` points to `secrets.json`.

### Settings
A widget can ask for settings, such as a server address or an API token. In
edit mode the widget then gets a gear button, and the settings window opens by
itself when you add the widget. Declare the fields in `widget.json`:
```json
"settings": [
    {"name": "HA_URL", "label": "Server", "type": "url", "default": "http://127.0.0.1:8123"},
    {"name": "HA_TOKEN", "label": "Token", "type": "secret", "help": "Where to find it"}
]
```
- `type`: `text`, `url` (must start with `http://` or `https://`) or `secret`
  (a password field; the value is never sent back to the page, the window only
  shows whether it is set, and leaving it empty keeps the stored value).
- The helper stores the values in `~/.config/openlinkhub-widgets/.settings/<id>.json`
  (only readable by you), outside the widget folder, so updates from the store
  keep them. Removing the widget in the store removes them too.
- Use them as `${NAME}` in a `url` source (they take precedence over
  `secrets.json`), or read the file in `OLH_SETTINGS_FILE` from a script. Fields
  that were never saved are missing from that file; use their default.

### Actions
A widget can also *do* something, such as switching a light. Add an `action`
script to `widget.json`:
```json
"action": {"type": "script", "command": ["python3", "action.py"], "timeout": 15}
```
In `widget.html`, call `olhAction(request)`. It returns a Promise with
`{ok, error, data}`:
```js
olhAction({entity_id: 'light.desk', service: 'toggle'}).then(function (result) { ... });
```
The helper runs the script in the widget folder as your user, with the request
as JSON on stdin and `OLH_SETTINGS_FILE` set. The script prints JSON on success,
or writes an error to stderr and exits non-zero. After an action, the widget's
data refreshes right away.

The request comes from the widget page, so the action script must check it:
allow only the specific things the widget is meant to do (see
[`home-assistant/action.py`](examples/home-assistant/action.py)), and never pass
the request on to a shell or as a command.

### Examples
- [`wisselkoers`](examples/wisselkoers): exchange rates, `url` source, no code for the data
- [`systeemstatus`](examples/systeemstatus): uptime, load and pending rpm-ostree update, `script` source in Python
- [`home-assistant`](examples/home-assistant): all Home Assistant entities, with controls for
  lights, switches, buttons, scenes, scripts, covers, climate, media and more. Uses the
  `script` source and an action script. After adding it, enter the server
  address and a long-lived access token (Home Assistant > your profile >
  Security) in its settings window (gear button in edit mode).
  Filter by type, room or name; tap a row for more controls such as brightness.

### Share your widget
- **Reviewed catalog:** open a pull request that adds your widget folder to
  [wwoutt/openlinkhub-widgets](https://github.com/wwoutt/openlinkhub-widgets),
  see its [CONTRIBUTING.md](https://github.com/wwoutt/openlinkhub-widgets/blob/main/CONTRIBUTING.md).
  It shows up in the **Reviewed** tab after review.
- **Your own repository:** put the widget files (`widget.json`, `widget.html`,
  ...) in the root of a public GitHub repository and add the topic
  `openlinkhub-widget`. It shows up in the **Community** tab right away.

Rules for both: a flat folder, at most 30 files, 512 KB per file and 2 MB in
total; allowed types `.json .html .css .js .py .sh .png .jpg .jpeg .svg .webp
.md .txt`; no secrets in the files (use `${NAME}`), readable code only, data
scripts that only read data, and action scripts that only allow what the
widget is meant to do.

### Store
In edit mode, **Store** shows widgets made by others:
- **Reviewed**: the catalog repository
  [wwoutt/openlinkhub-widgets](https://github.com/wwoutt/openlinkhub-widgets).
  Widgets are reviewed before they are added, and every downloaded file is
  checked against the SHA-256 in its `index.json`.
- **Community (not reviewed)**: public GitHub repositories with the topic
  `openlinkhub-widget` and the widget files in the repository root. They are
  installed at a fixed commit, so the code you preview is the code you install.

Widgets that run code (a `script` source, an `action`, `.py` or `.sh` files) show their code
first and need an explicit confirmation. Nothing is updated automatically: the
store shows "update available" and you choose. Only widgets installed from the
store can be removed from the store; they keep their install record in
`.olh-store.json`.

Settings in `~/.config/openlinkhub-widgets/store.json` (all optional):
```json
{
    "catalog": "https://raw.githubusercontent.com/wwoutt/openlinkhub-widgets/main/",
    "community": true,
    "topic": "openlinkhub-widget"
}
```
GitHub allows 60 unauthenticated requests per hour. With many community widgets,
add a personal access token without permissions as `GITHUB_TOKEN` to
`secrets.json`.

### Security
- The helper only listens on `127.0.0.1:27004` and only answers the kiosk page
  (`http://127.0.0.1:27003`, `http://localhost:27003`); other websites can't
  run scripts or read data. Change the allowed origins with `OLH_WIDGET_ORIGINS`.
- Widgets run in a sandboxed iframe without network access; the kiosk page
  passes them their data. A broken widget can't affect the rest of the page.
- Scripts run as your user, never as root. Only put scripts you trust in the
  widgets folder.
- A widget can only cause changes through its own action script, which checks
  every request; the page can't run other commands.
