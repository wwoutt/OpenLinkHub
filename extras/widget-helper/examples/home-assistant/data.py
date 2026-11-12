#!/usr/bin/env python3
# Home Assistant widget data script: all entities with their state and area
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Read-only: fetches /api/states and renders one template for the area names.
# Prints {"entities": [...], "areas": [...]} on stdout.

import json
import sys

sys.dont_write_bytecode = True  # no __pycache__ in the widget folder

from ha_api import HAError, call, fail

# Domains without anything useful to show or use on the kiosk
SKIP_DOMAINS = {"update", "zone", "event", "tts", "stt", "conversation", "assist_satellite",
                "wake_word", "image", "camera", "persistent_notification", "tag", "ai_task"}

# Attributes the widget uses for its controls
KEEP_ATTRIBUTES = ("device_class", "brightness", "supported_color_modes", "current_position",
                   "options", "min", "max", "step", "temperature", "current_temperature",
                   "target_temp_step", "min_temp", "max_temp", "hvac_modes", "volume_level", "media_title", "media_artist",
                   "percentage")

AREAS_TEMPLATE = (
    "{% set ns = namespace(out=[]) %}"
    "{% for s in states %}{% set a = area_name(s.entity_id) %}"
    "{% if a %}{% set ns.out = ns.out + [[s.entity_id, a]] %}{% endif %}{% endfor %}"
    "{{ ns.out | tojson }}")


def areas():
    """entity_id -> area name; the widget still works without areas."""
    try:
        result = call("/api/template", {"template": AREAS_TEMPLATE}, timeout=8)
        return {pair[0]: pair[1] for pair in result if isinstance(pair, list) and len(pair) == 2}
    except (HAError, TypeError):
        return {}


def main():
    try:
        states = call("/api/states")
    except HAError as e:
        fail(str(e))
    if not isinstance(states, list):
        fail("unexpected answer from /api/states")

    area_of = areas()
    entities = []
    for item in states:
        entity_id = item.get("entity_id") or ""
        domain = entity_id.split(".")[0]
        if domain in SKIP_DOMAINS:
            continue
        attributes = item.get("attributes") or {}
        entities.append({
            "id": entity_id,
            "name": attributes.get("friendly_name") or entity_id,
            "state": item.get("state"),
            "unit": attributes.get("unit_of_measurement"),
            "area": area_of.get(entity_id),
            "attrs": {k: attributes[k] for k in KEEP_ATTRIBUTES if attributes.get(k) is not None},
        })

    print(json.dumps({"entities": entities, "areas": sorted(set(area_of.values()))}))


if __name__ == "__main__":
    main()
