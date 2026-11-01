## XENEON EDGE kiosk (KDE Plasma 6)

> Fork addition (2026-11-01), written by Claude (Anthropic) for wwoutt, see
> [FORK.md](../../FORK.md). Not part of upstream
> [OpenLinkHub](https://github.com/jurkovic-nikola/OpenLinkHub) by Nikola Jurković.
> This project is not an official Corsair product.

Shows the OpenLinkHub kiosk page (`http://127.0.0.1:27003/xeneon`) fullscreen on
the XENEON EDGE, and only there:

- Starts automatically with your desktop session (systemd user service).
- Opens when OpenLinkHub is running and the XENEON EDGE is available, closes
  when OpenLinkHub stops.
- A KWin window rule pins the window fullscreen to the XENEON EDGE output and
  hides it from the taskbar, pager and task switcher.

Requirements: KDE Plasma 6, a Chromium based browser (Chromium, Google Chrome or
Brave, native or Flatpak), `curl`, `python3`.

### Install
```bash
./install.sh            # auto-detects the 2560x720 output
./install.sh HDMI-A-2   # or pass the output name from: kscreen-doctor -o
```
Run `install.sh` again after changing the monitor layout, so the window rule
gets the new position.

For touch input on the right screen, see [XENEON EDGE KDE](../../docs/xeneon-edge-kde.md).

### Uninstall
```bash
./uninstall.sh
```

### Settings
Environment variables for the service (`systemctl --user edit openlinkhub-xeneon-kiosk`):

| Variable | Default |
|---|---|
| `OLH_URL` | `http://127.0.0.1:27003` |
| `OLH_KIOSK_BROWSER` | auto-detected |
| `OLH_KIOSK_PROFILE` | `~/.var/app/com.google.Chrome/olh-xeneon` |
| `OLH_KIOSK_INTERVAL` | `5` (seconds) |
