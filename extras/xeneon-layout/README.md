## XENEON EDGE free layout

> Fork addition (2026-11-01), written by Claude (Anthropic) for wwoutt, see
> [FORK.md](../../FORK.md). Not part of upstream
> [OpenLinkHub](https://github.com/jurkovic-nikola/OpenLinkHub) by Nikola Jurković.
> This project is not an official Corsair product.

Turns the fixed three-column layout of the XENEON EDGE kiosk page
(`http://127.0.0.1:27003/xeneon`) into a free 24 × 12 grid.

### Usage
- In the OpenLinkHub web UI, click **XENEON EDGE layout** in the sidebar
  (`/xeneonLayout`, also in the app menu as "XENEON EDGE layout"). It shows the
  XENEON EDGE screen scaled to fit, editable with the mouse; the XENEON EDGE
  reloads automatically after saving.
- On the XENEON EDGE itself, tap the pencil button in the bottom-right corner.
- **Drag** a widget to move it, drag its edges or corners to **resize** it.
- **Gear**: change colors, font sizes, title and similar settings. Data sources,
  devices and location stay on the device page ("Advanced settings").
- **Eye**: hide a widget. **Add widget** shows hidden widgets again, and adds
  widgets that are not on the screen yet.
- **Save** stores the layout, **Cancel** discards the changes, **Reset to
  default** goes back to the upstream layout.

Without a saved layout the grid starts from the upstream positions.

### How it works
- Upstream still renders the widgets. `static/js/xeneon-layout.js` moves them
  into a [GridStack.js](https://github.com/gridstack/gridstack.js) grid.
- The layout is stored by `src/xeneonlayout` in
  `database/xeneon-layout/layout.json`:
  - `GET /api/xeneonLayout`: saved layout, current widget areas and available widgets
  - `POST /api/xeneonLayout`: save a layout
  - `DELETE /api/xeneonLayout`: remove the saved layout
- Upstream allows 11 widget areas with one widget each. Adding a widget uses a
  free area that allows that widget, so at most 11 widgets can be on screen.

### Build and deploy
On immutable distributions (Bazzite, Silverblue) without development packages:
```bash
extras/build-podman.sh               # builds ./OpenLinkHub in a podman container
extras/deploy-local.sh               # backs up and replaces the binary, web/ and static/ in /var/opt/OpenLinkHub
extras/deploy-local.sh --rollback    # restores the most recent backup
```
`deploy-local.sh` keeps `database/` and `config.json` of the existing install.
