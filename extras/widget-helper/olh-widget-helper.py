#!/usr/bin/env python3
# Custom widget helper for the OpenLinkHub XENEON EDGE kiosk
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Runs as the desktop user and serves custom widgets from
# ~/.config/openlinkhub-widgets/<id>/ to the kiosk page:
#   GET /api/widgets            list of widgets (widget.json)
#   GET /api/widgets/<id>/html  widget.html
#   GET /api/widgets/<id>/data  data from the widget source (cached per refresh)
#
# A widget source is either "none", "url" (fetched here, so API keys stay out of
# the page) or "script" (any program that prints JSON, run as the desktop user).
# Only the kiosk page origin may call the API; see check_request().

import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = int(os.environ.get("OLH_WIDGET_PORT", "27004"))
CONFIG_DIR = os.path.expanduser(os.environ.get(
    "OLH_WIDGET_DIR",
    os.path.join(os.environ.get("XDG_CONFIG_HOME", "~/.config"), "openlinkhub-widgets")))
SECRETS_FILE = os.path.join(CONFIG_DIR, "secrets.json")
ORIGINS = set(os.environ.get(
    "OLH_WIDGET_ORIGINS", "http://127.0.0.1:27003,http://localhost:27003").split(","))
HOSTS = {"%s:%d" % (h, PORT) for h in ("127.0.0.1", "localhost")}

WIDGET_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
MAX_OUTPUT = 1024 * 1024
DEFAULT_TIMEOUT = 10
MAX_TIMEOUT = 60

cache = {}
locks = {}
locks_mutex = threading.Lock()


def log(message):
    print(message, file=sys.stderr, flush=True)


def widget_dir(widget_id):
    if not WIDGET_ID.match(widget_id):
        return None
    path = os.path.join(CONFIG_DIR, widget_id)
    return path if os.path.isfile(os.path.join(path, "widget.json")) else None


def load_manifest(widget_id):
    path = widget_dir(widget_id)
    if not path:
        return None
    try:
        with open(os.path.join(path, "widget.json"), encoding="utf-8") as f:
            manifest = json.load(f)
    except (OSError, ValueError) as e:
        log("widget %s: invalid widget.json: %s" % (widget_id, e))
        return None
    if not isinstance(manifest, dict):
        return None
    return manifest


def public_manifest(widget_id, manifest):
    size = manifest.get("size") if isinstance(manifest.get("size"), dict) else {}
    source = manifest.get("source") if isinstance(manifest.get("source"), dict) else {}
    return {
        "id": widget_id,
        "name": str(manifest.get("name") or widget_id),
        "description": str(manifest.get("description") or ""),
        "size": {"w": int(size.get("w") or 4), "h": int(size.get("h") or 3)},
        "refresh": refresh_seconds(manifest),
        "source": str(source.get("type") or "none"),
    }


def refresh_seconds(manifest):
    try:
        return max(1, int(manifest.get("refresh") or 60))
    except (TypeError, ValueError):
        return 60


def timeout_seconds(source):
    try:
        return min(MAX_TIMEOUT, max(1, int(source.get("timeout") or DEFAULT_TIMEOUT)))
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT


def load_secrets():
    try:
        with open(SECRETS_FILE, encoding="utf-8") as f:
            secrets = json.load(f)
        return secrets if isinstance(secrets, dict) else {}
    except (OSError, ValueError):
        return {}


def fill_secrets(value, secrets):
    """Replaces ${NAME} with the value of NAME from secrets.json."""
    return re.sub(r"\$\{([A-Za-z0-9_]+)\}", lambda m: str(secrets.get(m.group(1), "")), value)


def parse_output(raw, content_type=""):
    text = raw.decode("utf-8", errors="replace")
    if "json" in content_type or text.lstrip()[:1] in ("{", "["):
        try:
            return json.loads(text)
        except ValueError:
            pass
    return text


def fetch_url(source):
    secrets = load_secrets()
    url = fill_secrets(str(source.get("url") or ""), secrets)
    if not url.startswith(("http://", "https://")):
        raise ValueError("source.url must start with http:// or https://")
    headers = {"User-Agent": "OpenLinkHub-widget-helper"}
    for key, value in (source.get("headers") or {}).items():
        headers[str(key)] = fill_secrets(str(value), secrets)
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout_seconds(source)) as response:
        raw = response.read(MAX_OUTPUT + 1)
        if len(raw) > MAX_OUTPUT:
            raise ValueError("response larger than 1 MB")
        return parse_output(raw, response.headers.get("Content-Type", ""))


def run_script(path, source):
    command = source.get("command") or ["python3", "data.py"]
    if isinstance(command, str):
        command = [command]
    command = [str(part) for part in command]
    env = dict(os.environ, OLH_WIDGET_DIR=path, OLH_SECRETS_FILE=SECRETS_FILE)
    result = subprocess.run(command, cwd=path, env=env, capture_output=True,
                            timeout=timeout_seconds(source))
    if result.returncode != 0:
        error = result.stderr.decode("utf-8", errors="replace").strip()[-500:]
        raise RuntimeError("script exited with %d: %s" % (result.returncode, error))
    if len(result.stdout) > MAX_OUTPUT:
        raise ValueError("script output larger than 1 MB")
    return parse_output(result.stdout)


def widget_lock(widget_id):
    with locks_mutex:
        return locks.setdefault(widget_id, threading.Lock())


def get_data(widget_id, manifest):
    """Returns the cached data, or refreshes it when it is older than refresh."""
    with widget_lock(widget_id):
        entry = cache.get(widget_id)
        if entry and time.time() - entry["time"] < refresh_seconds(manifest):
            return entry["value"]

        source = manifest.get("source") if isinstance(manifest.get("source"), dict) else {}
        kind = source.get("type") or "none"
        value = {"ok": True, "data": None, "error": None, "updated": int(time.time())}
        try:
            if kind == "url":
                value["data"] = fetch_url(source)
            elif kind == "script":
                value["data"] = run_script(widget_dir(widget_id), source)
            elif kind != "none":
                raise ValueError("unknown source type: %s" % kind)
        except subprocess.TimeoutExpired:
            value.update(ok=False, error="script timed out")
        except (urllib.error.URLError, OSError, ValueError, RuntimeError) as e:
            value.update(ok=False, error=str(e))
        if not value["ok"]:
            log("widget %s: %s" % (widget_id, value["error"]))

        cache[widget_id] = {"time": time.time(), "value": value}
        return value


def list_widgets():
    widgets = []
    try:
        names = sorted(os.listdir(CONFIG_DIR))
    except OSError:
        names = []
    for name in names:
        manifest = load_manifest(name)
        if manifest is not None:
            widgets.append(public_manifest(name, manifest))
    return widgets


class Handler(BaseHTTPRequestHandler):
    server_version = "OpenLinkHub-widget-helper"

    def cors_headers(self):
        origin = self.headers.get("Origin")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Headers", "X-OLH-Widget")
            self.send_header("Access-Control-Allow-Methods", "GET")
            self.send_header("Vary", "Origin")

    def send_json(self, code, value):
        body = json.dumps(value).encode("utf-8")
        self.send_response(code)
        self.cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def check_request(self):
        # Host check stops DNS rebinding. Browsers must send the custom header,
        # which forces a CORS preflight that only the kiosk origin passes, so
        # other websites can't trigger scripts or read data.
        if self.headers.get("Host") not in HOSTS:
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin not in ORIGINS:
            return False
        return self.headers.get("X-OLH-Widget") == "1"

    def do_OPTIONS(self):
        if self.headers.get("Host") not in HOSTS or self.headers.get("Origin") not in ORIGINS:
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        self.cors_headers()
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        if not self.check_request():
            self.send_json(403, {"ok": False, "error": "forbidden"})
            return

        parts = [p for p in self.path.split("?")[0].split("/") if p]
        if parts == ["api", "widgets"]:
            self.send_json(200, {"ok": True, "widgets": list_widgets()})
            return

        if len(parts) == 4 and parts[:2] == ["api", "widgets"]:
            widget_id, action = parts[2], parts[3]
            manifest = load_manifest(widget_id)
            if manifest is None:
                self.send_json(404, {"ok": False, "error": "unknown widget"})
                return
            if action == "html":
                try:
                    with open(os.path.join(widget_dir(widget_id), "widget.html"), encoding="utf-8") as f:
                        html = f.read()
                except OSError:
                    html = "<p>widget.html missing</p>"
                self.send_json(200, {"ok": True, "widget": public_manifest(widget_id, manifest), "html": html})
                return
            if action == "data":
                self.send_json(200, get_data(widget_id, manifest))
                return

        self.send_json(404, {"ok": False, "error": "not found"})

    def log_message(self, fmt, *args):
        pass


def main():
    os.makedirs(CONFIG_DIR, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    log("serving widgets from %s on http://%s:%d" % (CONFIG_DIR, HOST, PORT))
    server.serve_forever()


if __name__ == "__main__":
    main()
