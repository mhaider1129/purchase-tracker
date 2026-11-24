#!/bin/sh
# DEDICATED STAGING ONLY. Never run on a development/production host.
set -eu
exec /usr/bin/python3 /opt/scop-staging/host-policy.py firewall
