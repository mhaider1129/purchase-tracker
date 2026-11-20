#!/bin/sh
set -eu
test -f /etc/scop-staging/ACTIVATION_APPROVED
test "$(cat /etc/scop-staging/host-purpose)" = wici-isolated-staging-v1
test "$(findmnt -n -o UUID --target /var/lib/scop-staging)" = "$(cat /etc/scop-staging/volume-uuid)"
test -s /var/lib/scop-staging/postgres/PG_VERSION
