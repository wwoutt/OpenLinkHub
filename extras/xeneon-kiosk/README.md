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
- Touch input goes to the XENEON EDGE only: the touchscreen is mapped to its
  output at install and at every kiosk start (`xeneon-touch.sh`).

Requirements: KDE Plasma 6, a Chromium based browser (Chromium, Google Chrome or
Brave, native or Flatpak), `curl`, `python3`.

### Install
```bash
./install.sh            # auto-detects the 2560x720 output
./install.sh HDMI-A-2   # or pass the output name from: kscreen-doctor -o
```
Run `install.sh` again after changing the monitor layout, so the window rule
gets the new position.

### Touchscreen
Without a mapping, KDE spreads the touchscreen over all screens, so a touch on
the XENEON EDGE lands somewhere else. `xeneon-touch.sh` maps it to the XENEON
EDGE output right away (through KWin) and saves it in `kcminputrc`, the same
setting as System Settings > Touchscreen > Target display (see also
[XENEON EDGE KDE](../../docs/xeneon-edge-kde.md)). You can also run it on its own:
```bash
./xeneon-touch.sh            # auto-detects the 2560x720 output
./xeneon-touch.sh HDMI-A-2   # or pass the output name
```

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
| `OLH_KIOSK_OUTPUT` | auto-detected 2560x720 output, used for the touch mapping |
| `OLH_TOUCH_NAME`, `OLH_TOUCH_VENDOR`, `OLH_TOUCH_PRODUCT` | `wch.cn TouchScreen`, `10176`, `2137` |
