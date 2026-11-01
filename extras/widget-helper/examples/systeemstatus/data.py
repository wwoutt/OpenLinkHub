#!/usr/bin/env python3
# Example custom widget data script: system status (script source)
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Prints JSON on stdout. Runs as the desktop user, so it can use anything the
# user can: files, commands, the user session.

import json
import os
import shutil
import subprocess


def uptime_seconds():
    with open("/proc/uptime") as f:
        return int(float(f.read().split()[0]))


def pending_update():
    """True when rpm-ostree has a newer deployment that needs a reboot."""
    if not shutil.which("rpm-ostree"):
        return None
    try:
        output = subprocess.run(["rpm-ostree", "status", "--json"], capture_output=True, timeout=10, check=True).stdout
        deployments = json.loads(output)["deployments"]
    except (subprocess.SubprocessError, ValueError, KeyError):
        return None
    # The first deployment is the one that boots next
    return bool(deployments) and not deployments[0].get("booted", False)


load1, load5, load15 = os.getloadavg()
print(json.dumps({
    "hostname": os.uname().nodename,
    "uptime": uptime_seconds(),
    "load": [round(load1, 2), round(load5, 2), round(load15, 2)],
    "cpus": os.cpu_count(),
    "updatePending": pending_update(),
}))
