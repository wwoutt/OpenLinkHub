# Shared code for the Home Assistant widget scripts (data.py, action.py)
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Reads HA_URL and HA_TOKEN from the widget settings (gear button in edit mode,
# file in OLH_SETTINGS_FILE), or else from secrets.json (OLH_SECRETS_FILE), and
# talks to the Home Assistant REST API.

import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_URL = "http://127.0.0.1:8123"


class HAError(Exception):
    pass


def read_json(variable):
    try:
        with open(os.environ.get(variable, ""), encoding="utf-8") as f:
            values = json.load(f)
        return values if isinstance(values, dict) else {}
    except (OSError, ValueError):
        return {}


def settings():
    values = read_json("OLH_SECRETS_FILE")
    values.update({k: v for k, v in read_json("OLH_SETTINGS_FILE").items() if v})
    url = str(values.get("HA_URL") or DEFAULT_URL).rstrip("/")
    token = str(values.get("HA_TOKEN") or "")
    if not url.startswith(("http://", "https://")):
        raise HAError("the server address must start with http:// or https://")
    if not token:
        raise HAError("no token set: open edit mode and use the gear button of this widget")
    return url, token


def call(path, body=None, timeout=8):
    """GET (body None) or POST JSON to the Home Assistant API, returns parsed JSON."""
    url, token = settings()
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url + path, data=data, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": "OpenLinkHub-widget-helper",
    })
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            raise HAError("Home Assistant refused the token (401), check it with the gear button")
        raise HAError("Home Assistant answered HTTP %d" % e.code)
    except (urllib.error.URLError, OSError) as e:
        raise HAError("cannot reach Home Assistant at %s: %s" % (url, getattr(e, "reason", e)))
    try:
        return json.loads(text)
    except ValueError:
        return text


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(1)
