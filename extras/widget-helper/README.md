## Custom widgets for the XENEON EDGE kiosk

> Fork addition by wwoutt (2026-11-01). Not part of upstream OpenLinkHub.
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
Create a folder in `~/.config/openlinkhub-widgets/` (lowercase letters, digits,
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
`--olh-muted` and `--olh-accent`.

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

### Examples
- [`wisselkoers`](examples/wisselkoers): exchange rates, `url` source, no code for the data
- [`systeemstatus`](examples/systeemstatus): uptime, load and pending rpm-ostree update, `script` source in Python

### Security
- The helper only listens on `127.0.0.1:27004` and only answers the kiosk page
  (`http://127.0.0.1:27003`, `http://localhost:27003`); other websites can't
  run scripts or read data. Change the allowed origins with `OLH_WIDGET_ORIGINS`.
- Widgets run in a sandboxed iframe without network access; the kiosk page
  passes them their data. A broken widget can't affect the rest of the page.
- Scripts run as your user, never as root. Only put scripts you trust in the
  widgets folder.
