#!/bin/bash
# Builds the OpenLinkHub binary in a rootless podman container, for immutable
# distributions without development packages (e.g. Bazzite, Silverblue).
# Author: wwoutt (2026-11-01), part of a fork of OpenLinkHub by Nikola Jurkovic
# License: GPL-3.0 or later
#
# Usage: extras/build-podman.sh   (output: ./OpenLinkHub)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GO_VERSION="$(sed -n 's/^go \([0-9.]*\).*/\1/p' "$ROOT/go.mod" | cut -d. -f1,2)"

podman run --rm \
  -v "$ROOT":/src:Z \
  -v openlinkhub-gocache:/root/.cache/go-build \
  -v openlinkhub-gomod:/go/pkg/mod \
  -w /src \
  "docker.io/library/golang:$GO_VERSION" \
  bash -c 'apt-get update -qq && apt-get install -y -qq libudev-dev libpipewire-0.3-dev pkg-config >/dev/null &&
           CGO_CFLAGS_ALLOW="-fno-strict-overflow" go build -buildvcs=false -o OpenLinkHub .'

echo "Built: $ROOT/OpenLinkHub"
