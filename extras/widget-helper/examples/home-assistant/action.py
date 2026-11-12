#!/usr/bin/env python3
# Home Assistant widget action script: calls one Home Assistant service
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Reads {"entity_id": "light.desk", "service": "toggle", "data": {...}} from
# stdin. Only the services and fields in SERVICES are allowed, so the widget
# page can't call anything else in Home Assistant.

import json
import math
import re
import sys

sys.dont_write_bytecode = True  # no __pycache__ in the widget folder

from ha_api import HAError, call, fail


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def text(value):
    return isinstance(value, str) and 0 < len(value) <= 255


TOGGLE = {"turn_on": {}, "turn_off": {}, "toggle": {}}

# domain -> service -> allowed data fields with their check
SERVICES = {
    "light": {"turn_on": {"brightness_pct": number}, "turn_off": {}, "toggle": {}},
    "switch": TOGGLE,
    "input_boolean": TOGGLE,
    "siren": TOGGLE,
    "humidifier": TOGGLE,
    "fan": dict(TOGGLE, set_percentage={"percentage": number}),
    "automation": dict(TOGGLE, trigger={}),
    "script": {"turn_on": {}, "turn_off": {}},
    "scene": {"turn_on": {}},
    "button": {"press": {}},
    "input_button": {"press": {}},
    "cover": {"open_cover": {}, "close_cover": {}, "stop_cover": {},
              "set_cover_position": {"position": number}},
    "valve": {"open_valve": {}, "close_valve": {}},
    "lock": {"lock": {}, "unlock": {}},
    "climate": {"set_temperature": {"temperature": number}, "set_hvac_mode": {"hvac_mode": text}},
    "number": {"set_value": {"value": number}},
    "input_number": {"set_value": {"value": number}},
    "select": {"select_option": {"option": text}},
    "input_select": {"select_option": {"option": text}},
    "media_player": {"media_play_pause": {}, "media_next_track": {}, "media_previous_track": {},
                     "volume_set": {"volume_level": number}, "toggle": {}},
    "vacuum": {"start": {}, "pause": {}, "return_to_base": {}},
    "lawn_mower": {"start_mowing": {}, "pause": {}, "dock": {}},
}

ENTITY_ID = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")


def main():
    try:
        request = json.loads(sys.stdin.read() or "null")
    except ValueError:
        fail("invalid JSON request")
    if not isinstance(request, dict):
        fail("request must be an object")

    entity_id = request.get("entity_id")
    service = request.get("service")
    data = request.get("data") or {}
    if not isinstance(entity_id, str) or not ENTITY_ID.match(entity_id):
        fail("invalid entity_id")
    domain = entity_id.split(".")[0]
    allowed = SERVICES.get(domain, {}).get(service)
    if allowed is None:
        fail("%s.%s is not allowed" % (domain, service))
    if not isinstance(data, dict):
        fail("data must be an object")
    for key, value in data.items():
        if key not in allowed or not allowed[key](value):
            fail("invalid field %s for %s.%s" % (key, domain, service))

    try:
        call("/api/services/%s/%s" % (domain, service), dict(data, entity_id=entity_id), timeout=10)
    except HAError as e:
        fail(str(e))
    print(json.dumps({"done": True}))


if __name__ == "__main__":
    main()
