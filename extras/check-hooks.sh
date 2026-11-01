#!/bin/bash
# Checks that the fork's small hooks in upstream files are still present, e.g.
# after merging an upstream update (git pull upstream main). All fork features
# live in their own files; these hooks are the only links from upstream code.
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Usage: extras/check-hooks.sh   (exit code 1 when a hook is missing)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
missing=0

# check <file> <text that must be present> <how to restore it>
check() {
  if grep -qF -- "$2" "$ROOT/$1" 2>/dev/null; then
    echo "OK       $1: $2"
  else
    echo "MISSING  $1: $2"
    echo "         -> $3"
    missing=1
  fi
}

check src/server/server.go '"OpenLinkHub/src/xeneonlayout"' \
  'add the import "OpenLinkHub/src/xeneonlayout" to the import block'
check src/server/server.go 'xeneonlayout.RegisterRoutes(r)' \
  'add "xeneonlayout.RegisterRoutes(r) // Modified by wwoutt: XENEON EDGE free layout API" right before "return r" at the end of setRoutes()'
check web/xeneon.html '/static/js/xeneon-layout.js' \
  'add <script src="/static/js/xeneon-layout.js"></script> right after the xeneon.js script tag'
check web/sidebar.html '{{ template "sidebar-xeneon-layout" . }}' \
  'add {{ template "sidebar-xeneon-layout" . }} after the bottom links loop ({{ range $menu }} ... {{ end }}), before the GitHub link'
check README.md '(FORK.md)** of [OpenLinkHub]' \
  'add the fork line (see FORK.md) right below the "# OpenLinkHub interface for Linux" title'
check README.md '## Fork: wwoutt/OpenLinkHub' \
  'add the "## Fork: wwoutt/OpenLinkHub" section (list of changes) at the end of README.md'

if [ "$missing" -ne 0 ]; then
  echo
  echo "Some hooks are missing. Restore them as described above, then rebuild (extras/build-podman.sh)."
  exit 1
fi
echo
echo "All hooks present."
